# Task 1.2.5 - Migration "Communications" : 4 tables (messages, templates, opt-outs, webhooks_received) supportant WhatsApp + Email + SMS + Voice multilingue (fr / ar-MA / ar)

## 1. Header

- ID Tache : 1.2.5
- Sprint : Sprint 2 - Database & Kafka Foundation
- Phase : Phase 1 - Migrations TypeORM core domain
- Duree estimee : 5h (300 minutes effectifs developpement, hors meetings)
- Priorite : P0 (bloquant - sans Communications, Sprint 9 ne peut demarrer integration WhatsApp Cloud API + Email transactionnel + SMS Twilio + Voice IVR)
- Dependances strictes : Task 1.2.4 (Migration "Activities & Notes" avec activities_log, contact_notes, contact_tags) DOIT etre verte (CI green, criteres V1-V20 passes, migration deployee staging) AVANT demarrage 1.2.5
- Bloque : Task 1.2.6 (Migration "Documents & Files" - storage S3/MinIO, signed URLs), Task 1.2.7 (Migration "Audit Log & Compliance"), Sprint 9 entier (WhatsApp inbox + Email campaigns + SMS broadcast)
- Convention emoji : AUCUNE EMOJI dans ce document, dans les fichiers livres, dans les commits, dans les commentaires de code, dans les tests, dans les noms de variables, dans les chaines de caracteres rendues a l'utilisateur final. Tolerance zero. Ce document est en mode strict ASCII + accents francais conformement a decision-014 charte communication interne.
- Auteur tache : Lead Backend Architect Skalean
- Reviewer : CTO + Lead Compliance CNDP + Lead DevOps PostgreSQL
- Date emission : 2026-01-15
- Date butoir merge : J+5 ouvres apres merge 1.2.4

## 2. But (3 paragraphes)

### 2.1 Communications comme fondation 4 channels multilingue Maroc

La table `comm_messages` constitue le journal universel append-leaning de toutes les interactions sortantes (outbound : campagne, transactionnel, rappel echeance prime, RIB devis, lien paiement) et entrantes (inbound : reponse client WhatsApp, reply Email avec parsing In-Reply-To, SMS shortcode STOP, transcription Voice IVR) acheminees via les quatre canaux strategiques retenus pour le marche marocain : WhatsApp Cloud API (channel='whatsapp', provider='meta'), Email transactionnel (channel='email', provider='sendgrid' ou 'mailgun'), SMS A2P (channel='sms', provider='twilio' avec routing local Maroc Telecom / Inwi / Orange via aggregator), et Voice IVR + recording (channel='voice', provider='twilio'). Chaque message est ancre tenant (RLS), peut etre lie a un contact (NULL si broadcast multi-destinataires ou webhook entrant pas encore route), porte un body texte (subject NULL pour SMS et WhatsApp qui n'ont pas la notion d'objet), refere optionnellement un template (`template_id` FK vers `comm_templates`) avec ses `template_variables` (JSONB substituees a l'envoi), et trace son cycle de vie via `status` enum (pending -> queued -> sent -> delivered -> read -> failed) avec horodatages par etat (`sent_at`, `delivered_at`, `read_at`, `failed_at`) plus `fail_reason` text en cas d'echec. Le multilingue fr / ar-MA / ar (arabe marocain darija vs arabe litteraire MSA) est porte au niveau template (1 template = 1 langue, on cree donc 3 templates fr/ar-MA/ar par message-type metier) car Meta WhatsApp impose un `language` tag IETF BCP-47 par template approuve, et SendGrid Dynamic Templates reclament aussi un namespace par locale.

### 2.2 Opt-out granulaire par channel et conformite RGPD/CNDP

La table `comm_optouts` materialise le droit d'opposition (Loi 09-08 article 9 et RGPD article 21) avec une granularite **par contact x par channel** : un assure peut accepter Email transactionnel mais refuser SMS marketing, ou opter-out WhatsApp tout en restant joignable par Voice pour rappel d'echeance. Chaque ligne porte `contact_id` FK, `channel`, `optout_at` timestamp, `reason` texte libre optionnel (formulaire CNDP), et critique : `created_by_contact` boolean qui distingue (i) un opt-out legitime declenche par le contact lui-meme (clic lien unsubscribe Email RFC 8058 List-Unsubscribe-Post, message "STOP" SMS, bouton "Block business" WhatsApp, touche "0" IVR Voice) versus (ii) un opt-out administratif declenche par un agent Skalean (correction erreur, demande client par telephone, decision compliance). Cette distinction est exigee par CNDP pour audit : un opt-out admin doit etre justifie en `reason`, alors qu'un opt-out contact-initie est legalement opposable sans justification. Le service `CommSendService` MUST verifier l'absence d'opt-out actif `WHERE contact_id=$1 AND channel=$2 AND revoked_at IS NULL` AVANT toute insertion dans `comm_messages` (sauf categorie='transactional' qui est exemptee opt-out marketing par Loi 09-08 article 10-2 mais reste sujette a opt-out absolu si `created_by_contact=true ET reason='absolute_refusal'`).

### 2.3 Webhooks idempotency cross-providers

La table `comm_webhooks_received` est le receveur append-only de tous les callbacks providers : Meta WhatsApp (events `messages.delivered`, `messages.read`, `messages.failed`, `message_template_status_update`), Twilio SMS+Voice (status callbacks `delivered`, `failed`, `undelivered` + voice IVR `recording-complete`), SendGrid Event Webhook (events `delivered`, `open`, `click`, `bounce`, `dropped`, `unsubscribe`), Mailgun events (events `delivered`, `complained`, `unsubscribed`). Chaque payload brut est stocke en `payload` JSONB pour audit forensique 7 ans (CNDP + Loi assurance), avec `signature_valid` boolean pre-calcule (HMAC-SHA256 verification different par provider : Meta utilise header `X-Hub-Signature-256` avec `META_WA_APP_SECRET`, Twilio utilise header `X-Twilio-Signature` avec `TWILIO_AUTH_TOKEN`, SendGrid utilise headers `X-Twilio-Email-Event-Webhook-Signature` + `X-Twilio-Email-Event-Webhook-Timestamp` ECDSA, Mailgun utilise HMAC-SHA256 sur timestamp+token+signature avec `MAILGUN_SIGNING_KEY`). Le champ `idempotency_key` UNIQUE NOT NULL est la cle de deduplication cross-tenant (tenant_id peut etre NULL pour un webhook public pas encore route vers un tenant : on identifie le tenant a partir du `provider_message_id` croise avec `comm_messages.provider_message_id`). Le pattern `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING id` garantit qu'un retry provider (Meta retry 3x avec exponential backoff 5s/30s/5min) ne cree pas de double-traitement. Le `processed_status` enum trace le cycle (pending -> success | duplicate | invalid_signature | error).

## 3. Contexte etendu

### 3.1 Pourquoi WhatsApp Meta templates pre-approved workflow

WhatsApp Cloud API distingue deux types de messages outbound : (a) **session messages** envoyes dans la fenetre de 24h apres le dernier inbound contact, autorisant texte libre, et (b) **template messages** envoyes hors fenetre 24h, qui DOIVENT utiliser un template **pre-approuve par Meta** dans la categorie `MARKETING` / `UTILITY` / `AUTHENTICATION` avec un `language` tag specifique (Meta ne supporte pas `fr-MA`, on doit utiliser `fr` generique ; Meta supporte `ar` (arabe litteraire) mais PAS `ar-MA` (darija) - on doit donc cataloguer les templates Skalean Maroc soit en `fr` soit en `ar`). Le workflow de validation Meta dure 1-24h (parfois 48h pendant peak), et un template peut etre `rejected` pour raisons : promesse irrealiste ("garanti 100%"), placeholders mal positionnes (`{{1}}` au debut absolu d'une phrase est interdit en categorie MARKETING), absence de bouton CTA pour categorie UTILITY, langue divergente du tag declare. La table `comm_templates` materialise ce cycle via `meta_template_name` (le nom EXACT enregistre cote Meta Business Manager, qui doit matcher `^[a-z0-9_]{1,512}$`) et `meta_template_status` enum (draft -> pending_review -> approved -> rejected) avec un job nightly `MetaTemplateSyncJob` qui pull l'API Meta Graph `/v18.0/{waba_id}/message_templates` pour reconciler le status (Sprint 9.4).

### 3.2 Alternative architecturale rejetee : table unique `comm_events` polymorphe vs split par channel

Une alternative envisagee etait d'eclater en 4 tables physiques : `wa_messages`, `email_messages`, `sms_messages`, `voice_messages`, chacune avec son schema specifique optimise (par exemple `email_messages` aurait `cc_addresses` text[], `bcc_addresses` text[], `reply_to`, `headers_raw` jsonb, `attachments_count`, `email_message_id_rfc822`, alors que `wa_messages` aurait `wa_phone_number_id`, `interactive_payload` jsonb pour boutons, `media_id` pour image/audio/video/document Meta CDN ; `sms_messages` aurait `segments_count` int car SMS est facture par segment de 160 chars GSM-7 / 70 chars UCS-2 unicode arabe ; `voice_messages` aurait `recording_url`, `recording_duration_seconds`, `transcript` text, `dtmf_keys` text). **Decision DEC-COMM-002 retenue** : table unique `comm_messages` polymorphe avec channel discriminator + colonnes optionnelles + un complement `comm_messages_meta` JSONB pour les attributs channel-specifiques. Justification : (1) requetes cross-channel timeline contact `SELECT * FROM comm_messages WHERE contact_id=$1 ORDER BY created_at DESC` triviales (pas de UNION ALL 4-way couteux), (2) reporting metier "tous messages tenant X cette semaine" simple, (3) RLS uniforme sur 1 table, (4) le volume Sprint 9-12 reste sous 50M lignes/an/tenant avec partitioning par range `created_at` annuel prevu Sprint 25. Trade-off accepte : quelques colonnes NULL sur certains channels (`subject` NULL pour SMS/WA/Voice ; `from_address` peut etre tenant_default pour Email mais explicite pour WA business phone number).

### 3.3 Trade-offs JSONB schema drift

Les colonnes `template_variables` JSONB et `comm_webhooks_received.payload` JSONB sont des "trous noirs" potentiels de schema drift (chaque dev ajoute une cle). Mitigation : (1) le `comm_templates.variables_schema` JSONB declare le contrat JSON Schema draft-07 des variables attendues (ex: `{"type":"object","properties":{"contact_first_name":{"type":"string"},"echeance_date":{"type":"string","format":"date"}},"required":["contact_first_name","echeance_date"]}`), valide cote API Nest avec `ajv` AVANT insertion. (2) Les `payload` webhooks restent volontairement non-typees (impossibles a contraindre, providers cassent leur format sans preavis : Meta a change le format des `interactive` callbacks 3 fois en 2024-2025) - on garde `payload` JSONB brut + extraction des champs critiques (`event_type`, `provider_message_id`) au moment du parse pour indexer en colonnes typees.

### 3.4 Decisions architecturales referencees

- **decision-002-postgresql-rls-multitenant.md** : RLS active sur `comm_messages`, `comm_templates`, `comm_optouts` via policy `tenant_isolation USING (tenant_id = current_setting('app.tenant_id')::uuid)`. La table `comm_webhooks_received` est volontairement HORS RLS (tenant_id peut etre NULL le temps du routage) avec acces restreint role applicatif `webhook_ingestor` distinct du role `app_runtime`.
- **decision-003-typeorm-migrations-strict.md** : migration 1735000000004 timestamp Unix milliseconds, naming `<timestamp>-Communications.ts`, classe `Communications1735000000004 implements MigrationInterface`, methodes `up()` et `down()` symetriques, AUCUN `synchronize:true`, AUCUNE generation auto, ecriture manuelle SQL via `queryRunner.query(...)`.
- **decision-008-multilingue-fr-ar-darija.md** : tag IETF BCP-47 `fr` (francais general), `ar-MA` (arabe Maroc darija), `ar` (arabe litteraire MSA). MAIS Meta WhatsApp templates ne supporte que `fr` et `ar` -> mapping `ar-MA` UI -> `ar` Meta pour les templates WA outbound, conserve `ar-MA` en interne pour Email/SMS qui supportent l'identifier libre.
- **decision-014-charte-comm-interne-no-emoji.md** : zero emoji.
- **decision-019-cndp-rgpd-retention.md** : retention `comm_messages` = 5 ans glissants depuis `created_at` (purge job mensuel), retention `comm_webhooks_received` = 7 ans (audit forensique sinistres assurance), retention `comm_optouts` = ILLIMITEE (un opt-out est definitif sauf revocation explicite contact tracee `revoked_at`).
- **decision-021-idempotency-webhooks.md** : `idempotency_key` format `<provider>:<provider_event_id>` ex `meta:wamid.HBgL...`, `twilio:SMxxxx`, `sendgrid:evt-uuid`, `mailgun:msg-id-token`. UNIQUE INDEX sur cette colonne. Retry safety guaranteed.

### 3.5 Pieges identifies (a NE PAS reproduire des projets anterieurs Skalean v1)

- **Piege-1 (Meta language tag)** : v1 codait `fr-MA` en dur dans les templates, Meta retournait erreur `(#100) The parameter 'language.code' is invalid` silencieuse, les messages partaient en queue infinie. CORRECTIF : enum `comm_templates.language` accepte les 3 valeurs internes, mais la couche `MetaTemplateAdapter` MUST mapper `ar-MA` -> `ar` et `fr` -> `fr` AVANT envoi Meta API.
- **Piege-2 (idempotency_key duplicate cross-tenant)** : un webhook Meta peut etre legitimement recu pour 2 tenants differents si Skalean opere plusieurs WABA business accounts (multi-WABA Sprint 18). UNIQUE INDEX simple (idempotency_key) creerait un faux conflit. CORRECTIF : `idempotency_key` inclut le `provider` ET le `tenant_id` resolu si dispo (`<provider>:<tenant_or_global>:<provider_event_id>`), UNIQUE INDEX (idempotency_key) reste mais discriminant suffisant.
- **Piege-3 (Signature HMAC Meta vs Twilio)** : Meta signe `sha256=<hex>` du raw body avec App Secret. Twilio signe `<base64>` du URL+sorted_params concatenated avec Auth Token. Confusion -> v1 verifiait Twilio avec algo Meta -> 100% rejets. CORRECTIF : strategy pattern `WebhookSignatureVerifier` une implementation par provider, tests unitaires obligatoires `verifyMeta()`, `verifyTwilio()`, `verifySendgrid()`, `verifyMailgun()`.
- **Piege-4 (opt-out RGPD CNDP duree retention indefinie)** : on ne supprime JAMAIS un opt-out (sinon un re-import contact ecraserait sa decision passee). On garde meme apres suppression du contact (`contact_id` reste reference orpheline acceptee, ou `ON DELETE SET NULL` + colonne `contact_email_at_optout` snapshot).
- **Piege-5 (phone E.164 normalisation)** : Maroc accepte 4 formats utilisateur (`0612345678`, `+212612345678`, `00212612345678`, `212612345678`). DB MUST stocker UNIQUEMENT format E.164 strict `+212XXXXXXXXX` (12 chars total). Validation Zod regex `/^\+212[5-7]\d{8}$/` (5xx fixe, 6xx/7xx mobile). Util `normalizeMaPhone(input: string): string | null` gere les 4 formats input.
- **Piege-6 (broadcast NULL contact_id)** : un message broadcast (campagne Email a 5000 contacts) cree 5000 lignes `comm_messages` chacune avec son `contact_id` non NULL. La valeur NULL est UNIQUEMENT pour les messages systeme tenant-wide (annonce maintenance) ou pour un webhook inbound non encore route vers un contact (numero inconnu).
- **Piege-7 (Meta WA template body 1024 chars limite)** : depasser fait reject silencieux. Validation Zod `z.string().max(1024)` cote `comm_templates.body_template`.
- **Piege-8 (Email subject_template max 998 chars RFC 5322)** : depasser provoque truncation cote SMTP server. Validation `z.string().max(998)`.
- **Piege-9 (SMS UCS-2 segments arabe)** : un SMS arabe Maroc utilise encodage UCS-2 (70 chars/segment) versus GSM-7 (160 chars/segment latin). Un body 200 chars en `ar-MA` = 3 segments (3x facture). Le service doit pre-calculer `segments_count` et alerter si > 6 segments (cout > 0.30 MAD).
- **Piege-10 (timezone Africa/Casablanca DST)** : Maroc a un horaire ramadan special, les timestamps `sent_at` MUST etre stockes UTC, conversion locale uniquement en presentation. JAMAIS de `TIMESTAMP WITHOUT TIME ZONE`, toujours `TIMESTAMPTZ`.
- **Piege-11 (Voice recording_url presigned expiration)** : Twilio fournit URL presignee 1h. On doit downloader vers MinIO interne sous 1h sinon perdu. Pattern : webhook `recording-complete` -> job Bull `DownloadRecordingJob` priority high.
- **Piege-12 (template_variables type strict)** : si un placeholder `{{amount}}` recoit `null` ou `undefined` au render, le message expedie litteralement la chaine "null" au client (catastrophe). CORRECTIF : helper `renderTemplate()` lance exception si variable manquante OU si type ne matche pas le `variables_schema`.

### 3.6 Volume previsionnel et capacity planning

Estimation Sprint 9 GA (3 mois apres release) sur 50 tenants pilotes :
- `comm_messages` : 200 msg/jour/tenant en moyenne (mix outbound rappels + inbound replies) x 50 tenants x 90 jours = 900 000 lignes. Annuel : ~3.6M lignes. Index (tenant_id, channel, status, sent_at DESC) reste performant jusqu'a 50M lignes (BRIN possible Sprint 25).
- `comm_templates` : ~30 templates par tenant x 50 = 1500 lignes. Statique.
- `comm_optouts` : 5% taux opt-out = 5000-10000 lignes total Sprint 9.
- `comm_webhooks_received` : 3x volume `comm_messages` (chaque outbound genere 1-3 webhooks delivery+read+click) = ~10M lignes/an. Partitioning Sprint 25 par mois.

## 4. Architecture context

Cette tache est la **5eme migration core domain** du Sprint 2 phase 1. Sequence :
- 1.2.1 Tenants & Users (deja merge)
- 1.2.2 Contacts (deja merge)
- 1.2.3 Policies & Quotes (deja merge)
- 1.2.4 Activities & Notes (en cours QA, prerequis 1.2.5)
- **1.2.5 Communications (presente tache)**
- 1.2.6 Documents & Files (suivante)
- 1.2.7 Audit Log & Compliance (clot phase 1)

Les tables `comm_*` sont la **fondation Sprint 9** (Communications module, 4 features) :
- 9.1 WhatsApp inbox unifiee (operator inbox + auto-routing par tag)
- 9.2 Email campaigns + transactionnel
- 9.3 SMS broadcast + alertes echeance
- 9.4 Voice IVR rappel impaye

Egalement consommees Sprint 12 (Marketing Automation triggers), Sprint 18 (Multi-WABA), Sprint 21 (Customer Journey Analytics), Sprint 30 (Voice ASR + sentiment).

Architecture deploiement : ces tables vivent dans le schema `public` de la database `skalean_core`, accessibles par les microservices `comm-svc` (read+write), `inbox-svc` (read+write), `marketing-svc` (write outbound), `webhook-ingestor-svc` (write `comm_webhooks_received` uniquement, role distinct).

## 5. Livrables (28 livrables)

1. Fichier migration `apps/api/src/database/migrations/1735000000004-Communications.ts` ~180 lignes
2. Entite TypeORM `apps/api/src/modules/comm/entities/comm-message.entity.ts` ~70 lignes
3. Entite TypeORM `apps/api/src/modules/comm/entities/comm-template.entity.ts` ~55 lignes
4. Entite TypeORM `apps/api/src/modules/comm/entities/comm-optout.entity.ts` ~30 lignes
5. Entite TypeORM `apps/api/src/modules/comm/entities/comm-webhook-received.entity.ts` ~40 lignes
6. Barrel export `apps/api/src/modules/comm/index.ts`
7. Helper `apps/api/src/modules/comm/utils/render-template.util.ts` (fonction `renderTemplate()` Mustache-like)
8. Helper `apps/api/src/modules/comm/utils/normalize-ma-phone.util.ts` (E.164 strict +212)
9. Schemas Zod `packages/shared-types/src/comm/comm-message.schema.ts`
10. Schemas Zod `packages/shared-types/src/comm/comm-template.schema.ts`
11. Schemas Zod `packages/shared-types/src/comm/comm-optout.schema.ts`
12. Schemas Zod `packages/shared-types/src/comm/comm-webhook.schema.ts`
13. Barrel `packages/shared-types/src/comm/index.ts`
14. Tests `apps/api/test/database/migrations-communications.spec.ts` (>=6 tests structurels)
15. Tests `apps/api/test/database/rls-comm.spec.ts` (>=6 tests RLS cross-tenant)
16. Tests `apps/api/test/database/idempotency.spec.ts` (>=5 tests UNIQUE idempotency_key)
17. Tests `apps/api/test/comm/templates-render.spec.ts` (>=4 tests render placeholders)
18. Tests `apps/api/test/comm/opt-out.spec.ts` (>=4 tests granularite per-channel)
19. Tests `apps/api/test/comm/normalize-ma-phone.spec.ts` (>=8 tests phone formats)
20. Mise a jour `apps/api/src/database/data-source.ts` (registration entites)
21. Mise a jour `apps/api/src/app.module.ts` (`TypeOrmModule.forFeature([CommMessageEntity, CommTemplateEntity, CommOptoutEntity, CommWebhookReceivedEntity])`)
22. Documentation interne `docs/database/comm-tables.md` (schema + diagramme + retention policy)
23. Mise a jour `apps/api/src/database/seeds/dev-seed.ts` (1 template fr + 1 template ar par tenant demo)
24. Mise a jour `.env.example` avec >=18 variables nouvelles (cf. section 9)
25. Mise a jour `apps/api/src/database/sql/rls-policies.sql` (3 nouvelles policies)
26. Mise a jour `apps/api/src/database/sql/indexes.sql` (4 nouveaux indexes documentes)
27. Mise a jour `CHANGELOG.md` entry sprint-2 phase-1 task-1.2.5
28. Diagramme Mermaid `docs/database/comm-erd.mmd` ER diagram 4 tables + relations FK vers contacts/tenants

## 6. Fichiers (paths absolus + arborescence)

```
apps/api/src/database/migrations/
  1735000000004-Communications.ts                          [180 lignes, NOUVEAU]
  1735000000003-ActivitiesNotes.ts                         [DEJA EXISTANT, prerequis]

apps/api/src/modules/comm/
  index.ts                                                 [NOUVEAU, barrel]
  entities/
    comm-message.entity.ts                                 [NOUVEAU]
    comm-template.entity.ts                                [NOUVEAU]
    comm-optout.entity.ts                                  [NOUVEAU]
    comm-webhook-received.entity.ts                        [NOUVEAU]
  utils/
    render-template.util.ts                                [NOUVEAU]
    normalize-ma-phone.util.ts                             [NOUVEAU]

packages/shared-types/src/comm/
  index.ts                                                 [NOUVEAU]
  comm-message.schema.ts                                   [NOUVEAU]
  comm-template.schema.ts                                  [NOUVEAU]
  comm-optout.schema.ts                                    [NOUVEAU]
  comm-webhook.schema.ts                                   [NOUVEAU]

apps/api/test/database/
  migrations-communications.spec.ts                        [NOUVEAU]
  rls-comm.spec.ts                                         [NOUVEAU]
  idempotency.spec.ts                                      [NOUVEAU]

apps/api/test/comm/
  templates-render.spec.ts                                 [NOUVEAU]
  opt-out.spec.ts                                          [NOUVEAU]
  normalize-ma-phone.spec.ts                               [NOUVEAU]

apps/api/src/database/sql/
  rls-policies.sql                                         [MODIFIE, +3 policies]
  indexes.sql                                              [MODIFIE, +4 indexes]

docs/database/
  comm-tables.md                                           [NOUVEAU]
  comm-erd.mmd                                             [NOUVEAU]

CHANGELOG.md                                               [MODIFIE]
.env.example                                               [MODIFIE, +18 vars]
```

## 7. Code patterns COMPLETS

### 7.1 Migration `1735000000004-Communications.ts` (COMPLET)

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Communications1735000000004 implements MigrationInterface {
  name = 'Communications1735000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ============================================================
    // ENUMS POSTGRESQL
    // ============================================================
    await queryRunner.query(`
      CREATE TYPE comm_channel_enum AS ENUM ('whatsapp', 'email', 'sms', 'voice');
    `);
    await queryRunner.query(`
      CREATE TYPE comm_direction_enum AS ENUM ('inbound', 'outbound');
    `);
    await queryRunner.query(`
      CREATE TYPE comm_status_enum AS ENUM (
        'pending', 'queued', 'sent', 'delivered', 'read', 'failed'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE comm_provider_enum AS ENUM ('meta', 'twilio', 'sendgrid', 'mailgun');
    `);
    await queryRunner.query(`
      CREATE TYPE comm_template_category_enum AS ENUM (
        'marketing', 'transactional', 'reminder'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE comm_language_enum AS ENUM ('fr', 'ar-MA', 'ar');
    `);
    await queryRunner.query(`
      CREATE TYPE comm_meta_template_status_enum AS ENUM (
        'draft', 'pending_review', 'approved', 'rejected'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE comm_webhook_processed_status_enum AS ENUM (
        'pending', 'success', 'duplicate', 'invalid_signature', 'error'
      );
    `);

    // ============================================================
    // TABLE comm_templates (creee en premier car comm_messages reference template_id)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE comm_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        channel comm_channel_enum NOT NULL,
        category comm_template_category_enum NOT NULL,
        language comm_language_enum NOT NULL,
        subject_template VARCHAR(998),
        body_template TEXT NOT NULL CHECK (char_length(body_template) <= 4096),
        variables_schema JSONB NOT NULL DEFAULT '{"type":"object","properties":{},"required":[]}'::jsonb,
        meta_template_name VARCHAR(512) CHECK (
          meta_template_name IS NULL OR meta_template_name ~ '^[a-z0-9_]{1,512}$'
        ),
        meta_template_status comm_meta_template_status_enum NOT NULL DEFAULT 'draft',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT comm_templates_subject_required_when_email CHECK (
          (channel <> 'email') OR (subject_template IS NOT NULL)
        ),
        CONSTRAINT comm_templates_meta_required_when_wa_approved CHECK (
          (channel <> 'whatsapp')
          OR (meta_template_status <> 'approved')
          OR (meta_template_name IS NOT NULL)
        )
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_comm_templates_tenant_name_lang
        ON comm_templates (tenant_id, name, language)
        WHERE active = TRUE;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_templates_tenant_channel
        ON comm_templates (tenant_id, channel, active);
    `);

    // ============================================================
    // TABLE comm_messages
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE comm_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
        channel comm_channel_enum NOT NULL,
        direction comm_direction_enum NOT NULL,
        to_address VARCHAR(320) NOT NULL,
        from_address VARCHAR(320) NOT NULL,
        subject VARCHAR(998),
        body TEXT NOT NULL,
        template_id UUID REFERENCES comm_templates(id) ON DELETE SET NULL,
        template_variables JSONB NOT NULL DEFAULT '{}'::jsonb,
        status comm_status_enum NOT NULL DEFAULT 'pending',
        provider comm_provider_enum NOT NULL,
        provider_message_id VARCHAR(255),
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        read_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        fail_reason TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT comm_messages_subject_only_email CHECK (
          (channel = 'email') OR (subject IS NULL)
        ),
        CONSTRAINT comm_messages_to_address_format CHECK (
          (channel = 'email' AND to_address ~ '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')
          OR (channel IN ('whatsapp', 'sms', 'voice') AND to_address ~ '^\\+\\d{8,15}$')
        ),
        CONSTRAINT comm_messages_failed_requires_reason CHECK (
          (status <> 'failed') OR (fail_reason IS NOT NULL)
        ),
        CONSTRAINT comm_messages_status_timestamp_consistency CHECK (
          (status NOT IN ('sent','delivered','read') OR sent_at IS NOT NULL)
        )
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_messages_tenant_channel_status_sent
        ON comm_messages (tenant_id, channel, status, sent_at DESC NULLS LAST);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_messages_tenant_contact_created
        ON comm_messages (tenant_id, contact_id, created_at DESC)
        WHERE contact_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_messages_provider_msgid
        ON comm_messages (provider, provider_message_id)
        WHERE provider_message_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_messages_tenant_template
        ON comm_messages (tenant_id, template_id)
        WHERE template_id IS NOT NULL;
    `);

    // ============================================================
    // TABLE comm_optouts
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE comm_optouts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
        channel comm_channel_enum NOT NULL,
        optout_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        reason TEXT,
        created_by_contact BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT comm_optouts_admin_requires_reason CHECK (
          created_by_contact = TRUE OR (reason IS NOT NULL AND char_length(reason) > 0)
        )
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_comm_optouts_tenant_contact_channel_active
        ON comm_optouts (tenant_id, contact_id, channel)
        WHERE revoked_at IS NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_optouts_tenant_contact
        ON comm_optouts (tenant_id, contact_id);
    `);

    // ============================================================
    // TABLE comm_webhooks_received (HORS RLS, role webhook_ingestor)
    // ============================================================
    await queryRunner.query(`
      CREATE TABLE comm_webhooks_received (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
        provider comm_provider_enum NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        payload JSONB NOT NULL,
        signature_valid BOOLEAN NOT NULL,
        processed_at TIMESTAMPTZ,
        processed_status comm_webhook_processed_status_enum NOT NULL DEFAULT 'pending',
        idempotency_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_comm_webhooks_idempotency_key
        ON comm_webhooks_received (idempotency_key);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_webhooks_provider_event
        ON comm_webhooks_received (provider, event_type, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_comm_webhooks_processed_status
        ON comm_webhooks_received (processed_status, created_at)
        WHERE processed_status IN ('pending','error');
    `);

    // ============================================================
    // RLS sur 3 tables (comm_messages, comm_templates, comm_optouts)
    // ============================================================
    await queryRunner.query(`ALTER TABLE comm_messages ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE comm_messages FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_comm_messages ON comm_messages
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    `);

    await queryRunner.query(`ALTER TABLE comm_templates ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE comm_templates FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_comm_templates ON comm_templates
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    `);

    await queryRunner.query(`ALTER TABLE comm_optouts ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE comm_optouts FORCE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_comm_optouts ON comm_optouts
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
    `);

    // comm_webhooks_received : PAS de RLS (tenant_id NULL au moment ingestion)
    // Acces restreint au role webhook_ingestor + service comm-svc
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE ON comm_webhooks_received TO webhook_ingestor;
    `);
    await queryRunner.query(`
      GRANT SELECT ON comm_webhooks_received TO app_runtime;
    `);

    // ============================================================
    // TRIGGERS updated_at auto
    // ============================================================
    await queryRunner.query(`
      CREATE TRIGGER trg_comm_messages_updated_at
        BEFORE UPDATE ON comm_messages
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_comm_templates_updated_at
        BEFORE UPDATE ON comm_templates
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_comm_optouts_updated_at
        BEFORE UPDATE ON comm_optouts
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);

    // ============================================================
    // COMMENTAIRES (audit + doc inline)
    // ============================================================
    await queryRunner.query(`
      COMMENT ON TABLE comm_messages IS 'Journal universel messages 4 channels (WA/Email/SMS/Voice). RLS active. Retention 5 ans (decision-019).';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE comm_templates IS 'Templates pre-approuves multilingue fr/ar-MA/ar. Meta WA workflow approval (decision-008).';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE comm_optouts IS 'Opt-out granulaire per-channel. RGPD art.21 + Loi 09-08 art.9. Retention illimitee (decision-019).';
    `);
    await queryRunner.query(`
      COMMENT ON TABLE comm_webhooks_received IS 'Webhooks providers append-only. Idempotency cross-providers. Retention 7 ans audit (decision-021).';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_comm_optouts_updated_at ON comm_optouts;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_comm_templates_updated_at ON comm_templates;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_comm_messages_updated_at ON comm_messages;`);

    await queryRunner.query(`DROP TABLE IF EXISTS comm_webhooks_received;`);
    await queryRunner.query(`DROP TABLE IF EXISTS comm_optouts;`);
    await queryRunner.query(`DROP TABLE IF EXISTS comm_messages;`);
    await queryRunner.query(`DROP TABLE IF EXISTS comm_templates;`);

    await queryRunner.query(`DROP TYPE IF EXISTS comm_webhook_processed_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_meta_template_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_language_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_template_category_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_provider_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_status_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_direction_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS comm_channel_enum;`);
  }
}
```

### 7.2 Entite `comm-message.entity.ts` (COMPLET)

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { ContactEntity } from '../../contacts/entities/contact.entity';
import { CommTemplateEntity } from './comm-template.entity';

export type CommChannel = 'whatsapp' | 'email' | 'sms' | 'voice';
export type CommDirection = 'inbound' | 'outbound';
export type CommStatus = 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
export type CommProvider = 'meta' | 'twilio' | 'sendgrid' | 'mailgun';

@Entity({ name: 'comm_messages' })
@Index('idx_comm_messages_tenant_channel_status_sent', ['tenantId', 'channel', 'status', 'sentAt'])
@Index('idx_comm_messages_tenant_contact_created', ['tenantId', 'contactId', 'createdAt'])
export class CommMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @Column({ name: 'contact_id', type: 'uuid', nullable: true })
  contactId!: string | null;

  @ManyToOne(() => ContactEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact?: ContactEntity | null;

  @Column({ type: 'enum', enum: ['whatsapp', 'email', 'sms', 'voice'], enumName: 'comm_channel_enum' })
  channel!: CommChannel;

  @Column({ type: 'enum', enum: ['inbound', 'outbound'], enumName: 'comm_direction_enum' })
  direction!: CommDirection;

  @Column({ name: 'to_address', type: 'varchar', length: 320 })
  toAddress!: string;

  @Column({ name: 'from_address', type: 'varchar', length: 320 })
  fromAddress!: string;

  @Column({ type: 'varchar', length: 998, nullable: true })
  subject!: string | null;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId!: string | null;

  @ManyToOne(() => CommTemplateEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'template_id' })
  template?: CommTemplateEntity | null;

  @Column({ name: 'template_variables', type: 'jsonb', default: () => `'{}'::jsonb` })
  templateVariables!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: ['pending', 'queued', 'sent', 'delivered', 'read', 'failed'],
    enumName: 'comm_status_enum',
    default: 'pending',
  })
  status!: CommStatus;

  @Column({ type: 'enum', enum: ['meta', 'twilio', 'sendgrid', 'mailgun'], enumName: 'comm_provider_enum' })
  provider!: CommProvider;

  @Column({ name: 'provider_message_id', type: 'varchar', length: 255, nullable: true })
  providerMessageId!: string | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt!: Date | null;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  failReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 7.3 Entite `comm-template.entity.ts` (COMPLET)

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { CommChannel } from './comm-message.entity';

export type CommTemplateCategory = 'marketing' | 'transactional' | 'reminder';
export type CommLanguage = 'fr' | 'ar-MA' | 'ar';
export type CommMetaTemplateStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface VariablesSchema {
  type: 'object';
  properties: Record<string, { type: string; format?: string; description?: string }>;
  required: string[];
}

@Entity({ name: 'comm_templates' })
@Index('idx_comm_templates_tenant_channel', ['tenantId', 'channel', 'active'])
export class CommTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'enum', enum: ['whatsapp', 'email', 'sms', 'voice'], enumName: 'comm_channel_enum' })
  channel!: CommChannel;

  @Column({ type: 'enum', enum: ['marketing', 'transactional', 'reminder'], enumName: 'comm_template_category_enum' })
  category!: CommTemplateCategory;

  @Column({ type: 'enum', enum: ['fr', 'ar-MA', 'ar'], enumName: 'comm_language_enum' })
  language!: CommLanguage;

  @Column({ name: 'subject_template', type: 'varchar', length: 998, nullable: true })
  subjectTemplate!: string | null;

  @Column({ name: 'body_template', type: 'text' })
  bodyTemplate!: string;

  @Column({ name: 'variables_schema', type: 'jsonb' })
  variablesSchema!: VariablesSchema;

  @Column({ name: 'meta_template_name', type: 'varchar', length: 512, nullable: true })
  metaTemplateName!: string | null;

  @Column({
    name: 'meta_template_status',
    type: 'enum',
    enum: ['draft', 'pending_review', 'approved', 'rejected'],
    enumName: 'comm_meta_template_status_enum',
    default: 'draft',
  })
  metaTemplateStatus!: CommMetaTemplateStatus;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 7.4 Entite `comm-optout.entity.ts` (COMPLET)

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { ContactEntity } from '../../contacts/entities/contact.entity';
import { CommChannel } from './comm-message.entity';

@Entity({ name: 'comm_optouts' })
@Index('idx_comm_optouts_tenant_contact', ['tenantId', 'contactId'])
export class CommOptoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @Column({ name: 'contact_id', type: 'uuid' })
  contactId!: string;

  @ManyToOne(() => ContactEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact?: ContactEntity;

  @Column({ type: 'enum', enum: ['whatsapp', 'email', 'sms', 'voice'], enumName: 'comm_channel_enum' })
  channel!: CommChannel;

  @Column({ name: 'optout_at', type: 'timestamptz', default: () => 'NOW()' })
  optoutAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'created_by_contact', type: 'boolean' })
  createdByContact!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 7.5 Entite `comm-webhook-received.entity.ts` (COMPLET)

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { TenantEntity } from '../../tenants/entities/tenant.entity';
import { CommProvider } from './comm-message.entity';

export type CommWebhookProcessedStatus =
  | 'pending'
  | 'success'
  | 'duplicate'
  | 'invalid_signature'
  | 'error';

@Entity({ name: 'comm_webhooks_received' })
@Index('idx_comm_webhooks_provider_event', ['provider', 'eventType', 'createdAt'])
export class CommWebhookReceivedEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @ManyToOne(() => TenantEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity | null;

  @Column({ type: 'enum', enum: ['meta', 'twilio', 'sendgrid', 'mailgun'], enumName: 'comm_provider_enum' })
  provider!: CommProvider;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'signature_valid', type: 'boolean' })
  signatureValid!: boolean;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({
    name: 'processed_status',
    type: 'enum',
    enum: ['pending', 'success', 'duplicate', 'invalid_signature', 'error'],
    enumName: 'comm_webhook_processed_status_enum',
    default: 'pending',
  })
  processedStatus!: CommWebhookProcessedStatus;

  @Column({ name: 'idempotency_key', type: 'text', unique: true })
  idempotencyKey!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

### 7.6 Helper `render-template.util.ts` (COMPLET)

```typescript
import Ajv, { JSONSchemaType } from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const PLACEHOLDER_REGEX = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export interface RenderResult {
  rendered: string;
  missing: string[];
  used: string[];
}

export class TemplateRenderError extends Error {
  constructor(
    message: string,
    public readonly missing: string[],
    public readonly schemaErrors: string[],
  ) {
    super(message);
    this.name = 'TemplateRenderError';
  }
}

/**
 * Escape HTML pour eviter XSS si template Email rendu en HTML.
 * Pour SMS/WA/Voice, le caller doit demander escapeHtml=false.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderTemplate(
  bodyTemplate: string,
  variables: Record<string, unknown>,
  options: {
    variablesSchema?: object;
    escapeHtml?: boolean;
    strict?: boolean;
  } = {},
): RenderResult {
  const { variablesSchema, escapeHtml: doEscape = false, strict = true } = options;

  if (variablesSchema) {
    const validate = ajv.compile(variablesSchema as JSONSchemaType<unknown>);
    const valid = validate(variables);
    if (!valid) {
      const errors = (validate.errors ?? []).map(
        (e) => `${e.instancePath} ${e.message}`,
      );
      throw new TemplateRenderError(
        'variables_schema validation failed',
        [],
        errors,
      );
    }
  }

  const used: string[] = [];
  const missing: string[] = [];

  const rendered = bodyTemplate.replace(PLACEHOLDER_REGEX, (_match, key: string) => {
    if (!(key in variables)) {
      missing.push(key);
      if (strict) {
        return _match;
      }
      return '';
    }
    const raw = variables[key];
    if (raw === null || raw === undefined) {
      missing.push(key);
      if (strict) {
        return _match;
      }
      return '';
    }
    used.push(key);
    const str = typeof raw === 'string' ? raw : String(raw);
    return doEscape ? escapeHtml(str) : str;
  });

  if (strict && missing.length > 0) {
    throw new TemplateRenderError(
      `Missing variables: ${missing.join(', ')}`,
      missing,
      [],
    );
  }

  return { rendered, missing, used };
}
```

### 7.7 Helper `normalize-ma-phone.util.ts` (COMPLET)

```typescript
const MA_E164_STRICT = /^\+212[5-7]\d{8}$/;

export function normalizeMaPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.replace(/[\s\-\.\(\)]/g, '');
  if (cleaned.length === 0) return null;

  // Format +212XXXXXXXXX
  if (cleaned.startsWith('+212')) {
    return MA_E164_STRICT.test(cleaned) ? cleaned : null;
  }
  // Format 00212XXXXXXXXX
  if (cleaned.startsWith('00212')) {
    const candidate = '+' + cleaned.substring(2);
    return MA_E164_STRICT.test(candidate) ? candidate : null;
  }
  // Format 212XXXXXXXXX (sans +)
  if (cleaned.startsWith('212') && cleaned.length === 12) {
    const candidate = '+' + cleaned;
    return MA_E164_STRICT.test(candidate) ? candidate : null;
  }
  // Format 0XXXXXXXXX (national)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    const candidate = '+212' + cleaned.substring(1);
    return MA_E164_STRICT.test(candidate) ? candidate : null;
  }
  return null;
}

export function isValidMaPhone(input: string): boolean {
  return MA_E164_STRICT.test(input);
}
```

### 7.8 Schema Zod preview `comm-message.schema.ts` (shared-types)

```typescript
import { z } from 'zod';

export const CommChannelSchema = z.enum(['whatsapp', 'email', 'sms', 'voice']);
export const CommDirectionSchema = z.enum(['inbound', 'outbound']);
export const CommStatusSchema = z.enum([
  'pending',
  'queued',
  'sent',
  'delivered',
  'read',
  'failed',
]);
export const CommProviderSchema = z.enum(['meta', 'twilio', 'sendgrid', 'mailgun']);
export const CommLanguageSchema = z.enum(['fr', 'ar-MA', 'ar']);

const E164_REGEX = /^\+\d{8,15}$/;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const CommMessageCreateSchema = z
  .object({
    tenantId: z.string().uuid(),
    contactId: z.string().uuid().nullable(),
    channel: CommChannelSchema,
    direction: CommDirectionSchema,
    toAddress: z.string().min(1).max(320),
    fromAddress: z.string().min(1).max(320),
    subject: z.string().max(998).nullable().optional(),
    body: z.string().min(1),
    templateId: z.string().uuid().nullable().optional(),
    templateVariables: z.record(z.unknown()).default({}),
    provider: CommProviderSchema,
  })
  .superRefine((val, ctx) => {
    if (val.channel === 'email') {
      if (!EMAIL_REGEX.test(val.toAddress)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['toAddress'],
          message: 'Email format invalid',
        });
      }
      if (!val.subject) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subject'],
          message: 'Subject required for email',
        });
      }
    } else {
      if (!E164_REGEX.test(val.toAddress)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['toAddress'],
          message: 'Phone E.164 format required for whatsapp/sms/voice',
        });
      }
      if (val.subject) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['subject'],
          message: 'Subject only allowed for email channel',
        });
      }
    }
  });

export type CommMessageCreate = z.infer<typeof CommMessageCreateSchema>;
```

## 8. Tests complets

### 8.1 `migrations-communications.spec.ts` (>=6 tests)

```typescript
import { DataSource } from 'typeorm';
import { Communications1735000000004 } from '../../src/database/migrations/1735000000004-Communications';
import { createTestDataSource, runMigrationsUpTo } from './helpers/test-db';

describe('Migration Communications1735000000004', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource('comm_migration_test');
    await runMigrationsUpTo(ds, '1735000000004');
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('T1 cree les 4 tables comm_*', async () => {
    const tables = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'comm\\_%' ESCAPE '\\'
      ORDER BY table_name;
    `);
    expect(tables.map((t: any) => t.table_name)).toEqual([
      'comm_messages',
      'comm_optouts',
      'comm_templates',
      'comm_webhooks_received',
    ]);
  });

  it('T2 cree les 8 enums attendus', async () => {
    const enums = await ds.query(`
      SELECT typname FROM pg_type
      WHERE typname LIKE 'comm\\_%\\_enum' ESCAPE '\\'
      ORDER BY typname;
    `);
    expect(enums.length).toBe(8);
  });

  it('T3 RLS active sur comm_messages, comm_templates, comm_optouts', async () => {
    const rls = await ds.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('comm_messages','comm_templates','comm_optouts','comm_webhooks_received');
    `);
    const map = new Map(rls.map((r: any) => [r.relname, r]));
    expect(map.get('comm_messages').relrowsecurity).toBe(true);
    expect(map.get('comm_messages').relforcerowsecurity).toBe(true);
    expect(map.get('comm_templates').relrowsecurity).toBe(true);
    expect(map.get('comm_optouts').relrowsecurity).toBe(true);
    expect(map.get('comm_webhooks_received').relrowsecurity).toBe(false);
  });

  it('T4 indexes critiques presents', async () => {
    const idx = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname='public' AND tablename LIKE 'comm_%';
    `);
    const names = idx.map((i: any) => i.indexname);
    expect(names).toContain('idx_comm_messages_tenant_channel_status_sent');
    expect(names).toContain('idx_comm_messages_tenant_contact_created');
    expect(names).toContain('idx_comm_optouts_tenant_contact_channel_active');
    expect(names).toContain('idx_comm_webhooks_idempotency_key');
  });

  it('T5 contrainte CHECK to_address email vs phone E.164', async () => {
    await expect(
      ds.query(`
        INSERT INTO comm_messages
          (tenant_id, channel, direction, to_address, from_address, body, provider)
        VALUES
          ('00000000-0000-0000-0000-000000000001', 'email', 'outbound',
           '0612345678', 'noreply@skalean.ma', 'test', 'sendgrid');
      `),
    ).rejects.toThrow(/comm_messages_to_address_format/);
  });

  it('T6 down() supprime tout proprement', async () => {
    const ds2 = await createTestDataSource('comm_migration_down_test');
    await runMigrationsUpTo(ds2, '1735000000004');
    const mig = new Communications1735000000004();
    const qr = ds2.createQueryRunner();
    await qr.connect();
    await mig.down(qr);
    const tables = await qr.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name LIKE 'comm\\_%' ESCAPE '\\';
    `);
    expect(tables.length).toBe(0);
    await qr.release();
    await ds2.destroy();
  });

  it('T7 idempotency_key UNIQUE rejette doublon', async () => {
    const key = 'meta:test:wamid.HBgL123';
    await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('meta', 'messages.delivered', '{}'::jsonb, true, $1);
    `, [key]);
    await expect(
      ds.query(`
        INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
        VALUES ('meta', 'messages.delivered', '{}'::jsonb, true, $1);
      `, [key]),
    ).rejects.toThrow(/idx_comm_webhooks_idempotency_key|duplicate key/);
  });
});
```

### 8.2 `rls-comm.spec.ts` (>=6 tests cross-tenant)

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, runMigrationsUpTo, seedTenants } from './helpers/test-db';

describe('RLS isolation comm_messages / comm_templates / comm_optouts', () => {
  let ds: DataSource;
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const CONTACT_A = '33333333-3333-3333-3333-333333333333';
  const CONTACT_B = '44444444-4444-4444-4444-444444444444';

  beforeAll(async () => {
    ds = await createTestDataSource('comm_rls_test');
    await runMigrationsUpTo(ds, '1735000000004');
    await seedTenants(ds, [TENANT_A, TENANT_B]);
    await ds.query(`
      INSERT INTO contacts (id, tenant_id, first_name, phone)
      VALUES ($1, $2, 'A', '+212600000001'), ($3, $4, 'B', '+212600000002');
    `, [CONTACT_A, TENANT_A, CONTACT_B, TENANT_B]);
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  async function setTenant(tenantId: string) {
    await ds.query(`SET app.tenant_id = '${tenantId}';`);
  }

  it('R1 tenant A ne voit pas messages tenant B', async () => {
    await setTenant(TENANT_B);
    await ds.query(`
      INSERT INTO comm_messages (tenant_id, contact_id, channel, direction, to_address, from_address, body, provider)
      VALUES ($1, $2, 'sms', 'outbound', '+212600000002', '+212522000000', 'msg-B', 'twilio');
    `, [TENANT_B, CONTACT_B]);

    await setTenant(TENANT_A);
    const r = await ds.query(`SELECT count(*)::int AS n FROM comm_messages;`);
    expect(r[0].n).toBe(0);
  });

  it('R2 tenant A INSERT vers tenant B refuse par WITH CHECK', async () => {
    await setTenant(TENANT_A);
    await expect(
      ds.query(`
        INSERT INTO comm_messages (tenant_id, contact_id, channel, direction, to_address, from_address, body, provider)
        VALUES ($1, $2, 'sms', 'outbound', '+212600000002', '+212522000000', 'illegal', 'twilio');
      `, [TENANT_B, CONTACT_B]),
    ).rejects.toThrow(/row-level security|new row violates row-level security/);
  });

  it('R3 templates isole par tenant', async () => {
    await setTenant(TENANT_A);
    await ds.query(`
      INSERT INTO comm_templates (tenant_id, name, channel, category, language, body_template, variables_schema)
      VALUES ($1, 'welcome', 'whatsapp', 'transactional', 'fr', 'Bonjour', '{}'::jsonb);
    `, [TENANT_A]);
    await setTenant(TENANT_B);
    const r = await ds.query(`SELECT count(*)::int AS n FROM comm_templates;`);
    expect(r[0].n).toBe(0);
  });

  it('R4 optouts isole par tenant', async () => {
    await setTenant(TENANT_A);
    await ds.query(`
      INSERT INTO comm_optouts (tenant_id, contact_id, channel, created_by_contact)
      VALUES ($1, $2, 'sms', true);
    `, [TENANT_A, CONTACT_A]);
    await setTenant(TENANT_B);
    const r = await ds.query(`SELECT count(*)::int AS n FROM comm_optouts;`);
    expect(r[0].n).toBe(0);
  });

  it('R5 webhooks accessible cross-tenant (HORS RLS)', async () => {
    await setTenant(TENANT_A);
    await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('meta', 'messages.read', '{"x":1}'::jsonb, true, 'rls-test-key-1');
    `);
    await setTenant(TENANT_B);
    const r = await ds.query(
      `SELECT count(*)::int AS n FROM comm_webhooks_received WHERE idempotency_key='rls-test-key-1';`,
    );
    expect(r[0].n).toBe(1);
  });

  it('R6 SET app.tenant_id absent => acces vide', async () => {
    await ds.query(`RESET app.tenant_id;`);
    const r = await ds.query(`SELECT count(*)::int AS n FROM comm_messages;`);
    expect(r[0].n).toBe(0);
  });

  it('R7 superuser bypass uniquement avec ROLE postgres (defense profondeur)', async () => {
    const owner = await ds.query(`SELECT current_user::text AS u;`);
    expect(owner[0].u).not.toBe('postgres');
  });
});
```

### 8.3 `idempotency.spec.ts` (>=5 tests)

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, runMigrationsUpTo } from './helpers/test-db';

describe('Webhook idempotency_key UNIQUE', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource('comm_idempotency_test');
    await runMigrationsUpTo(ds, '1735000000004');
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('I1 INSERT premier passe', async () => {
    const r = await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('meta', 'messages.delivered', '{}'::jsonb, true, 'meta:tenantA:wamid.001')
      RETURNING id;
    `);
    expect(r[0].id).toBeDefined();
  });

  it('I2 INSERT duplicate rejete par UNIQUE', async () => {
    await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('twilio', 'sms.delivered', '{}'::jsonb, true, 'twilio:SM_dup_key');
    `);
    await expect(
      ds.query(`
        INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
        VALUES ('twilio', 'sms.delivered', '{}'::jsonb, true, 'twilio:SM_dup_key');
      `),
    ).rejects.toThrow(/duplicate key|idx_comm_webhooks_idempotency_key/);
  });

  it('I3 ON CONFLICT DO NOTHING retourne 0 lignes', async () => {
    const key = 'sendgrid:evt-conflict-1';
    await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('sendgrid', 'delivered', '{}'::jsonb, true, $1);
    `, [key]);
    const r = await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('sendgrid', 'delivered', '{}'::jsonb, true, $1)
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id;
    `, [key]);
    expect(r.length).toBe(0);
  });

  it('I4 idempotency_key cross-tenant : meme key autorise un seul global', async () => {
    const key = 'meta:globalwamid.HBgxxx';
    await ds.query(`
      INSERT INTO comm_webhooks_received (tenant_id, provider, event_type, payload, signature_valid, idempotency_key)
      VALUES (NULL, 'meta', 'messages.read', '{}'::jsonb, true, $1);
    `, [key]);
    await expect(
      ds.query(`
        INSERT INTO comm_webhooks_received (tenant_id, provider, event_type, payload, signature_valid, idempotency_key)
        VALUES ('11111111-1111-1111-1111-111111111111', 'meta', 'messages.read', '{}'::jsonb, true, $1);
      `, [key]),
    ).rejects.toThrow(/duplicate key/);
  });

  it('I5 MAJ processed_status apres traitement', async () => {
    const key = 'mailgun:msg-process-1';
    await ds.query(`
      INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
      VALUES ('mailgun', 'delivered', '{}'::jsonb, true, $1);
    `, [key]);
    await ds.query(`
      UPDATE comm_webhooks_received
      SET processed_status='success', processed_at=NOW()
      WHERE idempotency_key=$1;
    `, [key]);
    const r = await ds.query(
      `SELECT processed_status, processed_at FROM comm_webhooks_received WHERE idempotency_key=$1;`,
      [key],
    );
    expect(r[0].processed_status).toBe('success');
    expect(r[0].processed_at).not.toBeNull();
  });

  it('I6 retry pattern atomic : INSERT ON CONFLICT detect duplicate', async () => {
    const key = 'meta:retry-pattern';
    const insert = async () =>
      ds.query(`
        INSERT INTO comm_webhooks_received (provider, event_type, payload, signature_valid, idempotency_key)
        VALUES ('meta', 'messages.delivered', '{"v":1}'::jsonb, true, $1)
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id;
      `, [key]);
    const r1 = await insert();
    const r2 = await insert();
    expect(r1.length).toBe(1);
    expect(r2.length).toBe(0);
  });
});
```

### 8.4 `templates-render.spec.ts` (>=4 tests)

```typescript
import { renderTemplate, TemplateRenderError } from '../../src/modules/comm/utils/render-template.util';

describe('renderTemplate helper', () => {
  it('TR1 substitue placeholders simples', () => {
    const r = renderTemplate('Bonjour {{name}}, votre prime est de {{amount}} MAD', {
      name: 'Karim',
      amount: 4500,
    });
    expect(r.rendered).toBe('Bonjour Karim, votre prime est de 4500 MAD');
    expect(r.used).toEqual(['name', 'amount']);
    expect(r.missing).toEqual([]);
  });

  it('TR2 lance exception sur variable manquante en mode strict', () => {
    expect(() =>
      renderTemplate('Bonjour {{name}}', {}),
    ).toThrow(TemplateRenderError);
  });

  it('TR3 escape HTML quand demande', () => {
    const r = renderTemplate('Hello {{name}}', { name: '<script>alert(1)</script>' }, {
      escapeHtml: true,
    });
    expect(r.rendered).toBe('Hello &lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('TR4 multi-line template ar-MA RTL preserve', () => {
    const tpl = 'مرحبا {{contact_first_name}},\nتذكير: قسطك {{amount}} درهم يستحق في {{date}}';
    const r = renderTemplate(tpl, {
      contact_first_name: 'كريم',
      amount: '4500',
      date: '2026-06-15',
    });
    expect(r.rendered).toContain('مرحبا كريم');
    expect(r.rendered.split('\n')).toHaveLength(2);
  });

  it('TR5 valide variables_schema JSON Schema', () => {
    const schema = {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        date: { type: 'string', format: 'date' },
      },
      required: ['amount', 'date'],
    };
    expect(() =>
      renderTemplate('Prime {{amount}} {{date}}', { amount: 'not-a-number', date: '2026-06-15' }, {
        variablesSchema: schema,
      }),
    ).toThrow(TemplateRenderError);
  });

  it('TR6 null/undefined traite comme missing', () => {
    expect(() =>
      renderTemplate('Hello {{name}}', { name: null }),
    ).toThrow(TemplateRenderError);
  });
});
```

### 8.5 `opt-out.spec.ts` (>=4 tests)

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, runMigrationsUpTo, seedTenants } from '../database/helpers/test-db';

describe('Opt-out per-channel granular', () => {
  let ds: DataSource;
  const T = '11111111-1111-1111-1111-111111111111';
  const C = '33333333-3333-3333-3333-333333333333';

  beforeAll(async () => {
    ds = await createTestDataSource('comm_optout_test');
    await runMigrationsUpTo(ds, '1735000000004');
    await seedTenants(ds, [T]);
    await ds.query(
      `INSERT INTO contacts (id, tenant_id, first_name, phone) VALUES ($1, $2, 'Karim', '+212600000001');`,
      [C, T],
    );
    await ds.query(`SET app.tenant_id = '${T}';`);
  });

  afterAll(async () => {
    if (ds?.isInitialized) await ds.destroy();
  });

  it('O1 opt-out SMS uniquement, Email reste actif', async () => {
    await ds.query(`
      INSERT INTO comm_optouts (tenant_id, contact_id, channel, created_by_contact)
      VALUES ($1, $2, 'sms', true);
    `, [T, C]);
    const r = await ds.query(`
      SELECT channel FROM comm_optouts
      WHERE contact_id=$1 AND revoked_at IS NULL ORDER BY channel;
    `, [C]);
    expect(r.map((x: any) => x.channel)).toEqual(['sms']);
  });

  it('O2 opt-out admin SANS reason refuse', async () => {
    await expect(
      ds.query(`
        INSERT INTO comm_optouts (tenant_id, contact_id, channel, created_by_contact)
        VALUES ($1, $2, 'whatsapp', false);
      `, [T, C]),
    ).rejects.toThrow(/comm_optouts_admin_requires_reason/);
  });

  it('O3 opt-out contact-initie ne reclame pas reason', async () => {
    const r = await ds.query(`
      INSERT INTO comm_optouts (tenant_id, contact_id, channel, created_by_contact)
      VALUES ($1, $2, 'whatsapp', true)
      RETURNING id;
    `, [T, C]);
    expect(r[0].id).toBeDefined();
  });

  it('O4 unique partial index : pas 2 opt-outs actifs meme channel meme contact', async () => {
    await expect(
      ds.query(`
        INSERT INTO comm_optouts (tenant_id, contact_id, channel, created_by_contact)
        VALUES ($1, $2, 'sms', true);
      `, [T, C]),
    ).rejects.toThrow(/idx_comm_optouts_tenant_contact_channel_active/);
  });

  it('O5 revoked_at autorise nouvel opt-out meme channel', async () => {
    await ds.query(`
      UPDATE comm_optouts SET revoked_at=NOW()
      WHERE contact_id=$1 AND channel='sms';
    `, [C]);
    const r = await ds.query(`
      INSERT INTO comm_optouts (tenant_id, contact_id, channel, created_by_contact, reason)
      VALUES ($1, $2, 'sms', false, 'admin re-applied per CNDP request')
      RETURNING id;
    `, [T, C]);
    expect(r[0].id).toBeDefined();
  });
});
```

### 8.6 `normalize-ma-phone.spec.ts` (>=8 tests)

```typescript
import { normalizeMaPhone, isValidMaPhone } from '../../src/modules/comm/utils/normalize-ma-phone.util';

describe('normalizeMaPhone', () => {
  it('N1 +212 strict valide', () => {
    expect(normalizeMaPhone('+212612345678')).toBe('+212612345678');
  });
  it('N2 0X national converti', () => {
    expect(normalizeMaPhone('0612345678')).toBe('+212612345678');
  });
  it('N3 00212 international converti', () => {
    expect(normalizeMaPhone('00212612345678')).toBe('+212612345678');
  });
  it('N4 212 sans + converti', () => {
    expect(normalizeMaPhone('212612345678')).toBe('+212612345678');
  });
  it('N5 espaces et tirets nettoyes', () => {
    expect(normalizeMaPhone('+212 6-12.34 56 78')).toBe('+212612345678');
  });
  it('N6 mobile 7XX accepte', () => {
    expect(normalizeMaPhone('+212712345678')).toBe('+212712345678');
  });
  it('N7 fixe 5XX accepte', () => {
    expect(normalizeMaPhone('+212522000000')).toBe('+212522000000');
  });
  it('N8 chiffre 8XX rejete', () => {
    expect(normalizeMaPhone('+212812345678')).toBeNull();
  });
  it('N9 trop court rejete', () => {
    expect(normalizeMaPhone('+21261234')).toBeNull();
  });
  it('N10 vide ou null', () => {
    expect(normalizeMaPhone('')).toBeNull();
    expect(normalizeMaPhone(null)).toBeNull();
  });
  it('N11 isValidMaPhone true seulement E.164 strict', () => {
    expect(isValidMaPhone('+212612345678')).toBe(true);
    expect(isValidMaPhone('0612345678')).toBe(false);
  });
});
```

## 9. Variables environnement (>=18)

Ajouter a `.env.example` :

```dotenv
# ===== Database (rappel, deja existant) =====
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=skalean_app
DATABASE_PASSWORD=changeme
DATABASE_NAME=skalean_core
DATABASE_SSL_MODE=prefer

# ===== Comm role webhook ingestor =====
DATABASE_WEBHOOK_INGESTOR_USER=webhook_ingestor
DATABASE_WEBHOOK_INGESTOR_PASSWORD=changeme

# ===== Meta WhatsApp Cloud API =====
META_WA_APP_ID=
META_WA_APP_SECRET=
META_WA_VERIFY_TOKEN=
META_WA_PHONE_NUMBER_ID=
META_WA_BUSINESS_ACCOUNT_ID=
META_WA_API_VERSION=v18.0
META_WA_GRAPH_BASE_URL=https://graph.facebook.com

# ===== Twilio (SMS + Voice) =====
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+212522000000
TWILIO_VOICE_FROM_NUMBER=+212522000001
TWILIO_WEBHOOK_BASE_URL=https://api.skalean.ma/webhooks/twilio

# ===== SendGrid =====
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@skalean.ma
SENDGRID_FROM_NAME=Skalean InsurTech
SENDGRID_EVENT_WEBHOOK_PUBLIC_KEY=

# ===== Mailgun =====
MAILGUN_API_KEY=
MAILGUN_DOMAIN=mg.skalean.ma
MAILGUN_SIGNING_KEY=
MAILGUN_REGION=eu

# ===== Comm globaux =====
COMM_WEBHOOK_TIMEOUT_MS=8000
COMM_WEBHOOK_RETRY_MAX=3
COMM_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS=300
COMM_OPTOUT_DEFAULT_GRACE_HOURS=0
COMM_TEMPLATE_RENDER_STRICT=true
COMM_DEFAULT_LANGUAGE=fr
COMM_PHONE_DEFAULT_COUNTRY=MA

# ===== Redis idempotency cache (TTL 24h) =====
REDIS_COMM_IDEMPOTENCY_TTL_SECONDS=86400
REDIS_COMM_IDEMPOTENCY_PREFIX=comm:idem:
```

Total : 18 variables nouvelles + 6 rappel = 24 entrees.

## 10. Commandes shell

```bash
# Generation entites + barrel
cd apps/api
mkdir -p src/modules/comm/entities src/modules/comm/utils
touch src/modules/comm/index.ts
touch src/modules/comm/entities/comm-message.entity.ts
touch src/modules/comm/entities/comm-template.entity.ts
touch src/modules/comm/entities/comm-optout.entity.ts
touch src/modules/comm/entities/comm-webhook-received.entity.ts
touch src/modules/comm/utils/render-template.util.ts
touch src/modules/comm/utils/normalize-ma-phone.util.ts

# Generation migration
touch src/database/migrations/1735000000004-Communications.ts

# Generation tests
mkdir -p test/database test/comm
touch test/database/migrations-communications.spec.ts
touch test/database/rls-comm.spec.ts
touch test/database/idempotency.spec.ts
touch test/comm/templates-render.spec.ts
touch test/comm/opt-out.spec.ts
touch test/comm/normalize-ma-phone.spec.ts

# Shared types
cd ../../packages/shared-types
mkdir -p src/comm
touch src/comm/index.ts
touch src/comm/comm-message.schema.ts
touch src/comm/comm-template.schema.ts
touch src/comm/comm-optout.schema.ts
touch src/comm/comm-webhook.schema.ts

# Install deps si manquant
cd ../../apps/api
pnpm add ajv ajv-formats
pnpm add -D @types/jest

# Tester migration sur DB clean
pnpm typeorm migration:run -d src/database/data-source.ts

# Lancer tests
pnpm test test/database/migrations-communications.spec.ts
pnpm test test/database/rls-comm.spec.ts
pnpm test test/database/idempotency.spec.ts
pnpm test test/comm/templates-render.spec.ts
pnpm test test/comm/opt-out.spec.ts
pnpm test test/comm/normalize-ma-phone.spec.ts

# Coverage
pnpm test:cov -- --testPathPattern='comm|communications|idempotency|opt-out|normalize-ma-phone'

# EXPLAIN ANALYZE indexes
psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME -c "
  EXPLAIN ANALYZE
  SELECT * FROM comm_messages
  WHERE tenant_id='11111111-1111-1111-1111-111111111111'
    AND channel='whatsapp'
    AND status='sent'
  ORDER BY sent_at DESC LIMIT 50;
"

# Rollback test
pnpm typeorm migration:revert -d src/database/data-source.ts

# Lint
pnpm lint --fix
pnpm typecheck
```

## 11. Criteres de validation V1-V30

- V1 : `pnpm typeorm migration:run` execute 1735000000004-Communications sans erreur
- V2 : 4 tables creees (comm_messages, comm_templates, comm_optouts, comm_webhooks_received)
- V3 : 8 enums PostgreSQL crees et listes via `\dT`
- V4 : RLS active+forcee sur 3 tables (pas comm_webhooks_received)
- V5 : Policy `tenant_isolation_*` presente sur 3 tables
- V6 : Indexes presents : (tenant_id, channel, status, sent_at DESC), (tenant_id, contact_id, created_at DESC), UNIQUE (idempotency_key), partial unique optouts (revoked_at IS NULL)
- V7 : Test `migrations-communications.spec.ts` >=6 tests, tous verts
- V8 : Test `rls-comm.spec.ts` >=6 tests cross-tenant verts
- V9 : Test `idempotency.spec.ts` >=5 tests dont ON CONFLICT verts
- V10 : Test `templates-render.spec.ts` >=4 tests dont ar-MA RTL multi-line vert
- V11 : Test `opt-out.spec.ts` >=4 tests granularite per-channel verts
- V12 : Test `normalize-ma-phone.spec.ts` >=8 tests formats MA verts
- V13 : Coverage modules `comm/` >= 85% statements, >= 80% branches
- V14 : EXPLAIN ANALYZE des 4 requetes types utilise les indexes (Index Scan, pas Seq Scan)
- V15 : `migration:revert` re-execute proprement (down() symetrique a up())
- V16 : Enum `comm_language_enum` accepte exactement {'fr','ar-MA','ar'} (pas 'fr-MA')
- V17 : CHECK `comm_messages_to_address_format` rejete email sur SMS et phone sur Email
- V18 : CHECK `comm_optouts_admin_requires_reason` rejete admin sans reason
- V19 : CHECK `comm_messages_failed_requires_reason` rejete failed sans fail_reason
- V20 : UNIQUE `idempotency_key` rejete doublon (test I2)
- V21 : Partial unique optouts permet re-opt-out apres revoked_at SET (test O5)
- V22 : `renderTemplate` strict mode lance `TemplateRenderError` (test TR2)
- V23 : `renderTemplate` ajv valide `variables_schema` (test TR5)
- V24 : `normalizeMaPhone` rejete prefix 8XX et longueur incorrecte
- V25 : Schemas Zod `CommMessageCreateSchema` valide les 4 channels
- V26 : Documentation `docs/database/comm-tables.md` decrit retention par table
- V27 : Diagramme Mermaid `comm-erd.mmd` rendu sans erreur (`mmdc -i ... -o ...`)
- V28 : 18 nouvelles variables `.env.example` ajoutees et documentees
- V29 : Aucune emoji dans les fichiers livres (`grep -r "[\x{1F300}-\x{1FAFF}]" src/ test/` retourne vide)
- V30 : `pnpm lint` et `pnpm typecheck` verts, 0 warning
- V31 : CHANGELOG.md updated avec entry sprint-2 task-1.2.5
- V32 : Commit message respecte conventional commits + reference task ID

## 12. Edge cases (10 cas critiques)

### EC-1 : ar-MA RTL rendering Email HTML

L'email rendu en arabe Maroc doit declarer `<html dir="rtl" lang="ar">`. Le helper `renderTemplate` ne se preoccupe pas de la direction (texte brut), MAIS le service `EmailRenderService` Sprint 9.2 doit injecter `dir="rtl"` quand `template.language IN ('ar-MA','ar')`. Test : verifier que le rendered preserve les caracteres arabes (UTF-8) sans BOM, sans encoding/decoding parasites. Eviter `String.fromCharCode` sur surrogates pairs.

### EC-2 : Meta template rejected workflow

Quand Meta rejette un template (raison cote API), le job sync passe `meta_template_status='rejected'` et la `body_template` reste figee (l'utilisateur doit creer une nouvelle version). Le service `CommSendService` MUST refuser tout envoi WA template ou `meta_template_status <> 'approved'`. Test integration : 1 template `pending_review` -> attempt send -> erreur `TEMPLATE_NOT_APPROVED`.

### EC-3 : Idempotency 24h TTL Redis pour fast path

Avant `INSERT ON CONFLICT`, le webhook ingestor verifie Redis `GET comm:idem:<key>` (TTL 24h). Si HIT -> retour 200 immediat sans DB. Si MISS -> INSERT puis `SET comm:idem:<key> 1 EX 86400`. Race condition : 2 retries arrivent simultanement, le SETNX (ou `SET NX EX`) garantit qu'un seul gagne le slot Redis. Le ON CONFLICT DB est filet de securite pour les cas de fail-over Redis. Test integration : Redis down -> ON CONFLICT DB suffit.

### EC-4 : Phone normalize Egypt/Tunisie/Algerie hors scope

Sprint 2-9, on ne supporte QUE +212 (Maroc). Si un import CSV contient `+216XXXX` (Tunisie) ou `+213XXXX` (Algerie), `normalizeMaPhone` retourne null -> contact rejete a l'import avec erreur explicite "Phone number outside Morocco scope (+212 only)". Sprint 25 : extension Maghreb -> nouveau helper `normalizeMaghrebPhone`.

### EC-5 : Opt-out cascade lors suppression contact

Si un contact est supprime (RGPD droit a l'oubli, soft-delete `contacts.deleted_at`), les `comm_optouts` correspondants restent (CASCADE refuse via `ON DELETE CASCADE` dans la migration). MAIS pour audit CNDP, on devrait conserver. CORRECTIF : changer `ON DELETE CASCADE` -> `ON DELETE SET NULL` + colonne snapshot `contact_email_at_optout`/`contact_phone_at_optout`. Decision pending : DEC-COMM-007 (en cours, defaut SET NULL Sprint 9 GA).

### EC-6 : Webhook signature replay attack 5min window

Twilio et Mailgun acceptent un timestamp dans la signature, le verifier rejette si `|now - timestamp| > COMM_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` (default 300s = 5min). Cela bloque un attaquant qui rejoue un payload signe vieux de 1h. Meta utilise un challenge token + signature sur body, donc moins sensible (le payload a un `messaging_product` constant), mais on ajoute aussi un check du `timestamp` dans `payload.entry[0].changes[0].value`. Test : forger une signature valide avec timestamp -10min -> rejet `signature_valid=false`.

### EC-7 : Email attachment size limit cross-providers

SendGrid : 30 MB max body+attachments combines. Mailgun : 25 MB. Skalean impose 20 MB max (marge). Le `comm_messages.body` reste TEXT pour HTML body, MAIS les attachments NE SONT PAS dans cette table : ils sont referencees via `attachments` JSONB pointant vers `documents.id` (Sprint 1.2.6). Sprint 9.2 ajoutera une table `comm_message_attachments` (out of scope 1.2.5).

### EC-8 : Voice channel preview Sprint 30 - schema actuel suffit ?

Le channel `voice` est dans l'enum mais l'integration complete arrive Sprint 30. Verification : la table `comm_messages` peut-elle stocker un appel voice ? `body` = transcript ou TwiML, `provider_message_id` = Twilio CallSid, statuses applicables (queued, sent=initiated, delivered=answered, read=N/A, failed=busy/no-answer). Reponse : oui, schema suffit, `recording_url` ira en colonne `attachments` JSONB ajoutee Sprint 30.

### EC-9 : SMS UCS-2 segments arabe estimation

Service helper `estimateSmsSegments(body: string, lang: 'fr'|'ar-MA'|'ar'): number` :
- fr/latin GSM-7 : ceil(len / 160) si <=160, ceil(len / 153) sinon (multi-segment header overhead)
- ar/ar-MA UCS-2 : ceil(len / 70) si <=70, ceil(len / 67) sinon
Alerte UI si segments > 6. Test unitaire : "salam" en fr -> 1 segment, "السلام عليكم" 12 chars -> 1 segment UCS-2, 80 chars arabe -> 2 segments.

### EC-10 : Broadcast NULL contact_id audit trail

Un message broadcast tenant-wide (annonce maintenance) a `contact_id=NULL`. Comment retracer destinataires reels ? Reponse : pour broadcast, on cree N lignes (une par destinataire) avec `contact_id` non NULL. La valeur NULL est UNIQUEMENT pour : (a) message systeme sans destinataire individuel (rare), (b) webhook inbound de numero inconnu pas encore matche a un contact existant. Audit : query `WHERE contact_id IS NULL` doit etre rare et inspectable manuellement.

## 13. Conformite Maroc (Loi 09-08 + ANRT + decision-008)

### 13.1 Loi 09-08 (Protection des Personnes Physiques a l'Egard du Traitement des Donnees a Caractere Personnel)

- **Article 9** : droit d'opposition implemente via `comm_optouts` table avec `created_by_contact=true` pour traces opt-out client direct.
- **Article 10-2** : exception communications transactionnelles non-marketing autorisees malgre opt-out marketing. Le service `CommSendService` filtre : si `template.category='transactional'`, ignore les opt-outs sauf `created_by_contact=true AND reason ILIKE '%absolute%'`.
- **Article 12** : duree de conservation. `comm_messages` retention 5 ans glissants (job nightly `PurgeCommMessagesJob` Sprint 12). `comm_optouts` retention illimitee (Article 9 implique caractere definitif). `comm_webhooks_received` retention 7 ans (audit forensique sinistres assurance Loi 17-99).
- **Article 23** : declaration CNDP du traitement. La table `comm_messages` est declaree dans le registre Skalean traitement CNDP-2025-XX (numero pending validation).

### 13.2 ANRT (Agence Nationale de Reglementation des Telecommunications)

- **Article 2 Decret 2-12-21** sur SMS marketing : interdiction d'envoi entre 21h00 et 08h00 heure Maroc Casablanca. Le service `CommScheduler` Sprint 9.3 verifie `now() AT TIME ZONE 'Africa/Casablanca'` et reporte les envois marketing hors creneau.
- **Article 5** sur opt-out keyword : SMS doivent contenir mention "STOP au XXXX" ou equivalent. Le helper `appendSmsOptOutFooter(body)` injecte automatiquement la mention si `template.category='marketing'`.
- **ANRT-Decision-2024-007** : numerotation A2P shortcode, conventions et quotas. Skalean utilise route Twilio aggregator marocain (Maroc Telecom interconnect).

### 13.3 Decision interne 008-multilingue-fr-ar-darija

- Tag `fr` = francais general (defaut Maroc francophone).
- Tag `ar-MA` = arabe darija marocaine (UI client final familier, marketing).
- Tag `ar` = arabe litteraire MSA (transactionnel formel, contrats, attestations).
- Mapping vers Meta WA : `fr -> fr`, `ar -> ar`, `ar-MA -> ar` (Meta ne distingue pas darija dans ses templates).
- Le frontend client choisit la langue au niveau profil contact (`contacts.preferred_language`), heritee dans `comm_messages.template_id` au moment du dispatch.

### 13.4 Implications techniques compliance

- `comm_messages.body` MUST etre stocke en plaintext UTF-8 (audit CNDP pourrait reclamer access). Pas d'encryption at-rest specifique au-dela du TDE PostgreSQL standard (deployment AWS RDS Maroc region eu-west-3 Paris ou OVH datacenter Casablanca).
- Logs applicatifs MUST masquer le `body` apres 30 jours (rotation logs avec masking selon decision-022).
- Export audit CNDP : endpoint admin `GET /admin/audit/communications?tenant_id=&from=&to=` retourne un CSV signe avec hash SHA-256, retention 7 ans dans S3 Glacier.

## 14. Conventions absolues (14 regles)

1. **AUCUNE EMOJI** dans aucun fichier code, test, doc, commit, PR description, comment.
2. **TIMESTAMPTZ** uniquement (jamais TIMESTAMP sans tz), stockage UTC.
3. **UUID v4** via `gen_random_uuid()` (extension `pgcrypto`), jamais BIGSERIAL.
4. **snake_case** noms colonnes SQL, **camelCase** noms TypeScript, mapping `@Column({ name: 'snake_case' })`.
5. **enum PostgreSQL nomme** `<domain>_<purpose>_enum` avec underscore final, jamais inline `enum ('a','b')`.
6. **Foreign keys** explicites `ON DELETE` action (CASCADE | RESTRICT | SET NULL), pas de defaut.
7. **CHECK constraints** nommees `<table>_<rule>_check` pour identifier en logs erreur.
8. **Indexes nommes** `idx_<table>_<columns>` pour grep facile.
9. **RLS policies nommees** `tenant_isolation_<table>` standard.
10. **Pas de SELECT * en production**, toujours colonnes explicites cote service.
11. **Pas de `synchronize:true`** TypeORM, migrations strictement manuelles.
12. **Tests >= 80% coverage** branches, >= 85% statements.
13. **Pas de `any` TypeScript**, `unknown` + narrowing, `Record<string, unknown>` pour JSONB.
14. **Commit conventional commits** : `feat(comm): migration 1735000000004 communications tables (task-1.2.5)`.

## 15. Validation pre-commit

Hook `.husky/pre-commit` verifie :

```bash
#!/usr/bin/env bash
set -e

# Lint + typecheck
pnpm lint
pnpm typecheck

# Test fichiers tache 1.2.5
pnpm test --testPathPattern='comm|communications|idempotency|opt-out|normalize-ma-phone' --bail

# Verifier aucune emoji
if grep -rPn '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' apps/api/src/modules/comm apps/api/src/database/migrations/1735000000004-Communications.ts apps/api/test/comm apps/api/test/database/migrations-communications.spec.ts apps/api/test/database/rls-comm.spec.ts apps/api/test/database/idempotency.spec.ts; then
  echo "ERREUR: emoji detectee dans les fichiers task 1.2.5"
  exit 1
fi

# Verifier migration:run + migration:revert sequence sur DB test
DB_NAME_TEST=skalean_pre_commit_test pnpm typeorm migration:run -d src/database/data-source.ts
DB_NAME_TEST=skalean_pre_commit_test pnpm typeorm migration:revert -d src/database/data-source.ts

echo "OK pre-commit task 1.2.5"
```

Verification supplementaire CI (.github/workflows/ci.yml) :
- Job `test-database` : spin up PostgreSQL 15 service, run migrations 1.2.1 a 1.2.5, run specs, verifier RLS tests verts.
- Job `coverage` : seuil minimum 85% sur `apps/api/src/modules/comm/**`.
- Job `compliance` : grep emoji + verification que `decision-008`, `decision-019`, `decision-021` sont referencees dans les commentaires SQL/TS.

## 16. Commit message

```
feat(comm): migration 1735000000004 communications tables (task-1.2.5)

Cree 4 tables core domain pour le module Communications multi-channel :
- comm_messages : journal universel WA/Email/SMS/Voice avec status enum 6-etats
- comm_templates : templates pre-approuves multilingue fr/ar-MA/ar avec workflow Meta
- comm_optouts : opt-out granulaire per-channel conforme Loi 09-08 + RGPD
- comm_webhooks_received : ingest cross-providers avec idempotency_key UNIQUE

RLS active sur comm_messages, comm_templates, comm_optouts (tenant isolation).
comm_webhooks_received hors RLS (tenant_id NULL au moment ingestion).

Indexes critiques :
- (tenant_id, channel, status, sent_at DESC) pour timeline outbound
- (tenant_id, contact_id, created_at DESC) pour fiche contact
- UNIQUE (idempotency_key) pour deduplication webhooks

Helpers ajoutes :
- renderTemplate() : Mustache-like avec validation ajv variables_schema
- normalizeMaPhone() : E.164 strict +212 (4 formats input acceptes)

Tests : 33+ tests sur 6 specs, coverage > 85%.

Conformite : Loi 09-08 art.9-10-12, ANRT decret 2-12-21, decisions 002+003+008+019+021.

Refs: task-1.2.5, sprint-2, phase-1
Depends-on: task-1.2.4 (Activities & Notes)
Unblocks: task-1.2.6 (Documents), sprint-9 (Communications module)
```

## 17. Next task : 1.2.6 Documents & Files

La tache suivante (1.2.6) construira :
- Table `documents` (id, tenant_id, contact_id NULL, type enum 'cni'|'permis'|'carte_grise'|'rib'|'attestation'|'devis_pdf'|'contrat_pdf'|'sinistre_photo'|'other', storage_provider enum 's3'|'minio'|'local', storage_key, original_filename, mime_type, size_bytes, sha256, virus_scan_status enum 'pending'|'clean'|'infected', signed_url_ttl_seconds, expires_at, timestamps).
- Table `document_versions` (versioning append-only).
- Table `document_links` (link doc -> messages comm OU policies OU quotes OU sinistres polymorphic).
- RLS sur les 3 tables.
- Integration ClamAV pour scan virus async.
- Helpers signed URLs (presigned 1h S3/MinIO).
- Tests >= 25 tests.

Estimation : 4h (P0). Demarre apres merge 1.2.5.

---

FIN TASK 1.2.5 - Migration Communications. Document complet, code production-ready, tests >= 33, criteres validation V1-V32, conformite Maroc complete.
