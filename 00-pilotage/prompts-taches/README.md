# Prompts-Taches (generes par Cowork) -- skalean-insurtech v2.2

**Version** : 2.2.0
**Date** : Mai 2026
**Statut** : VIDE -- a generer par Cowork au demarrage de chaque sprint
**AUCUNE EMOJI AUTORISEE**

---

## Vue d'ensemble

Ce dossier contiendra les **prompts taches detaillees** generes par Cowork au demarrage de chaque sprint, a partir des meta-prompts B-XX correspondants.

**Structure cible** (apres execution Sprint 1) :

```
prompts-taches/
├── sprint-01-bootstrap/
│   ├── task-1.1.1-init-monorepo.md
│   ├── task-1.1.2-typescript-biome.md
│   ├── task-1.1.3-docker-compose.md
│   ├── ...
│   ├── task-1.1.15-architecture-docs.md
│   └── _SUMMARY.md
├── sprint-02-database-kafka/
│   ├── task-1.2.1-database-package.md
│   ├── ...
│   └── _SUMMARY.md
├── ...
└── sprint-35-pilote-marrakech/
    ├── task-7.7.1-pre-pilote-checklist.md
    ├── ...
    └── _SUMMARY.md
```

---

## Workflow generation

### Au debut de chaque sprint N

1. **Cowork lit** le meta-prompt B-{N} : `00-pilotage/meta-prompts/B-{N:02d}-sprint-{N:02d}-*.md`
2. **Cowork genere** les prompts taches X.Y.Z dans `prompts-taches/sprint-{N:02d}-*/`
3. **Chaque prompt tache** contient :
   - Metadonnees (Phase / Sprint / Effort / Priorite / Dependances)
   - But (1 sentence)
   - Contexte
   - Livrables checkables (5-12)
   - Code patterns (extraits du B-XX)
   - Tests requis
   - Criteres validation V1-V10
4. **Cowork execute** chaque tache via orchestrateur C-{N}
5. **Apres derniere tache** : verification V-{N}

### Convention naming

```
task-{X}.{Y}.{Z}-{kebab-case-titre}.md
```

- `X` = Phase (1-7)
- `Y` = Sprint dans la phase (1-N)
- `Z` = Tache dans le sprint (1-N)

### Mapping Sprint cumul -> task prefix

Voir `00-pilotage/documentation/10-arborescence-projet.md` section "Mapping numerotation" pour table complete.

Exemples :
- Sprint 1 (Bootstrap) -> task-1.1.X
- Sprint 6 (Multi-tenant) -> task-2.2.X
- Sprint 14 (Insure Foundation) -> task-4.1.X
- Sprint 24 (Flux M8) -> task-5.6.X
- Sprint 30 (MCP) -> task-7.2.X
- Sprint 35 (Pilote) -> task-7.7.X

---

## Volume estime

| Element | Estimation |
|---------|------------|
| Total sprints | 35 |
| Total taches | 462 |
| Volume estime par tache | 5-15 ko |
| **Volume total estime** | **~3.5 Mo** |

---

## Convention tasks dans repo Git

**Important** : Les prompts taches sont **dans 00-pilotage/** (non versionne dans repo Git du produit). Cowork les utilise pour produire le code dans `repo/` mais les prompts eux-memes restent dans la zone pilotage.

---

## Statut actuel

VIDE -- prompts taches generes au demarrage de chaque sprint.

Le **premier sprint** (Sprint 1 Bootstrap) sera le premier a peupler ce dossier (15 taches dans `sprint-01-bootstrap/`).

---

**Au demarrage Sprint 1**, lancer la commande :

```bash
# Cowork genere les 15 prompts taches Sprint 1
claude-code generate-tasks \
  --meta-prompt 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md \
  --output-dir 00-pilotage/prompts-taches/sprint-01-bootstrap/
```

---

**Fin du README prompts-taches v2.2.**
