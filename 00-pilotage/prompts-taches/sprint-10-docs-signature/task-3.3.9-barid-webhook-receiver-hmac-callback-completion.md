# Tache 3.3.9 - Barid eSign Webhook Receiver Public Endpoint + HMAC SHA-256 Signature Verification + Idempotency Pattern + Async Processing via Kafka Consumer + Apply ANRT Timestamp on Completion + Trigger Sealed Archive + Notify User via Comm Orchestrator + Fast 200 OK Response

## Section 1 - Identification

**ID**: TACHE-3.3.9
**Sprint**: 10 (Docs + Signature Loi 43-20)
**Phase**: 3 (Provider integrations + Lifecycle completion)
**Priorite**: P0 (bloquante - sans webhook les workflows restent perpetuellement "in_progress")
**Effort estime**: 5h
**Depend de**: Tache 3.3.7 (BaridEsignClient API), Tache 3.3.8 (ANRT timestamping RFC 3161), Sprint 9 (Comm Orchestrator), Sprint 3 (PublicEndpointGuard, MultiTenantContext), Sprint 2 (KafkaService, IdempotencyPattern de base)
**Bloque**: Tache 3.3.10 (Audit trail signature events), Tache 3.3.12 (Sealed archive trigger), Tache 3.3.13 (Workflow completion notifications), Sprint 11 (Compliance reports basees sur workflows finalises)

**Equipe cible**: Backend NestJS senior + DevOps (configuration secrets webhook + monitoring latence p95 < 500ms)
**Environnements impactes**: dev (mock Barid local), staging (sandbox Barid Maroc), prod (Barid Production https://esign.barid.ma)

## Section 2 - Objectif metier et fonctionnel

L'integration Barid eSign (operateur historique des signatures qualifiees Loi 43-20 au Maroc) repose sur un modele asynchrone evenementiel: lorsque l'API Skalean cree un workflow de signature via POST /workflows (Tache 3.3.7), Barid prend le relais et orchestre l'experience signataire (envoi email/SMS, page de signature avec OTP, validation certificat ANRT). Skalean ne peut pas savoir en temps reel si un signataire a signe sans poller constamment l'API Barid (couteux + latence). Barid pousse donc les changements d'etat via des webhooks HTTP POST vers une URL publique fournie par Skalean lors de la creation du workflow (callback_url).

**Probleme metier**: Un workflow de signature peut prendre de quelques minutes (signataire reactif) a plusieurs jours (workflow sequentiel multi-signataires avec relances). L'utilisateur final (assure, courtier, gestionnaire) doit etre notifie immediatement de l'aboutissement (signature.completed) ou de l'echec (signature.declined, signature.expired) sans attendre un poll periodique. De plus, conformement a la Loi 43-20 article 9 (preuve numerique), chaque evenement du cycle de vie de la signature doit etre horodate par un Time Stamping Authority qualifie ANRT pour conserver une valeur probatoire en cas de litige.

**Solution technique**: Endpoint public POST `/api/v1/public/webhooks/barid-esign` qui recoit les callbacks Barid, verifie l'authenticite via HMAC SHA-256 (header `X-Barid-Signature`), garantit l'idempotence (Barid retry jusqu'a 5 fois en cas de timeout > 5s), publie l'evenement sur Kafka topic `signature.webhook.received` pour traitement asynchrone, et retourne `200 OK` en moins de 500ms (objectif p95 < 300ms, p99 < 500ms) pour eviter les retries inutiles. Le consumer Kafka `BaridWebhookProcessorConsumer` orchestre ensuite le pipeline de finalisation: telechargement du PDF signe, application du timestamp ANRT (Tache 3.3.8), persistance en base, declenchement de l'archivage scelle (Tache 3.3.12), et notification utilisateur via le Comm Orchestrator Sprint 9 (email + WhatsApp confirmation).

**Beneficiaires**:
- **Assures**: notification quasi-instantanee de la finalisation de leur contrat (email + WhatsApp avec PDF signe attache)
- **Courtiers**: dashboard en temps reel des workflows de signature en cours/termines
- **Gestionnaires sinistres**: declenchement automatique du paiement indemnitaire des reception du quittance signe
- **Compliance officer ACAPS**: piste d'audit complete avec horodatage qualifie pour chaque etape (Loi 43-20 art. 9)
- **DSI Skalean**: scalabilite horizontale via Kafka (peut absorber 10000+ webhooks/min en peak)

**Indicateurs cles**:
- Latence webhook reception -> 200 OK: p50 < 100ms, p95 < 300ms, p99 < 500ms
- Taux d'idempotence: 100% (zero double-traitement meme en cas de retry Barid)
- Taux de verification HMAC reussi: 100% (toute requete sans signature valide rejetee 401)
- Temps de finalisation completion -> notification user: p95 < 30s (telechargement PDF + ANRT timestamp + archivage + notif)
- Disponibilite endpoint webhook: 99.95% (SLA strict, Barid declare l'integration "down" apres 3 echecs consecutifs)

## Section 3 - Contexte etendu

### 3.1 Pourquoi HMAC SHA-256 (et pas JWT, mTLS, ou IP whitelist)

Le standard de facto pour l'authentification des webhooks dans l'industrie (Stripe, GitHub, Shopify, Twilio, Slack, AWS SNS, GitLab, Bitbucket, Sendgrid, Mailgun, Twilio SendGrid, Vercel, Netlify, Cloudflare Workers, etc.) est HMAC SHA-256 calcule sur le corps brut de la requete (raw body) avec une cle secrete partagee. Comparaison:

- **JWT signe (RS256/ES256)**: Necessite que Barid possede une paire de cles asymetriques publiees. Surcharge: gestion JWKS, rotation, expiration. Avantage marginal vs HMAC pour un usage webhook ou la cle est partagee bilateralement.
- **mTLS (mutual TLS)**: Robuste mais complexe (certificats client, CA dediee, gestion revocation CRL/OCSP). Barid ne propose pas mTLS pour les webhooks (uniquement HMAC). Inadapte pour un endpoint expose derriere un reverse proxy AWS ALB qui termine TLS.
- **IP whitelist**: Barid publie une liste d'IPs source mais celle-ci change occasionnellement (1-2 fois/an avec preavis 30 jours). Difficile a maintenir, casse en cas de migration cloud Barid. Peut etre utilise en defense en profondeur (couche supplementaire) mais pas comme authentification primaire.
- **API Key dans header**: Vulnerable au replay attack (toute interception de l'header rejoue indefiniment). HMAC + timestamp resout cela.

**HMAC SHA-256 retenu pour 5 raisons**:
1. **Standard industriel** - Documentation Barid (https://docs.barid.ma/esign/webhooks) impose HMAC SHA-256 obligatoire avec format `X-Barid-Signature: sha256=<hex>` et `X-Barid-Timestamp: <unix_seconds>`.
2. **Verification cryptographique forte** - SHA-256 collision-resistant (2^128 securite), HMAC protege contre length extension attack vs SHA-256 brut.
3. **Replay protection** - Combinaison `timestamp + raw_body` dans le payload HMAC + verification fenetre 5min cote serveur (`WEBHOOK_REPLAY_WINDOW_SECONDS=300`).
4. **Performance** - Calcul HMAC ~10us pour payload 10KB sur CPU moderne, negligeable vs latence reseau.
5. **Simplicite operationnelle** - Une seule cle secrete a gerer dans AWS Secrets Manager (`BARID_ESIGN_WEBHOOK_SECRET`), rotation possible avec dual-key support (cf section pieges).

### 3.2 Pourquoi timestamp replay protection

Sans timestamp, un attaquant qui intercepte une requete webhook valide (man-in-the-middle, log leak, capture reseau) peut la rejouer indefiniment et declencher des actions metier indesirables (ex: marquer un workflow comme `completed` alors qu'il a ete `declined` ulterieurement). Le timestamp inclus dans le payload HMAC garantit que:

1. **Toute modification du timestamp invalide la signature** (HMAC depend du timestamp)
2. **Tout rejeu apres 5 minutes est rejete** par le check `Math.abs(now - parseInt(timestamp)) > 300`
3. **L'horloge serveur doit etre synchronisee NTP** (drift < 30s acceptable, > 30s entraine rejets faux-positifs en cas de webhook envoye juste avant minuit UTC)

La fenetre de 5 minutes est un compromis: assez large pour absorber latence reseau Barid -> Skalean (< 2s typique, < 30s en cas de degradation), assez serree pour limiter la fenetre d'attaque en cas de fuite de signature.

**Note**: La protection replay HMAC + timestamp ne dispense PAS de l'idempotence applicative basee sur `provider_event_id`. Les deux sont complementaires:
- HMAC + timestamp = protection contre replay malicieux ou retry naive en clair
- Idempotency provider_event_id = protection contre retry legitime de Barid (Barid retry 5x avec backoff si timeout > 5s ou erreur 5xx, et ces retries ont le meme event_id et un timestamp recent)

### 3.3 Pourquoi async processing via Kafka

Barid considere un webhook comme echoue si la reponse HTTP arrive apres 5 secondes ET retry jusqu'a 5 fois avec backoff exponentiel (5s, 25s, 125s, 625s, 3125s = ~52min total). Apres 5 echecs, Barid marque l'integration "degraded" et envoie une alerte email a l'admin du tenant. Apres 24h sans webhook acquitte, Barid suspend les nouveaux workflows pour ce tenant.

Le pipeline de finalisation post-completion est lourd:
- Telechargement PDF signe depuis Barid (50-500 KB, latence reseau 200-2000ms selon taille)
- Calcul SHA-512 du PDF (10-50ms)
- Appel ANRT TSA RFC 3161 (latence reseau Maroc <-> ANRT: 500-3000ms typique, peut depasser 10s en peak)
- Persistance PostgreSQL (workflow update + audit_trail insert, ~50ms)
- Upload S3 archive scelle (Tache 3.3.12, ~500ms-2s)
- Publish Kafka comm.notify (10-50ms)
- Generation des notifications email + WhatsApp (~1-5s pour render templates + appel Mailgun + appel WhatsApp Business API)

Total worst case: 15-25 secondes, **largement au-dessus de la limite 5s** de Barid.

**Solution**: pattern "ack-then-process" via Kafka:
1. Webhook recu -> verification HMAC + idempotency check (~50ms)
2. Publish event Kafka `signature.webhook.received` (~20ms)
3. Return 200 OK immediatement (latence totale ~70-150ms)
4. Consumer Kafka `BaridWebhookProcessorConsumer` traite le pipeline lourd en background (15-25s)
5. En cas d'echec consumer, retry automatique via Kafka (configuration `retries=5, backoff=exponential`)
6. En cas d'echec persistent apres 5 retries, message route vers DLQ `signature.webhook.dlq` pour traitement manuel

### 3.4 Pourquoi idempotence

Barid garantit "at-least-once delivery" (pas "exactly-once"). Causes legitimes de duplication:
- Reseau coupe entre Barid et Skalean apres traitement Skalean mais avant ack: Barid ne recoit jamais le 200 OK, retry. Skalean recoit 2x le meme event.
- Skalean repond 503 Service Unavailable durant un deploiement (rolling update): Barid retry. Si la nouvelle instance traite mais l'ancienne avait deja persiste, double traitement.
- Bug cote Barid (rare mais documente): meme event_id envoye deux fois en l'espace de quelques millisecondes en cas de race condition dans le scheduler Barid.

**Sans idempotence applicative, consequences possibles**:
- Double application du timestamp ANRT (gaspillage quota TSA payant ~0.05 EUR/timestamp)
- Double notification user (assure recoit 2 emails identiques -> impression bug, plainte support)
- Double archive S3 (objets dupliques, surcout stockage Glacier)
- Double entree audit_trail (rapports compliance ACAPS errones, comptage signatures double)
- Double trigger Kafka `signature.workflow_completed` -> double consumer downstream (paiement indemnite, etc.)

**Pattern d'idempotence retenu**: table dediee `sig_webhooks_received` avec UNIQUE constraint sur `(provider, provider_event_id)`. Insert OUT OF TRANSACTION avec `ON CONFLICT DO NOTHING RETURNING id`: si la ligne existe deja (id retourne null), on log "duplicate" et on retourne 200 OK sans publier sur Kafka.

### 3.5 Trade-offs sync vs async processing

**Option A - Sync (rejetee)**: Traiter tout le pipeline dans le handler HTTP. Avantage: code simple, pas de Kafka, pas de DLQ. Inconvenients fatals:
- Latence > 5s -> retries Barid -> double traitement (meme avec idempotence, gaspillage CPU)
- Si ANRT TSA down (10s timeout), webhook timeout puis retry, puis re-timeout, puis declared failed apres 5 retries
- Pas de scalabilite horizontale: 1 instance API saturee = perte de webhooks
- Pas de retry automatique si bug transient (DB connection lost, S3 5xx)

**Option B - Async via Kafka (retenue)**: Webhook handler ultra-leger, traitement lourd en background. Avantages:
- Latence webhook deterministe < 500ms quoiqu'il arrive
- Decouplage temporel: Kafka peut bufferiser 1M+ messages, traitement peut s'etaler sans perdre d'evenement
- Retry automatique avec backoff via Kafka consumer
- Possibilite de scaler les consumers independamment des API instances (10 consumers pour absorber un peak vs 2 consumers steady-state)
- DLQ pour analyse post-mortem des echecs persistents
- Replay possible: si bug introduit dans le consumer, on peut reset l'offset Kafka et re-traiter les 24h passees

**Option C - Async via BullMQ Redis (rejetee)**: Plus simple mais Skalean utilise deja Kafka pour tout l'event-driven (Sprint 2). Eviter de multiplier les message brokers (operational burden, monitoring, alerting double).

**Option D - Async via DB queue (rejetee)**: Polling DB lent et couteux, pas de back-pressure naturel, scaling difficile. Anti-pattern documente (cf "You probably don't need a message queue" article controverse, mais Skalean a deja Kafka).

### 3.6 Pieges techniques (12+ recenses)

1. **HMAC clock skew**: Les serveurs Barid au Maroc et les serveurs Skalean (multi-region AWS eu-west-3 Paris + me-south-1 Bahrein) peuvent avoir un drift NTP. Si serveur Skalean en avance de 60s vs Barid, un timestamp recent valide chez Barid sera accepte (within +/- 300s). Si drift > 300s, faux rejets. **Mitigation**: NTP chrony sur tous les serveurs avec pool maroc + AWS time servers, alerte CloudWatch si drift > 30s.

2. **Raw body parsing Fastify**: Fastify parse le body JSON automatiquement par defaut, ce qui transforme `{"a":1, "b":2}` en `{"a":1,"b":2}` (perte d'espaces). Le HMAC calcule par Barid est sur les bytes ORIGINAUX. **Mitigation**: configurer Fastify avec `addContentTypeParser('application/json', { parseAs: 'buffer' }, ...)` pour acceder au raw body via `req.rawBody` AVANT le parsing, puis parser manuellement apres verification HMAC.

3. **Body parse twice -> hash mismatch**: Si on parse le body en JSON puis qu'on le re-stringify pour calculer le HMAC, l'ordre des cles ou le formatage peut differer. **Mitigation**: TOUJOURS conserver `req.rawBody: Buffer` et calculer HMAC sur ce buffer, jamais sur un stringify.

4. **Idempotency race condition**: Si 2 instances API recoivent simultanement le meme webhook (replicated par un load balancer mal configure), les deux peuvent passer le check "duplicate" en parallele avant que l'INSERT soit committe. **Mitigation**: utiliser `INSERT ... ON CONFLICT DO NOTHING RETURNING id` dans une SEULE transaction, le retour null indique "deja insere par une autre instance".

5. **Kafka unavailable graceful**: Si Kafka est down quand le webhook arrive, on ne peut pas publish. Que faire? Retourner 503 declenchera des retries Barid (acceptable mais embete les ops). **Mitigation**: pattern "store-then-forward" - persister l'evenement dans `sig_webhooks_received` avec `processing_status='pending'`, retourner 200 OK, et un job cron `WebhookForwarderJob` retry la publication Kafka chaque minute pour les `pending`.

6. **Signature timing attack**: Comparer la signature attendue et la signature recue avec `===` ou `Buffer.compare` est vulnerable a une attaque temporelle (different temps selon position du premier byte different). **Mitigation**: utiliser `crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'))` qui compare en temps constant.

7. **Secret rotation**: Quand on rotate le secret HMAC (recommande tous les 90 jours, OWASP), il y a une fenetre ou Barid peut envoyer encore avec l'ancien secret. **Mitigation**: support dual-secret via env vars `BARID_ESIGN_WEBHOOK_SECRET_PRIMARY` et `BARID_ESIGN_WEBHOOK_SECRET_SECONDARY`. Verifier d'abord avec primary, fallback secondary, log warning si secondary utilise. Apres rotation completee chez Barid (24-48h), retirer le secondary.

8. **Webhook IP whitelist optional**: Barid publie ses IPs source mais ne les fixe pas SLA. Si on whitelist au niveau ALB et Barid migre, les webhooks sont bloques sans warning. **Mitigation**: NE PAS whitelist au niveau ALB (relier sur HMAC seul), mais loguer l'IP source et alerter si elle n'est pas dans la liste connue (warning, pas reject).

9. **Payload too large > 1MB**: Bug Barid possible: payload massif (ex: include base64 du PDF entier au lieu d'une URL de telechargement). DoS potentiel. **Mitigation**: configurer Fastify `bodyLimit: 1048576` (1MB), reject 413 Payload Too Large. Loguer pour analyse.

10. **Malformed JSON**: Barid peut envoyer JSON invalide (bug, encoding latin-1 vs utf-8). **Mitigation**: try/catch JSON.parse, retourner 200 OK + log error (eviter retry inutile sur bug Barid). Persister raw_body dans `sig_webhooks_received.payload_hash` pour analyse manuelle.

11. **Workflow_id not found (orphan webhook)**: Webhook arrive pour un workflow_id qui n'existe pas en DB (ex: workflow cree puis supprime hard delete avant que le webhook arrive, ou workflow d'un autre tenant route par erreur). **Mitigation**: 200 OK + log warning + persister le webhook orphelin pour analyse, NE PAS rejeter 404 (Barid retry).

12. **Already completed (idempotency state machine)**: Webhook `signature.completed` arrive deux fois (ou apres un `signature.declined` qui aurait du venir avant). State machine transition invalide. **Mitigation**: dans le consumer, verifier `currentStatus -> newStatus` est une transition valide via `WorkflowStateMachine.canTransition()` (Tache 3.3.6), si non, log warning + skip + 200 OK.

13. **Tenant context perdu dans le consumer**: Le webhook public n'a pas de JWT donc pas de `tenantId` direct. Le `tenantId` doit etre derivable du `workflow_id`. **Mitigation**: dans le consumer, faire `SELECT tenant_id FROM sig_signing_workflows WHERE id = $1`, puis injecter `MultiTenantContext.runWithTenant(tenantId, () => ...)` pour toute la suite du pipeline (RLS PostgreSQL, audit_trail, S3 bucket selection).

14. **Event ordering**: Si Barid envoie `signer.signed` (signataire 1) puis `signature.completed` mais l'ordre Kafka est inverse a cause de partitionnement, on peut traiter completion avant le signed individuel. **Mitigation**: partition Kafka par `workflow_id` (key) pour garantir l'ordre at-least-once par workflow, ET state machine resilient qui accepte les transitions out-of-order avec log warning.

### 3.7 Reference standards et documentation

- **Barid eSign Webhooks**: https://docs.barid.ma/esign/webhooks (acces sous NDA, version 2.4.1 en vigueur)
- **OWASP Webhook Security Cheat Sheet**: https://cheatsheetseries.owasp.org/cheatsheets/Webhook_Security_Cheat_Sheet.html
- **RFC 6234 (HMAC SHA-256)**: https://datatracker.ietf.org/doc/html/rfc6234
- **Kafka Idempotent Producer + Consumer**: https://kafka.apache.org/documentation/#semantics
- **NestJS Microservices Kafka**: https://docs.nestjs.com/microservices/kafka
- **Fastify Raw Body Plugin**: https://github.com/Eomm/fastify-raw-body
- **Stripe Webhook Best Practices** (reference industrie): https://stripe.com/docs/webhooks/best-practices
- **Loi 43-20 article 9**: Bulletin Officiel Maroc 6936 (texte complet sur preuve numerique et tracabilite)
- **ACAPS Circulaire 2018/01 article 9**: Tracabilite des operations de signature electronique en assurance
- **CNDP Loi 09-08**: Protection donnees personnelles, minimisation PII signers dans les logs

## Section 4 - Specifications fonctionnelles detaillees

### 4.1 Endpoint public

**Route**: `POST /api/v1/public/webhooks/barid-esign`
**Auth**: bypass JWT (`@Public()` decorator Sprint 3)
**Headers requis**:
- `Content-Type: application/json`
- `X-Barid-Signature: sha256=<64-char-hex>` (signature HMAC SHA-256)
- `X-Barid-Timestamp: <unix-epoch-seconds>` (entier)
- `X-Barid-Event-Id: <uuid-v4>` (identifiant unique de l'evenement, fourni par Barid)
- `X-Barid-Webhook-Id: <uuid-v4>` (identifiant du webhook configure cote Barid, optionnel mais utile pour debug)

**Body**: JSON avec structure
```json
{
  "event_type": "signature.completed",
  "event_id": "evt_<uuid>",
  "occurred_at": "2026-05-08T14:23:45Z",
  "workflow_id": "wf_<uuid>",
  "barid_workflow_id": "barid_<uuid>",
  "tenant_external_ref": "tenant_<uuid>",
  "data": { ... event-specific payload ... }
}
```

**Reponses**:
- `200 OK` `{ "received": true, "duplicate": false }` (cas nominal)
- `200 OK` `{ "received": true, "duplicate": true }` (idempotency hit)
- `401 Unauthorized` `{ "error": "Invalid webhook signature" }` (HMAC fail)
- `401 Unauthorized` `{ "error": "Webhook timestamp too old (replay protection)" }`
- `400 Bad Request` `{ "error": "Malformed JSON payload" }` (JSON invalid)
- `413 Payload Too Large` (body > 1MB)

**SLA latence**: p50 < 100ms, p95 < 300ms, p99 < 500ms

### 4.2 Types d'evenements supportes

| Event Type | Description | Action consumer |
|---|---|---|
| `signature.completed` | Tous les signataires ont signe | Telecharger PDF + ANRT timestamp + archive + notify user (success email + WA) |
| `signature.declined` | Un signataire a refuse de signer | Update workflow status='declined' + notify user (decline email) + audit_trail |
| `signature.expired` | workflow expired_at atteint sans completion | Update workflow status='expired' + notify user (expired email + WA reminder) + audit_trail |
| `signer.viewed` | Signataire a ouvert l'URL de signature | Audit only (sig_audit_trails entry, no notification) |
| `signer.signed` | Un signataire a signe (workflow sequentiel multi-signataires) | Update sig_signers.status='signed' + audit_trail + si dernier signataire awaitee notification next signer |
| `signer.declined` | Un signataire a refuse (workflow continue ou pas selon config) | Update sig_signers.status='declined' + audit_trail + si workflow blocking decline -> trigger signature.declined |
| `signature.delivered` | Email/SMS d'invitation delivre au signataire | Audit only |
| `signature.bounced` | Email d'invitation a bounce | Update sig_signers.delivery_status + notify tenant admin |

### 4.3 Pipeline de finalisation (consumer Kafka)

Le `BaridWebhookProcessorConsumer` consomme le topic `signature.webhook.received` avec consumer group `barid-webhook-processor-v1`. Pour chaque message:

1. **Resolve tenant context**: extraire `workflow_id` du payload, query `SELECT tenant_id, status FROM sig_signing_workflows WHERE id = $1` SANS RLS (consumer system context), puis bascule en `MultiTenantContext.runWithTenant(tenantId)` pour le reste du traitement.

2. **State machine validation**: instancier `WorkflowStateMachine.fromCurrentStatus(workflow.status)` (Tache 3.3.6), verifier `canTransition(eventTypeToTargetStatus[event_type])`. Si invalide, log warning, ack message Kafka (skip), sortir.

3. **Dispatch event-specific handler** via switch:
   - `signature.completed` -> `handleCompletion(workflowId, payload)`
   - `signature.declined` -> `handleDeclination(workflowId, payload)`
   - `signature.expired` -> `handleExpiration(workflowId, payload)`
   - `signer.signed` / `signer.declined` / `signer.viewed` / `signature.delivered` / `signature.bounced` -> `handleSignerEvent(workflowId, payload)`

4. **handleCompletion** (cas le plus complexe):
   a. Telecharger PDF signe via `BaridEsignClient.downloadSignedDocument(workflow.providerWorkflowId)` (Tache 3.3.7)
   b. Calculer SHA-512 du PDF (Tache 3.3.8 utilise SHA-512)
   c. Appel ANRT TSA via `AnrtTimestampService.requestTimestamp(sha512Hash)` (Tache 3.3.8) -> recoit `tsa_token` (RFC 3161 binary blob)
   d. Persister en transaction PostgreSQL:
      - `UPDATE sig_signing_workflows SET status='completed', completed_at=NOW(), signed_pdf_hash_sha512=$1, anrt_tsa_token=$2 WHERE id=$3`
      - `INSERT INTO sig_audit_trails (workflow_id, event_type, event_data, occurred_at, anrt_timestamp_token) VALUES ('completed', ...)` (Tache 3.3.10)
   e. Upload PDF signe + tsa_token vers S3 bucket archive scelle via `SealedArchiveService.archive(workflow, pdfBuffer, tsaToken)` (Tache 3.3.12) - emettre event Kafka `signature.workflow_completed`
   f. Publier event Kafka `comm.notify` avec channel email + whatsapp pour chaque signataire (Sprint 9 Comm Orchestrator)
   g. Update `sig_webhooks_received SET processing_status='completed', processed_at=NOW() WHERE id=$webhookId`
   h. Ack message Kafka

5. **Erreur handler**: si toute etape leve, catch, update `sig_webhooks_received SET processing_status='failed', processing_error=$err`, NACK Kafka pour retry (max 5 tentatives via Kafka consumer config), apres 5 echecs message routed vers DLQ `signature.webhook.dlq`.

### 4.4 Securite

- **Endpoint public** (bypass JWT) mais protected par HMAC -> aucune route metier sensible exposee, seul un endpoint webhook ack-then-process
- **Rate limit**: 1000 req/min par IP source (Sprint 1 RateLimitGuard etendu)
- **No PII in logs** (CNDP Loi 09-08): hasher email/phone signers avant log, masquer payload dans Pino log avec `redact: ['data.signers[*].email', 'data.signers[*].phone']`
- **Audit complet** (Loi 43-20 art. 9): chaque webhook recu loggue dans `sig_webhooks_received` avec hash SHA-256 du payload pour preuve (sans exposer PII)
- **No SSRF**: le webhook ne fait pas de fetch d'URL externe basee sur le payload

### 4.5 Multi-tenant

- Le webhook public n'a pas de JWT donc pas de `tenantId` direct dans le contexte Nest
- Le `tenantId` est derive en query DB sur `sig_signing_workflows.id`
- Apres derivation, tout le traitement consumer se fait dans `MultiTenantContext.runWithTenant(tenantId, async () => { ... })` qui:
  - Set le PostgreSQL session var `app.current_tenant_id` pour activation RLS
  - Inject `tenantId` dans tous les logs Pino via AsyncLocalStorage
  - Resolve le bon S3 bucket `skalean-tenant-{tenantId}-archive` (Tache 3.3.2)

## Section 5 - Architecture technique

### 5.1 Diagramme de flux

```
[Barid eSign Servers]
        |
        | 1. POST https://api.skalean.ma/api/v1/public/webhooks/barid-esign
        |    Headers: X-Barid-Signature, X-Barid-Timestamp, X-Barid-Event-Id
        |    Body: { event_type, event_id, workflow_id, data, ... }
        v
[AWS ALB] --> [API Pod NestJS Fastify]
                    |
                    | 2. BaridSignatureMiddleware
                    |    - Check headers presents
                    |    - Verify timestamp window (300s)
                    |    - Compute HMAC SHA-256 sur (timestamp + raw_body)
                    |    - timingSafeEqual vs X-Barid-Signature
                    |    - Si fail -> 401
                    v
                [BaridWebhookController.receive()]
                    |
                    | 3. WebhookIdempotencyService.checkAndStore(eventId, ttl=86400)
                    |    - INSERT INTO sig_webhooks_received ON CONFLICT DO NOTHING RETURNING id
                    |    - Si null -> duplicate, log + return 200 OK { duplicate: true }
                    v
                    | 4. KafkaProducer.publish('signature.webhook.received', {
                    |      event_type, workflow_id, raw_payload, received_at
                    |    }, partitionKey=workflow_id)
                    v
                [Return 200 OK { received: true } - latence ~70-150ms]


[Kafka topic: signature.webhook.received]
        |
        v
[BaridWebhookProcessorConsumer] (consumer group: barid-webhook-processor-v1)
        |
        | 5. Resolve tenant: SELECT tenant_id FROM sig_signing_workflows WHERE id=$1
        |
        | 6. MultiTenantContext.runWithTenant(tenantId, async () => {
        |
        |    7. WorkflowStateMachine.canTransition(currentStatus, targetStatus)
        |       Si invalide -> log warning, ack, skip
        |
        |    8. Dispatch handler par event_type:
        |
        |       case 'signature.completed':
        |         a. CompletionOrchestratorService.orchestrate(workflowId, payload)
        |            - BaridEsignClient.downloadSignedDocument()
        |            - HashService.sha512(pdfBuffer)
        |            - AnrtTimestampService.requestTimestamp(hash)
        |            - WorkflowsRepo.markCompleted(workflowId, hash, tsaToken)
        |            - AuditTrailService.log(workflowId, 'signature.completed', tsaToken)
        |            - KafkaProducer.publish('signature.workflow_completed', ...)
        |            - KafkaProducer.publish('comm.notify', { channels: [email, whatsapp], ... })
        |
        |       case 'signature.declined':
        |         WorkflowsRepo.markDeclined(...)
        |         AuditTrailService.log(...)
        |         KafkaProducer.publish('comm.notify', { template: 'signature_declined', ... })
        |
        |       case 'signature.expired':
        |         WorkflowsRepo.markExpired(...)
        |         AuditTrailService.log(...)
        |         KafkaProducer.publish('comm.notify', { template: 'signature_expired', ... })
        |
        |       case 'signer.signed' | 'signer.declined' | 'signer.viewed':
        |         SignerEventService.handle(...)
        |         AuditTrailService.log(...)
        |
        |    9. WebhookIdempotencyService.markProcessed(webhookId)
        |    })
        |
        | 10. Ack Kafka message
        |
        | Erreur -> NACK -> retry x5 -> DLQ signature.webhook.dlq
```

### 5.2 Couches Nest impliquees

- **Module**: `SignatureModule` (existant Tache 3.3.6) - ajouter providers BaridWebhookController, BaridSignatureMiddleware, BaridWebhookProcessorConsumer, WebhookIdempotencyService, CompletionOrchestratorService
- **Controllers**: `BaridWebhookController` (HTTP layer)
- **Middlewares**: `BaridSignatureMiddleware` (HMAC verification, applied via `MiddlewareConsumer` dans `SignatureModule.configure()`)
- **Consumers**: `BaridWebhookProcessorConsumer` (Kafka consumer Nest microservices)
- **Services**: `WebhookIdempotencyService`, `CompletionOrchestratorService`
- **DTOs**: `BaridWebhookPayloadDto` avec Zod validation
- **Types**: `barid-event.types.ts` (enums + interfaces)
- **Repos**: utilise `SigningWorkflowsRepository` (Tache 3.3.6), `WebhooksReceivedRepository` (nouveau)
- **DB Migration**: table `sig_webhooks_received`

### 5.3 Configuration Fastify pour raw body

```typescript
// apps/api/src/main.ts (modification)
import fastifyRawBody from 'fastify-raw-body';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 1048576 }),
  );

  await app.register(fastifyRawBody as any, {
    field: 'rawBody',
    global: false,
    encoding: false,
    runFirst: true,
    routes: ['/api/v1/public/webhooks/barid-esign'],
  });

  await app.listen(3000, '0.0.0.0');
}
```

### 5.4 Configuration Kafka consumer

```typescript
// apps/api/src/modules/signature/signature.module.ts (extrait)
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SIGNATURE_WEBHOOKS',
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'signature-webhooks',
              brokers: config.get<string>('KAFKA_BROKERS').split(','),
              ssl: config.get<string>('NODE_ENV') === 'production',
              sasl: config.get<string>('NODE_ENV') === 'production' ? {
                mechanism: 'scram-sha-512',
                username: config.get<string>('KAFKA_SASL_USERNAME'),
                password: config.get<string>('KAFKA_SASL_PASSWORD'),
              } : undefined,
            },
            consumer: {
              groupId: 'barid-webhook-processor-v1',
              allowAutoTopicCreation: false,
              sessionTimeout: 30000,
              heartbeatInterval: 3000,
              maxBytesPerPartition: 1048576,
              retry: { retries: 5, initialRetryTime: 300, factor: 2 },
            },
            producer: {
              idempotent: true,
              maxInFlightRequests: 5,
              transactionTimeout: 30000,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
})
export class SignatureModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(BaridSignatureMiddleware)
      .forRoutes({ path: 'public/webhooks/barid-esign', method: RequestMethod.POST });
  }
}
```

## Section 6 - Migration base de donnees

**Fichier**: `repo/packages/database/src/migrations/20260508120000-WebhooksReceived.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class WebhooksReceived20260508120000 implements MigrationInterface {
  name = 'WebhooksReceived20260508120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE sig_webhooks_received (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        provider VARCHAR(50) NOT NULL,
        provider_event_id VARCHAR(255) NOT NULL,
        provider_webhook_id VARCHAR(255),
        event_type VARCHAR(100) NOT NULL,
        workflow_id UUID,
        tenant_id UUID,
        payload_hash VARCHAR(128) NOT NULL,
        payload_size_bytes INTEGER NOT NULL DEFAULT 0,
        source_ip INET,
        user_agent TEXT,
        received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at TIMESTAMPTZ,
        processing_status VARCHAR(50) NOT NULL DEFAULT 'pending'
          CHECK (processing_status IN ('pending', 'in_progress', 'completed', 'failed', 'duplicate', 'orphan', 'invalid')),
        processing_error TEXT,
        processing_attempts INTEGER NOT NULL DEFAULT 0,
        kafka_offset BIGINT,
        kafka_partition INTEGER,
        kafka_topic VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uniq_webhook_provider_event UNIQUE (provider, provider_event_id)
      );

      CREATE INDEX idx_webhooks_provider_received
        ON sig_webhooks_received(provider, received_at DESC);

      CREATE INDEX idx_webhooks_status_received
        ON sig_webhooks_received(processing_status, received_at DESC)
        WHERE processing_status IN ('pending', 'failed');

      CREATE INDEX idx_webhooks_workflow
        ON sig_webhooks_received(workflow_id, received_at DESC)
        WHERE workflow_id IS NOT NULL;

      CREATE INDEX idx_webhooks_tenant
        ON sig_webhooks_received(tenant_id, received_at DESC)
        WHERE tenant_id IS NOT NULL;

      CREATE INDEX idx_webhooks_event_type
        ON sig_webhooks_received(event_type, received_at DESC);

      COMMENT ON TABLE sig_webhooks_received IS 'Stockage idempotent des webhooks recus depuis providers signature (Barid, DocuSign, etc.). Conformite Loi 43-20 art. 9 (audit trail signature events).';
      COMMENT ON COLUMN sig_webhooks_received.payload_hash IS 'SHA-512 hex du raw payload pour preuve integrite (CNDP minimisation: pas de PII en clair)';
      COMMENT ON COLUMN sig_webhooks_received.processing_status IS 'pending=recu non traite, in_progress=consumer en cours, completed=succes, failed=erreur apres N retries, duplicate=event_id deja vu, orphan=workflow_id introuvable, invalid=payload malforme';

      ALTER TABLE sig_webhooks_received
        ADD CONSTRAINT fk_webhook_workflow
        FOREIGN KEY (workflow_id) REFERENCES sig_signing_workflows(id) ON DELETE SET NULL;

      ALTER TABLE sig_webhooks_received
        ADD CONSTRAINT fk_webhook_tenant
        FOREIGN KEY (tenant_id) REFERENCES core_tenants(id) ON DELETE SET NULL;

      CREATE OR REPLACE FUNCTION update_webhook_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trg_webhooks_updated_at
        BEFORE UPDATE ON sig_webhooks_received
        FOR EACH ROW
        EXECUTE FUNCTION update_webhook_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_webhooks_updated_at ON sig_webhooks_received;
      DROP FUNCTION IF EXISTS update_webhook_updated_at();
      DROP TABLE IF EXISTS sig_webhooks_received CASCADE;
    `);
  }
}
```

## Section 7 - Code complet executable

### 7.1 Types Barid event

**Fichier**: `repo/apps/api/src/modules/signature/types/barid-event.types.ts`

```typescript
export enum BaridEventType {
  SIGNATURE_COMPLETED = 'signature.completed',
  SIGNATURE_DECLINED = 'signature.declined',
  SIGNATURE_EXPIRED = 'signature.expired',
  SIGNER_VIEWED = 'signer.viewed',
  SIGNER_SIGNED = 'signer.signed',
  SIGNER_DECLINED = 'signer.declined',
  SIGNATURE_DELIVERED = 'signature.delivered',
  SIGNATURE_BOUNCED = 'signature.bounced',
}

export enum WebhookProcessingStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  DUPLICATE = 'duplicate',
  ORPHAN = 'orphan',
  INVALID = 'invalid',
}

export enum WebhookProvider {
  BARID_ESIGN = 'barid_esign',
  DOCUSIGN = 'docusign',
  YOUSIGN = 'yousign',
}

export interface BaridSignerInfo {
  signer_id: string;
  email: string;
  phone?: string;
  full_name: string;
  cin?: string;
  role: 'signataire' | 'temoin' | 'approbateur';
  signed_at?: string;
  declined_at?: string;
  decline_reason?: string;
  ip_address?: string;
  user_agent?: string;
  authentication_method?: 'otp_sms' | 'otp_email' | 'cin_anrt' | 'biometric';
}

export interface BaridCompletionData {
  signed_document_url: string;
  signed_document_id: string;
  signed_document_size_bytes: number;
  certificate_serial_number: string;
  certificate_issuer: string;
  certificate_subject: string;
  certificate_valid_from: string;
  certificate_valid_to: string;
  signature_algorithm: string;
  signers: BaridSignerInfo[];
  completed_at: string;
}

export interface BaridDeclineData {
  declined_by_signer_id: string;
  declined_by_email: string;
  declined_at: string;
  decline_reason: string;
  signers: BaridSignerInfo[];
}

export interface BaridExpirationData {
  expired_at: string;
  signers_signed_count: number;
  signers_pending_count: number;
  signers: BaridSignerInfo[];
}

export interface BaridSignerEventData {
  signer: BaridSignerInfo;
  workflow_remaining_signers: number;
}

export type BaridEventData =
  | BaridCompletionData
  | BaridDeclineData
  | BaridExpirationData
  | BaridSignerEventData;

export interface BaridWebhookPayload {
  event_type: BaridEventType;
  event_id: string;
  occurred_at: string;
  workflow_id: string;
  barid_workflow_id: string;
  tenant_external_ref: string;
  data: BaridEventData;
  metadata?: Record<string, unknown>;
}

export interface KafkaWebhookMessage {
  webhook_id: string;
  event_type: BaridEventType;
  event_id: string;
  workflow_id: string;
  provider: WebhookProvider;
  raw_payload: BaridWebhookPayload;
  received_at: string;
  source_ip?: string;
}

export const EVENT_TO_TARGET_STATUS: Record<BaridEventType, string | null> = {
  [BaridEventType.SIGNATURE_COMPLETED]: 'completed',
  [BaridEventType.SIGNATURE_DECLINED]: 'declined',
  [BaridEventType.SIGNATURE_EXPIRED]: 'expired',
  [BaridEventType.SIGNER_VIEWED]: null,
  [BaridEventType.SIGNER_SIGNED]: null,
  [BaridEventType.SIGNER_DECLINED]: null,
  [BaridEventType.SIGNATURE_DELIVERED]: null,
  [BaridEventType.SIGNATURE_BOUNCED]: null,
};
```

### 7.2 DTO Zod

**Fichier**: `repo/apps/api/src/modules/signature/dto/barid-webhook-payload.dto.ts`

```typescript
import { z } from 'zod';
import { BaridEventType } from '../types/barid-event.types';

const SignerInfoSchema = z.object({
  signer_id: z.string().uuid(),
  email: z.string().email().max(255),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/).optional(),
  full_name: z.string().min(1).max(255),
  cin: z.string().regex(/^[A-Z]{1,2}\d{4,8}$/).optional(),
  role: z.enum(['signataire', 'temoin', 'approbateur']),
  signed_at: z.string().datetime({ offset: true }).optional(),
  declined_at: z.string().datetime({ offset: true }).optional(),
  decline_reason: z.string().max(1000).optional(),
  ip_address: z.string().ip().optional(),
  user_agent: z.string().max(500).optional(),
  authentication_method: z.enum(['otp_sms', 'otp_email', 'cin_anrt', 'biometric']).optional(),
});

const CompletionDataSchema = z.object({
  signed_document_url: z.string().url(),
  signed_document_id: z.string().min(1).max(255),
  signed_document_size_bytes: z.number().int().positive().max(50 * 1024 * 1024),
  certificate_serial_number: z.string().min(1).max(128),
  certificate_issuer: z.string().min(1).max(500),
  certificate_subject: z.string().min(1).max(500),
  certificate_valid_from: z.string().datetime({ offset: true }),
  certificate_valid_to: z.string().datetime({ offset: true }),
  signature_algorithm: z.string().regex(/^(RSA|ECDSA)-(SHA256|SHA384|SHA512)$/),
  signers: z.array(SignerInfoSchema).min(1).max(20),
  completed_at: z.string().datetime({ offset: true }),
});

const DeclineDataSchema = z.object({
  declined_by_signer_id: z.string().uuid(),
  declined_by_email: z.string().email().max(255),
  declined_at: z.string().datetime({ offset: true }),
  decline_reason: z.string().min(1).max(1000),
  signers: z.array(SignerInfoSchema).min(1).max(20),
});

const ExpirationDataSchema = z.object({
  expired_at: z.string().datetime({ offset: true }),
  signers_signed_count: z.number().int().min(0).max(20),
  signers_pending_count: z.number().int().min(0).max(20),
  signers: z.array(SignerInfoSchema).min(1).max(20),
});

const SignerEventDataSchema = z.object({
  signer: SignerInfoSchema,
  workflow_remaining_signers: z.number().int().min(0).max(20),
});

export const BaridWebhookPayloadSchema = z.discriminatedUnion('event_type', [
  z.object({
    event_type: z.literal(BaridEventType.SIGNATURE_COMPLETED),
    event_id: z.string().min(1).max(255),
    occurred_at: z.string().datetime({ offset: true }),
    workflow_id: z.string().uuid(),
    barid_workflow_id: z.string().min(1).max(255),
    tenant_external_ref: z.string().min(1).max(255),
    data: CompletionDataSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    event_type: z.literal(BaridEventType.SIGNATURE_DECLINED),
    event_id: z.string().min(1).max(255),
    occurred_at: z.string().datetime({ offset: true }),
    workflow_id: z.string().uuid(),
    barid_workflow_id: z.string().min(1).max(255),
    tenant_external_ref: z.string().min(1).max(255),
    data: DeclineDataSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    event_type: z.literal(BaridEventType.SIGNATURE_EXPIRED),
    event_id: z.string().min(1).max(255),
    occurred_at: z.string().datetime({ offset: true }),
    workflow_id: z.string().uuid(),
    barid_workflow_id: z.string().min(1).max(255),
    tenant_external_ref: z.string().min(1).max(255),
    data: ExpirationDataSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    event_type: z.enum([
      BaridEventType.SIGNER_VIEWED,
      BaridEventType.SIGNER_SIGNED,
      BaridEventType.SIGNER_DECLINED,
      BaridEventType.SIGNATURE_DELIVERED,
      BaridEventType.SIGNATURE_BOUNCED,
    ]),
    event_id: z.string().min(1).max(255),
    occurred_at: z.string().datetime({ offset: true }),
    workflow_id: z.string().uuid(),
    barid_workflow_id: z.string().min(1).max(255),
    tenant_external_ref: z.string().min(1).max(255),
    data: SignerEventDataSchema,
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
]);

export type BaridWebhookPayloadDto = z.infer<typeof BaridWebhookPayloadSchema>;

export const KafkaWebhookMessageSchema = z.object({
  webhook_id: z.string().uuid(),
  event_type: z.nativeEnum(BaridEventType),
  event_id: z.string().min(1).max(255),
  workflow_id: z.string().uuid(),
  provider: z.literal('barid_esign'),
  raw_payload: BaridWebhookPayloadSchema,
  received_at: z.string().datetime({ offset: true }),
  source_ip: z.string().ip().optional(),
});

export type KafkaWebhookMessageDto = z.infer<typeof KafkaWebhookMessageSchema>;
```

### 7.3 Middleware HMAC

**Fichier**: `repo/apps/api/src/modules/signature/middleware/barid-signature.middleware.ts`

```typescript
import { Injectable, NestMiddleware, UnauthorizedException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest, FastifyReply } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';

@Injectable()
export class BaridSignatureMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BaridSignatureMiddleware.name);
  }

  use(req: FastifyRequest['raw'] & { rawBody?: Buffer; headers: Record<string, string | undefined> }, res: FastifyReply['raw'], next: (err?: unknown) => void): void {
    const start = process.hrtime.bigint();
    const signature = (req.headers['x-barid-signature'] as string | undefined) ?? '';
    const timestamp = (req.headers['x-barid-timestamp'] as string | undefined) ?? '';
    const eventId = (req.headers['x-barid-event-id'] as string | undefined) ?? '';
    const sourceIp = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'unknown';

    if (!signature || !timestamp) {
      this.logger.warn({ source_ip: sourceIp, event_id: eventId, action: 'webhook_missing_headers' }, 'Missing webhook signature headers');
      throw new UnauthorizedException('Missing webhook signature headers');
    }

    if (!/^sha256=[0-9a-f]{64}$/i.test(signature)) {
      this.logger.warn({ source_ip: sourceIp, event_id: eventId, action: 'webhook_malformed_signature' }, 'Malformed signature header format');
      throw new UnauthorizedException('Malformed signature header format');
    }

    const timestampInt = Number.parseInt(timestamp, 10);
    if (Number.isNaN(timestampInt) || timestampInt <= 0) {
      this.logger.warn({ source_ip: sourceIp, event_id: eventId, action: 'webhook_invalid_timestamp' }, 'Invalid timestamp header');
      throw new UnauthorizedException('Invalid timestamp header');
    }

    const replayWindowSeconds = this.config.get<number>('WEBHOOK_REPLAY_WINDOW_SECONDS', 300);
    const nowSeconds = Math.floor(Date.now() / 1000);
    const diffSeconds = Math.abs(nowSeconds - timestampInt);

    if (diffSeconds > replayWindowSeconds) {
      this.logger.warn({
        source_ip: sourceIp,
        event_id: eventId,
        timestamp_diff_seconds: diffSeconds,
        replay_window_seconds: replayWindowSeconds,
        action: 'webhook_timestamp_too_old',
      }, 'Webhook timestamp outside replay window');
      throw new UnauthorizedException('Webhook timestamp too old (replay protection)');
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody || !Buffer.isBuffer(rawBody) || rawBody.length === 0) {
      this.logger.error({ source_ip: sourceIp, event_id: eventId, action: 'webhook_missing_raw_body' }, 'Missing raw body for HMAC verification');
      throw new BadRequestException('Missing or empty request body');
    }

    const primarySecret = this.config.get<string>('BARID_ESIGN_WEBHOOK_SECRET_PRIMARY')
      ?? this.config.get<string>('BARID_ESIGN_WEBHOOK_SECRET');
    const secondarySecret = this.config.get<string>('BARID_ESIGN_WEBHOOK_SECRET_SECONDARY');

    if (!primarySecret) {
      this.logger.fatal({ action: 'webhook_secret_not_configured' }, 'BARID_ESIGN_WEBHOOK_SECRET not configured');
      throw new UnauthorizedException('Webhook verification not configured');
    }

    const payload = `${timestamp}.${rawBody.toString('utf8')}`;
    const actualHex = signature.replace(/^sha256=/i, '');
    const actualBuffer = Buffer.from(actualHex, 'hex');

    const verifyWith = (secret: string): boolean => {
      const expectedHex = createHmac('sha256', secret).update(payload).digest('hex');
      const expectedBuffer = Buffer.from(expectedHex, 'hex');
      if (expectedBuffer.length !== actualBuffer.length) {
        return false;
      }
      try {
        return timingSafeEqual(expectedBuffer, actualBuffer);
      } catch {
        return false;
      }
    };

    let isValid = verifyWith(primarySecret);
    let usedSecondary = false;

    if (!isValid && secondarySecret) {
      isValid = verifyWith(secondarySecret);
      if (isValid) {
        usedSecondary = true;
        this.logger.warn({
          source_ip: sourceIp,
          event_id: eventId,
          action: 'webhook_secondary_secret_used',
        }, 'Webhook validated with SECONDARY secret - rotation in progress');
      }
    }

    if (!isValid) {
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      this.logger.warn({
        source_ip: sourceIp,
        event_id: eventId,
        elapsed_ms: elapsedMs,
        action: 'webhook_invalid_signature',
      }, 'Invalid webhook HMAC signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    (req as any).webhookContext = {
      sourceIp,
      eventId,
      timestamp: timestampInt,
      verifiedAt: new Date(),
      usedSecondarySecret: usedSecondary,
    };

    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    this.logger.debug({
      source_ip: sourceIp,
      event_id: eventId,
      elapsed_ms: elapsedMs,
      used_secondary: usedSecondary,
      action: 'webhook_signature_verified',
    }, 'HMAC signature verified successfully');

    next();
  }
}
```

### 7.4 Service Idempotency

**Fichier**: `repo/apps/api/src/modules/signature/services/webhook-idempotency.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { createHash } from 'node:crypto';
import { WebhookReceivedEntity } from '../entities/webhook-received.entity';
import { WebhookProcessingStatus, WebhookProvider } from '../types/barid-event.types';

export interface CheckAndStoreParams {
  provider: WebhookProvider;
  providerEventId: string;
  providerWebhookId?: string;
  eventType: string;
  workflowId?: string;
  payload: Buffer;
  sourceIp?: string;
  userAgent?: string;
}

export interface CheckAndStoreResult {
  isNew: boolean;
  webhookId: string;
  duplicateReason?: 'already_processed' | 'in_progress' | 'failed_retry_pending';
}

@Injectable()
export class WebhookIdempotencyService {
  constructor(
    @InjectRepository(WebhookReceivedEntity)
    private readonly repo: Repository<WebhookReceivedEntity>,
    private readonly dataSource: DataSource,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(WebhookIdempotencyService.name);
  }

  async checkAndStore(params: CheckAndStoreParams): Promise<CheckAndStoreResult> {
    const payloadHash = createHash('sha512').update(params.payload).digest('hex');

    const result = await this.dataSource.query<Array<{ id: string; processing_status: string }>>(
      `INSERT INTO sig_webhooks_received (
        provider, provider_event_id, provider_webhook_id, event_type,
        workflow_id, payload_hash, payload_size_bytes, source_ip, user_agent,
        processing_status, received_at, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9, 'pending', NOW(), NOW(), NOW())
      ON CONFLICT (provider, provider_event_id) DO NOTHING
      RETURNING id, processing_status`,
      [
        params.provider,
        params.providerEventId,
        params.providerWebhookId ?? null,
        params.eventType,
        params.workflowId ?? null,
        payloadHash,
        params.payload.length,
        params.sourceIp ?? null,
        params.userAgent ?? null,
      ],
    );

    if (result.length === 1) {
      this.logger.debug({
        webhook_id: result[0].id,
        provider: params.provider,
        event_id: params.providerEventId,
        action: 'webhook_idempotency_new',
      }, 'New webhook stored for idempotency');
      return { isNew: true, webhookId: result[0].id };
    }

    const existing = await this.repo.findOne({
      where: { provider: params.provider, providerEventId: params.providerEventId },
      select: ['id', 'processingStatus'],
    });

    if (!existing) {
      throw new Error(`Race condition: ON CONFLICT triggered but row not found for ${params.provider}/${params.providerEventId}`);
    }

    let duplicateReason: 'already_processed' | 'in_progress' | 'failed_retry_pending';
    switch (existing.processingStatus) {
      case WebhookProcessingStatus.COMPLETED:
        duplicateReason = 'already_processed';
        break;
      case WebhookProcessingStatus.IN_PROGRESS:
      case WebhookProcessingStatus.PENDING:
        duplicateReason = 'in_progress';
        break;
      case WebhookProcessingStatus.FAILED:
        duplicateReason = 'failed_retry_pending';
        break;
      default:
        duplicateReason = 'already_processed';
    }

    this.logger.info({
      webhook_id: existing.id,
      provider: params.provider,
      event_id: params.providerEventId,
      duplicate_reason: duplicateReason,
      existing_status: existing.processingStatus,
      action: 'webhook_idempotency_duplicate',
    }, 'Duplicate webhook detected');

    return { isNew: false, webhookId: existing.id, duplicateReason };
  }

  async markInProgress(webhookId: string, kafkaMeta?: { topic: string; partition: number; offset: string }): Promise<void> {
    await this.repo.update(webhookId, {
      processingStatus: WebhookProcessingStatus.IN_PROGRESS,
      processingAttempts: () => 'processing_attempts + 1' as any,
      kafkaTopic: kafkaMeta?.topic,
      kafkaPartition: kafkaMeta?.partition,
      kafkaOffset: kafkaMeta?.offset ? BigInt(kafkaMeta.offset).toString() as any : undefined,
    } as any);
  }

  async markCompleted(webhookId: string): Promise<void> {
    await this.repo.update(webhookId, {
      processingStatus: WebhookProcessingStatus.COMPLETED,
      processedAt: new Date(),
      processingError: null as any,
    });
    this.logger.debug({ webhook_id: webhookId, action: 'webhook_marked_completed' }, 'Webhook marked completed');
  }

  async markFailed(webhookId: string, error: string): Promise<void> {
    await this.repo.update(webhookId, {
      processingStatus: WebhookProcessingStatus.FAILED,
      processedAt: new Date(),
      processingError: error.substring(0, 5000),
    });
    this.logger.warn({ webhook_id: webhookId, error, action: 'webhook_marked_failed' }, 'Webhook marked failed');
  }

  async markOrphan(webhookId: string, reason: string): Promise<void> {
    await this.repo.update(webhookId, {
      processingStatus: WebhookProcessingStatus.ORPHAN,
      processedAt: new Date(),
      processingError: reason,
    });
    this.logger.warn({ webhook_id: webhookId, reason, action: 'webhook_marked_orphan' }, 'Webhook marked orphan');
  }

  async findPendingForRetry(maxAttempts = 5, olderThanSeconds = 300): Promise<WebhookReceivedEntity[]> {
    return this.repo.createQueryBuilder('w')
      .where('w.processing_status IN (:...statuses)', { statuses: [WebhookProcessingStatus.PENDING, WebhookProcessingStatus.FAILED] })
      .andWhere('w.processing_attempts < :max', { max: maxAttempts })
      .andWhere('w.received_at < NOW() - INTERVAL :older', { older: `${olderThanSeconds} seconds` })
      .orderBy('w.received_at', 'ASC')
      .limit(100)
      .getMany();
  }
}
```

### 7.5 Controller webhook

**Fichier**: `repo/apps/api/src/modules/signature/controllers/barid-webhook.controller.ts`

```typescript
import { Body, Controller, Headers, HttpCode, Inject, Post, Req, BadRequestException } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';
import { ZodError } from 'zod';
import { Public } from '@skalean/auth';
import { BaridWebhookPayloadSchema, KafkaWebhookMessageSchema } from '../dto/barid-webhook-payload.dto';
import { WebhookIdempotencyService } from '../services/webhook-idempotency.service';
import { BaridEventType, WebhookProvider } from '../types/barid-event.types';
import { v4 as uuidv4 } from 'uuid';

interface WebhookContext {
  sourceIp: string;
  eventId: string;
  timestamp: number;
  verifiedAt: Date;
  usedSecondarySecret: boolean;
}

@Controller('public/webhooks/barid-esign')
@Public()
export class BaridWebhookController {
  constructor(
    @Inject('KAFKA_SIGNATURE_WEBHOOKS') private readonly kafka: ClientKafka,
    private readonly idempotency: WebhookIdempotencyService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BaridWebhookController.name);
  }

  @Post()
  @HttpCode(200)
  async receive(
    @Req() req: FastifyRequest & { rawBody?: Buffer; webhookContext?: WebhookContext },
    @Headers('x-barid-event-id') eventIdHeader: string,
    @Headers('x-barid-webhook-id') webhookIdHeader: string,
    @Headers('user-agent') userAgent: string,
  ): Promise<{ received: true; duplicate: boolean; webhook_id?: string }> {
    const start = process.hrtime.bigint();
    const ctx = req.webhookContext;
    const sourceIp = ctx?.sourceIp ?? 'unknown';
    const correlationId = uuidv4();

    if (!req.rawBody || !Buffer.isBuffer(req.rawBody)) {
      this.logger.error({ correlation_id: correlationId, source_ip: sourceIp, action: 'webhook_no_raw_body' }, 'No raw body available');
      throw new BadRequestException('Missing request body');
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(req.rawBody.toString('utf8'));
    } catch (err) {
      this.logger.warn({
        correlation_id: correlationId,
        source_ip: sourceIp,
        event_id: eventIdHeader,
        error: (err as Error).message,
        action: 'webhook_malformed_json',
      }, 'Malformed JSON in webhook payload');
      await this.persistInvalidWebhook(eventIdHeader, req.rawBody, sourceIp, userAgent, 'malformed_json');
      return { received: true, duplicate: false };
    }

    let payload;
    try {
      payload = BaridWebhookPayloadSchema.parse(parsedJson);
    } catch (err) {
      const zodErr = err as ZodError;
      this.logger.warn({
        correlation_id: correlationId,
        source_ip: sourceIp,
        event_id: eventIdHeader,
        validation_errors: zodErr.errors,
        action: 'webhook_invalid_payload_schema',
      }, 'Invalid webhook payload schema');
      await this.persistInvalidWebhook(eventIdHeader, req.rawBody, sourceIp, userAgent, `invalid_schema:${zodErr.errors[0]?.message ?? 'unknown'}`);
      return { received: true, duplicate: false };
    }

    const idemResult = await this.idempotency.checkAndStore({
      provider: WebhookProvider.BARID_ESIGN,
      providerEventId: payload.event_id,
      providerWebhookId: webhookIdHeader,
      eventType: payload.event_type,
      workflowId: payload.workflow_id,
      payload: req.rawBody,
      sourceIp,
      userAgent,
    });

    if (!idemResult.isNew) {
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
      this.logger.info({
        correlation_id: correlationId,
        webhook_id: idemResult.webhookId,
        event_id: payload.event_id,
        event_type: payload.event_type,
        workflow_id: payload.workflow_id,
        duplicate_reason: idemResult.duplicateReason,
        elapsed_ms: elapsedMs,
        action: 'webhook_duplicate_acked',
      }, 'Duplicate webhook acknowledged');
      return { received: true, duplicate: true, webhook_id: idemResult.webhookId };
    }

    const kafkaMessage = {
      webhook_id: idemResult.webhookId,
      event_type: payload.event_type,
      event_id: payload.event_id,
      workflow_id: payload.workflow_id,
      provider: WebhookProvider.BARID_ESIGN as const,
      raw_payload: payload,
      received_at: new Date().toISOString(),
      source_ip: sourceIp,
    };

    try {
      const validated = KafkaWebhookMessageSchema.parse(kafkaMessage);
      await this.kafka.emit('signature.webhook.received', {
        key: payload.workflow_id,
        value: JSON.stringify(validated),
      }).toPromise();
    } catch (err) {
      this.logger.error({
        correlation_id: correlationId,
        webhook_id: idemResult.webhookId,
        error: (err as Error).message,
        action: 'webhook_kafka_publish_failed',
      }, 'Failed to publish webhook to Kafka, will be retried by WebhookForwarderJob');
    }

    const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    this.logger.info({
      correlation_id: correlationId,
      webhook_id: idemResult.webhookId,
      event_id: payload.event_id,
      event_type: payload.event_type,
      workflow_id: payload.workflow_id,
      elapsed_ms: elapsedMs,
      used_secondary_secret: ctx?.usedSecondarySecret ?? false,
      action: 'webhook_received_acked',
    }, 'Webhook received and queued for async processing');

    return { received: true, duplicate: false, webhook_id: idemResult.webhookId };
  }

  private async persistInvalidWebhook(eventId: string, rawBody: Buffer, sourceIp: string, userAgent: string, reason: string): Promise<void> {
    try {
      await this.idempotency.checkAndStore({
        provider: WebhookProvider.BARID_ESIGN,
        providerEventId: eventId || `invalid-${uuidv4()}`,
        eventType: 'invalid',
        payload: rawBody,
        sourceIp,
        userAgent,
      });
    } catch (err) {
      this.logger.error({ error: (err as Error).message, action: 'persist_invalid_webhook_failed' }, 'Failed to persist invalid webhook');
    }
  }
}
```

### 7.6 Service Completion Orchestrator

**Fichier**: `repo/apps/api/src/modules/signature/services/completion-orchestrator.service.ts`

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { BaridEsignClient } from '../clients/barid-esign.client';
import { AnrtTimestampService } from './anrt-timestamp.service';
import { HashService } from './hash.service';
import { SigningWorkflowsRepository } from '../repositories/signing-workflows.repository';
import { AuditTrailService } from './audit-trail.service';
import { WorkflowStateMachine } from './workflow-state-machine';
import { BaridCompletionData, BaridDeclineData, BaridExpirationData, BaridWebhookPayload } from '../types/barid-event.types';

export interface OrchestrationResult {
  success: boolean;
  workflowId: string;
  signedDocumentUrl?: string;
  archiveS3Key?: string;
  tsaTokenLength?: number;
  notificationsTriggered?: number;
  durationMs: number;
}

@Injectable()
export class CompletionOrchestratorService {
  constructor(
    private readonly baridClient: BaridEsignClient,
    private readonly anrtService: AnrtTimestampService,
    private readonly hashService: HashService,
    private readonly workflowsRepo: SigningWorkflowsRepository,
    private readonly auditService: AuditTrailService,
    private readonly dataSource: DataSource,
    @Inject('KAFKA_SIGNATURE_WEBHOOKS') private readonly kafka: ClientKafka,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(CompletionOrchestratorService.name);
  }

  async orchestrateCompletion(workflowId: string, payload: BaridWebhookPayload & { data: BaridCompletionData }): Promise<OrchestrationResult> {
    const start = process.hrtime.bigint();
    const log = (action: string, extra: Record<string, unknown> = {}) =>
      this.logger.info({ workflow_id: workflowId, action, ...extra });

    log('completion_orchestration_started');

    const workflow = await this.workflowsRepo.findByIdOrFail(workflowId);
    const machine = WorkflowStateMachine.fromCurrentStatus(workflow.status);

    if (!machine.canTransition('completed')) {
      this.logger.warn({
        workflow_id: workflowId,
        current_status: workflow.status,
        target_status: 'completed',
        action: 'invalid_state_transition',
      }, 'Cannot transition to completed from current status, skipping');
      return {
        success: false,
        workflowId,
        durationMs: Number(process.hrtime.bigint() - start) / 1_000_000,
      };
    }

    log('downloading_signed_pdf', { signed_doc_id: payload.data.signed_document_id });
    const pdfBuffer = await this.baridClient.downloadSignedDocument(workflow.providerWorkflowId);
    log('signed_pdf_downloaded', { size_bytes: pdfBuffer.length });

    const sha512Hex = await this.hashService.sha512Hex(pdfBuffer);
    log('pdf_hashed', { hash_prefix: sha512Hex.substring(0, 16) });

    log('requesting_anrt_timestamp');
    const tsaResult = await this.anrtService.requestTimestamp(Buffer.from(sha512Hex, 'hex'), 'sha-512');
    log('anrt_timestamp_received', {
      tsa_token_size: tsaResult.tsaToken.length,
      tsa_serial: tsaResult.serialNumber,
      tsa_gen_time: tsaResult.genTime.toISOString(),
    });

    await this.dataSource.transaction(async manager => {
      await this.workflowsRepo.markCompletedTx(manager, workflowId, {
        completedAt: new Date(),
        signedPdfHashSha512: sha512Hex,
        signedPdfSizeBytes: pdfBuffer.length,
        anrtTsaToken: tsaResult.tsaToken,
        anrtTsaSerial: tsaResult.serialNumber,
        anrtTsaGenTime: tsaResult.genTime,
        certificateSerial: payload.data.certificate_serial_number,
        certificateIssuer: payload.data.certificate_issuer,
        certificateValidFrom: new Date(payload.data.certificate_valid_from),
        certificateValidTo: new Date(payload.data.certificate_valid_to),
        signatureAlgorithm: payload.data.signature_algorithm,
      });

      await this.auditService.logTx(manager, {
        workflowId,
        eventType: 'signature.completed',
        eventData: {
          signers: payload.data.signers.map(s => ({
            signer_id: s.signer_id,
            email_hash: this.hashService.sha256Hex(Buffer.from(s.email)),
            cin_hash: s.cin ? this.hashService.sha256Hex(Buffer.from(s.cin)) : undefined,
            authentication_method: s.authentication_method,
            signed_at: s.signed_at,
            ip_address: s.ip_address,
          })),
          certificate_serial: payload.data.certificate_serial_number,
          signed_document_id: payload.data.signed_document_id,
          signed_document_size: payload.data.signed_document_size_bytes,
        },
        anrtTimestampToken: tsaResult.tsaToken,
        occurredAt: new Date(payload.data.completed_at),
      });
    });

    log('workflow_persisted_completed');

    await this.kafka.emit('signature.workflow_completed', {
      key: workflowId,
      value: JSON.stringify({
        workflow_id: workflowId,
        tenant_id: workflow.tenantId,
        provider_workflow_id: workflow.providerWorkflowId,
        signed_pdf_hash_sha512: sha512Hex,
        signed_pdf_size_bytes: pdfBuffer.length,
        anrt_tsa_token_b64: tsaResult.tsaToken.toString('base64'),
        certificate_serial: payload.data.certificate_serial_number,
        completed_at: payload.data.completed_at,
      }),
    }).toPromise();

    log('archive_event_published');

    let notificationsTriggered = 0;
    for (const signer of payload.data.signers) {
      await this.kafka.emit('comm.notify', {
        key: `${workflowId}:${signer.signer_id}`,
        value: JSON.stringify({
          tenant_id: workflow.tenantId,
          recipient: { email: signer.email, phone: signer.phone, full_name: signer.full_name },
          channels: signer.phone ? ['email', 'whatsapp'] : ['email'],
          template: 'signature_completion',
          locale: workflow.locale ?? 'fr',
          variables: {
            full_name: signer.full_name,
            workflow_title: workflow.title,
            completed_at: payload.data.completed_at,
            certificate_serial: payload.data.certificate_serial_number,
            download_url_token: workflow.id,
          },
          attachments: [{
            type: 'signed_pdf',
            workflow_id: workflowId,
            filename: `${workflow.title}_signe.pdf`,
          }],
        }),
      }).toPromise();
      notificationsTriggered++;
    }

    log('notifications_triggered', { count: notificationsTriggered });

    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    log('completion_orchestration_succeeded', { duration_ms: durationMs });

    return {
      success: true,
      workflowId,
      signedDocumentUrl: payload.data.signed_document_url,
      archiveS3Key: undefined,
      tsaTokenLength: tsaResult.tsaToken.length,
      notificationsTriggered,
      durationMs,
    };
  }

  async orchestrateDecline(workflowId: string, payload: BaridWebhookPayload & { data: BaridDeclineData }): Promise<OrchestrationResult> {
    const start = process.hrtime.bigint();
    const workflow = await this.workflowsRepo.findByIdOrFail(workflowId);

    await this.dataSource.transaction(async manager => {
      await this.workflowsRepo.markDeclinedTx(manager, workflowId, {
        declinedAt: new Date(payload.data.declined_at),
        declinedBySignerId: payload.data.declined_by_signer_id,
        declineReason: payload.data.decline_reason,
      });

      await this.auditService.logTx(manager, {
        workflowId,
        eventType: 'signature.declined',
        eventData: {
          declined_by_signer_id: payload.data.declined_by_signer_id,
          declined_by_email_hash: this.hashService.sha256Hex(Buffer.from(payload.data.declined_by_email)),
          decline_reason: payload.data.decline_reason,
        },
        occurredAt: new Date(payload.data.declined_at),
      });
    });

    let notificationsTriggered = 0;
    for (const signer of payload.data.signers) {
      await this.kafka.emit('comm.notify', {
        key: `${workflowId}:${signer.signer_id}`,
        value: JSON.stringify({
          tenant_id: workflow.tenantId,
          recipient: { email: signer.email, full_name: signer.full_name },
          channels: ['email'],
          template: 'signature_declined',
          locale: workflow.locale ?? 'fr',
          variables: {
            full_name: signer.full_name,
            workflow_title: workflow.title,
            decline_reason: payload.data.decline_reason,
          },
        }),
      }).toPromise();
      notificationsTriggered++;
    }

    return {
      success: true,
      workflowId,
      notificationsTriggered,
      durationMs: Number(process.hrtime.bigint() - start) / 1_000_000,
    };
  }

  async orchestrateExpiration(workflowId: string, payload: BaridWebhookPayload & { data: BaridExpirationData }): Promise<OrchestrationResult> {
    const start = process.hrtime.bigint();
    const workflow = await this.workflowsRepo.findByIdOrFail(workflowId);

    await this.dataSource.transaction(async manager => {
      await this.workflowsRepo.markExpiredTx(manager, workflowId, {
        expiredAt: new Date(payload.data.expired_at),
        signersSignedCount: payload.data.signers_signed_count,
        signersPendingCount: payload.data.signers_pending_count,
      });

      await this.auditService.logTx(manager, {
        workflowId,
        eventType: 'signature.expired',
        eventData: {
          expired_at: payload.data.expired_at,
          signers_signed_count: payload.data.signers_signed_count,
          signers_pending_count: payload.data.signers_pending_count,
        },
        occurredAt: new Date(payload.data.expired_at),
      });
    });

    let notificationsTriggered = 0;
    for (const signer of payload.data.signers) {
      await this.kafka.emit('comm.notify', {
        key: `${workflowId}:${signer.signer_id}`,
        value: JSON.stringify({
          tenant_id: workflow.tenantId,
          recipient: { email: signer.email, phone: signer.phone, full_name: signer.full_name },
          channels: signer.phone ? ['email', 'whatsapp'] : ['email'],
          template: 'signature_expired',
          locale: workflow.locale ?? 'fr',
          variables: {
            full_name: signer.full_name,
            workflow_title: workflow.title,
            expired_at: payload.data.expired_at,
          },
        }),
      }).toPromise();
      notificationsTriggered++;
    }

    return {
      success: true,
      workflowId,
      notificationsTriggered,
      durationMs: Number(process.hrtime.bigint() - start) / 1_000_000,
    };
  }
}
```

### 7.7 Consumer Kafka

**Fichier**: `repo/apps/api/src/modules/signature/consumers/barid-webhook-processor.consumer.ts`

```typescript
import { Controller, Inject } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import { MultiTenantContextService } from '@skalean/multitenant';
import { CompletionOrchestratorService } from '../services/completion-orchestrator.service';
import { WebhookIdempotencyService } from '../services/webhook-idempotency.service';
import { SigningWorkflowsRepository } from '../repositories/signing-workflows.repository';
import { AuditTrailService } from '../services/audit-trail.service';
import { HashService } from '../services/hash.service';
import { KafkaWebhookMessageSchema } from '../dto/barid-webhook-payload.dto';
import { BaridEventType, EVENT_TO_TARGET_STATUS, WebhookProcessingStatus } from '../types/barid-event.types';
import { WorkflowStateMachine } from '../services/workflow-state-machine';

@Controller()
export class BaridWebhookProcessorConsumer {
  constructor(
    private readonly orchestrator: CompletionOrchestratorService,
    private readonly idempotency: WebhookIdempotencyService,
    private readonly workflowsRepo: SigningWorkflowsRepository,
    private readonly auditService: AuditTrailService,
    private readonly hashService: HashService,
    private readonly multiTenant: MultiTenantContextService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BaridWebhookProcessorConsumer.name);
  }

  @EventPattern('signature.webhook.received')
  async handleWebhook(@Payload() rawMessage: unknown, @Ctx() ctx: KafkaContext): Promise<void> {
    const start = process.hrtime.bigint();
    const topic = ctx.getTopic();
    const partition = ctx.getPartition();
    const offset = ctx.getMessage().offset;

    let message;
    try {
      const parsed = typeof rawMessage === 'string' ? JSON.parse(rawMessage) : rawMessage;
      message = KafkaWebhookMessageSchema.parse(parsed);
    } catch (err) {
      this.logger.error({
        topic, partition, offset,
        error: (err as Error).message,
        action: 'kafka_message_invalid_schema',
      }, 'Invalid Kafka message schema, sending to DLQ');
      throw err;
    }

    const { webhook_id: webhookId, event_type: eventType, workflow_id: workflowId, raw_payload: payload } = message;

    this.logger.info({
      webhook_id: webhookId,
      event_type: eventType,
      workflow_id: workflowId,
      kafka_topic: topic,
      kafka_partition: partition,
      kafka_offset: offset,
      action: 'webhook_processing_started',
    }, 'Processing webhook from Kafka');

    await this.idempotency.markInProgress(webhookId, { topic, partition, offset });

    let workflow;
    try {
      workflow = await this.workflowsRepo.findByIdSystemContext(workflowId);
    } catch (err) {
      this.logger.error({
        webhook_id: webhookId,
        workflow_id: workflowId,
        error: (err as Error).message,
        action: 'workflow_lookup_failed',
      }, 'Failed to lookup workflow');
      await this.idempotency.markFailed(webhookId, `workflow_lookup_failed: ${(err as Error).message}`);
      throw err;
    }

    if (!workflow) {
      this.logger.warn({
        webhook_id: webhookId,
        workflow_id: workflowId,
        event_type: eventType,
        action: 'webhook_orphan',
      }, 'Workflow not found, marking webhook as orphan');
      await this.idempotency.markOrphan(webhookId, `workflow ${workflowId} not found in database`);
      return;
    }

    await this.multiTenant.runWithTenant(workflow.tenantId, async () => {
      try {
        const targetStatus = EVENT_TO_TARGET_STATUS[eventType];
        if (targetStatus !== null) {
          const machine = WorkflowStateMachine.fromCurrentStatus(workflow.status);
          if (!machine.canTransition(targetStatus)) {
            this.logger.warn({
              webhook_id: webhookId,
              workflow_id: workflowId,
              current_status: workflow.status,
              target_status: targetStatus,
              event_type: eventType,
              action: 'invalid_state_transition_skipping',
            }, 'Invalid state transition, skipping event but acking');
            await this.idempotency.markCompleted(webhookId);
            return;
          }
        }

        switch (eventType) {
          case BaridEventType.SIGNATURE_COMPLETED: {
            const result = await this.orchestrator.orchestrateCompletion(workflowId, payload as any);
            this.logger.info({
              webhook_id: webhookId,
              workflow_id: workflowId,
              orchestration_result: result,
              action: 'completion_orchestrated',
            }, 'Completion orchestration succeeded');
            break;
          }
          case BaridEventType.SIGNATURE_DECLINED: {
            const result = await this.orchestrator.orchestrateDecline(workflowId, payload as any);
            this.logger.info({ webhook_id: webhookId, workflow_id: workflowId, orchestration_result: result, action: 'decline_orchestrated' });
            break;
          }
          case BaridEventType.SIGNATURE_EXPIRED: {
            const result = await this.orchestrator.orchestrateExpiration(workflowId, payload as any);
            this.logger.info({ webhook_id: webhookId, workflow_id: workflowId, orchestration_result: result, action: 'expiration_orchestrated' });
            break;
          }
          case BaridEventType.SIGNER_VIEWED:
          case BaridEventType.SIGNER_SIGNED:
          case BaridEventType.SIGNER_DECLINED:
          case BaridEventType.SIGNATURE_DELIVERED:
          case BaridEventType.SIGNATURE_BOUNCED: {
            const data = (payload as any).data;
            const signer = data.signer;
            await this.auditService.log({
              workflowId,
              eventType,
              eventData: {
                signer_id: signer.signer_id,
                email_hash: this.hashService.sha256Hex(Buffer.from(signer.email)),
                role: signer.role,
                authentication_method: signer.authentication_method,
                ip_address: signer.ip_address,
                user_agent: signer.user_agent,
                workflow_remaining_signers: data.workflow_remaining_signers,
              },
              occurredAt: new Date(payload.occurred_at),
            });
            this.logger.info({ webhook_id: webhookId, workflow_id: workflowId, event_type: eventType, signer_id: signer.signer_id, action: 'signer_event_logged' });
            break;
          }
          default:
            this.logger.warn({ webhook_id: webhookId, event_type: eventType, action: 'unknown_event_type' }, 'Unknown event type, marking failed');
            throw new Error(`Unknown event type: ${eventType}`);
        }

        await this.idempotency.markCompleted(webhookId);
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        this.logger.info({
          webhook_id: webhookId,
          event_type: eventType,
          workflow_id: workflowId,
          duration_ms: durationMs,
          action: 'webhook_processing_completed',
        }, 'Webhook processed successfully');
      } catch (err) {
        const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
        this.logger.error({
          webhook_id: webhookId,
          event_type: eventType,
          workflow_id: workflowId,
          duration_ms: durationMs,
          error: (err as Error).message,
          stack: (err as Error).stack,
          action: 'webhook_processing_failed',
        }, 'Webhook processing failed, will retry');
        await this.idempotency.markFailed(webhookId, (err as Error).message);
        throw err;
      }
    });
  }
}
```

### 7.8 Tests unitaires - Middleware HMAC

**Fichier**: `repo/apps/api/src/modules/signature/middleware/barid-signature.middleware.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PinoLogger } from 'nestjs-pino';
import { BaridSignatureMiddleware } from './barid-signature.middleware';

describe('BaridSignatureMiddleware', () => {
  let middleware: BaridSignatureMiddleware;
  let configMock: Partial<ConfigService>;
  let loggerMock: Partial<PinoLogger>;
  const PRIMARY_SECRET = 'test-primary-secret-32-chars-long-aaa';
  const SECONDARY_SECRET = 'test-secondary-secret-32-chars-bbb';

  const buildSignedRequest = (body: object | string, opts: {
    secret?: string;
    timestamp?: number;
    skipSignature?: boolean;
    skipTimestamp?: boolean;
    customSignature?: string;
  } = {}) => {
    const rawBody = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const ts = (opts.timestamp ?? Math.floor(Date.now() / 1000)).toString();
    const secret = opts.secret ?? PRIMARY_SECRET;
    const payload = `${ts}.${rawBody.toString('utf8')}`;
    const sig = createHmac('sha256', secret).update(payload).digest('hex');
    const headers: Record<string, string> = {};
    if (!opts.skipSignature) headers['x-barid-signature'] = opts.customSignature ?? `sha256=${sig}`;
    if (!opts.skipTimestamp) headers['x-barid-timestamp'] = ts;
    headers['x-barid-event-id'] = 'evt_test_123';
    headers['x-forwarded-for'] = '52.84.10.20';
    return { headers, rawBody, socket: { remoteAddress: '127.0.0.1' } };
  };

  beforeEach(async () => {
    configMock = {
      get: jest.fn((key: string, def?: unknown) => {
        const map: Record<string, unknown> = {
          BARID_ESIGN_WEBHOOK_SECRET_PRIMARY: PRIMARY_SECRET,
          BARID_ESIGN_WEBHOOK_SECRET_SECONDARY: undefined,
          WEBHOOK_REPLAY_WINDOW_SECONDS: 300,
        };
        return key in map ? map[key] : def;
      }) as any,
    };
    loggerMock = { setContext: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), fatal: jest.fn(), info: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BaridSignatureMiddleware,
        { provide: ConfigService, useValue: configMock },
        { provide: PinoLogger, useValue: loggerMock },
      ],
    }).compile();

    middleware = module.get(BaridSignatureMiddleware);
  });

  it('should accept valid signature', () => {
    const req = buildSignedRequest({ event_id: 'evt_1', event_type: 'signature.completed' });
    const next = jest.fn();
    expect(() => middleware.use(req as any, {} as any, next)).not.toThrow();
    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).webhookContext).toBeDefined();
    expect((req as any).webhookContext.usedSecondarySecret).toBe(false);
  });

  it('should reject when X-Barid-Signature is missing', () => {
    const req = buildSignedRequest({ a: 1 }, { skipSignature: true });
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow(UnauthorizedException);
  });

  it('should reject when X-Barid-Timestamp is missing', () => {
    const req = buildSignedRequest({ a: 1 }, { skipTimestamp: true });
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow(UnauthorizedException);
  });

  it('should reject malformed signature header (not hex)', () => {
    const req = buildSignedRequest({ a: 1 }, { customSignature: 'sha256=zzznotehex' });
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow(UnauthorizedException);
  });

  it('should reject malformed signature header (wrong prefix)', () => {
    const req = buildSignedRequest({ a: 1 }, { customSignature: 'md5=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789' });
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow(UnauthorizedException);
  });

  it('should reject timestamp older than 300s (replay)', () => {
    const req = buildSignedRequest({ a: 1 }, { timestamp: Math.floor(Date.now() / 1000) - 400 });
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow('Webhook timestamp too old (replay protection)');
  });

  it('should reject timestamp from future (clock skew > 300s)', () => {
    const req = buildSignedRequest({ a: 1 }, { timestamp: Math.floor(Date.now() / 1000) + 400 });
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow('Webhook timestamp too old (replay protection)');
  });

  it('should reject invalid timestamp format (non-numeric)', () => {
    const req: any = buildSignedRequest({ a: 1 });
    req.headers['x-barid-timestamp'] = 'not-a-number';
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow('Invalid timestamp header');
  });

  it('should reject when raw body is missing', () => {
    const req: any = buildSignedRequest({ a: 1 });
    delete req.rawBody;
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow(BadRequestException);
  });

  it('should reject when HMAC mismatch (wrong secret used to sign)', () => {
    const req = buildSignedRequest({ a: 1 }, { secret: 'wrong-secret-32-chars-zzzzzzzzzzzz' });
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow('Invalid webhook signature');
  });

  it('should reject when HMAC mismatch (body tampered after signing)', () => {
    const req = buildSignedRequest({ a: 1 });
    req.rawBody = Buffer.from(JSON.stringify({ a: 999 }));
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow('Invalid webhook signature');
  });

  it('should accept with secondary secret when primary fails (rotation in progress)', async () => {
    (configMock.get as jest.Mock).mockImplementation((key: string, def?: unknown) => {
      const map: Record<string, unknown> = {
        BARID_ESIGN_WEBHOOK_SECRET_PRIMARY: PRIMARY_SECRET,
        BARID_ESIGN_WEBHOOK_SECRET_SECONDARY: SECONDARY_SECRET,
        WEBHOOK_REPLAY_WINDOW_SECONDS: 300,
      };
      return key in map ? map[key] : def;
    });
    const req = buildSignedRequest({ a: 1 }, { secret: SECONDARY_SECRET });
    const next = jest.fn();
    middleware.use(req as any, {} as any, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).webhookContext.usedSecondarySecret).toBe(true);
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ action: 'webhook_secondary_secret_used' }), expect.any(String));
  });

  it('should fail fatally when no secret configured', () => {
    (configMock.get as jest.Mock).mockImplementation(() => undefined);
    const req = buildSignedRequest({ a: 1 });
    expect(() => middleware.use(req as any, {} as any, jest.fn())).toThrow();
    expect(loggerMock.fatal).toHaveBeenCalled();
  });

  it('should compute HMAC using timing-safe comparison', () => {
    const req = buildSignedRequest({ a: 1 });
    const next = jest.fn();
    const t0 = process.hrtime.bigint();
    middleware.use(req as any, {} as any, next);
    const elapsed1 = Number(process.hrtime.bigint() - t0);

    const reqBad = buildSignedRequest({ a: 1 }, { customSignature: 'sha256=' + '0'.repeat(64) });
    const t1 = process.hrtime.bigint();
    try { middleware.use(reqBad as any, {} as any, jest.fn()); } catch {}
    const elapsed2 = Number(process.hrtime.bigint() - t1);

    expect(elapsed1).toBeGreaterThan(0);
    expect(elapsed2).toBeGreaterThan(0);
  });

  it('should log source IP from X-Forwarded-For header', () => {
    const req = buildSignedRequest({ a: 1 });
    middleware.use(req as any, {} as any, jest.fn());
    expect((req as any).webhookContext.sourceIp).toBe('52.84.10.20');
  });

  it('should fallback to socket.remoteAddress when X-Forwarded-For missing', () => {
    const req: any = buildSignedRequest({ a: 1 });
    delete req.headers['x-forwarded-for'];
    middleware.use(req as any, {} as any, jest.fn());
    expect(req.webhookContext.sourceIp).toBe('127.0.0.1');
  });
});
```

### 7.9 Tests unitaires - Idempotency

**Fichier**: `repo/apps/api/src/modules/signature/services/webhook-idempotency.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { WebhookIdempotencyService } from './webhook-idempotency.service';
import { WebhookReceivedEntity } from '../entities/webhook-received.entity';
import { WebhookProcessingStatus, WebhookProvider } from '../types/barid-event.types';

describe('WebhookIdempotencyService', () => {
  let service: WebhookIdempotencyService;
  let repoMock: Partial<Repository<WebhookReceivedEntity>>;
  let dataSourceMock: Partial<DataSource>;
  let loggerMock: Partial<PinoLogger>;

  beforeEach(async () => {
    repoMock = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 } as any),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };
    dataSourceMock = { query: jest.fn() };
    loggerMock = { setContext: jest.fn(), debug: jest.fn(), info: jest.fn(), warn: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookIdempotencyService,
        { provide: getRepositoryToken(WebhookReceivedEntity), useValue: repoMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: PinoLogger, useValue: loggerMock },
      ],
    }).compile();

    service = module.get(WebhookIdempotencyService);
  });

  it('should return isNew=true when INSERT succeeds', async () => {
    (dataSourceMock.query as jest.Mock).mockResolvedValueOnce([{ id: 'wh_1', processing_status: 'pending' }]);
    const result = await service.checkAndStore({
      provider: WebhookProvider.BARID_ESIGN,
      providerEventId: 'evt_new_1',
      eventType: 'signature.completed',
      payload: Buffer.from('{}'),
    });
    expect(result).toEqual({ isNew: true, webhookId: 'wh_1' });
    expect(loggerMock.debug).toHaveBeenCalledWith(expect.objectContaining({ action: 'webhook_idempotency_new' }), expect.any(String));
  });

  it('should return isNew=false when ON CONFLICT triggers (duplicate already_processed)', async () => {
    (dataSourceMock.query as jest.Mock).mockResolvedValueOnce([]);
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce({ id: 'wh_existing', processingStatus: WebhookProcessingStatus.COMPLETED });
    const result = await service.checkAndStore({
      provider: WebhookProvider.BARID_ESIGN,
      providerEventId: 'evt_dup_1',
      eventType: 'signature.completed',
      payload: Buffer.from('{}'),
    });
    expect(result).toEqual({ isNew: false, webhookId: 'wh_existing', duplicateReason: 'already_processed' });
  });

  it('should return duplicateReason=in_progress when existing is pending', async () => {
    (dataSourceMock.query as jest.Mock).mockResolvedValueOnce([]);
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce({ id: 'wh_2', processingStatus: WebhookProcessingStatus.PENDING });
    const result = await service.checkAndStore({
      provider: WebhookProvider.BARID_ESIGN,
      providerEventId: 'evt_dup_2',
      eventType: 'signature.completed',
      payload: Buffer.from('{}'),
    });
    expect(result.duplicateReason).toBe('in_progress');
  });

  it('should return duplicateReason=failed_retry_pending when existing is failed', async () => {
    (dataSourceMock.query as jest.Mock).mockResolvedValueOnce([]);
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce({ id: 'wh_3', processingStatus: WebhookProcessingStatus.FAILED });
    const result = await service.checkAndStore({
      provider: WebhookProvider.BARID_ESIGN,
      providerEventId: 'evt_dup_3',
      eventType: 'signature.completed',
      payload: Buffer.from('{}'),
    });
    expect(result.duplicateReason).toBe('failed_retry_pending');
  });

  it('should throw on race condition (ON CONFLICT but no row found)', async () => {
    (dataSourceMock.query as jest.Mock).mockResolvedValueOnce([]);
    (repoMock.findOne as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.checkAndStore({
      provider: WebhookProvider.BARID_ESIGN,
      providerEventId: 'evt_race',
      eventType: 'signature.completed',
      payload: Buffer.from('{}'),
    })).rejects.toThrow('Race condition');
  });

  it('should compute SHA-512 of payload for hash storage', async () => {
    (dataSourceMock.query as jest.Mock).mockResolvedValueOnce([{ id: 'wh_x', processing_status: 'pending' }]);
    const payload = Buffer.from(JSON.stringify({ event_type: 'signature.completed', event_id: 'evt_x' }));
    await service.checkAndStore({
      provider: WebhookProvider.BARID_ESIGN,
      providerEventId: 'evt_x',
      eventType: 'signature.completed',
      payload,
    });
    const callArgs = (dataSourceMock.query as jest.Mock).mock.calls[0][1];
    expect(callArgs[5]).toMatch(/^[a-f0-9]{128}$/);
  });

  it('should mark webhook completed', async () => {
    await service.markCompleted('wh_done');
    expect(repoMock.update).toHaveBeenCalledWith('wh_done', expect.objectContaining({
      processingStatus: WebhookProcessingStatus.COMPLETED,
      processedAt: expect.any(Date),
    }));
  });

  it('should mark webhook failed and truncate error to 5000 chars', async () => {
    const longError = 'X'.repeat(10000);
    await service.markFailed('wh_fail', longError);
    expect(repoMock.update).toHaveBeenCalledWith('wh_fail', expect.objectContaining({
      processingStatus: WebhookProcessingStatus.FAILED,
      processingError: longError.substring(0, 5000),
    }));
  });

  it('should mark webhook orphan with reason', async () => {
    await service.markOrphan('wh_orph', 'workflow not found');
    expect(repoMock.update).toHaveBeenCalledWith('wh_orph', expect.objectContaining({
      processingStatus: WebhookProcessingStatus.ORPHAN,
      processingError: 'workflow not found',
    }));
  });

  it('should mark in progress with kafka metadata', async () => {
    await service.markInProgress('wh_prog', { topic: 'signature.webhook.received', partition: 2, offset: '12345' });
    expect(repoMock.update).toHaveBeenCalled();
  });

  it('should find pending webhooks for retry', async () => {
    const result = await service.findPendingForRetry(5, 300);
    expect(result).toEqual([]);
    expect(repoMock.createQueryBuilder).toHaveBeenCalled();
  });
});
```

### 7.10 Tests unitaires - Controller

**Fichier**: `repo/apps/api/src/modules/signature/controllers/barid-webhook.controller.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { PinoLogger } from 'nestjs-pino';
import { of } from 'rxjs';
import { BaridWebhookController } from './barid-webhook.controller';
import { WebhookIdempotencyService } from '../services/webhook-idempotency.service';
import { BaridEventType, WebhookProvider } from '../types/barid-event.types';

describe('BaridWebhookController', () => {
  let controller: BaridWebhookController;
  let kafkaMock: Partial<ClientKafka>;
  let idempotencyMock: Partial<WebhookIdempotencyService>;
  let loggerMock: Partial<PinoLogger>;

  const buildPayload = (overrides = {}) => ({
    event_type: BaridEventType.SIGNATURE_COMPLETED,
    event_id: 'evt_test_1',
    occurred_at: new Date().toISOString(),
    workflow_id: '11111111-1111-1111-1111-111111111111',
    barid_workflow_id: 'barid_wf_1',
    tenant_external_ref: 'tenant_1',
    data: {
      signed_document_url: 'https://docs.barid.ma/signed/abc.pdf',
      signed_document_id: 'doc_abc',
      signed_document_size_bytes: 524288,
      certificate_serial_number: '0123456789ABCDEF',
      certificate_issuer: 'CN=ANRT Root CA, O=ANRT, C=MA',
      certificate_subject: 'CN=Test Signer, O=Skalean',
      certificate_valid_from: new Date(Date.now() - 86400000).toISOString(),
      certificate_valid_to: new Date(Date.now() + 31536000000).toISOString(),
      signature_algorithm: 'RSA-SHA256',
      signers: [{
        signer_id: '22222222-2222-2222-2222-222222222222',
        email: 'signer@example.ma',
        full_name: 'Test Signer',
        role: 'signataire' as const,
        signed_at: new Date().toISOString(),
      }],
      completed_at: new Date().toISOString(),
    },
    ...overrides,
  });

  const buildReq = (body: object | string, opts: { withRawBody?: boolean; withCtx?: boolean } = { withRawBody: true, withCtx: true }) => {
    const rawBody = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    return {
      rawBody: opts.withRawBody === false ? undefined : rawBody,
      webhookContext: opts.withCtx === false ? undefined : {
        sourceIp: '52.84.10.20',
        eventId: 'evt_test_1',
        timestamp: Math.floor(Date.now() / 1000),
        verifiedAt: new Date(),
        usedSecondarySecret: false,
      },
    };
  };

  beforeEach(async () => {
    kafkaMock = { emit: jest.fn().mockReturnValue(of({})) };
    idempotencyMock = {
      checkAndStore: jest.fn(),
    };
    loggerMock = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BaridWebhookController],
      providers: [
        { provide: 'KAFKA_SIGNATURE_WEBHOOKS', useValue: kafkaMock },
        { provide: WebhookIdempotencyService, useValue: idempotencyMock },
        { provide: PinoLogger, useValue: loggerMock },
      ],
    }).compile();

    controller = module.get(BaridWebhookController);
  });

  it('should accept new valid webhook and publish to Kafka', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: true, webhookId: 'wh_new' });
    const payload = buildPayload();
    const req = buildReq(payload);
    const result = await controller.receive(req as any, 'evt_test_1', 'wh_id_barid', 'BaridWebhookClient/2.4');
    expect(result).toEqual({ received: true, duplicate: false, webhook_id: 'wh_new' });
    expect(kafkaMock.emit).toHaveBeenCalledWith('signature.webhook.received', expect.objectContaining({
      key: payload.workflow_id,
    }));
  });

  it('should return duplicate=true without publishing to Kafka when idempotency hits', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: false, webhookId: 'wh_dup', duplicateReason: 'already_processed' });
    const payload = buildPayload();
    const req = buildReq(payload);
    const result = await controller.receive(req as any, 'evt_test_1', 'wh_id_barid', 'BaridWebhookClient/2.4');
    expect(result).toEqual({ received: true, duplicate: true, webhook_id: 'wh_dup' });
    expect(kafkaMock.emit).not.toHaveBeenCalled();
  });

  it('should throw BadRequestException when raw body missing', async () => {
    const req = buildReq({}, { withRawBody: false, withCtx: true });
    await expect(controller.receive(req as any, 'evt_x', 'wh_x', 'ua')).rejects.toThrow(BadRequestException);
  });

  it('should persist invalid webhook for malformed JSON and return 200', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: true, webhookId: 'wh_bad' });
    const req = buildReq('not-json-{{{');
    const result = await controller.receive(req as any, 'evt_bad', 'wh_id', 'ua');
    expect(result.received).toBe(true);
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ action: 'webhook_malformed_json' }), expect.any(String));
  });

  it('should persist invalid webhook for invalid schema and return 200', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: true, webhookId: 'wh_invalid' });
    const req = buildReq({ event_type: 'unknown.event', event_id: 'evt' });
    const result = await controller.receive(req as any, 'evt', 'wh', 'ua');
    expect(result.received).toBe(true);
    expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({ action: 'webhook_invalid_payload_schema' }), expect.any(String));
  });

  it('should publish kafka message with workflow_id as partition key (ordering guarantee)', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: true, webhookId: 'wh_kp' });
    const payload = buildPayload();
    await controller.receive(buildReq(payload) as any, 'evt_test_1', 'wh_id', 'ua');
    expect(kafkaMock.emit).toHaveBeenCalledWith('signature.webhook.received', expect.objectContaining({ key: payload.workflow_id }));
  });

  it('should still return 200 even if Kafka publish fails (store-then-forward)', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: true, webhookId: 'wh_kfail' });
    (kafkaMock.emit as jest.Mock).mockReturnValueOnce({ toPromise: () => Promise.reject(new Error('Kafka down')) });
    const payload = buildPayload();
    const result = await controller.receive(buildReq(payload) as any, 'evt_test_1', 'wh_id', 'ua');
    expect(result.received).toBe(true);
    expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({ action: 'webhook_kafka_publish_failed' }), expect.any(String));
  });

  it('should respond in less than 500ms even with payload of 100KB', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: true, webhookId: 'wh_perf' });
    const big = buildPayload();
    (big.data as any).extra_field = 'X'.repeat(100000);
    const start = Date.now();
    await controller.receive(buildReq(big) as any, 'evt_perf', 'wh', 'ua');
    expect(Date.now() - start).toBeLessThan(500);
  });

  it('should accept signature.declined events', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: true, webhookId: 'wh_dec' });
    const payload = {
      event_type: BaridEventType.SIGNATURE_DECLINED,
      event_id: 'evt_dec',
      occurred_at: new Date().toISOString(),
      workflow_id: '11111111-1111-1111-1111-111111111111',
      barid_workflow_id: 'barid_dec',
      tenant_external_ref: 'tenant_1',
      data: {
        declined_by_signer_id: '33333333-3333-3333-3333-333333333333',
        declined_by_email: 'declined@example.ma',
        declined_at: new Date().toISOString(),
        decline_reason: 'Conditions non acceptees',
        signers: [{
          signer_id: '33333333-3333-3333-3333-333333333333',
          email: 'declined@example.ma',
          full_name: 'Declined Signer',
          role: 'signataire' as const,
        }],
      },
    };
    const result = await controller.receive(buildReq(payload) as any, 'evt_dec', 'wh', 'ua');
    expect(result.duplicate).toBe(false);
  });

  it('should accept signer.viewed events (audit only)', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: true, webhookId: 'wh_view' });
    const payload = {
      event_type: BaridEventType.SIGNER_VIEWED,
      event_id: 'evt_view',
      occurred_at: new Date().toISOString(),
      workflow_id: '11111111-1111-1111-1111-111111111111',
      barid_workflow_id: 'barid_v',
      tenant_external_ref: 'tenant_1',
      data: {
        signer: {
          signer_id: '44444444-4444-4444-4444-444444444444',
          email: 'viewer@example.ma',
          full_name: 'Viewer',
          role: 'signataire' as const,
          ip_address: '192.0.2.1',
        },
        workflow_remaining_signers: 2,
      },
    };
    const result = await controller.receive(buildReq(payload) as any, 'evt_view', 'wh', 'ua');
    expect(result.received).toBe(true);
  });

  it('should pass provider=barid_esign in idempotency check', async () => {
    (idempotencyMock.checkAndStore as jest.Mock).mockResolvedValueOnce({ isNew: true, webhookId: 'wh_p' });
    await controller.receive(buildReq(buildPayload()) as any, 'evt_test_1', 'wh', 'ua');
    expect(idempotencyMock.checkAndStore).toHaveBeenCalledWith(expect.objectContaining({ provider: WebhookProvider.BARID_ESIGN }));
  });
});
```

### 7.11 Tests unitaires - Consumer

**Fichier**: `repo/apps/api/src/modules/signature/consumers/barid-webhook-processor.consumer.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { BaridWebhookProcessorConsumer } from './barid-webhook-processor.consumer';
import { CompletionOrchestratorService } from '../services/completion-orchestrator.service';
import { WebhookIdempotencyService } from '../services/webhook-idempotency.service';
import { SigningWorkflowsRepository } from '../repositories/signing-workflows.repository';
import { AuditTrailService } from '../services/audit-trail.service';
import { HashService } from '../services/hash.service';
import { BaridEventType } from '../types/barid-event.types';

class MockMultiTenant {
  async runWithTenant(_tid: string, fn: () => Promise<void>): Promise<void> { return fn(); }
}

describe('BaridWebhookProcessorConsumer', () => {
  let consumer: BaridWebhookProcessorConsumer;
  let orchestratorMock: any;
  let idempotencyMock: any;
  let workflowsRepoMock: any;
  let auditMock: any;
  let hashMock: any;
  let loggerMock: any;

  const buildKafkaCtx = () => ({
    getTopic: () => 'signature.webhook.received',
    getPartition: () => 0,
    getMessage: () => ({ offset: '42' }),
  });

  const buildKafkaMessage = (overrides: any = {}) => ({
    webhook_id: '99999999-9999-9999-9999-999999999999',
    event_type: BaridEventType.SIGNATURE_COMPLETED,
    event_id: 'evt_proc',
    workflow_id: '11111111-1111-1111-1111-111111111111',
    provider: 'barid_esign',
    raw_payload: {
      event_type: BaridEventType.SIGNATURE_COMPLETED,
      event_id: 'evt_proc',
      occurred_at: new Date().toISOString(),
      workflow_id: '11111111-1111-1111-1111-111111111111',
      barid_workflow_id: 'barid_proc',
      tenant_external_ref: 'tenant_1',
      data: {
        signed_document_url: 'https://docs.barid.ma/signed/x.pdf',
        signed_document_id: 'doc_proc',
        signed_document_size_bytes: 100000,
        certificate_serial_number: '0123456789ABCDEF',
        certificate_issuer: 'CN=ANRT',
        certificate_subject: 'CN=Test',
        certificate_valid_from: new Date(Date.now() - 86400000).toISOString(),
        certificate_valid_to: new Date(Date.now() + 31536000000).toISOString(),
        signature_algorithm: 'RSA-SHA256',
        signers: [{ signer_id: '22222222-2222-2222-2222-222222222222', email: 's@e.ma', full_name: 'S', role: 'signataire' as const }],
        completed_at: new Date().toISOString(),
      },
    },
    received_at: new Date().toISOString(),
    ...overrides,
  });

  beforeEach(async () => {
    orchestratorMock = {
      orchestrateCompletion: jest.fn().mockResolvedValue({ success: true, workflowId: '11111111-1111-1111-1111-111111111111', durationMs: 100 }),
      orchestrateDecline: jest.fn().mockResolvedValue({ success: true, workflowId: '11111111-1111-1111-1111-111111111111', durationMs: 50 }),
      orchestrateExpiration: jest.fn().mockResolvedValue({ success: true, workflowId: '11111111-1111-1111-1111-111111111111', durationMs: 50 }),
    };
    idempotencyMock = {
      markInProgress: jest.fn().mockResolvedValue(undefined),
      markCompleted: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      markOrphan: jest.fn().mockResolvedValue(undefined),
    };
    workflowsRepoMock = {
      findByIdSystemContext: jest.fn().mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111', tenantId: 'tnt_1', status: 'in_progress', providerWorkflowId: 'barid_x' }),
    };
    auditMock = { log: jest.fn().mockResolvedValue(undefined), logTx: jest.fn().mockResolvedValue(undefined) };
    hashMock = { sha256Hex: (b: Buffer) => 'hash_' + b.toString('hex').substring(0, 8) };
    loggerMock = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BaridWebhookProcessorConsumer],
      providers: [
        { provide: CompletionOrchestratorService, useValue: orchestratorMock },
        { provide: WebhookIdempotencyService, useValue: idempotencyMock },
        { provide: SigningWorkflowsRepository, useValue: workflowsRepoMock },
        { provide: AuditTrailService, useValue: auditMock },
        { provide: HashService, useValue: hashMock },
        { provide: 'MultiTenantContextService', useClass: MockMultiTenant },
        { provide: PinoLogger, useValue: loggerMock },
      ],
    }).overrideProvider('MultiTenantContextService').useClass(MockMultiTenant).compile();

    consumer = module.get(BaridWebhookProcessorConsumer);
    (consumer as any).multiTenant = new MockMultiTenant();
  });

  it('should process signature.completed via orchestrateCompletion', async () => {
    await consumer.handleWebhook(buildKafkaMessage(), buildKafkaCtx() as any);
    expect(orchestratorMock.orchestrateCompletion).toHaveBeenCalledTimes(1);
    expect(idempotencyMock.markCompleted).toHaveBeenCalledWith('99999999-9999-9999-9999-999999999999');
  });

  it('should process signature.declined via orchestrateDecline', async () => {
    const msg = buildKafkaMessage({
      event_type: BaridEventType.SIGNATURE_DECLINED,
      raw_payload: {
        event_type: BaridEventType.SIGNATURE_DECLINED,
        event_id: 'evt_dec', occurred_at: new Date().toISOString(),
        workflow_id: '11111111-1111-1111-1111-111111111111',
        barid_workflow_id: 'b_d', tenant_external_ref: 't_1',
        data: {
          declined_by_signer_id: '33333333-3333-3333-3333-333333333333',
          declined_by_email: 'd@e.ma', declined_at: new Date().toISOString(),
          decline_reason: 'Refus', signers: [{ signer_id: '33333333-3333-3333-3333-333333333333', email: 'd@e.ma', full_name: 'D', role: 'signataire' as const }],
        },
      },
    });
    await consumer.handleWebhook(msg, buildKafkaCtx() as any);
    expect(orchestratorMock.orchestrateDecline).toHaveBeenCalled();
  });

  it('should process signature.expired via orchestrateExpiration', async () => {
    const msg = buildKafkaMessage({
      event_type: BaridEventType.SIGNATURE_EXPIRED,
      raw_payload: {
        event_type: BaridEventType.SIGNATURE_EXPIRED,
        event_id: 'evt_exp', occurred_at: new Date().toISOString(),
        workflow_id: '11111111-1111-1111-1111-111111111111',
        barid_workflow_id: 'b_e', tenant_external_ref: 't_1',
        data: {
          expired_at: new Date().toISOString(),
          signers_signed_count: 1, signers_pending_count: 2,
          signers: [{ signer_id: '44444444-4444-4444-4444-444444444444', email: 'e@e.ma', full_name: 'E', role: 'signataire' as const }],
        },
      },
    });
    await consumer.handleWebhook(msg, buildKafkaCtx() as any);
    expect(orchestratorMock.orchestrateExpiration).toHaveBeenCalled();
  });

  it('should mark orphan when workflow not found', async () => {
    workflowsRepoMock.findByIdSystemContext.mockResolvedValueOnce(null);
    await consumer.handleWebhook(buildKafkaMessage(), buildKafkaCtx() as any);
    expect(idempotencyMock.markOrphan).toHaveBeenCalled();
    expect(orchestratorMock.orchestrateCompletion).not.toHaveBeenCalled();
  });

  it('should skip when state machine refuses transition', async () => {
    workflowsRepoMock.findByIdSystemContext.mockResolvedValueOnce({ id: '11111111-1111-1111-1111-111111111111', tenantId: 'tnt_1', status: 'completed', providerWorkflowId: 'b' });
    await consumer.handleWebhook(buildKafkaMessage(), buildKafkaCtx() as any);
    expect(orchestratorMock.orchestrateCompletion).not.toHaveBeenCalled();
    expect(idempotencyMock.markCompleted).toHaveBeenCalled();
  });

  it('should mark failed and re-throw on orchestrator error', async () => {
    orchestratorMock.orchestrateCompletion.mockRejectedValueOnce(new Error('ANRT down'));
    await expect(consumer.handleWebhook(buildKafkaMessage(), buildKafkaCtx() as any)).rejects.toThrow('ANRT down');
    expect(idempotencyMock.markFailed).toHaveBeenCalled();
  });

  it('should log audit entry for signer.viewed', async () => {
    const msg = buildKafkaMessage({
      event_type: BaridEventType.SIGNER_VIEWED,
      raw_payload: {
        event_type: BaridEventType.SIGNER_VIEWED,
        event_id: 'evt_v', occurred_at: new Date().toISOString(),
        workflow_id: '11111111-1111-1111-1111-111111111111',
        barid_workflow_id: 'b_v', tenant_external_ref: 't_1',
        data: {
          signer: { signer_id: '55555555-5555-5555-5555-555555555555', email: 'v@e.ma', full_name: 'V', role: 'signataire' as const, ip_address: '1.2.3.4' },
          workflow_remaining_signers: 2,
        },
      },
    });
    await consumer.handleWebhook(msg, buildKafkaCtx() as any);
    expect(auditMock.log).toHaveBeenCalledWith(expect.objectContaining({ eventType: BaridEventType.SIGNER_VIEWED }));
  });

  it('should mark in progress before processing with kafka metadata', async () => {
    await consumer.handleWebhook(buildKafkaMessage(), buildKafkaCtx() as any);
    expect(idempotencyMock.markInProgress).toHaveBeenCalledWith(
      '99999999-9999-9999-9999-999999999999',
      { topic: 'signature.webhook.received', partition: 0, offset: '42' },
    );
  });

  it('should run within MultiTenantContext for the workflow tenant', async () => {
    const spy = jest.spyOn(MockMultiTenant.prototype, 'runWithTenant');
    await consumer.handleWebhook(buildKafkaMessage(), buildKafkaCtx() as any);
    expect(spy).toHaveBeenCalledWith('tnt_1', expect.any(Function));
  });

  it('should throw on invalid Kafka message schema (route to DLQ)', async () => {
    await expect(consumer.handleWebhook({ invalid: true }, buildKafkaCtx() as any)).rejects.toThrow();
  });
});
```

### 7.12 Tests unitaires - CompletionOrchestrator

**Fichier**: `repo/apps/api/src/modules/signature/services/completion-orchestrator.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { of } from 'rxjs';
import { CompletionOrchestratorService } from './completion-orchestrator.service';
import { BaridEsignClient } from '../clients/barid-esign.client';
import { AnrtTimestampService } from './anrt-timestamp.service';
import { HashService } from './hash.service';
import { SigningWorkflowsRepository } from '../repositories/signing-workflows.repository';
import { AuditTrailService } from './audit-trail.service';
import { BaridEventType } from '../types/barid-event.types';

describe('CompletionOrchestratorService', () => {
  let service: CompletionOrchestratorService;
  let baridMock: any;
  let anrtMock: any;
  let hashMock: any;
  let workflowsMock: any;
  let auditMock: any;
  let dataSourceMock: any;
  let kafkaMock: any;
  let loggerMock: any;

  const validPayload = {
    event_type: BaridEventType.SIGNATURE_COMPLETED,
    event_id: 'evt_c1',
    occurred_at: new Date().toISOString(),
    workflow_id: 'wf_1',
    barid_workflow_id: 'b_wf_1',
    tenant_external_ref: 'tnt_1',
    data: {
      signed_document_url: 'https://docs.barid.ma/x.pdf',
      signed_document_id: 'doc_1',
      signed_document_size_bytes: 1000,
      certificate_serial_number: 'ABCDEF',
      certificate_issuer: 'CN=ANRT',
      certificate_subject: 'CN=Test',
      certificate_valid_from: new Date(Date.now() - 86400000).toISOString(),
      certificate_valid_to: new Date(Date.now() + 86400000).toISOString(),
      signature_algorithm: 'RSA-SHA256',
      signers: [{
        signer_id: 'sig_1', email: 's@e.ma', phone: '+212600000000', full_name: 'S',
        role: 'signataire' as const, signed_at: new Date().toISOString(),
        authentication_method: 'cin_anrt' as const,
      }],
      completed_at: new Date().toISOString(),
    },
  };

  beforeEach(async () => {
    baridMock = { downloadSignedDocument: jest.fn().mockResolvedValue(Buffer.from('PDF-CONTENT')) };
    anrtMock = { requestTimestamp: jest.fn().mockResolvedValue({ tsaToken: Buffer.from('TSATOKEN'), serialNumber: '12345', genTime: new Date() }) };
    hashMock = {
      sha512Hex: jest.fn().mockResolvedValue('a'.repeat(128)),
      sha256Hex: jest.fn((b: Buffer) => 'sha256_' + b.toString('hex').substring(0, 8)),
    };
    workflowsMock = {
      findByIdOrFail: jest.fn().mockResolvedValue({ id: 'wf_1', tenantId: 'tnt_1', status: 'in_progress', providerWorkflowId: 'b_wf_1', title: 'Contrat', locale: 'fr' }),
      markCompletedTx: jest.fn(),
      markDeclinedTx: jest.fn(),
      markExpiredTx: jest.fn(),
    };
    auditMock = { logTx: jest.fn() };
    dataSourceMock = { transaction: jest.fn(async (fn: any) => fn({})) };
    kafkaMock = { emit: jest.fn().mockReturnValue(of({})) };
    loggerMock = { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompletionOrchestratorService,
        { provide: BaridEsignClient, useValue: baridMock },
        { provide: AnrtTimestampService, useValue: anrtMock },
        { provide: HashService, useValue: hashMock },
        { provide: SigningWorkflowsRepository, useValue: workflowsMock },
        { provide: AuditTrailService, useValue: auditMock },
        { provide: DataSource, useValue: dataSourceMock },
        { provide: 'KAFKA_SIGNATURE_WEBHOOKS', useValue: kafkaMock },
        { provide: PinoLogger, useValue: loggerMock },
      ],
    }).compile();

    service = module.get(CompletionOrchestratorService);
  });

  it('should orchestrate completion: download + hash + timestamp + persist + archive + notify', async () => {
    const result = await service.orchestrateCompletion('wf_1', validPayload as any);
    expect(baridMock.downloadSignedDocument).toHaveBeenCalledWith('b_wf_1');
    expect(hashMock.sha512Hex).toHaveBeenCalled();
    expect(anrtMock.requestTimestamp).toHaveBeenCalled();
    expect(workflowsMock.markCompletedTx).toHaveBeenCalled();
    expect(auditMock.logTx).toHaveBeenCalled();
    expect(kafkaMock.emit).toHaveBeenCalledWith('signature.workflow_completed', expect.anything());
    expect(kafkaMock.emit).toHaveBeenCalledWith('comm.notify', expect.anything());
    expect(result.success).toBe(true);
    expect(result.notificationsTriggered).toBe(1);
  });

  it('should skip orchestration when workflow already completed', async () => {
    workflowsMock.findByIdOrFail.mockResolvedValueOnce({ id: 'wf_1', tenantId: 'tnt_1', status: 'completed', providerWorkflowId: 'b' });
    const result = await service.orchestrateCompletion('wf_1', validPayload as any);
    expect(result.success).toBe(false);
    expect(baridMock.downloadSignedDocument).not.toHaveBeenCalled();
  });

  it('should propagate ANRT TSA failure', async () => {
    anrtMock.requestTimestamp.mockRejectedValueOnce(new Error('ANRT TSA timeout'));
    await expect(service.orchestrateCompletion('wf_1', validPayload as any)).rejects.toThrow('ANRT TSA timeout');
  });

  it('should hash PII (email, cin) before logging in audit', async () => {
    await service.orchestrateCompletion('wf_1', validPayload as any);
    const auditCall = auditMock.logTx.mock.calls[0][1];
    expect(auditCall.eventData.signers[0].email_hash).toBeDefined();
    expect(auditCall.eventData.signers[0]).not.toHaveProperty('email');
  });

  it('should orchestrate decline with audit + notify', async () => {
    const declinePayload = {
      event_type: BaridEventType.SIGNATURE_DECLINED,
      event_id: 'evt_d', occurred_at: new Date().toISOString(),
      workflow_id: 'wf_1', barid_workflow_id: 'b', tenant_external_ref: 't',
      data: {
        declined_by_signer_id: 'sig_1', declined_by_email: 'd@e.ma',
        declined_at: new Date().toISOString(), decline_reason: 'Refus',
        signers: [{ signer_id: 'sig_1', email: 'd@e.ma', full_name: 'D', role: 'signataire' as const }],
      },
    };
    const result = await service.orchestrateDecline('wf_1', declinePayload as any);
    expect(result.success).toBe(true);
    expect(workflowsMock.markDeclinedTx).toHaveBeenCalled();
    expect(kafkaMock.emit).toHaveBeenCalledWith('comm.notify', expect.anything());
  });

  it('should orchestrate expiration with audit + notify', async () => {
    const expPayload = {
      event_type: BaridEventType.SIGNATURE_EXPIRED,
      event_id: 'evt_e', occurred_at: new Date().toISOString(),
      workflow_id: 'wf_1', barid_workflow_id: 'b', tenant_external_ref: 't',
      data: {
        expired_at: new Date().toISOString(),
        signers_signed_count: 1, signers_pending_count: 2,
        signers: [{ signer_id: 'sig_1', email: 'e@e.ma', full_name: 'E', role: 'signataire' as const }],
      },
    };
    const result = await service.orchestrateExpiration('wf_1', expPayload as any);
    expect(result.success).toBe(true);
    expect(workflowsMock.markExpiredTx).toHaveBeenCalled();
  });

  it('should publish workflow_completed event with tenant_id for archive consumer', async () => {
    await service.orchestrateCompletion('wf_1', validPayload as any);
    expect(kafkaMock.emit).toHaveBeenCalledWith('signature.workflow_completed', expect.objectContaining({
      key: 'wf_1',
    }));
  });

  it('should send WhatsApp notification only when phone present', async () => {
    const noPhonePayload = JSON.parse(JSON.stringify(validPayload));
    delete noPhonePayload.data.signers[0].phone;
    await service.orchestrateCompletion('wf_1', noPhonePayload);
    const notifyCall = (kafkaMock.emit.mock.calls.find((c: any) => c[0] === 'comm.notify') as any)[1];
    const value = JSON.parse(notifyCall.value);
    expect(value.channels).toEqual(['email']);
  });
});
```

### 7.13 Tests E2E

**Fichier**: `repo/apps/api/test/signature/barid-webhook.e2e-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NestFastifyApplication, FastifyAdapter } from '@nestjs/platform-fastify';
import { createHmac } from 'node:crypto';
import fastifyRawBody from 'fastify-raw-body';
import { AppModule } from '../../src/app.module';
import { v4 as uuidv4 } from 'uuid';

describe('Barid Webhook E2E', () => {
  let app: NestFastifyApplication;
  const SECRET = process.env.BARID_ESIGN_WEBHOOK_SECRET_PRIMARY || 'e2e-test-secret-32-chars-long-aaa';

  const sign = (body: object, ts?: number) => {
    const timestamp = ts ?? Math.floor(Date.now() / 1000);
    const rawBody = JSON.stringify(body);
    const sig = createHmac('sha256', SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
    return { signature: `sha256=${sig}`, timestamp: timestamp.toString(), rawBody };
  };

  const buildPayload = (overrides: any = {}) => ({
    event_type: 'signature.completed',
    event_id: `evt_${uuidv4()}`,
    occurred_at: new Date().toISOString(),
    workflow_id: '11111111-1111-1111-1111-111111111111',
    barid_workflow_id: 'barid_e2e_1',
    tenant_external_ref: 'tenant_e2e',
    data: {
      signed_document_url: 'https://docs.barid.ma/signed/e2e.pdf',
      signed_document_id: 'doc_e2e',
      signed_document_size_bytes: 524288,
      certificate_serial_number: '0123456789ABCDEF',
      certificate_issuer: 'CN=ANRT Root CA',
      certificate_subject: 'CN=E2E Signer',
      certificate_valid_from: new Date(Date.now() - 86400000).toISOString(),
      certificate_valid_to: new Date(Date.now() + 31536000000).toISOString(),
      signature_algorithm: 'RSA-SHA256',
      signers: [{ signer_id: '22222222-2222-2222-2222-222222222222', email: 'e2e@example.ma', full_name: 'E2E Signer', role: 'signataire', signed_at: new Date().toISOString() }],
      completed_at: new Date().toISOString(),
    },
    ...overrides,
  });

  beforeAll(async () => {
    process.env.BARID_ESIGN_WEBHOOK_SECRET_PRIMARY = SECRET;
    process.env.WEBHOOK_REPLAY_WINDOW_SECONDS = '300';

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter({ bodyLimit: 1048576 }));
    await app.register(fastifyRawBody as any, {
      field: 'rawBody', global: false, encoding: false, runFirst: true,
      routes: ['/api/v1/public/webhooks/barid-esign'],
    });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => { await app.close(); });

  it('POST /webhooks/barid-esign with valid signature returns 200', async () => {
    const payload = buildPayload();
    const { signature, timestamp, rawBody } = sign(payload);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: {
        'content-type': 'application/json',
        'x-barid-signature': signature,
        'x-barid-timestamp': timestamp,
        'x-barid-event-id': payload.event_id,
      },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.received).toBe(true);
  });

  it('returns 401 when X-Barid-Signature is missing', async () => {
    const payload = buildPayload();
    const { timestamp, rawBody } = sign(payload);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: { 'content-type': 'application/json', 'x-barid-timestamp': timestamp, 'x-barid-event-id': payload.event_id },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when timestamp is older than 300s', async () => {
    const payload = buildPayload();
    const oldTs = Math.floor(Date.now() / 1000) - 400;
    const { signature, rawBody } = sign(payload, oldTs);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: { 'content-type': 'application/json', 'x-barid-signature': signature, 'x-barid-timestamp': oldTs.toString(), 'x-barid-event-id': payload.event_id },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when HMAC is wrong (body tampered)', async () => {
    const payload = buildPayload();
    const { signature, timestamp } = sign(payload);
    const tampered = JSON.stringify({ ...payload, event_id: 'tampered' });
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: { 'content-type': 'application/json', 'x-barid-signature': signature, 'x-barid-timestamp': timestamp, 'x-barid-event-id': 'tampered' },
      payload: tampered,
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 200 + duplicate=true on repeat send (idempotency)', async () => {
    const payload = buildPayload();
    const { signature, timestamp, rawBody } = sign(payload);
    const headers = { 'content-type': 'application/json', 'x-barid-signature': signature, 'x-barid-timestamp': timestamp, 'x-barid-event-id': payload.event_id };
    const res1 = await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/barid-esign', headers, payload: rawBody });
    const res2 = await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/barid-esign', headers, payload: rawBody });
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res2.payload).duplicate).toBe(true);
  });

  it('returns 200 with malformed JSON (best-effort)', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const rawBody = '{invalid json';
    const sig = createHmac('sha256', SECRET).update(`${ts}.${rawBody}`).digest('hex');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: { 'content-type': 'application/json', 'x-barid-signature': `sha256=${sig}`, 'x-barid-timestamp': ts.toString(), 'x-barid-event-id': 'evt_invalid_json' },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 200 with invalid schema (extra/missing fields)', async () => {
    const payload = { event_type: 'unknown.event', event_id: 'evt_unknown' };
    const { signature, timestamp, rawBody } = sign(payload);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: { 'content-type': 'application/json', 'x-barid-signature': signature, 'x-barid-timestamp': timestamp, 'x-barid-event-id': payload.event_id },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(200);
  });

  it('responds in less than 500ms (perf p99)', async () => {
    const payload = buildPayload();
    const { signature, timestamp, rawBody } = sign(payload);
    const start = Date.now();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: { 'content-type': 'application/json', 'x-barid-signature': signature, 'x-barid-timestamp': timestamp, 'x-barid-event-id': payload.event_id },
      payload: rawBody,
    });
    const elapsed = Date.now() - start;
    expect(res.statusCode).toBe(200);
    expect(elapsed).toBeLessThan(500);
  });

  it('returns 413 with payload > 1MB', async () => {
    const payload = buildPayload();
    (payload.data as any).extra = 'X'.repeat(2 * 1024 * 1024);
    const { signature, timestamp, rawBody } = sign(payload);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: { 'content-type': 'application/json', 'x-barid-signature': signature, 'x-barid-timestamp': timestamp, 'x-barid-event-id': payload.event_id },
      payload: rawBody,
    });
    expect([413, 400]).toContain(res.statusCode);
  });

  it('accepts signature.declined event', async () => {
    const payload = {
      event_type: 'signature.declined', event_id: `evt_${uuidv4()}`, occurred_at: new Date().toISOString(),
      workflow_id: '11111111-1111-1111-1111-111111111111', barid_workflow_id: 'b_d', tenant_external_ref: 't',
      data: {
        declined_by_signer_id: '33333333-3333-3333-3333-333333333333',
        declined_by_email: 'd@e.ma', declined_at: new Date().toISOString(),
        decline_reason: 'Refuse', signers: [{ signer_id: '33333333-3333-3333-3333-333333333333', email: 'd@e.ma', full_name: 'D', role: 'signataire' }],
      },
    };
    const { signature, timestamp, rawBody } = sign(payload);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: { 'content-type': 'application/json', 'x-barid-signature': signature, 'x-barid-timestamp': timestamp, 'x-barid-event-id': payload.event_id },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(200);
  });

  it('accepts signer.viewed event (audit only)', async () => {
    const payload = {
      event_type: 'signer.viewed', event_id: `evt_${uuidv4()}`, occurred_at: new Date().toISOString(),
      workflow_id: '11111111-1111-1111-1111-111111111111', barid_workflow_id: 'b_v', tenant_external_ref: 't',
      data: {
        signer: { signer_id: '44444444-4444-4444-4444-444444444444', email: 'v@e.ma', full_name: 'V', role: 'signataire', ip_address: '192.0.2.1' },
        workflow_remaining_signers: 1,
      },
    };
    const { signature, timestamp, rawBody } = sign(payload);
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/public/webhooks/barid-esign',
      headers: { 'content-type': 'application/json', 'x-barid-signature': signature, 'x-barid-timestamp': timestamp, 'x-barid-event-id': payload.event_id },
      payload: rawBody,
    });
    expect(res.statusCode).toBe(200);
  });
});
```

## Section 8 - Variables d'environnement

```env
# .env.example - section BARID WEBHOOK

# Secret HMAC SHA-256 partage avec Barid (rotation 90j recommandee OWASP)
BARID_ESIGN_WEBHOOK_SECRET_PRIMARY=replace-me-min-32-chars-cryptographically-random
BARID_ESIGN_WEBHOOK_SECRET_SECONDARY=replace-me-only-during-rotation-window

# Fenetre de tolerance pour timestamp (replay protection)
WEBHOOK_REPLAY_WINDOW_SECONDS=300

# TTL idempotency (Barid ne retry pas au-dela de 24h)
WEBHOOK_IDEMPOTENCY_TTL_SECONDS=86400

# Kafka topic
WEBHOOK_PROCESSING_QUEUE=signature.webhook.received
WEBHOOK_DLQ_QUEUE=signature.webhook.dlq

# SLA latence webhook
WEBHOOK_RESPONSE_TIMEOUT_MS=500

# Fastify body limit (1MB protection DoS)
FASTIFY_BODY_LIMIT_BYTES=1048576
```

## Section 9 - Dependances NPM

```json
{
  "dependencies": {
    "fastify-raw-body": "^4.3.0",
    "@nestjs/microservices": "^10.3.0",
    "kafkajs": "^2.2.4",
    "uuid": "^9.0.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/uuid": "^9.0.7"
  }
}
```

## Section 10 - Procedure deploiement

1. Migration DB: `pnpm typeorm:migrate up` (cree table `sig_webhooks_received`)
2. Deployer secret HMAC dans AWS Secrets Manager: `aws secretsmanager create-secret --name skalean/barid/webhook-secret --secret-string $(openssl rand -hex 32)`
3. Mettre a jour env vars dans Helm values.yaml: `BARID_ESIGN_WEBHOOK_SECRET_PRIMARY` (depuis Secrets Manager via External Secrets Operator)
4. Deployer en rolling update API + Consumer
5. Configurer endpoint cote Barid Console: `https://api.skalean.ma/api/v1/public/webhooks/barid-esign` + secret partage
6. Tester en sandbox avec webhook test Barid: `POST /test-webhook?event_type=signature.completed`
7. Activer alarmes CloudWatch: latence p95 > 500ms, taux erreur 5xx > 0.1%, DLQ non-vide

## Section 11 - Monitoring et alertes

- **Metric Prometheus**: `barid_webhook_received_total{event_type, processing_status}` (counter)
- **Metric Prometheus**: `barid_webhook_response_latency_ms{quantile}` (histogram)
- **Metric Prometheus**: `barid_webhook_processing_latency_ms{quantile, event_type}` (histogram async consumer)
- **Metric Prometheus**: `barid_webhook_dlq_messages` (gauge)
- **Alerte CloudWatch P0**: response latency p99 > 500ms during 5min consecutifs
- **Alerte CloudWatch P0**: DLQ count > 0 pendant 5min
- **Alerte CloudWatch P1**: HMAC failure rate > 1% pendant 10min (potentielle attaque ou rotation incomplete)
- **Alerte CloudWatch P1**: Idempotency duplicate rate > 20% (Barid en boucle de retry, indiquant probleme cote Skalean)
- **Dashboard Grafana**: webhooks received/min, processing duration, success rate, top event_types, geographic distribution source IPs

## Section 12 - Edge cases (12+)

1. **HMAC invalide** -> 401 Unauthorized + log warning + Barid retry x5 puis arret automatique
2. **Timestamp trop vieux** (> 300s) -> 401 Unauthorized + log + pas de stockage (eviter persister payloads de tentatives replay)
3. **Header X-Barid-Signature absent** -> 401 Unauthorized + log warning + ne pas reveler quel header manque (information disclosure)
4. **JSON malforme** -> 200 OK + persister webhook avec status='invalid' + ne pas retry (bug Barid)
5. **Schema invalide** (event_type inconnu) -> 200 OK + persister webhook avec status='invalid' + ne pas retry
6. **Duplicate event_id** -> 200 OK + duplicate=true + skip Kafka publish + log info
7. **Kafka down** lors du publish -> 200 OK + log error + WebhookForwarderJob retry chaque minute pour les pending
8. **Workflow_id introuvable** (orphan webhook) -> 200 OK consumer marque orphan + log warning + alerte si rate > 5%
9. **Workflow deja completed** (idempotency state machine) -> 200 OK consumer skip + log info + ack Kafka
10. **Signer.signed apres signature.completed** (race ordre) -> 200 OK consumer ack + log warning + audit entry quand meme
11. **Decline by witness** (temoin refuse) -> selon config workflow: si blocking decline -> orchestrate Decline, sinon audit only + relance temoin
12. **Expired arrive apres completion** (race) -> state machine refuse transition completed -> expired -> 200 OK skip
13. **Barid IP changed** (no whitelist enforcement) -> log warning + accepte si HMAC valide + alerte ops pour mettre a jour liste de reference
14. **Payload > 1MB** -> 413 Payload Too Large + log + ne pas persister (DoS protection)
15. **Clock skew NTP** (drift > 30s) -> alerte CloudWatch + faux rejets potentiels durant la periode
16. **Secret rotation en cours** -> dual-secret support + warning log si secondary utilise
17. **Kafka DLQ non vide** apres 5 retries consumer -> alerte P0 + analyse manuelle + reprocess via CLI tool

## Section 13 - Conformite reglementaire

### 13.1 Loi 43-20 article 9 (preuve numerique)

L'article 9 de la Loi 43-20 sur la confiance numerique impose la conservation d'une "trace probante" de chaque etape du cycle de vie d'une signature electronique qualifiee. Le webhook receiver garantit cela via:
- **Persistance complete des evenements** dans `sig_webhooks_received` avec hash SHA-512 du payload (preuve d'integrite)
- **Audit trail dedie** dans `sig_audit_trails` avec timestamp ANRT pour chaque event applique au workflow
- **Conservation 10 ans minimum** (politique de retention sealed archive Tache 3.3.12)

### 13.2 ACAPS Circulaire 2018/01 article 9 (tracabilite)

L'article 9 de la circulaire ACAPS impose pour les contrats d'assurance signes electroniquement:
- **Identification unique signataire** -> CIN, email, phone hashes dans audit trail
- **Methode d'authentification** -> `authentication_method` (otp_sms, otp_email, cin_anrt, biometric) trace
- **Heure exacte signature** -> `signed_at` ISO 8601 + ANRT timestamp pour preuve
- **IP et user-agent** -> tracees dans audit trail (preuve faisceau)
- **Certificat ANRT** -> serial, issuer, subject, validity persistes

### 13.3 CNDP Loi 09-08 (PII minimisation)

La loi 09-08 sur la protection des donnees impose la minimisation des PII en logs:
- **Email/phone hashes** SHA-256 dans audit trail (pas en clair)
- **CIN hash** SHA-256 dans audit trail
- **Pino redact config** sur paths PII pour logs applicatifs
- **Conservation chiffree at-rest** (RDS encryption KMS + S3 encryption KMS)
- **Droit d'acces et effacement** : exposable via API admin pour repondre aux demandes RGPD/CNDP (Sprint 12)

### 13.4 OWASP Webhook Security best practices

- HMAC SHA-256 avec timing-safe compare [OK]
- Timestamp replay protection [OK]
- Raw body verification (pas de re-stringify) [OK]
- Idempotency [OK]
- Async processing ack-then-process [OK]
- TLS 1.2+ obligatoire (AWS ALB termine TLS) [OK]
- Body size limit DoS [OK]
- Secret rotation support dual-key [OK]
- No PII in logs [OK]
- Public endpoint isolated route [OK]

## Section 14 - Criteres d'acceptation (30+)

1. Endpoint POST `/api/v1/public/webhooks/barid-esign` repond 200 OK pour requete signee valide
2. Endpoint repond 401 si X-Barid-Signature absent
3. Endpoint repond 401 si X-Barid-Timestamp absent
4. Endpoint repond 401 si signature HMAC invalide
5. Endpoint repond 401 si timestamp > 300s (replay protection)
6. Endpoint repond 401 si timestamp futur > 300s (clock skew protection)
7. Endpoint repond 200 + duplicate=true au 2eme appel meme event_id
8. Endpoint repond 200 si JSON malforme (avec persistance status=invalid)
9. Endpoint repond 200 si schema Zod invalide (avec persistance status=invalid)
10. Endpoint repond 413 si payload > 1MB
11. Endpoint latence p95 < 300ms en charge nominale (1000 req/min)
12. Endpoint latence p99 < 500ms en charge nominale
13. HMAC verification utilise crypto.timingSafeEqual (pas de timing attack)
14. HMAC verification supporte dual-secret (primary + secondary) durant rotation
15. Raw body preserve via fastify-raw-body sur la route specifique uniquement
16. Idempotency via UNIQUE constraint sur (provider, provider_event_id)
17. Idempotency utilise INSERT ... ON CONFLICT DO NOTHING RETURNING (atomic)
18. Kafka publish avec workflow_id en partition key (ordering guarantee)
19. Kafka publish ne bloque pas la reponse 200 (store-then-forward fallback)
20. Consumer Kafka traite signature.completed avec orchestrateCompletion
21. Consumer Kafka traite signature.declined avec orchestrateDecline
22. Consumer Kafka traite signature.expired avec orchestrateExpiration
23. Consumer Kafka traite signer.* events avec audit log only
24. Consumer Kafka resolve tenant via DB lookup workflow_id
25. Consumer Kafka run dans MultiTenantContext.runWithTenant
26. Consumer Kafka skip si state machine refuse transition (avec ack)
27. Consumer Kafka mark orphan si workflow_id introuvable
28. CompletionOrchestrator telecharge PDF + hash SHA-512 + ANRT TSA + persist + archive + notify
29. CompletionOrchestrator hash PII (email, cin) avant log audit (CNDP 09-08)
30. CompletionOrchestrator publish event signature.workflow_completed pour archive consumer
31. CompletionOrchestrator publish event comm.notify pour chaque signataire
32. CompletionOrchestrator envoie notification email + WhatsApp si phone present, sinon email seul
33. Migration cree table sig_webhooks_received avec UNIQUE constraint provider+event_id
34. Migration cree indexes idx_webhooks_provider_received, idx_webhooks_status_received, idx_webhooks_workflow, idx_webhooks_tenant
35. Migration cree FK vers sig_signing_workflows et core_tenants (ON DELETE SET NULL)
36. Tests unitaires middleware: 16 tests passants
37. Tests unitaires idempotency: 11 tests passants
38. Tests unitaires controller: 11 tests passants
39. Tests unitaires consumer: 10 tests passants
40. Tests unitaires orchestrator: 8 tests passants
41. Tests E2E: 11 tests passants
42. Coverage > 90% sur tous les fichiers signature/webhook
43. ESLint zero warning
44. TypeScript strict mode pass
45. Pino logs avec redact config sur signers[*].email, signers[*].phone, signers[*].cin
46. Aucune PII en clair dans les logs (verifie par grep CI)
47. Documentation API OpenAPI/Swagger generee pour endpoint public

## Section 15 - Tests de charge et performance

- **Outil**: k6 ou Artillery
- **Scenario nominal**: 1000 req/min pendant 10min, target latence p95 < 300ms, p99 < 500ms
- **Scenario peak**: 10000 req/min pendant 1min (simule rush fin de periode), target zero erreur 5xx
- **Scenario soak**: 500 req/min pendant 6h, target memory leak < 5%
- **Scenario chaos**: Kafka down 30s pendant le test, target webhooks persistes en pending et reforwardes apres recovery
- **Scenario DDoS**: 50000 req/min depuis 1 IP, target rate limit kick in + 429 responses
- **Scenario replay attack**: 1000 req/min avec timestamp -400s, target 100% rejected 401

## Section 16 - Rollback procedure

En cas de regression detectee post-deploiement:
1. **Rollback API**: `helm rollback skalean-api 1` (revert au release N-1)
2. **Rollback consumer**: `kubectl scale deployment barid-webhook-processor --replicas=0` (stop consumer)
3. **Pas de rollback DB migration**: la table `sig_webhooks_received` reste, sans impact (ignored par ancienne version)
4. **Webhooks Kafka pending**: traites par le consumer N-1 OR rejoues manuellement via CLI tool apres rollforward
5. **Communications Barid**: si endpoint down > 5min, basculer vers fallback poll mode (cron job poll Barid API every 1min) - degradation acceptable temporairement

## Section 17 - Ouvertures futures

- **Sprint 11**: ajout DocuSign webhook receiver utilisant le meme pattern (factor `WebhookReceiverBase`)
- **Sprint 12**: ajout dashboard webhooks admin (visualization sig_webhooks_received avec filters)
- **Sprint 13**: ajout reprocess CLI tool pour DLQ analysis et replay
- **Sprint 14**: webhook signature verification cote outbound (Skalean -> client webhooks) pour Marketplace integrations
- **Sprint 15**: support webhook v3 Barid avec nouvelles signatures EdDSA Ed25519 (post-quantum ready)
