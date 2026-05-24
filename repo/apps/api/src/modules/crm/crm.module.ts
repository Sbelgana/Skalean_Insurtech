/**
 * CRMModule -- Sprint 8 Tache 8.1+ (Phase 3 Sprint 1).
 *
 * Modules CRM (Sprint 8 ongoing) :
 *   - 8.1 Companies (livre)
 *   - 8.2 Contacts (livre)
 *   - 8.3 Pipelines + Stages (livre)
 *   - 8.4 Deals + State Machine (livre)
 *   - 8.5 Interactions polymorphic + Timeline (livre)
 *   - 8.6 FTS pg_trgm cross-entity search (livre)
 *   - 8.7 Custom Fields JSONB + Zod runtime + LRU cache (livre -- infrastructure only ;
 *         hooks integration dans 4 services deferred Task 8.14)
 *
 * Reference : B-08 Tache 3.1.1 + 3.1.2 + 3.1.3 + 3.1.4 + 3.1.5 + 3.1.6 + 3.1.7.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { CompaniesController } from './controllers/companies.controller.js';
import { ContactsController } from './controllers/contacts.controller.js';
import { CrmSearchController } from './controllers/crm-search.controller.js';
import { CustomFieldsController } from './controllers/custom-fields.controller.js';
import { DealsController } from './controllers/deals.controller.js';
import {
  InteractionsController,
  InteractionsTimelineController,
} from './controllers/interactions.controller.js';
import { PipelinesController } from './controllers/pipelines.controller.js';
import { StagesController } from './controllers/stages.controller.js';
import { CompaniesService } from './services/companies.service.js';
import { ContactsService } from './services/contacts.service.js';
import { CrmSearchService } from './services/crm-search.service.js';
import { CustomFieldsDefinitionService } from './services/custom-fields-definition.service.js';
import { CustomFieldsValidatorService } from './services/custom-fields-validator.service.js';
import { DealsService } from './services/deals.service.js';
import { InteractionsService } from './services/interactions.service.js';
import { PipelinesService } from './services/pipelines.service.js';
import { StagesService } from './services/stages.service.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [
    CompaniesController,
    ContactsController,
    PipelinesController,
    StagesController,
    DealsController,
    InteractionsController,
    InteractionsTimelineController,
    CrmSearchController,
    CustomFieldsController,
  ],
  providers: [
    CompaniesService,
    ContactsService,
    PipelinesService,
    StagesService,
    DealsService,
    InteractionsService,
    CrmSearchService,
    CustomFieldsDefinitionService,
    CustomFieldsValidatorService,
  ],
  exports: [
    CompaniesService,
    ContactsService,
    PipelinesService,
    StagesService,
    DealsService,
    InteractionsService,
    CrmSearchService,
    CustomFieldsDefinitionService,
    CustomFieldsValidatorService,
  ],
})
export class CRMModule {}
