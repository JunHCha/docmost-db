import { forwardRef, Module } from '@nestjs/common';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './services/database.service';
import { DatabasePropertyController } from './database-property.controller';
import { DatabasePropertyService } from './services/database-property.service';
import { DatabaseRowController } from './database-row.controller';
import { DatabaseRowService } from './services/database-row.service';
import { DatabaseViewController } from './database-view.controller';
import { DatabaseViewService } from './services/database-view.service';
import { OrphanViewCleanupService } from './services/orphan-view-cleanup.service';
import { PageModule } from '../page/page.module';

// Core feature module for the Notion-like database. Named `DatabasesModule`
// (plural) to avoid colliding with the global Kysely `DatabaseModule`.
@Module({
  controllers: [
    DatabaseController,
    DatabasePropertyController,
    DatabaseRowController,
    DatabaseViewController,
  ],
  providers: [
    DatabaseService,
    DatabasePropertyService,
    DatabaseRowService,
    DatabaseViewService,
    OrphanViewCleanupService,
  ],
  // forwardRef breaks the module cycle with CollaborationModule (#73); see the
  // note in collaboration.module.ts.
  imports: [forwardRef(() => PageModule)],
  exports: [DatabaseViewService],
})
export class DatabasesModule {}
