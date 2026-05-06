# Decision 001 -- Monorepo Structure (pnpm + Turborepo)

**Date** : 2025-12
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-001-monorepo-structure.md`

---

## Contexte

Skalean InsurTech v2.2 = **9 apps + 21 packages** (api + 7 web + mcp-server / metier + shared). Choix structure organisationnelle code source critique pour productivite + qualite + dependencies management.

Options evaluees :
- **Polyrepo** : 1 repo Git par app/package -- 30 repos
- **Monorepo** : 1 seul repo avec workspaces

## Probleme adresse

- Refactoring atomique cross-app (e.g. changer signature API affecte 7 web apps simultanement)
- Versions deps unifiees (pas de drift TypeScript / NestJS / Next.js entre apps)
- Tests CI deterministes (single source of truth)
- Onboarding developpeurs (1 clone vs 30)
- Code partage : packages metier reutilisables (auth, database, etc.)

## Decision

**Monorepo via pnpm workspaces + Turborepo task runner**.

Stack :
- **pnpm 9.15** (vs npm/yarn) -- 3-5x plus rapide + symlinks strict
- **Turborepo 2.4** -- task pipeline + remote cache (build, test, lint, typecheck, dev)
- **TypeScript 5.7 strict** -- partage types via packages
- **Volta** version manager -- pin Node 22.20 + pnpm 9.15

## Avantages

1. **Refactoring atomique** : changement type partage instantane visible 7 apps
2. **Versions unifiees** : 1 lockfile, 0 drift deps
3. **Tests CI rapides** : Turborepo cache 80%+ jobs deterministes
4. **Onboarding 1 commande** : `pnpm install` setup tout
5. **Code reuse** : 21 packages partages entre apps
6. **Build paralleles** : Turborepo schedule optimal

## Inconvenients

1. **Repo size** : 100k+ files post-install (mitige : pnpm symlinks vs npm copy)
2. **CI duration** : 1 commit declenche tests tous les sprints concernes (mitige : Turborepo affected detection)
3. **Permissions Git** : tous devs voient tout code (mitige : CODEOWNERS + branch protection)

## Impact technique

- **Sprint 1** : init monorepo structure complete (`apps/*` + `packages/*`)
- Tous sprints : utilisent packages shared (auth, database, etc.)
- CI : `.github/workflows/ci.yaml` exploit Turborepo cache

## Communication

Equipe technique : standards monorepo communiques onboarding + ADR-001.
Investisseurs : choix monorepo coherent industrie (Vercel, Stripe, Shopify, etc.).

## References

- Sprint 1 (B-01) : initialisation monorepo
- `1-stack-technique.yaml` : versions exactes pnpm + Turborepo
- ADR-001 : decision technique detaillee
