import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BaseViewRepo } from '@docmost/db/repos/base/base-view.repo';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const GRACE_DAYS = 7;

// Embed views soft-deleted by reconcile stay recoverable (undo) for the
// grace period, then get hard-deleted here.
@Injectable()
export class OrphanViewCleanupService {
  private readonly logger = new Logger(OrphanViewCleanupService.name);

  constructor(private readonly baseViewRepo: BaseViewRepo) {}

  @Interval(CLEANUP_INTERVAL_MS)
  async cleanup(): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - GRACE_DAYS * 24 * 60 * 60 * 1000);
      const deleted = await this.baseViewRepo.hardDeleteOrphanedBefore(cutoff);
      if (deleted > 0) {
        this.logger.log(`hard-deleted ${deleted} orphaned embed views`);
      }
    } catch (err) {
      this.logger.warn(`orphan view cleanup failed: ${(err as any)?.message}`);
    }
  }
}
