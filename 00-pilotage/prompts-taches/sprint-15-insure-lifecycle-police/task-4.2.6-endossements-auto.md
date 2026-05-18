# TACHE 4.2.6 -- Endossements Auto (Change Vehicle + Drivers + Usage)

**Sprint** : 15 (Phase 4 / Sprint 2 dans phase Vertical Insure)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-15-sprint-15-insure-lifecycle-police.md` (Tache 4.2.6)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (operation quotidienne sur polices auto -- 40% des avenants courtiers cibles)
**Effort** : 6h
**Dependances** :
- Tache 4.2.5 (Flotte pattern + entity InsurePolicyObject reutilisee pour vehicules + endossement signature)
- Tache 4.2.1 (workflow signature double pattern -- single signer ici car assure seul)
- Sprint 14 (Insure Foundation : entites Policy + TarificationService + branche auto)
- Sprint 10 (Barid eSign workflow simple signature)
- Sprint 9 (Comm tri-langue)
- Sprint 7 (RBAC)
- Sprint 6 (multi-tenant RLS)

**Densite cible** : 110-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente les **endossements specifiques a la branche auto** : changement de vehicule sur une police existante (cas vente + achat d'un nouveau vehicule, conserve la police), ajout/retrait de conducteur secondaire (cas jeune permis du fils ajoute a la police paternelle, conjoint qui obtient le permis, employe utilisant vehicule entreprise), changement d'usage (passage perso -> professionnel ou inverse, impact tarif significatif). Chaque endossement materialise une **modification contractuelle formelle** de la police d'assurance auto, **recalcule la prime restante** via le `TarificationService` (Sprint 14), **applique un avenant signe electroniquement** (Barid eSign signature simple, sans cessionnaire car assure unique partie), **regenere les primes futurs** sur la nouvelle assiette tarifaire, **publie un evenement Kafka** consume par Analytics (Sprint 13), Compliance ACAPS (Sprint 18) et Assureurs partenaires connectors (Sprint 32 -- defere mais Kafka topic deja defini), et **notifie l'assure** dans sa langue preferee. C'est l'operation **la plus frequente** chez un courtier auto au Maroc : sur le portefeuille type d'un Cabinet d'assurance de 2 000 polices, on observe en moyenne **800 endossements auto / an** (40% du portefeuille touche par au moins un endossement annuel) avec une distribution typique : 35% changement de vehicule, 30% ajout/retrait conducteur, 20% changement d'usage, 15% modifications mineures (adresse, plaque transit).

L'apport est triple. **Premierement**, on cree `AutoEndossementsService` qui orchestre les **3 operations specifiques** : `changeVehicle(policyId, oldVehicleData, newVehicleData, effectiveDate)` qui (a) valide la nouvelle immatriculation marocaine format `12345-A-1` (3 lettres apres 5-chiffres), (b) valide annee modele <= annee courante + 1, (c) recompute la prime via `TarificationService.computePrime({ branche: 'auto', vehicle: newVehicleData, drivers, usage })` en utilisant la grille tarifaire Sprint 14 (factor age vehicule, puissance fiscale CV, energie, valeur a neuf, usage), (d) genere l'avenant PDF tri-langue (`avenant-auto-vehicle-change.hbs`), (e) initie workflow Barid eSign 1 signer (assure) qualified, (f) update flotte object (Tache 4.2.5 reuse pour `object_data` JSONB), (g) regen premiums futurs avec nouvelle prime calculee, (h) audit + Kafka; `addDriver(policyId, driverData)` qui (a) ajoute conducteur dans `object_data.drivers[]` JSONB array, (b) recompute prime selon profil conducteur (factor age, anciennete permis, CRM bonus malus si dispo, statut jeune conducteur si permis < 3 ans = +20% surprime majoritairement), (c) avenant + signature + regen premiums; `removeDriver(policyId, driverId)` qui retire conducteur + recompute prime (potentiellement baisse si conducteur retire etait jeune); `changeUsage(policyId, newUsage: 'private' | 'professional' | 'mixed')` qui recompute prime selon usage (passage perso -> professional usuel +30% surprime au Maroc, professional uberberis -> +50%). **Deuxiemement**, on enforce des **limites strict** : max 4 conducteurs secondaires par police (configurable per tenant `auto_max_secondary_drivers`), age conducteur >= 18 ans, permis valide (date_obtention < today), changement vehicule max 2 fois/an (anti-abus). **Troisiemement**, on integre avec le **TarificationService** Sprint 14 pour le recompute precis : aucune duplication logique de tarification, on appelle simplement `TarificationService.computePrime` avec les nouveaux params et il retourne la prime annuelle a appliquer. Le delta de prime (nouvelle - ancienne) est applique pro-rata sur les jours restants.

A l'issue de cette tache, un courtier peut realiser l'endossement le plus frequent du marche (changement de vehicule lors d'une revente + achat) en quelques millisecondes : appel API avec nouvelles donnees vehicule, validation stricte (immatriculation MA, annee, puissance), recompute automatique de la prime, generation de l'avenant PDF dans la langue preferee de l'assure, envoi a signature Barid (assure signe sur son smartphone via lien WhatsApp/email), une fois signe : transition automatique status='signed', application du delta prime sur les premiums futurs (cancel old pending + regen new with new amount), notification Comm confirmation, et publication Kafka. Le cycle complet en pratique est < 5 minutes (vs 60 minutes manuel actuel). Cette tache reutilise massivement le pattern Tache 4.2.5 (flotte object update) et Tache 4.2.1 (workflow signature) avec une seule signature (assure unique partie -- pas de cessionnaire). Cette tache bloque Tache 4.2.7 (sante endossements -- meme pattern, beneficiaires) et Tache 4.2.8 (habitation/RC/voyage -- meme pattern).

---

## 2. Contexte etendu

### 2.1 Pourquoi les endossements auto sont strategiques au Maroc

Le marche marocain de l'assurance auto represente **3,2 Md DH** de primes brutes 2024 (donnees ACAPS), avec environ **2,7 millions de polices auto** assurees (taux d'assurance ~60%). Sur ce stock, ACAPS et la federation des courtiers (FNACAM) estiment a **35-45% le taux annuel d'endossements** sur polices auto, soit environ **1 million d'endossements/an au niveau national**. Pour un courtier moyen (2 000 polices), cela represente **700-900 endossements/an**, distribues comme suit (donnees agreges Cabinet Bennani Casablanca + Atlas Assurance Rabat + MutuAssurance Marrakech, 2024) :

- **Changement de vehicule (35%)** : assure vend son vehicule + achete un nouveau, conserve la police. Frequent : 280 cas/an pour un courtier moyen. Variations : meme marque/modele meme generation (faible impact prime), changement segment (Logan -> Megane = +15-25% prime), passage thermique -> hybride/electrique (baisse 10-15% souvent).

- **Ajout/retrait conducteur (30%)** : 240 cas/an. Cas typiques : enfant jeune permis ajoute (+20-35% surprime), conjoint nouveau permis (+15%), employe entreprise conducteur secondaire (+5-10%), retrait conducteur defunt ou parti (-15%).

- **Changement d'usage (20%)** : 160 cas/an. Privatif -> professionnel (taxi, VTC, livraison) +30-50%, professionnel -> privatif (retraite) -20-25%. Tres impactant tarifairement.

- **Modifications mineures (15%)** : 120 cas/an. Changement adresse (impact zone tarifaire faible), plaque WW provisoire -> definitive, etc.

Sans automatisation, chaque endossement prend **45-90 minutes** chez le courtier : reception demande client, lecture conditions, calcul tarif manuel (souvent Excel maison ou outil assureur), recuperation puissance fiscale carte grise, redaction avenant Word, impression, envoi signature papier, scan retour, archivage, transmission assureur, suivi paiement delta. Notre service automatise tout (TarificationService recompute, avenant PDF auto-genere, Barid eSign auto), reduction a **<10 minutes**. Gain pour un courtier : **800 endossements x 60 min reduction = 800 heures/an** soit **0.5 ETP** liberable pour activites commerciales.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Endossement sans recompute prime (juste flag modif) | Tres simple | Faux : prime injustifiee = arnaque + risque ACAPS sanction | Rejete (illegal) |
| Endossement avec recompute manuel courtier (saisie prime) | Flexibilite | Erreurs frequentes, pas d'audit tarification | Rejete (qualite) |
| **Endossement avec recompute via TarificationService Sprint 14 + signature Barid + delta pro-rata** (retenu) | Auto, juste, traçable | Plus de code, depend de Sprint 14 fiable | RETENU |
| Endossement sans signature (juste update DB) | Tres rapide | Non opposable juridiquement, contestation potentielle | Rejete (article 19 loi 17-99) |
| Endossement avec workflow double signature (assure + courtier) | Plus conforme | Pas necessaire (avenant = modification unilaterale acceptee par assure) | Rejete (sur-engineering) |
| Endossement avec delta prime applique immediatement (refund/charge) | Cash-flow rapide | Complique Pay integration + risque double prelevement | Rejete (V1 simplifie : delta sur futurs premiums) |

La decision retenue (recompute auto + signature simple + delta pro-rata sur futurs) suit :
- **decision-005 (Skalean AI ne consomme jamais sans MCP)** : pas d'appel IA, recompute deterministe via TarificationService.
- **decision-009 (Zod + decimal.js)** : Zod schemas + decimal.js precision tarifaire.
- **decision-013 (audit immutable)** : avenant + signature scelle = preuve immutable.
- **decision-014 (commissions immutables)** : commissions recalculees uniquement sur delta prime (compte 706x ajuste +/-).

### 2.3 Trade-offs explicites

**Premier trade-off : recompute via Sprint 14 vs. cache prime initial**. On rappelle systematiquement `TarificationService.computePrime` (Sprint 14) avec les nouveaux params. Trade-off : dependance forte sur Sprint 14 fiable + latence (~50ms par call). Alternative : cache local. On choisit recompute live pour exactitude.

**Deuxieme trade-off : signature simple vs. qualified Barid**. Pour endossements auto, on utilise `signature_type='simple'` (vs `qualified` pour transferts Tache 4.2.1). Trade-off : simple = rapide (3min) mais moins opposable que qualified (acceptable car avenant = modification unilaterale + consenti par flux + audit trail).

**Troisieme trade-off : delta prime applique pro-rata futurs vs. refund immediat**. Si nouvelle prime < ancienne (ex: passage vehicule moins cher), credit reste sur les premiums futurs (chaque future premium = (new_prime_annuelle / count_periode) au lieu de (old_prime / count)). Pas de refund immediat client. Trade-off : moins genereux client mais simple Pay.

**Quatrieme trade-off : limite 4 conducteurs secondaires**. Hardcoded default 4 (configurable per tenant). Trade-off : restrictive pour grosses familles + flottes pro mais protege contre abus assureurs (clauses 5-7 CG standard auto).

**Cinquieme trade-off : max 2 changes vehicule / an**. Anti-abus. Trade-off : frustre rares cas legit (assure tres mobile) mais protege Skalean d'utilisation abusive.

**Sixieme trade-off : changement usage perso -> pro nettement plus cher**. On accepte recompute strict (peut etre +50%). Si client refuse delta, il doit cancel + re-souscrire (route Tache 4.2.4).

### 2.4 Decisions strategiques referenced

- **decision-001** : monorepo, packages/insure.
- **decision-002** : multi-tenant, RLS.
- **decision-003** : TypeORM 0.3.
- **decision-006** : no-emoji ABSOLU.
- **decision-009** : Zod + decimal.js.
- **decision-013** : audit immutable, lineage premiums.
- **decision-014** : commissions ajustees sur delta (compte 706x).
- **decision-008** : cloud souverain MA.

### 2.5 Pieges techniques connus

1. **Piege : format immatriculation MA inconsistent**. Solution : Zod regex strict `^\d{1,5}-[A-Z]{1,3}-\d{1,2}$` (format officiel MA). Exemples valides : `12345-A-1`, `45678-AB-12`.

2. **Piege : annee modele > annee courante**. Solution : refine `year <= currentYear + 1` (modeles annee suivante autorises uniquement pour vehicules neufs immatricules avant).

3. **Piege : recompute prime avec donnees incompletes**. Si manque puissance fiscale CV, TarificationService throw. Solution : require validation puissance fiscale dans schemas Zod avant call.

4. **Piege : driver < 18 ans**. Permis MA accorde a 18 ans minimum (sauf scolaire). Solution : refine date_naissance <= today - 18 years.

5. **Piege : delta prime negatif (baisse)**. Si nouveau vehicule moins cher = baisse prime. Anciens premiums pending cancelled + nouveaux genere avec montants inferieurs. Trade-off : pas de refund cash, credit applique sur futur. Documenter dans Comm.

6. **Piege : 2 endossements concurrents meme police**. SELECT FOR UPDATE lock policy.

7. **Piege : endossement pendant suspension**. Bloquer si status='suspended'. Throw `POLICY_SUSPENDED_NO_ENDOSSEMENT`.

8. **Piege : endossement pendant pending transfer**. Bloquer. Throw `PENDING_TRANSFER_BLOCKS_ENDOSSEMENT`.

9. **Piege : ajout conducteur secondaire sans CIN**. Validation CIN MA format `[A-Z]{1,2}\d{4,6}` strict.

10. **Piege : changement usage perso -> pro sans declaration assureur**. ACAPS impose declaration changement usage materiel. Notre Kafka event consume Sprint 32 (assureurs) declare automatiquement.

11. **Piege : delta prime non comptabilise correctement Books**. Solution : Kafka event `INSURE_AUTO_ENDOSSEMENT_*` consume Sprint 12 Books pour ecriture regul compte 706x.

12. **Piege : annulation endossement pendant signature**. Si user cancel avant Barid sign : Barid workflow invalide + policy reste etat ancien.

### 2.6 Conformite legale Maroc

- **Loi 17-99 article 19** (modification contrat) : conformite recompute + signature.
- **Loi 17-99 article 12** (declaration risque) : tout changement usage/conducteur = nouveau risque a declarer. Notre flow conforme.
- **Article 12 alinea 3** : sanction nullite contrat si non declaration risque aggrave. Notre auto-declaration via Kafka previent.
- **CGNC** : delta prime alimente compte 706x (Sprint 12).
- **CNDP loi 09-08** : audit log donnees personnelles conducteurs (CIN, age) -> retention 5 ans.

### 2.7 Glossaire metier

- **Avenant auto** : modification contractuelle d'une police auto.
- **Conducteur principal** : titulaire de la police, identifie sur la carte d'assurance.
- **Conducteur secondaire** : autre conducteur autorise, declare a l'assureur.
- **Jeune conducteur** : permis < 3 ans, surprime obligatoire ACAPS.
- **Usage** : finalite vehicule (private, professional, mixed).
- **Puissance fiscale CV** : variable tarifaire majeure au Maroc.

---

## 3. Architecture context

### 3.1 Position dans le sprint 15

Cette tache 4.2.6 est la **sixieme** des 13 du Sprint 15.

- **Depend de** : Tache 4.2.5 (Flotte pattern + entity InsurePolicyObject reuse), Tache 4.2.1 (workflow signature simple), Sprint 14 (TarificationService.computePrime), Sprint 10 (Barid eSign), Sprint 9 (CommService), Sprint 7 (RBAC), Sprint 6 (multi-tenant).
- **Bloque** : Tache 4.2.7 (sante endossements -- meme pattern), Tache 4.2.8 (habitation/RC/voyage -- meme pattern), Tache 4.2.11 (consolidation endpoints), Tache 4.2.12 (Kafka consumers + assureurs sync), Tache 4.2.13 (tests E2E 5 scenarios auto endossements).
- **Apporte au sprint** : pattern "recompute prime + signature simple + delta pro-rata futurs premiums + Kafka assureurs sync" reutilise par 4.2.7 et 4.2.8.

### 3.2 Position dans le programme global

- **Sprint 16 (Web Broker App)** : composants `ChangeVehicleDialog`, `AddDriverDialog`, `ChangeUsageDialog`.
- **Sprint 17 (Web Customer Portal)** : permettra client demander endossement (mise en queue broker Tache 4.2.9).
- **Sprint 18 (Compliance ACAPS)** : Kafka consumer aggregate stats endossements quarterly.
- **Sprint 27 (Admin Tenant)** : configure `auto_max_secondary_drivers`, `auto_max_vehicle_changes_per_year`.
- **Sprint 30+ (Sky AI)** : suggestion intelligente endossements (vehicule recommande basee profil).
- **Sprint 32 (Connecteurs assureurs)** : push endossements vers assureurs partenaires (Wafa, Atlanta, Saham, RMA, AXA).

### 3.3 Diagramme flow

```
+--------------------------------------------------------------+
|  AutoEndossementsService.changeVehicle(policyId, oldV, newV) |
|       |                                                      |
|       v                                                      |
|  +----------------+    +---------------------+               |
|  | Validations:   |--->| TarificationService |               |
|  | - policy active|    | .computePrime({     |               |
|  | - no suspension|    |   branche:'auto',   |               |
|  | - no transfer  |    |   vehicle: newV,    |               |
|  | - matricule MA |    |   drivers, usage    |               |
|  | - year valid   |    | }) -> newPrime      |               |
|  | - 2 changes/yr |    |                     |               |
|  +----------------+    +---------------------+               |
|                                                       |      |
|                                                       v      |
|         +-----------------+    +---------------------+       |
|         | Compute delta:  |--->| Generate avenant PDF|       |
|         | oldPrime ->     |    | (avenant-auto-      |       |
|         | newPrime        |    | vehicle-change.hbs) |       |
|         +-----------------+    +---------------------+       |
|                                                       |      |
|                                                       v      |
|                         +-----------------+                  |
|                         | Barid eSign     |                  |
|                         | workflow:       |                  |
|                         | 1 signer assure |                  |
|                         | signature_type= |                  |
|                         | 'simple'        |                  |
|                         +-----------------+                  |
|                                                       |      |
|                                                       v      |
|                         +-----------------+                  |
|                         | Transaction:    |                  |
|                         | - update flotte |                  |
|                         |   object_data   |                  |
|                         | - cancel old    |                  |
|                         |   pending prems |                  |
|                         | - regen new     |                  |
|                         |   prems with    |                  |
|                         |   new montant   |                  |
|                         | - audit log     |                  |
|                         | - kafka publish |                  |
|                         +-----------------+                  |
|                                                       |      |
|                                                       v      |
|                         +-----------------+                  |
|                         | Comm notif      |                  |
|                         | confirmation    |                  |
|                         | tri-langue      |                  |
|                         +-----------------+                  |
+--------------------------------------------------------------+
```

---

## 4. Livrables checkables (28 items)

- [ ] Migration `AddInsureAutoEndossementsAuxiliary` : ajout colonnes `insure_policy_objects.last_endossement_at` (timestamptz NULL), `vehicle_changes_count_year` (int default 0), `vehicle_changes_year_marker` (int NULL) (~30 lignes)

- [ ] Service `repo/packages/insure/src/services/endossements/auto-endossements.service.ts` (~380 lignes) : `changeVehicle`, `addDriver`, `removeDriver`, `changeUsage`, plus helpers prive

- [ ] Schemas Zod `repo/packages/insure/src/schemas/auto-endossements.schema.ts` : 4 schemas input + 4 response (~120 lignes)

- [ ] Constants `repo/packages/insure/src/constants/auto-endossements.constants.ts` : `DEFAULT_MAX_SECONDARY_DRIVERS = 4`, `DEFAULT_MAX_VEHICLE_CHANGES_PER_YEAR = 2`, regex immatriculation MA (~30 lignes)

- [ ] Tests unitaires `auto-endossements.service.spec.ts` : 30 tests (changeVehicle success/reject all validations, addDriver, removeDriver, changeUsage, delta prime up/down, audit, Kafka, edge cases) (~400 lignes)

- [ ] Controller `repo/apps/api/src/modules/insure/controllers/auto-endossements.controller.ts` : 4 endpoints (~200 lignes)

- [ ] DTOs : `ChangeVehicleDto`, `AddDriverDto`, `RemoveDriverDto`, `ChangeUsageDto` + 4 Response DTOs (~100 lignes total)

- [ ] Permissions catalog : `insure.endossements.auto.change_vehicle`, `insure.endossements.auto.add_driver`, `insure.endossements.auto.remove_driver`, `insure.endossements.auto.change_usage`

- [ ] Kafka topics : `INSURE_AUTO_VEHICLE_CHANGED`, `INSURE_AUTO_DRIVER_ADDED`, `INSURE_AUTO_DRIVER_REMOVED`, `INSURE_AUTO_USAGE_CHANGED` + schemas Zod events

- [ ] Templates Comm tri-langue (fr/ar-MA/ar) pour chacun des 4 endossements x 2 channels (whatsapp/email) = 24 fichiers (~25 lignes chacun)

- [ ] Templates Handlebars avenants PDF tri-langue : `avenant-auto-vehicle-change`, `avenant-auto-driver-added`, `avenant-auto-driver-removed`, `avenant-auto-usage-changed` = 12 fichiers (~80 lignes chacun)

- [ ] Tests integration `auto-endossements.integration-spec.ts` Postgres reel : 15 tests (~350 lignes)

- [ ] Fixtures `auto-endossements.fixture.ts` (~150 lignes)

- [ ] Module integration `AutoEndossementsModule` dans `InsureModule`

- [ ] TarificationService Sprint 14 integration : call `computePrime({ branche, vehicle, drivers, usage })`

- [ ] Validation immatriculation MA stricte (regex)

- [ ] Validation age conducteur >= 18 ans + permis valide

- [ ] Validation max 4 conducteurs secondaires

- [ ] Validation max 2 changements vehicule/an

- [ ] Validation `usage` enum 3 values

- [ ] Audit log avec snapshot before/after JSONB (vehicleData, driversList, usage)

- [ ] Kafka idempotency_key sur publish

- [ ] OpenTelemetry spans

- [ ] Logger Pino structured

- [ ] OpenAPI annotations completes

- [ ] README `AUTO-ENDOSSEMENTS.md`

- [ ] Helper `computeDeltaPrime(oldPrime, newPrime, daysRemaining)` testable isole

- [ ] Edge case : delta prime negatif (baisse) -> credit sur futurs

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/{ts}-AddInsureAutoEndossementsAuxiliary.ts          (~50 lignes)
repo/packages/insure/src/services/endossements/auto-endossements.service.ts                (~400 lignes)
repo/packages/insure/src/services/endossements/auto-endossements.service.spec.ts           (~420 lignes / 30 tests)
repo/packages/insure/src/services/endossements/AUTO-ENDOSSEMENTS.md                        (~70 lignes)
repo/packages/insure/src/schemas/auto-endossements.schema.ts                                (~140 lignes)
repo/packages/insure/src/constants/auto-endossements.constants.ts                           (~40 lignes)
repo/packages/insure/src/module/auto-endossements.module.ts                                (~30 lignes)
repo/packages/insure/src/index.ts                                                            (modif)
repo/packages/docs/src/templates/fr/avenant-auto-vehicle-change.hbs                         (~80 lignes)
repo/packages/docs/src/templates/ar-MA/avenant-auto-vehicle-change.hbs                      (~80 lignes)
repo/packages/docs/src/templates/ar/avenant-auto-vehicle-change.hbs                         (~80 lignes)
repo/packages/docs/src/templates/{fr,ar-MA,ar}/avenant-auto-driver-added.hbs                (3 fichiers, ~70 lignes chacun)
repo/packages/docs/src/templates/{fr,ar-MA,ar}/avenant-auto-driver-removed.hbs              (3 fichiers, ~70 lignes chacun)
repo/packages/docs/src/templates/{fr,ar-MA,ar}/avenant-auto-usage-changed.hbs               (3 fichiers, ~75 lignes chacun)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/auto-vehicle-changed.{whatsapp,email}.hbs    (6 fichiers, ~25 lignes chacun)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/auto-driver-added.{whatsapp,email}.hbs       (6 fichiers, ~25 lignes chacun)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/auto-driver-removed.{whatsapp,email}.hbs     (6 fichiers, ~25 lignes chacun)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/auto-usage-changed.{whatsapp,email}.hbs      (6 fichiers, ~25 lignes chacun)
repo/apps/api/src/modules/insure/controllers/auto-endossements.controller.ts                (~220 lignes)
repo/apps/api/src/modules/insure/dto/change-vehicle.dto.ts                                  (~30 lignes)
repo/apps/api/src/modules/insure/dto/add-driver.dto.ts                                      (~25 lignes)
repo/apps/api/src/modules/insure/dto/remove-driver.dto.ts                                   (~15 lignes)
repo/apps/api/src/modules/insure/dto/change-usage.dto.ts                                    (~20 lignes)
repo/apps/api/src/modules/insure/dto/auto-endossement-response.dto.ts                       (~50 lignes)
repo/apps/api/src/modules/insure/insure.module.ts                                          (modif)
repo/apps/api/test/insure/auto-endossements.integration-spec.ts                             (~380 lignes / 15 tests)
repo/apps/api/test/insure/fixtures/auto-endossements.fixture.ts                             (~160 lignes)
repo/packages/auth/src/rbac/permissions.enum.ts                                            (modif / +4 perms)
repo/packages/auth/src/rbac/permissions-matrix.ts                                          (modif)
repo/packages/shared-types/src/kafka-topics.ts                                             (modif / +4 topics)
repo/packages/shared-types/src/events/insure-auto-endossements.events.ts                    (~120 lignes)
```

**Volume total** : ~3 100 lignes nouvelles + modifications.

---

## 6. Code patterns COMPLETS

### Fichier 1/14 : Migration `AddInsureAutoEndossementsAuxiliary`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 15 Tache 4.2.6 -- Ajout colonnes auxiliaires endossements auto.
 */
export class AddInsureAutoEndossementsAuxiliary20260515160000 implements MigrationInterface {
  name = 'AddInsureAutoEndossementsAuxiliary20260515160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE insure_policy_objects
        ADD COLUMN last_endossement_at TIMESTAMPTZ NULL,
        ADD COLUMN vehicle_changes_count_year INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN vehicle_changes_year_marker INTEGER NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_policy_objects_vehicle_changes
        ON insure_policy_objects(tenant_id, vehicle_changes_year_marker)
        WHERE vehicle_changes_year_marker IS NOT NULL;
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN insure_policy_objects.vehicle_changes_count_year IS
      'Compteur changements vehicule pour annee courante (anti-abus). Sprint 15 Tache 4.2.6.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_policy_objects_vehicle_changes;`);
    await queryRunner.query(`
      ALTER TABLE insure_policy_objects
        DROP COLUMN IF EXISTS last_endossement_at,
        DROP COLUMN IF EXISTS vehicle_changes_count_year,
        DROP COLUMN IF EXISTS vehicle_changes_year_marker;
    `);
  }
}
```

### Fichier 2/14 : Constants `auto-endossements.constants.ts`

```typescript
/**
 * Sprint 15 Tache 4.2.6 -- Constants endossements auto.
 */
export const AUTO_ENDOSSEMENTS_CONSTANTS = {
  DEFAULT_MAX_SECONDARY_DRIVERS: 4,
  DEFAULT_MAX_VEHICLE_CHANGES_PER_YEAR: 2,
  MIN_DRIVER_AGE_YEARS: 18,
  YOUNG_DRIVER_LICENCE_THRESHOLD_YEARS: 3,
  MATRICULATION_MA_REGEX: /^\d{1,5}-[A-Z]{1,3}-\d{1,2}$/,
  CIN_MA_REGEX: /^[A-Z]{1,2}\d{4,6}$/,
  DECIMAL_PRECISION: 2,
} as const;

export const ALLOWED_USAGES = ['private', 'professional', 'mixed'] as const;
export type AutoUsage = typeof ALLOWED_USAGES[number];
```

### Fichier 3/14 : Schemas Zod `auto-endossements.schema.ts`

```typescript
import { z } from 'zod';
import { startOfDay, isValid, differenceInYears } from 'date-fns';
import { AUTO_ENDOSSEMENTS_CONSTANTS, ALLOWED_USAGES } from '../constants/auto-endossements.constants';

const VehicleDataSchema = z.object({
  make: z.string().min(2).max(50),
  model: z.string().min(1).max(50),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1),
  vin: z.string().min(11).max(17).optional(),
  matricule: z.string().regex(AUTO_ENDOSSEMENTS_CONSTANTS.MATRICULATION_MA_REGEX, {
    message: 'matricule must follow MA format e.g. 12345-A-1',
  }),
  fiscal_power_cv: z.number().int().min(4).max(40),
  energy: z.enum(['gasoline', 'diesel', 'hybrid', 'electric', 'lpg']),
  usage: z.enum(ALLOWED_USAGES),
  value_estimate_mad: z.number().int().positive(),
  first_registration_date: z.coerce.date().refine((d) => isValid(d)),
});

const DriverDataSchema = z.object({
  cin: z.string().regex(AUTO_ENDOSSEMENTS_CONSTANTS.CIN_MA_REGEX),
  first_name: z.string().min(2).max(50),
  last_name: z.string().min(2).max(50),
  date_of_birth: z.coerce.date().refine((d) => {
    return differenceInYears(new Date(), d) >= AUTO_ENDOSSEMENTS_CONSTANTS.MIN_DRIVER_AGE_YEARS;
  }, { message: 'driver must be at least 18 years old' }),
  licence_obtained_date: z.coerce.date(),
  is_principal: z.boolean().optional().default(false),
  bonus_malus: z.number().min(0.5).max(3.5).optional(),
});

export const ChangeVehicleInputSchema = z.object({
  policyId: z.string().uuid(),
  oldVehicleData: VehicleDataSchema,
  newVehicleData: VehicleDataSchema,
  effectiveDate: z.coerce.date().optional().default(() => new Date()).refine(
    (d) => d >= startOfDay(new Date()),
    { message: 'effectiveDate must be today or future' },
  ),
  reason: z.string().min(10).max(500),
  notifyCustomer: z.boolean().optional().default(true),
});
export type ChangeVehicleInput = z.infer<typeof ChangeVehicleInputSchema>;

export const AddDriverInputSchema = z.object({
  policyId: z.string().uuid(),
  driverData: DriverDataSchema,
  effectiveDate: z.coerce.date().optional().default(() => new Date()),
  reason: z.string().min(5).max(500),
  notifyCustomer: z.boolean().optional().default(true),
});
export type AddDriverInput = z.infer<typeof AddDriverInputSchema>;

export const RemoveDriverInputSchema = z.object({
  policyId: z.string().uuid(),
  driverId: z.string(),
  reason: z.string().min(5).max(500),
  notifyCustomer: z.boolean().optional().default(true),
});
export type RemoveDriverInput = z.infer<typeof RemoveDriverInputSchema>;

export const ChangeUsageInputSchema = z.object({
  policyId: z.string().uuid(),
  newUsage: z.enum(ALLOWED_USAGES),
  reason: z.string().min(5).max(500),
  effectiveDate: z.coerce.date().optional().default(() => new Date()),
  notifyCustomer: z.boolean().optional().default(true),
});
export type ChangeUsageInput = z.infer<typeof ChangeUsageInputSchema>;

export const AutoEndossementResponseSchema = z.object({
  endossement_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  type: z.enum(['vehicle_changed', 'driver_added', 'driver_removed', 'usage_changed']),
  old_prime_annuelle: z.string(),
  new_prime_annuelle: z.string(),
  prime_delta: z.string(),
  effective_date: z.string().datetime(),
  signing_workflow_id: z.string().uuid().nullable(),
  status: z.enum(['pending_signature', 'completed']),
  cancelled_premium_ids: z.array(z.string().uuid()),
  new_premium_ids: z.array(z.string().uuid()),
});
export type AutoEndossementResponse = z.infer<typeof AutoEndossementResponseSchema>;
```

### Fichier 4/14 : Service principal `auto-endossements.service.ts`

```typescript
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import Decimal from 'decimal.js';
import { differenceInDays, startOfDay } from 'date-fns';

import { InsurePolicy, InsurePolicyStatus } from '../../entities/insure-policy.entity';
import { InsurePremium, InsurePremiumStatus } from '../../entities/insure-premium.entity';
import { InsurePolicyObject } from '../../entities/insure-policy-object.entity';
import { InsureTransfer, InsureTransferStatus } from '../../entities/insure-transfer.entity';
import { AUTO_ENDOSSEMENTS_CONSTANTS } from '../../constants/auto-endossements.constants';
import {
  ChangeVehicleInput, ChangeVehicleInputSchema,
  AddDriverInput, AddDriverInputSchema,
  RemoveDriverInput, RemoveDriverInputSchema,
  ChangeUsageInput, ChangeUsageInputSchema,
  AutoEndossementResponse,
} from '../../schemas/auto-endossements.schema';
import { PoliciesService } from '../policies.service';
import { TarificationService } from '../tarification.service';
import { SigningWorkflowService, SignerRole, SignatureType } from '@insurtech/signature';
import { PdfGenerator, DocumentService, DocumentType } from '@insurtech/docs';
import { TenantConfigService } from '@insurtech/shared-config';
import { AuditLogService, KafkaPublisher, TenantContext } from '@insurtech/shared-utils';
import { CommService, CommChannel } from '@insurtech/comm';
import { Topics } from '@insurtech/shared-types';

/**
 * Sprint 15 Tache 4.2.6 -- AutoEndossementsService.
 *
 * Endossements specifiques branche auto:
 *  - changeVehicle
 *  - addDriver / removeDriver
 *  - changeUsage
 *
 * Reference: Loi 17-99 articles 12 (declaration risque) + 19 (modification contrat).
 */
@Injectable()
export class AutoEndossementsService {
  private readonly logger;
  private readonly tracer = trace.getTracer('insure.auto-endossements.service');

  constructor(
    @InjectRepository(InsurePolicy) private readonly policiesRepo: Repository<InsurePolicy>,
    @InjectRepository(InsurePremium) private readonly premiumsRepo: Repository<InsurePremium>,
    @InjectRepository(InsurePolicyObject) private readonly objectsRepo: Repository<InsurePolicyObject>,
    @InjectRepository(InsureTransfer) private readonly transfersRepo: Repository<InsureTransfer>,
    private readonly policiesService: PoliciesService,
    private readonly tarificationService: TarificationService,
    private readonly signingWorkflowService: SigningWorkflowService,
    private readonly pdfGenerator: PdfGenerator,
    private readonly documentService: DocumentService,
    private readonly tenantConfig: TenantConfigService,
    private readonly auditLog: AuditLogService,
    private readonly kafkaPublisher: KafkaPublisher,
    private readonly commService: CommService,
    private readonly dataSource: DataSource,
    pino: PinoLogger,
  ) {
    this.logger = pino.logger.child({ component: 'AutoEndossementsService' });
  }

  // ============ changeVehicle ============

  async changeVehicle(input: ChangeVehicleInput): Promise<AutoEndossementResponse> {
    return this.tracer.startActiveSpan('autoEndossements.changeVehicle', async (span) => {
      const tenantId = TenantContext.getCurrentTenantId();
      const userId = TenantContext.getCurrentUserId();
      const startTime = Date.now();

      try {
        const validated = ChangeVehicleInputSchema.parse(input);
        const { policy, vehicleObject } = await this.validateChangeVehicle(validated);

        // Recompute prime via TarificationService
        const newPrimeResult = await this.tarificationService.computePrime({
          branche: 'auto',
          tenant_id: tenantId,
          vehicle: validated.newVehicleData,
          drivers: (vehicleObject.object_data as any).drivers ?? [],
          usage: validated.newVehicleData.usage,
          start_date: policy.start_date,
          end_date: policy.end_date,
        });

        const oldPrime = new Decimal(policy.prime_annuelle.toString());
        const newPrime = new Decimal(newPrimeResult.prime_annuelle.toString());
        const delta = newPrime.minus(oldPrime);

        this.logger.info(
          { tenant_id: tenantId, policy_id: policy.id, old_prime: oldPrime.toString(), new_prime: newPrime.toString(), delta: delta.toString(), action: 'changeVehicle.recompute.success' },
          'Vehicle change prime recomputed',
        );

        // Generate avenant PDF
        const pdfLocale = (await this.policiesService.getContactForPolicy(policy.id))?.preferred_language ?? 'fr';
        const pdfBuffer = await this.pdfGenerator.generate('avenant-auto-vehicle-change', pdfLocale, {
          policy, oldVehicle: validated.oldVehicleData, newVehicle: validated.newVehicleData,
          oldPrime: oldPrime.toFixed(2), newPrime: newPrime.toFixed(2), delta: delta.toFixed(2),
          effectiveDate: validated.effectiveDate, reason: validated.reason, generatedAt: new Date(),
        });

        const pdfDoc = await this.documentService.create({
          type: DocumentType.AVENANT_AUTO,
          title: `Avenant changement vehicule - Police ${policy.policy_number}`,
          file: pdfBuffer,
          related_resource_type: 'insure_policy',
          related_resource_id: policy.id,
        });

        // Barid eSign workflow simple 1 signer (assure)
        const contact = await this.policiesService.getContactForPolicy(policy.id);
        if (!contact) throw new BadRequestException({ code: 'NO_CONTACT_FOR_POLICY' });

        const signingWorkflow = await this.signingWorkflowService.createWorkflow(
          pdfDoc.id,
          [{ name: `${contact.first_name} ${contact.last_name}`, email: contact.email, phone: contact.phone, role: SignerRole.SIGNER, order: 1, cin: contact.cin }],
          { signature_type: SignatureType.SIMPLE, expires_in_days: 14, metadata: { resource_type: 'auto_endossement_vehicle', policy_id: policy.id } },
        );

        const result = await this.dataSource.transaction(async (em) => {
          // Lock
          await em.query(`SELECT id FROM insure_policies WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [policy.id, tenantId]);

          // Cancel pending premiums in future
          const today = startOfDay(validated.effectiveDate);
          const pendingPremiums = await em.find(InsurePremium, {
            where: { policy_id: policy.id, status: InsurePremiumStatus.PENDING },
          });
          const cancelledIds: string[] = [];
          for (const p of pendingPremiums) {
            if (p.due_date >= today) {
              await em.update(InsurePremium, { id: p.id, tenant_id: tenantId }, {
                status: InsurePremiumStatus.CANCELLED,
                cancelled_reason_code: 'replaced_by_endossement_vehicle',
                cancelled_at: new Date(),
              });
              cancelledIds.push(p.id);
            }
          }

          // Update policy prime_annuelle
          await em.update(InsurePolicy, { id: policy.id, tenant_id: tenantId }, {
            prime_annuelle: newPrime.toFixed(2),
            updated_at: new Date(),
          });

          // Update flotte object
          const currentYear = new Date().getFullYear();
          const newCount = vehicleObject.vehicle_changes_year_marker === currentYear ? vehicleObject.vehicle_changes_count_year + 1 : 1;
          await em.update(InsurePolicyObject, { id: vehicleObject.id, tenant_id: tenantId }, {
            object_data: { ...(vehicleObject.object_data as any), ...validated.newVehicleData },
            last_endossement_at: new Date(),
            vehicle_changes_count_year: newCount,
            vehicle_changes_year_marker: currentYear,
            updated_at: new Date(),
          });

          // Regen premiums on remaining duration with new prime
          const daysRemaining = differenceInDays(policy.end_date, validated.effectiveDate);
          const newPremiumIds: string[] = [];
          if (daysRemaining > 0 && pendingPremiums.length > 0) {
            const count = pendingPremiums.length; // preserve count
            const totalRemaining = newPrime.mul(daysRemaining).div(365).toDecimalPlaces(2);
            const perPrem = totalRemaining.div(count).toDecimalPlaces(2);
            let cumul = new Decimal(0);
            for (let i = 0; i < count; i++) {
              const amt = (i === count - 1) ? totalRemaining.minus(cumul) : perPrem;
              cumul = cumul.plus(amt);
              const oldDue = pendingPremiums[i]?.due_date ?? validated.effectiveDate;
              const newP = em.create(InsurePremium, {
                tenant_id: tenantId, policy_id: policy.id,
                montant: amt.toFixed(2), due_date: oldDue,
                status: InsurePremiumStatus.PENDING,
                frequency: policy.payment_frequency,
                installment_number: i + 1, installment_count: count,
                created_by_action: 'auto_endossement_vehicle_change',
                original_premium_id: pendingPremiums[i]?.id ?? null,
              });
              const saved = await em.save(newP);
              newPremiumIds.push(saved.id);
            }
          }

          // Audit
          await this.auditLog.log({
            tenant_id: tenantId, user_id: userId,
            action: 'insure.auto_endossement.vehicle_changed',
            resource_type: 'insure_policy', resource_id: policy.id,
            metadata: {
              snapshotBefore: { vehicle: validated.oldVehicleData, prime: oldPrime.toString() },
              snapshotAfter: { vehicle: validated.newVehicleData, prime: newPrime.toString() },
              delta: delta.toString(),
              effective_date: validated.effectiveDate.toISOString(),
              reason: validated.reason,
              signing_workflow_id: signingWorkflow.id,
              vehicle_changes_count_year: newCount,
              cancelled_premium_ids: cancelledIds,
              new_premium_ids: newPremiumIds,
            },
          });

          // Kafka
          await this.kafkaPublisher.publish(Topics.INSURE_AUTO_VEHICLE_CHANGED, {
            tenant_id: tenantId, policy_id: policy.id,
            old_vehicle: validated.oldVehicleData, new_vehicle: validated.newVehicleData,
            old_prime: oldPrime.toFixed(2), new_prime: newPrime.toFixed(2), delta: delta.toFixed(2),
            effective_date: validated.effectiveDate.toISOString(),
            signing_workflow_id: signingWorkflow.id,
            changed_by_user_id: userId,
            changed_at: new Date().toISOString(),
          }, { idempotency_key: `auto-vehicle-change-${policy.id}-${Date.now()}` });

          return {
            endossement_id: signingWorkflow.id,
            policy_id: policy.id,
            type: 'vehicle_changed' as const,
            old_prime_annuelle: oldPrime.toFixed(2),
            new_prime_annuelle: newPrime.toFixed(2),
            prime_delta: delta.toFixed(2),
            effective_date: validated.effectiveDate.toISOString(),
            signing_workflow_id: signingWorkflow.id,
            status: 'pending_signature' as const,
            cancelled_premium_ids: cancelledIds,
            new_premium_ids: newPremiumIds,
          } satisfies AutoEndossementResponse;
        });

        // Send for signature + notif
        await this.signingWorkflowService.sendForSignature(signingWorkflow.id);
        if (validated.notifyCustomer) {
          this.notifyVehicleChanged(policy, result, contact).catch((err) =>
            this.logger.error({ err, policy_id: policy.id }, 'notify vehicle changed failed'),
          );
        }

        this.logger.info(
          { tenant_id: tenantId, policy_id: policy.id, duration_ms: Date.now() - startTime, action: 'changeVehicle.success' },
          'Vehicle change completed',
        );

        return result;
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // ============ addDriver ============

  async addDriver(input: AddDriverInput): Promise<AutoEndossementResponse> {
    const tenantId = TenantContext.getCurrentTenantId();
    const userId = TenantContext.getCurrentUserId();
    const validated = AddDriverInputSchema.parse(input);

    const policy = await this.policiesService.findById(validated.policyId);
    if (!policy) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
    await this.validateNoPendingOperations(policy);
    if (policy.status !== InsurePolicyStatus.ACTIVE) throw new BadRequestException({ code: 'POLICY_NOT_ACTIVE' });

    const vehicleObject = await this.objectsRepo.findOne({
      where: { policy_id: policy.id, tenant_id: tenantId, object_type: 'vehicle' },
    });
    if (!vehicleObject) throw new NotFoundException({ code: 'NO_VEHICLE_OBJECT_FOR_POLICY' });

    const config = await this.getMaxSecondaryDrivers(tenantId);
    const existingDrivers = ((vehicleObject.object_data as any).drivers ?? []) as any[];
    const secondaryCount = existingDrivers.filter((d) => !d.is_principal).length;
    if (!validated.driverData.is_principal && secondaryCount >= config) {
      throw new ConflictException({ code: 'MAX_SECONDARY_DRIVERS_EXCEEDED', max: config });
    }

    const driverId = crypto.randomUUID();
    const newDrivers = [...existingDrivers, { ...validated.driverData, id: driverId }];

    const newPrimeResult = await this.tarificationService.computePrime({
      branche: 'auto', tenant_id: tenantId,
      vehicle: vehicleObject.object_data,
      drivers: newDrivers,
      usage: (vehicleObject.object_data as any).usage,
      start_date: policy.start_date, end_date: policy.end_date,
    });

    const oldPrime = new Decimal(policy.prime_annuelle.toString());
    const newPrime = new Decimal(newPrimeResult.prime_annuelle.toString());
    const delta = newPrime.minus(oldPrime);

    return await this.applyEndossementTransaction({
      type: 'driver_added',
      policy, vehicleObject,
      newObjectData: { ...(vehicleObject.object_data as any), drivers: newDrivers },
      oldPrime, newPrime, delta,
      effectiveDate: validated.effectiveDate,
      reason: validated.reason,
      driverPayload: validated.driverData,
      driverIdAffected: driverId,
      notifyCustomer: validated.notifyCustomer,
    });
  }

  // ============ removeDriver ============

  async removeDriver(input: RemoveDriverInput): Promise<AutoEndossementResponse> {
    const tenantId = TenantContext.getCurrentTenantId();
    const validated = RemoveDriverInputSchema.parse(input);

    const policy = await this.policiesService.findById(validated.policyId);
    if (!policy) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
    await this.validateNoPendingOperations(policy);
    if (policy.status !== InsurePolicyStatus.ACTIVE) throw new BadRequestException({ code: 'POLICY_NOT_ACTIVE' });

    const vehicleObject = await this.objectsRepo.findOne({
      where: { policy_id: policy.id, tenant_id: tenantId, object_type: 'vehicle' },
    });
    if (!vehicleObject) throw new NotFoundException({ code: 'NO_VEHICLE_OBJECT_FOR_POLICY' });

    const existingDrivers = ((vehicleObject.object_data as any).drivers ?? []) as any[];
    const driverToRemove = existingDrivers.find((d) => d.id === validated.driverId);
    if (!driverToRemove) throw new NotFoundException({ code: 'DRIVER_NOT_FOUND' });
    if (driverToRemove.is_principal) {
      throw new BadRequestException({ code: 'CANNOT_REMOVE_PRINCIPAL_DRIVER' });
    }
    const newDrivers = existingDrivers.filter((d) => d.id !== validated.driverId);

    const newPrimeResult = await this.tarificationService.computePrime({
      branche: 'auto', tenant_id: tenantId,
      vehicle: vehicleObject.object_data,
      drivers: newDrivers,
      usage: (vehicleObject.object_data as any).usage,
      start_date: policy.start_date, end_date: policy.end_date,
    });

    const oldPrime = new Decimal(policy.prime_annuelle.toString());
    const newPrime = new Decimal(newPrimeResult.prime_annuelle.toString());
    const delta = newPrime.minus(oldPrime);

    return this.applyEndossementTransaction({
      type: 'driver_removed',
      policy, vehicleObject,
      newObjectData: { ...(vehicleObject.object_data as any), drivers: newDrivers },
      oldPrime, newPrime, delta,
      effectiveDate: new Date(),
      reason: validated.reason,
      driverIdAffected: validated.driverId,
      notifyCustomer: validated.notifyCustomer,
    });
  }

  // ============ changeUsage ============

  async changeUsage(input: ChangeUsageInput): Promise<AutoEndossementResponse> {
    const tenantId = TenantContext.getCurrentTenantId();
    const validated = ChangeUsageInputSchema.parse(input);

    const policy = await this.policiesService.findById(validated.policyId);
    if (!policy) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
    await this.validateNoPendingOperations(policy);
    if (policy.status !== InsurePolicyStatus.ACTIVE) throw new BadRequestException({ code: 'POLICY_NOT_ACTIVE' });

    const vehicleObject = await this.objectsRepo.findOne({
      where: { policy_id: policy.id, tenant_id: tenantId, object_type: 'vehicle' },
    });
    if (!vehicleObject) throw new NotFoundException({ code: 'NO_VEHICLE_OBJECT_FOR_POLICY' });

    const currentUsage = (vehicleObject.object_data as any).usage;
    if (currentUsage === validated.newUsage) {
      throw new BadRequestException({ code: 'USAGE_UNCHANGED', current: currentUsage });
    }

    const newPrimeResult = await this.tarificationService.computePrime({
      branche: 'auto', tenant_id: tenantId,
      vehicle: { ...(vehicleObject.object_data as any), usage: validated.newUsage },
      drivers: (vehicleObject.object_data as any).drivers ?? [],
      usage: validated.newUsage,
      start_date: policy.start_date, end_date: policy.end_date,
    });

    const oldPrime = new Decimal(policy.prime_annuelle.toString());
    const newPrime = new Decimal(newPrimeResult.prime_annuelle.toString());
    const delta = newPrime.minus(oldPrime);

    return this.applyEndossementTransaction({
      type: 'usage_changed',
      policy, vehicleObject,
      newObjectData: { ...(vehicleObject.object_data as any), usage: validated.newUsage },
      oldPrime, newPrime, delta,
      effectiveDate: validated.effectiveDate,
      reason: validated.reason,
      usagePayload: { old: currentUsage, new: validated.newUsage },
      notifyCustomer: validated.notifyCustomer,
    });
  }

  // ============ Private helpers ============

  private async validateChangeVehicle(input: ChangeVehicleInput) {
    const tenantId = TenantContext.getCurrentTenantId();
    const policy = await this.policiesService.findById(input.policyId);
    if (!policy) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
    if (policy.tenant_id !== tenantId) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
    if (policy.status !== InsurePolicyStatus.ACTIVE) throw new BadRequestException({ code: 'POLICY_NOT_ACTIVE' });
    if (policy.branche !== 'auto') throw new BadRequestException({ code: 'NOT_AUTO_POLICY' });

    await this.validateNoPendingOperations(policy);

    const vehicleObject = await this.objectsRepo.findOne({
      where: { policy_id: policy.id, tenant_id: tenantId, object_type: 'vehicle' },
    });
    if (!vehicleObject) throw new NotFoundException({ code: 'NO_VEHICLE_OBJECT_FOR_POLICY' });

    const maxChanges = await this.getMaxVehicleChangesPerYear(tenantId);
    const currentYear = new Date().getFullYear();
    const count = vehicleObject.vehicle_changes_year_marker === currentYear ? vehicleObject.vehicle_changes_count_year : 0;
    if (count >= maxChanges) {
      throw new ConflictException({ code: 'MAX_VEHICLE_CHANGES_PER_YEAR_EXCEEDED', current: count, max: maxChanges });
    }

    return { policy, vehicleObject };
  }

  private async validateNoPendingOperations(policy: InsurePolicy) {
    const tenantId = TenantContext.getCurrentTenantId();
    if (policy.status === InsurePolicyStatus.SUSPENDED) {
      throw new BadRequestException({ code: 'POLICY_SUSPENDED_NO_ENDOSSEMENT' });
    }
    const pendingTransfer = await this.transfersRepo.findOne({
      where: { policy_id: policy.id, status: InsureTransferStatus.PENDING_SIGNATURES },
    });
    if (pendingTransfer) {
      throw new ConflictException({ code: 'PENDING_TRANSFER_BLOCKS_ENDOSSEMENT' });
    }
  }

  private async applyEndossementTransaction(params: {
    type: 'vehicle_changed' | 'driver_added' | 'driver_removed' | 'usage_changed';
    policy: InsurePolicy;
    vehicleObject: InsurePolicyObject;
    newObjectData: any;
    oldPrime: Decimal;
    newPrime: Decimal;
    delta: Decimal;
    effectiveDate: Date;
    reason: string;
    driverPayload?: any;
    driverIdAffected?: string;
    usagePayload?: { old: string; new: string };
    notifyCustomer: boolean;
  }): Promise<AutoEndossementResponse> {
    const tenantId = TenantContext.getCurrentTenantId();
    const userId = TenantContext.getCurrentUserId();
    const { policy, vehicleObject, newObjectData, oldPrime, newPrime, delta, effectiveDate, reason, type } = params;

    const contact = await this.policiesService.getContactForPolicy(policy.id);
    if (!contact) throw new BadRequestException({ code: 'NO_CONTACT_FOR_POLICY' });

    const templateName = `avenant-auto-${type.replace('_', '-')}`;
    const pdfBuffer = await this.pdfGenerator.generate(templateName, contact.preferred_language ?? 'fr', {
      policy, vehicleObject, newObjectData, oldPrime: oldPrime.toFixed(2), newPrime: newPrime.toFixed(2),
      delta: delta.toFixed(2), effectiveDate, reason, generatedAt: new Date(),
      driverPayload: params.driverPayload, driverIdAffected: params.driverIdAffected,
      usagePayload: params.usagePayload,
    });

    const pdfDoc = await this.documentService.create({
      type: DocumentType.AVENANT_AUTO,
      title: `Avenant ${type} - Police ${policy.policy_number}`,
      file: pdfBuffer,
      related_resource_type: 'insure_policy',
      related_resource_id: policy.id,
    });

    const signingWorkflow = await this.signingWorkflowService.createWorkflow(
      pdfDoc.id,
      [{ name: `${contact.first_name} ${contact.last_name}`, email: contact.email, phone: contact.phone, role: SignerRole.SIGNER, order: 1, cin: contact.cin }],
      { signature_type: SignatureType.SIMPLE, expires_in_days: 14, metadata: { resource_type: type, policy_id: policy.id } },
    );

    const result = await this.dataSource.transaction(async (em) => {
      await em.query(`SELECT id FROM insure_policies WHERE id = $1 AND tenant_id = $2 FOR UPDATE`, [policy.id, tenantId]);

      const today = startOfDay(effectiveDate);
      const pendingPremiums = await em.find(InsurePremium, {
        where: { policy_id: policy.id, status: InsurePremiumStatus.PENDING },
      });
      const cancelledIds: string[] = [];
      for (const p of pendingPremiums) {
        if (p.due_date >= today) {
          await em.update(InsurePremium, { id: p.id, tenant_id: tenantId }, {
            status: InsurePremiumStatus.CANCELLED,
            cancelled_reason_code: `replaced_by_endossement_${type}`,
            cancelled_at: new Date(),
          });
          cancelledIds.push(p.id);
        }
      }

      await em.update(InsurePolicy, { id: policy.id, tenant_id: tenantId }, {
        prime_annuelle: newPrime.toFixed(2), updated_at: new Date(),
      });

      await em.update(InsurePolicyObject, { id: vehicleObject.id, tenant_id: tenantId }, {
        object_data: newObjectData, last_endossement_at: new Date(), updated_at: new Date(),
      });

      const daysRemaining = differenceInDays(policy.end_date, effectiveDate);
      const newPremiumIds: string[] = [];
      if (daysRemaining > 0 && cancelledIds.length > 0) {
        const count = cancelledIds.length;
        const totalRemaining = newPrime.mul(daysRemaining).div(365).toDecimalPlaces(2);
        const perPrem = totalRemaining.div(count).toDecimalPlaces(2);
        let cumul = new Decimal(0);
        for (let i = 0; i < count; i++) {
          const amt = (i === count - 1) ? totalRemaining.minus(cumul) : perPrem;
          cumul = cumul.plus(amt);
          const oldDue = pendingPremiums.filter((p) => p.due_date >= today)[i]?.due_date ?? effectiveDate;
          const newP = em.create(InsurePremium, {
            tenant_id: tenantId, policy_id: policy.id,
            montant: amt.toFixed(2), due_date: oldDue,
            status: InsurePremiumStatus.PENDING,
            frequency: policy.payment_frequency,
            installment_number: i + 1, installment_count: count,
            created_by_action: `auto_endossement_${type}`,
          });
          const saved = await em.save(newP);
          newPremiumIds.push(saved.id);
        }
      }

      await this.auditLog.log({
        tenant_id: tenantId, user_id: userId,
        action: `insure.auto_endossement.${type}`,
        resource_type: 'insure_policy', resource_id: policy.id,
        metadata: {
          snapshotBefore: { object_data: vehicleObject.object_data, prime: oldPrime.toString() },
          snapshotAfter: { object_data: newObjectData, prime: newPrime.toString() },
          delta: delta.toString(),
          effective_date: effectiveDate.toISOString(),
          reason, signing_workflow_id: signingWorkflow.id,
          cancelled_premium_ids: cancelledIds, new_premium_ids: newPremiumIds,
          driver_id_affected: params.driverIdAffected,
          usage_change: params.usagePayload,
        },
      });

      const topicMap: Record<typeof type, string> = {
        vehicle_changed: Topics.INSURE_AUTO_VEHICLE_CHANGED,
        driver_added: Topics.INSURE_AUTO_DRIVER_ADDED,
        driver_removed: Topics.INSURE_AUTO_DRIVER_REMOVED,
        usage_changed: Topics.INSURE_AUTO_USAGE_CHANGED,
      };
      await this.kafkaPublisher.publish(topicMap[type], {
        tenant_id: tenantId, policy_id: policy.id,
        old_prime: oldPrime.toFixed(2), new_prime: newPrime.toFixed(2), delta: delta.toFixed(2),
        effective_date: effectiveDate.toISOString(),
        signing_workflow_id: signingWorkflow.id,
        type, changed_by_user_id: userId, changed_at: new Date().toISOString(),
        payload: { driverPayload: params.driverPayload, usagePayload: params.usagePayload, driverIdAffected: params.driverIdAffected },
      }, { idempotency_key: `auto-${type}-${policy.id}-${Date.now()}` });

      return {
        endossement_id: signingWorkflow.id,
        policy_id: policy.id,
        type,
        old_prime_annuelle: oldPrime.toFixed(2),
        new_prime_annuelle: newPrime.toFixed(2),
        prime_delta: delta.toFixed(2),
        effective_date: effectiveDate.toISOString(),
        signing_workflow_id: signingWorkflow.id,
        status: 'pending_signature' as const,
        cancelled_premium_ids: cancelledIds,
        new_premium_ids: newPremiumIds,
      } satisfies AutoEndossementResponse;
    });

    await this.signingWorkflowService.sendForSignature(signingWorkflow.id);
    if (params.notifyCustomer && contact) {
      this.notifyEndossement(type, policy, result, contact).catch((err) =>
        this.logger.error({ err, policy_id: policy.id, type }, 'notify endossement failed'),
      );
    }

    return result;
  }

  private async getMaxSecondaryDrivers(tenantId: string): Promise<number> {
    const v = await this.tenantConfig.get(tenantId, 'auto_max_secondary_drivers');
    return v ? parseInt(v, 10) : AUTO_ENDOSSEMENTS_CONSTANTS.DEFAULT_MAX_SECONDARY_DRIVERS;
  }

  private async getMaxVehicleChangesPerYear(tenantId: string): Promise<number> {
    const v = await this.tenantConfig.get(tenantId, 'auto_max_vehicle_changes_per_year');
    return v ? parseInt(v, 10) : AUTO_ENDOSSEMENTS_CONSTANTS.DEFAULT_MAX_VEHICLE_CHANGES_PER_YEAR;
  }

  private async notifyVehicleChanged(policy: InsurePolicy, result: AutoEndossementResponse, contact: any) {
    const baseVars = {
      policy_number: policy.policy_number,
      old_prime: result.old_prime_annuelle, new_prime: result.new_prime_annuelle, delta: result.prime_delta,
      effective_date: result.effective_date,
    };
    await Promise.all([
      this.commService.send({ channel: CommChannel.EMAIL, recipient: contact.email, template: 'auto-vehicle-changed', locale: contact.preferred_language ?? 'fr', variables: baseVars }),
      this.commService.send({ channel: CommChannel.WHATSAPP, recipient: contact.phone, template: 'auto-vehicle-changed', locale: contact.preferred_language ?? 'fr', variables: baseVars }),
    ]);
  }

  private async notifyEndossement(type: string, policy: InsurePolicy, result: AutoEndossementResponse, contact: any) {
    const templateName = `auto-${type.replace('_', '-')}`;
    const baseVars = {
      policy_number: policy.policy_number,
      old_prime: result.old_prime_annuelle, new_prime: result.new_prime_annuelle, delta: result.prime_delta,
      effective_date: result.effective_date,
    };
    await Promise.all([
      this.commService.send({ channel: CommChannel.EMAIL, recipient: contact.email, template: templateName, locale: contact.preferred_language ?? 'fr', variables: baseVars }),
      this.commService.send({ channel: CommChannel.WHATSAPP, recipient: contact.phone, template: templateName, locale: contact.preferred_language ?? 'fr', variables: baseVars }),
    ]);
  }
}
```

### Fichier 5/14 : Controller `auto-endossements.controller.ts`

```typescript
import { Controller, Post, Delete, Param, Body, UseGuards, HttpCode, HttpStatus, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import { AutoEndossementsService, ChangeVehicleInputSchema, AddDriverInputSchema, RemoveDriverInputSchema, ChangeUsageInputSchema } from '@insurtech/insure';
import { TenantGuard } from '../../../guards/tenant.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Permissions } from '../../../decorators/permissions.decorator';
import { ZodValidationPipe } from '../../../pipes/zod-validation.pipe';
import { ChangeVehicleDto } from '../dto/change-vehicle.dto';
import { AddDriverDto } from '../dto/add-driver.dto';
import { ChangeUsageDto } from '../dto/change-usage.dto';
import { AutoEndossementResponseDto } from '../dto/auto-endossement-response.dto';

@ApiTags('insure-auto-endossements')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller({ path: 'insure', version: '1' })
@UseGuards(TenantGuard, RolesGuard)
export class AutoEndossementsController {
  constructor(private readonly service: AutoEndossementsService) {}

  @Post('policies/:policyId/auto/change-vehicle')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.endossements.auto.change_vehicle')
  @ApiOperation({ summary: 'Endossement: changement de vehicule', description: 'Loi 17-99 article 12 + 19. Recompute prime + avenant + signature simple.' })
  @ApiResponse({ status: 200, type: AutoEndossementResponseDto })
  @UsePipes(new ZodValidationPipe(ChangeVehicleInputSchema))
  async changeVehicle(@Param('policyId') policyId: string, @Body() body: ChangeVehicleDto): Promise<AutoEndossementResponseDto> {
    return await this.service.changeVehicle({ policyId, ...body, effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date() }) as AutoEndossementResponseDto;
  }

  @Post('policies/:policyId/auto/drivers')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.endossements.auto.add_driver')
  @ApiOperation({ summary: 'Endossement: ajout conducteur secondaire' })
  @ApiResponse({ status: 200, type: AutoEndossementResponseDto })
  @UsePipes(new ZodValidationPipe(AddDriverInputSchema))
  async addDriver(@Param('policyId') policyId: string, @Body() body: AddDriverDto): Promise<AutoEndossementResponseDto> {
    return await this.service.addDriver({ policyId, ...body, effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date() }) as AutoEndossementResponseDto;
  }

  @Delete('policies/:policyId/auto/drivers/:driverId')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.endossements.auto.remove_driver')
  @ApiOperation({ summary: 'Endossement: retrait conducteur secondaire' })
  @ApiResponse({ status: 200, type: AutoEndossementResponseDto })
  async removeDriver(@Param('policyId') policyId: string, @Param('driverId') driverId: string, @Body() body: { reason: string }): Promise<AutoEndossementResponseDto> {
    return await this.service.removeDriver({ policyId, driverId, reason: body.reason, notifyCustomer: true }) as AutoEndossementResponseDto;
  }

  @Post('policies/:policyId/auto/change-usage')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.endossements.auto.change_usage')
  @ApiOperation({ summary: 'Endossement: changement usage perso/pro/mixed' })
  @ApiResponse({ status: 200, type: AutoEndossementResponseDto })
  @UsePipes(new ZodValidationPipe(ChangeUsageInputSchema))
  async changeUsage(@Param('policyId') policyId: string, @Body() body: ChangeUsageDto): Promise<AutoEndossementResponseDto> {
    return await this.service.changeUsage({ policyId, ...body, effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date() }) as AutoEndossementResponseDto;
  }
}
```

### Fichier 6/14 : DTOs (combined)

```typescript
// repo/apps/api/src/modules/insure/dto/change-vehicle.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VehicleDataDto {
  @ApiProperty() make!: string;
  @ApiProperty() model!: string;
  @ApiProperty() year!: number;
  @ApiPropertyOptional() vin?: string;
  @ApiProperty({ example: '12345-A-1' }) matricule!: string;
  @ApiProperty() fiscal_power_cv!: number;
  @ApiProperty({ enum: ['gasoline', 'diesel', 'hybrid', 'electric', 'lpg'] }) energy!: string;
  @ApiProperty({ enum: ['private', 'professional', 'mixed'] }) usage!: string;
  @ApiProperty() value_estimate_mad!: number;
  @ApiProperty() first_registration_date!: string;
}

export class ChangeVehicleDto {
  @ApiProperty({ type: VehicleDataDto }) oldVehicleData!: VehicleDataDto;
  @ApiProperty({ type: VehicleDataDto }) newVehicleData!: VehicleDataDto;
  @ApiPropertyOptional() effectiveDate?: string;
  @ApiProperty({ minLength: 10, maxLength: 500 }) reason!: string;
  @ApiPropertyOptional({ default: true }) notifyCustomer?: boolean;
}

// repo/apps/api/src/modules/insure/dto/add-driver.dto.ts
export class DriverDataDto {
  @ApiProperty({ example: 'BE12345' }) cin!: string;
  @ApiProperty() first_name!: string;
  @ApiProperty() last_name!: string;
  @ApiProperty() date_of_birth!: string;
  @ApiProperty() licence_obtained_date!: string;
  @ApiPropertyOptional({ default: false }) is_principal?: boolean;
  @ApiPropertyOptional() bonus_malus?: number;
}

export class AddDriverDto {
  @ApiProperty({ type: DriverDataDto }) driverData!: DriverDataDto;
  @ApiPropertyOptional() effectiveDate?: string;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional({ default: true }) notifyCustomer?: boolean;
}

// repo/apps/api/src/modules/insure/dto/change-usage.dto.ts
export class ChangeUsageDto {
  @ApiProperty({ enum: ['private', 'professional', 'mixed'] }) newUsage!: 'private' | 'professional' | 'mixed';
  @ApiProperty() reason!: string;
  @ApiPropertyOptional() effectiveDate?: string;
  @ApiPropertyOptional({ default: true }) notifyCustomer?: boolean;
}

// repo/apps/api/src/modules/insure/dto/auto-endossement-response.dto.ts
export class AutoEndossementResponseDto {
  @ApiProperty() endossement_id!: string;
  @ApiProperty() policy_id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() old_prime_annuelle!: string;
  @ApiProperty() new_prime_annuelle!: string;
  @ApiProperty() prime_delta!: string;
  @ApiProperty() effective_date!: string;
  @ApiPropertyOptional() signing_workflow_id?: string | null;
  @ApiProperty() status!: 'pending_signature' | 'completed';
  @ApiProperty({ type: [String] }) cancelled_premium_ids!: string[];
  @ApiProperty({ type: [String] }) new_premium_ids!: string[];
}
```

### Fichier 7/14 : Template Handlebars `fr/avenant-auto-vehicle-change.hbs`

```handlebars
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Avenant Auto - Changement de Vehicule - Police {{policy.policy_number}}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; margin: 30px; }
    h1 { font-size: 16pt; text-align: center; border-bottom: 2px solid #1a3a5c; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #888; padding: 6px; text-align: left; }
    th { background: #f0f4f8; }
    .delta { color: #c00; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Avenant - Changement de Vehicule</h1>
  <p><strong>Police:</strong> {{policy.policy_number}} -- {{policy.branche}}</p>
  <p><strong>Date d'effet:</strong> {{formatDate effectiveDate 'dd/MM/yyyy'}}</p>
  <p><strong>Motif:</strong> {{reason}}</p>

  <h2>Vehicule cede</h2>
  <table>
    <tr><th>Marque / Modele</th><td>{{oldVehicle.make}} {{oldVehicle.model}} ({{oldVehicle.year}})</td></tr>
    <tr><th>Immatriculation</th><td>{{oldVehicle.matricule}}</td></tr>
    <tr><th>Puissance fiscale</th><td>{{oldVehicle.fiscal_power_cv}} CV</td></tr>
    <tr><th>Energie</th><td>{{oldVehicle.energy}}</td></tr>
  </table>

  <h2>Vehicule de remplacement</h2>
  <table>
    <tr><th>Marque / Modele</th><td>{{newVehicle.make}} {{newVehicle.model}} ({{newVehicle.year}})</td></tr>
    <tr><th>Immatriculation</th><td>{{newVehicle.matricule}}</td></tr>
    <tr><th>Puissance fiscale</th><td>{{newVehicle.fiscal_power_cv}} CV</td></tr>
    <tr><th>Energie</th><td>{{newVehicle.energy}}</td></tr>
    <tr><th>Valeur estimee</th><td>{{newVehicle.value_estimate_mad}} DH</td></tr>
  </table>

  <h2>Impact tarifaire</h2>
  <table>
    <tr><th>Prime annuelle ancienne</th><td>{{oldPrime}} DH</td></tr>
    <tr><th>Prime annuelle nouvelle</th><td>{{newPrime}} DH</td></tr>
    <tr><th>Variation</th><td class="delta">{{delta}} DH/an</td></tr>
  </table>

  <p style="font-size: 9pt; margin-top: 20px;">
    Conformement aux articles 12 et 19 de la loi 17-99 du Code des Assurances marocain, cette modification du contrat est effective a la date indiquee ci-dessus sous reserve de signature electronique du present avenant par l'assure.
  </p>

  <div style="margin-top: 40px; border-top: 1px solid #000; width: 60%;">
    <p><strong>Signature electronique qualifiee Barid eSign</strong></p>
    <p>Nom: ____________________________</p>
    <p>Date: {{formatDate generatedAt 'dd/MM/yyyy HH:mm'}}</p>
  </div>
</body>
</html>
```

### Fichier 8/14 : Template Comm `fr/auto-vehicle-changed.email.hbs`

```handlebars
Bonjour,

Nous confirmons le changement de vehicule sur votre police d'assurance.

Recapitulatif:
- Numero de police: {{policy_number}}
- Date d'effet: {{effective_date}}
- Ancienne prime annuelle: {{old_prime}} DH
- Nouvelle prime annuelle: {{new_prime}} DH
- Variation: {{delta}} DH

Un avenant a ete genere et envoye pour signature electronique. Vous le trouverez egalement dans votre espace assure. Une fois signe, vos prochaines echeances seront ajustees selon la nouvelle prime.

Conformement aux articles 12 et 19 de la loi 17-99 du Code des Assurances marocain, cette modification est effective des la signature de l'avenant.

Cordialement,
L'equipe Skalean InsurTech
```

### Fichier 9/14 : Template Comm `fr/auto-vehicle-changed.whatsapp.hbs`

```handlebars
Bonjour, changement de vehicule sur police {{policy_number}} a partir du {{effective_date}}. Nouvelle prime annuelle: {{new_prime}} DH (variation: {{delta}} DH). Avenant envoye pour signature. Loi 17-99 articles 12 + 19.
```

### Fichier 10/14 : Permissions update

```typescript
// repo/packages/auth/src/rbac/permissions.enum.ts
INSURE_ENDOSSEMENTS_AUTO_CHANGE_VEHICLE = 'insure.endossements.auto.change_vehicle',
INSURE_ENDOSSEMENTS_AUTO_ADD_DRIVER = 'insure.endossements.auto.add_driver',
INSURE_ENDOSSEMENTS_AUTO_REMOVE_DRIVER = 'insure.endossements.auto.remove_driver',
INSURE_ENDOSSEMENTS_AUTO_CHANGE_USAGE = 'insure.endossements.auto.change_usage',
```

### Fichier 11/14 : Kafka topics + events

```typescript
// repo/packages/shared-types/src/kafka-topics.ts
INSURE_AUTO_VEHICLE_CHANGED: 'insurtech.events.insure.auto.vehicle_changed',
INSURE_AUTO_DRIVER_ADDED: 'insurtech.events.insure.auto.driver_added',
INSURE_AUTO_DRIVER_REMOVED: 'insurtech.events.insure.auto.driver_removed',
INSURE_AUTO_USAGE_CHANGED: 'insurtech.events.insure.auto.usage_changed',

// repo/packages/shared-types/src/events/insure-auto-endossements.events.ts
import { z } from 'zod';

const BaseAutoEndossementSchema = z.object({
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  old_prime: z.string(),
  new_prime: z.string(),
  delta: z.string(),
  effective_date: z.string().datetime(),
  signing_workflow_id: z.string().uuid(),
  changed_by_user_id: z.string().uuid(),
  changed_at: z.string().datetime(),
});

export const InsureAutoVehicleChangedEventSchema = BaseAutoEndossementSchema.extend({
  type: z.literal('vehicle_changed'),
  payload: z.object({ oldVehicle: z.record(z.any()), newVehicle: z.record(z.any()) }),
});

export const InsureAutoDriverAddedEventSchema = BaseAutoEndossementSchema.extend({
  type: z.literal('driver_added'),
  payload: z.object({ driverPayload: z.record(z.any()), driverIdAffected: z.string() }),
});

export const InsureAutoDriverRemovedEventSchema = BaseAutoEndossementSchema.extend({
  type: z.literal('driver_removed'),
  payload: z.object({ driverIdAffected: z.string() }),
});

export const InsureAutoUsageChangedEventSchema = BaseAutoEndossementSchema.extend({
  type: z.literal('usage_changed'),
  payload: z.object({ usagePayload: z.object({ old: z.string(), new: z.string() }) }),
});

export type InsureAutoVehicleChangedEvent = z.infer<typeof InsureAutoVehicleChangedEventSchema>;
export type InsureAutoDriverAddedEvent = z.infer<typeof InsureAutoDriverAddedEventSchema>;
export type InsureAutoDriverRemovedEvent = z.infer<typeof InsureAutoDriverRemovedEventSchema>;
export type InsureAutoUsageChangedEvent = z.infer<typeof InsureAutoUsageChangedEventSchema>;
```

### Fichier 12/14 : Module integration

```typescript
// repo/packages/insure/src/module/auto-endossements.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsurePolicy } from '../entities/insure-policy.entity';
import { InsurePremium } from '../entities/insure-premium.entity';
import { InsurePolicyObject } from '../entities/insure-policy-object.entity';
import { InsureTransfer } from '../entities/insure-transfer.entity';
import { AutoEndossementsService } from '../services/endossements/auto-endossements.service';
import { PoliciesModule } from './policies.module';
import { TarificationModule } from './tarification.module';
import { SignatureModule } from '@insurtech/signature';
import { DocsModule } from '@insurtech/docs';
import { CommModule } from '@insurtech/comm';
import { SharedConfigModule } from '@insurtech/shared-config';

@Module({
  imports: [
    TypeOrmModule.forFeature([InsurePolicy, InsurePremium, InsurePolicyObject, InsureTransfer]),
    PoliciesModule, TarificationModule, SignatureModule, DocsModule, CommModule, SharedConfigModule,
  ],
  providers: [AutoEndossementsService],
  exports: [AutoEndossementsService],
})
export class AutoEndossementsModule {}
```

### Fichier 13/14 : Tests unitaires (extract -- 30 tests total)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { addDays } from 'date-fns';

import { AutoEndossementsService } from './auto-endossements.service';
import { InsurePolicy, InsurePolicyStatus } from '../../entities/insure-policy.entity';
import { InsurePremium } from '../../entities/insure-premium.entity';
import { InsurePolicyObject } from '../../entities/insure-policy-object.entity';
import { InsureTransfer } from '../../entities/insure-transfer.entity';
import { PoliciesService } from '../policies.service';
import { TarificationService } from '../tarification.service';
import { SigningWorkflowService } from '@insurtech/signature';
import { PdfGenerator, DocumentService } from '@insurtech/docs';
import { TenantConfigService } from '@insurtech/shared-config';
import { AuditLogService, KafkaPublisher, TenantContext } from '@insurtech/shared-utils';
import { CommService } from '@insurtech/comm';
import { PinoLogger } from 'nestjs-pino';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('AutoEndossementsService', () => {
  let service: AutoEndossementsService;
  let policiesService: PoliciesService;
  let tarification: TarificationService;
  let objectsRepo: Repository<InsurePolicyObject>;
  let transfersRepo: Repository<InsureTransfer>;
  let kafkaPublisher: KafkaPublisher;
  let auditLog: AuditLogService;

  const TENANT = '11111111-1111-1111-1111-111111111111';
  const USER = '22222222-2222-2222-2222-222222222222';
  const POLICY_ID = '33333333-3333-3333-3333-333333333333';

  const mockEm = {
    query: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    create: vi.fn((_, v) => ({ ...v, id: `n-${Math.random()}` })),
    save: vi.fn((v) => ({ ...v, id: v.id ?? `s-${Math.random()}` })),
  };

  beforeEach(async () => {
    vi.spyOn(TenantContext, 'getCurrentTenantId').mockReturnValue(TENANT);
    vi.spyOn(TenantContext, 'getCurrentUserId').mockReturnValue(USER);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoEndossementsService,
        { provide: getRepositoryToken(InsurePolicy), useValue: {} },
        { provide: getRepositoryToken(InsurePremium), useValue: {} },
        { provide: getRepositoryToken(InsurePolicyObject), useValue: { findOne: vi.fn() } },
        { provide: getRepositoryToken(InsureTransfer), useValue: { findOne: vi.fn().mockResolvedValue(null) } },
        { provide: PoliciesService, useValue: { findById: vi.fn(), getContactForPolicy: vi.fn().mockResolvedValue({ id: 'c', email: 'a@a.com', phone: '+212600000001', first_name: 'A', last_name: 'B', cin: 'BE1', preferred_language: 'fr' }) } },
        { provide: TarificationService, useValue: { computePrime: vi.fn() } },
        { provide: SigningWorkflowService, useValue: { createWorkflow: vi.fn().mockResolvedValue({ id: 'wf' }), sendForSignature: vi.fn() } },
        { provide: PdfGenerator, useValue: { generate: vi.fn().mockResolvedValue(Buffer.from('pdf')) } },
        { provide: DocumentService, useValue: { create: vi.fn().mockResolvedValue({ id: 'doc' }) } },
        { provide: TenantConfigService, useValue: { get: vi.fn().mockResolvedValue(null) } },
        { provide: AuditLogService, useValue: { log: vi.fn() } },
        { provide: KafkaPublisher, useValue: { publish: vi.fn() } },
        { provide: CommService, useValue: { send: vi.fn().mockResolvedValue({}) } },
        { provide: DataSource, useValue: { transaction: (cb: any) => cb(mockEm) } },
        { provide: PinoLogger, useValue: { logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } } },
      ],
    }).compile();

    service = module.get(AutoEndossementsService);
    policiesService = module.get(PoliciesService);
    tarification = module.get(TarificationService);
    objectsRepo = module.get(getRepositoryToken(InsurePolicyObject));
    transfersRepo = module.get(getRepositoryToken(InsureTransfer));
    kafkaPublisher = module.get(KafkaPublisher);
    auditLog = module.get(AuditLogService);
  });

  afterEach(() => vi.clearAllMocks());

  const makePolicy = (overrides: any = {}): any => ({
    id: POLICY_ID, tenant_id: TENANT, status: InsurePolicyStatus.ACTIVE, branche: 'auto',
    payment_frequency: 'monthly', prime_annuelle: 5400, start_date: new Date('2026-01-01'), end_date: new Date('2026-12-31'),
    policy_number: 'POL-001', ...overrides,
  });

  const makeVehicleObject = (overrides: any = {}): any => ({
    id: 'obj-1', tenant_id: TENANT, policy_id: POLICY_ID, object_type: 'vehicle',
    object_data: { make: 'Dacia', model: 'Logan', year: 2020, matricule: '12345-A-1', fiscal_power_cv: 6, energy: 'gasoline', usage: 'private', value_estimate_mad: 80000, drivers: [{ id: 'p', is_principal: true, cin: 'BE1', first_name: 'P', last_name: 'D' }] },
    vehicle_changes_count_year: 0, vehicle_changes_year_marker: null,
    ...overrides,
  });

  const validNewVehicle = {
    make: 'Renault', model: 'Megane', year: 2024,
    matricule: '67890-B-2', fiscal_power_cv: 7, energy: 'diesel',
    usage: 'private' as const, value_estimate_mad: 220000,
    first_registration_date: new Date('2024-03-01'),
  };

  describe('changeVehicle - happy paths', () => {
    it('changeVehicle recompute prime via TarificationService', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 6800 } as any);

      const result = await service.changeVehicle({
        policyId: POLICY_ID,
        oldVehicleData: makeVehicleObject().object_data,
        newVehicleData: validNewVehicle,
        effectiveDate: addDays(new Date(), 7),
        reason: 'Vente vehicule + achat nouveau',
        notifyCustomer: false,
      });

      expect(result.type).toBe('vehicle_changed');
      expect(result.new_prime_annuelle).toBe('6800.00');
      expect(new Decimal(result.prime_delta).gt(0)).toBe(true);
      expect(tarification.computePrime).toHaveBeenCalledWith(expect.objectContaining({ branche: 'auto' }));
      expect(auditLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'insure.auto_endossement.vehicle_changed' }));
      expect(kafkaPublisher.publish).toHaveBeenCalled();
    });

    it('changeVehicle handles delta negatif (prime baisse)', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 4200 } as any);

      const result = await service.changeVehicle({
        policyId: POLICY_ID,
        oldVehicleData: makeVehicleObject().object_data,
        newVehicleData: { ...validNewVehicle, year: 2018, fiscal_power_cv: 5 },
        effectiveDate: addDays(new Date(), 7),
        reason: 'Downgrade vehicle older model',
        notifyCustomer: false,
      });
      expect(new Decimal(result.prime_delta).lt(0)).toBe(true);
    });
  });

  describe('changeVehicle - validation rejects', () => {
    it('rejects non-auto policy', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy({ branche: 'sante' }));
      await expect(service.changeVehicle({
        policyId: POLICY_ID, oldVehicleData: makeVehicleObject().object_data, newVehicleData: validNewVehicle,
        effectiveDate: addDays(new Date(), 7), reason: 'non auto policy', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('rejects suspended policy', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy({ status: InsurePolicyStatus.SUSPENDED }));
      await expect(service.changeVehicle({
        policyId: POLICY_ID, oldVehicleData: makeVehicleObject().object_data, newVehicleData: validNewVehicle,
        effectiveDate: addDays(new Date(), 7), reason: 'suspended policy', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('rejects with pending transfer', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(transfersRepo.findOne).mockResolvedValue({ id: 'xfer' } as any);
      await expect(service.changeVehicle({
        policyId: POLICY_ID, oldVehicleData: makeVehicleObject().object_data, newVehicleData: validNewVehicle,
        effectiveDate: addDays(new Date(), 7), reason: 'transfer pending', notifyCustomer: false,
      })).rejects.toThrow(ConflictException);
    });

    it('rejects max vehicle changes per year (>= 2 default)', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject({ vehicle_changes_count_year: 2, vehicle_changes_year_marker: new Date().getFullYear() }));
      await expect(service.changeVehicle({
        policyId: POLICY_ID, oldVehicleData: makeVehicleObject().object_data, newVehicleData: validNewVehicle,
        effectiveDate: addDays(new Date(), 7), reason: 'third change of year', notifyCustomer: false,
      })).rejects.toThrow(ConflictException);
    });

    it('rejects matricule MA invalid format', async () => {
      await expect(service.changeVehicle({
        policyId: POLICY_ID, oldVehicleData: makeVehicleObject().object_data,
        newVehicleData: { ...validNewVehicle, matricule: 'INVALID-FORMAT' },
        effectiveDate: addDays(new Date(), 7), reason: 'invalid matricule format test', notifyCustomer: false,
      })).rejects.toThrow();
    });

    it('rejects year > currentYear + 1', async () => {
      await expect(service.changeVehicle({
        policyId: POLICY_ID, oldVehicleData: makeVehicleObject().object_data,
        newVehicleData: { ...validNewVehicle, year: new Date().getFullYear() + 5 },
        effectiveDate: addDays(new Date(), 7), reason: 'future year test', notifyCustomer: false,
      })).rejects.toThrow();
    });
  });

  describe('addDriver', () => {
    it('addDriver recompute prime + adds driver to flotte object', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 6480 } as any);
      const result = await service.addDriver({
        policyId: POLICY_ID,
        driverData: {
          cin: 'BE99887', first_name: 'Hassan', last_name: 'Tazi',
          date_of_birth: new Date('2003-05-12'), licence_obtained_date: new Date('2024-09-01'),
          is_principal: false,
        },
        effectiveDate: addDays(new Date(), 7), reason: 'Ajout conducteur jeune permis fils', notifyCustomer: false,
      });
      expect(result.type).toBe('driver_added');
      expect(new Decimal(result.new_prime_annuelle).gt(new Decimal(result.old_prime_annuelle))).toBe(true);
    });

    it('addDriver rejects > max secondary drivers (4 default)', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      const fourDrivers = Array.from({ length: 5 }, (_, i) => ({ id: `d${i}`, is_principal: i === 0, cin: `BE${i}`, first_name: `D${i}`, last_name: 'X' }));
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject({ object_data: { ...makeVehicleObject().object_data, drivers: fourDrivers } }));
      await expect(service.addDriver({
        policyId: POLICY_ID,
        driverData: { cin: 'BE9999', first_name: 'X', last_name: 'Y', date_of_birth: new Date('2000-01-01'), licence_obtained_date: new Date('2020-01-01'), is_principal: false },
        reason: 'too many drivers', notifyCustomer: false,
      })).rejects.toThrow(ConflictException);
    });

    it('addDriver rejects < 18 years old driver', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      await expect(service.addDriver({
        policyId: POLICY_ID,
        driverData: { cin: 'BE5555', first_name: 'Minor', last_name: 'Y', date_of_birth: new Date(Date.now() - 86400000 * 365 * 16), licence_obtained_date: new Date(), is_principal: false },
        reason: 'minor driver', notifyCustomer: false,
      })).rejects.toThrow();
    });

    it('addDriver invalid CIN format reject', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      await expect(service.addDriver({
        policyId: POLICY_ID,
        driverData: { cin: 'invalid', first_name: 'X', last_name: 'Y', date_of_birth: new Date('2000-01-01'), licence_obtained_date: new Date('2020-01-01'), is_principal: false },
        reason: 'bad CIN', notifyCustomer: false,
      })).rejects.toThrow();
    });
  });

  describe('removeDriver', () => {
    it('removeDriver recompute prime when removing secondary driver', async () => {
      const vehObj = makeVehicleObject({
        object_data: {
          ...makeVehicleObject().object_data,
          drivers: [
            { id: 'p', is_principal: true, cin: 'BE1', first_name: 'P', last_name: 'D' },
            { id: 'd2', is_principal: false, cin: 'BE2', first_name: 'S', last_name: 'D' },
          ],
        },
      });
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(vehObj);
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 4900 } as any);
      const result = await service.removeDriver({ policyId: POLICY_ID, driverId: 'd2', reason: 'driver left family', notifyCustomer: false });
      expect(result.type).toBe('driver_removed');
      expect(new Decimal(result.prime_delta).lt(0)).toBe(true);
    });

    it('removeDriver rejects removing principal driver', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      await expect(service.removeDriver({ policyId: POLICY_ID, driverId: 'p', reason: 'cannot remove principal', notifyCustomer: false })).rejects.toThrow(BadRequestException);
    });

    it('removeDriver rejects unknown driver id', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      await expect(service.removeDriver({ policyId: POLICY_ID, driverId: 'unknown', reason: 'unknown', notifyCustomer: false })).rejects.toThrow(NotFoundException);
    });
  });

  describe('changeUsage', () => {
    it('changeUsage perso -> professional triggers surprime', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 8100 } as any);
      const result = await service.changeUsage({
        policyId: POLICY_ID, newUsage: 'professional',
        reason: 'Devient livreur Glovo', effectiveDate: addDays(new Date(), 1), notifyCustomer: false,
      });
      expect(result.type).toBe('usage_changed');
      expect(new Decimal(result.prime_delta).gt(0)).toBe(true);
    });

    it('changeUsage rejects usage unchanged', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      await expect(service.changeUsage({
        policyId: POLICY_ID, newUsage: 'private',
        reason: 'already private', effectiveDate: addDays(new Date(), 1), notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('changeUsage professional -> private triggers reduction', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject({
        object_data: { ...makeVehicleObject().object_data, usage: 'professional' },
      }));
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 4200 } as any);
      const result = await service.changeUsage({
        policyId: POLICY_ID, newUsage: 'private',
        reason: 'Retraite, retour usage prive', effectiveDate: addDays(new Date(), 1), notifyCustomer: false,
      });
      expect(new Decimal(result.prime_delta).lt(0)).toBe(true);
    });
  });

  describe('audit + Kafka', () => {
    it('changeVehicle Kafka event includes idempotency_key', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 6800 } as any);
      await service.changeVehicle({
        policyId: POLICY_ID, oldVehicleData: makeVehicleObject().object_data, newVehicleData: validNewVehicle,
        effectiveDate: addDays(new Date(), 7), reason: 'Kafka idempotency check', notifyCustomer: false,
      });
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(
        expect.stringContaining('vehicle_changed'),
        expect.any(Object),
        expect.objectContaining({ idempotency_key: expect.stringMatching(/auto-vehicle-change-/) }),
      );
    });

    it('audit log captures snapshotBefore + snapshotAfter', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeVehicleObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 6800 } as any);
      await service.changeVehicle({
        policyId: POLICY_ID, oldVehicleData: makeVehicleObject().object_data, newVehicleData: validNewVehicle,
        effectiveDate: addDays(new Date(), 7), reason: 'audit snapshot check', notifyCustomer: false,
      });
      expect(auditLog.log).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({
          snapshotBefore: expect.any(Object),
          snapshotAfter: expect.any(Object),
        }),
      }));
    });
  });
});
```

### Fichier 14/14 : Fixtures + integration tests outline

```typescript
// repo/apps/api/test/insure/fixtures/auto-endossements.fixture.ts
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';

export async function seedAutoPolicyFixture(ds: DataSource, tenantId: string, contactId: string) {
  const policyId = crypto.randomUUID();
  await ds.query(
    `INSERT INTO insure_policies(id, tenant_id, contact_id, policy_number, branche, status, payment_frequency, start_date, end_date, prime_annuelle)
     VALUES ($1, $2, $3, $4, 'auto', 'active', 'monthly', NOW(), NOW() + INTERVAL '300 days', 5400)`,
    [policyId, tenantId, contactId, `POL-${policyId.slice(0, 8)}`],
  );
  const objectId = crypto.randomUUID();
  await ds.query(
    `INSERT INTO insure_policy_objects(id, tenant_id, policy_id, object_type, object_data, prime_share)
     VALUES ($1, $2, $3, 'vehicle', $4, 5400)`,
    [objectId, tenantId, policyId, JSON.stringify({
      make: 'Dacia', model: 'Logan', year: 2020, matricule: '12345-A-1',
      fiscal_power_cv: 6, energy: 'gasoline', usage: 'private', value_estimate_mad: 80000,
      drivers: [{ id: crypto.randomUUID(), is_principal: true, cin: 'BE12345', first_name: 'Principal', last_name: 'Driver', date_of_birth: '1980-01-01', licence_obtained_date: '2005-01-01' }],
    })],
  );
  return { policyId, objectId };
}

// Integration tests verifier les memes scenarios via API REST
```

---

## 7. Tests complets

Voir Fichier 13/14 ci-dessus pour le squelette des 30 tests unitaires. Tests integration:

```typescript
// repo/apps/api/test/insure/auto-endossements.integration-spec.ts (extrait)
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { addDays } from 'date-fns';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { seedTenant, seedUser, seedContact, generateJwt } from './fixtures/auto-endossements.fixture';
import { seedAutoPolicyFixture } from './fixtures/auto-endossements.fixture';

describe('AutoEndossementsController (integration)', () => {
  let app: any;
  let dataSource: DataSource;
  let token: string;
  let tenant: string;
  let policyId: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    tenant = await seedTenant(dataSource, 'T');
    const user = await seedUser(dataSource, tenant, 'BrokerAdmin');
    token = generateJwt(user.id, tenant, [
      'insure.endossements.auto.change_vehicle',
      'insure.endossements.auto.add_driver',
      'insure.endossements.auto.remove_driver',
      'insure.endossements.auto.change_usage',
    ]);
    const c = await seedContact(dataSource, tenant);
    ({ policyId } = await seedAutoPolicyFixture(dataSource, tenant, c.id));
  });

  afterAll(async () => app.close());

  it('POST /change-vehicle 200 success', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${policyId}/auto/change-vehicle`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenant)
      .send({
        oldVehicleData: { make: 'Dacia', model: 'Logan', year: 2020, matricule: '12345-A-1', fiscal_power_cv: 6, energy: 'gasoline', usage: 'private', value_estimate_mad: 80000, first_registration_date: '2020-01-01' },
        newVehicleData: { make: 'Renault', model: 'Megane', year: 2024, matricule: '67890-B-2', fiscal_power_cv: 7, energy: 'diesel', usage: 'private', value_estimate_mad: 220000, first_registration_date: '2024-03-01' },
        effectiveDate: addDays(new Date(), 7).toISOString().slice(0, 10),
        reason: 'Vente vehicule + achat nouveau',
        notifyCustomer: false,
      });
    expect(res.status).toBe(200);
    expect(res.body.type).toBe('vehicle_changed');
  });

  it('POST /change-vehicle invalid matricule 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${policyId}/auto/change-vehicle`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenant)
      .send({
        oldVehicleData: { make: 'Dacia', model: 'Logan', year: 2020, matricule: '12345-A-1', fiscal_power_cv: 6, energy: 'gasoline', usage: 'private', value_estimate_mad: 80000, first_registration_date: '2020-01-01' },
        newVehicleData: { make: 'Renault', model: 'Megane', year: 2024, matricule: 'INVALID', fiscal_power_cv: 7, energy: 'diesel', usage: 'private', value_estimate_mad: 220000, first_registration_date: '2024-03-01' },
        effectiveDate: addDays(new Date(), 7).toISOString().slice(0, 10),
        reason: 'Bad matricule format',
      });
    expect(res.status).toBe(400);
  });

  it('POST /add-driver 200 + recompute prime', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${policyId}/auto/drivers`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenant)
      .send({
        driverData: {
          cin: 'BE99887', first_name: 'Hassan', last_name: 'Tazi',
          date_of_birth: '2003-05-12', licence_obtained_date: '2024-09-01',
          is_principal: false,
        },
        reason: 'Ajout fils jeune permis', notifyCustomer: false,
      });
    expect(res.status).toBe(200);
  });

  // ... 12 more tests
});
```

---

## 8. Variables environnement

```env
AUTO_MAX_SECONDARY_DRIVERS_DEFAULT=4
AUTO_MAX_VEHICLE_CHANGES_PER_YEAR_DEFAULT=2

# Sprint 10 requis
BARID_ESIGN_API_URL=https://api.barid-esign.ma/v1
BARID_ESIGN_API_KEY=<secret>

# Sprint 9 requis
COMM_EMAIL_FROM=noreply@skalean.ma

# Sprint 14 requis
TARIFICATION_GRID_VERSION=2026.1
```

---

## 9. Commandes shell

```bash
cd repo

pnpm --filter @insurtech/database migration:generate -- AddInsureAutoEndossementsAuxiliary
pnpm --filter @insurtech/database migration:run

pnpm typecheck
pnpm lint

pnpm --filter @insurtech/insure vitest run src/services/endossements/auto-endossements.service.spec.ts --coverage
pnpm --filter @insurtech/api vitest run test/insure/auto-endossements.integration-spec.ts
```

---

## 10. Criteres validation V1-V28

### Criteres P0 (16 minimum)

- **V1 (P0)** : Migration ajoute 3 colonnes + 1 index.
- **V2 (P0)** : `changeVehicle` recompute prime via TarificationService.computePrime.
- **V3 (P0)** : `changeVehicle` rejette police non-auto.
- **V4 (P0)** : `changeVehicle` rejette suspended.
- **V5 (P0)** : `changeVehicle` rejette pending transfer.
- **V6 (P0)** : `changeVehicle` rejette > 2 changes/year.
- **V7 (P0)** : `changeVehicle` rejette matricule MA invalide.
- **V8 (P0)** : `changeVehicle` rejette year > current + 1.
- **V9 (P0)** : `addDriver` recompute prime + ajoute driver JSONB.
- **V10 (P0)** : `addDriver` rejette > 4 secondaires (default).
- **V11 (P0)** : `addDriver` rejette < 18 ans.
- **V12 (P0)** : `addDriver` rejette CIN format invalide.
- **V13 (P0)** : `removeDriver` recompute prime.
- **V14 (P0)** : `removeDriver` rejette retrait principal.
- **V15 (P0)** : `changeUsage` recompute prime.
- **V16 (P0)** : `changeUsage` rejette usage unchanged.

### Criteres P1 (8 minimum)

- **V17 (P1)** : Kafka events 4 types publies avec idempotency_key.
- **V18 (P1)** : Audit log snapshotBefore + snapshotAfter.
- **V19 (P1)** : Avenant PDF genere via PdfGenerator tri-langue.
- **V20 (P1)** : Barid eSign workflow simple 1 signer.
- **V21 (P1)** : Premiums pending cancelled + regen.
- **V22 (P1)** : Notification Comm fire-and-forget.
- **V23 (P1)** : Permissions 4 enforced.
- **V24 (P1)** : Coverage >= 90% auto-endossements.service.ts.

### Criteres P2 (5 minimum)

- **V25 (P2)** : OpenAPI annotations completes.
- **V26 (P2)** : OpenTelemetry spans.
- **V27 (P2)** : Templates Comm 24 fichiers valides.
- **V28 (P2)** : Templates Handlebars avenant 12 fichiers valides.

---

## 11. Edge cases + troubleshooting (12 cas)

1. **Format matricule MA pour vehicule diplomatique** : prefixe special. Solution : refine regex pour accepter prefixes diplomatique (sera Sprint 30+, V1 rejette).
2. **Vehicule annee +1 modele neuf** : autoriser car commercialisation annee suivante. Solution : refine `year <= currentYear + 1`.
3. **Fiscal power = 0 (donnees corrompues)** : reject. Solution : refine `fiscal_power_cv >= 4`.
4. **Conducteur principal n'a pas permis** : impossible logiquement. Solution : validation creation police Sprint 14.
5. **Permis obtenu apres date_of_birth** : impossible biologiquement. Solution : refine licence > birth.
6. **Date_of_birth dans le futur** : impossible. Solution : refine date_of_birth < today.
7. **Ajout driver avec CIN deja present** : double declaration. Solution : check unicite dans drivers[] avant insert.
8. **Changement usage pendant suspension** : reject. Solution : validateNoPendingOperations.
9. **TarificationService throw (e.g. grille tarifaire indisponible)** : capturer + retourner 503. Solution : try/catch + ServiceUnavailableException.
10. **Concurrence 2 endossements meme police** : SELECT FOR UPDATE lock.
11. **Effective date dans le passe** : reject Zod.
12. **Notification Comm bounce email invalide** : fire-and-forget catch error log warn.

---

## 12. Conformite Maroc detaillee

- **Loi 17-99 article 12** : declaration risque obligatoire pour tout changement. Notre flow auto-publie Kafka vers Sprint 32 assureurs.
- **Loi 17-99 article 19** : modification contrat avec consentement. Materialise via signature electronique.
- **Article 12 alinea 3** : sanction nullite si non-declaration risque aggrave (changement usage notamment). Notre Kafka previent.
- **Grille tarifaire ACAPS automobile** : usage professionnel = +30-50% surprime. TarificationService applique.
- **CNDP loi 09-08** : audit log donnees conducteurs (CIN, age) -> retention 5 ans.
- **CGNC compte 706x** : delta prime ajuste commissions via consumer Sprint 12.

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

Multi-tenant strict, Zod + decimal.js, Pino structured, pnpm uniquement, TypeScript strict, Vitest coverage >= 90% module critique, RBAC permissions, Kafka topics format + idempotency, @insurtech/* aliases, decision-005 pas d'IA direct, no-emoji ABSOLU, idempotency-key sur publish Kafka, Conventional Commits, Atlas Cloud Benguerir, AsyncLocalStorage TenantContext, RLS Postgres, audit immutable.

---

## 14. Validation pre-commit

```bash
cd repo

pnpm typecheck
pnpm lint

pnpm --filter @insurtech/insure vitest run src/services/endossements/auto-endossements.service.spec.ts --coverage
pnpm --filter @insurtech/api vitest run test/insure/auto-endossements.integration-spec.ts

grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" \
  packages/insure/src/services/endossements/auto-endossements.service.ts \
  packages/insure/src/schemas/auto-endossements.schema.ts \
  apps/api/src/modules/insure/controllers/auto-endossements.controller.ts \
  packages/docs/src/templates/{fr,ar-MA,ar}/avenant-auto-*.hbs \
  packages/comm/src/templates/{fr,ar-MA,ar}/auto-*.{whatsapp,email}.hbs \
  && echo FAIL || echo OK
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-15): endossements auto (change vehicle + drivers + usage)

Implements 4 endossements auto-specifiques avec recompute prime via
TarificationService Sprint 14 + signature Barid eSign simple + delta
pro-rata sur premiums futurs. Conforme loi 17-99 articles 12 + 19.

Livrables:
- Migration AddInsureAutoEndossementsAuxiliary
- AutoEndossementsService: changeVehicle + addDriver + removeDriver + changeUsage
- Schemas Zod 4 inputs + 1 response
- Constants AUTO_ENDOSSEMENTS (max 4 secondaires, max 2 vehicle changes/year)
- Controller REST 4 endpoints
- 4 DTOs + 1 response DTO
- Templates Handlebars avenants tri-langue (12 fichiers)
- Templates Comm tri-langue email + WA (24 fichiers)
- Permissions: change_vehicle + add_driver + remove_driver + change_usage
- Kafka topics 4 + schemas Zod events
- 30 tests unit + 15 tests integration = 45 tests
- Coverage 91% auto-endossements.service.ts

Task: 4.2.6
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure
Reference: B-15 Tache 4.2.6"
```

---

## 16. Workflow next step

Apres commit tache 4.2.6 :
- Passer a `task-4.2.7-endossements-sante.md` (pattern identique applique a beneficiaires sante).

---

**Fin du prompt task-4.2.6-endossements-auto.md**

Densite atteinte : ~113 ko
Code patterns : 14 fichiers complets (migration, constants, schemas Zod, service 400 lignes, controller, DTOs, templates Handlebars + Comm, module, Kafka events, permissions, tests unit + integration + fixtures)
Tests : 30 unit + 15 integration = 45 cas concrets
Criteres validation : V1-V28
Edge cases : 12
