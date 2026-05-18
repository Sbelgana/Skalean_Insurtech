# TACHE 3.2.10 -- Delivery Tracking + Bounces + Alerts (WA + Mailgun)

**Sprint** : 9 (Phase 3 / Sprint 2 dans phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.10)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 3.2.11 opt-out auto sur hard bounces, 3.2.12 endpoints stats, 3.2.13 tests E2E delivery, et tous les usages production de comm.send des Sprint 14+)
**Effort** : 4h
**Dependances** : 3.2.9 (message-orchestrator emet messages avec status pending/queued/sent), 3.2.8 (BullMQ workers WaSendWorker + EmailSendWorker setent status='sent' + provider_message_id), 3.2.4 (wa-webhook-processor.consumer.ts publie deja Kafka events status updates pour WhatsApp), 3.2.6 (Mailgun SMTP transport configure + signing key disponible env), 3.2.1 (entity comm_message + status enum + provider_message_id index)
**Densite cible** : 125-140 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer la couche **delivery tracking + bounces + alerts** complete et operationnelle du programme Skalean InsurTech v2.2 qui implemente le tracking exhaustif du cycle de vie des messages communications sortants : suivi des transitions de status `pending -> queued -> sent -> delivered -> read (WhatsApp uniquement) -> failed | bounced (soft|hard)`, ingestion des webhooks Mailgun en temps reel via endpoint public `POST /api/v1/public/webhooks/mailgun` avec verification HMAC SHA-256 selon la convention propre Mailgun (signature = `sha256_hmac(api_key, timestamp + token)`), traitement asynchrone des evenements via Kafka consumer dedie `MailgunWebhookProcessorConsumer` qui parse les payloads Mailgun (`delivered`, `opened`, `clicked`, `unsubscribed`, `complained`, `failed permanent`, `failed temporary`), mise a jour atomique de `comm_messages` avec colonnes `delivered_at`, `read_at`, `opened_at`, `clicked_at`, `bounced_at`, `bounce_type`, `bounce_reason` (Sprint 2 schema deja prevu), distinction stricte entre soft bounces (mailbox plein, serveur timeout, recipient temporary) qui declenchent un retry via BullMQ `email-send` queue avec backoff exponential 5min/30min/2h, et hard bounces (mailbox does not exist, domain invalid, blocked-by-recipient, delivery permanent failure) qui declenchent automatiquement un opt-out via `INSERT INTO comm_optouts (channel='email', source='auto-bounce', reason)` pour proteger la sender reputation domaine `skalean-insurtech.ma` aupres des principaux ESP (Gmail flag senders > 0.5% hard bounce rate, Outlook > 0.3%, Yahoo > 0.4%) ; un service `BounceRateMonitorService` execute en cron interval `COMM_BOUNCE_RATE_CHECK_INTERVAL_MIN=60` (configurable) qui calcule sur fenetre glissante 24h le bounce rate par tenant + canal via aggregation SQL `COUNT(*) FILTER (WHERE status='bounced') / NULLIF(COUNT(*) FILTER (WHERE channel='email'), 0)` et emet un evenement Kafka `comm.high_bounce_rate` sur topic `insurtech.comm.alerts` lorsque le seuil `COMM_BOUNCE_RATE_THRESHOLD_PCT=5` est franchi, integre par Sprint 33 alerting Slack pour notifier les administrateurs ; un mecanisme d'auto-pause des campagnes actives lorsque le seuil critique `COMM_BOUNCE_AUTO_PAUSE_PCT=10` est atteint avec emission `comm.campaign_auto_paused` ; un service `DeliveryTrackingService` exposant des methodes typees `markDelivered`, `markRead`, `markBounced(messageId, bounceType, reason)`, `markOpened`, `markClicked(messageId, openedAt, urlClicked?)`, `markFailed(messageId, code, reason)` qui appliquent les transitions de status legales (refusent transitions impossibles type `delivered -> sent`), gerent les out-of-sequence webhooks (clock skew Mailgun pouvant livrer `delivered` avant que la confirmation `sent` ait ete persistee par le worker BullMQ) via reconciliation par timestamp ; un controleur `CommStatsController` exposant `GET /api/v1/comm/stats` avec aggregations `GROUP BY tenant_id + channel + status + date_trunc('day', sent_at)` sur fenetre 30 jours, latency p95 `sent_at -> delivered_at`, click-through rate (CTR), delivery rate, bounce rate (soft + hard), open rate, conversion funnel pending -> read, pagination cursor-based, RBAC strict via permission `comm.stats.read`, multi-tenant isolation par `getCurrentTenantId()` AsyncLocalStorage Sprint 4 ; le service `comm-stats.service.ts` qui execute les queries Postgres optimisees avec usage des partitions Sprint 35 prevu (table `comm_messages` partitionnee par mois sur `sent_at`) et cache Redis 5min sur agregations couteuses ; un mapping exhaustif des codes erreur fournisseurs : Meta WhatsApp (130 = template not found, 131 = phone not opted-in, 132 = template not approved, 133 = phone capacity exceeded, 470 = message expired, 480 = re-engagement message) et Mailgun (`reject reason: hardfail`, `bounce_classification: address_does_not_exist`, `5xx codes 550 / 552 / 553`) vers un type unifie `BounceReason` categorise (`mailbox_not_found`, `mailbox_full`, `domain_invalid`, `blocked_by_recipient`, `policy_rejection`, `dns_failure`, `network_timeout`, `unknown_permanent`, `unknown_temporary`) afin de permettre une logique business unifiee cross-providers.

L'apport est multiple. **Premierement**, en separant clairement soft bounces (retry-able transient failures) des hard bounces (permanent failures requering opt-out), on protege la sender reputation Skalean InsurTech, ce qui se traduit par une amelioration de la deliverability gloable de 15-25% selon les benchmarks SendGrid 2024 / Postmark 2024 et evite le blacklisting du domaine `skalean-insurtech.ma` par les ESP majeurs (Gmail, Outlook, Yahoo) qui penalisent les senders depassant 0.5% hard bounce rate. **Deuxiemement**, en exposant des stats agregees temps reel via `GET /api/v1/comm/stats`, on permet aux courtiers et admins de mesurer l'efficacite reelle de leurs communications (taux de lecture WhatsApp 87% vs taux d'ouverture email 22% est un benchmark public Litmus 2024), d'identifier les templates sous-performants (CTR < 5% suggere un wording problematique), et de declencher des alertes proactives sans attendre les remontees support. **Troisiemement**, en alertant automatiquement via Kafka `comm.high_bounce_rate` lorsque le bounce rate franchit 5%, on detecte rapidement les attaques (campagne d'inscription fraude avec emails invalides), les imports CRM corrompus (typos en masse), ou les pannes ESP en amont (Gmail rejette temporairement les emails depuis une IP flaggee). **Quatriemement**, en auto-pausant les campagnes actives lorsque le seuil critique 10% est atteint, on evite la propagation d'un probleme local (un mauvais template) en degradation systeme reputation. **Cinquiemement**, le mapping exhaustif des codes erreur Meta + Mailgun vers `BounceReason` unifie permet aux services consommateurs (Sprint 14+ Insure, Sprint 18 Customer Portal) de raisonner sur un vocabulaire commun sans connaitre les specificites par provider.

A l'issue de cette tache, l'API `DeliveryTrackingService.markDelivered(messageId, deliveredAt)` met a jour `comm_messages.status='delivered'` + `delivered_at = ?` + emet Kafka `comm.message_delivered`, l'endpoint public `POST /api/v1/public/webhooks/mailgun` recoit les webhooks Mailgun avec verification HMAC SHA-256 + idempotency par `event-id` Mailgun (sha256 du body en fallback), le consumer `MailgunWebhookProcessorConsumer` traite asynchrone les evenements et propage les transitions vers la table `comm_messages`, les hard bounces declenchent automatiquement `INSERT INTO comm_optouts` pour le contact bounced, les soft bounces sont re-enqueues sur BullMQ `email-send` queue avec retry budget separe (5 tentatives au lieu de 3 pour soft bounce typique mailbox-full), un cron BullMQ Repeatable Job execute `BounceRateMonitorService.checkBounceRates()` toutes les 60min et emet `comm.high_bounce_rate` ou `comm.campaign_auto_paused` selon les seuils, le controleur `GET /api/v1/comm/stats` retourne les agregations multi-tenant + RBAC + cursor-pagination en moins de 200ms p99 (avec cache Redis 5min) et la suite Vitest couvre 25+ tests unitaires + 20+ tests E2E Mailgun webhook avec coverage >= 88% sur le module delivery-tracking.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 envoie environ 50 000 communications par jour en regime nominal Sprint 14+ (estimation : ~3 000 courtiers x 15 messages/jour = 45 000, plus ~5 000 messages auto-system : reminders RDV, notifications status police/sinistre). Sans tracking de delivery, l'application est aveugle sur le pourcentage de messages reellement recus, lus, cliques. Sans gestion des bounces, le domaine d'envoi `skalean-insurtech.ma` se fait progressivement bannir par les ESP majeurs (Gmail flagging > 0.5% hard bounce rate, Outlook > 0.3%, Yahoo > 0.4%) ce qui catastrophe la deliverability globale et impacte les communications transactionnelles critiques (verification email signup Sprint 5, password reset Sprint 5, notifications signature police Sprint 14).

L'industrie reconnait depuis longtemps (RFC 3463 Enhanced Mail System Status Codes, 1996 ; SMTP RFC 5321) la distinction entre **5xx codes (permanent failures)** et **4xx codes (transient failures)**. Mailgun classifie automatiquement via le champ `severity: permanent | temporary` dans ses webhooks (`v3 webhook events API` documentation Mailgun 2024). Les hard bounces representent ~70% des bounces totaux selon Litmus 2024 :
- 50% : `address does not exist` (typo lors de la saisie, compte supprime, employe parti)
- 15% : `domain invalid` (DNS MX inexistant)
- 5% : `blocked by recipient` (ESP a blackliste le sender)

Les soft bounces representent ~30% :
- 20% : `mailbox full` (mailbox storage quota depasse, recoverable apres user nettoyage)
- 5% : `server timeout` (panne temporaire ESP recipient)
- 5% : `policy rejection` (email content trigge filtre anti-spam temporaire)

L'implementation du distinguo soft/hard repose sur le mapping rigoureux des codes provider :

**Mailgun events** :
- `failed` event avec `severity='permanent'` -> hard bounce
- `failed` event avec `severity='temporary'` -> soft bounce
- `failed` event avec `reason='generic'` (rare) -> log + manual review
- `complained` event (user clique "Spam" dans Gmail/Outlook) -> opt-out + flag suspicious
- `unsubscribed` event (one-click unsubscribe Gmail RFC 8058) -> opt-out direct
- `delivered` -> status='delivered'
- `opened` -> opened_at + open_count
- `clicked` -> clicked_at + clicked_url

**WhatsApp webhook events** (Tache 3.2.4 deja livre) :
- `messages.statuses[].status='sent'` -> mais worker BullMQ deja met sent
- `messages.statuses[].status='delivered'` -> delivered_at
- `messages.statuses[].status='read'` -> read_at (only if user a active "Read receipts" in WhatsApp settings)
- `messages.statuses[].status='failed'` -> error code Meta -> status='failed' + bounce_reason

**Codes erreur Meta WhatsApp** (extrait Meta documentation v21.0) :
- 130 : template_not_found (envoie template non synchronise) -> action : re-sync templates
- 131 : phone_not_opted_in (recipient pas opt-in WhatsApp Business) -> action : marquer opt-out WA channel
- 132 : template_not_approved (template en pending_review) -> action : workflow approval Tache 3.2.5
- 133 : phone_capacity_exceeded (Meta rate limit 80 msg/sec) -> action : retry exponential
- 470 : message_expired (24h session window expiree) -> action : utiliser template approved
- 480 : re_engagement_message (24h session window expiree, no template approved) -> action : opt-out fallback email

L'alerte automatique sur depassement de seuils de bounce rate est une best practice security operations recommandee par les guides AWS Postmark / Mailgun Operational Excellence 2024. Sans cette alerte, un probleme de bounce rate accuse peut prendre 24-48h a etre detecte par le support, le temps que des utilisateurs remontent que les emails n'arrivent pas. Dans cette fenetre, la sender reputation se degrade et le retour a la normale prend ensuite 2-4 semaines (les ESP appliquent des "warm-up windows" longs).

L'auto-pause des campagnes au seuil 10% protege contre un scenario typique : un import CRM corrompu cree 5 000 contacts avec des emails typos systematiques (e.g., copier-coller depuis Excel avec un suffixe domaine errone). Sans auto-pause, ces 5 000 emails partent en burst, generent 5 000 hard bounces, et le domaine se fait blacklist. Avec auto-pause au seuil 10%, le systeme stoppe l'envoi apres ~500 messages bounced, ce qui contient le risque.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas de tracking, juste fire-and-forget | Simple | Aveugle sur deliverability, sender reputation degrade | REJETE -- non-acceptable |
| Tracking via SaaS dedie (Postmark, Litmus) | Setup rapide, rapports natifs | Vendor lock-in, cost, sortie data US | DEFFERE Sprint 35 evaluation |
| Tracking custom via webhooks Mailgun + Meta (RETENU) | Controle complet, multi-provider, integre Kafka | Implementation custom, maintenance bounces classification | RETENU |
| Webhook receiver synchrone (process inline) | Code simple | Bloque webhook Meta/Mailgun > 5s -> retry storm | REJETE |
| Webhook receiver async via Kafka consumer (RETENU) | < 200ms response, scale, retry-safe | Complexite Kafka topic + consumer | RETENU |
| Bounce classification manual rules custom | Controle | Maintenance lourde, edge cases nombreux | REJETE |
| Bounce classification via field `severity` Mailgun + codes Meta (RETENU) | Trust provider classification, simple | Depend formats providers | RETENU |
| Auto opt-out hard bounce immediate | Conserve reputation | Faux positifs (typo recovered) | RETENU avec grace period 7j |
| Auto opt-out hard bounce + grace period 7j (RETENU) | Robuste contre faux positifs | Logique plus complexe | RETENU |
| Bounce rate monitoring via cron (RETENU) | Decouple, trace historique | Latency 60min jusqu'au alert | RETENU 60min acceptable, Sprint 33 +5min real-time |
| Bounce rate monitoring via streaming Kafka real-time | Latency < 1min | Complexite Flink/Kafka Streams Sprint 33 | DEFFERE Sprint 33 |
| Stats endpoint with materialized view Postgres | Perf O(1) | Refresh complexity | DEFFERE Sprint 35 |
| Stats endpoint with raw GROUP BY + Redis cache (RETENU) | Simple, perf < 200ms p99 avec cache 5min | Cache invalidation logic | RETENU |
| Pixel tracking inline image for opens | Open rate disponible | Bloque par Apple Mail Privacy Protection (~50% iOS users) | RETENU avec disclaimer fiabilite |
| Click tracking via URL rewriting Mailgun | Auto, fiable | URL rewrite affecte branding | RETENU (Mailgun click tracking active) |

### 2.3 Trade-offs

Choisir webhook async via Kafka consumer implique d'accepter une latency typique 200ms-2s entre la reception du webhook par le controller et la mise a jour effective de `comm_messages.status` (Kafka roundtrip + consumer processing). En contrepartie, le controller retourne 200 OK en < 50ms ce qui est essentiel pour Mailgun (qui retry agressivement si pas de 200 sous 5s) et Meta (idem 5s). Si on traitait inline, un blocage DB temporaire (lock contention sur `comm_messages` pendant un VACUUM ou un long-running query) ferait timeout le webhook et provoquerait des retries inutiles (10-100x duplication temporaire).

Choisir auto opt-out sur hard bounce implique d'accepter qu'un faux positif (typo ESP recovered next day) bloque les communications futures vers ce contact jusqu'a re-opt-in manuel. La grace period 7 jours mitige : pendant 7 jours apres le hard bounce, le contact reste dans la table `comm_optouts` avec `pending_grace_until = bounced_at + 7 days`, et le message orchestrator (Tache 3.2.9) skip les contacts en grace. Apres 7 jours, si pas de nouveau hard bounce, on peut re-essayer (logique futur Sprint 14+ : send a single test email apres grace expiration, si delivered alors opt-in restored).

Choisir bounce rate monitoring via cron 60min implique d'accepter une latency 0-60min entre le moment ou un probleme apparait (e.g., import CRM corrompu) et l'alerte. Le seuil critique auto-pause 10% est suffisamment aggressive pour stopper rapidement (apres ~500 messages bounced en regime nominal 50k/jour). En contrepartie, cron simple + stable. Sprint 33 introduira monitoring streaming temps reel via Kafka Streams.

Choisir pixel tracking pour open rate implique d'accepter qu'Apple Mail Privacy Protection (iOS 15+, ~50% des utilisateurs iOS, ~30% du parc total) pre-charge tous les pixels en proxy pour anonymiser. Resultat : open rate semble artificiellement haut (les pixels sont charges meme si l'utilisateur n'a pas vraiment ouvert le mail). On documente cette limite dans les stats endpoint. Click tracking est plus fiable (l'utilisateur doit reellement cliquer, pas de pre-fetch).

### 2.4 Decisions strategiques referenced

- decision-001 (Stack imposee TS strict) : EmailService et delivery-tracking 100% typed avec interfaces strictes BounceType + BounceReason.
- decision-006 (No-emoji) : totale.
- decision-007 (Zod runtime validation) : MailgunWebhookSchema valide payload received avant DB write.
- decision-008 (Cloud souverain MA) : Mailgun region EU configure (proximite + RGPD), Sprint 35 evalue migration Atlas Email + Maroc Telecom Mail Pro.
- decision-009 (Multi-locale) : indirect, stats grouped by template lang.
- decision-014 (Audit log 7 ans) : webhook events + status changes audites.
- decision-018 (Templates Handlebars) : indirect, stats par template lang ar-MA / fr-MA.
- decision-022 (Kafka events orchestration) : `comm.high_bounce_rate`, `comm.campaign_auto_paused`, `comm.message_delivered`, `comm.message_bounced` topiques utilises.

### 2.5 Pieges techniques connus

1. **Mailgun timestamp drift > 5min** : si le serveur Skalean a un clock skew > 5min vs Mailgun, la verification `timestamp + token` echoue car timestamps trop vieux/futurs sont rejetes. Solution : NTP sync stricte + tolerance 5min dans verification.
2. **Mailgun replay attack** : un attacker peut intercepter un webhook valide (timestamp + token + signature) et le rejouer plus tard. Mitigation : reject si `now() - timestamp > 5min`, et idempotency par `event-id` Mailgun (UUID).
3. **Webhook out-of-sequence** : Mailgun peut livrer `delivered` avant que la confirmation `sent` ait ete persistee par le worker BullMQ (clock skew + Kafka lag). Solution : reconciliation par timestamp -- si `delivered_at < sent_at`, garder `sent_at = delivered_at` (ne pas retro-corriger sent en futur).
4. **Hard bounce typo recovered** : un user fait un typo, le mailbox correct est cree par l'utilisateur ulterieurement (rare mais possible). Sans grace period, on bloque le contact a vie. Solution : grace 7 jours.
5. **Soft bounce cumulatif** : 5+ soft bounces en 30 jours sur le meme recipient = escalade vers hard bounce. Industry best practice (Postmark guide 2024). Solution : counter `soft_bounce_count_30d` + escalation rule.
6. **Click tracking proxy URL** : Mailgun rewrite tous les liens en `https://email.mailgun.org/c/...` qui redirige vers l'URL originale. Affecte branding (URL n'est plus skalean.ma dans hover). Acceptable trade-off pour analytics.
7. **Pixel tracking blocked Apple** : Apple Mail Privacy Protection iOS 15+ pre-charge tous les pixels en proxy. Resultat : open rate artificiellement gonfle (~30-50%). Documenter dans dashboard Sprint 18.
8. **Mailgun retry policy** : Mailgun retry webhooks jusqu'a 8h apres premier echec si pas de 200 OK. Notre endpoint DOIT retourner 200 meme si processing async fail ulterieurement.
9. **DST transition mid-stats** : queries `date_trunc('day', sent_at)` sur fenetre 30j peuvent inclure un changement DST -> certaines journees ont 23h ou 25h. Solution : timezone-aware via `AT TIME ZONE 'Africa/Casablanca'` + Postgres gere DST transitions correctement (pas de DST au Maroc actuellement, mais compatibilite future).
10. **comm_messages partition Sprint 35** : table partitionnee par mois sur `sent_at`. Stats query > 30j cross plusieurs partitions. Sprint 35 verifiera plan executor utilise partition pruning.
11. **High bounce rate during campaign launch** : un launch initial peut avoir 10-15% bounces si la liste contient des contacts vieux non-nettoyees. Auto-pause au 10% pourrait bloquer une campagne legitime. Solution : configurable per-campaign via flag `bypass_auto_pause: true` (avec audit log + role admin).
12. **ESP feedback loop (FBL)** : Yahoo, Outlook, AOL envoient des "complaint reports" via FBL standard quand un user clique "Spam". Mailgun les expose via webhook event `complained`. Necessaire de les traiter -> opt-out + flag suspicious + alerte Sprint 33.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.2.10 livre la couche **delivery tracking + bounces + alerts** consommee par : 3.2.11 (opt-out service consume hard bounce auto opt-out), 3.2.12 (endpoints REST `/api/v1/comm/stats` deja partiellement livre ici, completes par 3.2.12 avec `/messages/:id/timeline`), 3.2.13 (E2E tests integration delivery flow + bounces classification + auto opt-out + stats endpoint + cron monitoring).

### 3.2 Position dans le programme global

- Sprint 9 : ce sprint, tracking foundations.
- Sprint 14 : Insure consume Kafka `comm.message_delivered` pour update status police signed
- Sprint 18 : Customer Portal expose timeline messages au customer via Stats endpoint extended.
- Sprint 22 : Analytics consume tracking events pour dashboards conversion email/WA.
- Sprint 33 : streaming alerting Kafka Streams (real-time vs cron 60min).
- Sprint 35 : partitioning comm_messages by month + materialized view stats.

### 3.3 Diagramme

```
                  +-----------------------------------+
                  | Tache 3.2.9 Message Orchestrator  |
                  | INSERT comm_messages status=pend  |
                  +-----------------+------------------+
                                    |
                    +---------------+----------------+
                    | BullMQ wa-send / email-send    |
                    | Worker -> set sent + msgid     |
                    +---------------+----------------+
                                    |
                                    v
              +---------------------+---------------------+
              | TACHE 3.2.10 (cette tache)                  |
              | DELIVERY TRACKING + BOUNCES + ALERTS        |
              |                                            |
              | + delivery-tracking.service.ts (markX)     |
              | + Mailgun webhook controller + signature   |
              | + Mailgun webhook processor consumer Kafka |
              | + WA webhook processor extended Tache 3.2.4|
              | + bounce-rate-monitor.service.ts cron 60min|
              | + comm-stats.service.ts + controller       |
              | + Kafka events emit comm.high_bounce_rate  |
              | + Kafka events emit comm.campaign_paused   |
              | + Hard bounce -> auto opt-out (Tache 3.2.11)|
              | + Soft bounce -> retry BullMQ              |
              +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                | | | | | | | | | | | | | |
                v v v v v v v v v v v v v v
                3.2.11 / 3.2.12 / 3.2.13 / Sprint 14+ /
                Sprint 18 Customer Portal / Sprint 22 Analytics /
                Sprint 33 Slack alerting / Sprint 35 partitioning
```

### 3.4 Sequence diagram : Mailgun webhook delivered event

```
Mailgun ESP                         /api/v1/public/webhooks/mailgun
  |                                          |
  | POST event.json (delivered)              |
  | + signature header                       |
  | --------------------------------------> |
  |                                          |
  |                                          | MailgunSignatureMiddleware
  |                                          |   compute sha256(api_key, ts+token)
  |                                          |   timingSafeEqual signature
  |                                          |   reject if ts > now - 5min
  |                                          |
  |                                          | Controller insert webhook row
  |                                          |   idempotency_key = event-id
  |                                          |   status = 'received'
  |                                          |
  |                                          | Kafka publish
  |                                          |   topic = insurtech.comm.webhooks_received
  |                                          |   key = event-id
  |                                          |   value = parsed event
  |                                          |
  | <---------- 200 OK ---------------------- |
  |                                          |
  |                                          v
  |                          MailgunWebhookProcessorConsumer (Kafka)
  |                                          |
  |                                          | DeliveryTrackingService.markDelivered
  |                                          |   UPDATE comm_messages
  |                                          |   SET status='delivered',
  |                                          |       delivered_at=ts
  |                                          |   WHERE provider_message_id=mid
  |                                          |
  |                                          | Kafka publish
  |                                          |   topic = insurtech.comm.message_delivered
  |                                          |
  |                                          | Audit log row
  |                                          |
```

### 3.5 Sequence diagram : Mailgun webhook hard bounce

```
Mailgun ESP -> POST event.json (failed, severity=permanent)
                                          |
                                          v
                                signature verify OK
                                webhook row insert
                                Kafka publish webhooks_received
                                200 OK retourne
                                          |
                                          v
                            MailgunWebhookProcessorConsumer
                                          |
                                          | parse event.severity = 'permanent'
                                          | classify BounceReason via reason+code
                                          |
                                          v
                            DeliveryTrackingService.markBounced(
                              messageId, type='hard', reason=mailbox_not_found
                            )
                                          |
                                          v
                            UPDATE comm_messages SET
                              status='bounced',
                              bounced_at=now,
                              bounce_type='hard',
                              bounce_reason='mailbox_not_found'
                                          |
                                          v
                            Hard bounce -> auto opt-out (Tache 3.2.11)
                              INSERT comm_optouts (
                                contact_id, channel='email',
                                source='auto-bounce',
                                reason='hard_bounce_mailbox_not_found',
                                grace_until=now + 7 days
                              ) ON CONFLICT DO NOTHING
                                          |
                                          v
                            Kafka publish comm.message_bounced
                            Kafka publish comm.optout_added (Tache 3.2.11)
```

### 3.6 Sequence diagram : Bounce rate monitoring cron

```
BullMQ Repeatable Job (cron */60 * * * *)
                                          |
                                          v
                          BounceRateMonitorService.checkBounceRates()
                                          |
                                          v
                          For each tenant_id active:
                            SELECT
                              channel,
                              COUNT(*) AS total_sent,
                              COUNT(*) FILTER (WHERE status='bounced') AS bounced,
                              ROUND(100.0 * bounced / NULLIF(total_sent, 0), 2) AS rate_pct
                            FROM comm_messages
                            WHERE tenant_id=$1
                              AND sent_at > NOW() - INTERVAL '24 hours'
                              AND channel='email'
                            GROUP BY channel
                                          |
                                          v
                          if rate_pct > COMM_BOUNCE_AUTO_PAUSE_PCT (10%):
                            Kafka publish comm.campaign_auto_paused
                            UPDATE comm_campaigns SET status='paused' WHERE active
                            audit log
                                          |
                                          v
                          else if rate_pct > COMM_BOUNCE_RATE_THRESHOLD_PCT (5%):
                            Kafka publish comm.high_bounce_rate
                            audit log
                                          |
                                          v
                          else: log info (nominal)
```

---

## 4. Livrables checkables (32 livrables)

- [ ] Service `repo/packages/comm/src/services/delivery-tracking.service.ts` -- ~250 lignes
- [ ] Service `repo/packages/comm/src/services/comm-stats.service.ts` -- ~180 lignes
- [ ] Service `repo/packages/comm/src/services/bounce-rate-monitor.service.ts` -- ~150 lignes
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/mailgun-webhook.controller.ts` -- ~150 lignes
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/comm-stats.controller.ts` -- ~120 lignes
- [ ] Middleware `repo/apps/api/src/modules/comm/middleware/mailgun-signature.middleware.ts` -- ~80 lignes
- [ ] Consumer `repo/apps/api/src/modules/comm/consumers/mailgun-webhook-processor.consumer.ts` -- ~250 lignes
- [ ] Types `repo/packages/comm/src/types/mailgun-webhook.types.ts` -- ~120 lignes
- [ ] Types `repo/packages/comm/src/types/bounce.types.ts` -- ~80 lignes (BounceType + BounceReason)
- [ ] Tests `repo/packages/comm/src/services/delivery-tracking.service.spec.ts` -- 25+ tests, ~250 lignes
- [ ] Tests `repo/apps/api/test/comm/mailgun-webhook.e2e-spec.ts` -- 20+ tests, ~250 lignes
- [ ] Index `repo/packages/comm/src/index.ts` -- exports DeliveryTrackingService + types
- [ ] Module `repo/apps/api/src/modules/comm/comm.module.ts` -- register controllers + middleware + consumer + cron
- [ ] Variables env : `MAILGUN_WEBHOOK_SIGNING_KEY`, `MAILGUN_API_KEY`, `COMM_BOUNCE_RATE_THRESHOLD_PCT=5`, `COMM_BOUNCE_AUTO_PAUSE_PCT=10`, `COMM_BOUNCE_RATE_CHECK_INTERVAL_MIN=60`, `COMM_HARD_BOUNCE_GRACE_DAYS=7`, `COMM_SOFT_BOUNCE_ESCALATE_THRESHOLD=5`
- [ ] Mailgun webhook signature HMAC SHA-256 verifie via timingSafeEqual
- [ ] Mailgun timestamp drift > 5min reject
- [ ] Mailgun idempotency par event-id UUID
- [ ] Hard bounce auto opt-out INSERT comm_optouts
- [ ] Soft bounce retry BullMQ email-send queue
- [ ] Bounce rate monitor cron 60min
- [ ] Auto-pause campaigns sur seuil 10%
- [ ] Kafka event comm.high_bounce_rate emit
- [ ] Kafka event comm.campaign_auto_paused emit
- [ ] Kafka event comm.message_delivered emit
- [ ] Kafka event comm.message_bounced emit
- [ ] Stats endpoint GET /api/v1/comm/stats avec aggregations
- [ ] Stats RBAC permission comm.stats.read
- [ ] Stats multi-tenant isolation
- [ ] Stats cache Redis 5min sur agregations couteuses
- [ ] Latency p95 sent->delivered tracked
- [ ] Webhook idempotency (replay-safe)
- [ ] No-emoji
- [ ] No-console
- [ ] Coverage >= 88%
- [ ] Build TypeScript reussit
- [ ] Tous les tests passent (25+ unit, 20+ E2E)

---

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/services/delivery-tracking.service.ts                       (~250 lignes, NEW)
repo/packages/comm/src/services/delivery-tracking.service.spec.ts                  (~250 lignes, NEW)
repo/packages/comm/src/services/comm-stats.service.ts                              (~180 lignes, NEW)
repo/packages/comm/src/services/bounce-rate-monitor.service.ts                     (~150 lignes, NEW)
repo/packages/comm/src/types/mailgun-webhook.types.ts                              (~120 lignes, NEW)
repo/packages/comm/src/types/bounce.types.ts                                        (~80 lignes, NEW)
repo/packages/comm/src/index.ts                                                     (modifie / ajoute exports)
repo/apps/api/src/modules/comm/controllers/mailgun-webhook.controller.ts           (~150 lignes, NEW)
repo/apps/api/src/modules/comm/controllers/comm-stats.controller.ts                 (~120 lignes, NEW)
repo/apps/api/src/modules/comm/middleware/mailgun-signature.middleware.ts           (~80 lignes, NEW)
repo/apps/api/src/modules/comm/consumers/mailgun-webhook-processor.consumer.ts      (~250 lignes, NEW)
repo/apps/api/src/modules/comm/comm.module.ts                                       (modifie / ajoute controllers + middleware + consumer + cron job)
repo/apps/api/test/comm/mailgun-webhook.e2e-spec.ts                                  (~250 lignes, NEW)
repo/apps/api/test/comm/comm-stats.e2e-spec.ts                                       (~150 lignes, NEW)
repo/packages/comm/package.json                                                     (modifie / aucune nouvelle dep, undici deja Sprint 9 task 3.2.2)
.env.example                                                                         (modifie / +MAILGUN_WEBHOOK_SIGNING_KEY + COMM_BOUNCE_*)
```

Total : 14 fichiers crees/modifies, ~2 100 lignes effectives + tests.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 12 : `bounce.types.ts`

```typescript
/**
 * @insurtech/comm/types/bounce.types
 *
 * BounceType + BounceReason unified taxonomy mapping Mailgun severity + Meta error codes.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.10 (this task)
 *   - RFC 3463 Enhanced Mail System Status Codes
 *   - Mailgun events API v3
 *   - Meta WhatsApp Business Platform v21.0 error codes
 */

export type BounceType = 'soft' | 'hard';

/**
 * Categorisation des bounces unifiee cross-providers.
 * Mapping :
 *   - mailbox_not_found       : Mailgun severity=permanent + reason ~ /address|recipient/
 *                               Meta WA 131 (phone_not_opted_in interpretee comme address invalide)
 *   - mailbox_full            : Mailgun severity=temporary + reason ~ /quota|full/
 *   - mailbox_inactive        : Mailgun severity=permanent + reason ~ /inactive|deactivated/
 *   - domain_invalid          : Mailgun severity=permanent + reason ~ /domain|MX/
 *                               Meta WA 130 (template not found = domain config issue equivalent)
 *   - blocked_by_recipient    : Mailgun severity=permanent + reason ~ /blocked|blacklist/
 *                               Meta WA 480 (re-engagement message rejected)
 *   - policy_rejection        : Mailgun severity=permanent + reason ~ /policy|spam/
 *   - dns_failure             : Mailgun severity=temporary + reason ~ /dns|resolution/
 *   - network_timeout         : Mailgun severity=temporary + reason ~ /timeout|connection/
 *                               Meta WA 470 (message_expired)
 *   - rate_limited            : Meta WA 133 (phone_capacity_exceeded)
 *   - template_not_approved   : Meta WA 132
 *   - unknown_permanent       : default permanent
 *   - unknown_temporary       : default temporary
 */
export type BounceReason =
  | 'mailbox_not_found'
  | 'mailbox_full'
  | 'mailbox_inactive'
  | 'domain_invalid'
  | 'blocked_by_recipient'
  | 'policy_rejection'
  | 'dns_failure'
  | 'network_timeout'
  | 'rate_limited'
  | 'template_not_approved'
  | 'complaint_spam'
  | 'unsubscribed'
  | 'unknown_permanent'
  | 'unknown_temporary';

export interface BounceClassification {
  type: BounceType;
  reason: BounceReason;
  retry_eligible: boolean;
  auto_opt_out: boolean;
  details?: string;
}

const HARD_BOUNCE_REASONS: ReadonlySet<BounceReason> = new Set([
  'mailbox_not_found',
  'mailbox_inactive',
  'domain_invalid',
  'blocked_by_recipient',
  'policy_rejection',
  'complaint_spam',
  'unsubscribed',
  'template_not_approved',
  'unknown_permanent',
]);

const RETRY_ELIGIBLE_REASONS: ReadonlySet<BounceReason> = new Set([
  'mailbox_full',
  'dns_failure',
  'network_timeout',
  'rate_limited',
  'unknown_temporary',
]);

export function classifyBounce(reason: BounceReason): BounceClassification {
  const isHard = HARD_BOUNCE_REASONS.has(reason);
  const isRetry = RETRY_ELIGIBLE_REASONS.has(reason);
  return {
    type: isHard ? 'hard' : 'soft',
    reason,
    retry_eligible: isRetry,
    auto_opt_out: isHard,
  };
}

/**
 * Maps Mailgun event payload to BounceReason.
 * Mailgun events spec : https://documentation.mailgun.com/en/latest/api-events.html
 */
export function mapMailgunReasonToBounceReason(
  severity: 'permanent' | 'temporary' | undefined,
  reason: string | undefined,
  errorCode?: string,
): BounceReason {
  const r = (reason ?? '').toLowerCase();
  if (severity === 'permanent') {
    if (/(address|recipient).*not.*found|user.*unknown|no.*such.*user/.test(r)) return 'mailbox_not_found';
    if (/inactive|deactivated|disabled/.test(r)) return 'mailbox_inactive';
    if (/domain|mx.*not.*found|host.*not.*found|nxdomain/.test(r)) return 'domain_invalid';
    if (/blocked|blacklist|banned|reject/.test(r)) return 'blocked_by_recipient';
    if (/policy|spam|content/.test(r)) return 'policy_rejection';
    return 'unknown_permanent';
  }
  if (severity === 'temporary') {
    if (/quota|full|over.?limit/.test(r)) return 'mailbox_full';
    if (/dns|resolution/.test(r)) return 'dns_failure';
    if (/timeout|connection|network/.test(r)) return 'network_timeout';
    return 'unknown_temporary';
  }
  // Fallback if no severity
  if (errorCode?.startsWith('5')) return 'unknown_permanent';
  return 'unknown_temporary';
}

/**
 * Maps Meta WhatsApp error code to BounceReason.
 * Meta error codes : https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export function mapMetaErrorCodeToBounceReason(code: number): BounceReason {
  switch (code) {
    case 130: return 'domain_invalid'; // template_not_found ~ config equivalent
    case 131: return 'mailbox_not_found'; // phone_not_opted_in
    case 132: return 'template_not_approved';
    case 133: return 'rate_limited';
    case 470: return 'network_timeout'; // message_expired
    case 480: return 'blocked_by_recipient'; // re_engagement_required
    default:
      return code >= 400 && code < 500 ? 'unknown_temporary' : 'unknown_permanent';
  }
}
```

### 6.2 Fichier 2 / 12 : `mailgun-webhook.types.ts`

```typescript
/**
 * @insurtech/comm/types/mailgun-webhook.types
 *
 * Mailgun event webhook payload types (v3 API).
 * Reference : https://documentation.mailgun.com/en/latest/api-events.html
 */

import { z } from 'zod';

export const MailgunSignatureSchema = z.object({
  signature: z.string().regex(/^[a-f0-9]{64}$/, 'signature must be 64-char hex'),
  timestamp: z.string().regex(/^\d+$/, 'timestamp must be unix epoch seconds'),
  token: z.string().min(8),
});

export type MailgunSignature = z.infer<typeof MailgunSignatureSchema>;

export const MailgunEventTypeSchema = z.enum([
  'accepted',
  'delivered',
  'failed',
  'opened',
  'clicked',
  'unsubscribed',
  'complained',
  'stored',
]);

export type MailgunEventType = z.infer<typeof MailgunEventTypeSchema>;

export const MailgunSeveritySchema = z.enum(['permanent', 'temporary']);

export type MailgunSeverity = z.infer<typeof MailgunSeveritySchema>;

export const MailgunMessageHeadersSchema = z.object({
  'message-id': z.string(),
  to: z.string().optional(),
  from: z.string().optional(),
  subject: z.string().optional(),
});

export const MailgunDeliveryStatusSchema = z.object({
  code: z.number().int().optional(),
  description: z.string().optional(),
  message: z.string().optional(),
  attempt_no: z.number().int().optional(),
  retry_seconds: z.number().int().optional(),
  session_seconds: z.number().optional(),
  enhanced_code: z.string().optional(),
});

export const MailgunRecipientSchema = z.string().email();

export const MailgunFlagsSchema = z.object({
  'is-routed': z.boolean().optional(),
  'is-authenticated': z.boolean().optional(),
  'is-system-test': z.boolean().optional(),
  'is-test-mode': z.boolean().optional(),
}).partial();

export const MailgunGeolocationSchema = z.object({
  country: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
}).partial();

export const MailgunClientInfoSchema = z.object({
  'client-name': z.string().optional(),
  'client-os': z.string().optional(),
  'client-type': z.string().optional(),
  'device-type': z.string().optional(),
  'user-agent': z.string().optional(),
}).partial();

export const MailgunEventDataSchema = z.object({
  event: MailgunEventTypeSchema,
  id: z.string(),
  timestamp: z.number(),
  recipient: MailgunRecipientSchema.optional(),
  message: z.object({
    headers: MailgunMessageHeadersSchema,
    attachments: z.array(z.unknown()).optional(),
    size: z.number().int().optional(),
  }).optional(),
  'delivery-status': MailgunDeliveryStatusSchema.optional(),
  severity: MailgunSeveritySchema.optional(),
  reason: z.string().optional(),
  flags: MailgunFlagsSchema.optional(),
  url: z.string().url().optional(), // for clicked events
  ip: z.string().optional(),
  geolocation: MailgunGeolocationSchema.optional(),
  'client-info': MailgunClientInfoSchema.optional(),
  tags: z.array(z.string()).optional(),
  'user-variables': z.record(z.unknown()).optional(),
}).passthrough();

export const MailgunWebhookPayloadSchema = z.object({
  signature: MailgunSignatureSchema,
  'event-data': MailgunEventDataSchema,
});

export type MailgunWebhookPayload = z.infer<typeof MailgunWebhookPayloadSchema>;
export type MailgunEventData = z.infer<typeof MailgunEventDataSchema>;
export type MailgunDeliveryStatus = z.infer<typeof MailgunDeliveryStatusSchema>;
```

### 6.3 Fichier 3 / 12 : `mailgun-signature.middleware.ts`

```typescript
/**
 * @insurtech/api/comm/middleware/mailgun-signature.middleware
 *
 * Mailgun webhook signature verification (HMAC SHA-256 over timestamp+token).
 *
 * Algorithm (Mailgun convention) :
 *   expected = hex(hmac_sha256(MAILGUN_WEBHOOK_SIGNING_KEY, timestamp + token))
 *   timingSafeEqual(received_signature, expected)
 *   reject if (now() - timestamp) > 5min (replay protection)
 */

import { Injectable, Logger, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { MailgunWebhookPayloadSchema } from '@insurtech/comm';

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes

@Injectable()
export class MailgunSignatureMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MailgunSignatureMiddleware.name);
  private signingKey: string;

  constructor(private readonly config: ConfigService) {
    this.signingKey = this.config.get<string>('MAILGUN_WEBHOOK_SIGNING_KEY') ?? '';
    if (!this.signingKey) {
      this.logger.error('MAILGUN_WEBHOOK_SIGNING_KEY not configured');
    }
  }

  use(req: FastifyRequest, _res: FastifyReply, next: (err?: unknown) => void): void {
    if (!this.signingKey) {
      throw new UnauthorizedException({ code: 'MAILGUN_SIGNING_KEY_MISSING' });
    }
    const body = req.body as Record<string, unknown> | undefined;
    if (!body) {
      throw new UnauthorizedException({ code: 'MAILGUN_BODY_MISSING' });
    }

    const parsed = MailgunWebhookPayloadSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn({ issues: parsed.error.issues }, 'Mailgun webhook payload invalid schema');
      throw new UnauthorizedException({ code: 'MAILGUN_INVALID_PAYLOAD' });
    }

    const { signature, timestamp, token } = parsed.data.signature;

    // Replay protection : reject if timestamp too old or too new (clock skew tolerance)
    const ts = Number.parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > REPLAY_WINDOW_SECONDS) {
      this.logger.warn({ ts, now, drift_s: now - ts }, 'Mailgun webhook timestamp drift > 5min');
      throw new UnauthorizedException({ code: 'MAILGUN_TIMESTAMP_DRIFT' });
    }

    // Compute expected signature
    const expected = createHmac('sha256', this.signingKey)
      .update(timestamp + token)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length) {
      this.logger.warn('Mailgun signature length mismatch');
      throw new UnauthorizedException({ code: 'MAILGUN_INVALID_SIGNATURE' });
    }
    if (!timingSafeEqual(sigBuf, expBuf)) {
      this.logger.warn({ event_id: parsed.data['event-data']?.id }, 'Mailgun signature invalid');
      throw new UnauthorizedException({ code: 'MAILGUN_INVALID_SIGNATURE' });
    }

    // Attach parsed event for downstream handler
    (req as FastifyRequest & { mailgunEvent?: unknown }).mailgunEvent = parsed.data['event-data'];
    next();
  }
}
```

### 6.4 Fichier 4 / 12 : `mailgun-webhook.controller.ts`

```typescript
/**
 * @insurtech/api/comm/controllers/mailgun-webhook.controller
 *
 * Public endpoint receiving Mailgun event webhooks.
 * Returns 200 OK in <50ms (async processing via Kafka).
 */

import {
  Body, Controller, HttpCode, HttpStatus, Inject, Logger, Post, Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@insurtech/auth';
import { KafkaPublisher, Topics } from '@insurtech/messaging';
import type { FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CommWebhookReceived } from '@insurtech/comm';
import type { MailgunEventData } from '@insurtech/comm';

@ApiTags('comm-webhooks')
@Controller({ path: 'public/webhooks/mailgun', version: '1' })
export class MailgunWebhookController {
  private readonly logger = new Logger(MailgunWebhookController.name);

  constructor(
    @InjectRepository(CommWebhookReceived)
    private readonly webhooksRepo: Repository<CommWebhookReceived>,
    @Inject('KAFKA_PUBLISHER')
    private readonly kafkaPublisher: KafkaPublisher,
  ) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Receive Mailgun event webhook (public, signature-verified)',
    description: 'Mailgun POSTs delivered/opened/clicked/failed/complained/unsubscribed events. Signature is verified by MailgunSignatureMiddleware applied upstream.',
  })
  async receive(
    @Body() _body: unknown,
    @Req() req: FastifyRequest & { mailgunEvent?: MailgunEventData },
  ): Promise<{ status: 'received'; event_id: string }> {
    const event = req.mailgunEvent;
    if (!event) {
      this.logger.error('mailgunEvent missing on request after signature middleware');
      return { status: 'received', event_id: 'unknown' };
    }

    const idempotencyKey = event.id ?? createHash('sha256')
      .update(JSON.stringify(event))
      .digest('hex');

    try {
      await this.webhooksRepo.insert({
        provider: 'mailgun',
        event_type: event.event,
        idempotency_key: idempotencyKey,
        raw_payload: event as unknown as Record<string, unknown>,
        received_at: new Date(),
        processed_at: null,
      });
    } catch (err) {
      // ON CONFLICT idempotency_key -- already received, skip
      const message = err instanceof Error ? err.message : '';
      if (/duplicate key|unique constraint/i.test(message)) {
        this.logger.debug({ event_id: idempotencyKey }, 'Mailgun webhook duplicate skipped');
        return { status: 'received', event_id: idempotencyKey };
      }
      this.logger.error({ err: message }, 'Failed to insert webhook row');
      // Continue : we still want to publish Kafka event
    }

    await this.kafkaPublisher.publish(Topics.COMM_WEBHOOK_RECEIVED, {
      key: idempotencyKey,
      value: {
        provider: 'mailgun',
        event_type: event.event,
        event_id: idempotencyKey,
        recipient: event.recipient,
        message_id: event.message?.headers['message-id'],
        timestamp: event.timestamp,
        severity: event.severity,
        reason: event.reason,
        url: event.url,
        delivery_status: event['delivery-status'],
        user_variables: event['user-variables'],
        raw: event,
      },
    });

    this.logger.log({
      action: 'mailgun_webhook_received',
      event_id: idempotencyKey,
      event_type: event.event,
      recipient_masked: event.recipient ? this.maskEmail(event.recipient) : null,
    });

    return { status: 'received', event_id: idempotencyKey };
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return 'invalid';
    if (local.length <= 1) return `${local}***@${domain}`;
    return `${local[0]}***@${domain}`;
  }
}
```

### 6.5 Fichier 5 / 12 : `mailgun-webhook-processor.consumer.ts`

```typescript
/**
 * @insurtech/api/comm/consumers/mailgun-webhook-processor.consumer
 *
 * Kafka consumer processing Mailgun event webhooks asynchronously.
 *
 * Reads from : insurtech.comm.webhooks_received (filtered provider='mailgun')
 * Writes to  : insurtech.comm.message_delivered, message_bounced, message_opened,
 *              message_clicked, optout_added (Tache 3.2.11)
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import {
  CommMessage, CommWebhookReceived,
  DeliveryTrackingService,
  classifyBounce, mapMailgunReasonToBounceReason,
  Topics, KafkaPublisher,
  type MailgunEventData,
} from '@insurtech/comm';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailgunWebhookProcessorConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MailgunWebhookProcessorConsumer.name);
  private consumer: Consumer | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(CommMessage)
    private readonly messagesRepo: Repository<CommMessage>,
    @InjectRepository(CommWebhookReceived)
    private readonly webhooksRepo: Repository<CommWebhookReceived>,
    private readonly tracking: DeliveryTrackingService,
    @Inject('KAFKA_PUBLISHER')
    private readonly publisher: KafkaPublisher,
    @Inject('KAFKA_CLIENT')
    private readonly kafka: Kafka,
  ) {}

  async onModuleInit(): Promise<void> {
    this.consumer = this.kafka.consumer({
      groupId: 'comm-mailgun-webhook-processor',
      sessionTimeout: 30_000,
      heartbeatInterval: 3_000,
    });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topic: Topics.COMM_WEBHOOK_RECEIVED,
      fromBeginning: false,
    });
    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => this.handle(payload),
    });
    this.logger.log('MailgunWebhookProcessorConsumer started');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.consumer) {
      await this.consumer.disconnect();
    }
  }

  private async handle(payload: EachMessagePayload): Promise<void> {
    const raw = payload.message.value?.toString();
    if (!raw) return;
    let parsed: { provider: string; event_type: string; event_id: string; recipient?: string; message_id?: string; timestamp: number; severity?: 'permanent' | 'temporary'; reason?: string; url?: string; delivery_status?: { code?: number; description?: string }; user_variables?: Record<string, unknown>; raw: MailgunEventData };
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      this.logger.warn({ err: err instanceof Error ? err.message : err }, 'Failed to parse Mailgun event JSON');
      return;
    }
    if (parsed.provider !== 'mailgun') return; // ignore other providers

    const eventTime = new Date(parsed.timestamp * 1000);
    const messageId = parsed.message_id;
    if (!messageId) {
      this.logger.warn({ event_id: parsed.event_id }, 'Mailgun event without message_id, skipping');
      await this.markProcessed(parsed.event_id);
      return;
    }

    try {
      switch (parsed.event_type) {
        case 'delivered':
          await this.tracking.markDelivered(messageId, eventTime);
          await this.publisher.publish(Topics.COMM_MESSAGE_DELIVERED, {
            key: messageId,
            value: { message_id: messageId, channel: 'email', delivered_at: eventTime.toISOString() },
          });
          break;

        case 'opened':
          await this.tracking.markOpened(messageId, eventTime);
          await this.publisher.publish(Topics.COMM_MESSAGE_OPENED, {
            key: messageId,
            value: { message_id: messageId, opened_at: eventTime.toISOString() },
          });
          break;

        case 'clicked':
          await this.tracking.markClicked(messageId, eventTime, parsed.url);
          await this.publisher.publish(Topics.COMM_MESSAGE_CLICKED, {
            key: messageId,
            value: { message_id: messageId, clicked_at: eventTime.toISOString(), url: parsed.url },
          });
          break;

        case 'failed':
          await this.handleFailed(messageId, parsed, eventTime);
          break;

        case 'complained':
          await this.tracking.markBounced(messageId, 'hard', 'complaint_spam');
          await this.publisher.publish(Topics.COMM_OPTOUT_ADDED, {
            key: messageId,
            value: {
              message_id: messageId, channel: 'email',
              source: 'auto-complaint', reason: 'complaint_spam',
              flagged_suspicious: true,
            },
          });
          break;

        case 'unsubscribed':
          await this.tracking.markBounced(messageId, 'hard', 'unsubscribed');
          await this.publisher.publish(Topics.COMM_OPTOUT_ADDED, {
            key: messageId,
            value: {
              message_id: messageId, channel: 'email',
              source: 'one-click-unsubscribe', reason: 'unsubscribed',
            },
          });
          break;

        case 'accepted':
        case 'stored':
          // No status change : already 'sent' from worker
          break;
      }

      await this.markProcessed(parsed.event_id);
    } catch (err) {
      this.logger.error({
        err: err instanceof Error ? err.message : err,
        event_id: parsed.event_id, event_type: parsed.event_type, message_id: messageId,
      }, 'Mailgun event processing failed');
      // Do not commit offset : will be retried by Kafka
      throw err;
    }
  }

  private async handleFailed(messageId: string, parsed: { severity?: 'permanent' | 'temporary'; reason?: string; delivery_status?: { code?: number } }, eventTime: Date): Promise<void> {
    const reason = mapMailgunReasonToBounceReason(
      parsed.severity,
      parsed.reason,
      parsed.delivery_status?.code !== undefined ? String(parsed.delivery_status.code) : undefined,
    );
    const classification = classifyBounce(reason);

    await this.tracking.markBounced(messageId, classification.type, reason);

    await this.publisher.publish(Topics.COMM_MESSAGE_BOUNCED, {
      key: messageId,
      value: {
        message_id: messageId, channel: 'email',
        bounce_type: classification.type, bounce_reason: reason,
        bounced_at: eventTime.toISOString(),
        retry_eligible: classification.retry_eligible,
        auto_opt_out: classification.auto_opt_out,
      },
    });

    if (classification.auto_opt_out) {
      // Hard bounce -> auto opt-out (consumed by Tache 3.2.11)
      await this.publisher.publish(Topics.COMM_OPTOUT_ADDED, {
        key: messageId,
        value: {
          message_id: messageId, channel: 'email',
          source: 'auto-bounce', reason,
          grace_until: new Date(eventTime.getTime() + (this.config.get<number>('COMM_HARD_BOUNCE_GRACE_DAYS', 7) * 24 * 3600 * 1000)).toISOString(),
        },
      });
    } else if (classification.retry_eligible) {
      // Soft bounce -> retry via BullMQ email-send queue (consumed by Sprint 9 Tache 3.2.8 worker)
      await this.publisher.publish(Topics.COMM_MESSAGE_RETRY_REQUESTED, {
        key: messageId,
        value: { message_id: messageId, reason, retry_attempt: 1 },
      });
    }
  }

  private async markProcessed(eventId: string): Promise<void> {
    await this.webhooksRepo.update(
      { idempotency_key: eventId },
      { processed_at: new Date() },
    );
  }
}
```

### 6.6 Fichier 6 / 12 : `delivery-tracking.service.ts`

```typescript
/**
 * @insurtech/comm/services/delivery-tracking.service
 *
 * Status transitions for comm_messages :
 *   pending -> queued -> sent -> delivered -> read (WA only)
 *   pending|queued|sent -> failed | bounced (soft|hard)
 *
 * Out-of-sequence handling : if delivered_at < sent_at (clock skew),
 * keep sent_at = min(sent_at, delivered_at) to preserve causal order.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommMessage, MessageStatus } from '../entities/comm-message.entity.js';
import type { BounceType, BounceReason } from '../types/bounce.types.js';

const FORBIDDEN_TRANSITIONS: Readonly<Record<MessageStatus, ReadonlySet<MessageStatus>>> = {
  pending: new Set(),
  queued: new Set(['pending']),
  sent: new Set(['pending', 'queued']),
  delivered: new Set(['pending', 'queued', 'sent']),
  read: new Set(['pending', 'queued', 'sent', 'delivered']),
  failed: new Set(['failed', 'bounced', 'read']),
  bounced: new Set(['bounced', 'read']),
};

function isLegalTransition(from: MessageStatus, to: MessageStatus): boolean {
  // Cannot regress to a status we already passed
  return !FORBIDDEN_TRANSITIONS[to]?.has(from);
}

@Injectable()
export class DeliveryTrackingService {
  private readonly logger = new Logger(DeliveryTrackingService.name);

  constructor(
    @InjectRepository(CommMessage)
    private readonly messagesRepo: Repository<CommMessage>,
  ) {}

  /**
   * markDelivered -- set status='delivered' + delivered_at.
   * Out-of-sequence safe : if delivered_at < sent_at, normalize sent_at to delivered_at.
   */
  async markDelivered(providerMessageId: string, deliveredAt: Date): Promise<void> {
    const message = await this.messagesRepo.findOne({
      where: { provider_message_id: providerMessageId },
    });
    if (!message) {
      this.logger.warn({ provider_message_id: providerMessageId }, 'markDelivered : message not found');
      return;
    }
    if (!isLegalTransition(message.status, 'delivered')) {
      this.logger.debug({
        provider_message_id: providerMessageId, current_status: message.status,
      }, 'markDelivered : transition skipped (already past delivered)');
      return;
    }

    const updates: Partial<CommMessage> = {
      status: 'delivered',
      delivered_at: deliveredAt,
    };
    // Reconcile out-of-sequence (delivered before sent persisted)
    if (message.sent_at && deliveredAt < message.sent_at) {
      updates.sent_at = deliveredAt;
      this.logger.debug({
        provider_message_id: providerMessageId,
        original_sent_at: message.sent_at, delivered_at: deliveredAt,
      }, 'markDelivered : reconciled sent_at to delivered_at (clock skew)');
    } else if (!message.sent_at) {
      updates.sent_at = deliveredAt;
    }

    await this.messagesRepo.update({ id: message.id }, updates);
    this.logger.log({
      action: 'message_marked_delivered',
      message_id: message.id, provider_message_id: providerMessageId,
      delivered_at: deliveredAt.toISOString(),
    });
  }

  /**
   * markRead -- WhatsApp only (email pas de read receipt fiable).
   */
  async markRead(providerMessageId: string, readAt: Date): Promise<void> {
    const message = await this.messagesRepo.findOne({
      where: { provider_message_id: providerMessageId },
    });
    if (!message) return;
    if (message.channel !== 'whatsapp') {
      this.logger.warn({ channel: message.channel }, 'markRead : skipped, channel != whatsapp');
      return;
    }
    if (!isLegalTransition(message.status, 'read')) return;

    const updates: Partial<CommMessage> = {
      status: 'read',
      read_at: readAt,
    };
    if (!message.delivered_at || readAt < message.delivered_at) {
      updates.delivered_at = readAt;
    }

    await this.messagesRepo.update({ id: message.id }, updates);
    this.logger.log({
      action: 'message_marked_read',
      message_id: message.id, read_at: readAt.toISOString(),
    });
  }

  /**
   * markBounced -- set status='bounced' + bounce_type + bounce_reason.
   * Always allowed (terminal state for failed delivery).
   */
  async markBounced(providerMessageId: string, type: BounceType, reason: BounceReason): Promise<void> {
    const message = await this.messagesRepo.findOne({
      where: { provider_message_id: providerMessageId },
    });
    if (!message) {
      this.logger.warn({ provider_message_id: providerMessageId }, 'markBounced : message not found');
      return;
    }

    const newSoftBounceCount = type === 'soft' ? (message.soft_bounce_count_30d ?? 0) + 1 : message.soft_bounce_count_30d ?? 0;

    await this.messagesRepo.update(
      { id: message.id },
      {
        status: 'bounced',
        bounced_at: new Date(),
        bounce_type: type,
        bounce_reason: reason,
        soft_bounce_count_30d: newSoftBounceCount,
      },
    );

    this.logger.log({
      action: 'message_marked_bounced',
      message_id: message.id, type, reason,
      soft_bounce_count_30d: newSoftBounceCount,
    });
  }

  /**
   * markOpened -- email pixel tracking. Open rate unreliable (Apple Mail Privacy).
   */
  async markOpened(providerMessageId: string, openedAt: Date): Promise<void> {
    const message = await this.messagesRepo.findOne({
      where: { provider_message_id: providerMessageId },
    });
    if (!message) return;
    // Only set opened_at on first open
    if (!message.opened_at) {
      await this.messagesRepo.update(
        { id: message.id },
        {
          opened_at: openedAt,
          open_count: 1,
        },
      );
    } else {
      await this.messagesRepo.increment({ id: message.id }, 'open_count', 1);
    }
    this.logger.debug({
      action: 'message_marked_opened', message_id: message.id,
    });
  }

  /**
   * markClicked -- email click tracking.
   */
  async markClicked(providerMessageId: string, clickedAt: Date, url?: string): Promise<void> {
    const message = await this.messagesRepo.findOne({
      where: { provider_message_id: providerMessageId },
    });
    if (!message) return;
    const updates: Partial<CommMessage> = {
      clicked_at: message.clicked_at ?? clickedAt,
    };
    if (url) {
      updates.last_clicked_url = url;
    }
    await this.messagesRepo.update({ id: message.id }, updates);
    await this.messagesRepo.increment({ id: message.id }, 'click_count', 1);
    this.logger.debug({
      action: 'message_marked_clicked', message_id: message.id, url,
    });
  }

  /**
   * markFailed -- generic failure (worker error, provider 5xx, etc.).
   */
  async markFailed(providerMessageId: string, code: string, reason: string): Promise<void> {
    const message = await this.messagesRepo.findOne({
      where: { provider_message_id: providerMessageId },
    });
    if (!message) return;
    if (!isLegalTransition(message.status, 'failed')) return;

    await this.messagesRepo.update(
      { id: message.id },
      {
        status: 'failed',
        failed_at: new Date(),
        fail_code: code,
        fail_reason: reason,
      },
    );
    this.logger.warn({
      action: 'message_marked_failed',
      message_id: message.id, code, reason,
    });
  }
}
```

### 6.7 Fichier 7 / 12 : `comm-stats.service.ts`

```typescript
/**
 * @insurtech/comm/services/comm-stats.service
 *
 * Aggregations Postgres GROUP BY tenant + channel + status + day.
 * Cache Redis 5min on heavy queries.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Cache } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

export interface CommStatsRow {
  channel: 'whatsapp' | 'email';
  status: 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'bounced';
  day: string; // ISO date
  count: number;
  avg_delivery_latency_s: number | null;
}

export interface CommStatsAggregates {
  delivery_rate_pct: number;
  bounce_rate_pct: number;
  open_rate_pct: number | null;
  click_through_rate_pct: number | null;
  read_rate_pct: number | null; // WA only
  p95_delivery_latency_s: number | null;
  total_sent: number;
  total_delivered: number;
  total_bounced_hard: number;
  total_bounced_soft: number;
  by_day: CommStatsRow[];
}

const CACHE_TTL_S = 300; // 5 minutes

@Injectable()
export class CommStatsService {
  private readonly logger = new Logger(CommStatsService.name);

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getStats(tenantId: string, opts: { fromDate?: Date; toDate?: Date; channel?: 'whatsapp' | 'email'; templateId?: string }): Promise<CommStatsAggregates> {
    const fromDate = opts.fromDate ?? new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const toDate = opts.toDate ?? new Date();
    const cacheKey = this.buildCacheKey(tenantId, fromDate, toDate, opts.channel, opts.templateId);

    const cached = await this.cache.get<CommStatsAggregates>(cacheKey);
    if (cached) {
      this.logger.debug({ tenantId, cacheKey }, 'comm-stats cache hit');
      return cached;
    }

    const byDay = await this.queryByDay(tenantId, fromDate, toDate, opts.channel, opts.templateId);
    const aggregates = this.computeAggregates(byDay, await this.queryP95Latency(tenantId, fromDate, toDate, opts.channel, opts.templateId));
    const result: CommStatsAggregates = { ...aggregates, by_day: byDay };
    await this.cache.set(cacheKey, result, CACHE_TTL_S * 1000);
    return result;
  }

  private async queryByDay(tenantId: string, fromDate: Date, toDate: Date, channel?: string, templateId?: string): Promise<CommStatsRow[]> {
    const params: unknown[] = [tenantId, fromDate, toDate];
    let where = 'tenant_id = $1 AND sent_at >= $2 AND sent_at < $3';
    if (channel) {
      params.push(channel);
      where += ` AND channel = $${params.length}`;
    }
    if (templateId) {
      params.push(templateId);
      where += ` AND template_id = $${params.length}`;
    }
    const rows = await this.ds.query<{ channel: string; status: string; day: string; count: string; avg_delivery_latency_s: string | null }>(
      `SELECT
         channel,
         status,
         to_char(date_trunc('day', sent_at AT TIME ZONE 'Africa/Casablanca'), 'YYYY-MM-DD') AS day,
         COUNT(*) AS count,
         AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at))) FILTER (WHERE delivered_at IS NOT NULL) AS avg_delivery_latency_s
       FROM comm_messages
       WHERE ${where}
       GROUP BY channel, status, day
       ORDER BY day DESC, channel, status`,
      params,
    );
    return rows.map((r) => ({
      channel: r.channel as 'whatsapp' | 'email',
      status: r.status as CommStatsRow['status'],
      day: r.day,
      count: Number.parseInt(r.count, 10),
      avg_delivery_latency_s: r.avg_delivery_latency_s !== null ? Number.parseFloat(r.avg_delivery_latency_s) : null,
    }));
  }

  private async queryP95Latency(tenantId: string, fromDate: Date, toDate: Date, channel?: string, templateId?: string): Promise<number | null> {
    const params: unknown[] = [tenantId, fromDate, toDate];
    let where = 'tenant_id = $1 AND sent_at >= $2 AND sent_at < $3 AND delivered_at IS NOT NULL';
    if (channel) {
      params.push(channel);
      where += ` AND channel = $${params.length}`;
    }
    if (templateId) {
      params.push(templateId);
      where += ` AND template_id = $${params.length}`;
    }
    const rows = await this.ds.query<{ p95_s: string | null }>(
      `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (delivered_at - sent_at))) AS p95_s
       FROM comm_messages WHERE ${where}`,
      params,
    );
    const p95 = rows[0]?.p95_s;
    return p95 !== null && p95 !== undefined ? Number.parseFloat(p95) : null;
  }

  private computeAggregates(rows: CommStatsRow[], p95: number | null): Omit<CommStatsAggregates, 'by_day'> {
    const totals: Record<string, number> = {};
    for (const row of rows) {
      const key = `${row.channel}:${row.status}`;
      totals[key] = (totals[key] ?? 0) + row.count;
    }
    const totalSent =
      (totals['email:sent'] ?? 0) + (totals['email:delivered'] ?? 0) + (totals['email:read'] ?? 0) +
      (totals['email:bounced'] ?? 0) + (totals['email:failed'] ?? 0) +
      (totals['whatsapp:sent'] ?? 0) + (totals['whatsapp:delivered'] ?? 0) + (totals['whatsapp:read'] ?? 0) +
      (totals['whatsapp:bounced'] ?? 0) + (totals['whatsapp:failed'] ?? 0);

    const totalDelivered =
      (totals['email:delivered'] ?? 0) + (totals['email:read'] ?? 0) +
      (totals['whatsapp:delivered'] ?? 0) + (totals['whatsapp:read'] ?? 0);

    const totalBounced = (totals['email:bounced'] ?? 0) + (totals['whatsapp:bounced'] ?? 0);

    return {
      total_sent: totalSent,
      total_delivered: totalDelivered,
      total_bounced_hard: 0, // requires another query for bounce_type breakdown
      total_bounced_soft: 0,
      delivery_rate_pct: totalSent > 0 ? Math.round((totalDelivered / totalSent) * 10000) / 100 : 0,
      bounce_rate_pct: totalSent > 0 ? Math.round((totalBounced / totalSent) * 10000) / 100 : 0,
      open_rate_pct: null,
      click_through_rate_pct: null,
      read_rate_pct: (totals['whatsapp:sent'] ?? 0) + (totals['whatsapp:delivered'] ?? 0) + (totals['whatsapp:read'] ?? 0) > 0
        ? Math.round(((totals['whatsapp:read'] ?? 0) /
          ((totals['whatsapp:sent'] ?? 0) + (totals['whatsapp:delivered'] ?? 0) + (totals['whatsapp:read'] ?? 0))) * 10000) / 100
        : null,
      p95_delivery_latency_s: p95,
    };
  }

  private buildCacheKey(tenantId: string, fromDate: Date, toDate: Date, channel?: string, templateId?: string): string {
    const fromIso = fromDate.toISOString().slice(0, 10);
    const toIso = toDate.toISOString().slice(0, 10);
    return `comm:stats:${tenantId}:${fromIso}:${toIso}:${channel ?? 'all'}:${templateId ?? 'all'}`;
  }
}
```

### 6.8 Fichier 8 / 12 : `bounce-rate-monitor.service.ts`

```typescript
/**
 * @insurtech/comm/services/bounce-rate-monitor.service
 *
 * Cron service (interval = COMM_BOUNCE_RATE_CHECK_INTERVAL_MIN minutes).
 *   For each active tenant :
 *     - Compute bounce rate over last 24h.
 *     - If > COMM_BOUNCE_RATE_THRESHOLD_PCT (5%), emit Kafka comm.high_bounce_rate.
 *     - If > COMM_BOUNCE_AUTO_PAUSE_PCT (10%), emit Kafka comm.campaign_auto_paused + UPDATE comm_campaigns.
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Queue } from 'bullmq';
import { KafkaPublisher, Topics } from '@insurtech/messaging';

interface BounceRateRow {
  tenant_id: string;
  channel: 'whatsapp' | 'email';
  total_sent: number;
  total_bounced: number;
  rate_pct: number;
}

@Injectable()
export class BounceRateMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BounceRateMonitorService.name);
  private cronQueue: Queue | null = null;
  private thresholdPct: number;
  private autoPausePct: number;
  private intervalMin: number;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource() private readonly ds: DataSource,
    @Inject('KAFKA_PUBLISHER')
    private readonly publisher: KafkaPublisher,
    @Inject('BULLMQ_CRON_QUEUE')
    cronQueue: Queue,
  ) {
    this.cronQueue = cronQueue;
    this.thresholdPct = this.config.get<number>('COMM_BOUNCE_RATE_THRESHOLD_PCT', 5);
    this.autoPausePct = this.config.get<number>('COMM_BOUNCE_AUTO_PAUSE_PCT', 10);
    this.intervalMin = this.config.get<number>('COMM_BOUNCE_RATE_CHECK_INTERVAL_MIN', 60);
  }

  async onModuleInit(): Promise<void> {
    if (!this.cronQueue) return;
    // Register repeatable job
    await this.cronQueue.add(
      'comm-bounce-rate-check',
      {},
      {
        repeat: { every: this.intervalMin * 60 * 1000 },
        jobId: 'comm-bounce-rate-check-singleton',
        removeOnComplete: 50,
        removeOnFail: 100,
      },
    );
    this.logger.log({
      threshold_pct: this.thresholdPct, auto_pause_pct: this.autoPausePct,
      interval_min: this.intervalMin,
    }, 'BounceRateMonitorService cron registered');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.cronQueue) {
      await this.cronQueue.removeRepeatableByKey('comm-bounce-rate-check-singleton');
    }
  }

  /**
   * Called by BullMQ worker on cron tick.
   */
  async checkBounceRates(): Promise<void> {
    const start = Date.now();
    const rows = await this.queryBounceRates();
    let alerted = 0;
    let autoPaused = 0;
    for (const row of rows) {
      if (row.total_sent < 10) continue; // skip noise (< 10 sends in 24h)
      if (row.rate_pct >= this.autoPausePct) {
        await this.handleAutoPause(row);
        autoPaused += 1;
      } else if (row.rate_pct >= this.thresholdPct) {
        await this.handleHighBounceRate(row);
        alerted += 1;
      }
    }
    this.logger.log({
      action: 'bounce_rate_check_complete',
      tenants_checked: rows.length,
      alerted, auto_paused,
      duration_ms: Date.now() - start,
    });
  }

  private async queryBounceRates(): Promise<BounceRateRow[]> {
    const result = await this.ds.query<{
      tenant_id: string; channel: string;
      total_sent: string; total_bounced: string; rate_pct: string;
    }>(
      `SELECT
         tenant_id,
         channel,
         COUNT(*)::int AS total_sent,
         COUNT(*) FILTER (WHERE status = 'bounced')::int AS total_bounced,
         ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'bounced') / NULLIF(COUNT(*), 0), 2) AS rate_pct
       FROM comm_messages
       WHERE sent_at >= NOW() - INTERVAL '24 hours'
         AND channel IN ('email', 'whatsapp')
       GROUP BY tenant_id, channel`,
    );
    return result.map((r) => ({
      tenant_id: r.tenant_id,
      channel: r.channel as 'whatsapp' | 'email',
      total_sent: Number.parseInt(r.total_sent, 10),
      total_bounced: Number.parseInt(r.total_bounced, 10),
      rate_pct: Number.parseFloat(r.rate_pct ?? '0'),
    }));
  }

  private async handleHighBounceRate(row: BounceRateRow): Promise<void> {
    this.logger.warn({
      action: 'high_bounce_rate_detected',
      tenant_id: row.tenant_id, channel: row.channel,
      total_sent: row.total_sent, total_bounced: row.total_bounced,
      rate_pct: row.rate_pct,
    });
    await this.publisher.publish(Topics.COMM_HIGH_BOUNCE_RATE, {
      key: `${row.tenant_id}:${row.channel}`,
      value: {
        tenant_id: row.tenant_id,
        channel: row.channel,
        rate_pct: row.rate_pct,
        threshold_pct: this.thresholdPct,
        total_sent: row.total_sent,
        total_bounced: row.total_bounced,
        window_hours: 24,
        detected_at: new Date().toISOString(),
      },
    });
  }

  private async handleAutoPause(row: BounceRateRow): Promise<void> {
    this.logger.error({
      action: 'auto_pause_triggered',
      tenant_id: row.tenant_id, channel: row.channel,
      rate_pct: row.rate_pct,
    });
    await this.ds.query(
      `UPDATE comm_campaigns
       SET status = 'paused',
           paused_at = NOW(),
           paused_reason = 'auto_pause_high_bounce_rate'
       WHERE tenant_id = $1 AND channel = $2 AND status = 'active' AND bypass_auto_pause = false`,
      [row.tenant_id, row.channel],
    );
    await this.publisher.publish(Topics.COMM_CAMPAIGN_AUTO_PAUSED, {
      key: `${row.tenant_id}:${row.channel}`,
      value: {
        tenant_id: row.tenant_id, channel: row.channel,
        rate_pct: row.rate_pct, threshold_pct: this.autoPausePct,
        total_sent: row.total_sent, total_bounced: row.total_bounced,
        paused_at: new Date().toISOString(),
      },
    });
  }
}
```

### 6.9 Fichier 9 / 12 : `comm-stats.controller.ts`

```typescript
/**
 * @insurtech/api/comm/controllers/comm-stats.controller
 *
 * GET /api/v1/comm/stats -- aggregations channel/status/day, last 30 days, RBAC, multi-tenant.
 */

import {
  Controller, Get, Query, UseGuards, Logger,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CurrentTenantId, RequirePermission, JwtAuthGuard, PermissionsGuard,
} from '@insurtech/auth';
import { ZodQueryPipe } from '@insurtech/api-common';
import { CommStatsService, type CommStatsAggregates } from '@insurtech/comm';

const StatsQuerySchema = z.object({
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
  channel: z.enum(['whatsapp', 'email']).optional(),
  template_id: z.string().uuid().optional(),
});

type StatsQuery = z.infer<typeof StatsQuerySchema>;

@ApiTags('comm-stats')
@Controller({ path: 'comm/stats', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CommStatsController {
  private readonly logger = new Logger(CommStatsController.name);

  constructor(private readonly stats: CommStatsService) {}

  @Get()
  @RequirePermission('comm.stats.read')
  @ApiOperation({
    summary: 'Get comm stats (delivery rate, bounce rate, p95 latency, etc.)',
    description: 'Multi-tenant isolated. Cached 5min Redis. Supports channel filter, template filter, date range (max 90 days).',
  })
  @ApiQuery({ name: 'from_date', required: false, type: String })
  @ApiQuery({ name: 'to_date', required: false, type: String })
  @ApiQuery({ name: 'channel', required: false, enum: ['whatsapp', 'email'] })
  @ApiQuery({ name: 'template_id', required: false, type: String })
  async getStats(
    @CurrentTenantId() tenantId: string,
    @Query(new ZodQueryPipe(StatsQuerySchema)) query: StatsQuery,
  ): Promise<CommStatsAggregates> {
    const fromDate = query.from_date ? new Date(query.from_date) : undefined;
    const toDate = query.to_date ? new Date(query.to_date) : undefined;

    if (fromDate && toDate) {
      const diffDays = (toDate.getTime() - fromDate.getTime()) / (24 * 3600 * 1000);
      if (diffDays > 90) {
        throw new Error('date range too large (max 90 days)');
      }
    }

    const result = await this.stats.getStats(tenantId, {
      fromDate, toDate,
      channel: query.channel,
      templateId: query.template_id,
    });

    this.logger.log({
      action: 'comm_stats_queried',
      tenant_id: tenantId, channel: query.channel ?? 'all',
      template_id: query.template_id ?? 'all',
      total_sent: result.total_sent,
      delivery_rate_pct: result.delivery_rate_pct,
      bounce_rate_pct: result.bounce_rate_pct,
    });

    return result;
  }
}
```

### 6.10 Fichier 10 / 12 : Tests `delivery-tracking.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryTrackingService } from '../../src/services/delivery-tracking.service.js';
import { CommMessage } from '../../src/entities/comm-message.entity.js';

describe('DeliveryTrackingService', () => {
  let service: DeliveryTrackingService;
  let repo: any;

  beforeEach(async () => {
    repo = {
      findOne: vi.fn(),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
      increment: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DeliveryTrackingService,
        { provide: getRepositoryToken(CommMessage), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(DeliveryTrackingService);
  });

  describe('markDelivered', () => {
    it('updates status to delivered when status is sent', async () => {
      repo.findOne.mockResolvedValue({
        id: 'msg-1', status: 'sent', channel: 'email',
        sent_at: new Date('2026-05-01T10:00:00Z'),
      });
      await service.markDelivered('mid-1', new Date('2026-05-01T10:01:00Z'));
      expect(repo.update).toHaveBeenCalledWith({ id: 'msg-1' }, expect.objectContaining({
        status: 'delivered',
        delivered_at: new Date('2026-05-01T10:01:00Z'),
      }));
    });

    it('skips when message already at "read" (forbidden regression)', async () => {
      repo.findOne.mockResolvedValue({ id: 'msg-1', status: 'read' });
      await service.markDelivered('mid-1', new Date());
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('reconciles sent_at when delivered_at < sent_at (clock skew)', async () => {
      repo.findOne.mockResolvedValue({
        id: 'msg-1', status: 'sent',
        sent_at: new Date('2026-05-01T10:05:00Z'),
      });
      await service.markDelivered('mid-1', new Date('2026-05-01T10:00:00Z'));
      expect(repo.update).toHaveBeenCalledWith({ id: 'msg-1' }, expect.objectContaining({
        sent_at: new Date('2026-05-01T10:00:00Z'),
      }));
    });

    it('no-op when message not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await service.markDelivered('mid-x', new Date());
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('markRead', () => {
    it('updates to read for whatsapp channel', async () => {
      repo.findOne.mockResolvedValue({
        id: 'msg-1', status: 'delivered', channel: 'whatsapp',
        delivered_at: new Date('2026-05-01T10:01:00Z'),
      });
      await service.markRead('mid-1', new Date('2026-05-01T10:02:00Z'));
      expect(repo.update).toHaveBeenCalledWith({ id: 'msg-1' }, expect.objectContaining({
        status: 'read',
        read_at: new Date('2026-05-01T10:02:00Z'),
      }));
    });

    it('skips for email channel', async () => {
      repo.findOne.mockResolvedValue({
        id: 'msg-1', status: 'delivered', channel: 'email',
      });
      await service.markRead('mid-1', new Date());
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('markBounced', () => {
    it('marks hard bounce with reason mailbox_not_found', async () => {
      repo.findOne.mockResolvedValue({ id: 'msg-1', status: 'sent', soft_bounce_count_30d: 0 });
      await service.markBounced('mid-1', 'hard', 'mailbox_not_found');
      expect(repo.update).toHaveBeenCalledWith({ id: 'msg-1' }, expect.objectContaining({
        status: 'bounced',
        bounce_type: 'hard',
        bounce_reason: 'mailbox_not_found',
      }));
    });

    it('increments soft_bounce_count_30d on soft bounce', async () => {
      repo.findOne.mockResolvedValue({ id: 'msg-1', status: 'sent', soft_bounce_count_30d: 2 });
      await service.markBounced('mid-1', 'soft', 'mailbox_full');
      expect(repo.update).toHaveBeenCalledWith({ id: 'msg-1' }, expect.objectContaining({
        bounce_type: 'soft',
        bounce_reason: 'mailbox_full',
        soft_bounce_count_30d: 3,
      }));
    });
  });

  describe('markOpened', () => {
    it('sets opened_at and open_count=1 on first open', async () => {
      repo.findOne.mockResolvedValue({ id: 'msg-1', opened_at: null });
      await service.markOpened('mid-1', new Date('2026-05-01T11:00:00Z'));
      expect(repo.update).toHaveBeenCalledWith({ id: 'msg-1' }, {
        opened_at: new Date('2026-05-01T11:00:00Z'),
        open_count: 1,
      });
    });

    it('only increments open_count on subsequent opens', async () => {
      repo.findOne.mockResolvedValue({ id: 'msg-1', opened_at: new Date('2026-05-01T11:00:00Z') });
      await service.markOpened('mid-1', new Date('2026-05-01T12:00:00Z'));
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.increment).toHaveBeenCalledWith({ id: 'msg-1' }, 'open_count', 1);
    });
  });

  describe('markClicked', () => {
    it('sets clicked_at on first click + url', async () => {
      repo.findOne.mockResolvedValue({ id: 'msg-1', clicked_at: null });
      await service.markClicked('mid-1', new Date(), 'https://app.skalean.ma/policy/123');
      expect(repo.update).toHaveBeenCalled();
      expect(repo.increment).toHaveBeenCalledWith({ id: 'msg-1' }, 'click_count', 1);
    });
  });

  describe('markFailed', () => {
    it('marks status=failed when transition legal', async () => {
      repo.findOne.mockResolvedValue({ id: 'msg-1', status: 'sent' });
      await service.markFailed('mid-1', '5xx', 'smtp connection refused');
      expect(repo.update).toHaveBeenCalledWith({ id: 'msg-1' }, expect.objectContaining({
        status: 'failed',
        fail_code: '5xx',
        fail_reason: 'smtp connection refused',
      }));
    });

    it('skips when already bounced (terminal state)', async () => {
      repo.findOne.mockResolvedValue({ id: 'msg-1', status: 'bounced' });
      await service.markFailed('mid-1', '5xx', 'whatever');
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
```

### 6.11 Fichier 11 / 12 : Tests `mailgun-webhook.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from '../../src/app.module.js';
import { createHmac } from 'node:crypto';
import { createTestTenant, createTestMessage, getKafkaTestConsumer } from '../helpers/test-helpers.js';

const MAILGUN_KEY = 'test-mailgun-signing-key-32chars';

function signMailgunWebhook(timestamp: string, token: string): string {
  return createHmac('sha256', MAILGUN_KEY).update(timestamp + token).digest('hex');
}

function buildMailgunPayload(eventType: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const ts = String(Math.floor(Date.now() / 1000));
  const tok = 'random-token-abcdef1234567890';
  return {
    signature: { signature: signMailgunWebhook(ts, tok), timestamp: ts, token: tok },
    'event-data': {
      event: eventType,
      id: `evt-${Math.random().toString(36).slice(2)}`,
      timestamp: Math.floor(Date.now() / 1000),
      recipient: 'user@example.com',
      message: { headers: { 'message-id': '<test-mid-1@skalean.ma>' } },
      ...overrides,
    },
  };
}

describe('Mailgun Webhook E2E', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = MAILGUN_KEY;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await createTestTenant('tenant-1');
    await createTestMessage({
      provider_message_id: '<test-mid-1@skalean.ma>',
      tenant_id: 'tenant-1', channel: 'email', status: 'sent',
    });
  });

  it('Mailgun signature valid -> 200 OK', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun',
      payload: buildMailgunPayload('delivered'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'received' });
  });

  it('Mailgun signature invalid -> 401', async () => {
    const payload = buildMailgunPayload('delivered');
    (payload.signature as Record<string, string>).signature = '0'.repeat(64);
    const res = await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun', payload,
    });
    expect(res.statusCode).toBe(401);
  });

  it('Mailgun timestamp drift > 5min -> 401', async () => {
    const oldTs = String(Math.floor(Date.now() / 1000) - 600);
    const tok = 'token-xyz';
    const payload = {
      signature: { signature: signMailgunWebhook(oldTs, tok), timestamp: oldTs, token: tok },
      'event-data': {
        event: 'delivered', id: 'evt-old',
        timestamp: Math.floor(Date.now() / 1000),
        recipient: 'user@example.com',
        message: { headers: { 'message-id': '<test-mid-1@skalean.ma>' } },
      },
    };
    const res = await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun', payload,
    });
    expect(res.statusCode).toBe(401);
  });

  it('Mailgun delivered event -> status updated', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun',
      payload: buildMailgunPayload('delivered'),
    });
    // Wait for async Kafka processing
    await new Promise((r) => setTimeout(r, 1000));
    const msg = await app.get('CommMessageRepository').findOne({ where: { provider_message_id: '<test-mid-1@skalean.ma>' } });
    expect(msg.status).toBe('delivered');
    expect(msg.delivered_at).toBeTruthy();
  });

  it('Mailgun bounce hard -> status=bounced + auto opt-out emit', async () => {
    const consumer = await getKafkaTestConsumer('insurtech.comm.optout_added');
    await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun',
      payload: buildMailgunPayload('failed', {
        severity: 'permanent',
        reason: 'address does not exist',
      }),
    });
    await new Promise((r) => setTimeout(r, 1000));
    const msg = await app.get('CommMessageRepository').findOne({ where: { provider_message_id: '<test-mid-1@skalean.ma>' } });
    expect(msg.status).toBe('bounced');
    expect(msg.bounce_type).toBe('hard');
    expect(msg.bounce_reason).toBe('mailbox_not_found');
    expect(consumer.messages).toHaveLength(1);
    expect(consumer.messages[0].source).toBe('auto-bounce');
  });

  it('Mailgun bounce soft -> retry not opt-out', async () => {
    const optoutConsumer = await getKafkaTestConsumer('insurtech.comm.optout_added');
    const retryConsumer = await getKafkaTestConsumer('insurtech.comm.message_retry_requested');
    await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun',
      payload: buildMailgunPayload('failed', {
        severity: 'temporary', reason: 'mailbox quota exceeded',
      }),
    });
    await new Promise((r) => setTimeout(r, 1000));
    expect(optoutConsumer.messages).toHaveLength(0);
    expect(retryConsumer.messages).toHaveLength(1);
  });

  it('Mailgun complained -> opt-out + flag suspicious', async () => {
    const consumer = await getKafkaTestConsumer('insurtech.comm.optout_added');
    await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun',
      payload: buildMailgunPayload('complained'),
    });
    await new Promise((r) => setTimeout(r, 1000));
    expect(consumer.messages[0]).toMatchObject({
      source: 'auto-complaint', flagged_suspicious: true,
    });
  });

  it('Mailgun unsubscribed -> opt-out direct', async () => {
    const consumer = await getKafkaTestConsumer('insurtech.comm.optout_added');
    await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun',
      payload: buildMailgunPayload('unsubscribed'),
    });
    await new Promise((r) => setTimeout(r, 1000));
    expect(consumer.messages[0]).toMatchObject({ source: 'one-click-unsubscribe' });
  });

  it('Mailgun opened -> opened_at updated', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun',
      payload: buildMailgunPayload('opened'),
    });
    await new Promise((r) => setTimeout(r, 1000));
    const msg = await app.get('CommMessageRepository').findOne({ where: { provider_message_id: '<test-mid-1@skalean.ma>' } });
    expect(msg.opened_at).toBeTruthy();
    expect(msg.open_count).toBe(1);
  });

  it('Mailgun clicked -> clicked_at + URL', async () => {
    await app.inject({
      method: 'POST', url: '/api/v1/public/webhooks/mailgun',
      payload: buildMailgunPayload('clicked', { url: 'https://app.skalean.ma/policy/123' }),
    });
    await new Promise((r) => setTimeout(r, 1000));
    const msg = await app.get('CommMessageRepository').findOne({ where: { provider_message_id: '<test-mid-1@skalean.ma>' } });
    expect(msg.clicked_at).toBeTruthy();
    expect(msg.last_clicked_url).toBe('https://app.skalean.ma/policy/123');
    expect(msg.click_count).toBe(1);
  });

  it('Webhook idempotency : same event-id processed once', async () => {
    const payload = buildMailgunPayload('delivered');
    const r1 = await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/mailgun', payload });
    const r2 = await app.inject({ method: 'POST', url: '/api/v1/public/webhooks/mailgun', payload });
    expect(r1.statusCode).toBe(200);
    expect(r2.statusCode).toBe(200);
    // First insert succeeds, second triggers ON CONFLICT -> still 200
  });

  it('Bounce rate > 5% emits Kafka comm.high_bounce_rate', async () => {
    // Seed 100 messages, 6 bounced
    for (let i = 0; i < 94; i += 1) await createTestMessage({ tenant_id: 'tenant-1', channel: 'email', status: 'sent' });
    for (let i = 0; i < 6; i += 1) await createTestMessage({ tenant_id: 'tenant-1', channel: 'email', status: 'bounced', bounce_type: 'hard' });
    const consumer = await getKafkaTestConsumer('insurtech.comm.high_bounce_rate');
    const monitor = app.get('BounceRateMonitorService');
    await monitor.checkBounceRates();
    await new Promise((r) => setTimeout(r, 500));
    expect(consumer.messages).toHaveLength(1);
    expect(consumer.messages[0].rate_pct).toBe(6);
    expect(consumer.messages[0].tenant_id).toBe('tenant-1');
  });

  it('Bounce rate > 10% triggers auto-pause campaigns', async () => {
    for (let i = 0; i < 89; i += 1) await createTestMessage({ tenant_id: 'tenant-1', channel: 'email', status: 'sent' });
    for (let i = 0; i < 11; i += 1) await createTestMessage({ tenant_id: 'tenant-1', channel: 'email', status: 'bounced', bounce_type: 'hard' });
    const pausedConsumer = await getKafkaTestConsumer('insurtech.comm.campaign_auto_paused');
    const monitor = app.get('BounceRateMonitorService');
    await monitor.checkBounceRates();
    await new Promise((r) => setTimeout(r, 500));
    expect(pausedConsumer.messages).toHaveLength(1);
    expect(pausedConsumer.messages[0].rate_pct).toBe(11);
  });

  it('Stats endpoint aggregates correct', async () => {
    for (let i = 0; i < 20; i += 1) await createTestMessage({ tenant_id: 'tenant-1', channel: 'email', status: 'delivered' });
    for (let i = 0; i < 5; i += 1) await createTestMessage({ tenant_id: 'tenant-1', channel: 'email', status: 'bounced' });
    const res = await app.inject({
      method: 'GET', url: '/api/v1/comm/stats',
      headers: { authorization: 'Bearer admin-jwt-token-tenant-1' },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total_sent).toBe(25);
    expect(body.total_delivered).toBe(20);
    expect(body.bounce_rate_pct).toBe(20);
    expect(body.delivery_rate_pct).toBe(80);
  });

  it('Stats RBAC : missing permission comm.stats.read -> 403', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/v1/comm/stats',
      headers: { authorization: 'Bearer no-perm-jwt-token' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('Stats multi-tenant isolation : tenant-1 sees only own messages', async () => {
    await createTestTenant('tenant-2');
    for (let i = 0; i < 50; i += 1) await createTestMessage({ tenant_id: 'tenant-2', channel: 'email', status: 'sent' });
    const res = await app.inject({
      method: 'GET', url: '/api/v1/comm/stats',
      headers: { authorization: 'Bearer admin-jwt-token-tenant-1' },
    });
    expect(res.json().total_sent).toBe(0); // no messages for tenant-1 yet in this test
  });

  it('p95 sent->delivered latency tracked', async () => {
    for (let i = 0; i < 100; i += 1) {
      const sentAt = new Date(Date.now() - 2000);
      const deliveredAt = new Date(Date.now() - 1000);
      await createTestMessage({
        tenant_id: 'tenant-1', channel: 'email', status: 'delivered',
        sent_at: sentAt, delivered_at: deliveredAt,
      });
    }
    const res = await app.inject({
      method: 'GET', url: '/api/v1/comm/stats',
      headers: { authorization: 'Bearer admin-jwt-token-tenant-1' },
    });
    const body = res.json();
    expect(body.p95_delivery_latency_s).toBeGreaterThan(0);
    expect(body.p95_delivery_latency_s).toBeLessThan(5);
  });

  it('WA webhook status update : sent -> delivered -> read', async () => {
    await createTestMessage({
      provider_message_id: 'wamid.HBgL', tenant_id: 'tenant-1', channel: 'whatsapp', status: 'sent',
    });
    // simulate Tache 3.2.4 publishing to Kafka
    const publisher = app.get('KAFKA_PUBLISHER');
    await publisher.publish('insurtech.comm.webhooks_received', {
      key: 'evt-wa-1',
      value: { provider: 'whatsapp', event_type: 'delivered', message_id: 'wamid.HBgL', timestamp: Math.floor(Date.now() / 1000) },
    });
    await new Promise((r) => setTimeout(r, 1000));
    let msg = await app.get('CommMessageRepository').findOne({ where: { provider_message_id: 'wamid.HBgL' } });
    expect(msg.status).toBe('delivered');

    await publisher.publish('insurtech.comm.webhooks_received', {
      key: 'evt-wa-2',
      value: { provider: 'whatsapp', event_type: 'read', message_id: 'wamid.HBgL', timestamp: Math.floor(Date.now() / 1000) },
    });
    await new Promise((r) => setTimeout(r, 1000));
    msg = await app.get('CommMessageRepository').findOne({ where: { provider_message_id: 'wamid.HBgL' } });
    expect(msg.status).toBe('read');
    expect(msg.read_at).toBeTruthy();
  });
});
```

### 6.12 Fichier 12 / 12 : `index.ts` exports

```typescript
/**
 * @insurtech/comm package public API
 */

// Sprint 9 Tache 3.2.10 additions
export { DeliveryTrackingService } from './services/delivery-tracking.service.js';
export { CommStatsService } from './services/comm-stats.service.js';
export type { CommStatsRow, CommStatsAggregates } from './services/comm-stats.service.js';
export { BounceRateMonitorService } from './services/bounce-rate-monitor.service.js';
export type {
  BounceType, BounceReason, BounceClassification,
} from './types/bounce.types.js';
export {
  classifyBounce, mapMailgunReasonToBounceReason, mapMetaErrorCodeToBounceReason,
} from './types/bounce.types.js';
export type {
  MailgunSignature, MailgunEventType, MailgunSeverity,
  MailgunEventData, MailgunDeliveryStatus, MailgunWebhookPayload,
} from './types/mailgun-webhook.types.js';
export {
  MailgunSignatureSchema, MailgunEventTypeSchema, MailgunWebhookPayloadSchema,
} from './types/mailgun-webhook.types.js';
```

---

## 7. Tests complets

### 7.1 Tests delivery-tracking (25 tests, voir Section 6.10)

Couvre les transitions de status legales/illegales, l'out-of-sequence reconciliation, le multi-channel handling (markRead WA only, markOpened/markClicked email only), le soft_bounce_count_30d incrementation, et les edge cases (message not found, double markOpened, transition vers etat terminal).

### 7.2 Tests Mailgun webhook E2E (20 tests, voir Section 6.11)

Couvre la signature HMAC verification (valid, invalid, length mismatch, replay window), tous les event types Mailgun (`delivered`, `opened`, `clicked`, `failed permanent`, `failed temporary`, `complained`, `unsubscribed`, `accepted`), l'idempotency par event-id, l'auto opt-out sur hard bounce, le retry sur soft bounce, l'integration cron BounceRateMonitorService, le stats endpoint avec RBAC + multi-tenant isolation, le p95 latency tracking, et les WA webhook status updates (sent -> delivered -> read).

### 7.3 Tests bounce classification

```typescript
import { describe, it, expect } from 'vitest';
import {
  classifyBounce, mapMailgunReasonToBounceReason, mapMetaErrorCodeToBounceReason,
} from '../../src/types/bounce.types.js';

describe('Bounce classification', () => {
  it('mailbox_not_found -> hard + auto_opt_out', () => {
    const c = classifyBounce('mailbox_not_found');
    expect(c).toEqual({
      type: 'hard',
      reason: 'mailbox_not_found',
      retry_eligible: false,
      auto_opt_out: true,
    });
  });

  it('mailbox_full -> soft + retry_eligible', () => {
    const c = classifyBounce('mailbox_full');
    expect(c).toEqual({
      type: 'soft',
      reason: 'mailbox_full',
      retry_eligible: true,
      auto_opt_out: false,
    });
  });

  it('Mailgun severity=permanent + reason "address does not exist" -> mailbox_not_found', () => {
    expect(mapMailgunReasonToBounceReason('permanent', 'Address does not exist')).toBe('mailbox_not_found');
  });

  it('Mailgun severity=permanent + reason "domain MX not found" -> domain_invalid', () => {
    expect(mapMailgunReasonToBounceReason('permanent', 'domain MX not found')).toBe('domain_invalid');
  });

  it('Mailgun severity=temporary + reason "mailbox quota exceeded" -> mailbox_full', () => {
    expect(mapMailgunReasonToBounceReason('temporary', 'mailbox quota exceeded')).toBe('mailbox_full');
  });

  it('Mailgun severity=temporary + reason "DNS resolution failure" -> dns_failure', () => {
    expect(mapMailgunReasonToBounceReason('temporary', 'DNS resolution failure')).toBe('dns_failure');
  });

  it('Meta error 130 -> domain_invalid', () => {
    expect(mapMetaErrorCodeToBounceReason(130)).toBe('domain_invalid');
  });

  it('Meta error 131 -> mailbox_not_found', () => {
    expect(mapMetaErrorCodeToBounceReason(131)).toBe('mailbox_not_found');
  });

  it('Meta error 470 -> network_timeout', () => {
    expect(mapMetaErrorCodeToBounceReason(470)).toBe('network_timeout');
  });

  it('Meta error 480 -> blocked_by_recipient', () => {
    expect(mapMetaErrorCodeToBounceReason(480)).toBe('blocked_by_recipient');
  });
});
```

---

## 8. Variables environnement

```env
# Sprint 9 Tache 3.2.10 -- Delivery Tracking + Bounces + Alerts
MAILGUN_WEBHOOK_SIGNING_KEY=                         # Mailgun control panel : Settings > Webhooks > HTTP webhook signing key
MAILGUN_API_KEY=                                     # Already defined Sprint 9 task 3.2.6
COMM_BOUNCE_RATE_THRESHOLD_PCT=5                     # Alert threshold (Kafka comm.high_bounce_rate)
COMM_BOUNCE_AUTO_PAUSE_PCT=10                        # Auto-pause campaigns threshold
COMM_BOUNCE_RATE_CHECK_INTERVAL_MIN=60               # Cron interval minutes
COMM_HARD_BOUNCE_GRACE_DAYS=7                        # Days to keep hard bounce in opt-out before re-eligible
COMM_SOFT_BOUNCE_ESCALATE_THRESHOLD=5                # 5+ soft bounces in 30d -> escalate to hard
COMM_STATS_CACHE_TTL_S=300                           # Redis cache TTL stats endpoint
COMM_STATS_MAX_DATE_RANGE_DAYS=90                    # Max date range allowed in stats query
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/comm test:coverage
pnpm --filter @insurtech/api test:e2e -- --testPathPattern=comm/mailgun-webhook
pnpm --filter @insurtech/api test:e2e -- --testPathPattern=comm/comm-stats
pnpm --filter @insurtech/comm build
```

---

## 10. Criteres validation V1-V30

### P0 (18)

- V1 : `pnpm --filter @insurtech/comm typecheck` passes (strict TS).
- V2 : `pnpm --filter @insurtech/comm build` succeeds.
- V3 : `pnpm --filter @insurtech/comm test` passes (25+ unit tests).
- V4 : `pnpm --filter @insurtech/api test:e2e -- comm/mailgun-webhook` passes (20+ E2E tests).
- V5 : Mailgun signature HMAC SHA-256 verification correct (valid -> 200, invalid -> 401, drift > 5min -> 401).
- V6 : Mailgun idempotency par event-id (replay safe).
- V7 : DeliveryTrackingService.markDelivered set status='delivered' + delivered_at + emit Kafka comm.message_delivered.
- V8 : DeliveryTrackingService.markRead WA only + set read_at.
- V9 : DeliveryTrackingService.markBounced(type, reason) set status='bounced' + bounce_type + bounce_reason.
- V10 : Hard bounce (severity=permanent) -> auto opt-out (Kafka comm.optout_added emit avec source='auto-bounce').
- V11 : Soft bounce (severity=temporary) -> retry request (Kafka comm.message_retry_requested emit).
- V12 : Complaint event -> opt-out + flag_suspicious=true.
- V13 : Unsubscribed event -> opt-out direct (source='one-click-unsubscribe').
- V14 : Out-of-sequence reconciliation : delivered_at < sent_at -> reconcile sent_at = delivered_at.
- V15 : BounceRateMonitorService cron interval = COMM_BOUNCE_RATE_CHECK_INTERVAL_MIN min.
- V16 : Bounce rate > 5% emit Kafka comm.high_bounce_rate.
- V17 : Bounce rate > 10% emit Kafka comm.campaign_auto_paused + UPDATE comm_campaigns SET status='paused'.
- V18 : Stats endpoint GET /api/v1/comm/stats retourne aggregates (total_sent, delivered, bounce_rate_pct, p95).

### P1 (8)

- V19 : Stats RBAC : permission comm.stats.read required (sans -> 403).
- V20 : Stats multi-tenant isolation : tenant-1 sees only own messages.
- V21 : Stats cache Redis 5min sur queries couteuses (cache hit log).
- V22 : Coverage delivery-tracking >= 88%.
- V23 : Coverage mailgun-webhook >= 88%.
- V24 : Webhook controller returns 200 OK in < 50ms p99 (async via Kafka).
- V25 : No-emoji.
- V26 : No-console.

### P2 (4)

- V27 : Bounce classification covers all Mailgun severity + reason combinations.
- V28 : Bounce classification covers all Meta error codes (130, 131, 132, 133, 470, 480).
- V29 : Stats endpoint date range validation max 90 days.
- V30 : Sprint 33 Slack alerting plan documente (consume Kafka comm.high_bounce_rate).

---

## 11. Edge cases (12)

1. **WA read receipt OFF** : si user a desactive "Read receipts" dans WhatsApp Settings, jamais d'event read recu. Solution : status reste 'delivered'. Sprint 18 Customer Portal affiche "Delivered (read receipt unavailable)" apres 24h sans event.

2. **Mailgun signature drift > 5min** : NTP desync ou clock skew Postgres. Reject 401 + log warn. Solution : sync NTP strict + tolerance 5min dans middleware.

3. **Hard bounce mais recipient temporary (typo recovered next day)** : user fait typo `usr@gmail.com` au lieu de `user@gmail.com`, hard bounce immediat. Le lendemain, user corrige et le mailbox correct existe. Sans grace period, on bloque a vie. Solution : grace period 7 jours (`grace_until = bounced_at + 7d` dans comm_optouts). Apres 7 jours, opt-out devient eligible re-test (Sprint 14+ : send single test email).

4. **Soft bounce cumulatif (5+)** : un mailbox toujours full pendant 30 jours genere 5+ soft bounces. Industry best practice : escalate to hard bounce + auto opt-out. Solution : counter `soft_bounce_count_30d` + rule dans markBounced : si soft_bounce_count_30d >= 5, escalate type='hard', reason='unknown_permanent'.

5. **Click tracking proxy URL** : Mailgun rewrite tous links en `https://email.mailgun.org/c/...` qui redirige vers URL originale. Affecte branding (URL n'est plus skalean.ma dans hover). Trade-off accepted pour analytics. Sprint 14+ : custom click tracking domain `track.skalean.ma` CNAME -> Mailgun.

6. **Pixel tracking blocked Apple** : Apple Mail Privacy Protection iOS 15+ pre-charge tous pixels en proxy anonymise. Resultat : opens count gonfle (~30-50% iOS). Documenter dans dashboard Sprint 18 : `open_rate (unreliable Apple Mail Privacy)`. Sprint 22 Analytics : combine open_rate + click_rate pour engagement metric plus fiable.

7. **Webhook replay (Mailgun retries until 200 OK)** : Mailgun retry agressif (jusqu'a 8h). Si controller crash apres insert webhook row mais avant Kafka publish, le webhook reste a state `received` mais Kafka manque l'event. Solution : Sprint 22 watchdog cron consume `comm_webhooks_received WHERE processed_at IS NULL AND received_at < NOW() - 1h` et republish Kafka.

8. **DST transition mid-stats** : queries `date_trunc('day', sent_at AT TIME ZONE 'Africa/Casablanca')` sur fenetre 30j. Maroc actuellement UTC+1 toute l'annee (no DST depuis 2018). Compatible si DST revient. Postgres gere DST transitions correctement.

9. **Stats partition Sprint 35** : table `comm_messages` sera partitionnee par mois sur `sent_at`. Stats query 30 jours cross 1-2 partitions. Sprint 35 verifie EXPLAIN ANALYZE plan utilise partition pruning.

10. **High bounce rate during campaign launch** : un launch initial peut avoir 10-15% bounces si liste vieille non-nettoyee. Auto-pause au 10% pourrait bloquer campagne legitime. Solution : flag `bypass_auto_pause: true` per-campaign (avec audit log + role admin requis pour activation).

11. **Webhook order out-of-sequence** : Mailgun peut livrer `delivered` avant que la confirmation `sent` ait ete persistee par worker BullMQ. Solution : reconciliation par timestamp dans markDelivered : si `delivered_at < sent_at`, normalize sent_at = delivered_at.

12. **ESP feedback loop (FBL)** : Yahoo, Outlook, AOL envoient complaints via FBL standard quand user clique "Spam". Mailgun expose via webhook event `complained`. Necessaire de les traiter -> opt-out + flag suspicious + alerte Sprint 33. Sans FBL processing, on continue d'envoyer a un user qui complaint -> sender reputation degrade vite.

---

## 12. Conformite Maroc

- **Loi 09-08 article 11 (CNDP)** : tracking pixel email = collect IP + User-Agent (donnees personnelles indirectes). Opt-in obligatoire dans CGU + footer disclaimer "Cet email peut contenir un pixel de suivi pour ameliorer nos services" + droit d'opposition (one-click unsubscribe RFC 8058 deja livre Tache 3.2.11 unsubscribed event).

- **Loi 09-08 article 28 (audit log)** : webhook events + status changes audites avec retention 7 ans dans `audit_logs` table (Sprint 4 deja livre). Champs : `tenant_id`, `actor='system'`, `action='comm.webhook_processed' | 'comm.message_delivered' | 'comm.message_bounced'`, `entity_id=message_id`, `details JSONB`.

- **ANRT (Agence Nationale de Reglementation des Telecommunications)** : metriques agregees par tenant (par contre, jamais identifiables par contact individuel publique). Stats endpoint expose pourcentages globaux, jamais liste de contacts bounced (privacy by design).

- **Loi 53-05 article 6 (signature numerique)** : webhook events Mailgun signes HMAC SHA-256 fournit traçabilite preuve juridique des delivery confirmations utilisable en cas de litige (e.g., user pretend ne pas avoir recu police, on demontre delivered_at via audit log + webhook signature verifiee).

- **Sprint 35 cloud souverain** : Mailgun region EU actuellement (Frankfurt). Sprint 35 evaluera migration Atlas Email Service Benguerir (cloud souverain MA) + Maroc Telecom Mail Pro pour conformite ACAPS circulaire 2024 (donnees critiques residentes au Maroc).

---

## 13. Conventions absolues

Multi-tenant : `tenant_id` requis dans toutes queries `comm_messages`, isolation via `WHERE tenant_id = $1` + `getCurrentTenantId()` AsyncLocalStorage Sprint 4. Stats endpoint applique RBAC `comm.stats.read` + multi-tenant strict. Webhook public endpoint bypass auth mais verifie HMAC + idempotency. Validation : Zod runtime sur Mailgun payload (decision-007). Logger Pino : email masque (`u***@example.com`), no token, no signature en clair, no full payload dans logs (juste event_id + event_type + masked recipient). pnpm. TS strict. Tests 25+ unit + 20+ E2E. Skalean AI : aucun. No-emoji. Idempotency : oui (event-id Mailgun ON CONFLICT). Cloud souverain : Mailgun EU Sprint 9, Sprint 35 Atlas/Sendgrid evaluation. Crypto : HMAC SHA-256 timingSafeEqual. JSDoc sur services + helpers + types. Performance : webhook controller < 50ms p99 (async Kafka), stats endpoint < 200ms p99 (cache Redis 5min), markX methods < 10ms p99. Audit log 7 ans retention.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/comm test:coverage

pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test:e2e -- comm/mailgun-webhook
pnpm --filter @insurtech/api test:e2e -- comm/comm-stats

# No-emoji check
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/comm/src apps/api/src/modules/comm && exit 1 || echo OK

# No-console check
grep -rn "console\.log\|console\.error\|console\.warn" packages/comm/src apps/api/src/modules/comm --include="*.ts" && exit 1 || echo OK

# No raw token / signature in logs
grep -rn "logger\.\(log\|debug\|warn\|error\)\(.*signature\|.*token\|.*payload" packages/comm/src apps/api/src/modules/comm --include="*.ts" && echo "WARN: review log content" || echo OK

# Verify env vars present in .env.example
grep -q "MAILGUN_WEBHOOK_SIGNING_KEY" .env.example || (echo "MISSING MAILGUN_WEBHOOK_SIGNING_KEY in .env.example" && exit 1)
grep -q "COMM_BOUNCE_RATE_THRESHOLD_PCT" .env.example || (echo "MISSING COMM_BOUNCE_RATE_THRESHOLD_PCT" && exit 1)
grep -q "COMM_BOUNCE_AUTO_PAUSE_PCT" .env.example || (echo "MISSING COMM_BOUNCE_AUTO_PAUSE_PCT" && exit 1)
grep -q "COMM_BOUNCE_RATE_CHECK_INTERVAL_MIN" .env.example || (echo "MISSING COMM_BOUNCE_RATE_CHECK_INTERVAL_MIN" && exit 1)

echo "All env vars present"
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-09): implement delivery tracking + bounces + alerts (3.2.10)

Implements transactional email + WhatsApp delivery tracking layer with
status transitions (pending -> queued -> sent -> delivered -> read | bounced),
Mailgun webhook receiver with HMAC SHA-256 signature verification (sha256_hmac
api_key, timestamp+token concatenation), Mailgun event types parsing
(delivered, opened, clicked, failed permanent/temporary, complained,
unsubscribed) via Kafka consumer, hard bounce auto opt-out (insert
comm_optouts source='auto-bounce' + grace_until=now+7d), soft bounce
retry via BullMQ email-send queue, BounceRateMonitorService cron 60min
emitting Kafka comm.high_bounce_rate (> 5%) + comm.campaign_auto_paused
(> 10%), unified BounceReason taxonomy across Mailgun severity + Meta
error codes (130, 131, 132, 133, 470, 480), GET /api/v1/comm/stats
endpoint with aggregations (delivery_rate, bounce_rate, p95 latency,
read_rate, by_day breakdown), Redis cache 5min, RBAC comm.stats.read,
multi-tenant isolation, out-of-sequence webhook reconciliation (clock skew),
event-id idempotency.

Livrables :
- DeliveryTrackingService (markDelivered, markRead, markBounced,
  markOpened, markClicked, markFailed) ~250 lines
- CommStatsService (Postgres GROUP BY + p95 latency + Redis cache) ~180 lines
- BounceRateMonitorService (BullMQ cron 60min + auto-pause) ~150 lines
- MailgunWebhookController + MailgunSignatureMiddleware ~230 lines
- MailgunWebhookProcessorConsumer (Kafka consumer) ~250 lines
- CommStatsController (GET /api/v1/comm/stats RBAC + multi-tenant) ~120 lines
- BounceType + BounceReason taxonomy + classifier ~80 lines
- Mailgun webhook payload Zod schemas ~120 lines
- 25+ unit tests delivery-tracking
- 20+ E2E tests mailgun-webhook + comm-stats

Tests : 25 unit + 10 bounce classification + 20 E2E = 55 tests
Coverage : >= 88%

Task: 3.2.10
Sprint: 9 (Phase 3 / Sprint 2)
Reference: B-09 Tache 3.2.10
Decisions: decision-007 (Zod), decision-014 (audit 7y), decision-022 (Kafka)"
```

---

## 16. Workflow next step

Apres commit, passer a `task-3.2.11-optout-management-cndp.md` qui implementera le service opt-out CNDP loi 09-08, l'endpoint public token-signed `/api/v1/public/optout/:token`, le one-click unsubscribe RFC 8058, le STOP keyword auto-detection WhatsApp incoming webhook, et l'integration avec `comm.optout_added` Kafka event emis par cette Tache 3.2.10 lors des hard bounces / complaints / unsubscribes (Mailgun) afin de centraliser tous les opt-outs dans `comm_optouts` table avec source tracking (`auto-bounce`, `auto-complaint`, `one-click-unsubscribe`, `stop-keyword-wa`, `web-form`, `admin-manual`).

---

## 17. Annexes

### Annexe A. Mapping codes Meta WhatsApp v21.0 vers BounceReason

| Meta code | Description Meta | BounceReason | Type | auto_opt_out | retry_eligible |
|-----------|------------------|--------------|------|--------------|----------------|
| 130 | Template not found | domain_invalid | hard | yes | no |
| 131 | Phone not opted-in | mailbox_not_found | hard | yes | no |
| 132 | Template not approved | template_not_approved | hard | yes | no |
| 133 | Phone capacity exceeded | rate_limited | soft | no | yes |
| 470 | Message expired (24h window) | network_timeout | soft | no | yes |
| 480 | Re-engagement message rejected | blocked_by_recipient | hard | yes | no |
| 100 | Generic error | unknown_temporary | soft | no | yes |
| 190 | Access token expired | unknown_temporary | soft | no | yes |
| 200 | Permission denied | unknown_permanent | hard | yes | no |

Reference Meta : https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

### Annexe B. Mapping severite Mailgun vers BounceReason

| Mailgun severity | Mailgun reason regex | BounceReason | Type |
|------------------|----------------------|--------------|------|
| permanent | /(address\|recipient).*not.*found/i | mailbox_not_found | hard |
| permanent | /user.*unknown/i | mailbox_not_found | hard |
| permanent | /no.*such.*user/i | mailbox_not_found | hard |
| permanent | /inactive\|deactivated\|disabled/i | mailbox_inactive | hard |
| permanent | /domain\|mx.*not.*found\|host.*not.*found\|nxdomain/i | domain_invalid | hard |
| permanent | /blocked\|blacklist\|banned\|reject/i | blocked_by_recipient | hard |
| permanent | /policy\|spam\|content/i | policy_rejection | hard |
| permanent | (default fallback) | unknown_permanent | hard |
| temporary | /quota\|full\|over.?limit/i | mailbox_full | soft |
| temporary | /dns\|resolution/i | dns_failure | soft |
| temporary | /timeout\|connection\|network/i | network_timeout | soft |
| temporary | (default fallback) | unknown_temporary | soft |

Reference Mailgun : https://documentation.mailgun.com/en/latest/api-events.html

### Annexe C. Performance benchmarks attendus

```
DeliveryTrackingService.markDelivered   median 5 ms     (p99: 15 ms)  -- single UPDATE comm_messages
DeliveryTrackingService.markBounced     median 6 ms     (p99: 18 ms)  -- single UPDATE comm_messages
DeliveryTrackingService.markRead        median 5 ms     (p99: 15 ms)
DeliveryTrackingService.markOpened      median 3 ms     (p99: 10 ms)  -- conditional INSERT
DeliveryTrackingService.markClicked     median 4 ms     (p99: 12 ms)
MailgunSignatureMiddleware.use          median 0.5 ms   (p99: 2 ms)   -- hmac compute
MailgunWebhookController.receive        median 25 ms    (p99: 50 ms)  -- includes INSERT + Kafka publish
MailgunWebhookProcessorConsumer.handle  median 30 ms    (p99: 80 ms)  -- DB lookup + UPDATE + Kafka
BounceRateMonitorService.checkBounceRates median 200 ms  (p99: 500 ms) -- per-tenant aggregate query
CommStatsService.getStats (cache hit)   median 2 ms     (p99: 8 ms)
CommStatsService.getStats (cache miss)  median 80 ms    (p99: 200 ms) -- 3 queries + cache set
```

### Annexe D. Kafka topics utilises

| Topic | Partition key | Producer | Consumer | Sprint |
|-------|---------------|----------|----------|--------|
| insurtech.comm.webhooks_received | event_id | MailgunWebhookController + WaWebhookController (3.2.4) | MailgunWebhookProcessorConsumer (3.2.10) + WaWebhookProcessorConsumer (3.2.4) | 9 |
| insurtech.comm.message_delivered | message_id | MailgunWebhookProcessorConsumer + WaWebhookProcessorConsumer | Sprint 14 Insure (status police signed), Sprint 18 Customer Portal | 9 |
| insurtech.comm.message_bounced | message_id | MailgunWebhookProcessorConsumer | Tache 3.2.11 OptoutService consume hard bounces | 9 |
| insurtech.comm.message_opened | message_id | MailgunWebhookProcessorConsumer | Sprint 22 Analytics | 9 |
| insurtech.comm.message_clicked | message_id | MailgunWebhookProcessorConsumer | Sprint 22 Analytics | 9 |
| insurtech.comm.message_retry_requested | message_id | MailgunWebhookProcessorConsumer | Sprint 9 Tache 3.2.8 BullMQ email-send worker | 9 |
| insurtech.comm.optout_added | message_id | MailgunWebhookProcessorConsumer | Tache 3.2.11 OptoutService | 9 |
| insurtech.comm.high_bounce_rate | tenant_id:channel | BounceRateMonitorService | Sprint 33 Slack alerting | 9 |
| insurtech.comm.campaign_auto_paused | tenant_id:channel | BounceRateMonitorService | Sprint 33 Slack alerting + Sprint 14 Insure UI campaigns admin | 9 |

### Annexe E. SQL queries optimisees (avec explain plans cibles)

**Query 1 : Stats by day (30 days)**

```sql
EXPLAIN ANALYZE SELECT
  channel,
  status,
  to_char(date_trunc('day', sent_at AT TIME ZONE 'Africa/Casablanca'), 'YYYY-MM-DD') AS day,
  COUNT(*) AS count,
  AVG(EXTRACT(EPOCH FROM (delivered_at - sent_at))) FILTER (WHERE delivered_at IS NOT NULL) AS avg_delivery_latency_s
FROM comm_messages
WHERE tenant_id = $1
  AND sent_at >= $2
  AND sent_at < $3
GROUP BY channel, status, day
ORDER BY day DESC, channel, status;

-- Expected plan :
-- Sort
--   ->  HashAggregate
--         Group Key: channel, status, to_char(...)
--         ->  Index Scan using idx_comm_messages_tenant_sent_at on comm_messages
--               Index Cond: ((tenant_id = $1) AND (sent_at >= $2) AND (sent_at < $3))
-- Total cost : ~0.50ms per row, ~80ms for 30k rows

-- Index used : idx_comm_messages_tenant_sent_at (tenant_id, sent_at DESC)
-- Sprint 35 partition pruning : if sent_at filter spans 1-2 monthly partitions, only those scanned
```

**Query 2 : Bounce rate 24h aggregation**

```sql
EXPLAIN ANALYZE SELECT
  tenant_id,
  channel,
  COUNT(*)::int AS total_sent,
  COUNT(*) FILTER (WHERE status = 'bounced')::int AS total_bounced,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'bounced') / NULLIF(COUNT(*), 0), 2) AS rate_pct
FROM comm_messages
WHERE sent_at >= NOW() - INTERVAL '24 hours'
  AND channel IN ('email', 'whatsapp')
GROUP BY tenant_id, channel;

-- Expected plan :
-- HashAggregate
--   Group Key: tenant_id, channel
--   ->  Index Scan using idx_comm_messages_sent_at on comm_messages
--         Index Cond: (sent_at >= (now() - '24:00:00'::interval))
--         Filter: (channel = ANY ('{email,whatsapp}'::text[]))
```

**Query 3 : p95 latency**

```sql
EXPLAIN ANALYZE SELECT
  percentile_cont(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (delivered_at - sent_at))) AS p95_s
FROM comm_messages
WHERE tenant_id = $1
  AND sent_at >= $2
  AND sent_at < $3
  AND delivered_at IS NOT NULL;

-- Expected plan :
-- Aggregate
--   ->  Index Scan using idx_comm_messages_tenant_sent_at_delivered on comm_messages
--         (composite partial index : tenant_id, sent_at DESC WHERE delivered_at IS NOT NULL)
```

### Annexe F. Sprint 33 Slack alerting consumer (preview)

```typescript
// Sprint 33 : SlackAlertingService consume comm.high_bounce_rate
@Injectable()
export class CommHighBounceRateSlackAlerter {
  @KafkaSubscribe('insurtech.comm.high_bounce_rate')
  async onHighBounceRate(payload: { tenant_id: string; channel: string; rate_pct: number; total_sent: number; total_bounced: number }): Promise<void> {
    await this.slack.postMessage({
      channel: '#alerts-comm',
      text: ':rotating_light: High bounce rate detected',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Tenant* : \`${payload.tenant_id}\`\n*Channel* : ${payload.channel}\n*Bounce rate* : *${payload.rate_pct}%* (threshold 5%)\n*Sent (24h)* : ${payload.total_sent}\n*Bounced* : ${payload.total_bounced}`,
          },
        },
        {
          type: 'actions',
          elements: [
            { type: 'button', text: { type: 'plain_text', text: 'View tenant stats' }, url: `https://admin.skalean.ma/tenants/${payload.tenant_id}/comm/stats` },
            { type: 'button', text: { type: 'plain_text', text: 'Pause campaigns' }, url: `https://admin.skalean.ma/tenants/${payload.tenant_id}/comm/campaigns?action=pause` },
          ],
        },
      ],
    });
  }
}
```

### Annexe G. Sprint 22 Analytics consumer email engagement (preview)

```typescript
// Sprint 22 : EmailEngagementAnalytics consume opened/clicked
@Injectable()
export class EmailEngagementAnalytics {
  @KafkaSubscribe('insurtech.comm.message_opened')
  async onOpened(payload: { message_id: string; opened_at: string }): Promise<void> {
    await this.metricsRepo.increment('email_opens_total', { message_id: payload.message_id });
  }

  @KafkaSubscribe('insurtech.comm.message_clicked')
  async onClicked(payload: { message_id: string; clicked_at: string; url?: string }): Promise<void> {
    await this.metricsRepo.increment('email_clicks_total', { message_id: payload.message_id });
    if (payload.url) {
      await this.metricsRepo.increment('email_url_clicks_total', { url: payload.url });
    }
  }
}
```

### Annexe H. Migration plan partitioning Sprint 35 (preview)

Sprint 35 migrera la table `comm_messages` vers partitioning par mois sur `sent_at` :

```sql
-- Sprint 35 : convert to partitioned table
ALTER TABLE comm_messages RENAME TO comm_messages_legacy;

CREATE TABLE comm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  -- ... all columns ...
  sent_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, sent_at)
) PARTITION BY RANGE (sent_at);

-- Create monthly partitions for next 12 months
CREATE TABLE comm_messages_2026_01 PARTITION OF comm_messages
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... 11 more partitions

-- Migrate data
INSERT INTO comm_messages SELECT * FROM comm_messages_legacy;
DROP TABLE comm_messages_legacy;

-- Index : create on each partition
CREATE INDEX idx_comm_messages_2026_01_tenant ON comm_messages_2026_01 (tenant_id, sent_at DESC);
```

Avantage : queries 30j ne scannent que 1-2 partitions, retention 7 ans gere par DROP PARTITION mensuel automatique. EXPLAIN ANALYZE doit montrer "Partitions selected : 1" (best case) ou "2" (cross-month boundary).

---

**Fin du prompt task-3.2.10-delivery-tracking-bounces-alerts.md.**
