# Contributing -- Skalean InsurTech v2.2

## Workflow contributeur

### Setup environnement (~30 minutes)

```bash
# 1. Clone + install
git clone git@github.com:skalean-insurtech/insurtech.git
cd insurtech/repo
pnpm install --frozen-lockfile  # auto-installe Husky hooks via prepare

# 2. Configure git hooks path (si mono-repo avec .git a la racine parent)
git -C .. config core.hooksPath repo/.husky

# 3. Demarrer stack dev
pnpm docker:up

# 4. Verifier env
cp .env.example .env.development.local
# editer .env.development.local avec vos secrets dev
pnpm verify-env
```

### Workflow branches

- `main` : production-ready (protege, 2 approvers)
- `develop` : staging (protege, 1 approver)
- `feature/sprint-NN-task-X.Y.Z-{slug}` : par tache
- `fix/...` : corrections
- `hotfix/...` : urgences prod

### Commit conventions (Conventional Commits)

```
<type>(<scope>): <subject>

<body optionnel>

Task: X.Y.Z
Reference: B-XX Tache X.Y.Z
```

Types autorises : feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
Scope : sprint-NN ou package-name ou app-name.
Subject : max 100 caracteres, pas de point final.

Exemples :
```bash
git commit -m "feat(sprint-01): init shared-config env loader Zod"
git commit -m "fix(database): correct RLS policy for assure level"
git commit -m "docs(architecture): add ADR-007 AI mock factory"
```

### PR process

1. Push branche : `git push origin feature/sprint-XX-task-X.Y.Z-slug`
2. Open PR sur GitHub
3. Remplir PR template (checklist)
4. Attendre CI green (5 jobs : lint, build, test, audit, summary)
5. Attendre approvals (2 main / 1 develop)
6. Squash merge

### Standards code

- TypeScript strict (no any, exactOptionalPropertyTypes)
- Tests coverage >= 85%
- No console.log (Pino logger uniquement)
- No emoji (decision-006 ABSOLU)
- Multi-tenant : tenant_id + RLS sur tables metier
- Conventional Commits format
- pnpm uniquement (pas npm/yarn)

### Tasks workflow

Chaque sprint a 10-15 taches documentees dans `00-pilotage/prompts-taches/sprint-NN-{slug}/task-X.Y.Z-*.md`.

Workflow : lire prompt tache -> implementer -> tests -> commit -> PR -> review -> merge.

### Bypass policy

`git commit --no-verify` est documente mais audite. A eviter sauf urgence absolue.
Sprint 33 audit detecte usage frequent `--no-verify`.

### Troubleshooting

- Hooks pas installes : `pnpm install` puis `git -C .. config core.hooksPath repo/.husky`
- check-no-emoji fail : supprimer emojis du fichier
- commitlint fail : verifier format Conventional Commits
- typecheck fail : `pnpm typecheck` localement + corriger
- pnpm install fail : verifier node >= 22.20.0 et pnpm >= 9.15.0

## Support

- Slack : #insurtech-dev
- Email : dev@skalean-insurtech.ma
- Documentation : `docs/`
