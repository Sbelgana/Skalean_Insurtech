# META-PROMPT B-10 -- SPRINT 10 DOCS + SIGNATURE LOI 43-20

**Version** : v2.2 (Option B)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 10 / 35 (cumul) -- Phase 3 Sprint 3
**Position** : Apres Comm WA+Email, avant Pay
**Numerotation taches** : 3.3.1 a 3.3.13
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (bloquant signature electronique conformite + storage docs critique)

---

## Objectif Global du Sprint

Implementer **gestion documents + signature electronique conforme loi 43-20** : storage S3-compatible Atlas Cloud Services Object Storage Benguerir (cloud souverain MA -- ACAPS et Barid deja clients -- decision-008), versioning documents, generation PDF (devis/factures/polices), integration **Barid eSign** (e-signature ANRT certifiee Maroc), horodatage qualifie ANRT, hash SHA-256 audit trail immutable, archive scellee 10 ans (retention legale).

A la sortie de ce sprint :
- 6 entites operationnelles : `doc_documents`, `doc_versions`, `doc_access_logs`, `sig_signing_workflows`, `sig_audit_trails`, `sig_archives`
- Storage S3 multi-tenant (1 bucket par tenant en prod, isolation stricte)
- Presigned URLs pour acces public assure (token-based, TTL court)
- PDF generation via puppeteer (4 templates : devis/facture/police/sinistre-rapport)
- Integration Barid eSign workflow : send -> sign -> archive
- Horodatage qualifie ANRT applique apres signature
- Hash SHA-256 + audit trail immutable preuve juridique
- Endpoint public verification document `/api/v1/public/verify-doc/:hash` (RGS niveau 2)
- Archive scellee : retention 10 ans + 1 jour (loi 43-20), bucket dedie immutable WORM
- 40+ tests E2E avec mock Barid eSign

---

## Frontiere du Sprint

**INCLUS** :
- Documents CRUD + versions
- S3 multi-tenant + presigned URLs + access logs
- PDF generation (4 templates initiaux)
- Signing workflow Barid eSign (envoi, suivi, completion)
- Hash SHA-256 documents
- Horodatage qualifie ANRT
- Audit trail immutable (sig_audit_trails)
- Archive scellee bucket dedie
- Public verification endpoint
- Tests E2E avec mocks

**EXCLU** (sera ajoute aux sprints suivants) :
- Templates documents specifiques Insure (Sprint 14+)
- Templates documents specifiques Repair (Sprint 20+)
- DocuSign (alternative international, pas dans MVP MA)
- OCR documents scannes (Phase 7+)
- IA-powered docs analysis (Sprint 30+ defere)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` -- 3 tables docs + 3 tables sig (Sprint 2)
2. `00-pilotage/documentation/2-variables-environnement.env` -- S3_*, BARID_ESIGN_*, ANRT_*
3. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- conformite loi 43-20 + 09-08
4. Sortie Sprint 1 : MinIO local + S3 client (`@insurtech/shared-utils/s3`)
5. Sortie Sprint 7 : RBAC permissions docs + signature
6. Sortie Sprint 9 : Comm orchestrator pour notifications signing

---

## Stack Imposee (Sprint 10)

| Composant | Version | Notes |
|-----------|---------|-------|
| @aws-sdk/client-s3 | 3.700.0 | S3 client Atlas Cloud Services / MinIO compat |
| @aws-sdk/s3-request-presigner | 3.700.0 | presigned URLs |
| puppeteer | 24.0.1 | PDF generation HTML -> PDF |
| sharp | 0.33.5 | image processing (thumbnails) |
| node-rsa | 1.1.1 | manipulation cles RSA (pour ANRT timestamp) |

Variables env nouvelles : `BARID_ESIGN_API_BASE_URL`, `BARID_ESIGN_API_KEY`, `BARID_ESIGN_WEBHOOK_SECRET`, `ANRT_TIMESTAMP_TSA_URL`, `ANRT_TIMESTAMP_CLIENT_CERT_PATH`, `S3_ARCHIVE_BUCKET` (immutable WORM).

---

## Vue d'Ensemble des 13 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 3.3.1 | Entities documents + versions enrichies + schemas Zod | 4h | P0 | Sprint 9 |
| 3.3.2 | S3 client Casablanca + KMS + multi-tenant buckets isolation | 6h | P0 | 3.3.1 |
| 3.3.3 | DocumentService (CRUD + presigned URLs + retention) | 6h | P0 | 3.3.2 |
| 3.3.4 | AccessLogService (track who downloaded what when) | 4h | P0 | 3.3.3 |
| 3.3.5 | PdfGeneratorService + 4 templates (devis, facture, police, sinistre-rapport) | 7h | P0 | 3.3.4 |
| 3.3.6 | sig_signing_workflows entity + SigningWorkflowService | 7h | P0 | 3.3.5 |
| 3.3.7 | Barid eSign API client + workflow envoi | 6h | P0 | 3.3.6 |
| 3.3.8 | Hash SHA-256 + horodatage qualifie ANRT (TSA RFC 3161) | 4h | P0 | 3.3.7 |
| 3.3.9 | Webhook receiver Barid eSign (signature complete callback) | 5h | P0 | 3.3.8 |
| 3.3.10 | sig_audit_trails immutable + AuditTrailService | 4h | P0 | 3.3.9 |
| 3.3.11 | Public verify controller (verification document via hash) | 4h | P0 | 3.3.10 |
| 3.3.12 | SealedArchiveService (bucket WORM 10 ans + 1 jour) | 5h | P0 | 3.3.11 |
| 3.3.13 | Tests E2E (40+) avec mock Barid eSign + ANRT TSA + seeds | 8h | P0 | 3.3.12 |

**Total** : 70 heures.

---

# DETAIL DES 13 TACHES

---

## Tache 3.3.1 -- Entities Documents + Versions Enrichies

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 4h / Depend de Sprint 9

**But** : Enrichir entities `doc_documents` + `doc_versions` (Sprint 2 deja migration) avec types TypeScript complete + schemas Zod CRUD.

**Livrables checkables** :
- [ ] Entity `repo/packages/docs/src/entities/doc-document.entity.ts`
- [ ] Entity `repo/packages/docs/src/entities/doc-version.entity.ts` (append-only)
- [ ] Enum `DocumentType` : `'devis' | 'facture' | 'police' | 'avenant' | 'sinistre' | 'kyc' | 'contrat' | 'autre'`
- [ ] Enum `DocumentStatus` : `'draft' | 'final' | 'pending_signature' | 'signed' | 'archived'`
- [ ] Schemas Zod :
  - `CreateDocumentSchema` : type + title + related_resource_type/id (optional) + file (multipart)
  - `UpdateDocumentSchema` (status final only)
  - `DocumentFiltersSchema`
- [ ] Computed `retention_until` : auto-calcule selon type document (police signed : 10 ans + 1 jour, devis : 5 ans, etc.)
- [ ] Cascade : delete document -> delete versions (mais soft delete preserve)
- [ ] Tests : entity hydrate + retention calcul + Zod reject invalid

**Pattern critique : retention rules par type**

```typescript
// repo/packages/docs/src/services/retention-rules.service.ts
export const RETENTION_RULES_DAYS: Record<DocumentType, number> = {
  devis: 5 * 365 + 1,                  // 5 ans + 1 jour (commercial)
  facture: 10 * 365 + 1,                // 10 ans + 1 jour (fiscal MA)
  police: 10 * 365 + 1,                  // 10 ans + 1 jour apres expiration (loi assurance MA)
  avenant: 10 * 365 + 1,                 // idem police
  sinistre: 10 * 365 + 1,                // 10 ans apres cloture
  kyc: 5 * 365 + 1,                      // 5 ans apres relation business (CNDP)
  contrat: 10 * 365 + 1,
  autre: 5 * 365 + 1,                    // default 5 ans
};
```

**Fichiers crees / modifies** :
```
repo/packages/docs/src/entities/doc-document.entity.ts                  # ~50 lignes
repo/packages/docs/src/entities/doc-version.entity.ts                    # ~35 lignes
repo/packages/docs/src/schemas/document.schema.ts                        # ~70 lignes
repo/packages/docs/src/services/retention-rules.service.ts               # ~50 lignes
repo/packages/docs/src/types/document-type.enum.ts                       # ~15 lignes
```

**Notes implementation** :
- `retention_until` set au moment status='signed' (pas a creation -- evite calcul errone)
- Versions append-only : pas de DELETE (preserve traces modifications)
- `sha256` computed a chaque upload (ou re-upload version)
- `mime_type` valide (whitelist : pdf, docx, jpg, png) -- security

**Criteres validation** :
- V1 (P0) : Entity hydrate
- V2 (P0) : Schema Zod create reject invalid
- V3 (P0) : Retention rules : police signed = 10 ans + 1 jour
- V4 (P0) : Cascade delete preserve audit
- V5 (P1) : Tests 6+ scenarios

---

## Tache 3.3.2 -- S3 Client Casablanca + KMS + Multi-Tenant Buckets

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 6h / Depend de 3.3.1

**But** : Etendre `@insurtech/shared-utils/s3` (Sprint 1) avec multi-tenant buckets isolation, KMS encryption (prod), retention policies S3.

**Contexte** : Data residency loi 09-08 = stockage MA. Atlas Cloud Services Object Storage Benguerir (DC1 Tier III + DC2 Tier IV). En dev MinIO simule. **1 bucket par tenant** (vs 1 bucket partage avec prefixes) : isolation maximum + facilite purge tenant CNDP (delete bucket entier).

**Livrables checkables** :
- [ ] Service `repo/packages/docs/src/services/s3-multitenant.service.ts`
- [ ] Methods :
  - `getBucketName(tenantId): string` -- pattern `skalean-insurtech-{env}-{tenant_id}-docs`
  - `ensureBucket(tenantId): Promise<void>` -- cree bucket si manque (au tenant onboarding Sprint 6 update)
  - `uploadDocument(tenantId, key, body, mimeType): Promise<{ key, etag }>`
  - `getDocument(tenantId, key): Promise<{ body, mimeType }>`
  - `deleteDocument(tenantId, key): Promise<void>` -- soft only (versioned bucket S3)
  - `getPresignedUrl(tenantId, key, expiresInSec): Promise<string>` -- TTL max 1h prod
  - `listDocuments(tenantId, prefix): Promise<S3Object[]>`
- [ ] Bucket configuration prod :
  - Versioning ENABLED (preserve history)
  - Encryption SSE-KMS avec cle dediee per tenant
  - Lifecycle : Glacier apres 1 an (cold storage, cost optimize)
  - Public access BLOCKED (presigned URLs only)
- [ ] Bucket archive separe : `skalean-insurtech-{env}-{tenant_id}-archive` :
  - Object Lock COMPLIANCE mode (immutable, meme par admin)
  - Retention 10 ans + 1 jour (loi 43-20)
- [ ] Bucket photos separe : `skalean-insurtech-{env}-{tenant_id}-photos` :
  - Public read autorise (presigned URLs publics, sans auth pour assures)
  - Lifecycle : Glacier apres 6 mois
- [ ] KMS integration : key per tenant `alias/skalean-insurtech-{env}-{tenant_id}` (Sprint 35 prod)
- [ ] Tests : create bucket, upload + download roundtrip, presigned URL TTL, isolation tenants

**Pattern critique : multi-tenant bucket pattern**

```typescript
// repo/packages/docs/src/services/s3-multitenant.service.ts
@Injectable()
export class S3MultiTenantService {
  private s3: S3Client;

  getBucketName(tenantId: string, kind: 'docs' | 'photos' | 'archive' = 'docs'): string {
    const env = process.env.NODE_ENV ?? 'development';
    return `skalean-insurtech-${env}-${tenantId}-${kind}`;
  }

  async uploadDocument(tenantId: string, key: string, body: Buffer, mimeType: string): Promise<{ key: string; etag: string }> {
    const Bucket = this.getBucketName(tenantId, 'docs');
    const result = await this.s3.send(new PutObjectCommand({
      Bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: `alias/skalean-insurtech-${process.env.NODE_ENV}-${tenantId}`,
      Metadata: {
        'tenant-id': tenantId,
        'uploaded-at': new Date().toISOString(),
      },
    }));
    return { key, etag: result.ETag! };
  }

  async getPresignedUrl(tenantId: string, key: string, expiresInSec: number = 3600): Promise<string> {
    if (expiresInSec > 3600) throw new Error('TTL max 1h prod');
    const command = new GetObjectCommand({
      Bucket: this.getBucketName(tenantId, 'docs'),
      Key: key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: expiresInSec });
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/docs/src/services/s3-multitenant.service.ts                  # ~250 lignes
repo/packages/docs/src/services/s3-multitenant.service.spec.ts             # ~180 lignes
repo/packages/docs/src/services/bucket-lifecycle.service.ts                 # ~120 lignes (Glacier rules)
repo/apps/api/src/modules/tenant/services/tenant-onboarding.service.ts     # update : ensureBucket onboarding
```

**Notes implementation** :
- Pattern bucket-per-tenant : isolation stricte (purge facile : delete bucket entier)
- Object Lock COMPLIANCE mode archive : meme admin AWS ne peut pas delete avant retention expire
- KMS key per tenant : si compromission cle X, autres tenants safe
- Presigned URL TTL max 1h : eviter URLs long-lived en clair
- Versioning : restore possible si user delete par erreur
- MinIO dev : simule comportement (sans KMS reel)

**Criteres validation** :
- V1 (P0) : Bucket cree au tenant onboarding
- V2 (P0) : Upload + download roundtrip OK
- V3 (P0) : Multi-tenant isolation : tenant A bucket pas accessible depuis tenant B
- V4 (P0) : Presigned URL TTL 1h respecte (refuse > 1h)
- V5 (P0) : 3 buckets per tenant (docs, photos, archive)
- V6 (P0) : Versioning enabled prod
- V7 (P0) : Object Lock archive bucket (immutable)
- V8 (P1) : Tests 12+ scenarios

---

## Tache 3.3.3 -- DocumentService (CRUD + Presigned URLs + Retention)

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 6h / Depend de 3.3.2

**But** : Service NestJS metier orchestrant DocumentEntity + S3MultiTenant + KafkaPublisher + AuditLog. CRUD complete + helpers.

**Livrables checkables** :
- [ ] Service `repo/packages/docs/src/services/document.service.ts`
- [ ] Methods :
  - `create(file, metadata, userId): Promise<Document>` -- compute hash, upload S3, INSERT row, audit log
  - `findById(id): Promise<Document>` (RLS auto)
  - `findAll(filters, pagination)` (filtres : type, status, related_resource, search)
  - `update(id, metadata)` (status transitions valides only)
  - `softDelete(id, userId)` (deleted_at, ne supprime pas S3 -- versioning preserve)
  - `getDownloadUrl(id, ttl): Promise<string>` -- presigned URL + log access
  - `addVersion(documentId, file, changeSummary, userId): Promise<DocumentVersion>` -- nouveau version, increment version_number
  - `getVersions(documentId): Promise<DocumentVersion[]>`
  - `markFinal(documentId)` -- transition draft -> final
  - `markSigned(documentId, signatureMetadata)` -- transition pending_signature -> signed (Tache 3.3.6 utilise)
- [ ] Endpoint controller `documents.controller.ts` :
  - `POST /api/v1/docs` (multipart upload max 10MB)
  - `GET /api/v1/docs` (filtres + pagination)
  - `GET /api/v1/docs/:id`
  - `GET /api/v1/docs/:id/download` (presigned URL retournee, redirect 302)
  - `PATCH /api/v1/docs/:id` (status, title)
  - `DELETE /api/v1/docs/:id` (soft delete)
  - `GET /api/v1/docs/:id/versions`
  - `POST /api/v1/docs/:id/versions` (multipart, new version)
- [ ] Multipart parser Fastify `@fastify/multipart`
- [ ] Hash SHA-256 compute on upload
- [ ] MIME type whitelist : pdf, docx, jpg, jpeg, png (rejette autres pour security)
- [ ] Permissions : `docs.documents.create/read/update/delete`
- [ ] Audit + Kafka events `doc.document_created/updated/deleted/signed`
- [ ] Tests integration : upload + download + versions + RBAC + multi-tenant

**Fichiers crees / modifies** :
```
repo/packages/docs/src/services/document.service.ts                       # ~350 lignes
repo/packages/docs/src/services/document.service.spec.ts                  # ~250 lignes
repo/apps/api/src/modules/docs/controllers/documents.controller.ts        # ~200 lignes
repo/apps/api/src/modules/docs/dto/document.dto.ts                         # createZodDto
repo/apps/api/test/docs/documents.e2e-spec.ts                              # tests E2E
repo/apps/api/package.json                                                  # add : @fastify/multipart
```

**Notes implementation** :
- Hash compute en stream (vs full buffer) pour gros fichiers (PDF 5MB OK)
- Status transitions strictes : draft -> final, draft -> pending_signature -> signed, * -> archived
- Versioning S3 + DB versions : redondance pour preservation
- Soft delete : preserve audit + permet restore (Sprint 27 admin)
- Permissions ABAC OwnResources : created_by check pour read_own

**Criteres validation** :
- V1 (P0) : POST upload OK + S3 + DB row
- V2 (P0) : Hash SHA-256 compute correct (verifier reproductible)
- V3 (P0) : MIME type non whitelist rejete 400
- V4 (P0) : GET /download retourne presigned URL
- V5 (P0) : Versioning : addVersion increment version_number
- V6 (P0) : Status transitions invalides rejetes
- V7 (P0) : Multi-tenant isolation
- V8 (P0) : Audit + Kafka events
- V9 (P0) : Tests E2E 12+ scenarios

---

## Tache 3.3.4 -- AccessLogService (Track Who Downloaded What When)

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 4h / Depend de 3.3.3

**But** : Tracking append-only de tous acces documents (view, download, share) pour audit + compliance + detection abus.

**Livrables checkables** :
- [ ] Service `repo/packages/docs/src/services/access-log.service.ts`
- [ ] Methods :
  - `logView(documentId, userId, ip, ua)`
  - `logDownload(documentId, userId, ip, ua)` -- async (ne ralentit pas user)
  - `logShare(documentId, userId, sharedWithEmail, ip)` -- email partage
  - `findByDocument(documentId, pagination)` -- audit timeline
  - `findByUser(userId, dateRange)` -- detection abus user
- [ ] Append-only : pas UPDATE / DELETE (table `doc_access_logs` Sprint 2)
- [ ] Trigger automatique :
  - GET /docs/:id (view) : log async via interceptor
  - GET /docs/:id/download (download) : log avant redirect presigned URL
- [ ] Endpoint admin : `GET /api/v1/admin/docs/access-logs?document_id=...&user_id=...&date_range=...`
- [ ] Detection abus : > 100 downloads / heure same user -> Kafka event `audit.suspicious_access` + alert (Sprint 33)
- [ ] Permissions : `docs.access_logs.read` (admin uniquement par defaut)
- [ ] Tests : log create, query timeline, detection abus

**Fichiers crees / modifies** :
```
repo/packages/docs/src/services/access-log.service.ts                     # ~150 lignes
repo/packages/docs/src/services/access-log.service.spec.ts                # ~120 lignes
repo/apps/api/src/modules/docs/interceptors/log-document-access.interceptor.ts # ~80 lignes
repo/apps/api/src/modules/admin/controllers/admin-access-logs.controller.ts # ~100 lignes
```

**Notes implementation** :
- Logging async (BullMQ job) : eviter ralentir user response time
- Indexation `(document_id, created_at DESC)` : query timeline performante
- Detection abus : sliding window 1h via Redis (key `access_count:user:{userId}` increment + TTL)
- Permissions : access_logs lecture sensible (audit), admin only

**Criteres validation** :
- V1 (P0) : View access logged
- V2 (P0) : Download access logged
- V3 (P0) : Append-only (pas UPDATE/DELETE)
- V4 (P0) : Detection abus 100/h emit alert
- V5 (P0) : Admin endpoint retourne logs
- V6 (P0) : Logging async (response time pas degrade)
- V7 (P1) : Tests 8+ scenarios

---

## Tache 3.3.5 -- PdfGeneratorService + 4 Templates Initiaux

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 7h / Depend de 3.3.4

**But** : Service generation PDF via puppeteer (HTML -> PDF) avec 4 templates initiaux : devis, facture, police, sinistre-rapport.

**Livrables checkables** :
- [ ] Service `repo/packages/docs/src/services/pdf-generator.service.ts`
- [ ] Method `generate(templateName, locale, data): Promise<Buffer>` -- retourne PDF buffer
- [ ] Method `generateAndSave(templateName, locale, data, metadata): Promise<Document>` -- shortcut : genere + upload S3 + INSERT row
- [ ] Templates Handlebars dans `repo/packages/docs/src/templates/{templateName}.hbs` :
  - `devis.hbs` : header tenant + items table + total HT/TVA/TTC + footer ICE/RC
  - `facture.hbs` : numero facture + customer details + items + totals + signature space
  - `police.hbs` : police number + souscripteur + garanties + primes + conditions generales
  - `sinistre-rapport.hbs` : sinistre details + photos embeddees + estimation + decision
- [ ] Templates 3 locales (fr / ar-MA / ar) avec RTL support
- [ ] Layout shared : header logo Skalean (ou tenant branding) + footer (numero page, date generation)
- [ ] Embedded resources : logos, fonts, images en base64 (pas de external URLs)
- [ ] Performance : generation < 3s par PDF
- [ ] Cache compiled templates (eviter re-compile chaque appel)
- [ ] Helpers Handlebars : `formatDate`, `formatCurrency`, `formatPhone`, `qrCode(data)` (pour verification ulterieure)
- [ ] Tests : generation 4 templates 3 locales = 12 outputs verifies (snapshot tests)

**Pattern critique : puppeteer PDF generation**

```typescript
// repo/packages/docs/src/services/pdf-generator.service.ts
import puppeteer, { Browser } from 'puppeteer';
import handlebars from 'handlebars';

@Injectable()
export class PdfGeneratorService implements OnModuleDestroy {
  private browser: Browser | null = null;

  async generate(templateName: string, locale: string, data: Record<string, unknown>): Promise<Buffer> {
    // 1. Compile template (cache)
    const template = await this.compileTemplate(templateName, locale);
    const html = template(data);

    // 2. Lazy launch browser (singleton)
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }

    // 3. Generate PDF
    const page = await this.browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      });
      return pdf;
    } finally {
      await page.close();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) await this.browser.close();
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/docs/src/services/pdf-generator.service.ts                  # ~250 lignes
repo/packages/docs/src/services/pdf-generator.service.spec.ts             # ~150 lignes
repo/packages/docs/src/templates/_layout.hbs                              # ~150 lignes (header + footer)
repo/packages/docs/src/templates/devis.hbs                                # ~200 lignes
repo/packages/docs/src/templates/facture.hbs                              # ~200 lignes
repo/packages/docs/src/templates/police.hbs                               # ~250 lignes (conditions generales)
repo/packages/docs/src/templates/sinistre-rapport.hbs                     # ~180 lignes
repo/packages/docs/src/templates/{ar,ar-MA}/{4 templates}                  # versions RTL
repo/packages/docs/src/helpers/handlebars-pdf-helpers.ts                  # ~100 lignes
repo/packages/docs/package.json                                           # add : puppeteer
```

**Notes implementation** :
- Browser singleton : reutilise instance entre calls (puppeteer slow startup)
- onModuleDestroy : cleanup browser au shutdown app
- Helpers : qrCode embed pour verification publique (Tache 3.3.11)
- Locale RTL : `<html dir="rtl">` + CSS adjustments
- A4 standard MA : 20mm margins
- Performance : < 3s par PDF (acceptable, peut etre offload BullMQ si gros volumes)

**Criteres validation** :
- V1 (P0) : generate(devis, fr, data) retourne PDF Buffer valide
- V2 (P0) : 4 templates fonctionnent
- V3 (P0) : 3 locales fr/ar-MA/ar
- V4 (P0) : RTL applique pour ar/ar-MA
- V5 (P0) : Performance < 3s
- V6 (P0) : Helpers (formatDate, formatCurrency, qrCode) fonctionnent
- V7 (P0) : Snapshot tests 12 outputs (4 templates x 3 locales)
- V8 (P0) : Embedded fonts/logos (pas URLs externes)
- V9 (P1) : Browser singleton + cleanup OK

---

## Tache 3.3.6 -- sig_signing_workflows Entity + SigningWorkflowService

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 7h / Depend de 3.3.5

**But** : Migration table `sig_signing_workflows` + service orchestrating workflow signature : initiate -> send to signer -> wait -> complete -> archive.

**Livrables checkables** :
- [ ] Migration TypeORM : table `sig_signing_workflows` :
  - id, tenant_id, document_id (FK), provider (enum 'barid_esign' | 'docusign' | 'manual'), provider_workflow_id, status (enum 'draft' | 'sent' | 'in_progress' | 'completed' | 'declined' | 'expired'), signers (jsonb : array), signature_order (enum 'parallel' | 'sequential'), expires_at, sent_at, completed_at, completed_document_url, completion_certificate_url, audit_trail_url (jsonb references docs), created_by, created_at, updated_at
- [ ] Entity correspondante
- [ ] Service `repo/packages/signature/src/services/signing-workflow.service.ts` :
  - `createWorkflow(documentId, signers, options): Promise<SigningWorkflow>` -- creates workflow draft
  - `sendForSignature(workflowId): Promise<void>` -- transition draft -> sent + provider API call (Tache 3.3.7)
  - `getStatus(workflowId): Promise<{ status, signers_status[] }>` -- pull provider for updates
  - `cancel(workflowId, reason): Promise<void>`
  - `markCompleted(workflowId, completedDocUrl, auditTrailUrl)` -- callback receiver appelle
  - `markDeclined(workflowId, signerId, reason)`
- [ ] Endpoints controller :
  - `POST /api/v1/signature/workflows` (create)
  - `GET /api/v1/signature/workflows` (list)
  - `GET /api/v1/signature/workflows/:id` (status)
  - `POST /api/v1/signature/workflows/:id/send` (initiate provider)
  - `POST /api/v1/signature/workflows/:id/cancel`
  - `GET /api/v1/signature/workflows/:id/audit-trail` (download trail)
- [ ] Signers structure : `[{ name, email, phone, role: 'signer' | 'approver', order: 1 }]`
- [ ] expires_at : default 7 jours, configurable
- [ ] Status transitions strict
- [ ] Audit + Kafka events `signature.workflow_created/sent/completed/declined/expired`
- [ ] Permissions : `signature.workflows.create/read/cancel`
- [ ] Tests : full workflow + transitions + cancel

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-SigningWorkflows.ts             # ~80 lignes
repo/packages/signature/src/entities/sig-signing-workflow.entity.ts          # ~60 lignes
repo/packages/signature/src/services/signing-workflow.service.ts              # ~300 lignes
repo/packages/signature/src/services/signing-workflow.service.spec.ts         # ~200 lignes
repo/apps/api/src/modules/signature/controllers/workflows.controller.ts       # ~180 lignes
repo/apps/api/test/signature/workflows.e2e-spec.ts                            # tests E2E
```

**Notes implementation** :
- Provider abstraction : facile swap Barid eSign vs DocuSign (international, pas MVP)
- Sequential vs parallel signers : workflow order
- expires_at : auto-cron job marque expire si pas signe (Tache 3.3.13 setup)
- Signature_order sequential : envoi notification au signer suivant uniquement apres precedent signe
- completed_document_url : PDF signe par tous + horodate (provider retourne URL)

**Criteres validation** :
- V1 (P0) : Migration creee
- V2 (P0) : createWorkflow stocke signers JSONB
- V3 (P0) : Status transitions valides only
- V4 (P0) : Sequential : signer 2 notifie apres signer 1 sign
- V5 (P0) : expires_at auto-set 7 jours
- V6 (P0) : Audit + Kafka events
- V7 (P0) : Tests 10+ scenarios

---

## Tache 3.3.7 -- Barid eSign API Client + Workflow Envoi

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 6h / Depend de 3.3.6

**But** : Client Barid eSign integration : workflow envoi document avec signers + tracking + completion callback.

**Contexte** : **Barid eSign** est le service e-signature operate par Barid Al-Maghrib (Poste Maroc). Conforme **loi 43-20** + **certificat ANRT** valant signature manuscrite. C'est l'option MA-native standard. API REST documentee.

**Livrables checkables** :
- [ ] Service `repo/packages/signature/src/providers/barid-esign/barid-esign.client.ts`
- [ ] Methods :
  - `createSignatureRequest(document, signers, options): Promise<{ workflow_id, sign_urls[] }>` -- creates session + retourne URLs signers
  - `getRequestStatus(workflowId): Promise<{ status, signers_status[] }>` -- poll status
  - `cancelRequest(workflowId): Promise<void>`
  - `downloadCompletedDocument(workflowId): Promise<Buffer>` -- PDF signe + horodate
  - `downloadAuditTrail(workflowId): Promise<Buffer>` -- audit trail PDF Barid
- [ ] Authentification : API key bearer (env `BARID_ESIGN_API_KEY`)
- [ ] HTTP client undici avec retry exponential
- [ ] Error handling : `BaridUnavailableError`, `BaridInvalidSignerError`, `BaridSignatureExpiredError`
- [ ] Mock client `MockBaridEsignClient` pour tests
- [ ] Tests integration via mock

**Pattern critique : Barid eSign API request**

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-esign.client.ts
@Injectable()
export class BaridEsignClient {
  async createSignatureRequest(
    document: { content: Buffer; filename: string; mimeType: string },
    signers: Array<{ name: string; email: string; phone: string; order: number }>,
    options: { expiresInDays: number; signatureType: 'simple' | 'advanced' | 'qualified' },
  ): Promise<{ workflow_id: string; sign_urls: string[] }> {
    const response = await fetch(`${BARID_BASE_URL}/api/v1/signature-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.BARID_ESIGN_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        document: {
          filename: document.filename,
          mime_type: document.mimeType,
          content_base64: document.content.toString('base64'),
        },
        signers: signers.map(s => ({
          name: s.name, email: s.email, phone: s.phone,
          order: s.order, role: 'signer',
        })),
        signature_type: options.signatureType, // 'qualified' = ANRT certificat -> loi 43-20 conforme
        expires_at: addDays(new Date(), options.expiresInDays).toISOString(),
        callback_url: `${env.API_BASE_URL}/api/v1/public/webhooks/barid-esign`,
        language: 'fr', // notifications signers
      }),
    });
    if (!response.ok) {
      const errBody = await response.json();
      throw this.normalizeError(response.status, errBody);
    }
    return response.json();
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/signature/src/providers/barid-esign/barid-esign.client.ts          # ~200 lignes
repo/packages/signature/src/providers/barid-esign/barid-esign.client.spec.ts     # ~150 lignes
repo/packages/signature/src/providers/barid-esign/types.ts                        # ~60 lignes
repo/packages/signature/src/providers/barid-esign/errors.ts                       # ~30 lignes
repo/packages/signature/src/providers/barid-esign/mock-barid.client.ts            # ~120 lignes
```

**Notes implementation** :
- Signature type 'qualified' = ANRT certificate -> loi 43-20 valeur juridique signature manuscrite
- Document base64 dans body (PUT) : OK pour < 10MB, sinon multipart upload
- callback_url : Barid POST a notre webhook quand signature complete (Tache 3.3.9)
- Mock client : retourne workflow_id synthetic + permet tests sans cout reel
- API documentation Barid : a obtenir contact commercial Barid Al-Maghrib

**Criteres validation** :
- V1 (P0) : createSignatureRequest reussi (mock retourne workflow_id)
- V2 (P0) : Signers structure correcte
- V3 (P0) : Signature type qualified utilise
- V4 (P0) : Errors typed (Unavailable, InvalidSigner, etc.)
- V5 (P0) : Mock client comportement equivalent
- V6 (P0) : Tests integration via mock 10+ scenarios

---

## Tache 3.3.8 -- Hash SHA-256 + Horodatage Qualifie ANRT

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 4h / Depend de 3.3.7

**But** : Apres signature complete, applique horodatage qualifie ANRT (Time Stamping Authority RFC 3161) sur hash document signe, prouvant date precise + integrite.

**Contexte** : ANRT (Agence Nationale Reglementation Telecommunications) opere une TSA (Time Stamping Authority). RFC 3161 standard internationale. Apres signature Barid eSign, on applique additionnel horodatage ANRT pour double preuve juridique : signature + date opposable.

**Livrables checkables** :
- [ ] Service `repo/packages/signature/src/services/timestamp-anrt.service.ts`
- [ ] Method `applyTimestamp(documentBuffer): Promise<{ timestamp_token, applied_at, tsa_certificate }>` -- request TSA ANRT, retourne token RFC 3161
- [ ] Method `verifyTimestamp(token, documentBuffer): Promise<{ valid, applied_at, tsa_info }>` -- verify token + match document hash
- [ ] HTTP client TSA : URL `env.ANRT_TIMESTAMP_TSA_URL`, mTLS auth (client cert + key)
- [ ] Storage : column `sig_signing_workflows.tsa_timestamp_token` (text -- base64 RFC 3161 token), `tsa_applied_at` (timestamptz)
- [ ] Hash document : SHA-256 du PDF signe (apres Barid signature, avant archive)
- [ ] Cache TSA token : pas necessaire (token unique per document)
- [ ] Variables env : `ANRT_TIMESTAMP_TSA_URL`, `ANRT_TIMESTAMP_CLIENT_CERT_PATH`, `ANRT_TIMESTAMP_CLIENT_KEY_PATH`
- [ ] Tests : applyTimestamp mock retourne token, verifyTimestamp valide

**Pattern critique : RFC 3161 timestamp request**

```typescript
// repo/packages/signature/src/services/timestamp-anrt.service.ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

@Injectable()
export class TimestampAnrtService {
  async applyTimestamp(documentBuffer: Buffer): Promise<TimestampResult> {
    // 1. Compute SHA-256 hash
    const hash = createHash('sha256').update(documentBuffer).digest();

    // 2. Construct TimeStampReq (RFC 3161 format)
    // Note : library `node-timestamp-server-client` ou implement manually via ASN.1
    const tsRequest = this.buildTimeStampReq(hash);

    // 3. Send to TSA over mTLS
    const cert = await readFile(env.ANRT_TIMESTAMP_CLIENT_CERT_PATH);
    const key = await readFile(env.ANRT_TIMESTAMP_CLIENT_KEY_PATH);
    const response = await fetch(env.ANRT_TIMESTAMP_TSA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/timestamp-query' },
      body: tsRequest,
      // mTLS via undici Agent or fetch dispatcher
    });

    if (!response.ok) {
      throw new InternalServerErrorException({ code: 'ANRT_TSA_UNAVAILABLE' });
    }

    // 4. Parse TimeStampResp
    const tsResponse = Buffer.from(await response.arrayBuffer());
    const parsed = this.parseTimeStampResp(tsResponse);

    return {
      timestamp_token: tsResponse.toString('base64'),
      applied_at: parsed.genTime,
      tsa_certificate: parsed.certificate,
    };
  }

  // ... helpers ASN.1 manipulation
}
```

**Fichiers crees / modifies** :
```
repo/packages/signature/src/services/timestamp-anrt.service.ts                # ~250 lignes
repo/packages/signature/src/services/timestamp-anrt.service.spec.ts           # ~150 lignes
repo/packages/database/src/migrations/{date}-AddTsaTimestampColumns.ts         # add columns sig_signing_workflows
repo/packages/signature/package.json                                          # add : asn1.js (RFC 3161)
```

**Notes implementation** :
- RFC 3161 format ASN.1 : utiliser library asn1.js ou node-timestamp-server-client
- mTLS auth : client certificate emis par ANRT (process commercial)
- Performance : TSA call < 2s typiquement
- Variables env paths certificates : monte secrets Sprint 35 (Kubernetes secrets)
- Verification : applique a chaque retrieval document signe (legal proof)

**Criteres validation** :
- V1 (P0) : applyTimestamp retourne token + applied_at
- V2 (P0) : verifyTimestamp valid token retourne genTime correct
- V3 (P0) : verifyTimestamp tampered document retourne invalid
- V4 (P0) : mTLS auth utilise certs depuis env paths
- V5 (P0) : Tests integration mock TSA
- V6 (P0) : Storage columns sig_signing_workflows

---

## Tache 3.3.9 -- Webhook Receiver Barid eSign

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 5h / Depend de 3.3.8

**But** : Endpoint public recevant webhooks Barid eSign (signature complete, declined, expired) + signature HMAC verification + apply horodatage ANRT + transition workflow.

**Livrables checkables** :
- [ ] Controller `repo/apps/api/src/modules/signature/controllers/barid-webhook.controller.ts`
- [ ] Endpoint `POST /api/v1/public/webhooks/barid-esign` (public, signature verification)
- [ ] Verify HMAC SHA-256 signature header `X-Barid-Signature` (env `BARID_ESIGN_WEBHOOK_SECRET`)
- [ ] Idempotency : `comm_webhooks_received` pattern (Sprint 9) + idempotency_key
- [ ] Process events :
  - `signature.completed` : download signed PDF + apply ANRT timestamp + update workflow status='completed' + trigger archive (Tache 3.3.12)
  - `signature.declined` : update status + log reason + notification user
  - `signature.expired` : update status + cron deja peut detecter mais webhook ack
  - `signer.viewed` : log audit trail
  - `signer.signed` (intermediaire si sequential) : audit trail
- [ ] Process async via Kafka consumer (return 200 OK immediate to Barid)
- [ ] Logs structures + audit trail
- [ ] Tests : signature valid + invalid + idempotency + completion flow + ANRT timestamp applied

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/signature/controllers/barid-webhook.controller.ts        # ~120 lignes
repo/apps/api/src/modules/signature/middleware/barid-signature.middleware.ts        # ~60 lignes
repo/apps/api/src/modules/signature/consumers/barid-webhook-processor.consumer.ts   # ~250 lignes
repo/apps/api/test/signature/barid-webhook.e2e-spec.ts                              # tests
```

**Notes implementation** :
- Pattern similaire WA webhook Sprint 9 (signature HMAC + async via Kafka)
- ANRT timestamp applique APRES Barid completion (chain of trust : Barid signature -> ANRT timestamp)
- Trigger archive : Kafka event `signature.completed` -> SealedArchiveService consumer (Tache 3.3.12)
- Notification user : Kafka event -> Comm orchestrator (Sprint 9) sends email/WA confirmation

**Criteres validation** :
- V1 (P0) : Webhook signature_completed processed
- V2 (P0) : ANRT timestamp applique apres Barid completion
- V3 (P0) : Workflow status updated
- V4 (P0) : Notification user envoyee
- V5 (P0) : Signature HMAC validation
- V6 (P0) : Idempotency works
- V7 (P0) : Tests 10+ scenarios

---

## Tache 3.3.10 -- sig_audit_trails Immutable + AuditTrailService

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 4h / Depend de 3.3.9

**But** : Migration table append-only `sig_audit_trails` + service log toutes etapes signature : viewed, signed, declined, etc. Preuve juridique loi 43-20.

**Livrables checkables** :
- [ ] Migration TypeORM : table `sig_audit_trails` :
  - id, tenant_id, workflow_id (FK), event_type (enum 'workflow_created' | 'document_sent' | 'signer_viewed' | 'signer_signed' | 'signer_declined' | 'workflow_completed' | 'workflow_expired' | 'tsa_timestamp_applied'), signer_id (NULL si event systeme), signer_email, signer_ip, signer_user_agent, event_timestamp, evidence (jsonb : details specifiques), created_at -- **append-only, NO UPDATE NO DELETE**
- [ ] Service `repo/packages/signature/src/services/audit-trail.service.ts`
- [ ] Methods :
  - `logEvent(workflowId, eventType, details): Promise<void>` -- INSERT row
  - `getTrail(workflowId): Promise<AuditTrailEvent[]>` -- timeline complete
  - `generatePdfTrail(workflowId): Promise<Buffer>` -- export PDF audit trail (use PdfGenerator Tache 3.3.5)
- [ ] RLS active : tenant isolation
- [ ] No UPDATE policy, NO DELETE policy : append-only enforced DB-level
- [ ] Endpoint `GET /api/v1/signature/workflows/:id/audit-trail` (download PDF)
- [ ] Permissions : `signature.audit_trail.read`
- [ ] Tests : log event, generate PDF, immutable enforce

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-SigAuditTrails.ts                # ~50 lignes
repo/packages/signature/src/entities/sig-audit-trail.entity.ts                # ~40 lignes
repo/packages/signature/src/services/audit-trail.service.ts                    # ~150 lignes
repo/packages/docs/src/templates/audit-trail.hbs                               # template PDF audit
repo/apps/api/test/signature/audit-trail.e2e-spec.ts                            # tests
```

**Notes implementation** :
- Append-only DB-level : RLS policies SELECT + INSERT only, pas UPDATE pas DELETE
- Audit trail PDF : timeline events + signers identites + IPs + timestamps -> preuve juridique
- Generation PDF audit utilise PdfGeneratorService Sprint 10 (puppeteer)
- Tous events critiques workflow logged : preserve forensic audit

**Criteres validation** :
- V1 (P0) : Table cree append-only
- V2 (P0) : INSERT events fonctionne
- V3 (P0) : UPDATE / DELETE rejetes (no policy)
- V4 (P0) : getTrail retourne timeline
- V5 (P0) : generatePdfTrail produit PDF lisible
- V6 (P0) : RLS multi-tenant
- V7 (P0) : Tests 6+ scenarios

---

## Tache 3.3.11 -- Public Verify Controller (Verification Document via Hash)

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 4h / Depend de 3.3.10

**But** : Endpoint public permettant a qui que ce soit (juge, controleur ACAPS, client) verifier un document signe : "ce hash correspond-t-il a un document Skalean signe legitimement ?"

**Contexte** : Documents signes contiennent QR code (Tache 3.3.5 helper) avec URL de verification. Scan QR -> page web montre details signature : qui a signe, quand, hash valide. Conforme RGS niveau 2.

**Livrables checkables** :
- [ ] Controller `repo/apps/api/src/modules/signature/controllers/public-verify.controller.ts`
- [ ] Endpoint `GET /api/v1/public/verify-doc/:hash` (public, no auth, rate limited 60/h per IP) :
  - Lookup `doc_documents WHERE sha256 = $1`
  - Si trouve + status='signed' : retourne JSON public-safe
  - Si trouve mais status != signed : retourne "Document existant mais non signe"
  - Si pas trouve : retourne 404 "Document non reconnu"
- [ ] Response data publique :
  - document_id (anonymized public id)
  - document_type (devis/facture/police)
  - signed_at
  - tsa_timestamp_applied_at
  - signers_count (sans noms si pas opt-in)
  - hash (echo input)
- [ ] Page HTML simple : `GET /verify/:hash` retourne HTML simple avec details (alternative JSON)
- [ ] Audit log : verifications tracked (qui scan + quand)
- [ ] Detection abus : > 100 verif / IP / heure -> rate limit + Kafka event
- [ ] Permissions : aucune (public)
- [ ] Tests : verify valid hash + invalid hash + rate limit

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/signature/controllers/public-verify.controller.ts        # ~120 lignes
repo/packages/docs/src/templates/verify-page.hbs                                    # ~80 lignes (HTML)
repo/apps/api/test/signature/public-verify.e2e-spec.ts                              # tests
```

**Notes implementation** :
- Endpoint public : path-based dans /api/v1/public/* (Sprint 3 PublicEndpointGuard)
- Anonymized id : random publique non-correle au document_id internal (eviter enumeration)
- HTML page : bootstrap simple, montre signature details + logo Skalean
- QR code dans PDF Tache 3.3.5 : URL `https://api.skalean-insurtech.ma/verify/{hash}`
- Rate limit 60/h IP : @nestjs/throttler Sprint 3

**Criteres validation** :
- V1 (P0) : GET hash valide retourne details
- V2 (P0) : GET hash invalide retourne 404
- V3 (P0) : Document signed status retourne signing details
- V4 (P0) : Document draft status retourne "non signe"
- V5 (P0) : Rate limit actif 60/h per IP
- V6 (P0) : Audit log verifications
- V7 (P0) : Page HTML render OK
- V8 (P0) : Tests 8+ scenarios

---

## Tache 3.3.12 -- SealedArchiveService (Bucket WORM 10 Ans + 1 Jour)

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 5h / Depend de 3.3.11

**But** : Apres signature complete + ANRT timestamp, archive document dans bucket S3 dedie `*-archive` avec Object Lock COMPLIANCE mode (immutable 10 ans + 1 jour).

**Livrables checkables** :
- [ ] Service `repo/packages/signature/src/services/sealed-archive.service.ts`
- [ ] Method `archive(workflowId): Promise<{ archive_url, archive_hash, locked_until }>` :
  1. Download signed PDF from Barid (Tache 3.3.7) ou storage
  2. Compute archive metadata : audit_trail_pdf + tsa_token + signed_pdf
  3. Bundle dans manifest JSON : `{ document_hash, signers, signed_at, tsa_timestamp, audit_trail_url }`
  4. Upload to bucket archive avec Object Lock retention 10 ans + 1 jour
  5. Store reference dans `sig_archives` table
  6. Update workflow status='completed' + archived_at
- [ ] Migration TypeORM : table `sig_archives` (id, tenant_id, workflow_id, archive_bucket, archive_key, archive_sha256, locked_until, manifest_json, created_at)
- [ ] Bucket archive S3 (Tache 3.3.2 deja prepare) : Object Lock COMPLIANCE
- [ ] Methods auxiliaires :
  - `getArchive(workflowId): Promise<{ download_url, expires_at }>` -- presigned URL TTL 24h
  - `verifyArchiveIntegrity(workflowId): Promise<boolean>` -- compute hash actuel = stored hash
- [ ] Trigger via Kafka event `signature.workflow_completed` -> consumer
- [ ] Permissions : `signature.archive.read` (audit/compliance officer)
- [ ] Tests : archive flow complete + Object Lock immutable + integrity verification

**Fichiers crees / modifies** :
```
repo/packages/signature/src/services/sealed-archive.service.ts                  # ~200 lignes
repo/packages/database/src/migrations/{date}-SigArchives.ts                      # ~40 lignes
repo/packages/signature/src/entities/sig-archive.entity.ts                       # ~30 lignes
repo/apps/api/src/modules/signature/consumers/archive-on-completion.consumer.ts   # ~120 lignes
repo/apps/api/test/signature/sealed-archive.e2e-spec.ts                          # tests
```

**Notes implementation** :
- Object Lock COMPLIANCE mode : meme admin AWS root NE PEUT PAS delete pendant retention
- Retention 10 ans + 1 jour : loi 43-20 + buffer (eviter litige date precise)
- Manifest JSON dans bucket : auto-documenting archive content
- Integrity verification : permet detection alteration (improbable mais audit anti-corruption)
- Procedure CNDP purge tenant Sprint 6 : EXEMPTE archive bucket (legal preserve > GDPR forget)

**Criteres validation** :
- V1 (P0) : archive() reussit + bucket archive contient document
- V2 (P0) : Object Lock locked_until = signed_at + 10 ans + 1 jour
- V3 (P0) : Tentative DELETE archive object rejete (Object Lock)
- V4 (P0) : sig_archives row stocke metadata
- V5 (P0) : verifyArchiveIntegrity match hash
- V6 (P0) : Trigger via Kafka event automatique
- V7 (P0) : Tests 8+ scenarios

---

## Tache 3.3.13 -- Tests E2E Exhaustifs (40+) avec Mocks + Seeds

**Metadonnees** : Phase 3 / Sprint 10 / P0 / 8h / Depend de 3.3.12

**But** : Suite tests E2E avec mock Barid eSign + mock ANRT TSA + tests integration full workflow signature.

**Livrables checkables** :

**Tests E2E (40+)** :
- [ ] Documents : upload + download + versions + RBAC + multi-tenant (8 tests)
- [ ] PDF generation : 4 templates x 3 locales = 12 outputs verifies (snapshot tests)
- [ ] S3 multi-tenant : isolation, presigned URLs TTL, lifecycle (4 tests)
- [ ] Access logs : log download, detection abus (3 tests)
- [ ] Signing workflow : create + send + status + cancel (5 tests)
- [ ] Barid eSign : create signature request mock + status (3 tests)
- [ ] ANRT timestamp : apply + verify mock (2 tests)
- [ ] Webhook : signature valid + invalid + idempotency + completion flow (4 tests)
- [ ] Audit trail : append-only + PDF generation (2 tests)
- [ ] Public verify : valid hash + invalid + rate limit (3 tests)
- [ ] Sealed archive : archive flow + Object Lock + integrity (3 tests)

**Mocks** :
- [ ] Mock Barid eSign : retourne workflow_id synthetic + permet trigger webhooks completion
- [ ] Mock ANRT TSA : retourne RFC 3161 token synthetic
- [ ] Mock S3 (MinIO local) : tests integration vrais buckets

**Seeds dev** :
- [ ] Script `seed-docs-signature.ts` :
  - 20 documents per tenant (mix devis, factures, polices, sinistres)
  - 5 workflows signature (mix completed, in_progress, declined)
  - 3 archives scellees

**Fichiers crees / modifies** :
```
repo/apps/api/test/docs/{20 specs}.e2e-spec.ts
repo/apps/api/test/signature/{20 specs}.e2e-spec.ts
repo/apps/api/test/fixtures/mock-barid-server.ts                       # ~150 lignes
repo/apps/api/test/fixtures/mock-anrt-tsa.ts                            # ~100 lignes
repo/infrastructure/scripts/seed-docs-signature.ts                       # ~250 lignes
```

**Notes implementation** :
- Mock Barid : nock or MSW
- Mock ANRT : retourne ASN.1 valide synthetic (verifyTimestamp pattern fonctionne)
- Snapshot tests PDFs : pixel-perfect comparison eviter regressions visuelles
- CI : passe avec services Postgres + Redis + MinIO

**Criteres validation** :
- V1 (P0) : 40+ tests passent
- V2 (P0) : Tests passent CI
- V3 (P0) : Mocks complets fonctionnels
- V4 (P0) : Snapshot tests detecte regressions PDF
- V5 (P0) : Reproducibility 5x runs

---

## Sortie du Sprint 10

A la fin de l'execution des 13 taches :

```
Documents + Signature operational :
  - S3 multi-tenant Casablanca avec Object Lock archive (10 ans + 1 jour)
  - Documents CRUD + versions + access logs + presigned URLs
  - PDF generation 4 templates x 3 locales avec puppeteer
  - Signing workflow Barid eSign integre (loi 43-20 conforme)
  - ANRT timestamp qualifie (RFC 3161) chain of trust
  - Audit trail immutable (sig_audit_trails append-only)
  - Public verify endpoint (RGS niveau 2)
  - Sealed archive bucket WORM (Object Lock COMPLIANCE)

Conformite legale :
  - Loi 43-20 (signature electronique MA)
  - Loi 09-08 (CNDP data residency MA)
  - Retention 10 ans + 1 jour archives critiques

40+ tests E2E avec mocks
```

**Sprint 11 demarre avec** :
- Documents signes peuvent etre lies a transactions paiement
- PDF factures auto-generables apres paiement
- Archive scellee disponible pour audits ACAPS

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-3.3.X-*.md` dans `00-pilotage/prompts-taches/sprint-10-docs-signature/`.

**Patterns code inline conserves** : retention rules par type, multi-tenant bucket pattern S3, puppeteer PDF generation, Barid eSign API request, RFC 3161 timestamp request.

**Reference** : `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` lignes 500-700 = tables docs + sig.

---

**Fin du meta-prompt B-10 v2.2 format Option B.**
