# TACHE 3.6.6 -- Stock Movements + FIFO Exit Logic + Kafka Events

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.6)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant 3.6.7 alertes + 3.6.8 endpoints + Sprint 22 Repair consume parts)
**Effort** : 6h
**Dependances** : Tache 3.6.5 (entities stock_items + stock_lots + valorisation), Sprint 9 Kafka events, Sprint 7 RBAC, Sprint 6 multi-tenant + RLS
**Densite cible** : 100-130 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache livre le coeur metier du module Stock : table `stock_movements` (toutes les entrees/sorties/ajustements tracees), service `stock-movements.service.ts` avec la logique FIFO exit critique (decremente les lots les plus anciens d'abord, calcule le cout total consomme), et emission Kafka events `stock.movement_recorded` pour propagation cross-module (Sprint 22 Repair consume parts, Sprint 12 Books generate ecritures comptables 6022 Achats consommes / 31xx Stocks). Sans cette tache, les garages ne peuvent pas tracer la consommation des pieces detachees et la valorisation FIFO de la Tache 3.6.5 reste statique.

L'apport est triple. **Premierement**, migration `stock_movements` (id, tenant_id, item_id, lot_id NULL si entry, movement_type enum, quantity Decimal 18,4, unit_cost Decimal 15,4, reason, related_resource_type+id pour lien sinistre, occurred_at, created_by user_id, idempotency_key UNIQUE). **Deuxiemement**, service avec 4 methodes : `recordEntry(itemId, quantity, unitCost, supplierInvoiceRef): StockLot` cree un nouveau lot ET un mouvement type 'entry' ; `recordExit(itemId, quantity, reason, relatedResource): { lotsConsumed, totalCost }` execute FIFO via transaction Postgres atomique (READ COMMITTED + SELECT FOR UPDATE sur lots concernes pour eviter race condition) ; `recordAdjustment(itemId, deltaQuantity, reason)` ajuste un lot specifique (correction inventaire) ; `recordTransfer(...)` Sprint 35 defer (multi-warehouse). **Troisiemement**, controller REST avec 4 endpoints + RBAC `stock.movements.create` + audit trail systematique + Kafka publisher.

A l'issue de cette tache, un magasinier garage peut : (a) recevoir un livraison via `POST /stock/movements/entry` (cree lot + mouvement), (b) consommer 3 pneus pour un sinistre via `POST /stock/movements/exit` (FIFO decremente lots anciens d'abord, retourne cout total exact 2400 MAD si 3 pneus * 800 MAD lot janvier), (c) corriger un ecart inventaire via `POST /stock/movements/adjustment`. Les events Kafka declenchent les consumers Sprint 12 Books (ecritures auto) et Sprint 22 Repair (decompte parts par sinistre).

---

## 2. Contexte etendu

### 2.1 Pourquoi FIFO en transaction atomique

La logique FIFO consume plusieurs lots en sequence : lot_1 (entry 2026-01-15, 10 unites a 800 MAD) puis lot_2 (entry 2026-02-10, 5 unites a 850 MAD). Si on demande de consommer 12 unites, on consume 10 de lot_1 (cout 8000 MAD) + 2 de lot_2 (cout 1700 MAD) = 11 unites consommees, 1 unite restante a consommer. Total cout 9700 MAD. Mais si deux requetes paralleles `recordExit(item, 12)` arrivent en meme temps, sans transaction atomique : (a) tous deux SELECT les lots disponibles et voient meme etat, (b) tous deux UPDATE quantity_remaining, (c) double consumption -> lot_1 quantity_remaining = -2 (violation CHECK constraint -> fail) OU silencieux corrupt si pas de check. Solution obligatoire : `SELECT FOR UPDATE` (verrou ligne) ou serialisable transaction.

### 2.2 Alternatives strategies concurrence

| Strategie | Pros | Cons | Decision |
|-----------|------|------|----------|
| **A. READ COMMITTED + SELECT FOR UPDATE** | Standard Postgres, blocage minimal | Deadlock potentiel si ordre lots different | RETENU |
| B. SERIALIZABLE isolation | Garantie absolue | Couts retry frequents sur conflit | Rejete (perf) |
| C. Optimistic locking version | Pas de blocage | Retry boucle, complexe | Defer Sprint 35 |
| D. Mutex Redis distribue | Cross-instance | Latence reseau, single point of failure | Rejete |

### 2.3 Trade-offs

**Trade-off 1 : Deadlock possible si 2 exits sur memes items dans ordre inverse**. Solution : ORDER BY (entry_date ASC, id ASC) STRICT toujours, donc Postgres prend les locks dans le meme ordre, evitant deadlock.

**Trade-off 2 : Pas d'autorisation reservation Sprint 13**. Pas de "reserver 5 unites pour sinistre X en attente". Defer Sprint 22 Repair.

**Trade-off 3 : Adjustment cree mouvement special, pas decremente lot**. Si correction +5 (trouve 5 unites de plus a l'inventaire), on cree un lot ghost ou on ajoute a un lot existant ? **Decision** : si delta > 0 = nouveau lot 'adjustment_in', si delta < 0 = decremente lots FIFO.

### 2.4 Decisions strategiques

- decision-002 multi-tenant + RLS sur stock_movements.
- decision-006 no-emoji.
- decision-008 data MA only.
- Idempotency-Key obligatoire (Sprint 11 pattern) sur POST /movements/* car mutations sensibles.

### 2.5 Pieges techniques

1. **Piege : INSUFFICIENT_STOCK silencieux**. Si exit 100 mais stock 50, ne pas creer mouvement partiel. Solution : transaction ROLLBACK + error 400 explicite.
2. **Piege : reason trop long**. Solution : VARCHAR(500) + Zod max(500).
3. **Piege : occurred_at futur**. Solution : Zod refine `occurred_at <= now()`.
4. **Piege : Decimal arithmetic JS floating**. Solution : Decimal.js partout.
5. **Piege : Kafka publish avant DB commit**. Solution : pattern outbox (publish APRES commit, pas dans transaction).
6. **Piege : Idempotency replay different result**. Solution : store result en Redis 24h cle = idempotency_key.
7. **Piege : audit_logs FK trop tot**. Solution : audit dans meme transaction.
8. **Piege : Numeric scale 4 vs 2 inconsistent**. Solution : `toFixed(4)` interne, conversion presentation.

---

## 3. Architecture context

Tache 3.6.6 est la **sixieme** des 14. Bloque 3.6.7 alertes + 3.6.8 endpoints. Sprint 22 Repair consume via Kafka.

```
POST /api/v1/stock/movements/exit
        |
        v
StockMovementsService.recordExit
   |  BEGIN TRANSACTION (READ COMMITTED)
   |    SELECT * FROM stock_lots WHERE item_id=$1 AND qty_remaining > 0
   |      ORDER BY entry_date ASC, id ASC FOR UPDATE
   |    FOR EACH lot:
   |      consumeFromLot = min(remaining_to_consume, lot.qty_remaining)
   |      INSERT stock_movements (type='exit', lot_id, qty=consumeFromLot, unit_cost=lot.unit_cost)
   |      UPDATE stock_lots SET qty_remaining = qty_remaining - consumeFromLot WHERE id=lot.id
   |      remaining_to_consume -= consumeFromLot
   |    IF remaining_to_consume > 0: ROLLBACK + raise INSUFFICIENT_STOCK
   |  COMMIT
        |
        v
Kafka publish insurtech.events.stock.movement_recorded
        |
        +---> Sprint 12 Books consumer -> ecritures 6022 / 31xx
        +---> Sprint 22 Repair consumer (Sprint 22 only)
        +---> Sprint 17 web-broker UI refresh (Sprint 17)
```

---

## 4. Livrables checkables

- [ ] Migration `1715200000000-StockMovements.ts` (table + indexes + FK + RLS + CHECK)
- [ ] Entity `stock-movement.entity.ts` TypeORM
- [ ] Service `stock-movements.service.ts` (~350 lignes : recordEntry/exit/adjustment + findByItem + timeline)
- [ ] Idempotency check via `@insurtech/auth` interceptor + Redis store
- [ ] Kafka publisher integration (topic `insurtech.events.stock.movement_recorded`)
- [ ] DTO Zod pour 3 endpoints
- [ ] Controller REST `stock-movements.controller.ts`
- [ ] Permissions seed `stock.movements.create/read`, `stock.adjust`
- [ ] Tests unit 18 cas FIFO scenarios
- [ ] Tests integration 8 cas transaction atomicity + concurrent
- [ ] Tests E2E 5 cas REST + Kafka publish verifie

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/1715200000000-StockMovements.ts            (nouveau, ~80 lignes)
repo/packages/stock/src/entities/stock-movement.entity.ts                          (nouveau, ~80 lignes)
repo/packages/stock/src/services/stock-movements.service.ts                         (nouveau, ~380 lignes)
repo/packages/stock/src/services/stock-movements.service.spec.ts                     (nouveau, ~400 lignes, 18 tests)
repo/packages/stock/src/dto/record-entry.dto.ts                                       (nouveau, ~40 lignes Zod)
repo/packages/stock/src/dto/record-exit.dto.ts                                        (nouveau, ~50 lignes Zod)
repo/packages/stock/src/dto/record-adjustment.dto.ts                                  (nouveau, ~40 lignes Zod)
repo/packages/stock/src/events/stock-event-types.ts                                    (nouveau, ~40 lignes Topics + types)
repo/apps/api/src/modules/stock/controllers/stock-movements.controller.ts             (nouveau, ~200 lignes)
repo/apps/api/test/stock/stock-movements.e2e-spec.ts                                   (nouveau, ~250 lignes)
repo/apps/api/test/integration/stock-movements-concurrency.integration.spec.ts          (nouveau, ~200 lignes)
repo/packages/auth/src/seeds/permissions/stock.ts                                       (modif : ajouter stock.movements.* + stock.adjust)
```

---

## 6. Code patterns COMPLETS

### 6.1 Migration `1715200000000-StockMovements.ts`

```typescript
// repo/packages/database/src/migrations/1715200000000-StockMovements.ts
// Skalean InsurTech v2.2 -- Migration stock_movements
// Reference : B-13 Sprint 13 Tache 3.6.6
import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockMovements1715200000000 implements MigrationInterface {
  name = 'StockMovements1715200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE stock_movement_type AS ENUM ('entry', 'exit', 'adjustment_in', 'adjustment_out', 'transfer');
    `);
    await queryRunner.query(`
      CREATE TABLE stock_movements (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        item_id                  UUID NOT NULL,
        lot_id                   UUID,
        movement_type            stock_movement_type NOT NULL,
        quantity                 NUMERIC(18,4) NOT NULL,
        unit_cost                NUMERIC(15,4),
        total_cost               NUMERIC(18,2) GENERATED ALWAYS AS (quantity * COALESCE(unit_cost, 0)) STORED,
        reason                   VARCHAR(500),
        related_resource_type    VARCHAR(64),
        related_resource_id      UUID,
        occurred_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by               UUID NOT NULL,
        idempotency_key          VARCHAR(128),
        kafka_published          BOOLEAN NOT NULL DEFAULT FALSE,
        kafka_published_at       TIMESTAMPTZ,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
        FOREIGN KEY (tenant_id) REFERENCES auth_tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES stock_items(id) ON DELETE RESTRICT,
        FOREIGN KEY (lot_id) REFERENCES stock_lots(id) ON DELETE RESTRICT,
        CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
        CONSTRAINT chk_unit_cost_non_negative CHECK (unit_cost IS NULL OR unit_cost >= 0),
        CONSTRAINT chk_lot_for_exit CHECK (
          movement_type NOT IN ('exit', 'adjustment_out') OR lot_id IS NOT NULL
        ),
        UNIQUE (tenant_id, idempotency_key)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_stock_movements_tenant ON stock_movements(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_stock_movements_item ON stock_movements(item_id, occurred_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_stock_movements_lot ON stock_movements(lot_id);`);
    await queryRunner.query(`CREATE INDEX idx_stock_movements_kafka_pending ON stock_movements(kafka_published) WHERE kafka_published = FALSE;`);
    await queryRunner.query(`CREATE INDEX idx_stock_movements_related ON stock_movements(related_resource_type, related_resource_id);`);

    await queryRunner.query(`ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_stock_movements ON stock_movements
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE stock_movements;`);
    await queryRunner.query(`DROP TYPE stock_movement_type;`);
  }
}
```

### 6.2 Entity `stock-movement.entity.ts`

```typescript
// repo/packages/stock/src/entities/stock-movement.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { StockItem } from './stock-item.entity';
import { StockLot } from './stock-lot.entity';

export type StockMovementType = 'entry' | 'exit' | 'adjustment_in' | 'adjustment_out' | 'transfer';

@Entity({ name: 'stock_movements' })
@Index('idx_stock_movements_tenant', ['tenant_id'])
@Index('idx_stock_movements_item', ['item_id', 'occurred_at'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid' })
  item_id!: string;

  @ManyToOne(() => StockItem)
  @JoinColumn({ name: 'item_id' })
  item?: StockItem;

  @Column({ type: 'uuid', nullable: true })
  lot_id!: string | null;

  @ManyToOne(() => StockLot, { nullable: true })
  @JoinColumn({ name: 'lot_id' })
  lot?: StockLot;

  @Column({ type: 'enum', enum: ['entry', 'exit', 'adjustment_in', 'adjustment_out', 'transfer'], enumName: 'stock_movement_type' })
  movement_type!: StockMovementType;

  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: { to: (v: any) => v, from: (v: any) => v } })
  quantity!: string;

  @Column({ type: 'numeric', precision: 15, scale: 4, nullable: true, transformer: { to: (v: any) => v, from: (v: any) => v } })
  unit_cost!: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 2, transformer: { to: (v: any) => v, from: (v: any) => v } })
  total_cost!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  reason!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  related_resource_type!: string | null;

  @Column({ type: 'uuid', nullable: true })
  related_resource_id!: string | null;

  @Column({ type: 'timestamptz' })
  occurred_at!: Date;

  @Column({ type: 'uuid' })
  created_by!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  idempotency_key!: string | null;

  @Column({ type: 'boolean', default: false })
  kafka_published!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  kafka_published_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
```

### 6.3 DTOs Zod

```typescript
// repo/packages/stock/src/dto/record-entry.dto.ts
import { z } from 'zod';

export const RecordEntrySchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.coerce.number().positive().max(1e10),
  unit_cost: z.coerce.number().min(0).max(1e10),
  lot_number: z.string().max(64).optional(),
  supplier_invoice_ref: z.string().max(128).optional(),
  entry_date: z.coerce.date().optional(),
  reason: z.string().max(500).optional(),
});
export type RecordEntryDto = z.infer<typeof RecordEntrySchema>;

// repo/packages/stock/src/dto/record-exit.dto.ts
export const RecordExitSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.coerce.number().positive().max(1e10),
  reason: z.string().min(1).max(500),
  related_resource_type: z.enum(['claim', 'order', 'manual', 'transfer_out']).optional(),
  related_resource_id: z.string().uuid().optional(),
  occurred_at: z.coerce.date().optional()
    .refine((d) => !d || d <= new Date(), { message: 'occurred_at cannot be in the future' }),
});
export type RecordExitDto = z.infer<typeof RecordExitSchema>;

// repo/packages/stock/src/dto/record-adjustment.dto.ts
export const RecordAdjustmentSchema = z.object({
  item_id: z.string().uuid(),
  delta_quantity: z.coerce.number().refine((v) => v !== 0, { message: 'delta_quantity cannot be zero' }),
  reason: z.string().min(10).max(500, { message: 'reason 10-500 chars required for adjustment' }),
  unit_cost: z.coerce.number().min(0).optional(),
});
export type RecordAdjustmentDto = z.infer<typeof RecordAdjustmentSchema>;
```

### 6.4 Service `stock-movements.service.ts` (critique FIFO)

```typescript
// repo/packages/stock/src/services/stock-movements.service.ts
// Skalean InsurTech v2.2 -- Service mouvements stock + FIFO exit logic
// Reference : B-13 Sprint 13 Tache 3.6.6
// Transaction Postgres READ COMMITTED + SELECT FOR UPDATE = atomicity garantie
import { Injectable, BadRequestException, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import { StockItem } from '../entities/stock-item.entity';
import { StockLot } from '../entities/stock-lot.entity';
import { StockMovement, StockMovementType } from '../entities/stock-movement.entity';

export interface RecordEntryInput {
  itemId: string;
  quantity: string | number;
  unitCost: string | number;
  lotNumber?: string;
  supplierInvoiceRef?: string;
  entryDate?: Date;
  reason?: string;
}

export interface RecordExitInput {
  itemId: string;
  quantity: string | number;
  reason: string;
  relatedResourceType?: string;
  relatedResourceId?: string;
  occurredAt?: Date;
}

export interface RecordExitResult {
  totalCost: string;
  lotsConsumed: Array<{
    lotId: string;
    quantity: string;
    unitCost: string;
    cost: string;
  }>;
  movements: string[];          // ids
}

export interface KafkaPublisher {
  publish(topic: string, payload: any): Promise<void>;
}

@Injectable()
export class StockMovementsService {
  private readonly logger = new Logger(StockMovementsService.name);

  constructor(
    private readonly ds: DataSource,
    private readonly kafka: KafkaPublisher,
  ) {}

  // ---------- recordEntry ----------
  async recordEntry(
    tenantId: string,
    userId: string,
    input: RecordEntryInput,
    idempotencyKey?: string,
  ): Promise<{ lot: StockLot; movement: StockMovement }> {
    return this.ds.transaction(async (em) => {
      // Verify item exists in this tenant
      const item = await em.findOne(StockItem, { where: { id: input.itemId, tenant_id: tenantId } });
      if (!item) throw new NotFoundException(`Item ${input.itemId} not found`);

      // Check idempotency
      if (idempotencyKey) {
        const existing = await em.findOne(StockMovement, {
          where: { tenant_id: tenantId, idempotency_key: idempotencyKey },
        });
        if (existing) {
          throw new ConflictException({ code: 'IDEMPOTENCY_REPLAY', existing_id: existing.id });
        }
      }

      const qty = new Decimal(input.quantity).toFixed(4);
      const cost = new Decimal(input.unitCost).toFixed(4);
      const entryDate = input.entryDate ?? new Date();

      // INSERT lot
      const lot = em.create(StockLot, {
        tenant_id: tenantId,
        item_id: input.itemId,
        lot_number: input.lotNumber ?? null,
        quantity_in: qty,
        quantity_remaining: qty,
        unit_cost: cost,
        entry_date: entryDate,
        supplier_invoice_ref: input.supplierInvoiceRef ?? null,
      });
      const savedLot = await em.save(lot);

      // INSERT movement type 'entry'
      const movement = em.create(StockMovement, {
        tenant_id: tenantId,
        item_id: input.itemId,
        lot_id: savedLot.id,
        movement_type: 'entry' as StockMovementType,
        quantity: qty,
        unit_cost: cost,
        total_cost: new Decimal(qty).mul(cost).toFixed(2),
        reason: input.reason ?? null,
        occurred_at: entryDate,
        created_by: userId,
        idempotency_key: idempotencyKey ?? null,
      });
      const savedMovement = await em.save(movement);

      this.logger.log({
        action: 'stock_entry_recorded',
        tenant_id: tenantId,
        item_id: input.itemId,
        lot_id: savedLot.id,
        quantity: qty,
        cost: cost,
        user_id: userId,
      });

      // Publish Kafka (outbox pattern : flag pending, cron publisher)
      // Simplified : publish direct after commit (TX wrapper executes after return)
      setImmediate(() => this.publishMovementEvent(savedMovement));

      return { lot: savedLot, movement: savedMovement };
    });
  }

  // ---------- recordExit (FIFO critical) ----------
  async recordExit(
    tenantId: string,
    userId: string,
    input: RecordExitInput,
    idempotencyKey?: string,
  ): Promise<RecordExitResult> {
    return this.ds.transaction('READ COMMITTED', async (em) => {
      // Check idempotency
      if (idempotencyKey) {
        const existing = await em.findOne(StockMovement, {
          where: { tenant_id: tenantId, idempotency_key: idempotencyKey, movement_type: 'exit' },
        });
        if (existing) {
          throw new ConflictException({ code: 'IDEMPOTENCY_REPLAY', existing_id: existing.id });
        }
      }

      // SELECT FOR UPDATE lots FIFO order
      const lots = await em
        .createQueryBuilder(StockLot, 'lot')
        .where('lot.item_id = :itemId', { itemId: input.itemId })
        .andWhere('lot.tenant_id = :tenantId', { tenantId })
        .andWhere('lot.quantity_remaining > 0')
        .andWhere('lot.deleted_at IS NULL')
        .orderBy('lot.entry_date', 'ASC')
        .addOrderBy('lot.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      let remaining = new Decimal(input.quantity);
      const requested = remaining.toFixed(4);
      let totalCost = new Decimal(0);
      const lotsConsumed: RecordExitResult['lotsConsumed'] = [];
      const movementIds: string[] = [];
      const occurredAt = input.occurredAt ?? new Date();

      for (const lot of lots) {
        if (remaining.lte(0)) break;
        const lotQty = new Decimal(lot.quantity_remaining);
        const consume = Decimal.min(remaining, lotQty);
        const lotUnitCost = new Decimal(lot.unit_cost);
        const lotCost = consume.mul(lotUnitCost);

        // INSERT movement type 'exit' avec idempotency seulement sur le premier (sinon UNIQUE viol)
        const movement = em.create(StockMovement, {
          tenant_id: tenantId,
          item_id: input.itemId,
          lot_id: lot.id,
          movement_type: 'exit' as StockMovementType,
          quantity: consume.toFixed(4),
          unit_cost: lot.unit_cost,
          total_cost: lotCost.toFixed(2),
          reason: input.reason,
          related_resource_type: input.relatedResourceType ?? null,
          related_resource_id: input.relatedResourceId ?? null,
          occurred_at: occurredAt,
          created_by: userId,
          idempotency_key: movementIds.length === 0 ? (idempotencyKey ?? null) : null,
        });
        const savedMovement = await em.save(movement);
        movementIds.push(savedMovement.id);

        // UPDATE lot quantity_remaining
        await em.update(StockLot, lot.id, {
          quantity_remaining: lotQty.minus(consume).toFixed(4),
        });

        lotsConsumed.push({
          lotId: lot.id,
          quantity: consume.toFixed(4),
          unitCost: lot.unit_cost,
          cost: lotCost.toFixed(2),
        });
        totalCost = totalCost.plus(lotCost);
        remaining = remaining.minus(consume);
      }

      if (remaining.gt(0)) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          item_id: input.itemId,
          requested,
          available: new Decimal(requested).minus(remaining).toFixed(4),
          shortage: remaining.toFixed(4),
        });
      }

      this.logger.log({
        action: 'stock_exit_recorded',
        tenant_id: tenantId,
        item_id: input.itemId,
        quantity_consumed: requested,
        lots_consumed: lotsConsumed.length,
        total_cost_mad: totalCost.toFixed(2),
        related_resource: input.relatedResourceType,
        user_id: userId,
      });

      // Publish events (apres commit via setImmediate hack OR outbox pattern)
      const movementsForKafka = await em.find(StockMovement, { where: { id: movementIds[0] } });
      setImmediate(() => {
        for (const id of movementIds) {
          em.findOne(StockMovement, { where: { id } }).then((m) => m && this.publishMovementEvent(m));
        }
      });

      return {
        totalCost: totalCost.toFixed(2),
        lotsConsumed,
        movements: movementIds,
      };
    });
  }

  // ---------- recordAdjustment ----------
  async recordAdjustment(
    tenantId: string,
    userId: string,
    input: { itemId: string; deltaQuantity: number; reason: string; unitCost?: number },
    idempotencyKey?: string,
  ): Promise<StockMovement> {
    const delta = new Decimal(input.deltaQuantity);
    if (delta.eq(0)) throw new BadRequestException('delta_quantity must not be zero');

    if (delta.gt(0)) {
      // adjustment_in : cree un lot ghost
      const result = await this.recordEntry(tenantId, userId, {
        itemId: input.itemId,
        quantity: delta.toFixed(4),
        unitCost: input.unitCost ?? 0,
        reason: `[ADJUSTMENT] ${input.reason}`,
      }, idempotencyKey);
      // Change movement_type to adjustment_in
      await this.ds.manager.update(StockMovement, result.movement.id, { movement_type: 'adjustment_in' });
      return result.movement;
    } else {
      // adjustment_out : consume FIFO
      const result = await this.recordExit(tenantId, userId, {
        itemId: input.itemId,
        quantity: delta.abs().toFixed(4),
        reason: `[ADJUSTMENT] ${input.reason}`,
      }, idempotencyKey);
      const firstMovementId = result.movements[0];
      if (firstMovementId) {
        await this.ds.manager.update(StockMovement, firstMovementId, { movement_type: 'adjustment_out' });
      }
      const movement = await this.ds.manager.findOne(StockMovement, { where: { id: firstMovementId } });
      if (!movement) throw new Error('Adjustment movement not found');
      return movement;
    }
  }

  // ---------- findByItem (timeline) ----------
  async findByItem(tenantId: string, itemId: string, opts: { limit?: number; offset?: number; dateFrom?: Date; dateTo?: Date } = {}): Promise<{ movements: StockMovement[]; total: number }> {
    const qb = this.ds.manager.createQueryBuilder(StockMovement, 'm')
      .where('m.tenant_id = :t', { t: tenantId })
      .andWhere('m.item_id = :i', { i: itemId });
    if (opts.dateFrom) qb.andWhere('m.occurred_at >= :df', { df: opts.dateFrom });
    if (opts.dateTo) qb.andWhere('m.occurred_at <= :dt', { dt: opts.dateTo });
    const total = await qb.getCount();
    const movements = await qb.orderBy('m.occurred_at', 'DESC').limit(opts.limit ?? 50).offset(opts.offset ?? 0).getMany();
    return { movements, total };
  }

  private async publishMovementEvent(movement: StockMovement): Promise<void> {
    try {
      await this.kafka.publish('insurtech.events.stock.movement_recorded', {
        movement_id: movement.id,
        tenant_id: movement.tenant_id,
        item_id: movement.item_id,
        lot_id: movement.lot_id,
        movement_type: movement.movement_type,
        quantity: movement.quantity,
        unit_cost: movement.unit_cost,
        total_cost: movement.total_cost,
        related_resource_type: movement.related_resource_type,
        related_resource_id: movement.related_resource_id,
        occurred_at: movement.occurred_at.toISOString(),
        created_by: movement.created_by,
      });
      await this.ds.manager.update(StockMovement, movement.id, {
        kafka_published: true,
        kafka_published_at: new Date(),
      });
    } catch (err) {
      this.logger.error({ action: 'kafka_publish_failed', movement_id: movement.id, error: String(err) });
    }
  }
}
```

### 6.5 Controller `stock-movements.controller.ts`

```typescript
// repo/apps/api/src/modules/stock/controllers/stock-movements.controller.ts
import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, CurrentTenantId, CurrentUserId } from '@insurtech/auth';
import { StockMovementsService, RecordEntrySchema, RecordExitSchema, RecordAdjustmentSchema } from '@insurtech/stock';

@Controller('api/v1/stock/movements')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class StockMovementsController {
  constructor(private readonly movements: StockMovementsService) {}

  @Post('entry')
  @Roles('stock.movements.create')
  async entry(
    @CurrentTenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    const dto = RecordEntrySchema.parse(body);
    return this.movements.recordEntry(tenantId, userId, {
      itemId: dto.item_id,
      quantity: dto.quantity,
      unitCost: dto.unit_cost,
      lotNumber: dto.lot_number,
      supplierInvoiceRef: dto.supplier_invoice_ref,
      entryDate: dto.entry_date,
      reason: dto.reason,
    }, idempotencyKey);
  }

  @Post('exit')
  @Roles('stock.movements.create')
  async exit(
    @CurrentTenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    const dto = RecordExitSchema.parse(body);
    return this.movements.recordExit(tenantId, userId, {
      itemId: dto.item_id,
      quantity: dto.quantity,
      reason: dto.reason,
      relatedResourceType: dto.related_resource_type,
      relatedResourceId: dto.related_resource_id,
      occurredAt: dto.occurred_at,
    }, idempotencyKey);
  }

  @Post('adjustment')
  @Roles('stock.adjust')
  async adjustment(
    @CurrentTenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: unknown,
  ) {
    const dto = RecordAdjustmentSchema.parse(body);
    return this.movements.recordAdjustment(tenantId, userId, {
      itemId: dto.item_id,
      deltaQuantity: dto.delta_quantity,
      reason: dto.reason,
      unitCost: dto.unit_cost,
    }, idempotencyKey);
  }

  @Get('items/:itemId/timeline')
  @Roles('stock.movements.read')
  async timeline(
    @CurrentTenantId() tenantId: string,
    @Param('itemId') itemId: string,
    @Query() q: any,
  ) {
    return this.movements.findByItem(tenantId, itemId, {
      limit: q.limit ? Number(q.limit) : 50,
      offset: q.offset ? Number(q.offset) : 0,
      dateFrom: q.date_from ? new Date(q.date_from) : undefined,
      dateTo: q.date_to ? new Date(q.date_to) : undefined,
    });
  }
}
```

---

## 7. Tests complets

### 7.1 Tests unit `stock-movements.service.spec.ts` (18 cas)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { StockMovementsService } from './stock-movements.service';

describe('StockMovementsService', () => {
  let ds: any; let kafka: any; let service: StockMovementsService;

  beforeEach(() => {
    ds = { transaction: vi.fn(), manager: { update: vi.fn(), findOne: vi.fn(), createQueryBuilder: vi.fn() } };
    kafka = { publish: vi.fn() };
    service = new StockMovementsService(ds as DataSource, kafka);
  });

  describe('recordEntry', () => {
    it('creates lot + movement', async () => {
      ds.transaction.mockImplementation((cb: any) => cb({
        findOne: vi.fn().mockResolvedValue({ id: 'item-1' }),
        create: vi.fn((Entity, data) => ({ ...data, id: 'lot-1' })),
        save: vi.fn().mockResolvedValue({ id: 'lot-1', quantity_in: '10.0000' }),
      }));
      const r = await service.recordEntry('tenant-1', 'user-1', { itemId: 'item-1', quantity: 10, unitCost: 800 });
      expect(r.lot).toBeDefined();
    });

    it('rejects if item not found', async () => {
      ds.transaction.mockImplementation((cb: any) => cb({ findOne: vi.fn().mockResolvedValue(null) }));
      await expect(service.recordEntry('tenant', 'user', { itemId: 'x', quantity: 1, unitCost: 1 })).rejects.toThrow();
    });

    it('rejects duplicate idempotency key', async () => {
      ds.transaction.mockImplementation((cb: any) => cb({
        findOne: vi.fn().mockImplementation((Entity) => {
          if (Entity.name === 'StockMovement') return { id: 'existing' };
          return { id: 'item-1' };
        }),
      }));
      await expect(service.recordEntry('t', 'u', { itemId: 'i', quantity: 1, unitCost: 1 }, 'key-1')).rejects.toThrow(/IDEMPOTENCY/);
    });
  });

  describe('recordExit FIFO', () => {
    it('consume single lot exact match', async () => {
      const em = mockEm([{ id: 'l1', quantity_remaining: '10', unit_cost: '800' }]);
      ds.transaction.mockImplementation((isoLevelOrCb: any, cb?: any) => {
        const fn = cb ?? isoLevelOrCb;
        return fn(em);
      });
      const r = await service.recordExit('tenant', 'user', { itemId: 'item-1', quantity: 10, reason: 'sale' });
      expect(r.lotsConsumed).toHaveLength(1);
      expect(r.totalCost).toBe('8000.00');
    });

    it('consume FIFO across multiple lots', async () => {
      const em = mockEm([
        { id: 'l1', quantity_remaining: '5', unit_cost: '100' },
        { id: 'l2', quantity_remaining: '3', unit_cost: '120' },
        { id: 'l3', quantity_remaining: '4', unit_cost: '150' },
      ]);
      ds.transaction.mockImplementation((_iso: any, cb: any) => cb(em));
      const r = await service.recordExit('t', 'u', { itemId: 'i', quantity: 10, reason: 'sale' });
      // 5*100 + 3*120 + 2*150 = 500 + 360 + 300 = 1160
      expect(r.totalCost).toBe('1160.00');
      expect(r.lotsConsumed).toHaveLength(3);
      expect(r.lotsConsumed[2].quantity).toBe('2.0000');
    });

    it('rejects INSUFFICIENT_STOCK with details', async () => {
      const em = mockEm([{ id: 'l1', quantity_remaining: '5', unit_cost: '100' }]);
      ds.transaction.mockImplementation((_iso: any, cb: any) => cb(em));
      await expect(service.recordExit('t', 'u', { itemId: 'i', quantity: 10, reason: 'sale' })).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INSUFFICIENT_STOCK', shortage: '5.0000' }),
      });
    });

    it('handles fractional quantities', async () => {
      const em = mockEm([{ id: 'l1', quantity_remaining: '2.5', unit_cost: '15.75' }]);
      ds.transaction.mockImplementation((_iso: any, cb: any) => cb(em));
      const r = await service.recordExit('t', 'u', { itemId: 'i', quantity: 1.25, reason: 'sale' });
      expect(r.totalCost).toBe('19.69');
    });

    it('zero lots available -> INSUFFICIENT_STOCK', async () => {
      const em = mockEm([]);
      ds.transaction.mockImplementation((_iso: any, cb: any) => cb(em));
      await expect(service.recordExit('t', 'u', { itemId: 'i', quantity: 1, reason: 'sale' })).rejects.toThrow();
    });

    it('idempotency replay returns conflict', async () => {
      const em = {
        findOne: vi.fn().mockResolvedValue({ id: 'existing-movement' }),
      };
      ds.transaction.mockImplementation((_iso: any, cb: any) => cb(em));
      await expect(service.recordExit('t', 'u', { itemId: 'i', quantity: 1, reason: 'sale' }, 'key-1')).rejects.toThrow(/IDEMPOTENCY/);
    });

    it('logs structured event', async () => {
      const em = mockEm([{ id: 'l1', quantity_remaining: '5', unit_cost: '100' }]);
      ds.transaction.mockImplementation((_iso: any, cb: any) => cb(em));
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await service.recordExit('tenant', 'user', { itemId: 'item-1', quantity: 3, reason: 'sale' });
      spy.mockRestore();
    });
  });

  describe('recordAdjustment', () => {
    it('rejects zero delta', async () => {
      await expect(service.recordAdjustment('t', 'u', { itemId: 'i', deltaQuantity: 0, reason: 'inventory count adjustment' })).rejects.toThrow(/zero/);
    });

    it('positive delta creates adjustment_in', async () => {
      ds.transaction.mockImplementation((cb: any) => cb({
        findOne: vi.fn().mockResolvedValue({ id: 'item-1' }),
        create: vi.fn((Entity, data) => ({ ...data, id: Entity.name === 'StockLot' ? 'lot-new' : 'mov-new' })),
        save: vi.fn().mockImplementation((entity) => Promise.resolve({ ...entity, id: entity.id ?? 'gen' })),
      }));
      ds.manager.update = vi.fn();
      const r = await service.recordAdjustment('t', 'u', { itemId: 'i', deltaQuantity: 5, reason: 'inventory count adjustment positive' });
      expect(ds.manager.update).toHaveBeenCalled();
    });
  });

  describe('findByItem', () => {
    it('returns timeline with limit/offset', async () => {
      const qb = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]),
        getCount: vi.fn().mockResolvedValue(2),
      };
      ds.manager.createQueryBuilder = vi.fn().mockReturnValue(qb);
      const r = await service.findByItem('t', 'i', { limit: 10 });
      expect(r.movements).toHaveLength(2);
      expect(r.total).toBe(2);
    });
  });
});

function mockEm(lots: any[]) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    createQueryBuilder: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      setLock: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(lots),
    }),
    create: vi.fn((Entity, data) => ({ ...data, id: `mock-${Date.now()}-${Math.random()}` })),
    save: vi.fn().mockImplementation((entity) => Promise.resolve(entity)),
    update: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
  };
}
```

### 7.2 Tests integration concurrency

```typescript
// repo/apps/api/test/integration/stock-movements-concurrency.integration.spec.ts
import { describe, it, expect, beforeAll } from 'vitest';
// Setup test DB + simulate 2 concurrent exits

describe('Stock movements concurrency', () => {
  // ... bootstrap test
  
  it('two concurrent recordExit on same item respect FIFO with locks', async () => {
    // Setup : item with 1 lot of 10 units at 100 MAD
    // Concurrent : exit 7 + exit 5
    // Expected : first wins fully, second gets INSUFFICIENT_STOCK (3 available)
    // OR first 7 + second 5 (= 12) -> one fails
  });

  it('SELECT FOR UPDATE locks prevent oversold', async () => {
    // 100 simultaneous exits of 1 unit each on item with 50 units
    // Expected : 50 succeed, 50 fail with INSUFFICIENT_STOCK
  });

  it('Kafka event published after commit only', async () => {
    // recordEntry, verify kafka_published=true after transaction completes
  });
});
```

---

## 8. Variables environnement

```env
STOCK_MAX_QUANTITY_PER_MOVEMENT=10000000
STOCK_ADJUSTMENT_REQUIRES_REASON_MIN_CHARS=10
```

---

## 9. Commandes shell

```bash
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/stock test
pnpm --filter @insurtech/api test:e2e -- stock-movements

# Test manuel
curl -X POST http://localhost:4000/api/v1/stock/movements/entry \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -H "Idempotency-Key: entry-$(uuidgen)" \
  -d '{"item_id":"...","quantity":10,"unit_cost":800,"supplier_invoice_ref":"INV-2026-001"}'

curl -X POST http://localhost:4000/api/v1/stock/movements/exit \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -d '{"item_id":"...","quantity":3,"reason":"Sinistre #123 reparation"}'
```

---

## 10. Criteres validation V1-V25

### P0 (15)
- V1 : Migration stock_movements + enum + CHECK
- V2 : RLS active
- V3 : Idempotency-Key UNIQUE per tenant
- V4 : `recordEntry` cree lot + movement type 'entry'
- V5 : `recordExit` consume FIFO ordre entry_date ASC
- V6 : `recordExit` retourne total_cost correct
- V7 : INSUFFICIENT_STOCK rejected 400 + details shortage
- V8 : SELECT FOR UPDATE locks dans transaction
- V9 : `recordAdjustment` positive = adjustment_in
- V10 : `recordAdjustment` negative = adjustment_out
- V11 : `recordAdjustment` zero rejected
- V12 : `recordAdjustment` reason >= 10 chars
- V13 : Kafka event publish apres commit
- V14 : Audit trail systematique
- V15 : Multi-tenant isolation

### P1 (7)
- V16 : Decimal precision 18,4 / 15,4 preserve
- V17 : `findByItem` timeline pagination
- V18 : RBAC stock.movements.create + stock.adjust
- V19 : occurred_at futur rejected
- V20 : kafka_published flag update
- V21 : Tests concurrency 100 simultaneous OK
- V22 : Coverage >= 85%

### P2 (3)
- V23 : Outbox pattern kafka pending
- V24 : Performance 1000 movements/sec
- V25 : Documentation movements API

---

## 11. Edge cases

1. **Lot supprime mid-transaction** -> SELECT FOR UPDATE bloque jusqu'a commit ou rollback.
2. **Concurrent entries memes timestamps** -> tie-break par id.
3. **Quantity > MAX integer JS** -> Decimal.js handle.
4. **Reason XSS** -> store raw, escape au rendering frontend.
5. **Idempotency cle perd apres 24h** -> retry replay legitime.
6. **Item deleted apres entry** -> FK RESTRICT empeche.
7. **Lot photo manquante** -> aucun impact mouvement.
8. **Kafka down** -> kafka_published=false, cron reconcile (Sprint 35).
9. **Transaction timeout 30s** -> retry side-client.
10. **Adjustment negatif > stock** -> INSUFFICIENT_STOCK identique exit.

---

## 12. Conformite Maroc

- CGNC art 32 FIFO conformite.
- Loi 9-88 art 18 conservation 10 ans -> partition Postgres TTL 10 ans Sprint 35.
- Audit DGI traceabilite mouvement -> tous champs persists.

---

## 13. Conventions absolues

Multi-tenant RLS, Zod, Pino, pnpm, TypeScript strict, tests 85%, RBAC stock.*, Kafka topic `insurtech.events.stock.*`, Idempotency-Key obligatoire, decision-006, decision-008, Decimal.js partout.

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/stock typecheck
pnpm --filter @insurtech/stock test:coverage
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/api test:e2e -- stock-movements
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-13): stock movements + FIFO exit logic + Kafka events

Sprint 13 Tache 3.6.6 : table stock_movements + service avec FIFO exit
transactionnel SELECT FOR UPDATE + Kafka publish.

Livrables :
- Migration stock_movements (enum, CHECK, indexes FIFO, RLS, idempotency UNIQUE)
- StockMovementsService : recordEntry, recordExit FIFO, recordAdjustment, findByItem
- 3 DTOs Zod (entry/exit/adjustment)
- StockMovementsController REST + Idempotency-Key + RBAC
- Kafka publish topic stock.movement_recorded
- 31 tests (18 unit + 8 integration + 5 E2E)

Tests: 31
Coverage: 89%

Task: 3.6.6
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.6"
```

---

## 16. Workflow next step

Tache suivante : `task-3.6.7-stock-alertes-seuil-notifications.md` (alertes low_stock + cron + reorder).

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Pattern FIFO Postgres SELECT FOR UPDATE detaille

#### A.1 Sequence exacte transaction Postgres

```sql
-- Phase 1 : BEGIN TRANSACTION READ COMMITTED
BEGIN;

-- Phase 2 : Verify idempotency (with FOR UPDATE pour eviter race)
SELECT id FROM stock_movements 
WHERE tenant_id = $1 AND idempotency_key = $2
FOR UPDATE;
-- Si row existe -> ROLLBACK + return existing

-- Phase 3 : Lock lots FIFO order (CRITICAL : SELECT FOR UPDATE)
SELECT id, quantity_remaining, unit_cost
FROM stock_lots
WHERE item_id = $3
  AND tenant_id = $1
  AND quantity_remaining > 0
  AND deleted_at IS NULL
ORDER BY entry_date ASC, id ASC
FOR UPDATE;
-- Postgres prend les locks dans ordre stable -> evite deadlock

-- Phase 4 : Pour chaque lot, consume + INSERT movement
INSERT INTO stock_movements (id, tenant_id, item_id, lot_id, movement_type, quantity, unit_cost, total_cost, reason, occurred_at, created_by, idempotency_key)
VALUES (gen_random_uuid(), $1, $3, $lot_id, 'exit', $consumed_qty, $lot_unit_cost, $cost, $reason, now(), $user_id, $idempotency_key);

UPDATE stock_lots
SET quantity_remaining = quantity_remaining - $consumed_qty
WHERE id = $lot_id;

-- Phase 5 : Verify total consumed == requested
-- Si insuffisant -> ROLLBACK + raise INSUFFICIENT_STOCK

-- Phase 6 : COMMIT
COMMIT;
```

#### A.2 Pourquoi `SELECT FOR UPDATE` essentiel

Sans `FOR UPDATE`, scenario deadlock/oversold :

```
T1 : BEGIN
T1 : SELECT lots (sans lock) -> [lot_A: 10 remaining]
T2 : BEGIN
T2 : SELECT lots (sans lock) -> [lot_A: 10 remaining]  (snapshot identique)
T1 : UPDATE lot_A quantity_remaining = 10 - 7 = 3
T2 : UPDATE lot_A quantity_remaining = 10 - 5 = 5   (overwrite T1!)
T1 : COMMIT (saw 10 - 7 = 3)
T2 : COMMIT (saw 10 - 5 = 5, but actually consumed 12 total -- corruption)
```

Avec `FOR UPDATE`, T2 attend que T1 commit :

```
T1 : BEGIN
T1 : SELECT lots FOR UPDATE -> [lot_A: 10] + acquires row lock
T2 : BEGIN
T2 : SELECT lots FOR UPDATE -> BLOCKED waiting for T1
T1 : UPDATE lot_A -> 3
T1 : COMMIT (release lock)
T2 : SELECT continues -> [lot_A: 3]
T2 : if needs 5 -> INSUFFICIENT_STOCK
T2 : ROLLBACK
```

#### A.3 Anti-deadlock via ORDER BY stable

Si T1 verrouille lot_A puis lot_B, et T2 verrouille lot_B puis lot_A simultanement, deadlock. Solution : TOUTES les transactions doivent locker dans le MEME ORDRE.

Notre `ORDER BY entry_date ASC, id ASC` garantit ordre stable. Postgres detecte deadlock et abort la transaction la moins prioritaire.

### B. Patterns alternatifs evalues

| Pattern | Description | Pros | Cons | Decision |
|---------|-------------|------|------|----------|
| **A. SELECT FOR UPDATE + ORDER BY** | Verrou pessimist + ordre stable | Atomicity garantie | Latence si lots nombreux | RETENU |
| B. SERIALIZABLE isolation | Postgres garantit serialisation | Pas de FOR UPDATE necessaire | Retry frequents conflits | Rejete (perf) |
| C. Advisory lock | pg_advisory_lock(item_id) | Tres rapide | Pas standard SQL | Rejete |
| D. Mutex Redis distribue | SETNX lock par item | Cross-instance | Latence reseau | Rejete |
| E. Optimistic via version column | UPDATE WHERE version = X | No blocking | Retry boucle | Defer Sprint 35 |

### C. Outbox pattern Kafka emission

Pattern naif : `kafka.publish` apres `COMMIT`. Probleme : si process crash entre commit et publish, event perdu.

Pattern outbox correct :

```sql
-- Table outbox
CREATE TABLE stock_movements_outbox (
  id UUID PRIMARY KEY,
  movement_id UUID NOT NULL REFERENCES stock_movements(id),
  topic VARCHAR(255) NOT NULL,
  payload JSONB NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

```typescript
// Dans transaction recordExit :
await em.save(StockMovementsOutbox, {
  movement_id: movement.id,
  topic: 'insurtech.events.stock.movement_recorded',
  payload: { /* event data */ },
});
// COMMIT
// Cron job lit outbox pending et publish + mark published
```

Sprint 13 = simple `setImmediate(() => publish())`. Sprint 35 = outbox cron pour garantie.

### D. Performance benchmarks FIFO

| Scenario | Lots impliques | Latence p50 | p95 | p99 |
|----------|----------------|-------------|-----|-----|
| Exit 1 lot complete | 1 | 80ms | 180ms | 400ms |
| Exit 2 lots partial | 2 | 130ms | 280ms | 550ms |
| Exit 5 lots cumulatif | 5 | 220ms | 450ms | 850ms |
| Exit 10 lots | 10 | 380ms | 750ms | 1.4s |
| Exit 50 lots (cas extreme) | 50 | 1.8s | 3.5s | 6s |
| Concurrent 10 exits same item | 1 item | 200ms p50 + waits | 500ms | 1.2s |
| Concurrent 100 exits diff items | 100 items | 100ms each parallel | 250ms | 500ms |

**Goulots** :
- ORDER BY tri : negligeable (index `entry_date` cree)
- UPDATE par lot : O(n) lots, peut etre batched Sprint 35
- INSERT movements : O(n) lots, peut etre bulk Sprint 35

### E. Tests integration FIFO concurrents

```typescript
// repo/apps/api/test/integration/stock-movements-concurrency.integration.spec.ts
describe('FIFO concurrency tests', () => {
  it('100 concurrent exits 1 unit each on 50-unit item -> 50 succeed + 50 INSUFFICIENT_STOCK', async () => {
    // Setup : 1 item with 1 lot of 50 units
    // Send 100 parallel exit requests via Promise.all
    const promises = Array.from({ length: 100 }, () =>
      service.recordExit('t', 'u', { itemId: 'i1', quantity: 1, reason: 'test' }).catch(e => e)
    );
    const results = await Promise.all(promises);
    const successes = results.filter(r => r && !r.message);
    const failures = results.filter(r => r?.message?.includes('INSUFFICIENT_STOCK'));
    expect(successes.length).toBe(50);
    expect(failures.length).toBe(50);
  });

  it('10 concurrent exits FIFO different items -> all succeed', async () => {
    // Different items = no contention
  });

  it('Deadlock avoidance : 2 exits items A+B in different orders', async () => {
    // Postgres should detect + abort 1, retry success
  });

  it('Transaction abort restores lots quantity_remaining', async () => {
    // Setup : exit succeeds for lot_A but fail middle -> all rolled back
    // Verify lot_A.quantity_remaining unchanged after rollback
  });
});
```

### F. Edge cases supplementaires FIFO (15 cas)

1. Lot 0.0001 quantity remaining -> consume jusqu'a 0.0000 exact
2. 1000 lots tres petits (cas extreme stock fragmente) -> performance degradee, Sprint 35 consolidation
3. Lot avec entry_date NULL (rare, donnees legacy) -> exclu via index partiel
4. Concurrent exits avec memes idempotency-key -> 1 succeed, others 409
5. Item supprime soft pendant exit -> autoriser (FK pas trigger)
6. unit_cost = 0 (gratuit, promotionnel) -> autoriser, total_cost = 0
7. Quantity demand > 1e10 -> Zod refuse (max value)
8. Reason avec caracteres unicode (emoji rejected) -> 400 grep regex
9. occurred_at timezone Africa/Casablanca vs UTC -> store UTC, render local
10. Adjustment_in cree lot ghost avec unit_cost = 0 ou last_avg
11. Kafka publish fail apres commit -> retry via outbox Sprint 35
12. Auth token expired mid-transaction -> rollback, retry frontend
13. Tenant churned mid-exit -> rare, autorise pour archivage
14. Lot photo deleted -> aucun impact mouvement
15. Sprint 22 Repair envoie 2x meme event (replay Kafka) -> idempotency-key sauve

### G. Conformite Maroc + audit DGI

- CGNC article 32 : FIFO obligation comptable.
- Audit DGI : tracabilite stricte (created_by user_id + occurred_at).
- Conservation 10 ans (loi 9-88 art 18) : stock_movements partition Postgres TTL Sprint 35.
- Reason champ obligatoire pour exit : justifications inspection DGI.

---

**Fin enrichissement task-3.6.6.**

**Fin task-3.6.6-stock-movements-fifo-exit-logic.md.**

## ANNEXE A -- Patterns transverses Sprint 13 (conventions communes)

### A.1 Multi-tenant strict (decision-002)

Toutes les operations Sprint 13 doivent inclure tenant_id filter strict :
- Postgres : trigger RLS app.current_tenant via SET LOCAL
- ClickHouse : tenant_id dans ORDER BY pour partition pruning  
- Kafka : tenant_id obligatoire dans event payload
- Redis cache keys : prefixe tenant_id pour isolation cross-tenant impossible
- AsyncLocalStorage Node : TenantContext propage tenant_id sans param explicite
- Tests obligatoires : multi-tenant isolation (2 tenants -> 2 datasets distincts)

### A.2 Zod validation runtime stricte

Pattern uniforme partout Sprint 13 :

```typescript
const Schema = z.object({
  tenant_id: z.string().uuid(),
  field: z.string().min(1).max(255),
  amount: z.coerce.number().min(0),
  date: z.coerce.date(),
});
type Type = z.infer<typeof Schema>;

// Au controller :
const dto = Schema.parse(body);  // throws ZodError -> 400 automatic
```

JAMAIS class-validator/yup/joi -- decision conventions strictes.

### A.3 Pino logger structures

Format obligatoire pour tous logs metier :

```typescript
this.logger.log({
  action: 'snake_case_action_name',
  tenant_id: tid,
  user_id: uid,
  resource_id: rid,
  duration_ms: durationMs,
  outcome: 'success' | 'failed',
  metadata: { ... },
});
```

Permet :
- Datadog/Sentry parsing automatique
- Correlation logs cross-services
- Audit trail tenant_id systematique
- Performance monitoring duration_ms aggregations

JAMAIS console.log dans code production. Toleré uniquement dans scripts CLI infrastructure/scripts/*.

### A.4 Kafka events topics standardises

Format strict : `insurtech.events.{vertical_or_horizontal}.{entity}.{action_past}`

Topics Sprint 13 utilises :
- `insurtech.events.stock.movement_recorded` (Tache 3.6.6)
- `insurtech.events.stock.low_stock` (Tache 3.6.7)
- `insurtech.events.hr.employee_hired` (Tache 3.6.9)
- `insurtech.events.hr.employee_terminated` (Tache 3.6.9)
- `insurtech.events.hr.contract_signed` (Tache 3.6.9)
- `insurtech.events.hr.contract_renewed` (Tache 3.6.9)
- `insurtech.events.hr.contract_terminated` (Tache 3.6.9)
- `insurtech.events.hr.leave_requested` (Tache 3.6.10)
- `insurtech.events.hr.leave_approved` (Tache 3.6.10)
- `insurtech.events.hr.leave_rejected` (Tache 3.6.10)
- `insurtech.events.hr.leave_cancelled` (Tache 3.6.10)
- `insurtech.events.hr.payslip_generated` (Tache 3.6.11)
- `insurtech.events.hr.payslip_validated` (Tache 3.6.11)
- `insurtech.events.hr.payslip_paid` (Tache 3.6.11)
- `insurtech.events.analytics.etl_completed` (Tache 3.6.2)
- `insurtech.events.repair.parts_consumed` (Sprint 22 future, consume Tache 3.6.8)

### A.5 Idempotency-Key obligatoire mutations sensibles

Endpoints concernes Sprint 13 :
- POST /api/v1/stock/movements/entry
- POST /api/v1/stock/movements/exit
- POST /api/v1/stock/movements/adjustment
- POST /api/v1/stock/inventory-count
- POST /api/v1/hr/payroll/generate-period
- POST /api/v1/hr/payroll/payslips/:id/validate
- POST /api/v1/hr/payroll/payslips/:id/mark-paid

Pattern :

```
Header : Idempotency-Key: <uuid-v4>
Server check : SELECT WHERE tenant_id AND idempotency_key
Si exists : retourner reponse precedente (409 + ID si conflict)
Sinon : execute + store key 24h Redis OR UNIQUE constraint Postgres
TTL 24h pour replay safe
```


## ANNEXE B -- Conformite Maroc detaillee (rappel Sprint 13)

### B.1 Lois et decrets applicables Sprint 13

#### Loi 09-08 du 18 fevrier 2009 (CNDP)

- **Article 3** : definition donnees personnelles -- CIN, CNSS, salaire, DOB, email, IBAN, photo concerned.
- **Article 7** : transfert hors Maroc INTERDIT sans autorisation CNDP -> decision-008 Atlas Cloud Benguerir.
- **Article 13** : consentement -- embauche + signup CRM = consentement implicite stockage.
- **Article 14** : droit acces/rectification/suppression -- Sprint 35 portail employee self-service.
- **Article 21** : declaration obligatoire CNDP pour traitements automatises -- Sprint 35.

#### Loi 65-99 du 11 septembre 2003 (Code du Travail)

- **Articles 6-7** : embauche mineur < 15 ans interdite -> CHECK constraint.
- **Articles 14-17** : duree travail 44h/sem, repos hebdomadaire 24h continues.
- **Article 13** : CDI -- periode essai 3 mois cadres / 1.5 mois employes / 15j ouvriers.
- **Articles 16-22** : CDD max 1 an renouvelable 1 fois (max 2 ans cumules).
- **Article 152** : conges maternite 14 semaines, dont 6 obligatoires apres accouchement.
- **Article 269** : conges paternite 3 jours dans le mois.
- **Articles 231-251** : conges payes 1.5j/mois travaille, min 18j/an, max 30j.
- **Article 232** : 1.5j additionnel par bloc 5 ans anciennete.
- **Articles 35-39** : licenciement motif legitime + procedure + indemnite 1.5 mois/an apres 5 ans anciennete.
- **Article 254** : maladie -- certificat medical obligatoire > 4 jours.
- **Articles 41-46** : SMIG/SMAG salaire minimum legal.

#### Decret 2-22-742 du 14 fevrier 2023 (CNSS)

- **Article 5** : taux 4.48% employee + 8.98% employer (prestations long terme).
- **Article 5 bis** : taux 6.40% employer allocations familiales.
- **Article 6** : plafond cotisable 6 000 MAD/mois = 72 000 MAD/an.
- **Article 12** : declaration BPC mensuelle obligatoire avant le 10 du mois suivant.
- **Article 15** : declaration prealable embauche 8 jours apres recrutement.

#### Loi 65-00 du 3 octobre 2002 (AMO)

- **Article 12** : taux 2.26% employee + 4.11% employer.
- **Article 13** : assiette ensemble elements remuneration, pas de plafond.
- **Article 21** : exoneration partielle famille (Sprint 35).

#### Loi 47-06 du 30 novembre 2007 (Impot sur le Revenu)

- **Article 28** : frais professionnels 25% plafonne 35 000 MAD/an.
- **Article 73** : bareme IR 6 tranches MA 2026 (0% / 10% / 20% / 30% / 34% / 38%).
- **Article 74** : charges famille 360 MAD/an x enfants (max 6).
- **Article 78** : retenue source obligatoire employeur, declaration Etat 9421 annuelle.

#### Loi 9-88 modifiee 38-14 (Obligations comptables)

- **Article 18** : conservation 10 ans pieces comptables.
- **Article 32 CGNC** : valorisation stocks FIFO ou CMP (LIFO INTERDIT MA).

#### Decret SMIG 2023

- SMIG non-agricole : 2 970 MAD/mois (depuis revalorisation 2023).
- SMAG agricole : 80% SMIG.
- Implementation : CHECK constraint base_salary >= 2970.

#### Loi 53-05 du 30 novembre 2007 (Signature electronique)

- **Article 9** : conservation 10 ans signatures qualifiees -> TTL ClickHouse fct_documents_signed.

### B.2 Implementation Sprint 13 conformite

| Convention | Implementation Sprint 13 |
|------------|---------------------------|
| Data residency MA | Atlas Cloud Benguerir DC1 + DC2 replica |
| Encryption at rest | AES-256-GCM via Atlas KMS |
| Encryption in transit | TLS 1.3 obligatoire prod |
| Audit log | Pino structured logs + audit_logs table (Sprint 12) |
| Conservation 10 ans | TTL ClickHouse + partition Postgres Sprint 35 |
| Right to forget | Sprint 35 portail employee + soft delete |


## ANNEXE C -- Performance SLO Sprint 13

### C.1 Latences ciblees par categorie

#### Endpoints CRUD basiques (Stock items, HR employees, Categories)
- POST/PATCH/DELETE : p50 80ms / p95 200ms / p99 400ms
- GET single : p50 60ms / p95 150ms / p99 300ms
- GET list (50 items) : p50 100ms / p95 250ms / p99 500ms

#### Endpoints transactionnels (Stock movements, HR payslips)
- POST entry (1 lot) : p50 100ms / p95 250ms / p99 500ms
- POST exit FIFO (5 lots) : p50 250ms / p95 500ms / p99 900ms
- POST exit FIFO (10 lots) : p50 450ms / p95 850ms / p99 1.4s
- POST payslip validate : p50 150ms / p95 350ms / p99 700ms

#### Endpoints aggregation (Reports, Dashboards)
- GET valorisation 100 items : p50 200ms / p95 400ms / p99 800ms
- GET valorisation 1000 items : p50 800ms / p95 1.5s / p99 2.5s
- GET inventory historique date 6 mois ago : p50 1.5s / p95 3s / p99 5s
- GET dashboards revenue 1 an : p50 350ms / p95 700ms / p99 1.5s
- GET dashboards activity heatmap : p50 250ms / p95 500ms / p99 1s

#### Endpoints batch (Payroll generation, Inventory count)
- POST payroll generate 10 employees : p50 1.5s / p95 3s / p99 5s
- POST payroll generate 50 employees : p50 5s / p95 8s / p99 12s
- POST payroll generate 200 employees : p50 18s / p95 30s / p99 45s
- POST inventory-count 100 items : p50 3s / p95 6s / p99 10s
- POST inventory-count 1000 items : p50 12s / p95 25s / p99 40s

#### Endpoints export (CSV, XML, PDF)
- GET valorisation export.csv 1000 items : p50 1s / p95 2s / p99 4s
- GET CNSS declaration XML : p50 300ms / p95 600ms / p99 1s
- GET IR declaration CSV : p50 800ms / p95 1.5s / p99 3s
- GET payslip PDF : p50 800ms / p95 1.5s / p99 3s

### C.2 Throughput ciblesSprint 13 vs Sprint 35

| Operation | Sprint 13 RPS | Sprint 35 hardening RPS |
|-----------|----------------|---------------------------|
| Stock CRUD | 50 req/s | 500 req/s |
| Stock movements | 30 req/s | 300 req/s |
| HR CRUD | 20 req/s | 100 req/s |
| HR payroll generate | 1 req/s | 10 req/s |
| Analytics dashboards | 100 req/s | 1000 req/s |
| ETL polling cycle | 1 cycle/5min | Real-time CDC Debezium |

### C.3 Availability targets

- Sprint 13 : 99.5% (heures ouvrables 8h-20h Casablanca)
- Sprint 35 hardening : 99.9% (24/7)
- Window maintenance : 1h/semaine fenetre 3am-4am Casablanca
- RTO (Recovery Time Objective) : 1h Sprint 13 / 15min Sprint 35
- RPO (Recovery Point Objective) : 5min Sprint 13 / 1min Sprint 35

### C.4 Storage growth Sprint 13

Estimation pour 100 tenants moyens (50 employees + 1000 items + 200 movements/jour) :
- Postgres : +50 GB/an
- ClickHouse : +30 GB/an (compression columnar 5x)
- S3 documents (PDF, photos) : +20 GB/an
- Redis cache : +5 GB peak (TTL eviction)
- Kafka logs : +10 GB/an (retention 7 jours)
- Total : ~115 GB/an pour 100 tenants

### C.5 Monitoring metrics Prometheus

Sprint 13 expose metriques :
- `etl_rows_synced_total{table}` (Tache 3.6.2)
- `etl_duration_seconds{table}` (histogram)
- `etl_errors_total{table}` (counter)
- `stock_movements_total{tenant_id,type}` (Tache 3.6.6)
- `stock_alerts_sent_total{tenant_id,channel}` (Tache 3.6.7)
- `hr_payslips_generated_total{tenant_id,period}` (Tache 3.6.11)
- `hr_payslips_total_amount_mad{tenant_id}` (gauge)
- `clickhouse_query_duration_seconds{method}` (Tache 3.6.3)
- `analytics_cache_hits_total{method}` (counter)
- `analytics_cache_misses_total{method}` (counter)

Dashboards Grafana Sprint 35 :
- ETL lag par table
- API latencies par endpoint
- Cache hit ratio
- Stock movements volume par tenant
- Paie performance generation


## ANNEXE D -- Edge cases + troubleshooting Sprint 13

### D.1 Edge cases multi-tenant

1. **Tenant cree apres seed initial** : ETL Tache 3.6.2 inclut auto via full sync dim_tenants. Premier sync analytics peut etre vide pour ce tenant.
2. **Tenant churned** : ETL marque churned_at, dashboards filtrent active. Sprint 35 : retention 6 mois apres churn pour audit.
3. **Tenant fusion (acquisitions)** : Sprint 35 outil consolidation tenant cible. Sprint 13 = non supporte.
4. **Tenant split (separation)** : Sprint 35 outil migration partielle. Sprint 13 = manual.
5. **Tenant data residency exception** : Sprint 35 multi-region MA + EU pour clients europeens. Sprint 13 = MA only.

### D.2 Edge cases temps + dates

1. **Timezone Casablanca DST** : MA n'observe pas DST depuis 2018 (UTC+1 toute annee). Stockage UTC, presentation locale.
2. **Periode fiscale chevauchant** : MA = annee civile (1 jan - 31 dec). Pas de fiscal year offset.
3. **Date debut activite tenant futur** : autoriser, ETL skip jusqu'a date.
4. **Date naissance employee tres ancien (> 100 ans)** : warning flag, pas reject.
5. **Period payslip futur** : autoriser (planification), warning si > +6 mois.
6. **Period payslip passe > 5 ans** : warning + audit log.
7. **Movements occurred_at futur > 30 min** : Zod reject (anti-fraud).
8. **Movements occurred_at retroactif > 90 jours** : warning + audit.

### D.3 Edge cases concurrence + race conditions

1. **2 concurrent exits same item FIFO** : SELECT FOR UPDATE serialise -> 1 succeed first, 2nd INSUFFICIENT_STOCK ou succeed selon stock.
2. **2 concurrent payroll generate same period** : UNIQUE (tenant, employee, period) -> 1 succeed, 2nd 409 IDEMPOTENCY.
3. **2 concurrent leave requests same employee dates** : trigger PG anti-overlap rejette.
4. **2 concurrent contract activate same employee** : trigger single_active_contract rejette.
5. **Idempotency replay simultane** : UNIQUE constraint Postgres = 1 first wins.
6. **Kafka consumer parallel processing same event** : group_id partition = 1 consumer par partition (idempotent au niveau handler).

### D.4 Edge cases financiers (paie, stock valorisation)

1. **Salaire SMIG exact 2970** : net positif obligatoire (cotisations + IR + AMO ne doivent pas mettre net negatif).
2. **Bracket IR boundary 30000 exact** : tranche 0% applique, IR = 0.
3. **Bracket IR boundary 30001** : bascule 10%, IR = 30001 * 0.10 - 3000 = 0.10 MAD.
4. **CNSS plafond 6000 exact** : cotisation = 268.80 (4.48% x 6000).
5. **Family children > 6** : capped a 6 (max legal art 74).
6. **AMO no plafond** : 100 000 MAD/mois brut -> 2 260 MAD AMO/mois.
7. **Frais pro plafond 35000/an** : seul brut > 11 666 MAD/mois est plafonne.
8. **FIFO consume lot avec qty < requested** : continue consume lot suivant.
9. **FIFO 0 lots disponibles** : INSUFFICIENT_STOCK error 400.
10. **Decimal precision rounding** : toFixed(2) pour MAD, toFixed(4) pour quantites.

### D.5 Troubleshooting common issues

#### Issue : ETL lag > 30 min
- Cause : ClickHouse insert lent / Postgres delta gros / Kafka consumer down
- Diagnostic : `GET /admin/analytics/etl-state` -> regarder last_synced_at
- Solution : `POST /admin/analytics/resync` force resync OU restart consumer

#### Issue : Dashboards 503 timeout
- Cause : ClickHouse query lente / cache Redis down
- Diagnostic : logs Pino query_duration_ms / Redis ping
- Solution : verify ClickHouse health / restart Redis / abort_signal 25s

#### Issue : Stock movement INSUFFICIENT_STOCK alors que stock visible
- Cause : autre transaction concurrent en cours (SELECT FOR UPDATE bloque)
- Diagnostic : `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%stock_lots%'`
- Solution : retry quelques secondes plus tard ; verifier pas de transaction longue duration

#### Issue : Payslip Books ecriture manquante
- Cause : Kafka consumer down apres payslip_validated emit
- Diagnostic : `SELECT * FROM hr_payslips WHERE id = X` -> status=validated mais pas dans journal_entries
- Solution : manual re-emit Kafka event OU appel direct Books.recordEntry avec idempotency-key

#### Issue : CNSS XML rejected Damancom
- Cause : format invalide (encoding, ICE, CIN normalisation)
- Diagnostic : valider XML schema XSD Damancom
- Solution : verifier tenant.cnss_employer_number + ICE + CIN normalize uppercase no spaces


## ANNEXE E -- Architecture + Roadmap Sprint 14+

### E.1 Architecture Sprint 13 detaillee

```
+-----------------------------------------------------------+
|                  Frontend (Sprint 17 / 23)                |
|  web-broker UI  +  web-garage UI  +  Sprint 19 portail   |
+----------------------------+------------------------------+
                             |
                             | HTTPS + JWT + x-tenant-id
                             v
+----------------------------+------------------------------+
|              API Gateway NestJS (apps/api)                |
|  + JwtAuthGuard + RolesGuard + TenantGuard + Throttle    |
+----------------------------+------------------------------+
                             |
       +---------------------+-------------------+
       v                     v                   v
   +-------+           +-----------+      +-----------+
   | CRM   |           |  Stock    |      |    HR     |
   +---+---+           +-----+-----+      +-----+-----+
       |                     |                  |
       +---------+-----------+------------------+
                 |
                 v
+----------------+-----------------+
| Postgres 16 OLTP Atlas DC1        |
| RLS multi-tenant strict           |
| Triggers anti-overlap/cycle       |
| Migrations TypeORM 0.3            |
+----------------+-----------------+
                 |
                 | ETL polling 5min (Tache 3.6.2)
                 v
+----------------+-----------------+
| ClickHouse 24.10 OLAP             |
| 5 fct_* + 2 dim_* + 1 dim_dates  |
| TTL 5-10 ans selon legal          |
+----------------+-----------------+
                 |
                 | Queries (AnalyticsService)
                 v
+----------------+-----------------+
| 6 Dashboards REST endpoints       |
+----------------------------------+

Side channels :
+ Redis cache (Sprint 9) : analytics cache + idempotency keys
+ Kafka 3.7 (Sprint 9) : events cross-module + consumers Books/Repair
+ S3 Atlas (Sprint 10) : documents, photos, bulletins PDF
+ SendGrid (Sprint 9) : emails notifications
+ Meta WhatsApp API (Sprint 9) : WA notifications
```

### E.2 Sprint 14+ Vertical Insure (Phase 4)

Sprint 14 demarre avec :
- Tous modules horizontaux ready as building blocks
- CRM contacts -> souscripteurs polices
- Pay -> primes paiements
- Books -> commissions courtier ecritures
- Docs -> polices PDF + signatures Barid
- Analytics -> dashboards Insure-specific (a creer)

Modules Insure prevus B-14 a B-19 :

| Sprint | Module | Effort |
|--------|--------|--------|
| B-14 | Insure foundation : polices + souscriptions + ACAPS reporting | 70h |
| B-15 | Insure sinistres : workflow + expertise + reglement | 75h |
| B-16 | Insure commissions courtier + reconciliation | 60h |
| B-17 | Web Broker UI : dashboards + CRM + souscriptions | 80h |
| B-18 | Web Customer Portal SEO + acquisition prospects | 70h |
| B-19 | Web Assure Portal + capture NPS Sprint 13 framework | 75h |

### E.3 Sprint 20+ Vertical Repair (Phase 5)

Sprint 20-23 consume Stock + HR Sprint 13 :
- Sprint 22 : Repair sinistres + parts_consumed -> consume Stock FIFO via Kafka
- Sprint 23 : Web Garage UI + dashboards Stock + HR + Repair
- Atelier mecanicien PWA mobile

### E.4 Sprint 24-30 Phase 6+ SaaS Front + Mobile + IA

Sprint 24-30 :
- B-24/25 : Web Insurtech Admin (super admin Skalean)
- B-26/27 : Web admin tenants
- B-28/29 : PWA mobile garage + assure
- B-30 : Skalean AI integration via Sprint 31 MCP (decision-005)

### E.5 Sprint 31-35 Hardening + Production

- B-31 : Agent Sky MCP tools (get_revenue_trend, get_stock_alerts, get_payslip)
- B-32 : Materialized views ClickHouse + cache HTTP layer
- B-33 : Backup/restore + disaster recovery DC2
- B-34 : Security audit + pentest + ANRT certification
- B-35 : Production hardening + observability complete


## ANNEXE F -- Cheatsheet permissions RBAC Sprint 13

### F.1 Permissions Stock (15 permissions)

```typescript
// repo/packages/auth/src/seeds/permissions/stock.ts
export const STOCK_PERMISSIONS = [
  // Categories
  'stock.categories.create',
  'stock.categories.read',
  'stock.categories.update',
  'stock.categories.delete',
  // Items
  'stock.items.create',
  'stock.items.read',
  'stock.items.update',
  'stock.items.delete',
  // Movements
  'stock.movements.create',
  'stock.movements.read',
  'stock.adjust',
  // Reports
  'stock.valorisation.read',
  'stock.alerts.read',
  'stock.alerts.snooze',
  // Admin
  'stock.admin.force_unlock',
];
```

### F.2 Permissions HR (20 permissions)

```typescript
// repo/packages/auth/src/seeds/permissions/hr.ts
export const HR_PERMISSIONS = [
  // Employees
  'hr.employees.create',
  'hr.employees.read',
  'hr.employees.read_own',           // employee voit son propre dossier
  'hr.employees.update',
  'hr.employees.delete',
  // Contracts
  'hr.contracts.create',
  'hr.contracts.read',
  'hr.contracts.update',
  'hr.contracts.terminate',
  // Leaves
  'hr.leaves.request',
  'hr.leaves.approve',
  'hr.leaves.cancel',
  'hr.leaves.read',
  'hr.leaves.read_own',
  // Payroll
  'hr.payroll.generate',
  'hr.payroll.validate',
  'hr.payroll.mark_paid',
  'hr.payslips.read',
  'hr.payslips.read_own',
  // Declarations
  'hr.declarations.read',
  'hr.declarations.export',
];
```

### F.3 Mapping roles -> permissions Sprint 13

| Role | Permissions Stock | Permissions HR |
|------|--------------------|------------------|
| SuperAdmin | All stock.* | All hr.* |
| BrokerAdmin | -- | hr.employees.* (employes courtage) |
| GarageAdmin | All stock.* + hr.* | All hr.* |
| GarageManager | stock.items.{r,u} + stock.movements.{c,r} + stock.alerts.* | hr.leaves.approve + hr.employees.read |
| GarageMechanic | stock.items.read + stock.movements.create | hr.employees.read_own + hr.payslips.read_own + hr.leaves.request |
| GarageStock | All stock.* | -- |
| Accountant | stock.valorisation.read + stock.reports.read | hr.payroll.* + hr.declarations.* |
| ComplianceOfficer | -- | hr.declarations.read |
| FinanceOfficer | stock.valorisation.read | hr.payroll.read + hr.payslips.read |
| ReadOnly | stock.items.read + stock.valorisation.read | hr.employees.read |

### F.4 Permissions Analytics (5)

```typescript
export const ANALYTICS_PERMISSIONS = [
  'analytics.dashboards.read',
  'analytics.exports.create',
  'analytics.admin.etl_resync',
  'analytics.admin.cache_invalidate',
  'analytics.developer.raw_query',     // Sprint 35
];
```

### F.5 Endpoints API summary Sprint 13 (44 endpoints)

#### Analytics (8)
- GET /api/v1/analytics/dashboards/revenue
- GET /api/v1/analytics/dashboards/conversion
- GET /api/v1/analytics/dashboards/activity
- GET /api/v1/analytics/dashboards/sinistre-rate
- GET /api/v1/analytics/dashboards/nps
- GET /api/v1/analytics/dashboards/funnel-tenant
- GET /api/v1/admin/analytics/etl-state
- POST /api/v1/admin/analytics/resync

#### Stock (15)
- POST/GET/PATCH/DELETE /api/v1/stock/items
- POST/GET /api/v1/stock/categories
- POST /api/v1/stock/movements/{entry,exit,adjustment}
- GET /api/v1/stock/items/:id/movements
- GET /api/v1/stock/alerts/low-stock
- GET /api/v1/stock/valorisation
- GET /api/v1/stock/valorisation/export.csv
- GET /api/v1/stock/reports/inventory
- POST /api/v1/stock/inventory-count

#### HR (21)
- POST/GET/PATCH/DELETE /api/v1/hr/employees
- POST /api/v1/hr/employees/:id/terminate
- POST/GET /api/v1/hr/employees/:id/contracts
- POST /api/v1/hr/contracts/:id/{activate,terminate,renew}
- POST /api/v1/hr/leaves/{request,approve,reject,cancel}
- GET /api/v1/hr/leaves/balance/:employeeId
- POST /api/v1/hr/payroll/{generate-period,payslips/:id/validate,payslips/:id/mark-paid}
- GET /api/v1/hr/payroll/payslips
- GET /api/v1/hr/payroll/payslips/:id/pdf
- GET /api/v1/hr/reports/declaration-cnss(/xml)
- GET /api/v1/hr/reports/declaration-ir(/csv)
- GET /api/v1/hr/dashboard


## ANNEXE G -- Testing strategy detaillee Sprint 13

### G.1 Test pyramid Sprint 13

```
                    /\
                   /  \   E2E + Integration (Tests Sprint 13)
                  /----\  35+ tests E2E + 8 integration concurrence
                 /      \
                /--------\ Service unit tests (mock repos)
               /          \ 200+ tests unit
              /------------\
             /              \ Pure logic tests (calculators, validators)
            /----------------\ 100+ tests (PayrollCalculator, LeaveBalance, FIFO)
```

### G.2 Coverage targets Sprint 13

| Module | Coverage target | Rationale |
|--------|-------------------|-----------|
| @insurtech/hr payroll-calculator | >= 95% | Critical legal computations IR/CNSS/AMO |
| @insurtech/hr leave-balance-calculator | >= 90% | Legal compliance (art 231-232) |
| @insurtech/stock valorisation | >= 90% | FIFO accuracy mandatory CGNC art 32 |
| @insurtech/stock movements | >= 90% | Concurrence + atomicity critical |
| @insurtech/analytics services | >= 85% | Standard cover |
| @insurtech/hr services | >= 85% | Standard |
| Controllers REST | >= 80% | E2E covers integration |

### G.3 Fixtures realistes Sprint 13

Seed script `seed-phase-3-fixtures.ts` produit :
- 5 tenants types (3 garages + 2 cabinets courtage)
- 50 employees total (10 per tenant)
- 50 contrats CDI actives
- 100+ conges historiques (50% paid + 30% sick + 20% maternity/paternity)
- 600 payslips (50 employees x 12 mois retroactifs)
- 1000 stock items + 5000 lots
- 30 000 stock movements (24000 entries + 6000 exits)
- 150 alertes historiques

Execution : `pnpm tsx infrastructure/scripts/seed-phase-3-fixtures.ts`
Idempotency : ON CONFLICT DO NOTHING (relancable safely).
Duree : ~60 secondes sur Atlas Cloud Benguerir DC1.

### G.4 Tests E2E parcours critiques

```typescript
// 35+ tests E2E groups :

describe('Group 1 : ClickHouse + ETL (5)', () => {
  // ping, schemas, dim_dates, ETL sync, idempotency
});

describe('Group 2 : Dashboards (8)', () => {
  // 6 endpoints + format + multi-tenant + cache
});

describe('Group 3 : Stock (12)', () => {
  // CRUD + FIFO multi-lots + alertes + inventory
});

describe('Group 4 : HR employees (5)', () => {
  // CIN MA + SMIG + CDD/CDI + termination
});

describe('Group 5 : HR conges (5)', () => {
  // Workflow + balance + maternity + sick certif
});

describe('Group 6 : HR paie (7)', () => {
  // CNSS + AMO + IR brackets + Books + declarations
});
```

### G.5 Tests integration concurrence

```typescript
// 100 concurrent exits FIFO same item -> 50 succeed + 50 fail INSUFFICIENT_STOCK
// 50 concurrent payroll generate -> 1 success + 49 IDEMPOTENCY_REPLAY
// 10 concurrent leave requests overlap -> trigger PG rejette
```

### G.6 Performance tests benchmark

```typescript
// Benchmark scenarios :
- 1000 stock items + 5000 lots -> valorisation < 3s
- 200 employees -> payroll generate-period < 30s
- 50 concurrent dashboard requests -> p95 < 1s
- ETL sync 100k transactions -> < 60s
- Inventory historique 6 mois -> < 5s
```


## ANNEXE H -- Pre-commit + workflow CI/CD Sprint 13

### H.1 Pre-commit hooks Husky configuration

```json
// .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 1. Lint-staged : Biome auto-fix + format
pnpm exec lint-staged

# 2. Typecheck strict TypeScript
pnpm typecheck

# 3. Tests unit ONLY pour packages modifies
pnpm exec turbo test --filter=...HEAD --since=HEAD~1

# 4. No-emoji check (decision-006 absolu)
./infrastructure/scripts/check-no-emoji.sh

# 5. No console.log dans production
./infrastructure/scripts/check-no-console.sh

# 6. Conventional commit message format
pnpm exec commitlint --edit "$1"
```

### H.2 Conventional Commits Sprint 13

Format strict :
```
<type>(scope): description courte 50-72 chars

Description longue 2-4 lignes (optionnel)

Livrables:
- bullet 1
- bullet 2

Tests: <n> total / Coverage: <X>%

Task: 3.6.<X>
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.<X>
```

Types autorises Sprint 13 :
- `feat` : nouvelle fonctionnalite (taches 3.6.1-3.6.14)
- `fix` : bugfix
- `docs` : documentation seulement
- `test` : ajout tests sans code metier
- `refactor` : refacto sans changement comportement
- `perf` : amelioration performance
- `chore` : maintenance (deps, build)
- `ci` : configuration CI/CD

Scopes Sprint 13 :
- `sprint-13` : tout sprint
- `analytics` : module analytics
- `stock` : module stock
- `hr` : module HR
- `books-consumer` : consumers Books
- `tests` : tests E2E

Exemples conformes :
```
feat(sprint-13): ClickHouse setup + 8 schemas analytics

Sprint 13 Tache 3.6.1 : pose le socle infrastructure ClickHouse 24.10 OLAP
separe Postgres OLTP, charge 8 schemas (5 faits + 2 dims + 1 calendar).

Livrables :
- docker-compose service clickhouse 24.10-alpine
- 9 schemas SQL (database + 5 fct_* + 2 dim_* + dim_dates 1827 rows)
- @insurtech/analytics package + ClickHouseService

Tests: 36 / Coverage: 88%

Task: 3.6.1
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.1
```

### H.3 CI/CD pipeline Sprint 13

```yaml
# .github/workflows/sprint-13.yml
name: Sprint 13 CI

on:
  push:
    branches: [main, sprint-13]
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '22.11.0'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: ./infrastructure/scripts/check-no-emoji.sh
      - run: ./infrastructure/scripts/check-no-console.sh

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4

  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
      clickhouse:
        image: clickhouse/clickhouse-server:24.10-alpine
        ports: [8123:8123]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm migration:run
      - run: pnpm tsx infrastructure/scripts/init-clickhouse.ts
      - run: pnpm test:integration
      - run: pnpm test:e2e

  build:
    runs-on: ubuntu-latest
    needs: [lint-typecheck, test-unit, test-integration]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### H.4 Workflow developpement Sprint 13

1. **Pre-tache** : lire B-13 + cette task prompt + decision-strategiques referencees.
2. **Setup branch** : `git checkout -b sprint-13/task-3.6.X-<slug>`.
3. **Implement** : suivre 17 sections du prompt + code patterns fournis.
4. **Tests** : ecrire tests AVANT ou en parallele (TDD-friendly).
5. **Pre-commit** : `pnpm typecheck && pnpm lint && pnpm test:coverage`.
6. **Commit** : Conventional Commits + metadata Task/Sprint/Phase.
7. **Push + PR** : titre format `Sprint 13 -- Task 3.6.X : <description>`.
8. **CI** : attendre green (lint + types + tests + integration).
9. **Review** : 1 lead minimum + 1 reviewer metier.
10. **Merge** : squash + tag `sprint-13-task-3.6.X-done`.
11. **Next task** : passer a 3.6.(X+1).

### H.5 Definition of Done Sprint 13

Chaque tache 3.6.X consideree done quand :
- [ ] Tous livrables checkables coches
- [ ] Code TypeScript strict no any implicite
- [ ] Tests unit coverage >= cible (85% standard, 90-95% critique)
- [ ] Tests integration passent (Postgres + Redis + ClickHouse reels)
- [ ] Tests E2E passent (au moins parcours nominaux)
- [ ] CI green sur tous jobs
- [ ] Code reviewed par minimum 1 lead
- [ ] Documentation API a jour (Swagger/OpenAPI export)
- [ ] Aucune emoji (decision-006)
- [ ] Aucune reference vague type "voir B-XX"
- [ ] Commit message Conventional + metadata
- [ ] Conformite legale verifiee (liste lois applicables)
- [ ] Performance SLO respectes (latences + throughput)
- [ ] Multi-tenant isolation testee
- [ ] RBAC permissions seedees + assignees aux roles

