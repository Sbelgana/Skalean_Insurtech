# Tache 3.3.7 - Barid eSign API Client undici HTTP + Workflow Envoi Document + Tracking + Completion + Mock Provider Tests + Signature Type 'qualified' (ANRT certificate -> loi 43-20 valeur juridique manuscrit) + Error Handling Typed + Retry Exponential

**Sprint**: 10 - Docs + Signature Loi 43-20
**Phase**: 3 - Provider Integration
**Priorite**: P0 (CRITIQUE - bloquant signature electronique conforme legalement)
**Effort estime**: 6 heures
**Depends**: Tache 3.3.6 (Signature module structure + ISignatureProvider interface)
**Bloque**: Tache 3.3.8 (Webhook handler Barid signature events) + Tache 3.3.9 (HMAC webhook signature verification) + Tache 3.3.10 (Signature workflow orchestrator)
**Owner**: Backend Lead + Compliance Officer (revue conformite ANRT/ACAPS)

---

## 1. HEADER METADATA

| Champ | Valeur |
|-------|--------|
| Tache ID | 3.3.7 |
| Sprint | 10 |
| Phase | 3 (Provider Integration) |
| Domaine | signature |
| Sous-domaine | providers/barid-esign |
| Type | feature-implementation |
| Effort | 6h |
| Priorite | P0 |
| Risque | TRES ELEVE (compliance loi 43-20 + cout reel API Barid + dependance externe Poste Maroc) |
| Couverture cible | 92% lines / 88% branches |
| Reviewers | Backend Lead, Compliance Officer, Security Architect |
| Decisions liees | decision-008 (Atlas Cloud Services data residency), decision-009 (Barid eSign provider exclusif loi 43-20), decision-014 (signature qualified par defaut), decision-021 (mock mode strict CI/dev) |
| ADR liees | ADR-007-signature-electronique-loi-43-20.md, ADR-009-provider-barid-exclusif.md |
| Documents reference | LOI-43-20-Article-5.pdf, ANRT-Decret-2-08-518.pdf, ACAPS-Circulaire-2018-01.pdf, Barid-eSign-API-v1-Spec.pdf |

---

## 2. BUT (3 paragraphes - signification metier + legale + technique)

**Paragraphe 1 - Equivalence legale signature manuscrite (loi 43-20 article 5)**
Cette tache implemente le client TypeScript pour l'API Barid eSign de Poste Maroc, le seul prestataire certifie a la fois par l'ANRT (Agence Nationale de Reglementation des Telecommunications) au titre du Decret n° 2-08-518 du 21 mai 2009 et par l'ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale) au titre de la Circulaire 2018/01 sur la dematerialisation des contrats d'assurance. L'usage du type de signature `qualified` declenche cote Barid l'utilisation d'un certificat electronique qualifie emis par l'autorite de certification de Poste Maroc, ce qui confere a la signature electronique resultante la **valeur juridique d'une signature manuscrite** au sens de l'article 5 de la loi n° 43-20 relative aux services de confiance pour les transactions electroniques (promulguee par le Dahir n° 1-20-100 du 31 decembre 2020). En consequence, tout contrat d'assurance signe via ce client avec `signature_type=qualified` est legalement opposable devant les juridictions marocaines sans necessite d'apposition de signature manuscrite physique, eliminant le besoin d'impression-signature-scan-archivage papier qui represente actuellement 60% du temps de souscription chez Skalean.

**Paragraphe 2 - Architecture technique resiliente et auditable**
Le client est implemente comme un service NestJS injectable `BaridEsignClient` implementant l'interface `ISignatureProvider` (definie en Tache 3.3.6), garantissant l'interchangeabilite future si un autre prestataire venait a etre certifie. La couche HTTP `BaridHttpClient` utilise undici (HTTP/1.1 et HTTP/2 natif Node.js, plus performant que axios et nativement supporte par NestJS 10+) avec retry exponentiel borne (3 tentatives, base 500ms, plafond 8s, jitter aleatoire), circuit breaker (ouverture apres 5 echecs consecutifs en fenetre 60s, half-open apres 30s), et timeout strict 10 secondes. L'authentification combine API Key Bearer (rotation trimestrielle obligatoire ANRT) et idempotency key UUID v7 par requete (deduplication 24h cote Barid). Tous les appels sortants sont traces via Pino avec correlation_id, tenant_id, document_id, signers_count, et redaction automatique des secrets (BARID_ESIGN_API_KEY, certificats mTLS). Les erreurs sont typees hierarchiquement (`BaridUnavailableError`, `BaridInvalidSignerError`, `BaridSignatureExpiredError`, `BaridQuotaExceededError`, `BaridCertificateRevokedError`, `BaridUnknownError`) pour permettre une gestion fine en amont (retry strategique, fallback, circuit breaker, alerting Sentry).

**Paragraphe 3 - Mock mode pour developpement et tests sans cout**
Barid eSign facture entre 1 et 3 MAD par signature qualifiee (selon volume mensuel contractualise), ce qui rend prohibitif l'usage de l'API reelle en environnements CI/dev/staging. Cette tache fournit un `MockBaridEsignClient` complet implementant l'interface `ISignatureProvider` avec un comportement deterministe en memoire (workflows simules, signers progressivement marques `signed`, generation PDF mock signe, callbacks webhook simules via EventEmitter). Le module NestJS `BaridEsignModule` realise la DI conditionnelle via `BARID_ESIGN_MOCK_MODE` (true par defaut en NODE_ENV=test/development, false strict en production avec garde-fou refusant le boot si mock mode activé en production). Cette approche garantit zero cout API en CI tout en validant exhaustivement les workflows via 30+ tests unitaires et integration. La validation pre-deploiement production inclut un health check appelant l'endpoint `/api/v1/health` reel de Barid pour confirmer credentials valides, certificat mTLS non expire, et quota mensuel non epuise.

---

## 3. CONTEXTE ETENDU (8 KB - decisions, comparatifs providers, pieges techniques)

### 3.1 Pourquoi Barid eSign exclusif vs DocuSign / HelloSign / Adobe Sign

L'analyse comparative menee en septembre 2025 (decision-009) a etabli que **Barid eSign est le seul fournisseur eligible** pour Skalean InsurTech au Maroc, pour les raisons suivantes :

| Critere | Barid eSign (Poste Maroc) | DocuSign | HelloSign (Dropbox) | Adobe Sign |
|---------|---------------------------|----------|---------------------|------------|
| Certification ANRT loi 43-20 | OUI (autorite de certification agreee) | NON | NON | NON |
| Certification ACAPS Circulaire 2018/01 | OUI (prestataire tiers de confiance liste) | NON | NON | NON |
| Equivalence signature manuscrite Maroc | OUI (qualified) | NON (jurisprudence MA refuse) | NON | NON |
| Data residency Maroc (loi 09-08) | OUI (datacenters Atlas Cloud Services Casablanca) | NON (US/EU) | NON (US) | NON (US/EU) |
| Cout par signature | 1-3 MAD | 25-40 MAD | 18-22 MAD | 30-45 MAD |
| Support technique francais/arabe | OUI | EN/FR limite | EN uniquement | EN/FR |
| Latence moyenne depuis Casablanca | 45ms | 220ms | 280ms | 195ms |
| API REST documentee | OUI (v1 stable) | OUI | OUI | OUI |
| Webhook callbacks signes HMAC | OUI (HMAC-SHA256) | OUI | OUI | OUI |
| Audit trail PDF certifie | OUI (horodatage qualifie) | OUI | OUI | OUI |
| Integration mTLS optionnelle | OUI (recommande prod) | NON | NON | OUI |
| SLA contractualisable | 99.5% (contrat enterprise) | 99.9% | 99.5% | 99.9% |

**Conclusion decision-009** : DocuSign/HelloSign/Adobe Sign produisent des signatures electroniques qui ne sont **PAS** equivalentes a une signature manuscrite au Maroc. Une jurisprudence du Tribunal de Commerce de Casablanca du 14 mars 2023 (affaire Allianz vs Particulier X) a explicitement refuse la valeur probante d'une signature DocuSign sur un contrat d'assurance, motivant le rejet par l'absence de certificat qualifie ANRT. Skalean ne peut donc utiliser que Barid eSign pour les contrats d'assurance, sous peine de nullite contractuelle systematique en cas de contentieux.

### 3.2 Decision-008 - Data residency Atlas Cloud Services

Barid eSign opere ses serveurs sur l'infrastructure **Atlas Cloud Services** (datacenter Casablanca-Settat, ISO 27001/27017/27018 + agrement CNDP). Skalean InsurTech ayant egalement choisi Atlas Cloud Services comme cloud provider primaire (decision-008), les appels Skalean -> Barid sont **co-localises au sein du meme AZ**, garantissant une latence sub-50ms et evitant tout transit de donnees personnelles hors du Maroc (conformite loi 09-08 stricte sans necessite d'autorisation CNDP transfer transfrontalier). Cette synergie est un argument decisif vs concurrents AWS Bahrain/Frankfurt qui imposent un transit international.

### 3.3 Trade-off cout : 1-3 MAD vs 25 MAD DocuSign

A volume cible de 50 000 signatures/mois (objectif fin 2026), l'ecart de cout est :
- Barid eSign : 50 000 * 2 MAD = 100 000 MAD/mois
- DocuSign : 50 000 * 25 MAD = 1 250 000 MAD/mois
- **Economie annuelle Barid vs DocuSign** : 13.8 MMAD/an

Cette economie justifie l'investissement dans le mock mode strict (cette tache) pour eviter tout appel API en CI/dev (50 developpeurs * 100 signatures test/jour * 22 jours = 110 000 MAD/mois evites uniquement en developpement).

### 3.4 12 pieges techniques majeurs identifies

1. **API key rotation trimestrielle ANRT** : ANRT impose rotation tous les 90 jours. Implementer un job cron `BaridApiKeyRotationCheckJob` (Tache 3.3.30) alertant 15 jours avant expiration. Stockage Vault HashiCorp avec lease automatique.

2. **mTLS certificate expiry** : Certificat client mTLS expire 12 mois apres emission. Renouvellement manuel via Poste Maroc (delai 5-10 jours ouvres). Monitoring Prometheus alert `barid_mtls_cert_expires_in_days < 30`.

3. **Idempotency key clash** : Si meme `X-Idempotency-Key` envoye 2 fois en <24h, Barid retourne le **premier** workflow_id (idempotent). Si appel intentionnellement nouveau, generer nouveau UUID v7 (timestamp embarque empeche collision). NE JAMAIS reutiliser un idempotency key apres echec partiel sans verification getRequestStatus prealable.

4. **Mock mode accidentel en production** : Garde-fou strict dans `BaridEsignModule` : `if (process.env.NODE_ENV === 'production' && config.mockMode === true) { throw new Error('FATAL: mock mode forbidden in production') }`. Test e2e dedie verifie ce fail-fast.

5. **Format telephone signataire +212 vs +33** : Barid accepte uniquement E.164 avec prefixe `+212` pour les numeros marocains. Un numero `+33...` (France) est accepte mais le SMS de notification echouera (cout perdu mais signature impossible). Mapper `BaridMappingService.normalizePhone()` enforce regex `^\+212[5-7]\d{8}$` ou `^\+\d{10,15}$` pour internationaux.

6. **Document PDF > 10MB OOM** : Barid limite a 10MB par document. Le client lit le buffer en memoire pour base64 encoding -> risque OutOfMemory si pool eventloop sature. Mitigation : streaming via `Readable.from(buffer).pipe()` vers undici body, validation taille amont via `documentSizeBytes <= 10 * 1024 * 1024` avec erreur explicite `BaridDocumentTooLargeError`.

7. **Webhook callback recu AVANT reponse API** : Race condition possible si Barid envoie webhook `signature_completed` avant que notre POST `/signature-requests` n'ait retourne le `workflow_id`. Le webhook handler (Tache 3.3.8) doit gerer le cas `workflow_id inconnu en DB` en buffer Redis (TTL 60s) puis rejouer apres reception API response.

8. **Certificate revoked 451** : Si certificat signataire revoque par CRL ANRT entre signature start et signature complete (cas rare mais existant : decret de revocation pour fraude), Barid retourne 451. Workflow doit etre marque `revoked` et notification compliance@skalean.ma envoyee + creation incident PagerDuty P1.

9. **Quota mensuel exceeded 402** : Barid facture par paliers (10k/50k/100k signatures/mois). Depassement = retour 402 avec `quota_remaining: 0`. Monitor `barid_quota_used_pct > 90%` declenche upgrade automatique tier suivant via API B2B (Tache 3.3.32).

10. **Signer email invalide** : Validation amont via Zod `z.string().email()` insuffisante. Barid verifie MX record du domaine. Si invalide, retourne 422 `INVALID_SIGNER` avec field `email`. Mapper logger warning et marquer signer en erreur sans bloquer les autres.

11. **Network timeout sous charge** : Sous pic de souscriptions (campagne marketing), Barid latence p99 peut atteindre 8-12s. Timeout 10s peut etre insuffisant. Variable env `BARID_ESIGN_TIMEOUT_MS` configurable, valeur par defaut 10000ms, augmentee a 15000ms en periode pics (override via Helm values production-peak).

12. **Webhook signature HMAC clock skew** : Si serveur Skalean clock drift > 5min vs serveur Barid, webhook timestamp validation echoue. Garantir NTP sync via systemd-timesyncd, alert Prometheus `node_timex_offset_seconds > 1.0`.

### 3.5 Trade-offs implementation

- **undici vs axios vs got** : undici choisi pour HTTP/2 natif Node.js (Barid roadmap H2 Q3 2026), absence de transitive deps lourdes (axios pull form-data, follow-redirects), maintenance par equipe Node.js core. Inconvenient : API plus bas niveau (pas d'interceptors built-in -> wrapper maison `BaridHttpClient`).

- **Circuit breaker maison vs opossum library** : opossum (Netflix Hystrix-like) ajoute 850 KB deps. Maison = 80 lignes simples (cb.state {closed, open, half-open}, compteur, timer). Choix maison pour minimiser footprint.

- **Mock in-memory vs nock HTTP interception** : Mock NestJS injectable plus testable (DI propre, pas de side effect HTTP global) vs nock qui intercepte tous les requests Node.js (risque de fuite entre tests paralleles). Choix injectable mock + nock reserve aux tests integration explicites de la couche HTTP.

---

## 4. ARCHITECTURE CONTEXT (sequence diagram + composants)

```
sequenceDiagram
    participant App as Skalean App (NestJS)
    participant Client as BaridEsignClient
    participant Mapper as BaridMappingService
    participant Http as BaridHttpClient (undici)
    participant CB as CircuitBreaker
    participant API as Barid eSign API
    participant ANRT as Autorite Certification ANRT
    participant Signer as Signataire (email/SMS)
    participant Webhook as BaridWebhookHandler

    App->>Client: createSignatureRequest({document, signers, options})
    Client->>Client: CreateSignatureRequestSchema.parse(input)
    Client->>Mapper: toBaridFormat(input)
    Mapper-->>Client: BaridPayload {document_b64, signers[], signature_type:'qualified'}
    Client->>Http: request(POST /signature-requests, payload, X-Idempotency-Key)
    Http->>CB: checkState()
    alt Circuit closed
        CB-->>Http: allow
        Http->>API: HTTP/1.1 POST + Bearer + mTLS
        API->>ANRT: Validate qualified certificate availability
        ANRT-->>API: certificate OK + ANRT_CERT_ID
        API-->>Http: 201 {workflow_id, sign_urls[], expires_at}
        Http-->>Client: response.ok=true
        Client->>Client: log {action:'barid_create_request_success', workflow_id}
        Client-->>App: {provider_workflow_id, sign_urls, expires_at}
        API->>Signer: Email + SMS notification (sign URL)
        Signer->>API: Click sign URL -> identification ANRT -> signature qualifiee
        API->>Webhook: POST /webhooks/barid-esign (HMAC signed)
        Webhook->>App: Update signature workflow status
    else Circuit open
        CB-->>Http: reject (CircuitOpenError)
        Http-->>Client: BaridUnavailableError
        Client-->>App: throw BaridUnavailableError
    end
```

### 4.1 Composants

- **BaridEsignClient** : Facade publique, implemente ISignatureProvider, orchestrate validation + mapping + http + error normalization
- **BaridMappingService** : Mapping bidirectionnel internal types <-> Barid wire format (DTOs)
- **BaridHttpClient** : Couche transport undici + retry + circuit breaker + timeout + Pino logging
- **BaridEsignConfig** : Configuration Zod-validee depuis env vars
- **BaridErrors** : Hierarchie erreurs typees (extends Error)
- **MockBaridEsignClient** : Implementation in-memory pour tests/dev
- **BaridEsignModule** : NestJS module + DI conditionnelle mock vs real

### 4.2 Flux donnees PII (loi 09-08)

Donnees personnelles transmises a Barid (data processor contractuel) :
- Nom, prenom signataire (champ `full_name`)
- Email signataire (champ `email`)
- Telephone E.164 (champ `phone`)
- CIN/Passport (champ `national_id` - optionnel pour identification renforcee)
- IP signature, geolocation (collecte par Barid coté signature)

**Base legale** (loi 09-08 article 4) : execution contrat d'assurance + obligation legale ACAPS.
**Duree conservation** : 10 ans apres echeance contrat (article 23 Code des Assurances + audit trail Barid 10 ans inclus).
**Sous-traitant** : Convention DPA (Data Processing Agreement) signee Skalean-Barid 12 fevrier 2025, ref `DPA-BARID-2025-001`.

---

## 5. LIVRABLES (22 livrables)

1. `BaridEsignClient` service NestJS injectable implementant `ISignatureProvider` complet (7 methodes)
2. `BaridHttpClient` couche transport undici avec retry exponentiel + circuit breaker + timeout + jitter
3. `BaridMappingService` mapping bidirectionnel internal/Barid avec normalisation telephone E.164 +212
4. `BaridEsignConfig` Zod-validated config depuis env vars (8 variables)
5. Hierarchie 7 classes erreurs typees (`BaridError` base + 6 specialisees)
6. `MockBaridEsignClient` mock in-memory deterministe avec EventEmitter webhook simulation
7. `BaridEsignModule` NestJS module DI conditionnelle mock/real avec garde-fou production
8. DTOs TypeScript stricts pour toutes les requetes/reponses Barid (12 types)
9. Validation Zod schemas pour tous les inputs publics (5 schemas)
10. Logging Pino structure avec correlation_id, tenant_id, document_id, redaction secrets
11. Metriques Prometheus exposees : barid_request_duration_seconds, barid_request_total{status,method}, barid_circuit_breaker_state, barid_quota_remaining
12. Tests unitaires BaridEsignClient (15+ tests, coverage 92%+)
13. Tests unitaires BaridHttpClient (8+ tests retry/circuit/timeout)
14. Tests unitaires BaridMappingService (6+ tests mapping + normalisation phone)
15. Tests unitaires MockBaridEsignClient (5+ tests behavior simulation)
16. Tests e2e integration `barid-esign-integration.e2e-spec.ts` (8+ tests workflow complet avec mock server nock)
17. Documentation TSDoc exhaustive sur toutes les methodes publiques avec exemples
18. Variables environnement documentees dans `.env.example` et schema Zod
19. Garde-fou production refusant boot si mock mode active en NODE_ENV=production
20. Health check endpoint `/health/barid` verifiant credentials + quota + circuit state
21. Migration de DI module `SignatureModule` consommant `BaridEsignModule` exporte
22. Commit Conventional Commits respectant convention `feat(signature): ...` avec footer references decisions

---

## 6. FICHIERS A CREER (13 fichiers)

| # | Fichier | Lignes | Type |
|---|---------|--------|------|
| 1 | `repo/packages/signature/src/providers/barid-esign/barid-esign.client.ts` | ~350 | Service principal |
| 2 | `repo/packages/signature/src/providers/barid-esign/barid-esign.client.spec.ts` | ~250 | Tests unitaires |
| 3 | `repo/packages/signature/src/providers/barid-esign/barid-esign.types.ts` | ~150 | DTOs TypeScript |
| 4 | `repo/packages/signature/src/providers/barid-esign/barid-esign.errors.ts` | ~120 | Hierarchie erreurs |
| 5 | `repo/packages/signature/src/providers/barid-esign/barid-esign.config.ts` | ~80 | Config Zod env |
| 6 | `repo/packages/signature/src/providers/barid-esign/barid-http.client.ts` | ~200 | Transport undici |
| 7 | `repo/packages/signature/src/providers/barid-esign/barid-http.client.spec.ts` | ~150 | Tests transport |
| 8 | `repo/packages/signature/src/providers/barid-esign/mock-barid.client.ts` | ~250 | Mock provider |
| 9 | `repo/packages/signature/src/providers/barid-esign/mock-barid.client.spec.ts` | ~120 | Tests mock |
| 10 | `repo/packages/signature/src/providers/barid-esign/barid-esign.module.ts` | ~80 | NestJS module |
| 11 | `repo/packages/signature/src/providers/barid-esign/barid-mapping.service.ts` | ~150 | Mapping service |
| 12 | `repo/packages/signature/src/providers/barid-esign/barid-mapping.service.spec.ts` | ~100 | Tests mapping |
| 13 | `repo/apps/api/test/signature/barid-esign-integration.e2e-spec.ts` | ~300 | Tests e2e integration |

**Total estime** : ~2300 lignes de code TypeScript strict.

---

## 7. CODE COMPLET (13 fichiers detailles ci-dessous)

### 7.1 `barid-esign.types.ts` (DTOs complets)

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-esign.types.ts
import { z } from 'zod';

/**
 * Type de signature electronique selon loi 43-20.
 * - 'simple' : signature simple, valeur probante limitee, NON equivalent manuscrite
 * - 'advanced' : signature avancee, valeur probante intermediaire
 * - 'qualified' : signature qualifiee ANRT, valeur juridique signature manuscrite (loi 43-20 art. 5)
 *
 * USE 'qualified' BY DEFAULT for all insurance contracts (ACAPS Circulaire 2018/01).
 */
export type BaridSignatureType = 'simple' | 'advanced' | 'qualified';

export const BaridSignatureTypeSchema = z.enum(['simple', 'advanced', 'qualified']);

/**
 * Statut workflow Barid (lifecycle).
 */
export type BaridWorkflowStatus =
  | 'draft'
  | 'sent'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'revoked';

export const BaridWorkflowStatusSchema = z.enum([
  'draft', 'sent', 'in_progress', 'completed', 'cancelled', 'expired', 'revoked',
]);

/**
 * Statut individuel signataire.
 */
export type BaridSignerStatus = 'pending' | 'notified' | 'viewed' | 'signed' | 'declined' | 'expired';

export const BaridSignerStatusSchema = z.enum(['pending', 'notified', 'viewed', 'signed', 'declined', 'expired']);

/**
 * Signataire Barid wire format (apres mapping).
 */
export const BaridSignerSchema = z.object({
  signer_id: z.string().uuid(),
  full_name: z.string().min(2).max(200),
  email: z.string().email().max(254),
  phone: z.string().regex(/^\+\d{10,15}$/, 'E.164 format required'),
  national_id: z.string().min(6).max(20).optional(),
  signing_order: z.number().int().min(1).max(50),
  signature_position: z.object({
    page: z.number().int().min(1),
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().min(50).default(200),
    height: z.number().min(20).default(80),
  }).optional(),
  language: z.enum(['fr', 'ar', 'en']).default('fr'),
});

export type BaridSigner = z.infer<typeof BaridSignerSchema>;

/**
 * Document Barid wire format (PDF base64).
 */
export const BaridDocumentSchema = z.object({
  filename: z.string().min(1).max(255).endsWith('.pdf'),
  content_base64: z.string().min(100), // PDF non vide
  content_sha256: z.string().regex(/^[a-f0-9]{64}$/, 'SHA-256 hex required'),
  size_bytes: z.number().int().min(1).max(10 * 1024 * 1024, 'Max 10MB'),
});

export type BaridDocument = z.infer<typeof BaridDocumentSchema>;

/**
 * Input client pour creation requete signature.
 */
export const CreateSignatureRequestSchema = z.object({
  tenant_id: z.string().uuid(),
  document: z.object({
    id: z.string().uuid(),
    filename: z.string().min(1).max(255),
    buffer: z.instanceof(Buffer),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  signers: z.array(z.object({
    id: z.string().uuid(),
    full_name: z.string().min(2).max(200),
    email: z.string().email(),
    phone: z.string().min(10).max(20),
    national_id: z.string().optional(),
    signing_order: z.number().int().min(1).default(1),
    language: z.enum(['fr', 'ar', 'en']).default('fr'),
  })).min(1).max(50),
  signature_type: BaridSignatureTypeSchema.default('qualified'),
  expires_in_days: z.number().int().min(1).max(90).default(7),
  callback_url: z.string().url(),
  metadata: z.record(z.string()).optional(),
  idempotencyKey: z.string().uuid(),
});

export type CreateSignatureRequestInput = z.infer<typeof CreateSignatureRequestSchema>;

export interface CreateSignatureRequestOutput {
  provider_workflow_id: string;
  sign_urls: Array<{ signer_id: string; url: string }>;
  expires_at: string; // ISO 8601
  created_at: string; // ISO 8601
}

/**
 * Output get status.
 */
export interface GetRequestStatusOutput {
  provider_workflow_id: string;
  status: BaridWorkflowStatus;
  signers_status: Array<{
    signer_id: string;
    status: BaridSignerStatus;
    signed_at: string | null;
    declined_reason: string | null;
    ip_address: string | null;
    user_agent: string | null;
  }>;
  last_event_at: string;
  expires_at: string;
  certificate_chain_id: string | null; // ID chaine certifs ANRT pour audit
}

/**
 * Output download (binaire).
 */
export interface DownloadDocumentOutput {
  filename: string;
  content_type: 'application/pdf';
  buffer: Buffer;
  size_bytes: number;
  sha256: string;
}

/**
 * Filtres pour listSignatureRequests.
 */
export const ListSignatureRequestsFiltersSchema = z.object({
  tenant_id: z.string().uuid(),
  status: BaridWorkflowStatusSchema.optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  signer_email: z.string().email().optional(),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(100).default(20),
});

export type ListSignatureRequestsFilters = z.infer<typeof ListSignatureRequestsFiltersSchema>;

/**
 * Reponse API Barid generique (envelope).
 */
export interface BaridApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
  headers: Record<string, string>;
  request_id: string; // X-Request-Id Barid pour audit/support
}
```

### 7.2 `barid-esign.errors.ts` (Hierarchie erreurs typees)

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-esign.errors.ts

/**
 * Classe de base pour toutes les erreurs Barid eSign.
 * Permet `instanceof BaridError` pour catch generique.
 */
export abstract class BaridError extends Error {
  abstract readonly code: string;
  abstract readonly retryable: boolean;
  abstract readonly httpStatus: number;
  public readonly timestamp: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    this.context = context;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      httpStatus: this.httpStatus,
      timestamp: this.timestamp,
      context: this.context,
    };
  }
}

/**
 * Erreur 503 - Service Barid indisponible (maintenance, panne).
 * Retryable avec backoff exponentiel.
 */
export class BaridUnavailableError extends BaridError {
  readonly code = 'BARID_UNAVAILABLE';
  readonly retryable = true;
  readonly httpStatus = 503;
}

/**
 * Erreur 422 INVALID_SIGNER - Signataire invalide (email/telephone format).
 * Non retryable, correction amont requise.
 */
export class BaridInvalidSignerError extends BaridError {
  readonly code = 'BARID_INVALID_SIGNER';
  readonly retryable = false;
  readonly httpStatus = 422;

  constructor(field: string, value?: string) {
    super(`Invalid signer field: ${field}`, { field, value });
  }
}

/**
 * Erreur 410 - Workflow signature expire (au-dela de expires_at).
 */
export class BaridSignatureExpiredError extends BaridError {
  readonly code = 'BARID_SIGNATURE_EXPIRED';
  readonly retryable = false;
  readonly httpStatus = 410;

  constructor(workflowId: string) {
    super(`Signature workflow expired: ${workflowId}`, { workflow_id: workflowId });
  }
}

/**
 * Erreur 402 - Quota mensuel epuise (plan tarifaire depasse).
 */
export class BaridQuotaExceededError extends BaridError {
  readonly code = 'BARID_QUOTA_EXCEEDED';
  readonly retryable = false;
  readonly httpStatus = 402;

  constructor(quotaRemaining: number, quotaLimit: number) {
    super(`Barid quota exceeded: ${quotaRemaining}/${quotaLimit}`, {
      quota_remaining: quotaRemaining,
      quota_limit: quotaLimit,
    });
  }
}

/**
 * Erreur 451 - Certificat ANRT revoque (cas rare mais critique compliance).
 */
export class BaridCertificateRevokedError extends BaridError {
  readonly code = 'BARID_CERTIFICATE_REVOKED';
  readonly retryable = false;
  readonly httpStatus = 451;

  constructor(certificateId: string, revocationReason?: string) {
    super(`Certificate revoked: ${certificateId}`, {
      certificate_id: certificateId,
      revocation_reason: revocationReason,
    });
  }
}

/**
 * Erreur 401/403 - Authentification echouee (API key invalide/expiree).
 */
export class BaridAuthError extends BaridError {
  readonly code = 'BARID_AUTH_ERROR';
  readonly retryable = false;
  readonly httpStatus: number;

  constructor(httpStatus: 401 | 403, detail?: string) {
    super(`Barid authentication failed (${httpStatus}): ${detail ?? 'unknown'}`);
    this.httpStatus = httpStatus;
  }
}

/**
 * Erreur document trop volumineux (>10MB).
 */
export class BaridDocumentTooLargeError extends BaridError {
  readonly code = 'BARID_DOCUMENT_TOO_LARGE';
  readonly retryable = false;
  readonly httpStatus = 413;

  constructor(sizeBytes: number) {
    super(`Document size ${sizeBytes} exceeds 10MB limit`, { size_bytes: sizeBytes });
  }
}

/**
 * Erreur circuit breaker ouvert (failures consecutifs).
 */
export class BaridCircuitOpenError extends BaridError {
  readonly code = 'BARID_CIRCUIT_OPEN';
  readonly retryable = true;
  readonly httpStatus = 503;

  constructor(failuresCount: number, willRetryAt: Date) {
    super(`Circuit breaker open after ${failuresCount} failures`, {
      failures_count: failuresCount,
      will_retry_at: willRetryAt.toISOString(),
    });
  }
}

/**
 * Erreur fallback inconnue (status ou body non reconnu).
 */
export class BaridUnknownError extends BaridError {
  readonly code = 'BARID_UNKNOWN_ERROR';
  readonly retryable = false;
  readonly httpStatus: number;

  constructor(httpStatus: number, body: unknown) {
    super(`Barid unknown error: HTTP ${httpStatus}`, { body });
    this.httpStatus = httpStatus;
  }
}
```

### 7.3 `barid-esign.config.ts` (Config Zod env)

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-esign.config.ts
import { z } from 'zod';
import { Injectable } from '@nestjs/common';

/**
 * Schema Zod pour validation des variables d'environnement Barid eSign.
 * Toute variable manquante ou invalide -> fail-fast au boot.
 */
export const BaridEsignConfigSchema = z.object({
  apiBaseUrl: z.string().url().default('https://api.barid.ma/esign/v1'),
  apiKey: z.string().min(32, 'API key must be >=32 chars').max(256),
  webhookSecret: z.string().min(32, 'Webhook secret must be >=32 chars').max(256),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).default(10000),
  maxRetries: z.coerce.number().int().min(0).max(10).default(3),
  mockMode: z.coerce.boolean().default(false),
  defaultSignatureType: z.enum(['simple', 'advanced', 'qualified']).default('qualified'),
  defaultExpiresDays: z.coerce.number().int().min(1).max(90).default(7),
  mtlsClientCertPath: z.string().optional(),
  mtlsClientKeyPath: z.string().optional(),
  circuitBreakerThreshold: z.coerce.number().int().min(1).max(100).default(5),
  circuitBreakerWindowMs: z.coerce.number().int().min(1000).max(600000).default(60000),
  circuitBreakerHalfOpenAfterMs: z.coerce.number().int().min(1000).max(600000).default(30000),
});

export type BaridEsignConfigType = z.infer<typeof BaridEsignConfigSchema>;

/**
 * Service config Barid injectable.
 * Charge depuis process.env, valide via Zod, expose en lecture seule.
 */
@Injectable()
export class BaridEsignConfig {
  private readonly config: Readonly<BaridEsignConfigType>;

  constructor() {
    const raw = {
      apiBaseUrl: process.env.BARID_ESIGN_API_BASE_URL,
      apiKey: process.env.BARID_ESIGN_API_KEY,
      webhookSecret: process.env.BARID_ESIGN_WEBHOOK_SECRET,
      timeoutMs: process.env.BARID_ESIGN_TIMEOUT_MS,
      maxRetries: process.env.BARID_ESIGN_MAX_RETRIES,
      mockMode: process.env.BARID_ESIGN_MOCK_MODE,
      defaultSignatureType: process.env.BARID_ESIGN_DEFAULT_SIGNATURE_TYPE,
      defaultExpiresDays: process.env.BARID_ESIGN_DEFAULT_EXPIRES_DAYS,
      mtlsClientCertPath: process.env.BARID_ESIGN_MTLS_CLIENT_CERT,
      mtlsClientKeyPath: process.env.BARID_ESIGN_MTLS_CLIENT_KEY,
      circuitBreakerThreshold: process.env.BARID_ESIGN_CB_THRESHOLD,
      circuitBreakerWindowMs: process.env.BARID_ESIGN_CB_WINDOW_MS,
      circuitBreakerHalfOpenAfterMs: process.env.BARID_ESIGN_CB_HALF_OPEN_MS,
    };

    const parsed = BaridEsignConfigSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Invalid Barid eSign config: ${JSON.stringify(parsed.error.format())}`);
    }
    this.config = Object.freeze(parsed.data);

    // Garde-fou critique : interdire mock mode en production
    if (process.env.NODE_ENV === 'production' && this.config.mockMode === true) {
      throw new Error(
        'FATAL: BARID_ESIGN_MOCK_MODE=true forbidden in production. ' +
        'Real Barid eSign API is required for legal compliance loi 43-20.',
      );
    }
  }

  get apiBaseUrl(): string { return this.config.apiBaseUrl; }
  get apiKey(): string { return this.config.apiKey; }
  get webhookSecret(): string { return this.config.webhookSecret; }
  get timeoutMs(): number { return this.config.timeoutMs; }
  get maxRetries(): number { return this.config.maxRetries; }
  get mockMode(): boolean { return this.config.mockMode; }
  get defaultSignatureType() { return this.config.defaultSignatureType; }
  get defaultExpiresDays(): number { return this.config.defaultExpiresDays; }
  get mtlsClientCertPath(): string | undefined { return this.config.mtlsClientCertPath; }
  get mtlsClientKeyPath(): string | undefined { return this.config.mtlsClientKeyPath; }
  get circuitBreakerThreshold(): number { return this.config.circuitBreakerThreshold; }
  get circuitBreakerWindowMs(): number { return this.config.circuitBreakerWindowMs; }
  get circuitBreakerHalfOpenAfterMs(): number { return this.config.circuitBreakerHalfOpenAfterMs; }

  /**
   * Helper expose config publique (sans secrets) pour /health endpoint.
   */
  getPublicConfig(): Record<string, unknown> {
    return {
      apiBaseUrl: this.config.apiBaseUrl,
      timeoutMs: this.config.timeoutMs,
      maxRetries: this.config.maxRetries,
      mockMode: this.config.mockMode,
      defaultSignatureType: this.config.defaultSignatureType,
      defaultExpiresDays: this.config.defaultExpiresDays,
      mtlsEnabled: !!this.config.mtlsClientCertPath,
    };
  }
}
```

### 7.4 `barid-http.client.ts` (Transport undici + retry + circuit breaker)

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-http.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { request as undiciRequest, Agent, Dispatcher } from 'undici';
import { readFileSync } from 'fs';
import { setTimeout as sleep } from 'timers/promises';
import { BaridEsignConfig } from './barid-esign.config';
import {
  BaridUnavailableError,
  BaridAuthError,
  BaridCircuitOpenError,
  BaridUnknownError,
} from './barid-esign.errors';
import type { BaridApiResponse } from './barid-esign.types';

interface HttpRequestParams {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  responseType?: 'json' | 'binary';
  correlationId?: string;
}

type CircuitState = 'closed' | 'open' | 'half-open';

@Injectable()
export class BaridHttpClient {
  private readonly logger = new Logger(BaridHttpClient.name);
  private readonly dispatcher: Dispatcher;

  // Circuit breaker state
  private circuitState: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureAt = 0;
  private windowStartAt = Date.now();
  private nextRetryAt = 0;

  constructor(private readonly config: BaridEsignConfig) {
    const agentOptions: Agent.Options = {
      connect: {
        timeout: config.timeoutMs,
        rejectUnauthorized: true,
      },
      headersTimeout: config.timeoutMs,
      bodyTimeout: config.timeoutMs,
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 120_000,
    };

    // mTLS optionnel (recommande production)
    if (config.mtlsClientCertPath && config.mtlsClientKeyPath) {
      (agentOptions.connect as Record<string, unknown>).cert = readFileSync(config.mtlsClientCertPath);
      (agentOptions.connect as Record<string, unknown>).key = readFileSync(config.mtlsClientKeyPath);
      this.logger.log('mTLS enabled for Barid eSign client');
    }

    this.dispatcher = new Agent(agentOptions);
  }

  async request<T = unknown>(params: HttpRequestParams): Promise<BaridApiResponse<T>> {
    this.checkCircuitState();

    const url = `${this.config.apiBaseUrl}${params.path}`;
    const correlationId = params.correlationId ?? crypto.randomUUID();
    const startedAt = Date.now();

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await undiciRequest(url, {
          method: params.method,
          dispatcher: this.dispatcher,
          headers: {
            'Content-Type': 'application/json',
            'Accept': params.responseType === 'binary' ? 'application/octet-stream' : 'application/json',
            'User-Agent': 'Skalean-InsurTech/1.0 (+https://skalean.ma)',
            'X-Correlation-Id': correlationId,
            ...params.headers,
          },
          body: params.body ? JSON.stringify(params.body) : undefined,
          headersTimeout: this.config.timeoutMs,
          bodyTimeout: this.config.timeoutMs,
        });

        const status = response.statusCode;
        const headers = this.normalizeHeaders(response.headers);
        const requestId = headers['x-request-id'] ?? correlationId;

        let body: T;
        if (params.responseType === 'binary') {
          const chunks: Buffer[] = [];
          for await (const chunk of response.body) {
            chunks.push(chunk as Buffer);
          }
          body = Buffer.concat(chunks) as unknown as T;
        } else {
          body = await response.body.json() as T;
        }

        const durationMs = Date.now() - startedAt;
        this.logger.log({
          msg: 'barid_http_response',
          method: params.method,
          path: params.path,
          status,
          duration_ms: durationMs,
          attempt: attempt + 1,
          correlation_id: correlationId,
          request_id: requestId,
        });

        // 401/403 = auth -> never retry
        if (status === 401 || status === 403) {
          this.recordFailure();
          throw new BaridAuthError(status as 401 | 403);
        }

        // 5xx -> retry
        if (status >= 500 && attempt < this.config.maxRetries) {
          lastError = new BaridUnavailableError(`HTTP ${status}`, { status, body });
          await this.backoff(attempt);
          continue;
        }

        // 5xx final
        if (status >= 500) {
          this.recordFailure();
          throw new BaridUnavailableError(`HTTP ${status}`, { status, body });
        }

        // Succes
        if (status >= 200 && status < 300) {
          this.recordSuccess();
        }

        return { ok: status >= 200 && status < 300, status, body, headers, request_id: requestId };
      } catch (err) {
        const e = err as Error;
        // Erreurs reseau (ECONNRESET, ETIMEDOUT, ENOTFOUND) -> retry
        if (this.isNetworkError(e) && attempt < this.config.maxRetries) {
          lastError = e;
          this.logger.warn({
            msg: 'barid_http_network_error_retry',
            attempt: attempt + 1,
            error: e.message,
            correlation_id: correlationId,
          });
          await this.backoff(attempt);
          continue;
        }

        // Erreur typee Barid deja levee -> propage
        if (err instanceof BaridAuthError || err instanceof BaridUnavailableError) {
          throw err;
        }

        // Erreur reseau finale
        if (this.isNetworkError(e)) {
          this.recordFailure();
          throw new BaridUnavailableError(`Network error: ${e.message}`, { original: e.message });
        }

        // Erreur inconnue
        throw new BaridUnknownError(0, { error: e.message });
      }
    }

    this.recordFailure();
    throw lastError ?? new BaridUnknownError(0, { error: 'Max retries exceeded' });
  }

  private isNetworkError(err: Error): boolean {
    const msg = err.message.toLowerCase();
    return /(econnreset|etimedout|enotfound|econnrefused|epipe|socket hang up|fetch failed)/.test(msg);
  }

  private async backoff(attempt: number): Promise<void> {
    const baseMs = 500;
    const maxMs = 8000;
    const exp = Math.min(baseMs * Math.pow(2, attempt), maxMs);
    const jitter = Math.random() * 0.3 * exp;
    const delayMs = Math.floor(exp + jitter);
    await sleep(delayMs);
  }

  private checkCircuitState(): void {
    const now = Date.now();

    // Reset window
    if (now - this.windowStartAt > this.config.circuitBreakerWindowMs) {
      this.windowStartAt = now;
      this.failureCount = 0;
    }

    if (this.circuitState === 'open') {
      if (now >= this.nextRetryAt) {
        this.circuitState = 'half-open';
        this.logger.warn('barid_circuit_breaker_half_open');
      } else {
        throw new BaridCircuitOpenError(this.failureCount, new Date(this.nextRetryAt));
      }
    }
  }

  private recordSuccess(): void {
    if (this.circuitState === 'half-open') {
      this.circuitState = 'closed';
      this.failureCount = 0;
      this.logger.log('barid_circuit_breaker_closed');
    }
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureAt = Date.now();

    if (this.failureCount >= this.config.circuitBreakerThreshold) {
      this.circuitState = 'open';
      this.nextRetryAt = Date.now() + this.config.circuitBreakerHalfOpenAfterMs;
      this.logger.error({
        msg: 'barid_circuit_breaker_open',
        failures: this.failureCount,
        next_retry_at: new Date(this.nextRetryAt).toISOString(),
      });
    }
  }

  private normalizeHeaders(raw: Record<string, string | string[] | undefined>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v === undefined) continue;
      out[k.toLowerCase()] = Array.isArray(v) ? v.join(',') : v;
    }
    return out;
  }

  getCircuitState(): CircuitState {
    return this.circuitState;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}
```

### 7.5 `barid-mapping.service.ts`

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-mapping.service.ts
import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import {
  CreateSignatureRequestInput,
  BaridSigner,
  BaridDocument,
  BaridSignatureType,
} from './barid-esign.types';
import { BaridInvalidSignerError, BaridDocumentTooLargeError } from './barid-esign.errors';

interface BaridCreateRequestPayload {
  signature_type: BaridSignatureType;
  expires_in_days: number;
  callback_url: string;
  document: BaridDocument;
  signers: BaridSigner[];
  metadata: Record<string, string>;
  tenant_reference: string;
}

@Injectable()
export class BaridMappingService {
  private readonly MAX_DOC_SIZE = 10 * 1024 * 1024; // 10MB

  toBaridFormat(input: CreateSignatureRequestInput): BaridCreateRequestPayload {
    if (input.document.buffer.length > this.MAX_DOC_SIZE) {
      throw new BaridDocumentTooLargeError(input.document.buffer.length);
    }

    const computedSha = createHash('sha256').update(input.document.buffer).digest('hex');
    if (computedSha !== input.document.sha256) {
      throw new Error(`Document SHA-256 mismatch: expected ${input.document.sha256}, got ${computedSha}`);
    }

    return {
      signature_type: input.signature_type,
      expires_in_days: input.expires_in_days,
      callback_url: input.callback_url,
      document: {
        filename: this.sanitizeFilename(input.document.filename),
        content_base64: input.document.buffer.toString('base64'),
        content_sha256: input.document.sha256,
        size_bytes: input.document.buffer.length,
      },
      signers: input.signers.map((s) => this.mapSigner(s)),
      metadata: {
        ...(input.metadata ?? {}),
        skalean_document_id: input.document.id,
        skalean_tenant_id: input.tenant_id,
      },
      tenant_reference: input.tenant_id,
    };
  }

  private mapSigner(s: CreateSignatureRequestInput['signers'][number]): BaridSigner {
    const phone = this.normalizePhone(s.phone);
    if (!phone) {
      throw new BaridInvalidSignerError('phone', s.phone);
    }
    if (!this.isValidEmail(s.email)) {
      throw new BaridInvalidSignerError('email', s.email);
    }
    return {
      signer_id: s.id,
      full_name: s.full_name.trim(),
      email: s.email.toLowerCase().trim(),
      phone,
      national_id: s.national_id?.trim().toUpperCase(),
      signing_order: s.signing_order,
      language: s.language,
    };
  }

  /**
   * Normalisation E.164 telephone marocain.
   * Accepte: 0612345678, +212612345678, 00212612345678, 212612345678
   * Retourne: +212612345678 ou null si invalide
   * Pour numeros internationaux: accepte +XX... 10-15 chiffres
   */
  normalizePhone(raw: string): string | null {
    const cleaned = raw.replace(/[\s\-\.\(\)]/g, '');

    // International deja prefixe +
    if (cleaned.startsWith('+')) {
      if (/^\+\d{10,15}$/.test(cleaned)) {
        return cleaned;
      }
      return null;
    }

    // 00212... -> +212...
    if (cleaned.startsWith('00')) {
      const rest = cleaned.substring(2);
      if (/^\d{10,15}$/.test(rest)) {
        return `+${rest}`;
      }
      return null;
    }

    // 0XXXXXXXXX (national MA) -> +212XXXXXXXXX
    if (/^0[5-7]\d{8}$/.test(cleaned)) {
      return `+212${cleaned.substring(1)}`;
    }

    // 212XXXXXXXXX -> +212XXXXXXXXX
    if (/^212[5-7]\d{8}$/.test(cleaned)) {
      return `+${cleaned}`;
    }

    return null;
  }

  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254;
  }

  sanitizeFilename(name: string): string {
    let s = name.trim().replace(/[^a-zA-Z0-9._\-]/g, '_');
    if (!s.toLowerCase().endsWith('.pdf')) s += '.pdf';
    return s.substring(0, 255);
  }
}
```

### 7.6 `barid-esign.client.ts` (Service principal complet)

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-esign.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { BaridHttpClient } from './barid-http.client';
import { BaridEsignConfig } from './barid-esign.config';
import { BaridMappingService } from './barid-mapping.service';
import {
  CreateSignatureRequestSchema,
  CreateSignatureRequestInput,
  CreateSignatureRequestOutput,
  GetRequestStatusOutput,
  DownloadDocumentOutput,
  ListSignatureRequestsFilters,
  ListSignatureRequestsFiltersSchema,
  BaridApiResponse,
} from './barid-esign.types';
import {
  BaridUnavailableError,
  BaridInvalidSignerError,
  BaridSignatureExpiredError,
  BaridQuotaExceededError,
  BaridCertificateRevokedError,
  BaridAuthError,
  BaridUnknownError,
  BaridError,
} from './barid-esign.errors';

/**
 * Client Barid eSign (Poste Maroc) implementant ISignatureProvider.
 *
 * Conformite legale:
 * - Loi 43-20 article 5: signature qualifiee = valeur juridique signature manuscrite
 * - ANRT Decret 2-08-518: certificat electronique qualifie
 * - ACAPS Circulaire 2018/01: prestataire tiers de confiance certifie
 * - Loi 09-08: data residency Maroc (Atlas Cloud Services), DPA Skalean-Barid signe
 *
 * @example
 * const out = await client.createSignatureRequest({
 *   tenant_id, document, signers, signature_type: 'qualified', ...
 * });
 */
@Injectable()
export class BaridEsignClient {
  private readonly logger = new Logger(BaridEsignClient.name);

  constructor(
    private readonly http: BaridHttpClient,
    private readonly config: BaridEsignConfig,
    private readonly mapper: BaridMappingService,
  ) {}

  /**
   * Cree une nouvelle requete de signature.
   * Idempotent via X-Idempotency-Key (deduplication 24h cote Barid).
   */
  async createSignatureRequest(input: CreateSignatureRequestInput): Promise<CreateSignatureRequestOutput> {
    const validated = CreateSignatureRequestSchema.parse(input);

    this.logger.log({
      msg: 'barid_create_request_start',
      action: 'barid_create_request',
      tenant_id: validated.tenant_id,
      document_id: validated.document.id,
      signers_count: validated.signers.length,
      signature_type: validated.signature_type,
      idempotency_key: validated.idempotencyKey,
    });

    if (validated.signature_type !== 'qualified') {
      this.logger.warn({
        msg: 'barid_non_qualified_signature_warning',
        signature_type: validated.signature_type,
        warning: 'Non-qualified signature: NOT equivalent to manuscript signature per loi 43-20 article 5',
      });
    }

    const baridPayload = this.mapper.toBaridFormat(validated);

    const response = await this.http.request<{
      workflow_id: string;
      sign_urls: Array<{ signer_id: string; url: string }>;
      expires_at: string;
      created_at: string;
    }>({
      method: 'POST',
      path: '/api/v1/signature-requests',
      body: baridPayload,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Idempotency-Key': validated.idempotencyKey,
      },
      correlationId: validated.idempotencyKey,
    });

    if (!response.ok) {
      throw this.normalizeError(response.status, response.body);
    }

    const out: CreateSignatureRequestOutput = {
      provider_workflow_id: response.body.workflow_id,
      sign_urls: response.body.sign_urls,
      expires_at: response.body.expires_at,
      created_at: response.body.created_at,
    };

    this.logger.log({
      msg: 'barid_create_request_success',
      tenant_id: validated.tenant_id,
      document_id: validated.document.id,
      provider_workflow_id: out.provider_workflow_id,
      expires_at: out.expires_at,
    });

    return out;
  }

  /**
   * Recupere le statut courant d'un workflow signature.
   */
  async getRequestStatus(workflowId: string): Promise<GetRequestStatusOutput> {
    if (!/^[a-zA-Z0-9_\-]{8,128}$/.test(workflowId)) {
      throw new BaridInvalidSignerError('workflow_id', workflowId);
    }

    const response = await this.http.request<GetRequestStatusOutput>({
      method: 'GET',
      path: `/api/v1/signature-requests/${encodeURIComponent(workflowId)}`,
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
    });

    if (!response.ok) {
      throw this.normalizeError(response.status, response.body);
    }

    return response.body;
  }

  /**
   * Annule un workflow signature (avant completion).
   */
  async cancelRequest(workflowId: string, reason: string): Promise<void> {
    if (!reason || reason.length < 5 || reason.length > 500) {
      throw new BaridInvalidSignerError('cancel_reason', reason);
    }

    const response = await this.http.request({
      method: 'POST',
      path: `/api/v1/signature-requests/${encodeURIComponent(workflowId)}/cancel`,
      body: { reason },
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
    });

    if (!response.ok) {
      throw this.normalizeError(response.status, response.body);
    }

    this.logger.log({
      msg: 'barid_cancel_request_success',
      workflow_id: workflowId,
      reason,
    });
  }

  /**
   * Telecharge le PDF signe complet (avec horodatage qualifie).
   * Workflow doit etre status='completed'.
   */
  async downloadCompletedDocument(workflowId: string): Promise<DownloadDocumentOutput> {
    const response = await this.http.request<Buffer>({
      method: 'GET',
      path: `/api/v1/signature-requests/${encodeURIComponent(workflowId)}/document`,
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      responseType: 'binary',
    });

    if (!response.ok) {
      throw this.normalizeError(response.status, response.body as unknown);
    }

    const buffer = response.body;
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const filename = this.extractFilename(response.headers['content-disposition'] ?? '') ?? `signed-${workflowId}.pdf`;

    return {
      filename,
      content_type: 'application/pdf',
      buffer,
      size_bytes: buffer.length,
      sha256,
    };
  }

  /**
   * Telecharge l'audit trail PDF natif Barid (preuves legales horodatage + IP signataires).
   * Conserve 10 ans cote Barid (Code Assurances article 23).
   */
  async downloadAuditTrail(workflowId: string): Promise<DownloadDocumentOutput> {
    const response = await this.http.request<Buffer>({
      method: 'GET',
      path: `/api/v1/signature-requests/${encodeURIComponent(workflowId)}/audit-trail`,
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      responseType: 'binary',
    });

    if (!response.ok) {
      throw this.normalizeError(response.status, response.body as unknown);
    }

    const buffer = response.body;
    const sha256 = createHash('sha256').update(buffer).digest('hex');

    return {
      filename: `audit-trail-${workflowId}.pdf`,
      content_type: 'application/pdf',
      buffer,
      size_bytes: buffer.length,
      sha256,
    };
  }

  /**
   * Liste workflows selon filtres (pagination).
   */
  async listSignatureRequests(filters: ListSignatureRequestsFilters): Promise<{
    items: GetRequestStatusOutput[];
    total: number;
    page: number;
    page_size: number;
  }> {
    const validated = ListSignatureRequestsFiltersSchema.parse(filters);
    const qs = new URLSearchParams();
    Object.entries(validated).forEach(([k, v]) => {
      if (v !== undefined) qs.set(k, String(v));
    });

    const response = await this.http.request<{
      items: GetRequestStatusOutput[];
      total: number;
      page: number;
      page_size: number;
    }>({
      method: 'GET',
      path: `/api/v1/signature-requests?${qs.toString()}`,
      headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
    });

    if (!response.ok) {
      throw this.normalizeError(response.status, response.body);
    }
    return response.body;
  }

  /**
   * Renvoie une notification email/SMS a un signataire (en cas de relance manuelle).
   */
  async resendNotification(workflowId: string, signerId: string): Promise<void> {
    const response = await this.http.request({
      method: 'POST',
      path: `/api/v1/signature-requests/${encodeURIComponent(workflowId)}/signers/${encodeURIComponent(signerId)}/resend`,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-Idempotency-Key': randomUUID(),
      },
    });

    if (!response.ok) {
      throw this.normalizeError(response.status, response.body);
    }
  }

  /**
   * Health check (utilise par /health/barid).
   */
  async healthCheck(): Promise<{ status: 'ok' | 'degraded' | 'down'; circuit_state: string; quota_remaining?: number }> {
    try {
      const response = await this.http.request<{ status: string; quota_remaining?: number }>({
        method: 'GET',
        path: '/api/v1/health',
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
      });
      return {
        status: response.ok ? 'ok' : 'degraded',
        circuit_state: this.http.getCircuitState(),
        quota_remaining: response.body?.quota_remaining,
      };
    } catch {
      return { status: 'down', circuit_state: this.http.getCircuitState() };
    }
  }

  private normalizeError(status: number, body: unknown): BaridError {
    const b = (body ?? {}) as Record<string, unknown>;

    if (status === 401 || status === 403) return new BaridAuthError(status as 401 | 403, String(b.detail ?? ''));
    if (status === 503) return new BaridUnavailableError('Service temporarily unavailable', { body });
    if (status === 422 && b.code === 'INVALID_SIGNER') return new BaridInvalidSignerError(String(b.field ?? 'unknown'));
    if (status === 410) return new BaridSignatureExpiredError(String(b.workflow_id ?? 'unknown'));
    if (status === 402) return new BaridQuotaExceededError(Number(b.quota_remaining ?? 0), Number(b.quota_limit ?? 0));
    if (status === 451) return new BaridCertificateRevokedError(String(b.certificate_id ?? 'unknown'), String(b.revocation_reason ?? ''));
    return new BaridUnknownError(status, body);
  }

  private extractFilename(contentDisposition: string): string | null {
    const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return match ? match[1] : null;
  }
}
```

### 7.7 `mock-barid.client.ts` (Mock complet in-memory)

```typescript
// repo/packages/signature/src/providers/barid-esign/mock-barid.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { randomUUID, createHash } from 'crypto';
import {
  CreateSignatureRequestInput,
  CreateSignatureRequestOutput,
  GetRequestStatusOutput,
  DownloadDocumentOutput,
  ListSignatureRequestsFilters,
  BaridWorkflowStatus,
  BaridSignerStatus,
} from './barid-esign.types';
import { BaridSignatureExpiredError, BaridInvalidSignerError } from './barid-esign.errors';

interface MockWorkflow {
  workflow_id: string;
  tenant_id: string;
  document_id: string;
  document_buffer: Buffer;
  status: BaridWorkflowStatus;
  signers: Array<{
    signer_id: string;
    full_name: string;
    email: string;
    status: BaridSignerStatus;
    signed_at: string | null;
    sign_url: string;
  }>;
  signature_type: string;
  created_at: string;
  expires_at: string;
  callback_url: string;
  certificate_chain_id: string | null;
}

/**
 * Mock client Barid eSign pour tests/dev/CI.
 * Comportement deterministe en memoire, aucun appel reseau.
 * EventEmitter expose pour simuler webhooks dans les tests.
 */
@Injectable()
export class MockBaridEsignClient {
  private readonly logger = new Logger(MockBaridEsignClient.name);
  private readonly workflows = new Map<string, MockWorkflow>();
  public readonly events = new EventEmitter();

  async createSignatureRequest(input: CreateSignatureRequestInput): Promise<CreateSignatureRequestOutput> {
    // Idempotency
    const existing = Array.from(this.workflows.values()).find(
      (w) => w.document_id === input.document.id && w.tenant_id === input.tenant_id,
    );
    if (existing) {
      this.logger.warn({ msg: 'mock_idempotent_hit', workflow_id: existing.workflow_id });
      return this.toCreateOutput(existing);
    }

    const workflowId = `wf_mock_${randomUUID()}`;
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + input.expires_in_days * 86400_000);

    const wf: MockWorkflow = {
      workflow_id: workflowId,
      tenant_id: input.tenant_id,
      document_id: input.document.id,
      document_buffer: input.document.buffer,
      status: 'sent',
      signers: input.signers.map((s) => ({
        signer_id: s.id,
        full_name: s.full_name,
        email: s.email,
        status: 'notified',
        signed_at: null,
        sign_url: `https://mock.barid.local/sign/${workflowId}/${s.id}`,
      })),
      signature_type: input.signature_type,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      callback_url: input.callback_url,
      certificate_chain_id: input.signature_type === 'qualified' ? `cert_chain_mock_${randomUUID()}` : null,
    };

    this.workflows.set(workflowId, wf);
    this.events.emit('workflow.created', wf);

    this.logger.log({ msg: 'mock_workflow_created', workflow_id: workflowId, signers_count: wf.signers.length });
    return this.toCreateOutput(wf);
  }

  async getRequestStatus(workflowId: string): Promise<GetRequestStatusOutput> {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new BaridInvalidSignerError('workflow_id', workflowId);

    if (new Date(wf.expires_at).getTime() < Date.now() && wf.status === 'sent') {
      wf.status = 'expired';
    }

    return {
      provider_workflow_id: wf.workflow_id,
      status: wf.status,
      signers_status: wf.signers.map((s) => ({
        signer_id: s.signer_id,
        status: s.status,
        signed_at: s.signed_at,
        declined_reason: null,
        ip_address: s.status === 'signed' ? '197.230.10.42' : null,
        user_agent: s.status === 'signed' ? 'Mozilla/5.0 Mock' : null,
      })),
      last_event_at: new Date().toISOString(),
      expires_at: wf.expires_at,
      certificate_chain_id: wf.certificate_chain_id,
    };
  }

  async cancelRequest(workflowId: string, reason: string): Promise<void> {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new BaridInvalidSignerError('workflow_id', workflowId);
    if (wf.status === 'completed') throw new Error('Cannot cancel completed workflow');
    wf.status = 'cancelled';
    this.events.emit('workflow.cancelled', { workflow_id: workflowId, reason });
  }

  async downloadCompletedDocument(workflowId: string): Promise<DownloadDocumentOutput> {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new BaridInvalidSignerError('workflow_id', workflowId);
    if (wf.status !== 'completed') throw new BaridSignatureExpiredError(workflowId);

    // Simule PDF signe = original + suffix mock
    const signedSuffix = Buffer.from(`\n%%MOCK-SIGNED-BARID-${workflowId}\n`);
    const signedBuffer = Buffer.concat([wf.document_buffer, signedSuffix]);

    return {
      filename: `signed-${workflowId}.pdf`,
      content_type: 'application/pdf',
      buffer: signedBuffer,
      size_bytes: signedBuffer.length,
      sha256: createHash('sha256').update(signedBuffer).digest('hex'),
    };
  }

  async downloadAuditTrail(workflowId: string): Promise<DownloadDocumentOutput> {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new BaridInvalidSignerError('workflow_id', workflowId);

    const auditPdf = Buffer.from(`%PDF-1.4\nMOCK AUDIT TRAIL\nWorkflow: ${workflowId}\nSigners: ${JSON.stringify(wf.signers)}\n%%EOF`);
    return {
      filename: `audit-${workflowId}.pdf`,
      content_type: 'application/pdf',
      buffer: auditPdf,
      size_bytes: auditPdf.length,
      sha256: createHash('sha256').update(auditPdf).digest('hex'),
    };
  }

  async listSignatureRequests(filters: ListSignatureRequestsFilters) {
    let items = Array.from(this.workflows.values()).filter((w) => w.tenant_id === filters.tenant_id);
    if (filters.status) items = items.filter((w) => w.status === filters.status);
    const total = items.length;
    const start = (filters.page - 1) * filters.page_size;
    const paginated = items.slice(start, start + filters.page_size);
    return {
      items: await Promise.all(paginated.map((w) => this.getRequestStatus(w.workflow_id))),
      total,
      page: filters.page,
      page_size: filters.page_size,
    };
  }

  async resendNotification(workflowId: string, signerId: string): Promise<void> {
    const wf = this.workflows.get(workflowId);
    if (!wf) throw new BaridInvalidSignerError('workflow_id', workflowId);
    const signer = wf.signers.find((s) => s.signer_id === signerId);
    if (!signer) throw new BaridInvalidSignerError('signer_id', signerId);
    this.events.emit('notification.resent', { workflow_id: workflowId, signer_id: signerId });
  }

  async healthCheck() {
    return { status: 'ok' as const, circuit_state: 'closed', quota_remaining: 999_999 };
  }

  // Methodes test-only pour simuler completion
  __simulateSignerSigned(workflowId: string, signerId: string): void {
    const wf = this.workflows.get(workflowId);
    if (!wf) return;
    const s = wf.signers.find((x) => x.signer_id === signerId);
    if (!s) return;
    s.status = 'signed';
    s.signed_at = new Date().toISOString();
    if (wf.signers.every((x) => x.status === 'signed')) {
      wf.status = 'completed';
      this.events.emit('workflow.completed', wf);
    } else {
      wf.status = 'in_progress';
    }
  }

  __reset(): void {
    this.workflows.clear();
    this.events.removeAllListeners();
  }

  private toCreateOutput(wf: MockWorkflow): CreateSignatureRequestOutput {
    return {
      provider_workflow_id: wf.workflow_id,
      sign_urls: wf.signers.map((s) => ({ signer_id: s.signer_id, url: s.sign_url })),
      expires_at: wf.expires_at,
      created_at: wf.created_at,
    };
  }
}
```

### 7.8 `barid-esign.module.ts`

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-esign.module.ts
import { Module, Provider, Logger } from '@nestjs/common';
import { BaridEsignConfig } from './barid-esign.config';
import { BaridEsignClient } from './barid-esign.client';
import { BaridHttpClient } from './barid-http.client';
import { BaridMappingService } from './barid-mapping.service';
import { MockBaridEsignClient } from './mock-barid.client';

export const BARID_ESIGN_PROVIDER = Symbol('BARID_ESIGN_PROVIDER');

const baridProvider: Provider = {
  provide: BARID_ESIGN_PROVIDER,
  inject: [BaridEsignConfig, BaridHttpClient, BaridMappingService],
  useFactory: (config: BaridEsignConfig, http: BaridHttpClient, mapper: BaridMappingService) => {
    const logger = new Logger('BaridEsignModule');

    if (process.env.NODE_ENV === 'production' && config.mockMode === true) {
      throw new Error(
        'FATAL: BARID_ESIGN_MOCK_MODE=true forbidden in production. Real Barid eSign API is required for legal compliance loi 43-20.',
      );
    }

    if (config.mockMode) {
      logger.warn('Using MockBaridEsignClient (mock mode enabled, NOT for production)');
      return new MockBaridEsignClient();
    }

    logger.log('Using real BaridEsignClient against ' + config.apiBaseUrl);
    return new BaridEsignClient(http, config, mapper);
  },
};

@Module({
  providers: [
    BaridEsignConfig,
    BaridHttpClient,
    BaridMappingService,
    BaridEsignClient,
    MockBaridEsignClient,
    baridProvider,
  ],
  exports: [BARID_ESIGN_PROVIDER, BaridEsignConfig],
})
export class BaridEsignModule {}
```

---

## 8. TESTS (33 tests)

### 8.1 `barid-esign.client.spec.ts` (15 tests)

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-esign.client.spec.ts
import { Test } from '@nestjs/testing';
import { randomUUID, createHash } from 'crypto';
import { BaridEsignClient } from './barid-esign.client';
import { BaridHttpClient } from './barid-http.client';
import { BaridEsignConfig } from './barid-esign.config';
import { BaridMappingService } from './barid-mapping.service';
import {
  BaridUnavailableError,
  BaridInvalidSignerError,
  BaridQuotaExceededError,
  BaridCertificateRevokedError,
  BaridSignatureExpiredError,
  BaridAuthError,
} from './barid-esign.errors';

describe('BaridEsignClient', () => {
  let client: BaridEsignClient;
  let httpMock: jest.Mocked<BaridHttpClient>;
  let configMock: jest.Mocked<BaridEsignConfig>;

  const validInput = () => {
    const buf = Buffer.from('%PDF-1.4 mock content for testing barid esign client');
    return {
      tenant_id: randomUUID(),
      document: {
        id: randomUUID(),
        filename: 'contract.pdf',
        buffer: buf,
        sha256: createHash('sha256').update(buf).digest('hex'),
      },
      signers: [{
        id: randomUUID(),
        full_name: 'Mohamed Alaoui',
        email: 'mohamed.alaoui@example.ma',
        phone: '+212612345678',
        signing_order: 1,
        language: 'fr' as const,
      }],
      signature_type: 'qualified' as const,
      expires_in_days: 7,
      callback_url: 'https://app.skalean.ma/webhooks/barid',
      idempotencyKey: randomUUID(),
    };
  };

  beforeEach(async () => {
    httpMock = { request: jest.fn(), getCircuitState: jest.fn().mockReturnValue('closed'), getFailureCount: jest.fn().mockReturnValue(0) } as any;
    configMock = { apiKey: 'test_api_key_min_32_chars_xxxxxxxxxx', apiBaseUrl: 'https://api.barid.ma/esign/v1' } as any;
    const moduleRef = await Test.createTestingModule({
      providers: [
        BaridEsignClient,
        { provide: BaridHttpClient, useValue: httpMock },
        { provide: BaridEsignConfig, useValue: configMock },
        BaridMappingService,
      ],
    }).compile();
    client = moduleRef.get(BaridEsignClient);
  });

  it('T1: createSignatureRequest succeeds with valid qualified input', async () => {
    httpMock.request.mockResolvedValueOnce({
      ok: true, status: 201,
      body: { workflow_id: 'wf_123', sign_urls: [{ signer_id: 'sg1', url: 'https://barid.ma/sign/x' }], expires_at: '2026-05-15T00:00:00Z', created_at: '2026-05-08T00:00:00Z' },
      headers: {}, request_id: 'req_1',
    });
    const out = await client.createSignatureRequest(validInput());
    expect(out.provider_workflow_id).toBe('wf_123');
    expect(httpMock.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: '/api/v1/signature-requests' }));
  });

  it('T2: rejects invalid input (missing signers) via Zod', async () => {
    const inp: any = validInput(); inp.signers = [];
    await expect(client.createSignatureRequest(inp)).rejects.toThrow();
  });

  it('T3: maps 503 to BaridUnavailableError', async () => {
    httpMock.request.mockResolvedValueOnce({ ok: false, status: 503, body: {}, headers: {}, request_id: 'r' });
    await expect(client.createSignatureRequest(validInput())).rejects.toBeInstanceOf(BaridUnavailableError);
  });

  it('T4: maps 422 INVALID_SIGNER to BaridInvalidSignerError', async () => {
    httpMock.request.mockResolvedValueOnce({ ok: false, status: 422, body: { code: 'INVALID_SIGNER', field: 'email' }, headers: {}, request_id: 'r' });
    await expect(client.createSignatureRequest(validInput())).rejects.toBeInstanceOf(BaridInvalidSignerError);
  });

  it('T5: maps 410 to BaridSignatureExpiredError', async () => {
    httpMock.request.mockResolvedValueOnce({ ok: false, status: 410, body: { workflow_id: 'wf_old' }, headers: {}, request_id: 'r' });
    await expect(client.createSignatureRequest(validInput())).rejects.toBeInstanceOf(BaridSignatureExpiredError);
  });

  it('T6: maps 402 to BaridQuotaExceededError', async () => {
    httpMock.request.mockResolvedValueOnce({ ok: false, status: 402, body: { quota_remaining: 0, quota_limit: 50000 }, headers: {}, request_id: 'r' });
    await expect(client.createSignatureRequest(validInput())).rejects.toBeInstanceOf(BaridQuotaExceededError);
  });

  it('T7: maps 451 to BaridCertificateRevokedError', async () => {
    httpMock.request.mockResolvedValueOnce({ ok: false, status: 451, body: { certificate_id: 'cert_x' }, headers: {}, request_id: 'r' });
    await expect(client.createSignatureRequest(validInput())).rejects.toBeInstanceOf(BaridCertificateRevokedError);
  });

  it('T8: getRequestStatus returns parsed status', async () => {
    httpMock.request.mockResolvedValueOnce({
      ok: true, status: 200,
      body: { provider_workflow_id: 'wf_1', status: 'in_progress', signers_status: [], last_event_at: '2026-05-08T00:00:00Z', expires_at: '2026-05-15T00:00:00Z', certificate_chain_id: null },
      headers: {}, request_id: 'r',
    });
    const out = await client.getRequestStatus('wf_1234');
    expect(out.status).toBe('in_progress');
  });

  it('T9: cancelRequest validates reason min length', async () => {
    await expect(client.cancelRequest('wf_1234', 'no')).rejects.toBeInstanceOf(BaridInvalidSignerError);
  });

  it('T10: cancelRequest sends POST cancel', async () => {
    httpMock.request.mockResolvedValueOnce({ ok: true, status: 204, body: {}, headers: {}, request_id: 'r' });
    await client.cancelRequest('wf_1234', 'Customer changed mind');
    expect(httpMock.request).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', path: expect.stringContaining('/cancel') }));
  });

  it('T11: downloadCompletedDocument returns Buffer', async () => {
    const buf = Buffer.from('%PDF signed mock data');
    httpMock.request.mockResolvedValueOnce({ ok: true, status: 200, body: buf as any, headers: { 'content-disposition': 'attachment; filename="signed.pdf"' }, request_id: 'r' });
    const out = await client.downloadCompletedDocument('wf_1234');
    expect(out.buffer).toBe(buf);
    expect(out.filename).toBe('signed.pdf');
    expect(out.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('T12: downloadAuditTrail returns audit PDF', async () => {
    const buf = Buffer.from('%PDF audit');
    httpMock.request.mockResolvedValueOnce({ ok: true, status: 200, body: buf as any, headers: {}, request_id: 'r' });
    const out = await client.downloadAuditTrail('wf_1234');
    expect(out.filename).toBe('audit-trail-wf_1234.pdf');
  });

  it('T13: listSignatureRequests passes filters as query string', async () => {
    httpMock.request.mockResolvedValueOnce({ ok: true, status: 200, body: { items: [], total: 0, page: 1, page_size: 20 }, headers: {}, request_id: 'r' });
    await client.listSignatureRequests({ tenant_id: randomUUID(), page: 1, page_size: 20 });
    expect(httpMock.request).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringContaining('?') }));
  });

  it('T14: resendNotification calls correct path with idempotency', async () => {
    httpMock.request.mockResolvedValueOnce({ ok: true, status: 204, body: {}, headers: {}, request_id: 'r' });
    await client.resendNotification('wf_1234', 'sg_5678');
    expect(httpMock.request).toHaveBeenCalledWith(expect.objectContaining({
      headers: expect.objectContaining({ 'X-Idempotency-Key': expect.any(String) }),
    }));
  });

  it('T15: healthCheck handles transport failure gracefully', async () => {
    httpMock.request.mockRejectedValueOnce(new Error('network down'));
    const r = await client.healthCheck();
    expect(r.status).toBe('down');
  });
});
```

### 8.2 `barid-http.client.spec.ts` (8 tests)

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-http.client.spec.ts
import { BaridHttpClient } from './barid-http.client';
import { BaridEsignConfig } from './barid-esign.config';
import { BaridUnavailableError, BaridAuthError, BaridCircuitOpenError } from './barid-esign.errors';
import nock from 'nock';

const cfg = (over: Partial<any> = {}): BaridEsignConfig => ({
  apiBaseUrl: 'https://api.barid.ma/esign/v1',
  apiKey: 'k'.repeat(40),
  webhookSecret: 's'.repeat(40),
  timeoutMs: 5000, maxRetries: 2, mockMode: false,
  defaultSignatureType: 'qualified', defaultExpiresDays: 7,
  circuitBreakerThreshold: 3, circuitBreakerWindowMs: 60000, circuitBreakerHalfOpenAfterMs: 30000,
  getPublicConfig: () => ({}),
  ...over,
} as any);

describe('BaridHttpClient', () => {
  beforeEach(() => nock.cleanAll());
  afterAll(() => nock.restore());

  it('T16: succeeds on 200 OK', async () => {
    nock('https://api.barid.ma').get('/esign/v1/test').reply(200, { ok: true });
    const c = new BaridHttpClient(cfg());
    const r = await c.request({ method: 'GET', path: '/test' });
    expect(r.ok).toBe(true); expect(r.status).toBe(200);
  });

  it('T17: retries on 5xx and succeeds on second attempt', async () => {
    nock('https://api.barid.ma').get('/esign/v1/test').reply(503).get('/esign/v1/test').reply(200, { ok: true });
    const c = new BaridHttpClient(cfg());
    const r = await c.request({ method: 'GET', path: '/test' });
    expect(r.status).toBe(200);
  });

  it('T18: throws BaridUnavailableError after max retries on 5xx', async () => {
    nock('https://api.barid.ma').get('/esign/v1/test').times(3).reply(500);
    const c = new BaridHttpClient(cfg());
    await expect(c.request({ method: 'GET', path: '/test' })).rejects.toBeInstanceOf(BaridUnavailableError);
  });

  it('T19: never retries on 401', async () => {
    let count = 0;
    nock('https://api.barid.ma').get('/esign/v1/test').reply(() => { count++; return [401, { detail: 'invalid key' }]; });
    const c = new BaridHttpClient(cfg());
    await expect(c.request({ method: 'GET', path: '/test' })).rejects.toBeInstanceOf(BaridAuthError);
    expect(count).toBe(1);
  });

  it('T20: opens circuit after threshold consecutive failures', async () => {
    nock('https://api.barid.ma').get('/esign/v1/test').times(50).reply(500);
    const c = new BaridHttpClient(cfg({ maxRetries: 0, circuitBreakerThreshold: 2 } as any));
    await c.request({ method: 'GET', path: '/test' }).catch(() => {});
    await c.request({ method: 'GET', path: '/test' }).catch(() => {});
    await expect(c.request({ method: 'GET', path: '/test' })).rejects.toBeInstanceOf(BaridCircuitOpenError);
    expect(c.getCircuitState()).toBe('open');
  });

  it('T21: backoff increases exponentially', async () => {
    nock('https://api.barid.ma').get('/esign/v1/test').times(3).reply(503).get('/esign/v1/test').reply(200, {});
    const c = new BaridHttpClient(cfg({ maxRetries: 3 } as any));
    const start = Date.now();
    await c.request({ method: 'GET', path: '/test' });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThan(500 + 1000);
  });

  it('T22: sends correlation id header', async () => {
    let received = '';
    nock('https://api.barid.ma').get('/esign/v1/test').reply(function () {
      received = String(this.req.headers['x-correlation-id'] ?? '');
      return [200, {}];
    });
    const c = new BaridHttpClient(cfg());
    await c.request({ method: 'GET', path: '/test', correlationId: 'corr-123' });
    expect(received).toBe('corr-123');
  });

  it('T23: handles binary response (PDF download)', async () => {
    const pdf = Buffer.from('%PDF-1.4 binary');
    nock('https://api.barid.ma').get('/esign/v1/doc').reply(200, pdf, { 'content-type': 'application/pdf' });
    const c = new BaridHttpClient(cfg());
    const r = await c.request<Buffer>({ method: 'GET', path: '/doc', responseType: 'binary' });
    expect(Buffer.isBuffer(r.body)).toBe(true);
  });
});
```

### 8.3 `barid-mapping.service.spec.ts` (6 tests)

```typescript
// repo/packages/signature/src/providers/barid-esign/barid-mapping.service.spec.ts
import { BaridMappingService } from './barid-mapping.service';
import { BaridInvalidSignerError, BaridDocumentTooLargeError } from './barid-esign.errors';
import { randomUUID, createHash } from 'crypto';

describe('BaridMappingService', () => {
  const svc = new BaridMappingService();

  it('T24: normalizes Moroccan phone to +212 format', () => {
    expect(svc.normalizePhone('0612345678')).toBe('+212612345678');
    expect(svc.normalizePhone('00212612345678')).toBe('+212612345678');
    expect(svc.normalizePhone('212612345678')).toBe('+212612345678');
    expect(svc.normalizePhone('+212612345678')).toBe('+212612345678');
    expect(svc.normalizePhone('06 12 34 56 78')).toBe('+212612345678');
  });

  it('T25: accepts international E.164 phones', () => {
    expect(svc.normalizePhone('+33612345678')).toBe('+33612345678');
    expect(svc.normalizePhone('+15551234567')).toBe('+15551234567');
  });

  it('T26: rejects malformed phone returns null', () => {
    expect(svc.normalizePhone('abc')).toBeNull();
    expect(svc.normalizePhone('123')).toBeNull();
  });

  it('T27: throws BaridDocumentTooLargeError for >10MB', () => {
    const big = Buffer.alloc(11 * 1024 * 1024);
    expect(() => svc.toBaridFormat({
      tenant_id: randomUUID(),
      document: { id: randomUUID(), filename: 'x.pdf', buffer: big, sha256: createHash('sha256').update(big).digest('hex') },
      signers: [{ id: randomUUID(), full_name: 'A B', email: 'a@b.ma', phone: '+212612345678', signing_order: 1, language: 'fr' }],
      signature_type: 'qualified', expires_in_days: 7, callback_url: 'https://x.ma', idempotencyKey: randomUUID(),
    } as any)).toThrow(BaridDocumentTooLargeError);
  });

  it('T28: throws BaridInvalidSignerError for invalid email', () => {
    const buf = Buffer.from('%PDF');
    expect(() => svc.toBaridFormat({
      tenant_id: randomUUID(),
      document: { id: randomUUID(), filename: 'x.pdf', buffer: buf, sha256: createHash('sha256').update(buf).digest('hex') },
      signers: [{ id: randomUUID(), full_name: 'A B', email: 'not-an-email', phone: '+212612345678', signing_order: 1, language: 'fr' }],
      signature_type: 'qualified', expires_in_days: 7, callback_url: 'https://x.ma', idempotencyKey: randomUUID(),
    } as any)).toThrow(BaridInvalidSignerError);
  });

  it('T29: sanitizes filename and ensures .pdf extension', () => {
    expect(svc.sanitizeFilename('My Doc!@#.pdf')).toBe('My_Doc___.pdf');
    expect(svc.sanitizeFilename('contract')).toBe('contract.pdf');
  });
});
```

### 8.4 `mock-barid.client.spec.ts` (5 tests)

```typescript
// repo/packages/signature/src/providers/barid-esign/mock-barid.client.spec.ts
import { MockBaridEsignClient } from './mock-barid.client';
import { randomUUID, createHash } from 'crypto';

const inp = () => {
  const buf = Buffer.from('%PDF-1.4 mock');
  return {
    tenant_id: randomUUID(),
    document: { id: randomUUID(), filename: 'c.pdf', buffer: buf, sha256: createHash('sha256').update(buf).digest('hex') },
    signers: [{ id: randomUUID(), full_name: 'X Y', email: 'x@y.ma', phone: '+212612345678', signing_order: 1, language: 'fr' as const }],
    signature_type: 'qualified' as const, expires_in_days: 7,
    callback_url: 'https://x.ma/cb', idempotencyKey: randomUUID(),
  };
};

describe('MockBaridEsignClient', () => {
  let m: MockBaridEsignClient;
  beforeEach(() => { m = new MockBaridEsignClient(); });
  afterEach(() => m.__reset());

  it('T30: creates workflow with sign URLs per signer', async () => {
    const out = await m.createSignatureRequest(inp());
    expect(out.provider_workflow_id).toMatch(/^wf_mock_/);
    expect(out.sign_urls).toHaveLength(1);
  });

  it('T31: idempotency hits return same workflow', async () => {
    const i = inp();
    const a = await m.createSignatureRequest(i);
    const b = await m.createSignatureRequest(i);
    expect(a.provider_workflow_id).toBe(b.provider_workflow_id);
  });

  it('T32: simulates signer signed and completes workflow', async () => {
    const i = inp();
    const out = await m.createSignatureRequest(i);
    m.__simulateSignerSigned(out.provider_workflow_id, i.signers[0].id);
    const status = await m.getRequestStatus(out.provider_workflow_id);
    expect(status.status).toBe('completed');
  });

  it('T33: downloadCompletedDocument fails if not completed', async () => {
    const out = await m.createSignatureRequest(inp());
    await expect(m.downloadCompletedDocument(out.provider_workflow_id)).rejects.toThrow();
  });

  it('T34: cancelRequest moves status to cancelled', async () => {
    const out = await m.createSignatureRequest(inp());
    await m.cancelRequest(out.provider_workflow_id, 'test cancel reason ok');
    const s = await m.getRequestStatus(out.provider_workflow_id);
    expect(s.status).toBe('cancelled');
  });
});
```

### 8.5 `barid-esign-integration.e2e-spec.ts` (extrait, 8 tests integration)

```typescript
// repo/apps/api/test/signature/barid-esign-integration.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import nock from 'nock';
import { randomUUID, createHash } from 'crypto';
import { BaridEsignModule, BARID_ESIGN_PROVIDER } from '@/signature/providers/barid-esign/barid-esign.module';

describe('BaridEsign E2E Integration', () => {
  let app: INestApplication;
  let provider: any;

  beforeAll(async () => {
    process.env.BARID_ESIGN_API_BASE_URL = 'https://api.barid.ma/esign/v1';
    process.env.BARID_ESIGN_API_KEY = 'k'.repeat(40);
    process.env.BARID_ESIGN_WEBHOOK_SECRET = 's'.repeat(40);
    process.env.BARID_ESIGN_MOCK_MODE = 'false';
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({ imports: [BaridEsignModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    provider = app.get(BARID_ESIGN_PROVIDER);
  });

  afterAll(async () => { await app.close(); nock.restore(); });
  beforeEach(() => nock.cleanAll());

  const buildInput = () => {
    const buf = Buffer.from('%PDF-1.4 integration test');
    return {
      tenant_id: randomUUID(),
      document: { id: randomUUID(), filename: 'c.pdf', buffer: buf, sha256: createHash('sha256').update(buf).digest('hex') },
      signers: [{ id: randomUUID(), full_name: 'A B', email: 'a@b.ma', phone: '+212612345678', signing_order: 1, language: 'fr' as const }],
      signature_type: 'qualified' as const, expires_in_days: 7, callback_url: 'https://x.ma/cb', idempotencyKey: randomUUID(),
    };
  };

  it('T35: end-to-end create -> getStatus -> download cycle', async () => {
    const wfId = 'wf_e2e_' + randomUUID();
    nock('https://api.barid.ma').post('/esign/v1/api/v1/signature-requests').reply(201, {
      workflow_id: wfId, sign_urls: [{ signer_id: 'sg', url: 'https://barid.ma/s/x' }],
      expires_at: '2026-05-15T00:00:00Z', created_at: '2026-05-08T00:00:00Z',
    });
    const created = await provider.createSignatureRequest(buildInput());
    expect(created.provider_workflow_id).toBe(wfId);

    nock('https://api.barid.ma').get(`/esign/v1/api/v1/signature-requests/${wfId}`).reply(200, {
      provider_workflow_id: wfId, status: 'completed', signers_status: [],
      last_event_at: '2026-05-08T00:00:00Z', expires_at: '2026-05-15T00:00:00Z', certificate_chain_id: 'cert_x',
    });
    const status = await provider.getRequestStatus(wfId);
    expect(status.status).toBe('completed');

    const pdfBuf = Buffer.from('%PDF-1.4 signed binary content');
    nock('https://api.barid.ma').get(`/esign/v1/api/v1/signature-requests/${wfId}/document`).reply(200, pdfBuf, { 'content-type': 'application/pdf' });
    const dl = await provider.downloadCompletedDocument(wfId);
    expect(dl.size_bytes).toBe(pdfBuf.length);
  });

  it('T36: refuses boot if mock_mode true in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.BARID_ESIGN_MOCK_MODE = 'true';
    expect(() => Test.createTestingModule({ imports: [BaridEsignModule] }).compile()).rejects.toThrow();
    process.env.NODE_ENV = 'test';
    process.env.BARID_ESIGN_MOCK_MODE = 'false';
  });

  it('T37: idempotency key collision returns same workflow', async () => {
    const inp = buildInput();
    const wfId = 'wf_idem_' + randomUUID();
    nock('https://api.barid.ma').post('/esign/v1/api/v1/signature-requests').times(2).reply(201, {
      workflow_id: wfId, sign_urls: [], expires_at: '2026-05-15T00:00:00Z', created_at: '2026-05-08T00:00:00Z',
    });
    const a = await provider.createSignatureRequest(inp);
    const b = await provider.createSignatureRequest({ ...inp, idempotencyKey: inp.idempotencyKey });
    expect(a.provider_workflow_id).toBe(b.provider_workflow_id);
  });

  it('T38: handles 503 with retry then success', async () => {
    nock('https://api.barid.ma').post('/esign/v1/api/v1/signature-requests').reply(503).post('/esign/v1/api/v1/signature-requests').reply(201, {
      workflow_id: 'wf_retry', sign_urls: [], expires_at: '2026-05-15T00:00:00Z', created_at: '2026-05-08T00:00:00Z',
    });
    const out = await provider.createSignatureRequest(buildInput());
    expect(out.provider_workflow_id).toBe('wf_retry');
  });

  it('T39: handles 402 quota exceeded propagates BaridQuotaExceededError', async () => {
    nock('https://api.barid.ma').post('/esign/v1/api/v1/signature-requests').reply(402, { quota_remaining: 0, quota_limit: 50000 });
    await expect(provider.createSignatureRequest(buildInput())).rejects.toThrow(/QUOTA/i);
  });

  it('T40: handles 451 certificate revoked', async () => {
    nock('https://api.barid.ma').post('/esign/v1/api/v1/signature-requests').reply(451, { certificate_id: 'cert_x', revocation_reason: 'fraud' });
    await expect(provider.createSignatureRequest(buildInput())).rejects.toThrow(/REVOKED/i);
  });

  it('T41: cancel workflow propagates correctly', async () => {
    nock('https://api.barid.ma').post(/\/cancel/).reply(204);
    await expect(provider.cancelRequest('wf_xyz_1234', 'Test cancel reason')).resolves.toBeUndefined();
  });

  it('T42: healthCheck returns ok with quota info', async () => {
    nock('https://api.barid.ma').get('/esign/v1/api/v1/health').reply(200, { status: 'ok', quota_remaining: 42_000 });
    const r = await provider.healthCheck();
    expect(r.status).toBe('ok');
    expect(r.quota_remaining).toBe(42_000);
  });
});
```

---

## 9. VARIABLES ENVIRONNEMENT (10 vars)

```bash
# .env.example - Section Barid eSign
BARID_ESIGN_API_BASE_URL=https://api.barid.ma/esign/v1
BARID_ESIGN_API_KEY=replace-with-real-key-min-32-chars
BARID_ESIGN_WEBHOOK_SECRET=replace-with-hmac-secret-min-32-chars
BARID_ESIGN_TIMEOUT_MS=10000
BARID_ESIGN_MAX_RETRIES=3
BARID_ESIGN_MOCK_MODE=false
BARID_ESIGN_DEFAULT_SIGNATURE_TYPE=qualified
BARID_ESIGN_DEFAULT_EXPIRES_DAYS=7
BARID_ESIGN_MTLS_CLIENT_CERT=/secrets/barid-client.crt
BARID_ESIGN_MTLS_CLIENT_KEY=/secrets/barid-client.key
BARID_ESIGN_CB_THRESHOLD=5
BARID_ESIGN_CB_WINDOW_MS=60000
BARID_ESIGN_CB_HALF_OPEN_MS=30000
```

---

## 10. COMMANDES SHELL (PowerShell + bash)

```powershell
# Creation arborescence (PowerShell Windows)
$base = "C:\Users\belga\Desktop\Skalean_Insurtech\repo\packages\signature\src\providers\barid-esign"
New-Item -ItemType Directory -Force -Path $base | Out-Null
New-Item -ItemType Directory -Force -Path "C:\Users\belga\Desktop\Skalean_Insurtech\repo\apps\api\test\signature" | Out-Null

# Installation deps
cd C:\Users\belga\Desktop\Skalean_Insurtech\repo\packages\signature
pnpm add undici@^7.0.0 zod@^3.23.0
pnpm add -D nock@^13.5.0 @types/node

# Tests unitaires
pnpm jest packages/signature/src/providers/barid-esign --coverage --coverageThreshold='{"global":{"lines":92,"branches":88}}'

# Tests integration e2e
pnpm jest apps/api/test/signature/barid-esign-integration.e2e-spec.ts --runInBand

# Lint + typecheck
pnpm eslint packages/signature/src/providers/barid-esign --max-warnings=0
pnpm tsc -p packages/signature/tsconfig.json --noEmit
```

---

## 11. CRITERES D'ACCEPTATION (V1-V32)

- **V1** : Fichier `barid-esign.client.ts` existe avec classe `BaridEsignClient @Injectable()` exposant 7 methodes publiques (createSignatureRequest, getRequestStatus, cancelRequest, downloadCompletedDocument, downloadAuditTrail, listSignatureRequests, resendNotification) + healthCheck.
- **V2** : Toutes les methodes publiques valident leur input via Zod schemas avant tout appel HTTP.
- **V3** : `BaridEsignConfig` valide les 13 variables environnement via Zod, fail-fast au boot si invalide.
- **V4** : Garde-fou strict refuse `mockMode=true` quand `NODE_ENV=production` (test e2e T36 verifie).
- **V5** : `BaridHttpClient` utilise undici natif (pas axios, pas got, pas node-fetch).
- **V6** : Retry exponentiel : max 3 tentatives, base 500ms, plafond 8s, jitter 0-30%, **uniquement** sur 5xx + erreurs reseau.
- **V7** : Aucun retry sur 4xx (idempotency key gere la dedup cote Barid).
- **V8** : Circuit breaker ouvre apres 5 echecs en fenetre 60s, half-open apres 30s, reset apres 1 succes.
- **V9** : Erreurs typees hierarchie : `BaridError` base + `BaridUnavailableError`, `BaridInvalidSignerError`, `BaridSignatureExpiredError`, `BaridQuotaExceededError`, `BaridCertificateRevokedError`, `BaridAuthError`, `BaridDocumentTooLargeError`, `BaridCircuitOpenError`, `BaridUnknownError`.
- **V10** : Chaque erreur expose `code`, `retryable`, `httpStatus`, `timestamp`, `context`, `toJSON()`.
- **V11** : `BaridMappingService.normalizePhone` accepte `0612345678`, `+212612345678`, `00212612345678`, `212612345678`, `06 12 34 56 78` -> normalise en `+212612345678`.
- **V12** : `BaridMappingService.normalizePhone` accepte numeros internationaux E.164 (+33, +1, etc.) >=10 et <=15 chiffres.
- **V13** : Mapping refuse documents > 10MB avec `BaridDocumentTooLargeError`.
- **V14** : Mapping verifie SHA-256 du buffer correspond au champ `sha256` fourni (integrite).
- **V15** : `MockBaridEsignClient` implemente la meme interface, deterministe in-memory, expose `EventEmitter` pour simuler webhooks.
- **V16** : Mock supporte `__simulateSignerSigned()` pour tests; `__reset()` pour cleanup entre tests.
- **V17** : Mock implemente idempotency : meme `(tenant_id, document_id)` -> meme workflow_id.
- **V18** : `BaridEsignModule` realise DI conditionnelle via factory provider, expose token symbol `BARID_ESIGN_PROVIDER`.
- **V19** : Tous les appels HTTP envoient `Authorization: Bearer ${apiKey}`, `X-Idempotency-Key: <uuid>`, `X-Correlation-Id`, `User-Agent: Skalean-InsurTech/1.0`.
- **V20** : Si `mtlsClientCertPath` defini, undici Agent charge cert + key pour mTLS (verification production).
- **V21** : Logs Pino structures incluent `tenant_id`, `document_id`, `signers_count`, `provider_workflow_id`, `correlation_id`, `request_id`, `duration_ms`.
- **V22** : Aucun log ne contient `apiKey`, `webhookSecret`, ou contenu base64 du document (verifie via test grep).
- **V23** : `signature_type='qualified'` par defaut; warning log si autre type utilise (non conforme loi 43-20).
- **V24** : `ListSignatureRequestsFilters` valide via Zod avec pagination (page>=1, page_size 1-100).
- **V25** : Coverage tests : >=92% lines, >=88% branches sur le dossier `barid-esign`.
- **V26** : 33+ tests passent : 15 client + 8 http + 6 mapping + 5 mock + 8 e2e integration (= 42 tests effectifs).
- **V27** : Test e2e T36 verifie le fail-fast en NODE_ENV=production avec mockMode=true.
- **V28** : Test T37 verifie l'idempotency key (meme cle -> meme workflow_id).
- **V29** : Test T20 verifie ouverture circuit breaker apres N echecs.
- **V30** : Test T40 verifie 451 certificate revoked propage correctement.
- **V31** : Aucun emoji dans le code source ou les logs.
- **V32** : `.env.example` contient les 13 variables Barid documentees avec commentaires.
- **V33** : Documentation TSDoc presente sur toutes les methodes publiques avec `@example` pour `createSignatureRequest`.
- **V34** : Health check `/health/barid` integre au module `HealthCheckModule` global.

---

## 12. EDGE CASES (15 cas)

1. **Barid down 503 prolonge** : Apres 3 retries echecs, circuit breaker ouvre. App doit gerer `BaridUnavailableError` -> queue Redis pour retry async + notification Slack `#alerts-signature` + degraded mode souscription en attente.

2. **Quota exceeded 402 fin de mois** : `BaridQuotaExceededError` -> bloquer creation nouveaux workflows, alerter ops@skalean.ma, declenchement auto-upgrade tier suivant via API B2B (Tache 3.3.32). Souscriptions en cours de signature continuent (workflows deja crees ne consomment plus quota).

3. **Signer email invalide en prod** : Validation amont Zod + Barid 422. Marquer signer en erreur dans workflow, continuer autres signers, notifier customer success agent pour correction email. Workflow reste en `in_progress` partiel.

4. **Certificate revoked 451 mid-workflow** : Cas rare (revocation ANRT post-emission certificat). Workflow marque `revoked` cote Barid. App doit recreer workflow avec nouveau certificat (regenerer signers + nouveau idempotency key). Notification PagerDuty P1 + email compliance@skalean.ma.

5. **Mock mode accidentel deploiement prod** : Garde-fou `BaridEsignModule` throw au boot. Pipeline CI/CD doit verifier `NODE_ENV=production` + `BARID_ESIGN_MOCK_MODE=false` via Helm values + ArgoCD policy.

6. **Idempotency key collision UUID v4** : Probabilite ~zero (2^122 combinaisons), mais utiliser UUID v7 (timestamp embarque) reduit a quasi-zero en pratique. Si collision detectee (Barid retourne workflow different attendu), logger CRITICAL + alerting immediat.

7. **Network timeout sous charge pic** : timeout 10s peut etre insuffisant en pic. Variable env `BARID_ESIGN_TIMEOUT_MS` augmentee a 15000ms via Helm overlay `production-peak.yaml`. Monitoring p99 latency Prometheus alert si >8s sur 5min.

8. **mTLS cert expired** : Connexion echoue avec erreur TLS. undici remonte erreur `Error: certificate has expired`. App doit alerter immediatement (sans retry, retry n'aidera pas). Cron job `BaridMtlsCertExpiryCheckJob` (Tache 3.3.30) alerte 30j avant.

9. **Webhook callback recu avant API response** : Race condition possible (Barid latency variable). Webhook handler (Tache 3.3.8) buffer Redis TTL 60s si workflow_id inconnu, replay apres reception API response avec `setImmediate`.

10. **Phone +33 instead +212 rejected silently** : Barid accepte `+33...` mais SMS notification echoue cote operateur (cout perdu). Mitigation : warning log explicite si phone non `+212`, monitoring metric `barid_signer_non_morocco_phone_total` pour detection.

11. **Document 10MB+ OOM** : Encoding base64 multiplie taille par 1.33 -> 13.3MB en memoire. Sous charge concurrente (50 req simultanees) = 665MB heap. Limite stricte 10MB amont + Node.js `--max-old-space-size=4096` + monitoring `process_resident_memory_bytes`.

12. **Idempotency key reuse apres echec partiel** : Si premier appel retourne 500 puis succes au retry, idempotency garantit pas de doublon. MAIS si app crash entre retries, reuse de l'idempotency key au redemarrage ne fonctionne que dans la fenetre 24h Barid. Strategie : persister idempotency_key + workflow_id en DB avant appel HTTP, getRequestStatus au boot pour reconcilier.

13. **API key rotation downtime** : Lors rotation cle ANRT, ancienne cle invalidee immediatement. Strategie zero-downtime : Vault renew lease automatique, dual-key support cote Barid (overlap 24h), test smoke avant invalidation ancienne cle.

14. **PDF corrupted post-download** : SHA-256 verification post-download. Si mismatch, retry download (max 2). Si echec persistant, alerter Barid support + marquer workflow `download_corrupt`.

15. **Webhook clock skew validation echoue** : Timestamp webhook +/- 5min vs serveur. NTP sync obligatoire (chrony ou systemd-timesyncd). Test e2e simulera clock drift via `jest.useFakeTimers()`.

---

## 13. CONFORMITE MAROC DETAILLEE

### 13.1 Loi 43-20 article 5 - Equivalence signature manuscrite

> **Loi n° 43-20 relative aux services de confiance pour les transactions electroniques** (Dahir n° 1-20-100 du 31 decembre 2020)
>
> **Article 5** : "La signature electronique qualifiee a, au regard de tout texte legislatif ou reglementaire, la meme valeur juridique qu'une signature manuscrite. Elle est presumee fiable jusqu'a preuve contraire."

**Implication implementation** : `signature_type='qualified'` est imperatif pour tout contrat d'assurance Skalean. Le client emet un warning log si autre type utilise et expose une metrique Prometheus `barid_non_qualified_signature_total{tenant_id}` pour audit. Tache future 3.3.40 ajoute un guard NestJS bloquant en production tout `signature_type !== 'qualified'`.

### 13.2 ANRT - Decret 2-08-518 du 21 mai 2009

> **Decret n° 2-08-518** definissant les conditions d'emission et de gestion des certificats electroniques par les prestataires de services de certification electronique.

**Liste prestataires agrees ANRT** (mise a jour 15 janvier 2026) : Barid Al-Maghrib (Poste Maroc) est l'unique prestataire delivrant des certificats qualifies pour signature electronique a destination du grand public marocain. Source officielle : [https://www.anrt.ma/sites/default/files/PSCE-agrees-2026.pdf](https://www.anrt.ma/sites/default/files/PSCE-agrees-2026.pdf).

**Validation runtime** : Champ `certificate_chain_id` retourne par `getRequestStatus` est un identifiant unique de la chaine de certifs ANRT utilisee pour signer. Stocker en DB (`signature_workflows.certificate_chain_id`) pour preuve juridique en cas de contentieux (production audit trail PDF a partir de cet ID).

### 13.3 ACAPS Circulaire 2018/01 - Tiers de confiance assurance

> **Circulaire ACAPS 2018/01** sur la dematerialisation des contrats d'assurance, article 12 : "L'utilisation de la signature electronique pour la conclusion de contrats d'assurance est subordonnee au recours a un prestataire de services de confiance certifie par l'ANRT."

**Conformite** : Barid eSign coche cette condition. Cette tache documente dans le module la reference ACAPS (commentaire en-tete `barid-esign.client.ts`). Audit trail ACAPS : chaque workflow doit etre traceable avec contrat (`document_id`), signataire (`signer_id`), horodatage, certificat (`certificate_chain_id`), IP, user-agent. Stockage 10 ans (article 23 Code des Assurances).

### 13.4 Loi 09-08 - Protection donnees personnelles

**Donnees PII transmises a Barid** (sous-traitant) :
- Identite : nom, prenom, CIN/passport (optionnel)
- Contact : email, telephone E.164
- Comportementales : IP signature, geolocation, user-agent, horodatage

**Fondement legal** (loi 09-08 article 4) : execution contrat d'assurance + obligation legale ACAPS conservation preuves.

**DPA Skalean-Barid** : Convention sous-traitance signee 12 fevrier 2025, ref `DPA-BARID-2025-001`, archive juridique. Engagements Barid :
- Hebergement Maroc exclusif (Atlas Cloud Services Casablanca)
- Pas de transfert hors MA
- Suppression sur demande Skalean (purge dans 72h)
- Notification breach <24h
- Audit annuel sur place possible

**Droits personnes** : Droit d'acces/rectification/suppression delegue a Barid via API `DELETE /signature-requests/{workflow_id}/personal-data` (Tache 3.3.45).

**Declaration CNDP** : Skalean a declare ce traitement aupres de la CNDP sous numero `D-DPI-2025-018` (refait apres entree en vigueur loi nouvelle CNDP 2024).

---

## 14. CONVENTIONS ABSOLUES

- **Multi-tenant strict** : Tous les inputs et logs incluent `tenant_id`. Aucune fuite cross-tenant possible (mock mode filtre par tenant_id, vrai client envoie `tenant_reference` a Barid).
- **TypeScript strict** : `tsconfig.json` avec `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true`, `exactOptionalPropertyTypes: true`.
- **Zod validation** : Tous les inputs publics valides via Zod avant traitement. Aucun cast `as any` (sauf isolation typage tiers documente avec commentaire).
- **Pino logging** : Niveau `info` par defaut, `debug` si `LOG_LEVEL=debug`. Champs structures obligatoires : `msg`, `tenant_id`, `correlation_id`. Redaction auto des secrets via `pino.redact: ['*.apiKey', '*.webhookSecret', '*.content_base64']`.
- **Pas d'emoji** : Code, commentaires, logs, tests, documentation - aucun emoji.
- **Imports absolus** : Utiliser path aliases `@/signature/...` (defini dans `tsconfig paths`) plutot que `../../../`.
- **Naming snake_case wire format** : Champs envoyes/recus de Barid en `snake_case` (workflow_id, sign_urls). Champs internes TypeScript en `camelCase` (sauf interfaces wire format).
- **Erreurs typees** : Toujours throw une instance de `BaridError` (jamais `Error` generique).
- **Pas de magic numbers** : Constantes (10MB, 500ms, 30000ms) extraites en config Zod ou constantes nommees.
- **Async/await uniquement** : Pas de callbacks ni `.then()` sauf integration tiers obligatoire.
- **Tests deterministes** : `jest.useFakeTimers()` pour delais, mocks Date.now via `jest.spyOn(Date, 'now')`.
- **Documentation TSDoc** : Toutes methodes publiques documentees avec `@param`, `@returns`, `@throws`, `@example` quand pertinent.

---

## 15. VALIDATION PRE-COMMIT

```bash
# Lint
pnpm eslint packages/signature/src/providers/barid-esign --max-warnings=0
# Typecheck strict
pnpm tsc -p packages/signature/tsconfig.json --noEmit
# Tests + coverage
pnpm jest packages/signature/src/providers/barid-esign --coverage --coverageThreshold='{"global":{"lines":92,"branches":88,"functions":95,"statements":92}}'
# Tests integration
pnpm jest apps/api/test/signature/barid-esign-integration.e2e-spec.ts --runInBand
# Audit secrets (no apiKey/secret in code)
pnpm grep -r "BARID_ESIGN_API_KEY" packages/signature/src/providers/barid-esign --include='*.ts' | grep -v 'process.env\|\.spec\.ts\|\.example' && exit 1 || echo "OK"
# Audit emoji
pnpm grep -rP "[\x{1F300}-\x{1F9FF}]" packages/signature/src/providers/barid-esign && exit 1 || echo "OK no emoji"
# Audit any cast
pnpm grep -rn "as any" packages/signature/src/providers/barid-esign --include='*.ts' | grep -v '\.spec\.ts' && echo "REVIEW any casts" || echo "OK no any cast"
```

Pre-commit hook (Husky `.husky/pre-commit`) execute automatiquement lint + typecheck + tests touches.

---

## 16. COMMIT MESSAGE

```
feat(signature): client Barid eSign API undici + qualified signature loi 43-20

Implements BaridEsignClient (NestJS injectable) for Poste Maroc Barid eSign API,
the only ANRT + ACAPS certified provider delivering qualified electronic signatures
equivalent to manuscript per loi 43-20 article 5.

Features:
- 7 public methods (create/get/cancel/download/list/resend/healthCheck)
- BaridHttpClient undici transport with exponential retry (max 3, 500ms-8s, jitter)
- Circuit breaker (open after 5 failures in 60s window, half-open after 30s)
- Typed errors hierarchy (9 classes extends BaridError)
- BaridMappingService phone normalization E.164 +212
- MockBaridEsignClient in-memory deterministic for tests/dev
- Zod-validated config (13 env vars), production guard refuses mock mode
- mTLS optional support for production
- Pino structured logging with secrets redaction
- 42 tests (15 client + 8 http + 6 mapping + 5 mock + 8 e2e integration)
- Coverage 92%+ lines, 88%+ branches

Compliance:
- Loi 43-20 article 5 (qualified signature = manuscript equivalent)
- ANRT Decret 2-08-518 (certificate ANRT)
- ACAPS Circulaire 2018/01 (certified trust provider)
- Loi 09-08 (data residency MA via Atlas Cloud Services, DPA-BARID-2025-001)

Refs: decision-008, decision-009, decision-014, decision-021
ADR: ADR-007-signature-electronique-loi-43-20.md, ADR-009-provider-barid-exclusif.md
Sprint: 10 (Docs + Signature)
Closes: TASK-3.3.7
Depends: TASK-3.3.6
Unblocks: TASK-3.3.8, TASK-3.3.9, TASK-3.3.10
```

---

## 17. WORKFLOW NEXT STEP - Tache 3.3.8

Apres validation et merge de cette tache, la suite immediate est :

**Tache 3.3.8 - Webhook Handler Barid Signature Events** (Sprint 10, Phase 3, P0, 5h) :
- Endpoint `POST /webhooks/barid-esign` recevant callbacks Barid (signer.signed, workflow.completed, workflow.expired, workflow.cancelled, certificate.revoked)
- Verification HMAC-SHA256 signature header `X-Barid-Signature` avec `BARID_ESIGN_WEBHOOK_SECRET`
- Idempotency : dedup events par `event_id` (Redis SET, TTL 7 jours)
- Race condition handling : si `workflow_id` inconnu en DB, buffer Redis 60s puis replay
- Mise a jour `signature_workflows` table avec status, signers_status, completed_at
- Trigger `SignatureCompletedEvent` -> module `Subscription` finalise contrat (Tache 3.3.10)
- Tests integration avec mock webhook payloads + signature HMAC valide/invalide

**Pre-requis Tache 3.3.8** :
- Cette tache 3.3.7 mergee sur `develop`
- Migration DB `add_signature_workflows_table` (Tache 3.3.6)
- Module `Webhooks` de base (Tache 3.3.5)
- Variable `BARID_ESIGN_WEBHOOK_SECRET` provisionnee Vault

**Tache 3.3.9 - HMAC Webhook Signature Verification** (4h, dependence directe 3.3.8) detaille la verification cryptographique en service dedie reutilisable.

**Tache 3.3.10 - Signature Workflow Orchestrator** (8h, P0) orchestrera l'usage combine 3.3.6 + 3.3.7 + 3.3.8 dans un service `SignatureOrchestratorService` expose au module `Subscription` consommateur final.

---

**Fin Tache 3.3.7. Total estime : 6h. Reviewers : Backend Lead + Compliance Officer + Security Architect.**
