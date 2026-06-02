import { Module } from '@nestjs/common';
import { DatabaseController } from './database.controller';
import { DatabaseService } from './services/database.service';
import { PageModule } from '../page/page.module';

// Core feature module for the Notion-like database. Named `DatabasesModule`
// (plural) to avoid colliding with the global Kysely `DatabaseModule`.
@Module({
  controllers: [DatabaseController],
  providers: [DatabaseService],
  imports: [PageModule],
})
export class DatabasesModule {}
