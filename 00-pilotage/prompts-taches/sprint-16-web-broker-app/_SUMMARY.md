# SPRINT 16 -- WEB BROKER APP SaaS B2B -- INDEX DES PROMPTS TACHES

**Sprint** : 16 / 35 (cumul) -- Phase 4 Sprint 3 -- Vertical Insure
**Phase** : 4 -- Vertical Insure (premier UI metier production)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md`
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite globale** : P0 (premier UI metier production -- demonstration valeur Skalean Broker)
**Generation** : Cowork Generation Agent v2 (mode dense)
**Date generation** : 2026-05-18
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. Objectif Global du Sprint

Livrer l'**App web-broker Next.js 15 App Router production-ready** (port 3001 -- app.skalean-insurtech.ma) comme premier UI metier complet du vertical Insure consommant les services backend Sprints 5-15 (Auth, Multi-tenant, RBAC, Contacts, Companies, Deals, Polices, BrokerValidationQueue, ProvisionalPolicy, Sinistres RO). Cet UI demontre la valeur Skalean Broker aux cabinets de courtage marocains (PME 5-50 employes).

A la sortie de ce sprint :
- 1 app Next.js 15 production-ready sur port 3001 (domain prod : app.skalean-insurtech.ma)
- 12 pages : login + MFA verify + signup + recovery + dashboard + contacts + companies + deals + polices + broker-queue + sinistres (read-only) + parametres + profile
- 6 widgets dashboard (KPIs pipeline + courbe primes + repartition produits + alertes SLA + top deals + activite recente)
- Kanban (drag-drop dnd-kit) + Table views deals (basculement vue)
- Optimistic UI updates via @tanstack/react-query (cache invalidation + rollback erreur)
- I18n complete fr / ar-MA (Darija) / ar (classique) + RTL CSS via next-intl 3.26.3
- RBAC UI : 3 roles broker (admin / user / assistant) avec conditional rendering granulaire (PermissionGate component)
- 25+ tests Playwright E2E (chromium + mobile-safari) + axe-core a11y assertions
- WCAG 2.1 AA accessible (loi 10-03 handicap + audit automatise @axe-core/playwright)
- Pattern Next.js 15 valide reutilise Sprint 17 (web-customer-portal) + Sprint 22 (web-garage)

---

## 2. Statistiques Generation

| Metrique | Valeur |
|----------|--------|
| Taches generees | **14** |
| Volume total | **~2860 KB** (~2.86 MB) |
| Densite moyenne | **~204 KB** (au-dessus cible 125 KB -- contenu exhaustif) |
| Densite minimum | 100+ KB (task-4.3.11 apres enrichissement) |
| Densite maximum | 369.4 KB (task-4.3.1) |
| Code patterns total | ~200 fichiers complets TypeScript |
| Tests total | ~250 cas concrets (Vitest unit + Playwright E2E) |
| Criteres validation total | ~380 V1-VN (P0/P1/P2) |
| Edge cases total | ~150 cas avec solutions |
| Emoji detectees | **0** (decision-006 ABSOLU respectee) |

**Densite cible** : 125 KB par task -- depassee globalement (204 KB moyenne) car Sprint 16 livre 12 pages production-ready avec patterns React Query + Server Actions + form validation Zod + i18n exhaustifs. Volume justifie par premier UI metier production complet (reference pour Sprint 17 + Sprint 22).

---

## 3. Ordre des 14 Taches (sequentielles, dependances chainees)

| # | Tache | Effort | Densite | Lignes | App / Package |
|---|-------|--------|---------|--------|---------------|
| 4.3.1 | [App skeleton + layouts + middleware auth + i18n setup](task-4.3.1-app-skeleton-layouts-middleware-auth-i18n.md) | 6h | 369.4 KB | 9485 | web-broker |
| 4.3.2 | [Pages auth : login + MFA verify + signup + recovery](task-4.3.2-pages-auth-login-mfa-signup-recovery.md) | 6h | 302.8 KB | 7797 | web-broker |
| 4.3.3 | [Layout principal + sidebar + topbar + tenant switcher](task-4.3.3-layout-principal-sidebar-topbar-tenant-switcher.md) | 5h | 174.9 KB | 4066 | web-broker |
| 4.3.4 | [Dashboard page : 6 widgets](task-4.3.4-dashboard-page-6-widgets.md) | 6h | 183.6 KB | 4545 | web-broker |
| 4.3.5 | [Contacts page : list + filters + detail timeline](task-4.3.5-contacts-page-list-filters-detail-timeline.md) | 7h | 182.4 KB | 4576 | web-broker |
| 4.3.6 | [Companies page : list + filters + detail (ICE)](task-4.3.6-companies-page-list-filters-detail-ice.md) | 5h | 223.9 KB | 5202 | web-broker |
| 4.3.7 | [Deals page : kanban + table views](task-4.3.7-deals-page-kanban-table-views.md) | 6h | 223.1 KB | 5582 | web-broker |
| 4.3.8 | [Polices page : list + detail + premiums + avenants](task-4.3.8-polices-page-list-detail-premiums-avenants.md) | 7h | 173.1 KB | 3683 | web-broker |
| 4.3.9 | [Broker queue : pending dossiers + validate/reject + SLA](task-4.3.9-broker-queue-pending-validate-reject-sla.md) | 6h | 197.7 KB | 3581 | web-broker |
| 4.3.10 | [Sinistres page read-only (M9 courtier)](task-4.3.10-sinistres-page-read-only-m9-courtier.md) | 4h | 193.2 KB | 4780 | web-broker |
| 4.3.11 | [Parametres + Profile + MFA setup](task-4.3.11-parametres-profile-mfa-setup.md) | 5h | 100+ KB | (enrichi) | web-broker |
| 4.3.12 | [RBAC UI : conditional rendering per role](task-4.3.12-rbac-ui-conditional-rendering-per-role.md) | 4h | 126.7 KB | 3177 | web-broker |
| 4.3.13 | [I18n complete fr/ar-MA/ar + RTL](task-4.3.13-i18n-complete-fr-ar-ma-ar-rtl.md) | 4h | 193.6 KB | 4222 | web-broker |
| 4.3.14 | [Tests E2E Playwright (25+) + accessibility](task-4.3.14-tests-e2e-playwright-25-accessibility.md) | 6h | 211.8 KB | 5030 | web-broker |

**Effort total** : 75 heures developpement.

---

## 4. Stack Technique Imposee (Sprint 16)

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.1.0 | App Router + Server Actions + use("cache") |
| react | 19.0.0 | with React Compiler |
| @tanstack/react-query | 5.62.0 | client mutations + cache sync |
| zod | 3.24.1 | validation schemas frontend |
| react-hook-form | 7.54.x | form management |
| @hookform/resolvers | 3.9.x | Zod resolver |
| recharts | 2.13.x | dashboards charts |
| date-fns + date-fns-tz | 4.1.0 | dates Africa/Casablanca |
| sonner | 1.7.x | toasts notifications |
| nuqs | 2.0.x | URL state for filters |
| next-intl | 3.26.3 | i18n fr/ar-MA/ar |
| @dnd-kit/core + sortable | 6.x | kanban drag-drop |
| framer-motion | 11.x | animations |
| jose | 5.x | JWT decode client |
| qrcode.react | 4.x | MFA QR display |
| @axe-core/playwright | 4.10.x | a11y tests |
| @playwright/test | 1.49.x | E2E |

**Fonts** :
- Montserrat 300/400/600/700/800/900 (latin) -- texte principal UI broker
- Noto Naskh Arabic 400/700 (arabic) -- locales ar-MA + ar
- Geist Mono 400 -- code / numbers / ICE / CIN

---

## 5. Mapping Ports Apps

| Port | App | Domain prod | Theme |
|------|-----|-------------|-------|
| 3001 | web-broker | app.skalean-insurtech.ma | Skalean Sofidemy (Orange + Sky Blue accent) |

Sprint 16 livre exclusivement l'app web-broker. Autres ports (3000/3002-3006) restes en bootstrap Sprint 4 et seront enrichis Sprints 17 / 22 / 25.

---

## 6. Brand Kit Sofidemy v3.0 (June 2025)

| Couleur | Hex | RGB | Usage |
|---------|-----|-----|-------|
| Orange Skalean | `#E95D2C` | 233 93 44 | Primary CTA |
| Navy Dark | `#1A2730` | 26 39 48 | Header / Text |
| Sky Blue | `#B0CEE2` | 176 206 226 | Accents |
| ACAPS Teal | `#2D5773` | 45 87 115 | Compliance UI |

Variant `data-theme="default"` -- web-broker (Orange CTA + Sky Blue accents + Navy text).
Mode dark : CSS variables override `:root[data-theme="dark"]` (preference utilisateur Parametres Tache 4.3.11).
Mode RTL : Tailwind 4 utilities `rtl:flex-row-reverse` / `rtl:space-x-reverse` actives pour locales `ar` et `ar-MA` (Tache 4.3.13).

---

## 7. Dependances Inter-Taches

```
4.3.1 (skeleton) -> 4.3.2 (auth pages) -> 4.3.3 (layout) -> 4.3.4 (dashboard)
   -> 4.3.5 (contacts) -> 4.3.6 (companies) -> 4.3.7 (deals)
   -> 4.3.8 (polices) -> 4.3.9 (broker-queue) -> 4.3.10 (sinistres RO)
   -> 4.3.11 (parametres + profile) -> 4.3.12 (RBAC UI) -> 4.3.13 (i18n)
   -> 4.3.14 (tests E2E + a11y) -> FIN Sprint 16
```

Chaine sequentielle stricte. Chaque tache valide V1-VN avant commit. Tache 4.3.12 (RBAC UI) depend implicitement de toutes les pages precedentes (4.3.4-4.3.11) pour appliquer PermissionGate. Tache 4.3.13 (i18n) traduit toutes les chaines des 12 pages. Tache 4.3.14 (tests E2E) couvre l'ensemble des 12 pages + parcours utilisateur cross-page.

---

## 8. Conventions Strictes Appliquees Partout

1. **Multi-tenant strict** : Header `x-tenant-id` obligatoire (interceptor axios), cookie `tenant_id` httpOnly Secure SameSite=lax (decret cookies CNDP 2024), AsyncLocalStorage cote API, RLS Postgres garantissant isolation
2. **Validation Zod** uniquement (jamais class-validator/yup/joi) -- schemas frontend partages avec @insurtech/contracts
3. **Logger Pino** cote API (jamais console.log) -- cote client : utilise next.js logger structured
4. **Hash argon2id** Sprint 5 (jamais bcrypt) -- frontend ne touche jamais aux hashes (server-side only)
5. **Package manager pnpm** strict (engine-strict=true, save-exact=true) -- jamais npm/yarn
6. **TypeScript strict** : strict, noImplicitAny, noUncheckedIndexedAccess, noImplicitReturns
7. **Tests** : Vitest unit + Playwright E2E + axe-core a11y (coverage >=85% / >=90% modules critiques broker-queue + auth)
8. **RBAC strict** : 12 roles backend, 3 roles broker UI (admin / user / assistant), PermissionGate component frontend mirror @Roles decorator backend
9. **Events Kafka** : topics `insurtech.events.{vertical}.{entity}.{action}` -- frontend consomme via React Query polling ou SSE Sprint 18+
10. **Imports strict** : `@insurtech/{nom}` pour packages partages (`@insurtech/api-client`, `@insurtech/shared-ui`, `@insurtech/contracts`) -- jamais relative `../../packages/`
11. **Skalean AI strict** (decision-005) : via `@insurtech/sky` ou MCP, JAMAIS OpenAI/Anthropic direct, mock Sprints 1-28
12. **No-emoji ABSOLU** (decision-006) : pre-commit hook check-no-emoji.sh, CI fail si emoji detectee dans `apps/web-broker/`
13. **Idempotency-Key strict** : POST/PUT/PATCH mutations sensibles broker (validate dossier, reject dossier, issue policy), TTL 24h Redis, header `Idempotency-Key: {uuid}` auto-genere par interceptor
14. **Conventional Commits strict** : `feat/fix/docs/style/refactor/test/chore/perf/ci/build`, scope `sprint-16`, body Task/Sprint/Phase metadata, commitlint husky
15. **Cloud souverain MA strict** (decision-008) : Atlas Cloud Services Benguerir UNIQUEMENT (s3.bgr.atlascloudservices.ma), DC1 Tier III + DC2 Tier IV DR, AES-256-GCM, TLS 1.3, AUCUNE donnee assure transite hors MA (loi 09-08)

---

## 9. Conformite Maroc Sprint 16

| Loi / Reglementation | Application Sprint 16 |
|----------------------|----------------------|
| **Loi 09-08 CNDP** | PII protection cookies + MFA consent + CIN masking dans UI listings (Tache 4.3.5 Contacts), retention IPs 13 mois max, Sentry beforeSend PII filter |
| **Loi 53-05 e-commerce** | MFA = SCA factor (Strong Customer Authentication), signature electronique policy issuance (Tache 4.3.9 broker-queue) |
| **Loi 31-08 protection consommateur** | Right to access + erasure + opt-in -- Tache 4.3.11 Parametres expose RGPD-like controls (loi 09-08 marocaine) |
| **Loi 17-99 code assurances** | Pro-rata refund + transparence broker + ACAPS reporting (Tache 4.3.8 Polices avenant + Tache 4.3.9 broker-queue audit log) |
| **Loi 43-20 signature electronique** | ANRT TSA pour cancel/transfer policy via Barid eSign workflow (Tache 4.3.8 avenants -- decision-009) |
| **Decret cookies CNDP 2024** | httpOnly + Secure + SameSite=lax sur tous cookies session/tenant/refresh, banniere consent dismissible granulaire |
| **Decret 2-13-836 ACAPS** | Audit log immutable broker decisions (validate/reject/issue policy) -- frontend affiche history Tache 4.3.9 |
| **Constitution Art 5** | Multilinguisme fr + ar (tamazight reporte Sprint 30+) -- Tache 4.3.13 i18n 3 locales + RTL |
| **Loi 10-03 handicap** | WCAG 2.1 AA accessibility -- Tache 4.3.14 audit automatise @axe-core/playwright + tests manuels keyboard navigation + screen reader NVDA |
| **decision-009 signature** | Barid eSign + ANRT TSA workflow integre dans broker-queue Tache 4.3.9 pour validation finale policy |

---

## 10. Decisions Strategiques Referencees

- **decision-001** Monorepo Turborepo + pnpm workspaces (Sprint 1)
- **decision-002** Multi-tenant 3 niveaux (cookie + middleware Edge + RLS Postgres)
- **decision-005** Skalean AI frontier strict (via @insurtech/sky / MCP, jamais OpenAI direct)
- **decision-006** No-emoji ABSOLU (toutes taches Sprint 16)
- **decision-007** Mock Skalean AI Sprints 1-28, real swap Sprint 29 -- Sprint 16 utilise mocks pour widgets dashboard AI insights
- **decision-008** Cloud souverain MA Atlas Cloud Services Benguerir (s3.bgr.atlascloudservices.ma)
- **decision-009** Signature loi 43-20 -- Barid eSign + ANRT TSA workflow integre broker-queue
- **decision-010** Insure connecteurs externes deferred Sprint 32 (Allianz/Wafa/AtlantaSanad API not yet) -- broker-queue Sprint 16 fonctionne avec API mock backend Sprint 15

---

## 11. Sortie du Sprint 16

A la fin de l'execution des 14 taches :

```
Web Broker App operational :
  - Next.js 15 App Router production-ready
  - 12 pages : login + MFA + signup + recovery + dashboard + contacts + companies + deals + polices + broker-queue + sinistres (read-only) + parametres + profile
  - 6 widgets dashboard
  - Kanban + Table views deals
  - Optimistic UI updates
  - I18n fr / ar-MA / ar + RTL
  - RBAC UI : 3 roles broker (admin/user/assistant)
  - 25+ tests Playwright E2E
  - WCAG 2.1 AA accessible

Pattern Next.js 15 valide reutilise Sprint 17 (web-customer-portal) + Sprint 22 (web-garage).
Sprint 17 demarre avec : pattern Next.js 15 stable, auth flows ready, BrokerValidationQueue + ProvisionalPolicy services Sprint 15 ready a consommer.
```

**Phase 4 Vertical Insure** continue avec :
- Sprint 17 : Web Customer Portal -- vente en ligne SEO (port 3004, SSG+ISR, Lighthouse 95+, comparateur produits MA, simulateur prime, KYC online)
- Sprint 18 : Notifications + Emails templates (SendGrid + Twilio MA + WhatsApp Business API)
- Sprint 19 : Reporting + Exports broker (CSV/Excel/PDF, dashboards avances, KPIs commission)

**Sprint 17 demarre avec** :
- Pattern Next.js 15 stable et teste (App Router + Server Actions + middleware Edge multi-tenant)
- Auth flows ready (login + MFA verify + signup + recovery reutilisables)
- BrokerValidationQueue + ProvisionalPolicy services Sprint 15 ready a consommer cote portail public
- Layouts + composants shared-ui maitrise par equipe frontend
- I18n 3 locales fr/ar-MA/ar deja en place (cross-cutting Sprint 4 + enrichissement Sprint 16)
- Tests Playwright pattern reutilisable (page object model + fixtures auth)

---

## 12. Workflow Execution Sprint 16

```bash
# 1. Pre-requisites
cd repo
pnpm install --frozen-lockfile
docker compose up -d postgres redis kafka minio
pnpm --filter @insurtech/api run db:migrate
pnpm --filter @insurtech/api dev &

# 2. Execution sequentielle des 14 taches (1 commit par tache)
# Lecture du prompt task-4.3.X-*.md puis implementation par Claude Code suivant ses 17 sections

# Commande type pour chaque tache :
git checkout -b feat/sprint-16-4.3.1-app-skeleton-layouts-middleware
# [Claude Code lit task-4.3.1-*.md et implemente]

# 3. Validation par tache
pnpm --filter @insurtech/web-broker typecheck
pnpm --filter @insurtech/web-broker lint
pnpm --filter @insurtech/web-broker vitest run
pnpm --filter @insurtech/web-broker playwright test
grep -rP "[\x{1F300}-\x{1F9FF}]" apps/web-broker/ --exclude-dir=node_modules || echo OK

# 4. Commit
git add -A && git commit -m "feat(sprint-16): app skeleton + layouts + middleware auth + i18n setup
[...metadata Task/Sprint/Phase/Reference...]"
git push origin feat/sprint-16-4.3.1-app-skeleton-layouts-middleware

# 5. Dev / Test final apres derniere tache 4.3.14
pnpm --filter @insurtech/web-broker dev      # port 3001 -- http://localhost:3001
pnpm --filter @insurtech/web-broker build    # production build
pnpm --filter @insurtech/web-broker start    # production server

# 6. Validation automatique sprint
# 00-pilotage/verifications/V-16-sprint-16-web-broker-app.md
```

---

## 13. Format Strict Applique (17 Sections)

Chaque fichier `task-4.3.X-*.md` respecte strictement :

| # | Section | Volume cible |
|---|---------|--------------|
| 1 | Header metadata | 0.5 ko |
| 2 | But | 0.5-1 ko |
| 3 | Contexte etendu | 5-10 ko |
| 4 | Architecture context | 3-5 ko |
| 5 | Livrables checkables | 5-10 ko |
| 6 | Fichiers crees/modifies | 2-3 ko |
| 7 | Code patterns COMPLETS | 30-80 ko |
| 8 | Tests complets | 15-30 ko |
| 9 | Variables environnement | 1-3 ko |
| 10 | Commandes shell | 1-2 ko |
| 11 | Criteres validation | 5-10 ko |
| 12 | Edge cases + troubleshooting | 3-5 ko |
| 13 | Conformite Maroc | 1-3 ko |
| 14 | Conventions absolues | 3-5 ko |
| 15 | Validation pre-commit | 1-2 ko |
| 16 | Commit message complet | 1-2 ko |
| 17 | Workflow next step | 0.5 ko |
| **TOTAL** | | **80-150 ko cible -- 204 ko moyenne effective** |

---

## 14. Statut Generation Phase A

**=== Sprint 16 : Web Broker App SaaS B2B -- GENERATION COMPLETE v2 ===**

```
Taches generees : 14 / 14
Volume total sprint : ~2860 KB
Densite moyenne : ~204 KB (au-dessus cible 125 KB -- contenu exhaustif)
Densite minimum : 100+ KB (4.3.11 apres enrichissement)
Densite maximum : 369.4 KB (4.3.1)
Code patterns total sprint : ~200 fichiers complets TypeScript
Tests total sprint : ~250 cas concrets (Vitest unit + Playwright E2E)
Criteres validation total : ~380 V1-VN (P0/P1/P2)
Edge cases total : ~150
Emoji detectees : 0 (decision-006 ABSOLU respectee)

Conformite Sprint 16 :
- Stack Next.js 15.1.0 + React 19 + App Router strict
- Multi-tenant via cookie + middleware Edge
- RBAC UI 3 roles broker (admin / user / assistant)
- I18n fr / ar-MA / ar + RTL CSS + Noto Naskh Arabic
- WCAG 2.1 AA validated via axe-core
- 9 lois MA referencees + integrees
- Atlas Cloud Benguerir (decision-008)

=== STATUT : OK ===

Prochain sprint a generer : Sprint 17 (Web Customer Portal -- vente en ligne SEO)
Reference meta-prompt : 00-pilotage/meta-prompts/B-17-sprint-17-web-customer-portal.md
```

---

**Fin du _SUMMARY.md Sprint 16.**
