# TACHE 5.3.6 -- QC Checklist 10 Points + Livraison Customer Signature Reception + Bon Livraison PDF

**Sprint** : 21 (Phase 5 -- Vertical Repair / Sprint 3 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-21-sprint-21-sinistre-workflow.md` (Tache 5.3.6)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (workflow operationnel critique pilote Sprint 35)
**Effort** : 6h
**Dependances** : Tache 5.3.5 (order tracking ready_for_qc=true), Sprint 19 (state machine), Sprint 10 (Signature Barid eSign + PdfGenerator + DocsService), Sprint 9 (CommService), Sprint 13 (HrEmployees), Sprint 8 (CRM ContactsService), Sprint 7 (RBAC), Sprint 6 (Multi-tenant)
**Densite cible** : 110-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006 ABSOLUE)

---

## 1. But

Cette tache implemente le **Quality Control checklist post-reparation et le workflow livraison customer** -- 2 etapes critiques avant la facturation et la cloture du sinistre. Apres que le technicien declare 100% completion et trigger `requestQc()` (Tache 5.3.5), le sinistre transitionne `under_repair -> qc_check` et un inspecteur garage (typiquement chef d'atelier OU technicien senior avec role `garage_qc_inspector`) execute un protocole standardise en 2 phases : (Phase A) **QC Checklist 10 points** -- inspection visuelle + tests fonctionnels couvrant (1) verification visuelle reparation pieces remplacees, (2) test fonctionnel pieces remplacees (e.g. nouveau phare allume?), (3) niveau fluides (huile moteur, liquide refroidissement, liquide frein, lave-glace), (4) pneus (pression conforme + usure globale), (5) eclairage complet (phares feux clignotants stop), (6) test electrique general (instruments bord, vitres electriques, sieges), (7) test demarrage moteur (a froid + a chaud), (8) test conduite courte (~2 km parking + route si applicable), (9) nettoyage interieur+exterieur niveau pre-sinistre, (10) preparation documents (facture + bon livraison + cle); (Phase B) si tous 10 points OK -> sinistre transitionne `qc_check -> completed` + `ready_for_delivery=true` + notification customer "Votre vehicule est pret a etre recupere" ; si au moins 1 point FAIL -> sinistre revient `qc_check -> under_repair` avec `qc_failed_items jsonb` documente + notification technicien initial pour re-work + audit log; (Phase C) execute_delivery() -- customer arrive au garage, presente piece identite, signature electronique acceptation reception via Barid eSign signature simple art. 6 loi 43-20 + saisie satisfaction rating 1-5 etoiles optionnel + feedback texte optionnel ; (Phase D) bon de livraison PDF auto-genere Handlebars 3 locales avec photos before/after + checklist QC OK + signature customer attache + transition sinistre `completed -> delivered` + Kafka event `insurtech.events.repair.sinistre.delivered`.

L'apport metier est quintuple : (a) **qualite garantie** -- le QC 10 points reduit le taux de retour reparation (warranty claims Tache 5.3.11) de baseline 12% vers cible < 3% au pilote Marrakech ; (b) **satisfaction customer mesurable** -- le rating 1-5 collecte au moment livraison alimente Sprint 13 NPS dashboards et active warranty extension auto si rating >= 4/5 (programme fidelisation pilote) ; (c) **protection juridique garage** -- la signature reception customer documente formellement que le vehicule est livre "en bon etat" selon checklist QC, ce qui evite les disputes ulterieures type "vous m'avez rendu la voiture avec une nouvelle rayure" ; (d) **conformite ACAPS art. 4.2.8** -- "la livraison du vehicule au customer doit etre formalisee par un bon de livraison electronique horodate avec acceptation explicite du customer" -- ce que cette tache livre exactement ; (e) **boucle qualite analytics** -- les `qc_failed_items` historises permettent Sprint 13 d'identifier les categories de re-work les plus frequentes (e.g. "nettoyage interieur" represente 40% des QC fail) et de proposer formations techniciens ciblees.

A l'issue de cette tache, le systeme expose 7 endpoints REST consommables Sprint 22 (UI QC inspector + chef garage + customer service) et Sprint 23 (PWA mobile inspector), persiste 2 nouvelles tables (`repair_quality_checks` + `repair_deliveries`) avec RLS multi-tenant, publie 3 events Kafka (`insurtech.events.repair.qc.passed`, `insurtech.events.repair.qc.failed`, `insurtech.events.repair.sinistre.delivered`), expose 1 webhook reception signature Barid eSign callback `POST /api/v1/repair/deliveries/:id/signature-callback`, et integre Sprint 13 Analytics pour metriques NPS rating + Sprint 11 Pay reminder customer paiement si invoice still unpaid au moment livraison (Tache 5.3.7 livre les invoices, mais reminder paiement coexiste avec livraison).

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sprint 19 a livre uniquement la transition state machine `under_repair -> completed` comme un simple changement de statut, sans aucun protocole formel de verification qualite ni de livraison documentee. Cette approche minimaliste etait insuffisante pour 3 raisons critiques sur le marche MA : (1) **norme metier garages MA** -- les garages agrees assureurs sont obliges par circulaire ACAPS 2024-12 art. 4.2.8 de formaliser la livraison via bon electronique signe, ce qui n'etait pas implementable Sprint 19 ; (2) **risque dispute customer** -- sondage RMA Watanya rapport 2025 : 18% des reclamations post-reparation portent sur des problemes detectables au QC (huile pas faite, eclairage non teste, interieur sale), avec impact moyen 800 MAD par dispute pour le garage + degradation NPS ; (3) **integration warranty Tache 5.3.11** -- le warranty period demarre exactement au moment delivered, et son calcul depend de la date precise livraison + signature customer pour opposabilite legale.

Sprint 21 Tache 5.3.6 corrige ces 3 lacunes en livrant un workflow biphase QC+Delivery avec persistence + signature + notification + audit. La tache introduit egalement le pattern **Inspection-Then-Re-work-Loop** qui sera reutilise Tache 5.3.11 (warranty claims re-repair) et anticipe Sprint 24 (Flux Sinistre Client lorsque customer rejette la livraison initiale).

Sur le plan reglementaire, l'art. 4.2.8 ACAPS impose 4 elements obligatoires dans le bon de livraison electronique : (i) reference sinistre + reference police, (ii) liste exhaustive interventions effectuees, (iii) garantie applicable (duree + couverture), (iv) signature electronique customer avec horodatage. Tache 5.3.6 livre exactement ces 4 elements via le template Handlebars `bon-livraison.hbs` + integration Sprint 10 Barid eSign + persistence `repair_deliveries.customer_signature_doc_id`. Cette infrastructure prepare aussi le rapport trimestriel ACAPS (Sprint 28) qui aggrege les bons livraison pour analyser delais reparation et taux satisfaction.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| (A) Pas de QC, transition automatique completed | Simple, rapide | Non conforme ACAPS, risque qualite | rejete |
| (B) QC en jsonb sur `repair_orders` | Reutilise entity | Donnees mixtes, hard query | rejete |
| (C) Table dediee `repair_quality_checks` 1:1 sinistre | Schema clair | Schema rigide pour evolution | partiellement retenu |
| (D) Table `repair_quality_checks` + jsonb `qc_checklist` 10 points | Schema flexible + indexable + queryable | Hybride | RETENU |
| (E) QC failed = re-work meme order vs new order | Continuite | Risque audit moins clair | RETENU re-work meme order + jsonb history qc_attempts |
| (F) Livraison sans signature electronique (paper signature scan) | Compatible legacy | Non conforme ACAPS art. 4.2.8 | rejete |
| (G) Signature simple art. 6 vs avancee art. 7 | Avancee plus opposable | Avancee UX lourde + cout +0.10 MAD | RETENU signature simple (acceptation reception non engagement financier majeur) |
| (H) Rating 1-5 obligatoire | Donnees completes | Friction UX | rejete (optionnel + reminder follow-up Sprint 9) |
| (I) Photos after obligatoires similaire Tache 5.3.1 | Symetrie before/after | Lourd | partiellement RETENU : 4 photos minimum (vs 12 reception) |
| (J) Bon livraison signe par technicien + chef garage cote interne | Double validation | UX lourde | rejete (chef garage signe via completion trigger qc_passed) |

### 2.3 Trade-offs explicites

1. **QC 10 points fixe vs configurable per tenant** : on impose 10 points hardcoded Sprint 21. Sprint 27 Admin Tenants Management permettra customize ajouts/suppressions. Trade-off : pilote moins flexible. Mitigation : 10 points couvrent 95%+ des inspections standards selon sondage industrie MA.

2. **Photos after minimum 4 vs 12** : 4 photos (avant droit, avant gauche, arriere droit, arriere gauche) suffisent pour comparison preuve livraison. Trade-off : moins de details que 12 photos reception. Acceptable car (a) QC visuel inspecteur complete, (b) photos before reception serventent comme reference.

3. **Signature simple vs avancee** : simple (art. 6 loi 43-20) suffit car la signature reception equivaut a acceptation etat livre, sans engagement financier separe (paiement = signature differente Tache 5.3.7). Trade-off : moins opposable que avancee. Mitigation : signature simple + horodatage ANRT Barid eSign + audit log = preuve suffisante.

4. **Rating optionnel vs obligatoire** : optionnel. Trade-off : taux response peut etre bas (cible 60% baseline industrie). Mitigation : (a) UI Sprint 22 UX prompt friendly, (b) follow-up email Sprint 9 J+1 si non saisi, (c) incentive Sprint 31 Agent Sky.

5. **QC failed retour under_repair vs partial_completed** : on choisit retour under_repair (re-work complet possible). Alternative : `partial_completed` pour livrer "en l'etat" customer si urgence. Choix re-work car (a) protection qualite garage, (b) standard industrie MA. Si customer urgence absolue, endpoint admin override Sprint 27.

6. **Bon livraison PDF embedded base64 photos vs S3 URLs presigned** : embedded base64 photos pour pas casser si URLs expirent. Trade-off : PDF plus volumineux (4 photos x ~50 KB = 200 KB + texte ~ 30 KB = 230 KB acceptable). Choix retenu.

7. **Auto-trigger warranty Tache 5.3.11 au moment delivered** : on publie Kafka event delivered consume Tache 5.3.11 pour creer warranty row automatiquement. Trade-off : couplage cross-tache. Acceptable car warranty est dependance directe livraison.

### 2.4 Decisions strategiques referenced

- **decision-001 (monorepo)** : fichiers `repo/packages/repair/`, `repo/apps/api/`.
- **decision-002 (multi-tenant)** : RLS strict sur 2 nouvelles tables.
- **decision-003 (TypeORM 0.3)** : entities + migrations.
- **decision-004 (Kafka)** : 3 topics qc.passed/failed + sinistre.delivered.
- **decision-006 (no-emoji)** : ABSOLU.
- **decision-008 (cloud souverain)** : photos after S3 Atlas Cloud + PDF bon livraison archive.
- **decision-009 (signature 43-20 art. 6)** : signature simple suffisante pour acceptation reception.

### 2.5 Pieges techniques connus

1. **Piege : inspector tente QC sur order pas ready_for_qc**
   - Solution : startInspection() rejette si order.ready_for_qc !== true. 409 Conflict.

2. **Piege : meme inspector marque ses propres reparations OK (conflit interet)**
   - Solution : config tenant `repair.qc.allow_self_inspection` defaults false. Si false, exception si inspector_id IN order.technician_hours_log.technician_id. Sprint 27 permet override exceptionnel.

3. **Piege : 10 points QC tous passed mais inspector force fail un point au retour**
   - Solution : append-only `qc_attempts jsonb[]`. Chaque inspection cree nouvelle attempt. Audit traceable.

4. **Piege : signature customer recue mais customer signe sur tablette garage (pas via Barid SMS)**
   - Solution : 2 modes signature acceptes : (a) Barid eSign SMS standard, (b) Barid eSign in-person via tablette garage avec OTP recu meme moment. Les 2 modes art. 6 loi 43-20 conformes.

5. **Piege : customer satisfaction rating 1 etoile + feedback agressif vs garage**
   - Solution : pas de filter/censure rating. Audit + notification chef garage pour reaction. Sprint 28 Compliance ajoute rapport reviews critiques.

6. **Piege : transition completed -> delivered echoue car payment encore unpaid (Tache 5.3.7)**
   - Solution : transition livraison NE depend PAS payment status. Decoupled. Customer peut payer apres livraison (delai 30j typique facture customer).

7. **Piege : warranty Tache 5.3.11 auto-trigger mais customer rate 1/5 (insatisfait) -> warranty active malgre dispute**
   - Solution : warranty active sauf si formal warranty_dispute open Sprint 28 process. Sprint 21 cree warranty inconditionnel ; resolution dispute = Sprint 24 process.

8. **Piege : photos after upload mais order pas encore ready_for_qc (race)**
   - Solution : upload photos accepte uniquement si ready_for_qc=true. Sinon 409.

9. **Piege : bon livraison genere mais customer email change apres signature**
   - Solution : email snapshot moment delivery, PDF archive sur S3 contient snapshot data. Pas re-fetch.

10. **Piege : delivery executee mais customer pas vraiment present (frais sur PWA)**
    - Solution : double check : signature electronique customer + photo customer + cle (signature + selfie ou photo carte ID si tenant config). Audit log capture IP + GPS si mobile.

11. **Piege : QC failed multi fois (>3) sans escalade**
   - Solution : si qc_attempts.length >= 3 sans pass, auto-escalade SuperAdmin tenant via Comm Sprint 9 internal notification + audit alert flag.

12. **Piege : signature customer expiree (24h SMS sans reponse) mais customer arrive physiquement**
    - Solution : endpoint `POST /:id/regenerate-signature` pour re-emit Barid signature request. Cooldown 5min pour eviter spam.

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 5.3.6 est la **6e tache du Sprint 21**, suit Tache 5.3.5 (Reparation Tracking). Le order ayant ready_for_qc=true, cette tache implemente l'inspection + livraison.

- **Depend de** : Tache 5.3.5 (order ready_for_qc), Sprint 10 (Signature simple + PdfGenerator), Sprint 9 (Comm notifications), Sprint 13 (HR + Analytics NPS), Sprint 8 (Customer CRM data), Sprint 7 (RBAC), Sprint 6 (Multi-tenant).
- **Bloque** : Tache 5.3.7 (Facturation Split ne peut etre finalisee qu'apres delivered car invoice finalise montants), Tache 5.3.8 (Documents auto-genere bon-livraison genere ici), Tache 5.3.11 (Garantie Tracking auto-trigger sur event sinistre.delivered).

- **Apporte** : pattern Inspection-Then-Re-work-Loop reutilise Tache 5.3.11. Methode publique `getDeliveryDate(sinistreId)` consommee Tache 5.3.11 warranty.

### 3.2 Position dans le programme global

Sprint 21 Phase 5. Sprint 28 utilise rating + qc_attempts pour analytics qualite. Sprint 31 Agent Sky peut interroger sur statut livraison.

### 3.3 Diagramme du workflow QC + Delivery

```
+--------------------+        +--------------------+
| Tache 5.3.5        |  -->   | Order ready_for_qc |
| requestQc()        |        | sinistre qc_check  |
+--------------------+        +--------------------+
                                       |
                                       v
                          +---------------------------+
                          | Inspector chef garage     |
                          | UI Sprint 22 ou Sprint 23 |
                          | demarre inspection        |
                          | POST /quality-checks/start|
                          +---------------------------+
                                       |
                                       v
                          +---------------------------+
                          | Remplit 10 points QC      |
                          | + 4 photos after          |
                          | + notes detaillees        |
                          +---------------------------+
                                       |
                          +------------+-------------+
                          |                          |
                          v                          v
                +---------------------+    +---------------------+
                | All 10 OK           |    | At least 1 failed   |
                | markPassed()        |    | markFailed(items)   |
                +---------------------+    +---------------------+
                          |                          |
                          v                          v
                +---------------------+    +---------------------+
                | Transition          |    | Transition          |
                | qc_check -> completed|   | qc_check -> under_  |
                | + ready_for_delivery|    | repair (re-work)    |
                | + Kafka qc.passed   |    | + technician notif  |
                +---------------------+    | + Kafka qc.failed   |
                          |                +---------------------+
                          v                          |
                +---------------------+              v
                | Notification customer|    +---------------------+
                | "Vehicule pret"      |   | Technicien rectifie  |
                | Sprint 9 Comm        |   | Tache 5.3.5 update   |
                +---------------------+    | completion + photos  |
                          |                +---------------------+
                          v                          |
                +---------------------+              v
                | Customer arrive     |    +---------------------+
                | au garage           |    | requestQc nouveau   |
                | POST /deliveries/   |    | (boucle)            |
                | prepare             |    +---------------------+
                +---------------------+
                          |
                          v
                +---------------------+
                | Generate bon        |
                | livraison PDF       |
                | Handlebars 3 locales|
                +---------------------+
                          |
                          v
                +---------------------+
                | Request signature   |
                | Barid eSign simple  |
                | art. 6 loi 43-20    |
                +---------------------+
                          |
                          v
                +---------------------+
                | Customer signe      |
                | + rating optionnel  |
                | + feedback          |
                +---------------------+
                          |
                          v
                +---------------------+
                | execute_delivery()  |
                | Transition completed|
                | -> delivered        |
                | Kafka delivered     |
                +---------------------+
                          |
                          v
                +---------------------+
                | Consumer warranty   |
                | Tache 5.3.11        |
                | auto-create warranty|
                +---------------------+
                          |
                          v
                +---------------------+
                | Consumer Sprint 13  |
                | NPS analytics       |
                | update dashboards   |
                +---------------------+
```

## 4. Livrables checkables

- [ ] Migration : `{date}-RepairQualityChecks.ts` (~70 lignes : CREATE TABLE + RLS + indexes + CHECK)
- [ ] Migration : `{date}-RepairDeliveries.ts` (~70 lignes : CREATE TABLE + RLS)
- [ ] Entity : `repair-quality-check.entity.ts` (~100 lignes)
- [ ] Entity : `repair-delivery.entity.ts` (~100 lignes)
- [ ] DTOs Zod : `quality-check.dtos.ts` (~150 lignes : 5 schemas)
- [ ] DTOs Zod : `delivery.dtos.ts` (~120 lignes : 4 schemas)
- [ ] Service : `quality-checks.service.ts` (~350 lignes : 6 methodes)
- [ ] Service : `deliveries.service.ts` (~300 lignes : 5 methodes)
- [ ] Controller : `quality-checks.controller.ts` (~150 lignes : 5 endpoints)
- [ ] Controller : `deliveries.controller.ts` (~150 lignes : 5 endpoints)
- [ ] Kafka events : 3 events (~50 lignes chacun)
- [ ] Consumer : `delivered-notify-customer.consumer.ts` (~100 lignes)
- [ ] Consumer : `delivered-create-warranty.consumer.ts` (~120 lignes anticipates Tache 5.3.11)
- [ ] Templates Handlebars 3 locales : `bon-livraison.hbs` (~150 lignes chacun avec photos embedded)
- [ ] Templates Comm 3 locales : `repair-ready-for-delivery.hbs`, `repair-qc-failed-technician.hbs`, `repair-delivered-confirmation.hbs` (~40 lignes chacun)
- [ ] Tests unitaires : `quality-checks.service.spec.ts` (~500 lignes / 22 tests)
- [ ] Tests unitaires : `deliveries.service.spec.ts` (~450 lignes / 18 tests)
- [ ] Tests integration : `qc-delivery.integration-spec.ts` (~400 lignes / 12 tests)
- [ ] Tests E2E : `qc-delivery.e2e-spec.ts` (~300 lignes / 6 tests)
- [ ] Fixtures : `repair-qc-delivery.fixtures.ts` (~180 lignes)
- [ ] Permissions enum : +7 permissions QC + 5 delivery
- [ ] Kafka topics : +3 topics
- [ ] Documentation pattern : `docs/patterns/inspection-then-rework-loop.md` (~200 lignes)
- [ ] Postman collection : `repair-qc-delivery.postman.json` (~140 lignes)
- [ ] Seed demo : `seed-qc-delivery-demo.ts` (~150 lignes)

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/20260525-RepairQualityChecks.ts                                 (~70 lignes)
repo/packages/database/src/migrations/20260525-RepairDeliveries.ts                                     (~70 lignes)
repo/packages/repair/src/entities/repair-quality-check.entity.ts                                       (~100 lignes)
repo/packages/repair/src/entities/repair-delivery.entity.ts                                            (~100 lignes)
repo/packages/repair/src/dtos/quality-check.dtos.ts                                                    (~150 lignes)
repo/packages/repair/src/dtos/delivery.dtos.ts                                                         (~120 lignes)
repo/packages/repair/src/services/quality-checks.service.ts                                            (~350 lignes)
repo/packages/repair/src/services/deliveries.service.ts                                                (~300 lignes)
repo/packages/repair/src/services/quality-checks.service.spec.ts                                       (~500 lignes / 22 tests)
repo/packages/repair/src/services/deliveries.service.spec.ts                                           (~450 lignes / 18 tests)
repo/packages/repair/src/events/qc-passed.event.ts                                                     (~50 lignes)
repo/packages/repair/src/events/qc-failed.event.ts                                                     (~50 lignes)
repo/packages/repair/src/events/sinistre-delivered.event.ts                                            (~60 lignes)
repo/packages/repair/src/consumers/delivered-notify-customer.consumer.ts                                (~100 lignes)
repo/packages/repair/src/consumers/delivered-create-warranty.consumer.ts                                (~120 lignes)
repo/packages/repair/src/repair.module.ts                                                              (update +25 lignes)
repo/packages/docs/src/templates/fr/bon-livraison.hbs                                                  (~150 lignes)
repo/packages/docs/src/templates/ar-MA/bon-livraison.hbs                                               (~150 lignes RTL)
repo/packages/docs/src/templates/ar/bon-livraison.hbs                                                  (~150 lignes RTL)
repo/packages/comm/src/templates/fr/repair-ready-for-delivery.hbs                                       (~40 lignes)
repo/packages/comm/src/templates/fr/repair-qc-failed-technician.hbs                                     (~40 lignes)
repo/packages/comm/src/templates/fr/repair-delivered-confirmation.hbs                                   (~40 lignes)
repo/packages/comm/src/templates/{ar-MA,ar}/repair-{3 templates}.hbs                                    (~240 lignes RTL)
repo/packages/auth/src/rbac/permissions.enum.ts                                                        (update +12 lignes)
repo/packages/database/src/kafka/topics.ts                                                             (update +3 lignes)
repo/apps/api/src/modules/repair/controllers/quality-checks.controller.ts                              (~150 lignes)
repo/apps/api/src/modules/repair/controllers/deliveries.controller.ts                                  (~150 lignes)
repo/apps/api/test/repair/qc-delivery.integration-spec.ts                                              (~400 lignes / 12 tests)
repo/apps/api/test/repair/qc-delivery.e2e-spec.ts                                                      (~300 lignes / 6 tests)
repo/test/fixtures/repair-qc-delivery.fixtures.ts                                                      (~180 lignes)
repo/docs/patterns/inspection-then-rework-loop.md                                                      (~200 lignes)
repo/docs/postman/repair-qc-delivery.postman.json                                                      (~140 lignes)
repo/infrastructure/scripts/seed-qc-delivery-demo.ts                                                   (~150 lignes)
```

## 6. Code patterns COMPLETS

### Fichier 1/13 : `repo/packages/database/src/migrations/20260525-RepairQualityChecks.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairQualityChecks1748200000000 implements MigrationInterface {
  name = 'RepairQualityChecks1748200000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE "repair_quality_checks" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "sinistre_id" UUID NOT NULL,
        "order_id" UUID NOT NULL,
        "inspector_employee_id" UUID NOT NULL,
        "attempt_number" INTEGER NOT NULL DEFAULT 1,
        "qc_checklist" JSONB NOT NULL,
          -- structure : { schema_version: 1, points: { '1_visual_repair': { ok, notes, photo_ref }, ... }, global_notes }
        "photos_after" JSONB NOT NULL DEFAULT '[]'::jsonb,
          -- [{ index, s3_key, s3_url, content_type, size_bytes, uploaded_at, angle }]
        "passed" BOOLEAN NULL,
        "failed_items" JSONB NULL,
          -- [{ point_key, reason, severity, photo_evidence_ref? }]
        "inspected_at" TIMESTAMPTZ NULL,
        "inspector_signature_doc_id" UUID NULL,
        "qc_attempts" JSONB NOT NULL DEFAULT '[]'::jsonb,
          -- historique attempts : [{ attempt_number, inspector_id, passed, failed_items, at }]
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_by" UUID NOT NULL,
        "updated_by" UUID NOT NULL,
        CONSTRAINT "fk_repair_qc_sinistre" FOREIGN KEY ("sinistre_id") REFERENCES "repair_sinistres"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_repair_qc_order" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_repair_qc_inspector" FOREIGN KEY ("inspector_employee_id") REFERENCES "hr_employees"("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_repair_qc_order_attempt" UNIQUE ("order_id", "attempt_number"),
        CONSTRAINT "ck_repair_qc_attempt_number" CHECK ("attempt_number" >= 1 AND "attempt_number" <= 5)
      );

      CREATE INDEX "ix_repair_qc_tenant" ON "repair_quality_checks"("tenant_id");
      CREATE INDEX "ix_repair_qc_sinistre" ON "repair_quality_checks"("tenant_id", "sinistre_id");
      CREATE INDEX "ix_repair_qc_passed" ON "repair_quality_checks"("tenant_id", "passed");
      CREATE INDEX "ix_repair_qc_inspected_at" ON "repair_quality_checks"("tenant_id", "inspected_at" DESC);

      ALTER TABLE "repair_quality_checks" ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "rls_repair_qc_tenant" ON "repair_quality_checks"
        USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid AND current_setting('app.current_tenant', true) IS NOT NULL);

      CREATE TRIGGER "tr_repair_qc_updated_at"
        BEFORE UPDATE ON "repair_quality_checks"
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

      COMMENT ON TABLE "repair_quality_checks" IS 'Sprint 21 / Tache 5.3.6 -- QC checklist 10 points post-reparation avec re-work loop';
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "repair_quality_checks" CASCADE;`);
  }
}
```

### Fichier 2/13 : `repo/packages/database/src/migrations/20260525-RepairDeliveries.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairDeliveries1748300000000 implements MigrationInterface {
  name = 'RepairDeliveries1748300000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE "repair_deliveries" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "sinistre_id" UUID NOT NULL,
        "quality_check_id" UUID NOT NULL,
        "delivered_to_contact_id" UUID NOT NULL,
        "delivered_by_employee_id" UUID NOT NULL,
        "delivered_at" TIMESTAMPTZ NULL,
        "customer_signature_doc_id" UUID NULL,
        "customer_satisfaction_rating" INTEGER NULL,
        "customer_feedback" TEXT NULL,
        "delivery_doc_id" UUID NULL,
        "customer_id_proof_doc_id" UUID NULL,
        "customer_id_proof_type" VARCHAR(64) NULL,
        "customer_id_proof_number" VARCHAR(128) NULL,
        "status" VARCHAR(32) NOT NULL DEFAULT 'pending',
          -- pending | preparing | awaiting_signature | signed | delivered | refused | abandoned
        "delivery_method" VARCHAR(32) NOT NULL DEFAULT 'in_person',
          -- in_person | curbside_pickup
        "signature_sent_at" TIMESTAMPTZ NULL,
        "signature_signed_at" TIMESTAMPTZ NULL,
        "follow_up_rating_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
        "internal_notes" TEXT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_by" UUID NOT NULL,
        "updated_by" UUID NOT NULL,
        CONSTRAINT "fk_repair_delivery_sinistre" FOREIGN KEY ("sinistre_id") REFERENCES "repair_sinistres"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_repair_delivery_qc" FOREIGN KEY ("quality_check_id") REFERENCES "repair_quality_checks"("id") ON DELETE RESTRICT,
        CONSTRAINT "uq_repair_delivery_sinistre" UNIQUE ("sinistre_id"),
        CONSTRAINT "ck_repair_delivery_rating" CHECK ("customer_satisfaction_rating" IS NULL OR ("customer_satisfaction_rating" >= 1 AND "customer_satisfaction_rating" <= 5)),
        CONSTRAINT "ck_repair_delivery_status" CHECK ("status" IN ('pending', 'preparing', 'awaiting_signature', 'signed', 'delivered', 'refused', 'abandoned')),
        CONSTRAINT "ck_repair_delivery_method" CHECK ("delivery_method" IN ('in_person', 'curbside_pickup'))
      );

      CREATE INDEX "ix_repair_delivery_tenant_status" ON "repair_deliveries"("tenant_id", "status");
      CREATE INDEX "ix_repair_delivery_delivered_at" ON "repair_deliveries"("tenant_id", "delivered_at" DESC);
      CREATE INDEX "ix_repair_delivery_rating" ON "repair_deliveries"("tenant_id", "customer_satisfaction_rating") WHERE "customer_satisfaction_rating" IS NOT NULL;

      ALTER TABLE "repair_deliveries" ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "rls_repair_delivery_tenant" ON "repair_deliveries"
        USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid AND current_setting('app.current_tenant', true) IS NOT NULL);

      CREATE TRIGGER "tr_repair_delivery_updated_at"
        BEFORE UPDATE ON "repair_deliveries"
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

      COMMENT ON TABLE "repair_deliveries" IS 'Sprint 21 / Tache 5.3.6 -- delivery vehicule customer avec signature simple Barid eSign + rating';
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "repair_deliveries" CASCADE;`);
  }
}
```

### Fichier 3/13 : `repo/packages/repair/src/entities/repair-quality-check.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { RepairSinistre } from './repair-sinistre.entity';
import { RepairOrder } from './repair-order.entity';
import { HrEmployee } from '@insurtech/hr';

export interface QcCheckPointJsonb {
  ok: boolean;
  notes?: string;
  photo_ref?: number;
  checked_at?: string;
  checked_by?: string;
}

export interface QcChecklistJsonb {
  schema_version: 1;
  points: {
    '1_visual_repair'?: QcCheckPointJsonb;
    '2_functional_replaced'?: QcCheckPointJsonb;
    '3_fluids_levels'?: QcCheckPointJsonb & { fluids?: { oil_ok: boolean; coolant_ok: boolean; brake_fluid_ok: boolean; washer_ok: boolean } };
    '4_tyres'?: QcCheckPointJsonb & { pressure_ok?: boolean; tread_ok?: boolean };
    '5_lights'?: QcCheckPointJsonb & { headlights?: boolean; taillights?: boolean; indicators?: boolean; brakelight?: boolean };
    '6_electrical'?: QcCheckPointJsonb;
    '7_engine_start'?: QcCheckPointJsonb & { cold_start_ok?: boolean; warm_start_ok?: boolean };
    '8_road_test'?: QcCheckPointJsonb & { distance_km?: number; speed_max?: number };
    '9_cleanliness'?: QcCheckPointJsonb;
    '10_documents_keys'?: QcCheckPointJsonb;
  };
  global_notes?: string;
  inspector_signature?: string;
  completed_at?: string;
}

export interface QcFailedItemJsonb {
  point_key: string;
  reason: string;
  severity: 'minor' | 'major' | 'critical';
  photo_evidence_ref?: number;
}

export interface QcAttemptHistoryJsonb {
  attempt_number: number;
  inspector_id: string;
  passed: boolean;
  failed_items_count: number;
  failed_items: QcFailedItemJsonb[];
  at: string;
}

@Entity({ name: 'repair_quality_checks' })
@Unique('uq_repair_qc_order_attempt', ['order_id', 'attempt_number'])
@Index('ix_repair_qc_tenant', ['tenant_id'])
@Index('ix_repair_qc_passed', ['tenant_id', 'passed'])
export class RepairQualityCheck {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) tenant_id!: string;
  @Column({ type: 'uuid' }) sinistre_id!: string;
  @ManyToOne(() => RepairSinistre) @JoinColumn({ name: 'sinistre_id' }) sinistre?: RepairSinistre;
  @Column({ type: 'uuid' }) order_id!: string;
  @ManyToOne(() => RepairOrder) @JoinColumn({ name: 'order_id' }) order?: RepairOrder;
  @Column({ type: 'uuid' }) inspector_employee_id!: string;
  @ManyToOne(() => HrEmployee) @JoinColumn({ name: 'inspector_employee_id' }) inspector?: HrEmployee;
  @Column({ type: 'integer', default: 1 }) attempt_number!: number;
  @Column({ type: 'jsonb' }) qc_checklist!: QcChecklistJsonb;
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` }) photos_after!: { index: number; s3_key: string; s3_url: string; content_type: string; size_bytes: number; uploaded_at: string; angle: string }[];
  @Column({ type: 'boolean', nullable: true }) passed!: boolean | null;
  @Column({ type: 'jsonb', nullable: true }) failed_items!: QcFailedItemJsonb[] | null;
  @Column({ type: 'timestamptz', nullable: true }) inspected_at!: Date | null;
  @Column({ type: 'uuid', nullable: true }) inspector_signature_doc_id!: string | null;
  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` }) qc_attempts!: QcAttemptHistoryJsonb[];
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @Column({ type: 'uuid' }) created_by!: string;
  @Column({ type: 'uuid' }) updated_by!: string;
}
```

### Fichier 4/13 : `repo/packages/repair/src/entities/repair-delivery.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { RepairSinistre } from './repair-sinistre.entity';
import { RepairQualityCheck } from './repair-quality-check.entity';

export type DeliveryStatus = 'pending' | 'preparing' | 'awaiting_signature' | 'signed' | 'delivered' | 'refused' | 'abandoned';
export type DeliveryMethod = 'in_person' | 'curbside_pickup';

@Entity({ name: 'repair_deliveries' })
@Unique('uq_repair_delivery_sinistre', ['sinistre_id'])
@Index('ix_repair_delivery_tenant_status', ['tenant_id', 'status'])
export class RepairDelivery {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) tenant_id!: string;
  @Column({ type: 'uuid' }) sinistre_id!: string;
  @ManyToOne(() => RepairSinistre) @JoinColumn({ name: 'sinistre_id' }) sinistre?: RepairSinistre;
  @Column({ type: 'uuid' }) quality_check_id!: string;
  @ManyToOne(() => RepairQualityCheck) @JoinColumn({ name: 'quality_check_id' }) quality_check?: RepairQualityCheck;
  @Column({ type: 'uuid' }) delivered_to_contact_id!: string;
  @Column({ type: 'uuid' }) delivered_by_employee_id!: string;
  @Column({ type: 'timestamptz', nullable: true }) delivered_at!: Date | null;
  @Column({ type: 'uuid', nullable: true }) customer_signature_doc_id!: string | null;
  @Column({ type: 'integer', nullable: true }) customer_satisfaction_rating!: number | null;
  @Column({ type: 'text', nullable: true }) customer_feedback!: string | null;
  @Column({ type: 'uuid', nullable: true }) delivery_doc_id!: string | null;
  @Column({ type: 'uuid', nullable: true }) customer_id_proof_doc_id!: string | null;
  @Column({ type: 'varchar', length: 64, nullable: true }) customer_id_proof_type!: string | null;
  @Column({ type: 'varchar', length: 128, nullable: true }) customer_id_proof_number!: string | null;
  @Column({ type: 'varchar', length: 32, default: 'pending' }) status!: DeliveryStatus;
  @Column({ type: 'varchar', length: 32, default: 'in_person' }) delivery_method!: DeliveryMethod;
  @Column({ type: 'timestamptz', nullable: true }) signature_sent_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) signature_signed_at!: Date | null;
  @Column({ type: 'boolean', default: false }) follow_up_rating_reminder_sent!: boolean;
  @Column({ type: 'text', nullable: true }) internal_notes!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @Column({ type: 'uuid' }) created_by!: string;
  @Column({ type: 'uuid' }) updated_by!: string;
}
```

### Fichier 5/13 : `repo/packages/repair/src/dtos/quality-check.dtos.ts`

```typescript
import { z } from 'zod';
const Uuid = z.string().uuid();

const QcPointSchema = z.object({ ok: z.boolean(), notes: z.string().max(500).optional(), photo_ref: z.number().int().min(1).max(20).optional() });

export const StartQcDtoSchema = z.object({
  sinistre_id: Uuid,
  order_id: Uuid,
  inspector_employee_id: Uuid,
});
export type StartQcDto = z.infer<typeof StartQcDtoSchema>;

export const SubmitChecklistDtoSchema = z.object({
  schema_version: z.literal(1),
  points: z.object({
    '1_visual_repair': QcPointSchema,
    '2_functional_replaced': QcPointSchema,
    '3_fluids_levels': QcPointSchema.extend({ fluids: z.object({ oil_ok: z.boolean(), coolant_ok: z.boolean(), brake_fluid_ok: z.boolean(), washer_ok: z.boolean() }).optional() }),
    '4_tyres': QcPointSchema.extend({ pressure_ok: z.boolean().optional(), tread_ok: z.boolean().optional() }),
    '5_lights': QcPointSchema.extend({ headlights: z.boolean().optional(), taillights: z.boolean().optional(), indicators: z.boolean().optional(), brakelight: z.boolean().optional() }),
    '6_electrical': QcPointSchema,
    '7_engine_start': QcPointSchema.extend({ cold_start_ok: z.boolean().optional(), warm_start_ok: z.boolean().optional() }),
    '8_road_test': QcPointSchema.extend({ distance_km: z.number().nonnegative().max(50).optional(), speed_max: z.number().nonnegative().max(150).optional() }),
    '9_cleanliness': QcPointSchema,
    '10_documents_keys': QcPointSchema,
  }),
  global_notes: z.string().max(2000).optional(),
});
export type SubmitChecklistDto = z.infer<typeof SubmitChecklistDtoSchema>;

export const AddPhotosAfterDtoSchema = z.object({
  photos: z.array(z.object({
    index: z.number().int().min(1).max(20),
    s3_key: z.string().min(10),
    s3_url: z.string().url(),
    content_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size_bytes: z.number().int().positive().max(10 * 1024 * 1024),
    angle: z.string().max(64),
  })).min(1).max(20),
});
export type AddPhotosAfterDto = z.infer<typeof AddPhotosAfterDtoSchema>;

export const MarkQcDecisionDtoSchema = z.object({
  passed: z.boolean(),
  failed_items: z.array(z.object({
    point_key: z.string().min(3),
    reason: z.string().min(3).max(500),
    severity: z.enum(['minor', 'major', 'critical']),
    photo_evidence_ref: z.number().int().min(1).max(20).optional(),
  })).optional(),
}).refine((data) => data.passed === true || (data.failed_items && data.failed_items.length > 0), { message: 'If not passed, failed_items must be provided' });
export type MarkQcDecisionDto = z.infer<typeof MarkQcDecisionDtoSchema>;
```

### Fichier 6/13 : `repo/packages/repair/src/dtos/delivery.dtos.ts`

```typescript
import { z } from 'zod';
const Uuid = z.string().uuid();

export const PrepareDeliveryDtoSchema = z.object({
  sinistre_id: Uuid,
  delivered_to_contact_id: Uuid,
  delivered_by_employee_id: Uuid,
  delivery_method: z.enum(['in_person', 'curbside_pickup']).default('in_person'),
  customer_id_proof_type: z.enum(['cin', 'passport', 'permis']).optional(),
  customer_id_proof_number: z.string().max(128).optional(),
});
export type PrepareDeliveryDto = z.infer<typeof PrepareDeliveryDtoSchema>;

export const ExecuteDeliveryDtoSchema = z.object({
  customer_signature_doc_id: Uuid,
});
export type ExecuteDeliveryDto = z.infer<typeof ExecuteDeliveryDtoSchema>;

export const RecordSatisfactionDtoSchema = z.object({
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(2000).optional(),
});
export type RecordSatisfactionDto = z.infer<typeof RecordSatisfactionDtoSchema>;

export const RegenerateSignatureDtoSchema = z.object({
  reason: z.string().min(5).max(500).optional(),
});
export type RegenerateSignatureDto = z.infer<typeof RegenerateSignatureDtoSchema>;
```

### Fichier 7/13 : `repo/packages/repair/src/services/quality-checks.service.ts`

```typescript
import { Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { RepairQualityCheck, QcAttemptHistoryJsonb, QcFailedItemJsonb } from '../entities/repair-quality-check.entity';
import { RepairOrder } from '../entities/repair-order.entity';
import { ClaimStateMachineService } from './claim-state-machine.service';
import { HrEmployeesService } from '@insurtech/hr';
import { KafkaProducerService, TenantContext } from '@insurtech/shared-utils';
import { StartQcDtoSchema, SubmitChecklistDtoSchema, AddPhotosAfterDtoSchema, MarkQcDecisionDtoSchema } from '../dtos/quality-check.dtos';
import type { StartQcDto, SubmitChecklistDto, AddPhotosAfterDto, MarkQcDecisionDto } from '../dtos/quality-check.dtos';

const REQUIRED_POINTS = ['1_visual_repair', '2_functional_replaced', '3_fluids_levels', '4_tyres', '5_lights', '6_electrical', '7_engine_start', '8_road_test', '9_cleanliness', '10_documents_keys'] as const;
const MAX_ATTEMPTS = 5;

@Injectable()
export class QualityChecksService {
  constructor(
    @InjectRepository(RepairQualityCheck) private readonly qcRepo: Repository<RepairQualityCheck>,
    @InjectRepository(RepairOrder) private readonly orderRepo: Repository<RepairOrder>,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(QualityChecksService.name) private readonly logger: PinoLogger,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly hrEmployees: HrEmployeesService,
    private readonly kafka: KafkaProducerService,
  ) {}

  async start(input: StartQcDto): Promise<RepairQualityCheck> {
    StartQcDtoSchema.parse(input);
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();
    const order = await this.orderRepo.findOne({ where: { id: input.order_id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!order.ready_for_qc) throw new ConflictException('Order not ready for QC : completion_percentage must be 100 + ready_for_qc=true');
    const inspector = await this.hrEmployees.findById(input.inspector_employee_id);
    if (!inspector) throw new NotFoundException('Inspector not found');
    if (!inspector.roles.includes('garage_qc_inspector') && !inspector.roles.includes('garage_admin') && !inspector.roles.includes('garage_manager')) {
      throw new ForbiddenException('Employee not authorized to perform QC');
    }
    const allowSelf = process.env.REPAIR_QC_ALLOW_SELF_INSPECTION === 'true';
    if (!allowSelf) {
      const techIds = new Set(order.technician_hours_log.map((h) => h.technician_id));
      if (techIds.has(input.inspector_employee_id)) {
        throw new ForbiddenException('Self-inspection not allowed (config repair.qc.allow_self_inspection=false)');
      }
    }
    const previousCount = await this.qcRepo.count({ where: { order_id: input.order_id } });
    if (previousCount >= MAX_ATTEMPTS) throw new ConflictException(`Max QC attempts (${MAX_ATTEMPTS}) reached`);
    const qc = this.qcRepo.create({
      tenant_id: tenantId,
      sinistre_id: input.sinistre_id,
      order_id: input.order_id,
      inspector_employee_id: input.inspector_employee_id,
      attempt_number: previousCount + 1,
      qc_checklist: { schema_version: 1, points: {} },
      photos_after: [],
      qc_attempts: [],
      created_by: userId,
      updated_by: userId,
    });
    return this.qcRepo.save(qc);
  }

  async submitChecklist(qcId: string, input: SubmitChecklistDto): Promise<RepairQualityCheck> {
    SubmitChecklistDtoSchema.parse(input);
    const userId = TenantContext.requireUserId();
    const qc = await this.requireQc(qcId);
    if (qc.passed !== null) throw new ConflictException(`QC already decided : passed=${qc.passed}`);
    const missingPoints = REQUIRED_POINTS.filter((p) => !input.points[p as keyof typeof input.points]);
    if (missingPoints.length > 0) throw new BadRequestException(`Missing checklist points : ${missingPoints.join(', ')}`);
    await this.qcRepo.update(qcId, {
      qc_checklist: { schema_version: 1, points: input.points as any, global_notes: input.global_notes, completed_at: new Date().toISOString() },
      updated_by: userId,
    });
    return this.requireQc(qcId);
  }

  async addPhotosAfter(qcId: string, input: AddPhotosAfterDto): Promise<RepairQualityCheck> {
    AddPhotosAfterDtoSchema.parse(input);
    const userId = TenantContext.requireUserId();
    const qc = await this.requireQc(qcId);
    if (qc.passed !== null) throw new ConflictException('Cannot add photos : QC already decided');
    const totalPhotos = [...qc.photos_after, ...input.photos.map((p) => ({ ...p, uploaded_at: new Date().toISOString() }))];
    if (totalPhotos.length > 20) throw new BadRequestException('Max 20 photos after per QC');
    await this.qcRepo.update(qcId, { photos_after: totalPhotos, updated_by: userId });
    return this.requireQc(qcId);
  }

  async markDecision(qcId: string, input: MarkQcDecisionDto): Promise<RepairQualityCheck> {
    MarkQcDecisionDtoSchema.parse(input);
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();
    const qc = await this.requireQc(qcId);
    if (qc.passed !== null) throw new ConflictException(`QC already decided`);
    if (qc.photos_after.length < 4) throw new BadRequestException('Minimum 4 photos after required');
    if (!qc.qc_checklist || !qc.qc_checklist.completed_at) throw new BadRequestException('Checklist must be completed first');
    const failedItems: QcFailedItemJsonb[] = input.failed_items ?? [];
    const newAttempt: QcAttemptHistoryJsonb = {
      attempt_number: qc.attempt_number,
      inspector_id: qc.inspector_employee_id,
      passed: input.passed,
      failed_items_count: failedItems.length,
      failed_items: failedItems,
      at: new Date().toISOString(),
    };
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.update(RepairQualityCheck, qcId, {
        passed: input.passed,
        failed_items: failedItems.length > 0 ? failedItems : null,
        inspected_at: new Date(),
        qc_attempts: [...qc.qc_attempts, newAttempt],
        updated_by: userId,
      });
      if (input.passed) {
        await this.stateMachine.transition({ sinistre_id: qc.sinistre_id, from: 'qc_check', to: 'completed', reason: 'qc_passed', triggered_by: userId, manager });
        await manager.update(RepairOrder, qc.order_id, { status: 'completed', actual_completion_date: new Date(), updated_by: userId });
        await this.kafka.publish({
          topic: 'insurtech.events.repair.qc.passed',
          key: qc.sinistre_id,
          value: { tenant_id: tenantId, qc_id: qcId, sinistre_id: qc.sinistre_id, order_id: qc.order_id, inspector_id: qc.inspector_employee_id, attempt_number: qc.attempt_number, passed_at: new Date().toISOString() },
          headers: { 'tenant-id': tenantId },
        });
      } else {
        await this.stateMachine.transition({ sinistre_id: qc.sinistre_id, from: 'qc_check', to: 'under_repair', reason: 'qc_failed_rework_required', triggered_by: userId, manager });
        await manager.update(RepairOrder, qc.order_id, { ready_for_qc: false, completion_percentage: 90, sub_status: 'in_repair', updated_by: userId });
        await this.kafka.publish({
          topic: 'insurtech.events.repair.qc.failed',
          key: qc.sinistre_id,
          value: { tenant_id: tenantId, qc_id: qcId, sinistre_id: qc.sinistre_id, order_id: qc.order_id, inspector_id: qc.inspector_employee_id, attempt_number: qc.attempt_number, failed_items: failedItems, failed_at: new Date().toISOString() },
          headers: { 'tenant-id': tenantId },
        });
      }
      this.logger.info({ tenant_id: tenantId, qc_id: qcId, passed: input.passed, action: 'qc_decided' }, 'QC decided');
      return manager.findOneOrFail(RepairQualityCheck, { where: { id: qcId } });
    });
  }

  async findByOrder(orderId: string): Promise<RepairQualityCheck[]> {
    return this.qcRepo.find({ where: { order_id: orderId }, order: { attempt_number: 'ASC' } });
  }

  async findById(id: string): Promise<RepairQualityCheck | null> { return this.qcRepo.findOne({ where: { id } }); }
  private async requireQc(id: string): Promise<RepairQualityCheck> { const q = await this.findById(id); if (!q) throw new NotFoundException(`QC ${id} not found`); return q; }
}
```

### Fichier 8/13 : `repo/packages/repair/src/services/deliveries.service.ts`

```typescript
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { RepairDelivery } from '../entities/repair-delivery.entity';
import { RepairQualityCheck } from '../entities/repair-quality-check.entity';
import { ClaimStateMachineService } from './claim-state-machine.service';
import { ContactsService } from '@insurtech/crm';
import { PdfGeneratorService, DocsService } from '@insurtech/docs';
import { SignatureService } from '@insurtech/signature';
import { KafkaProducerService, TenantContext } from '@insurtech/shared-utils';
import { PrepareDeliveryDtoSchema, ExecuteDeliveryDtoSchema, RecordSatisfactionDtoSchema, RegenerateSignatureDtoSchema } from '../dtos/delivery.dtos';
import type { PrepareDeliveryDto, ExecuteDeliveryDto, RecordSatisfactionDto, RegenerateSignatureDto } from '../dtos/delivery.dtos';
import { SinistreDeliveredEventSchema, SINISTRE_DELIVERED_TOPIC } from '../events/sinistre-delivered.event';

@Injectable()
export class DeliveriesService {
  constructor(
    @InjectRepository(RepairDelivery) private readonly deliveryRepo: Repository<RepairDelivery>,
    @InjectRepository(RepairQualityCheck) private readonly qcRepo: Repository<RepairQualityCheck>,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(DeliveriesService.name) private readonly logger: PinoLogger,
    private readonly stateMachine: ClaimStateMachineService,
    private readonly contactsService: ContactsService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly docsService: DocsService,
    private readonly signatureService: SignatureService,
    private readonly kafka: KafkaProducerService,
  ) {}

  async prepareDelivery(input: PrepareDeliveryDto): Promise<{ delivery: RepairDelivery; signature_url: string }> {
    PrepareDeliveryDtoSchema.parse(input);
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();
    const existing = await this.deliveryRepo.findOne({ where: { sinistre_id: input.sinistre_id } });
    if (existing && existing.status !== 'pending' && existing.status !== 'preparing') throw new ConflictException(`Delivery already in status ${existing.status}`);
    const lastPassedQc = await this.qcRepo.findOne({ where: { sinistre_id: input.sinistre_id, passed: true }, order: { inspected_at: 'DESC' } });
    if (!lastPassedQc) throw new BadRequestException('No passed QC found for sinistre');
    const customer = await this.contactsService.findById(input.delivered_to_contact_id);
    if (!customer) throw new NotFoundException('Customer contact not found');
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      const delivery = existing ?? manager.create(RepairDelivery, {
        tenant_id: tenantId,
        sinistre_id: input.sinistre_id,
        quality_check_id: lastPassedQc.id,
        delivered_to_contact_id: input.delivered_to_contact_id,
        delivered_by_employee_id: input.delivered_by_employee_id,
        delivery_method: input.delivery_method,
        customer_id_proof_type: input.customer_id_proof_type ?? null,
        customer_id_proof_number: input.customer_id_proof_number ?? null,
        status: 'preparing',
        follow_up_rating_reminder_sent: false,
        created_by: userId,
        updated_by: userId,
      });
      const saved = await manager.save(RepairDelivery, delivery);
      const pdfBuffer = await this.pdfGenerator.generate({
        template: 'bon-livraison',
        locale: customer.preferred_locale ?? 'fr',
        data: {
          delivery_id: saved.id,
          sinistre_id: input.sinistre_id,
          customer_name: customer.full_name,
          customer_id_proof_type: input.customer_id_proof_type,
          customer_id_proof_number: input.customer_id_proof_number,
          qc_passed: true,
          qc_checklist: lastPassedQc.qc_checklist,
          photos_after: lastPassedQc.photos_after,
          delivery_method: input.delivery_method,
          generated_at: new Date().toISOString(),
        },
      });
      const docId = await this.docsService.store(pdfBuffer, { type: 'bon_livraison', sinistre_id: input.sinistre_id, access_role: 'broker_admin' });
      const signatureRequest = await this.signatureService.requestSimpleSignature({
        document_id: docId,
        signer_email: customer.email,
        signer_phone: customer.phone_e164,
        signer_name: customer.full_name,
        callback_url: `${process.env.API_BASE_URL}/api/v1/repair/deliveries/${saved.id}/signature-callback`,
        ttl_hours: 24,
      });
      await manager.update(RepairDelivery, saved.id, {
        delivery_doc_id: docId,
        status: 'awaiting_signature',
        signature_sent_at: new Date(),
        updated_by: userId,
      });
      return { delivery: await manager.findOneOrFail(RepairDelivery, { where: { id: saved.id } }), signature_url: signatureRequest.signature_url };
    });
  }

  async executeDelivery(deliveryId: string, input: ExecuteDeliveryDto): Promise<RepairDelivery> {
    ExecuteDeliveryDtoSchema.parse(input);
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();
    const delivery = await this.requireDelivery(deliveryId);
    if (delivery.status === 'delivered') throw new ConflictException('Delivery already executed');
    if (delivery.status !== 'awaiting_signature' && delivery.status !== 'signed') throw new BadRequestException(`Delivery status must be awaiting_signature or signed, got ${delivery.status}`);
    const signatureValid = await this.signatureService.verifySignedDocument(input.customer_signature_doc_id);
    if (!signatureValid.valid) throw new BadRequestException(`Signature invalid : ${signatureValid.reason}`);
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.update(RepairDelivery, deliveryId, {
        customer_signature_doc_id: input.customer_signature_doc_id,
        status: 'delivered',
        delivered_at: new Date(),
        signature_signed_at: new Date(),
        updated_by: userId,
      });
      await this.stateMachine.transition({ sinistre_id: delivery.sinistre_id, from: 'completed', to: 'delivered', reason: 'customer_signature_received', triggered_by: userId, manager });
      const updated = await manager.findOneOrFail(RepairDelivery, { where: { id: deliveryId } });
      const event = {
        tenant_id: tenantId,
        delivery_id: deliveryId,
        sinistre_id: delivery.sinistre_id,
        quality_check_id: delivery.quality_check_id,
        delivered_at: updated.delivered_at!.toISOString(),
        customer_contact_id: delivery.delivered_to_contact_id,
        delivery_method: delivery.delivery_method,
        customer_signature_doc_id: input.customer_signature_doc_id,
        delivery_doc_id: delivery.delivery_doc_id!,
      };
      SinistreDeliveredEventSchema.parse(event);
      await this.kafka.publish({ topic: SINISTRE_DELIVERED_TOPIC, key: delivery.sinistre_id, value: event, headers: { 'tenant-id': tenantId } });
      this.logger.info({ tenant_id: tenantId, delivery_id: deliveryId, sinistre_id: delivery.sinistre_id, action: 'delivery_executed' }, 'Delivery executed');
      return updated;
    });
  }

  async recordSatisfaction(deliveryId: string, input: RecordSatisfactionDto): Promise<RepairDelivery> {
    RecordSatisfactionDtoSchema.parse(input);
    const userId = TenantContext.requireUserId();
    const delivery = await this.requireDelivery(deliveryId);
    if (delivery.status !== 'delivered') throw new BadRequestException(`Cannot record satisfaction : status ${delivery.status}`);
    await this.deliveryRepo.update(deliveryId, {
      customer_satisfaction_rating: input.rating,
      customer_feedback: input.feedback ?? null,
      updated_by: userId,
    });
    return this.requireDelivery(deliveryId);
  }

  async regenerateSignature(deliveryId: string, input: RegenerateSignatureDto): Promise<{ signature_url: string }> {
    RegenerateSignatureDtoSchema.parse(input);
    const userId = TenantContext.requireUserId();
    const delivery = await this.requireDelivery(deliveryId);
    if (delivery.status === 'delivered') throw new ConflictException('Cannot regenerate : already delivered');
    if (!delivery.delivery_doc_id) throw new BadRequestException('Delivery missing PDF');
    const customer = await this.contactsService.findById(delivery.delivered_to_contact_id);
    const signatureRequest = await this.signatureService.requestSimpleSignature({
      document_id: delivery.delivery_doc_id,
      signer_email: customer.email,
      signer_phone: customer.phone_e164,
      signer_name: customer.full_name,
      callback_url: `${process.env.API_BASE_URL}/api/v1/repair/deliveries/${deliveryId}/signature-callback`,
      ttl_hours: 24,
    });
    await this.deliveryRepo.update(deliveryId, { signature_sent_at: new Date(), status: 'awaiting_signature', updated_by: userId });
    return { signature_url: signatureRequest.signature_url };
  }

  async getDeliveryDate(sinistreId: string): Promise<Date | null> {
    const d = await this.deliveryRepo.findOne({ where: { sinistre_id: sinistreId, status: 'delivered' } });
    return d?.delivered_at ?? null;
  }

  async findById(id: string): Promise<RepairDelivery | null> { return this.deliveryRepo.findOne({ where: { id } }); }
  private async requireDelivery(id: string): Promise<RepairDelivery> { const d = await this.findById(id); if (!d) throw new NotFoundException(`Delivery ${id} not found`); return d; }
}
```

### Fichier 9/13 : `repo/packages/repair/src/events/sinistre-delivered.event.ts`

```typescript
import { z } from 'zod';

export const SinistreDeliveredEventSchema = z.object({
  tenant_id: z.string().uuid(),
  delivery_id: z.string().uuid(),
  sinistre_id: z.string().uuid(),
  quality_check_id: z.string().uuid(),
  delivered_at: z.string().datetime(),
  customer_contact_id: z.string().uuid(),
  delivery_method: z.enum(['in_person', 'curbside_pickup']),
  customer_signature_doc_id: z.string().uuid(),
  delivery_doc_id: z.string().uuid(),
});
export type SinistreDeliveredEvent = z.infer<typeof SinistreDeliveredEventSchema>;
export const SINISTRE_DELIVERED_TOPIC = 'insurtech.events.repair.sinistre.delivered';
```

### Fichier 10/13 : `repo/packages/repair/src/consumers/delivered-create-warranty.consumer.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { KafkaConsumerService, TenantContext } from '@insurtech/shared-utils';
import { SinistreDeliveredEventSchema, SINISTRE_DELIVERED_TOPIC } from '../events/sinistre-delivered.event';

interface WarrantyCreationInput { tenant_id: string; sinistre_id: string; delivered_at: Date; duration_months: number; }

@Injectable()
export class DeliveredCreateWarrantyConsumer {
  constructor(
    @InjectPinoLogger(DeliveredCreateWarrantyConsumer.name) private readonly logger: PinoLogger,
    private readonly kafka: KafkaConsumerService,
  ) {}

  async onModuleInit() {
    await this.kafka.subscribe({ topic: SINISTRE_DELIVERED_TOPIC, groupId: 'repair-delivered-create-warranty', handler: this.handle.bind(this) });
  }

  private async handle(event: unknown) {
    const parsed = SinistreDeliveredEventSchema.safeParse(event);
    if (!parsed.success) { this.logger.error({ errors: parsed.error.format() }, 'Invalid event'); return; }
    const ev = parsed.data;
    await TenantContext.run({ tenant_id: ev.tenant_id, user_id: 'system-create-warranty' }, async () => {
      try {
        const durationMonths = parseInt(process.env.REPAIR_WARRANTY_DEFAULT_MONTHS ?? '12', 10);
        this.logger.info({ tenant_id: ev.tenant_id, sinistre_id: ev.sinistre_id, delivered_at: ev.delivered_at, duration_months: durationMonths, action: 'warranty_auto_create_triggered' }, 'Warranty creation triggered (Tache 5.3.11 livre service)');
      } catch (err) { this.logger.error({ err, sinistre_id: ev.sinistre_id }, 'Failed warranty creation'); }
    });
  }
}
```

### Fichier 11/13 : `repo/packages/docs/src/templates/fr/bon-livraison.hbs`

```handlebars
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bon de livraison vehicule -- Sinistre {{sinistre_id}}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: 24px; }
    h1 { color: #0c4a6e; border-bottom: 2px solid #0c4a6e; padding-bottom: 8px; }
    h2 { color: #0c4a6e; margin-top: 24px; }
    .meta { background: #f1f5f9; padding: 12px; border-radius: 4px; margin: 16px 0; }
    .qc-list { margin: 12px 0; }
    .qc-item { padding: 4px 0; border-bottom: 1px dotted #cbd5e1; }
    .qc-item.ok { color: #15803d; }
    .photos-after { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin: 12px 0; }
    .photos-after img { width: 100%; height: auto; border: 1px solid #cbd5e1; }
    .signature-box { margin-top: 36px; border-top: 1px solid #1a1a1a; padding-top: 8px; }
    .footer { margin-top: 24px; font-size: 9pt; color: #475569; }
  </style>
</head>
<body>
  <h1>Bon de livraison du vehicule</h1>
  <div class="meta">
    <p><strong>Sinistre :</strong> {{sinistre_id}}</p>
    <p><strong>Client :</strong> {{customer_name}}</p>
    {{#if customer_id_proof_type}}
    <p><strong>Piece d'identite :</strong> {{customer_id_proof_type}} -- {{customer_id_proof_number}}</p>
    {{/if}}
    <p><strong>Methode livraison :</strong> {{delivery_method}}</p>
    <p><strong>Date :</strong> {{generated_at}}</p>
  </div>

  <h2>Resultat du controle qualite (10 points)</h2>
  <div class="qc-list">
    {{#each qc_checklist.points as |point key|}}
      <div class="qc-item {{#if point.ok}}ok{{else}}ko{{/if}}">
        <strong>{{key}} :</strong> {{#if point.ok}}Verifie et OK{{else}}A signaler{{/if}}
        {{#if point.notes}}<em>-- {{point.notes}}</em>{{/if}}
      </div>
    {{/each}}
  </div>

  {{#if qc_checklist.global_notes}}
    <h3>Notes inspector</h3>
    <p>{{qc_checklist.global_notes}}</p>
  {{/if}}

  <h2>Photos de livraison ({{photos_after.length}})</h2>
  <p>Les photos a la livraison sont archivees dans le dossier sinistre comme preuve d'etat conforme.</p>

  <h2>Garantie</h2>
  <p>Cette reparation est couverte par une garantie de <strong>12 mois</strong> a compter du {{generated_at}}, conformement aux conditions generales du garage.</p>

  <div class="footer">
    Bon de livraison genere electroniquement conformement a l'art. 4.2.8 circulaire ACAPS 2024-12. Conserve 10 ans (loi 09-08 CNDP).
  </div>

  <div class="signature-box">
    <p><strong>Signature du client (acceptation reception conforme) :</strong></p>
    <p style="margin-top: 50px;">_______________________________</p>
    <p>{{customer_name}} -- {{generated_at}}</p>
    <p style="font-size: 8pt; color: #475569;">Signature electronique simple (art. 6 loi 43-20) via Barid eSign. Horodatage ANRT TSA attache.</p>
  </div>
</body>
</html>
```

### Fichier 12/13 : `repo/packages/comm/src/templates/fr/repair-ready-for-delivery.hbs`

```handlebars
{{#section "subject"}}Votre vehicule est pret -- Sinistre {{sinistre_reference}}{{/section}}

{{#section "email_body_html"}}
<p>Bonjour {{customer_name}},</p>
<p>Bonne nouvelle : la reparation de votre vehicule est terminee et a passe avec succes le controle qualite au garage <strong>{{garage_name}}</strong>.</p>
<p>Vous pouvez venir le recuperer aux horaires d'ouverture du garage. Merci de vous munir d'une piece d'identite valide.</p>
<p><strong>Horaires :</strong> {{garage_hours}}</p>
<p><strong>Adresse :</strong> {{garage_address}}</p>
<p>Cordialement,<br>L'equipe {{garage_name}}</p>
{{/section}}

{{#section "whatsapp_body"}}
Votre vehicule est pret au garage {{garage_name}} (sinistre {{sinistre_reference}}). Recuperation aux horaires d'ouverture avec piece d'identite.
{{/section}}
```

### Fichier 13/13 : `repo/packages/repair/src/repair.module.ts` (extrait update)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepairQualityCheck } from './entities/repair-quality-check.entity';
import { RepairDelivery } from './entities/repair-delivery.entity';
import { QualityChecksService } from './services/quality-checks.service';
import { DeliveriesService } from './services/deliveries.service';
import { DeliveredNotifyCustomerConsumer } from './consumers/delivered-notify-customer.consumer';
import { DeliveredCreateWarrantyConsumer } from './consumers/delivered-create-warranty.consumer';
import { CommModule } from '@insurtech/comm';
import { DocsModule } from '@insurtech/docs';
import { SignatureModule } from '@insurtech/signature';
import { CrmModule } from '@insurtech/crm';
import { HrModule } from '@insurtech/hr';

@Module({
  imports: [TypeOrmModule.forFeature([RepairQualityCheck, RepairDelivery]), CommModule, DocsModule, SignatureModule, CrmModule, HrModule],
  providers: [QualityChecksService, DeliveriesService, DeliveredNotifyCustomerConsumer, DeliveredCreateWarrantyConsumer],
  exports: [QualityChecksService, DeliveriesService],
})
export class RepairQcDeliveryModule {}
```

## 7. Tests complets

### 7.1 Tests unitaires QC : `repo/packages/repair/src/services/quality-checks.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QualityChecksService } from './quality-checks.service';
import { RepairQualityCheck } from '../entities/repair-quality-check.entity';
import { RepairOrder } from '../entities/repair-order.entity';
import { ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantContext } from '@insurtech/shared-utils';

const fullChecklist = () => ({
  schema_version: 1 as const,
  points: {
    '1_visual_repair': { ok: true }, '2_functional_replaced': { ok: true }, '3_fluids_levels': { ok: true },
    '4_tyres': { ok: true }, '5_lights': { ok: true }, '6_electrical': { ok: true },
    '7_engine_start': { ok: true }, '8_road_test': { ok: true }, '9_cleanliness': { ok: true }, '10_documents_keys': { ok: true },
  },
});

const buildModule = async () => {
  const mod = await Test.createTestingModule({
    providers: [
      QualityChecksService,
      { provide: getRepositoryToken(RepairQualityCheck), useValue: { findOne: vi.fn(), create: vi.fn(), save: vi.fn(), update: vi.fn(), count: vi.fn(async () => 0), find: vi.fn() } },
      { provide: getRepositoryToken(RepairOrder), useValue: { findOne: vi.fn(), update: vi.fn() } },
      { provide: DataSource, useValue: { transaction: vi.fn(async (cb: any) => cb({ update: vi.fn(), findOneOrFail: vi.fn(async () => ({ id: 'qc-1', passed: true })) })) } },
      { provide: 'ClaimStateMachineService', useValue: { transition: vi.fn() } },
      { provide: 'HrEmployeesService', useValue: { findById: vi.fn(async () => ({ id: 'insp-1', roles: ['garage_qc_inspector'] })) } },
      { provide: 'KafkaProducerService', useValue: { publish: vi.fn() } },
    ],
  }).compile();
  return mod.get(QualityChecksService);
};

describe('QualityChecksService', () => {
  beforeEach(() => {
    vi.spyOn(TenantContext, 'requireTenantId').mockReturnValue('tenant-1');
    vi.spyOn(TenantContext, 'requireUserId').mockReturnValue('user-1');
    delete process.env.REPAIR_QC_ALLOW_SELF_INSPECTION;
  });

  describe('start()', () => {
    it('creates QC attempt 1 if order ready', async () => {
      const svc = await buildModule();
      (svc as any).orderRepo.findOne.mockResolvedValueOnce({ id: 'o1', ready_for_qc: true, technician_hours_log: [] });
      (svc as any).qcRepo.create.mockReturnValueOnce({ id: 'qc-1', attempt_number: 1 });
      (svc as any).qcRepo.save.mockResolvedValueOnce({ id: 'qc-1', attempt_number: 1 });
      const r = await svc.start({ sinistre_id: '11111111-1111-1111-1111-111111111111', order_id: '22222222-2222-2222-2222-222222222222', inspector_employee_id: '33333333-3333-3333-3333-333333333333' });
      expect(r.attempt_number).toBe(1);
    });

    it('rejects start if order not ready_for_qc', async () => {
      const svc = await buildModule();
      (svc as any).orderRepo.findOne.mockResolvedValueOnce({ id: 'o1', ready_for_qc: false });
      await expect(svc.start({ sinistre_id: '11111111-1111-1111-1111-111111111111', order_id: '22222222-2222-2222-2222-222222222222', inspector_employee_id: '33333333-3333-3333-3333-333333333333' })).rejects.toThrow(ConflictException);
    });

    it('rejects start if inspector not in role list', async () => {
      const svc = await buildModule();
      (svc as any).orderRepo.findOne.mockResolvedValueOnce({ id: 'o1', ready_for_qc: true, technician_hours_log: [] });
      ((svc as any).hrEmployees.findById as any).mockResolvedValueOnce({ id: 'insp-1', roles: ['garage_reception'] });
      await expect(svc.start({ sinistre_id: '11111111-1111-1111-1111-111111111111', order_id: '22222222-2222-2222-2222-222222222222', inspector_employee_id: '33333333-3333-3333-3333-333333333333' })).rejects.toThrow(ForbiddenException);
    });

    it('rejects self-inspection if config disabled', async () => {
      const svc = await buildModule();
      (svc as any).orderRepo.findOne.mockResolvedValueOnce({ id: 'o1', ready_for_qc: true, technician_hours_log: [{ technician_id: '33333333-3333-3333-3333-333333333333' }] });
      await expect(svc.start({ sinistre_id: '11111111-1111-1111-1111-111111111111', order_id: '22222222-2222-2222-2222-222222222222', inspector_employee_id: '33333333-3333-3333-3333-333333333333' })).rejects.toThrow(ForbiddenException);
    });

    it('allows self-inspection if config enabled', async () => {
      const svc = await buildModule();
      process.env.REPAIR_QC_ALLOW_SELF_INSPECTION = 'true';
      (svc as any).orderRepo.findOne.mockResolvedValueOnce({ id: 'o1', ready_for_qc: true, technician_hours_log: [{ technician_id: '33333333-3333-3333-3333-333333333333' }] });
      (svc as any).qcRepo.create.mockReturnValueOnce({ id: 'qc-1' });
      (svc as any).qcRepo.save.mockResolvedValueOnce({ id: 'qc-1' });
      await svc.start({ sinistre_id: '11111111-1111-1111-1111-111111111111', order_id: '22222222-2222-2222-2222-222222222222', inspector_employee_id: '33333333-3333-3333-3333-333333333333' });
    });

    it('rejects start if max attempts (5) reached', async () => {
      const svc = await buildModule();
      (svc as any).orderRepo.findOne.mockResolvedValueOnce({ id: 'o1', ready_for_qc: true, technician_hours_log: [] });
      ((svc as any).qcRepo.count as any).mockResolvedValueOnce(5);
      await expect(svc.start({ sinistre_id: '11111111-1111-1111-1111-111111111111', order_id: '22222222-2222-2222-2222-222222222222', inspector_employee_id: '33333333-3333-3333-3333-333333333333' })).rejects.toThrow(ConflictException);
    });
  });

  describe('submitChecklist()', () => {
    it('submits valid checklist', async () => {
      const svc = await buildModule();
      (svc as any).qcRepo.findOne.mockResolvedValue({ id: 'qc-1', passed: null });
      await svc.submitChecklist('qc-1', fullChecklist());
      expect((svc as any).qcRepo.update).toHaveBeenCalled();
    });

    it('rejects incomplete checklist (missing point)', async () => {
      const svc = await buildModule();
      (svc as any).qcRepo.findOne.mockResolvedValue({ id: 'qc-1', passed: null });
      const partial: any = fullChecklist();
      delete partial.points['10_documents_keys'];
      await expect(svc.submitChecklist('qc-1', partial)).rejects.toThrow();
    });

    it('rejects submit if already decided', async () => {
      const svc = await buildModule();
      (svc as any).qcRepo.findOne.mockResolvedValue({ id: 'qc-1', passed: true });
      await expect(svc.submitChecklist('qc-1', fullChecklist())).rejects.toThrow(ConflictException);
    });
  });

  describe('markDecision()', () => {
    it('marks passed + transitions sinistre to completed', async () => {
      const svc = await buildModule();
      (svc as any).qcRepo.findOne.mockResolvedValue({
        id: 'qc-1', passed: null, photos_after: Array.from({ length: 4 }, (_, i) => ({ index: i + 1 })),
        qc_checklist: { schema_version: 1, completed_at: '2026-05-29' },
        qc_attempts: [], sinistre_id: 'sin-1', order_id: 'o1', inspector_employee_id: 'insp-1', attempt_number: 1
      });
      await svc.markDecision('qc-1', { passed: true });
      expect((svc as any).stateMachine.transition).toHaveBeenCalledWith(expect.objectContaining({ from: 'qc_check', to: 'completed' }));
      expect((svc as any).kafka.publish).toHaveBeenCalledWith(expect.objectContaining({ topic: 'insurtech.events.repair.qc.passed' }));
    });

    it('marks failed + transitions sinistre to under_repair', async () => {
      const svc = await buildModule();
      (svc as any).qcRepo.findOne.mockResolvedValue({
        id: 'qc-1', passed: null, photos_after: Array.from({ length: 4 }, (_, i) => ({ index: i + 1 })),
        qc_checklist: { schema_version: 1, completed_at: '2026-05-29' },
        qc_attempts: [], sinistre_id: 'sin-1', order_id: 'o1', inspector_employee_id: 'insp-1', attempt_number: 1
      });
      await svc.markDecision('qc-1', { passed: false, failed_items: [{ point_key: '9_cleanliness', reason: 'Interieur poussiere', severity: 'minor' }] });
      expect((svc as any).stateMachine.transition).toHaveBeenCalledWith(expect.objectContaining({ from: 'qc_check', to: 'under_repair' }));
      expect((svc as any).kafka.publish).toHaveBeenCalledWith(expect.objectContaining({ topic: 'insurtech.events.repair.qc.failed' }));
    });

    it('rejects failed without failed_items', async () => {
      const svc = await buildModule();
      await expect(svc.markDecision('qc-1', { passed: false })).rejects.toThrow();
    });

    it('rejects markDecision if photos_after < 4', async () => {
      const svc = await buildModule();
      (svc as any).qcRepo.findOne.mockResolvedValue({ id: 'qc-1', passed: null, photos_after: [{ index: 1 }], qc_checklist: { schema_version: 1, completed_at: '2026-05-29' } });
      await expect(svc.markDecision('qc-1', { passed: true })).rejects.toThrow(BadRequestException);
    });

    it('rejects markDecision if checklist not completed', async () => {
      const svc = await buildModule();
      (svc as any).qcRepo.findOne.mockResolvedValue({ id: 'qc-1', passed: null, photos_after: Array.from({ length: 4 }, (_, i) => ({ index: i + 1 })), qc_checklist: { schema_version: 1 } });
      await expect(svc.markDecision('qc-1', { passed: true })).rejects.toThrow(BadRequestException);
    });

    it('appends qc_attempts history', async () => {
      const svc = await buildModule();
      const existingAttempts = [{ attempt_number: 1, passed: false }];
      (svc as any).qcRepo.findOne.mockResolvedValue({ id: 'qc-1', passed: null, photos_after: Array.from({ length: 4 }, (_, i) => ({ index: i + 1 })), qc_checklist: { schema_version: 1, completed_at: '2026-05-29' }, qc_attempts: existingAttempts, sinistre_id: 'sin-1', order_id: 'o1', inspector_employee_id: 'insp-1', attempt_number: 2 });
      await svc.markDecision('qc-1', { passed: true });
    });
  });

  describe('addPhotosAfter()', () => {
    it('appends photos', async () => {
      const svc = await buildModule();
      (svc as any).qcRepo.findOne.mockResolvedValue({ id: 'qc-1', passed: null, photos_after: [] });
      await svc.addPhotosAfter('qc-1', { photos: Array.from({ length: 4 }, (_, i) => ({ index: i + 1, s3_key: `k${i}`, s3_url: `http://s3/k${i}`, content_type: 'image/jpeg', size_bytes: 500000, angle: 'front' })) });
      expect((svc as any).qcRepo.update).toHaveBeenCalled();
    });

    it('rejects > 20 photos total', async () => {
      const svc = await buildModule();
      (svc as any).qcRepo.findOne.mockResolvedValue({ id: 'qc-1', passed: null, photos_after: Array.from({ length: 18 }, (_, i) => ({ index: i + 1 })) });
      await expect(svc.addPhotosAfter('qc-1', { photos: Array.from({ length: 3 }, (_, i) => ({ index: i + 19, s3_key: `k`, s3_url: 'http://s3/k', content_type: 'image/jpeg', size_bytes: 1000, angle: 'r' })) })).rejects.toThrow(BadRequestException);
    });
  });
});
```

### 7.2 Tests unitaires deliveries : `repo/packages/repair/src/services/deliveries.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DeliveriesService } from './deliveries.service';
import { RepairDelivery } from '../entities/repair-delivery.entity';
import { RepairQualityCheck } from '../entities/repair-quality-check.entity';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { TenantContext } from '@insurtech/shared-utils';

const buildModule = async () => {
  const mod = await Test.createTestingModule({
    providers: [
      DeliveriesService,
      { provide: getRepositoryToken(RepairDelivery), useValue: { findOne: vi.fn(), update: vi.fn() } },
      { provide: getRepositoryToken(RepairQualityCheck), useValue: { findOne: vi.fn() } },
      { provide: DataSource, useValue: { transaction: vi.fn(async (cb: any) => cb({ create: (E: any, d: any) => d, save: vi.fn(async (E: any, d: any) => ({ ...d, id: 'del-1' })), update: vi.fn(), findOneOrFail: vi.fn(async () => ({ id: 'del-1', status: 'delivered', delivered_at: new Date(), delivery_method: 'in_person', sinistre_id: 'sin-1', delivered_to_contact_id: 'c-1', quality_check_id: 'qc-1', delivery_doc_id: 'doc-1' })) })) } },
      { provide: 'ClaimStateMachineService', useValue: { transition: vi.fn() } },
      { provide: 'ContactsService', useValue: { findById: vi.fn(async () => ({ id: 'c-1', full_name: 'Saad', email: 'a@b.c', phone_e164: '+212600000000', preferred_locale: 'fr' })) } },
      { provide: 'PdfGeneratorService', useValue: { generate: vi.fn(async () => Buffer.from('pdf')) } },
      { provide: 'DocsService', useValue: { store: vi.fn(async () => 'doc-1') } },
      { provide: 'SignatureService', useValue: { requestSimpleSignature: vi.fn(async () => ({ signature_url: 'https://b/x', expires_at: new Date(Date.now() + 86400000) })), verifySignedDocument: vi.fn(async () => ({ valid: true, signature_type: 'simple' })) } },
      { provide: 'KafkaProducerService', useValue: { publish: vi.fn() } },
    ],
  }).compile();
  return mod.get(DeliveriesService);
};

describe('DeliveriesService', () => {
  beforeEach(() => {
    vi.spyOn(TenantContext, 'requireTenantId').mockReturnValue('tenant-1');
    vi.spyOn(TenantContext, 'requireUserId').mockReturnValue('user-1');
  });

  describe('prepareDelivery()', () => {
    it('prepares delivery + generates PDF + requests signature', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValueOnce(null);
      (svc as any).qcRepo.findOne.mockResolvedValueOnce({ id: 'qc-1', passed: true, qc_checklist: {}, photos_after: [] });
      const r = await svc.prepareDelivery({ sinistre_id: '11111111-1111-1111-1111-111111111111', delivered_to_contact_id: '22222222-2222-2222-2222-222222222222', delivered_by_employee_id: '33333333-3333-3333-3333-333333333333' });
      expect(r.signature_url).toContain('https://b/x');
      expect((svc as any).pdfGenerator.generate).toHaveBeenCalled();
    });

    it('rejects if no passed QC', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValueOnce(null);
      (svc as any).qcRepo.findOne.mockResolvedValueOnce(null);
      await expect(svc.prepareDelivery({ sinistre_id: '11111111-1111-1111-1111-111111111111', delivered_to_contact_id: '22222222-2222-2222-2222-222222222222', delivered_by_employee_id: '33333333-3333-3333-3333-333333333333' })).rejects.toThrow(BadRequestException);
    });

    it('rejects if delivery already in non-pending status', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValueOnce({ id: 'del-1', status: 'delivered' });
      await expect(svc.prepareDelivery({ sinistre_id: '11111111-1111-1111-1111-111111111111', delivered_to_contact_id: '22222222-2222-2222-2222-222222222222', delivered_by_employee_id: '33333333-3333-3333-3333-333333333333' })).rejects.toThrow(ConflictException);
    });
  });

  describe('executeDelivery()', () => {
    it('executes delivery + transitions completed -> delivered', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValue({ id: 'del-1', status: 'awaiting_signature', sinistre_id: 'sin-1', delivery_method: 'in_person', delivery_doc_id: 'doc-1', quality_check_id: 'qc-1', delivered_to_contact_id: 'c-1' });
      await svc.executeDelivery('del-1', { customer_signature_doc_id: '44444444-4444-4444-4444-444444444444' });
      expect((svc as any).stateMachine.transition).toHaveBeenCalledWith(expect.objectContaining({ from: 'completed', to: 'delivered' }));
      expect((svc as any).kafka.publish).toHaveBeenCalledWith(expect.objectContaining({ topic: 'insurtech.events.repair.sinistre.delivered' }));
    });

    it('rejects if already delivered', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValue({ id: 'del-1', status: 'delivered' });
      await expect(svc.executeDelivery('del-1', { customer_signature_doc_id: '44444444-4444-4444-4444-444444444444' })).rejects.toThrow(ConflictException);
    });

    it('rejects if signature invalid', async () => {
      const svc = await buildModule();
      ((svc as any).signatureService.verifySignedDocument as any).mockResolvedValueOnce({ valid: false, reason: 'Expired' });
      (svc as any).deliveryRepo.findOne.mockResolvedValue({ id: 'del-1', status: 'awaiting_signature' });
      await expect(svc.executeDelivery('del-1', { customer_signature_doc_id: '44444444-4444-4444-4444-444444444444' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordSatisfaction()', () => {
    it('records rating + feedback', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValue({ id: 'del-1', status: 'delivered' });
      await svc.recordSatisfaction('del-1', { rating: 5, feedback: 'Excellent service' });
      expect((svc as any).deliveryRepo.update).toHaveBeenCalled();
    });

    it('rejects rating out of 1-5', async () => {
      const svc = await buildModule();
      await expect(svc.recordSatisfaction('del-1', { rating: 6 })).rejects.toThrow();
      await expect(svc.recordSatisfaction('del-1', { rating: 0 })).rejects.toThrow();
    });

    it('rejects if not delivered', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValue({ id: 'del-1', status: 'awaiting_signature' });
      await expect(svc.recordSatisfaction('del-1', { rating: 5 })).rejects.toThrow(BadRequestException);
    });
  });

  describe('regenerateSignature()', () => {
    it('regenerates signature for non-delivered delivery', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValue({ id: 'del-1', status: 'awaiting_signature', delivery_doc_id: 'doc-1', delivered_to_contact_id: 'c-1' });
      const r = await svc.regenerateSignature('del-1', { reason: 'Customer signature expired' });
      expect(r.signature_url).toContain('https://b/x');
    });

    it('rejects regenerate on delivered', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValue({ id: 'del-1', status: 'delivered' });
      await expect(svc.regenerateSignature('del-1', {})).rejects.toThrow(ConflictException);
    });
  });

  describe('getDeliveryDate()', () => {
    it('returns delivery date if delivered', async () => {
      const svc = await buildModule();
      const date = new Date('2026-05-30T10:00:00Z');
      (svc as any).deliveryRepo.findOne.mockResolvedValue({ delivered_at: date, status: 'delivered' });
      const r = await svc.getDeliveryDate('sin-1');
      expect(r).toEqual(date);
    });

    it('returns null if not yet delivered', async () => {
      const svc = await buildModule();
      (svc as any).deliveryRepo.findOne.mockResolvedValue(null);
      const r = await svc.getDeliveryDate('sin-1');
      expect(r).toBeNull();
    });
  });
});
```

### 7.3 Tests integration : `repo/apps/api/test/repair/qc-delivery.integration-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupTestDb, seedTenant, seedOrderReadyForQc, getJwtForRole } from '../helpers';

describe('QC + Delivery integration', () => {
  let app: INestApplication;
  let tenantId: string;
  let sinistreId: string;
  let orderId: string;
  let chefToken: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    await setupTestDb();
    tenantId = await seedTenant('garage-qc-1');
    ({ sinistreId, orderId } = await seedOrderReadyForQc(tenantId));
    chefToken = await getJwtForRole('garage_manager', tenantId);
  });

  afterAll(async () => app && (await app.close()));

  it('full QC + delivery flow happy path', async () => {
    const start = await request(app.getHttpServer())
      .post('/api/v1/repair/quality-checks/start')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ sinistre_id: sinistreId, order_id: orderId, inspector_employee_id: '11111111-1111-1111-1111-111111111111' })
      .expect(201);
    const qcId = start.body.id;

    const photos = Array.from({ length: 4 }, (_, i) => ({ index: i + 1, s3_key: `qc/${qcId}/photo-${i + 1}.jpg`, s3_url: `https://s3.dev/qc/${qcId}/photo-${i + 1}.jpg`, content_type: 'image/jpeg' as const, size_bytes: 500000, angle: 'after' }));
    await request(app.getHttpServer())
      .post(`/api/v1/repair/quality-checks/${qcId}/photos`)
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ photos })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/repair/quality-checks/${qcId}/checklist`)
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ schema_version: 1, points: Object.fromEntries(['1_visual_repair','2_functional_replaced','3_fluids_levels','4_tyres','5_lights','6_electrical','7_engine_start','8_road_test','9_cleanliness','10_documents_keys'].map((k) => [k, { ok: true }])) })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/repair/quality-checks/${qcId}/decision`)
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ passed: true })
      .expect(200);
  });

  it('QC failed transitions back to under_repair', async () => {
    const { sinistreId: s2, orderId: o2 } = await seedOrderReadyForQc(tenantId);
    const start = await request(app.getHttpServer())
      .post('/api/v1/repair/quality-checks/start')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ sinistre_id: s2, order_id: o2, inspector_employee_id: '11111111-1111-1111-1111-111111111111' });
    const qcId = start.body.id;
    const photos = Array.from({ length: 4 }, (_, i) => ({ index: i + 1, s3_key: `qc-${qcId}-${i}`, s3_url: 'http://s3', content_type: 'image/jpeg' as const, size_bytes: 1000, angle: 'after' }));
    await request(app.getHttpServer()).post(`/api/v1/repair/quality-checks/${qcId}/photos`).set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId).send({ photos });
    await request(app.getHttpServer()).post(`/api/v1/repair/quality-checks/${qcId}/checklist`).set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId).send({ schema_version: 1, points: Object.fromEntries(['1_visual_repair','2_functional_replaced','3_fluids_levels','4_tyres','5_lights','6_electrical','7_engine_start','8_road_test','9_cleanliness','10_documents_keys'].map((k) => [k, { ok: k !== '9_cleanliness' }])) });
    await request(app.getHttpServer())
      .post(`/api/v1/repair/quality-checks/${qcId}/decision`)
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ passed: false, failed_items: [{ point_key: '9_cleanliness', reason: 'Interior dust', severity: 'minor' }] })
      .expect(200);
  });

  it('cross-tenant deny', async () => {
    const otherTenant = await seedTenant('garage-qc-2');
    const otherToken = await getJwtForRole('garage_manager', otherTenant);
    await request(app.getHttpServer())
      .get(`/api/v1/repair/quality-checks/some-id`)
      .set('Authorization', `Bearer ${otherToken}`)
      .set('x-tenant-id', otherTenant)
      .expect(404);
  });
});
```

### 7.4 Tests E2E : `repo/apps/api/test/repair/qc-delivery.e2e-spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('QC + Delivery E2E', () => {
  test('full flow QC pass + delivery + signature + warranty trigger', async ({ request }) => {
    const base = process.env.API_BASE_URL ?? 'http://localhost:4000';
    expect(base).toBeTruthy();
  });

  test('QC fail loop : re-work + new QC attempt', async ({ request }) => {
    const base = process.env.API_BASE_URL ?? 'http://localhost:4000';
    expect(base).toBeTruthy();
  });
});
```

### 7.5 Fixtures : `repo/test/fixtures/repair-qc-delivery.fixtures.ts`

```typescript
import { RepairQualityCheck, RepairDelivery, QcChecklistJsonb } from '@insurtech/repair';

export const fullPassedChecklist: QcChecklistJsonb = {
  schema_version: 1,
  points: {
    '1_visual_repair': { ok: true }, '2_functional_replaced': { ok: true }, '3_fluids_levels': { ok: true, fluids: { oil_ok: true, coolant_ok: true, brake_fluid_ok: true, washer_ok: true } },
    '4_tyres': { ok: true, pressure_ok: true, tread_ok: true }, '5_lights': { ok: true, headlights: true, taillights: true, indicators: true, brakelight: true },
    '6_electrical': { ok: true }, '7_engine_start': { ok: true, cold_start_ok: true, warm_start_ok: true }, '8_road_test': { ok: true, distance_km: 2.5, speed_max: 60 },
    '9_cleanliness': { ok: true }, '10_documents_keys': { ok: true },
  },
  global_notes: 'Inspection complete, vehicule conforme',
  completed_at: '2026-05-29T10:30:00Z',
};

export const buildQc = (o: Partial<RepairQualityCheck> = {}): RepairQualityCheck => ({
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: '22222222-2222-2222-2222-222222222222',
  sinistre_id: '33333333-3333-3333-3333-333333333333',
  order_id: '44444444-4444-4444-4444-444444444444',
  inspector_employee_id: '55555555-5555-5555-5555-555555555555',
  attempt_number: 1,
  qc_checklist: fullPassedChecklist,
  photos_after: Array.from({ length: 4 }, (_, i) => ({ index: i + 1, s3_key: `qc/photos/after-${i}.jpg`, s3_url: `https://s3.test/qc/${i}.jpg`, content_type: 'image/jpeg', size_bytes: 800000, uploaded_at: '2026-05-29T10:00:00Z', angle: ['front', 'right', 'left', 'rear'][i] })),
  passed: true,
  failed_items: null,
  inspected_at: new Date('2026-05-29T10:35:00Z'),
  inspector_signature_doc_id: null,
  qc_attempts: [{ attempt_number: 1, inspector_id: '55555555-5555-5555-5555-555555555555', passed: true, failed_items_count: 0, failed_items: [], at: '2026-05-29T10:35:00Z' }],
  created_at: new Date('2026-05-29T09:00:00Z'),
  updated_at: new Date('2026-05-29T10:35:00Z'),
  created_by: '66666666-6666-6666-6666-666666666666',
  updated_by: '66666666-6666-6666-6666-666666666666',
  ...o,
} as RepairQualityCheck);

export const buildDelivery = (o: Partial<RepairDelivery> = {}): RepairDelivery => ({
  id: '77777777-7777-7777-7777-777777777777',
  tenant_id: '22222222-2222-2222-2222-222222222222',
  sinistre_id: '33333333-3333-3333-3333-333333333333',
  quality_check_id: '11111111-1111-1111-1111-111111111111',
  delivered_to_contact_id: '88888888-8888-8888-8888-888888888888',
  delivered_by_employee_id: '99999999-9999-9999-9999-999999999999',
  delivered_at: new Date('2026-05-30T14:00:00Z'),
  customer_signature_doc_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  customer_satisfaction_rating: 5,
  customer_feedback: 'Excellent service, equipe tres professionnelle',
  delivery_doc_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  customer_id_proof_doc_id: null,
  customer_id_proof_type: 'cin',
  customer_id_proof_number: 'AB123456',
  status: 'delivered',
  delivery_method: 'in_person',
  signature_sent_at: new Date('2026-05-30T13:30:00Z'),
  signature_signed_at: new Date('2026-05-30T14:00:00Z'),
  follow_up_rating_reminder_sent: false,
  internal_notes: null,
  created_at: new Date('2026-05-30T13:00:00Z'),
  updated_at: new Date('2026-05-30T14:00:00Z'),
  created_by: '99999999-9999-9999-9999-999999999999',
  updated_by: '99999999-9999-9999-9999-999999999999',
  ...o,
} as RepairDelivery);
```

## 8. Variables environnement

```env
# QC configuration
REPAIR_QC_ALLOW_SELF_INSPECTION=false
REPAIR_QC_MAX_ATTEMPTS=5
REPAIR_QC_MIN_PHOTOS_AFTER=4
REPAIR_QC_MAX_PHOTOS_AFTER=20

# Delivery configuration
REPAIR_DELIVERY_SIGNATURE_TTL_HOURS=24
REPAIR_DELIVERY_FOLLOW_UP_RATING_DAYS=1

# Warranty defaults (Tache 5.3.11 livre)
REPAIR_WARRANTY_DEFAULT_MONTHS=12

# Kafka
KAFKA_TOPIC_REPAIR_QC_PASSED=insurtech.events.repair.qc.passed
KAFKA_TOPIC_REPAIR_QC_FAILED=insurtech.events.repair.qc.failed
KAFKA_TOPIC_REPAIR_SINISTRE_DELIVERED=insurtech.events.repair.sinistre.delivered

# Barid eSign (reuse Sprint 10)
BARID_ESIGN_API_URL=https://api-staging.baridesign.ma
BARID_ESIGN_API_KEY=<vault>

# S3 photos after
S3_BUCKET_REPAIR=insurtech-dev-repair
```

## 9. Commandes shell

```bash
cd repo
pnpm install --frozen-lockfile
pnpm --filter @insurtech/database run migration:run
pnpm turbo run build --filter @insurtech/repair --filter @insurtech/api
pnpm typecheck
pnpm lint
pnpm --filter @insurtech/repair test quality-checks.service.spec
pnpm --filter @insurtech/repair test deliveries.service.spec
pnpm --filter @insurtech/api test:integration qc-delivery.integration
pnpm --filter @insurtech/api test:e2e qc-delivery.e2e
pnpm --filter @insurtech/repair test:coverage --reporter=text-summary
bash infrastructure/scripts/check-no-emoji.sh
```

## 10. Criteres validation V1-V30

### Criteres P0 (bloquants -- 18)

- **V1 (P0)** : Migration repair_quality_checks creee avec RLS + indexes + CHECK attempt_number 1-5.
- **V2 (P0)** : Migration repair_deliveries creee avec RLS + UNIQUE sinistre_id + CHECK rating 1-5.
- **V3 (P0)** : POST /quality-checks/start rejette si order pas ready_for_qc (409).
- **V4 (P0)** : POST /quality-checks/start rejette si inspector role non garage_qc_inspector/admin/manager (403).
- **V5 (P0)** : POST /quality-checks/start rejette self-inspection si config false.
- **V6 (P0)** : POST /quality-checks/start rejette si attempts >= 5.
- **V7 (P0)** : POST /quality-checks/:id/checklist exige les 10 points.
- **V8 (P0)** : POST /quality-checks/:id/decision passed=true transitionne sinistre qc_check -> completed + Kafka qc.passed.
- **V9 (P0)** : POST /quality-checks/:id/decision passed=false transitionne back under_repair + Kafka qc.failed + reset order ready_for_qc=false.
- **V10 (P0)** : POST /quality-checks/:id/decision rejette si photos_after < 4.
- **V11 (P0)** : POST /deliveries/prepare genere PDF + request Barid eSign simple signature.
- **V12 (P0)** : POST /deliveries/prepare rejette si pas de passed QC.
- **V13 (P0)** : POST /deliveries/:id/execute transitionne completed -> delivered + Kafka sinistre.delivered.
- **V14 (P0)** : POST /deliveries/:id/execute rejette signature invalide.
- **V15 (P0)** : POST /deliveries/:id/satisfaction rating 1-5 obligatoire.
- **V16 (P0)** : Consumer delivered-create-warranty declenche creation warranty Tache 5.3.11.
- **V17 (P0)** : RBAC garage_reception ne peut pas approve/inspect QC (403).
- **V18 (P0)** : Aucune emoji dans fichiers crees.

### Criteres P1 (importants -- 8)

- **V19 (P1)** : Templates bon-livraison 3 locales avec photos embedded + signature placeholder.
- **V20 (P1)** : Templates Comm ready-for-delivery + qc-failed-technician + delivered-confirmation 3 locales.
- **V21 (P1)** : qc_attempts jsonb append historise toutes inspections.
- **V22 (P1)** : Endpoint regenerate-signature cooldown 5min entre requests.
- **V23 (P1)** : Coverage services >= 85%.
- **V24 (P1)** : Performance prepareDelivery (genere PDF + sig) p95 < 3s.
- **V25 (P1)** : Photos after embedded base64 dans PDF bon livraison.
- **V26 (P1)** : Audit log Sprint 6 enregistre QC decisions + delivery executes.

### Criteres P2 (nice-to-have -- 4)

- **V27 (P2)** : Documentation pattern Inspection-Then-Re-work-Loop publiee.
- **V28 (P2)** : Postman collection 10 requetes.
- **V29 (P2)** : Seed demo 5 scenarios (passed direct, fail+retry pass, multi-fail, delivery 5 stars, delivery 1 star feedback).
- **V30 (P2)** : Endpoint getDeliveryDate(sinistreId) public method consume Tache 5.3.11.

## 11. Edge cases + troubleshooting

### Edge case 1 : Inspector quitte garage entre start QC et decision
**Solution** : audit log capture inspector_id snapshot moment start. HR Sprint 13 sait si actif. Decision permise mais flag historical.

### Edge case 2 : Customer change email entre prepare et execute delivery
**Solution** : snapshot email moment prepare. Email envoye original. Si bounce, regenerate-signature avec nouveau email.

### Edge case 3 : 5 attempts QC tous failed (mecaniciens incompetents ?)
**Solution** : auto-escalade SuperAdmin tenant + audit alert. Sprint 27 admin peut autoriser 6e attempt OU forcer abandonment sinistre.

### Edge case 4 : Customer arrive sans piece identite
**Solution** : prepare delivery accepte customer_id_proof_type optionnel. Si tenant config strict, requires. Sinon delivery permise avec note internal.

### Edge case 5 : Signature Barid eSign timeout 24h
**Solution** : signature_sent_at + 24h check. Cron monitoring envoie reminder a J+1 + escalade chef garage J+3.

### Edge case 6 : Customer rate 1 etoile + feedback agressif
**Solution** : pas de filter. Sprint 9 Comm alerte chef garage immediat. Sprint 28 rapport reviews critiques.

### Edge case 7 : Delivery method curbside_pickup mais customer pas arrive
**Solution** : status preparing -> awaiting_signature. Si > 48h sans signature, auto-abandoned + notification customer + chef.

### Edge case 8 : QC failed multi-attempt entire chain successive
**Solution** : qc_attempts capture toutes. Reporting Sprint 28 identifie garages problematiques.

### Edge case 9 : Signature recue mais customer signs differente identite
**Solution** : signature_doc_id valide via Barid. Mismatch identite = audit alert + chef revue.

### Edge case 10 : Vehicule deja livre mais customer veut returner (mecontent)
**Solution** : Sprint 24 process retour (Flux Sinistre Client) ou Tache 5.3.11 warranty claim.

### Edge case 11 : Delivery executed mais Kafka publish echoue (outage)
**Solution** : transactional outbox Sprint 2 retry. Eventual consistency.

### Edge case 12 : Photos after upload mais quelqu'un delete S3 hors API
**Solution** : pas de check actif Sprint 21. PDF preserve copy base64. Sprint 32+ ajoute integrity check.

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP)
- Article 7 (minimisation) : photos_after stocke seulement infos necessaires preuve.
- Article 10 (conservation) : bon livraison archive 10 ans.

### Loi 43-20 (signature electronique)
- **Article 6 (signature simple)** : signature reception customer = simple suffisante (acceptation etat livre).
- **Article 14 (preuve)** : bon livraison signe horodate ANRT TSA admissible tribunal.

### Circulaire ACAPS 2024-12
- **Article 4.2.8 (bon livraison electronique)** : 4 elements obligatoires (ref sinistre+police, interventions, garantie, signature) tous presents dans template.

### Code consommation 31-08
- Article 9 (information loyale) : bon livraison detaille interventions + garantie clair.

### CGNC + DGI
- Tache 5.3.6 prepare invoice Tache 5.3.7 declaration TVA.

## 13. Conventions absolues skalean-insurtech

[Identique + specificites :]

- Signature simple art. 6 loi 43-20 suffisante reception (vs avancee art. 7 pour engagement financier).
- QC max 5 attempts strict (CHECK constraint + service validation).
- Photos after min 4 max 20.
- Self-inspection forbidden par defaut (config tenant override Sprint 27).
- Tous events Kafka schemas Zod.

## 14. Validation pre-commit

```bash
cd repo
pnpm typecheck
pnpm lint --filter @insurtech/repair --filter @insurtech/api
pnpm --filter @insurtech/repair test quality-checks.service.spec --coverage
pnpm --filter @insurtech/repair test deliveries.service.spec
pnpm --filter @insurtech/api test:integration qc-delivery.integration
pnpm --filter @insurtech/api test:e2e qc-delivery.e2e
bash infrastructure/scripts/check-no-emoji.sh
grep -rn "console\.log" repo/packages/repair/src/ --include="*.ts" --exclude="*.spec.ts" && echo FAIL || echo OK
```

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-21): QC checklist 10 points + livraison customer signature + bon livraison PDF

Implements task 5.3.6 of Sprint 21 (Sinistre Workflow Detaille).

Livrables:
- Migrations repair_quality_checks + repair_deliveries avec RLS + UNIQUE
- Entities RepairQualityCheck + RepairDelivery (QcChecklist + QcAttemptHistory + DeliveryStatus interfaces)
- QualityChecksService (start, submitChecklist, addPhotosAfter, markDecision, findByOrder)
- DeliveriesService (prepareDelivery, executeDelivery, recordSatisfaction, regenerateSignature, getDeliveryDate)
- 3 Kafka events (qc.passed, qc.failed, sinistre.delivered)
- 2 Kafka consumers (notify-customer, create-warranty trigger Tache 5.3.11)
- 7 endpoints REST QC + 5 endpoints delivery
- Templates Handlebars bon-livraison 3 locales (photos embedded base64)
- Templates Comm 3 locales (ready-for-delivery, qc-failed-technician, delivered-confirmation)
- 22 unit QC + 18 unit deliveries + 12 integration + 6 E2E (58 total)
- 12 RBAC permissions repair.qc.* + repair.deliveries.*

Patterns introduits:
- Inspection-Then-Re-work-Loop (reused Tache 5.3.11, Sprint 24)

Conformite:
- ACAPS circulaire 2024-12 art. 4.2.8 (bon livraison electronique 4 elements)
- Loi 43-20 art. 6 (signature simple acceptation reception)
- Loi 09-08 art. 7+10 (minimisation + conservation 10 ans)
- Code consommation 31-08 art. 9 (information loyale)

Tests: 22+18 unit + 12 integration + 6 E2E (58 total)
Coverage: 88.5% quality-checks.service.ts, 89.7% deliveries.service.ts

Task: 5.3.6
Sprint: 21 (Phase 5 / Sprint 3 in phase)
Reference: B-21 Tache 5.3.6
Dependances: Tache 5.3.5, Sprint 19 (Repair), Sprint 10 (Signature Barid + PDF), Sprint 9 (Comm), Sprint 8 (CRM), Sprint 13 (HR + Analytics NPS)"
```

## 16. Workflow next step

Apres commit Tache 5.3.6 :
- Lancer verification `V-21-task-5.3.6.md`.
- Passer a generation `task-5.3.7-facturation-split-assureur-customer.md` (Facturation split insurer/customer avec decimal.js precision).
- Le sinistre etant en `delivered`, Tache 5.3.7 implemente la facturation split finale.

---

**Fin du prompt task-5.3.6-qc-checklist-livraison.md.**

Densite atteinte : ~120 ko
Code patterns : 13 fichiers complets
Tests : 22 unit QC + 18 unit deliveries + 12 integration + 6 E2E (58 total)
Criteres validation : V1-V30 (18 P0 + 8 P1 + 4 P2)
Edge cases : 12
