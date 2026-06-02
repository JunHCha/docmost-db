import { Module } from '@nestjs/common';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './services/database.service';
import { DatabasePropertyController } from './database-property.controller';
import { DatabasePropertyService } from './services/database-property.service';
import { DatabaseRowController } from './database-row.controller';
import { DatabaseRowService } from './services/database-row.service';
import { PageModule } from '../page/page.module';

// Core feature module for the Notion-like database. Named `DatabasesModule`
// (plural) to avoid colliding with the global Kysely `DatabaseModule`.
@Module({
  controllers: [
    DatabaseController,
    DatabasePropertyController,
    DatabaseRowController,
  ],
  providers: [DatabaseService, DatabasePropertyService, DatabaseRowService],
  imports: [PageModule],
})
export class DatabasesModule {}
