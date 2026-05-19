/**
 * AppModule -- module racine NestJS de Skalean InsurTech v2.2 API.
 *
 * Au Sprint 3 Tache 1.3.1 : skeleton minimal (AppController + AppService).
 * Au Sprint 3 Tache 1.3.2 : ajoute ConfigModule (Zod env loader), DatabaseModule
 *   (TypeORM AppDataSource), RedisModule, KafkaModule.
 * Au Sprint 3 Tache 1.3.5 : ajoute LoggerModule (nestjs-pino).
 * Au Sprint 5 Tache 1.5.x : ajoute AuthModule (Argon2id + JWT + MFA).
 * Au Sprint 6 Tache 1.6.x : ajoute TenantModule (RLS + multi-tenant).
 * Au Sprint 7 Tache 1.7.x : ajoute RBACModule (12 roles).
 * Au Sprint 8+ : ajoute CRMModule, BookingModule, CommModule, etc.
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (skeleton).
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Tache 1.3.2 : ConfigModule.forRoot({ load: [envSchema] })
    // Tache 1.3.3 : DatabaseModule (TypeORM AppDataSource Sprint 2)
    // Tache 1.3.4 : RedisModule + KafkaModule
    // Tache 1.3.5 : LoggerModule (nestjs-pino)
    // Sprint 5 : AuthModule
    // Sprint 6 : TenantModule + RLSModule
    // Sprint 7 : RBACModule
    // Sprint 8+ : 19 modules metier
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
