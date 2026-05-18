# TACHE 3.6.14 -- Tests E2E 35+ + Fixtures + Phase 3 Closure

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase -- DERNIER de la Phase 3)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.14)
**Phase** : 3 -- Modules Horizontaux (CLOSURE OFFICIELLE)
**Priorite** : P0 (validation finale Sprint 13 + cloture Phase 3 prepare Phase 4)
**Effort** : 8h
**Dependances** : Taches 3.6.1 a 3.6.13 (Sprint 13 complet)
**Densite cible** : 80-110 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache finale du Sprint 13 (et de la Phase 3) livre : (a) suite tests E2E exhaustive 35+ couvrant les modules Analytics ClickHouse, Stock FIFO, HR paie+conges+declarations, (b) fixtures realistes : seed scripts produisant 5 tenants types (3 garages + 2 cabinets de courtage), 50 employees, 1000 stock items + 5000 lots, 200 movements/tenant/mois sur 12 mois, payslips generes 12 mois, 30 conges demandes, (c) documentation Phase 3 closure : `repo/docs/phase-3-completion.md` (~250 lignes) recapitulant 6 sprints horizontaux livres, 87 taches detaillees, 30+ entites operationnelles, 100+ endpoints REST, conformite legale 9 lois MA, runbook deploiement modules horizontaux. CI green sur tous les tests, reproductibilite 5x runs sans flake.

L'apport est triple. **Premierement**, suite tests E2E (Vitest + supertest) : ClickHouse (5 tests connexion + ETL + queries), 6 dashboards endpoints (6 tests), Stock (10 tests CRUD + FIFO + alertes), HR employees+contrats (4), HR conges (5), HR paie (5+). Total >= 35. **Deuxiemement**, fixtures realistes pour QA : `seed-phase-3-fixtures.ts` execute en moins de 60 secondes et produit un dataset coherent (foreign keys valides, dates plausibles, salaires SMIG-coherent, FIFO ordres respectes). **Troisiemement**, documentation `phase-3-completion.md` qui sert de reference Phase 4 Insure : ce qui est livre, ce qui n'est pas livre (intentionnel), API stable, points d'integration aval.

A l'issue de cette tache, le sprint 13 et la Phase 3 sont officiellement complets. Sprint 14 Phase 4 Vertical Insure peut demarrer avec : socle CRM + Booking, Comm WA+Email, Docs+Signature ANRT, Pay multi-MA, Books CGNC + Compliance ACAPS+AMC+CNDP, Analytics OLAP + ETL + 6 dashboards, Stock FIFO, HR paie MA. Tous modules horizontaux ready as building blocks.

---

## 2. Contexte etendu

### 2.1 Periode et volumes fixtures

Sprint 13 cible volumes realistes equivalents 6 mois operation garage moyen :
- **5 tenants** : Garage Atlas (Casablanca), Garage Atlas (Rabat), Garage Atlas (Marrakech), Cabinet Bennani Insurance (Casablanca), Cabinet Tazi Brokerage (Rabat).
- **50 employees total** (10 par tenant).
- **1000 stock items total** (200 par garage tenant).
- **5000 lots** (5 par item moyen).
- **30 000 movements** (24 000 entries + 6 000 exits sur 12 mois retrospectifs).
- **600 payslips** (50 employees x 12 mois).
- **150 conges** (3 par employee/an moyen).

### 2.2 Reproductibilite

Tests doivent etre deterministes : seed Math.random avec `seed=20260515`, dates futures formules `start_date = baseDate + offset_days`. Test runner doit pouvoir relancer 5x avec exactement le meme resultat.

### 2.3 Trade-offs

**Trade-off 1 : Fixtures lourdes (60s exec)**. Tolere car execute en CI une fois par push.

**Trade-off 2 : Pas de fixtures Insure Sprint 13**. Sprint 14+ Phase 4 ajoutera polices/sinistres.

### 2.4 Pieges techniques

1. **Piege : FK valides** -> ordre seed strict (tenants, then employees, then contracts, then payslips).
2. **Piege : Dates passees mais coherentes** -> hired_date <= contract.start_date <= payslip.period.
3. **Piege : Decimal precision dans seeds** -> Decimal.js partout.
4. **Piege : Idempotency seeds** -> ON CONFLICT DO NOTHING ou TRUNCATE prealable.

---

## 3. Architecture

```
seed-phase-3-fixtures.ts (orchestrate)
   |
   +-> seedTenants(5)
   +-> seedEmployees(50)
   +-> seedContracts(50)
   +-> seedStockCategories(15)
   +-> seedStockItems(1000)
   +-> seedStockLots(5000)
   +-> seedStockMovements(30000) -> trigger Books consumer auto
   +-> seedPayslips(600) -> trigger Books consumer auto
   +-> seedLeaves(150)
   +-> seedClickHouseETL() -> populate analytics
```

---

## 4. Livrables

- [ ] Suite tests E2E 35+ couvrant les 13 taches Sprint 13
- [ ] `seed-phase-3-fixtures.ts` (~400 lignes) seed deterministique
- [ ] `repo/docs/phase-3-completion.md` (~280 lignes) Phase 3 closure
- [ ] `repo/docs/architecture/phase-3-summary.md` (~150 lignes) recap technique
- [ ] CI workflow update : tests Sprint 13 green
- [ ] Sortie verification : `repo/00-pilotage/verifications/V-13-analytics-stock-hr.md`

---

## 5. Fichiers crees / modifies

```
repo/apps/api/test/integration/sprint-13-full-suite.e2e-spec.ts                     (~600 lignes)
repo/infrastructure/scripts/seed-phase-3-fixtures.ts                                  (~450 lignes)
repo/infrastructure/scripts/seed-helpers/                                              (~200 lignes utils)
repo/docs/phase-3-completion.md                                                         (~290 lignes)
repo/docs/architecture/phase-3-summary.md                                                (~170 lignes)
repo/00-pilotage/verifications/V-13-analytics-stock-hr.md                                 (~150 lignes)
.github/workflows/test.yml                                                                  (modif)
```

---

## 6. Code patterns

### 6.1 Seed script `seed-phase-3-fixtures.ts`

```typescript
#!/usr/bin/env tsx
// repo/infrastructure/scripts/seed-phase-3-fixtures.ts
// Skalean InsurTech v2.2 -- Seed fixtures realistes Phase 3
// Reference : B-13 Sprint 13 Tache 3.6.14
// Usage : pnpm tsx infrastructure/scripts/seed-phase-3-fixtures.ts [--reset]
// Idempotent : peut etre rejoue (TRUNCATE + INSERT si --reset)

import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';

// Seed deterministe : Math.random remplace
class SeededRandom {
  private seed: number;
  constructor(seed: number) { this.seed = seed; }
  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  pick<T>(arr: T[]): T { return arr[this.int(0, arr.length - 1)]; }
}

const rand = new SeededRandom(20260515);

const TENANT_FIXTURES = [
  { slug: 'garage-atlas-casablanca', legal_name: 'Garage Atlas Casablanca SARL', industry: 'garage', city: 'Casablanca' },
  { slug: 'garage-atlas-rabat', legal_name: 'Garage Atlas Rabat SARL', industry: 'garage', city: 'Rabat' },
  { slug: 'garage-atlas-marrakech', legal_name: 'Garage Atlas Marrakech SARL', industry: 'garage', city: 'Marrakech' },
  { slug: 'cabinet-bennani', legal_name: 'Cabinet Bennani Insurance', industry: 'broker', city: 'Casablanca' },
  { slug: 'cabinet-tazi', legal_name: 'Cabinet Tazi Brokerage', industry: 'broker', city: 'Rabat' },
];

const FIRST_NAMES_MA = ['Rachid', 'Aicha', 'Hassan', 'Fatima', 'Youssef', 'Khadija', 'Omar', 'Salma', 'Karim', 'Najat'];
const LAST_NAMES_MA = ['Bennani', 'Tazi', 'Idrissi', 'Alaoui', 'Senhaji', 'Berrada', 'Fassi', 'Lahlou', 'Chraibi', 'Ouazzani'];

const STOCK_CATEGORIES = ['Pneus', 'Filtres', 'Plaquettes', 'Huile', 'Amortisseurs', 'Batteries', 'Bougies', 'Courroies'];

async function seedPhase3(): Promise<void> {
  console.log('[seed-phase-3] Starting seed...');
  const ds = await initDataSource();
  
  await ds.transaction(async (em) => {
    // 1. Seed tenants
    console.log('[seed-phase-3] Seeding 5 tenants...');
    const tenantIds: string[] = [];
    for (const t of TENANT_FIXTURES) {
      const id = randomUUID();
      await em.query(`
        INSERT INTO auth_tenants (id, slug, legal_name, industry, country, city, subscription_plan, monthly_revenue_mad, created_at, activated_at, ice_number)
        VALUES ($1, $2, $3, $4, 'MA', $5, 'pro', $6, $7, $7, $8)
        ON CONFLICT (slug) DO NOTHING
      `, [id, t.slug, t.legal_name, t.industry, t.city, 5000 + rand.int(0, 15000),
          new Date('2024-01-01'), `00123456${rand.int(1000000, 9999999)}`]);
      tenantIds.push(id);
    }
    
    // 2. Seed employees (10 per tenant)
    console.log('[seed-phase-3] Seeding 50 employees...');
    const employeesByTenant = new Map<string, string[]>();
    for (const tenantId of tenantIds) {
      const employeeIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = randomUUID();
        const firstName = rand.pick(FIRST_NAMES_MA);
        const lastName = rand.pick(LAST_NAMES_MA);
        const cin = `${String.fromCharCode(65 + rand.int(0, 25))}${String.fromCharCode(65 + rand.int(0, 25))}${rand.int(100000, 999999)}`;
        const cnss = `${rand.int(100000000, 999999999)}`;
        const baseSalary = rand.pick([3500, 4500, 5200, 6800, 7500, 9500, 12000]);
        await em.query(`
          INSERT INTO hr_employees (id, tenant_id, full_name, cin, cnss_number, gender, date_of_birth, hired_date, department, position, base_salary, family_children, active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13)
          ON CONFLICT DO NOTHING
        `, [id, tenantId, `${firstName} ${lastName}`, cin, cnss,
            rand.pick(['M', 'F', 'M', 'M', 'F']),                                                  // skew slight
            new Date(1980 + rand.int(0, 20), rand.int(0, 11), rand.int(1, 28)),
            new Date(2024, 0, 1),
            rand.pick(['Atelier', 'Reception', 'Admin', 'Commercial']),
            rand.pick(['Mecanicien', 'Receptionniste', 'Comptable', 'Manager', 'Apprenti']),
            baseSalary, rand.int(0, 4), new Date()]);
        employeeIds.push(id);
        
        // Contract CDI active
        const contractId = randomUUID();
        await em.query(`
          INSERT INTO hr_contracts (id, tenant_id, employee_id, contract_type, start_date, monthly_salary, working_hours_week, trial_period_months, status, signed_at)
          VALUES ($1, $2, $3, 'cdi', $4, $5, 44, 3, 'active', $4)
          ON CONFLICT DO NOTHING
        `, [contractId, tenantId, id, new Date(2024, 0, 1), baseSalary]);
      }
      employeesByTenant.set(tenantId, employeeIds);
    }
    
    // 3. Seed stock for garage tenants only (first 3)
    console.log('[seed-phase-3] Seeding stock (categories + items + lots)...');
    for (const tenantId of tenantIds.slice(0, 3)) {
      // Categories
      const categoryIds: string[] = [];
      for (const catName of STOCK_CATEGORIES) {
        const catId = randomUUID();
        await em.query(`
          INSERT INTO stock_categories (id, tenant_id, name, code, active, created_at)
          VALUES ($1, $2, $3, $4, true, $5)
          ON CONFLICT DO NOTHING
        `, [catId, tenantId, catName, catName.toUpperCase().slice(0, 8), new Date()]);
        categoryIds.push(catId);
      }
      
      // Items (~333 per garage)
      const itemIds: string[] = [];
      for (let i = 0; i < 333; i++) {
        const itemId = randomUUID();
        const catId = rand.pick(categoryIds);
        const sku = `${tenantId.slice(0, 4)}-${String(i).padStart(4, '0')}`;
        await em.query(`
          INSERT INTO stock_items (id, tenant_id, category_id, sku, name, unit, reorder_threshold, ideal_stock, active, created_at)
          VALUES ($1, $2, $3, $4, $5, 'pcs', 5, 20, true, $6)
        `, [itemId, tenantId, catId, sku, `Item ${sku}`, new Date()]);
        itemIds.push(itemId);
        
        // 5 lots per item
        for (let lot = 0; lot < 5; lot++) {
          const lotId = randomUUID();
          const qty = rand.int(5, 15);
          const cost = 50 + rand.int(0, 950);
          await em.query(`
            INSERT INTO stock_lots (id, tenant_id, item_id, quantity_in, quantity_remaining, unit_cost, entry_date, created_at)
            VALUES ($1, $2, $3, $4, $4, $5, $6, $6)
          `, [lotId, tenantId, itemId, qty, cost, new Date(2024 + Math.floor(lot / 12), lot % 12, 1)]);
        }
      }
    }
    
    // 4. Seed payslips 12 months
    console.log('[seed-phase-3] Seeding 600 payslips...');
    // ... computed via PayrollCalculatorService

    // 5. Seed leaves
    console.log('[seed-phase-3] Seeding 150 leaves...');
    // ... random pending + approved leaves

    // 6. Trigger ETL ClickHouse sync (via API or direct service call)
    console.log('[seed-phase-3] Triggering ClickHouse ETL sync...');
    // ... call ETL service or POST /admin/analytics/resync
  });

  await ds.destroy();
  console.log('[seed-phase-3] DONE.');
}

seedPhase3().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function initDataSource(): Promise<DataSource> {
  // ... bootstrap typeorm
  return null as any;
}
```

### 6.2 Tests E2E `sprint-13-full-suite.e2e-spec.ts` (35+ tests structures)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
// ...

describe('Sprint 13 Full Suite E2E (35+ tests)', () => {
  beforeAll(async () => {
    // Boot app + run seed script
  });

  describe('Group 1: ClickHouse + ETL (5 tests)', () => {
    it('ClickHouse ping OK', async () => { /* ... */ });
    it('ETL sync transactions populates fct_transactions', async () => { /* ... */ });
    it('ETL idempotency : no doublons after rerun', async () => { /* ... */ });
    it('Admin resync triggers job', async () => { /* ... */ });
    it('etl-state endpoint returns 7 tables', async () => { /* ... */ });
  });

  describe('Group 2: Dashboards (6 tests)', () => {
    it('GET /dashboards/revenue returns RevenuePoint[]', async () => { /* ... */ });
    it('GET /dashboards/conversion returns funnel', async () => { /* ... */ });
    it('GET /dashboards/activity returns heatmap', async () => { /* ... */ });
    it('GET /dashboards/sinistre-rate stub warning', async () => { /* ... */ });
    it('GET /dashboards/nps stub null score', async () => { /* ... */ });
    it('GET /dashboards/funnel-tenant SuperAdmin only', async () => { /* ... */ });
  });

  describe('Group 3: Stock (10 tests)', () => {
    it('CRUD stock_items', async () => { /* ... */ });
    it('CRUD stock_categories with hierarchy', async () => { /* ... */ });
    it('Stock valorisation FIFO correct', async () => { /* ... */ });
    it('Stock movements entry creates lot', async () => { /* ... */ });
    it('Stock movements exit consumes FIFO multi-lots', async () => { /* ... */ });
    it('Stock movements exit INSUFFICIENT_STOCK rejected', async () => { /* ... */ });
    it('Stock adjustment positive creates adjustment_in', async () => { /* ... */ });
    it('Stock adjustment negative creates adjustment_out FIFO', async () => { /* ... */ });
    it('Stock low_stock alerts cron + endpoint', async () => { /* ... */ });
    it('Stock inventory at past date replay correct', async () => { /* ... */ });
  });

  describe('Group 4: HR employees + contracts (4 tests)', () => {
    it('Create employee with CIN MA validation', async () => { /* ... */ });
    it('Reject duplicate CIN', async () => { /* ... */ });
    it('CDI no end_date, CDD requires end_date', async () => { /* ... */ });
    it('Terminate employee + Kafka event', async () => { /* ... */ });
  });

  describe('Group 5: HR conges (5 tests)', () => {
    it('Request paid leave decrements pending balance', async () => { /* ... */ });
    it('Approve transitions to used balance', async () => { /* ... */ });
    it('Reject restores pending', async () => { /* ... */ });
    it('Cancel before start restores used', async () => { /* ... */ });
    it('Sick >= 4j requires certificate', async () => { /* ... */ });
  });

  describe('Group 6: HR paie (5+ tests)', () => {
    it('CNSS computation 4.48% capped 6000 -- 5000 brut = 224', async () => { /* ... */ });
    it('AMO 2.26% no cap -- 7500 brut = 169.50', async () => { /* ... */ });
    it('IR brackets MA 2026 -- 90k annuel = ~330 IR/mois', async () => { /* ... */ });
    it('Generate payslip + validate + Books ecriture', async () => { /* ... */ });
    it('CNSS declaration XML format valid', async () => { /* ... */ });
    it('IR declaration CSV format valid', async () => { /* ... */ });
  });

  // Reproductibilite : run all 5x
  describe('Reproductibilite', () => {
    it.skip('Run 5x same fixtures -> same results', async () => {
      // Long test : skip default, enable in CI nightly
    });
  });
});
```

### 6.3 Documentation `phase-3-completion.md`

```markdown
# Phase 3 -- Modules Horizontaux : COMPLETION REPORT
**Reference** : B-13 Sprint 13 Tache 3.6.14 Phase 3 closure
**Date completion** : 2026-05-29
**Statut** : COMPLETE

## Resume executif

La Phase 3 (Modules Horizontaux) de Skalean InsurTech v2.2 est officiellement complete.
Sur 6 sprints (B-08 a B-13), 87 taches detaillees ont ete livrees, 30+ entites operationnelles
crees, 100+ endpoints REST exposes, 9 lois marocaines respectees.

## Sprints livres

| Sprint | Module | Status | Taches | Effort |
|--------|--------|--------|--------|--------|
| B-08 | CRM + Booking | OK | 15 | 75h |
| B-09 | Comm WhatsApp + Email | OK | 14 | 70h |
| B-10 | Docs + Signature ANRT | OK | 16 | 80h |
| B-11 | Pay multi-passerelles MA | OK | 14 | 75h |
| B-12 | Books + Compliance ACAPS | OK | 13 | 75h |
| B-13 | Analytics + Stock + HR | OK | 14 | 75h |
| **Total** | | | **87** | **450h** |

## Modules livres

### CRM + Booking (B-08)
- Contacts, companies, deals, interactions
- Rooms + appointments + calendrier
- Heatmap activity (consume par Sprint 13 analytics)

### Comm WA + Email (B-09)
- WhatsApp Business API integration
- Email SendGrid + templates Handlebars 3 langues
- Queue BullMQ

### Docs + Signature ANRT (B-10)
- S3 storage multi-tenant
- PDF generation Handlebars
- Signature electronique Barid eSign + ANRT TSA (loi 53-05)

### Pay multi-passerelles MA (B-11)
- 6 PSP MA : CMI, PayZone, MTC, HPS, PayPal, Stripe test
- Wallets Lyf, Orange, Inwi
- Anti-fraud rules + reconciliation

### Books + Compliance (B-12)
- Plan comptable CGNC complet
- Journal entries double-entry
- TVA 5 taux MA
- Reports ACAPS quarterly + annual solvency
- AML monitoring + SAFT-MA export

### Analytics + Stock + HR (B-13 -- ce sprint)
- ClickHouse OLAP 24.10 + 8 schemas + ETL polling 5min
- 6 dashboards REST initiaux
- Stock FIFO valorisation + alertes seuil
- HR employees + contrats CDI/CDD/ANAPEC
- HR conges workflow + balances
- HR paie CNSS+AMO+IR brackets MA + declarations

## Conformite legale MA

| Loi/Decret | Couverture | Sprint |
|------------|-----------|--------|
| Loi 09-08 CNDP donnees personnelles | OK | B-08, B-10, B-13 |
| Loi 43-20 services confiance | OK | B-10 (signature) |
| Loi 53-05 signature electronique | OK | B-10 |
| Loi 9-88 + 38-14 obligations comptables | OK | B-12, B-13 (Stock) |
| Loi 47-06 IR | OK | B-13 (paie) |
| Loi 65-00 AMO | OK | B-13 (paie) |
| Loi 65-99 Code travail | OK | B-13 (HR) |
| Decret CNSS 2-22-742 | OK | B-13 (paie) |
| ACAPS reporting | OK | B-12 |

## Statistiques

- **Entites Postgres** : 35+ (auth, crm, booking, comm, docs, pay, books, analytics, stock, hr)
- **Endpoints REST** : 110+ (API gateway uniforme)
- **Tests** : 800+ (unit + integration + E2E)
- **Coverage** : 87% moyen
- **Volumes test** : 5 tenants + 50 employees + 1000 items + 5000 lots
- **Kafka topics** : 25+ (events cross-module)
- **Migrations** : 28 SQL

## Endpoints prerequis Sprint 14 (Phase 4 Insure)

Tous disponibles. Sprint 14 demarre avec :
- CRM contacts -> souscripteurs
- Pay -> primes
- Books -> commissions
- Docs -> polices PDF + signatures
- Analytics -> dashboards Insure-specific (a creer)
- Stock + HR pas utilises (reserves Repair Phase 5)

## Runbook deploiement modules horizontaux

[Procedures deploy Atlas Cloud Benguerir DC1/DC2 + secrets management + migrations sequentielles]

## Sprint 14 demarrage

Phase 4 Insure peut demarrer. Prerequis valides. Documentation transferee.

---
**Fin Phase 3 Completion Report.**
```

### 6.4 Verification `V-13-analytics-stock-hr.md`

```markdown
# Verification V-13 -- Analytics + Stock + HR

**Sprint** : 13
**Auditeur** : QA team Sprint 13
**Date** : 2026-05-29

## Checklist
- [ ] V1 ClickHouse demarre OK
- [ ] V2 ETL polling 5min execute
- [ ] V3 6 dashboards repondent < 1s
- [ ] V4 Stock FIFO computation correct
- [ ] V5 HR paie CNSS 4.48% capped 6000
- [ ] V6 HR paie AMO 2.26% no cap
- [ ] V7 HR paie IR brackets MA 2026 exact
- [ ] V8 Declaration CNSS XML conforme
- [ ] V9 Books ecritures auto fonctionnelles
- [ ] V10 Test E2E garage end-to-end passe
- [ ] V11 35+ tests E2E green
- [ ] V12 Aucune emoji
- [ ] V13 Coverage >= 85%
- [ ] V14 Documentation Phase 3 closure complete
```

---

## 7-16. Variables, criteres, edge cases

### Criteres P0 (12)
V1 35+ tests E2E PASS
V2 CI green
V3 Fixtures execute < 60s
V4 Reproductibilite 5x runs
V5 ClickHouse populated apres seed
V6 Stock FIFO valorisation correcte sur fixtures
V7 Payslips 600 generes coherents
V8 CNSS declaration produit
V9 Phase 3 closure doc complete
V10 V-13 verification doc rempli
V11 Multi-tenant isolation verifiee
V12 Performance benchmark documenter

### Criteres P1 (4)
V13 CI nightly tests reproductibilite
V14 Postman collection garage
V15 SLO performance documente
V16 Audit Phase 3 livre

### Criteres P2 (3)
V17 Demos video Sprint 13
V18 Walkthrough garage flow
V19 Doc API OpenAPI export

### Edge cases (10)
1. Seed conflict UNIQUE -> ON CONFLICT DO NOTHING
2. Postgres timeout long seed -> chunks + commit each 1000
3. Kafka events consume slowly -> wait 5s entre validations
4. ClickHouse ETL not yet run -> trigger manual avant tests
5. Memory heap V8 fixtures lourdes -> chunking
6. Decimal precision dans seeds -> Decimal.js
7. Multi-locale tests -> seed avec accents francais
8. Time zone tests CI vs local -> force UTC
9. Random determinist failure -> seeded random
10. Cross-tenant pollution test runs -> drop database between

### Commit
```bash
git commit -m "feat(sprint-13): tests E2E 35+ + fixtures Phase 3 + closure documentation

Task: 3.6.14 -- DERNIER SPRINT 13 + CLOTURE PHASE 3
Sprint: 13
Phase: 3 COMPLETE
Reference: B-13 Tache 3.6.14

Phase 3 -- Modules Horizontaux : COMPLETE
- 6 sprints livres : CRM+Booking / Comm WA+Email / Docs+Signature /
  Pay multi-MA / Books+Compliance / Analytics+Stock+HR
- 87 taches detaillees
- 30+ entites operationnelles
- 110+ endpoints REST
- 800+ tests
- Coverage 87%
- Conformite 9 lois MA

Tests: 35+ E2E + fixtures 5 tenants/50 employees/1000 items
Coverage: 87%

Sprint 14 (Phase 4 Insure) demarre avec socle modules horizontaux complet."
```

### Next : Sprint 14 (Phase 4 Insure Foundation) - debut

---

## ENRICHISSEMENT v2 -- Sections supplementaires (densite cible 100-150 ko)

### A. Suite tests E2E exhaustive (detail des 35+ scenarios)

#### A.1 Groupe Analytics ClickHouse + ETL (8 tests)

```typescript
describe('Sprint 13 -- Group 1 Analytics ClickHouse + ETL', () => {
  it('1.1 ClickHouse cluster up + ping', async () => {
    const res = await fetch('http://localhost:8123/ping');
    expect(await res.text()).toMatch(/Ok\./);
  });

  it('1.2 8 fct_/dim_ tables exist', async () => {
    const tables = await ch.query<{ name: string }>({
      query: `SELECT name FROM system.tables WHERE database = 'skalean_analytics'`,
    });
    const names = tables.map((t) => t.name);
    expect(names).toContain('fct_transactions');
    expect(names).toContain('fct_journal_entries');
    expect(names).toContain('fct_appointments');
    expect(names).toContain('fct_messages');
    expect(names).toContain('fct_documents_signed');
    expect(names).toContain('dim_tenants');
    expect(names).toContain('dim_customers');
    expect(names).toContain('dim_dates');
  });

  it('1.3 dim_dates 1827 rows seeded', async () => {
    const r = await ch.query<{ cnt: string }>({
      query: 'SELECT count() AS cnt FROM skalean_analytics.dim_dates',
    });
    expect(Number(r[0].cnt)).toBe(1827);
  });

  it('1.4 Holidays MA correctly seeded', async () => {
    const r = await ch.query<{ name: string }>({
      query: `SELECT holiday_name_ma FROM skalean_analytics.dim_dates WHERE date = '2024-07-30'`,
    });
    expect(r[0].name).toBe('Fete trone');
  });

  it('1.5 ETL syncTransactions populates fct_transactions', async () => {
    // Setup : INSERT pay_transactions Postgres test
    await ds.query(`INSERT INTO pay_transactions (id, tenant_id, amount, fees_amount, provider, status, currency, updated_at, created_at, event_date) VALUES (gen_random_uuid(), $1, 100, 5, 'cmi', 'captured', 'MAD', now() - interval '1 hour', now() - interval '1 hour', CURRENT_DATE)`, [TENANT_1]);
    await etl.syncTransactions();
    const r = await ch.query<{ cnt: string }>({
      query: `SELECT count() AS cnt FROM skalean_analytics.fct_transactions WHERE tenant_id = {t:UUID}`,
      query_params: { t: TENANT_1 },
    });
    expect(Number(r[0].cnt)).toBeGreaterThanOrEqual(1);
  });

  it('1.6 ETL idempotency : 2 syncs same delta -> no doublons', async () => {
    const r1 = await etl.syncTransactions();
    const cnt1 = r1.rowsInserted;
    const r2 = await etl.syncTransactions();
    expect(r2.rowsInserted).toBeLessThanOrEqual(cnt1);
  });

  it('1.7 ETL state persisted in Postgres analytics_etl_state', async () => {
    await etl.syncTransactions();
    const state = await ds.query(`SELECT last_synced_at, last_status FROM analytics_etl_state WHERE table_name = 'fct_transactions'`);
    expect(state[0].last_status).toBe('success');
    expect(state[0].last_synced_at).toBeDefined();
  });

  it('1.8 Admin resync forces full sync', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/analytics/resync')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ table: 'fct_transactions', forceResync: true })
      .expect(201);
    expect(res.body.job_id).toBeDefined();
  });
});
```

#### A.2 Groupe 6 Dashboards (8 tests)

```typescript
describe('Sprint 13 -- Group 2 Dashboards', () => {
  it('2.1 GET /dashboards/revenue returns array + meta', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-12-31&group_by=month')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.body.data.points).toBeInstanceOf(Array);
    expect(res.body.meta.version).toBe('v1');
  });

  it('2.2 group_by=day produces toDate(event_date) expression', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboards/revenue?date_start=2026-05-01&date_end=2026-05-31&group_by=day')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.body.meta.filters.group_by).toBe('day');
  });

  it('2.3 GET /dashboards/conversion returns funnel array', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboards/conversion?date_start=2026-01-01&date_end=2026-12-31')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.body.data.funnel).toBeInstanceOf(Array);
  });

  it('2.4 GET /dashboards/activity returns heatmap', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboards/activity?date_start=2026-01-01&date_end=2026-12-31')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.body.data.heatmap).toBeInstanceOf(Array);
  });

  it('2.5 GET /dashboards/sinistre-rate returns stub warning', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboards/sinistre-rate')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.body.meta.warning).toContain('stub_data');
  });

  it('2.6 GET /dashboards/nps returns null score Sprint 13', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboards/nps')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.body.data.nps_score).toBeNull();
  });

  it('2.7 GET /dashboards/funnel-tenant SuperAdmin required', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboards/funnel-tenant')
      .set('Authorization', `Bearer ${userToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(403);
    const res = await request(app.getHttpServer())
      .get('/api/v1/analytics/dashboards/funnel-tenant?date_start=2026-01-01&date_end=2026-12-31')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(res.body.data.funnel).toBeInstanceOf(Array);
  });

  it('2.8 Dashboard cache hit < 150ms on second call', async () => {
    await request(app.getHttpServer()).get('/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-01-31').set('Authorization', `Bearer ${userToken}`).set('x-tenant-id', TENANT_1);
    const t0 = Date.now();
    await request(app.getHttpServer()).get('/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-01-31').set('Authorization', `Bearer ${userToken}`).set('x-tenant-id', TENANT_1).expect(200);
    expect(Date.now() - t0).toBeLessThan(150);
  });
});
```

#### A.3 Groupe Stock (12 tests detailes)

```typescript
describe('Sprint 13 -- Group 3 Stock', () => {
  let itemId: string;
  let categoryId: string;

  it('3.1 Create stock category hierarchical', async () => {
    const parent = await request(app.getHttpServer())
      .post('/api/v1/stock/categories')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ name: 'Pneus', code: 'PNEUS' })
      .expect(201);
    const child = await request(app.getHttpServer())
      .post('/api/v1/stock/categories')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ name: 'Pneus 4x4', code: 'PNEUS-4X4', parent_id: parent.body.id })
      .expect(201);
    expect(child.body.parent_id).toBe(parent.body.id);
    categoryId = parent.body.id;
  });

  it('3.2 Create stock item with SKU uniqueness per tenant', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock/items')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({
        category_id: categoryId,
        sku: 'GAR-PNEU-205-55R16',
        name: 'Pneu Michelin 205/55R16',
        unit: 'pcs',
        reorder_threshold: 5,
        ideal_stock: 20,
      })
      .expect(201);
    itemId = res.body.id;
    expect(res.body.sku).toBe('GAR-PNEU-205-55R16');
  });

  it('3.3 Duplicate SKU same tenant rejected 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stock/items')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ sku: 'GAR-PNEU-205-55R16', name: 'Duplicate', unit: 'pcs' })
      .expect(409);
  });

  it('3.4 Stock entry creates lot + movement', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock/movements/entry')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .set('Idempotency-Key', `entry-test-1`)
      .send({ item_id: itemId, quantity: 10, unit_cost: 800, supplier_invoice_ref: 'FAC-001' })
      .expect(201);
    expect(res.body.lot.quantity_in).toBe('10.0000');
    expect(res.body.movement.movement_type).toBe('entry');
  });

  it('3.5 Idempotency replay returns conflict', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stock/movements/entry')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .set('Idempotency-Key', 'entry-test-1')
      .send({ item_id: itemId, quantity: 10, unit_cost: 800 })
      .expect(409);
  });

  it('3.6 Stock valorisation correct apres entry', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/stock/valorisation')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    const item = res.body.items.find((i: any) => i.item_id === itemId);
    expect(item.quantity).toBe('10.0000');
    expect(item.valorisation_fifo).toBe('8000.00');
  });

  it('3.7 Stock entry second lot different cost', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stock/movements/entry')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .set('Idempotency-Key', 'entry-test-2')
      .send({ item_id: itemId, quantity: 5, unit_cost: 850 })
      .expect(201);
    // Verify : 10 a 800 + 5 a 850 = 15 unites, valorisation = 8000 + 4250 = 12250
    const res = await request(app.getHttpServer())
      .get('/api/v1/stock/valorisation')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1);
    const item = res.body.items.find((i: any) => i.item_id === itemId);
    expect(item.valorisation_fifo).toBe('12250.00');
  });

  it('3.8 Stock exit FIFO consume oldest first', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/stock/movements/exit')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .set('Idempotency-Key', 'exit-test-1')
      .send({ item_id: itemId, quantity: 12, reason: 'Sinistre repair test' })
      .expect(201);
    // Consume : 10 a 800 + 2 a 850 = 8000 + 1700 = 9700 MAD total
    expect(res.body.totalCost).toBe('9700.00');
    expect(res.body.lotsConsumed).toHaveLength(2);
  });

  it('3.9 Stock exit INSUFFICIENT_STOCK rejected', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/stock/movements/exit')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ item_id: itemId, quantity: 1000, reason: 'too much' })
      .expect(400);
  });

  it('3.10 Low stock alert detects after exit', async () => {
    // After exit of 12 of 15, remaining = 3 < threshold 5
    const res = await request(app.getHttpServer())
      .get('/api/v1/stock/alerts/low-stock')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    const alert = res.body.data.find((a: any) => a.item_id === itemId);
    expect(alert).toBeDefined();
    expect(alert.shortage).toBeDefined();
  });

  it('3.11 Inventory at past date replays correctly', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/stock/reports/inventory?date=2025-01-01')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.body.items).toBeInstanceOf(Array);
  });

  it('3.12 CSV export contains BOM for Excel', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/stock/valorisation/export.csv')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);   // BOM
    expect(res.text).toContain('sku,name,quantity');
  });
});
```

#### A.4 Groupe HR Employees + Contracts (5 tests)

```typescript
describe('Sprint 13 -- Group 4 HR Employees + Contracts', () => {
  let employeeId: string;
  let contractId: string;

  it('4.1 Create employee with valid MA CIN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({
        full_name: 'Rachid Bennani',
        cin: 'BE123456',
        cnss_number: '123456789',
        gender: 'M',
        date_of_birth: '1985-06-15',
        hired_date: '2026-06-01',
        department: 'Atelier',
        position: 'Mecanicien chef',
        base_salary: 7500,
        family_children: 2,
      })
      .expect(201);
    employeeId = res.body.id;
    expect(res.body.cin).toBe('BE123456');
  });

  it('4.2 Reject invalid CIN format', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({
        full_name: 'Test', cin: 'invalid123', gender: 'M',
        date_of_birth: '1985-01-01', hired_date: '2026-01-01', base_salary: 5000, family_children: 0,
      })
      .expect(400);
  });

  it('4.3 Reject salary < SMIG 2970', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({
        full_name: 'Underpaid', cin: 'A12345', gender: 'M',
        date_of_birth: '1985-01-01', hired_date: '2026-01-01', base_salary: 2500, family_children: 0,
      })
      .expect(400);
  });

  it('4.4 Create CDI contract + activate', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/hr/employees/${employeeId}/contracts`)
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ contract_type: 'cdi', start_date: '2026-06-01', monthly_salary: 7500, working_hours_week: 44, trial_period_months: 3 })
      .expect(201);
    contractId = res.body.id;
    await request(app.getHttpServer())
      .post(`/api/v1/hr/contracts/${contractId}/activate`)
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
  });

  it('4.5 Terminate employee + Kafka event', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/hr/employees/${employeeId}/terminate`)
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ terminated_date: '2026-12-31', termination_reason: 'End of trial period evaluation' })
      .expect(200);
    expect(res.body.active).toBe(false);
    expect(res.body.terminated_date).toBe('2026-12-31');
  });
});
```

#### A.5 Groupe HR Conges (5 tests)

```typescript
describe('Sprint 13 -- Group 5 HR Leaves', () => {
  let leaveId: string;
  const EMP_ID = '<created in beforeAll>';

  it('5.1 Request paid leave decrements pending balance', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hr/leaves/request')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ employee_id: EMP_ID, leave_type: 'paid', start_date: '2026-07-01', end_date: '2026-07-05' })
      .expect(201);
    leaveId = res.body.id;
    expect(res.body.status).toBe('pending');
    const bal = await request(app.getHttpServer())
      .get(`/api/v1/hr/leaves/balance/${EMP_ID}?year=2026`)
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1);
    expect(Number(bal.body.paid_leave_pending)).toBeGreaterThanOrEqual(5);
  });

  it('5.2 Approve transitions to approved + balance update', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/hr/leaves/${leaveId}/approve`)
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.body.status).toBe('approved');
    const bal = await request(app.getHttpServer())
      .get(`/api/v1/hr/leaves/balance/${EMP_ID}?year=2026`)
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1);
    expect(Number(bal.body.paid_leave_used)).toBeGreaterThanOrEqual(5);
  });

  it('5.3 Sick leave >= 4 days without certificate rejected', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/hr/leaves/request')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ employee_id: EMP_ID, leave_type: 'sick', start_date: '2026-08-01', end_date: '2026-08-10', reason: 'fievre' })
      .expect(400);
  });

  it('5.4 Maternity = 14 weeks (98 days)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hr/leaves/request')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ employee_id: EMP_ID, leave_type: 'maternity', start_date: '2026-09-01', end_date: '2026-12-07', reason: 'maternite' })
      .expect(201);
    expect(Number(res.body.days_count)).toBe(98);
  });

  it('5.5 Cancel approved leave before start restores balance', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/hr/leaves/request')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .send({ employee_id: EMP_ID, leave_type: 'paid', start_date: '2027-01-01', end_date: '2027-01-03' });
    await request(app.getHttpServer())
      .post(`/api/v1/hr/leaves/${created.body.id}/approve`)
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1);
    await request(app.getHttpServer())
      .post(`/api/v1/hr/leaves/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
  });
});
```

#### A.6 Groupe HR Paie (7 tests)

```typescript
describe('Sprint 13 -- Group 6 HR Paie', () => {
  it('6.1 CNSS computation 5000 brut = 224.00 MAD', () => {
    expect(calculator.computeCnssEmployee(5000)).toBe('224.00');
  });

  it('6.2 CNSS plafonne 6000 -- 10000 brut = 268.80 MAD', () => {
    expect(calculator.computeCnssEmployee(10000)).toBe('268.80');
  });

  it('6.3 AMO 2.26% no plafond -- 100000 brut = 2260 MAD', () => {
    expect(calculator.computeAmoEmployee(100000)).toBe('2260.00');
  });

  it('6.4 IR bracket 30% -- base 70000 = 7000 IR', () => {
    const Decimal = require('decimal.js').default;
    const r = calculator.computeIrFromBrackets(new Decimal(70000));
    expect(r.irGrossAnnual.toFixed(2)).toBe('7000.00');
  });

  it('6.5 Generate payslip + validate + Books ecriture created', async () => {
    // Create employee + contract
    // POST /generate-period
    // Validate payslip
    // Wait Kafka consumer
    // Verify Books journal_entry created
  });

  it('6.6 CNSS declaration XML format valid', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/hr/reports/declaration-cnss/xml?period=2026-05')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(res.text).toContain('<DeclarationCNSS>');
    expect(res.text).toContain('<Periode>2026-05</Periode>');
  });

  it('6.7 IR declaration CSV with BOM', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/hr/reports/declaration-ir/csv?year=2026')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', TENANT_1)
      .expect(200);
    expect(res.text.charCodeAt(0)).toBe(0xFEFF);
  });
});
```

### B. Seed fixtures script complet detaille

```typescript
// repo/infrastructure/scripts/seed-phase-3-fixtures.ts (version complete)
#!/usr/bin/env tsx
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';
import { PayrollCalculatorService } from '../../packages/hr/src/services/payroll-calculator.service';

const SEED = 20260515;

class SeededRandom {
  private s: number;
  constructor(seed: number) { this.s = seed; }
  next(): number { this.s = (this.s * 9301 + 49297) % 233280; return this.s / 233280; }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(arr: T[]): T { return arr[this.int(0, arr.length - 1)]; }
  float(min: number, max: number, decimals = 2): number { return Number((this.next() * (max - min) + min).toFixed(decimals)); }
}

const rand = new SeededRandom(SEED);

const TENANTS = [
  { slug: 'garage-atlas-casa', legal_name: 'Garage Atlas Casablanca SARL', industry: 'garage', city: 'Casablanca', ice: '001234567890123', cnss_employer: '987654321' },
  { slug: 'garage-atlas-rabat', legal_name: 'Garage Atlas Rabat SARL', industry: 'garage', city: 'Rabat', ice: '001234567890124', cnss_employer: '987654322' },
  { slug: 'garage-atlas-marrakech', legal_name: 'Garage Atlas Marrakech SARL', industry: 'garage', city: 'Marrakech', ice: '001234567890125', cnss_employer: '987654323' },
  { slug: 'cabinet-bennani', legal_name: 'Cabinet Bennani Insurance', industry: 'broker', city: 'Casablanca', ice: '001234567890126', cnss_employer: '987654324' },
  { slug: 'cabinet-tazi', legal_name: 'Cabinet Tazi Brokerage', industry: 'broker', city: 'Rabat', ice: '001234567890127', cnss_employer: '987654325' },
];

const FIRST_NAMES_MA = ['Rachid', 'Aicha', 'Hassan', 'Fatima', 'Youssef', 'Khadija', 'Omar', 'Salma', 'Karim', 'Najat', 'Said', 'Hayat', 'Driss', 'Latifa', 'Mohamed'];
const LAST_NAMES_MA = ['Bennani', 'Tazi', 'Idrissi', 'Alaoui', 'Senhaji', 'Berrada', 'Fassi', 'Lahlou', 'Chraibi', 'Ouazzani', 'El Hassani', 'Slaoui', 'Benjelloun', 'Mernissi'];
const POSITIONS_GARAGE = ['Mecanicien', 'Mecanicien chef', 'Apprenti', 'Receptionniste', 'Manager', 'Comptable', 'Commercial', 'Magasinier'];
const POSITIONS_BROKER = ['Conseiller commercial', 'Directeur agence', 'Gestionnaire sinistre', 'Comptable', 'Assistant administratif'];
const DEPARTMENTS_GARAGE = ['Atelier', 'Reception', 'Admin', 'Commercial', 'Stock'];
const DEPARTMENTS_BROKER = ['Commercial', 'Sinistre', 'Admin', 'IT'];

const STOCK_CATEGORIES_GARAGE = [
  { name: 'Pneus', code: 'PNEUS', children: ['Pneus 4x4', 'Pneus citadine', 'Pneus utilitaire'] },
  { name: 'Filtres', code: 'FILT', children: ['Filtres huile', 'Filtres air', 'Filtres carburant', 'Filtres habitacle'] },
  { name: 'Plaquettes', code: 'PLAQ', children: ['Plaquettes avant', 'Plaquettes arriere'] },
  { name: 'Huile', code: 'HUI', children: ['Huile moteur', 'Huile boite', 'Huile direction'] },
  { name: 'Amortisseurs', code: 'AMOR', children: ['Amortisseurs avant', 'Amortisseurs arriere'] },
  { name: 'Batteries', code: 'BATT', children: ['Batteries 12V 60Ah', 'Batteries 12V 80Ah'] },
];

async function seed(): Promise<void> {
  console.log('[seed-phase-3] Initializing...');
  const ds = await initDataSource();

  await ds.transaction(async (em) => {
    // Step 1: Tenants
    console.log('[seed-phase-3] Step 1/9 -- Seeding 5 tenants...');
    const tenantIds: string[] = [];
    for (const t of TENANTS) {
      const id = randomUUID();
      await em.query(`
        INSERT INTO auth_tenants (id, slug, legal_name, industry, country, city, subscription_plan, monthly_revenue_mad, ice_number, cnss_number, created_at, activated_at)
        VALUES ($1, $2, $3, $4, 'MA', $5, 'pro', $6, $7, $8, $9, $9)
        ON CONFLICT (slug) DO NOTHING
      `, [id, t.slug, t.legal_name, t.industry, t.city, rand.float(8000, 25000), t.ice, t.cnss_employer, new Date('2024-01-01')]);
      tenantIds.push(id);
    }

    // Step 2: Employees (10 per tenant)
    console.log('[seed-phase-3] Step 2/9 -- Seeding 50 employees...');
    const employeesByTenant = new Map<string, string[]>();
    for (let tIdx = 0; tIdx < tenantIds.length; tIdx++) {
      const tenantId = tenantIds[tIdx];
      const isGarage = TENANTS[tIdx].industry === 'garage';
      const empIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = randomUUID();
        const firstName = rand.pick(FIRST_NAMES_MA);
        const lastName = rand.pick(LAST_NAMES_MA);
        const cinLetter = String.fromCharCode(65 + rand.int(0, 25));
        const cinLetter2 = rand.int(0, 1) === 0 ? '' : String.fromCharCode(65 + rand.int(0, 25));
        const cin = `${cinLetter}${cinLetter2}${rand.int(100000, 999999)}`;
        const cnss = `${rand.int(100000000, 999999999)}`;
        const baseSalary = rand.pick([3500, 4200, 4800, 5500, 6200, 7000, 8500, 10500, 12500]);
        await em.query(`
          INSERT INTO hr_employees (id, tenant_id, full_name, cin, cnss_number, gender, date_of_birth, hired_date, department, position, base_salary, family_children, active, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13)
        `, [id, tenantId, `${firstName} ${lastName}`, cin, cnss,
            rand.pick(['M', 'F', 'M', 'M', 'F']),
            new Date(1975 + rand.int(0, 25), rand.int(0, 11), rand.int(1, 28)),
            new Date(2024, rand.int(0, 11), rand.int(1, 28)),
            isGarage ? rand.pick(DEPARTMENTS_GARAGE) : rand.pick(DEPARTMENTS_BROKER),
            isGarage ? rand.pick(POSITIONS_GARAGE) : rand.pick(POSITIONS_BROKER),
            baseSalary, rand.int(0, 4), new Date()]);
        empIds.push(id);

        // CDI active contract
        const contractId = randomUUID();
        await em.query(`
          INSERT INTO hr_contracts (id, tenant_id, employee_id, contract_type, start_date, monthly_salary, working_hours_week, trial_period_months, status, signed_at)
          VALUES ($1, $2, $3, 'cdi', $4, $5, 44, 3, 'active', $4)
        `, [contractId, tenantId, id, new Date(2024, 0, 1), baseSalary]);
      }
      employeesByTenant.set(tenantId, empIds);
    }

    // Step 3: Stock (garage tenants only, first 3)
    console.log('[seed-phase-3] Step 3/9 -- Seeding stock categories + items + lots...');
    for (const tenantId of tenantIds.slice(0, 3)) {
      // Categories
      const catIds: string[] = [];
      for (const cat of STOCK_CATEGORIES_GARAGE) {
        const parentId = randomUUID();
        await em.query(`INSERT INTO stock_categories (id, tenant_id, name, code) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`, [parentId, tenantId, cat.name, cat.code]);
        catIds.push(parentId);
        for (const childName of cat.children) {
          const childId = randomUUID();
          await em.query(`INSERT INTO stock_categories (id, tenant_id, name, code, parent_id) VALUES ($1, $2, $3, $4, $5)`, [childId, tenantId, childName, `${cat.code}-${childName.slice(0, 4).toUpperCase()}`, parentId]);
          catIds.push(childId);
        }
      }

      // Items (~333 per garage)
      const itemIds: string[] = [];
      for (let i = 0; i < 333; i++) {
        const itemId = randomUUID();
        const cat = rand.pick(catIds);
        const sku = `GAR-${tenantId.slice(0, 4)}-${String(i).padStart(4, '0')}`;
        await em.query(`
          INSERT INTO stock_items (id, tenant_id, category_id, sku, name, unit, reorder_threshold, ideal_stock, active)
          VALUES ($1, $2, $3, $4, $5, 'pcs', $6, $7, true)
        `, [itemId, tenantId, cat, sku, `Item ${sku}`, rand.int(2, 10), rand.int(15, 50)]);
        itemIds.push(itemId);

        // 5 lots per item
        for (let lot = 0; lot < 5; lot++) {
          const lotId = randomUUID();
          const qty = rand.int(5, 20);
          const cost = rand.float(50, 1500);
          const entryDate = new Date(2024, lot + Math.floor(rand.int(0, 8)), rand.int(1, 28));
          await em.query(`
            INSERT INTO stock_lots (id, tenant_id, item_id, quantity_in, quantity_remaining, unit_cost, entry_date)
            VALUES ($1, $2, $3, $4, $4, $5, $6)
          `, [lotId, tenantId, itemId, qty, cost, entryDate]);
        }
      }
    }

    // Step 4: Stock movements (24000 entries + 6000 exits)
    console.log('[seed-phase-3] Step 4/9 -- Seeding 30000 movements...');
    // ... (loop generating entries + exits FIFO on existing items)

    // Step 5: Payslips (50 employees x 12 months = 600 payslips)
    console.log('[seed-phase-3] Step 5/9 -- Seeding 600 payslips...');
    const calculator = new PayrollCalculatorService();
    for (const [tenantId, empIds] of employeesByTenant) {
      for (const empId of empIds) {
        const emp = await em.query(`SELECT base_salary, family_children FROM hr_employees WHERE id = $1`, [empId]);
        if (!emp[0]) continue;
        for (let month = 1; month <= 12; month++) {
          const period = `2025-${String(month).padStart(2, '0')}`;
          const result = calculator.compute({
            grossSalaryMonthly: emp[0].base_salary,
            familyChildren: emp[0].family_children,
          });
          const payslipId = randomUUID();
          const contractId = (await em.query(`SELECT id FROM hr_contracts WHERE employee_id = $1 AND status = 'active' LIMIT 1`, [empId]))[0]?.id;
          if (!contractId) continue;
          await em.query(`
            INSERT INTO hr_payslips (id, tenant_id, employee_id, contract_id, period, gross_salary, cnss_employee, cnss_employer, amo_employee, amo_employer, ir_amount, net_salary, status, bracket_label)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'paid', $13)
            ON CONFLICT (tenant_id, employee_id, period) DO NOTHING
          `, [payslipId, tenantId, empId, contractId, period,
              result.gross_salary_monthly, result.cnss_employee, result.cnss_employer,
              result.amo_employee, result.amo_employer, result.ir_monthly, result.net_salary,
              result.bracket_label]);
        }
      }
    }

    // Step 6: Leaves (150)
    console.log('[seed-phase-3] Step 6/9 -- Seeding 150 leaves...');
    // ... (random pending, approved, rejected)

    // Step 7: Trigger ETL ClickHouse
    console.log('[seed-phase-3] Step 7/9 -- ClickHouse ETL sync...');
    // ... (call ETL service or POST resync)

    // Step 8: Verifications
    console.log('[seed-phase-3] Step 8/9 -- Verifying fixtures...');
    const verifEmployees = (await em.query(`SELECT count(*)::int AS c FROM hr_employees`))[0].c;
    const verifPayslips = (await em.query(`SELECT count(*)::int AS c FROM hr_payslips`))[0].c;
    console.log(`  Employees: ${verifEmployees} (expected 50)`);
    console.log(`  Payslips: ${verifPayslips} (expected 600)`);

    console.log('[seed-phase-3] Step 9/9 -- Done.');
  });

  await ds.destroy();
}

async function initDataSource(): Promise<DataSource> {
  // ... bootstrap typeorm
  return null as any;
}

seed().catch((err) => { console.error(err); process.exit(1); });
```

### C. Documentation Phase 3 closure detail complet

```markdown
# Phase 3 -- Modules Horizontaux : COMPLETION REPORT v2 detaille
**Reference** : B-13 Sprint 13 Tache 3.6.14

## I. Inventaire technique

### I.1 Packages monorepo crees Sprint 8-13

| Package | Sprint | LOC approx | Tests |
|---------|--------|-----------|-------|
| @insurtech/crm | B-08 | 1800 | 250 |
| @insurtech/booking | B-08 | 1200 | 180 |
| @insurtech/comm | B-09 | 2400 | 320 |
| @insurtech/docs | B-10 | 2200 | 280 |
| @insurtech/signature | B-10 | 1900 | 220 |
| @insurtech/pay | B-11 | 3200 | 450 |
| @insurtech/books | B-12 | 4100 | 580 |
| @insurtech/compliance | B-12 | 2300 | 280 |
| @insurtech/analytics | B-13 | 2800 | 350 |
| @insurtech/stock | B-13 | 1900 | 250 |
| @insurtech/hr | B-13 | 2600 | 380 |
| **Total Phase 3** | | **26 400** | **3 540** |

### I.2 Tables Postgres ajoutees Phase 3 (par sprint)

Sprint 8 : `crm_contacts`, `crm_companies`, `crm_deals`, `crm_interactions`, `booking_rooms`, `booking_appointments`, `booking_availabilities`.
Sprint 9 : `comm_messages`, `comm_templates`, `comm_attachments`.
Sprint 10 : `doc_documents`, `doc_signatures`, `doc_access_logs`.
Sprint 11 : `pay_transactions`, `pay_payment_methods`, `pay_refunds`, `pay_disputes`.
Sprint 12 : `books_accounts`, `books_journal_entries`, `books_journal_lines`, `books_invoices`, `books_tva_declarations`, `compliance_acaps_reports`, `compliance_aml_alerts`.
Sprint 13 : `analytics_etl_state`, `stock_categories`, `stock_items`, `stock_lots`, `stock_movements`, `stock_alerts_history`, `hr_employees`, `hr_contracts`, `hr_leaves`, `hr_leave_balances`, `hr_payslips`.

**Total Phase 3 = 35+ tables**.

### I.3 Tables ClickHouse Phase 3

`fct_transactions`, `fct_journal_entries`, `fct_appointments`, `fct_messages`, `fct_documents_signed`, `dim_tenants`, `dim_customers`, `dim_dates` (8 tables).

### I.4 Migrations Phase 3 totales : 28

### I.5 Endpoints REST Phase 3 totaux : 112

CRM 18 + Booking 12 + Comm 8 + Docs 15 + Signature 6 + Pay 14 + Books 16 + Compliance 8 + Analytics 8 + Stock 11 + HR 22 = **138 endpoints**.

### I.6 Kafka topics Phase 3 : 28

CRM 3, Booking 2, Comm 4, Docs 3, Signature 2, Pay 5, Books 3, Stock 3, HR 6, Analytics 1 = **32 topics**.

## II. Conformite legale Maroc Phase 3 (recap exhaustif)

[Detail loi par loi, articles, implementation Sprint specifique].

[Liste complete 9 lois MA, plus ANRT, CNDP, ACAPS, AMC, DGI, CNSS rules].

## III. Architecture Phase 3 retrospective

[Diagramme complet : 11 packages + 35 tables + 138 endpoints + 32 Kafka topics].

## IV. Runbook deploiement modules horizontaux

[Procedures Atlas Cloud Benguerir : migrations sequentielles, secrets vault, healthchecks].

## V. Sprint 14 demarrage prerequis

[Liste verifications a faire avant lancer Sprint 14 : tests CI green, migrations appliquees, fixtures realistes].

## VI. Lessons learned Phase 3

[Retours d'experience : ce qui a marche, ce qui doit etre ameliore Phase 4].
```

### D. Verification V-13 detaillee (checklist 25 items)

```markdown
# V-13 -- Verification Sprint 13 Analytics + Stock + HR
**Sprint** : 13 (DERNIER Phase 3)
**Auditeur** : QA Lead Skalean

## Checklist exhaustive

### Analytics ClickHouse
- [ ] V1 ClickHouse 24.10 demarre via docker-compose
- [ ] V2 8 tables fct_/dim_ crees + dim_dates 1827 rows
- [ ] V3 ETL polling 5min execute cron
- [ ] V4 ETL idempotency : 2 runs same delta -> no doublons
- [ ] V5 6 dashboards endpoints repondent < 1s
- [ ] V6 Multi-tenant isolation enforced via tenant_id filter

### Stock
- [ ] V7 3 tables stock_* crees + RLS enforced
- [ ] V8 FIFO valorisation correcte (test sur fixtures)
- [ ] V9 Exit FIFO consume oldest lots first
- [ ] V10 INSUFFICIENT_STOCK rejected avec details
- [ ] V11 Inventory historique date passee replay correct
- [ ] V12 Alertes low_stock cron daily + realtime consumer

### HR
- [ ] V13 hr_employees + hr_contracts + hr_leaves + hr_payslips OK
- [ ] V14 CIN MA format enforced
- [ ] V15 Salary >= SMIG 2970 enforced
- [ ] V16 CDI no end_date, CDD max 24 mois
- [ ] V17 Conges 18j base + bonus anciennete + maternite 14 sem
- [ ] V18 Paie CNSS 4.48% plafond 6000 -- test 6 cases
- [ ] V19 Paie AMO 2.26% no plafond -- test 4 cases
- [ ] V20 Paie IR 6 brackets MA 2026 -- test 12 cases boundaries

### Integration
- [ ] V21 Stock movement -> Books ecriture 3111/4411/34555 auto
- [ ] V22 Payslip validated -> Books ecriture 6171/4432/4441 auto
- [ ] V23 Declaration CNSS XML conforme schema Damancom
- [ ] V24 Declaration IR CSV conforme SIMPL-IR

### Qualite
- [ ] V25 Tests E2E 35+ pass + coverage >= 85%
- [ ] V26 No emoji (decision-006)
- [ ] V27 No console.log production
- [ ] V28 Docs Phase 3 closure >= 280 lignes
- [ ] V29 Postman collection complete
- [ ] V30 SLO performance documente
```

### E. Sprint 14 Onboarding Document

```markdown
# Sprint 14 (Phase 4 Insure Foundation) -- Onboarding

## Prerequisites verifies fin Sprint 13

- [x] Modules horizontaux complets
- [x] 138 endpoints REST disponibles
- [x] 32 Kafka topics fonctionnels
- [x] Tests CI green (3 540+ tests Phase 3)
- [x] Conformite MA 9 lois validee
- [x] Fixtures realistes deployables en CI

## Periodicite Phase 4

Sprint 14 a 19 : 6 sprints * 2 semaines = 12 semaines pour Vertical Insure.

## Modules Insure prevus

| Sprint | Module |
|--------|--------|
| B-14 | Insure foundation : polices + souscriptions |
| B-15 | Insure sinistres |
| B-16 | Insure commissions courtier |
| B-17 | Web Broker UI |
| B-18 | Web Customer Portal SEO |
| B-19 | Web Assure Portal + NPS capture |

## Building blocks reutilises

- CRM contacts -> souscripteurs
- Pay -> primes mensuelles/annuelles
- Books -> ecritures commissions auto
- Docs -> polices PDF + signatures ANRT
- Analytics -> dashboards Insure-specific
- Sprint 13 Analytics/Stock/HR : pas utilise Insure (Stock/HR pour Repair Phase 5)
```

### F. Liste complete des conventions strictes Phase 3 (rappel)

(Liste des 14 conventions appliquees uniformement sur toutes les taches.)

[Multi-tenant strict, Zod validation, Pino logger, argon2id auth, pnpm, TypeScript strict, Vitest tests >=85%, RBAC, Kafka topics insurtech.events.*, Imports @insurtech/*, decision-005 Skalean AI frontiere, decision-006 no-emoji, Idempotency-Key obligatoire mutations, Conventional Commits, decision-008 Cloud souverain MA].

---

**Fin enrichissement task-3.6.14-tests-e2e-fixtures-phase-3-closure.md.**

**PHASE 3 OFFICIELLEMENT CLOSE.**

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

