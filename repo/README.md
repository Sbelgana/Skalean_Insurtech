# repo/ -- Code Source skalean-insurtech (a construire Sprint 1)

**Version** : v2.2
**Date** : Mai 2026
**Statut** : VIDE -- a construire Sprint 1 par Cowork
**AUCUNE EMOJI AUTORISEE**

---

## Vue d'ensemble

Ce dossier `repo/` est le **CODE SOURCE du produit** Skalean InsurTech construit par Cowork au cours des 35 sprints.

**Tres important** :
- `00-pilotage/` est la zone de pilotage (meta-prompts, decisions, audits) -- **non versionne** dans le Git du produit
- `repo/` est le code source -- **versionne** dans Git du produit (depot separe)

Cowork ne modifie JAMAIS `00-pilotage/`. Il LIT les meta-prompts B-XX et ECRIT dans `repo/`.

---

## Structure cible (apres execution complete des 35 sprints)

```
repo/                                                 # 9 apps + 21 packages + infrastructure + docs
│
├── apps/                                             # 9 apps deployables v2.2
│   ├── api/                                          # NestJS backend (port 4000)
│   ├── web-insurtech-admin/                          # port 3000 -- Admin Skalean
│   ├── web-broker/                                   # port 3001 -- Courtiers
│   ├── web-garage/                                   # port 3002 -- Chefs garages
│   ├── web-garage-mobile/                            # port 3003 -- PWA technicien + WebAuthn
│   ├── web-customer-portal/                          # port 3004 -- Prospects SEO
│   ├── web-assure-portal/                            # port 3005 -- Assures desktop
│   ├── web-assure-mobile/                            # port 3006 -- PWA assure mobile
│   └── mcp-server/                                   # port 4001 -- MCP tools metier (NEW v2.2)
│
├── packages/                                         # ~21 packages partages
│   │  Modules metier
│   ├── auth/                                         # Argon2 + JWT + MFA + WebAuthn
│   ├── database/                                     # TypeORM 0.3 + RLS multi-tenant
│   ├── crm/                                          # Contacts + companies + deals
│   ├── booking/                                      # Rooms + appointments + calendar
│   ├── comm/                                         # WhatsApp + Email + 4 locales
│   ├── docs/                                         # S3 + PDF + access logs
│   ├── signature/                                    # Barid eSign + ANRT TSA
│   ├── pay/                                          # 6 passerelles MA
│   ├── books/                                        # CGNC + factures DGI
│   ├── compliance/                                   # ACAPS + AMC + CNDP
│   ├── analytics/                                    # ClickHouse + dashboards
│   ├── insure/                                       # Vertical Broker
│   ├── repair/                                       # Vertical Garage
│   ├── stock/                                        # Stock pieces
│   ├── hr/                                           # Employees + paie
│   │  AI integration v2.2
│   ├── sky/                                          # Agent Sky orchestrator
│   ├── sky-ui/                                       # Chat widget shared
│   │  Shared
│   ├── shared-types/
│   ├── shared-config/
│   ├── shared-utils/
│   ├── shared-ui/                                    # shadcn/ui + theme Sofidemy
│   ├── shared-pwa/                                   # Service worker + offline
│   └── shared-maps/                                  # Mapbox GL JS wrapper
│
├── infrastructure/
│   ├── docker/                                       # docker-compose + dockerfiles
│   ├── scripts/                                      # bootstrap.sh + seeds
│   ├── observability/                                # Datadog + Sentry (Sprint 34)
│   ├── cloudflare/                                   # CDN config (Sprint 34)
│   └── terraform/                                    # Atlas Cloud Services (Sprint 35)
│
├── docs/
│   ├── architecture/                                 # ADR-001 a ADR-010
│   ├── api/                                          # Swagger generated
│   ├── runbooks/                                     # Operations (Sprint 33+)
│   ├── security/                                     # Pentest reports (Sprint 33)
│   └── pilote/                                       # Pilote Marrakech (Sprint 35)
│
├── load-tests/                                       # K6 + chaos (Sprint 34)
│
├── .github/workflows/                                # CI/CD + security
├── .husky/                                           # Git hooks
├── .vscode/
│
├── package.json                                      # Racine monorepo pnpm
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── biome.json
├── commitlint.config.cjs
├── .lintstagedrc.cjs
├── .npmrc
├── .nvmrc                                            # 22.11.0
├── .gitignore
├── .env.example
├── .editorconfig
├── README.md
├── CLAUDE.md                                         # Guide AI assistants (incl. Cowork)
├── CONTRIBUTING.md
└── LICENSE                                           # Proprietary
```

---

## Demarrage Sprint 1 (premier peuplement repo/)

Sprint 1 (Bootstrap Infrastructure) cree :
- Structure monorepo pnpm + Turborepo
- 9 apps stubs vides (apps/)
- 21 packages stubs vides (packages/)
- Docker Compose dev (7 services)
- TypeScript strict + Biome
- GitHub Actions CI
- Vitest + Playwright frameworks
- Pino logger + OpenTelemetry
- Husky + commitlint + check-no-emoji
- 6 ADR initiaux + README + CLAUDE.md + CONTRIBUTING.md

Voir `../00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md` pour specifications detaillees.

---

## Initialisation Git

Au demarrage Sprint 1 :

```bash
cd repo/
git init
git remote add origin git@github.com:skalean/skalean-insurtech.git

# Ne PAS versionner 00-pilotage/ (pas de symbolic link, pas d'inclusion)
echo "/00-pilotage/" >> .gitignore

# Initial commit Sprint 1.1.1
git add .
git commit -m "feat(sprint-01): initialisation monorepo pnpm + turborepo + structure

Task: 1.1.1
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure"
```

---

## Frontiere stricte 00-pilotage/ <-> repo/

**Ce que Cowork peut faire** :
- Lire `../00-pilotage/meta-prompts/B-XX-*.md` (meta-prompts sprint)
- Lire `../00-pilotage/orchestrateurs/C-XX-*.md` (orchestration sprint)
- Lire `../00-pilotage/verifications/V-XX-*.md` (verification sprint)
- Lire `../00-pilotage/documentation/*.md` (documentation reference)
- Lire `../00-pilotage/decisions/*.md` (decisions strategiques)
- **Ecrire dans `repo/`** (code source produit)

**Ce que Cowork ne doit JAMAIS faire** :
- Modifier `00-pilotage/` (zone pilotage protege)
- Inclure `00-pilotage/` dans `repo/` (separation stricte)

---

## Statut actuel

VIDE -- pret pour Sprint 1.

Cowork commande au demarrage :

```bash
claude-code \
  --orchestrator ../00-pilotage/orchestrateurs/C-01-sprint-01-bootstrap.md \
  --reference-prompt ../00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md \
  --verification ../00-pilotage/verifications/V-01-sprint-01-bootstrap.md
```

---

**Fin du README repo/ v2.2 -- a construire Sprint 1.**
