# TACHE 3.2.3 -- WA Template Renderer + 4 Locales fr / ar-MA / ar / en

**Sprint** : 9 (Phase 3 / Sprint 2 dans phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.3)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 3.2.4 webhook receiver, 3.2.5 template manager seeds, 3.2.8 BullMQ wa-send worker, 3.2.9 message orchestrator, et tous les flows utilisateur communications WhatsApp)
**Effort** : 5h
**Dependances** : 3.2.2 (WhatsAppCloudApiClient Meta v21.0), 3.2.1 (comm_messages entity + Zod schemas), Sprint 2 (`comm_templates` table avec colonnes `name`, `language`, `body_template`, `variables_schema`, `meta_template_status`), Sprint 3 (RedisService + KafkaConsumerBase), Sprint 8 (`contact.preferred_language` enum)
**Densite cible** : 120-140 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le service `WaTemplateRendererService` complet et operationnel du programme Skalean InsurTech v2.2 qui implemente l'integralite de la couche de rendu des templates WhatsApp Cloud API Meta v21.0 conforme aux exigences UX multi-locale Maroc (fr pour les francophones marocains et la diaspora francophone, ar-MA pour les arabophones darija avec expressions familieres marocaines, ar pour le contenu arabe classique formel destine aux institutions financieres / autorites de tutelle, en pour les partenaires internationaux et les courtiers anglophones), conforme aux exigences strictes Meta Cloud API qui impose des templates pre-approved avec parametres ordonnees (`{{1}}, {{2}}, {{3}}` Meta-format) au lieu de variables nommees (`{{user_name}}, {{appointment_time}}` DX-friendly), et conforme aux exigences performance (cache Redis 5min par template + locale + tenant pour eviter le re-fetch DB a chaque envoi). Le perimetre couvre : un service NestJS `@Injectable() WaTemplateRendererService` qui expose 6 methods principales (`render(templateName, locale, variables)` retourne `MetaTemplateComponents` prets pour le client Meta de Tache 3.2.2, `validateMetaApproved(templateName, locale)` verifie le status `meta_template_status === 'approved'` avant envoi, `getRequiredVariables(templateName, locale)` retourne la liste des variables requises pour validation upstream, `invalidateCache(templateName, locale, tenantId)` consume le Kafka event `comm.template_updated` Sprint 27, `mapLocaleToMeta(locale)` convertit `ar-MA -> ar` car Meta n'a pas de variant darija, `getFallbackLocale(locale)` cascade `ar-MA -> ar -> fr -> en`) ; un helper de parsing `WaVariableParserHelper` qui extrait les placeholders `{{var_name}}` du `body_template` stocke en DB, valide via Zod schema serialise dans `variables_schema` jsonb, et mappe vers l'array `parameters` ordered Meta API format ; un helper de fallback locale `LocaleFallbackHelper` qui implemente la cascade documentee `ar-MA -> ar (fallback formel) -> fr (langue dominante MA) -> en (lingua franca internationale)` avec logging warning quand fallback applique ; un wrapper Redis cache `WaTemplateCacheService` avec TTL 5min, key pattern `wa-template:{tenant_id}:{name}:{locale}`, stampede protection via SETNX lock pendant fetch DB (5sec lock), invalidation Kafka driven sur `comm.template_updated` ; un enum `Locale` strict (`fr | ar-MA | ar | en`) avec helper `isRtl(locale)` pour Tache 3.2.7 (email RTL) ; et 5 templates seed darija marocain reels documentes (`appointment_reminder_24h`, `police_signed_confirmation`, `quote_generated`, `payment_due_reminder`, `claim_received_acknowledgement`) consommables par Tache 3.2.5 Template Manager.

L'apport est multiple. Premierement, en supportant 4 locales avec le pattern **darija marocain reel** (ar-MA), on respecte l'exigence UX du marche marocain ou les utilisateurs s'attendent a recevoir des communications dans leur langue parlee : un assure du Souss prefere `"Salam Mohamed, kayna 3andek mawid ghadda f 15:00 m3a Hassan. Llh y3awnek!"` (darija familier) plutot que `"السيد محمد المحترم، يشرفنا اعلامكم بأن لديكم موعدا غدا..."` (arabe classique trop formel pour un SMS de rappel). Cette nuance linguistique est un differenciateur competitif vis-a-vis des concurrents AssurMaroc et ClickAssure qui ne proposent que fr ou ar formel. La differenciation `ar-MA` vs `ar` au niveau template DB (meme `language_code='ar'` pour Meta) permet de stocker deux versions du meme template avec `language='ar-MA'` (contenu darija) et `language='ar'` (contenu arabe classique), le service mapping `ar-MA -> Meta language_code 'ar'` est transparent pour le worker BullMQ. Deuxiemement, en mappant les variables nommees DX-friendly (`{{user_name}}`, `{{appointment_time}}`) vers les parametres ordonnees Meta API (`{{1}}, {{2}}`), on permet aux developpeurs de Sprint 14+ Insure et Sprint 20+ Repair de consume le service avec un objet litteral `{ user_name: 'Mohamed', appointment_time: '15:00' }` au lieu de devoir gerer manuellement l'ordre Meta. Le mapping est valide via le `variables_schema` jsonb Zod stocke en DB qui contient l'ordre canonique : `{ order: ['user_name', 'appointment_time'], schema: { user_name: 'string', appointment_time: 'string' } }`. Troisiemement, en cachant les templates resolus en Redis 5min, on evite ~95% des queries DB sur le pattern haute frequence (broadcast 1000+ messages / minute pour rappels RDV J-1 a 8h). Le pattern stampede protection via Redis SETNX lock evite que 100 workers parallele declenchent 100 queries DB simultanees sur cache miss. Quatriemement, en implementant le fallback locale en cascade (`ar-MA -> ar -> fr -> en`), on assure que meme si un template n'est pas encore traduit en darija (cas frequent au demarrage Sprint 9 ou les 60 templates seed sont d'abord disponibles en fr puis ar puis darija au fur et a mesure), le message est neanmoins envoye dans la meilleure langue disponible avec un warning log audite pour faire remonter le besoin de traduction. Cinquiemement, en validant strictement `meta_template_status === 'approved'` avant tout rendu, on evite les erreurs runtime Meta API code 132 (template_param_count_mismatch) ou code 130 (template not found) qui surgissent si on essaie d'envoyer un template `pending_review` ou `rejected`.

A l'issue de cette tache, l'API `WaTemplateRendererService.render(templateName, locale, variables)` retourne en moins de 5ms p99 (cache hit) ou 50ms p99 (cache miss + DB query) un objet `MetaTemplateComponents` directement consommable par `WhatsAppCloudApiClient.sendTemplate(to, templateName, languageCode, components)` de Tache 3.2.2, le service refuse les templates non-Meta-approved avec une erreur typee `MetaTemplateNotApprovedError`, refuse les variables manquantes avec une erreur typee `MissingTemplateVariableError` listant les variables manquantes precisement, accepte gracefulement les variables extra (ignorees, pas d'erreur), supporte le fallback locale automatique avec logging warning audite, le cache Redis est invalide automatiquement via Kafka consumer `comm.template_updated` lors d'une mise a jour template Sprint 27 admin UI, les 5 templates seed darija marocain sont disponibles en JSON pre-rempli pour Tache 3.2.5, la suite Vitest couvre 28+ tests avec coverage >= 88% sur le module WaTemplateRendererService, et la documentation README detaille les conventions de naming des variables, le pattern fallback, et les contraintes Meta (body 1024 chars, header 60 chars, footer no variables, button URL avec variables OK).

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 utilise WhatsApp Cloud API Meta v21.0 comme canal de communication primaire pour les notifications transactionnelles (preferred_channel='whatsapp' representant 65% des contacts MA selon enquete Sprint 1, vs 35% email-preferred). Les templates WhatsApp doivent etre pre-approuves par Meta (workflow review 24-48h) avant pouvoir etre envoyes en production. Meta API impose une structure stricte ou les variables sont des **parametres ordonnees** (`{{1}}, {{2}}, {{3}}` dans le `body_text`, mappes vers un array `parameters: [{type:'text', text:'val1'}, {type:'text', text:'val2'}]` dans la requete API). Cette ergonomie est mauvaise cote developpeur : il est facile de se tromper d'ordre ou d'oublier un parametre, surtout quand un template a 5+ variables. Sans un service centralise de rendering avec mapping nomme -> ordonne, chaque consommateur metier (Sprint 14 Insure pour `police_signed_confirmation`, Sprint 17 Comm pour `appointment_reminder_24h`, Sprint 20 Repair pour `sinistre_acknowledged`, Sprint 18 Notifications pour `payment_due_reminder`) devrait coder lui-meme le mapping ordre + validation, dupliquant le code et risquant l'incoherence.

L'exigence multi-locale est specifique au marche marocain. Selon les enquetes consommateurs Sprint 1 (~3000 courtiers et ~80000 assures interroges) :
- 45% preferent fr pour les communications professionnelles (courtiers educations francophone, urbains Casablanca/Rabat).
- 35% preferent ar-MA (darija) pour leur lisibilite naturelle (assures regions interieures, populations rurales, age 40+).
- 15% preferent ar formel (institutions, autorites tutelle ACAPS, communications legales).
- 5% preferent en (international, partenariats etrangers, courtiers expatries).

Le distinguo `ar-MA` (darija marocain familier) vs `ar` (arabe classique formel) est CRITIQUE et insufisamment couvert par les concurrents InsurTech. Un template `appointment_reminder_24h` en darija : `"Salam Mohamed, kayna 3andek mawid ghadda f 15:00 m3a courtier Hassan. Llh y3awnek!"` (transcription darija avec lettres latines + chiffres convention SMS marocaine, ou alternativement : `"السلام عليكم محمد، كاينا عندك مواعد غدا فـ 15:00 مع الكورتيي حسن. الله يعاونك!"` en lettres arabes). Le meme template en ar formel : `"السيد محمد المحترم، يشرفنا اعلامكم بأن لديكم موعدا في تاريخ غدا الساعة 15:00 مع السيد حسن. ليس لديكم اي شيء لتقوموا به."` -- le ton formel respectable est inadequat pour un SMS de rappel destine au grand public. La distinction est gerée au niveau DB (deux rows `comm_templates` avec `language='ar-MA'` et `language='ar'`, contenus differents) puis mappee uniformement vers Meta `language_code='ar'` car Meta API n'a pas de variant darija au niveau infrastructure.

L'exigence cache Redis 5min est imposee par la nature haute-frequence du trafic broadcast. Cas typique Sprint 17 Comm : a 8h00 Africa/Casablanca, le job cron `appointment-reminders-j-1` execute pour tous les RDV du lendemain (3000-5000 messages broadcast en 5 minutes). Sans cache, chaque worker BullMQ ferait 1 query SELECT sur `comm_templates` par message (3000-5000 queries DB en 5min, ~10-15 q/sec), saturant le pool Postgres alloue au comm module. Avec cache 5min, le premier worker queue le template, les 2999 suivants l'obtiennent en ~0.5ms via Redis HGET. Reduction load DB = -99.9%.

L'exigence stampede protection est subtile mais importante : sans elle, sur cache miss froid (par exemple boot fraichement deploye), 100 workers parallele declenchent 100 SELECT DB simultanees, multipliant la charge initiale. Le pattern Redis SETNX `wa-template:lock:{tenant}:{name}:{locale}` avec TTL 5sec garantit qu'un seul worker fetch DB, les autres attendent en polling 50ms (max 5sec) jusqu'a ce que le cache soit rempli.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Variables ordonnees natives `{{1}}, {{2}}` exposees aux consumers | Aucun mapping, simple | Mauvais DX, erreurs ordre frequentes, code metier illisible | REJETE |
| Variables nommees `{{user_name}}` + mapping centralise (RETENU) | Excellent DX, validation centralisee, refactorings sures | Necessite stockage `order` dans `variables_schema` | RETENU |
| Templates inline dans code metier (Sprint 14, 17, 20...) | Simple developpement initial | Pas multi-locale, pas reutilisable, mix code+presentation | REJETE |
| Templates DB `comm_templates` (RETENU, deja Sprint 2) | Reutilisable, multi-locale, workflow Meta approval | Necessite cache Redis pour perf | RETENU |
| Cache memoire process Map (vs Redis) | Plus rapide (pas de RTT Redis) | Pas de coherence multi-instance, invalidation complexe | REJETE |
| Cache Redis 5min (RETENU) | Coherence multi-instance, invalidation Kafka facile | RTT Redis ~0.5ms acceptable | RETENU |
| Cache Redis 30min ou 1h | Moins de queries DB | Stale plus long apres update, frustration admin | REJETE -- 5min compromise |
| Cache Redis 1min | Peu stale | Plus de queries DB | REJETE -- pas necessaire |
| Locale fallback strict (no fallback, throw if missing) | Force coherence templates | Bloque envoi si traduction manquante (frequent Sprint 9) | REJETE |
| Locale fallback en cascade (ar-MA -> ar -> fr -> en) (RETENU) | Pragmatique, log warning audite | Necessite documentation cascade | RETENU |
| 3 locales (fr / ar-MA / ar) (initial meta-prompt) | Simple | Pas de support partenaires anglophones | REJETE -- ajout en par user |
| 4 locales (fr / ar-MA / ar / en) (RETENU) | Couverture complete, conformite internationale | 1 locale supplementaire = +25% templates | RETENU |
| Stampede protection via Redis SETNX lock (RETENU) | Evite N queries DB sur cache miss froid | Complexite implementation lock+poll | RETENU pour scale Sprint 17 broadcast |
| Stampede protection via single-flight in-process | Simple | Pas de coherence multi-instance | REJETE |
| Validation variables a runtime via Zod (RETENU) | Type-safe, errors explicites | Schemas Zod serialises en jsonb DB | RETENU -- decision-007 |
| Validation variables manuelle | Pas de dep Zod en runtime | Errors moins explicites, perte de typing | REJETE |
| Mapping ar-MA -> Meta `'ar'` (RETENU) | Conforme Meta API limites | Doc cascade necessaire | RETENU |
| Mapping ar-MA -> Meta `'ar_MA'` | Variant explicite | Pas supporte par Meta v21.0 (verify) | REJETE -- Meta limitation |

### 2.3 Trade-offs

Choisir le pattern variables nommees -> ordered implique d'accepter que chaque template DB store un `variables_schema` jsonb avec champ `order: string[]` qui doit etre maintenu coherent avec le `body_template` (si on ajoute `{{phone}}` au body, on doit ajouter `'phone'` a la fin du `order`). En contrepartie, le DX cote consumer est excellent : `renderer.render('appointment_reminder_24h', 'ar-MA', { user_name: 'Mohamed', appointment_time: '15:00', broker_name: 'Hassan' })`. Une lint check Sprint 27 admin UI verifiera la coherence body/order au moment du save template.

Choisir le cache Redis 5min implique d'accepter qu'apres une mise a jour template par admin Sprint 27, les workers actifs continuent a utiliser l'ancienne version pendant 5min max (jusqu'au prochain TTL expiry) sauf si l'invalidation Kafka explicite arrive plus tot. En contrepartie, la latency reduite de 50ms (cache miss DB) a 0.5ms (cache hit) sur 99% des appels sauve potentiellement plusieurs secondes par broadcast 5000-messages. L'invalidation Kafka instantanee mitige la stale-ness pour les cas critiques (correction faute orthographique urgente).

Choisir 4 locales implique d'accepter qu'a chaque ajout d'un nouveau template metier, il faut creer 4 rows DB (vs 3 dans meta-prompt initial). Templating Sprint 9 + 14 + 17 + 20 totalise environ 30-40 templates metier x 4 locales = 120-160 templates a maintenir. La cascade fallback permet de demarrer avec fr + en (creation rapide) puis ajouter ar puis ar-MA progressivement sans bloquer la mise en production. Sprint 27 admin UI gerera le workflow translation collaborative.

Choisir le fallback locale en cascade implique d'accepter qu'un template demande en `ar-MA` mais absent puisse etre rendu en `fr` (cascade `ar-MA -> ar -> fr`), ce qui est sub-optimal UX pour un assure arabophone. En contrepartie, le message est neanmoins envoye (vs blocage), et le warning log audite (`comm.template_locale_fallback`) declenche une notification admin Sprint 27 pour combler le gap traduction.

Choisir la stampede protection implique d'accepter une legere complexite (lock SETNX + polling 50ms) qui peut paraitre overkill pour les petits envois unitaires. En contrepartie, sur un broadcast initial 5000-messages a froid (cache vide), elle previent N=5000 queries simultanees Postgres en n'en lassant passer qu'une seule, evitant un spike de connections Postgres pool exhausted (Sprint 3 pool max 20 connections).

### 2.4 Decisions strategiques referenced

- **decision-006** (No-emoji) : totale -- aucun emoji dans le code, les templates DB, les logs, les comments.
- **decision-007** (Zod runtime validation) : indirect -- le `variables_schema` jsonb stocke un schema Zod-compatible serialise valide a runtime via `z.object().parse()` sur les variables fournies a `render()`.
- **decision-008** (Cloud souverain MA) : indirect -- Redis cache Sprint 35 sera deploye sur Atlas Cloud Services Benguerir, le service WaTemplateRenderer ne fait que consumer le RedisService de Sprint 3 sans dependance externe specifique.
- **decision-009** (Multi-locale fr-MA, ar-MA, en, ar formel pour communications legales) : totale -- exactement 4 locales supportees `fr | ar-MA | ar | en`. Note : `fr-MA` du Sprint 5 est mappee a `fr` Sprint 9 (Meta API utilise `fr` only).
- **decision-018** (Templates Handlebars pour email Sprint 5/9) : indirect -- WaTemplateRenderer n'utilise PAS Handlebars car Meta API attend ses propres `{{1}}, {{2}}` parameters, pas de logique conditionnelle. Templates email Tache 3.2.7 utiliseront Handlebars.
- **decision-022** (Cache Redis Sprint 3) : totale -- WaTemplateCacheService consume RedisService de Sprint 3 (`@insurtech/cache`).
- **decision-024** (Kafka events pattern Sprint 2) : totale -- consumer `comm.template_updated` pour invalidation cache.

### 2.5 Pieges techniques connus

1. **Meta language_code mapping** : Meta API v21.0 supporte `fr`, `ar`, `en` mais PAS `ar-MA` ni `fr-MA`. Le service mapping est CRITIQUE : `mapLocaleToMeta('ar-MA')` doit retourner `'ar'`. Le contenu reste different (darija dans `body_template` DB), Meta valide le contenu au moment de l'approval workflow.
2. **Variables ordered Meta-strict** : si le `body_template` contient `{{user_name}}` et `{{appointment_time}}` dans cet ordre mais le `variables_schema.order` indique `['appointment_time', 'user_name']`, le rendu Meta est INCORRECT (params inverses). Lint Sprint 27 admin UI verifiera coherence.
3. **Variables nommees vs Meta `{{N}}`** : Meta WhatsApp Business Manager UI affiche les templates avec `{{1}}, {{2}}, {{3}}` (ordonnees). Le `body_template` DB peut etre stocke sous deux formes : (a) format nomme `"Salam {{user_name}}, mawid f {{appointment_time}}"` (preference) ou (b) format Meta direct `"Salam {{1}}, mawid f {{2}}"`. Le service supporte les DEUX formes (auto-detect via regex `/\{\{[a-z_]+\}\}/` vs `/\{\{\d+\}\}/`).
4. **Body length 1024 chars Meta limit** : Meta rejette les templates avec body > 1024 chars (pre-approval). Le service `validateBodyLength()` check pre-render et throw `TemplateBodyTooLongError`.
5. **Header length 60 chars Meta limit** : header `text` max 60 chars. Variables dans header autorisees mais doivent rester sous la limite apres interpolation.
6. **Footer no variables** : Meta restriction stricte -- les footers ne peuvent PAS contenir de variables (texte fixe uniquement). Le service rejette via `FooterCannotHaveVariablesError`.
7. **Button URL avec variables OK** : Meta autorise `{{1}}` dans button type='url' (e.g., `https://app.skalean.ma/police/{{1}}` pour un lien dynamique vers une police). Le service supporte 1 variable par button URL max.
8. **Emoji in body** : Meta strict policy -- emojis dans le body sont rejectes pour les templates `marketing` et `utility`. Les templates Skalean InsurTech sont tous `utility` ou `transactional`. Conjugue avec decision-006 (no-emoji), le service rejette via regex check `/[\u{1F300}-\u{1F9FF}]/u` au moment du save template (Sprint 27).
9. **RTL chars dans variable** : si une variable contient des caracteres RTL (e.g., `user_name: 'احمد'` arabe dans un template fr), le rendu Meta peut afficher des bidi override suspects. Le service normalise via Unicode NFC + strip ZWJ inutiles + valide bidi controls dangereux.
10. **Bidi override chars** : caracteres Unicode `U+202A-U+202E` (LRE, RLE, PDF, LRO, RLO) peuvent etre utilises pour spoofing. Le service rejette via `containsBidiOverride()` check.
11. **Variable null vs string vide** : `null` ou `undefined` THROW erreur explicite. String vide `""` est accepte (Meta auto-replace par le placeholder `{{N}}` litteral... peu desirable mais legal).
12. **Cache invalidation race condition** : si admin update template a T=0, Kafka event arrive a T=10ms, mais worker concurrent fetch cache a T=5ms (juste apres update DB mais avant invalidation Kafka). Le service utilise `comm_templates.updated_at` comme `last_modified` Redis hash field, le worker compare avant utilisation et re-fetch DB si cache stale. Pattern "version check" sur cache hit.
13. **Cache stampede sur boot** : 100 workers fraichement boot avec cache vide tous declenchent une SELECT au meme template. Pattern SETNX lock 5sec mitige.
14. **Locale fallback infinite loop** : si fallback chain mal configuree (e.g., `ar-MA -> fr` mais `fr` aussi absent et fallback `fr -> ar-MA`), boucle infinie. Le service implemente compteur depth max 4 (taille de la chain) avec throw `TemplateFallbackExhaustedError`.
15. **Tenant isolation cache key** : si le cache key oublie le `tenant_id`, un tenant pourrait voir les templates d'un autre tenant (multi-tenant violation). Pattern `wa-template:{tenant_id}:{name}:{locale}` STRICT.
16. **DB unavailable fallback** : si Postgres down (Sprint 33 incident), le service ne doit pas crash totalement. Implementation : memory cache court 1min sur les templates les plus frequemment utilises (LRU 50 entries) qui sert de fallback en cas Redis miss + DB unavailable. Best effort.
17. **Variable interpolation injection** : si une variable utilisateur contient `{{` ou `}}` (e.g., `user_name: 'Mr {{boss}}'`), le rendu naive pourrait re-interpoler. Le service escape les double-braces dans les variables avant injection.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.2.3 livre `WaTemplateRendererService` consomme par :
- **Tache 3.2.4** (WA webhook receiver) : non direct, mais dependance pour tests integration.
- **Tache 3.2.5** (Template Manager + 60+ seeds) : utilise `validateMetaApproved()` lors workflow submit_for_approval.
- **Tache 3.2.8** (BullMQ wa-send worker) : appelle `render()` AVANT `WhatsAppCloudApiClient.sendTemplate()`.
- **Tache 3.2.9** (Message orchestrator) : appelle `validateMetaApproved()` pour decider routing WA vs fallback email.
- **Tache 3.2.13** (Tests E2E 40+) : couvre le pipeline complet render -> send via mock Meta API.

### 3.2 Position dans le programme global

- **Sprint 5 Auth** : utilise patterns email Tache 2.1.13 (different module). WA renderer pour notifications Auth Sprint 9+ : `email_verification_wa`, `password_reset_wa` (alternatives WhatsApp aux emails).
- **Sprint 6 Tenant** : `tenant_invitation_wa` template via WaTemplateRenderer.
- **Sprint 8 Booking + CRM** : `appointment_reminder_24h`, `appointment_scheduled`, `appointment_cancelled` -- consume orchestrator qui consume renderer.
- **Sprint 14+ Insure** : `quote_generated`, `police_signed_confirmation`, `police_renewal_reminder`, `payment_due_reminder`, `claim_received_acknowledgement` -- 5 templates x 4 locales = 20 templates seeds.
- **Sprint 17 Comm vertical** : utilise broadcasts haute-frequence (cron jobs) qui mettent a l'epreuve le cache Redis 5min + stampede protection.
- **Sprint 20+ Repair** : `sinistre_acknowledged`, `devis_ready`, `reparation_started`, `reparation_completed` -- 4 templates x 4 locales = 16 templates seeds.
- **Sprint 27 Admin UI** : workflow Meta approval (`submit_for_review` -> Meta review -> `approved`/`rejected`), edition templates avec preview rendering live via `WaTemplateRendererService.render()` et lint coherence body/order.
- **Sprint 33 Observability** : metrics OTEL `wa_template_render_duration_ms`, `wa_template_cache_hit_ratio`, `wa_template_fallback_count`.
- **Sprint 35 Deployment Atlas Cloud Benguerir** : Redis cache deploye sur infrastructure souveraine.

### 3.3 Diagramme

```
                  +-----------------------------------+
                  | Tache 3.2.2 termine                |
                  | WhatsAppCloudApiClient (Meta v21.0)|
                  | sendTemplate(to, name, lang, comp) |
                  +-----------------+------------------+
                                    |
                                    v
              +---------------------+---------------------+
              | TACHE 3.2.3 (cette tache)                 |
              | WaTemplateRendererService                 |
              |                                           |
              | - render(name, locale, vars)              |
              |     -> Promise<MetaTemplateComponents>    |
              | - validateMetaApproved(name, locale)      |
              |     -> boolean                            |
              | - getRequiredVariables(name, locale)      |
              |     -> string[]                           |
              | - invalidateCache(name, locale, tenant)   |
              | - mapLocaleToMeta(locale)                 |
              |     -> 'fr' | 'ar' | 'en'                 |
              | - getFallbackLocale(locale)               |
              |     -> Locale                             |
              |                                           |
              | Helpers :                                 |
              | - WaVariableParserHelper                  |
              | - LocaleFallbackHelper                    |
              | - WaTemplateCacheService (Redis 5min)     |
              | - Locale enum + isRtl()                   |
              |                                           |
              | Types : MetaTemplateComponents,           |
              |  MetaTextParameter, MetaButtonParameter   |
              |                                           |
              | 5 templates seed darija (JSON)            |
              | + tests 28+ + integration Redis           |
              +---+---+---+---+---+---+---+---+---+---+---+
                  |   |   |   |   |   |   |   |   |   |
                  v   v   v   v   v   v   v   v   v   v
                3.2.4 3.2.5 3.2.8 3.2.9 3.2.13 etc.
                Sprint 14+ / 17 / 20+ / 27 admin UI
                Sprint 33 OTEL metrics
```

### 3.4 Flow de donnees render(name, locale, vars)

```
Caller (e.g., WaSendWorker Sprint 9 Tache 3.2.8)
  | renderer.render('appointment_reminder_24h', 'ar-MA', { user_name: 'Mohamed', appointment_time: '15:00', broker_name: 'Hassan' })
  v
WaTemplateRendererService.render
  |
  +-- 1. cache.get(`wa-template:${tenant_id}:appointment_reminder_24h:ar-MA`)
  |     hit -> goto step 5
  |     miss -> step 2
  |
  +-- 2. lock = redis.set(`wa-template:lock:${tenant_id}:appointment_reminder_24h:ar-MA`, NX, EX 5)
  |     lock acquired -> step 3
  |     lock not acquired -> poll cache 50ms x max 100 = 5sec
  |
  +-- 3. db.query SELECT * FROM comm_templates
  |       WHERE tenant_id = $1 AND name = $2 AND language = $3
  |     row found -> step 4
  |     row not found -> getFallbackLocale('ar-MA') = 'ar'
  |       recursion render(name, 'ar', vars) max depth 4
  |
  +-- 4. cache.set(key, JSON.stringify(template), EX 300)
  |     redis.del(lock)
  |
  +-- 5. validate template.meta_template_status === 'approved'
  |     reject -> throw MetaTemplateNotApprovedError
  |
  +-- 6. validate body length <= 1024
  |     reject -> throw TemplateBodyTooLongError
  |
  +-- 7. parser.extractPlaceholders(template.body_template)
  |     -> ['user_name', 'appointment_time', 'broker_name']
  |
  +-- 8. validate template.variables_schema.required vs vars provided
  |     missing -> throw MissingTemplateVariableError
  |
  +-- 9. parser.mapToOrderedParams(template.variables_schema.order, vars)
  |     -> [
  |          { type: 'text', text: 'Mohamed' },
  |          { type: 'text', text: '15:00' },
  |          { type: 'text', text: 'Hassan' }
  |        ]
  |
  +-- 10. construct MetaTemplateComponents :
  |       {
  |         language_code: mapLocaleToMeta('ar-MA') = 'ar',
  |         components: [
  |           { type: 'body', parameters: [...] },
  |           { type: 'header', parameters: [...] } (if header has vars),
  |           { type: 'button', sub_type: 'url', index: 0, parameters: [...] }
  |         ]
  |       }
  |
  +-- 11. log info structured + emit OTEL metric wa_template_render_duration_ms
  |
  +-- 12. return MetaTemplateComponents
  v
Caller -> WhatsAppCloudApiClient.sendTemplate(..., components)
```

---

## 4. Livrables checkables (32 livrables)

- [ ] Service `repo/packages/comm/src/services/wa-template-renderer.service.ts` -- ~220 lignes
- [ ] Tests `repo/packages/comm/src/services/wa-template-renderer.service.spec.ts` -- ~280 lignes / 28 tests
- [ ] Types `repo/packages/comm/src/types/meta-template-components.ts` -- ~70 lignes
- [ ] Helper `repo/packages/comm/src/helpers/wa-variable-parser.helper.ts` -- ~120 lignes
- [ ] Helper `repo/packages/comm/src/helpers/locale-fallback.helper.ts` -- ~80 lignes
- [ ] Service `repo/packages/comm/src/services/wa-template-cache.service.ts` -- ~120 lignes
- [ ] Enum `repo/packages/comm/src/types/locale.enum.ts` -- ~40 lignes (Locale + isRtl + mapLocaleToMeta + getFallbackChain)
- [ ] Tests integration `repo/packages/comm/src/__tests__/integration/wa-renderer-cache.integration.spec.ts` -- ~100 lignes
- [ ] Module `repo/packages/comm/src/services/wa-template-renderer.module.ts` -- ~30 lignes (NestJS module export)
- [ ] Errors `repo/packages/comm/src/errors/wa-template-errors.ts` -- ~50 lignes (5 error classes)
- [ ] Seeds `repo/packages/comm/src/templates/seeds/wa-template-darija-examples.json` -- ~80 lignes / 5 templates darija
- [ ] Index exports `repo/packages/comm/src/index.ts` (modifie)
- [ ] Migration delta `repo/packages/comm/src/migrations/{ts}-comm-template-variables-schema.ts` -- si pas Sprint 2 (verifie d'abord)
- [ ] Variables env : aucune nouvelle (utilise `REDIS_*` Sprint 3 deja config)
- [ ] No-emoji
- [ ] No-console
- [ ] No log de variables PII en clair (hash uniquement pour user_name, phone)
- [ ] Coverage >= 88%
- [ ] Build TypeScript reussit
- [ ] Tous les 5 templates seed darija presents et valides
- [ ] Cache Redis pattern key strict tenant-isolated
- [ ] Stampede protection lock SETNX implementee
- [ ] Fallback locale cascade ar-MA -> ar -> fr -> en documente
- [ ] Validation `meta_template_status` strict
- [ ] Validation body 1024 chars strict
- [ ] Mapping variables nommees -> ordered Meta-format strict
- [ ] Errors typees explicites (5 classes)
- [ ] Kafka consumer `comm.template_updated` invalide cache
- [ ] OTEL metrics emit (Sprint 33 prepare)
- [ ] Logging structured Pino (no PII clear)
- [ ] Documentation README package comm enrichie
- [ ] Bench render < 5ms p99 (cache hit) / < 50ms p99 (cache miss)

---

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/services/wa-template-renderer.service.ts                          (~220 lignes)
repo/packages/comm/src/services/wa-template-renderer.service.spec.ts                     (~280 lignes / 28 tests)
repo/packages/comm/src/services/wa-template-cache.service.ts                              (~120 lignes)
repo/packages/comm/src/services/wa-template-renderer.module.ts                            (~30 lignes)
repo/packages/comm/src/types/meta-template-components.ts                                  (~70 lignes)
repo/packages/comm/src/types/locale.enum.ts                                               (~40 lignes)
repo/packages/comm/src/helpers/wa-variable-parser.helper.ts                               (~120 lignes)
repo/packages/comm/src/helpers/locale-fallback.helper.ts                                  (~80 lignes)
repo/packages/comm/src/errors/wa-template-errors.ts                                       (~50 lignes)
repo/packages/comm/src/__tests__/integration/wa-renderer-cache.integration.spec.ts        (~100 lignes)
repo/packages/comm/src/templates/seeds/wa-template-darija-examples.json                   (~80 lignes / 5 templates)
repo/packages/comm/src/index.ts                                                           (modifie / +exports)
repo/packages/comm/README.md                                                              (modifie / +section WA renderer)
repo/packages/comm/package.json                                                           (modifie / +deps si necessaire)
```

Total : 13 fichiers crees ou modifies, ~1290 lignes effectives + 80 lignes JSON seeds + ~50 lignes README.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 13 : `meta-template-components.ts`

```typescript
/**
 * @insurtech/comm/types/meta-template-components
 *
 * Types Meta WhatsApp Cloud API v21.0 components.
 *
 * Reference :
 *   - Meta documentation : https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 *   - Sprint 9 Tache 3.2.2 (WhatsAppCloudApiClient)
 *   - Sprint 9 Tache 3.2.3 (this task)
 */

/**
 * Meta language codes supportes par Skalean InsurTech.
 * Note : Meta v21.0 ne supporte PAS 'ar-MA' ni 'fr-MA'.
 * Mapping : ar-MA -> ar, fr-MA -> fr.
 */
export type MetaLanguageCode = 'fr' | 'ar' | 'en';

/**
 * Meta text parameter (body, header, button).
 */
export interface MetaTextParameter {
  type: 'text';
  text: string;
}

/**
 * Meta currency parameter (rare, pour quotes).
 */
export interface MetaCurrencyParameter {
  type: 'currency';
  currency: {
    fallback_value: string;
    code: string; // ISO 4217 (MAD, EUR, USD)
    amount_1000: number; // amount * 1000 (Meta convention)
  };
}

/**
 * Meta date_time parameter.
 */
export interface MetaDateTimeParameter {
  type: 'date_time';
  date_time: {
    fallback_value: string;
  };
}

/**
 * Meta image parameter (header type=image).
 */
export interface MetaImageParameter {
  type: 'image';
  image: { link: string }; // URL HTTPS
}

/**
 * Meta document parameter (header type=document).
 */
export interface MetaDocumentParameter {
  type: 'document';
  document: { link: string; filename?: string };
}

export type MetaParameter =
  | MetaTextParameter
  | MetaCurrencyParameter
  | MetaDateTimeParameter
  | MetaImageParameter
  | MetaDocumentParameter;

/**
 * Meta component types.
 */
export type MetaComponentType = 'header' | 'body' | 'footer' | 'button';

/**
 * Meta button sub_type (uniquement pour type='button').
 */
export type MetaButtonSubType = 'url' | 'quick_reply';

/**
 * Meta component generic.
 */
export interface MetaComponent {
  type: MetaComponentType;
  parameters?: MetaParameter[];
  sub_type?: MetaButtonSubType; // uniquement type='button'
  index?: number; // uniquement type='button' (0-based)
}

/**
 * Output complete de WaTemplateRendererService.render().
 * Consommable directement par WhatsAppCloudApiClient.sendTemplate().
 */
export interface MetaTemplateComponents {
  language_code: MetaLanguageCode;
  components: MetaComponent[];
}
```

### 6.2 Fichier 2 / 13 : `locale.enum.ts`

```typescript
/**
 * @insurtech/comm/types/locale.enum
 *
 * Locale enum + helpers pour 4 locales Skalean InsurTech.
 *
 * Reference :
 *   - decision-009 (Multi-locale fr / ar-MA / ar / en)
 *   - Sprint 9 Tache 3.2.3 (this task)
 *   - Sprint 9 Tache 3.2.7 (email RTL pour ar-MA, ar)
 */

import type { MetaLanguageCode } from './meta-template-components.js';

/**
 * Locales Skalean InsurTech.
 * - fr : francais (Maroc + diaspora francophone)
 * - ar-MA : darija marocain (vernaculaire familier)
 * - ar : arabe classique formel (institutions, ACAPS, communications legales)
 * - en : anglais international
 */
export const LOCALES = ['fr', 'ar-MA', 'ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

/**
 * Locales RTL (right-to-left).
 */
export function isRtl(locale: Locale): boolean {
  return locale === 'ar-MA' || locale === 'ar';
}

/**
 * Mapping Locale Skalean -> Meta language_code.
 * Meta v21.0 ne supporte pas variant ar-MA, mappe vers 'ar'.
 */
export function mapLocaleToMeta(locale: Locale): MetaLanguageCode {
  switch (locale) {
    case 'fr':
      return 'fr';
    case 'ar-MA':
    case 'ar':
      return 'ar';
    case 'en':
      return 'en';
    default:
      throw new Error(`Unknown locale: ${locale satisfies never}`);
  }
}

/**
 * Cascade fallback locale documentee :
 *   ar-MA -> ar (formel) -> fr (langue dominante MA) -> en (lingua franca)
 *   ar    -> fr -> en
 *   fr    -> en
 *   en    -> [] (pas de fallback)
 */
export function getFallbackChain(locale: Locale): Locale[] {
  switch (locale) {
    case 'ar-MA':
      return ['ar', 'fr', 'en'];
    case 'ar':
      return ['fr', 'en'];
    case 'fr':
      return ['en'];
    case 'en':
      return [];
    default:
      throw new Error(`Unknown locale: ${locale satisfies never}`);
  }
}

/**
 * Validate Locale string.
 */
export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
```

### 6.3 Fichier 3 / 13 : `wa-template-errors.ts`

```typescript
/**
 * @insurtech/comm/errors/wa-template-errors
 *
 * Errors typees pour WaTemplateRendererService.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.3 (this task)
 */

export class MetaTemplateNotApprovedError extends Error {
  constructor(
    public templateName: string,
    public locale: string,
    public status: string,
  ) {
    super(`Template '${templateName}' (locale=${locale}) not Meta-approved (status=${status})`);
    this.name = 'MetaTemplateNotApprovedError';
  }
}

export class MissingTemplateVariableError extends Error {
  constructor(
    public templateName: string,
    public locale: string,
    public missing: string[],
  ) {
    super(`Template '${templateName}' (locale=${locale}) missing required variables: ${missing.join(', ')}`);
    this.name = 'MissingTemplateVariableError';
  }
}

export class TemplateNotFoundError extends Error {
  constructor(
    public templateName: string,
    public locale: string,
    public tenantId: string,
  ) {
    super(`Template '${templateName}' (locale=${locale}, tenant=${tenantId}) not found`);
    this.name = 'TemplateNotFoundError';
  }
}

export class TemplateBodyTooLongError extends Error {
  constructor(
    public templateName: string,
    public locale: string,
    public actualLength: number,
  ) {
    super(`Template '${templateName}' (locale=${locale}) body too long: ${actualLength} > 1024 chars`);
    this.name = 'TemplateBodyTooLongError';
  }
}

export class TemplateFallbackExhaustedError extends Error {
  constructor(
    public templateName: string,
    public attemptedLocales: string[],
  ) {
    super(`Template '${templateName}' fallback exhausted (tried: ${attemptedLocales.join(' -> ')})`);
    this.name = 'TemplateFallbackExhaustedError';
  }
}

export class FooterCannotHaveVariablesError extends Error {
  constructor(public templateName: string) {
    super(`Template '${templateName}' footer cannot contain variables (Meta restriction)`);
    this.name = 'FooterCannotHaveVariablesError';
  }
}
```

### 6.4 Fichier 4 / 13 : `wa-variable-parser.helper.ts`

```typescript
/**
 * @insurtech/comm/helpers/wa-variable-parser
 *
 * Parse Meta WhatsApp template body et mappe variables nommees -> ordered.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.3 (this task)
 *   - Meta API : variables ordonnees {{1}}, {{2}} obligatoires
 */

import type { MetaTextParameter } from '../types/meta-template-components.js';
import { MissingTemplateVariableError } from '../errors/wa-template-errors.js';

/**
 * Regex placeholder nomme : {{user_name}}, {{appointment_time}}.
 * Meta-strict : letters, digits, underscore (snake_case).
 */
const NAMED_PLACEHOLDER_REGEX = /\{\{([a-z][a-z0-9_]*)\}\}/g;

/**
 * Regex placeholder Meta direct : {{1}}, {{2}}.
 */
const META_PLACEHOLDER_REGEX = /\{\{(\d+)\}\}/g;

/**
 * Bidi override Unicode characters dangereux (anti-spoofing).
 */
const BIDI_OVERRIDE_REGEX = /[‪-‮⁦-⁩]/u;

/**
 * Extract placeholders distincts du template body.
 * Retourne array unique preservant ordre apparition.
 *
 * @example
 *   extractPlaceholders("Salam {{user_name}}, mawid f {{appointment_time}}")
 *   -> ['user_name', 'appointment_time']
 */
export function extractPlaceholders(template: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const match of template.matchAll(NAMED_PLACEHOLDER_REGEX)) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      ordered.push(name);
    }
  }
  return ordered;
}

/**
 * Detect format : 'named' (e.g., {{user_name}}) ou 'meta' (e.g., {{1}}).
 */
export function detectFormat(template: string): 'named' | 'meta' | 'mixed' | 'none' {
  const hasNamed = NAMED_PLACEHOLDER_REGEX.test(template);
  // reset regex lastIndex
  NAMED_PLACEHOLDER_REGEX.lastIndex = 0;
  const hasMeta = META_PLACEHOLDER_REGEX.test(template);
  META_PLACEHOLDER_REGEX.lastIndex = 0;
  if (hasNamed && hasMeta) return 'mixed';
  if (hasNamed) return 'named';
  if (hasMeta) return 'meta';
  return 'none';
}

/**
 * Validate variable value : non null/undefined, no bidi override, escape double-braces.
 */
export function sanitizeVariableValue(value: unknown): string {
  if (value === null || value === undefined) {
    throw new Error('Variable value cannot be null or undefined');
  }
  let str = String(value);
  // Strip bidi override chars
  if (BIDI_OVERRIDE_REGEX.test(str)) {
    str = str.replace(BIDI_OVERRIDE_REGEX, '');
  }
  // Escape double-braces dans la valeur (eviter re-interpolation)
  str = str.replace(/\{\{/g, '\\{\\{').replace(/\}\}/g, '\\}\\}');
  // Normalize Unicode NFC
  str = str.normalize('NFC');
  return str;
}

/**
 * Map variables nommees vers ordered Meta parameters array.
 *
 * @param order array de noms variables dans l'ordre Meta (extrait de variables_schema.order DB)
 * @param variables map nom -> valeur fournie par caller
 * @param templateName pour erreur explicite
 * @param locale pour erreur explicite
 */
export function mapToOrderedParams(
  order: string[],
  variables: Record<string, unknown>,
  templateName: string,
  locale: string,
): MetaTextParameter[] {
  const missing: string[] = [];
  const params: MetaTextParameter[] = [];

  for (const name of order) {
    const value = variables[name];
    if (value === null || value === undefined) {
      missing.push(name);
      continue;
    }
    params.push({
      type: 'text',
      text: sanitizeVariableValue(value),
    });
  }

  if (missing.length > 0) {
    throw new MissingTemplateVariableError(templateName, locale, missing);
  }

  return params;
}

/**
 * Validate body length Meta limit 1024 chars.
 */
export function validateBodyLength(body: string): void {
  if (body.length > 1024) {
    throw new Error(`Body too long: ${body.length} > 1024 chars`);
  }
}

/**
 * Check if string contains bidi override (anti-spoofing).
 */
export function containsBidiOverride(str: string): boolean {
  return BIDI_OVERRIDE_REGEX.test(str);
}
```

### 6.5 Fichier 5 / 13 : `locale-fallback.helper.ts`

```typescript
/**
 * @insurtech/comm/helpers/locale-fallback
 *
 * Cascade fallback locale documentee.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.3 (this task)
 *   - decision-009 (4 locales fr / ar-MA / ar / en)
 */

import { Logger } from '@nestjs/common';
import { type Locale, getFallbackChain } from '../types/locale.enum.js';
import { TemplateFallbackExhaustedError } from '../errors/wa-template-errors.js';

const logger = new Logger('LocaleFallback');

const MAX_FALLBACK_DEPTH = 4;

/**
 * Resolution locale via cascade fallback.
 *
 * Cascade strict :
 *   ar-MA -> ar -> fr -> en
 *   ar    -> fr -> en
 *   fr    -> en
 *   en    -> []
 *
 * @param requested Locale demande par caller
 * @param availableLocales liste des locales disponibles pour le template (depuis DB)
 * @param templateName pour error explicite
 * @returns Locale resolue (egale requested ou fallback)
 */
export function resolveLocale(
  requested: Locale,
  availableLocales: Locale[],
  templateName: string,
): Locale {
  if (availableLocales.includes(requested)) {
    return requested;
  }

  const chain = getFallbackChain(requested);
  const tried: Locale[] = [requested];

  for (let depth = 0; depth < Math.min(chain.length, MAX_FALLBACK_DEPTH); depth++) {
    const fallback = chain[depth];
    tried.push(fallback);
    if (availableLocales.includes(fallback)) {
      logger.warn({
        action: 'comm_template_locale_fallback',
        template: templateName,
        requested,
        resolved: fallback,
        cascade_depth: depth + 1,
      });
      return fallback;
    }
  }

  throw new TemplateFallbackExhaustedError(templateName, tried);
}

/**
 * Build fallback metadata pour log + audit.
 */
export interface FallbackMeta {
  applied: boolean;
  requested: Locale;
  resolved: Locale;
  cascade_depth: number;
}

export function buildFallbackMeta(requested: Locale, resolved: Locale): FallbackMeta {
  if (requested === resolved) {
    return { applied: false, requested, resolved, cascade_depth: 0 };
  }
  const chain = getFallbackChain(requested);
  const depth = chain.indexOf(resolved) + 1;
  return { applied: true, requested, resolved, cascade_depth: depth };
}
```

### 6.6 Fichier 6 / 13 : `wa-template-cache.service.ts`

```typescript
/**
 * @insurtech/comm/services/wa-template-cache
 *
 * Wrapper Redis pour cache templates WA avec stampede protection.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.3 (this task)
 *   - Sprint 3 RedisService (decision-022)
 *   - Sprint 33 OTEL metrics
 */

import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@insurtech/cache';
import type { Locale } from '../types/locale.enum.js';

interface CachedTemplate {
  id: string;
  name: string;
  language: Locale;
  body_template: string;
  header_template: string | null;
  footer_template: string | null;
  button_url_template: string | null;
  variables_schema: { order: string[]; required: string[]; optional?: string[] };
  meta_template_status: 'draft' | 'pending_review' | 'approved' | 'rejected';
  updated_at: string; // ISO
}

const TTL_SECONDS = 5 * 60; // 5min
const LOCK_TTL_SECONDS = 5; // 5sec lock pour stampede protection
const POLL_INTERVAL_MS = 50;
const POLL_MAX_ATTEMPTS = 100; // 5 sec max wait

@Injectable()
export class WaTemplateCacheService {
  private readonly logger = new Logger(WaTemplateCacheService.name);

  constructor(private readonly redis: RedisService) {}

  private cacheKey(tenantId: string, name: string, locale: Locale): string {
    return `wa-template:${tenantId}:${name}:${locale}`;
  }

  private lockKey(tenantId: string, name: string, locale: Locale): string {
    return `wa-template:lock:${tenantId}:${name}:${locale}`;
  }

  async get(tenantId: string, name: string, locale: Locale): Promise<CachedTemplate | null> {
    const raw = await this.redis.get(this.cacheKey(tenantId, name, locale));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedTemplate;
    } catch (err) {
      this.logger.warn({
        action: 'wa_template_cache_parse_error',
        tenant_id: tenantId,
        name,
        locale,
        err: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  }

  async set(tenantId: string, name: string, locale: Locale, template: CachedTemplate): Promise<void> {
    const key = this.cacheKey(tenantId, name, locale);
    await this.redis.setex(key, TTL_SECONDS, JSON.stringify(template));
  }

  async invalidate(tenantId: string, name: string, locale: Locale): Promise<void> {
    await this.redis.del(this.cacheKey(tenantId, name, locale));
    this.logger.log({
      action: 'wa_template_cache_invalidated',
      tenant_id: tenantId,
      name,
      locale,
    });
  }

  /**
   * Stampede protection : SETNX lock + polling.
   * Returns true si lock acquired, false si another worker en train de fetch.
   */
  async acquireLock(tenantId: string, name: string, locale: Locale): Promise<boolean> {
    const key = this.lockKey(tenantId, name, locale);
    const acquired = await this.redis.set(key, '1', 'EX', LOCK_TTL_SECONDS, 'NX');
    return acquired === 'OK';
  }

  async releaseLock(tenantId: string, name: string, locale: Locale): Promise<void> {
    await this.redis.del(this.lockKey(tenantId, name, locale));
  }

  /**
   * Poll cache jusqu'a apparition (autre worker fetch en cours).
   */
  async pollUntilCached(
    tenantId: string,
    name: string,
    locale: Locale,
  ): Promise<CachedTemplate | null> {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const cached = await this.get(tenantId, name, locale);
      if (cached) return cached;
    }
    this.logger.warn({
      action: 'wa_template_cache_poll_timeout',
      tenant_id: tenantId,
      name,
      locale,
      max_wait_ms: POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS,
    });
    return null;
  }
}
```

### 6.7 Fichier 7 / 13 : `wa-template-renderer.service.ts`

```typescript
/**
 * @insurtech/comm/services/wa-template-renderer
 *
 * Service rendant les templates WhatsApp avec variables.
 * Lookup DB par (tenant, name, locale), parse {{var}}, mapping ordered Meta API.
 *
 * Reference :
 *   - decision-009 (Multi-locale)
 *   - decision-007 (Zod runtime)
 *   - Sprint 9 Tache 3.2.2 (WhatsAppCloudApiClient)
 *   - Sprint 9 Tache 3.2.3 (this task)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { z } from 'zod';
import { CommTemplate } from '../entities/comm-template.entity.js';
import { TenantContextService } from '@insurtech/tenant';
import { WaTemplateCacheService } from './wa-template-cache.service.js';
import {
  extractPlaceholders,
  mapToOrderedParams,
  validateBodyLength,
  detectFormat,
} from '../helpers/wa-variable-parser.helper.js';
import { resolveLocale, buildFallbackMeta } from '../helpers/locale-fallback.helper.js';
import {
  type Locale,
  mapLocaleToMeta,
  isLocale,
} from '../types/locale.enum.js';
import type {
  MetaTemplateComponents,
  MetaComponent,
} from '../types/meta-template-components.js';
import {
  MetaTemplateNotApprovedError,
  MissingTemplateVariableError,
  TemplateNotFoundError,
  TemplateBodyTooLongError,
  FooterCannotHaveVariablesError,
} from '../errors/wa-template-errors.js';

interface RenderResult extends MetaTemplateComponents {
  template_id: string;
  template_name: string;
  resolved_locale: Locale;
  fallback_applied: boolean;
}

@Injectable()
export class WaTemplateRendererService implements OnModuleInit {
  private readonly logger = new Logger(WaTemplateRendererService.name);

  constructor(
    @InjectRepository(CommTemplate)
    private readonly templateRepo: Repository<CommTemplate>,
    private readonly cache: WaTemplateCacheService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log({ action: 'wa_template_renderer_initialized' });
  }

  /**
   * Render template -> Meta components prets pour WhatsAppCloudApiClient.sendTemplate().
   *
   * @example
   *   const components = await renderer.render(
   *     'appointment_reminder_24h',
   *     'ar-MA',
   *     { user_name: 'Mohamed', appointment_time: '15:00', broker_name: 'Hassan' }
   *   );
   *   // components.language_code = 'ar' (Meta mapping)
   *   // components.components = [{ type:'body', parameters:[{type:'text', text:'Mohamed'}, ...] }]
   */
  async render(
    templateName: string,
    locale: Locale,
    variables: Record<string, unknown>,
  ): Promise<RenderResult> {
    const startedAt = process.hrtime.bigint();
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) {
      throw new Error('No tenant context for render()');
    }

    // 1. Resolve locale via fallback cascade (lookup available locales pour ce template)
    const availableLocales = await this.getAvailableLocales(tenantId, templateName);
    if (availableLocales.length === 0) {
      throw new TemplateNotFoundError(templateName, locale, tenantId);
    }
    const resolvedLocale = resolveLocale(locale, availableLocales, templateName);
    const fallbackMeta = buildFallbackMeta(locale, resolvedLocale);

    // 2. Cache lookup ou DB fetch
    const template = await this.fetchTemplate(tenantId, templateName, resolvedLocale);

    // 3. Validate Meta-approved
    if (template.meta_template_status !== 'approved') {
      throw new MetaTemplateNotApprovedError(
        templateName,
        resolvedLocale,
        template.meta_template_status,
      );
    }

    // 4. Validate body length
    if (template.body_template.length > 1024) {
      throw new TemplateBodyTooLongError(templateName, resolvedLocale, template.body_template.length);
    }

    // 5. Validate variables required via Zod-compatible schema
    const requiredVars = template.variables_schema.required ?? template.variables_schema.order;
    const missing: string[] = [];
    for (const name of requiredVars) {
      if (variables[name] === null || variables[name] === undefined) {
        missing.push(name);
      }
    }
    if (missing.length > 0) {
      throw new MissingTemplateVariableError(templateName, resolvedLocale, missing);
    }

    // 6. Build components Meta-format
    const components: MetaComponent[] = [];

    // Body
    const bodyOrder = template.variables_schema.order ?? extractPlaceholders(template.body_template);
    const bodyParams = mapToOrderedParams(bodyOrder, variables, templateName, resolvedLocale);
    if (bodyParams.length > 0) {
      components.push({ type: 'body', parameters: bodyParams });
    }

    // Header (optionnel, peut avoir variables)
    if (template.header_template) {
      const headerOrder = extractPlaceholders(template.header_template);
      if (headerOrder.length > 0) {
        const headerParams = mapToOrderedParams(headerOrder, variables, templateName, resolvedLocale);
        components.push({ type: 'header', parameters: headerParams });
      }
    }

    // Footer (Meta-strict : NO variables)
    if (template.footer_template) {
      const footerPlaceholders = extractPlaceholders(template.footer_template);
      if (footerPlaceholders.length > 0) {
        throw new FooterCannotHaveVariablesError(templateName);
      }
    }

    // Button URL avec variables (sub_type='url', index=0, max 1 variable Meta-strict)
    if (template.button_url_template) {
      const buttonOrder = extractPlaceholders(template.button_url_template);
      if (buttonOrder.length > 1) {
        throw new Error(`Template '${templateName}' button URL has > 1 variable (Meta limit)`);
      }
      if (buttonOrder.length === 1) {
        const buttonParams = mapToOrderedParams(buttonOrder, variables, templateName, resolvedLocale);
        components.push({
          type: 'button',
          sub_type: 'url',
          index: 0,
          parameters: buttonParams,
        });
      }
    }

    // 7. Construct result
    const result: RenderResult = {
      template_id: template.id,
      template_name: templateName,
      resolved_locale: resolvedLocale,
      fallback_applied: fallbackMeta.applied,
      language_code: mapLocaleToMeta(resolvedLocale),
      components,
    };

    // 8. Log + metrics
    const durationNs = process.hrtime.bigint() - startedAt;
    const durationMs = Number(durationNs) / 1_000_000;
    this.logger.log({
      action: 'wa_template_rendered',
      template_id: template.id,
      template_name: templateName,
      requested_locale: locale,
      resolved_locale: resolvedLocale,
      fallback_applied: fallbackMeta.applied,
      meta_language_code: result.language_code,
      duration_ms: durationMs.toFixed(2),
      components_count: components.length,
    });

    return result;
  }

  /**
   * Validate template Meta-approved (utilise par orchestrator Tache 3.2.9 routing decision).
   */
  async validateMetaApproved(templateName: string, locale: Locale): Promise<boolean> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) return false;
    try {
      const availableLocales = await this.getAvailableLocales(tenantId, templateName);
      const resolved = resolveLocale(locale, availableLocales, templateName);
      const template = await this.fetchTemplate(tenantId, templateName, resolved);
      return template.meta_template_status === 'approved';
    } catch {
      return false;
    }
  }

  /**
   * Get required variables list (utilise par UI Sprint 27 admin pour preview form).
   */
  async getRequiredVariables(templateName: string, locale: Locale): Promise<string[]> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) throw new Error('No tenant context');
    const availableLocales = await this.getAvailableLocales(tenantId, templateName);
    const resolved = resolveLocale(locale, availableLocales, templateName);
    const template = await this.fetchTemplate(tenantId, templateName, resolved);
    return template.variables_schema.required ?? template.variables_schema.order ?? [];
  }

  /**
   * Invalidate cache (consommee par Kafka consumer comm.template_updated).
   */
  async invalidateCache(templateName: string, locale: Locale, tenantId: string): Promise<void> {
    await this.cache.invalidate(tenantId, templateName, locale);
  }

  /**
   * Lookup les locales disponibles pour un template donne.
   */
  private async getAvailableLocales(tenantId: string, templateName: string): Promise<Locale[]> {
    const rows = await this.templateRepo
      .createQueryBuilder('t')
      .select('t.language')
      .where('t.tenant_id = :tenantId', { tenantId })
      .andWhere('t.name = :name', { name: templateName })
      .andWhere('t.deleted_at IS NULL')
      .getMany();
    return rows.map((r) => r.language).filter((l): l is Locale => isLocale(l));
  }

  /**
   * Fetch template avec cache + stampede protection.
   */
  private async fetchTemplate(tenantId: string, name: string, locale: Locale) {
    const cached = await this.cache.get(tenantId, name, locale);
    if (cached) {
      return cached;
    }

    const lockAcquired = await this.cache.acquireLock(tenantId, name, locale);
    if (!lockAcquired) {
      // Autre worker fetch -> poll cache
      const polled = await this.cache.pollUntilCached(tenantId, name, locale);
      if (polled) return polled;
      // Fallback : fetch DB directement (timeout 5sec depasse)
    }

    try {
      const row = await this.templateRepo.findOne({
        where: {
          tenant_id: tenantId,
          name,
          language: locale,
          deleted_at: null,
        } as never,
      });
      if (!row) {
        throw new TemplateNotFoundError(name, locale, tenantId);
      }

      const cachedTpl = {
        id: row.id,
        name: row.name,
        language: row.language as Locale,
        body_template: row.body_template,
        header_template: row.header_template,
        footer_template: row.footer_template,
        button_url_template: row.button_url_template,
        variables_schema: row.variables_schema,
        meta_template_status: row.meta_template_status,
        updated_at: row.updated_at.toISOString(),
      };
      await this.cache.set(tenantId, name, locale, cachedTpl);
      return cachedTpl;
    } finally {
      if (lockAcquired) {
        await this.cache.releaseLock(tenantId, name, locale);
      }
    }
  }
}
```

### 6.8 Fichier 8 / 13 : `wa-template-renderer.service.spec.ts` (28 tests)

```typescript
/**
 * @insurtech/comm/services/wa-template-renderer.service.spec
 *
 * Tests unitaires WaTemplateRendererService -- 28+ scenarios.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { WaTemplateRendererService } from './wa-template-renderer.service.js';
import { WaTemplateCacheService } from './wa-template-cache.service.js';
import {
  MetaTemplateNotApprovedError,
  MissingTemplateVariableError,
  TemplateNotFoundError,
  TemplateBodyTooLongError,
  FooterCannotHaveVariablesError,
  TemplateFallbackExhaustedError,
} from '../errors/wa-template-errors.js';
import { TenantContextService } from '@insurtech/tenant';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CommTemplate } from '../entities/comm-template.entity.js';

const T_TENANT = '00000000-0000-0000-0000-000000000001';

function makeTemplate(overrides: Partial<any> = {}): any {
  return {
    id: 'tpl-1',
    tenant_id: T_TENANT,
    name: 'appointment_reminder_24h',
    language: 'ar-MA',
    body_template: 'Salam {{user_name}}, kayna 3andek mawid ghadda f {{appointment_time}} m3a {{broker_name}}. Llh y3awnek!',
    header_template: null,
    footer_template: null,
    button_url_template: null,
    variables_schema: {
      order: ['user_name', 'appointment_time', 'broker_name'],
      required: ['user_name', 'appointment_time', 'broker_name'],
    },
    meta_template_status: 'approved',
    updated_at: new Date(),
    deleted_at: null,
    ...overrides,
  };
}

describe('WaTemplateRendererService', () => {
  let service: WaTemplateRendererService;
  let cache: { get: any; set: any; acquireLock: any; releaseLock: any; pollUntilCached: any; invalidate: any };
  let repo: { findOne: any; createQueryBuilder: any };
  let tenantContext: { getCurrentTenantId: any };

  beforeEach(async () => {
    cache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      acquireLock: vi.fn().mockResolvedValue(true),
      releaseLock: vi.fn().mockResolvedValue(undefined),
      pollUntilCached: vi.fn().mockResolvedValue(null),
      invalidate: vi.fn().mockResolvedValue(undefined),
    };

    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([{ language: 'ar-MA' }, { language: 'fr' }, { language: 'en' }]),
    };

    repo = {
      findOne: vi.fn().mockResolvedValue(makeTemplate()),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
    };
    tenantContext = { getCurrentTenantId: vi.fn().mockReturnValue(T_TENANT) };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WaTemplateRendererService,
        { provide: WaTemplateCacheService, useValue: cache },
        { provide: TenantContextService, useValue: tenantContext },
        { provide: getRepositoryToken(CommTemplate), useValue: repo },
      ],
    }).compile();

    service = moduleRef.get(WaTemplateRendererService);
  });

  it('T1: render fr happy path retourne components Meta valid', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({
      language: 'fr',
      body_template: 'Bonjour {{user_name}}, vous avez un rendez-vous demain a {{appointment_time}} avec {{broker_name}}.',
    }));
    repo.createQueryBuilder().getMany.mockResolvedValue([{ language: 'fr' }]);

    const result = await service.render('appointment_reminder_24h', 'fr', {
      user_name: 'Mohamed',
      appointment_time: '15:00',
      broker_name: 'Hassan',
    });

    expect(result.language_code).toBe('fr');
    expect(result.components).toHaveLength(1);
    expect(result.components[0].type).toBe('body');
    expect(result.components[0].parameters).toEqual([
      { type: 'text', text: 'Mohamed' },
      { type: 'text', text: '15:00' },
      { type: 'text', text: 'Hassan' },
    ]);
    expect(result.fallback_applied).toBe(false);
    expect(result.resolved_locale).toBe('fr');
  });

  it('T2: render ar-MA utilise contenu darija (pas ar formel)', async () => {
    const darijaTemplate = makeTemplate({
      language: 'ar-MA',
      body_template: 'Salam {{user_name}}, kayna 3andek mawid ghadda f {{appointment_time}} m3a {{broker_name}}. Llh y3awnek!',
    });
    repo.findOne.mockResolvedValue(darijaTemplate);

    const result = await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'Mohamed',
      appointment_time: '15:00',
      broker_name: 'Hassan',
    });

    expect(result.language_code).toBe('ar'); // mapping Meta
    expect(result.resolved_locale).toBe('ar-MA');
    expect(result.fallback_applied).toBe(false);
  });

  it('T3: render ar formel retourne language_code ar', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({
      language: 'ar',
      body_template: 'السلام عليكم {{user_name}}، لديكم موعد غدا في {{appointment_time}} مع {{broker_name}}.',
    }));
    repo.createQueryBuilder().getMany.mockResolvedValue([{ language: 'ar' }]);

    const result = await service.render('appointment_reminder_24h', 'ar', {
      user_name: 'Mohamed',
      appointment_time: '15:00',
      broker_name: 'Hassan',
    });
    expect(result.language_code).toBe('ar');
    expect(result.resolved_locale).toBe('ar');
  });

  it('T4: render en happy path', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({
      language: 'en',
      body_template: 'Hello {{user_name}}, you have an appointment tomorrow at {{appointment_time}} with {{broker_name}}.',
    }));
    repo.createQueryBuilder().getMany.mockResolvedValue([{ language: 'en' }]);

    const result = await service.render('appointment_reminder_24h', 'en', {
      user_name: 'Mohamed',
      appointment_time: '15:00',
      broker_name: 'Hassan',
    });
    expect(result.language_code).toBe('en');
  });

  it('T5: locale fallback ar-MA absent -> ar applique', async () => {
    repo.createQueryBuilder().getMany.mockResolvedValue([{ language: 'ar' }, { language: 'fr' }]);
    repo.findOne.mockResolvedValue(makeTemplate({ language: 'ar' }));

    const result = await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'Mohamed',
      appointment_time: '15:00',
      broker_name: 'Hassan',
    });
    expect(result.fallback_applied).toBe(true);
    expect(result.resolved_locale).toBe('ar');
  });

  it('T6: locale fallback ar-MA -> ar absent -> fr applique', async () => {
    repo.createQueryBuilder().getMany.mockResolvedValue([{ language: 'fr' }, { language: 'en' }]);
    repo.findOne.mockResolvedValue(makeTemplate({ language: 'fr' }));

    const result = await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'Mohamed',
      appointment_time: '15:00',
      broker_name: 'Hassan',
    });
    expect(result.fallback_applied).toBe(true);
    expect(result.resolved_locale).toBe('fr');
    expect(result.language_code).toBe('fr');
  });

  it('T7: variables manquantes throw MissingTemplateVariableError', async () => {
    await expect(
      service.render('appointment_reminder_24h', 'ar-MA', {
        user_name: 'Mohamed',
        // appointment_time missing
        broker_name: 'Hassan',
      }),
    ).rejects.toThrow(MissingTemplateVariableError);
  });

  it('T8: variables extra ignorees (pas erreur)', async () => {
    const result = await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'Mohamed',
      appointment_time: '15:00',
      broker_name: 'Hassan',
      extra_var: 'ignored',
      another_extra: 42,
    });
    expect(result.components[0].parameters).toHaveLength(3);
  });

  it('T9: cache hit retourne instant sans DB query', async () => {
    cache.get.mockResolvedValue(makeTemplate({ language: 'ar-MA' }));
    await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'M', appointment_time: '15', broker_name: 'H',
    });
    expect(repo.findOne).not.toHaveBeenCalled();
    expect(cache.get).toHaveBeenCalled();
  });

  it('T10: cache miss query DB + cache set', async () => {
    cache.get.mockResolvedValue(null);
    await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'M', appointment_time: '15', broker_name: 'H',
    });
    expect(repo.findOne).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledTimes(1);
  });

  it('T11: stampede lock acquired -> fetch DB normal', async () => {
    cache.acquireLock.mockResolvedValue(true);
    await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'M', appointment_time: '15', broker_name: 'H',
    });
    expect(cache.acquireLock).toHaveBeenCalled();
    expect(cache.releaseLock).toHaveBeenCalled();
  });

  it('T12: stampede lock NOT acquired -> poll cache', async () => {
    cache.acquireLock.mockResolvedValue(false);
    cache.pollUntilCached.mockResolvedValue(makeTemplate({ language: 'ar-MA' }));
    await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'M', appointment_time: '15', broker_name: 'H',
    });
    expect(cache.pollUntilCached).toHaveBeenCalled();
    expect(repo.findOne).not.toHaveBeenCalled();
  });

  it('T13: meta_template_status pending_review -> reject', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({ meta_template_status: 'pending_review' }));
    await expect(
      service.render('appointment_reminder_24h', 'ar-MA', {
        user_name: 'M', appointment_time: '15', broker_name: 'H',
      }),
    ).rejects.toThrow(MetaTemplateNotApprovedError);
  });

  it('T14: meta_template_status rejected -> reject', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({ meta_template_status: 'rejected' }));
    await expect(
      service.render('appointment_reminder_24h', 'ar-MA', {
        user_name: 'M', appointment_time: '15', broker_name: 'H',
      }),
    ).rejects.toThrow(MetaTemplateNotApprovedError);
  });

  it('T15: body > 1024 chars throw TemplateBodyTooLongError', async () => {
    const longBody = 'a'.repeat(1025);
    repo.findOne.mockResolvedValue(makeTemplate({ body_template: longBody, variables_schema: { order: [], required: [] } }));
    await expect(
      service.render('appointment_reminder_24h', 'ar-MA', {}),
    ).rejects.toThrow(TemplateBodyTooLongError);
  });

  it('T16: header avec variable {{1}} OK', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({
      header_template: 'Skalean {{user_name}}',
      body_template: 'Bonjour {{user_name}}',
      variables_schema: { order: ['user_name'], required: ['user_name'] },
    }));
    const result = await service.render('test_tpl', 'ar-MA', { user_name: 'Mohamed' });
    expect(result.components.find((c) => c.type === 'header')).toBeDefined();
  });

  it('T17: footer avec variable -> throw FooterCannotHaveVariablesError', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({
      footer_template: 'Skalean {{tenant_name}}',
      variables_schema: { order: ['user_name', 'appointment_time', 'broker_name'], required: ['user_name', 'appointment_time', 'broker_name'] },
    }));
    await expect(
      service.render('appointment_reminder_24h', 'ar-MA', {
        user_name: 'M', appointment_time: '15', broker_name: 'H',
      }),
    ).rejects.toThrow(FooterCannotHaveVariablesError);
  });

  it('T18: footer fixe (pas de variables) OK', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({
      footer_template: 'Skalean InsurTech',
    }));
    const result = await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'M', appointment_time: '15', broker_name: 'H',
    });
    expect(result.components.find((c) => c.type === 'footer')).toBeUndefined(); // pas dans output (no params)
  });

  it('T19: button URL avec 1 variable OK', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({
      button_url_template: 'https://app.skalean.ma/police/{{police_id}}',
      variables_schema: { order: ['user_name', 'appointment_time', 'broker_name', 'police_id'], required: ['user_name', 'appointment_time', 'broker_name', 'police_id'] },
    }));
    const result = await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'M', appointment_time: '15', broker_name: 'H', police_id: 'POL-001',
    });
    const button = result.components.find((c) => c.type === 'button');
    expect(button).toBeDefined();
    expect(button?.sub_type).toBe('url');
    expect(button?.parameters).toEqual([{ type: 'text', text: 'POL-001' }]);
  });

  it('T20: button URL avec > 1 variable throw', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({
      button_url_template: 'https://app.skalean.ma/{{a}}/{{b}}',
      variables_schema: { order: ['user_name', 'appointment_time', 'broker_name', 'a', 'b'], required: ['user_name', 'appointment_time', 'broker_name', 'a', 'b'] },
    }));
    await expect(
      service.render('appointment_reminder_24h', 'ar-MA', {
        user_name: 'M', appointment_time: '15', broker_name: 'H', a: 'x', b: 'y',
      }),
    ).rejects.toThrow();
  });

  it('T21: variables null/undefined -> throw MissingTemplateVariableError', async () => {
    await expect(
      service.render('appointment_reminder_24h', 'ar-MA', {
        user_name: null, appointment_time: '15', broker_name: 'H',
      }),
    ).rejects.toThrow(MissingTemplateVariableError);
  });

  it('T22: variable string vide accepte', async () => {
    const result = await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: '', appointment_time: '15', broker_name: 'H',
    });
    expect(result.components[0].parameters).toEqual([
      { type: 'text', text: '' },
      { type: 'text', text: '15' },
      { type: 'text', text: 'H' },
    ]);
  });

  it('T23: variable contient {{ ou }} -> escape', async () => {
    const result = await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'Mr {{boss}}', appointment_time: '15', broker_name: 'H',
    });
    expect(result.components[0].parameters[0].text).toBe('Mr \\{\\{boss\\}\\}');
  });

  it('T24: bidi override chars dans variable -> stripped', async () => {
    const result = await service.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'Moh‮amed', appointment_time: '15', broker_name: 'H',
    });
    expect(result.components[0].parameters[0].text).toBe('Mohamed');
  });

  it('T25: validateMetaApproved retourne true si approved', async () => {
    const result = await service.validateMetaApproved('appointment_reminder_24h', 'ar-MA');
    expect(result).toBe(true);
  });

  it('T26: validateMetaApproved retourne false si pending_review', async () => {
    repo.findOne.mockResolvedValue(makeTemplate({ meta_template_status: 'pending_review' }));
    const result = await service.validateMetaApproved('appointment_reminder_24h', 'ar-MA');
    expect(result).toBe(false);
  });

  it('T27: getRequiredVariables retourne liste', async () => {
    const result = await service.getRequiredVariables('appointment_reminder_24h', 'ar-MA');
    expect(result).toEqual(['user_name', 'appointment_time', 'broker_name']);
  });

  it('T28: invalidateCache appelle cache.invalidate', async () => {
    await service.invalidateCache('appointment_reminder_24h', 'ar-MA', T_TENANT);
    expect(cache.invalidate).toHaveBeenCalledWith(T_TENANT, 'appointment_reminder_24h', 'ar-MA');
  });

  it('T29: template totalement absent toutes locales -> TemplateFallbackExhaustedError', async () => {
    repo.createQueryBuilder().getMany.mockResolvedValue([]);
    await expect(
      service.render('non_existent_template', 'ar-MA', {}),
    ).rejects.toThrow(TemplateNotFoundError);
  });

  it('T30: tenant_id isolation -- different tenant ne voit pas templates autre tenant', async () => {
    tenantContext.getCurrentTenantId.mockReturnValue('other-tenant-id');
    repo.createQueryBuilder().getMany.mockResolvedValue([]);
    await expect(
      service.render('appointment_reminder_24h', 'ar-MA', {}),
    ).rejects.toThrow(TemplateNotFoundError);
  });
});
```

### 6.9 Fichier 9 / 13 : `wa-template-renderer.module.ts`

```typescript
/**
 * @insurtech/comm/services/wa-template-renderer.module
 *
 * NestJS module exposant WaTemplateRendererService.
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@insurtech/cache';
import { TenantModule } from '@insurtech/tenant';
import { CommTemplate } from '../entities/comm-template.entity.js';
import { WaTemplateRendererService } from './wa-template-renderer.service.js';
import { WaTemplateCacheService } from './wa-template-cache.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommTemplate]),
    CacheModule,
    TenantModule,
  ],
  providers: [WaTemplateRendererService, WaTemplateCacheService],
  exports: [WaTemplateRendererService],
})
export class WaTemplateRendererModule {}
```

### 6.10 Fichier 10 / 13 : `wa-renderer-cache.integration.spec.ts`

```typescript
/**
 * @insurtech/comm/__tests__/integration/wa-renderer-cache.integration.spec
 *
 * Tests integration Redis (necessite Redis local).
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { RedisService, CacheModule } from '@insurtech/cache';
import { WaTemplateRendererService } from '../../services/wa-template-renderer.service.js';
import { WaTemplateCacheService } from '../../services/wa-template-cache.service.js';
import { CommTemplate } from '../../entities/comm-template.entity.js';
import { TenantContextService } from '@insurtech/tenant';

const SKIP_REDIS = process.env.SKIP_REDIS === '1';

describe.skipIf(SKIP_REDIS)('WaTemplateRenderer integration with Redis', () => {
  let service: WaTemplateRendererService;
  let cacheService: WaTemplateCacheService;
  let redis: RedisService;
  const TENANT = '00000000-0000-0000-0000-000000000099';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CacheModule],
      providers: [
        WaTemplateRendererService,
        WaTemplateCacheService,
        {
          provide: TenantContextService,
          useValue: { getCurrentTenantId: () => TENANT },
        },
        {
          provide: getRepositoryToken(CommTemplate),
          useValue: {
            findOne: async () => ({
              id: 'tpl-int',
              tenant_id: TENANT,
              name: 'integration_test',
              language: 'fr',
              body_template: 'Hello {{name}}',
              header_template: null,
              footer_template: null,
              button_url_template: null,
              variables_schema: { order: ['name'], required: ['name'] },
              meta_template_status: 'approved',
              updated_at: new Date(),
              deleted_at: null,
            }),
            createQueryBuilder: () => ({
              select: () => ({
                where: () => ({
                  andWhere: () => ({
                    andWhere: () => ({
                      getMany: async () => [{ language: 'fr' }],
                    }),
                  }),
                }),
              }),
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(WaTemplateRendererService);
    cacheService = moduleRef.get(WaTemplateCacheService);
    redis = moduleRef.get(RedisService);
  });

  beforeEach(async () => {
    await cacheService.invalidate(TENANT, 'integration_test', 'fr');
  });

  afterAll(async () => {
    await cacheService.invalidate(TENANT, 'integration_test', 'fr');
  });

  it('renders + caches in Redis (set + get)', async () => {
    const result1 = await service.render('integration_test', 'fr', { name: 'Mohamed' });
    expect(result1.components[0].parameters[0].text).toBe('Mohamed');

    const cached = await cacheService.get(TENANT, 'integration_test', 'fr');
    expect(cached).not.toBeNull();
    expect(cached?.body_template).toBe('Hello {{name}}');

    // 2eme render = cache hit
    const result2 = await service.render('integration_test', 'fr', { name: 'Hassan' });
    expect(result2.components[0].parameters[0].text).toBe('Hassan');
  });

  it('cache invalidation works', async () => {
    await service.render('integration_test', 'fr', { name: 'A' });
    await cacheService.invalidate(TENANT, 'integration_test', 'fr');
    const cached = await cacheService.get(TENANT, 'integration_test', 'fr');
    expect(cached).toBeNull();
  });

  it('stampede protection -- concurrent renders', async () => {
    const promises = Array.from({ length: 10 }, (_, i) =>
      service.render('integration_test', 'fr', { name: `User${i}` }),
    );
    const results = await Promise.all(promises);
    expect(results).toHaveLength(10);
    results.forEach((r) => expect(r.components[0].parameters[0].text).toMatch(/^User\d$/));
  });
});
```

### 6.11 Fichier 11 / 13 : `wa-template-darija-examples.json`

```json
[
  {
    "name": "appointment_reminder_24h",
    "language": "ar-MA",
    "category": "utility",
    "body_template": "Salam {{user_name}}, kayna 3andek mawid ghadda f {{appointment_time}} m3a {{broker_name}}. Llh y3awnek!",
    "header_template": null,
    "footer_template": "Skalean InsurTech",
    "button_url_template": null,
    "variables_schema": {
      "order": ["user_name", "appointment_time", "broker_name"],
      "required": ["user_name", "appointment_time", "broker_name"],
      "examples": {
        "user_name": "Mohamed",
        "appointment_time": "15:00",
        "broker_name": "Hassan"
      }
    },
    "meta_template_status": "pending_review",
    "comments_meta_review": "Darija marocain familier. Variables ordered. Approbation Meta : reference fr+ar dispo en parallele."
  },
  {
    "name": "police_signed_confirmation",
    "language": "ar-MA",
    "category": "utility",
    "body_template": "Mabrouk {{user_name}}! Police dyalek raha mwaqq3a. Numero: {{police_number}}. Tabaa3 lhal dyalek 3la app Skalean. Llh ybarek!",
    "header_template": null,
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/police/{{police_id}}",
    "variables_schema": {
      "order": ["user_name", "police_number", "police_id"],
      "required": ["user_name", "police_number", "police_id"],
      "examples": {
        "user_name": "Fatima",
        "police_number": "POL-2026-001234",
        "police_id": "abc-123-uuid"
      }
    },
    "meta_template_status": "pending_review",
    "comments_meta_review": "Confirmation signature police. Bouton URL deeplink app."
  },
  {
    "name": "quote_generated",
    "language": "ar-MA",
    "category": "utility",
    "body_template": "Salam {{user_name}}, devis dyalek jahed! Prix: {{quote_amount}} MAD. Valid hta {{valid_until}}. Schouf 3liha f app.",
    "header_template": null,
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/quote/{{quote_id}}",
    "variables_schema": {
      "order": ["user_name", "quote_amount", "valid_until", "quote_id"],
      "required": ["user_name", "quote_amount", "valid_until", "quote_id"],
      "examples": {
        "user_name": "Karim",
        "quote_amount": "3500",
        "valid_until": "30/06/2026",
        "quote_id": "qte-uuid"
      }
    },
    "meta_template_status": "pending_review",
    "comments_meta_review": "Devis assurance darija. Prix MAD. Valid date format dd/mm/yyyy."
  },
  {
    "name": "payment_due_reminder",
    "language": "ar-MA",
    "category": "utility",
    "body_template": "Salam {{user_name}}, kayna 3andek paiement {{amount}} MAD ghadi yhal f {{due_date}}. Khlas o ma t3titilhash mn balek.",
    "header_template": null,
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/pay/{{payment_id}}",
    "variables_schema": {
      "order": ["user_name", "amount", "due_date", "payment_id"],
      "required": ["user_name", "amount", "due_date", "payment_id"],
      "examples": {
        "user_name": "Aicha",
        "amount": "1200",
        "due_date": "15/05/2026",
        "payment_id": "pay-uuid"
      }
    },
    "meta_template_status": "pending_review",
    "comments_meta_review": "Rappel paiement assurance darija. Compliance loi 09-08 : pas marketing."
  },
  {
    "name": "claim_received_acknowledgement",
    "language": "ar-MA",
    "category": "utility",
    "body_template": "Salam {{user_name}}, sinistre dyalek wsel l3andna. Numero: {{claim_number}}. Ghadi nrjj3o lk lkhbar f {{eta_days}} ayyam.",
    "header_template": null,
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/claim/{{claim_id}}",
    "variables_schema": {
      "order": ["user_name", "claim_number", "eta_days", "claim_id"],
      "required": ["user_name", "claim_number", "eta_days", "claim_id"],
      "examples": {
        "user_name": "Yassine",
        "claim_number": "CLM-2026-005678",
        "eta_days": "3",
        "claim_id": "clm-uuid"
      }
    },
    "meta_template_status": "pending_review",
    "comments_meta_review": "Acknowledgement sinistre. ETA en jours, exemple 3 ayyam."
  }
]
```

### 6.12 Fichier 12 / 13 : `index.ts` (modifications)

```typescript
/**
 * @insurtech/comm/index
 */

// ... exports existants Sprint 2/5 ...

// Sprint 9 Tache 3.2.3 -- WA Template Renderer
export { WaTemplateRendererService } from './services/wa-template-renderer.service.js';
export { WaTemplateCacheService } from './services/wa-template-cache.service.js';
export { WaTemplateRendererModule } from './services/wa-template-renderer.module.js';
export {
  type Locale,
  LOCALES,
  DEFAULT_LOCALE,
  isRtl,
  mapLocaleToMeta,
  getFallbackChain,
  isLocale,
} from './types/locale.enum.js';
export type {
  MetaTemplateComponents,
  MetaComponent,
  MetaComponentType,
  MetaParameter,
  MetaTextParameter,
  MetaCurrencyParameter,
  MetaDateTimeParameter,
  MetaImageParameter,
  MetaDocumentParameter,
  MetaButtonSubType,
  MetaLanguageCode,
} from './types/meta-template-components.js';
export {
  MetaTemplateNotApprovedError,
  MissingTemplateVariableError,
  TemplateNotFoundError,
  TemplateBodyTooLongError,
  TemplateFallbackExhaustedError,
  FooterCannotHaveVariablesError,
} from './errors/wa-template-errors.js';
export {
  extractPlaceholders,
  detectFormat,
  sanitizeVariableValue,
  mapToOrderedParams,
  validateBodyLength,
  containsBidiOverride,
} from './helpers/wa-variable-parser.helper.js';
export {
  resolveLocale,
  buildFallbackMeta,
  type FallbackMeta,
} from './helpers/locale-fallback.helper.js';
```

### 6.13 Fichier 13 / 13 : Migration delta `comm_templates.variables_schema` (si pas Sprint 2)

```typescript
/**
 * @insurtech/comm/migrations/{timestamp}-comm-template-variables-schema
 *
 * Migration delta TypeORM pour ajouter colonnes manquantes a comm_templates.
 * Si Sprint 2 deja inclut variables_schema jsonb + button_url_template,
 * ce fichier est un no-op (verifier d'abord avant create).
 */

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CommTemplateVariablesSchema1714900000000 implements MigrationInterface {
  name = 'CommTemplateVariablesSchema1714900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Verifie si colonne deja existe (idempotence)
    const hasVarSchema = await queryRunner.hasColumn('comm_templates', 'variables_schema');
    if (!hasVarSchema) {
      await queryRunner.query(`
        ALTER TABLE comm_templates
        ADD COLUMN variables_schema JSONB NOT NULL DEFAULT '{"order":[],"required":[]}'::jsonb
      `);
    }

    const hasButtonUrl = await queryRunner.hasColumn('comm_templates', 'button_url_template');
    if (!hasButtonUrl) {
      await queryRunner.query(`
        ALTER TABLE comm_templates
        ADD COLUMN button_url_template TEXT NULL
      `);
    }

    const hasMetaStatus = await queryRunner.hasColumn('comm_templates', 'meta_template_status');
    if (!hasMetaStatus) {
      await queryRunner.query(`
        ALTER TABLE comm_templates
        ADD COLUMN meta_template_status TEXT NOT NULL DEFAULT 'draft'
        CHECK (meta_template_status IN ('draft','pending_review','approved','rejected'))
      `);
    }

    // Index pour lookup (tenant_id, name, language) deja Sprint 2
    // Index supplementaire pour Sprint 9 : partial sur approved
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_comm_templates_approved
      ON comm_templates (tenant_id, name, language)
      WHERE meta_template_status = 'approved' AND deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_comm_templates_approved`);
    // Note : ne PAS drop colonnes (dependances Sprint 5/9 ulterieurs)
  }
}
```

---

## 7. Tests inventaire complet (28 tests)

| # | Test | Categorie | Coverage |
|---|------|-----------|----------|
| T1 | render fr happy path retourne components Meta valid | Happy path | core |
| T2 | render ar-MA utilise contenu darija (pas ar formel) | Locale | mapping |
| T3 | render ar formel retourne language_code ar | Locale | mapping |
| T4 | render en happy path | Locale | mapping |
| T5 | locale fallback ar-MA absent -> ar applique | Fallback | cascade |
| T6 | locale fallback ar-MA -> ar absent -> fr applique | Fallback | cascade |
| T7 | variables manquantes throw MissingTemplateVariableError | Validation | error |
| T8 | variables extra ignorees (pas erreur) | Validation | tolerance |
| T9 | cache hit retourne instant sans DB query | Cache | perf |
| T10 | cache miss query DB + cache set | Cache | flow |
| T11 | stampede lock acquired -> fetch DB normal | Stampede | concurrency |
| T12 | stampede lock NOT acquired -> poll cache | Stampede | concurrency |
| T13 | meta_template_status pending_review -> reject | Meta validation | error |
| T14 | meta_template_status rejected -> reject | Meta validation | error |
| T15 | body > 1024 chars throw TemplateBodyTooLongError | Meta limits | error |
| T16 | header avec variable {{1}} OK | Components | header |
| T17 | footer avec variable -> throw FooterCannotHaveVariablesError | Meta restriction | error |
| T18 | footer fixe (pas de variables) OK | Components | footer |
| T19 | button URL avec 1 variable OK | Components | button |
| T20 | button URL avec > 1 variable throw | Components | error |
| T21 | variables null/undefined -> throw MissingTemplateVariableError | Validation | error |
| T22 | variable string vide accepte | Validation | tolerance |
| T23 | variable contient {{ ou }} -> escape | Sanitize | security |
| T24 | bidi override chars dans variable -> stripped | Sanitize | security |
| T25 | validateMetaApproved retourne true si approved | Helper | core |
| T26 | validateMetaApproved retourne false si pending_review | Helper | core |
| T27 | getRequiredVariables retourne liste | Helper | core |
| T28 | invalidateCache appelle cache.invalidate | Helper | core |
| T29 | template totalement absent toutes locales -> Error | Edge | error |
| T30 | tenant_id isolation -- different tenant ne voit pas templates | Multi-tenant | isolation |

Tests integration Redis (3 tests dans `wa-renderer-cache.integration.spec.ts`) :
- I1 : renders + caches in Redis (set + get)
- I2 : cache invalidation works
- I3 : stampede protection -- concurrent renders

Total : 28 unit + 3 integration = 31 tests.

---

## 8. Variables environnement

Aucune nouvelle variable requise. La tache 3.2.3 utilise les variables existantes :

```env
# Sprint 3 Redis (deja config)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Sprint 2 DB (deja config)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=skalean_insurtech
DATABASE_USER=skalean
DATABASE_PASSWORD=

# Sprint 5 Tenant (deja config)
DEFAULT_TENANT_ID=00000000-0000-0000-0000-000000000001
```

Optionnel : ajout `WA_TEMPLATE_CACHE_TTL_SECONDS=300` (defaut 300) pour permettre tuning par environnement.

---

## 9. Commandes shell

```bash
cd repo

# Install dependencies (deja Sprint 2/3, idempotent)
pnpm install

# Typecheck
pnpm --filter @insurtech/comm typecheck

# Lint
pnpm --filter @insurtech/comm lint:check

# Tests unitaires (28 tests)
pnpm --filter @insurtech/comm test src/services/wa-template-renderer.service.spec.ts

# Tests integration Redis (necessite Redis local)
SKIP_REDIS=0 pnpm --filter @insurtech/comm test:integration src/__tests__/integration/wa-renderer-cache.integration.spec.ts

# Coverage
pnpm --filter @insurtech/comm test:coverage

# Build
pnpm --filter @insurtech/comm build

# Migration delta (si Sprint 2 ne contient pas variables_schema)
pnpm --filter @insurtech/comm migration:run

# Seeds darija (manuel, integre Tache 3.2.5 normalement)
pnpm --filter @insurtech/infrastructure ts-node scripts/seed-darija-templates.ts
```

---

## 10. Criteres validation V1-V32

### P0 (24)

- **V1** : `pnpm --filter @insurtech/comm typecheck` reussit (no errors).
  - Commande : `pnpm --filter @insurtech/comm typecheck`
  - Expected : `Found 0 errors`

- **V2** : `pnpm --filter @insurtech/comm build` reussit (artifacts dist/ generes).
  - Commande : `pnpm --filter @insurtech/comm build && ls packages/comm/dist/services/wa-template-renderer.service.js`
  - Expected : fichier existe

- **V3** : Tests unitaires passent (28+ tests).
  - Commande : `pnpm --filter @insurtech/comm test src/services/wa-template-renderer.service.spec.ts`
  - Expected : `Tests  28 passed`

- **V4** : `WaTemplateRendererService.render()` retourne `MetaTemplateComponents` valid.
  - Commande : voir T1
  - Expected : `result.language_code === 'fr'`, `result.components[0].type === 'body'`

- **V5** : `render('appointment_reminder_24h', 'ar-MA', vars)` utilise contenu darija (pas ar formel).
  - Commande : voir T2
  - Expected : DB row avec `language='ar-MA'` retourne, body contient "Salam ... kayna 3andek"

- **V6** : Locale fallback `ar-MA -> ar` applique si ar-MA absent.
  - Commande : voir T5
  - Expected : `result.fallback_applied === true`, `result.resolved_locale === 'ar'`

- **V7** : Locale fallback cascade `ar-MA -> ar -> fr` applique si ar absent.
  - Commande : voir T6
  - Expected : `result.fallback_applied === true`, `result.resolved_locale === 'fr'`

- **V8** : Variables manquantes -> `MissingTemplateVariableError` avec liste explicite.
  - Commande : voir T7
  - Expected : `error.missing === ['appointment_time']`

- **V9** : Variables extra ignorees (pas d'erreur).
  - Commande : voir T8
  - Expected : pas d'exception

- **V10** : Cache hit evite query DB.
  - Commande : voir T9
  - Expected : `repo.findOne` not called

- **V11** : Cache miss -> query DB + cache set.
  - Commande : voir T10
  - Expected : `repo.findOne` called once, `cache.set` called once

- **V12** : Stampede protection -- lock SETNX acquise lors fetch DB.
  - Commande : voir T11
  - Expected : `cache.acquireLock` called

- **V13** : Stampede protection -- poll si lock NOT acquis.
  - Commande : voir T12
  - Expected : `cache.pollUntilCached` called, `repo.findOne` not called

- **V14** : Meta status `pending_review` -> `MetaTemplateNotApprovedError`.
  - Commande : voir T13
  - Expected : `MetaTemplateNotApprovedError` thrown

- **V15** : Meta status `rejected` -> rejection.
  - Commande : voir T14
  - Expected : `MetaTemplateNotApprovedError` thrown

- **V16** : Body > 1024 chars -> `TemplateBodyTooLongError`.
  - Commande : voir T15
  - Expected : `TemplateBodyTooLongError` thrown avec `actualLength === 1025`

- **V17** : Header avec variable -> Meta component header genere.
  - Commande : voir T16
  - Expected : `result.components.find(c => c.type === 'header') !== undefined`

- **V18** : Footer avec variable -> `FooterCannotHaveVariablesError`.
  - Commande : voir T17
  - Expected : `FooterCannotHaveVariablesError` thrown

- **V19** : Button URL avec 1 variable -> Meta component button genere.
  - Commande : voir T19
  - Expected : `result.components.find(c => c.type === 'button')?.sub_type === 'url'`

- **V20** : Variables null/undefined -> `MissingTemplateVariableError`.
  - Commande : voir T21
  - Expected : `MissingTemplateVariableError` thrown

- **V21** : Variable contient `{{` ou `}}` -> escape applique.
  - Commande : voir T23
  - Expected : `result.components[0].parameters[0].text === 'Mr \\{\\{boss\\}\\}'`

- **V22** : Bidi override chars stripped pour anti-spoofing.
  - Commande : voir T24
  - Expected : caracteres U+202E supprimes

- **V23** : `validateMetaApproved()` retourne `true` ssi `meta_template_status === 'approved'`.
  - Commande : voir T25-T26
  - Expected : `true` pour approved, `false` pour pending_review

- **V24** : Tenant isolation -- tenant A ne voit pas templates tenant B.
  - Commande : voir T30
  - Expected : `TemplateNotFoundError` thrown

### P1 (5)

- **V25** : Coverage >= 88%.
  - Commande : `pnpm --filter @insurtech/comm test:coverage`
  - Expected : coverage WaTemplateRendererService.ts >= 88% lines, branches, functions, statements

- **V26** : No-emoji.
  - Commande : `grep -rP "[\x{1F300}-\x{1F9FF}]" packages/comm/src && exit 1 || echo OK`
  - Expected : `OK`

- **V27** : No-console.log.
  - Commande : `grep -rn "console\.log" packages/comm/src --include="*.ts" && exit 1 || echo OK`
  - Expected : `OK`

- **V28** : 5 templates seed darija valid (JSON parsable, schemas coherents).
  - Commande : `node -e "const d=require('./packages/comm/src/templates/seeds/wa-template-darija-examples.json'); if (d.length !== 5) process.exit(1); d.forEach(t => { if (!t.name || !t.body_template || !t.variables_schema?.order) process.exit(1); })"`
  - Expected : exit code 0

- **V29** : Bench render < 5ms p99 cache hit.
  - Commande : custom bench script `node scripts/bench-wa-renderer.ts`
  - Expected : p99 < 5ms

### P2 (3)

- **V30** : Tests integration Redis passent (3 tests).
  - Commande : `SKIP_REDIS=0 pnpm --filter @insurtech/comm test:integration`
  - Expected : `Tests  3 passed`

- **V31** : Stampede protection effective sur 100 concurrent renders.
  - Commande : custom load test script
  - Expected : 1 seule SELECT DB observe (vs 100 sans protection)

- **V32** : Documentation README enrichie avec section WA renderer + exemples.
  - Commande : `grep -q "WaTemplateRendererService" packages/comm/README.md`
  - Expected : trouve

---

## 11. Edge cases (15)

1. **Variable name avec underscore vs camelCase** : Skalean convention strict snake_case (`{{user_name}}`). Si caller passe `userName`, error explicite `MissingTemplateVariableError` car `user_name` requis. Sprint 27 admin UI lint check.

2. **Variable value contient `{{` ou `}}`** : escape applique via `sanitizeVariableValue` -> `\\{\\{...\\}\\}`. Test T23. Pattern : `str.replace(/\{\{/g, '\\{\\{').replace(/\}\}/g, '\\}\\}')`.

3. **Variables vides (string vide `""`)** : Meta accepte legalement. Test T22. Use case : optional metadata absent (`secondary_phone: ''`).

4. **Variables null/undefined** : THROW explicit `MissingTemplateVariableError`. Test T21. Pattern : check `value === null || value === undefined` avant push.

5. **Locale `ar-MA` mapped to Meta `language_code='ar'`** : transparent pour caller, gere via `mapLocaleToMeta()`. Test T2. Le contenu DB `body_template` est darija mais Meta API recoit `language_code: 'ar'`.

6. **Cache stale 5min apres update template via admin Sprint 27** : Kafka event `comm.template_updated` -> `WaTemplateRendererService.invalidateCache()` evict cache. Latency invalidation < 100ms. Pattern : `await this.cache.invalidate(tenantId, name, locale)`.

7. **Concurrent renders du meme template (cache stampede)** : SETNX lock TTL 5sec + polling 50ms. Test I3 integration. Garantit 1 seule SELECT DB pour 100 renders concurrents cache miss.

8. **DB unavailable -> fallback memory cache court (1min)** : pas implemente Sprint 9 (deferred Sprint 33). Comportement actuel : throw error, BullMQ retry 3x exponential backoff.

9. **Template body avec emoji** : reject via regex check `/[\u{1F300}-\u{1F9FF}]/u`. Conjugue decision-006 + Meta strict policy `utility` templates. Implementation : check pre-render + Sprint 27 admin UI lint at save time.

10. **RTL chars dans variable user_name (ex: prenom arabe)** : Meta accepte. `Mohamed: 'محمد'` rendere correctement avec `language_code='ar'` ou `language_code='fr'` (mixed content acceptable). Pas de conversion necessaire.

11. **Bidi override chars suspects (U+202A-U+202E, U+2066-U+2069)** : sanitize -> strip. Test T24. Pattern : `str.replace(/[‪-‮⁦-⁩]/u, '')`.

12. **Template body avec ligne return `\n`** : Meta accepte (preserve formatting). Pas de transformation. Tests via templates seed.

13. **Variable date format** : pas de helper format auto Sprint 9 (caller responsable). Convention : `appointment_time: '15:00'` (HH:mm) ou `due_date: '15/05/2026'` (dd/mm/yyyy MA convention). Sprint 14+ ajoutera helpers `formatDate(date, locale)`.

14. **Variable currency format** : pas de helper auto. Convention : `quote_amount: '3500'` (chiffre brut) + texte fixe `MAD` dans body. Alternative future : Meta `currency` parameter type (Sprint 14+).

15. **Tenant context absent (rare, dev/test)** : throw `Error('No tenant context for render()')`. Pattern : check `tenantContext.getCurrentTenantId()` first.

---

## 12. Conformite Maroc

- **Loi marketing direct (loi 24-09 ANRT 2024)** : templates `category='utility'` (transactionnels) sont autorises 24/7. Templates `category='marketing'` (campagnes) limitees 8h-21h Africa/Casablanca. La tache 3.2.3 ne valide PAS la fenetre temporelle (deferred Tache 3.2.9 orchestrator), mais le `category` est stocke dans `comm_templates` (Sprint 2). Tous les 5 seeds darija sont `category='utility'`.

- **Loi 09-08 article 4** : variables qui contiennent PII (nom, telephone, CIN, RIB) doivent etre logged hash uniquement. Pattern : le service `WaTemplateRendererService` ne log JAMAIS la valeur des variables en clair. Logging structure : `{ action: 'wa_template_rendered', template_id, requested_locale, resolved_locale, components_count, duration_ms }`. Pas de `variables` field. Sprint 33 audit log will hash if PII detected.

- **Loi 09-08 article 28 (breach 72h)** : aucun rapport breach impact direct sur cette tache (pas de stockage PII direct). Rappels : indirect via Sprint 13 SecurityIncident workflow.

- **ACAPS circulaire 2024 (communications assureur)** : identification commerciale obligatoire dans body templates. Convention Skalean : tous les templates terminent par footer `Skalean InsurTech` ou mention courtier (`m3a {{broker_name}}` dans body). Lint Sprint 27 verifiera.

- **CNDP loi 09-08 opt-out** : conformite gere par Tache 3.2.11 (opt-out CNDP), pas dans cette tache. WaTemplateRendererService ne fait PAS de check opt-out (responsabilite orchestrator Tache 3.2.9).

- **Decret 2-09-165 (transferts donnees hors MA)** : Meta WhatsApp Cloud API hebergee aux USA / EU. Conformite : Sprint 35 evaluation cloud souverain alternative (decision-008). Pour Sprint 9, accepter Meta US/EU hosting comme MVP avec conformite RGPD-equivalent + ACAPS notice.

---

## 13. Conventions absolues (15)

1. **Multi-tenant strict** : tous les queries DB filtrent `tenant_id`. Cache key contient `tenant_id`. Test T30 verifie isolation.

2. **Validation Zod runtime** : `variables_schema` jsonb stocke schema Zod-compatible. Validation `parse()` dans pipe Sprint 27 admin UI. Cette tache : validation manuelle pre-render via check `required` array (sans Zod runtime ici, mais le schema serialise est compatible).

3. **Logger Pino structure** : `{ action, template_id, template_name, requested_locale, resolved_locale, fallback_applied, meta_language_code, duration_ms, components_count }`. Aucun champ `variables` (PII protection).

4. **No-emoji** : aucun emoji dans code source, comments, logs, templates. Verifie via grep regex Unicode block check.

5. **No-console** : aucun `console.log/warn/error`. Utiliser `Logger` NestJS uniquement.

6. **No PII en clair logs** : variables values jamais logged. Hash si necessaire (Sprint 33 audit).

7. **pnpm workspace** : aucun `npm`, `yarn`. Commandes `pnpm --filter @insurtech/comm`.

8. **TypeScript strict** : `strict: true` dans tsconfig. `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` actifs.

9. **Tests Vitest >= 28** : couverture comportementale. Coverage >= 88% module.

10. **Skalean AI** : aucun (cette tache est non-AI).

11. **Idempotency** : `render()` est idempotent (meme input -> meme output). Cache invalidation via Kafka event UNIQUE par template+locale+tenant.

12. **Cloud souverain** : Sprint 35 transition Atlas Cloud Benguerir pour Redis. Cette tache compatible.

13. **Crypto** : aucun (pas de signature, pas de chiffrement direct dans cette tache).

14. **JSDoc** : tous les exports publics documentes avec JSDoc.

15. **Performance** : render < 5ms p99 (cache hit), < 50ms p99 (cache miss + DB).

---

## 14. Validation pre-commit

```bash
cd repo

# 1. Typecheck
pnpm --filter @insurtech/comm typecheck

# 2. Lint
pnpm --filter @insurtech/comm lint:check

# 3. Tests unit
pnpm --filter @insurtech/comm test src/services/wa-template-renderer.service.spec.ts
pnpm --filter @insurtech/comm test src/helpers/wa-variable-parser.helper.spec.ts
pnpm --filter @insurtech/comm test src/helpers/locale-fallback.helper.spec.ts

# 4. Tests integration (necessite Redis local)
SKIP_REDIS=0 pnpm --filter @insurtech/comm test:integration

# 5. Coverage
pnpm --filter @insurtech/comm test:coverage

# 6. Build
pnpm --filter @insurtech/comm build

# 7. No-emoji check
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/comm/src && exit 1 || echo "[OK] no-emoji"

# 8. No-console check
grep -rn "console\.log\|console\.warn\|console\.error" packages/comm/src --include="*.ts" && exit 1 || echo "[OK] no-console"

# 9. No PII logs check
grep -rn "logger.*variables" packages/comm/src --include="*.ts" && exit 1 || echo "[OK] no-PII-logs"

# 10. Verify 5 darija seeds
node -e "
const d = require('./packages/comm/src/templates/seeds/wa-template-darija-examples.json');
if (d.length !== 5) { console.error('Expected 5 darija seeds, got ' + d.length); process.exit(1); }
const expected = ['appointment_reminder_24h','police_signed_confirmation','quote_generated','payment_due_reminder','claim_received_acknowledgement'];
for (const name of expected) {
  if (!d.find(t => t.name === name)) { console.error('Missing ' + name); process.exit(1); }
}
for (const t of d) {
  if (t.language !== 'ar-MA') { console.error(t.name + ' not ar-MA'); process.exit(1); }
  if (!t.variables_schema?.order?.length) { console.error(t.name + ' missing order'); process.exit(1); }
}
console.log('[OK] 5 darija seeds valid');
"

# 11. Verify Meta language_code mapping correct
node -e "
const { mapLocaleToMeta } = require('./packages/comm/dist/types/locale.enum.js');
const tests = [['fr','fr'],['ar-MA','ar'],['ar','ar'],['en','en']];
for (const [in_, out_] of tests) {
  if (mapLocaleToMeta(in_) !== out_) { console.error('Mapping failed: ' + in_); process.exit(1); }
}
console.log('[OK] mapLocaleToMeta');
"

# 12. Verify fallback chain correct
node -e "
const { getFallbackChain } = require('./packages/comm/dist/types/locale.enum.js');
const tests = {
  'ar-MA': ['ar','fr','en'],
  'ar': ['fr','en'],
  'fr': ['en'],
  'en': []
};
for (const [in_, out_] of Object.entries(tests)) {
  const got = getFallbackChain(in_);
  if (JSON.stringify(got) !== JSON.stringify(out_)) {
    console.error('Chain failed for ' + in_ + ': got ' + JSON.stringify(got));
    process.exit(1);
  }
}
console.log('[OK] getFallbackChain');
"

echo "[ALL CHECKS PASSED]"
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-09): implement WaTemplateRendererService 4 locales fr/ar-MA/ar/en

Implements WhatsApp template renderer with variable mapping (named -> ordered
Meta API format), Redis cache 5min with stampede protection, locale fallback
cascade (ar-MA -> ar -> fr -> en), and strict Meta-approved status validation.
Service consumed by Tache 3.2.8 (BullMQ wa-send worker) and Tache 3.2.9
(message orchestrator routing decision).

Locales :
- fr : francais Maroc
- ar-MA : darija marocain (vernaculaire familier, Meta language_code 'ar')
- ar : arabe classique formel (institutions, ACAPS)
- en : anglais international

Pattern critique : variables nommees DX-friendly mappees vers ordered Meta
parameters via variables_schema.order JSONB stocke en DB. 5 templates seed
darija marocain consommes par Tache 3.2.5 Template Manager.

Livrables :
- WaTemplateRendererService (~220 lignes, 6 methods publics)
- WaTemplateCacheService Redis (~120 lignes, stampede protection SETNX)
- WaVariableParserHelper (~120 lignes, extract + map + sanitize)
- LocaleFallbackHelper (~80 lignes, cascade documentee)
- Locale enum + isRtl + mapLocaleToMeta + getFallbackChain
- 6 error classes typees (MetaTemplateNotApproved, MissingVariable, etc.)
- 5 templates seed darija JSON (appointment_reminder_24h, police_signed,
  quote_generated, payment_due_reminder, claim_received)
- 28 tests unit + 3 tests integration Redis = 31 tests
- Migration delta comm_templates.variables_schema (idempotent)

Tests : 28 unit + 3 integration = 31 tests
Coverage : >= 88%
Bench : render < 5ms p99 (cache hit) / < 50ms p99 (cache miss)

Conformite :
- decision-006 (no-emoji) totale
- decision-007 (Zod runtime) indirect via variables_schema serialise
- decision-009 (multi-locale 4 locales) totale
- decision-022 (Redis cache Sprint 3) totale
- ACAPS circulaire 2024 (footer identification commerciale)
- Loi 09-08 article 4 (no PII logs)

Task: 3.2.3
Sprint: 9 (Phase 3 / Sprint 2)
Reference: B-09 Tache 3.2.3
Decisions: decision-006, decision-007, decision-009, decision-022
Depends: 3.2.2 (WhatsAppCloudApiClient)
Unblocks: 3.2.4, 3.2.5, 3.2.8, 3.2.9, 3.2.13"
```

---

## 16. Workflow next step

Apres commit, passer a `task-3.2.4-wa-webhook-receiver-hmac.md` qui implementera l'endpoint public `/api/v1/public/webhooks/whatsapp` (GET verification challenge + POST webhook receiver) avec verification signature HMAC SHA-256 via `X-Hub-Signature-256` header, idempotency via `comm_webhooks_received` table (idempotency_key = sha256(rawBody)), publication Kafka event `comm.webhook_received`, et controller Fastify configure avec rawBody preservation pour HMAC. La tache 3.2.4 utilise `WaTemplateRendererService` indirectement (via tests integration only).

---

## Annexe A. Production migration cache strategy Sprint 35

Sprint 35 deploiera Redis cluster sur Atlas Cloud Services Benguerir avec replication multi-AZ pour high availability. Configuration prod prevue :

```env
# Sprint 35 prod
REDIS_HOST=redis-cluster.atlas.benguerir.ma
REDIS_PORT=6379
REDIS_PASSWORD=<vault-secret>
REDIS_TLS=true
REDIS_CLUSTER_NODES=node1.redis,node2.redis,node3.redis
REDIS_DB=0
WA_TEMPLATE_CACHE_TTL_SECONDS=300
WA_TEMPLATE_CACHE_PREFIX=skalean:prod:wa-template
```

Le service `WaTemplateCacheService` est deja compatible cluster Redis via `RedisService` de Sprint 3 qui supporte ioredis cluster mode. Aucune modification code attendue Sprint 35.

Stampede protection sur cluster : SETNX fonctionne nativement en cluster Redis (single-key operation), pas de coordination cross-node necessaire.

Estimation cost Sprint 35 :
- Redis cluster 3 nodes (1.5 GB chacun) : ~250 EUR/mois Atlas Cloud
- Cache hit ratio attendu : > 95% (vs DB query)
- Reduction load DB : ~95% sur queries comm_templates

---

## Annexe B. Stampede protection benchmark

Pattern SETNX lock + polling : tradeoffs.

Sans stampede protection (naive cache miss) :
```
T=0    : Worker A fetch DB (50ms)
T=0    : Worker B fetch DB (50ms)
T=0    : Worker C fetch DB (50ms)
... 100 workers concurrent ...
T=50ms : 100 SELECT DB executees (Postgres pool exhausted potentiel)
```

Avec SETNX lock :
```
T=0    : Worker A SETNX lock OK -> fetch DB
T=0    : Worker B SETNX lock fail -> poll cache
T=0    : Worker C SETNX lock fail -> poll cache
... 100 workers concurrent ...
T=50ms : Worker A finishes -> cache.set + lock release
T=100ms: Workers B-Z poll cache hit -> return
```

Resultat : 1 SELECT DB pour 100 workers concurrents (vs 100). Reduction 99%.

Cost overhead : +50ms latency per worker B-Z (polling 50ms intervals) vs direct DB query 50ms. Equivalent.

Cas degenere : si Worker A crash avant cache.set, lock TTL 5sec libere, Worker B SETNX OK, fetch DB. Recovery automatique.

---

## Annexe C. Templates seed complete (5 ar-MA + 5 en + 5 fr + 5 ar)

Pour faciliter Tache 3.2.5 Template Manager seed, voici les 5 templates dans les 4 locales (20 templates total). Format JSON.

### C.1 fr (francais Maroc)

```json
[
  {
    "name": "appointment_reminder_24h",
    "language": "fr",
    "category": "utility",
    "body_template": "Bonjour {{user_name}}, vous avez un rendez-vous demain a {{appointment_time}} avec {{broker_name}}. A bientot!",
    "footer_template": "Skalean InsurTech",
    "variables_schema": { "order": ["user_name","appointment_time","broker_name"], "required": ["user_name","appointment_time","broker_name"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "police_signed_confirmation",
    "language": "fr",
    "category": "utility",
    "body_template": "Felicitations {{user_name}}! Votre police est signee. Numero: {{police_number}}. Suivez-la sur l'application Skalean.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/police/{{police_id}}",
    "variables_schema": { "order": ["user_name","police_number","police_id"], "required": ["user_name","police_number","police_id"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "quote_generated",
    "language": "fr",
    "category": "utility",
    "body_template": "Bonjour {{user_name}}, votre devis est pret! Prix: {{quote_amount}} MAD. Valide jusqu'au {{valid_until}}. Consultez-le sur l'app.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/quote/{{quote_id}}",
    "variables_schema": { "order": ["user_name","quote_amount","valid_until","quote_id"], "required": ["user_name","quote_amount","valid_until","quote_id"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "payment_due_reminder",
    "language": "fr",
    "category": "utility",
    "body_template": "Bonjour {{user_name}}, vous avez un paiement de {{amount}} MAD a regler avant le {{due_date}}. Merci de proceder au paiement.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/pay/{{payment_id}}",
    "variables_schema": { "order": ["user_name","amount","due_date","payment_id"], "required": ["user_name","amount","due_date","payment_id"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "claim_received_acknowledgement",
    "language": "fr",
    "category": "utility",
    "body_template": "Bonjour {{user_name}}, votre sinistre est enregistre. Numero: {{claim_number}}. Nous reviendrons vers vous sous {{eta_days}} jours.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/claim/{{claim_id}}",
    "variables_schema": { "order": ["user_name","claim_number","eta_days","claim_id"], "required": ["user_name","claim_number","eta_days","claim_id"] },
    "meta_template_status": "pending_review"
  }
]
```

### C.2 ar (arabe classique formel)

```json
[
  {
    "name": "appointment_reminder_24h",
    "language": "ar",
    "category": "utility",
    "body_template": "السلام عليكم {{user_name}}، لديكم موعد غدا في {{appointment_time}} مع السيد {{broker_name}}. شكرا لكم.",
    "footer_template": "Skalean InsurTech",
    "variables_schema": { "order": ["user_name","appointment_time","broker_name"], "required": ["user_name","appointment_time","broker_name"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "police_signed_confirmation",
    "language": "ar",
    "category": "utility",
    "body_template": "تهانينا {{user_name}}! تم توقيع وثيقة التأمين. الرقم: {{police_number}}. يمكنكم متابعتها عبر تطبيق Skalean.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/police/{{police_id}}",
    "variables_schema": { "order": ["user_name","police_number","police_id"], "required": ["user_name","police_number","police_id"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "quote_generated",
    "language": "ar",
    "category": "utility",
    "body_template": "السلام عليكم {{user_name}}، عرض الأسعار جاهز! المبلغ: {{quote_amount}} درهم. صالح إلى {{valid_until}}.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/quote/{{quote_id}}",
    "variables_schema": { "order": ["user_name","quote_amount","valid_until","quote_id"], "required": ["user_name","quote_amount","valid_until","quote_id"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "payment_due_reminder",
    "language": "ar",
    "category": "utility",
    "body_template": "السلام عليكم {{user_name}}، لديكم دفعة بقيمة {{amount}} درهم قبل {{due_date}}. شكرا للتسوية في الوقت المحدد.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/pay/{{payment_id}}",
    "variables_schema": { "order": ["user_name","amount","due_date","payment_id"], "required": ["user_name","amount","due_date","payment_id"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "claim_received_acknowledgement",
    "language": "ar",
    "category": "utility",
    "body_template": "السلام عليكم {{user_name}}، تم استلام إشعار الحادث. الرقم: {{claim_number}}. سنتواصل معكم خلال {{eta_days}} أيام.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/claim/{{claim_id}}",
    "variables_schema": { "order": ["user_name","claim_number","eta_days","claim_id"], "required": ["user_name","claim_number","eta_days","claim_id"] },
    "meta_template_status": "pending_review"
  }
]
```

### C.3 en (anglais international)

```json
[
  {
    "name": "appointment_reminder_24h",
    "language": "en",
    "category": "utility",
    "body_template": "Hello {{user_name}}, you have an appointment tomorrow at {{appointment_time}} with {{broker_name}}. See you soon!",
    "footer_template": "Skalean InsurTech",
    "variables_schema": { "order": ["user_name","appointment_time","broker_name"], "required": ["user_name","appointment_time","broker_name"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "police_signed_confirmation",
    "language": "en",
    "category": "utility",
    "body_template": "Congratulations {{user_name}}! Your insurance policy is signed. Number: {{police_number}}. Track it on the Skalean app.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/police/{{police_id}}",
    "variables_schema": { "order": ["user_name","police_number","police_id"], "required": ["user_name","police_number","police_id"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "quote_generated",
    "language": "en",
    "category": "utility",
    "body_template": "Hello {{user_name}}, your quote is ready! Amount: {{quote_amount}} MAD. Valid until {{valid_until}}. Check it on the app.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/quote/{{quote_id}}",
    "variables_schema": { "order": ["user_name","quote_amount","valid_until","quote_id"], "required": ["user_name","quote_amount","valid_until","quote_id"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "payment_due_reminder",
    "language": "en",
    "category": "utility",
    "body_template": "Hello {{user_name}}, you have a payment of {{amount}} MAD due by {{due_date}}. Please settle on time. Thank you.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/pay/{{payment_id}}",
    "variables_schema": { "order": ["user_name","amount","due_date","payment_id"], "required": ["user_name","amount","due_date","payment_id"] },
    "meta_template_status": "pending_review"
  },
  {
    "name": "claim_received_acknowledgement",
    "language": "en",
    "category": "utility",
    "body_template": "Hello {{user_name}}, your claim is registered. Number: {{claim_number}}. We will get back to you within {{eta_days}} days.",
    "footer_template": "Skalean InsurTech",
    "button_url_template": "https://app.skalean.ma/claim/{{claim_id}}",
    "variables_schema": { "order": ["user_name","claim_number","eta_days","claim_id"], "required": ["user_name","claim_number","eta_days","claim_id"] },
    "meta_template_status": "pending_review"
  }
]
```

---

## Annexe D. Performance benchmarks attendus

```
WaTemplateRendererService.render (cache hit Redis):    median 0.8 ms   (p99: 4 ms)
WaTemplateRendererService.render (cache miss DB):      median 25 ms    (p99: 80 ms)
WaTemplateRendererService.render (cache miss + lock):  median 30 ms    (p99: 95 ms)
WaTemplateRendererService.render (poll lock):          median 50-100ms (p99: 5000ms timeout)
extractPlaceholders (regex) on 500-char body:          median 0.05 ms  (p99: 0.2 ms)
mapToOrderedParams (5 vars):                            median 0.1 ms   (p99: 0.5 ms)
sanitizeVariableValue (NFC + escape + bidi):           median 0.05 ms  (p99: 0.2 ms)
resolveLocale (cascade):                                median 0.1 ms   (p99: 0.5 ms)
WaTemplateCacheService.get (Redis HGET):                median 0.5 ms   (p99: 2 ms)
WaTemplateCacheService.set (Redis SETEX):               median 0.5 ms   (p99: 2 ms)
WaTemplateCacheService.acquireLock (Redis SETNX):       median 0.5 ms   (p99: 2 ms)
DB query SELECT comm_templates (single row):            median 15 ms    (p99: 60 ms)
```

Distribution typique production Sprint 17 broadcast 5000-messages :
- 1 cache miss (template froid, 1ere fois) : ~30ms
- 4999 cache hits : ~1ms each = 5sec total (vs 75sec sans cache)
- Reduction : -93% latency totale broadcast

---

## Annexe E. Comparaison templates 4 locales (template `appointment_reminder_24h`)

| Locale | Body template | Char count | Lecture difficulte (assure MA) |
|--------|---------------|------------|-------------------------------|
| fr | "Bonjour Mohamed, vous avez un rendez-vous demain a 15:00 avec Hassan. A bientot!" | 84 | Facile (urbains educations francaise) |
| ar-MA (darija) | "Salam Mohamed, kayna 3andek mawid ghadda f 15:00 m3a Hassan. Llh y3awnek!" | 80 | Tres facile (vernaculaire familier) |
| ar (formel) | "السلام عليكم محمد، لديكم موعد غدا في 15:00 مع السيد حسن. شكرا لكم." | 70 | Moyenne (inadequat pour SMS rappel, trop formel) |
| en | "Hello Mohamed, you have an appointment tomorrow at 15:00 with Hassan. See you soon!" | 86 | Difficile (sauf anglophones) |

Insight : ar-MA darija est la locale optimale UX pour 35% de la population MA (assures regions interieures, age 40+). Le ton chaleureux ("Llh y3awnek!" = "May God help you!", expression familiere) augmente engagement +25% selon tests A/B Sprint 1.

---

## Annexe F. Meta API request example (post-render)

Exemple complet de la requete Meta API construite a partir du resultat de `render('appointment_reminder_24h', 'ar-MA', vars)` :

```typescript
// Tache 3.2.8 WaSendWorker construit la requete Meta :
const components = await renderer.render(
  'appointment_reminder_24h',
  'ar-MA',
  { user_name: 'Mohamed', appointment_time: '15:00', broker_name: 'Hassan' }
);
// components = {
//   language_code: 'ar',
//   components: [
//     { type: 'body', parameters: [
//       { type: 'text', text: 'Mohamed' },
//       { type: 'text', text: '15:00' },
//       { type: 'text', text: 'Hassan' }
//     ]}
//   ]
// }

// Appel Meta v21.0
const metaRequest = {
  messaging_product: 'whatsapp',
  to: '212612345678',  // E.164 sans +
  type: 'template',
  template: {
    name: 'appointment_reminder_24h',
    language: { code: components.language_code },  // 'ar'
    components: components.components,
  },
};

// POST https://graph.facebook.com/v21.0/{phone_number_id}/messages
// Headers: Authorization: Bearer {access_token}, Content-Type: application/json
// Body: JSON.stringify(metaRequest)

// Response Meta :
// {
//   "messaging_product": "whatsapp",
//   "contacts": [{ "input": "212612345678", "wa_id": "212612345678" }],
//   "messages": [{ "id": "wamid.HBgMMjEyNjEy..." }]
// }
```

Le `id` retourne (Meta `wamid`) est stocke dans `comm_messages.provider_message_id` (Sprint 2) et utilise pour correlate les webhooks status updates de Tache 3.2.4.

---

## Annexe G. Documentation README addition

Section a ajouter a `repo/packages/comm/README.md` :

```markdown
## WhatsApp Template Renderer (Sprint 9 Tache 3.2.3)

Service rendant les templates WhatsApp avec mapping variables nommees DX-friendly
vers ordered parameters Meta API format.

### Quick start

```typescript
import { WaTemplateRendererService } from '@insurtech/comm';

@Injectable()
export class MyService {
  constructor(private readonly renderer: WaTemplateRendererService) {}

  async sendReminder() {
    const components = await this.renderer.render(
      'appointment_reminder_24h',
      'ar-MA',
      { user_name: 'Mohamed', appointment_time: '15:00', broker_name: 'Hassan' }
    );
    // components.language_code === 'ar' (Meta mapping)
    // components.components === [{ type:'body', parameters:[...] }]
    return components;
  }
}
```

### Locales supportees

| Locale | Description | Meta mapping |
|--------|-------------|--------------|
| `fr` | Francais Maroc | `fr` |
| `ar-MA` | Darija marocain (vernaculaire) | `ar` |
| `ar` | Arabe classique formel | `ar` |
| `en` | Anglais international | `en` |

### Cascade fallback

Si template absent dans locale demandee :
- `ar-MA` -> `ar` -> `fr` -> `en`
- `ar` -> `fr` -> `en`
- `fr` -> `en`
- `en` -> error

Warning log emis avec `cascade_depth` quand fallback applique.

### Cache Redis

TTL 5min par defaut. Key pattern : `wa-template:{tenant_id}:{name}:{locale}`.
Stampede protection via SETNX lock (5sec TTL).
Invalidation Kafka driven sur `comm.template_updated`.

### Errors

- `MetaTemplateNotApprovedError` : status != 'approved'
- `MissingTemplateVariableError` : variables required absentes (liste explicite)
- `TemplateNotFoundError` : aucune locale disponible
- `TemplateBodyTooLongError` : body > 1024 chars
- `FooterCannotHaveVariablesError` : footer contient `{{var}}` (Meta strict)
- `TemplateFallbackExhaustedError` : cascade fallback echec total

### Conventions naming variables

- snake_case strict : `user_name`, `appointment_time`, `policy_number`
- Pas de camelCase, pas de PascalCase
- Lint Sprint 27 admin UI verifie coherence body/order

### Performance

- Cache hit : < 5ms p99
- Cache miss + DB : < 50ms p99
- Stampede protection : 1 seule SELECT DB pour 100 renders concurrents
```

---

## Annexe H. Kafka consumer template_updated (integration Sprint 27)

Sprint 27 admin UI emettra event `comm.template_updated` lors de la modification ou approval d'un template. Le service `WaTemplateRendererService` doit consumer cet event pour invalider le cache Redis correspondant.

```typescript
/**
 * @insurtech/comm/consumers/template-updated.consumer
 *
 * Kafka consumer pour invalider cache WaTemplateRenderer.
 */

import { Injectable, Logger } from '@nestjs/common';
import { KafkaConsumerBase, type KafkaEvent } from '@insurtech/messaging';
import { Topics } from '@insurtech/messaging';
import { z } from 'zod';
import { WaTemplateRendererService } from '../services/wa-template-renderer.service.js';

const TemplateUpdatedSchema = z.object({
  tenant_id: z.string().uuid(),
  template_id: z.string().uuid(),
  template_name: z.string(),
  language: z.enum(['fr', 'ar-MA', 'ar', 'en']),
  action: z.enum(['created', 'updated', 'approved', 'rejected', 'deleted']),
  updated_at: z.string().datetime(),
});

@Injectable()
export class TemplateUpdatedConsumer extends KafkaConsumerBase {
  private readonly logger = new Logger(TemplateUpdatedConsumer.name);

  constructor(private readonly renderer: WaTemplateRendererService) {
    super({ topic: Topics.COMM_TEMPLATE_UPDATED, groupId: 'comm-renderer-cache-invalidator' });
  }

  async process(event: KafkaEvent): Promise<void> {
    const data = TemplateUpdatedSchema.parse(event.data);
    await this.renderer.invalidateCache(data.template_name, data.language, data.tenant_id);
    this.logger.log({
      action: 'wa_template_cache_invalidated_via_kafka',
      template_id: data.template_id,
      template_name: data.template_name,
      language: data.language,
      tenant_id: data.tenant_id,
      kafka_action: data.action,
    });
  }
}
```

Topic Kafka : `insurtech.comm.template_updated` (defini Sprint 2 + 27).

Latency invalidation : producer Sprint 27 -> Kafka -> consumer Sprint 9 < 100ms typique. Garantit que les workers BullMQ utilisent toujours la version la plus recente du template (vs stale 5min cache TTL classique).

---

## Annexe I. OTEL metrics Sprint 33 prepare

Sprint 33 Observability ajoutera metrics OTEL pour monitoring le service. Les noms et labels sont definis ici pour preparation :

```typescript
// Metrics futures Sprint 33
import { Counter, Histogram } from '@opentelemetry/api';

const renderDuration = meter.createHistogram('wa_template_render_duration_ms', {
  description: 'WaTemplateRendererService render() duration',
  unit: 'ms',
});

const cacheHitCounter = meter.createCounter('wa_template_cache_hit_total', {
  description: 'WaTemplateRenderer cache hit count',
});

const cacheMissCounter = meter.createCounter('wa_template_cache_miss_total', {
  description: 'WaTemplateRenderer cache miss count',
});

const fallbackCounter = meter.createCounter('wa_template_locale_fallback_total', {
  description: 'WaTemplateRenderer locale fallback applied count',
});

const errorCounter = meter.createCounter('wa_template_render_error_total', {
  description: 'WaTemplateRenderer render() errors',
});

// Labels :
// - tenant_id : UUID tenant
// - template_name : ex 'appointment_reminder_24h'
// - requested_locale : fr / ar-MA / ar / en
// - resolved_locale : fr / ar-MA / ar / en (apres fallback)
// - error_type : MetaTemplateNotApproved / MissingVariable / etc.
// - cache_status : hit / miss / poll_timeout
```

Dashboards Grafana Sprint 33 : `Comm Module > WhatsApp Renderer` panel avec :
- Render duration p50/p95/p99
- Cache hit ratio (target >= 95%)
- Fallback frequency by locale
- Error rate by error_type

---

## Annexe J. Tests E2E integration full pipeline (preview Tache 3.2.13)

Bien que les tests E2E exhaustifs soient dans Tache 3.2.13, voici un test preview integrant `WaTemplateRendererService` + `WhatsAppCloudApiClient` (mock) pour validation pipeline complete :

```typescript
// repo/apps/api/test/comm/wa-pipeline.e2e-spec.ts (preview Tache 3.2.13)
describe('WA send pipeline (renderer + client)', () => {
  it('complete render + send via mock Meta API (ar-MA darija)', async () => {
    // 1. Seed template darija
    await templateRepo.save({
      tenant_id: TENANT,
      name: 'appointment_reminder_24h',
      language: 'ar-MA',
      body_template: 'Salam {{user_name}}, kayna 3andek mawid ghadda f {{appointment_time}} m3a {{broker_name}}. Llh y3awnek!',
      variables_schema: { order: ['user_name', 'appointment_time', 'broker_name'], required: ['user_name', 'appointment_time', 'broker_name'] },
      meta_template_status: 'approved',
    });

    // 2. Render
    const components = await renderer.render('appointment_reminder_24h', 'ar-MA', {
      user_name: 'Mohamed',
      appointment_time: '15:00',
      broker_name: 'Hassan',
    });

    expect(components.language_code).toBe('ar');
    expect(components.components).toHaveLength(1);

    // 3. Send via mock Meta API
    const result = await mockWaClient.sendTemplate(
      '212612345678',
      'appointment_reminder_24h',
      components.language_code,
      components.components,
    );

    expect(result.message_id).toMatch(/^wamid\./);

    // 4. Verifier mock Meta a recu request correct
    expect(mockWaClient.lastRequest).toEqual({
      messaging_product: 'whatsapp',
      to: '212612345678',
      type: 'template',
      template: {
        name: 'appointment_reminder_24h',
        language: { code: 'ar' },
        components: components.components,
      },
    });
  });
});
```

---

## Annexe K. Diagrammes sequence

### K.1 Render happy path (cache hit)

```
Caller       Service        Cache         DB
  |             |              |             |
  |---render-->|              |             |
  |            |---get------->|             |
  |            |<--template---|             |
  |            |              |             |
  |            |--validate----|             |
  |            |--mapParams---|             |
  |            |--build comp--|             |
  |<--result---|              |             |
```

### K.2 Render cache miss + fetch DB

```
Caller       Service        Cache         DB
  |             |              |             |
  |---render-->|              |             |
  |            |---get------->|             |
  |            |<--null-------|             |
  |            |--acquireLock>|             |
  |            |<--OK---------|             |
  |            |---findOne-------------->|  |
  |            |<--row---------------------|
  |            |---set------->|             |
  |            |---release--->|             |
  |            |--validate    |             |
  |            |--mapParams   |             |
  |<--result---|              |             |
```

### K.3 Render stampede (concurrent workers)

```
Worker A     Worker B     Service          Cache         DB
   |            |             |              |             |
   |--render--->|             |              |             |
   |            |--render-----|              |             |
   |            |             |---getA------>|             |
   |            |             |<--null A-----|             |
   |            |             |---getB------>|             |
   |            |             |<--null B-----|             |
   |            |             |--acquireLA-->|             |
   |            |             |<--OK A-------|             |
   |            |             |--acquireLB-->|             |
   |            |             |<--FAIL B-----|             |
   |            |             |  (B polls cache loop)      |
   |            |             |---findOne A-------------->|
   |            |             |<--row A--------------------|
   |            |             |---set A----->|             |
   |            |             |---release A->|             |
   |            |             |  (B poll : cache hit)      |
   |            |             |---getB------>|             |
   |            |             |<--template B-|             |
   |<--result A-|             |              |             |
   |            |<--result B--|              |             |
```

### K.4 Fallback locale cascade

```
Caller       Service                       DB
  |             |                            |
  |--render('foo','ar-MA')-->                |
  |            |                            |
  |            |---getAvailableLocales--->|  |
  |            |<--['ar','fr','en']---------|
  |            |                            |
  |            |--resolveLocale('ar-MA',available)
  |            |    ar-MA NOT in available
  |            |    cascade: ar-MA -> ar (in available!)
  |            |    log warn fallback applied
  |            |                            |
  |            |---fetchTemplate('foo','ar')|
  |            |<--row-----------------------|
  |            |                            |
  |            |  resolved_locale='ar', fallback_applied=true
  |<--result---|                            |
```

---

## Annexe L. Migration data backfill scenarios

Si les seeds Sprint 5 (Tache 2.1.13 EmailService) ont introduit `fr-MA` comme locale au lieu de `fr`, il y a un mapping Sprint 9 a effectuer. Migration backfill :

```sql
-- Migration backfill fr-MA -> fr pour comm_templates Sprint 9
-- Note : EmailService Sprint 5 utilise fr-MA, WaTemplateRenderer Sprint 9 utilise fr
-- Strategie : conserver fr-MA pour email, ajouter row fr pour WA si necessaire

-- Verifier presence fr-MA dans comm_templates :
SELECT COUNT(*) FROM comm_templates WHERE language = 'fr-MA';

-- Si > 0 : pas de migration auto (les rows fr-MA sont email-specifiques)
-- Pour WA, creer rows fr distincts via Tache 3.2.5 seed script

-- Seed manuel comm_templates fr (5 templates Sprint 9 WA) :
INSERT INTO comm_templates (tenant_id, name, language, category, body_template, footer_template, variables_schema, meta_template_status, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'appointment_reminder_24h', 'fr', 'utility', 'Bonjour {{user_name}}, vous avez un rendez-vous demain a {{appointment_time}} avec {{broker_name}}. A bientot!', 'Skalean InsurTech', '{"order":["user_name","appointment_time","broker_name"],"required":["user_name","appointment_time","broker_name"]}'::jsonb, 'pending_review', NOW(), NOW()),
  -- ... 4 autres templates fr ...
;
```

Sprint 14 Comm orchestrator deferra le mapping `fr-MA <-> fr` pour cohabitation EmailService/WaRenderer.

---

## Annexe M. Failure modes et mitigation

| Failure mode | Probability | Impact | Mitigation |
|--------------|-------------|--------|------------|
| Redis down | Low | High (no cache, DB sature) | Fallback direct DB query (cache miss path) -- Sprint 9 |
| DB down | Low | Critical (no render possible) | BullMQ retry 3x exponential -- Sprint 9 Tache 3.2.8 |
| Meta API rate limit | Medium | High (sends bloques) | Tache 3.2.2 retry + Tache 3.2.8 BullMQ throttle |
| Template not approved | High initially | Medium (per template) | Tache 3.2.9 orchestrator fallback email |
| Locale fallback exhausted | Medium initially | High (no send) | Sprint 27 admin UI alert pour translation gap |
| Variables manquantes (caller bug) | Medium | High (no send) | Tests Tache 3.2.13 + lint Sprint 27 |
| Cache poisoning (variable injection) | Low | Critical (XSS WA) | Sanitize escape + bidi strip Sprint 9 |
| Tenant leak (cache key bug) | Low | Critical (multi-tenant violation) | Test T30 + lint review |
| Stampede on cold boot | Medium | Medium (DB spike) | SETNX lock Sprint 9 |
| Kafka invalidation lag | Low | Low (5min stale max) | TTL 5min ceiling |

---

## Annexe N. References documentation

- Meta WhatsApp Cloud API v21.0 : https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
- Meta Template language codes : https://developers.facebook.com/docs/whatsapp/api/messages/message-templates#supported-languages
- Meta Templates structure (header, body, footer, buttons) : https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
- Meta error codes : https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
- Redis SETNX pattern : https://redis.io/commands/setnx/
- Redis cluster ioredis : https://github.com/luin/ioredis#cluster
- Skalean docs : `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` (lignes 400-500 = comm_templates)
- Skalean docs : `00-pilotage/documentation/2-variables-environnement.env` (REDIS_*, DATABASE_*)
- Skalean docs : `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` (regles comm + opt-out)
- Sprint 5 Tache 2.1.13 (EmailService) : pattern multi-locale precedent
- Sprint 8 (CRM contacts.preferred_language) : enum Locale partage
- Sprint 9 Tache 3.2.2 (WhatsAppCloudApiClient) : consumer downstream

---

**Fin du prompt task 3.2.3 -- WA Template Renderer + 4 Locales fr / ar-MA / ar / en**

**Densite atteinte** : ~135 ko (cible 120-140 ko OK)
**Sections** : 17 sections principales + 14 annexes (A-N)
**Code patterns** : 13 fichiers complets (services, helpers, types, errors, tests, seeds, migrations, modules)
**Tests** : 28 unit + 3 integration = 31 tests
**Criteres** : V1-V32 (24 P0 + 5 P1 + 3 P2)
**Edge cases** : 15 documentes
**Conformite** : Loi 09-08, Loi 24-09 ANRT, ACAPS circulaire 2024, decision-006/007/009/022
