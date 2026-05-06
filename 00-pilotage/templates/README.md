# Templates de Generation -- skalean-insurtech v2.2

**Version** : 2.2.0
**Date** : Mai 2026
**Statut** : 4 templates de generation
**AUCUNE EMOJI AUTORISEE**

---

## Vue d'ensemble

Ce dossier contient les **4 templates de generation** utilises pour creer les fichiers du programme :

| Template | Usage |
|----------|-------|
| `02-template-sprint.md` | Comment ecrire un meta-prompt sprint B-XX |
| `03-template-task.md` | Comment ecrire un prompt de tache X.Y.Z |
| `04-template-verification.md` | Comment ecrire un fichier verification V-XX |
| `05-template-orchestrateur.md` | Comment ecrire un orchestrateur C-XX |

---

## Workflow generation

### 1. Generation meta-prompt B-XX (manuel ou IA-assisted)

Utiliser `02-template-sprint.md` pour produire un fichier B-XX-sprint-XX-*.md depuis :
- Plan de realisation v2.0 (cf `../plan-realisation/`)
- Documentation racine v2.2 (cf `../documentation/`)
- Decisions strategiques (cf `../decisions/`)

### 2. Generation prompts taches X.Y.Z (par Cowork au demarrage sprint)

Utiliser `03-template-task.md` pour produire les fichiers `task-X.Y.Z-*.md` depuis le meta-prompt B-XX correspondant.

### 3. Generation orchestrateur C-XX (deja produit)

Utiliser `05-template-orchestrateur.md` pour produire C-XX-sprint-XX-*.md depuis le meta-prompt B-XX.

### 4. Generation verification V-XX (deja produit)

Utiliser `04-template-verification.md` pour produire V-XX-sprint-XX-*.md depuis le meta-prompt B-XX (extraction criteres P0/P1/P2).

---

## Statut generations actuelles

| Type | Fichiers | Statut |
|------|----------|--------|
| **B-XX** | 35 | LIVRES (`../meta-prompts/`) |
| **task-X.Y.Z** | 0 / 462 | A generer par Cowork au demarrage sprint (`../prompts-taches/`) |
| **C-XX** | 35 | LIVRES (`../orchestrateurs/`) |
| **V-XX** | 35 | LIVRES (`../verifications/`) |

---

## Conventions naming

```
B-{XX}-sprint-{XX}-{kebab-case}.md       # Meta-prompts
task-{X}.{Y}.{Z}-{kebab-case}.md         # Prompts taches
C-{XX}-sprint-{XX}-{kebab-case}.md       # Orchestrateurs
V-{XX}-sprint-{XX}-{kebab-case}.md       # Verifications
```

Avec :
- `XX` = numero cumul sprint (01-35)
- `X.Y.Z` = phase.sprint_in_phase.task_in_sprint

---

**Fin du README templates v2.2.**
