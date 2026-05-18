# SUMMARY -- Sprint 9 Communications WhatsApp + Email + 4 Locales (fr / ar-MA / ar / en) + Opt-out CNDP

**Sprint** : 9 / 35 (cumul) -- Phase 3 Sprint 2 (Modules Horizontaux)
**Phase** : 3 -- Modules Horizontaux
**Position** : Apres Sprint 8 CRM + Booking, avant Sprint 10 Docs + Signature
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md`
**Reference documentation** : `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` (tables comm_*) + `2-variables-environnement.env` (WHATSAPP_*, EMAIL_*)
**Effort total Sprint 9** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous flows utilisateur communications multi-canal)
**Numerotation taches** : 3.2.1 a 3.2.13 (13 taches au total)
**Mode generation** : v2 dense -- chaque prompt task auto-suffisant 125-185 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. Vue d'ensemble Sprint 9

Le Sprint 9 livre le **systeme communications multi-canal complet** : WhatsApp Cloud API (Meta Business Platform v21.0) + Email SMTP (Mailgun EU prod) + templates Handlebars 4 locales (fr / ar-MA Darija / ar formel / en) avec RTL automatique pour ar/ar-MA, routing automatique par `preferred_channel` du contact (Sprint 8), opt-out management conformite CNDP loi 09-08, et delivery tracking complet sent->delivered->read->bounced.

A la sortie du Sprint 9 :

- WhatsApp Cloud API Meta v21.0 integre (templates pre-approved + workflow approval Meta)
- Email SMTP avec DKIM signing (relaxed/relaxed RSA-SHA256) + SPF + DMARC ready (Mailgun region EU pour conformite RGPD + latence MA < 30ms)
- 80+ templates seed pre-ecrits : 20 templates fonctionnels x 4 locales (auth 5 + booking 3 + insure 5 + repair 4 + tenant 3)
- BullMQ queues `wa-send` + `email-send` + `wa-webhook-process` + `email-webhook-process` avec retry exponential 1s/5s/30s + DLQ Kafka topic `insurtech.events.dlq.comm`
- Webhook receivers Meta + Mailgun avec verification signature HMAC SHA-256 timing-safe + idempotency body hash
- Message orchestrator routing automatique : `comm.send(contactId, templateName, variables)` -> WhatsApp si preferred + opt-in + template Meta approved + phone E.164 valide, sinon Email si opt-in + email RFC 5322 valide, sinon NoAvailableChannelError
- Delivery tracking : sent -> delivered -> read (WA only) -> bounced (hard auto opt-out / soft retry)
- Opt-out CNDP : table `comm_optouts` + endpoint public `/api/v1/public/optout/:token` (JWT TTL 90j) + One-click RFC 8058 List-Unsubscribe-Post (compliance Gmail) + STOP keyword WA auto opt-out + cooling period 7 jours (loi 31-08 protection consommateurs)
- Stats endpoint `/api/v1/comm/stats` (delivery rate, bounce rate, par canal, last 30 days)
- Alertes : bounce rate > 5% Kafka event + auto-pause envois > 10%
- 50+ tests E2E avec mock Meta API (nock/MSW) + Mailhog dev + reset queues isolated CI

**Phase 3 (Modules Horizontaux) progresse** : Sprint 8 CRM+Booking + Sprint 9 Communications operationnels, prepare Sprint 10 Docs+Signature.

---

## 2. Liste des 13 taches generees

| # | Tache | Fichier | Densite | Effort | Priorite | Depend de |
|---|-------|---------|---------|--------|----------|-----------|
| 3.2.1 | comm_messages entity enrichie + schemas Zod | `task-3.2.1-comm-messages-entity-zod-schemas.md` | ~125 ko | 4h | P0 | Sprint 8 |
| 3.2.2 | WhatsApp Cloud API client (Meta v21.0) | `task-3.2.2-whatsapp-cloud-api-client-meta-v21.md` | ~133 ko | 6h | P0 | 3.2.1 |
| 3.2.3 | WA template renderer + 4 locales | `task-3.2.3-wa-template-renderer-4-locales.md` | ~135 ko | 5h | P0 | 3.2.2 |
| 3.2.4 | WA webhook receiver + signature HMAC verification | `task-3.2.4-wa-webhook-receiver-signature-hmac.md` | ~185 ko | 5h | P0 | 3.2.3 |
| 3.2.5 | Template Manager + 80 templates seed | `task-3.2.5-template-manager-20-templates-seed.md` | ~151 ko | 6h | P0 | 3.2.4 |
| 3.2.6 | Email SMTP client + DKIM/SPF + Mailgun | `task-3.2.6-email-smtp-dkim-spf-mailgun.md` | ~135 ko | 5h | P0 | 3.2.5 |
| 3.2.7 | Email template renderer + RTL ar/ar-MA | `task-3.2.7-email-template-renderer-rtl-ar.md` | ~129 ko | 4h | P0 | 3.2.6 |
| 3.2.8 | BullMQ queues `wa-send` + `email-send` + retry + DLQ | `task-3.2.8-bullmq-queues-wa-email-retry-dlq.md` | ~128 ko | 5h | P0 | 3.2.7 |
| 3.2.9 | Message orchestrator (routing par preferred_channel) | `task-3.2.9-message-orchestrator-routing.md` | ~146 ko | 5h | P0 | 3.2.8 |
| 3.2.10 | Delivery tracking + bounces + alerts | `task-3.2.10-delivery-tracking-bounces-alerts.md` | ~127 ko | 4h | P0 | 3.2.9 |
| 3.2.11 | Opt-out management CNDP + endpoint public | `task-3.2.11-optout-management-cndp-public-endpoint.md` | ~138 ko | 4h | P0 | 3.2.10 |
| 3.2.12 | Endpoints REST `/api/v1/comm/*` | `task-3.2.12-endpoints-rest-comm-api.md` | ~135 ko | 4h | P0 | 3.2.11 |
| 3.2.13 | Tests E2E (50+) + mocks Meta API + Mailhog | `task-3.2.13-tests-e2e-40-mocks.md` | ~130 ko | 8h | P0 | 3.2.12 |

**Total Sprint 9** : 65 heures developpement effectif (effort meta-prompt 75h incluant integration + buffer), 13 taches, **~1797 ko** de prompts taches denses.

---

## 3. Statistiques Sprint 9

### Densites individuelles

```
task-3.2.1   :  ~125 ko  (cible 100-150 ko)  OK
task-3.2.2   :  ~133 ko  (cible 100-150 ko)  OK
task-3.2.3   :  ~135 ko  (cible 100-150 ko)  OK
task-3.2.4   :  ~185 ko  (depasse, justifie : webhook HMAC securite + runbook)
task-3.2.5   :  ~151 ko  (depasse legerement, justifie : 80 seeds templates 4 locales)
task-3.2.6   :  ~135 ko  (cible 100-150 ko)  OK
task-3.2.7   :  ~129 ko  (cible 100-150 ko)  OK
task-3.2.8   :  ~128 ko  (cible 100-150 ko)  OK
task-3.2.9   :  ~146 ko  (cible 100-150 ko)  OK
task-3.2.10  :  ~127 ko  (cible 100-150 ko)  OK
task-3.2.11  :  ~138 ko  (cible 100-150 ko)  OK
task-3.2.12  :  ~135 ko  (cible 100-150 ko)  OK
task-3.2.13  :  ~130 ko  (cible 100-150 ko)  OK
_SUMMARY.md  :   ~15 ko  (synthese)
```

**Densite moyenne** : ~138 ko (cible 125 ko atteinte et depassee)
**Densite minimum** : ~125 ko (>= 100 ko required, OK)
**Densite maximum** : ~185 ko (task 3.2.4 justifie par securite webhook HMAC + runbook ops + tampering tests)
**Volume total Sprint 9** : ~1.8 MB (1797 ko) de prompts taches denses

### Code patterns Sprint 9

| Categorie | Total |
|-----------|-------|
| Fichiers TypeScript executables livres dans les prompts | ~140 |
| Lignes de code TypeScript dans les patterns | ~24000 |
| Tests Vitest unit + integration + E2E specifies | ~360 |
| Criteres validation V1-VN cumulees | ~410 |
| Edge cases documentes | ~165 |
| Templates seed total (4 locales) | 80 (20 fonctionnels x 4 locales) |

### Conformite Maroc couverte

| Loi / Regulation | Articles references | Taches concernees |
|-----------------|---------------------|-------------------|
| Loi 09-08 CNDP (Protection Donnees Personnelles) | Art 4, 7, 18, 26, 28, 51 | 3.2.1, 3.2.4, 3.2.7, 3.2.10, 3.2.11, 3.2.12, 3.2.13 |
| Loi 24-09 ANRT (marketing direct telecom) | Art 6, 12 | 3.2.2, 3.2.3, 3.2.6, 3.2.7, 3.2.9, 3.2.11 |
| Loi 31-08 (protection consommateurs) | Art 36 (cooling period 7 jours) | 3.2.11 |
| ACAPS Circulaire 2018/01 (Assurance) | Art 9 (audit trail 7 ans) | 3.2.1, 3.2.10, 3.2.11, 3.2.12 |
| RGPD extra-territorial | Art 25 (privacy by design) | 3.2.7, 3.2.11 |

---

## 4. Patterns critiques livres

### Pattern Meta API send template HSM (ordered params)

```typescript
// POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
{
  messaging_product: 'whatsapp',
  to: '212612345678',                       // E.164 sans +
  type: 'template',
  template: {
    name: 'police_signed_confirmation',
    language: { code: 'fr' },
    components: [{
      type: 'body',
      parameters: [
        { type: 'text', text: 'Mohamed' },        // {{1}}
        { type: 'text', text: 'POL-2026-001' },   // {{2}}
        { type: 'text', text: '15 mai 2026' },    // {{3}}
      ],
    }],
  },
}
```

### Pattern HMAC SHA-256 webhook verification (timingSafeEqual)

```typescript
const expected = 'sha256=' + createHmac('sha256', env.WHATSAPP_APP_SECRET)
  .update(rawBody).digest('hex');
const sigBuf = Buffer.from(signature);
const expBuf = Buffer.from(expected);
if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
  return res.status(401).send({ error: 'INVALID_SIGNATURE' });
}
```

### Pattern DKIM signing relaxed/relaxed RSA-SHA256

```typescript
// Nodemailer DKIM option : domain skalean-insurtech.ma, selector default
dkim: {
  domainName: 'skalean-insurtech.ma',
  keySelector: 'default',
  privateKey: env.EMAIL_DKIM_PRIVATE_KEY,
  hashAlgo: 'sha256',
  headerFieldNames: 'from:to:subject:date:message-id',
}
```

### Pattern One-click RFC 8058 List-Unsubscribe-Post

```
List-Unsubscribe: <https://api.skalean-insurtech.ma/api/v1/public/optout/{token}>, <mailto:unsubscribe@skalean-insurtech.ma>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

### Pattern STOP keyword WA auto opt-out

```typescript
// Detection inbound message body
const STOP_KEYWORDS = ['STOP', 'ARRET', 'STOP-ALL', 'UNSUBSCRIBE', 'توقف'];
if (STOP_KEYWORDS.some(k => body.toUpperCase().trim() === k)) {
  await optoutService.optOut(contactId, 'whatsapp', 'STOP keyword', 'whatsapp');
}
```

### Pattern routing channel resolver (preferred + opt-in + template approved + valid contact info)

```typescript
let finalChannel: Channel | null = null;
if (preferred === 'whatsapp' && !optedOut.includes('whatsapp') && contact.phone) {
  if (await waRenderer.validateMetaApproved(templateName, locale)) {
    finalChannel = 'whatsapp';
  }
}
if (!finalChannel && !optedOut.includes('email') && contact.email) finalChannel = 'email';
if (!finalChannel) throw new BadRequestException({ code: 'NO_AVAILABLE_CHANNEL' });
```

### Pattern BullMQ worker idempotency (status check)

```typescript
const message = await messagesRepo.findById(messageId);
if (message?.status === 'sent') {
  logger.info({ msg: 'wa_send_skip_already_sent', messageId });
  return;  // skip, idempotent
}
```

### Pattern DLQ Kafka topic insurtech.events.dlq.comm

```typescript
@OnWorkerEvent('failed')
async onFailed(job: Job, err: Error): Promise<void> {
  if (job.attemptsMade >= 3) {
    await kafkaPublisher.publish(Topics.DLQ_COMM, {
      original_data: job.data,
      error: { message: err.message, attempts: job.attemptsMade },
    });
    await messagesRepo.update(job.data.messageId, { status: 'failed', fail_reason: err.message });
  }
}
```

### Pattern locale fallback ar-MA -> ar -> fr -> en

```typescript
async resolveLocale(templateName: string, requested: Locale): Promise<Locale> {
  const chain: Record<Locale, Locale[]> = {
    'ar-MA': ['ar-MA', 'ar', 'fr', 'en'],
    'ar': ['ar', 'fr', 'en'],
    'fr': ['fr', 'en'],
    'en': ['en', 'fr'],
  };
  for (const candidate of chain[requested]) {
    if (await this.exists(templateName, candidate)) return candidate;
  }
  throw new TemplateNotFoundError(templateName);
}
```

### Pattern 4 locales (fr / ar-MA Darija / ar formel / en)

- `fr` : francais standard (defaut Maroc)
- `ar-MA` : arabe darija (familier, expressions marocaines, lettres arabes + RTL)
- `ar` : arabe formel (MSA, fallback institutionnel + RTL)
- `en` : anglais (clientele expat + multinationales)

### Pattern bounce rate alert (cron > 5% / auto-pause > 10%)

```typescript
// Cron toutes les 15 min
const rate = await stats.bounceRateLast24h();
if (rate > 0.10) {
  await kafkaPublisher.publish(Topics.COMM_AUTO_PAUSE, { reason: 'bounce_rate_critical', rate });
  await this.queueService.pauseQueue('email-send');
} else if (rate > 0.05) {
  await kafkaPublisher.publish(Topics.COMM_HIGH_BOUNCE_RATE, { rate });
}
```

### Pattern hard bounce auto opt-out (sender reputation)

```typescript
// Mailgun bounce permanent -> auto opt-out (anti-spam reputation)
if (bounceType === 'permanent') {
  await optoutService.optOut(contactId, 'email', `hard_bounce: ${reason}`, 'admin');
}
// Soft bounce : pas opt-out, BullMQ retry
```

### Pattern token signed JWT optout (TTL 90j + JTI blacklist)

```typescript
const token = jwt.sign(
  { sub: contactId, channel, jti: randomUUID() },
  env.OPTOUT_JWT_SECRET,
  { expiresIn: '90d', issuer: 'skalean-insurtech', audience: 'optout' },
);
// JTI blacklist Redis apres usage (pas re-utilisable, audit clarte)
```

### Pattern multi-tenant isolation strict

```typescript
// Toutes queries comm_messages : tenant_id obligatoire
const messages = await this.repo.find({
  where: { tenant_id: getCurrentTenantId(), status: 'sent' },
});
// Templates : composite key (tenant_id, name, language)
```

### Pattern Kafka events insurtech.events.comm.*

```
insurtech.events.comm.message_sent
insurtech.events.comm.message_delivered
insurtech.events.comm.message_read
insurtech.events.comm.message_failed
insurtech.events.comm.optout_added
insurtech.events.comm.high_bounce_rate
insurtech.events.comm.template_updated
insurtech.events.dlq.comm
```

---

## 5. Workflow execution Sprint 9

### 5.1 Ordre execution (lineaire)

```
3.2.1 (entity + Zod) -- BASE
  -> 3.2.2 (WA Cloud API client Meta v21.0)
    -> 3.2.3 (WA template renderer 4 locales)
      -> 3.2.4 (WA webhook HMAC verification)
        -> 3.2.5 (Template Manager + 80 seeds)
          -> 3.2.6 (Email SMTP DKIM/SPF/Mailgun)
            -> 3.2.7 (Email template renderer RTL)
              -> 3.2.8 (BullMQ queues retry DLQ)
                -> 3.2.9 (Message orchestrator routing)
                  -> 3.2.10 (Delivery tracking + bounces + alerts)
                    -> 3.2.11 (Opt-out CNDP + endpoint public)
                      -> 3.2.12 (Endpoints REST /api/v1/comm/*)
                        -> 3.2.13 (Tests E2E 50+ + mocks) -- VALIDATION FINALE
```

### 5.2 Process generation (rappel)

Pour chaque tache, Cowork genere le prompt task DENSE 125-185 ko a partir du B-09 (lectures obligatoires) puis Claude Code implemente la tache en suivant le prompt SANS jamais avoir besoin de relire B-09.

### 5.3 Validation finale Sprint 9

Apres commit de Tache 3.2.13, lancer la verification automatique sprint via :

```bash
# Tests unit + integration package comm
pnpm --filter @insurtech/comm vitest run --coverage
# Expected : 250+ tests passing, coverage >= 85% global, >= 90% modules critiques

# Tests E2E API comm
pnpm --filter @insurtech/api test:e2e:comm
# Expected : 50+ E2E scenarios passing

# Seeds templates (idempotent)
pnpm --filter @insurtech/api seeds:comm-templates
# Expected : 80 templates (20 x 4 locales) seedees idempotent

# Verification automatique Sprint 9
cat 00-pilotage/verifications/V-09-sprint-09-comm-wa-email.md
# Checklist 60+ items : signature HMAC, opt-out CNDP, RTL, routing, DLQ, etc.
```

**Coverage attendue** :
- >= 85% global package `@insurtech/comm`
- >= 90% modules critiques : signature HMAC, optout service, message orchestrator
- 100% fonctions cryptographiques (signature verify, DKIM signing, JWT optout)

---

## 6. Sortie Sprint 9 (recap)

A la fin de l'execution des 13 taches :

```
Communications module fully operational :
  - WhatsApp Cloud API Meta v21.0 integre (templates pre-approved, webhooks signature HMAC)
  - Email SMTP Mailgun EU + DKIM (relaxed/relaxed RSA-SHA256) + SPF + DMARC ready
  - 80 templates seed (20 fonctionnels x 4 locales fr/ar-MA/ar/en avec RTL ar)
  - BullMQ queues wa-send + email-send + retry exponential 1s/5s/30s + DLQ Kafka
  - Message orchestrator routing par preferred_channel + opt-out check + template approved check
  - Delivery tracking complete (sent -> delivered -> read -> bounced)
  - Opt-out CNDP : token URL signed JWT TTL 90j + One-click RFC 8058 + STOP keyword auto + cooling 7j
  - Stats endpoint + alertes bounce rate > 5% + auto-pause > 10%
  - Multi-tenant isolation strict
  - Audit log + Kafka events (insurtech.events.comm.*)

Pattern complete utilise par :
  - Sprint 5 Auth (verify-email, password-reset, mfa-enabled, account_locked)
  - Sprint 6 Tenant (invitation, suspended, quota_warning)
  - Sprint 8 Booking (appointment_scheduled, reminders 24h, cancelled)
  - Sprint 14+ Insure (quote_generated, police_signed, payment_due, claim_received)
  - Sprint 20+ Repair (sinistre_acknowledged, devis_ready, reparation_started/completed)

Tests :
  - 50+ tests E2E avec mock Meta API (nock/MSW) + Mailhog
  - ~360 scenarios Vitest cumules
  - Coverage 85%+ global, 90%+ modules critiques

Conformite Maroc :
  - Loi 09-08 CNDP : opt-out simple/gratuit/immediate + audit trail 7 ans
  - Loi 24-09 ANRT : marketing direct opt-in explicite
  - Loi 31-08 protection consommateurs : cooling period 7j post-opt-out
  - ACAPS Circulaire 2018/01 : audit messages 7 ans
  - RGPD extra-territorial : privacy by design
```

**Sprint 10 (Phase 3 -- Modules Horizontaux Sprint 3) demarre avec** :

- Communications multi-canal operationnel (WA + Email)
- Opt-out CNDP en place (token + one-click + STOP)
- 80 templates seed prets (4 locales)
- BullMQ + Kafka events fluxes operationnels
- Auto-log interactions CRM via Kafka events Sprint 8
- Customer Communication = pillar pour Customer Portal Sprint 18
- Ready pour Docs + Signature integration (notifications signature pending, document ready, etc.)

---

## 7. Statut generation v2 dense

```
=== Sprint 9 : Comm WhatsApp + Email + 4 Locales -- GENERATION COMPLETE v2 ===

Taches generees     : 13 / 13
Volume total sprint : ~1797 ko (cible 13 x 125 ko = 1625 ko -- OK depasse)

Densites individuelles atteintes :
  - task-3.2.1  : ~125 ko
  - task-3.2.2  : ~133 ko
  - task-3.2.3  : ~135 ko
  - task-3.2.4  : ~185 ko (justifie : webhook HMAC securite + runbook)
  - task-3.2.5  : ~151 ko (justifie : 80 seeds templates 4 locales)
  - task-3.2.6  : ~135 ko
  - task-3.2.7  : ~129 ko
  - task-3.2.8  : ~128 ko
  - task-3.2.9  : ~146 ko
  - task-3.2.10 : ~127 ko
  - task-3.2.11 : ~138 ko
  - task-3.2.12 : ~135 ko
  - task-3.2.13 : ~130 ko
  - _SUMMARY.md : ~15 ko

Densite moyenne     : ~138 ko
Densite minimum     : ~125 ko (>= 100 ko required OK)
Densite maximum     : ~185 ko (justifie task 3.2.4 securite)

Code patterns total sprint     : ~140 fichiers TypeScript
Tests scenarios total sprint   : ~360 cas (Vitest unit + integration + E2E)
Criteres validation total      : ~410 (V1-VN cumules)
Edge cases documentes total    : ~165
Templates seed total           : 80 (20 fonctionnels x 4 locales)

Conformite Maroc couverte      : 5 lois / regulations
Conventions Skalean rappelees  : 14 (toutes)

=== STATUT : OK ===

Prochain sprint a generer : Sprint 10 -- Docs + Signature
                             (Phase 3 -- Modules Horizontaux Sprint 3)
                             Reference : 00-pilotage/meta-prompts/B-10-sprint-10-docs-signature.md
```

---

**Fin du _SUMMARY.md Sprint 9 Communications WhatsApp + Email + 4 Locales (fr / ar-MA / ar / en) + Opt-out CNDP + Delivery Tracking + Tests E2E 50+).**

**Phase 3 -- Modules Horizontaux -- Sprint 2/N (CRM+Booking Sprint 8 done, Comm Sprint 9 done, Docs+Signature Sprint 10 next).**
