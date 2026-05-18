# SPRINT 10 -- Docs + Signature Loi 43-20 -- Resume Generation Phase A

**Reference meta-prompt** : `00-pilotage/meta-prompts/B-10-sprint-10-docs-signature.md`
**Phase** : 3 -- Modules Horizontaux
**Sprint cumul** : 10 / 35 (Phase 3 / Sprint 3 dans phase)
**Position** : Apres Sprint 9 (Comm WA + Email), avant Sprint 11 (Pay MA Multi)
**Numerotation taches** : 3.3.1 a 3.3.13
**Effort total Sprint 10** : 70 heures developpement / 2 semaines
**Priorite** : P0 (BLOQUANT signature electronique conformite legale + storage docs critique)
**Generation Phase A** : Cowork Generation Agent v2 mode dense

**AUCUNE EMOJI dans les prompts taches generes (decision-006 absolu).**

---

## Objectif Global du Sprint 10

Implementer la **gestion documents complete + signature electronique conforme loi 43-20** : storage S3 multi-tenant Atlas Cloud Services Object Storage Benguerir (cloud souverain MA -- decision-008), versioning documents append-only, generation PDF (devis/factures/polices/sinistres-rapport via puppeteer 4 templates x 3 locales), integration **Barid eSign** (e-signature ANRT certifiee Maroc -- decision-009), horodatage qualifie ANRT TSA RFC 3161, hash SHA-512 audit trail immutable avec chain integrite, archive scellee 10 ans + 1 jour (Object Lock COMPLIANCE WORM bucket dedie), webhook receiver Barid HMAC + idempotency, public verify endpoint RGS niveau 2 (anonymized id, rate limit 60/h IP), audit trail immutable append-only DB-level (RLS no-UPDATE no-DELETE), 40+ tests E2E exhaustifs avec mocks Barid + ANRT.

A la sortie de ce sprint, le programme dispose de :
- 6 entites operationnelles : `docs_documents`, `doc_versions`, `doc_access_logs`, `sig_signing_workflows`, `sig_audit_trails`, `sig_archives`
- Storage S3 multi-tenant (1 bucket par tenant en prod, isolation stricte, 3 buckets per tenant : docs / photos / archive)
- Presigned URLs pour acces documents (TTL max 1h prod, log access automatique)
- PDF generation puppeteer 4 templates x 3 locales = 12 outputs (snapshot tests detection regressions visuelles)
- Integration Barid eSign workflow complet : send -> sign -> webhook callback -> archive
- Horodatage qualifie ANRT applique apres signature (chain of trust : Barid signature -> ANRT timestamp = double preuve juridique)
- Hash SHA-512 + audit trail immutable preuve juridique opposable tribunal MA
- Endpoint public verification document `/api/v1/public/verify-doc/:hash` (RGS niveau 2)
- Archive scellee : retention 10 ans + 1 jour (loi 43-20), bucket dedie immutable WORM Object Lock COMPLIANCE
- 40+ tests E2E avec mock Barid eSign + mock ANRT TSA

---

## Vue d'Ensemble des 13 Taches Sprint 10

| # | Tache | Fichier prompt | Effort | Densite atteinte |
|---|-------|---------------|--------|------------------|
| 3.3.1 | Entities documents + versions enrichies + schemas Zod + retention rules par type | `task-3.3.1-entities-documents-versions-zod-schemas.md` | 4h | 124.04 KB |
| 3.3.2 | S3 client Casablanca + KMS + multi-tenant buckets isolation + Object Lock archive | `task-3.3.2-s3-multitenant-buckets-kms-isolation.md` | 6h | 124.31 KB |
| 3.3.3 | DocumentService CRUD + Controller multipart + presigned URLs + retention + state machine | `task-3.3.3-document-service-crud-presigned-urls-retention.md` | 6h | 120.38 KB |
| 3.3.4 | AccessLogService append-only tracking + detection abus 100/h Redis sliding window + admin endpoint | `task-3.3.4-access-log-service-tracking-detection-abus.md` | 4h | 127.48 KB |
| 3.3.5 | PdfGeneratorService puppeteer + 4 templates x 3 locales + helpers (formatDate, formatCurrency, qrCode) | `task-3.3.5-pdf-generator-puppeteer-4-templates-3-locales.md` | 7h | 134.19 KB |
| 3.3.6 | SigningWorkflowService state machine + sig_signing_workflows entity + signers JSONB + sequential/parallel | `task-3.3.6-signing-workflow-service-state-machine.md` | 7h | 107.30 KB |
| 3.3.7 | Barid eSign API client + workflow envoi + signature qualifiee ANRT + mock provider | `task-3.3.7-barid-esign-api-client-loi-43-20-qualified.md` | 6h | 104.60 KB |
| 3.3.8 | Hash SHA-512 + horodatage qualifie ANRT TSA RFC 3161 + ASN.1 encoding/parsing + mTLS | `task-3.3.8-hash-sha512-anrt-timestamp-rfc-3161.md` | 4h | 127.81 KB |
| 3.3.9 | Webhook receiver Barid eSign + HMAC SHA-256 verification + idempotency + async Kafka + completion orchestrator | `task-3.3.9-barid-webhook-receiver-hmac-callback-completion.md` | 5h | 140.87 KB |
| 3.3.10 | sig_audit_trails immutable + AuditTrailService + hash chain integrite + PDF audit trail | `task-3.3.10-sig-audit-trails-immutable-append-only.md` | 4h | 128.48 KB |
| 3.3.11 | Public verify controller + RGS niveau 2 + anonymized public_id + rate limit 60/h IP + HTML page | `task-3.3.11-public-verify-controller-hash-rgs-niveau-2.md` | 4h | 127.25 KB |
| 3.3.12 | SealedArchiveService bucket WORM Object Lock COMPLIANCE 10 ans + 1 jour + manifest JSON + integrity verifier | `task-3.3.12-sealed-archive-worm-object-lock-10-ans.md` | 5h | 121.82 KB |
| 3.3.13 | Tests E2E exhaustifs (40+) + mocks Barid + ANRT + seeds dev (20 docs + 5 workflows + 3 archives) + cron expiration | `task-3.3.13-tests-e2e-40-mocks-barid-anrt-seeds.md` | 8h | 149.03 KB |

**Total effort Sprint 10** : 70 heures (2 semaines).

---

## Statistiques Generation Phase A

**Volume total Sprint 10** : 1637.56 KB (1.60 MB) repartis sur 13 fichiers prompts taches.

**Densite par tache** :
- Minimum : 104.60 KB (task-3.3.7 Barid eSign client) -- au-dessus du minimum 80 KB
- Maximum : 149.03 KB (task-3.3.13 tests E2E) -- dans cible 120-150 KB
- Moyenne : 125.97 KB (cible : 120-150 KB) -- CIBLE ATTEINTE

**Densite distribution** :
- 11 fichiers entre 120-150 KB (cible parfaite)
- 2 fichiers entre 100-120 KB (3.3.6 et 3.3.7) -- au-dessus du minimum 80 KB

**Statut global** : OK -- TOUS LES FICHIERS RESPECTENT LE MINIMUM 80 KB.

**Compliance** :
- 0 emoji (decision-006 absolu) -- VERIFIED
- 0 placeholder (TODO, FIXME, "...", "voir B-10 pour details") -- VERIFIED
- 17 sections par fichier (header + 17 sections obligatoires)
- Code TypeScript strict, executable, complet
- Multi-tenant strict
- Pino logger (pas console.log)
- Zod runtime validation
- Conformite legale 9 lois MA detaillee par tache

---

## Conformite Legale Couverte (Sprint 10)

Le Sprint 10 implemente la conformite a 9 textes legaux marocains, avec mapping precis dans chaque prompt task :

| Loi / norme | Couverture Sprint 10 | Taches concernees |
|-------------|---------------------|-------------------|
| **Loi 43-20** (signature electronique) | Article 5 (signature qualifiee = manuscrite), Article 6 (horodatage qualifie obligatoire), Article 7 (archive 10 ans), Article 9 (preuve numerique opposable tribunal) | 3.3.6, 3.3.7, 3.3.8, 3.3.9, 3.3.10, 3.3.12 |
| **Loi 09-08 CNDP** (donnees personnelles) | Article 4 (minimisation), Article 13 (audit logs integrite), Article 23 (chiffrement secrets), Article 24 (data residency MA), Article 27 (exception purge legal preserve) | 3.3.1, 3.3.2, 3.3.4, 3.3.10, 3.3.11, 3.3.12 |
| **ANRT** (Time Stamping Authority) | Decret 2-08-518 (TSA certifiee), RFC 3161 (interoperabilite internationale) | 3.3.8 |
| **ACAPS Circulaire 2018/01** (assurance) | Article 9 (tracabilite signatures), Article 11 (archives consultables), Article 12 (testing obligatoire) | 3.3.4, 3.3.6, 3.3.7, 3.3.10, 3.3.11, 3.3.12, 3.3.13 |
| **DGI Code General Impots** | Article 211 (archives fiscales 10 ans), Note Circulaire 717 (mentions factures ICE/IF/RC) | 3.3.5, 3.3.12 |
| **Loi 17-99 Code Assurances** | Article 17 (mentions obligatoires polices), Article 17 (droit retract 30j) | 3.3.5 |
| **Code procedure civile MA** | Article 417-4 (preuve electronique recevable) | 3.3.10 |
| **ETSI TS 102 023 / EN 319 122 / TS 119 511** | Long Term Validation timestamps + signatures + archives | 3.3.8, 3.3.10, 3.3.12 |
| **RGS Niveau 2** | Reference General Securite verification publique signatures | 3.3.11 |

---

## Stack Technique Sprint 10 (rappel)

| Composant | Version | Role |
|-----------|---------|------|
| @aws-sdk/client-s3 | 3.700.0 | S3 client Atlas Cloud Services / MinIO compat |
| @aws-sdk/s3-request-presigner | 3.700.0 | presigned URLs |
| @aws-sdk/client-kms | 3.700.0 | KMS encryption per-tenant |
| puppeteer | 24.0.1 | PDF generation HTML -> PDF |
| sharp | 0.33.5 | image processing thumbnails |
| node-rsa | 1.1.1 | RSA cles ANRT TSA |
| asn1.js | latest | RFC 3161 TimeStampReq/Resp ASN.1 encoding |
| undici | 6.x | HTTP client mTLS Agent |
| @nestjs/bullmq | latest | Async queues access logs + webhook processing |
| @fastify/multipart | latest | Multipart upload documents |
| handlebars | 4.x | PDF templates compilation |

**Variables environnement nouvelles** : `BARID_ESIGN_API_BASE_URL`, `BARID_ESIGN_API_KEY`, `BARID_ESIGN_WEBHOOK_SECRET`, `ANRT_TIMESTAMP_TSA_URL`, `ANRT_TIMESTAMP_CLIENT_CERT_PATH`, `ANRT_TIMESTAMP_CLIENT_KEY_PATH`, `S3_ARCHIVE_BUCKET`, `ARCHIVE_OBJECT_LOCK_RETENTION_DAYS=3651`, `ARCHIVE_OBJECT_LOCK_MODE=COMPLIANCE`, `PUBLIC_VERIFY_RATE_LIMIT_PER_HOUR=60`, `PUBLIC_VERIFY_ANONYMIZE_SECRET`, `WEBHOOK_REPLAY_WINDOW_SECONDS=300`, `KMS_ENABLED=true`, etc.

---

## Decisions Strategiques Referenced

| Decision | Titre | Pertinence Sprint 10 |
|----------|-------|---------------------|
| **decision-006** | No-emoji policy | ABSOLU sur tous prompts taches generes -- 0 emoji |
| **decision-008** | Data residency Maroc (Atlas Cloud Services Benguerir) | S3 multi-tenant + archive bucket localises MA |
| **decision-009** | Signature electronique loi 43-20 (Barid eSign + ANRT) | Implementation complete sprint 10 |
| **decision-002** | Multi-tenant 3 niveaux | RLS policies + bucket-per-tenant + KMS key per-tenant |

---

## Workflow Phase B (Implementation par Claude Code)

Apres validation Phase A (cette generation), Phase B sera lancee :

1. Claude Code prend le repertoire `00-pilotage/prompts-taches/sprint-10-docs-signature/`
2. Pour chaque tache 3.3.1 a 3.3.13, Claude Code lit le prompt task complet
3. Implementation autonome SANS necessite de relire B-10 (auto-suffisance prompt task)
4. Validation locale via les criteres V1-V30+ de chaque prompt task
5. Commit conforme conventional commits + scope sprint-10 + Task X.Y.Z
6. Apres tache 3.3.13 (derniere) : verification automatique sprint via `00-pilotage/verifications/V-10-docs-signature.md`

---

## Sortie Sprint 10 (Apres Implementation)

A la fin de l'execution des 13 taches par Claude Code :

```
Documents + Signature operational :
  - S3 multi-tenant Atlas Cloud Services Benguerir avec Object Lock archive (10 ans + 1 jour)
  - Documents CRUD + versions append-only + access logs + presigned URLs (TTL 1h)
  - PDF generation 4 templates (devis/facture/police/sinistre-rapport) x 3 locales (fr/ar-MA/ar) avec puppeteer
  - Signing workflow Barid eSign integre (loi 43-20 conforme signature qualifiee)
  - ANRT timestamp qualifie (RFC 3161) chain of trust
  - Audit trail immutable (sig_audit_trails append-only DB-level + hash chain)
  - Public verify endpoint (RGS niveau 2 + rate limit 60/h IP)
  - Sealed archive bucket WORM (Object Lock COMPLIANCE mode)

Conformite legale :
  - Loi 43-20 (signature electronique MA)
  - Loi 09-08 (CNDP data residency MA)
  - Retention 10 ans + 1 jour archives critiques
  - 9 lois marocaines respectees

40+ tests E2E avec mocks Barid + ANRT
Coverage cible >= 90% modules signature critiques
```

**Sprint 11 (Pay MA Multi) demarre avec** :
- Documents signes lies a transactions paiement
- PDF factures auto-generables apres paiement
- Archive scellee disponible pour audits ACAPS

---

## Statut Generation Phase A -- Sprint 10

```
=== Sprint 10 : Docs + Signature Loi 43-20 -- GENERATION COMPLETE v2 ===
Taches generees : 13 / 13
Volume total sprint : 1637.56 KB (cible : 13 x 125 KB = 1625 KB)
Densite moyenne : 125.97 KB (cible : 120-150 KB) -- ATTEINTE
Densite minimum : 104.60 KB (>= 80 KB requis) -- OK
Densite maximum : 149.03 KB (<= 150 KB requis) -- OK

Code patterns total sprint : ~190 fichiers complets specifies
Tests total sprint : ~500 cas de tests detailles
Criteres validation total : ~430 criteres V1-VN

=== STATUT : OK -- PRET POUR PHASE B (Claude Code Implementation) ===

Prochain sprint a generer : Sprint 11 (Pay MA Multi-Passerelles)
```

---

**Fin du _SUMMARY.md Sprint 10.**
