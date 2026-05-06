# META-PROMPT B-14 -- SPRINT 14 INSURE FOUNDATION (Vertical Broker)

**Version** : v2.2 (Option B)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 14 / 35 (cumul) -- PREMIER de la Phase 4
**Position** : Apres Phase 3 horizontaux complete, debut Phase 4 vertical metier
**Numerotation taches** : 4.1.1 a 4.1.14
**Effort total** : ~80 heures developpement / 2 semaines
**Priorite** : P0 (premier sprint vertical, valide pattern reutilise pour tout Insure)

---

## Objectif Global du Sprint

Implementer **fondations Vertical Insure** : 7 entites lifecycle police (products, quotes, policies, avenants, premiums, renewals, commissions) + tarification engine basique + workflow signature police via Barid eSign (Sprint 10) + commissions courtier auto-calcul + reminders primes echues. Sprint 14 valide pattern vertical reutilise pour les 5 sprints suivants Phase 4.

A la sortie de ce sprint :
- 7 entites Insure operationnelles + RLS multi-tenant
- 5 branches initiales : auto / sante / multirisque habitation / RC pro / voyage
- Catalog products (Sprint 14 simple ; Sprint 15 enrichi par connecteurs assureurs)
- Workflow lifecycle police : prospect -> quote -> policy -> active -> renewal/cancel/expire
- Tarification engine : lookup tables tarifs basiques (IA Phase 7+ peut enrichir)
- Quotes generation : devis PDF avec tarification (utilise PdfGenerator Sprint 10)
- Souscription workflow : signature police via Barid eSign + auto-genere police signed PDF
- Commissions courtier auto-calcul (% configurable per produit/assureur)
- Cron renewals : 60 jours avant expiration, generate quote renouvellement
- Cron reminders primes : 15j/7j/3j avant echeance
- Auto-log interactions CRM (Sprint 8) sur events Insure
- Auto-eccritures comptables (Sprint 12) : commissions + primes encaissees
- Tests E2E exhaustifs

---

## Frontiere du Sprint

**INCLUS** :
- 7 entities Insure (products, quotes, policies, avenants, premiums, renewals, commissions)
- Catalog produits (CRUD super admin + lecture broker)
- Tarification engine basique (lookup tables)
- Quotes : devis generation + PDF + email
- Policies : souscription + signature workflow
- Avenants : modifications police active
- Premiums : echeancier paiements + tracking
- Renewals : cron + workflow renouvellement
- Commissions : auto-calcul + tracking
- Endpoints REST `/api/v1/insure/*`
- Integration cross-module Comm + Docs + Pay + Books + ACAPS reports

**EXCLU** (sera ajoute aux sprints suivants) :
- Connecteurs assureurs (Wafa, Atlanta, Saham, RMA, AXA) -- Sprint 15
- Lifecycle police avance (transferts, fractionnement) -- Sprint 16
- Workflow client web public -- Sprint 17 (vente en ligne)
- Self-service assure portal -- Sprint 19
- Tarification IA-powered (Sprint 30+ defere)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` -- tables insure_*
2. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles vertical Insure + ACAPS
3. Phase 3 modules horizontaux : tous prerequis bricks
4. ACAPS regulations : portefeuille polices + sinistres + solvabilite

## Dependencies Sprint precedents (explicites)

Ce Sprint 14 **depend critiquement** de :
- **Sprint 6** (Multi-Tenant 3 Niveaux + RLS) : tables `insure_*` activent RLS multi-tenant 3 niveaux (Niveau 1 Platform / Niveau 2 Tenant / Niveau 3 Assure L3) -- toutes queries respectent `app_current_tenant()`
- **Sprint 7** (RBAC Granulaire) : permissions `insure.products.read|write`, `insure.policies.*` definies dans 5-roles-permissions.md (12 roles x 85+ permissions)
- **Sprint 8** (CRM) : foreign keys `contacts` -- prospects/clients utilises dans quotes/policies
- **Sprint 10** (Docs + Signature 43-20) : Barid eSign workflow pour signature polices
- **Sprint 11** (Pay) : encaissement primes via 6 passerelles MA
- **Sprint 12** (Books) : auto-ecritures comptables commissions + primes
- **Sprint 13** (Analytics) : dashboards Insure consomment ETL ClickHouse

---

## Stack Imposee (Sprint 14)

| Composant | Version | Notes |
|-----------|---------|-------|
| decimal.js | 10.4.3 | tarification + commissions precision |
| date-fns | 4.1.0 | duration polices + renewals |
| zod | 3.24.1 | validation tarifs schemas |

Pas de nouvelle dep externe (utilise stack Phases 1-3).

---

## Vue d'Ensemble des 14 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 4.1.1 | insure_products entity + catalog 5 branches initiales (admin) | 6h | P0 | Phase 3 |
| 4.1.2 | Tarification engine basique (lookup tables) | 6h | P0 | 4.1.1 |
| 4.1.3 | insure_quotes entity + service + devis PDF generation | 7h | P0 | 4.1.2 |
| 4.1.4 | insure_policies entity + service + status workflow | 6h | P0 | 4.1.3 |
| 4.1.5 | Souscription workflow : quote -> policy via signature Barid eSign | 6h | P0 | 4.1.4 |
| 4.1.6 | insure_avenants entity + service (modifs police active) | 5h | P0 | 4.1.5 |
| 4.1.7 | insure_premiums entity + echeancier + tracking paiements | 5h | P0 | 4.1.6 |
| 4.1.8 | insure_renewals entity + cron renewal 60j avant expiration | 5h | P0 | 4.1.7 |
| 4.1.9 | insure_commissions entity + auto-calcul + integration Books | 5h | P0 | 4.1.8 |
| 4.1.10 | Cron reminders primes (J-15, J-7, J-3, post-echeance) | 4h | P0 | 4.1.9 |
| 4.1.11 | Auto-log interactions CRM Insure events + ACAPS data feed | 4h | P0 | 4.1.10 |
| 4.1.12 | Endpoints REST `/api/v1/insure/*` + permissions Insure | 6h | P0 | 4.1.11 |
| 4.1.13 | Dashboards Insure (extends Sprint 13 analytics) | 4h | P1 | 4.1.12 |
| 4.1.14 | Tests E2E (50+) + fixtures realistes 5 branches + seeds | 11h | P0 | 4.1.13 |

**Total** : 80 heures.

---

# DETAIL DES 14 TACHES

---

## Tache 4.1.1 -- insure_products Entity + Catalog 5 Branches

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 6h / Depend de Phase 3

**But** : Catalog produits assurance (5 branches initiales MVP) gere par super admin Skalean (templates) et personnalise per tenant broker (variantes commerciales).

**Contexte** : Architecture catalog 2 niveaux : 
- **Templates super admin** : produits de base par branche (e.g. "Assurance Auto Tout Risque", "Assurance Sante Famille")
- **Variantes tenant broker** : adaptations commerciales (prix, garanties optionnelles, conditions) basees sur templates

5 branches MVP : auto / sante / multirisque habitation / RC pro / voyage. Sprint 15 ajoutera connecteurs assureurs reels avec leurs catalog specifique.

**Livrables checkables** :
- [ ] Migration : table `insure_products` :
  - id, tenant_id (NULL = template super admin), parent_product_id (FK self -- variante reference template), name, code (UNIQUE per tenant), branche (enum 'auto' | 'sante' | 'multirisque_habitation' | 'rc_pro' | 'voyage'), insurer_id (FK Sprint 15 ; NULL Sprint 14), description, garanties (jsonb : array { name, description, capital_max, franchise }), exclusions (jsonb), conditions_generales_doc_id (FK doc Sprint 10), tarif_grille (jsonb : tarification rules basiques), commission_rate_percent (decimal), active, created_at
- [ ] Entity `repo/packages/insure/src/entities/insure-product.entity.ts`
- [ ] Service `products.service.ts` :
  - `createTemplate(data)` -- super admin only
  - `createVariant(parentId, data)` -- tenant broker (heritage template)
  - `findAll(filters)` -- liste products applicables au tenant (templates + ses variants)
  - `findById(id)`
  - `update(id, data)`
  - `archive(id)` -- soft delete + empeche nouvelles souscriptions
- [ ] Catalog seed 5 branches initiales :
  1. **Auto** : Tiers / Tiers+ / Tous Risques (3 produits template)
  2. **Sante** : Famille / Individuel / Senior (3 templates)
  3. **Multirisque Habitation** : Standard / Premium (2 templates)
  4. **RC Pro** : Generale / Specifique (avocats, medecins, etc.) (2 templates)
  5. **Voyage** : Court sejour / Long sejour (2 templates)
- [ ] Garanties typiques par branche pre-configurees (e.g. auto : RC obligatoire, vol, incendie, bris glace)
- [ ] Endpoints :
  - `POST /api/v1/admin/insure/products` (super admin templates)
  - `POST /api/v1/insure/products` (tenant variant)
  - `GET /api/v1/insure/products` (liste templates + variants tenant)
  - `GET /api/v1/insure/products/:id`
  - `PATCH /api/v1/insure/products/:id`
  - `POST /api/v1/insure/products/:id/archive`
- [ ] Permissions : `insure.products.create/read/update`, `admin.insure.products.create_template`
- [ ] Audit + Kafka events
- [ ] Tests : create template + variant + heritage + 5 branches seed

**Pattern critique : produit avec garanties JSONB**

```typescript
// Exemple template Auto Tous Risques
{
  name: "Assurance Auto Tous Risques",
  code: "AUTO-TR",
  branche: "auto",
  garanties: [
    {
      name: "RC obligatoire",
      description: "Responsabilite civile vis-a-vis tiers",
      capital_max: 1000000,                   // MAD
      franchise: 0,
      mandatory: true,
    },
    {
      name: "Dommages collision",
      description: "Reparation vehicule en cas de choc",
      capital_max: 500000,
      franchise: 5000,
      mandatory: false,
    },
    {
      name: "Vol",
      description: "Indemnisation vol vehicule",
      capital_max: null,                       // valeur vehicule
      franchise: 10000,
      mandatory: false,
    },
    {
      name: "Incendie",
      description: "Dommages incendie",
      capital_max: null,
      franchise: 0,
      mandatory: false,
    },
    {
      name: "Bris de glace",
      description: "Pare-brise + vitres",
      capital_max: 5000,
      franchise: 500,
      mandatory: false,
    },
  ],
  exclusions: [
    "Conduite sous emprise alcool / drogues",
    "Sinistre intentionnel",
    "Course / competition non autorisee",
  ],
  tarif_grille: {
    base_factors: { vehicle_value: 0.04, age: 0.02, region: 0.01 },
    discounts: { no_claim_bonus: 0.10, multi_policies: 0.05 },
    surcharges: { young_driver: 0.30, high_risk_zone: 0.15 },
  },
  commission_rate_percent: 12.5,
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsureProducts.ts                # ~80 lignes
repo/packages/insure/src/entities/insure-product.entity.ts                     # ~60 lignes
repo/packages/insure/src/services/products.service.ts                          # ~250 lignes
repo/packages/insure/src/schemas/product.schema.ts                              # ~80 lignes
repo/packages/insure/src/seeds/products-templates.ts                            # ~400 lignes (10+ templates 5 branches)
repo/apps/api/src/modules/insure/controllers/products.controller.ts            # ~150 lignes
repo/infrastructure/scripts/seed-insure-products.ts                              # ~100 lignes
```

**Notes implementation** :
- 2 niveaux catalog : flexibility business (Skalean templates evolutifs + brokers personnalisent)
- Garanties JSONB : structure flexible (Sprint 15 connecteurs assureurs ajouteront leurs garanties)
- Commission rate : configurable per product (Wafa peut negocier 15%, Atlanta 12%)
- Sprint 15 ajoutera `insurer_id` reference connecteur reel
- Conditions generales : doc PDF Sprint 10 (versioning)

**Criteres validation** :
- V1 (P0) : Migration creee + 5 branches enum
- V2 (P0) : Templates super admin only
- V3 (P0) : Variants tenant heritage parent
- V4 (P0) : 10+ templates seed crees
- V5 (P0) : Garanties JSONB structuree
- V6 (P0) : Commission rate per product
- V7 (P0) : Audit + Kafka events
- V8 (P0) : Tests 10+ scenarios

---

## Tache 4.1.2 -- Tarification Engine Basique (Lookup Tables)

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 6h / Depend de 4.1.1

**But** : Engine calcul prime annuelle a partir caracteristiques souscripteur + produit. Sprint 14 = lookup tables simples (multipliers per region, age, vehicle category, etc.). Sprint 30+ enrichira avec IA.

**Livrables checkables** :
- [ ] Service `repo/packages/insure/src/services/tarification.service.ts`
- [ ] Method `calculatePremium(productId, souscripteurData, garantiesSelected): { primeAnnuelle, breakdown }` :
  1. Get product `tarif_grille`
  2. Compute base : `base_factor x vehicle_value` (auto) or `base_factor x age x members_count` (sante) etc.
  3. Apply garanties selected (somme couts variables)
  4. Apply discounts/surcharges (e.g. no claim bonus, young driver)
  5. Apply commission rate
  6. Retourne breakdown detaille
- [ ] Lookup tables initiaux per branche :
  - **Auto** : prime base = 4% valeur vehicule + multipliers (age conducteur, zone geographique, anciennete permis, vehicule categorie)
  - **Sante** : prime base = 8000 MAD/an personne adulte + variations (age, antecedents medical bonus declares)
  - **Multirisque habitation** : 1500 MAD/an + 0.2% valeur biens declares
  - **RC pro** : depend metier (avocat 5000, medecin 8000, generale 3000)
  - **Voyage** : 50 MAD/jour + multiplier destination
- [ ] Inputs validation : Zod schemas per branche
- [ ] Tests : 5 branches x 5 scenarios = 25 tests calcul prime
- [ ] Cache lookup tables 1h Redis (eviter re-fetch DB chaque calcul)

**Pattern critique : tarification auto exemple**

```typescript
// repo/packages/insure/src/services/branche-calculators/auto.calculator.ts
async calculate(
  product: InsureProduct,
  souscripteurData: AutoSouscripteurData,
  garantiesSelected: string[],
): Promise<PrimeBreakdown> {
  const grille = product.tarif_grille;
  let base = new Decimal(souscripteurData.vehicleValue).mul(grille.base_factors.vehicle_value);

  // Apply age conductor multiplier
  if (souscripteurData.driverAge < 25) {
    base = base.mul(1 + grille.surcharges.young_driver); // +30%
  }

  // Apply region (Casablanca > Tanger > rural)
  const regionMultiplier = REGION_RISK_MULTIPLIERS[souscripteurData.region] ?? 1;
  base = base.mul(regionMultiplier);

  // Apply garanties optionnelles
  let garantiesCost = new Decimal(0);
  for (const garantieName of garantiesSelected) {
    const garantie = product.garanties.find(g => g.name === garantieName);
    if (!garantie || garantie.mandatory) continue;
    // Cost approximative (Sprint 15 connecteurs ajusteront avec assureurs)
    if (garantieName === 'Vol') garantiesCost = garantiesCost.plus(souscripteurData.vehicleValue * 0.005);
    if (garantieName === 'Bris de glace') garantiesCost = garantiesCost.plus(150);
    // ...
  }

  // Apply no-claim bonus
  if (souscripteurData.noClaimYears >= 3) {
    base = base.mul(1 - grille.discounts.no_claim_bonus); // -10%
  }

  const subtotalHt = base.plus(garantiesCost);
  // TVA 14% sur prime nette d'assurance MA (taux specifique assurance)
  const tvaInsurance = new Decimal('0.14');
  const tva = subtotalHt.mul(tvaInsurance);
  const total = subtotalHt.plus(tva);

  return {
    primeAnnuelle: total.toNumber(),
    breakdown: {
      base: base.toNumber(),
      garanties: garantiesCost.toNumber(),
      subtotal_ht: subtotalHt.toNumber(),
      tva,
      total,
    },
  };
}
```

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/tarification.service.ts                     # ~150 lignes (orchestrator)
repo/packages/insure/src/services/branche-calculators/auto.calculator.ts        # ~150 lignes
repo/packages/insure/src/services/branche-calculators/sante.calculator.ts       # ~120 lignes
repo/packages/insure/src/services/branche-calculators/habitation.calculator.ts  # ~100 lignes
repo/packages/insure/src/services/branche-calculators/rc-pro.calculator.ts      # ~100 lignes
repo/packages/insure/src/services/branche-calculators/voyage.calculator.ts      # ~100 lignes
repo/packages/insure/src/data/region-risk-multipliers.ts                         # MA regions data
repo/packages/insure/src/services/branche-calculators/{5}.spec.ts                # ~150 lignes chacun
```

**Notes implementation** :
- TVA 14% specifique assurance MA (vs 20% standard)
- Lookup tables hardcoded Sprint 14 ; Sprint 27 admin UI permettra editer
- Region multipliers : Casablanca x1.3, Tanger x1.1, etc.
- Sprint 30+ : IA peut consommer historique sinistres pour scoring risque
- decimal.js critique : computations financieres

**Criteres validation** :
- V1 (P0) : 5 calculators (1 par branche) implementent interface
- V2 (P0) : Auto : young driver +30%
- V3 (P0) : Auto : no claim bonus -10%
- V4 (P0) : Sante : age multiplier
- V5 (P0) : TVA 14% appliquee
- V6 (P0) : Cache lookup tables Redis
- V7 (P0) : Tests 25+ scenarios

---

## Tache 4.1.3 -- insure_quotes Entity + Devis PDF

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 7h / Depend de 4.1.2

**But** : Quotes (devis) entity + service generation devis PDF + envoi email + tracking acceptance.

**Livrables checkables** :
- [ ] Migration : table `insure_quotes` :
  - id, tenant_id, contact_id (FK CRM Sprint 8), product_id, branche, souscripteur_data (jsonb), garanties_selected (jsonb array), prime_breakdown (jsonb), prime_annuelle (numeric), validity_until (date), status (enum 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'), pdf_doc_id (FK), sent_at, accepted_at, rejected_at, rejected_reason, created_by
- [ ] Service `quotes.service.ts` :
  - `createQuote(contactId, productId, souscripteurData, garanties): Promise<Quote>` -- compute prime + INSERT draft
  - `sendQuote(id): Promise<void>` -- generate PDF + email contact + transition draft -> sent
  - `markAccepted(id)` -- transition + trigger souscription (Tache 4.1.5)
  - `markRejected(id, reason)`
  - `findAll(filters)`
- [ ] Validity : default 30 jours apres send (configurable)
- [ ] Cron job : expire quotes apres validity
- [ ] PDF devis : utilise PdfGeneratorService Sprint 10 + template `devis.hbs` (deja Sprint 10) + breakdown detaille
- [ ] Email envoi : utilise Comm orchestrator Sprint 9 + template `quote_generated`
- [ ] Endpoints :
  - `POST /api/v1/insure/quotes` (create draft + auto-tarification)
  - `POST /api/v1/insure/quotes/:id/send` (generate PDF + email)
  - `GET /api/v1/insure/quotes/:id`
  - `GET /api/v1/insure/quotes`
  - `POST /api/v1/insure/quotes/:id/accept` (peut etre client via portail Sprint 17 OU broker)
  - `POST /api/v1/insure/quotes/:id/reject`
- [ ] Permissions : `insure.quotes.create/read/send/accept`
- [ ] Audit + Kafka events `insure.quote_created/sent/accepted/rejected`
- [ ] Tests : full workflow + cron expire + PDF + email

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsureQuotes.ts                  # ~50 lignes
repo/packages/insure/src/entities/insure-quote.entity.ts                       # ~50 lignes
repo/packages/insure/src/services/quotes.service.ts                            # ~280 lignes
repo/packages/insure/src/jobs/expire-quotes.cron.ts                              # ~60 lignes
repo/apps/api/src/modules/insure/controllers/quotes.controller.ts              # ~150 lignes
```

**Notes implementation** :
- Auto-tarification a creation : `await this.tarificationService.calculate(...)` -> stocke breakdown dans quote
- Validity 30 jours : balance UX vs evolution tarifs (matchage perso pricing strategy)
- Quote -> Policy : Tache 4.1.5 workflow signature

**Criteres validation** :
- V1 (P0) : Create quote auto-tarification
- V2 (P0) : Send genere PDF + email
- V3 (P0) : Validity expiry cron
- V4 (P0) : Accept transition + trigger souscription
- V5 (P0) : Multi-tenant + RBAC
- V6 (P0) : Tests 12+ scenarios

---

## Tache 4.1.4 -- insure_policies Entity + Status Workflow

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 6h / Depend de 4.1.3

**But** : Policies entity + service avec status workflow strict (active -> renewal_requested / cancelled / expired).

**Livrables checkables** :
- [ ] Migration : table `insure_policies` :
  - id, tenant_id, policy_number (UNIQUE per tenant, format `POL-{branche}-{YYYY}-{seq}`), quote_id (FK), contact_id (FK CRM), product_id, branche, souscripteur_data (jsonb snapshot moment souscription), garanties (jsonb), prime_annuelle, start_date, end_date, status (enum 'pending_signature' | 'active' | 'cancelled' | 'expired' | 'in_renewal' | 'renewed'), signature_workflow_id (FK Sprint 10), conditions_doc_id, signed_doc_id, cancelled_at, cancelled_reason, expires_at, created_by
- [ ] Service `policies.service.ts` :
  - `createFromQuote(quoteId)` -- after signature complete
  - `cancel(id, reason)` -- mid-term cancel (avec proratisation premium)
  - `expire(id)` -- end_date reached
  - `findAll(filters)`
  - `findById(id)` (avec relations contact + product + premiums)
- [ ] Status workflow strict avec validation
- [ ] Numerotation policy_number sequentiel UNIQUE per tenant + format `POL-AUTO-2026-00001`
- [ ] Endpoints :
  - `GET /api/v1/insure/policies` (filtres : status, contact, branche, expiring_soon)
  - `GET /api/v1/insure/policies/:id`
  - `POST /api/v1/insure/policies/:id/cancel` (body: reason)
  - `GET /api/v1/insure/policies/:id/timeline` (history events)
- [ ] Audit + Kafka events
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsurePolicies.ts               # ~70 lignes
repo/packages/insure/src/entities/insure-policy.entity.ts                     # ~60 lignes
repo/packages/insure/src/services/policies.service.ts                          # ~250 lignes
repo/packages/insure/src/services/policy-numbering.service.ts                  # ~80 lignes
repo/apps/api/src/modules/insure/controllers/policies.controller.ts           # ~180 lignes
```

**Criteres validation** :
- V1 (P0) : policy_number sequentiel format correct
- V2 (P0) : Status workflow transitions valid only
- V3 (P0) : Cancel avec reason + audit
- V4 (P0) : Filtres expiring_soon = end_date < NOW + 60j
- V5 (P0) : Tests 10+ scenarios

---

## Tache 4.1.5 -- Souscription Workflow : Quote -> Policy via Signature

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 6h / Depend de 4.1.4

**But** : Workflow complete : quote accepted -> generate police PDF non-signee -> send Barid eSign signature -> webhook complete -> create policy active + apply ANRT timestamp + archive.

**Livrables checkables** :
- [ ] Service `souscription.service.ts`
- [ ] Method `initiateSouscription(quoteId): Promise<{ policy_id, signing_workflow_id }>` :
  1. Quote doit etre status='accepted'
  2. Generate policy PDF (utilise PdfGenerator Sprint 10 + template `police.hbs`)
  3. Create policy row status='pending_signature'
  4. Create SigningWorkflow Sprint 10 + signers [souscripteur]
  5. Send Barid eSign
- [ ] Consumer `signature-completed.consumer.ts` :
  - Listen Kafka event `signature.workflow_completed`
  - Si workflow_id = policy.signature_workflow_id : transition policy status -> 'active' + set signed_doc_id + apply ANRT timestamp + archive
  - Trigger creation premiums Tache 4.1.7
  - Trigger commission Tache 4.1.9
- [ ] Endpoint `POST /api/v1/insure/quotes/:id/initiate-souscription`
- [ ] Tests : full workflow happy path + signature decline + signature expired

**Pattern critique : workflow souscription complete**

```typescript
// repo/packages/insure/src/services/souscription.service.ts
async initiateSouscription(quoteId: string): Promise<SouscriptionResult> {
  const quote = await this.quotesRepo.findOne({ where: { id: quoteId, status: 'accepted' } });
  if (!quote) throw new BadRequestException({ code: 'QUOTE_NOT_ACCEPTED' });

  const contact = await this.contactsService.findById(quote.contact_id);
  const product = await this.productsService.findById(quote.product_id);

  // 1. Generate policy number
  const policyNumber = await this.policyNumbering.next(quote.branche);

  // 2. Create policy row pending_signature
  const policy = await this.policiesRepo.save({
    tenant_id: getCurrentTenantId(),
    policy_number: policyNumber,
    quote_id: quoteId,
    contact_id: contact.id,
    product_id: product.id,
    branche: quote.branche,
    souscripteur_data: quote.souscripteur_data,
    garanties: quote.garanties_selected,
    prime_annuelle: quote.prime_annuelle,
    start_date: addDays(new Date(), 1), // demarrage J+1 par defaut
    end_date: addYears(addDays(new Date(), 1), 1),
    status: 'pending_signature',
  });

  // 3. Generate police PDF
  const pdfBuffer = await this.pdfGenerator.generate('police', contact.preferred_language, {
    policy, contact, product, garanties: quote.garanties_selected, prime: quote.prime_breakdown,
  });
  const pdfDoc = await this.documentService.create({
    type: 'police', title: `Police ${policyNumber}`, file: pdfBuffer,
    related_resource_type: 'insure_policy', related_resource_id: policy.id,
  });

  // 4. Create SigningWorkflow + send Barid eSign
  const signingWorkflow = await this.signingWorkflowService.createWorkflow(pdfDoc.id, [{
    name: `${contact.first_name} ${contact.last_name}`,
    email: contact.email,
    phone: contact.phone,
    role: 'signer', order: 1,
  }], { signature_type: 'qualified', expires_in_days: 14 });

  await this.signingWorkflowService.sendForSignature(signingWorkflow.id);

  // 5. Update policy with signature_workflow_id + conditions_doc
  await this.policiesRepo.update(policy.id, {
    signature_workflow_id: signingWorkflow.id,
    conditions_doc_id: pdfDoc.id,
  });

  // 6. Audit + Kafka
  await this.kafkaPublisher.publish(Topics.INSURE_POLICY_PENDING_SIGNATURE, { /* ... */ });

  return { policy_id: policy.id, signing_workflow_id: signingWorkflow.id };
}
```

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/souscription.service.ts                     # ~250 lignes
repo/packages/insure/src/consumers/signature-completed.consumer.ts             # ~150 lignes
repo/apps/api/src/modules/insure/controllers/souscription.controller.ts       # ~80 lignes
```

**Notes implementation** :
- Workflow critical : echec partout = inconsistance metier (police signee mais pas premium cree)
- Idempotency : signature event redelivered ne double pas activate policy
- start_date J+1 : permet jour souscription (legal MA)
- end_date = start_date + 1 an (annuel renouvelable)
- Apres signature complete : ANRT timestamp + archive 10 ans (loi 43-20)

**Criteres validation** :
- V1 (P0) : Initiate souscription cree policy + signing workflow
- V2 (P0) : Signature completed -> policy active + premiums + commission
- V3 (P0) : Signature declined -> policy cancelled
- V4 (P0) : Signature expired -> policy expired
- V5 (P0) : Idempotency consumer
- V6 (P0) : Tests E2E full flow 8+ scenarios

---

## Tache 4.1.6 -- insure_avenants Entity + Service

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 5h / Depend de 4.1.5

**But** : Avenants (modifications police active) : ajout/retrait garanties + recalcul prime + workflow signature similaire.

**Livrables checkables** :
- [ ] Migration : table `insure_avenants` :
  - id, tenant_id, policy_id (FK), avenant_number (UNIQUE par policy), type (enum 'addition_garantie' | 'suppression_garantie' | 'modification_capital' | 'changement_donnees_souscripteur'), changes (jsonb : delta), prime_annuelle_after (numeric, recalcul), prime_complement (numeric : ajustement pro-rata), effective_date, signature_workflow_id, status (enum 'pending_signature' | 'active' | 'rejected'), created_by, created_at
- [ ] Service `avenants.service.ts` :
  - `createAvenant(policyId, type, changes)` -- recalcul + workflow signature
  - Recalcul prime via TarificationService Tache 4.1.2
  - Pro-rata : calcul complement prime selon jours restants police
  - Workflow signature similaire Tache 4.1.5
- [ ] Endpoints :
  - `POST /api/v1/insure/policies/:id/avenants`
  - `GET /api/v1/insure/policies/:id/avenants`
- [ ] Tests : create + signature + impact prime

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsureAvenants.ts               # ~50 lignes
repo/packages/insure/src/entities/insure-avenant.entity.ts                    # ~40 lignes
repo/packages/insure/src/services/avenants.service.ts                          # ~250 lignes
repo/apps/api/src/modules/insure/controllers/avenants.controller.ts           # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Create avenant ajout garantie
- V2 (P0) : Recalcul prime + complement pro-rata
- V3 (P0) : Workflow signature trigger
- V4 (P0) : Tests 8+ scenarios

---

## Tache 4.1.7 -- insure_premiums Echeancier + Tracking

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 5h / Depend de 4.1.6

**But** : Premiums echeancier paiement (annuel ou fractionne mensuel/trimestriel) + tracking paiements via Pay Sprint 11.

**Livrables checkables** :
- [ ] Migration : table `insure_premiums` :
  - id, tenant_id, policy_id (FK), echeance_number (1, 2, 3...), amount (numeric), due_date, paid_amount, paid_at, status (enum 'pending' | 'paid' | 'overdue' | 'partial'), pay_transaction_id (FK Sprint 11), reminder_sent_at (jsonb : timestamps reminders envoyes)
- [ ] Service `premiums.service.ts` :
  - `createSchedule(policyId, frequency: 'annual' | 'quarterly' | 'monthly')` -- generate echeances
  - `markPaid(premiumId, payTransactionId)` -- consumer Kafka pay event
  - `markOverdue(premiumId)` -- cron daily
  - `findByPolicy(policyId)`
- [ ] Annual frequency : 1 echeance prime_annuelle a start_date
- [ ] Quarterly : 4 echeances prime/4 + supplement 5% (frais fractionnement)
- [ ] Monthly : 12 echeances prime/12 + supplement 8%
- [ ] Consumer Kafka `pay.transaction_captured` :
  - Si related_resource_type='insure_premium' : update premium status='paid'
  - Trigger ecriture comptable (Sprint 12 deja consumer general)
- [ ] Endpoints :
  - `GET /api/v1/insure/policies/:id/premiums`
  - `POST /api/v1/insure/premiums/:id/pay` (initiate Pay)
- [ ] Audit + Kafka events
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsurePremiums.ts               # ~50 lignes
repo/packages/insure/src/entities/insure-premium.entity.ts                    # ~40 lignes
repo/packages/insure/src/services/premiums.service.ts                          # ~200 lignes
repo/packages/insure/src/consumers/pay-to-premium.consumer.ts                  # ~100 lignes
repo/apps/api/src/modules/insure/controllers/premiums.controller.ts           # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Schedule annual / quarterly / monthly
- V2 (P0) : Pay capture -> premium paid auto
- V3 (P0) : Overdue cron daily
- V4 (P0) : Tests 8+ scenarios

---

## Tache 4.1.8 -- insure_renewals Cron 60j Avant Expiration

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 5h / Depend de 4.1.7

**But** : Cron job auto-detect polices expirant dans 60 jours + generate renewal quote + envoie email proposal.

**Livrables checkables** :
- [ ] Migration : table `insure_renewals` :
  - id, tenant_id, policy_id (FK), renewal_quote_id (FK insure_quotes), status (enum 'proposed' | 'accepted' | 'declined' | 'expired'), proposed_at, accepted_at, declined_at, declined_reason, new_policy_id (FK insure_policies si renewed)
- [ ] Service `renewals.service.ts` :
  - `proposeRenewal(policyId)` -- generate quote with same product/garanties + envoyer email
  - `acceptRenewal(renewalId)` -- trigger souscription new policy + cancel old expiry
  - `declineRenewal(renewalId, reason)`
- [ ] Cron job daily : `findPoliciesExpiringIn(60)` -> propose renewal pour chaque
- [ ] Quote renewal : meme product + garanties + recalcul tarification (peut changer)
- [ ] Endpoints :
  - `POST /api/v1/insure/policies/:id/propose-renewal` (manual trigger)
  - `POST /api/v1/insure/renewals/:id/accept`
  - `POST /api/v1/insure/renewals/:id/decline`
- [ ] Tests : cron + workflow

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsureRenewals.ts                # ~40 lignes
repo/packages/insure/src/entities/insure-renewal.entity.ts                    # ~35 lignes
repo/packages/insure/src/services/renewals.service.ts                          # ~200 lignes
repo/packages/insure/src/jobs/renewal-cron.job.ts                              # ~100 lignes
repo/apps/api/src/modules/insure/controllers/renewals.controller.ts           # ~100 lignes
```

**Criteres validation** :
- V1 (P0) : Cron daily detect expiring 60j
- V2 (P0) : Renewal quote genere + email envoyee
- V3 (P0) : Accept renewal -> new policy
- V4 (P0) : Tests 6+ scenarios

---

## Tache 4.1.9 -- insure_commissions Auto-Calcul + Books

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 5h / Depend de 4.1.8

**But** : Auto-calcul commission courtier a chaque police active + tracking + integration Books (ecriture compte 706 produits).

**Livrables checkables** :
- [ ] Migration : table `insure_commissions` :
  - id, tenant_id, policy_id (FK), premium_id (FK -- commission per echeance OU per policy), amount (numeric), commission_rate_percent, status (enum 'pending' | 'collected' | 'paid_to_broker'), collected_at, paid_at, journal_entry_id (FK books)
- [ ] Service `commissions.service.ts` :
  - `calculate(policyId, premiumId): Decimal` -- prime x commission_rate_percent
  - `recordCommission(policyId, premiumId)` -- INSERT row + create journal entry (Sprint 12 : 411 client / 706 commissions)
- [ ] Trigger via consumer Kafka `insure.premium_paid` -> recordCommission
- [ ] Endpoint `GET /api/v1/insure/commissions` (filtres + stats)
- [ ] Stats : total commissions YTD, per branche, per assureur
- [ ] Tests : calcul + journal entry creation

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsureCommissions.ts             # ~40 lignes
repo/packages/insure/src/entities/insure-commission.entity.ts                  # ~35 lignes
repo/packages/insure/src/services/commissions.service.ts                       # ~200 lignes
repo/packages/insure/src/consumers/premium-paid-to-commission.consumer.ts      # ~120 lignes
repo/apps/api/src/modules/insure/controllers/commissions.controller.ts        # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Calcul commission correct (prime x rate)
- V2 (P0) : Premium paid -> commission recorded auto
- V3 (P0) : Journal entry creee
- V4 (P0) : Stats agreges
- V5 (P0) : Tests 8+ scenarios

---

## Tache 4.1.10 -- Cron Reminders Primes Echues

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 4h / Depend de 4.1.9

**But** : Cron jobs envoyant reminders primes a echeance : J-15, J-7, J-3 + post-echeance (overdue).

**Livrables checkables** :
- [ ] Cron job daily `premium-reminders.job.ts` :
  - Find premiums status='pending', due_date in [J-15, J-7, J-3, J-0, J+3, J+7, J+15]
  - Pour chaque : envoie reminder via Comm orchestrator (Sprint 9) + template `payment_due_reminder`
  - Track `reminder_sent_at` jsonb pour eviter doublons
- [ ] Templates Comm 3 locales pre-remplis (Sprint 9 deja templates)
- [ ] Escalade : J+15 overdue -> notify broker + super admin tenant (action requise)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/insure/src/jobs/premium-reminders.cron.ts                        # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Cron daily emit reminders
- V2 (P0) : Anti-doublon via reminder_sent_at
- V3 (P0) : Escalade J+15 super admin
- V4 (P0) : Tests 6+ scenarios

---

## Tache 4.1.11 -- Auto-Log Interactions CRM + ACAPS Data Feed

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 4h / Depend de 4.1.10

**But** : Consumer Kafka events Insure -> auto-log interactions CRM Sprint 8 (timeline contact) + alimente ACAPS reports Sprint 12 (feed donnees reelles).

**Livrables checkables** :
- [ ] Consumer `insure-events-to-crm.consumer.ts` :
  - Listen events `insure.policy_signed`, `insure.policy_cancelled`, `insure.premium_paid`, `insure.quote_sent`
  - Auto-log interaction CRM type='note' avec content = "Police POL-AUTO-2026-00042 signee"
- [ ] Update ACAPS reports (Sprint 12) : utiliser donnees reelles polices au lieu fixtures
- [ ] Sprint 12 reports auto-enrichis :
  - quarterly_portfolio_report consume `insure_policies` + `insure_quotes`
  - quarterly_claims_report consume `repair_sinistres` (Sprint 22 ajoutera)
- [ ] Endpoint resync ACAPS data : `POST /api/v1/admin/acaps/resync-source-data`
- [ ] Tests integration

**Fichiers crees / modifies** :
```
repo/packages/crm/src/consumers/insure-events-to-crm.consumer.ts               # ~150 lignes
repo/packages/compliance/src/services/quarterly-portfolio-report.service.ts    # update : query reelle data
```

**Criteres validation** :
- V1 (P0) : Insure events -> CRM interactions logged
- V2 (P0) : ACAPS reports utilisent donnees reelles
- V3 (P0) : Tests 6+ scenarios

---

## Tache 4.1.12 -- Endpoints REST + Permissions

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 6h / Depend de 4.1.11

**But** : Consolidation endpoints `/api/v1/insure/*` + permissions Insure dans matrice RBAC Sprint 7.

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes (consolidation)
- [ ] Permissions ajoutees catalog (Sprint 7) :
  - `insure.products.create/read/update`
  - `insure.quotes.create/send/accept/reject`
  - `insure.policies.read/cancel/avenant`
  - `insure.premiums.read/pay`
  - `insure.renewals.propose/accept/decline`
  - `insure.commissions.read`
- [ ] Mise a jour PermissionsMatrix Sprint 7 : roles broker_* avec permissions Insure
- [ ] Tests permissions per role

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/permissions.enum.ts                                # update : ajout permissions Insure
repo/packages/auth/src/rbac/permissions-matrix.ts                               # update : roles broker_* enrichis
repo/apps/api/test/insure/permissions.e2e-spec.ts                               # tests RBAC
```

**Criteres validation** :
- V1 (P0) : 15+ permissions Insure ajoutees
- V2 (P0) : Roles broker_admin/user/assistant : permissions correctes
- V3 (P0) : Tests RBAC 10+ scenarios

---

## Tache 4.1.13 -- Dashboards Insure

**Metadonnees** : Phase 4 / Sprint 14 / P1 / 4h / Depend de 4.1.12

**But** : Etendre dashboards Sprint 13 avec metriques Insure-specific.

**Livrables checkables** :
- [ ] Dashboards added :
  - `GET /api/v1/analytics/dashboards/insure-portfolio` (count polices per branche + total premium volume)
  - `GET /api/v1/analytics/dashboards/insure-conversion` (quote -> policy conversion rate)
  - `GET /api/v1/analytics/dashboards/insure-renewals` (renewal acceptance rate)
  - `GET /api/v1/analytics/dashboards/insure-commissions` (commissions YTD per assureur)
- [ ] ETL Sprint 13 : add tables fct_policies + fct_quotes + fct_commissions a sync
- [ ] Cache Redis 5min
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts                  # update : sync fct_policies
repo/infrastructure/clickhouse/schemas/fct_{policies,quotes,commissions}.sql   # 3 tables
repo/apps/api/src/modules/analytics/services/insure-dashboards.service.ts      # ~200 lignes
```

**Criteres validation** :
- V1 (P1) : 4 dashboards Insure
- V2 (P1) : ETL etendu
- V3 (P1) : Tests 6+ scenarios

---

## Tache 4.1.14 -- Tests E2E (50+) + Fixtures + Seeds

**Metadonnees** : Phase 4 / Sprint 14 / P0 / 11h / Depend de 4.1.13

**But** : Suite tests E2E exhaustive + fixtures realistes 5 branches + seeds dev complete.

**Livrables checkables** :

**Tests E2E (50+)** :
- [ ] Products : CRUD templates + variants + 5 branches (8)
- [ ] Tarification : 5 calculators x 5 scenarios = 25 (25)
- [ ] Quotes : create + send + accept + reject + expire (5)
- [ ] Policies : create from quote + signature + cancel + expire (5)
- [ ] Avenants : workflow + recalcul prime (3)
- [ ] Premiums : annual / quarterly / monthly + payment integration (4)
- [ ] Renewals : cron + accept + decline (3)
- [ ] Commissions : auto-calcul + journal entry (3)

**Fixtures** :
- 50 polices actives (10 par branche) avec premiums + commissions historiques
- 30 quotes en cours (mix accepted, sent, draft)
- 10 renewals proposees

**Seeds** :
- `seed-insure.ts` : products templates + fixtures complete

**Fichiers crees / modifies** :
```
repo/apps/api/test/insure/{50+ specs}.e2e-spec.ts
repo/infrastructure/scripts/seed-insure.ts                                     # ~400 lignes
```

**Criteres validation** :
- V1 (P0) : 50+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Fixtures realistes 5 branches
- V4 (P0) : Reproducibility 5x

---

## Sortie du Sprint 14

A la fin de l'execution des 14 taches :

```
Insure Foundation operational :
  - 7 entities : products, quotes, policies, avenants, premiums, renewals, commissions
  - Catalog 5 branches (auto / sante / habitation / RC pro / voyage)
  - 10+ products templates super admin
  - Tarification engine basique (5 calculators per branche)
  - Quotes -> Policies workflow avec signature Barid eSign + ANRT timestamp + archive
  - Premiums echeancier (annual / quarterly / monthly)
  - Renewals cron 60j + workflow
  - Commissions auto-calcul + integration Books
  - Reminders primes (J-15/J-7/J-3 + overdue J+3/J+7/J+15)
  - Auto-log interactions CRM + ACAPS data feed
  - 4 dashboards Insure-specific

50+ tests E2E exhaustifs
```

**Sprint 15 (Insure Connecteurs Assureurs) demarre avec** :
- Foundation Insure operationnelle
- Connecteurs API : Wafa Assurance, Atlanta Assurance, Saham, RMA, AXA
- Tarification reelle assureurs (vs lookup tables Sprint 14)
- Synchronisation polices + sinistres bidirectionnel

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-4.1.X-*.md` dans `00-pilotage/prompts-taches/sprint-14-insure-foundation/`.

**Patterns code inline conserves** : produit avec garanties JSONB exemple Auto, tarification auto calculator avec decimal.js + TVA 14% MA, workflow souscription complete (6 etapes).

**Reference** : `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` couvre tables insure_*.

---

**Fin du meta-prompt B-14 v2.2 format Option B.**
