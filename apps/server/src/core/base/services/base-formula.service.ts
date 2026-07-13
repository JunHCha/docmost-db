import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { v7 as uuid7 } from 'uuid';
import {
  BaseFormulaGraph,
  DEFAULT_MAX_DEPTH,
  MAX_FORMULA_SOURCE_LENGTH,
  evaluate,
  registry,
  resolve,
  parseRaw,
  typecheck,
  type FormulaResultType,
} from '@docmost/base-formula/server';
import { BaseProperty, BaseRow } from '@docmost/db/types/entity.types';
import { BaseRowRepo } from '@docmost/db/repos/base/base-row.repo';
import { EventName } from '../../../common/events/event.contants';

const ROWS_UPDATED_CHUNK = 500;

function resultTypeOf(property: BaseProperty): FormulaResultType {
  const type = property.type;
  if (type === 'number') return 'number';
  if (
    type === 'text' ||
    type === 'url' ||
    type === 'email' ||
    type === 'longText'
  ) {
    return 'string';
  }
  if (type === 'checkbox') return 'boolean';
  if (type === 'date' || type === 'createdAt' || type === 'lastEditedAt') {
    return 'date';
  }
  if (type === 'formula') {
    return ((property.typeOptions as any)?.resultType ??
      'null') as FormulaResultType;
  }
  return 'null';
}

type FormulaTypeOptions = {
  source: string;
  ast: unknown;
  resultType: string;
  dependencies: string[];
  astVersion: 1;
  formatOptions?: Record<string, unknown>;
};

// Formula cells are evaluated server-side only (the client ships the
// parser/typechecker but no evaluator). The fork recomputes synchronously
// in-request — fine at dev scale; move to BASE_FORMULA_RECOMPUTE queue
// jobs if bases grow beyond that.
@Injectable()
export class BaseFormulaService {
  private readonly logger = new Logger(BaseFormulaService.name);

  constructor(
    private readonly baseRowRepo: BaseRowRepo,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Validates and normalizes formula typeOptions on property create/update.
  // Re-parses the client-supplied source server-side; never trusts the
  // client AST.
  buildTypeOptions(
    source: unknown,
    properties: BaseProperty[],
    editingPropertyId: string | null,
    formatOptions?: Record<string, unknown>,
  ): FormulaTypeOptions {
    if (typeof source !== 'string' || source.trim() === '') {
      throw new BadRequestException('formula source is required');
    }
    if (source.length > MAX_FORMULA_SOURCE_LENGTH) {
      throw new BadRequestException('formula source too long');
    }
    try {
      const nameToId = new Map(properties.map((p) => [p.name, p.id]));
      const raw = parseRaw(source);
      const resolved = resolve(raw, nameToId);
      const typeMap = new Map<string, FormulaResultType>(
        properties.map((p) => [p.id, resultTypeOf(p)]),
      );
      const checked = typecheck(resolved.ast, typeMap, registry);
      const candidate = {
        id: editingPropertyId ?? 'pending',
        type: 'formula',
        typeOptions: { dependencies: resolved.dependencies },
      };
      const others = editingPropertyId
        ? properties.filter((p) => p.id !== editingPropertyId)
        : properties;
      const cycle = new BaseFormulaGraph([
        ...(others as any[]),
        candidate as any,
      ]).detectCycle(candidate as any);
      if (cycle) {
        throw new BadRequestException(
          `formula cycle: ${cycle.join(' -> ')}`,
        );
      }
      return {
        source,
        ast: resolved.ast,
        resultType: checked.resultType,
        dependencies: resolved.dependencies,
        astVersion: 1,
        formatOptions,
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const anyErr = err as any;
      throw new BadRequestException(
        `invalid formula: ${anyErr?.errors?.[0]?.message ?? anyErr?.message}`,
      );
    }
  }

  formulaProperties(properties: BaseProperty[]): BaseProperty[] {
    return properties.filter(
      (p) => p.type === 'formula' && !p.deletedAt,
    );
  }

  // Formula properties whose dependency set intersects the changed cells.
  affectedBy(
    properties: BaseProperty[],
    changedPropertyIds: string[],
  ): BaseProperty[] {
    const changed = new Set(changedPropertyIds);
    return this.formulaProperties(properties).filter((p) => {
      const deps = (p.typeOptions as any)?.dependencies ?? [];
      return deps.some((d: string) => changed.has(d));
    });
  }

  // Recomputes the given formula properties for one row and returns the
  // cell patch (not yet persisted).
  computeRowPatch(
    row: BaseRow,
    formulaProps: BaseProperty[],
    allProperties: BaseProperty[],
  ): Record<string, unknown> {
    if (formulaProps.length === 0) return {};
    const lookup = new Map(
      allProperties.map((p) => [
        p.id,
        { id: p.id, type: p.type, typeOptions: p.typeOptions },
      ]),
    );
    const cells = (row.cells ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    for (const prop of formulaProps) {
      const options = prop.typeOptions as any;
      if (!options?.ast) continue;
      const value = evaluate(options.ast, cells, {
        registry,
        properties: lookup as any,
        depth: 0,
        maxDepth: DEFAULT_MAX_DEPTH,
        memo: new Map(),
      });
      patch[prop.id] = value ?? null;
    }
    return patch;
  }

  // Full-base synchronous recompute (property created/edited, dependency
  // type changed). Persists per-row patches and emits the started /
  // rows-updated / completed socket flow the client expects.
  async recomputeAll(
    pageId: string,
    formulaProps: BaseProperty[],
    allProperties: BaseProperty[],
  ): Promise<void> {
    if (formulaProps.length === 0) return;
    const propertyIds = formulaProps.map((p) => p.id);
    const jobId = uuid7();
    this.eventEmitter.emit(EventName.BASE_FORMULA_RECOMPUTE_STARTED, {
      operation: 'base:formula:recompute:started',
      pageId,
      propertyIds,
      jobId,
    });

    let processed = 0;
    let errored = 0;
    const touchedRowIds: string[] = [];
    try {
      const rows = await this.baseRowRepo.findAllLive(pageId);
      for (const row of rows) {
        const patch = this.computeRowPatch(row, formulaProps, allProperties);
        if (Object.keys(patch).length === 0) continue;
        await this.baseRowRepo.patchCells(
          row.id,
          patch,
          row.lastUpdatedById ?? row.creatorId,
        );
        processed++;
        touchedRowIds.push(row.id);
        if (
          Object.values(patch).some(
            (v) => v && typeof v === 'object' && '__err' in (v as any),
          )
        ) {
          errored++;
        }
      }
    } catch (err) {
      this.logger.warn(`formula recompute failed: ${(err as any)?.message}`);
    }

    for (let i = 0; i < touchedRowIds.length; i += ROWS_UPDATED_CHUNK) {
      this.eventEmitter.emit(EventName.BASE_ROWS_UPDATED, {
        operation: 'base:rows:updated',
        pageId,
        rowIds: touchedRowIds.slice(i, i + ROWS_UPDATED_CHUNK),
        propertyIds,
      });
    }
    this.eventEmitter.emit(EventName.BASE_FORMULA_RECOMPUTE_COMPLETED, {
      operation: 'base:formula:recompute:completed',
      pageId,
      propertyIds,
      jobId,
      processed,
      errored,
    });
  }
}
