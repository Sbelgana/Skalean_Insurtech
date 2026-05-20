# Known Issues

## Bitnami Docker Images Deprecation (Mai 2026)

**Status** : RESOLVED

**Probleme** : Bitnami a deprecate les images sous le namespace `bitnami/*` mid-2025. Les tags publies avant cette date restent dans `bitnami/*` pour quelques temps, mais les nouveaux tags et certains anciens disparaissent. `docker pull bitnami/kafka:3.7.1` renvoie "manifest not found".

**Solution appliquee** : Migration vers le namespace `bitnamilegacy/*` qui heberge la copie 1:1 des images Bitnami pour la compatibilite retroactive.

**Fichiers modifies** :
- `infra/docker-compose.test.yaml` (kafka: `bitnami/kafka:3.7` -> `bitnamilegacy/kafka:3.7.1`)
- `infrastructure/docker/docker-compose.dev.yaml` (kafka + kafka-init-topics : `bitnami/kafka:3.7.1` -> `bitnamilegacy/kafka:3.7.1`)
- `infrastructure/docker/docker-compose.test.yaml` (kafka : `bitnami/kafka:3.7.1` -> `bitnamilegacy/kafka:3.7.1`)
- `.github/workflows/ci.yaml` (kafka service : `bitnami/kafka:3.7.1` -> `bitnamilegacy/kafka:3.7.1`)

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).

**Considerations long terme** : a moyen terme, evaluer migration vers les images officielles upstream :
- `bitnamilegacy/kafka` -> `apache/kafka` (config env vars completement differente)
- `bitnamilegacy/postgresql` -> `postgres` (officiel, deja utilise dans nos composes)
- `bitnamilegacy/redis` -> `redis` (officiel, deja utilise dans nos composes)
- `bitnamilegacy/minio` -> `minio/minio` (officiel, deja utilise dans nos composes)

Cette migration necessitera ajustement des variables environnement (Bitnami utilise des conventions specifiques `KAFKA_CFG_*` versus apache `KAFKA_*`).

## MinIO mc Client -- Tag pinne RELEASE.2024-11-07 disparu (Mai 2026)

**Status** : RESOLVED

**Probleme** : `docker pull minio/mc:RELEASE.2024-11-07T00-52-20Z` renvoie "manifest not found". L'image serveur (`minio/minio` au meme tag) reste disponible.

**Solution appliquee** : Switch vers `minio/mc:latest` pour le container `minio-init-buckets`. C'est un init container ephemere qui execute juste `mc mb` une fois ; le tag `:latest` n'introduit pas de risque de reproducibilite pour la fonction qu'il execute, et le serveur MinIO lui reste pinne.

**Fichiers modifies** :
- `infrastructure/docker/docker-compose.dev.yaml` (minio-init-buckets : `minio/mc:RELEASE.2024-11-07T00-52-20Z` -> `minio/mc:latest`)

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).

## pg CJS named import in ESM modules (Mai 2026)

**Status** : RESOLVED

**Probleme** : `import { Pool, Client } from 'pg'` echoue au runtime dans les packages ayant `"type": "module"` :
```
SyntaxError: The requested module 'pg' does not provide an export named 'Pool'
```
Le package `pg` est CJS ; Node ESM ne peut pas resoudre statiquement les named exports d'un module CJS.

**Solution appliquee** : pattern default-import + destructuring :
```typescript
import pg from 'pg';
const { Pool } = pg;
// usage : new Pool(...) (value), let p: InstanceType<typeof Pool> (type)
```

**Fichiers modifies (8)** :
- `apps/platform/scripts/seed-dev.ts`
- `apps/platform/scripts/seed-reset.ts`
- `apps/platform/test/seeds/seeds.spec.ts`
- `apps/platform/test/seeds/faker-locale.spec.ts`
- `apps/platform/test/seeds/data-coherence.spec.ts`
- `infrastructure/scripts/__tests__/postgres-extensions.spec.ts`
- `infrastructure/scripts/__tests__/postgres-rls-helpers.spec.ts`
- `infrastructure/scripts/__tests__/postgres-roles.spec.ts`

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3), tests integration seeds.spec.ts.

## Vitest config split : unit vs integration (Mai 2026)

**Status** : RESOLVED

**Probleme** : `pnpm test` (config racine) faisait tourner les tests integration en PARALLELE (`singleFork: false`). Les fichiers `*.spec.ts` dans `test/integration/**` et `src/test/integration/**` tapaient tous la meme DB Postgres simultanement -> race conditions massives :
- `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`
- `relation "typeorm_metadata" already exists`
- `relation "auth_tenants" already exists`

**Solution appliquee** :
- `vitest.config.ts` racine : exclude `**/test/integration/**` et `**/src/test/integration/**` (unit tests parallel-safe uniquement)
- `packages/database/vitest.config.integration.ts` : `include` etendu pour couvrir LES DEUX scopes (`test/integration/**` ET `src/test/integration/**`), `singleFork: true`, `concurrent: false`
- `package.json` racine : `pnpm test:integration` execute via `turbo run test:integration --concurrency=1` (packages serialises)
- duplicate `test:integration` retire du `package.json` racine

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).

## Sprint 2 task 1.2.15 quality gate tests -- schema desync (Mai 2026)

**Status** : OPEN -- a fixer Sprint 3 hors-bande (1-2h estime)

**Probleme** : Les specs `packages/database/test/integration/*.spec.ts` (Sprint 2 quality gate, task 1.2.15, commit `a2d4a45`) referencent des noms de colonnes qui n'existent PAS dans le schema reel produit par les migrations Sprint 2 (tasks 1.2.2-1.2.8).

**Symptomes** : ~70 tests integration en `QueryFailedError: column "X" of relation "Y" does not exist`.

**Mismatches identifies** (echantillon) :

| Test attend | Schema reel | Fichier migration |
|---|---|---|
| `comm_messages.recipient` | `comm_messages.to_address` | `1735000000004-Communications.ts` |
| `comm_messages.body` | (n'existe pas, content via template) | id. |
| `comm_templates.code` | `comm_templates.name` | id. |
| `comm_templates.body` | `comm_templates.body_template` | id. |
| `doc_documents.kind` | `doc_documents.type` | `1735000000005-DocsPayments.ts` |
| `doc_documents.storage_uri` | `doc_documents.s3_bucket + s3_key` | id. |
| `pay_transactions.provider` | `pay_transactions.pay_method_id` (FK) | id. |
| `books_invoices.number` | `books_invoices.invoice_number` | `1735000000006-BooksCompliance.ts` |
| `booking_appointments.starts_at` | `booking_appointments.time_range tstzrange` | `1735000000003-Booking.ts` |
| `compliance_consent_logs.subject_id` | (a verifier) | `1735000000006-BooksCompliance.ts` |
| `analytics_events.event_type` | (a verifier) | `1735000000007-AnalyticsStockHr.ts` |
| `stock_items.quantity` | (a verifier) | id. |
| `hr_employees.email` | (a verifier) | id. |

**Cause racine** : Les specs Sprint 2 task 1.2.15 ont ete generes avec des assumptions de schema (probablement un ancien design Cowork) AVANT que les migrations finales (tasks 1.2.2-1.2.8) ne soient ecrites. Personne n'a jamais lance ces tests contre une vraie DB avant cette pause technique.

**Tests affectes** (16 fichiers):
- `test/integration/rls-multi-tenant.spec.ts` (la plupart des fails)
- `test/integration/migrations.spec.ts` (TC-MIG-09 EXCLUDE booking_appointments)
- `test/integration/rls-super-admin.spec.ts`
- `test/integration/subscribers-audit-log.spec.ts`
- `test/integration/subscribers-tenant-id.spec.ts`
- `test/integration/subscribers-timestamps.spec.ts`
- `test/integration/seeds.spec.ts`

**Plan de fix recommande Sprint 3 hors-bande** :
1. Lire chaque migration `1735000000003-Booking.ts` ... `1735000000007-AnalyticsStockHr.ts` et extraire le vrai schema
2. Reecrire les INSERT SQL dans `rls-multi-tenant.spec.ts` et autres specs pour matcher les colonnes reelles
3. Pour `booking_appointments` : remplacer `starts_at + ends_at` par `time_range tstzrange`
4. Pour `pay_transactions.provider` : creer prealablement un `pay_method` et utiliser son `pay_method_id`
5. Pour `comm_messages.recipient` : utiliser `to_address`
6. Pour `books_invoices.number` : utiliser `invoice_number` (verifier format CHECK constraint)
7. Re-lancer `pnpm test:integration` et iterer jusqu'a 0 fail

**Validation infrastructure confirmee** : les 8 migrations s'appliquent SANS erreur sur DB fresh (verifie par 112 tests passants sur `src/test/integration/migrations-*.spec.ts`). Le CODE Sprint 2 est OK, ce sont les TESTS quality gate qui sont desynchronises.

## Sprint 2 task 1.2.15 quality gate -- kafka-dlq.spec.ts logic broken (Mai 2026)

**Status** : OPEN -- a fixer Sprint 3 hors-bande (30-60 min estime)

**Probleme** : Le spec `packages/shared-events/test/integration/kafka-dlq.spec.ts` (TC-KAF-DLQ-01 a TC-KAF-DLQ-06) timeout sur `waitFor 45s` pour 6 des 9 fails shared-events integration.

**Cause racine** : Le test simule la logique DLQ MANUELLEMENT inline (lignes 40-77 : eachMessage handler qui incremente Redis counter puis route vers DLQ si count >= 3). Mais la logique est cassee :
1. Le test envoie UN message avec event-id unique
2. Le consumer le recoit UNE fois -> counter Redis = 1
3. Condition `count >= MAX_RETRIES` (1 >= 3) = FALSE -> pas de routage DLQ
4. Pas de commit offset, mais Kafka ne re-delivre PAS dans le meme run (sans rebalance/restart)
5. `waitFor` cherche le message en DLQ -> timeout 45s

Le test n'utilise PAS la vraie classe `KafkaConsumerBase` ni `dlq-publisher.service.ts` qui existent en production (commit `10f3afe` task 1.2.13). Il teste une simulation buggee, pas le vrai code.

**Production code Sprint 2 OK** : `dlq-publisher.service.ts` et `kafka-consumer.base.ts` sont testes par les 101 unit tests de `packages/shared-events` qui PASSENT tous (`pnpm test`).

**Plan de fix recommande Sprint 3 hors-bande** :
- Reecrire `kafka-dlq.spec.ts` pour instancier un vrai `KafkaConsumerBase` avec un handler qui throw, et observer la routage automatique vers le topic DLQ
- OU supprimer ce spec et le remplacer par un test sur `dlq-publisher.service.ts` qui mock la transport layer

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).

## Trigram performance test flaky -- Postgres planner sur tables vides (Mai 2026)

**Status** : KNOWN, low priority

**Probleme** : `packages/database/src/test/integration/trigram-performance.spec.ts` echoue avec :
```
expected 'Seq Scan on crm_companies' to match /idx_crm_companies_name_trgm|Bitmap Index Scan|Index Scan/
```

**Cause racine** : Le planner Postgres choisit `Seq Scan` plutot qu'un index scan quand la table contient tres peu de lignes (< quelques milliers). Le test execute `EXPLAIN` sur une table fraichement migree sans donnees.

**Plan de fix Sprint 3 hors-bande** : avant l'assertion EXPLAIN, inserer ~5000 lignes de donnees fictives dans `crm_companies` pour forcer le planner a utiliser l'index. Augmenter `random_page_cost` peut aussi aider.

**Decouvert lors** : validation Sprints 1+2 (pause technique entre Sprint 2 et Sprint 3).

## Sprint 3 apps/api -- Sentry profiling-node top-level import (Mai 2026)

**Status** : RESOLVED

**Probleme** : `apps/api/src/sentry/sentry.config.ts` faisait `import { nodeProfilingIntegration } from '@sentry/profiling-node'` au top du module. Le package charge un binary natif `sentry_cpu_profiler-<os>-<arch>-<abi>.node` a l'import time. Si l'ABI du Node runtime ne matche aucun binary bundle (par ex Node 25 ABI 141 vs versions 108/115/127 disponibles), crash au boot.

**Solution appliquee** : Convertir en dynamic `require()` a l'interieur de `initSentry()`, gated par `process.env.SENTRY_DSN`. Le package n'est charge qu'en production quand Sentry est explicitement active.

**Fichier modifie** : `apps/api/src/sentry/sentry.config.ts`

**Decouvert lors** : pause technique #2 (entre Sprint 4 et Sprint 5).

## Sprint 3 apps/api -- LoggerModule.exports invalid (Mai 2026)

**Status** : RESOLVED

**Probleme** : `LoggerModule` (Tache 1.3.3) declarait `exports: [Logger, PinoLogger]` ou Logger/PinoLogger sont des providers de `nestjs-pino`, PAS de LoggerModule. Au boot : `UnknownExportException: Nest cannot export a provider/module that is not a part of the currently processed module`.

**Solution appliquee** : Re-exporter le module entier `NestjsPinoModule` (transitive export resolution). Les consumers obtiennent Logger + PinoLogger via NestJS.

**Fichier modifie** : `apps/api/src/logger/logger.module.ts`

**Decouvert lors** : pause technique #2 (entre Sprint 4 et Sprint 5).

## Sprint 3 apps/api -- Fastify 4 vs plugins requirant Fastify 5 (Mai 2026)

**Status** : RESOLVED via pnpm overrides

**Probleme** : `apps/api` utilise `fastify@4.28.1` (NestJS Platform Fastify 10.x). Mais les versions latest des plugins `@fastify/*` requierent Fastify 5.x :
- `@fastify/static@9.x` (pulled par `@bull-board/fastify@7.1.5`)
- `@fastify/helmet@13.x`
- `@fastify/cors@11.x`
- `@fastify/compress@8.x`

Erreur boot : `FastifyError: fastify-plugin: @fastify/X - expected '5.x' fastify version, '4.28.1' is installed`.

**Solution appliquee** : Ajout de pnpm overrides dans `package.json` racine forcant les versions v4-compatibles :
```json
"pnpm": {
  "overrides": {
    "@fastify/static": "^7.0.4",
    "@fastify/helmet": "^11.1.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/compress": "^7.0.3"
  }
}
```

**Considerations long terme** : Sprint Phase 2 (Sprint 10+), evaluer migration Fastify 4 -> 5. Necessite revue NestJS Platform Fastify 11+ compat + bumper tous les plugins. Breaking changes signature plugin et hooks.

**Decouvert lors** : pause technique #2 (entre Sprint 4 et Sprint 5).

## Sprint 3 apps/api -- BullBoard fastify.register non catched (Mai 2026)

**Status** : SKIPPED (block disabled), TODO Sprint 5+

**Probleme** : `apps/api/src/main.ts` ligne 161-174 enroule `fastifyInstance.register(bullBoardAdapter.registerPlugin(), ...)` dans try/catch. Mais Fastify utilise avvio en interne avec resolution differree des plugins : `register()` enqueue le plugin et retourne avant l'erreur. L'erreur emerge plus tard via `process.processTicksAndRejections`, NON catched par le try/catch synchrone.

**Solution appliquee** : Le bloc est entoure de `if (false)` (skip) avec TODO comment. BullBoard UI sur `/admin/queues` reste non-fonctionnelle.

**Plan de fix Sprint 5+** : 
- Option A : Bumper Fastify 4 -> 5 (cf section precedente) ce qui permet `@fastify/static@9` + `@bull-board/fastify@7` natifs
- Option B : Downgrade `@bull-board/fastify` a une version compatible avec Fastify 4 + `@fastify/static@7`
- Option C : Implementer BullBoard via Express adapter au lieu de Fastify (necessite double HTTP server)

**Fichier modifie** : `apps/api/src/main.ts`

**Decouvert lors** : pause technique #2 (entre Sprint 4 et Sprint 5).

## Sprint 3 apps/api -- tsconfig paths pointed to src/ instead of dist/ (Mai 2026)

**Status** : RESOLVED

**Probleme** : `apps/api/tsconfig.json` `paths` aliases pointaient vers `packages/<name>/src/index.ts` au lieu de `packages/<name>/dist/index.d.ts`. Resultat : `tsc` essayait de compiler les sources des workspace packages comme partie integrante du build apps/api, declenchant `error TS6059: File '...' is not under 'rootDir' '...apps/api/src'`.

**Solution appliquee** : `paths` pointent maintenant vers `dist/index.d.ts` (declaration only, runtime via node_modules resolution standard).

**Fichier modifie** : `apps/api/tsconfig.json`

**Decouvert lors** : pause technique #2 (entre Sprint 4 et Sprint 5).

## Sprint 4 shared-ui -- jsx:preserve emits .jsx not consumable as .js (Mai 2026)

**Status** : RESOLVED

**Probleme** : `packages/shared-ui/tsconfig.json` avait `"jsx": "preserve"` qui emet des fichiers `.jsx` dans dist/. Mais `dist/index.js` (compile depuis `src/index.ts`) faisait `import './components/X.js'` (avec extension `.js`). Next.js bundler ne pouvait pas resoudre `.js` vers `.jsx` -> erreur `Module not found: Can't resolve './components/LocaleSwitcher.js'`.

**Solution appliquee** : Changer `jsx: preserve` -> `jsx: react-jsx` (modern JSX transform). Output : fichiers `.js` purs avec `import { jsx as _jsx } from "react/jsx-runtime"` injecte automatiquement. 48 components emis en `.js`.

**Note** : Apparait quelques warnings TS6133 "React declared but value never read" sur les fichiers qui font encore `import React from 'react'` (inutile avec react-jsx). Non-bloquant, dist est emit. A nettoyer Sprint 16+.

**Fichier modifie** : `packages/shared-ui/tsconfig.json`

**Decouvert lors** : pause technique #2 (entre Sprint 4 et Sprint 5).

## Sprint 4 shared-ui -- avatar.tsx createContext sans 'use client' (Mai 2026)

**Status** : RESOLVED (1 fichier), AUDIT A FAIRE (peut-etre d'autres)

**Probleme** : `packages/shared-ui/src/components/ui/avatar.tsx` utilise `React.createContext` sans la directive `'use client'` au top. Next.js RSC (Server Components) interdit `createContext` cote serveur -> `TypeError: createContext only works in Client Components`.

**Solution appliquee** : Ajout `'use client';` en premiere ligne de `avatar.tsx`.

**Audit a faire Sprint 16 pre-pause** : grep tous les composants shared-ui utilisant `createContext`, `useState`, `useEffect`, `useContext`, `useRef`, etc. sans `'use client'`. Liste actuelle (probable) :
- `packages/shared-ui/src/components/ui/avatar.tsx` (FIXED)
- Stories Storybook (non-utilisees en prod, OK)

**Fichier modifie** : `packages/shared-ui/src/components/ui/avatar.tsx`

**Decouvert lors** : pause technique #2 (entre Sprint 4 et Sprint 5).

## Sprint 4 frontends -- 404 routes locale apres clean cache (Mai 2026)

**Status** : INVESTIGATION REPORTEE pre-Sprint 16

**Probleme** : `apps/web-broker` compile via `pnpm dev`, mais les routes `/fr`, `/ar-MA`, `/ar` retournent 404 apres clean cache `.next/`. La middleware next-intl redirige `/` -> `/fr` correctement, et `/fr-MA` -> `/fr/fr-MA`, mais le rendu de `[locale]/page.tsx` echoue silencieusement (404 en 12-18ms, trop rapide pour un vrai rendu).

**Cause non identifiee** (candidats) :
- next-intl middleware config dans `apps/web-broker/src/middleware.ts`
- D'autres composants shared-ui sans `'use client'` (audit incomplet)
- Next 14 vs 15 compatibility
- `[locale]/layout.tsx` ligne 95-96 : `if (!routing.locales.includes(locale as ...)) notFound();` evaluation suspecte

**Plan de fix** : Pause technique #3 avant Sprint 16 (Web Broker App + Auth UI). A ce moment, les endpoints Auth Sprint 5 + CRM/Booking Sprint 8 seront dispo pour tester le frontend dans un contexte reel.

**Audit a faire pre-Sprint 16** :
1. Verifier `middleware.ts` next-intl pour chaque app (7 apps web-*)
2. Grep tous composants shared-ui utilisant `createContext|useState|useEffect|useContext|useRef` sans `'use client'`
3. Verifier `[locale]/layout.tsx` existe partout, et que `routing.locales` est correctement importe
4. Tester `pnpm build` (production) en plus de `pnpm dev` -- peut reveler bugs RSC supplementaires
5. Tester avec Next sans Turbopack (`--no-turbopack`) pour isoler bugs Turbopack vs Next standard

**Decouvert lors** : pause technique #2 (entre Sprint 4 et Sprint 5).

## Pause technique #2 environment -- Node 25 conflicting with Volta-22 (Mai 2026)

**Status** : WORKAROUND, NOT FIXED (env issue local user)

**Probleme** : Windows PATH contient `C:\Program Files\nodejs\node.exe` (Node 25.0.0 installation systeme) en parallele de `C:\Program Files\Volta\node.exe` (Volta shim resolvant a 22.22.1 via package.json volta config). Le shim Volta est en premier dans PATH bash mais quand `nest start --watch` spawn un child process via `child_process.spawn(cmd, { shell: true })`, cmd.exe fait son propre PATH lookup et peut prendre la mauvaise version (Node 25).

**Symptome** : `Sentry/profiling-node` binary `sentry_cpu_profiler-win32-x64-141.node` not found (Node 25 ABI 141 manquante).

**Workaround** : Boot direct via `"/c/Program Files/Volta/node" dist/main.js` au lieu de `pnpm dev`. Ce qui contourne le child_process spawn issue.

**Plan de fix** : Documenter dans `repo/CONTRIBUTING.md` que Node 25 doit etre desinstalle du chemin `C:\Program Files\nodejs\` OU placer Volta avant nodejs dans le Windows PATH systeme (regedit). Pas un bug du projet, juste du dev environment local.

**Decouvert lors** : pause technique #2 (entre Sprint 4 et Sprint 5).

## Sprint 4 frontends -- RSC icon serialization across server/client boundary (Mai 2026)

**Status** : RESOLVED

**Probleme** : Le layout racine `[locale]/layout.tsx` est un Server Component qui importait `brokerSidebarItems` / `garageSidebarItems` / `adminSidebarItems` / `garageMobileTabs` / `assureMobileTabs` depuis `@/config/`. Ces tableaux contiennent des objets avec `icon: LayoutDashboard` (composant React lucide-react). Le layout passait ces tableaux comme prop a `DashboardLayout` ou `MobileLayout` qui sont des Client Components (`'use client'`).

Next.js 15 RSC refuse :
```
Error: Functions cannot be passed directly to Client Components unless you 
explicitly expose it by marking it with "use server". Or maybe you meant 
to call this function rather than return it.
  {$$typeof: ..., render: function FileText}
```

Cause : les icones lucide-react sont des fonctions React (forwardRef). Les fonctions ne peuvent pas etre serialisees a travers la frontiere server/client. Resultat : pages `/fr`, `/ar`, `/ar-MA` retournent 500 au compile / 404 apres cache clean.

**Solution appliquee** : Pattern "Client Shell Wrapper".

Cree pour chaque app un Client Component intermediaire (`'use client'`) qui :
1. Importe les sidebar/tabs items DANS le client world (icons restent en client)
2. Rend `DashboardLayout` ou `MobileLayout` avec les items
3. Accepte uniquement `children` comme prop (serialisable)

Le Server Component (`layout.tsx`) importe juste ce wrapper et lui passe `children`. Aucune fonction ne traverse la frontiere.

**Fichiers crees (5)** :
- `apps/web-broker/src/components/dashboard-shell.tsx` (broker)
- `apps/web-garage/src/components/dashboard-shell.tsx` (garage)
- `apps/web-insurtech-admin/src/components/dashboard-shell.tsx` (admin)
- `apps/web-garage-mobile/src/components/mobile-shell.tsx` (garage mobile)
- `apps/web-assure-mobile/src/components/mobile-shell.tsx` (assure mobile)

**Fichiers modifies (5)** :
- `apps/web-broker/src/app/[locale]/layout.tsx`
- `apps/web-garage/src/app/[locale]/layout.tsx`
- `apps/web-insurtech-admin/src/app/[locale]/layout.tsx`
- `apps/web-garage-mobile/src/app/[locale]/layout.tsx`
- `apps/web-assure-mobile/src/app/[locale]/layout.tsx`

**Apps deja correctes** :
- `web-customer-portal` : utilise `PublicLayout` sans icones, OK
- `web-assure-portal` : utilise `SelfServiceLayout` sans sidebar items, OK

**Validation** : 7/7 apps frontend en dev mode renvoient `/fr` -> HTTP 200 :
- web-insurtech-admin :3000
- web-broker :3001
- web-garage :3002
- web-garage-mobile :3003
- web-customer-portal :3004
- web-assure-portal :3005
- web-assure-mobile :3006

**Decouvert lors** : pause technique #2 bis (entre Sprint 4 et Sprint 5).

## Sprint 4 frontends -- @vercel/og Invalid URL on Windows production build (Mai 2026)

**Status** : OPEN -- production build only, dev mode OK

**Probleme** : `pnpm build` (production) echoue sur le route `/icon` (Next.js dynamic icon via `next/og`) :
```
Error occurred prerendering page "/icon".
TypeError: Invalid URL
    at new URL (node:internal/url:828:25)
    at fileURLToPath (node:internal/url:1609:12)
    at file:///C:/.../next/dist/compiled/@vercel/og/index.node.js:18929:32
```

Cause : @vercel/og (bundle dans Next 15) appelle `fileURLToPath()` sur quelque chose qui n'est pas un valid file URL au moment de la generation statique de la page icon. Probleme Windows-specifique (separateurs path) ou cas particulier @vercel/og + Next 15.

7 apps affectees (toutes ont `src/app/icon.tsx` utilisant `ImageResponse`).

**Impact** : `pnpm dev` fonctionne (tests ETAPE 7 7/7). `pnpm build` echoue avant deploiement prod.

**Plan de fix Sprint 16 pre-pause** :
- Option A : Supprimer `icon.tsx` et utiliser un fichier statique `favicon.ico` + `apple-icon.png` dans `public/`
- Option B : Forcer `export const runtime = 'nodejs'` dans chaque `icon.tsx` (peut ne pas suffire)
- Option C : Investiguer fix amont next.js / vercel/og + creer override pnpm

**Decouvert lors** : pause technique #2 bis (entre Sprint 4 et Sprint 5).
