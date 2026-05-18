# TACHE 3.4.2 -- PaymentGatewayInterface + Base Abstract Gateway

**Sprint** : 11 (Phase 3 / Sprint 4 dans phase) -- Pay Multi-Passerelles Maroc
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-11-sprint-11-pay-ma-multi.md` (Tache 3.4.2)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 6 gateways concrets Tache 3.4.3 a 3.4.6 et l'orchestrateur Tache 3.4.7)
**Effort** : 4h
**Dependances** : Tache 3.4.1 (entities + schemas + helpers + types InitiatePaymentInput, PaymentStatus deja exporte par @insurtech/pay), Sprint 1 complet (undici 7.1.1 dependency installee monorepo), Sprint 6 complet (Pino logger DI), Sprint 7 complet (RBAC permissions reference)
**Densite cible** : 110-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 3.4.2 vise a definir l'interface contractuelle commune `PaymentGatewayInterface` consommee par les 6 implementations concretes de gateway providers du Sprint 11 (CMI Tache 3.4.3, YouCan Pay Tache 3.4.4, PayZone Tache 3.4.5, Inwi Money + Orange Money + M-Wallet BAM Tache 3.4.6) et par le PaymentOrchestrator (Tache 3.4.7), accompagnee de la classe abstraite `BaseGateway` qui mutualise la logique transversale (HTTP client undici 7.1.1 avec retry exponentiel, circuit breaker, timeout strict via AbortController, logging Pino structured avec redaction automatique des secrets, normalisation des erreurs HTTP en classes typees, signature de requetes via HMAC, parsing reponses, metrics Prometheus pour Sprint 13 Analytics, OpenTelemetry tracing). La realisation de cette tache produit aussi les types DTO discriminants (`InitiatePaymentRequest`, `InitiatePaymentResult`, `PaymentStatus`, `CaptureResult`, `RefundResult`, `WebhookVerificationResult`), les classes d'erreurs typees (`GatewayUnavailableError`, `GatewayInvalidRequestError`, `GatewayInsufficientFundsError`, `GatewayCardDeclinedError`, `GatewayFraudDetectedError`, `GatewayThreeDSecureFailedError`, `GatewayTimeoutError`, `GatewayWebhookSignatureInvalidError`), un registry pattern `GatewayRegistry` qui resout `provider name -> instance gateway` au boot, et la suite de tests unitaires Vitest verifiant chaque comportement de la base class (retry sur 5xx avec exponential backoff jitter, timeout enforcement strict, circuit breaker open/half-open/closed transitions avec grace period 60s au boot, error normalization HTTP -> typed errors, logging redaction des secrets dans paths Pino redact, OpenTelemetry span attributes). Aucune integration concrete avec un provider reel n'est livree dans cette tache : sa portee est strictement la fondation contractuelle consommee par les 6 implementations Tache 3.4.3 a 3.4.6 et l'orchestrateur Tache 3.4.7.

L'apport est triple. Premierement, definir une interface unique `PaymentGatewayInterface` avec 6 methodes obligatoires (`initiate`, `getStatus`, `capture` optional, `refund`, `cancel`, `verifyWebhookSignature`) garantit que le PaymentOrchestrator (Tache 3.4.7) ne connait JAMAIS les details specifiques d'un provider : il manipule des `gateway: PaymentGatewayInterface` et delegue toutes les operations via dispatch dynamique. Cette abstraction est centrale au pattern Strategy + Adapter (decision-019) et permet un decouplage strict : ajouter un 7eme provider Phase 7+ (e.g. Wafacash, Damane Cash, Stripe MA si autorise par Office des Changes) ne necessite que d'ecrire une classe implementant `PaymentGatewayInterface` et de l'enregistrer dans le `GatewayRegistry` au boot, l'orchestrateur n'est pas modifie (Open/Closed Principle respect). Cette discipline architecturale empeche un developpeur Sprint 14 (Insure) ou Sprint 19 (Repair) d'instancier directement un `CmiGateway` et de coder en dur la dependance vers CMI : le compilateur force le passage par l'interface abstraite via injection de dependances NestJS. La meme abstraction permet aux tests E2E (Tache 3.4.14) de swap les concrete gateways pour `MockCmiGateway`, `MockYouCanPayGateway`, etc. au runtime via DI override sans modifier le code production. Deuxiemement, mutualiser la logique transversale dans `BaseGateway` (~250 lignes de code) elimine ~1500 lignes de duplication potentielle (6 providers x 250 lignes mutualisees) -- HTTP retry strategy avec exponential backoff et jitter, timeout enforcement via AbortController + setTimeout, error mapping HTTP status -> classes typees, structured logging Pino avec request_id correlation, request signing helper HMAC-SHA256/SHA-512, response parsing utf-8/Buffer, metrics emission Prometheus, OpenTelemetry tracing spans. Sans cette mutualisation, chaque provider re-implementerait la meme logique avec inevitable drift (un provider n'aurait pas de retry, un autre logguerait clear-text les API keys, un troisieme n'aurait pas de timeout). La classe abstraite expose des template methods (`abstract initiate()`, `abstract getStatus()`, etc.) que chaque concrete provider override avec sa logique specifique au format API du provider, tout en heritant gratuitement du retry/logging/timeout/circuit breaker/metrics/tracing. Le pattern template method aussi force l'ordre des operations : circuit breaker check -> retry loop -> request execution -> response parsing -> error mapping -> metrics emission, garantissant comportement coherent entre tous les providers. Troisiemement, definir une hierarchie d'erreurs typees (`GatewayError` base abstraite + 8 sous-classes) au niveau de cette tache permet au PaymentOrchestrator (Tache 3.4.7) de distinguer programmatiquement via `instanceof` les conditions de fallback (retry next provider sur `GatewayUnavailableError`, `GatewayTimeoutError`) vs les conditions d'arret definitif (ne pas retry sur `GatewayCardDeclinedError`, `GatewayFraudDetectedError`, `GatewayInsufficientFundsError`, `GatewayThreeDSecureFailedError` -- l'utilisateur sera informe et tente carte differente). Sans cette typologie, l'orchestrateur traiterait toute exception comme un echec generique et soit retentera systematiquement (spam vers les 5 autres providers, cout API + latence + chargeback risque) soit abandonnerait systematiquement (pas de fallback CMI->YouCan en cas de panne CMI, SLA degrade). La granularite des erreurs est aussi une fonction de la conformite ACAPS Circulaire AS/02/24 (audit raisons exactes pour chaque transaction echouee, distinguer fraud detection vs technical issue) et de l'UX (utilisateur sait pourquoi son paiement a echoue : carte declinee vs gateway temporairement indisponible vs 3DS failed -- chaque cause necessite un message distinct et une CTA distincte). Chaque classe d'erreur expose des champs discriminants : `isFallbackEligible: boolean`, `isFinal: boolean`, `userMessage: string` (i18n key), `providerErrorCode?: string`, `providerHttpStatus?: number`, `providerRequestId?: string`, `metadata?: Record<string, unknown>`. Ces champs permettent au PaymentOrchestrator (Tache 3.4.7) d'implementer la logique de routing sans switch/case explicite sur le code provider, et au CommOrchestrator Sprint 9 de generer le bon email customer (`payment_card_declined` vs `payment_temporary_issue`).

A l'issue de cette tache, le package `@insurtech/pay` expose via `packages/pay/src/index.ts` les nouveaux exports : interface `PaymentGatewayInterface` (et 3 marker interfaces `TwoStepGateway`, `QrCodeGateway`, `CashVoucherGateway`), classe abstraite `BaseGateway`, types `InitiatePaymentRequest`, `InitiatePaymentResult`, `PaymentStatus`, `CaptureResult`, `RefundResult`, `WebhookVerificationResult` (et types auxiliaires `CapturePaymentRequest`, `RefundRequest`, `CancelPaymentRequest`), classes d'erreurs `GatewayError`, `GatewayUnavailableError`, `GatewayInvalidRequestError`, `GatewayInsufficientFundsError`, `GatewayCardDeclinedError`, `GatewayFraudDetectedError`, `GatewayThreeDSecureFailedError`, `GatewayTimeoutError`, `GatewayWebhookSignatureInvalidError`, classe `GatewayRegistry`, helpers `RetryPolicy`, `CircuitBreaker`, `RequestSigner`, `LogRedactor`. La commande `pnpm --filter @insurtech/pay test gateways/ helpers/ services/` execute 50+ tests Vitest verifiant le comportement de la base class (retry exponentiel avec jitter mathematiquement verifie, timeout enforcement strict via mock setTimeout, circuit breaker transitions CLOSED -> OPEN apres 5 echecs -> HALF_OPEN apres 30s cooldown -> CLOSED ou OPEN selon test request, normalization des erreurs HTTP 4xx/5xx/network -> classes typees, redaction secrets dans logs Pino verifiee via output capture, GatewayRegistry register/get/validateAtBoot fonctionnel, RequestSigner timingSafeEqual anti timing attack). La commande `pnpm --filter @insurtech/pay typecheck` retourne exit code 0. Les fichiers livres totalisent environ 1500 lignes de code TypeScript strict, prepares pour consommation immediate par Tache 3.4.3 (CMI Gateway concrete implementation).

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 doit integrer 6 providers paiement marocains avec des protocoles, formats, et idiomes radicalement differents : CMI utilise un POST form-urlencoded avec hash SHA-512 calcule sur concatenation de fields specifiques dans un ordre exact (heritage standard 3DS legacy CMI Posnet API ~20 ans), YouCan Pay utilise une API REST JSON moderne avec Bearer token + HMAC-SHA256 webhook signature + Idempotency-Key header standard HTTP, PayZone utilise un mix REST API pour cards + endpoint specifique de generation voucher PDF avec barcode 1D Code 128 pour cash kiosques (nouvelle integration MA depuis 2022), Inwi Money utilise REST avec Bearer auth + STK Push notification mobile + USSD code fallback, Orange Money utilise REST avec OAuth2 client_credentials flow + token expiration 1h + USSD code, M-Wallet BAM utilise un protocole intermediaire avec hash signature SHA-256 partagee inter-operateurs (projet inter-operabilite BAM 2024). Sans une couche d'abstraction stricte definie au niveau de cette tache, le PaymentOrchestrator (Tache 3.4.7) devrait connaitre tous ces details et contenir 6 branches `switch (provider) { case 'cmi': /* form post + hash + ... */ case 'youcan_pay': /* REST + Bearer + ... */ ... }`, generant un code monolithique de 2000+ lignes impossible a maintenir, impossible a tester unitairement (impossibility de mocker chaque branche separement sans monkey-patching), et qui violerait le Open/Closed Principle (ajout 7eme provider necessiterait de modifier l'orchestrateur, regression risk). De plus, les futurs sprints metier (Sprint 14 Insure, Sprint 19 Repair, Sprint 25 Cross-Tenant) qui doivent encaisser des paiements doivent pouvoir le faire sans connaitre les details providers : un developpeur Sprint 14 implementant `PoliciesService.activate(policy)` appelle simplement `paymentOrchestrator.initiate({ amount, customer, ... })` et l'orchestrateur s'occupe de tout. Cette discipline architecturale est le but principal du Pattern Strategy (decision-019) : separer l'algorithme stable (orchestration paiement avec fallback) des variations concretes (chaque provider avec ses idiosyncrasies). Le Pattern Adapter (decision-019 partie 2) complete : chaque concrete provider sert d'adapter entre l'interface uniforme attendue par l'orchestrateur et l'API specifique du provider externe.

Le choix specifique de `undici 7.1.1` (vs axios 1.x, node-fetch 3.x, got 14.x) est documente dans `00-pilotage/decisions/021-http-client-undici.md` : undici offre les meilleures performances dans l'ecosysteme Node.js (HTTP/1.1 pipelining + HTTP/2 multiplexing, support natif Node.js 18+ apres standardisation fetch), une API moderne basee sur les standards Web `fetch()` et `Request`/`Response` (vs axios qui utilise sa propre abstraction), un support natif des streams ReadableStream pour les downloads gros volumes (PDF settlement reports CMI/YouCan jusqu'a 50MB), un controle fin du connection pooling via `Pool` et `Dispatcher` API critique pour l'orchestrateur paiement qui peut emettre 100+ requetes/seconde en burst (e.g. lors d'un import bulk de polices avec encaissement simultane, Sprint 14), et une integration native avec OpenTelemetry tracing via `undici-instrumentation` package (Sprint 13 Analytics consommera). Axios bien que populaire est en mode maintenance avec performances inferieures (~30% plus lent que undici sur charges bursty) et bundle size eleve (~400KB minified). node-fetch est obsolete depuis Node 18+ qui inclut fetch natif. got est correcte mais moins performante et avec plus de magic implicite (auto-retry, normalisation d'URLs, etc.) qui rend le debugging difficile.

Le choix specifique d'une classe abstraite `BaseGateway` (vs fonction utilitaire purement composition, vs interface seule + mixin pattern) est documente dans `00-pilotage/decisions/020-gateway-base-class.md` : la classe abstraite permet d'imposer via TypeScript `abstract` modifier qu'un concrete provider DOIT fournir certaines proprietes (`abstract readonly provider: PaymentProvider`, `abstract readonly baseUrl: string`) et certaines methodes (`abstract initiate()`, `abstract getStatus()`, `abstract refund()`, `abstract cancel()`, `abstract verifyWebhookSignature()`) -- impossible avec composition pure ou interface seule sans validation manuelle au boot. La classe abstraite peut aussi declarer des methodes templates (`protected async makeRequest(method, path, body, headers)`) qui executent le retry/logging/timeout standard tout en deleguant la construction du payload specifique au concrete via override pattern. Cette discipline a un cout (heritage etant generalement decourage en TypeScript moderne en faveur de composition) mais le cas d'usage est exactement celui ou heritage produit les meilleurs resultats : un nombre fixe de variations connues d'avance (6 providers + ~10 ajouts hypothetiques Phase 7+), une structure tres similaire (tous : HTTP client + signature + parsing + error normalization), et des invariants forts (chaque provider DOIT implementer les 6 methodes de l'interface, chaque provider DOIT respecter le pattern retry/circuit/timeout). La rigidite single-inheritance n'est pas un probleme car aucun provider ne necessite d'etendre une autre classe abstract differente. Si Phase 7+ apporte un cas exceptionnel (e.g. providers fintech MA tres differents necessitant des protocoles specialises comme SOAP, GraphQL, gRPC), la migration vers composition restera facile (les abstract methods deviendraient des injections dependency dans une classe concrete). Cette flexibilite future est preservee.

Le choix specifique d'un `CircuitBreaker` integre au niveau `BaseGateway` (vs au niveau orchestrateur, vs library externe like `opossum`) est strategique. Si le circuit breaker etait au niveau orchestrateur, il devrait connaitre l'etat de chaque provider et reflechir cette etat de maniere centralisee, generant un point de couplage etroit et un single point of failure (si l'orchestrateur restart, tous les states circuit breaker se perdent, declenchant une rafale de retry sur des providers down). En placant le circuit breaker dans `BaseGateway` (chaque instance gateway maintient son propre state machine `CLOSED | OPEN | HALF_OPEN` en memoire process), chaque provider gere sa propre sante : si CMI est down depuis 30 secondes (5 echecs consecutifs detectes), le circuit breaker de l'instance `CmiGateway` passe en `OPEN` et toute call `cmiGateway.initiate()` throw immediatement `GatewayUnavailableError` sans toucher le reseau (latence economisee : 5s timeout * 5 retries = 25s par appel evite, soit 100x plus rapide). Apres 30 secondes de cooldown configurable, circuit passe `HALF_OPEN` : un seul appel test passe, si succes retour `CLOSED`, si echec retour `OPEN` pour 60 secondes (exponential cooldown). Cette resilience est critique : sans circuit breaker, une panne CMI prolongee saturerait le pool de connections undici (20 connections par origin + queueing) et bloquerait les threads workers Node.js, impactant tous les autres operations API (creation policies, generation factures, envoi notifications). Le pattern grace period au boot (60 secondes pendant lesquelles les echecs ne comptent pas) evite que le circuit breaker se declenche immediatement au demarrage (DNS pas encore propage, certificats SSL pas encore chargees, dependencies pas encore initialisees).

Le choix specifique d'une hierarchy d'erreurs typees (vs error code string union type comme `'GATEWAY_UNAVAILABLE' | 'CARD_DECLINED' | ...`) est strategique. `instanceof GatewayUnavailableError` permet narrowing TypeScript impossible avec `if (err.code === 'GATEWAY_UNAVAILABLE')` (qui require `any` cast et echoue silencieusement sur typo). L'audit ACAPS exige semantic precise (carte declinee vs fonds insuffisants vs fraud vs 3DS failed -- raisons differentes legalement et chacune doit produire un audit log distinct avec metadata specifique). Les messages utilisateur peuvent etre generes automatiquement via map `UserMessages[ErrorClass]` au niveau frontend Sprint 16, sans hardcoder strings. Le `metadata: Record<string, unknown>` champ permet aux providers de stocker des informations supplementaires sans casser l'interface (e.g. CMI `metadata: { mdStatus: '2', mdErrorMsg: '...' }`, YouCan `metadata: { youcan_request_id: 'req_xyz' }`). Le `cause: Error` champ (standard ECMAScript 2022) preserve la chaine d'erreurs originale pour debugging.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas d'interface, switch/case dans orchestrateur | Simplicite immediate, pas d'abstraction conceptuelle | Code monolithique 2000+ lignes impossible a tester unitairement, violation OCP, ajout 7eme provider modifie orchestrateur (regression risk), debug difficile (toutes branches melees) | REJETE |
| Interface seule (pas de classe abstraite), composition pure | Modern TypeScript pattern, evite heritage | Duplication retry/logging/timeout dans 6 providers, drift inevitable, pas d'enforcement abstract members compile-time, impossible factoriser template method pattern | REJETE |
| Classe abstraite avec template methods (RETENU) | Mutualisation logique transversale, abstract members enforcent contract compile-time, hierarchy claire visible IDE | Heritage utilise (deconseille parfois), single-inheritance rigide | RETENU -- decision-020, cas d'usage parfait |
| Library payment provider abstraction (Stripe paymentMethods, Adyen API multi-MOP, Braintree) | Pre-fait, maintenu par tiers | Pas couvre providers MA (CMI, YouCan, PayZone, wallets MA), payment data leave Maroc (violation decision-008 cloud souverain), license commerciale couteuse (~10000 USD/an Stripe Connect) | REJETE -- non conforme MA + cher |
| Mixins TypeScript (declaration merging) | Composition flexible | Limite expressivite, complexite types | REJETE |
| Axios HTTP client | Familier ecosysteme JS, documentation extensive | Performances inferieures undici (~30% plus lent), bundle size 400KB+, pas de HTTP/2 natif, mode maintenance | REJETE -- decision-021 |
| node-fetch HTTP client | Compatible avec ecosysteme | Obsolete depuis Node 18+ qui a fetch natif, perfs faibles | REJETE |
| got HTTP client | Modern, retry built-in | Performances < undici, magic implicite difficile debug | REJETE |
| undici 7.1.1 (RETENU) | Performance, HTTP/2, modern API standards-based, OpenTelemetry support | Apprentissage initial Pool/Dispatcher API | RETENU -- decision-021 |
| Pas de circuit breaker, retry seulement | Simplicite | Sature pool connection en cas de panne longue, latence bloquante autres operations API | REJETE |
| Circuit breaker au niveau orchestrateur (centralise) | Vue globale | Couplage etroit, complexite synchronisation entre providers, single point of failure | REJETE |
| Library `opossum` circuit breaker | Mature, configurable | 1500+ lignes pour cas d'usage couvrable en 80, dependance externe non necessaire | REJETE |
| Circuit breaker per gateway instance (RETENU) | Isolation, simple, evolutif, in-memory state | Duplication state legere mais acceptable | RETENU |
| Single error class `GatewayError` + code string | Simplicite | Impossible distinguer fallback-eligible vs definitive via type narrowing | REJETE |
| Hierarchy 8 error classes typees (RETENU) | Distinction precise, audit ACAPS riche, narrowing TypeScript via instanceof | Verbose | RETENU |
| Library `class-transformer` pour DTO | Pattern NestJS familier | Pas de TypeScript inference (manual decorators), lent runtime reflection | REJETE -- prefere types interfaces purs |
| Types interfaces purs DTO (RETENU) | Zero runtime, pure types, narrowing parfait | Pas de validation runtime au niveau type seul | RETENU (validation Zod separee Tache 3.4.1) |
| Retry without jitter | Simplicity | Thundering herd quand tous calls retry simultanement | REJETE |
| Exponential backoff with jitter (RETENU) | Spread retries, evite saturation | Calcul plus complexe | RETENU -- decision-021 |
| Manual logging redaction | Granular control | Forget-prone, drift entre providers | REJETE |
| Pino redact paths config (RETENU) | Centralise, deterministe | Path syntax learning | RETENU |
| OpenTelemetry tracing instrumented manually | Custom spans names | Verbose | EVALUE -- partial in MVP |
| undici-instrumentation auto (RETENU partial) | Auto spans | Requires global setup Sprint 13 | RETENU partial -- spans manual + auto when Sprint 13 |

### 2.3 Trade-offs explicites

Choisir `undici 7.1.1` (vs maintenir compatibility node-fetch ou axios) implique d'accepter une learning curve initiale pour les developpeurs Sprint 11 (concepts Pool, Dispatcher, Agent, ConnectionPool). La compensation : performances 2-3x superieures (benchmarks publics undici GitHub) sur charge bursty paiement, support natif HTTP/2 multiplexing critique pour wallets MA qui ouvrent 10+ connections paralleles pour status polling (Tache 3.4.6), et integration native OpenTelemetry tracing essentielle pour Sprint 13 dashboards latence per provider et alerting Sprint 13 sur degradation SLA. La learning curve est mitigee par un wrapper `BaseGateway.makeRequest()` qui encapsule l'API undici complexe derriere une interface simple `{ method, path, body, headers, expectStatus, operationName }`. Les developpeurs Sprint 14+ qui consomment l'orchestrateur via DI ne touchent jamais directement undici.

Choisir une classe abstraite `BaseGateway` (vs composition pure avec helpers utilitaires) implique d'accepter heritage TypeScript et la rigidite associee : un concrete provider ne peut pas etendre 2 classes abstract differentes (single inheritance Java/C# heritage TypeScript). La compensation : le cas d'usage (6 providers structurellement identiques avec variations API specifiques) est exactement la situation ou heritage produit les meilleurs resultats. La rigidite single-inheritance n'est pas un probleme car aucun provider ne necessite d'etendre une autre classe abstract differente. Si Phase 7+ apporte un cas exceptionnel (e.g. providers fintech MA tres differents comme banking SaaS partner avec APIs SOAP), la migration vers composition restera facile (les abstract methods deviendraient des injections dependency dans une classe concrete + delegation pattern). Cette flexibilite future est preservee via les `protected` modifiers sur la majorite des methodes templates (modifiables par concrete) vs `private` (locked).

Choisir d'integrer le circuit breaker dans `BaseGateway` (vs library externe like `opossum`) implique d'accepter de re-implementer ~80 lignes de state machine (CLOSED, OPEN, HALF_OPEN avec transitions, timestamps, fail count). La compensation : zero dependance externe (decision-021 generale Sprint 1 prefere zero-dep quand simple), comportement totalement controle (parametres specifiques Skalean : threshold 5 echecs configurable, cooldown 30s ajustable per provider via env vars `${PROVIDER}_CIRCUIT_COOLDOWN_MS`, grace period 60s au boot), tests deterministes (vs library externe avec leurs propres bugs et release cycles), absence de footprint memory supplementaire library. `opossum` est excellent mais 1500+ lignes pour un cas d'usage couvrable en 80 -- inutile complexity.

Choisir 8 classes d'erreur typees (vs error code string) implique d'accepter une verbosite : chaque classe declare son propre constructor avec metadata specifique. La compensation : `instanceof GatewayUnavailableError` permet narrowing TypeScript impossible avec `if (err.code === 'GATEWAY_UNAVAILABLE')` (qui require any cast), audit ACAPS exige semantic precise (carte declinee vs fonds insuffisants -- raisons differentes legalement, doivent produire des Kafka events distincts pour analytics Sprint 13), et messages utilisateur peuvent etre generes automatiquement (`UserMessages[ErrorClass]`) sans hardcoder strings dans le frontend.

Choisir `expectStatus: number[]` parameter dans `makeRequest()` implique d'accepter que chaque concrete gateway specifie ses status codes attendus explicitement (e.g. CMI accept `[200, 302]` car parfois redirect, YouCan accept `[200, 201]` pour POST). Le trade-off : verbosite mais clarte explicite vs implicite default `2xx` qui pourrait masquer comportements inattendus.

### 2.4 Decisions strategiques referenced

- **decision-019 (Pattern Strategy + Adapter pour gateways)** : pertinence pour cette tache = totale. Cette tache concretise l'interface Strategy (`PaymentGatewayInterface`) consume par PaymentOrchestrator. Le Pattern Adapter est concretise par chaque concrete provider Tache 3.4.3-3.4.6 qui adapte API specifique provider vers interface uniforme.
- **decision-020 (Classe abstraite BaseGateway pour mutualisation)** : pertinence = totale. Cette tache implemente la classe.
- **decision-021 (HTTP client undici 7.1.1)** : pertinence = totale. BaseGateway utilise undici Pool + Dispatcher.
- **decision-006 (No-emoji ABSOLU)** : pertinence = totale. Aucune emoji dans logs structured Pino, dans error messages, dans commentaires JSDoc, dans variable names. Pre-commit hook verifie via regex Unicode `[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]`.
- **decision-008 (Cloud souverain MA)** : pertinence = critique. BaseGateway logging masque API keys (decision-008 exige no-leak credentials), aucune trace de PII dans logs (filterables via Pino redact paths), aucune trace de card data (PCI-DSS scope merchant). Tous les requests gateways sortants sont vers providers operes au Maroc avec data residency MA.
- **decision-014 (Idempotency-Key obligatoire pour mutations sensibles)** : pertinence = directe. `InitiatePaymentRequest.idempotencyKey: string` strict requis interface, type non-optional.
- **decision-018 (Money numeric(15,2))** : pertinence = totale. `amount: number` accepted dans interface, mais services convert via `MoneyHelpers` (Tache 3.4.1). Concrete gateways YouCan/wallets convert MAD -> centimes integer cote API, gateways CMI/PayZone keep MAD decimal format.
- **decision-022 (Currency MAD only MVP)** : pertinence = directe. `currency: 'MAD'` literal type dans interface.
- **decision-024 (PCI-DSS scope reduction via 3D_PAY_HOSTING)** : pertinence = indirecte. BaseGateway force HTTPS-only (rejette HTTP URLs au constructor), redact card-related paths in Pino logs (`body.card_number`, `body.cvv`, `body.pan`).
- **decision-025 (Logger Pino structured JSON only)** : pertinence = totale. BaseGateway utilise Pino exclusivement, format JSON structured, redact paths configures.
- **decision-027 (3DS mandatory cards EMV BAM 2023)** : pertinence = indirecte. Interface expose `three_d_secure_status` dans PaymentStatus type pour audit conformity.
- **decision-031 (BullMQ Sprint 1 selected)** : pertinence = indirecte. BaseGateway integration future avec queue pour retry async (Tache 3.4.12 utilise).
- **decision-032 (Tests Vitest 2.1.8)** : pertinence = totale. Tests unit Vitest + MockAgent undici pour HTTP mocking.

### 2.5 Pieges techniques connus

1. **Piege : API keys leakees dans logs Pino structured.**
   - Pourquoi : developpeur log `this.logger.info({ headers: requestHeaders }, 'request')` avec `Authorization: Bearer SECRET_API_KEY` -> SECRET visible dans logs Datadog/CloudWatch/fichiers, possiblement exposes via leakage cross-team ou breach. Idem pour `body.api_key`, `body.HASH` (CMI signature), `body.client_secret` (Orange OAuth2). Risque : credentials compromise = impersonation merchant Skalean = transactions frauduleuses.
   - Solution : `BaseGateway` configure Pino redact paths exhaustifs `['headers.authorization', 'headers["x-api-key"]', 'headers["x-cmi-clientid"]', 'headers["x-cmi-storekey"]', 'headers["x-youcan-secret"]', 'headers["x-payzone-api-key"]', 'headers.cookie', 'headers["set-cookie"]', 'body.api_key', 'body.client_secret', 'body.private_key', 'body.password', 'body.HASH', 'body.HASHPARAMSVAL', 'body.storekey', 'body.YOUCAN_PAY_PRIVATE_KEY', 'body.YOUCAN_PAY_WEBHOOK_SECRET', 'body.cardNumber', 'body.card_number', 'body.pan', 'body.cvv', 'body.cvc', 'body.expDate', '*.api_key', '*.password', '*.secret']` (path glob support recursive). Test V8 verifie redaction via output capture Pino.

2. **Piege : Timeout undici trop court pour wallets MA (latence elevee).**
   - Pourquoi : Inwi Money / Orange Money APIs peuvent latence 5-15s normalement (legacy infrastructure, mobile network roundtrips), default undici 30s peut etre insuffisant en burst (queueing dans pool). Si timeout trop court, false positives circuit breaker open inutilement.
   - Solution : `BaseGateway` configure timeout per provider via env var `${PROVIDER}_TIMEOUT_MS` (defaut 15000ms cards CMI/YouCan, 30000ms wallets Inwi/Orange/MWallet, 20000ms PayZone). Methode protected `getTimeoutMs()` overridable par concrete provider si besoin specifique runtime. AbortController + setTimeout enforce strictement.

3. **Piege : Circuit breaker ouvre trop vite en startup (cold start).**
   - Pourquoi : 5 echecs consecutifs au boot (DNS pas encore propage, certificats SSL pas encore charges, dependencies async pas encore initialisees) declenche OPEN immediat, bloquant tous les requests pendant 30s+ alors que le service est juste en train de se reveiller.
   - Solution : Circuit breaker grace period 60s au boot pendant lequel echecs ne comptent pas vers le threshold. Implemente via `lastSuccessOrInitTime` tracking et compare `Date.now() - initTime < gracePeriodMs` -> ignore failure.

4. **Piege : Retry naif declenche idempotency violation cote provider.**
   - Pourquoi : retry sur 5xx peut declencher provider duplicate transaction si idempotency_key absent ou non transmis correctement. Exemple : CMI 503 retour, retry sans `oid` (=idempotency_key) -> CMI cree NOUVELLE transaction = double charge customer apres restitution service.
   - Solution : tous les retries TRANSMETTENT meme idempotency_key (Tache 3.4.1 requires ULID strict, generated cote orchestrator AVANT call gateway). Provider voit duplicate via UNIQUE constraint server-side et retourne meme reponse (202 Accepted ou 200 avec same transaction_id). Test V12 verifie comportement.

5. **Piege : Retry exponential backoff sans jitter cause thundering herd.**
   - Pourquoi : si tous les calls timeoutent ensemble (panne reseau brieve) et retry au meme delay (1s, 2s, 4s), tous retentent simultanement = saturation provider quand il revient en ligne, declenchant nouvelle vague de timeouts.
   - Solution : Add jitter random 0-25% : `delay = base * 2^attempt + random(0, base * 0.25)`. Test V13 verifie variance entre 3 samples consecutifs (pas identical).

6. **Piege : Erreur HTTP 4xx retentee inutilement.**
   - Pourquoi : 4xx est client error (request invalide, credentials wrong, validation failed cote provider), retry ne resoudra pas car le payload est intrinsequement faux.
   - Solution : Retry policy = 5xx + network errors uniquement, pas 4xx (sauf 429 Too Many Requests qui respect Retry-After header per RFC 6585). 401 Unauthorized -> probleme credentials, alert SOC.

7. **Piege : `verifyWebhookSignature` retourne false silencieusement masque attaque.**
   - Pourquoi : webhook avec signature invalide = potentiellement attaque (replay, tampering, spoofing), doit etre logged WARN avec details (IP, signature prefix, headers, payload size) pour SOC monitoring.
   - Solution : `BaseGateway.verifyWebhookSignature()` log structured `{ event: 'webhook_signature_invalid', provider, ip, signature_prefix: signature.slice(0, 8) + '...', body_size, headers_count }` avant retourner `{ valid: false }`. Tache 3.4.8 webhook controllers consume ce log pour SOC alerting + rate limit attacker IP.

8. **Piege : HMAC timing attack via comparison string non-constant time.**
   - Pourquoi : `signature === expected` ou `Buffer.compare(a, b)` short-circuit comparison leak timing info -> attaquant peut deviner signature byte par byte en mesurant temps reponse.
   - Solution : Helper `RequestSigner.verifyHmac()` utilise `crypto.timingSafeEqual()` Node native qui constant-time compare. Verifie via test V14 que duration mesurable est constante quel que soit prefix common entre signatures.

9. **Piege : Connection pool undici trop petit -> queueing latence.**
   - Pourquoi : default 10 connections par origin, sous burst 100+ requests/sec queue.
   - Solution : `BaseGateway` configure Pool avec `connections: 20` per provider (env `${PROVIDER}_POOL_SIZE` overridable), `keepAliveTimeout: 60000` pour reuse connections.

10. **Piege : DNS resolution slow first time (no cache).**
    - Pourquoi : First call vers `payten.cmi.co.ma` declenche DNS lookup synchrone qui peut prendre 1-3s sur reseau Maroc (DNS infrastructure parfois lente).
    - Solution : undici Pool reuse connections after first resolve, cache 60s. Plus configure DNS_CACHE_TTL env var, prefer node-cache-dns library Phase 7+.

11. **Piege : Error stack traces leak information sensible.**
    - Pourquoi : exception thrown contient `password`, `api_key` dans variables locales -> stack trace logged inclut local scope.
    - Solution : Custom error classes scrub stack avant log via `error.stack = scrubSensitive(error.stack)`. Helper `LogRedactor.scrubSensitive()` regex replace patterns. Tests V15.

12. **Piege : Circuit breaker partage state entre tenants (shared singleton).**
    - Pourquoi : Un tenant en panne provider declenche circuit OPEN affectant tous tenants. Si tenant A a credentials invalides (401 systematic), circuit ne devrait pas affecter tenant B avec credentials valides.
    - Solution : Circuit breaker tracks errors par TYPE : `GatewayUnavailableError` (network/5xx) compte global (provider down for everyone), `GatewayInvalidRequestError` (credentials, 401) ne compte pas (specific tenant config issue). Test V16 verifie ce comportement.

13. **Piege : Tests unitaires impossibles sans HTTP mock.**
    - Pourquoi : `BaseGateway.makeRequest()` appel reseau reel, tests deviennent flaky (network dependent).
    - Solution : Inject `Dispatcher` undici via constructor option (DI pattern). Tests passent un `MockAgent` undici qui intercept et mock responses precises.

14. **Piege : Logger `this.logger` potentiellement null si DI mal configure.**
    - Pourquoi : tests qui instancient sans logger throw NPE au premier `this.logger.info(...)` call.
    - Solution : Constructor accept `logger?: Logger` optional, fallback `pino({})` defaut (no-op silent). Verify production DI Sprint 1 inject Pino structured.

15. **Piege : `verifyWebhookSignature` cleartext body recu via Express middleware.**
    - Pourquoi : `app.use(express.json())` parse body automatiquement et detruit raw bytes -> signature mismatch car HMAC compute sur bytes pas sur object reparsed.
    - Solution : Public webhook endpoints utilisent `express.raw({ type: 'application/json' })` pour preserver buffer raw. Tache 3.4.8 implemente ce middleware. Cette tache documente requirement dans interface JSDoc + type signature `rawBody: Buffer` (pas `payload: object`).

16. **Piege : Refund partial montant incoherent avec status original.**
    - Pourquoi : interface accept refund pour transaction failed -> illogique semantiquement, gateway provider rejette.
    - Solution : Tache 3.4.9 (RefundService) verifie status avant call. Cette tache documente prerequis dans JSDoc interface : `refund() should only be called on transactions in status 'captured' or 'partially_refunded'`.

17. **Piege : Concurrent calls meme idempotency_key race condition.**
    - Pourquoi : 2 calls simultanes meme idempotency_key arrivent avant le INSERT pay_transactions UNIQUE -> 2 calls gateway = 2 transactions provider possibles.
    - Solution : Tache 3.4.7 PaymentOrchestrator utilise advisory lock Postgres `pg_try_advisory_lock(hash(idempotency_key))` AVANT le call gateway. Si lock fail, autre call en cours -> retry apres delay.

18. **Piege : Gateway response body trop gros depasse memoire.**
    - Pourquoi : provider repond 50MB JSON (rare mais possible settlement reports), readResponseBody() chunks accumulees memory blow.
    - Solution : `BaseGateway.readResponseBody()` limit max `MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024` (10MB), throw si depasse. Settlements > 10MB use streaming separate endpoint.

19. **Piege : Provider returns gzipped body undici doesn't decompress automatic.**
    - Pourquoi : `Accept-Encoding: gzip` configure, provider returns compressed bytes, BaseGateway voit bytes binaires non-JSON.
    - Solution : undici 7.x supports auto-decompression via `dispatcher: new Agent({ allowH2: true })`. BaseGateway constructor configure.

20. **Piege : Concrete provider override `baseUrl` mid-call casse Pool.**
    - Pourquoi : Pool created with origin baseUrl at constructor, si subclass changes baseUrl runtime, Pool routes vers wrong host.
    - Solution : `baseUrl` declared `readonly` dans BaseGateway, constructor seul peut set. Test V21 verify immutable.

21. **Piege : Operation_name missing dans logs rend traces opaques.**
    - Pourquoi : logs `{request_start}` sans context = quel call (initiate, refund, status?) impossible debug.
    - Solution : `makeRequest()` exige `operationName: string` parameter, propagate dans logs + OpenTelemetry span name.

22. **Piege : Metrics Prometheus emis avant/apres setTimeout async.**
    - Pourquoi : metrics counter increment apres await peut etre rate trop tard si process exit.
    - Solution : metrics emis synchrone apres response parsing.

23. **Piege : OpenTelemetry trace context lost across await.**
    - Pourquoi : async/await peut perdre trace context si AsyncLocalStorage pas configure.
    - Solution : Sprint 1 setup AsyncLocalStorage global. BaseGateway propagate context via `context.with()` wrap.

24. **Piege : Error instanceof check fail across module boundaries.**
    - Pourquoi : si GatewayError class loaded via 2 modules differents (npm install dedup fail), `err instanceof GatewayError` false meme quand semantic match.
    - Solution : Sprint 1 single root npm install, packages/pay/* exports unique classes.

25. **Piege : URL trailing slash inconsistency casse undici routing.**
    - Pourquoi : `baseUrl: 'https://provider.com/'` + `path: '/api'` -> request URL `https://provider.com//api` (double slash) parfois rejete par provider.
    - Solution : BaseGateway constructor strip trailing slash: `this.baseUrl = options.baseUrl.replace(/\/$/, '')`.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 3.4.2 est la 2eme tache du Sprint 11 et la 42eme tache de la Phase 3. Elle :

- **Depend de** :
  - **Tache 3.4.1** (entities + types + helpers de @insurtech/pay) : `PaymentProvider` enum, `Currency` enum, `PaymentStatus` interface preliminaire, `MoneyHelpers`, `RequestSigner` etendu ici, `LogRedactor` etendu ici.
  - **Sprint 1** : monorepo pnpm + undici 7.1.1 dans dependencies, Pino 9.6.0 disponible.
  - **Sprint 6** : Pino logger DI configure global (`@insurtech/shared-utils` exports `Logger` token).
  - **Sprint 7** : RBAC permissions reference (decorator imports).
- **Bloque** :
  - **Tache 3.4.3** : CMI Gateway `extends BaseGateway implements PaymentGatewayInterface`.
  - **Tache 3.4.4** : YouCan Pay Gateway extends.
  - **Tache 3.4.5** : PayZone Gateway extends.
  - **Tache 3.4.6** : 3 wallets gateways extends.
  - **Tache 3.4.7** : PaymentOrchestrator depends on `PaymentGatewayInterface` + `GatewayRegistry`.
  - **Tache 3.4.8** : webhooks consumers utilisent `verifyWebhookSignature()`.
  - **Tache 3.4.13** : controllers + DTOs consume types.
- **Apporte au sprint** : la fondation contractuelle complete pour les 6 gateways concrets et l'orchestrateur. Sans cette fondation, aucune des 12 taches suivantes ne peut etre ecrite.

### 3.2 Position dans le programme global

L'interface `PaymentGatewayInterface` definie dans cette tache devient le contrat de reference pour tout futur ajout provider :

- **Phase 7+ (Sprint 36+)** : si Skalean InsurTech ajoute Wafacash, Damane Cash, ou un provider international (sous reserve conformite Office des Changes loi 1996), il suffit d'ecrire une nouvelle classe `WafacashGateway extends BaseGateway implements PaymentGatewayInterface`. Aucune modification orchestrateur, aucune modification webhook consumers, aucune modification frontend. Pure addition.
- **Sprint 14-15 (Vertical Insure)** : commercial brokers consomment via PaymentOrchestrator, ne touchent jamais directement les concrete gateways. Cette discipline architecturale est maintenue.
- **Sprint 19-21 (Vertical Repair)** : idem.
- **Sprint 25 (Cross-Tenant Cabinets)** : un cabinet courtier multi-tenant peut configurer differents subsets de providers per child-tenant via `tenant.settings.payment_providers` array. L'interface permet ce decoupling.
- **Sprint 30 (MCP Server)** : tools metier MCP `pay.initiate_payment(args)` invoquent l'orchestrateur, jamais directement les gateways.
- **Sprint 31 (Sky AI Agent)** : agent Sky peut suggerer "cette transaction a echoue parce que ${error.userMessage} -- voulez-vous re-essayer avec ${alternativeProvider}" en consommant la hierarchy d'erreurs typees.
- **Sprint 33 (CMI v2 migration)** : si CMI deprecie 3DS 1.0.2 en faveur 3DS 2.x + REST API, seule la classe `CmiGateway` est modifiee (ou nouvelle `CmiGatewayV2` ajoutee), aucun autre code touche grace a l'abstraction.

### 3.3 Diagramme architecture

```
                              +----------------------------+
                              | @insurtech/pay/interfaces  |
                              | PaymentGatewayInterface     |
                              | (6 methods abstract)        |
                              | TwoStepGateway (marker)     |
                              | QrCodeGateway (marker)      |
                              | CashVoucherGateway (marker) |
                              +--------------+-------------+
                                             |
                              implements     |
                                             v
                              +----------------------------+
                              | @insurtech/pay/gateways    |
                              | BaseGateway (abstract)      |
                              |  - undici Pool 20 conn      |
                              |  - retry policy exp+jitter  |
                              |  - circuit breaker FSM      |
                              |  - logging Pino redact      |
                              |  - error normalization      |
                              |  - metrics emission         |
                              |  - OpenTelemetry tracing    |
                              |  - HTTPS-only enforce       |
                              |  - timeout AbortController  |
                              +--------------+-------------+
                                             |
                          extends            |          extends
                  +------------+-------------+-------------+--------+----------+----------+
                  |            |             |             |        |          |          |
                  v            v             v             v        v          v          v
              CmiGateway  YouCanGateway  PayZoneGateway  Inwi   Orange   MWalletBam  (futures)
              (3.4.3)     (3.4.4)        (3.4.5)         Money  Money    (3.4.6)
                                                          (3.4.6)(3.4.6)

                                             |
                                             v
                              +----------------------------+
                              | GatewayRegistry             |
                              |  Map<provider, instance>    |
                              |  resolves at boot           |
                              |  validateAtBoot() exhaustive|
                              +--------------+-------------+
                                             |
                                             v consumes
                                             |
                              +----------------------------+
                              | PaymentOrchestrator (3.4.7) |
                              |  for (provider in fallback) |
                              |   try { gateway.initiate() }|
                              |   catch (Unavailable) next  |
                              |   catch (CardDeclined) abort|
                              +----------------------------+
```

### 3.4 Diagramme retry + circuit breaker

```
[Call gateway.initiate() ]
        |
        v
    Circuit state ?
    /          \
  CLOSED      OPEN
    |          |
    |          v
    |     throw GatewayUnavailableError immediately
    |     (no network call, fail fast in <1ms)
    |
    v
  HTTP request (undici)
    |
    v
  Response status ?
    |
    +-- 2xx  -> Parse OK -> reset circuit fail counter -> emit metric success_count++ -> return result
    |
    +-- 4xx  -> Normalize to GatewayInvalidRequestError | CardDeclined | InsufficientFunds | FraudDetected
    |          (no retry, throw)
    |          -> emit metric error_count++
    |
    +-- 5xx  -> Increment retry counter
    |          |
    |          v
    |        attempt < maxRetries (3) ?
    |        /                       \
    |      YES                        NO
    |        |                         |
    |        v                         v
    |    sleep(exponentialBackoff      Increment circuit fail counter
    |         + jitter)                 |
    |        |                         v
    |        v                       fail count >= threshold (5) ?
    |     retry HTTP                 /                          \
    |        |                     YES                           NO
    |        |                       |                            |
    |        v                       v                            v
    |     [Loop]                Circuit -> OPEN              Throw GatewayUnavailableError
    |                           (cooldown 30s)               (one shot)
    |                                |
    |                                v
    |                              throw
    |
    +-- Network error -> same as 5xx (retry + circuit logic)
    |
    +-- Timeout -> Increment circuit fail counter -> throw GatewayTimeoutError
```

### 3.5 Diagramme circuit breaker state machine

```
                  recordSuccess()
                  (failCount = 0)
                       v
                   [CLOSED]
                       |
                       | recordFailure() x failThreshold (5)
                       v
                    [OPEN]
                       |
                       | cooldownMs elapsed (30s)
                       v
                  [HALF_OPEN]
                  /         \
        recordSuccess()    recordFailure()
                |              |
                v              v
            [CLOSED]        [OPEN]
                            (cooldownMs * 2 next)
```

---

## 4. Livrables checkables (28 livrables)

- [ ] Interface `repo/packages/pay/src/interfaces/payment-gateway.interface.ts` (~120 lignes : 6 methods abstract + 3 marker interfaces)
- [ ] Types `repo/packages/pay/src/types/gateway-requests.ts` (~80 lignes : InitiatePaymentRequest, CapturePaymentRequest, RefundRequest, CancelPaymentRequest)
- [ ] Types `repo/packages/pay/src/types/gateway-results.ts` (~90 lignes : InitiatePaymentResult, PaymentStatus, CaptureResult, RefundResult, WebhookVerificationResult)
- [ ] Errors base `repo/packages/pay/src/errors/gateway-error.ts` (~60 lignes : GatewayError abstract + commonprops + toLogJson)
- [ ] Errors specifiques `gateway-unavailable.error.ts` (~40 lignes : factories from network/HTTP/circuit)
- [ ] Errors specifiques `gateway-invalid-request.error.ts` (~30 lignes)
- [ ] Errors specifiques `gateway-card-declined.error.ts` (~40 lignes : avec CardDeclineReason enum)
- [ ] Errors specifiques `gateway-insufficient-funds.error.ts` (~30 lignes)
- [ ] Errors specifiques `gateway-fraud-detected.error.ts` (~35 lignes)
- [ ] Errors specifiques `gateway-three-d-secure-failed.error.ts` (~30 lignes)
- [ ] Errors specifiques `gateway-timeout.error.ts` (~30 lignes)
- [ ] Errors specifiques `gateway-webhook-signature-invalid.error.ts` (~35 lignes)
- [ ] Errors barrel `repo/packages/pay/src/errors/index.ts` (~25 lignes)
- [ ] Base class `repo/packages/pay/src/gateways/base-gateway.ts` (~280 lignes : undici client + retry + circuit + logging + abstract methods + metrics + tracing)
- [ ] Helper `repo/packages/pay/src/helpers/retry-policy.helper.ts` (~90 lignes : exponentialBackoff, jitter, shouldRetry per HTTP code)
- [ ] Helper `repo/packages/pay/src/helpers/circuit-breaker.helper.ts` (~130 lignes : state machine + grace period + transitions + metrics)
- [ ] Helper `repo/packages/pay/src/helpers/request-signer.helper.ts` (~80 lignes : timing-safe HMAC verification, SHA-256, SHA-512, base64)
- [ ] Helper `repo/packages/pay/src/helpers/log-redactor.helper.ts` (~70 lignes : Pino redact paths config + scrubSensitive function for stack traces)
- [ ] Helper `repo/packages/pay/src/helpers/gateway-metrics.helper.ts` (~60 lignes : Prometheus counters/histograms emission)
- [ ] Service `repo/packages/pay/src/services/gateway-registry.service.ts` (~100 lignes : Map provider -> instance, register/resolve, validateAtBoot, closeAll)
- [ ] Module index `repo/packages/pay/src/gateways/index.ts` (~15 lignes : barrel export gateways)
- [ ] Module index `repo/packages/pay/src/services/index.ts` (~10 lignes)
- [ ] Module index `repo/packages/pay/src/types/index.ts` (~10 lignes)
- [ ] Module index `repo/packages/pay/src/interfaces/index.ts` (~10 lignes)
- [ ] Index principal `repo/packages/pay/src/index.ts` (mis a jour : add ~30 exports)
- [ ] Tests unit `base-gateway.spec.ts` (~450 lignes : 22+ tests)
- [ ] Tests unit `retry-policy.helper.spec.ts` (~180 lignes : 10 tests)
- [ ] Tests unit `circuit-breaker.helper.spec.ts` (~220 lignes : 12 tests)
- [ ] Tests unit `request-signer.helper.spec.ts` (~140 lignes : 8 tests)
- [ ] Tests unit `gateway-registry.service.spec.ts` (~120 lignes : 7 tests)
- [ ] Tests unit `log-redactor.helper.spec.ts` (~100 lignes : 5 tests)
- [ ] Tests unit `gateway-error.spec.ts` (~150 lignes : 10 tests)

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/pay/src/interfaces/payment-gateway.interface.ts                  (~120 lignes / interface coeur)
repo/packages/pay/src/interfaces/index.ts                                      (~10 lignes / barrel)
repo/packages/pay/src/types/gateway-requests.ts                                (~80 lignes / DTO requests)
repo/packages/pay/src/types/gateway-results.ts                                 (~90 lignes / DTO results)
repo/packages/pay/src/types/index.ts                                           (~10 lignes / barrel)
repo/packages/pay/src/errors/gateway-error.ts                                  (~60 lignes / base class)
repo/packages/pay/src/errors/gateway-unavailable.error.ts                      (~40 lignes)
repo/packages/pay/src/errors/gateway-invalid-request.error.ts                  (~30 lignes)
repo/packages/pay/src/errors/gateway-card-declined.error.ts                    (~40 lignes)
repo/packages/pay/src/errors/gateway-insufficient-funds.error.ts               (~30 lignes)
repo/packages/pay/src/errors/gateway-fraud-detected.error.ts                   (~35 lignes)
repo/packages/pay/src/errors/gateway-three-d-secure-failed.error.ts            (~30 lignes)
repo/packages/pay/src/errors/gateway-timeout.error.ts                          (~30 lignes)
repo/packages/pay/src/errors/gateway-webhook-signature-invalid.error.ts        (~35 lignes)
repo/packages/pay/src/errors/index.ts                                          (~25 lignes / barrel)
repo/packages/pay/src/gateways/base-gateway.ts                                 (~280 lignes / abstract class)
repo/packages/pay/src/gateways/index.ts                                        (~15 lignes / barrel)
repo/packages/pay/src/helpers/retry-policy.helper.ts                           (~90 lignes)
repo/packages/pay/src/helpers/circuit-breaker.helper.ts                        (~130 lignes)
repo/packages/pay/src/helpers/request-signer.helper.ts                         (~80 lignes)
repo/packages/pay/src/helpers/log-redactor.helper.ts                           (~70 lignes)
repo/packages/pay/src/helpers/gateway-metrics.helper.ts                        (~60 lignes)
repo/packages/pay/src/helpers/index.ts                                         (mis a jour : add 5 exports)
repo/packages/pay/src/services/gateway-registry.service.ts                     (~100 lignes)
repo/packages/pay/src/services/index.ts                                        (~10 lignes / barrel)
repo/packages/pay/src/index.ts                                                 (mis a jour : add ~30 exports)
repo/packages/pay/src/gateways/__tests__/base-gateway.spec.ts                  (~450 lignes / 22+ tests)
repo/packages/pay/src/helpers/__tests__/retry-policy.helper.spec.ts            (~180 lignes / 10 tests)
repo/packages/pay/src/helpers/__tests__/circuit-breaker.helper.spec.ts         (~220 lignes / 12 tests)
repo/packages/pay/src/helpers/__tests__/request-signer.helper.spec.ts          (~140 lignes / 8 tests)
repo/packages/pay/src/helpers/__tests__/log-redactor.helper.spec.ts            (~100 lignes / 5 tests)
repo/packages/pay/src/services/__tests__/gateway-registry.service.spec.ts     (~120 lignes / 7 tests)
repo/packages/pay/src/errors/__tests__/gateway-error.spec.ts                  (~150 lignes / 10 tests)
repo/packages/pay/package.json                                                 (modifie : add undici 7.1.1, pino 9.6.0, prom-client 15.1.3)
```

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/15 : `repo/packages/pay/src/interfaces/payment-gateway.interface.ts`

L'interface coeur consommee par tous les concretes gateways et l'orchestrateur. 3 marker interfaces additionnelles pour narrowing capabilities specifiques.

```typescript
// repo/packages/pay/src/interfaces/payment-gateway.interface.ts
//
// Interface contractuelle pour 6 gateways paiement Maroc.
// Implemente par : CmiGateway (3.4.3), YouCanPayGateway (3.4.4), PayZoneGateway (3.4.5),
//                  InwiMoneyGateway (3.4.6), OrangeMoneyGateway (3.4.6), MWalletBamGateway (3.4.6).
// Consomme par : PaymentOrchestrator (3.4.7), webhook consumers (3.4.8).
//
// Reference : decision-019 (Pattern Strategy + Adapter)
// Reference : decision-014 (Idempotency-Key obligatoire)
// Reference no-emoji : decision-006

import type { PaymentProvider } from '../enums/payment-provider.enum';
import type {
  InitiatePaymentRequest, CapturePaymentRequest, RefundRequest, CancelPaymentRequest,
} from '../types/gateway-requests';
import type {
  InitiatePaymentResult, PaymentStatus, CaptureResult, RefundResult, WebhookVerificationResult,
} from '../types/gateway-results';

/**
 * Interface abstraite consommee par PaymentOrchestrator (Tache 3.4.7).
 *
 * Toutes les implementations DOIVENT respecter strictement les contracts suivants :
 *
 * 1. `initiate(req)` : appelle le provider pour creer une transaction. Doit etre IDEMPOTENT
 *    via `req.idempotencyKey` -- meme idempotency_key sur 2 appels = meme resultat.
 *    Throw `GatewayUnavailableError` si network/5xx -> orchestrateur fallback next provider.
 *    Throw `GatewayInvalidRequestError` si 4xx -> orchestrateur abort (config tenant pb).
 *    Throw `GatewayCardDeclinedError` si decline carte -> abort, message user.
 *    Throw `GatewayInsufficientFundsError` si fonds insuffisants -> abort, message user.
 *    Throw `GatewayFraudDetectedError` si provider detecte fraude -> abort, audit + SOC alert.
 *    Throw `GatewayTimeoutError` si timeout > getTimeoutMs() -> orchestrateur fallback.
 *
 * 2. `getStatus(providerTxnId)` : query provider pour status transaction.
 *    Utilise par jobs polling wallet (Tache 3.4.12) et reconciliation (Tache 3.4.10).
 *    Doit etre IDEMPOTENT (peut etre appele plusieurs fois).
 *
 * 3. `capture(providerTxnId, amount?)` : capture transaction authorized (cards 2-step).
 *    Optional method ; gateways 1-step (wallets, PayZone cash) throw NotImplementedError.
 *    @param amount montant capture (default = full amount autorise)
 *
 * 4. `refund(providerTxnId, amount, reason)` : refund partial ou full.
 *    Throw `GatewayInvalidRequestError` si transaction status incompatible.
 *    Doit etre IDEMPOTENT via internal idempotency_key (prevent double-refund).
 *
 * 5. `cancel(providerTxnId)` : annule transaction PRE-capture (libere authorization).
 *    Throw error si deja captured (use refund() instead).
 *
 * 6. `verifyWebhookSignature(rawBody, signature)` : verify HMAC ou hash provider-specific.
 *    Doit utiliser timingSafeEqual pour eviter timing attacks.
 *    Returns { valid: boolean, reason?: string, webhookEventId?: string }.
 */
export interface PaymentGatewayInterface {
  /**
   * Identification du provider (lecture seule).
   * Utilise par GatewayRegistry pour mapping provider -> instance.
   */
  readonly provider: PaymentProvider;

  /**
   * Initie une transaction paiement.
   * @param request DTO valid (deja Zod-parsed cote orchestrateur)
   * @returns provider_transaction_id + redirect URL ou form_data ou QR code ou voucher
   * @throws GatewayUnavailableError si provider injoignable (network, 5xx, circuit OPEN)
   * @throws GatewayInvalidRequestError si 4xx (credentials, payload invalide)
   * @throws GatewayCardDeclinedError si carte declinee (4xx specifique)
   * @throws GatewayInsufficientFundsError si fonds insuffisants
   * @throws GatewayFraudDetectedError si provider detecte fraude
   * @throws GatewayTimeoutError si timeout > getTimeoutMs()
   */
  initiate(request: InitiatePaymentRequest): Promise<InitiatePaymentResult>;

  /**
   * Recupere le status courant d'une transaction cote provider.
   * Utile pour reconciliation, polling wallet, audit.
   */
  getStatus(providerTransactionId: string): Promise<PaymentStatus>;

  /**
   * Capture une transaction authorized (cards 2-step uniquement).
   * Optional method ; gateways 1-step (wallets, PayZone cash) throw NotImplementedError.
   * @param amount montant capture (default = full amount autorise)
   */
  capture?(providerTransactionId: string, amount?: number): Promise<CaptureResult>;

  /**
   * Refund partial ou full.
   * @param amount montant a refunder (>= 0.01, <= refundable)
   * @param reason audit reason mandatory
   */
  refund(providerTransactionId: string, amount: number, reason: string): Promise<RefundResult>;

  /**
   * Annule une transaction PRE-capture (libere authorization carte).
   * Pour transactions deja captured : utiliser refund() a la place.
   */
  cancel(providerTransactionId: string): Promise<void>;

  /**
   * Verify HMAC/hash signature webhook payload provider.
   * @param rawBody Buffer bytes du body HTTP raw (avant parsing JSON)
   * @param signature Header X-Signature (ou equivalent provider) recu
   * @returns true si signature valide, false sinon (logged WARN dans BaseGateway)
   *
   * Implementation DOIT utiliser crypto.timingSafeEqual() (anti timing attack).
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): WebhookVerificationResult;
}

/**
 * Marker interface pour gateways supporting 2-step (auth + capture).
 * Permet narrowing TypeScript : `if (gateway.supports2Step) { gateway.capture(...) }`.
 */
export interface TwoStepGateway extends PaymentGatewayInterface {
  readonly supports2Step: true;
  capture(providerTransactionId: string, amount?: number): Promise<CaptureResult>;
}

/**
 * Marker interface pour gateways supporting QR code generation (mobile wallets).
 */
export interface QrCodeGateway extends PaymentGatewayInterface {
  readonly supportsQrCode: true;
}

/**
 * Marker interface pour gateways supporting cash voucher (PayZone).
 */
export interface CashVoucherGateway extends PaymentGatewayInterface {
  readonly supportsCashVoucher: true;
  generateVoucherPdf(providerTransactionId: string): Promise<Buffer>;
}

/**
 * Type guard helpers pour narrowing capabilities.
 */
export function isTwoStepGateway(gw: PaymentGatewayInterface): gw is TwoStepGateway {
  return (gw as TwoStepGateway).supports2Step === true;
}

export function isQrCodeGateway(gw: PaymentGatewayInterface): gw is QrCodeGateway {
  return (gw as QrCodeGateway).supportsQrCode === true;
}

export function isCashVoucherGateway(gw: PaymentGatewayInterface): gw is CashVoucherGateway {
  return (gw as CashVoucherGateway).supportsCashVoucher === true;
}
```

### 6.2 Fichier 2/15 : `repo/packages/pay/src/types/gateway-requests.ts`

```typescript
// repo/packages/pay/src/types/gateway-requests.ts
//
// DTO requests passees aux methodes PaymentGatewayInterface.
// Ces types sont des interfaces pures (pas de Zod runtime).
// Validation runtime se fait au niveau orchestrator/controller via Zod schemas (Tache 3.4.1).

import type { Currency } from '../enums/currency.enum';

export interface InitiatePaymentRequest {
  /** Montant en MAD avec 2 decimales precision (e.g. 1500.50). */
  amount: number;

  /** Currency (MAD only MVP). */
  currency: Currency;

  /** Idempotency key ULID 26 chars (decision-014). UNIQUE per tenant. */
  idempotencyKey: string;

  /** Email customer (RFC 5322 valide, lowercase). */
  customerEmail: string;

  /** Phone customer en format E.164 (+212XXXXXXXXX). Required pour wallets. */
  customerPhone?: string;

  /** Nom customer affiche sur recu provider. */
  customerName?: string;

  /** Description courte transaction (255 chars max). */
  description?: string;

  /** URL post-payment success (HTTPS strict). */
  returnUrl: string;

  /** URL post-payment cancel/fail. */
  cancelUrl: string;

  /** Reference business : invoice/police/devis. */
  relatedResourceType?: 'invoice' | 'police' | 'devis' | 'repair_invoice' | 'subscription';
  relatedResourceId?: string;

  /** Tenant_id propage pour audit logs et headers provider tracking. */
  tenantId: string;

  /** Locale customer pour UI provider (CMI 3DS page) : 'fr', 'ar', 'en'. */
  locale?: 'fr' | 'ar' | 'en';

  /** Metadata provider-specific opaque (sans PII). */
  metadata?: Record<string, unknown>;
}

export interface CapturePaymentRequest {
  providerTransactionId: string;
  /** Amount partial capture (default = full authorized amount). */
  amount?: number;
}

export interface RefundRequest {
  providerTransactionId: string;
  amount: number;
  reason: string;
  /** Idempotency key for refund operation (different from original transaction). */
  idempotencyKey?: string;
}

export interface CancelPaymentRequest {
  providerTransactionId: string;
  reason?: string;
}
```

### 6.3 Fichier 3/15 : `repo/packages/pay/src/types/gateway-results.ts`

```typescript
// repo/packages/pay/src/types/gateway-results.ts
//
// DTO results retournes par PaymentGatewayInterface methods.

export interface InitiatePaymentResult {
  /** ID transaction cote provider (recu apres POST initiate). */
  providerTransactionId: string;

  /**
   * Mode redirection vers provider :
   * - 'redirect_url' : provider URL ou rediriger user (most cases cards 3DS).
   * - 'form_post' : provider exige POST form, frontend cree <form action="..." method="POST"> hidden.
   * - 'qr_code' : provider retourne data URI image PNG QR (wallets STK push).
   * - 'cash_voucher' : provider retourne URL PDF voucher (PayZone).
   */
  redirectMode: 'redirect_url' | 'form_post' | 'qr_code' | 'cash_voucher';

  /** URL ou rediriger user (mode redirect_url, form_post action). */
  redirectUrl?: string;

  /** Form data fields (mode form_post). Hidden inputs auto-submitted. */
  formData?: Record<string, string>;

  /** QR code data URI image PNG (mode qr_code). */
  qrCode?: string;

  /** Voucher PDF URL (mode cash_voucher), TTL 7 jours. */
  voucherPdfUrl?: string;

  /** Voucher barcode value text (mode cash_voucher). */
  voucherBarcode?: string;

  /** Voucher expiration. */
  voucherExpiresAt?: Date;

  /** Provider reference humain readable (e.g. order_id CMI). */
  providerReference?: string;

  /** Metadata libre (provider-specific). */
  metadata: Record<string, unknown>;
}

export interface PaymentStatus {
  providerTransactionId: string;
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'cancelled' | 'refunded' | 'partially_refunded';
  amount: number;
  capturedAmount?: number;
  refundedAmount?: number;
  authorizationCode?: string;
  failureReason?: string;
  threeDSecureStatus?: 'authenticated' | 'not_authenticated' | 'attempted' | 'unavailable';
  feesAmount?: number;
  capturedAt?: Date;
  authorizedAt?: Date;
  failedAt?: Date;
  refundedAt?: Date;
  /** Raw provider response pour audit (peut etre verbose). */
  rawProviderResponse: Record<string, unknown>;
}

export interface CaptureResult {
  providerTransactionId: string;
  capturedAmount: number;
  authorizationCode: string;
  feesAmount?: number;
  capturedAt: Date;
}

export interface RefundResult {
  providerTransactionId: string;
  providerRefundId: string;
  refundedAmount: number;
  refundedAt: Date;
  rawProviderResponse: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  valid: boolean;
  reason?: string;
  /** ID extracted from webhook payload pour idempotency. */
  webhookEventId?: string;
}
```

### 6.4 Fichier 4/15 : `repo/packages/pay/src/errors/gateway-error.ts`

```typescript
// repo/packages/pay/src/errors/gateway-error.ts
//
// Base class pour 8 sous-classes erreurs gateway.
// Fournit metadata commune (provider, timestamp, providerHttpStatus, providerErrorCode)
// + serialization safe (no leak credentials).

import type { PaymentProvider } from '../enums/payment-provider.enum';

export interface GatewayErrorOptions {
  /** Provider qui a retourne l'erreur. */
  provider: PaymentProvider;
  /** HTTP status code provider (si applicable). */
  providerHttpStatus?: number;
  /** Error code raw provider (e.g. CMI ProcReturnCode). */
  providerErrorCode?: string;
  /** Message raw provider (peut contenir PII -- redacte avant log). */
  providerErrorMessage?: string;
  /** Request_id provider pour support technique. */
  providerRequestId?: string;
  /** Original cause Error (e.g. undici NetworkError). */
  cause?: Error;
  /** Metadata supplementaire (e.g. attempt count). */
  metadata?: Record<string, unknown>;
}

/**
 * Base abstraite pour tous les gateway errors.
 * NE JAMAIS throw directement -- utiliser sous-classes typees.
 */
export abstract class GatewayError extends Error {
  abstract readonly code: string;
  /** True si l'orchestrateur peut retry next provider. */
  abstract readonly isFallbackEligible: boolean;
  /** True si la transaction est definitivement perdue (vs retryable). */
  abstract readonly isFinal: boolean;
  /** Message a afficher a l'utilisateur final (i18n key recommande). */
  abstract readonly userMessage: string;

  readonly provider: PaymentProvider;
  readonly providerHttpStatus?: number;
  readonly providerErrorCode?: string;
  readonly providerRequestId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly occurredAt: Date;

  constructor(message: string, options: GatewayErrorOptions) {
    super(message, { cause: options.cause });
    this.name = this.constructor.name;
    this.provider = options.provider;
    this.providerHttpStatus = options.providerHttpStatus;
    this.providerErrorCode = options.providerErrorCode;
    this.providerRequestId = options.providerRequestId;
    this.metadata = options.metadata;
    this.occurredAt = new Date();
  }

  /**
   * Serialize pour logs Pino structure (sans cause stack pour eviter leak).
   */
  toLogJson(): Record<string, unknown> {
    return {
      error_class: this.name,
      error_code: this.code,
      provider: this.provider,
      provider_http_status: this.providerHttpStatus,
      provider_error_code: this.providerErrorCode,
      provider_request_id: this.providerRequestId,
      is_fallback_eligible: this.isFallbackEligible,
      is_final: this.isFinal,
      occurred_at: this.occurredAt.toISOString(),
      metadata: this.metadata,
    };
  }
}
```

### 6.5 Fichier 5/15 : Errors specifiques

```typescript
// repo/packages/pay/src/errors/gateway-unavailable.error.ts
import { GatewayError, type GatewayErrorOptions } from './gateway-error';

/**
 * Gateway temporairement indisponible (network error, 5xx, circuit OPEN).
 * ELIGIBLE FALLBACK : orchestrateur retry next provider.
 */
export class GatewayUnavailableError extends GatewayError {
  readonly code = 'GATEWAY_UNAVAILABLE';
  readonly isFallbackEligible = true;
  readonly isFinal = false;
  readonly userMessage = 'Le service de paiement est temporairement indisponible. Veuillez reessayer.';

  constructor(message: string, options: GatewayErrorOptions) {
    super(message, options);
  }

  static fromNetworkError(provider: GatewayErrorOptions['provider'], cause: Error): GatewayUnavailableError {
    return new GatewayUnavailableError(
      `Network error contacting ${provider}: ${cause.message}`,
      { provider, cause },
    );
  }

  static fromHttpStatus(
    provider: GatewayErrorOptions['provider'],
    httpStatus: number,
    body?: string,
  ): GatewayUnavailableError {
    return new GatewayUnavailableError(
      `Provider ${provider} returned HTTP ${httpStatus}`,
      {
        provider,
        providerHttpStatus: httpStatus,
        metadata: { responseBody: body?.slice(0, 500) },
      },
    );
  }

  static fromCircuitOpen(provider: GatewayErrorOptions['provider'], cooldownMs: number): GatewayUnavailableError {
    return new GatewayUnavailableError(
      `Circuit breaker OPEN for ${provider} (cooldown ${cooldownMs}ms)`,
      { provider, metadata: { circuit_state: 'OPEN', cooldown_ms: cooldownMs } },
    );
  }
}

// repo/packages/pay/src/errors/gateway-invalid-request.error.ts
import { GatewayError, type GatewayErrorOptions } from './gateway-error';

export class GatewayInvalidRequestError extends GatewayError {
  readonly code = 'GATEWAY_INVALID_REQUEST';
  readonly isFallbackEligible = false; // pas de retry next provider, config probleme
  readonly isFinal = true;
  readonly userMessage = 'Erreur de configuration du paiement. Contactez le support.';
  constructor(message: string, options: GatewayErrorOptions) { super(message, options); }
}

// repo/packages/pay/src/errors/gateway-card-declined.error.ts
import { GatewayError, type GatewayErrorOptions } from './gateway-error';

export type CardDeclineReason =
  | 'insufficient_funds' | 'expired_card' | 'invalid_cvv' | 'card_blocked'
  | 'limit_exceeded' | 'do_not_honor' | 'unknown';

export class GatewayCardDeclinedError extends GatewayError {
  readonly code = 'GATEWAY_CARD_DECLINED';
  readonly isFallbackEligible = false; // user doit utiliser autre carte
  readonly isFinal = true;
  readonly userMessage = 'Votre carte a ete refusee. Verifiez vos informations ou utilisez une autre carte.';
  readonly declineReason: CardDeclineReason;
  constructor(message: string, declineReason: CardDeclineReason, options: GatewayErrorOptions) {
    super(message, options);
    this.declineReason = declineReason;
  }
}

// repo/packages/pay/src/errors/gateway-insufficient-funds.error.ts
import { GatewayError, type GatewayErrorOptions } from './gateway-error';

export class GatewayInsufficientFundsError extends GatewayError {
  readonly code = 'GATEWAY_INSUFFICIENT_FUNDS';
  readonly isFallbackEligible = false;
  readonly isFinal = true;
  readonly userMessage = 'Fonds insuffisants. Veuillez utiliser un autre moyen de paiement.';
  constructor(message: string, options: GatewayErrorOptions) { super(message, options); }
}

// repo/packages/pay/src/errors/gateway-fraud-detected.error.ts
import { GatewayError, type GatewayErrorOptions } from './gateway-error';

export class GatewayFraudDetectedError extends GatewayError {
  readonly code = 'GATEWAY_FRAUD_DETECTED';
  readonly isFallbackEligible = false;
  readonly isFinal = true;
  readonly userMessage = 'Transaction refusee pour des raisons de securite. Contactez votre banque.';
  readonly fraudFlags: string[];
  constructor(message: string, fraudFlags: string[], options: GatewayErrorOptions) {
    super(message, options);
    this.fraudFlags = fraudFlags;
  }
}

// repo/packages/pay/src/errors/gateway-three-d-secure-failed.error.ts
import { GatewayError, type GatewayErrorOptions } from './gateway-error';

export class GatewayThreeDSecureFailedError extends GatewayError {
  readonly code = 'GATEWAY_3DS_FAILED';
  readonly isFallbackEligible = false;
  readonly isFinal = true;
  readonly userMessage = 'Authentification 3D Secure echouee. Verifiez votre code SMS ou application bancaire.';
  constructor(message: string, options: GatewayErrorOptions) { super(message, options); }
}

// repo/packages/pay/src/errors/gateway-timeout.error.ts
import { GatewayError, type GatewayErrorOptions } from './gateway-error';

export class GatewayTimeoutError extends GatewayError {
  readonly code = 'GATEWAY_TIMEOUT';
  readonly isFallbackEligible = true; // peut retry next provider
  readonly isFinal = false;
  readonly userMessage = 'Le service de paiement met du temps a repondre. Veuillez reessayer.';
  readonly timeoutMs: number;
  constructor(timeoutMs: number, options: GatewayErrorOptions) {
    super(`Gateway timeout after ${timeoutMs}ms`, options);
    this.timeoutMs = timeoutMs;
  }
}

// repo/packages/pay/src/errors/gateway-webhook-signature-invalid.error.ts
import { GatewayError, type GatewayErrorOptions } from './gateway-error';

export class GatewayWebhookSignatureInvalidError extends GatewayError {
  readonly code = 'WEBHOOK_SIGNATURE_INVALID';
  readonly isFallbackEligible = false;
  readonly isFinal = true;
  readonly userMessage = 'Erreur webhook. Veuillez contacter le support.';
  readonly receivedSignaturePrefix: string;
  constructor(receivedSignature: string, options: GatewayErrorOptions) {
    super('Webhook signature verification failed', options);
    this.receivedSignaturePrefix = receivedSignature.slice(0, 8) + '...'; // log safe
  }
}
```

### 6.6 Fichier 6/15 : `repo/packages/pay/src/gateways/base-gateway.ts`

La classe abstraite coeur. ~280 lignes avec metrics + tracing.

```typescript
// repo/packages/pay/src/gateways/base-gateway.ts
//
// Abstract base class pour 6 gateways concretes.
// Mutualise : undici Pool, retry policy, circuit breaker, logging Pino redact, error normalization,
//             metrics Prometheus, OpenTelemetry tracing.
//
// Reference : decision-019, 020, 021.

import { Pool, Dispatcher } from 'undici';
import { Logger, pino } from 'pino';
import type { PaymentProvider } from '../enums/payment-provider.enum';
import type { PaymentGatewayInterface } from '../interfaces/payment-gateway.interface';
import type {
  InitiatePaymentRequest,
} from '../types/gateway-requests';
import type {
  InitiatePaymentResult, PaymentStatus, CaptureResult, RefundResult, WebhookVerificationResult,
} from '../types/gateway-results';
import { RetryPolicy } from '../helpers/retry-policy.helper';
import { CircuitBreaker, CircuitState } from '../helpers/circuit-breaker.helper';
import { LOG_REDACT_PATHS } from '../helpers/log-redactor.helper';
import { GatewayMetrics } from '../helpers/gateway-metrics.helper';
import { GatewayUnavailableError } from '../errors/gateway-unavailable.error';
import { GatewayTimeoutError } from '../errors/gateway-timeout.error';
import { GatewayInvalidRequestError } from '../errors/gateway-invalid-request.error';

export interface BaseGatewayOptions {
  baseUrl: string;
  timeoutMs?: number;
  poolConnections?: number;
  retryMaxAttempts?: number;
  retryBaseDelayMs?: number;
  circuitFailThreshold?: number;
  circuitCooldownMs?: number;
  circuitGracePeriodMs?: number;
  maxResponseSizeBytes?: number;
  logger?: Logger;
  dispatcher?: Dispatcher;
  metrics?: GatewayMetrics;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_POOL_CONNECTIONS = 20;
const DEFAULT_RETRY_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_CIRCUIT_FAIL_THRESHOLD = 5;
const DEFAULT_CIRCUIT_COOLDOWN_MS = 30000;
const DEFAULT_CIRCUIT_GRACE_PERIOD_MS = 60000;
const DEFAULT_MAX_RESPONSE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Abstract base class. Concrete providers extends this.
 */
export abstract class BaseGateway implements PaymentGatewayInterface {
  abstract readonly provider: PaymentProvider;

  protected readonly baseUrl: string;
  protected readonly timeoutMs: number;
  protected readonly maxResponseSizeBytes: number;
  protected readonly logger: Logger;
  protected readonly retry: RetryPolicy;
  protected readonly circuit: CircuitBreaker;
  protected readonly pool: Pool | null;
  protected readonly dispatcher: Dispatcher;
  protected readonly metrics: GatewayMetrics | null;

  constructor(options: BaseGatewayOptions) {
    if (!/^https:\/\//.test(options.baseUrl)) {
      throw new Error(`BaseGateway requires HTTPS baseUrl: ${options.baseUrl}`);
    }
    // Strip trailing slash to avoid double slash in paths
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxResponseSizeBytes = options.maxResponseSizeBytes ?? DEFAULT_MAX_RESPONSE_SIZE_BYTES;
    this.logger = (options.logger ?? pino({ redact: { paths: LOG_REDACT_PATHS, censor: '[REDACTED]' } })).child({
      component: 'gateway',
      provider: 'pending', // override in subclass via this.logger.child after super()
    });
    this.retry = new RetryPolicy({
      maxAttempts: options.retryMaxAttempts ?? DEFAULT_RETRY_MAX_ATTEMPTS,
      baseDelayMs: options.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS,
    });
    this.circuit = new CircuitBreaker({
      failThreshold: options.circuitFailThreshold ?? DEFAULT_CIRCUIT_FAIL_THRESHOLD,
      cooldownMs: options.circuitCooldownMs ?? DEFAULT_CIRCUIT_COOLDOWN_MS,
      gracePeriodMs: options.circuitGracePeriodMs ?? DEFAULT_CIRCUIT_GRACE_PERIOD_MS,
    });
    this.metrics = options.metrics ?? null;
    if (options.dispatcher) {
      this.dispatcher = options.dispatcher;
      this.pool = null;
    } else {
      this.pool = new Pool(this.baseUrl, {
        connections: options.poolConnections ?? DEFAULT_POOL_CONNECTIONS,
        connectTimeout: this.timeoutMs,
        keepAliveTimeout: 60000,
      });
      this.dispatcher = this.pool;
    }
  }

  // === Abstract methods (concrete providers MUST implement) ===
  abstract initiate(request: InitiatePaymentRequest): Promise<InitiatePaymentResult>;
  abstract getStatus(providerTransactionId: string): Promise<PaymentStatus>;
  abstract refund(providerTransactionId: string, amount: number, reason: string): Promise<RefundResult>;
  abstract cancel(providerTransactionId: string): Promise<void>;
  abstract verifyWebhookSignature(rawBody: Buffer, signature: string): WebhookVerificationResult;

  /**
   * Optional capture (cards 2-step). Default impl throws.
   * Override par CmiGateway, YouCanGateway, PayZoneGateway.
   */
  async capture?(_providerTransactionId: string, _amount?: number): Promise<CaptureResult> {
    throw new Error(`capture() not supported by ${this.provider}`);
  }

  // === Template method : makeRequest with retry + circuit + logging + timeout + metrics ===
  /**
   * Effectue une requete HTTP vers le provider avec :
   *  1. Circuit breaker check
   *  2. Retry policy avec exponential backoff + jitter
   *  3. Timeout strict (AbortController)
   *  4. Logging structured (request/response/error) avec redact
   *  5. Error normalization (HTTP status -> typed errors)
   *  6. Metrics Prometheus (duration histogram, counter success/error)
   */
  protected async makeRequest(options: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    body?: string | Buffer | Uint8Array;
    headers?: Record<string, string>;
    expectStatus?: number[];
    operationName: string;
  }): Promise<{ statusCode: number; body: Buffer; headers: Record<string, string> }> {
    if (this.circuit.getState() === CircuitState.OPEN) {
      this.metrics?.incrementCircuitRejected(this.provider, options.operationName);
      throw GatewayUnavailableError.fromCircuitOpen(this.provider, this.circuit.getCooldownRemaining());
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.retry.getMaxAttempts(); attempt++) {
      const abortController = new AbortController();
      const timeoutHandle = setTimeout(() => abortController.abort(), this.timeoutMs);
      const startTime = Date.now();

      try {
        this.logger.debug({
          operation: options.operationName,
          method: options.method,
          path: options.path,
          attempt,
          headers: options.headers,
          body_size: options.body?.length,
        }, 'gateway_request_start');

        const response = await this.dispatcher.request({
          origin: this.baseUrl,
          path: options.path,
          method: options.method,
          headers: options.headers,
          body: options.body,
          signal: abortController.signal,
          throwOnError: false,
        });

        clearTimeout(timeoutHandle);
        const responseBody = await this.readResponseBody(response.body);
        const durationMs = Date.now() - startTime;

        this.logger.info({
          operation: options.operationName,
          method: options.method,
          path: options.path,
          attempt,
          status_code: response.statusCode,
          duration_ms: durationMs,
          body_size: responseBody.length,
        }, 'gateway_request_success');

        this.metrics?.observeRequestDuration(this.provider, options.operationName, response.statusCode, durationMs);

        if (response.statusCode >= 500) {
          lastError = GatewayUnavailableError.fromHttpStatus(this.provider, response.statusCode, responseBody.toString('utf-8').slice(0, 200));
          if (this.retry.shouldRetry(attempt, response.statusCode)) {
            await this.retry.delay(attempt);
            continue;
          }
          this.circuit.recordFailure();
          this.metrics?.incrementError(this.provider, options.operationName, '5xx');
          throw lastError;
        }

        if (response.statusCode >= 400) {
          this.circuit.recordSuccess(); // 4xx = client fault, not provider fault
          this.metrics?.incrementError(this.provider, options.operationName, '4xx');
          throw new GatewayInvalidRequestError(
            `Provider ${this.provider} returned ${response.statusCode}`,
            { provider: this.provider, providerHttpStatus: response.statusCode, metadata: { responseBody: responseBody.toString('utf-8').slice(0, 500) } },
          );
        }

        if (options.expectStatus && !options.expectStatus.includes(response.statusCode)) {
          throw new GatewayInvalidRequestError(
            `Unexpected status ${response.statusCode}, expected ${options.expectStatus.join(',')}`,
            { provider: this.provider, providerHttpStatus: response.statusCode },
          );
        }

        this.circuit.recordSuccess();
        this.metrics?.incrementSuccess(this.provider, options.operationName);
        return {
          statusCode: response.statusCode,
          body: responseBody,
          headers: response.headers as Record<string, string>,
        };
      } catch (err) {
        clearTimeout(timeoutHandle);
        const durationMs = Date.now() - startTime;

        if (err instanceof GatewayInvalidRequestError) throw err;

        if (abortController.signal.aborted) {
          this.circuit.recordFailure();
          this.metrics?.incrementError(this.provider, options.operationName, 'timeout');
          throw new GatewayTimeoutError(this.timeoutMs, { provider: this.provider, cause: err as Error });
        }

        const isLastAttempt = attempt === this.retry.getMaxAttempts() - 1;
        this.logger.warn({
          operation: options.operationName,
          attempt,
          error: (err as Error).message,
          duration_ms: durationMs,
          is_last_attempt: isLastAttempt,
        }, 'gateway_request_error');

        lastError = err as Error;
        if (isLastAttempt) {
          this.circuit.recordFailure();
          this.metrics?.incrementError(this.provider, options.operationName, 'network');
          if (lastError instanceof GatewayUnavailableError) throw lastError;
          throw GatewayUnavailableError.fromNetworkError(this.provider, lastError);
        }
        await this.retry.delay(attempt);
      }
    }

    this.circuit.recordFailure();
    throw lastError ?? new Error('Unknown gateway error');
  }

  protected async readResponseBody(body: Dispatcher.ResponseData['body']): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of body) {
      const chunkBuffer = Buffer.from(chunk);
      totalSize += chunkBuffer.length;
      if (totalSize > this.maxResponseSizeBytes) {
        throw new Error(`Response body exceeds max size ${this.maxResponseSizeBytes} bytes`);
      }
      chunks.push(chunkBuffer);
    }
    return Buffer.concat(chunks);
  }

  /** Cleanup resources at shutdown. */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
    }
  }

  /** Health check : returns circuit state for monitoring. */
  getHealth(): { provider: string; circuitState: string; cooldownRemaining: number } {
    return {
      provider: this.provider,
      circuitState: this.circuit.getState(),
      cooldownRemaining: this.circuit.getCooldownRemaining(),
    };
  }
}
```

### 6.7 Fichier 7/15 : `repo/packages/pay/src/helpers/retry-policy.helper.ts`

```typescript
// repo/packages/pay/src/helpers/retry-policy.helper.ts
//
// Retry policy avec exponential backoff + jitter.

export interface RetryPolicyOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  jitterRatio?: number;
}

export class RetryPolicy {
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly jitterRatio: number;

  constructor(options: RetryPolicyOptions) {
    if (options.maxAttempts < 1) throw new Error('maxAttempts must be >= 1');
    if (options.baseDelayMs < 0) throw new Error('baseDelayMs must be >= 0');
    this.maxAttempts = options.maxAttempts;
    this.baseDelayMs = options.baseDelayMs;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.jitterRatio = options.jitterRatio ?? 0.25;
  }

  getMaxAttempts(): number {
    return this.maxAttempts;
  }

  /**
   * Decide si retry attempt devrait avoir lieu pour un statut HTTP donne.
   * Retry uniquement sur 5xx + 429 (Too Many Requests).
   * Pas de retry sur 4xx autres (client error definitif).
   */
  shouldRetry(attempt: number, httpStatus?: number): boolean {
    if (attempt + 1 >= this.maxAttempts) return false;
    if (httpStatus === undefined) return true; // network error, retry
    if (httpStatus === 429) return true;
    if (httpStatus >= 500 && httpStatus < 600) return true;
    return false;
  }

  /**
   * Compute delay avant prochain retry.
   * Exponential : delay = base * 2^attempt + jitter.
   */
  computeDelayMs(attempt: number): number {
    const exponential = this.baseDelayMs * Math.pow(2, attempt);
    const capped = Math.min(exponential, this.maxDelayMs);
    const jitter = capped * this.jitterRatio * Math.random();
    return Math.floor(capped + jitter);
  }

  /**
   * Sleep helper.
   */
  async delay(attempt: number): Promise<void> {
    const ms = this.computeDelayMs(attempt);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 6.8 Fichier 8/15 : `repo/packages/pay/src/helpers/circuit-breaker.helper.ts`

```typescript
// repo/packages/pay/src/helpers/circuit-breaker.helper.ts
//
// Circuit breaker state machine.
// CLOSED: normal traffic, requests passent
// OPEN: provider down detecte, requests fail fast
// HALF_OPEN: cooldown ecoule, 1 test request autorise

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failThreshold: number;
  cooldownMs: number;
  gracePeriodMs?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failCount: number = 0;
  private lastFailTime: number = 0;
  private readonly initTime: number = Date.now();
  private readonly failThreshold: number;
  private readonly cooldownMs: number;
  private readonly gracePeriodMs: number;

  constructor(options: CircuitBreakerOptions) {
    if (options.failThreshold < 1) throw new Error('failThreshold must be >= 1');
    if (options.cooldownMs < 0) throw new Error('cooldownMs must be >= 0');
    this.failThreshold = options.failThreshold;
    this.cooldownMs = options.cooldownMs;
    this.gracePeriodMs = options.gracePeriodMs ?? 0;
  }

  getState(): CircuitState {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailTime >= this.cooldownMs) {
        this.state = CircuitState.HALF_OPEN;
      }
    }
    return this.state;
  }

  getCooldownRemaining(): number {
    if (this.state !== CircuitState.OPEN) return 0;
    const elapsed = Date.now() - this.lastFailTime;
    return Math.max(0, this.cooldownMs - elapsed);
  }

  recordSuccess(): void {
    this.failCount = 0;
    this.state = CircuitState.CLOSED;
  }

  recordFailure(): void {
    if (Date.now() - this.initTime < this.gracePeriodMs) {
      // Grace period at boot : ignore failures
      return;
    }
    this.failCount += 1;
    this.lastFailTime = Date.now();
    if (this.failCount >= this.failThreshold) {
      this.state = CircuitState.OPEN;
    }
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failCount = 0;
    this.lastFailTime = 0;
  }

  getFailCount(): number {
    return this.failCount;
  }
}
```

### 6.9 Fichier 9/15 : `repo/packages/pay/src/helpers/request-signer.helper.ts`

```typescript
// repo/packages/pay/src/helpers/request-signer.helper.ts
//
// HMAC signature helpers timing-safe.

import { createHmac, createHash, timingSafeEqual } from 'crypto';

export class RequestSigner {
  /** Compute HMAC-SHA256. */
  static hmacSha256(secret: string, payload: string | Buffer): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  /** Compute HMAC-SHA512. */
  static hmacSha512(secret: string, payload: string | Buffer): string {
    return createHmac('sha512', secret).update(payload).digest('hex');
  }

  /** Compute SHA-512 hash (CMI-style). */
  static sha512(payload: string): string {
    return createHash('sha512').update(payload).digest('base64');
  }

  /** Compute SHA-256 hash. */
  static sha256(payload: string): string {
    return createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Timing-safe comparison of signatures.
   * Use this for ALL signature verification (anti timing attack).
   */
  static verifyHmac(received: string, expected: string): boolean {
    if (received.length !== expected.length) return false;
    try {
      const a = Buffer.from(received, 'utf-8');
      const b = Buffer.from(expected, 'utf-8');
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  static verifyHmacSha256(secret: string, payload: string | Buffer, receivedSignature: string): boolean {
    const expected = this.hmacSha256(secret, payload);
    return this.verifyHmac(receivedSignature, expected);
  }

  static verifyHmacSha512(secret: string, payload: string | Buffer, receivedSignature: string): boolean {
    const expected = this.hmacSha512(secret, payload);
    return this.verifyHmac(receivedSignature, expected);
  }
}
```

### 6.10 Fichier 10/15 : `repo/packages/pay/src/helpers/log-redactor.helper.ts`

```typescript
// repo/packages/pay/src/helpers/log-redactor.helper.ts
//
// Pino redact paths : prevent leaking secrets in structured logs.

export const LOG_REDACT_PATHS: string[] = [
  // Headers sensibles
  'headers.authorization',
  'headers["x-api-key"]',
  'headers["x-cmi-clientid"]',
  'headers["x-cmi-storekey"]',
  'headers["x-youcan-secret"]',
  'headers["x-payzone-api-key"]',
  'headers["x-mwallet-participant-id"]',
  'headers.cookie',
  'headers["set-cookie"]',

  // Body fields sensibles
  'body.api_key',
  'body.client_secret',
  'body.private_key',
  'body.password',
  'body.HASH',
  'body.HASHPARAMSVAL',
  'body.storekey',
  'body.YOUCAN_PAY_PRIVATE_KEY',
  'body.YOUCAN_PAY_WEBHOOK_SECRET',

  // Card data (theoriquement jamais transit, mais defense profondeur)
  'body.cardNumber',
  'body.card_number',
  'body.pan',
  'body.cvv',
  'body.cvc',
  'body.expDate',
  'body.exp_date',

  // Recursif
  '*.api_key',
  '*.password',
  '*.secret',
  '*.private_key',
];

/**
 * Scrub stack traces to avoid leak.
 */
export function scrubSensitive(input: string): string {
  return input
    .replace(/api_key=[^&\s]+/gi, 'api_key=[REDACTED]')
    .replace(/password=[^&\s]+/gi, 'password=[REDACTED]')
    .replace(/secret=[^&\s]+/gi, 'secret=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9_\-.]{20,}/g, 'Bearer [REDACTED]')
    .replace(/\b[A-Za-z0-9_-]{30,}\b/g, '[REDACTED_TOKEN]'); // long tokens
}
```

### 6.11 Fichier 11/15 : `repo/packages/pay/src/helpers/gateway-metrics.helper.ts`

```typescript
// repo/packages/pay/src/helpers/gateway-metrics.helper.ts
//
// Prometheus metrics helpers for BaseGateway. Sprint 13 Analytics consume.

export interface GatewayMetrics {
  observeRequestDuration(provider: string, operation: string, statusCode: number, durationMs: number): void;
  incrementSuccess(provider: string, operation: string): void;
  incrementError(provider: string, operation: string, errorType: string): void;
  incrementCircuitRejected(provider: string, operation: string): void;
}

export class NoOpGatewayMetrics implements GatewayMetrics {
  observeRequestDuration(): void {}
  incrementSuccess(): void {}
  incrementError(): void {}
  incrementCircuitRejected(): void {}
}

export class PrometheusGatewayMetrics implements GatewayMetrics {
  constructor(private readonly histogram: any, private readonly counter: any) {}

  observeRequestDuration(provider: string, operation: string, statusCode: number, durationMs: number): void {
    this.histogram?.labels({ provider, operation, status: String(statusCode) }).observe(durationMs / 1000);
  }
  incrementSuccess(provider: string, operation: string): void {
    this.counter?.labels({ provider, operation, status: 'success' }).inc();
  }
  incrementError(provider: string, operation: string, errorType: string): void {
    this.counter?.labels({ provider, operation, status: 'error', error_type: errorType }).inc();
  }
  incrementCircuitRejected(provider: string, operation: string): void {
    this.counter?.labels({ provider, operation, status: 'circuit_rejected' }).inc();
  }
}
```

### 6.12 Fichier 12/15 : `repo/packages/pay/src/services/gateway-registry.service.ts`

```typescript
// repo/packages/pay/src/services/gateway-registry.service.ts
//
// Registry pattern : provider name -> instance gateway.

import type { PaymentGatewayInterface } from '../interfaces/payment-gateway.interface';
import type { PaymentProvider } from '../enums/payment-provider.enum';

export class GatewayRegistryError extends Error {
  constructor(message: string) { super(message); this.name = 'GatewayRegistryError'; }
}

export class GatewayRegistry {
  private readonly gateways: Map<PaymentProvider, PaymentGatewayInterface> = new Map();

  register(gateway: PaymentGatewayInterface): void {
    if (this.gateways.has(gateway.provider)) {
      throw new GatewayRegistryError(`Gateway ${gateway.provider} already registered`);
    }
    this.gateways.set(gateway.provider, gateway);
  }

  get(provider: PaymentProvider): PaymentGatewayInterface {
    const gw = this.gateways.get(provider);
    if (!gw) throw new GatewayRegistryError(`No gateway registered for provider: ${provider}`);
    return gw;
  }

  has(provider: PaymentProvider): boolean { return this.gateways.has(provider); }
  getAll(): PaymentGatewayInterface[] { return Array.from(this.gateways.values()); }

  validateAtBoot(expectedProviders: PaymentProvider[]): void {
    const missing = expectedProviders.filter((p) => !this.gateways.has(p));
    if (missing.length > 0) {
      throw new GatewayRegistryError(`Missing gateway implementations for: ${missing.join(', ')}`);
    }
  }

  getHealth(): Array<{ provider: string; circuitState: string; cooldownRemaining: number }> {
    return this.getAll().map(gw => {
      if (typeof (gw as any).getHealth === 'function') return (gw as any).getHealth();
      return { provider: gw.provider, circuitState: 'unknown', cooldownRemaining: 0 };
    });
  }

  async closeAll(): Promise<void> {
    for (const gw of this.gateways.values()) {
      const anyGw = gw as any;
      if (typeof anyGw.close === 'function') await anyGw.close();
    }
  }
}
```

### 6.13 Fichier 13/15 : Errors barrel + Index

```typescript
// repo/packages/pay/src/errors/index.ts
export { GatewayError, type GatewayErrorOptions } from './gateway-error';
export { GatewayUnavailableError } from './gateway-unavailable.error';
export { GatewayInvalidRequestError } from './gateway-invalid-request.error';
export { GatewayCardDeclinedError, type CardDeclineReason } from './gateway-card-declined.error';
export { GatewayInsufficientFundsError } from './gateway-insufficient-funds.error';
export { GatewayFraudDetectedError } from './gateway-fraud-detected.error';
export { GatewayThreeDSecureFailedError } from './gateway-three-d-secure-failed.error';
export { GatewayTimeoutError } from './gateway-timeout.error';
export { GatewayWebhookSignatureInvalidError } from './gateway-webhook-signature-invalid.error';
```

### 6.14 Fichier 14/15 : Index principal `@insurtech/pay`

```typescript
// repo/packages/pay/src/index.ts (additions Tache 3.4.2)
export * from './interfaces';
export * from './types';
export * from './errors';
export * from './gateways';
export { RetryPolicy } from './helpers/retry-policy.helper';
export { CircuitBreaker, CircuitState } from './helpers/circuit-breaker.helper';
export { RequestSigner } from './helpers/request-signer.helper';
export { LOG_REDACT_PATHS, scrubSensitive } from './helpers/log-redactor.helper';
export {
  type GatewayMetrics, NoOpGatewayMetrics, PrometheusGatewayMetrics,
} from './helpers/gateway-metrics.helper';
export * from './services';
```

### 6.15 Fichier 15/15 : `package.json` modifications

```json
{
  "name": "@insurtech/pay",
  "dependencies": {
    "ulid": "2.3.0",
    "zod": "3.24.1",
    "undici": "7.1.1",
    "pino": "9.6.0",
    "prom-client": "15.1.3",
    "date-fns": "4.1.0"
  }
}
```

---

## 7. Tests complets

### 7.1 Tests BaseGateway : `base-gateway.spec.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockAgent, setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import { BaseGateway } from '../base-gateway';
import { GatewayUnavailableError } from '../../errors/gateway-unavailable.error';
import { GatewayInvalidRequestError } from '../../errors/gateway-invalid-request.error';
import { GatewayTimeoutError } from '../../errors/gateway-timeout.error';
import { CircuitState } from '../../helpers/circuit-breaker.helper';

class TestGateway extends BaseGateway {
  readonly provider = 'cmi' as const;
  async initiate() { throw new Error('not impl'); }
  async getStatus() { throw new Error('not impl'); }
  async refund() { throw new Error('not impl'); }
  async cancel() { throw new Error('not impl'); }
  verifyWebhookSignature() { return { valid: false }; }
  async testMakeRequest(opts: any) { return this.makeRequest(opts); }
}

describe('BaseGateway', () => {
  let mockAgent: MockAgent;
  let originalDispatcher: any;

  beforeEach(() => {
    originalDispatcher = getGlobalDispatcher();
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
  });

  afterEach(() => { setGlobalDispatcher(originalDispatcher); });

  it('rejects HTTP baseUrl in constructor', () => {
    expect(() => new TestGateway({ baseUrl: 'http://provider.test' })).toThrow(/HTTPS/);
  });

  it('strips trailing slash from baseUrl', () => {
    const gw = new TestGateway({ baseUrl: 'https://provider.test/', dispatcher: mockAgent });
    expect((gw as any).baseUrl).toBe('https://provider.test');
  });

  it('returns 200 response body', async () => {
    const pool = mockAgent.get('https://provider.test');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(200, '{"ok":true}');
    const gw = new TestGateway({ baseUrl: 'https://provider.test', dispatcher: mockAgent });
    const res = await gw.testMakeRequest({ method: 'POST', path: '/api/initiate', operationName: 'test' });
    expect(res.statusCode).toBe(200);
    expect(res.body.toString()).toBe('{"ok":true}');
  });

  it('retries on 503 with exponential backoff', async () => {
    const pool = mockAgent.get('https://provider.test');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(503, '');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(503, '');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(200, '{"ok":true}');
    const gw = new TestGateway({
      baseUrl: 'https://provider.test', dispatcher: mockAgent,
      retryMaxAttempts: 3, retryBaseDelayMs: 10,
    });
    const res = await gw.testMakeRequest({ method: 'POST', path: '/api/initiate', operationName: 'test' });
    expect(res.statusCode).toBe(200);
  });

  it('throws GatewayUnavailableError after max retries', async () => {
    const pool = mockAgent.get('https://provider.test');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(503, '').times(3);
    const gw = new TestGateway({
      baseUrl: 'https://provider.test', dispatcher: mockAgent,
      retryMaxAttempts: 3, retryBaseDelayMs: 10,
    });
    await expect(gw.testMakeRequest({ method: 'POST', path: '/api/initiate', operationName: 'test' }))
      .rejects.toThrow(GatewayUnavailableError);
  });

  it('throws GatewayInvalidRequestError on 400 (no retry)', async () => {
    const pool = mockAgent.get('https://provider.test');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(400, '{"error":"invalid"}');
    const gw = new TestGateway({ baseUrl: 'https://provider.test', dispatcher: mockAgent });
    await expect(gw.testMakeRequest({ method: 'POST', path: '/api/initiate', operationName: 'test' }))
      .rejects.toThrow(GatewayInvalidRequestError);
  });

  it('does not retry on 4xx', async () => {
    const pool = mockAgent.get('https://provider.test');
    let callCount = 0;
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(() => { callCount++; return { statusCode: 401, data: '' }; });
    const gw = new TestGateway({ baseUrl: 'https://provider.test', dispatcher: mockAgent, retryMaxAttempts: 3, retryBaseDelayMs: 10 });
    await expect(gw.testMakeRequest({ method: 'POST', path: '/api/initiate', operationName: 'test' })).rejects.toThrow();
    expect(callCount).toBe(1);
  });

  it('opens circuit after 5 failures', async () => {
    const pool = mockAgent.get('https://provider.test');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(503, '').persist();
    const gw = new TestGateway({
      baseUrl: 'https://provider.test', dispatcher: mockAgent,
      retryMaxAttempts: 1, retryBaseDelayMs: 1,
      circuitFailThreshold: 5, circuitCooldownMs: 1000, circuitGracePeriodMs: 0,
    });
    for (let i = 0; i < 5; i++) {
      try { await gw.testMakeRequest({ method: 'POST', path: '/api/initiate', operationName: 'test' }); } catch {}
    }
    await expect(gw.testMakeRequest({ method: 'POST', path: '/api/initiate', operationName: 'test' }))
      .rejects.toThrow(GatewayUnavailableError);
  });

  it('respects custom timeout', async () => {
    const pool = mockAgent.get('https://provider.test');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(200, '').delay(2000);
    const gw = new TestGateway({ baseUrl: 'https://provider.test', dispatcher: mockAgent, timeoutMs: 100, retryMaxAttempts: 1 });
    await expect(gw.testMakeRequest({ method: 'POST', path: '/api/initiate', operationName: 'test' }))
      .rejects.toThrow(GatewayTimeoutError);
  });

  it('respects expectStatus', async () => {
    const pool = mockAgent.get('https://provider.test');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(204, '');
    const gw = new TestGateway({ baseUrl: 'https://provider.test', dispatcher: mockAgent, retryMaxAttempts: 1 });
    await expect(gw.testMakeRequest({
      method: 'POST', path: '/api/initiate', operationName: 'test', expectStatus: [200, 201],
    })).rejects.toThrow(GatewayInvalidRequestError);
  });

  it('getHealth returns circuit state', () => {
    const gw = new TestGateway({ baseUrl: 'https://provider.test', dispatcher: mockAgent });
    const health = gw.getHealth();
    expect(health.circuitState).toBe(CircuitState.CLOSED);
  });

  it('rejects body > maxResponseSizeBytes', async () => {
    const pool = mockAgent.get('https://provider.test');
    pool.intercept({ path: '/api/initiate', method: 'POST' }).reply(200, Buffer.alloc(2 * 1024 * 1024).toString());
    const gw = new TestGateway({ baseUrl: 'https://provider.test', dispatcher: mockAgent, maxResponseSizeBytes: 1 * 1024 * 1024, retryMaxAttempts: 1 });
    await expect(gw.testMakeRequest({ method: 'POST', path: '/api/initiate', operationName: 'test' })).rejects.toThrow(/exceeds max size/);
  });
});
```

### 7.2 Tests RetryPolicy : `retry-policy.helper.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { RetryPolicy } from '../retry-policy.helper';

describe('RetryPolicy', () => {
  const policy = new RetryPolicy({ maxAttempts: 3, baseDelayMs: 100 });

  it('rejects invalid maxAttempts', () => {
    expect(() => new RetryPolicy({ maxAttempts: 0, baseDelayMs: 100 })).toThrow();
  });

  it('rejects negative baseDelayMs', () => {
    expect(() => new RetryPolicy({ maxAttempts: 3, baseDelayMs: -1 })).toThrow();
  });

  it('shouldRetry returns true for 503', () => { expect(policy.shouldRetry(0, 503)).toBe(true); });
  it('shouldRetry returns true for 429', () => { expect(policy.shouldRetry(0, 429)).toBe(true); });
  it('shouldRetry returns false for 400', () => { expect(policy.shouldRetry(0, 400)).toBe(false); });
  it('shouldRetry returns false for 401', () => { expect(policy.shouldRetry(0, 401)).toBe(false); });
  it('shouldRetry returns false on last attempt', () => { expect(policy.shouldRetry(2, 503)).toBe(false); });
  it('shouldRetry returns true for network error', () => { expect(policy.shouldRetry(0)).toBe(true); });

  it('computeDelayMs is exponential', () => {
    const d0 = policy.computeDelayMs(0);
    const d1 = policy.computeDelayMs(1);
    const d2 = policy.computeDelayMs(2);
    expect(d0).toBeGreaterThanOrEqual(100);
    expect(d1).toBeGreaterThanOrEqual(200);
    expect(d2).toBeGreaterThanOrEqual(400);
  });

  it('respects maxDelayMs', () => {
    const p = new RetryPolicy({ maxAttempts: 10, baseDelayMs: 1000, maxDelayMs: 5000 });
    expect(p.computeDelayMs(10)).toBeLessThanOrEqual(5000 * 1.25);
  });

  it('jitter introduces variance', () => {
    const samples = [policy.computeDelayMs(0), policy.computeDelayMs(0), policy.computeDelayMs(0)];
    expect(samples.every(s => s === samples[0])).toBe(false);
  });
});
```

### 7.3 Tests CircuitBreaker

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitState } from '../circuit-breaker.helper';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;
  beforeEach(() => { cb = new CircuitBreaker({ failThreshold: 3, cooldownMs: 1000, gracePeriodMs: 0 }); });

  it('rejects invalid failThreshold', () => {
    expect(() => new CircuitBreaker({ failThreshold: 0, cooldownMs: 1000 })).toThrow();
  });
  it('starts CLOSED', () => { expect(cb.getState()).toBe(CircuitState.CLOSED); });
  it('opens after failThreshold', () => {
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.OPEN);
  });
  it('does not open before threshold', () => {
    cb.recordFailure(); cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });
  it('recordSuccess resets', () => {
    cb.recordFailure(); cb.recordFailure();
    cb.recordSuccess();
    cb.recordFailure(); cb.recordFailure();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });
  it('transitions HALF_OPEN after cooldown', () => {
    vi.useFakeTimers();
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    vi.advanceTimersByTime(1100);
    expect(cb.getState()).toBe(CircuitState.HALF_OPEN);
    vi.useRealTimers();
  });
  it('grace period ignores failures', () => {
    const cbGrace = new CircuitBreaker({ failThreshold: 3, cooldownMs: 1000, gracePeriodMs: 60000 });
    for (let i = 0; i < 5; i++) cbGrace.recordFailure();
    expect(cbGrace.getState()).toBe(CircuitState.CLOSED);
  });
  it('reset clears state', () => {
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    cb.reset();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });
  it('getCooldownRemaining 0 if not OPEN', () => { expect(cb.getCooldownRemaining()).toBe(0); });
  it('getCooldownRemaining returns remaining', () => {
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    expect(cb.getCooldownRemaining()).toBeGreaterThan(900);
  });
  it('getFailCount tracks', () => {
    expect(cb.getFailCount()).toBe(0);
    cb.recordFailure();
    expect(cb.getFailCount()).toBe(1);
  });
  it('recordSuccess from HALF_OPEN', () => {
    vi.useFakeTimers();
    cb.recordFailure(); cb.recordFailure(); cb.recordFailure();
    vi.advanceTimersByTime(1100);
    cb.recordSuccess();
    expect(cb.getState()).toBe(CircuitState.CLOSED);
    vi.useRealTimers();
  });
});
```

### 7.4 Tests RequestSigner

```typescript
import { describe, it, expect } from 'vitest';
import { RequestSigner } from '../request-signer.helper';

describe('RequestSigner', () => {
  const secret = 'super_secret_key_12345';

  it('hmacSha256 valid hex', () => {
    expect(RequestSigner.hmacSha256(secret, 'test')).toMatch(/^[a-f0-9]{64}$/);
  });
  it('hmacSha512 valid hex', () => {
    expect(RequestSigner.hmacSha512(secret, 'test')).toMatch(/^[a-f0-9]{128}$/);
  });
  it('verifyHmac timing-safe', () => {
    expect(RequestSigner.verifyHmac('abc', 'abc')).toBe(true);
    expect(RequestSigner.verifyHmac('abc', 'abd')).toBe(false);
    expect(RequestSigner.verifyHmac('abc', 'abcd')).toBe(false);
  });
  it('verifyHmacSha256 round-trip', () => {
    const payload = '{"event":"test"}';
    const sig = RequestSigner.hmacSha256(secret, payload);
    expect(RequestSigner.verifyHmacSha256(secret, payload, sig)).toBe(true);
    expect(RequestSigner.verifyHmacSha256(secret, payload, sig.slice(0, -2) + 'aa')).toBe(false);
  });
  it('verifyHmacSha512 round-trip', () => {
    const sig = RequestSigner.hmacSha512(secret, 'test');
    expect(RequestSigner.verifyHmacSha512(secret, 'test', sig)).toBe(true);
  });
  it('sha512 base64', () => { expect(RequestSigner.sha512('payload')).toMatch(/^[A-Za-z0-9+/=]+$/); });
  it('sha256 hex', () => { expect(RequestSigner.sha256('payload')).toMatch(/^[a-f0-9]{64}$/); });
  it('verifyHmac empty strings', () => { expect(RequestSigner.verifyHmac('', '')).toBe(true); });
});
```

### 7.5 Tests GatewayRegistry

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GatewayRegistry, GatewayRegistryError } from '../gateway-registry.service';

const makeGw = (provider: string) => ({
  provider,
  initiate: async () => ({ providerTransactionId: 'x' }) as any,
  getStatus: async () => ({}) as any,
  refund: async () => ({}) as any,
  cancel: async () => {},
  verifyWebhookSignature: () => ({ valid: true }),
});

describe('GatewayRegistry', () => {
  let registry: GatewayRegistry;
  beforeEach(() => { registry = new GatewayRegistry(); });

  it('registers a gateway', () => {
    registry.register(makeGw('cmi') as any);
    expect(registry.has('cmi' as any)).toBe(true);
  });
  it('throws on duplicate register', () => {
    registry.register(makeGw('cmi') as any);
    expect(() => registry.register(makeGw('cmi') as any)).toThrow(GatewayRegistryError);
  });
  it('get returns instance', () => {
    const gw = makeGw('youcan_pay');
    registry.register(gw as any);
    expect(registry.get('youcan_pay' as any)).toBe(gw);
  });
  it('get throws unregistered', () => {
    expect(() => registry.get('cmi' as any)).toThrow(GatewayRegistryError);
  });
  it('validateAtBoot detects missing', () => {
    registry.register(makeGw('cmi') as any);
    expect(() => registry.validateAtBoot(['cmi', 'youcan_pay'] as any)).toThrow(/Missing gateway/);
  });
  it('getAll returns all', () => {
    registry.register(makeGw('cmi') as any);
    registry.register(makeGw('youcan_pay') as any);
    expect(registry.getAll()).toHaveLength(2);
  });
  it('closeAll calls close', async () => {
    const gw = { ...makeGw('cmi'), close: vi.fn() };
    registry.register(gw as any);
    await registry.closeAll();
    expect(gw.close).toHaveBeenCalled();
  });
});
```

### 7.6 Tests LogRedactor

```typescript
import { describe, it, expect } from 'vitest';
import { scrubSensitive, LOG_REDACT_PATHS } from '../log-redactor.helper';

describe('LogRedactor', () => {
  it('scrubs api_key URL', () => {
    expect(scrubSensitive('https://x.ma?api_key=SECRET123')).not.toContain('SECRET123');
  });
  it('scrubs Bearer tokens', () => {
    expect(scrubSensitive('Bearer abc123def456ghi789jkl012mno345pqr678')).not.toContain('abc123def456');
  });
  it('scrubs long tokens', () => {
    expect(scrubSensitive('token=abcdefghij1234567890ABCDEFGHIJKLMN')).toContain('[REDACTED');
  });
  it('LOG_REDACT_PATHS contains required', () => {
    expect(LOG_REDACT_PATHS).toContain('headers.authorization');
    expect(LOG_REDACT_PATHS).toContain('body.api_key');
    expect(LOG_REDACT_PATHS).toContain('body.HASH');
  });
  it('preserves non-sensitive', () => {
    expect(scrubSensitive('normal log')).toBe('normal log');
  });
});
```

### 7.7 Tests GatewayError hierarchy

```typescript
import { describe, it, expect } from 'vitest';
import { GatewayUnavailableError } from '../gateway-unavailable.error';
import { GatewayCardDeclinedError } from '../gateway-card-declined.error';
import { GatewayInsufficientFundsError } from '../gateway-insufficient-funds.error';
import { GatewayFraudDetectedError } from '../gateway-fraud-detected.error';
import { GatewayTimeoutError } from '../gateway-timeout.error';
import { GatewayInvalidRequestError } from '../gateway-invalid-request.error';

describe('GatewayError hierarchy', () => {
  it('GatewayUnavailableError fallback eligible', () => {
    const err = new GatewayUnavailableError('test', { provider: 'cmi' as any });
    expect(err.isFallbackEligible).toBe(true);
    expect(err.isFinal).toBe(false);
  });
  it('GatewayCardDeclinedError final', () => {
    const err = new GatewayCardDeclinedError('test', 'do_not_honor', { provider: 'cmi' as any });
    expect(err.isFallbackEligible).toBe(false);
    expect(err.declineReason).toBe('do_not_honor');
  });
  it('GatewayInsufficientFundsError final', () => {
    const err = new GatewayInsufficientFundsError('test', { provider: 'cmi' as any });
    expect(err.isFinal).toBe(true);
  });
  it('GatewayFraudDetectedError flags', () => {
    const err = new GatewayFraudDetectedError('test', ['velocity'], { provider: 'cmi' as any });
    expect(err.fraudFlags).toContain('velocity');
  });
  it('GatewayTimeoutError fallback eligible', () => {
    const err = new GatewayTimeoutError(15000, { provider: 'cmi' as any });
    expect(err.isFallbackEligible).toBe(true);
    expect(err.timeoutMs).toBe(15000);
  });
  it('factory fromNetworkError', () => {
    const err = GatewayUnavailableError.fromNetworkError('cmi' as any, new Error('ECONNREFUSED'));
    expect(err.cause).toBeDefined();
  });
  it('factory fromHttpStatus', () => {
    const err = GatewayUnavailableError.fromHttpStatus('cmi' as any, 503);
    expect(err.providerHttpStatus).toBe(503);
  });
  it('factory fromCircuitOpen', () => {
    const err = GatewayUnavailableError.fromCircuitOpen('cmi' as any, 30000);
    expect(err.metadata?.circuit_state).toBe('OPEN');
  });
  it('toLogJson sans cause stack', () => {
    const cause = new Error('sensitive api_key=SECRET');
    const err = new GatewayUnavailableError('wrap', { provider: 'cmi' as any, cause });
    expect(JSON.stringify(err.toLogJson())).not.toContain('SECRET');
  });
  it('GatewayInvalidRequestError no fallback', () => {
    const err = new GatewayInvalidRequestError('test', { provider: 'cmi' as any });
    expect(err.isFallbackEligible).toBe(false);
  });
});
```

---

## 8. Variables environnement

```env
# Provider URLs (placeholders -- concrete values per gateway Tache 3.4.3+)
CMI_BASE_URL=https://testpayten.cmi.co.ma
YOUCAN_PAY_BASE_URL=https://api.youcanpay.com
PAYZONE_BASE_URL=https://api.payzone.ma
INWI_MONEY_BASE_URL=https://api.inwi.ma/wallet
ORANGE_MONEY_BASE_URL=https://api.orange.ma/wallet
MWALLET_BAM_BASE_URL=https://api.mwallet.bam.ma

# Per-provider timeouts
CMI_TIMEOUT_MS=15000
YOUCAN_PAY_TIMEOUT_MS=15000
PAYZONE_TIMEOUT_MS=20000
WALLET_TIMEOUT_MS=30000

# Per-provider circuit breaker
CIRCUIT_FAIL_THRESHOLD=5
CIRCUIT_COOLDOWN_MS=30000
CIRCUIT_GRACE_PERIOD_MS=60000

# Retry policy
RETRY_MAX_ATTEMPTS=3
RETRY_BASE_DELAY_MS=500
RETRY_MAX_DELAY_MS=30000
RETRY_JITTER_RATIO=0.25

# Connection pool
GATEWAY_POOL_CONNECTIONS=20
GATEWAY_KEEP_ALIVE_TIMEOUT_MS=60000

# Body limits
GATEWAY_MAX_RESPONSE_SIZE_BYTES=10485760

# Logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_REDACT_ENABLED=true

# Metrics Prometheus
METRICS_ENABLED=true
METRICS_PORT=9090
```

---

## 9. Commandes shell

```bash
cd repo

# Install dependencies
pnpm --filter @insurtech/pay install
pnpm install undici@7.1.1 pino@9.6.0 prom-client@15.1.3 -F @insurtech/pay

# Typecheck
pnpm --filter @insurtech/pay typecheck

# Tests with coverage
pnpm --filter @insurtech/pay vitest run --coverage

# Lint
pnpm --filter @insurtech/pay biome check src/

# Build
pnpm --filter @insurtech/pay build

# Verify barrel exports
node -e "
const m = require('@insurtech/pay');
const required = [
  'BaseGateway', 'GatewayRegistry', 'GatewayError',
  'GatewayUnavailableError', 'GatewayCardDeclinedError',
  'GatewayInsufficientFundsError', 'GatewayFraudDetectedError',
  'GatewayTimeoutError', 'GatewayInvalidRequestError',
  'RetryPolicy', 'CircuitBreaker', 'CircuitState',
  'RequestSigner', 'LOG_REDACT_PATHS'
];
required.forEach(k => { if (!m[k]) throw new Error('missing: ' + k); });
console.log('OK:', required.length);
"

# Verify no-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/pay/src/ && echo FAIL || echo OK

# Verify no console.log
grep -rn "console\.log\|console\.debug" packages/pay/src/ --include="*.ts" | grep -v ".spec.ts" && echo FAIL || echo OK

# Verify HTTPS-only
grep -rn "http:" packages/pay/src/gateways/ --include="*.ts" | grep -v "https:" | grep -v ".spec.ts" && echo FAIL || echo OK
```

---

## 10. Criteres validation V1-V30

### Criteres P0 (18)

- **V1 (P0)** : `pnpm --filter @insurtech/pay typecheck` retourne exit 0.
- **V2 (P0)** : Interface `PaymentGatewayInterface` declare 6 methods.
- **V3 (P0)** : Class `BaseGateway` est `abstract` (impossible d'instancier sans subclass).
- **V4 (P0)** : Tests `base-gateway.spec.ts` passent (22+ tests).
- **V5 (P0)** : Retry sur 503 declenche 3 attempts (mock undici 3 calls).
- **V6 (P0)** : Pas de retry sur 400 (1 call max).
- **V7 (P0)** : Circuit breaker OPEN apres 5 echecs consecutifs.
- **V8 (P0)** : Logs Pino redactent `headers.authorization`.
- **V9 (P0)** : Logs Pino redactent `body.HASH` et `body.api_key`.
- **V10 (P0)** : `RequestSigner.verifyHmac` utilise `crypto.timingSafeEqual`.
- **V11 (P0)** : `RequestSigner.verifyHmacSha256` round-trip OK.
- **V12 (P0)** : `GatewayRegistry.register` throw si provider deja enregistre.
- **V13 (P0)** : `RetryPolicy.computeDelayMs` introduit jitter.
- **V14 (P0)** : `CircuitBreaker.getState()` transitions CLOSED -> OPEN -> HALF_OPEN.
- **V15 (P0)** : Hierarchy 8 erreurs typees declarees, chaque extends `GatewayError`.
- **V16 (P0)** : `GatewayUnavailableError.isFallbackEligible === true` ; `GatewayCardDeclinedError.isFallbackEligible === false`.
- **V17 (P0)** : BaseGateway constructor throw sur HTTP baseUrl.
- **V18 (P0)** : Body > maxResponseSizeBytes throw error.

### Criteres P1 (8)

- **V19 (P1)** : Tests coverage >= 90%.
- **V20 (P1)** : Aucune emoji.
- **V21 (P1)** : Aucun console.log.
- **V22 (P1)** : Barrel `@insurtech/pay` exporte tout.
- **V23 (P1)** : Custom dispatcher injectable (DI testable).
- **V24 (P1)** : Grace period circuit breaker ignore failures premieres 60s.
- **V25 (P1)** : `BaseGateway.getHealth()` returns circuit state.
- **V26 (P1)** : `GatewayRegistry.getHealth()` returns all gateways health.

### Criteres P2 (4)

- **V27 (P2)** : JSDoc complete sur PaymentGatewayInterface, BaseGateway, errors.
- **V28 (P2)** : `gateway.close()` ferme proprement Pool undici.
- **V29 (P2)** : `BaseGateway.makeRequest` emet metric Prometheus duration_ms.
- **V30 (P2)** : Type guards `isTwoStepGateway`, `isQrCodeGateway`, `isCashVoucherGateway` fonctionnent.

---

## 11. Edge cases + troubleshooting

### Edge case 1 : undici Pool exhausted sur burst
**Solution** : configurer `connections: 50` per provider, monitorer Sprint 13.

### Edge case 2 : DNS resolution echec cold start
**Solution** : Pool reconnect, circuit grace period 60s evite ouverture immediate.

### Edge case 3 : Logger non injecte
**Solution** : Constructor fallback `pino({})` defaut.

### Edge case 4 : Grace period insuffisant rolling deploy
**Solution** : env `CIRCUIT_GRACE_PERIOD_MS=120000` (2 min) si deploy lent.

### Edge case 5 : Retry POST initiate double charge
**Solution** : idempotency_key transmis identique, provider voit duplicate.

### Edge case 6 : Webhook signature avec prefix
**Solution** : caller strip prefix avant. Tache 3.4.8 verifie format.

### Edge case 7 : Timeout trop court wallets
**Solution** : env `WALLET_TIMEOUT_MS=30000` per wallet.

### Edge case 8 : Stack contient PII
**Solution** : `scrubSensitive()` applique avant log.

### Edge case 9 : HTTP 429 sans Retry-After
**Solution** : exponential backoff suffit MVP, Retry-After Sprint 13.

### Edge case 10 : Circuit OPEN bloque tests
**Solution** : `circuit.reset()` exposed pour tests.

### Edge case 11 : MockAgent dispose entre tests
**Solution** : `beforeEach`/`afterEach` recreate.

### Edge case 12 : Concrete gateway oublie `provider`
**Solution** : TypeScript erreur compile-time.

### Edge case 13 : Refund partial sans changer status
**Solution** : Tache 3.4.9 verifie et update DB.

### Edge case 14 : Header signature majuscules vs minuscules
**Solution** : Express normalise case-insensitive.

### Edge case 15 : Provider URL trailing slash
**Solution** : BaseGateway constructor strip.

### Edge case 16 : Concurrent calls meme idempotency_key
**Solution** : Tache 3.4.7 advisory lock Postgres.

### Edge case 17 : Pool exhausted timeout
**Solution** : undici `connectTimeout` configurable.

### Edge case 18 : Provider returns gzipped
**Solution** : undici 7.x auto-decompression.

### Edge case 19 : OpenTelemetry context lost across await
**Solution** : Sprint 1 AsyncLocalStorage global.

### Edge case 20 : `instanceof` fail across modules
**Solution** : Sprint 1 single root install.

### Edge case 21 : Metrics async perdus
**Solution** : metrics emis synchrone.

### Edge case 22 : CircuitBreaker shared tests
**Solution** : `beforeEach` reset explicit.

### Edge case 23 : Boot validateAtBoot strict
**Solution** : throw, app refuse demarrage.

### Edge case 24 : maxResponseSizeBytes trop petit settlements
**Solution** : env override 50MB.

### Edge case 25 : `getHealth()` expose details
**Solution** : retourne uniquement provider + state + cooldown, jamais URL/secrets.

---

## 12. Conformite Maroc detaillee

### PCI-DSS Level 1 (decision-024)
- **Requirement 4** : HTTPS-only enforce constructor, test V17.
- **Requirement 8** : Pino redact paths exhaustifs (15+ paths).
- **Requirement 10** : structured logs JSON, ingest ClickHouse Sprint 13.

### Loi 09-08 (CNDP)
- **Article 16** : defense profondeur (circuit + retry + timeout + redaction + HTTPS).
- **Article 23** : structured logs WARN webhook signature invalide -> SOC alert.

### BAM Circulaire 2/G/2024
- **Article 7** : structured logs + circuit state -> alerting Datadog.

### Office des Changes (loi 1996)
- **Currency MAD only** : interface declare `currency: 'MAD'` literal.

### decision-008 (Cloud souverain MA)
- Tous requests gateways vers providers MA, data residency.

---

## 13. Conventions absolues skalean-insurtech

(rappel complet : multi-tenant strict, validation Zod, Pino strict, argon2id, pnpm strict, TypeScript strict, tests Vitest >= 90%, RBAC, Kafka events, imports `@insurtech/*`, Skalean AI MCP, no-emoji ABSOLU, idempotency strict, conventional commits, cloud souverain MA Atlas Benguerir)

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/pay typecheck
pnpm --filter @insurtech/pay biome check src/
pnpm --filter @insurtech/pay vitest run --coverage
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/pay/src/ && echo FAIL || echo OK
grep -rn "console\.log" packages/pay/src/ --include="*.ts" | grep -v ".spec.ts" && echo FAIL || echo OK
grep -rn "http:" packages/pay/src/gateways/ --include="*.ts" | grep -v "https:" | grep -v ".spec.ts" && echo FAIL || echo OK
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-11): PaymentGatewayInterface + BaseGateway abstract (Tache 3.4.2)

Implement gateway abstraction layer : interface PaymentGatewayInterface (6 methods),
BaseGateway abstract class with undici 7.1.1 pool (20 connections, keep-alive 60s),
retry policy (exponential backoff + jitter 25%), circuit breaker (CLOSED/OPEN/HALF_OPEN
state machine + grace period 60s), Pino logging redact paths exhaustive (15+ paths),
8 typed error classes, GatewayRegistry pattern with validateAtBoot, HTTPS-only enforce,
response size limit 10MB, OpenTelemetry tracing prep, Prometheus metrics emission.

Compliance : PCI-DSS Requirement 4 (HTTPS), 8 (credentials redacted), 10 (audit logs).
Conformite Maroc : Loi 09-08 article 16, BAM article 7.

Livrables: 33 files, 50+ unit tests, ~1500 lines.
Tests: 50 unit
Coverage: 92%

Task: 3.4.2
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Reference: B-11 Tache 3.4.2"
```

---

## 16. Workflow next step

Apres commit : passer a `task-3.4.3-cmi-gateway-cards-emv-3ds.md` qui implements `CmiGateway extends BaseGateway`.

---

**Fin du prompt task-3.4.2.**

Densite atteinte : ~135 ko
Code patterns : 15 fichiers complets
Tests : 50+ scenarios
Criteres validation : V1-V30
Edge cases : 25
