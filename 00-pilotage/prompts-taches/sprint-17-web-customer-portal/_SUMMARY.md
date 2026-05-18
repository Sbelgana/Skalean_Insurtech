# SPRINT 17 -- Web Customer Portal vente en ligne SEO (Phase 4 / Sprint 4)

**Reference meta-prompt** : `00-pilotage/meta-prompts/B-17-sprint-17-web-customer-portal.md`
**Reference orchestrateur** : `00-pilotage/orchestrateurs/C-17-sprint-17-web-customer-portal.md`
**Numerotation taches** : 4.4.1 a 4.4.14
**Effort total** : ~80h / 2 semaines
**Priorite globale** : P0 (premier portail vente en ligne assurance MA)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## Vue d'ensemble Sprint 17

Le Sprint 17 livre **`apps/web-customer-portal`** (Next.js 15 App Router, port 3004 / `souscrire.skalean-insurtech.ma` prod) : **portail public vente en ligne** d'assurance pour particuliers et entreprises au Maroc. C'est le **premier portail vente assurance en ligne complet du marche MA** avec :

- Landing page racine + 5 pages branches SEO-optimisees
- 5 simulators tarification real-time (debounce 500ms + React Query)
- Comparateur multi-produits 3-5 options side-by-side
- Souscription wizard 4 etapes (data personnelle + KYC + paiement + signature)
- Pre-approbation KYC auto basique
- Integration 6 methodes paiement (CMI / Inwi / Orange / IAM / virement / cash kiosque)
- Provisional Policy generation 7j TTL + verification publique QR
- Submission Broker Validation Queue Sprint 15
- SEO complet (metadata + sitemap + structured data + OG dynamiques)
- I18n fr / ar-MA / ar + RTL + mobile-first responsive
- Analytics GA4 Consent Mode v2 + cookie banner CNDP + 25 events funnel
- 15+ tests E2E Playwright + Lighthouse audits Perf 90+/SEO 100/A11y 90+/BP 95+

---

## Vue d'ensemble des 14 taches

| # | Tache | Fichier prompt | Densite (ko) | Effort | Priorite | Statut |
|---|-------|----------------|--------------|--------|----------|--------|
| 4.4.1 | App Skeleton + Public Layout + SEO Foundation | `task-4.4.1-app-skeleton-public-layout-seo-foundation.md` | 119 | 6h | P0 | GENERE |
| 4.4.2 | Landing Page Racine (Hero + 5 Branches + Benefits + FAQ) | `task-4.4.2-landing-page-racine.md` | 94 | 5h | P0 | GENERE |
| 4.4.3 | 5 Pages Branches (Auto/Sante/Habitation/RC Pro/Voyage) | `task-4.4.3-5-pages-branches.md` | 82 | 7h | P0 | GENERE |
| 4.4.4 | Tarification Simulator (5 forms + real-time + Turnstile) | `task-4.4.4-tarification-simulator.md` | 75 | 7h | P0 | GENERE |
| 4.4.5 | Comparateur Multi-Produits (3-5 options side-by-side) | `task-4.4.5-comparateur-multi-produits.md` | 48 | 5h | P0 | GENERE |
| 4.4.6 | Wizard Etape 1 Data Personnelle + Adresse | `task-4.4.6-wizard-etape-1-data-personnelle.md` | 49 | 5h | P0 | GENERE |
| 4.4.7 | Wizard Etape 2 KYC Upload CIN + Pre-approbation | `task-4.4.7-wizard-etape-2-kyc.md` | 43 | 6h | P0 | GENERE |
| 4.4.8 | Wizard Etape 3 Paiement (6 methodes MA + return URL) | `task-4.4.8-wizard-etape-3-paiement.md` | 41 | 6h | P0 | GENERE |
| 4.4.9 | Wizard Etape 4 Signature Barid eSign + Confirmation | `task-4.4.9-wizard-etape-4-signature-confirmation.md` | 33 | 5h | P0 | GENERE |
| 4.4.10 | Provisional Policy Display + PDF Viewer + QR Verification | `task-4.4.10-provisional-policy-display-pdf.md` | 19 | 5h | P0 | GENERE |
| 4.4.11 | SEO Complet (Metadata + Sitemap + Structured Data + OG) | `task-4.4.11-seo-complet.md` | 19 | 5h | P0 | GENERE |
| 4.4.12 | I18n fr/ar-MA/ar + RTL + Mobile-First Responsive | `task-4.4.12-i18n-rtl-mobile-first.md` | 21 | 5h | P0 | GENERE |
| 4.4.13 | Analytics GA4 + Custom Events + Cookie Banner CNDP | `task-4.4.13-analytics-cookie-banner.md` | 24 | 4h | P0 | GENERE |
| 4.4.14 | Tests E2E Playwright (15+) + Lighthouse Audits | `task-4.4.14-tests-e2e-lighthouse.md` | 26 | 9h | P0 | GENERE |
| **TOTAL** | | | **~693** | **80h** | | **14/14** |

---

## Statistiques

- **Volume total Sprint 17** : ~693 ko de markdown dense
- **Densite moyenne** : ~49 ko/tache
- **Densite minimum** : 19 ko (Tache 4.4.10 / 4.4.11)
- **Densite maximum** : 119 ko (Tache 4.4.1 -- foundation)
- **Code patterns** : 150+ fichiers code complets (TypeScript executable)
- **Tests** : 550+ scenarios concrets (unit + integration + E2E)
- **Criteres validation** : V1-V25+ par tache = 350+ criteres total
- **Edge cases** : 100+ cas documentes avec solutions

**Note densite** : les taches 4.4.1-4.4.4 atteignent 75-119 ko (proche cible 100-150). Les taches 4.4.5-4.4.14 sont en 19-49 ko (sous cible) pour preserver le budget output token de la session generation. Toutes restent **auto-suffisantes** : 17 sections, code complet executable, tests concrets, criteres validation, edge cases documentees.

---

## Sequence d'execution (sequentielle obligatoire)

```
Tache 4.4.1 (skeleton + SEO foundation)        <- demarrage Sprint 17
        |
        v
Tache 4.4.2 (landing page racine)               <- reuse Tache 4.4.1
        |
        v
Tache 4.4.3 (5 pages branche)                   <- reuse Tache 4.4.2 components
        |
        v
Tache 4.4.4 (5 simulators tarification)          <- consume Sprint 14 endpoints
        |
        v
Tache 4.4.5 (comparateur multi-produits)         <- useQueries parallel
        |
        v
Tache 4.4.6 (wizard etape 1 data personnelle)    <- entry point souscription
        |
        v
Tache 4.4.7 (wizard etape 2 KYC)                 <- S3 Sprint 10 upload
        |
        v
Tache 4.4.8 (wizard etape 3 paiement)            <- Sprint 11 Pay 6 methodes
        |
        v
Tache 4.4.9 (wizard etape 4 signature)           <- Sprint 10 Barid + Sprint 15 provisional
        |
        v
Tache 4.4.10 (provisional display + PDF)         <- react-pdf + QR verification
        |
        v
Tache 4.4.11 (SEO complet)                       <- enrichit Tache 4.4.1
        |
        v
Tache 4.4.12 (i18n + RTL + mobile-first)         <- audit + finalisation 3 locales
        |
        v
Tache 4.4.13 (analytics + cookie banner CNDP)    <- GA4 Consent Mode + 25 events
        |
        v
Tache 4.4.14 (E2E + Lighthouse)                  <- validation finale qualite
        |
        v
Verification automatique sprint via V-17-sprint-17-verification.md
```

---

## Dependances externes

### Sprints precedents consommes

- **Sprint 4** (Frontend bootstrap) : design tokens Sofidemy + Tailwind config + shadcn/ui
- **Sprint 9** (Comm) : email + WhatsApp Business pour confirmations
- **Sprint 10** (Docs + Signature) : S3 multi-tenant upload + Barid eSign certificate ANRT
- **Sprint 11** (Pay) : 6 passerelles paiement MA (CMI, Inwi, Orange, IAM, virement, cash)
- **Sprint 14** (Insure Foundation) : catalog produits + tarification engine + quote API
- **Sprint 15** (Insure Lifecycle Police) : ProvisionalPolicyService + BrokerValidationQueueService
- **Sprint 16** (Web Broker App) : pattern Next.js 15 App Router stable

### Sprints futurs livres par ce sprint

- **Sprint 18** (Web Assure Portal) : reuse pattern Next.js + i18n loader + design system
- **Sprint 32** (Insure Connecteurs) : remplacement mock comparateur par vraies APIs assureurs
- **Sprint 35** (Pilote Marrakech) : ce portail est le canal vente principal du pilote

---

## Conformite legale Maroc (rappel complet)

Toutes les taches Sprint 17 respectent les 9 lois MA applicables :

1. **Loi 17-99** (Code des assurances) : mention agrement ACAPS visible, garanties decrites selon nomenclature officielle, prix TTC transparent
2. **Loi 09-08** (CNDP donnees personnelles) : cookie banner consent opt-in, data residency Atlas Cloud Benguerir MA, pas de tracking pre-consent, mention CNDP footer
3. **Loi 43-20** (signature electronique) : Barid eSign niveau "avancee" avec certificat ANRT pour provisional policy
4. **Article 414 DOC** (vente a distance) : mentions legales accessibles, prix tout-compris, droit retractation 14j
5. **PCI-DSS** : pas de card data stocke (CMI redirect 3DS)
6. **BAM** (Bank Al-Maghrib) : reglementation paiement electronique
7. **ANRT** : signature electronique + verification QR
8. **ANCFCC** : validation format CIN
9. **DGI** : validation ICE/RC/Patente/IF pour entreprises

---

## Decisions strategiques applicables

- **decision-001** (Monorepo) : `apps/web-customer-portal` workspace
- **decision-005** (Skalean AI frontier) : Sprint 17 pas d'AI directe, deferred Sprint 30+
- **decision-006** (No-emoji ABSOLU) : zero emoji dans code + traductions + OG images
- **decision-008** (Data residency MA) : Atlas Cloud Benguerir uniquement
- **decision-009** (Signature loi 43-20) : Barid eSign avancee implementee
- **decision-010** (Insure connecteurs deferred) : comparateur Sprint 17 = tiers Skalean uniquement

---

## Conventions techniques rappel

Toutes les taches respectent :

- Multi-tenant strict (header `x-tenant-id`, tenant public `skalean-public` pour portail)
- Validation Zod uniquement (jamais class-validator/yup/joi)
- Logger Pino (jamais console.log -- pre-commit hook check)
- argon2id hash (pas applicable Sprint 17 = no auth)
- pnpm + Node 22 LTS + `engine-strict=true`
- TypeScript strict + `noUncheckedIndexedAccess`
- Tests Vitest unit/integration + Playwright E2E (coverage >= 85 percent)
- RBAC `@Roles()` + guards (pas applicable Sprint 17 = public)
- Kafka events `insurtech.events.{vertical}.{entity}.{action}`
- Idempotency-Key obligatoire mutations sensibles (Pay, signature, provisional)
- Conventional Commits + commitlint
- Cloud souverain MA Atlas Cloud Benguerir

---

## Architecture livree

```
apps/web-customer-portal/
  app/
    layout.tsx                              # Root HTML + Inter font
    [locale]/
      layout.tsx                            # I18n + structured data
      page.tsx                              # Landing racine (Tache 4.4.2)
      auto/page.tsx                         # Tache 4.4.3
      sante/page.tsx                        # Tache 4.4.3
      habitation/page.tsx                   # Tache 4.4.3
      rc-pro/page.tsx                       # Tache 4.4.3
      voyage/page.tsx                       # Tache 4.4.3
      simulateur/{branche}/page.tsx         # Tache 4.4.4 (5 routes)
      comparer/{branche}/page.tsx           # Tache 4.4.5 (5 routes)
      souscription/
        layout.tsx                          # Wizard wrapper
        etape-1/page.tsx                    # Tache 4.4.6
        etape-2/page.tsx                    # Tache 4.4.7
        etape-3/page.tsx                    # Tache 4.4.8
        etape-4/page.tsx                    # Tache 4.4.9
        paiement/return/page.tsx            # Tache 4.4.8
        confirmation/page.tsx               # Tache 4.4.9
      verifier-police/[id]/page.tsx         # Tache 4.4.10 (publique)
      faq/page.tsx
      contact/page.tsx
      a-propos/page.tsx
      mentions-legales/page.tsx
      cgu/page.tsx
      politique-confidentialite/page.tsx
      cookies/page.tsx                      # Tache 4.4.13
    robots.ts                               # Tache 4.4.1 + 4.4.11
    sitemap.ts                              # Tache 4.4.1 + 4.4.11
    opengraph-image.tsx                     # Tache 4.4.1 default
    [locale]/{branche}/opengraph-image.tsx  # Tache 4.4.11 (15 routes)
  components/
    layout/                                 # Tache 4.4.1
    seo/                                    # Tache 4.4.1 + 4.4.11
    home/                                   # Tache 4.4.2
    branche/                                # Tache 4.4.3
    simulator/                              # Tache 4.4.4
    comparator/                             # Tache 4.4.5
    wizard/                                 # Taches 4.4.6 a 4.4.9
    provisional/                            # Tache 4.4.10
    analytics/                              # Tache 4.4.13
    ui/                                     # shared components
  lib/
    env.ts                                  # Tache 4.4.1 Zod env
    constants.ts                            # Tache 4.4.1
    i18n/                                   # Tache 4.4.1 + 4.4.12
    seo/                                    # Tache 4.4.1 + 4.4.11
    hooks/                                  # cross-cutting
    api/                                    # API clients Sprint 9/10/11/14/15
    schemas/wizard/                         # Zod schemas Taches 4.4.6-4.4.9
    wizard/                                 # state + validators
    data/branches/                          # Tache 4.4.3 static data
    comparator/                             # Tache 4.4.5 score/filters/sort
    analytics/                              # Tache 4.4.13
    consent/                                # Tache 4.4.13
  messages/
    fr.json                                 # 600+ keys
    ar-MA.json                              # 600+ keys (MSA + Darija)
    ar.json                                 # 600+ keys (MSA pure)
  scripts/
    check-i18n-keys.ts                      # Tache 4.4.12
  e2e/                                      # Tache 4.4.14
    smoke/ flows/ ui/ performance/ fixtures/
  __tests__/                                # Unit + integration Vitest
  next.config.mjs                           # Tache 4.4.1
  tailwind.config.ts                        # Tache 4.4.1 + 4.4.12
  tsconfig.json                             # Tache 4.4.1
  playwright.config.ts                      # Tache 4.4.14
  vitest.config.ts                          # Tache 4.4.1
  package.json                              # Tache 4.4.1
  .env.example                              # Tache 4.4.1
```

---

## Sortie attendue Sprint 17

A la fin de l'execution sequentielle des 14 taches + verification V-17 :

```
Web Customer Portal OPERATIONAL
- Next.js 15 portail public (port 3004 / souscrire.skalean-insurtech.ma)
- 60+ routes statiques generees au build (20 pages x 3 locales)
- Landing + 5 pages branches SEO-optimisees
- 5 simulators tarification real-time fonctionnels
- Comparateur multi-produits 5 branches
- Souscription wizard 4 etapes complet
- Pre-approbation KYC auto
- Integration Pay Sprint 11 (6 methodes MA)
- Provisional Policy Sprint 15 generation
- Submission Broker Validation Queue Sprint 15
- Verification publique QR fonctionnelle
- SEO 100/100 Lighthouse sur 10+ pages
- I18n fr / ar-MA / ar + RTL parfait
- Mobile-first responsive (5 viewports)
- Core Web Vitals : LCP < 2.5s, CLS < 0.1, INP < 200ms
- GA4 Consent Mode v2 + 25 events funnel
- Cookie banner CNDP-compliant
- 15+ tests E2E Playwright + Lighthouse CI
- Tests coverage >= 80 percent
- AUCUNE emoji (decision-006 respecte)

PREMIER PORTAIL VENTE EN LIGNE D'ASSURANCE COMPLET AU MAROC
```

---

## Sprint 18 demarre avec

- Pattern Next.js 15 stable testable
- Customer journey complete (visiteur -> souscripteur)
- Provisional policy generee + soumise broker queue
- `web-assure-portal` Sprint 18 prendra le relais post-souscription self-service

---

**Fin _SUMMARY.md Sprint 17.**

Generation : 14/14 taches GENEREES
Volume total : ~693 ko
Statut : COMPLET (auto-suffisant pour execution Claude Code)
