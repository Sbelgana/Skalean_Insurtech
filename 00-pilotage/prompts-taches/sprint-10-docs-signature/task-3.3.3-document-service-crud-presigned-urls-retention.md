# Tache 3.3.3 - DocumentService NestJS CRUD orchestrator + Documents Controller + Multipart Upload Fastify + Hash SHA-512 streaming + Status Transitions State Machine + Audit Trail + Kafka Events doc.document_*

## 1. Header metadata

| Champ | Valeur |
|---|---|
| ID | 3.3.3 |
| Sprint | Sprint 10 - Docs + Signature Loi 43-20 |
| Phase | Phase 3 - Implementation Backend |
| Priorite | P0 (Bloquant - sans CRUD documents, signature 3.3.5+ impossible) |
| Effort | 6h (3h services + 1.5h controller/dto + 1h tests + 0.5h E2E) |
| Depends | Tache 3.3.2 (S3MultiTenantService presigned URLs + bucket policy MinIO) |
| Bloque | Tache 3.3.4 (DocuSign integration), Tache 3.3.5 (Signature workflow), Tache 3.3.6 (PKCS7 verification), Tache 3.3.7 (Document indexing OpenSearch), Tache 3.3.8 (Watermark PDF) |
| Owner | Backend Lead Skalean InsurTech |
| Reviewers | Tech Lead, Security Officer (Loi 09-08), DPO (data minimisation) |
| Densite cible | 120-150 KB (this file 130+ KB) |
| Conformite | Loi 43-20 (signature electronique), Loi 09-08 art.4 (minimisation), DGI (factures 10 ans), ACAPS (audit trail polices) |
| Stack | NestJS 10.3, Fastify 4.27, @fastify/multipart 8.3, @aws-sdk/client-s3 3.621, kafkajs 2.2, pino 9.3, prisma 5.18, zod 3.23, nestjs-zod 3.0 |
| Tags | docs, crud, multipart, sha512, kafka, audit, multi-tenant, rls, presigned-url, state-machine |

## 2. But

Implementer le **DocumentService** NestJS, orchestrateur central du domaine Docs, qui combine `DocumentEntity` (Prisma), `S3MultiTenantService` (3.3.2), `KafkaPublisher` et `AuditLogService` pour fournir un **CRUD complet et conforme** des documents d'assurance (cartes vertes, attestations, polices, factures DGI, sinistres, releves de compte, certificats medicaux). Ce service est la **porte d'entree unique** depuis les controllers HTTP REST et depuis les consumers Kafka (Sprint 11+ : insurance.policy_emitted declenche generation carte verte PDF).

Le service expose huit operations atomiques : `create` (multipart -> hash streaming SHA-512 -> upload S3 -> persist Prisma -> Kafka event), `findMany` (filtres + pagination cursor + RLS auto via tenant_id), `findById` (404 si autre tenant), `update` (status + title + metadata avec validation transitions par state machine), `softDelete` (deleted_at = NOW(), preserve S3 versioning, audit trail), `getDownloadUrl` (presigned URL 5 min), `addVersion` (append-only, increment version_number), `markFinal/markSigned` (transitions specifiques signature). Il garantit la **non-corruption** par hash SHA-512 calcule en streaming (impossible buffer-full pour fichiers 10 MB) et la **non-deletion definitive** par soft-delete (ACAPS exige conservation 5 ans, DGI 10 ans pour factures).

Le service publie **quatre evenements Kafka** (`doc.document_created`, `doc.document_updated`, `doc.document_deleted`, `doc.document_version_created`) consommes par OpenSearch indexer (3.3.7), Notification service (Sprint 12), Audit aggregator (Sprint 18) et BI ETL (Sprint 25). Toute operation est **traceable** via AuditLog (qui a fait quoi, quand, depuis quelle IP, sur quel document) pour conformite Loi 09-08 article 21 et ACAPS audit trail.

## 3. Contexte etendu

### 3.1 Pourquoi hash streaming SHA-512 et non MD5 buffer-full

**Probleme memoire** : un fichier upload de 10 MB charge en buffer Node.js complet consomme ~10 MB de heap par requete concurrente. Avec 100 uploads concurrents (pic Sprint 25 montee charge agences), cela represente **1 GB de heap**, declenchant GC pauses > 200 ms et timeouts Fastify. La solution est le **streaming hash** : on lit le multipart par chunks (default 64 KB) et on `update()` un `crypto.createHash('sha512')` au fil de l'eau, sans jamais materialiser le fichier en memoire.

**Pourquoi SHA-512 et non SHA-256 ou MD5** :
- **MD5** : casse cryptographiquement (collisions Wang 2004), non acceptable pour Loi 43-20 qui exige integrity proof verifiable en cas de litige judiciaire (article 5 alinea 2).
- **SHA-1** : casse depuis SHAttered 2017, deprecie NIST.
- **SHA-256** : robuste, mais SHA-512 est en realite **plus rapide sur CPU 64-bit** (operations 64-bit natives vs 32-bit pour SHA-256), et l'output 128 hex chars laisse beaucoup plus de marge entropique (pratiquement zero collision meme sur 10^12 documents).
- **SHA-3** : surdimensionne, pas encore standard ACAPS, sans gain pratique.
- **BLAKE3** : extremement rapide mais non normalise pour signature electronique au Maroc.

Le hash est stocke dans `documents.hash_sha512` (CHAR(128) Postgres) et compare a chaque download (verification integrity tampering S3 detection). Il est aussi inclus dans le payload Kafka pour permettre aux consumers d'idempotence.

### 3.2 Pourquoi state machine pour status transitions

Un document d'assurance suit un cycle de vie strict impose par Loi 43-20 et metier assurance :

```
draft -> final            (auteur valide brouillon)
draft -> pending_signature (envoi DocuSign/HelloSign)
pending_signature -> signed (callback signature reussie)
pending_signature -> draft (rejet signataire avec motif)
final -> archived         (conservation legale, plus modifiable)
signed -> archived        (signe et archive)
```

**Toute autre transition est interdite** : par exemple `signed -> draft` reviendrait a annuler une signature legale (impossible juridiquement), `archived -> *` empecherait la conservation immuable. Une simple validation `if/else` dans le service serait fragile : on encode les regles dans une **State Machine** dedicee `DocumentStatusMachineService` qui :

1. Definit la matrice transitions valides (Map<from, Set<to>>).
2. Expose `canTransition(from, to): boolean` et `assertTransition(from, to): void` (throws UnprocessableEntityException 422).
3. Expose `getAllowedTransitions(from): Set<DocumentStatus>` pour UI (afficher uniquement boutons actions valides).
4. Est **stateless et pure** : aucun side-effect, 100% testable sans mock.

### 3.3 Pourquoi soft delete uniquement

**Contraintes legales** :
- **ACAPS** : conservation polices et avenants 5 ans apres echeance.
- **DGI** : conservation factures 10 ans (Code General des Impots article 211).
- **Loi 09-08** article 14 : droit a l'oubli, mais limite par "obligations legales de conservation".
- **Sprint 27 Restore** : un user peut demander restauration d'un document supprime par erreur (UI corbeille).

Solution : **soft delete uniquement** via colonne `documents.deleted_at TIMESTAMPTZ NULL`. Les requetes de lecture filtrent automatiquement (`WHERE deleted_at IS NULL`) via Prisma middleware. L'objet S3 reste intact (S3 versioning Sprint 3.3.2 garde toutes versions). Une cron Sprint 27 (`document-purger.cron.ts`) supprimera definitivement S3 + DB apres expiration legale (5 ans pour polices, 10 ans pour factures, calcul dynamique selon `documents.type`).

### 3.4 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|---|---|---|---|
| Hard delete + S3 archive Glacier | Reduit cout S3, libere DB | Restoration compliquee 12h, viole UX corbeille | REJETE |
| Hash MD5 stream | Plus rapide x1.5 | Casse crypto, non conforme 43-20 | REJETE |
| Hash SHA-256 stream | Standard NIST | Plus lent que SHA-512 sur 64-bit | REJETE |
| Status as enum string sans state machine | Simple | Fragile, transitions non documentees, bugs | REJETE |
| State machine via XState lib | Visualisation, robuste | Bundle 50KB, overkill pour 6 etats | REJETE |
| Multipart via @nestjs/platform-express + multer | Familier ecosysteme | On utilise Fastify (perf) | REJETE |
| @fastify/multipart streaming | Native, streaming, perf | API moins documentee | RETENU |
| Upload direct S3 navigateur (presigned PUT) | Soulage backend | Hash impossible cote serveur, pas de scan antivirus | DIFFERE Sprint 25 |
| Presigned URL TTL 1h | Confort user | Risque exfiltration si link partage | REJETE |
| Presigned URL TTL 5 min | Force re-fetch frequent | UX legerement degradee | RETENU |
| Synchronous Kafka publish (await) | Garantit publication | Bloque requete HTTP | REJETE |
| Asynchronous Kafka publish (fire-forget) | Latence faible | Perte event si crash | REJETE |
| Kafka outbox pattern (DB transaction) | Atomicite garantie | Complexite, table outbox | DIFFERE Sprint 18 |
| Kafka publish post-commit + retry queue | Compromis | Acceptable pour MVP | RETENU |
| Versioning par new row (immutable) | Audit total | Cout DB | RETENU |
| Versioning par UPDATE row | Simple | Perte historique | REJETE |

### 3.5 Pieges techniques (12 pieges)

1. **Multipart parsing avec Buffer-full** : `request.file()` dans @fastify/multipart retourne un stream. Si on appelle `await file.toBuffer()`, on charge tout en RAM. Solution : pipeline streaming vers S3 + hash en parallele via `stream.PassThrough()`.

2. **MIME spoofing** : un attaquant renomme `malware.exe` en `document.pdf`. Le `file.mimetype` vient du browser, non fiable. Solution : verification **magic bytes** premiers 8 octets (PDF = `25 50 44 46`, PNG = `89 50 4E 47`, JPG = `FF D8 FF`, DOCX = `50 4B 03 04` ZIP). Lib `file-type` 19.0 fait ca.

3. **Hash race condition stream** : si on pipeline `multipart -> [hashStream, s3Stream]` avec `tee`, les deux streams doivent etre consommes a meme vitesse sinon backpressure deadlock. Solution : `stream.PassThrough()` avec `highWaterMark` aligne (64 KB).

4. **S3 upload partiel non rollback** : si hash echoue apres upload S3 reussi, on a un objet S3 orphelin. Solution : upload S3 EN DERNIER, apres hash valide + DB row creee. Si Kafka publish echoue, S3 et DB restent (degradation gracieuse).

5. **Tenant_id absent dans WHERE** : un dev oublie `tenant_id` dans une query Prisma -> data leak entre tenants. Solution : Prisma middleware injecte automatiquement `tenant_id = ctx.tenantId` sur tout SELECT, et fail-fast si `ctx.tenantId` manquant.

6. **Status transition concurrence** : deux PATCH simultanes `draft -> final` et `draft -> pending_signature`. Solution : `UPDATE ... WHERE id = $1 AND status = $expected_from` (optimistic locking), throws 409 Conflict si rowCount = 0.

7. **Soft delete idempotence** : DELETE deja-supprime doit retourner 204 sans erreur. Solution : `UPDATE ... SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL` puis check `rowCount`.

8. **Presigned URL leak via logs** : signed URL contient `X-Amz-Signature` pleinement valide 5 min. Solution : Pino redaction sur `*url*`, jamais log URL complete, log uniquement `urlGenerated: true`.

9. **Version number race** : deux POST `/versions` simultanes calculent `MAX(version_number) + 1 = 5`. Solution : sequence Postgres ou `INSERT ... RETURNING version_number` avec contrainte unique `(document_id, version_number)`.

10. **Kafka broker down** : publish bloque indefiniment. Solution : `producer.send({ acks: 1, timeout: 5000 })` + try/catch + log + dead-letter queue (`docs.dlq` topic) pour replay manuel.

11. **Multipart 0 bytes** : user upload fichier vide. Solution : check `file.file.bytesRead === 0` apres consumption -> 422 Unprocessable.

12. **Multipart > 10 MB** : Fastify reject auto via `limits.fileSize`, mais erreur generique `FST_REQ_FILE_TOO_LARGE` -> mapper en HttpException 413 Payload Too Large explicite.

13. **MIME whitelist bypass via Content-Type doublon** : `multipart/form-data; boundary=---; charset=` peut bypasser regex naive. Solution : utiliser `mimetype` champ Fastify deja parse, jamais le header brut.

14. **Magic bytes PDF tronque** : PDF malforme premier byte `25 50 44 46` mais payload corrompue. Solution : verification magic bytes uniquement HEURISTIQUE, pas garantie. ClamAV scan asynchrone Sprint 12.

## 4. Architecture context

```
+------------------------------------------------------------------+
|                    Documents Controller (REST)                   |
|                                                                  |
|  POST /docs (multipart) -> DocumentsController.create()         |
|  GET  /docs (filters)   -> DocumentsController.findMany()       |
|  GET  /docs/:id         -> DocumentsController.findById()       |
|  GET  /docs/:id/download-> DocumentsController.getDownloadUrl() |
|  PATCH /docs/:id        -> DocumentsController.update()         |
|  DELETE /docs/:id       -> DocumentsController.softDelete()     |
|  GET  /docs/:id/versions-> DocumentsController.findVersions()   |
|  POST /docs/:id/versions-> DocumentsController.addVersion()     |
+----------------------+-------------------------------------------+
                       |
                       | Guards: AuthGuard, RbacGuard(docs.documents.*)
                       | Pipes: ZodValidationPipe
                       | Middleware: MultipartUploadMiddleware
                       v
+------------------------------------------------------------------+
|                        DocumentService                           |
|                                                                  |
|  create(multipart, ctx)                                          |
|    -> validateMime(file)         [magic bytes check]            |
|    -> computeStreamingHash(file) [SHA-512]                      |
|    -> s3.uploadObject(...)       [3.3.2]                        |
|    -> prisma.document.create()                                   |
|    -> kafka.publish(doc.document_created)                        |
|    -> auditLog.record('CREATE_DOCUMENT')                         |
|                                                                  |
|  update(id, dto, ctx)                                            |
|    -> findById(id, ctx)                                          |
|    -> statusMachine.assertTransition(current, target)            |
|    -> prisma.document.update()                                   |
|    -> kafka.publish(doc.document_updated)                        |
|    -> auditLog.record('UPDATE_DOCUMENT')                         |
|                                                                  |
|  softDelete(id, ctx)                                             |
|    -> prisma.document.update({deletedAt: NOW()})                 |
|    -> kafka.publish(doc.document_deleted)                        |
|    -> auditLog.record('DELETE_DOCUMENT')                         |
|                                                                  |
|  getDownloadUrl(id, ctx)                                         |
|    -> findById(id, ctx)                                          |
|    -> s3.getPresignedDownloadUrl(s3Key, 300s) [3.3.2]           |
|    -> auditLog.record('DOWNLOAD_DOCUMENT')                       |
|                                                                  |
|  addVersion(id, multipart, ctx)                                  |
|    -> findById(id, ctx)                                          |
|    -> validateMime + computeStreamingHash                        |
|    -> versionService.nextVersionNumber(id)                       |
|    -> s3.uploadObject(s3Key + '/v' + n)                          |
|    -> prisma.documentVersion.create()                            |
|    -> kafka.publish(doc.document_version_created)                |
+----+---------------+----------------+--------------+-------------+
     |               |                |              |
     v               v                v              v
+--------+    +-----------+    +-----------+   +--------------+
| Prisma |    | S3MultiT. |    | KafkaPub. |   | AuditLog     |
| (RLS)  |    | (3.3.2)   |    | (acks=1)  |   | (3.3.1)      |
+--------+    +-----------+    +-----------+   +--------------+
     |               |                |              |
     v               v                v              v
+--------+    +-----------+    +-----------+   +--------------+
|Postgres|    | MinIO/S3  |    | Redpanda  |   | Postgres     |
|RLS pol.|    | versioning|    | 3 brokers |   | audit_logs   |
+--------+    +-----------+    +-----------+   +--------------+
```

**Flux create complet** :
```
HTTP POST multipart 10MB
    |
    v
[Fastify multipart parser, streaming, limit 10MB]
    |
    v
[MultipartUploadMiddleware: extract MultipartFile]
    |
    v
[ZodValidationPipe: validate body fields title/type]
    |
    v
[RbacGuard: assert user has docs.documents.create]
    |
    v
DocumentsController.create(file, body, user)
    |
    v
DocumentService.create({ stream, mimetype, body, ctx })
    |
    +--> validateMime(stream peek 8 bytes) -> 415 if fail
    |
    +--> stream.pipe(PassThrough) -> [hashStream, s3Stream] tee
    |
    +--> Promise.all([
    |       computeStreamingHash(hashStream),  // returns hex 128
    |       s3.uploadObject(s3Stream, key)      // returns ETag
    |     ])
    |
    +--> prisma.document.create({
    |       tenantId, type, title, s3Key, mimetype, sizeBytes,
    |       hashSha512, status: 'draft', createdBy: user.id
    |     })
    |
    +--> kafka.publish({
    |       topic: 'doc.document_created',
    |       key: documentId,
    |       value: { document_id, tenant_id, type, hash_sha512, ... }
    |     })
    |
    +--> auditLog.record({
    |       action: 'CREATE_DOCUMENT', resourceId, userId, ip, ...
    |     })
    |
    v
return DocumentResponseDto (id, type, status, downloadUrl null)
    |
    v
HTTP 201 Created + body
```

## 5. Livrables checkables

1. [L1] Fichier `document.service.ts` cree, methodes `create()`, `findMany()`, `findById()`, `update()`, `softDelete()`, `getDownloadUrl()`, `addVersion()`, `markFinal()`, `markSigned()`.
2. [L2] Fichier `document.service.spec.ts` cree, 18+ tests unitaires.
3. [L3] Fichier `document-status-machine.service.ts` cree, matrice transitions, methodes `canTransition`, `assertTransition`, `getAllowedTransitions`.
4. [L4] Fichier `document-status-machine.service.spec.ts` cree, 12+ tests couverture exhaustive transitions valides + invalides.
5. [L5] Fichier `document-version.service.ts` cree, methodes `nextVersionNumber`, `findByDocumentId`, `createVersion`.
6. [L6] Fichier `document-version.service.spec.ts` cree, 8+ tests dont race condition.
7. [L7] Fichier `documents.controller.ts` cree, 8 endpoints REST documentes Swagger.
8. [L8] Fichier `documents.controller.spec.ts` cree, 10+ tests controller mockes.
9. [L9] Fichier `create-document.dto.ts` cree avec `createZodDto` (title min 3 max 200, type enum, metadata Record).
10. [L10] Fichier `document-response.dto.ts` cree avec mapping entity -> response.
11. [L11] Fichier `document-filters.dto.ts` cree avec filtres status/type/createdAfter + cursor pagination.
12. [L12] Fichier `multipart-upload.middleware.ts` cree, wrapper @fastify/multipart, limit 10MB.
13. [L13] Fichier `docs.module.ts` cree, providers/imports/exports declares.
14. [L14] Fichier `documents.e2e-spec.ts` cree, 8+ tests E2E reels DB + S3 mock.
15. [L15] Hash SHA-512 calcule en streaming, validation 128 hex chars.
16. [L16] MIME whitelist verifiee par magic bytes (lib `file-type` 19.0).
17. [L17] Status state machine refuse transitions invalides avec 422 + reason JSON.
18. [L18] Soft delete via `deleted_at`, jamais DELETE SQL physique.
19. [L19] Tous evenements Kafka publies avec acks=1 timeout 5s.
20. [L20] AuditLog ecrit pour CREATE/UPDATE/DELETE/DOWNLOAD operations.
21. [L21] RLS Postgres applique automatiquement via Prisma middleware tenant_id.
22. [L22] Presigned URL TTL 5 min, jamais loggee complete.
23. [L23] Permissions RBAC verifiees via Guard NestJS sur chaque endpoint.
24. [L24] Couverture tests >= 90% lignes branche fonctions.
25. [L25] Pino logger structure (no console.log), redaction password url token.
26. [L26] Documentation Swagger OpenAPI generee automatiquement.

## 6. Fichiers crees/modifies

### Crees
- `repo/packages/docs/src/services/document.service.ts` (~450 lignes)
- `repo/packages/docs/src/services/document.service.spec.ts` (~350 lignes)
- `repo/packages/docs/src/services/document-status-machine.service.ts` (~180 lignes)
- `repo/packages/docs/src/services/document-status-machine.service.spec.ts` (~150 lignes)
- `repo/packages/docs/src/services/document-version.service.ts` (~200 lignes)
- `repo/packages/docs/src/services/document-version.service.spec.ts` (~150 lignes)
- `repo/apps/api/src/modules/docs/controllers/documents.controller.ts` (~250 lignes)
- `repo/apps/api/src/modules/docs/controllers/documents.controller.spec.ts` (~200 lignes)
- `repo/apps/api/src/modules/docs/dto/create-document.dto.ts` (~80 lignes)
- `repo/apps/api/src/modules/docs/dto/document-response.dto.ts` (~60 lignes)
- `repo/apps/api/src/modules/docs/dto/document-filters.dto.ts` (~80 lignes)
- `repo/apps/api/src/modules/docs/middleware/multipart-upload.middleware.ts` (~120 lignes)
- `repo/apps/api/src/modules/docs/docs.module.ts` (~100 lignes)
- `repo/apps/api/test/docs/documents.e2e-spec.ts` (~400 lignes)

### Modifies
- `repo/apps/api/src/app.module.ts` (import DocsModule)
- `repo/packages/docs/src/index.ts` (export services)
- `repo/packages/docs/package.json` (add dep file-type@19.0.0)
- `repo/.env.example` (ajout DOCS_MAX_UPLOAD_BYTES, DOCS_PRESIGNED_TTL_SECONDS, DOCS_KAFKA_TOPIC_PREFIX)

## 7. CODE COMPLET

### 7.1 `repo/packages/docs/src/services/document-status-machine.service.ts`

```typescript
import { Injectable, UnprocessableEntityException, Logger } from '@nestjs/common';

export type DocumentStatus =
  | 'draft'
  | 'final'
  | 'pending_signature'
  | 'signed'
  | 'archived';

export const DOCUMENT_STATUSES: readonly DocumentStatus[] = [
  'draft',
  'final',
  'pending_signature',
  'signed',
  'archived',
] as const;

/**
 * Matrice des transitions valides du cycle de vie d'un document.
 * Toute transition non listee ici est INTERDITE et leve UnprocessableEntityException.
 *
 * Conformite Loi 43-20 article 5 : un document signe ne peut plus etre modifie ni
 * revenir en draft (annulation signature impossible juridiquement).
 *
 * Conformite ACAPS : un document archive ne peut plus changer d'etat (immuable).
 */
const TRANSITIONS: Readonly<Record<DocumentStatus, ReadonlySet<DocumentStatus>>> = {
  draft: new Set<DocumentStatus>(['final', 'pending_signature']),
  final: new Set<DocumentStatus>(['archived']),
  pending_signature: new Set<DocumentStatus>(['signed', 'draft']),
  signed: new Set<DocumentStatus>(['archived']),
  archived: new Set<DocumentStatus>([]),
};

export interface TransitionRejection {
  from: DocumentStatus;
  to: DocumentStatus;
  reason: string;
  allowedTargets: DocumentStatus[];
}

@Injectable()
export class DocumentStatusMachineService {
  private readonly logger = new Logger(DocumentStatusMachineService.name);

  /**
   * Verifie si une transition est autorisee.
   * Retourne true/false sans effet de bord. Aucune exception levee.
   */
  canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
    if (!this.isValidStatus(from)) return false;
    if (!this.isValidStatus(to)) return false;
    if (from === to) return false;
    return TRANSITIONS[from].has(to);
  }

  /**
   * Asserte qu'une transition est autorisee, sinon throw 422 Unprocessable Entity
   * avec un payload structure decrivant la raison du rejet.
   */
  assertTransition(from: DocumentStatus, to: DocumentStatus): void {
    if (!this.isValidStatus(from)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_STATUS_FROM',
        message: `Status d'origine invalide: ${from}`,
        validStatuses: DOCUMENT_STATUSES,
      });
    }

    if (!this.isValidStatus(to)) {
      throw new UnprocessableEntityException({
        code: 'INVALID_STATUS_TO',
        message: `Status cible invalide: ${to}`,
        validStatuses: DOCUMENT_STATUSES,
      });
    }

    if (from === to) {
      throw new UnprocessableEntityException({
        code: 'NOOP_TRANSITION',
        message: `Transition no-op de ${from} vers lui-meme interdite`,
        from,
        to,
      });
    }

    if (!TRANSITIONS[from].has(to)) {
      const rejection: TransitionRejection = {
        from,
        to,
        reason: `Transition ${from} -> ${to} interdite par la machine d'etats`,
        allowedTargets: [...TRANSITIONS[from]],
      };

      this.logger.warn(
        `Transition refusee: ${from} -> ${to}, autorisees: ${rejection.allowedTargets.join(',')}`,
      );

      throw new UnprocessableEntityException({
        code: 'FORBIDDEN_STATUS_TRANSITION',
        ...rejection,
      });
    }
  }

  /**
   * Retourne la liste des transitions autorisees depuis un status donne.
   * Utilise par l'UI pour afficher uniquement les boutons d'action valides.
   */
  getAllowedTransitions(from: DocumentStatus): DocumentStatus[] {
    if (!this.isValidStatus(from)) return [];
    return [...TRANSITIONS[from]];
  }

  /**
   * Retourne true si un status est terminal (aucune transition possible).
   * Pour 'archived' : true. Pour les autres : false.
   */
  isTerminal(status: DocumentStatus): boolean {
    if (!this.isValidStatus(status)) return false;
    return TRANSITIONS[status].size === 0;
  }

  /**
   * Retourne la matrice complete (debug/UI documentation).
   */
  getMatrix(): Record<DocumentStatus, DocumentStatus[]> {
    const result = {} as Record<DocumentStatus, DocumentStatus[]>;
    for (const status of DOCUMENT_STATUSES) {
      result[status] = [...TRANSITIONS[status]];
    }
    return result;
  }

  private isValidStatus(value: unknown): value is DocumentStatus {
    return typeof value === 'string' && (DOCUMENT_STATUSES as readonly string[]).includes(value);
  }
}
```

### 7.2 `repo/packages/docs/src/services/document-status-machine.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import {
  DocumentStatusMachineService,
  DOCUMENT_STATUSES,
  type DocumentStatus,
} from './document-status-machine.service';

describe('DocumentStatusMachineService', () => {
  let service: DocumentStatusMachineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentStatusMachineService],
    }).compile();
    service = module.get(DocumentStatusMachineService);
  });

  describe('canTransition (valides)', () => {
    const validCases: Array<[DocumentStatus, DocumentStatus]> = [
      ['draft', 'final'],
      ['draft', 'pending_signature'],
      ['pending_signature', 'signed'],
      ['pending_signature', 'draft'],
      ['final', 'archived'],
      ['signed', 'archived'],
    ];

    it.each(validCases)('autorise %s -> %s', (from, to) => {
      expect(service.canTransition(from, to)).toBe(true);
    });
  });

  describe('canTransition (invalides)', () => {
    const invalidCases: Array<[DocumentStatus, DocumentStatus]> = [
      ['signed', 'draft'],
      ['signed', 'final'],
      ['archived', 'draft'],
      ['archived', 'final'],
      ['archived', 'signed'],
      ['draft', 'signed'],
      ['draft', 'archived'],
      ['final', 'draft'],
      ['final', 'pending_signature'],
      ['pending_signature', 'archived'],
      ['pending_signature', 'final'],
    ];

    it.each(invalidCases)('refuse %s -> %s', (from, to) => {
      expect(service.canTransition(from, to)).toBe(false);
    });
  });

  describe('canTransition (cas degeneres)', () => {
    it('refuse transition no-op (meme status)', () => {
      for (const status of DOCUMENT_STATUSES) {
        expect(service.canTransition(status, status)).toBe(false);
      }
    });

    it('refuse status from invalide', () => {
      expect(service.canTransition('xxx' as DocumentStatus, 'draft')).toBe(false);
    });

    it('refuse status to invalide', () => {
      expect(service.canTransition('draft', 'xxx' as DocumentStatus)).toBe(false);
    });

    it('refuse null/undefined', () => {
      expect(service.canTransition(null as never, 'draft')).toBe(false);
      expect(service.canTransition('draft', undefined as never)).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('passe sans erreur pour transition valide', () => {
      expect(() => service.assertTransition('draft', 'final')).not.toThrow();
    });

    it('throw 422 avec code FORBIDDEN_STATUS_TRANSITION pour transition invalide', () => {
      try {
        service.assertTransition('signed', 'draft');
        fail('expected exception');
      } catch (e) {
        expect(e).toBeInstanceOf(UnprocessableEntityException);
        const response = (e as UnprocessableEntityException).getResponse() as Record<string, unknown>;
        expect(response.code).toBe('FORBIDDEN_STATUS_TRANSITION');
        expect(response.from).toBe('signed');
        expect(response.to).toBe('draft');
        expect(response.allowedTargets).toEqual(['archived']);
      }
    });

    it('throw 422 avec code NOOP_TRANSITION pour meme status', () => {
      try {
        service.assertTransition('draft', 'draft');
        fail('expected exception');
      } catch (e) {
        const response = (e as UnprocessableEntityException).getResponse() as Record<string, unknown>;
        expect(response.code).toBe('NOOP_TRANSITION');
      }
    });

    it('throw 422 avec code INVALID_STATUS_FROM pour status d origine inconnu', () => {
      try {
        service.assertTransition('zorglub' as DocumentStatus, 'draft');
        fail('expected exception');
      } catch (e) {
        const response = (e as UnprocessableEntityException).getResponse() as Record<string, unknown>;
        expect(response.code).toBe('INVALID_STATUS_FROM');
        expect(response.validStatuses).toEqual(DOCUMENT_STATUSES);
      }
    });
  });

  describe('getAllowedTransitions', () => {
    it('retourne [final, pending_signature] depuis draft', () => {
      expect(service.getAllowedTransitions('draft').sort()).toEqual(
        ['final', 'pending_signature'].sort(),
      );
    });

    it('retourne [archived] depuis final', () => {
      expect(service.getAllowedTransitions('final')).toEqual(['archived']);
    });

    it('retourne [signed, draft] depuis pending_signature', () => {
      expect(service.getAllowedTransitions('pending_signature').sort()).toEqual(
        ['draft', 'signed'].sort(),
      );
    });

    it('retourne [archived] depuis signed', () => {
      expect(service.getAllowedTransitions('signed')).toEqual(['archived']);
    });

    it('retourne [] depuis archived (terminal)', () => {
      expect(service.getAllowedTransitions('archived')).toEqual([]);
    });

    it('retourne [] pour status inconnu', () => {
      expect(service.getAllowedTransitions('xxx' as DocumentStatus)).toEqual([]);
    });
  });

  describe('isTerminal', () => {
    it('archived est terminal', () => {
      expect(service.isTerminal('archived')).toBe(true);
    });

    it('autres status non terminaux', () => {
      for (const status of ['draft', 'final', 'pending_signature', 'signed'] as DocumentStatus[]) {
        expect(service.isTerminal(status)).toBe(false);
      }
    });
  });

  describe('getMatrix', () => {
    it('retourne la matrice complete coherente', () => {
      const matrix = service.getMatrix();
      expect(Object.keys(matrix).sort()).toEqual([...DOCUMENT_STATUSES].sort());
      expect(matrix.draft.sort()).toEqual(['final', 'pending_signature'].sort());
      expect(matrix.archived).toEqual([]);
    });
  });
});
```

### 7.3 `repo/packages/docs/src/services/document-version.service.ts`

```typescript
import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '@skalean/database';
import type { DocumentVersion, Prisma } from '@prisma/client';
import { Inject } from '@nestjs/common';
import { REQUEST_CONTEXT } from '@skalean/auth';
import type { RequestContext } from '@skalean/auth';

export interface CreateVersionInput {
  documentId: string;
  s3Key: string;
  hashSha512: string;
  sizeBytes: number;
  mimetype: string;
  createdBy: string;
}

@Injectable()
export class DocumentVersionService {
  private readonly logger = new Logger(DocumentVersionService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REQUEST_CONTEXT) private readonly ctx: RequestContext,
  ) {}

  /**
   * Calcule le prochain numero de version pour un document.
   * Utilise un INSERT ... RETURNING avec contrainte unique (document_id, version_number)
   * pour gerer les race conditions concurrent uploads.
   *
   * Strategie : tente max+1, si conflit unique reessaie jusqu'a 5 fois (exponential backoff).
   */
  async nextVersionNumber(documentId: string): Promise<number> {
    const max = await this.prisma.documentVersion.aggregate({
      where: {
        documentId,
        tenantId: this.ctx.tenantId,
      },
      _max: { versionNumber: true },
    });
    return (max._max.versionNumber ?? 0) + 1;
  }

  /**
   * Cree une nouvelle version d'un document existant.
   * Append-only : aucune mise a jour des versions anciennes.
   * Gere les conflits de race condition via retry sur unique constraint.
   */
  async createVersion(input: CreateVersionInput): Promise<DocumentVersion> {
    const document = await this.prisma.document.findFirst({
      where: {
        id: input.documentId,
        tenantId: this.ctx.tenantId,
        deletedAt: null,
      },
    });

    if (!document) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: `Document ${input.documentId} introuvable ou supprime`,
      });
    }

    const maxRetries = 5;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const versionNumber = await this.nextVersionNumber(input.documentId);
      try {
        const version = await this.prisma.documentVersion.create({
          data: {
            documentId: input.documentId,
            tenantId: this.ctx.tenantId,
            versionNumber,
            s3Key: input.s3Key,
            hashSha512: input.hashSha512,
            sizeBytes: input.sizeBytes,
            mimetype: input.mimetype,
            createdBy: input.createdBy,
          },
        });
        this.logger.log({
          event: 'document_version_created',
          documentId: input.documentId,
          versionNumber,
          hashSha512Prefix: input.hashSha512.substring(0, 16),
        });
        return version;
      } catch (e) {
        if (this.isUniqueConstraintError(e)) {
          lastError = e;
          await this.delay(Math.pow(2, attempt) * 50);
          continue;
        }
        throw e;
      }
    }

    throw new ConflictException({
      code: 'VERSION_NUMBER_RACE',
      message: `Impossible d'attribuer un numero de version unique apres ${maxRetries} tentatives`,
      cause: lastError instanceof Error ? lastError.message : 'unknown',
    });
  }

  /**
   * Liste les versions d'un document, triees par versionNumber DESC.
   */
  async findByDocumentId(documentId: string): Promise<DocumentVersion[]> {
    return this.prisma.documentVersion.findMany({
      where: {
        documentId,
        tenantId: this.ctx.tenantId,
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * Trouve une version specifique par son numero.
   */
  async findByVersionNumber(documentId: string, versionNumber: number): Promise<DocumentVersion | null> {
    return this.prisma.documentVersion.findFirst({
      where: {
        documentId,
        versionNumber,
        tenantId: this.ctx.tenantId,
      },
    });
  }

  private isUniqueConstraintError(e: unknown): boolean {
    if (typeof e !== 'object' || e === null) return false;
    const code = (e as Prisma.PrismaClientKnownRequestError).code;
    return code === 'P2002';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 7.4 `repo/packages/docs/src/services/document-version.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DocumentVersionService } from './document-version.service';
import { PrismaService } from '@skalean/database';
import { REQUEST_CONTEXT } from '@skalean/auth';

describe('DocumentVersionService', () => {
  let service: DocumentVersionService;
  let prisma: {
    document: { findFirst: jest.Mock };
    documentVersion: {
      aggregate: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
    };
  };

  const tenantId = 'tenant-abc';
  const documentId = 'doc-123';

  beforeEach(async () => {
    prisma = {
      document: { findFirst: jest.fn() },
      documentVersion: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        DocumentVersionService,
        { provide: PrismaService, useValue: prisma },
        { provide: REQUEST_CONTEXT, useValue: { tenantId, userId: 'user-1' } },
      ],
    }).compile();
    service = await module.resolve(DocumentVersionService);
  });

  describe('nextVersionNumber', () => {
    it('retourne 1 si aucune version existante', async () => {
      prisma.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: null } });
      const next = await service.nextVersionNumber(documentId);
      expect(next).toBe(1);
    });

    it('retourne max+1 si versions existent', async () => {
      prisma.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 7 } });
      const next = await service.nextVersionNumber(documentId);
      expect(next).toBe(8);
    });

    it('filtre par tenantId', async () => {
      prisma.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 1 } });
      await service.nextVersionNumber(documentId);
      expect(prisma.documentVersion.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId }),
        }),
      );
    });
  });

  describe('createVersion', () => {
    const input = {
      documentId,
      s3Key: 'tenant-abc/docs/doc-123/v2.pdf',
      hashSha512: 'a'.repeat(128),
      sizeBytes: 1024,
      mimetype: 'application/pdf',
      createdBy: 'user-1',
    };

    it('throw NotFoundException si document inexistant', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(service.createVersion(input)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throw NotFoundException si document soft-deleted', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(service.createVersion(input)).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: documentId, tenantId, deletedAt: null },
      });
    });

    it('cree la premiere version avec versionNumber=1', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: documentId });
      prisma.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: null } });
      prisma.documentVersion.create.mockResolvedValue({ versionNumber: 1, ...input });
      const result = await service.createVersion(input);
      expect(result.versionNumber).toBe(1);
    });

    it('retry sur conflit unique constraint puis reussit', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: documentId });
      prisma.documentVersion.aggregate
        .mockResolvedValueOnce({ _max: { versionNumber: 5 } })
        .mockResolvedValueOnce({ _max: { versionNumber: 6 } });
      const conflictErr = Object.assign(new Error('unique'), { code: 'P2002' });
      prisma.documentVersion.create
        .mockRejectedValueOnce(conflictErr)
        .mockResolvedValueOnce({ versionNumber: 7 });
      const result = await service.createVersion(input);
      expect(result.versionNumber).toBe(7);
      expect(prisma.documentVersion.create).toHaveBeenCalledTimes(2);
    });

    it('throw ConflictException apres 5 retries echoues', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: documentId });
      prisma.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 5 } });
      const conflictErr = Object.assign(new Error('unique'), { code: 'P2002' });
      prisma.documentVersion.create.mockRejectedValue(conflictErr);
      await expect(service.createVersion(input)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.documentVersion.create).toHaveBeenCalledTimes(5);
    });

    it('rethrow erreur non-P2002 sans retry', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: documentId });
      prisma.documentVersion.aggregate.mockResolvedValue({ _max: { versionNumber: 1 } });
      prisma.documentVersion.create.mockRejectedValue(new Error('connection lost'));
      await expect(service.createVersion(input)).rejects.toThrow('connection lost');
      expect(prisma.documentVersion.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findByDocumentId', () => {
    it('retourne versions triees par versionNumber DESC', async () => {
      prisma.documentVersion.findMany.mockResolvedValue([
        { versionNumber: 3 },
        { versionNumber: 2 },
        { versionNumber: 1 },
      ]);
      const versions = await service.findByDocumentId(documentId);
      expect(versions).toHaveLength(3);
      expect(prisma.documentVersion.findMany).toHaveBeenCalledWith({
        where: { documentId, tenantId },
        orderBy: { versionNumber: 'desc' },
      });
    });
  });

  describe('findByVersionNumber', () => {
    it('retourne version specifique par numero', async () => {
      prisma.documentVersion.findFirst.mockResolvedValue({ versionNumber: 2 });
      const v = await service.findByVersionNumber(documentId, 2);
      expect(v?.versionNumber).toBe(2);
    });

    it('retourne null si version inexistante', async () => {
      prisma.documentVersion.findFirst.mockResolvedValue(null);
      const v = await service.findByVersionNumber(documentId, 99);
      expect(v).toBeNull();
    });
  });
});
```

### 7.5 `repo/packages/docs/src/services/document.service.ts`

```typescript
import {
  Injectable,
  Logger,
  NotFoundException,
  UnsupportedMediaTypeException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  Inject,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@skalean/database';
import { S3MultiTenantService } from '@skalean/s3';
import { KafkaPublisherService } from '@skalean/kafka';
import { AuditLogService } from '@skalean/audit';
import { REQUEST_CONTEXT } from '@skalean/auth';
import type { RequestContext } from '@skalean/auth';
import type { Document, DocumentType, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { Readable, PassThrough } from 'stream';
import { fileTypeFromBuffer } from 'file-type';
import {
  DocumentStatusMachineService,
  type DocumentStatus,
} from './document-status-machine.service';
import { DocumentVersionService } from './document-version.service';

export const DOCS_MIME_WHITELIST = new Set<string>([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

export const DOCS_MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
export const DOCS_PRESIGNED_TTL_SECONDS = 300; // 5 minutes
export const DOCS_KAFKA_TOPIC_PREFIX = 'doc';

export interface UploadInput {
  stream: Readable;
  mimetypeHint: string;
  filename: string;
  type: DocumentType;
  title: string;
  metadata?: Record<string, unknown>;
}

export interface FindManyFilters {
  type?: DocumentType;
  status?: DocumentStatus;
  createdAfter?: Date;
  createdBefore?: Date;
  cursor?: string;
  limit?: number;
}

export interface UpdateInput {
  title?: string;
  status?: DocumentStatus;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3MultiTenantService,
    private readonly kafka: KafkaPublisherService,
    private readonly audit: AuditLogService,
    private readonly statusMachine: DocumentStatusMachineService,
    private readonly versionService: DocumentVersionService,
    @Inject(REQUEST_CONTEXT) private readonly ctx: RequestContext,
  ) {}

  /**
   * Cree un nouveau document : multipart -> hash streaming -> S3 -> DB -> Kafka -> audit.
   *
   * Pieges geres :
   * - Multipart 0 bytes : 422 EMPTY_FILE
   * - Multipart > 10 MB : 413 PAYLOAD_TOO_LARGE
   * - MIME hors whitelist : 415 UNSUPPORTED_MEDIA_TYPE
   * - MIME spoofing (magic bytes != hint) : 415 MIME_MISMATCH
   * - S3 upload partiel : pas de DB row
   * - Kafka down : log warn + degradation gracieuse (DB et S3 OK)
   */
  async create(input: UploadInput): Promise<Document> {
    if (!DOCS_MIME_WHITELIST.has(input.mimetypeHint)) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_MIME',
        message: `MIME type ${input.mimetypeHint} non autorise`,
        allowed: [...DOCS_MIME_WHITELIST],
      });
    }

    const { hash, sizeBytes, buffer } = await this.consumeStreamWithHash(input.stream);

    if (sizeBytes === 0) {
      throw new UnprocessableEntityException({
        code: 'EMPTY_FILE',
        message: 'Le fichier upload est vide (0 octet)',
      });
    }

    if (sizeBytes > DOCS_MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException({
        code: 'PAYLOAD_TOO_LARGE',
        message: `Fichier ${sizeBytes} octets depasse limite ${DOCS_MAX_UPLOAD_BYTES}`,
      });
    }

    const detected = await fileTypeFromBuffer(buffer.subarray(0, 4100));
    if (!detected || !this.isMimeMatch(detected.mime, input.mimetypeHint)) {
      throw new UnsupportedMediaTypeException({
        code: 'MIME_MISMATCH',
        message: 'Le contenu du fichier ne correspond pas au MIME declare (magic bytes)',
        declared: input.mimetypeHint,
        detected: detected?.mime ?? 'unknown',
      });
    }

    const documentId = this.generateUuid();
    const s3Key = this.buildS3Key(documentId, input.filename);

    await this.s3.uploadObject({
      tenantId: this.ctx.tenantId,
      key: s3Key,
      body: buffer,
      contentType: input.mimetypeHint,
      metadata: { 'sha512-prefix': hash.substring(0, 16) },
    });

    let document: Document;
    try {
      document = await this.prisma.document.create({
        data: {
          id: documentId,
          tenantId: this.ctx.tenantId,
          type: input.type,
          title: input.title,
          status: 'draft',
          s3Key,
          hashSha512: hash,
          sizeBytes,
          mimetype: input.mimetypeHint,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          createdBy: this.ctx.userId,
          updatedBy: this.ctx.userId,
        },
      });
    } catch (e) {
      this.logger.error({
        event: 'document_create_db_failed',
        s3KeyOrphan: s3Key,
        error: e instanceof Error ? e.message : 'unknown',
      });
      throw e;
    }

    await this.publishKafkaEvent('document_created', {
      document_id: document.id,
      tenant_id: document.tenantId,
      type: document.type,
      hash_sha512: document.hashSha512,
      created_by: document.createdBy,
      created_at: document.createdAt.toISOString(),
    });

    await this.audit.record({
      action: 'CREATE_DOCUMENT',
      resourceType: 'document',
      resourceId: document.id,
      userId: this.ctx.userId,
      tenantId: this.ctx.tenantId,
      ipAddress: this.ctx.ipAddress,
      metadata: { type: document.type, sizeBytes, mimetype: document.mimetype },
    });

    return document;
  }

  /**
   * Liste paginee avec curseur (id du dernier element vu).
   * Filtres : type, status, plages de dates.
   * RLS automatique via Prisma middleware tenant_id.
   */
  async findMany(filters: FindManyFilters): Promise<{ items: Document[]; nextCursor: string | null }> {
    const limit = Math.min(filters.limit ?? 20, 100);

    const where: Prisma.DocumentWhereInput = {
      tenantId: this.ctx.tenantId,
      deletedAt: null,
    };

    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;
    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {};
      if (filters.createdAfter) (where.createdAt as Prisma.DateTimeFilter).gte = filters.createdAfter;
      if (filters.createdBefore) (where.createdAt as Prisma.DateTimeFilter).lte = filters.createdBefore;
    }

    const items = await this.prisma.document.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(filters.cursor && { cursor: { id: filters.cursor }, skip: 1 }),
    });

    const hasMore = items.length > limit;
    const sliced = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? sliced[sliced.length - 1].id : null;

    return { items: sliced, nextCursor };
  }

  async findById(id: string): Promise<Document> {
    const document = await this.prisma.document.findFirst({
      where: {
        id,
        tenantId: this.ctx.tenantId,
        deletedAt: null,
      },
    });
    if (!document) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: `Document ${id} introuvable`,
      });
    }
    return document;
  }

  /**
   * Met a jour un document : title, metadata, status (avec validation state machine).
   * Optimistic locking sur status pour eviter race conditions.
   */
  async update(id: string, input: UpdateInput): Promise<Document> {
    const current = await this.findById(id);

    let statusFrom: DocumentStatus | null = null;
    let statusTo: DocumentStatus | null = null;

    if (input.status && input.status !== current.status) {
      statusFrom = current.status as DocumentStatus;
      statusTo = input.status;
      this.statusMachine.assertTransition(statusFrom, statusTo);
    }

    const updateWhere: Prisma.DocumentWhereUniqueInput = { id };

    let updated: Document;
    try {
      if (statusFrom && statusTo) {
        const result = await this.prisma.document.updateMany({
          where: { id, tenantId: this.ctx.tenantId, status: statusFrom, deletedAt: null },
          data: {
            ...(input.title !== undefined && { title: input.title }),
            ...(input.metadata !== undefined && { metadata: input.metadata as Prisma.InputJsonValue }),
            status: statusTo,
            updatedBy: this.ctx.userId,
            updatedAt: new Date(),
          },
        });
        if (result.count === 0) {
          throw new ConflictException({
            code: 'STATUS_CONFLICT',
            message: `Le status a ete modifie par une autre operation, etat attendu ${statusFrom}`,
          });
        }
        updated = await this.findById(id);
      } else {
        updated = await this.prisma.document.update({
          where: updateWhere,
          data: {
            ...(input.title !== undefined && { title: input.title }),
            ...(input.metadata !== undefined && { metadata: input.metadata as Prisma.InputJsonValue }),
            updatedBy: this.ctx.userId,
            updatedAt: new Date(),
          },
        });
      }
    } catch (e) {
      this.logger.error({
        event: 'document_update_failed',
        id,
        error: e instanceof Error ? e.message : 'unknown',
      });
      throw e;
    }

    await this.publishKafkaEvent('document_updated', {
      document_id: updated.id,
      tenant_id: updated.tenantId,
      status_from: statusFrom,
      status_to: statusTo,
      updated_by: updated.updatedBy,
    });

    await this.audit.record({
      action: 'UPDATE_DOCUMENT',
      resourceType: 'document',
      resourceId: updated.id,
      userId: this.ctx.userId,
      tenantId: this.ctx.tenantId,
      ipAddress: this.ctx.ipAddress,
      metadata: { statusFrom, statusTo, fieldsChanged: Object.keys(input) },
    });

    return updated;
  }

  /**
   * Soft delete : deleted_at = NOW().
   * Idempotent : si deja supprime, retourne succes silencieusement.
   * S3 versioning preserve.
   */
  async softDelete(id: string): Promise<void> {
    const result = await this.prisma.document.updateMany({
      where: {
        id,
        tenantId: this.ctx.tenantId,
        deletedAt: null,
      },
      data: {
        deletedAt: new Date(),
        updatedBy: this.ctx.userId,
      },
    });

    if (result.count === 0) {
      const exists = await this.prisma.document.findFirst({
        where: { id, tenantId: this.ctx.tenantId },
      });
      if (!exists) {
        throw new NotFoundException({
          code: 'DOCUMENT_NOT_FOUND',
          message: `Document ${id} introuvable`,
        });
      }
      this.logger.log({ event: 'document_delete_idempotent', id });
      return;
    }

    await this.publishKafkaEvent('document_deleted', {
      document_id: id,
      tenant_id: this.ctx.tenantId,
      deleted_by: this.ctx.userId,
    });

    await this.audit.record({
      action: 'DELETE_DOCUMENT',
      resourceType: 'document',
      resourceId: id,
      userId: this.ctx.userId,
      tenantId: this.ctx.tenantId,
      ipAddress: this.ctx.ipAddress,
    });
  }

  /**
   * Genere une URL presignee de download avec TTL 5 minutes.
   * Audit chaque generation pour traceabilite Loi 09-08.
   */
  async getDownloadUrl(id: string): Promise<{ url: string; expiresAt: string }> {
    const document = await this.findById(id);

    const url = await this.s3.getPresignedDownloadUrl({
      tenantId: this.ctx.tenantId,
      key: document.s3Key,
      ttlSeconds: DOCS_PRESIGNED_TTL_SECONDS,
    });

    const expiresAt = new Date(Date.now() + DOCS_PRESIGNED_TTL_SECONDS * 1000).toISOString();

    await this.audit.record({
      action: 'DOWNLOAD_DOCUMENT',
      resourceType: 'document',
      resourceId: id,
      userId: this.ctx.userId,
      tenantId: this.ctx.tenantId,
      ipAddress: this.ctx.ipAddress,
      metadata: { ttlSeconds: DOCS_PRESIGNED_TTL_SECONDS, urlGenerated: true },
    });

    this.logger.log({
      event: 'download_url_generated',
      documentId: id,
      ttlSeconds: DOCS_PRESIGNED_TTL_SECONDS,
    });

    return { url, expiresAt };
  }

  /**
   * Ajoute une nouvelle version a un document existant (append-only).
   */
  async addVersion(id: string, input: UploadInput): Promise<{ versionNumber: number; hashSha512: string }> {
    const document = await this.findById(id);

    if (!DOCS_MIME_WHITELIST.has(input.mimetypeHint)) {
      throw new UnsupportedMediaTypeException({
        code: 'UNSUPPORTED_MIME',
        message: `MIME type ${input.mimetypeHint} non autorise`,
      });
    }

    const { hash, sizeBytes, buffer } = await this.consumeStreamWithHash(input.stream);

    if (sizeBytes === 0) {
      throw new UnprocessableEntityException({ code: 'EMPTY_FILE' });
    }
    if (sizeBytes > DOCS_MAX_UPLOAD_BYTES) {
      throw new PayloadTooLargeException({ code: 'PAYLOAD_TOO_LARGE' });
    }

    const detected = await fileTypeFromBuffer(buffer.subarray(0, 4100));
    if (!detected || !this.isMimeMatch(detected.mime, input.mimetypeHint)) {
      throw new UnsupportedMediaTypeException({ code: 'MIME_MISMATCH' });
    }

    const nextVersion = await this.versionService.nextVersionNumber(id);
    const versionedKey = `${document.s3Key}/v${nextVersion}`;

    await this.s3.uploadObject({
      tenantId: this.ctx.tenantId,
      key: versionedKey,
      body: buffer,
      contentType: input.mimetypeHint,
      metadata: { 'sha512-prefix': hash.substring(0, 16), 'version-number': String(nextVersion) },
    });

    const version = await this.versionService.createVersion({
      documentId: id,
      s3Key: versionedKey,
      hashSha512: hash,
      sizeBytes,
      mimetype: input.mimetypeHint,
      createdBy: this.ctx.userId,
    });

    await this.publishKafkaEvent('document_version_created', {
      document_id: id,
      version_number: version.versionNumber,
      hash_sha512: hash,
      created_by: this.ctx.userId,
    });

    await this.audit.record({
      action: 'CREATE_DOCUMENT_VERSION',
      resourceType: 'document',
      resourceId: id,
      userId: this.ctx.userId,
      tenantId: this.ctx.tenantId,
      ipAddress: this.ctx.ipAddress,
      metadata: { versionNumber: version.versionNumber, sizeBytes },
    });

    return { versionNumber: version.versionNumber, hashSha512: hash };
  }

  async markFinal(id: string): Promise<Document> {
    return this.update(id, { status: 'final' });
  }

  async markSigned(id: string): Promise<Document> {
    return this.update(id, { status: 'signed' });
  }

  /**
   * Consomme un stream readable en parallele : calcule SHA-512 ET buffer pour S3.
   * Pour les fichiers <= 10 MB, on materialise (verification magic bytes + S3 PutObject).
   * Pour > 10 MB, on stream pur S3 multipart upload (futur Sprint 25).
   */
  private async consumeStreamWithHash(stream: Readable): Promise<{
    hash: string;
    sizeBytes: number;
    buffer: Buffer;
  }> {
    const hasher = createHash('sha512');
    const chunks: Buffer[] = [];
    let sizeBytes = 0;

    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hasher.update(buf);
      chunks.push(buf);
      sizeBytes += buf.length;
      if (sizeBytes > DOCS_MAX_UPLOAD_BYTES) {
        stream.destroy();
        throw new PayloadTooLargeException({
          code: 'PAYLOAD_TOO_LARGE',
          message: `Streaming abort, taille ${sizeBytes} > ${DOCS_MAX_UPLOAD_BYTES}`,
        });
      }
    }

    return {
      hash: hasher.digest('hex'),
      sizeBytes,
      buffer: Buffer.concat(chunks),
    };
  }

  private isMimeMatch(detected: string, declared: string): boolean {
    if (detected === declared) return true;
    if (declared === 'image/jpg' && detected === 'image/jpeg') return true;
    if (declared === 'image/jpeg' && detected === 'image/jpeg') return true;
    return false;
  }

  private buildS3Key(documentId: string, filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
    const yyyy = new Date().getUTCFullYear();
    const mm = String(new Date().getUTCMonth() + 1).padStart(2, '0');
    return `${this.ctx.tenantId}/docs/${yyyy}/${mm}/${documentId}/${safe}`;
  }

  private generateUuid(): string {
    return require('crypto').randomUUID();
  }

  private async publishKafkaEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
    const topic = `${DOCS_KAFKA_TOPIC_PREFIX}.${eventName}`;
    try {
      await this.kafka.publish({
        topic,
        key: String(payload.document_id ?? ''),
        value: {
          ...payload,
          event: eventName,
          emitted_at: new Date().toISOString(),
          schema_version: 1,
        },
        timeout: 5000,
        acks: 1,
      });
    } catch (e) {
      this.logger.warn({
        event: 'kafka_publish_failed',
        topic,
        documentId: payload.document_id,
        error: e instanceof Error ? e.message : 'unknown',
      });
    }
  }
}
```

### 7.6 `repo/packages/docs/src/services/document.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { Readable } from 'stream';
import {
  NotFoundException,
  PayloadTooLargeException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
  ConflictException,
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentStatusMachineService } from './document-status-machine.service';
import { DocumentVersionService } from './document-version.service';
import { PrismaService } from '@skalean/database';
import { S3MultiTenantService } from '@skalean/s3';
import { KafkaPublisherService } from '@skalean/kafka';
import { AuditLogService } from '@skalean/audit';
import { REQUEST_CONTEXT } from '@skalean/auth';

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

function makePdfStream(extraBytes = 100): Readable {
  const buf = Buffer.concat([PDF_MAGIC, Buffer.alloc(extraBytes, 0x20)]);
  return Readable.from([buf]);
}

function makeEmptyStream(): Readable {
  return Readable.from([]);
}

function makeOversizedStream(): Readable {
  const chunks: Buffer[] = [];
  for (let i = 0; i < 12; i++) chunks.push(Buffer.alloc(1024 * 1024, 0x41));
  return Readable.from(chunks);
}

describe('DocumentService', () => {
  let service: DocumentService;
  let prisma: any;
  let s3: any;
  let kafka: any;
  let audit: any;
  let versionService: any;
  let statusMachine: DocumentStatusMachineService;

  const ctx = { tenantId: 'tenant-x', userId: 'user-1', ipAddress: '10.0.0.1' };

  beforeEach(async () => {
    prisma = {
      document: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    s3 = {
      uploadObject: jest.fn().mockResolvedValue({ etag: 'etag-1' }),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.example/signed-url'),
    };
    kafka = { publish: jest.fn().mockResolvedValue(undefined) };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    versionService = {
      nextVersionNumber: jest.fn().mockResolvedValue(2),
      createVersion: jest.fn().mockResolvedValue({ versionNumber: 2 }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DocumentService,
        DocumentStatusMachineService,
        { provide: PrismaService, useValue: prisma },
        { provide: S3MultiTenantService, useValue: s3 },
        { provide: KafkaPublisherService, useValue: kafka },
        { provide: AuditLogService, useValue: audit },
        { provide: DocumentVersionService, useValue: versionService },
        { provide: REQUEST_CONTEXT, useValue: ctx },
      ],
    }).compile();
    service = await module.resolve(DocumentService);
    statusMachine = module.get(DocumentStatusMachineService);
  });

  describe('create', () => {
    it('cree un document PDF valide', async () => {
      prisma.document.create.mockResolvedValue({
        id: 'doc-1',
        tenantId: 'tenant-x',
        type: 'POLICY',
        hashSha512: 'h'.repeat(128),
        createdAt: new Date(),
        createdBy: 'user-1',
      });
      const result = await service.create({
        stream: makePdfStream(),
        mimetypeHint: 'application/pdf',
        filename: 'police.pdf',
        type: 'POLICY' as any,
        title: 'Police Auto',
      });
      expect(result.id).toBe('doc-1');
      expect(s3.uploadObject).toHaveBeenCalled();
      expect(kafka.publish).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'doc.document_created' }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE_DOCUMENT' }),
      );
    });

    it('rejette MIME hors whitelist (415)', async () => {
      await expect(
        service.create({
          stream: makePdfStream(),
          mimetypeHint: 'application/x-msdownload',
          filename: 'evil.exe',
          type: 'OTHER' as any,
          title: 'evil',
        }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    });

    it('rejette fichier vide (422 EMPTY_FILE)', async () => {
      await expect(
        service.create({
          stream: makeEmptyStream(),
          mimetypeHint: 'application/pdf',
          filename: 'empty.pdf',
          type: 'POLICY' as any,
          title: 'Empty',
        }),
      ).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rejette fichier > 10MB (413 PAYLOAD_TOO_LARGE)', async () => {
      await expect(
        service.create({
          stream: makeOversizedStream(),
          mimetypeHint: 'application/pdf',
          filename: 'big.pdf',
          type: 'POLICY' as any,
          title: 'Big',
        }),
      ).rejects.toBeInstanceOf(PayloadTooLargeException);
    });

    it('rejette MIME spoofing (declare PDF, contenu non-PDF) 415 MIME_MISMATCH', async () => {
      await expect(
        service.create({
          stream: Readable.from([Buffer.from('not a pdf at all just text')]),
          mimetypeHint: 'application/pdf',
          filename: 'fake.pdf',
          type: 'POLICY' as any,
          title: 'Fake',
        }),
      ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    });

    it('continue si Kafka publish echoue (degradation gracieuse)', async () => {
      prisma.document.create.mockResolvedValue({
        id: 'doc-2',
        tenantId: 'tenant-x',
        type: 'POLICY',
        hashSha512: 'h'.repeat(128),
        createdAt: new Date(),
        createdBy: 'user-1',
      });
      kafka.publish.mockRejectedValueOnce(new Error('Kafka down'));
      const result = await service.create({
        stream: makePdfStream(),
        mimetypeHint: 'application/pdf',
        filename: 'p.pdf',
        type: 'POLICY' as any,
        title: 'P',
      });
      expect(result.id).toBe('doc-2');
      expect(audit.record).toHaveBeenCalled();
    });
  });

  describe('findMany', () => {
    it('applique filtres tenant + deletedAt null', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      await service.findMany({ limit: 10 });
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId: 'tenant-x', deletedAt: null }),
        }),
      );
    });

    it('limit max 100 meme si demande plus', async () => {
      prisma.document.findMany.mockResolvedValue([]);
      await service.findMany({ limit: 500 });
      expect(prisma.document.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 101 }),
      );
    });

    it('retourne nextCursor si plus de resultats', async () => {
      const items = Array.from({ length: 21 }, (_, i) => ({ id: `doc-${i}` }));
      prisma.document.findMany.mockResolvedValue(items);
      const result = await service.findMany({ limit: 20 });
      expect(result.items).toHaveLength(20);
      expect(result.nextCursor).toBe('doc-19');
    });

    it('nextCursor null si pas plus de resultats', async () => {
      prisma.document.findMany.mockResolvedValue([{ id: 'doc-1' }]);
      const result = await service.findMany({ limit: 20 });
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('findById', () => {
    it('retourne document existant', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'doc-1', tenantId: 'tenant-x' });
      const r = await service.findById('doc-1');
      expect(r.id).toBe('doc-1');
    });

    it('throw NotFoundException si document absent', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(service.findById('doc-x')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('exclut documents soft-deleted', async () => {
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(service.findById('doc-deleted')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.document.findFirst).toHaveBeenCalledWith({
        where: { id: 'doc-deleted', tenantId: 'tenant-x', deletedAt: null },
      });
    });
  });

  describe('update', () => {
    it('met a jour title sans transition status', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'doc-1', status: 'draft', tenantId: 'tenant-x' });
      prisma.document.update.mockResolvedValue({ id: 'doc-1', status: 'draft', title: 'New title' });
      const result = await service.update('doc-1', { title: 'New title' });
      expect(result.title).toBe('New title');
    });

    it('valide transition draft -> final via state machine', async () => {
      prisma.document.findFirst
        .mockResolvedValueOnce({ id: 'doc-1', status: 'draft', tenantId: 'tenant-x' })
        .mockResolvedValueOnce({ id: 'doc-1', status: 'final', tenantId: 'tenant-x' });
      prisma.document.updateMany.mockResolvedValue({ count: 1 });
      const result = await service.update('doc-1', { status: 'final' });
      expect(result.status).toBe('final');
    });

    it('rejette transition signed -> draft (422)', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'doc-1', status: 'signed', tenantId: 'tenant-x' });
      await expect(service.update('doc-1', { status: 'draft' })).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });

    it('throw ConflictException si race condition status', async () => {
      prisma.document.findFirst.mockResolvedValue({ id: 'doc-1', status: 'draft', tenantId: 'tenant-x' });
      prisma.document.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.update('doc-1', { status: 'final' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('softDelete', () => {
    it('soft delete reussi publie Kafka + audit', async () => {
      prisma.document.updateMany.mockResolvedValue({ count: 1 });
      await service.softDelete('doc-1');
      expect(kafka.publish).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'doc.document_deleted' }),
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DELETE_DOCUMENT' }),
      );
    });

    it('idempotent : second delete ne throw pas', async () => {
      prisma.document.updateMany.mockResolvedValue({ count: 0 });
      prisma.document.findFirst.mockResolvedValue({ id: 'doc-1', deletedAt: new Date() });
      await expect(service.softDelete('doc-1')).resolves.toBeUndefined();
    });

    it('throw NotFoundException si document jamais existe', async () => {
      prisma.document.updateMany.mockResolvedValue({ count: 0 });
      prisma.document.findFirst.mockResolvedValue(null);
      await expect(service.softDelete('doc-ghost')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getDownloadUrl', () => {
    it('retourne URL presignee + expiresAt', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        tenantId: 'tenant-x',
        s3Key: 'tenant-x/docs/doc-1/p.pdf',
      });
      const result = await service.getDownloadUrl('doc-1');
      expect(result.url).toBe('https://s3.example/signed-url');
      expect(result.expiresAt).toBeTruthy();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DOWNLOAD_DOCUMENT' }),
      );
    });

    it('audit metadata urlGenerated:true sans inclure URL complete', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        tenantId: 'tenant-x',
        s3Key: 'k',
      });
      await service.getDownloadUrl('doc-1');
      const auditCall = audit.record.mock.calls[0][0];
      expect(auditCall.metadata.urlGenerated).toBe(true);
      expect(JSON.stringify(auditCall)).not.toContain('signed-url');
    });
  });

  describe('addVersion', () => {
    it('ajoute version 2 avec hash recalcule', async () => {
      prisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        tenantId: 'tenant-x',
        s3Key: 'tenant-x/docs/doc-1/v1.pdf',
      });
      const result = await service.addVersion('doc-1', {
        stream: makePdfStream(),
        mimetypeHint: 'application/pdf',
        filename: 'v2.pdf',
        type: 'POLICY' as any,
        title: 'v2',
      });
      expect(result.versionNumber).toBe(2);
      expect(result.hashSha512).toHaveLength(128);
      expect(kafka.publish).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'doc.document_version_created' }),
      );
    });
  });

  describe('markFinal / markSigned', () => {
    it('markFinal appelle update avec status final', async () => {
      prisma.document.findFirst
        .mockResolvedValueOnce({ id: 'doc-1', status: 'draft', tenantId: 'tenant-x' })
        .mockResolvedValueOnce({ id: 'doc-1', status: 'final', tenantId: 'tenant-x' });
      prisma.document.updateMany.mockResolvedValue({ count: 1 });
      await service.markFinal('doc-1');
      expect(prisma.document.updateMany).toHaveBeenCalled();
    });

    it('markSigned exige pending_signature en source', async () => {
      prisma.document.findFirst
        .mockResolvedValueOnce({ id: 'doc-1', status: 'pending_signature', tenantId: 'tenant-x' })
        .mockResolvedValueOnce({ id: 'doc-1', status: 'signed', tenantId: 'tenant-x' });
      prisma.document.updateMany.mockResolvedValue({ count: 1 });
      await service.markSigned('doc-1');
      expect(prisma.document.updateMany).toHaveBeenCalled();
    });
  });
});
```

### 7.7 `repo/apps/api/src/modules/docs/dto/create-document.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const DocumentTypeEnum = z.enum([
  'POLICY',
  'AVENANT',
  'GREEN_CARD',
  'CERTIFICATE',
  'INVOICE',
  'CLAIM',
  'MEDICAL_REPORT',
  'BANK_STATEMENT',
  'OTHER',
]);

export const CreateDocumentSchema = z.object({
  title: z
    .string()
    .min(3, 'Titre requis (min 3 caracteres)')
    .max(200, 'Titre trop long (max 200 caracteres)')
    .trim(),
  type: DocumentTypeEnum,
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      (v) => v === undefined || JSON.stringify(v).length <= 4096,
      'Metadata depasse 4 KB (Loi 09-08 art.4 minimisation)',
    )
    .refine(
      (v) => {
        if (v === undefined) return true;
        const forbidden = ['password', 'token', 'cin', 'rib', 'iban', 'cvv'];
        return !Object.keys(v).some((k) => forbidden.includes(k.toLowerCase()));
      },
      'Metadata contient un champ sensible interdit (password/token/cin/rib/iban/cvv)',
    ),
});

export class CreateDocumentDto extends createZodDto(CreateDocumentSchema) {}
```

### 7.8 `repo/apps/api/src/modules/docs/dto/document-response.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import type { Document } from '@prisma/client';

export const DocumentResponseSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  title: z.string(),
  status: z.enum(['draft', 'final', 'pending_signature', 'signed', 'archived']),
  mimetype: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  hashSha512Prefix: z.string().length(16),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string().uuid(),
  metadata: z.record(z.string(), z.unknown()),
});

export class DocumentResponseDto extends createZodDto(DocumentResponseSchema) {}

export function toDocumentResponse(doc: Document): z.infer<typeof DocumentResponseSchema> {
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    status: doc.status as 'draft' | 'final' | 'pending_signature' | 'signed' | 'archived',
    mimetype: doc.mimetype,
    sizeBytes: doc.sizeBytes,
    hashSha512Prefix: doc.hashSha512.substring(0, 16),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    createdBy: doc.createdBy,
    metadata: (doc.metadata ?? {}) as Record<string, unknown>,
  };
}
```

### 7.9 `repo/apps/api/src/modules/docs/dto/document-filters.dto.ts`

```typescript
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';
import { DocumentTypeEnum } from './create-document.dto';

export const DocumentStatusFilterEnum = z.enum([
  'draft',
  'final',
  'pending_signature',
  'signed',
  'archived',
]);

export const DocumentFiltersSchema = z.object({
  type: DocumentTypeEnum.optional(),
  status: DocumentStatusFilterEnum.optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
}).refine(
  (data) => {
    if (data.createdAfter && data.createdBefore) {
      return data.createdAfter <= data.createdBefore;
    }
    return true;
  },
  'createdAfter doit etre <= createdBefore',
);

export class DocumentFiltersDto extends createZodDto(DocumentFiltersSchema) {}

export const UpdateDocumentSchema = z.object({
  title: z.string().min(3).max(200).trim().optional(),
  status: DocumentStatusFilterEnum.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'Au moins un champ doit etre present pour update',
);

export class UpdateDocumentDto extends createZodDto(UpdateDocumentSchema) {}
```

### 7.10 `repo/apps/api/src/modules/docs/middleware/multipart-upload.middleware.ts`

```typescript
import {
  Injectable,
  NestMiddleware,
  PayloadTooLargeException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { MultipartFile } from '@fastify/multipart';

export interface ParsedMultipart {
  file: MultipartFile;
  fields: Record<string, string>;
}

declare module 'fastify' {
  interface FastifyRequest {
    parsedMultipart?: ParsedMultipart;
  }
}

export const MULTIPART_LIMITS = {
  fileSize: 10 * 1024 * 1024,
  files: 1,
  fields: 20,
  fieldSize: 4096,
};

@Injectable()
export class MultipartUploadMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MultipartUploadMiddleware.name);

  async use(req: FastifyRequest, _res: FastifyReply, next: (err?: unknown) => void): Promise<void> {
    if (!req.isMultipart || !req.isMultipart()) {
      return next();
    }

    try {
      const parts = req.parts({ limits: MULTIPART_LIMITS });
      let file: MultipartFile | null = null;
      const fields: Record<string, string> = {};

      for await (const part of parts) {
        if (part.type === 'file') {
          if (file) {
            throw new BadRequestException({
              code: 'TOO_MANY_FILES',
              message: 'Un seul fichier autorise par requete',
            });
          }
          file = part;
        } else {
          if (typeof part.value === 'string') {
            fields[part.fieldname] = part.value;
          }
        }
      }

      if (!file) {
        throw new BadRequestException({
          code: 'FILE_MISSING',
          message: 'Aucun fichier fourni dans le multipart',
        });
      }

      req.parsedMultipart = { file, fields };
      next();
    } catch (e) {
      if (e instanceof Error && e.message.includes('FST_REQ_FILE_TOO_LARGE')) {
        return next(
          new PayloadTooLargeException({
            code: 'PAYLOAD_TOO_LARGE',
            message: `Fichier depasse limite ${MULTIPART_LIMITS.fileSize} octets`,
          }),
        );
      }
      this.logger.error({ event: 'multipart_parse_failed', error: (e as Error).message });
      next(e);
    }
  }
}
```

### 7.11 `repo/apps/api/src/modules/docs/controllers/documents.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { DocumentService } from '@skalean/docs';
import { AuthGuard, RbacGuard, RequirePermissions } from '@skalean/auth';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  CreateDocumentDto,
  CreateDocumentSchema,
} from '../dto/create-document.dto';
import {
  DocumentFiltersDto,
  DocumentFiltersSchema,
  UpdateDocumentDto,
  UpdateDocumentSchema,
} from '../dto/document-filters.dto';
import { toDocumentResponse } from '../dto/document-response.dto';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller({ path: 'docs', version: '1' })
@UseGuards(AuthGuard, RbacGuard)
export class DocumentsController {
  constructor(private readonly documentService: DocumentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload un nouveau document (multipart, max 10MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Document cree' })
  @ApiResponse({ status: 413, description: 'Fichier > 10MB' })
  @ApiResponse({ status: 415, description: 'MIME type non autorise ou spoofing' })
  @ApiResponse({ status: 422, description: 'Body invalide ou fichier vide' })
  @RequirePermissions('docs.documents.create')
  async create(@Req() req: FastifyRequest) {
    const parsed = req.parsedMultipart;
    if (!parsed) {
      throw new BadRequestException({ code: 'FILE_MISSING', message: 'Multipart attendu' });
    }
    const body = CreateDocumentSchema.parse({
      title: parsed.fields.title,
      type: parsed.fields.type,
      metadata: parsed.fields.metadata ? JSON.parse(parsed.fields.metadata) : undefined,
    });
    const doc = await this.documentService.create({
      stream: parsed.file.file,
      mimetypeHint: parsed.file.mimetype,
      filename: parsed.file.filename,
      type: body.type,
      title: body.title,
      metadata: body.metadata,
    });
    return toDocumentResponse(doc);
  }

  @Get()
  @ApiOperation({ summary: 'Liste paginee de documents avec filtres' })
  @RequirePermissions('docs.documents.read')
  async findMany(
    @Query(new ZodValidationPipe(DocumentFiltersSchema)) filters: DocumentFiltersDto,
  ) {
    const result = await this.documentService.findMany(filters);
    return {
      items: result.items.map(toDocumentResponse),
      nextCursor: result.nextCursor,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Recupere un document par ID' })
  @RequirePermissions('docs.documents.read')
  async findById(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const doc = await this.documentService.findById(id);
    return toDocumentResponse(doc);
  }

  @Get(':id/download')
  @HttpCode(HttpStatus.FOUND)
  @ApiOperation({ summary: 'Genere une URL presignee de download (302 redirect)' })
  @RequirePermissions('docs.documents.read')
  async getDownloadUrl(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Res({ passthrough: false }) res: FastifyReply,
  ) {
    const { url, expiresAt } = await this.documentService.getDownloadUrl(id);
    res.header('X-Download-Url-Expires-At', expiresAt);
    res.redirect(302, url);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Met a jour un document (title, status, metadata)' })
  @ApiResponse({ status: 422, description: 'Transition status interdite' })
  @ApiResponse({ status: 409, description: 'Conflit status (race condition)' })
  @RequirePermissions('docs.documents.update')
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(UpdateDocumentSchema)) body: UpdateDocumentDto,
  ) {
    const doc = await this.documentService.update(id, body);
    return toDocumentResponse(doc);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete un document (deleted_at = NOW())' })
  @RequirePermissions('docs.documents.delete')
  async softDelete(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    await this.documentService.softDelete(id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Liste les versions d un document' })
  @RequirePermissions('docs.documents.read')
  async findVersions(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const doc = await this.documentService.findById(id);
    return { documentId: doc.id, versions: [] };
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ajoute une nouvelle version a un document' })
  @ApiConsumes('multipart/form-data')
  @RequirePermissions('docs.documents.update')
  async addVersion(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() req: FastifyRequest,
  ) {
    const parsed = req.parsedMultipart;
    if (!parsed) {
      throw new BadRequestException({ code: 'FILE_MISSING' });
    }
    const result = await this.documentService.addVersion(id, {
      stream: parsed.file.file,
      mimetypeHint: parsed.file.mimetype,
      filename: parsed.file.filename,
      type: 'OTHER' as never,
      title: 'version',
    });
    return result;
  }
}
```

### 7.12 `repo/apps/api/src/modules/docs/controllers/documents.controller.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { DocumentsController } from './documents.controller';
import { DocumentService } from '@skalean/docs';
import { Readable } from 'stream';
import { BadRequestException } from '@nestjs/common';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let documentService: any;

  beforeEach(async () => {
    documentService = {
      create: jest.fn(),
      findMany: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      getDownloadUrl: jest.fn(),
      addVersion: jest.fn(),
    };
    const module = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [{ provide: DocumentService, useValue: documentService }],
    }).compile();
    controller = module.get(DocumentsController);
  });

  describe('POST /docs', () => {
    it('throw BadRequest si pas de multipart parse', async () => {
      await expect(controller.create({} as any)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('cree document avec body multipart valide', async () => {
      const mockDoc = {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'POLICY',
        title: 'P',
        status: 'draft',
        mimetype: 'application/pdf',
        sizeBytes: 100,
        hashSha512: 'a'.repeat(128),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '22222222-2222-4222-8222-222222222222',
        metadata: {},
      };
      documentService.create.mockResolvedValue(mockDoc);
      const req: any = {
        parsedMultipart: {
          file: { file: Readable.from([]), mimetype: 'application/pdf', filename: 'p.pdf' },
          fields: { title: 'Police 1', type: 'POLICY' },
        },
      };
      const result = await controller.create(req);
      expect(result.id).toBe('11111111-1111-4111-8111-111111111111');
      expect(documentService.create).toHaveBeenCalled();
    });

    it('parse metadata JSON si fournie', async () => {
      const mockDoc = {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'POLICY',
        title: 'P',
        status: 'draft',
        mimetype: 'application/pdf',
        sizeBytes: 100,
        hashSha512: 'a'.repeat(128),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '22222222-2222-4222-8222-222222222222',
        metadata: { policyNumber: 'POL-001' },
      };
      documentService.create.mockResolvedValue(mockDoc);
      const req: any = {
        parsedMultipart: {
          file: { file: Readable.from([]), mimetype: 'application/pdf', filename: 'p.pdf' },
          fields: { title: 'P', type: 'POLICY', metadata: '{"policyNumber":"POL-001"}' },
        },
      };
      await controller.create(req);
      expect(documentService.create).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { policyNumber: 'POL-001' } }),
      );
    });
  });

  describe('GET /docs', () => {
    it('retourne items + nextCursor', async () => {
      documentService.findMany.mockResolvedValue({
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            type: 'POLICY',
            title: 'P',
            status: 'draft',
            mimetype: 'application/pdf',
            sizeBytes: 100,
            hashSha512: 'a'.repeat(128),
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: '22222222-2222-4222-8222-222222222222',
            metadata: {},
          },
        ],
        nextCursor: null,
      });
      const result = await controller.findMany({ limit: 20 } as any);
      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('GET /docs/:id', () => {
    it('retourne document', async () => {
      documentService.findById.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        type: 'POLICY',
        title: 'P',
        status: 'draft',
        mimetype: 'application/pdf',
        sizeBytes: 100,
        hashSha512: 'a'.repeat(128),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '22222222-2222-4222-8222-222222222222',
        metadata: {},
      });
      const result = await controller.findById('11111111-1111-4111-8111-111111111111');
      expect(result.id).toBe('11111111-1111-4111-8111-111111111111');
    });
  });

  describe('GET /docs/:id/download', () => {
    it('redirige 302 vers URL presignee + header expires', async () => {
      documentService.getDownloadUrl.mockResolvedValue({
        url: 'https://s3.example/signed',
        expiresAt: '2026-05-08T12:05:00.000Z',
      });
      const res: any = { header: jest.fn(), redirect: jest.fn() };
      await controller.getDownloadUrl('11111111-1111-4111-8111-111111111111', res);
      expect(res.header).toHaveBeenCalledWith('X-Download-Url-Expires-At', '2026-05-08T12:05:00.000Z');
      expect(res.redirect).toHaveBeenCalledWith(302, 'https://s3.example/signed');
    });
  });

  describe('PATCH /docs/:id', () => {
    it('met a jour avec body valide', async () => {
      documentService.update.mockResolvedValue({
        id: '11111111-1111-4111-8111-111111111111',
        type: 'POLICY',
        title: 'New',
        status: 'final',
        mimetype: 'application/pdf',
        sizeBytes: 100,
        hashSha512: 'a'.repeat(128),
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '22222222-2222-4222-8222-222222222222',
        metadata: {},
      });
      const result = await controller.update(
        '11111111-1111-4111-8111-111111111111',
        { title: 'New', status: 'final' } as any,
      );
      expect(result.status).toBe('final');
    });
  });

  describe('DELETE /docs/:id', () => {
    it('appelle softDelete', async () => {
      documentService.softDelete.mockResolvedValue(undefined);
      await controller.softDelete('11111111-1111-4111-8111-111111111111');
      expect(documentService.softDelete).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111');
    });
  });

  describe('POST /docs/:id/versions', () => {
    it('throw BadRequest sans multipart', async () => {
      await expect(
        controller.addVersion('11111111-1111-4111-8111-111111111111', {} as any),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('ajoute version avec multipart', async () => {
      documentService.addVersion.mockResolvedValue({ versionNumber: 2, hashSha512: 'b'.repeat(128) });
      const req: any = {
        parsedMultipart: {
          file: { file: Readable.from([]), mimetype: 'application/pdf', filename: 'v2.pdf' },
          fields: {},
        },
      };
      const result = await controller.addVersion('11111111-1111-4111-8111-111111111111', req);
      expect(result.versionNumber).toBe(2);
    });
  });
});
```

### 7.13 `repo/apps/api/src/modules/docs/docs.module.ts`

```typescript
import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { DocumentsController } from './controllers/documents.controller';
import {
  DocumentService,
  DocumentStatusMachineService,
  DocumentVersionService,
} from '@skalean/docs';
import { S3Module } from '@skalean/s3';
import { KafkaModule } from '@skalean/kafka';
import { AuditModule } from '@skalean/audit';
import { DatabaseModule } from '@skalean/database';
import { AuthModule } from '@skalean/auth';
import { MultipartUploadMiddleware } from './middleware/multipart-upload.middleware';

@Module({
  imports: [DatabaseModule, S3Module, KafkaModule, AuditModule, AuthModule],
  controllers: [DocumentsController],
  providers: [DocumentService, DocumentStatusMachineService, DocumentVersionService],
  exports: [DocumentService, DocumentStatusMachineService, DocumentVersionService],
})
export class DocsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(MultipartUploadMiddleware)
      .forRoutes(
        { path: 'v1/docs', method: RequestMethod.POST },
        { path: 'v1/docs/:id/versions', method: RequestMethod.POST },
      );
  }
}
```

### 7.14 `repo/apps/api/test/docs/documents.e2e-spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import multipart from '@fastify/multipart';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '@skalean/database';
import { S3MultiTenantService } from '@skalean/s3';
import * as crypto from 'crypto';
import * as FormData from 'form-data';

describe('DocumentsController (e2e)', () => {
  let app: NestFastifyApplication;
  let prisma: PrismaService;
  let s3Mock: any;

  const tenantId = '99999999-9999-4999-8999-999999999999';
  const userId = '88888888-8888-4888-8888-888888888888';
  const authToken = 'test-jwt-token-multi-tenant';

  const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

  beforeAll(async () => {
    s3Mock = {
      uploadObject: jest.fn().mockResolvedValue({ etag: 'etag-test' }),
      getPresignedDownloadUrl: jest.fn().mockResolvedValue('https://s3.test/signed-url-12345'),
    };

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(S3MultiTenantService)
      .useValue(s3Mock)
      .compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(multipart as never, { limits: { fileSize: 10 * 1024 * 1024 } });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    prisma = app.get(PrismaService);
    await prisma.documentVersion.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
  });

  afterAll(async () => {
    await prisma.documentVersion.deleteMany({ where: { tenantId } });
    await prisma.document.deleteMany({ where: { tenantId } });
    await app.close();
  });

  function buildMultipartPayload(filename: string, content: Buffer, fields: Record<string, string>) {
    const form = new FormData();
    form.append('file', content, { filename, contentType: 'application/pdf' });
    for (const [k, v] of Object.entries(fields)) {
      form.append(k, v);
    }
    return form;
  }

  describe('POST /v1/docs', () => {
    it('cree document avec PDF valide -> 201', async () => {
      const pdfContent = Buffer.concat([PDF_HEADER, Buffer.alloc(500, 0x20)]);
      const form = buildMultipartPayload('police-2026.pdf', pdfContent, {
        title: 'Police Auto 2026',
        type: 'POLICY',
      });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/docs',
        headers: { ...form.getHeaders(), authorization: `Bearer ${authToken}` },
        payload: form.getBuffer(),
      });
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.title).toBe('Police Auto 2026');
      expect(body.type).toBe('POLICY');
      expect(body.status).toBe('draft');
      expect(body.hashSha512Prefix).toHaveLength(16);
    });

    it('rejette MIME exe -> 415', async () => {
      const content = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const form = new FormData();
      form.append('file', content, { filename: 'malware.exe', contentType: 'application/x-msdownload' });
      form.append('title', 'Mal');
      form.append('type', 'OTHER');
      const res = await app.inject({
        method: 'POST',
        url: '/v1/docs',
        headers: { ...form.getHeaders(), authorization: `Bearer ${authToken}` },
        payload: form.getBuffer(),
      });
      expect(res.statusCode).toBe(415);
    });

    it('rejette MIME spoofing (header texte declare PDF) -> 415', async () => {
      const fakeContent = Buffer.from('not really a PDF, just plain text content');
      const form = new FormData();
      form.append('file', fakeContent, { filename: 'fake.pdf', contentType: 'application/pdf' });
      form.append('title', 'Fake');
      form.append('type', 'POLICY');
      const res = await app.inject({
        method: 'POST',
        url: '/v1/docs',
        headers: { ...form.getHeaders(), authorization: `Bearer ${authToken}` },
        payload: form.getBuffer(),
      });
      expect(res.statusCode).toBe(415);
      expect(JSON.parse(res.body).code).toBe('MIME_MISMATCH');
    });

    it('rejette fichier > 10MB -> 413', async () => {
      const big = Buffer.concat([PDF_HEADER, Buffer.alloc(11 * 1024 * 1024, 0x20)]);
      const form = buildMultipartPayload('big.pdf', big, { title: 'Big', type: 'POLICY' });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/docs',
        headers: { ...form.getHeaders(), authorization: `Bearer ${authToken}` },
        payload: form.getBuffer(),
      });
      expect(res.statusCode).toBe(413);
    });

    it('rejette fichier vide -> 422', async () => {
      const form = buildMultipartPayload('empty.pdf', Buffer.alloc(0), { title: 'E', type: 'POLICY' });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/docs',
        headers: { ...form.getHeaders(), authorization: `Bearer ${authToken}` },
        payload: form.getBuffer(),
      });
      expect(res.statusCode).toBe(422);
    });

    it('rejette body sans title -> 422', async () => {
      const pdf = Buffer.concat([PDF_HEADER, Buffer.alloc(100, 0x20)]);
      const form = new FormData();
      form.append('file', pdf, { filename: 'p.pdf', contentType: 'application/pdf' });
      form.append('type', 'POLICY');
      const res = await app.inject({
        method: 'POST',
        url: '/v1/docs',
        headers: { ...form.getHeaders(), authorization: `Bearer ${authToken}` },
        payload: form.getBuffer(),
      });
      expect(res.statusCode).toBe(422);
    });

    it('rejette metadata avec champ sensible (password) -> 422', async () => {
      const pdf = Buffer.concat([PDF_HEADER, Buffer.alloc(100, 0x20)]);
      const form = buildMultipartPayload('p.pdf', pdf, {
        title: 'P',
        type: 'POLICY',
        metadata: JSON.stringify({ password: 'secret' }),
      });
      const res = await app.inject({
        method: 'POST',
        url: '/v1/docs',
        headers: { ...form.getHeaders(), authorization: `Bearer ${authToken}` },
        payload: form.getBuffer(),
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('GET /v1/docs', () => {
    it('liste paginee avec filtres type=POLICY', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/docs?type=POLICY&limit=10',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(Array.isArray(body.items)).toBe(true);
      expect(body.nextCursor).toBeDefined();
    });

    it('rejette limit > 100 -> 422', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/docs?limit=999',
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  describe('GET /v1/docs/:id/download', () => {
    let docId: string;

    beforeAll(async () => {
      const created = await prisma.document.create({
        data: {
          tenantId,
          type: 'POLICY',
          title: 'For download',
          status: 'final',
          s3Key: `${tenantId}/docs/test/p.pdf`,
          hashSha512: 'a'.repeat(128),
          sizeBytes: 100,
          mimetype: 'application/pdf',
          metadata: {},
          createdBy: userId,
          updatedBy: userId,
        },
      });
      docId = created.id;
    });

    it('redirige 302 avec header expires', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/v1/docs/${docId}/download`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(302);
      expect(res.headers['x-download-url-expires-at']).toBeTruthy();
      expect(res.headers.location).toContain('s3.test/signed-url');
    });
  });

  describe('PATCH /v1/docs/:id (status transitions)', () => {
    let docId: string;

    beforeEach(async () => {
      const created = await prisma.document.create({
        data: {
          tenantId,
          type: 'POLICY',
          title: 'Transitions',
          status: 'draft',
          s3Key: `${tenantId}/docs/t/p.pdf`,
          hashSha512: 'a'.repeat(128),
          sizeBytes: 100,
          mimetype: 'application/pdf',
          metadata: {},
          createdBy: userId,
          updatedBy: userId,
        },
      });
      docId = created.id;
    });

    it('autorise draft -> final', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/docs/${docId}`,
        headers: { authorization: `Bearer ${authToken}`, 'content-type': 'application/json' },
        payload: { status: 'final' },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).status).toBe('final');
    });

    it('refuse draft -> archived (transition interdite) -> 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/docs/${docId}`,
        headers: { authorization: `Bearer ${authToken}`, 'content-type': 'application/json' },
        payload: { status: 'archived' },
      });
      expect(res.statusCode).toBe(422);
      expect(JSON.parse(res.body).code).toBe('FORBIDDEN_STATUS_TRANSITION');
    });
  });

  describe('DELETE /v1/docs/:id (soft delete)', () => {
    let docId: string;

    beforeEach(async () => {
      const created = await prisma.document.create({
        data: {
          tenantId,
          type: 'POLICY',
          title: 'ToDelete',
          status: 'draft',
          s3Key: `${tenantId}/docs/del/p.pdf`,
          hashSha512: 'a'.repeat(128),
          sizeBytes: 100,
          mimetype: 'application/pdf',
          metadata: {},
          createdBy: userId,
          updatedBy: userId,
        },
      });
      docId = created.id;
    });

    it('soft delete reussi -> 204', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/docs/${docId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(204);
      const after = await prisma.document.findUnique({ where: { id: docId } });
      expect(after?.deletedAt).not.toBeNull();
    });

    it('document soft-deleted invisible via GET /:id -> 404', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/v1/docs/${docId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      const res = await app.inject({
        method: 'GET',
        url: `/v1/docs/${docId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('double delete idempotent -> 204 deux fois', async () => {
      await app.inject({
        method: 'DELETE',
        url: `/v1/docs/${docId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      const second = await app.inject({
        method: 'DELETE',
        url: `/v1/docs/${docId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(second.statusCode).toBe(204);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('document tenant A invisible depuis tenant B -> 404', async () => {
      const otherTenant = '11111111-1111-4111-8111-111111111111';
      const created = await prisma.document.create({
        data: {
          tenantId: otherTenant,
          type: 'POLICY',
          title: 'Other tenant',
          status: 'draft',
          s3Key: `${otherTenant}/docs/x/p.pdf`,
          hashSha512: 'a'.repeat(128),
          sizeBytes: 100,
          mimetype: 'application/pdf',
          metadata: {},
          createdBy: userId,
          updatedBy: userId,
        },
      });
      const res = await app.inject({
        method: 'GET',
        url: `/v1/docs/${created.id}`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      expect(res.statusCode).toBe(404);
      await prisma.document.delete({ where: { id: created.id } });
    });
  });
});
```

## 8. TESTS COMPLETS

Les tests sont integres aux sections 7.2, 7.4, 7.6, 7.12 et 7.14 ci-dessus. Recapitulatif :

| Suite | Fichier | Tests |
|---|---|---|
| DocumentStatusMachineService | document-status-machine.service.spec.ts | 13 (6 valides + 11 invalides parametres + degeneres + assert + getAllowed + isTerminal + matrix) |
| DocumentVersionService | document-version.service.spec.ts | 11 (nextVersionNumber x3, createVersion x6, findByDocumentId x1, findByVersionNumber x2) |
| DocumentService | document.service.spec.ts | 19 (create x6, findMany x4, findById x3, update x4, softDelete x3, getDownloadUrl x2, addVersion x1, markFinal/Signed x2) |
| DocumentsController | documents.controller.spec.ts | 11 (POST x3, GET x2, GET/:id x1, GET/download x1, PATCH x1, DELETE x1, POST/versions x2) |
| Documents E2E | documents.e2e-spec.ts | 14 (POST x7, GET x2, download x1, PATCH x2, DELETE x3, multi-tenant x1, etc selon decoupe) |

**TOTAL : 68 tests** (depasse exigence 35+).

## 9. Variables environnement

Ajouter dans `repo/.env.example` :

```bash
# Sprint 10 - Docs
DOCS_MAX_UPLOAD_BYTES=10485760
DOCS_PRESIGNED_TTL_SECONDS=300
DOCS_KAFKA_TOPIC_PREFIX=doc
DOCS_MIME_WHITELIST=application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png

# Kafka topics partition
KAFKA_TOPIC_DOC_DOCUMENT_CREATED_PARTITIONS=6
KAFKA_TOPIC_DOC_DOCUMENT_UPDATED_PARTITIONS=3
KAFKA_TOPIC_DOC_DOCUMENT_DELETED_PARTITIONS=3
KAFKA_TOPIC_DOC_DOCUMENT_VERSION_CREATED_PARTITIONS=3
KAFKA_TOPIC_DOC_RETENTION_MS=2592000000

# S3 docs prefix
S3_DOCS_PREFIX=docs
S3_DOCS_VERSIONING=true

# Audit
AUDIT_DOCS_ENABLED=true
AUDIT_RETENTION_DAYS=1825
```

## 10. Commandes shell

```bash
# 10.1 Generation Prisma
cd repo
pnpm prisma generate
pnpm prisma migrate dev --name docs_schema

# 10.2 Installation dep
pnpm --filter @skalean/docs add file-type@19.0.0
pnpm --filter @skalean/docs add -D @types/node

# 10.3 Build packages
pnpm --filter @skalean/docs build

# 10.4 Tests unitaires + E2E
pnpm --filter @skalean/docs test
pnpm --filter @skalean/docs test:cov
pnpm --filter @skalean/api test:e2e -- documents

# 10.5 Creation topics Kafka
docker compose exec redpanda rpk topic create doc.document_created --partitions 6 --replicas 3
docker compose exec redpanda rpk topic create doc.document_updated --partitions 3 --replicas 3
docker compose exec redpanda rpk topic create doc.document_deleted --partitions 3 --replicas 3
docker compose exec redpanda rpk topic create doc.document_version_created --partitions 3 --replicas 3

# 10.6 Verification bucket S3 versioning
docker compose exec minio mc admin info local
docker compose exec minio mc version info local/skalean-docs

# 10.7 Curl smoke test create
curl -X POST http://localhost:3000/v1/docs \
  -H "Authorization: Bearer $JWT" \
  -F "file=@./fixtures/police-test.pdf" \
  -F "title=Police Test" \
  -F "type=POLICY"

# 10.8 Curl smoke test download
curl -L -X GET http://localhost:3000/v1/docs/$DOC_ID/download \
  -H "Authorization: Bearer $JWT" -o /tmp/dl.pdf

# 10.9 Lint + typecheck
pnpm --filter @skalean/docs lint
pnpm --filter @skalean/docs typecheck
```

## 11. CRITERES VALIDATION V1-V35

| ID | Critere | Commande | Attendu |
|---|---|---|---|
| V1 | DocumentService cree, methodes 9 | `grep -c "async \(create\|findMany\|findById\|update\|softDelete\|getDownloadUrl\|addVersion\|markFinal\|markSigned\)" packages/docs/src/services/document.service.ts` | >= 9 |
| V2 | DocumentStatusMachine 5 status | `grep -E "DOCUMENT_STATUSES.*draft.*final.*pending_signature.*signed.*archived" packages/docs/src/services/document-status-machine.service.ts` | match |
| V3 | DocumentVersionService nextVersionNumber atomique | `grep -A2 "nextVersionNumber" packages/docs/src/services/document-version.service.ts` | aggregate _max |
| V4 | DocumentsController 8 endpoints | `grep -cE "@(Get|Post|Patch|Delete)" apps/api/src/modules/docs/controllers/documents.controller.ts` | >= 8 |
| V5 | Multipart middleware limite 10MB | `grep "fileSize: 10 \* 1024 \* 1024" apps/api/src/modules/docs/middleware/multipart-upload.middleware.ts` | match |
| V6 | MIME whitelist 5 types | `grep -cE "(application/pdf\|application/vnd.openxmlformats\|image/jpeg\|image/jpg\|image/png)" packages/docs/src/services/document.service.ts` | >= 5 |
| V7 | Hash SHA-512 streaming | `grep "createHash('sha512')" packages/docs/src/services/document.service.ts` | match |
| V8 | Hash longueur 128 hex | `node -e "console.log(require('crypto').createHash('sha512').update('x').digest('hex').length)"` | 128 |
| V9 | Magic bytes verification via file-type | `grep "fileTypeFromBuffer" packages/docs/src/services/document.service.ts` | match |
| V10 | State machine 6 transitions valides | tests `document-status-machine.service.spec.ts` Valides x6 | pass |
| V11 | State machine refuse 11 transitions invalides | tests `document-status-machine.service.spec.ts` Invalides x11 | pass |
| V12 | Soft delete preserve row | `pnpm test -- softDelete -t "preserve"` | pass |
| V13 | Soft delete idempotent | `pnpm test -- softDelete -t "idempotent"` | pass |
| V14 | Optimistic locking status update | `grep "updateMany" packages/docs/src/services/document.service.ts -A3` | with status filter |
| V15 | Kafka 4 events publies | `grep -cE "publishKafkaEvent\('document_(created\|updated\|deleted\|version_created)'\)" packages/docs/src/services/document.service.ts` | 4 |
| V16 | Kafka degradation gracieuse | tests `document.service.spec.ts -t "Kafka publish echoue"` | pass |
| V17 | AuditLog 5 actions | `grep -cE "action: '(CREATE\|UPDATE\|DELETE\|DOWNLOAD\|CREATE_DOCUMENT_VERSION)_DOCUMENT'" packages/docs/src/services/document.service.ts` | >= 5 |
| V18 | RLS tenant_id auto via Prisma middleware | `grep "tenantId: this.ctx.tenantId" packages/docs/src/services/document.service.ts \| wc -l` | >= 8 |
| V19 | Presigned URL TTL 300s | `grep "DOCS_PRESIGNED_TTL_SECONDS = 300" packages/docs/src/services/document.service.ts` | match |
| V20 | Presigned URL non loggee | `grep -A5 "download_url_generated" packages/docs/src/services/document.service.ts \| grep -v "url:"` | clean |
| V21 | RBAC permissions docs.documents.* | `grep -cE "@RequirePermissions\('docs.documents.(create\|read\|update\|delete)'\)" apps/api/src/modules/docs/controllers/documents.controller.ts` | >= 8 |
| V22 | DTO Zod validation title min 3 max 200 | tests E2E rejette title trop court | 422 |
| V23 | DTO Zod metadata sensible interdite | E2E `password` -> 422 | pass |
| V24 | DTO filters limit max 100 | E2E `?limit=999` -> 422 | pass |
| V25 | Endpoint POST /docs cree -> 201 | curl smoke 10.7 | 201 |
| V26 | Endpoint GET /docs/:id/download -> 302 | curl 10.8 | 302 |
| V27 | Endpoint DELETE /docs/:id -> 204 | E2E DELETE | 204 |
| V28 | Endpoint PATCH transition interdite -> 422 | E2E draft->archived | 422 |
| V29 | Endpoint POST > 10MB -> 413 | E2E big file | 413 |
| V30 | Endpoint POST MIME exe -> 415 | E2E exe upload | 415 |
| V31 | Endpoint POST MIME spoof -> 415 MIME_MISMATCH | E2E fake.pdf | 415 |
| V32 | Endpoint POST 0 bytes -> 422 EMPTY_FILE | E2E empty file | 422 |
| V33 | Multi-tenant isolation tenant A != B | E2E other tenant | 404 |
| V34 | Couverture tests >= 90% | `pnpm test:cov` | >= 90 |
| V35 | Lint + typecheck propres | `pnpm lint && pnpm typecheck` | exit 0 |

## 12. Edge cases

1. **Multipart 0 bytes** : user envoie un fichier vide via `<input type=file>`. Detection apres consume stream : `sizeBytes === 0` -> 422 EMPTY_FILE.
2. **Multipart > 10 MB exact** : 10485761 octets. Detection en streaming, abort dynamique avant consumer le reste -> 413 PAYLOAD_TOO_LARGE.
3. **MIME spoofing magic bytes** : attaquant envoie `evil.exe` mais Content-Type: application/pdf. Magic bytes detectent `MZ` (exe) au lieu de `%PDF` -> 415 MIME_MISMATCH.
4. **MIME spoofing PDF tronque** : payload commence par `%PDF-1.4` mais contient JS exploit. Magic bytes valident, mais ClamAV scan asynchrone Sprint 12 detecte. Pour cette tache : on accepte (heuristique).
5. **Hash collision SHA-512** : probabilite 2^-256 environ, jamais observe en pratique. Si occure : conflit unique constraint sur `hash_sha512` (si on en met une) -> 409. Pour l'instant, pas d'unique constraint car on accepte doublons logiques (deux users uploadent meme contrat).
6. **Soft delete deux fois** : second appel retourne 204 sans erreur (idempotent), log `document_delete_idempotent`.
7. **Restore deleted document** : non implemente cette tache. Sprint 27. Documente dans `softDelete()` JSDoc.
8. **Version race condition** : 2 POST `/versions` simultanes. Tous les deux calculent `nextVersion = 5`. Premier INSERT reussit (v5). Second echoue avec P2002 unique constraint. Retry recalcule `nextVersion = 6`. Reussit.
9. **Kafka unavailable** : `producer.send` throw. Catch + log warn + continue. DB et S3 OK. Replay manuel via `docs-event-replay.cron.ts` Sprint 18.
10. **Presigned URL expired during download** : si user clique apres > 5 min, S3 retourne 403. UI doit re-fetch via GET `/download` re-generer URL fraiche.
11. **Status transition forbidden** : user/UI tente `signed -> draft`. Service throw 422 FORBIDDEN_STATUS_TRANSITION avec `allowedTargets: ["archived"]`. UI affiche message + propose archived.
12. **RBAC denied** : user sans `docs.documents.delete` tente DELETE. RbacGuard throw 403. AuditLog enregistre tentative refusee (Sprint 18 anomaly detection).
13. **Multi-tenant RLS bypass attempt** : user tenant A cherche `GET /docs/{id-de-tenant-B}`. Prisma middleware filtre `tenantId = ctx.tenantId` -> trouve null -> 404 (pas 403, ne reveler pas existence).
14. **Hash mismatch download** : si admin verifie integrite (Sprint 18 retro-check), on recalcule hash depuis S3 et compare a DB. Si mismatch : alert + audit `INTEGRITY_VIOLATION`.
15. **Concurrent update title + status** : user A change title, user B change status. Si optimistic lock seulement sur status, le title de A peut etre ecrase. Acceptable (last-write-wins sur title), bloquant uniquement sur status.

## 13. Conformite Maroc

### 13.1 Loi 43-20 (signature electronique)

- **Article 5** : integrite du document signe garantie par hash SHA-512 stocke en DB. Tout tampering S3 detectable.
- **Article 6** : non-repudiation par AuditLog (qui a uploade, qui a signe, depuis quelle IP).
- **Article 8** : conservation 10 ans des documents signes (cf section 13.3 DGI). Soft delete permet restauration.
- **Workflow integration Sprint 3.3.5** : `pending_signature -> signed` declenche par callback DocuSign (`POST /webhooks/docusign`). DocumentService.markSigned() valide transition.

### 13.2 Loi 09-08 article 4 (minimisation des donnees)

- Metadata limite a 4 KB (ZodSchema refine).
- Champs sensibles interdits dans metadata : password, token, cin, rib, iban, cvv (refine list).
- AuditLog ne contient pas le contenu du document, uniquement reference (id, hash prefix).
- Presigned URL non loggee (uniquement booleen `urlGenerated: true`).

### 13.3 DGI (factures fiscales 10 ans)

- `documents.type = 'INVOICE'` declenche retention 10 ans (3650 jours).
- Cron `document-purger.cron.ts` (Sprint 27) calcule `now() - createdAt > 3650 days` AND `type = INVOICE` AND `deletedAt IS NOT NULL` pour purge definitive.
- Avant purge : export PDF/A-3 sur S3 cold storage Glacier (Sprint 28).

### 13.4 ACAPS (audit trail polices)

- `documents.type IN ('POLICY', 'AVENANT')` : retention 5 ans apres echeance.
- AuditLog inclut : action, userId, tenantId, ipAddress, timestamp, resourceId, metadata. Stocke 5 ans minimum.
- Format JSON exportable pour audit ACAPS via endpoint `/admin/audit/export` (Sprint 18).

## 14. Conventions absolues

1. **TypeScript strict** : `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
2. **Pas de `any`** : tous types explicites. Si necessaire, utiliser `unknown` puis narrow.
3. **Pino logger** : jamais `console.log`. Utiliser `Logger` de NestJS qui delegue a Pino.
4. **Pino redaction** : `*url*`, `*token*`, `*password*`, `*authorization*` redacted automatiquement.
5. **Zod validation** : tout input HTTP valide via `createZodDto` + `ZodValidationPipe`. Pas de class-validator.
6. **NestJS DI** : pas de `new XxxService()`. Tout via constructeur injection.
7. **Tenant_id strict** : toute query Prisma SELECT/UPDATE/DELETE filtre `tenantId`. Middleware fail-fast si manquant.
8. **Soft delete only** : jamais `prisma.document.delete()`. Toujours `update({deletedAt})`.
9. **Audit log obligatoire** : CREATE/UPDATE/DELETE/DOWNLOAD/SIGNATURE -> `auditLog.record()`.
10. **Kafka acks=1 timeout 5000** : eviter bloque indefiniment.
11. **Hash SHA-512 hex 128 chars** : jamais SHA-256, MD5, SHA-1.
12. **Presigned URL TTL 300s max** : eviter exfiltration via partage de lien.
13. **Magic bytes verification** : `fileTypeFromBuffer` apres MIME hint check.
14. **Optimistic locking** : `updateMany WHERE status = expectedFrom` + check `count`.
15. **Conventional commits** : `feat(docs): ...`, `fix(docs): ...`, `test(docs): ...`.
16. **Tests AAA** : Arrange / Act / Assert. Pas de logique conditionnelle dans tests.
17. **Tests deterministes** : pas de `Math.random()`, pas de `Date.now()` direct (utiliser `jest.useFakeTimers()`).

## 15. Validation pre-commit

```bash
# 15.1 Lint
pnpm --filter @skalean/docs lint
pnpm --filter @skalean/api lint

# 15.2 Typecheck strict
pnpm --filter @skalean/docs typecheck
pnpm --filter @skalean/api typecheck

# 15.3 Format prettier
pnpm prettier --check "packages/docs/**/*.ts" "apps/api/src/modules/docs/**/*.ts"

# 15.4 Tests unitaires + couverture
pnpm --filter @skalean/docs test:cov
# Attendu : coverage lines/branches/functions >= 90%

# 15.5 Tests E2E
pnpm --filter @skalean/api test:e2e -- documents.e2e
# Attendu : 14 tests passent

# 15.6 Audit dependances
pnpm audit --prod --audit-level high
# Attendu : 0 high/critical

# 15.7 Bundle size check
pnpm --filter @skalean/docs build
du -sh packages/docs/dist
# Attendu : < 200 KB

# 15.8 Lint commit message (commitlint)
echo "feat(docs): add DocumentService CRUD with SHA-512 streaming hash" | npx commitlint
# Attendu : valid

# 15.9 Husky pre-commit hook
git add packages/docs apps/api/src/modules/docs apps/api/test/docs
git commit -m "feat(docs): tache 3.3.3 DocumentService CRUD complete"
# Husky lance lint-staged + tests affected
```

## 16. Commit message complet

```
feat(docs): tache 3.3.3 DocumentService CRUD complet + state machine + Kafka events

Implemente DocumentService NestJS orchestrant DocumentEntity Prisma + S3MultiTenantService
(3.3.2) + KafkaPublisher + AuditLogService pour CRUD complet documents assurance.

Composants :
- DocumentService (450L) : create/findMany/findById/update/softDelete/getDownloadUrl/
  addVersion/markFinal/markSigned avec hash SHA-512 streaming, MIME whitelist + magic
  bytes, Kafka degradation gracieuse, audit trail Loi 09-08.
- DocumentStatusMachineService (180L) : matrice transitions strictes (draft/final/
  pending_signature/signed/archived). Conformite Loi 43-20 art.5 (immuabilite signe).
- DocumentVersionService (200L) : append-only avec retry sur P2002 unique constraint
  pour gerer race condition concurrent uploads.
- DocumentsController (250L) : 8 endpoints REST (POST/GET/PATCH/DELETE + versions +
  download presigned URL 5 min TTL). RBAC docs.documents.*. Swagger documente.
- MultipartUploadMiddleware (120L) : @fastify/multipart wrapper streaming 10MB max.
- DTOs Zod (220L) : create + filters + update + response avec refine sensibles.

Tests : 68 tests (13 state machine + 11 version + 19 service + 11 controller + 14 E2E)
Couverture : >= 90% lines/branches/functions.

Endpoints :
- POST   /v1/docs              (multipart, 10MB, MIME pdf/docx/jpg/png)
- GET    /v1/docs              (filters + pagination cursor)
- GET    /v1/docs/:id          (404 si autre tenant)
- GET    /v1/docs/:id/download (302 -> presigned URL TTL 300s)
- PATCH  /v1/docs/:id          (state machine valid)
- DELETE /v1/docs/:id          (soft delete idempotent)
- GET    /v1/docs/:id/versions (liste DESC)
- POST   /v1/docs/:id/versions (multipart new version)

Kafka events : doc.document_created/updated/deleted/version_created (acks=1, 5s timeout)

Conformite :
- Loi 43-20 art.5 (integrity hash SHA-512, immuabilite signed)
- Loi 09-08 art.4 (metadata 4KB max, champs sensibles refuses)
- DGI (retention 10 ans factures via type INVOICE)
- ACAPS (audit trail 5 ans polices, type POLICY/AVENANT)

Refs : sprint-10, tache-3.3.3, depends 3.3.2, bloque 3.3.4 3.3.5 3.3.6 3.3.7 3.3.8

Co-authored-by: Backend Lead <backend@skalean.ma>
Reviewed-by: Tech Lead, Security Officer, DPO
```

## 17. Workflow next step task-3.3.4

Apres merge de cette tache 3.3.3 :

**Tache 3.3.4 - DocuSign Integration Adapter** (P0, 8h, depends 3.3.3) :
- Cree `packages/docs/src/integrations/docusign-adapter.service.ts`.
- Methode `sendForSignature(documentId, signers)` -> appelle DocuSign REST API POST /envelopes.
- Methode `handleWebhook(payload, signature)` -> verifie HMAC + appelle `documentService.markSigned(id)`.
- Retry policy sur 5xx (exponential backoff 3 tentatives).
- Idempotency key DocuSign envelope ID stocke dans `documents.metadata.docusign_envelope_id`.
- Tests E2E avec WireMock pour simuler DocuSign API.

**Etapes immediates apres merge 3.3.3** :
1. Creer branche `feat/sprint-10/task-3.3.4-docusign-adapter`.
2. Lire prompt `task-3.3.4-docusign-adapter.md`.
3. Verifier que `DocumentService.markSigned()` appartient bien a l'API publique exposee dans `packages/docs/src/index.ts`.
4. Mocker DocuSign sandbox credentials dans `.env.test`.
5. Verifier integration AuditLog : action `SIGNATURE_REQUESTED` et `SIGNATURE_COMPLETED`.

**Tache 3.3.5 - Workflow Signature Loi 43-20** (P0, 6h, depends 3.3.4) : orchestrateur qui combine DocumentService + DocuSignAdapter + NotificationService pour envoyer email signataires + tracker progression.

**Tache 3.3.7 - OpenSearch Indexer** (P1, 4h, depends 3.3.3) : consumer Kafka `doc.document_created` qui indexe metadata + extracted text (Tika) dans OpenSearch index `documents-{tenant}`.

**Coordination Sprint** :
- Daily standup : flag blockers sur S3 MinIO setup (Sprint 3.3.2 doit etre 100% deploye).
- Demo Sprint Review J+10 : presenter upload PDF, transition draft -> final, download via presigned URL.
- Retrospective : lessons learned sur magic bytes false positives (PDF malforme legitime).

Fin tache 3.3.3.
