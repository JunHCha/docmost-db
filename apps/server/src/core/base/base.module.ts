import { Module, forwardRef } from '@nestjs/common';
import { PageModule } from '../page/page.module';
import { BaseController } from './controllers/base.controller';
import { BasePropertyController } from './controllers/base-property.controller';
import { BaseRowController } from './controllers/base-row.controller';
import { BaseViewController } from './controllers/base-view.controller';
import { BaseTemplateController } from './controllers/base-template.controller';
import { BaseService } from './services/base.service';
import { BasePropertyService } from './services/base-property.service';
import { BaseRowService } from './services/base-row.service';
import { BaseViewService } from './services/base-view.service';
import { BaseTemplateService } from './services/base-template.service';
import { BaseRelationService } from './services/base-relation.service';
import { BaseFormulaService } from './services/base-formula.service';
import { OrphanViewCleanupService } from './services/orphan-view-cleanup.service';
import { BaseWsService } from './realtime/base-ws.service';

@Module({
  imports: [forwardRef(() => PageModule)],
  controllers: [
    BaseController,
    BasePropertyController,
    BaseRowController,
    BaseViewController,
    BaseTemplateController,
  ],
  providers: [
    BaseService,
    BasePropertyService,
    BaseRowService,
    BaseViewService,
    BaseTemplateService,
    BaseRelationService,
    BaseFormulaService,
    OrphanViewCleanupService,
    BaseWsService,
  ],
  exports: [BaseService, BaseViewService, BaseWsService],
})
export class BaseModule {}
