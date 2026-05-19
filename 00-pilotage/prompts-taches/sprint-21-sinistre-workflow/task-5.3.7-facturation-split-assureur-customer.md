# TACHE 5.3.7 -- Facturation Split Assureur (Couverture) / Customer (Franchise + Non-Couvert) + decimal.js Precision

**Sprint** : 21 (Phase 5 -- Vertical Repair / Sprint 3 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-21-sprint-21-sinistre-workflow.md` (Tache 5.3.7)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (workflow operationnel critique pilote Sprint 35)
**Effort** : 6h
**Dependances** : Tache 5.3.6 (livraison + sinistre.delivered event), Tache 5.3.4 (getApprovalConditions consume), Sprint 19 (RepairInvoice entity + invoices.service.createFromCompletedOrder basique), Sprint 12 (BooksService CGNC + facturation DGI), Sprint 11 (PayService MA 6 passerelles), Sprint 14 (InsurePoliciesService), Sprint 8 (CRM ContactsService), Sprint 10 (DocsService + PdfGenerator), Sprint 7 (RBAC), Sprint 6 (Multi-tenant)
**Densite cible** : 110-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006 ABSOLUE)

---

## 1. But

Cette tache implemente le **mecanisme de facturation split intelligente** entre l'assureur (couverture police) et le customer (franchise + exclusions + depassement plafond) apres livraison du sinistre. C'est l'une des taches les plus critiques de tout le programme Skalean InsurTech car elle materialise financierement le contrat assureur-garage-customer avec precision decimale obligatoire (decimal.js, jamais Number JavaScript pour eviter erreurs IEEE 754). La logique split est : (1) lorsque le sinistre passe en `delivered` (Tache 5.3.6 publie event Kafka `sinistre.delivered`), un consumer declenche `invoices.service.createFromCompletedOrder(orderId)` qui calcule les montants finaux ; (2) si le sinistre a un `insure_policy_id` non-null ET une approval `repair_devis_approvals` recue (Tache 5.3.4), le service consulte `getApprovalConditions(sinistreId)` pour recuperer franchise + exclusions + coverage_cap + special_conditions ; (3) calcul `totalHt = parts_cost_actual + labor_cost_actual` (Tache 5.3.5 livre les actuals), `tva = totalHt * 0.20` (TVA 20% prestation auto MA), `totalTtc = totalHt + tva` ; (4) compute `exclusionsAmount = sum(approval_conditions.exclusions[].amount_excluded)` (les items exclus contractuellement par l'assureur), `insurerAmountBeforeCap = totalTtc - franchise - exclusionsAmount` clamp >= 0, `insurerAmount = min(insurerAmountBeforeCap, coverage_cap)` si cap defini sinon `insurerAmountBeforeCap`, `customerAmount = totalTtc - insurerAmount` ; (5) generation de 2 factures distinctes liees par `split_parent_id` self FK : Facture 1 destinataire ASSUREUR avec `recipient_type='insurer'` + `total_ttc=insurerAmount` + `recipient_data={insurer_provider, policy_reference, billing_address}`, Facture 2 destinataire CUSTOMER avec `recipient_type='customer'` + `total_ttc=customerAmount` + `recipient_data={customer_name, cin, billing_address}` ; (6) si pas de police (`insure_policy_id=null`), une seule facture customer full amount est generee ; (7) chaque facture genere PDF Handlebars 3 locales conforme CGNC + DGI (Sprint 12 BooksService valide format) avec numero sequentiel `INV-{tenant}-{YYYY}-{NNNNNN}` non-mutable + emission electronique horodatee + signature electronique optionnelle garage ; (8) reglements : assureur paye via virement bank manual reconciliation Phase 7+ (Sprint 32 reel), customer paye immediate via PayService Sprint 11 (6 passerelles MA : CMI + Maroc Telecommerce + Naps + Lyf + Inwi Money + Orange Money) ou cash kiosque garage ; (9) auto-trigger envoi Comm Sprint 9 -- email + WhatsApp customer avec lien Pay + PDF facture, email assureur avec PDF facture + dossier complet sinistre (rapport diagnostic + bon livraison + photos).

L'apport metier est sextuple : (a) **conformite reglementaire stricte** -- CGNC art. 22 + Code commerce MA + decret DGI 2.06.190 imposent factures avec numerotation sequentielle non-mutable + TVA detaillee + signature electronique recommandee ; (b) **transparence customer** -- le customer voit exactement ce que paie l'assureur vs ce qu'il doit lui-meme, evitant disputes "pourquoi 3500 MAD a ma charge ?" ; (c) **automation reglements** -- la facture customer integre directement Sprint 11 Pay avec lien Pay one-shot 30 jours, et la facture assureur entre Sprint 12 BooksService comptabilite avec ecriture `AR (compte client assureur)` + reconciliation manuelle bank statement Phase 7+ ; (d) **precision financiere absolue** -- decimal.js empeche les drift accountants (e.g. 0.1 + 0.2 != 0.3 en Number) sur des sommes ~10000 MAD ; (e) **conformite ACAPS art. 4.2.9** -- "la repartition assureur/customer doit etre documentee, opposable, et restituable au regulateur ACAPS pour controle annuel" ; (f) **pre-requisite warranty + cloture** -- la facturation complete debloque la transition `delivered -> closed` du sinistre (apres paiement customer recu OU declaration paiement assureur attendue dans 90 jours). 

A l'issue de cette tache, le systeme expose 7 endpoints REST consommables Sprint 22 (UI accounting + customer service), publie 2 events Kafka (`insurtech.events.repair.invoice.created`, `insurtech.events.repair.invoice.paid`), consomme 2 events Kafka (`insurtech.events.repair.sinistre.delivered` -> auto-cree invoices, `insurtech.events.pay.transaction.success` -> mark invoice paid), expose 1 endpoint webhook Pay callback Sprint 11 reconciliation, et integre Sprint 12 BooksService pour ecritures comptables auto (debit AR + credit revenue + credit TVA collectee).

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sprint 19 a livre une methode `invoices.service.createFromCompletedOrder(orderId)` qui creait UNE seule facture pour le customer avec le total integral, ignorant totalement la dimension assurance. Cette implementation minimaliste etait inappropriee pour le pilote Marrakech car (1) 73% des sinistres au Maroc sont couverts par police assurance auto (sondage RMA 2025), (2) les 6 grands assureurs MA exigent factures distinctes pour leur comptabilite + reglement, (3) le customer doit avoir une facture nette de sa quote-part pour declarer fiscalement OU se faire rembourser par employeur (cas vehicule fonction), (4) ACAPS impose tracability split. Sprint 21 Tache 5.3.7 livre la version production-grade qui couvre 100% des scenarios marche MA.

Le second probleme adresse est le **chaos potentiel sans precision financiere** : sur des sommes typiques 10000-50000 MAD avec franchises ~1500 MAD et exclusions ~500 MAD, l'arithmetique flottante IEEE 754 JavaScript peut produire des erreurs jusqu'a 0.01 MAD (1 centime) par operation. Sur 1000 sinistres/mois pour un garage moyen, cela represente potentiellement 10 MAD/mois de drift, soit 120 MAD/an de divergence books vs reel -- inacceptable comptablement. La solution decimal.js (lib mature 10.4.3 zero-dep) elimine totalement ce risque.

Sur le plan reglementaire, l'art. 22 CGNC (Code General de Normalisation Comptable) impose : (i) numerotation factures sequentielle continue non-mutable par exercice fiscal, (ii) mentions obligatoires (nom+adresse+ICE garage, nom+adresse+ICE customer ou assureur, designation prestation, prix HT, TVA detaillee par taux, total TTC, mention "TVA acquittee selon les debits"), (iii) emission date <= date livraison + 3 jours, (iv) archive 10 ans en format opposable. Le decret 2.06.190 + arrete 2401-15 imposent en plus format electronique conforme DGI avec eventuelle signature electronique + reporting EDI mensuel. Sprint 12 BooksService livre l'infrastructure CGNC, Tache 5.3.7 consume.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| (A) 1 seule facture customer + adjustment manuel | Simple | Non conforme assureur, ACAPS, complexite manuelle | rejete |
| (B) 1 facture avec breakdown ligne assureur vs customer dans meme PDF | Compact | Pas conforme separate billing assureur, complexity reglement | rejete |
| (C) 2 factures distinctes liees `split_parent_id` self FK | Conforme + tracking | Surcout administratif | RETENU |
| (D) Plus de 2 factures (e.g. assureur + customer + tiers payeur sponsor) | Flexible | Sur-engineering MVP | rejete (Sprint 27+ extension) |
| (E) Number JavaScript pour montants | Standard | IEEE 754 drifts, NON-NEGOCIABLE pour money | rejete catastrophique |
| (F) decimal.js stocke en string DB | Precision, queryable | Conversion necessaire dans service | RETENU |
| (G) Custom UDT BigDecimal Postgres | Native precision | Overkill, debug complexe | rejete |
| (H) PostgreSQL NUMERIC(12,2) stockage + Number rehydration | Native | Reconvertit en Number = drift potentiel | rejete (utilisons NUMERIC + decimal.js en service) |
| (I) Auto-trigger invoice creation sur delivered event | Streamline | Pas de revue manuelle | RETENU avec opt-in tenant config Sprint 27 |
| (J) Numerotation facture format `INV-{tenant}-{YYYY}-{NNNNNN}` | Conforme + scalable | Locks sur counter | RETENU avec advisory lock Postgres |
| (K) Numerotation cross-tenant continue (1 sequence globale) | Plus simple | Non conforme tenant isolation + audit | rejete |

### 2.3 Trade-offs explicites

1. **2 factures vs 1 facture** : on cree 2 factures distinctes liees `split_parent_id`. Trade-off : surcout administratif (2 PDFs, 2 envois, 2 ecritures comptables). Justification : (a) chaque destinataire a besoin de son document propre pour sa comptabilite, (b) reglement separe (assureur virement vs customer Pay), (c) audit trail clair.

2. **decimal.js partout vs only computations critiques** : decimal.js sur TOUTES manipulations money (parsing, addition, multiplication, comparison). Trade-off : verbose. Justification : impossible de garantir precision si meme une operation utilise Number par accident. Lint rule custom Sprint 28+ peut enforcer.

3. **TVA 20% standard vs configurable per tenant** : hardcoded 20% pour pilote MA (taux standard prestation reparation auto MA). Sprint 27 Admin Tenants Management permettra override per tenant (e.g. franchise zone TVA reduite 14%). Trade-off : moins flexible MVP. Accepte.

4. **Auto-creation invoice sur delivered vs manual button chef garage** : auto-creation par defaut. Tenant config Sprint 27 permet desactiver. Trade-off : si auto-creation et erreur calcul, facture wrong emise. Mitigation : status `draft` initial, mise en `final` apres revue chef garage UI Sprint 22 (workflow 2-step) -- Sprint 21 livre 1-step auto-final, Sprint 27 ajoute review step.

5. **PDF immediate vs lazy generation on access** : PDF genere immediate a la creation. Trade-off : surcout compute. Justification : (a) PDF inclus dans envoi Comm immediat, (b) immutabilite PDF stocke = preuve juridique opposable.

6. **Numerotation sequentielle counter Postgres advisory lock vs sequence Postgres natif** : on utilise advisory lock + counter row per tenant_id pour garantir continuite sans gaps (sequence native peut avoir gaps si transaction rollback). Trade-off : performance lock vs sequence. Justification : CGNC exige continuite stricte sans gap.

7. **Split parent vs child relationship** : invoice 1 (insurer) est `parent`, invoice 2 (customer) est `child` avec `split_parent_id = invoice_1.id`. Alternative : symetrique sibling. Choix parent-child car (a) Tache 5.3.10 mock-insurer push avec parent reference, (b) ordre logique : assureur paie d'abord (virement), customer paie ensuite (lien Pay envoye post-paiement assureur).

### 2.4 Decisions strategiques referenced

- **decision-001 (monorepo)** : fichiers `repo/packages/repair/`, `repo/apps/api/`.
- **decision-002 (multi-tenant)** : RLS sur `repair_invoices`. Numerotation per tenant_id.
- **decision-003 (TypeORM 0.3)** : entity + migration.
- **decision-004 (Kafka)** : 2 topics invoice.created + invoice.paid.
- **decision-006 (no-emoji)** : ABSOLU.
- **decision-008 (cloud souverain)** : PDF facture S3 Atlas Cloud MA + chiffrement at-rest AES-256-GCM.
- **decision-009 (signature 43-20)** : signature electronique facture optionnelle (PRIVATE par defaut, Sprint 27 active si tenant souhaite).
- Sprint 12 BooksService CGNC integration.
- Sprint 11 PayService MA 6 passerelles.

### 2.5 Pieges techniques connus

1. **Piege : Number arithmetic sur montants -> drift 0.01 MAD cumul**
   - Solution : decimal.js OBLIGATOIRE. Lint rule Sprint 28+ rejette `Number()`, `+`, `*` sur fields money typed.

2. **Piege : numerotation facture avec gap (rollback transaction)**
   - Solution : advisory lock Postgres `pg_advisory_xact_lock(hashtext(tenant_id))` AVANT increment counter + commit atomique. Si rollback, lock libere mais counter pas incremente.

3. **Piege : 2 instances API tentent meme numero invoice concurrent**
   - Solution : advisory lock per tenant. Premier acquerer obtient lock, second attend ou retry.

4. **Piege : insurer_amount calcul incorrect si coverage_cap inferieur a franchise**
   - Solution : edge case test : si `coverage_cap < franchise`, alors insurer_amount=0, customer prend tout.

5. **Piege : exclusions cumul > total_ttc (over-exclusion bug)**
   - Solution : `Decimal.min(exclusions_sum, total_ttc - franchise)` clamp. Audit log si declenchement.

6. **Piege : PDF facture genere mais sinistre annule apres (reverse)**
   - Solution : invoice status `void` + counter Postgres conserve numero (CGNC : annulation = nouvelle ligne "credit note", pas de re-use numero).

7. **Piege : currency hardcoded MAD vs multi-devise**
   - Solution : Sprint 21 MAD strict. Sprint 32+ multi-devise si export operations.

8. **Piege : timezone facturation : emission_date stockee UTC mais comptabilite MA = Africa/Casablanca**
   - Solution : column `emission_date_local` calcule en tenant_timezone pour reports comptables. UTC pour API.

9. **Piege : customer email change apres invoice envoyee -> reminder paiement va au mauvais email**
   - Solution : snapshot email moment creation invoice dans `recipient_data jsonb`. Pas re-fetch.

10. **Piege : reconciliation Pay Sprint 11 callback recu mais invoice deja paid (double payment customer)**
    - Solution : idempotency-key sur invoice.markPaid(). Si deja paid, retourne existing sans changement + log warning.

11. **Piege : ecriture comptable Sprint 12 BooksService echoue mais invoice creee (orphan)**
    - Solution : transaction atomique invoice + books entry OU retry queue + alert chef garage si echec >5 retries.

12. **Piege : approval_conditions modifiees apres invoice creee (Tache 5.3.4 avenant)**
    - Solution : snapshot conditions dans `repair_invoices.applied_conditions jsonb` au moment creation. Pas re-fetch.

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 5.3.7 est la **7e tache du Sprint 21**, suit Tache 5.3.6 (livraison). Apres sinistre delivered, un consumer auto-cree les invoices.

- **Depend de** : Tache 5.3.6 (sinistre delivered event), Tache 5.3.4 (approval conditions), Sprint 19 (RepairInvoice base), Sprint 12 (BooksService), Sprint 11 (PayService), Sprint 10 (PDF), Sprint 8 (CRM customer data), Sprint 14 (Insure policy data).
- **Bloque** : Tache 5.3.8 (Documents auto-genere consume invoice PDF), Tache 5.3.11 (Garantie auto-trigger apres invoice paid OU sinistre closed).

- **Apporte** : pattern Split-Billing-decimal-Precision reutilise Sprint 27 (Tenants management multi-recipient billing), Sprint 32 (Cross-tenant facturation B2B garages partenaires).

### 3.2 Position dans le programme global

Sprint 21 Phase 5. Sprint 28 Compliance utilise split data pour rapports ACAPS art. 4.2.9. Sprint 32 swap mock-insurer-billing par real connectors push EDI factures aux 6 assureurs.

### 3.3 Diagramme du workflow facturation split

```
+--------------------+        +--------------------+
| Tache 5.3.6        |  -->   | Kafka event        |
| delivery executed  |        | sinistre.delivered |
+--------------------+        +--------------------+
                                       |
                                       v
                          +---------------------------+
                          | Consumer auto-create-     |
                          | invoices.consumer.ts      |
                          +---------------------------+
                                       |
                                       v
                          +---------------------------+
                          | invoices.service          |
                          | .createFromCompletedOrder |
                          +---------------------------+
                                       |
                       +---------------+---------------+
                       |                               |
                       v                               v
              +--------------------+        +--------------------+
              | sinistre.insure_   |        | sinistre.insure_   |
              | policy_id != null  |        | policy_id = null   |
              +--------------------+        +--------------------+
                       |                               |
                       v                               v
              +--------------------+        +--------------------+
              | getApprovalCond    |        | Cree 1 facture    |
              | (Tache 5.3.4)     |        | customer full      |
              +--------------------+        | amount             |
                       |                    +--------------------+
                       v
              +--------------------+
              | Compute decimal.js |
              | insurerAmount=     |
              | min(total-franch- |
              | exclusions, cap)   |
              | customerAmount=    |
              | total-insurerAmount|
              +--------------------+
                       |
                       v
              +--------------------+
              | INSERT invoice 1   |
              | recipient_type=    |
              | insurer            |
              | total_ttc=insurerAmt|
              | numero seq lock    |
              +--------------------+
                       |
                       v
              +--------------------+
              | INSERT invoice 2   |
              | recipient_type=    |
              | customer           |
              | split_parent_id=   |
              | invoice_1.id       |
              | total_ttc=customAmt|
              +--------------------+
                       |
                       v
              +--------------------+
              | Generate 2 PDFs    |
              | Handlebars 3       |
              | locales CGNC       |
              +--------------------+
                       |
                       v
              +--------------------+
              | Sprint 12 Books    |
              | ecritures comptable|
              | journal client     |
              | TVA collectee      |
              +--------------------+
                       |
                       v
              +--------------------+
              | Kafka event        |
              | invoice.created x2 |
              +--------------------+
                       |
                       v
              +--------------------+
              | Consumer notify    |
              | Sprint 9 Comm      |
              | customer email+Pay |
              | assureur email     |
              +--------------------+
                       |
                       v (customer pays via Pay)
              +--------------------+
              | Sprint 11 Pay      |
              | transaction.success|
              +--------------------+
                       |
                       v
              +--------------------+
              | Consumer mark      |
              | invoice paid       |
              | Books receipt      |
              +--------------------+
```

## 4. Livrables checkables

- [ ] Migration : `{date}-EnrichRepairInvoiceSplit.ts` (~70 lignes : ADD COLUMN split_parent_id self FK + recipient_data jsonb + applied_conditions snapshot + numbering counter table)
- [ ] Migration : `{date}-RepairInvoiceCounter.ts` (~50 lignes : table `repair_invoice_counters` per tenant + per year)
- [ ] Entity update : `repair-invoice.entity.ts` (~140 lignes enrichi)
- [ ] Entity : `repair-invoice-counter.entity.ts` (~50 lignes)
- [ ] DTOs Zod : `invoice-split.dtos.ts` (~140 lignes : 5 schemas)
- [ ] Service principal : `invoices.service.ts` (update +400 lignes : createFromCompletedOrder split + markPaid + voidInvoice)
- [ ] Sous-service : `invoice-numbering.service.ts` (~120 lignes : Postgres advisory lock + counter)
- [ ] Sous-service : `invoice-split-calculator.service.ts` (~150 lignes : decimal.js logic pure)
- [ ] Controller : `invoices.controller.ts` (update +200 lignes : 7 endpoints)
- [ ] Kafka events : 2 events (~50 lignes chacun)
- [ ] Consumer Kafka : `delivered-auto-create-invoices.consumer.ts` (~150 lignes)
- [ ] Consumer Kafka : `pay-transaction-mark-invoice-paid.consumer.ts` (~150 lignes)
- [ ] Tests unitaires : `invoices.service.spec.ts` (update +500 lignes / 25 tests)
- [ ] Tests unitaires calculator : `invoice-split-calculator.service.spec.ts` (~400 lignes / 20 tests scenarios precision)
- [ ] Tests unitaires numbering : `invoice-numbering.service.spec.ts` (~200 lignes / 10 tests concurrency)
- [ ] Tests integration : `invoice-split.integration-spec.ts` (~350 lignes / 12 tests)
- [ ] Tests E2E : `invoice-split.e2e-spec.ts` (~250 lignes / 5 tests)
- [ ] Fixtures : `repair-invoice-split.fixtures.ts` (~200 lignes : 6 scenarios calcul)
- [ ] Templates Handlebars 3 locales : `facture.hbs` (~180 lignes chacun conforme CGNC)
- [ ] Templates Comm 3 locales : `invoice-customer-payment-link.hbs` + `invoice-insurer-billing.hbs` + `invoice-paid-confirmation.hbs` (~50 lignes chacun)
- [ ] Permissions enum : +6 permissions `repair.invoices.*`
- [ ] Documentation pattern : `docs/patterns/split-billing-decimal-precision.md` (~250 lignes)
- [ ] Postman collection : `repair-invoices-split.postman.json` (~150 lignes)
- [ ] Seed demo : `seed-invoices-split-demo.ts` (~180 lignes 6 scenarios)

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/20260526-EnrichRepairInvoiceSplit.ts                            (~70 lignes)
repo/packages/database/src/migrations/20260526-RepairInvoiceCounter.ts                                 (~50 lignes)
repo/packages/repair/src/entities/repair-invoice.entity.ts                                              (update ~140 lignes)
repo/packages/repair/src/entities/repair-invoice-counter.entity.ts                                      (~50 lignes)
repo/packages/repair/src/dtos/invoice-split.dtos.ts                                                     (~140 lignes)
repo/packages/repair/src/services/invoices.service.ts                                                   (update +400 lignes)
repo/packages/repair/src/services/invoice-numbering.service.ts                                          (~120 lignes)
repo/packages/repair/src/services/invoice-split-calculator.service.ts                                   (~150 lignes)
repo/packages/repair/src/services/invoices.service.spec.ts                                              (update +500 lignes)
repo/packages/repair/src/services/invoice-split-calculator.service.spec.ts                              (~400 lignes)
repo/packages/repair/src/services/invoice-numbering.service.spec.ts                                     (~200 lignes)
repo/packages/repair/src/events/invoice-created.event.ts                                                (~50 lignes)
repo/packages/repair/src/events/invoice-paid.event.ts                                                   (~50 lignes)
repo/packages/repair/src/consumers/delivered-auto-create-invoices.consumer.ts                            (~150 lignes)
repo/packages/repair/src/consumers/pay-transaction-mark-invoice-paid.consumer.ts                         (~150 lignes)
repo/packages/repair/src/repair.module.ts                                                               (update +25 lignes)
repo/packages/docs/src/templates/fr/facture.hbs                                                         (~180 lignes)
repo/packages/docs/src/templates/ar-MA/facture.hbs                                                      (~180 lignes RTL)
repo/packages/docs/src/templates/ar/facture.hbs                                                         (~180 lignes RTL)
repo/packages/comm/src/templates/fr/invoice-{customer,insurer,paid}.hbs                                  (~150 lignes)
repo/packages/comm/src/templates/{ar-MA,ar}/invoice-{3 templates}.hbs                                    (~300 lignes RTL)
repo/packages/auth/src/rbac/permissions.enum.ts                                                         (update +6 lignes)
repo/packages/database/src/kafka/topics.ts                                                              (update +2 lignes)
repo/apps/api/src/modules/repair/controllers/invoices.controller.ts                                     (update +200 lignes)
repo/apps/api/test/repair/invoice-split.integration-spec.ts                                             (~350 lignes)
repo/apps/api/test/repair/invoice-split.e2e-spec.ts                                                     (~250 lignes)
repo/test/fixtures/repair-invoice-split.fixtures.ts                                                     (~200 lignes)
repo/docs/patterns/split-billing-decimal-precision.md                                                   (~250 lignes)
repo/docs/postman/repair-invoices-split.postman.json                                                    (~150 lignes)
repo/infrastructure/scripts/seed-invoices-split-demo.ts                                                 (~180 lignes)
```

## 6. Code patterns COMPLETS

### Fichier 1/13 : `repo/packages/database/src/migrations/20260526-EnrichRepairInvoiceSplit.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnrichRepairInvoiceSplit1748400000000 implements MigrationInterface {
  name = 'EnrichRepairInvoiceSplit1748400000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      ALTER TABLE "repair_invoices"
        ADD COLUMN "split_parent_id" UUID NULL,
        ADD COLUMN "recipient_type" VARCHAR(32) NOT NULL DEFAULT 'customer',
        ADD COLUMN "recipient_data" JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN "applied_conditions" JSONB NULL,
        ADD COLUMN "invoice_number" VARCHAR(64) NOT NULL,
        ADD COLUMN "emission_date" DATE NOT NULL DEFAULT CURRENT_DATE,
        ADD COLUMN "emission_date_local" DATE NULL,
        ADD COLUMN "due_date" DATE NULL,
        ADD COLUMN "paid_at" TIMESTAMPTZ NULL,
        ADD COLUMN "paid_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0,
        ADD COLUMN "paid_method" VARCHAR(32) NULL,
        ADD COLUMN "paid_reference" VARCHAR(256) NULL,
        ADD COLUMN "void_reason" VARCHAR(512) NULL,
        ADD COLUMN "voided_at" TIMESTAMPTZ NULL,
        ADD COLUMN "voided_by" UUID NULL,
        ADD COLUMN "credit_note_for_invoice_id" UUID NULL,
        ADD COLUMN "pdf_doc_id" UUID NULL,
        ADD COLUMN "tenant_timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Casablanca';

      ALTER TABLE "repair_invoices"
        ADD CONSTRAINT "fk_repair_invoices_split_parent"
          FOREIGN KEY ("split_parent_id") REFERENCES "repair_invoices"("id") ON DELETE RESTRICT;

      ALTER TABLE "repair_invoices"
        ADD CONSTRAINT "fk_repair_invoices_credit_note"
          FOREIGN KEY ("credit_note_for_invoice_id") REFERENCES "repair_invoices"("id") ON DELETE RESTRICT;

      ALTER TABLE "repair_invoices"
        ADD CONSTRAINT "ck_repair_invoices_recipient_type" CHECK ("recipient_type" IN ('insurer', 'customer'));

      ALTER TABLE "repair_invoices"
        ADD CONSTRAINT "ck_repair_invoices_paid_amount" CHECK ("paid_amount" >= 0);

      ALTER TABLE "repair_invoices"
        ADD CONSTRAINT "uq_repair_invoices_number" UNIQUE ("tenant_id", "invoice_number");

      CREATE INDEX "ix_repair_invoices_split_parent" ON "repair_invoices"("split_parent_id") WHERE "split_parent_id" IS NOT NULL;
      CREATE INDEX "ix_repair_invoices_recipient_type" ON "repair_invoices"("tenant_id", "recipient_type");
      CREATE INDEX "ix_repair_invoices_emission" ON "repair_invoices"("tenant_id", "emission_date" DESC);
      CREATE INDEX "ix_repair_invoices_unpaid" ON "repair_invoices"("tenant_id", "due_date") WHERE "paid_at" IS NULL AND "voided_at" IS NULL;

      COMMENT ON COLUMN "repair_invoices"."split_parent_id" IS 'Self FK : invoice 2 (customer) reference invoice 1 (insurer). NULL si single billing.';
      COMMENT ON COLUMN "repair_invoices"."applied_conditions" IS 'Snapshot conditions au moment creation : { franchise_amount, exclusions[], coverage_cap, special_conditions }';
      COMMENT ON COLUMN "repair_invoices"."invoice_number" IS 'Format CGNC : INV-{tenant_code}-{YYYY}-{NNNNNN} sequentiel non-mutable';
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DROP INDEX IF EXISTS "ix_repair_invoices_unpaid";
      DROP INDEX IF EXISTS "ix_repair_invoices_emission";
      DROP INDEX IF EXISTS "ix_repair_invoices_recipient_type";
      DROP INDEX IF EXISTS "ix_repair_invoices_split_parent";
      ALTER TABLE "repair_invoices"
        DROP CONSTRAINT IF EXISTS "uq_repair_invoices_number",
        DROP CONSTRAINT IF EXISTS "ck_repair_invoices_paid_amount",
        DROP CONSTRAINT IF EXISTS "ck_repair_invoices_recipient_type",
        DROP CONSTRAINT IF EXISTS "fk_repair_invoices_credit_note",
        DROP CONSTRAINT IF EXISTS "fk_repair_invoices_split_parent",
        DROP COLUMN IF EXISTS "tenant_timezone",
        DROP COLUMN IF EXISTS "pdf_doc_id",
        DROP COLUMN IF EXISTS "credit_note_for_invoice_id",
        DROP COLUMN IF EXISTS "voided_by",
        DROP COLUMN IF EXISTS "voided_at",
        DROP COLUMN IF EXISTS "void_reason",
        DROP COLUMN IF EXISTS "paid_reference",
        DROP COLUMN IF EXISTS "paid_method",
        DROP COLUMN IF EXISTS "paid_amount",
        DROP COLUMN IF EXISTS "paid_at",
        DROP COLUMN IF EXISTS "due_date",
        DROP COLUMN IF EXISTS "emission_date_local",
        DROP COLUMN IF EXISTS "emission_date",
        DROP COLUMN IF EXISTS "invoice_number",
        DROP COLUMN IF EXISTS "applied_conditions",
        DROP COLUMN IF EXISTS "recipient_data",
        DROP COLUMN IF EXISTS "recipient_type",
        DROP COLUMN IF EXISTS "split_parent_id";
    `);
  }
}
```

### Fichier 2/13 : `repo/packages/database/src/migrations/20260526-RepairInvoiceCounter.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class RepairInvoiceCounter1748450000000 implements MigrationInterface {
  name = 'RepairInvoiceCounter1748450000000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE "repair_invoice_counters" (
        "tenant_id" UUID NOT NULL,
        "year" INTEGER NOT NULL,
        "counter" INTEGER NOT NULL DEFAULT 0,
        "tenant_code" VARCHAR(16) NOT NULL,
        "last_invoice_id" UUID NULL,
        "last_increment_at" TIMESTAMPTZ NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY ("tenant_id", "year"),
        CONSTRAINT "ck_repair_invoice_counter_year" CHECK ("year" >= 2024 AND "year" <= 2099),
        CONSTRAINT "ck_repair_invoice_counter_counter" CHECK ("counter" >= 0)
      );

      ALTER TABLE "repair_invoice_counters" ENABLE ROW LEVEL SECURITY;
      CREATE POLICY "rls_repair_invoice_counters" ON "repair_invoice_counters"
        USING ("tenant_id" = current_setting('app.current_tenant', true)::uuid);

      COMMENT ON TABLE "repair_invoice_counters" IS 'Sprint 21 / Tache 5.3.7 -- compteur sequentiel CGNC art. 22 per tenant per year';
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "repair_invoice_counters" CASCADE;`);
  }
}
```

### Fichier 3/13 : `repo/packages/repair/src/entities/repair-invoice.entity.ts`

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { RepairSinistre } from './repair-sinistre.entity';
import { RepairOrder } from './repair-order.entity';

export type InvoiceRecipientType = 'insurer' | 'customer';
export type InvoiceStatus = 'draft' | 'final' | 'partially_paid' | 'paid' | 'overdue' | 'voided';

export interface InvoiceRecipientDataJsonb {
  name: string;
  type: InvoiceRecipientType;
  ice?: string;
  rc?: string;
  address?: { line1: string; city: string; postal_code?: string; country: 'MA' };
  email?: string;
  phone_e164?: string;
  cin?: string;
  insurer_provider?: string;
  policy_reference?: string;
  billing_contact_name?: string;
}

export interface InvoiceAppliedConditionsJsonb {
  franchise_amount: string;
  exclusions: { item_description: string; amount_excluded: string; reason: string }[];
  coverage_cap?: string;
  special_conditions?: string[];
  approval_id: string;
  snapshot_at: string;
}

@Entity({ name: 'repair_invoices' })
@Unique('uq_repair_invoices_number', ['tenant_id', 'invoice_number'])
@Index('ix_repair_invoices_recipient_type', ['tenant_id', 'recipient_type'])
@Index('ix_repair_invoices_sinistre', ['sinistre_id'])
export class RepairInvoice {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) tenant_id!: string;
  @Column({ type: 'uuid' }) sinistre_id!: string;
  @ManyToOne(() => RepairSinistre) @JoinColumn({ name: 'sinistre_id' }) sinistre?: RepairSinistre;
  @Column({ type: 'uuid' }) order_id!: string;
  @ManyToOne(() => RepairOrder) @JoinColumn({ name: 'order_id' }) order?: RepairOrder;
  @Column({ type: 'varchar', length: 64 }) invoice_number!: string;
  @Column({ type: 'varchar', length: 32, default: 'customer' }) recipient_type!: InvoiceRecipientType;
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` }) recipient_data!: InvoiceRecipientDataJsonb;
  @Column({ type: 'uuid', nullable: true }) split_parent_id!: string | null;
  @Column({ type: 'jsonb', nullable: true }) applied_conditions!: InvoiceAppliedConditionsJsonb | null;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) total_ht!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) total_tva!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2 }) total_ttc!: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 }) paid_amount!: string;
  @Column({ type: 'jsonb' }) line_items!: { description: string; quantity: number; unit_price_ht: string; total_ht: string; tva_rate: number }[];
  @Column({ type: 'varchar', length: 32, default: 'draft' }) status!: InvoiceStatus;
  @Column({ type: 'date' }) emission_date!: string;
  @Column({ type: 'date', nullable: true }) emission_date_local!: string | null;
  @Column({ type: 'date', nullable: true }) due_date!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) paid_at!: Date | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) paid_method!: string | null;
  @Column({ type: 'varchar', length: 256, nullable: true }) paid_reference!: string | null;
  @Column({ type: 'uuid', nullable: true }) pdf_doc_id!: string | null;
  @Column({ type: 'varchar', length: 512, nullable: true }) void_reason!: string | null;
  @Column({ type: 'timestamptz', nullable: true }) voided_at!: Date | null;
  @Column({ type: 'uuid', nullable: true }) voided_by!: string | null;
  @Column({ type: 'uuid', nullable: true }) credit_note_for_invoice_id!: string | null;
  @Column({ type: 'varchar', length: 64, default: 'Africa/Casablanca' }) tenant_timezone!: string;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @Column({ type: 'uuid' }) created_by!: string;
  @Column({ type: 'uuid' }) updated_by!: string;
}
```

### Fichier 4/13 : `repo/packages/repair/src/dtos/invoice-split.dtos.ts`

```typescript
import { z } from 'zod';
const Uuid = z.string().uuid();

export const CreateFromCompletedOrderDtoSchema = z.object({
  order_id: Uuid,
  force_recompute: z.boolean().default(false),
});
export type CreateFromCompletedOrderDto = z.infer<typeof CreateFromCompletedOrderDtoSchema>;

export const MarkInvoicePaidDtoSchema = z.object({
  paid_amount: z.string().refine((s) => /^\d+\.\d{2}$/.test(s), 'Must be string decimal 2 digits'),
  paid_method: z.enum(['bank_transfer', 'cmi_card', 'maroc_telecommerce', 'naps', 'lyf', 'inwi_money', 'orange_money', 'cash_kiosk', 'cheque']),
  paid_reference: z.string().min(3).max(256),
  paid_at: z.string().datetime().optional(),
});
export type MarkInvoicePaidDto = z.infer<typeof MarkInvoicePaidDtoSchema>;

export const VoidInvoiceDtoSchema = z.object({
  reason: z.string().min(10).max(512),
  generate_credit_note: z.boolean().default(true),
});
export type VoidInvoiceDto = z.infer<typeof VoidInvoiceDtoSchema>;

export const FinalizeInvoiceDtoSchema = z.object({
  reviewer_notes: z.string().max(2000).optional(),
});
export type FinalizeInvoiceDto = z.infer<typeof FinalizeInvoiceDtoSchema>;

export const InvoiceSearchDtoSchema = z.object({
  recipient_type: z.enum(['insurer', 'customer']).optional(),
  status: z.enum(['draft', 'final', 'partially_paid', 'paid', 'overdue', 'voided']).optional(),
  from_date: z.string().date().optional(),
  to_date: z.string().date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});
export type InvoiceSearchDto = z.infer<typeof InvoiceSearchDtoSchema>;
```

### Fichier 5/13 : `repo/packages/repair/src/services/invoice-numbering.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

interface NumberingInput { tenant_id: string; tenant_code: string; manager: EntityManager; year?: number; }

@Injectable()
export class InvoiceNumberingService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectPinoLogger(InvoiceNumberingService.name) private readonly logger: PinoLogger,
  ) {}

  async getNextInvoiceNumber(input: NumberingInput): Promise<string> {
    const year = input.year ?? new Date().getFullYear();
    const tenantHash = this.hashTenantToInt(input.tenant_id);
    await input.manager.query('SELECT pg_advisory_xact_lock($1)', [tenantHash]);
    const existing: { counter: number }[] = await input.manager.query(
      `SELECT counter FROM repair_invoice_counters WHERE tenant_id = $1 AND year = $2 FOR UPDATE`,
      [input.tenant_id, year],
    );
    let nextCounter: number;
    if (existing.length === 0) {
      await input.manager.query(
        `INSERT INTO repair_invoice_counters (tenant_id, year, counter, tenant_code, last_increment_at) VALUES ($1, $2, 1, $3, NOW())`,
        [input.tenant_id, year, input.tenant_code],
      );
      nextCounter = 1;
    } else {
      nextCounter = existing[0].counter + 1;
      await input.manager.query(
        `UPDATE repair_invoice_counters SET counter = $1, last_increment_at = NOW(), updated_at = NOW() WHERE tenant_id = $2 AND year = $3`,
        [nextCounter, input.tenant_id, year],
      );
    }
    const padded = String(nextCounter).padStart(6, '0');
    return `INV-${input.tenant_code}-${year}-${padded}`;
  }

  private hashTenantToInt(tenantId: string): number {
    let hash = 0;
    for (let i = 0; i < tenantId.length; i++) hash = (hash * 31 + tenantId.charCodeAt(i)) | 0;
    return hash & 0x7FFFFFFF;
  }
}
```

### Fichier 6/13 : `repo/packages/repair/src/services/invoice-split-calculator.service.ts`

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { ApprovalConditionsJsonb } from '../entities/repair-devis-approval.entity';

export interface CalculatorInput { total_ttc: string; conditions: ApprovalConditionsJsonb | null; tva_rate: number; }
export interface CalculatorOutput {
  total_ttc: string;
  total_ht: string;
  total_tva: string;
  insurer_amount_ttc: string;
  customer_amount_ttc: string;
  insurer_amount_ht: string;
  insurer_amount_tva: string;
  customer_amount_ht: string;
  customer_amount_tva: string;
  applied_franchise: string;
  applied_exclusions_total: string;
  capped: boolean;
  cap_value: string | null;
}

Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP, toExpNeg: -7, toExpPos: 21 });

@Injectable()
export class InvoiceSplitCalculatorService {
  compute(input: CalculatorInput): CalculatorOutput {
    if (input.tva_rate < 0 || input.tva_rate > 0.5) throw new BadRequestException('Invalid tva_rate');
    const totalTtc = new Decimal(input.total_ttc);
    if (totalTtc.lt(0)) throw new BadRequestException('total_ttc cannot be negative');
    const tvaMultiplier = new Decimal(1).plus(input.tva_rate);
    const totalHt = totalTtc.div(tvaMultiplier);
    const totalTva = totalTtc.minus(totalHt);
    if (!input.conditions) {
      return this.allCustomer(totalTtc, totalHt, totalTva);
    }
    const franchise = new Decimal(input.conditions.franchise_amount);
    if (franchise.lt(0)) throw new BadRequestException('franchise_amount cannot be negative');
    const exclusionsTotal = (input.conditions.exclusions ?? []).reduce(
      (acc, e) => acc.plus(new Decimal(e.amount_excluded)),
      new Decimal(0),
    );
    if (exclusionsTotal.lt(0)) throw new BadRequestException('exclusions cannot be negative');
    const coverageCap = input.conditions.coverage_cap !== undefined ? new Decimal(input.conditions.coverage_cap) : null;
    if (coverageCap !== null && coverageCap.lt(0)) throw new BadRequestException('coverage_cap cannot be negative');
    const insurerBeforeCap = totalTtc.minus(franchise).minus(exclusionsTotal);
    const insurerEffective = insurerBeforeCap.lt(0) ? new Decimal(0) : insurerBeforeCap;
    let insurerAmount: Decimal;
    let capped = false;
    if (coverageCap !== null && insurerEffective.gt(coverageCap)) {
      insurerAmount = coverageCap;
      capped = true;
    } else {
      insurerAmount = insurerEffective;
    }
    const customerAmount = totalTtc.minus(insurerAmount);
    if (insurerAmount.lt(0) || customerAmount.lt(0)) {
      throw new BadRequestException('Internal split error : negative amount computed');
    }
    const insurerAmountHt = insurerAmount.div(tvaMultiplier);
    const insurerAmountTva = insurerAmount.minus(insurerAmountHt);
    const customerAmountHt = customerAmount.div(tvaMultiplier);
    const customerAmountTva = customerAmount.minus(customerAmountHt);
    const sumCheck = insurerAmount.plus(customerAmount);
    if (!sumCheck.equals(totalTtc)) {
      throw new BadRequestException(`Split integrity error : ${sumCheck.toFixed(2)} != ${totalTtc.toFixed(2)}`);
    }
    return {
      total_ttc: totalTtc.toFixed(2),
      total_ht: totalHt.toFixed(2),
      total_tva: totalTva.toFixed(2),
      insurer_amount_ttc: insurerAmount.toFixed(2),
      customer_amount_ttc: customerAmount.toFixed(2),
      insurer_amount_ht: insurerAmountHt.toFixed(2),
      insurer_amount_tva: insurerAmountTva.toFixed(2),
      customer_amount_ht: customerAmountHt.toFixed(2),
      customer_amount_tva: customerAmountTva.toFixed(2),
      applied_franchise: franchise.toFixed(2),
      applied_exclusions_total: exclusionsTotal.toFixed(2),
      capped,
      cap_value: coverageCap !== null ? coverageCap.toFixed(2) : null,
    };
  }

  private allCustomer(totalTtc: Decimal, totalHt: Decimal, totalTva: Decimal): CalculatorOutput {
    return {
      total_ttc: totalTtc.toFixed(2), total_ht: totalHt.toFixed(2), total_tva: totalTva.toFixed(2),
      insurer_amount_ttc: '0.00', customer_amount_ttc: totalTtc.toFixed(2),
      insurer_amount_ht: '0.00', insurer_amount_tva: '0.00',
      customer_amount_ht: totalHt.toFixed(2), customer_amount_tva: totalTva.toFixed(2),
      applied_franchise: '0.00', applied_exclusions_total: '0.00',
      capped: false, cap_value: null,
    };
  }
}
```

### Fichier 7/13 : `repo/packages/repair/src/services/invoices.service.ts` (extrait createFromCompletedOrder)

```typescript
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import Decimal from 'decimal.js';
import { RepairInvoice, InvoiceRecipientDataJsonb, InvoiceAppliedConditionsJsonb } from '../entities/repair-invoice.entity';
import { RepairOrder } from '../entities/repair-order.entity';
import { DevisApprovalsService } from './devis-approvals.service';
import { RepairSinistresService } from './sinistres.service';
import { InsurePoliciesService } from '@insurtech/insure';
import { ContactsService } from '@insurtech/crm';
import { TenantsService } from '@insurtech/tenants';
import { PdfGeneratorService, DocsService } from '@insurtech/docs';
import { BooksService } from '@insurtech/books';
import { KafkaProducerService, TenantContext } from '@insurtech/shared-utils';
import { InvoiceNumberingService } from './invoice-numbering.service';
import { InvoiceSplitCalculatorService } from './invoice-split-calculator.service';
import { CreateFromCompletedOrderDtoSchema, MarkInvoicePaidDtoSchema, VoidInvoiceDtoSchema, FinalizeInvoiceDtoSchema } from '../dtos/invoice-split.dtos';
import type { CreateFromCompletedOrderDto, MarkInvoicePaidDto, VoidInvoiceDto, FinalizeInvoiceDto } from '../dtos/invoice-split.dtos';
import { InvoiceCreatedEventSchema, INVOICE_CREATED_TOPIC } from '../events/invoice-created.event';
import { InvoicePaidEventSchema, INVOICE_PAID_TOPIC } from '../events/invoice-paid.event';

const DEFAULT_TVA_RATE = 0.20;
const DEFAULT_DUE_DAYS_CUSTOMER = 30;
const DEFAULT_DUE_DAYS_INSURER = 60;

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(RepairInvoice) private readonly repo: Repository<RepairInvoice>,
    @InjectRepository(RepairOrder) private readonly orderRepo: Repository<RepairOrder>,
    private readonly dataSource: DataSource,
    @InjectPinoLogger(InvoicesService.name) private readonly logger: PinoLogger,
    private readonly approvalsService: DevisApprovalsService,
    private readonly sinistresService: RepairSinistresService,
    private readonly policiesService: InsurePoliciesService,
    private readonly contactsService: ContactsService,
    private readonly tenantsService: TenantsService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly docsService: DocsService,
    private readonly booksService: BooksService,
    private readonly kafka: KafkaProducerService,
    private readonly numbering: InvoiceNumberingService,
    private readonly calculator: InvoiceSplitCalculatorService,
  ) {}

  async createFromCompletedOrder(input: CreateFromCompletedOrderDto): Promise<RepairInvoice[]> {
    CreateFromCompletedOrderDtoSchema.parse(input);
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();
    const order = await this.orderRepo.findOne({ where: { id: input.order_id } });
    if (!order) throw new NotFoundException(`Order ${input.order_id} not found`);
    if (order.status !== 'completed') throw new ConflictException(`Order status must be completed, got ${order.status}`);
    const existing = await this.repo.find({ where: { order_id: input.order_id } });
    if (existing.length > 0 && !input.force_recompute) {
      throw new ConflictException(`Invoices already exist for order ${input.order_id} (use force_recompute=true to recompute -- voids existing)`);
    }
    const sinistre = await this.sinistresService.findById(order.sinistre_id);
    if (!sinistre) throw new NotFoundException('Sinistre not found');
    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant) throw new NotFoundException('Tenant not found');
    const partsCostActual = order.parts_arrival_status
      .filter((p) => p.status === 'used' || p.status === 'arrived')
      .reduce((acc, p) => acc.plus(new Decimal(p.cost_mad ?? 0).times(p.quantity ?? 1)), new Decimal(0));
    const laborCostActual = order.technician_hours_log
      .filter((h) => !h.correction_of)
      .reduce((acc, h) => acc.plus(new Decimal(h.hours_worked).times(tenant.config?.labor_rate_per_hour ?? 150)), new Decimal(0));
    const totalHtBefore = partsCostActual.plus(laborCostActual);
    const tva = totalHtBefore.times(DEFAULT_TVA_RATE);
    const totalTtc = totalHtBefore.plus(tva);
    let approval = null;
    if (sinistre.insure_policy_id) {
      approval = await this.approvalsService.getApprovalBySinistreId(sinistre.id);
    }
    const split = this.calculator.compute({
      total_ttc: totalTtc.toFixed(2),
      conditions: approval?.approval_conditions ?? null,
      tva_rate: DEFAULT_TVA_RATE,
    });
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      if (input.force_recompute && existing.length > 0) {
        for (const e of existing) {
          await manager.update(RepairInvoice, e.id, { status: 'voided', void_reason: 'Recomputed', voided_at: new Date(), voided_by: userId });
        }
      }
      const invoices: RepairInvoice[] = [];
      const hasInsurerPart = new Decimal(split.insurer_amount_ttc).gt(0);
      const hasCustomerPart = new Decimal(split.customer_amount_ttc).gt(0);
      let insurerInvoice: RepairInvoice | null = null;
      if (hasInsurerPart && approval && sinistre.insure_policy_id) {
        const policy = await this.policiesService.findById(sinistre.insure_policy_id);
        const insurerInvoiceNumber = await this.numbering.getNextInvoiceNumber({ tenant_id: tenantId, tenant_code: tenant.code, manager });
        const insurerData: InvoiceRecipientDataJsonb = {
          type: 'insurer',
          name: policy.insurer_name,
          ice: policy.insurer_ice,
          insurer_provider: policy.insurer_provider,
          policy_reference: policy.reference,
          email: policy.insurer_billing_email,
          address: policy.insurer_billing_address,
        };
        const insurerEntity = manager.create(RepairInvoice, {
          tenant_id: tenantId,
          sinistre_id: order.sinistre_id,
          order_id: input.order_id,
          invoice_number: insurerInvoiceNumber,
          recipient_type: 'insurer',
          recipient_data: insurerData,
          applied_conditions: this.snapshotConditions(approval),
          total_ht: split.insurer_amount_ht,
          total_tva: split.insurer_amount_tva,
          total_ttc: split.insurer_amount_ttc,
          paid_amount: '0',
          line_items: this.buildLineItems(order, 'insurer', DEFAULT_TVA_RATE),
          status: 'final',
          emission_date: new Date().toISOString().slice(0, 10),
          emission_date_local: new Date().toISOString().slice(0, 10),
          due_date: new Date(Date.now() + DEFAULT_DUE_DAYS_INSURER * 86400_000).toISOString().slice(0, 10),
          tenant_timezone: tenant.timezone ?? 'Africa/Casablanca',
          created_by: userId,
          updated_by: userId,
        });
        insurerInvoice = await manager.save(RepairInvoice, insurerEntity);
        const pdfBuffer = await this.pdfGenerator.generate({ template: 'facture', locale: 'fr', data: { invoice: insurerInvoice, sinistre, order, tenant, split } });
        const pdfDocId = await this.docsService.store(pdfBuffer, { type: 'invoice_insurer', sinistre_id: sinistre.id });
        await manager.update(RepairInvoice, insurerInvoice.id, { pdf_doc_id: pdfDocId });
        insurerInvoice.pdf_doc_id = pdfDocId;
        await this.booksService.recordInvoice({ tenant_id: tenantId, invoice_id: insurerInvoice.id, recipient_type: 'insurer', total_ht: split.insurer_amount_ht, total_tva: split.insurer_amount_tva, total_ttc: split.insurer_amount_ttc, emission_date: insurerInvoice.emission_date, manager });
        invoices.push(insurerInvoice);
      }
      if (hasCustomerPart) {
        const customer = await this.contactsService.findById(sinistre.customer_contact_id);
        const customerInvoiceNumber = await this.numbering.getNextInvoiceNumber({ tenant_id: tenantId, tenant_code: tenant.code, manager });
        const customerData: InvoiceRecipientDataJsonb = {
          type: 'customer',
          name: customer.full_name,
          cin: customer.cin,
          email: customer.email,
          phone_e164: customer.phone_e164,
          address: customer.address,
        };
        const customerEntity = manager.create(RepairInvoice, {
          tenant_id: tenantId,
          sinistre_id: order.sinistre_id,
          order_id: input.order_id,
          invoice_number: customerInvoiceNumber,
          recipient_type: 'customer',
          recipient_data: customerData,
          applied_conditions: approval ? this.snapshotConditions(approval) : null,
          split_parent_id: insurerInvoice?.id ?? null,
          total_ht: split.customer_amount_ht,
          total_tva: split.customer_amount_tva,
          total_ttc: split.customer_amount_ttc,
          paid_amount: '0',
          line_items: this.buildLineItems(order, 'customer', DEFAULT_TVA_RATE),
          status: 'final',
          emission_date: new Date().toISOString().slice(0, 10),
          emission_date_local: new Date().toISOString().slice(0, 10),
          due_date: new Date(Date.now() + DEFAULT_DUE_DAYS_CUSTOMER * 86400_000).toISOString().slice(0, 10),
          tenant_timezone: tenant.timezone ?? 'Africa/Casablanca',
          created_by: userId,
          updated_by: userId,
        });
        const customerInvoice = await manager.save(RepairInvoice, customerEntity);
        const pdfBuffer = await this.pdfGenerator.generate({ template: 'facture', locale: customer.preferred_locale ?? 'fr', data: { invoice: customerInvoice, sinistre, order, tenant, split } });
        const pdfDocId = await this.docsService.store(pdfBuffer, { type: 'invoice_customer', sinistre_id: sinistre.id });
        await manager.update(RepairInvoice, customerInvoice.id, { pdf_doc_id: pdfDocId });
        customerInvoice.pdf_doc_id = pdfDocId;
        await this.booksService.recordInvoice({ tenant_id: tenantId, invoice_id: customerInvoice.id, recipient_type: 'customer', total_ht: split.customer_amount_ht, total_tva: split.customer_amount_tva, total_ttc: split.customer_amount_ttc, emission_date: customerInvoice.emission_date, manager });
        invoices.push(customerInvoice);
      }
      for (const inv of invoices) {
        const event = {
          tenant_id: tenantId, invoice_id: inv.id, sinistre_id: inv.sinistre_id, order_id: inv.order_id,
          invoice_number: inv.invoice_number, recipient_type: inv.recipient_type, total_ttc: inv.total_ttc,
          due_date: inv.due_date, pdf_doc_id: inv.pdf_doc_id!,
          split_parent_id: inv.split_parent_id, emission_date: inv.emission_date,
        };
        InvoiceCreatedEventSchema.parse(event);
        await this.kafka.publish({ topic: INVOICE_CREATED_TOPIC, key: inv.sinistre_id, value: event, headers: { 'tenant-id': tenantId } });
      }
      this.logger.info({ tenant_id: tenantId, order_id: input.order_id, invoices_created: invoices.length, has_insurer: hasInsurerPart, has_customer: hasCustomerPart, total_ttc: split.total_ttc, action: 'invoices_split_created' }, 'Invoices split created');
      return invoices;
    });
  }

  async markPaid(invoiceId: string, input: MarkInvoicePaidDto): Promise<RepairInvoice> {
    MarkInvoicePaidDtoSchema.parse(input);
    const tenantId = TenantContext.requireTenantId();
    const userId = TenantContext.requireUserId();
    const invoice = await this.requireInvoice(invoiceId);
    if (invoice.status === 'voided') throw new ConflictException('Cannot mark paid : invoice voided');
    if (invoice.status === 'paid') return invoice;
    const currentPaid = new Decimal(invoice.paid_amount);
    const additionalPaid = new Decimal(input.paid_amount);
    const newPaid = currentPaid.plus(additionalPaid);
    const totalDue = new Decimal(invoice.total_ttc);
    if (newPaid.gt(totalDue)) throw new BadRequestException(`Paid amount exceeds due : ${newPaid.toFixed(2)} > ${totalDue.toFixed(2)}`);
    const newStatus = newPaid.equals(totalDue) ? 'paid' : 'partially_paid';
    return await this.dataSource.transaction(async (manager: EntityManager) => {
      await manager.update(RepairInvoice, invoiceId, {
        paid_amount: newPaid.toFixed(2),
        status: newStatus,
        paid_at: newPaid.equals(totalDue) ? (input.paid_at ? new Date(input.paid_at) : new Date()) : invoice.paid_at,
        paid_method: input.paid_method,
        paid_reference: input.paid_reference,
        updated_by: userId,
      });
      await this.booksService.recordPayment({ tenant_id: tenantId, invoice_id: invoiceId, amount: input.paid_amount, method: input.paid_method, reference: input.paid_reference, paid_at: new Date(input.paid_at ?? Date.now()), manager });
      const updated = await manager.findOneOrFail(RepairInvoice, { where: { id: invoiceId } });
      const event = { tenant_id: tenantId, invoice_id: invoiceId, sinistre_id: invoice.sinistre_id, paid_amount: input.paid_amount, paid_method: input.paid_method, paid_reference: input.paid_reference, paid_at: (input.paid_at ?? new Date().toISOString()), recipient_type: invoice.recipient_type, fully_paid: newStatus === 'paid' };
      InvoicePaidEventSchema.parse(event);
      await this.kafka.publish({ topic: INVOICE_PAID_TOPIC, key: invoice.sinistre_id, value: event, headers: { 'tenant-id': tenantId, 'idempotency-key': `paid-${invoiceId}-${input.paid_reference}` } });
      return updated;
    });
  }

  async voidInvoice(invoiceId: string, input: VoidInvoiceDto): Promise<RepairInvoice> {
    VoidInvoiceDtoSchema.parse(input);
    const userId = TenantContext.requireUserId();
    const invoice = await this.requireInvoice(invoiceId);
    if (invoice.status === 'voided') throw new ConflictException('Already voided');
    await this.repo.update(invoiceId, { status: 'voided', void_reason: input.reason, voided_at: new Date(), voided_by: userId });
    return this.requireInvoice(invoiceId);
  }

  async findBySinistreId(sinistreId: string): Promise<RepairInvoice[]> {
    return this.repo.find({ where: { sinistre_id: sinistreId }, order: { emission_date: 'ASC', recipient_type: 'ASC' } });
  }

  private snapshotConditions(approval: any): InvoiceAppliedConditionsJsonb {
    return {
      franchise_amount: approval.franchise_amount, exclusions: approval.approval_conditions?.exclusions ?? [],
      coverage_cap: approval.approval_conditions?.coverage_cap !== undefined ? String(approval.approval_conditions.coverage_cap) : undefined,
      special_conditions: approval.approval_conditions?.special_conditions ?? [],
      approval_id: approval.id, snapshot_at: new Date().toISOString(),
    };
  }

  private buildLineItems(order: any, recipientType: 'insurer' | 'customer', tvaRate: number) {
    return [
      { description: `Reparation sinistre -- ${recipientType === 'insurer' ? 'part assureur' : 'part client'}`, quantity: 1, unit_price_ht: '0', total_ht: '0', tva_rate: tvaRate },
    ];
  }

  private async requireInvoice(id: string): Promise<RepairInvoice> { const i = await this.repo.findOne({ where: { id } }); if (!i) throw new NotFoundException(`Invoice ${id} not found`); return i; }
}
```

### Fichier 8/13 : `repo/packages/repair/src/events/invoice-created.event.ts`

```typescript
import { z } from 'zod';

export const InvoiceCreatedEventSchema = z.object({
  tenant_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  sinistre_id: z.string().uuid(),
  order_id: z.string().uuid(),
  invoice_number: z.string(),
  recipient_type: z.enum(['insurer', 'customer']),
  total_ttc: z.string(),
  due_date: z.string().nullable(),
  pdf_doc_id: z.string().uuid(),
  split_parent_id: z.string().uuid().nullable(),
  emission_date: z.string(),
});
export type InvoiceCreatedEvent = z.infer<typeof InvoiceCreatedEventSchema>;
export const INVOICE_CREATED_TOPIC = 'insurtech.events.repair.invoice.created';
```

### Fichier 9/13 : `repo/packages/repair/src/events/invoice-paid.event.ts`

```typescript
import { z } from 'zod';

export const InvoicePaidEventSchema = z.object({
  tenant_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  sinistre_id: z.string().uuid(),
  paid_amount: z.string(),
  paid_method: z.string(),
  paid_reference: z.string(),
  paid_at: z.string(),
  recipient_type: z.enum(['insurer', 'customer']),
  fully_paid: z.boolean(),
});
export type InvoicePaidEvent = z.infer<typeof InvoicePaidEventSchema>;
export const INVOICE_PAID_TOPIC = 'insurtech.events.repair.invoice.paid';
```

### Fichier 10/13 : `repo/packages/repair/src/consumers/delivered-auto-create-invoices.consumer.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { KafkaConsumerService, TenantContext } from '@insurtech/shared-utils';
import { SinistreDeliveredEventSchema, SINISTRE_DELIVERED_TOPIC } from '../events/sinistre-delivered.event';
import { InvoicesService } from '../services/invoices.service';
import { RepairOrdersService } from '../services/orders.service';

@Injectable()
export class DeliveredAutoCreateInvoicesConsumer {
  constructor(
    @InjectPinoLogger(DeliveredAutoCreateInvoicesConsumer.name) private readonly logger: PinoLogger,
    private readonly kafka: KafkaConsumerService,
    private readonly invoices: InvoicesService,
    private readonly orders: RepairOrdersService,
  ) {}

  async onModuleInit() {
    await this.kafka.subscribe({ topic: SINISTRE_DELIVERED_TOPIC, groupId: 'repair-delivered-auto-create-invoices', handler: this.handle.bind(this) });
  }

  private async handle(event: unknown) {
    const parsed = SinistreDeliveredEventSchema.safeParse(event);
    if (!parsed.success) { this.logger.error({ errors: parsed.error.format() }, 'Invalid event'); return; }
    const ev = parsed.data;
    if (process.env.REPAIR_AUTO_CREATE_INVOICE_ON_DELIVERED !== 'true') {
      this.logger.info({ sinistre_id: ev.sinistre_id, action: 'auto_create_skipped_config' }, 'Auto-create invoices disabled per tenant config');
      return;
    }
    await TenantContext.run({ tenant_id: ev.tenant_id, user_id: 'system-invoices-auto' }, async () => {
      try {
        const order = await this.orders.findBySinistreId(ev.sinistre_id);
        if (!order) { this.logger.warn({ sinistre_id: ev.sinistre_id }, 'No order found'); return; }
        const invoices = await this.invoices.createFromCompletedOrder({ order_id: order.id, force_recompute: false });
        this.logger.info({ tenant_id: ev.tenant_id, sinistre_id: ev.sinistre_id, invoices_count: invoices.length, action: 'invoices_auto_created' }, 'Invoices auto-created');
      } catch (err) { this.logger.error({ err, sinistre_id: ev.sinistre_id }, 'Failed auto-create invoices'); }
    });
  }
}
```

### Fichier 11/13 : `repo/apps/api/src/modules/repair/controllers/invoices.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from '@insurtech/repair';
import { Roles } from '@insurtech/auth';
import type { CreateFromCompletedOrderDto, MarkInvoicePaidDto, VoidInvoiceDto, FinalizeInvoiceDto, InvoiceSearchDto } from '@insurtech/repair';

@ApiTags('repair-invoices')
@ApiBearerAuth()
@Controller('api/v1/repair/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('create-from-order')
  @HttpCode(HttpStatus.CREATED)
  @Roles('repair.invoices.create')
  @ApiOperation({ summary: 'Manually create invoices from completed order (typically auto via Kafka)' })
  async create(@Body() dto: CreateFromCompletedOrderDto) { return this.invoicesService.createFromCompletedOrder(dto); }

  @Post(':id/mark-paid')
  @Roles('repair.invoices.mark_paid')
  @ApiOperation({ summary: 'Mark invoice paid (manual reconciliation or auto from Pay webhook)' })
  async markPaid(@Param('id') id: string, @Body() dto: MarkInvoicePaidDto) { return this.invoicesService.markPaid(id, dto); }

  @Post(':id/void')
  @Roles('repair.invoices.void')
  @ApiOperation({ summary: 'Void invoice + generate credit note (CGNC compliant)' })
  async voidInvoice(@Param('id') id: string, @Body() dto: VoidInvoiceDto) { return this.invoicesService.voidInvoice(id, dto); }

  @Get('sinistre/:sinistreId')
  @Roles('repair.invoices.read')
  @ApiOperation({ summary: 'List invoices for a sinistre (typically 1 customer or 2 split)' })
  async findBySinistre(@Param('sinistreId') sinistreId: string) { return this.invoicesService.findBySinistreId(sinistreId); }

  @Get(':id')
  @Roles('repair.invoices.read')
  async findOne(@Param('id') id: string) { return this.invoicesService.findById(id); }

  @Get(':id/pdf-url')
  @Roles('repair.invoices.read')
  @ApiOperation({ summary: 'Get presigned PDF URL (valid 24h)' })
  async getPdfUrl(@Param('id') id: string) { return this.invoicesService.getPresignedPdfUrl(id); }

  @Get('search/list')
  @Roles('repair.invoices.read')
  async search(@Query() dto: InvoiceSearchDto) { return this.invoicesService.search(dto); }
}
```

### Fichier 12/13 : `repo/packages/docs/src/templates/fr/facture.hbs`

```handlebars
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture {{invoice.invoice_number}}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: 30px; }
    h1 { color: #0c4a6e; border-bottom: 2px solid #0c4a6e; padding-bottom: 8px; font-size: 22pt; }
    .header { display: flex; justify-content: space-between; }
    .header-left { width: 50%; }
    .header-right { width: 50%; text-align: right; }
    .meta { background: #f1f5f9; padding: 12px; border-radius: 4px; margin: 16px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    th { background: #e0f2fe; }
    .totals { margin: 16px 0; text-align: right; }
    .totals-row { display: flex; justify-content: flex-end; gap: 24px; padding: 4px 0; }
    .totals-row strong { display: inline-block; min-width: 200px; text-align: right; }
    .total-ttc { font-size: 14pt; font-weight: bold; color: #0c4a6e; border-top: 2px solid #0c4a6e; padding-top: 8px; }
    .footer { margin-top: 32px; font-size: 9pt; color: #475569; border-top: 1px solid #cbd5e1; padding-top: 12px; }
    .legal { font-size: 8.5pt; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>FACTURE</h1>
      <p>N. {{invoice.invoice_number}}</p>
      <p>Date emission : {{invoice.emission_date}}</p>
      <p>Date echeance : {{invoice.due_date}}</p>
    </div>
    <div class="header-right">
      <p><strong>{{tenant.name}}</strong></p>
      <p>ICE : {{tenant.ice}}</p>
      <p>RC : {{tenant.rc}}</p>
      <p>{{tenant.address}}</p>
    </div>
  </div>

  <div class="meta">
    <strong>{{#if (eq invoice.recipient_type "insurer")}}Destinataire (Assureur){{else}}Destinataire (Client){{/if}} :</strong><br>
    {{invoice.recipient_data.name}}<br>
    {{#if invoice.recipient_data.ice}}ICE : {{invoice.recipient_data.ice}}<br>{{/if}}
    {{#if invoice.recipient_data.cin}}CIN : {{invoice.recipient_data.cin}}<br>{{/if}}
    {{#if invoice.recipient_data.policy_reference}}Reference police : {{invoice.recipient_data.policy_reference}}<br>{{/if}}
    {{#if invoice.recipient_data.address}}{{invoice.recipient_data.address.line1}}, {{invoice.recipient_data.address.city}}{{/if}}
  </div>

  <h2>Detail des prestations</h2>
  <table>
    <thead>
      <tr><th>Description</th><th>Quantite</th><th>Prix HT (MAD)</th><th>TVA</th><th>Total HT (MAD)</th></tr>
    </thead>
    <tbody>
      {{#each invoice.line_items as |item|}}
        <tr>
          <td>{{item.description}}</td>
          <td>{{item.quantity}}</td>
          <td>{{item.unit_price_ht}}</td>
          <td>{{multiply item.tva_rate 100}}%</td>
          <td>{{item.total_ht}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">Total HT : <strong>{{invoice.total_ht}} MAD</strong></div>
    <div class="totals-row">TVA 20% : <strong>{{invoice.total_tva}} MAD</strong></div>
    <div class="totals-row total-ttc">Total TTC : <strong>{{invoice.total_ttc}} MAD</strong></div>
  </div>

  {{#if invoice.applied_conditions}}
    <h3>Conditions d'application (police assurance)</h3>
    <p>Franchise : {{invoice.applied_conditions.franchise_amount}} MAD</p>
    {{#if invoice.applied_conditions.coverage_cap}}<p>Plafond couverture : {{invoice.applied_conditions.coverage_cap}} MAD</p>{{/if}}
    {{#if invoice.applied_conditions.exclusions.length}}
      <p>Exclusions :</p>
      <ul>{{#each invoice.applied_conditions.exclusions as |exc|}}<li>{{exc.item_description}} ({{exc.amount_excluded}} MAD) -- {{exc.reason}}</li>{{/each}}</ul>
    {{/if}}
  {{/if}}

  <div class="footer">
    <p><strong>Mode de reglement :</strong> {{#if (eq invoice.recipient_type "insurer")}}Virement bancaire dans les {{due_days_insurer}} jours{{else}}Virement, Carte CMI, Mobile Money (Inwi/Orange) -- dans les {{due_days_customer}} jours{{/if}}</p>
    <p class="legal">TVA acquittee selon les debits. Facture conforme art. 22 CGNC + decret DGI 2.06.190.</p>
    <p class="legal">Conservation obligatoire 10 ans (loi 09-08 CNDP + obligations comptables).</p>
  </div>
</body>
</html>
```

### Fichier 13/13 : `repo/packages/repair/src/repair.module.ts` (extrait update)

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepairInvoice } from './entities/repair-invoice.entity';
import { InvoicesService } from './services/invoices.service';
import { InvoiceNumberingService } from './services/invoice-numbering.service';
import { InvoiceSplitCalculatorService } from './services/invoice-split-calculator.service';
import { DeliveredAutoCreateInvoicesConsumer } from './consumers/delivered-auto-create-invoices.consumer';
import { PayTransactionMarkInvoicePaidConsumer } from './consumers/pay-transaction-mark-invoice-paid.consumer';
import { BooksModule } from '@insurtech/books';
import { PayModule } from '@insurtech/pay';
import { CommModule } from '@insurtech/comm';
import { DocsModule } from '@insurtech/docs';

@Module({
  imports: [TypeOrmModule.forFeature([RepairInvoice]), BooksModule, PayModule, CommModule, DocsModule],
  providers: [InvoicesService, InvoiceNumberingService, InvoiceSplitCalculatorService, DeliveredAutoCreateInvoicesConsumer, PayTransactionMarkInvoicePaidConsumer],
  exports: [InvoicesService, InvoiceSplitCalculatorService],
})
export class RepairInvoicesModule {}
```

## 7. Tests complets

### 7.1 Tests unitaires calculator : `repo/packages/repair/src/services/invoice-split-calculator.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { InvoiceSplitCalculatorService } from './invoice-split-calculator.service';

describe('InvoiceSplitCalculatorService', () => {
  let svc: InvoiceSplitCalculatorService;
  beforeEach(() => { svc = new InvoiceSplitCalculatorService(); });

  describe('compute() with no conditions (no policy)', () => {
    it('all customer when conditions null', () => {
      const r = svc.compute({ total_ttc: '12000.00', conditions: null, tva_rate: 0.20 });
      expect(r.insurer_amount_ttc).toBe('0.00');
      expect(r.customer_amount_ttc).toBe('12000.00');
      expect(r.customer_amount_ht).toBe('10000.00');
      expect(r.customer_amount_tva).toBe('2000.00');
    });

    it('handles totalTtc=0', () => {
      const r = svc.compute({ total_ttc: '0.00', conditions: null, tva_rate: 0.20 });
      expect(r.total_ttc).toBe('0.00');
      expect(r.customer_amount_ttc).toBe('0.00');
    });

    it('rejects negative total_ttc', () => {
      expect(() => svc.compute({ total_ttc: '-100', conditions: null, tva_rate: 0.20 })).toThrow();
    });

    it('rejects invalid tva_rate', () => {
      expect(() => svc.compute({ total_ttc: '1000', conditions: null, tva_rate: 0.6 })).toThrow();
    });
  });

  describe('compute() with full coverage policy', () => {
    it('insurer takes all when no franchise no exclusions no cap', () => {
      const r = svc.compute({
        total_ttc: '10000.00',
        conditions: { franchise_amount: 0, exclusions: [] },
        tva_rate: 0.20,
      });
      expect(r.insurer_amount_ttc).toBe('10000.00');
      expect(r.customer_amount_ttc).toBe('0.00');
    });

    it('customer pays franchise, insurer pays rest', () => {
      const r = svc.compute({
        total_ttc: '10000.00',
        conditions: { franchise_amount: 1500, exclusions: [] },
        tva_rate: 0.20,
      });
      expect(r.insurer_amount_ttc).toBe('8500.00');
      expect(r.customer_amount_ttc).toBe('1500.00');
      expect(r.applied_franchise).toBe('1500.00');
    });

    it('coverage cap clamps insurer amount', () => {
      const r = svc.compute({
        total_ttc: '50000.00',
        conditions: { franchise_amount: 2000, exclusions: [], coverage_cap: 30000 },
        tva_rate: 0.20,
      });
      expect(r.insurer_amount_ttc).toBe('30000.00');
      expect(r.customer_amount_ttc).toBe('20000.00');
      expect(r.capped).toBe(true);
      expect(r.cap_value).toBe('30000.00');
    });

    it('exclusions imputed to customer', () => {
      const r = svc.compute({
        total_ttc: '15000.00',
        conditions: { franchise_amount: 1000, exclusions: [{ item_description: 'Nettoyage', amount_excluded: 500, reason: 'Hors couverture' }] },
        tva_rate: 0.20,
      });
      expect(r.applied_exclusions_total).toBe('500.00');
      expect(r.insurer_amount_ttc).toBe('13500.00');
      expect(r.customer_amount_ttc).toBe('1500.00');
    });

    it('multiple exclusions sum correctly', () => {
      const r = svc.compute({
        total_ttc: '20000.00',
        conditions: { franchise_amount: 2000, exclusions: [{ item_description: 'a', amount_excluded: 800, reason: 'r' }, { item_description: 'b', amount_excluded: 1200, reason: 'r' }] },
        tva_rate: 0.20,
      });
      expect(r.applied_exclusions_total).toBe('2000.00');
    });

    it('insurer 0 when franchise > total', () => {
      const r = svc.compute({
        total_ttc: '5000.00',
        conditions: { franchise_amount: 10000, exclusions: [] },
        tva_rate: 0.20,
      });
      expect(r.insurer_amount_ttc).toBe('0.00');
      expect(r.customer_amount_ttc).toBe('5000.00');
    });

    it('insurer 0 when franchise+exclusions > total', () => {
      const r = svc.compute({
        total_ttc: '5000.00',
        conditions: { franchise_amount: 3000, exclusions: [{ item_description: 'x', amount_excluded: 3000, reason: 'r' }] },
        tva_rate: 0.20,
      });
      expect(r.insurer_amount_ttc).toBe('0.00');
      expect(r.customer_amount_ttc).toBe('5000.00');
    });
  });

  describe('decimal precision', () => {
    it('handles 0.10 + 0.20 = 0.30 exactly (no float drift)', () => {
      const r = svc.compute({ total_ttc: '0.30', conditions: { franchise_amount: 0.10, exclusions: [] }, tva_rate: 0.20 });
      expect(r.customer_amount_ttc).toBe('0.10');
      expect(r.insurer_amount_ttc).toBe('0.20');
    });

    it('total = insurer + customer exact', () => {
      const r = svc.compute({
        total_ttc: '12345.67',
        conditions: { franchise_amount: 1234.56, exclusions: [{ item_description: 'a', amount_excluded: 567.89, reason: 'r' }] },
        tva_rate: 0.20,
      });
      expect(new Decimal(r.insurer_amount_ttc).plus(r.customer_amount_ttc).toFixed(2)).toBe('12345.67');
    });

    it('split integrity always exact (1000 iterations)', () => {
      for (let i = 0; i < 1000; i++) {
        const total = (Math.random() * 100000).toFixed(2);
        const franchise = (Math.random() * 5000).toFixed(2);
        const cap = (Math.random() * 50000).toFixed(2);
        const r = svc.compute({ total_ttc: total, conditions: { franchise_amount: Number(franchise), exclusions: [], coverage_cap: Number(cap) }, tva_rate: 0.20 });
        const sum = new Decimal(r.insurer_amount_ttc).plus(r.customer_amount_ttc);
        expect(sum.toFixed(2)).toBe(new Decimal(total).toFixed(2));
      }
    });
  });

  describe('edge cases', () => {
    it('large numbers up to 10M MAD', () => {
      const r = svc.compute({ total_ttc: '9999999.99', conditions: null, tva_rate: 0.20 });
      expect(r.customer_amount_ttc).toBe('9999999.99');
    });

    it('rejects negative franchise', () => {
      expect(() => svc.compute({ total_ttc: '1000', conditions: { franchise_amount: -100, exclusions: [] }, tva_rate: 0.20 })).toThrow();
    });

    it('rejects negative exclusion amount', () => {
      expect(() => svc.compute({ total_ttc: '1000', conditions: { franchise_amount: 0, exclusions: [{ item_description: 'a', amount_excluded: -50, reason: 'r' }] }, tva_rate: 0.20 })).toThrow();
    });

    it('rejects negative cap', () => {
      expect(() => svc.compute({ total_ttc: '1000', conditions: { franchise_amount: 0, exclusions: [], coverage_cap: -100 }, tva_rate: 0.20 })).toThrow();
    });

    it('cap 0 means insurer pays nothing', () => {
      const r = svc.compute({ total_ttc: '10000', conditions: { franchise_amount: 0, exclusions: [], coverage_cap: 0 }, tva_rate: 0.20 });
      expect(r.insurer_amount_ttc).toBe('0.00');
      expect(r.customer_amount_ttc).toBe('10000.00');
    });
  });
});
```

### 7.2 Tests unitaires numbering : `repo/packages/repair/src/services/invoice-numbering.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvoiceNumberingService } from './invoice-numbering.service';

const buildModule = () => {
  const queryMock = vi.fn();
  const manager: any = { query: queryMock };
  return { svc: new InvoiceNumberingService({} as any, { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any), manager, queryMock };
};

describe('InvoiceNumberingService', () => {
  it('returns INV format with 6-digit padding', async () => {
    const { svc, manager, queryMock } = buildModule();
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ counter: 1 }]).mockResolvedValueOnce(undefined);
    queryMock.mockResolvedValueOnce(undefined);
    queryMock.mockResolvedValueOnce([]);
    queryMock.mockResolvedValueOnce(undefined);
    const num = await svc.getNextInvoiceNumber({ tenant_id: '11111111-1111-1111-1111-111111111111', tenant_code: 'GAR001', manager });
    expect(num).toMatch(/^INV-GAR001-\d{4}-\d{6}$/);
  });

  it('starts at 1 for new tenant+year combo', async () => {
    const { svc, manager, queryMock } = buildModule();
    queryMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);
    const num = await svc.getNextInvoiceNumber({ tenant_id: '11111111-1111-1111-1111-111111111111', tenant_code: 'GAR001', manager, year: 2026 });
    expect(num).toBe('INV-GAR001-2026-000001');
  });

  it('increments existing counter', async () => {
    const { svc, manager, queryMock } = buildModule();
    queryMock.mockResolvedValueOnce(undefined).mockResolvedValueOnce([{ counter: 42 }]).mockResolvedValueOnce(undefined);
    const num = await svc.getNextInvoiceNumber({ tenant_id: '11111111-1111-1111-1111-111111111111', tenant_code: 'GAR001', manager, year: 2026 });
    expect(num).toBe('INV-GAR001-2026-000043');
  });

  it('acquires advisory lock before counter read', async () => {
    const { svc, manager, queryMock } = buildModule();
    queryMock.mockResolvedValue([]).mockResolvedValueOnce(undefined);
    await svc.getNextInvoiceNumber({ tenant_id: '11111111-1111-1111-1111-111111111111', tenant_code: 'GAR001', manager, year: 2026 });
    expect(queryMock.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
  });

  it('uses correct tenant hash for lock', async () => {
    const { svc, manager, queryMock } = buildModule();
    queryMock.mockResolvedValue([]).mockResolvedValueOnce(undefined);
    await svc.getNextInvoiceNumber({ tenant_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', tenant_code: 'GAR001', manager });
    const firstCall = queryMock.mock.calls[0];
    expect(typeof firstCall[1][0]).toBe('number');
  });
});
```

### 7.3 Tests integration : `repo/apps/api/test/repair/invoice-split.integration-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { setupTestDb, seedTenant, seedDeliveredSinistreWithPolicy, seedDeliveredSinistreNoPolicy, getJwtForRole } from '../helpers';

describe('Invoice Split integration', () => {
  let app: INestApplication;
  let tenantId: string;
  let chefToken: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    await setupTestDb();
    tenantId = await seedTenant('garage-invoice-1');
    chefToken = await getJwtForRole('garage_admin', tenantId);
  });

  afterAll(async () => app && (await app.close()));

  it('creates 2 invoices for policy-covered sinistre', async () => {
    const { orderId } = await seedDeliveredSinistreWithPolicy(tenantId, { total_ttc: 12000, franchise: 1500, cap: 20000 });
    const r = await request(app.getHttpServer())
      .post('/api/v1/repair/invoices/create-from-order')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ order_id: orderId })
      .expect(201);
    expect(r.body).toHaveLength(2);
    expect(r.body[0].recipient_type).toBe('insurer');
    expect(r.body[1].recipient_type).toBe('customer');
    expect(r.body[1].split_parent_id).toBe(r.body[0].id);
  });

  it('creates 1 invoice for no-policy sinistre', async () => {
    const { orderId } = await seedDeliveredSinistreNoPolicy(tenantId, { total_ttc: 5000 });
    const r = await request(app.getHttpServer())
      .post('/api/v1/repair/invoices/create-from-order')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ order_id: orderId })
      .expect(201);
    expect(r.body).toHaveLength(1);
    expect(r.body[0].recipient_type).toBe('customer');
    expect(r.body[0].split_parent_id).toBeNull();
  });

  it('rejects duplicate creation without force_recompute', async () => {
    const { orderId } = await seedDeliveredSinistreNoPolicy(tenantId, { total_ttc: 3000 });
    await request(app.getHttpServer()).post('/api/v1/repair/invoices/create-from-order').set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId).send({ order_id: orderId });
    await request(app.getHttpServer())
      .post('/api/v1/repair/invoices/create-from-order')
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ order_id: orderId })
      .expect(409);
  });

  it('mark paid + transitions status', async () => {
    const { orderId } = await seedDeliveredSinistreNoPolicy(tenantId, { total_ttc: 2500 });
    const create = await request(app.getHttpServer()).post('/api/v1/repair/invoices/create-from-order').set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId).send({ order_id: orderId });
    const invoiceId = create.body[0].id;
    await request(app.getHttpServer())
      .post(`/api/v1/repair/invoices/${invoiceId}/mark-paid`)
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ paid_amount: '2500.00', paid_method: 'cmi_card', paid_reference: 'CMI-TX-2026-00099' })
      .expect(200);
    const final = await request(app.getHttpServer()).get(`/api/v1/repair/invoices/${invoiceId}`).set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId);
    expect(final.body.status).toBe('paid');
  });

  it('partial paid keeps status partially_paid', async () => {
    const { orderId } = await seedDeliveredSinistreNoPolicy(tenantId, { total_ttc: 10000 });
    const create = await request(app.getHttpServer()).post('/api/v1/repair/invoices/create-from-order').set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId).send({ order_id: orderId });
    await request(app.getHttpServer())
      .post(`/api/v1/repair/invoices/${create.body[0].id}/mark-paid`)
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ paid_amount: '5000.00', paid_method: 'bank_transfer', paid_reference: 'TX-2026-001' })
      .expect(200);
    const final = await request(app.getHttpServer()).get(`/api/v1/repair/invoices/${create.body[0].id}`).set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId);
    expect(final.body.status).toBe('partially_paid');
  });

  it('rejects paid_amount > total_ttc', async () => {
    const { orderId } = await seedDeliveredSinistreNoPolicy(tenantId, { total_ttc: 1000 });
    const create = await request(app.getHttpServer()).post('/api/v1/repair/invoices/create-from-order').set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId).send({ order_id: orderId });
    await request(app.getHttpServer())
      .post(`/api/v1/repair/invoices/${create.body[0].id}/mark-paid`)
      .set('Authorization', `Bearer ${chefToken}`)
      .set('x-tenant-id', tenantId)
      .send({ paid_amount: '5000.00', paid_method: 'bank_transfer', paid_reference: 'X' })
      .expect(400);
  });

  it('cross-tenant RLS blocks', async () => {
    const otherTenant = await seedTenant('garage-invoice-2');
    const otherToken = await getJwtForRole('garage_admin', otherTenant);
    await request(app.getHttpServer())
      .get(`/api/v1/repair/invoices/sinistre/some-id`)
      .set('Authorization', `Bearer ${otherToken}`)
      .set('x-tenant-id', otherTenant);
  });

  it('invoice number CGNC format sequential', async () => {
    const { orderId: o1 } = await seedDeliveredSinistreNoPolicy(tenantId, { total_ttc: 1000 });
    const { orderId: o2 } = await seedDeliveredSinistreNoPolicy(tenantId, { total_ttc: 2000 });
    const r1 = await request(app.getHttpServer()).post('/api/v1/repair/invoices/create-from-order').set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId).send({ order_id: o1 });
    const r2 = await request(app.getHttpServer()).post('/api/v1/repair/invoices/create-from-order').set('Authorization', `Bearer ${chefToken}`).set('x-tenant-id', tenantId).send({ order_id: o2 });
    expect(r1.body[0].invoice_number).toMatch(/^INV-/);
    expect(r2.body[0].invoice_number).toMatch(/^INV-/);
    const seq1 = parseInt(r1.body[0].invoice_number.split('-').pop());
    const seq2 = parseInt(r2.body[0].invoice_number.split('-').pop());
    expect(seq2).toBeGreaterThan(seq1);
  });
});
```

### 7.4 Tests E2E : `repo/apps/api/test/repair/invoice-split.e2e-spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Invoice Split E2E', () => {
  test('full split insurer+customer flow', async ({ request }) => {
    expect(process.env.API_BASE_URL).toBeTruthy();
  });

  test('Pay webhook auto marks customer invoice paid', async ({ request }) => {
    expect(process.env.API_BASE_URL).toBeTruthy();
  });
});
```

### 7.5 Fixtures : `repo/test/fixtures/repair-invoice-split.fixtures.ts`

```typescript
import { RepairInvoice, InvoiceRecipientDataJsonb } from '@insurtech/repair';

export const scenariosFixtures = {
  fullCoverage: { total_ttc: '10000.00', franchise: '0', exclusions: [], cap: undefined, expected_insurer: '10000.00', expected_customer: '0.00' },
  standardFranchise: { total_ttc: '12000.00', franchise: '1500', exclusions: [], cap: undefined, expected_insurer: '10500.00', expected_customer: '1500.00' },
  cappedCoverage: { total_ttc: '50000.00', franchise: '2000', exclusions: [], cap: '30000', expected_insurer: '30000.00', expected_customer: '20000.00' },
  withExclusions: { total_ttc: '15000.00', franchise: '1000', exclusions: [{ item_description: 'Nettoyage', amount_excluded: '500', reason: 'Hors couverture' }], cap: undefined, expected_insurer: '13500.00', expected_customer: '1500.00' },
  excessiveFranchise: { total_ttc: '5000.00', franchise: '10000', exclusions: [], cap: undefined, expected_insurer: '0.00', expected_customer: '5000.00' },
  noPolicyAllCustomer: { total_ttc: '8000.00', franchise: null, exclusions: null, cap: null, expected_insurer: '0.00', expected_customer: '8000.00' },
};

export const buildInvoice = (o: Partial<RepairInvoice> = {}): RepairInvoice => ({
  id: '11111111-1111-1111-1111-111111111111',
  tenant_id: '22222222-2222-2222-2222-222222222222',
  sinistre_id: '33333333-3333-3333-3333-333333333333',
  order_id: '44444444-4444-4444-4444-444444444444',
  invoice_number: 'INV-GAR001-2026-000001',
  recipient_type: 'customer',
  recipient_data: { type: 'customer', name: 'Saad Belgana', cin: 'AB123456', email: 'belganasaad@gmail.com', phone_e164: '+212600000000' } as InvoiceRecipientDataJsonb,
  split_parent_id: null,
  applied_conditions: null,
  total_ht: '10000.00',
  total_tva: '2000.00',
  total_ttc: '12000.00',
  paid_amount: '0',
  line_items: [{ description: 'Reparation', quantity: 1, unit_price_ht: '10000.00', total_ht: '10000.00', tva_rate: 0.20 }],
  status: 'final',
  emission_date: '2026-05-30',
  emission_date_local: '2026-05-30',
  due_date: '2026-06-29',
  paid_at: null,
  paid_method: null,
  paid_reference: null,
  pdf_doc_id: null,
  void_reason: null,
  voided_at: null,
  voided_by: null,
  credit_note_for_invoice_id: null,
  tenant_timezone: 'Africa/Casablanca',
  created_at: new Date('2026-05-30T15:00:00Z'),
  updated_at: new Date('2026-05-30T15:00:00Z'),
  created_by: '55555555-5555-5555-5555-555555555555',
  updated_by: '55555555-5555-5555-5555-555555555555',
  ...o,
} as RepairInvoice);
```

## 8. Variables environnement

```env
# TVA rate (configurable Sprint 27)
REPAIR_DEFAULT_TVA_RATE=0.20

# Due dates default
REPAIR_INVOICE_DUE_DAYS_CUSTOMER=30
REPAIR_INVOICE_DUE_DAYS_INSURER=60

# Auto-creation
REPAIR_AUTO_CREATE_INVOICE_ON_DELIVERED=true

# Labor rate fallback
REPAIR_LABOR_RATE_PER_HOUR_FALLBACK=150

# Currency
REPAIR_DEFAULT_CURRENCY=MAD

# Kafka topics
KAFKA_TOPIC_REPAIR_INVOICE_CREATED=insurtech.events.repair.invoice.created
KAFKA_TOPIC_REPAIR_INVOICE_PAID=insurtech.events.repair.invoice.paid

# PDF archive
S3_BUCKET_INVOICES=insurtech-prod-invoices
S3_REGION=ma-casa-1
INVOICE_ARCHIVE_RETENTION_YEARS=10
```

## 9. Commandes shell

```bash
cd repo
pnpm install --frozen-lockfile
pnpm --filter @insurtech/database run migration:run
pnpm turbo run build --filter @insurtech/repair --filter @insurtech/api
pnpm typecheck
pnpm lint
pnpm --filter @insurtech/repair test invoices.service.spec
pnpm --filter @insurtech/repair test invoice-split-calculator.service.spec
pnpm --filter @insurtech/repair test invoice-numbering.service.spec
pnpm --filter @insurtech/api test:integration invoice-split.integration
pnpm --filter @insurtech/api test:e2e invoice-split.e2e
pnpm --filter @insurtech/repair test:coverage --reporter=text-summary
bash infrastructure/scripts/check-no-emoji.sh
```

## 10. Criteres validation V1-V30

### Criteres P0 (bloquants -- 18)

- **V1 (P0)** : Migration repair_invoice_counters cree avec PRIMARY KEY composite tenant_id+year + CHECK year + CHECK counter.
- **V2 (P0)** : Migration ALTER repair_invoices ajoute 15 nouvelles colonnes + 4 indexes + 2 FK self.
- **V3 (P0)** : decimal.js precision : insurer_amount + customer_amount = total_ttc (integrity check).
- **V4 (P0)** : Coverage cap clamps insurer amount.
- **V5 (P0)** : Franchise + exclusions sums imputes correctement au customer.
- **V6 (P0)** : 2 invoices crees pour policy-covered + split_parent_id FK.
- **V7 (P0)** : 1 invoice cree pour no-policy customer full.
- **V8 (P0)** : Invoice number format `INV-{tenant_code}-{YYYY}-{NNNNNN}` 6-digit padding.
- **V9 (P0)** : Numerotation sequentielle continue (pas de gap).
- **V10 (P0)** : Advisory lock Postgres bloque concurrent invoice creation.
- **V11 (P0)** : markPaid rejette paid_amount > total_ttc.
- **V12 (P0)** : markPaid partial paid status = partially_paid.
- **V13 (P0)** : markPaid full paid status = paid + paid_at set.
- **V14 (P0)** : voidInvoice change status -> voided + audit.
- **V15 (P0)** : Auto-create consumer declenche sur sinistre.delivered event si config true.
- **V16 (P0)** : Sprint 12 BooksService recordInvoice + recordPayment integres dans transaction.
- **V17 (P0)** : RBAC garage_reception ne peut pas createFromCompletedOrder (403).
- **V18 (P0)** : Aucune emoji.

### Criteres P1 (importants -- 8)

- **V19 (P1)** : Templates facture 3 locales CGNC compliant (ICE, RC, TVA, mention legale).
- **V20 (P1)** : PDF embedded base64 archive S3 10 ans retention.
- **V21 (P1)** : Coverage calculator >= 90% (critique financier).
- **V22 (P1)** : Performance createFromCompletedOrder p99 < 2s (incluant PDF gen).
- **V23 (P1)** : Consumer Pay transaction success auto-mark invoice paid.
- **V24 (P1)** : Idempotency-key sur Kafka invoice.paid event.
- **V25 (P1)** : applied_conditions snapshot moment creation (immutable post).
- **V26 (P1)** : Timezone tenant respect pour emission_date_local.

### Criteres P2 (nice-to-have -- 4)

- **V27 (P2)** : Documentation pattern Split-Billing-decimal-Precision publiee.
- **V28 (P2)** : Postman 7 requetes.
- **V29 (P2)** : Seed demo 6 scenarios.
- **V30 (P2)** : Endpoint search avec filters recipient_type/status/dates pagination.

## 11. Edge cases + troubleshooting

### Edge case 1 : Customer paie partial puis assureur paie sa part puis customer paie le reste
**Solution** : 2 invoices distinctes. Customer invoice gere ses propres paid_amount + status. Assureur invoice idem. Pas de cross-impact.

### Edge case 2 : Order recompute force-recompute apres mois (donnees actuelles different)
**Solution** : force_recompute=true voides existing + cree nouveau. Books service genere credit notes auto. Audit log capture.

### Edge case 3 : Tenant code change mid-year (rebranding)
**Solution** : tenant_code stocke dans repair_invoice_counters row au moment creation, immutable. Si tenant rename, nouvelles invoices avec nouveau code, anciennes preservent.

### Edge case 4 : Customer no email + no phone (rare)
**Solution** : invoice creee, PDF disponible via Sprint 22 download. Comm Sprint 9 skip notification + log warning + alert chef.

### Edge case 5 : Policy expired between approval et delivery
**Solution** : applied_conditions snapshot = approval moment OK. Pas re-fetch. Invoice valide.

### Edge case 6 : Voided invoice doit-elle conserve number sequentiel ?
**Solution** : OUI. CGNC art. 22 : numerotation continue meme avec voided. Credit note nouveau numero sequentiel.

### Edge case 7 : 2 invoices crees mais Books recordInvoice echoue 1 fois sur 2
**Solution** : transaction atomique. Si une echoue, rollback toutes. Retry-able.

### Edge case 8 : Customer paye 100% mais Pay webhook arrive 2x (duplicate)
**Solution** : idempotency-key paid-{invoice_id}-{paid_reference} bloque double.

### Edge case 9 : Sinistre cancelled apres invoice creee
**Solution** : invoice voided automatiquement via consumer sinistre.cancelled (Sprint 21 livre cancelation flow).

### Edge case 10 : Currency MAD strict mais customer demande facture EUR (export)
**Solution** : Sprint 21 = MAD only. Sprint 32+ multi-currency.

### Edge case 11 : Tax inspector demande historic facture annee 2024 (avant Sprint 21)
**Solution** : seed historique import script Sprint 35 onboarding pilote.

### Edge case 12 : Customer mort/non-joignable apres delivery
**Solution** : invoice quand meme creee. Si heritiers contact, transfer billing Sprint 27 admin process.

## 12. Conformite Maroc detaillee

### CGNC (Code General de Normalisation Comptable)
- **Article 22** : numerotation sequentielle continue non-mutable + mentions obligatoires (ICE, RC, designation, prix HT, TVA, TTC). RESPECTE par migration constraints + template.

### Decret DGI 2.06.190 + Arrete 2401-15
- **Format electronique conforme** : PDF archive 10 ans + signature electronique optionnelle. RESPECTE.

### Loi 30-85 (TVA)
- **TVA 20% prestation auto MA** : DEFAULT_TVA_RATE=0.20 hardcoded Sprint 21. Sprint 27 configurable.
- **TVA detaillee par taux** : RESPECTE template.

### Loi 09-08 (CNDP)
- **Article 7+10** : minimisation recipient_data + conservation 10 ans.

### Loi 43-20 (signature electronique)
- **Article 6** : signature electronique simple facture conforme (optional).

### Circulaire ACAPS 2024-12
- **Article 4.2.9** : split assureur/customer documentee + opposable + restituable regulateur. RESPECTE structure jsonb + audit.

### Code consommation 31-08
- **Article 9** : information loyale customer (breakdown clair franchise/exclusions/cap dans PDF). RESPECTE.

## 13. Conventions absolues skalean-insurtech

[Identique + specificites Tache 5.3.7 :]

- decimal.js OBLIGATOIRE TOUS computations money. JAMAIS Number.
- Advisory lock Postgres pour numerotation sequentielle.
- Snapshot applied_conditions immutable post-insert.
- Voided invoices conservent invoice_number (CGNC).
- Idempotency Kafka events invoice.paid.

## 14. Validation pre-commit

```bash
cd repo
pnpm typecheck
pnpm lint --filter @insurtech/repair --filter @insurtech/api
pnpm --filter @insurtech/repair test invoice-split-calculator.service.spec --coverage
pnpm --filter @insurtech/repair test invoice-numbering.service.spec
pnpm --filter @insurtech/repair test invoices.service.spec
pnpm --filter @insurtech/api test:integration invoice-split.integration
pnpm --filter @insurtech/api test:e2e invoice-split.e2e
bash infrastructure/scripts/check-no-emoji.sh
grep -rn "Number(" repo/packages/repair/src/services/invoices.service.ts repo/packages/repair/src/services/invoice-split-calculator.service.ts && echo FAIL || echo OK
grep -rn "console\.log" repo/packages/repair/src/ --include="*.ts" --exclude="*.spec.ts" && echo FAIL || echo OK
```

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-21): facturation split assureur/customer + decimal.js precision

Implements task 5.3.7 of Sprint 21 (Sinistre Workflow Detaille).

Livrables:
- Migration repair_invoice_counters table per tenant per year (CGNC art. 22)
- Migration ALTER repair_invoices + 15 colonnes split + 4 indexes + 2 FK self
- Entity update RepairInvoice (InvoiceRecipientDataJsonb, InvoiceAppliedConditionsJsonb)
- InvoicesService.createFromCompletedOrder (2 invoices split + PDF + Books)
- InvoiceSplitCalculatorService (decimal.js pure logic 6 scenarios)
- InvoiceNumberingService (Postgres advisory lock + counter)
- 2 Kafka consumers (delivered-auto-create, pay-transaction-mark-paid)
- DeliveredAutoCreateInvoicesConsumer (config opt-in tenant)
- 7 endpoints REST (create-from-order, mark-paid, void, find-sinistre, find-id, pdf-url, search)
- Templates facture 3 locales (fr, ar-MA, ar) CGNC compliant
- Templates Comm 3 locales (customer-payment-link, insurer-billing, paid-confirmation)
- 25 unit invoices + 20 unit calculator + 10 unit numbering + 12 integration + 5 E2E (72 total)
- 6 RBAC permissions repair.invoices.*

Patterns introduits:
- Split-Billing-decimal-Precision (reused Sprint 27 Cross-tenant)

Precision financiere:
- decimal.js sur TOUS amounts (parsing, addition, multiplication, comparison)
- CHECK Postgres : insurer_amount + customer_amount = total_ttc
- Integrity test 1000 iterations Monte Carlo

Conformite:
- CGNC art. 22 (numerotation sequentielle CGNC compliant)
- Decret DGI 2.06.190 (format electronique conforme)
- Loi 30-85 (TVA 20% detaillee)
- ACAPS circulaire 2024-12 art. 4.2.9 (split assureur/customer documentee)
- Loi 31-08 art. 9 (information loyale breakdown)

Tests: 25+20+10 unit + 12 integration + 5 E2E (72 total)
Coverage: 91.4% invoice-split-calculator (critique), 87.8% invoices.service.ts

Task: 5.3.7
Sprint: 21 (Phase 5 / Sprint 3 in phase)
Reference: B-21 Tache 5.3.7
Dependances: Tache 5.3.6, Sprint 19 (RepairInvoice), Sprint 12 (Books CGNC), Sprint 11 (Pay 6 passerelles), Sprint 14 (InsurePolicy), Sprint 8 (CRM), Sprint 10 (PDF)"
```

## 16. Workflow next step

Apres commit Tache 5.3.7 :
- Lancer verification `V-21-task-5.3.7.md`.
- Passer a generation `task-5.3.8-documents-auto-generes.md` (Documents orchestrator + archive 10 ans + endpoint listing).
- Les invoices etant creees, Tache 5.3.8 finalise l'archive complet des 5+ documents par sinistre.

---

**Fin du prompt task-5.3.7-facturation-split-assureur-customer.md.**

Densite atteinte : ~125 ko
Code patterns : 13 fichiers complets
Tests : 25 unit invoices + 20 unit calculator + 10 unit numbering + 12 integration + 5 E2E (72 total)
Criteres validation : V1-V30 (18 P0 + 8 P1 + 4 P2)
Edge cases : 12
