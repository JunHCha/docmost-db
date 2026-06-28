// Helpers for seeding a template's embed views onto a newly created row.
//
// A template stores embed view settings as { [embedId]: StoredEmbedView[] }.
// A relation filter inside such a view may carry a *reference* value of the
// form { templatePropertyRef: <templatePropertyId> } instead of a literal page
// id. At row creation we snapshot those references against the row's actual
// relation values. See issue #115.

export interface TemplatePropertyRef {
  templatePropertyRef: string;
}

export interface ViewFilter {
  propertyId: string;
  op: string;
  value?: unknown;
}

export interface ViewConfig {
  filters?: ViewFilter[];
  [key: string]: unknown;
}

export function isTemplatePropertyRef(
  value: unknown,
): value is TemplatePropertyRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as { templatePropertyRef?: unknown }).templatePropertyRef ===
      'string'
  );
}

// Replace template-property references in filters with the row's real relation
// page ids, expanding to one AND condition per id. References resolving to no
// ids are dropped. Non-reference filters and all other config keys are kept.
export function resolveSnapshotConfig(
  config: ViewConfig,
  relationValuesByPropertyId: Map<string, string[]>,
): ViewConfig {
  const filters = config.filters;
  if (!Array.isArray(filters)) return config;

  const resolved: ViewFilter[] = [];
  for (const filter of filters) {
    if (!isTemplatePropertyRef(filter.value)) {
      resolved.push(filter);
      continue;
    }
    const ids =
      relationValuesByPropertyId.get(filter.value.templatePropertyRef) ?? [];
    for (const id of ids) {
      resolved.push({ propertyId: filter.propertyId, op: filter.op, value: id });
    }
  }

  return { ...config, filters: resolved };
}
