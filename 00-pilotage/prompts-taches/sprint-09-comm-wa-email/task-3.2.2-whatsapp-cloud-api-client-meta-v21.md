# TACHE 3.2.2 -- WhatsApp Cloud API Client (Meta v21.0) -- undici 7.1.1 + Bottleneck rate limiting + retry exponential + 8 typed errors

**Sprint** : 9 (Phase 3 / Sprint 2 dans phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.2)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 3.2.3 WA Template Renderer, 3.2.4 WA Webhook, 3.2.5 Template Manager, 3.2.8 BullMQ workers, 3.2.9 Message Orchestrator, 3.2.13 Tests E2E -- et tous les flows utilisateur communications du programme)
**Effort** : 6h
**Dependances amont** : 3.2.1 (comm_messages entity + schemas Zod + helpers phone E.164), Sprint 3 (KafkaPublisher, Pino logger, ConfigService Zod, MultiTenantContext, BullDashboard), Sprint 5 (env loader Zod)
**Dependances aval** : 3.2.3 (consume client.sendTemplate apres render), 3.2.4 (consume client.markAsRead apres status update), 3.2.8 (WaSendWorker injecte client), 3.2.13 (mocks utilisent MockWhatsAppCloudApiClient)
**Densite cible** : 120-140 ko (auto-suffisant exhaustif, AUCUNE dependance externe a relire pour implementer)
**AUCUNE EMOJI AUTORISEE (decision-006)**

---

## 1. But

Cette tache vise a livrer le client TypeScript `WhatsAppCloudApiClient` complet, production-ready et testable du programme Skalean InsurTech v2.2 qui implemente l'integralite de la couche d'integration HTTP avec **Meta WhatsApp Business Platform Cloud API v21.0** (le SaaS gere par Meta, par opposition a l'On-Premises API deprecated par Meta debut 2024). Le client expose 6 methods publiques principales (`sendTemplate(to, templateName, languageCode, components)` pour envoyer les Highly Structured Messages HSM via templates pre-approved par Meta Business Manager workflow, `sendText(to, body, contextMessageId?)` pour envoyer des messages free-form a l'interieur de la **fenetre de session 24h** ouverte apres qu'un utilisateur ait initie une conversation entrante, `markAsRead(messageId)` pour informer Meta que le broker a lu un message entrant -- declenche les double-checks bleus cote utilisateur, `getPhoneNumberInfo()` pour verifier la configuration au boot et au healthcheck `/health/wa`, `uploadMedia(buffer, mimeType, filename?)` pour uploader images/documents/audio dans CDN Meta avant referencer leur `media_id` dans un template avec header `image`/`document`/`video`, `downloadMedia(mediaId)` pour streamer le contenu binaire d'un media recu via webhook entrant) ; un transport HTTP base sur **undici 7.1.1** (le HTTP client natif Node.js maintenu par l'equipe Node officielle, ~2-3x plus performant qu'axios sur les benchmarks fastify-undici-2024 -- p99 GET 4ms vs 12ms, throughput 80k req/sec vs 28k) supportant connection pooling explicite via `Pool` instance dediee `graph.facebook.com`, timeout configurable (default 30s), bodyTimeout 30s, headersTimeout 30s, et keep-alive ; une couche **rate limiting** via la library Bottleneck 2.19.5 wrappee dans `MetaRateLimiter` qui respecte strictement la limite Meta de **80 messages par seconde par phone_number_id** (Meta Cloud API hard limit Tier 1 documentation officielle Business Platform 2024 ; au-dela, code erreur 130429 + suspension temporaire 5min), avec queue overflow protection (highWater 1000 jobs en file d'attente, strategy `Bottleneck.strategy.OVERFLOW_PRIORITY` rejette les low-priority si plus de 1000 en queue) et `minTime: 12.5ms` (1000ms / 80 = 12.5) ; une couche **retry exponential** via implementation custom (pas axios-retry car undici natif) avec 3 tentatives default sur erreurs 5xx (502/503/504 -- Meta CDN transient, 429 rate-limited -- respect Retry-After header), backoff `1s -> 5s -> 30s` avec jitter aleatoire +/-20% pour eviter thundering herd, et **fail-fast sur 4xx non-retriable** (400 invalid template, 401 unauthorized, 403 wabaSuspended, 404 phone-not-found) qui propagent immediatement l'erreur typee correspondante ; un mapping exhaustif des **error codes Meta** (130 invalid template name, 131 phone not opted-in WA, 132 invalid template format, 133 template not approved by Meta review, 100 invalid parameter, 190 access token expired, 80007 rate limit reached, 130429 messages limit hit, 131051 unsupported message type, 131056 pair rate limit hit, 132012 parameter mismatch, 132015 template paused) vers 8 sous-classes typees d'`MetaApiError` (`MetaRateLimitError`, `MetaInvalidTemplateError`, `MetaPhoneNotOptedInError`, `MetaTemplateNotApprovedError`, `MetaInvalidWaBaError`, `MetaAccessTokenExpiredError`, `MetaParameterCountMismatchError`, `MetaWaBaSuspendedError`) qui exposent toutes `code`, `subCode`, `metaTraceId`, `httpStatus`, `retryable`, `originalResponse` ; une **interface partagee** `IWhatsAppCloudApiClient` permettant l'injection d'un `MockWhatsAppCloudApiClient` interface-equivalent dans les tests pour simuler succes synthetique + simuler chaque type d'erreur via flags `simulateRateLimit`, `simulateInvalidTemplate`, etc. ; un **module NestJS** `WhatsAppModule` Global qui factory-provide selon `WHATSAPP_PROVIDER_MODE` env (`real` pour staging/prod, `mock` pour dev/test/CI) ; et une suite de **30 tests Vitest unit + integration** (nock pour mock fetch, vitest-fetch-mock pour undici intercept) couvrant happy paths, edge cases retry, error mapping exhaustif, rate limit Bottleneck queue, idempotency caveat (Meta API n'est PAS idempotent niveau HTTP -- c'est l'orchestrateur Tache 3.2.9 qui doit gerer via `comm_messages.status` lookup deja sent), 24h session window logic, format E.164 strict sans `+`, multi-tenant context propagation dans logs.

L'apport est multiple. Premierement, **Meta WhatsApp Business Platform Cloud API v21.0** est devenu en 2024-2025 le canal de communication B2C dominant au Maroc (selon les enquetes Sprint 1 sur 80000 assures, ~92% utilisent WhatsApp quotidiennement vs ~58% qui consultent leurs emails dans les 24h ; le taux d'ouverture WA depasse 95% sous 5 minutes vs ~22% pour email a 24h ; le taux de reponse WA depasse 45% vs ~8% email). En integrant ce canal de maniere production-grade des Sprint 9, le programme se positionne immediatement competitif vs AssurMaroc et ClickAssure qui n'utilisent que SMS premium ($0.05/msg vs WA gratuit) ou email peu lus. Deuxiemement, en utilisant **undici 7.1.1** au lieu d'axios ou node-fetch, on obtient un gain de performance mesure ~3x sur les calls API Meta (p99 latency 12ms axios vs 4ms undici sur graph.facebook.com benchmark interne) et on aligne avec le choix Fastify undici-based deja Sprint 3 -- on evite ainsi de charger 2 HTTP stacks en parallele (memory ~15MB economisee). Troisiemement, en respectant les **rate limits Meta 80/sec** via Bottleneck plutot que de laisser exploser les requests en burst, on evite la suspension automatique 5min du phone_number_id (qui cause un downtime visible cote client en plein rush ouverture police) et on assure une queueing graceful : pendant les broadcasts marketing (Tache 3.2.9 sendBroadcast 5000 contacts), Bottleneck linearize l'envoi sur ~62.5 secondes au lieu de 5000 errors 130429 sub-second. Quatriemement, en **typant precisement** chaque error Meta via 8 sous-classes au lieu d'un generique `Error`, le code consommateur (Tache 3.2.8 WaSendWorker `onFailed` callback, Tache 3.2.9 orchestrator fallback) peut distinguer les erreurs retriables (rate limit -> attendre + retry) des erreurs definitives (template not approved -> fallback email immediat sans tenter retry), et peut router intelligemment vers DLQ Kafka uniquement les erreurs non recuperables. Cinquiemement, en fournissant un **MockWhatsAppCloudApiClient** interface-equivalent, les 40 tests E2E Sprint 9 Tache 3.2.13 + tous les tests unit Sprints 14+ (Insure -- police signed, payment due) et Sprints 20+ (Repair -- sinistre acknowledged) peuvent valider leurs flows utilisateur sans frais Meta reels (Meta facture les conversation-initiated messages a $0.0099 a $0.0858 selon pays/category ; ~$0.038 marketing MA -- soit ~$1900 pour 50k tests/sprint), sans dependance reseau, et avec controle deterministe des scenarios d'erreur. Sixiemement, en preparant le **24h session window** pattern (sendText autorise apres user-initiated inbound message recent), on prepare le futur conversational AI Sprint 30+ (chatbot couverture devis qui repond inline aux questions utilisateur dans le rolling 24h window).

A l'issue de cette tache, l'API `client.sendTemplate('212612345678', 'police_signed_confirmation', { code: 'fr' }, components)` retourne `{ message_id: 'wamid.HBgM...' }` Meta-format en moins de 200 ms p99 sur connexion residentielle MA (lattency Meta CDN Marseille via Casablanca ~80ms one-way + handshake ~30ms + Meta processing ~50ms), `client.sendText('212612345678', 'Merci pour votre message, un conseiller revient vers vous')` envoie un message texte free-form si la session 24h est ouverte sinon throw `MetaInvalidConversationStateError`, `client.markAsRead('wamid.HBgM...')` informe Meta du read receipt sans corps de reponse, `client.getPhoneNumberInfo()` retourne `{ verified_name, code_verification_status, display_phone_number, quality_rating }` pour healthcheck, `client.uploadMedia(buffer, 'image/jpeg')` stream le buffer vers `POST /v21.0/{phone_id}/media` multipart et retourne `{ media_id: '1234567890' }` valide 30 jours, `client.downloadMedia('1234567890')` retourne un Buffer Node.js pret a etre stocke dans Sprint 11 DocsModule, le module est import-able via `@insurtech/comm` package barrel export, le mock client se substitue transparente via `WHATSAPP_PROVIDER_MODE=mock`, les 30 tests passent sans Meta API reel, les logs Pino structures emettent `{ level: 'info', msg: 'wa_send_template', message_id, duration_ms, status, tenant_id, recipient_phone_hashed }` (le phone est hashe SHA-256 + tenant_pepper pour conformite CNDP loi 09-08 article 12), aucun token `WHATSAPP_ACCESS_TOKEN` n'est jamais loggue (masque `***ssed***`), et la suite Vitest atteint coverage >= 92% sur le module providers/whatsapp.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 declenche des messages WhatsApp transactionnels lors de nombreuses operations utilisateur :
- Sprint 5 Auth : `email_verification_fallback` (si email rebondit + utilisateur a opted-in WA -- rare mais defensif Sprint 27 admin UI permet)
- Sprint 6 Tenant : `tenant_invitation_wa` (invitation broker rejoindre tenant via WA -- 65% des invitations acceptees sous 1h vs 22% email a 24h selon AB-test Sprint 1)
- Sprint 8 Booking : `appointment_scheduled_wa`, `appointment_reminder_24h_wa`, `appointment_reminder_1h_wa`, `appointment_cancelled_wa` (les courtiers MA preferent largement WA pour rappels RDV agence)
- Sprint 14+ Insure : `quote_generated_wa` (devis dispo notification), `police_signed_confirmation_wa`, `police_renewal_reminder_30d_wa`, `payment_due_reminder_wa`, `claim_received_acknowledgement_wa`
- Sprint 20+ Repair : `sinistre_acknowledged_wa`, `devis_ready_wa`, `reparation_started_wa`, `reparation_completed_wa`
- Sprint 17 Comm vertical : `tenant_quota_warning_wa` (notifs admin courtage)
- Sprint 30+ AI : conversational chatbot couverture devis (utilise sendText 24h window)

Sans un client `WhatsAppCloudApiClient` centralise et reutilisable :
- Chaque consommateur metier devrait integrer `fetch('graph.facebook.com')` + retry + rate limiting + error mapping individuellement (~120 lignes dupliquees par consommateur, ~12 consommateurs identifies = ~1440 lignes de duplication).
- L'incoherence des templates serait inevitable (versions Meta, formats variables ordered vs named, language codes).
- Les bursts Sprint 9 sendBroadcast (5000 reminders RDV) violeraient le rate limit Meta 80/sec sans queue centralisee, causant suspensions phone_number_id.
- Les tests E2E Sprint 9 + 14+ + 20+ ne pourraient pas mocker (chaque consommateur instancierait son propre fetch).
- Les couts Meta exploserait en dev/CI (chaque test E2E enverrait des messages reels facturees ~$0.038 MA marketing).

L'exigence Cloud API v21.0 specifique vs On-Premises est dictee par Meta directement : depuis avril 2024, Meta a annonce la deprecation On-Premises API avec end-of-life octobre 2025. Tous les nouveaux integrations DOIVENT utiliser Cloud API. Avantages collateraux Cloud :
- Pas d'infrastructure WhatsApp Business Server a gerer (Meta heberge).
- Pas de upgrade trimestriel a l'On-Premises Docker image.
- Webhooks deja Meta-hosted (vs auto-hebergement On-Premises).
- Templates pre-approval workflow integre Meta Business Manager UI.

L'exigence undici 7.1.1 vs axios/node-fetch est dictee par les benchmarks performance equipe SDK Sprint 1 :
| HTTP Client | p50 GET graph.fb | p99 GET | Throughput | Memory |
|-------------|------------------|---------|------------|--------|
| undici 7.1.1 | 1.2 ms | 4 ms | 80k req/sec | 35 MB |
| axios 1.6.2 | 3.8 ms | 12 ms | 28k req/sec | 50 MB |
| node-fetch 3.3 | 2.1 ms | 7 ms | 45k req/sec | 42 MB |

Pour 50k WA send/jour MVP -> 500k Sprint 35+ scaling, le gain undici represente ~2-3 secondes par 1000 messages soit ~25 minutes par jour. Cumul annuel : ~150 heures de latence client epargnees.

L'exigence Bottleneck vs implementations naives (setTimeout-based) :
| Approche | Garantie 80/sec | Queue overflow | Priority | Distributed (Sprint 14+) |
|----------|-----------------|----------------|----------|--------------------------|
| Setinterval 12.5ms | Approximative (drift) | Non | Non | Non |
| `p-throttle` | Oui | Limite | Non | Non |
| Bottleneck 2.19 | Strict via reservoir | Oui (highWater) | Oui | Oui (clustering Redis) |

Bottleneck supporte le clustering Redis (Sprint 14+ scaling multi-instance API) qui partage le rate limiter entre N pods Kubernetes -- chaque pod consomme 80/N msg/sec. Sans clustering, 5 pods enverraient 400 msg/sec collectivement et seraient suspendus.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Twilio WhatsApp API (Sandbox + Production) | API simple, library officielle Node | Pricing $0.005/conv + $0.005/msg = ~3x cher Meta direct ; vendor lock-in ; latency ~150ms supplementaire (Twilio US relay) | REJETE -- cout MVP 50k/jour = $250/jour vs $190 direct Meta |
| 360dialog WhatsApp BSP (Berlin) | Compliance UE, support templates UI | Vendor lock-in, $0.01/msg fee + Meta cost ; latency UE | REJETE -- pas necessaire avec Meta direct |
| Meta WhatsApp Cloud API direct (RETENU) | Pas d'intermediaire, pricing brut Meta, control complet | Necessite gerer rate limit + retry + webhooks soi-meme | RETENU |
| Meta On-Premises API (deprecated) | Self-hosted | EOL octobre 2025 + lourd Docker maintenance | REJETE -- deprecated par Meta |
| MessageBird WhatsApp API | API GraphQL elegante | Pricing premium $0.04/msg | REJETE |
| axios 1.6.2 | Ecosysteme mature, interceptors | 3x lent vs undici, +15MB memory, double HTTP stack avec Fastify | REJETE Sprint 9 (utilise Sprint 5 partiel mais migration progressive Sprint 14+) |
| node-fetch 3.3 | Standard fetch API | 2x lent undici, pas de pooling natif | REJETE |
| undici 7.1.1 (RETENU) | Performance native Node, Pool/Agent natif, fetch global Node 18+ | Apprentissage Pool/Dispatcher API | RETENU |
| Bottleneck 2.19.5 (RETENU) | Strict, queue overflow, cluster Redis | +1 dep | RETENU |
| `p-throttle` 5.1.0 | Simple promise-based | Pas de queue overflow strategy | REJETE pour rate limiter Meta |
| `bullmq` queue uniquement comme rate limiter | Reuse Sprint 3 BullMQ | Latency BullMQ overhead ~5ms par msg, rate-limiter natif moins flexible | REJETE -- BullMQ est queue, pas rate limiter |
| Mock client only (pas vrai API call meme prod) | Cout zero | Pas de vraies messages MVP -- no go | REJETE evidemment |
| Real client only sans mock | Simple | Tests E2E impossibles sans cout reel + flakiness reseau | REJETE |
| Real + mock interface-equivalent (RETENU) | Production reelle + tests determinist | Maintenir 2 implementations | RETENU |
| Errors generic Error class | Simple | Consommateurs ne peuvent distinguer retriable | REJETE |
| 8 typed error sous-classes (RETENU) | Type-safe consumer error handling | +1 fichier | RETENU |
| Retry library (`async-retry`, `cockatiel`) | Pre-fait | Dependance supplementaire, moins flexible que custom 50 lignes | REJETE -- custom mieux |
| Custom retry exponential (RETENU) | Controle complet, integre avec Bottleneck | 50 lignes a maintenir | RETENU |

### 2.3 Trade-offs

Choisir **Meta direct** au lieu d'un BSP (Business Service Provider comme Twilio ou 360dialog) implique :
- **Avantage** : ~3x moins cher ($0.038/msg MA marketing vs $0.12 Twilio).
- **Inconvenient** : Toute la logique technique (rate limit, retry, webhook signature HMAC, template approval workflow) doit etre implementee soi-meme. Sprint 9 dedie 65h pour couvrir cela.
- **Mitigation** : Patterns soigneusement encapsules dans `@insurtech/comm` package, reutilisables dans tous Sprints aval sans toucher.

Choisir **undici 7.1.1** au lieu d'axios :
- **Avantage** : Performance 3x meilleure, alignement avec Fastify, memory -15MB.
- **Inconvenient** : API moins familiere pour devs JS background (Pool, Dispatcher), pas d'interceptors automatiques (debug logging manuel).
- **Mitigation** : Code patterns inline tres explicites dans cette tache (section 6), JSDoc detaille, abstraction `MetaHttpClient` wrapper interne masque undici aux consommateurs.

Choisir **Bottleneck 2.19.5** au lieu de p-throttle ou setInterval naif :
- **Avantage** : Strict respect 80/sec, queue overflow strategy, futur clustering Redis Sprint 14+.
- **Inconvenient** : +1 dependance (~30KB minified), API ponctuelle particuliere (`schedule`, `submit`).
- **Mitigation** : Wrapper minimal `MetaRateLimiter` (~80 lignes) masque Bottleneck details, ne reexpose que `schedule(taskName, fn)`.

Choisir **8 sous-classes typed errors** au lieu d'un `Error` generique avec discriminator string :
- **Avantage** : `instanceof MetaRateLimitError` dans worker `onFailed` permet auto-retry vs `instanceof MetaInvalidTemplateError` permet immediate fallback ; type-narrowing TypeScript renforce contract.
- **Inconvenient** : ~80 lignes errors.ts a maintenir.
- **Mitigation** : Hierarchy claire `MetaApiError` base + 8 leaves, chaque leaf ajoute uniquement contextual fields specifiques.

Choisir **mock interface-equivalent** au lieu de mocker via Vitest `vi.spyOn` :
- **Avantage** : Tests integration Sprint 14/20/25+ peuvent injecter mock via NestJS DI au boot test-module sans toucher chaque test ; flags `simulateXyz` permettent setup deterministe scenarios.
- **Inconvenient** : Maintenir 2 implementations (real + mock) en symetrie. Si signature method change, 2 endroits a modifier.
- **Mitigation** : Interface partagee `IWhatsAppCloudApiClient` avec ts strict force la symetrie ; tests `mock-real-symmetry.spec.ts` Sprint 9 verifient meme signature.

Choisir **retry custom 50 lignes** plutot qu'une lib :
- **Avantage** : Integration intime avec Bottleneck (retry happens inside scheduled slot, pas hors), error classification deterministe.
- **Inconvenient** : Code a maintenir.
- **Mitigation** : Tests retry-logic.spec.ts couvrent 8 scenarios.

Choisir de **ne PAS retry sur 4xx** (fail-fast) :
- **Avantage** : Pas de cycles inutiles sur erreurs deterministes (template typo -> retry n'aidera jamais).
- **Inconvenient** : Si Meta corrige cote serveur entre tentatives (rare), on rate l'envoi.
- **Mitigation** : Logging detaille permet ops d'investiguer apres coup. Pour erreurs reellement transientes, Meta retourne 5xx ou 429.

Choisir de **ne PAS faire idempotency niveau client** :
- **Avantage** : Simplifie implementation (Meta ne supporte pas idempotency_key header officiellement).
- **Inconvenient** : 2 calls `sendTemplate` consecutifs avec meme contenu = 2 messages distincts cote utilisateur.
- **Mitigation** : Tache 3.2.9 orchestrator gere idempotency via `comm_messages.status` lookup avant enqueue + Tache 3.2.8 worker gere via `messageId` deja sent check.

### 2.4 Decisions strategiques referenced

- **decision-006** (No-emoji) : totale, aucun emoji dans code/comments/templates/error messages.
- **decision-007** (Zod runtime validation) : indirecte, le client recoit input typed TypeScript -- la validation E.164 est faite par caller (Tache 3.2.1 helpers + Tache 3.2.9 orchestrator). Mais le client valide minimum (phone non vide, templateName non vide) defense en profondeur.
- **decision-008** (Cloud souverain MA) : Meta API Cloud est non-souverain (US/Singapore/Brazil regions). Justifie par : (1) absence d'alternative WhatsApp souverain MA, (2) seules les metadata transitent (pas d'identite client cleartext -- les templates utilisent variables {{1}} {{2}} avec donnees pseudonymisees), (3) opt-in CNDP loi 09-08 explicite avant first send.
- **decision-009** (Multi-locale fr-MA, ar-MA, en, fr-FR) : la language Meta accepte `fr` et `ar` natif, `en` pour international ; ar-MA mappe vers `ar` Meta avec contenu darija dans templates approved.
- **decision-014** (Pino structured logging) : tous logs JSON, niveau info pour succes, warn pour retry, error pour fail-fast.
- **decision-018** (Templates Handlebars) : la generation des `components` Meta JSON depuis variables se fait Tache 3.2.3 -- ce client ne fait que transmettre.
- **decision-021** (Multi-tenant context propagation) : `tenant_id` injecte dans tous logs via `MultiTenantContext.getCurrent()` Sprint 3.
- **decision-024** (No console.log) : strictement interdit ; uniquement Pino logger.
- **decision-026** (Audit trail) : chaque send genere une entree audit Sprint 6 AuditService -- mais c'est l'orchestrator Tache 3.2.9 qui appelle audit, pas le client (pas de couplage).

### 2.5 Pieges techniques connus

1. **Phone format E.164 sans `+` Meta** : Meta exige `212612345678` strict, pas `+212612345678` ni `212-612-345-678` ni `+212 612 345 678`. Le helper Tache 3.2.1 normalise -- ce client recoit deja-format, mais re-valide pour defense en profondeur (`/^\d{10,15}$/`).
2. **Token Bearer expiration silencieuse** : `WHATSAPP_ACCESS_TOKEN` Meta a une validite (60 jours pour System User permanent token, 24h pour User access token classic). En production il faut **System User token permanent** (configurable Meta Business Manager). Si expire : Meta retourne 401 avec `error.code=190` -- client throw `MetaAccessTokenExpiredError` -> alert ops Sprint 33.
3. **Templates pre-approved seulement** : meme si techniquement on POST avec template name correct, si template `meta_template_status != 'approved'` Meta retourne 132 (template not approved). Toujours verifier `validateMetaApproved` avant send (Tache 3.2.3 fait ce check). Ce client n'a pas access DB templates -- il delegate au caller.
4. **Variables ordered NOT named** : Meta n'accepte PAS `{name: 'user_name', value: 'Mohamed'}`. Format strict : `parameters: [{type: 'text', text: 'Mohamed'}]` dans l'ordre `{{1}}`, `{{2}}`, `{{3}}` du template approved. Mismatch ordre = mismatch contenu envoye -- silent semantic bug grave. Tache 3.2.3 garantit le mapping correct.
5. **Body length 1024 chars max** : Meta rejette templates body > 1024 chars (incluant variables interpolees). Header 60 chars max. Footer 60 chars max. Template approval Meta rejette si pas respecte.
6. **24h session window subtilite** : seul le **dernier** inbound message rolling 24h ouvre la fenetre. Si user envoie a 10:00 et 14:00, la fenetre expire a 14:00+24h pas 10:00+24h. Attention edge case Tache 3.2.9 : verifier `last_inbound_at` colonne Sprint 8 `crm_contacts` avant `sendText`.
7. **Rate limit per phone_number_id, not per access_token** : un access_token peut gerer plusieurs phone numbers (multi-WABA). Le rate limit 80/sec s'applique par phone number, pas global. Bottleneck reservoir doit etre par-phone (Sprint 14+ scale).
8. **Meta error response shape varie** : selon endpoint, `{error: {message, type, code, error_subcode, fbtrace_id}}` ou `{errors: [...]}`. Parser doit gerer les 2.
9. **Retry-After header non standard 429** : Meta utilise `Retry-After: <seconds>` parfois mais aussi parfois sans, dans body `error.error_data.details: "wait 60s"`. Parser robuste requis.
10. **CDN failures distinct from API failures** : Meta CDN (graph.facebook.com) peut retourner 502/503 cloudflare-style avec HTML body au lieu de JSON. Parser doit handle non-JSON 5xx response (`SyntaxError JSON parse` -> assume retriable transient).
11. **uploadMedia size limit 16MB** : Meta limite media upload 16MB. Au-dela, retourner pre-validation error (sans appel Meta inutile).
12. **downloadMedia 2-step process** : (1) GET `/v21.0/{media_id}` retourne `{url, mime_type}`, (2) GET `url` (lookaside.fbsbx.com avec separate auth) retourne binaire. Le `url` expire en 5 minutes -- consume rapidement.
13. **markAsRead is fire-and-forget mostly** : Meta peut retourner 200 avec body `{success: true}` mais aussi 4xx si messageId already-read ou not-found. Best effort, pas de retry.
14. **Multi-tenant phone_number_id mapping** : Sprint 14+ : tenant peut avoir son propre WABA + phone. Sprint 9 single phone shared all tenants OK, mais le client doit pouvoir prendre `phoneNumberId` parametre future-proof. Cette tache prend single phone via env, mais signature methodes accepte optional override.
15. **Webhook NOT this task scope** : signature HMAC verification + status update est Tache 3.2.4. Ce client est send-only.
16. **Test pollution Bottleneck** : Bottleneck instance singleton via `BottleneckGroup` -- entre tests, doit `.disconnect()` ou `.stop()` pour eviter handle leaks Vitest. Cleanup `afterEach`.
17. **undici fetch global vs Pool** : `globalThis.fetch` Node 18+ utilise undici sous le capot mais sans Pool config. Pour graph.facebook.com avec pooling explicite + timeout, on utilise `new Pool('https://graph.facebook.com', { connections: 10 })` + `pool.request()` ou `fetch(url, { dispatcher: pool })`.
18. **Logging recipient phone : PII** : conformement CNDP loi 09-08, le numero recipient doit etre HASHE dans logs (`sha256(phone + tenant_pepper)`). Meta API receives plain phone evidemment, mais nos logs ne stockent que hash. Tache 3.2.1 helper `hashPhoneE164(phone, tenantId)`.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.2.2 livre `WhatsAppCloudApiClient` consomme par :
- **Tache 3.2.3 WA Template Renderer** : le renderer construit `components` Meta JSON depuis template DB + variables, puis call `client.sendTemplate(...)` injection.
- **Tache 3.2.4 WA Webhook Receiver** : sur incoming message status, le webhook processor call `client.markAsRead(messageId)` pour double-checks bleus.
- **Tache 3.2.5 Template Manager** : seed script peut call `client.getPhoneNumberInfo()` pour healthcheck config.
- **Tache 3.2.8 BullMQ Workers** : `WaSendWorker.process()` call `client.sendTemplate(...)` puis update DB + Kafka publish ; `WaSendWorker.onFailed(err)` discrimine via `instanceof Meta*Error` pour DLQ ou retry.
- **Tache 3.2.9 Message Orchestrator** : appelle indirectement via BullMQ (le workers runs client) ; mais aussi en preflight check `client.getPhoneNumberInfo()` healthcheck startup.
- **Tache 3.2.10 Delivery Tracking** : webhook update propage status sans toucher client (read-only path).
- **Tache 3.2.11 Opt-out Management** : pas de couplage direct.
- **Tache 3.2.12 Endpoints REST** : expose POST `/api/v1/comm/messages/send` qui delegate Tache 3.2.9 -> client.
- **Tache 3.2.13 Tests E2E** : MockWhatsAppCloudApiClient injecte via `WHATSAPP_PROVIDER_MODE=mock`.

### 3.2 Position dans le programme global

- **Sprint 5** Auth : email_verification fallback peut utiliser WA si email rebondit (Sprint 14+ flow).
- **Sprint 6** Tenant : tenant_invitation_wa.
- **Sprint 8** Booking : appointment_reminder_24h_wa, appointment_reminder_1h_wa, appointment_cancelled_wa.
- **Sprint 14+** Insure : police_signed_confirmation_wa, payment_due_reminder_wa, claim_received_wa.
- **Sprint 17** Comm vertical : tenant_quota_warning_wa.
- **Sprint 20+** Repair : sinistre_acknowledged_wa, devis_ready_wa, reparation_started_wa, reparation_completed_wa.
- **Sprint 22** Analytics : track WA delivered/read rate via webhook events.
- **Sprint 27** Admin UI : workflow Meta Business Manager template approval integre.
- **Sprint 30+** AI : conversational chatbot via sendText 24h window.
- **Sprint 33** Alerts : MetaAccessTokenExpiredError -> Slack alert ops.
- **Sprint 35** : potentielle migration vers BSP MA-souverain si emerge.

### 3.3 Diagramme

```
                   +-----------------------------------+
                   | Tache 3.2.1 termine                 |
                   | comm_messages entity + Zod schemas  |
                   | helpers phone E.164                 |
                   +-----------------+-------------------+
                                     |
                                     v
              +-----------------------------------------------+
              | TACHE 3.2.2 (cette tache)                     |
              | WhatsAppCloudApiClient                        |
              | - sendTemplate(to, name, lang, components)    |
              | - sendText(to, body, contextMessageId?)       |
              | - markAsRead(messageId)                       |
              | - getPhoneNumberInfo()                        |
              | - uploadMedia(buffer, mimeType, filename?)    |
              | - downloadMedia(mediaId)                      |
              |                                               |
              | undici 7.1.1 Pool dedie graph.facebook.com    |
              | Bottleneck 80/sec rate limiter (queue 1000)   |
              | Custom retry exponential 1s/5s/30s + jitter   |
              | 8 typed errors (MetaRateLimit, InvalidTpl..)  |
              | Error mapper Meta codes -> typed errors       |
              |                                               |
              | MockWhatsAppCloudApiClient (interface eq.)    |
              | - simulate flags : RateLimit, InvalidTpl..    |
              |                                               |
              | WhatsAppModule (NestJS Global)                |
              | - factory provider mode=real|mock             |
              +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                | | | | | | | | | | | | | | | | | | | | | |
                v v v v v v v v v v v v v v v v v v v v v v
                3.2.3 / 3.2.4 / 3.2.8 / 3.2.9 / 3.2.13
                Sprint 14+ / Sprint 20+ / Sprint 27 / Sprint 30+
```

### 3.4 Flux nominal sendTemplate

```
Caller (Tache 3.2.8 WaSendWorker)
   |
   |  client.sendTemplate('212612345678', 'police_signed_confirmation', 'fr', components)
   |
   v
WhatsAppCloudApiClient.sendTemplate
   |
   |  1. Validate input (phone non-vide, template non-vide)
   |  2. Build Meta request body JSON
   |  3. rateLimiter.schedule('sendTemplate', () => httpRequestWithRetry(...))
   |
   v
MetaRateLimiter (Bottleneck)
   |
   |  - Reserve slot (12.5ms slot interval)
   |  - Si 1000 jobs queue -> reject low priority
   |  - Sinon attendre tour
   |
   v
httpRequestWithRetry (custom retry)
   |
   |  attempt=1 : pool.request(POST /v21.0/{phone_id}/messages)
   |    - 200 OK -> parse {messages: [{id: 'wamid.xxx'}]} -> return
   |    - 4xx fail-fast -> map error code -> throw typed error
   |    - 5xx -> backoff 1s + jitter -> attempt=2
   |  attempt=2 : retry
   |    - 5xx -> backoff 5s -> attempt=3
   |  attempt=3 : retry
   |    - 5xx -> backoff 30s -> attempt=4 final
   |    - if still 5xx -> throw MetaApiError retryable=true
   |
   v
ErrorMapper.mapToTypedError
   |
   |  Meta code 130 -> MetaInvalidTemplateError (retryable=false)
   |  Meta code 131 -> MetaPhoneNotOptedInError (retryable=false)
   |  Meta code 132 -> MetaTemplateNotApprovedError (retryable=false)
   |  Meta code 133 -> MetaInvalidWaBaError (retryable=false)
   |  Meta code 190 -> MetaAccessTokenExpiredError (retryable=false, alert ops)
   |  Meta code 80007 / 130429 -> MetaRateLimitError (retryable=true)
   |  Meta code 132012 -> MetaParameterCountMismatchError (retryable=false)
   |  Meta http 403 wabaSuspended -> MetaWaBaSuspendedError (retryable=false)
   |  HTTP 5xx generic -> MetaApiError retryable=true
   |
   v
Logger (Pino structured)
   |
   |  level=info msg='wa_send_template_complete' duration_ms=87 status='success' message_id='wamid.xxx'
   |  OR level=error msg='wa_send_template_failed' error_class='MetaInvalidTemplateError' code=130 retryable=false
   |
   v
Return { message_id: 'wamid.xxx' } OR throw typed Error
   |
   v
Caller continues (Worker update DB + Kafka publish OR onFailed handler)
```

---

## 4. Livrables checkables (32 livrables)

- [ ] Service `repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.ts` -- ~280 lignes
- [ ] Mock service `repo/packages/comm/src/providers/whatsapp/mock-whatsapp.client.ts` -- ~150 lignes
- [ ] Interface partagee `IWhatsAppCloudApiClient` dans `whatsapp-cloud-api.client.ts` (export)
- [ ] Types Meta API `repo/packages/comm/src/providers/whatsapp/types.ts` -- ~120 lignes
- [ ] Errors typed `repo/packages/comm/src/providers/whatsapp/errors.ts` -- ~80 lignes (8 sous-classes + base + helpers)
- [ ] Error mapper `repo/packages/comm/src/providers/whatsapp/error-mapper.ts` -- ~120 lignes
- [ ] Rate limiter helper `repo/packages/comm/src/providers/whatsapp/rate-limiter.helper.ts` -- ~80 lignes
- [ ] Module NestJS `repo/packages/comm/src/providers/whatsapp/whatsapp.module.ts` -- ~50 lignes
- [ ] Barrel `repo/packages/comm/src/providers/whatsapp/index.ts` -- ~25 lignes (re-exports public API)
- [ ] Tests unit `repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.spec.ts` -- 18+ tests Vitest
- [ ] Tests integration `repo/packages/comm/src/providers/whatsapp/__tests__/integration/send-template.integration.spec.ts` -- ~150 lignes
- [ ] Fixtures `repo/packages/comm/src/providers/whatsapp/__tests__/fixtures/meta-responses.fixtures.ts` -- ~100 lignes
- [ ] Mise a jour `repo/packages/comm/package.json` : `undici@7.1.1`, `bottleneck@2.19.5`, devDep `nock@13.5.6`
- [ ] Variables env ajoutees a `.env.example` : `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_API_BASE_URL`, `WHATSAPP_RATE_LIMIT_PER_SECOND`, `WHATSAPP_RETRY_MAX_ATTEMPTS`, `WHATSAPP_REQUEST_TIMEOUT_MS`, `WHATSAPP_PROVIDER_MODE`
- [ ] Schema Zod env (Sprint 5 env loader) elargi pour valider WHATSAPP_*
- [ ] Mise a jour `repo/packages/comm/src/comm.module.ts` : import + re-export WhatsAppModule
- [ ] Tests passent (>= 25 tests greens, target 30)
- [ ] Coverage providers/whatsapp >= 92%
- [ ] No-emoji
- [ ] No-console
- [ ] No log de WHATSAPP_ACCESS_TOKEN en clair (masque `***ssed***`)
- [ ] No log recipient phone en clair (hashe SHA-256 avec tenant_pepper)
- [ ] Build TypeScript reussit (tsc --noEmit)
- [ ] Lint reussit (eslint --max-warnings=0)
- [ ] Mock client interface symetrique au real (tests mock-real-symmetry.spec.ts)
- [ ] Bottleneck 80/sec strict (test concurrent 100 sends linearize 1.25s minimum)
- [ ] Retry 3 attempts sur 5xx, fail-fast 4xx
- [ ] Error mapper couvre 12 Meta codes documente
- [ ] Fixtures realistes Meta responses (success + 8 errors)
- [ ] uploadMedia rejet pre-validation si > 16MB
- [ ] downloadMedia 2-step process implemente
- [ ] Multi-tenant context propagation dans logs
- [ ] Module Global (Reuse Sprint 14+ sans re-import)

---

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.ts                 (~280 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/mock-whatsapp.client.ts                       (~150 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/types.ts                                       (~120 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/errors.ts                                       (~80 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/error-mapper.ts                                 (~120 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/rate-limiter.helper.ts                          (~80 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/whatsapp.module.ts                              (~50 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/index.ts                                        (~25 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.spec.ts               (~250 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/__tests__/integration/send-template.integration.spec.ts  (~150 lignes, neuf)
repo/packages/comm/src/providers/whatsapp/__tests__/fixtures/meta-responses.fixtures.ts    (~100 lignes, neuf)
repo/packages/comm/package.json                                                            (modifie : +undici +bottleneck +nock devDep)
repo/packages/comm/src/comm.module.ts                                                       (modifie : import WhatsAppModule)
.env.example                                                                                  (modifie : +WHATSAPP_* vars)
repo/packages/config/src/env.schema.ts                                                       (modifie Sprint 5 env loader Zod : add WHATSAPP_*)
```

Total : 11 fichiers neufs + 4 fichiers modifies = ~1430 lignes effectives nouvelles.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 11 : `whatsapp-cloud-api.client.ts`

```typescript
/**
 * @insurtech/comm/providers/whatsapp/whatsapp-cloud-api.client
 *
 * Production client for Meta WhatsApp Business Platform Cloud API v21.0.
 *
 * Reference :
 *   - decision-006 (No-emoji)
 *   - decision-014 (Pino structured logging)
 *   - decision-021 (Multi-tenant context)
 *   - Sprint 9 Tache 3.2.2 (this task)
 *   - Meta Cloud API documentation : https://developers.facebook.com/docs/whatsapp/cloud-api
 *
 * Methods :
 *   - sendTemplate : send HSM via pre-approved template (most common path)
 *   - sendText : send free-form text within 24h session window
 *   - markAsRead : inform Meta read receipt (double blue ticks)
 *   - getPhoneNumberInfo : config healthcheck
 *   - uploadMedia : upload binary asset before referencing media_id in template
 *   - downloadMedia : 2-step download from Meta CDN
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type Dispatcher } from 'undici';
import { createHash } from 'node:crypto';
import { MetaRateLimiter } from './rate-limiter.helper.js';
import { mapMetaErrorToTypedError, isRetriableHttpStatus } from './error-mapper.js';
import {
  MetaApiError,
  MetaPhoneNumberConfigInvalidError,
  MetaMediaTooLargeError,
  MetaInvalidParameterError,
} from './errors.js';
import type {
  MetaTemplateMessage,
  MetaTextMessage,
  MetaResponseSuccess,
  MetaResponseError,
  MetaPhoneNumberInfo,
  MetaTemplateComponents,
  MetaMediaUploadResponse,
  MetaMediaUrlResponse,
  SendTemplateResult,
  SendTextResult,
} from './types.js';

const META_PHONE_E164_REGEX = /^\d{10,15}$/;
const META_MAX_MEDIA_SIZE_BYTES = 16 * 1024 * 1024;
const DEFAULT_API_BASE_URL = 'https://graph.facebook.com/v21.0';
const DEFAULT_RATE_LIMIT_PER_SECOND = 80;
const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_BACKOFF_MS = [1000, 5000, 30_000];

export interface IWhatsAppCloudApiClient {
  sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components: MetaTemplateComponents,
    options?: { tenantId?: string; correlationId?: string },
  ): Promise<SendTemplateResult>;

  sendText(
    to: string,
    body: string,
    options?: { contextMessageId?: string; tenantId?: string; correlationId?: string },
  ): Promise<SendTextResult>;

  markAsRead(messageId: string, options?: { tenantId?: string }): Promise<void>;

  getPhoneNumberInfo(): Promise<MetaPhoneNumberInfo>;

  uploadMedia(
    buffer: Buffer,
    mimeType: string,
    filename?: string,
    options?: { tenantId?: string },
  ): Promise<MetaMediaUploadResponse>;

  downloadMedia(mediaId: string, options?: { tenantId?: string }): Promise<Buffer>;
}

@Injectable()
export class WhatsAppCloudApiClient
  implements IWhatsAppCloudApiClient, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(WhatsAppCloudApiClient.name);

  private apiBaseUrl: string = DEFAULT_API_BASE_URL;
  private phoneNumberId: string = '';
  private accessToken: string = '';
  private requestTimeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS;
  private retryMaxAttempts: number = DEFAULT_RETRY_MAX_ATTEMPTS;
  private rateLimitPerSecond: number = DEFAULT_RATE_LIMIT_PER_SECOND;

  private pool: Pool | null = null;
  private rateLimiter: MetaRateLimiter | null = null;
  private tenantPhoneHashPepper: string = '';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.apiBaseUrl =
      this.config.get<string>('WHATSAPP_API_BASE_URL') ?? DEFAULT_API_BASE_URL;
    this.phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') ?? '';
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN') ?? '';
    this.requestTimeoutMs = Number.parseInt(
      this.config.get<string>('WHATSAPP_REQUEST_TIMEOUT_MS') ?? String(DEFAULT_REQUEST_TIMEOUT_MS),
      10,
    );
    this.retryMaxAttempts = Number.parseInt(
      this.config.get<string>('WHATSAPP_RETRY_MAX_ATTEMPTS') ?? String(DEFAULT_RETRY_MAX_ATTEMPTS),
      10,
    );
    this.rateLimitPerSecond = Number.parseInt(
      this.config.get<string>('WHATSAPP_RATE_LIMIT_PER_SECOND') ?? String(DEFAULT_RATE_LIMIT_PER_SECOND),
      10,
    );
    this.tenantPhoneHashPepper =
      this.config.get<string>('TENANT_PHONE_HASH_PEPPER') ?? 'default-rotate-sprint-35';

    if (!this.phoneNumberId) {
      throw new MetaPhoneNumberConfigInvalidError('WHATSAPP_PHONE_NUMBER_ID env not set');
    }
    if (!this.accessToken) {
      throw new MetaPhoneNumberConfigInvalidError('WHATSAPP_ACCESS_TOKEN env not set');
    }

    const baseUrlParsed = new URL(this.apiBaseUrl);
    this.pool = new Pool(`${baseUrlParsed.protocol}//${baseUrlParsed.host}`, {
      connections: 10,
      pipelining: 1,
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000,
      headersTimeout: this.requestTimeoutMs,
      bodyTimeout: this.requestTimeoutMs,
    });

    this.rateLimiter = new MetaRateLimiter({
      ratePerSecond: this.rateLimitPerSecond,
      highWater: 1000,
    });

    this.logger.log({
      msg: 'whatsapp_cloud_client_initialized',
      api_base_url: this.apiBaseUrl,
      phone_number_id: this.phoneNumberId,
      rate_limit_per_second: this.rateLimitPerSecond,
      retry_max_attempts: this.retryMaxAttempts,
      request_timeout_ms: this.requestTimeoutMs,
      access_token_masked: this.maskToken(this.accessToken),
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.rateLimiter) {
      await this.rateLimiter.stop();
    }
    if (this.pool) {
      await this.pool.close();
    }
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components: MetaTemplateComponents,
    options?: { tenantId?: string; correlationId?: string },
  ): Promise<SendTemplateResult> {
    this.assertPhoneE164(to);
    if (!templateName || templateName.trim().length === 0) {
      throw new MetaInvalidParameterError('templateName must be non-empty');
    }
    if (!languageCode || languageCode.trim().length === 0) {
      throw new MetaInvalidParameterError('languageCode must be non-empty');
    }

    const body: MetaTemplateMessage = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components: components.length > 0 ? components : undefined,
      },
    };

    const start = Date.now();
    const phoneHash = this.hashRecipientPhone(to, options?.tenantId);

    try {
      const response = await this.rateLimiter!.schedule('sendTemplate', () =>
        this.requestWithRetry<MetaResponseSuccess>(
          'POST',
          `/${this.phoneNumberId}/messages`,
          body,
        ),
      );

      const messageId = response.messages?.[0]?.id;
      if (!messageId) {
        throw new MetaApiError(
          'Meta API returned 200 but no message id',
          { code: -1, httpStatus: 200, retryable: false },
        );
      }

      this.logger.log({
        msg: 'wa_send_template_complete',
        duration_ms: Date.now() - start,
        status: 'success',
        message_id: messageId,
        template_name: templateName,
        language: languageCode,
        recipient_phone_hashed: phoneHash,
        tenant_id: options?.tenantId,
        correlation_id: options?.correlationId,
      });

      return { message_id: messageId };
    } catch (error) {
      this.logger.error({
        msg: 'wa_send_template_failed',
        duration_ms: Date.now() - start,
        status: 'failure',
        template_name: templateName,
        language: languageCode,
        recipient_phone_hashed: phoneHash,
        tenant_id: options?.tenantId,
        correlation_id: options?.correlationId,
        error_class: (error as Error).constructor?.name,
        error_message: (error as Error).message,
        retryable: error instanceof MetaApiError ? error.retryable : false,
      });
      throw error;
    }
  }

  async sendText(
    to: string,
    body: string,
    options?: { contextMessageId?: string; tenantId?: string; correlationId?: string },
  ): Promise<SendTextResult> {
    this.assertPhoneE164(to);
    if (body.length === 0 || body.length > 4096) {
      throw new MetaInvalidParameterError('text body must be 1..4096 chars');
    }

    const requestBody: MetaTextMessage = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body, preview_url: false },
      ...(options?.contextMessageId
        ? { context: { message_id: options.contextMessageId } }
        : {}),
    };

    const start = Date.now();
    const response = await this.rateLimiter!.schedule('sendText', () =>
      this.requestWithRetry<MetaResponseSuccess>(
        'POST',
        `/${this.phoneNumberId}/messages`,
        requestBody,
      ),
    );

    const messageId = response.messages?.[0]?.id;
    if (!messageId) {
      throw new MetaApiError(
        'Meta API returned 200 but no message id',
        { code: -1, httpStatus: 200, retryable: false },
      );
    }

    this.logger.log({
      msg: 'wa_send_text_complete',
      duration_ms: Date.now() - start,
      message_id: messageId,
      recipient_phone_hashed: this.hashRecipientPhone(to, options?.tenantId),
      tenant_id: options?.tenantId,
      correlation_id: options?.correlationId,
    });

    return { message_id: messageId };
  }

  async markAsRead(messageId: string, _options?: { tenantId?: string }): Promise<void> {
    if (!messageId || messageId.trim().length === 0) {
      throw new MetaInvalidParameterError('messageId must be non-empty');
    }
    await this.rateLimiter!.schedule('markAsRead', () =>
      this.requestWithRetry('POST', `/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    );
  }

  async getPhoneNumberInfo(): Promise<MetaPhoneNumberInfo> {
    return this.requestWithRetry<MetaPhoneNumberInfo>(
      'GET',
      `/${this.phoneNumberId}`,
      undefined,
    );
  }

  async uploadMedia(
    buffer: Buffer,
    mimeType: string,
    filename?: string,
    _options?: { tenantId?: string },
  ): Promise<MetaMediaUploadResponse> {
    if (buffer.byteLength > META_MAX_MEDIA_SIZE_BYTES) {
      throw new MetaMediaTooLargeError(
        `Media size ${buffer.byteLength} exceeds 16MB Meta limit`,
        buffer.byteLength,
      );
    }
    const form = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    form.append('file', blob, filename ?? 'upload.bin');
    form.append('type', mimeType);
    form.append('messaging_product', 'whatsapp');

    const url = `${this.apiBaseUrl}/${this.phoneNumberId}/media`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}` },
      body: form,
      dispatcher: this.pool as unknown as Dispatcher,
    } as RequestInit);

    if (!response.ok) {
      const errBody = (await response.json().catch(() => ({}))) as MetaResponseError;
      throw mapMetaErrorToTypedError(response.status, errBody);
    }
    return (await response.json()) as MetaMediaUploadResponse;
  }

  async downloadMedia(mediaId: string, _options?: { tenantId?: string }): Promise<Buffer> {
    if (!mediaId || mediaId.trim().length === 0) {
      throw new MetaInvalidParameterError('mediaId must be non-empty');
    }
    const meta = await this.requestWithRetry<MetaMediaUrlResponse>(
      'GET',
      `/${mediaId}`,
      undefined,
    );
    if (!meta.url) {
      throw new MetaApiError('Meta media URL not available', {
        code: -1,
        httpStatus: 200,
        retryable: false,
      });
    }
    const binaryResp = await fetch(meta.url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!binaryResp.ok) {
      throw new MetaApiError(`Media download failed http=${binaryResp.status}`, {
        code: -1,
        httpStatus: binaryResp.status,
        retryable: isRetriableHttpStatus(binaryResp.status),
      });
    }
    const arrBuf = await binaryResp.arrayBuffer();
    return Buffer.from(arrBuf);
  }

  // -------------------- private helpers --------------------

  private assertPhoneE164(to: string): void {
    if (!META_PHONE_E164_REGEX.test(to)) {
      throw new MetaInvalidParameterError(
        `phone must be E.164 digits only (no +), got: "${to}" (len=${to.length})`,
      );
    }
  }

  private async requestWithRetry<T>(
    method: 'GET' | 'POST',
    path: string,
    bodyJson: unknown,
  ): Promise<T> {
    let lastErr: unknown = null;
    const maxAttempts = this.retryMaxAttempts;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const url = `${this.apiBaseUrl}${path}`;
        const response = await this.pool!.request({
          method,
          path: new URL(url).pathname + new URL(url).search,
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: bodyJson !== undefined ? JSON.stringify(bodyJson) : undefined,
          headersTimeout: this.requestTimeoutMs,
          bodyTimeout: this.requestTimeoutMs,
        });

        const status = response.statusCode;
        const text = await response.body.text();
        let parsed: unknown = {};
        try {
          parsed = text.length > 0 ? JSON.parse(text) : {};
        } catch {
          parsed = { error: { message: text } };
        }

        if (status >= 200 && status < 300) {
          return parsed as T;
        }

        if (status >= 400 && status < 500) {
          throw mapMetaErrorToTypedError(status, parsed as MetaResponseError);
        }

        if (status >= 500) {
          lastErr = new MetaApiError(
            `Meta 5xx http=${status} attempt=${attempt}`,
            { code: -1, httpStatus: status, retryable: true, originalResponse: parsed },
          );
          if (attempt < maxAttempts) {
            const delay = this.computeBackoff(attempt);
            this.logger.warn({
              msg: 'wa_request_retry',
              attempt,
              next_attempt_in_ms: delay,
              http_status: status,
            });
            await this.sleep(delay);
            continue;
          }
          throw lastErr;
        }

        throw new MetaApiError(`Unexpected http=${status}`, {
          code: -1,
          httpStatus: status,
          retryable: false,
        });
      } catch (err) {
        if (err instanceof MetaApiError && !err.retryable) throw err;
        lastErr = err;
        if (attempt < maxAttempts) {
          const delay = this.computeBackoff(attempt);
          this.logger.warn({
            msg: 'wa_request_retry_network_error',
            attempt,
            next_attempt_in_ms: delay,
            error_message: (err as Error).message,
          });
          await this.sleep(delay);
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  private computeBackoff(attempt: number): number {
    const base = DEFAULT_BACKOFF_MS[Math.min(attempt - 1, DEFAULT_BACKOFF_MS.length - 1)] ?? 30_000;
    const jitter = base * 0.2 * (Math.random() * 2 - 1);
    return Math.max(0, Math.floor(base + jitter));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private hashRecipientPhone(phone: string, tenantId?: string): string {
    return createHash('sha256')
      .update(`${this.tenantPhoneHashPepper}::${tenantId ?? 'global'}::${phone}`)
      .digest('hex')
      .slice(0, 16);
  }

  private maskToken(token: string): string {
    if (token.length <= 8) return '***';
    return `${token.slice(0, 4)}***${token.slice(-4)}`;
  }
}
```

### 6.2 Fichier 2 / 11 : `mock-whatsapp.client.ts`

```typescript
/**
 * @insurtech/comm/providers/whatsapp/mock-whatsapp.client
 *
 * Interface-equivalent mock for tests + dev mode (WHATSAPP_PROVIDER_MODE=mock).
 * Permits deterministic simulation of all 8 typed errors via flags.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.2
 *   - Sprint 9 Tache 3.2.13 (E2E mocks)
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  MetaApiError,
  MetaRateLimitError,
  MetaInvalidTemplateError,
  MetaPhoneNotOptedInError,
  MetaTemplateNotApprovedError,
  MetaInvalidWaBaError,
  MetaAccessTokenExpiredError,
  MetaParameterCountMismatchError,
  MetaWaBaSuspendedError,
} from './errors.js';
import type { IWhatsAppCloudApiClient } from './whatsapp-cloud-api.client.js';
import type {
  MetaTemplateComponents,
  MetaPhoneNumberInfo,
  MetaMediaUploadResponse,
  SendTemplateResult,
  SendTextResult,
} from './types.js';

export interface MockClientFlags {
  simulateRateLimit?: boolean;
  simulateInvalidTemplate?: boolean;
  simulatePhoneNotOptedIn?: boolean;
  simulateTemplateNotApproved?: boolean;
  simulateInvalidWaBa?: boolean;
  simulateAccessTokenExpired?: boolean;
  simulateParameterCountMismatch?: boolean;
  simulateWaBaSuspended?: boolean;
  simulateNetworkError?: boolean;
  simulateLatencyMs?: number;
}

@Injectable()
export class MockWhatsAppCloudApiClient implements IWhatsAppCloudApiClient {
  private readonly logger = new Logger(MockWhatsAppCloudApiClient.name);

  public flags: MockClientFlags = {};
  public sentTemplates: Array<{
    to: string;
    templateName: string;
    languageCode: string;
    components: MetaTemplateComponents;
    timestamp: number;
  }> = [];
  public sentTexts: Array<{ to: string; body: string; timestamp: number }> = [];
  public markedAsRead: string[] = [];
  public uploadedMedia: Array<{ mimeType: string; size: number; mediaId: string }> = [];

  resetFlags(): void {
    this.flags = {};
  }

  resetCalls(): void {
    this.sentTemplates = [];
    this.sentTexts = [];
    this.markedAsRead = [];
    this.uploadedMedia = [];
  }

  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    components: MetaTemplateComponents,
    options?: { tenantId?: string; correlationId?: string },
  ): Promise<SendTemplateResult> {
    await this.simulateLatency();
    this.maybeThrowSimulatedError();

    const messageId = `wamid.MOCK_${randomUUID()}`;
    this.sentTemplates.push({
      to,
      templateName,
      languageCode,
      components,
      timestamp: Date.now(),
    });
    this.logger.debug({
      msg: 'mock_wa_send_template',
      message_id: messageId,
      template_name: templateName,
      tenant_id: options?.tenantId,
    });
    return { message_id: messageId };
  }

  async sendText(
    to: string,
    body: string,
    options?: { contextMessageId?: string; tenantId?: string; correlationId?: string },
  ): Promise<SendTextResult> {
    await this.simulateLatency();
    this.maybeThrowSimulatedError();

    const messageId = `wamid.MOCK_TEXT_${randomUUID()}`;
    this.sentTexts.push({ to, body, timestamp: Date.now() });
    this.logger.debug({
      msg: 'mock_wa_send_text',
      message_id: messageId,
      tenant_id: options?.tenantId,
    });
    return { message_id: messageId };
  }

  async markAsRead(messageId: string): Promise<void> {
    await this.simulateLatency();
    this.markedAsRead.push(messageId);
  }

  async getPhoneNumberInfo(): Promise<MetaPhoneNumberInfo> {
    return {
      verified_name: 'Skalean InsurTech (MOCK)',
      code_verification_status: 'VERIFIED',
      display_phone_number: '+212 6 12 34 56 78',
      quality_rating: 'GREEN',
      id: 'MOCK_PHONE_ID',
    };
  }

  async uploadMedia(
    buffer: Buffer,
    mimeType: string,
    _filename?: string,
  ): Promise<MetaMediaUploadResponse> {
    await this.simulateLatency();
    const mediaId = `MOCK_MEDIA_${randomUUID()}`;
    this.uploadedMedia.push({ mimeType, size: buffer.byteLength, mediaId });
    return { id: mediaId };
  }

  async downloadMedia(mediaId: string): Promise<Buffer> {
    await this.simulateLatency();
    return Buffer.from(`MOCK_MEDIA_CONTENT_${mediaId}`, 'utf-8');
  }

  private async simulateLatency(): Promise<void> {
    if (this.flags.simulateLatencyMs && this.flags.simulateLatencyMs > 0) {
      await new Promise((r) => setTimeout(r, this.flags.simulateLatencyMs));
    }
  }

  private maybeThrowSimulatedError(): void {
    if (this.flags.simulateRateLimit) {
      throw new MetaRateLimitError('MOCK rate limit hit', 60);
    }
    if (this.flags.simulateInvalidTemplate) {
      throw new MetaInvalidTemplateError('MOCK template not found', 'mock_tpl');
    }
    if (this.flags.simulatePhoneNotOptedIn) {
      throw new MetaPhoneNotOptedInError('MOCK phone not opted in', '212600000000');
    }
    if (this.flags.simulateTemplateNotApproved) {
      throw new MetaTemplateNotApprovedError('MOCK template not approved', 'mock_tpl');
    }
    if (this.flags.simulateInvalidWaBa) {
      throw new MetaInvalidWaBaError('MOCK invalid WABA');
    }
    if (this.flags.simulateAccessTokenExpired) {
      throw new MetaAccessTokenExpiredError('MOCK access token expired');
    }
    if (this.flags.simulateParameterCountMismatch) {
      throw new MetaParameterCountMismatchError(
        'MOCK parameter count mismatch (expected 3, got 2)',
        3,
        2,
      );
    }
    if (this.flags.simulateWaBaSuspended) {
      throw new MetaWaBaSuspendedError('MOCK WABA suspended');
    }
    if (this.flags.simulateNetworkError) {
      throw new MetaApiError('MOCK network error', {
        code: -1,
        httpStatus: 0,
        retryable: true,
      });
    }
  }
}
```

### 6.3 Fichier 3 / 11 : `types.ts`

```typescript
/**
 * @insurtech/comm/providers/whatsapp/types
 *
 * Meta WhatsApp Business Platform Cloud API v21.0 types.
 * Source : https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

export type MetaMessageType =
  | 'text'
  | 'template'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'reaction';

export interface MetaTemplateComponentParameterText {
  type: 'text';
  text: string;
}

export interface MetaTemplateComponentParameterCurrency {
  type: 'currency';
  currency: { fallback_value: string; code: string; amount_1000: number };
}

export interface MetaTemplateComponentParameterDateTime {
  type: 'date_time';
  date_time: { fallback_value: string };
}

export interface MetaTemplateComponentParameterImage {
  type: 'image';
  image: { id?: string; link?: string };
}

export interface MetaTemplateComponentParameterDocument {
  type: 'document';
  document: { id?: string; link?: string; filename?: string };
}

export type MetaTemplateComponentParameter =
  | MetaTemplateComponentParameterText
  | MetaTemplateComponentParameterCurrency
  | MetaTemplateComponentParameterDateTime
  | MetaTemplateComponentParameterImage
  | MetaTemplateComponentParameterDocument;

export interface MetaTemplateComponentBody {
  type: 'body';
  parameters: MetaTemplateComponentParameter[];
}

export interface MetaTemplateComponentHeader {
  type: 'header';
  parameters: MetaTemplateComponentParameter[];
}

export interface MetaTemplateComponentButton {
  type: 'button';
  sub_type: 'quick_reply' | 'url' | 'phone_number' | 'flow';
  index: string;
  parameters: MetaTemplateComponentParameter[];
}

export type MetaTemplateComponent =
  | MetaTemplateComponentBody
  | MetaTemplateComponentHeader
  | MetaTemplateComponentButton;

export type MetaTemplateComponents = MetaTemplateComponent[];

export interface MetaTemplateMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string; policy?: 'deterministic' };
    components?: MetaTemplateComponents;
  };
}

export interface MetaTextMessage {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text';
  text: { body: string; preview_url?: boolean };
  context?: { message_id: string };
}

export interface MetaMediaMessage {
  messaging_product: 'whatsapp';
  to: string;
  type: 'image' | 'document' | 'audio' | 'video';
  image?: { id?: string; link?: string; caption?: string };
  document?: { id?: string; link?: string; filename?: string; caption?: string };
  audio?: { id?: string; link?: string };
  video?: { id?: string; link?: string; caption?: string };
}

export interface MetaResponseSuccess {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string; message_status?: string }>;
}

export interface MetaResponseError {
  error?: {
    message: string;
    type: string;
    code: number;
    error_subcode?: number;
    error_data?: { messaging_product?: string; details?: string };
    fbtrace_id?: string;
  };
}

export interface MetaPhoneNumberInfo {
  id: string;
  verified_name: string;
  code_verification_status: 'VERIFIED' | 'NOT_VERIFIED' | 'EXPIRED';
  display_phone_number: string;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  certificate?: string;
  new_certificate?: string;
  name_status?: 'APPROVED' | 'AVAILABLE_WITHOUT_REVIEW' | 'DECLINED' | 'EXPIRED' | 'PENDING_REVIEW';
  search_visibility?: 'VISIBLE' | 'NON_VISIBLE';
}

export interface MetaMediaUploadResponse {
  id: string;
}

export interface MetaMediaUrlResponse {
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
  messaging_product: 'whatsapp';
}

export interface SendTemplateResult {
  message_id: string;
}

export interface SendTextResult {
  message_id: string;
}
```

### 6.4 Fichier 4 / 11 : `errors.ts`

```typescript
/**
 * @insurtech/comm/providers/whatsapp/errors
 *
 * Typed errors for Meta WhatsApp Cloud API v21.0.
 * Base class + 8 sub-classes for fine-grained consumer error handling.
 */

export interface MetaApiErrorOptions {
  code: number;
  subCode?: number;
  httpStatus: number;
  retryable: boolean;
  metaTraceId?: string;
  originalResponse?: unknown;
}

export class MetaApiError extends Error {
  public readonly code: number;
  public readonly subCode?: number;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly metaTraceId?: string;
  public readonly originalResponse?: unknown;

  constructor(message: string, options: MetaApiErrorOptions) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.subCode = options.subCode;
    this.httpStatus = options.httpStatus;
    this.retryable = options.retryable;
    this.metaTraceId = options.metaTraceId;
    this.originalResponse = options.originalResponse;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class MetaRateLimitError extends MetaApiError {
  public readonly retryAfterSeconds: number;
  constructor(message: string, retryAfterSeconds: number = 60, opts?: Partial<MetaApiErrorOptions>) {
    super(message, {
      code: 80007,
      httpStatus: 429,
      retryable: true,
      ...opts,
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class MetaInvalidTemplateError extends MetaApiError {
  public readonly templateName: string;
  constructor(message: string, templateName: string, opts?: Partial<MetaApiErrorOptions>) {
    super(message, { code: 130, httpStatus: 400, retryable: false, ...opts });
    this.templateName = templateName;
  }
}

export class MetaPhoneNotOptedInError extends MetaApiError {
  public readonly recipientPhone: string;
  constructor(message: string, recipientPhone: string, opts?: Partial<MetaApiErrorOptions>) {
    super(message, { code: 131, httpStatus: 400, retryable: false, ...opts });
    this.recipientPhone = recipientPhone;
  }
}

export class MetaTemplateNotApprovedError extends MetaApiError {
  public readonly templateName: string;
  constructor(message: string, templateName: string, opts?: Partial<MetaApiErrorOptions>) {
    super(message, { code: 132, httpStatus: 400, retryable: false, ...opts });
    this.templateName = templateName;
  }
}

export class MetaInvalidWaBaError extends MetaApiError {
  constructor(message: string, opts?: Partial<MetaApiErrorOptions>) {
    super(message, { code: 133, httpStatus: 400, retryable: false, ...opts });
  }
}

export class MetaAccessTokenExpiredError extends MetaApiError {
  constructor(message: string, opts?: Partial<MetaApiErrorOptions>) {
    super(message, { code: 190, httpStatus: 401, retryable: false, ...opts });
  }
}

export class MetaParameterCountMismatchError extends MetaApiError {
  public readonly expectedCount: number;
  public readonly actualCount: number;
  constructor(
    message: string,
    expectedCount: number,
    actualCount: number,
    opts?: Partial<MetaApiErrorOptions>,
  ) {
    super(message, { code: 132012, httpStatus: 400, retryable: false, ...opts });
    this.expectedCount = expectedCount;
    this.actualCount = actualCount;
  }
}

export class MetaWaBaSuspendedError extends MetaApiError {
  constructor(message: string, opts?: Partial<MetaApiErrorOptions>) {
    super(message, { code: -1, httpStatus: 403, retryable: false, ...opts });
  }
}

export class MetaPhoneNumberConfigInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetaPhoneNumberConfigInvalidError';
  }
}

export class MetaMediaTooLargeError extends MetaApiError {
  public readonly sizeBytes: number;
  constructor(message: string, sizeBytes: number) {
    super(message, { code: -1, httpStatus: 0, retryable: false });
    this.sizeBytes = sizeBytes;
  }
}

export class MetaInvalidParameterError extends MetaApiError {
  constructor(message: string) {
    super(message, { code: 100, httpStatus: 400, retryable: false });
  }
}
```

### 6.5 Fichier 5 / 11 : `error-mapper.ts`

```typescript
/**
 * @insurtech/comm/providers/whatsapp/error-mapper
 *
 * Maps Meta API error responses (HTTP status + error body) to typed errors.
 *
 * Meta error codes documented :
 *   100   = Invalid parameter
 *   130   = Invalid template name
 *   131   = Phone not opted-in WhatsApp
 *   132   = Invalid template format / not approved
 *   133   = Invalid WhatsApp Business Account
 *   190   = Access token expired
 *   80007 = Rate limit exceeded (per-app)
 *   130429 = Messages limit hit (per phone_number_id)
 *   131051 = Unsupported message type
 *   131056 = Pair rate limit hit (per recipient pair)
 *   132012 = Template parameter mismatch
 *   132015 = Template paused due to bad quality
 *
 * Reference : https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */

import {
  MetaApiError,
  MetaRateLimitError,
  MetaInvalidTemplateError,
  MetaPhoneNotOptedInError,
  MetaTemplateNotApprovedError,
  MetaInvalidWaBaError,
  MetaAccessTokenExpiredError,
  MetaParameterCountMismatchError,
  MetaWaBaSuspendedError,
  MetaInvalidParameterError,
} from './errors.js';
import type { MetaResponseError } from './types.js';

export function isRetriableHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504 || status === 0;
}

export function mapMetaErrorToTypedError(
  httpStatus: number,
  body: MetaResponseError | unknown,
): MetaApiError {
  const errPayload = (body as MetaResponseError)?.error;
  const code = errPayload?.code ?? -1;
  const subCode = errPayload?.error_subcode;
  const message = errPayload?.message ?? `Meta API error http=${httpStatus}`;
  const metaTraceId = errPayload?.fbtrace_id;
  const detailsHint = errPayload?.error_data?.details ?? '';

  const baseOpts = { metaTraceId, originalResponse: body, httpStatus };

  if (code === 80007 || code === 130429 || code === 131056 || httpStatus === 429) {
    const retryAfter = parseRetryAfterSeconds(detailsHint);
    return new MetaRateLimitError(message, retryAfter, baseOpts);
  }

  if (httpStatus === 401 || code === 190) {
    return new MetaAccessTokenExpiredError(message, baseOpts);
  }

  if (httpStatus === 403) {
    return new MetaWaBaSuspendedError(message, baseOpts);
  }

  if (code === 130) {
    return new MetaInvalidTemplateError(message, extractTemplateName(detailsHint), baseOpts);
  }
  if (code === 131) {
    return new MetaPhoneNotOptedInError(message, extractPhone(detailsHint), baseOpts);
  }
  if (code === 132 || code === 132015) {
    return new MetaTemplateNotApprovedError(message, extractTemplateName(detailsHint), baseOpts);
  }
  if (code === 133) {
    return new MetaInvalidWaBaError(message, baseOpts);
  }
  if (code === 132012) {
    const counts = extractParamCounts(detailsHint);
    return new MetaParameterCountMismatchError(message, counts.expected, counts.actual, baseOpts);
  }
  if (code === 100) {
    return new MetaInvalidParameterError(message);
  }

  return new MetaApiError(message, {
    code,
    subCode,
    httpStatus,
    retryable: isRetriableHttpStatus(httpStatus),
    metaTraceId,
    originalResponse: body,
  });
}

function parseRetryAfterSeconds(details: string): number {
  const match = details.match(/(\d+)\s*s/i);
  return match ? Number.parseInt(match[1]!, 10) : 60;
}

function extractTemplateName(details: string): string {
  const m = details.match(/template[: ]+([a-zA-Z0-9_]+)/i);
  return m ? m[1]! : 'unknown';
}

function extractPhone(details: string): string {
  const m = details.match(/(\d{10,15})/);
  return m ? m[1]! : 'unknown';
}

function extractParamCounts(details: string): { expected: number; actual: number } {
  const expectedM = details.match(/expected[ :]+(\d+)/i);
  const actualM = details.match(/(?:got|actual)[ :]+(\d+)/i);
  return {
    expected: expectedM ? Number.parseInt(expectedM[1]!, 10) : -1,
    actual: actualM ? Number.parseInt(actualM[1]!, 10) : -1,
  };
}
```

### 6.6 Fichier 6 / 11 : `rate-limiter.helper.ts`

```typescript
/**
 * @insurtech/comm/providers/whatsapp/rate-limiter.helper
 *
 * Thin wrapper around Bottleneck enforcing Meta 80 messages/sec/phone_number_id.
 * Sprint 14+ : add Redis clustering for multi-pod scaling.
 *
 * Reference :
 *   - Meta hard limit : 80 msg/sec/phone_number_id (Tier 1)
 *   - https://developers.facebook.com/docs/whatsapp/cloud-api/overview#rate-limits
 */

import Bottleneck from 'bottleneck';
import { Logger } from '@nestjs/common';

export interface MetaRateLimiterConfig {
  ratePerSecond: number;
  highWater: number;
}

export class MetaRateLimiter {
  private readonly logger = new Logger(MetaRateLimiter.name);
  private limiter: Bottleneck;

  constructor(config: MetaRateLimiterConfig) {
    const minTimeMs = Math.ceil(1000 / Math.max(1, config.ratePerSecond));
    this.limiter = new Bottleneck({
      reservoir: config.ratePerSecond,
      reservoirRefreshAmount: config.ratePerSecond,
      reservoirRefreshInterval: 1000,
      minTime: minTimeMs,
      highWater: config.highWater,
      strategy: Bottleneck.strategy.OVERFLOW_PRIORITY,
      maxConcurrent: config.ratePerSecond,
    });

    this.limiter.on('error', (err) => {
      this.logger.error({ msg: 'meta_rate_limiter_error', error_message: (err as Error).message });
    });
    this.limiter.on('depleted', () => {
      this.logger.warn({ msg: 'meta_rate_limiter_reservoir_depleted' });
    });
    this.limiter.on('failed', (err, jobInfo) => {
      this.logger.warn({
        msg: 'meta_rate_limiter_job_failed',
        job_id: jobInfo.options.id,
        error_message: (err as Error).message,
      });
    });
  }

  async schedule<T>(taskName: string, fn: () => Promise<T>): Promise<T> {
    return this.limiter.schedule({ id: taskName, priority: 5 }, fn);
  }

  async stop(): Promise<void> {
    await this.limiter.stop({ dropWaitingJobs: false });
  }

  getStats(): { queued: number; running: number; done: number } {
    const counts = this.limiter.counts();
    return {
      queued: counts.QUEUED + counts.RECEIVED,
      running: counts.RUNNING + counts.EXECUTING,
      done: counts.DONE,
    };
  }
}
```

### 6.7 Fichier 7 / 11 : `whatsapp.module.ts`

```typescript
/**
 * @insurtech/comm/providers/whatsapp/whatsapp.module
 *
 * NestJS Global module exposing IWhatsAppCloudApiClient.
 * Provider mode switchable via WHATSAPP_PROVIDER_MODE env :
 *   - 'real'  -> WhatsAppCloudApiClient (production / staging)
 *   - 'mock'  -> MockWhatsAppCloudApiClient (dev / test / CI)
 */

import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WhatsAppCloudApiClient } from './whatsapp-cloud-api.client.js';
import { MockWhatsAppCloudApiClient } from './mock-whatsapp.client.js';

export const WHATSAPP_CLIENT_TOKEN = Symbol('WHATSAPP_CLIENT_TOKEN');

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: WHATSAPP_CLIENT_TOKEN,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const mode = config.get<string>('WHATSAPP_PROVIDER_MODE') ?? 'real';
        if (mode === 'mock') {
          return new MockWhatsAppCloudApiClient();
        }
        const real = new WhatsAppCloudApiClient(config);
        await real.onModuleInit();
        return real;
      },
    },
    WhatsAppCloudApiClient,
    MockWhatsAppCloudApiClient,
  ],
  exports: [WHATSAPP_CLIENT_TOKEN, WhatsAppCloudApiClient, MockWhatsAppCloudApiClient],
})
export class WhatsAppModule {}
```

### 6.8 Fichier 8 / 11 : `index.ts` (barrel)

```typescript
/**
 * @insurtech/comm/providers/whatsapp -- public API barrel.
 */
export {
  WhatsAppCloudApiClient,
  type IWhatsAppCloudApiClient,
} from './whatsapp-cloud-api.client.js';
export { MockWhatsAppCloudApiClient, type MockClientFlags } from './mock-whatsapp.client.js';
export { WhatsAppModule, WHATSAPP_CLIENT_TOKEN } from './whatsapp.module.js';
export {
  MetaApiError,
  MetaRateLimitError,
  MetaInvalidTemplateError,
  MetaPhoneNotOptedInError,
  MetaTemplateNotApprovedError,
  MetaInvalidWaBaError,
  MetaAccessTokenExpiredError,
  MetaParameterCountMismatchError,
  MetaWaBaSuspendedError,
  MetaInvalidParameterError,
  MetaPhoneNumberConfigInvalidError,
  MetaMediaTooLargeError,
} from './errors.js';
export type {
  MetaTemplateMessage,
  MetaTextMessage,
  MetaMediaMessage,
  MetaResponseSuccess,
  MetaResponseError,
  MetaPhoneNumberInfo,
  MetaTemplateComponents,
  MetaTemplateComponent,
  MetaTemplateComponentParameter,
  MetaMediaUploadResponse,
  MetaMediaUrlResponse,
  SendTemplateResult,
  SendTextResult,
} from './types.js';
```

### 6.9 Fichier 9 / 11 : `whatsapp-cloud-api.client.spec.ts`

```typescript
/**
 * Sprint 9 Tache 3.2.2 -- WhatsAppCloudApiClient unit tests.
 *
 * Uses nock to intercept undici fetch + pool.request HTTP calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import nock from 'nock';
import { ConfigService } from '@nestjs/config';
import { WhatsAppCloudApiClient } from './whatsapp-cloud-api.client.js';
import {
  MetaInvalidTemplateError,
  MetaPhoneNotOptedInError,
  MetaTemplateNotApprovedError,
  MetaRateLimitError,
  MetaAccessTokenExpiredError,
  MetaInvalidParameterError,
  MetaMediaTooLargeError,
  MetaWaBaSuspendedError,
  MetaApiError,
} from './errors.js';
import {
  metaSendSuccessFixture,
  metaErrorInvalidTemplateFixture,
  metaErrorPhoneNotOptedInFixture,
  metaErrorTemplateNotApprovedFixture,
  metaErrorTokenExpiredFixture,
  metaErrorRateLimitFixture,
  metaErrorWabaSuspendedFixture,
  metaPhoneNumberInfoFixture,
  metaMediaUploadFixture,
} from './__tests__/fixtures/meta-responses.fixtures.js';

const PHONE_ID = '999_TEST_PHONE_ID';
const ACCESS_TOKEN = 'EAAG_test_token_xxxx';
const BASE_URL = 'https://graph.facebook.com/v21.0';

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const map = new Map<string, string>(
    Object.entries({
      WHATSAPP_PHONE_NUMBER_ID: PHONE_ID,
      WHATSAPP_ACCESS_TOKEN: ACCESS_TOKEN,
      WHATSAPP_API_BASE_URL: BASE_URL,
      WHATSAPP_RATE_LIMIT_PER_SECOND: '80',
      WHATSAPP_RETRY_MAX_ATTEMPTS: '3',
      WHATSAPP_REQUEST_TIMEOUT_MS: '5000',
      TENANT_PHONE_HASH_PEPPER: 'test-pepper',
      ...overrides,
    }),
  );
  return { get: (k: string) => map.get(k) } as unknown as ConfigService;
}

describe('WhatsAppCloudApiClient', () => {
  let client: WhatsAppCloudApiClient;

  beforeEach(async () => {
    nock.disableNetConnect();
    client = new WhatsAppCloudApiClient(makeConfig());
    await client.onModuleInit();
  });

  afterEach(async () => {
    await client.onModuleDestroy();
    nock.cleanAll();
    nock.enableNetConnect();
    vi.restoreAllMocks();
  });

  describe('sendTemplate -- happy path', () => {
    it('returns message_id on success', async () => {
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`)
        .reply(200, metaSendSuccessFixture());
      const result = await client.sendTemplate('212612345678', 'police_signed', 'fr', [
        { type: 'body', parameters: [{ type: 'text', text: 'Mohamed' }] },
      ]);
      expect(result.message_id).toMatch(/^wamid\./);
    });

    it('rejects phone with + prefix', async () => {
      await expect(
        client.sendTemplate('+212612345678', 'tpl', 'fr', []),
      ).rejects.toThrow(MetaInvalidParameterError);
    });

    it('rejects phone with non-digits', async () => {
      await expect(
        client.sendTemplate('212-612-345', 'tpl', 'fr', []),
      ).rejects.toThrow(MetaInvalidParameterError);
    });

    it('rejects empty templateName', async () => {
      await expect(
        client.sendTemplate('212612345678', '', 'fr', []),
      ).rejects.toThrow(MetaInvalidParameterError);
    });

    it('builds correct Meta request body', async () => {
      let capturedBody: unknown = null;
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`, (body) => {
          capturedBody = body;
          return true;
        })
        .reply(200, metaSendSuccessFixture());
      await client.sendTemplate('212612345678', 'mytpl', 'fr', [
        { type: 'body', parameters: [{ type: 'text', text: 'Sara' }] },
      ]);
      expect(capturedBody).toMatchObject({
        messaging_product: 'whatsapp',
        to: '212612345678',
        type: 'template',
        template: {
          name: 'mytpl',
          language: { code: 'fr' },
        },
      });
    });
  });

  describe('sendTemplate -- error mapping', () => {
    it('maps code 130 to MetaInvalidTemplateError', async () => {
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`)
        .reply(400, metaErrorInvalidTemplateFixture());
      await expect(
        client.sendTemplate('212612345678', 'bad_tpl', 'fr', []),
      ).rejects.toThrow(MetaInvalidTemplateError);
    });

    it('maps code 131 to MetaPhoneNotOptedInError', async () => {
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`)
        .reply(400, metaErrorPhoneNotOptedInFixture());
      await expect(
        client.sendTemplate('212612345678', 'tpl', 'fr', []),
      ).rejects.toThrow(MetaPhoneNotOptedInError);
    });

    it('maps code 132 to MetaTemplateNotApprovedError', async () => {
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`)
        .reply(400, metaErrorTemplateNotApprovedFixture());
      await expect(
        client.sendTemplate('212612345678', 'pending_tpl', 'fr', []),
      ).rejects.toThrow(MetaTemplateNotApprovedError);
    });

    it('maps 401 / code 190 to MetaAccessTokenExpiredError', async () => {
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`)
        .reply(401, metaErrorTokenExpiredFixture());
      await expect(
        client.sendTemplate('212612345678', 'tpl', 'fr', []),
      ).rejects.toThrow(MetaAccessTokenExpiredError);
    });

    it('maps 403 to MetaWaBaSuspendedError', async () => {
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`)
        .reply(403, metaErrorWabaSuspendedFixture());
      await expect(
        client.sendTemplate('212612345678', 'tpl', 'fr', []),
      ).rejects.toThrow(MetaWaBaSuspendedError);
    });

    it('maps 429 to MetaRateLimitError', async () => {
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`)
        .reply(429, metaErrorRateLimitFixture());
      await expect(
        client.sendTemplate('212612345678', 'tpl', 'fr', []),
      ).rejects.toThrow(MetaRateLimitError);
    });
  });

  describe('sendTemplate -- retry logic', () => {
    it('retries 3 times on 503 then fails', async () => {
      nock(BASE_URL).post(`/${PHONE_ID}/messages`).times(3).reply(503, '<html>Bad Gateway</html>');
      await expect(
        client.sendTemplate('212612345678', 'tpl', 'fr', []),
      ).rejects.toThrow(MetaApiError);
    }, 60_000);

    it('does NOT retry on 400 invalid template (fail-fast)', async () => {
      const scope = nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`)
        .reply(400, metaErrorInvalidTemplateFixture());
      await expect(
        client.sendTemplate('212612345678', 'tpl', 'fr', []),
      ).rejects.toThrow(MetaInvalidTemplateError);
      expect(scope.isDone()).toBe(true);
    });

    it('succeeds after 1 transient 503', async () => {
      nock(BASE_URL).post(`/${PHONE_ID}/messages`).reply(503, '<html>retry me</html>');
      nock(BASE_URL).post(`/${PHONE_ID}/messages`).reply(200, metaSendSuccessFixture());
      const result = await client.sendTemplate('212612345678', 'tpl', 'fr', []);
      expect(result.message_id).toMatch(/^wamid\./);
    }, 30_000);
  });

  describe('sendText', () => {
    it('rejects empty body', async () => {
      await expect(client.sendText('212612345678', '')).rejects.toThrow(MetaInvalidParameterError);
    });

    it('rejects body > 4096 chars', async () => {
      const body = 'x'.repeat(4097);
      await expect(client.sendText('212612345678', body)).rejects.toThrow(MetaInvalidParameterError);
    });

    it('sends free-form text', async () => {
      nock(BASE_URL).post(`/${PHONE_ID}/messages`).reply(200, metaSendSuccessFixture());
      const result = await client.sendText('212612345678', 'Hello within 24h window');
      expect(result.message_id).toMatch(/^wamid\./);
    });

    it('attaches contextMessageId when provided (reply-to)', async () => {
      let captured: any = null;
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`, (body) => {
          captured = body;
          return true;
        })
        .reply(200, metaSendSuccessFixture());
      await client.sendText('212612345678', 'Reply', { contextMessageId: 'wamid.PARENT' });
      expect(captured?.context).toMatchObject({ message_id: 'wamid.PARENT' });
    });
  });

  describe('markAsRead', () => {
    it('sends status=read body', async () => {
      let captured: any = null;
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`, (body) => {
          captured = body;
          return true;
        })
        .reply(200, { success: true });
      await client.markAsRead('wamid.HBgMTest');
      expect(captured).toMatchObject({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: 'wamid.HBgMTest',
      });
    });

    it('rejects empty messageId', async () => {
      await expect(client.markAsRead('')).rejects.toThrow(MetaInvalidParameterError);
    });
  });

  describe('getPhoneNumberInfo', () => {
    it('returns phone number info', async () => {
      nock(BASE_URL).get(`/${PHONE_ID}`).reply(200, metaPhoneNumberInfoFixture());
      const info = await client.getPhoneNumberInfo();
      expect(info.verified_name).toBeDefined();
      expect(info.code_verification_status).toBe('VERIFIED');
    });
  });

  describe('uploadMedia', () => {
    it('rejects buffer > 16MB pre-flight', async () => {
      const oversized = Buffer.alloc(17 * 1024 * 1024);
      await expect(client.uploadMedia(oversized, 'image/jpeg')).rejects.toThrow(MetaMediaTooLargeError);
    });
  });

  describe('Authorization header', () => {
    it('includes Bearer token', async () => {
      let authHeader: string | undefined = undefined;
      nock(BASE_URL)
        .post(`/${PHONE_ID}/messages`)
        .reply(function () {
          authHeader = (this.req.headers as any)['authorization'];
          return [200, metaSendSuccessFixture()];
        });
      await client.sendTemplate('212612345678', 'tpl', 'fr', []);
      expect(authHeader).toBe(`Bearer ${ACCESS_TOKEN}`);
    });
  });

  describe('Phone hashing in logs', () => {
    it('does not log raw phone number', async () => {
      const logSpy = vi.spyOn((client as any).logger, 'log');
      nock(BASE_URL).post(`/${PHONE_ID}/messages`).reply(200, metaSendSuccessFixture());
      await client.sendTemplate('212612345678', 'tpl', 'fr', []);
      const allLogStrings = logSpy.mock.calls.flat().map((arg) => JSON.stringify(arg));
      expect(allLogStrings.some((s) => s.includes('212612345678'))).toBe(false);
      expect(allLogStrings.some((s) => s.includes('recipient_phone_hashed'))).toBe(true);
    });
  });

  describe('Idempotency caveat', () => {
    it('two identical sendTemplate calls produce two distinct Meta message_ids', async () => {
      nock(BASE_URL).post(`/${PHONE_ID}/messages`).times(2).reply(200, () => metaSendSuccessFixture());
      const a = await client.sendTemplate('212612345678', 'tpl', 'fr', []);
      const b = await client.sendTemplate('212612345678', 'tpl', 'fr', []);
      expect(a.message_id).not.toBe(b.message_id);
    });
  });
});
```

### 6.10 Fichier 10 / 11 : `__tests__/integration/send-template.integration.spec.ts`

```typescript
/**
 * Sprint 9 Tache 3.2.2 -- Integration tests via local mock server.
 * Validates end-to-end with rate limiter + retry + error mapper integrated.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { ConfigService } from '@nestjs/config';
import { WhatsAppCloudApiClient } from '../../whatsapp-cloud-api.client.js';
import {
  metaSendSuccessFixture,
  metaErrorInvalidTemplateFixture,
} from '../fixtures/meta-responses.fixtures.js';

let server: Server;
let serverUrl: string = '';

function startMockServer(handler: (req: any, res: any) => void): Promise<void> {
  return new Promise((resolve) => {
    server = createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr !== 'string') {
        serverUrl = `http://127.0.0.1:${addr.port}/v21.0`;
      }
      resolve();
    });
  });
}

function stopMockServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function makeIntegrationConfig(): ConfigService {
  const map = new Map<string, string>([
    ['WHATSAPP_PHONE_NUMBER_ID', 'IT_PHONE'],
    ['WHATSAPP_ACCESS_TOKEN', 'IT_TOKEN'],
    ['WHATSAPP_API_BASE_URL', serverUrl],
    ['WHATSAPP_RATE_LIMIT_PER_SECOND', '80'],
    ['WHATSAPP_RETRY_MAX_ATTEMPTS', '3'],
    ['WHATSAPP_REQUEST_TIMEOUT_MS', '5000'],
    ['TENANT_PHONE_HASH_PEPPER', 'it-pepper'],
  ]);
  return { get: (k: string) => map.get(k) } as unknown as ConfigService;
}

describe('WhatsApp send-template integration', () => {
  let requestCount = 0;
  let responseStrategy: 'success' | 'invalidTemplate' | 'transient503then200' = 'success';

  beforeAll(async () => {
    await startMockServer((req, res) => {
      requestCount++;
      let buf = '';
      req.on('data', (c: Buffer) => (buf += c.toString()));
      req.on('end', () => {
        if (responseStrategy === 'success') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(metaSendSuccessFixture()));
          return;
        }
        if (responseStrategy === 'invalidTemplate') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(metaErrorInvalidTemplateFixture()));
          return;
        }
        if (responseStrategy === 'transient503then200') {
          if (requestCount < 2) {
            res.statusCode = 503;
            res.end('Bad Gateway');
            return;
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(metaSendSuccessFixture()));
          return;
        }
      });
    });
  });

  afterAll(async () => {
    await stopMockServer();
  });

  beforeEach(() => {
    requestCount = 0;
    responseStrategy = 'success';
  });

  it('integration : sends template successfully', async () => {
    const client = new WhatsAppCloudApiClient(makeIntegrationConfig());
    await client.onModuleInit();
    try {
      const result = await client.sendTemplate('212612345678', 'tpl', 'fr', []);
      expect(result.message_id).toMatch(/^wamid\./);
      expect(requestCount).toBe(1);
    } finally {
      await client.onModuleDestroy();
    }
  });

  it('integration : burst 100 sends respects 80/sec rate limit', async () => {
    responseStrategy = 'success';
    const client = new WhatsAppCloudApiClient(makeIntegrationConfig());
    await client.onModuleInit();
    try {
      const start = Date.now();
      await Promise.all(
        Array.from({ length: 100 }, () =>
          client.sendTemplate('212612345678', 'tpl', 'fr', []),
        ),
      );
      const elapsed = Date.now() - start;
      expect(requestCount).toBe(100);
      expect(elapsed).toBeGreaterThanOrEqual(200);
    } finally {
      await client.onModuleDestroy();
    }
  }, 30_000);

  it('integration : retry on transient 503 then succeed', async () => {
    responseStrategy = 'transient503then200';
    const client = new WhatsAppCloudApiClient(makeIntegrationConfig());
    await client.onModuleInit();
    try {
      const result = await client.sendTemplate('212612345678', 'tpl', 'fr', []);
      expect(result.message_id).toMatch(/^wamid\./);
      expect(requestCount).toBeGreaterThanOrEqual(2);
    } finally {
      await client.onModuleDestroy();
    }
  }, 30_000);
});
```

### 6.11 Fichier 11 / 11 : `__tests__/fixtures/meta-responses.fixtures.ts`

```typescript
/**
 * Sprint 9 Tache 3.2.2 -- realistic Meta API response fixtures.
 * Source : official Meta documentation examples + production samples (PII-stripped).
 */

import { randomUUID } from 'node:crypto';

export function metaSendSuccessFixture() {
  return {
    messaging_product: 'whatsapp',
    contacts: [{ input: '212612345678', wa_id: '212612345678' }],
    messages: [{ id: `wamid.HBgM${randomUUID().slice(0, 18).toUpperCase()}`, message_status: 'accepted' }],
  };
}

export function metaErrorInvalidTemplateFixture() {
  return {
    error: {
      message: 'Template name does not exist in the translation',
      type: 'OAuthException',
      code: 130,
      error_data: {
        messaging_product: 'whatsapp',
        details: 'Template: bad_tpl_name not found in language fr',
      },
      fbtrace_id: 'AbC123XyZ',
    },
  };
}

export function metaErrorPhoneNotOptedInFixture() {
  return {
    error: {
      message: 'Recipient phone number not in allowed list / not opted-in',
      type: 'OAuthException',
      code: 131,
      error_data: {
        messaging_product: 'whatsapp',
        details: 'Phone 212612345678 has not opted-in WhatsApp Business or stopped receiving',
      },
      fbtrace_id: 'DeF456UvW',
    },
  };
}

export function metaErrorTemplateNotApprovedFixture() {
  return {
    error: {
      message: 'Template has not been approved by Meta review team',
      type: 'OAuthException',
      code: 132,
      error_data: {
        messaging_product: 'whatsapp',
        details: 'Template: pending_tpl status: PENDING_REVIEW',
      },
      fbtrace_id: 'GhI789RsT',
    },
  };
}

export function metaErrorTokenExpiredFixture() {
  return {
    error: {
      message: 'Access token has expired',
      type: 'OAuthException',
      code: 190,
      error_subcode: 460,
      fbtrace_id: 'JkL012MnO',
    },
  };
}

export function metaErrorRateLimitFixture() {
  return {
    error: {
      message: 'Application request limit reached',
      type: 'OAuthException',
      code: 80007,
      error_data: {
        messaging_product: 'whatsapp',
        details: 'Rate limit hit, retry in 60s',
      },
      fbtrace_id: 'PqR345StU',
    },
  };
}

export function metaErrorWabaSuspendedFixture() {
  return {
    error: {
      message: 'WhatsApp Business Account has been suspended',
      type: 'OAuthException',
      code: 100,
      error_subcode: 33,
      fbtrace_id: 'VwX678YzA',
    },
  };
}

export function metaPhoneNumberInfoFixture() {
  return {
    id: '999_TEST_PHONE_ID',
    verified_name: 'Skalean InsurTech',
    code_verification_status: 'VERIFIED',
    display_phone_number: '+212 6 12 34 56 78',
    quality_rating: 'GREEN',
    name_status: 'APPROVED',
  };
}

export function metaMediaUploadFixture() {
  return { id: `${Date.now()}_MEDIA_ID` };
}

export function metaMediaUrlFixture(mediaId: string) {
  return {
    url: `https://lookaside.fbsbx.com/whatsapp_business/attachments/?mid=${mediaId}`,
    mime_type: 'image/jpeg',
    sha256: 'abc123',
    file_size: 12345,
    id: mediaId,
    messaging_product: 'whatsapp',
  };
}
```

---

## 7. Tests complets

### 7.1 Liste des 30 tests Vitest

**Unit tests `whatsapp-cloud-api.client.spec.ts` (24 tests)**

1. `sendTemplate happy path returns message_id`
2. `sendTemplate rejects phone with + prefix (Meta requires no +)`
3. `sendTemplate rejects phone with non-digits / dashes / spaces`
4. `sendTemplate rejects empty templateName`
5. `sendTemplate rejects empty languageCode`
6. `sendTemplate builds correct Meta JSON body shape`
7. `sendTemplate variables interpolated dans components.body.parameters[]`
8. `sendTemplate maps Meta error code 130 -> MetaInvalidTemplateError`
9. `sendTemplate maps Meta error code 131 -> MetaPhoneNotOptedInError`
10. `sendTemplate maps Meta error code 132 -> MetaTemplateNotApprovedError`
11. `sendTemplate maps HTTP 401 / code 190 -> MetaAccessTokenExpiredError`
12. `sendTemplate maps HTTP 403 -> MetaWaBaSuspendedError`
13. `sendTemplate maps HTTP 429 -> MetaRateLimitError with retryAfterSeconds`
14. `sendTemplate retries 3 times on 503 transient (Meta CDN)`
15. `sendTemplate fail-fast on 400 invalid template (no retry)`
16. `sendTemplate succeeds after 1 transient 503 retry`
17. `sendText rejects empty body`
18. `sendText rejects body > 4096 chars`
19. `sendText sends free-form text within 24h session window`
20. `sendText attaches context.message_id when provided (reply-to)`
21. `markAsRead sends status=read body shape`
22. `markAsRead rejects empty messageId`
23. `getPhoneNumberInfo returns phone info shape`
24. `uploadMedia rejects > 16MB pre-flight (no API call)`
25. `Authorization header includes Bearer access token`
26. `Logs do NOT contain raw recipient phone (PII hashed)`
27. `Two identical sendTemplate calls produce two distinct Meta message_ids (no idempotency)`

**Integration tests `send-template.integration.spec.ts` (3 tests)**

28. `Sends template successfully via local HTTP mock`
29. `Burst 100 sends respects 80/sec rate limit (Bottleneck linearizes >= 200ms)`
30. `Retry on transient 503 then succeed`

### 7.2 Cas additionnels (couverts par les 30 mais explicitly tested)

- Mock client interface symmetry : `MockWhatsAppCloudApiClient` implements all 6 methods of `IWhatsAppCloudApiClient` (compile-time TS check + runtime assertion via separate `mock-real-symmetry.spec.ts`).
- Mock simulate flags : `simulateRateLimit=true` -> next sendTemplate throws `MetaRateLimitError`.
- Mock collects calls : `mockClient.sentTemplates.length === N` after N sends.

### 7.3 Test : mock-real symmetry

```typescript
// repo/packages/comm/src/providers/whatsapp/__tests__/mock-real-symmetry.spec.ts
import { describe, it, expect } from 'vitest';
import { WhatsAppCloudApiClient } from '../whatsapp-cloud-api.client.js';
import { MockWhatsAppCloudApiClient } from '../mock-whatsapp.client.js';

describe('mock-real symmetry', () => {
  it('MockWhatsAppCloudApiClient implements all 6 IWhatsAppCloudApiClient methods', () => {
    const realProto = WhatsAppCloudApiClient.prototype;
    const mockProto = MockWhatsAppCloudApiClient.prototype;
    const required = ['sendTemplate', 'sendText', 'markAsRead', 'getPhoneNumberInfo', 'uploadMedia', 'downloadMedia'];
    for (const m of required) {
      expect(typeof (realProto as any)[m]).toBe('function');
      expect(typeof (mockProto as any)[m]).toBe('function');
    }
  });
});
```

### 7.4 Test : mock simulation flags

```typescript
// repo/packages/comm/src/providers/whatsapp/__tests__/mock-flags.spec.ts
import { describe, it, expect } from 'vitest';
import { MockWhatsAppCloudApiClient } from '../mock-whatsapp.client.js';
import {
  MetaRateLimitError,
  MetaInvalidTemplateError,
  MetaPhoneNotOptedInError,
  MetaTemplateNotApprovedError,
  MetaAccessTokenExpiredError,
  MetaParameterCountMismatchError,
  MetaWaBaSuspendedError,
  MetaInvalidWaBaError,
} from '../errors.js';

describe('MockWhatsAppCloudApiClient flags', () => {
  let mock: MockWhatsAppCloudApiClient;
  beforeEach(() => {
    mock = new MockWhatsAppCloudApiClient();
  });

  it('simulateRateLimit throws MetaRateLimitError', async () => {
    mock.flags.simulateRateLimit = true;
    await expect(mock.sendTemplate('212612345678', 't', 'fr', [])).rejects.toThrow(MetaRateLimitError);
  });

  it('simulateInvalidTemplate throws MetaInvalidTemplateError', async () => {
    mock.flags.simulateInvalidTemplate = true;
    await expect(mock.sendTemplate('212612345678', 't', 'fr', [])).rejects.toThrow(MetaInvalidTemplateError);
  });

  it('simulatePhoneNotOptedIn throws MetaPhoneNotOptedInError', async () => {
    mock.flags.simulatePhoneNotOptedIn = true;
    await expect(mock.sendTemplate('212612345678', 't', 'fr', [])).rejects.toThrow(MetaPhoneNotOptedInError);
  });

  it('simulateTemplateNotApproved throws MetaTemplateNotApprovedError', async () => {
    mock.flags.simulateTemplateNotApproved = true;
    await expect(mock.sendTemplate('212612345678', 't', 'fr', [])).rejects.toThrow(MetaTemplateNotApprovedError);
  });

  it('simulateAccessTokenExpired throws MetaAccessTokenExpiredError', async () => {
    mock.flags.simulateAccessTokenExpired = true;
    await expect(mock.sendTemplate('212612345678', 't', 'fr', [])).rejects.toThrow(MetaAccessTokenExpiredError);
  });

  it('simulateParameterCountMismatch throws MetaParameterCountMismatchError', async () => {
    mock.flags.simulateParameterCountMismatch = true;
    await expect(mock.sendTemplate('212612345678', 't', 'fr', [])).rejects.toThrow(MetaParameterCountMismatchError);
  });

  it('simulateWaBaSuspended throws MetaWaBaSuspendedError', async () => {
    mock.flags.simulateWaBaSuspended = true;
    await expect(mock.sendTemplate('212612345678', 't', 'fr', [])).rejects.toThrow(MetaWaBaSuspendedError);
  });

  it('simulateInvalidWaBa throws MetaInvalidWaBaError', async () => {
    mock.flags.simulateInvalidWaBa = true;
    await expect(mock.sendTemplate('212612345678', 't', 'fr', [])).rejects.toThrow(MetaInvalidWaBaError);
  });

  it('without flags : success returns mock message_id', async () => {
    const r = await mock.sendTemplate('212612345678', 'tpl', 'fr', []);
    expect(r.message_id).toMatch(/^wamid\.MOCK_/);
  });

  it('collects sent templates for assertions', async () => {
    await mock.sendTemplate('212612345678', 'tpl_a', 'fr', []);
    await mock.sendTemplate('212699999999', 'tpl_b', 'ar', []);
    expect(mock.sentTemplates.length).toBe(2);
    expect(mock.sentTemplates[0]!.templateName).toBe('tpl_a');
    expect(mock.sentTemplates[1]!.languageCode).toBe('ar');
  });
});
```

### 7.5 Strategy Vitest config

```typescript
// repo/packages/comm/vitest.config.ts (extension Sprint 5 base)
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/providers/whatsapp/**/*.ts'],
      exclude: ['**/*.spec.ts', '**/__tests__/**', '**/types.ts'],
      thresholds: { lines: 92, functions: 92, branches: 88, statements: 92 },
    },
    testTimeout: 60_000,
  },
});
```

---

## 8. Variables environnement

```env
# Sprint 9 Tache 3.2.2 -- WhatsApp Cloud API Client (Meta v21.0)

# Phone Number ID assigne par Meta Business Manager (Sprint 27 admin UI integrera)
WHATSAPP_PHONE_NUMBER_ID=                                # ex: 105944122355622

# System User Permanent Access Token (60 jours TTL recommande)
# IMPORTANT : NE JAMAIS commit cette valeur. Loggue masque ***ssed***
WHATSAPP_ACCESS_TOKEN=                                   # ex: EAAGm0PX4ZCpsBO...

# App Secret Meta -- usage : verification HMAC webhooks (Tache 3.2.4)
# Inclus ici pour completude, valide par schema Zod du package
WHATSAPP_APP_SECRET=

# Meta Cloud API base URL (rarement override sauf staging custom)
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v21.0

# Rate limit Meta : 80 msg/sec/phone_number_id (Tier 1)
# Tier 2 = 1000 msg/sec, Tier 3 = 10000 msg/sec, Tier 4 = unlimited
# Contact Meta Business pour upgrade tier (Sprint 14+ scaling)
WHATSAPP_RATE_LIMIT_PER_SECOND=80

# Retry policy : 3 attempts default avec backoff 1s/5s/30s
WHATSAPP_RETRY_MAX_ATTEMPTS=3

# Request timeout : 30s default (Meta CDN parfois lent peak hours 14h-18h CET)
WHATSAPP_REQUEST_TIMEOUT_MS=30000

# Provider mode : real (production / staging) | mock (dev / test / CI)
WHATSAPP_PROVIDER_MODE=real

# Phone hash pepper : sha256(phone + tenantId + pepper) -- conformite CNDP loi 09-08
# Rotate Sprint 35 puis annuel
TENANT_PHONE_HASH_PEPPER=skalean-rotate-sprint-35-randomized
```

Schema Zod env loader (`repo/packages/config/src/env.schema.ts` Sprint 5 elargi) :

```typescript
import { z } from 'zod';

export const WhatsAppEnvSchema = z.object({
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().min(20).optional(),
  WHATSAPP_APP_SECRET: z.string().min(10).optional(),
  WHATSAPP_API_BASE_URL: z.string().url().default('https://graph.facebook.com/v21.0'),
  WHATSAPP_RATE_LIMIT_PER_SECOND: z.coerce.number().int().min(1).max(10000).default(80),
  WHATSAPP_RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  WHATSAPP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
  WHATSAPP_PROVIDER_MODE: z.enum(['real', 'mock']).default('real'),
  TENANT_PHONE_HASH_PEPPER: z.string().min(8),
});
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Add dependencies
pnpm --filter @insurtech/comm add undici@7.1.1 bottleneck@2.19.5
pnpm --filter @insurtech/comm add -D nock@13.5.6

# 2. Build / typecheck / lint
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check

# 3. Run unit tests
pnpm --filter @insurtech/comm test src/providers/whatsapp/whatsapp-cloud-api.client.spec.ts

# 4. Run integration tests (local HTTP mock server)
pnpm --filter @insurtech/comm test src/providers/whatsapp/__tests__/integration

# 5. Run mock + symmetry tests
pnpm --filter @insurtech/comm test src/providers/whatsapp/__tests__/mock-flags.spec.ts
pnpm --filter @insurtech/comm test src/providers/whatsapp/__tests__/mock-real-symmetry.spec.ts

# 6. Coverage
pnpm --filter @insurtech/comm test:coverage

# 7. Build package
pnpm --filter @insurtech/comm build

# 8. Healthcheck Meta API config (manual smoke test, real env)
WHATSAPP_PROVIDER_MODE=real \
WHATSAPP_PHONE_NUMBER_ID=xxx \
WHATSAPP_ACCESS_TOKEN=yyy \
node -e "import('./packages/comm/dist/providers/whatsapp/index.js').then(async ({WhatsAppCloudApiClient}) => { const c = new WhatsAppCloudApiClient({get:(k)=>process.env[k]}); await c.onModuleInit(); console.log(JSON.stringify(await c.getPhoneNumberInfo(), null, 2)); await c.onModuleDestroy(); })"
```

---

## 10. Criteres validation V1-V25

### P0 (15)

- **V1** : `pnpm typecheck` passe sans erreur sur `packages/comm/src/providers/whatsapp/**`.
- **V2** : `pnpm build` produit `dist/providers/whatsapp/*.js` + `*.d.ts`.
- **V3** : Tous les 30+ tests Vitest passent (unit + integration + mock-flags + mock-real-symmetry).
  - **Commande** : `pnpm --filter @insurtech/comm test src/providers/whatsapp`
  - **Expected** : `Tests: 30 passed (30)` minimum.
  - **Failure mode** : un test echoue -> investigation log + correction patron correspondant Section 6.
- **V4** : `WhatsAppCloudApiClient` expose les 6 methods publiques : sendTemplate, sendText, markAsRead, getPhoneNumberInfo, uploadMedia, downloadMedia. Verifie via reflection :
  - **Commande** : `node -e "console.log(Object.getOwnPropertyNames(require('./packages/comm/dist/providers/whatsapp/whatsapp-cloud-api.client.js').WhatsAppCloudApiClient.prototype))"`
  - **Expected** : array contient les 6 noms.
- **V5** : sendTemplate construit body Meta JSON shape exact : `{messaging_product, to, type:'template', template:{name, language:{code}, components}}`.
  - **Test** : `whatsapp-cloud-api.client.spec.ts > "builds correct Meta request body"`.
- **V6** : Phone E.164 sans `+` strict (`/^\d{10,15}$/`). Phone avec `+` rejete `MetaInvalidParameterError`.
  - **Test** : `"rejects phone with + prefix"`.
- **V7** : Variables interpolees dans `components.body.parameters[]` order-preserved.
  - **Test** : `"variables interpolated dans components"`.
- **V8** : Retry 3x sur 5xx avec backoff 1s/5s/30s + jitter +/- 20%.
  - **Test** : `"retries 3 times on 503 transient"`.
  - **Curl mock simul** : `nock(...).post(...).times(3).reply(503)`.
- **V9** : Fail-fast sur 4xx (no retry).
  - **Test** : `"does NOT retry on 400 invalid template"`.
- **V10** : Rate limit 80/sec respecte via Bottleneck.
  - **Test** : `"burst 100 sends respects 80/sec rate limit"` -> elapsed >= 200ms (linearization minimum).
- **V11** : Error code mapping exhaustif Meta -> typed error :
  - 130 -> `MetaInvalidTemplateError`
  - 131 -> `MetaPhoneNotOptedInError`
  - 132 -> `MetaTemplateNotApprovedError`
  - 190 -> `MetaAccessTokenExpiredError`
  - 80007 / 130429 / 131056 / HTTP 429 -> `MetaRateLimitError`
  - HTTP 403 -> `MetaWaBaSuspendedError`
  - 132012 -> `MetaParameterCountMismatchError`
  - 100 -> `MetaInvalidParameterError`
  - **Test** : 8 tests dans `error-mapping` describe block.
- **V12** : `MockWhatsAppCloudApiClient` implements `IWhatsAppCloudApiClient` (interface symmetry).
  - **Test** : `mock-real-symmetry.spec.ts`.
- **V13** : Mock flags simulate les 8 errors typees + collects `sentTemplates`.
  - **Test** : `mock-flags.spec.ts` (10 tests).
- **V14** : Authorization header `Bearer ${accessToken}` envoye sur chaque request.
  - **Test** : `"Authorization header includes Bearer token"`.
- **V15** : Logs Pino structures emis sur succes ET sur erreur, AVEC `recipient_phone_hashed` (jamais le phone brut).
  - **Test** : `"Logs do NOT contain raw recipient phone (PII hashed)"`.

### P1 (8)

- **V16** : `WHATSAPP_ACCESS_TOKEN` jamais loggue en clair, masque format `EAAG***xxxx`.
  - **Verification** : `grep -r "WHATSAPP_ACCESS_TOKEN" packages/comm/src && fail_if_not_masked`.
- **V17** : `WhatsAppModule` Global, factory provider mode=real|mock via env.
- **V18** : `uploadMedia` rejet pre-validation > 16MB sans appel Meta inutile.
  - **Test** : `"rejects buffer > 16MB pre-flight"`.
- **V19** : `downloadMedia` 2-step (GET media metadata -> GET binary URL).
- **V20** : Coverage `src/providers/whatsapp/**` >= 92% lines.
- **V21** : No emoji dans tous fichiers crees (`grep -rP "[\x{1F300}-\x{1F9FF}]"` retourne 0).
- **V22** : No `console.log` (uniquement Pino logger via NestJS).
- **V23** : Documentation JSDoc presente sur chaque method publique + chaque error class.

### P2 (5)

- **V24** : Meta error responses non-JSON (HTML 502 from CDN) gerees via try/catch JSON.parse -> retriable.
- **V25** : Bench p99 sendTemplate (mock SMTP) < 200ms en mode real avec local HTTP server.
- **V26** : Bottleneck `getStats()` retourne `{queued, running, done}` correctement.
- **V27** : Memory leak test : 1000 sends sequentiels -> RSS stable +/- 5MB.
- **V28** : Sprint 14+ readiness : interface IWhatsAppCloudApiClient permet swap implementation sans changement consommateur.

---

## 11. Edge cases (12)

1. **Meta API down (HTTP 502 cloudflare HTML body, pas JSON)** : `JSON.parse` throw -> wrapper traite comme `error.message=text body` -> 5xx retriable -> retry 1s/5s/30s. Si toujours 5xx apres 3 attempts : propage `MetaApiError retryable=true` -> WaSendWorker DLQ Kafka.
2. **Token Bearer expire (HTTP 401 + code 190)** : `MetaAccessTokenExpiredError` non-retriable -> WaSendWorker `onFailed` detecte instanceof -> Kafka publish `comm.alert.token_expired` -> Sprint 33 alert ops Slack channel `#alerts-prod`.
3. **Phone E.164 mal formate (`+212-612-345-678`)** : Tache 3.2.1 helper normalise avant -- mais defense en profondeur ici : Zod schema rejette via `META_PHONE_E164_REGEX = /^\d{10,15}$/`. Caller voit `MetaInvalidParameterError` immediate, pas d'appel Meta inutile.
4. **Template name typo (`pollice_signed_confirmation`)** : Meta retourne 400 code 130 -> `MetaInvalidTemplateError(templateName='pollice_signed_confirmation')` -> log warn + WaSendWorker DLQ (pas retry, deterministe).
5. **Variables count mismatch (template attend 3 `{{1}}{{2}}{{3}}`, fournit 2)** : Meta retourne 400 code 132012 -> `MetaParameterCountMismatchError(expected=3, actual=2)` -> log error + DLQ + audit trail Sprint 6 -> orchestrator marque `comm_messages.fail_reason='param_mismatch'`.
6. **Body > 1024 chars Meta reject** : Meta retourne 400 code 131056 (ou 132012) -> map vers `MetaApiError`. La Tache 3.2.3 renderer doit valider longueur APRES interpolation variables. Defense en profondeur ici.
7. **Rate limit 80/sec depasse en burst** : Bottleneck queue les overflow jusqu'a `highWater=1000` puis rejette low-priority avec `BottleneckError`. WaSendWorker catch -> retry queue BullMQ delayed 1s.
8. **Network timeout undici default 30s** : `pool.request` throw `BodyTimeoutError` ou `HeadersTimeoutError` -> non-MetaApiError -> attrape dans retry loop comme generic error -> retry. Si 3 fois timeout -> propage erreur originale.
9. **WhatsApp Business Account suspended (HTTP 403)** : `MetaWaBaSuspendedError` retryable=false -> alert ops critique Sprint 33 -> tous sends WA suspendus jusqu'a unsuspension manual.
10. **Phone valide mais utilisateur n'a pas WhatsApp installe** : Meta retourne code 131 -> `MetaPhoneNotOptedInError` -> Tache 3.2.11 opt-out service auto-add ce phone a `comm_optouts(channel='whatsapp', source='auto', reason='phone_not_on_whatsapp')` pour eviter retentatives futures.
11. **Concurrency 100 sends en burst (sendBroadcast)** : Bottleneck linearize -> 100 / 80 = 1.25s minimum elapsed. Verifie test V10. Si env `WHATSAPP_RATE_LIMIT_PER_SECOND=1000` (Tier 2 upgrade), linearization minimale 0.1s.
12. **uploadMedia file > 16MB** : Pre-validation rejette `MetaMediaTooLargeError(sizeBytes=N)` AVANT appel Meta. Caller (Sprint 11 DocsModule) doit gerer downscale ou refuse.

Edge cases supplementaires (defense en profondeur) :

13. **downloadMedia URL expiree (5min TTL)** : Meta retourne 403 sur lookaside.fbsbx.com -> propage `MetaApiError httpStatus=403` -> caller doit re-call `getMediaMetadata` pour url frais.
14. **Multi-tenant : meme phone_number_id partage** : Sprint 9 single phone shared. Logs incluent `tenant_id` via context Sprint 3.
15. **Concurrent close pool** : `onModuleDestroy` pendant requests in-flight -> `pool.close()` attend graceful 30s avant force.
16. **Pool exhaustion (10 connections)** : 11eme request queue -> latence +50ms. Sprint 14+ scale `connections=20`.

---

## 12. Conformite Maroc

### 12.1 Loi 09-08 CNDP (Protection donnees personnelles)

- **Article 12 (anonymisation)** : recipient phone HASHE SHA-256 + tenant_pepper dans tous logs. Le hash est non-reversible (sauf bruteforce + pepper compromis). Loi 09-08 article 12 exige minimisation collecte donnees.
- **Article 28 (droit acces / opposition)** : opt-in explicite obligatoire avant FIRST WhatsApp template send (Tache 3.2.11 OptOut service gere). Exception : utilisateur a initie la conversation (24h session window) -> opt-in implicite.
- **Article 27 (notification breach)** : si MetaAccessTokenExpiredError detecte + tokens leakes hypothetiquement -> Sprint 33 alert + 72h notification CNDP via `support@skalean.ma`.

### 12.2 Loi marketing direct MA

- **Restriction horaires B2C** : sollicitations marketing interdites hors 8h-21h heure Casablanca (Africa/Casablanca timezone). Cette tache : pas applicable directement (juste send technique). C'est l'orchestrator Tache 3.2.9 qui verifie `now() in [08:00, 21:00]` pour templates `category='marketing'`. Templates `category='transactional'` (verify-email, password-reset, appointment-reminder) sont OK 24/7.
- **Tracking** : audit trail Sprint 6 enregistre chaque send avec `tenant_id`, `recipient_phone_hashed`, `template_name`, `category`, `sent_at` -> requete CNDP audit recevable.

### 12.3 ACAPS (Authorite controle assurances)

- **Article 234 Code Assurances MA** : preuve communication contractuelle (devis, police signed) doit etre archivable >= 10 ans. Le `provider_message_id` Meta retourne ici est stocke `comm_messages.provider_message_id` Tache 3.2.1 -> archivage Sprint 11 DocsModule -> retention 10 ans S3-compatible glacier-equivalent.

### 12.4 Meta Business Compliance

- **Templates pre-approved obligatoire** : workflow Meta Business Manager review template content. Cette tache verifie via `validateMetaApproved` Tache 3.2.3 avant call.
- **Quality rating monitoring** : `getPhoneNumberInfo()` retourne `quality_rating: 'GREEN' | 'YELLOW' | 'RED'`. Sprint 9 Tache 3.2.10 alerts sur YELLOW/RED -> degradation deliverability + risque suspension Meta.

---

## 13. Conventions absolues

- **Multi-tenant** : tenant_id propage dans logs via parametre options optional ; pas requis dans methods (le client est singleton phone_number_id global Sprint 9 ; Sprint 14+ multi-WABA).
- **Validation** : Zod schema env loader Sprint 5 elargi ; runtime validation entree minimum (defense en profondeur) phone E.164, body length, mediaSize.
- **Logger Pino** : niveau info pour succes, warn pour retry, error pour fail-fast. Champs structures : `msg`, `duration_ms`, `status`, `message_id`, `template_name`, `language`, `recipient_phone_hashed`, `tenant_id`, `correlation_id`, `error_class`, `error_message`, `retryable`.
- **PII masking** : phone hashed, token `EAAG***xxxx`, jamais raw payload Meta dans logs (sauf level=debug en dev).
- **pnpm** : pnpm workspace monorepo. `pnpm --filter @insurtech/comm`.
- **TS strict** : `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`.
- **Tests 30+** : 24 unit + 3 integration + 8 mock + 1 symmetry = 36 minimum.
- **Skalean AI** : aucun (pas de IA ici, juste HTTP client).
- **No-emoji** : strict (decision-006).
- **No-console** : strict (decision-024).
- **Idempotency** : NON applicable niveau client (Meta n'expose pas idempotency_key header). Documente. Tache 3.2.9 orchestrator gere via `comm_messages.status` lookup.
- **Cloud souverain** : Meta API est non-souverain ; mitigation via opt-in CNDP + hash phone.
- **Crypto** : SHA-256 phone hash (Node native crypto).
- **JSDoc** : oui sur chaque method publique + chaque error class avec `@throws` documente.
- **Performance** : sendTemplate p99 < 200ms mock local, < 500ms vrai Meta CDN (Marseille).

---

## 14. Validation pre-commit

```bash
cd repo

# 1. Typecheck
pnpm --filter @insurtech/comm typecheck

# 2. Lint
pnpm --filter @insurtech/comm lint:check

# 3. Tests
pnpm --filter @insurtech/comm test src/providers/whatsapp

# 4. Coverage threshold
pnpm --filter @insurtech/comm test:coverage -- --reporter=text \
  | grep -E "All files.*9[2-9]|All files.*100" || (echo "COVERAGE BELOW 92%" && exit 1)

# 5. No emoji check (Unicode emoji ranges)
if grep -rP "[\x{1F300}-\x{1F9FF}\x{2600}-\x{27BF}]" packages/comm/src/providers/whatsapp/; then
  echo "EMOJI DETECTED"; exit 1
fi
echo "OK no emoji"

# 6. No console.log
if grep -rn "console\.\(log\|error\|warn\|info\|debug\)" packages/comm/src/providers/whatsapp/ --include="*.ts" | grep -v ".spec.ts" | grep -v "logger\."; then
  echo "console.* DETECTED"; exit 1
fi
echo "OK no console"

# 7. No raw token in logs
if grep -rn "WHATSAPP_ACCESS_TOKEN" packages/comm/src/providers/whatsapp/ --include="*.ts" | grep -v "config.get" | grep -v "// "; then
  echo "POTENTIAL TOKEN LEAK"; exit 1
fi
echo "OK no token leak"

# 8. Verify all 11 files present
REQUIRED_FILES=(
  "packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.ts"
  "packages/comm/src/providers/whatsapp/mock-whatsapp.client.ts"
  "packages/comm/src/providers/whatsapp/types.ts"
  "packages/comm/src/providers/whatsapp/errors.ts"
  "packages/comm/src/providers/whatsapp/error-mapper.ts"
  "packages/comm/src/providers/whatsapp/rate-limiter.helper.ts"
  "packages/comm/src/providers/whatsapp/whatsapp.module.ts"
  "packages/comm/src/providers/whatsapp/index.ts"
  "packages/comm/src/providers/whatsapp/whatsapp-cloud-api.client.spec.ts"
  "packages/comm/src/providers/whatsapp/__tests__/integration/send-template.integration.spec.ts"
  "packages/comm/src/providers/whatsapp/__tests__/fixtures/meta-responses.fixtures.ts"
)
for f in "${REQUIRED_FILES[@]}"; do
  [ -f "$f" ] || (echo "MISSING $f" && exit 1)
done
echo "All 11 required files present"

# 9. Verify package.json dependencies
node -e "const pkg = require('./packages/comm/package.json'); const ok = pkg.dependencies?.undici === '7.1.1' && pkg.dependencies?.bottleneck === '2.19.5' && pkg.devDependencies?.nock; if (!ok) { console.error('Missing deps'); process.exit(1); } console.log('OK deps');"

# 10. Build
pnpm --filter @insurtech/comm build
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-09): implement WhatsApp Cloud API client Meta v21.0 (Tache 3.2.2)

Production-ready TypeScript client for Meta WhatsApp Business Platform Cloud
API v21.0 with undici 7.1.1 HTTP transport, Bottleneck 80/sec rate limiter
respecting Meta hard limit per phone_number_id, custom retry exponential
1s/5s/30s + jitter on 5xx transient, fail-fast on 4xx, comprehensive error
mapping (12 Meta codes -> 8 typed error sub-classes), and interface-equivalent
mock client for tests + dev mode.

Methods (6) :
- sendTemplate(to, name, lang, components) : HSM via pre-approved template
- sendText(to, body, contextMessageId?) : free-form within 24h session
- markAsRead(messageId) : double blue ticks
- getPhoneNumberInfo() : config healthcheck
- uploadMedia(buffer, mimeType, filename?) : binary asset to Meta CDN
- downloadMedia(mediaId) : 2-step download from lookaside.fbsbx.com

Typed errors (8) :
- MetaRateLimitError, MetaInvalidTemplateError, MetaPhoneNotOptedInError,
  MetaTemplateNotApprovedError, MetaInvalidWaBaError,
  MetaAccessTokenExpiredError, MetaParameterCountMismatchError,
  MetaWaBaSuspendedError

Configuration :
- WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET
- WHATSAPP_API_BASE_URL (default https://graph.facebook.com/v21.0)
- WHATSAPP_RATE_LIMIT_PER_SECOND (80), WHATSAPP_RETRY_MAX_ATTEMPTS (3)
- WHATSAPP_REQUEST_TIMEOUT_MS (30000), WHATSAPP_PROVIDER_MODE (real|mock)

Compliance :
- Recipient phone hashed SHA-256 + tenant_pepper in logs (CNDP loi 09-08 art 12)
- Access token masked EAAG***xxxx (no raw token in logs)
- Multi-tenant context propagation via options.tenantId

Tests : 24 unit + 3 integration + 10 mock-flags + 1 mock-real-symmetry = 38
Coverage : >= 92%

Livrables :
- WhatsAppCloudApiClient (~280 lines)
- MockWhatsAppCloudApiClient (~150 lines, interface-equivalent)
- types.ts (~120 lines Meta API types)
- errors.ts (~80 lines, 8 typed sub-classes)
- error-mapper.ts (~120 lines, 12 Meta codes mapping)
- rate-limiter.helper.ts (~80 lines, Bottleneck wrapper)
- whatsapp.module.ts (~50 lines, NestJS Global factory mode=real|mock)
- 38 tests Vitest passing

Task: 3.2.2
Sprint: 9 (Phase 3 / Sprint 2)
Reference: B-09 Tache 3.2.2
Decisions: decision-006 (no-emoji), decision-014 (Pino), decision-021 (multi-tenant), decision-024 (no-console)
Depends-on: 3.2.1 (comm_messages entity + Zod schemas)
Unblocks: 3.2.3, 3.2.4, 3.2.5, 3.2.8, 3.2.9, 3.2.13"
```

---

## 16. Workflow next step

Apres commit reussi de Tache 3.2.2, passer a **`task-3.2.3-wa-template-renderer-3-locales.md`** qui implementera le service `WaTemplateRendererService` :
- Lookup `comm_templates` table par `(tenant_id, name, language)`
- Parse template body avec placeholders `{{var_name}}` (named) + map vers ordered Meta `{{1}}, {{2}}` format
- Validate variables required via Zod schema serialise dans `comm_templates.variables_schema` jsonb
- Method `validateMetaApproved(templateName, locale): boolean` consume cote orchestrator Tache 3.2.9
- 3 locales (`fr`, `ar-MA` mappe vers Meta `ar`, `ar`) avec fallback locale documente per template
- Cache Redis 5min par template + invalidation Kafka event `comm.template_updated`
- Inject `WhatsAppCloudApiClient` (cette tache) pour test integration end-to-end render -> send

La sortie de Tache 3.2.3 sera consume par Tache 3.2.5 (Template Manager + 60 templates seed) puis Tache 3.2.8 (WaSendWorker chaine renderer + client).

---

## Annexe A. Pattern HSM (Highly Structured Message) Meta complet

Meta exige les templates pre-approved structures avec composants HSM precis. Exemple `police_signed_confirmation` :

**Template approved Meta Business Manager (review 24-48h)** :

```
Header (type=text) : "Police signee"
Body : "Bonjour {{1}}, votre police {{2}} est signee. Date effet : {{3}}. Telecharger : {{4}}"
Footer : "Skalean InsurTech -- support@skalean.ma"
Buttons :
  - Quick Reply 0 : "Voir details"
  - URL 1 : "Telecharger PDF" -> https://app.skalean.ma/policies/{{1}}/pdf
```

**Code patron utilisation** :

```typescript
import { WhatsAppCloudApiClient } from '@insurtech/comm';

const client = new WhatsAppCloudApiClient(config);
await client.onModuleInit();

const components: MetaTemplateComponents = [
  {
    type: 'header',
    parameters: [{ type: 'text', text: 'POL-2026-001' }],
  },
  {
    type: 'body',
    parameters: [
      { type: 'text', text: 'Mohamed Alaoui' },                          // {{1}}
      { type: 'text', text: 'POL-2026-001' },                            // {{2}}
      { type: 'date_time', date_time: { fallback_value: '01/02/2026' } }, // {{3}}
      { type: 'text', text: 'https://app.skalean.ma/policies/abc/pdf' }, // {{4}}
    ],
  },
  {
    type: 'button',
    sub_type: 'url',
    index: '1',
    parameters: [{ type: 'text', text: 'POL-2026-001' }],
  },
];

const result = await client.sendTemplate(
  '212612345678',
  'police_signed_confirmation',
  'fr',
  components,
  { tenantId: 'tenant_abc', correlationId: 'corr_xyz' },
);
console.log(result.message_id); // wamid.HBgM...
```

---

## Annexe B. Pattern 24h session window

Apres qu'un utilisateur envoie un message entrant (incoming via Tache 3.2.4 webhook), Meta ouvre une fenetre **24h roulante** pendant laquelle le broker peut envoyer des messages **free-form text** (pas seulement HSM templates). Cas d'usage : conversational support, devis follow-up.

**Detection cote orchestrator Tache 3.2.9** :

```typescript
// Pseudocode orchestrator
const lastInbound = await contactsRepo.getLastInboundAt(contactId, 'whatsapp');
const sessionOpen = lastInbound && (Date.now() - lastInbound.getTime()) < 24 * 3600 * 1000;

if (sessionOpen) {
  // Free-form text autorise
  await waClient.sendText(contact.phone, 'Merci pour votre message, un conseiller revient vers vous sous 30 min.', {
    contextMessageId: lastInboundMessageId,  // optional reply-to
    tenantId,
  });
} else {
  // Hors fenetre : HSM template uniquement
  await waClient.sendTemplate(contact.phone, 'response_outside_session', 'fr', components, { tenantId });
}
```

**Edge case Sprint 30+ AI conversational** : le chatbot decide automatiquement entre `sendText` (intra-fenetre) et `sendTemplate` (hors fenetre) en consultant `last_inbound_at`.

---

## Annexe C. Performance benchmarks attendus

```
Sprint 9 Tache 3.2.2 -- benchmarks (mock local HTTP server) :

WhatsAppCloudApiClient.sendTemplate (mock) :
  median   : 12 ms
  p95      : 35 ms
  p99      : 78 ms
  p99.9    : 145 ms
  -- dominated by JSON parse + Bottleneck schedule + Pool.request

WhatsAppCloudApiClient.sendTemplate (real Meta CDN Marseille via Casablanca) :
  median   : 110 ms  (network 80ms one-way * 2 = 160ms - keepalive saving = ~110ms)
  p95      : 250 ms
  p99      : 450 ms
  p99.9    : 800 ms

Burst 100 sends (rate limit 80/sec) :
  Total elapsed : 1280 ms minimum (Bottleneck linearizes 80/sec)
  Throughput     : 78 msg/sec sustained
  Error rate     : 0% (queue overflow at 1000+ jobs only)

Burst 1000 sends (above queue 1000) :
  Bottleneck strategy=OVERFLOW_PRIORITY
  Low-priority jobs rejected after 1000 queued -> caller catch + retry BullMQ delayed

uploadMedia (1MB JPEG) :
  median   : 350 ms
  p99      : 850 ms
  -- multipart form-data upload to graph.facebook.com

downloadMedia (1MB JPEG) :
  median   : 180 ms (lookaside.fbsbx.com keep-alive)
  p99      : 420 ms

Memory footprint :
  - WhatsAppCloudApiClient instance : ~2 MB
  - Pool 10 connections : ~5 MB
  - Bottleneck reservoir + queue : ~1 MB
  - Total : ~8 MB stable +/- 2 MB GC

Token verification (getPhoneNumberInfo) :
  median   : 95 ms
  Sprint 9 Tache 3.2.2 startup adds ~100ms healthcheck via /health/wa endpoint Sprint 9 Tache 3.2.12
```

---

## Annexe D. Migration vers BSP MA-souverain Sprint 35+

Si emerge un BSP (Business Service Provider) WhatsApp souverain Maroc Sprint 35+ (cf decision-008), la migration sera transparente grace a l'interface `IWhatsAppCloudApiClient`. Le caller (orchestrator + workers) consomme l'interface, pas la classe concrete.

```typescript
// Sprint 35+ swap implementation transparently
@Module({
  providers: [
    {
      provide: WHATSAPP_CLIENT_TOKEN,
      useFactory: (config: ConfigService) => {
        const provider = config.get('WHATSAPP_PROVIDER');
        switch (provider) {
          case 'meta-direct':
            return new WhatsAppCloudApiClient(config);
          case 'maroc-bsp-tbd':           // Sprint 35+ futur
            return new MarocBspWhatsAppClient(config);
          case 'mock':
            return new MockWhatsAppCloudApiClient();
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
      },
    },
  ],
})
export class WhatsAppModule {}
```

Aucun changement consommateur Tache 3.2.3, 3.2.8, 3.2.9 ne sera necessaire.

---

## Annexe E. Sequence diagram complete sendTemplate

```
Caller (Tache 3.2.8 WaSendWorker)
   |
   |--> client.sendTemplate('212612345678', 'tpl', 'fr', components, {tenantId:'T1'})
   |
   v
WhatsAppCloudApiClient.sendTemplate
   |
   |--> assertPhoneE164('212612345678')  : OK
   |--> assert(templateName.length > 0)    : OK
   |--> assert(languageCode.length > 0)    : OK
   |
   |--> body = buildMetaJson(...)
   |--> phoneHash = hashRecipientPhone('212612345678', 'T1')
   |--> start = Date.now()
   |
   |--> rateLimiter.schedule('sendTemplate', () => requestWithRetry(...))
   |
   v
MetaRateLimiter (Bottleneck)
   |
   |--> reservoir = 80 (refresh /sec), if depleted -> queue
   |--> minTime 12.5ms inter-call
   |--> highWater 1000 -> overflow strategy
   |--> schedule slot, await turn
   |
   v
WhatsAppCloudApiClient.requestWithRetry
   |
   |--> attempt = 1
   |--> pool.request({method:'POST', path:'/v21.0/PHONE_ID/messages', headers:{Authorization:'Bearer EAAG...'}, body:JSON.stringify(body), headersTimeout:30000, bodyTimeout:30000})
   |
   v
undici Pool (graph.facebook.com:443)
   |
   |--> reuse keep-alive connection (else open new)
   |--> TLS 1.3 handshake (~30ms first time)
   |--> POST /v21.0/PHONE_ID/messages
   |--> response.statusCode = 200
   |--> response.body.text() = '{"messaging_product":"whatsapp","contacts":[...],"messages":[{"id":"wamid.HBgM..."}]}'
   |
   v
WhatsAppCloudApiClient.requestWithRetry
   |
   |--> JSON.parse(text)
   |--> status 200..299 : return parsed
   |
   v
WhatsAppCloudApiClient.sendTemplate
   |
   |--> messageId = 'wamid.HBgM...'
   |--> logger.log({msg:'wa_send_template_complete', duration_ms:87, status:'success', message_id:'wamid.HBgM...', template_name:'tpl', language:'fr', recipient_phone_hashed:'a3b2c1...', tenant_id:'T1'})
   |
   |--> return {message_id: 'wamid.HBgM...'}
   |
   v
Caller continues (Worker update DB + Kafka publish)
```

---

## Annexe F. Test fixture exhaustif tous Meta error codes

```typescript
// repo/packages/comm/src/providers/whatsapp/__tests__/fixtures/all-meta-errors.fixtures.ts

export const allMetaErrorsFixtures = {
  100: {
    error: { message: 'Invalid parameter', type: 'OAuthException', code: 100, fbtrace_id: 'a' },
  },
  130: {
    error: { message: 'Template name not found', type: 'OAuthException', code: 130, error_data: { details: 'Template: bad_tpl' }, fbtrace_id: 'b' },
  },
  131: {
    error: { message: 'Recipient not opted-in', type: 'OAuthException', code: 131, error_data: { details: 'Phone 212612345678' }, fbtrace_id: 'c' },
  },
  132: {
    error: { message: 'Template not approved', type: 'OAuthException', code: 132, error_data: { details: 'Template: pending_tpl status: PENDING_REVIEW' }, fbtrace_id: 'd' },
  },
  133: {
    error: { message: 'Invalid WABA', type: 'OAuthException', code: 133, fbtrace_id: 'e' },
  },
  190: {
    error: { message: 'Access token expired', type: 'OAuthException', code: 190, error_subcode: 460, fbtrace_id: 'f' },
  },
  80007: {
    error: { message: 'Application request limit reached', type: 'OAuthException', code: 80007, error_data: { details: 'Rate limit hit, retry in 60s' }, fbtrace_id: 'g' },
  },
  130429: {
    error: { message: 'Messages limit hit', type: 'OAuthException', code: 130429, error_data: { details: 'Phone limit, retry in 30s' }, fbtrace_id: 'h' },
  },
  131051: {
    error: { message: 'Unsupported message type', type: 'OAuthException', code: 131051, fbtrace_id: 'i' },
  },
  131056: {
    error: { message: 'Pair rate limit hit', type: 'OAuthException', code: 131056, error_data: { details: 'wait 60s' }, fbtrace_id: 'j' },
  },
  132012: {
    error: { message: 'Template parameter mismatch', type: 'OAuthException', code: 132012, error_data: { details: 'expected: 3 got: 2' }, fbtrace_id: 'k' },
  },
  132015: {
    error: { message: 'Template paused due to bad quality', type: 'OAuthException', code: 132015, error_data: { details: 'Template: my_tpl' }, fbtrace_id: 'l' },
  },
};
```

---

## Annexe G. Healthcheck endpoint integration Sprint 9 Tache 3.2.12

```typescript
// Sprint 9 Tache 3.2.12 controller pseudocode
@Controller('health')
export class HealthController {
  constructor(@Inject(WHATSAPP_CLIENT_TOKEN) private readonly waClient: IWhatsAppCloudApiClient) {}

  @Get('wa')
  async waHealth(): Promise<{ status: string; phone: any }> {
    try {
      const info = await this.waClient.getPhoneNumberInfo();
      return {
        status: info.code_verification_status === 'VERIFIED' && info.quality_rating !== 'RED' ? 'healthy' : 'degraded',
        phone: { display: info.display_phone_number, quality: info.quality_rating, name: info.verified_name },
      };
    } catch (err) {
      return { status: 'unhealthy', phone: { error: (err as Error).message } };
    }
  }
}
```

---

**Fin du prompt task 3.2.2 -- WhatsApp Cloud API Client Meta v21.0 -- Sprint 9 / Phase 3.**
