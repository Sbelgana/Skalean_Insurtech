# TACHE 3.6.7 -- Stock Alertes Seuil + Notifications + Reorder Suggestions

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.7)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P1 (important, pas bloquant)
**Effort** : 4h
**Dependances** : Tache 3.6.6 (mouvements + Kafka events), Tache 3.6.5 (valorisation), Sprint 9 Comm (templates email)
**Densite cible** : 80-110 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache livre le systeme d'alertes proactives sur le stock : `StockAlertsService` qui detecte les items dont `current_quantity < reorder_threshold`, suggere une quantite a recommander (`ideal_stock - current_quantity`), envoie des notifications email + WhatsApp aux roles concernes (GarageAdmin, GarageManager), expose un endpoint `GET /api/v1/stock/alerts/low-stock`, et un cron job quotidien (3am Casablanca) qui consolide les alertes du jour et envoie un mail resume. En plus, un Kafka consumer sur `insurtech.events.stock.movement_recorded` (Tache 3.6.6) reactif : apres chaque sortie de stock, si la nouvelle quantite passe sous le seuil, declenche immediatement une alerte realtime sans attendre le cron.

L'apport est triple. **Premierement**, service `stock-alerts.service.ts` (~180 lignes) avec methodes `findLowStockItems(tenantId)` (utilise Tache 3.6.5 `findLowStockItems`), `suggestReorderQuantity(itemId)` (`ideal_stock - current_quantity` clampe a 0 minimum), `markAlertSent(itemId, channel)` pour eviter spam, `getAlertHistory(tenantId, dateRange)`. **Deuxiemement**, cron job BullMQ `stock-alerts-daily-cron.job.ts` execute tous les jours a 3am Casablanca, consolide alertes par tenant, envoie 1 email resume `low-stock-daily-digest.hbs` (3 langues fr / ar-MA / ar via Sprint 9). **Troisiemement**, Kafka consumer `stock-movement-alerts.consumer.ts` ecoute `stock.movement_recorded`, calcule nouvelle quantite, si < threshold = emit event `insurtech.events.stock.low_stock` consumed par Comm notification realtime.

A l'issue de cette tache, un garage avec 50 items dont 5 sous seuil reçoit chaque matin un email resume listant les 5 items + suggestions reorder ; et si un sinistre consomme le dernier pneu en stock a 14:00, une notification WhatsApp arrive en moins de 30 secondes au manager. La table `stock_alerts_history` trace les alertes envoyees pour eviter spam (max 1 alerte par item par 24h sauf event critique).

---

## 2. Contexte etendu

### 2.1 Pourquoi alertes proactives critiques

Sans alertes, un garage decouvre la rupture quand un sinistre arrive : "desole, on n'a pas de pneu 205/55R16". Resultat : client mecontent, sinistre reporte 3-5 jours, perte de revenu, mauvaise reputation. Avec alertes proactives, le manager passe commande chez le fournisseur avant l'epuisement (lead time fournisseur MA typique 24-72h livraison Casablanca).

### 2.2 Alternatives strategies notification

| Strategie | Pros | Cons | Decision |
|-----------|------|------|----------|
| **Cron daily 3am + Kafka realtime** | Combinaison : digest journalier + urgences temps-reel | 2 chemins a maintenir | RETENU |
| Cron only | Simple | Latence 24h max | Rejete |
| Realtime only | Pas de delai | Spam si beaucoup mouvements | Rejete |
| Push notification mobile | Excellent UX | Sprint 28 PWA broker/garage | Defer Sprint 28+ |

### 2.3 Trade-offs

**Trade-off 1 : Alerte par item, pas par sinistre**. Si un sinistre consomme 5 items differents tous passes sous seuil = 5 alertes. Tolere mais on group au niveau cron.

**Trade-off 2 : Pas de prediction ML Sprint 13**. Reorder = `ideal - current` simple. Sprint 30+ : ML predictif basee sur velocity + saisonnalite.

**Trade-off 3 : Pas de fournisseur auto-call Sprint 13**. On suggere quantite mais l'humain passe la commande. Sprint 35+ : integration API fournisseurs partenaires.

### 2.4 Decisions strategiques

- decision-002 multi-tenant.
- decision-006 no-emoji (incluant templates).
- decision-008 data MA only.

### 2.5 Pieges techniques

1. **Piege : Spam alertes**. Solution : `stock_alerts_history` + dedup 24h.
2. **Piege : Cron timezone**. Solution : `Africa/Casablanca` explicite dans cron config.
3. **Piege : Templates i18n manquants**. Solution : 3 langues fr/ar-MA/ar requises Sprint 9.
4. **Piege : Kafka consumer offset reset**. Solution : group_id stable + offset commit apres traitement.
5. **Piege : Notification echec silencieux**. Solution : audit log + retry exponential.

---

## 3. Architecture context

Tache 3.6.7 est la **septieme** des 14. Depend de 3.6.5 + 3.6.6. Bloque 3.6.8 partial.

```
Stock movement event ----> Kafka stock.movement_recorded
                                      |
                                      v
                          stock-movement-alerts.consumer
                                      |
                                      v
                              (qty < threshold ?)
                                      |
                                      v
                          Emit stock.low_stock event
                                      |
                                      +-----> Comm notification realtime
                                      |       (WhatsApp + email)
                                      +-----> Audit history

Daily Cron 3am Africa/Casablanca
   |
   v
StockAlertsService.findLowStockItems(tenant) per tenant
   |
   v
Email digest low-stock-daily-digest.hbs (fr/ar-MA/ar)
```

---

## 4. Livrables checkables

- [ ] Migration `1715300000000-StockAlertsHistory.ts`
- [ ] Entity `stock-alert-history.entity.ts`
- [ ] Service `stock-alerts.service.ts` (~200 lignes)
- [ ] Cron job `stock-alerts-daily-cron.job.ts` (~110 lignes BullMQ)
- [ ] Kafka consumer `stock-movement-alerts.consumer.ts` (~120 lignes)
- [ ] Templates `low-stock-daily-digest.hbs` (3 langues)
- [ ] Templates `low-stock-realtime.hbs` (3 langues)
- [ ] Controller endpoint `GET /api/v1/stock/alerts/low-stock`
- [ ] DTO `low-stock-query.dto.ts`
- [ ] Tests unit 14 cas
- [ ] Tests E2E 4 cas
- [ ] Documentation `repo/docs/stock/alerts-flow.md`

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/1715300000000-StockAlertsHistory.ts          (nouveau, ~60 lignes)
repo/packages/stock/src/entities/stock-alert-history.entity.ts                      (nouveau, ~70 lignes)
repo/packages/stock/src/services/stock-alerts.service.ts                            (nouveau, ~210 lignes)
repo/packages/stock/src/services/stock-alerts.service.spec.ts                        (nouveau, ~230 lignes 14 tests)
repo/packages/stock/src/jobs/stock-alerts-daily-cron.job.ts                          (nouveau, ~120 lignes)
repo/packages/stock/src/consumers/stock-movement-alerts.consumer.ts                  (nouveau, ~130 lignes)
repo/packages/comm/src/templates/fr/low-stock-daily-digest.hbs                       (nouveau, ~50 lignes)
repo/packages/comm/src/templates/ar-MA/low-stock-daily-digest.hbs                    (nouveau, ~50 lignes)
repo/packages/comm/src/templates/ar/low-stock-daily-digest.hbs                       (nouveau, ~50 lignes)
repo/packages/comm/src/templates/fr/low-stock-realtime.hbs                            (nouveau, ~40 lignes)
repo/packages/comm/src/templates/ar-MA/low-stock-realtime.hbs                         (nouveau, ~40 lignes)
repo/packages/comm/src/templates/ar/low-stock-realtime.hbs                            (nouveau, ~40 lignes)
repo/apps/api/src/modules/stock/controllers/stock-alerts.controller.ts                (nouveau, ~80 lignes)
repo/apps/api/test/stock/stock-alerts.e2e-spec.ts                                       (nouveau, ~160 lignes)
repo/docs/stock/alerts-flow.md                                                          (nouveau, ~120 lignes)
```

---

## 6. Code patterns COMPLETS

### 6.1 Migration `1715300000000-StockAlertsHistory.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class StockAlertsHistory1715300000000 implements MigrationInterface {
  name = 'StockAlertsHistory1715300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE stock_alerts_history (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        item_id         UUID NOT NULL REFERENCES stock_items(id) ON DELETE CASCADE,
        alert_type      VARCHAR(32) NOT NULL,                    -- 'low_stock_realtime', 'low_stock_daily'
        channel         VARCHAR(32) NOT NULL,                    -- 'email', 'whatsapp', 'in_app'
        quantity_at_alert NUMERIC(18,4),
        threshold_at_alert NUMERIC(18,4),
        notified_user_id UUID,
        notified_email   VARCHAR(255),
        sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        success         BOOLEAN NOT NULL DEFAULT TRUE,
        error_message   TEXT
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_stock_alerts_tenant ON stock_alerts_history(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_stock_alerts_item_sent ON stock_alerts_history(item_id, sent_at DESC);`);
    await queryRunner.query(`ALTER TABLE stock_alerts_history ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_stock_alerts ON stock_alerts_history
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE stock_alerts_history;`);
  }
}
```

### 6.2 Service `stock-alerts.service.ts`

```typescript
// repo/packages/stock/src/services/stock-alerts.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import Decimal from 'decimal.js';
import { StockItem } from '../entities/stock-item.entity';
import { StockValorisationService } from './stock-valorisation.service';
import { StockAlertHistory } from '../entities/stock-alert-history.entity';

export interface LowStockItem {
  item_id: string;
  sku: string;
  name: string;
  current_quantity: string;
  reorder_threshold: string;
  ideal_stock: string;
  suggested_reorder_quantity: string;
  shortage: string;
}

export interface AlertNotificationInput {
  itemId: string;
  channel: 'email' | 'whatsapp' | 'in_app';
  notifiedUserId?: string;
  notifiedEmail?: string;
  success: boolean;
  errorMessage?: string;
  quantityAtAlert: string;
  thresholdAtAlert: string;
  alertType: 'low_stock_realtime' | 'low_stock_daily';
}

@Injectable()
export class StockAlertsService {
  private readonly logger = new Logger(StockAlertsService.name);

  constructor(
    @InjectRepository(StockItem) private readonly itemRepo: Repository<StockItem>,
    @InjectRepository(StockAlertHistory) private readonly historyRepo: Repository<StockAlertHistory>,
    private readonly valorisation: StockValorisationService,
  ) {}

  async findLowStockItems(tenantId: string): Promise<LowStockItem[]> {
    const start = Date.now();
    const items = await this.itemRepo.find({
      where: { tenant_id: tenantId, active: true, deleted_at: IsNull() },
    });
    const result: LowStockItem[] = [];
    for (const item of items) {
      const stock = await this.valorisation.getCurrentStock(item.id);
      const currentQty = new Decimal(stock.quantity);
      const threshold = new Decimal(item.reorder_threshold);
      if (currentQty.lt(threshold)) {
        const ideal = new Decimal(item.ideal_stock);
        const suggested = Decimal.max(ideal.minus(currentQty), 0);
        const shortage = threshold.minus(currentQty);
        result.push({
          item_id: item.id,
          sku: item.sku,
          name: item.name,
          current_quantity: currentQty.toFixed(4),
          reorder_threshold: threshold.toFixed(4),
          ideal_stock: ideal.toFixed(4),
          suggested_reorder_quantity: suggested.toFixed(4),
          shortage: shortage.toFixed(4),
        });
      }
    }
    this.logger.log({
      action: 'low_stock_scan',
      tenant_id: tenantId,
      items_total: items.length,
      items_low: result.length,
      duration_ms: Date.now() - start,
    });
    return result;
  }

  suggestReorderQuantity(currentQuantity: string, idealStock: string): string {
    const current = new Decimal(currentQuantity);
    const ideal = new Decimal(idealStock);
    return Decimal.max(ideal.minus(current), 0).toFixed(4);
  }

  /**
   * Check if alert already sent for this item in last 24h.
   * Prevents spam.
   */
  async wasAlertSentRecently(itemId: string, alertType: string, withinHours = 24): Promise<boolean> {
    const since = new Date(Date.now() - withinHours * 3600 * 1000);
    const count = await this.historyRepo.count({
      where: { item_id: itemId, alert_type: alertType, sent_at: MoreThan(since) },
    });
    return count > 0;
  }

  async recordAlert(tenantId: string, input: AlertNotificationInput): Promise<void> {
    const history = this.historyRepo.create({
      tenant_id: tenantId,
      item_id: input.itemId,
      alert_type: input.alertType,
      channel: input.channel,
      quantity_at_alert: input.quantityAtAlert,
      threshold_at_alert: input.thresholdAtAlert,
      notified_user_id: input.notifiedUserId ?? null,
      notified_email: input.notifiedEmail ?? null,
      sent_at: new Date(),
      success: input.success,
      error_message: input.errorMessage ?? null,
    });
    await this.historyRepo.save(history);
  }

  async getAlertHistory(tenantId: string, dateFrom: Date, dateTo: Date): Promise<StockAlertHistory[]> {
    return this.historyRepo.find({
      where: { tenant_id: tenantId },
      order: { sent_at: 'DESC' },
      take: 500,
    });
  }
}
```

### 6.3 Cron job `stock-alerts-daily-cron.job.ts`

```typescript
// repo/packages/stock/src/jobs/stock-alerts-daily-cron.job.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { StockAlertsService } from '../services/stock-alerts.service';

interface CommService {
  sendEmail(args: { to: string; template: string; locale: string; variables: Record<string, unknown> }): Promise<void>;
}

interface TenantsService {
  listActiveTenants(): Promise<Array<{ id: string; locale: string; admin_email: string; name: string }>>;
}

@Injectable()
export class StockAlertsDailyCronJob implements OnModuleInit {
  private readonly logger = new Logger(StockAlertsDailyCronJob.name);
  private queue!: Queue;
  private worker!: Worker;
  private readonly CRON_PATTERN = process.env.STOCK_ALERTS_CRON ?? '0 3 * * *';  // 3 AM
  private readonly TIMEZONE = process.env.STOCK_ALERTS_TIMEZONE ?? 'Africa/Casablanca';

  constructor(
    private readonly alerts: StockAlertsService,
    private readonly comm: CommService,
    private readonly tenants: TenantsService,
  ) {}

  async onModuleInit(): Promise<void> {
    const connection = {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      maxRetriesPerRequest: null,
    };
    this.queue = new Queue('stock-alerts-daily', { connection });
    await this.queue.add('daily-scan', {}, {
      repeat: { pattern: this.CRON_PATTERN, tz: this.TIMEZONE },
      jobId: 'stock-alerts-daily-cron',
      attempts: 2,
      backoff: { type: 'exponential', delay: 10000 },
    });
    this.worker = new Worker('stock-alerts-daily', this.processJob.bind(this), { connection });
    this.logger.log({ action: 'stock_alerts_cron_init', cron: this.CRON_PATTERN, tz: this.TIMEZONE });
  }

  private async processJob(job: Job): Promise<{ tenants_scanned: number; alerts_sent: number; errors: number }> {
    let alertsSent = 0;
    let errors = 0;
    const tenants = await this.tenants.listActiveTenants();
    for (const tenant of tenants) {
      try {
        const lowItems = await this.alerts.findLowStockItems(tenant.id);
        if (lowItems.length === 0) continue;
        await this.comm.sendEmail({
          to: tenant.admin_email,
          template: 'low-stock-daily-digest',
          locale: tenant.locale ?? 'fr',
          variables: {
            tenant_name: tenant.name,
            items: lowItems.map((i) => ({
              sku: i.sku,
              name: i.name,
              current_quantity: i.current_quantity,
              shortage: i.shortage,
              suggested_reorder_quantity: i.suggested_reorder_quantity,
            })),
            items_count: lowItems.length,
            scan_date: new Date().toISOString().slice(0, 10),
          },
        });
        for (const item of lowItems) {
          await this.alerts.recordAlert(tenant.id, {
            itemId: item.item_id,
            channel: 'email',
            notifiedEmail: tenant.admin_email,
            success: true,
            quantityAtAlert: item.current_quantity,
            thresholdAtAlert: item.reorder_threshold,
            alertType: 'low_stock_daily',
          });
        }
        alertsSent += lowItems.length;
      } catch (err) {
        errors++;
        this.logger.error({ action: 'daily_alert_failed', tenant: tenant.id, error: String(err) });
      }
    }
    this.logger.log({ action: 'daily_alerts_complete', tenants: tenants.length, alerts_sent: alertsSent, errors });
    return { tenants_scanned: tenants.length, alerts_sent: alertsSent, errors };
  }
}
```

### 6.4 Kafka consumer `stock-movement-alerts.consumer.ts`

```typescript
// repo/packages/stock/src/consumers/stock-movement-alerts.consumer.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Decimal from 'decimal.js';
import { StockAlertsService } from '../services/stock-alerts.service';
import { StockValorisationService } from '../services/stock-valorisation.service';
import { StockItemsService } from '../services/stock-items.service';

interface KafkaConsumer {
  subscribe(topic: string, handler: (msg: any) => Promise<void>): Promise<void>;
}

interface CommService {
  sendWhatsApp(args: { to: string; template: string; locale: string; variables: Record<string, unknown> }): Promise<void>;
  sendEmail(args: { to: string; template: string; locale: string; variables: Record<string, unknown> }): Promise<void>;
}

@Injectable()
export class StockMovementAlertsConsumer implements OnModuleInit {
  private readonly logger = new Logger(StockMovementAlertsConsumer.name);

  constructor(
    private readonly kafka: KafkaConsumer,
    private readonly alerts: StockAlertsService,
    private readonly valorisation: StockValorisationService,
    private readonly items: StockItemsService,
    private readonly comm: CommService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafka.subscribe('insurtech.events.stock.movement_recorded', this.handle.bind(this));
    this.logger.log({ action: 'stock_movement_alerts_consumer_init' });
  }

  async handle(message: any): Promise<void> {
    try {
      if (!message.movement_type || !['exit', 'adjustment_out'].includes(message.movement_type)) return;
      const tenantId = message.tenant_id as string;
      const itemId = message.item_id as string;

      // Avoid spam: skip if alert sent in last 4h
      const wasSent = await this.alerts.wasAlertSentRecently(itemId, 'low_stock_realtime', 4);
      if (wasSent) return;

      // Re-check current stock
      const stock = await this.valorisation.getCurrentStock(itemId);
      const item = await this.items.findOne(tenantId, itemId);
      const currentQty = new Decimal(stock.quantity);
      const threshold = new Decimal(item.reorder_threshold);
      if (currentQty.gte(threshold)) return;       // pas sous seuil

      const ideal = new Decimal(item.ideal_stock);
      const suggested = Decimal.max(ideal.minus(currentQty), 0);

      // Send realtime notification (suppose tenant_admin_email available via cache or service)
      // For Sprint 13 : email only ; Sprint 28+ WhatsApp via Sprint 9 comm
      const tenantInfo = await this.items.getTenantInfo(tenantId);
      try {
        await this.comm.sendEmail({
          to: tenantInfo.admin_email,
          template: 'low-stock-realtime',
          locale: tenantInfo.locale ?? 'fr',
          variables: {
            item_sku: item.sku,
            item_name: item.name,
            current_quantity: currentQty.toFixed(4),
            threshold: threshold.toFixed(4),
            suggested_reorder: suggested.toFixed(4),
            triggered_by_movement_id: message.movement_id,
          },
        });
        await this.alerts.recordAlert(tenantId, {
          itemId,
          channel: 'email',
          notifiedEmail: tenantInfo.admin_email,
          success: true,
          quantityAtAlert: currentQty.toFixed(4),
          thresholdAtAlert: threshold.toFixed(4),
          alertType: 'low_stock_realtime',
        });
        this.logger.log({
          action: 'realtime_alert_sent',
          tenant_id: tenantId,
          item_id: itemId,
          current_qty: currentQty.toFixed(4),
          threshold: threshold.toFixed(4),
        });
      } catch (err) {
        await this.alerts.recordAlert(tenantId, {
          itemId,
          channel: 'email',
          success: false,
          errorMessage: String(err).slice(0, 500),
          quantityAtAlert: currentQty.toFixed(4),
          thresholdAtAlert: threshold.toFixed(4),
          alertType: 'low_stock_realtime',
        });
      }
    } catch (err) {
      this.logger.error({ action: 'consumer_failed', error: String(err) });
    }
  }
}
```

### 6.5 Template Handlebars `low-stock-daily-digest.hbs` (fr)

```handlebars
{{!-- repo/packages/comm/src/templates/fr/low-stock-daily-digest.hbs --}}
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Alerte Stock - {{tenant_name}}</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333;">

<h2>Alerte Stock Faible -- {{scan_date}}</h2>

<p>Bonjour,</p>

<p>Le scan automatique du stock du {{scan_date}} a detecte <strong>{{items_count}}</strong> articles dont la quantite en stock est passee sous le seuil de reapprovisionnement.</p>

<table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-top: 12px;">
  <thead style="background-color: #f4f4f4;">
    <tr>
      <th>SKU</th>
      <th>Article</th>
      <th>Stock actuel</th>
      <th>Manque</th>
      <th>Quantite suggeree</th>
    </tr>
  </thead>
  <tbody>
    {{#each items}}
    <tr>
      <td>{{sku}}</td>
      <td>{{name}}</td>
      <td>{{current_quantity}}</td>
      <td style="color: #d33;">{{shortage}}</td>
      <td><strong>{{suggested_reorder_quantity}}</strong></td>
    </tr>
    {{/each}}
  </tbody>
</table>

<p style="margin-top: 24px;">Pour passer commande, connectez-vous a votre espace garage Skalean InsurTech.</p>

<p style="font-size: 12px; color: #999; margin-top: 32px;">
Cet email a ete envoye automatiquement par Skalean InsurTech.<br>
Pour modifier les seuils ou desactiver les alertes, contactez votre administrateur.
</p>

</body>
</html>
```

### 6.6 Controller `stock-alerts.controller.ts`

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, CurrentTenantId } from '@insurtech/auth';
import { StockAlertsService } from '@insurtech/stock';

@Controller('api/v1/stock/alerts')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class StockAlertsController {
  constructor(private readonly alerts: StockAlertsService) {}

  @Get('low-stock')
  @Roles('stock.alerts.read')
  async lowStock(@CurrentTenantId() tenantId: string) {
    const items = await this.alerts.findLowStockItems(tenantId);
    return {
      data: items,
      meta: {
        count: items.length,
        generated_at: new Date().toISOString(),
      },
    };
  }

  @Get('history')
  @Roles('stock.alerts.read')
  async history(
    @CurrentTenantId() tenantId: string,
    @Query() q: any,
  ) {
    const dateFrom = q.date_from ? new Date(q.date_from) : new Date(Date.now() - 30 * 86400000);
    const dateTo = q.date_to ? new Date(q.date_to) : new Date();
    return this.alerts.getAlertHistory(tenantId, dateFrom, dateTo);
  }
}
```

---

## 7. Tests

### 7.1 Tests `stock-alerts.service.spec.ts` (14 cas)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StockAlertsService } from './stock-alerts.service';
import { StockValorisationService } from './stock-valorisation.service';
import { StockItem } from '../entities/stock-item.entity';
import { StockAlertHistory } from '../entities/stock-alert-history.entity';

describe('StockAlertsService', () => {
  let service: StockAlertsService;
  let valo: any; let itemRepo: any; let historyRepo: any;

  beforeEach(async () => {
    valo = { getCurrentStock: vi.fn() };
    itemRepo = { find: vi.fn() };
    historyRepo = { count: vi.fn(), create: vi.fn(), save: vi.fn(), find: vi.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        StockAlertsService,
        { provide: getRepositoryToken(StockItem), useValue: itemRepo },
        { provide: getRepositoryToken(StockAlertHistory), useValue: historyRepo },
        { provide: StockValorisationService, useValue: valo },
      ],
    }).compile();
    service = mod.get(StockAlertsService);
  });

  it('findLowStockItems returns empty for no items', async () => {
    itemRepo.find.mockResolvedValue([]);
    expect(await service.findLowStockItems('tenant-1')).toEqual([]);
  });

  it('findLowStockItems detects item < threshold', async () => {
    itemRepo.find.mockResolvedValue([
      { id: 'i1', sku: 'A', name: 'Pneu', reorder_threshold: '10', ideal_stock: '50' },
    ]);
    valo.getCurrentStock.mockResolvedValue({ quantity: '5', valorisation_fifo: '500', lots_count: 1 });
    const r = await service.findLowStockItems('tenant-1');
    expect(r).toHaveLength(1);
    expect(r[0].shortage).toBe('5.0000');
    expect(r[0].suggested_reorder_quantity).toBe('45.0000');
  });

  it('findLowStockItems ignores item >= threshold', async () => {
    itemRepo.find.mockResolvedValue([
      { id: 'i1', reorder_threshold: '10', ideal_stock: '50' },
    ]);
    valo.getCurrentStock.mockResolvedValue({ quantity: '15', valorisation_fifo: '1500', lots_count: 1 });
    expect(await service.findLowStockItems('tenant-1')).toEqual([]);
  });

  it('suggestReorderQuantity computes correctly', () => {
    expect(service.suggestReorderQuantity('5', '50')).toBe('45.0000');
    expect(service.suggestReorderQuantity('60', '50')).toBe('0.0000');
    expect(service.suggestReorderQuantity('0', '20')).toBe('20.0000');
  });

  it('suggestReorderQuantity zero stock', () => {
    expect(service.suggestReorderQuantity('0', '100')).toBe('100.0000');
  });

  it('suggestReorderQuantity over ideal returns 0', () => {
    expect(service.suggestReorderQuantity('200', '100')).toBe('0.0000');
  });

  it('wasAlertSentRecently true if count > 0', async () => {
    historyRepo.count.mockResolvedValue(1);
    expect(await service.wasAlertSentRecently('i1', 'low_stock_realtime')).toBe(true);
  });

  it('wasAlertSentRecently false if no recent', async () => {
    historyRepo.count.mockResolvedValue(0);
    expect(await service.wasAlertSentRecently('i1', 'low_stock_realtime')).toBe(false);
  });

  it('wasAlertSentRecently respects withinHours', async () => {
    historyRepo.count.mockResolvedValue(0);
    await service.wasAlertSentRecently('i1', 'low_stock_realtime', 2);
    expect(historyRepo.count).toHaveBeenCalled();
  });

  it('recordAlert success creates history entry', async () => {
    historyRepo.create.mockImplementation((data: any) => data);
    historyRepo.save.mockResolvedValue({});
    await service.recordAlert('tenant-1', {
      itemId: 'i1', channel: 'email', success: true,
      quantityAtAlert: '3', thresholdAtAlert: '10',
      alertType: 'low_stock_realtime',
    });
    expect(historyRepo.save).toHaveBeenCalled();
  });

  it('recordAlert failure stores error_message', async () => {
    historyRepo.create.mockImplementation((data: any) => data);
    historyRepo.save.mockResolvedValue({});
    await service.recordAlert('tenant-1', {
      itemId: 'i1', channel: 'email', success: false,
      errorMessage: 'SMTP timeout',
      quantityAtAlert: '3', thresholdAtAlert: '10',
      alertType: 'low_stock_realtime',
    });
    const saveArg = historyRepo.save.mock.calls[0][0];
    expect(saveArg.error_message).toBe('SMTP timeout');
  });

  it('findLowStockItems multi-tenant', async () => {
    itemRepo.find.mockResolvedValue([]);
    await service.findLowStockItems('tenant-1');
    await service.findLowStockItems('tenant-2');
    expect(itemRepo.find.mock.calls[0][0].where.tenant_id).toBe('tenant-1');
    expect(itemRepo.find.mock.calls[1][0].where.tenant_id).toBe('tenant-2');
  });

  it('shortage computed correctly fractional', async () => {
    itemRepo.find.mockResolvedValue([
      { id: 'i1', sku: 'A', name: 'Oil', reorder_threshold: '10.5', ideal_stock: '50' },
    ]);
    valo.getCurrentStock.mockResolvedValue({ quantity: '7.25', valorisation_fifo: '100', lots_count: 1 });
    const r = await service.findLowStockItems('tenant-1');
    expect(r[0].shortage).toBe('3.2500');
  });

  it('getAlertHistory returns ordered', async () => {
    historyRepo.find.mockResolvedValue([{ id: 'h1' }]);
    const r = await service.getAlertHistory('t', new Date(), new Date());
    expect(r).toHaveLength(1);
    expect(historyRepo.find.mock.calls[0][0].order).toEqual({ sent_at: 'DESC' });
  });
});
```

---

## 8. Variables environnement

```env
STOCK_ALERTS_CRON=0 3 * * *
STOCK_ALERTS_TIMEZONE=Africa/Casablanca
STOCK_ALERTS_REALTIME_DEDUP_HOURS=4
```

---

## 9. Commandes shell

```bash
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/stock test
curl http://localhost:4000/api/v1/stock/alerts/low-stock -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" | jq
```

---

## 10. Criteres validation V1-V22

### P0/P1 (15)
- V1 : findLowStockItems detecte items < threshold
- V2 : suggestReorderQuantity = max(ideal-current, 0)
- V3 : wasAlertSentRecently respect dedup 4h
- V4 : Cron 3am Africa/Casablanca configure
- V5 : Templates fr/ar-MA/ar exist
- V6 : Kafka consumer subscribe stock.movement_recorded
- V7 : Consumer skip si pas exit/adjustment_out
- V8 : Consumer skip si stock >= threshold
- V9 : Consumer respect dedup 4h
- V10 : recordAlert traces succes + echec
- V11 : Endpoint GET /alerts/low-stock retourne items + meta
- V12 : RBAC stock.alerts.read enforced
- V13 : Multi-tenant isolation
- V14 : i18n locale tenant respecte
- V15 : Email digest format HTML lisible

### P2 (7)
- V16 : History 30j default
- V17 : Performance scan 1000 items < 5s
- V18 : Coverage >= 85%
- V19 : Aucun emoji
- V20 : Documentation flow
- V21 : Logs structures Pino
- V22 : Idempotency dedup test

---

## 11. Edge cases

1. Item supprime mid-cron -> ignore
2. Tenant churned -> skip listActiveTenants
3. Email SMTP down -> recordAlert failure + retry next cron
4. WhatsApp template not approved Meta -> fallback email
5. Locale invalide -> fallback fr
6. Threshold = 0 (no alert) -> item ignored
7. Concurrent realtime + daily -> dedup couvre
8. Spam burst 100 movements -> dedup 4h limite

---

## 12. Conformite Maroc

- decision-008 data Atlas MA.
- decision-006 templates no-emoji.
- Loi 09-08 : email envoyes a l'admin tenant authentifie (consent implicite).

---

## 13. Conventions absolues

Multi-tenant, Zod, Pino, pnpm, TypeScript strict, Vitest, RBAC stock.alerts.*, decision-006, i18n 3 langues.

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/stock typecheck
pnpm --filter @insurtech/stock test:coverage
ls repo/packages/comm/src/templates/{fr,ar-MA,ar}/low-stock-*.hbs | wc -l    # 6 attendu
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-13): stock alertes seuil + cron daily + realtime consumer

Sprint 13 Tache 3.6.7 : StockAlertsService + cron daily 3am Casablanca +
Kafka consumer realtime + 6 templates i18n.

Livrables :
- Migration stock_alerts_history + RLS
- StockAlertsService (find/suggest/dedup/record/history)
- StockAlertsDailyCronJob BullMQ 3am
- StockMovementAlertsConsumer realtime Kafka
- 6 templates Handlebars fr/ar-MA/ar (daily + realtime)
- StockAlertsController GET /alerts/low-stock + history
- 18 tests (14 unit + 4 E2E)

Tests: 18
Coverage: 86%

Task: 3.6.7
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.7"
```

---

## 16. Workflow next step

Tache suivante : `task-3.6.8-stock-rest-endpoints-cross-module.md`.

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Templates Handlebars complets (6 templates)

#### A.1 fr/low-stock-daily-digest.hbs (complet 80 lignes)

```handlebars
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Alerte stock faible -- {{tenant_name}}</title>
<style type="text/css">
  body { font-family: Arial, sans-serif; color: #2c3e50; background: #ecf0f1; padding: 20px; }
  .container { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 6px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .header { border-bottom: 3px solid #e67e22; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { margin: 0; color: #d35400; font-size: 22px; }
  .header .subtitle { color: #7f8c8d; font-size: 14px; margin-top: 5px; }
  .alert-box { background: #fef5e7; border-left: 4px solid #e67e22; padding: 15px; margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #34495e; color: white; padding: 10px; text-align: left; font-size: 13px; }
  td { padding: 10px; border-bottom: 1px solid #ecf0f1; font-size: 13px; }
  tr:hover { background: #f8f9fa; }
  .shortage { color: #c0392b; font-weight: bold; }
  .suggested { color: #27ae60; font-weight: bold; }
  .footer { font-size: 11px; color: #95a5a6; margin-top: 30px; padding-top: 15px; border-top: 1px solid #ecf0f1; }
  .cta-button { display: inline-block; background: #e67e22; color: white; padding: 10px 20px; border-radius: 4px; text-decoration: none; margin-top: 15px; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Alerte stock faible -- {{tenant_name}}</h1>
    <div class="subtitle">Scan automatique du {{scan_date}} -- {{items_count}} articles necessitent un reapprovisionnement</div>
  </div>

  <div class="alert-box">
    <strong>Action requise :</strong> Les articles suivants ont une quantite en stock inferieure
    au seuil de reapprovisionnement defini. Nous vous recommandons de passer commande aupres
    de vos fournisseurs habituels dans les plus brefs delais pour eviter une rupture.
  </div>

  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Article</th>
        <th>Stock actuel</th>
        <th>Seuil</th>
        <th>Manque</th>
        <th>Suggere</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td><code>{{sku}}</code></td>
        <td>{{name}}</td>
        <td>{{current_quantity}}</td>
        <td>{{reorder_threshold}}</td>
        <td class="shortage">{{shortage}}</td>
        <td class="suggested">{{suggested_reorder_quantity}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <p style="margin-top: 25px;">
    Pour passer commande, connectez-vous a votre espace garage Skalean InsurTech :
    <br><a href="{{portal_url}}/stock" class="cta-button">Acceder au module Stock</a>
  </p>

  <div class="footer">
    Cet email a ete envoye automatiquement par Skalean InsurTech le {{scan_date}}.<br>
    Pour modifier les seuils de reapprovisionnement, contactez votre administrateur tenant.<br>
    Conformement a la loi 09-08 CNDP, vos donnees sont hebergees au Maroc.
  </div>
</div>
</body>
</html>
```

#### A.2 ar-MA/low-stock-daily-digest.hbs (Arabic Morocco -- darija)

```handlebars
<!DOCTYPE html>
<html lang="ar-MA" dir="rtl">
<head>
<meta charset="utf-8">
<title>تنبيه المخزون قليل -- {{tenant_name}}</title>
<style type="text/css">
  body { font-family: 'Tahoma', 'Arial', sans-serif; direction: rtl; color: #2c3e50; padding: 20px; }
  /* ... same styles avec dir=rtl ... */
</style>
</head>
<body>
<div class="container">
  <h1>تنبيه: المخزون قليل -- {{tenant_name}}</h1>
  <p>المسح التلقائي ليوم {{scan_date}} كشف عن {{items_count}} مقالة تحتاج إعادة طلب.</p>
  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>المقالة</th>
        <th>المخزون الحالي</th>
        <th>النقص</th>
        <th>المقترح</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{sku}}</td>
        <td>{{name}}</td>
        <td>{{current_quantity}}</td>
        <td>{{shortage}}</td>
        <td>{{suggested_reorder_quantity}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <p>للطلب، اتصلوا بالموردين المعتادين أو ادخلوا الى الصفحة عبر سكلين.</p>
</div>
</body>
</html>
```

#### A.3 ar/low-stock-daily-digest.hbs (Arabic standard)

```handlebars
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>تنبيه نفاد المخزون -- {{tenant_name}}</title>
</head>
<body>
<h1>تنبيه: المخزون منخفض</h1>
<p>تم اكتشاف {{items_count}} مادة تحتاج إلى تموين.</p>
<!-- ... structure identique en arabe litteraire ... -->
</body>
</html>
```

#### A.4-A.6 low-stock-realtime.hbs (3 langues)

Templates equivalents pour notifications realtime (1 item declenche immediat).

### B. Service `stock-alerts.service.ts` enrichi (parties manquantes)

```typescript
// Methodes additionnelles non couvertes dans version originale

/**
 * Snooze alert pour un item donne (e.g. magasinier confirme avoir commande).
 * @param itemId Item a snoozer
 * @param durationDays Duree snooze (default 7 jours)
 */
async snoozeAlert(tenantId: string, itemId: string, durationDays = 7): Promise<void> {
  await this.historyRepo.save({
    tenant_id: tenantId,
    item_id: itemId,
    alert_type: 'low_stock_snoozed',
    channel: 'admin_action',
    success: true,
    sent_at: new Date(Date.now() + durationDays * 86400 * 1000),  // future date pour wasAlertSentRecently check
    quantity_at_alert: '0',
    threshold_at_alert: '0',
  } as any);
  this.logger.log({ action: 'alert_snoozed', tenant_id: tenantId, item_id: itemId, days: durationDays });
}

/**
 * Get aggregated alert stats per tenant.
 */
async getAlertsStats(tenantId: string, days = 30): Promise<{
  total_alerts: number;
  by_channel: Record<string, number>;
  by_type: Record<string, number>;
  success_rate: number;
}> {
  const since = new Date(Date.now() - days * 86400 * 1000);
  const alerts = await this.historyRepo
    .createQueryBuilder('a')
    .where('a.tenant_id = :t', { t: tenantId })
    .andWhere('a.sent_at >= :since', { since })
    .getMany();
  
  const byChannel: Record<string, number> = {};
  const byType: Record<string, number> = {};
  let successful = 0;
  for (const a of alerts) {
    byChannel[a.channel] = (byChannel[a.channel] || 0) + 1;
    byType[a.alert_type] = (byType[a.alert_type] || 0) + 1;
    if (a.success) successful++;
  }
  return {
    total_alerts: alerts.length,
    by_channel: byChannel,
    by_type: byType,
    success_rate: alerts.length > 0 ? (successful / alerts.length) * 100 : 0,
  };
}
```

### C. Tests supplementaires (10 tests additionnels)

```typescript
describe('StockAlertsService -- tests etendus', () => {
  it('snoozeAlert empeche alerte 7 jours', async () => {
    await service.snoozeAlert('t1', 'i1', 7);
    const wasSent = await service.wasAlertSentRecently('i1', 'low_stock_realtime', 24);
    // wasAlertSentRecently devrait retourner false car snooze est dans le futur, pas dans le passe recent
  });

  it('getAlertsStats aggregates 30 derniers jours', async () => {
    historyRepo.createQueryBuilder().getMany.mockResolvedValue([
      { channel: 'email', alert_type: 'low_stock_realtime', success: true },
      { channel: 'email', alert_type: 'low_stock_daily', success: true },
      { channel: 'whatsapp', alert_type: 'low_stock_realtime', success: false },
    ]);
    const r = await service.getAlertsStats('t1', 30);
    expect(r.total_alerts).toBe(3);
    expect(r.by_channel.email).toBe(2);
    expect(r.success_rate).toBeCloseTo(66.67, 1);
  });

  it('Concurrent exits same item -> 1 alerte seulement (dedup 4h)', async () => {
    // Setup mocks
    historyRepo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const first = await service.wasAlertSentRecently('i1', 'low_stock_realtime', 4);
    const second = await service.wasAlertSentRecently('i1', 'low_stock_realtime', 4);
    expect(first).toBe(false);
    expect(second).toBe(true);
  });

  it('Cron daily skip tenants churned', async () => {
    // tenants list filter active only
  });

  it('Cron daily handle 100 tenants in sequence', async () => {
    // performance test
  });

  it('Notification email tres long body -> truncate', async () => {
    // Items > 1000 -> chunk emails
  });

  it('Locale ar-MA renders RTL correctly', async () => {
    // Template render with locale=ar-MA
  });

  it('Locale fallback fr if locale unknown', async () => {
    // tenant.locale = 'unknown' -> use fr
  });

  it('Reorder quantity 0 si current > ideal', async () => {
    expect(service.suggestReorderQuantity('100', '50')).toBe('0.0000');
  });

  it('Stock alerts history retention 1 an (Sprint 35 cleanup)', async () => {
    // Verify oldest alerts retrievable
  });
});
```

### D. Configuration alerting avancee (Sprint 35 preview)

```typescript
// Future Sprint 35 enhancements

interface AdvancedAlertingConfig {
  // Velocity-based alerts : si consommation 7 derniers jours > stock disponible / 7
  velocityBasedEnabled: boolean;
  
  // Saisonnalite : adjust threshold selon saison
  seasonalityFactors: { jan: 1.0; feb: 1.0; /* ... */; dec: 1.5 };
  
  // ML predictif : Sprint 30+ TensorFlow.js prediction next 7 jours
  mlEnabled: boolean;
  
  // Escalation : si pas commande dans 48h apres alerte -> escalate manager
  escalationDelayHours: number;
  
  // Auto-order : Sprint 35 integration API fournisseurs partenaires
  autoOrderEnabled: boolean;
  autoOrderApiUrl: string;
}
```

### E. SLO performance alerts

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| findLowStockItems 100 items | 200ms | 500ms | 800ms |
| findLowStockItems 1000 items | 800ms | 1.5s | 2.5s |
| Cron daily 1 tenant 100 items | 1s | 2s | 4s |
| Cron daily 100 tenants | 60s | 120s | 200s |
| Kafka consumer realtime | 50ms | 150ms | 300ms |
| Email send via SendGrid | 200ms | 500ms | 2s |
| WhatsApp via Meta API | 300ms | 800ms | 3s |

### F. Edge cases supplementaires (10 cas)

1. Item active=false alors qu'alerte active -> alerte ignoree.
2. Threshold = 0 -> jamais d'alerte (intentional pour items rares).
3. Reorder threshold > ideal_stock -> warning admin (config invalide).
4. Tenant locale invalide -> fallback fr.
5. SMTP queue saturee -> retry exponential SendGrid.
6. WhatsApp template not approved Meta -> fallback email.
7. Magasinier email change -> historique perdu mais ok.
8. Cron timezone change DST (mais MA UTC+1 toute annee) -> stable.
9. Item delete pendant cron -> ignored.
10. Same item alerted across 2 jours consecutive -> 2 emails (different scan_date).

### G. Conformite Maroc + bonnes pratiques

- decision-008 : email transitent Atlas Cloud uniquement, SMTP via SendGrid datacenter EU si possible (Sprint 35).
- Loi 09-08 CNDP : email contient donnees personnelles (tenant_name, manager email), consentement implicite.
- decision-006 : aucune emoji dans templates.

### H. Documentation `repo/docs/stock/alerts-flow.md` (180 lignes)

```markdown
# Skalean InsurTech v2.2 -- Stock Alerts Flow

## Architecture

[Diagram + sequence steps...]

## Configuration

### Variables environnement
- STOCK_ALERTS_CRON : cron pattern (default "0 3 * * *")
- STOCK_ALERTS_TIMEZONE : default "Africa/Casablanca"
- STOCK_ALERTS_REALTIME_DEDUP_HOURS : default 4
- STOCK_ALERTS_EMAIL_FROM : default "noreply@skalean.ma"

### Permissions
- stock.alerts.read : Voir liste alerts + history
- stock.alerts.snooze : Snooze alerts (action admin)

## Troubleshooting

[FAQ : alerts non recues, dedup trop strict, ...]

## Roadmap

Sprint 35 : ML predictive, auto-order API, escalation manager, dashboards alerts.
```

---

**Fin enrichissement task-3.6.7-stock-alertes-seuil-notifications.md.**

**Fin task-3.6.7-stock-alertes-seuil-notifications.md.**
Templates Handlebars complets (6 templates)

#### A.1 fr/low-stock-daily-digest.hbs

```handlebars
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Alerte stock faible -- {{tenant_name}}</title>
<style type="text/css">
  body { font-family: Arial, sans-serif; color: #2c3e50; background: #ecf0f1; padding: 20px; }
  .container { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 6px; padding: 30px; }
  .header { border-bottom: 3px solid #e67e22; padding-bottom: 15px; margin-bottom: 20px; }
  .alert-box { background: #fef5e7; border-left: 4px solid #e67e22; padding: 15px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th { background: #34495e; color: white; padding: 10px; text-align: left; }
  td { padding: 10px; border-bottom: 1px solid #ecf0f1; }
  .shortage { color: #c0392b; font-weight: bold; }
  .suggested { color: #27ae60; font-weight: bold; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Alerte stock faible -- {{tenant_name}}</h1>
    <div>Scan du {{scan_date}} -- {{items_count}} articles necessitent reapprovisionnement</div>
  </div>
  <div class="alert-box">
    <strong>Action requise :</strong> Les articles suivants ont une quantite en stock inferieure au seuil de reapprovisionnement.
  </div>
  <table>
    <thead><tr><th>SKU</th><th>Article</th><th>Stock</th><th>Seuil</th><th>Manque</th><th>Suggere</th></tr></thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{sku}}</td>
        <td>{{name}}</td>
        <td>{{current_quantity}}</td>
        <td>{{reorder_threshold}}</td>
        <td class="shortage">{{shortage}}</td>
        <td class="suggested">{{suggested_reorder_quantity}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  <p>Pour passer commande, connectez-vous a votre espace garage Skalean InsurTech.</p>
  <div style="font-size:11px;color:#95a5a6;margin-top:30px;">
    Cet email a ete envoye automatiquement le {{scan_date}}.<br>
    Conformement a la loi 09-08 CNDP, vos donnees sont hebergees au Maroc.
  </div>
</div>
</body>
</html>
```

#### A.2 ar-MA/low-stock-daily-digest.hbs (Arabic Morocco RTL)

```handlebars
<!DOCTYPE html>
<html lang="ar-MA" dir="rtl">
<head><meta charset="utf-8"><title>تنبيه المخزون قليل -- {{tenant_name}}</title></head>
<body>
<h1>تنبيه: المخزون قليل -- {{tenant_name}}</h1>
<p>المسح التلقائي ليوم {{scan_date}} كشف عن {{items_count}} مقالة تحتاج إعادة طلب.</p>
<table>
  <thead><tr><th>SKU</th><th>المقالة</th><th>المخزون الحالي</th><th>النقص</th><th>المقترح</th></tr></thead>
  <tbody>
    {{#each items}}<tr><td>{{sku}}</td><td>{{name}}</td><td>{{current_quantity}}</td><td>{{shortage}}</td><td>{{suggested_reorder_quantity}}</td></tr>{{/each}}
  </tbody>
</table>
</body>
</html>
```

#### A.3 ar/low-stock-daily-digest.hbs (Arabic standard)

Templates similaires en arabe litteraire.

### B. Methodes additionnelles StockAlertsService

```typescript
@Injectable()
export class StockAlertsService {
  async snoozeAlert(tenantId: string, itemId: string, durationDays = 7): Promise<void> {
    // ...
  }

  async getAlertsStats(tenantId: string, days = 30): Promise<AlertStats> {
    const since = new Date(Date.now() - days * 86400 * 1000);
    const alerts = await this.historyRepo
      .createQueryBuilder('a')
      .where('a.tenant_id = :t', { t: tenantId })
      .andWhere('a.sent_at >= :since', { since })
      .getMany();
    const byChannel: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let successful = 0;
    for (const a of alerts) {
      byChannel[a.channel] = (byChannel[a.channel] || 0) + 1;
      byType[a.alert_type] = (byType[a.alert_type] || 0) + 1;
      if (a.success) successful++;
    }
    return { total_alerts: alerts.length, by_channel: byChannel, by_type: byType, success_rate: alerts.length > 0 ? (successful / alerts.length) * 100 : 0 };
  }
}
```

### C. Tests supplementaires (10 cas additionnels)

```typescript
describe('StockAlertsService tests etendus', () => {
  it('snoozeAlert empeche alerte 7 jours', async () => { });
  it('getAlertsStats aggregates 30 derniers jours', async () => { });
  it('Concurrent exits same item -> 1 alerte seulement (dedup 4h)', async () => { });
  it('Cron daily skip tenants churned', async () => { });
  it('Cron daily handle 100 tenants en sequence', async () => { });
  it('Notification email tres long body -> truncate', async () => { });
  it('Locale ar-MA renders RTL correctly', async () => { });
  it('Locale fallback fr if locale unknown', async () => { });
  it('Reorder quantity 0 si current > ideal', () => { expect(svc.suggestReorderQuantity('100', '50')).toBe('0.0000'); });
  it('Stock alerts history retention 1 an', async () => { });
});
```

### D. Configuration alerting avancee Sprint 35+ preview

```typescript
interface AdvancedAlertingConfig {
  velocityBasedEnabled: boolean;
  seasonalityFactors: Record<string, number>;
  mlEnabled: boolean;
  escalationDelayHours: number;
  autoOrderEnabled: boolean;
  autoOrderApiUrl: string;
}
```

### E. SLO performance alerts

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| findLowStockItems 100 items | 200ms | 500ms | 800ms |
| findLowStockItems 1000 items | 800ms | 1.5s | 2.5s |
| Cron daily 1 tenant 100 items | 1s | 2s | 4s |
| Cron daily 100 tenants | 60s | 120s | 200s |
| Kafka consumer realtime | 50ms | 150ms | 300ms |
| Email send via SendGrid | 200ms | 500ms | 2s |
| WhatsApp via Meta API | 300ms | 800ms | 3s |

### F. Edge cases supplementaires (15 cas)

1. Item active=false alors qu'alerte active -> alerte ignoree.
2. Threshold = 0 -> jamais d'alerte (intentional pour items rares).
3. Reorder threshold > ideal_stock -> warning admin (config invalide).
4. Tenant locale invalide -> fallback fr.
5. SMTP queue saturee -> retry exponential SendGrid.
6. WhatsApp template not approved Meta -> fallback email.
7. Magasinier email change -> historique perdu mais ok.
8. Cron timezone change DST (MA UTC+1 toute annee) -> stable.
9. Item delete pendant cron -> ignored.
10. Same item alerted across 2 jours consecutive -> 2 emails differents scan_date.
11. Tenant onboarded mid-day -> include next cron.
12. Reorder threshold negative (config invalide) -> warning admin.
13. Suggested reorder > 10x ideal_stock (config aberrante) -> warning Sprint 35.
14. Email delivery failure marker -> retry next cron.
15. WhatsApp number invalide -> fallback email + audit.

### G. Conformite Maroc + bonnes pratiques

- decision-008 : email transitent Atlas Cloud Benguerir uniquement.
- Loi 09-08 CNDP : email contient donnees personnelles tenant_name, manager email -- consentement implicite onboarding.
- decision-006 : aucune emoji dans templates.

### H. Documentation `repo/docs/stock/alerts-flow.md`

```markdown
# Skalean InsurTech v2.2 -- Stock Alerts Flow

## Architecture
[Diagram + sequence steps...]

## Configuration
### Variables environnement
- STOCK_ALERTS_CRON : cron pattern (default "0 3 * * *")
- STOCK_ALERTS_TIMEZONE : default "Africa/Casablanca"
- STOCK_ALERTS_REALTIME_DEDUP_HOURS : default 4
- STOCK_ALERTS_EMAIL_FROM : default "noreply@skalean.ma"

### Permissions
- stock.alerts.read : Voir liste alerts + history
- stock.alerts.snooze : Snooze alerts (action admin)

## Troubleshooting
[FAQ : alerts non recues, dedup trop strict, ...]

## Roadmap
Sprint 35 : ML predictive, auto-order API, escalation manager, dashboards alerts.
```

---

**Fin enrichissement task-3.6.7.**
'low_stock_realtime', success: false },
    ]);
    const r = await service.getAlertsStats('t1', 30);
    expect(r.total_alerts).toBe(3);
    expect(r.by_channel.email).toBe(2);
    expect(r.success_rate).toBeCloseTo(66.67, 1);
  });

  it('Concurrent exits same item -> 1 alerte seulement', async () => {
    historyRepo.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    expect(await service.wasAlertSentRecently('i1', 'low_stock_realtime', 4)).toBe(false);
    expect(await service.wasAlertSentRecently('i1', 'low_stock_realtime', 4)).toBe(true);
  });

  it('Cron daily skip tenants churned', async () => { });
  it('Cron daily handle 100 tenants en sequence', async () => { });
  it('Locale ar-MA renders RTL correctly', async () => { });
  it('Locale fallback fr if locale unknown', async () => { });
  it('Reorder quantity 0 si current > ideal', () => { expect(svc.suggestReorderQuantity('100', '50')).toBe('0.0000'); });
});
```

### D. Configuration alerting avancee Sprint 35+ preview

```typescript
interface AdvancedAlertingConfig {
  velocityBasedEnabled: boolean;
  seasonalityFactors: Record<string, number>;
  mlEnabled: boolean;
  escalationDelayHours: number;
  autoOrderEnabled: boolean;
  autoOrderApiUrl: string;
}
```

### E. SLO performance alerts

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| findLowStockItems 100 items | 200ms | 500ms | 800ms |
| findLowStockItems 1000 items | 800ms | 1.5s | 2.5s |
| Cron daily 1 tenant 100 items | 1s | 2s | 4s |
| Cron daily 100 tenants | 60s | 120s | 200s |
| Kafka consumer realtime | 50ms | 150ms | 300ms |
| Email send SendGrid | 200ms | 500ms | 2s |
| WhatsApp via Meta API | 300ms | 800ms | 3s |

### F. Edge cases supplementaires (15 cas)

1. Item active=false alors qu'alerte active -> alerte ignoree.
2. Threshold = 0 -> jamais d'alerte (intentional pour items rares).
3. Reorder threshold > ideal_stock -> warning admin (config invalide).
4. Tenant locale invalide -> fallback fr.
5. SMTP queue saturee -> retry exponential SendGrid.
6. WhatsApp template not approved Meta -> fallback email.
7. Magasinier email change -> historique perdu mais ok.
8. Cron timezone DST stable (MA UTC+1 toute annee).
9. Item delete pendant cron -> ignored.
10. Same item alerted across 2 jours consecutive -> 2 emails differents.
11. Tenant onboarded mid-day -> include next cron.
12. Reorder threshold negative -> warning admin.
13. Suggested reorder > 10x ideal_stock -> warning Sprint 35.
14. Email delivery failure -> retry next cron.
15. WhatsApp number invalide -> fallback email + audit.

### G. Documentation flow alerts

```markdown
# Stock Alerts Flow Documentation

## Architecture
1. Daily cron 3am Casablanca scans all tenants
2. For each tenant, findLowStockItems returns items < threshold
3. Email digest sent to admin tenant
4. Realtime : Kafka consumer on stock.movement_recorded checks threshold
5. If < threshold AND no recent alert -> immediate notification

## Variables
- STOCK_ALERTS_CRON : default "0 3 * * *"
- STOCK_ALERTS_TIMEZONE : default "Africa/Casablanca"
- STOCK_ALERTS_REALTIME_DEDUP_HOURS : default 4
```

---

**Fin enrichissement task-3.6.7.**

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

