# TACHE 3.6.8 -- Stock REST Endpoints + Cross-Module Integration

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.8)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (consolidation Stock + integration Books + preparation Sprint 22 Repair)
**Effort** : 4h
**Dependances** : 3.6.5, 3.6.6, 3.6.7, Sprint 12 Books (consumer ecritures stock), Sprint 22 Repair (futur consumer parts)
**Densite cible** : 80-110 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache finalise le module Stock par consolidation des endpoints REST et integration cross-module via Kafka : (a) endpoints supplementaires `GET /api/v1/stock/valorisation` (snapshot total tenant), `GET /api/v1/stock/reports/inventory?date=...` (inventaire historique pour audit DGI), `POST /api/v1/stock/inventory-count` (correction physique apres comptage), (b) consumer Kafka `repair-parts-consumed.consumer.ts` qui ecoute `insurtech.events.repair.parts_consumed` (Sprint 22) et automatiquement appelle `recordExit` pour decrementer le stock, (c) consumer Kafka `stock-entry-books.consumer.ts` qui ecoute `insurtech.events.stock.movement_recorded` type 'entry' et automatiquement cree une ecriture comptable (debit compte 3111 Stocks pieces detachees + credit 4411 Fournisseurs) via Sprint 12 BooksService.

L'apport est triple. **Premierement**, endpoint inventaire historique : reconstruire l'etat du stock a une date passee (necessaire bilan annuel CGNC, comptes annuels obligatoires DGI). On utilise les mouvements stock_movements + replay backward : current_stock - sum(entries after date) + sum(exits after date). **Deuxiemement**, correction inventaire physique : controller `POST /stock/inventory-count` accepte un fichier CSV ou JSON `[{ item_id, counted_quantity }]`, compare aux stocks systeme, genere un mouvement adjustment par item ecart. **Troisiemement**, integration Books : chaque entree de stock genere une ecriture double partie (Stocks 31xx au debit, Fournisseur 4411 au credit, TVA recuperable 34555 si applicable Sprint 12).

A l'issue de cette tache, un comptable garage peut produire son inventaire au 31 decembre exact pour le bilan, corriger l'inventaire physique apres comptage trimestriel, et les ecritures comptables stocks s'enregistrent automatiquement sans saisie manuelle. Sprint 22 Repair pourra emettre `repair.parts_consumed` et le stock se decrementera tout seul.

---

## 2. Contexte etendu

### 2.1 Pourquoi inventaire historique critique

Le bilan annuel CGNC (Code General Normalisation Comptable) exige la valorisation des stocks au **31 decembre de l'exercice**. Si on demande le bilan 2026 en mars 2027, le stock actuel a deja change. On doit reconstruire l'etat exact au 2026-12-31 23:59:59. Sans cette capability, le commissaire aux comptes refuse les comptes annuels, audit echoue.

### 2.2 Algorithme replay inventaire

```
state_at(date X) = state_current - sum(movements entries > X) + sum(movements exits > X)
```

C'est l'inverse temporel : on part de l'etat actuel et on annule les mouvements posterieurs.

Pour les lots, plus complique : on recalcule `quantity_remaining` lot par lot en defaisant les sorties FIFO. Comme c'est compute-heavy, on cache le snapshot dans `stock_inventory_snapshots` (Sprint 35 si performance probleme ; Sprint 13 = compute live).

### 2.3 Pieges techniques

1. **Piege : Replay incoherent si lot supprime entre temps**. Solution : preferer JOINS plutot que ON DELETE CASCADE.
2. **Piege : Inventory count file size**. Limite 10 MB CSV.
3. **Piege : CSV encoding UTF-8 BOM**. Solution : strip BOM avant parse.
4. **Piege : Consumer idempotent**. Solution : Idempotency-Key derive de event_id Kafka.
5. **Piege : Books ecriture echec ne doit pas bloquer mouvement stock**. Solution : outbox pattern -> Kafka decouples.

---

## 3. Architecture

```
Sprint 22 Repair                          Sprint 12 Books
       |                                          |
       | emit                                     | consumer
       v                                          ^
  repair.parts_consumed -----> stock movement <----- stock.movement_recorded
                                  |
                                  v
                          stock_movements DB
                                  |
                                  v
                       compute ecriture comptable
                       3111 (D) / 4411 (C) / 34555 (D)
```

---

## 4. Livrables checkables

- [ ] Controller `stock-reports.controller.ts` (~150 lignes : valorisation, inventory, inventory-count)
- [ ] Service `stock-reports.service.ts` (~250 lignes : replay historique + CSV/JSON parse)
- [ ] Consumer `repair-parts-consumed.consumer.ts` (~140 lignes)
- [ ] Consumer `stock-entry-books.consumer.ts` (~160 lignes)
- [ ] DTO `inventory-count.dto.ts` Zod
- [ ] Endpoint CSV download `GET /stock/valorisation/export.csv`
- [ ] Tests 16 unit + 6 integration + 4 E2E
- [ ] Documentation cross-module flows
- [ ] Update permissions seed

---

## 5. Fichiers crees / modifies

```
repo/packages/stock/src/services/stock-reports.service.ts                          (~270 lignes)
repo/packages/stock/src/services/stock-reports.service.spec.ts                       (~250 lignes 16 tests)
repo/packages/stock/src/consumers/repair-parts-consumed.consumer.ts                   (~150 lignes)
repo/packages/stock/src/consumers/repair-parts-consumed.consumer.spec.ts               (~140 lignes 6 tests)
repo/packages/books/src/consumers/stock-entry-books.consumer.ts                        (~170 lignes)
repo/packages/books/src/consumers/stock-entry-books.consumer.spec.ts                    (~160 lignes 8 tests)
repo/packages/stock/src/dto/inventory-count.dto.ts                                      (~50 lignes Zod)
repo/apps/api/src/modules/stock/controllers/stock-reports.controller.ts                (~160 lignes)
repo/apps/api/test/stock/stock-reports.e2e-spec.ts                                       (~180 lignes 4 tests)
repo/docs/integration/stock-cross-module-flows.md                                         (~180 lignes)
```

---

## 6. Code patterns COMPLETS

### 6.1 Service `stock-reports.service.ts`

```typescript
// repo/packages/stock/src/services/stock-reports.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { parse as parseCsv } from 'csv-parse/sync';
import { StockItem } from '../entities/stock-item.entity';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockMovementsService } from './stock-movements.service';
import { StockValorisationService } from './stock-valorisation.service';

export interface InventorySnapshot {
  tenant_id: string;
  snapshot_date: string;
  items: Array<{
    item_id: string;
    sku: string;
    name: string;
    quantity: string;
    valorisation: string;
  }>;
  total: string;
}

export interface InventoryCountInput {
  counts: Array<{ item_id: string; counted_quantity: number; note?: string }>;
}

export interface InventoryCountResult {
  adjustments_created: number;
  discrepancies: Array<{
    item_id: string;
    sku: string;
    system_quantity: string;
    counted_quantity: string;
    delta: string;
  }>;
  total_value_impact: string;
}

@Injectable()
export class StockReportsService {
  private readonly logger = new Logger(StockReportsService.name);

  constructor(
    @InjectRepository(StockItem) private readonly itemRepo: Repository<StockItem>,
    @InjectRepository(StockMovement) private readonly movRepo: Repository<StockMovement>,
    private readonly valorisation: StockValorisationService,
    private readonly movements: StockMovementsService,
    private readonly ds: DataSource,
  ) {}

  /**
   * Snapshot stock a une date passee : current state - movements posterieurs.
   */
  async getInventoryAtDate(tenantId: string, atDate: Date): Promise<InventorySnapshot> {
    if (atDate > new Date()) {
      throw new BadRequestException('atDate cannot be in the future');
    }
    const current = await this.valorisation.getValorisation(tenantId);
    
    // Get movements posterieurs a atDate
    const posteriorMovements = await this.movRepo
      .createQueryBuilder('m')
      .where('m.tenant_id = :t', { t: tenantId })
      .andWhere('m.occurred_at > :d', { d: atDate })
      .getMany();
    
    // Reconstruct quantity per item
    const itemQuantities = new Map<string, Decimal>();
    for (const item of current.items) {
      itemQuantities.set(item.item_id, new Decimal(item.quantity));
    }
    for (const m of posteriorMovements) {
      const qty = new Decimal(m.quantity);
      const current = itemQuantities.get(m.item_id) ?? new Decimal(0);
      if (m.movement_type === 'entry' || m.movement_type === 'adjustment_in') {
        // Annuler l'entree : reduire current
        itemQuantities.set(m.item_id, current.minus(qty));
      } else if (m.movement_type === 'exit' || m.movement_type === 'adjustment_out') {
        // Annuler la sortie : augmenter current
        itemQuantities.set(m.item_id, current.plus(qty));
      }
    }
    
    // Reconstruct valorisation : simplified - use current item valorisations weighted by qty
    // Sprint 35 : exact FIFO replay if necessary
    const items = current.items.map((item) => {
      const histQty = itemQuantities.get(item.item_id) ?? new Decimal(0);
      const currentQty = new Decimal(item.quantity);
      const ratio = currentQty.gt(0) ? histQty.div(currentQty) : new Decimal(0);
      const histValo = new Decimal(item.valorisation_fifo).mul(ratio);
      return {
        item_id: item.item_id,
        sku: item.sku,
        name: item.name,
        quantity: histQty.toFixed(4),
        valorisation: histValo.toFixed(2),
      };
    }).filter((i) => new Decimal(i.quantity).gt(0));
    
    const total = items.reduce((s, i) => s.plus(new Decimal(i.valorisation)), new Decimal(0)).toFixed(2);

    return {
      tenant_id: tenantId,
      snapshot_date: atDate.toISOString().slice(0, 10),
      items,
      total,
    };
  }

  /**
   * Inventory count : compare counts physique avec systeme + generate adjustments.
   */
  async applyInventoryCount(
    tenantId: string,
    userId: string,
    input: InventoryCountInput,
  ): Promise<InventoryCountResult> {
    if (input.counts.length === 0) {
      throw new BadRequestException('counts array cannot be empty');
    }
    if (input.counts.length > 10000) {
      throw new BadRequestException('Maximum 10000 items per inventory count');
    }
    
    const discrepancies: InventoryCountResult['discrepancies'] = [];
    let adjustmentsCreated = 0;
    let totalImpact = new Decimal(0);

    for (const count of input.counts) {
      const item = await this.itemRepo.findOne({ where: { id: count.item_id, tenant_id: tenantId } });
      if (!item) continue;
      const stock = await this.valorisation.getCurrentStock(count.item_id);
      const system = new Decimal(stock.quantity);
      const counted = new Decimal(count.counted_quantity);
      const delta = counted.minus(system);
      if (delta.eq(0)) continue;
      
      discrepancies.push({
        item_id: count.item_id,
        sku: item.sku,
        system_quantity: system.toFixed(4),
        counted_quantity: counted.toFixed(4),
        delta: delta.toFixed(4),
      });
      
      try {
        await this.movements.recordAdjustment(tenantId, userId, {
          itemId: count.item_id,
          deltaQuantity: delta.toNumber(),
          reason: `Inventory count adjustment ${new Date().toISOString().slice(0, 10)}${count.note ? ` -- ${count.note}` : ''}`,
        });
        adjustmentsCreated++;
        // Impact approximatif (necessite cout unitaire moyen)
        const avgCost = new Decimal(stock.valorisation_fifo).div(system.eq(0) ? new Decimal(1) : system);
        totalImpact = totalImpact.plus(delta.mul(avgCost));
      } catch (err) {
        this.logger.error({ action: 'adjustment_failed', item_id: count.item_id, error: String(err) });
      }
    }

    this.logger.log({
      action: 'inventory_count_applied',
      tenant_id: tenantId,
      adjustments: adjustmentsCreated,
      discrepancies: discrepancies.length,
    });

    return {
      adjustments_created: adjustmentsCreated,
      discrepancies,
      total_value_impact: totalImpact.toFixed(2),
    };
  }

  /**
   * Parse CSV bytes content and apply.
   */
  async applyInventoryCountFromCsv(
    tenantId: string,
    userId: string,
    csvContent: string,
  ): Promise<InventoryCountResult> {
    const stripped = csvContent.replace(/^﻿/, '');                        // strip BOM
    const records = parseCsv(stripped, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    const counts = records.map((r: any) => ({
      item_id: r.item_id ?? r.id ?? r.sku,
      counted_quantity: Number(r.counted_quantity ?? r.quantity),
      note: r.note,
    }));
    return this.applyInventoryCount(tenantId, userId, { counts });
  }

  async generateValorisationCsv(tenantId: string): Promise<string> {
    const snapshot = await this.valorisation.getValorisation(tenantId);
    const headers = 'sku,name,quantity,valorisation_mad\n';
    const rows = snapshot.items
      .map((i) => `"${i.sku}","${i.name.replace(/"/g, '""')}",${i.quantity},${i.valorisation_fifo}`)
      .join('\n');
    return headers + rows;
  }
}
```

### 6.2 Consumer `repair-parts-consumed.consumer.ts`

```typescript
// repo/packages/stock/src/consumers/repair-parts-consumed.consumer.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StockMovementsService } from '../services/stock-movements.service';

interface KafkaConsumer {
  subscribe(topic: string, handler: (msg: any) => Promise<void>): Promise<void>;
}

interface RepairPartsConsumedEvent {
  event_id: string;
  tenant_id: string;
  claim_id: string;
  reparation_id: string;
  parts: Array<{ item_id: string; quantity: number }>;
  consumed_by_user_id: string;
  occurred_at: string;
}

@Injectable()
export class RepairPartsConsumedConsumer implements OnModuleInit {
  private readonly logger = new Logger(RepairPartsConsumedConsumer.name);

  constructor(
    private readonly kafka: KafkaConsumer,
    private readonly stockMovements: StockMovementsService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafka.subscribe('insurtech.events.repair.parts_consumed', this.handle.bind(this));
    this.logger.log({ action: 'repair_parts_consumed_consumer_init' });
  }

  async handle(message: RepairPartsConsumedEvent): Promise<void> {
    try {
      this.logger.log({
        action: 'repair_parts_consumed_received',
        event_id: message.event_id,
        tenant_id: message.tenant_id,
        claim_id: message.claim_id,
        parts_count: message.parts.length,
      });

      for (const part of message.parts) {
        try {
          await this.stockMovements.recordExit(
            message.tenant_id,
            message.consumed_by_user_id,
            {
              itemId: part.item_id,
              quantity: part.quantity,
              reason: `Repair consumption claim ${message.claim_id} reparation ${message.reparation_id}`,
              relatedResourceType: 'claim',
              relatedResourceId: message.claim_id,
              occurredAt: new Date(message.occurred_at),
            },
            `repair-parts-${message.event_id}-${part.item_id}`,
          );
        } catch (err) {
          this.logger.error({
            action: 'stock_exit_failed_from_repair',
            event_id: message.event_id,
            item_id: part.item_id,
            error: String(err),
          });
          // Sprint 35 : escalate to repair manager (insufficient stock blocks repair)
        }
      }
    } catch (err) {
      this.logger.error({ action: 'consumer_failed', error: String(err) });
    }
  }
}
```

### 6.3 Consumer `stock-entry-books.consumer.ts` (auto ecritures)

```typescript
// repo/packages/books/src/consumers/stock-entry-books.consumer.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Decimal from 'decimal.js';

interface KafkaConsumer {
  subscribe(topic: string, handler: (msg: any) => Promise<void>): Promise<void>;
}

interface BooksService {
  recordEntry(tenantId: string, args: {
    journal_code: string;
    posted_at: Date;
    source_resource_type: string;
    source_resource_id: string;
    label: string;
    lines: Array<{ account_code: string; debit?: number; credit?: number; tva_rate?: number; tva_amount?: number }>;
    idempotency_key?: string;
  }): Promise<{ entry_id: string }>;
}

interface StockMovementRecordedEvent {
  movement_id: string;
  tenant_id: string;
  item_id: string;
  movement_type: 'entry' | 'exit' | 'adjustment_in' | 'adjustment_out';
  quantity: string;
  unit_cost: string | null;
  total_cost: string;
  related_resource_type: string | null;
  related_resource_id: string | null;
  occurred_at: string;
}

@Injectable()
export class StockEntryBooksConsumer implements OnModuleInit {
  private readonly logger = new Logger(StockEntryBooksConsumer.name);
  // Compte CGNC 3111 = stocks pieces detachees ; 4411 = fournisseurs ; 34555 = TVA recuperable ; 6022 = achats consommes
  private readonly ACCOUNT_STOCKS = '3111';
  private readonly ACCOUNT_SUPPLIERS = '4411';
  private readonly ACCOUNT_TVA_RECOV = '34555';
  private readonly ACCOUNT_CONSUMED = '6022';
  private readonly DEFAULT_TVA_RATE = 0.20;        // 20% standard

  constructor(
    private readonly kafka: KafkaConsumer,
    private readonly books: BooksService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafka.subscribe('insurtech.events.stock.movement_recorded', this.handle.bind(this));
    this.logger.log({ action: 'stock_entry_books_consumer_init' });
  }

  async handle(message: StockMovementRecordedEvent): Promise<void> {
    try {
      const totalCost = new Decimal(message.total_cost);
      if (totalCost.eq(0)) return;

      if (message.movement_type === 'entry') {
        await this.recordEntryAccounting(message, totalCost);
      } else if (message.movement_type === 'exit') {
        await this.recordExitAccounting(message, totalCost);
      }
      // adjustment_* : pas d'ecriture systematique, traite a la cloture inventaire
    } catch (err) {
      this.logger.error({
        action: 'books_consumer_failed',
        movement_id: message.movement_id,
        error: String(err),
      });
    }
  }

  private async recordEntryAccounting(msg: StockMovementRecordedEvent, totalCost: Decimal): Promise<void> {
    const tvaRate = this.DEFAULT_TVA_RATE;
    const ht = totalCost.div(1 + tvaRate);
    const tva = totalCost.minus(ht);

    await this.books.recordEntry(msg.tenant_id, {
      journal_code: 'ACH',
      posted_at: new Date(msg.occurred_at),
      source_resource_type: 'stock_movement',
      source_resource_id: msg.movement_id,
      label: `Entree stock article ${msg.item_id.slice(0, 8)}`,
      lines: [
        { account_code: this.ACCOUNT_STOCKS, debit: ht.toNumber() },
        { account_code: this.ACCOUNT_TVA_RECOV, debit: tva.toNumber(), tva_rate: tvaRate, tva_amount: tva.toNumber() },
        { account_code: this.ACCOUNT_SUPPLIERS, credit: totalCost.toNumber() },
      ],
      idempotency_key: `stock-entry-${msg.movement_id}`,
    });

    this.logger.log({
      action: 'stock_entry_ecriture_created',
      movement_id: msg.movement_id,
      total_ttc: totalCost.toFixed(2),
    });
  }

  private async recordExitAccounting(msg: StockMovementRecordedEvent, totalCost: Decimal): Promise<void> {
    // Sortie pour consommation : debit 6022 Achats consommes / credit 3111 Stocks
    await this.books.recordEntry(msg.tenant_id, {
      journal_code: 'OD',
      posted_at: new Date(msg.occurred_at),
      source_resource_type: 'stock_movement',
      source_resource_id: msg.movement_id,
      label: `Sortie stock article ${msg.item_id.slice(0, 8)} ${msg.related_resource_type ?? ''}`,
      lines: [
        { account_code: this.ACCOUNT_CONSUMED, debit: totalCost.toNumber() },
        { account_code: this.ACCOUNT_STOCKS, credit: totalCost.toNumber() },
      ],
      idempotency_key: `stock-exit-${msg.movement_id}`,
    });

    this.logger.log({
      action: 'stock_exit_ecriture_created',
      movement_id: msg.movement_id,
      cost: totalCost.toFixed(2),
    });
  }
}
```

### 6.4 Controller `stock-reports.controller.ts`

```typescript
import { Body, Controller, Get, Header, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, CurrentTenantId, CurrentUserId } from '@insurtech/auth';
import { StockValorisationService, StockReportsService } from '@insurtech/stock';
import { z } from 'zod';

const InventoryCountSchema = z.object({
  counts: z.array(z.object({
    item_id: z.string().uuid(),
    counted_quantity: z.coerce.number().min(0),
    note: z.string().max(500).optional(),
  })).min(1).max(10000),
});

@Controller('api/v1/stock')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class StockReportsController {
  constructor(
    private readonly valo: StockValorisationService,
    private readonly reports: StockReportsService,
  ) {}

  @Get('valorisation')
  @Roles('stock.valorisation.read')
  async valorisation(@CurrentTenantId() tenantId: string) {
    return this.valo.getValorisation(tenantId);
  }

  @Get('valorisation/export.csv')
  @Roles('stock.valorisation.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="stock-valorisation.csv"')
  async exportCsv(@CurrentTenantId() tenantId: string, @Res() res: Response) {
    const csv = await this.reports.generateValorisationCsv(tenantId);
    res.send('﻿' + csv);                                                  // BOM for Excel
  }

  @Get('reports/inventory')
  @Roles('stock.valorisation.read')
  async inventory(
    @CurrentTenantId() tenantId: string,
    @Query('date') dateParam?: string,
  ) {
    const atDate = dateParam ? new Date(dateParam) : new Date();
    return this.reports.getInventoryAtDate(tenantId, atDate);
  }

  @Post('inventory-count')
  @Roles('stock.adjust')
  async inventoryCount(
    @CurrentTenantId() tenantId: string,
    @CurrentUserId() userId: string,
    @Body() body: unknown,
  ) {
    const dto = InventoryCountSchema.parse(body);
    return this.reports.applyInventoryCount(tenantId, userId, dto);
  }
}
```

---

## 7. Tests

### 7.1 Tests `stock-reports.service.spec.ts` (16 cas)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { StockReportsService } from './stock-reports.service';
import { StockValorisationService } from './stock-valorisation.service';
import { StockMovementsService } from './stock-movements.service';
import { StockItem } from '../entities/stock-item.entity';
import { StockMovement } from '../entities/stock-movement.entity';

describe('StockReportsService', () => {
  let svc: StockReportsService;
  let valo: any; let movements: any; let itemRepo: any; let movRepo: any; let ds: any;

  beforeEach(async () => {
    valo = { getValorisation: vi.fn(), getCurrentStock: vi.fn() };
    movements = { recordAdjustment: vi.fn() };
    itemRepo = { findOne: vi.fn() };
    movRepo = { createQueryBuilder: vi.fn() };
    ds = {};
    const mod = await Test.createTestingModule({
      providers: [
        StockReportsService,
        { provide: getRepositoryToken(StockItem), useValue: itemRepo },
        { provide: getRepositoryToken(StockMovement), useValue: movRepo },
        { provide: StockValorisationService, useValue: valo },
        { provide: StockMovementsService, useValue: movements },
        { provide: DataSource, useValue: ds },
      ],
    }).compile();
    svc = mod.get(StockReportsService);
  });

  it('getInventoryAtDate rejects future date', async () => {
    const future = new Date(Date.now() + 86400000);
    await expect(svc.getInventoryAtDate('t', future)).rejects.toThrow(/future/);
  });

  it('getInventoryAtDate replays exit movements', async () => {
    valo.getValorisation.mockResolvedValue({
      items: [{ item_id: 'i1', sku: 'A', name: 'Pneu', quantity: '5', valorisation_fifo: '500' }],
      total_valorisation: '500', tenant_id: 't', snapshot_at: new Date().toISOString(), items_count: 1, active_lots_count: 1,
    });
    const qb = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        { item_id: 'i1', movement_type: 'exit', quantity: '3', occurred_at: new Date('2026-02-01') },
      ]),
    };
    movRepo.createQueryBuilder.mockReturnValue(qb);
    const r = await svc.getInventoryAtDate('t', new Date('2026-01-01'));
    expect(r.items[0].quantity).toBe('8.0000');           // 5 + 3 (annule exit) = 8
  });

  it('getInventoryAtDate replays entry movements', async () => {
    valo.getValorisation.mockResolvedValue({
      items: [{ item_id: 'i1', sku: 'A', name: 'Pneu', quantity: '10', valorisation_fifo: '1000' }],
      total_valorisation: '1000', tenant_id: 't', snapshot_at: new Date().toISOString(), items_count: 1, active_lots_count: 1,
    });
    const qb = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        { item_id: 'i1', movement_type: 'entry', quantity: '4', occurred_at: new Date('2026-02-01') },
      ]),
    };
    movRepo.createQueryBuilder.mockReturnValue(qb);
    const r = await svc.getInventoryAtDate('t', new Date('2026-01-01'));
    expect(r.items[0].quantity).toBe('6.0000');           // 10 - 4 = 6
  });

  it('applyInventoryCount empty rejected', async () => {
    await expect(svc.applyInventoryCount('t', 'u', { counts: [] })).rejects.toThrow();
  });

  it('applyInventoryCount detects positive discrepancy', async () => {
    itemRepo.findOne.mockResolvedValue({ id: 'i1', sku: 'A', tenant_id: 't' });
    valo.getCurrentStock.mockResolvedValue({ quantity: '10', valorisation_fifo: '1000', lots_count: 1 });
    movements.recordAdjustment.mockResolvedValue({ id: 'mov-1' });
    const r = await svc.applyInventoryCount('t', 'u', {
      counts: [{ item_id: 'i1', counted_quantity: 12 }],
    });
    expect(r.discrepancies).toHaveLength(1);
    expect(r.discrepancies[0].delta).toBe('2.0000');
    expect(r.adjustments_created).toBe(1);
  });

  it('applyInventoryCount detects negative discrepancy', async () => {
    itemRepo.findOne.mockResolvedValue({ id: 'i1', sku: 'A', tenant_id: 't' });
    valo.getCurrentStock.mockResolvedValue({ quantity: '10', valorisation_fifo: '1000', lots_count: 1 });
    movements.recordAdjustment.mockResolvedValue({ id: 'mov-1' });
    const r = await svc.applyInventoryCount('t', 'u', {
      counts: [{ item_id: 'i1', counted_quantity: 7 }],
    });
    expect(r.discrepancies[0].delta).toBe('-3.0000');
  });

  it('applyInventoryCount no diff = no adjustment', async () => {
    itemRepo.findOne.mockResolvedValue({ id: 'i1', sku: 'A', tenant_id: 't' });
    valo.getCurrentStock.mockResolvedValue({ quantity: '10', valorisation_fifo: '1000', lots_count: 1 });
    const r = await svc.applyInventoryCount('t', 'u', {
      counts: [{ item_id: 'i1', counted_quantity: 10 }],
    });
    expect(r.adjustments_created).toBe(0);
    expect(r.discrepancies).toHaveLength(0);
  });

  it('applyInventoryCount rejects 10001 items', async () => {
    const counts = Array.from({ length: 10001 }, (_, i) => ({ item_id: `i${i}`, counted_quantity: 1 }));
    await expect(svc.applyInventoryCount('t', 'u', { counts })).rejects.toThrow(/10000/);
  });

  it('applyInventoryCountFromCsv strips BOM', async () => {
    itemRepo.findOne.mockResolvedValue({ id: 'i1', sku: 'A', tenant_id: 't' });
    valo.getCurrentStock.mockResolvedValue({ quantity: '10', valorisation_fifo: '1000', lots_count: 1 });
    movements.recordAdjustment.mockResolvedValue({});
    const csv = '﻿item_id,counted_quantity\ni1,12\n';
    const r = await svc.applyInventoryCountFromCsv('t', 'u', csv);
    expect(r.adjustments_created).toBe(1);
  });

  it('generateValorisationCsv emits proper headers', async () => {
    valo.getValorisation.mockResolvedValue({
      items: [
        { item_id: 'i1', sku: 'GAR-001', name: 'Pneu "premium"', quantity: '5.0000', valorisation_fifo: '500.00' },
      ],
      total_valorisation: '500.00', tenant_id: 't', snapshot_at: '', items_count: 1, active_lots_count: 1,
    });
    const csv = await svc.generateValorisationCsv('t');
    expect(csv).toContain('sku,name,quantity,valorisation_mad');
    expect(csv).toContain('GAR-001');
    expect(csv).toContain('Pneu ""premium""');                                  // CSV escaping
  });
});
```

---

## 8. Variables environnement

```env
STOCK_INVENTORY_COUNT_MAX_ITEMS=10000
STOCK_DEFAULT_TVA_RATE=0.20
```

---

## 9. Commandes shell

```bash
pnpm --filter @insurtech/stock test
pnpm --filter @insurtech/books test
pnpm --filter @insurtech/api test:e2e -- stock-reports

# Test endpoints
curl http://localhost:4000/api/v1/stock/valorisation -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" | jq
curl "http://localhost:4000/api/v1/stock/reports/inventory?date=2026-12-31" -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" | jq
curl http://localhost:4000/api/v1/stock/valorisation/export.csv -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" -o stock.csv
```

---

## 10. Criteres validation V1-V20

### P0 (12)
- V1 : GET /valorisation retourne snapshot
- V2 : GET /reports/inventory?date=X retourne etat historique
- V3 : POST /inventory-count cree adjustments
- V4 : CSV export inclus BOM Excel
- V5 : Consumer repair-parts-consumed declenche recordExit
- V6 : Consumer stock-entry-books cree ecriture 3111/4411/34555
- V7 : Idempotency consumers via event_id
- V8 : Multi-tenant isolation
- V9 : RBAC stock.valorisation.read / stock.adjust
- V10 : Inventaire historique annule entries + exits
- V11 : Inventory-count limit 10000 items
- V12 : CSV BOM strip avant parse

### P1 (5)
- V13 : Performance inventory 1000 items < 3s
- V14 : Logs structures Pino
- V15 : Coverage >= 85%
- V16 : Documentation cross-module flows
- V17 : Tests E2E + integration consumers

### P2 (3)
- V18 : Endpoint export CSV streaming
- V19 : Cache snapshot inventaire fin annee
- V20 : Audit DGI trail

---

## 11. Edge cases

1. CSV malformed -> parse error 400 explicite
2. Item supprime mid-count -> ignore
3. Movement Kafka event manque event_id -> log + skip
4. Books service down -> retry exponential
5. Inventory date avant tout mouvement -> retourne stock initial 0
6. Concurrent inventory-count -> serialise via lock tenant
7. CSV avec encoding non-UTF8 -> rejected
8. Idempotency key collision (rare) -> 409

---

## 12. Conformite Maroc

- CGNC inventory annuel bilan obligatoire.
- DGI conservation 10 ans (Sprint 12 deja).
- Ecriture 3111/4411/34555 conforme plan comptable MA.

---

## 13. Conventions

Multi-tenant, Zod, Pino, pnpm, TS strict, RBAC, Kafka topics standardises, Idempotency-Key, decision-006, decision-008.

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/stock typecheck
pnpm --filter @insurtech/stock test:coverage
pnpm --filter @insurtech/books test:coverage
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-13): stock REST endpoints + cross-module Kafka consumers

Sprint 13 Tache 3.6.8 : endpoints valorisation + inventory historique +
inventory-count + consumers repair.parts_consumed + stock-entry-books.

Livrables :
- StockReportsService (getInventoryAtDate, applyInventoryCount, CSV)
- StockReportsController : valorisation, export.csv, inventory, inventory-count
- RepairPartsConsumedConsumer (Sprint 22 ready)
- StockEntryBooksConsumer (auto ecritures 3111/4411/34555)
- 26 tests (16 unit + 6 integration + 4 E2E)

Tests: 26
Coverage: 88%

Task: 3.6.8
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.8"
```

---

## 16. Workflow next step

Tache suivante : `task-3.6.9-hr-employees-contrats-cdi-cdd-anapec.md` (HR foundation).

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Specifications detaillees endpoints inventory historique

#### A.1 GET /api/v1/stock/reports/inventory?date=YYYY-MM-DD

**Use case** : Comptable demande bilan stock au 31 decembre 2026 pour cloture annuelle.

**Algorithme replay backward** :

```
Etat actuel : Stock = current_valorisation
Pour reconstituer etat au temps T (T < now()) :
  1. Get all movements WHERE occurred_at > T
  2. Pour chaque movement :
     - Si entry/adjustment_in : retirer quantite (annuler l'entry)
     - Si exit/adjustment_out : ajouter quantite (annuler l'exit)
  3. Result = Stock historique a T
```

**Limitation Sprint 13** : valorisation FIFO exacte historique necessite replay complet
des lots. Sprint 13 = approximation par ratio. Sprint 35 = exact FIFO replay (cher
computationnellement) ou snapshot table `stock_inventory_snapshots` (yearly).

#### A.2 POST /api/v1/stock/inventory-count

**Use case** : Inventaire physique annuel obligatoire. Magasinier compte items, saisit
ecarts vs systeme, applique ajustements.

**Payload exemple** :

```json
{
  "counts": [
    { "item_id": "uuid-1", "counted_quantity": 12, "note": "Trouve 12 dans rack A3 au lieu de 10 systeme" },
    { "item_id": "uuid-2", "counted_quantity": 8, "note": "Manque 2 unites par rapport systeme -- vol suspect" },
    { "item_id": "uuid-3", "counted_quantity": 50, "note": null }
  ],
  "inventory_date": "2026-12-31",
  "performed_by": "Magasinier Hassan Idrissi"
}
```

**Response 200** :

```json
{
  "adjustments_created": 23,
  "discrepancies": [
    { "item_id": "uuid-1", "sku": "GAR-PNEU-001", "system_quantity": "10.0000", "counted_quantity": "12.0000", "delta": "2.0000" },
    { "item_id": "uuid-2", "sku": "GAR-FILT-005", "system_quantity": "10.0000", "counted_quantity": "8.0000", "delta": "-2.0000" }
  ],
  "total_value_impact": "456.78",
  "inventory_count_report_url": "https://s3.atlas.ma/.../report-2026-12-31.pdf"
}
```

### B. Format export CSV valorisation complet

```csv
﻿sku,name,category,quantity,unit,unit_cost_avg,valorisation_mad,lots_count,oldest_lot_date,last_movement_date
GAR-PNEU-001,"Pneu Michelin 205/55R16",Pneus,10.0000,pcs,800.00,8000.00,2,2026-01-15,2026-05-10
GAR-FILT-001,"Filtre huile WS50",Filtres,25.0000,pcs,45.00,1125.00,3,2026-02-01,2026-05-12
...
```

**Specifications CSV** :
- BOM 0xFEFF UTF-8 BOM (Excel detect encoding)
- Separator `,` (virgule, standard CSV)
- Quotes pour valeurs contenant `,` ou `"`
- Decimal `.` (anglo, compatible Excel France via parametres regionaux)
- Date ISO 8601 YYYY-MM-DD

### C. Consumer `repair-parts-consumed.consumer.ts` enrichi

Cas d'usage detaille avec gestion erreurs robuste :

```typescript
async handle(message: RepairPartsConsumedEvent): Promise<void> {
  const startTime = Date.now();
  const partialErrors: string[] = [];
  let successCount = 0;

  this.logger.log({
    action: 'repair_parts_consumed_received',
    event_id: message.event_id,
    tenant_id: message.tenant_id,
    claim_id: message.claim_id,
    reparation_id: message.reparation_id,
    parts_count: message.parts.length,
  });

  // Validation event payload
  if (!message.event_id || !message.tenant_id || !Array.isArray(message.parts)) {
    this.logger.warn({ action: 'repair_event_malformed', event: message });
    return;
  }

  // Process each part with individual idempotency
  for (const part of message.parts) {
    try {
      // Validate part
      if (!part.item_id || !part.quantity || part.quantity <= 0) {
        partialErrors.push(`Invalid part: ${JSON.stringify(part)}`);
        continue;
      }

      // Call recordExit with idempotency derived from event
      await this.stockMovements.recordExit(
        message.tenant_id,
        message.consumed_by_user_id,
        {
          itemId: part.item_id,
          quantity: part.quantity,
          reason: `Repair claim ${message.claim_id} reparation ${message.reparation_id}`,
          relatedResourceType: 'claim',
          relatedResourceId: message.claim_id,
          occurredAt: new Date(message.occurred_at),
        },
        `repair-parts-${message.event_id}-${part.item_id}`,
      );
      successCount++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      partialErrors.push(`Item ${part.item_id} qty ${part.quantity}: ${errMsg}`);
      
      // Escalation if INSUFFICIENT_STOCK : notify repair manager
      if (errMsg.includes('INSUFFICIENT_STOCK')) {
        await this.notifyInsufficientStock(message, part);
      }
    }
  }

  this.logger.log({
    action: 'repair_parts_consumed_complete',
    event_id: message.event_id,
    success: successCount,
    errors: partialErrors.length,
    duration_ms: Date.now() - startTime,
  });

  // If any errors, emit Kafka event for monitoring/escalation
  if (partialErrors.length > 0) {
    setImmediate(() => this.kafka.publish('insurtech.events.stock.parts_consumption_partial', {
      tenant_id: message.tenant_id,
      claim_id: message.claim_id,
      event_id: message.event_id,
      successful: successCount,
      failed: partialErrors.length,
      errors: partialErrors,
    }));
  }
}

private async notifyInsufficientStock(message: any, part: any): Promise<void> {
  // Email repair manager : "Sinistre #123 bloque, piece SKU X manquante"
  // Sprint 35 : auto-order from preferred supplier
  this.logger.warn({
    action: 'insufficient_stock_alert',
    claim_id: message.claim_id,
    item_id: part.item_id,
    quantity_requested: part.quantity,
  });
}
```

### D. Consumer `stock-entry-books.consumer.ts` complet avec TVA dynamique

```typescript
private async recordEntryAccounting(msg: StockMovementRecordedEvent, totalCost: Decimal): Promise<void> {
  // Lookup TVA rate from item category (Sprint 14 enhancement)
  // Sprint 13 : default 20% standard
  const tvaRate = await this.lookupTvaRate(msg.tenant_id, msg.item_id);
  const ht = totalCost.div(new Decimal(1).plus(tvaRate));
  const tva = totalCost.minus(ht);

  // Determine compte selon category :
  // 3111 - pieces detachees standard
  // 3112 - pieces electroniques
  // 3113 - consommables (huile, filtres) 
  const stocksAccount = await this.lookupStocksAccount(msg.tenant_id, msg.item_id);

  // Determine compte TVA :
  // 34555 - TVA recuperable 20%
  // 34556 - TVA recuperable 14%
  // 34557 - TVA recuperable 10%
  // 34558 - TVA recuperable 7%
  const tvaAccount = this.tvaAccountForRate(tvaRate);

  await this.books.recordEntry(msg.tenant_id, {
    journal_code: 'ACH',
    posted_at: new Date(msg.occurred_at),
    source_resource_type: 'stock_movement',
    source_resource_id: msg.movement_id,
    label: `Entree stock ${msg.item_id.slice(0, 8)} ref ${msg.related_resource_id ?? 'N/A'}`,
    lines: [
      { account_code: stocksAccount, debit: ht.toNumber() },
      { account_code: tvaAccount, debit: tva.toNumber(), tva_rate: tvaRate.toNumber(), tva_amount: tva.toNumber() },
      { account_code: this.ACCOUNT_SUPPLIERS, credit: totalCost.toNumber() },
    ],
    idempotency_key: `stock-entry-${msg.movement_id}`,
  });

  this.logger.log({
    action: 'stock_entry_ecriture_created',
    movement_id: msg.movement_id,
    ht: ht.toFixed(2),
    tva: tva.toFixed(2),
    ttc: totalCost.toFixed(2),
    stocks_account: stocksAccount,
    tva_account: tvaAccount,
  });
}

private tvaAccountForRate(rate: Decimal): string {
  if (rate.eq(0.20)) return '34555';
  if (rate.eq(0.14)) return '34556';
  if (rate.eq(0.10)) return '34557';
  if (rate.eq(0.07)) return '34558';
  return '34555';      // default
}

private async lookupTvaRate(tenantId: string, itemId: string): Promise<Decimal> {
  // Sprint 13 : default 20% standard
  // Sprint 14 : lookup from item.category.tva_rate (categories.tva_rate field)
  return new Decimal(0.20);
}

private async lookupStocksAccount(tenantId: string, itemId: string): Promise<string> {
  // Sprint 13 : default 3111
  // Sprint 14 : map category -> compte CGNC (3111/3112/3113/...)
  return '3111';
}
```

### E. Tests integration enrichis (10 tests additionnels)

```typescript
describe('Stock cross-module integration', () => {
  it('1. Inventory at date 2026-01-01 replays correctly', async () => {
    // Setup : entries Jan + Feb + Mar
    // Get inventory at 2026-01-15 -> should exclude Feb + Mar
  });

  it('2. Inventory at future date -> 400', async () => { });

  it('3. CSV export valorisation BOM Excel compatible', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/stock/valorisation/export.csv')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantId)
      .expect(200);
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('4. Inventory count 100 items with 30 discrepancies', async () => {
    // POST /inventory-count avec 100 items
    // Verify : 30 adjustments crees
    // Verify : Books ecritures generees
  });

  it('5. Inventory count empty array rejected', async () => { });

  it('6. Inventory count > 10000 items rejected', async () => { });

  it('7. Concurrent inventory-count on same tenant -> serialised', async () => { });

  it('8. Repair parts_consumed event triggers exit', async () => {
    // Simulate Kafka event
    // Verify : stock_movements row created type=exit
    // Verify : Books ecriture 6022/3111
  });

  it('9. Repair parts_consumed INSUFFICIENT_STOCK -> escalation event', async () => {
    // Setup : item with stock < requested
    // Send event
    // Verify : escalation Kafka event emitted
    // Verify : original movement NOT created
  });

  it('10. Stock entry triggers Books with correct TVA 20%', async () => {
    // POST /stock/movements/entry
    // Wait Kafka consumer
    // Verify Books entry : HT + TVA 20% + TTC
  });
});
```

### F. Edge cases supplementaires inventory + cross-module

1. Inventory date = epoch (1970) -> compute jusqu'au debut, 0 stock attendu.
2. Inventory entre 2 lots same item -> compute exact.
3. Item supprime apres inventory date -> exclu du report.
4. Adjustment_in pendant inventory replay -> compute correct.
5. CSV size > 100 MB (10k items) -> streaming response (Sprint 35).
6. Repair event delivers 2x same event_id -> idempotency check both items same key.
7. Books consumer down -> retry exponential, eventually success.
8. Multi-currency stock (rare) -> Sprint 35 lookup taux change.
9. Repair claim cancelled apres consume -> Sprint 22 emit reverse event (Sprint 22).
10. Inventory count fichier CSV corrupted -> parse error 400.
11. Item active=false mais a un lot positive -> include in inventory (audit DGI).
12. Compte 3111 inexistant tenant -> Books reject avec error (Sprint 12 plan comptable seed prerequisite).

### G. SLO Performance cross-module

| Endpoint/Operation | p50 | p95 | p99 |
|---------------------|-----|-----|-----|
| GET /reports/inventory date 1 jour ago | 300ms | 600ms | 1s |
| GET /reports/inventory date 6 mois ago | 1.5s | 3s | 5s |
| GET /reports/inventory date 2 ans ago | 4s | 8s | 12s |
| POST /inventory-count 100 items | 3s | 6s | 10s |
| POST /inventory-count 1000 items | 12s | 25s | 40s |
| Consumer repair.parts_consumed (5 parts) | 800ms | 1.5s | 3s |
| Consumer stock-entry-books | 400ms | 800ms | 1.5s |
| GET /valorisation/export.csv 1000 items | 1s | 2s | 4s |

### H. Conformite Maroc

- **Inventaire annuel obligatoire** : article 19 CGNC -- inventaire physique annuel des stocks au 31 dec.
- **Conservation pieces** : 10 ans (loi 9-88 art 18).
- **Ecritures comptes** : 3111/4411/34555 conformes plan CGNC.

---

**Fin enrichissement task-3.6.8-stock-rest-endpoints-cross-module.md.**

**Fin task-3.6.8-stock-rest-endpoints-cross-module.md.**

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


## ANNEXE I -- References officielles + glossaire Sprint 13

### I.1 Sources legales officielles Maroc

| Source | URL | Usage Sprint 13 |
|--------|-----|------------------|
| CNSS Maroc | https://www.cnss.ma | Cotisations, declarations BPC |
| Damancom CNSS | https://www.damancom.ma | Portail declaration CNSS mensuelle |
| DGI Maroc | https://www.tax.gov.ma | IR, TVA, SIMPL-IR |
| SIMPL-IR | https://www.tax.gov.ma/wps/portal/DGI/simpl-ir | Declaration Etat 9421 annuelle |
| ANRT (Telecoms) | https://www.anrt.ma | Signatures qualifiees TSA |
| ANAPEC | https://www.anapec.org | Programme Idmaj subventionne |
| ACAPS | https://www.acaps.ma | Reporting assurance (Sprint 14+) |
| AMC | https://amc.gov.ma | Anti-money laundering (Sprint 12) |
| CNDP | https://www.cndp.ma | Loi 09-08 protection donnees |
| Atlas Cloud Maroc | https://www.atlascloud.ma | Cloud souverain MA |
| Bulletin Officiel | https://www.sgg.gov.ma/BulletinOfficiel.aspx | Textes legaux MA |

### I.2 Glossaire Sprint 13

- **CGNC** : Code General de Normalisation Comptable Maroc (decret 2-89-61)
- **CIN** : Carte d'Identite Nationale (format MA : 1-2 lettres + 1-6 chiffres)
- **CNSS** : Caisse Nationale de Securite Sociale
- **AMO** : Assurance Maladie Obligatoire (loi 65-00)
- **IR** : Impot sur le Revenu (loi 47-06)
- **SMIG** : Salaire Minimum Interprofessionnel Garanti (2 970 MAD/mois en 2026)
- **CDI** : Contrat a Duree Indeterminee
- **CDD** : Contrat a Duree Determinee
- **ANAPEC** : Agence Nationale Promotion Emploi et Competences (programme Idmaj)
- **ICE** : Identifiant Commun de l'Entreprise (15 chiffres, obligatoire DGI)
- **RC** : Registre de Commerce (numero)
- **CIMR** : Caisse Interprofessionnelle Marocaine de Retraite (complementaire facultative)
- **BPC** : Bordereau de Paiement des Cotisations sociales (declaration CNSS mensuelle)
- **Etat 9421** : declaration annuelle IR salaires
- **OLTP** : Online Transaction Processing (Postgres)
- **OLAP** : Online Analytical Processing (ClickHouse)
- **ETL** : Extract-Transform-Load (pipeline Postgres -> ClickHouse)
- **FIFO** : First-In-First-Out (methode valorisation stocks)
- **CMP** : Cout Moyen Pondere (alternative FIFO, autorisee MA)
- **LIFO** : Last-In-First-Out (INTERDIT au Maroc)
- **RLS** : Row Level Security (Postgres multi-tenant)
- **MV** : Materialized View (ClickHouse pre-aggregation)
- **SLA** : Service Level Agreement
- **SLO** : Service Level Objective
- **RTO** : Recovery Time Objective
- **RPO** : Recovery Point Objective

### I.3 Versions stack Sprint 13

| Composant | Version | Reference |
|-----------|---------|-----------|
| Node.js | 22.11.0 LTS | engine-strict=true |
| pnpm | 9.x | save-exact=true |
| TypeScript | 5.7.2 | strict mode |
| NestJS | 10.4.15 | |
| TypeORM | 0.3.x | |
| Postgres | 16 | Atlas Cloud |
| ClickHouse | 24.10 | Tache 3.6.1 |
| Redis | 7.x | Sprint 9 |
| Kafka | 3.7 | Sprint 9 |
| BullMQ | 5.x | Cron jobs |
| Zod | 3.23.8 | Validation runtime |
| Decimal.js | 10.4.3 | Computations financieres |
| Pino | 9.5.0 | Logger |
| Vitest | 2.1.8 | Tests |


## ANNEXE J -- Stock cross-module specifics

### J.1 Catalogue ecritures comptables stock complete

| Operation Stock | Trigger | Compte debit | Compte credit | Reference CGNC |
|------------------|---------|--------------|----------------|------------------|
| Entry achat fournisseur | Kafka stock.movement_recorded type=entry | 3111 Stocks pieces (HT) + 34555 TVA recup 20% | 4411 Fournisseurs (TTC) | Art 32 |
| Exit consommation sinistre | Kafka stock.movement_recorded type=exit + related=claim | 6022 Achats consommes | 3111 Stocks pieces | Art 32 |
| Adjustment positive (inventaire +) | Kafka adjustment_in | 3111 Stocks | 7138 Profits exceptionnels | Art 41 |
| Adjustment negative (inventaire -) | Kafka adjustment_out | 6586 Charges exceptionnelles | 3111 Stocks | Art 41 |
| Vol/casse | adjustment_out reason="vol" | 6587 Charges exceptionnelles vol | 3111 Stocks | Art 41 |
| Peremption (Sprint 35) | adjustment_out reason="expire" | 6586 | 3111 | -- |
| Transfer warehouse (Sprint 35) | transfer | 3112 Stock entrepot B | 3111 Stock entrepot A | -- |
| Cloture annuelle ajustement | Manual | 6195 Charges provisionnees | 3111 / 6022 difference | Art 18 |

### J.2 Strategy retry consumers Books

Pattern outbox idempotent :

```typescript
// Consumer stock-entry-books retry logic
async handle(message: any): Promise<void> {
  const maxRetries = 5;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      await this.books.recordEntry(...);
      return;  // success
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        // Dead-letter queue Sprint 35
        await this.dlq.send(message, err);
        throw err;
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));  // exp backoff
    }
  }
}
```

### J.3 Validation cross-module pre-commit

```bash
# 1. Tous stock movements ont un Books journal entry correspondant (event-driven)
psql $DATABASE_URL -c "
  SELECT m.id, m.movement_type, m.total_cost, je.id AS journal_id
  FROM stock_movements m
  LEFT JOIN books_journal_entries je ON je.source_resource_id = m.id
  WHERE m.created_at > now() - interval '1 day'
    AND je.id IS NULL
    AND m.kafka_published = true
"
# Expected : 0 rows (toute movement deja kafka_published a son journal)

# 2. Test E2E cross-module
pnpm --filter @insurtech/api test:e2e -- garage-end-to-end
```

### J.4 Documentation flows referencee

Voir `repo/docs/integration/stock-hr-garage-flows.md` (Tache 3.6.13) pour scenarios complets garage Atlas demonstration.

---

**Fin ANNEXE J.**
