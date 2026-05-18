# Tache 3.3.2 - S3 Multi-Tenant Buckets + KMS Isolation + Object Lock COMPLIANCE

## 1. Header metadata

| Champ | Valeur |
|-------|--------|
| ID Tache | 3.3.2 |
| Sprint | 10 / 35 |
| Phase | 3 - Modules Horizontaux |
| Module | docs (signature electronique + archivage Loi 43-20) |
| Titre | S3 Client Casablanca Atlas Cloud Services + KMS encryption + Multi-Tenant Buckets Isolation (1 bucket par tenant par kind) + Object Lock COMPLIANCE archive bucket + Lifecycle policies |
| Effort estime | 6h |
| Priorite | P0 (CRITICAL legal compliance) |
| Depend de | Tache 3.3.1 (docs module bootstrap), Sprint 1 baseline (`@insurtech/shared-utils/s3`), Tache 1.4.x (tenant context middleware), Tache 2.1.x (Pino logger config) |
| Bloque | Tache 3.3.3 (signature trail Object Lock writer), Tache 3.3.4 (CNDP purge tenant), Tache 3.4.x (export ACAPS quotidien) |
| Owner | Backend Lead + DevOps Lead |
| Reviewer | Tech Lead + DPO (Data Protection Officer) + Legal (Loi 43-20 conformite) |
| Date prevue | Sprint 10, jours 3-4 |
| Decisions architecturales | decision-006 (no-emoji), decision-008 (data residency Maroc obligatoire), decision-012 (bucket-per-tenant vs prefix-based), decision-019 (KMS per-tenant key), decision-021 (Object Lock COMPLIANCE pour archives signatures) |
| Conformite | Loi 09-08 (CNDP) art. 24, Loi 43-20 art. 7, ACAPS Circulaire 2018/01, CNDP Recommandation 5/2020 |
| Region cible | ma-benguerir-1 (Atlas Cloud Services - Benguerir Maroc) |
| Pas de fallback region | Aucun fallback eu-west-1 ni autre region etrangere autorise |
| Stack | @aws-sdk/client-s3 3.700.0, @aws-sdk/s3-request-presigner 3.700.0, @aws-sdk/client-kms 3.700.0, NestJS 10.4.x, Zod 3.23.x, Pino 9.x, Vitest 2.1.x, Testcontainers 10.13.x |
| Tags | s3, kms, multi-tenant, object-lock, compliance, atlas-cloud-services, benguerir, loi-09-08, loi-43-20, acaps |

## 2. But

Cette tache etend la couche `@insurtech/shared-utils/s3` (mise en place au Sprint 1 avec un client MinIO local et un client Atlas Object Storage Benguerir basique mono-bucket) en introduisant un pattern d'isolation multi-tenant strict avec **un bucket physique dedie par tenant et par categorie d'objets** (`docs`, `photos`, `archive`). Chaque bucket beneficie d'un chiffrement at-rest via KMS Atlas Cloud Services avec une cle dediee par tenant (`alias/skalean-insurtech-{env}-{tenant_id}`), garantissant qu'une compromission de cle pour un tenant donne n'impacte aucun autre tenant. Le bucket `archive` est en outre verrouille en mode Object Lock COMPLIANCE avec une retention de 3651 jours (10 ans + 1 jour, conformement a la Loi 43-20 art. 7), rendant les objets immutables y compris pour le compte root du tenant cloud. Les politiques de cycle de vie Glacier optimisent les couts en deplacant automatiquement les archives en `GLACIER_IR` apres 90 jours puis en `DEEP_ARCHIVE` apres 1 an.

Le second objectif est operationnel: simplifier drastiquement les operations CNDP de purge complete d'un tenant. Avec le pattern bucket-per-tenant, l'eradication d'un tenant se reduit a la suppression du bucket entier (`DeleteBucket` apres `DeleteObjects` paginated) plutot qu'a un scan-and-delete sur des millions de cles partageant un meme bucket. Cette simplification reduit la fenetre de purge d'un ordre de magnitude (de plusieurs heures a quelques minutes pour un tenant moyen) et minimise le risque d'oubli d'objets orphelins.

Le troisieme objectif est de fournir une API NestJS testable avec Vitest, supportant des tests d'integration via Testcontainers MinIO en local et CI, tout en restant 100% compatible avec l'API S3 d'Atlas Cloud Services Benguerir en production. Toute la couche est typee strictement, valide a l'execution via Zod pour les variables d'environnement, et logue via Pino (jamais `console.log`). Aucun emoji ne doit apparaitre dans le code, les commentaires, les logs, ni les messages d'erreur (decision-006).

## 3. Contexte etendu

### 3.1 Pourquoi bucket-per-tenant plutot que prefix-based

L'industrie SaaS multi-tenant offre traditionnellement trois patterns d'isolation au niveau du stockage objet:

1. **Prefix-based** (un seul bucket partage, cles prefixees par `tenant_id/`): simple a deployer, faible cout, mais isolation logique uniquement, IAM policies complexes (`Condition: { StringLike: { "s3:prefix": "${aws:PrincipalTag/tenant_id}/*" } }`), purge tenant lente (scan complet), risque eleve de fuite cross-tenant en cas de bug applicatif.
2. **Bucket-per-tenant**: isolation physique, IAM policies triviales (`Resource: "arn:aws:s3:::skalean-insurtech-prod-{tenant}-*"`), purge tenant en O(1) au niveau bucket, KMS key dediee par tenant, mais cout de gestion accru (limite par defaut 100 buckets/compte AWS, contournable a 1000 sur demande, et Atlas Cloud Services applique 10000 buckets/compte).
3. **Compte AWS-per-tenant** (ou "namespace S3"): isolation maximale, mais explosion operationnelle (gestion de N comptes facturation, IAM, monitoring), inadapte a notre echelle cible (50-500 tenants).
4. **Database-only metadata** + S3 partage: ne resout pas l'isolation physique des binaires, juste deplace le probleme.

Comparatif chiffre:

| Critere | Prefix-based | Bucket-per-tenant | Compte-per-tenant | DB-only + S3 partage |
|---------|--------------|-------------------|-------------------|----------------------|
| Isolation IAM | Faible (Condition prefix) | Forte (Resource ARN) | Maximale | Aucune |
| Isolation chiffrement | Une cle KMS pour tous | Une cle KMS par tenant | Compte separe | N/A |
| Cout S3 stockage | Identique | Identique | Identique | Identique |
| Cout API requests | Identique | Identique | Identique | Identique |
| Cout KMS | ~1 USD/mois total | ~1 USD/mois/tenant (50 tenants = 50 USD) | ~50 USD/mois | ~1 USD/mois |
| Limite tenants | Illimite | 10000 (Atlas), 1000 (AWS quota relevable) | <=100 (gestion humaine) | Illimite |
| Purge tenant CNDP | O(N keys), heures | O(1) bucket delete, minutes | O(1) compte fermeture | O(N keys), heures |
| Risque fuite bug | Eleve | Faible | Nul | Tres eleve |
| Audit ACAPS | Complexe | Simple (un bucket = un tenant) | Simple | Tres complexe |
| Complexite IaC | Faible | Moyenne (loop terraform) | Elevee | Faible |
| Backup/replication | Granulaire difficile | Granulaire native | Granulaire native | Granulaire difficile |

Notre choix bucket-per-tenant resulte d'un arbitrage favorisant **conformite reglementaire** (CNDP recommandation 5/2020 imposant la separation cryptographique entre responsables de traitement) et **simplicite operationnelle des purges** (Loi 09-08 art. 7 droit a l'oubli, delai legal 30 jours) au detriment d'un cout KMS marginal (50 USD/mois additionnels a 50 tenants).

### 3.2 Trade-offs detailles

**Avantages bucket-per-tenant:**
- Isolation physique verifiable lors d'audits ACAPS (un auditeur peut constater visuellement la separation).
- Suppression complete d'un tenant garantit l'absence d'objets residuels (impossible avec prefix-based ou la pagination peut omettre des cles).
- Bucket-level lifecycle policies permettent des politiques distinctes par tenant si necessaire (ex: tenant entreprise demande retention 15 ans, tenant standard 10 ans).
- Bucket-level versioning, replication, logging, encryption configurables independamment.
- KMS key compromise contained: la rotation forcee d'une cle ne disrupt pas les autres tenants.

**Inconvenients bucket-per-tenant:**
- Cost overhead KMS: chaque cle KMS Atlas Cloud Services coute ~1 USD/mois + 0.03 USD per 10000 requests. A 50 tenants et 1M requests/mois, surcout KMS ~150 USD/mois (acceptable vs revenu SaaS).
- Provisioning latency: creation bucket + KMS key + Object Lock activation prend ~30-60 secondes lors de l'onboarding tenant. Mitige par async job hors flux critique signup.
- Quota S3 par compte: AWS limite 100 buckets/compte par defaut (relevable a 1000); Atlas Cloud Services Benguerir confirme 10000 buckets/compte (verifie 2026-04-15 ticket support ACS-19842).
- Discovery complexity: un service utilitaire `getBucketName(tenantId, kind)` doit etre la SEULE source de verite (jamais de string concat ad-hoc dans le code metier).

### 3.3 Decisions architecturales referencees

- **decision-008 (data residency MA)**: tous les binaires confidentiels (PII assures, contrats signes, photos sinistres) doivent etre heberges physiquement au Maroc. Atlas Cloud Services Benguerir est notre fournisseur agree (Datacenter Tier-3 certifie ANRT). Aucune replication cross-region etrangere. Tout fallback `eu-west-1` est interdit, meme transitoirement.
- **decision-006 (no-emoji)**: aucune emoji dans le code, les logs, les commentaires, les messages d'erreur, les metadata S3, les noms de bucket. Validation pre-commit via grep `[^\x00-\x7F]` exclut tout caractere non-ASCII (sauf les fichiers .md de documentation autorises a contenir des accents francais).
- **decision-012 (bucket-per-tenant)**: choix architectural enregistre apres revue par DPO et Legal. Documente dans `00-pilotage/decisions/decision-012-bucket-per-tenant.md`.
- **decision-019 (KMS per-tenant key)**: alias `alias/skalean-insurtech-{env}-{tenant_id}`. Rotation automatique annuelle activee. Politique IAM restrictive (KMS key resource policy limite a IAM role applicatif + DPO break-glass).
- **decision-021 (Object Lock COMPLIANCE archive)**: mode COMPLIANCE choisi (vs GOVERNANCE) car GOVERNANCE permet aux IAM users avec permission `s3:BypassGovernanceRetention` de supprimer les objets, ce qui n'est pas conforme a la Loi 43-20 art. 7 qui exige une immutabilite absolue pendant la duree de retention legale.

### 3.4 Pieges techniques (10+)

1. **Bucket naming RFC 1123 + lowercase only**: `tenant_id` doit etre normalise (lowercase, suppression underscores remplaces par hyphens, max 63 chars total bucket name). Si `tenant_id` contient `_`, le bucket est rejete par S3 avec `InvalidBucketName`. Solution: regex de validation tenant-id en upstream + slug normalization.
2. **MinIO vs S3 differences**: MinIO supporte Object Lock depuis RELEASE.2021-03-26, mais la commande `PutObjectLockConfiguration` doit imperativement etre appelee a la creation du bucket avec le parametre `x-amz-bucket-object-lock-enabled: true`. Activer Object Lock apres coup est impossible. Erreur frequente: oublier ce flag en dev MinIO et constater le bug en prod uniquement.
3. **KMS key creation race**: lors d'un onboarding tenant, la creation de l'alias KMS et la creation du bucket sont deux appels distincts. Si le bucket est cree avant que l'alias KMS soit propage (eventual consistency 1-5 secondes), `PutBucketEncryption` echoue avec `KMSInvalidStateException`. Solution: retry exponential backoff + verification `DescribeKey` avant `PutBucketEncryption`.
4. **Presigned URL TTL > 7 jours rejete**: AWS SigV4 plafonne le TTL a 604800 secondes (7 jours). En production, on plafonne arbitrairement a 3600s (1h) pour limiter le risque de fuite d'URL.
5. **Object Lock retention violation**: tenter `DeleteObject` ou `DeleteObjectVersion` sur un objet en mode COMPLIANCE pendant la retention echoue avec `AccessDenied` meme avec credentials root. Important: aucun moyen de bypass, y compris via support Atlas Cloud Services (engagement contractuel signe).
6. **Lifecycle rule conflict**: si une lifecycle rule transition `STANDARD -> GLACIER_IR` est appliquee a un bucket Object Lock COMPLIANCE, les transitions sont autorisees mais les `Expiration` rules sont silencieusement ignorees pour les objets sous retention. Verifier en review.
7. **MinIO compat differences (presigned URLs)**: MinIO genere des URLs presignees au format virtual-hosted-style par defaut, mais Atlas Cloud Services exige path-style pour les buckets multi-tenant. Forcer `forcePathStyle: true` dans le client S3.
8. **Bucket already exists collision**: deux tenants ayant des `tenant_id` similaires (apres slug normalization) peuvent generer le meme nom de bucket. Solution: contrainte unicite tenant_id en DB + verification preflight `HeadBucket` avant `CreateBucket`.
9. **S3 eventual consistency listing**: apres `PutObject`, un `ListObjectsV2` peut ne pas retourner immediatement le nouvel objet (Atlas Cloud Services strong consistency depuis 2024, mais MinIO eventual). Tests integration doivent waiter ou utiliser `HeadObject` direct.
10. **KMS rotation impact on old objects**: KMS rotation cree une nouvelle version de cle mais les anciens objets restent dechiffrables avec l'ancienne version (KMS gere automatiquement). Ne pas supprimer manuellement les anciennes versions de cle.
11. **CORS preflight pour presigned URLs frontend**: si le frontend upload via PUT presigned, le bucket doit avoir une CORS policy autorisant l'origine front (ex: `https://app.skalean.ma`). Oubli frequent en dev local (origin `http://localhost:3000`).
12. **Multi-region disaster recovery**: Atlas Cloud Services Benguerir n'a pas de region secondaire MA disponible en 2026. La replication cross-region est interdite par decision-008. Solution: backup quotidien chiffre vers un second bucket dans la meme region (`skalean-insurtech-{env}-{tenant_id}-{kind}-backup`) avec lifecycle Glacier 90j + retention 7 ans.
13. **Bucket deletion during purge**: `DeleteBucket` echoue si le bucket contient des objets ou des versions. Pour un bucket Object Lock COMPLIANCE, attendre l'expiration de la retention OU procedure legale exceptionnelle (approbation DPO + Legal + ANRT). Les buckets `docs` et `photos` (sans Object Lock) supportent purge directe via boucle paginated `ListObjectVersions` + `DeleteObjects` batch 1000.
14. **Metadata S3 character set**: les metadata user-defined (prefix `x-amz-meta-`) doivent etre ASCII uniquement. Encoder tout caractere accentue en URL-encoded ou base64. Ne jamais mettre des donnees sensibles en metadata (visible dans les logs ACS).

## 4. Architecture context

### 4.1 Diagramme bucket layout par tenant

```
                   Tenant CNIA (tenant_id=cnia)
                              |
              +---------------+----------------+
              |               |                |
              v               v                v
   +------------------+  +------------------+  +------------------+
   | skalean-insur-   |  | skalean-insur-   |  | skalean-insur-   |
   | tech-prod-cnia-  |  | tech-prod-cnia-  |  | tech-prod-cnia-  |
   | docs             |  | photos           |  | archive          |
   +------------------+  +------------------+  +------------------+
   | KMS: alias/      |  | KMS: alias/      |  | KMS: alias/      |
   | skalean-insur-   |  | skalean-insur-   |  | skalean-insur-   |
   | tech-prod-cnia   |  | tech-prod-cnia   |  | tech-prod-cnia   |
   | (cle commune au  |  | (meme cle)       |  | (meme cle)       |
   | tenant)          |  |                  |  |                  |
   +------------------+  +------------------+  +------------------+
   | Versioning: ON   |  | Versioning: ON   |  | Versioning: ON   |
   | Object Lock: OFF |  | Object Lock: OFF |  | Object Lock:     |
   |                  |  |                  |  |   COMPLIANCE     |
   |                  |  |                  |  |   3651 jours     |
   +------------------+  +------------------+  +------------------+
   | Lifecycle:       |  | Lifecycle:       |  | Lifecycle:       |
   | STD -> IA 30j    |  | STD -> IA 60j    |  | STD -> GLACIER_  |
   | -> Glacier 365j  |  | -> Glacier 180j  |  | IR 90j           |
   | -> Expire 7 ans  |  | -> Expire 5 ans  |  | -> DEEP_ARCHIVE  |
   |                  |  |                  |  |   365j           |
   |                  |  |                  |  | -> NO Expire     |
   |                  |  |                  |  | (immutable)      |
   +------------------+  +------------------+  +------------------+

                              ^
                              |
              +---------------+----------------+
              |    S3MultiTenantService        |
              |  (resolveBucketName + ops)     |
              +---------------+----------------+
                              |
              +---------------+----------------+
              |  TenantContextMiddleware       |
              |  (extrait tenant_id du JWT)    |
              +--------------------------------+
                              |
              +---------------+----------------+
              |  Frontend / API consumers      |
              +--------------------------------+
```

### 4.2 Flux upload document

```
1. Client envoie POST /api/v1/docs avec multipart file + JWT
2. AuthGuard valide JWT -> extrait tenant_id
3. TenantContextMiddleware injecte TenantContext (REQUEST scope)
4. DocsController.upload() recoit MulterFile + TenantContext
5. S3MultiTenantService.uploadDocument(tenantId, key, body, mimeType)
   5a. Resolve bucket: skalean-insurtech-prod-cnia-docs
   5b. Resolve KMS alias: alias/skalean-insurtech-prod-cnia
   5c. PutObjectCommand avec SSE-KMS, ContentType, Metadata tenant-id
   5d. Retry x3 backoff exponential si throttling
   5e. Log structure Pino { level: info, tenantId, bucket, key, sizeBytes, kmsKeyId }
6. Retour { documentId, url: presignedGetUrl(TTL=3600s) }
```

### 4.3 Flux purge tenant CNDP

```
1. Admin DPO declenche DELETE /api/v1/tenants/:id/purge avec MFA + raison + ticket CNDP
2. TenantPurgeService.purge(tenantId, reason)
   2a. Audit log immutable (Object Lock GOVERNANCE 5 ans) raison + ticket
   2b. Pour bucket in [docs, photos]:
       - ListObjectVersions paginated
       - DeleteObjects batch 1000
       - DeleteBucket
   2c. Pour bucket archive:
       - Verification Object Lock retention expired pour tous objets
       - Si retention en cours: refus avec erreur RetentionStillActive
       - Sinon: meme procedure que docs/photos
   2d. ScheduleDeletion KMS key (delai obligatoire 7-30 jours)
3. Notification DPO + Legal par email signed
```

### 4.4 Frontiere de responsabilite

| Composant | Responsabilite | NON-responsabilite |
|-----------|----------------|---------------------|
| `S3MultiTenantService` | Upload, download, presigned URLs, copy, delete (sauf archive) | Resolution KMS key (delegue) |
| `KmsKeyManagerService` | Creation, alias, rotation, scheduling deletion KMS keys | Stockage objects |
| `BucketLifecycleService` | Application des regles lifecycle | Validation business des durees |
| `ObjectLockComplianceService` | Activation Object Lock + retention par objet archive | Decryption / serving |
| `TenantOnboardingService` | Orchestration creation des 3 buckets + cle KMS | Logique metier docs |
| `S3ConfigSchema` | Validation runtime des env vars | Provisioning |

## 5. Livrables checkables

1. Fichier `repo/packages/docs/src/services/s3-multitenant.service.ts` cree avec classe `S3MultiTenantService` exportee.
2. Methode `getBucketName(tenantId, kind)` deterministe et pure (pas d'I/O).
3. Methode `uploadDocument(tenantId, key, body, mimeType, metadata?)` testee.
4. Methode `getPresignedUrl(tenantId, key, expiresInSec=3600)` avec validation TTL <=3600 en prod.
5. Methode `getPresignedPutUrl(tenantId, key, mimeType, expiresInSec=900)` pour upload front direct.
6. Methode `copyObject(tenantId, sourceKey, destKey)` cross-bucket meme tenant uniquement.
7. Methode `deleteObject(tenantId, key, kind)` rejete pour `kind=archive` sauf flag explicite.
8. Methode `headObject(tenantId, key)` pour metadata sans download.
9. Methode `ensureBucket(tenantId, kind, options)` idempotente avec verification HeadBucket.
10. Fichier `repo/packages/docs/src/services/bucket-lifecycle.service.ts` avec methode `applyLifecycle(bucket, kind)`.
11. Fichier `repo/packages/docs/src/services/kms-key-manager.service.ts` avec methodes `createKeyForTenant`, `getKeyAlias`, `scheduleDeletion`.
12. Fichier `repo/packages/docs/src/services/object-lock-compliance.service.ts` avec methode `enableComplianceMode` et `putRetentionOnObject`.
13. Fichier `repo/packages/docs/src/types/bucket-kind.enum.ts` avec enum `BucketKind`.
14. Fichier `repo/packages/docs/src/errors/s3-errors.ts` avec 8 classes d'erreur typees.
15. Fichier `repo/packages/docs/src/config/s3-config.ts` avec Zod schema validation.
16. Mise a jour `repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts` invoquant `ensureBucket` x3.
17. Script `repo/infrastructure/scripts/setup-minio-dev.sh` bootstrap MinIO local.
18. Module Terraform `repo/infrastructure/terraform/s3-buckets.tf` provisionnant Atlas Cloud Services.
19. 30+ tests unitaires Vitest + integration MinIO testcontainers.
20. Documentation env vars dans `repo/.env.example`.
21. Documentation README mise a jour `repo/packages/docs/README.md` section S3.
22. Pino logger configure (jamais `console.log`).
23. Aucun emoji dans le code (validation grep pre-commit).
24. TypeScript strict mode passing (no `any`, no `@ts-ignore`).
25. Coverage Vitest >= 90% sur les fichiers crees.
26. Validation pre-commit `pnpm typecheck && pnpm lint && pnpm test:unit` passe.
27. Tests d'integration Testcontainers MinIO passent en local et CI.
28. Audit CNDP-friendly: chaque operation S3 logge `tenantId`, `bucket`, `key`, `actorId`, `correlationId`.
29. Documentation conformite Loi 09-08 / 43-20 / ACAPS / CNDP en section 13.
30. 30+ criteres validation V1-V30+ executables.

## 6. Fichiers crees / modifies

### Crees

| Fichier | Lignes approx | Role |
|---------|---------------|------|
| `repo/packages/docs/src/services/s3-multitenant.service.ts` | 350 | Service principal multi-tenant S3 |
| `repo/packages/docs/src/services/s3-multitenant.service.spec.ts` | 280 | Tests unitaires + mocks |
| `repo/packages/docs/src/services/bucket-lifecycle.service.ts` | 180 | Application regles Glacier |
| `repo/packages/docs/src/services/bucket-lifecycle.service.spec.ts` | 120 | Tests lifecycle |
| `repo/packages/docs/src/services/kms-key-manager.service.ts` | 150 | Gestion cles KMS per-tenant |
| `repo/packages/docs/src/services/kms-key-manager.service.spec.ts` | 110 | Tests KMS |
| `repo/packages/docs/src/services/object-lock-compliance.service.ts` | 120 | Object Lock COMPLIANCE archive |
| `repo/packages/docs/src/services/object-lock-compliance.service.spec.ts` | 90 | Tests Object Lock |
| `repo/packages/docs/src/services/s3-integration.spec.ts` | 200 | Tests integration MinIO testcontainers |
| `repo/packages/docs/src/types/bucket-kind.enum.ts` | 20 | Enum BucketKind |
| `repo/packages/docs/src/errors/s3-errors.ts` | 80 | Classes erreurs typees |
| `repo/packages/docs/src/config/s3-config.ts` | 100 | Zod env validation |
| `repo/infrastructure/scripts/setup-minio-dev.sh` | 80 | Bootstrap MinIO dev |
| `repo/infrastructure/terraform/s3-buckets.tf` | 150 | Terraform Atlas Cloud Services |

### Modifies

| Fichier | Modification |
|---------|--------------|
| `repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts` | Ajout invocation `ensureBucket` x3 + creation cle KMS |
| `repo/packages/docs/src/docs.module.ts` | Provider registration des 4 services |
| `repo/packages/docs/package.json` | Ajout deps @aws-sdk/client-s3 3.700.0, @aws-sdk/s3-request-presigner 3.700.0, @aws-sdk/client-kms 3.700.0, testcontainers 10.13.x |
| `repo/.env.example` | Ajout vars S3_*, KMS_*, ARCHIVE_* |
| `repo/packages/docs/README.md` | Section S3 multi-tenant + exemples |

## 7. CODE COMPLET

### 7.1 `repo/packages/docs/src/types/bucket-kind.enum.ts`

```typescript
/**
 * Categories de buckets S3 par tenant.
 * Chaque tenant possede 3 buckets: docs, photos, archive.
 *
 * - docs: documents administratifs (contrats, attestations, justificatifs).
 *   Versioning ON, lifecycle STD -> IA 30j -> Glacier 365j -> Expire 7 ans.
 * - photos: photos sinistres et expertises.
 *   Versioning ON, lifecycle STD -> IA 60j -> Glacier 180j -> Expire 5 ans.
 * - archive: archives legales signatures Loi 43-20.
 *   Object Lock COMPLIANCE 3651 jours, lifecycle STD -> GLACIER_IR 90j -> DEEP_ARCHIVE 365j, jamais expirees.
 */
export enum BucketKind {
  DOCS = 'docs',
  PHOTOS = 'photos',
  ARCHIVE = 'archive',
}

export const BUCKET_KINDS_ALL: readonly BucketKind[] = Object.freeze([
  BucketKind.DOCS,
  BucketKind.PHOTOS,
  BucketKind.ARCHIVE,
]);

export function isBucketKind(value: string): value is BucketKind {
  return (BUCKET_KINDS_ALL as readonly string[]).includes(value);
}
```

### 7.2 `repo/packages/docs/src/errors/s3-errors.ts`

```typescript
/**
 * Hierarchie d'erreurs typees pour le module S3 multi-tenant.
 * Toutes les erreurs heritent de S3MultiTenantError pour faciliter le catch global.
 * Aucune emoji (decision-006). Messages en francais (langue projet).
 */

export class S3MultiTenantError extends Error {
  public readonly code: string;
  public readonly tenantId?: string;
  public readonly bucket?: string;
  public readonly key?: string;

  constructor(
    message: string,
    code: string,
    context?: { tenantId?: string; bucket?: string; key?: string },
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.tenantId = context?.tenantId;
    this.bucket = context?.bucket;
    this.key = context?.key;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class InvalidTenantIdError extends S3MultiTenantError {
  constructor(tenantId: string) {
    super(
      `Identifiant tenant invalide: "${tenantId}". Doit matcher /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.`,
      'INVALID_TENANT_ID',
      { tenantId },
    );
  }
}

export class BucketNotFoundError extends S3MultiTenantError {
  constructor(bucket: string, tenantId?: string) {
    super(
      `Bucket S3 introuvable: "${bucket}". Verifier que l'onboarding tenant a bien provisionne le bucket.`,
      'BUCKET_NOT_FOUND',
      { tenantId, bucket },
    );
  }
}

export class BucketAlreadyExistsError extends S3MultiTenantError {
  constructor(bucket: string, tenantId: string) {
    super(
      `Bucket S3 deja existant: "${bucket}". Collision potentielle de tenantId.`,
      'BUCKET_ALREADY_EXISTS',
      { tenantId, bucket },
    );
  }
}

export class ObjectNotFoundError extends S3MultiTenantError {
  constructor(bucket: string, key: string, tenantId: string) {
    super(
      `Objet S3 introuvable: "${key}" dans bucket "${bucket}".`,
      'OBJECT_NOT_FOUND',
      { tenantId, bucket, key },
    );
  }
}

export class PresignedUrlTtlExceededError extends S3MultiTenantError {
  constructor(requestedTtl: number, maxTtl: number) {
    super(
      `TTL URL presignee depasse le maximum autorise: demande ${requestedTtl}s, max ${maxTtl}s.`,
      'PRESIGNED_URL_TTL_EXCEEDED',
    );
  }
}

export class ArchiveBucketDeletionForbiddenError extends S3MultiTenantError {
  constructor(bucket: string, key: string, tenantId: string) {
    super(
      `Suppression interdite sur bucket archive Object Lock COMPLIANCE: "${key}" dans "${bucket}". Loi 43-20 art. 7.`,
      'ARCHIVE_DELETION_FORBIDDEN',
      { tenantId, bucket, key },
    );
  }
}

export class KmsKeyNotReadyError extends S3MultiTenantError {
  constructor(alias: string, tenantId: string) {
    super(
      `Cle KMS non prete: alias "${alias}". Etat propagation eventual consistency.`,
      'KMS_KEY_NOT_READY',
      { tenantId },
    );
  }
}

export class S3OperationFailedError extends S3MultiTenantError {
  public readonly cause: unknown;
  constructor(operation: string, cause: unknown, context?: { tenantId?: string; bucket?: string; key?: string }) {
    super(
      `Echec operation S3 "${operation}": ${cause instanceof Error ? cause.message : String(cause)}`,
      'S3_OPERATION_FAILED',
      context,
    );
    this.cause = cause;
  }
}
```

### 7.3 `repo/packages/docs/src/config/s3-config.ts`

```typescript
import { z } from 'zod';

/**
 * Schema Zod pour valider les variables d'environnement S3 / KMS.
 * Validation stricte au boot pour fail-fast en cas de mauvaise config.
 *
 * Region cible: ma-benguerir-1 (Atlas Cloud Services Benguerir Maroc).
 * decision-008: aucun fallback region etrangere.
 */
export const S3ConfigSchema = z.object({
  S3_ENDPOINT: z
    .string()
    .url({ message: 'S3_ENDPOINT doit etre une URL valide (ex: https://s3.benguerir.atlascs.ma ou http://localhost:9000)' }),
  S3_REGION: z
    .string()
    .regex(/^ma-benguerir-1$/, {
      message: 'S3_REGION doit etre exactement "ma-benguerir-1" (decision-008 data residency Maroc).',
    }),
  S3_ACCESS_KEY_ID: z.string().min(8, 'S3_ACCESS_KEY_ID requis (>= 8 chars)'),
  S3_SECRET_ACCESS_KEY: z.string().min(16, 'S3_SECRET_ACCESS_KEY requis (>= 16 chars)'),
  S3_FORCE_PATH_STYLE: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),
  S3_BUCKET_PREFIX: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,40}$/, {
      message: 'S3_BUCKET_PREFIX doit matcher /^[a-z][a-z0-9-]{1,40}$/.',
    })
    .default('skalean-insurtech'),
  KMS_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),
  KMS_ENDPOINT: z.string().url().optional(),
  KMS_KEY_ALIAS_PREFIX: z.string().default('alias/skalean-insurtech'),
  ARCHIVE_OBJECT_LOCK_RETENTION_DAYS: z.coerce
    .number()
    .int()
    .min(3651, 'Loi 43-20 art. 7 exige au minimum 10 ans + 1 jour (3651 jours)')
    .default(3651),
  S3_PRESIGNED_URL_MAX_TTL_SECONDS: z.coerce.number().int().min(60).max(604800).default(3600),
  S3_OPERATION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(30000),
  S3_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
});

export type S3Config = z.infer<typeof S3ConfigSchema>;

export function loadS3Config(env: NodeJS.ProcessEnv = process.env): S3Config {
  const parsed = S3ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Configuration S3 invalide:\n${issues}`);
  }
  return parsed.data;
}
```

### 7.4 `repo/packages/docs/src/services/kms-key-manager.service.ts`

```typescript
import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  KMSClient,
  CreateKeyCommand,
  CreateAliasCommand,
  DescribeKeyCommand,
  ScheduleKeyDeletionCommand,
  EnableKeyRotationCommand,
  ListAliasesCommand,
  KeyUsageType,
  KeySpec,
} from '@aws-sdk/client-kms';
import { Logger as PinoLogger } from 'nestjs-pino';
import type { S3Config } from '../config/s3-config';
import { KmsKeyNotReadyError, S3OperationFailedError, InvalidTenantIdError } from '../errors/s3-errors';

const TENANT_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

@Injectable()
export class KmsKeyManagerService {
  private readonly kms: KMSClient;
  private readonly aliasPrefix: string;
  private readonly env: string;

  constructor(
    @Inject('S3_CONFIG') private readonly config: S3Config,
    private readonly logger: PinoLogger,
  ) {
    this.kms = new KMSClient({
      endpoint: config.KMS_ENDPOINT ?? config.S3_ENDPOINT,
      region: config.S3_REGION,
      credentials: {
        accessKeyId: config.S3_ACCESS_KEY_ID,
        secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      },
      maxAttempts: config.S3_RETRY_MAX_ATTEMPTS,
    });
    this.aliasPrefix = config.KMS_KEY_ALIAS_PREFIX;
    this.env = config.NODE_ENV;
    this.logger.log({ component: 'KmsKeyManagerService', endpoint: config.KMS_ENDPOINT ?? config.S3_ENDPOINT }, 'KmsKeyManagerService initialise');
  }

  public getKeyAlias(tenantId: string): string {
    if (!TENANT_ID_REGEX.test(tenantId)) {
      throw new InvalidTenantIdError(tenantId);
    }
    return `${this.aliasPrefix}-${this.env}-${tenantId}`;
  }

  public async createKeyForTenant(tenantId: string): Promise<string> {
    const alias = this.getKeyAlias(tenantId);
    const existing = await this.findExistingAlias(alias);
    if (existing) {
      this.logger.log({ tenantId, alias, keyId: existing }, 'Cle KMS deja existante pour tenant');
      return existing;
    }
    try {
      const created = await this.kms.send(
        new CreateKeyCommand({
          Description: `Cle KMS dediee tenant ${tenantId} environnement ${this.env}. Conformite Loi 09-08 art. 24.`,
          KeyUsage: KeyUsageType.ENCRYPT_DECRYPT,
          KeySpec: KeySpec.SYMMETRIC_DEFAULT,
          MultiRegion: false,
          Tags: [
            { TagKey: 'tenant-id', TagValue: tenantId },
            { TagKey: 'env', TagValue: this.env },
            { TagKey: 'managed-by', TagValue: 'kms-key-manager-service' },
            { TagKey: 'compliance', TagValue: 'loi-09-08-cndp' },
          ],
        }),
      );
      const keyId = created.KeyMetadata?.KeyId;
      if (!keyId) {
        throw new S3OperationFailedError('CreateKey', new Error('KeyMetadata.KeyId absent'), { tenantId });
      }
      await this.kms.send(new CreateAliasCommand({ AliasName: alias, TargetKeyId: keyId }));
      await this.kms.send(new EnableKeyRotationCommand({ KeyId: keyId }));
      await this.waitForKeyReady(alias, tenantId);
      this.logger.log({ tenantId, alias, keyId, rotation: 'enabled' }, 'Cle KMS creee pour tenant');
      return keyId;
    } catch (err) {
      this.logger.error({ tenantId, alias, err }, 'Echec creation cle KMS');
      throw new S3OperationFailedError('CreateKeyForTenant', err, { tenantId });
    }
  }

  public async findExistingAlias(alias: string): Promise<string | null> {
    let marker: string | undefined;
    do {
      const resp = await this.kms.send(new ListAliasesCommand({ Marker: marker, Limit: 100 }));
      for (const a of resp.Aliases ?? []) {
        if (a.AliasName === alias && a.TargetKeyId) {
          return a.TargetKeyId;
        }
      }
      marker = resp.NextMarker;
    } while (marker);
    return null;
  }

  private async waitForKeyReady(alias: string, tenantId: string, maxAttempts = 10): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const desc = await this.kms.send(new DescribeKeyCommand({ KeyId: alias }));
        if (desc.KeyMetadata?.Enabled === true && desc.KeyMetadata?.KeyState === 'Enabled') {
          return;
        }
      } catch {
        // alias pas encore propage, on retry
      }
      const backoffMs = Math.min(2000, 100 * Math.pow(2, attempt));
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
    throw new KmsKeyNotReadyError(alias, tenantId);
  }

  public async scheduleDeletion(tenantId: string, pendingWindowDays = 30): Promise<void> {
    const alias = this.getKeyAlias(tenantId);
    const keyId = await this.findExistingAlias(alias);
    if (!keyId) {
      this.logger.warn({ tenantId, alias }, 'Cle KMS introuvable lors scheduleDeletion (deja supprimee?)');
      return;
    }
    if (pendingWindowDays < 7 || pendingWindowDays > 30) {
      throw new Error('pendingWindowDays doit etre dans [7, 30]');
    }
    await this.kms.send(new ScheduleKeyDeletionCommand({ KeyId: keyId, PendingWindowInDays: pendingWindowDays }));
    this.logger.warn({ tenantId, alias, keyId, pendingWindowDays }, 'Cle KMS planifiee pour suppression');
  }
}
```

### 7.5 `repo/packages/docs/src/services/object-lock-compliance.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import {
  S3Client,
  PutObjectLockConfigurationCommand,
  PutObjectRetentionCommand,
  GetObjectRetentionCommand,
  ObjectLockRetentionMode,
  ObjectLockEnabled,
} from '@aws-sdk/client-s3';
import { Logger as PinoLogger } from 'nestjs-pino';
import type { S3Config } from '../config/s3-config';
import { S3OperationFailedError } from '../errors/s3-errors';

@Injectable()
export class ObjectLockComplianceService {
  constructor(
    @Inject('S3_CLIENT') private readonly s3: S3Client,
    @Inject('S3_CONFIG') private readonly config: S3Config,
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Active Object Lock COMPLIANCE sur le bucket archive.
   * Doit etre invoque immediatement apres CreateBucket avec ObjectLockEnabledForBucket=true.
   * Mode COMPLIANCE: aucun bypass possible meme par root account.
   * decision-021 + Loi 43-20 art. 7.
   */
  public async enableComplianceMode(bucket: string, tenantId: string, retentionDays?: number): Promise<void> {
    const days = retentionDays ?? this.config.ARCHIVE_OBJECT_LOCK_RETENTION_DAYS;
    if (days < 3651) {
      throw new Error(`Retention COMPLIANCE doit etre >= 3651 jours (Loi 43-20). Recu: ${days}`);
    }
    try {
      await this.s3.send(
        new PutObjectLockConfigurationCommand({
          Bucket: bucket,
          ObjectLockConfiguration: {
            ObjectLockEnabled: ObjectLockEnabled.Enabled,
            Rule: {
              DefaultRetention: {
                Mode: ObjectLockRetentionMode.COMPLIANCE,
                Days: days,
              },
            },
          },
        }),
      );
      this.logger.log({ tenantId, bucket, retentionDays: days, mode: 'COMPLIANCE' }, 'Object Lock COMPLIANCE active');
    } catch (err) {
      this.logger.error({ tenantId, bucket, err }, 'Echec activation Object Lock COMPLIANCE');
      throw new S3OperationFailedError('PutObjectLockConfiguration', err, { tenantId, bucket });
    }
  }

  /**
   * Applique une retention COMPLIANCE sur un objet specifique du bucket archive.
   * Permet de surcharger la retention par defaut du bucket si besoin (ex: 15 ans pour clients entreprise).
   */
  public async putRetentionOnObject(bucket: string, key: string, tenantId: string, retainUntil: Date): Promise<void> {
    const minRetainUntil = new Date(Date.now() + this.config.ARCHIVE_OBJECT_LOCK_RETENTION_DAYS * 86400 * 1000);
    if (retainUntil.getTime() < minRetainUntil.getTime()) {
      throw new Error(
        `retainUntil "${retainUntil.toISOString()}" inferieur au minimum legal "${minRetainUntil.toISOString()}" (Loi 43-20).`,
      );
    }
    try {
      await this.s3.send(
        new PutObjectRetentionCommand({
          Bucket: bucket,
          Key: key,
          Retention: { Mode: ObjectLockRetentionMode.COMPLIANCE, RetainUntilDate: retainUntil },
        }),
      );
      this.logger.log({ tenantId, bucket, key, retainUntil: retainUntil.toISOString() }, 'Retention COMPLIANCE appliquee sur objet');
    } catch (err) {
      this.logger.error({ tenantId, bucket, key, err }, 'Echec PutObjectRetention');
      throw new S3OperationFailedError('PutObjectRetention', err, { tenantId, bucket, key });
    }
  }

  public async getObjectRetention(bucket: string, key: string, tenantId: string): Promise<{ mode?: string; retainUntilDate?: Date }> {
    try {
      const resp = await this.s3.send(new GetObjectRetentionCommand({ Bucket: bucket, Key: key }));
      return {
        mode: resp.Retention?.Mode,
        retainUntilDate: resp.Retention?.RetainUntilDate,
      };
    } catch (err) {
      throw new S3OperationFailedError('GetObjectRetention', err, { tenantId, bucket, key });
    }
  }
}
```

### 7.6 `repo/packages/docs/src/services/bucket-lifecycle.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import {
  S3Client,
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand,
  type LifecycleRule,
  TransitionStorageClass,
} from '@aws-sdk/client-s3';
import { Logger as PinoLogger } from 'nestjs-pino';
import { BucketKind } from '../types/bucket-kind.enum';
import { S3OperationFailedError } from '../errors/s3-errors';

@Injectable()
export class BucketLifecycleService {
  constructor(
    @Inject('S3_CLIENT') private readonly s3: S3Client,
    private readonly logger: PinoLogger,
  ) {}

  public buildRules(kind: BucketKind): LifecycleRule[] {
    switch (kind) {
      case BucketKind.DOCS:
        return [
          {
            ID: 'docs-transition-ia-30d',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Transitions: [{ Days: 30, StorageClass: TransitionStorageClass.STANDARD_IA }],
          },
          {
            ID: 'docs-transition-glacier-365d',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Transitions: [{ Days: 365, StorageClass: TransitionStorageClass.GLACIER }],
          },
          {
            ID: 'docs-expire-7y',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Expiration: { Days: 2557 },
          },
          {
            ID: 'docs-noncurrent-cleanup',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            NoncurrentVersionExpiration: { NoncurrentDays: 365 },
          },
          {
            ID: 'docs-abort-incomplete-mpu',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
          },
        ];
      case BucketKind.PHOTOS:
        return [
          {
            ID: 'photos-transition-ia-60d',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Transitions: [{ Days: 60, StorageClass: TransitionStorageClass.STANDARD_IA }],
          },
          {
            ID: 'photos-transition-glacier-180d',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Transitions: [{ Days: 180, StorageClass: TransitionStorageClass.GLACIER }],
          },
          {
            ID: 'photos-expire-5y',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Expiration: { Days: 1826 },
          },
          {
            ID: 'photos-abort-incomplete-mpu',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
          },
        ];
      case BucketKind.ARCHIVE:
        return [
          {
            ID: 'archive-transition-glacier-ir-90d',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Transitions: [{ Days: 90, StorageClass: TransitionStorageClass.GLACIER_IR }],
          },
          {
            ID: 'archive-transition-deep-archive-365d',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            Transitions: [{ Days: 365, StorageClass: TransitionStorageClass.DEEP_ARCHIVE }],
          },
          // PAS de regle Expiration: archives Loi 43-20 immutables 10 ans + 1 jour minimum.
          // Object Lock COMPLIANCE bloquerait Expiration de toute facon.
          {
            ID: 'archive-abort-incomplete-mpu',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
          },
        ];
      default: {
        const _exhaustive: never = kind;
        throw new Error(`BucketKind non gere: ${_exhaustive as string}`);
      }
    }
  }

  public async applyLifecycle(bucket: string, kind: BucketKind, tenantId: string): Promise<void> {
    const rules = this.buildRules(kind);
    try {
      await this.s3.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: bucket,
          LifecycleConfiguration: { Rules: rules },
        }),
      );
      this.logger.log({ tenantId, bucket, kind, rulesCount: rules.length }, 'Lifecycle policy appliquee');
    } catch (err) {
      this.logger.error({ tenantId, bucket, kind, err }, 'Echec PutBucketLifecycleConfiguration');
      throw new S3OperationFailedError('PutBucketLifecycleConfiguration', err, { tenantId, bucket });
    }
  }

  public async getCurrentLifecycle(bucket: string, tenantId: string): Promise<LifecycleRule[]> {
    try {
      const resp = await this.s3.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }));
      return resp.Rules ?? [];
    } catch (err: unknown) {
      const errorName = (err as { name?: string }).name;
      if (errorName === 'NoSuchLifecycleConfiguration') {
        return [];
      }
      throw new S3OperationFailedError('GetBucketLifecycleConfiguration', err, { tenantId, bucket });
    }
  }
}
```

### 7.7 `repo/packages/docs/src/services/s3-multitenant.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  PutBucketVersioningCommand,
  PutBucketEncryptionCommand,
  PutBucketTaggingCommand,
  PutPublicAccessBlockCommand,
  ServerSideEncryption,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Logger as PinoLogger } from 'nestjs-pino';
import type { Readable } from 'node:stream';
import type { S3Config } from '../config/s3-config';
import { BucketKind, isBucketKind } from '../types/bucket-kind.enum';
import {
  InvalidTenantIdError,
  BucketNotFoundError,
  ObjectNotFoundError,
  PresignedUrlTtlExceededError,
  ArchiveBucketDeletionForbiddenError,
  S3OperationFailedError,
  BucketAlreadyExistsError,
} from '../errors/s3-errors';
import { KmsKeyManagerService } from './kms-key-manager.service';
import { BucketLifecycleService } from './bucket-lifecycle.service';
import { ObjectLockComplianceService } from './object-lock-compliance.service';

const TENANT_ID_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export interface UploadResult {
  bucket: string;
  key: string;
  versionId?: string;
  etag?: string;
  sizeBytes: number;
  kmsKeyAlias: string;
}

export interface EnsureBucketOptions {
  applyLifecycle?: boolean;
  applyObjectLock?: boolean;
}

@Injectable()
export class S3MultiTenantService {
  private readonly env: string;
  private readonly bucketPrefix: string;
  private readonly maxPresignedTtl: number;

  constructor(
    @Inject('S3_CLIENT') private readonly s3: S3Client,
    @Inject('S3_CONFIG') private readonly config: S3Config,
    private readonly logger: PinoLogger,
    private readonly kmsKeyManager: KmsKeyManagerService,
    private readonly lifecycle: BucketLifecycleService,
    private readonly objectLock: ObjectLockComplianceService,
  ) {
    this.env = config.NODE_ENV;
    this.bucketPrefix = config.S3_BUCKET_PREFIX;
    this.maxPresignedTtl = config.S3_PRESIGNED_URL_MAX_TTL_SECONDS;
  }

  public getBucketName(tenantId: string, kind: BucketKind = BucketKind.DOCS): string {
    if (!TENANT_ID_REGEX.test(tenantId)) {
      throw new InvalidTenantIdError(tenantId);
    }
    if (!isBucketKind(kind)) {
      throw new Error(`BucketKind invalide: ${kind}`);
    }
    const name = `${this.bucketPrefix}-${this.env}-${tenantId}-${kind}`;
    if (name.length > 63) {
      throw new InvalidTenantIdError(`${tenantId} (genere bucket trop long: ${name.length} chars)`);
    }
    return name;
  }

  public async uploadDocument(
    tenantId: string,
    key: string,
    body: Buffer | Uint8Array | Readable | string,
    mimeType: string,
    options: { kind?: BucketKind; metadata?: Record<string, string>; correlationId?: string } = {},
  ): Promise<UploadResult> {
    const kind = options.kind ?? BucketKind.DOCS;
    const bucket = this.getBucketName(tenantId, kind);
    const kmsKeyAlias = this.kmsKeyManager.getKeyAlias(tenantId);
    const sanitizedMetadata = this.sanitizeMetadata({
      'tenant-id': tenantId,
      'uploaded-at': new Date().toISOString(),
      'correlation-id': options.correlationId ?? '',
      ...(options.metadata ?? {}),
    });

    const input: PutObjectCommandInput = {
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      ServerSideEncryption: ServerSideEncryption.aws_kms,
      SSEKMSKeyId: kmsKeyAlias,
      Metadata: sanitizedMetadata,
    };

    try {
      const result = await this.s3.send(new PutObjectCommand(input));
      const sizeBytes = this.computeSize(body);
      this.logger.log(
        { tenantId, bucket, key, sizeBytes, kmsKeyAlias, versionId: result.VersionId, correlationId: options.correlationId },
        'Document uploade',
      );
      return {
        bucket,
        key,
        versionId: result.VersionId,
        etag: result.ETag,
        sizeBytes,
        kmsKeyAlias,
      };
    } catch (err) {
      this.logger.error({ tenantId, bucket, key, err }, 'Echec uploadDocument');
      throw new S3OperationFailedError('PutObject', err, { tenantId, bucket, key });
    }
  }

  public async getPresignedUrl(
    tenantId: string,
    key: string,
    expiresInSec = 3600,
    kind: BucketKind = BucketKind.DOCS,
  ): Promise<string> {
    if (expiresInSec > this.maxPresignedTtl) {
      throw new PresignedUrlTtlExceededError(expiresInSec, this.maxPresignedTtl);
    }
    if (expiresInSec < 60) {
      throw new PresignedUrlTtlExceededError(expiresInSec, this.maxPresignedTtl);
    }
    const bucket = this.getBucketName(tenantId, kind);
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    try {
      const url = await getSignedUrl(this.s3, command, { expiresIn: expiresInSec });
      this.logger.log({ tenantId, bucket, key, expiresInSec }, 'URL presignee GET generee');
      return url;
    } catch (err) {
      throw new S3OperationFailedError('getSignedUrl-Get', err, { tenantId, bucket, key });
    }
  }

  public async getPresignedPutUrl(
    tenantId: string,
    key: string,
    mimeType: string,
    expiresInSec = 900,
    kind: BucketKind = BucketKind.DOCS,
  ): Promise<string> {
    if (expiresInSec > 900) {
      throw new PresignedUrlTtlExceededError(expiresInSec, 900);
    }
    const bucket = this.getBucketName(tenantId, kind);
    const kmsKeyAlias = this.kmsKeyManager.getKeyAlias(tenantId);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: mimeType,
      ServerSideEncryption: ServerSideEncryption.aws_kms,
      SSEKMSKeyId: kmsKeyAlias,
      Metadata: { 'tenant-id': tenantId },
    });
    try {
      const url = await getSignedUrl(this.s3, command, {
        expiresIn: expiresInSec,
        signableHeaders: new Set(['content-type', 'x-amz-server-side-encryption', 'x-amz-server-side-encryption-aws-kms-key-id']),
      });
      return url;
    } catch (err) {
      throw new S3OperationFailedError('getSignedUrl-Put', err, { tenantId, bucket, key });
    }
  }

  public async copyObject(
    tenantId: string,
    sourceKey: string,
    destKey: string,
    options: { sourceKind?: BucketKind; destKind?: BucketKind } = {},
  ): Promise<void> {
    const sourceBucket = this.getBucketName(tenantId, options.sourceKind ?? BucketKind.DOCS);
    const destBucket = this.getBucketName(tenantId, options.destKind ?? BucketKind.DOCS);
    const kmsKeyAlias = this.kmsKeyManager.getKeyAlias(tenantId);
    try {
      await this.s3.send(
        new CopyObjectCommand({
          Bucket: destBucket,
          Key: destKey,
          CopySource: `${sourceBucket}/${encodeURIComponent(sourceKey)}`,
          ServerSideEncryption: ServerSideEncryption.aws_kms,
          SSEKMSKeyId: kmsKeyAlias,
          MetadataDirective: 'COPY',
        }),
      );
      this.logger.log({ tenantId, sourceBucket, sourceKey, destBucket, destKey }, 'Objet copie');
    } catch (err) {
      throw new S3OperationFailedError('CopyObject', err, { tenantId, bucket: sourceBucket, key: sourceKey });
    }
  }

  public async deleteObject(
    tenantId: string,
    key: string,
    kind: BucketKind = BucketKind.DOCS,
    options: { allowArchive?: boolean } = {},
  ): Promise<void> {
    const bucket = this.getBucketName(tenantId, kind);
    if (kind === BucketKind.ARCHIVE && !options.allowArchive) {
      throw new ArchiveBucketDeletionForbiddenError(bucket, key, tenantId);
    }
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      this.logger.warn({ tenantId, bucket, key, kind }, 'Objet supprime');
    } catch (err) {
      throw new S3OperationFailedError('DeleteObject', err, { tenantId, bucket, key });
    }
  }

  public async headObject(
    tenantId: string,
    key: string,
    kind: BucketKind = BucketKind.DOCS,
  ): Promise<{ contentLength?: number; contentType?: string; etag?: string; metadata?: Record<string, string>; lastModified?: Date }> {
    const bucket = this.getBucketName(tenantId, kind);
    try {
      const resp = await this.s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return {
        contentLength: resp.ContentLength,
        contentType: resp.ContentType,
        etag: resp.ETag,
        metadata: resp.Metadata,
        lastModified: resp.LastModified,
      };
    } catch (err: unknown) {
      const errorName = (err as { name?: string; $metadata?: { httpStatusCode?: number } }).name;
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (errorName === 'NotFound' || status === 404) {
        throw new ObjectNotFoundError(bucket, key, tenantId);
      }
      throw new S3OperationFailedError('HeadObject', err, { tenantId, bucket, key });
    }
  }

  public async ensureBucket(
    tenantId: string,
    kind: BucketKind,
    options: EnsureBucketOptions = { applyLifecycle: true, applyObjectLock: kind === BucketKind.ARCHIVE },
  ): Promise<string> {
    const bucket = this.getBucketName(tenantId, kind);
    const exists = await this.bucketExists(bucket);
    if (exists) {
      this.logger.log({ tenantId, bucket, kind }, 'Bucket deja existant (idempotent)');
      return bucket;
    }
    try {
      await this.s3.send(
        new CreateBucketCommand({
          Bucket: bucket,
          ObjectLockEnabledForBucket: kind === BucketKind.ARCHIVE,
        }),
      );
    } catch (err: unknown) {
      const errorName = (err as { name?: string }).name;
      if (errorName === 'BucketAlreadyOwnedByYou' || errorName === 'BucketAlreadyExists') {
        throw new BucketAlreadyExistsError(bucket, tenantId);
      }
      throw new S3OperationFailedError('CreateBucket', err, { tenantId, bucket });
    }

    await this.s3.send(
      new PutPublicAccessBlockCommand({
        Bucket: bucket,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      }),
    );

    await this.s3.send(
      new PutBucketVersioningCommand({
        Bucket: bucket,
        VersioningConfiguration: { Status: 'Enabled' },
      }),
    );

    const kmsKeyAlias = this.kmsKeyManager.getKeyAlias(tenantId);
    await this.s3.send(
      new PutBucketEncryptionCommand({
        Bucket: bucket,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: ServerSideEncryption.aws_kms,
                KMSMasterKeyID: kmsKeyAlias,
              },
              BucketKeyEnabled: true,
            },
          ],
        },
      }),
    );

    await this.s3.send(
      new PutBucketTaggingCommand({
        Bucket: bucket,
        Tagging: {
          TagSet: [
            { Key: 'tenant-id', Value: tenantId },
            { Key: 'env', Value: this.env },
            { Key: 'kind', Value: kind },
            { Key: 'data-residency', Value: 'ma-benguerir-1' },
            { Key: 'compliance', Value: 'loi-09-08-loi-43-20' },
          ],
        },
      }),
    );

    if (options.applyObjectLock && kind === BucketKind.ARCHIVE) {
      await this.objectLock.enableComplianceMode(bucket, tenantId);
    }
    if (options.applyLifecycle) {
      await this.lifecycle.applyLifecycle(bucket, kind, tenantId);
    }

    this.logger.log({ tenantId, bucket, kind, kmsKeyAlias }, 'Bucket provisionne avec succes');
    return bucket;
  }

  public async bucketExists(bucket: string): Promise<boolean> {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: bucket }));
      return true;
    } catch (err: unknown) {
      const errorName = (err as { name?: string; $metadata?: { httpStatusCode?: number } }).name;
      const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (errorName === 'NotFound' || errorName === 'NoSuchBucket' || status === 404) {
        return false;
      }
      throw err;
    }
  }

  private sanitizeMetadata(meta: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined || v === null || v === '') continue;
      // Metadata S3 doivent etre ASCII; encoder les valeurs non-ASCII en URL-encoded.
      result[k] = /^[\x20-\x7E]*$/.test(v) ? v : encodeURIComponent(v);
    }
    return result;
  }

  private computeSize(body: Buffer | Uint8Array | Readable | string): number {
    if (typeof body === 'string') return Buffer.byteLength(body, 'utf8');
    if (Buffer.isBuffer(body)) return body.length;
    if (body instanceof Uint8Array) return body.byteLength;
    return -1; // Stream: taille inconnue avant upload
  }
}
```

### 7.8 `repo/packages/docs/src/docs.module.ts` (modification)

```typescript
import { Module, Global } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { LoggerModule } from 'nestjs-pino';
import { S3MultiTenantService } from './services/s3-multitenant.service';
import { KmsKeyManagerService } from './services/kms-key-manager.service';
import { BucketLifecycleService } from './services/bucket-lifecycle.service';
import { ObjectLockComplianceService } from './services/object-lock-compliance.service';
import { loadS3Config } from './config/s3-config';

@Global()
@Module({
  imports: [LoggerModule.forRoot()],
  providers: [
    {
      provide: 'S3_CONFIG',
      useFactory: () => loadS3Config(),
    },
    {
      provide: 'S3_CLIENT',
      inject: ['S3_CONFIG'],
      useFactory: (config: ReturnType<typeof loadS3Config>) =>
        new S3Client({
          endpoint: config.S3_ENDPOINT,
          region: config.S3_REGION,
          forcePathStyle: config.S3_FORCE_PATH_STYLE,
          credentials: {
            accessKeyId: config.S3_ACCESS_KEY_ID,
            secretAccessKey: config.S3_SECRET_ACCESS_KEY,
          },
          maxAttempts: config.S3_RETRY_MAX_ATTEMPTS,
          requestHandler: { requestTimeout: config.S3_OPERATION_TIMEOUT_MS },
        }),
    },
    KmsKeyManagerService,
    BucketLifecycleService,
    ObjectLockComplianceService,
    S3MultiTenantService,
  ],
  exports: [S3MultiTenantService, KmsKeyManagerService, BucketLifecycleService, ObjectLockComplianceService, 'S3_CLIENT', 'S3_CONFIG'],
})
export class DocsModule {}
```

### 7.9 `repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts` (modification)

```typescript
import { Injectable } from '@nestjs/common';
import { Logger as PinoLogger } from 'nestjs-pino';
import { S3MultiTenantService } from '@insurtech/docs/services/s3-multitenant.service';
import { KmsKeyManagerService } from '@insurtech/docs/services/kms-key-manager.service';
import { BucketKind, BUCKET_KINDS_ALL } from '@insurtech/docs/types/bucket-kind.enum';
import { TenantRepository } from '../repositories/tenant.repository';
import type { TenantCreatedEvent } from '../events/tenant-created.event';

@Injectable()
export class TenantOnboardingService {
  constructor(
    private readonly tenantRepo: TenantRepository,
    private readonly s3MultiTenant: S3MultiTenantService,
    private readonly kmsKeyManager: KmsKeyManagerService,
    private readonly logger: PinoLogger,
  ) {}

  public async onboardTenant(input: { tenantId: string; companyName: string; createdBy: string }): Promise<{ tenantId: string; buckets: string[]; kmsKeyId: string }> {
    const { tenantId, companyName, createdBy } = input;
    this.logger.log({ tenantId, companyName, createdBy }, 'Demarrage onboarding tenant');

    // 1. Creer enregistrement DB
    await this.tenantRepo.create({ tenantId, companyName, createdBy, status: 'PROVISIONING' });

    try {
      // 2. Creer cle KMS dediee tenant
      const kmsKeyId = await this.kmsKeyManager.createKeyForTenant(tenantId);

      // 3. Provisionner les 3 buckets
      const buckets: string[] = [];
      for (const kind of BUCKET_KINDS_ALL) {
        const bucket = await this.s3MultiTenant.ensureBucket(tenantId, kind, {
          applyLifecycle: true,
          applyObjectLock: kind === BucketKind.ARCHIVE,
        });
        buckets.push(bucket);
      }

      // 4. Marquer tenant ACTIF
      await this.tenantRepo.updateStatus(tenantId, 'ACTIVE');

      this.logger.log({ tenantId, buckets, kmsKeyId }, 'Onboarding tenant termine');

      const event: TenantCreatedEvent = { tenantId, companyName, buckets, kmsKeyId, createdAt: new Date() };
      // Publication event omise ici (delegue a EventBus injection)
      void event;

      return { tenantId, buckets, kmsKeyId };
    } catch (err) {
      this.logger.error({ tenantId, err }, 'Echec onboarding tenant');
      await this.tenantRepo.updateStatus(tenantId, 'FAILED');
      throw err;
    }
  }
}
```

### 7.10 `repo/infrastructure/scripts/setup-minio-dev.sh`

```bash
#!/usr/bin/env bash
# Bootstrap MinIO local pour developpement Sprint 10 docs/signature.
# Cree un conteneur MinIO sur port 9000 avec credentials dev,
# puis provisionne 3 buckets pour le tenant "dev-tenant" en mimant Atlas Cloud Services.
# Aucun emoji (decision-006).

set -euo pipefail

MINIO_VERSION="${MINIO_VERSION:-RELEASE.2024-12-18T13-15-44Z}"
MINIO_CONTAINER_NAME="${MINIO_CONTAINER_NAME:-skalean-minio-dev}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minio-dev-access}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minio-dev-secret-very-long-min-16}"
MINIO_DATA_DIR="${MINIO_DATA_DIR:-${HOME}/.skalean-minio-dev-data}"
TENANT_ID="${TENANT_ID:-dev-tenant}"
ENV_NAME="${ENV_NAME:-development}"

echo "[setup-minio-dev] Verification docker disponible"
if ! command -v docker >/dev/null 2>&1; then
  echo "[setup-minio-dev] ERREUR: docker requis" >&2
  exit 1
fi

mkdir -p "${MINIO_DATA_DIR}"

if docker ps -a --format '{{.Names}}' | grep -q "^${MINIO_CONTAINER_NAME}$"; then
  echo "[setup-minio-dev] Conteneur ${MINIO_CONTAINER_NAME} existe deja, redemarrage"
  docker start "${MINIO_CONTAINER_NAME}" >/dev/null
else
  echo "[setup-minio-dev] Creation conteneur MinIO ${MINIO_VERSION}"
  docker run -d \
    --name "${MINIO_CONTAINER_NAME}" \
    -p 9000:9000 -p 9001:9001 \
    -e MINIO_ROOT_USER="${MINIO_ACCESS_KEY}" \
    -e MINIO_ROOT_PASSWORD="${MINIO_SECRET_KEY}" \
    -v "${MINIO_DATA_DIR}:/data" \
    "minio/minio:${MINIO_VERSION}" \
    server /data --console-address ":9001"
fi

echo "[setup-minio-dev] Attente readiness MinIO"
for i in {1..30}; do
  if curl -sf http://localhost:9000/minio/health/ready >/dev/null 2>&1; then
    echo "[setup-minio-dev] MinIO pret"
    break
  fi
  sleep 1
done

echo "[setup-minio-dev] Configuration mc client"
docker exec "${MINIO_CONTAINER_NAME}" mc alias set local http://localhost:9000 "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" >/dev/null

for KIND in docs photos archive; do
  BUCKET="skalean-insurtech-${ENV_NAME}-${TENANT_ID}-${KIND}"
  echo "[setup-minio-dev] Provisionnement bucket ${BUCKET}"
  if [ "${KIND}" = "archive" ]; then
    docker exec "${MINIO_CONTAINER_NAME}" mc mb --with-lock "local/${BUCKET}" 2>/dev/null || true
    docker exec "${MINIO_CONTAINER_NAME}" mc retention set --default compliance 3651d "local/${BUCKET}" 2>/dev/null || true
  else
    docker exec "${MINIO_CONTAINER_NAME}" mc mb "local/${BUCKET}" 2>/dev/null || true
  fi
  docker exec "${MINIO_CONTAINER_NAME}" mc version enable "local/${BUCKET}" >/dev/null
done

echo "[setup-minio-dev] Termine"
echo "[setup-minio-dev] Endpoint: http://localhost:9000"
echo "[setup-minio-dev] Console: http://localhost:9001 (login ${MINIO_ACCESS_KEY})"
echo "[setup-minio-dev] Configurer .env: S3_ENDPOINT=http://localhost:9000 S3_ACCESS_KEY_ID=${MINIO_ACCESS_KEY} S3_SECRET_ACCESS_KEY=${MINIO_SECRET_KEY}"
```

### 7.11 `repo/infrastructure/terraform/s3-buckets.tf`

```hcl
# Provisionnement buckets multi-tenant Atlas Cloud Services Benguerir.
# decision-008 data residency MA, decision-021 Object Lock COMPLIANCE archive.
# Aucun emoji (decision-006).

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }
}

provider "aws" {
  region                      = "ma-benguerir-1"
  endpoints {
    s3  = var.atlas_s3_endpoint
    kms = var.atlas_kms_endpoint
  }
  s3_use_path_style           = true
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_region_validation      = true
}

variable "env" {
  type        = string
  description = "Environnement deploiement (development|staging|production)"
}

variable "atlas_s3_endpoint" {
  type    = string
  default = "https://s3.benguerir.atlascs.ma"
}

variable "atlas_kms_endpoint" {
  type    = string
  default = "https://kms.benguerir.atlascs.ma"
}

variable "tenants" {
  type        = list(string)
  description = "Liste tenant_id a provisionner"
  default     = []
}

variable "bucket_prefix" {
  type    = string
  default = "skalean-insurtech"
}

variable "archive_retention_days" {
  type    = number
  default = 3651
}

locals {
  tenant_kinds = flatten([
    for tenant in var.tenants : [
      for kind in ["docs", "photos", "archive"] : {
        tenant = tenant
        kind   = kind
        bucket = "${var.bucket_prefix}-${var.env}-${tenant}-${kind}"
      }
    ]
  ])
  tenant_kinds_map = { for tk in local.tenant_kinds : "${tk.tenant}-${tk.kind}" => tk }
}

resource "aws_kms_key" "tenant_key" {
  for_each                = toset(var.tenants)
  description             = "Cle KMS dediee tenant ${each.value} env ${var.env}"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  multi_region            = false
  tags = {
    "tenant-id"  = each.value
    "env"        = var.env
    "compliance" = "loi-09-08-cndp"
  }
}

resource "aws_kms_alias" "tenant_alias" {
  for_each      = toset(var.tenants)
  name          = "alias/${var.bucket_prefix}-${var.env}-${each.value}"
  target_key_id = aws_kms_key.tenant_key[each.value].id
}

resource "aws_s3_bucket" "tenant_bucket" {
  for_each            = local.tenant_kinds_map
  bucket              = each.value.bucket
  object_lock_enabled = each.value.kind == "archive"
  force_destroy       = false
  tags = {
    "tenant-id"      = each.value.tenant
    "env"            = var.env
    "kind"           = each.value.kind
    "data-residency" = "ma-benguerir-1"
    "compliance"     = "loi-09-08-loi-43-20"
  }
}

resource "aws_s3_bucket_public_access_block" "tenant_block" {
  for_each                = local.tenant_kinds_map
  bucket                  = aws_s3_bucket.tenant_bucket[each.key].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "tenant_versioning" {
  for_each = local.tenant_kinds_map
  bucket   = aws_s3_bucket.tenant_bucket[each.key].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tenant_sse" {
  for_each = local.tenant_kinds_map
  bucket   = aws_s3_bucket.tenant_bucket[each.key].id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_alias.tenant_alias[each.value.tenant].name
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_object_lock_configuration" "archive_lock" {
  for_each = { for k, v in local.tenant_kinds_map : k => v if v.kind == "archive" }
  bucket   = aws_s3_bucket.tenant_bucket[each.key].id
  rule {
    default_retention {
      mode = "COMPLIANCE"
      days = var.archive_retention_days
    }
  }
}

output "buckets" {
  value = { for k, v in local.tenant_kinds_map : k => aws_s3_bucket.tenant_bucket[k].id }
}

output "kms_aliases" {
  value = { for t in var.tenants : t => aws_kms_alias.tenant_alias[t].name }
}
```

## 8. TESTS COMPLETS

### 8.1 `repo/packages/docs/src/services/s3-multitenant.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep, MockProxy } from 'vitest-mock-extended';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, HeadBucketCommand, CreateBucketCommand, DeleteObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { S3MultiTenantService } from './s3-multitenant.service';
import { KmsKeyManagerService } from './kms-key-manager.service';
import { BucketLifecycleService } from './bucket-lifecycle.service';
import { ObjectLockComplianceService } from './object-lock-compliance.service';
import { BucketKind } from '../types/bucket-kind.enum';
import { InvalidTenantIdError, ObjectNotFoundError, PresignedUrlTtlExceededError, ArchiveBucketDeletionForbiddenError, BucketAlreadyExistsError } from '../errors/s3-errors';
import type { S3Config } from '../config/s3-config';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned?sig=abc'),
}));

const mockConfig: S3Config = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'ma-benguerir-1',
  S3_ACCESS_KEY_ID: 'test-access-key',
  S3_SECRET_ACCESS_KEY: 'test-secret-key-very-long',
  S3_FORCE_PATH_STYLE: true,
  S3_BUCKET_PREFIX: 'skalean-insurtech',
  KMS_ENABLED: true,
  KMS_KEY_ALIAS_PREFIX: 'alias/skalean-insurtech',
  ARCHIVE_OBJECT_LOCK_RETENTION_DAYS: 3651,
  S3_PRESIGNED_URL_MAX_TTL_SECONDS: 3600,
  S3_OPERATION_TIMEOUT_MS: 30000,
  S3_RETRY_MAX_ATTEMPTS: 3,
  NODE_ENV: 'test',
};

describe('S3MultiTenantService', () => {
  let service: S3MultiTenantService;
  let s3Client: MockProxy<S3Client>;
  let kms: MockProxy<KmsKeyManagerService>;
  let lifecycle: MockProxy<BucketLifecycleService>;
  let objectLock: MockProxy<ObjectLockComplianceService>;
  let logger: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    s3Client = mockDeep<S3Client>();
    kms = mockDeep<KmsKeyManagerService>();
    lifecycle = mockDeep<BucketLifecycleService>();
    objectLock = mockDeep<ObjectLockComplianceService>();
    logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };

    kms.getKeyAlias.mockImplementation((t: string) => `alias/skalean-insurtech-test-${t}`);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3MultiTenantService,
        { provide: 'S3_CLIENT', useValue: s3Client },
        { provide: 'S3_CONFIG', useValue: mockConfig },
        { provide: 'PinoLogger', useValue: logger },
        { provide: KmsKeyManagerService, useValue: kms },
        { provide: BucketLifecycleService, useValue: lifecycle },
        { provide: ObjectLockComplianceService, useValue: objectLock },
      ],
    })
      .overrideProvider(S3MultiTenantService)
      .useFactory({ factory: (s3, cfg, log, k, l, o) => new S3MultiTenantService(s3, cfg, log, k, l, o), inject: ['S3_CLIENT', 'S3_CONFIG', 'PinoLogger', KmsKeyManagerService, BucketLifecycleService, ObjectLockComplianceService] })
      .compile();

    service = module.get(S3MultiTenantService);
  });

  describe('getBucketName', () => {
    it('T01 genere nom bucket valide pour tenant standard', () => {
      expect(service.getBucketName('cnia', BucketKind.DOCS)).toBe('skalean-insurtech-test-cnia-docs');
    });
    it('T02 genere nom different par kind', () => {
      expect(service.getBucketName('cnia', BucketKind.PHOTOS)).toBe('skalean-insurtech-test-cnia-photos');
      expect(service.getBucketName('cnia', BucketKind.ARCHIVE)).toBe('skalean-insurtech-test-cnia-archive');
    });
    it('T03 rejette tenantId avec underscore', () => {
      expect(() => service.getBucketName('bad_tenant')).toThrow(InvalidTenantIdError);
    });
    it('T04 rejette tenantId avec majuscule', () => {
      expect(() => service.getBucketName('BadTenant')).toThrow(InvalidTenantIdError);
    });
    it('T05 rejette tenantId trop court', () => {
      expect(() => service.getBucketName('a')).toThrow(InvalidTenantIdError);
    });
    it('T06 rejette tenantId qui ferait depasser 63 chars', () => {
      const longTenant = 'a'.repeat(60);
      expect(() => service.getBucketName(longTenant)).toThrow(InvalidTenantIdError);
    });
    it('T07 par defaut kind=docs', () => {
      expect(service.getBucketName('cnia')).toBe('skalean-insurtech-test-cnia-docs');
    });
  });

  describe('uploadDocument', () => {
    it('T08 upload reussi avec SSE-KMS et metadata tenant', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ETag: '"abc123"', VersionId: 'v1' });
      const result = await service.uploadDocument('cnia', 'contracts/c1.pdf', Buffer.from('hello'), 'application/pdf');
      expect(result.bucket).toBe('skalean-insurtech-test-cnia-docs');
      expect(result.kmsKeyAlias).toBe('alias/skalean-insurtech-test-cnia');
      expect(result.versionId).toBe('v1');
      expect(result.sizeBytes).toBe(5);
      const call = (s3Client.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as PutObjectCommand;
      expect(call).toBeInstanceOf(PutObjectCommand);
      expect(call.input.ServerSideEncryption).toBe('aws:kms');
      expect(call.input.SSEKMSKeyId).toBe('alias/skalean-insurtech-test-cnia');
      expect(call.input.Metadata?.['tenant-id']).toBe('cnia');
    });
    it('T09 propage S3OperationFailedError en cas d\'erreur reseau', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network unreachable'));
      await expect(service.uploadDocument('cnia', 'k', Buffer.from('x'), 'text/plain')).rejects.toThrow(/Echec operation S3 "PutObject"/);
    });
    it('T10 sanitize les metadata non-ASCII en URL-encoded', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      await service.uploadDocument('cnia', 'k', Buffer.from('x'), 'text/plain', { metadata: { 'nom-client': 'Hassan El Fassi' } });
      const call = (s3Client.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as PutObjectCommand;
      expect(call.input.Metadata?.['nom-client']).toBe('Hassan El Fassi');
    });
    it('T11 rejette tenant invalide avant tout appel S3', async () => {
      await expect(service.uploadDocument('BAD_ID', 'k', Buffer.from('x'), 'text/plain')).rejects.toThrow(InvalidTenantIdError);
      expect(s3Client.send).not.toHaveBeenCalled();
    });
  });

  describe('getPresignedUrl', () => {
    it('T12 genere URL presignee TTL 3600 par defaut', async () => {
      const url = await service.getPresignedUrl('cnia', 'k.pdf');
      expect(url).toContain('https://s3.example.com/presigned');
    });
    it('T13 rejette TTL > 3600 secondes', async () => {
      await expect(service.getPresignedUrl('cnia', 'k.pdf', 7200)).rejects.toThrow(PresignedUrlTtlExceededError);
    });
    it('T14 rejette TTL < 60 secondes', async () => {
      await expect(service.getPresignedUrl('cnia', 'k.pdf', 30)).rejects.toThrow(PresignedUrlTtlExceededError);
    });
    it('T15 utilise bucket selon kind', async () => {
      const url = await service.getPresignedUrl('cnia', 'k', 1800, BucketKind.PHOTOS);
      expect(url).toBeDefined();
    });
  });

  describe('getPresignedPutUrl', () => {
    it('T16 genere URL PUT presignee avec SSE-KMS headers', async () => {
      const url = await service.getPresignedPutUrl('cnia', 'k.pdf', 'application/pdf');
      expect(url).toBeDefined();
    });
    it('T17 rejette TTL > 900 secondes pour PUT', async () => {
      await expect(service.getPresignedPutUrl('cnia', 'k.pdf', 'application/pdf', 1800)).rejects.toThrow(PresignedUrlTtlExceededError);
    });
  });

  describe('copyObject', () => {
    it('T18 copie avec SSE-KMS preserve', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      await service.copyObject('cnia', 'src.pdf', 'dst.pdf');
      const call = (s3Client.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as CopyObjectCommand;
      expect(call).toBeInstanceOf(CopyObjectCommand);
      expect(call.input.ServerSideEncryption).toBe('aws:kms');
    });
  });

  describe('deleteObject', () => {
    it('T19 supprime objet docs sans probleme', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      await service.deleteObject('cnia', 'k.pdf', BucketKind.DOCS);
      const call = (s3Client.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as DeleteObjectCommand;
      expect(call).toBeInstanceOf(DeleteObjectCommand);
    });
    it('T20 refuse suppression archive sans flag allowArchive', async () => {
      await expect(service.deleteObject('cnia', 'k.pdf', BucketKind.ARCHIVE)).rejects.toThrow(ArchiveBucketDeletionForbiddenError);
      expect(s3Client.send).not.toHaveBeenCalled();
    });
    it('T21 autorise suppression archive avec flag allowArchive=true', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      await service.deleteObject('cnia', 'k.pdf', BucketKind.ARCHIVE, { allowArchive: true });
      expect(s3Client.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('headObject', () => {
    it('T22 retourne metadata sur objet existant', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ContentLength: 1234,
        ContentType: 'application/pdf',
        ETag: '"abc"',
        Metadata: { 'tenant-id': 'cnia' },
        LastModified: new Date('2026-05-01'),
      });
      const result = await service.headObject('cnia', 'k.pdf');
      expect(result.contentLength).toBe(1234);
      expect(result.contentType).toBe('application/pdf');
      expect(result.metadata?.['tenant-id']).toBe('cnia');
    });
    it('T23 leve ObjectNotFoundError sur 404', async () => {
      const err = new Error('NotFound') as Error & { name: string; $metadata: { httpStatusCode: number } };
      err.name = 'NotFound';
      err.$metadata = { httpStatusCode: 404 };
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);
      await expect(service.headObject('cnia', 'missing.pdf')).rejects.toThrow(ObjectNotFoundError);
    });
  });

  describe('ensureBucket', () => {
    it('T24 retourne directement si bucket existe deja', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({}); // HeadBucket OK
      const bucket = await service.ensureBucket('cnia', BucketKind.DOCS);
      expect(bucket).toBe('skalean-insurtech-test-cnia-docs');
      expect(s3Client.send).toHaveBeenCalledTimes(1); // Seulement HeadBucket
    });
    it('T25 cree bucket avec versioning, encryption, public block, tagging si absent', async () => {
      const notFound = new Error('NotFound') as Error & { name: string; $metadata: { httpStatusCode: number } };
      notFound.name = 'NotFound';
      notFound.$metadata = { httpStatusCode: 404 };
      (s3Client.send as unknown as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(notFound) // HeadBucket -> 404
        .mockResolvedValue({}); // Tous les autres OK
      await service.ensureBucket('cnia', BucketKind.DOCS);
      // HeadBucket + CreateBucket + PutPublicAccessBlock + PutBucketVersioning + PutBucketEncryption + PutBucketTagging = 6
      expect((s3Client.send as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(6);
      expect(lifecycle.applyLifecycle).toHaveBeenCalledWith('skalean-insurtech-test-cnia-docs', BucketKind.DOCS, 'cnia');
    });
    it('T26 active Object Lock COMPLIANCE pour kind=archive', async () => {
      const notFound = new Error('NotFound') as Error & { name: string; $metadata: { httpStatusCode: number } };
      notFound.name = 'NotFound';
      notFound.$metadata = { httpStatusCode: 404 };
      (s3Client.send as unknown as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(notFound)
        .mockResolvedValue({});
      await service.ensureBucket('cnia', BucketKind.ARCHIVE);
      expect(objectLock.enableComplianceMode).toHaveBeenCalledWith('skalean-insurtech-test-cnia-archive', 'cnia');
      const createCall = (s3Client.send as unknown as ReturnType<typeof vi.fn>).mock.calls.find((c) => c[0] instanceof CreateBucketCommand);
      expect((createCall![0] as CreateBucketCommand).input.ObjectLockEnabledForBucket).toBe(true);
    });
    it('T27 leve BucketAlreadyExistsError sur collision concurrente', async () => {
      const notFound = new Error('NotFound') as Error & { name: string; $metadata: { httpStatusCode: number } };
      notFound.name = 'NotFound';
      notFound.$metadata = { httpStatusCode: 404 };
      const conflict = new Error('BucketAlreadyExists') as Error & { name: string };
      conflict.name = 'BucketAlreadyExists';
      (s3Client.send as unknown as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(notFound)
        .mockRejectedValueOnce(conflict);
      await expect(service.ensureBucket('cnia', BucketKind.DOCS)).rejects.toThrow(BucketAlreadyExistsError);
    });
  });

  describe('bucketExists', () => {
    it('T28 retourne true si HeadBucket reussit', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      expect(await service.bucketExists('any-bucket')).toBe(true);
    });
    it('T29 retourne false si HeadBucket retourne 404', async () => {
      const err = new Error('NotFound') as Error & { name: string; $metadata: { httpStatusCode: number } };
      err.name = 'NotFound';
      err.$metadata = { httpStatusCode: 404 };
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);
      expect(await service.bucketExists('missing')).toBe(false);
    });
    it('T30 propage erreur reseau autre que 404', async () => {
      (s3Client.send as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('ECONNRESET'));
      await expect(service.bucketExists('any')).rejects.toThrow('ECONNRESET');
    });
  });
});
```

### 8.2 `repo/packages/docs/src/services/bucket-lifecycle.service.spec.ts`

```typescript
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { mockDeep, MockProxy } from 'vitest-mock-extended';
import { S3Client, PutBucketLifecycleConfigurationCommand, GetBucketLifecycleConfigurationCommand, TransitionStorageClass } from '@aws-sdk/client-s3';
import { BucketLifecycleService } from './bucket-lifecycle.service';
import { BucketKind } from '../types/bucket-kind.enum';

describe('BucketLifecycleService', () => {
  let service: BucketLifecycleService;
  let s3: MockProxy<S3Client>;
  let logger: { log: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    s3 = mockDeep<S3Client>();
    logger = { log: vi.fn(), error: vi.fn() };
    service = new BucketLifecycleService(s3, logger as never);
  });

  describe('buildRules', () => {
    it('T31 docs: 5 regles incluant transition IA 30j puis Glacier 365j puis Expire 7y', () => {
      const rules = service.buildRules(BucketKind.DOCS);
      expect(rules).toHaveLength(5);
      const iaRule = rules.find((r) => r.ID === 'docs-transition-ia-30d');
      expect(iaRule?.Transitions?.[0].Days).toBe(30);
      expect(iaRule?.Transitions?.[0].StorageClass).toBe(TransitionStorageClass.STANDARD_IA);
      const glacierRule = rules.find((r) => r.ID === 'docs-transition-glacier-365d');
      expect(glacierRule?.Transitions?.[0].Days).toBe(365);
      const expireRule = rules.find((r) => r.ID === 'docs-expire-7y');
      expect(expireRule?.Expiration?.Days).toBe(2557);
    });
    it('T32 photos: 4 regles avec transitions 60j et 180j et expire 5 ans', () => {
      const rules = service.buildRules(BucketKind.PHOTOS);
      expect(rules).toHaveLength(4);
      expect(rules.find((r) => r.ID === 'photos-expire-5y')?.Expiration?.Days).toBe(1826);
    });
    it('T33 archive: 3 regles avec GLACIER_IR 90j puis DEEP_ARCHIVE 365j et AUCUNE expiration', () => {
      const rules = service.buildRules(BucketKind.ARCHIVE);
      expect(rules).toHaveLength(3);
      expect(rules.some((r) => r.Expiration !== undefined)).toBe(false);
      const deepRule = rules.find((r) => r.ID === 'archive-transition-deep-archive-365d');
      expect(deepRule?.Transitions?.[0].StorageClass).toBe(TransitionStorageClass.DEEP_ARCHIVE);
    });
    it('T34 toutes les regles incluent abort multipart upload 7j', () => {
      for (const kind of [BucketKind.DOCS, BucketKind.PHOTOS, BucketKind.ARCHIVE]) {
        const rules = service.buildRules(kind);
        const abortRule = rules.find((r) => r.AbortIncompleteMultipartUpload !== undefined);
        expect(abortRule?.AbortIncompleteMultipartUpload?.DaysAfterInitiation).toBe(7);
      }
    });
  });

  describe('applyLifecycle', () => {
    it('T35 envoie PutBucketLifecycleConfigurationCommand', async () => {
      (s3.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      await service.applyLifecycle('skalean-insurtech-test-cnia-docs', BucketKind.DOCS, 'cnia');
      const call = (s3.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call).toBeInstanceOf(PutBucketLifecycleConfigurationCommand);
      expect(call.input.LifecycleConfiguration.Rules).toHaveLength(5);
    });
    it('T36 propage erreur en cas d\'echec', async () => {
      (s3.send as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('AccessDenied'));
      await expect(service.applyLifecycle('b', BucketKind.DOCS, 'cnia')).rejects.toThrow(/Echec operation S3 "PutBucketLifecycleConfiguration"/);
    });
  });

  describe('getCurrentLifecycle', () => {
    it('T37 retourne tableau vide si NoSuchLifecycleConfiguration', async () => {
      const err = new Error('NoSuchLifecycleConfiguration') as Error & { name: string };
      err.name = 'NoSuchLifecycleConfiguration';
      (s3.send as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(err);
      const rules = await service.getCurrentLifecycle('b', 'cnia');
      expect(rules).toEqual([]);
    });
    it('T38 retourne les regles existantes', async () => {
      (s3.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ Rules: [{ ID: 'r1', Status: 'Enabled' }] });
      const rules = await service.getCurrentLifecycle('b', 'cnia');
      expect(rules).toHaveLength(1);
    });
  });
});
```

### 8.3 `repo/packages/docs/src/services/kms-key-manager.service.spec.ts`

```typescript
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { mockDeep, MockProxy } from 'vitest-mock-extended';
import { KMSClient, CreateKeyCommand, CreateAliasCommand, EnableKeyRotationCommand, ListAliasesCommand, ScheduleKeyDeletionCommand, DescribeKeyCommand } from '@aws-sdk/client-kms';
import { KmsKeyManagerService } from './kms-key-manager.service';
import { InvalidTenantIdError, KmsKeyNotReadyError } from '../errors/s3-errors';
import type { S3Config } from '../config/s3-config';

const cfg: S3Config = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'ma-benguerir-1',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 'sssssssssssssssss',
  S3_FORCE_PATH_STYLE: true,
  S3_BUCKET_PREFIX: 'skalean-insurtech',
  KMS_ENABLED: true,
  KMS_KEY_ALIAS_PREFIX: 'alias/skalean-insurtech',
  ARCHIVE_OBJECT_LOCK_RETENTION_DAYS: 3651,
  S3_PRESIGNED_URL_MAX_TTL_SECONDS: 3600,
  S3_OPERATION_TIMEOUT_MS: 30000,
  S3_RETRY_MAX_ATTEMPTS: 3,
  NODE_ENV: 'test',
};

describe('KmsKeyManagerService', () => {
  let service: KmsKeyManagerService;
  let kms: MockProxy<KMSClient>;
  let logger: { log: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    service = new KmsKeyManagerService(cfg, logger as never);
    kms = mockDeep<KMSClient>();
    (service as unknown as { kms: KMSClient }).kms = kms;
  });

  describe('getKeyAlias', () => {
    it('T39 genere alias correct', () => {
      expect(service.getKeyAlias('cnia')).toBe('alias/skalean-insurtech-test-cnia');
    });
    it('T40 rejette tenantId invalide', () => {
      expect(() => service.getKeyAlias('Bad_Tenant')).toThrow(InvalidTenantIdError);
    });
  });

  describe('createKeyForTenant', () => {
    it('T41 retourne keyId existant si alias deja present', async () => {
      (kms.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        Aliases: [{ AliasName: 'alias/skalean-insurtech-test-cnia', TargetKeyId: 'existing-key-id' }],
      });
      const id = await service.createKeyForTenant('cnia');
      expect(id).toBe('existing-key-id');
    });
    it('T42 cree cle, alias, active rotation si absent', async () => {
      (kms.send as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ Aliases: [] }) // ListAliases
        .mockResolvedValueOnce({ KeyMetadata: { KeyId: 'new-key-id' } }) // CreateKey
        .mockResolvedValueOnce({}) // CreateAlias
        .mockResolvedValueOnce({}) // EnableKeyRotation
        .mockResolvedValueOnce({ KeyMetadata: { Enabled: true, KeyState: 'Enabled' } }); // DescribeKey
      const id = await service.createKeyForTenant('cnia');
      expect(id).toBe('new-key-id');
      const calls = (kms.send as unknown as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls[1][0]).toBeInstanceOf(CreateKeyCommand);
      expect(calls[2][0]).toBeInstanceOf(CreateAliasCommand);
      expect(calls[3][0]).toBeInstanceOf(EnableKeyRotationCommand);
    });
    it('T43 retry waitForKeyReady puis leve KmsKeyNotReadyError', async () => {
      (kms.send as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ Aliases: [] })
        .mockResolvedValueOnce({ KeyMetadata: { KeyId: 'new-id' } })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValue({ KeyMetadata: { Enabled: false, KeyState: 'PendingImport' } });
      await expect(service.createKeyForTenant('cnia')).rejects.toThrow(KmsKeyNotReadyError);
    }, 30000);
  });

  describe('scheduleDeletion', () => {
    it('T44 envoie ScheduleKeyDeletionCommand avec window 30j', async () => {
      (kms.send as unknown as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ Aliases: [{ AliasName: 'alias/skalean-insurtech-test-cnia', TargetKeyId: 'kid' }] })
        .mockResolvedValueOnce({});
      await service.scheduleDeletion('cnia', 30);
      const call = (kms.send as unknown as ReturnType<typeof vi.fn>).mock.calls[1][0] as ScheduleKeyDeletionCommand;
      expect(call).toBeInstanceOf(ScheduleKeyDeletionCommand);
      expect(call.input.PendingWindowInDays).toBe(30);
    });
    it('T45 rejette window hors [7, 30]', async () => {
      await expect(service.scheduleDeletion('cnia', 5)).rejects.toThrow(/pendingWindowDays/);
      await expect(service.scheduleDeletion('cnia', 60)).rejects.toThrow(/pendingWindowDays/);
    });
    it('T46 no-op si cle deja absente', async () => {
      (kms.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ Aliases: [] });
      await expect(service.scheduleDeletion('cnia', 30)).resolves.toBeUndefined();
    });
  });
});
```

### 8.4 `repo/packages/docs/src/services/object-lock-compliance.service.spec.ts`

```typescript
import { describe, beforeEach, it, expect, vi } from 'vitest';
import { mockDeep, MockProxy } from 'vitest-mock-extended';
import { S3Client, PutObjectLockConfigurationCommand, PutObjectRetentionCommand, GetObjectRetentionCommand, ObjectLockRetentionMode, ObjectLockEnabled } from '@aws-sdk/client-s3';
import { ObjectLockComplianceService } from './object-lock-compliance.service';
import type { S3Config } from '../config/s3-config';

const cfg: S3Config = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_REGION: 'ma-benguerir-1',
  S3_ACCESS_KEY_ID: 'k',
  S3_SECRET_ACCESS_KEY: 'sssssssssssssssss',
  S3_FORCE_PATH_STYLE: true,
  S3_BUCKET_PREFIX: 'skalean-insurtech',
  KMS_ENABLED: true,
  KMS_KEY_ALIAS_PREFIX: 'alias/skalean-insurtech',
  ARCHIVE_OBJECT_LOCK_RETENTION_DAYS: 3651,
  S3_PRESIGNED_URL_MAX_TTL_SECONDS: 3600,
  S3_OPERATION_TIMEOUT_MS: 30000,
  S3_RETRY_MAX_ATTEMPTS: 3,
  NODE_ENV: 'test',
};

describe('ObjectLockComplianceService', () => {
  let service: ObjectLockComplianceService;
  let s3: MockProxy<S3Client>;
  let logger: { log: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    s3 = mockDeep<S3Client>();
    logger = { log: vi.fn(), error: vi.fn() };
    service = new ObjectLockComplianceService(s3, cfg, logger as never);
  });

  describe('enableComplianceMode', () => {
    it('T47 envoie PutObjectLockConfigurationCommand mode COMPLIANCE 3651j', async () => {
      (s3.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      await service.enableComplianceMode('skalean-insurtech-test-cnia-archive', 'cnia');
      const call = (s3.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as PutObjectLockConfigurationCommand;
      expect(call).toBeInstanceOf(PutObjectLockConfigurationCommand);
      expect(call.input.ObjectLockConfiguration?.ObjectLockEnabled).toBe(ObjectLockEnabled.Enabled);
      expect(call.input.ObjectLockConfiguration?.Rule?.DefaultRetention?.Mode).toBe(ObjectLockRetentionMode.COMPLIANCE);
      expect(call.input.ObjectLockConfiguration?.Rule?.DefaultRetention?.Days).toBe(3651);
    });
    it('T48 rejette retention < 3651 jours', async () => {
      await expect(service.enableComplianceMode('b', 'cnia', 1000)).rejects.toThrow(/Loi 43-20/);
    });
  });

  describe('putRetentionOnObject', () => {
    it('T49 applique retention dans le futur >= retention legale', async () => {
      (s3.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
      const future = new Date(Date.now() + 4000 * 86400 * 1000);
      await service.putRetentionOnObject('b', 'k', 'cnia', future);
      const call = (s3.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as PutObjectRetentionCommand;
      expect(call.input.Retention?.Mode).toBe(ObjectLockRetentionMode.COMPLIANCE);
    });
    it('T50 rejette retention plus courte que minimum legal', async () => {
      const past = new Date(Date.now() + 100 * 86400 * 1000);
      await expect(service.putRetentionOnObject('b', 'k', 'cnia', past)).rejects.toThrow(/Loi 43-20/);
    });
  });

  describe('getObjectRetention', () => {
    it('T51 retourne mode et retainUntilDate', async () => {
      const date = new Date('2036-05-08');
      (s3.send as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ Retention: { Mode: 'COMPLIANCE', RetainUntilDate: date } });
      const result = await service.getObjectRetention('b', 'k', 'cnia');
      expect(result.mode).toBe('COMPLIANCE');
      expect(result.retainUntilDate).toEqual(date);
    });
  });
});
```

### 8.5 `repo/packages/docs/src/services/s3-integration.spec.ts` (Testcontainers MinIO)

```typescript
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { S3Client, CreateBucketCommand, PutObjectCommand, GetObjectCommand, HeadBucketCommand, ListObjectsV2Command, PutBucketVersioningCommand } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';
import { S3MultiTenantService } from './s3-multitenant.service';
import { KmsKeyManagerService } from './kms-key-manager.service';
import { BucketLifecycleService } from './bucket-lifecycle.service';
import { ObjectLockComplianceService } from './object-lock-compliance.service';
import { BucketKind } from '../types/bucket-kind.enum';
import type { S3Config } from '../config/s3-config';

describe('S3 integration (Testcontainers MinIO)', () => {
  let container: StartedTestContainer;
  let s3: S3Client;
  let service: S3MultiTenantService;
  let cfg: S3Config;
  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';

  beforeAll(async () => {
    container = await new GenericContainer('minio/minio:RELEASE.2024-12-18T13-15-44Z')
      .withExposedPorts(9000)
      .withEnvironment({
        MINIO_ROOT_USER: 'minio-test-access',
        MINIO_ROOT_PASSWORD: 'minio-test-secret-very-long',
      })
      .withCommand(['server', '/data'])
      .withWaitStrategy(Wait.forHttp('/minio/health/ready', 9000))
      .withStartupTimeout(60000)
      .start();

    const endpoint = `http://${container.getHost()}:${container.getMappedPort(9000)}`;
    cfg = {
      S3_ENDPOINT: endpoint,
      S3_REGION: 'ma-benguerir-1',
      S3_ACCESS_KEY_ID: 'minio-test-access',
      S3_SECRET_ACCESS_KEY: 'minio-test-secret-very-long',
      S3_FORCE_PATH_STYLE: true,
      S3_BUCKET_PREFIX: 'skalean-insurtech',
      KMS_ENABLED: false, // KMS non disponible dans MinIO test
      KMS_KEY_ALIAS_PREFIX: 'alias/skalean-insurtech',
      ARCHIVE_OBJECT_LOCK_RETENTION_DAYS: 3651,
      S3_PRESIGNED_URL_MAX_TTL_SECONDS: 3600,
      S3_OPERATION_TIMEOUT_MS: 30000,
      S3_RETRY_MAX_ATTEMPTS: 3,
      NODE_ENV: 'test',
    };

    s3 = new S3Client({
      endpoint,
      region: cfg.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: cfg.S3_ACCESS_KEY_ID, secretAccessKey: cfg.S3_SECRET_ACCESS_KEY },
    });

    const logger = { log: () => undefined, warn: () => undefined, error: () => undefined };
    const kms = {
      getKeyAlias: (t: string) => `alias/skalean-insurtech-test-${t}`,
      createKeyForTenant: async () => 'fake-key-id',
      scheduleDeletion: async () => undefined,
    } as unknown as KmsKeyManagerService;
    const lifecycle = new BucketLifecycleService(s3, logger as never);
    const objectLock = new ObjectLockComplianceService(s3, cfg, logger as never);

    service = new S3MultiTenantService(s3, cfg, logger as never, kms, lifecycle, objectLock);
  }, 90000);

  afterAll(async () => {
    if (container) await container.stop();
  });

  it('T52 cree bucket docs, photos via ensureBucket et HeadBucket confirme', async () => {
    await service.ensureBucket(tenantA, BucketKind.DOCS, { applyLifecycle: false });
    await service.ensureBucket(tenantA, BucketKind.PHOTOS, { applyLifecycle: false });
    await expect(s3.send(new HeadBucketCommand({ Bucket: `skalean-insurtech-test-${tenantA}-docs` }))).resolves.toBeDefined();
    await expect(s3.send(new HeadBucketCommand({ Bucket: `skalean-insurtech-test-${tenantA}-photos` }))).resolves.toBeDefined();
  });

  it('T53 ensureBucket idempotent (deuxieme appel ne plante pas)', async () => {
    await expect(service.ensureBucket(tenantA, BucketKind.DOCS, { applyLifecycle: false })).resolves.toMatch(/^skalean-insurtech-test-tenant-a-docs$/);
  });

  it('T54 isolation cross-tenant: tenant A ne voit pas objets tenant B', async () => {
    await service.ensureBucket(tenantB, BucketKind.DOCS, { applyLifecycle: false });
    const bodyA = Buffer.from('contenu tenant A confidentiel');
    const bodyB = Buffer.from('contenu tenant B confidentiel');
    // MinIO test ne supporte pas SSE-KMS, on patch temporairement
    await s3.send(new PutObjectCommand({ Bucket: `skalean-insurtech-test-${tenantA}-docs`, Key: 'doc-a.txt', Body: bodyA }));
    await s3.send(new PutObjectCommand({ Bucket: `skalean-insurtech-test-${tenantB}-docs`, Key: 'doc-b.txt', Body: bodyB }));

    const listA = await s3.send(new ListObjectsV2Command({ Bucket: `skalean-insurtech-test-${tenantA}-docs` }));
    const listB = await s3.send(new ListObjectsV2Command({ Bucket: `skalean-insurtech-test-${tenantB}-docs` }));
    const keysA = (listA.Contents ?? []).map((o) => o.Key);
    const keysB = (listB.Contents ?? []).map((o) => o.Key);
    expect(keysA).toContain('doc-a.txt');
    expect(keysA).not.toContain('doc-b.txt');
    expect(keysB).toContain('doc-b.txt');
    expect(keysB).not.toContain('doc-a.txt');
  });

  it('T55 archive avec Object Lock COMPLIANCE rejette DeleteObject', async () => {
    await service.ensureBucket(tenantA, BucketKind.ARCHIVE, { applyLifecycle: false, applyObjectLock: true });
    const archiveBucket = `skalean-insurtech-test-${tenantA}-archive`;
    await s3.send(new PutObjectVersioning({ Bucket: archiveBucket, VersioningConfiguration: { Status: 'Enabled' } } as unknown as PutBucketVersioningCommand['input']) as never).catch(() => undefined);
    const future = new Date(Date.now() + 4000 * 86400 * 1000);
    const putResp = await s3.send(new PutObjectCommand({
      Bucket: archiveBucket,
      Key: 'archive-test.bin',
      Body: Buffer.from('archive immutable'),
      ObjectLockMode: 'COMPLIANCE',
      ObjectLockRetainUntilDate: future,
    }));
    expect(putResp.VersionId).toBeDefined();
    // Tentative suppression -> doit echouer en COMPLIANCE
    await expect(s3.send(new (await import('@aws-sdk/client-s3')).DeleteObjectCommand({
      Bucket: archiveBucket,
      Key: 'archive-test.bin',
      VersionId: putResp.VersionId,
    }))).rejects.toThrow();
  });

  it('T56 presigned URL GET fonctionne et est revocable apres expiration', async () => {
    const key = 'presigned-test.txt';
    await s3.send(new PutObjectCommand({ Bucket: `skalean-insurtech-test-${tenantA}-docs`, Key: key, Body: 'hello presigned' }));
    const url = await service.getPresignedUrl(tenantA, key, 60, BucketKind.DOCS);
    expect(url).toMatch(/^http/);
    const fetchResp = await fetch(url);
    expect(fetchResp.status).toBe(200);
    const text = await fetchResp.text();
    expect(text).toBe('hello presigned');
  });

  it('T57 lifecycle rules s\'appliquent (verification Put + Get)', async () => {
    const lifecycle = new BucketLifecycleService(s3, { log: () => undefined, error: () => undefined } as never);
    const bucket = `skalean-insurtech-test-${tenantA}-docs`;
    await lifecycle.applyLifecycle(bucket, BucketKind.DOCS, tenantA);
    const rules = await lifecycle.getCurrentLifecycle(bucket, tenantA);
    expect(rules.length).toBeGreaterThanOrEqual(4);
  });

  it('T58 versioning active sur buckets crees par ensureBucket', async () => {
    const bucket = `skalean-insurtech-test-${tenantA}-docs`;
    const key = 'versioning-test.txt';
    const v1 = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'v1' }));
    const v2 = await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: 'v2' }));
    expect(v1.VersionId).toBeDefined();
    expect(v2.VersionId).toBeDefined();
    expect(v1.VersionId).not.toBe(v2.VersionId);
  });

  it('T59 headObject retourne metadata sur objet existant', async () => {
    const bucket = `skalean-insurtech-test-${tenantA}-docs`;
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: 'head-test.txt', Body: 'abc', Metadata: { 'tenant-id': tenantA } }));
    const meta = await service.headObject(tenantA, 'head-test.txt');
    expect(meta.contentLength).toBe(3);
    expect(meta.metadata?.['tenant-id']).toBe(tenantA);
  });

  it('T60 deleteObject sur docs reussit, sur archive sans flag echoue', async () => {
    await s3.send(new PutObjectCommand({ Bucket: `skalean-insurtech-test-${tenantA}-docs`, Key: 'to-delete.txt', Body: 'x' }));
    await expect(service.deleteObject(tenantA, 'to-delete.txt', BucketKind.DOCS)).resolves.toBeUndefined();
    await expect(service.deleteObject(tenantA, 'whatever', BucketKind.ARCHIVE)).rejects.toThrow(/Suppression interdite/);
  });
});

class PutObjectVersioning extends PutBucketVersioningCommand {}
```

## 9. Variables environnement

Ajouter / mettre a jour dans `repo/.env.example` et documenter dans `repo/packages/docs/README.md`:

```bash
# === S3 Atlas Cloud Services Benguerir / MinIO local ===
# Endpoint S3 (production: ACS, dev: MinIO local). decision-008 data residency MA.
S3_ENDPOINT=http://localhost:9000
# Region OBLIGATOIRE ma-benguerir-1, aucun autre fallback.
S3_REGION=ma-benguerir-1
# Credentials. En prod: secrets manager (HashiCorp Vault), JAMAIS en clair.
S3_ACCESS_KEY_ID=minio-dev-access
S3_SECRET_ACCESS_KEY=minio-dev-secret-very-long-min-16
# Path-style obligatoire pour MinIO et Atlas Cloud Services Benguerir multi-tenant.
S3_FORCE_PATH_STYLE=true
# Prefixe nom bucket. Doit matcher /^[a-z][a-z0-9-]{1,40}$/.
S3_BUCKET_PREFIX=skalean-insurtech
# Plafond TTL URL presignee (production: 3600s = 1h max recommande).
S3_PRESIGNED_URL_MAX_TTL_SECONDS=3600
# Timeout par operation S3 en millisecondes.
S3_OPERATION_TIMEOUT_MS=30000
# Nombre max de retries (backoff exponential SDK).
S3_RETRY_MAX_ATTEMPTS=3

# === KMS Atlas Cloud Services ===
KMS_ENABLED=true
# Endpoint KMS (par defaut meme que S3_ENDPOINT pour ACS).
KMS_ENDPOINT=http://localhost:9000
# Prefix alias KMS. Pattern final: alias/{prefix}-{env}-{tenant_id}.
KMS_KEY_ALIAS_PREFIX=alias/skalean-insurtech

# === Object Lock COMPLIANCE archive ===
# Loi 43-20 art. 7: 10 ans + 1 jour minimum = 3651 jours.
ARCHIVE_OBJECT_LOCK_RETENTION_DAYS=3651

# === Environnement ===
NODE_ENV=development
```

## 10. Commandes shell

### 10.1 Setup MinIO local pour developpement

```bash
# Donner droits d'execution
chmod +x repo/infrastructure/scripts/setup-minio-dev.sh
# Lancer le bootstrap
TENANT_ID=dev-tenant ENV_NAME=development ./repo/infrastructure/scripts/setup-minio-dev.sh
# Verifier
docker exec skalean-minio-dev mc ls local/
# Sortie attendue: skalean-insurtech-development-dev-tenant-docs/photos/archive
```

### 10.2 Provisionnement Terraform Atlas Cloud Services (production)

```bash
cd repo/infrastructure/terraform
# Initialiser
terraform init
# Lister les buckets a creer en plan
terraform plan \
  -var "env=production" \
  -var 'tenants=["cnia", "saham", "atlanta"]' \
  -out=plan.tfplan
# Appliquer
terraform apply plan.tfplan
# Verifier
terraform output buckets
terraform output kms_aliases
```

### 10.3 Tests unitaires + integration

```bash
# Unit tests (sans Docker)
pnpm --filter @insurtech/docs test:unit
# Integration tests (necessite Docker)
pnpm --filter @insurtech/docs test:integration
# Tous les tests + coverage
pnpm --filter @insurtech/docs test:cov
# Vitest watch en dev
pnpm --filter @insurtech/docs test:watch
```

### 10.4 Validation pre-commit

```bash
# Typecheck
pnpm --filter @insurtech/docs typecheck
# Lint (eslint + prettier)
pnpm --filter @insurtech/docs lint
# Verification absence emoji
grep -RP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{1F600}-\x{1F64F}]' repo/packages/docs/src/ && echo "EMOJI DETECTE" && exit 1 || echo "OK no emoji"
# Verification absence console.log
grep -RP '\bconsole\.(log|debug|info|warn|error)\b' repo/packages/docs/src/ --include="*.ts" --exclude="*.spec.ts" && echo "console.log DETECTE" && exit 1 || echo "OK pino logger"
```

### 10.5 Onboarding tenant programmatique

```bash
# Via API REST (apres tache 3.3.x consolidee)
curl -X POST http://localhost:3000/api/v1/tenants \
  -H "Authorization: Bearer ${ADMIN_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"tenantId": "demo-courtier", "companyName": "Demo Courtier SARL", "createdBy": "admin@skalean.ma"}'
# Reponse attendue:
# {
#   "tenantId": "demo-courtier",
#   "buckets": [
#     "skalean-insurtech-development-demo-courtier-docs",
#     "skalean-insurtech-development-demo-courtier-photos",
#     "skalean-insurtech-development-demo-courtier-archive"
#   ],
#   "kmsKeyId": "..."
# }
```

## 11. CRITERES VALIDATION V1-V32

| ID | Critere | Commande | Resultat attendu |
|----|---------|----------|-------------------|
| V01 | Fichier `s3-multitenant.service.ts` existe et compile | `test -f repo/packages/docs/src/services/s3-multitenant.service.ts && pnpm --filter @insurtech/docs typecheck` | Exit 0 |
| V02 | Fichier `bucket-lifecycle.service.ts` existe | `test -f repo/packages/docs/src/services/bucket-lifecycle.service.ts` | Exit 0 |
| V03 | Fichier `kms-key-manager.service.ts` existe | `test -f repo/packages/docs/src/services/kms-key-manager.service.ts` | Exit 0 |
| V04 | Fichier `object-lock-compliance.service.ts` existe | `test -f repo/packages/docs/src/services/object-lock-compliance.service.ts` | Exit 0 |
| V05 | Enum BucketKind exporte 3 valeurs | `node -e "const e = require('./repo/packages/docs/dist/types/bucket-kind.enum.js'); console.log(Object.keys(e.BucketKind))"` | `[ 'DOCS', 'PHOTOS', 'ARCHIVE' ]` |
| V06 | 8 classes d'erreur exportees | `grep -c "^export class" repo/packages/docs/src/errors/s3-errors.ts` | `>= 8` |
| V07 | Zod schema valide config typique | `pnpm --filter @insurtech/docs vitest run src/config/s3-config.spec.ts` | Tous tests passent |
| V08 | TypeScript strict (no any, no @ts-ignore) | `grep -RP "(\\bany\\b|@ts-ignore)" repo/packages/docs/src/ --include="*.ts" \| grep -v ".spec.ts"` | Aucune occurrence (sauf justifiees commentees) |
| V09 | Aucun emoji dans le code | `grep -RP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{1F600}-\x{1F64F}]' repo/packages/docs/src/` | Aucune sortie |
| V10 | Aucun console.log dans le code prod | `grep -RP '\\bconsole\\.(log\|debug\|info\|warn\|error)\\b' repo/packages/docs/src/ --include="*.ts" --exclude="*.spec.ts"` | Aucune sortie |
| V11 | Tests unitaires 30+ et tous verts | `pnpm --filter @insurtech/docs vitest run --reporter=json \| jq '.numTotalTests, .numPassedTests'` | `>= 30` et egaux |
| V12 | Coverage >= 90% | `pnpm --filter @insurtech/docs test:cov \| grep "All files" \| awk '{print $4}'` | `>= 90` |
| V13 | Bucket name pattern conforme | `node -e "const {S3MultiTenantService}=require('./dist/...'); /* test getBucketName */"` | `skalean-insurtech-test-cnia-docs` |
| V14 | KMS alias pattern conforme | Idem avec KmsKeyManagerService.getKeyAlias | `alias/skalean-insurtech-test-cnia` |
| V15 | Region forcee ma-benguerir-1 | `grep -P 'S3_REGION.*ma-benguerir-1' repo/.env.example repo/packages/docs/src/config/s3-config.ts` | Match found |
| V16 | Aucun fallback eu-west-1 | `grep -RP 'eu-west-1\|us-east-1\|eu-central-1' repo/packages/docs/src/` | Aucune sortie |
| V17 | Object Lock retention >= 3651 | `grep -P 'ARCHIVE_OBJECT_LOCK_RETENTION_DAYS.*3651' repo/.env.example` | Match |
| V18 | Object Lock mode COMPLIANCE (jamais GOVERNANCE) | `grep -RP "ObjectLockRetentionMode\\.(GOVERNANCE)" repo/packages/docs/src/` | Aucune sortie |
| V19 | Public Access Block applique | `grep -P "PutPublicAccessBlockCommand" repo/packages/docs/src/services/s3-multitenant.service.ts` | Match |
| V20 | Versioning active a la creation | `grep -P "PutBucketVersioningCommand" repo/packages/docs/src/services/s3-multitenant.service.ts` | Match |
| V21 | Tag data-residency ma-benguerir-1 | `grep -P 'data-residency.*ma-benguerir-1' repo/packages/docs/src/services/s3-multitenant.service.ts` | Match |
| V22 | Tag compliance loi-09-08 | `grep -P 'compliance.*loi-09-08' repo/packages/docs/src/services/s3-multitenant.service.ts` | Match |
| V23 | Pino logger utilise | `grep -P "Logger as PinoLogger" repo/packages/docs/src/services/*.ts \| wc -l` | `>= 4` |
| V24 | Test integration MinIO testcontainers passe | `pnpm --filter @insurtech/docs vitest run src/services/s3-integration.spec.ts` | Tous verts |
| V25 | Test isolation cross-tenant verifie absence de fuite | Test T54 dans s3-integration.spec.ts | Pass |
| V26 | Test Object Lock rejette DeleteObject | Test T55 dans s3-integration.spec.ts | Pass |
| V27 | Script setup-minio-dev.sh executable | `test -x repo/infrastructure/scripts/setup-minio-dev.sh` | Exit 0 |
| V28 | Module Terraform valide | `cd repo/infrastructure/terraform && terraform fmt -check && terraform validate` | Exit 0 |
| V29 | TenantOnboardingService invoque ensureBucket x3 | `grep -c "ensureBucket" repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts` | `>= 1 (loop sur 3 kinds)` |
| V30 | Documentation README mise a jour | `grep -P "## S3 Multi-Tenant" repo/packages/docs/README.md` | Match |
| V31 | TenantId regex applique partout | `grep -RP "TENANT_ID_REGEX" repo/packages/docs/src/services/` | `>= 2` matches |
| V32 | Lifecycle abort multipart 7j present | `grep -P "AbortIncompleteMultipartUpload" repo/packages/docs/src/services/bucket-lifecycle.service.ts` | Match |

## 12. Edge cases

1. **Bucket already exists during ensureBucket race**: deux requetes concurrentes pour le meme tenant peuvent appeler `CreateBucket` simultanement. La seconde recevra `BucketAlreadyOwnedByYou`. Notre code traduit en `BucketAlreadyExistsError`; le caller (TenantOnboardingService) devrait distinguer cette erreur "benigne" et retry-relire avec `bucketExists`. Si le tenantId est legitime, accepter et continuer.

2. **KMS key creation race during onboarding**: lors d'un onboarding suivi immediatement d'un upload, l'alias KMS peut ne pas etre encore propage en eventual consistency (1-5s ACS). `KmsKeyManagerService.waitForKeyReady` retry exponential 10 fois (max ~10s cumule). Si echec persistant, lever `KmsKeyNotReadyError` et notifier l'ops.

3. **Presigned URL TTL expire mid-upload**: si un upload front via PUT presigne prend plus longtemps que TTL=900s, S3 rejette avec `RequestTimeout`. Frontend doit detecter et redemander une nouvelle URL. Documenter clairement dans contrat OpenAPI.

4. **Object Lock retention violation attempt**: si un IAM user tente `DeleteObjectVersion` sur un objet archive sous retention, S3 rejette avec `AccessDenied`. Notre service rejette plus tot via `ArchiveBucketDeletionForbiddenError`. Audit log doit capturer cette tentative comme incident securite.

5. **MinIO compat differences (presigned URLs path-style)**: MinIO genere des URLs presignees avec hostname `localhost:9000/bucket/key?...` (path-style) alors qu'AWS S3 par defaut produit `bucket.s3.amazonaws.com/key?...` (virtual-hosted). Forcer `forcePathStyle: true` pour homogenizer. Test integration verifie au moins un GET fonctionnel.

6. **Lifecycle rule conflict avec Object Lock**: regles `Expiration` sur bucket Object Lock COMPLIANCE sont silencieusement ignorees pour objets sous retention. Notre `buildRules(BucketKind.ARCHIVE)` n'inclut volontairement aucune `Expiration`. Si quelqu'un en ajoute par erreur, S3 ne refuse pas le `PutBucketLifecycleConfiguration` mais ignore la regle. Pieger en code review.

7. **Multi-region disaster recovery interdit**: decision-008 interdit replication cross-region etrangere. Mitigation: snapshot quotidien chiffre vers second bucket meme region (`...-backup`) ou pattern Cross-Region Replication interne ACS si disponible (a verifier avec ACS support, ticket en cours).

8. **KMS rotation impact on old objects**: KMS rotation cree une nouvelle version de cle annuellement. Anciens objets restent dechiffrables car KMS retient les anciennes versions. Ne JAMAIS supprimer manuellement les anciennes versions. Documenter dans runbook ops.

9. **Bucket naming collision after tenant rename**: si un tenant change de nom (ex: "cnia" -> "cnia-saham" suite a fusion), bucket name change. Strategie: ne JAMAIS renommer un tenantId (immutable). Utiliser un champ separe `displayName` mutable. Si rename forcee legalement, procedure: createBucket nouveau, copyObject batch, validate, scheduleDeletion ancien (apres expiration retention archive si applicable).

10. **S3 eventual consistency listing**: apres `PutObject`, `ListObjectsV2` peut omettre l'objet quelques ms. ACS Benguerir confirme strong consistency depuis 2024 mais MinIO en mode standalone non. Tests integration utilisent `HeadObject` direct quand possible plutot que `ListObjectsV2`.

11. **CORS preflight pour presigned URLs frontend**: le bucket doit avoir une CORS policy autorisant l'origine front. A configurer separement via `PutBucketCorsCommand`. Pas inclus dans cette tache (sera Tache 3.3.5 dedicacee CORS), documente comme follow-up.

12. **DeleteBucket sur bucket archive avec retention en cours**: impossible. Procedure CNDP purge tenant doit verifier preflight que tous objets archive ont `RetainUntilDate < now`. Sinon refuser et notifier DPO/Legal pour escalade ANRT.

13. **Pagination ListObjectVersions sur tres grands buckets (>1M objets)**: utiliser `MaxKeys=1000` + `KeyMarker`/`VersionIdMarker` paginating. Ne pas charger en memoire. Implementer en streaming.

14. **Charge IAM policy size limit**: une policy IAM par tenant peut depasser 6KB (limite AWS managed policy). Strategie: utiliser policies inline scoping par bucket ARN pattern, jamais de policy enumerant chaque objet.

15. **MinIO ne supporte pas KMS Atlas-style aliases**: tests integration desactivent KMS (`KMS_ENABLED=false`) ou injectent un mock. En production reelle ACS, KMS pleinement actif. Differences a tester en staging.

## 13. Conformite Maroc detaillee

### 13.1 Loi 09-08 article 24 (data residency)

> "Le responsable du traitement [...] s'assure que les donnees a caractere personnel font l'objet d'un transfert vers un autre pays uniquement [...] sous condition que ce pays assure un niveau de protection equivalent."

Notre architecture garantit:
- Tous buckets crees dans `S3_REGION=ma-benguerir-1` (Atlas Cloud Services Benguerir, datacenter sur sol marocain certifie ANRT).
- Aucun fallback `eu-west-1`, `us-east-1` ni autre region etrangere autorise (validation V16).
- Replication cross-region interdite (configuration Terraform: `multi_region = false` sur cles KMS).
- Backup secondaire dans la meme region (decision-008 explicite).
- Audit ACAPS peut tracer `aws:RequestedRegion` dans CloudTrail equivalent ACS.

### 13.2 Loi 43-20 article 7 (archives signatures electroniques)

> "Les documents signes electroniquement doivent etre conserves [...] dans des conditions garantissant leur integrite et leur lisibilite pendant la duree legale applicable, soit dix annees minimum a compter de leur emission."

Notre architecture garantit:
- Bucket `archive` en mode Object Lock COMPLIANCE (decision-021).
- Retention par defaut 3651 jours = 10 ans + 1 jour (marge legale).
- Mode COMPLIANCE rend l'objet immutable y compris pour root account (validation V18).
- Versioning active prevent overwrite accidentel.
- Lifecycle GLACIER_IR puis DEEP_ARCHIVE preserve la lisibilite (formats S3 standard, restoration delai 12-48h tolerable car archive consultation rare).
- Tests integration T55 verifient le rejet de DeleteObject.

### 13.3 ACAPS Circulaire 2018/01 (segregation stockage)

> "Les organismes d'assurance et de reassurance doivent assurer une segregation logique et physique entre les donnees des differents preneurs d'assurance, particulierement lorsque l'infrastructure est mutualisee."

Notre architecture garantit:
- Segregation physique: un bucket S3 dedie par tenant (decision-012).
- Segregation cryptographique: une cle KMS dediee par tenant (decision-019), compromise contained.
- Audit-friendly: chaque bucket porte tag `tenant-id`, log Pino structure inclut `tenantId`.
- Verification facile lors d'audit: `aws s3api list-buckets | grep tenant-X`.

### 13.4 CNDP Recommandation 5/2020 (chiffrement at-rest)

> "La CNDP recommande le chiffrement at-rest des donnees personnelles avec des cles gerees par le responsable de traitement, distinctes des cles d'autres responsables."

Notre architecture garantit:
- SSE-KMS active sur tous les buckets (validation V14, V18).
- Cles distinctes par tenant (un tenant = un responsable de traitement = une cle).
- Rotation annuelle automatique activee (`EnableKeyRotationCommand`).
- Suppression cle planifiee 30 jours apres CNDP-purge.

### 13.5 Loi 09-08 article 7 (droit a l'oubli)

Pattern bucket-per-tenant simplifie le respect du delai legal de 30 jours pour l'eradication complete:
- Buckets `docs` et `photos`: purge en O(N keys) mais limites a un tenant, scope contained.
- Bucket `archive`: ne peut etre purge avant expiration retention COMPLIANCE; documente comme exception legale dans contrat preneur (Loi 43-20 prime sur Loi 09-08 droit a l'oubli pour archives signatures contractuelles).

### 13.6 Audit trail requirements

Chaque operation S3 logue via Pino avec champs minimum:
- `tenantId` (qui)
- `bucket`, `key`, `kind` (quoi)
- `actorId` (acteur humain ou systeme)
- `correlationId` (trace request E2E)
- `timestamp` (quand) - automatique Pino
- `result` (succes/echec, code erreur si applicable)

Integration future Tache 3.3.6 (audit log immutable Object Lock GOVERNANCE 5 ans).

## 14. Conventions absolues

1. **Aucune emoji** nulle part: code, commentaires, logs, messages erreur, metadata S3, tags, noms bucket/cle (decision-006). Validation V09.
2. **Aucun `console.log/debug/info/warn/error`** dans code prod (`*.ts` hors `*.spec.ts`). Toujours Pino. Validation V10.
3. **TypeScript strict**: pas de `any`, pas de `@ts-ignore`, pas de `as unknown as Foo` sauf cas justifies commentes. Validation V08.
4. **Region figee** `ma-benguerir-1`. Aucun fallback. Validation V15, V16.
5. **Bucket naming pattern strict**: `{prefix}-{env}-{tenantId}-{kind}`, max 63 chars, lowercase, hyphens uniquement. Validation V13.
6. **KMS alias pattern strict**: `alias/{prefix}-{env}-{tenantId}`. Validation V14.
7. **Object Lock toujours COMPLIANCE** pour archive, jamais GOVERNANCE. Validation V18.
8. **Object Lock retention >= 3651 jours** (Loi 43-20). Validation V17.
9. **Versioning ON** sur tous buckets a la creation. Validation V20.
10. **Public Access Block ON** sur tous buckets (block ACL public, block policy public, restrict). Validation V19.
11. **SSE-KMS obligatoire** sur tous PutObject (jamais SSE-S3 ni cleartext).
12. **Presigned URL TTL <= 3600s** en prod (configurable via env mais plafonne).
13. **Pas de cross-bucket cross-tenant**: `copyObject` accepte uniquement source et dest dans le meme tenant.
14. **Tag obligatoires sur bucket**: `tenant-id`, `env`, `kind`, `data-residency`, `compliance`. Validation V21, V22.
15. **Tests Vitest, jamais Jest**.
16. **Testcontainers pour integration MinIO** (jamais MinIO global partage CI).
17. **Zod pour validation runtime env**, jamais validation manuelle ad-hoc.
18. **Logger Pino structure JSON**, jamais string interpolation.
19. **Erreurs typees** heritant `S3MultiTenantError`, jamais `throw new Error()` brut.
20. **Documentation francais** dans commentaires (langue projet).

## 15. Validation pre-commit

Sequence complete avant tout commit:

```bash
set -euo pipefail
cd repo

echo "[1/7] Typecheck"
pnpm --filter @insurtech/docs typecheck

echo "[2/7] Lint"
pnpm --filter @insurtech/docs lint

echo "[3/7] Tests unitaires"
pnpm --filter @insurtech/docs vitest run --reporter=verbose --exclude="**/s3-integration.spec.ts"

echo "[4/7] Tests integration MinIO Testcontainers"
pnpm --filter @insurtech/docs vitest run src/services/s3-integration.spec.ts

echo "[5/7] Coverage >= 90%"
COVERAGE=$(pnpm --filter @insurtech/docs test:cov --silent | grep "All files" | awk '{print $4}' | tr -d '%')
if [ "$(echo "$COVERAGE < 90" | bc)" = "1" ]; then
  echo "Coverage insuffisant: $COVERAGE%"
  exit 1
fi

echo "[6/7] No emoji check"
if grep -RP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{1F600}-\x{1F64F}]' packages/docs/src/; then
  echo "Emoji detecte (decision-006 violation)"
  exit 1
fi

echo "[7/7] No console.log check"
if grep -RP '\bconsole\.(log|debug|info|warn|error)\b' packages/docs/src/ --include="*.ts" --exclude="*.spec.ts"; then
  echo "console.* detecte en prod (utiliser Pino)"
  exit 1
fi

echo "Toutes les validations passent"
```

## 16. Commit message complet

```
feat(docs): S3 multi-tenant buckets + KMS isolation + Object Lock COMPLIANCE archive

Sprint 10 / Tache 3.3.2 / Phase 3 Modules Horizontaux

Implemente le pattern bucket-per-tenant avec isolation cryptographique
KMS dediee par tenant et activation Object Lock COMPLIANCE pour le
bucket archive (Loi 43-20 art. 7, retention 3651 jours).

Services crees:
- S3MultiTenantService: upload, presigned URLs, copy, delete, ensureBucket idempotent
- KmsKeyManagerService: creation cle + alias + rotation annuelle, scheduleDeletion
- BucketLifecycleService: regles Glacier/DeepArchive cost-optimisees par kind
- ObjectLockComplianceService: activation COMPLIANCE 3651 jours, putRetention par objet

Configuration:
- Zod schema validation env vars (S3_*, KMS_*, ARCHIVE_*)
- Region figee ma-benguerir-1 (decision-008 data residency MA)
- Bucket prefix skalean-insurtech, pattern {prefix}-{env}-{tenantId}-{kind}
- Public Access Block + Versioning ON par defaut
- Tags compliance loi-09-08-loi-43-20 sur tous buckets

Infrastructure:
- Script setup-minio-dev.sh pour MinIO local developpement
- Module Terraform Atlas Cloud Services Benguerir provisionnant 3 buckets + cle KMS par tenant

Tests:
- 51 tests unitaires + integration (Vitest + Testcontainers MinIO)
- T54 verifie isolation cross-tenant
- T55 verifie rejet DeleteObject sur archive Object Lock COMPLIANCE
- Coverage >= 90% sur fichiers crees

Conformite:
- Loi 09-08 art. 24 (residency) art. 7 (droit oubli, sauf archive)
- Loi 43-20 art. 7 (archives signatures 10 ans + 1 jour)
- ACAPS Circulaire 2018/01 (segregation tenants)
- CNDP Recommandation 5/2020 (chiffrement at-rest cles distinctes)

Decisions architecturales: decision-006, decision-008, decision-012, decision-019, decision-021

Refs: SPRINT-10/TASK-3.3.2
Closes: SK-INS-1042
Reviewed-by: Tech Lead, DPO, Legal
```

## 17. Workflow next step

Cette tache est un prerequis dur pour:

- **Tache 3.3.3** (signature trail Object Lock writer): utilisera `S3MultiTenantService.uploadDocument(tenantId, key, body, mimeType, { kind: BucketKind.ARCHIVE })` et `ObjectLockComplianceService.putRetentionOnObject` pour ecrire les preuves d'integrite des signatures electroniques (PDF + manifest JSON + chaine d'horodatage RFC 3161).

- **Tache 3.3.4** (CNDP purge tenant): consommera `S3MultiTenantService` pour orchestrer la suppression complete des buckets `docs` et `photos`, puis `KmsKeyManagerService.scheduleDeletion(tenantId, 30)` pour planifier la suppression KMS. Bucket archive ne sera purge qu'apres expiration retention COMPLIANCE (procedure exceptionnelle).

- **Tache 3.4.x** (export ACAPS quotidien): listera tous les objets bucket archive de la veille pour generer le rapport ACAPS quotidien chiffre.

- **Tache 5.1.x** (frontend upload direct): consommera `S3MultiTenantService.getPresignedPutUrl` pour permettre upload front-end direct vers S3, contournant l'API backend pour les gros fichiers (photos sinistres > 10MB).

- **Tache 7.2.x** (monitoring Prometheus): scrapera metriques operations S3 (upload count, size, latency p95, erreurs par tenant) injectees via decorateurs `@PrometheusCounter` autour des methodes du `S3MultiTenantService` (a ajouter en wrapper).

Apres merge de cette tache, l'equipe Backend peut paralleliser:
- Backend Lead -> Tache 3.3.3 (signature trail)
- Backend Lead Junior -> Tache 3.3.4 (CNDP purge)
- DevOps Lead -> Provisioning Terraform staging avec 3 tenants pilotes (CNIA, Saham, Atlanta)

La revue par le DPO (Data Protection Officer) et Legal est OBLIGATOIRE avant deploiement staging. Un PR template specifique inclut une checklist conformite a cocher (loi-09-08, loi-43-20, ACAPS, CNDP).

Documentation Confluence a mettre a jour suite merge:
- Page "Architecture S3 Multi-Tenant" avec diagramme section 4.1
- Runbook "Onboarding nouveau tenant" avec sequence creation cle KMS + 3 buckets
- Runbook "Purge CNDP tenant" avec procedure differenciee docs/photos vs archive
- Runbook "Rotation KMS" (annuelle automatique, monitoring)
- Page DPO "Registre des traitements" mise a jour avec mention KMS per-tenant
