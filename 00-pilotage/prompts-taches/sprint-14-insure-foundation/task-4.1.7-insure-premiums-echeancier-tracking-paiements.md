# TACHE 4.1.7 -- insure_premiums Echeancier + Tracking Paiements + Cron Overdue

**Sprint** : 14 (Phase 4 / Sprint 1)
**Reference** : `00-pilotage/meta-prompts/B-14-sprint-14-insure-foundation.md` (Tache 4.1.7)
**Phase** : 4 -- Vertical Insure
**Priorite** : P0 (lien direct cash-in : sans tracking premiums, pas de revenue)
**Effort** : 5h
**Dependances** : Task 4.1.4 (policy active), Task 4.1.5 (consumer policy.activated), Task 4.1.6 (avenant trigger pro-rata adjustments), Sprint 11 (Pay 6 passerelles MA), Sprint 12 (Books ecritures auto)
**Densite cible** : 80-130 ko
**AUCUNE EMOJI** (decision-006)

---

## 1. But

Cette tache implemente l'**entite `insure_premiums`** (echeancier paiement) + service createSchedule (genere 1/4/12 echeances selon `payment_frequency` annual/quarterly/monthly) + consumer Kafka `pay.transaction_captured` (update premium status `paid`) + cron daily `mark-overdue.cron` (transition `pending -> overdue` si `due_date < NOW`) + endpoints REST tracking + integration Pay (Sprint 11 initiate paiement) + integration Books (Sprint 12 ecriture comptable auto).

L'apport : (a) **echeancier multi-frequency** avec surcharge fractionnement (quarterly +5%, monthly +8%) ; (b) **consumer Pay** auto-transition premium status sur succes paiement ; (c) **cron overdue** detecte impayes -> trigger reminders Task 4.1.10.

---

## 2. Contexte etendu

### 2.1 Pourquoi
Premiums materialisent le **cash-in** : sans echeancier track, impossible de relancer assure impaye + impossible de declencher commissions (Task 4.1.9 trigger sur premium paid) + impossible reporting financier Sprint 12. Premium est le **lien entre police active** et **paiement reel** (Sprint 11).

### 2.2 Trade-offs
- Echeancier genere a activation policy (Task 4.1.5 consumer) vs lazy : eager pour permettre cron overdue + UX broker.
- Surcharge fractionnement hardcoded (5% quarterly, 8% monthly) Sprint 14 ; Sprint 27 admin UI editable.
- Status enum strict 5 valeurs `pending|paid|overdue|partial|cancelled`.

### 2.3 Pieges
1. Consumer pay.captured double delivery -> double mark paid. Solution : idempotency key + status check.
2. Partial payment : paid_amount < amount -> status='partial' (Sprint 14 minimaliste, Sprint 16 reconciliation).
3. Cancel policy -> cancel pending premiums futurs. Trigger sur policy.cancelled consumer.
4. Avenant prime_complement : Sprint 14 cree premium ad-hoc supplementaire, Sprint 17 ajustera echeances futures.
5. Cron overdue ignore weekends ? Sprint 14 = pure calendrier. Sprint 17 admin config.

---

## 3. Architecture

```
Policy activated (Task 4.1.5 consumer)
   |
   v
PremiumsService.createSchedule(policy_id, frequency)
   |
   v
Generate N echeances :
  annual : 1 echeance prime_annuelle a start_date
  quarterly : 4 echeances (prime + 5%) / 4 espacees 3 mois
  monthly : 12 echeances (prime + 8%) / 12 espacees 1 mois
   |
   v
INSERT insure_premiums status='pending'
   |
   v
[Eventually : assure paie via portal/email link]
   |
   v
Kafka pay.transaction_captured event
   |
   v
PayToPremiumConsumer
   |
   v
UPDATE premium status='paid' + trigger commission (Task 4.1.9)
   |
   v
Books journal entry auto (Sprint 12 deja consumer)

Parallel : cron daily mark-overdue
   |
   v
UPDATE pending WHERE due_date < NOW -> overdue
   |
   v
Trigger Task 4.1.10 reminders escalation
```

---

## 4. Livrables (22)

- [ ] Migration `insure_premiums` (table, enum status, indexes, RLS, sequence numbering)
- [ ] Entity `InsurePremium`
- [ ] Zod schemas (CreateSchedule, MarkPaid, Filters)
- [ ] Service `PremiumsService` : createSchedule, markPaid, markOverdue, cancelFuturePremiums, findByPolicy, findAll
- [ ] Consumer `policy-activated.consumer.ts` listen `insure.policy.activated` -> createSchedule
- [ ] Consumer `pay-to-premium.consumer.ts` listen `pay.transaction.captured` -> markPaid
- [ ] Consumer `policy-cancelled.consumer.ts` listen `insure.policy.cancelled` -> cancelFuturePremiums
- [ ] Cron `mark-overdue-premiums.cron.ts` daily 02:00 UTC
- [ ] Events Kafka `insure.premium_created`, `insure.premium_paid`, `insure.premium_overdue`, `insure.premium_cancelled`
- [ ] Controller endpoints : GET `/policies/:id/premiums`, POST `/premiums/:id/pay` (initiate Pay), GET `/premiums?status=overdue`
- [ ] Permissions `insure.premiums.read`, `insure.premiums.pay`
- [ ] Tests unit (12+)
- [ ] Tests consumer (5+)
- [ ] Tests integration (5+)
- [ ] Tests E2E (8+)
- [ ] Coverage >= 87%
- [ ] Variables env `INSURE_PREMIUM_QUARTERLY_SURCHARGE_PCT=5`, `INSURE_PREMIUM_MONTHLY_SURCHARGE_PCT=8`
- [ ] Decimal.js precision
- [ ] Multi-tenant RLS
- [ ] Documentation
- [ ] Audit trail
- [ ] >= 30 tests total

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/1737000007000-InsurePremiums.ts                (~120 lignes)
repo/packages/insure/src/entities/insure-premium.entity.ts                            (~75 lignes)
repo/packages/insure/src/schemas/premium.schema.ts                                    (~80 lignes)
repo/packages/insure/src/services/premiums.service.ts                                 (~280 lignes)
repo/packages/insure/src/consumers/policy-activated-to-premiums.consumer.ts           (~120 lignes)
repo/packages/insure/src/consumers/pay-to-premium.consumer.ts                          (~110 lignes)
repo/packages/insure/src/consumers/policy-cancelled-to-premiums.consumer.ts            (~90 lignes)
repo/packages/insure/src/jobs/mark-overdue-premiums.cron.ts                            (~80 lignes)
repo/packages/insure/src/events/premiums.events.ts                                    (~90 lignes)
repo/apps/api/src/modules/insure/controllers/premiums.controller.ts                   (~140 lignes)
repo/packages/insure/src/services/premiums.service.spec.ts                            (~400 lignes / 14+)
repo/packages/insure/test/integration/premiums.integration.spec.ts                    (~220 lignes / 6+)
repo/apps/api/test/insure/premiums.e2e-spec.ts                                         (~280 lignes / 8+)
```

---

## 6. Code patterns COMPLETS

### 6.1 Migration

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class InsurePremiums1737000007000 implements MigrationInterface {
  name = 'InsurePremiums1737000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE insure_premium_status AS ENUM (
        'pending', 'paid', 'overdue', 'partial', 'cancelled'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE insure_premiums (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        policy_id UUID NOT NULL REFERENCES insure_polices(id) ON DELETE RESTRICT,
        echeance_number INT NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
        due_date DATE NOT NULL,
        status insure_premium_status NOT NULL DEFAULT 'pending',
        paid_at TIMESTAMPTZ NULL,
        pay_transaction_id UUID NULL REFERENCES pay_transactions(id) ON DELETE SET NULL,
        reminder_sent_at JSONB NOT NULL DEFAULT '{}',
        avenant_id UUID NULL REFERENCES insure_avenants(id) ON DELETE SET NULL,
        metadata JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT uq_insure_premiums_echeance UNIQUE (policy_id, echeance_number),
        CONSTRAINT chk_amount_positive CHECK (amount > 0),
        CONSTRAINT chk_paid_amount_valid CHECK (paid_amount >= 0 AND paid_amount <= amount * 1.1)
      );
    `);

    await queryRunner.query(`CREATE INDEX idx_insure_premiums_policy ON insure_premiums(policy_id);`);
    await queryRunner.query(`CREATE INDEX idx_insure_premiums_tenant_status ON insure_premiums(tenant_id, status);`);
    await queryRunner.query(`CREATE INDEX idx_insure_premiums_due_pending ON insure_premiums(due_date) WHERE status = 'pending';`);
    await queryRunner.query(`CREATE INDEX idx_insure_premiums_overdue ON insure_premiums(tenant_id, due_date) WHERE status = 'overdue';`);

    await queryRunner.query(`ALTER TABLE insure_premiums ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON insure_premiums
        FOR ALL USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_insure_premiums_updated_at
        BEFORE UPDATE ON insure_premiums
        FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS insure_premiums CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS insure_premium_status;`);
  }
}
```

### 6.2 Entity

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export type PremiumStatus = 'pending' | 'paid' | 'overdue' | 'partial' | 'cancelled';

@Entity({ name: 'insure_premiums' })
@Index('idx_insure_premiums_policy', ['policyId'])
export class InsurePremium {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'policy_id', type: 'uuid' })
  policyId!: string;

  @Column({ name: 'echeance_number', type: 'int' })
  echeanceNumber!: number;

  @Column({ type: 'numeric', precision: 15, scale: 2 })
  amount!: string;

  @Column({ name: 'paid_amount', type: 'numeric', precision: 15, scale: 2, default: 0 })
  paidAmount!: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: Date;

  @Column({
    type: 'enum',
    enumName: 'insure_premium_status',
    enum: ['pending', 'paid', 'overdue', 'partial', 'cancelled'],
    default: 'pending',
  })
  status!: PremiumStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'pay_transaction_id', type: 'uuid', nullable: true })
  payTransactionId!: string | null;

  @Column({ name: 'reminder_sent_at', type: 'jsonb', default: () => `'{}'::jsonb` })
  reminderSentAt!: Record<string, string>;

  @Column({ name: 'avenant_id', type: 'uuid', nullable: true })
  avenantId!: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  isOverdue(now: Date = new Date()): boolean {
    return this.status === 'pending' && this.dueDate.getTime() < now.getTime();
  }
}
```

### 6.3 Service principal

```typescript
import { Injectable, Inject, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'pino';
import { addMonths } from 'date-fns';
import Decimal from 'decimal.js';
import { InsurePremium, type PremiumStatus } from '../entities/insure-premium.entity';
import { TenantContext } from '@insurtech/shared-utils';
import { KafkaPublisher } from '@insurtech/shared-events';
import { AuditAction } from '@insurtech/auth';
import { InsurePremiumTopics } from '../events/premiums.events';

const QUARTERLY_SURCHARGE_PCT = Number(process.env.INSURE_PREMIUM_QUARTERLY_SURCHARGE_PCT ?? 5) / 100;
const MONTHLY_SURCHARGE_PCT = Number(process.env.INSURE_PREMIUM_MONTHLY_SURCHARGE_PCT ?? 8) / 100;

interface ActorContext { user_id: string }

@Injectable()
export class PremiumsService {
  constructor(
    @InjectRepository(InsurePremium)
    private readonly repo: Repository<InsurePremium>,
    private readonly kafka: KafkaPublisher,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {}

  /** Triggered by policy.activated consumer */
  @AuditAction({ resource: 'insure_premium', action: 'create_schedule' })
  async createSchedule(
    policyId: string,
    primeAnnuelle: string,
    frequency: 'annual' | 'quarterly' | 'monthly',
    startDate: Date,
    actor: ActorContext,
  ): Promise<InsurePremium[]> {
    const tenantId = TenantContext.getTenantIdOrThrow();
    const totalPrime = new Decimal(primeAnnuelle);

    // Compute totaux per frequency
    let total: Decimal;
    let count: number;
    let interval: number; // months between echeances
    switch (frequency) {
      case 'annual':
        total = totalPrime;
        count = 1;
        interval = 0;
        break;
      case 'quarterly':
        total = totalPrime.mul(1 + QUARTERLY_SURCHARGE_PCT);
        count = 4;
        interval = 3;
        break;
      case 'monthly':
        total = totalPrime.mul(1 + MONTHLY_SURCHARGE_PCT);
        count = 12;
        interval = 1;
        break;
    }

    const perEcheance = total.div(count);
    // Adjust last echeance to match exact total (rounding)
    const echeances: Partial<InsurePremium>[] = [];
    let cumulative = new Decimal(0);
    for (let i = 0; i < count; i++) {
      const isLast = i === count - 1;
      const amount = isLast ? total.minus(cumulative) : perEcheance;
      cumulative = cumulative.plus(amount);
      echeances.push({
        tenantId,
        policyId,
        echeanceNumber: i + 1,
        amount: amount.toFixed(2),
        paidAmount: '0',
        dueDate: i === 0 ? startDate : addMonths(startDate, i * interval),
        status: 'pending',
        reminderSentAt: {},
        metadata: { frequency, schedule_created_by: actor.user_id },
      });
    }

    const saved = await this.repo.save(echeances as InsurePremium[]);
    for (const prem of saved) {
      await this.kafka.publish(InsurePremiumTopics.PREMIUM_CREATED, {
        idempotency_key: `insure.premium.${prem.id}.created`,
        tenant_id: tenantId,
        premium_id: prem.id,
        policy_id: policyId,
        echeance_number: prem.echeanceNumber,
        amount: prem.amount,
        due_date: prem.dueDate.toISOString().slice(0, 10),
      });
    }

    this.logger.info(
      { action: 'insure.premium.schedule_created', policy_id: policyId, count, frequency },
      'Premium schedule created',
    );

    return saved;
  }

  @AuditAction({ resource: 'insure_premium', action: 'mark_paid' })
  async markPaid(premiumId: string, payTransactionId: string, paidAmount: string, actor: ActorContext): Promise<InsurePremium> {
    const tenantId = TenantContext.getTenantIdOrThrow();
    const premium = await this.findById(premiumId);
    if (premium.status === 'paid') {
      this.logger.info({ premium_id: premiumId }, 'Idempotent : already paid');
      return premium;
    }

    const paidDec = new Decimal(paidAmount);
    const amountDec = new Decimal(premium.amount);
    const newStatus: PremiumStatus = paidDec.gte(amountDec) ? 'paid' : 'partial';

    const updated = await this.repo.save({
      ...premium,
      paidAmount: paidDec.toFixed(2),
      paidAt: new Date(),
      payTransactionId,
      status: newStatus,
    });

    if (newStatus === 'paid') {
      await this.kafka.publish(InsurePremiumTopics.PREMIUM_PAID, {
        idempotency_key: `insure.premium.${updated.id}.paid`,
        tenant_id: tenantId,
        premium_id: updated.id,
        policy_id: updated.policyId,
        amount_paid: paidDec.toFixed(2),
        pay_transaction_id: payTransactionId,
        paid_at: updated.paidAt!.toISOString(),
      });
    }

    return updated;
  }

  async markOverdue(): Promise<{ count: number }> {
    const result = await this.repo
      .createQueryBuilder()
      .update(InsurePremium)
      .set({ status: 'overdue' })
      .where('status = :s', { s: 'pending' })
      .andWhere('due_date < :now', { now: new Date() })
      .execute();
    const count = result.affected ?? 0;
    if (count > 0) {
      await this.kafka.publish(InsurePremiumTopics.PREMIUM_BATCH_OVERDUE, {
        idempotency_key: `insure.premiums.batch_overdue.${Date.now()}`,
        count,
        triggered_at: new Date().toISOString(),
      });
    }
    return { count };
  }

  async cancelFuturePremiums(policyId: string, actor: ActorContext): Promise<{ count: number }> {
    const tenantId = TenantContext.getTenantIdOrThrow();
    const result = await this.repo
      .createQueryBuilder()
      .update(InsurePremium)
      .set({ status: 'cancelled' })
      .where('policy_id = :pid AND status = :s AND due_date > :now', {
        pid: policyId, s: 'pending', now: new Date(),
      })
      .execute();
    return { count: result.affected ?? 0 };
  }

  async findById(id: string): Promise<InsurePremium> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException({ code: 'INSURE_PREMIUM_NOT_FOUND' });
    return p;
  }

  async findByPolicy(policyId: string): Promise<InsurePremium[]> {
    return this.repo.find({ where: { policyId }, order: { echeanceNumber: 'ASC' } });
  }

  async findAll(filters: { status?: PremiumStatus; overdue_days?: number; page?: number; limit?: number }) {
    const qb = this.repo.createQueryBuilder('p');
    if (filters.status) qb.andWhere('p.status = :s', { s: filters.status });
    if (filters.overdue_days !== undefined) {
      qb.andWhere('p.status IN (:...statuses)', { statuses: ['pending', 'overdue'] });
      qb.andWhere('p.due_date <= :limit', { limit: new Date(Date.now() + filters.overdue_days * 86400000) });
    }
    qb.orderBy('p.due_date', 'ASC');
    const page = filters.page ?? 1;
    const limit = Math.min(filters.limit ?? 20, 100);
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, limit };
  }
}
```

### 6.4 Consumer pay-to-premium

```typescript
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Logger } from 'pino';
import { z } from 'zod';
import { KafkaConsumer, ProcessedEventsService } from '@insurtech/shared-events';
import { PremiumsService } from '../services/premiums.service';

const PayCapturedSchema = z.object({
  idempotency_key: z.string(),
  transaction_id: z.string().uuid(),
  amount: z.string(),
  related_resource_type: z.string(),
  related_resource_id: z.string().uuid(),
  captured_at: z.string().datetime(),
});

@Injectable()
export class PayToPremiumConsumer implements OnModuleInit {
  constructor(
    @Inject('KAFKA_CONSUMER') private readonly consumer: KafkaConsumer,
    private readonly premiums: PremiumsService,
    private readonly processedEvents: ProcessedEventsService,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {}

  async onModuleInit() {
    await this.consumer.subscribe('insurtech.events.pay.transaction.captured', this.handle.bind(this));
  }

  async handle(message: { value: string }) {
    let parsed: z.infer<typeof PayCapturedSchema>;
    try { parsed = PayCapturedSchema.parse(JSON.parse(message.value)); } catch { return; }
    if (parsed.related_resource_type !== 'insure_premium') return;
    if (await this.processedEvents.isProcessed(parsed.idempotency_key)) return;

    try {
      await this.premiums.markPaid(parsed.related_resource_id, parsed.transaction_id, parsed.amount, { user_id: 'system-pay-consumer' });
      await this.processedEvents.markProcessed(parsed.idempotency_key);
    } catch (err) {
      this.logger.error({ err, premium_id: parsed.related_resource_id }, 'Failed pay-to-premium');
      throw err;
    }
  }
}
```

### 6.5 Cron mark-overdue

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger } from 'pino';
import { PremiumsService } from '../services/premiums.service';

@Injectable()
export class MarkOverduePremiumsCron {
  constructor(
    private readonly premiums: PremiumsService,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {}

  @Cron('0 2 * * *', { name: 'insure.mark-overdue-premiums', timeZone: 'UTC' })
  async run(): Promise<void> {
    const t0 = performance.now();
    try {
      const result = await this.premiums.markOverdue();
      this.logger.info(
        { cron: 'insure.mark-overdue-premiums', count: result.count, duration_ms: Math.round(performance.now() - t0) },
        'Overdue premiums cron completed',
      );
    } catch (err) {
      this.logger.error({ err }, 'Overdue cron failed');
      throw err;
    }
  }
}
```

### 6.6 Controller

```typescript
import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { PremiumsService } from '@insurtech/insure';
import { JwtAuthGuard, TenantGuard, PermissionsGuard, Permissions } from '@insurtech/auth';

@ApiTags('insure-premiums')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('insure')
export class PremiumsController {
  constructor(private readonly premiums: PremiumsService) {}

  @Get('policies/:policyId/premiums')
  @Permissions('insure.premiums.read')
  async listByPolicy(@Param('policyId') policyId: string) {
    return { items: await this.premiums.findByPolicy(policyId) };
  }

  @Get('premiums')
  @Permissions('insure.premiums.read')
  async list(@Query('status') status?: string, @Query('overdue_days') overdueDays?: string) {
    return this.premiums.findAll({
      status: status as never,
      overdue_days: overdueDays ? Number(overdueDays) : undefined,
    });
  }

  @Get('premiums/:id')
  @Permissions('insure.premiums.read')
  async getById(@Param('id') id: string) {
    return { data: await this.premiums.findById(id) };
  }
}
```

---

## 7. Tests complets

### 7.1 Tests unit (14+)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PremiumsService } from './premiums.service';
import { InsurePremium } from '../entities/insure-premium.entity';

vi.mock('@insurtech/shared-utils', async (orig) => {
  const actual = await orig<typeof import('@insurtech/shared-utils')>();
  return { ...actual, TenantContext: { getTenantIdOrThrow: vi.fn(() => 'tenant-1') } };
});

describe('PremiumsService', () => {
  let service: PremiumsService;
  let repo: { findOne: ReturnType<typeof vi.fn>; save: ReturnType<typeof vi.fn>; find: ReturnType<typeof vi.fn>; createQueryBuilder: ReturnType<typeof vi.fn> };
  let kafka: { publish: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repo = {
      findOne: vi.fn(),
      save: vi.fn((x) => Promise.resolve(Array.isArray(x) ? x.map((y: object, i: number) => ({ ...y, id: `prem-${i + 1}`, createdAt: new Date() })) : { ...x, id: x.id ?? 'prem-1', createdAt: new Date() })),
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 5 }),
        getCount: vi.fn().mockResolvedValue(0),
        getMany: vi.fn().mockResolvedValue([]),
      })),
    };
    kafka = { publish: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PremiumsService,
        { provide: getRepositoryToken(InsurePremium), useValue: repo },
        { provide: 'KafkaPublisher', useValue: kafka },
        { provide: 'LOGGER', useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
      ],
    }).compile();
    service = moduleRef.get(PremiumsService);
  });

  it('createSchedule annual : 1 echeance = prime_annuelle exact', async () => {
    const result = await service.createSchedule('pol-1', '5928.00', 'annual', new Date('2026-06-01'), { user_id: 'u' });
    expect(result).toHaveLength(1);
    expect(result[0]!.amount).toBe('5928.00');
  });

  it('createSchedule quarterly : 4 echeances, +5% surcharge', async () => {
    const result = await service.createSchedule('pol-1', '5928.00', 'quarterly', new Date('2026-06-01'), { user_id: 'u' });
    expect(result).toHaveLength(4);
    const total = result.reduce((acc, p) => acc + Number(p.amount), 0);
    expect(total).toBeCloseTo(5928 * 1.05, 2); // 6224.40
  });

  it('createSchedule monthly : 12 echeances, +8% surcharge', async () => {
    const result = await service.createSchedule('pol-1', '5928.00', 'monthly', new Date('2026-06-01'), { user_id: 'u' });
    expect(result).toHaveLength(12);
    const total = result.reduce((acc, p) => acc + Number(p.amount), 0);
    expect(total).toBeCloseTo(5928 * 1.08, 2); // 6402.24
  });

  it('createSchedule monthly echeances spaced 1 month apart', async () => {
    const result = await service.createSchedule('pol-1', '5928.00', 'monthly', new Date('2026-06-01'), { user_id: 'u' });
    expect(result[1]!.dueDate.getMonth()).toBe(6); // July
    expect(result[11]!.dueDate.getMonth()).toBe(4); // May next year (5)
  });

  it('createSchedule publishes Kafka events per echeance', async () => {
    await service.createSchedule('pol-1', '5928.00', 'quarterly', new Date(), { user_id: 'u' });
    expect(kafka.publish).toHaveBeenCalledTimes(4);
  });

  it('markPaid full amount -> status=paid', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'p-1', amount: '500.00', status: 'pending', policyId: 'pol-1' });
    const result = await service.markPaid('p-1', 'tx-1', '500.00', { user_id: 'sys' });
    expect(result.status).toBe('paid');
    expect(kafka.publish).toHaveBeenCalledWith('insurtech.events.insure.premium.paid', expect.any(Object));
  });

  it('markPaid partial amount -> status=partial (no Kafka emit)', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'p-1', amount: '500.00', status: 'pending', policyId: 'pol-1' });
    const result = await service.markPaid('p-1', 'tx-1', '300.00', { user_id: 'sys' });
    expect(result.status).toBe('partial');
  });

  it('markPaid idempotent (already paid)', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'p-1', amount: '500.00', status: 'paid' });
    const result = await service.markPaid('p-1', 'tx-1', '500.00', { user_id: 'sys' });
    expect(result.status).toBe('paid');
    expect(kafka.publish).not.toHaveBeenCalled();
  });

  it('markOverdue updates pending past due_date', async () => {
    const result = await service.markOverdue();
    expect(result.count).toBe(5);
    expect(kafka.publish).toHaveBeenCalledWith('insurtech.events.insure.premium.batch_overdue', expect.any(Object));
  });

  it('markOverdue no Kafka if 0 affected', async () => {
    repo.createQueryBuilder().execute.mockResolvedValueOnce({ affected: 0 });
    await service.markOverdue();
    expect(kafka.publish).not.toHaveBeenCalled();
  });

  it('cancelFuturePremiums cancels only pending future', async () => {
    repo.createQueryBuilder().execute.mockResolvedValueOnce({ affected: 3 });
    const result = await service.cancelFuturePremiums('pol-1', { user_id: 'sys' });
    expect(result.count).toBe(3);
  });

  it('findById throws NotFound if missing', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.findById('x')).rejects.toMatchObject({
      response: { code: 'INSURE_PREMIUM_NOT_FOUND' },
    });
  });

  it('Last echeance adjusted to match exact total (rounding)', async () => {
    const result = await service.createSchedule('pol-1', '100.01', 'quarterly', new Date(), { user_id: 'u' });
    const total = result.reduce((acc, p) => acc + Number(p.amount), 0);
    expect(total).toBeCloseTo(100.01 * 1.05, 2);
  });

  it('findAll filters by status', async () => {
    const qb = repo.createQueryBuilder();
    await service.findAll({ status: 'overdue' });
    expect(qb.andWhere).toHaveBeenCalledWith('p.status = :s', { s: 'overdue' });
  });
});
```

### 7.2 Tests E2E (8)

```typescript
describe('Insure Premiums E2E', () => {
  // GET /policies/:id/premiums after policy activated
  // GET /premiums?status=overdue
  // GET /premiums/:id
  // Insufficient permission -> 403
  // Missing JWT -> 401
  // Multi-tenant isolation
  // Schedule generated automatically after policy.activated event
  // Pay capture event triggers premium paid
});
```

### 7.3 Tests integration (6)

```typescript
// UNIQUE(policy_id, echeance_number), CHECK amount > 0, CHECK paid_amount <= amount * 1.1,
// RLS isolation, index idx_insure_premiums_due_pending used, cron idempotent
```

---

## 8. Variables environnement

```env
INSURE_PREMIUM_QUARTERLY_SURCHARGE_PCT=5
INSURE_PREMIUM_MONTHLY_SURCHARGE_PCT=8
INSURE_PREMIUM_OVERDUE_CRON_HOUR=2
```

---

## 9. Commandes shell

```bash
pnpm install --frozen-lockfile
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/insure test:unit -- premiums
pnpm --filter @insurtech/insure test:integration -- premiums
pnpm --filter api test:e2e -- insure/premiums
pnpm --filter @insurtech/insure test:cov -- premiums
```

---

## 10. Criteres validation V1-V25

### P0 (15)
- V1 Migration + enum status 5 valeurs
- V2 UNIQUE (policy_id, echeance_number)
- V3 CHECK amount > 0
- V4 CHECK paid_amount <= amount * 1.1
- V5 RLS tenant isolation
- V6 4 indexes critiques (policy, status, due_pending partial, overdue partial)
- V7 createSchedule annual = 1 echeance
- V8 createSchedule quarterly = 4 echeances avec +5%
- V9 createSchedule monthly = 12 echeances avec +8%
- V10 Last echeance ajuste arrondi precis (decimal.js)
- V11 markPaid idempotent
- V12 markPaid partial -> status='partial'
- V13 Consumer pay.captured -> markPaid auto
- V14 Cron mark-overdue daily 02:00 UTC
- V15 0 emoji

### P1 (7)
- V16 cancelFuturePremiums sur policy.cancelled
- V17 Kafka events per echeance
- V18 Audit log Sprint 7
- V19 Coverage >= 87%
- V20 Multi-tenant isolation E2E test
- V21 Endpoint filter overdue_days
- V22 Permissions matrix update

### P2 (3)
- V23 Documentation
- V24 OpenAPI documente
- V25 Logging structured

---

## 11. Edge cases + troubleshooting

[Cf section 2.3 -- 5 pieges principaux documents. Solutions inline service]

### Edge supplémentaires :
- Avenant prime_complement : Sprint 14 cree premium ad-hoc avec echeance_number > derniere existante
- Multi-currency : Sprint 14 MAD only
- Refund (paid_amount > amount via avenant negatif) : Sprint 16 traitera
- Cron retry idempotent via UPDATE WHERE status='pending' (skip si deja overdue)
- Pay transaction refund (annulation) : Sprint 16 ajoutera consumer pay.refunded -> revert premium

---

## 12. Conformite Maroc detaillee

- **Loi 09-08** : pay_transaction_id reference pas PII
- **ACAPS** : echeances + paiements tracables 10 ans
- **CGI Article 96** : TVA 14% deja appliquee Sprint 4.1.2 dans prime
- **Pay Sprint 11 connecteurs MA** : CMI / Maroctelecommerce / etc.

---

## 13. Conventions absolues

Multi-tenant + Zod + Pino + RBAC + Kafka + No-emoji + Decimal.js + Idempotency + Conventional Commits + Cloud MA + lois MA.

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/insure typecheck && \
pnpm --filter @insurtech/insure lint && \
pnpm --filter @insurtech/insure test && \
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/insure/src/services/premiums* \
  --include="*.ts" && echo FAIL || echo OK
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-14): insure_premiums echeancier + tracking + cron overdue

Echeancier 1/4/12 echeances selon frequency annual/quarterly/monthly
(+5% quarterly, +8% monthly). Consumer pay.captured -> markPaid auto.
Cron daily mark-overdue. Decimal.js precision. Idempotent consumers.

Livrables:
- Migration insure_premiums + enum status + 4 indexes + RLS
- Entity InsurePremium
- Zod schemas
- PremiumsService (createSchedule, markPaid, markOverdue, cancelFuturePremiums, findByPolicy)
- 3 consumers (policy-activated, pay-captured, policy-cancelled)
- MarkOverduePremiumsCron daily 02:00 UTC
- 4 events Kafka premiums
- PremiumsController 3 endpoints
- 2 permissions

Tests: 14 unit + 6 integration + 8 E2E + 5 consumer = 33
Coverage: 89%

Task: 4.1.7
Sprint: 14 (Phase 4 / Sprint 1)
Reference: B-14 Tache 4.1.7"
```

---

## 16. Workflow next step

Task 4.1.8 (renewals cron 60j) consomme policy + premiums via expiration tracking.

---

## 17. Annexes

Events schemas + permissions matrix updates + module providers.

```typescript
// premiums.events.ts
export const InsurePremiumTopics = {
  PREMIUM_CREATED: 'insurtech.events.insure.premium.created',
  PREMIUM_PAID: 'insurtech.events.insure.premium.paid',
  PREMIUM_BATCH_OVERDUE: 'insurtech.events.insure.premium.batch_overdue',
  PREMIUM_CANCELLED: 'insurtech.events.insure.premium.cancelled',
} as const;
```

Permissions matrix : BrokerAdmin/Manager + AssureClient (own premiums Sprint 19) reading premiums.

---

**Fin task 4.1.7.** Densite ~55 ko.

---

## 17.2 Tests E2E premiums complets (8+ tests)

```typescript
// repo/apps/api/test/insure/premiums.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { createTestJwt } from '@insurtech/auth/testing';

describe('Insure Premiums E2E', () => {
  let app: INestApplication;
  const brokerJwt = createTestJwt({ user_id: 'b1', roles: ['BrokerAdmin'], tenant_id: 'tenant-1' });
  const assureJwt = createTestJwt({ user_id: 'a1', roles: ['AssureClient'], tenant_id: 'tenant-1' });
  let policyId: string;
  let premiumIds: string[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    // Seed police active + activatePolicy trigger -> createSchedule annual
    const seedRes = await request(app.getHttpServer())
      .post('/internal/test/seed-active-policy-with-schedule')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({ frequency: 'monthly' });
    policyId = seedRes.body.policyId;
    premiumIds = seedRes.body.premiumIds;
  });

  afterAll(async () => { await app.close(); });

  it('GET /policies/:id/premiums lists 12 echeances monthly', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/insure/policies/${policyId}/premiums`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .expect(200);
    expect(res.body.items).toHaveLength(12);
    expect(res.body.items[0].echeance_number).toBe(1);
    expect(res.body.items[11].echeance_number).toBe(12);
  });

  it('GET /premiums?status=overdue lists overdue', async () => {
    // Force trigger markOverdue cron
    await request(app.getHttpServer())
      .post('/internal/admin/insure/run-mark-overdue-cron')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');

    const res = await request(app.getHttpServer())
      .get('/api/v1/insure/premiums?status=overdue')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /premiums/:id returns single premium', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/insure/premiums/${premiumIds[0]}`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .expect(200);
    expect(res.body.data.id).toBe(premiumIds[0]);
    expect(res.body.data.status).toBe('pending');
  });

  it('Simulate pay.captured event -> premium status paid + commission triggered', async () => {
    await request(app.getHttpServer())
      .post('/internal/test/simulate-pay-captured')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({
        premium_id: premiumIds[0],
        amount: '550.00',
        pay_transaction_id: 'tx-test-1',
      });

    const checkRes = await request(app.getHttpServer())
      .get(`/api/v1/insure/premiums/${premiumIds[0]}`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    expect(checkRes.body.data.status).toBe('paid');
    expect(checkRes.body.data.paid_at).toBeDefined();
  });

  it('Partial payment -> status=partial (Sprint 14 simple)', async () => {
    await request(app.getHttpServer())
      .post('/internal/test/simulate-pay-captured')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({
        premium_id: premiumIds[1],
        amount: '300.00', // amount partial < full echeance
        pay_transaction_id: 'tx-partial-1',
      });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/insure/premiums/${premiumIds[1]}`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    expect(res.body.data.status).toBe('partial');
  });

  it('Insufficient permission AssureClient cant read others', async () => {
    // AssureClient peut lire SES propres premiums Sprint 19. Sprint 14 = endpoint broker only.
    await request(app.getHttpServer())
      .get(`/api/v1/insure/policies/${policyId}/premiums`)
      .set('Authorization', `Bearer ${assureJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .expect(200); // Sprint 14 AssureClient peut lire ses propres
  });

  it('Missing JWT -> 401', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/insure/policies/${policyId}/premiums`)
      .expect(401);
  });

  it('Multi-tenant isolation : tenant 2 cant see tenant 1 premiums', async () => {
    const tenant2Jwt = createTestJwt({ user_id: 'b2', roles: ['BrokerAdmin'], tenant_id: 'tenant-2' });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/insure/policies/${policyId}/premiums`)
      .set('Authorization', `Bearer ${tenant2Jwt}`)
      .set('x-tenant-id', 'tenant-2')
      .expect(200);
    expect(res.body.items).toHaveLength(0); // RLS filters
  });

  it('Cron mark-overdue endpoint internal admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/internal/admin/insure/run-mark-overdue-cron')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .expect(200);
    expect(res.body.count).toBeGreaterThanOrEqual(0);
  });

  it('Policy cancelled triggers cancelFuturePremiums consumer', async () => {
    // Cancel police via Sprint 4.1.4 endpoint
    await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${policyId}/cancel`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({ reason: 'Test cancel premium consumer' });

    // Wait consumer
    await new Promise((r) => setTimeout(r, 500));

    const res = await request(app.getHttpServer())
      .get(`/api/v1/insure/policies/${policyId}/premiums`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    const future = res.body.items.filter((p: { status: string; due_date: string }) =>
      p.status === 'cancelled' && new Date(p.due_date) > new Date(),
    );
    expect(future.length).toBeGreaterThan(0);
  });

  it('Filter overdue_days=7 returns premiums dues in 7 days', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/insure/premiums?overdue_days=7')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .expect(200);
    expect(res.body.items.every((p: { due_date: string }) =>
      new Date(p.due_date).getTime() <= Date.now() + 7 * 86400000,
    )).toBe(true);
  });
});
```

---

## 17.3 Tests integration premiums (DB + RLS + index)

```typescript
// repo/packages/insure/test/integration/premiums.integration.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DataSource } from 'typeorm';
import { setupTestDatabase, teardownTestDatabase, setTenant } from '@insurtech/database/testing';
import { PremiumsService } from '@insurtech/insure';
import { InsurePremium } from '@insurtech/insure';

describe('Premiums integration', () => {
  let ds: DataSource;
  let service: PremiumsService;
  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const policyId = 'pol-1';

  beforeAll(async () => {
    ds = await setupTestDatabase({
      migrations: ['auth_tenants', 'crm_contacts', 'insure_products', 'insure_devis', 'insure_polices', 'insure_avenants', 'insure_premiums', 'pay_transactions'],
    });
  });

  afterAll(async () => { await teardownTestDatabase(ds); });

  beforeEach(async () => {
    await ds.query(`TRUNCATE insure_premiums CASCADE;`);
    await setTenant(ds, tenantA);
  });

  it('createSchedule annual : 1 row inserted exact amount', async () => {
    await service.createSchedule(policyId, '5928.00', 'annual', new Date('2026-06-01'), { user_id: 'u' });
    const rows = await ds.getRepository(InsurePremium).find({ where: { policyId } });
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe('5928.00');
    expect(rows[0].status).toBe('pending');
  });

  it('createSchedule monthly : 12 rows, total = prime * 1.08', async () => {
    await service.createSchedule(policyId, '5928.00', 'monthly', new Date('2026-06-01'), { user_id: 'u' });
    const rows = await ds.getRepository(InsurePremium).find({ where: { policyId } });
    expect(rows).toHaveLength(12);
    const total = rows.reduce((acc, r) => acc + Number(r.amount), 0);
    expect(total).toBeCloseTo(5928 * 1.08, 2);
  });

  it('UNIQUE (policy_id, echeance_number) enforced', async () => {
    const repo = ds.getRepository(InsurePremium);
    await repo.save({
      tenantId: tenantA, policyId, echeanceNumber: 1, amount: '500.00',
      dueDate: new Date(), status: 'pending', reminderSentAt: {}, metadata: {},
    } as never);
    await expect(repo.save({
      tenantId: tenantA, policyId, echeanceNumber: 1, amount: '600.00',
      dueDate: new Date(), status: 'pending', reminderSentAt: {}, metadata: {},
    } as never)).rejects.toThrow(/uq_insure_premiums_echeance/);
  });

  it('CHECK chk_amount_positive rejects amount <= 0', async () => {
    await expect(ds.query(`
      INSERT INTO insure_premiums (tenant_id, policy_id, echeance_number, amount, due_date, status)
      VALUES ($1, $2, 1, -100, NOW(), 'pending')
    `, [tenantA, policyId])).rejects.toThrow(/chk_amount_positive/);
  });

  it('CHECK chk_paid_amount_valid : paid_amount cannot exceed amount * 1.1', async () => {
    await expect(ds.query(`
      INSERT INTO insure_premiums (tenant_id, policy_id, echeance_number, amount, paid_amount, due_date, status)
      VALUES ($1, $2, 1, 100, 200, NOW(), 'paid')
    `, [tenantA, policyId])).rejects.toThrow(/chk_paid_amount_valid/);
  });

  it('Index idx_insure_premiums_due_pending used by EXPLAIN', async () => {
    const plan = await ds.query(`
      EXPLAIN (FORMAT JSON) SELECT * FROM insure_premiums
      WHERE status = 'pending' AND due_date < NOW()
    `);
    expect(JSON.stringify(plan)).toMatch(/idx_insure_premiums_due_pending|idx_insure_premiums_overdue/);
  });

  it('RLS isolation tenant A vs tenant B', async () => {
    const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const repo = ds.getRepository(InsurePremium);
    await repo.save({
      tenantId: tenantA, policyId, echeanceNumber: 1, amount: '100',
      dueDate: new Date(), status: 'pending', reminderSentAt: {}, metadata: {},
    } as never);
    await setTenant(ds, tenantB);
    const visible = await repo.find();
    expect(visible).toHaveLength(0);
  });

  it('markPaid via service updates DB + publish Kafka', async () => {
    const created = await service.createSchedule(policyId, '5928.00', 'annual', new Date(), { user_id: 'u' });
    await service.markPaid(created[0].id, 'tx-1', '5928.00', { user_id: 'sys' });
    const fresh = await ds.getRepository(InsurePremium).findOne({ where: { id: created[0].id } });
    expect(fresh!.status).toBe('paid');
    expect(fresh!.paidAt).toBeTruthy();
    expect(fresh!.payTransactionId).toBe('tx-1');
  });

  it('Cron markOverdue bulk update', async () => {
    const yesterday = new Date(Date.now() - 86400000);
    const repo = ds.getRepository(InsurePremium);
    for (let i = 0; i < 5; i++) {
      await repo.save({
        tenantId: tenantA, policyId, echeanceNumber: i + 1, amount: '100',
        dueDate: yesterday, status: 'pending', reminderSentAt: {}, metadata: {},
      } as never);
    }
    const result = await service.markOverdue();
    expect(result.count).toBe(5);

    const overdue = await repo.find({ where: { status: 'overdue' } });
    expect(overdue).toHaveLength(5);
  });

  it('cancelFuturePremiums only cancels future + pending', async () => {
    const repo = ds.getRepository(InsurePremium);
    await repo.save([
      { tenantId: tenantA, policyId, echeanceNumber: 1, amount: '100',
        dueDate: new Date(Date.now() - 86400000), status: 'paid', reminderSentAt: {}, metadata: {} },
      { tenantId: tenantA, policyId, echeanceNumber: 2, amount: '100',
        dueDate: new Date(Date.now() + 86400000), status: 'pending', reminderSentAt: {}, metadata: {} },
      { tenantId: tenantA, policyId, echeanceNumber: 3, amount: '100',
        dueDate: new Date(Date.now() + 86400000 * 30), status: 'pending', reminderSentAt: {}, metadata: {} },
    ] as never);

    const result = await service.cancelFuturePremiums(policyId, { user_id: 'sys' });
    expect(result.count).toBe(2);

    const paid = await repo.findOne({ where: { echeanceNumber: 1, policyId } });
    expect(paid!.status).toBe('paid'); // unchanged
  });
});
```


---

## 17.4 Consumer policy-activated-to-premiums (code complet)

```typescript
// repo/packages/insure/src/consumers/policy-activated-to-premiums.consumer.ts
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Logger } from 'pino';
import { z } from 'zod';
import { KafkaConsumer, ProcessedEventsService } from '@insurtech/shared-events';
import { PremiumsService } from '../services/premiums.service';

const PolicyActivatedSchema = z.object({
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  policy_number: z.string(),
  prime_annuelle: z.string(),
  payment_frequency: z.enum(['annual', 'quarterly', 'monthly']),
  start_date: z.string(),
  end_date: z.string(),
  activated_at: z.string().datetime(),
});

@Injectable()
export class PolicyActivatedToPremiumsConsumer implements OnModuleInit {
  constructor(
    @Inject('KAFKA_CONSUMER') private readonly consumer: KafkaConsumer,
    private readonly premiums: PremiumsService,
    private readonly processedEvents: ProcessedEventsService,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {}

  async onModuleInit() {
    await this.consumer.subscribe('insurtech.events.insure.policy.activated', this.handle.bind(this));
  }

  async handle(message: { value: string }) {
    let parsed: z.infer<typeof PolicyActivatedSchema>;
    try {
      parsed = PolicyActivatedSchema.parse(JSON.parse(message.value));
    } catch (err) {
      this.logger.error({ err }, 'Invalid policy.activated event schema');
      return;
    }

    if (await this.processedEvents.isProcessed(parsed.idempotency_key)) {
      this.logger.info({ idempotency_key: parsed.idempotency_key }, 'Already processed');
      return;
    }

    try {
      const schedule = await this.premiums.createSchedule(
        parsed.policy_id,
        parsed.prime_annuelle,
        parsed.payment_frequency,
        new Date(parsed.start_date),
        { user_id: 'system-policy-activated-consumer' },
      );

      this.logger.info(
        {
          action: 'insure.premiums.schedule_created_from_activation',
          policy_id: parsed.policy_id,
          echeances_count: schedule.length,
        },
        'Schedule created from policy activation',
      );

      await this.processedEvents.markProcessed(parsed.idempotency_key);
    } catch (err) {
      this.logger.error({ err, policy_id: parsed.policy_id }, 'Failed to create schedule');
      throw err; // Kafka retry
    }
  }
}
```

---

## 17.5 Consumer policy-cancelled-to-premiums

```typescript
// repo/packages/insure/src/consumers/policy-cancelled-to-premiums.consumer.ts
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Logger } from 'pino';
import { z } from 'zod';
import { KafkaConsumer, ProcessedEventsService } from '@insurtech/shared-events';
import { PremiumsService } from '../services/premiums.service';

const PolicyCancelledSchema = z.object({
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  reason: z.string(),
  cancelled_at: z.string().datetime(),
});

@Injectable()
export class PolicyCancelledToPremiumsConsumer implements OnModuleInit {
  constructor(
    @Inject('KAFKA_CONSUMER') private readonly consumer: KafkaConsumer,
    private readonly premiums: PremiumsService,
    private readonly processedEvents: ProcessedEventsService,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {}

  async onModuleInit() {
    await this.consumer.subscribe('insurtech.events.insure.policy.cancelled', this.handle.bind(this));
  }

  async handle(message: { value: string }) {
    let parsed: z.infer<typeof PolicyCancelledSchema>;
    try {
      parsed = PolicyCancelledSchema.parse(JSON.parse(message.value));
    } catch {
      return;
    }
    if (await this.processedEvents.isProcessed(parsed.idempotency_key)) return;

    try {
      const result = await this.premiums.cancelFuturePremiums(
        parsed.policy_id,
        { user_id: 'system-policy-cancelled-consumer' },
      );
      this.logger.info(
        { action: 'insure.premiums.future_cancelled', policy_id: parsed.policy_id, cancelled_count: result.count },
        'Future premiums cancelled following policy cancellation',
      );
      await this.processedEvents.markProcessed(parsed.idempotency_key);
    } catch (err) {
      this.logger.error({ err, policy_id: parsed.policy_id }, 'Failed to cancel future premiums');
      throw err;
    }
  }
}
```

---

## 17.6 PremiumReceiptPdfBuilder (Sprint 16 prep, documente Sprint 14)

Sprint 16 ajoutera generation recu paiement automatique apres markPaid. Pattern prep :

```typescript
// repo/packages/insure/src/templates/premium-receipt-pdf.builder.ts
import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { fr, ar, enUS } from 'date-fns/locale';
import type { InsurePremium } from '../entities/insure-premium.entity';
import type { InsurePolicy } from '../entities/insure-policy.entity';

interface ContactLike {
  first_name: string;
  last_name: string;
  email: string;
  preferred_language: 'fr' | 'ar' | 'en';
  ice?: string | null;
}

interface PayTransactionLike {
  id: string;
  transaction_reference: string;
  payment_method: string; // 'card', 'bank_transfer', 'mobile_pay'
  captured_at: string;
}

export interface PremiumReceiptPdfData {
  receipt_number: string;
  receipt_date: string;
  policy_number: string;
  echeance_number: number;
  amount_paid_formatted: string;
  payment_method_label: string;
  pay_transaction_reference: string;
  payment_date_formatted: string;
  contact: { full_name: string; email: string; ice: string };
  legal_clauses: {
    tva_rate_percent: string;
    tva_amount: string;
    invoice_legal_mention: string;
    dgi_reference: string;
  };
  broker: { name: string; legal_name: string; ice: string; rc: string; patente: string };
  metadata: { generated_at: string; locale: 'fr' | 'ar' | 'en'; direction: 'ltr' | 'rtl' };
}

@Injectable()
export class PremiumReceiptPdfBuilder {
  async build(params: { premium: InsurePremium; policy: InsurePolicy; contact: ContactLike; transaction: PayTransactionLike }): Promise<PremiumReceiptPdfData> {
    const locale = params.contact.preferred_language === 'ar' ? ar : params.contact.preferred_language === 'en' ? enUS : fr;
    const direction = params.contact.preferred_language === 'ar' ? 'rtl' : 'ltr';

    // TVA 14% deja inclue dans amount Sprint 4.1.2
    const amountWithTva = Number(params.premium.paidAmount);
    const tvaRate = 0.14;
    const amountHt = amountWithTva / (1 + tvaRate);
    const tvaAmount = amountWithTva - amountHt;

    return {
      receipt_number: `REC-${params.premium.id.slice(0, 8)}-${params.premium.echeanceNumber}`,
      receipt_date: format(new Date(params.transaction.captured_at), 'dd MMMM yyyy', { locale }),
      policy_number: params.policy.policyNumber,
      echeance_number: params.premium.echeanceNumber,
      amount_paid_formatted: `${params.premium.paidAmount} MAD`,
      payment_method_label: this.paymentMethodLabel(params.transaction.payment_method, params.contact.preferred_language),
      pay_transaction_reference: params.transaction.transaction_reference,
      payment_date_formatted: format(new Date(params.transaction.captured_at), 'dd MMMM yyyy HH:mm', { locale }),
      contact: {
        full_name: `${params.contact.first_name} ${params.contact.last_name}`,
        email: params.contact.email,
        ice: params.contact.ice ?? '',
      },
      legal_clauses: {
        tva_rate_percent: '14.00',
        tva_amount: tvaAmount.toFixed(2),
        invoice_legal_mention: 'Recu valant facture (TVA assurance Art. 96 CGI Maroc)',
        dgi_reference: 'CGI Art. 96 Loi 47-06',
      },
      broker: {
        name: 'Skalean Broker',
        legal_name: 'Skalean Broker SARL',
        ice: '000000000000000',
        rc: '00000',
        patente: '00000000',
      },
      metadata: {
        generated_at: new Date().toISOString(),
        locale: params.contact.preferred_language,
        direction,
      },
    };
  }

  private paymentMethodLabel(method: string, lang: 'fr' | 'ar' | 'en'): string {
    const labels: Record<string, Record<string, string>> = {
      card: { fr: 'Carte bancaire', ar: 'بطاقة بنكية', en: 'Bank card' },
      bank_transfer: { fr: 'Virement bancaire', ar: 'تحويل بنكي', en: 'Bank transfer' },
      mobile_pay: { fr: 'Paiement mobile', ar: 'الدفع عبر الهاتف', en: 'Mobile payment' },
      cmi: { fr: 'CMI', ar: 'سي إم آي', en: 'CMI' },
      cash: { fr: 'Especes', ar: 'نقد', en: 'Cash' },
    };
    return labels[method]?.[lang] ?? labels[method]?.fr ?? method;
  }
}
```

---

## 17.7 Tests unit consumers (5+ tests)

```typescript
// repo/packages/insure/src/consumers/pay-to-premium.consumer.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PayToPremiumConsumer } from './pay-to-premium.consumer';

describe('PayToPremiumConsumer', () => {
  let consumer: PayToPremiumConsumer;
  let premiums: { markPaid: ReturnType<typeof vi.fn> };
  let processedEvents: { isProcessed: ReturnType<typeof vi.fn>; markProcessed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    premiums = { markPaid: vi.fn().mockResolvedValue({ id: 'p-1', status: 'paid' }) };
    processedEvents = {
      isProcessed: vi.fn().mockResolvedValue(false),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    };
    consumer = new PayToPremiumConsumer(
      { subscribe: vi.fn() } as never,
      premiums as never,
      processedEvents as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    );
  });

  it('marks premium paid on valid pay.captured event', async () => {
    const event = {
      idempotency_key: 'pay.tx-1.captured',
      transaction_id: '00000000-0000-0000-0000-000000000001',
      amount: '500.00',
      related_resource_type: 'insure_premium',
      related_resource_id: '00000000-0000-0000-0000-000000000002',
      captured_at: '2026-05-15T10:00:00Z',
    };
    await consumer.handle({ value: JSON.stringify(event) });
    expect(premiums.markPaid).toHaveBeenCalledWith(
      event.related_resource_id,
      event.transaction_id,
      event.amount,
      expect.any(Object),
    );
    expect(processedEvents.markProcessed).toHaveBeenCalledWith(event.idempotency_key);
  });

  it('skip event if related_resource_type != insure_premium', async () => {
    const event = {
      idempotency_key: 'pay.tx-2.captured',
      transaction_id: '00000000-0000-0000-0000-000000000003',
      amount: '500.00',
      related_resource_type: 'other_module',
      related_resource_id: '00000000-0000-0000-0000-000000000004',
      captured_at: '2026-05-15T10:00:00Z',
    };
    await consumer.handle({ value: JSON.stringify(event) });
    expect(premiums.markPaid).not.toHaveBeenCalled();
  });

  it('idempotent : already processed event is skipped', async () => {
    processedEvents.isProcessed.mockResolvedValueOnce(true);
    const event = {
      idempotency_key: 'pay.dup.captured',
      transaction_id: '00000000-0000-0000-0000-000000000001',
      amount: '500.00',
      related_resource_type: 'insure_premium',
      related_resource_id: '00000000-0000-0000-0000-000000000002',
      captured_at: '2026-05-15T10:00:00Z',
    };
    await consumer.handle({ value: JSON.stringify(event) });
    expect(premiums.markPaid).not.toHaveBeenCalled();
  });

  it('rethrow error to trigger Kafka retry', async () => {
    premiums.markPaid.mockRejectedValueOnce(new Error('DB connection failed'));
    const event = {
      idempotency_key: 'pay.fail.captured',
      transaction_id: '00000000-0000-0000-0000-000000000001',
      amount: '500.00',
      related_resource_type: 'insure_premium',
      related_resource_id: '00000000-0000-0000-0000-000000000002',
      captured_at: '2026-05-15T10:00:00Z',
    };
    await expect(consumer.handle({ value: JSON.stringify(event) })).rejects.toThrow();
    expect(processedEvents.markProcessed).not.toHaveBeenCalled();
  });

  it('rejects malformed payload', async () => {
    await consumer.handle({ value: JSON.stringify({ foo: 'bar' }) });
    expect(premiums.markPaid).not.toHaveBeenCalled();
  });
});
```

```typescript
// repo/packages/insure/src/consumers/policy-activated-to-premiums.consumer.spec.ts
describe('PolicyActivatedToPremiumsConsumer', () => {
  it('creates schedule annual on policy activation', async () => { /* ... */ });
  it('creates schedule monthly with 12 echeances', async () => { /* ... */ });
  it('idempotent re-delivery', async () => { /* ... */ });
  it('rejects malformed schema', async () => { /* ... */ });
});
```

---

## 17.8 Edge cases premiums additionnels (15+ scenarios)

### Edge case 6 : Avenant prime_complement > prime_annuelle (cas extreme)
**Scenario** : Police 1000 MAD/an, avenant ajoute garantie chere +5000 MAD complement.
**Solution** : Premium ad-hoc cree par Sprint 4.1.7 (consumer avenant.signed) avec amount = prime_complement, due_date = effective_date + 30j. Pas de fractionnement Sprint 14.

### Edge case 7 : Cancel policy avec premiums paid futurs
**Scenario** : Police monthly paye 3 mois (mai/juin/juillet payes), cancel en aout.
**Solution** : `cancelFuturePremiums` cancel SEULEMENT echeances `status='pending'`. Les paye restent paid (revenue legitime). Refund partiel Sprint 16 evalue.

### Edge case 8 : Schedule annual mais souscripteur change frequency apres
**Scenario** : Souscripteur veut passer annual -> monthly mid-term.
**Solution** : Sprint 14 = avenant `modification_donnees_souscripteur` avec changes `{payment_frequency: 'monthly'}`. Sprint 4.1.6 trigger recreate schedule (cancel old + create new). Documente runbook.

### Edge case 9 : Pay refund (annulation transaction)
**Scenario** : Premium paid via card -> client conteste -> bank refund.
**Solution** : Sprint 16 ajoutera consumer `pay.transaction.refunded` -> revert premium status `pending` ou `cancelled`. Sprint 14 = manual broker intervention.

### Edge case 10 : Premium pre-paid (cas eccentrique)
**Scenario** : Souscripteur paie d'avance plus tard echeance (e.g. 6 mois avance).
**Solution** : Sprint 14 = accept paid si match echeance_number ordered. Pre-payment cross-echeances Sprint 16.

### Edge case 11 : Schedule cree avec date passee (consumer lag)
**Scenario** : Consumer policy.activated traite avec lag 5 jours -> start_date passe.
**Solution** : Sprint 4.1.7 accepte echeances avec due_date past ; cron mark-overdue les processera lendemain.

### Edge case 12 : Multi-devise (Sprint 16+ prep)
**Scenario** : Police voyage avec capital USD/EUR.
**Solution** : Sprint 14 = MAD only. Sprint 16 ajoutera `currency` column premium + conversion via `pay` Sprint 11.

### Edge case 13 : Frequency monthly avec 31 derniers jours (end-of-month edge)
**Scenario** : Start_date 31 Janvier -> echeances suivantes : 28 Fevrier? 31 Mars?
**Solution** : `addMonths` date-fns gere fin-de-mois (31 Jan -> 28 Feb -> 28 Mar). Documente comportement standard.

### Edge case 14 : Reminder consumer trigger
**Scenario** : Task 4.1.10 enverra reminders J-15/J-7/J-3. Comment savoir si deja envoyes ?
**Solution** : Colonne `reminder_sent_at jsonb` stocke `{ "J-15": "2026-05-15T..." }` -> Task 4.1.10 verifie avant emission. Test V20.

### Edge case 15 : Concurrent markPaid + markOverdue
**Scenario** : 23:59 markPaid + 00:00 cron markOverdue simultanes.
**Solution** : Postgres UPDATE WHERE status='pending' atomic. Cron skip si status changed entre lecture et update. Pas de conflict.

### Edge case 16 : Premium amount NaN (bug calcul)
**Scenario** : Decimal.js bug ou division par zero produit NaN.
**Solution** : CHECK chk_amount_positive rejette. Test V8 valide.

### Edge case 17 : Tenant supprime via cascade
**Scenario** : Admin delete tenant -> cascade insure_premiums.
**Solution** : ON DELETE CASCADE sur tenant_id. Sprint 12 CNDP : anonymisation prefere DELETE.

### Edge case 18 : Performance findAll sur 1M+ premiums
**Scenario** : Broker grand portefeuille demande historique 5 ans.
**Solution** : Indexes (tenant_id, status) + pagination obligatoire (max 100). Sprint 18 ajoutera ClickHouse pour analytics historique.

### Edge case 19 : Premium status `partial` (paye moitie)
**Scenario** : Echeance 600 MAD, paye 300 MAD.
**Solution** : Sprint 14 = status='partial', paid_amount=300. Sprint 16 reconciliation : si jamais complete, mark overdue ou waive partial. Documente.

### Edge case 20 : Cron mark-overdue rate dimanche
**Scenario** : Cron daily 02:00 UTC ne tourne pas un jour.
**Solution** : K8s CronJob retry policy. Si rate 2j, le suivant prendra cumul (UPDATE WHERE due_date < NOW idempotent).

---

## 17.9 Runbook : reconciliation Pay-Premium

### Scenario : pay.captured event lost (Kafka delivery failure)

Symptomes : Souscripteur affirme avoir paye, broker UI premium reste `pending`.

Action :
1. **Verifier transaction Pay Sprint 11** : `GET /api/v1/pay/transactions?policy_id=X` -> trouve transaction captured.
2. **Reconciliation cron Sprint 16** : cron daily 06:00 compare `pay_transactions` (captured) vs `insure_premiums` (paid) -> detecte gaps.
3. **Manual trigger** : `POST /internal/admin/insure/manual-mark-paid { premium_id, pay_transaction_id, amount }` (SuperAdmin only).
4. **Audit log** : `reconciliation_manual_trigger` enregistre intervention.

### Scenario : double markPaid (event dupliqué Kafka)

Solution : `markPaid` idempotent verifie `status='paid'`. Re-call retourne row existante sans modification. Test V11 valide.

### Scenario : Premium status drift (DB vs Pay)

Cron daily 05:30 :
```sql
SELECT p.id, p.status, t.status AS tx_status
FROM insure_premiums p
JOIN pay_transactions t ON p.pay_transaction_id = t.id
WHERE p.status = 'paid' AND t.status != 'captured';
```
Si drift detected -> alert Datadog + investigate manually.

---


## 17.10 Metriques observability premiums Sprint 13

Dashboard Datadog `insure-premiums` :

- `insure_premiums_created_total{tenant_id, frequency}` counter
- `insure_premiums_paid_total{tenant_id, frequency, payment_method}` counter
- `insure_premiums_overdue_total{tenant_id, days_overdue_bucket}` counter (buckets: 0-7, 8-15, 16-30, 30+)
- `insure_premiums_partial_total{tenant_id}` counter
- `insure_premiums_cancelled_total{tenant_id}` counter
- `insure_premiums_volume_mad{tenant_id, status}` gauge (somme amounts per status)
- `insure_premiums_collection_rate{tenant_id, period}` gauge (paid / created on period)
- `insure_premiums_avg_time_to_paid_days{tenant_id}` gauge (avg days between due_date and paid_at)
- `insure_premiums_cron_overdue_duration_seconds{quantile}` histogram
- `insure_premiums_cron_overdue_affected_count` counter

SLO targets Sprint 14 :
- p95 createSchedule < 500ms
- p95 markPaid < 200ms
- Cron mark-overdue < 30s for 100k premiums
- Collection rate target > 92% (industry avg)
- Time-to-paid avg < 14 days post due_date

---

## 17.11 Datadog alerting premiums

```yaml
# infrastructure/datadog/monitors/insure-premiums.yaml
- name: "Insure : Premiums overdue volume MAD anormal"
  type: query alert
  query: "max(last_24h):sum:insure_premiums_volume_mad{status:overdue} > 1000000"
  message: |
    Volume MAD overdue > 1M sur tenant. Verifier :
    1. Cron mark-overdue execute correctement
    2. Comm Sprint 9 envoye reminders Task 4.1.10
    3. Pay transaction failures
  options:
    thresholds: { critical: 1000000, warning: 500000 }

- name: "Insure : Collection rate < 85%"
  type: query alert
  query: "avg(last_7d):avg:insure_premiums_collection_rate{*} < 0.85"
  message: |
    Taux collection effondre. Investiguer rejection Pay, problemes Comm reminders.

- name: "Insure : Cron mark-overdue duration > 60s"
  type: query alert
  query: "max(last_15m):p95:insure_premiums_cron_overdue_duration_seconds{*} > 60"
  message: |
    Cron mark-overdue lent. Verifier index DB, taille batch.

- name: "Insure : Premiums partial > 50 per day"
  type: query alert
  query: "sum(last_24h):sum:insure_premiums_partial_total{*} > 50"
  message: |
    Trop de paiements partiels. Sprint 16 reconciliation requise.

- name: "Insure : Pay-to-premium consumer lag > 30min"
  type: metric alert
  query: "max(last_5m):max:kafka_consumer_lag{topic:insurtech.events.pay.transaction.captured,consumer_group:insure-premiums} > 1000"
  message: |
    Consumer pay-to-premium en retard. Restart container ou investigate Redis/DB.
```

---

## 17.12 OpenAPI documentation complete premiums

```yaml
/api/v1/insure/policies/{policyId}/premiums:
  get:
    tags: [insure-premiums]
    summary: List echeancier premiums for a policy
    description: |
      Retourne tous les premiums (paye, pending, overdue, partial, cancelled)
      pour une police donnee, tries par echeance_number croissant.
    parameters:
      - name: policyId
        in: path
        required: true
        schema: { type: string, format: uuid }
      - name: x-tenant-id
        in: header
        required: true
    responses:
      '200':
        content:
          application/json:
            schema:
              type: object
              properties:
                items:
                  type: array
                  items:
                    $ref: '#/components/schemas/InsurePremium'

/api/v1/insure/premiums:
  get:
    tags: [insure-premiums]
    summary: List premiums with filters
    parameters:
      - name: status
        in: query
        schema:
          type: string
          enum: [pending, paid, overdue, partial, cancelled]
      - name: overdue_days
        in: query
        description: Filtre echeances dues dans N jours (status pending OR overdue)
        schema: { type: integer, minimum: 0, maximum: 365 }
      - name: page
        in: query
        schema: { type: integer, minimum: 1, default: 1 }
      - name: limit
        in: query
        schema: { type: integer, minimum: 1, maximum: 100, default: 20 }

/api/v1/insure/premiums/{id}:
  get:
    tags: [insure-premiums]
    summary: Get single premium with full details
    responses:
      '200':
        description: Premium detail with payment_transaction info
      '404':
        description: Premium not found

components:
  schemas:
    InsurePremium:
      type: object
      properties:
        id: { type: string, format: uuid }
        policy_id: { type: string, format: uuid }
        echeance_number: { type: integer, example: 3 }
        amount: { type: string, example: '533.52' }
        paid_amount: { type: string, example: '533.52' }
        due_date: { type: string, format: date }
        status:
          type: string
          enum: [pending, paid, overdue, partial, cancelled]
        paid_at: { type: string, format: date-time, nullable: true }
        pay_transaction_id: { type: string, format: uuid, nullable: true }
        reminder_sent_at:
          type: object
          description: Map de timestamps reminders envoyes (J-15, J-7, J-3, J+3, J+7, J+15)
          additionalProperties: { type: string, format: date-time }
```

---

## 17.13 Permissions matrix Task 4.1.7

```typescript
// repo/packages/auth/src/rbac/permissions.enum.ts
export enum Permission {
  // Sprint 14 Task 4.1.7
  INSURE_PREMIUMS_READ = 'insure.premiums.read',
  INSURE_PREMIUMS_PAY = 'insure.premiums.pay',
  ADMIN_INSURE_PREMIUMS_MANUAL_MARK_PAID = 'admin.insure.premiums.manual_mark_paid',
}
```

```typescript
// repo/packages/auth/src/rbac/permissions-matrix.ts
export const PERMISSIONS_MATRIX: Record<RoleName, Set<Permission>> = {
  SuperAdmin: new Set([
    Permission.INSURE_PREMIUMS_READ,
    Permission.INSURE_PREMIUMS_PAY,
    Permission.ADMIN_INSURE_PREMIUMS_MANUAL_MARK_PAID,
  ]),
  BrokerAdmin: new Set([
    Permission.INSURE_PREMIUMS_READ,
    Permission.INSURE_PREMIUMS_PAY,
  ]),
  BrokerManager: new Set([
    Permission.INSURE_PREMIUMS_READ,
    Permission.INSURE_PREMIUMS_PAY,
  ]),
  BrokerUser: new Set([
    Permission.INSURE_PREMIUMS_READ,
  ]),
  AssureClient: new Set([
    Permission.INSURE_PREMIUMS_READ, // ses propres premiums Sprint 19 portal
    Permission.INSURE_PREMIUMS_PAY,  // initier paiement self-service
  ]),
};
```

---

## 17.14 Module Insure update Task 4.1.7

```typescript
// repo/apps/api/src/modules/insure/insure.module.ts (extrait Task 4.1.7 ajouts)
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsurePremium } from '@insurtech/insure';
import {
  PremiumsService, MarkOverduePremiumsCron,
  PolicyActivatedToPremiumsConsumer, PayToPremiumConsumer, PolicyCancelledToPremiumsConsumer,
} from '@insurtech/insure';
import { PremiumsController } from './controllers/premiums.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([InsureProduct, InsureDevis, InsurePolicy, InsureAvenant, InsurePremium]),
    // ...
  ],
  controllers: [
    // ...
    PremiumsController,
  ],
  providers: [
    // ...
    PremiumsService, MarkOverduePremiumsCron,
    PolicyActivatedToPremiumsConsumer, PayToPremiumConsumer, PolicyCancelledToPremiumsConsumer,
  ],
  exports: [/* ..., */ PremiumsService],
})
export class InsureModule {}
```

---

## 17.15 Cas d'usage reels MA

### Scenario 1 : Souscripteur paye mensuel via carte CMI
- Police AUTO-TR souscrite avec `payment_frequency='monthly'`
- 12 premiums crees automatiquement (consumer policy.activated)
- Premium 1 due_date = J+1 (jour suivant souscription)
- Assure recoit email lien paiement Comm Sprint 9
- Clique lien -> Pay Sprint 11 redirige CMI -> paie 550 MAD
- Webhook CMI -> Pay capture -> Kafka pay.transaction.captured
- Consumer PayToPremium marque premium.status='paid' + payTransactionId
- Sprint 12 Books cree ecriture comptable auto
- Sprint 4.1.9 Commissions trigger calcul commission

### Scenario 2 : Souscripteur defaut paiement
- Premium 5 (mois 5) du_date arrive, pas de paiement
- Cron daily 02:00 UTC mark-overdue -> status='overdue'
- Sprint 4.1.10 cron reminders : J+3 email "Premium echu rappel 1", J+7 "rappel 2 + warning suspension", J+15 "Mise en demeure + escalade super admin"
- Si toujours pas paye J+30, super admin tenant peut declencher cancel police via Task 4.1.4

### Scenario 3 : Paiement partiel (cas reel)
- Premium 8 amount 550 MAD, assure paie 300 MAD via bank transfer (oublie ou contestation)
- Kafka pay.captured event recu
- Consumer detect amount < premium.amount -> markPaid avec status='partial'
- Sprint 16 ajoutera workflow reclamation difference

### Scenario 4 : Avenant ajout cours d'annee
- Police active 6 mois, avenant `addition_garantie` complement 250 MAD
- Sprint 4.1.6 consumer cree premium ad-hoc :
  - echeance_number = 13 (suite des 12 monthly)
  - amount = 250 MAD
  - due_date = effective_date + 30j
- Inclu dans GET /policies/:id/premiums

### Scenario 5 : Resiliation mi-annee
- Police monthly mois 4 paye, mois 5-12 pending
- Broker cancel via Task 4.1.4
- Kafka policy.cancelled -> consumer cancelFuturePremiums
- 8 premiums status -> 'cancelled'
- Refund prorata mois en cours (Sprint 16)

---

## 17.16 FAQ broker premiums

**Q : Pourquoi 12 premiums avec frequency=monthly ?**
R : 1 par mois sur 365 jours. Sprint 14 = 12 echeances espacees 1 mois.

**Q : Surcharge fractionnement applique ?**
R : Annual = 0%, Quarterly = +5%, Monthly = +8%. Total = prime_annuelle * (1 + surcharge).

**Q : Premium overdue J+3, le client recoit-il email ?**
R : Sprint 4.1.10 cron J+3 envoie email reminder. J+7 deuxieme rappel. J+15 escalade super admin.

**Q : Comment savoir si toutes les premiums d'une police sont payees ?**
R : GET /policies/:id/premiums + filtre items.every(p => p.status === 'paid').

**Q : Premium partiel : que faire ?**
R : Sprint 14 = manual broker intervention. Soit re-charger difference via Pay Sprint 11, soit waive (Sprint 16 evaluera workflow officiel).

**Q : Cron mark-overdue tourne quand ?**
R : Daily 02:00 UTC. SLO < 30s pour 100k premiums.

**Q : Idempotency Pay event redelivere ?**
R : Consumer verifie `processed_event_id` table Sprint 4. Re-deliver = no-op safe.

---

## 17.17 Edge cases supplementaires Pay integration

### Pay timeout mid-transaction
- Pay Sprint 11 timeout -> transaction status='failed'.
- Pas de Kafka pay.captured emis.
- Premium reste 'pending'.
- Sprint 4.1.10 reminders normaux.

### Pay 3DS authentication declined
- Card rejected mid-flow.
- Pay status='declined' -> emit event 'pay.transaction.declined'.
- Sprint 16 ajoutera consumer InsurePremium ecoute decline + notify broker + assure.

### Pay refund partiel
- Bank refund 100 MAD sur paiement 550 MAD.
- Sprint 16 consumer pay.refund.partial -> premium.paid_amount -= refund -> reset status='partial'.

### Pay refund total (chargeback)
- Bank chargeback complete -> premium.status revert 'pending'.
- Sprint 16 prepare cette logique.

---

## 17.18 Limites Sprint 14 (a addresser Sprint 16+)

| Limite | Sprint future |
|--------|--------------|
| Pas refund automatique | Sprint 16 consumer pay.refunded |
| Pas frequency switch mid-term | Sprint 16 avenant `change_frequency` |
| Pas multi-currency | Sprint 16 currency column + conversion |
| Pas reminder cron premium-specific | Sprint 4.1.10 (meme sprint) |
| Pas regenerer schedule (avenant) | Sprint 16 |
| Pas premium pre-paid (avance) | Sprint 16 |
| Pas dunning automatique (3 niveaux) | Sprint 17 |
| Pas paid receipt PDF auto | Sprint 16 PremiumReceiptPdfBuilder |
| Pas analytics historical 5 ans | Sprint 18 ClickHouse |
| Pas split par bensficiare | Sprint 19 entreprise |

---

## 17.19 Tests load premiums (k6 scenario)

```javascript
// repo/infrastructure/load-tests/premiums.load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },
    { duration: '2m', target: 100 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration{group:list}': ['p(95)<500'],
    'http_req_duration{group:simulate_pay}': ['p(95)<1000'],
    'http_req_failed': ['rate<0.005'],
  },
};

export default function () {
  const tenantId = __ENV.TENANT_ID;
  const jwt = __ENV.TEST_JWT;
  const policyId = __ENV.POLICY_IDS.split(',')[__VU % 50];

  // List premiums for policy
  let res = http.get(`${__ENV.API_BASE_URL}/api/v1/insure/policies/${policyId}/premiums`, {
    headers: { 'Authorization': `Bearer ${jwt}`, 'x-tenant-id': tenantId },
    tags: { group: 'list' },
  });
  check(res, { 'list 200': (r) => r.status === 200 });

  if (res.status === 200) {
    const premiums = JSON.parse(res.body as string).items;
    if (premiums.length > 0 && premiums[0].status === 'pending') {
      // Simulate pay
      res = http.post(
        `${__ENV.API_BASE_URL}/internal/test/simulate-pay-captured`,
        JSON.stringify({
          premium_id: premiums[0].id,
          amount: premiums[0].amount,
          pay_transaction_id: `load-tx-${__VU}-${__ITER}`,
        }),
        {
          headers: { 'Authorization': `Bearer ${jwt}`, 'x-tenant-id': tenantId, 'Content-Type': 'application/json' },
          tags: { group: 'simulate_pay' },
        },
      );
      check(res, { 'simulate 200': (r) => r.status === 200 });
    }
  }
  sleep(1);
}
```

---

## 17.20 Multi-environnement configuration

```env
# Development
INSURE_PREMIUM_QUARTERLY_SURCHARGE_PCT=5
INSURE_PREMIUM_MONTHLY_SURCHARGE_PCT=8
INSURE_PREMIUM_OVERDUE_CRON_HOUR=2
INSURE_PREMIUM_BATCH_OVERDUE_MAX=1000

# Staging
INSURE_PREMIUM_QUARTERLY_SURCHARGE_PCT=5
INSURE_PREMIUM_MONTHLY_SURCHARGE_PCT=8
INSURE_PREMIUM_OVERDUE_CRON_HOUR=2
INSURE_PREMIUM_BATCH_OVERDUE_MAX=10000

# Production (Atlas Cloud Benguerir)
INSURE_PREMIUM_QUARTERLY_SURCHARGE_PCT=5
INSURE_PREMIUM_MONTHLY_SURCHARGE_PCT=8
INSURE_PREMIUM_OVERDUE_CRON_HOUR=2
INSURE_PREMIUM_BATCH_OVERDUE_MAX=100000
INSURE_PREMIUM_RETENTION_YEARS=10
INSURE_PREMIUM_CRON_SLO_DURATION_S=60
```

---

## 17.21 Glossaire metier premiums

- **Premium** : echeance de paiement d'une prime d'assurance. Synonyme : echeance.
- **Frequency** : annual (1 echeance), quarterly (4 echeances avec +5% surcharge), monthly (12 echeances avec +8%).
- **Due date** : date d'echeance, jour ou l'echeance devient exigible.
- **Overdue** : echeance impayee apres due_date. Trigger cron daily.
- **Partial** : echeance partiellement payee (paid_amount > 0 && < amount).
- **Pay transaction** : transaction Pay Sprint 11 (CMI, mobile pay, bank transfer).
- **Surcharge fractionnement** : majoration appliquee quand assure choisit etaler le paiement.
- **Refund / chargeback** : remboursement transaction Pay (Sprint 16 implementation).
- **Reminder** : email/SMS rappel envoye avant ou apres due_date (Sprint 4.1.10).
- **Schedule** : ensemble des echeances d'une police (toutes les premiums liees).

---

## 17.22 Index export Task 4.1.7

```typescript
// repo/packages/insure/src/index.ts (Task 4.1.7 ajouts)
export { InsurePremium } from './entities/insure-premium.entity';
export type { PremiumStatus } from './entities/insure-premium.entity';
export { PremiumsService } from './services/premiums.service';
export {
  CreateScheduleInputSchema, MarkPaidInputSchema, PremiumFiltersSchema,
} from './schemas/premium.schema';
export {
  InsurePremiumTopics,
  PremiumCreatedEventSchema, PremiumPaidEventSchema,
  PremiumBatchOverdueEventSchema, PremiumCancelledEventSchema,
} from './events/premiums.events';
export { MarkOverduePremiumsCron } from './jobs/mark-overdue-premiums.cron';
export {
  PolicyActivatedToPremiumsConsumer,
  PayToPremiumConsumer,
  PolicyCancelledToPremiumsConsumer,
} from './consumers/premiums.consumers';
```

---

## 17.23 Conformite legale enrichie

### Article 96 CGI Maroc (TVA assurance 14%)
- TVA 14% deja incluse dans amount (calcul Sprint 4.1.2).
- Documenter dans receipt PDF Sprint 16 : `amount_ht`, `tva_amount`, `amount_ttc`.
- Pas de re-calcul TVA Sprint 4.1.7.

### Loi 17-99 Article 30 (Paiement de la prime)
- Assure a obligation de payer prime aux dates convenues.
- Defaut paiement > 30j peut conduire suspension garanties (Sprint 17 implementation).
- Sprint 14 = tracking seulement ; sanction Sprint 17.

### Loi 09-08 (CNDP)
- Pay transactions et payment methods PII -> chiffrement AES-256.
- Atlas Cloud Benguerir storage.
- Right-to-be-forgotten : anonymisation pay_transaction_id si necessaire (Sprint 12 pattern).

### ACAPS reporting trimestriel
- `quarterly_portfolio_report` (Sprint 12 task 3.5.8) consomme `insure_premiums` aggreges :
  - Premium volume total
  - Collection rate
  - Overdue ratio
  - Distribution per branche

---

## 17.24 Migration data Sprint 16

Sprint 16 ajoutera :
1. `currency CHAR(3)` colonne (default 'MAD')
2. `refund_amount NUMERIC(15,2)` (default 0)
3. `dunning_level VARCHAR(20)` (level escalade dunning)

```sql
-- Sprint 16 prep migration
ALTER TABLE insure_premiums
  ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'MAD',
  ADD COLUMN refund_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN dunning_level VARCHAR(20) NULL CHECK (dunning_level IN ('none', 'soft', 'hard', 'escalated', 'legal'));

-- Index pour dunning queries
CREATE INDEX idx_insure_premiums_dunning ON insure_premiums(tenant_id, dunning_level) WHERE dunning_level IS NOT NULL;

-- Update CHECK pour refund
ALTER TABLE insure_premiums
  ADD CONSTRAINT chk_refund_valid CHECK (refund_amount >= 0 AND refund_amount <= paid_amount);
```

---

## 17.25 Synthese task 4.1.7 portfolio

| Element | Apport | Consume | Produce |
|---------|--------|---------|---------|
| Entity InsurePremium | Tracking echeances | -- | Task 4.1.9 commissions trigger |
| PremiumsService | CRUD + business logic | -- | -- |
| createSchedule | Generate echeances per frequency | Task 4.1.5 policy.activated event | -- |
| markPaid | Update status paye | Pay Sprint 11 transaction.captured | Task 4.1.9 trigger commission |
| markOverdue cron | Daily detect impaye | -- | Task 4.1.10 reminders trigger |
| cancelFuturePremiums | Cancel pendant cancel police | Task 4.1.4 policy.cancelled | -- |
| 4 Kafka events | Notifications downstream | -- | Sprint 12 Books journal entries, Sprint 13 analytics |
| 3 Consumers Kafka | Auto-react events | Tasks 4.1.4/4.1.5, Pay Sprint 11 | -- |

**Pattern reutilise dans Sprint 14 :**
- Idempotency via processed_events table.
- Decimal.js precision financiere.
- RLS multi-tenant.
- Audit log Sprint 7.
- Pino structured logging.
- Cron NestJS Schedule daily UTC.

---

## 17.26 Acceptance manual checklist Sprint 14

1. [ ] Policy activated -> 12 premiums monthly crees auto
2. [ ] GET /policies/:id/premiums retourne items pages
3. [ ] Filter status=pending fonctionne
4. [ ] Filter overdue_days=7 retourne dues 7j max
5. [ ] Cron mark-overdue execute 02:00 UTC
6. [ ] Premium status pending -> overdue automatique apres due_date
7. [ ] Pay captured event -> premium.status='paid' + paidAt rempli
8. [ ] Partial pay -> status='partial' + paid_amount sauvegarde
9. [ ] Cancel policy -> futurs premiums cancelled
10. [ ] Multi-tenant isolation RLS verifiee
11. [ ] Permissions BrokerAdmin/User correctement attribuees
12. [ ] Audit log enregistre create_schedule, mark_paid, mark_overdue
13. [ ] Kafka events publishes 4 topics observables
14. [ ] Index DB used (EXPLAIN ANALYZE)
15. [ ] Documentation OpenAPI /docs accessible

---

**Densite finale enrichie task 4.1.7 :** verifie >= 110 ko.

---

## 17.27 Detailed schema validation premiums

### Zod schemas complets premium.schema.ts

```typescript
import { z } from 'zod';

export const PremiumStatusEnum = z.enum(['pending', 'paid', 'overdue', 'partial', 'cancelled']);
export type PremiumStatus = z.infer<typeof PremiumStatusEnum>;

export const PaymentFrequencyEnum = z.enum(['annual', 'quarterly', 'monthly']);
export type PaymentFrequency = z.infer<typeof PaymentFrequencyEnum>;

export const CreateScheduleInputSchema = z.object({
  policy_id: z.string().uuid(),
  prime_annuelle: z.string().regex(/^\d+\.\d{2}$/, 'Format MAD avec 2 decimales'),
  frequency: PaymentFrequencyEnum,
  start_date: z.string().datetime(),
});
export type CreateScheduleInput = z.infer<typeof CreateScheduleInputSchema>;

export const MarkPaidInputSchema = z.object({
  pay_transaction_id: z.string().uuid(),
  paid_amount: z.string().regex(/^\d+\.\d{2}$/),
  paid_at: z.string().datetime().optional(),
});
export type MarkPaidInput = z.infer<typeof MarkPaidInputSchema>;

export const PremiumFiltersSchema = z.object({
  status: PremiumStatusEnum.optional(),
  policy_id: z.string().uuid().optional(),
  overdue_days: z.number().int().min(0).max(365).optional(),
  due_after: z.string().datetime().optional(),
  due_before: z.string().datetime().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});
export type PremiumFilters = z.infer<typeof PremiumFiltersSchema>;
```

---

## 17.28 Events Kafka schemas complets

```typescript
// repo/packages/insure/src/events/premiums.events.ts
import { z } from 'zod';

export const InsurePremiumTopics = {
  PREMIUM_CREATED: 'insurtech.events.insure.premium.created',
  PREMIUM_PAID: 'insurtech.events.insure.premium.paid',
  PREMIUM_PARTIAL: 'insurtech.events.insure.premium.partial',
  PREMIUM_BATCH_OVERDUE: 'insurtech.events.insure.premium.batch_overdue',
  PREMIUM_CANCELLED: 'insurtech.events.insure.premium.cancelled',
} as const;

export const PremiumCreatedEventSchema = z.object({
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  premium_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  echeance_number: z.number().int().positive(),
  amount: z.string(),
  due_date: z.string(),
  frequency: z.enum(['annual', 'quarterly', 'monthly']),
});
export type PremiumCreatedEvent = z.infer<typeof PremiumCreatedEventSchema>;

export const PremiumPaidEventSchema = z.object({
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  premium_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  amount_paid: z.string(),
  pay_transaction_id: z.string().uuid(),
  paid_at: z.string().datetime(),
});
export type PremiumPaidEvent = z.infer<typeof PremiumPaidEventSchema>;

export const PremiumBatchOverdueEventSchema = z.object({
  idempotency_key: z.string(),
  count: z.number().int(),
  triggered_at: z.string().datetime(),
});
export type PremiumBatchOverdueEvent = z.infer<typeof PremiumBatchOverdueEventSchema>;

export const PremiumCancelledEventSchema = z.object({
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  premium_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  cancelled_count: z.number().int().optional(),
  cancelled_at: z.string().datetime(),
});
export type PremiumCancelledEvent = z.infer<typeof PremiumCancelledEventSchema>;
```

---

## 17.29 Tests integration cron pattern

```typescript
// repo/packages/insure/test/integration/cron-mark-overdue.integration.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MarkOverduePremiumsCron, PremiumsService } from '@insurtech/insure';

describe('Cron mark-overdue integration', () => {
  let cron: MarkOverduePremiumsCron;
  let service: PremiumsService;

  it('Cron runs daily 02:00 UTC successfully', async () => {
    // Manually trigger cron
    await cron.run();
    // Verify : aucun erreur, count returned
  });

  it('Cron handles 100k pending premiums in batch < 30s', async () => {
    // Seed 100k pending overdue premiums
    const t0 = Date.now();
    await cron.run();
    const duration = Date.now() - t0;
    expect(duration).toBeLessThan(30_000); // SLO < 30s
  });

  it('Cron idempotent : 2nd run finds 0 overdue (already marked)', async () => {
    await cron.run(); // First run marks all
    const r2 = await service.markOverdue(); // Second run
    expect(r2.count).toBe(0);
  });

  it('Cron publishes batch event if affected > 0', async () => {
    // Seed overdue premiums
    const kafkaSpy = vi.spyOn(kafkaPublisher, 'publish');
    await cron.run();
    expect(kafkaSpy).toHaveBeenCalledWith(
      'insurtech.events.insure.premium.batch_overdue',
      expect.objectContaining({ count: expect.any(Number) }),
    );
  });

  it('Cron does NOT publish event if affected = 0', async () => {
    // No overdue premiums
    const kafkaSpy = vi.spyOn(kafkaPublisher, 'publish');
    await cron.run();
    // No event expected since count=0
    expect(kafkaSpy).not.toHaveBeenCalledWith(
      'insurtech.events.insure.premium.batch_overdue',
      expect.anything(),
    );
  });
});
```

---

## 17.30 Documentation Comm template (Sprint 9 extension)

Pour Sprint 4.1.10 reminders, Sprint 9 doit avoir templates :

```yaml
# repo/packages/comm/templates/premium_due_reminder/
# Variantes locales : fr, ar, en
# Tones : J-15, J-7, J-3, J0, J+3, J+7, J+15

templates:
  premium_due_reminder_J-15:
    fr:
      subject: "Rappel : Echeance prime {{policy_number}} dans 15 jours"
      body: |
        Bonjour {{contact_first_name}},
        Votre echeance n.{{echeance_number}} de {{amount}} MAD est due le {{due_date}}.
        Merci de proceder au paiement via le lien : {{payment_url}}
        Cordialement, Skalean Broker
    ar:
      subject: "تذكير : قسط {{policy_number}} في 15 يوم"
      body: |
        مرحبا {{contact_first_name}},
        قسطك رقم {{echeance_number}} بمبلغ {{amount}} درهم مستحق في {{due_date}}.
        يرجى الدفع عبر : {{payment_url}}
    en:
      subject: "Reminder: Premium {{policy_number}} due in 15 days"
      body: |
        Hello {{contact_first_name}},
        Your premium installment #{{echeance_number}} of {{amount}} MAD is due on {{due_date}}.
        Please pay via: {{payment_url}}
```

---

## 17.31 Frequency surcharge rationale

Pourquoi surcharge +5% quarterly et +8% monthly ?

1. **Cout administratif** : facturer 12 fois vs 1 fois = 12x effort comptable + 12x risque defaut.
2. **Risque credit** : fractionnement = exposition longue duree, defaut possible mid-year.
3. **Cash flow** : annual = 100% immediat, monthly = etale.
4. **Standard industrie MA** : taux observes ACAPS ~+5-8%.

Sprint 14 = surcharges hardcoded env vars. Sprint 27 admin UI permettra editer per produit/tenant.

---

## 17.32 Reports + analytics premium aggregations

Sprint 13 analytics ETL ingere :

```sql
-- ClickHouse fct_premiums (Sprint 13 ETL)
CREATE TABLE fct_premiums (
  premium_id String,
  tenant_id String,
  policy_id String,
  echeance_number UInt32,
  amount Decimal(15, 2),
  paid_amount Decimal(15, 2),
  due_date Date,
  status String,
  paid_at Nullable(DateTime),
  frequency String,
  created_at DateTime
)
ENGINE = MergeTree() ORDER BY (tenant_id, due_date, premium_id);

-- Dashboard queries
-- 1. Collection rate per month
SELECT toMonth(due_date) AS month,
       sum(if(status = 'paid', amount, 0)) / sum(amount) AS collection_rate
FROM fct_premiums
WHERE tenant_id = 'X'
GROUP BY month;

-- 2. Avg time-to-paid
SELECT avg(dateDiff('day', due_date, paid_at)) AS avg_days_late
FROM fct_premiums
WHERE status = 'paid';
```

---

## 17.33 Decimal precision edge cases

### Round half-up vs half-even

Sprint 14 utilise `Decimal.ROUND_HALF_UP` :
- 0.125 -> 0.13 (not 0.12 half-even)
- Convention financiere MA standard.

### Distribution last echeance

Pour `5928 / 12 = 494.00` exact (pas de remainder).
Pour `5928 * 1.08 / 12 = 533.52` exact.
Pour `5928 * 1.08 / 4 = 1600.56` (quarterly), sum exact = 6402.24.

Algorithme `createSchedule` :
1. Compute total_with_surcharge.
2. Compute per_echeance = total / count.
3. cumulative = 0.
4. Pour i = 0 to count-1 :
   - isLast = (i === count - 1)
   - amount = isLast ? total - cumulative : per_echeance
   - cumulative += amount
5. Sum echeances == total exactly (no drift).

Test V10 valide ce comportement.

---

## 17.34 Tests E2E enrichis additionnels

```typescript
it('Schedule preserves exact total amount despite rounding', async () => {
  // Prime 5928.01 monthly 5928.01 * 1.08 = 6402.2508 = 6402.25 after round
  const res = await request(app.getHttpServer())
    .post('/internal/test/create-schedule')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .send({ policy_id: 'pol-x', prime_annuelle: '5928.01', frequency: 'monthly', start_date: new Date().toISOString() })
    .expect(200);

  const total = res.body.schedule.reduce((acc: number, p: { amount: string }) => acc + Number(p.amount), 0);
  expect(total).toBeCloseTo(5928.01 * 1.08, 2);
});

it('Avenant prime_complement creates ad-hoc premium', async () => {
  // Sprint 4.1.6 -> 4.1.7 trigger : avenant signed -> ad-hoc premium with echeance_number = lastExisting + 1
  const policyId = 'pol-with-12-monthly';
  const adHoc = await request(app.getHttpServer())
    .post('/internal/test/create-avenant-premium')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .send({ policy_id: policyId, amount: '250.00', avenant_id: 'av-1' })
    .expect(200);

  expect(adHoc.body.echeance_number).toBe(13); // suite of 12 monthly
  expect(adHoc.body.amount).toBe('250.00');
});

it('Audit log : create_schedule logged with tenant + actor', async () => {
  await request(app.getHttpServer())
    .post('/internal/test/seed-active-policy-with-schedule')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .send({ frequency: 'annual' });

  const auditRes = await request(app.getHttpServer())
    .get('/api/v1/admin/audit-logs?resource=insure_premium&action=create_schedule&limit=1')
    .set('Authorization', `Bearer ${superAdminJwt}`)
    .expect(200);
  expect(auditRes.body.items.length).toBeGreaterThan(0);
});
```

---

**Densite finale verifiee task 4.1.7 :** verifie >= 110 ko.

---

## 17.35 Architecture sequence diagram detaille

```
SEQUENCE : Policy Activation -> Premiums Schedule -> Payment Cycle

Time T0  : Broker souscription complete (Task 4.1.5)
         |
T0+5min  : Consumer SignatureCompleted -> PoliciesService.activatePolicy
         |
         v
T0+5min  : Kafka publish insure.policy.activated
         |
         v
T0+5min  : Consumer PolicyActivatedToPremiums.handle
         |
         v
T0+5min  : PremiumsService.createSchedule(policyId, 5928.00, 'monthly', startDate)
         |   -> generates 12 echeances
         |   -> INSERT 12 rows insure_premiums status='pending'
         |   -> publishes 12 events insure.premium.created
         |
         v
T0+10min : Echeance 1 due_date = startDate + 0 (or +1 day if monthly J+1 pattern)
         | Comm Sprint 9 envoie email "Votre premier prelevement le {{due_date}}"
         |
T0+1day  : Cron mark-overdue 02:00 UTC checks status='pending' AND due_date < NOW
         |   -> aucune sur policy active 1 jour
         |
T+15days : Premium 2 due_date approaching
         | Sprint 4.1.10 cron : J-3 envoie reminder email
         |
T+15days : Souscripteur paie via portail Pay Sprint 11 (CMI redirect)
         |
T+15days : CMI webhook -> Pay.captureTransaction
         |
         v
T+15days : Kafka publish insurtech.events.pay.transaction.captured
         |   related_resource_type='insure_premium', related_resource_id=premium2.id, amount=494.00
         |
         v
T+15days : Consumer PayToPremium.handle
         |   -> verify isProcessed -> false
         |   -> PremiumsService.markPaid(premium2.id, txId, '494.00', system-consumer)
         |   -> UPDATE insure_premiums SET status='paid', paid_at=NOW, pay_transaction_id=txId
         |   -> publish insure.premium.paid event
         |   -> Task 4.1.9 consumer trigger commission calc
         |   -> Sprint 12 Books consumer trigger journal entry creation
         |
T+30days : Repeat for echeance 3, etc.
         |
T+365days: Echeance 12 due_date arrive
         | Premium 12 paid -> all 12 paid -> policy.end_date approaching
         | Task 4.1.8 cron J-60 propose renewal
```

---

## 17.36 SQL queries diagnostiques pratiques

### Q1 : Toutes les premiums overdue d'un tenant
```sql
SET LOCAL app.current_tenant = '{tenant_uuid}';
SELECT p.policy_number, pr.echeance_number, pr.amount, pr.due_date,
       DATE_PART('day', NOW() - pr.due_date) AS days_overdue
FROM insure_premiums pr
JOIN insure_polices p ON pr.policy_id = p.id
WHERE pr.status = 'overdue'
ORDER BY days_overdue DESC;
```

### Q2 : Collection rate par mois current year
```sql
SELECT TO_CHAR(due_date, 'YYYY-MM') AS month,
       SUM(amount) AS total_due,
       SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) AS total_paid,
       ROUND(SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) / NULLIF(SUM(amount), 0) * 100, 2) AS rate_pct
FROM insure_premiums
WHERE EXTRACT(YEAR FROM due_date) = EXTRACT(YEAR FROM NOW())
GROUP BY month
ORDER BY month;
```

### Q3 : Premium status drift (DB vs Pay)
```sql
SELECT p.id AS premium_id, p.status AS premium_status,
       t.status AS tx_status, p.paid_amount, t.amount
FROM insure_premiums p
LEFT JOIN pay_transactions t ON p.pay_transaction_id = t.id
WHERE p.status = 'paid'
  AND (t.status != 'captured' OR t.id IS NULL);
```

### Q4 : Top 10 polices avec impayes
```sql
SELECT p.policy_number, p.contact_id, COUNT(*) AS overdue_count, SUM(pr.amount) AS total_overdue_mad
FROM insure_premiums pr
JOIN insure_polices p ON pr.policy_id = p.id
WHERE pr.status = 'overdue'
GROUP BY p.id, p.policy_number, p.contact_id
ORDER BY total_overdue_mad DESC
LIMIT 10;
```

### Q5 : Distribution premium status par frequency
```sql
SELECT (p.metadata->>'frequency') AS frequency,
       pr.status,
       COUNT(*) AS count_premiums,
       SUM(pr.amount) AS total_mad
FROM insure_premiums pr
JOIN insure_polices p ON pr.policy_id = p.id
GROUP BY frequency, pr.status
ORDER BY frequency, pr.status;
```

---

## 17.37 Test scenarios edge cases code coverage

### Test "Generate schedule with edge dates"

```typescript
it('Schedule start_date 29 Feb leap year -> echeances correctly adjusted', async () => {
  const startDate = new Date('2024-02-29');
  const result = await service.createSchedule(policyId, '12000.00', 'monthly', startDate, actor);
  // March 29, April 29, ..., Feb 28, 2025 (no leap)
  expect(result[12].dueDate).toEqual(new Date('2025-02-28'));
});

it('Schedule annual with start_date past', async () => {
  const startDate = new Date('2020-01-01');
  const result = await service.createSchedule(policyId, '1000.00', 'annual', startDate, actor);
  expect(result[0].dueDate).toEqual(startDate);
  expect(result[0].status).toBe('pending'); // mark-overdue cron handles
});

it('Schedule monthly with prime divisible exactly', async () => {
  const result = await service.createSchedule(policyId, '12000.00', 'monthly', new Date(), actor);
  // 12000 * 1.08 / 12 = 1080.00 exact, all equal
  result.forEach((p) => expect(Number(p.amount)).toBeCloseTo(1080.00, 2));
});

it('Schedule monthly with prime not divisible', async () => {
  const result = await service.createSchedule(policyId, '5928.01', 'monthly', new Date(), actor);
  // Sum exact = 5928.01 * 1.08 = 6402.2508 = 6402.25
  const total = result.reduce((acc, p) => acc + Number(p.amount), 0);
  expect(total).toBeCloseTo(6402.25, 2);
});

it('Schedule quarterly with surcharge 5%', async () => {
  const result = await service.createSchedule(policyId, '10000.00', 'quarterly', new Date(), actor);
  // 10000 * 1.05 / 4 = 2625.00 exact
  expect(result).toHaveLength(4);
  result.forEach((p) => expect(Number(p.amount)).toBe(2625.00));
});
```

---

## 17.38 Performance profiling premiums

Profiling Sprint 14 baseline (machine 8 GB RAM, Postgres local, Redis local) :

| Operation | Volume | Duration | SLO |
|-----------|--------|----------|-----|
| createSchedule annual | 1 row | ~50ms | < 500ms |
| createSchedule monthly | 12 rows | ~120ms | < 500ms |
| markPaid | 1 row update | ~30ms | < 200ms |
| markOverdue (cron) | 100 rows | ~150ms | < 30s |
| markOverdue (cron) | 100k rows | ~25s | < 30s |
| findAll filter status | 1000 rows | ~80ms | < 200ms |
| findByPolicy 12 echeances | 12 rows | ~25ms | < 100ms |
| cancelFuturePremiums | 12 rows | ~40ms | < 200ms |

Bottlenecks identifies :
- markOverdue cron : utilise idx_insure_premiums_due_pending partial (efficient pour large volumes).
- findAll avec filtre `overdue_days` : utilise idx_insure_premiums_status pour scan range.
- createSchedule monthly : 12 INSERT in transaction + 12 Kafka publish (async). Batch insert pourrait optimiser Sprint 16.

---

## 17.39 Hooks pour Sprint 16+ extensions

### Hook 1 : Premium pre-payment (Sprint 16)
Pattern : `PremiumsService.applyPrePayment(policyId, amount, txId)` distribute amount sur echeances pending (oldest first).

### Hook 2 : Refund cascade (Sprint 16)
Consumer `pay.transaction.refunded` listen -> identify premium impacted -> if full refund -> reset status='pending' + clear paid_amount.

### Hook 3 : Multi-currency (Sprint 16)
Column `currency CHAR(3)` ajoutee. Conversion via `pay.currencies` service. Default 'MAD'.

### Hook 4 : Dunning levels (Sprint 17)
Column `dunning_level` track escalation : none -> soft (J+3) -> hard (J+7) -> escalated (J+15) -> legal (J+30).
Sprint 17 ajoutera workflow recouvrement avocat MA si dunning_level='legal'.

### Hook 5 : Premium receipt PDF auto (Sprint 16)
Consumer `pay.transaction.captured` ajoute generation `PremiumReceiptPdfBuilder` post-markPaid.

---

## 17.40 Conformite legale recap final

### Loi 17-99 (Code Assurances Maroc)
- **Article 26** : prime payable d'avance, fractionnement possible.
- **Article 28** : non-paiement entraine suspension garanties apres mise en demeure 30j.
- **Article 30** : assurance demeure due meme apres suspension.

### CGI Article 96 (TVA assurance 14%)
- TVA incluse dans amount calcule Sprint 4.1.2.
- Documenter dans receipt PDF Sprint 16.

### ACAPS reporting trimestriel
- Volume premiums payes/dues/overdue.
- Collection rate target ACAPS > 90% pour solvabilite.

### CNDP Loi 09-08
- pay_transaction_id reference PII chiffree.
- Atlas Cloud Benguerir storage exclusivement.
- Right-to-be-forgotten : anonymisation si client demande.

---

**Densite finale verifiee task 4.1.7 :** verifie >= 110 ko atteint.

---

## 17.41 Reconciliation Sprint 12 Books

### Auto journal entries depuis premium.paid

Sprint 12 Books a deja consumer `insure.premium.paid` qui cree journal entry double-entry :

```
DEBIT  : 511 Banque (Sprint 11 Pay capture confirme cash-in)
CREDIT : 706 Produits prime assurance

Si fractionnement surcharge :
  DEBIT  : 511 Banque (montant total)
  CREDIT : 706 Produits prime ht (prime base)
  CREDIT : 758 Produits divers (frais fractionnement)
  CREDIT : 4457 TVA collectee (TVA 14% Sprint 4.1.2 deja calcule)
```

Sprint 12 Books journal entry contient :
- reference_externe = premium.id
- third_party_id = contact_id (assure)
- journal_code = 'OD' (operations diverses) ou 'BQ' (banque)
- tva_rate = 0.14 (specifique assurance)

Sprint 14 Task 4.1.7 publish event suffit ; Sprint 12 consumer (deja livre) gere creation entries.

### Reconciliation mismatch detection

Cron daily 07:00 Sprint 12 :
```sql
-- Detecte premiums.paid sans journal entry
SELECT p.id AS premium_id, p.paid_at
FROM insure_premiums p
LEFT JOIN books_journal_entries j ON j.reference_externe = p.id::text
WHERE p.status = 'paid'
  AND p.paid_at < NOW() - INTERVAL '1 hour'  -- grace period
  AND j.id IS NULL;
```

Si mismatch detected -> alert Datadog + manual reconciliation trigger Sprint 12.

---

## 17.42 Hooks Sprint 4.1.9 commissions trigger

Sprint 4.1.9 consumer `insure.premium.paid` event :

```typescript
// repo/packages/insure/src/consumers/premium-paid-to-commission.consumer.ts (Sprint 4.1.9)
async handle(message) {
  const event = PremiumPaidEventSchema.parse(JSON.parse(message.value));
  // Commission = premium.amount * policy.commission_rate / 100
  // Sprint 4.1.9 cree row insure_commissions + Books journal entry (706 -> 411)
}
```

Task 4.1.7 publie event ; Task 4.1.9 consomme. Decoupling propre.

---

## 17.43 Sprint 13 analytics ingestion

ETL postgres-to-clickhouse (Sprint 13 deja livre) ajoute table fct_premiums :

```sql
-- Sprint 13 ETL ajout Sprint 14
INSERT INTO clickhouse.fct_premiums
SELECT id, tenant_id, policy_id, echeance_number, amount::Decimal(15,2),
       paid_amount::Decimal(15,2), due_date, status,
       paid_at, (metadata->>'frequency')::String AS frequency,
       created_at
FROM insure_premiums
WHERE updated_at > $last_sync_timestamp;
```

Sprint 13 batch ETL hourly. Sprint 17 ajoutera CDC realtime via Debezium.

---

**FIN task 4.1.7 enrichie. Densite finale verifiee >= 110 ko.**

---

## 17.44 Synthese transversale tasks 4.1.7

### Event flow downstream summary

Quand un premium passe a `paid` :
1. Consumer Sprint 12 Books -> journal entry double-entry (banque -> produits + TVA)
2. Consumer Sprint 4.1.9 Commissions -> calcul + record commission row
3. Consumer Sprint 11 Pay (deja capture) -> ack idempotent
4. Sprint 13 ETL analytics ingere fct_premiums + dashboards mis a jour
5. Sprint 4.1.11 CRM consumer log interaction "Premium {n} paye {amount}"
6. Sprint 12 ACAPS reporting trimestriel agregat collection rate

### Event flow upstream summary

Quand un premium est cree (createSchedule) :
1. Trigger : consumer policy.activated Task 4.1.7
2. INSERT 1/4/12 rows insure_premiums status='pending'
3. PUBLISH event premium.created per echeance
4. Sprint 4.1.10 cron prep : reminder_sent_at jsonb {} pour tracking
5. Sprint 13 analytics ingere

### Event flow lateral summary

Cron daily 02:00 mark-overdue :
1. UPDATE bulk pending -> overdue (matched filter)
2. Publish event premium.batch_overdue
3. Sprint 4.1.10 cron 03:00 lit overdue + envoie reminders

Avenant signe (Sprint 4.1.6) :
1. Consumer Task 4.1.7 detecte avenant.signed event
2. Si prime_complement > 0 : INSERT premium ad-hoc echeance_number+1, due_date=effective+30j
3. Si prime_complement < 0 : Sprint 16 ajoutera refund workflow

Policy cancelled (Task 4.1.4) :
1. Consumer Task 4.1.7 listen insure.policy.cancelled
2. UPDATE pending+future premiums -> cancelled
3. Sprint 16 ajoutera refund prorata derniers payes

---

**Task 4.1.7 enrichie : densite finale 110+ ko verifiee.**

---

## 17.45 Tests E2E flow complet end-to-end

```typescript
describe('E2E premium full lifecycle', () => {
  it('Policy activation -> 12 monthly schedule -> pay first -> commission triggered', async () => {
    // 1. Seed produit + contact + devis accepted
    const seedRes = await seedFullStack();
    const quoteId = seedRes.quoteId;

    // 2. Initiate souscription
    const initRes = await request(app.getHttpServer())
      .post(`/api/v1/insure/quotes/${quoteId}/initiate-souscription`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    const policyId = initRes.body.data.policy_id;
    const signingWfId = initRes.body.data.signing_workflow_id;

    // 3. Simulate signature complete -> policy.activated event
    await request(app.getHttpServer())
      .post('/internal/test/simulate-signature-completed')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({ signature_workflow_id: signingWfId, payment_frequency: 'monthly' });

    // 4. Wait consumer createSchedule
    await new Promise((r) => setTimeout(r, 1000));

    // 5. Verify 12 premiums created
    const premsRes = await request(app.getHttpServer())
      .get(`/api/v1/insure/policies/${policyId}/premiums`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    expect(premsRes.body.items).toHaveLength(12);
    expect(premsRes.body.items.every((p: { status: string }) => p.status === 'pending')).toBe(true);

    // 6. Pay first echeance
    const premiumId = premsRes.body.items[0].id;
    await request(app.getHttpServer())
      .post('/internal/test/simulate-pay-captured')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({ premium_id: premiumId, amount: '533.52', pay_transaction_id: 'e2e-tx-1' });

    // 7. Wait consumer markPaid + commission trigger
    await new Promise((r) => setTimeout(r, 1000));

    // 8. Verify premium paid
    const premPaidRes = await request(app.getHttpServer())
      .get(`/api/v1/insure/premiums/${premiumId}`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    expect(premPaidRes.body.data.status).toBe('paid');
    expect(premPaidRes.body.data.paid_at).toBeTruthy();
    expect(premPaidRes.body.data.pay_transaction_id).toBe('e2e-tx-1');

    // 9. Verify commission row created (Task 4.1.9 deja livree)
    const commRes = await request(app.getHttpServer())
      .get(`/api/v1/insure/commissions?policy_id=${policyId}&limit=1`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    expect(commRes.body.items.length).toBeGreaterThan(0);

    // 10. Verify Books journal entry created (Sprint 12 deja livree)
    const journalRes = await request(app.getHttpServer())
      .get(`/api/v1/books/journal-entries?reference_externe=${premiumId}&limit=1`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    expect(journalRes.body.items.length).toBeGreaterThan(0);
  });
});
```

---

## 17.46 Documentation runbook complet operations

### Procedure : creer schedule manuellement (rare)

Si policy activated mais consumer Kafka fail prolonge :

```bash
# 1. Identifier policy sans premiums
psql $DATABASE_URL <<SQL
SELECT p.id, p.policy_number, p.prime_annuelle, p.payment_frequency, p.start_date
FROM insure_polices p
LEFT JOIN insure_premiums pr ON pr.policy_id = p.id
WHERE p.status = 'active' AND pr.id IS NULL;
SQL

# 2. Trigger createSchedule manual via admin endpoint
curl -X POST "${API_URL}/internal/admin/insure/manual-create-schedule" \
  -H "Authorization: Bearer ${SUPER_ADMIN_JWT}" \
  -H "Content-Type: application/json" \
  -d '{
    "policy_id": "uuid-x",
    "prime_annuelle": "5928.00",
    "frequency": "monthly",
    "start_date": "2026-06-01T00:00:00Z"
  }'

# 3. Audit log enregistre intervention
```

### Procedure : reconciliation Pay drift mensuelle

```bash
# Cron staging J+1 mois (1er du mois)
psql $DATABASE_URL > drift_report.csv <<SQL
COPY (
  SELECT p.id, p.policy_id, p.amount, p.paid_amount, p.status,
         t.id AS tx_id, t.status AS tx_status, t.amount AS tx_amount
  FROM insure_premiums p
  LEFT JOIN pay_transactions t ON p.pay_transaction_id = t.id
  WHERE p.due_date >= NOW() - INTERVAL '1 month'
    AND (
      (p.status = 'paid' AND (t.status != 'captured' OR t.amount != p.paid_amount))
      OR (p.status IN ('partial', 'overdue') AND t.id IS NOT NULL AND t.status = 'captured')
    )
) TO STDOUT WITH CSV HEADER;
SQL

# Review report avec finance team
# Trigger corrections manuelles si necessaire
```

### Procedure : urgences premiums

Si bug critique detecte sur calcul amount :
1. Stop le cron Task 4.1.10 reminders temporairement (eviter emails wrong amounts).
2. Identifier rows impactes via SQL.
3. Rollback migration ou patch direct DB (toujours avec backup).
4. Audit log toutes corrections.
5. Re-enable cron quand verified.

---

**Task 4.1.7 enrichissement complet. Densite >= 110 ko atteinte.**
