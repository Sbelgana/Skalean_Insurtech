# TEMPLATE -- FICHIER SPRINT COMPLET

**Usage** : Ce template guide la creation d'un fichier `sprint-{cumul}-prompt-complet.md` qui consolide en un seul document toutes les taches d'un sprint donne du projet skalean-insurtech.

**Contexte d'utilisation** : Ce fichier est destine a etre execute par Claude Code en sequence. Il contient toutes les taches du sprint dans l'ordre d'execution avec leurs metadonnees, contexte, objectifs, references configuration, implementations, tests, criteres de validation et commandes a executer.

**Fichier cible** : `prompts/sprints/sprint-{cumul}-prompt-complet.md`

**Convention de numerotation** :
- `{cumul}` = numero absolu cumule du sprint dans le projet entier (1 a 32)
- Sprint 1 = Phase 1 / Sprint 1 (1.1)
- Sprint 5 = Phase 2 / Sprint 1 (2.1)
- Sprint 32 = Phase 10 / Sprint 1 (10.1)

Les taches a l'interieur sont numerotees X.Y.Z ou X est la phase, Y le sprint dans la phase, Z la tache.

---

## STRUCTURE DU FICHIER

Le fichier complet suit obligatoirement cette structure de haut niveau :

```markdown
# SPRINT {cumul} -- Phase {X} / Sprint {Y} : {Nom}

## Prompt complet consolide

---

# ==================================================================
# TACHE {X}.{Y}.1
# ==================================================================

[Contenu complet de la tache 1]

---

# ==================================================================
# TACHE {X}.{Y}.2
# ==================================================================

[Contenu complet de la tache 2]

---

[... ainsi de suite jusqu'a la derniere tache du sprint ...]

---

# ==================================================================
# VERIFICATION FINALE SPRINT {cumul}
# ==================================================================

[Reference au fichier de verification associe]

---

# RESUME DU SPRINT
```

---

## SECTION 1 -- EN-TETE DU SPRINT

L'en-tete commence par un titre niveau 1 strict :

```markdown
# SPRINT {cumul} -- Phase {X} / Sprint {Y} : {Nom court}

## Prompt complet consolide
```

**Exemples valides** :
- `# SPRINT 1 -- Phase 1 / Sprint 1 : Bootstrap monorepo et CI`
- `# SPRINT 13 -- Phase 4 / Sprint 4 : Pay MA Multi-Passerelles`
- `# SPRINT 22 -- Phase 6 / Sprint 2 : IA Estimation Photos et Anti-Fraude`
- `# SPRINT 32 -- Phase 10 / Sprint 1 : Pilote Marrakech et Go-Live`

L'en-tete ne contient ni emoji ni decoration. Le sous-titre `## Prompt complet consolide` est invariant.

---

## SECTION 2 -- DELIMITATEUR DE TACHE

Chaque tache du sprint est precedee d'un delimitateur visuel obligatoire :

```markdown
---

# ==================================================================
# TACHE {X}.{Y}.{Z}
# ==================================================================

```

ou :
- `{X}` est le numero de la phase (1 a 10)
- `{Y}` est le numero du sprint dans la phase
- `{Z}` est le numero de la tache dans le sprint

**Exemples valides** :
- `# TACHE 1.1.1` -> premiere tache du Sprint 1 de la Phase 1 (Bootstrap monorepo)
- `# TACHE 4.4.5` -> 5e tache du 4e sprint de la Phase 4 (Adapter CMI dans Pay MA Multi)
- `# TACHE 6.2.7` -> 7e tache du 2e sprint de la Phase 6 (Service Estimation IA)

Le delimitateur utilise exactement 66 signes egal sur chacune des deux lignes encadrantes. Cette longueur permet une recherche rapide via grep dans les fichiers consolides volumineux.

---

## SECTION 3 -- CONTENU D'UNE TACHE

Apres le delimitateur, le contenu integral de chaque tache est insere selon la structure definie dans `03-template-task.md`. Cette structure comporte les sections obligatoires suivantes dans l'ordre exact :

1. Titre `# TACHE {X}.{Y}.{Z} : {Nom court de la tache}`
2. `## METADONNEES`
3. `## CONTEXTE`
4. `## OBJECTIF`
5. `## ETAT ACTUEL DU REPO`
6. `## REFERENCES CONFIGURATION`
7. `## IMPLEMENTATION REQUISE`
8. `## TESTS REQUIS`
9. `## CRITERES DE VALIDATION`
10. `## COMMANDES A EXECUTER`
11. `## NOTES IMPORTANTES`

Chaque tache fait typiquement entre 600 et 1500 lignes de markdown. Les sprints les plus complexes (Sprint 4.4 paiement, Sprint 6.2 IA) peuvent depasser 1800 lignes par tache.

---

## SECTION 4 -- VERIFICATION FINALE

A la fin du fichier sprint, apres la derniere tache, une reference vers le fichier de verification dedie :

```markdown
---

# ==================================================================
# VERIFICATION FINALE SPRINT {cumul}
# ==================================================================

La verification automatique a auto-reparation du sprint {cumul} est definie dans le fichier dedie :

```
prompts/verifications/verify-sprint-{cumul}.md
```

Lancer la verification avec la commande :

```bash
cat prompts/verifications/verify-sprint-{cumul}.md
```

Puis executer chaque section bash du fichier de verification. Le rapport sera consolide dans `sprint{cumul}-verify-report.md`.
```

Cette dissociation est volontaire : le fichier sprint sert a executer les taches, le fichier verification sert a valider l'ensemble.

---

## SECTION 5 -- RESUME EXECUTIF

Le fichier se termine par une section recapitulative qui synthetise l'apport du sprint :

```markdown
---

# RESUME DU SPRINT {cumul}

## Phase et position
- Phase : {X} -- {Nom de la phase}
- Sprint dans la phase : {Y}
- Position cumulee : {cumul} / 32

## Apports principaux
{Liste des 3 a 5 apports majeurs du sprint en termes de fonctionnalites livrees}

## Modules skalean-insurtech concernes
{Liste des packages crees ou modifies dans ce sprint}

## Tables PostgreSQL ajoutees
{Liste des tables `{module}_{entite}` creees, avec leur but court}

## Events Kafka introduits
{Liste des events `insurtech.events.*` publies par les nouveaux services}

## Dependances externes activees
{Liste des accords commerciaux, API ou prestataires necessaires apres ce sprint}

## Prerequis pour le sprint suivant
{Ce qui doit etre PASS avant de passer au Sprint {cumul+1}}

## Score GO/NO-GO requis
Le sprint est considere termine quand la verification automatique atteint un score minimum de 95% PASS sur l'ensemble des criteres definis dans `verify-sprint-{cumul}.md`. Les criteres marques P0 (priorite critique) doivent etre 100% PASS sans exception.
```

---

## SECTION 6 -- REGLES DE COMPILATION

### Regle 1 -- Ordre des taches

Les taches sont inserees dans l'ordre numerique strict (1, 2, 3, ..., n). Cet ordre reflete les dependances : la tache N peut importer du code cree par la tache N-1 mais jamais l'inverse. Aucune execution parallele n'est autorisee.

### Regle 2 -- Delimitation

Chaque tache est precedee de son delimitateur visuel (lignes avec 66 signes egal) et suivie d'une ligne `---` qui marque la fin de la tache.

### Regle 3 -- Pas de duplication

Le fichier consolide ne duplique jamais le contenu des taches deja presentes en fichiers individuels dans `prompts/tasks/`. Il sert a presenter une vue agreggee pour l'execution sequentielle. Si une tache est modifiee dans son fichier individuel, le fichier consolide doit etre regenere.

### Regle 4 -- Aucune emoji

Aucune emoji n'est autorisee dans le fichier consolide, ni dans les titres, ni dans les sections, ni dans le code, ni dans les commentaires. Cette regle est absolue.

### Regle 5 -- Encodage et fins de ligne

Le fichier est encode en UTF-8 sans BOM, avec des fins de ligne LF (jamais CRLF). Cette regle est imposee par le `.gitattributes` du monorepo.

### Regle 6 -- Nom du fichier

Le nom du fichier suit strictement le pattern :

```
sprint-{cumul}-prompt-complet.md
```

ou `{cumul}` est le numero cumule du sprint sans zero de tete (1, 2, ..., 32).

---

## SECTION 7 -- EXEMPLE DE CHARTE TYPE

Pour le Sprint 1 (Phase 1 / Sprint 1 : Bootstrap monorepo), le fichier consolide commence ainsi :

```markdown
# SPRINT 1 -- Phase 1 / Sprint 1 : Bootstrap monorepo et CI

## Prompt complet consolide

---

# ==================================================================
# TACHE 1.1.1
# ==================================================================

# TACHE 1.1.1 : Initialisation Monorepo pnpm + Turborepo

## METADONNEES
- Phase: 1 -- Infrastructure et fondations
- Sprint: 1 -- Bootstrap monorepo et CI
- Priorite: P0
- Duree estimee: 4 heures
- Dependances: Aucune (premiere tache du projet)
- Dashboard concerne: N/A (infrastructure transverse)
- Roles impactes: N/A (setup initial)

---

## CONTEXTE

C'est la toute premiere tache du projet skalean-insurtech. Le depot Git est vide. Aucun fichier n'existe.

skalean-insurtech est un projet entierement nouveau, depot Git independant, qui construit deux SaaS InsurTech (Broker et Garage) plus une admin app (InsurTech Admin). L'ensemble du code est organise dans un monorepo unique gerant 5 applications Next.js, 1 backend NestJS, 14+ packages partages, et une infrastructure Docker/Kubernetes.

Cette tache etablit le squelette complet du monorepo : gestionnaire de paquets (pnpm workspaces), systeme de build (Turborepo 2.4), arborescence de tous les packages et applications, et configuration de base Node.js/TypeScript. Toutes les taches suivantes du Sprint 1 et de tous les sprints futurs dependent de cette structure.

[continuer avec la suite habituelle d'une tache]
```

---

## SECTION 8 -- VALIDATION FINALE DU TEMPLATE

Pour qu'un fichier sprint complet soit considere conforme, il doit satisfaire les criteres suivants :

1. Le titre niveau 1 respecte le format `# SPRINT {cumul} -- Phase {X} / Sprint {Y} : {Nom}`
2. Chaque tache est encapsulee par son delimitateur `# TACHE {X}.{Y}.{Z}` entre lignes `===`
3. L'ordre des taches est strictement numerique
4. Chaque tache contient les 11 sections obligatoires definies dans le template task
5. Le fichier se termine par une reference au fichier de verification dedie
6. Le fichier se termine par un resume executif structure
7. Aucune emoji n'est presente dans aucune section du fichier
8. L'encodage est UTF-8 sans BOM, fins de ligne LF
9. Le nom du fichier respecte `sprint-{cumul}-prompt-complet.md`

Un script de validation `infrastructure/scripts/validate-sprint-file.ts` peut etre execute pour verifier ces criteres automatiquement.

---

**Fin du template `02-template-sprint.md`.**
**Voir `03-template-task.md` pour le detail de la structure de chaque tache.**
