# Task 7.5a.9 — Commit et tag annote de la fondation Sprint 7.5a (Assurflow v3.0)

## 1. Header metadata

| Champ | Valeur |
|---|---|
| Projet | Skalean InsurTech v3.0 |
| Vertical | Assurflow |
| Sprint | 7.5a — Assurflow Foundation |
| Reference meta-prompt | B-7.5a, tache 7.5a.9 |
| Phase | 2.5 (Fondation verticale Assurflow) |
| Priorite | P0 (bloquant) |
| Effort estime | 1h |
| Dependances | 7.5a.8 (tous les tests verts, coverage atteinte) |
| Bloque | 7.5a.10 (documentation et cross-reference de cloture), puis Sprint 7 tache 2.3.2 |
| Position dans le sprint | 9 / 10 |
| Densite cible du present fichier | 80-150 ko (cible 90-110 ko) |
| Type de livrable | Operation Git (commit de fondation + tag annote + push) |
| Contrainte absolue | AUCUNE EMOJI nulle part (decision-006) |
| Branche cible | `main` (ou branche d'integration `integration/sprint-7.5a` selon flux retenu, voir section 12) |
| Tag a creer | `sprint-7.5a-complete-v3-foundation` (annote, non leger) |
| Scope commit | `sprint-7.5a` |
| HEAD de depart | `e98acca` ("chore: add sprint 23 prompt set and sprint 7 reprise plan") |
| Outils requis | git >= 2.34, pnpm >= 9, Node >= 22.11.0, husky, commitlint, bash |

---

## 2. But

Cette tache scelle l'integralite du travail produit par le Sprint 7.5a (taches 7.5a.1 a 7.5a.8) en un evenement Git unique, atomique et trace : un commit de fondation suivant strictement la convention Conventional Commits, puis un tag annote `sprint-7.5a-complete-v3-foundation` qui materialise un jalon GO/NO-GO du programme. Le tag n'est pas un simple marqueur cosmetique : il sert de point de reference immuable et auditable a partir duquel le Sprint 7 (notamment la tache 2.3.2) pourra demarrer en toute confiance, et il constitue la baseline d'audit ACAPS/CNDP de la fondation verticale Assurflow.

L'enjeu est double. D'une part, la qualite du commit : tous les changements des huit taches precedentes doivent etre stages proprement (sans artefacts de build, sans fichier genere, sans secret, sans emoji), avec un message de commit exhaustif decrivant chaque livrable. D'autre part, la robustesse du jalon : avant de poser le tag, un portail de validation (pre-tag gate) rejoue l'ensemble des controles du sprint (typecheck, lint, tests, coverage, no-emoji, migrations up/down) afin de garantir que le tag ne pointe jamais vers un etat instable. Un tag est de facto considere comme intouchable une fois pousse et partage ; il faut donc qu'il soit correct du premier coup.

Le resultat attendu est : (1) un arbre de travail propre apres commit, (2) un commit unique de fondation conforme a commitlint, (3) un tag annote portant un message riche, (4) le push de la branche et du tag vers le remote, (5) la mise a jour du fichier `CHECKLIST-MASTER-EXECUTION.md` uniquement s'il est present dans le depot, (6) une CI verte apres le push. Aucune de ces etapes ne doit etre realisee si le portail de validation echoue.

---

## 3. Contexte etendu

### 3.1 Pourquoi un commit de fondation unique plutot que des micro-commits

Le Sprint 7.5a a produit, au fil des taches 7.5a.1 a 7.5a.8, un ensemble coherent de fondations pour la verticale Assurflow : schemas de donnees, types partages, contrats Zod, structure de packages, migrations, guards multi-tenant, evenements Kafka, et la couverture de tests associee. Ces elements forment une unite logique : ils n'ont de sens que pris ensemble, car ils definissent le socle minimal sur lequel les sprints applicatifs ulterieurs vont construire. Poser un commit unique de fondation (eventuellement issu d'un squash des commits de travail intermediaires) presente trois avantages majeurs.

Premierement, la lisibilite de l'historique. Un reviewer ou un auditeur qui consulte `git log --oneline` doit pouvoir identifier instantanement le jalon de fondation Assurflow sans naviguer dans une dizaine de commits "wip", "fix typo", "rebase". Un commit de fondation unique, intitule selon la convention `feat(sprint-7.5a): ...`, est immediatement reperable et son message decrit l'integralite du perimetre.

Deuxiemement, la coherence du tag. Un tag annote pointe vers un unique commit. Si la fondation etait eclatee en de multiples commits, le tag ne capturerait que le dernier, et la semantique "voici la fondation complete" serait portee par un message de tag deconnecte du contenu reel du commit pointe. En consolidant la fondation dans un commit dont le message est exhaustif, on aligne parfaitement le contenu du commit, le message du commit et le message du tag.

Troisiemement, la facilite de revert. Si la fondation devait etre annulee (par exemple parce qu'un defaut bloquant est decouvert apres le tag), un `git revert` d'un commit unique est trivial et sur, alors que reverter une chaine de micro-commits interdependants est une operation fragile et source d'erreurs.

L'alternative "garder tous les micro-commits" reste acceptable si chaque micro-commit est deja conforme a Conventional Commits, propre et atomique : dans ce cas, le commit de fondation peut etre un commit de cloture leger (par exemple un commit vide annote, ou un commit de mise a jour de checklist) qui sert d'ancre pour le tag. Le present document privilegie le scenario "fondation consolidee en un commit de fondation explicite" mais documente les deux flux en section 12.

### 3.2 Hygiene de commit dans un monorepo

Un monorepo pnpm comme Skalean InsurTech impose une discipline de staging particuliere, car un `git add -A` aveugle aspire des dizaines de packages et risque d'embarquer des artefacts transverses (`.turbo/`, `dist/`, `coverage/`, `*.tsbuildinfo`) generes par n'importe quelle commande de build executee avant le commit. La regle d'hygiene est donc : stager par categories explicites du perimetre du sprint (les chemins listes en section 6) plutot que par `git add -A`. Le staging cible garantit que seules les modifications appartenant a la fondation Assurflow entrent dans le commit, et que les modifications collaterales d'autres developpeurs ou d'autres taches ne se melangent pas a ce jalon.

L'hygiene de commit dans un monorepo couvre aussi la question du lockfile : `pnpm-lock.yaml` est partage par tous les packages. Si la fondation a ajoute des dependances, le lockfile a change et doit etre stage avec le reste, sinon la CI `--frozen-lockfile` echouera. A l'inverse, si aucune dependance n'a change, le lockfile ne doit pas apparaitre dans le diff (un lockfile modifie sans raison signale souvent une version locale de pnpm differente de celle de la CI, ce qui est un piege a part entiere). De meme, les fichiers `.changeset/*.md`, s'ils sont utilises pour la gestion semantique des versions, doivent etre cohérents avec les packages reellement modifies.

Enfin, l'hygiene monorepo impose de verifier qu'aucun artefact de build n'est deja suivi par Git (heritage d'un commit anterieur fautif). Un dossier `dist/` ou `.turbo/` qui a ete commite une fois reste suivi malgre `.gitignore` : il faut le detecter (`git ls-files | grep -E 'dist|\.turbo'`) et le retirer (`git rm -r --cached`) dans un commit de nettoyage distinct, avant de poser le commit de fondation. Ne jamais melanger un nettoyage d'artefacts avec le commit de jalon : cela pollue le message et complique un eventuel revert.

### 3.3 Pourquoi un tag annote (et non un tag leger) avec option de signature GPG

Un tag leger (`git tag X`) n'est qu'une reference nommee vers un commit, sans metadonnees propres : pas d'auteur, pas de date de creation du tag, pas de message. Il est invisible dans `git cat-file -t X` (qui retourne `commit`, pas `tag`) et ne porte aucune information auditable. Pour un jalon de programme, c'est insuffisant : un audit ACAPS/CNDP doit pouvoir repondre a "qui a scelle cette baseline, quand, et avec quelle justification". Seul un tag annote (`git tag -a X -m "..."`) cree un veritable objet Git distinct, portant un tagger (nom + email), une date de tag, et un message multi-lignes. C'est pourquoi le tag annote est OBLIGATOIRE ici, et la verification `git cat-file -t <tag>` doit retourner exactement `tag`.

L'option de signature GPG/SSH (`git tag -s X`) ajoute une couche de non-repudiation : le tag est cryptographiquement signe par la cle du tagger, et `git tag -v <tag>` verifie que la signature est valide et que la cle est de confiance. Pour un jalon reglementaire, la signature apporte une preuve forte que le tag n'a pas ete fabrique par un tiers. Le present document fournit les deux variantes (annotee simple via `SIGN_TAG=0`, et signee via `SIGN_TAG=1`). Si la politique du depot exige la signature (regle de protection de branche/tag cote forge), l'absence de signature devient un echec de validation. La cle doit etre configuree au prealable (`git config user.signingkey`, `commit.gpgsign`, `tag.gpgSign`) ; en environnement souverain, la cle vit dans l'infrastructure MA et n'en sort pas.

### 3.4 Semantique du tag comme jalon GO

Le tag `sprint-7.5a-complete-v3-foundation` est un jalon GO. Sa presence dans le depot signifie, pour toute l'equipe et pour les outils d'orchestration du programme, que la fondation verticale Assurflow de la v3.0 est complete, testee, et stable. Concretement, la tache Sprint 7 2.3.2 (et plus largement les taches qui dependent de la fondation Assurflow) verifie l'existence de ce tag avant de demarrer. Le tag agit donc comme un verrou de dependance inter-sprint : tant qu'il n'existe pas, le travail aval ne doit pas commencer ; des qu'il existe et que la CI est verte sur le commit pointe, le travail aval est debloque.

Cette semantique GO/NO-GO est binaire et sans zone grise : soit le tag existe, pointe vers un commit a CI verte, et porte un message conforme — auquel cas le gate est GO ; soit l'une de ces conditions manque — auquel cas le gate est NO-GO et aucun travail aval ne demarre. Il n'existe pas de "GO partiel". C'est volontaire : un jalon de fondation qui serait "presque complet" est en realite incomplet, car les sprints aval s'appuieront sur des contrats (types, schemas, evenements) qui doivent etre stables a 100 %. Un contrat instable a 95 % casse de maniere imprevisible les 5 % de cas non couverts, souvent en production.

Cette semantique impose une discipline : on ne pose le tag qu'apres avoir rejoue tous les controles localement (le portail pre-tag de la section 7.a) ET verifie que la CI passe au vert sur le commit. Poser le tag avant la CI verte est un piege classique (voir 3.7) car cela peut debloquer du travail aval sur une base reellement cassee. Le gate GO/NO-GO est donc materialise par deux verrous successifs : le portail local (juge de premiere instance) et la CI distante (juge de paix), et seule la conjonction des deux autorise la pose puis le push du tag.

### 3.5 Strategie de branche : main vs branche de release

Deux flux de branche sont supportes pour ce jalon, et le choix depend de la maturite du processus de l'equipe.

Flux A — tag directement sur `main`. C'est le flux par defaut quand `main` est la branche d'integration continue et que la fondation y a ete mergee au fur et a mesure (ou via une PR unique deja fusionnee). Le commit de fondation est pose sur `main`, la CI s'execute sur `main`, et le tag pointe vers le commit de `main`. Avantage : simplicite, un seul historique lineaire. Inconvenient : `main` doit etre protege (pas de force-push, revues obligatoires) pour que le jalon soit fiable.

Flux B — branche d'integration `integration/sprint-7.5a` puis merge vers `main`. C'est le flux quand l'equipe veut isoler la fondation sur une branche dediee, faire valider l'ensemble par une PR, puis merger vers `main` et taguer le commit de merge (ou le commit de fondation sur `main` apres merge). Avantage : isolation, revue groupee, possibilite de rejouer le portail sur la branche avant merge. Inconvenient : un niveau d'indirection de plus, et il faut decider si le tag pointe vers le commit sur la branche d'integration ou vers le commit resultant sur `main` (recommandation : taguer sur `main` apres merge, pour que le jalon vive sur la branche permanente).

Dans les deux flux, la branche autorisee au moment de poser le tag est verifiee explicitement (`main` ou `integration/sprint-7.5a`) par le portail et par les scripts. On ne pose JAMAIS un jalon de programme sur une branche de feature ephemere (`feature/...`) qui sera supprimee apres merge : le tag survivrait a la branche mais son contexte d'historique deviendrait confus.

### 3.6 Relation a la CI

La CI est le juge de paix du gate GO/NO-GO. Le portail local (section 7.a) et la CI distante (section 7.g) executent volontairement la MEME sequence de controles (typecheck, lint, no-emoji, tests, coverage, build), pour deux raisons. Premierement, la redondance de defense : un controle qui passerait localement mais echouerait en CI (ou l'inverse) revele une difference d'environnement (version de Node, cache pnpm, variable manquante) qu'il faut diagnostiquer avant de taguer. Deuxiemement, la confiance : l'auteur du jalon a la garantie, avant meme de pousser, que la CI passera, parce qu'il a deja rejoue exactement la meme chose en local.

La sequence temporelle est stricte : (1) portail local vert, (2) commit de fondation, (3) push de la branche (qui declenche la CI), (4) attente de la CI verte sur le commit pousse, (5) creation du tag annote, (6) push du tag. Le tag n'est jamais pousse avant que la CI ne soit verte sur le commit qu'il pointe. Cette regle est implementee par la variable `PUSH_TAG_NOW` (defaut `0`) et par le helper `verify-ci.sh` qui interroge l'API de la forge. La CI est donc a la fois un controle de qualite et une condition de deblocage du push du tag.

### 3.7 Tableau d'alternatives et arbitrages

| Dimension | Option A | Option B | Option C | Arbitrage retenu |
|---|---|---|---|---|
| Consolidation de l'historique | Squash en un commit de fondation | Merge commit conservant les micro-commits | Garder tous les micro-commits propres | Commit de fondation explicite (squash logique) ; conservation possible des micro-commits s'ils sont deja conformes ; pas de squash destructif si l'historique est propre |
| Type de tag | Tag leger (`git tag X`) | Tag annote (`git tag -a`) | Tag signe (`git tag -s`) | Annote OBLIGATOIRE ; signe si la politique du depot l'exige (decision-011 a 015) |
| Moment du tag | Tag avant CI | Tag apres portail local mais push du tag apres CI | Tag et push apres CI verte | Portail local d'abord ; push branche ; CI verte ; puis tag et push du tag |
| Branche du jalon | `main` directe | `integration/sprint-7.5a` puis merge | Branche de feature | `main` (Flux A) ou `integration/sprint-7.5a` puis merge vers `main` (Flux B) ; jamais une feature ephemere |
| Staging | `git add -A` | `git add` par categories | `git add -p` interactif | Staging par categories explicites du perimetre (section 6) |
| Gestion du lockfile | Stager systematiquement | Stager seulement si modifie a raison | Ignorer | Stager uniquement si une dependance a reellement change ; un lockfile modifie sans raison est un signal d'alerte |

**Squash vs merge vs micro-commits.** Le squash produit un historique propre mais perd la granularite du travail intermediaire ; le merge conserve l'historique complet mais alourdit le log ; garder les micro-commits suppose qu'ils soient deja propres. Arbitrage retenu : commit de fondation explicite (consolidation logique), avec conservation possible des commits de travail si deja conformes. On ne force pas un squash destructif si l'historique de travail est deja propre et conforme.

**Tag leger vs tag annote.** Un tag leger (`git tag X`) est un simple pointeur sans metadonnees. Un tag annote (`git tag -a X -m "..."`) est un objet Git a part entiere portant auteur, date, message, et eventuellement signature. Arbitrage retenu et impose : tag ANNOTE obligatoire. Un jalon de programme auditable doit porter un message, un auteur et une date verifiables. La verification `git cat-file -t <tag>` doit retourner `tag` (et non `commit`), preuve de l'annotation.

**Tag maintenant vs apres CI.** Poser le tag avant la CI verte risque de marquer comme "GO" un etat casse. Arbitrage retenu : portail pre-tag local OBLIGATOIRE avant le tag ; push du commit d'abord, attente CI verte, puis tag et push du tag. Variante acceptable documentee : tag local pose apres portail vert, mais push du tag uniquement apres CI verte sur le commit.

**Tag signe vs non signe.** Selon la politique du depot, les tags de jalon peuvent devoir etre signes GPG/SSH (`git tag -s`). Le present document fournit la procedure signee et non signee ; si la politique exige la signature, l'absence de signature est un echec de validation (voir piege 3.8.2).

### 3.8 Pieges nommes (14-16)

3.8.1 **Tag deja existant.** `git tag` echoue si le tag existe deja localement. Pourquoi : un nom de tag est unique dans le namespace `refs/tags/` ; Git refuse de creer un doublon sans `-f`. Solution : NE JAMAIS ecraser un tag de jalon avec `-f` sur un tag pousse et partage, car cela casse les clones d'autrui (qui garderont l'ancien objet tag). Diagnostiquer avec `git tag -l <tag>` et `git ls-remote --tags origin <tag>`, puis appliquer le runbook de la section 12 (suppression locale si non pousse, tag correctif distinct si deja consomme).

3.8.2 **Exigence de tag signe non respectee.** Si la politique impose `git tag -s`, un tag annote non signe sera rejete par la CI ou par une regle de protection de tag cote forge. Pourquoi : la signature est la seule preuve de non-repudiation du tagger pour un jalon reglementaire. Solution : configurer la cle GPG/SSH (`git config user.signingkey`, `git config tag.gpgSign true`), poser le tag avec `SIGN_TAG=1`, puis verifier `git tag -v <tag>` qui doit afficher une signature valide.

3.8.3 **Push non-fast-forward rejete.** Le remote a avance depuis le dernier fetch ; `git push` est rejete avec `! [rejected] ... (non-fast-forward)`. Pourquoi : Git protege l'historique partage en refusant d'ecraser des commits que d'autres ont peut-etre deja recuperes. Solution : ne JAMAIS forcer (`--force`) sur `main` ; faire `git fetch`, puis `git rebase origin/main`, rejouer integralement le portail pre-tag (l'etat a change), puis re-pousser. Le rebase peut introduire des conflits a resoudre proprement.

3.8.4 **Hook husky bloquant.** Le hook `pre-commit` (lint-staged, check-no-emoji) ou `commit-msg` (commitlint) bloque le commit. Pourquoi : les hooks sont la premiere ligne de defense de la qualite, executes localement avant meme la CI. Solution : ne pas contourner avec `--no-verify` (interdit) ; lire la sortie du hook, corriger la cause reelle (fichier mal formate, emoji, message non conforme), re-stager si necessaire, et recommencer le commit. Contourner un hook revient a desactiver le gate de qualite et est une faute de processus.

3.8.5 **Echec commitlint.** Message non conforme `<type>(scope): description` : commitlint rejette avec `subject may not be empty` ou `type must be one of ...`. Pourquoi : Conventional Commits est la convention obligatoire (section 14) qui alimente le changelog et la tracabilite. Solution : respecter le scope `sprint-7.5a` et un type valide (`feat`, `chore`, `docs`, etc.) ; utiliser le message pre-formate fourni en section 16, qui est conforme par construction et passe commitlint sans modification.

3.8.6 **Emoji dans des fichiers stages.** `check-no-emoji.sh` (decision-006) rejette tout emoji present dans le diff stage, et la CI echoue de la meme maniere. Pourquoi : decision-006 est une regle ABSOLUE du programme, sans exception, qui garantit la coherence des sorties et l'absence de caracteres problematiques dans les contextes reglementaires et terminaux. Solution : localiser l'emoji via la sortie du script, le retirer integralement (y compris les variantes avec selecteur `FE0F`), re-stager, recommencer. Aucune exception n'est tolerable, meme dans un commentaire ou une chaine de test.

3.8.7 **Staging accidentel d'artefacts de build.** `dist/`, `.turbo/`, `coverage/`, `node_modules/`, `*.tsbuildinfo` ne doivent jamais etre commites. Pourquoi : ce sont des sorties reproductibles, volumineuses et changeantes, qui polluent le diff, gonflent le depot et provoquent des conflits a chaque build. Solution : verifier `.gitignore`, inspecter `git diff --cached --name-only`, retirer du staging avec `git restore --staged <chemin>`, et si ces dossiers ont ete suivis par erreur dans le passe, les degager avec `git rm -r --cached`.

3.8.8 **`.turbo`/`dist` deja suivis par Git.** Si ces dossiers ont ete ajoutes par erreur dans un passe, ils restent suivis malgre `.gitignore`. Pourquoi : `.gitignore` n'agit que sur les fichiers non encore suivis ; un fichier deja indexe reste indexe. Solution : les retirer avec `git rm -r --cached .turbo dist`, confirmer leur presence dans `.gitignore`, et committer ce retrait dans un commit de nettoyage SEPARE du commit de fondation, pour ne pas melanger nettoyage et jalon.

3.8.9 **Binaire volumineux.** Un fichier binaire lourd (image, archive, dump SQL, capture) stage par erreur gonfle le depot de maniere irreversible (l'objet reste dans l'historique meme apres suppression). Pourquoi : Git conserve tout l'historique des blobs ; un binaire de plusieurs Mo alourdit chaque clone a jamais. Solution : detecter avant commit (le script de la section 7.b refuse tout fichier nouvellement stage > 2 Mo), evaluer si Git LFS est requis, sinon retirer le fichier du staging et le stocker hors depot.

3.8.10 **HEAD detache.** Un commit sur un HEAD detache n'est rattache a aucune branche et sera perdu des qu'on bascule de branche (collecte par le garbage collector). Pourquoi : un HEAD detache pointe vers un commit, pas vers une ref de branche mobile ; les nouveaux commits n'ont pas de point d'ancrage durable. Solution : verifier `git symbolic-ref --short HEAD` (qui echoue si detache), et si detache, faire `git switch main` (ou la branche d'integration) avant tout commit.

3.8.11 **Mauvaise branche.** Committer sur une branche de feature alors que le tag doit pointer vers `main` ou `integration/sprint-7.5a`. Pourquoi : le jalon doit vivre sur une branche permanente protegee ; une branche de feature ephemere disparaitra apres merge, laissant le tag dans un contexte d'historique confus. Solution : verifier la branche courante avant tout (le portail le fait), basculer sur la branche autorisee, ou merger la feature vers la cible puis taguer la cible.

3.8.12 **`CHECKLIST-MASTER-EXECUTION.md` absent.** Ce fichier vit dans un emplacement externe de pilotage et n'est PAS present dans le depot de code. Pourquoi : la separation entre depot de code et artefacts de pilotage est volontaire (gouvernance distincte). Solution : la tache doit mettre a jour le fichier s'il est present, et ne PAS echouer s'il est absent ; le helper de la section 7.f no-op proprement (exit 0) en cas d'absence et est idempotent (append-if-absent) en cas de presence.

3.8.13 **Lockfile divergent (pnpm-lock.yaml).** Le commit embarque un `pnpm-lock.yaml` modifie sans qu'aucune dependance n'ait reellement change. Pourquoi : une version locale de pnpm differente de celle de la CI reecrit le lockfile, ce qui fera echouer `pnpm install --frozen-lockfile` en CI. Solution : verifier la version de pnpm (`pnpm --version` vs `packageManager` dans `package.json`), ne stager le lockfile que si une dependance a change a dessein, et utiliser Corepack pour figer la version de pnpm.

3.8.14 **Sujet de commit trop long.** Un sujet de commit > 100 caracteres degrade la lisibilite du `git log --oneline` et peut etre tronque par certains outils. Pourquoi : la convention recommande un sujet court (<= 72-100 caracteres) et un corps detaille separe par une ligne vide. Solution : garder le sujet concis (le sujet fourni en section 16 fait moins de 100 caracteres), reporter tout detail dans le corps du message.

3.8.15 **CI verte sur un mauvais commit.** On verifie la CI sur le dernier run plutot que sur le commit precis pointe par le tag. Pourquoi : si plusieurs pushes se succedent rapidement, le dernier run peut concerner un autre commit. Solution : interroger la CI par SHA exact (`gh run list --commit <sha>`) et non par "dernier run", comme le fait `verify-ci.sh`, pour garantir que c'est bien le commit du jalon qui est vert.

3.8.16 **Tag pose sur un commit non descendant de la baseline.** Le commit de fondation ne descend pas de `e98acca` (HEAD de depart attendu), signalant une divergence d'historique. Pourquoi : un jalon doit s'inscrire dans la continuite de la baseline du programme. Solution : verifier `git merge-base --is-ancestor e98acca HEAD` ; si l'assertion echoue, investiguer un rebase/reset accidentel ou un mauvais clone avant de taguer.

### 3.9 Decisions referencees

- **decision-006** (no-emoji absolu) : aucun emoji, `check-no-emoji.sh`, CI fail.
- **decision-011 a 015** : conventions de jalonnement, de tag, de traceabilite et de gouvernance du programme (commit de fondation unique, tag annote pour chaque jalon GO, push apres CI verte, baseline d'audit). Ces decisions encadrent le present flux.
- **decision-008** (cloud souverain MA) : la baseline taguee est conservee dans l'infrastructure souveraine ; aucune donnee d'assure ne transite hors du Maroc.

---

## 4. Architecture context

### 4.1 Position dans le sprint

Position 9/10. La tache 7.5a.8 a garanti que tous les tests sont verts et que la coverage cible est atteinte. La tache 7.5a.9 (presente) scelle l'etat. La tache 7.5a.10 documentera et croisera les references de cloture. Le tag pose ici debloque le Sprint 7 tache 2.3.2.

### 4.2 Le portail GO/NO-GO avant le tag

```
                 SPRINT 7.5a (taches 1..8 terminees, tests verts)
                                  |
                                  v
                 +------------------------------------------+
                 |   PORTAIL PRE-TAG (section 7.a)          |
                 |   - typecheck monorepo                   |
                 |   - lint                                 |
                 |   - tests unit + integration             |
                 |   - coverage >= seuils                   |
                 |   - check-no-emoji                       |
                 |   - migrations up puis down              |
                 |   - arbre propre / pas d'artefacts       |
                 +------------------------------------------+
                        |                         |
                  TOUT VERT                   UN ECHEC
                        |                         |
                        v                         v
              COMMIT de fondation          ABORT (corriger, ne pas taguer)
                        |
                        v
                  PUSH branche
                        |
                        v
              +-------------------+
              |   CI (GitHub)     |  typecheck, lint, test, no-emoji, build
              +-------------------+
                  |            |
               VERTE         ROUGE
                  |            |
                  v            v
         TAG ANNOTE      ABORT tag (corriger d'abord)
                  |
                  v
            PUSH du tag
                  |
                  v
       JALON GO -> debloque Sprint 7 / 2.3.2
                  |
                  v
   CHECKLIST update (si present) -> task 7.5a.10
```

### 4.3 Flux commit/tag/push/CI

Le commit empaquete l'etat. Le push de la branche declenche la CI. La CI est le juge de paix : tant qu'elle n'est pas verte sur le commit, on ne pousse pas le tag. Le tag annote, une fois pousse, est immuable de fait. Le push du tag (`git push origin <tag>` ou `git push --tags`) le rend visible a toute l'equipe et aux outils d'orchestration.

---

## 5. Livrables checkables (15-25)

| # | Livrable | Verifiable par |
|---|---|---|
| L1 | Branche courante correcte (`main` ou branche d'integration retenue) | `git symbolic-ref --short HEAD` |
| L2 | Aucun artefact de build stage (`dist/`, `.turbo/`, `coverage/`, `node_modules/`) | `git diff --cached --name-only` |
| L3 | Aucun emoji dans le diff stage | `check-no-emoji.sh` sur le staged |
| L4 | Aucun secret/`.env` stage | `git diff --cached --name-only` + grep |
| L5 | Set de fichiers des taches 7.5a.1-8 stage | `git diff --cached --name-only` |
| L6 | Portail pre-tag entierement vert | script section 7.a, exit 0 |
| L7 | Commit de fondation cree | `git log -1 --pretty=%H` |
| L8 | Message de commit conforme Conventional Commits | regex section 8 |
| L9 | Message de commit avec scope `sprint-7.5a` | `git log -1 --pretty=%s` |
| L10 | Corps de commit listant les livrables 7.5a.1-8 | `git log -1 --pretty=%b` |
| L11 | Arbre de travail propre apres commit | `git status --porcelain` vide |
| L12 | Tag `sprint-7.5a-complete-v3-foundation` cree | `git tag -l` |
| L13 | Tag est annote (objet tag, pas commit) | `git cat-file -t <tag>` = `tag` |
| L14 | Message du tag riche | `git tag -n99 -l <tag>` |
| L15 | Tag pointe vers le commit de fondation | `git rev-list -n1 <tag>` |
| L16 | (si politique) tag signe verifiable | `git tag -v <tag>` |
| L17 | Branche poussee vers remote | `git rev-parse @{u}` |
| L18 | Tag pousse vers remote | `git ls-remote --tags origin` |
| L19 | CI verte sur le commit pointe | `gh run list` / API |
| L20 | `CHECKLIST-MASTER-EXECUTION.md` mis a jour SI present (sinon no-op) | helper section 7.f |
| L21 | Aucun fichier volumineux nouvellement suivi | script section 8 |
| L22 | HEAD non detache au moment du commit | `git symbolic-ref HEAD` |
| L23 | Tag absent en double (pas d'ecrasement involontaire) | `git tag -l` count = 1 |
| L24 | Rapport de jalon genere (sortie console) | log du script |
| L25 | Cross-reference vers 7.5a.10 preparee | section 17 |

---

## 6. Fichiers crees/modifies

Le commit de fondation empaquete le set produit par les taches 7.5a.1 a 7.5a.8. Liste indicative et representative (le contenu exact depend de la sortie de chaque tache, mais la categorisation est stable) :

```
packages/shared-types/src/assurflow/*.ts            # types partages Assurflow (7.5a.2)
packages/shared-types/src/assurflow/*.spec.ts        # specs des types
packages/database/migrations/*assurflow*.sql         # migrations up/down (7.5a.3)
packages/database/src/repositories/assurflow/*.ts    # repositories tenant-scoped (7.5a.4)
packages/contracts/src/assurflow/*.zod.ts            # contrats Zod (7.5a.5)
packages/events/src/assurflow/*.event.ts             # evenements Kafka + Zod (7.5a.6)
services/assurflow/src/**/*.ts                       # squelette service + guards (7.5a.7)
services/assurflow/src/**/*.spec.ts                  # tests unitaires/integration (7.5a.8)
docs/assurflow/foundation/*.md                       # docs de fondation (sans emoji)
.changeset/*.md                                      # changesets si utilises
pnpm-lock.yaml                                       # lockfile si dependances ajoutees
```

Fichier potentiellement mis a jour HORS depot (a traiter "si present") :

```
CHECKLIST-MASTER-EXECUTION.md   # vit dans l'emplacement de pilotage externe ; absent du repo
```

Aucun de ces fichiers ne doit inclure : `dist/`, `.turbo/`, `coverage/`, `node_modules/`, `*.tsbuildinfo`, `.env`, `.env.*`, fichiers binaires volumineux.

---

## 7. Code patterns complets

> Tous les scripts sont prevus pour etre executes depuis la racine du monorepo. Ils sont idempotents la ou possible et echouent franchement (`set -euo pipefail`) au premier probleme. Aucun emoji.

### 7.a — Portail pre-tag (rejoue tous les controles du sprint)

Fichier : `scripts/sprint-7.5a/pre-tag-gate.sh`

Le portail est le coeur du gate GO/NO-GO. Il boucle sur les packages critiques de la fondation (`auth`, `database`, `shared-types`) pour rejouer, package par package, l'integralite des controles, et avorte au PREMIER echec avec un message explicite indiquant le package fautif et le controle en defaut. Chaque etape est commentee pour clarifier son intention et son mode d'echec.

```bash
#!/usr/bin/env bash
#
# pre-tag-gate.sh
# Portail GO/NO-GO avant la pose du tag de fondation Sprint 7.5a.
# Rejoue l'integralite des controles du sprint, globalement puis par package
# critique (auth, database, shared-types). Sort en erreur au premier echec.
# Aucun emoji (decision-006).
#
set -euo pipefail

# Racine du monorepo: toutes les commandes s'executent depuis ce point.
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

LOG_PREFIX="[pre-tag-gate]"
COVERAGE_GLOBAL_MIN=85          # seuil de couverture global du monorepo
COVERAGE_CRITICAL_MIN=90        # seuil renforce pour les modules sensibles
EXPECTED_TAG="sprint-7.5a-complete-v3-foundation"
COMMIT_SCOPE="sprint-7.5a"
# Packages critiques sur lesquels on rejoue les controles un par un (boucle).
CRITICAL_PACKAGES=("auth" "database" "shared-types")

log()  { printf '%s %s\n' "$LOG_PREFIX" "$*"; }
fail() { printf '%s ECHEC: %s\n' "$LOG_PREFIX" "$*" >&2; exit 1; }
ok()   { printf '%s OK: %s\n' "$LOG_PREFIX" "$*"; }

log "Demarrage du portail pre-tag pour le Sprint 7.5a"
log "Racine du depot: $REPO_ROOT"

# ---------------------------------------------------------------------------
# 0. Pre-requis d'environnement
#    On verifie la presence des outils AVANT tout, pour echouer tot et clair.
# ---------------------------------------------------------------------------
command -v git    >/dev/null 2>&1 || fail "git introuvable"
command -v pnpm   >/dev/null 2>&1 || fail "pnpm introuvable"
command -v node   >/dev/null 2>&1 || fail "node introuvable"

# Node doit etre >= 22 (engine-strict du monorepo). On extrait le major.
NODE_VERSION="$(node -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [ "$NODE_MAJOR" -lt 22 ]; then
  fail "Node >= 22.11.0 requis, trouve $NODE_VERSION"
fi
ok "Outils presents (node $NODE_VERSION)"

# ---------------------------------------------------------------------------
# 1. Etat Git: branche, HEAD non detache
#    Un HEAD detache perdrait le commit; une mauvaise branche fausserait le jalon.
# ---------------------------------------------------------------------------
if ! git symbolic-ref --quiet HEAD >/dev/null 2>&1; then
  fail "HEAD detache. Se placer sur une branche avant de continuer."
fi
CURRENT_BRANCH="$(git symbolic-ref --short HEAD)"
ok "Branche courante: $CURRENT_BRANCH"

case "$CURRENT_BRANCH" in
  main|integration/sprint-7.5a) ok "Branche autorisee pour le tag de fondation" ;;
  *) fail "Branche '$CURRENT_BRANCH' non autorisee pour le jalon. Attendu: main ou integration/sprint-7.5a" ;;
esac

# ---------------------------------------------------------------------------
# 2. Tag pas deja present (sinon stop, ne jamais ecraser un tag de jalon)
#    Verification locale ET remote: un tag deja pousse est intouchable.
# ---------------------------------------------------------------------------
if git tag -l | grep -qx "$EXPECTED_TAG"; then
  fail "Le tag $EXPECTED_TAG existe deja localement. Voir runbook section 12 avant toute action."
fi
if git ls-remote --tags origin "refs/tags/$EXPECTED_TAG" | grep -q "$EXPECTED_TAG"; then
  fail "Le tag $EXPECTED_TAG existe deja sur le remote. NE PAS ecraser."
fi
ok "Le tag $EXPECTED_TAG n'existe pas encore (local et remote)"

# ---------------------------------------------------------------------------
# 3. Aucun artefact de build suivi par Git
#    .gitignore n'agit pas sur les fichiers deja suivis: on detecte l'heritage.
# ---------------------------------------------------------------------------
FORBIDDEN_TRACKED="$(git ls-files | grep -E '(^|/)(dist|\.turbo|coverage|node_modules)(/|$)|\.tsbuildinfo$' || true)"
if [ -n "$FORBIDDEN_TRACKED" ]; then
  printf '%s\n' "$FORBIDDEN_TRACKED" >&2
  fail "Des artefacts de build sont suivis par Git. Les retirer (git rm -r --cached) avant de continuer."
fi
ok "Aucun artefact de build suivi par Git"

# ---------------------------------------------------------------------------
# 4. No-emoji sur l'ensemble du depot suivi (decision-006)
#    On privilegie le script du depot; sinon controle inline de secours.
# ---------------------------------------------------------------------------
if [ -x "scripts/check-no-emoji.sh" ]; then
  log "Execution de check-no-emoji.sh sur les fichiers suivis"
  if ! ./scripts/check-no-emoji.sh; then
    fail "Emoji detecte (decision-006). Aucune exception."
  fi
  ok "Aucun emoji detecte"
else
  log "check-no-emoji.sh absent ou non executable; controle inline de secours"
  # Plages Unicode couvrant emoji, symboles divers, fleches, et le selecteur FE0F.
  EMOJI_HITS="$(git ls-files -z \
    | xargs -0 grep -nP '[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2190}-\x{21FF}\x{2B00}-\x{2BFF}\x{FE0F}]' 2>/dev/null || true)"
  if [ -n "$EMOJI_HITS" ]; then
    printf '%s\n' "$EMOJI_HITS" >&2
    fail "Emoji detecte par le controle de secours (decision-006)."
  fi
  ok "Aucun emoji detecte (controle de secours)"
fi

# ---------------------------------------------------------------------------
# 5. Aucun fichier de format non conforme (biome format --check)
#    Le format est verifie globalement; un fichier mal formate fait echouer la CI.
# ---------------------------------------------------------------------------
if pnpm -w exec biome --version >/dev/null 2>&1; then
  log "Verification du format (biome format --check)"
  pnpm -w exec biome format --check . \
    || fail "Format non conforme (biome). Lancer 'biome format --write .' puis re-stager."
  ok "Format conforme (biome)"
else
  log "biome indisponible globalement, verification de format sautee a ce stade (sera rejouee par package)"
fi

# ---------------------------------------------------------------------------
# 6. Installation deterministe des dependances (frozen lockfile)
#    Reproduit exactement l'environnement de la CI; tout drift de lockfile echoue.
# ---------------------------------------------------------------------------
log "pnpm install --frozen-lockfile"
pnpm install --frozen-lockfile >/dev/null
ok "Dependances installees (lockfile fige)"

# ---------------------------------------------------------------------------
# 7. Controles GLOBAUX sur tout le monorepo
#    Premiere passe large; la seconde passe (boucle) cible les packages critiques.
# ---------------------------------------------------------------------------
log "pnpm -r typecheck"
pnpm -r --if-present typecheck
ok "Typecheck monorepo OK"

log "pnpm -r lint"
pnpm -r --if-present lint
ok "Lint monorepo OK"

log "pnpm -r test (Vitest)"
pnpm -r --if-present test
ok "Tests monorepo OK"

# ---------------------------------------------------------------------------
# 8. Controles PAR PACKAGE critique (boucle, abort au premier echec)
#    Pour chaque package: typecheck, lint, format, vitest run, coverage,
#    no-console, no-staged-artifacts. Message d'echec qui nomme le package.
# ---------------------------------------------------------------------------
for pkg in "${CRITICAL_PACKAGES[@]}"; do
  filter="@insurtech/${pkg}"
  log "=== Controles cibles pour le package ${filter} ==="

  # 8.1 typecheck du package
  pnpm --filter "$filter" --if-present run typecheck \
    || fail "Typecheck en echec pour ${filter}"
  ok "[$pkg] typecheck OK"

  # 8.2 lint du package
  pnpm --filter "$filter" --if-present run lint \
    || fail "Lint en echec pour ${filter}"
  ok "[$pkg] lint OK"

  # 8.3 format check du package (biome) si disponible
  if pnpm --filter "$filter" exec biome --version >/dev/null 2>&1; then
    pnpm --filter "$filter" exec biome format --check . \
      || fail "Format non conforme pour ${filter} (biome format --check)"
    ok "[$pkg] format OK"
  else
    log "[$pkg] biome indisponible, format saute"
  fi

  # 8.4 vitest run (mode non-watch) du package
  pnpm --filter "$filter" --if-present run test -- --run \
    || fail "Vitest en echec pour ${filter}"
  ok "[$pkg] vitest run OK"

  # 8.5 coverage du package + verification du seuil critique
  pnpm --filter "$filter" --if-present run test:coverage -- --run >/dev/null 2>&1 || true
  SUMMARY="packages/${pkg}/coverage/coverage-summary.json"
  if [ -f "$SUMMARY" ]; then
    PCT="$(node -e '
      const s = require(process.argv[1]);
      const t = s.total || {};
      const m = ["lines","statements","functions","branches"]
        .map(k => (t[k] && typeof t[k].pct === "number") ? t[k].pct : 100);
      process.stdout.write(String(Math.min(...m)));
    ' "$SUMMARY")"
    awk -v p="$PCT" -v m="$COVERAGE_CRITICAL_MIN" 'BEGIN { if (p+0 < m+0) exit 1; exit 0 }' \
      || fail "[$pkg] coverage ${PCT}% < ${COVERAGE_CRITICAL_MIN}% requis"
    ok "[$pkg] coverage ${PCT}% (>= ${COVERAGE_CRITICAL_MIN}%)"
  else
    log "[$pkg] pas de resume de couverture ($SUMMARY), seuil non verifie a ce niveau"
  fi

  # 8.6 no-console: aucun console.log dans le code source du package (logger Pino impose)
  CONSOLE_HITS="$(grep -RnE 'console\.(log|debug|info|warn|error)\(' \
    --include='*.ts' --exclude='*.spec.ts' "packages/${pkg}/src" 2>/dev/null || true)"
  if [ -n "$CONSOLE_HITS" ]; then
    printf '%s\n' "$CONSOLE_HITS" >&2
    fail "[$pkg] usage de console.* detecte. Utiliser le logger Pino injecte."
  fi
  ok "[$pkg] aucun console.* dans le source"

  # 8.7 no-emoji cible sur le package (defense en profondeur)
  PKG_EMOJI="$(git ls-files "packages/${pkg}" -z \
    | xargs -0 grep -nP '[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE0F}]' 2>/dev/null || true)"
  if [ -n "$PKG_EMOJI" ]; then
    printf '%s\n' "$PKG_EMOJI" >&2
    fail "[$pkg] emoji detecte (decision-006)."
  fi
  ok "[$pkg] aucun emoji"
done

# ---------------------------------------------------------------------------
# 9. Coverage GLOBALE (seuils 85% global, 90% auth/database/signature)
# ---------------------------------------------------------------------------
log "pnpm -r test:coverage"
pnpm -r --if-present test:coverage
verify_coverage() {
  local summary="$1" min="$2" label="$3"
  [ -f "$summary" ] || { log "Pas de resume de couverture pour $label ($summary), saute"; return 0; }
  local pct
  pct="$(node -e '
    const s = require(process.argv[1]);
    const t = s.total || {};
    const m = ["lines","statements","functions","branches"]
      .map(k => (t[k] && typeof t[k].pct === "number") ? t[k].pct : 100);
    process.stdout.write(String(Math.min(...m)));
  ' "$summary")"
  awk -v p="$pct" -v m="$min" 'BEGIN { if (p+0 < m+0) exit 1; exit 0 }' \
    || fail "Coverage $label = ${pct}% < ${min}% requis ($summary)"
  ok "Coverage $label = ${pct}% (>= ${min}%)"
}
verify_coverage "coverage/coverage-summary.json"                    "$COVERAGE_GLOBAL_MIN"   "global"
verify_coverage "packages/auth/coverage/coverage-summary.json"      "$COVERAGE_CRITICAL_MIN" "auth"
verify_coverage "packages/database/coverage/coverage-summary.json"  "$COVERAGE_CRITICAL_MIN" "database"
verify_coverage "packages/signature/coverage/coverage-summary.json" "$COVERAGE_CRITICAL_MIN" "signature"

# ---------------------------------------------------------------------------
# 10. Migrations up puis down (reversibilite verifiee)
#     up -> down -> up garantit que chaque migration est reellement reversible
#     et que l'etat final est coherent.
# ---------------------------------------------------------------------------
if pnpm --filter @insurtech/database run 2>/dev/null | grep -q 'migrate'; then
  log "Verification de la reversibilite des migrations (up puis down)"
  pnpm --filter @insurtech/database run migrate:up
  ok "Migrations up OK"
  pnpm --filter @insurtech/database run migrate:down
  ok "Migrations down OK"
  pnpm --filter @insurtech/database run migrate:up
  ok "Migrations re-up OK (etat final coherent)"
else
  log "Pas de scripts de migration detectes, saute"
fi

# ---------------------------------------------------------------------------
# 11. Aucun artefact stage par erreur a ce stade (no-staged-artifacts)
#     On verifie l'index courant avant meme le commit.
# ---------------------------------------------------------------------------
STAGED_NOW="$(git diff --cached --name-only | grep -E '(^|/)(dist|\.turbo|coverage|node_modules)(/|$)|\.tsbuildinfo$' || true)"
if [ -n "$STAGED_NOW" ]; then
  printf '%s\n' "$STAGED_NOW" >&2
  fail "Des artefacts de build sont deja stages. Les retirer (git restore --staged) avant le commit."
fi
ok "Aucun artefact de build stage a ce stade"

# ---------------------------------------------------------------------------
# 12. Build (sanity, sans committer les artefacts)
# ---------------------------------------------------------------------------
log "pnpm -r build"
pnpm -r --if-present build
ok "Build OK"

log "PORTAIL PRE-TAG: TOUT VERT. Pose du tag autorisee."
exit 0
```

### 7.b — Staging + commit de fondation (Conventional Commits)

Fichier : `scripts/sprint-7.5a/commit-foundation.sh`

Ce script stage le perimetre du sprint par categories explicites (jamais `git add -A`), refuse tout artefact, secret ou binaire volumineux, puis cree le commit de fondation a partir d'un message multi-lignes exhaustif enumerant chaque livrable de 7.5a.1 a 7.5a.8.

```bash
#!/usr/bin/env bash
#
# commit-foundation.sh
# Stage le set de fondation Sprint 7.5a et cree le commit de fondation conforme
# Conventional Commits. Aucun emoji. N'utilise jamais --no-verify.
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

log()  { printf '[commit-foundation] %s\n' "$*"; }
fail() { printf '[commit-foundation] ECHEC: %s\n' "$*" >&2; exit 1; }

# 1. Garde-fous d'etat: jamais de commit sur HEAD detache ou mauvaise branche.
git symbolic-ref --quiet HEAD >/dev/null 2>&1 || fail "HEAD detache."
BRANCH="$(git symbolic-ref --short HEAD)"
case "$BRANCH" in
  main|integration/sprint-7.5a) : ;;
  *) fail "Branche '$BRANCH' non autorisee." ;;
esac

# 2. Staging cible (eviter git add -A aveugle: on stage par categories du sprint).
#    Chaque chemin correspond a une categorie de livrable de la section 6.
log "Staging des fichiers de fondation Assurflow"
git add -- \
  packages/shared-types/src/assurflow \
  packages/database/migrations \
  packages/database/src/repositories/assurflow \
  packages/contracts/src/assurflow \
  packages/events/src/assurflow \
  services/assurflow/src \
  docs/assurflow/foundation \
  .changeset \
  pnpm-lock.yaml 2>/dev/null || true

# Inclure aussi les fichiers deja suivis et modifies dans le perimetre,
# sans aspirer les nouveaux fichiers non sollicites (git add -u et non -A).
git add -u

# 3. Refus des artefacts de build dans le staged.
STAGED_FORBIDDEN="$(git diff --cached --name-only \
  | grep -E '(^|/)(dist|\.turbo|coverage|node_modules)(/|$)|\.tsbuildinfo$' || true)"
[ -z "$STAGED_FORBIDDEN" ] || { printf '%s\n' "$STAGED_FORBIDDEN" >&2; fail "Artefacts de build stages."; }

# 4. Refus des secrets dans le staged (.env, cles privees, certificats).
STAGED_SECRETS="$(git diff --cached --name-only | grep -E '(^|/)\.env(\.|$)|\.pem$|\.key$' || true)"
[ -z "$STAGED_SECRETS" ] || { printf '%s\n' "$STAGED_SECRETS" >&2; fail "Fichiers sensibles stages."; }

# 5. Detection de binaires volumineux nouvellement stages (> 2 Mo).
#    Un binaire lourd commit gonfle le depot a jamais.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ -f "$f" ] || continue
  size="$(wc -c < "$f" 2>/dev/null || echo 0)"
  if [ "$size" -gt 2097152 ]; then
    fail "Fichier volumineux stage: $f ($size octets). Verifier (Git LFS ?)."
  fi
done < <(git diff --cached --name-only --diff-filter=A)

# 6. Verifier qu'il y a bien quelque chose a committer.
if git diff --cached --quiet; then
  fail "Rien de stage. Le commit de fondation serait vide."
fi

log "Fichiers stages:"
git diff --cached --name-only | sed 's/^/  - /'

# 7. Message de commit (corps exhaustif). Le fichier est lu par git commit -F.
#    Le here-doc avec quotes 'EOF' empeche toute interpolation accidentelle.
COMMIT_MSG_FILE="$(mktemp)"
trap 'rm -f "$COMMIT_MSG_FILE"' EXIT
cat > "$COMMIT_MSG_FILE" <<'EOF'
feat(sprint-7.5a): fondation verticale Assurflow v3.0 (taches 7.5a.1 a 7.5a.8)

Empaquete l'integralite de la fondation Assurflow produite durant le Sprint 7.5a.
Cet etat est valide par le portail pre-tag (typecheck, lint, tests, coverage,
no-emoji, migrations up/down) et sert de baseline d'audit ACAPS/CNDP.

Livrables consolides:
- 7.5a.1: structure de packages et configuration TypeScript stricte Assurflow.
- 7.5a.2: types partages @insurtech/shared-types pour le domaine Assurflow.
- 7.5a.3: migrations de base de donnees (up/down reversibles) tenant-scoped.
- 7.5a.4: repositories tenant-scoped avec RLS app_can_access_tenant().
- 7.5a.5: contrats de validation Zod (z.object/z.infer) du domaine.
- 7.5a.6: evenements Kafka insurtech.events.assurflow.* avec schemas Zod.
- 7.5a.7: squelette de service avec TenantGuard, RolesGuard, AsyncLocalStorage.
- 7.5a.8: tests Vitest unitaires et integration, coverage >=85% (>=90% critique).

Conformite:
- Multi-tenant strict (x-tenant-id, TenantGuard, RLS, audit trail).
- Validation Zod uniquement; logger Pino structure; argon2id.
- decision-006 respectee: aucune emoji.
- decision-008 respectee: cloud souverain MA, donnees d'assure non sorties du MA.

Refs: B-7.5a tache 7.5a.9; decisions 006, 008, 011-015.
EOF

# 8. Commit (les hooks husky + commitlint s'executent; ne pas les contourner).
log "Creation du commit de fondation (hooks actifs)"
git commit -F "$COMMIT_MSG_FILE"

log "Commit cree: $(git log -1 --pretty=%H)"
log "Sujet: $(git log -1 --pretty=%s)"

# 9. Arbre propre attendu apres commit.
if [ -n "$(git status --porcelain)" ]; then
  log "ATTENTION: arbre non vide apres commit. Verifier les fichiers restants:"
  git status --porcelain | sed 's/^/  /'
fi

log "Commit de fondation termine."
```

### 7.c — Creation du tag annote (avec message riche)

Fichier : `scripts/sprint-7.5a/create-tag.sh`

```bash
#!/usr/bin/env bash
#
# create-tag.sh
# Cree le tag annote de fondation Sprint 7.5a. Optionnellement signe (SIGN_TAG=1).
# Aucun emoji.
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TAG="sprint-7.5a-complete-v3-foundation"
SIGN_TAG="${SIGN_TAG:-0}"   # mettre a 1 si la politique exige un tag signe

log()  { printf '[create-tag] %s\n' "$*"; }
fail() { printf '[create-tag] ECHEC: %s\n' "$*" >&2; exit 1; }

# 1. Le tag ne doit pas deja exister localement (pas d'ecrasement de jalon).
if git tag -l | grep -qx "$TAG"; then
  fail "Le tag $TAG existe deja localement. Voir runbook section 12."
fi

# 2. Le tag doit pointer vers le commit de fondation courant.
#    On verifie que HEAD est bien le commit de fondation attendu.
HEAD_SUBJECT="$(git log -1 --pretty=%s)"
case "$HEAD_SUBJECT" in
  "feat(sprint-7.5a):"*) : ;;
  *) fail "HEAD ne pointe pas vers le commit de fondation attendu. Sujet actuel: $HEAD_SUBJECT" ;;
esac

# 3. Message du tag (riche, multi-paragraphes, auditable).
TAG_MSG_FILE="$(mktemp)"
trap 'rm -f "$TAG_MSG_FILE"' EXIT
cat > "$TAG_MSG_FILE" <<'EOF'
Jalon GO: fondation verticale Assurflow v3.0 complete.

Ce tag marque la cloture du Sprint 7.5a (taches 7.5a.1 a 7.5a.8) et autorise
le demarrage des travaux aval (Sprint 7 tache 2.3.2).

Perimetre valide par le portail pre-tag:
- typecheck monorepo, lint, tests Vitest unit + integration.
- coverage globale >= 85%, modules critiques (auth/database/signature) >= 90%.
- check-no-emoji (decision-006) sans aucune occurrence.
- migrations base de donnees up/down reversibles verifiees.
- build complet du monorepo.

Baseline d'audit:
- Conformite ACAPS/CNDP: cet etat sert de reference d'audit traceable.
- Cloud souverain MA (decision-008): aucune donnee d'assure hors du Maroc.

Refs: B-7.5a tache 7.5a.9; decisions 006, 008, 011-015.
EOF

# 4. Creation (annote ou signe selon SIGN_TAG).
if [ "$SIGN_TAG" = "1" ]; then
  log "Creation du tag SIGNE $TAG"
  git tag -s "$TAG" -F "$TAG_MSG_FILE"
else
  log "Creation du tag ANNOTE $TAG"
  git tag -a "$TAG" -F "$TAG_MSG_FILE"
fi

# 5. Verifications immediates: type d'objet, cible, signature (si demandee).
[ "$(git cat-file -t "$TAG")" = "tag" ] || fail "Le tag $TAG n'est pas annote."
log "Type d'objet du tag: $(git cat-file -t "$TAG") (attendu: tag)"
log "Le tag pointe vers: $(git rev-list -n1 "$TAG")"
log "HEAD est:           $(git rev-parse HEAD)"
[ "$(git rev-list -n1 "$TAG")" = "$(git rev-parse HEAD)" ] || fail "Le tag ne pointe pas vers HEAD."

if [ "$SIGN_TAG" = "1" ]; then
  git tag -v "$TAG" || fail "Verification de signature du tag echouee."
  log "Signature du tag verifiee."
fi

log "Tag annote cree avec succes: $TAG"
git tag -n99 -l "$TAG"
```

### 7.c.bis — Variante de tag signe GPG (procedure dediee)

Quand la politique du depot impose une signature, la cle doit etre configuree au prealable et la creation du tag passe par `SIGN_TAG=1`. La procedure complete, de la configuration de la cle a la verification de la signature, est la suivante.

```bash
#!/usr/bin/env bash
#
# create-tag-signed.sh
# Variante explicite du tag SIGNE GPG/SSH pour le jalon Sprint 7.5a.
# Echoue franchement si aucune cle de signature n'est configuree.
# Aucun emoji.
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TAG="sprint-7.5a-complete-v3-foundation"

log()  { printf '[create-tag-signed] %s\n' "$*"; }
fail() { printf '[create-tag-signed] ECHEC: %s\n' "$*" >&2; exit 1; }

# 1. Verifier qu'une cle de signature est configuree.
SIGNING_KEY="$(git config --get user.signingkey || true)"
[ -n "$SIGNING_KEY" ] || fail "Aucune cle de signature (git config user.signingkey absente)."
log "Cle de signature configuree: $SIGNING_KEY"

# 2. Determiner le format de signature (gpg par defaut, ssh possible).
SIGN_FORMAT="$(git config --get gpg.format || echo gpg)"
log "Format de signature: $SIGN_FORMAT"

# 3. Le tag ne doit pas deja exister.
git tag -l | grep -qx "$TAG" && fail "Le tag $TAG existe deja localement."

# 4. Le message du tag (identique a la variante annotee).
TAG_MSG_FILE="$(mktemp)"
trap 'rm -f "$TAG_MSG_FILE"' EXIT
cat > "$TAG_MSG_FILE" <<'EOF'
Jalon GO (signe): fondation verticale Assurflow v3.0 complete.

Tag signe cryptographiquement pour non-repudiation du jalon de fondation.
Perimetre valide par le portail pre-tag (typecheck, lint, tests, coverage,
no-emoji, migrations up/down, build). Baseline d'audit ACAPS/CNDP.

Refs: B-7.5a tache 7.5a.9; decisions 006, 008, 011-015.
EOF

# 5. Creation du tag signe.
log "Creation du tag SIGNE $TAG"
git tag -s "$TAG" -F "$TAG_MSG_FILE"

# 6. Verification de la signature: doit afficher une bonne signature.
log "Verification de la signature du tag"
git tag -v "$TAG" || fail "La verification de la signature du tag a echoue."

log "Tag signe cree et verifie: $TAG"
```

### 7.d — Push de la branche puis du tag

Fichier : `scripts/sprint-7.5a/push-foundation.sh`

```bash
#!/usr/bin/env bash
#
# push-foundation.sh
# Pousse d'abord la branche (declenche la CI), puis, apres CI verte, le tag.
# Ne force JAMAIS un push sur main. Verifie l'upstream et propose un dry-run.
# Aucun emoji.
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TAG="sprint-7.5a-complete-v3-foundation"
REMOTE="${REMOTE:-origin}"
PUSH_TAG_NOW="${PUSH_TAG_NOW:-0}"  # 0 = pousser le tag uniquement apres CI verte
DRY_RUN="${DRY_RUN:-0}"            # 1 = simuler les pushes sans rien envoyer

log()  { printf '[push-foundation] %s\n' "$*"; }
fail() { printf '[push-foundation] ECHEC: %s\n' "$*" >&2; exit 1; }

BRANCH="$(git symbolic-ref --short HEAD)"
log "Branche: $BRANCH  Remote: $REMOTE  DRY_RUN=$DRY_RUN"

# 1. Synchronisation prudente: connaitre l'etat distant avant de pousser.
log "git fetch $REMOTE"
git fetch "$REMOTE"

# 2. Verifier que l'upstream est configure (sinon -u au premier push).
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")"
if [ -z "$UPSTREAM" ]; then
  log "Aucun upstream configure pour $BRANCH. Le push utilisera -u $REMOTE $BRANCH."
fi

# 3. Detection non-fast-forward (le remote a-t-il avance ?).
if [ -n "$UPSTREAM" ]; then
  BEHIND="$(git rev-list --count HEAD.."$UPSTREAM")"
  if [ "$BEHIND" -gt 0 ]; then
    fail "La branche est en retard de $BEHIND commit(s) sur $UPSTREAM. Faire un rebase puis rejouer le portail. NE PAS forcer."
  fi
fi

# 4. Dry-run de securite si demande.
if [ "$DRY_RUN" = "1" ]; then
  log "DRY-RUN du push de branche:"
  git push --dry-run "$REMOTE" "$BRANCH"
  if [ "$PUSH_TAG_NOW" = "1" ]; then
    log "DRY-RUN du push de tag:"
    git push --dry-run "$REMOTE" "$TAG"
  fi
  log "DRY-RUN termine. Aucun objet envoye."
  exit 0
fi

# 5. Push de la branche (jamais --force sur main).
log "Push de la branche $BRANCH"
if [ -z "$UPSTREAM" ]; then
  git push -u "$REMOTE" "$BRANCH"
else
  git push "$REMOTE" "$BRANCH"
fi
log "Branche poussee. La CI doit maintenant passer au vert sur $(git rev-parse HEAD)."

# 6. Push du tag (seulement si autorise, idealement apres CI verte).
if [ "$PUSH_TAG_NOW" = "1" ]; then
  log "Push du tag $TAG"
  git push "$REMOTE" "$TAG"
  log "Tag pousse. Verifier la presence remote:"
  git ls-remote --tags "$REMOTE" "refs/tags/$TAG"
else
  log "Tag NON pousse (PUSH_TAG_NOW != 1)."
  log "Attendre la CI verte sur le commit, puis: git push $REMOTE $TAG"
fi
```

### 7.e — Runbook de rollback / revert

Fichier : `scripts/sprint-7.5a/rollback.sh`

Le runbook couvre tous les scenarios de retour arriere : revert du commit (sur, post-push), suppression du tag local et remote, reset local (uniquement avant push). Il documente explicitement les precautions `--force-with-lease` et l'ordre canonique d'un rollback complet.

```bash
#!/usr/bin/env bash
#
# rollback.sh
# Runbook de retour arriere pour le jalon Sprint 7.5a.
# Scenarios: revert du commit de fondation, suppression du tag (local + remote),
# reset dur local (avant push uniquement). Aucun emoji.
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TAG="sprint-7.5a-complete-v3-foundation"
REMOTE="${REMOTE:-origin}"
ACTION="${1:-help}"

log()  { printf '[rollback] %s\n' "$*"; }
fail() { printf '[rollback] ECHEC: %s\n' "$*" >&2; exit 1; }

case "$ACTION" in
  revert-commit)
    # Annule proprement le commit de fondation par un nouveau commit inverse.
    # A privilegier si le commit est deja pousse et partage: ne reecrit pas l'historique.
    log "Revert du commit de fondation (cree un commit d'annulation)"
    git revert --no-edit HEAD
    log "Revert cree. Pousser ensuite: git push $REMOTE $(git symbolic-ref --short HEAD)"
    ;;

  delete-tag-local)
    # Supprime uniquement la ref locale du tag. Sans danger.
    if git tag -l | grep -qx "$TAG"; then
      git tag -d "$TAG"
      log "Tag local $TAG supprime."
    else
      log "Tag local $TAG absent, rien a faire."
    fi
    ;;

  delete-tag-remote)
    # ATTENTION: ne supprimer un tag remote que s'il n'a PAS encore ete consomme
    # par des outils aval ou d'autres developpeurs. Operation sensible.
    log "Suppression du tag remote $TAG (operation sensible)"
    git push "$REMOTE" ":refs/tags/$TAG" || log "Le tag remote etait peut-etre deja absent."
    log "Tag remote supprime."
    ;;

  reset-local)
    # UNIQUEMENT si le commit n'a PAS ete pousse. Detruit les commits locaux non pousses.
    UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")"
    if [ -n "$UPSTREAM" ]; then
      AHEAD="$(git rev-list --count "$UPSTREAM"..HEAD)"
      [ "$AHEAD" -gt 0 ] || fail "Aucun commit local en avance; rien a reset."
      log "Reset dur de HEAD~1 (suppression du dernier commit local non pousse)"
      git reset --hard HEAD~1
      log "Reset effectue."
    else
      fail "Pas d'upstream connu; verifier manuellement avant tout reset --hard."
    fi
    ;;

  force-with-lease-note)
    # Note pedagogique: --force-with-lease n'est tolere que sur une branche
    # de feature personnelle JAMAIS partagee, et jamais sur main. Il refuse
    # d'ecraser si le remote a avance depuis le dernier fetch (protection).
    cat <<'NOTE'
RAPPEL --force-with-lease:
  - INTERDIT sur main et integration/sprint-7.5a (branches partagees protegees).
  - Tolere uniquement sur une branche de feature personnelle non partagee.
  - Plus sur que --force: refuse si le remote a avance depuis le dernier fetch.
  - Pour un jalon deja pousse, preferer TOUJOURS revert-commit (non destructif).
NOTE
    ;;

  help|*)
    cat <<'USAGE'
Usage: rollback.sh <action>
  revert-commit       Cree un commit inverse du commit de fondation (sur, post-push).
  delete-tag-local    Supprime le tag local sprint-7.5a-complete-v3-foundation.
  delete-tag-remote   Supprime le tag distant (sensible: seulement si non consomme).
  reset-local         Reset --hard HEAD~1 (UNIQUEMENT si non pousse).
  force-with-lease-note  Affiche les precautions sur --force-with-lease.
Ordre type de rollback complet d'un jalon pousse non encore consomme:
  1) delete-tag-remote
  2) delete-tag-local
  3) revert-commit  (puis push de la branche)
USAGE
    ;;
esac
```

### 7.f — Helper de mise a jour de la checklist (no-op si absente)

Fichier : `scripts/sprint-7.5a/update-checklist.sh`

```bash
#!/usr/bin/env bash
#
# update-checklist.sh
# Met a jour CHECKLIST-MASTER-EXECUTION.md SI le fichier est present.
# No-op propre (exit 0) si le fichier est absent (il vit hors du depot).
# Idempotent: append-if-absent (ne duplique jamais la ligne de jalon).
# Aucun emoji.
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Recherche du fichier de checklist a la racine puis dans le repo, sans descendre
# dans node_modules. On accepte aussi un chemin explicite via CHECKLIST_PATH.
CHECKLIST_PATH="${CHECKLIST_PATH:-}"
if [ -z "$CHECKLIST_PATH" ]; then
  if [ -f "CHECKLIST-MASTER-EXECUTION.md" ]; then
    CHECKLIST_PATH="CHECKLIST-MASTER-EXECUTION.md"
  else
    CHECKLIST_PATH="$(git ls-files | grep -E '(^|/)CHECKLIST-MASTER-EXECUTION\.md$' | head -n1 || true)"
  fi
fi

log() { printf '[update-checklist] %s\n' "$*"; }

# No-op propre si absent: la tache NE DOIT PAS echouer (le fichier vit hors depot).
if [ -z "$CHECKLIST_PATH" ] || [ ! -f "$CHECKLIST_PATH" ]; then
  log "CHECKLIST-MASTER-EXECUTION.md absent du depot. No-op (le fichier vit dans le pilotage externe)."
  exit 0
fi

log "Checklist trouvee: $CHECKLIST_PATH"
TODAY="$(date -u +%Y-%m-%d)"
TAG="sprint-7.5a-complete-v3-foundation"
COMMIT="$(git rev-parse --short HEAD)"
LINE="- [x] Sprint 7.5a fondation Assurflow v3.0 scellee le ${TODAY} (tag ${TAG}, commit ${COMMIT})"

# Idempotence: ne pas dupliquer la ligne (append-if-absent).
if grep -qF "tag ${TAG}" "$CHECKLIST_PATH"; then
  log "Entree deja presente dans la checklist, no-op."
  exit 0
fi

printf '%s\n' "$LINE" >> "$CHECKLIST_PATH"
log "Ligne de jalon ajoutee a la checklist."
log "Penser a stager/committer la checklist si elle fait partie du depot."
```

### 7.g — CI complete (GitHub Actions) + verification CI

Le workflow CI rejoue exactement la sequence du portail local. Il s'execute sur les pushes de `main` et des branches d'integration, et sur les tags `sprint-*`. Le fichier dedie au jalon est `.github/workflows/sprint-7-5a.yml`.

Fichier : `.github/workflows/sprint-7-5a.yml`

```yaml
name: sprint-7.5a-foundation-gate
# Ce workflow rejoue le MEME gate que le portail local pre-tag-gate.sh.
# Il garantit que le commit de fondation et le tag pointent vers un etat vert.
on:
  push:
    branches:
      - main
      - "integration/sprint-7.5a"
    tags:
      - "sprint-7.5a-*"
  pull_request:
    branches:
      - main
      - "integration/sprint-7.5a"

# Permissions minimales (principe du moindre privilege).
permissions:
  contents: read

# Annule les runs obsoletes sur la meme ref pour economiser les minutes.
concurrency:
  group: sprint-7-5a-${{ github.ref }}
  cancel-in-progress: true

jobs:
  gate:
    name: pre-tag gate (typecheck/lint/format/test/coverage/no-emoji/build)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - name: Checkout (historique complet pour merge-base et tags)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup pnpm
        uses: pnpm/action-setup@v4

      - name: Setup Node 22.11.0
        uses: actions/setup-node@v4
        with:
          node-version: "22.11.0"
          cache: pnpm

      - name: Install (frozen lockfile)
        run: pnpm install --frozen-lockfile

      - name: No-emoji (decision-006)
        run: ./scripts/check-no-emoji.sh

      - name: Format check (biome)
        run: pnpm -w exec biome format --check .

      - name: Typecheck (monorepo)
        run: pnpm -r --if-present typecheck

      - name: Lint (monorepo)
        run: pnpm -r --if-present lint

      - name: Tests + coverage
        run: pnpm -r --if-present test:coverage

      - name: Verifier les seuils de couverture (global 85 / critique 90)
        run: |
          node - <<'NODE'
          const fs = require('fs');
          const checks = [
            ['coverage/coverage-summary.json', 85, 'global'],
            ['packages/auth/coverage/coverage-summary.json', 90, 'auth'],
            ['packages/database/coverage/coverage-summary.json', 90, 'database'],
            ['packages/signature/coverage/coverage-summary.json', 90, 'signature'],
          ];
          let failed = false;
          for (const [file, min, label] of checks) {
            if (!fs.existsSync(file)) { console.log('skip ' + label + ' (' + file + ')'); continue; }
            const t = (JSON.parse(fs.readFileSync(file, 'utf8')).total) || {};
            const pct = Math.min(...['lines','statements','functions','branches']
              .map(k => (t[k] && typeof t[k].pct === 'number') ? t[k].pct : 100));
            if (pct < min) { console.error('FAIL ' + label + ' ' + pct + '% < ' + min + '%'); failed = true; }
            else { console.log('OK ' + label + ' ' + pct + '% >= ' + min + '%'); }
          }
          process.exit(failed ? 1 : 0);
          NODE

      - name: Migrations up/down/up (reversibilite)
        run: |
          if pnpm --filter @insurtech/database run 2>/dev/null | grep -q 'migrate'; then
            pnpm --filter @insurtech/database run migrate:up
            pnpm --filter @insurtech/database run migrate:down
            pnpm --filter @insurtech/database run migrate:up
          else
            echo "Pas de scripts de migration, etape sautee."
          fi

      - name: Build (monorepo)
        run: pnpm -r --if-present build
```

Helper local `scripts/sprint-7.5a/verify-ci.sh` :

```bash
#!/usr/bin/env bash
#
# verify-ci.sh
# Verifie que la CI est verte sur le commit COURANT (par SHA exact) avant de
# pousser le tag. Requiert gh (GitHub CLI) authentifie. Aucun emoji.
#
set -euo pipefail

command -v gh >/dev/null 2>&1 || { echo "[verify-ci] gh introuvable; verifier la CI manuellement." >&2; exit 2; }

# On verifie par SHA exact (pas par "dernier run") pour eviter le piege 3.8.15.
SHA="$(git rev-parse HEAD)"
echo "[verify-ci] Verification de la CI pour le commit $SHA"

# Attente active de la conclusion du dernier run sur ce SHA (jusqu'a 30 min).
for i in $(seq 1 60); do
  STATUS="$(gh run list --commit "$SHA" --limit 1 --json status,conclusion --jq '.[0] | "\(.status) \(.conclusion)"' 2>/dev/null || echo "unknown unknown")"
  echo "[verify-ci] tentative $i: $STATUS"
  case "$STATUS" in
    "completed success") echo "[verify-ci] CI verte. Push du tag autorise."; exit 0 ;;
    "completed "*)        echo "[verify-ci] CI non verte: $STATUS. NE PAS pousser le tag." >&2; exit 1 ;;
    *)                    sleep 30 ;;
  esac
done

echo "[verify-ci] Timeout d'attente de la CI. Verifier manuellement." >&2
exit 3
```

### 7.h — Orchestrateur de bout en bout

Fichier : `scripts/sprint-7.5a/seal-foundation.sh`

```bash
#!/usr/bin/env bash
#
# seal-foundation.sh
# Orchestre la sequence complete: portail -> commit -> push branche -> CI -> tag -> push tag -> checklist.
# Aucun emoji. S'arrete au premier echec.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[seal] 1/6 Portail pre-tag"
bash "$HERE/pre-tag-gate.sh"

echo "[seal] 2/6 Commit de fondation"
bash "$HERE/commit-foundation.sh"

echo "[seal] 3/6 Push de la branche"
bash "$HERE/push-foundation.sh"

echo "[seal] 4/6 Verification CI (best effort)"
if bash "$HERE/verify-ci.sh"; then
  CI_OK=1
else
  echo "[seal] CI non confirmee verte. Le tag ne sera pas pousse automatiquement."
  CI_OK=0
fi

echo "[seal] 5/6 Creation du tag annote"
bash "$HERE/create-tag.sh"

if [ "$CI_OK" = "1" ]; then
  echo "[seal] 6/6 Push du tag"
  PUSH_TAG_NOW=1 bash "$HERE/push-foundation.sh"
else
  echo "[seal] 6/6 Tag NON pousse (CI non verte). Pousser manuellement apres CI verte."
fi

echo "[seal] Mise a jour de la checklist (si presente)"
bash "$HERE/update-checklist.sh"

echo "[seal] Sequence terminee."
```

---

## 8. Tests complets (validation que le commit/tag sont bien formes)

Fichier : `scripts/sprint-7.5a/assert-foundation.sh`. Chaque assertion affiche le resultat attendu. Exit 0 = tout valide.

```bash
#!/usr/bin/env bash
#
# assert-foundation.sh
# Bloc d'assertions verifiant que le commit de fondation et le tag sont bien formes.
# Aucun emoji.
#
set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

TAG="sprint-7.5a-complete-v3-foundation"
CONV_REGEX='^(feat|fix|chore|docs|refactor|test|build|ci|perf|style|revert)(\([a-z0-9._/-]+\))?: .+'
FAILS=0

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf 'PASS  %s (= %s)\n' "$desc" "$actual"
  else
    printf 'FAIL  %s (attendu: %s, obtenu: %s)\n' "$desc" "$expected" "$actual"
    FAILS=$((FAILS+1))
  fi
}
check_nonempty() {
  local desc="$1" actual="$2"
  if [ -n "$actual" ]; then printf 'PASS  %s (non vide)\n' "$desc"
  else printf 'FAIL  %s (vide)\n' "$desc"; FAILS=$((FAILS+1)); fi
}
check_match() {
  local desc="$1" re="$2" actual="$3"
  if printf '%s' "$actual" | grep -Eq "$re"; then printf 'PASS  %s\n' "$desc"
  else printf 'FAIL  %s (ne matche pas %s): %s\n' "$desc" "$re" "$actual"; FAILS=$((FAILS+1)); fi
}

# T1. Le tag existe localement
check "T1 tag present" "1" "$(git tag -l | grep -cx "$TAG")"

# T2. Le tag est un objet annote (et non un commit)
check "T2 tag annote" "tag" "$(git cat-file -t "$TAG" 2>/dev/null || echo none)"

# T3. Le tag pointe vers HEAD
check "T3 tag -> HEAD" "$(git rev-parse HEAD)" "$(git rev-list -n1 "$TAG" 2>/dev/null || echo none)"

# T4. Sujet du commit conforme Conventional Commits
check_match "T4 sujet conforme" "$CONV_REGEX" "$(git log -1 --pretty=%s)"

# T5. Sujet du commit avec le bon scope
check_match "T5 scope sprint-7.5a" '^feat\(sprint-7\.5a\): ' "$(git log -1 --pretty=%s)"

# T6. Corps du commit non vide
check_nonempty "T6 corps de commit" "$(git log -1 --pretty=%b)"

# T7. Corps mentionne les taches 7.5a.1 a 7.5a.8
check_match "T7a corps mentionne 7.5a.1" '7\.5a\.1' "$(git log -1 --pretty=%b)"
check_match "T7b corps mentionne 7.5a.8" '7\.5a\.8' "$(git log -1 --pretty=%b)"

# T8. Message du tag non vide
check_nonempty "T8 message du tag" "$(git tag -n99 -l "$TAG" | sed "s/^$TAG//")"

# T9. Message du tag mentionne le jalon GO
check_match "T9 tag mentionne GO" 'Jalon GO' "$(git for-each-ref --format='%(contents)' "refs/tags/$TAG")"

# T10. Arbre de travail propre
check "T10 arbre propre" "" "$(git status --porcelain)"

# T11. Aucun artefact de build dans le commit
ARTIFACTS="$(git show --name-only --pretty=format: HEAD | grep -E '(^|/)(dist|\.turbo|coverage|node_modules)(/|$)|\.tsbuildinfo$' || true)"
check "T11 pas d'artefacts dans le commit" "" "$ARTIFACTS"

# T12. Aucun secret dans le commit
SECRETS="$(git show --name-only --pretty=format: HEAD | grep -E '(^|/)\.env(\.|$)|\.pem$|\.key$' || true)"
check "T12 pas de secret dans le commit" "" "$SECRETS"

# T13. Aucun emoji dans le diff du commit
EMOJI="$(git show HEAD | grep -nP '[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE0F}]' || true)"
check "T13 pas d'emoji dans le commit" "" "$EMOJI"

# T14. HEAD non detache
check_nonempty "T14 HEAD attache a une branche" "$(git symbolic-ref --short HEAD 2>/dev/null || echo '')"

# T15. Branche autorisee
check_match "T15 branche autorisee" '^(main|integration/sprint-7\.5a)$' "$(git symbolic-ref --short HEAD)"

# T16. Le tag n'existe qu'une fois
check "T16 tag unique" "1" "$(git tag -l "$TAG" | wc -l | tr -d ' ')"

# T17. Le commit a un seul parent (pas un merge inattendu)
check "T17 commit non merge" "1" "$(git rev-list --parents -n1 HEAD | wc -w | awk '{print $1-1}')"

# T18. Auteur du commit renseigne
check_nonempty "T18 auteur commit" "$(git log -1 --pretty=%an)"

# T19. Le commit est descendant du HEAD de depart e98acca (si present)
if git cat-file -e e98acca^{commit} 2>/dev/null; then
  if git merge-base --is-ancestor e98acca HEAD; then echo "PASS  T19 descend de e98acca"
  else echo "FAIL  T19 ne descend pas de e98acca"; FAILS=$((FAILS+1)); fi
else
  echo "SKIP  T19 e98acca introuvable dans ce clone"
fi

# T20. Le tag est pousse sur le remote (si remote accessible)
if git ls-remote --tags origin "refs/tags/$TAG" 2>/dev/null | grep -q "$TAG"; then
  echo "PASS  T20 tag present sur origin"
else
  echo "WARN  T20 tag non present sur origin (pousser apres CI verte)"
fi

# T21. Convention de nommage du tag respectee
check_match "T21 nommage tag" '^sprint-7\.5a-complete-v3-foundation$' "$TAG"

# T22. Le sujet ne depasse pas 100 caracteres (bonne pratique)
SUBLEN="$(git log -1 --pretty=%s | wc -c | tr -d ' ')"
if [ "$SUBLEN" -le 101 ]; then echo "PASS  T22 longueur sujet $((SUBLEN-1)) <= 100"
else echo "FAIL  T22 sujet trop long ($((SUBLEN-1)))"; FAILS=$((FAILS+1)); fi

# T23. Refs decisions presentes dans le message
check_match "T23 refs decisions" 'decisions 006' "$(git log -1 --pretty=%B)"

# T24. Tagger renseigne (objet tag annote)
check_nonempty "T24 tagger present" "$(git for-each-ref --format='%(taggername)' "refs/tags/$TAG")"

# T25. Aucun artefact de build suivi par Git (etat global du depot)
TRACKED_ART="$(git ls-files | grep -E '(^|/)(dist|\.turbo|coverage|node_modules)(/|$)|\.tsbuildinfo$' || true)"
check "T25 aucun artefact suivi" "" "$TRACKED_ART"

# T26. Aucun console.* dans le source des packages critiques (logger Pino impose)
CONSOLE_ALL="$(grep -RnE 'console\.(log|debug|info|warn|error)\(' \
  --include='*.ts' --exclude='*.spec.ts' packages/auth/src packages/database/src 2>/dev/null || true)"
check "T26 aucun console dans auth/database" "" "$CONSOLE_ALL"

echo "----------------------------------------------------------------"
if [ "$FAILS" -eq 0 ]; then
  echo "RESULTAT: TOUTES LES ASSERTIONS PASSENT."
  exit 0
else
  echo "RESULTAT: $FAILS assertion(s) en echec."
  exit 1
fi
```

Cas de verification supplementaires (manuels, attendus) :

| Cas | Commande | Sortie attendue |
|---|---|---|
| C1 | `git tag -l sprint-7.5a-complete-v3-foundation` | la chaine du tag |
| C2 | `git cat-file -t sprint-7.5a-complete-v3-foundation` | `tag` |
| C3 | `git log -1 --pretty=%s` | `feat(sprint-7.5a): fondation verticale Assurflow v3.0 ...` |
| C4 | `git status --porcelain` | (vide) |
| C5 | `git rev-list -n1 <tag>` == `git rev-parse HEAD` | egal |
| C6 | `git tag -n99 -l <tag>` | message multi-lignes |
| C7 | `git for-each-ref --format='%(taggername)' refs/tags/<tag>` | nom du tagger non vide |
| C8 | `git verify-tag <tag>` (si signe) | Good signature |

---

## 9. Variables d'environnement

| Variable | Role | Valeur / regle |
|---|---|---|
| `GIT_AUTHOR_NAME` | Auteur du commit | nom reel du committeur ; non vide |
| `GIT_AUTHOR_EMAIL` | Email auteur | email d'equipe valide |
| `GIT_COMMITTER_NAME` | Committeur | identique a l'auteur sauf cas CI |
| `GIT_COMMITTER_EMAIL` | Email committeur | idem |
| `REMOTE` | Remote cible | defaut `origin` |
| `SIGN_TAG` | Tag signe | `1` si politique de signature, sinon `0` |
| `PUSH_TAG_NOW` | Pousser le tag immediatement | `0` par defaut (pousser apres CI verte) |
| `DRY_RUN` | Simuler les pushes | `0` par defaut ; `1` pour `--dry-run` |
| `CHECKLIST_PATH` | Chemin explicite de la checklist | optionnel ; vide => recherche auto |
| `GITHUB_TOKEN` / `GH_TOKEN` | Auth CI / gh | NE JAMAIS coder en dur ; fourni par l'environnement |
| `PASSWORD_PEPPER` | Secret applicatif | NE JAMAIS committer ; hors scope ici |

Regle absolue : aucun token, aucun secret n'est ecrit dans un fichier commite, ni passe en clair dans l'historique. Les tokens CI proviennent de l'environnement (secrets GitHub Actions ou session `gh auth`).

---

## 10. Commandes shell (sequence ordonnee)

```bash
# Depuis la racine du monorepo
cd "$(git rev-parse --show-toplevel)"

# 0. Verifier l'etat de depart
git symbolic-ref --short HEAD          # branche (main ou integration/sprint-7.5a)
git status --porcelain                 # voir ce qui est modifie
git log --oneline -5                   # confirmer le contexte (e98acca, 25ffe86, ...)

# 1. Portail pre-tag (rejoue tous les controles)
bash scripts/sprint-7.5a/pre-tag-gate.sh

# 2. Commit de fondation
bash scripts/sprint-7.5a/commit-foundation.sh

# 3. Push de la branche (declenche la CI)
bash scripts/sprint-7.5a/push-foundation.sh

# 4. Attendre la CI verte
bash scripts/sprint-7.5a/verify-ci.sh   # ou verification manuelle dans l'UI CI

# 5. Creer le tag annote (apres CI verte)
bash scripts/sprint-7.5a/create-tag.sh
# Variante signee: SIGN_TAG=1 bash scripts/sprint-7.5a/create-tag.sh

# 6. Pousser le tag
PUSH_TAG_NOW=1 bash scripts/sprint-7.5a/push-foundation.sh
# ou directement: git push origin sprint-7.5a-complete-v3-foundation

# 7. Mettre a jour la checklist si presente
bash scripts/sprint-7.5a/update-checklist.sh

# 8. Asserter le resultat
bash scripts/sprint-7.5a/assert-foundation.sh

# Tout-en-un (optionnel)
bash scripts/sprint-7.5a/seal-foundation.sh
```

---

## 11. Criteres de validation V1-V31

> Format : critere | commande | attendu | mode d'echec.

### Criteres P0 (bloquants, >= 15)

**V1 (P0) — Branche autorisee.**
Commande : `git symbolic-ref --short HEAD`.
Attendu : `main` ou `integration/sprint-7.5a`.
Mode d'echec : tag pose sur une mauvaise branche (feature ephemere), jalon dans un contexte d'historique confus apres suppression de la branche.

**V2 (P0) — HEAD non detache.**
Commande : `git symbolic-ref --quiet HEAD; echo $?`.
Attendu : exit `0`.
Mode d'echec : commit pose sur un HEAD detache, perdu au prochain `git switch`, jalon introuvable.

**V3 (P0) — Portail pre-tag vert.**
Commande : `bash scripts/sprint-7.5a/pre-tag-gate.sh; echo $?`.
Attendu : `0`.
Mode d'echec : un controle (typecheck/lint/test/coverage/no-emoji/migration) echoue, etat instable tague, aval debloque sur base cassee.

**V4 (P0) — Typecheck OK.**
Commande : `pnpm -r --if-present typecheck; echo $?`.
Attendu : exit `0`.
Mode d'echec : types casses dans un package, rupture des contrats partages consommes par l'aval.

**V5 (P0) — Lint OK.**
Commande : `pnpm -r --if-present lint; echo $?`.
Attendu : exit `0`.
Mode d'echec : regles de style/qualite violees, CI rouge, refus de merge.

**V6 (P0) — Tests OK.**
Commande : `pnpm -r --if-present test; echo $?`.
Attendu : exit `0`.
Mode d'echec : regression non detectee figee dans le jalon, contrats valides a tort.

**V7 (P0) — Coverage globale >= 85%.**
Commande : `pnpm -r test:coverage` puis verification du resume `coverage/coverage-summary.json`.
Attendu : couverture minimale (lignes/statements/fonctions/branches) >= 85.
Mode d'echec : couverture insuffisante, chemins non testes embarques dans la baseline.

**V8 (P0) — Coverage critique >= 90%.**
Commande : verification des resumes `packages/{auth,database,signature}/coverage/coverage-summary.json`.
Attendu : >= 90 pour chaque module sensible.
Mode d'echec : modules de securite (auth/database/signature) sous-couverts, risque eleve en production.

**V9 (P0) — Aucun emoji.**
Commande : `./scripts/check-no-emoji.sh; echo $?`.
Attendu : `0`.
Mode d'echec : decision-006 violee, CI rouge, caracteres problematiques dans un contexte reglementaire/terminal.

**V10 (P0) — Migrations up/down reversibles.**
Commande : `pnpm --filter @insurtech/database run migrate:up && migrate:down && migrate:up; echo $?`.
Attendu : exit `0` (up -> down -> up coherent).
Mode d'echec : migration non reversible, impossibilite de rollback en production, schema bloque.

**V11 (P0) — Aucun artefact de build stage/commite.**
Commande : `git show --name-only --pretty=format: HEAD | grep -E '(dist|\.turbo|coverage|node_modules)/|\.tsbuildinfo$'`.
Attendu : sortie vide.
Mode d'echec : pollution du depot, diff illisible, conflits a chaque build, depot alourdi a jamais.

**V12 (P0) — Aucun secret commite.**
Commande : `git show --name-only --pretty=format: HEAD | grep -E '(^|/)\.env(\.|$)|\.pem$|\.key$'`.
Attendu : sortie vide.
Mode d'echec : fuite de secret dans l'historique (irreversible sans reecriture), incident de securite, violation CNDP.

**V13 (P0) — Commit conforme Conventional Commits.**
Commande : `git log -1 --pretty=%s | grep -E '^(feat|fix|chore|docs|refactor|test|build|ci|perf|style|revert)(\([a-z0-9._/-]+\))?: .+'`.
Attendu : match.
Mode d'echec : commitlint/CI rejet, changelog incoherent, tracabilite degradee.

**V14 (P0) — Scope `sprint-7.5a`.**
Commande : `git log -1 --pretty=%s | grep -F '(sprint-7.5a):'`.
Attendu : match.
Mode d'echec : tracabilite incorrecte, jalon non rattachable au sprint, audit complique.

**V15 (P0) — Tag annote.**
Commande : `git cat-file -t sprint-7.5a-complete-v3-foundation`.
Attendu : `tag`.
Mode d'echec : tag leger non auditable (pas de tagger, date, message), jalon reglementaire non recevable.

**V16 (P0) — Tag pointe vers HEAD.**
Commande : `test "$(git rev-list -n1 sprint-7.5a-complete-v3-foundation)" = "$(git rev-parse HEAD)"; echo $?`.
Attendu : `0` (egal).
Mode d'echec : tag mal place, pointe vers un autre commit que la fondation, aval base sur le mauvais etat.

**V17 (P0) — Arbre propre apres commit.**
Commande : `git status --porcelain`.
Attendu : sortie vide.
Mode d'echec : changements non captures par le jalon, etat reel different de l'etat tague, incoherence d'audit.

### Criteres P1 (>= 8)

**V18 (P1) — Corps de commit exhaustif.**
Commande : `git log -1 --pretty=%b | grep -E '7\.5a\.1' && git log -1 --pretty=%b | grep -E '7\.5a\.8'`.
Attendu : les deux presents (et les six intermediaires).
Mode d'echec : documentation incomplete du perimetre, jalon non auto-documente.

**V19 (P1) — Message de tag riche.**
Commande : `git tag -n99 -l sprint-7.5a-complete-v3-foundation` et `git for-each-ref --format='%(contents)' refs/tags/sprint-7.5a-complete-v3-foundation | grep 'Jalon GO'`.
Attendu : message multi-lignes incluant "Jalon GO".
Mode d'echec : jalon non documente, intention du tag illisible pour l'audit.

**V20 (P1) — Tag unique.**
Commande : `git tag -l sprint-7.5a-complete-v3-foundation | wc -l`.
Attendu : `1`.
Mode d'echec : doublon ou ecrasement involontaire, ambiguite sur le commit pointe.

**V21 (P1) — Push branche reussi.**
Commande : `test "$(git rev-parse @{u})" = "$(git rev-parse HEAD)"; echo $?`.
Attendu : `0` (egal apres push).
Mode d'echec : branche non synchronisee avec le remote, CI non declenchee, aval bloque.

**V22 (P1) — CI verte sur le commit.**
Commande : `gh run list --commit "$(git rev-parse HEAD)" --limit 1 --json status,conclusion`.
Attendu : `completed success`.
Mode d'echec : tag pose sur une base rouge, jalon GO mensonger, aval casse.

**V23 (P1) — Tag pousse.**
Commande : `git ls-remote --tags origin refs/tags/sprint-7.5a-complete-v3-foundation`.
Attendu : la ref presente.
Mode d'echec : aval non debloque (le tag local seul n'est pas visible par l'orchestration).

**V24 (P1) — Pas de push non-fast-forward force.**
Commande : revue de l'historique des commandes, absence de `--force`/`-f` sur `main`.
Attendu : aucun force-push.
Mode d'echec : reecriture de `main`, casse des clones d'autrui, perte de commits.

**V25 (P1) — Checklist mise a jour si presente, no-op sinon.**
Commande : `bash scripts/sprint-7.5a/update-checklist.sh; echo $?`.
Attendu : `0` dans les deux cas (presente ou absente).
Mode d'echec : crash sur absence du fichier, blocage de la tache, ou duplication de la ligne (non idempotent).

### Criteres P2 (>= 5)

**V26 (P2) — Longueur du sujet <= 100.**
Commande : `git log -1 --pretty=%s | wc -c`.
Attendu : <= 101 (caractere de fin de ligne inclus).
Mode d'echec : sujet trop long, tronque dans les outils, `git log --oneline` illisible.

**V27 (P2) — Auteur/committeur renseignes.**
Commande : `git log -1 --pretty='%an <%ae> / %cn <%ce>'`.
Attendu : champs non vides.
Mode d'echec : tracabilite faible, impossibilite d'identifier le scelleur du jalon en audit.

**V28 (P2) — Descend de e98acca.**
Commande : `git merge-base --is-ancestor e98acca HEAD; echo $?`.
Attendu : exit `0`.
Mode d'echec : base divergente (rebase/reset accidentel), jalon hors de la lignee du programme.

**V29 (P2) — Pas de fichier volumineux nouveau.**
Commande : script de la section 7.b (refus > 2 Mo sur `--diff-filter=A`).
Attendu : aucun fichier nouvellement suivi > 2 Mo.
Mode d'echec : depot alourdi irreversiblement, clones lents.

**V30 (P2) — Refs decisions presentes.**
Commande : `git log -1 --pretty=%B | grep -F 'decisions 006'`.
Attendu : present.
Mode d'echec : tracabilite des decisions absente, lien gouvernance/code perdu.

**V31 (P2) — Tag signe verifiable (si politique).**
Commande : `git tag -v sprint-7.5a-complete-v3-foundation`.
Attendu : `Good signature` (si signature requise).
Mode d'echec : signature manquante ou invalide, jalon rejete par regle de protection de tag.

---

## 12. Edge cases + troubleshooting (15+)

**E1 — Le tag existe deja (local ou remote).**
Symptome : `fatal: tag 'sprint-7.5a-complete-v3-foundation' already exists`.
Diagnostic : `git tag -l sprint-7.5a-complete-v3-foundation` ; `git ls-remote --tags origin refs/tags/sprint-7.5a-complete-v3-foundation`.
Remediation (sequence) :
```bash
# Cas A: tag local errone et NON pousse -> supprimer puis recreer
git tag -d sprint-7.5a-complete-v3-foundation
bash scripts/sprint-7.5a/create-tag.sh
# Cas B: tag remote errone et NON consomme -> supprimer remote puis recreer
bash scripts/sprint-7.5a/rollback.sh delete-tag-remote
bash scripts/sprint-7.5a/rollback.sh delete-tag-local
bash scripts/sprint-7.5a/create-tag.sh
PUSH_TAG_NOW=1 bash scripts/sprint-7.5a/push-foundation.sh
# Cas C: tag deja CONSOMME par l'aval -> ne pas reutiliser le nom, creer un correctif
git tag -a sprint-7.5a-complete-v3-foundation-fix1 -F scripts/sprint-7.5a/tag-message.txt
```

**E2 — Push rejete non-fast-forward.**
Symptome : `! [rejected] main -> main (non-fast-forward)`.
Diagnostic :
```bash
git fetch origin
git rev-list --count HEAD..origin/main   # nombre de commits de retard
```
Remediation (sequence) :
```bash
git fetch origin
git rebase origin/main                   # rejouer ses commits par-dessus le remote
# resoudre les eventuels conflits, puis:
bash scripts/sprint-7.5a/pre-tag-gate.sh # rejouer le portail (l'etat a change)
git push origin main                     # JAMAIS --force sur main
```

**E3 — HEAD detache.**
Symptome : `git symbolic-ref --short HEAD` echoue (`fatal: ref HEAD is not a symbolic ref`).
Diagnostic : `git symbolic-ref --quiet HEAD; echo $?` retourne non-zero.
Remediation :
```bash
git switch main                          # ou: git switch integration/sprint-7.5a
git symbolic-ref --short HEAD            # confirmer la branche
```

**E4 — Mauvaise branche.**
Symptome : la branche courante n'est ni `main` ni `integration/sprint-7.5a`.
Remediation :
```bash
# Option 1: basculer si le travail est deja sur la bonne base
git switch main
# Option 2: merger la feature vers la cible, puis taguer la cible
git switch main && git merge --no-ff feature/assurflow-foundation
bash scripts/sprint-7.5a/create-tag.sh
```

**E5 — Hook husky `pre-commit` bloque.**
Symptome : le commit s'arrete sur lint-staged/check-no-emoji.
Remediation :
```bash
# Lire la sortie, corriger les fichiers fautifs (format, emoji), re-stager
pnpm -w exec biome format --write .
git add -u
git commit -F scripts/sprint-7.5a/commit-message.txt   # NE JAMAIS --no-verify
```

**E6 — commitlint rejette le message.**
Symptome : `subject may not be empty` / `type must be one of ...`.
Remediation : utiliser le message pre-formate conforme.
```bash
echo "feat(sprint-7.5a): fondation verticale Assurflow v3.0 (taches 7.5a.1 a 7.5a.8)" \
  | npx --no-install commitlint   # doit passer sans erreur
git commit -F scripts/sprint-7.5a/commit-message.txt
```

**E7 — Emoji detecte dans des fichiers stages.**
Symptome : `check-no-emoji.sh` echoue (decision-006).
Remediation :
```bash
./scripts/check-no-emoji.sh           # localiser fichier:ligne
# editer pour retirer l'emoji (y compris variantes avec selecteur FE0F)
git add -u
./scripts/check-no-emoji.sh           # doit retourner 0
```

**E8 — Artefacts de build stages accidentellement.**
Symptome : `dist/`, `.turbo/`, `coverage/` apparaissent dans `git diff --cached --name-only`.
Remediation :
```bash
git restore --staged dist .turbo coverage
git diff --cached --name-only | grep -E '(dist|\.turbo|coverage)/' || echo "STAGED PROPRE"
# verifier que .gitignore couvre bien ces chemins
grep -E '^(dist|\.turbo|coverage)/?$' .gitignore || echo "AJOUTER au .gitignore"
```

**E9 — `.turbo`/`dist` deja suivis dans l'historique.**
Symptome : malgre `.gitignore`, ces dossiers restent suivis (`git ls-files` les liste).
Remediation (commit de nettoyage SEPARE) :
```bash
git rm -r --cached .turbo dist
printf '%s\n%s\n' '.turbo/' 'dist/' >> .gitignore
git add .gitignore
git commit -m "chore(repo): stop tracking build artifacts (.turbo, dist)"
# PUIS seulement, proceder au commit de fondation
```

**E10 — Binaire volumineux stage.**
Symptome : `commit-foundation.sh` echoue sur un fichier > 2 Mo.
Remediation :
```bash
git diff --cached --name-only --diff-filter=A | while read -r f; do
  [ -f "$f" ] && echo "$(wc -c < "$f") $f"
done | sort -rn | head        # identifier les plus gros
git restore --staged path/to/big.bin   # retirer du staging
# si reellement necessaire au depot: configurer Git LFS pour ce type de fichier
```

**E11 — CI rouge apres le push de la branche.**
Symptome : `verify-ci.sh` retourne un echec (`completed failure`).
Remediation :
```bash
gh run view --log-failed             # lire la cause exacte
# corriger localement, rejouer le portail
bash scripts/sprint-7.5a/pre-tag-gate.sh
git add -u && git commit -m "fix(sprint-7.5a): correctif gate CI"
git push origin main
bash scripts/sprint-7.5a/verify-ci.sh   # attendre le vert AVANT de taguer
```

**E12 — Exigence de tag signe non respectee.**
Symptome : regle de protection ou CI exige une signature.
Remediation :
```bash
git config user.signingkey <KEY_ID>
git config tag.gpgSign true
SIGN_TAG=1 bash scripts/sprint-7.5a/create-tag.sh
git tag -v sprint-7.5a-complete-v3-foundation   # Good signature attendu
```

**E13 — `CHECKLIST-MASTER-EXECUTION.md` absent.**
Symptome : le fichier n'est pas dans le depot (il vit en pilotage externe).
Comportement attendu : `update-checklist.sh` no-op et sort `0`. La tache NE DOIT PAS echouer.
```bash
bash scripts/sprint-7.5a/update-checklist.sh; echo $?   # attendu: 0
```

**E14 — Diff volumineux a relire.**
Symptome : `git diff --cached` trop grand pour une relecture humaine.
Remediation (revue par paquets) :
```bash
git diff --cached -- packages/shared-types | less
git diff --cached -- packages/database     | less
git diff --cached --stat                   # vue d'ensemble par fichier
# s'appuyer sur les tests verts et le portail; documenter dans le message de commit
```

**E15 — Lockfile divergent (pnpm-lock.yaml).**
Symptome : le diff stage modifie `pnpm-lock.yaml` sans changement de dependance volontaire ; la CI `--frozen-lockfile` echoue.
Remediation :
```bash
node -p "require('./package.json').packageManager"   # version pnpm attendue
pnpm --version                                       # version locale reelle
corepack enable && corepack prepare --activate       # figer la version via Corepack
git checkout -- pnpm-lock.yaml                       # annuler le drift non voulu
pnpm install --frozen-lockfile                       # doit passer sans modifier le lockfile
```

**E16 — CI verte sur le mauvais commit.**
Symptome : la CI est verte mais sur un commit anterieur, pas sur le commit du jalon.
Remediation :
```bash
SHA="$(git rev-parse HEAD)"
gh run list --commit "$SHA" --limit 1 --json headSha,status,conclusion
# verifier que headSha == SHA et conclusion == success AVANT de pousser le tag
```

**E17 — Commit hors de la lignee de e98acca.**
Symptome : `git merge-base --is-ancestor e98acca HEAD` echoue.
Remediation :
```bash
git log --oneline --graph -20            # inspecter la divergence
git merge-base e98acca HEAD              # trouver l'ancetre commun reel
# investiguer un rebase/reset accidentel ou un mauvais clone avant de taguer
```

### 12.bis — Matrice de decision de rollback selon l'etat de propagation

Le bon geste de rollback depend strictement de jusqu'ou le jalon s'est propage. La matrice suivante donne, pour chaque etat, l'action canonique et l'interdiction associee. Elle est le complement decisionnel du runbook executable de la section 7.e.

| Etat de propagation | Commit pousse ? | Tag pousse ? | Tag consomme par l'aval ? | Action canonique | Interdiction absolue |
|---|---|---|---|---|---|
| Local uniquement | Non | Non (local seul) | Non | `rollback.sh reset-local` puis `delete-tag-local` | Aucun push avant correction |
| Commit pousse, tag local | Oui | Non | Non | Corriger par commit additionnel, re-CI, recreer le tag local | Ne pas `git reset` une branche partagee |
| Commit + tag pousses, non consommes | Oui | Oui | Non | `delete-tag-remote` puis `delete-tag-local` puis `revert-commit` | Ne pas reutiliser le nom du tag tant qu'il existe en remote |
| Commit + tag pousses, deja consommes | Oui | Oui | Oui | `revert-commit` (non destructif) + tag correctif distinct (`-fix1`) | Ne JAMAIS supprimer ni reecrire un tag consomme |

Regles transverses de cette matrice. Premierement, des qu'un objet (commit ou tag) est pousse et potentiellement recupere par un tiers, on bascule du mode destructif (`reset`, suppression) vers le mode additif (`revert`, tag correctif). Deuxiemement, la consommation par l'aval (Sprint 7 tache 2.3.2 ou un outil d'orchestration) est le point de non-retour : a partir de la, le nom du tag est gele a vie et toute correction passe par un nouveau nom. Troisiemement, sur les branches partagees `main` et `integration/sprint-7.5a`, `--force` et `--force-with-lease` sont interdits sans exception ; seul `git revert` est admis pour annuler un commit.

Sequence canonique de rollback complet d'un jalon pousse mais NON consomme :

```bash
# 1. Retirer le tag du remote (visible par l'orchestration), puis en local
bash scripts/sprint-7.5a/rollback.sh delete-tag-remote
bash scripts/sprint-7.5a/rollback.sh delete-tag-local
# 2. Annuler le commit de fondation par un commit inverse (non destructif)
bash scripts/sprint-7.5a/rollback.sh revert-commit
# 3. Pousser le revert sur la branche
git push origin "$(git symbolic-ref --short HEAD)"
# 4. Apres correction et CI verte, re-sceller proprement
bash scripts/sprint-7.5a/seal-foundation.sh
```

Sequence canonique pour un jalon DEJA consomme (correctif additif uniquement) :

```bash
# Ne JAMAIS toucher au tag existant. Corriger, puis poser un tag correctif distinct.
git add -u && git commit -m "fix(sprint-7.5a): correctif post-jalon de fondation"
git push origin "$(git symbolic-ref --short HEAD)"
bash scripts/sprint-7.5a/verify-ci.sh
git tag -a sprint-7.5a-complete-v3-foundation-fix1 -F scripts/sprint-7.5a/tag-message.txt
git push origin sprint-7.5a-complete-v3-foundation-fix1
```

---

## 13. Conformite Maroc (ACAPS / CNDP)

Le tag `sprint-7.5a-complete-v3-foundation` constitue la baseline d'audit de la fondation verticale Assurflow. En cas de controle ACAPS (regulateur assurance) ou CNDP (donnees personnelles), cet etat immuable et date permet de prouver : (1) quel code formait le socle a une date donnee, (2) qui l'a scelle (auteur du commit et tagger), (3) que les controles de qualite et de securite (tests, coverage des modules critiques auth/database/signature, no-emoji, reversibilite des migrations) etaient verts au moment du jalon. La tracabilite des commits (Conventional Commits, refs des taches et des decisions) renforce l'auditabilite.

Conformement a decision-008 (cloud souverain MA), le depot et la baseline taguee sont heberges dans l'infrastructure souveraine (Atlas Benguerir, DC1 Tier III + DC2 Tier IV) ; aucune donnee d'assure ne sort du Maroc, chiffrement AES-256-GCM au repos et TLS 1.3 en transit. Le commit de fondation ne contient aucune donnee personnelle ni secret : uniquement du code, des schemas, des contrats et des tests. La separation stricte entre code (versionne) et secrets (hors depot, fournis par l'environnement) est une exigence de conformite respectee par cette tache.

---

## 14. Conventions absolues (reproduites en entier)

- **Multi-tenant strict** : `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` ; `AsyncLocalStorage` ; RLS `app_can_access_tenant()` ; audit trail.
- **Validation strict** : Zod uniquement ; `@insurtech/shared-types` ; `z.object`/`z.infer`.
- **Logger strict** : Pino injecte ; jamais `console.log` ; champs JSON structures `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER`.
- **Package manager strict** : pnpm uniquement ; engine-strict Node >= 22.11.0 ; save-exact ; link-workspace-packages=deep.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest + Playwright ; chaque `.ts` a son `.spec.ts` ; coverage >= 85% global, >= 90% pour auth/database/signature.
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles ; 130 permissions.
- **Events strict** : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; Zod par evenement ; `Idempotency-Key` pour les flux critiques.
- **Imports strict** : `@insurtech/{name}` ; paths `tsconfig.base.json` ; ordre Node / external / `@insurtech` / relatif.
- **Skalean AI strict (decision-005)** : uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct frontier ; mock pour sprints 1-28, reel sprint 29.
- **No-emoji strict (decision-006 ABSOLU)** : aucun emoji nulle part ; `check-no-emoji.sh` ; CI echoue sur emoji.
- **Idempotency-Key strict** : POST `/payments`, `/signatures`, `/claims`, ecritures MCP ; TTL 24h Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee d'assure hors MA ; AES-256-GCM ; TLS 1.3.

---

## 15. Validation pre-commit (le portail, executable)

La validation pre-commit de cette tache est le portail `scripts/sprint-7.5a/pre-tag-gate.sh` (section 7.a), complete par les hooks husky natifs du depot (`pre-commit` : lint-staged + check-no-emoji ; `commit-msg` : commitlint). Aucune de ces verifications ne doit etre contournee (`--no-verify` interdit).

Sequence executable de validation pre-commit :

```bash
cd "$(git rev-parse --show-toplevel)"
# 1. Portail complet
bash scripts/sprint-7.5a/pre-tag-gate.sh
# 2. Verification ciblee no-emoji (redondance volontaire, decision-006)
./scripts/check-no-emoji.sh
# 3. Verification du staged avant commit
git diff --cached --name-only | grep -E '(dist|\.turbo|coverage|node_modules)/|\.tsbuildinfo$' && echo "ARTEFACTS DETECTES" || echo "STAGED PROPRE"
git diff --cached --name-only | grep -E '(^|/)\.env(\.|$)' && echo "SECRET DETECTE" || echo "PAS DE SECRET"
# 4. Simulation du commitlint sur le sujet prevu
echo "feat(sprint-7.5a): fondation verticale Assurflow v3.0 (taches 7.5a.1 a 7.5a.8)" \
  | npx --no-install commitlint || echo "Verifier commitlint"
```

Tout exit non nul a une de ces etapes interdit de poursuivre vers le commit/tag.

---

## 16. Commit message complet et message de tag (exacts)

### 16.1 Message de commit (a reproduire tel quel)

```
feat(sprint-7.5a): fondation verticale Assurflow v3.0 (taches 7.5a.1 a 7.5a.8)

Empaquete l'integralite de la fondation Assurflow produite durant le Sprint 7.5a.
Cet etat est valide par le portail pre-tag (typecheck, lint, tests, coverage,
no-emoji, migrations up/down) et sert de baseline d'audit ACAPS/CNDP.

Livrables consolides:
- 7.5a.1: structure de packages et configuration TypeScript stricte Assurflow.
- 7.5a.2: types partages @insurtech/shared-types pour le domaine Assurflow.
- 7.5a.3: migrations de base de donnees (up/down reversibles) tenant-scoped.
- 7.5a.4: repositories tenant-scoped avec RLS app_can_access_tenant().
- 7.5a.5: contrats de validation Zod (z.object/z.infer) du domaine.
- 7.5a.6: evenements Kafka insurtech.events.assurflow.* avec schemas Zod.
- 7.5a.7: squelette de service avec TenantGuard, RolesGuard, AsyncLocalStorage.
- 7.5a.8: tests Vitest unitaires et integration, coverage >=85% (>=90% critique).

Conformite:
- Multi-tenant strict (x-tenant-id, TenantGuard, RLS, audit trail).
- Validation Zod uniquement; logger Pino structure; argon2id.
- decision-006 respectee: aucune emoji.
- decision-008 respectee: cloud souverain MA, donnees d'assure non sorties du MA.

Refs: B-7.5a tache 7.5a.9; decisions 006, 008, 011-015.
```

### 16.2 Message du tag annote (a reproduire tel quel)

```
Jalon GO: fondation verticale Assurflow v3.0 complete.

Ce tag marque la cloture du Sprint 7.5a (taches 7.5a.1 a 7.5a.8) et autorise
le demarrage des travaux aval (Sprint 7 tache 2.3.2).

Perimetre valide par le portail pre-tag:
- typecheck monorepo, lint, tests Vitest unit + integration.
- coverage globale >= 85%, modules critiques (auth/database/signature) >= 90%.
- check-no-emoji (decision-006) sans aucune occurrence.
- migrations base de donnees up/down reversibles verifiees.
- build complet du monorepo.

Baseline d'audit:
- Conformite ACAPS/CNDP: cet etat sert de reference d'audit traceable.
- Cloud souverain MA (decision-008): aucune donnee d'assure hors du Maroc.

Refs: B-7.5a tache 7.5a.9; decisions 006, 008, 011-015.
```

### 16.3 Commandes exactes

```bash
# Commit (via fichier de message pour preserver le corps multi-lignes)
git commit -F scripts/sprint-7.5a/commit-message.txt

# Tag annote
git tag -a sprint-7.5a-complete-v3-foundation -F scripts/sprint-7.5a/tag-message.txt
# Variante signee
git tag -s sprint-7.5a-complete-v3-foundation -F scripts/sprint-7.5a/tag-message.txt

# Push
git push origin main
git push origin sprint-7.5a-complete-v3-foundation
```

---

## 17. Workflow next step

Une fois cette tache 7.5a.9 terminee (commit de fondation cree, tag annote `sprint-7.5a-complete-v3-foundation` pousse, CI verte, checklist mise a jour si presente, assertions de la section 8 toutes au vert), passer a la tache **7.5a.10** : documentation et cross-reference de cloture du Sprint 7.5a.

La tache 7.5a.10 s'appuiera sur l'existence verifiable du tag pose ici :
- elle referencera le tag `sprint-7.5a-complete-v3-foundation` comme jalon GO dans la documentation de cloture ;
- elle inscrira le SHA du commit de fondation et la date du tag comme baseline d'audit ;
- elle preparera le cross-reference vers le Sprint 7 tache 2.3.2, qui verifie la presence du tag avant de demarrer.

Pre-conditions transmises a 7.5a.10 :
1. `git tag -l sprint-7.5a-complete-v3-foundation` retourne le tag ;
2. `git cat-file -t sprint-7.5a-complete-v3-foundation` retourne `tag` ;
3. la CI est verte sur le commit pointe ;
4. `git status --porcelain` est vide.

Si l'une de ces pre-conditions n'est pas remplie, ne pas demarrer 7.5a.10 ; revenir au runbook de la section 12 (rollback) puis re-executer la sequence de la section 10.

---

Fin de la tache 7.5a.9 — Commit et tag annote de la fondation Sprint 7.5a (Assurflow v3.0).
Reference meta-prompt : B-7.5a, tache 7.5a.9. Phase 2.5. Priorite P0. Effort 1h.
Dependances : 7.5a.8. Bloque : 7.5a.10 puis Sprint 7 tache 2.3.2.
Decisions : 006 (no-emoji absolu), 008 (cloud souverain MA), 011-015 (jalonnement et tag).
AUCUNE EMOJI. Conventional Commits strict. Tag annote obligatoire.
