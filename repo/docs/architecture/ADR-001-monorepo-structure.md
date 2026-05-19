# ADR-001 : Monorepo pnpm + Turborepo

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad Belgana (CTO), Abla Ait Kassi (CEO)
**Mirror** : `00-pilotage/decisions/001-monorepo-structure.md`

## Contexte

Skalean InsurTech v2.2 = 9 apps + 23 packages partages. Choix structure organisationnelle code source critique pour productivite + qualite + gestion dependances.

Options evaluees :
- Polyrepo (1 repo Git par app/package -- 30+ repos)
- Monorepo (1 seul repo avec workspaces)

## Decision

**Monorepo via pnpm 9.15 workspaces + Turborepo 2.4 task runner**.

Stack :
- pnpm 9.15 (vs npm/yarn) : 3-5x plus rapide + symlinks strict + engine-strict
- Turborepo 2.4 : task pipeline + cache local (remote cache Vercel optionnel Sprint 35)
- TypeScript 5.7 strict : partage types via packages
- Volta version manager : pin Node 22.20 + pnpm 9.15

## Consequences

### Positives (+)

- **Refactoring atomique** : changement type partage instantane visible 7 apps
- **Versions unifiees** : 1 lockfile, 0 drift deps
- **Tests CI rapides** : Turborepo cache 80%+ jobs deterministes
- **Onboarding 1 commande** : `pnpm install` setup tout
- **Code reuse** : 23 packages partages entre apps
- **Builds paralleles** : Turborepo schedule optimal

### Negatives (-)

- **Repo size** : 100k+ files post-install (mitige : pnpm symlinks vs npm copy)
- **CI duration** : 1 commit declenche tests tous les sprints concernes (mitige : Turborepo affected detection)
- **Permissions Git** : tous devs voient tout code (mitige : CODEOWNERS + branch protection)

## References

- decision-001 (mirror)
- Sprint 1 (B-01) : initialisation monorepo
- 1-stack-technique.yaml : versions exactes
- Industry references : Vercel, Stripe, Shopify, Microsoft VSCode
