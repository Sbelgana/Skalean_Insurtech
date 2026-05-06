# META-PROMPT B-27 -- SPRINT 27 TENANTS MANAGEMENT UI ADVANCE

**Version** : v2.2 (Option B)
**Phase** : 6 -- Admin Platform
**Sprint** : 27 / 35 (cumul) -- Phase 6 Sprint 2
**Position** : Apres Admin Foundation, avant Admin Reports + Compliance
**Numerotation taches** : 6.2.1 a 6.2.12
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (gestion enrichie tenants critique pour pilote + scale phase 7)

---

## Objectif Global du Sprint

Enrichir Sprint 26 admin foundation avec **fonctionnalites avancees gestion tenants** : billing automation + tenant lifecycle (pause/archive) + bulk operations + comparaison benchmark + configuration platform-wide. Sprint 27 prepare scale-up Phase 7 pilote (Skalean Atlas + Wafa + 5-10 brokers + 2-3 garages partenaires).

A la sortie de ce sprint :
- Billing tenants : invoices Skalean -> partenaires + commission tracking + paiement reglements
- Tenant lifecycle : pause / reactivate / archive avec impacts data
- Bulk operations : mass capabilities update + notifications + status changes
- Comparaison benchmark tenants : KPIs comparison + outliers detection
- Reports tenant : monthly performance + quarterly business review template
- Configuration platform-wide : defaults capabilities + billing rules + fees commission Skalean
- Impersonation history avec analytics
- Tests E2E + WCAG

---

## Frontiere du Sprint

**INCLUS** :
- Billing tenants automation
- Tenant lifecycle (pause / archive)
- Bulk operations enrichies
- Comparaison benchmark
- Reports tenant generation
- Configuration platform-wide
- Impersonation history + analytics
- Tests E2E

**EXCLU** (sera ajoute aux sprints suivants) :
- Admin Reports + Compliance ACAPS exports -- Sprint 28
- IA-powered tenant insights -- Sprint 30+ defere
- Multi-region tenant routing -- Phase 7+

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 26 : admin foundation + impersonation
2. Sortie Sprint 25 : capabilities matrix backend
3. Sortie Sprint 12 : Books + invoices DGI
4. Sortie Sprint 13 : Analytics aggregations

---

## Stack Imposee (Sprint 27)

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.0.4 | App Router |
| @tanstack/react-query | 5.62.0 | mutations |
| recharts | 2.13.x | comparaison charts |
| react-pdf | 9.x | reports preview |
| zod | 3.24.1 | validation |

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 6.2.1 | Billing tenants : invoices Skalean -> partenaires (commission + frais SaaS) | 7h | P0 | Sprint 26 |
| 6.2.2 | Page billing : invoices + paiements + history per tenant | 6h | P0 | 6.2.1 |
| 6.2.3 | Tenant lifecycle : pause / reactivate / archive workflow | 6h | P0 | 6.2.2 |
| 6.2.4 | Bulk operations : mass capabilities + notifications + status (queue async) | 6h | P0 | 6.2.3 |
| 6.2.5 | Comparaison benchmark tenants : KPIs comparison + outliers detection | 7h | P0 | 6.2.4 |
| 6.2.6 | Reports tenant : monthly performance + quarterly business review templates | 6h | P0 | 6.2.5 |
| 6.2.7 | Configuration platform-wide : defaults capabilities + billing + fees | 5h | P0 | 6.2.6 |
| 6.2.8 | Impersonation history + analytics (qui impersone qui combien fois) | 5h | P0 | 6.2.7 |
| 6.2.9 | Notifications platform-wide : send announcement aux tenants/users | 4h | P1 | 6.2.8 |
| 6.2.10 | Endpoints REST + permissions enrichies | 4h | P0 | 6.2.9 |
| 6.2.11 | Audit trail + Kafka events + integration ETL ClickHouse | 4h | P0 | 6.2.10 |
| 6.2.12 | Tests E2E (15+) + WCAG + Lighthouse | 8h | P0 | 6.2.11 |

**Total** : 68 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 6.2.1 -- Billing Tenants Automation

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 7h / Depend de Sprint 26

**But** : Service automation billing : invoices Skalean -> partenaires (commission Skalean + frais SaaS subscription) + cron generation mensuelle.

**Contexte** : Skalean monetise plateforme via 2 revenus :
1. **Commission Skalean** : % sur revenue tenant (e.g. 5% revenue brokers, 8% revenue garages)
2. **SaaS subscription** : frais fixes mensuel selon tier (Basic 500 MAD/mois, Pro 1500 MAD/mois, Enterprise 5000 MAD/mois)

**Livrables checkables** :
- [ ] Migration : table `platform_billing_invoices` (cross-tenant) :
  - id, tenant_id, period (text 'YYYY-MM'), invoice_number, items (jsonb : array), commission_amount, saas_subscription_amount, total_ht, total_tva, total_ttc, status (enum 'draft' | 'sent' | 'paid' | 'overdue'), due_date, paid_at, payment_reference, generated_at
- [ ] Migration : table `tenant_billing_settings` :
  - tenant_id, commission_rate_percent, saas_tier (enum 'basic' | 'pro' | 'enterprise'), saas_amount_monthly_ht, payment_terms_days, auto_pay_enabled
- [ ] Service `platform-billing.service.ts` :
  - `generateInvoiceForTenant(tenantId, period)` : compute commission + SaaS + create draft
  - `sendInvoice(invoiceId)` : email + WhatsApp tenant admin + transition sent
  - `markPaid(invoiceId, paymentRef)` : transition paid + integration Books Sprint 12
- [ ] Cron mensuel : 5 du mois -> generate drafts + notify super_admin Skalean review
- [ ] Apres review super_admin : auto-send aux tenants
- [ ] Computation commission :
  - Brokers : 5% revenue mois (commissions courtier Sprint 14 cumul)
  - Garages : 8% revenue mois (factures payees Sprint 21)
- [ ] Endpoints :
  - `GET /api/v1/admin/billing/invoices`
  - `POST /api/v1/admin/billing/invoices/:id/send`
  - `POST /api/v1/admin/billing/invoices/:id/mark-paid`
- [ ] Tests : computation correct + workflow

**Pattern critique : computation billing automation**

```typescript
// repo/packages/admin/src/services/platform-billing.service.ts
async generateInvoiceForTenant(tenantId: string, period: string): Promise<PlatformBillingInvoice> {
  const tenant = await this.tenantsService.findById(tenantId);
  const settings = await this.billingSettingsService.findByTenant(tenantId);

  // Compute revenue tenant period (consume Sprint 13 ClickHouse aggregations)
  let tenantRevenue = new Decimal(0);
  let revenueBreakdown: any = {};

  if (tenant.tenant_type === 'broker') {
    tenantRevenue = await this.analyticsService.getBrokerRevenue(tenantId, period);
    revenueBreakdown = { commissions_collected: tenantRevenue.toNumber() };
  } else if (tenant.tenant_type === 'garage') {
    tenantRevenue = await this.analyticsService.getGarageRevenue(tenantId, period);
    revenueBreakdown = { invoices_paid: tenantRevenue.toNumber() };
  }

  // Compute Skalean commission
  const commissionRate = new Decimal(settings.commission_rate_percent).div(100);
  const commissionAmount = tenantRevenue.mul(commissionRate);

  // SaaS subscription
  const saasAmount = new Decimal(settings.saas_amount_monthly_ht);

  // TVA 20% standard services
  const subtotalHt = commissionAmount.plus(saasAmount);
  const tva = subtotalHt.mul('0.20');
  const totalTtc = subtotalHt.plus(tva);

  // Generate invoice number
  const invoiceNumber = await this.numbering.next('SKL-INV', period);

  // Insert
  const invoice = await this.invoicesRepo.save({
    tenant_id: tenantId,
    period,
    invoice_number: invoiceNumber,
    items: [
      { description: `Commission Skalean ${period}`, amount_ht: commissionAmount.toNumber(), revenue_breakdown: revenueBreakdown },
      { description: `Abonnement SaaS ${settings.saas_tier} ${period}`, amount_ht: saasAmount.toNumber() },
    ],
    commission_amount: commissionAmount.toNumber(),
    saas_subscription_amount: saasAmount.toNumber(),
    total_ht: subtotalHt.toNumber(),
    total_tva: tva.toNumber(),
    total_ttc: totalTtc.toNumber(),
    status: 'draft',
    due_date: addDays(new Date(), settings.payment_terms_days),
    generated_at: new Date(),
  });

  // Notify super_admin Skalean review
  await this.commOrchestrator.send({
    type: 'transactional',
    template: 'platform_invoice_draft_ready',
    locale: 'fr',
    channels: ['email'],
    to: { email: 'admin@skalean-insurtech.ma' },
    variables: { invoice_number: invoiceNumber, tenant_name: tenant.name, total: totalTtc.toFixed(2) },
  });

  return invoice;
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-PlatformBillingInvoices.ts                       # ~50 lignes
repo/packages/database/src/migrations/{date}-TenantBillingSettings.ts                          # ~40 lignes
repo/packages/admin/src/entities/platform-billing-invoice.entity.ts                            # ~50 lignes
repo/packages/admin/src/entities/tenant-billing-setting.entity.ts                                # ~40 lignes
repo/packages/admin/src/services/platform-billing.service.ts                                     # ~300 lignes
repo/packages/admin/src/jobs/billing-monthly-cron.ts                                              # ~100 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/platform-invoice-{draft,sent,reminder}.hbs        # 9 templates
```

**Notes implementation** :
- Commission rate negociable per tenant (settings configurable)
- SaaS tiers : Basic / Pro / Enterprise (different limits + pricing)
- Auto-pay enabled : auto-debit mode payment Sprint 11 carte memorisee
- Payment terms : 30 jours par defaut, configurable

**Criteres validation** :
- V1 (P0) : Migration + entities
- V2 (P0) : generateInvoice computation correct (decimal.js)
- V3 (P0) : Cron mensuel
- V4 (P0) : Notifications super_admin
- V5 (P0) : Multi-tenant aggregations correctes
- V6 (P0) : Tests 10+ scenarios

---

## Tache 6.2.2 -- Page Billing UI

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 6h / Depend de 6.2.1

**But** : Pages UI billing : invoices list + detail + paiements + history per tenant.

**Livrables checkables** :
- [ ] Page `/billing` :
  - Tabs : "Invoices" / "Settings" / "Reports"
  - **Invoices tab** : DataTable invoices + filters (period + tenant + status)
  - **Settings tab** : table tenants + commission rate + SaaS tier per tenant + edit
  - **Reports tab** : KPI revenue Skalean YTD + monthly trend + breakdown commission/SaaS
- [ ] Page detail invoice : items + send button + mark paid + PDF download
- [ ] Page tenant settings billing : edit commission_rate + saas_tier + payment_terms
- [ ] Permissions : `admin.billing.read/manage`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/billing/page.tsx                          # ~150 lignes
repo/apps/web-insurtech-admin/app/[locale]/(protected)/billing/[id]/page.tsx                     # ~150 lignes
repo/apps/web-insurtech-admin/components/billing/{several components}.tsx                          # ~500 lignes
```

**Criteres validation** :
- V1 (P0) : 3 tabs functional
- V2 (P0) : Invoices CRUD
- V3 (P0) : Settings edit
- V4 (P0) : Reports KPIs
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.2.3 -- Tenant Lifecycle : Pause / Archive

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 6h / Depend de 6.2.2

**But** : Workflow lifecycle tenant : pause (suspend temp) / reactivate (resume) / archive (long term + data retention 5 ans).

**Livrables checkables** :
- [ ] Service `tenant-lifecycle.service.ts` :
  - `pause(tenantId, reason, until?)` : status='suspended' + block users login + preserve data
  - `reactivate(tenantId)` : status='active' + unblock users
  - `archive(tenantId)` : status='archived' + read-only access (super_admin only) + data retention 5 ans
- [ ] Migration : ajouter `tenants.lifecycle_status` (enum 'active' | 'suspended' | 'archived'), `tenants.suspended_until`, `tenants.archived_at`, `tenants.archive_retention_until`
- [ ] Notifications tenant admin : email + WhatsApp explication + duration
- [ ] Audit complete : qui a pause/archive + reason + duration
- [ ] Cron daily : check `suspended_until` expired -> auto-reactivate
- [ ] Cron daily : check `archive_retention_until` expired -> hard delete data (apres 5 ans)
- [ ] Endpoints :
  - `POST /api/v1/admin/tenants/:id/pause`
  - `POST /api/v1/admin/tenants/:id/reactivate`
  - `POST /api/v1/admin/tenants/:id/archive`
- [ ] Permissions : `admin.tenants.lifecycle`
- [ ] Tests : workflow + auto-reactivate + archive retention

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-AddTenantLifecycleColumns.ts                        # ~40 lignes
repo/packages/admin/src/services/tenant-lifecycle.service.ts                                       # ~250 lignes
repo/packages/admin/src/jobs/tenant-lifecycle-cron.ts                                              # ~120 lignes
repo/apps/api/src/modules/admin/controllers/tenant-lifecycle.controller.ts                          # ~120 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/tenant-{paused,reactivated,archived}.hbs            # 9 templates
```

**Notes implementation** :
- Pause vs Archive : pause temp (back later), archive long term (5 ans data retention legal MA)
- Hard delete apres archive : conformite loi 09-08 (right to erasure CNDP)
- Data retention 5 ans : balance regulator requirement vs storage cost

**Criteres validation** :
- V1 (P0) : 3 lifecycle states
- V2 (P0) : Notifications tenant
- V3 (P0) : Auto-reactivate cron
- V4 (P0) : Audit complete
- V5 (P0) : Tests 8+ scenarios

---

## Tache 6.2.4 -- Bulk Operations : Mass Updates

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 6h / Depend de 6.2.3

**But** : Bulk operations sur multiple tenants : mass capabilities update + notifications + status changes via queue async.

**Livrables checkables** :
- [ ] Service `bulk-operations.service.ts`
- [ ] Operations :
  - `bulkEnableCapability(tenantIds[], capabilityKey, config)` : enable capability sur N tenants
  - `bulkDisableCapability(tenantIds[], capabilityKey)`
  - `bulkSendNotification(tenantIds[], template, variables)` : notification mass tenants
  - `bulkChangeStatus(tenantIds[], newStatus)` : pause/archive batch
- [ ] Async via BullMQ queue `bulk-ops` (eviter timeouts)
- [ ] Progress tracking : table `bulk_operations` (id, type, total, processed, failed, status, started_at, completed_at)
- [ ] Endpoint poll status : `GET /api/v1/admin/bulk-operations/:id/status`
- [ ] UI : modal selection multiple tenants + action choice + confirmation + progress bar
- [ ] Tests : queue + idempotency + progress

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-BulkOperations.ts                                     # ~40 lignes
repo/packages/admin/src/services/bulk-operations.service.ts                                         # ~300 lignes
repo/packages/admin/src/workers/bulk-ops.worker.ts                                                   # ~150 lignes
repo/apps/web-insurtech-admin/components/admin/bulk-actions-modal.tsx                                # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : 4 bulk operations
- V2 (P0) : Async via queue
- V3 (P0) : Progress tracking
- V4 (P0) : UI selection + confirmation
- V5 (P0) : Tests 8+ scenarios

---

## Tache 6.2.5 -- Comparaison Benchmark Tenants

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 7h / Depend de 6.2.4

**But** : Page comparaison benchmark tenants : KPIs comparison + outliers detection + insights.

**Livrables checkables** :
- [ ] Page `/tenants/benchmark` :
  - Selection : tenant types + period + KPI choice
  - Display : table tenants ranked par KPI + visual comparison charts (recharts)
  - Outliers detection : tenants > 2 sigmas (statistical) -> highlighted + click investigate
  - Drill-down : click tenant -> profile detail
- [ ] KPIs disponibles :
  - **Brokers** : revenue YTD / polices count / quotes conversion / NPS / churn rate
  - **Garages** : revenue YTD / sinistres throughput / customer satisfaction / repair duration avg
- [ ] Stats avancees : moyenne + median + p25 + p75 + p99 + outliers
- [ ] Export PDF benchmark report
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/benchmark/page.tsx                   # ~200 lignes
repo/apps/web-insurtech-admin/components/benchmark/{several charts}.tsx                              # ~400 lignes
repo/packages/admin/src/services/benchmark.service.ts                                                  # ~250 lignes
```

**Criteres validation** :
- V1 (P0) : Tenants ranked
- V2 (P0) : Outliers detection statistical
- V3 (P0) : Charts comparison
- V4 (P0) : PDF export
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.2.6 -- Reports Tenant : Monthly + Quarterly

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 6h / Depend de 6.2.5

**But** : Templates reports tenant : monthly performance summary + quarterly business review (QBR) PDF.

**Livrables checkables** :
- [ ] Templates :
  - `monthly-performance-tenant.hbs` : 1-pager KPIs + trends + alerts
  - `quarterly-business-review-tenant.hbs` : 5-10 pages comprehensive (history + comparaison + recommendations)
- [ ] Service `tenant-reports.service.ts` :
  - `generateMonthlyReport(tenantId, period)` : compute KPIs + render PDF
  - `generateQbrReport(tenantId, quarter)` : detailed analysis + recommendations
- [ ] Cron monthly : 5 du mois -> generate drafts pour tous tenants actifs
- [ ] Cron quarterly : 1er du trimestre +1 -> generate QBR drafts
- [ ] Auto-send tenants apres super_admin review (configurable per tenant)
- [ ] Page UI : list reports + download PDF + send manual + history
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/docs/src/templates/{fr,ar-MA,ar}/tenant-{monthly,qbr}-report.hbs                     # 6 templates
repo/packages/admin/src/services/tenant-reports.service.ts                                            # ~300 lignes
repo/packages/admin/src/jobs/tenant-reports-cron.ts                                                    # ~120 lignes
repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenant-reports/page.tsx                          # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Monthly + QBR templates
- V2 (P0) : PDF generation
- V3 (P0) : Cron scheduled
- V4 (P0) : UI list + download
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.2.7 -- Configuration Platform-Wide

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 5h / Depend de 6.2.6

**But** : Page configuration platform-wide : defaults capabilities + billing rules + fees commission + system settings.

**Livrables checkables** :
- [ ] Page `/settings/platform` :
  - Defaults capabilities per type tenant (Atlas / Managed / API Partner pour Repair ; Broker pour Insure)
  - Billing rules : commission rates default + SaaS tiers pricing + payment terms
  - Tenants creation rules : auto-approval seuils + manual review triggers
  - System limits : max tenants per region + storage quotas + API rate limits per tier
  - Notifications platform : templates global (welcome / suspended / archived)
  - Compliance : data retention durations + ACAPS reporting frequency
- [ ] Migration : table `platform_settings` (key-value store + jsonb config)
- [ ] Service `platform-settings.service.ts` :
  - `get(key)` cache Redis
  - `set(key, value)` super_admin only + audit
- [ ] Endpoints CRUD
- [ ] Permissions : `admin.platform_settings.read/manage`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-PlatformSettings.ts                                       # ~40 lignes
repo/packages/admin/src/services/platform-settings.service.ts                                            # ~150 lignes
repo/apps/web-insurtech-admin/app/[locale]/(protected)/settings/platform/page.tsx                         # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Settings stored + cached
- V2 (P0) : super_admin only + audit
- V3 (P0) : UI sections complete
- V4 (P0) : Tests 5+ scenarios

---

## Tache 6.2.8 -- Impersonation History + Analytics

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 5h / Depend de 6.2.7

**But** : Page history impersonations + analytics (qui impersone qui combien fois + abuse detection).

**Livrables checkables** :
- [ ] Page `/impersonation-history` :
  - DataTable impersonations : admin + impersonated user + tenant + duration + actions count + start/stop
  - Filters : admin + user + tenant + date_range
  - Search free
- [ ] Analytics widgets :
  - Top admins par count impersonations (last 30 jours)
  - Top users impersones
  - Avg duration per session
  - Alerts abuse : si admin > 50 impersonations/jour OR durations > 8h
- [ ] Drill-down : click row -> detail audit log impersonation session
- [ ] Permissions : `admin.impersonation.audit`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/impersonation-history/page.tsx                   # ~150 lignes
repo/apps/web-insurtech-admin/components/impersonation/{several}.tsx                                      # ~300 lignes
repo/packages/admin/src/services/impersonation-analytics.service.ts                                       # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : History table + filters
- V2 (P0) : Analytics widgets
- V3 (P0) : Abuse alerts
- V4 (P0) : Tests 5+ scenarios

---

## Tache 6.2.9 -- Notifications Platform-Wide

**Metadonnees** : Phase 6 / Sprint 27 / P1 / 4h / Depend de 6.2.8

**But** : Send announcements platform-wide aux tenants/users (e.g. maintenance scheduled, new feature, etc.).

**Livrables checkables** :
- [ ] Page `/notifications-platform` :
  - Form : title + body + audience filter (all tenants / type X / specific tenants) + channels (email / WA / in-app)
  - Preview before send
  - Send button : trigger Sprint 9 Comm orchestrator mass send
- [ ] History table : notifications envoyees + count delivered + count read
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/notifications-platform/page.tsx                   # ~150 lignes
repo/packages/admin/src/services/platform-notifications.service.ts                                         # ~200 lignes
```

**Criteres validation** :
- V1 (P1) : Form + preview
- V2 (P1) : Send mass
- V3 (P1) : Tests 4+ scenarios

---

## Tache 6.2.10 -- Endpoints REST + Permissions

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 4h / Depend de 6.2.9

**But** : Consolidation endpoints + permissions enrichies Sprint 27.

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes (consolidation)
- [ ] Permissions ajoutees catalog Sprint 7 :
  - `admin.billing.read/manage`
  - `admin.tenants.lifecycle`
  - `admin.bulk_operations.execute`
  - `admin.benchmark.read`
  - `admin.tenant_reports.generate`
  - `admin.platform_settings.read/manage`
  - `admin.impersonation.audit`
  - `admin.notifications_platform.send`
- [ ] Tests RBAC

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/permissions.enum.ts                                                       # update
```

**Criteres validation** :
- V1 (P0) : 15+ permissions
- V2 (P0) : Tests RBAC 6+ scenarios

---

## Tache 6.2.11 -- Audit + Kafka + ETL

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 4h / Depend de 6.2.10

**But** : Audit complet + Kafka events + integration ETL Sprint 13 ClickHouse.

**Livrables checkables** :
- [ ] Kafka events :
  - `admin.billing_invoice_generated/sent/paid`
  - `admin.tenant_paused/reactivated/archived`
  - `admin.bulk_operation_completed`
  - `admin.platform_settings_changed`
- [ ] ETL Sprint 13 etend : sync `platform_billing_invoices` + `bulk_operations` + `impersonation_sessions` -> ClickHouse
- [ ] Dashboards admin enriched
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts                                         # update
```

**Criteres validation** :
- V1 (P0) : 7+ Kafka events
- V2 (P0) : ETL clickhouse
- V3 (P0) : Tests 4+ scenarios

---

## Tache 6.2.12 -- Tests E2E + WCAG + Lighthouse

**Metadonnees** : Phase 6 / Sprint 27 / P0 / 8h / Depend de 6.2.11

**But** : Suite tests Playwright + WCAG + Lighthouse.

**Livrables checkables** :

**Tests E2E (15+)** :
- [ ] Billing invoices generation + send + mark paid (3)
- [ ] Tenant lifecycle pause + reactivate + archive (3)
- [ ] Bulk operations capabilities + notifications (2)
- [ ] Benchmark comparison + outliers (2)
- [ ] Tenant reports monthly + QBR (2)
- [ ] Platform settings (1)
- [ ] Impersonation analytics (1)
- [ ] Notifications platform (1)

**WCAG 2.1 AA + Lighthouse** :
- [ ] axe-core integrated
- [ ] Performance > 90 / Accessibility > 90 / Best Practices > 95

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/e2e/sprint-27/{15+ specs}.spec.ts
```

**Criteres validation** :
- V1 (P0) : 15+ tests passent
- V2 (P0) : Lighthouse green
- V3 (P0) : WCAG AA
- V4 (P0) : CI green
- V5 (P0) : Reproducibility 5x

---

## Sortie du Sprint 27

A la fin de l'execution des 12 taches :

```
Tenants Management UI Advance operational :
  - Billing tenants automation (commission Skalean + SaaS subscription)
  - Cron mensuel generation drafts + super_admin review
  - Tenant lifecycle : pause / reactivate / archive (data retention 5 ans)
  - Bulk operations async via BullMQ (capabilities + notifications + status)
  - Comparaison benchmark tenants + outliers detection statistical
  - Reports tenant : monthly + QBR PDF auto-generes
  - Configuration platform-wide settings (defaults + billing rules + system limits)
  - Impersonation history + analytics + abuse detection
  - Notifications platform-wide announcements
  - 15+ tests E2E + WCAG + Lighthouse
```

**Sprint 28 (Admin Reports + Compliance) demarre avec** :
- Admin platform riche operationnelle
- Sprint 28 final Phase 6 : ACAPS reports + SAFT-MA exports + AML monitoring + audit reports avances

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-6.2.X-*.md` dans `00-pilotage/prompts-taches/sprint-27-tenants-management/`.

**Patterns code inline conserves** : computation billing automation avec decimal.js + commission rate + SaaS tier.

**Reference** : Sprint 26 admin foundation + Sprint 25 cross-tenant.

---

**Fin du meta-prompt B-27 v2.2 format Option B.**
