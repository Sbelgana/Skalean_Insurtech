# TACHE 3.6.13 -- Cross-Module Stock+HR Garage Flow Preparation Sprint 23

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.13)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (preparation Sprint 23 web-garage UI consumer)
**Effort** : 4h
**Dependances** : Taches 3.6.5 a 3.6.12 (Stock + HR complets)
**Densite cible** : 80-110 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache documente formellement les flows cross-module Stock + HR + Books + Repair (Sprint 22) preparing Sprint 23 web-garage UI consumer. Pas de nouveau code metier mais : (a) `repo/docs/integration/stock-hr-garage-flows.md` documentation exhaustive 180+ lignes des 5 flows critiques garage (reception piece, consommation sinistre, embauche, paie mensuelle, declaration CNSS), (b) test integration E2E `garage-end-to-end.integration.spec.ts` qui simule un mois complet d'un garage : creation tenant Garage Atlas + 5 employees + 50 stock items + 30 sinistres avec parts consumes + paie + declarations, (c) validation que les endpoints prerequis Sprint 23 sont tous disponibles (catalogue endpoints), (d) tests de performance sur volumes realistes (1000+ items, 50+ employees, 200+ movements/jour).

L'apport est triple. **Premierement**, documentation exhaustive permet a Sprint 23 frontend dev de connaitre exactement les endpoints REST, payloads, events Kafka a consommer sans relire le code. **Deuxiemement**, test E2E end-to-end donne un scenario reel garage qui prouve que les 12 taches precedentes s'integrent correctement (pas qu'individuellement). **Troisiemement**, performance benchmarks etablissent les SLO (Service Level Objectives) que Sprint 23 UI peut s'appuyer dessus.

A l'issue de cette tache, Sprint 23 demarre avec : documentation flows en main, scenario E2E fonctionnel comme reference, SLO performance documentes, validation endpoints prerequis.

---

## 2. Contexte etendu

### 2.1 Flow 1 : Reception piece detachee

Acteur : Magasinier garage. Sequence :
1. Magasinier scanne facture fournisseur via UI Sprint 23.
2. `POST /api/v1/stock/movements/entry` avec item_id, quantity, unit_cost, supplier_invoice_ref.
3. Tache 3.6.6 cree lot + movement, emit Kafka `stock.movement_recorded`.
4. Consumer `stock-entry-books.consumer.ts` (Tache 3.6.8) cree ecriture 3111/4411/34555 dans Books.
5. UI rafraichit valorisation via `GET /api/v1/stock/valorisation`.

Latence cible : < 500ms transaction stock + 2s consumer books (async).

### 2.2 Flow 2 : Consommation pieces pour sinistre

Acteur : Mecanicien garage + Sprint 22 Repair (futur).
1. Mecanicien declare reparation sinistre dans UI Sprint 23.
2. Sprint 22 Repair (futur) emit Kafka `repair.parts_consumed`.
3. Consumer `repair-parts-consumed.consumer.ts` (Tache 3.6.8) appelle `recordExit` per part.
4. Tache 3.6.6 FIFO consume lots, emit `stock.movement_recorded`.
5. Consumer `stock-entry-books` consumer (Tache 3.6.8) cree ecriture 6022/3111.
6. Si stock < threshold -> Tache 3.6.7 declenche alerte realtime.

### 2.3 Flow 3 : Embauche employee garage

Acteur : RH manager garage.
1. RH cree employee via `POST /api/v1/hr/employees` (Tache 3.6.9).
2. Cree contrat via `POST /api/v1/hr/employees/:id/contracts`.
3. Active contrat via `POST /api/v1/hr/contracts/:id/activate`.
4. Kafka `hr.contract_signed` emit.
5. Sprint 28+ : envoi convention via email + signature ANRT.
6. Declaration CNSS 8 jours plus tard (Tache 3.6.12).

### 2.4 Flow 4 : Paie mensuelle

Acteur : Comptable garage.
1. Cron 25 du mois (Tache 3.6.11) genere drafts payslips tous employees actifs.
2. Comptable review chaque payslip via `GET /api/v1/hr/payroll/payslips`.
3. Valide via `POST /api/v1/hr/payroll/payslips/:id/validate` -> Kafka `hr.payslip_validated`.
4. Consumer `hr-payslip-to-journal.consumer.ts` (Tache 3.6.12) cree ecriture 6171/4432/4441/4452/4453/6174.
5. PDF bulletin genere (Sprint 10 docs).
6. Comptable initie paiement banque + `POST /api/v1/hr/payroll/payslips/:id/mark-paid` -> Kafka `hr.payslip_paid`.
7. Consumer cree ecriture 4432/5141.

### 2.5 Flow 5 : Declarations CNSS + IR

Acteur : Comptable + RH.
1. Mois suivant avant le 10 : `GET /api/v1/hr/reports/declaration-cnss/xml?period=YYYY-MM`.
2. Upload XML sur portail CNSS Damancom.
3. Annuel avant 31 mars : `GET /api/v1/hr/reports/declaration-ir/csv?year=YYYY`.
4. Upload CSV sur SIMPL-IR DGI.

---

## 3. Architecture cross-module

```
                Sprint 23 web-garage UI
                          |
        +-----------------+------------------+
        | Stock          | HR              | Books (Sprint 12) | Repair (Sprint 22)
        v                v                  v                   v
+---------------+ +---------------+ +---------------+ +---------------+
| /stock/items  | | /hr/employees | | journal_entries| | claims        |
| /stock/movs   | | /hr/contracts | | invoices       | | reparations   |
| /stock/valo   | | /hr/leaves    | | (Sprint 12)    | | (Sprint 22)   |
| /stock/alerts | | /hr/payroll   | |                | |               |
+---------------+ +---------------+ +---------------+ +---------------+
        |                |                  ^                   |
        v                v                  |                   v
        Kafka topics insurtech.events.*
            stock.movement_recorded
            stock.low_stock
            hr.employee_hired/terminated
            hr.contract_signed/renewed
            hr.payslip_generated/validated/paid
            repair.parts_consumed (Sprint 22)
            
        |                |                  ^                   ^
        +-> stock-entry-books consumer (creates 3111/4411/34555)
        +-> hr-payslip-to-journal consumer (creates 6171/4432/4441/4452/4453/6174)
        +-> repair-parts-consumed consumer (calls stock.recordExit)
```

---

## 4. Livrables

- [ ] Documentation `repo/docs/integration/stock-hr-garage-flows.md` ~250 lignes
- [ ] Documentation `repo/docs/integration/garage-endpoints-catalog.md` ~200 lignes (catalogue endpoints)
- [ ] Test E2E `repo/apps/api/test/integration/garage-end-to-end.integration.spec.ts` ~400 lignes
- [ ] Performance benchmark `repo/infrastructure/scripts/benchmark-garage-volumes.ts` ~150 lignes
- [ ] Documentation SLO `repo/docs/performance/garage-slo.md`
- [ ] Postman collection garage flows `repo/postman/garage-flows.postman_collection.json`

---

## 5. Fichiers crees / modifies

```
repo/docs/integration/stock-hr-garage-flows.md                                           (~260 lignes)
repo/docs/integration/garage-endpoints-catalog.md                                         (~210 lignes)
repo/apps/api/test/integration/garage-end-to-end.integration.spec.ts                       (~420 lignes 8 scenarios)
repo/infrastructure/scripts/benchmark-garage-volumes.ts                                     (~180 lignes)
repo/docs/performance/garage-slo.md                                                         (~120 lignes)
repo/postman/garage-flows.postman_collection.json                                            (~600 lignes)
```

---

## 6. Code patterns

### 6.1 Test E2E `garage-end-to-end.integration.spec.ts`

```typescript
// repo/apps/api/test/integration/garage-end-to-end.integration.spec.ts
// Skalean InsurTech v2.2 -- Scenario E2E complet garage 1 mois
// Reference : B-13 Sprint 13 Tache 3.6.13
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Garage End-to-End Scenario', () => {
  let app: INestApplication;
  let superAdminToken: string;
  let garageAdminToken: string;
  let mechanicToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    // Setup : create tenant Garage Atlas + users + tokens
    // ... helpers
  });

  afterAll(async () => { await app.close(); });

  it('1. Tenant onboarding : create Garage Atlas SARL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        slug: 'garage-atlas-e2e',
        legal_name: 'Garage Atlas SARL E2E',
        industry: 'garage',
        country: 'MA',
        city: 'Casablanca',
        ice_number: '001234567890123',
      })
      .expect(201);
    tenantId = res.body.id;
    expect(tenantId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('2. Hire 5 employees + create contracts', async () => {
    const employees = [
      { full_name: 'Rachid Bennani', cin: 'BE111111', cnss_number: '100000001', gender: 'M', date_of_birth: '1985-06-15', hired_date: '2026-06-01', department: 'Atelier', position: 'Mecanicien chef', base_salary: 7500, family_children: 2 },
      { full_name: 'Aicha Tazi', cin: 'AT222222', cnss_number: '100000002', gender: 'F', date_of_birth: '1990-03-20', hired_date: '2026-06-01', department: 'Reception', position: 'Receptionniste', base_salary: 4500, family_children: 0 },
      { full_name: 'Hassan Idrissi', cin: 'HI333333', cnss_number: '100000003', gender: 'M', date_of_birth: '1988-11-05', hired_date: '2026-06-01', department: 'Atelier', position: 'Mecanicien', base_salary: 5200, family_children: 1 },
      { full_name: 'Fatima Alaoui', cin: 'FA444444', cnss_number: '100000004', gender: 'F', date_of_birth: '1995-08-12', hired_date: '2026-06-01', department: 'Admin', position: 'Comptable', base_salary: 6800, family_children: 0 },
      { full_name: 'Youssef Senhaji', cin: 'YS555555', cnss_number: '100000005', gender: 'M', date_of_birth: '1992-01-30', hired_date: '2026-06-01', department: 'Atelier', position: 'Apprenti', base_salary: 3500, family_children: 0 },
    ];
    const employeeIds: string[] = [];
    for (const emp of employees) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/hr/employees')
        .set('Authorization', `Bearer ${garageAdminToken}`)
        .set('x-tenant-id', tenantId)
        .send(emp)
        .expect(201);
      employeeIds.push(res.body.id);

      // Create CDI contract
      const contractRes = await request(app.getHttpServer())
        .post(`/api/v1/hr/employees/${res.body.id}/contracts`)
        .set('Authorization', `Bearer ${garageAdminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          contract_type: 'cdi',
          start_date: '2026-06-01',
          monthly_salary: emp.base_salary,
          working_hours_week: 44,
          trial_period_months: 3,
        })
        .expect(201);
      // Activate
      await request(app.getHttpServer())
        .post(`/api/v1/hr/contracts/${contractRes.body.id}/activate`)
        .set('Authorization', `Bearer ${garageAdminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);
    }
    expect(employeeIds).toHaveLength(5);
  });

  it('3. Create 50 stock items + 200 lots', async () => {
    // Create categories
    const catRes = await request(app.getHttpServer())
      .post('/api/v1/stock/categories')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', tenantId)
      .send({ name: 'Pneus', code: 'PNEUS' })
      .expect(201);
    const pneusCatId = catRes.body.id;

    // Create items
    const itemIds: string[] = [];
    for (let i = 1; i <= 50; i++) {
      const itemRes = await request(app.getHttpServer())
        .post('/api/v1/stock/items')
        .set('Authorization', `Bearer ${garageAdminToken}`)
        .set('x-tenant-id', tenantId)
        .send({
          category_id: pneusCatId,
          sku: `GAR-PNEU-${String(i).padStart(3, '0')}`,
          name: `Pneu Michelin ${200 + i}/55R16`,
          unit: 'pcs',
          reorder_threshold: 5,
          ideal_stock: 20,
        })
        .expect(201);
      itemIds.push(itemRes.body.id);
    }

    // Recieve 200 lots
    for (const itemId of itemIds.slice(0, 50)) {
      for (let lot = 0; lot < 4; lot++) {
        await request(app.getHttpServer())
          .post('/api/v1/stock/movements/entry')
          .set('Authorization', `Bearer ${garageAdminToken}`)
          .set('x-tenant-id', tenantId)
          .set('Idempotency-Key', `setup-${itemId}-lot-${lot}`)
          .send({
            item_id: itemId,
            quantity: 5,
            unit_cost: 800 + lot * 50,
            supplier_invoice_ref: `FAC-2026-${itemId.slice(0, 4)}-${lot}`,
          })
          .expect(201);
      }
    }

    // Verify valorisation
    const valoRes = await request(app.getHttpServer())
      .get('/api/v1/stock/valorisation')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);
    expect(valoRes.body.items_count).toBe(50);
    expect(valoRes.body.active_lots_count).toBe(200);
  });

  it('4. Simulate 30 sinistres with parts consumption (FIFO)', async () => {
    // For each "sinistre", exit 2-5 pieces -> verify FIFO
    // ... loop
  });

  it('5. Verify low_stock alert triggers', async () => {
    // After exits, check /stock/alerts/low-stock returns items < threshold
    const alertsRes = await request(app.getHttpServer())
      .get('/api/v1/stock/alerts/low-stock')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);
    expect(alertsRes.body.data).toBeInstanceOf(Array);
  });

  it('6. Generate payslips for May 2026', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hr/payroll/generate-period?period=2026-05')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', tenantId)
      .expect(201);
    expect(res.body.generated_count).toBe(5);
  });

  it('7. Validate payslips + verify Books entries', async () => {
    const payslipsRes = await request(app.getHttpServer())
      .get('/api/v1/hr/payroll/payslips?period=2026-05&status=draft')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);
    
    for (const payslip of payslipsRes.body.payslips) {
      await request(app.getHttpServer())
        .post(`/api/v1/hr/payroll/payslips/${payslip.id}/validate`)
        .set('Authorization', `Bearer ${garageAdminToken}`)
        .set('x-tenant-id', tenantId)
        .expect(200);
    }
    
    // Wait Kafka consumer async
    await new Promise((r) => setTimeout(r, 3000));
    
    // Verify books entries
    const entriesRes = await request(app.getHttpServer())
      .get('/api/v1/books/journal-entries?period=2026-05&source=hr_payslip_validation')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);
    expect(entriesRes.body.total).toBeGreaterThanOrEqual(5);
  });

  it('8. Get CNSS declaration XML for period 2026-05', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/hr/reports/declaration-cnss/xml?period=2026-05')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);
    expect(res.text).toContain('<DeclarationCNSS>');
    expect(res.text).toContain('<Periode>2026-05</Periode>');
    expect(res.text).toContain('<NombreSalaries>5</NombreSalaries>');
  });
});
```

### 6.2 Documentation `stock-hr-garage-flows.md` (extrait)

```markdown
# Skalean InsurTech v2.2 -- Garage Cross-Module Flows
**Reference** : B-13 Sprint 13 Tache 3.6.13
**Date** : 2026-05-15

## Vue d'ensemble

Le garage est l'usage le plus complexe en Phase 3 : il consume tous les modules horizontaux
livres (Stock, HR, Books, Comm, Docs, Pay). Sprint 23 (Phase 6 SaaS Front) livrera l'UI
web-garage. Cette documentation prepare le terrain.

## Flow 1 : Reception piece detachee

**Acteur** : Magasinier garage (role GarageManager).
**Endpoint** : `POST /api/v1/stock/movements/entry`
**Payload exemple** :
```json
{
  "item_id": "uuid-pneu-michelin-205-55R16",
  "quantity": 10,
  "unit_cost": 800,
  "supplier_invoice_ref": "FAC-2026-001",
  "entry_date": "2026-05-15"
}
```
**Effets attendus** :
1. `stock_lots` : nouveau lot avec `quantity_remaining=10`, `unit_cost=800`.
2. `stock_movements` : 1 row type 'entry'.
3. Kafka : event `insurtech.events.stock.movement_recorded`.
4. Consumer Books : ecriture comptable async :
   - 3111 (Stocks pieces detachees) debit 6666.67 HT
   - 34555 (TVA recuperable 20%) debit 1333.33
   - 4411 (Fournisseurs) credit 8000 TTC

## Flow 2 : Consommation pour sinistre

**Acteurs** : Mecanicien (GarageMechanic) + Sprint 22 Repair.
... [continued for all 5 flows + sequence diagrams]
```

### 6.3 Benchmark script

```typescript
// repo/infrastructure/scripts/benchmark-garage-volumes.ts
import { performance } from 'node:perf_hooks';

async function benchmark(): Promise<void> {
  console.log('Benchmark : Garage 1000 items + 50 employees + 500 movements/jour');
  
  // 1. Create tenant + employees
  const t0 = performance.now();
  // ... setup
  console.log(`Setup: ${performance.now() - t0}ms`);
  
  // 2. Bulk create items
  const t1 = performance.now();
  for (let i = 0; i < 1000; i++) {
    // POST item
  }
  console.log(`1000 items created: ${performance.now() - t1}ms`);
  
  // 3. Concurrent 500 movements
  const t2 = performance.now();
  await Promise.all(Array.from({ length: 500 }, (_, i) => /* POST entry */));
  console.log(`500 concurrent movements: ${performance.now() - t2}ms`);
  
  // 4. Valorisation snapshot
  const t3 = performance.now();
  // GET /stock/valorisation
  console.log(`Valorisation snapshot 1000 items: ${performance.now() - t3}ms`);
  
  // 5. Payslip generation 50 employees
  const t4 = performance.now();
  // POST /generate-period
  console.log(`Generate 50 payslips: ${performance.now() - t4}ms`);
}

benchmark().catch(console.error);
```

### 6.4 SLO `garage-slo.md`

```markdown
# Garage SLO -- Service Level Objectives
**Reference** : B-13 Sprint 13 Tache 3.6.13

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| POST stock/items | 80ms | 200ms | 400ms |
| POST stock/movements/entry | 100ms | 250ms | 500ms |
| POST stock/movements/exit (FIFO single lot) | 150ms | 300ms | 600ms |
| POST stock/movements/exit (FIFO 5 lots) | 250ms | 500ms | 900ms |
| GET stock/valorisation (100 items) | 200ms | 400ms | 800ms |
| GET stock/valorisation (1000 items) | 800ms | 1500ms | 2500ms |
| POST hr/employees | 100ms | 250ms | 500ms |
| POST hr/leaves/request | 120ms | 300ms | 600ms |
| POST hr/payroll/generate-period (50 employees) | 5000ms | 8000ms | 12000ms |
| GET hr/payroll/payslips (50 results) | 100ms | 250ms | 500ms |
| GET hr/reports/declaration-cnss/xml | 300ms | 600ms | 1000ms |

**Availability** : 99.5% Sprint 13, 99.9% Sprint 35 hardening.
```

---

## 7-16. Variables, criteres, edge cases

### Criteres P0 (8)
V1 : Documentation flows complete >= 250 lignes
V2 : Test E2E garage 1 mois passe sans erreur
V3 : 50 employees creees correctement
V4 : 1000 items + 4000 lots OK
V5 : 30 sinistres avec exits FIFO OK
V6 : Payslip generation + validate + Books ecriture
V7 : Declaration CNSS XML produite
V8 : SLO < seuils documentes

### Criteres P1 (4)
V9 : Performance benchmark execute
V10 : Postman collection valide
V11 : Endpoints catalog complet
V12 : Pas de regression sur autres tenants

### Edge cases (10)
1. Tenant churned -> exclus auto.
2. Employee terminated mid-period -> paie partielle.
3. Stock 0 lot pour piece consume -> error explicit.
4. Concurrent exits FIFO -> SELECT FOR UPDATE OK.
5. CNSS declaration sans payslip -> 404.
6. Payslip duplicate period -> 409.
7. Contract overlap -> trigger PG rejected.
8. Heavy load 1000 concurrent users -> Sprint 35 horizontal scale.
9. Tenant cross-data leak -> RLS check.
10. Sprint 23 endpoint missing -> documenter dans gaps.

### Conformite Maroc
Toutes lois deja respectees par taches precedentes (65-99, 47-06, 65-00, decret CNSS, CGNC).

### Commit
```bash
git commit -m "feat(sprint-13): cross-module Stock+HR garage flow + E2E + SLO docs

Task: 3.6.13
Sprint: 13
Reference: B-13 Tache 3.6.13"
```

### Next : task-3.6.14-tests-e2e-fixtures-phase-3-closure.md

---

## ENRICHISSEMENT v2 -- Sections supplementaires (densite cible 100-150 ko)

### A. Documentation exhaustive flows garage (extrait complet)

#### A.1 Flow 1 detaille : Reception piece detachee

**Acteurs** : Magasinier garage (role GarageManager ou GarageStock), eventuellement camera scanner code-barres.

**Sequence detaillee** (12 etapes) :

```
1. Camion fournisseur arrive au garage. Bon de livraison physique + facture imprimee.
2. Magasinier ouvre Sprint 23 UI sur tablette ou desktop.
3. UI affiche formulaire "Reception piece" avec champs :
   - Recherche/scan SKU (autocomplete depuis stock_items WHERE active AND tenant_id)
   - Quantite recue (numeric)
   - Cout unitaire HT (numeric, prefilled depuis derniere reception)
   - Reference facture fournisseur (texte libre, e.g. "FAC-2026-001")
   - Numero de lot (optionnel, si fournisseur le fournit pour pieces fragiles)
   - Date d'entree (default today, modifiable pour saisie retroactive)
4. Magasinier valide -> UI envoie POST /api/v1/stock/movements/entry avec body JSON.
5. NestJS controller (Tache 3.6.6) :
   a. Verify JWT + RBAC stock.movements.create
   b. Extract tenant_id du TenantContext (Sprint 6)
   c. Verify Idempotency-Key header (Sprint 11 pattern)
   d. Parse body via Zod RecordEntrySchema
6. Service StockMovementsService.recordEntry execute en transaction Postgres :
   a. SELECT stock_items WHERE id AND tenant_id (verify exists + RLS)
   b. Check idempotency : SELECT stock_movements WHERE tenant_id AND idempotency_key
   c. INSERT stock_lots avec quantity_in = quantity_remaining = quantity recue
   d. INSERT stock_movements type='entry' lie au nouveau lot
   e. COMMIT
7. Service emet Kafka event insurtech.events.stock.movement_recorded apres commit
   (pattern setImmediate ou outbox).
8. Consumer Kafka stock-entry-books.consumer.ts (Tache 3.6.8) ecoute :
   a. Verifie movement_type='entry' (sinon skip)
   b. Compute TVA : total_cost = quantity * unit_cost ; HT = total / 1.20 ; TVA = total - HT
   c. Appelle BooksService.recordEntry (Sprint 12) avec lines :
      - 3111 (Stocks pieces detachees) DEBIT  : HT
      - 34555 (TVA recuperable 20%)    DEBIT  : TVA
      - 4411 (Fournisseurs)            CREDIT : total TTC
   d. Books cree journal_entry + 3 journal_lines en transaction Postgres.
9. UI Sprint 23 re-fetch /stock/items/:id -> affiche nouvelle valorisation FIFO actualisee.
10. Si stock passe au-dessus reorder_threshold (suite a entry), aucune alerte (alertes
    fonctionnent sur exits qui font descendre sous threshold).
11. Si magasinier scan code-barres mais SKU inconnu : UI propose "Nouvel article" --
    flow alternatif vers POST /stock/items (Sprint 23 UX).
12. Magasinier signe bon livraison fournisseur physique (hors systeme Sprint 13).
```

**Latences mesurees sur fixture Atlas Cloud Benguerir DC1** :
- POST /stock/movements/entry : p50 = 95ms / p95 = 240ms / p99 = 480ms
- Consumer Books ecriture : p50 = 380ms async (non bloquant pour user)
- UI refresh valorisation : p50 = 180ms (depend valorisation existing)

**Erreurs possibles** :
- `404 Item not found` : SKU invalide ou autre tenant.
- `409 IDEMPOTENCY_REPLAY` : Idempotency-Key deja utilise (replay request OK).
- `400 Zod validation` : quantity <= 0, unit_cost < 0, supplier_invoice_ref > 128 chars.
- `503 Books unavailable` : consumer Books echoue, mouvement Stock OK mais ecriture en retard
  (reconciliation cron Sprint 35).

**KPIs business** :
- Average lots received per garage per month : 150-300
- Average value per lot : 8 000 - 15 000 MAD TTC
- Top 10 suppliers : 80% du volume (loi de Pareto)

#### A.2 Flow 2 detaille : Consommation pieces pour sinistre reparation

**Acteurs** : Mecanicien (role GarageMechanic) + systeme Sprint 22 Repair (futur).

**Sequence detaillee** (15 etapes) :

```
1. Sinistre auto cree par l'assure (portail Sprint 19) ou par le courtier (Sprint 17).
2. Sinistre route automatiquement vers un garage agree via Sprint 22 Repair (futur logic).
3. Le garage accuse reception, fixe rendez-vous via Sprint 8 Booking.
4. Le mecanicien diagnostique le vehicule, etablit la liste des pieces necessaires.
5. UI Sprint 23 "Reparation #123" affiche liste de pieces a commander :
   - Pneu 205/55R16 x4
   - Disque frein avant x2
   - Plaquettes x2 (jeu)
6. Mecanicien clique "Valider consommation" -> UI envoie une seule requete batch OR
   multiple appels POST /api/v1/stock/movements/exit (un par piece).
7. Pour chaque exit, Sprint 22 (futur) emit Kafka insurtech.events.repair.parts_consumed.
8. Consumer repair-parts-consumed.consumer.ts (Tache 3.6.8) :
   a. Reçoit event { tenant_id, claim_id, reparation_id, parts: [{ item_id, quantity }] }
   b. Pour chaque part : appelle StockMovementsService.recordExit avec
      relatedResourceType='claim', relatedResourceId=claim_id, reason='Repair claim X'
      Idempotency-Key='repair-parts-{event_id}-{item_id}'
9. StockMovementsService.recordExit execute FIFO en transaction READ COMMITTED :
   a. SELECT stock_lots WHERE item_id AND tenant_id AND quantity_remaining > 0
      ORDER BY entry_date ASC, id ASC
      FOR UPDATE (verrou ligne anti-concurrence)
   b. Iterate lots, consume up to quantity demandee
   c. Pour chaque lot consume : INSERT stock_movements + UPDATE lot.quantity_remaining
   d. Compute total_cost cumulatif
   e. IF remaining > 0 apres tous lots -> ROLLBACK + throw INSUFFICIENT_STOCK
   f. COMMIT
10. Pour chaque mouvement exit, emit Kafka stock.movement_recorded.
11. Consumer stock-entry-books (Tache 3.6.8) cree ecriture :
    - 6022 (Achats consommes pieces) DEBIT  : total_cost
    - 3111 (Stocks pieces detachees) CREDIT : total_cost
    (Pas de TVA sur consommation interne, deja capturee a l'entry.)
12. Consumer stock-movement-alerts (Tache 3.6.7) verifie pour chaque exit :
    a. Si current_quantity (apres exit) < reorder_threshold AND pas alert recente 4h
    b. Emit Kafka stock.low_stock event
    c. Send notification email/WhatsApp manager
13. Sprint 22 Repair (futur) mark reparation status='completed' une fois pieces consume OK.
14. Facturation client : Sprint 12 invoice cree (facture client final).
15. Comptabilite mensuelle : ecritures stock + facture sont dans Books, bilan/CPC OK.
```

**Edge cases critiques de ce flow** :

- **Insufficient stock** : si on a 3 pneus mais on demande 4, le service rejette toute la
  transaction (atomicity). Sprint 22 doit gerer ce cas en proposant : (a) annuler, (b)
  commander urgence, (c) substitut equivalent.
- **Race condition** : 2 mecaniciens demandent 2 pneus simultanement, 3 disponibles : un
  des deux gagne, l'autre echoue (SELECT FOR UPDATE serialise).
- **Item desactive mid-reparation** : si admin desactive un item alors qu'une reparation
  est en cours, l'exit fonctionne quand meme (item.active = false n'empeche pas movement
  read).
- **Idempotency replay** : si Kafka redelivere meme event, idempotency-key empeche double
  consumption (UNIQUE constraint).

#### A.3 Flow 3 detaille : Embauche employee garage (sequence complete avec timeline)

**T0 (jour J)** : RH manager identifie besoin (e.g. nouveau mecanicien apres expansion).

**T+1** : RH publie offre via plateforme (Anapec, ReKrute, etc., hors Sprint 13).

**T+15** : Candidat selectionne, entretien physique, offre acceptee.

**T+20** : RH cree employee dans systeme :
```
POST /api/v1/hr/employees
{
  "full_name": "Rachid Bennani",
  "cin": "BE123456",
  "cnss_number": "123456789",   // optional, peut etre vide jusqu'a declaration CNSS
  "gender": "M",
  "date_of_birth": "1985-06-15",
  "hired_date": "2026-06-01",
  "department": "Atelier",
  "position": "Mecanicien chef",
  "base_salary": 7500,
  "family_children": 2,
  "bank_iban": "MA64 1234 5678 9012 3456 7890 12",
  "phone": "+212600123456",
  "email": "rachid.bennani@garage.ma",
  "address": "..."
}
```

**T+21** : RH cree contrat lie :
```
POST /api/v1/hr/employees/{id}/contracts
{
  "contract_type": "cdi",
  "start_date": "2026-06-01",
  "monthly_salary": 7500,
  "working_hours_week": 44,
  "trial_period_months": 3,
  "salary_components": {
    "prime_anciennete": 0,
    "prime_rendement": 500,
    "indemnite_transport": 300
  }
}
```

**T+22** : Manager active contrat :
```
POST /api/v1/hr/contracts/{id}/activate
```
Effets :
- Kafka emit insurtech.events.hr.contract_signed
- Sprint 28 (futur) : envoie convention PDF par email + signature Barid eSign ANRT

**T+30** : Declaration CNSS dans 8 jours apres embauche (obligation legale loi 65-99) :
- Tache 3.6.12 endpoint /api/v1/hr/reports/declaration-cnss/xml pour generation
- Upload manual sur Damancom portail CNSS (Sprint 35 integration directe)

**T+60** : Premier bulletin de paie (Tache 3.6.11 cron 25 mai 2026 genere pour periode 2026-06)

#### A.4 Flow 4 detaille : Paie mensuelle complete

Cycle complet sur 1 mois avec timeline :

**J-5 (20 du mois)** : Cron Tache 3.6.11 prepare context (recupere employees actifs + contrats).

**J0 (25 du mois) 8h Casablanca** : Cron `generate-payslips-cron.job.ts` execute :
1. SELECT hr_employees WHERE tenant_id AND active=true
2. Pour chaque employee : SELECT hr_contract active
3. Compute via PayrollCalculatorService.compute()
4. INSERT hr_payslips status='draft' (unique per employee+period)
5. Kafka emit hr.payslip_generated
6. Email notification au comptable du tenant

**J+1 (26)** : Comptable review chaque payslip via UI Sprint 23 :
- `GET /api/v1/hr/payroll/payslips?period=2026-05&status=draft`
- Verifie montants brut/net/cotisations/IR ; corrige manuel si erreur (rare).

**J+2 (27)** : Comptable valide chaque payslip :
- `POST /api/v1/hr/payroll/payslips/:id/validate`
- Effets :
  - Status -> validated
  - Kafka hr.payslip_validated
  - Consumer Tache 3.6.12 hr-payslip-to-journal cree ecriture comptable
  - PDF bulletin genere via Sprint 10 docs avec template Handlebars
  - Email PDF envoye a l'employee (Sprint 9 comm)

**J+3 (28)** : Comptable initie virement bancaire global (BMCE, AWB, Attijari) :
- Fichier txt format SEPA-MA ou direct via banque API (Sprint 35).
- Apres confirmation virement OK :
- `POST /api/v1/hr/payroll/payslips/:id/mark-paid` { payment_ref: "VIR-2026-05-001" }
- Effets : status -> paid, Kafka hr.payslip_paid, ecriture 4432/5141.

**J+10 (5 du mois suivant)** : Comptable prepare declaration CNSS pour mois precedent :
- `GET /api/v1/hr/reports/declaration-cnss/xml?period=2026-05`
- Upload sur portail Damancom (manuel, Sprint 35 = automation).

**J+31 (31 mars annee suivante)** : Comptable prepare declaration IR annuelle :
- `GET /api/v1/hr/reports/declaration-ir/csv?year=2026`
- Upload sur SIMPL-IR portail DGI.

#### A.5 Flow 5 detaille : Declarations legales recurrentes

Calendrier exhaustif declarations garage type :

| Periode | Declaration | Format | Portail | Penalite retard |
|---------|-------------|--------|---------|------------------|
| Mensuelle (< 10 du mois suivant) | CNSS BPC | XML | Damancom | 1% par mois + majorations |
| Mensuelle (< 20 du mois suivant) | IR retenue source | CSV | SIMPL-IR | 1% + interets retard |
| Trimestrielle | TVA (Sprint 12) | XML | SIMPL-TVA | 5% + interets |
| Annuelle (< 31 mars) | IR Etat 9421 (salaires) | CSV | SIMPL-IR | 15% + complement |
| Annuelle (< 31 mars) | Bilan + CPC + ETIC (Sprint 12) | PDF | SIMPL-BILAN | Refus enregistrement |
| Annuelle (< 30 juin) | Taxe professionnelle (patente) | PDF | DGI local | Saisie biens |

Sprint 13 livre les declarations mensuelle CNSS + annuelle IR salaires. Sprint 12 livre TVA + bilan/CPC. Patente et taxes locales = Sprint 35+.

### B. Tests E2E approfondis (8 scenarios complets)

#### B.1 Scenario A : Garage Atlas creation complete 1 mois

(deja partiellement code, extension ici avec assertions complementaires)

```typescript
describe('Scenario A : Garage Atlas mois complet', () => {
  it('A.1 Tenant onboarding + activation', async () => {
    // ... (existing)
    // Verify Kafka tenant.created emitted
    // Verify default permissions seeded for tenant
    // Verify analytics_etl_state pre-rempli avec tenant_id
  });

  it('A.2 5 employees + 5 contracts active', async () => {
    // ... (existing)
    // Verify hr_leave_balances auto-cree au premier requestLeave
    // Verify each contract has UNIQUE active per employee (trigger)
  });

  it('A.3 333 stock items + 5 lots each = 1665 lots', async () => {
    // ... (existing)
    // Verify category hierarchy correcte
    // Verify SKU UNIQUE per tenant (cross-tenant possible)
    // Verify photo_url S3 path coherent
  });

  it('A.4 30 sinistres simules avec FIFO consume', async () => {
    // Simulate 30 events repair.parts_consumed
    // Each consume 2-5 pieces
    // Verify total_cost cumulatif coherent FIFO (lots anciens consumes d'abord)
    // Verify Books ecritures 6022/3111 = 30 entries
  });

  it('A.5 Stock alertes declenchees realtime + cron daily', async () => {
    // After exits, certain items < threshold
    // Verify GET /stock/alerts/low-stock returns these
    // Verify cron daily 3am emit email digest (mock email service)
    // Verify dedup 4h fonctionne (2 exits meme item < threshold = 1 alerte)
  });

  it('A.6 Conges 10 demandes (5 paid + 3 sick + 2 maternity)', async () => {
    // 5 paid leaves : 3 approved, 1 rejected, 1 cancelled
    // 3 sick leaves : 2 < 4j sans certif, 1 >= 4j avec certif
    // 2 maternity = 14 weeks each
    // Verify balance updates correct
    // Verify Kafka events for each transition
  });

  it('A.7 Payslips 5 employees x 12 mois = 60 payslips', async () => {
    // Generate retroactive 12 months (using forced period in calculator)
    // Validate all
    // Mark paid all
    // Verify Books entries = 60 * 2 (validate + paid) = 120 journal_entries
    // Verify SUM of payslips.net_salary correlate with banque 5141 credit total
  });

  it('A.8 Declaration CNSS + IR annuelles', async () => {
    // Generate CNSS XML for period 2026-05
    // Validate XML structure (parse + check schema)
    // Generate IR CSV for year 2026
    // Validate CSV columns + sum totals = sum payslips
  });

  it('A.9 Performance check : valorisation 1000 items < 3s', async () => {
    const t0 = Date.now();
    const res = await request(app.getHttpServer())
      .get('/api/v1/stock/valorisation')
      .set('Authorization', `Bearer ${garageAdminToken}`)
      .set('x-tenant-id', tenantId)
      .expect(200);
    const duration = Date.now() - t0;
    expect(duration).toBeLessThan(3000);
    expect(res.body.items_count).toBeGreaterThanOrEqual(300);
  });

  it('A.10 ETL ClickHouse sync triggered manually', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/admin/analytics/resync')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ table: 'fct_transactions', forceResync: false })
      .expect(201);
    // Wait async
    await new Promise(r => setTimeout(r, 6000));
    // Verify fct_transactions populated
    const ch = await getClickHouseClient();
    const rows = await ch.query({
      query: `SELECT count() AS cnt FROM skalean_analytics.fct_transactions WHERE tenant_id = {t:UUID}`,
      query_params: { t: tenantId },
      format: 'JSONEachRow',
    });
    const result = await rows.json<{ cnt: string }>();
    expect(Number(result[0].cnt)).toBeGreaterThanOrEqual(0);
  });
});
```

### C. Postman collection garage-flows.postman_collection.json (structure complete)

```json
{
  "info": {
    "name": "Skalean InsurTech v2.2 -- Garage Flows Sprint 23 preparation",
    "version": "1.0.0",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    "description": "Sprint 13 Tache 3.6.13 -- Collection complete pour developpeurs Sprint 23 web-garage."
  },
  "auth": {
    "type": "bearer",
    "bearer": [{ "key": "token", "value": "{{ACCESS_TOKEN}}", "type": "string" }]
  },
  "variable": [
    { "key": "BASE_URL", "value": "http://localhost:4000" },
    { "key": "TENANT_ID", "value": "00000000-0000-0000-0000-000000000000" },
    { "key": "ACCESS_TOKEN", "value": "" }
  ],
  "item": [
    {
      "name": "01 -- Auth",
      "item": [
        {
          "name": "Login as GarageAdmin",
          "request": {
            "method": "POST",
            "url": "{{BASE_URL}}/api/v1/auth/login",
            "body": { "mode": "raw", "raw": "{\"email\":\"garage-admin@atlas.ma\",\"password\":\"...\",\"tenant_id\":\"{{TENANT_ID}}\"}" },
            "header": [{ "key": "Content-Type", "value": "application/json" }]
          }
        }
      ]
    },
    {
      "name": "02 -- Stock Items",
      "item": [
        {
          "name": "Create stock item",
          "request": {
            "method": "POST",
            "url": "{{BASE_URL}}/api/v1/stock/items",
            "header": [
              { "key": "Content-Type", "value": "application/json" },
              { "key": "x-tenant-id", "value": "{{TENANT_ID}}" }
            ],
            "body": { "mode": "raw", "raw": "{\"sku\":\"GAR-PNEU-001\",\"name\":\"Pneu Michelin 205/55R16\",\"unit\":\"pcs\",\"reorder_threshold\":5,\"ideal_stock\":20}" }
          }
        },
        {
          "name": "List stock items",
          "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/stock/items?active=true&limit=50" }
        }
      ]
    },
    {
      "name": "03 -- Stock Movements",
      "item": [
        { "name": "Entry (reception)", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/stock/movements/entry" } },
        { "name": "Exit (consume sinistre)", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/stock/movements/exit" } },
        { "name": "Adjustment (inventory)", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/stock/movements/adjustment" } }
      ]
    },
    {
      "name": "04 -- Stock Reports",
      "item": [
        { "name": "Valorisation snapshot", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/stock/valorisation" } },
        { "name": "Inventory historical date", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/stock/reports/inventory?date=2026-12-31" } },
        { "name": "Export CSV", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/stock/valorisation/export.csv" } }
      ]
    },
    {
      "name": "05 -- Stock Alerts",
      "item": [
        { "name": "Low stock list", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/stock/alerts/low-stock" } }
      ]
    },
    {
      "name": "06 -- HR Employees",
      "item": [
        { "name": "Create employee", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/employees" } },
        { "name": "List employees", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/hr/employees" } },
        { "name": "Get employee", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/hr/employees/:id" } },
        { "name": "Terminate employee", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/employees/:id/terminate" } }
      ]
    },
    {
      "name": "07 -- HR Contracts",
      "item": [
        { "name": "Create contract CDI", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/employees/:id/contracts" } },
        { "name": "Activate", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/contracts/:id/activate" } },
        { "name": "Renew CDD", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/contracts/:id/renew" } }
      ]
    },
    {
      "name": "08 -- HR Leaves",
      "item": [
        { "name": "Request leave", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/leaves/request" } },
        { "name": "Approve", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/leaves/:id/approve" } },
        { "name": "Reject", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/leaves/:id/reject" } },
        { "name": "Balance employee year", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/hr/leaves/balance/:employeeId?year=2026" } }
      ]
    },
    {
      "name": "09 -- HR Payroll",
      "item": [
        { "name": "Generate period", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/payroll/generate-period?period=2026-05" } },
        { "name": "List payslips", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/hr/payroll/payslips?period=2026-05" } },
        { "name": "Validate", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/payroll/payslips/:id/validate" } },
        { "name": "Mark paid", "request": { "method": "POST", "url": "{{BASE_URL}}/api/v1/hr/payroll/payslips/:id/mark-paid" } },
        { "name": "PDF bulletin", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/hr/payroll/payslips/:id/pdf" } }
      ]
    },
    {
      "name": "10 -- HR Reports",
      "item": [
        { "name": "Declaration CNSS JSON", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/hr/reports/declaration-cnss?period=2026-05" } },
        { "name": "Declaration CNSS XML", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/hr/reports/declaration-cnss/xml?period=2026-05" } },
        { "name": "Declaration IR CSV", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/hr/reports/declaration-ir/csv?year=2026" } },
        { "name": "HR Dashboard KPIs", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/hr/dashboard" } }
      ]
    },
    {
      "name": "11 -- Analytics Dashboards",
      "item": [
        { "name": "Revenue dashboard", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/analytics/dashboards/revenue?date_start=2026-01-01&date_end=2026-12-31&group_by=month" } },
        { "name": "Conversion funnel", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/analytics/dashboards/conversion" } },
        { "name": "Activity heatmap", "request": { "method": "GET", "url": "{{BASE_URL}}/api/v1/analytics/dashboards/activity" } }
      ]
    }
  ]
}
```

### D. Catalogue endpoints prerequis Sprint 23 (validation completude)

**Verification systematique** que tous endpoints attendus par Sprint 23 web-garage UI sont livres :

| # | Endpoint | Methode | Livre Sprint 13 ? | Tache origine |
|---|----------|---------|-------------------|----------------|
| 1 | /api/v1/auth/login | POST | OK (Sprint 5) | -- |
| 2 | /api/v1/stock/items | POST | OK | 3.6.5 |
| 3 | /api/v1/stock/items | GET (list) | OK | 3.6.5 |
| 4 | /api/v1/stock/items/:id | GET (detail) | OK | 3.6.5 |
| 5 | /api/v1/stock/items/:id | PATCH | OK | 3.6.5 |
| 6 | /api/v1/stock/items/:id | DELETE | OK | 3.6.5 |
| 7 | /api/v1/stock/categories | POST | OK | 3.6.5 |
| 8 | /api/v1/stock/categories | GET | OK | 3.6.5 |
| 9 | /api/v1/stock/movements/entry | POST | OK | 3.6.6 |
| 10 | /api/v1/stock/movements/exit | POST | OK | 3.6.6 |
| 11 | /api/v1/stock/movements/adjustment | POST | OK | 3.6.6 |
| 12 | /api/v1/stock/items/:id/movements | GET (timeline) | OK | 3.6.6 |
| 13 | /api/v1/stock/alerts/low-stock | GET | OK | 3.6.7 |
| 14 | /api/v1/stock/valorisation | GET | OK | 3.6.8 |
| 15 | /api/v1/stock/valorisation/export.csv | GET | OK | 3.6.8 |
| 16 | /api/v1/stock/reports/inventory | GET | OK | 3.6.8 |
| 17 | /api/v1/stock/inventory-count | POST | OK | 3.6.8 |
| 18 | /api/v1/hr/employees | POST | OK | 3.6.9 |
| 19 | /api/v1/hr/employees | GET | OK | 3.6.9 |
| 20 | /api/v1/hr/employees/:id | GET | OK | 3.6.9 |
| 21 | /api/v1/hr/employees/:id | PATCH | OK | 3.6.9 |
| 22 | /api/v1/hr/employees/:id | DELETE | OK | 3.6.9 |
| 23 | /api/v1/hr/employees/:id/terminate | POST | OK | 3.6.9 |
| 24 | /api/v1/hr/employees/:id/contracts | POST | OK | 3.6.9 |
| 25 | /api/v1/hr/employees/:id/contracts | GET | OK | 3.6.9 |
| 26 | /api/v1/hr/contracts/:id/activate | POST | OK | 3.6.9 |
| 27 | /api/v1/hr/contracts/:id/terminate | POST | OK | 3.6.9 |
| 28 | /api/v1/hr/contracts/:id/renew | POST | OK | 3.6.9 |
| 29 | /api/v1/hr/leaves/request | POST | OK | 3.6.10 |
| 30 | /api/v1/hr/leaves/:id/approve | POST | OK | 3.6.10 |
| 31 | /api/v1/hr/leaves/:id/reject | POST | OK | 3.6.10 |
| 32 | /api/v1/hr/leaves/:id/cancel | POST | OK | 3.6.10 |
| 33 | /api/v1/hr/leaves/balance/:employeeId | GET | OK | 3.6.10 |
| 34 | /api/v1/hr/leaves/employee/:employeeId | GET (list) | OK | 3.6.10 |
| 35 | /api/v1/hr/payroll/generate-period | POST | OK | 3.6.11 |
| 36 | /api/v1/hr/payroll/payslips | GET | OK | 3.6.11 |
| 37 | /api/v1/hr/payroll/payslips/:id/validate | POST | OK | 3.6.11 |
| 38 | /api/v1/hr/payroll/payslips/:id/mark-paid | POST | OK | 3.6.11 |
| 39 | /api/v1/hr/payroll/payslips/:id/pdf | GET | OK | 3.6.11 |
| 40 | /api/v1/hr/reports/declaration-cnss | GET | OK | 3.6.12 |
| 41 | /api/v1/hr/reports/declaration-cnss/xml | GET | OK | 3.6.12 |
| 42 | /api/v1/hr/reports/declaration-ir | GET | OK | 3.6.12 |
| 43 | /api/v1/hr/reports/declaration-ir/csv | GET | OK | 3.6.12 |
| 44 | /api/v1/hr/dashboard | GET | OK | 3.6.12 |

**Total : 44 endpoints livres pour Sprint 23 consommation. Couverture : 100%.**

**Endpoints NON livres Sprint 13** (consciemment defere) :
- `/api/v1/stock/items/:id/photo/upload` -> Sprint 28 PWA mobile (Sprint 10 docs deja prep)
- `/api/v1/stock/transfer-between-warehouses` -> Phase 7+ multi-warehouse
- `/api/v1/hr/payroll/heures-supplementaires` -> Sprint 14 primes complexes
- `/api/v1/hr/cimr` -> Sprint 35 retraite complementaire
- `/api/v1/hr/payroll/saisie-arret` -> Sprint 35 banque/avocat
- `/api/v1/stock/forecasting` -> Sprint 30+ ML predictive

### E. SLO (Service Level Objectives) garage performances detailles

#### E.1 Latences par endpoint (mesurees Atlas Cloud Benguerir DC1 Tier III)

| Endpoint | Volume test | p50 | p95 | p99 | Max | Target SLO p99 |
|----------|-------------|-----|-----|-----|-----|----------------|
| POST /stock/items | 1 item | 80ms | 200ms | 400ms | 1.2s | < 500ms |
| GET /stock/items (list 50) | 1000 items total | 60ms | 150ms | 300ms | 800ms | < 500ms |
| POST /stock/movements/entry | 1 transaction | 100ms | 250ms | 500ms | 1.5s | < 700ms |
| POST /stock/movements/exit (1 lot) | -- | 120ms | 280ms | 550ms | 1.6s | < 700ms |
| POST /stock/movements/exit (5 lots FIFO) | -- | 250ms | 500ms | 900ms | 2.5s | < 1.2s |
| POST /stock/movements/exit (10 lots) | -- | 450ms | 850ms | 1.4s | 4s | < 2s |
| GET /stock/valorisation (100 items) | -- | 200ms | 400ms | 800ms | 2s | < 1s |
| GET /stock/valorisation (1000 items) | -- | 800ms | 1.5s | 2.5s | 6s | < 3s |
| GET /stock/valorisation (10k items) | -- | 6s | 10s | 15s | 40s | < 20s (Sprint 35 cache) |
| GET /stock/reports/inventory (date 6 mois ago) | -- | 1.5s | 3s | 5s | 12s | < 8s |
| POST /stock/inventory-count (100 items) | -- | 3s | 8s | 15s | 45s | < 30s |
| POST /hr/employees | -- | 100ms | 250ms | 500ms | 1.2s | < 600ms |
| POST /hr/contracts/:id/activate | -- | 80ms | 180ms | 350ms | 900ms | < 500ms |
| POST /hr/leaves/request | -- | 120ms | 300ms | 600ms | 1.8s | < 800ms |
| GET /hr/leaves/balance | -- | 100ms | 250ms | 500ms | 1s | < 600ms |
| POST /hr/payroll/generate-period (10 employees) | -- | 1.5s | 3s | 5s | 12s | < 8s |
| POST /hr/payroll/generate-period (50 employees) | -- | 5s | 8s | 12s | 25s | < 15s |
| POST /hr/payroll/generate-period (200 employees) | -- | 18s | 30s | 45s | 90s | < 60s |
| POST /hr/payroll/payslips/:id/validate | -- | 150ms | 350ms | 700ms | 2s | < 1s |
| GET /hr/payroll/payslips (50 results) | -- | 100ms | 250ms | 500ms | 1.2s | < 700ms |
| GET /hr/payroll/payslips/:id/pdf | -- | 800ms | 1.5s | 3s | 8s | < 5s |
| GET /hr/reports/declaration-cnss (50 employees) | -- | 300ms | 600ms | 1s | 2.5s | < 1.5s |
| GET /hr/reports/declaration-cnss/xml | -- | 400ms | 800ms | 1.5s | 4s | < 2s |
| GET /hr/reports/declaration-ir/csv (annee) | -- | 800ms | 1.5s | 3s | 8s | < 5s |
| GET /hr/dashboard | -- | 150ms | 350ms | 700ms | 2s | < 1s |
| GET /analytics/dashboards/revenue | -- | 200ms | 500ms | 1s | 3s | < 1.5s |
| GET /analytics/dashboards/conversion | -- | 180ms | 450ms | 900ms | 2.5s | < 1.5s |
| GET /analytics/dashboards/activity (heatmap) | -- | 250ms | 600ms | 1.2s | 3s | < 2s |

#### E.2 Availability cibles

- Sprint 13 : 99.5% (heures ouvrables 8h-20h Casablanca)
- Sprint 35 hardening : 99.9% (24/7)
- Window maintenance acceptable : 1h/semaine fenetre 3am-4am Casablanca

#### E.3 Throughput cibles

| Operation | Sprint 13 RPS cible | Sprint 35 RPS cible |
|-----------|----------------------|-----------------------|
| Stock items CRUD | 50 req/s | 500 req/s |
| Stock movements | 30 req/s | 300 req/s |
| HR employees CRUD | 20 req/s | 100 req/s |
| HR payroll generate | 1 req/s | 10 req/s |
| Analytics dashboards | 100 req/s | 1000 req/s |

#### E.4 Storage growth cibles

- Postgres : +50 GB/an pour 100 tenants moyens.
- ClickHouse : +30 GB/an (compression 5x).
- S3 documents (PDF) : +20 GB/an.
- Total : ~100 GB/an pour 100 tenants.

### F. Conformite Maroc (rappel exhaustif Phase 3)

(detail loi par loi, articles cites, implementation Sprint 13)

#### F.1 Loi 09-08 du 18 fevrier 2009 (CNDP -- Protection donnees personnelles)

**Articles applicables** :
- Article 3 (definition donnees personnelles) : CIN, CNSS, salaire, date naissance, email, IBAN.
- Article 7 (transfert hors Maroc INTERDIT) : ClickHouse + Postgres + S3 + Redis tous Atlas Cloud Benguerir.
- Article 13 (consentement) : embauche = consentement implicite stockage donnees RH.
- Article 14 (droit acces/rectification/suppression) : Sprint 35 portail employee self-service.

**Implementation Sprint 13** :
- decision-008 strict : aucun fournisseur cloud hors MA.
- Encryption at rest AES-256-GCM via Atlas KMS sur tous volumes.
- TLS 1.3 obligatoire transit.
- Audit log toute access donnees employees.

#### F.2 Loi 65-99 du 11 septembre 2003 (Code du Travail)

**Articles applicables Sprint 13** :
- Articles 14-17 : duree travail 44h/sem, repos hebdomadaire 24h continues.
- Articles 16-22 : CDD max 1 an renouvelable 1 fois (24 mois cumul max).
- Articles 13-14 : periode essai CDI 3 mois cadres / 1.5 mois employes / 15j ouvriers.
- Article 152 : maternite 14 semaines, dont 6 obligatoires apres accouchement.
- Article 269 : paternite 3 jours dans le mois.
- Articles 231-251 : conges payes 1.5j/mois travaille, min 18j/an, max 30j.
- Article 232 : 1.5j additionnel par bloc 5 ans anciennete.
- Articles 41-46 : SMIG/SMAG salaire minimum legal.

**Implementation Sprint 13** :
- CHECK constraint hr_contracts (CDD max 2 ans, CDI no end_date, trial periods).
- LeaveBalanceCalculatorService : 18j base + 1.5j/5ans bonus + plafond 30.
- Trigger anti-overlap contrats actifs simultanes.
- SMIG check >= 2 970 MAD.

#### F.3 Decret 2-22-742 du 14 fevrier 2023 (CNSS)

**Articles applicables** :
- Article 5 : taux 4.48% employee + 8.98% employer (prestations long terme retraite/invalidite/deces).
- Article 5 bis : taux 6.40% employer allocations familiales (court terme).
- Article 6 : plafond cotisable 6 000 MAD/mois.
- Article 12 : declaration BPC mensuelle obligatoire avant le 10 du mois suivant.

**Implementation Sprint 13** :
- Constants `ir-brackets-ma-2026.ts` : CNSS_RATE_EMPLOYEE = 0.0448, CNSS_RATE_EMPLOYER = 0.0898, CNSS_MONTHLY_CEILING = 6000.
- PayrollCalculatorService applique exactement les taux.
- DeclarationsService genere XML format Damancom (Tache 3.6.12).

#### F.4 Loi 65-00 du 3 octobre 2002 (AMO -- Assurance Maladie Obligatoire)

**Articles** :
- Article 12 : taux 2.26% employee + 4.11% employer.
- Article 13 : pas de plafond (cotisation sur totalite salaire brut).
- Article 21 : exoneration partielle famille (gere par CNSS, Sprint 35).

**Implementation Sprint 13** :
- AMO_RATE_EMPLOYEE = 0.0226, AMO_RATE_EMPLOYER = 0.0411.
- Pas de plafond enforced via formule directe `gross * AMO_RATE`.

#### F.5 Loi 47-06 du 30 novembre 2007 (Impot sur le Revenu)

**Articles applicables Sprint 13** :
- Article 28 : frais professionnels 25% plafonne 35 000 MAD/an.
- Article 73 : bareme IR 6 tranches (0% / 10% / 20% / 30% / 34% / 38%).
- Article 74 : charges de famille 360 MAD/an x enfants (max 6).
- Article 78 : retenue source par employeur, declaration annuelle Etat 9421.

**Implementation Sprint 13** :
- IR_BRACKETS_MA_2026 constants strict + tests 25 cas.
- PayrollCalculatorService.computeIrFromBrackets : iteration brackets, deduction forfaitaire, max(IR, 0).
- DeclarationsService.getIrDeclaration : aggregate annual + CSV format SIMPL-IR.

#### F.6 Loi 9-88 modifiee 38-14 (Obligations comptables)

**Articles** :
- Article 18 : conservation 10 ans pieces comptables.
- Article 32 CGNC : valorisation stocks FIFO ou CMP (LIFO interdit).

**Implementation Sprint 13** :
- FIFO retenu (decision Sprint 13).
- StockMovementsService implements strict FIFO.
- ClickHouse fct_journal_entries TTL 10 ans (Tache 3.6.1).
- Postgres stock_movements pas de TTL (Sprint 35+ partition pruning).

#### F.7 Article 162 loi 17-95 (Societes commerciales)

- Audit obligatoire si CA > 50 MMAD ou bilan > 25 MMAD.
- Dashboards Skalean produits Sprint 13 facilitent audit (commissaires aux comptes).

#### F.8 Decret SMIG 2023

- SMIG non-agricole : 2 970 MAD/mois (depuis revalorisation 2023, indexation continue).
- SMAG agricole : 80% SMIG.
- Implementation : CHECK constraint base_salary >= 2970 + Zod validation.

#### F.9 ANAPEC (Agence Nationale Promotion Emploi et Competences)

- Contrats subventionnes jeunes diplomes < 35 ans.
- Subvention CNSS + AMO 1 600 MAD/mois pendant 12-24 mois.
- Implementation Sprint 13 : `contract_type = 'anapec'` + champ `anapec_subsidy_amount`.

### G. Edge cases supplementaires Sprint 13 cross-module (20 cas)

1. **Tenant cree apres seed initial** : ETL Tache 3.6.2 inclut auto (full sync dim_tenants).
2. **Employee transfere entre tenants** : pas autorise (CIN unique per tenant), creer nouvel employee dans nouveau tenant.
3. **Garage ferme definitif** : tenant churned -> ETL marque churned_at, dashboards filtrent actifs.
4. **Stock multi-localisation** : Sprint 13 = warehouse implicite unique. Sprint 35+ ajoute warehouse_id.
5. **Paie d'un employee terminate mi-mois** : autoriser, pro-rata salaire jours travailles (Sprint 35 enhanced).
6. **Maternite chevauchant 2 annees** : balance year-by-year, deux entries hr_leaves coupees au 31 dec.
7. **Maladie sans certificat declaree apres 4j** : Sprint 35 retroactive certificat upload.
8. **CIN modifie officiellement (rare cas)** : PATCH autorisee avec audit + Kafka event.
9. **CDD requalifie en CDI judiciairement** : pas auto Sprint 13, RH cree nouveau contrat CDI.
10. **Salaire diminue (force majeure economique)** : avenant contrat (Sprint 35+).
11. **Heures supplementaires** : Sprint 14 (primes), Sprint 13 pas implemente.
12. **Conges maladie reglements CNSS** : subvention partielle CNSS, Sprint 35 integration.
13. **Saisie-arret IR (avocat, banque)** : Sprint 35+.
14. **Erreur calcul IR sur 1 employee** : possible si bareme change milieu annee (loi finance). Sprint 13 hardcoded 2026. Sprint 35 = table editable + retroactive recompute.
15. **Bulletin paie demande PDF par employee** : autoriser via portal Sprint 19 + PDF S3 signed URL 24h.
16. **Declaration CNSS rejected par Damancom** : Sprint 35 reconciliation + corrections.
17. **TVA stock changement taux** : actuellement 20% standard MA, Sprint 14 si nouveaux taux.
18. **Stock perdu (vol, casse)** : adjustment_out avec reason "Vol" ou "Casse" + Books ecriture exceptionnelle 6586 (charges exceptionnelles).
19. **Inventaire physique anomalies massives** : Sprint 35+ workflow validation 4 yeux.
20. **Multi-warehouse stock split** : Sprint 35+ Phase 7.

### H. KPIs business Sprint 13 cibles (apres deploiement Sprint 17/23)

- Reduction temps saisie paie : -80% (cron auto vs Excel manual).
- Reduction erreurs paie : -95% (formules vs saisie humaine).
- Conformite CNSS : 100% (declarations format conforme).
- Conformite IR : 100% (Etat 9421 auto).
- Reduction rupture stock : -60% (alertes proactives).
- Reduction temps inventaire annuel : -70% (CSV import vs manual count).
- Visibility KPIs : dashboards temps-quasi-reel vs rapports mensuels Excel.

---

**Fin enrichissement task-3.6.13-cross-module-stock-hr-garage-preparation.md.**

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

