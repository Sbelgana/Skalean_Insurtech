# META-PROMPT B-09 -- SPRINT 9 COMMUNICATIONS WHATSAPP + EMAIL

**Version** : v2.2 (Option B)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 9 / 35 (cumul) -- Phase 3 Sprint 2
**Position** : Apres CRM+Booking, avant Docs+Signature
**Numerotation taches** : 3.2.1 a 3.2.13
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous flows utilisateur communications)

---

## Objectif Global du Sprint

Implementer **systeme communications multi-canal** : WhatsApp Cloud API (Meta Business), Email (SMTP), templates multilingues (fr / ar-MA / ar) avec RTL, routing automatique par `preferred_channel` du contact (Sprint 8), opt-out management conformite CNDP, et delivery tracking complet.

A la sortie de ce sprint :
- WhatsApp Cloud API integre (Meta Business Platform v21.0)
- Templates pre-approved Meta synchronises (workflow approval geres)
- Email SMTP avec DKIM + SPF + DMARC ready
- Templates Handlebars 3 locales avec RTL pour ar/ar-MA
- Routing automatique : `comm.send(contactId, templateId, vars)` -> WhatsApp si preferred + opt-in, sinon Email
- BullMQ queues `wa-send` + `email-send` avec retry exponential + DLQ
- Webhooks Meta + Mailgun verifies (HMAC signature)
- Delivery tracking : sent -> delivered -> read -> bounce
- Opt-out management : tables `comm_optouts` + endpoint public `/api/v1/public/optout/:token`
- Audit log + Kafka events
- 40+ tests E2E avec Mailhog + mock Meta API

---

## Frontiere du Sprint

**INCLUS** :
- WhatsApp Cloud API client (Meta v21.0)
- WA template management + workflow approval Meta
- Email SMTP (Nodemailer) avec DKIM/SPF
- Templates Handlebars 3 locales + RTL
- BullMQ queues + workers (Sprint 3 JobsModule deja init)
- Webhook receivers + signature verification HMAC
- Message orchestrator (routing par preferred_channel)
- Delivery tracking statuses
- Opt-out management CNDP
- Tests E2E avec mocks
- Endpoints REST messages

**EXCLU** (sera ajoute aux sprints suivants) :
- SMS (Twilio integration) -- Phase 7+ si demande
- Voice calls -- pas dans MVP
- Push notifications mobile -- Phase 7+ apps mobile
- IA-generated message content (Sprint 30+ AI defere)

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` -- 4 tables comm (Sprint 2)
2. `00-pilotage/documentation/2-variables-environnement.env` -- WHATSAPP_*, EMAIL_*
3. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles comm + opt-out
4. Sortie Sprint 5 : EmailService deja partiellement initialise
5. Sortie Sprint 8 : CRM contacts avec preferred_language + preferred_channel

---

## Stack Imposee (Sprint 9)

| Composant | Version | Notes |
|-----------|---------|-------|
| nodemailer | 6.9.16 | SMTP client (deja Sprint 5 partial) |
| handlebars | 4.7.8 | templates engine |
| node-html-to-text | 9.0.5 | HTML -> plain text fallback emails |
| undici | 7.1.1 | HTTP client (Meta API) |
| crypto Node | native | HMAC signature verification |
| bullmq | 5.30.1 | queues (Sprint 3) |
| ical-generator | 8.0.1 | si invitation calendar attache email |

Variables env nouvelles : `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `EMAIL_DKIM_PRIVATE_KEY` (prod).

---

## Vue d'Ensemble des 13 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 3.2.1 | comm_messages entity enrichie + schemas Zod | 4h | P0 | Sprint 8 |
| 3.2.2 | WhatsApp Cloud API client (Meta v21.0) | 6h | P0 | 3.2.1 |
| 3.2.3 | WA template renderer + 3 locales | 5h | P0 | 3.2.2 |
| 3.2.4 | WA webhook receiver + signature HMAC verification | 5h | P0 | 3.2.3 |
| 3.2.5 | Template Manager + 20+ templates seed | 6h | P0 | 3.2.4 |
| 3.2.6 | Email SMTP client + DKIM/SPF + Mailgun integration | 5h | P0 | 3.2.5 |
| 3.2.7 | Email template renderer + RTL ar/ar-MA | 4h | P0 | 3.2.6 |
| 3.2.8 | BullMQ queues `wa-send` + `email-send` + retry + DLQ | 5h | P0 | 3.2.7 |
| 3.2.9 | Message orchestrator (routing par preferred_channel) | 5h | P0 | 3.2.8 |
| 3.2.10 | Delivery tracking + bounces + alerts | 4h | P0 | 3.2.9 |
| 3.2.11 | Opt-out management CNDP + endpoint public | 4h | P0 | 3.2.10 |
| 3.2.12 | Endpoints REST `/api/v1/comm/*` | 4h | P0 | 3.2.11 |
| 3.2.13 | Tests E2E (40+) + mocks Meta API + Mailhog | 8h | P0 | 3.2.12 |

**Total** : 65 heures.

---

# DETAIL DES 13 TACHES

---

## Tache 3.2.1 -- comm_messages Entity Enrichie + Schemas Zod

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 4h / Depend de Sprint 8

**But** : Enrichir entity `comm_message` (Sprint 2) avec types TypeScript complete + schemas Zod pour CRUD + validation E.164 / email format.

**Livrables checkables** :
- [ ] Entity `repo/packages/comm/src/entities/comm-message.entity.ts` (Sprint 2 deja migration)
- [ ] Decorators TypeORM complete : columns + indexes + foreign keys
- [ ] Enum types : `Channel ('whatsapp' | 'email' | 'sms' | 'voice')`, `Direction ('inbound' | 'outbound')`, `MessageStatus ('pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed')`
- [ ] Schemas Zod :
  - `SendMessageSchema` : channel + to + template_id + variables JSONB + contact_id (optional) + reply_to (optional)
  - `MessageFiltersSchema` : channel, direction, status, contact_id, date_range, search
  - `WebhookEventSchema` : status update from provider
- [ ] Validators : phone E.164 (utilise Sprint 8), email RFC 5322
- [ ] Service `messages-repository.service.ts` (factory queries reutilisable)
- [ ] Helpers : `extractPhoneE164(phone)`, `extractEmail(email)`
- [ ] Tests : entity hydrate + Zod schemas reject invalid + helpers normalisation

**Fichiers crees / modifies** :
```
repo/packages/comm/src/entities/comm-message.entity.ts                    # ~70 lignes
repo/packages/comm/src/schemas/message.schema.ts                          # ~80 lignes (Zod)
repo/packages/comm/src/schemas/webhook.schema.ts                          # ~40 lignes
repo/packages/comm/src/types/channel.enum.ts                              # ~15 lignes
repo/packages/comm/src/services/messages-repository.service.ts            # ~120 lignes (queries)
repo/packages/comm/src/helpers/phone-email.helper.ts                       # ~40 lignes
```

**Notes implementation** :
- Status enum strict : transitions linaire (pending -> queued -> sent -> delivered -> read), ou erreur (failed)
- `read_at` only WhatsApp (email pas read receipt fiable sans pixel tracking)
- `provider_message_id` UNIQUE per channel (Meta WA message_id, Mailgun X-Mailgun-Message-Id)
- Index `(tenant_id, channel, status, sent_at DESC)` deja Sprint 2
- Helpers normalisation : phone `06 12 34 56 78` -> `+212612345678`, email lowercase + trim

**Criteres validation** :
- V1 (P0) : Entity hydrate correctement
- V2 (P0) : Send Schema rejette to invalide (pas E.164 ni email)
- V3 (P0) : Send Schema accept WA template_variables JSONB
- V4 (P0) : Helpers normalisent phone correctement
- V5 (P0) : Tests 8+ scenarios

---

## Tache 3.2.2 -- WhatsApp Cloud API Client (Meta v21.0)

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 6h / Depend de 3.2.1

**But** : Client TypeScript pour Meta WhatsApp Business Platform Cloud API v21.0 : send template messages, retrieve message status, get phone number info.

**Contexte** : Meta Cloud API (vs On-Premises) = SaaS gere par Meta, plus simple operationnellement. Limite : seuls templates pre-approved peuvent etre envoyes (sauf 24h apres user message a initiate session). Meta valide templates avec workflow review (24-48h).

**Livrables checkables** :
- [ ] Service `repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.ts`
- [ ] Methods :
  - `sendTemplate(to, templateName, languageCode, components): Promise<{ message_id }>` -- send via template approved
  - `sendText(to, body): Promise<{ message_id }>` -- 24h session window only
  - `markAsRead(messageId)` -- inform read status
  - `getPhoneNumberInfo()` -- verify config
  - `uploadMedia(file): Promise<{ media_id }>` -- pour template avec image/document
  - `downloadMedia(mediaId): Promise<Buffer>` -- depuis incoming webhook media
- [ ] Configuration via env : `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_BASE_URL`
- [ ] HTTP client undici (perf > axios)
- [ ] Retry logic : 3 tentatives avec backoff exponential 1s/5s/30s sur 5xx errors
- [ ] Rate limiting respect : Meta 80 messages/seconde par phone_number_id
- [ ] Logging structures : message_id retourne + duration + status code
- [ ] Errors typed : `MetaRateLimitError`, `MetaInvalidTemplateError`, `MetaPhoneNotOptedInError`
- [ ] Mock client interface pour tests (`MockWhatsAppCloudApiClient`)
- [ ] Tests unitaires + integration mock

**Pattern critique : Meta API send template request**

```typescript
// Endpoint : POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
const response = await fetch(`${BASE_URL}/${phoneNumberId}/messages`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messaging_product: 'whatsapp',
    to: '212612345678',                  // E.164 sans +
    type: 'template',
    template: {
      name: 'police_signed_confirmation',
      language: { code: 'fr' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Mohamed' },        // {{1}}
            { type: 'text', text: 'POL-2026-001' },    // {{2}}
          ],
        },
      ],
    },
  }),
});
```

**Fichiers crees / modifies** :
```
repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.ts          # ~250 lignes
repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.spec.ts     # ~180 lignes
repo/packages/comm/src/providers/whatsapp/types.ts                               # ~80 lignes (Meta API types)
repo/packages/comm/src/providers/whatsapp/errors.ts                              # ~40 lignes (error classes)
repo/packages/comm/src/providers/whatsapp/mock-whatsapp.client.ts                # ~120 lignes (mock for tests)
```

**Notes implementation** :
- Meta API URL : `https://graph.facebook.com/v21.0/{phone_number_id}/messages`
- Phone format Meta : E.164 sans `+` (e.g. `212612345678`)
- Templates pre-approved : workflow Meta Business Manager (UI Sprint 27 admin)
- 24h session window : apres user envoie message, broker peut envoyer free-form 24h
- Rate limit : 80/sec par phone_number_id (suffisant MVP, scale Phase 7+)
- Errors handling : Meta error codes (130 = template not found, 131 = phone not opted-in, etc.)
- Mock client : retourne success synthetic + permet tests sans cout reel

**Criteres validation** :
- V1 (P0) : `sendTemplate` retourne message_id Meta
- V2 (P0) : Phone E.164 normalise (sans +)
- V3 (P0) : Template variables interpolees dans components
- V4 (P0) : Retry 3 fois sur 5xx
- V5 (P0) : Errors typed (MetaInvalidTemplate, etc.)
- V6 (P0) : Mock client comportement equivalent
- V7 (P0) : Tests integration via mock (pas de vrai API call)
- V8 (P1) : Logs structures emit

---

## Tache 3.2.3 -- WA Template Renderer + 3 Locales

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 5h / Depend de 3.2.2

**But** : Service rendant les templates WhatsApp avec variables : lookup template DB par nom + locale, parse `{{variables}}`, retourne components Meta API format.

**Contexte** : Meta exige templates pre-approved avec structure stricte `body`, `header`, `footer`, `buttons`. Variables `{{1}}, {{2}}, {{3}}` ordonnees (pas nommees). Service mappe variables nommees (e.g. `policeNumber`) vers ordre Meta.

**Livrables checkables** :
- [ ] Service `repo/packages/comm/src/services/wa-template-renderer.service.ts`
- [ ] Method `render(templateName, locale, variables): Promise<MetaTemplateComponents>` :
  - Lookup template `comm_templates` table (Sprint 2) par `(tenant_id, name, language)`
  - Parse template body avec placeholders `{{var_name}}` (named) ou `{{1}}, {{2}}` (Meta format)
  - Map variables nommees -> ordered array Meta format
  - Validate all required variables provided (Zod schema dans `variables_schema` jsonb)
  - Retourne components objet pour Meta API (body params + header params + buttons params)
- [ ] Method `validateMetaApproved(templateName, locale): boolean` -- check `meta_template_status == 'approved'`
- [ ] Method `getRequiredVariables(templateName, locale): string[]` -- retourne liste variables attendues
- [ ] Locales : 'fr', 'ar-MA', 'ar' (mapping vers Meta `language_code` : 'fr', 'ar', 'ar') -- ar-MA mappe vers ar avec contenu darija
- [ ] Cache Redis 5min par template (eviter re-fetch DB)
- [ ] Tests : render variables OK, missing variable reject, locale fallback (si ar-MA pas dispo, utilise fr)

**Fichiers crees / modifies** :
```
repo/packages/comm/src/services/wa-template-renderer.service.ts                # ~180 lignes
repo/packages/comm/src/services/wa-template-renderer.service.spec.ts           # ~150 lignes
repo/packages/comm/src/types/meta-template-components.ts                        # ~50 lignes
```

**Notes implementation** :
- Meta language_code : `fr`, `ar` -- pas de variant `ar-MA` dans Meta. Templates ar-MA ont contenu darija (lettres arabes + expressions familiers MA)
- Variables nommees `{{user_name}}` plus DX-friendly que `{{1}}` -- service convert
- Variables_schema jsonb : Zod schema serialise pour validation runtime
- Fallback locale : si template ar-MA pas dispo, fallback fr (ou ar). Documente per template
- Cache invalidation : Kafka event `comm.template_updated` -> evict cache

**Criteres validation** :
- V1 (P0) : `render('appointment_reminder', 'fr', { user_name: 'Mohamed', appointment_time: '15:00' })` retourne components Meta
- V2 (P0) : Variable manquante throw error explicite
- V3 (P0) : Variable extra ignoree (pas erreur, juste pas utilisee)
- V4 (P0) : Locale ar-MA utilise contenu darija
- V5 (P0) : Fallback locale si template absent
- V6 (P0) : `validateMetaApproved` rejette `meta_template_status='pending_review'`
- V7 (P0) : Tests 8+ scenarios

---

## Tache 3.2.4 -- WA Webhook Receiver + Signature HMAC Verification

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 5h / Depend de 3.2.3

**But** : Endpoint public `/api/v1/public/webhooks/whatsapp` recevant les webhooks Meta (status updates + incoming messages) avec verification signature HMAC SHA-256.

**Contexte** : Meta envoie webhooks pour : message_id sent / delivered / read, incoming messages from users, errors. Signature HMAC `X-Hub-Signature-256` doit etre verifiee (sinon attacker peut forger webhooks). Storage `comm_webhooks_received` table (Sprint 2) avec idempotency.

**Livrables checkables** :
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/wa-webhook.controller.ts`
- [ ] Endpoint `GET /api/v1/public/webhooks/whatsapp` (verification challenge initial Meta) :
  - Query params : `hub.mode`, `hub.challenge`, `hub.verify_token`
  - Verify token === env `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - Retourne challenge en plain text si match (200 OK)
- [ ] Endpoint `POST /api/v1/public/webhooks/whatsapp` (webhook receiver) :
  - Read raw body (NOT parsed JSON yet -- requis pour HMAC)
  - Compute HMAC SHA-256 du body avec env `WHATSAPP_APP_SECRET`
  - Compare avec header `X-Hub-Signature-256` (constant-time)
  - Si signature invalide : retourne 401 + log warn (mais 200 OK to Meta pour eviter retries)
  - Si signature OK : parse body + INSERT `comm_webhooks_received` row (idempotency_key = body hash)
  - Publish Kafka event `comm.webhook_received` -> consumer Tache 3.2.10 traite
  - Retourner 200 IMMEDIATEMENT (Meta exige < 5s response)
- [ ] Service `wa-webhook-processor.service.ts` (Kafka consumer extends KafkaConsumerBase Sprint 2)
- [ ] Process webhook async :
  - Status updates : update `comm_messages.status` (sent/delivered/read/failed) selon `entry.changes.value.statuses`
  - Incoming messages : insert nouveau `comm_messages` direction='inbound' + lookup contact via phone + auto-log interaction CRM Sprint 8
- [ ] Logs structures : webhook recu + verifie + processed
- [ ] Tests : signature verify happy + tampered + idempotency + status update + incoming message

**Pattern critique : signature HMAC verification**

```typescript
// repo/apps/api/src/modules/comm/middleware/wa-signature.middleware.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class WaSignatureMiddleware implements NestMiddleware {
  use(req: FastifyRequest, res: FastifyReply, next: () => void): void {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const rawBody = req.rawBody;  // Fastify config doit preserver raw body

    if (!signature || !rawBody) {
      return res.status(401).send({ error: 'NO_SIGNATURE' });
    }

    const expected = 'sha256=' + createHmac('sha256', env.WHATSAPP_APP_SECRET)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      // Log + return 200 (Meta exige 200 sinon retry inutile, on evite spam)
      logger.warn({ msg: 'wa_webhook_signature_invalid', signature, expected });
      return res.status(401).send({ error: 'INVALID_SIGNATURE' });
    }

    next();
  }
}
```

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/comm/controllers/wa-webhook.controller.ts            # ~120 lignes
repo/apps/api/src/modules/comm/middleware/wa-signature.middleware.ts            # ~70 lignes
repo/apps/api/src/modules/comm/consumers/wa-webhook-processor.consumer.ts       # ~250 lignes
repo/apps/api/test/comm/wa-webhook.e2e-spec.ts                                   # ~200 lignes
```

**Notes implementation** :
- Fastify : configurer `bodyLimit` + `attachFieldsToBody: 'keyValues'` + custom rawBody hook (necessaire HMAC)
- `timingSafeEqual` Node natif : evite timing attacks
- Idempotency : `idempotency_key = sha256(rawBody)` UNIQUE (Sprint 2 column) -> Postgres rejette duplicate
- Webhook async : controller retourne 200 IMMEDIATEMENT, Kafka consumer traite in background
- Meta retry policy : si pas 200 sous 5s, retry up to 24h (gerer idempotence)
- Public endpoint : `/api/v1/public/webhooks/*` -> bypass auth (Sprint 3 PublicEndpointGuard)

**Criteres validation** :
- V1 (P0) : GET verification : challenge retourne si verify_token match
- V2 (P0) : POST signature valide : 200 OK + processed
- V3 (P0) : POST signature invalide : 401 + warn log
- V4 (P0) : POST signature missing : 401
- V5 (P0) : Idempotency : 2 POSTs meme body -> 1 seul process
- V6 (P0) : Status update propage a comm_messages
- V7 (P0) : Incoming message cree row + auto-log interaction CRM
- V8 (P0) : Response < 5s (async via Kafka)
- V9 (P0) : Tests 10+ scenarios

---

## Tache 3.2.5 -- Template Manager + 20+ Templates Seed

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 6h / Depend de 3.2.4

**But** : Service CRUD templates + 20+ templates seed pre-ecrits 3 locales pour cas d'usage critiques (auth, booking, insure, repair).

**Livrables checkables** :
- [ ] Service `repo/packages/comm/src/services/template-manager.service.ts`
- [ ] Methods : `create`, `findById`, `findByName(tenant, name, locale)`, `update`, `delete`, `submitForApproval`, `markApproved`, `markRejected`
- [ ] Endpoints `repo/apps/api/src/modules/comm/controllers/templates.controller.ts` :
  - CRUD `/api/v1/comm/templates`
  - `POST /:id/submit` -- submit Meta for approval (Sprint 27 admin UI integrera)
  - `GET /api/v1/comm/templates/meta-status` -- check Meta status all templates
- [ ] Workflow Meta : draft -> pending_review -> approved/rejected
- [ ] Templates seed initiaux par module (20+ templates) :

**Auth (5 templates) x 3 locales = 15 templates** :
- `email_verification` (verify email link)
- `password_reset` (reset link)
- `password_changed_notification` (post-change alert)
- `mfa_enabled_notification`
- `account_locked_notification`

**Booking (3 templates) x 3 locales = 9 templates** :
- `appointment_scheduled` (confirmation)
- `appointment_reminder_24h`
- `appointment_cancelled`

**Insure (5 templates) x 3 locales = 15 templates (Sprint 14+ utilise)** :
- `quote_generated` (devis dispo)
- `police_signed_confirmation`
- `police_renewal_reminder` (J-30)
- `payment_due_reminder`
- `claim_received_acknowledgement`

**Repair (4 templates) x 3 locales = 12 templates (Sprint 20+ utilise)** :
- `sinistre_acknowledged`
- `devis_ready`
- `reparation_started`
- `reparation_completed`

**Tenant (3 templates) x 3 locales = 9 templates** :
- `tenant_invitation`
- `tenant_suspended_notification`
- `quota_warning_80percent`

Total seeds : ~60 templates (20 x 3 locales).

- [ ] Script `repo/infrastructure/scripts/seed-comm-templates.ts`
- [ ] Tests : CRUD templates, workflow approval, seeds run reussit

**Fichiers crees / modifies** :
```
repo/packages/comm/src/services/template-manager.service.ts                     # ~250 lignes
repo/packages/comm/src/services/template-manager.service.spec.ts                # ~150 lignes
repo/apps/api/src/modules/comm/controllers/templates.controller.ts              # ~120 lignes
repo/infrastructure/scripts/seed-comm-templates.ts                                # ~400 lignes (60 templates)
repo/packages/comm/src/templates/seed-data/{20 .json}                             # contenus per template
```

**Notes implementation** :
- Templates seed Meta-friendly : variables ordered + descriptions claires (review approval rapide)
- Locale strategy : fr template avec `{{user_name}}` -> ar-MA template avec `{{user_name}}` (mais texte arabe + RTL)
- WA templates limitees 1024 chars body, 60 chars header
- Email templates plus flexibles (HTML + text)
- Sprint 27 admin UI integrera workflow Meta approval

**Criteres validation** :
- V1 (P0) : 60+ templates seed crees
- V2 (P0) : 3 locales par template
- V3 (P0) : CRUD templates fonctionne
- V4 (P0) : Workflow draft -> pending -> approved fonctionne
- V5 (P0) : Validation longueur Meta
- V6 (P1) : Tests 8+ scenarios

---

## Tache 3.2.6 -- Email SMTP Client + DKIM/SPF + Mailgun

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 5h / Depend de 3.2.5

**But** : Email service production-ready avec SMTP (Mailgun ou Sendgrid prod, Mailhog dev), DKIM signing, SPF + DMARC config DNS.

**Livrables checkables** :
- [ ] Service `repo/packages/comm/src/providers/email/email.service.ts` (enrichi Sprint 5)
- [ ] Methods :
  - `send(to, subject, html, text, options): Promise<{ message_id }>`
  - `sendTemplate(to, templateName, locale, variables): Promise<{ message_id }>`
  - `verifyConnection(): Promise<boolean>`
- [ ] Configuration multi-env :
  - dev : Mailhog (localhost:1025, no auth)
  - staging/prod : Mailgun (smtp.eu.mailgun.org:587, TLS, auth)
- [ ] DKIM signing : private key lue depuis env `EMAIL_DKIM_PRIVATE_KEY` (prod), domain `skalean-insurtech.ma`, selector `default`
- [ ] Variables env ajoutees : `EMAIL_PROVIDER` (`mailhog` | `mailgun`), `EMAIL_SMTP_HOST/PORT/USER/PASSWORD`, `EMAIL_FROM_NO_REPLY`, `EMAIL_FROM_SUPPORT`, `EMAIL_DKIM_PRIVATE_KEY`, `EMAIL_DKIM_SELECTOR`
- [ ] Headers anti-spam : `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058)
- [ ] Multipart : HTML + plain text fallback (auto-extracted via node-html-to-text)
- [ ] Tracking : `Message-ID` UUID + retourne pour storage `comm_messages.provider_message_id`
- [ ] Webhook Mailgun pour bounce/delivered/opened (Tache 3.2.10)
- [ ] Documentation DNS : `repo/docs/runbooks/email-dns-setup.md` (DKIM + SPF + DMARC records)
- [ ] Tests : send via Mailhog, verify recu, headers correct

**DNS records prod (documentation)** :

```
# SPF
TXT @ v=spf1 include:mailgun.org ~all

# DKIM (selector "default")
TXT default._domainkey "k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQ..."

# DMARC
TXT _dmarc "v=DMARC1; p=quarantine; rua=mailto:dmarc@skalean-insurtech.ma; pct=100"
```

**Fichiers crees / modifies** :
```
repo/packages/comm/src/providers/email/email.service.ts                       # enrichi ~250 lignes
repo/packages/comm/src/providers/email/email.service.spec.ts                  # ~150 lignes
repo/packages/comm/src/providers/email/dkim-signer.helper.ts                   # ~60 lignes
repo/docs/runbooks/email-dns-setup.md                                          # ~80 lignes
```

**Notes implementation** :
- Mailgun region EU : compliance RGPD + proximite MA (latence < 30ms vs US ~150ms)
- DKIM signing automatique via Nodemailer `dkim` option
- List-Unsubscribe header obligatoire Gmail (sinon flag spam)
- One-click unsubscribe RFC 8058 : POST endpoint Sprint 9 Tache 3.2.11
- Provider switchable via env (multi-env support)
- DNS setup : runbook avec records exacts (DevOps)

**Criteres validation** :
- V1 (P0) : send via Mailhog dev OK
- V2 (P0) : send via Mailgun staging OK (test env)
- V3 (P0) : DKIM signature appliquee (verifier headers)
- V4 (P0) : List-Unsubscribe present
- V5 (P0) : Multipart HTML + text
- V6 (P0) : Provider switchable via env
- V7 (P0) : Documentation DNS claire
- V8 (P1) : Tests 8+ scenarios

---

## Tache 3.2.7 -- Email Template Renderer + RTL ar/ar-MA

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 4h / Depend de 3.2.6

**But** : Renderer email Handlebars avec layout shared (header + footer Skalean) + RTL automatique pour locales ar/ar-MA.

**Livrables checkables** :
- [ ] Service `repo/packages/comm/src/services/email-template-renderer.service.ts`
- [ ] Method `render(templateName, locale, variables): { subject, html, text }`
- [ ] Templates Handlebars dans `repo/packages/comm/src/templates/{locale}/{name}.hbs`
- [ ] Layout shared `repo/packages/comm/src/templates/_layout.hbs` (header logo Skalean + footer copyright + List-Unsubscribe link)
- [ ] CSS inline (compatibility email clients) via library `juice` ou manual
- [ ] RTL pour ar/ar-MA : `<html dir="rtl">` + CSS `direction: rtl; text-align: right`
- [ ] Subjects per locale stockees dans `comm_templates.subject_template`
- [ ] Helpers Handlebars : `formatDate(date, locale)`, `formatCurrency(amount, MAD)`, `tenantBranding(field)`
- [ ] Cache compiled templates (eviter re-compile a chaque render)
- [ ] Plain text fallback : auto-genere depuis HTML via node-html-to-text
- [ ] Tests : render fr / ar-MA / ar, RTL applique, subject correct, variables interpolees

**Fichiers crees / modifies** :
```
repo/packages/comm/src/services/email-template-renderer.service.ts             # ~180 lignes
repo/packages/comm/src/services/email-template-renderer.service.spec.ts        # ~120 lignes
repo/packages/comm/src/templates/_layout.hbs                                    # ~120 lignes (HTML + CSS inline)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/{20 .hbs}                         # 60 templates
repo/packages/comm/src/helpers/handlebars-helpers.ts                            # ~80 lignes
repo/packages/comm/package.json                                                 # add : juice
```

**Notes implementation** :
- CSS inline : critical email clients (Outlook, Gmail) souvent strippent `<style>` tag
- RTL : direction CSS + alignment + flow icons mirroring (chevrons inverses)
- Tenant branding : color primary depuis `tenant.settings.branding.primary_color`
- Plain text : 30-50% utilisateurs lisent en plain (mobile, accessibility)
- Compile cache : Map<templateName+locale, compiledFn>
- Helpers locale-aware : date format diff fr/ar (Intl.DateTimeFormat)

**Criteres validation** :
- V1 (P0) : `render('appointment_reminder', 'fr', vars)` retourne subject + html + text
- V2 (P0) : Locale ar-MA : html avec dir="rtl"
- V3 (P0) : Variables interpolees correctement
- V4 (P0) : Layout shared applique (logo + footer)
- V5 (P0) : CSS inline (apres juice)
- V6 (P0) : Plain text auto-genere
- V7 (P0) : Helpers : formatDate retourne format locale
- V8 (P0) : Tests 8+ scenarios

---

## Tache 3.2.8 -- BullMQ Queues + Retry + DLQ

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 5h / Depend de 3.2.7

**But** : Queues BullMQ (Sprint 3 JobsModule init) avec workers `wa-send` + `email-send`, retry exponential, DLQ on max retries exceeded.

**Livrables checkables** :
- [ ] Queues definies :
  - `wa-send` : send WhatsApp via Meta API
  - `email-send` : send email via SMTP
  - `wa-webhook-process` : process incoming WA webhooks (Tache 3.2.4 publish)
  - `email-webhook-process` : process incoming Email webhooks (Mailgun bounces)
- [ ] Workers correspondants :
  - `WaSendWorker` : recoit job `{ to, templateName, locale, variables, contactId, metadata }` -> renderer + WhatsApp client + update `comm_messages.status='sent'` + provider_message_id
  - `EmailSendWorker` : equivalent email
- [ ] Default job options : 3 retries, exponential backoff 1s/5s/30s, removeOnComplete 30 jours, removeOnFail 90 jours
- [ ] Concurrency : 10 workers parallele par queue (configurable)
- [ ] DLQ : apres 3 echecs, publier vers `insurtech.events.dlq.comm` Kafka topic
- [ ] Logs structures : job started/completed/failed/retry avec attempt count
- [ ] Idempotency : si job dup (Kafka retry), check `comm_messages.status` deja sent -> skip
- [ ] Metrics OTEL : queue size, processing time, retry count, DLQ count
- [ ] BullDashboard /admin/queues (Sprint 3) montre status
- [ ] Tests : send job, success update DB, fail retry, max retries DLQ

**Pattern critique : worker WaSendWorker**

```typescript
// repo/packages/comm/src/workers/wa-send.worker.ts
@Processor('wa-send')
export class WaSendWorker extends WorkerHost {
  constructor(
    private waClient: WhatsAppCloudApiClient,
    private renderer: WaTemplateRendererService,
    private messagesRepo: MessagesRepositoryService,
    private kafkaPublisher: KafkaPublisher,
  ) { super(); }

  async process(job: Job<WaSendJobData>): Promise<void> {
    const { messageId, to, templateName, locale, variables } = job.data;
    logger.info({ msg: 'wa_send_start', messageId, attempt: job.attemptsMade });

    // 1. Idempotency : check status
    const message = await this.messagesRepo.findById(messageId);
    if (message?.status === 'sent') {
      logger.info({ msg: 'wa_send_skip_already_sent', messageId });
      return;
    }

    // 2. Render template
    const components = await this.renderer.render(templateName, locale, variables);

    // 3. Send via Meta
    const result = await this.waClient.sendTemplate(to, templateName, locale, components);

    // 4. Update message status
    await this.messagesRepo.update(messageId, {
      status: 'sent',
      provider_message_id: result.message_id,
      sent_at: new Date(),
    });

    // 5. Kafka event
    await this.kafkaPublisher.publish(Topics.COMM_MESSAGE_SENT, { messageId, to, channel: 'whatsapp' });

    logger.info({ msg: 'wa_send_complete', messageId });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, err: Error): Promise<void> {
    if (job.attemptsMade >= 3) {
      // DLQ
      await this.kafkaPublisher.publish(Topics.DLQ_COMM, {
        original_data: job.data,
        error: { message: err.message, stack: err.stack, attempts: job.attemptsMade },
      });
      await this.messagesRepo.update(job.data.messageId, {
        status: 'failed', failed_at: new Date(), fail_reason: err.message,
      });
    }
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/comm/src/workers/wa-send.worker.ts                        # ~150 lignes
repo/packages/comm/src/workers/email-send.worker.ts                      # ~150 lignes
repo/packages/comm/src/workers/wa-webhook-process.worker.ts              # ~120 lignes
repo/packages/comm/src/workers/email-webhook-process.worker.ts           # ~120 lignes
repo/packages/comm/src/jobs/types.ts                                     # types jobs data
repo/apps/api/src/modules/comm/comm.module.ts                            # register workers
repo/apps/api/test/comm/workers.e2e-spec.ts                               # tests integration
```

**Notes implementation** :
- BullMQ Job avec `attemptsMade` : counter retries
- DLQ via Kafka (vs queue dediee BullMQ) : permet replay manuel + analyse
- Concurrency : balance throughput vs API rate limits Meta (80/sec) / Mailgun
- Idempotency : check DB status evite double-send si Kafka retry
- Logs Pino structured + OTEL metrics : observability

**Criteres validation** :
- V1 (P0) : Job reussi : message status='sent' + Kafka event
- V2 (P0) : Job fail transient : retry 3 fois
- V3 (P0) : 3 echecs : message status='failed' + DLQ event
- V4 (P0) : Idempotency : 2eme job meme messageId skip
- V5 (P0) : Concurrency 10 : 10 jobs parallele OK
- V6 (P0) : BullDashboard montre queues
- V7 (P0) : Tests 10+ scenarios

---

## Tache 3.2.9 -- Message Orchestrator (Routing par preferred_channel)

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 5h / Depend de 3.2.8

**But** : Service centralise orchestrant l'envoi : determine canal optimal (WhatsApp si preferred + opt-in + template Meta approved, sinon Email), enqueue job correspondant.

**Livrables checkables** :
- [ ] Service `repo/packages/comm/src/services/message-orchestrator.service.ts`
- [ ] Method `sendToContact(contactId, templateName, variables, options): Promise<{ messageId, channel }>` :
  1. Lookup contact (Sprint 8) : preferred_channel + preferred_language
  2. Check opt-out (Tache 3.2.11) sur le canal preferred -- si opt-out, fallback canal alternative
  3. Determine canal final :
     - WhatsApp si : preferred='whatsapp' AND opt-in WA AND template Meta approved AND phone valide
     - Sinon Email si : preferred='email' OR fallback OR opt-in email AND email valide
     - Sinon : NoAvailableChannelError
  4. INSERT row `comm_messages` avec status='pending'
  5. Enqueue job approprie (BullMQ wa-send ou email-send)
  6. Retourne `{ messageId, channel: 'whatsapp' | 'email' }`
- [ ] Method `sendBroadcast(filters, templateName, variables): Promise<{ jobs_enqueued }>` -- pour campaigns marketing (filter contacts)
- [ ] Method `sendBatch(items: SendItem[])` -- bulk send (e.g. reminders RDV J-1)
- [ ] Permissions : `comm.messages.send`
- [ ] Audit log : send initiated
- [ ] Tests : routing WA-preferred OK, fallback email si opt-out, no channel error, broadcast works

**Pattern critique : orchestrator routing**

```typescript
async sendToContact(
  contactId: string,
  templateName: string,
  variables: Record<string, unknown>,
  options?: { preferChannel?: Channel; correlationId?: string },
): Promise<{ messageId: string; channel: Channel }> {
  const contact = await this.contactsService.findById(contactId);
  if (!contact) throw new NotFoundException();

  const tenantId = getCurrentTenantId()!;
  const preferred = options?.preferChannel ?? contact.preferred_channel;

  // Check opt-outs
  const optedOutChannels = await this.optoutService.getOptedOutChannels(contactId);

  // Determine final channel
  let finalChannel: Channel | null = null;
  if (preferred === 'whatsapp' && !optedOutChannels.includes('whatsapp') && contact.phone) {
    const templateApproved = await this.waRenderer.validateMetaApproved(templateName, contact.preferred_language);
    if (templateApproved) finalChannel = 'whatsapp';
  }

  if (!finalChannel && !optedOutChannels.includes('email') && contact.email) {
    finalChannel = 'email';
  }

  if (!finalChannel) {
    throw new BadRequestException({ code: 'NO_AVAILABLE_CHANNEL' });
  }

  // Insert message
  const message = await this.messagesRepo.create({
    tenant_id: tenantId, contact_id: contactId, channel: finalChannel,
    direction: 'outbound', to_address: finalChannel === 'whatsapp' ? contact.phone : contact.email,
    template_id: null,  // resolved by worker
    template_variables: variables, status: 'pending',
  });

  // Enqueue
  const queueName = finalChannel === 'whatsapp' ? 'wa-send' : 'email-send';
  await this.queueService.add(queueName, {
    messageId: message.id, to: message.to_address, templateName,
    locale: contact.preferred_language, variables,
  });

  return { messageId: message.id, channel: finalChannel };
}
```

**Fichiers crees / modifies** :
```
repo/packages/comm/src/services/message-orchestrator.service.ts             # ~250 lignes
repo/packages/comm/src/services/message-orchestrator.service.spec.ts        # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Contact preferred WA + opt-in -> envoie via WA
- V2 (P0) : Contact preferred WA + opt-out -> fallback email
- V3 (P0) : Contact sans phone + sans email -> NoAvailableChannelError
- V4 (P0) : Template pas Meta approved -> fallback email
- V5 (P0) : Broadcast filtres correctement
- V6 (P0) : Audit + Kafka publishees
- V7 (P0) : Tests 12+ scenarios

---

## Tache 3.2.10 -- Delivery Tracking + Bounces + Alerts

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 4h / Depend de 3.2.9

**But** : Tracker statuses messages : sent -> delivered -> read (WA only) -> failed/bounced. Alertes si bounce rate > seuil.

**Livrables checkables** :
- [ ] Webhooks update `comm_messages.status` :
  - WA webhook (Tache 3.2.4) : `delivered_at`, `read_at`
  - Mailgun webhook : `delivered`, `bounced`, `opened`, `clicked`
- [ ] Endpoint `POST /api/v1/public/webhooks/mailgun` (similaire WA) avec verification HMAC SHA-256 (signing key Mailgun)
- [ ] Service `delivery-tracking.service.ts` :
  - `markDelivered(messageId, deliveredAt)`
  - `markRead(messageId, readAt)` (WA only)
  - `markBounced(messageId, bounceType, reason)` -- soft/hard bounce
  - `markOpened(messageId, openedAt)` (email pixel tracking)
- [ ] Hard bounces : auto-add to opt-out (pas re-essayer, anti-spam reputation)
- [ ] Soft bounces : retry par BullMQ
- [ ] Alerts :
  - Bounce rate > 5% sur 24h -> Kafka event `comm.high_bounce_rate` + alert Slack (Sprint 33)
  - Provider rate limit hit -> alert
- [ ] Stats endpoint `GET /api/v1/comm/stats` (delivery rate, bounce rate, by channel + last 30 days)
- [ ] Audit + Kafka events sur status changes
- [ ] Tests : delivery flow + bounce types + auto opt-out hard bounce

**Fichiers crees / modifies** :
```
repo/packages/comm/src/services/delivery-tracking.service.ts                # ~180 lignes
repo/apps/api/src/modules/comm/controllers/mailgun-webhook.controller.ts    # ~100 lignes
repo/apps/api/src/modules/comm/middleware/mailgun-signature.middleware.ts    # ~50 lignes
repo/apps/api/src/modules/comm/controllers/comm-stats.controller.ts          # ~80 lignes
```

**Notes implementation** :
- WA `read_at` : disponible si user a active "Read receipts" (default ON, peut etre OFF)
- Mailgun bounce types : `permanent` (hard, opt-out auto) vs `temporary` (soft, retry)
- Opt-out auto sur hard bounce : evite repeated failures + sender reputation
- Stats query : aggregations sur `comm_messages` group by status
- Sprint 33 alerting : Slack webhook integrate

**Criteres validation** :
- V1 (P0) : WA webhook : status update sent->delivered->read
- V2 (P0) : Mailgun webhook bounce hard : opt-out auto
- V3 (P0) : Bounce soft : retry pas opt-out
- V4 (P0) : Bounce rate > 5% : Kafka event emit
- V5 (P0) : Stats endpoint retourne aggregates
- V6 (P0) : Tests 10+ scenarios

---

## Tache 3.2.11 -- Opt-out Management CNDP + Endpoint Public

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 4h / Depend de 3.2.10

**But** : Conformite CNDP loi 09-08 : permettre opt-out facile via lien public dans email/WA, table `comm_optouts`, exclusion automatique a chaque send.

**Livrables checkables** :
- [ ] Service `repo/packages/comm/src/services/optout.service.ts`
- [ ] Methods :
  - `optOut(contactId, channel, reason?, source: 'web' | 'whatsapp' | 'admin')` -- enregistre opt-out
  - `optIn(contactId, channel)` -- revert (apres re-consent explicite)
  - `getOptedOutChannels(contactId): Channel[]` -- liste channels opt-out
  - `isOptedOut(contactId, channel): boolean`
- [ ] Endpoint public `GET /api/v1/public/optout/:token` :
  - Token = signed JWT contenant contactId + channel (Sprint 5 JWT helpers)
  - Token TTL 90 jours (long pour permettre opt-out tardive)
  - Affiche page HTML simple : "Confirm opt-out for {email/phone}?"
  - POST confirms -> opt-out enregistre
  - Audit log + email confirmation
- [ ] Endpoint `POST /api/v1/public/optout/one-click` (RFC 8058 List-Unsubscribe-Post header) :
  - One-click compliance Gmail
  - Direct opt-out sans confirmation page
- [ ] Endpoint user dashboard `/api/v1/comm/preferences` (auth required) -- voir + modifier ses opt-outs
- [ ] Lien opt-out auto-injecte dans tous emails (footer) + dans templates WA quand pertinent
- [ ] WA "STOP" keyword : reception "STOP" automatique opt-out (incoming webhook detecter + auto-opt-out)
- [ ] Permissions : `comm.optouts.read`, `comm.optouts.manage`
- [ ] Audit + Kafka events
- [ ] Tests : opt-out flow + STOP keyword + one-click

**Fichiers crees / modifies** :
```
repo/packages/comm/src/services/optout.service.ts                          # ~200 lignes
repo/packages/comm/src/services/optout.service.spec.ts                     # ~150 lignes
repo/apps/api/src/modules/comm/controllers/optout.controller.ts            # ~150 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/optout-page.hbs              # 3 templates HTML
```

**Notes implementation** :
- CNDP loi 09-08 : opt-out doit etre simple, gratuit, immediate
- Token signe (vs random opaque) : permet decoder server-side sans DB lookup (perf)
- One-click pattern Gmail : header `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- STOP keyword WA : norme telecom internationale (STOP, ARRET, STOP-ALL)
- Persistence : `comm_optouts` Sprint 2 table avec channel + source
- Re-consent : opt-in apres opt-out require confirmation explicite (audit trail)

**Criteres validation** :
- V1 (P0) : Opt-out token genere + URL fonctionne
- V2 (P0) : One-click endpoint works (POST direct)
- V3 (P0) : STOP keyword WA detecte + auto-opt-out
- V4 (P0) : Apres opt-out : message orchestrator skip ce canal
- V5 (P0) : Lien opt-out injecte tous emails
- V6 (P0) : Re-opt-in possible mais require explicit
- V7 (P0) : Audit log
- V8 (P0) : Tests 10+ scenarios

---

## Tache 3.2.12 -- Endpoints REST /api/v1/comm/*

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 4h / Depend de 3.2.11

**But** : Controllers exposant l'API comm (messages list, send, templates, stats) avec format standardise.

**Livrables checkables** :
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/messages.controller.ts` :
  - `POST /api/v1/comm/messages/send` (body : contactId + templateName + variables)
  - `POST /api/v1/comm/messages/send-batch` (array)
  - `GET /api/v1/comm/messages` (filtres : channel, direction, status, contact_id, date_range)
  - `GET /api/v1/comm/messages/:id`
  - `GET /api/v1/comm/messages/:id/timeline` -- detail status events (sent, delivered, read)
- [ ] Controller `templates.controller.ts` (Tache 3.2.5)
- [ ] Controller `comm-stats.controller.ts` (Tache 3.2.10)
- [ ] Controller `optout.controller.ts` (Tache 3.2.11)
- [ ] Controller `comm-preferences.controller.ts` (user-facing preferences)
- [ ] Permissions : `comm.messages.send/read`, `comm.templates.manage`
- [ ] Pagination + filtres consistents
- [ ] Tests E2E

**Fichiers crees / modifies** :
```
repo/apps/api/src/modules/comm/controllers/messages.controller.ts          # ~150 lignes
repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.ts   # ~80 lignes
repo/apps/api/src/modules/comm/dto/{several}.ts                              # createZodDto
```

**Criteres validation** :
- V1 (P0) : POST /send orchestrate + retourne messageId
- V2 (P0) : GET /messages liste avec filtres
- V3 (P0) : GET /:id/timeline retourne events
- V4 (P0) : RBAC + multi-tenant respectes
- V5 (P0) : Pagination
- V6 (P1) : Tests E2E 10+ scenarios

---

## Tache 3.2.13 -- Tests E2E Exhaustifs (40+) + Mocks

**Metadonnees** : Phase 3 / Sprint 9 / P0 / 8h / Depend de 3.2.12

**But** : Suite tests E2E avec Mailhog + mock Meta API + tests integration BullMQ workers.

**Livrables checkables** :

**Tests E2E (40+)** :
- [ ] Send WA template happy path : POST /send -> WA queued -> mock Meta returns ok -> message status='sent'
- [ ] Send Email happy path : POST /send -> email queued -> Mailhog received
- [ ] Routing : preferred_channel='whatsapp' + opt-in -> WA used
- [ ] Routing : preferred_channel='whatsapp' + opt-out -> fallback email
- [ ] Routing : no available channel -> 400
- [ ] WA webhook signature valid : status updated
- [ ] WA webhook signature invalid : 401
- [ ] WA webhook idempotency : duplicate ignored
- [ ] WA incoming message : auto-log interaction CRM
- [ ] STOP keyword : auto opt-out
- [ ] Mailgun webhook bounce hard : auto opt-out
- [ ] Template rendering 3 locales (fr/ar-MA/ar) : RTL correct
- [ ] Worker retry : transient error 3 retries
- [ ] Worker DLQ : 3 echecs -> Kafka DLQ event
- [ ] Opt-out one-click : POST works
- [ ] Opt-out token URL : confirm works
- [ ] Stats endpoint : aggregates correct
- [ ] Permissions : sans permission 403
- [ ] Multi-tenant : isolation respect

**Mocks** :
- [ ] Mock Meta WhatsApp API : retourne message_id synthetic + permet simuler errors (rate limit, invalid template)
- [ ] Mock Mailgun webhook : helpers genere webhooks tests
- [ ] Helpers tests : `sendTestMessage(contactId, template)`, `waitForMailhogMessage(email)`, `waitForJobCompletion(queue, jobId)`

**Fichiers crees / modifies** :
```
repo/apps/api/test/comm/{40+ specs}.e2e-spec.ts                             # multiple files
repo/apps/api/test/comm/fixtures/comm-test-helpers.ts                       # ~150 lignes
repo/apps/api/test/comm/fixtures/mock-meta-server.ts                         # ~120 lignes
repo/apps/api/test/comm/fixtures/mailhog-client.ts                            # reuse Sprint 5
```

**Notes implementation** :
- Mock Meta server : nock ou MSW pour intercept HTTP (vs vrai Meta API)
- BullMQ tests : `await queue.waitUntilReady()` + utiliser test queue isolated
- Reproducibility : reset queues + DB before each test
- CI : tests passent avec services Postgres + Redis + Kafka

**Criteres validation** :
- V1 (P0) : 40+ tests passent
- V2 (P0) : Tests passent CI
- V3 (P0) : Mocks Meta + Mailhog fonctionnent
- V4 (P0) : Coverage : tous flows comm testees
- V5 (P0) : Reproducibility 5x runs

---

## Sortie du Sprint 9

A la fin de l'execution des 13 taches :

```
Communications module fully operational :
  - WhatsApp Cloud API Meta v21.0 integre (templates pre-approved, webhooks signature HMAC)
  - Email SMTP avec DKIM + SPF + DMARC ready
  - 60+ templates seed (20 templates x 3 locales fr/ar-MA/ar avec RTL)
  - BullMQ queues wa-send + email-send + retry exponential + DLQ
  - Message orchestrator routing par preferred_channel + opt-out check
  - Delivery tracking complete (sent -> delivered -> read -> bounced)
  - Opt-out CNDP : token public URL + one-click + STOP keyword auto
  - Stats + alertes bounce rate

Pattern complete utilise par :
  - Sprint 5 Auth (verify-email, password-reset, mfa-enabled, etc.)
  - Sprint 6 Tenant (invitation, suspended)
  - Sprint 8 Booking (reminders) -- consume orchestrator
  - Sprint 14+ Insure (police signed, payment due)
  - Sprint 20+ Repair (sinistre acknowledged, devis ready)

40+ tests E2E avec mocks
```

**Sprint 10 demarre avec** :
- Notifications operationnelles
- Auto-log interactions CRM via Kafka events
- Customer Communication = pillar pour Customer Portal Sprint 18

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-3.2.X-*.md` dans `00-pilotage/prompts-taches/sprint-09-comm/`.

**Patterns code inline conserves** : Meta API send template request, signature HMAC verification, WaSendWorker structure, message orchestrator routing logic.

**Reference** : `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` lignes 400-500 = tables comm_*. `00-pilotage/documentation/2-variables-environnement.env` = catalog WHATSAPP_* + EMAIL_*.

---

**Fin du meta-prompt B-09 v2.2 format Option B.**
