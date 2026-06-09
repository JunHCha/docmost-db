import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DatabaseViewRepo } from '@docmost/db/repos/database/database-view.repo';

@Injectable()
export class OrphanViewCleanupService {
  private readonly logger = new Logger(OrphanViewCleanupService.name);
  // Grace window before a soft-deleted embed view is hard-deleted. More
  // conservative than trash (30d) since these hold user-authored view config
  // that an undo within the window must be able to restore.
  private readonly GRACE_DAYS = 7;

  constructor(private readonly viewRepo: DatabaseViewRepo) {}

  @Interval('orphan-view-cleanup', 24 * 60 * 60 * 1000) // every 24 hours
  async cleanupOrphanedViews(): Promise<void> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.GRACE_DAYS);
      const deleted = await this.viewRepo.hardDeleteOrphanedBefore(cutoff);
      this.logger.debug(
        deleted > 0
          ? `Orphan view cleanup removed ${deleted} views`
          : 'No orphaned views past grace window',
      );
    } catch (error) {
      this.logger.error(
        'Orphan view cleanup job failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
