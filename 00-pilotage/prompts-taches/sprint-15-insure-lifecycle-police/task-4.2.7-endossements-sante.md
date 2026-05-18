# TACHE 4.2.7 -- Endossements Sante (Ajout/Retrait Beneficiaires Conjoint/Enfants/Ascendants)

**Sprint** : 15 (Phase 4 / Sprint 2 dans phase Vertical Insure)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-15-sprint-15-insure-lifecycle-police.md` (Tache 4.2.7)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (mariages, naissances, deces -- evenements vie quotidiens declenchent endossements sante)
**Effort** : 5h
**Dependances** :
- Tache 4.2.6 (pattern endossements auto -- meme structure applicable)
- Tache 4.2.5 (Flotte pattern + entite InsurePolicyObject pour beneficiaires)
- Tache 4.2.1 (workflow signature simple)
- Sprint 14 (TarificationService.computePrime branche sante)
- Sprint 10 (Barid eSign)
- Sprint 9 (Comm tri-langue)
- Sprint 8 (CRM Contacts)
- Sprint 7 (RBAC)
- Sprint 6 (multi-tenant RLS)

**Densite cible** : 110-140 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente les **endossements specifiques a la branche sante** : ajout d'un beneficiaire (conjoint, enfant, ascendant a charge), retrait d'un beneficiaire (deces, divorce, enfant emancipe), et mise a jour des donnees medicales declarees (changements declarations affections preexistantes, traitements en cours). Chaque endossement materialise une **modification formelle** de la police d'assurance sante, **recalcule la prime** via le `TarificationService` (Sprint 14, grille sante avec facteurs age beneficiaire, antecedents declares, statut tabagique, IMC declare si applicable), **applique un avenant signe electroniquement** (Barid eSign signature simple, 1 signer : assure principal souscripteur), **regenere les primes futurs** sur la nouvelle assiette tarifaire, **publie evenements Kafka** consume par Analytics (Sprint 13), Compliance ACAPS (Sprint 18), et notifie le souscripteur dans sa langue preferee (fr / ar-MA / ar). C'est une operation **frequente** chez les courtiers marocains specialises sante : mariage de l'assure (ajout conjoint), naissance d'un enfant (ajout enfant nouveau-ne), deces d'un parent a charge (retrait ascendant), enfant atteint 25 ans et perd la couverture (retrait automatique sauf justificatif scolarite/handicap), divorce (retrait conjoint), declaration nouvelle pathologie (mise a jour donnees medicales).

L'apport est triple. **Premierement**, on cree `SanteEndossementsService` avec **3 methodes principales** : `addBeneficiaire(policyId, beneficiaireData, relation: 'spouse' | 'child' | 'parent')` qui (a) valide les contraintes legales sante (max 5 beneficiaires, enfants jusqu'a 25 ans sauf exception, ascendants a charge avec justificatif fiscal), (b) recompute la prime via `TarificationService.computePrime({ branche: 'sante', beneficiaires: [...allBenefs, newBenef], assure_principal })`, (c) genere avenant PDF tri-langue, (d) initie workflow Barid eSign simple, (e) update flotte object (Tache 4.2.5) avec nouveau beneficiaire dans `object_data.beneficiaires[]`, (f) regen premiums futurs avec nouvelle prime, (g) audit + Kafka publish; `removeBeneficiaire(policyId, beneficiaireId)` qui retire le beneficiaire de la flotte, recompute prime (baisse generalement) + cancel/regen premiums; `updateBeneficiaireData(policyId, beneficiaireId, newMedicalData)` qui met a jour declarations medicales (impact tarif si declaration nouvelle pathologie chronique = +15-30% surprime, declaration arret tabagisme = -10% reduction). **Deuxiemement**, on enforce les **limites strict legalement** : max 5 beneficiaires par police (configurable per tenant), enfants `>= 18 ans` declarables uniquement si **justificatif scolarite valide** (annee universitaire en cours, max 25 ans selon CG sante standard MA), enfants `< 18 ans` automatiquement eligibles (parents = principal + conjoint), enfants `> 25 ans` rejet sauf flag `handicap_invalidite_certified` (justificatif COMTI -- Commission Communale Technique d'Invalidite), ascendants a charge eligibles uniquement si justificatif fiscal `attestation_charge_fiscale` (preuve qu'ils sont fiscalement a charge de l'assure principal). **Troisiemement**, on integre les **declarations CNDP renforcees** : les donnees medicales sont des **donnees sensibles** au sens article 4 alinea 3 de la loi 09-08 (CNDP), necessitent **consentement explicite specifique** du beneficiaire (case a cocher cocheee), chiffrement at-rest renforce (AES-256-GCM + KMS Atlas Cloud Benguerir), audit log avec masquage partial (CIN tronque a 4 caracteres dans logs accessibles aux non-admins), retention 10 ans (vs 5 ans donnees standard), suppression secure si demande exercice droit a l'oubli (article 9 loi 09-08).

A l'issue de cette tache, un courtier sante peut gerer en quelques millisecondes le cycle de vie complet de la famille couverte : ajout conjoint suite a mariage avec impact tarifaire calcule precisement (typiquement +35-50% prime selon age conjoint et antecedents), ajout enfant nouveau-ne (free pour les 30 premiers jours selon CG MA, puis tarif standard appliquee), retrait beneficiaire avec recalcul automatique. Chaque operation genere un avenant PDF tri-langue, est signee electroniquement, declenche notification Comm, et publie un evenement Kafka pour le reporting compliance trimestriel ACAPS (Sprint 18). Cette tache reutilise massivement le pattern Tache 4.2.6 (recompute prime + signature simple + delta pro-rata) et ajoute les specificites sante (donnees medicales sensibles + limites legales). Cette tache bloque Tache 4.2.8 (endossements habitation/RC/voyage suit meme pattern) et Tache 4.2.13 (tests E2E 4 scenarios sante).

---

## 2. Contexte etendu

### 2.1 Pourquoi les endossements sante sont strategiques au Maroc

Le marche marocain de l'assurance sante represente **2,4 Md DH** de primes brutes 2024 (donnees ACAPS), avec environ **1,2 millions de polices sante individuelles + 800 000 polices groupe entreprise**. Pour les polices individuelles (cible Skalean InsurTech), la composition typique inclut **2-4 beneficiaires** (assure principal + conjoint + 1-3 enfants), avec une evolution familiale moyenne de **15-20% par an** : mariages (8%), naissances (5%), deces ascendants (2-3%), divorces (3-5%), enfants emancipes (5-7% par an passe 25 ans). Pour un courtier sante moyen (1 500 polices), cela represente **250-350 endossements sante / an**, distribues comme suit (donnees agreges 3 courtiers cibles, 2024) :

- **Ajout conjoint suite mariage (35%)** : 100 cas/an. Impact tarifaire moyen +40% (conjoint typiquement 25-40 ans, prime moyenne +1 800 DH/an).
- **Ajout enfant nouveau-ne (25%)** : 70 cas/an. Impact tarifaire moyen +12% (jeune enfant = peu de risque, prime +400 DH/an apres periode gratuite 30j).
- **Retrait enfant > 25 ans (15%)** : 45 cas/an. Reduction prime -15%.
- **Retrait conjoint suite divorce (10%)** : 30 cas/an. Reduction -30%.
- **Retrait ascendant suite deces (8%)** : 25 cas/an. Reduction -20-25% (ascendants ages = prime tres elevee).
- **Mise a jour donnees medicales (7%)** : 20 cas/an. Impact variable (-10% si arret tabac, +25% si nouvelle pathologie chronique declaree).

Sans automatisation, chaque endossement sante prend **60-90 minutes** chez le courtier : reception demande, collecte justificatifs (acte mariage, acte naissance, certificat deces, attestation scolarite, attestation handicap COMTI), saisie donnees medicales beneficiaire, calcul tarif (Excel maison + grille assureur), redaction avenant, impression, signature physique, scan, transmission assureur. Notre service automatise tout : reduction a **<15 minutes** (incluant upload justificatifs). Gain courtier moyen : **300 endossements x 75 min reduction = 375 heures/an** = 0.25 ETP libere.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas d'endossements sante (forcer souscription nouvelle police per beneficiaire) | Simple | Inefficient, perte historique anciennete (impact bonus), couts re-souscription | Rejete (anti-client) |
| Endossement gratuit (aucun frais admin) | Friction zero | Cout admin non couvert | Rejete (perte marge -- frais 3% appliques comme Tache 4.2.2/4.2.6) |
| **Endossement avec recompute TarificationService + signature simple + delta pro-rata + chiffrement renforce donnees medicales** (retenu) | Equilibre, conforme CNDP, scalable | Plus de code | RETENU |
| Endossement avec workflow validation medicale assureur (Sprint 32) | Tres conforme | Latence enorme (24-72h), pas utile V1 | Defere Sprint 32 |
| Donnees medicales en clair (pas chiffrement renforce) | Plus simple acces | Violation CNDP art. 4-3, sanctions | Rejete (illegal) |

### 2.3 Trade-offs explicites

**Premier trade-off : limite max 5 beneficiaires**. Configurable per tenant (3-10 range). Trade-off : familles >5 personnes doivent souscrire 2 polices (rare au MA, taille foyer moyen 4.2 selon HCP).

**Deuxieme trade-off : enfant > 25 ans rejet sans flag handicap**. Strict default. Alternative : permettre avec justificatif scolarite jusqu'a 28 ans (cas Master/PhD). On choisit strict 25 ans car pratique sectorielle (CG standard sante MA), `handicap_invalidite_certified` flag autorise extension illimitee.

**Troisieme trade-off : ascendant a charge avec justificatif fiscal obligatoire**. Anti-fraude. Sans justificatif, rejet. Trade-off : friction admin mais conforme ACAPS (article reglementaire 2020-08).

**Quatrieme trade-off : nouveau-ne gratuit 30 jours**. CG standard MA reconnaissent periode de gratuite (article 7-3 CG sante standard). On applique. Apres 30 jours, prime standard. Trade-off : complexite logique mais conformite pratique.

**Cinquieme trade-off : donnees medicales chiffrement at-rest AES-256-GCM**. Chiffrement renforce CNDP (vs AES-256-CBC standard autres tables). Trade-off : latence read +5ms mais conformite article 4 alinea 3.

**Sixieme trade-off : retention 10 ans donnees medicales**. CGNC + loi assurance imposent 10 ans pour records sante (vs 5 ans standard CNDP). Trade-off : grossissement storage mais conformite.

### 2.4 Decisions strategiques referenced

- **decision-001 (monorepo)** : packages/insure
- **decision-002 (multi-tenant)** : config per tenant
- **decision-006 (no-emoji ABSOLU)**
- **decision-009 (Zod + decimal.js)**
- **decision-013 (audit immutable)**
- **decision-014 (commissions immutables)**
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)**

### 2.5 Pieges techniques connus

1. **Piege : donnees medicales non chiffrees**. Solution : colonne JSONB avec chiffrement applicatif via `MedicalDataEncryptor` (Atlas KMS), JAMAIS clair.
2. **Piege : enfant 25 ans pile**. Edge date. Solution : `differenceInYears(today, beneficiaire.date_of_birth) <= 25` (inclusif).
3. **Piege : conjoint deja present, double conjoint**. Polygamie legalement reconnue au MA. Solution : par default rejet "spouse already present", configurable per tenant `health_allow_multiple_spouses`.
4. **Piege : enfant declare avec CIN parent**. Confusion. Solution : enfants < 12 ans n'ont pas CIN, identifiant `acte_naissance_numero` requis. >= 12 ans CIN requis.
5. **Piege : mise a jour donnees medicales sans recompute prime**. Si nouvelle pathologie chronique declaree, prime doit augmenter. Solution : `updateBeneficiaireData` rerun TarificationService.
6. **Piege : suppression beneficiaire avec sinistre en cours**. Sprint 19 ClaimsService verifie pas de claim ouvert sur beneficiaire avant remove. Cross-cutting check.
7. **Piege : justificatif scolarite expire**. Solution : `attestation_scolarite_valid_until` date dans beneficiaire metadata. Cron annuel Sprint 18 reverifie + alerte courtier.
8. **Piege : justificatif fiscal ascendant non a jour**. Renouvellement annuel. Solution : meme mecanisme.
9. **Piege : retention 10 ans cron CNDP retention conflit**. Solution : table `medical_data_retention_policies` avec metadata branche -> sante = 10 ans.
10. **Piege : consentement explicite beneficiaire non collecte**. CNDP exige consentement separee assure / beneficiaire. Solution : flag `consent_collected_at` + signature electronique beneficiaire si >= 18 ans (sinon parent).
11. **Piege : nouveau-ne periode gratuite 30j calcul**. Solution : si date_of_birth recente <= 30 jours, montant beneficiaire = 0 jusqu'au jour 31.
12. **Piege : changement statut tabagique sans confirmation medicale**. Solution : declaration assure suffit (declaration sur l'honneur, audit si verification ulterieure).

### 2.6 Conformite legale Maroc

- **Loi 17-99 article 12** (declaration risque sante).
- **Loi 09-08 article 4 alinea 3** (donnees sensibles sante).
- **Loi 09-08 article 9** (droit a l'oubli).
- **CGNC art. 38-14** (retention records assurance 10 ans).
- **Reglement ACAPS 2020-08** (justificatifs ascendants a charge).
- **CG sante standard MA article 7-3** (periode gratuite nouveau-ne 30 jours).
- **CG sante standard MA article 8-2** (enfants jusqu'a 25 ans sauf handicap).

### 2.7 Glossaire metier

- **Beneficiaire** : personne autre que l'assure principal couverte par la police.
- **Souscripteur / Assure principal** : titulaire police, paye prime.
- **Conjoint** : epoux(se) legal au MA.
- **Enfant a charge** : enfant biologique ou adoptif, scolarise ou non.
- **Ascendant a charge** : parent (mere/pere/grand-parent) fiscalement a charge.
- **Donnees medicales declarees** : antecedents, traitements, tabagisme, IMC.
- **Periode gratuite nouveau-ne** : 30 premiers jours de vie, couverture gratuite.

---

## 3. Architecture context

### 3.1 Position dans le sprint 15

Cette tache 4.2.7 est la **septieme** des 13 du Sprint 15.

- **Depend de** : 4.2.6 (pattern endossement applicable), 4.2.5 (Flotte), 4.2.1 (signature workflow), Sprint 14 (TarificationService branche sante).
- **Bloque** : Tache 4.2.8 (habitation/RC/voyage -- meme pattern), Tache 4.2.11 (consolidation), Tache 4.2.13 (E2E 4 sante scenarios).

### 3.2 Position dans le programme global

- **Sprint 16** : composants `AddBeneficiaireDialog`, `RemoveBeneficiaireDialog`, `UpdateMedicalDataDialog`.
- **Sprint 17** : permet client demander endossement via espace assure.
- **Sprint 18** : Kafka consumer aggregate stats endossements sante quarterly.
- **Sprint 28** : reports ACAPS confidentiels donnees sante anonymisees.
- **Sprint 30+** : suggestion IA ajout beneficiaire (analyse profil familial).

### 3.3 Diagramme flow (similaire 4.2.6, beneficiaires sante au lieu vehicule + drivers)

```
+-----------------------------------------------------+
| SanteEndossementsService.addBeneficiaire(...)       |
|       |                                             |
|       v                                             |
| Validations: max 5, age enfants, ascendants fisc.  |
|       |                                             |
|       v                                             |
| TarificationService.computePrime({branche:sante})  |
|       |                                             |
|       v                                             |
| Transaction: update flotte + cancel/regen prems    |
|       |                                             |
|       v                                             |
| Avenant PDF + Barid eSign simple 1 signer          |
|       |                                             |
|       v                                             |
| Audit + Kafka + Comm fr/ar-MA/ar                   |
+-----------------------------------------------------+
```

---

## 4. Livrables checkables (26 items)

- [ ] Migration `AddInsureSanteBeneficiairesEncryption` : ajout colonnes encryption metadata + retention policy (~30 lignes)
- [ ] Service `sante-endossements.service.ts` (~340 lignes) : `addBeneficiaire`, `removeBeneficiaire`, `updateBeneficiaireData` + helpers
- [ ] Schemas Zod `sante-endossements.schema.ts` (~110 lignes)
- [ ] Constants `sante-endossements.constants.ts` : DEFAULT_MAX_BENEFICIAIRES = 5, AGE_LIMIT_ENFANTS = 25, NOUVEAU_NE_GRATUITE_DAYS = 30 (~30 lignes)
- [ ] MedicalDataEncryptor service (~80 lignes) -- chiffrement AES-256-GCM Atlas KMS
- [ ] Controller `sante-endossements.controller.ts` (~150 lignes) : 3 endpoints
- [ ] DTOs : `AddBeneficiaireDto`, `RemoveBeneficiaireDto`, `UpdateBeneficiaireDataDto`, response DTO (~90 lignes)
- [ ] Permissions catalog : 3 perms `insure.endossements.sante.{add_beneficiaire,remove_beneficiaire,update_medical_data}`
- [ ] Kafka topics : `INSURE_SANTE_BENEFICIAIRE_ADDED/REMOVED/MEDICAL_DATA_UPDATED` + schemas Zod
- [ ] Templates Comm tri-langue (fr/ar-MA/ar) x 3 endossements x 2 channels = 18 fichiers
- [ ] Templates Handlebars avenants : `avenant-sante-{add-beneficiaire,remove-beneficiaire,medical-data-updated}` tri-langue = 9 fichiers
- [ ] Tests unit `sante-endossements.service.spec.ts` (~340 lignes / 25 tests)
- [ ] Tests integration (~300 lignes / 12 tests)
- [ ] Fixtures `sante-endossements.fixture.ts` (~140 lignes)
- [ ] Module integration `SanteEndossementsModule`
- [ ] TenantConfig keys documentees : `health_max_beneficiaires`, `health_age_limit_enfants`, `health_allow_multiple_spouses`, `health_data_retention_years`
- [ ] Audit log avec masquage partial CIN (4 derniers chars)
- [ ] Chiffrement at-rest donnees medicales AES-256-GCM Atlas KMS
- [ ] Validation justificatif scolarite (date_validity)
- [ ] Validation justificatif fiscal ascendant
- [ ] Periode gratuite 30j nouveau-ne
- [ ] Documentation `SANTE-ENDOSSEMENTS.md`
- [ ] OpenAPI annotations completes
- [ ] OpenTelemetry spans
- [ ] Helper `computeNouveauNeGratuitePeriod(date_of_birth)` testable
- [ ] Logger Pino avec masquage donnees sensibles

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/{ts}-AddInsureSanteBeneficiairesEncryption.ts    (~40 lignes)
repo/packages/insure/src/services/endossements/sante-endossements.service.ts            (~360 lignes)
repo/packages/insure/src/services/endossements/sante-endossements.service.spec.ts       (~360 lignes / 25 tests)
repo/packages/insure/src/services/endossements/SANTE-ENDOSSEMENTS.md                    (~70 lignes)
repo/packages/insure/src/schemas/sante-endossements.schema.ts                            (~130 lignes)
repo/packages/insure/src/constants/sante-endossements.constants.ts                       (~40 lignes)
repo/packages/insure/src/services/medical-data-encryptor.service.ts                      (~100 lignes)
repo/packages/insure/src/module/sante-endossements.module.ts                             (~30 lignes)
repo/packages/insure/src/index.ts                                                         (modif)
repo/packages/docs/src/templates/{fr,ar-MA,ar}/avenant-sante-add-beneficiaire.hbs        (3 fichiers, ~80 lignes chacun)
repo/packages/docs/src/templates/{fr,ar-MA,ar}/avenant-sante-remove-beneficiaire.hbs     (3 fichiers, ~70 lignes chacun)
repo/packages/docs/src/templates/{fr,ar-MA,ar}/avenant-sante-medical-data-updated.hbs    (3 fichiers, ~75 lignes chacun)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/sante-beneficiaire-added.{whatsapp,email}.hbs    (6 fichiers, ~25 lignes chacun)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/sante-beneficiaire-removed.{whatsapp,email}.hbs  (6 fichiers, ~25 lignes chacun)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/sante-medical-data-updated.{whatsapp,email}.hbs  (6 fichiers, ~25 lignes chacun)
repo/apps/api/src/modules/insure/controllers/sante-endossements.controller.ts            (~180 lignes)
repo/apps/api/src/modules/insure/dto/add-beneficiaire.dto.ts                             (~40 lignes)
repo/apps/api/src/modules/insure/dto/remove-beneficiaire.dto.ts                          (~20 lignes)
repo/apps/api/src/modules/insure/dto/update-beneficiaire-data.dto.ts                     (~30 lignes)
repo/apps/api/src/modules/insure/dto/sante-endossement-response.dto.ts                   (~50 lignes)
repo/apps/api/src/modules/insure/insure.module.ts                                        (modif)
repo/apps/api/test/insure/sante-endossements.integration-spec.ts                          (~340 lignes / 12 tests)
repo/apps/api/test/insure/fixtures/sante-endossements.fixture.ts                          (~150 lignes)
repo/packages/auth/src/rbac/permissions.enum.ts                                          (modif / +3 perms)
repo/packages/auth/src/rbac/permissions-matrix.ts                                        (modif)
repo/packages/shared-types/src/kafka-topics.ts                                           (modif / +3 topics)
repo/packages/shared-types/src/events/insure-sante-endossements.events.ts                 (~100 lignes)
```

**Volume total** : ~2 900 lignes nouvelles.

---

## 6. Code patterns COMPLETS

### Fichier 1/12 : Migration `AddInsureSanteBeneficiairesEncryption`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 15 Tache 4.2.7 -- Ajout colonnes encryption + retention donnees medicales.
 *
 * Reference : Loi 09-08 article 4 alinea 3 (donnees sante = donnees sensibles)
 * + CGNC 38-14 retention 10 ans + ACAPS 2020-08.
 */
export class AddInsureSanteBeneficiairesEncryption20260515170000 implements MigrationInterface {
  name = 'AddInsureSanteBeneficiairesEncryption20260515170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE insure_policy_objects
        ADD COLUMN medical_data_encrypted BYTEA NULL,
        ADD COLUMN medical_data_kms_key_id VARCHAR(100) NULL,
        ADD COLUMN consent_collected_at TIMESTAMPTZ NULL,
        ADD COLUMN retention_policy_years INTEGER NOT NULL DEFAULT 5,
        ADD COLUMN attestation_scolarite_valid_until DATE NULL,
        ADD COLUMN attestation_charge_fiscale_year INTEGER NULL,
        ADD COLUMN handicap_invalidite_certified BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await queryRunner.query(`
      CREATE INDEX idx_policy_objects_retention
        ON insure_policy_objects(tenant_id, retention_policy_years, created_at);
    `);

    await queryRunner.query(`
      CREATE INDEX idx_policy_objects_consent
        ON insure_policy_objects(tenant_id, consent_collected_at)
        WHERE consent_collected_at IS NOT NULL;
    `);

    // Update sante objects to 10 years retention
    await queryRunner.query(`
      UPDATE insure_policy_objects
      SET retention_policy_years = 10
      WHERE object_type = 'employee' OR (object_data->>'branche') = 'sante';
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN insure_policy_objects.medical_data_encrypted IS
      'Donnees medicales chiffrees AES-256-GCM. Loi 09-08 article 4 alinea 3. Sprint 15 Tache 4.2.7.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_policy_objects_retention;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_policy_objects_consent;`);
    await queryRunner.query(`
      ALTER TABLE insure_policy_objects
        DROP COLUMN IF EXISTS medical_data_encrypted,
        DROP COLUMN IF EXISTS medical_data_kms_key_id,
        DROP COLUMN IF EXISTS consent_collected_at,
        DROP COLUMN IF EXISTS retention_policy_years,
        DROP COLUMN IF EXISTS attestation_scolarite_valid_until,
        DROP COLUMN IF EXISTS attestation_charge_fiscale_year,
        DROP COLUMN IF EXISTS handicap_invalidite_certified;
    `);
  }
}
```

### Fichier 2/12 : Constants `sante-endossements.constants.ts`

```typescript
/**
 * Sprint 15 Tache 4.2.7 -- Constants endossements sante.
 */
export const SANTE_ENDOSSEMENTS_CONSTANTS = {
  DEFAULT_MAX_BENEFICIAIRES: 5,
  DEFAULT_AGE_LIMIT_ENFANTS_YEARS: 25,
  DEFAULT_ALLOW_MULTIPLE_SPOUSES: false,
  DEFAULT_DATA_RETENTION_YEARS: 10,
  NOUVEAU_NE_GRATUITE_DAYS: 30,
  MIN_BENEFICIAIRE_AGE_DAYS: 0, // nouveau-ne accepte
  ACTE_NAISSANCE_REGEX: /^[A-Z0-9-]{5,30}$/,
  ATTESTATION_DOC_TYPES: ['scolarite', 'fiscal', 'handicap_comti'] as const,
  RELATIONS: ['spouse', 'child', 'parent'] as const,
  DECIMAL_PRECISION: 2,
} as const;

export type BeneficiaireRelation = typeof SANTE_ENDOSSEMENTS_CONSTANTS.RELATIONS[number];
```

### Fichier 3/12 : Schemas Zod `sante-endossements.schema.ts`

```typescript
import { z } from 'zod';
import { startOfDay, isValid, differenceInYears, differenceInDays } from 'date-fns';
import { SANTE_ENDOSSEMENTS_CONSTANTS } from '../constants/sante-endossements.constants';

const MedicalDataDeclaredSchema = z.object({
  has_chronic_disease: z.boolean(),
  chronic_diseases: z.array(z.string()).optional().default([]),
  current_treatments: z.array(z.string()).optional().default([]),
  is_smoker: z.boolean(),
  cigarettes_per_day: z.number().int().nonnegative().optional(),
  weight_kg: z.number().positive().optional(),
  height_cm: z.number().int().positive().optional(),
  blood_type: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  allergies: z.array(z.string()).optional().default([]),
});

export type MedicalDataDeclared = z.infer<typeof MedicalDataDeclaredSchema>;

const BeneficiaireDataSchema = z.object({
  cin: z.string().optional(), // optional pour < 12 ans
  acte_naissance_numero: z.string().regex(SANTE_ENDOSSEMENTS_CONSTANTS.ACTE_NAISSANCE_REGEX).optional(),
  first_name: z.string().min(2).max(50),
  last_name: z.string().min(2).max(50),
  date_of_birth: z.coerce.date().refine((d) => isValid(d) && d <= new Date(), {
    message: 'date_of_birth must be valid and in past',
  }),
  gender: z.enum(['M', 'F']),
  medical_data_declared: MedicalDataDeclaredSchema,
  consent_collected_at: z.coerce.date(),
  attestation_scolarite_valid_until: z.coerce.date().optional(),
  attestation_charge_fiscale_year: z.number().int().optional(),
  handicap_invalidite_certified: z.boolean().optional().default(false),
});

export const AddBeneficiaireInputSchema = z.object({
  policyId: z.string().uuid(),
  relation: z.enum(SANTE_ENDOSSEMENTS_CONSTANTS.RELATIONS),
  beneficiaireData: BeneficiaireDataSchema,
  effectiveDate: z.coerce.date().optional().default(() => new Date()).refine(
    (d) => d >= startOfDay(new Date()),
    { message: 'effectiveDate must be today or future' },
  ),
  reason: z.string().min(5).max(500),
  notifyCustomer: z.boolean().optional().default(true),
});
export type AddBeneficiaireInput = z.infer<typeof AddBeneficiaireInputSchema>;

export const RemoveBeneficiaireInputSchema = z.object({
  policyId: z.string().uuid(),
  beneficiaireId: z.string(),
  reason: z.string().min(5).max(500),
  effectiveDate: z.coerce.date().optional().default(() => new Date()),
  notifyCustomer: z.boolean().optional().default(true),
});
export type RemoveBeneficiaireInput = z.infer<typeof RemoveBeneficiaireInputSchema>;

export const UpdateBeneficiaireDataInputSchema = z.object({
  policyId: z.string().uuid(),
  beneficiaireId: z.string(),
  newMedicalData: MedicalDataDeclaredSchema,
  reason: z.string().min(5).max(500),
  effectiveDate: z.coerce.date().optional().default(() => new Date()),
  notifyCustomer: z.boolean().optional().default(true),
});
export type UpdateBeneficiaireDataInput = z.infer<typeof UpdateBeneficiaireDataInputSchema>;

export const SanteEndossementResponseSchema = z.object({
  endossement_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  type: z.enum(['beneficiaire_added', 'beneficiaire_removed', 'medical_data_updated']),
  beneficiaire_id_affected: z.string(),
  relation: z.enum(SANTE_ENDOSSEMENTS_CONSTANTS.RELATIONS).optional(),
  old_prime_annuelle: z.string(),
  new_prime_annuelle: z.string(),
  prime_delta: z.string(),
  effective_date: z.string().datetime(),
  signing_workflow_id: z.string().uuid().nullable(),
  status: z.enum(['pending_signature', 'completed']),
  cancelled_premium_ids: z.array(z.string().uuid()),
  new_premium_ids: z.array(z.string().uuid()),
  nouveau_ne_gratuite_until: z.string().datetime().optional(),
});
export type SanteEndossementResponse = z.infer<typeof SanteEndossementResponseSchema>;
```

### Fichier 4/12 : Service `medical-data-encryptor.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';

/**
 * Sprint 15 Tache 4.2.7 -- Encryption AES-256-GCM des donnees medicales.
 *
 * Reference : Loi 09-08 article 4 alinea 3 (donnees sensibles -> protection renforcee).
 *
 * Strategy:
 *  - Master key dans Atlas KMS (decision-008)
 *  - DEK (data encryption key) per-tenant rotation 90 jours (Sprint 27)
 *  - IV unique per row, stockage co-localise dans BYTEA (IV[12] || tag[16] || ciphertext)
 *  - Pour V1: utilise tenant_id + KMS_MASTER_KEY env pour deriver DEK (kdf)
 */
@Injectable()
export class MedicalDataEncryptorService {
  private readonly logger;
  private readonly algo = 'aes-256-gcm' as const;
  private readonly ivLen = 12;
  private readonly tagLen = 16;
  private readonly keyVersion = 'v1';

  constructor(private readonly config: ConfigService, pino: PinoLogger) {
    this.logger = pino.logger.child({ component: 'MedicalDataEncryptor' });
  }

  /**
   * Encrypts plaintext object (will JSON.stringify) and returns binary blob.
   */
  encrypt(tenantId: string, plaintext: Record<string, unknown>): { blob: Buffer; kmsKeyId: string } {
    const dek = this.deriveDekForTenant(tenantId);
    const iv = randomBytes(this.ivLen);
    const cipher = createCipheriv(this.algo, dek, iv);
    const plain = Buffer.from(JSON.stringify(plaintext), 'utf-8');
    const ct1 = cipher.update(plain);
    const ct2 = cipher.final();
    const tag = cipher.getAuthTag();
    const blob = Buffer.concat([iv, tag, ct1, ct2]);
    return { blob, kmsKeyId: `tenant-${tenantId.slice(0, 8)}-${this.keyVersion}` };
  }

  /**
   * Decrypts blob to object.
   */
  decrypt(tenantId: string, blob: Buffer, kmsKeyId: string): Record<string, unknown> {
    const dek = this.deriveDekForTenant(tenantId);
    const iv = blob.subarray(0, this.ivLen);
    const tag = blob.subarray(this.ivLen, this.ivLen + this.tagLen);
    const ct = blob.subarray(this.ivLen + this.tagLen);
    const decipher = createDecipheriv(this.algo, dek, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ct), decipher.final()]);
    return JSON.parse(plain.toString('utf-8'));
  }

  /**
   * Derives DEK from KMS master key + tenant_id.
   * In V1: simple HKDF via Node crypto. Sprint 27: real KMS Atlas integration.
   */
  private deriveDekForTenant(tenantId: string): Buffer {
    const masterKeyB64 = this.config.get<string>('KMS_MASTER_KEY_MEDICAL_DATA');
    if (!masterKeyB64) {
      throw new Error('KMS_MASTER_KEY_MEDICAL_DATA env var required (32 bytes base64)');
    }
    const masterKey = Buffer.from(masterKeyB64, 'base64');
    if (masterKey.length !== 32) {
      throw new Error('KMS_MASTER_KEY_MEDICAL_DATA must be 32 bytes base64');
    }
    const { createHmac } = require('crypto');
    return createHmac('sha256', masterKey).update(`tenant:${tenantId}:${this.keyVersion}`).digest();
  }

  /**
   * Returns masked representation for logs.
   */
  maskForLogs(medical: Record<string, unknown>): Record<string, string> {
    return {
      has_chronic_disease: typeof medical.has_chronic_disease === 'boolean' ? '[BOOL]' : '[REDACTED]',
      treatments_count: Array.isArray(medical.current_treatments)
        ? String(medical.current_treatments.length)
        : '[REDACTED]',
      is_smoker: typeof medical.is_smoker === 'boolean' ? '[BOOL]' : '[REDACTED]',
    };
  }
}
```

### Fichier 5/12 : Service principal `sante-endossements.service.ts`

```typescript
import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import Decimal from 'decimal.js';
import { differenceInDays, differenceInYears, startOfDay, addDays } from 'date-fns';

import { InsurePolicy, InsurePolicyStatus } from '../../entities/insure-policy.entity';
import { InsurePremium, InsurePremiumStatus } from '../../entities/insure-premium.entity';
import { InsurePolicyObject } from '../../entities/insure-policy-object.entity';
import { InsureTransfer, InsureTransferStatus } from '../../entities/insure-transfer.entity';
import { SANTE_ENDOSSEMENTS_CONSTANTS } from '../../constants/sante-endossements.constants';
import {
  AddBeneficiaireInput, AddBeneficiaireInputSchema,
  RemoveBeneficiaireInput, RemoveBeneficiaireInputSchema,
  UpdateBeneficiaireDataInput, UpdateBeneficiaireDataInputSchema,
  SanteEndossementResponse,
} from '../../schemas/sante-endossements.schema';
import { PoliciesService } from '../policies.service';
import { TarificationService } from '../tarification.service';
import { MedicalDataEncryptorService } from '../medical-data-encryptor.service';
import { SigningWorkflowService, SignerRole, SignatureType } from '@insurtech/signature';
import { PdfGenerator, DocumentService, DocumentType } from '@insurtech/docs';
import { TenantConfigService } from '@insurtech/shared-config';
import { AuditLogService, KafkaPublisher, TenantContext } from '@insurtech/shared-utils';
import { CommService, CommChannel } from '@insurtech/comm';
import { Topics } from '@insurtech/shared-types';

/**
 * Sprint 15 Tache 4.2.7 -- SanteEndossementsService.
 *
 * Endossements branche sante : addBeneficiaire, removeBeneficiaire,
 * updateBeneficiaireData.
 *
 * Conformite : Loi 17-99 art. 12, Loi 09-08 art. 4-3 (donnees sensibles),
 * CG sante MA art. 7-3 (gratuite nouveau-ne 30j) + 8-2 (enfants 25 ans).
 */
@Injectable()
export class SanteEndossementsService {
  private readonly logger;
  private readonly tracer = trace.getTracer('insure.sante-endossements.service');

  constructor(
    @InjectRepository(InsurePolicy) private readonly policiesRepo: Repository<InsurePolicy>,
    @InjectRepository(InsurePremium) private readonly premiumsRepo: Repository<InsurePremium>,
    @InjectRepository(InsurePolicyObject) private readonly objectsRepo: Repository<InsurePolicyObject>,
    @InjectRepository(InsureTransfer) private readonly transfersRepo: Repository<InsureTransfer>,
    private readonly policiesService: PoliciesService,
    private readonly tarificationService: TarificationService,
    private readonly medicalEncryptor: MedicalDataEncryptorService,
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
    this.logger = pino.logger.child({ component: 'SanteEndossementsService' });
  }

  // ============ addBeneficiaire ============

  async addBeneficiaire(input: AddBeneficiaireInput): Promise<SanteEndossementResponse> {
    return this.tracer.startActiveSpan('santeEndossements.addBeneficiaire', async (span) => {
      const tenantId = TenantContext.getCurrentTenantId();
      const userId = TenantContext.getCurrentUserId();
      const startTime = Date.now();

      try {
        const validated = AddBeneficiaireInputSchema.parse(input);
        const { policy, healthObject } = await this.validateAddBeneficiaire(validated);

        // Compute beneficiaire age + nouveau-ne
        const ageYears = differenceInYears(new Date(), validated.beneficiaireData.date_of_birth);
        const ageDays = differenceInDays(new Date(), validated.beneficiaireData.date_of_birth);
        const isNouveauNe = ageDays <= SANTE_ENDOSSEMENTS_CONSTANTS.NOUVEAU_NE_GRATUITE_DAYS;
        const gratuiteUntil = isNouveauNe
          ? addDays(validated.beneficiaireData.date_of_birth, SANTE_ENDOSSEMENTS_CONSTANTS.NOUVEAU_NE_GRATUITE_DAYS)
          : null;

        // Validation relation-specific
        await this.validateRelationConstraints(validated, ageYears, healthObject);

        // Encrypt medical data
        const { blob: encryptedMedical, kmsKeyId } = this.medicalEncryptor.encrypt(
          tenantId,
          validated.beneficiaireData.medical_data_declared,
        );

        const newBeneficiaireId = crypto.randomUUID();
        const existingBeneficiaires = ((healthObject.object_data as any).beneficiaires ?? []) as any[];
        const newBeneficiaire = {
          id: newBeneficiaireId,
          relation: validated.relation,
          first_name: validated.beneficiaireData.first_name,
          last_name: validated.beneficiaireData.last_name,
          date_of_birth: validated.beneficiaireData.date_of_birth.toISOString().slice(0, 10),
          cin: validated.beneficiaireData.cin,
          acte_naissance_numero: validated.beneficiaireData.acte_naissance_numero,
          gender: validated.beneficiaireData.gender,
          consent_collected_at: validated.beneficiaireData.consent_collected_at.toISOString(),
          attestation_scolarite_valid_until: validated.beneficiaireData.attestation_scolarite_valid_until?.toISOString().slice(0, 10),
          attestation_charge_fiscale_year: validated.beneficiaireData.attestation_charge_fiscale_year,
          handicap_invalidite_certified: validated.beneficiaireData.handicap_invalidite_certified ?? false,
          medical_data_encrypted_b64: encryptedMedical.toString('base64'),
          medical_data_kms_key_id: kmsKeyId,
          nouveau_ne_gratuite_until: gratuiteUntil?.toISOString().slice(0, 10),
          added_at: new Date().toISOString(),
        };
        const newBeneficiairesList = [...existingBeneficiaires, newBeneficiaire];

        // Recompute prime (excluding nouveau-ne gratuite period)
        const newPrimeResult = await this.tarificationService.computePrime({
          branche: 'sante',
          tenant_id: tenantId,
          assure_principal: (healthObject.object_data as any).assure_principal,
          beneficiaires: newBeneficiairesList.map((b: any) => ({
            ...b,
            is_in_gratuite_period: b.id === newBeneficiaireId && isNouveauNe,
          })),
          start_date: policy.start_date,
          end_date: policy.end_date,
        });

        const oldPrime = new Decimal(policy.prime_annuelle.toString());
        const newPrime = new Decimal(newPrimeResult.prime_annuelle.toString());
        const delta = newPrime.minus(oldPrime);

        this.logger.info(
          {
            tenant_id: tenantId,
            user_id: userId,
            policy_id: policy.id,
            beneficiaire_id: newBeneficiaireId,
            relation: validated.relation,
            age_years: ageYears,
            is_nouveau_ne: isNouveauNe,
            medical_masked: this.medicalEncryptor.maskForLogs(validated.beneficiaireData.medical_data_declared),
            delta: delta.toString(),
            action: 'sante.addBeneficiaire.attempt',
          },
          'Adding beneficiaire to health policy',
        );

        // Apply via transactional helper
        return await this.applyEndossementTransaction({
          type: 'beneficiaire_added',
          policy, healthObject,
          newObjectData: { ...(healthObject.object_data as any), beneficiaires: newBeneficiairesList },
          oldPrime, newPrime, delta,
          effectiveDate: validated.effectiveDate,
          reason: validated.reason,
          beneficiaireIdAffected: newBeneficiaireId,
          relation: validated.relation,
          nouveauNeGratuiteUntil: gratuiteUntil,
          notifyCustomer: validated.notifyCustomer,
        });
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        this.logger.error(
          { err, action: 'sante.addBeneficiaire.error', duration_ms: Date.now() - startTime },
          'addBeneficiaire failed',
        );
        throw err;
      } finally {
        span.end();
      }
    });
  }

  // ============ removeBeneficiaire ============

  async removeBeneficiaire(input: RemoveBeneficiaireInput): Promise<SanteEndossementResponse> {
    const tenantId = TenantContext.getCurrentTenantId();
    const userId = TenantContext.getCurrentUserId();
    const validated = RemoveBeneficiaireInputSchema.parse(input);

    const { policy, healthObject } = await this.validateRemoveBeneficiaire(validated);

    const existingBeneficiaires = ((healthObject.object_data as any).beneficiaires ?? []) as any[];
    const beneficiaireToRemove = existingBeneficiaires.find((b: any) => b.id === validated.beneficiaireId);
    if (!beneficiaireToRemove) {
      throw new NotFoundException({ code: 'BENEFICIAIRE_NOT_FOUND' });
    }
    const newBeneficiairesList = existingBeneficiaires.filter((b: any) => b.id !== validated.beneficiaireId);

    const newPrimeResult = await this.tarificationService.computePrime({
      branche: 'sante',
      tenant_id: tenantId,
      assure_principal: (healthObject.object_data as any).assure_principal,
      beneficiaires: newBeneficiairesList,
      start_date: policy.start_date,
      end_date: policy.end_date,
    });

    const oldPrime = new Decimal(policy.prime_annuelle.toString());
    const newPrime = new Decimal(newPrimeResult.prime_annuelle.toString());
    const delta = newPrime.minus(oldPrime);

    this.logger.info(
      {
        tenant_id: tenantId,
        user_id: userId,
        policy_id: policy.id,
        beneficiaire_id_removed: validated.beneficiaireId,
        relation: beneficiaireToRemove.relation,
        delta: delta.toString(),
        action: 'sante.removeBeneficiaire.attempt',
      },
      'Removing beneficiaire from health policy',
    );

    return await this.applyEndossementTransaction({
      type: 'beneficiaire_removed',
      policy, healthObject,
      newObjectData: { ...(healthObject.object_data as any), beneficiaires: newBeneficiairesList },
      oldPrime, newPrime, delta,
      effectiveDate: validated.effectiveDate,
      reason: validated.reason,
      beneficiaireIdAffected: validated.beneficiaireId,
      relation: beneficiaireToRemove.relation,
      notifyCustomer: validated.notifyCustomer,
    });
  }

  // ============ updateBeneficiaireData ============

  async updateBeneficiaireData(input: UpdateBeneficiaireDataInput): Promise<SanteEndossementResponse> {
    const tenantId = TenantContext.getCurrentTenantId();
    const userId = TenantContext.getCurrentUserId();
    const validated = UpdateBeneficiaireDataInputSchema.parse(input);

    const { policy, healthObject } = await this.validateUpdateBeneficiaireData(validated);

    const existingBeneficiaires = ((healthObject.object_data as any).beneficiaires ?? []) as any[];
    const beneficiaireIdx = existingBeneficiaires.findIndex((b: any) => b.id === validated.beneficiaireId);
    if (beneficiaireIdx === -1) {
      throw new NotFoundException({ code: 'BENEFICIAIRE_NOT_FOUND' });
    }

    // Re-encrypt new medical data
    const { blob: encryptedMedical, kmsKeyId } = this.medicalEncryptor.encrypt(tenantId, validated.newMedicalData);

    const updatedBeneficiaires = [...existingBeneficiaires];
    updatedBeneficiaires[beneficiaireIdx] = {
      ...updatedBeneficiaires[beneficiaireIdx],
      medical_data_encrypted_b64: encryptedMedical.toString('base64'),
      medical_data_kms_key_id: kmsKeyId,
      medical_data_last_updated_at: new Date().toISOString(),
    };

    const newPrimeResult = await this.tarificationService.computePrime({
      branche: 'sante',
      tenant_id: tenantId,
      assure_principal: (healthObject.object_data as any).assure_principal,
      beneficiaires: updatedBeneficiaires,
      start_date: policy.start_date,
      end_date: policy.end_date,
    });

    const oldPrime = new Decimal(policy.prime_annuelle.toString());
    const newPrime = new Decimal(newPrimeResult.prime_annuelle.toString());
    const delta = newPrime.minus(oldPrime);

    return await this.applyEndossementTransaction({
      type: 'medical_data_updated',
      policy, healthObject,
      newObjectData: { ...(healthObject.object_data as any), beneficiaires: updatedBeneficiaires },
      oldPrime, newPrime, delta,
      effectiveDate: validated.effectiveDate,
      reason: validated.reason,
      beneficiaireIdAffected: validated.beneficiaireId,
      notifyCustomer: validated.notifyCustomer,
      medicalUpdateMasked: this.medicalEncryptor.maskForLogs(validated.newMedicalData),
    });
  }

  // ============ Private validators ============

  private async validateAddBeneficiaire(input: AddBeneficiaireInput) {
    const tenantId = TenantContext.getCurrentTenantId();
    const policy = await this.policiesService.findById(input.policyId);
    if (!policy) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
    if (policy.tenant_id !== tenantId) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
    if (policy.status !== InsurePolicyStatus.ACTIVE) throw new BadRequestException({ code: 'POLICY_NOT_ACTIVE' });
    if (policy.branche !== 'sante') throw new BadRequestException({ code: 'NOT_SANTE_POLICY' });

    await this.validateNoPendingOperations(policy);

    const healthObject = await this.objectsRepo.findOne({
      where: { policy_id: policy.id, tenant_id: tenantId, object_type: 'employee' },
    });
    if (!healthObject) throw new NotFoundException({ code: 'NO_HEALTH_OBJECT_FOR_POLICY' });

    const maxBenefs = await this.getMaxBeneficiaires(tenantId);
    const existing = ((healthObject.object_data as any).beneficiaires ?? []) as any[];
    if (existing.length >= maxBenefs) {
      throw new ConflictException({
        code: 'MAX_BENEFICIAIRES_EXCEEDED',
        current_count: existing.length,
        max_allowed: maxBenefs,
      });
    }

    return { policy, healthObject };
  }

  private async validateRemoveBeneficiaire(input: RemoveBeneficiaireInput) {
    const tenantId = TenantContext.getCurrentTenantId();
    const policy = await this.policiesService.findById(input.policyId);
    if (!policy) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
    if (policy.tenant_id !== tenantId) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
    if (policy.status !== InsurePolicyStatus.ACTIVE) throw new BadRequestException({ code: 'POLICY_NOT_ACTIVE' });
    if (policy.branche !== 'sante') throw new BadRequestException({ code: 'NOT_SANTE_POLICY' });

    await this.validateNoPendingOperations(policy);

    const healthObject = await this.objectsRepo.findOne({
      where: { policy_id: policy.id, tenant_id: tenantId, object_type: 'employee' },
    });
    if (!healthObject) throw new NotFoundException({ code: 'NO_HEALTH_OBJECT_FOR_POLICY' });

    return { policy, healthObject };
  }

  private async validateUpdateBeneficiaireData(input: UpdateBeneficiaireDataInput) {
    return this.validateRemoveBeneficiaire(input as any);
  }

  private async validateNoPendingOperations(policy: InsurePolicy) {
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

  private async validateRelationConstraints(
    input: AddBeneficiaireInput,
    ageYears: number,
    healthObject: InsurePolicyObject,
  ) {
    const tenantId = TenantContext.getCurrentTenantId();
    const ageLimit = await this.getAgeLimitEnfants(tenantId);
    const allowMultipleSpouses = await this.getAllowMultipleSpouses(tenantId);

    const existing = ((healthObject.object_data as any).beneficiaires ?? []) as any[];

    if (input.relation === 'spouse') {
      const existingSpouses = existing.filter((b: any) => b.relation === 'spouse');
      if (existingSpouses.length > 0 && !allowMultipleSpouses) {
        throw new ConflictException({ code: 'SPOUSE_ALREADY_PRESENT' });
      }
      if (ageYears < 18) {
        throw new BadRequestException({ code: 'SPOUSE_MUST_BE_ADULT', age: ageYears });
      }
    }

    if (input.relation === 'child') {
      if (ageYears > ageLimit && !input.beneficiaireData.handicap_invalidite_certified) {
        throw new BadRequestException({
          code: 'CHILD_AGE_EXCEEDS_LIMIT',
          age: ageYears,
          age_limit: ageLimit,
          hint: 'Provide handicap_invalidite_certified=true with COMTI attestation for over-age children',
        });
      }
      if (ageYears >= 18 && !input.beneficiaireData.attestation_scolarite_valid_until) {
        throw new BadRequestException({
          code: 'ADULT_CHILD_NEEDS_SCHOLARSHIP_ATTESTATION',
          age: ageYears,
        });
      }
      if (ageYears >= 12 && !input.beneficiaireData.cin) {
        throw new BadRequestException({ code: 'CIN_REQUIRED_FOR_CHILD_OVER_12' });
      }
      if (ageYears < 12 && !input.beneficiaireData.acte_naissance_numero) {
        throw new BadRequestException({ code: 'ACTE_NAISSANCE_REQUIRED_FOR_CHILD_UNDER_12' });
      }
    }

    if (input.relation === 'parent') {
      if (!input.beneficiaireData.attestation_charge_fiscale_year) {
        throw new BadRequestException({
          code: 'PARENT_NEEDS_FISCAL_ATTESTATION',
          message: 'ACAPS 2020-08: parents must have attestation_charge_fiscale_year',
        });
      }
      if (input.beneficiaireData.attestation_charge_fiscale_year < new Date().getFullYear() - 1) {
        throw new BadRequestException({
          code: 'FISCAL_ATTESTATION_OUTDATED',
          year: input.beneficiaireData.attestation_charge_fiscale_year,
        });
      }
      if (ageYears < 50) {
        throw new BadRequestException({
          code: 'PARENT_TOO_YOUNG',
          age: ageYears,
          hint: 'Ascendants typically over 50; verify relation',
        });
      }
      if (!input.beneficiaireData.cin) {
        throw new BadRequestException({ code: 'CIN_REQUIRED_FOR_PARENT' });
      }
    }
  }

  // ============ Apply endossement transaction helper ============

  private async applyEndossementTransaction(params: {
    type: 'beneficiaire_added' | 'beneficiaire_removed' | 'medical_data_updated';
    policy: InsurePolicy;
    healthObject: InsurePolicyObject;
    newObjectData: any;
    oldPrime: Decimal;
    newPrime: Decimal;
    delta: Decimal;
    effectiveDate: Date;
    reason: string;
    beneficiaireIdAffected: string;
    relation?: string;
    nouveauNeGratuiteUntil?: Date | null;
    notifyCustomer: boolean;
    medicalUpdateMasked?: Record<string, string>;
  }): Promise<SanteEndossementResponse> {
    const tenantId = TenantContext.getCurrentTenantId();
    const userId = TenantContext.getCurrentUserId();
    const { policy, healthObject, newObjectData, oldPrime, newPrime, delta, effectiveDate, reason, type } = params;

    const contact = await this.policiesService.getContactForPolicy(policy.id);
    if (!contact) throw new BadRequestException({ code: 'NO_CONTACT_FOR_POLICY' });

    const templateName = `avenant-sante-${type.replace(/_/g, '-')}`;
    const pdfBuffer = await this.pdfGenerator.generate(templateName, contact.preferred_language ?? 'fr', {
      policy, beneficiaireIdAffected: params.beneficiaireIdAffected,
      relation: params.relation,
      oldPrime: oldPrime.toFixed(2), newPrime: newPrime.toFixed(2),
      delta: delta.toFixed(2), effectiveDate, reason, generatedAt: new Date(),
      nouveauNeGratuiteUntil: params.nouveauNeGratuiteUntil,
    });

    const pdfDoc = await this.documentService.create({
      type: DocumentType.AVENANT_SANTE,
      title: `Avenant sante ${type} - Police ${policy.policy_number}`,
      file: pdfBuffer,
      related_resource_type: 'insure_policy',
      related_resource_id: policy.id,
    });

    const signingWorkflow = await this.signingWorkflowService.createWorkflow(
      pdfDoc.id,
      [{
        name: `${contact.first_name} ${contact.last_name}`,
        email: contact.email, phone: contact.phone,
        role: SignerRole.SIGNER, order: 1, cin: contact.cin,
      }],
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

      await em.update(InsurePolicyObject, { id: healthObject.id, tenant_id: tenantId }, {
        object_data: newObjectData,
        retention_policy_years: 10,
        updated_at: new Date(),
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
            created_by_action: `sante_endossement_${type}`,
          });
          const saved = await em.save(newP);
          newPremiumIds.push(saved.id);
        }
      }

      // Audit (with CIN masked)
      await this.auditLog.log({
        tenant_id: tenantId, user_id: userId,
        action: `insure.sante_endossement.${type}`,
        resource_type: 'insure_policy', resource_id: policy.id,
        metadata: {
          beneficiaire_id_affected: params.beneficiaireIdAffected,
          relation: params.relation,
          old_prime: oldPrime.toString(),
          new_prime: newPrime.toString(),
          delta: delta.toString(),
          effective_date: effectiveDate.toISOString(),
          reason,
          signing_workflow_id: signingWorkflow.id,
          cancelled_premium_ids: cancelledIds,
          new_premium_ids: newPremiumIds,
          nouveau_ne_gratuite_until: params.nouveauNeGratuiteUntil?.toISOString().slice(0, 10),
          medical_data_change_masked: params.medicalUpdateMasked, // masked for audit
        },
      });

      const topicMap: Record<typeof type, string> = {
        beneficiaire_added: Topics.INSURE_SANTE_BENEFICIAIRE_ADDED,
        beneficiaire_removed: Topics.INSURE_SANTE_BENEFICIAIRE_REMOVED,
        medical_data_updated: Topics.INSURE_SANTE_MEDICAL_DATA_UPDATED,
      };
      await this.kafkaPublisher.publish(topicMap[type], {
        tenant_id: tenantId, policy_id: policy.id,
        beneficiaire_id_affected: params.beneficiaireIdAffected,
        relation: params.relation,
        old_prime: oldPrime.toFixed(2),
        new_prime: newPrime.toFixed(2),
        delta: delta.toFixed(2),
        effective_date: effectiveDate.toISOString(),
        signing_workflow_id: signingWorkflow.id,
        type,
        changed_by_user_id: userId,
        changed_at: new Date().toISOString(),
      }, { idempotency_key: `sante-${type}-${policy.id}-${params.beneficiaireIdAffected}-${Date.now()}` });

      return {
        endossement_id: signingWorkflow.id,
        policy_id: policy.id,
        type,
        beneficiaire_id_affected: params.beneficiaireIdAffected,
        relation: params.relation,
        old_prime_annuelle: oldPrime.toFixed(2),
        new_prime_annuelle: newPrime.toFixed(2),
        prime_delta: delta.toFixed(2),
        effective_date: effectiveDate.toISOString(),
        signing_workflow_id: signingWorkflow.id,
        status: 'pending_signature' as const,
        cancelled_premium_ids: cancelledIds,
        new_premium_ids: newPremiumIds,
        nouveau_ne_gratuite_until: params.nouveauNeGratuiteUntil?.toISOString(),
      } satisfies SanteEndossementResponse;
    });

    await this.signingWorkflowService.sendForSignature(signingWorkflow.id);
    if (params.notifyCustomer && contact) {
      this.notifyEndossementSante(type, policy, result, contact).catch((err) =>
        this.logger.error({ err, policy_id: policy.id, type }, 'notify sante endossement failed'),
      );
    }
    return result;
  }

  // ============ Helpers config ============

  private async getMaxBeneficiaires(tenantId: string): Promise<number> {
    const v = await this.tenantConfig.get(tenantId, 'health_max_beneficiaires');
    return v ? parseInt(v, 10) : SANTE_ENDOSSEMENTS_CONSTANTS.DEFAULT_MAX_BENEFICIAIRES;
  }

  private async getAgeLimitEnfants(tenantId: string): Promise<number> {
    const v = await this.tenantConfig.get(tenantId, 'health_age_limit_enfants');
    return v ? parseInt(v, 10) : SANTE_ENDOSSEMENTS_CONSTANTS.DEFAULT_AGE_LIMIT_ENFANTS_YEARS;
  }

  private async getAllowMultipleSpouses(tenantId: string): Promise<boolean> {
    const v = await this.tenantConfig.get(tenantId, 'health_allow_multiple_spouses');
    return v === 'true' ? true : SANTE_ENDOSSEMENTS_CONSTANTS.DEFAULT_ALLOW_MULTIPLE_SPOUSES;
  }

  // ============ Notification ============

  private async notifyEndossementSante(
    type: string,
    policy: InsurePolicy,
    result: SanteEndossementResponse,
    contact: any,
  ) {
    const templateName = `sante-${type.replace(/_/g, '-')}`;
    const baseVars = {
      policy_number: policy.policy_number,
      relation: result.relation,
      old_prime: result.old_prime_annuelle,
      new_prime: result.new_prime_annuelle,
      delta: result.prime_delta,
      effective_date: result.effective_date,
      nouveau_ne_gratuite_until: result.nouveau_ne_gratuite_until,
    };
    await Promise.all([
      this.commService.send({
        channel: CommChannel.EMAIL, recipient: contact.email, template: templateName,
        locale: contact.preferred_language ?? 'fr', variables: baseVars,
      }),
      this.commService.send({
        channel: CommChannel.WHATSAPP, recipient: contact.phone, template: templateName,
        locale: contact.preferred_language ?? 'fr', variables: baseVars,
      }),
    ]);
  }
}
```

### Fichier 6/12 : Controller `sante-endossements.controller.ts`

```typescript
import { Controller, Post, Delete, Patch, Param, Body, UseGuards, HttpCode, HttpStatus, UsePipes } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth, ApiHeader } from '@nestjs/swagger';
import {
  SanteEndossementsService,
  AddBeneficiaireInputSchema,
  RemoveBeneficiaireInputSchema,
  UpdateBeneficiaireDataInputSchema,
} from '@insurtech/insure';
import { TenantGuard } from '../../../guards/tenant.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Permissions } from '../../../decorators/permissions.decorator';
import { ZodValidationPipe } from '../../../pipes/zod-validation.pipe';
import { AddBeneficiaireDto } from '../dto/add-beneficiaire.dto';
import { RemoveBeneficiaireDto } from '../dto/remove-beneficiaire.dto';
import { UpdateBeneficiaireDataDto } from '../dto/update-beneficiaire-data.dto';
import { SanteEndossementResponseDto } from '../dto/sante-endossement-response.dto';

@ApiTags('insure-sante-endossements')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', required: true })
@Controller({ path: 'insure', version: '1' })
@UseGuards(TenantGuard, RolesGuard)
export class SanteEndossementsController {
  constructor(private readonly service: SanteEndossementsService) {}

  @Post('policies/:policyId/sante/beneficiaires')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.endossements.sante.add_beneficiaire')
  @ApiOperation({
    summary: 'Endossement sante: ajout beneficiaire (conjoint/enfant/parent)',
    description: 'Loi 17-99 art. 12 + Loi 09-08 art. 4-3 (donnees sensibles chiffrees).',
  })
  @ApiResponse({ status: 200, type: SanteEndossementResponseDto })
  @UsePipes(new ZodValidationPipe(AddBeneficiaireInputSchema))
  async addBeneficiaire(@Param('policyId') policyId: string, @Body() body: AddBeneficiaireDto): Promise<SanteEndossementResponseDto> {
    return await this.service.addBeneficiaire({
      policyId,
      relation: body.relation,
      beneficiaireData: {
        ...body.beneficiaireData,
        date_of_birth: new Date(body.beneficiaireData.date_of_birth),
        consent_collected_at: new Date(body.beneficiaireData.consent_collected_at),
        attestation_scolarite_valid_until: body.beneficiaireData.attestation_scolarite_valid_until
          ? new Date(body.beneficiaireData.attestation_scolarite_valid_until) : undefined,
      },
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(),
      reason: body.reason,
      notifyCustomer: body.notifyCustomer ?? true,
    }) as SanteEndossementResponseDto;
  }

  @Delete('policies/:policyId/sante/beneficiaires/:beneficiaireId')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.endossements.sante.remove_beneficiaire')
  @ApiOperation({ summary: 'Endossement sante: retrait beneficiaire' })
  @ApiResponse({ status: 200, type: SanteEndossementResponseDto })
  async removeBeneficiaire(
    @Param('policyId') policyId: string,
    @Param('beneficiaireId') beneficiaireId: string,
    @Body() body: RemoveBeneficiaireDto,
  ): Promise<SanteEndossementResponseDto> {
    return await this.service.removeBeneficiaire({
      policyId, beneficiaireId,
      reason: body.reason,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(),
      notifyCustomer: body.notifyCustomer ?? true,
    }) as SanteEndossementResponseDto;
  }

  @Patch('policies/:policyId/sante/beneficiaires/:beneficiaireId/medical-data')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.endossements.sante.update_medical_data')
  @ApiOperation({ summary: 'Endossement sante: mise a jour donnees medicales beneficiaire' })
  @ApiResponse({ status: 200, type: SanteEndossementResponseDto })
  @UsePipes(new ZodValidationPipe(UpdateBeneficiaireDataInputSchema))
  async updateMedicalData(
    @Param('policyId') policyId: string,
    @Param('beneficiaireId') beneficiaireId: string,
    @Body() body: UpdateBeneficiaireDataDto,
  ): Promise<SanteEndossementResponseDto> {
    return await this.service.updateBeneficiaireData({
      policyId, beneficiaireId,
      newMedicalData: body.newMedicalData,
      reason: body.reason,
      effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : new Date(),
      notifyCustomer: body.notifyCustomer ?? true,
    }) as SanteEndossementResponseDto;
  }
}
```

### Fichier 7/12 : DTOs

```typescript
// add-beneficiaire.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MedicalDataDto {
  @ApiProperty() has_chronic_disease!: boolean;
  @ApiPropertyOptional({ type: [String] }) chronic_diseases?: string[];
  @ApiPropertyOptional({ type: [String] }) current_treatments?: string[];
  @ApiProperty() is_smoker!: boolean;
  @ApiPropertyOptional() cigarettes_per_day?: number;
  @ApiPropertyOptional() weight_kg?: number;
  @ApiPropertyOptional() height_cm?: number;
  @ApiPropertyOptional({ enum: ['A+','A-','B+','B-','AB+','AB-','O+','O-'] }) blood_type?: string;
  @ApiPropertyOptional({ type: [String] }) allergies?: string[];
}

export class BeneficiaireDataDto {
  @ApiPropertyOptional() cin?: string;
  @ApiPropertyOptional() acte_naissance_numero?: string;
  @ApiProperty() first_name!: string;
  @ApiProperty() last_name!: string;
  @ApiProperty() date_of_birth!: string;
  @ApiProperty({ enum: ['M', 'F'] }) gender!: 'M' | 'F';
  @ApiProperty({ type: MedicalDataDto }) medical_data_declared!: MedicalDataDto;
  @ApiProperty() consent_collected_at!: string;
  @ApiPropertyOptional() attestation_scolarite_valid_until?: string;
  @ApiPropertyOptional() attestation_charge_fiscale_year?: number;
  @ApiPropertyOptional({ default: false }) handicap_invalidite_certified?: boolean;
}

export class AddBeneficiaireDto {
  @ApiProperty({ enum: ['spouse', 'child', 'parent'] }) relation!: 'spouse' | 'child' | 'parent';
  @ApiProperty({ type: BeneficiaireDataDto }) beneficiaireData!: BeneficiaireDataDto;
  @ApiPropertyOptional() effectiveDate?: string;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional({ default: true }) notifyCustomer?: boolean;
}

// remove-beneficiaire.dto.ts
export class RemoveBeneficiaireDto {
  @ApiProperty() reason!: string;
  @ApiPropertyOptional() effectiveDate?: string;
  @ApiPropertyOptional({ default: true }) notifyCustomer?: boolean;
}

// update-beneficiaire-data.dto.ts
export class UpdateBeneficiaireDataDto {
  @ApiProperty({ type: MedicalDataDto }) newMedicalData!: MedicalDataDto;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional() effectiveDate?: string;
  @ApiPropertyOptional({ default: true }) notifyCustomer?: boolean;
}

// sante-endossement-response.dto.ts
export class SanteEndossementResponseDto {
  @ApiProperty() endossement_id!: string;
  @ApiProperty() policy_id!: string;
  @ApiProperty() type!: 'beneficiaire_added' | 'beneficiaire_removed' | 'medical_data_updated';
  @ApiProperty() beneficiaire_id_affected!: string;
  @ApiPropertyOptional() relation?: string;
  @ApiProperty() old_prime_annuelle!: string;
  @ApiProperty() new_prime_annuelle!: string;
  @ApiProperty() prime_delta!: string;
  @ApiProperty() effective_date!: string;
  @ApiPropertyOptional() signing_workflow_id?: string | null;
  @ApiProperty() status!: 'pending_signature' | 'completed';
  @ApiProperty({ type: [String] }) cancelled_premium_ids!: string[];
  @ApiProperty({ type: [String] }) new_premium_ids!: string[];
  @ApiPropertyOptional() nouveau_ne_gratuite_until?: string;
}
```

### Fichier 8/12 : Template Handlebars `fr/avenant-sante-add-beneficiaire.hbs`

```handlebars
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Avenant Sante - Ajout Beneficiaire - Police {{policy.policy_number}}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; margin: 30px; }
    h1 { font-size: 16pt; text-align: center; border-bottom: 2px solid #1a3a5c; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid #888; padding: 6px; text-align: left; }
    th { background: #f0f4f8; }
    .legal { font-size: 9pt; color: #555; margin-top: 20px; }
    .gratuite { background: #e6f7e6; padding: 8px; border-left: 4px solid #4caf50; }
  </style>
</head>
<body>
  <h1>Avenant Sante - Ajout d'un Beneficiaire</h1>
  <p><strong>Police:</strong> {{policy.policy_number}} -- {{policy.branche}}</p>
  <p><strong>Date d'effet:</strong> {{formatDate effectiveDate 'dd/MM/yyyy'}}</p>
  <p><strong>Beneficiaire ajoute:</strong> ID {{beneficiaireIdAffected}}</p>
  <p><strong>Relation au souscripteur:</strong> {{relation}}</p>
  <p><strong>Motif:</strong> {{reason}}</p>

  <h2>Impact tarifaire</h2>
  <table>
    <tr><th>Prime annuelle ancienne</th><td>{{oldPrime}} DH</td></tr>
    <tr><th>Prime annuelle nouvelle</th><td>{{newPrime}} DH</td></tr>
    <tr><th>Variation</th><td>{{delta}} DH/an</td></tr>
  </table>

  {{#if nouveauNeGratuiteUntil}}
  <div class="gratuite">
    <strong>Periode de gratuite nouveau-ne</strong> : ce beneficiaire beneficie d'une couverture gratuite jusqu'au {{formatDate nouveauNeGratuiteUntil 'dd/MM/yyyy'}} (article 7-3 des Conditions Generales sante standard MA).
  </div>
  {{/if}}

  <p class="legal">
    Conformement aux articles 12 et 19 de la loi 17-99 du Code des Assurances marocain et a l'article 4 alinea 3 de la loi 09-08 (donnees a caractere personnel sensibles), les donnees medicales declarees pour ce beneficiaire sont conservees chiffrees (AES-256-GCM) et accessibles uniquement aux personnels habilites du courtier et de l'assureur. La duree de retention est de 10 ans conformement a la loi 38-14 portant obligations comptables.
  </p>

  <div style="margin-top: 40px; border-top: 1px solid #000; width: 60%;">
    <p><strong>Signature electronique simple Barid eSign</strong></p>
    <p>Souscripteur: ____________________________</p>
    <p>Date: {{formatDate generatedAt 'dd/MM/yyyy HH:mm'}}</p>
  </div>
</body>
</html>
```

### Fichier 9/12 : Template Comm `fr/sante-beneficiaire-added.email.hbs`

```handlebars
Bonjour,

Nous confirmons l'ajout d'un beneficiaire sur votre police sante.

Recapitulatif:
- Numero de police: {{policy_number}}
- Relation: {{relation}}
- Date d'effet: {{effective_date}}
- Ancienne prime annuelle: {{old_prime}} DH
- Nouvelle prime annuelle: {{new_prime}} DH
- Variation: {{delta}} DH

{{#if nouveau_ne_gratuite_until}}
Important: ce beneficiaire (nouveau-ne) beneficie d'une periode de gratuite jusqu'au {{nouveau_ne_gratuite_until}} conformement a l'article 7-3 des Conditions Generales sante. Les primes integrant ce beneficiaire ne s'appliqueront qu'apres cette date.
{{/if}}

Un avenant a ete genere et envoye pour signature electronique. Vos donnees medicales declarees sont chiffrees conformement a la loi 09-08 article 4 alinea 3.

Cordialement,
L'equipe Skalean InsurTech
```

### Fichier 10/12 : Permissions + Kafka

```typescript
// permissions.enum.ts
INSURE_ENDOSSEMENTS_SANTE_ADD_BENEFICIAIRE = 'insure.endossements.sante.add_beneficiaire',
INSURE_ENDOSSEMENTS_SANTE_REMOVE_BENEFICIAIRE = 'insure.endossements.sante.remove_beneficiaire',
INSURE_ENDOSSEMENTS_SANTE_UPDATE_MEDICAL_DATA = 'insure.endossements.sante.update_medical_data',

// kafka-topics.ts
INSURE_SANTE_BENEFICIAIRE_ADDED: 'insurtech.events.insure.sante.beneficiaire_added',
INSURE_SANTE_BENEFICIAIRE_REMOVED: 'insurtech.events.insure.sante.beneficiaire_removed',
INSURE_SANTE_MEDICAL_DATA_UPDATED: 'insurtech.events.insure.sante.medical_data_updated',

// events/insure-sante-endossements.events.ts
import { z } from 'zod';

const BaseSanteEventSchema = z.object({
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  beneficiaire_id_affected: z.string(),
  relation: z.enum(['spouse', 'child', 'parent']).optional(),
  old_prime: z.string(),
  new_prime: z.string(),
  delta: z.string(),
  effective_date: z.string().datetime(),
  signing_workflow_id: z.string().uuid(),
  changed_by_user_id: z.string().uuid(),
  changed_at: z.string().datetime(),
});

export const InsureSanteBeneficiaireAddedEventSchema = BaseSanteEventSchema.extend({
  type: z.literal('beneficiaire_added'),
  nouveau_ne_gratuite_until: z.string().datetime().optional(),
});

export const InsureSanteBeneficiaireRemovedEventSchema = BaseSanteEventSchema.extend({
  type: z.literal('beneficiaire_removed'),
});

export const InsureSanteMedicalDataUpdatedEventSchema = BaseSanteEventSchema.extend({
  type: z.literal('medical_data_updated'),
});

export type InsureSanteBeneficiaireAddedEvent = z.infer<typeof InsureSanteBeneficiaireAddedEventSchema>;
export type InsureSanteBeneficiaireRemovedEvent = z.infer<typeof InsureSanteBeneficiaireRemovedEventSchema>;
export type InsureSanteMedicalDataUpdatedEvent = z.infer<typeof InsureSanteMedicalDataUpdatedEventSchema>;
```

### Fichier 11/12 : Module

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsurePolicy } from '../entities/insure-policy.entity';
import { InsurePremium } from '../entities/insure-premium.entity';
import { InsurePolicyObject } from '../entities/insure-policy-object.entity';
import { InsureTransfer } from '../entities/insure-transfer.entity';
import { SanteEndossementsService } from '../services/endossements/sante-endossements.service';
import { MedicalDataEncryptorService } from '../services/medical-data-encryptor.service';
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
  providers: [SanteEndossementsService, MedicalDataEncryptorService],
  exports: [SanteEndossementsService, MedicalDataEncryptorService],
})
export class SanteEndossementsModule {}
```

### Fichier 12/12 : Tests unitaires (extract)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { subYears, subDays } from 'date-fns';

import { SanteEndossementsService } from './sante-endossements.service';
import { InsurePolicy, InsurePolicyStatus } from '../../entities/insure-policy.entity';
import { InsurePolicyObject } from '../../entities/insure-policy-object.entity';
import { InsureTransfer } from '../../entities/insure-transfer.entity';
import { InsurePremium } from '../../entities/insure-premium.entity';
import { PoliciesService } from '../policies.service';
import { TarificationService } from '../tarification.service';
import { MedicalDataEncryptorService } from '../medical-data-encryptor.service';
import { TenantConfigService } from '@insurtech/shared-config';
import { AuditLogService, KafkaPublisher, TenantContext } from '@insurtech/shared-utils';
import { CommService } from '@insurtech/comm';
import { SigningWorkflowService } from '@insurtech/signature';
import { PdfGenerator, DocumentService } from '@insurtech/docs';
import { PinoLogger } from 'nestjs-pino';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('SanteEndossementsService', () => {
  let service: SanteEndossementsService;
  let policiesService: PoliciesService;
  let tarification: TarificationService;
  let objectsRepo: Repository<InsurePolicyObject>;
  let transfersRepo: Repository<InsureTransfer>;
  let medicalEncryptor: MedicalDataEncryptorService;
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
        SanteEndossementsService,
        { provide: getRepositoryToken(InsurePolicy), useValue: {} },
        { provide: getRepositoryToken(InsurePremium), useValue: {} },
        { provide: getRepositoryToken(InsurePolicyObject), useValue: { findOne: vi.fn() } },
        { provide: getRepositoryToken(InsureTransfer), useValue: { findOne: vi.fn().mockResolvedValue(null) } },
        { provide: PoliciesService, useValue: {
          findById: vi.fn(),
          getContactForPolicy: vi.fn().mockResolvedValue({ email: 'a@a.com', phone: '+212600000001', first_name: 'A', last_name: 'B', cin: 'BE1', preferred_language: 'fr' }),
        } },
        { provide: TarificationService, useValue: { computePrime: vi.fn() } },
        { provide: MedicalDataEncryptorService, useValue: {
          encrypt: vi.fn().mockReturnValue({ blob: Buffer.from('e'), kmsKeyId: 'k1' }),
          decrypt: vi.fn(),
          maskForLogs: vi.fn().mockReturnValue({ masked: '[MASKED]' }),
        } },
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
    service = module.get(SanteEndossementsService);
    policiesService = module.get(PoliciesService);
    tarification = module.get(TarificationService);
    objectsRepo = module.get(getRepositoryToken(InsurePolicyObject));
    transfersRepo = module.get(getRepositoryToken(InsureTransfer));
    medicalEncryptor = module.get(MedicalDataEncryptorService);
    kafkaPublisher = module.get(KafkaPublisher);
    auditLog = module.get(AuditLogService);
  });

  afterEach(() => vi.clearAllMocks());

  const makeSantePolicy = (overrides: any = {}): any => ({
    id: POLICY_ID, tenant_id: TENANT, status: InsurePolicyStatus.ACTIVE,
    branche: 'sante', payment_frequency: 'monthly', prime_annuelle: 6000,
    start_date: new Date('2026-01-01'), end_date: new Date('2026-12-31'),
    policy_number: 'POL-SANTE-001', ...overrides,
  });

  const makeHealthObject = (beneficiaires: any[] = []): any => ({
    id: 'h-1', tenant_id: TENANT, policy_id: POLICY_ID, object_type: 'employee',
    object_data: { assure_principal: { cin: 'BE1', first_name: 'P', last_name: 'I' }, beneficiaires },
    retention_policy_years: 10,
  });

  const validMedicalData = {
    has_chronic_disease: false, chronic_diseases: [], current_treatments: [],
    is_smoker: false, weight_kg: 70, height_cm: 175, blood_type: 'O+' as const, allergies: [],
  };

  describe('addBeneficiaire happy paths', () => {
    it('ajout conjoint OK + recompute prime', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 9000 } as any);

      const result = await service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'spouse',
        beneficiaireData: {
          cin: 'BE99999', first_name: 'Fatima', last_name: 'Bennani',
          date_of_birth: subYears(new Date(), 35),
          gender: 'F', medical_data_declared: validMedicalData,
          consent_collected_at: new Date(),
        },
        effectiveDate: new Date(), reason: 'Mariage 2026', notifyCustomer: false,
      });
      expect(result.type).toBe('beneficiaire_added');
      expect(result.relation).toBe('spouse');
      expect(new Decimal(result.prime_delta).gt(0)).toBe(true);
      expect(medicalEncryptor.encrypt).toHaveBeenCalled();
    });

    it('ajout enfant nouveau-ne avec periode gratuite 30j', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 6000 } as any);

      const result = await service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'child',
        beneficiaireData: {
          acte_naissance_numero: 'AN-2026-0042',
          first_name: 'Yassir', last_name: 'Bennani',
          date_of_birth: subDays(new Date(), 5),
          gender: 'M', medical_data_declared: validMedicalData,
          consent_collected_at: new Date(),
        },
        effectiveDate: new Date(), reason: 'Naissance bebe', notifyCustomer: false,
      });
      expect(result.nouveau_ne_gratuite_until).toBeDefined();
    });

    it('ajout ascendant a charge avec attestation fiscale', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 8500 } as any);

      const result = await service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'parent',
        beneficiaireData: {
          cin: 'BE12345', first_name: 'Hassan', last_name: 'Bennani',
          date_of_birth: subYears(new Date(), 65),
          gender: 'M', medical_data_declared: validMedicalData,
          consent_collected_at: new Date(),
          attestation_charge_fiscale_year: new Date().getFullYear(),
        },
        effectiveDate: new Date(), reason: 'Ascendant a charge fiscale', notifyCustomer: false,
      });
      expect(result.relation).toBe('parent');
    });
  });

  describe('addBeneficiaire validation rejects', () => {
    it('rejette non-sante policy', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy({ branche: 'auto' }));
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'spouse',
        beneficiaireData: { first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 30), gender: 'F', medical_data_declared: validMedicalData, consent_collected_at: new Date(), cin: 'BE9' },
        reason: 'test wrong branche', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('rejette > 5 beneficiaires', async () => {
      const fiveBenefs = Array.from({ length: 5 }, (_, i) => ({ id: `b${i}`, relation: 'child', first_name: `C${i}`, last_name: 'X' }));
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject(fiveBenefs));
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'child',
        beneficiaireData: { first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 8), gender: 'M', medical_data_declared: validMedicalData, consent_collected_at: new Date(), acte_naissance_numero: 'AN-1' },
        reason: 'too many', notifyCustomer: false,
      })).rejects.toThrow(ConflictException);
    });

    it('rejette conjoint < 18 ans', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'spouse',
        beneficiaireData: { cin: 'BE5', first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 16), gender: 'F', medical_data_declared: validMedicalData, consent_collected_at: new Date() },
        reason: 'spouse minor', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('rejette conjoint deja present', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject([{ id: 's1', relation: 'spouse' }]));
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'spouse',
        beneficiaireData: { cin: 'BE5', first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 30), gender: 'F', medical_data_declared: validMedicalData, consent_collected_at: new Date() },
        reason: 'second spouse', notifyCustomer: false,
      })).rejects.toThrow(ConflictException);
    });

    it('rejette enfant > 25 ans sans handicap', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'child',
        beneficiaireData: { cin: 'BE5', first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 28), gender: 'M', medical_data_declared: validMedicalData, consent_collected_at: new Date(), attestation_scolarite_valid_until: new Date() },
        reason: 'over age child', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('accepte enfant > 25 ans avec handicap_invalidite_certified', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 7500 } as any);
      const result = await service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'child',
        beneficiaireData: { cin: 'BE5', first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 28), gender: 'M', medical_data_declared: validMedicalData, consent_collected_at: new Date(), handicap_invalidite_certified: true },
        reason: 'handicap', notifyCustomer: false,
      });
      expect(result.type).toBe('beneficiaire_added');
    });

    it('rejette enfant >= 18 ans sans attestation scolarite', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'child',
        beneficiaireData: { cin: 'BE5', first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 20), gender: 'M', medical_data_declared: validMedicalData, consent_collected_at: new Date() },
        reason: 'adult child no scol', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('rejette enfant < 12 ans sans acte de naissance', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'child',
        beneficiaireData: { first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 5), gender: 'M', medical_data_declared: validMedicalData, consent_collected_at: new Date() },
        reason: 'child without acte', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('rejette parent sans attestation fiscale', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'parent',
        beneficiaireData: { cin: 'BE5', first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 65), gender: 'M', medical_data_declared: validMedicalData, consent_collected_at: new Date() },
        reason: 'parent no attest', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('rejette parent attestation fiscale outdated', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'parent',
        beneficiaireData: { cin: 'BE5', first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 65), gender: 'M', medical_data_declared: validMedicalData, consent_collected_at: new Date(), attestation_charge_fiscale_year: new Date().getFullYear() - 5 },
        reason: 'old attest', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('rejette parent trop jeune (< 50 ans)', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'parent',
        beneficiaireData: { cin: 'BE5', first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 30), gender: 'M', medical_data_declared: validMedicalData, consent_collected_at: new Date(), attestation_charge_fiscale_year: new Date().getFullYear() },
        reason: 'parent too young', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeBeneficiaire', () => {
    it('retrait beneficiaire OK + recompute prime baisse', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject([{ id: 'b1', relation: 'child', first_name: 'A', last_name: 'B' }]));
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 5000 } as any);
      const result = await service.removeBeneficiaire({
        policyId: POLICY_ID, beneficiaireId: 'b1', reason: 'enfant emancipe', notifyCustomer: false,
      });
      expect(result.type).toBe('beneficiaire_removed');
      expect(new Decimal(result.prime_delta).lt(0)).toBe(true);
    });

    it('rejette beneficiaire inexistant', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject([]));
      await expect(service.removeBeneficiaire({
        policyId: POLICY_ID, beneficiaireId: 'unknown', reason: 'test', notifyCustomer: false,
      })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBeneficiaireData', () => {
    it('mise a jour donnees medicales chiffrement OK + audit masque', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject([{ id: 'b1', relation: 'spouse', first_name: 'F', last_name: 'B' }]));
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 7500 } as any);
      const result = await service.updateBeneficiaireData({
        policyId: POLICY_ID, beneficiaireId: 'b1',
        newMedicalData: { ...validMedicalData, has_chronic_disease: true, chronic_diseases: ['diabetes_t2'] },
        reason: 'Declaration nouvelle pathologie', notifyCustomer: false,
      });
      expect(result.type).toBe('medical_data_updated');
      expect(medicalEncryptor.encrypt).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(expect.objectContaining({
        metadata: expect.objectContaining({
          medical_data_change_masked: expect.any(Object),
        }),
      }));
    });
  });

  describe('Validation cross-cutting', () => {
    it('rejette policy suspended', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy({ status: InsurePolicyStatus.SUSPENDED }));
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'spouse',
        beneficiaireData: { cin: 'BE5', first_name: 'F', last_name: 'B', date_of_birth: subYears(new Date(), 30), gender: 'F', medical_data_declared: validMedicalData, consent_collected_at: new Date() },
        reason: 'suspended policy', notifyCustomer: false,
      })).rejects.toThrow(BadRequestException);
    });

    it('rejette pending transfer', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(transfersRepo.findOne).mockResolvedValue({ id: 'xfer' } as any);
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      await expect(service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'spouse',
        beneficiaireData: { cin: 'BE5', first_name: 'F', last_name: 'B', date_of_birth: subYears(new Date(), 30), gender: 'F', medical_data_declared: validMedicalData, consent_collected_at: new Date() },
        reason: 'pending transfer', notifyCustomer: false,
      })).rejects.toThrow(ConflictException);
    });
  });

  describe('Audit + Kafka', () => {
    it('Kafka event INSURE_SANTE_BENEFICIAIRE_ADDED published with idempotency', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject());
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 9000 } as any);
      await service.addBeneficiaire({
        policyId: POLICY_ID, relation: 'spouse',
        beneficiaireData: { cin: 'BE9', first_name: 'X', last_name: 'Y', date_of_birth: subYears(new Date(), 30), gender: 'F', medical_data_declared: validMedicalData, consent_collected_at: new Date() },
        reason: 'kafka test', notifyCustomer: false,
      });
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(
        expect.stringContaining('beneficiaire_added'),
        expect.any(Object),
        expect.objectContaining({ idempotency_key: expect.stringMatching(/sante-beneficiaire_added-/) }),
      );
    });

    it('audit log masque les donnees medicales sensibles', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(makeSantePolicy());
      vi.mocked(objectsRepo.findOne).mockResolvedValue(makeHealthObject([{ id: 'b1', relation: 'spouse' }]));
      vi.mocked(tarification.computePrime).mockResolvedValue({ prime_annuelle: 7500 } as any);
      await service.updateBeneficiaireData({
        policyId: POLICY_ID, beneficiaireId: 'b1',
        newMedicalData: { ...validMedicalData, has_chronic_disease: true },
        reason: 'audit masking test', notifyCustomer: false,
      });
      const auditCall = vi.mocked(auditLog.log).mock.calls.find((c) => c[0].action === 'insure.sante_endossement.medical_data_updated');
      expect(auditCall?.[0].metadata).toHaveProperty('medical_data_change_masked');
    });
  });
});
```

---

## 7. Tests complets (resume)

Voir Fichier 12 ci-dessus pour 25 tests unitaires. Tests integration suivent meme pattern Tache 4.2.6 (12 tests integration testant endpoints REST + RLS + permissions + chiffrement).

---

## 8. Variables environnement

```env
SANTE_MAX_BENEFICIAIRES_DEFAULT=5
SANTE_AGE_LIMIT_ENFANTS_DEFAULT=25
SANTE_ALLOW_MULTIPLE_SPOUSES_DEFAULT=false
SANTE_DATA_RETENTION_YEARS=10

# Chiffrement donnees medicales (Atlas KMS V1 mock, real Sprint 27)
KMS_MASTER_KEY_MEDICAL_DATA=<32 bytes base64>

# Sprint 10 requis
BARID_ESIGN_API_URL=https://api.barid-esign.ma/v1
BARID_ESIGN_API_KEY=<secret>

# Sprint 14 requis
TARIFICATION_GRID_VERSION=2026.1
```

---

## 9. Commandes shell

```bash
cd repo

# Generate KMS master key (V1 dev)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

pnpm --filter @insurtech/database migration:generate -- AddInsureSanteBeneficiairesEncryption
pnpm --filter @insurtech/database migration:run

pnpm typecheck
pnpm lint

pnpm --filter @insurtech/insure vitest run src/services/endossements/sante-endossements.service.spec.ts --coverage
pnpm --filter @insurtech/insure vitest run src/services/medical-data-encryptor.service.spec.ts
pnpm --filter @insurtech/api vitest run test/insure/sante-endossements.integration-spec.ts
```

---

## 10. Criteres validation V1-V28

### Criteres P0 (16 minimum)

- **V1 (P0)** : Migration ajoute 7 colonnes + 2 indexes + update retention 10 ans.
- **V2 (P0)** : `addBeneficiaire` recompute prime via TarificationService.
- **V3 (P0)** : `addBeneficiaire` rejette non-sante policy.
- **V4 (P0)** : `addBeneficiaire` rejette > 5 beneficiaires (default).
- **V5 (P0)** : `addBeneficiaire` rejette conjoint < 18 ans.
- **V6 (P0)** : `addBeneficiaire` rejette conjoint deja present (sauf config polygamie).
- **V7 (P0)** : `addBeneficiaire` rejette enfant > 25 ans sans handicap_invalidite_certified.
- **V8 (P0)** : `addBeneficiaire` accepte enfant > 25 ans avec handicap_invalidite_certified.
- **V9 (P0)** : `addBeneficiaire` rejette enfant >= 18 ans sans attestation scolarite.
- **V10 (P0)** : `addBeneficiaire` rejette enfant < 12 ans sans acte_naissance.
- **V11 (P0)** : `addBeneficiaire` rejette parent sans attestation_charge_fiscale.
- **V12 (P0)** : `addBeneficiaire` rejette attestation fiscale > 2 ans.
- **V13 (P0)** : `addBeneficiaire` rejette parent < 50 ans.
- **V14 (P0)** : Periode gratuite nouveau-ne (30 jours) appliquee correctement.
- **V15 (P0)** : Donnees medicales chiffrees AES-256-GCM avec IV+tag+ciphertext.
- **V16 (P0)** : `removeBeneficiaire` recompute prime + audit + Kafka.

### Criteres P1 (8 minimum)

- **V17 (P1)** : `updateBeneficiaireData` chiffre nouvelles donnees + recompute.
- **V18 (P1)** : Audit log masque les donnees medicales sensibles (logs).
- **V19 (P1)** : Kafka events 3 types publies avec idempotency_key.
- **V20 (P1)** : Retention 10 ans appliquee aux objets sante (vs 5 ans standard).
- **V21 (P1)** : Permissions RBAC 3 enforced.
- **V22 (P1)** : Comm tri-langue fire-and-forget.
- **V23 (P1)** : Coverage >= 90% sante-endossements.service.ts.
- **V24 (P1)** : SELECT FOR UPDATE empeche concurrence.

### Criteres P2 (5 minimum)

- **V25 (P2)** : OpenAPI annotations completes.
- **V26 (P2)** : OpenTelemetry spans.
- **V27 (P2)** : MedicalDataEncryptor.maskForLogs ne fuit pas de donnees sensibles.
- **V28 (P2)** : Templates Comm + avenants Handlebars 9+18 fichiers valides syntaxe.
- **V29 (P2)** : Documentation `SANTE-ENDOSSEMENTS.md` complete.

---

## 11. Edge cases + troubleshooting (12 cas)

1. **Conjoint deja present + tenant autorise polygamie**. `health_allow_multiple_spouses=true` -> accepte. Audit notes.
2. **Enfant 18 ans exact + attestation scolarite valide aujourd'hui**. Borne. Accepte si scolarite >= today + 1 jour.
3. **Nouveau-ne ne 30 jours avant effectiveDate**. Borne gratuite. Accepte, gratuite = 0 jour restant.
4. **Beneficiaire avec sinistre en cours retrait**. Sprint 19 ClaimsService verifie cross-cutting. V1 documente.
5. **Donnees medicales avec champs inconnus** (forward compat). Solution : Zod `.passthrough()` partial pour resilience.
6. **CIN existant deja chez autre beneficiaire**. Solution : check unicite dans beneficiaires[].
7. **KMS master key absent au demarrage**. Service erreur explicite au startup.
8. **DEK rotation 90j** (defere Sprint 27). V1 single DEK per tenant.
9. **Suppression secure si droit a l'oubli active**. Sprint 28 CNDP delete -> override retention.
10. **Imprime PDF avenant avec donnees medicales clair (interne courtier)**. Solution : PDF retire donnees brut, indique "donnees medicales declarees confidentiellement, accessibles uniquement assureur".
11. **Mise a jour medicale baisse prime (arret tabac)**. Delta negatif. Comm "votre prime baisse".
12. **Concurrence 2 endossements meme police**. SELECT FOR UPDATE lock.

---

## 12. Conformite Maroc detaillee

- **Loi 17-99 article 12** (declaration risque sante).
- **Loi 09-08 article 4 alinea 3** (donnees sante = sensibles, protection renforcee).
- **Loi 09-08 article 9** (droit a l'oubli).
- **CGNC art. 38-14** (retention 10 ans).
- **ACAPS 2020-08** (justificatifs ascendants).
- **CG sante MA art. 7-3** (gratuite nouveau-ne 30j).
- **CG sante MA art. 8-2** (enfants jusqu'a 25 ans + extension handicap).

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

Multi-tenant strict, Zod + decimal.js, Pino structured (avec masquage donnees sensibles), pnpm, TS strict, Vitest coverage 90%, RBAC, Kafka idempotency, @insurtech/* aliases, no-emoji ABSOLU, Conventional Commits, Atlas Cloud Benguerir, RLS Postgres, audit immutable, chiffrement AES-256-GCM donnees sensibles (decision-008 + Loi 09-08).

---

## 14. Validation pre-commit

```bash
pnpm typecheck
pnpm lint
pnpm --filter @insurtech/insure vitest run src/services/endossements/sante-endossements.service.spec.ts --coverage
pnpm --filter @insurtech/api vitest run test/insure/sante-endossements.integration-spec.ts

grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" \
  packages/insure/src/services/endossements/sante-endossements.service.ts \
  packages/insure/src/services/medical-data-encryptor.service.ts \
  packages/insure/src/schemas/sante-endossements.schema.ts \
  packages/docs/src/templates/{fr,ar-MA,ar}/avenant-sante-*.hbs \
  packages/comm/src/templates/{fr,ar-MA,ar}/sante-*.{whatsapp,email}.hbs \
  && echo FAIL || echo OK

# Verifier pas de leak donnees medicales clair dans logs
grep -rn "chronic_diseases.*:.*\[" packages/insure/src/services/ \
  | grep -v ".spec.ts" \
  && echo "WARN: possible plaintext medical data" || echo OK
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-15): endossements sante (add/remove beneficiaires + medical data update)

Implements 3 endossements branche sante avec chiffrement AES-256-GCM
donnees medicales (loi 09-08 art. 4-3), validations relation strictes
(spouse/child/parent), periode gratuite nouveau-ne 30j (CG sante art. 7-3),
limite age enfants 25 ans + handicap exception (CG art. 8-2), justificatifs
ascendants fiscaux (ACAPS 2020-08), retention 10 ans (CGNC 38-14).

Livrables:
- Migration colonnes encryption + retention 10 ans
- SanteEndossementsService: addBeneficiaire + removeBeneficiaire + updateBeneficiaireData
- MedicalDataEncryptorService AES-256-GCM + KMS Atlas tenant-derived DEK
- Schemas Zod 3 inputs + response
- Constants: MAX_BENEFICIAIRES=5, AGE_LIMIT=25, NOUVEAU_NE_GRATUITE=30j
- Controller REST 3 endpoints
- 4 DTOs Swagger
- Templates Handlebars avenants tri-langue (9 fichiers)
- Templates Comm tri-langue email + WA (18 fichiers)
- 3 Permissions specifiques
- Kafka topics 3 + schemas Zod events
- 25 tests unit + 12 tests integration = 37 tests
- Coverage 91% sante-endossements.service.ts

Task: 4.2.7
Sprint: 15 (Phase 4 / Sprint 2)
Phase: 4 -- Vertical Insure
Reference: B-15 Tache 4.2.7"
```

---

## 16. Workflow next step

Apres commit tache 4.2.7 :
- Passer a `task-4.2.8-endossements-habitation-rc-voyage.md` (3 branches restantes, meme pattern allege).

---

**Fin du prompt task-4.2.7-endossements-sante.md**

Densite atteinte : ~117 ko
Code patterns : 12 fichiers complets (migration, constants, schemas Zod, encryptor service, service principal 450 lignes, controller, 4 DTOs, template HBS representatif, template Comm, permissions/Kafka, module, tests unit 25)
Tests : 25 unit + 12 integration = 37 cas concrets
Criteres validation : V1-V29
Edge cases : 12
