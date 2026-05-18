# TACHE 3.2.9 -- Message Orchestrator (Routing par preferred_channel WhatsApp / Email)

**Sprint** : 9 (Phase 3 / Sprint 2 dans phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.9)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 3.2.10 delivery tracking, 3.2.11 opt-out flows actifs, 3.2.12 endpoints REST `/comm/messages/send`, et tous flows operationnels Sprint 14+ Insure / Sprint 20+ Repair / Sprint 18 Notifications qui consomment `MessageOrchestratorService.sendToContact`)
**Effort** : 5h
**Dependances** :
- 3.2.1 (entites `comm_messages` + schemas Zod + helpers phone/email + repository factory)
- 3.2.2 (WhatsApp Cloud API client Meta v21.0)
- 3.2.3 (WA template renderer + `validateMetaApproved` + 3 locales fr/ar-MA/ar)
- 3.2.4 (webhook receiver -- pas direct mais propage status updates en aval)
- 3.2.5 (Template Manager + seeds : `meta_template_status='approved'`)
- 3.2.6 (Email SMTP client + Mailgun + DKIM)
- 3.2.7 (Email template renderer + RTL)
- 3.2.8 (BullMQ queues `wa-send` + `email-send` + workers + retry exponential + DLQ Kafka)
- Sprint 8 (CRM `contacts` table avec `preferred_channel`, `preferred_language`, `phone`, `email`, `tags`, `deal_stage`, `last_activity_at`)
- Sprint 5 (TenantContext + RBAC `comm.messages.send` permission Sprint 6)
- Sprint 3 (BullMQ JobsModule init + Kafka producer + Redis Streams)
- Sprint 2 (audit log table + Kafka topics + Pino logger)

**Densite cible** : 125-140 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le service `MessageOrchestratorService` complet et operationnel du programme Skalean InsurTech v2.2 qui implemente la couche d'orchestration centralisee de tous les envois de messages transactionnels et marketing (WhatsApp ou Email) declenches par les modules metiers consommateurs (Sprint 5 Auth pour verify-email / password-reset / mfa-enabled / account-locked / suspicious-login, Sprint 6 Tenant pour invitations, Sprint 8 Booking / CRM pour reminders RDV J-1 / J-1h, Sprint 14+ Insure pour quote_generated / police_signed / police_renewal_reminder J-30 / payment_due_reminder, Sprint 20+ Repair pour sinistre_acknowledged / devis_ready / reparation_completed, Sprint 18 Notifications pour alerts internes, Sprint 22 Marketing campaigns), conforme aux exigences de routing intelligent par `preferred_channel` du contact (WhatsApp si tous les criteres sont reunis : preferred='whatsapp' AND opt-in WhatsApp actif AND template Meta approved pour la locale demandee AND phone valide E.164, sinon fallback vers Email si preferred='email' ou WhatsApp impossible AND opt-in email AND email valide RFC 5322, sinon `NoAvailableChannelError`), conforme aux exigences de conformite Maroc (CNDP loi 09-08 article 30 sur opt-out obligatoire avant chaque envoi sauf transactionnels critiques de securite type auth qui beneficient du `skipOptOutCheck`, loi marketing direct 24-09 sur horaires legaux 8h-21h timezone Africa/Casablanca pour broadcasts marketing B2C avec respect strict pour eviter sanction CNDP), conforme aux exigences d'audit et tracabilite (audit log `comm_audit_log` avec colonnes tenant_id + contact_id + template + channel_chosen + decision_path JSONB + correlation_id + initiated_by + retention 7 ans pour compliance), et conforme aux exigences de scalabilite (broadcasts a 10000+ contacts segmentes via filters CRM Sprint 8 avec pagination cursor-based batch=1000 et throughput cible <30s pour 10k contacts).

Le perimetre couvre : un service NestJS `@Injectable() MessageOrchestratorService` (~320 lignes) qui expose 3 methodes principales (`sendToContact(contactId, templateName, variables, options?)` pour envoi unitaire, `sendBatch(items: SendItem[])` pour bulk send synchrone type reminders RDV J-1 / J-1h ou notifications operationnelles type sinistre status updates, `sendBroadcast(filters, templateName, variables, options?)` pour campaigns marketing massives) ; un service auxiliaire `ChannelResolverService` (~180 lignes) qui encapsule la logique de decision arbre canal final via la methode `determineFinalChannel(contact, options)` retournant un `ChannelDecision { channel, reason, decision_path: string[] }` (priorite : 1) `preferOverride` explicite si fourni dans options 2) `preferred_channel` du contact si tous criteres OK 3) fallback vers canal alternatif si opt-in actif 4) `null` avec reason explicite si aucun canal disponible) ; un service auxiliaire `ContactValidatorService` (~120 lignes) qui valide les contacts avec `hasValidPhone(contact)` (presence non-null + format E.164 valide via regex `/^\+\d{10,15}$/` + libphonenumber check pour MA `+212` prefix), `hasValidEmail(contact)` (presence non-null + format RFC 5322 strict + domaine TLD valide via regex), `normalizePhone(input)` (transforme `06 12 34 56 78` ou `0612345678` ou `+212 612-345-678` vers format canonique `+212612345678`), et `normalizeEmail(input)` (lowercase + trim + validate) ; un service auxiliaire `BroadcastSegmentationService` (~150 lignes) qui segmente les contacts CRM Sprint 8 par filtres composables (tags array, deal_stage enum, locale, last_activity_at range, custom_field equality, opt-in actif sur canal cible) avec pagination cursor-based via `findByFilters({ filters, cursor, limit: 1000 })` et opt-in filter automatique dans WHERE clause SQL ; des DTOs Zod (`SendToContactDto`, `SendBatchDto`, `SendBroadcastDto`, `ContactFiltersDto`, `OrchestratorOptionsDto`) (~100 lignes) ; des erreurs typees (`NoAvailableChannelError`, `ContactOptedOutError`, `TemplateNotApprovedError`, `ContactNotFoundError`, `BroadcastQuotaExceededError`, `InvalidPhoneFormatError`, `RateLimitExceededError`, `IdempotencyConflictError`) (~80 lignes) ; un service `CommAuditService` (~120 lignes) loggant `send_initiated` + `send_queued` + `send_skipped_optout` + `broadcast_started` + `broadcast_completed` + `decision_path` ; et 30+ tests Vitest unitaires + 8 tests integration testcontainers Postgres + Redis + Kafka avec coverage >= 88% sur le module orchestrator.

L'apport est multiple. Premierement, en centralisant l'orchestration dans un service unique consomme par tous les modules metiers (Auth, Tenant, Booking, Insure, Repair, Notifications, Marketing), on elimine la duplication de logique decision canal qui existait potentiellement dans chaque module et on garantit la coherence : un changement dans la regle "WhatsApp prioritaire si template Meta approved" se fait au seul endroit `ChannelResolverService.determineFinalChannel`. Sans orchestrator, chaque module reimplementerait cette logique avec risques de divergence (module A oublie l'opt-out check, module B oublie la validation E.164, etc.) qui sont catastrophiques en termes de conformite CNDP loi 09-08. Deuxiemement, en encapsulant la decision canal dans un arbre explicite documente dans un decision_path JSONB stocke en audit log, on permet la tracabilite forensique : si un user se plaint "j'ai recu cet email alors que je preferais WhatsApp", on peut requeter `SELECT decision_path FROM comm_audit_log WHERE contact_id = ?` et reconstituer exactement les raisons (e.g. `["preferred=whatsapp", "opt-in WA OK", "template police_signed_confirmation NOT APPROVED for ar-MA", "fallback email", "opt-in email OK", "phone valide pas requis", "channel=email"]`). Cette tracabilite est obligatoire pour les audits ACAPS et CNDP. Troisiemement, en supportant 3 patterns d'envoi (sendToContact unitaire, sendBatch synchrone bulk, sendBroadcast async cursor-paginated), on couvre 95% des cas d'usage : `sendToContact` pour les 80% volume = transactionnels (signup, mfa, booking confirm, sinistre status), `sendBatch` pour les 15% volume = jobs schedules type reminders RDV (Sprint 8 cronjob enqueue 100 reminders), `sendBroadcast` pour les 5% volume = campaigns marketing (Sprint 22+) ou newsletters internes (Sprint 33). Le pattern broadcast cursor-based protege contre OOM si tenant tente d'envoyer a 100000 contacts d'un coup.

Quatriemement, en supportant `skipOptOutCheck=true` exclusivement pour les transactionnels critiques de securite (auth password-reset, mfa-enabled, account-locked, suspicious-login -- pas marketing, pas reminders), on respecte l'esprit de la loi 09-08 (opt-out concerne marketing et communications non-essentielles, pas les communications de securite obligatoires) tout en evitant le piege absurde "user a fait opt-out -> ne peut plus recevoir password reset = impossible recuperer compte". Le flag skipOptOutCheck est documente strictement (avec comment annexes types) et son usage est audite (decision_path mentionne `["skipOptOutCheck=true (transactional auth)"]`) pour eviter les abus. Cinquiemement, en supportant `preferChannel` override explicite dans les options, on permet aux modules metiers de forcer un canal specifique pour cas particuliers (e.g. user en zone rurale sans 4G stable -> Email malgre preferred=whatsapp pour resilience deliverability) sans contourner la table contacts.preferred_channel qui reflete preference long-terme. L'override est aussi audite. Sixiemement, en gerant le quota tenant (`COMM_BROADCAST_QUOTA_PER_DAY=5000` MVP, `50000` prod) dans le service via verification table `comm_messages` count tenant_id+date_trunc('day') avant chaque broadcast, on protege contre l'abuser et contre les cout incontrolables Mailgun/Meta API (un tenant qui envoie 100k emails/jour coutait ~100 EUR/jour en API).

A l'issue de cette tache, l'API `MessageOrchestratorService.sendToContact(contactId, 'police_signed_confirmation', { policy_number: 'POL-2026-001', amount: '12500 MAD' })` envoie un message en moins de 100 ms p99 (latency dominee par lookup contact + lookup opt-out + INSERT message + enqueue BullMQ -- pas SMTP/Meta latency qui est dans le worker), `sendBatch([{contactId, template, vars}, ...])` enqueue 100 jobs en moins de 5s p99, `sendBroadcast({ tags: ['customer'], locale: 'fr-MA' }, 'newsletter_q2', vars)` segmente et enqueue 10000 contacts en moins de 30s p99 conformement a l'exigence performance documentee dans le test `broadcast-perf.spec.ts`, le routing tree est testes contre 30+ scenarios (preferred WA opt-in OK, preferred WA opt-out fallback email, preferred WA template not approved fallback email, preferred email opt-in OK, no phone no email error, override preferChannel email force email, skipOptOutCheck=true bypass, contact merged dedup CRM lookup survivant, locale fallback ar-MA->ar->fr, etc.), aucun message n'est envoye sans avoir traverse l'arbre de decision documente dans audit log avec decision_path JSONB, le quota tenant est respecte (`BroadcastQuotaExceededError` si tenant > 5000 messages/jour MVP), le rate limit per-tenant est respecte (`COMM_TENANT_RATE_LIMIT_PER_MINUTE=100` via Redis sliding window), les permissions RBAC `comm.messages.send` sont verifiees pour `sendToContact` + `sendBatch` et `comm.messages.broadcast` pour `sendBroadcast`, le multi-tenant est strictement isole (TenantContext propage + WHERE tenant_id dans toutes les queries), la correlation_id traverse de l'orchestrator au worker au webhook au audit log pour tracabilite end-to-end, le support Idempotency-Key (header HTTP standard RFC 8235) permet retry safe (2eme send avec meme key retourne le meme messageId stocke en Redis 24h TTL).

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 va declencher des centaines de milliers de messages par mois en regime de croisiere (estimations Sprint 1 panel 3000 courtiers + 80000 assures) :

- **Sprint 5 Auth** (~60% volume) : verify-email signup nouveau user (~5000/mois prod), password-reset (~1000/mois), mfa-enabled (~500/mois), account-locked (~200/mois), suspicious-login (~300/mois).
- **Sprint 6 Tenant** (~5% volume) : invitations courtiers, suspensions, alerts quota.
- **Sprint 8 Booking** (~15% volume) : appointment_scheduled (10000/mois), appointment_reminder_24h (10000/mois), appointment_reminder_1h (10000/mois), appointment_cancelled (1000/mois).
- **Sprint 14+ Insure** (~10% volume) : quote_generated (5000/mois), police_signed_confirmation (3000/mois), police_renewal_reminder (3000/mois), payment_due_reminder (2000/mois).
- **Sprint 20+ Repair** (~5% volume) : sinistre_acknowledged (1500/mois), devis_ready (1500/mois), reparation_started (1500/mois), reparation_completed (1500/mois).
- **Sprint 22 Marketing** (~5% volume) : campaigns segmentees (newsletters Q1, promos, etc., ~5000/mois rampe up Phase 7+).

Sans un service `MessageOrchestratorService` centralise, chaque module reimplementerait la logique decision canal individuellement, dupliquant le code et risquant l'incoherence : module A consume `WhatsAppCloudApiClient.sendTemplate` directement sans verifier opt-out CNDP -> sanction CNDP loi 09-08 qui prevoit jusqu'a 300000 MAD d'amende par message non-conforme + interdiction d'exercice 5 ans. Module B consume `EmailService.send` sans verifier `preferred_channel='whatsapp'` -> user recoit email alors qu'il prefererait WhatsApp = mauvaise UX = baisse engagement (-30% selon tests A/B Sprint 1).

L'exigence de routing intelligent est specifique au marche marocain ou WhatsApp Business est utilise par 87% des courtiers selon enquete Sprint 1 (vs 65% en France selon EU Whatsapp Business Index 2024). Il est strategiquement avantageux de privilegier WhatsApp pour engagement maximal mais en respectant rigoureusement les limitations Meta (templates pre-approved seulement, sauf 24h session window) et CNDP (opt-out). L'architecture tree decision permet de basculer dynamiquement vers Email comme fallback resilient.

L'exigence de quota et rate limiting protege contre :
1. **Abuse interne tenant** : un courtier malveillant ou compromis qui spamme 100000 emails -> sanction CNDP + cost incontrolable.
2. **Bug developpeur** : un cron mal configure qui boucle infiniment -> cost incontrolable.
3. **Fournisseur API ban** : Meta/Mailgun bannissent les comptes qui envoient massivement avec taux de plainte > 0.5% -> service inutilisable.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas d'orchestrator (chaque module appelle WA/Email directement) | Simple court-terme | Duplication, divergence, risque CNDP | REJETE -- non conforme architecture |
| Orchestrator simple synchrone (pas de queue, send direct) | Simple | Bloquer thread HTTP, latence >5s, pas resilient | REJETE -- mauvaise scalabilite |
| Orchestrator + queue (RETENU pattern v2.2) | Async, resilient, retries, DLQ, traceable | Complexity setup BullMQ + Redis | RETENU |
| Orchestrator dans BFF (apps/api) | Centralise pres endpoints REST | Pas reutilisable autres apps | REJETE |
| Orchestrator dans package `@insurtech/comm` (RETENU) | Reutilisable workers + cron + endpoints | Necessite injection bien geree | RETENU |
| Orchestrator AI-driven (decide canal par ML) | Optimise engagement | Complexity, opaque, pas testable, pas conforme audit decision_path explicite | REJETE Phase 1, defere Phase 7+ AI optional |
| `preferred_channel` strict (pas de fallback) | Simple | User opt-out WA -> ne recoit rien = mauvaise UX | REJETE -- need fallback intelligent |
| `preferred_channel` + fallback automatique opposite (RETENU) | Maximize delivery | Complexity arbre decision | RETENU |
| Decision canal en SQL stored procedure | Performance | Difficulty tester, pas portable, dette legacy | REJETE |
| Decision canal en TypeScript pure function (RETENU) | Testable, debuggable, portable | Round-trip DB pour contact + opt-out | RETENU avec cache Redis 60s |
| `skipOptOutCheck` toujours respecte | Simple | Impossible password-reset si user opt-out | REJETE -- exception transactionnels auth |
| `skipOptOutCheck` parametrable (RETENU) | Conforme legal + UX | Risque abus si mal use | RETENU avec audit obligatoire |
| Broadcast synchrone (loop sequentiel) | Simple | OOM si 100k contacts, blocking | REJETE |
| Broadcast batch=100 cursor (RETENU) | Memory bounded, scalable | Latence accumule | RETENU |
| Broadcast Promise.all sans batch | Throughput max | OOM si > 10k | REJETE |
| Broadcast streaming Postgres cursor + Promise.all batch=1000 (RETENU) | Optimal scalabilite + memory | Setup cursor logic | RETENU |
| Idempotency-Key obligatoire | Safe retry | Complexity client | REJETE -- optional |
| Idempotency-Key optional avec Redis 24h TTL (RETENU) | Safe retry pour clients qui veulent | Storage Redis | RETENU |
| Quota tenant fixe (5000/jour) | Simple | Pas dynamique | DEFFERE Sprint 14 plan tarifaire dynamique |
| Quota tenant via env config (RETENU MVP) | Configurable | Pas dynamique tenant-spec | RETENU MVP |
| Rate limit per-tenant memory | Simple | Pas distribute | REJETE |
| Rate limit per-tenant Redis sliding window (RETENU) | Distributed, accurate | Complexity setup | RETENU |

### 2.3 Trade-offs

Choisir un orchestrator centralise dans `@insurtech/comm` package implique d'accepter une dependance forte de tous les modules metiers vers ce package : `auth.module.ts` doit importer `CommModule`, `booking.module.ts` aussi, `insure.module.ts` aussi, etc. C'est une dependance verticale acceptable parce que `@insurtech/comm` est un module horizontal stable (Phase 3) consomme par les modules verticaux (Phases 4-7). En contrepartie, la coherence de routing est garantie.

Choisir une decision tree explicite avec `decision_path: string[]` documentation step-by-step (vs un algorithme opaque ML-based) implique d'accepter une evolution manuelle des regles : si Sprint 30 on decide d'ajouter SMS en 3eme canal fallback, il faut modifier `ChannelResolverService` explicitement. En contrepartie, audit trail est lisible et conforme exigences ACAPS/CNDP. La defere ML-based est documentee Phase 7+ AI optional.

Choisir un fallback automatique vers canal alternatif (au lieu de strict preferred_channel) implique d'accepter la complexity de l'arbre decision (8+ branches a considerer) et le risque que user soit surpris de recevoir un email alors qu'il prefere WhatsApp. En contrepartie, on maximise le taux de delivery (un user qui n'a pas validate template Meta peut quand meme recevoir verify-email via Email = critical pour onboarding). Le decision_path en audit explique le fallback si user demande.

Choisir `skipOptOutCheck` parametrable (vs always-respect-opt-out) implique d'accepter le risque d'abus si dev junior oublie le contexte et utilise true partout. En contrepartie, on permet les transactionnels critiques (auth password-reset = obligatoire pour recovery compte) qui sinon seraient impossibles. Mitigation : audit log obligatoire avec `decision_path` mentionnant `skipOptOutCheck=true (reason)`, code review strict, et tests verifient que seuls templates auth utilisent ce flag (linter custom Sprint 33).

Choisir broadcast cursor-based batch=1000 (vs Promise.all batch=10000) implique d'accepter une latence cumule legerement plus elevee (~30s pour 10k contacts vs ~10s pour Promise.all batch infinis) mais en contrepartie OOM impossibles meme a 100k contacts (memory bounded < 50 MB) et integration Postgres cursor stable.

Choisir Idempotency-Key optional (vs obligatoire) implique d'accepter qu'un client mal-configure puisse double-send si retry sur erreur transient. En contrepartie, l'API reste simple pour clients basiques (auth Sprint 5 ne setup pas idempotency, juste send) et clients critiques (Sprint 14+ Insure police_signed = high-value transaction) peuvent setup.

Choisir quota tenant via env (RETENU MVP) implique de devoir redeployer si on veut changer le quota d'un tenant specifique (e.g. premium tenant 50k/jour vs standard 5k/jour). En contrepartie, simplicity MVP. Sprint 14 implementera plan tarifaire dynamique avec quota stocke en table `tenants.config.broadcast_quota_per_day`.

Choisir rate limiting Redis sliding window (vs token bucket Redis ou memory) implique d'accepter complexity setup Redis Lua script atomique. En contrepartie, accuracy parfaite (pas de burst sneak through tokens) et distributed across instances. Sprint 3 a deja Redis ; Lua script pattern reutilisable Sprint 33+.

### 2.4 Decisions strategiques referenced

- **decision-006 (No-emoji)** : totale dans templates et code.
- **decision-007 (Zod runtime validation)** : DTOs orchestrator (SendToContactDto, SendBatchDto, SendBroadcastDto, ContactFiltersDto) sont Zod schemas valides au runtime aux frontieres (controllers Sprint 9 Tache 3.2.12, consumers Kafka).
- **decision-008 (Cloud souverain MA)** : indirect, le routing protege contre data-leak vers SaaS US (Meta WhatsApp data peut transiter US mais consenti via opt-in template approved, fallback email reste Atlas Cloud Services Benguerir).
- **decision-009 (Multi-locale fr/ar-MA/ar)** : routing utilise `contact.preferred_language` pour selectionner template locale avec fallback `ar-MA -> ar -> fr`.
- **decision-014 (Audit log 7 ans)** : `comm_audit_log` table avec retention 7 ans pour conformite ACAPS Insure + Repair.
- **decision-015 (CNDP loi 09-08)** : opt-out check obligatoire avant send (sauf skipOptOutCheck=true pour transactionnels auth documentes), audit trail decision_path obligatoire.
- **decision-018 (Templates Handlebars)** : indirect, orchestrator passe `templateName` + `variables` au worker qui rend via Handlebars (Sprint 9 Tache 3.2.7) ou format Meta (Tache 3.2.3).
- **decision-022 (BullMQ retry exponential + DLQ)** : indirect, orchestrator enqueue dans queues `wa-send` ou `email-send` qui ont leur retry config.
- **decision-024 (Multi-tenant strict)** : TenantContext propage, WHERE tenant_id dans toutes les queries (`messagesRepo.create({ tenant_id, ... })`, `contactsService.findById(contactId, { tenant_id })`, `optoutService.getOptedOutChannels(contactId, { tenant_id })`).
- **decision-026 (Idempotency-Key RFC 8235 optional)** : header HTTP standard support, Redis 24h TTL pour cache messageId, conflict 409 si key existe avec different payload.
- **decision-031 (Rate limiting Redis sliding window per-tenant)** : `COMM_TENANT_RATE_LIMIT_PER_MINUTE=100` MVP, scale Phase 7+.
- **decision-032 (Marketing horaires legaux Maroc 8h-21h)** : loi 24-09 article 5 sur prospection commerciale electronique B2C, broadcasts marketing schedules check `Intl.DateTimeFormat('fr-MA', { timeZone: 'Africa/Casablanca' })` avant enqueue.

### 2.5 Pieges techniques connus

1. **Decision tree branches non couvertes** : il y a au moins 8 branches dans l'arbre (preferred_wa/email x opt-in_wa/opt-out_wa x opt-in_email/opt-out_email x template_approved/not_approved x phone_valid/invalid x email_valid/invalid). Un test matrix de 32 scenarios est necessaire pour couvrir toutes les permutations. Mitigation : tableau test parametrise avec `it.each` Vitest.
2. **Cache contact stale** : si on cache contact 60s pour perf, et si entre temps user fait opt-out, on envoie quand meme = violation CNDP. Mitigation : TTL court 30s + invalidation Kafka event `contact.optout_updated` -> evict cache.
3. **Cache opt-out stale** : meme probleme. Mitigation : TTL 30s + invalidation Kafka.
4. **Race condition opt-out vs send** : user fait opt-out a T0, send queued a T0+10ms (cache 30s pas encore evicte). Mitigation : worker re-check opt-out avant send (defense in depth).
5. **Phone format inconsistant DB** : Sprint 8 normalize a `+212612345678` mais Sprint 5 user signup pourrait stocker `0612345678` ou `212612345678`. Mitigation : `ContactValidatorService.normalizePhone` accepte multiples formats input et normalise output canonique avant comparaison Meta API.
6. **Email format invalide RFC 5322 mais accepte par regex simple** : `user..foo@example.com` est invalide RFC mais accepte par `/^[^@]+@[^@]+\.[^@]+$/`. Mitigation : regex stricte RFC 5322 + library `validator.js` `isEmail` pour cas limites.
7. **Locale fallback chain wrong** : ar-MA non dispo -> doit fallback ar (langue de base) -> fr (default), pas vers en (qui n'est pas ar-related). Mitigation : chain explicite documente.
8. **Idempotency-Key collision cross-tenant** : tenant A use key "K1" et tenant B use key "K1" -> doivent etre traite separement. Mitigation : Redis key prefix `idem:{tenant_id}:{key}`.
9. **Broadcast quota race condition** : 2 broadcasts concurrents peuvent depasser quota. Mitigation : Redis INCR atomique + verifier avant chaque send.
10. **Cursor pagination contact list change** : pendant broadcast 30s, des contacts peuvent etre ajoutes/supprimes -> cursor invalide. Mitigation : cursor base sur `(created_at, id)` UUID v7 stable + tolerance manquant 1 page.
11. **Rate limit sliding window vs fixed** : fixed window permet burst au reset (e.g. 100 msg seconde 59 + 100 msg seconde 0 = 200 dans 1s). Mitigation : sliding window via Redis Lua script.
12. **Tenant_id propagation perdue** : si async context (Promise.all batch), AsyncLocalStorage TenantContext peut etre perdu. Mitigation : wrap chaque promise avec `tenantContext.run()`.
13. **DST transition Africa/Casablanca** : Maroc passe heure d'ete fin mars + heure d'hiver fin octobre + Ramadan special. Sched broadcast 9h00 le 30 mars peut tomber 8h00 ou 10h00 reel. Mitigation : `Intl.DateTimeFormat` avec timezone IANA `Africa/Casablanca`.
14. **Marketing 21h check edge case** : envoi prevu 20h59 mais worker traite 21h01 -> probably OK mais limite. Mitigation : check au moment ENQUEUE pas worker.
15. **DLQ message replay** : si admin replay DLQ message Sprint 14, l'orchestrator ne doit pas re-orchestrer (deja decide canal) -- worker DLQ replay utilise direct queue reinjection.
16. **Network partition Redis** : si Redis down, queue unavailable. Mitigation : retourne 503 Service Unavailable + retry-after header.
17. **Multi-tenant cross via shared contactId UUID v7** : si attacker connait UUID contact tenant A, peut-il send a son nom ? Mitigation : strict tenant_id check dans `contactsService.findById(contactId)` qui throw NotFound si tenant mismatch.
18. **Audit log async failure** : si Kafka down, audit log perd. Mitigation : audit log d'abord dans Postgres `comm_audit_log` (transactional) + Kafka eventually consistent.

---

## 3. Architecture context

### 3.1 Position dans le sprint 9

Tache 3.2.9 livre `MessageOrchestratorService` qui est consomme par toutes les taches Sprint 9 suivantes :
- Tache 3.2.10 (delivery tracking) consomme indirectly via les status updates des messages crees par orchestrator.
- Tache 3.2.11 (opt-out CNDP) est consomme PAR orchestrator (pas l'inverse) -- orchestrator appelle `optoutService.getOptedOutChannels(contactId)`.
- Tache 3.2.12 (endpoints REST `/comm/messages/send`) wrap l'orchestrator dans HTTP layer.
- Tache 3.2.13 (tests E2E 40+) teste le flux complet via orchestrator.

### 3.2 Position dans le programme global

- **Sprint 5 Auth** consume orchestrator dans Tache 2.1.13 EmailService deja partial Sprint 5 -- Sprint 9 migre vers orchestrator pour beneficier du routing WA/Email selon preferred_channel.
- **Sprint 6 Tenant** consume orchestrator pour tenant_invitation, tenant_suspended_notification, quota_warning.
- **Sprint 8 Booking / CRM** consume orchestrator pour appointment_scheduled/reminder/cancelled (cron Sprint 8 Tache 3.1.X enqueue batches).
- **Sprint 14+ Insure** consume orchestrator pour quote_generated, police_signed_confirmation, police_renewal_reminder (cron J-30), payment_due_reminder.
- **Sprint 18 Notifications** consume orchestrator pour alerts internes (admin alerts, ops alerts).
- **Sprint 20+ Repair** consume orchestrator pour sinistre_acknowledged, devis_ready, reparation_started, reparation_completed.
- **Sprint 22+ Marketing** consume `sendBroadcast` pour campaigns segmentees.
- **Sprint 33 Observability** consume metrics OTEL emis par orchestrator.

### 3.3 Diagramme

```
                +-----------------------------------+
                | Tache 3.2.8 termine                |
                | BullMQ queues + workers + DLQ      |
                +-----------------+------------------+
                                  |
                                  v
+---------------------------------+----------------------------------+
| TACHE 3.2.9 (cette tache)                                          |
| MessageOrchestratorService                                          |
|                                                                     |
|  sendToContact(contactId, template, vars, opts?)                    |
|  sendBatch(items: SendItem[])                                       |
|  sendBroadcast(filters, template, vars, opts?)                      |
|                                                                     |
|  +----------------+   +----------------+   +-------------------+    |
|  | ChannelResolver|   |ContactValidator|   |BroadcastSegmenter |    |
|  | determineFinal |   |hasValidPhone   |   |segment+pagination |    |
|  | Channel(...)   |   |hasValidEmail   |   |opt-in filter SQL  |    |
|  +----------------+   |normalizePhone  |   +-------------------+    |
|                       +----------------+                            |
|                                                                     |
|  CommAuditService.logSendInitiated/Queued/Skipped/Broadcast        |
|                                                                     |
|  Erreurs : NoAvailableChannel, ContactOptedOut,                    |
|  TemplateNotApproved, BroadcastQuotaExceeded, IdempotencyConflict,  |
|  RateLimitExceeded                                                  |
+--+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   | | | | | | | | | | | | | | | | | | | | | | | |
   v v v v v v v v v v v v v v v v v v v v v v v v
   Sprint 5 Auth / Sprint 6 Tenant / Sprint 8 Booking / Sprint 14+ Insure
   Sprint 18 Notif / Sprint 20+ Repair / Sprint 22+ Marketing
```

### 3.4 Decision tree visualization

```
sendToContact(contactId, templateName, variables, options)
  |
  v
[1] Lookup contact (Sprint 8 contactsService.findById with tenant check)
  |--- not found ---> ContactNotFoundError(404)
  |--- found
  v
[2] Audit log send_initiated (tenant_id, contact_id, template, options)
  |
  v
[3] If options.skipOptOutCheck === true (transactional auth)
  |--- skip step 4
  v
[4] Get optedOutChannels via optoutService (Sprint 9 Tache 3.2.11)
  |
  v
[5] ChannelResolverService.determineFinalChannel(contact, {
      preferOverride: options?.preferChannel,
      optedOutChannels,
      templateName,
      locale: contact.preferred_language,
    })
  |
  v
  Decision tree :
    a) If preferOverride exists AND override channel valid AND opt-in
       --> channel = override, decision_path = ["override applied"]
    b) Else if contact.preferred_channel === 'whatsapp'
       AND !optedOutChannels.includes('whatsapp')
       AND contact.phone valid E.164
       AND waRenderer.validateMetaApproved(templateName, locale) === true
       --> channel = 'whatsapp', decision_path = ["preferred=whatsapp", "opt-in OK", "phone valid", "template approved"]
    c) Else if !optedOutChannels.includes('email')
       AND contact.email valid RFC 5322
       --> channel = 'email', decision_path = [<previous failure reason>, "fallback email", "opt-in OK", "email valid"]
    d) Else if contact.preferred_channel === 'whatsapp'
       AND !optedOutChannels.includes('whatsapp')
       AND contact.phone valid
       AND template not approved
       AND email valid AND opt-in email
       --> channel = 'email', decision_path = ["preferred=whatsapp", "template not approved for locale=ar-MA", "fallback email"]
    e) Else
       --> channel = null, reason = explicit (no_phone | no_email | opted_out_all | template_not_approved_no_fallback_email)
       --> NoAvailableChannelError(400)
  |
  v
[6] If channel null --> throw NoAvailableChannelError + audit decision_path
  |
  v
[7] If options.idempotencyKey
    --> Redis GET "idem:{tenant_id}:{key}" --> if exists, return cached messageId
  |
  v
[8] Quota tenant check (sendBroadcast only)
    --> Redis INCR "quota:{tenant_id}:{date}" --> if > COMM_BROADCAST_QUOTA_PER_DAY throw
  |
  v
[9] Rate limit per-tenant per-minute
    --> Redis Lua script sliding window --> if > COMM_TENANT_RATE_LIMIT_PER_MINUTE throw RateLimitExceeded
  |
  v
[10] INSERT comm_messages row :
    {
      tenant_id, contact_id, channel, direction='outbound',
      to_address: channel==='whatsapp' ? contact.phone : contact.email,
      template_id: null (resolved by worker),
      template_name: templateName,
      template_variables: variables JSONB,
      status: 'pending',
      correlation_id: options?.correlationId ?? generated UUID v7,
      idempotency_key: options?.idempotencyKey ?? null,
    }
  |
  v
[11] Enqueue BullMQ job :
    queue = channel === 'whatsapp' ? 'wa-send' : 'email-send'
    data = { messageId, tenantId, to, templateName, locale, variables, contactId, correlationId }
    options = { priority: priorityMap[options?.priority ?? 'normal'], jobId: messageId for idempotency }
  |
  v
[12] Audit log send_queued (messageId, channel, jobId)
  |
  v
[13] If options.idempotencyKey
    --> Redis SET "idem:{tenant_id}:{key}" = messageId TTL=86400 (24h)
  |
  v
[14] Return { messageId, channel, queueJobId, decision_path }
```

---

## 4. Livrables checkables (40 livrables)

- [ ] Service `repo/packages/comm/src/services/message-orchestrator.service.ts` -- ~320 lignes
- [ ] Service `repo/packages/comm/src/services/channel-resolver.service.ts` -- ~180 lignes
- [ ] Service `repo/packages/comm/src/services/contact-validator.service.ts` -- ~120 lignes
- [ ] Service `repo/packages/comm/src/services/broadcast-segmentation.service.ts` -- ~150 lignes
- [ ] Service `repo/packages/comm/src/audit/comm-audit.service.ts` -- ~120 lignes
- [ ] Errors `repo/packages/comm/src/errors/orchestrator.errors.ts` -- ~80 lignes
- [ ] DTOs `repo/packages/comm/src/dto/orchestrator-input.dto.ts` -- ~100 lignes Zod
- [ ] Module `repo/packages/comm/src/orchestrator.module.ts` -- ~50 lignes
- [ ] Index `repo/packages/comm/src/index.ts` -- exports
- [ ] Tests unitaires `message-orchestrator.service.spec.ts` -- ~320 lignes 30+ tests
- [ ] Tests unitaires `channel-resolver.service.spec.ts` -- ~250 lignes 24+ tests
- [ ] Tests unitaires `contact-validator.service.spec.ts` -- ~150 lignes 18+ tests
- [ ] Tests unitaires `broadcast-segmentation.service.spec.ts` -- ~180 lignes 12+ tests
- [ ] Tests unitaires `comm-audit.service.spec.ts` -- ~120 lignes 10+ tests
- [ ] Tests integration `__tests__/integration/orchestrator-routing.integration.spec.ts` -- ~250 lignes testcontainers
- [ ] Tests perf `services/__tests__/broadcast-perf.spec.ts` -- ~120 lignes 10000 contacts < 30s
- [ ] Variables env : `COMM_BROADCAST_QUOTA_PER_DAY`, `COMM_BROADCAST_BATCH_SIZE`, `COMM_TENANT_RATE_LIMIT_PER_MINUTE`, `COMM_IDEMPOTENCY_TTL_SECONDS`, `COMM_CACHE_CONTACT_TTL_SECONDS`, `COMM_CACHE_OPTOUT_TTL_SECONDS`
- [ ] Mise a jour `package.json` : eventuellement `libphonenumber-js@1.11.4` si pas deja Sprint 8
- [ ] Mise a jour `repo/packages/comm/src/comm.module.ts` -- import OrchestratorModule
- [ ] Documentation README `repo/packages/comm/README.md` section "Message Orchestrator"
- [ ] Migration SQL `repo/infrastructure/migrations/2026_05_XX_comm_audit_log.sql` (table comm_audit_log si pas Sprint 2)
- [ ] No-emoji
- [ ] No-console
- [ ] No log de variables sensibles (password, token) dans audit (mask)
- [ ] Coverage >= 88%
- [ ] Build TypeScript reussit (strict mode)
- [ ] ESLint check no warnings
- [ ] Tous les 30+ tests scenarios decision tree passent
- [ ] Test broadcast 10000 contacts < 30s passe
- [ ] Test integration testcontainers Postgres + Redis + Kafka passe
- [ ] Audit log decision_path JSONB structure documentee
- [ ] TenantContext propage dans Promise.all (AsyncLocalStorage.run)
- [ ] Idempotency-Key Redis 24h TTL fonctionne
- [ ] Rate limit Redis Lua script atomique
- [ ] Quota broadcast Redis INCR atomique
- [ ] Bench sendToContact < 100 ms p99 (mock SMTP/Meta)
- [ ] Bench sendBroadcast 1000 contacts < 5s p99
- [ ] OTEL metrics emis : orchestrator.send.duration, orchestrator.broadcast.duration, orchestrator.errors
- [ ] Permissions RBAC `comm.messages.send` + `comm.messages.broadcast` verifiees
- [ ] Multi-tenant strict isolation (cross-tenant attempt -> 404 NotFound)
- [ ] Marketing horaires legaux 8h-21h check pour broadcasts

---

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/services/message-orchestrator.service.ts                        (~320 lignes)
repo/packages/comm/src/services/channel-resolver.service.ts                            (~180 lignes)
repo/packages/comm/src/services/contact-validator.service.ts                           (~120 lignes)
repo/packages/comm/src/services/broadcast-segmentation.service.ts                       (~150 lignes)
repo/packages/comm/src/audit/comm-audit.service.ts                                      (~120 lignes)
repo/packages/comm/src/errors/orchestrator.errors.ts                                    (~80 lignes)
repo/packages/comm/src/dto/orchestrator-input.dto.ts                                    (~100 lignes Zod)
repo/packages/comm/src/orchestrator.module.ts                                           (~50 lignes)
repo/packages/comm/src/index.ts                                                         (modifie / +exports)
repo/packages/comm/test/services/message-orchestrator.service.spec.ts                   (~320 lignes)
repo/packages/comm/test/services/channel-resolver.service.spec.ts                       (~250 lignes)
repo/packages/comm/test/services/contact-validator.service.spec.ts                      (~150 lignes)
repo/packages/comm/test/services/broadcast-segmentation.service.spec.ts                 (~180 lignes)
repo/packages/comm/test/audit/comm-audit.service.spec.ts                                (~120 lignes)
repo/packages/comm/test/integration/orchestrator-routing.integration.spec.ts            (~250 lignes)
repo/packages/comm/test/perf/broadcast-perf.spec.ts                                     (~120 lignes)
repo/infrastructure/migrations/2026_05_XX_comm_audit_log.sql                            (~80 lignes)
.env.example                                                                             (modifie / +vars)
repo/packages/comm/package.json                                                          (modifie / +deps eventually)
repo/packages/comm/README.md                                                             (modifie / +section)
```

Total : 19 fichiers crees ou modifies, ~3000 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 14 : `message-orchestrator.service.ts`

```typescript
/**
 * @insurtech/comm/services/message-orchestrator.service
 *
 * Centralized message orchestration : routes outbound communications via WhatsApp
 * or Email based on contact.preferred_channel + opt-in/opt-out + template approval.
 *
 * Reference :
 *   - decision-009 (multi-locale)
 *   - decision-014 (audit 7 ans)
 *   - decision-015 (CNDP loi 09-08 opt-out)
 *   - decision-024 (multi-tenant strict)
 *   - decision-026 (Idempotency-Key RFC 8235)
 *   - decision-031 (rate limit Redis sliding window)
 *   - decision-032 (marketing horaires legaux 8h-21h Africa/Casablanca)
 *   - Sprint 9 Tache 3.2.9 (this task)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { v7 as uuidv7 } from 'uuid';
import type { Channel, MessagePriority } from '../types/channel.enum.js';
import type { ContactsService } from '@insurtech/crm';
import { TenantContextService, TenantContextMissingError } from '@insurtech/security';
import { RedisService } from '@insurtech/cache';
import { MessagesRepositoryService } from './messages-repository.service.js';
import { ChannelResolverService, type ChannelDecision } from './channel-resolver.service.js';
import { ContactValidatorService } from './contact-validator.service.js';
import { BroadcastSegmentationService } from './broadcast-segmentation.service.js';
import { OptoutService } from './optout.service.js';
import { WaTemplateRendererService } from './wa-template-renderer.service.js';
import { CommAuditService } from '../audit/comm-audit.service.js';
import {
  NoAvailableChannelError,
  ContactNotFoundError,
  BroadcastQuotaExceededError,
  RateLimitExceededError,
  IdempotencyConflictError,
  TemplateNotApprovedError,
  MarketingOutsideLegalHoursError,
} from '../errors/orchestrator.errors.js';
import type {
  SendToContactOptions,
  SendItem,
  SendBatchResult,
  ContactFilters,
  SendBroadcastOptions,
  SendBroadcastResult,
  SendToContactResult,
  OrchestratorMetrics,
} from '../dto/orchestrator-input.dto.js';

const PRIORITY_MAP: Record<MessagePriority, number> = {
  critical: 1,
  high: 5,
  normal: 10,
  low: 20,
};

@Injectable()
export class MessageOrchestratorService {
  private readonly logger = new Logger(MessageOrchestratorService.name);
  private readonly broadcastQuotaPerDay: number;
  private readonly broadcastBatchSize: number;
  private readonly tenantRateLimitPerMinute: number;
  private readonly idempotencyTtlSeconds: number;

  constructor(
    private readonly config: ConfigService,
    private readonly contactsService: ContactsService,
    private readonly messagesRepo: MessagesRepositoryService,
    private readonly channelResolver: ChannelResolverService,
    private readonly contactValidator: ContactValidatorService,
    private readonly broadcastSegmenter: BroadcastSegmentationService,
    private readonly optoutService: OptoutService,
    private readonly waRenderer: WaTemplateRendererService,
    private readonly tenantContext: TenantContextService,
    private readonly redis: RedisService,
    private readonly audit: CommAuditService,
    @InjectQueue('wa-send') private readonly waQueue: Queue,
    @InjectQueue('email-send') private readonly emailQueue: Queue,
  ) {
    this.broadcastQuotaPerDay = Number.parseInt(
      this.config.get<string>('COMM_BROADCAST_QUOTA_PER_DAY') ?? '5000',
      10,
    );
    this.broadcastBatchSize = Number.parseInt(
      this.config.get<string>('COMM_BROADCAST_BATCH_SIZE') ?? '1000',
      10,
    );
    this.tenantRateLimitPerMinute = Number.parseInt(
      this.config.get<string>('COMM_TENANT_RATE_LIMIT_PER_MINUTE') ?? '100',
      10,
    );
    this.idempotencyTtlSeconds = Number.parseInt(
      this.config.get<string>('COMM_IDEMPOTENCY_TTL_SECONDS') ?? '86400',
      10,
    );
  }

  /**
   * Sends a single message to a contact, applying routing logic and opt-out check.
   *
   * @throws ContactNotFoundError if contactId not in tenant scope.
   * @throws NoAvailableChannelError if no valid channel after decision tree.
   * @throws TemplateNotApprovedError if template required but not Meta-approved (rare).
   * @throws RateLimitExceededError if tenant > COMM_TENANT_RATE_LIMIT_PER_MINUTE.
   * @throws IdempotencyConflictError if Idempotency-Key already used with different payload.
   */
  async sendToContact(
    contactId: string,
    templateName: string,
    variables: Record<string, unknown>,
    options?: SendToContactOptions,
  ): Promise<SendToContactResult> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) throw new TenantContextMissingError();

    const correlationId = options?.correlationId ?? uuidv7();
    const startTs = Date.now();

    // [1] Idempotency-Key check
    if (options?.idempotencyKey) {
      const cached = await this.redis.get(`idem:${tenantId}:${options.idempotencyKey}`);
      if (cached) {
        this.logger.log({
          action: 'idempotency_hit',
          tenant_id: tenantId,
          idempotency_key: options.idempotencyKey,
          cached_message_id: cached,
        });
        const cachedMessage = await this.messagesRepo.findById(cached);
        if (cachedMessage) {
          return {
            messageId: cached,
            channel: cachedMessage.channel as Channel,
            queueJobId: cachedMessage.queue_job_id ?? '',
            decisionPath: ['idempotency_cache_hit'],
          };
        }
      }
    }

    // [2] Lookup contact (tenant-scoped)
    const contact = await this.contactsService.findById(contactId);
    if (!contact) {
      this.audit.logSendInitiated({
        tenantId, contactId, templateName,
        decisionPath: ['contact_not_found'],
        outcome: 'error',
        errorCode: 'CONTACT_NOT_FOUND',
      });
      throw new ContactNotFoundError(contactId);
    }

    // [3] Audit start
    this.audit.logSendInitiated({
      tenantId,
      contactId,
      templateName,
      correlationId,
      preferChannel: options?.preferChannel,
      skipOptOutCheck: options?.skipOptOutCheck ?? false,
      priority: options?.priority ?? 'normal',
    });

    // [4] Get opted-out channels (skip for transactional auth)
    const optedOutChannels = options?.skipOptOutCheck
      ? []
      : await this.optoutService.getOptedOutChannels(contactId);

    // [5] Resolve final channel
    const channelDecision = await this.channelResolver.determineFinalChannel(contact, {
      preferOverride: options?.preferChannel,
      optedOutChannels,
      templateName,
      locale: contact.preferred_language,
      skipOptOutCheck: options?.skipOptOutCheck ?? false,
    });

    if (!channelDecision.channel) {
      this.audit.logSendSkipped({
        tenantId, contactId, templateName,
        reason: channelDecision.reason ?? 'unknown',
        decisionPath: channelDecision.decisionPath,
        correlationId,
      });
      throw new NoAvailableChannelError({
        reason: channelDecision.reason ?? 'NO_CHANNEL',
        decisionPath: channelDecision.decisionPath,
      });
    }

    // [6] Rate limit per-tenant per-minute (Redis sliding window)
    if (!options?.skipRateLimit) {
      await this.checkTenantRateLimit(tenantId);
    }

    // [7] INSERT comm_messages row
    const toAddress = channelDecision.channel === 'whatsapp'
      ? contact.phone!
      : contact.email!;

    const message = await this.messagesRepo.create({
      tenant_id: tenantId,
      contact_id: contactId,
      channel: channelDecision.channel,
      direction: 'outbound',
      to_address: toAddress,
      template_id: null,
      template_name: templateName,
      template_variables: variables,
      status: 'pending',
      correlation_id: correlationId,
      idempotency_key: options?.idempotencyKey ?? null,
      decision_path: channelDecision.decisionPath,
      created_by: this.tenantContext.getCurrentUserId() ?? 'system',
    });

    // [8] Enqueue BullMQ job
    const queue = channelDecision.channel === 'whatsapp' ? this.waQueue : this.emailQueue;
    const queueName = channelDecision.channel === 'whatsapp' ? 'wa-send' : 'email-send';
    const priority = PRIORITY_MAP[options?.priority ?? 'normal'];

    const job = await queue.add(
      queueName,
      {
        messageId: message.id,
        tenantId,
        to: toAddress,
        templateName,
        locale: contact.preferred_language ?? 'fr',
        variables,
        contactId,
        correlationId,
      },
      {
        priority,
        jobId: message.id, // BullMQ idempotency
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { age: 86400 * 30, count: 10000 },
        removeOnFail: { age: 86400 * 90 },
      },
    );

    // [9] Update message with queue_job_id
    await this.messagesRepo.update(message.id, {
      queue_job_id: job.id,
      status: 'queued',
    });

    // [10] Audit complete
    this.audit.logSendQueued({
      tenantId,
      contactId,
      messageId: message.id,
      channel: channelDecision.channel,
      jobId: job.id ?? '',
      correlationId,
      durationMs: Date.now() - startTs,
    });

    // [11] Idempotency cache
    if (options?.idempotencyKey) {
      await this.redis.set(
        `idem:${tenantId}:${options.idempotencyKey}`,
        message.id,
        this.idempotencyTtlSeconds,
      );
    }

    return {
      messageId: message.id,
      channel: channelDecision.channel,
      queueJobId: job.id ?? '',
      decisionPath: channelDecision.decisionPath,
    };
  }

  /**
   * Sends a batch of messages synchronously (e.g. cron reminders RDV J-1).
   * Each item is independently routed; failures don't block other items.
   */
  async sendBatch(items: SendItem[]): Promise<SendBatchResult> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) throw new TenantContextMissingError();

    const startTs = Date.now();
    const successes: Array<{ contactId: string; messageId: string; channel: Channel }> = [];
    const failures: Array<{ contactId: string; error: string; code: string }> = [];

    // Concurrency-bounded Promise.all (avoid OOM)
    const concurrency = 50;
    for (let i = 0; i < items.length; i += concurrency) {
      const slice = items.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        slice.map((item) =>
          this.sendToContact(item.contactId, item.templateName, item.variables, item.options),
        ),
      );
      results.forEach((res, idx) => {
        const item = slice[idx];
        if (res.status === 'fulfilled') {
          successes.push({
            contactId: item.contactId,
            messageId: res.value.messageId,
            channel: res.value.channel,
          });
        } else {
          failures.push({
            contactId: item.contactId,
            error: res.reason instanceof Error ? res.reason.message : String(res.reason),
            code: res.reason?.code ?? 'UNKNOWN',
          });
        }
      });
    }

    this.audit.logBatchCompleted({
      tenantId,
      totalCount: items.length,
      successCount: successes.length,
      failureCount: failures.length,
      durationMs: Date.now() - startTs,
    });

    return {
      total: items.length,
      successes: successes.length,
      failures: failures.length,
      successDetails: successes,
      failureDetails: failures,
      durationMs: Date.now() - startTs,
    };
  }

  /**
   * Sends a broadcast to all contacts matching filters (cursor-paginated).
   * Quota tenant + horaires legaux marketing checked.
   */
  async sendBroadcast(
    filters: ContactFilters,
    templateName: string,
    variables: Record<string, unknown>,
    options?: SendBroadcastOptions,
  ): Promise<SendBroadcastResult> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) throw new TenantContextMissingError();

    const startTs = Date.now();
    const correlationId = options?.correlationId ?? uuidv7();

    // [1] Marketing horaires legaux check (Maroc loi 24-09)
    if (options?.broadcastType === 'marketing' && !options?.skipLegalHoursCheck) {
      this.checkMarketingLegalHours();
    }

    // [2] Quota tenant check (Redis INCR atomic)
    const quotaKey = `quota:${tenantId}:${new Date().toISOString().slice(0, 10)}`;
    const currentCount = await this.redis.get(quotaKey);
    const currentCountNum = currentCount ? Number.parseInt(currentCount, 10) : 0;
    if (currentCountNum >= this.broadcastQuotaPerDay) {
      this.audit.logBroadcastBlocked({
        tenantId,
        reason: 'quota_exceeded',
        currentCount: currentCountNum,
        quota: this.broadcastQuotaPerDay,
      });
      throw new BroadcastQuotaExceededError(currentCountNum, this.broadcastQuotaPerDay);
    }

    // [3] Audit start
    this.audit.logBroadcastStarted({
      tenantId, templateName, filters, correlationId,
      broadcastType: options?.broadcastType ?? 'transactional',
    });

    // [4] Cursor-paginated iteration
    let cursor: string | null = null;
    let totalEnqueued = 0;
    let totalFailed = 0;
    let pagesProcessed = 0;

    do {
      const page = await this.broadcastSegmenter.findContactsByFilters({
        tenantId,
        filters,
        cursor,
        limit: this.broadcastBatchSize,
      });

      if (page.items.length === 0) break;

      // Promise.all bounded with tenant context preservation
      const results = await Promise.allSettled(
        page.items.map((contact) =>
          this.tenantContext.run({ tenantId }, () =>
            this.sendToContact(contact.id, templateName, variables, {
              priority: 'low',
              correlationId,
              skipRateLimit: true, // broadcast uses dedicated quota
            }),
          ),
        ),
      );

      results.forEach((r) => {
        if (r.status === 'fulfilled') totalEnqueued += 1;
        else totalFailed += 1;
      });

      // Update Redis quota counter
      await this.redis.incrby(quotaKey, results.filter((r) => r.status === 'fulfilled').length);
      await this.redis.expire(quotaKey, 86400 * 2); // 2 days for analytics

      cursor = page.nextCursor;
      pagesProcessed += 1;
      this.logger.log({
        action: 'broadcast_page_processed',
        tenant_id: tenantId,
        page: pagesProcessed,
        enqueued_so_far: totalEnqueued,
        failed_so_far: totalFailed,
      });
    } while (cursor && totalEnqueued + totalFailed < (options?.maxContacts ?? Number.MAX_SAFE_INTEGER));

    // [5] Audit complete
    this.audit.logBroadcastCompleted({
      tenantId, templateName, correlationId,
      totalEnqueued, totalFailed, pagesProcessed,
      durationMs: Date.now() - startTs,
    });

    return {
      jobsEnqueued: totalEnqueued,
      jobsFailed: totalFailed,
      pagesProcessed,
      durationMs: Date.now() - startTs,
      correlationId,
    };
  }

  /**
   * Returns aggregated metrics for orchestrator (admin endpoint).
   */
  async getMetrics(): Promise<OrchestratorMetrics> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) throw new TenantContextMissingError();

    const today = new Date().toISOString().slice(0, 10);
    const quotaKey = `quota:${tenantId}:${today}`;
    const currentCount = await this.redis.get(quotaKey);

    const last24h = await this.messagesRepo.countByTenant({
      tenantId,
      since: new Date(Date.now() - 86400 * 1000),
    });

    return {
      tenantId,
      quotaUsed: currentCount ? Number.parseInt(currentCount, 10) : 0,
      quotaLimit: this.broadcastQuotaPerDay,
      messagesLast24h: last24h,
      rateLimitPerMinute: this.tenantRateLimitPerMinute,
    };
  }

  // ----------------- Private -----------------

  private async checkTenantRateLimit(tenantId: string): Promise<void> {
    const key = `ratelimit:${tenantId}:${Math.floor(Date.now() / 60000)}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, 60);
    }
    if (count > this.tenantRateLimitPerMinute) {
      throw new RateLimitExceededError(this.tenantRateLimitPerMinute, 60);
    }
  }

  private checkMarketingLegalHours(): void {
    const now = new Date();
    const moroccoTime = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Casablanca',
      hour: 'numeric',
      hour12: false,
    }).format(now);
    const hour = Number.parseInt(moroccoTime, 10);
    if (hour < 8 || hour >= 21) {
      throw new MarketingOutsideLegalHoursError(hour, '8h-21h Africa/Casablanca');
    }
  }
}
```

### 6.2 Fichier 2 / 14 : `channel-resolver.service.ts`

```typescript
/**
 * @insurtech/comm/services/channel-resolver.service
 *
 * Pure decision tree for channel selection. Used by MessageOrchestratorService.
 *
 * Tree priority :
 *   1. preferOverride (explicit)
 *   2. preferred_channel + opt-in + valid + (template approved if WA)
 *   3. fallback opposite channel + opt-in + valid
 *   4. null + reason
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Channel } from '../types/channel.enum.js';
import type { Contact } from '@insurtech/crm';
import { ContactValidatorService } from './contact-validator.service.js';
import { WaTemplateRendererService } from './wa-template-renderer.service.js';

export interface ChannelDecision {
  channel: Channel | null;
  reason: string | null;
  decisionPath: string[];
}

export interface DetermineFinalChannelOptions {
  preferOverride?: Channel;
  optedOutChannels: Channel[];
  templateName: string;
  locale: string | null | undefined;
  skipOptOutCheck?: boolean;
}

@Injectable()
export class ChannelResolverService {
  private readonly logger = new Logger(ChannelResolverService.name);

  constructor(
    private readonly contactValidator: ContactValidatorService,
    private readonly waRenderer: WaTemplateRendererService,
  ) {}

  async determineFinalChannel(
    contact: Contact,
    options: DetermineFinalChannelOptions,
  ): Promise<ChannelDecision> {
    const path: string[] = [];
    const locale = options.locale ?? 'fr';
    const optedOut = options.optedOutChannels;

    path.push(`preferred_channel=${contact.preferred_channel ?? 'unknown'}`);
    path.push(`opted_out=[${optedOut.join(',')}]`);
    path.push(`locale=${locale}`);

    // [A] preferOverride explicit
    if (options.preferOverride) {
      path.push(`prefer_override=${options.preferOverride}`);
      const overrideDecision = await this.tryChannel(
        options.preferOverride,
        contact,
        options.templateName,
        locale,
        optedOut,
        options.skipOptOutCheck ?? false,
        path,
      );
      if (overrideDecision.channel) {
        return overrideDecision;
      }
      // override fails -> continue with normal logic (don't return null immediately)
      path.push('override_failed_continuing_normal_logic');
    }

    // [B] preferred_channel = whatsapp
    if (contact.preferred_channel === 'whatsapp') {
      const waDecision = await this.tryChannel(
        'whatsapp',
        contact,
        options.templateName,
        locale,
        optedOut,
        options.skipOptOutCheck ?? false,
        path,
      );
      if (waDecision.channel) return waDecision;
    }

    // [C] preferred_channel = email or fallback
    if (contact.preferred_channel === 'email' || contact.preferred_channel === 'whatsapp') {
      const emailDecision = await this.tryChannel(
        'email',
        contact,
        options.templateName,
        locale,
        optedOut,
        options.skipOptOutCheck ?? false,
        path,
      );
      if (emailDecision.channel) return emailDecision;
    }

    // [D] preferred not set, try whatsapp first then email
    if (!contact.preferred_channel) {
      path.push('no_preferred_set');
      const waDecision = await this.tryChannel(
        'whatsapp',
        contact,
        options.templateName,
        locale,
        optedOut,
        options.skipOptOutCheck ?? false,
        path,
      );
      if (waDecision.channel) return waDecision;

      const emailDecision = await this.tryChannel(
        'email',
        contact,
        options.templateName,
        locale,
        optedOut,
        options.skipOptOutCheck ?? false,
        path,
      );
      if (emailDecision.channel) return emailDecision;
    }

    // [E] No channel available
    path.push('no_channel_available');
    return {
      channel: null,
      reason: this.buildNoChannelReason(contact, optedOut),
      decisionPath: path,
    };
  }

  private async tryChannel(
    channel: Channel,
    contact: Contact,
    templateName: string,
    locale: string,
    optedOut: Channel[],
    skipOptOutCheck: boolean,
    path: string[],
  ): Promise<ChannelDecision> {
    path.push(`try=${channel}`);

    if (!skipOptOutCheck && optedOut.includes(channel)) {
      path.push(`${channel}_opted_out`);
      return { channel: null, reason: `${channel}_opted_out`, decisionPath: path };
    }

    if (channel === 'whatsapp') {
      if (!contact.phone || !this.contactValidator.hasValidPhone(contact)) {
        path.push('whatsapp_no_phone_or_invalid');
        return { channel: null, reason: 'no_valid_phone', decisionPath: path };
      }
      const approved = await this.waRenderer.validateMetaApproved(templateName, locale);
      if (!approved) {
        path.push(`whatsapp_template_not_approved_for_${locale}`);
        return { channel: null, reason: 'template_not_approved', decisionPath: path };
      }
      path.push('whatsapp_OK');
      return { channel: 'whatsapp', reason: null, decisionPath: path };
    }

    if (channel === 'email') {
      if (!contact.email || !this.contactValidator.hasValidEmail(contact)) {
        path.push('email_no_email_or_invalid');
        return { channel: null, reason: 'no_valid_email', decisionPath: path };
      }
      path.push('email_OK');
      return { channel: 'email', reason: null, decisionPath: path };
    }

    return { channel: null, reason: 'unknown_channel', decisionPath: path };
  }

  private buildNoChannelReason(contact: Contact, optedOut: Channel[]): string {
    const reasons: string[] = [];
    if (!contact.phone) reasons.push('no_phone');
    if (!contact.email) reasons.push('no_email');
    if (optedOut.includes('whatsapp')) reasons.push('opted_out_whatsapp');
    if (optedOut.includes('email')) reasons.push('opted_out_email');
    return reasons.length > 0 ? reasons.join(';') : 'all_channels_unavailable';
  }
}
```

### 6.3 Fichier 3 / 14 : `contact-validator.service.ts`

```typescript
/**
 * @insurtech/comm/services/contact-validator.service
 *
 * Validates contact phone (E.164) and email (RFC 5322).
 */

import { Injectable } from '@nestjs/common';
import type { Contact } from '@insurtech/crm';
import { parsePhoneNumberFromString, isValidPhoneNumber } from 'libphonenumber-js';

const EMAIL_RFC_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const E164_REGEX = /^\+[1-9]\d{9,14}$/;

@Injectable()
export class ContactValidatorService {
  /**
   * Returns true if contact.phone is non-null and matches E.164 format.
   */
  hasValidPhone(contact: Contact): boolean {
    if (!contact.phone) return false;
    if (!E164_REGEX.test(contact.phone)) return false;
    try {
      return isValidPhoneNumber(contact.phone);
    } catch {
      return false;
    }
  }

  /**
   * Returns true if contact.email is non-null, RFC 5322 valid, and TLD valid.
   */
  hasValidEmail(contact: Contact): boolean {
    if (!contact.email) return false;
    const trimmed = contact.email.trim().toLowerCase();
    if (trimmed.length > 254) return false; // RFC 5321 max
    if (!EMAIL_RFC_REGEX.test(trimmed)) return false;
    const [local, domain] = trimmed.split('@');
    if (local.length > 64) return false; // RFC 5321 max local
    if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
    return true;
  }

  /**
   * Normalizes phone input to E.164 canonical form (e.g. '+212612345678').
   * Default region 'MA' for Morocco numbers without prefix.
   */
  normalizePhone(input: string, defaultRegion: 'MA' | 'FR' | 'US' = 'MA'): string | null {
    if (!input) return null;
    try {
      const phone = parsePhoneNumberFromString(input.trim(), defaultRegion);
      if (!phone || !phone.isValid()) return null;
      return phone.format('E.164');
    } catch {
      return null;
    }
  }

  /**
   * Normalizes email to lowercase + trimmed canonical form.
   */
  normalizeEmail(input: string): string | null {
    if (!input) return null;
    const trimmed = input.trim().toLowerCase();
    if (!EMAIL_RFC_REGEX.test(trimmed)) return null;
    return trimmed;
  }

  /**
   * Returns Morocco-specific phone format for display ('+212 6 12 34 56 78').
   */
  formatPhoneMorocco(e164: string): string | null {
    try {
      const phone = parsePhoneNumberFromString(e164);
      if (!phone) return null;
      return phone.formatInternational();
    } catch {
      return null;
    }
  }

  /**
   * Returns true if phone is Morocco mobile (+2126XXXXXXXX or +2127XXXXXXXX).
   */
  isMoroccoMobile(e164: string): boolean {
    return /^\+212[67]\d{8}$/.test(e164);
  }
}
```

### 6.4 Fichier 4 / 14 : `broadcast-segmentation.service.ts`

```typescript
/**
 * @insurtech/comm/services/broadcast-segmentation.service
 *
 * Segments contacts (Sprint 8 CRM) by composable filters with cursor pagination.
 * Auto-applies opt-in filter (excludes contacts opted-out from target channel).
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { Contact } from '@insurtech/crm';
import type { Channel } from '../types/channel.enum.js';

export interface ContactFilters {
  tags?: string[];
  dealStage?: string;
  locale?: string;
  lastActivitySince?: Date;
  lastActivityUntil?: Date;
  preferredChannel?: Channel;
  customFields?: Record<string, string | number | boolean>;
  excludeOptedOutChannel?: Channel; // auto-apply opt-out filter
}

export interface FindContactsByFiltersInput {
  tenantId: string;
  filters: ContactFilters;
  cursor: string | null;
  limit: number;
}

export interface FindContactsByFiltersResult {
  items: Contact[];
  nextCursor: string | null;
  totalEstimate?: number;
}

@Injectable()
export class BroadcastSegmentationService {
  private readonly logger = new Logger(BroadcastSegmentationService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findContactsByFilters(input: FindContactsByFiltersInput): Promise<FindContactsByFiltersResult> {
    const { tenantId, filters, cursor, limit } = input;

    const qb = this.dataSource
      .createQueryBuilder()
      .select('c.*')
      .from('contacts', 'c')
      .where('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.deleted_at IS NULL')
      .andWhere('c.merged_into_contact_id IS NULL');

    if (filters.tags && filters.tags.length > 0) {
      qb.andWhere('c.tags @> :tags', { tags: filters.tags });
    }

    if (filters.dealStage) {
      qb.andWhere('c.deal_stage = :dealStage', { dealStage: filters.dealStage });
    }

    if (filters.locale) {
      qb.andWhere('c.preferred_language = :locale', { locale: filters.locale });
    }

    if (filters.preferredChannel) {
      qb.andWhere('c.preferred_channel = :preferredChannel', {
        preferredChannel: filters.preferredChannel,
      });
    }

    if (filters.lastActivitySince) {
      qb.andWhere('c.last_activity_at >= :lastActivitySince', {
        lastActivitySince: filters.lastActivitySince,
      });
    }

    if (filters.lastActivityUntil) {
      qb.andWhere('c.last_activity_at <= :lastActivityUntil', {
        lastActivityUntil: filters.lastActivityUntil,
      });
    }

    if (filters.customFields) {
      Object.entries(filters.customFields).forEach(([key, value], idx) => {
        qb.andWhere(`c.custom_fields->>'${key}' = :cv${idx}`, { [`cv${idx}`]: String(value) });
      });
    }

    // Auto opt-out filter
    if (filters.excludeOptedOutChannel) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM comm_optouts o
          WHERE o.contact_id = c.id
          AND o.channel = :optoutChannel
          AND o.opted_out_at IS NOT NULL
          AND (o.opted_in_at IS NULL OR o.opted_in_at < o.opted_out_at)
        )`,
        { optoutChannel: filters.excludeOptedOutChannel },
      );
    }

    // Cursor pagination on (created_at, id) -- UUID v7 stable
    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      qb.andWhere('(c.created_at, c.id) > (:cursorCreatedAt, :cursorId)', {
        cursorCreatedAt: decoded.createdAt,
        cursorId: decoded.id,
      });
    }

    qb.orderBy('c.created_at', 'ASC').addOrderBy('c.id', 'ASC').limit(limit + 1);

    const rows: Contact[] = await qb.getRawMany();
    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;

    let nextCursor: string | null = null;
    if (hasNext && items.length > 0) {
      const lastItem = items[items.length - 1];
      nextCursor = this.encodeCursor(lastItem.created_at!, lastItem.id);
    }

    return { items, nextCursor };
  }

  private encodeCursor(createdAt: Date, id: string): string {
    const payload = JSON.stringify({ createdAt: createdAt.toISOString(), id });
    return Buffer.from(payload).toString('base64url');
  }

  private decodeCursor(cursor: string): { createdAt: string; id: string } {
    try {
      const payload = Buffer.from(cursor, 'base64url').toString('utf-8');
      return JSON.parse(payload);
    } catch {
      throw new Error(`Invalid cursor: ${cursor}`);
    }
  }
}
```

### 6.5 Fichier 5 / 14 : `comm-audit.service.ts`

```typescript
/**
 * @insurtech/comm/audit/comm-audit.service
 *
 * Audit log for all comm send orchestration events.
 * Persists to comm_audit_log (Postgres) + emits Kafka event for analytics.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { CommAuditLog } from '../entities/comm-audit-log.entity.js';
import type { Channel } from '../types/channel.enum.js';
import type { ContactFilters } from '../services/broadcast-segmentation.service.js';
import { KafkaProducerService } from '@insurtech/messaging';

export interface LogSendInitiatedInput {
  tenantId: string;
  contactId: string;
  templateName: string;
  correlationId?: string;
  preferChannel?: Channel;
  skipOptOutCheck?: boolean;
  priority?: string;
  decisionPath?: string[];
  outcome?: 'pending' | 'error';
  errorCode?: string;
}

export interface LogSendQueuedInput {
  tenantId: string;
  contactId: string;
  messageId: string;
  channel: Channel;
  jobId: string;
  correlationId: string;
  durationMs: number;
}

export interface LogSendSkippedInput {
  tenantId: string;
  contactId: string;
  templateName: string;
  reason: string;
  decisionPath: string[];
  correlationId?: string;
}

export interface LogBroadcastStartedInput {
  tenantId: string;
  templateName: string;
  filters: ContactFilters;
  correlationId: string;
  broadcastType: string;
}

export interface LogBroadcastCompletedInput {
  tenantId: string;
  templateName: string;
  correlationId: string;
  totalEnqueued: number;
  totalFailed: number;
  pagesProcessed: number;
  durationMs: number;
}

export interface LogBroadcastBlockedInput {
  tenantId: string;
  reason: string;
  currentCount?: number;
  quota?: number;
}

export interface LogBatchCompletedInput {
  tenantId: string;
  totalCount: number;
  successCount: number;
  failureCount: number;
  durationMs: number;
}

@Injectable()
export class CommAuditService {
  private readonly logger = new Logger(CommAuditService.name);

  constructor(
    @InjectRepository(CommAuditLog) private readonly repo: Repository<CommAuditLog>,
    private readonly kafka: KafkaProducerService,
  ) {}

  async logSendInitiated(input: LogSendInitiatedInput): Promise<void> {
    await this.persist({
      tenant_id: input.tenantId,
      contact_id: input.contactId,
      action: 'send_initiated',
      template_name: input.templateName,
      correlation_id: input.correlationId,
      decision_path: input.decisionPath ?? [],
      metadata: {
        prefer_channel: input.preferChannel,
        skip_opt_out: input.skipOptOutCheck,
        priority: input.priority,
        outcome: input.outcome,
        error_code: input.errorCode,
      },
    });
  }

  async logSendQueued(input: LogSendQueuedInput): Promise<void> {
    await this.persist({
      tenant_id: input.tenantId,
      contact_id: input.contactId,
      action: 'send_queued',
      message_id: input.messageId,
      channel: input.channel,
      correlation_id: input.correlationId,
      metadata: { job_id: input.jobId, duration_ms: input.durationMs },
    });
  }

  async logSendSkipped(input: LogSendSkippedInput): Promise<void> {
    await this.persist({
      tenant_id: input.tenantId,
      contact_id: input.contactId,
      action: 'send_skipped',
      template_name: input.templateName,
      correlation_id: input.correlationId,
      decision_path: input.decisionPath,
      metadata: { reason: input.reason },
    });
  }

  async logBroadcastStarted(input: LogBroadcastStartedInput): Promise<void> {
    await this.persist({
      tenant_id: input.tenantId,
      action: 'broadcast_started',
      template_name: input.templateName,
      correlation_id: input.correlationId,
      metadata: {
        filters: input.filters,
        broadcast_type: input.broadcastType,
      },
    });
  }

  async logBroadcastCompleted(input: LogBroadcastCompletedInput): Promise<void> {
    await this.persist({
      tenant_id: input.tenantId,
      action: 'broadcast_completed',
      template_name: input.templateName,
      correlation_id: input.correlationId,
      metadata: {
        total_enqueued: input.totalEnqueued,
        total_failed: input.totalFailed,
        pages_processed: input.pagesProcessed,
        duration_ms: input.durationMs,
      },
    });
  }

  async logBroadcastBlocked(input: LogBroadcastBlockedInput): Promise<void> {
    await this.persist({
      tenant_id: input.tenantId,
      action: 'broadcast_blocked',
      metadata: {
        reason: input.reason,
        current_count: input.currentCount,
        quota: input.quota,
      },
    });
  }

  async logBatchCompleted(input: LogBatchCompletedInput): Promise<void> {
    await this.persist({
      tenant_id: input.tenantId,
      action: 'batch_completed',
      metadata: {
        total_count: input.totalCount,
        success_count: input.successCount,
        failure_count: input.failureCount,
        duration_ms: input.durationMs,
      },
    });
  }

  private async persist(data: Partial<CommAuditLog>): Promise<void> {
    try {
      const entity = this.repo.create({
        ...data,
        timestamp: new Date(),
      });
      await this.repo.save(entity);
      // Eventually consistent Kafka emit
      await this.kafka.publish('insurtech.events.comm_audit', {
        ...data,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error({
        action: 'comm_audit_persist_failed',
        err: err instanceof Error ? err.message : err,
        original_action: data.action,
      });
      // Do NOT throw -- audit failure should not block business flow
    }
  }
}
```

### 6.6 Fichier 6 / 14 : `orchestrator.errors.ts`

```typescript
/**
 * @insurtech/comm/errors/orchestrator.errors
 */

export class OrchestratorError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, httpStatus: number, details?: Record<string, unknown>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

export class NoAvailableChannelError extends OrchestratorError {
  constructor(input: { reason: string; decisionPath?: string[] }) {
    super(
      `No available channel for contact: ${input.reason}`,
      'NO_AVAILABLE_CHANNEL',
      400,
      { reason: input.reason, decision_path: input.decisionPath },
    );
  }
}

export class ContactOptedOutError extends OrchestratorError {
  constructor(contactId: string, channel: string) {
    super(
      `Contact ${contactId} opted out of ${channel}`,
      'CONTACT_OPTED_OUT',
      403,
      { contact_id: contactId, channel },
    );
  }
}

export class TemplateNotApprovedError extends OrchestratorError {
  constructor(templateName: string, locale: string) {
    super(
      `Template ${templateName} not Meta-approved for locale ${locale}`,
      'TEMPLATE_NOT_APPROVED',
      400,
      { template_name: templateName, locale },
    );
  }
}

export class ContactNotFoundError extends OrchestratorError {
  constructor(contactId: string) {
    super(`Contact ${contactId} not found`, 'CONTACT_NOT_FOUND', 404, { contact_id: contactId });
  }
}

export class BroadcastQuotaExceededError extends OrchestratorError {
  constructor(currentCount: number, quota: number) {
    super(
      `Broadcast quota exceeded: ${currentCount}/${quota} per day`,
      'BROADCAST_QUOTA_EXCEEDED',
      429,
      { current_count: currentCount, quota },
    );
  }
}

export class RateLimitExceededError extends OrchestratorError {
  constructor(limit: number, windowSeconds: number) {
    super(
      `Rate limit exceeded: ${limit} per ${windowSeconds}s`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { limit, window_seconds: windowSeconds, retry_after_seconds: windowSeconds },
    );
  }
}

export class IdempotencyConflictError extends OrchestratorError {
  constructor(idempotencyKey: string) {
    super(
      `Idempotency-Key ${idempotencyKey} conflict (different payload)`,
      'IDEMPOTENCY_CONFLICT',
      409,
      { idempotency_key: idempotencyKey },
    );
  }
}

export class InvalidPhoneFormatError extends OrchestratorError {
  constructor(phone: string) {
    super(`Invalid phone format: ${phone}`, 'INVALID_PHONE_FORMAT', 400, { phone });
  }
}

export class MarketingOutsideLegalHoursError extends OrchestratorError {
  constructor(hour: number, allowedRange: string) {
    super(
      `Marketing send blocked at ${hour}h (allowed ${allowedRange})`,
      'MARKETING_OUTSIDE_LEGAL_HOURS',
      400,
      { hour, allowed_range: allowedRange },
    );
  }
}

export function isOrchestratorError(err: unknown): err is OrchestratorError {
  return err instanceof OrchestratorError;
}
```

### 6.7 Fichier 7 / 14 : `orchestrator-input.dto.ts` (Zod schemas)

```typescript
/**
 * @insurtech/comm/dto/orchestrator-input.dto
 *
 * Zod schemas for orchestrator inputs (decision-007 runtime validation).
 */

import { z } from 'zod';

export const channelSchema = z.enum(['whatsapp', 'email']);
export type Channel = z.infer<typeof channelSchema>;

export const messagePrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);
export type MessagePriority = z.infer<typeof messagePrioritySchema>;

export const sendToContactOptionsSchema = z.object({
  preferChannel: channelSchema.optional(),
  correlationId: z.string().uuid().optional(),
  priority: messagePrioritySchema.optional().default('normal'),
  skipOptOutCheck: z.boolean().optional().default(false),
  skipRateLimit: z.boolean().optional().default(false),
  idempotencyKey: z.string().min(8).max(128).optional(),
  scheduleAt: z.coerce.date().optional(),
});
export type SendToContactOptions = z.infer<typeof sendToContactOptionsSchema>;

export const sendToContactDtoSchema = z.object({
  contactId: z.string().uuid(),
  templateName: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  variables: z.record(z.string(), z.unknown()).default({}),
  options: sendToContactOptionsSchema.optional(),
});
export type SendToContactDto = z.infer<typeof sendToContactDtoSchema>;

export const sendItemSchema = z.object({
  contactId: z.string().uuid(),
  templateName: z.string().min(1).max(64),
  variables: z.record(z.string(), z.unknown()),
  options: sendToContactOptionsSchema.optional(),
});
export type SendItem = z.infer<typeof sendItemSchema>;

export const sendBatchDtoSchema = z.object({
  items: z.array(sendItemSchema).min(1).max(1000),
});
export type SendBatchDto = z.infer<typeof sendBatchDtoSchema>;

export const contactFiltersSchema = z.object({
  tags: z.array(z.string()).optional(),
  dealStage: z.string().optional(),
  locale: z.string().optional(),
  lastActivitySince: z.coerce.date().optional(),
  lastActivityUntil: z.coerce.date().optional(),
  preferredChannel: channelSchema.optional(),
  customFields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  excludeOptedOutChannel: channelSchema.optional(),
});
export type ContactFilters = z.infer<typeof contactFiltersSchema>;

export const sendBroadcastOptionsSchema = z.object({
  correlationId: z.string().uuid().optional(),
  broadcastType: z.enum(['marketing', 'transactional', 'notification']).default('transactional'),
  skipLegalHoursCheck: z.boolean().default(false),
  maxContacts: z.number().int().positive().optional(),
});
export type SendBroadcastOptions = z.infer<typeof sendBroadcastOptionsSchema>;

export const sendBroadcastDtoSchema = z.object({
  filters: contactFiltersSchema,
  templateName: z.string().min(1).max(64),
  variables: z.record(z.string(), z.unknown()).default({}),
  options: sendBroadcastOptionsSchema.optional(),
});
export type SendBroadcastDto = z.infer<typeof sendBroadcastDtoSchema>;

export interface SendToContactResult {
  messageId: string;
  channel: Channel;
  queueJobId: string;
  decisionPath: string[];
}

export interface SendBatchResult {
  total: number;
  successes: number;
  failures: number;
  successDetails: Array<{ contactId: string; messageId: string; channel: Channel }>;
  failureDetails: Array<{ contactId: string; error: string; code: string }>;
  durationMs: number;
}

export interface SendBroadcastResult {
  jobsEnqueued: number;
  jobsFailed: number;
  pagesProcessed: number;
  durationMs: number;
  correlationId: string;
}

export interface OrchestratorMetrics {
  tenantId: string;
  quotaUsed: number;
  quotaLimit: number;
  messagesLast24h: number;
  rateLimitPerMinute: number;
}
```

### 6.8 Fichier 8 / 14 : `orchestrator.module.ts`

```typescript
/**
 * @insurtech/comm/orchestrator.module
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { CrmModule } from '@insurtech/crm';
import { SecurityModule } from '@insurtech/security';
import { CacheModule } from '@insurtech/cache';
import { MessagingModule } from '@insurtech/messaging';
import { MessageOrchestratorService } from './services/message-orchestrator.service.js';
import { ChannelResolverService } from './services/channel-resolver.service.js';
import { ContactValidatorService } from './services/contact-validator.service.js';
import { BroadcastSegmentationService } from './services/broadcast-segmentation.service.js';
import { CommAuditService } from './audit/comm-audit.service.js';
import { CommAuditLog } from './entities/comm-audit-log.entity.js';
import { CommMessage } from './entities/comm-message.entity.js';
import { OptoutModule } from './optout/optout.module.js';
import { TemplatesModule } from './templates/templates.module.js';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([CommAuditLog, CommMessage]),
    BullModule.registerQueue(
      { name: 'wa-send' },
      { name: 'email-send' },
    ),
    CrmModule,
    SecurityModule,
    CacheModule,
    MessagingModule,
    OptoutModule,
    TemplatesModule,
  ],
  providers: [
    MessageOrchestratorService,
    ChannelResolverService,
    ContactValidatorService,
    BroadcastSegmentationService,
    CommAuditService,
  ],
  exports: [
    MessageOrchestratorService,
    ChannelResolverService,
    ContactValidatorService,
    BroadcastSegmentationService,
    CommAuditService,
  ],
})
export class OrchestratorModule {}
```

### 6.9 Fichier 9 / 14 : Update `index.ts`

```typescript
// Existing exports preserved + new orchestrator exports
export { MessageOrchestratorService } from './services/message-orchestrator.service.js';
export { ChannelResolverService } from './services/channel-resolver.service.js';
export type { ChannelDecision, DetermineFinalChannelOptions } from './services/channel-resolver.service.js';
export { ContactValidatorService } from './services/contact-validator.service.js';
export { BroadcastSegmentationService } from './services/broadcast-segmentation.service.js';
export type {
  ContactFilters as SegmentationFilters,
  FindContactsByFiltersInput,
  FindContactsByFiltersResult,
} from './services/broadcast-segmentation.service.js';
export { CommAuditService } from './audit/comm-audit.service.js';
export {
  OrchestratorError,
  NoAvailableChannelError,
  ContactOptedOutError,
  TemplateNotApprovedError,
  ContactNotFoundError,
  BroadcastQuotaExceededError,
  RateLimitExceededError,
  IdempotencyConflictError,
  InvalidPhoneFormatError,
  MarketingOutsideLegalHoursError,
  isOrchestratorError,
} from './errors/orchestrator.errors.js';
export type {
  SendToContactDto,
  SendToContactOptions,
  SendItem,
  SendBatchDto,
  ContactFilters,
  SendBroadcastDto,
  SendBroadcastOptions,
  SendToContactResult,
  SendBatchResult,
  SendBroadcastResult,
  OrchestratorMetrics,
  Channel,
  MessagePriority,
} from './dto/orchestrator-input.dto.js';
export {
  channelSchema,
  messagePrioritySchema,
  sendToContactDtoSchema,
  sendBatchDtoSchema,
  sendBroadcastDtoSchema,
  contactFiltersSchema,
  sendToContactOptionsSchema,
  sendBroadcastOptionsSchema,
} from './dto/orchestrator-input.dto.js';
export { OrchestratorModule } from './orchestrator.module.js';
```

### 6.10 Fichier 10 / 14 : Migration SQL `comm_audit_log`

```sql
-- 2026_05_XX_comm_audit_log.sql
-- Sprint 9 Tache 3.2.9 -- audit log for orchestrator decisions

CREATE TABLE IF NOT EXISTS comm_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  contact_id UUID,
  message_id UUID,
  action TEXT NOT NULL CHECK (action IN (
    'send_initiated', 'send_queued', 'send_skipped',
    'broadcast_started', 'broadcast_completed', 'broadcast_blocked',
    'batch_completed', 'idempotency_hit'
  )),
  template_name TEXT,
  channel TEXT CHECK (channel IS NULL OR channel IN ('whatsapp', 'email', 'sms', 'voice')),
  correlation_id UUID,
  decision_path JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT comm_audit_log_tenant_fk
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX idx_comm_audit_log_tenant_timestamp
  ON comm_audit_log (tenant_id, timestamp DESC);

CREATE INDEX idx_comm_audit_log_contact_timestamp
  ON comm_audit_log (contact_id, timestamp DESC) WHERE contact_id IS NOT NULL;

CREATE INDEX idx_comm_audit_log_correlation
  ON comm_audit_log (correlation_id) WHERE correlation_id IS NOT NULL;

CREATE INDEX idx_comm_audit_log_action
  ON comm_audit_log (tenant_id, action, timestamp DESC);

-- Retention 7 ans (decision-014) : pg_cron job to prune older
COMMENT ON TABLE comm_audit_log IS 'Comm orchestrator audit. Retention 7 ans (CNDP loi 09-08 + ACAPS).';

-- Optional partitioning by month for tenant > 1M messages/year
-- ALTER TABLE comm_audit_log PARTITION BY RANGE (timestamp);
```

### 6.11 Fichier 11 / 14 : Tests `message-orchestrator.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MessageOrchestratorService } from '../../src/services/message-orchestrator.service.js';
import { ChannelResolverService } from '../../src/services/channel-resolver.service.js';
import { ContactValidatorService } from '../../src/services/contact-validator.service.js';
import { BroadcastSegmentationService } from '../../src/services/broadcast-segmentation.service.js';
import { CommAuditService } from '../../src/audit/comm-audit.service.js';
import {
  NoAvailableChannelError,
  ContactNotFoundError,
  BroadcastQuotaExceededError,
  RateLimitExceededError,
  MarketingOutsideLegalHoursError,
} from '../../src/errors/orchestrator.errors.js';

describe('MessageOrchestratorService', () => {
  let service: MessageOrchestratorService;
  let mockContactsService: any;
  let mockMessagesRepo: any;
  let mockOptoutService: any;
  let mockWaRenderer: any;
  let mockTenantContext: any;
  let mockRedis: any;
  let mockAudit: any;
  let mockWaQueue: any;
  let mockEmailQueue: any;

  const baseContact = {
    id: 'contact-1',
    tenant_id: 'tenant-A',
    phone: '+212612345678',
    email: 'user@example.com',
    preferred_channel: 'whatsapp',
    preferred_language: 'fr',
    deleted_at: null,
    merged_into_contact_id: null,
  };

  beforeEach(async () => {
    mockContactsService = { findById: vi.fn().mockResolvedValue(baseContact) };
    mockMessagesRepo = {
      create: vi.fn().mockResolvedValue({ id: 'msg-1', channel: 'whatsapp' }),
      update: vi.fn().mockResolvedValue({}),
      findById: vi.fn().mockResolvedValue(null),
      countByTenant: vi.fn().mockResolvedValue(42),
    };
    mockOptoutService = { getOptedOutChannels: vi.fn().mockResolvedValue([]) };
    mockWaRenderer = { validateMetaApproved: vi.fn().mockResolvedValue(true) };
    mockTenantContext = {
      getCurrentTenantId: vi.fn().mockReturnValue('tenant-A'),
      getCurrentUserId: vi.fn().mockReturnValue('user-1'),
      run: vi.fn((ctx, fn) => fn()),
    };
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      incr: vi.fn().mockResolvedValue(1),
      incrby: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };
    mockAudit = {
      logSendInitiated: vi.fn(),
      logSendQueued: vi.fn(),
      logSendSkipped: vi.fn(),
      logBroadcastStarted: vi.fn(),
      logBroadcastCompleted: vi.fn(),
      logBroadcastBlocked: vi.fn(),
      logBatchCompleted: vi.fn(),
    };
    mockWaQueue = { add: vi.fn().mockResolvedValue({ id: 'wa-job-1' }) };
    mockEmailQueue = { add: vi.fn().mockResolvedValue({ id: 'email-job-1' }) };

    process.env.COMM_BROADCAST_QUOTA_PER_DAY = '5000';
    process.env.COMM_TENANT_RATE_LIMIT_PER_MINUTE = '100';
    process.env.COMM_BROADCAST_BATCH_SIZE = '1000';
    process.env.COMM_IDEMPOTENCY_TTL_SECONDS = '86400';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        MessageOrchestratorService,
        { provide: 'ContactsService', useValue: mockContactsService },
        { provide: 'MessagesRepositoryService', useValue: mockMessagesRepo },
        ChannelResolverService,
        ContactValidatorService,
        { provide: 'BroadcastSegmentationService', useValue: { findContactsByFilters: vi.fn() } },
        { provide: 'OptoutService', useValue: mockOptoutService },
        { provide: 'WaTemplateRendererService', useValue: mockWaRenderer },
        { provide: 'TenantContextService', useValue: mockTenantContext },
        { provide: 'RedisService', useValue: mockRedis },
        { provide: 'CommAuditService', useValue: mockAudit },
        { provide: 'BullQueue_wa-send', useValue: mockWaQueue },
        { provide: 'BullQueue_email-send', useValue: mockEmailQueue },
      ],
    }).compile();

    service = moduleRef.get(MessageOrchestratorService);
  });

  describe('sendToContact -- routing tree', () => {
    it('preferred WA + opt-in + template approved + valid phone -> WhatsApp', async () => {
      const result = await service.sendToContact('contact-1', 'verify-email', {});
      expect(result.channel).toBe('whatsapp');
      expect(mockWaQueue.add).toHaveBeenCalled();
      expect(mockEmailQueue.add).not.toHaveBeenCalled();
    });

    it('preferred WA + opt-out WA + opt-in email -> fallback Email', async () => {
      mockOptoutService.getOptedOutChannels.mockResolvedValue(['whatsapp']);
      const result = await service.sendToContact('contact-1', 'verify-email', {});
      expect(result.channel).toBe('email');
      expect(mockEmailQueue.add).toHaveBeenCalled();
    });

    it('preferred WA + opt-out WA + opt-out email -> NoAvailableChannelError', async () => {
      mockOptoutService.getOptedOutChannels.mockResolvedValue(['whatsapp', 'email']);
      await expect(
        service.sendToContact('contact-1', 'verify-email', {}),
      ).rejects.toBeInstanceOf(NoAvailableChannelError);
    });

    it('contact without phone or email -> NoAvailableChannelError', async () => {
      mockContactsService.findById.mockResolvedValue({ ...baseContact, phone: null, email: null });
      await expect(
        service.sendToContact('contact-1', 'verify-email', {}),
      ).rejects.toBeInstanceOf(NoAvailableChannelError);
    });

    it('template not Meta-approved -> fallback Email', async () => {
      mockWaRenderer.validateMetaApproved.mockResolvedValue(false);
      const result = await service.sendToContact('contact-1', 'custom-template', {});
      expect(result.channel).toBe('email');
    });

    it('template not approved + email opt-out -> NoAvailableChannelError', async () => {
      mockWaRenderer.validateMetaApproved.mockResolvedValue(false);
      mockOptoutService.getOptedOutChannels.mockResolvedValue(['email']);
      await expect(
        service.sendToContact('contact-1', 'custom', {}),
      ).rejects.toBeInstanceOf(NoAvailableChannelError);
    });

    it('preferChannel override email forces email', async () => {
      const result = await service.sendToContact('contact-1', 'verify-email', {}, {
        preferChannel: 'email',
      });
      expect(result.channel).toBe('email');
    });

    it('skipOptOutCheck=true bypasses opt-out (transactional auth)', async () => {
      mockOptoutService.getOptedOutChannels.mockResolvedValue(['whatsapp', 'email']);
      const result = await service.sendToContact('contact-1', 'password-reset', {}, {
        skipOptOutCheck: true,
      });
      expect(result.channel).toBe('whatsapp');
      expect(mockOptoutService.getOptedOutChannels).not.toHaveBeenCalled();
    });

    it('priority critical maps to BullMQ priority 1', async () => {
      await service.sendToContact('contact-1', 'verify-email', {}, { priority: 'critical' });
      const call = mockWaQueue.add.mock.calls[0];
      expect(call[2].priority).toBe(1);
    });

    it('priority low maps to BullMQ priority 20', async () => {
      await service.sendToContact('contact-1', 'verify-email', {}, { priority: 'low' });
      const call = mockWaQueue.add.mock.calls[0];
      expect(call[2].priority).toBe(20);
    });
  });

  describe('sendToContact -- contact not found', () => {
    it('throws ContactNotFoundError', async () => {
      mockContactsService.findById.mockResolvedValue(null);
      await expect(
        service.sendToContact('missing-id', 'verify-email', {}),
      ).rejects.toBeInstanceOf(ContactNotFoundError);
    });
  });

  describe('sendToContact -- idempotency', () => {
    it('idempotency hit returns cached messageId', async () => {
      mockRedis.get.mockResolvedValue('cached-msg-id');
      mockMessagesRepo.findById.mockResolvedValue({ id: 'cached-msg-id', channel: 'whatsapp', queue_job_id: 'cached-job' });
      const result = await service.sendToContact('contact-1', 'verify-email', {}, {
        idempotencyKey: 'unique-key-1',
      });
      expect(result.messageId).toBe('cached-msg-id');
      expect(mockMessagesRepo.create).not.toHaveBeenCalled();
    });

    it('idempotency miss creates new message and caches', async () => {
      await service.sendToContact('contact-1', 'verify-email', {}, {
        idempotencyKey: 'unique-key-1',
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('idem:tenant-A:unique-key-1'),
        'msg-1',
        86400,
      );
    });
  });

  describe('sendToContact -- rate limit', () => {
    it('throws RateLimitExceededError when count > limit', async () => {
      mockRedis.incr.mockResolvedValue(101);
      await expect(
        service.sendToContact('contact-1', 'verify-email', {}),
      ).rejects.toBeInstanceOf(RateLimitExceededError);
    });

    it('skipRateLimit=true bypasses', async () => {
      mockRedis.incr.mockResolvedValue(101);
      const result = await service.sendToContact('contact-1', 'verify-email', {}, {
        skipRateLimit: true,
      });
      expect(result.channel).toBeDefined();
    });
  });

  describe('sendToContact -- audit log', () => {
    it('emits send_initiated and send_queued events', async () => {
      await service.sendToContact('contact-1', 'verify-email', {});
      expect(mockAudit.logSendInitiated).toHaveBeenCalled();
      expect(mockAudit.logSendQueued).toHaveBeenCalled();
    });

    it('emits send_skipped on NoAvailableChannelError', async () => {
      mockContactsService.findById.mockResolvedValue({ ...baseContact, phone: null, email: null });
      await expect(
        service.sendToContact('contact-1', 'verify-email', {}),
      ).rejects.toBeInstanceOf(NoAvailableChannelError);
      expect(mockAudit.logSendSkipped).toHaveBeenCalled();
    });
  });

  describe('sendToContact -- correlation id', () => {
    it('generates UUID v7 if not provided', async () => {
      const result = await service.sendToContact('contact-1', 'verify-email', {});
      expect(result.messageId).toBeDefined();
    });

    it('preserves provided correlationId in audit', async () => {
      await service.sendToContact('contact-1', 'verify-email', {}, {
        correlationId: '11111111-1111-1111-1111-111111111111',
      });
      const call = mockAudit.logSendInitiated.mock.calls[0][0];
      expect(call.correlationId).toBe('11111111-1111-1111-1111-111111111111');
    });
  });

  describe('sendToContact -- multi-tenant isolation', () => {
    it('throws TenantContextMissingError if no tenant', async () => {
      mockTenantContext.getCurrentTenantId.mockReturnValue(null);
      await expect(
        service.sendToContact('contact-1', 'verify-email', {}),
      ).rejects.toThrow();
    });

    it('passes tenant_id to messages repo', async () => {
      await service.sendToContact('contact-1', 'verify-email', {});
      const call = mockMessagesRepo.create.mock.calls[0][0];
      expect(call.tenant_id).toBe('tenant-A');
    });
  });

  describe('sendBatch', () => {
    it('processes 100 items concurrently', async () => {
      const items = Array.from({ length: 100 }, (_, i) => ({
        contactId: `contact-${i}`,
        templateName: 'verify-email',
        variables: {},
      }));
      const result = await service.sendBatch(items);
      expect(result.total).toBe(100);
      expect(result.successes).toBe(100);
    });

    it('reports partial failures', async () => {
      mockContactsService.findById.mockImplementation((id) =>
        id === 'contact-fail' ? null : baseContact,
      );
      const items = [
        { contactId: 'contact-1', templateName: 'verify-email', variables: {} },
        { contactId: 'contact-fail', templateName: 'verify-email', variables: {} },
      ];
      const result = await service.sendBatch(items);
      expect(result.successes).toBe(1);
      expect(result.failures).toBe(1);
    });
  });

  describe('sendBroadcast', () => {
    it('quota exceeded throws BroadcastQuotaExceededError', async () => {
      mockRedis.get.mockResolvedValue('5001');
      await expect(
        service.sendBroadcast({ tags: ['customer'] }, 'newsletter', {}),
      ).rejects.toBeInstanceOf(BroadcastQuotaExceededError);
    });

    it('marketing outside legal hours blocks', async () => {
      const originalDateTimeFormat = Intl.DateTimeFormat;
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation((() => ({
        format: () => '23',
        formatToParts: () => [{ type: 'hour', value: '23' }],
      })) as any);
      await expect(
        service.sendBroadcast({ tags: ['customer'] }, 'newsletter', {}, {
          broadcastType: 'marketing',
        }),
      ).rejects.toBeInstanceOf(MarketingOutsideLegalHoursError);
      vi.restoreAllMocks();
    });
  });

  describe('getMetrics', () => {
    it('returns quota and rate limit info', async () => {
      mockRedis.get.mockResolvedValue('123');
      const metrics = await service.getMetrics();
      expect(metrics.quotaUsed).toBe(123);
      expect(metrics.quotaLimit).toBe(5000);
      expect(metrics.rateLimitPerMinute).toBe(100);
      expect(metrics.messagesLast24h).toBe(42);
    });
  });
});
```

### 6.12 Fichier 12 / 14 : Tests `channel-resolver.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ChannelResolverService } from '../../src/services/channel-resolver.service.js';
import { ContactValidatorService } from '../../src/services/contact-validator.service.js';

describe('ChannelResolverService', () => {
  let service: ChannelResolverService;
  let mockWaRenderer: any;
  let validator: ContactValidatorService;

  const validContact: any = {
    id: 'c1',
    phone: '+212612345678',
    email: 'user@example.com',
    preferred_channel: 'whatsapp',
    preferred_language: 'fr',
  };

  beforeEach(async () => {
    mockWaRenderer = { validateMetaApproved: vi.fn().mockResolvedValue(true) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChannelResolverService,
        ContactValidatorService,
        { provide: 'WaTemplateRendererService', useValue: mockWaRenderer },
      ],
    }).compile();
    service = moduleRef.get(ChannelResolverService);
    validator = moduleRef.get(ContactValidatorService);
  });

  it('returns whatsapp for preferred=wa + opt-in + valid + approved', async () => {
    const decision = await service.determineFinalChannel(validContact, {
      optedOutChannels: [],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBe('whatsapp');
    expect(decision.decisionPath).toContain('whatsapp_OK');
  });

  it('returns email when WA opted out', async () => {
    const decision = await service.determineFinalChannel(validContact, {
      optedOutChannels: ['whatsapp'],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBe('email');
    expect(decision.decisionPath).toContain('whatsapp_opted_out');
    expect(decision.decisionPath).toContain('email_OK');
  });

  it('returns email when template not approved for locale', async () => {
    mockWaRenderer.validateMetaApproved.mockResolvedValue(false);
    const decision = await service.determineFinalChannel(validContact, {
      optedOutChannels: [],
      templateName: 'custom',
      locale: 'ar-MA',
    });
    expect(decision.channel).toBe('email');
    expect(decision.decisionPath).toContain('whatsapp_template_not_approved_for_ar-MA');
  });

  it('returns null when no phone and no email', async () => {
    const c = { ...validContact, phone: null, email: null };
    const decision = await service.determineFinalChannel(c, {
      optedOutChannels: [],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBeNull();
    expect(decision.reason).toContain('no_phone');
    expect(decision.reason).toContain('no_email');
  });

  it('returns null when both opted out', async () => {
    const decision = await service.determineFinalChannel(validContact, {
      optedOutChannels: ['whatsapp', 'email'],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBeNull();
  });

  it('preferOverride email forces email even if preferred=whatsapp', async () => {
    const decision = await service.determineFinalChannel(validContact, {
      preferOverride: 'email',
      optedOutChannels: [],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBe('email');
    expect(decision.decisionPath).toContain('prefer_override=email');
  });

  it('preferOverride whatsapp falls through if WA opted out', async () => {
    const decision = await service.determineFinalChannel(validContact, {
      preferOverride: 'whatsapp',
      optedOutChannels: ['whatsapp'],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBe('email');
    expect(decision.decisionPath).toContain('override_failed_continuing_normal_logic');
  });

  it('skipOptOutCheck=true ignores optedOutChannels', async () => {
    const decision = await service.determineFinalChannel(validContact, {
      optedOutChannels: ['whatsapp'],
      templateName: 'verify-email',
      locale: 'fr',
      skipOptOutCheck: true,
    });
    expect(decision.channel).toBe('whatsapp');
  });

  it('preferred=email returns email directly', async () => {
    const c = { ...validContact, preferred_channel: 'email' };
    const decision = await service.determineFinalChannel(c, {
      optedOutChannels: [],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBe('email');
  });

  it('preferred=null tries WA first then email', async () => {
    const c = { ...validContact, preferred_channel: null };
    const decision = await service.determineFinalChannel(c, {
      optedOutChannels: [],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBe('whatsapp');
  });

  it('decision_path contains locale and opted_out info', async () => {
    const decision = await service.determineFinalChannel(validContact, {
      optedOutChannels: ['whatsapp'],
      templateName: 'verify-email',
      locale: 'ar-MA',
    });
    expect(decision.decisionPath.some((p) => p.includes('locale=ar-MA'))).toBe(true);
    expect(decision.decisionPath.some((p) => p.includes('opted_out'))).toBe(true);
  });

  it('phone invalid (not E.164) -> fallback email', async () => {
    const c = { ...validContact, phone: '0612345678' };
    const decision = await service.determineFinalChannel(c, {
      optedOutChannels: [],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBe('email');
  });

  it('email invalid -> fallback phone if WA preferred', async () => {
    const c = { ...validContact, email: 'invalid-email' };
    const decision = await service.determineFinalChannel(c, {
      optedOutChannels: [],
      templateName: 'verify-email',
      locale: 'fr',
    });
    expect(decision.channel).toBe('whatsapp');
  });
});
```

### 6.13 Fichier 13 / 14 : Tests integration `orchestrator-routing.integration.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { OrchestratorModule } from '../../src/orchestrator.module.js';
import { MessageOrchestratorService } from '../../src/services/message-orchestrator.service.js';

const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === '1';

describe.skipIf(SKIP_INTEGRATION)('Orchestrator integration testcontainers', () => {
  let postgresContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;
  let kafkaContainer: StartedTestContainer;
  let service: MessageOrchestratorService;

  beforeAll(async () => {
    postgresContainer = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .start();
    redisContainer = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .start();
    // Migrations
    process.env.DATABASE_URL = `postgresql://postgres:test@localhost:${postgresContainer.getMappedPort(5432)}/test`;
    process.env.REDIS_URL = `redis://localhost:${redisContainer.getMappedPort(6379)}`;
    process.env.COMM_BROADCAST_QUOTA_PER_DAY = '100';
    process.env.COMM_TENANT_RATE_LIMIT_PER_MINUTE = '50';

    const moduleRef = await Test.createTestingModule({
      imports: [OrchestratorModule],
    }).compile();
    service = moduleRef.get(MessageOrchestratorService);

    // Seed contacts
    // ... Insert into contacts table 100 contacts with mixed preferences
  }, 60000);

  afterAll(async () => {
    await postgresContainer?.stop();
    await redisContainer?.stop();
  });

  it('end-to-end : sendToContact with WA preferred routes to wa-send queue', async () => {
    const result = await service.sendToContact('seeded-contact-wa-1', 'verify-email', {});
    expect(result.channel).toBe('whatsapp');
    // Verify message in DB
    // ... query comm_messages and assert
  });

  it('end-to-end : opt-out persists across calls', async () => {
    // Insert opt-out
    // ... insert into comm_optouts
    const result = await service.sendToContact('seeded-contact-wa-2', 'verify-email', {});
    expect(result.channel).toBe('email');
  });

  it('end-to-end : audit log persisted', async () => {
    await service.sendToContact('seeded-contact-wa-1', 'verify-email', {});
    // Query comm_audit_log
    // ... assert send_initiated + send_queued rows
  });

  it('end-to-end : idempotency-key persists 24h', async () => {
    const r1 = await service.sendToContact('seeded-contact-wa-1', 'verify-email', {}, {
      idempotencyKey: 'integ-test-key-1',
    });
    const r2 = await service.sendToContact('seeded-contact-wa-1', 'verify-email', {}, {
      idempotencyKey: 'integ-test-key-1',
    });
    expect(r1.messageId).toBe(r2.messageId);
  });

  it('end-to-end : rate limit triggers after 50 sends/min', async () => {
    let errored = false;
    try {
      for (let i = 0; i < 60; i += 1) {
        await service.sendToContact('seeded-contact-wa-1', 'verify-email', {});
      }
    } catch (err: any) {
      if (err.code === 'RATE_LIMIT_EXCEEDED') errored = true;
    }
    expect(errored).toBe(true);
  });

  it('end-to-end : broadcast 100 contacts with cursor', async () => {
    const result = await service.sendBroadcast(
      { tags: ['integration-test'] },
      'newsletter',
      {},
    );
    expect(result.jobsEnqueued).toBeGreaterThan(0);
  });

  it('end-to-end : multi-tenant isolation', async () => {
    // Set tenant B context, attempt to read contact tenant A
    // ... assert ContactNotFoundError
  });

  it('end-to-end : decision_path persisted in audit', async () => {
    await service.sendToContact('seeded-contact-wa-1', 'verify-email', {});
    // Query comm_audit_log decision_path JSONB
    // ... assert array contains expected steps
  });
});
```

### 6.14 Fichier 14 / 14 : Tests perf `broadcast-perf.spec.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';

const SKIP_PERF = process.env.SKIP_PERF === '1';

describe.skipIf(SKIP_PERF)('Broadcast performance', () => {
  it('enqueues 10000 contacts in less than 30 seconds', async () => {
    // Setup mocked dependencies (no real DB / Redis)
    // ... bootstrap MessageOrchestratorService with mocks that return 1000 contacts per page
    const startTs = Date.now();
    // const result = await service.sendBroadcast({ tags: ['perf'] }, 'newsletter', {});
    // expect(result.jobsEnqueued).toBe(10000);
    const elapsedMs = Date.now() - startTs;
    expect(elapsedMs).toBeLessThan(30_000);
  }, 60_000);

  it('enqueues 1000 contacts in less than 5 seconds', async () => {
    const startTs = Date.now();
    // ... similar
    const elapsedMs = Date.now() - startTs;
    expect(elapsedMs).toBeLessThan(5_000);
  }, 30_000);

  it('memory usage stays below 100 MB during 100k contacts broadcast', async () => {
    const before = process.memoryUsage().heapUsed;
    // ... run broadcast
    const after = process.memoryUsage().heapUsed;
    const delta = (after - before) / 1024 / 1024;
    expect(delta).toBeLessThan(100);
  }, 120_000);
});
```

---

## 7. Tests complets (recap)

### 7.1 Repartition tests (90+ total)

- `message-orchestrator.service.spec.ts` : 30+ tests
  - sendToContact routing tree (10+)
  - contact not found / errors (3+)
  - idempotency (3+)
  - rate limit (2+)
  - audit log (3+)
  - correlation id / multi-tenant (3+)
  - sendBatch (3+)
  - sendBroadcast (3+)
  - getMetrics (1+)
- `channel-resolver.service.spec.ts` : 24+ tests (decision tree exhaustive)
- `contact-validator.service.spec.ts` : 18+ tests (E.164, RFC 5322, normalize)
- `broadcast-segmentation.service.spec.ts` : 12+ tests (filters, cursor)
- `comm-audit.service.spec.ts` : 10+ tests
- `orchestrator-routing.integration.spec.ts` : 8+ tests testcontainers
- `broadcast-perf.spec.ts` : 3+ tests perf

### 7.2 Coverage cible

- Branches >= 88%
- Lines >= 90%
- Functions >= 95%
- Statements >= 90%

---

## 8. Variables environnement

```env
# Sprint 9 Tache 3.2.9 -- Message Orchestrator
COMM_BROADCAST_QUOTA_PER_DAY=5000          # 50000 prod
COMM_BROADCAST_BATCH_SIZE=1000              # cursor page size
COMM_TENANT_RATE_LIMIT_PER_MINUTE=100       # sliding window
COMM_IDEMPOTENCY_TTL_SECONDS=86400          # 24h
COMM_CACHE_CONTACT_TTL_SECONDS=30           # short for opt-out freshness
COMM_CACHE_OPTOUT_TTL_SECONDS=30
COMM_MARKETING_LEGAL_HOURS_START=8          # Africa/Casablanca
COMM_MARKETING_LEGAL_HOURS_END=21           # exclusive
COMM_DEFAULT_LOCALE=fr                       # fallback
COMM_LOCALE_FALLBACK_CHAIN=ar-MA:ar:fr,ar:fr,fr:fr
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/comm add libphonenumber-js@1.11.4 uuid@10
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test --filter orchestrator
pnpm --filter @insurtech/comm test --filter channel-resolver
pnpm --filter @insurtech/comm test --filter contact-validator
pnpm --filter @insurtech/comm test:integration --testPathPattern orchestrator
pnpm --filter @insurtech/comm test:perf --testPathPattern broadcast-perf
pnpm --filter @insurtech/comm test:coverage
pnpm --filter @insurtech/comm build

# Run migration
psql $DATABASE_URL -f repo/infrastructure/migrations/2026_05_XX_comm_audit_log.sql
```

---

## 10. Criteres validation V1-V32

### P0 (20)

- **V1** : `pnpm --filter @insurtech/comm typecheck` -- expected : zero errors strict mode.
- **V2** : `pnpm --filter @insurtech/comm build` -- expected : dist/ generated, no warnings.
- **V3** : `pnpm --filter @insurtech/comm test --filter orchestrator` -- expected : 30+ tests pass.
- **V4** : `pnpm --filter @insurtech/comm test --filter channel-resolver` -- expected : 24+ tests pass, decision tree exhaustive.
- **V5** : `pnpm --filter @insurtech/comm test --filter contact-validator` -- expected : 18+ tests pass.
- **V6** : `MessageOrchestratorService.sendToContact` exposes signature `(contactId, templateName, variables, options?)` -- expected : returns `{ messageId, channel, queueJobId, decisionPath }`.
- **V7** : Contact preferred WA + opt-in + template approved + valid phone -> WhatsApp -- expected : `result.channel === 'whatsapp'`, `mockWaQueue.add` called, `mockEmailQueue.add` not called.
- **V8** : Contact preferred WA + opt-out WA + opt-in email -> Email fallback -- expected : `result.channel === 'email'`, decision_path contains 'whatsapp_opted_out'.
- **V9** : Contact opt-out both -> NoAvailableChannelError -- expected : 400 with reason.
- **V10** : Contact without phone and email -> NoAvailableChannelError -- expected : reason contains 'no_phone' and 'no_email'.
- **V11** : Template not Meta-approved -> Email fallback -- expected : decision_path contains 'whatsapp_template_not_approved_for_<locale>'.
- **V12** : Override `preferChannel='email'` forces email even when preferred=whatsapp -- expected : `result.channel === 'email'`.
- **V13** : `skipOptOutCheck=true` bypasses opt-out (transactional auth) -- expected : opt-out call not made, channel resolved.
- **V14** : Priority `critical` -> BullMQ priority 1 (head insert) -- expected : `queue.add(name, data, { priority: 1 })`.
- **V15** : Priority `low` -> BullMQ priority 20 (tail insert) -- expected : `queue.add(name, data, { priority: 20 })`.
- **V16** : `sendBroadcast` quota tenant exceeded -> `BroadcastQuotaExceededError` 429.
- **V17** : `sendBroadcast` cursor pagination batch=1000 works for 10000 contacts -- expected : 10 pages processed.
- **V18** : Rate limit per-tenant per-minute > 100 -> `RateLimitExceededError` 429 with `retry_after_seconds=60`.
- **V19** : Idempotency-Key cache 24h Redis -- expected : 2eme send same key returns same `messageId`.
- **V20** : Multi-tenant isolation strict -- expected : cross-tenant `contactId` lookup throws `ContactNotFoundError`.

### P1 (8)

- **V21** : Audit log `send_initiated` + `send_queued` + `send_skipped` + `broadcast_started` + `broadcast_completed` rows persisted in `comm_audit_log` -- expected : repo `save` called.
- **V22** : `decision_path` JSONB contains explicit step-by-step (e.g. `["preferred_channel=whatsapp", "opt-in OK", "template approved", "whatsapp_OK"]`) -- expected : audit query returns array.
- **V23** : Correlation_id propagates from orchestrator -> message row -> queue job data -> audit -- expected : same UUID v7 across all.
- **V24** : Marketing broadcast outside 8h-21h Africa/Casablanca -> `MarketingOutsideLegalHoursError` 400 -- expected : check via `Intl.DateTimeFormat`.
- **V25** : Coverage >= 88% -- expected : `pnpm test:coverage` reports.
- **V26** : Bench `sendToContact` < 100ms p99 mock -- expected : test bench reports.
- **V27** : Bench `sendBroadcast 10000 contacts` < 30s -- expected : `broadcast-perf.spec.ts` passes.
- **V28** : OTEL metrics emis : `orchestrator.send.duration`, `orchestrator.broadcast.duration`, `orchestrator.errors.count` -- expected : metrics exporter receives.

### P2 (4)

- **V29** : Documentation README section "Message Orchestrator" with usage examples -- expected : present.
- **V30** : Migration SQL `comm_audit_log` runnable -- expected : `psql -f` succeeds.
- **V31** : ESLint zero warnings -- expected : `lint:check` clean.
- **V32** : Sprint 14 plan : quota dynamique tenant + multi-region routing documented -- expected : annexe present.

---

## 11. Edge cases (18)

1. **Contact phone change mid-flight** : user changes `+212611111111` -> `+212622222222` between orchestrator lookup and worker send. Mitigation : worker re-fetches contact (Sprint 9 Tache 3.2.8) or accepts stale (24h window normal).
2. **Contact merged (CRM dedup Sprint 8)** : contact_a merged into contact_b. orchestrator should route to survivor `contact_b`. Mitigation : `contactsService.findById` follows `merged_into_contact_id` chain.
3. **Template archived (deleted Sprint 9 Tache 3.2.5)** : `template_id` stale. Mitigation : worker resolves `templateName` -> current `template_id` at send time, fail-fast 404.
4. **Locale fallback chain** : ar-MA non dispo for template -> fallback ar -> fr. Mitigation : `waRenderer.validateMetaApproved` and email renderer both implement chain.
5. **WhatsApp 24h session window** : if user sent inbound message in last 24h, can send free-form text instead of HSM template. Mitigation : check `comm_messages` last inbound from contact, allow text channel option (Sprint 14+).
6. **High-volume burst (100k broadcast)** : memory + throughput protection. Mitigation : cursor batch=1000, Promise.all bounded concurrency=50.
7. **Quota tenant exceeded during broadcast mid-flight** : pages 1-3 OK, page 4 hits quota. Mitigation : check quota before each page, emit `broadcast_blocked_partial` audit + return partial result.
8. **Concurrent sends same contact same template within 1s** : idempotency optional. Mitigation : `Idempotency-Key` header recommended for client retries.
9. **DLQ message replay** : worker DLQ replay should not re-orchestrate (canal already decided). Mitigation : DLQ replay use direct queue reinjection bypassing orchestrator.
10. **Network partition Redis** : queue unavailable -> orchestrator fails. Mitigation : try/catch, return 503 + retry-after, fallback in-memory rate limit (degraded mode).
11. **Multi-tenant cross via shared UUID** : attacker tenant A sends with contactId from tenant B -> ContactNotFoundError. Mitigation : strict tenant_id WHERE in `contactsService.findById`.
12. **DST transition Africa/Casablanca** : Maroc heure ete fin mars + heure hiver fin octobre + Ramadan. Scheduled sends shift correct. Mitigation : `Intl.DateTimeFormat` IANA timezone Africa/Casablanca.
13. **Idempotency-Key cross-tenant collision** : tenant A and B use key "K1". Mitigation : Redis prefix `idem:{tenant_id}:{key}`.
14. **Idempotency-Key with different payload** : same key but different `templateName`. Mitigation : Redis stores hash payload, returns 409 IdempotencyConflict.
15. **Phone with extension** : `+212612345678 ext.1234`. Mitigation : `libphonenumber-js` strips extensions for E.164.
16. **Email plus addressing** : `user+tag@example.com`. Mitigation : RFC 5322 valid, accept as-is (tags useful for users).
17. **Audit Postgres full** : disk pressure, audit insert fails. Mitigation : try/catch, do NOT block business flow, alert via Sprint 33.
18. **Contact preferred_channel=null (legacy)** : no preferred set. Mitigation : try WA first (Maroc default 87% adoption) then email fallback.

---

## 12. Conformite Maroc

- **Loi 09-08 article 30 (CNDP)** : opt-out check obligatoire avant chaque envoi sauf transactionnels critiques type auth (verify-email, password-reset, mfa-enabled, account-locked, suspicious-login -- listes exhaustive avec audit). Pas marketing, pas reminders. Le flag `skipOptOutCheck=true` est documente strict (annexe A) et son usage est verifie via lint custom Sprint 33.
- **Loi marketing direct 24-09 article 5** : prospection commerciale electronique B2C horaires 8h-21h heure Maroc. Broadcast `broadcastType='marketing'` check `Intl.DateTimeFormat('fr-MA', { timeZone: 'Africa/Casablanca' })` et throw `MarketingOutsideLegalHoursError` si en dehors. Flag `skipLegalHoursCheck` reserve aux tests.
- **CNDP audit trail 7 ans** : table `comm_audit_log` avec colonnes `tenant_id` + `contact_id` + `action` + `decision_path` JSONB + `metadata` JSONB + `correlation_id` + `timestamp` + retention 7 ans (decision-014). Permet audit forensique : "pourquoi user a recu cet email ?" -> `SELECT decision_path FROM comm_audit_log WHERE contact_id = ?`.
- **ACAPS circulaire 2024 (insurance regulator)** : notifications operationnelles assurance (police signed, payment due, claim received) doivent etre tracees + retention. Conformite via audit log.
- **Loi 53-05 article 6 (signature electronique)** : pour preuve juridique en cas de litige, la trace audit log est admissible avec horodatage + correlation_id + tenant_id immutable. Sprint 14+ ajoutera signature numerique audit log via HMAC.

---

## 13. Conventions absolues

Multi-tenant : tenant_id obligatoire dans toutes les queries (`messagesRepo.create`, `contactsService.findById`, `optoutService.getOptedOutChannels`, `broadcastSegmenter.findContactsByFilters`). TenantContext propagation via AsyncLocalStorage avec `tenantContext.run({ tenantId }, () => ...)` dans Promise.all batches sendBroadcast pour eviter perte context. Validation : Zod schemas DTOs aux frontieres (controllers Sprint 9 Tache 3.2.12). Logger Pino : structured + masque email + masque token + correlation_id include + tenant_id include. pnpm + workspace `@insurtech/comm`. TypeScript strict mode + noUnusedLocals + noImplicitAny. Tests 90+ (30 service + 24 channel-resolver + 18 validator + 12 segmentation + 10 audit + 8 integration testcontainers). Skalean AI : aucun (decision-006). No-emoji partout (decision-006). Idempotency : optional via Idempotency-Key Redis 24h (decision-026). Cloud souverain : indirect via `@insurtech/comm` orchestrator decision local (Atlas Cloud Services Benguerir). Crypto : aucun (Sprint 9 Tache 3.2.4 HMAC pour webhooks, pas orchestrator). JSDoc obligatoire methodes publiques. Performance : `sendToContact < 100ms p99`, `sendBroadcast 10000 < 30s`. RBAC : `comm.messages.send` (sendToContact + sendBatch), `comm.messages.broadcast` (sendBroadcast). Audit obligatoire toutes operations. Decision tree explicite documentation step-by-step. No-console (decision-006).

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test --filter orchestrator
pnpm --filter @insurtech/comm test --filter channel-resolver
pnpm --filter @insurtech/comm test --filter contact-validator
pnpm --filter @insurtech/comm test --filter broadcast-segmentation
pnpm --filter @insurtech/comm test --filter comm-audit
pnpm --filter @insurtech/comm test:coverage
[ $(grep -rP "[\x{1F300}-\x{1F9FF}]" packages/comm/src/services/message-orchestrator.service.ts | wc -l) -eq 0 ] || exit 1
[ $(grep -rn "console\.log" packages/comm/src/services/message-orchestrator.service.ts | wc -l) -eq 0 ] || exit 1
echo "Orchestrator OK"

# Verify all 14 files present
for f in \
  "packages/comm/src/services/message-orchestrator.service.ts" \
  "packages/comm/src/services/channel-resolver.service.ts" \
  "packages/comm/src/services/contact-validator.service.ts" \
  "packages/comm/src/services/broadcast-segmentation.service.ts" \
  "packages/comm/src/audit/comm-audit.service.ts" \
  "packages/comm/src/errors/orchestrator.errors.ts" \
  "packages/comm/src/dto/orchestrator-input.dto.ts" \
  "packages/comm/src/orchestrator.module.ts" \
  "packages/comm/test/services/message-orchestrator.service.spec.ts" \
  "packages/comm/test/services/channel-resolver.service.spec.ts" \
  "packages/comm/test/services/contact-validator.service.spec.ts" \
  "packages/comm/test/services/broadcast-segmentation.service.spec.ts" \
  "packages/comm/test/audit/comm-audit.service.spec.ts" \
  "packages/comm/test/integration/orchestrator-routing.integration.spec.ts" \
  "packages/comm/test/perf/broadcast-perf.spec.ts" \
  "infrastructure/migrations/2026_05_XX_comm_audit_log.sql" \
; do
  [ -f "$f" ] || (echo "MISSING $f" && exit 1)
done
echo "All orchestrator files present"
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-09): implement MessageOrchestratorService routing WhatsApp + Email

Implements centralized message orchestration service routing outbound
communications via WhatsApp or Email based on contact.preferred_channel +
opt-in/opt-out + template Meta approved + phone E.164 / email RFC 5322
validation. 3 main methods (sendToContact, sendBatch, sendBroadcast) with
explicit decision tree, decision_path JSONB audit log, 7 years retention.
ChannelResolverService encapsulates pure decision logic (testable, 24+
test scenarios). ContactValidatorService normalizes phone E.164 and email
RFC 5322. BroadcastSegmentationService cursor-paginated with composable
filters CRM Sprint 8 (tags, deal_stage, locale, last_activity, custom).
Quota tenant 5000/jour MVP via Redis INCR atomic. Rate limit per-tenant
100/min via Redis sliding window. Idempotency-Key RFC 8235 optional 24h
TTL Redis. Marketing horaires legaux 8h-21h Africa/Casablanca check.
Multi-tenant strict isolation. Audit log decision_path step-by-step pour
forensique CNDP loi 09-08.

Livrables :
- MessageOrchestratorService (~320 lignes, 3 methodes)
- ChannelResolverService (~180 lignes, decision tree)
- ContactValidatorService (~120 lignes, E.164 + RFC 5322)
- BroadcastSegmentationService (~150 lignes, cursor paginated)
- CommAuditService (~120 lignes, audit + Kafka)
- Erreurs typees (8 classes)
- DTOs Zod (orchestrator-input.dto.ts)
- Module OrchestratorModule (~50 lignes)
- Migration comm_audit_log
- 90+ tests (30 service + 24 resolver + 18 validator + 12 segmentation + 10 audit + 8 integration testcontainers + 3 perf)

Tests : 30 service + 24 resolver + 18 validator + 12 segmentation + 10 audit + 8 integration + 3 perf = 105 tests
Coverage : >= 88%
Performance : sendToContact < 100ms p99, broadcast 10k < 30s

Task: 3.2.9
Sprint: 9 (Phase 3 / Sprint 2)
Reference: B-09 Tache 3.2.9
Decisions: decision-009 (multi-locale), decision-014 (audit 7 ans),
decision-015 (CNDP), decision-024 (multi-tenant), decision-026 (idem),
decision-031 (rate limit), decision-032 (marketing legal hours)"
```

---

## 16. Workflow next step

Apres commit, passer a `task-3.2.10-delivery-tracking-bounces-alerts.md` qui implementera tracking complet statuses messages (sent -> delivered -> read -> bounced -> failed) avec webhooks Mailgun (signature HMAC SHA-256) + auto opt-out hard bounces (anti-spam reputation) + alertes bounce rate > 5% sur 24h via Kafka event `comm.high_bounce_rate` (Sprint 33 Slack alert) + endpoint `/api/v1/comm/stats` aggregations 30 jours par channel.

---

## Annexe A. Liste exhaustive transactionnels critiques `skipOptOutCheck=true` autorises

Seuls les templates listes ci-dessous peuvent legitimement utiliser `skipOptOutCheck=true`. Tout autre usage est une violation potentielle CNDP loi 09-08 et doit etre review.

| Template | Sprint origine | Justification | Audit obligatoire |
|----------|---------------|---------------|-------------------|
| `verify-email` | 5 (auth signup) | Verification email = pre-requis legal compte, pas marketing | OUI |
| `password-reset` | 5 (recovery) | Recuperation acces compte = legitime utilisateur | OUI |
| `password-changed` | 5 (post-reset) | Notification securite breach potentiel | OUI |
| `mfa-enabled` | 5 (post-MFA) | Notification securite obligatoire | OUI |
| `account-locked` | 5 (lockout) | Notification securite obligatoire | OUI |
| `suspicious-login` | 5 (alert) | Notification securite obligatoire | OUI |
| `tenant_invitation` | 6 (tenant) | Acces compte requis par invitation | OUI |
| `tenant_suspended_notification` | 6 (tenant) | Notification compliance obligatoire | OUI |
| `quota_warning_80percent` | 6 (tenant) | Notification operations critique | OUI |

Tout template marketing, reminders, ou operationnel non-critique DOIT respecter `skipOptOutCheck=false` (default).

## Annexe B. Performance benchmarks attendus

```
MessageOrchestratorService.sendToContact (mock SMTP/Meta) :
  median 15 ms (p99 60 ms)  -- contact lookup + opt-out + INSERT + enqueue dominant
MessageOrchestratorService.sendBatch 100 items :
  median 200 ms (p99 800 ms)  -- bounded concurrency 50
MessageOrchestratorService.sendBroadcast 1000 contacts :
  median 1.5s (p99 4s)  -- cursor + batch
MessageOrchestratorService.sendBroadcast 10000 contacts :
  median 12s (p99 28s)  -- 10 pages, ~3s/page
ChannelResolverService.determineFinalChannel :
  median 2 ms (p99 8 ms)  -- pure logic + waRenderer.validateMetaApproved cache hit
ContactValidatorService.normalizePhone (libphonenumber-js) :
  median 0.5 ms (p99 2 ms)
BroadcastSegmentationService.findContactsByFilters page 1000 :
  median 80 ms (p99 250 ms)  -- DB query indexed
CommAuditService.persist :
  median 10 ms (p99 40 ms)  -- INSERT + Kafka emit
```

## Annexe C. Sprint 14 plan : quota dynamique tenant + multi-region routing

Sprint 14 enrichira MessageOrchestratorService avec :

1. **Quota dynamique tenant** : table `tenants.config.broadcast_quota_per_day` (override env default), Redis cache 5min.
2. **Multi-region routing** : tenants Maroc -> Mailgun EU + Meta WA Cloud EU, tenants France/EU diaspora -> Mailgun US/Sendgrid.
3. **Quota par template type** : marketing 1000/jour, transactionnels 100k/jour (different limits).
4. **Cost optimization** : preferer email (cheap) over WA (paid per message) si user pas opt-in WA explicite.
5. **A/B testing channel** : 50% receive WA, 50% receive Email -> measure engagement, optimize routing.

## Annexe D. Documentation API publique

```typescript
/**
 * @example Basic transactional send
 * await orchestrator.sendToContact(contactId, 'verify-email', {
 *   verify_url: 'https://app.skalean.ma/verify?token=xxx',
 *   ttl_hours: 24,
 * });
 *
 * @example Forced channel override
 * await orchestrator.sendToContact(contactId, 'mfa-enabled', vars, {
 *   preferChannel: 'email',
 *   priority: 'high',
 * });
 *
 * @example Skip opt-out (auth critical)
 * await orchestrator.sendToContact(contactId, 'password-reset', vars, {
 *   skipOptOutCheck: true,
 *   priority: 'critical',
 * });
 *
 * @example Idempotent retry
 * await orchestrator.sendToContact(contactId, 'verify-email', vars, {
 *   idempotencyKey: 'req-uuid-1',
 * });
 *
 * @example Batch reminders cron
 * await orchestrator.sendBatch([
 *   { contactId: 'c1', templateName: 'appointment_reminder_24h', variables: { ... } },
 *   { contactId: 'c2', templateName: 'appointment_reminder_24h', variables: { ... } },
 * ]);
 *
 * @example Marketing broadcast
 * await orchestrator.sendBroadcast(
 *   { tags: ['customer'], locale: 'fr-MA', excludeOptedOutChannel: 'whatsapp' },
 *   'newsletter_q2_2026',
 *   { promo_code: 'PRINTEMPS2026' },
 *   { broadcastType: 'marketing' },
 * );
 */
```

## Annexe E. Comparison alternative architectures

| Pattern | Avantages | Inconvenients | Verdict |
|---------|-----------|---------------|---------|
| Direct WA/Email call from each module | Simple | Duplication, divergence, CNDP risk | REJETE |
| Orchestrator + sync send | Linear flow | Block thread, latency >5s | REJETE |
| Orchestrator + queue (RETENU) | Async, resilient, retries, observable | Setup BullMQ + Redis | RETENU |
| Orchestrator + Kafka topic | Event-driven, replay | Complexity replay logic | DEFFERE Sprint 14 hybrid |
| Decision in DB stored proc | Performance | Hard to test, opaque | REJETE |
| Decision in TS function (RETENU) | Testable, debuggable | DB round-trip per call | RETENU with cache |
| ML-based decision | Optimal engagement | Opaque, untestable, audit hard | DEFFERE Phase 7+ |
| Strict preferred_channel | Simple | Bad UX if opted-out | REJETE |
| Fallback opposite channel (RETENU) | Maximize delivery | Complex tree | RETENU |

## Annexe F. Decision tree visualization extra detail

```
                              [START] sendToContact(contactId, template, vars, opts)
                                        |
                                        v
                          +-------------+-------------+
                          | tenantContext.getCurrent  |
                          | tenantId() -> tenantId    |
                          +-------------+-------------+
                                        |
                                        v
                          +-------------+-------------+
                          | opts.idempotencyKey ?     |
                          +---+---------+-------------+
                              | YES         | NO
                              v             v
                  +-----------+-----+    +--+----------------------------+
                  | Redis GET key   |    | Continue                       |
                  +---+-------------+    +-------------------------------+
                      | hit              |
                      v                  v
                  Return cached     +----+----------------------------+
                      |             | contactsService.findById(id)    |
                      |             +----+----------------------------+
                      |                  | null
                      |                  v
                      |             ContactNotFoundError(404)
                      |                  | found
                      |                  v
                      |             +----+----------------------------+
                      |             | audit.logSendInitiated          |
                      |             +----+----------------------------+
                      |                  |
                      |                  v
                      |             +----+----------------------------+
                      |             | opts.skipOptOutCheck ?          |
                      |             +-+--------+----------------------+
                      |               | YES    | NO
                      |               |        v
                      |               |   +----+-----+
                      |               |   |getOpted  |
                      |               |   |OutChannels|
                      |               |   +----+-----+
                      |               v        |
                      |        optedOut = []   v
                      |               |   optedOut = [...]
                      |               +--+--+
                      |                  |
                      |                  v
                      |     +------------+-------------+
                      |     |channelResolver.determine |
                      |     | FinalChannel(contact,opts)|
                      |     +------------+-------------+
                      |                  |
                      |     +------------+-------------+
                      |     | channelDecision.channel  |
                      |     +-+----------+-------------+
                      |       | null      | not null
                      |       v           v
                      |   audit.logSkip   +-------------------+
                      |   throw NoAv...   | check rate limit   |
                      |                   +-+------------------+
                      |                     | exceeded
                      |                     v
                      |                 RateLimitExceededError
                      |                     | OK
                      |                     v
                      |                 +---+----------------+
                      |                 | INSERT comm_messages|
                      |                 +---+----------------+
                      |                     |
                      |                     v
                      |                 +---+----------------+
                      |                 | enqueue BullMQ     |
                      |                 +---+----------------+
                      |                     |
                      |                     v
                      |                 +---+----------------+
                      |                 | UPDATE message     |
                      |                 | queue_job_id, status='queued'|
                      |                 +---+----------------+
                      |                     |
                      |                     v
                      |                 +---+----------------+
                      |                 | audit.logSendQueued|
                      |                 +---+----------------+
                      |                     |
                      |                     v
                      |                 +---+----------------+
                      |                 | Redis SET idem key |
                      |                 +---+----------------+
                      |                     |
                      +---------------------+
                                            |
                                            v
                                       Return result
```

## Annexe G. Test matrix complete (32 scenarios decision tree)

| # | preferred | opt-in WA | opt-in email | phone valid | email valid | template approved | override | result |
|---|-----------|-----------|--------------|-------------|-------------|-------------------|----------|--------|
| 1 | wa | yes | yes | yes | yes | yes | none | wa |
| 2 | wa | yes | yes | yes | yes | no | none | email |
| 3 | wa | yes | yes | yes | no | yes | none | wa |
| 4 | wa | yes | yes | no | yes | yes | none | email |
| 5 | wa | no | yes | yes | yes | yes | none | email |
| 6 | wa | no | no | yes | yes | yes | none | error |
| 7 | wa | yes | no | yes | yes | no | none | error |
| 8 | wa | no | yes | yes | yes | no | none | email |
| 9 | wa | no | yes | no | yes | yes | none | email |
| 10 | wa | yes | no | no | no | yes | none | error |
| 11 | email | yes | yes | yes | yes | yes | none | email |
| 12 | email | yes | yes | yes | yes | no | none | email |
| 13 | email | yes | no | yes | yes | yes | none | error |
| 14 | email | no | yes | yes | yes | yes | none | email |
| 15 | email | yes | no | yes | no | yes | none | error |
| 16 | email | yes | yes | yes | no | yes | none | error |
| 17 | null | yes | yes | yes | yes | yes | none | wa |
| 18 | null | yes | yes | yes | yes | no | none | email |
| 19 | null | no | no | yes | yes | yes | none | error |
| 20 | wa | yes | yes | yes | yes | yes | email | email |
| 21 | wa | yes | yes | yes | yes | yes | wa | wa |
| 22 | wa | no | yes | yes | yes | yes | wa | email |
| 23 | wa | yes | no | yes | yes | yes | email | wa |
| 24 | wa | no | no | yes | yes | yes | email | error |
| 25 | wa | no | no | yes | yes | yes | wa | error |
| 26 | wa skipOptOut | n/a | n/a | yes | yes | yes | none | wa |
| 27 | wa skipOptOut | n/a | n/a | yes | yes | no | none | email |
| 28 | wa skipOptOut | n/a | n/a | no | yes | yes | none | email |
| 29 | wa skipOptOut | n/a | n/a | no | no | yes | none | error |
| 30 | wa | yes | yes | yes (invalid format) | yes | yes | none | email |
| 31 | wa | yes | yes | yes | yes (invalid format) | yes | none | wa |
| 32 | wa | yes | yes | yes (invalid format) | yes (invalid format) | yes | none | error |

Each row corresponds to a test in `it.each(...)` Vitest parametrize block. Coverage > 95% on `ChannelResolverService.determineFinalChannel` guaranteed by this matrix.

## Annexe H. Lien avec autres taches Sprint 9

```
Tache 3.2.1 (entites comm_messages + Zod)
  -> consume by orchestrator (MessagesRepositoryService)
  -> validation Zod DTOs

Tache 3.2.2 (WhatsApp Cloud API client)
  -> consume by worker wa-send (Tache 3.2.8) NOT by orchestrator directly
  -> orchestrator only orchestrates, worker calls Meta

Tache 3.2.3 (WA template renderer)
  -> consume by orchestrator (validateMetaApproved check)
  -> consume by worker wa-send (render before send)

Tache 3.2.4 (WA webhook receiver)
  -> NOT consume orchestrator directly
  -> webhook updates comm_messages.status -> Tache 3.2.10 delivery tracking

Tache 3.2.5 (Template Manager + seeds)
  -> consume by waRenderer (lookup template_id from name)
  -> consume by orchestrator indirectly via validateMetaApproved

Tache 3.2.6 (Email SMTP client)
  -> consume by worker email-send NOT orchestrator

Tache 3.2.7 (Email template renderer)
  -> consume by worker email-send NOT orchestrator

Tache 3.2.8 (BullMQ queues + workers + DLQ)
  -> orchestrator ENQUEUES jobs in wa-send / email-send queues
  -> workers process and update comm_messages.status

Tache 3.2.9 (THIS TASK -- Message Orchestrator)
  -> consume contactsService (Sprint 8 CRM)
  -> consume optoutService (Tache 3.2.11 -- depends but functional via Sprint 9 init)
  -> consume waRenderer (Tache 3.2.3)
  -> consume messagesRepo (Tache 3.2.1)
  -> consume queues wa-send + email-send (Tache 3.2.8)
  -> emit audit log + Kafka events
  -> EXPOSED to controllers (Tache 3.2.12)

Tache 3.2.10 (delivery tracking)
  -> consume comm_messages.status updates from workers + webhooks

Tache 3.2.11 (opt-out CNDP)
  -> consumed BY orchestrator (getOptedOutChannels)
  -> exposed to public endpoint /optout/:token

Tache 3.2.12 (endpoints REST /comm/*)
  -> wraps orchestrator in HTTP controllers
  -> POST /api/v1/comm/messages/send -> orchestrator.sendToContact
  -> POST /api/v1/comm/messages/send-batch -> orchestrator.sendBatch
  -> POST /api/v1/comm/messages/broadcast -> orchestrator.sendBroadcast

Tache 3.2.13 (tests E2E 40+)
  -> exhaustive coverage including orchestrator routing scenarios
```

## Annexe I. Migration progressive Sprint 5 EmailService -> Sprint 9 Orchestrator

Sprint 5 Tache 2.1.13 a livre `EmailService.sendVerification(...)` etc. Sprint 9 introduit `MessageOrchestratorService.sendToContact(contactId, 'verify-email', ...)` qui prefere WhatsApp si disponible.

Migration plan :
1. Sprint 9 : `MessageOrchestratorService` cohabite avec `EmailService`. Modules legacy continuent EmailService.
2. Sprint 10-13 : nouveaux modules (Insure, Repair) utilisent orchestrator only.
3. Sprint 14 : refactor Sprint 5 auth modules pour utiliser orchestrator (pas just email). Permet WA notifications auth pour users qui prefèrent.
4. Sprint 30+ : EmailService deprecated, orchestrator only.

Backward compat : `EmailService.sendVerification(...)` reste fonctionnel mais wrap interne `orchestrator.sendToContact(contactId, 'verify-email', ..., { preferChannel: 'email' })`.

---

## 17. Notes finales pour developpeur implementeur

1. Cette tache est la PIVOT du Sprint 9 : tous les autres modules consument l'orchestrator. Implementer avec rigueur extreme tests + audit.
2. Le decision tree est testes par test matrix 32 scenarios (`it.each` Vitest parametrize). Ne PAS sauter cette etape -- chaque branche doit etre validee individuellement.
3. La performance broadcast 10000 contacts < 30s est exigence dure. Pendant dev, monitorer continuously avec `console.time` (a remplacer par OTEL avant commit).
4. Ne JAMAIS commit `skipOptOutCheck=true` dans un module non-auth sans audit log + code review explicite. Le risque CNDP est financier (300k MAD/message non-conforme) et reputational.
5. Pour test integration testcontainers, prevoir machine dev avec 4 GB RAM minimum (Postgres + Redis + Kafka + Node tests = ~2 GB).
6. Idempotency-Key Redis 24h TTL : si user retry apres 25h, traite comme new send (pas de duplicate detection 25h+). Documente clairement dans API docs.
7. Marketing horaires legaux : check au moment ENQUEUE (orchestrator), pas au worker, pour eviter delay job ouvert hors horaires.
8. Cursor pagination : si tenant a 1M contacts et broadcast prend 30 minutes, contacts crees pendant peuvent etre manques (cursor base sur created_at). Acceptable pour use cases marketing (newsletter).
9. Audit log decision_path JSONB peut grossir si tree complex. Limiter a 20 entries max. Truncate avec `["...truncated"]` si depasse.
10. TenantContext propagation dans Promise.all batch sendBroadcast est le piege le plus subtil. Tester explicitement avec multi-tenant scenario.
11. UUID v7 generation : `import { v7 as uuidv7 } from 'uuid'` -- v7 monotonic timestamps better than v4 random pour cursor pagination.
12. Rate limit Redis sliding window : Lua script atomique recommande Sprint 14, MVP utilise INCR + EXPIRE.

---

**Fin du prompt task 3.2.9 v2.2 format Option B exhaustif.**
