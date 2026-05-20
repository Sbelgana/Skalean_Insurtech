/**
 * AppModule -- module racine NestJS de Skalean InsurTech v2.2 API.
 *
 * Sprint 3 Tache 1.3.2 : enrichi avec ConfigModule (Zod env loader),
 * DatabaseModule (TypeORM AppDataSource Sprint 2 Tache 1.2.3),
 * RedisModule (ioredis),
 * KafkaModule (kafkajs),
 * et 19 modules metier stubs places dans modules/.
 *
 * Sprint 3 Tache 1.3.3 : LoggerModule Pino ajoute en PREMIER import
 * (logger disponible pour tous les modules suivants).
 *
 * Convention ordre imports :
 *   1. LoggerModule (Pino -- PREMIER pour couvrir tous les logs de boot).
 *   2. Modules transverses globaux (Config, Database, Redis, Kafka).
 *   3. Modules metier stubs (alphabetique).
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji) +
 *             decision-009 (Zod uniforme).
 * Tache : 1.3.2 + 1.3.3 (Sprint 3 / Phase 1).
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// === Logger global (PREMIER -- couvre tous les logs de boot) ===
import { LoggerModule } from './logger/logger.module';

// === Modules transverses globaux ===
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { KafkaModule } from './kafka/kafka.module';

// === Modules metier stubs (Sprint 5 a 31 enrichissent) ===
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AssureModule } from './modules/assure/assure.module';
import { AuthModule } from './modules/auth/auth.module';
import { BookingModule } from './modules/booking/booking.module';
import { BooksModule } from './modules/books/books.module';
import { CommModule } from './modules/comm/comm.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { CRMModule } from './modules/crm/crm.module';
import { DocsModule } from './modules/docs/docs.module';
import { InsureModule } from './modules/insure/insure.module';
import { MCPModule } from './modules/mcp/mcp.module';
import { PayModule } from './modules/pay/pay.module';
import { ProspectModule } from './modules/prospect/prospect.module';
import { RBACModule } from './modules/rbac/rbac.module';
import { RepairModule } from './modules/repair/repair.module';
import { SignatureModule } from './modules/signature/signature.module';
import { SkaleanAIModule } from './modules/skalean-ai/skalean-ai.module';
import { TenantModule } from './modules/tenant/tenant.module';

@Module({
  imports: [
    // === Logger global PREMIER (Pino -- couvre logs de boot des modules suivants) ===
    LoggerModule.forRoot(),

    // === Transverses globaux (ordre : Config -> Database -> Redis -> Kafka) ===
    ConfigModule.forRoot(),
    DatabaseModule,
    RedisModule,
    KafkaModule,

    // === Metier stubs (alphabetique) ===
    AdminModule,
    AnalyticsModule,
    AssureModule,
    AuthModule,
    BookingModule,
    BooksModule,
    CommModule,
    ComplianceModule,
    CRMModule,
    DocsModule,
    InsureModule,
    MCPModule,
    PayModule,
    ProspectModule,
    RBACModule,
    RepairModule,
    SignatureModule,
    SkaleanAIModule,
    TenantModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
