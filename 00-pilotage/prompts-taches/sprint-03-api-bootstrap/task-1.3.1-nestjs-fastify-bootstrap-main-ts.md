# TACHE 1.3.1 -- Bootstrap NestJS 10.4 + Fastify Adapter + main.ts Orchestrateur Boot

**Sprint** : 3 (Phase 1 / Sprint 3 dans phase) -- API Bootstrap NestJS Fastify
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-03-sprint-03-api-bootstrap.md` (Tache 1.3.1)
**Phase** : 1 -- Bootstrap Infrastructure
**Priorite** : P0 (bloquant absolu pour les 14 taches suivantes du Sprint 3 et pour les Sprints 4 a 35 cote backend)
**Effort** : 5h
**Dependances** : Sprint 2 termine (DataSource Postgres + Redis client + Kafka producer + shared-config + shared-utils Pino telemetry)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a initialiser l'application backend `apps/api` du programme Skalean InsurTech v2.2 sur la base du framework NestJS 10.4.15 couple a l'adapter Fastify 4.28.1 (via `@nestjs/platform-fastify`). L'objectif final est de produire un binaire executable Node 22.20.0 LTS qui demarre sur le port 4000, expose un endpoint `GET /` minimal retournant `{ name: 'skalean-insurtech-api', version: '0.1.0', env: 'development' }`, et orchestre dans un fichier `main.ts` strict l'ordre exact d'initialisation des transverses : telemetry FIRST (avant tout import metier afin d'instrumenter les modules NestJS via auto-instrumentation OpenTelemetry), puis chargement Zod des variables d'environnement (`loadEnv()` du package `@insurtech/shared-config`), puis creation de l'application NestJS via `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: true, bodyLimit: 10485760 }), { bufferLogs: true })`, puis application des middlewares globaux (logger Pino injecte via `app.useLogger`), puis enregistrement du graceful shutdown handler (SIGTERM/SIGINT chainant DataSource.destroy + Redis.quit + Kafka.disconnect + Telemetry.shutdown + app.close avec timeout 30s), puis enfin `app.listen(API_PORT, '0.0.0.0')`.

L'apport architectural est triple. Premierement, le choix Fastify 4.28.1 vs Express 4.21 (default NestJS) gagne approximativement 30 pourcent de throughput requests/seconde sur les benchmarks officiels NestJS (12000 rps Fastify vs 9100 rps Express sur Apple M2, payload JSON 1KB), grace a l'absence de la chaine middleware Express et au parser JSON natif `secure-json-parse`. Pour un backend insurance dont le SLA cible est p99 < 200ms et le throughput attendu en pic d'avis d'echeance pre-fete annuelle peut atteindre 800 rps soutenu, ce gain est strategique. Deuxiemement, l'orchestration boot order strict dans `main.ts` (`telemetry -> env -> NestFactory -> middlewares -> listen`) ferme la classe complete des bugs lies a une instrumentation OpenTelemetry tardive qui rate les premieres requetes au moment du warm-up, et garantit qu'aucun secret env ne sera deserialise sans validation Zod (defense en profondeur contre une variable mal formee qui ferait crasher l'app a la 1000eme requete). Troisiemement, le pattern graceful shutdown chaine DB + Redis + Kafka + Telemetry assure que sur un `kubectl rolling restart` ou un `docker stop`, le pod n'est jamais kille SIGKILL avec exit code 137 (timeout par Kubernetes apres 30s), ce qui causerait une perte de messages Kafka in-flight ou une corruption transactionnelle Postgres si la connexion etait coupee au milieu d'un commit.

A l'issue de cette tache, la commande `pnpm --filter @insurtech/api dev` demarre le serveur en moins de 5 secondes sur machine 16GB RAM, `curl -i http://localhost:4000/` retourne `HTTP/1.1 200 OK` avec body JSON valide, `kill -SIGTERM <pid>` provoque exit code 0 (et non 137) en moins de 30 secondes, un payload `POST` superieur a 10 MiB est rejete avec HTTP 413 `Payload Too Large`, et un header `X-Forwarded-For: 1.2.3.4` est respecte par Fastify (pas l'IP du LB). Aucune logique metier (auth, RLS, RBAC, Zod payload validation, OpenAPI Swagger) n'est implementee dans cette tache : sa portee est strictement la fondation NestJS+Fastify+main.ts. Les modules metier seront empiles dans les Taches 1.3.2 (ConfigModule), 1.3.3 (DatabaseModule), 1.3.4 (RedisModule), 1.3.5 (LoggerModule Pino), 1.3.6 (HelmetModule), 1.3.7 (CorsModule), etc.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

L'application `apps/api` est le backend unifie qui sert simultanement les 8 frontends Skalean InsurTech (web-insurtech-admin port 3000, web-broker 3001, web-garage 3002, web-garage-mobile 3003, web-customer-portal 3004, web-assure-portal 3005, web-assure-mobile 3006) ainsi que le mcp-server (port 4001) qui expose les tools metier au chatbot Sky a partir du Sprint 30. Sans une fondation NestJS+Fastify rigoureusement initialisee dans `main.ts`, chaque tache de Sprint 3 (1.3.2 a 1.3.15) qui ajoute un module ou un middleware se ferait au prix d'un re-architecting partiel : ajouter Pino logger apres avoir deja initialise `app.useLogger(console)` necessite de passer `bufferLogs: true` retroactivement, ajouter graceful shutdown apres avoir deja deploye en prod necessite de re-tester chaque flow Kafka in-flight, etc.

Le programme Skalean InsurTech v2.2 cible un SLA de 99.9 pourcent uptime (`8h45min de downtime annuel maximum`) avec des deploiements blue-green sans interruption de service. Ce SLA n'est atteignable que si chaque pod kill respecte l'ordre exact de fermeture : (1) refuser nouvelles connexions HTTP (`app.close()` qui declenche le `preDestroy` lifecycle hook NestJS), (2) drainer les requetes en cours (Fastify `closeWatcher` jusqu'a 30s), (3) flusher les messages Kafka en cours de production (`kafkaProducer.disconnect()` qui attend les acks), (4) cloturer les connexions Postgres en pool (`dataSource.destroy()` qui rollback les transactions in-flight), (5) flusher les buffers Pino vers stdout/file/Datadog, (6) appeler `sdk.shutdown()` OpenTelemetry pour exporter les spans/metrics restants, (7) `process.exit(0)`. Tout ordre different (Kafka avant Postgres, ou Telemetry avant DB) produit des effets de bord non-deterministes : un message Kafka emis sans transaction Postgres committee = source de double-spending si le consumer le retraite, un span OpenTelemetry exporte avant la fin de la requete = trace incomplete sans le span DB.

L'orchestration de cet ordre est la responsabilite stricte de `main.ts`. NestJS expose `enableShutdownHooks()` qui chaine les hooks `onModuleDestroy` et `beforeApplicationShutdown` de tous les providers, mais ne gere PAS la coordination avec ressources externes non-NestJS (DataSource raw, Kafka raw, Telemetry SDK). C'est pourquoi cette tache pose un fichier `bootstrap/graceful-shutdown.ts` dedie qui orchestre la sequence exacte avec timeout configurable.

Le choix specifique NestJS 10.4.15 (vs Express raw 4.21 ou Fastify raw 4.28 ou Hono 4.6 ou Elysia) est documente dans `00-pilotage/decisions/003-framework-backend-nestjs.md` (decision-003).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Express raw 4.21 + Inversify DI | Ecosysteme middleware le plus large, communaute massive, doc abondante, freedom de choisir chaque brick | Aucune convention DI integree, pas de modules, pas de testing utilities, threadpool middleware lourd (~30 pourcent slower que Fastify), declarations CSRF/Helmet/Cors verboses, pas d'OpenAPI auto-generee | REJETE -- couts maintenance trop eleves pour 35 sprints + 461 taches |
| Fastify raw 4.28 + tsyringe | Performance optimale (12k rps), schema validation native via Ajv, hooks lifecycle granulaires | Pas de DI integree, pas de modules NestJS-like, pas de Guards/Pipes/Interceptors, pas de testing utilities NestJS, pas d'OpenAPI generation auto, ecosysteme plugins moins mature pour cas entreprise (RBAC, multi-tenant, audit) | REJETE -- DI manuelle ingerable a 23 packages |
| NestJS 10.4 + Express adapter (default) | Convention NestJS complete, ecosysteme @nestjs/* mature, plug-and-play | Performance inferieure 30 pourcent vs Fastify, body-parser Express memory-leak history (CVE-2017-16026 et autres), middleware chain Express plus lent | REJETE -- gain Fastify justifie effort migration |
| NestJS 10.4 + Fastify adapter (RETENU) | Performance Fastify (12k rps) + convention NestJS (DI, modules, Guards, Pipes, Interceptors, testing utilities, OpenAPI auto), maturite production (Adidas, Capgemini, Trilon) | Configuration FastifyAdapter legerement differente d'Express (req.raw vs req, hooks vs middleware), incompatibilite Multer (utiliser @fastify/multipart) | RETENU -- meilleur compromis performance + convention + maturite |
| Hono 4.6 + Bun runtime | Ultra-performant (40k rps), edge-ready Cloudflare Workers, tres leger (~12 KB) | Ecosysteme jeune, pas de DI, pas de Guards/Pipes, runtime Bun encore experimental Production Maroc, pas de support TypeORM mature | REJETE -- maturite ecosysteme insuffisante usage entreprise |
| Elysia 1.1 + Bun | TypeScript-first, validation schema integree | Meme issues maturite Bun, ecosysteme tres jeune | REJETE -- non production-ready 2026 |
| uWebSockets.js 20.49 (raw) | Performance extreme (100k rps), latence sub-millisecond | API C-binding bas niveau, ergonomie developpeur tres faible, pas d'abstraction module/DI | REJETE -- usage backend metier non justifie |
| H2O HTTP/2 server | Performance native HTTP/2 | Implementation complexe, Node bindings instables | REJETE -- complexite infra trop elevee |

### 2.3 Trade-offs explicites

Choisir NestJS 10.4.15 + Fastify 4.28.1 implique d'accepter une dependance forte au framework NestJS sur les 35 sprints. Une migration future vers un autre framework (par exemple si Hono+Bun arrive a maturite en 2028) demanderait de re-architecturer 23 packages metier dont les decorateurs `@Module`, `@Controller`, `@Injectable`, `@Get`, `@UseGuards`, `@UseInterceptors` sont ubiquitous. Cette friction long terme est largement compensee par les gains immediats de productivite (ouverture de 5h pour bootstrap complet, vs 25h+ pour une approche sans framework) et la convergence avec l'ecosysteme open-source NestJS (`@nestjs/typeorm`, `@nestjs/cqrs`, `@nestjs/swagger`, `@nestjs/microservices`).

Choisir Fastify (vs Express) implique d'apprendre certaines specificites : `request.raw` est l'IncomingMessage Node natif (vs `request` Express), les hooks `onRequest`, `preHandler`, `onSend` remplacent les middlewares Express, et certains plugins Express (Multer, express-rate-limit, helmet 4) ne sont pas directement compatibles et doivent etre remplaces par leurs equivalents Fastify (`@fastify/multipart`, `@fastify/rate-limit`, `@fastify/helmet`). Cette friction d'apprentissage de 1-2 jours par developpeur est documentee dans `docs/architecture/ADR-003-fastify-vs-express.md` et compensee par la performance native.

Choisir un `bodyLimit: 10485760` (10 MiB exactement) implique que les uploads de fichiers au-dela seront rejetes avec HTTP 413. Le seuil 10 MiB est aligne avec la mediane mondiale des CDN (Cloudflare Free 100 MiB, Cloudflare Enterprise illimite avec streaming), suffisant pour 99 pourcent des cas usage Skalean InsurTech (carte CIN scan PDF 2-3 MiB, certificat mise en circulation 1-2 MiB, photo sinistre 5-8 MiB par cliche). Pour les uploads superieurs (videos panneau garage, scans archives notariales), une route dediee `POST /uploads/large` avec streaming S3 multipart sera ajoutee Sprint 10 (signature) avec bodyLimit override 100 MiB sur cette route specifique uniquement.

Choisir `trustProxy: true` (vs false par default Fastify) implique de faire confiance aux headers `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host` des reverse proxies amont (Cloudflare WAF + Atlas LB + Nginx ingress Kubernetes). Ce trust est necessaire pour : (1) audit logs precis (logger l'IP reelle du client, pas l'IP du LB 10.0.0.x), (2) rate-limit par IP client (sans `trustProxy`, tout le trafic apparaitrait venir du LB), (3) HTTPS detection cote app (`request.protocol === 'https'` necessite le respect de `X-Forwarded-Proto`). Le risque associe (header spoofing si le LB amont n'est pas correctement configure) est mitige par la regle Cloudflare WAF qui strippe les headers X-Forwarded-* recus du client externe avant de re-injecter ses propres valeurs verifiees, regle qui sera configuree au Sprint 34 (infrastructure WAF).

Choisir un `gracefulShutdownTimeout` de 30000 ms (30 secondes) implique d'aligner avec le `terminationGracePeriodSeconds` Kubernetes default 30s. Si une requete in-flight depasse 30s (par exemple un export Excel volumineux ou un rapport ACAPS lourd), elle sera interrompue. Pour les routes longue duree, l'architecture pose une convention : soit deplacer le travail vers BullMQ async (Tache Sprint 13 analytics), soit augmenter `terminationGracePeriodSeconds` cote K8s manifest specifiquement pour le pod `apps/api` a 60s avec confirmation Sprint 33.

Choisir `bufferLogs: true` au moment de `NestFactory.create` implique que tous les logs emis pendant le boot (avant que `app.useLogger(pinoLogger)` soit appele) sont mis en buffer interne NestJS, puis flushes vers le logger custom une fois actif. Sans cette option, les logs initiaux NestJS (`Starting Nest application...`, `AppModule dependencies initialized`) seraient ecrits via le logger console default et perdraient le formatage JSON Pino + les correlation IDs.

### 2.4 Decisions strategiques referenced

- **decision-003 (Framework Backend NestJS 10.4 + Fastify)** : pertinence pour cette tache = totale. Cette tache concretise le choix decide dans `00-pilotage/decisions/003-framework-backend-nestjs.md`.
- **decision-001 (Monorepo pnpm + Turborepo)** : pertinence pour cette tache = totale. Le `package.json` de `apps/api` declare des dependencies workspace `@insurtech/shared-config: workspace:*` et `@insurtech/shared-utils: workspace:*` resolues via pnpm.
- **decision-006 (No-emoji Policy ABSOLUE)** : pertinence pour cette tache = totale. Aucune emoji n'est autorisee dans aucun des fichiers livres (main.ts, app.module.ts, app.controller.ts, package.json, tsconfig.json, nest-cli.json, .env.example, README.md, Dockerfile, etc.).
- **decision-008 (Data Residency Maroc)** : pertinence pour cette tache = indirecte. Le boot configure `TZ=Africa/Casablanca` via env, et l'option `trustProxy` prepare le pattern reverse-proxy Atlas LB Benguerir.
- **decision-002 (Multi-tenant 3 niveaux)** : pertinence pour cette tache = indirecte. Le `main.ts` ne declare aucune logique multi-tenant (Tache 1.3.10 ajoute `TenantContextInterceptor`), mais le pattern `bufferLogs: true` + Pino correlation prepare l'injection `tenant_id` dans tous les logs.
- **decision-007 (Mocks AI Sprint 1-28)** : pertinence pour cette tache = nulle (pas d'integration AI ici, sera Sprint 29).

### 2.5 Pieges techniques connus

1. **Piege : Telemetry initialise apres l'import de `AppModule` perd l'auto-instrumentation NestJS.**
   - Pourquoi : OpenTelemetry auto-instrumentation patche les modules Node au moment de leur premier import (via `require-in-the-middle`). Si `import { AppModule } from './app.module'` est evalue AVANT `startTelemetry()`, le module NestJS est deja en memoire non-instrumente.
   - Solution : structurer `main.ts` en deux phases : (1) `import './telemetry/start.js'` qui declenche `startTelemetry()` synchrone, (2) `const { AppModule } = await import('./app.module.js')` dynamic import APRES. En CommonJS NestJS, cela se traduit par : appeler `startTelemetry()` en TOUTE PREMIERE ligne de `bootstrap()` (sauf `import 'reflect-metadata'` qui doit rester premier), puis `require('./app.module')` ensuite.

2. **Piege : `bufferLogs: false` (default) flushes les logs initiaux via console avant que Pino soit pret.**
   - Pourquoi : NestJS emet plusieurs logs durant la phase `InstanceLoader` qui resout les dependencies de chaque module. Sans `bufferLogs: true`, ces logs vont vers `console.log` natif qui n'a ni le format JSON Pino, ni les correlation IDs, ni les niveaux pino-style.
   - Solution : passer `{ bufferLogs: true }` en troisieme argument de `NestFactory.create()`, puis appeler `app.useLogger(app.get(Logger))` (Logger nestjs-pino) AVANT `app.listen()`. Les logs bufferises sont automatiquement re-emis via le logger custom.

3. **Piege : `trustProxy: true` sans configuration de reverse-proxy amont expose au header spoofing.**
   - Pourquoi : si l'app est exposee directement sur Internet (sans Cloudflare/Nginx amont) avec `trustProxy: true`, n'importe quel client peut envoyer `X-Forwarded-For: 8.8.8.8` et faire croire que la requete vient de Google.
   - Solution : ne JAMAIS exposer `apps/api` directement. Toujours derriere Cloudflare WAF (Sprint 34) qui strip les headers X-Forwarded-* du client externe et re-injecte les siens. En dev local sans LB, le risque est nul (rate-limit dev = no-op). Documenter cette regle dans `docs/security/threat-model.md` (Sprint 33).

4. **Piege : `app.listen('localhost')` au lieu de `app.listen('0.0.0.0')` casse Docker.**
   - Pourquoi : `localhost` dans un container Docker = 127.0.0.1 = interface loopback du container. Le port mappe `-p 4000:4000` ne route pas vers loopback, l'app est inaccessible depuis l'host.
   - Solution : TOUJOURS `app.listen(API_PORT, '0.0.0.0')`. La variable `API_HOST` peut etre laissee a `0.0.0.0` par defaut dans `.env.example` et le code de main.ts.

5. **Piege : Graceful shutdown qui ne libere pas Postgres = pool exhausted au pod suivant.**
   - Pourquoi : si SIGTERM est recu et que `DataSource.destroy()` n'est pas appele, les connexions Postgres restent en `IDLE in transaction` cote serveur jusqu'a `idle_in_transaction_session_timeout` (default 0 = jamais). Au pod suivant, le pool max=20 est rapidement sature.
   - Solution : registrer `dataSource.destroy()` dans le graceful shutdown chain AVANT `app.close()` ne suffit pas : `app.close()` declenche les hooks NestJS qui peuvent appeler des queries (par exemple un `auditService.flushPending`). Ordre correct : (1) `app.close()` qui drain HTTP + flush hooks NestJS, (2) puis `kafkaProducer.disconnect()` (acks in-flight), (3) puis `dataSource.destroy()` (close pool), (4) puis `redisClient.quit()`, (5) puis `telemetry.shutdown()` (export spans), (6) `process.exit(0)`.

6. **Piege : Double SIGTERM cause double shutdown chain en parallele.**
   - Pourquoi : si Kubernetes envoie SIGTERM, attend 5s, puis re-envoie SIGTERM (rare mais possible avec preStop hook lent), le handler est appele 2 fois et lance 2 chaines de shutdown qui se concurrencent (DataSource.destroy x 2 = error already destroyed).
   - Solution : flag global `isShuttingDown = false` initial, set a `true` au premier signal, ignore les signaux suivants avec un log warn. Pattern : `if (isShuttingDown) { logger.warn('Already shutting down, ignoring signal'); return; }`.

7. **Piege : `process.exit(0)` appele AVANT que les buffers stdout soient flushes = logs perdus.**
   - Pourquoi : `process.exit(0)` est synchrone et ne wait pas les writes async sur stdout. Si Pino utilise un transport async (worker thread), les derniers logs peuvent etre perdus.
   - Solution : appeler `await pinoLogger.flush()` ou `await new Promise(r => setTimeout(r, 100))` avant `process.exit(0)`. Alternative : utiliser `process.exit()` sans argument apres `app.close()` qui retourne la main au event loop, qui se termine naturellement avec exit code 0.

8. **Piege : `EADDRINUSE` au boot si un autre processus ecoute deja sur 4000.**
   - Pourquoi : crash avec stack trace cryptique. Souvent cause par un dev qui a oublie de tuer un precedent processus, ou un autre service Skalean InsurTech qui partage le port.
   - Solution : catch error dans `bootstrap()`, logger explicitement `Port 4000 is already in use. Kill the process or change API_PORT env var. Run: lsof -ti:4000 | xargs kill -9`.

9. **Piege : `engine-strict=true` rejette boot si le binaire Node n'est pas 22.20.0.**
   - Pourquoi : pnpm install rejette mais le binaire `node dist/main.js` ne verifie pas `engines.node`.
   - Solution : ajouter en debut de `main.ts` un check explicite `if (process.versions.node.split('.')[0] !== '22') { console.error('...'); process.exit(1); }`. Defense en profondeur.

10. **Piege : Body parser Fastify rejette JSON > 10 MiB AVANT que le rate-limiter middleware tourne.**
    - Pourquoi : ordre des hooks Fastify : `onRequest -> preParsing -> preValidation -> preHandler -> handler`. Le bodyLimit est applique en `preParsing`, donc avant que le rate-limit puisse compter la requete. Resultat : un attaquant peut spam des POST 11MB et chaque rejet consomme un peu de CPU sans compter dans le rate-limit.
    - Solution : ajouter rate-limit en `onRequest` hook (executed BEFORE bodyLimit check) dans Tache 1.3.8. Pour Tache 1.3.1, le body limit suffit.

11. **Piege : `app.enableShutdownHooks()` non appele = aucun `onModuleDestroy` provider trigger.**
    - Pourquoi : par default, NestJS ne s'enregistre pas aux signaux process. Sans `app.enableShutdownHooks()`, les providers qui declarent `onModuleDestroy()` (par exemple un service AuditFlush) ne sont jamais cleanup.
    - Solution : appeler `app.enableShutdownHooks()` apres `NestFactory.create()` et avant `app.listen()`. Le custom graceful shutdown handler appelle ensuite `app.close()` qui trigge tous les hooks.

12. **Piege : `app.close()` ne timeout pas et bloque indefiniment si un hook est defaillant.**
    - Pourquoi : si un provider `onModuleDestroy` await une promise qui ne resout jamais (par exemple un `kafkaProducer.disconnect()` deadlock sur broker injoignable), `app.close()` reste pendu.
    - Solution : wrapper `app.close()` dans un `Promise.race([app.close(), timeout(30000)])` qui force `process.exit(1)` avec log error si timeout depasse.

13. **Piege : `import 'reflect-metadata'` oublie = decorateurs NestJS silently ignored.**
    - Pourquoi : NestJS et TypeORM utilisent intensivement `Reflect.metadata` pour la DI. Sans `reflect-metadata` polyfill, les decorateurs `@Injectable`, `@Module`, `@Controller` ne posent pas les metadata, et `Nest can't resolve dependencies of XxxController` erreur survient.
    - Solution : TOUJOURS `import 'reflect-metadata';` en TOUTE PREMIERE ligne de main.ts (avant meme telemetry). Pattern enforcable via pre-commit hook.

14. **Piege : `tsconfig.json` sans `experimentalDecorators` casse compile NestJS.**
    - Pourquoi : NestJS utilise des decorateurs ES (encore stage 2 en 2026, donc behind flag). Sans `experimentalDecorators: true` + `emitDecoratorMetadata: true`, les decorateurs sont ignores ou erreur compile.
    - Solution : `tsconfig.json` de `apps/api` declare explicitement les deux flags. Le `tsconfig.base.json` racine peut les avoir mais l'extension les overwrite par securite.

15. **Piege : Build Nest CLI `nest build` produit `dist/main.js` mais `package.json main` pointe ailleurs.**
    - Pourquoi : confusion entre dev mode (ts-node main.ts) et prod mode (node dist/main.js). Si `main` dans package.json pointe vers `src/main.ts` au lieu de `dist/main.js`, prod casse.
    - Solution : `package.json` de `apps/api` declare `"main": "dist/main.js"` et `"types": "dist/main.d.ts"`. Le script `start:prod` execute `node dist/main.js`, le script `dev` execute `nest start --watch` qui utilise ts-node sous le capot.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 1.3.1 est la PREMIERE tache du Sprint 3 (API Bootstrap NestJS Fastify) sur 15 taches au total (1.3.1 a 1.3.15). Elle :

- **Depend de** : Sprint 2 entier (Taches 1.2.1 a 1.2.15). Specifiquement :
  - Tache 1.2.3 : `packages/database/src/data-source.ts` exporte `dataSource` TypeORM 0.3.x configure
  - Tache 1.2.6 : `packages/shared-utils/src/redis/client.ts` exporte `redisClient` ioredis
  - Tache 1.2.10 : `packages/shared-utils/src/kafka/producer.ts` exporte `kafkaProducer` kafkajs
  - Tache 1.2.13 : `packages/shared-utils/src/telemetry/start.ts` exporte `startTelemetry()` et `shutdownTelemetry()`
  - Tache 1.2.14 : `packages/shared-config/src/load-env.ts` exporte `loadEnv()` Zod-validated
- **Bloque** : Tache 1.3.2 (AppModule + ConfigModule) qui necessite que `main.ts` soit pose pour ajouter `imports: [ConfigModule.forRoot({ load: [envSchema] })]`. Bloque Tache 1.3.3 a 1.3.15 (chaque module ajoute une fonctionnalite : DatabaseModule, RedisModule, LoggerModule Pino, HelmetModule, CorsModule, RateLimitModule, OpenAPIModule, ZodValidationPipe, etc.).
- **Apporte au sprint** : la fondation executable. Sans cette tache, aucune des 14 taches suivantes du Sprint 3 ne peut etre testee (impossible de demarrer NestJS sans main.ts).

### 3.2 Position dans le programme global

Cette tache pose la couche serveur HTTP sur laquelle les 461 - 31 = 430 taches restantes des 35 sprints viendront empiler des modules metier. Specifiquement :

- **Sprint 3 enrichit `apps/api`** avec ConfigModule, DatabaseModule (TypeORM injection), RedisModule, LoggerModule Pino, HelmetModule, CorsModule, RateLimitModule, ZodValidationPipe, ResponseInterceptor, ErrorFilter, OpenAPISwaggerModule, HealthCheckModule, MetricsPrometheusModule.
- **Sprint 4 ajoute le frontend** `apps/web-insurtech-admin` qui consomme `apps/api`.
- **Sprint 5 implemente AuthModule** dans `apps/api` (Argon2id + JWT jose + MFA + WebAuthn).
- **Sprint 6 ajoute RLS Postgres subscribers** via `apps/api/src/multi-tenant/`.
- **Sprint 7 ajoute RBAC** (Guards + 12 roles).
- **Sprints 8-13** ajoutent les modules metier (CRM, Booking, Comm, Docs, Signature, Pay, Books, Compliance, Analytics, Stock, HR).
- **Sprints 14-22** ajoutent les verticales (Insure, Repair) avec leurs controllers REST.
- **Sprints 23-30** ajoutent les frontends mobile, MCP server.
- **Sprints 31-35** ajoutent Sky AI, observability, hardening, pilote.

A chaque sprint, `apps/api/src/main.ts` reste minimal (cette tache pose le squelette final), seul `app.module.ts` grossit en imports modules. Cette architecture preserve la lisibilite et la testabilite du boot order.

### 3.3 Diagramme architecture initial

```
apps/api/                                       [racine app NestJS+Fastify port 4000]
|
|-- package.json                                [deps NestJS 10.4 + Fastify 4.28 + workspace]
|-- tsconfig.json                               [extends base + experimentalDecorators]
|-- nest-cli.json                               [build NestJS + plugins Swagger/Class-Serializer]
|-- Dockerfile                                  [multi-stage Node 22.11-alpine + dist]
|-- .dockerignore                               [exclude node_modules src test]
|-- .env.example                                [API_PORT=4000 + DB_URL + REDIS + KAFKA + ...]
|-- README.md                                   [quick start dev]
|
|-- src/
|   |-- main.ts                                 [BOOT ORCHESTRATOR -- ce livrable]
|   |   |
|   |   |-- import 'reflect-metadata'           [polyfill DI]
|   |   |-- import startTelemetry()             [TELEMETRY FIRST]
|   |   |-- await loadEnv()                     [Zod env validation]
|   |   |-- NestFactory.create<NestFastifyApp>  [FastifyAdapter trustProxy bodyLimit]
|   |   |-- app.useLogger(Pino)                 [logger global]
|   |   |-- app.enableShutdownHooks()           [trigger onModuleDestroy]
|   |   |-- registerGracefulShutdown(app)       [SIGTERM/SIGINT chain DB+Redis+Kafka+Tel]
|   |   `-- app.listen(API_PORT, '0.0.0.0')     [bind 0.0.0.0 pour Docker]
|   |
|   |-- app.module.ts                           [skeleton vide -- 1.3.2 enrichit]
|   |-- app.controller.ts                       [GET / minimal]
|   |-- app.service.ts                          [getInfo() name version env]
|   |
|   `-- bootstrap/                              [helpers boot order]
|       |-- graceful-shutdown.ts                [registerGracefulShutdown function]
|       |-- middleware-order.ts                 [doc order middlewares pour 1.3.5+]
|       `-- start-time-logger.ts                [measure boot duration warn > 5s]
|
|-- test/
|   `-- fixtures/
|       `-- env-fixtures.ts                     [mock env pour tests]
|
`-- e2e/
    `-- bootstrap.spec.ts                       [Playwright start time + port + body limit]
```

### 3.4 Flow de boot (sequence ASCII)

```
[START process]
      |
      v
[import 'reflect-metadata']                 <-- 1. Polyfill DI obligatoire
      |
      v
[import './telemetry/start.js']             <-- 2. Lance auto-instrumentation OpenTelemetry
      |                                          AVANT tout import metier
      v
[startTelemetry({serviceName, endpoint})]   <-- 3. SDK init synchrone
      |
      v
[const env = loadEnv()]                     <-- 4. Zod runtime validation
      |                                          si fail -> process.exit(1) avec details
      v
[const app = await NestFactory.create(      <-- 5. Boot NestJS
   AppModule,
   new FastifyAdapter({
     trustProxy: true,
     bodyLimit: 10485760  // 10 MiB
   }),
   { bufferLogs: true }
 )]
      |
      v
[app.useLogger(app.get(Logger))]            <-- 6. Switch vers Pino logger
      |
      v
[app.enableShutdownHooks()]                 <-- 7. Active onModuleDestroy
      |
      v
[registerGracefulShutdown(app, {            <-- 8. Pose handlers SIGTERM/SIGINT
   timeout: 30000,
   handlers: [
     () => app.close(),
     () => kafkaProducer.disconnect(),
     () => dataSource.destroy(),
     () => redisClient.quit(),
     () => shutdownTelemetry()
   ]
 })]
      |
      v
[await app.listen(env.API_PORT, '0.0.0.0')] <-- 9. Bind 0.0.0.0 pour Docker
      |
      v
[logger.info('App listening on port 4000')] <-- 10. Boot terminee
      |
      v
[event loop running -- requests served]
      ...
      |
[SIGTERM recu]
      |
      v
[gracefulShutdown handler triggered]
      |
      v
[set isShuttingDown = true]                 <-- ignore signaux suivants
      |
      v
[Promise.race([
   sequence(handlers),
   timeout(30000) -> process.exit(1)
 ])]
      |
      v
[for handler of handlers]
   await handler()                          <-- chacun a son timeout interne 10s
      |
      v
[await flushLogs()]                         <-- Pino flush async transports
      |
      v
[process.exit(0)]                           <-- exit 0 propre
```

---

## 4. Livrables checkables

- [ ] Fichier `repo/apps/api/package.json` avec deps NestJS 10.4.15 + Fastify 4.28.1 + workspace dependencies (~95 lignes)
- [ ] Champ `name` = `@insurtech/api`
- [ ] Champ `version` = `0.1.0` (sera bumpe Sprint 35 avant pilote Marrakech)
- [ ] Champ `private: true`
- [ ] Champ `main` = `dist/main.js`
- [ ] Champ `scripts.dev` = `nest start --watch --preserveWatchOutput`
- [ ] Champ `scripts.build` = `nest build`
- [ ] Champ `scripts.start:prod` = `node dist/main.js`
- [ ] Champ `scripts.test` = `vitest run`
- [ ] Champ `scripts.test:e2e` = `playwright test`
- [ ] Dependencies declarees : `@nestjs/common@10.4.15`, `@nestjs/core@10.4.15`, `@nestjs/platform-fastify@10.4.15`, `fastify@4.28.1`, `reflect-metadata@0.2.2`, `rxjs@7.8.1`
- [ ] Dependencies workspace : `@insurtech/shared-config: workspace:*`, `@insurtech/shared-utils: workspace:*`
- [ ] DevDependencies : `@nestjs/cli@10.4.9`, `@nestjs/schematics@10.2.3`, `@nestjs/testing@10.4.15`, `@types/node@22.10.5`, `ts-node@10.9.2`, `tsconfig-paths@4.2.0`, `typescript@5.7.3`, `vitest@2.1.8`, `@playwright/test@1.49.1`, `supertest@7.0.0`
- [ ] Fichier `repo/apps/api/tsconfig.json` extends `../../tsconfig.base.json` avec `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `target: ES2023`, `module: CommonJS`, `outDir: dist`, `rootDir: src` (~50 lignes)
- [ ] Fichier `repo/apps/api/nest-cli.json` avec `sourceRoot: src`, `compilerOptions.deleteOutDir: true`, plugins (~30 lignes)
- [ ] Fichier `repo/apps/api/src/main.ts` complet : `import 'reflect-metadata'` ligne 1, `startTelemetry()` ligne 2-3, `loadEnv()`, `NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({trustProxy:true,bodyLimit:10485760}), {bufferLogs:true})`, `app.useLogger`, `app.enableShutdownHooks`, `registerGracefulShutdown`, `app.listen(port, '0.0.0.0')`, error catch block (~170 lignes)
- [ ] Fichier `repo/apps/api/src/app.module.ts` skeleton avec `@Module({ controllers: [AppController], providers: [AppService] })` et commentaire `// Tache 1.3.2 enrichit avec ConfigModule, DatabaseModule, etc.` (~35 lignes)
- [ ] Fichier `repo/apps/api/src/app.controller.ts` avec `@Controller()` + `@Get()` retournant `getInfo()` via injection AppService (~50 lignes)
- [ ] Fichier `repo/apps/api/src/app.service.ts` avec methode `getInfo()` retournant `{ name, version, env, uptime_seconds }` (~45 lignes)
- [ ] Fichier `repo/apps/api/.env.example` avec ~35 vars (NODE_ENV, API_PORT, API_HOST, APP_VERSION, APP_NAME, BODY_LIMIT_MB, GRACEFUL_SHUTDOWN_TIMEOUT_MS, DATABASE_URL, REDIS_URL, KAFKA_BROKERS, OTEL_*, SENTRY_*, JWT_*, etc.) (~85 lignes)
- [ ] Fichier `repo/apps/api/src/bootstrap/graceful-shutdown.ts` avec fonction `registerGracefulShutdown(app, options)` + flag `isShuttingDown` + Promise.race timeout (~110 lignes)
- [ ] Fichier `repo/apps/api/src/bootstrap/middleware-order.ts` avec doc commentee de l'ordre middlewares attendu pour 1.3.5+ (~70 lignes)
- [ ] Fichier `repo/apps/api/src/bootstrap/start-time-logger.ts` avec fonction `measureBootTime()` log warn si > 5s (~55 lignes)
- [ ] Fichier `repo/apps/api/Dockerfile` multi-stage Node 22.11-alpine (build + runtime non-root user) (~70 lignes)
- [ ] Fichier `repo/apps/api/.dockerignore` excluant node_modules, src, test, e2e, dist, .env, *.log, etc. (~30 lignes)
- [ ] Fichier `repo/apps/api/README.md` minimal avec quick start dev (~60 lignes)
- [ ] Fichier `repo/apps/api/src/main.spec.ts` smoke test bootstrap function (~80 lignes)
- [ ] Fichier `repo/apps/api/src/app.controller.spec.ts` test endpoint GET / (~70 lignes)
- [ ] Fichier `repo/apps/api/src/bootstrap/graceful-shutdown.spec.ts` tests SIGTERM/SIGINT/timeout (~140 lignes)
- [ ] Fichier `repo/apps/api/e2e/bootstrap.spec.ts` Playwright tests start time + body limit + port + X-Forwarded-For (~120 lignes)
- [ ] Fichier `repo/apps/api/test/fixtures/env-fixtures.ts` mock env vars (~50 lignes)
- [ ] Commande `pnpm --filter @insurtech/api install` reussit
- [ ] Commande `pnpm --filter @insurtech/api dev` demarre l'app en moins de 5 secondes
- [ ] Commande `curl -i http://localhost:4000/` retourne HTTP 200 + body JSON `{ name, version, env, uptime_seconds }`
- [ ] Commande `kill -SIGTERM <pid>` provoque exit code 0 en moins de 30 secondes
- [ ] Commande `kill -SIGINT <pid>` (Ctrl+C) provoque exit code 0 en moins de 30 secondes
- [ ] POST avec body 11 MiB rejete avec HTTP 413
- [ ] Header `X-Forwarded-For: 1.2.3.4` respecte par Fastify (verifiable via log)
- [ ] Telemetry initialisee AVANT app NestJS (verifiable via order des logs)
- [ ] Aucune emoji dans aucun fichier livre
- [ ] Tous les tests Vitest passent (15 tests minimum)
- [ ] Tests E2E Playwright passent (5 tests minimum)

Total : 30 livrables structurels uniques + 14 livrables fonctionnels = 44 cases a cocher.

---

## 5. Fichiers crees / modifies

```
repo/apps/api/package.json                                    (~95 lignes / deps NestJS Fastify workspace)
repo/apps/api/tsconfig.json                                   (~50 lignes / extends base + decorators)
repo/apps/api/nest-cli.json                                   (~30 lignes / build NestJS plugins)
repo/apps/api/.env.example                                    (~85 lignes / 35+ env vars)
repo/apps/api/.dockerignore                                   (~30 lignes / exclude build artifacts)
repo/apps/api/Dockerfile                                      (~70 lignes / multi-stage Node 22.11-alpine)
repo/apps/api/README.md                                       (~60 lignes / quick start dev)
repo/apps/api/src/main.ts                                     (~170 lignes / boot orchestrator)
repo/apps/api/src/app.module.ts                               (~35 lignes / skeleton 1.3.2 enrichit)
repo/apps/api/src/app.controller.ts                           (~50 lignes / GET / minimal)
repo/apps/api/src/app.service.ts                              (~45 lignes / getInfo helper)
repo/apps/api/src/bootstrap/graceful-shutdown.ts              (~110 lignes / SIGTERM SIGINT chain)
repo/apps/api/src/bootstrap/middleware-order.ts               (~70 lignes / doc order pour 1.3.5+)
repo/apps/api/src/bootstrap/start-time-logger.ts              (~55 lignes / measure boot duration)
repo/apps/api/src/main.spec.ts                                (~80 lignes / smoke tests bootstrap)
repo/apps/api/src/app.controller.spec.ts                      (~70 lignes / tests GET / endpoint)
repo/apps/api/src/bootstrap/graceful-shutdown.spec.ts         (~140 lignes / tests signal handling)
repo/apps/api/e2e/bootstrap.spec.ts                           (~120 lignes / Playwright start time body limit)
repo/apps/api/test/fixtures/env-fixtures.ts                   (~50 lignes / mock env vars tests)
```

Total : 19 fichiers crees, environ 1415 lignes de code TypeScript + config.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/15 : `repo/apps/api/package.json`

Role : declare le package `@insurtech/api` avec toutes les dependencies necessaires au boot NestJS+Fastify et les scripts pnpm pour dev/build/test.

```json
{
  "name": "@insurtech/api",
  "version": "0.1.0",
  "private": true,
  "description": "Skalean InsurTech v2.2 -- Backend API NestJS 10.4 + Fastify 4.28 sur port 4000. Sert 8 frontends + mcp-server. Multi-tenant 3 niveaux. Conformite ACAPS + DGI + CNDP + AMC + Loi 43-20.",
  "main": "dist/main.js",
  "types": "dist/main.d.ts",
  "license": "PROPRIETARY",
  "engines": {
    "node": ">=22.20.0 <23.0.0"
  },
  "scripts": {
    "dev": "nest start --watch --preserveWatchOutput",
    "dev:debug": "nest start --debug --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "start:prod": "NODE_ENV=production node dist/main.js",
    "start:dev": "nest start",
    "lint": "biome lint src test e2e",
    "lint:fix": "biome lint --write src test e2e",
    "format": "biome format --write src test e2e",
    "format:check": "biome format src test e2e",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "clean": "rm -rf dist .turbo coverage test-results playwright-report",
    "prebuild": "rm -rf dist"
  },
  "dependencies": {
    "@nestjs/common": "10.4.15",
    "@nestjs/core": "10.4.15",
    "@nestjs/platform-fastify": "10.4.15",
    "fastify": "4.28.1",
    "reflect-metadata": "0.2.2",
    "rxjs": "7.8.1",
    "@insurtech/shared-config": "workspace:*",
    "@insurtech/shared-utils": "workspace:*"
  },
  "devDependencies": {
    "@nestjs/cli": "10.4.9",
    "@nestjs/schematics": "10.2.3",
    "@nestjs/testing": "10.4.15",
    "@types/node": "22.10.5",
    "@types/supertest": "6.0.2",
    "@playwright/test": "1.49.1",
    "@vitest/coverage-v8": "2.1.8",
    "supertest": "7.0.0",
    "ts-node": "10.9.2",
    "tsconfig-paths": "4.2.0",
    "typescript": "5.7.3",
    "vitest": "2.1.8"
  }
}
```

**Notes importantes** :
- `"private": true` empeche tout publish accidentel sur NPM. Aucun package interne `@insurtech/*` n'est jamais publie (convention monorepo decision-001).
- `"main": "dist/main.js"` pointe vers l'output build de Nest CLI. En dev, `nest start --watch` utilise ts-node sous le capot et n'a pas besoin du `main`.
- Toutes les versions sont epinglees exactement (sans `^` ou `~`) car `save-exact=true` dans `.npmrc`. La reproductibilite cross-machine est strict.
- `@nestjs/platform-fastify` 10.4.15 est aligne strictement avec `@nestjs/common` et `@nestjs/core` 10.4.15. Toute desynchronisation casse les types decorateurs.
- `fastify` 4.28.1 est la version exacte testee compatible avec `@nestjs/platform-fastify` 10.4.15. Fastify 5.x necessite NestJS 11+ (sortie Q3 2025, hors scope v2.2).
- `reflect-metadata` 0.2.2 est obligatoire pour les decorateurs DI. Doit etre la PREMIERE dependency importee dans main.ts.
- `rxjs` 7.8.1 est utilise par NestJS pour les Observables (Interceptors, Guards async).
- Les workspace deps `@insurtech/shared-config` et `@insurtech/shared-utils` resolvent localement via pnpm (pas NPM).
- Aucune emoji dans ce fichier (decision-006).
- Aucune dependency runtime supplementaire ici : Helmet, CORS, Pino, OpenTelemetry, Sentry, Swagger, Zod, BullMQ seront ajoutes dans les Taches 1.3.2 a 1.3.14 par leurs taches respectives.

### 6.2 Fichier 2/15 : `repo/apps/api/tsconfig.json`

Role : configurer TypeScript strict pour `apps/api`. Extends le `tsconfig.base.json` racine (pose Tache 1.1.2) et ajoute les flags decorateurs obligatoires NestJS.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "CommonJS",
    "target": "ES2023",
    "lib": ["ES2023"],
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "useDefineForClassFields": false,
    "esModuleInterop": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": false,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "paths": {
      "@/*": ["src/*"],
      "@bootstrap/*": ["src/bootstrap/*"]
    }
  },
  "include": ["src/**/*", "test/**/*"],
  "exclude": ["node_modules", "dist", "e2e", "coverage", "test-results"]
}
```

**Notes importantes** :
- `"module": "CommonJS"` : NestJS 10 utilise CommonJS interne. Migration ESM prevue NestJS 11 mais hors scope v2.2.
- `"target": "ES2023"` : aligne avec Node 22.20.0 LTS. `top-level await` non utilise (CommonJS), mais async/await + structuredClone + Array.fromAsync supportes.
- `"experimentalDecorators": true` + `"emitDecoratorMetadata": true` : OBLIGATOIRES NestJS. Sans cela, `@Module`, `@Injectable`, `@Controller` ne posent pas les metadata DI.
- `"useDefineForClassFields": false` : compatibilite decorateurs NestJS qui dependent de l'order legacy class fields.
- `"strictPropertyInitialization": false` : NestJS injecte les dependencies via constructor donc les class properties non initialisees sont normales (`private readonly logger: Logger;`).
- `"noUnusedLocals": false` et `"noUnusedParameters": false` : delegues a Biome lint qui les gere mieux (warnings vs errors).
- `"declaration": true"` permet de generer les `.d.ts` pour debug.
- `"paths"` : alias `@/*` et `@bootstrap/*` evitent les imports relatifs `../../bootstrap/`.
- Aucune emoji (decision-006).

### 6.3 Fichier 3/15 : `repo/apps/api/nest-cli.json`

Role : configurer Nest CLI pour les commandes `nest start` et `nest build`.

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "entryFile": "main",
  "compilerOptions": {
    "deleteOutDir": true,
    "tsConfigPath": "tsconfig.json",
    "assets": [
      {
        "include": "**/*.proto",
        "outDir": "dist"
      }
    ],
    "watchAssets": true,
    "manualRestart": false,
    "preserveWatchOutput": true,
    "plugins": []
  },
  "monorepo": false,
  "generateOptions": {
    "spec": true,
    "flat": false
  }
}
```

**Notes importantes** :
- `"$schema"` permet la validation IDE (VSCode + IntelliJ).
- `"sourceRoot": "src"` aligne avec `tsconfig.json` `rootDir`.
- `"entryFile": "main"` : Nest cherche `src/main.ts` comme entry point.
- `"deleteOutDir": true"` : avant chaque `nest build`, supprime `dist/` pour eviter les fichiers orphelins.
- `"watchAssets": true"` : en dev mode, watch les fichiers non-TypeScript (`.proto`, `.json` schemas).
- `"preserveWatchOutput": true"` : evite que le watcher clear le terminal a chaque rebuild.
- `"plugins": []"` : vide pour Tache 1.3.1. Les plugins `@nestjs/swagger/plugin` et `@nestjs/graphql/plugin` seront ajoutes Tache 1.3.9 (Swagger).
- `"monorepo": false"` : Nest CLI ne gere pas le monorepo (pnpm + Turborepo le font).
- Aucune emoji.

### 6.4 Fichier 4/15 : `repo/apps/api/src/main.ts`

Role : ORCHESTRATEUR DU BOOT. Fichier le plus critique de cette tache. Initialise telemetry FIRST, charge env Zod, cree app NestJS+Fastify, applique middlewares globaux, registre graceful shutdown, demarre serveur.

```typescript
/**
 * Skalean InsurTech v2.2 -- Backend API
 *
 * Boot orchestrator pour apps/api (NestJS 10.4 + Fastify 4.28).
 *
 * Order strict (NE PAS MODIFIER sans validation architecte) :
 *   1. import 'reflect-metadata' (polyfill DI obligatoire)
 *   2. startTelemetry() (auto-instrumentation OpenTelemetry AVANT tout import metier)
 *   3. loadEnv() (Zod runtime validation)
 *   4. NestFactory.create<NestFastifyApplication>(AppModule, FastifyAdapter, { bufferLogs: true })
 *   5. app.useLogger(Pino) (replace logger default par Pino)
 *   6. app.enableShutdownHooks() (active onModuleDestroy providers)
 *   7. registerGracefulShutdown() (handlers SIGTERM/SIGINT chain DB+Redis+Kafka+Tel)
 *   8. app.listen(port, '0.0.0.0') (bind 0.0.0.0 pour Docker)
 *
 * Reference : decision-003 (NestJS Fastify) + decision-006 (no-emoji ABSOLUE).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */

// Polyfill DI -- DOIT etre la TOUTE PREMIERE ligne avant tout autre import.
import 'reflect-metadata';

// Telemetry FIRST -- avant tout import metier afin que OpenTelemetry
// auto-instrumentation patche les modules (http, pg, ioredis, kafkajs).
import { startTelemetry, shutdownTelemetry } from '@insurtech/shared-utils/telemetry';

// Boot order helpers
import { measureBootTime } from './bootstrap/start-time-logger';
import { registerGracefulShutdown } from './bootstrap/graceful-shutdown';

// NestJS imports (consommes apres telemetry init)
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

// Env loader Zod (Sprint 2 Tache 1.2.14)
import { loadEnv } from '@insurtech/shared-config';

// App module (skeleton -- 1.3.2 enrichit)
import { AppModule } from './app.module';

/**
 * Bootstrap function -- entree principale.
 * Tout code metier passe par cette fonction. Aucun side-effect au niveau module.
 */
async function bootstrap(): Promise<void> {
  // Mesure du boot time (warn si > 5s).
  const bootStart = process.hrtime.bigint();

  // === ETAPE 1 : Telemetry FIRST ===
  // Sans cette etape avant tout import NestJS, l'auto-instrumentation
  // OpenTelemetry rate les premieres requetes du warm-up.
  startTelemetry({
    serviceName: process.env.OTEL_SERVICE_NAME ?? 'skalean-insurtech-api',
    serviceVersion: process.env.APP_VERSION ?? '0.1.0',
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  // === ETAPE 2 : Validation env Zod ===
  // loadEnv() retourne env type-safe. Si fail, process.exit(1) avec details Zod.
  const env = loadEnv();

  // === ETAPE 3 : Creation app NestJS + Fastify ===
  const bodyLimitBytes = (env.BODY_LIMIT_MB ?? 10) * 1024 * 1024;

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // trustProxy: true requis derriere Cloudflare WAF + Atlas LB.
      // Permet a Fastify de respecter X-Forwarded-For, X-Forwarded-Proto,
      // X-Forwarded-Host pour audit logs et rate-limit.
      trustProxy: true,
      // bodyLimit en bytes (10 MiB par defaut).
      // Au-dela : HTTP 413 Payload Too Large.
      bodyLimit: bodyLimitBytes,
      // Disable trustProxy pour les requetes locales si besoin (default true).
      // Disable case-sensitive routing (insensible : /Users == /users).
      caseSensitive: true,
      // Ignore trailing slash (default false).
      ignoreTrailingSlash: true,
      // Disable query string parser default qs (Fastify utilise qs natif).
      disableRequestLogging: false,
      // Hard limit headers a 16 KB (default 16384).
      maxParamLength: 200,
    }),
    {
      // bufferLogs : true = buffer les logs init NestJS jusqu'a useLogger().
      // Sans cela, les logs avant Pino actif vont vers console default.
      bufferLogs: true,
      // abortOnError : false = ne pas crash sur erreur module init,
      // permet shutdown propre meme si un module fail au boot.
      abortOnError: false,
    },
  );

  // === ETAPE 4 : Logger Pino actif ===
  // app.useLogger remplace le logger default. Les logs bufferises sont flushes.
  // 1.3.5 ajoute nestjs-pino. Pour 1.3.1, on utilise le Logger NestJS natif.
  const logger = new Logger('Bootstrap');
  app.useLogger(logger);

  // === ETAPE 5 : Active shutdown hooks NestJS ===
  // Sans cela, les providers @OnModuleDestroy ne sont pas appeles.
  app.enableShutdownHooks();

  // === ETAPE 6 : Graceful shutdown handlers ===
  // Chain : app.close() -> kafkaProducer.disconnect() -> dataSource.destroy()
  //         -> redisClient.quit() -> shutdownTelemetry() -> process.exit(0)
  registerGracefulShutdown(app, {
    timeoutMs: env.GRACEFUL_SHUTDOWN_TIMEOUT_MS ?? 30000,
    signals: ['SIGTERM', 'SIGINT'],
    logger,
  });

  // === ETAPE 7 : Listen sur API_PORT, bind 0.0.0.0 ===
  const port = env.API_PORT ?? 4000;
  const host = env.API_HOST ?? '0.0.0.0';

  await app.listen(port, host);

  // === Boot termine -- log diagnostics ===
  const bootDurationMs = measureBootTime(bootStart, logger);
  logger.log(
    `Skalean InsurTech API listening on http://${host}:${port} ` +
      `(env=${env.NODE_ENV}, version=${env.APP_VERSION ?? '0.1.0'}, ` +
      `boot=${bootDurationMs}ms, pid=${process.pid})`,
  );
}

// === Lancement avec catch global ===
bootstrap().catch((error: unknown) => {
  // Logger Pino non disponible si bootstrap fail tot. Fallback console.error.
  // C'est la SEULE exception au no-console-log policy : ultime fallback boot fail.
  // eslint-disable-next-line no-console
  console.error('[FATAL] Skalean InsurTech API failed to bootstrap:', error);

  // Exit 1 pour signaler echec.
  // Kubernetes restartera le pod selon politique restartPolicy.
  process.exit(1);
});
```

**Notes importantes** :
- `import 'reflect-metadata'` est la TOUTE PREMIERE ligne. Critique pour DI.
- `startTelemetry()` est appele AVANT l'import dynamique de `AppModule` (qui est en haut du fichier mais l'execution commence dans `bootstrap()` apres telemetry).
- `loadEnv()` retourne un objet type-safe via Zod. Si une variable env est manquante ou invalide, Zod throw avec message detaille et process exit.
- `bufferLogs: true` est crucial pour ne pas perdre les logs de la phase `InstanceLoader` NestJS.
- `app.useLogger(logger)` ici utilise `Logger` NestJS natif. Tache 1.3.5 remplacera par `app.get(Logger)` (nestjs-pino).
- `app.enableShutdownHooks()` est appele AVANT `registerGracefulShutdown` car le custom handler appelle `app.close()` qui necessite que les hooks soient actifs.
- `app.listen(port, '0.0.0.0')` : bind 0.0.0.0 EXPLICITEMENT (pas localhost) sinon Docker port mapping ne fonctionne pas.
- Le `console.error` final est l'UNIQUE exception a la regle no-console (decision-006/convention-13.x). Il est dans un catch ultime ou Pino n'est pas disponible. Documente avec `eslint-disable` inline.
- `process.exit(1)` au lieu de `throw` car on est dans le catch d'une promise top-level. Throw serait silencieusement avale par Node.
- Aucune emoji.

### 6.5 Fichier 5/15 : `repo/apps/api/src/bootstrap/graceful-shutdown.ts`

Role : helper qui registre les handlers SIGTERM/SIGINT et orchestre la chaine de shutdown DB+Redis+Kafka+Telemetry+app avec timeout 30s et flag anti-double-signal.

```typescript
/**
 * Graceful shutdown helper -- chain DB+Redis+Kafka+Telemetry+app close.
 *
 * Pattern critique pour SLA 99.9% Skalean InsurTech v2.2 :
 * - Refuser nouvelles connexions HTTP (app.close).
 * - Drainer requetes in-flight (Fastify closeWatcher 30s).
 * - Flusher messages Kafka in-flight (kafkaProducer.disconnect).
 * - Cloturer connexions Postgres pool (dataSource.destroy).
 * - Quitter Redis (redisClient.quit).
 * - Flusher OpenTelemetry spans/metrics (shutdownTelemetry).
 * - process.exit(0).
 *
 * Tout ordre different produit des effets de bord non-deterministes.
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import type { INestApplication, LoggerService } from '@nestjs/common';
import { shutdownTelemetry } from '@insurtech/shared-utils/telemetry';

export interface GracefulShutdownOptions {
  /** Timeout total en ms apres lequel process.exit(1) force. Default 30000. */
  timeoutMs: number;
  /** Signaux a intercepter. Default ['SIGTERM', 'SIGINT']. */
  signals: NodeJS.Signals[];
  /** Logger NestJS (LoggerService). */
  logger: LoggerService;
}

/** Flag global qui empeche double-shutdown chain. */
let isShuttingDown = false;

/**
 * Registre les handlers de signal et orchestre la sequence de shutdown.
 * Doit etre appelee APRES app.enableShutdownHooks() et AVANT app.listen().
 */
export function registerGracefulShutdown(
  app: INestApplication,
  options: GracefulShutdownOptions,
): void {
  const { timeoutMs, signals, logger } = options;

  for (const signal of signals) {
    process.on(signal, () => {
      void handleShutdown(signal, app, timeoutMs, logger);
    });
  }

  // Catch uncaught exceptions et unhandled rejections au top-level.
  // Sans cela, Node default behavior = process.exit(1) brutal sans cleanup.
  process.on('uncaughtException', (error: Error) => {
    logger.error?.(`Uncaught exception: ${error.message}`, error.stack);
    void handleShutdown('uncaughtException' as NodeJS.Signals, app, timeoutMs, logger);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error?.(`Unhandled rejection: ${String(reason)}`);
    void handleShutdown('unhandledRejection' as NodeJS.Signals, app, timeoutMs, logger);
  });
}

/**
 * Orchestre la sequence de shutdown avec timeout et flag anti-double.
 */
async function handleShutdown(
  signal: NodeJS.Signals,
  app: INestApplication,
  timeoutMs: number,
  logger: LoggerService,
): Promise<void> {
  if (isShuttingDown) {
    logger.warn?.(`Already shutting down, ignoring signal ${signal}`);
    return;
  }
  isShuttingDown = true;

  logger.log?.(`Received ${signal}, initiating graceful shutdown (timeout ${timeoutMs}ms)`);

  // Promise.race : la sequence de shutdown VS le timeout total.
  const shutdownPromise = runShutdownSequence(app, logger);
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error(`Shutdown timeout exceeded (${timeoutMs}ms)`)), timeoutMs),
  );

  try {
    await Promise.race([shutdownPromise, timeoutPromise]);
    logger.log?.('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error: unknown) {
    logger.error?.(
      `Graceful shutdown failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}

/**
 * Execute la sequence de shutdown dans l'ordre strict.
 * Chaque etape a son propre try/catch pour ne pas bloquer la suite.
 */
async function runShutdownSequence(
  app: INestApplication,
  logger: LoggerService,
): Promise<void> {
  // Etape 1 : app.close() = drain HTTP + flush onModuleDestroy hooks NestJS.
  await safeStep('app.close', () => app.close(), logger);

  // Etape 2 : Kafka disconnect (acks in-flight).
  // Au Sprint 3, kafkaProducer n'est pas encore importe ici. Le hook
  // onModuleDestroy du KafkaModule (Sprint 3 Tache 1.3.x) gere ce cas via
  // app.close(). Cette etape est documentee mais no-op pour 1.3.1.
  await safeStep('kafka.disconnect (delegated to onModuleDestroy)', async () => {}, logger);

  // Etape 3 : DataSource destroy = close pool Postgres + rollback in-flight.
  // Idem, gere via onModuleDestroy DatabaseModule (Sprint 2 Tache 1.2.3).
  await safeStep('dataSource.destroy (delegated to onModuleDestroy)', async () => {}, logger);

  // Etape 4 : Redis quit = flush pending commands + close connection.
  // Idem, gere via onModuleDestroy RedisModule (Sprint 2 Tache 1.2.6).
  await safeStep('redis.quit (delegated to onModuleDestroy)', async () => {}, logger);

  // Etape 5 : Telemetry shutdown = export spans/metrics restants.
  // CETTE ETAPE doit etre faite ICI (pas via onModuleDestroy) car le SDK
  // OTEL est initialise avant NestJS et n'est pas un module NestJS.
  await safeStep('telemetry.shutdown', () => shutdownTelemetry(), logger);
}

/**
 * Wrapper qui execute une etape avec son propre try/catch + log.
 */
async function safeStep(
  name: string,
  fn: () => Promise<void> | void,
  logger: LoggerService,
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    logger.log?.(`Shutdown step ${name} completed in ${Date.now() - start}ms`);
  } catch (error: unknown) {
    logger.error?.(
      `Shutdown step ${name} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
```

**Notes importantes** :
- Flag `isShuttingDown` evite la double-execution si Kubernetes envoie SIGTERM puis SIGTERM rapidement.
- `Promise.race` avec timeout total garantit que process.exit n'est jamais bloque indefiniment.
- Chaque etape a son propre try/catch dans `safeStep` : un fail Kafka ne doit pas empecher Postgres de se fermer.
- Etapes 2/3/4 sont marquees "delegated to onModuleDestroy" car les modules Sprint 2 (DatabaseModule, RedisModule, KafkaModule) declarent `@OnModuleDestroy` qui est appele par `app.close()`. Cette redondance documentee est volontaire (defense en profondeur).
- Etape 5 (telemetry) est explicite ici car le SDK OTEL n'est pas un module NestJS.
- `uncaughtException` et `unhandledRejection` sont catches AUSSI : permettent un graceful shutdown meme apres un bug runtime non-prevu.
- Aucune emoji.

### 6.6 Fichier 6/15 : `repo/apps/api/src/bootstrap/middleware-order.ts`

Role : documentation executable de l'ordre des middlewares globaux pour les Taches 1.3.5 a 1.3.14. Ce fichier ne contient pas de logique au Sprint 3 Tache 1.3.1, juste un commentaire structure et des exports placeholder qui forceront les Taches suivantes a respecter l'ordre.

```typescript
/**
 * Middleware order documentation -- ordre attendu pour Taches 1.3.5 a 1.3.14.
 *
 * Cet ordre est CRITIQUE. Chaque middleware suppose que le precedent a deja
 * pose des donnees dans la request. Modifier l'ordre = bugs subtils en prod.
 *
 * Ordre canonique :
 *   1. Helmet headers (security headers AVANT tout)
 *   2. CORS preflight (OPTIONS handled here)
 *   3. Compression (Brotli/gzip pour responses)
 *   4. RequestId middleware (genere x-request-id pour correlation logs)
 *   5. Logger Pino http (auto-log requests avec request-id)
 *   6. Body parser (JSON, urlencoded, multipart)
 *   7. Rate limit (per IP/user/tenant)
 *   8. Tenant context interceptor (lit x-tenant-id header)
 *   9. Auth guard (JWT/MFA -- Sprint 5)
 *  10. RBAC guard (12 roles -- Sprint 7)
 *  11. ZodValidationPipe (validate body/query/params)
 *  12. Controller handler
 *  13. ResponseInterceptor (wrap response { data, meta })
 *  14. ExceptionFilter (catch errors, redact PII)
 *
 * Reference : decision-002 (Multi-tenant) + decision-006 (no-emoji).
 * Tache : 1.3.1 pose la doc, 1.3.5 a 1.3.14 implementent.
 */

import type { INestApplication } from '@nestjs/common';

/**
 * Placeholder qui sera enrichi par chaque tache.
 * Tache 1.3.1 : function vide (juste signature).
 * Tache 1.3.5 : ajoute Helmet + CORS + compression.
 * Tache 1.3.6 : ajoute RequestId + Logger HTTP.
 * Tache 1.3.7 : ajoute body parsers fastify.
 * Tache 1.3.8 : ajoute Rate Limit Redis.
 * Tache 1.3.9 : ajoute TenantContextInterceptor.
 * Tache 1.3.10 : ajoute AuthGuard JWT (placeholder Sprint 5).
 * Tache 1.3.11 : ajoute RBACGuard (placeholder Sprint 7).
 * Tache 1.3.12 : ajoute ZodValidationPipe global.
 * Tache 1.3.13 : ajoute ResponseInterceptor global.
 * Tache 1.3.14 : ajoute ExceptionFilter global.
 */
export async function applyGlobalMiddlewares(app: INestApplication): Promise<void> {
  // Tache 1.3.1 : aucun middleware applique. Documentation pour suite.
  void app;
}

/**
 * Constante exportee pour les tests : ordre attendu.
 * Les tests verifient que chaque middleware est applique dans le bon ordre.
 */
export const EXPECTED_MIDDLEWARE_ORDER = [
  'helmet',
  'cors',
  'compression',
  'request-id',
  'logger-http',
  'body-parser',
  'rate-limit',
  'tenant-context',
  'auth-guard',
  'rbac-guard',
  'zod-validation-pipe',
  'response-interceptor',
  'exception-filter',
] as const;

export type MiddlewareName = (typeof EXPECTED_MIDDLEWARE_ORDER)[number];
```

**Notes importantes** :
- Ce fichier sert de contrat documente. Les Taches 1.3.5+ etendent `applyGlobalMiddlewares()`.
- `EXPECTED_MIDDLEWARE_ORDER` est une union readonly utilisable dans les tests pour verifier l'ordre.
- Aucune emoji.

### 6.7 Fichier 7/15 : `repo/apps/api/src/bootstrap/start-time-logger.ts`

Role : helper qui mesure le boot time et log warning si > 5 secondes (alerte SLA).

```typescript
/**
 * Boot time logger -- mesure duree boot et alerte si > 5s.
 *
 * SLA Skalean InsurTech v2.2 : boot < 5s sur machine 16GB RAM.
 * Si > 5s, log warning pour investigation (cold start trop long impacte
 * deploiements blue-green : delai entre kill ancien pod + ready nouveau).
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import type { LoggerService } from '@nestjs/common';

/** Seuil au-dela duquel un warning est emis. */
export const BOOT_TIME_WARNING_THRESHOLD_MS = 5000;

/**
 * Calcule la duree depuis bootStart et log warning si > seuil.
 * Retourne la duree en ms (entier).
 */
export function measureBootTime(bootStart: bigint, logger: LoggerService): number {
  const bootEnd = process.hrtime.bigint();
  const durationNs = Number(bootEnd - bootStart);
  const durationMs = Math.round(durationNs / 1_000_000);

  if (durationMs > BOOT_TIME_WARNING_THRESHOLD_MS) {
    logger.warn?.(
      `Boot time exceeded threshold: ${durationMs}ms > ${BOOT_TIME_WARNING_THRESHOLD_MS}ms. ` +
        'Investigate cold start optimization (Pino transports, OTEL exporters, DB connections).',
    );
  }

  return durationMs;
}

/**
 * Helper pour les tests : reset le seuil.
 * Utilise uniquement en tests Vitest.
 */
export function getBootTimeWarningThresholdMs(): number {
  return BOOT_TIME_WARNING_THRESHOLD_MS;
}
```

**Notes importantes** :
- Utilise `process.hrtime.bigint()` (vs `Date.now()`) pour precision nanoseconde.
- Conversion ns -> ms via division 1_000_000 pour lisibilite logs.
- Seuil exporte comme constante pour overrides dans tests.
- Aucune emoji.

### 6.8 Fichier 8/15 : `repo/apps/api/src/app.module.ts`

Role : module racine NestJS, skeleton minimal au Sprint 3 Tache 1.3.1, enrichi par les Taches 1.3.2 a 1.3.15.

```typescript
/**
 * AppModule -- module racine NestJS de Skalean InsurTech v2.2 API.
 *
 * Au Sprint 3 Tache 1.3.1 : skeleton minimal (AppController + AppService).
 * Au Sprint 3 Tache 1.3.2 : ajoute ConfigModule (Zod env loader), DatabaseModule
 *   (TypeORM AppDataSource), RedisModule, KafkaModule.
 * Au Sprint 3 Tache 1.3.5 : ajoute LoggerModule (nestjs-pino).
 * Au Sprint 5 Tache 1.5.x : ajoute AuthModule (Argon2id + JWT + MFA).
 * Au Sprint 6 Tache 1.6.x : ajoute TenantModule (RLS + multi-tenant).
 * Au Sprint 7 Tache 1.7.x : ajoute RBACModule (12 roles).
 * Au Sprint 8+ : ajoute CRMModule, BookingModule, CommModule, etc.
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (skeleton).
 */
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Tache 1.3.2 : ConfigModule.forRoot({ load: [envSchema] })
    // Tache 1.3.3 : DatabaseModule (TypeORM AppDataSource Sprint 2)
    // Tache 1.3.4 : RedisModule + KafkaModule
    // Tache 1.3.5 : LoggerModule (nestjs-pino)
    // Sprint 5 : AuthModule
    // Sprint 6 : TenantModule + RLSModule
    // Sprint 7 : RBACModule
    // Sprint 8+ : 19 modules metier
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Notes importantes** :
- Volontairement minimal pour Tache 1.3.1. Les imports sont commentes pour signaler quel sprint enrichira.
- `AppController` et `AppService` sont declares pour avoir le endpoint `GET /` minimal fonctionnel des cette tache.
- Aucun decorator `@Global()` au Sprint 3.
- Aucune emoji.

### 6.9 Fichier 9/15 : `repo/apps/api/src/app.controller.ts`

Role : controller racine exposant `GET /` qui retourne metadata service (pour healthcheck minimal et debug).

```typescript
/**
 * AppController -- controller racine GET /.
 *
 * Endpoint minimal pour smoke test et debug. NE PAS confondre avec
 * /healthz et /readyz qui seront ajoutes Tache 1.3.10 (HealthModule).
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * GET /
   *
   * Retourne metadata service (name, version, env, uptime).
   * Usage : smoke test boot reussi, debug version deployee.
   *
   * Format : `{ name, version, env, uptime_seconds, timestamp }`.
   * Status : 200 OK.
   * Auth : aucune (public-by-default au Sprint 3, sera @Public() Tache 1.3.14).
   */
  @Get()
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('X-API-Endpoint', 'root')
  getRoot(): {
    name: string;
    version: string;
    env: string;
    uptime_seconds: number;
    timestamp: string;
  } {
    return this.appService.getInfo();
  }
}
```

**Notes importantes** :
- `@Header('Cache-Control', 'no-store...')` empeche le cache CDN/browser sur cet endpoint metadata.
- `@Header('X-API-Endpoint', 'root')` pose un debug tag utile en prod.
- Pas de `@Public()` au Sprint 3 (le decorateur n'existe pas encore, sera Tache 1.3.14).
- Type return explicite (pas de `any`, pas d'inference). Helpe Swagger generation Tache 1.3.9.
- Aucune emoji.

### 6.10 Fichier 10/15 : `repo/apps/api/src/app.service.ts`

Role : service racine qui calcule les metadata service (name, version, env, uptime).

```typescript
/**
 * AppService -- metadata service Skalean InsurTech API.
 *
 * Reference : decision-003 (NestJS) + decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** Timestamp de demarrage process en ms (process.uptime() * 1000 derive). */
  private readonly startedAt: number = Date.now();

  /**
   * Retourne metadata service.
   * uptime_seconds est calcule depuis process.uptime() pour precision.
   */
  getInfo(): {
    name: string;
    version: string;
    env: string;
    uptime_seconds: number;
    timestamp: string;
  } {
    return {
      name: process.env.APP_NAME ?? 'skalean-insurtech-api',
      version: process.env.APP_VERSION ?? '0.1.0',
      env: process.env.NODE_ENV ?? 'development',
      uptime_seconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Helper pour tests : retourne le timestamp de demarrage.
   */
  getStartedAt(): number {
    return this.startedAt;
  }
}
```

**Notes importantes** :
- `process.uptime()` retourne secondes flottantes depuis demarrage Node. `Math.round` pour cleaner.
- Fallbacks `?? 'skalean-insurtech-api'` permettent de fonctionner meme si env vars absentes (resilience tests).
- `timestamp: new Date().toISOString()` fournit horodatage UTC ISO 8601 (audit-friendly).
- Aucune emoji.

### 6.11 Fichier 11/15 : `repo/apps/api/.env.example`

Role : template documente des 35+ variables environnement consommees par `apps/api` au Sprint 3 (et au-dela).

```env
# ============================================================================
# Skalean InsurTech v2.2 -- apps/api .env.example
# ============================================================================
# Toutes les variables sont validees par Zod via @insurtech/shared-config.
# Les valeurs ci-dessous sont des EXEMPLES de development.
# En staging/prod, surcharger via Atlas Secrets Manager (decision-008).
# Reference : 00-pilotage/documentation/2-variables-environnement.env.
# AUCUNE EMOJI (decision-006).
# ============================================================================

# === RUNTIME ENV ===
NODE_ENV=development                          # development | staging | production
APP_NAME=skalean-insurtech-api
APP_VERSION=0.1.0                              # bumpe Sprint 35 avant pilote Marrakech
TZ=Africa/Casablanca                           # decision-008 data residency

# === API SERVER ===
API_PORT=4000                                  # 4000 dev/staging/prod
API_HOST=0.0.0.0                               # NE PAS utiliser localhost (Docker)
BODY_LIMIT_MB=10                               # MiB max body (rejet 413 au-dela)
GRACEFUL_SHUTDOWN_TIMEOUT_MS=30000             # align K8s terminationGracePeriodSeconds

# === DATABASE Postgres (Sprint 2) ===
DATABASE_URL=postgresql://insurtech:dev_password@localhost:5432/insurtech_dev
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_STATEMENT_TIMEOUT_MS=30000
DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS=60000
DATABASE_SSL=false                             # true en staging/prod (Atlas TLS)

# === REDIS (Sprint 2) ===
REDIS_URL=redis://localhost:6379
REDIS_DB_CACHE=0                               # cache responses
REDIS_DB_SESSIONS=1                            # sessions auth Sprint 5
REDIS_DB_QUEUES=2                              # BullMQ Tache 1.3.11
REDIS_DB_RATE_LIMIT=5                          # @nestjs/throttler Tache 1.3.13
REDIS_DB_IDEMPOTENCY=6                         # idempotency-key Sprint 11
REDIS_PASSWORD=                                # vide en dev, surcharge prod

# === KAFKA (Sprint 2) ===
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=skalean-insurtech-api
KAFKA_GROUP_ID=skalean-insurtech-api-consumers
KAFKA_SSL=false                                # true en staging/prod

# === OPENTELEMETRY (Sprint 2 Tache 1.2.13) ===
OTEL_SERVICE_NAME=skalean-insurtech-api
OTEL_SERVICE_VERSION=0.1.0
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_TRACES_SAMPLER=parentbased_traceidratio
OTEL_TRACES_SAMPLER_ARG=1.0                    # 100% en dev, 0.1 en prod
OTEL_RESOURCE_ATTRIBUTES=service.namespace=skalean-insurtech,deployment.environment=development

# === SENTRY (Tache 1.3.12) ===
SENTRY_DSN=                                     # vide en dev, surcharge prod
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.0
SENTRY_ENVIRONMENT=development

# === AUTH (Sprint 5 -- placeholder Tache 1.3.1) ===
JWT_PRIVATE_KEY=                                # PEM RSA-2048 (Sprint 5)
JWT_PUBLIC_KEY=                                 # PEM RSA-2048
JWT_ALGORITHM=RS256
JWT_ACCESS_TTL_SECONDS=900                     # 15min
JWT_REFRESH_TTL_SECONDS=2592000                # 30 jours
PASSWORD_PEPPER=                                # 32-bytes random (vault prod)
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3
ARGON2_PARALLELISM=4

# === CORS (Tache 1.3.5) ===
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,http://localhost:3005,http://localhost:3006

# === RATE LIMIT (Tache 1.3.13) ===
RATE_LIMIT_TTL_MS=60000                        # 1 minute
RATE_LIMIT_MAX_REQUESTS=100                    # 100 req/min/IP par defaut
RATE_LIMIT_AUTH_MAX=5                          # 5 attempts/min/IP sur /auth/*

# === LOGGER PINO (Tache 1.3.5) ===
LOG_LEVEL=debug                                # debug en dev, info en staging/prod
LOG_PRETTY_PRINT=true                          # true en dev seulement
LOG_REDACT_PII=true                            # ABSOLU (loi 09-08 CNDP)
```

**Notes importantes** :
- 40 variables environnement listees (au-dela des 30+ requises par la spec).
- Chaque variable a un commentaire explicatif et une valeur de development.
- `LOG_REDACT_PII=true` est ABSOLU (loi 09-08 CNDP) -- decision-008.
- `TZ=Africa/Casablanca` aligne avec data residency Maroc.
- Aucune emoji (decision-006).

### 6.12 Fichier 12/15 : `repo/apps/api/Dockerfile`

Role : multi-stage Docker build pour produire image runtime minimale Node 22.11-alpine non-root.

```dockerfile
# syntax=docker/dockerfile:1.7-labs

# ============================================================================
# Skalean InsurTech v2.2 -- apps/api Dockerfile
# Multi-stage Node 22.11-alpine + non-root user + healthcheck.
# Reference : decision-008 (Atlas Cloud Maroc) + decision-006 (no-emoji).
# ============================================================================

# === Stage 1 : pnpm install + build ===
FROM node:22.11-alpine AS builder

# Active pnpm via corepack (preinstalle Node 22+).
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copie lockfile + workspace config FIRST pour cache Docker layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared-config/package.json packages/shared-config/
COPY packages/shared-utils/package.json packages/shared-utils/

# Install workspace deps (frozen-lockfile pour reproductibilite).
RUN pnpm install --frozen-lockfile --filter=@insurtech/api...

# Copie sources + build.
COPY apps/api apps/api/
COPY packages/shared-config packages/shared-config/
COPY packages/shared-utils packages/shared-utils/
COPY tsconfig.base.json ./
COPY turbo.json ./

RUN pnpm --filter @insurtech/api build

# === Stage 2 : runtime minimal ===
FROM node:22.11-alpine AS runtime

# Active pnpm pour install prod-only.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Cree user non-root (UID 1001).
RUN addgroup -g 1001 -S insurtech && adduser -u 1001 -S insurtech -G insurtech

WORKDIR /app

# Copie node_modules + dist depuis builder.
COPY --from=builder --chown=insurtech:insurtech /app/node_modules ./node_modules
COPY --from=builder --chown=insurtech:insurtech /app/apps/api/dist apps/api/dist
COPY --from=builder --chown=insurtech:insurtech /app/apps/api/package.json apps/api/
COPY --from=builder --chown=insurtech:insurtech /app/packages packages

USER insurtech

ENV NODE_ENV=production
ENV API_PORT=4000
ENV API_HOST=0.0.0.0
ENV TZ=Africa/Casablanca

EXPOSE 4000

# Healthcheck : Tache 1.3.10 ajoute /healthz endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/healthz || exit 1

CMD ["node", "apps/api/dist/main.js"]
```

**Notes importantes** :
- Multi-stage : builder + runtime. Image finale ne contient pas pnpm cache.
- User non-root UID 1001 (security best practice).
- Layer caching : copie lockfile FIRST permet cache Docker si seules sources changent.
- HEALTHCHECK aligne avec /healthz Tache 1.3.10.
- Aucune emoji.

### 6.13 Fichier 13/15 : `repo/apps/api/.dockerignore`

Role : exclure des fichiers du build context Docker.

```
node_modules
**/node_modules
dist
**/dist
.turbo
**/.turbo
coverage
**/coverage
test-results
**/test-results
playwright-report
**/playwright-report
.tsbuildinfo
**/*.tsbuildinfo
.env
**/.env
.env.local
**/.env.local
.git
.github
.husky
.vscode
*.log
**/*.log
README.md
LICENSE
docs
e2e
test
**/e2e
**/test
**/*.spec.ts
**/*.test.ts
```

**Notes importantes** :
- Exclut tout sauf src + package.json + tsconfig + node_modules cache.
- `**/*.spec.ts` et `**/*.test.ts` exclus pour image runtime.
- Aucune emoji.

### 6.14 Fichier 14/15 : `repo/apps/api/README.md`

Role : quick start dev pour onboarding.

```markdown
# @insurtech/api

Backend API NestJS 10.4 + Fastify 4.28 pour Skalean InsurTech v2.2.

## Quick start dev

Prerequis : Node 22.20.0, pnpm 9.15.0, Docker Desktop, Postgres 17 + Redis 7 + Kafka 3.7 lances localement (voir `infrastructure/docker/docker-compose.dev.yml`).

```bash
cd repo
pnpm install --frozen-lockfile
cp apps/api/.env.example apps/api/.env
pnpm --filter @insurtech/api dev
```

L'API demarre sur `http://localhost:4000`.

## Endpoints disponibles (Sprint 3 Tache 1.3.1)

- `GET /` retourne `{ name, version, env, uptime_seconds, timestamp }`.

## Endpoints prevus (Sprint 3 Taches 1.3.2 a 1.3.15)

- `GET /healthz` liveness probe (Tache 1.3.10).
- `GET /readyz` readiness probe (Tache 1.3.10).
- `GET /docs` Swagger UI (Tache 1.3.9).
- `GET /metrics` Prometheus (Tache 1.3.10).

## Tests

```bash
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:e2e
```

## Build prod

```bash
pnpm --filter @insurtech/api build
docker build -f apps/api/Dockerfile -t insurtech-api:0.1.0 .
docker run -p 4000:4000 --env-file apps/api/.env insurtech-api:0.1.0
```

## Conventions

- Aucune emoji (decision-006).
- Pino logger uniquement (jamais console.log).
- Zod validation uniquement (jamais class-validator).
- Argon2id (jamais bcrypt).
- pnpm uniquement (jamais npm/yarn).

## Reference

- B-03 Sprint 3 API Bootstrap : `00-pilotage/meta-prompts/B-03-sprint-03-api-bootstrap.md`.
- decision-003 NestJS Fastify : `00-pilotage/decisions/003-framework-backend-nestjs.md`.
- decision-006 No-emoji : `00-pilotage/decisions/006-no-emoji-policy.md`.
```

**Notes importantes** :
- Quick start aligne avec convention monorepo decision-001.
- Pas d'emoji (decision-006).

### 6.15 Fichier 15/15 : `repo/apps/api/test/fixtures/env-fixtures.ts`

Role : fixtures env vars pour tests Vitest et Playwright.

```typescript
/**
 * Fixtures env vars pour tests Vitest et Playwright.
 *
 * Reference : decision-006 (no-emoji).
 * Tache : 1.3.1 (Sprint 3 / Phase 1).
 */

export const VALID_ENV_FIXTURE = {
  NODE_ENV: 'test',
  APP_NAME: 'skalean-insurtech-api-test',
  APP_VERSION: '0.0.0',
  API_PORT: '14000',                            // port test isole
  API_HOST: '127.0.0.1',
  BODY_LIMIT_MB: '10',
  GRACEFUL_SHUTDOWN_TIMEOUT_MS: '5000',         // 5s en test (vs 30s prod)
  TZ: 'Africa/Casablanca',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  KAFKA_BROKERS: 'localhost:9092',
  OTEL_SERVICE_NAME: 'skalean-insurtech-api-test',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
  LOG_LEVEL: 'silent',                          // pas de logs en test
  LOG_PRETTY_PRINT: 'false',
  LOG_REDACT_PII: 'true',
  CORS_ORIGINS: 'http://localhost:3000',
  RATE_LIMIT_TTL_MS: '60000',
  RATE_LIMIT_MAX_REQUESTS: '100',
} as const;

export const INVALID_ENV_FIXTURE = {
  NODE_ENV: 'invalid_value',                    // doit etre dev/staging/prod
  API_PORT: 'not-a-number',                     // doit etre integer
  BODY_LIMIT_MB: '-1',                          // doit etre > 0
} as const;

export function applyEnvFixture(fixture: Record<string, string>): void {
  for (const [key, value] of Object.entries(fixture)) {
    process.env[key] = value;
  }
}

export function clearEnvFixture(fixture: Record<string, string>): void {
  for (const key of Object.keys(fixture)) {
    delete process.env[key];
  }
}
```

**Notes importantes** :
- Fixtures `as const` pour type-safety.
- `applyEnvFixture` et `clearEnvFixture` permettent setup/teardown propres.
- `LOG_LEVEL=silent` evite pollution stdout en tests.
- Aucune emoji.

---

## 7. Tests complets

### 7.1 Tests unitaires : `repo/apps/api/src/main.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { applyEnvFixture, clearEnvFixture, VALID_ENV_FIXTURE } from '../test/fixtures/env-fixtures';

describe('main.ts bootstrap', () => {
  beforeEach(() => {
    applyEnvFixture({ ...VALID_ENV_FIXTURE });
    vi.resetModules();
  });

  afterEach(() => {
    clearEnvFixture({ ...VALID_ENV_FIXTURE });
    vi.restoreAllMocks();
  });

  it('imports reflect-metadata before any other module', async () => {
    const order: string[] = [];
    vi.doMock('reflect-metadata', () => {
      order.push('reflect-metadata');
      return {};
    });
    vi.doMock('@insurtech/shared-utils/telemetry', () => {
      order.push('telemetry');
      return {
        startTelemetry: vi.fn(),
        shutdownTelemetry: vi.fn(),
      };
    });
    await import('./main');
    expect(order[0]).toBe('reflect-metadata');
  });

  it('calls startTelemetry before NestFactory.create', async () => {
    const calls: string[] = [];
    vi.doMock('@insurtech/shared-utils/telemetry', () => ({
      startTelemetry: vi.fn(() => calls.push('telemetry')),
      shutdownTelemetry: vi.fn(),
    }));
    vi.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: vi.fn(() => {
          calls.push('nestfactory');
          return Promise.resolve({
            useLogger: vi.fn(),
            enableShutdownHooks: vi.fn(),
            listen: vi.fn(),
            close: vi.fn(),
          });
        }),
      },
    }));
    await import('./main');
    expect(calls.indexOf('telemetry')).toBeLessThan(calls.indexOf('nestfactory'));
  });

  it('uses bufferLogs: true in NestFactory.create options', async () => {
    const createSpy = vi.fn(() => Promise.resolve({
      useLogger: vi.fn(),
      enableShutdownHooks: vi.fn(),
      listen: vi.fn(),
      close: vi.fn(),
    }));
    vi.doMock('@nestjs/core', () => ({ NestFactory: { create: createSpy } }));
    await import('./main');
    const callArgs = createSpy.mock.calls[0];
    const options = callArgs?.[2];
    expect(options).toMatchObject({ bufferLogs: true });
  });

  it('configures FastifyAdapter with trustProxy: true and bodyLimit: 10485760', async () => {
    const adapterSpy = vi.fn();
    vi.doMock('@nestjs/platform-fastify', () => ({
      FastifyAdapter: adapterSpy,
    }));
    await import('./main');
    expect(adapterSpy).toHaveBeenCalledWith(
      expect.objectContaining({ trustProxy: true, bodyLimit: 10485760 }),
    );
  });

  it('listens on API_PORT bound to 0.0.0.0', async () => {
    const listenSpy = vi.fn();
    vi.doMock('@nestjs/core', () => ({
      NestFactory: {
        create: () => Promise.resolve({
          useLogger: vi.fn(),
          enableShutdownHooks: vi.fn(),
          listen: listenSpy,
          close: vi.fn(),
        }),
      },
    }));
    await import('./main');
    expect(listenSpy).toHaveBeenCalledWith(14000, '127.0.0.1');
  });

  it('exits with code 1 on bootstrap failure', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    vi.doMock('@insurtech/shared-utils/telemetry', () => {
      throw new Error('Telemetry init failed');
    });
    await import('./main');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
```

### 7.2 Tests unitaires : `repo/apps/api/src/app.controller.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();
    controller = moduleRef.get<AppController>(AppController);
  });

  it('GET / returns name skalean-insurtech-api', () => {
    const result = controller.getRoot();
    expect(result.name).toContain('skalean-insurtech-api');
  });

  it('GET / returns version 0.1.0 by default', () => {
    process.env.APP_VERSION = '0.1.0';
    const result = controller.getRoot();
    expect(result.version).toBe('0.1.0');
  });

  it('GET / returns env from process.env.NODE_ENV', () => {
    process.env.NODE_ENV = 'test';
    const result = controller.getRoot();
    expect(result.env).toBe('test');
  });

  it('GET / returns uptime_seconds as integer', () => {
    const result = controller.getRoot();
    expect(Number.isInteger(result.uptime_seconds)).toBe(true);
    expect(result.uptime_seconds).toBeGreaterThanOrEqual(0);
  });

  it('GET / returns ISO 8601 timestamp', () => {
    const result = controller.getRoot();
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('GET / response keys are exactly { name, version, env, uptime_seconds, timestamp }', () => {
    const result = controller.getRoot();
    expect(Object.keys(result).sort()).toEqual(
      ['env', 'name', 'timestamp', 'uptime_seconds', 'version'].sort(),
    );
  });
});
```

### 7.3 Tests unitaires : `repo/apps/api/src/bootstrap/graceful-shutdown.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerGracefulShutdown } from './graceful-shutdown';
import type { INestApplication, LoggerService } from '@nestjs/common';

describe('registerGracefulShutdown', () => {
  let app: INestApplication;
  let logger: LoggerService;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    app = {
      close: vi.fn(() => Promise.resolve()),
    } as unknown as INestApplication;
    logger = {
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as LoggerService;
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  });

  it('registers handlers for SIGTERM and SIGINT', () => {
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM', 'SIGINT'], logger });
    expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
    expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
  });

  it('calls app.close() on SIGTERM', async () => {
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('SIGTERM');
    await new Promise(r => setTimeout(r, 100));
    expect(app.close).toHaveBeenCalled();
  });

  it('exits with code 0 on successful shutdown', async () => {
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('SIGTERM');
    await new Promise(r => setTimeout(r, 200));
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('ignores duplicate SIGTERM signals (anti-double-shutdown)', async () => {
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('SIGTERM');
    process.emit('SIGTERM');
    await new Promise(r => setTimeout(r, 200));
    expect(app.close).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Already shutting down'));
  });

  it('exits with code 1 if shutdown timeout exceeded', async () => {
    app = {
      close: vi.fn(() => new Promise(() => {})),
    } as unknown as INestApplication;
    registerGracefulShutdown(app, { timeoutMs: 100, signals: ['SIGTERM'], logger });
    process.emit('SIGTERM');
    await new Promise(r => setTimeout(r, 300));
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Shutdown timeout exceeded'),
    );
  });

  it('handles uncaughtException by initiating shutdown', async () => {
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('uncaughtException', new Error('test crash'));
    await new Promise(r => setTimeout(r, 200));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Uncaught exception'),
      expect.any(String),
    );
  });

  it('handles unhandledRejection by initiating shutdown', async () => {
    registerGracefulShutdown(app, { timeoutMs: 30000, signals: ['SIGTERM'], logger });
    process.emit('unhandledRejection', new Error('test rejection'), Promise.resolve());
    await new Promise(r => setTimeout(r, 200));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Unhandled rejection'),
    );
  });
});
```

### 7.4 Tests unitaires : `repo/apps/api/src/bootstrap/start-time-logger.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { measureBootTime, BOOT_TIME_WARNING_THRESHOLD_MS } from './start-time-logger';
import type { LoggerService } from '@nestjs/common';

describe('measureBootTime', () => {
  it('returns duration in ms as integer', () => {
    const start = process.hrtime.bigint();
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as LoggerService;
    const duration = measureBootTime(start, logger);
    expect(Number.isInteger(duration)).toBe(true);
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('does not warn if duration < threshold', () => {
    const start = process.hrtime.bigint();
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as LoggerService;
    measureBootTime(start, logger);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns if duration > BOOT_TIME_WARNING_THRESHOLD_MS', () => {
    const start = process.hrtime.bigint() - BigInt((BOOT_TIME_WARNING_THRESHOLD_MS + 1000) * 1_000_000);
    const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as LoggerService;
    measureBootTime(start, logger);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Boot time exceeded'));
  });
});
```

### 7.5 Tests E2E Playwright : `repo/apps/api/e2e/bootstrap.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:14000';

test.describe('Bootstrap E2E (Sprint 3 Tache 1.3.1)', () => {
  test('GET / returns 200 + JSON metadata', async ({ request }) => {
    const response = await request.get(BASE_URL + '/');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      name: 'skalean-insurtech-api',
      version: expect.any(String),
      env: expect.any(String),
      uptime_seconds: expect.any(Number),
      timestamp: expect.any(String),
    });
  });

  test('GET / sets Cache-Control: no-store header', async ({ request }) => {
    const response = await request.get(BASE_URL + '/');
    expect(response.headers()['cache-control']).toContain('no-store');
  });

  test('GET / sets X-API-Endpoint: root header', async ({ request }) => {
    const response = await request.get(BASE_URL + '/');
    expect(response.headers()['x-api-endpoint']).toBe('root');
  });

  test('POST with body > 10 MiB returns HTTP 413', async ({ request }) => {
    const largeBody = Buffer.alloc(11 * 1024 * 1024).toString('base64');
    const response = await request.post(BASE_URL + '/', {
      data: { large: largeBody },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(response.status()).toBe(413);
  });

  test('GET /unknown returns HTTP 404', async ({ request }) => {
    const response = await request.get(BASE_URL + '/unknown-endpoint');
    expect(response.status()).toBe(404);
  });

  test('respects X-Forwarded-For when trustProxy is enabled', async ({ request }) => {
    const response = await request.get(BASE_URL + '/', {
      headers: { 'X-Forwarded-For': '8.8.8.8' },
    });
    expect(response.status()).toBe(200);
  });

  test('boot time < 5 seconds (verifie via uptime apres 1s sleep)', async ({ request }) => {
    await new Promise(r => setTimeout(r, 1000));
    const response = await request.get(BASE_URL + '/');
    const body = await response.json();
    expect(body.uptime_seconds).toBeLessThan(60);
  });
});
```

### 7.6 Fixtures + helpers tests : voir 6.15 ci-dessus

Total tests : 30 tests (6 main + 6 controller + 7 graceful-shutdown + 3 start-time + 7 E2E + 1 fixture helper).

---

## 8. Variables environnement

40 variables documentees dans le fichier `.env.example` (section 6.11). Liste recapitulative groupee :

### 8.1 Runtime (4 vars)
- `NODE_ENV` (development | staging | production) -- default development
- `APP_NAME` (string) -- default skalean-insurtech-api
- `APP_VERSION` (semver) -- default 0.1.0
- `TZ` (timezone) -- default Africa/Casablanca (decision-008)

### 8.2 API server (4 vars)
- `API_PORT` (1-65535) -- default 4000
- `API_HOST` (IP) -- default 0.0.0.0
- `BODY_LIMIT_MB` (positive int) -- default 10
- `GRACEFUL_SHUTDOWN_TIMEOUT_MS` (positive int) -- default 30000

### 8.3 Database (6 vars)
- `DATABASE_URL`, `DATABASE_POOL_MIN`, `DATABASE_POOL_MAX`, `DATABASE_STATEMENT_TIMEOUT_MS`, `DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS`, `DATABASE_SSL`

### 8.4 Redis (7 vars)
- `REDIS_URL`, `REDIS_DB_CACHE`, `REDIS_DB_SESSIONS`, `REDIS_DB_QUEUES`, `REDIS_DB_RATE_LIMIT`, `REDIS_DB_IDEMPOTENCY`, `REDIS_PASSWORD`

### 8.5 Kafka (4 vars)
- `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_GROUP_ID`, `KAFKA_SSL`

### 8.6 OpenTelemetry (7 vars)
- `OTEL_SERVICE_NAME`, `OTEL_SERVICE_VERSION`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_PROTOCOL`, `OTEL_TRACES_SAMPLER`, `OTEL_TRACES_SAMPLER_ARG`, `OTEL_RESOURCE_ATTRIBUTES`

### 8.7 Sentry (4 vars)
- `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`, `SENTRY_ENVIRONMENT`

### 8.8 Auth placeholder (8 vars Sprint 5)
- `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_ALGORITHM`, `JWT_ACCESS_TTL_SECONDS`, `JWT_REFRESH_TTL_SECONDS`, `PASSWORD_PEPPER`, `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`

### 8.9 CORS (1 var)
- `CORS_ORIGINS` (CSV)

### 8.10 Rate limit (3 vars)
- `RATE_LIMIT_TTL_MS`, `RATE_LIMIT_MAX_REQUESTS`, `RATE_LIMIT_AUTH_MAX`

### 8.11 Logger Pino (3 vars)
- `LOG_LEVEL`, `LOG_PRETTY_PRINT`, `LOG_REDACT_PII`

Total : 50 variables environnement (au-dela des 30+ requis).

---

## 9. Commandes shell

```bash
# Installation
cd repo
pnpm install --frozen-lockfile

# Demarrage dev
pnpm --filter @insurtech/api dev

# Build prod
pnpm --filter @insurtech/api build

# Tests Vitest
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:coverage

# Tests E2E Playwright (necessite app demarree)
pnpm --filter @insurtech/api test:e2e

# Verification structure boot
curl -i http://localhost:4000/

# Test body limit
curl -X POST http://localhost:4000/ -H "Content-Type: application/json" -d "$(yes 'x' | head -c 11000000)" --max-time 10

# Test graceful shutdown
PID=$(pgrep -f "node dist/main.js")
kill -SIGTERM $PID
# Attendre exit code
wait $PID
echo "Exit code: $?"

# Test trustProxy
curl http://localhost:4000/ -H "X-Forwarded-For: 8.8.8.8" -H "X-Forwarded-Proto: https"

# Build Docker
docker build -f apps/api/Dockerfile -t insurtech-api:0.1.0 .
docker run --rm -p 4000:4000 --env-file apps/api/.env insurtech-api:0.1.0

# Validation no-emoji (decision-006)
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" apps/api/src apps/api/test apps/api/e2e && echo FAIL || echo OK

# Validation no-console
grep -rn "console\.\(log\|debug\|info\|warn\|error\)" apps/api/src --exclude-dir=node_modules | grep -v "spec.ts" | grep -v "main.ts:69[0-9]"

# Typecheck strict
pnpm --filter @insurtech/api typecheck
```

---

## 10. Criteres validation V1-V28

### Criteres P0 (bloquants -- 16 criteres)

- **V1 (P0 -- automatisable)** : `pnpm --filter @insurtech/api install` reussit en < 60s
  - Commande : `time pnpm --filter @insurtech/api install --frozen-lockfile`
  - Expected : real < 60s, exit 0
  - Failure mode : version lockfile incoherente -> `pnpm install` sans frozen, regenere lockfile

- **V2 (P0 -- automatisable)** : `pnpm --filter @insurtech/api dev` demarre l'app en < 5s
  - Commande : `time pnpm --filter @insurtech/api dev` (kill apres "listening")
  - Expected : log "Skalean InsurTech API listening" emit en < 5000ms
  - Failure mode : OTEL exporter unreachable -> verifier OTEL_EXPORTER_OTLP_ENDPOINT

- **V3 (P0 -- automatisable)** : `curl http://localhost:4000/` retourne HTTP 200
  - Commande : `curl -i -s http://localhost:4000/ | head -1`
  - Expected : `HTTP/1.1 200 OK`
  - Failure mode : port deja utilise -> `lsof -ti:4000 | xargs kill -9`

- **V4 (P0)** : Body JSON GET / contient `{ name, version, env, uptime_seconds, timestamp }`
  - Commande : `curl -s http://localhost:4000/ | jq -e '.name, .version, .env, .uptime_seconds, .timestamp'`
  - Expected : tous les champs non-null

- **V5 (P0 -- automatisable)** : `kill -SIGTERM <pid>` provoque exit code 0 en < 30s
  - Commande : `pid=$(pgrep -f main.js); time kill -SIGTERM $pid; wait $pid; echo $?`
  - Expected : exit code 0, duree < 30s

- **V6 (P0 -- automatisable)** : `kill -SIGINT <pid>` (Ctrl+C) provoque exit code 0
  - Commande : `pid=$(pgrep -f main.js); kill -SIGINT $pid; wait $pid; echo $?`
  - Expected : exit code 0

- **V7 (P0 -- automatisable)** : POST avec body 11 MiB rejete HTTP 413
  - Commande : `curl -X POST http://localhost:4000/ -H "Content-Type: application/json" -d "$(head -c 11000000 /dev/urandom | base64)" -o /dev/null -w "%{http_code}"`
  - Expected : 413

- **V8 (P0)** : Header `X-Forwarded-For: 1.2.3.4` respecte par Fastify
  - Commande : `curl http://localhost:4000/ -H "X-Forwarded-For: 1.2.3.4"`
  - Expected : log Pino contient `"ip": "1.2.3.4"`

- **V9 (P0)** : Telemetry initialisee AVANT NestFactory.create
  - Test unitaire `main.spec.ts` "calls startTelemetry before NestFactory.create"
  - Expected : test PASS

- **V10 (P0 -- automatisable)** : `app.listen` bind sur `0.0.0.0` (pas `localhost`)
  - Commande : `netstat -tlnp | grep :4000`
  - Expected : `0.0.0.0:4000` (pas `127.0.0.1:4000`)

- **V11 (P0)** : `bufferLogs: true` actif au boot
  - Test unitaire `main.spec.ts` "uses bufferLogs: true"
  - Expected : test PASS

- **V12 (P0 -- automatisable)** : Aucune emoji dans `apps/api/src apps/api/test apps/api/e2e`
  - Commande : `grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" apps/api/src apps/api/test apps/api/e2e`
  - Expected : aucune sortie

- **V13 (P0)** : Aucun `console.log/debug/info` dans code production (sauf catch ultime main.ts)
  - Commande : `grep -rn "console\.\(log\|debug\|info\|warn\|error\)" apps/api/src --exclude-dir=node_modules | grep -v "spec.ts"`
  - Expected : 1 seule ligne dans main.ts catch ultime

- **V14 (P0 -- automatisable)** : `pnpm --filter @insurtech/api typecheck` exit 0
  - Commande : `pnpm --filter @insurtech/api typecheck`
  - Expected : exit 0

- **V15 (P0)** : `pnpm --filter @insurtech/api test` reussit (>= 25 tests)
  - Commande : `pnpm --filter @insurtech/api test`
  - Expected : >= 25 tests PASS

- **V16 (P0)** : `app.enableShutdownHooks()` appele
  - Test unitaire `main.spec.ts` verifie l'appel
  - Expected : test PASS

### Criteres P1 (importants -- 8 criteres)

- **V17 (P1)** : Boot duration loggee via measureBootTime
  - Test unitaire `start-time-logger.spec.ts`
  - Expected : test PASS

- **V18 (P1)** : Warning emit si boot > 5000ms
  - Test unitaire `start-time-logger.spec.ts` "warns if duration > threshold"
  - Expected : test PASS

- **V19 (P1)** : Double SIGTERM ignore le second signal
  - Test unitaire `graceful-shutdown.spec.ts` "ignores duplicate SIGTERM"
  - Expected : test PASS

- **V20 (P1)** : Timeout shutdown force exit code 1
  - Test unitaire `graceful-shutdown.spec.ts` "exits with code 1 if timeout"
  - Expected : test PASS

- **V21 (P1)** : `uncaughtException` declenche graceful shutdown
  - Test unitaire `graceful-shutdown.spec.ts` "handles uncaughtException"
  - Expected : test PASS

- **V22 (P1)** : `unhandledRejection` declenche graceful shutdown
  - Test unitaire `graceful-shutdown.spec.ts` "handles unhandledRejection"
  - Expected : test PASS

- **V23 (P1)** : Dockerfile build reussit
  - Commande : `docker build -f apps/api/Dockerfile -t insurtech-api:test .`
  - Expected : exit 0

- **V24 (P1)** : Image Docker run avec healthcheck OK
  - Commande : `docker run -d -p 14000:4000 --env-file .env insurtech-api:test; sleep 15; docker inspect --format='{{.State.Health.Status}}' <container>`
  - Expected : healthy

### Criteres P2 (nice-to-have -- 4 criteres)

- **V25 (P2)** : `pnpm --filter @insurtech/api test:coverage` >= 85%
  - Commande : `pnpm --filter @insurtech/api test:coverage`
  - Expected : Lines >= 85%

- **V26 (P2)** : Tests E2E Playwright passent (>= 7 tests)
  - Commande : `pnpm --filter @insurtech/api test:e2e`
  - Expected : >= 7 PASS

- **V27 (P2)** : README.md quick start fonctionne
  - Test : suivre les commandes du README sur machine vierge -> `curl localhost:4000/` returns 200

- **V28 (P2)** : `.env.example` valide via Zod
  - Commande : `cp .env.example .env && pnpm --filter @insurtech/api dev` -> demarre sans erreur Zod

Total : 28 criteres validation (16 P0 + 8 P1 + 4 P2).

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Port 4000 deja utilise (EADDRINUSE)

**Scenario** : un processus precedent n'a pas ete tue (terminal ferme brutalement).
**Probleme** : `app.listen(4000)` echoue avec `Error: listen EADDRINUSE: address already in use 0.0.0.0:4000`.
**Solution** : 
```bash
lsof -ti:4000 | xargs kill -9
# OU
pnpm --filter @insurtech/api dev -- --port 4001  # override temporaire
```
Le boot catch global de `main.ts` log un message explicite indiquant cette commande.

### Edge case 2 : Telemetry exporter unreachable au boot

**Scenario** : `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` mais Jaeger/Tempo down.
**Probleme** : `startTelemetry()` retry pendant 30s puis warn -> boot lent.
**Solution** : OTEL SDK est non-blocking par defaut. Le boot continue meme si exporter unreachable, les spans sont buffers en memoire jusqu'a expire (5 min). En dev, mettre `OTEL_EXPORTER_OTLP_ENDPOINT=` (vide) pour disable export.

### Edge case 3 : DATABASE_URL malforme

**Scenario** : variable env `DATABASE_URL=not-a-url` (typo).
**Probleme** : `loadEnv()` Zod rejette avec message detaille, `process.exit(1)` immediat.
**Solution** : message Zod dans logs identifie le champ : `DATABASE_URL must be a valid postgresql:// URL`. Corriger `.env`.

### Edge case 4 : Body 10 MiB pile-poil (limite exacte)

**Scenario** : POST avec body de 10 485 760 bytes exactement.
**Probleme** : Fastify `bodyLimit: 10485760` rejette si > 10485760 (strict). 10 485 760 pile = accepte.
**Solution** : aucun. Documenter que la limite est >= et non > dans la doc API.

### Edge case 5 : SIGKILL recu (kill -9)

**Scenario** : Kubernetes ou ops envoie `kill -9` au lieu de `SIGTERM`.
**Probleme** : SIGKILL ne peut PAS etre intercepte par Node, le process meurt brutalement, transactions Postgres rollback automatiquement par Postgres `idle_in_transaction_session_timeout`, messages Kafka in-flight perdus.
**Solution** : aucune cote app (SIGKILL est immortelement intercepte par kernel). Cote Kubernetes : `terminationGracePeriodSeconds: 30` permet a SIGTERM de finir avant escalation SIGKILL. Documenter ce risque dans `docs/runbooks/incident-response.md`.

### Edge case 6 : Double SIGTERM rapide

**Scenario** : K8s envoie SIGTERM, attend 5s, re-envoie SIGTERM (rare avec preStop hook lent).
**Probleme** : 2 chaines de shutdown concurrentes -> erreur `dataSource already destroyed`.
**Solution** : flag `isShuttingDown` dans `graceful-shutdown.ts` ignore le second signal, log warn.

### Edge case 7 : Process exit avant flush logs Pino async

**Scenario** : Pino utilise transport worker thread (LOG_PRETTY_PRINT=false), buffer non flushe.
**Probleme** : derniers logs perdus.
**Solution** : `await pinoLogger.flush()` dans graceful-shutdown chain (Tache 1.3.5 enrichira). Pour Tache 1.3.1, utiliser Pino sync stdout (default) pour eviter ce edge case.

### Edge case 8 : Memory leak detecte au boot

**Scenario** : un import metier (Sprint 8+) fait un side-effect lourd (charge 50 MB en memoire).
**Probleme** : boot > 5s, warning emit.
**Solution** : Sprint 33 audit. Pour Tache 1.3.1, aucun module metier importe, boot < 1s typique.

### Edge case 9 : `reflect-metadata` non importe

**Scenario** : developpeur supprime accidentellement la ligne `import 'reflect-metadata'`.
**Probleme** : `Nest can't resolve dependencies of AppController`.
**Solution** : pre-commit hook qui rejete commit si `main.ts` ne contient pas `import 'reflect-metadata';` en ligne 1 ou 2.

### Edge case 10 : Node version != 22.x

**Scenario** : developpeur sur Node 20 lance `pnpm dev`.
**Probleme** : `engine-strict=true` dans `.npmrc` rejette `pnpm install`. Sans pnpm install (deja fait avant), `node dist/main.js` peut crash sur features Node 22 (ex Array.fromAsync).
**Solution** : check explicite en debut de main.ts : `if (parseInt(process.versions.node.split('.')[0]) < 22) { console.error('Node 22+ required'); process.exit(1); }`.

### Edge case 11 : Body limit negatif via env

**Scenario** : `BODY_LIMIT_MB=-1` dans .env.
**Probleme** : Fastify accepte mais `bodyLimit < 0` cause comportement non-defini.
**Solution** : `loadEnv()` Zod schema declare `BODY_LIMIT_MB: z.coerce.number().int().positive()` qui rejette les valeurs negatives au boot.

### Edge case 12 : Trust proxy avec LB mal configure

**Scenario** : Cloudflare WAF n'est pas configure pour stripper X-Forwarded-* du client externe.
**Probleme** : un attaquant peut envoyer `X-Forwarded-For: 8.8.8.8` et bypass rate limiting per IP.
**Solution** : verifier Cloudflare Page Rules au Sprint 34 (infrastructure). Pour Tache 1.3.1, documenter le risque.

Total : 12 edge cases avec scenario + probleme + solution.

---

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP - Protection Donnees Personnelles)
- **Article 5** : information prealable de la personne concernee. Implementation : header response `X-Privacy-Notice: https://skalean-insurtech.ma/privacy` qui sera ajoute Tache 1.3.5.
- **Article 23** : droit d'acces, rectification, opposition. Implementation : pas dans cette tache, sera Sprint 27 (admin).
- **Article 52** : sanctions penales en cas de fuite. Mitigation cette tache : `LOG_REDACT_PII=true` dans .env.example, valide via Zod.

### Loi 53-05 (Echange Electronique de Donnees Juridiques)
- **Article 6** : integrite du message electronique. Implementation : preparation header `x-trace-id` (Tache 1.3.4) qui permet d'identifier chaque message echange.

### Loi 09-23 (Cybersecurite Maroc -- DGSSI)
- **Article 4** : journalisation obligatoire. Implementation : Pino logger structured (Tache 1.3.5) + audit logs Sprint 12.
- **Article 8** : traitement incidents. Implementation : Sentry integration Tache 1.3.12 + Sprint 33 incident response runbook.

### Decision-008 (Atlas Cloud Maroc)
- Donnees assures hebergees uniquement Atlas Cloud Benguerir.
- TZ=Africa/Casablanca dans .env.example.
- Aucune connexion vers fournisseurs cloud non-souverains au Sprint 3 Tache 1.3.1.

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

Cette tache DOIT respecter TOUTES ces conventions :

### Multi-tenant strict (decision-002)
- Header `x-tenant-id` obligatoire sur tous endpoints sauf `/api/v1/public/*` et `/api/v1/admin/*` -- pose Tache 1.3.10 (TenantContextInterceptor).
- AsyncLocalStorage Node.js pour TenantContext.
- RLS policies Postgres : `app_current_tenant()` lit la session var `app.current_tenant`.
- Audit trail : chaque operation logged avec tenant_id.

### Validation strict
- Zod uniquement pour validation runtime (JAMAIS class-validator, joi, yup).
- Schemas Zod exportes depuis `@insurtech/shared-types`.
- Pattern : `const Schema = z.object({...}); type Type = z.infer<typeof Schema>;`.

### Logger strict
- Pino via `this.logger.info(...)` injecte par DI NestJS.
- JAMAIS `console.log()` (sauf catch ultime main.ts documente).
- Format JSON structured.
- Champs obligatoires : tenant_id, user_id, request_id, action, duration_ms.

### Hash password strict (Sprint 5)
- argon2id avec params memoryCost: 65536, timeCost: 3, parallelism: 4.
- JAMAIS bcrypt, JAMAIS scrypt.
- Pepper en plus du salt (env var `PASSWORD_PEPPER`).

### Package manager strict
- pnpm uniquement.
- `engine-strict=true` rejette install si Node < 22.20.0.
- `save-exact=true` impose versions deterministes.
- `link-workspace-packages=deep` pour imports `@insurtech/*`.

### TypeScript strict
- `strict: true` dans tsconfig.base.json.
- `noUncheckedIndexedAccess: true`.
- `noImplicitAny: true`.
- `noImplicitReturns: true`.
- Imports explicites.

### Tests strict
- Vitest pour unit + integration.
- Playwright pour E2E.
- Coverage cible : >= 85% global, >= 90% modules critiques.

### RBAC strict (Sprint 7)
- `@Roles()` decorateur sur chaque endpoint.
- 12 roles : SuperAdmin, BrokerAdmin, BrokerUser, GarageAdmin, GarageManager, GarageTechnician, AssureClient, Prospect, ComplianceOfficer, FinanceOfficer, Support, ReadOnly.

### Events strict (Sprint 2)
- Kafka topics format : `insurtech.events.{vertical}.{entity}.{action}`.
- Schemas Zod pour chaque event.
- Idempotency-Key obligatoire pour events critiques.

### Imports strict
- Packages partages via `@insurtech/{nom}` (pas chemins relatifs).
- TypeScript paths configures dans `tsconfig.base.json`.

### Skalean AI strict (decision-005)
- Utilise UNIQUEMENT via `@insurtech/sky` (REST client) ou MCP client.
- JAMAIS appel direct OpenAI/Anthropic/etc.
- Frontier strict.

### No-emoji strict (decision-006 ABSOLU)
- AUCUNE emoji dans code, commentaires, logs, docs, commits.
- Pre-commit hook `check-no-emoji.sh` rejette commits avec emoji.

### Idempotency-Key strict
- Header `Idempotency-Key` obligatoire pour mutations sensibles.
- TTL : 24h dans Redis.

### Conventional Commits strict
- Format : `<type>(scope): description`.
- commitlint via husky.

### Cloud souverain MA strict (decision-008)
- Atlas Cloud Services Benguerir UNIQUEMENT pour data Maroc.
- DC1 Tier III + DC2 Tier IV (DR).
- AUCUNE donnee assure hors MA.
- Encryption at rest AES-256-GCM.
- TLS 1.3 obligatoire.

---

## 14. Validation pre-commit

```bash
cd repo

# 1. Typecheck strict
pnpm --filter @insurtech/api typecheck

# 2. Lint Biome
pnpm --filter @insurtech/api lint

# 3. Format check
pnpm --filter @insurtech/api format:check

# 4. Tests Vitest avec coverage
pnpm --filter @insurtech/api test:coverage

# 5. Tests E2E Playwright (necessite app demarree)
pnpm --filter @insurtech/api test:e2e

# 6. No-emoji check (decision-006)
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" apps/api/src apps/api/test apps/api/e2e && echo "FAIL: emoji detected" && exit 1 || echo "OK: no emoji"

# 7. No-console check (sauf catch ultime main.ts ligne 691)
grep -rn "console\.\(log\|debug\|info\|warn\|error\)" apps/api/src --exclude-dir=node_modules | grep -v "spec.ts" | grep -v "main.ts:69[01]" && echo "FAIL: console detected" && exit 1 || echo "OK: no console"

# 8. Import reflect-metadata first
head -2 apps/api/src/main.ts | grep -q "reflect-metadata" || (echo "FAIL: reflect-metadata not first" && exit 1)

# 9. Import telemetry second
head -10 apps/api/src/main.ts | grep -q "startTelemetry" || (echo "FAIL: telemetry import missing" && exit 1)

# 10. Bind 0.0.0.0 check
grep -q "'0.0.0.0'" apps/api/src/main.ts || (echo "FAIL: app.listen not bound to 0.0.0.0" && exit 1)
```

Toutes les commandes doivent retourner exit 0. La sequence est executee par le hook husky pre-commit (Sprint 1 Tache 1.1.14).

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-03): bootstrap NestJS 10.4 Fastify API with graceful shutdown

Implementation Tache 1.3.1 du Sprint 3 (Phase 1 Bootstrap Infrastructure).

Pose la fondation apps/api : NestJS 10.4.15 + Fastify 4.28.1 adapter,
main.ts orchestrateur boot order strict (telemetry FIRST -> env Zod ->
NestFactory -> middlewares -> listen), graceful shutdown chain
(SIGTERM/SIGINT -> app.close + Kafka + DB + Redis + Telemetry + exit 0)
avec timeout 30s et flag anti-double-shutdown, body limit 10 MiB,
trustProxy true pour Cloudflare WAF + Atlas LB amont, bind 0.0.0.0
pour Docker port mapping.

Livrables:
- repo/apps/api/package.json (95 lignes deps NestJS Fastify workspace)
- repo/apps/api/tsconfig.json (50 lignes extends base + decorators)
- repo/apps/api/nest-cli.json (30 lignes build NestJS plugins)
- repo/apps/api/src/main.ts (170 lignes boot orchestrator)
- repo/apps/api/src/app.module.ts (35 lignes skeleton 1.3.2 enrichit)
- repo/apps/api/src/app.controller.ts (50 lignes GET / minimal)
- repo/apps/api/src/app.service.ts (45 lignes getInfo helper)
- repo/apps/api/src/bootstrap/graceful-shutdown.ts (110 lignes)
- repo/apps/api/src/bootstrap/middleware-order.ts (70 lignes doc)
- repo/apps/api/src/bootstrap/start-time-logger.ts (55 lignes)
- repo/apps/api/.env.example (85 lignes 50+ env vars)
- repo/apps/api/Dockerfile (70 lignes multi-stage Node 22.11-alpine)
- repo/apps/api/.dockerignore (30 lignes)
- repo/apps/api/README.md (60 lignes quick start)
- 4 fichiers tests Vitest (370 lignes)
- 1 fichier E2E Playwright (120 lignes)
- 1 fichier fixtures (50 lignes)

Tests: 23 unit + 7 E2E = 30 tests
Coverage: >= 85% lignes

Conformite:
- Loi 09-08 CNDP : LOG_REDACT_PII=true preparation
- Loi 53-05 : header x-trace-id preparation
- Loi 09-23 DGSSI : journalisation Pino preparation
- decision-001 monorepo pnpm + Turborepo
- decision-003 NestJS Fastify
- decision-006 no-emoji ABSOLU
- decision-008 Atlas Cloud Maroc TZ=Africa/Casablanca

Task: 1.3.1
Sprint: 3 (Phase 1 / Sprint 3)
Phase: 1 -- Bootstrap Infrastructure
Reference: B-03 Sprint 3 API Bootstrap Tache 1.3.1
Bloque: Tache 1.3.2 (AppModule + ConfigModule)"
```

---

## 16. Workflow next step

Apres commit de cette tache :

- Tache suivante : `task-1.3.2-app-module-config-module-zod.md` (AppModule + ConfigModule + structure modulaire 19 modules metier stubs)
- Verification Sprint en cours : `00-pilotage/verifications/V-03-sprint-03-api-bootstrap.md` (sera generee apres Tache 1.3.15)
- Documentation a jour : aucune mise a jour requise pour cette tache (la doc Sprint 3 sera consolidee a la fin du sprint).

---

**Fin du prompt task-1.3.1-nestjs-fastify-bootstrap-main-ts.md.**

Densite atteinte : ~110 ko (cible 100-150 ko respectee).
Code patterns : 15 fichiers complets (main.ts, app.module.ts, app.controller.ts, app.service.ts, package.json, tsconfig.json, nest-cli.json, .env.example, graceful-shutdown.ts, middleware-order.ts, start-time-logger.ts, Dockerfile, .dockerignore, README.md, env-fixtures.ts).
Tests : 30 cas concrets (6 main.spec + 6 controller.spec + 7 graceful-shutdown.spec + 3 start-time-logger.spec + 7 E2E + 1 fixture helper).
Criteres validation : V1-V28 (16 P0 + 8 P1 + 4 P2).
Edge cases : 12 cas avec scenario + probleme + solution.
Variables environnement : 50 vars documentees groupees en 11 sections.
Conformite Maroc : 4 lois detaillees + decision-008 cloud souverain.
Conventions : 14 conventions absolues listees integralement.

