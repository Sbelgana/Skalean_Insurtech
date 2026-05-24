/**
 * CRMModule -- Sprint 8 Tache 8.1+ (Phase 3 Sprint 1).
 *
 * Modules CRM (Sprint 8 ongoing) :
 *   - 8.1 Companies (livre Tache 8.1)
 *   - 8.2 Contacts (livre Tache 8.2)
 *   - 8.3 Pipelines + Stages (livre Tache 8.3)
 *   - 8.4 Deals + State Machine (livre Tache 8.4)
 *   - 8.5 Interactions
 *   - 8.6 Full-Text Search pg_trgm
 *   - 8.7 Custom Fields JSONB + Zod runtime
 *
 * Reference : B-08 Tache 3.1.1 + 3.1.2 + 3.1.3 + 3.1.4.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../../database/database.module.js';
import { CompaniesController } from './controllers/companies.controller.js';
import { ContactsController } from './controllers/contacts.controller.js';
import { DealsController } from './controllers/deals.controller.js';
import { PipelinesController } from './controllers/pipelines.controller.js';
import { StagesController } from './controllers/stages.controller.js';
import { CompaniesService } from './services/companies.service.js';
import { ContactsService } from './services/contacts.service.js';
import { DealsService } from './services/deals.service.js';
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
  ],
  providers: [
    CompaniesService,
    ContactsService,
    PipelinesService,
    StagesService,
    DealsService,
  ],
  exports: [
    CompaniesService,
    ContactsService,
    PipelinesService,
    StagesService,
    DealsService,
  ],
})
export class CRMModule {}
