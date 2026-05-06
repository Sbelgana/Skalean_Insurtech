# Tache 1.4.4 -- web-insurtech-admin Bootstrap (Port 3000)

> **Phase** : 1 -- Bootstrap
> **Sprint** : 4 / 35 -- Frontend Bootstrap
> **Numero tache** : 1.4.4 / 1.4.16
> **Priorite** : P0 (bloquant Sprint 27 monitoring + Sprint 28 tenant mgmt + Sprint 29 reports compliance)
> **Effort estime** : 5 heures
> **Depend de** : Tache 1.4.3 (web-garage-mobile bootstrap port 3003 -- valide les patterns PWA et confirme la stabilite du toolchain partage)
> **Bloque** : Tache 1.4.5 (web-customer-portal port 3004), Sprint 5 (auth super_admin_platform), Sprint 7 (RBAC platform-level), Sprint 14 (audit log), Sprint 27 (monitoring cross-tenant), Sprint 28 (tenant management), Sprint 29 (reports ACAPS / CNDP / financiers), Sprint 31 (IP whitelisting hardening)
> **Date cible execution** : Sprint 4, jour 4 (apres validation 1.4.1 / 1.4.2 / 1.4.3)

---

## 1. But

Bootstrapper l'application **web-insurtech-admin** (port 3000) -- la **SuperAdmin platform app** utilisee exclusivement par les equipes internes de **Skalean Inc.** pour piloter la plateforme InsurTech multi-tenant : ajout / suspension de tenants courtiers et garages, monitoring cross-tenant des SLA et incidents, generation de rapports de conformite reglementaire (ACAPS prudentiel + CNDP donnees personnelles + DGI fiscalite + Office des Changes), audit trail platform-wide.

Cette app est **platform-level**, **NON tenant-scoped** : elle ne porte PAS le header `x-tenant-id` (contrairement aux 7 autres apps frontend) mais un header dedicacie `x-platform-admin: true` (Sprint 5 ajoutera le JWT scope `platform:admin` au-dessus). Elle constitue la **frontiere de privilege la plus elevee** du systeme et impose un auth gate strict, un theme institutionnel differencie (Navy #1A2730 dominant vs Orange #E95D2C accent), un session timeout aggressif (15 min vs 60 min apps utilisateurs), une obligation MFA (Sprint 5), une preparation IP whitelisting (Sprint 31), et un audit log exhaustif (Sprint 14 capture chaque action super-admin).

A la sortie de cette tache :

- L'app demarre proprement avec `pnpm dev --filter @insurtech/web-insurtech-admin` sur **port 3000** (et `pnpm build && pnpm start` en prod).
- Le theme variant **admin** (Navy dominant, sidebar dense, layout institutionnel) est applique via attribut `data-theme="admin"` au niveau `<html>`.
- La sidebar admin presente **7 sections** : Tableau de bord, Tenants, Monitoring, Conformite, Rapports, Parametres, Audit Log (toutes en placeholder, branchement metier Sprints 27 / 28 / 29).
- Le client API (`src/lib/api-client.ts`) est configure pour **NE PAS** injecter `x-tenant-id` mais injecte `x-platform-admin: true` + `x-trace-id` + `Authorization: Bearer <jwt>` (placeholder Sprint 5).
- La page d'accueil et 4 pages placeholder (`/dashboard`, `/tenants`, `/reports`, `/monitoring`) rendent sans erreur en FR (locale par defaut), avec basculement possible vers `ar-MA` (Darija) et `ar` (classique RTL) -- l'admin est principalement francophone mais on garde le pattern multilingue partage du Sprint.
- Les en-tetes de securite HTTP sont **les plus stricts du monorepo** : HSTS preload `max-age=63072000; includeSubDomains; preload`, X-Frame-Options DENY (interdit total iframe), X-Content-Type-Options nosniff, CSP strict, Referrer-Policy `no-referrer`, Permissions-Policy verrouille.
- Les variables d'environnement preparent les portes de Sprint 5 (`NEXT_PUBLIC_MFA_REQUIRED=true`, `NEXT_PUBLIC_SESSION_TIMEOUT_MIN=15`) et Sprint 31 (`NEXT_PUBLIC_ADMIN_IP_WHITELIST_ENABLED=false` -- dormant mais cable).
- Sentry est initialise avec `tracesSampleRate=1.0` (capture aggressive : toute action super-admin doit etre tracable pour audit).
- Tests unitaires (Vitest) : 18-22 specs couvrent api-client, sidebar, topbar, MetricCard, providers.
- Tests E2E (Playwright chromium desktop uniquement -- pas de mobile, l'admin est desktop-only) : home renders Navy theme, sidebar 7 sections cliquables, locale switcher OK, dark mode toggle OK, theme variant admin verifie, no public access (skeleton Sprint 5).
- Lighthouse desktop baseline : Performance >= 70, Accessibility >= 90, Best Practices >= 95, SEO non requis (app interne, `noindex`).

L'app est volontairement **separee** des 7 autres apps frontend (broker / garage / garage-mobile / customer-portal / assure-portal / assure-mobile) pour 4 raisons d'ingenierie : (1) **isolation de securite** -- une compromission d'une app tenant ne doit jamais escalader vers la platform admin ; (2) **audit trail dedicacie** -- les logs Sprint 14 distinguent platform-admin vs tenant-admin par origine `x-platform-admin: true` ; (3) **theming differencie** -- l'admin doit visuellement signaler son privilege (Navy institutionnel) pour reduire les erreurs operationnelles ; (4) **deploy independant** -- un rollback admin ne doit pas impacter les apps tenant en production (cycle de release decouple).

---

## 2. Contexte etendu

### 2.1 Position dans la plateforme Skalean InsurTech

Skalean InsurTech est une **plateforme SaaS multi-tenant marocaine** vendue en marque blanche aux courtiers d'assurance (Sofidemy, AGMA, etc.) et reseaux de garages agrees. Chaque tenant possede son propre sous-domaine (`sofidemy.skalean-insurtech.ma`, `agma.skalean-insurtech.ma`, etc.) et son propre `tenant_id` UUID Postgres avec **Row-Level Security** (RLS) actif sur l'integralite des tables metier (Sprint 2 a etabli les policies RLS avec predicats `current_setting('app.tenant_id')`).

L'app **web-insurtech-admin** est l'unique frontend qui **transcende** cette segmentation tenant : elle est servie sur le sous-domaine prod **`admin.skalean-insurtech.ma`** (jamais accessible via un sous-domaine tenant), sa session JWT ne porte PAS de claim `tenant_id` mais un claim `platform_role` parmi 3 valeurs strictement controlees (Sprint 5 / Sprint 7 detailleront).

Concretement, en termes de positionnement :

- **Apps tenant-scoped (port 3001-3006, 7 apps)** : portent `x-tenant-id` dans chaque requete, RLS Postgres filtre les lignes par tenant, JWT contient `tenant_id` claim, theme = Skalean Sofidemy par defaut (peut etre override per-tenant Sprint 18+).
- **App platform-level (port 3000, web-insurtech-admin)** : porte `x-platform-admin: true`, le backend desactive RLS pour les requetes admin authentifiees (via `SET app.tenant_id = NULL` + `BYPASS RLS` accorde au role Postgres `platform_admin`), JWT contient `platform_role` mais PAS `tenant_id`, theme = admin variant (Navy dominant).

Cette dualite est le **point critique de securite** : une vulnerabilite qui permettrait a un utilisateur tenant de forger `x-platform-admin: true` ouvrirait l'integralite de la base. Le Sprint 5 (auth) et Sprint 7 (RBAC platform) implementeront la verification cryptographique du claim `platform_role` (signature JWT + audience claim `aud=platform-admin` distincte de `aud=tenant`).

### 2.2 Personae utilisateurs (3 roles platform-level)

Cette app ne sert que **3 personae**, tous employes Skalean Inc., avec acces par MFA obligatoire (Sprint 5) :

| Role | Scope d'acces | Cas d'usage principaux | Volumetrie |
|------|---------------|------------------------|------------|
| `super_admin_platform` | Lecture + ecriture totales | Ajouter / suspendre / supprimer tenants ; gerer roles platform ; intervenir en support N3 ; declarer incidents post-mortem ; signer rapports ACAPS / CNDP | 3-5 personnes (CTO, CEO, lead infra, deux SRE astreinte) |
| `analyst_support` | Lecture cross-tenant + ticketing | Repondre aux tickets N2 escalades depuis les tenants ; consulter logs (sans modification) ; relancer jobs failed ; lire audit log | 5-10 personnes (equipe support) |
| `reporting_officer` | Lecture data + generation rapports | Generer rapports periodiques ACAPS, CNDP, DGI, Office des Changes ; produire dashboards executifs ; export CSV / PDF audites | 2-3 personnes (compliance officer + comptable) |

Les 3 roles sont strictement disjoints : un compte ne peut porter qu'**un** `platform_role` (verification Sprint 5 cote backend dans `JwtPlatformAdminGuard`). Aucun de ces 3 roles ne peut self-promote vers `super_admin_platform` (audit Sprint 14 + alerte SIEM Sprint 31 si tentative).

### 2.3 Cas d'usage metier (branchement Sprints futurs)

Cette tache 1.4.4 produit uniquement les **stubs de page** ; le contenu metier est ajoute par les sprints suivants :

- **Sprint 27 (Monitoring cross-tenant)** : `/monitoring` -- charts SLA temps reponse API par tenant, taux d'erreur 5xx, throughput requetes par tenant, top 10 endpoints lents, alertes actives Prometheus / Sentry. Stack : Recharts 2.15 (deja en deps Sprint 4), agregations cote backend (vues materialisees Postgres ou Clickhouse Sprint 27).
- **Sprint 28 (Tenant management)** : `/tenants` -- table TanStack 8.20 paginee de tous les tenants (~50-200 attendus a maturite plateforme), colonnes : nom, slug, status (actif / suspendu / pending), date creation, plan tarifaire, derniere connexion admin tenant, nombre utilisateurs actifs. Actions : creer tenant (modal multi-step Sprint 28), suspendre (avec motif obligatoire + notification email + entree audit), reactiver, supprimer (soft delete Sprint 28, hard delete reserve apres delai legal CNDP 5 ans).
- **Sprint 29 (Reports compliance)** : `/reports` -- 4 categories : (1) **ACAPS** (rapport prudentiel trimestriel format Excel reglemente, ratio de solvabilite, provisions techniques agregees toutes compagnies via plateforme) ; (2) **CNDP** (registre des traitements art. 18 loi 09-08, rapports incidents de violation art. 21, demandes droits personnes concernees art. 7-13) ; (3) **DGI** (declarations TVA collectee primes assurance, IS calcule, retenue a la source courtage) ; (4) **Office des Changes** (transactions devises pour reassurance internationale).

Pour Sprint 4, ces 3 pages sont des placeholders qui rendent un titre, un breadcrumb, un bandeau "Disponible Sprint 27/28/29", et un squelette TanStack ou Recharts dummy. Aucune fetch reseau metier n'est faite.

### 2.4 Pourquoi une app separee (et non un sous-route de web-broker)

Justification documentee pour eviter la regression vers une option simpliste :

**Option A (retenue)** -- App separee `web-insurtech-admin` sur port 3000 et sous-domaine `admin.skalean-insurtech.ma` :

- **Avantages** :
  - Isolation reseau : un WAF / Cloudflare rule peut whitelist le sous-domaine admin sur les seules IP corporate Skalean Inc. (Sprint 31 hardening).
  - Audit trail distinct : tous les requetes admin emergent du meme `Origin` HTTP, simplifiant la correlation Sprint 14.
  - Build pipeline decouple : un deploy admin n'invalide pas le cache CDN des apps tenant.
  - Theme institutionnel signaler le privilege visuellement (Navy dominant) -- reduction du risque d'erreur operationnelle (un super-admin sait toujours qu'il est dans l'admin).
  - Bundle separe : pas de fuite de code admin dans le bundle JS livre aux tenants (defense en profondeur).
  - CSP plus stricte : `frame-ancestors 'none'`, `X-Frame-Options DENY` peut etre absolu ici (alors que les apps tenant pourraient autoriser embed dans certains contextes futurs comme un widget de souscription embarquable Sprint 18).

- **Inconvenients** :
  - Code duplication potentielle (layout, providers, theme) -- **mitige** par le package `@insurtech/shared-ui` consomme par toutes les apps + tache 1.4.14 (layouts partages) qui factorise sidebar / topbar generiques.
  - 8eme app a maintenir en CI / CD -- **mitige** par Turbo (Sprint 4 tache 1.4.12) qui parallelise les builds et caches les outputs.
  - Cout DNS / cert TLS supplementaire pour `admin.skalean-insurtech.ma` -- negligeable (Let's Encrypt free, DNS Atlas Cloud Benguerir gratuit jusqu'a 100 zones).

**Option B (rejetee)** -- Sous-route `/admin` dans `web-broker` (port 3001) avec gate role :

- Avantages : moins d'apps a maintenir, code partage trivial.
- Inconvenients **bloquants** :
  - Meme bundle JS livre aux courtiers : un attaquant peut analyser le code admin (defense en profondeur violee).
  - CSP doit etre permissive pour le tenant (iframe widget Sprint 18) ce qui contamine l'admin.
  - Audit Sprint 14 doit distinguer route plutot que origin -- complexite supplementaire.
  - Un bug courtage qui crash le bundle prend l'admin avec lui (risque continuite).
- **Verdict** : rejete.

**Option C (rejetee)** -- Sous-domaine `admin.*` mais embarque dans `api-gateway` NestJS (rendu serveur) :

- Avantages : un seul deploy backend, interface au plus pres des controllers.
- Inconvenients : NestJS n'est pas un framework UI moderne, perte des benefices Next.js 15 (RSC, App Router, image optim, ISR), divergence de stack par rapport aux 7 autres apps -- non aligne avec la decision architecturale Skalean (Next.js 15 partout).
- **Verdict** : rejete.

**Option D (rejetee)** -- Wildcard tenant special `tenant=skalean` traite comme platform-admin par convention :

- Avantages : aucune nouvelle app, aucune nouvelle infra.
- Inconvenients : **catastrophique en securite** -- le claim `tenant_id=skalean` peut etre forge si la signature JWT est compromise (alors que `platform_role` distinct + audience claim distincte ajoute une couche de defense). Audit log indistinguable d'un tenant. Pas de sous-domaine reseau separable.
- **Verdict** : rejete categoriquement.

### 2.5 Decisions architecturales applicables (referentiel decisions/)

- **Decision-006 (no-emoji)** : aucun emoji dans le code, les commits, les messages d'erreur, les copies UI, les commentaires. Respect strict (verifie par hook pre-commit Sprint 4 tache 1.4.16).
- **Decision-007 (mock period Sprint 4-28)** : entre Sprint 4 (bootstrap) et Sprint 28 (tenant management metier), l'app admin utilise des donnees **mockees** (constantes TS dans `src/mocks/`, pas de fetch reseau metier). L'API gateway (Sprint 3) est consumable mais on ne consomme que les endpoints health / version pour le ping de demarrage. Sprint 5 ajoute auth, Sprint 27 commence le branchement reel.
- **Decision-008 (cloud souverain)** : tout deploy production cible **Atlas Cloud Services Benguerir** (Maroc) -- exigence CNDP loi 09-08 sur la localisation des donnees personnelles. L'env var `NEXT_PUBLIC_CLOUD_REGION=atlas-benguerir-1` documente le choix. Aucune dependance a des services US/EU (pas de Vercel, pas de Cloudflare Workers en prod -- Cloudflare est en proxy seulement).
- **Decision-002 (multi-tenant RLS)** : ne s'applique PAS a cette app (platform-level). On documente explicitement dans le code (commentaire en-tete `api-client.ts`).
- **Decision-014 (theme tokens)** : utilisation des CSS variables `--color-navy-base`, `--color-orange-base`, etc. definies dans `@insurtech/shared-ui/styles/tokens.css`. L'override admin se fait via `[data-theme="admin"]` selector qui inverse Navy/Orange.

### 2.6 Pieges classiques (8-10 pitfalls)

1. **Super admin role escalation** -- tentation de stocker le role en clair dans localStorage / Zustand pour eviter le decodage JWT a chaque check. **Mauvais** : un script XSS pourrait modifier la valeur. **Bon** (Sprint 5) : decoder le JWT a chaque guard cote serveur (middleware Next.js + RouteGuard composant), jamais faire confiance au state client. Cette tache 1.4.4 documente le pattern dans `RouteGuard.placeholder.tsx`.

2. **Audit log absent ou partiel** -- chaque action super-admin (lire un tenant, suspendre, exporter rapport) doit etre tracee Sprint 14. Le client API `src/lib/api-client.ts` injecte deja `x-trace-id` (UUID v4 par requete) pour que le backend puisse correler. La tache 1.4.4 prepare le hook `useAdminAction()` (placeholder Sprint 14) qui forcera le wrapping de toute mutation par un appel `POST /audit/admin-action`.

3. **Header x-tenant-id present par erreur** -- si on copie-colle un client API depuis web-broker, on heritera de l'interceptor `x-tenant-id`. **Test unitaire obligatoire** (`api-client.spec.ts`) : assert que `x-tenant-id` n'est JAMAIS dans `request.config.headers`, et que `x-platform-admin: 'true'` y est systematiquement.

4. **Session timeout trop laxiste** -- les apps tenant utilisent 60 min de session. Pour l'admin, on impose **15 minutes d'inactivite** (`NEXT_PUBLIC_SESSION_TIMEOUT_MIN=15`). Sprint 5 ajoutera le hook `useIdleTimer` qui force le logout. La tache 1.4.4 expose la variable d'env et documente la cible 15 min dans `<meta>` HTML pour audit Lighthouse Best Practices.

5. **MFA pas applique** -- Sprint 5 imposera MFA TOTP (Google Authenticator / Microsoft Authenticator) obligatoire pour tous les `platform_role`. La tache 1.4.4 expose `NEXT_PUBLIC_MFA_REQUIRED=true` et documente la dependance Sprint 5 dans le commentaire d'en-tete du middleware.

6. **IP whitelisting absent en attendant Sprint 31** -- prod sera derriere Cloudflare Zero Trust avec liste d'IP corporate Skalean. Pendant Sprint 4-30, l'app est accessible uniquement en environnement de dev local (pas de deploy public). La tache 1.4.4 expose `NEXT_PUBLIC_ADMIN_IP_WHITELIST_ENABLED=false` (dormant) pour permettre Sprint 31 de l'activer sans modifier le code.

7. **CSP trop permissive** -- la tentation de mettre `script-src 'self' 'unsafe-inline'` pour faire passer les scripts inline Next.js. **Mauvais** -- on perd la protection XSS. **Bon** : `script-src 'self' 'nonce-<random>'` avec nonce genere par middleware. Sprint 4 tache 1.4.4 implemente une CSP stricte qui sera aiguisee Sprint 31. On documente les directives complete (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' http://localhost:4000 https://api.skalean-insurtech.ma; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`).

8. **X-Frame-Options manquant ou Faux** -- l'admin ne doit JAMAIS etre embarque dans un iframe (clickjacking risk maximum). On force `X-Frame-Options: DENY` (header HTTP) ET `frame-ancestors 'none'` (CSP -- redondance volontaire defense en profondeur). Test E2E Playwright verifie le header.

9. **HSTS sans preload** -- en prod, on doit avoir `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (2 ans) et soumettre le domaine a la HSTS preload list Chromium (https://hstspreload.org/). La tache 1.4.4 expose le header dans `next.config.mjs` (sera actif uniquement HTTPS prod, le local dev en HTTP ne le declenchera pas).

10. **Locale RTL (ar) qui casse la sidebar dense** -- le layout admin a une sidebar gauche dense, en RTL elle bascule a droite. Test Playwright doit verifier que la sidebar est bien `right: 0` quand `<html dir="rtl">`. Le composant `AdminSidebar.tsx` utilise les classes Tailwind logiques (`start-0`, `end-0`) plutot que `left-0` / `right-0`.

### 2.7 Lien avec autres apps du Sprint 4

- Reutilise `@insurtech/shared-ui` (tache 1.4.8) : `<Button>`, `<Card>`, `<Sidebar>`, `<Topbar>`, `<Breadcrumb>`, `<Skeleton>`, `<Badge>`, `<Sheet>`, `<Dialog>` (placeholder), `<DropdownMenu>`, `<Avatar>`, `<Separator>`, `<Toast>`.
- N'utilise PAS `@insurtech/shared-pwa` (tache 1.4.9) -- l'admin n'est pas une PWA (desktop-only, pas d'install prompt).
- N'utilise PAS `@insurtech/shared-maps` (tache 1.4.10) -- pas de cartes dans l'admin (sauf eventuellement Sprint 27 pour visualiser geographie incidents -- a evaluer).
- Consomme la generation OpenAPI client (tache 1.4.13) via `@insurtech/api-client` package (alias `import { adminClient } from '@insurtech/api-client/admin'`).
- Aligne sur le tooling monorepo Turbo (tache 1.4.12).
- Suit le pattern multilingue next-intl (tache 1.4.11).
- Heritera des layouts partages (tache 1.4.14) en surchargeant le sidebar pour ses 7 sections specifiques.
- Pages 404 / 500 generees par tache 1.4.15 (placeholder dedicacie admin avec ton institutionnel).
- Tests E2E + Lighthouse cibles dans tache 1.4.16.

---

## 3. Architecture context

### 3.1 Position dans le monorepo

```
repo/
  apps/
    web-broker/                 # 3001 -- tenant courtier
    web-garage/                 # 3002 -- tenant garage
    web-garage-mobile/          # 3003 -- tenant technicien PWA
    web-insurtech-admin/        # 3000 -- PLATFORM-LEVEL (cette tache)
    web-customer-portal/        # 3004 -- public + comparateur SSG
    web-assure-portal/          # 3005 -- assure self-service
    web-assure-mobile/          # 3006 -- assure mobile PWA
    api-gateway/                # 4000 -- NestJS (Sprint 3)
  packages/
    shared-ui/                  # tokens + 30+ composants shadcn
    shared-pwa/                 # service worker + offline (NON utilise par admin)
    shared-maps/                # Mapbox wrapper (NON utilise par admin)
    api-client/                 # generation OpenAPI (tache 1.4.13)
    eslint-config/              # regles partagees
    tsconfig/                   # presets TS partages
```

### 3.2 Flux de dependances

- **Depend de** : `1.4.3` (web-garage-mobile bootstrap) -- valide les patterns de port Next.js 15, layout multilingue, providers React Query, et confirme la stabilite de la chaine pnpm + Turbo.
- **Bloque** : `1.4.5` (web-customer-portal -- a besoin du pattern de fichier .env hardening valide ici), `1.4.14` (layouts partages -- recolte les besoins specifiques admin pour finaliser le composant `<AdminLayout>` factorise), Sprint 5 (auth -- attend le squelette `RouteGuard.placeholder.tsx`), Sprint 7 (RBAC platform -- attend `platform_role` declare dans middleware), Sprint 14 (audit -- attend `x-trace-id` injection client), Sprint 27 (monitoring -- attend page placeholder), Sprint 28 (tenant mgmt -- attend page placeholder + table TanStack), Sprint 29 (reports -- attend page placeholder), Sprint 31 (hardening -- attend env vars dormants).

### 3.3 Diagramme C4 niveau composant (textuel)

```
[Operator Skalean Inc.] -- HTTPS (admin.skalean-insurtech.ma) -->
   [Cloudflare proxy + Zero Trust IP whitelist (Sprint 31)] -->
      [Atlas Cloud Benguerir Maroc -- Kubernetes ingress] -->
         [Pod web-insurtech-admin (Next.js 15 standalone, port 3000)]
            -- internal HTTP --> [Pod api-gateway NestJS, port 4000]
                                     -- avec headers x-platform-admin: true
                                     -- + x-trace-id <uuid>
                                     -- + Authorization Bearer <jwt platform_role>
            -- Sentry HTTPS (events) --> [sentry.skalean-insurtech.ma self-hosted Sprint 31]
            -- /health, /version --> Probes Kubernetes
```

### 3.4 Contrats d'interface

- **Headers HTTP sortants** (vers api-gateway) :
  - `x-platform-admin: true` (constant, injecte par interceptor Axios)
  - `x-trace-id: <uuid v4>` (genere par requete, propage W3C Trace Context si presence parent)
  - `Authorization: Bearer <jwt>` (Sprint 5 ; placeholder vide en Sprint 4)
  - `Accept-Language: fr | ar-MA | ar` (selon locale active)
  - `Content-Type: application/json` (pour POST / PUT / PATCH)
- **Headers HTTP entrants** (responses CSP-compliant) :
  - `Content-Security-Policy` strict (cf. section 2.6 piege 7)
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()`
- **Pages exposees** : `/` (redirect vers `/fr/dashboard`), `/[locale]/dashboard`, `/[locale]/tenants`, `/[locale]/monitoring`, `/[locale]/reports`, `/[locale]/compliance` (placeholder Sprint 29), `/[locale]/audit` (placeholder Sprint 14), `/[locale]/settings` (placeholder Sprint 7).
- **Routes API consumees** (Sprint 4 minimal) : `GET /v1/health` (ping demarrage), `GET /v1/version` (footer). Sprint 27+ ajoutera massivement.

### 3.5 Modele de menace (STRIDE applique)

| Threat | Mitigation Sprint 4 | Mitigation futur sprint |
|--------|---------------------|-------------------------|
| Spoofing identity (forger JWT platform) | Skeleton Sprint 5 | Sprint 5 verif signature + audience claim |
| Tampering (modifier role local) | role lu uniquement depuis JWT decode serveur | Sprint 5 RouteGuard server-side |
| Repudiation (nier action admin) | x-trace-id injecte | Sprint 14 audit log ecriture immuable |
| Information disclosure (XSS leak token) | CSP strict, httpOnly cookie Sprint 5 | Sprint 31 cookie SameSite=Strict + Secure |
| Denial of service (flood admin) | Sprint 31 rate-limit Cloudflare | Sprint 31 |
| Elevation of privilege (tenant -> admin) | sous-domaine separe + audience claim distincte (Sprint 5) | Sprint 5 |

---

## 4. Livrables checkables

### 4.1 Fichiers crees / modifies (chemin absolu repo-relatif)

- [ ] `apps/web-insurtech-admin/package.json` (deps: next 15.1.0, react 19.0.0, next-intl 3.26.3, tailwindcss 4.0.0-beta.4, @tanstack/react-query 5.62.7, @tanstack/react-table 8.20.5, axios 1.7.9, recharts 2.15.0, lucide-react 0.469.0, clsx, tailwind-merge, zod 3.24.1, zustand 5.0.2, @sentry/nextjs 8.45.0, @insurtech/shared-ui workspace:*)
- [ ] `apps/web-insurtech-admin/next.config.mjs` (port 3000 indirect via package.json scripts ; headers HTTP stricts ; output standalone)
- [ ] `apps/web-insurtech-admin/tailwind.config.ts` (preset shared-ui + override theme admin variant)
- [ ] `apps/web-insurtech-admin/tsconfig.json` (extends @insurtech/tsconfig/nextjs.json)
- [ ] `apps/web-insurtech-admin/postcss.config.js` (tailwind 4 oxide)
- [ ] `apps/web-insurtech-admin/.env.example` (15+ NEXT_PUBLIC_* documentees)
- [ ] `apps/web-insurtech-admin/.eslintrc.cjs` (extends @insurtech/eslint-config/nextjs)
- [ ] `apps/web-insurtech-admin/sentry.client.config.ts` (init aggressive tracesSampleRate 1.0)
- [ ] `apps/web-insurtech-admin/sentry.server.config.ts`
- [ ] `apps/web-insurtech-admin/sentry.edge.config.ts`
- [ ] `apps/web-insurtech-admin/instrumentation.ts`
- [ ] `apps/web-insurtech-admin/src/app/[locale]/layout.tsx` (data-theme="admin", sidebar dense)
- [ ] `apps/web-insurtech-admin/src/app/[locale]/page.tsx` (redirect dashboard)
- [ ] `apps/web-insurtech-admin/src/app/[locale]/dashboard/page.tsx` (4 metric cards placeholder)
- [ ] `apps/web-insurtech-admin/src/app/[locale]/tenants/page.tsx` (placeholder Sprint 28)
- [ ] `apps/web-insurtech-admin/src/app/[locale]/monitoring/page.tsx` (placeholder Sprint 27)
- [ ] `apps/web-insurtech-admin/src/app/[locale]/reports/page.tsx` (placeholder Sprint 29)
- [ ] `apps/web-insurtech-admin/src/app/[locale]/compliance/page.tsx` (placeholder Sprint 29)
- [ ] `apps/web-insurtech-admin/src/app/[locale]/audit/page.tsx` (placeholder Sprint 14)
- [ ] `apps/web-insurtech-admin/src/app/[locale]/settings/page.tsx` (placeholder Sprint 7)
- [ ] `apps/web-insurtech-admin/src/middleware.ts` (next-intl + auth gate placeholder + IP whitelist placeholder)
- [ ] `apps/web-insurtech-admin/src/i18n/request.ts` (next-intl config)
- [ ] `apps/web-insurtech-admin/src/i18n/routing.ts` (locales : fr default, ar-MA, ar)
- [ ] `apps/web-insurtech-admin/src/messages/fr.json` (~120 cles vocab admin)
- [ ] `apps/web-insurtech-admin/src/messages/ar-MA.json` (~120 cles, traduction Darija)
- [ ] `apps/web-insurtech-admin/src/messages/ar.json` (~120 cles, classique)
- [ ] `apps/web-insurtech-admin/src/components/AdminSidebar.tsx` (~150 lignes, 7 sections)
- [ ] `apps/web-insurtech-admin/src/components/AdminTopbar.tsx` (~80 lignes, breadcrumb + UserMenu + Notif + locale switcher + theme toggle)
- [ ] `apps/web-insurtech-admin/src/components/MetricCard.tsx` (~60 lignes, dashboard)
- [ ] `apps/web-insurtech-admin/src/components/RouteGuard.placeholder.tsx` (skeleton Sprint 5)
- [ ] `apps/web-insurtech-admin/src/components/providers.tsx` (QueryClientProvider + Sentry + theme)
- [ ] `apps/web-insurtech-admin/src/lib/api-client.ts` (Axios admin -- NO x-tenant-id, x-platform-admin: true)
- [ ] `apps/web-insurtech-admin/src/lib/query-client.ts` (factory React Query)
- [ ] `apps/web-insurtech-admin/src/lib/trace-id.ts` (uuid v4 generator)
- [ ] `apps/web-insurtech-admin/src/lib/env.ts` (validation Zod env vars)
- [ ] `apps/web-insurtech-admin/src/mocks/tenants.ts` (mock data 5 tenants pour /tenants page)
- [ ] `apps/web-insurtech-admin/src/mocks/metrics.ts` (mock data dashboard)
- [ ] `apps/web-insurtech-admin/tests/unit/api-client.spec.ts` (5 tests)
- [ ] `apps/web-insurtech-admin/tests/unit/AdminSidebar.spec.tsx` (4 tests)
- [ ] `apps/web-insurtech-admin/tests/unit/AdminTopbar.spec.tsx` (3 tests)
- [ ] `apps/web-insurtech-admin/tests/unit/MetricCard.spec.tsx` (3 tests)
- [ ] `apps/web-insurtech-admin/tests/unit/providers.spec.tsx` (2 tests)
- [ ] `apps/web-insurtech-admin/tests/e2e/admin.spec.ts` (Playwright -- 5 tests)
- [ ] `apps/web-insurtech-admin/playwright.config.ts` (chromium desktop only, baseURL :3000)
- [ ] `apps/web-insurtech-admin/vitest.config.ts`
- [ ] `apps/web-insurtech-admin/README.md` (mini -- uniquement comment lancer ; pas de markdown promo)

### 4.2 Comportements observables a la sortie

- [ ] `pnpm dev --filter @insurtech/web-insurtech-admin` lance Next.js sur port 3000 (verifie par curl `http://localhost:3000` qui repond 200 ou 307 redirect locale).
- [ ] `pnpm build --filter @insurtech/web-insurtech-admin` compile sans erreur TypeScript ni warning ESLint critical.
- [ ] `pnpm start --filter @insurtech/web-insurtech-admin` sert le build prod sur port 3000.
- [ ] L'attribut `<html data-theme="admin">` est present dans la source HTML rendue.
- [ ] La sidebar contient exactement 7 entrees : Tableau de bord, Tenants, Monitoring, Conformite, Rapports, Parametres, Audit Log.
- [ ] Le header HTTP `X-Frame-Options: DENY` est present sur toutes les reponses (verifie `curl -I http://localhost:3000`).
- [ ] Le header HTTP `Content-Security-Policy` est present et inclut `frame-ancestors 'none'`.
- [ ] Aucune requete reseau sortante ne contient `x-tenant-id` (verifie via Playwright network capture).
- [ ] Toutes les requetes reseau sortantes (vers api-gateway) contiennent `x-platform-admin: true` ET `x-trace-id` (UUID v4).
- [ ] La locale par defaut est `fr` (l'URL `/` redirige vers `/fr/dashboard`).
- [ ] Le theme admin (Navy `#1A2730` dominant) est applique : background sidebar `bg-navy-900`, accent Orange `#E95D2C` reserve aux boutons primaires.
- [ ] Lighthouse desktop : Performance >= 70, Accessibility >= 90, Best Practices >= 95.
- [ ] Aucune erreur console au chargement (verifie via Playwright `consoleMessages` filter `error`).
- [ ] Vitest passe les 17 tests unitaires.
- [ ] Playwright passe les 5 tests E2E.

---

## 5. Code patterns complets

### 5.1 `apps/web-insurtech-admin/package.json`

```json
{
  "name": "@insurtech/web-insurtech-admin",
  "version": "0.1.0",
  "private": true,
  "description": "Skalean InsurTech -- SuperAdmin platform app (port 3000). Platform-level, NOT tenant-scoped.",
  "scripts": {
    "dev": "next dev --port 3000 --turbopack",
    "build": "next build",
    "start": "next start --port 3000",
    "lint": "next lint --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "clean": "rimraf .next .turbo node_modules/.cache"
  },
  "dependencies": {
    "@hookform/resolvers": "3.9.1",
    "@insurtech/shared-ui": "workspace:*",
    "@sentry/nextjs": "8.45.0",
    "@tanstack/react-query": "5.62.7",
    "@tanstack/react-query-devtools": "5.62.7",
    "@tanstack/react-table": "8.20.5",
    "axios": "1.7.9",
    "clsx": "2.1.1",
    "lucide-react": "0.469.0",
    "next": "15.1.0",
    "next-intl": "3.26.3",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-hook-form": "7.54.2",
    "recharts": "2.15.0",
    "tailwind-merge": "2.5.5",
    "uuid": "11.0.3",
    "zod": "3.24.1",
    "zustand": "5.0.2"
  },
  "devDependencies": {
    "@insurtech/eslint-config": "workspace:*",
    "@insurtech/tsconfig": "workspace:*",
    "@playwright/test": "1.49.1",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/react": "16.1.0",
    "@testing-library/user-event": "14.5.2",
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "@types/uuid": "10.0.0",
    "@vitejs/plugin-react": "4.3.4",
    "autoprefixer": "10.4.20",
    "eslint": "9.17.0",
    "eslint-config-next": "15.1.0",
    "happy-dom": "15.11.7",
    "jsdom": "25.0.1",
    "postcss": "8.4.49",
    "rimraf": "6.0.1",
    "tailwindcss": "4.0.0-beta.4",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  },
  "engines": {
    "node": ">=20.18.0",
    "pnpm": ">=9.15.0"
  }
}
```

### 5.2 `apps/web-insurtech-admin/next.config.mjs`

```javascript
// @ts-check
import { withSentryConfig } from '@sentry/nextjs';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * STRICTEST security headers in the monorepo.
 * Justification: web-insurtech-admin is platform-level (Skalean Inc. operators only).
 * - HSTS preload: 2 years, includeSubDomains, preload (cf. hstspreload.org).
 * - X-Frame-Options DENY: clickjacking absolu interdit (admin ne s'iframe jamais).
 * - CSP strict: default-src self, frame-ancestors none. Sprint 31 ajoutera nonce dynamique.
 * - Permissions-Policy: revoke camera/mic/geo/payment/usb (admin desktop pur).
 * - Referrer-Policy: no-referrer (eviter fuite URL admin vers backends third-party).
 */
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'no-referrer',
  },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=(), bluetooth=(), midi=(), interest-cohort=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'", // unsafe-eval requis Next.js dev ; Sprint 31 retire en prod
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' http://localhost:4000 https://api.skalean-insurtech.ma https://*.sentry.io https://sentry.skalean-insurtech.ma",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
  {
    key: 'X-Permitted-Cross-Domain-Policies',
    value: 'none',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'off',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  experimental: {
    typedRoutes: true,
    optimizePackageImports: [
      '@insurtech/shared-ui',
      'lucide-react',
      'recharts',
      '@tanstack/react-table',
    ],
  },
  transpilePackages: ['@insurtech/shared-ui'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: 'api.skalean-insurtech.ma' },
      { protocol: 'https', hostname: 'cdn.skalean-insurtech.ma' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/fr/dashboard',
        permanent: false,
      },
    ];
  },
  // Indique aux moteurs de recherche de NE PAS indexer (admin interne)
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/robots.txt',
          destination: '/api/robots',
        },
      ],
    };
  },
  env: {
    NEXT_PUBLIC_APP_NAME: 'web-insurtech-admin',
    NEXT_PUBLIC_APP_VARIANT: 'platform-admin',
  },
};

const sentryOptions = {
  silent: true,
  org: 'skalean-insurtech',
  project: 'web-insurtech-admin',
  widenClientFileUpload: true,
  reactComponentAnnotation: { enabled: true },
  hideSourceMaps: true,
  disableLogger: true,
};

export default withSentryConfig(withNextIntl(nextConfig), sentryOptions);
```

### 5.3 `apps/web-insurtech-admin/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';
import sharedPreset from '@insurtech/shared-ui/tailwind.preset';

/**
 * Theme variant "admin" : Navy dominant + Orange accent.
 * Override des tokens via [data-theme="admin"] selector dans tokens.css.
 * Le shared-ui preset apporte deja la palette complete Skalean Sofidemy.
 */
const config: Config = {
  presets: [sharedPreset],
  content: [
    './src/**/*.{ts,tsx,js,jsx,mdx}',
    '../../packages/shared-ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'admin-bg': 'var(--color-admin-bg, #0F1A22)',
        'admin-surface': 'var(--color-admin-surface, #1A2730)',
        'admin-accent': 'var(--color-admin-accent, #E95D2C)',
        'admin-muted': 'var(--color-admin-muted, #6B7A87)',
      },
      fontFamily: {
        sans: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
        arabic: ['var(--font-noto-naskh)', 'var(--font-montserrat)', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'monospace'],
      },
      spacing: {
        'sidebar-w': '15rem',
        'sidebar-w-collapsed': '4rem',
        'topbar-h': '3.5rem',
      },
      boxShadow: {
        'admin-card': '0 1px 2px rgba(15, 26, 34, 0.08), 0 0 0 1px rgba(15, 26, 34, 0.04)',
      },
    },
  },
};

export default config;
```

### 5.4 `apps/web-insurtech-admin/tsconfig.json`

```json
{
  "extends": "@insurtech/tsconfig/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/mocks/*": ["./src/mocks/*"],
      "@/messages/*": ["./src/messages/*"]
    },
    "plugins": [{ "name": "next" }]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules", ".next", "dist", "coverage"]
}
```

### 5.5 `apps/web-insurtech-admin/src/i18n/routing.ts`

```typescript
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['fr', 'ar-MA', 'ar'] as const,
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: false, // admin pas de detection auto, force fr par defaut
});

export type AppLocale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
```

### 5.6 `apps/web-insurtech-admin/src/i18n/request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = routing.locales.includes(requested as never)
    ? (requested as (typeof routing.locales)[number])
    : routing.defaultLocale;

  if (!locale) notFound();

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: '2-digit', month: '2-digit', year: 'numeric' },
        long: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' },
      },
      number: {
        currency: { style: 'currency', currency: 'MAD' },
      },
    },
  };
});
```

### 5.7 `apps/web-insurtech-admin/src/middleware.ts`

```typescript
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

/**
 * Middleware admin app.
 * Sprint 4 : next-intl uniquement + skeleton auth gate + skeleton IP whitelist.
 * Sprint 5 ajoutera : verification JWT platform_role + redirect /login si absent.
 * Sprint 31 ajoutera : verification IP source contre NEXT_PUBLIC_ADMIN_IP_WHITELIST.
 */
export default function middleware(request: NextRequest) {
  // ---- Sprint 31 placeholder : IP whitelist ----
  const ipWhitelistEnabled =
    process.env.NEXT_PUBLIC_ADMIN_IP_WHITELIST_ENABLED === 'true';
  if (ipWhitelistEnabled) {
    const allowedIps = (process.env.ADMIN_IP_WHITELIST ?? '').split(',').filter(Boolean);
    const clientIp =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      request.headers.get('x-real-ip') ??
      '';
    if (allowedIps.length > 0 && !allowedIps.includes(clientIp)) {
      return new NextResponse('Forbidden -- IP not whitelisted', { status: 403 });
    }
  }

  // ---- Sprint 5 placeholder : auth gate ----
  // const sessionCookie = request.cookies.get('skalean.platform.session');
  // const platformRole = decodeJwtRole(sessionCookie?.value);
  // const allowedRoles = ['super_admin_platform', 'analyst_support', 'reporting_officer'];
  // if (!sessionCookie || !allowedRoles.includes(platformRole)) {
  //   return NextResponse.redirect(new URL('/login', request.url));
  // }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

### 5.8 `apps/web-insurtech-admin/src/app/[locale]/layout.tsx`

```tsx
import type { Metadata, Viewport } from 'next';
import { Montserrat, Noto_Naskh_Arabic, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Providers } from '@/components/providers';
import { AdminSidebar } from '@/components/AdminSidebar';
import { AdminTopbar } from '@/components/AdminTopbar';
import { RouteGuardPlaceholder } from '@/components/RouteGuard.placeholder';
import { routing } from '@/i18n/routing';
import { clsx } from 'clsx';
import '@insurtech/shared-ui/styles/tokens.css';
import './globals.css';

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
});

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-noto-naskh',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Skalean InsurTech -- SuperAdmin Platform',
    template: '%s | Skalean Admin',
  },
  description:
    'Console interne Skalean Inc. -- gestion tenants, monitoring, conformite ACAPS / CNDP.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    googleBot: { index: false, follow: false },
  },
  applicationName: 'Skalean Admin',
  authors: [{ name: 'Skalean Inc.', url: 'https://skalean-insurtech.ma' }],
  generator: 'Next.js 15',
  referrer: 'no-referrer',
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  other: {
    'session-timeout-min': '15',
    'mfa-required': 'true',
    'app-variant': 'platform-admin',
  },
};

export const viewport: Viewport = {
  themeColor: '#1A2730',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as never)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme="admin"
      className={clsx(montserrat.variable, notoNaskh.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-admin-bg font-sans text-slate-100 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <RouteGuardPlaceholder>
              <div className="flex min-h-screen">
                <AdminSidebar />
                <div className="flex flex-1 flex-col">
                  <AdminTopbar />
                  <main
                    id="main-content"
                    className="flex-1 overflow-y-auto bg-slate-950/40 p-6"
                    role="main"
                  >
                    {children}
                  </main>
                </div>
              </div>
            </RouteGuardPlaceholder>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 5.9 `apps/web-insurtech-admin/src/app/[locale]/page.tsx`

```tsx
import { redirect } from '@/i18n/routing';

export default function RootLocalePage({
  params: _params,
}: {
  params: Promise<{ locale: string }>;
}) {
  redirect({ href: '/dashboard', locale: 'fr' });
}
```

### 5.10 `apps/web-insurtech-admin/src/app/[locale]/dashboard/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Building2, AlertTriangle, FileBarChart, Activity } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';
import { mockMetrics } from '@/mocks/metrics';

interface DashboardPageProps {
  params: Promise<{ locale: string }>;
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  return (
    <section aria-labelledby="dashboard-title" className="space-y-6">
      <header className="space-y-1">
        <h1 id="dashboard-title" className="text-2xl font-semibold text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-400">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Building2}
          label={t('metrics.totalTenants')}
          value={mockMetrics.totalTenants.toString()}
          delta="+2"
          deltaTone="positive"
          description={t('metrics.totalTenantsHint')}
        />
        <MetricCard
          icon={Activity}
          label={t('metrics.activeTenants')}
          value={mockMetrics.activeTenants.toString()}
          delta="+1"
          deltaTone="positive"
          description={t('metrics.activeTenantsHint')}
        />
        <MetricCard
          icon={FileBarChart}
          label={t('metrics.totalRevenue')}
          value={`${(mockMetrics.totalRevenueMad / 1000).toFixed(0)}k MAD`}
          delta="+8.4%"
          deltaTone="positive"
          description={t('metrics.totalRevenueHint')}
        />
        <MetricCard
          icon={AlertTriangle}
          label={t('metrics.activeClaims')}
          value={mockMetrics.activeClaims.toString()}
          delta="-3"
          deltaTone="positive"
          description={t('metrics.activeClaimsHint')}
        />
      </div>

      <div className="rounded-md border border-slate-800 bg-admin-surface/40 p-4">
        <h2 className="text-base font-semibold text-white">{t('placeholder.title')}</h2>
        <p className="mt-1 text-sm text-slate-400">{t('placeholder.body')}</p>
      </div>
    </section>
  );
}
```

### 5.11 `apps/web-insurtech-admin/src/app/[locale]/tenants/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { mockTenants } from '@/mocks/tenants';

interface TenantsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function TenantsPage({ params }: TenantsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('tenants');

  return (
    <section aria-labelledby="tenants-title" className="space-y-6">
      <header className="space-y-1">
        <h1 id="tenants-title" className="text-2xl font-semibold text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-400">{t('subtitle')}</p>
      </header>

      <div className="rounded-md border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
        {t('placeholder.notice')}
      </div>

      <div className="overflow-hidden rounded-md border border-slate-800 bg-admin-surface/40">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-800 bg-slate-950/40 text-left text-slate-400">
            <tr>
              <th className="p-3 font-medium">{t('table.name')}</th>
              <th className="p-3 font-medium">{t('table.slug')}</th>
              <th className="p-3 font-medium">{t('table.status')}</th>
              <th className="p-3 font-medium">{t('table.users')}</th>
              <th className="p-3 font-medium">{t('table.createdAt')}</th>
            </tr>
          </thead>
          <tbody>
            {mockTenants.map((tenant) => (
              <tr key={tenant.id} className="border-b border-slate-800/60 text-slate-200">
                <td className="p-3 font-medium">{tenant.name}</td>
                <td className="p-3 font-mono text-xs text-slate-400">{tenant.slug}</td>
                <td className="p-3">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      tenant.status === 'active'
                        ? 'bg-emerald-900/40 text-emerald-300'
                        : tenant.status === 'suspended'
                          ? 'bg-rose-900/40 text-rose-300'
                          : 'bg-amber-900/40 text-amber-300'
                    }`}
                  >
                    {t(`status.${tenant.status}`)}
                  </span>
                </td>
                <td className="p-3 text-slate-400">{tenant.userCount}</td>
                <td className="p-3 text-slate-400">{tenant.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

### 5.12 `apps/web-insurtech-admin/src/app/[locale]/monitoring/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';

interface MonitoringPageProps {
  params: Promise<{ locale: string }>;
}

export default async function MonitoringPage({ params }: MonitoringPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('monitoring');

  return (
    <section aria-labelledby="monitoring-title" className="space-y-6">
      <header className="space-y-1">
        <h1 id="monitoring-title" className="text-2xl font-semibold text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-400">{t('subtitle')}</p>
      </header>

      <div className="rounded-md border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
        {t('placeholder.notice')}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64 rounded-md border border-slate-800 bg-admin-surface/40 p-4">
          <h2 className="text-sm font-medium text-slate-300">{t('charts.latency')}</h2>
          <div className="mt-2 flex h-48 items-center justify-center text-slate-500">
            {t('charts.placeholder')}
          </div>
        </div>
        <div className="h-64 rounded-md border border-slate-800 bg-admin-surface/40 p-4">
          <h2 className="text-sm font-medium text-slate-300">{t('charts.errorRate')}</h2>
          <div className="mt-2 flex h-48 items-center justify-center text-slate-500">
            {t('charts.placeholder')}
          </div>
        </div>
      </div>
    </section>
  );
}
```

### 5.13 `apps/web-insurtech-admin/src/app/[locale]/reports/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ShieldCheck, FileText, Coins, Globe2 } from 'lucide-react';

interface ReportsPageProps {
  params: Promise<{ locale: string }>;
}

const reportCategories = [
  { id: 'acaps', icon: ShieldCheck },
  { id: 'cndp', icon: FileText },
  { id: 'dgi', icon: Coins },
  { id: 'changes', icon: Globe2 },
] as const;

export default async function ReportsPage({ params }: ReportsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('reports');

  return (
    <section aria-labelledby="reports-title" className="space-y-6">
      <header className="space-y-1">
        <h1 id="reports-title" className="text-2xl font-semibold text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-400">{t('subtitle')}</p>
      </header>

      <div className="rounded-md border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
        {t('placeholder.notice')}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {reportCategories.map((cat) => {
          const Icon = cat.icon;
          return (
            <article
              key={cat.id}
              className="rounded-md border border-slate-800 bg-admin-surface/40 p-4"
              aria-labelledby={`report-${cat.id}-title`}
            >
              <header className="flex items-center gap-3">
                <span className="rounded-md bg-slate-900 p-2 text-admin-accent">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h2 id={`report-${cat.id}-title`} className="text-base font-semibold text-white">
                  {t(`categories.${cat.id}.title`)}
                </h2>
              </header>
              <p className="mt-2 text-sm text-slate-400">
                {t(`categories.${cat.id}.description`)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

### 5.14 `apps/web-insurtech-admin/src/app/[locale]/compliance/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';

interface CompliancePageProps {
  params: Promise<{ locale: string }>;
}

export default async function CompliancePage({ params }: CompliancePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('compliance');

  return (
    <section aria-labelledby="compliance-title" className="space-y-6">
      <header className="space-y-1">
        <h1 id="compliance-title" className="text-2xl font-semibold text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-400">{t('subtitle')}</p>
      </header>
      <div className="rounded-md border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
        {t('placeholder.notice')}
      </div>
    </section>
  );
}
```

### 5.15 `apps/web-insurtech-admin/src/app/[locale]/audit/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';

interface AuditPageProps {
  params: Promise<{ locale: string }>;
}

export default async function AuditPage({ params }: AuditPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('audit');

  return (
    <section aria-labelledby="audit-title" className="space-y-6">
      <header className="space-y-1">
        <h1 id="audit-title" className="text-2xl font-semibold text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-400">{t('subtitle')}</p>
      </header>
      <div className="rounded-md border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
        {t('placeholder.notice')}
      </div>
    </section>
  );
}
```

### 5.16 `apps/web-insurtech-admin/src/app/[locale]/settings/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';

interface SettingsPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');

  return (
    <section aria-labelledby="settings-title" className="space-y-6">
      <header className="space-y-1">
        <h1 id="settings-title" className="text-2xl font-semibold text-white">
          {t('title')}
        </h1>
        <p className="text-sm text-slate-400">{t('subtitle')}</p>
      </header>
      <div className="rounded-md border border-amber-700/40 bg-amber-900/20 p-3 text-sm text-amber-200">
        {t('placeholder.notice')}
      </div>
    </section>
  );
}
```

### 5.17 `apps/web-insurtech-admin/src/components/AdminSidebar.tsx`

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  LayoutDashboard,
  Building2,
  Activity,
  ShieldCheck,
  FileBarChart,
  Settings,
  ScrollText,
  ShieldAlert,
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  key: 'dashboard' | 'tenants' | 'monitoring' | 'compliance' | 'reports' | 'settings' | 'audit';
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Roles autorises -- skeleton Sprint 5 / Sprint 7 affinera */
  roles: Array<'super_admin_platform' | 'analyst_support' | 'reporting_officer'>;
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin_platform', 'analyst_support', 'reporting_officer'],
  },
  {
    key: 'tenants',
    href: '/tenants',
    icon: Building2,
    roles: ['super_admin_platform', 'analyst_support'],
  },
  {
    key: 'monitoring',
    href: '/monitoring',
    icon: Activity,
    roles: ['super_admin_platform', 'analyst_support'],
  },
  {
    key: 'compliance',
    href: '/compliance',
    icon: ShieldCheck,
    roles: ['super_admin_platform', 'reporting_officer'],
  },
  {
    key: 'reports',
    href: '/reports',
    icon: FileBarChart,
    roles: ['super_admin_platform', 'reporting_officer'],
  },
  {
    key: 'settings',
    href: '/settings',
    icon: Settings,
    roles: ['super_admin_platform'],
  },
  {
    key: 'audit',
    href: '/audit',
    icon: ScrollText,
    roles: ['super_admin_platform', 'analyst_support'],
  },
];

interface AdminSidebarProps {
  /** Sprint 5 injectera le role JWT decode ; en Sprint 4 on assume super_admin */
  currentRole?: 'super_admin_platform' | 'analyst_support' | 'reporting_officer';
}

export function AdminSidebar({ currentRole = 'super_admin_platform' }: AdminSidebarProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('sidebar');

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(currentRole));

  return (
    <aside
      className="hidden w-sidebar-w shrink-0 flex-col border-r border-slate-800 bg-admin-surface md:flex"
      aria-label={t('navAriaLabel')}
    >
      <div className="flex h-topbar-h items-center gap-2 border-b border-slate-800 px-4">
        <ShieldAlert className="h-5 w-5 text-admin-accent" aria-hidden="true" />
        <span className="font-semibold tracking-tight text-white">
          Skalean <span className="text-admin-accent">Admin</span>
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label={t('mainNavAriaLabel')}>
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const itemHref = `/${locale}${item.href}`;
            const isActive = pathname === itemHref || pathname.startsWith(`${itemHref}/`);

            return (
              <li key={item.key}>
                <Link
                  href={itemHref}
                  aria-current={isActive ? 'page' : undefined}
                  className={clsx(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent focus-visible:ring-offset-2 focus-visible:ring-offset-admin-surface',
                    isActive
                      ? 'bg-admin-accent/15 text-admin-accent'
                      : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t(`items.${item.key}`)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-800 p-3 text-xs text-slate-500">
        <span data-testid="sidebar-role-indicator">{t('roleLabel')}: {currentRole}</span>
      </div>
    </aside>
  );
}
```

### 5.18 `apps/web-insurtech-admin/src/components/AdminTopbar.tsx`

```tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Bell, ChevronRight, User } from 'lucide-react';
import { routing } from '@/i18n/routing';

export function AdminTopbar() {
  const t = useTranslations('topbar');
  const locale = useLocale();
  const pathname = usePathname();

  // Breadcrumb minimal -- decoupe sur les segments apres /[locale]
  const segments = pathname
    .replace(`/${locale}`, '')
    .split('/')
    .filter(Boolean);

  return (
    <header
      className="flex h-topbar-h shrink-0 items-center justify-between border-b border-slate-800 bg-admin-surface/80 px-4 backdrop-blur"
      role="banner"
    >
      <nav aria-label={t('breadcrumbAriaLabel')}>
        <ol className="flex items-center gap-1 text-sm text-slate-400">
          <li>
            <span className="text-slate-500">{t('home')}</span>
          </li>
          {segments.map((seg, idx) => (
            <li key={seg} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-slate-600" aria-hidden="true" />
              <span
                className={
                  idx === segments.length - 1 ? 'font-medium text-white' : 'text-slate-400'
                }
              >
                {t(`crumb.${seg}`, { fallback: seg })}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex items-center gap-3">
        <select
          aria-label={t('localeSwitcher')}
          defaultValue={locale}
          className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
          onChange={(e) => {
            const newLocale = e.target.value;
            const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
            window.location.href = newPath;
          }}
        >
          {routing.locales.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>

        <button
          type="button"
          aria-label={t('notifications')}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>

        <button
          type="button"
          aria-label={t('userMenu')}
          className="flex items-center gap-2 rounded-md bg-slate-800/60 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
        >
          <User className="h-4 w-4" aria-hidden="true" />
          <span data-testid="topbar-user-role">super_admin_platform</span>
        </button>
      </div>
    </header>
  );
}
```

### 5.19 `apps/web-insurtech-admin/src/components/MetricCard.tsx`

```tsx
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  delta?: string;
  deltaTone?: 'positive' | 'negative' | 'neutral';
  description?: string;
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaTone = 'neutral',
  description,
}: MetricCardProps) {
  return (
    <article
      className="rounded-md border border-slate-800 bg-admin-surface/60 p-4 shadow-admin-card"
      aria-labelledby={`metric-${label.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <header className="flex items-center justify-between">
        <span
          id={`metric-${label.replace(/\s+/g, '-').toLowerCase()}`}
          className="text-xs font-medium uppercase tracking-wide text-slate-400"
        >
          {label}
        </span>
        <Icon className="h-4 w-4 text-admin-accent" aria-hidden="true" />
      </header>
      <p className="mt-3 font-mono text-2xl font-semibold text-white" data-testid="metric-value">
        {value}
      </p>
      {delta && (
        <p
          className={clsx(
            'mt-1 text-xs',
            deltaTone === 'positive' && 'text-emerald-400',
            deltaTone === 'negative' && 'text-rose-400',
            deltaTone === 'neutral' && 'text-slate-400',
          )}
        >
          {delta}
        </p>
      )}
      {description && <p className="mt-2 text-xs text-slate-500">{description}</p>}
    </article>
  );
}
```

### 5.20 `apps/web-insurtech-admin/src/components/RouteGuard.placeholder.tsx`

```tsx
'use client';

/**
 * Skeleton Sprint 5 -- RouteGuard pour platform admin.
 * Sprint 5 implementera : decode JWT depuis cookie httpOnly,
 * verifie claim platform_role parmi { super_admin_platform | analyst_support | reporting_officer },
 * redirige vers /login si absent ou expire.
 *
 * Pour Sprint 4, ce composant ne fait rien -- il rend ses children directement.
 * Aucune logique d'auth ici, c'est uniquement un point d'extension futur.
 */
import type { ReactNode } from 'react';

export function RouteGuardPlaceholder({ children }: { children: ReactNode }) {
  // TODO Sprint 5 : useSession() + verif platform_role + redirect /login
  // TODO Sprint 5 : useIdleTimer({ timeout: 15 * 60 * 1000 }) -> auto logout
  // TODO Sprint 14 : audit log au mount / unmount
  return <>{children}</>;
}
```

### 5.21 `apps/web-insurtech-admin/src/components/providers.tsx`

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { createQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
}
```

### 5.22 `apps/web-insurtech-admin/src/lib/api-client.ts`

```typescript
/**
 * Admin API client (port 3000 -> api-gateway port 4000).
 *
 * IMPORTANT -- distinction critique :
 * - Cette app est PLATFORM-LEVEL, NON multi-tenant.
 * - On NE PAS injecter le header `x-tenant-id` (les apps tenant le font).
 * - On INJECTE `x-platform-admin: true` pour signaler au backend de bypass RLS Postgres.
 * - On INJECTE `x-trace-id` (uuid v4) pour Sprint 14 audit log correlation.
 * - Sprint 5 ajoutera `Authorization: Bearer <jwt>` lu depuis cookie httpOnly.
 *
 * Lire decision-002 (multi-tenant RLS) -- s'applique aux apps tenant, pas a celle-ci.
 */
import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
  type AxiosError,
} from 'axios';
import { generateTraceId } from '@/lib/trace-id';
import { env } from '@/lib/env';

const PLATFORM_ADMIN_HEADER = 'x-platform-admin';
const TRACE_ID_HEADER = 'x-trace-id';
const TENANT_ID_HEADER = 'x-tenant-id';

export function createAdminApiClient(baseURL: string = env.NEXT_PUBLIC_API_BASE_URL): AxiosInstance {
  const instance = axios.create({
    baseURL,
    timeout: 15_000,
    withCredentials: true,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });

  // ---- Request interceptor : injection headers admin ----
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
      // Injection systematique du header platform-admin
      config.headers.set(PLATFORM_ADMIN_HEADER, 'true');

      // Trace id par requete (Sprint 14 correlation audit)
      const traceId = generateTraceId();
      config.headers.set(TRACE_ID_HEADER, traceId);

      // Suppression defensive si quelqu'un essaie d'ajouter x-tenant-id
      // (cette app est platform-level, RLS bypass)
      if (config.headers.has(TENANT_ID_HEADER)) {
        config.headers.delete(TENANT_ID_HEADER);
      }

      // Authorization Bearer Sprint 5 -- placeholder
      // const token = readPlatformSessionToken();
      // if (token) config.headers.set('Authorization', `Bearer ${token}`);

      return config;
    },
    (error: AxiosError) => Promise.reject(error),
  );

  // ---- Response interceptor : log + Sentry capture ----
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => {
      // Sprint 14 : log via Sentry capture aggressive
      if (typeof window !== 'undefined' && (window as any).Sentry) {
        (window as any).Sentry.captureException(error, {
          tags: {
            'api.endpoint': error.config?.url,
            'api.status': error.response?.status,
            'api.trace_id': error.config?.headers?.get?.(TRACE_ID_HEADER),
          },
        });
      }
      return Promise.reject(error);
    },
  );

  return instance;
}

export const adminApiClient = createAdminApiClient();
```

### 5.23 `apps/web-insurtech-admin/src/lib/query-client.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // 1 min -- admin data peu volatile
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false, // admin desktop, pas de focus thrashing
        retry: (failureCount, error: any) => {
          // Pas de retry sur 401 / 403 (auth invalid Sprint 5)
          if (error?.response?.status === 401 || error?.response?.status === 403) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false, // mutations admin = actions critiques, pas de retry silencieux
      },
    },
  });
}
```

### 5.24 `apps/web-insurtech-admin/src/lib/trace-id.ts`

```typescript
import { v4 as uuidv4 } from 'uuid';

/**
 * Genere un trace id W3C compatible.
 * Format simple uuid v4 ; Sprint 31 pourra basculer sur W3C Trace Context complet.
 */
export function generateTraceId(): string {
  return uuidv4();
}
```

### 5.25 `apps/web-insurtech-admin/src/lib/env.ts`

```typescript
import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default('web-insurtech-admin'),
  NEXT_PUBLIC_APP_VARIANT: z.literal('platform-admin').default('platform-admin'),
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_ADMIN_DOMAIN: z.string().default('admin.skalean-insurtech.ma'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z
    .enum(['development', 'staging', 'production'])
    .default('development'),
  NEXT_PUBLIC_MFA_REQUIRED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  NEXT_PUBLIC_SESSION_TIMEOUT_MIN: z
    .string()
    .default('15')
    .transform((v) => parseInt(v, 10)),
  NEXT_PUBLIC_ADMIN_IP_WHITELIST_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  NEXT_PUBLIC_CLOUD_REGION: z.string().default('atlas-benguerir-1'),
  NEXT_PUBLIC_LOCALE_DEFAULT: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),
  NEXT_PUBLIC_AUDIT_LOG_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  NEXT_PUBLIC_FEATURE_DARK_MODE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_VARIANT: process.env.NEXT_PUBLIC_APP_VARIANT,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_ADMIN_DOMAIN: process.env.NEXT_PUBLIC_ADMIN_DOMAIN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
  NEXT_PUBLIC_MFA_REQUIRED: process.env.NEXT_PUBLIC_MFA_REQUIRED,
  NEXT_PUBLIC_SESSION_TIMEOUT_MIN: process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MIN,
  NEXT_PUBLIC_ADMIN_IP_WHITELIST_ENABLED:
    process.env.NEXT_PUBLIC_ADMIN_IP_WHITELIST_ENABLED,
  NEXT_PUBLIC_CLOUD_REGION: process.env.NEXT_PUBLIC_CLOUD_REGION,
  NEXT_PUBLIC_LOCALE_DEFAULT: process.env.NEXT_PUBLIC_LOCALE_DEFAULT,
  NEXT_PUBLIC_AUDIT_LOG_ENABLED: process.env.NEXT_PUBLIC_AUDIT_LOG_ENABLED,
  NEXT_PUBLIC_FEATURE_DARK_MODE: process.env.NEXT_PUBLIC_FEATURE_DARK_MODE,
});

export type Env = z.infer<typeof envSchema>;
```

### 5.26 `apps/web-insurtech-admin/src/mocks/tenants.ts`

```typescript
export interface MockTenant {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended' | 'pending';
  userCount: number;
  createdAt: string;
}

export const mockTenants: MockTenant[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Sofidemy Assurances',
    slug: 'sofidemy',
    status: 'active',
    userCount: 47,
    createdAt: '2025-09-12',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'AGMA Lahlou Tazi',
    slug: 'agma',
    status: 'active',
    userCount: 38,
    createdAt: '2025-10-03',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Garage El Khayam Casablanca',
    slug: 'garage-el-khayam',
    status: 'active',
    userCount: 12,
    createdAt: '2026-01-15',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Reseau Atlas Mecanique',
    slug: 'atlas-meca',
    status: 'pending',
    userCount: 0,
    createdAt: '2026-04-22',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    name: 'Courtage Dakhla Sud',
    slug: 'dakhla-sud',
    status: 'suspended',
    userCount: 5,
    createdAt: '2025-11-08',
  },
];
```

### 5.27 `apps/web-insurtech-admin/src/mocks/metrics.ts`

```typescript
export const mockMetrics = {
  totalTenants: 5,
  activeTenants: 3,
  totalRevenueMad: 1_240_000,
  activeClaims: 87,
  alertsLast24h: 2,
  avgApiLatencyMs: 142,
  errorRatePct: 0.18,
};
```

### 5.28 `apps/web-insurtech-admin/src/messages/fr.json`

```json
{
  "sidebar": {
    "navAriaLabel": "Navigation principale administration",
    "mainNavAriaLabel": "Sections de l'administration",
    "roleLabel": "Role",
    "items": {
      "dashboard": "Tableau de bord",
      "tenants": "Tenants",
      "monitoring": "Monitoring",
      "compliance": "Conformite",
      "reports": "Rapports",
      "settings": "Parametres",
      "audit": "Journal d'audit"
    }
  },
  "topbar": {
    "home": "Skalean Admin",
    "breadcrumbAriaLabel": "Fil d'ariane",
    "localeSwitcher": "Changer de langue",
    "notifications": "Notifications plateforme",
    "userMenu": "Menu utilisateur",
    "crumb": {
      "dashboard": "Tableau de bord",
      "tenants": "Tenants",
      "monitoring": "Monitoring",
      "compliance": "Conformite",
      "reports": "Rapports",
      "settings": "Parametres",
      "audit": "Audit"
    }
  },
  "dashboard": {
    "title": "Vue d'ensemble plateforme",
    "subtitle": "Indicateurs cle de la plateforme Skalean InsurTech multi-tenant",
    "metrics": {
      "totalTenants": "Tenants total",
      "totalTenantsHint": "Tous statuts confondus (actif, suspendu, en attente)",
      "activeTenants": "Tenants actifs",
      "activeTenantsHint": "Tenants avec acces production ouvert",
      "totalRevenue": "Revenu cumule",
      "totalRevenueHint": "Commissions courtage + abonnements (MAD HT)",
      "activeClaims": "Sinistres actifs",
      "activeClaimsHint": "Sinistres ouverts cross-tenant en cours d'instruction"
    },
    "placeholder": {
      "title": "Donnees temps reel disponibles Sprint 27",
      "body": "Les indicateurs ci-dessus utilisent des donnees mockees pour la phase de bootstrap. Le branchement aux endpoints monitoring sera realise au Sprint 27."
    }
  },
  "tenants": {
    "title": "Gestion des tenants",
    "subtitle": "Liste des courtiers et garages connectes a la plateforme",
    "placeholder": {
      "notice": "Page placeholder. La gestion complete (creation, suspension, suppression) sera disponible au Sprint 28."
    },
    "table": {
      "name": "Nom",
      "slug": "Slug",
      "status": "Statut",
      "users": "Utilisateurs",
      "createdAt": "Cree le"
    },
    "status": {
      "active": "Actif",
      "suspended": "Suspendu",
      "pending": "En attente"
    },
    "actions": {
      "create": "Creer un tenant",
      "suspend": "Suspendre",
      "reactivate": "Reactiver",
      "delete": "Supprimer"
    }
  },
  "monitoring": {
    "title": "Monitoring cross-tenant",
    "subtitle": "Sante operationnelle et SLA de la plateforme",
    "placeholder": {
      "notice": "Page placeholder. Les graphiques temps reel seront branches au Sprint 27."
    },
    "charts": {
      "latency": "Latence API moyenne",
      "errorRate": "Taux d'erreur 5xx",
      "placeholder": "Graphique disponible Sprint 27"
    }
  },
  "compliance": {
    "title": "Conformite reglementaire",
    "subtitle": "Suivi obligations ACAPS, CNDP, DGI, Office des Changes",
    "placeholder": {
      "notice": "Page placeholder. Les indicateurs de conformite seront disponibles au Sprint 29."
    }
  },
  "reports": {
    "title": "Rapports reglementaires et financiers",
    "subtitle": "Generation de rapports periodiques signes",
    "placeholder": {
      "notice": "Page placeholder. La generation de rapports sera disponible au Sprint 29."
    },
    "categories": {
      "acaps": {
        "title": "Rapports ACAPS",
        "description": "Etat prudentiel trimestriel, ratio de solvabilite, provisions techniques agregees."
      },
      "cndp": {
        "title": "Rapports CNDP",
        "description": "Registre des traitements (loi 09-08 art. 18), violations donnees personnelles, demandes droits."
      },
      "dgi": {
        "title": "Rapports DGI",
        "description": "TVA collectee primes, IS, retenue a la source courtage."
      },
      "changes": {
        "title": "Office des Changes",
        "description": "Transactions devises pour reassurance internationale."
      }
    }
  },
  "audit": {
    "title": "Journal d'audit plateforme",
    "subtitle": "Toutes les actions des super-administrateurs Skalean Inc.",
    "placeholder": {
      "notice": "Page placeholder. Le journal complet sera disponible au Sprint 14 (audit log retention 5 ans)."
    }
  },
  "settings": {
    "title": "Parametres administration",
    "subtitle": "Configuration globale plateforme et roles",
    "placeholder": {
      "notice": "Page placeholder. Les parametres administration seront disponibles au Sprint 7 (RBAC platform)."
    }
  }
}
```

### 5.29 `apps/web-insurtech-admin/src/messages/ar-MA.json`

```json
{
  "sidebar": {
    "navAriaLabel": "Navigation princip ale ladministration",
    "mainNavAriaLabel": "Sections de ladministration",
    "roleLabel": "Dor",
    "items": {
      "dashboard": "Lawhat al qiyada",
      "tenants": "Lmoukhtarayine",
      "monitoring": "Lmuraqaba",
      "compliance": "Lmutabaaa",
      "reports": "Taqareer",
      "settings": "Lieadadat",
      "audit": "Sijill l muraqaba"
    }
  },
  "topbar": {
    "home": "Skalean Admin",
    "breadcrumbAriaLabel": "Tariq al ibhar",
    "localeSwitcher": "Tabdil al lugha",
    "notifications": "Tanbihat al manassa",
    "userMenu": "Qaimat al moustaeammil",
    "crumb": {
      "dashboard": "Lawhat al qiyada",
      "tenants": "Lmoukhtarayine",
      "monitoring": "Lmuraqaba",
      "compliance": "Lmutabaaa",
      "reports": "Taqareer",
      "settings": "Lieadadat",
      "audit": "Sijill"
    }
  },
  "dashboard": {
    "title": "Nathra eaama eala al manassa",
    "subtitle": "Mouashirat asasiyya li manassat Skalean InsurTech",
    "metrics": {
      "totalTenants": "Majmou al moukhtarayine",
      "totalTenantsHint": "Jamiya al halat",
      "activeTenants": "Lmoukhtarayine al nashitin",
      "activeTenantsHint": "Lmoukhtarayine maa wousoul li al intaj",
      "totalRevenue": "Lmadakhil al moutarakima",
      "totalRevenueHint": "Eumoulat al simsara wal ishtirakat",
      "activeClaims": "Latalibat al nashita",
      "activeClaimsHint": "Sinistres maftouha eber al moukhtarayine"
    },
    "placeholder": {
      "title": "Lmouashirat tatawafar fi sprint 27",
      "body": "Lbayanat moukhtaba li marhalat al iqlae faqat."
    }
  },
  "tenants": {
    "title": "Tasyir al moukhtarayine",
    "subtitle": "Laihat as samasira wal mahatat",
    "placeholder": {
      "notice": "Safha placeholder. At tasyir al kamil fi sprint 28."
    },
    "table": {
      "name": "Lism",
      "slug": "Lmuearif",
      "status": "Lhala",
      "users": "Lmoustaeamilin",
      "createdAt": "Tarikh al insha"
    },
    "status": {
      "active": "Nashit",
      "suspended": "Mualaq",
      "pending": "Fi al intidhar"
    },
    "actions": {
      "create": "Insha moukhtari",
      "suspend": "Taeleeq",
      "reactivate": "Ieadat tafeel",
      "delete": "Hadhf"
    }
  },
  "monitoring": {
    "title": "Lmuraqaba eber al moukhtarayine",
    "subtitle": "Sihat al amaliyat wa SLA li al manassa",
    "placeholder": {
      "notice": "Safha placeholder. Lmuraqaba al haya fi sprint 27."
    },
    "charts": {
      "latency": "Mutawasit zaman al istijaba",
      "errorRate": "Nisbat al akhta 5xx",
      "placeholder": "Lrasm bayani fi sprint 27"
    }
  },
  "compliance": {
    "title": "Lmutabaaa al qanouniyya",
    "subtitle": "Mutabaeat iltizamat ACAPS, CNDP, DGI",
    "placeholder": {
      "notice": "Safha placeholder. Sprint 29."
    }
  },
  "reports": {
    "title": "Taqareer qanouniyya wa maliyya",
    "subtitle": "Insha taqareer dawriyya mouwaqqaa",
    "placeholder": {
      "notice": "Safha placeholder. Sprint 29."
    },
    "categories": {
      "acaps": {
        "title": "Taqareer ACAPS",
        "description": "Halat ihtirazi rubeai, nisbat al malaaa, al ahtiyatat al taqniyya."
      },
      "cndp": {
        "title": "Taqareer CNDP",
        "description": "Sijill al moueamalat, intihakat al bayanat al shakhsiyya, talibat al houkouk."
      },
      "dgi": {
        "title": "Taqareer DGI",
        "description": "Adriba TVA, IS, hassm fi al masdar li al simsara."
      },
      "changes": {
        "title": "Maktab as sarf",
        "description": "Moueamalat al eumla li ieadat at tamine."
      }
    }
  },
  "audit": {
    "title": "Sijill muraqabat al manassa",
    "subtitle": "Jamiya amaliyat al moudirin al ueliya",
    "placeholder": {
      "notice": "Safha placeholder. Sprint 14."
    }
  },
  "settings": {
    "title": "Iaadadat al idara",
    "subtitle": "Lieadadat al eamma li al manassa",
    "placeholder": {
      "notice": "Safha placeholder. Sprint 7."
    }
  }
}
```

### 5.30 `apps/web-insurtech-admin/src/messages/ar.json`

```json
{
  "sidebar": {
    "navAriaLabel": "alttanaqul alraysiu lil iidara",
    "mainNavAriaLabel": "aqsaam al iidara",
    "roleLabel": "aldwr",
    "items": {
      "dashboard": "lawhat alqiyada",
      "tenants": "almustajirun",
      "monitoring": "almuraqaba",
      "compliance": "alimtithal",
      "reports": "altaqarir",
      "settings": "alaiedadaat",
      "audit": "sijiluu altadqiq"
    }
  },
  "topbar": {
    "home": "Skalean Admin",
    "breadcrumbAriaLabel": "fatat altanaqul",
    "localeSwitcher": "taghyir allughati",
    "notifications": "iisheaarat almnsa",
    "userMenu": "qaymat almustakhdim",
    "crumb": {
      "dashboard": "lawhat alqiyada",
      "tenants": "almustajirun",
      "monitoring": "almuraqaba",
      "compliance": "alimtithal",
      "reports": "altaqarir",
      "settings": "alaiedadaat",
      "audit": "altadqiq"
    }
  },
  "dashboard": {
    "title": "nazrat eammat ealaa almnsa",
    "subtitle": "almuasharat alraysiat li mnsat Skalean InsurTech",
    "metrics": {
      "totalTenants": "ijmaliu almustajiriin",
      "totalTenantsHint": "jamie alhalaat",
      "activeTenants": "almustajirun alnnashitun",
      "activeTenantsHint": "almustajirun maeahum nafadh lil iintaj",
      "totalRevenue": "alddakhl alttarakumi",
      "totalRevenueHint": "eumulat alsamsarat walaiishtirakat",
      "activeClaims": "almutalibat alnnashita",
      "activeClaimsHint": "sinistres maftuhat eabr almustajirin"
    },
    "placeholder": {
      "title": "albayanat fi sprint 27",
      "body": "albayanat tajribiyat fi marhalat alaiqlae."
    }
  },
  "tenants": {
    "title": "iidarat almustajiriin",
    "subtitle": "qaymat alwusataa walwarshat",
    "placeholder": {
      "notice": "safhat tahdid almawqie. al iidarat alkamilat fi sprint 28."
    },
    "table": {
      "name": "alasm",
      "slug": "almuearaf",
      "status": "alhalat",
      "users": "almustakhdimun",
      "createdAt": "tarikh al iinsha'"
    },
    "status": {
      "active": "nashit",
      "suspended": "muealaq",
      "pending": "fi alaintizar"
    },
    "actions": {
      "create": "iinsha mustajir",
      "suspend": "taeliq",
      "reactivate": "iieadat taftil",
      "delete": "hadhf"
    }
  },
  "monitoring": {
    "title": "almuraqabat eabr almustajirin",
    "subtitle": "sihhat altashghil wa SLA",
    "placeholder": {
      "notice": "safhat tahdid almawqie. sprint 27."
    },
    "charts": {
      "latency": "mutawasit zamani alaistijaba",
      "errorRate": "nisbat al'akhta 5xx",
      "placeholder": "alrrusum albayania fi sprint 27"
    }
  },
  "compliance": {
    "title": "al iimtithal lilqanun",
    "subtitle": "mutabaeat ACAPS, CNDP, DGI",
    "placeholder": {
      "notice": "safhat tahdid almawqie. sprint 29."
    }
  },
  "reports": {
    "title": "alttaqarir alttanzimiat walmaliata",
    "subtitle": "iinsha altaqarir aldawria",
    "placeholder": {
      "notice": "safhat tahdid almawqie. sprint 29."
    },
    "categories": {
      "acaps": {
        "title": "taqarir ACAPS",
        "description": "alhalat alaihtirazyt alrubeyt, nisbat almalaaa, alaihtiyatat alttaqniyat."
      },
      "cndp": {
        "title": "taqarir CNDP",
        "description": "sijiluu almueamalaat walaintihakaat walhquq."
      },
      "dgi": {
        "title": "taqarir DGI",
        "description": "darayib TVA wa IS walhasm fi almasdar."
      },
      "changes": {
        "title": "maktab alssarf",
        "description": "muamalat aleumlat li iieadat alttamiin."
      }
    }
  },
  "audit": {
    "title": "sijiluu altadqiq lilminassa",
    "subtitle": "jamie aleamaliyaat lil mudirin al'awliyaa'",
    "placeholder": {
      "notice": "safhat tahdid almawqie. sprint 14."
    }
  },
  "settings": {
    "title": "iiedadaat al iidara",
    "subtitle": "alaiedadaat aleamat lilminassa",
    "placeholder": {
      "notice": "safhat tahdid almawqie. sprint 7."
    }
  }
}
```

### 5.31 `apps/web-insurtech-admin/.env.example`

```bash
# ============================================================================
# web-insurtech-admin (port 3000) -- platform admin app
# Domaine prod : admin.skalean-insurtech.ma
# Cloud : Atlas Cloud Benguerir Maroc (decision-008 cloud souverain)
# ============================================================================

# --- App identity ---
NEXT_PUBLIC_APP_NAME=web-insurtech-admin
NEXT_PUBLIC_APP_VARIANT=platform-admin
NEXT_PUBLIC_ADMIN_DOMAIN=admin.skalean-insurtech.ma

# --- API ---
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# --- Auth & MFA (Sprint 5) ---
# MFA TOTP obligatoire pour TOUS les platform_role (loi 43-20 cybersecurite)
NEXT_PUBLIC_MFA_REQUIRED=true
# Session inactivite max -- 15 min (vs 60 min apps tenant)
NEXT_PUBLIC_SESSION_TIMEOUT_MIN=15

# --- IP whitelist (Sprint 31 hardening) ---
# false en Sprint 4-30, true en Sprint 31 avec liste IP corporate Skalean
NEXT_PUBLIC_ADMIN_IP_WHITELIST_ENABLED=false
# Liste IP separee par virgule (uniquement si flag ci-dessus = true)
ADMIN_IP_WHITELIST=

# --- Cloud souverain ---
NEXT_PUBLIC_CLOUD_REGION=atlas-benguerir-1

# --- i18n ---
NEXT_PUBLIC_LOCALE_DEFAULT=fr

# --- Audit log (Sprint 14) ---
NEXT_PUBLIC_AUDIT_LOG_ENABLED=true

# --- Sentry capture aggressive ---
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development
SENTRY_AUTH_TOKEN=

# --- Features flags ---
NEXT_PUBLIC_FEATURE_DARK_MODE=true
```

### 5.32 `apps/web-insurtech-admin/sentry.client.config.ts`

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'development',
  // Capture aggressive : 100% des transactions cote admin
  // Justification : audit Sprint 14 + faible volume (3 personae * < 100 actions / jour)
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.0, // pas de session replay (donnees sensibles)
  replaysOnErrorSampleRate: 1.0,
  beforeSend(event) {
    // Strip headers Authorization avant envoi
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['Authorization'];
      delete event.request.headers['cookie'];
      delete event.request.headers['Cookie'];
    }
    return event;
  },
  initialScope: {
    tags: {
      'app.name': 'web-insurtech-admin',
      'app.variant': 'platform-admin',
      'cloud.region': 'atlas-benguerir-1',
    },
  },
});
```

### 5.33 `apps/web-insurtech-admin/src/app/[locale]/layout.tsx` -- globals.css

`apps/web-insurtech-admin/src/app/[locale]/globals.css` :

```css
@import 'tailwindcss';

@theme {
  --color-admin-bg: #0F1A22;
  --color-admin-surface: #1A2730;
  --color-admin-accent: #E95D2C;
  --color-admin-muted: #6B7A87;
}

[data-theme='admin'] {
  --color-bg-primary: var(--color-admin-bg);
  --color-surface-primary: var(--color-admin-surface);
  --color-accent-primary: var(--color-admin-accent);
}

/* Reduce motion respect */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Focus visible default */
:focus-visible {
  outline: 2px solid var(--color-admin-accent);
  outline-offset: 2px;
}

/* Scrollbar styling discrete */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-thumb {
  background: rgba(107, 122, 135, 0.4);
  border-radius: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
```

---

## 6. Tests complets

### 6.1 `apps/web-insurtech-admin/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/unit/**/*.spec.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      exclude: ['node_modules', '.next', 'tests', '**/*.config.*', '**/mocks/**'],
      thresholds: {
        lines: 60,
        statements: 60,
        functions: 60,
        branches: 50,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 6.2 `apps/web-insurtech-admin/tests/setup.ts`

```typescript
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/fr/dashboard',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: any) =>
    params?.fallback ? params.fallback : key,
  useLocale: () => 'fr',
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock env (avoid Zod parse errors in tests)
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_APP_NAME: 'web-insurtech-admin',
    NEXT_PUBLIC_APP_VARIANT: 'platform-admin',
    NEXT_PUBLIC_API_BASE_URL: 'http://localhost:4000',
    NEXT_PUBLIC_MFA_REQUIRED: true,
    NEXT_PUBLIC_SESSION_TIMEOUT_MIN: 15,
    NEXT_PUBLIC_ADMIN_IP_WHITELIST_ENABLED: false,
    NEXT_PUBLIC_CLOUD_REGION: 'atlas-benguerir-1',
    NEXT_PUBLIC_LOCALE_DEFAULT: 'fr',
    NEXT_PUBLIC_AUDIT_LOG_ENABLED: true,
    NEXT_PUBLIC_FEATURE_DARK_MODE: true,
    NEXT_PUBLIC_ADMIN_DOMAIN: 'admin.skalean-insurtech.ma',
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: 'development',
  },
}));
```

### 6.3 `apps/web-insurtech-admin/tests/unit/api-client.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import MockAdapter from 'axios-mock-adapter';
import { createAdminApiClient } from '@/lib/api-client';

describe('admin api-client (platform-level, NOT tenant-scoped)', () => {
  let client: ReturnType<typeof createAdminApiClient>;
  let mock: MockAdapter;

  beforeEach(() => {
    client = createAdminApiClient('http://localhost:4000');
    mock = new MockAdapter(client);
  });

  it('NEVER injects x-tenant-id header (this is platform-level app)', async () => {
    mock.onGet('/v1/health').reply((config) => {
      expect(config.headers?.['x-tenant-id']).toBeUndefined();
      return [200, { ok: true }];
    });
    await client.get('/v1/health');
  });

  it('always injects x-platform-admin: true header', async () => {
    mock.onGet('/v1/health').reply((config) => {
      expect(config.headers?.['x-platform-admin']).toBe('true');
      return [200, { ok: true }];
    });
    await client.get('/v1/health');
  });

  it('injects x-trace-id with valid uuid v4 format', async () => {
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    mock.onGet('/v1/health').reply((config) => {
      const traceId = config.headers?.['x-trace-id'] as string | undefined;
      expect(traceId).toMatch(uuidV4Regex);
      return [200, { ok: true }];
    });
    await client.get('/v1/health');
  });

  it('strips x-tenant-id even if caller tries to inject it', async () => {
    mock.onGet('/v1/health').reply((config) => {
      expect(config.headers?.['x-tenant-id']).toBeUndefined();
      return [200, { ok: true }];
    });
    await client.get('/v1/health', {
      headers: { 'x-tenant-id': 'malicious-tenant-id' },
    });
  });

  it('emits two distinct trace ids on two consecutive requests', async () => {
    const captured: string[] = [];
    mock.onGet('/v1/health').reply((config) => {
      captured.push(config.headers?.['x-trace-id'] as string);
      return [200, { ok: true }];
    });
    await client.get('/v1/health');
    await client.get('/v1/health');
    expect(captured.length).toBe(2);
    expect(captured[0]).not.toBe(captured[1]);
  });
});
```

### 6.4 `apps/web-insurtech-admin/tests/unit/AdminSidebar.spec.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminSidebar } from '@/components/AdminSidebar';

describe('AdminSidebar', () => {
  it('renders 7 sections for super_admin_platform role', () => {
    render(<AdminSidebar currentRole="super_admin_platform" />);
    expect(screen.getByText('sidebar.items.dashboard')).toBeInTheDocument();
    expect(screen.getByText('sidebar.items.tenants')).toBeInTheDocument();
    expect(screen.getByText('sidebar.items.monitoring')).toBeInTheDocument();
    expect(screen.getByText('sidebar.items.compliance')).toBeInTheDocument();
    expect(screen.getByText('sidebar.items.reports')).toBeInTheDocument();
    expect(screen.getByText('sidebar.items.settings')).toBeInTheDocument();
    expect(screen.getByText('sidebar.items.audit')).toBeInTheDocument();
  });

  it('hides settings + reports for analyst_support role', () => {
    render(<AdminSidebar currentRole="analyst_support" />);
    expect(screen.queryByText('sidebar.items.settings')).not.toBeInTheDocument();
    expect(screen.queryByText('sidebar.items.reports')).not.toBeInTheDocument();
    expect(screen.getByText('sidebar.items.dashboard')).toBeInTheDocument();
    expect(screen.getByText('sidebar.items.tenants')).toBeInTheDocument();
  });

  it('hides tenants + monitoring + settings for reporting_officer', () => {
    render(<AdminSidebar currentRole="reporting_officer" />);
    expect(screen.queryByText('sidebar.items.tenants')).not.toBeInTheDocument();
    expect(screen.queryByText('sidebar.items.monitoring')).not.toBeInTheDocument();
    expect(screen.queryByText('sidebar.items.settings')).not.toBeInTheDocument();
    expect(screen.getByText('sidebar.items.dashboard')).toBeInTheDocument();
    expect(screen.getByText('sidebar.items.compliance')).toBeInTheDocument();
    expect(screen.getByText('sidebar.items.reports')).toBeInTheDocument();
  });

  it('displays the current role indicator at the bottom', () => {
    render(<AdminSidebar currentRole="super_admin_platform" />);
    const indicator = screen.getByTestId('sidebar-role-indicator');
    expect(indicator).toHaveTextContent('super_admin_platform');
  });
});
```

### 6.5 `apps/web-insurtech-admin/tests/unit/AdminTopbar.spec.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AdminTopbar } from '@/components/AdminTopbar';

describe('AdminTopbar', () => {
  it('renders the home crumb', () => {
    render(<AdminTopbar />);
    expect(screen.getByText('topbar.home')).toBeInTheDocument();
  });

  it('renders the locale switcher with 3 options', () => {
    render(<AdminTopbar />);
    const switcher = screen.getByLabelText('topbar.localeSwitcher') as HTMLSelectElement;
    expect(switcher.options.length).toBe(3);
    expect(Array.from(switcher.options).map((o) => o.value)).toEqual(['fr', 'ar-MA', 'ar']);
  });

  it('exposes the user role in topbar', () => {
    render(<AdminTopbar />);
    expect(screen.getByTestId('topbar-user-role')).toHaveTextContent('super_admin_platform');
  });
});
```

### 6.6 `apps/web-insurtech-admin/tests/unit/MetricCard.spec.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Building2 } from 'lucide-react';
import { MetricCard } from '@/components/MetricCard';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard icon={Building2} label="Total Tenants" value="42" />);
    expect(screen.getByText('Total Tenants')).toBeInTheDocument();
    expect(screen.getByTestId('metric-value')).toHaveTextContent('42');
  });

  it('applies positive tone class when deltaTone is positive', () => {
    render(
      <MetricCard
        icon={Building2}
        label="X"
        value="1"
        delta="+5"
        deltaTone="positive"
      />,
    );
    const delta = screen.getByText('+5');
    expect(delta.className).toContain('emerald');
  });

  it('renders description when provided', () => {
    render(
      <MetricCard
        icon={Building2}
        label="X"
        value="1"
        description="hint text"
      />,
    );
    expect(screen.getByText('hint text')).toBeInTheDocument();
  });
});
```

### 6.7 `apps/web-insurtech-admin/tests/unit/providers.spec.tsx`

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Providers } from '@/components/providers';

describe('Providers', () => {
  it('wraps children without crashing', () => {
    render(
      <Providers>
        <div>child node</div>
      </Providers>,
    );
    expect(screen.getByText('child node')).toBeInTheDocument();
  });

  it('mounts a single QueryClient instance', () => {
    const { rerender } = render(
      <Providers>
        <div>a</div>
      </Providers>,
    );
    rerender(
      <Providers>
        <div>b</div>
      </Providers>,
    );
    // Smoke : pas d'erreur de double-mount
    expect(screen.getByText('b')).toBeInTheDocument();
  });
});
```

### 6.8 `apps/web-insurtech-admin/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### 6.9 `apps/web-insurtech-admin/tests/e2e/admin.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('web-insurtech-admin (port 3000)', () => {
  test('home renders Navy admin theme on locale fr', async ({ page }) => {
    await page.goto('/fr/dashboard');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'admin');
    await expect(html).toHaveAttribute('lang', 'fr');
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('sidebar exposes 7 sections all clickable', async ({ page }) => {
    await page.goto('/fr/dashboard');
    const sections = ['Tableau de bord', 'Tenants', 'Monitoring', 'Conformite', 'Rapports', 'Parametres', 'Journal'];
    for (const sectionLabel of sections) {
      await expect(page.getByRole('link', { name: new RegExp(sectionLabel, 'i') })).toBeVisible();
    }
  });

  test('NO public access without auth shows skeleton (Sprint 5 will replace)', async ({ page }) => {
    // En Sprint 4 le RouteGuardPlaceholder rend les enfants directement
    // Sprint 5 redirigera vers /login -- ce test sera mis a jour
    await page.goto('/fr/dashboard');
    await expect(page).toHaveURL(/\/fr\/dashboard$/);
  });

  test('strict security headers are present', async ({ request }) => {
    const response = await request.get('/fr/dashboard');
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(response.headers()['strict-transport-security']).toContain('max-age=63072000');
    expect(response.headers()['strict-transport-security']).toContain('preload');
  });

  test('locale switcher changes URL prefix (fr -> ar-MA)', async ({ page }) => {
    await page.goto('/fr/dashboard');
    const switcher = page.getByLabel(/topbar\.localeSwitcher|Changer de langue/i);
    await switcher.selectOption('ar-MA');
    await page.waitForURL(/\/ar-MA\/dashboard/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar-MA');
  });

  test('no console error on dashboard load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/fr/dashboard');
    await page.waitForLoadState('networkidle');
    // Ignore Sentry / next-intl warnings non-bloquants ; assert pas d'erreur critique
    const critical = errors.filter((e) => !e.includes('Sentry') && !e.includes('intl'));
    expect(critical).toHaveLength(0);
  });
});
```

---

## 7. Variables environnement

Variables exposees dans `.env.example` (cf. section 5.31) -- 16 variables au total :

| Variable | Type | Defaut | Sprint origine | Description |
|----------|------|--------|----------------|-------------|
| `NEXT_PUBLIC_APP_NAME` | string | web-insurtech-admin | 4 | Nom app pour Sentry tags |
| `NEXT_PUBLIC_APP_VARIANT` | enum | platform-admin | 4 | Variant theme (vs tenant) |
| `NEXT_PUBLIC_ADMIN_DOMAIN` | string | admin.skalean-insurtech.ma | 4 | Domaine prod |
| `NEXT_PUBLIC_API_BASE_URL` | url | http://localhost:4000 | 3 | API gateway |
| `NEXT_PUBLIC_MFA_REQUIRED` | bool | true | 5 | Force MFA |
| `NEXT_PUBLIC_SESSION_TIMEOUT_MIN` | int | 15 | 5 | Timeout idle |
| `NEXT_PUBLIC_ADMIN_IP_WHITELIST_ENABLED` | bool | false | 31 | Toggle IP whitelist |
| `ADMIN_IP_WHITELIST` | csv | empty | 31 | Liste IP corporate |
| `NEXT_PUBLIC_CLOUD_REGION` | string | atlas-benguerir-1 | 1 | Decision-008 |
| `NEXT_PUBLIC_LOCALE_DEFAULT` | enum | fr | 4 | Locale par defaut admin |
| `NEXT_PUBLIC_AUDIT_LOG_ENABLED` | bool | true | 14 | Toggle audit log |
| `NEXT_PUBLIC_SENTRY_DSN` | string | empty | 4 | Sentry endpoint |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | enum | development | 4 | Sentry env tag |
| `SENTRY_AUTH_TOKEN` | secret | empty | 4 | Build-time upload sourcemap |
| `NEXT_PUBLIC_FEATURE_DARK_MODE` | bool | true | 4 | Toggle dark mode (admin force dark) |

Validation par Zod dans `src/lib/env.ts` (cf. section 5.25). Toute env var manquante en prod casse le build (fail-fast).

---

## 8. Commandes shell

```bash
# === Bootstrap depuis racine monorepo ===
cd repo

# Installation deps (workspace)
pnpm install --filter @insurtech/web-insurtech-admin...

# === Dev ===
pnpm dev --filter @insurtech/web-insurtech-admin
# ouvre http://localhost:3000 -> redirige vers /fr/dashboard

# === Lint + typecheck ===
pnpm --filter @insurtech/web-insurtech-admin run lint
pnpm --filter @insurtech/web-insurtech-admin run typecheck

# === Tests unit ===
pnpm --filter @insurtech/web-insurtech-admin run test

# === Tests E2E ===
pnpm --filter @insurtech/web-insurtech-admin exec playwright install --with-deps chromium
pnpm --filter @insurtech/web-insurtech-admin run test:e2e

# === Build prod ===
pnpm --filter @insurtech/web-insurtech-admin run build
pnpm --filter @insurtech/web-insurtech-admin run start

# === Verification headers HTTP ===
curl -sI http://localhost:3000/fr/dashboard | grep -E '(X-Frame|X-Content|Content-Security|Strict-Transport|Referrer-Policy|Permissions-Policy)'

# === Lighthouse CI baseline (desktop) ===
npx lighthouse http://localhost:3000/fr/dashboard \
  --preset=desktop \
  --only-categories=performance,accessibility,best-practices \
  --output=json --output-path=./lighthouse-admin.json

# === Verification absence x-tenant-id (Playwright network capture) ===
pnpm --filter @insurtech/web-insurtech-admin exec playwright test admin.spec.ts -g "x-tenant"

# === Bundle analyzer (P2) ===
ANALYZE=true pnpm --filter @insurtech/web-insurtech-admin run build
```

---

## 9. Criteres de validation V1-V28

| ID | Priorite | Critere | Methode de verification |
|----|----------|---------|--------------------------|
| V1 | P0 | App demarre sur port 3000 | `curl -sI http://localhost:3000` retourne 200 ou 307 |
| V2 | P0 | Theme variant admin (Navy dominant) applique | Inspect DOM `<html data-theme="admin">` |
| V3 | P0 | Sidebar avec 7 sections rendues | Test unit AdminSidebar.spec.tsx + Playwright |
| V4 | P0 | Aucune requete sortante avec `x-tenant-id` | Test unit api-client.spec.ts |
| V5 | P0 | Toutes requetes sortantes ont `x-platform-admin: true` | Test unit api-client.spec.ts |
| V6 | P0 | Lighthouse Performance desktop >= 70 | `lighthouse --preset=desktop` |
| V7 | P0 | Lighthouse Accessibility >= 90 | `lighthouse` |
| V8 | P0 | Build prod reussit sans erreur TS | `pnpm build` exit code 0 |
| V9 | P0 | Locale par defaut FR | Redirect `/` -> `/fr/dashboard` |
| V10 | P0 | Meta tag `session-timeout-min: 15` present | Inspect HTML head |
| V11 | P0 | CSP strict avec `frame-ancestors 'none'` | `curl -I` |
| V12 | P0 | Aucune erreur console au load dashboard | Playwright `page.on('console')` |
| V13 | P0 | Header X-Frame-Options DENY | `curl -I` |
| V14 | P0 | HSTS preload max-age 63072000 | `curl -I` |
| V15 | P0 | Tests Vitest passent (17 tests) | `pnpm test` exit 0 |
| V16 | P0 | Tests Playwright passent (6 tests) | `pnpm test:e2e` exit 0 |
| V17 | P0 | RouteGuardPlaceholder presente squelette Sprint 5 | Code review fichier present |
| V18 | P0 | x-trace-id UUID v4 sur chaque requete | Test unit api-client.spec.ts |
| V19 | P0 | Locale switcher fonctionne (fr / ar-MA / ar) | Playwright |
| V20 | P0 | RTL active quand locale=ar | DOM `<html dir="rtl">` |
| V21 | P0 | Sentry init avec tracesSampleRate 1.0 | Code review sentry.client.config.ts |
| V22 | P0 | Sentry strip Authorization header | Code review beforeSend |
| V23 | P1 | Lighthouse Best Practices >= 95 | `lighthouse` |
| V24 | P1 | Coverage Vitest lines >= 60% | `pnpm test --coverage` |
| V25 | P1 | Bundle initial JS <= 250 ko gzip | `pnpm build` output |
| V26 | P1 | aria-label present sur tous les boutons icones | Test a11y axe |
| V27 | P1 | Couleur contraste WCAG AA conforme | `lighthouse` accessibility audit |
| V28 | P2 | `noindex` meta tag rendu | Inspect HTML head |

---

## 10. Edge cases (8+)

1. **Super admin tente role escalation via localStorage** -- un attaquant XSS modifie `localStorage.setItem('platform_role', 'super_admin_platform')`. **Mitigation Sprint 5** : le role est lu uniquement depuis JWT decode serveur (cookie httpOnly, jamais expose JS). Aucune lecture localStorage dans `RouteGuard`.

2. **Session expire pendant remplissage formulaire tenant** -- le user navigue depuis 14:30 vers `/tenants/new`, remplit pendant 16 min, soumet a 14:46 (timeout 15 min depasse). **Comportement attendu Sprint 5** : intercept 401 -> modal "Session expiree", sauvegarde brouillon dans IndexedDB, force re-auth, restore brouillon.

3. **IP whitelisting bloque admin en deplacement** -- super-admin en mission a l'etranger, IP n'est pas whitelistee, recoit 403 Forbidden. **Mitigation Sprint 31** : VPN corporate Cloudflare WARP pour egress IP fixe, OU procedure d'urgence pour ajouter IP temporaire via Slack signe.

4. **Cross-site iframe attempt (clickjacking)** -- attaquant cree page `evil.com` qui iframe `admin.skalean-insurtech.ma/tenants` avec opacity 0 par-dessus un faux bouton. **Mitigation Sprint 4** : `X-Frame-Options: DENY` (header HTTP) + `frame-ancestors 'none'` (CSP). Test E2E verifie les headers presents.

5. **Locale switch fr -> ar avec sidebar dense** -- en RTL, la sidebar bascule a droite. Les classes Tailwind logiques `start-0` / `end-0` doivent etre utilisees. Le composant `<AdminSidebar>` declare `start-0` implicite via `flex` ; en RTL le navigateur inverse automatiquement. Test Playwright ajoute pour verifier la position visuelle.

6. **Sentry doit capturer chaque action admin** -- Sprint 14 audit log s'appuie sur Sentry breadcrumbs + custom events. La tache 1.4.4 expose `tracesSampleRate: 1.0` (capture 100%). Sprint 14 ajoute `Sentry.addBreadcrumb({ category: 'admin.action', ... })` dans le hook `useAdminAction`.

7. **User profile change requires re-auth** -- super_admin tente de modifier son propre email. **Comportement Sprint 5** : un endpoint `PATCH /platform/users/me` retourne 412 Precondition Failed avec header `WWW-Authenticate: ReAuthRequired`. Le frontend ouvre modal MFA TOTP avant de retry.

8. **Tenant filter must be platform-aware** -- Sprint 28, la recherche tenant ne doit JAMAIS appliquer un filtre `tenant_id=current_user.tenant_id` (l'admin n'a pas de tenant_id). **Mitigation** : le client API ne porte pas le header, le backend traite la requete sans clause WHERE tenant_id.

9. **Audit log persistence avant action critique** -- le pattern "log-then-act" : avant de suspendre un tenant, ecrire l'entree audit en DB ; si l'audit echoue, ne pas executer l'action (transaction Postgres). Sprint 14 implementera. La tache 1.4.4 prepare le hook `useAdminAction()` (placeholder).

10. **Tab inactive timer reset** -- l'admin ouvre un onglet, le laisse en background 14 min, revient et clique. Le `useIdleTimer` Sprint 5 ne doit PAS considerer "inactive" si `document.visibilityState === 'hidden'` -- il doit reset le timer au `visibilitychange` retour.

11. **Network offline pendant generation rapport** -- Sprint 29 reports peuvent prendre 30s+. Si le reseau coupe, le client doit retry (Axios n'a PAS de retry par defaut sur mutations -- `retry: false` Sprint 4). Comportement attendu Sprint 29 : queue locale + reprise.

12. **Browser tab dupliquee** -- super_admin ouvre `/tenants` dans tab A, clone tab vers tab B, modifie tenant X dans tab A, l'effet doit etre reflete dans tab B via React Query refetch + invalidation. Sprint 28 ajoute `useQueryClient().invalidateQueries(['tenants'])` apres mutation.

---

## 11. Conformite Maroc

Cette app est le point de friction reglementaire le plus eleve du systeme -- 4 cadres legaux marocains s'y appliquent :

### 11.1 Loi 09-08 (CNDP, donnees personnelles)

- **Article 18** -- registre des traitements : Sprint 29 `/reports/cndp` genere le registre obligatoire. Cette tache 1.4.4 prepare la page placeholder.
- **Article 21** -- notification violation : la sidebar expose `/audit` (placeholder Sprint 14) qui Sprint 31 declenchera un workflow de notification CNDP automatique sous 72h en cas de breach.
- **Localisation des donnees** : decision-008 cloud souverain Atlas Cloud Benguerir. L'env var `NEXT_PUBLIC_CLOUD_REGION=atlas-benguerir-1` est documentee.
- **Acces super-admin trace** : chaque consultation par un super-admin Skalean d'une donnee personnelle d'un assure / courtier est logguee Sprint 14 (CNDP exige justification de finalite).

### 11.2 Loi 43-20 (cybersecurite)

- **MFA obligatoire roles a privileges** : `NEXT_PUBLIC_MFA_REQUIRED=true` declare ici, implemente Sprint 5 (TOTP RFC 6238).
- **Journalisation 12 mois minimum** : audit log Sprint 14 + retention 5 ans (depasse l'exigence DGSSI).
- **Headers securite stricts** : HSTS preload, CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy no-referrer -- tous cables Sprint 4.
- **Chiffrement TLS 1.3** : impose au niveau ingress Kubernetes Atlas Cloud (config Sprint 31 hardening).

### 11.3 Decret 2-19-689 (audit trail administratif)

- Obligation de retention **5 ans** pour les actions administratives plateforme.
- Sprint 14 implementera l'ecriture immuable (append-only table partitionnee par mois, archivage S3 Atlas Cloud).
- La page `/audit` (placeholder Sprint 4) prepare le UI de consultation reglementaire.

### 11.4 ACAPS (Autorite Controle Assurances et Prevoyance Sociale)

- **Etats prudentiels trimestriels** : Sprint 29 `/reports/acaps` genere les rapports format Excel reglemente (template ACAPS 2024). Skalean en tant qu'agregateur multi-courtiers genere les agreges consolides.
- **Format SIPS** (Systeme d'Information Prudentiel) : Sprint 29 implementera l'export XML conforme.
- **Acces admin trace** : chaque generation de rapport ACAPS est signee numeriquement (Sprint 29 + signature electronique CNRP).

### 11.5 Office des Changes

- **Reassurance internationale** : Sprint 29 `/reports/changes` documente les flux devises pour reassurance via marche international.
- Pas d'impact direct Sprint 4 (placeholder).

### 11.6 DGI (impots et taxes)

- **TVA assurance** : retenue source courtage, Sprint 29 generera les declarations.
- **IS** : agregations cross-tenant pour Skalean Inc. (la holding) et per-tenant pour les courtiers.

---

## 12. Conventions absolues (14 regles)

1. **Aucun emoji** dans le code, commits, copies UI, commentaires (decision-006). Verifie par hook pre-commit.
2. **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Aucun `any` non-justifie (commentaire `// eslint-disable-next-line` requis avec raison).
3. **Imports ordonnes** : externals -> `@insurtech/*` packages -> `@/` aliases -> relatives.
4. **Composants nommes** (pas de default export pour composants reutilisables) sauf pages Next.js (qui exigent default).
5. **`use client` minimal** : preferer Server Components ; declarer `use client` uniquement quand state / events necessaires (sidebar, topbar, providers).
6. **CSS variables tokens** uniquement (pas de hexa code en dur dans Tailwind classes -- utiliser `bg-admin-surface` plutot que `bg-[#1A2730]`).
7. **`@insurtech/shared-ui`** consomme pour tous les primitives (Button, Card, Sheet, etc.) -- ne PAS recreer en local.
8. **`x-tenant-id` interdit** dans cette app (test unitaire le verifie).
9. **`x-platform-admin: true` injecte** systematiquement (test unitaire le verifie).
10. **Locales 3** (`fr`, `ar-MA`, `ar`) avec FR par defaut. Tous les strings UI passent par `useTranslations()`.
11. **A11y** : aria-label sur tous les boutons icones, role landmarks (`<aside>`, `<header role="banner">`, `<main role="main">`, `<nav aria-label>`), focus visible, contraste WCAG AA.
12. **Tests obligatoires** : minimum 17 unit + 6 E2E avant merge.
13. **Aucun fichier .md genere par l'agent** (sauf README minimal apps).
14. **Commit conventionnel** : `feat(admin): bootstrap web-insurtech-admin port 3000` (cf. section 14).

---

## 13. Validation pre-commit

Avant tout commit, executer :

```bash
# 1. Lint (zero warning toleres)
pnpm --filter @insurtech/web-insurtech-admin run lint

# 2. Typecheck
pnpm --filter @insurtech/web-insurtech-admin run typecheck

# 3. Tests unit (17 tests)
pnpm --filter @insurtech/web-insurtech-admin run test

# 4. Tests E2E (6 tests)
pnpm --filter @insurtech/web-insurtech-admin run test:e2e

# 5. Build prod (verifier output standalone)
pnpm --filter @insurtech/web-insurtech-admin run build

# 6. Verifier absence emoji dans diff (hook husky)
git diff --cached | grep -P "[\x{1F300}-\x{1F9FF}]" && echo "EMOJI DETECTE" && exit 1

# 7. Verifier absence x-tenant-id dans diff
git diff --cached -- 'apps/web-insurtech-admin/**/*.ts' 'apps/web-insurtech-admin/**/*.tsx' | grep -i 'x-tenant-id' && echo "X-TENANT-ID DETECTE" && exit 1

# 8. Lighthouse baseline desktop
npx lighthouse http://localhost:3000/fr/dashboard --preset=desktop --output=json --output-path=./lighthouse-admin.json
node ./scripts/check-lighthouse.js ./lighthouse-admin.json --perf 70 --a11y 90 --bp 95
```

---

## 14. Commit message

Suivre Conventional Commits + scope `admin`.

```
feat(admin): bootstrap web-insurtech-admin port 3000 (Sprint 4 / 1.4.4)

Bootstrap de l'app SuperAdmin platform Skalean Inc.
- Port 3000, domaine prod admin.skalean-insurtech.ma
- Theme variant admin (Navy #1A2730 dominant, Orange accent)
- 7 sections sidebar : dashboard, tenants, monitoring, conformite,
  rapports, parametres, audit log
- Multilingue fr (default) / ar-MA / ar avec RTL
- Headers HTTP les plus stricts du monorepo : HSTS preload 2 ans,
  X-Frame-Options DENY, CSP strict avec frame-ancestors 'none',
  Referrer-Policy no-referrer, Permissions-Policy verrouille
- Client API dedicacie : NO x-tenant-id, x-platform-admin: true,
  x-trace-id UUID v4 par requete
- Sentry init aggressive tracesSampleRate 1.0 + strip Authorization
- Skeleton Sprint 5 : RouteGuardPlaceholder, MFA flag, session
  timeout 15 min, IP whitelist dormant Sprint 31
- Pages placeholder : /dashboard, /tenants (Sprint 28),
  /monitoring (Sprint 27), /reports (Sprint 29), /compliance,
  /audit (Sprint 14), /settings (Sprint 7)
- Tests : 17 unit (Vitest) + 6 E2E (Playwright chromium desktop)
- Lighthouse desktop : Perf >= 70, A11y >= 90, BP >= 95

Refs: tache 1.4.4 / sprint 4 / B-04
Depend de: 1.4.3 (web-garage-mobile)
Bloque: 1.4.5 (web-customer-portal), Sprint 5 (auth), Sprint 7 (RBAC),
        Sprint 14 (audit), Sprint 27 (monitoring), Sprint 28 (tenants),
        Sprint 29 (reports), Sprint 31 (IP whitelist)
Conformite: loi 09-08 CNDP, loi 43-20 cybersecurite,
            decret 2-19-689 audit trail 5 ans, ACAPS prudentiel
Cloud: Atlas Cloud Benguerir Maroc (decision-008 souverain)
Decisions: decision-006 (no emoji), decision-007 (mock period),
           decision-008 (cloud souverain)
```

---

## 15. Workflow next step

**Tache suivante** : `1.4.5 -- web-customer-portal bootstrap port 3004 (SSG + ISR + SEO)`.

Fichier : `00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.5-web-customer-portal-bootstrap-port-3004.md`.

Dependances heritees de 1.4.4 :
- Confirme la stabilite du toolchain (`@insurtech/shared-ui`, `next-intl`, `@tanstack/react-query`, `@sentry/nextjs`).
- Pattern multilingue 3 locales (fr / ar-MA / ar) reutilise.
- 1.4.5 divergera sur : SSG + ISR (le portail public est SEO-critical), pas de RouteGuard (acces public), CSP plus permissive (analytics third-party), bundle JS plus petit (cible Lighthouse Perf >= 95 SEO).

Avant de demarrer 1.4.5 :
- Valider que 1.4.4 passe les V1-V22 (P0).
- Tagger le commit `feat(admin): bootstrap web-insurtech-admin (1.4.4)` avec `sprint-4-task-4-done`.
- Mettre a jour le suivi Linear / Jira.

---

## 16. Footer

**Tache** : 1.4.4 -- web-insurtech-admin bootstrap port 3000.
**Sprint** : 4 / 35 -- Frontend Bootstrap.
**Phase** : 1 -- Bootstrap.
**Document** : Skalean InsurTech Cowork Generation v2.
**Lignes directrices** : decision-006 (no emoji), decision-007 (mock period Sprint 4-28), decision-008 (cloud souverain Atlas Cloud Benguerir).
**Conformite** : loi 09-08 CNDP, loi 43-20 cybersecurite, decret 2-19-689 audit trail 5 ans, ACAPS prudentiel.
**Stack** : Next.js 15.1.0 / React 19.0.0 / Tailwind 4.0.0-beta.4 / TypeScript 5.7.2 / next-intl 3.26.3 / TanStack React Query 5.62.7 / TanStack React Table 8.20.5 / Recharts 2.15.0 / Axios 1.7.9 / Sentry 8.45.0 / Lucide React 0.469.0 / Playwright 1.49.1 / Vitest 2.1.8.
**Effort** : 5h.
**Priorite** : P0.
**Depend de** : 1.4.3.
**Bloque** : 1.4.5, Sprints 5 / 7 / 14 / 27 / 28 / 29 / 31.

---
