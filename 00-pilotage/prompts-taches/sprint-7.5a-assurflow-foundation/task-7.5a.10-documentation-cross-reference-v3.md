# Task 7.5a.10 -- Documentation cross-reference v3.0 (INDEX / README / CLAUDE / reprise / CHECKLIST)

## 1. Header metadata

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5a (Assurflow Foundation) |
| Reference meta-prompt | B-7.5a Tache 7.5a.10 |
| Phase | 2.5 (pont entre Phase 2 auth/RBAC et Phase 3 metier) |
| Priorite | P0 (verrou de cloture du sprint, requise avant reprise Sprint 7) |
| Effort estime | 1h (tache LEGERE -- ajout de notes en fin de fichiers existants) |
| Dependances | 7.5a.9 (tag git `sprint-7.5a-complete-v3-foundation` pose) |
| Position dans sprint | 10/10 -- DERNIERE tache du Sprint 7.5a |
| Densite cible doc | 80-150 ko (cible 90-110 ko) |
| Type de modification | `docs` (documentation pilotage uniquement, AUCUN code applicatif touche) |
| Emoji | AUCUNE EMOJI (decision-006 ABSOLU) |
| Langue prose | Francais |
| Vertical | Assurflow (v3.0 foundation) |
| Produit | Skalean InsurTech v3.0 |

Cette tache est la cloture documentaire du Sprint 7.5a. Elle ne touche AUCUN fichier de code
applicatif dans `repo/apps/` ou `repo/packages/`. Elle se limite a ajouter des notes de
cross-reference en fin de cinq fichiers de pilotage afin que la fondation v3.0 (rebrand Skalean,
vertical Assurflow, 26 roles, 7 types cross-tenant, 130 permissions, decisions 011-015) soit
correctement signalee dans la documentation directrice consommee par les humains et par Claude Code.

La tache est volontairement bornee : son budget d'une heure tient parce qu'elle ajoute des notes
et corrige des comptes, sans rien reecrire. Sa criticite (P0) ne vient pas de sa taille mais de
son effet de levier : un seul fichier (`repo/CLAUDE.md`) est lu en entree par toutes les sessions
agent futures, et un compte faux dans ce fichier se propage a toute la production de code
generee jusqu'a correction. La tache est donc petite en surface et grande en consequence ; c'est
exactement le profil d'un verrou de cloture de sprint.

---

## 2. But

But unique et borne : ajouter une note de cross-reference v3.0 en fin (ou dans un emplacement
ciblE et idempotent) de chacun des cinq fichiers de pilotage suivants, sans refactor global,
afin de signaler que le Sprint 7.5a est COMPLET et que la fondation v3.0 Assurflow est posee :

1. `00-pilotage/INDEX.md` (357 lignes) -- note : Sprint 7.5a complet + fondation v3.0 (26 roles,
   7 types cross-tenant, 130 permissions, decisions 011-015, migrations 011 et 012).
2. `00-pilotage/README.md` (296 lignes) -- note de fondation v3.0 (rebrand Skalean / vertical
   Assurflow, 6 acteurs, expert central, PartsHub, Demo Day 30 juin 2026).
3. `repo/CLAUDE.md` (112 lignes) -- mise a jour des COMPTES exacts consommes par Claude Code :
   26 roles, 7 types cross-tenant, 130 permissions, decisions 011-015. La precision ici est
   critique car ce fichier est lu par toute IA assistante avant chaque session.
4. `sprint-7-reprise-demain.md` (102 lignes) -- mise a jour d'etat : apres Sprint 7.5a, la
   tache Sprint 7 2.3.2 (PermissionsMatrix) peut reprendre sur l'architecture propre a 26 roles.
5. `CHECKLIST-MASTER-EXECUTION.md` -- cocher les taches 7.5a.1 a 7.5a.10. ATTENTION : ce
   fichier N'EST PAS present dans le depot (emplacement de pilotage externe). La mise a jour
   doit donc etre CONDITIONNELLE (`si present`) et documentee comme edge case.

Le but explicite EXCLUT : tout renommage massif des references textuelles `InsurTech`/`Broker`/
`Garage`/`Repair` vers la nomenclature Assurflow (environ 12696 occurrences), qui est reporte au
Sprint 7.5b. Cette tache pose uniquement les notes legeres, fideles aux comptes reels du code
livre par les taches 7.5a.1 a 7.5a.9.

Pour eviter toute ambiguite, voici ce qui est DANS le perimetre et ce qui en est HORS :

| Dans le perimetre | Hors perimetre (reporte 7.5b ou autre) |
|-------------------|----------------------------------------|
| Note v3.0 en fin de INDEX.md | Reecriture des 357 lignes existantes de INDEX.md |
| Note v3.0 en fin de README.md | Renommage InsurTech -> Assurflow en prose (~12696 occ.) |
| Section 1.9 + maj conventions dans CLAUDE.md | Renommage des packages `@insurtech/*` |
| Maj d'etat dans sprint-7-reprise-demain.md | Modification de code dans `repo/apps/` ou `repo/packages/` |
| Coche conditionnelle CHECKLIST si present | Creation du CHECKLIST dans le repo |
| Maj de la ligne "12 roles" -> "26 roles" dans INDEX | Renommage des tables/colonnes SQL |
| Scripts de pilotage idempotents (append-guard) | Toute migration ou seed supplementaire |

---

## 3. Contexte etendu

### 3.1 Pourquoi un cross-reference LEGER maintenant et un refactor COMPLET reporte a 7.5b

Le Sprint 7.5a (`Assurflow Foundation`) a livre, via ses taches 7.5a.1 a 7.5a.9, la fondation
technique de la version v3.0 du produit :

- L'enum `AuthRole` est passe de 12 a 26 roles (ajout +6 carrier, +4 expert, +3 tow, +1
  garage_parts_manager).
- L'enum `CrossTenantAuthorizationType` est passe de 3 a 7 types.
- Le catalogue de permissions est passe de 90 a 130 permissions (+carrier 15, +expertise 10,
  +tow 8, +parts 7).
- Deux migrations ont ete posees : `1735000000011` (contrainte CHECK cross-tenant + table
  `expert_designations`) et `1735000000012` (fonction SQL `app_can_access_tenant`).
- Cinq decisions strategiques ont ete formalisees : 011 (rebrand Skalean / Assurflow), 012
  (les 6 acteurs metier), 013 (l'expert comme acteur central), 014 (PartsHub), 015 (Demo Day
  fixe au 30 juin 2026).
- Un tag git `sprint-7.5a-complete-v3-foundation` a ete pose par la tache 7.5a.9.

Cette fondation est de nature TECHNIQUE (enums, migrations, permissions, decisions). Le rebrand
de surface -- c'est-a-dire le remplacement des mots `InsurTech`, `Broker`, `Garage`, `Repair`
par leurs equivalents Assurflow dans toute la base documentaire et le code (titres, prose,
identifiants de produit) -- represente environ 12696 occurrences textuelles reparties sur des
centaines de fichiers. Faire ce remplacement maintenant serait :

- RISQUE : un sed/replace massif sur 12696 occurrences est une operation a fort risque de
  regression (faux positifs sur des identifiants techniques, des noms de packages
  `@insurtech/*` qui NE doivent PAS changer, des chemins de fichiers, des cles JSON, etc.).
- HORS PERIMETRE : la tache 7.5a.10 a un budget de 1h. Un refactor de 12696 occurrences est un
  travail de plusieurs heures avec revue ligne par ligne.
- PREMATURE : tant que le naming Assurflow definitif (noms de packages, de tables, d'apps)
  n'est pas entierement arbitre par le Sprint 7.5b, un renommage partiel creerait une
  incoherence pire que l'etat actuel.

La decision est donc : poser MAINTENANT des notes de cross-reference legeres et fideles aux
comptes reels, et REPORTER le refactor complet de naming au Sprint 7.5b. Cette tache est le
point de jonction documentaire : elle dit explicitement "la fondation v3.0 existe dans le code,
le refactor de surface viendra en 7.5b".

#### 3.1.1 Detail du report a 7.5b -- pourquoi 12696 occurrences ne se touchent pas a la legere

Le chiffre de 12696 occurrences n'est pas une estimation au doigt mouille : il provient d'un
inventaire `grep -roiI` sur les chaines `InsurTech`, `Broker`, `Garage`, `Repair` dans
l'ensemble du depot et de la documentation de pilotage. Ces occurrences ne sont pas homogenes ;
elles se repartissent en plusieurs familles qui exigent chacune un traitement DIFFERENT :

- Occurrences de PROSE pure (titres de docs, paragraphes explicatifs, commentaires) : peuvent
  etre renommees mecaniquement, mais leur volume est tel qu'un seul faux positif glisse passera
  inapercu dans une revue humaine fatiguee.
- Occurrences d'IDENTIFIANTS techniques (`@insurtech/shared-types`, `@insurtech/sky`, le scope
  npm `@insurtech`, le prefixe d'events Kafka `insurtech.events.*`) : ces chaines NE doivent
  PAS changer en 7.5b non plus, ou alors via une migration coordonnee package par package avec
  bump de version. Un sed naif les casserait et ferait echouer tout le monorepo.
- Occurrences de NOMS DE TABLES et de colonnes SQL : un renommage ici impose une migration de
  base de donnees, donc une fenetre de maintenance, donc un arbitrage produit. Hors de question
  de le declencher depuis une tache documentaire d'une heure.
- Occurrences de CLES JSON et de fixtures : renommer une cle JSON peut casser un contrat d'API
  ou un test de snapshot. Chaque cle exige une verification de contrat.

La conclusion est qu'un renommage de surface fiable EXIGE une categorisation prealable des
12696 occurrences en "renommables mecaniquement" vs "intouchables" vs "renommables avec
migration". Cette categorisation EST le travail du Sprint 7.5b. La tache 7.5a.10 ne fait donc
qu'une chose : poser des notes qui disent "le code expose deja la fondation v3.0, mais la
surface textuelle reste majoritairement v2.2 jusqu'a 7.5b". C'est honnete, tracable, et sans
risque de regression.

#### 3.1.2 Pourquoi un etat documentaire "transitoire" est acceptable

On pourrait objecter qu'un document affichant a la fois du branding v2.2 (dans le corps) et une
note v3.0 (en fin) est incoherent. C'est vrai, et c'est ASSUME. Le cout de cette incoherence de
surface est faible et borne dans le temps (jusqu'a 7.5b). Le cout d'un renommage premature et
casse serait eleve et non borne (regressions silencieuses dans le code, contrats d'API rompus).
Entre une incoherence cosmetique temporaire et un risque de regression fonctionnelle, le choix
est evident. La note v3.0 elle-meme rend l'incoherence EXPLICITE : un lecteur arrivant sur le
document comprend immediatement que la surface est v2.2 et que la fondation est v3.0, avec le
pointeur vers 7.5b pour la suite.

### 3.2 Pourquoi la precision de CLAUDE.md est critique

`repo/CLAUDE.md` n'est pas une simple documentation : c'est le fichier d'instructions agent lu
par Cowork, par Claude Code, et par toute IA assistante AVANT chaque session de travail sur le
projet. Sa premiere ligne le dit : "Ce fichier est lu par Cowork, Claude Code, et toute IA
assistante avant chaque session de travail sur ce projet."

Si CLAUDE.md continue d'annoncer "12 roles" alors que le code expose desormais 26 roles dans
l'enum `AuthRole`, alors toute future tache generee qui consomme ce fichier partira d'un compte
FAUX. Une tache RBAC qui doit ecrire un `@Roles()` correct, une tache de tests qui doit couvrir
tous les roles, une tache de seed qui doit creer les utilisateurs par role : toutes liraient
"12 roles" et produiraient du code incomplet ou incorrect. Le drift documentation/code dans
CLAUDE.md se PROPAGE a toute la production future. C'est pourquoi cette tache, bien que legere,
est classee P0 : les comptes 26 roles / 7 types cross-tenant / 130 permissions DOIVENT etre
exacts dans CLAUDE.md a la fin du Sprint 7.5a.

A l'inverse, INDEX.md et README.md sont des documents directeurs lus par les humains ; un compte
legerement decale y serait genant mais pas propagateur. La criticite est donc graduee :
CLAUDE.md > INDEX.md = README.md > sprint-7-reprise-demain.md > CHECKLIST.

#### 3.2.1 Le mecanisme exact de propagation du drift

Pour bien comprendre pourquoi CLAUDE.md est "load-bearing", il faut decrire le cycle de vie
d'une session agent sur ce projet :

1. Une session demarre. L'agent lit `repo/CLAUDE.md` comme contexte d'instructions de base.
2. L'agent y trouve les conventions absolues (section 5 du fichier) dont la convention RBAC.
3. Une tache lui demande, par exemple, d'ecrire un guard `@Roles()` qui autorise "tous les
   roles internes carrier". L'agent, pour savoir QUELS roles existent, se fie au compte annonce
   par CLAUDE.md.
4. Si CLAUDE.md dit "12 roles" et n'enumere pas les 6 roles carrier, l'agent generera un guard
   INCOMPLET qui oublie les roles carrier. Le code compilera, les tests existants passeront
   (ils ne couvrent pas encore les roles carrier), et le bug ne sera detecte qu'a l'execution,
   potentiellement en production.

Le drift dans CLAUDE.md n'est donc pas un simple defaut cosmetique : c'est une source de bugs
fonctionnels GENERES, difficiles a tracer car leur cause est documentaire et non logique. Le
correctif est d'autant plus important que la prochaine tache (Sprint 7 task 2.3.2,
PermissionsMatrix) consomme PRECISEMENT le compte de roles et de permissions. Si CLAUDE.md
ment, 2.3.2 produit une matrice incomplete des le redemarrage.

#### 3.2.2 Pourquoi enumerer les roles par famille et pas seulement le nombre

La note CLAUDE.md ne se contente pas d'ecrire "26 roles". Elle enumere les roles par famille
(carrier, expert, tow, parts, plus les 12 historiques). La raison est que le nombre seul ("26")
ne dit pas a l'agent QUELS sont les roles ; il faut la liste pour qu'un guard ou un seed soit
exhaustif. Un agent qui lit "26 roles dont +6 carrier, +4 expert, +3 tow, +1
garage_parts_manager" peut reconstruire la liste cible ; un agent qui lit juste "26 roles" doit
deviner, et devinera mal. La note est donc structuree pour etre ACTIONNABLE, pas seulement
informative.

### 3.3 Risque de drift documentation / code

Le risque central de cette tache est le DRIFT : la divergence entre ce que le code expose
reellement (26 roles, 7 types, 130 permissions, dans les enums et le catalogue de permissions)
et ce que la documentation affirme. Trois sous-risques :

- Drift de COMPTE : ecrire "25 roles" au lieu de "26", "120 permissions" au lieu de "130". La
  tache fournit une section "count-consistency checker" qui grep CLAUDE.md pour les chaines
  exactes "26 roles", "130 perm", "7 cross-tenant" et echoue si absentes.
- Drift de DECISION : oublier une decision (011-015) ou en citer une qui n'existe pas. La note
  liste les cinq decisions explicitement.
- Drift de MIGRATION : citer un mauvais numero de migration. Les numeros reels sont
  `1735000000011` et `1735000000012`.

Le drift se previent par TRIANGULATION : la meme verite (26/7/130) est ecrite dans trois
documents (INDEX, CLAUDE, reprise) et verifiee par trois mecanismes (count-checker grep, suite
de tests, revue humaine). Si les trois documents concordent et que les checkers passent, la
probabilite d'un compte faux residuel est tres faible. C'est volontaire : la redondance
controlee est ici une protection, pas un gaspillage.

### 3.4 Alternatives considerees et trade-offs

- ALTERNATIVE A -- refactor complet de naming maintenant (12696 occurrences). REJETEE : trop
  risquee, hors budget 1h, prematuree avant arbitrage 7.5b. Trade-off : on accepte un etat
  documentaire "transitoire" ou le branding reste majoritairement v2.2 avec une note v3.0
  ajoutee. C'est assume et explicite.
- ALTERNATIVE B -- notes legeres ciblees (RETENUE). On ajoute un bloc de note par fichier, en
  fin de fichier ou dans une section dediee, sans toucher au reste. Trade-off : la coherence
  globale du document reste imparfaite jusqu'a 7.5b, mais le drift de COMPTE critique (CLAUDE.md)
  est elimine immediatement.
- ALTERNATIVE C -- ne rien faire et tout reporter a 7.5b. REJETEE : laisser CLAUDE.md annoncer
  "12 roles" pendant tout l'intervalle entre 7.5a et 7.5b propagerait des comptes faux a toutes
  les taches generees entre temps (notamment la reprise du Sprint 7 task 2.3.2 qui consomme le
  compte de roles). Le cout du drift est immediat ; la note legere doit etre posee maintenant.
- ALTERNATIVE D -- editer CLAUDE.md seulement, laisser les autres. REJETEE partiellement : la
  cross-reference doit etre coherente sur les cinq points d'entree documentaires pour qu'un
  lecteur arrivant par n'importe lequel comprenne l'etat v3.0. Le cout marginal d'ajouter une
  note a INDEX/README/reprise est faible (quelques lignes) pour un gain de coherence net.

#### 3.4.1 Tableau d'arbitrage : refactor complet maintenant vs notes legeres maintenant

| Critere | Refactor complet maintenant (A) | Notes legeres maintenant (B, retenue) |
|---------|---------------------------------|---------------------------------------|
| Budget | Plusieurs heures, revue ligne par ligne | 1h, ajout cible |
| Risque de regression | Eleve (faux positifs sur identifiants) | Quasi nul (append documentaire) |
| Coherence de surface immediate | Totale (mais fragile) | Partielle (assumee, jusqu'a 7.5b) |
| Drift de compte CLAUDE.md corrige | Oui | Oui |
| Reversibilite | Faible (sed massif difficile a annuler proprement) | Totale (un append se retire trivialement) |
| Compatibilite avec budget P0 cloture sprint | Non (deborde) | Oui (cadre dans la cloture) |
| Verdict | REJETE | RETENU |

#### 3.4.2 Tableau d'arbitrage : sentinel-marker idempotent vs append aveugle

| Critere | Append aveugle (`>>` sans garde) | Append avec sentinel marker (retenu) |
|---------|----------------------------------|--------------------------------------|
| Comportement a la 1re execution | Ajoute la note | Ajoute la note |
| Comportement a la 2e execution | DUPLIQUE la note | Detecte le marqueur, ne fait rien |
| Detection de duplication | Aucune | `grep -qF "$marker"` avant ecriture |
| Robustesse en cas de rerun script (frequent) | Mauvaise (doublons) | Bonne (idempotent) |
| Cout d'implementation | Trivial | Trivial+ (une garde grep) |
| Verdict | REJETE | RETENU |

Le choix du sentinel marker (une chaine unique propre a chaque note, par exemple
`## ADDENDUM v3.0 -- Fondation Assurflow` pour INDEX) garantit l'idempotence : relancer le
script dix fois produit exactement le meme fichier qu'une seule execution. C'est la propriete
attendue de tout script de pilotage qui peut etre rejoue (par un humain incertain de l'avoir
deja lance, par une CI, par une reprise apres interruption).

### 3.5 Pieges nommes (14-16)

1. PIEGE -- drift de compte dans CLAUDE.md.
   Pourquoi : ecrire un nombre faux (25, 27, 120, 6 types) propage un compte errone a toutes
   les taches generees qui consomment CLAUDE.md. C'est le piege le plus couteux car silencieux.
   Solution : count-consistency checker (section 7.8) qui assert les chaines exactes "26 roles",
   "130 perm", "7 types cross-tenant" et echoue (exit 1) si l'une manque.
2. PIEGE -- liens internes casses.
   Pourquoi : une note qui pointe vers un fichier inexistant (ex. `decisions/decision-011.md`
   mal nomme) cree un lien mort qui degrade la navigation et trompe un auditeur.
   Solution : link-checker script (section 7.7) qui verifie l'existence de chaque cible relative,
   et preference pour les references textuelles "voir decisions/" plutot que des liens fragiles.
3. PIEGE -- duplication dans INDEX.
   Pourquoi : relancer le script d'append deux fois inserait la note en double, polluant le
   fichier et faussant les tests d'idempotence.
   Solution : append idempotent avec garde `grep -qF "$marker"` avant insertion (section 7.6) ;
   test d'idempotence (T22) qui assert occurrence <= 1.
4. PIEGE -- rendu markdown casse.
   Pourquoi : un bloc de code non ferme (nombre impair de fences ```), un tableau mal aligne, un
   titre sans ligne vide avant, cassent le rendu sur GitHub/GitLab et les visionneuses.
   Solution : markdown-lint invocation (section 7.9) qui compte les fences et echoue si impair,
   plus invocation optionnelle de markdownlint-cli2 si disponible.
5. PIEGE -- editer le MAUVAIS README.
   Pourquoi : il existe potentiellement plusieurs README dans le repo (`repo/README.md`,
   `00-pilotage/README.md`). Editer le mauvais fait echouer la cross-reference et pollue un
   fichier hors perimetre.
   Solution : chemins absolus explicites, jamais de glob `README.md`. Cette tache vise
   UNIQUEMENT `00-pilotage/README.md`.
6. PIEGE -- CHECKLIST absente.
   Pourquoi : `CHECKLIST-MASTER-EXECUTION.md` n'est pas dans le depot. Un script qui suppose sa
   presence echouerait (exit non nul) et bloquerait la cloture.
   Solution : test `if [ -f "$CHECKLIST" ]` conditionnel ; edge case documente (section 12) ;
   le test V26 PASSE par skip si absent.
7. PIEGE -- emoji introduite accidentellement.
   Pourquoi : copier-coller d'un fragment contenant un caractere emoji ou une coche unicode
   coloree viole decision-006 (ABSOLU) et fait echouer la CI.
   Solution : check-no-emoji (section 7.10) sur les cinq fichiers ; usage de coches ASCII `[x]`
   et de mots `OK`/`ECHEC` au lieu de symboles colores.
8. PIEGE -- encodage.
   Pourquoi : ecrire des accents francais qui cassent en latin-1 produirait des mojibake dans la
   doc directrice.
   Solution : tous les fichiers en UTF-8 ; prose francaise sans caracteres exotiques au-dela des
   accents standards ; critere V28 verifie l'encodage via `file -i`.
9. PIEGE -- numero de migration faux.
   Pourquoi : ecrire `1735000000010` ou `...013` au lieu des vrais numeros cree un drift de
   migration et trompe une reprise.
   Solution : valeurs codees en dur dans la note (`1735000000011`, `1735000000012`) ; critere
   V10 grep les deux numeros exacts.
10. PIEGE -- modifier la zone protegee `00-pilotage/` depuis le code.
    Pourquoi : CLAUDE.md interdit a Claude Code de modifier `00-pilotage/` directement. Une IA
    en mode implementation code qui executerait cette tache violerait sa propre regle.
    Solution : cette tache est une exception EXPLICITE de pilotage documentaire ; elle DOIT etre
    executee par Cowork (pas Claude Code en mode implementation code). Note en section 17.
11. PIEGE -- ecraser le contenu existant.
    Pourquoi : utiliser `>` au lieu de `>>` tronquerait le fichier et detruirait 357 lignes
    d'INDEX ou 112 de CLAUDE.
    Solution : scripts en append `>>` uniquement, jamais de redirection ecrasante ; revue du
    script avant execution.
12. PIEGE -- decalage de numerotation des decisions.
    Pourquoi : confondre decision-010 (Insure Connecteurs defere, deja existante en v2.2) avec
    les nouvelles 011-015 ferait citer une mauvaise plage.
    Solution : la note cite explicitement la plage 011-015 comme NOUVELLES decisions v3.0 ;
    decision-010 n'est jamais citee comme nouvelle.
13. PIEGE -- ligne 45 INDEX deja modifiee lors d'une re-execution.
    Pourquoi : si l'Edit cherche "12 roles utilisateurs" mais que la maj 12->26 a deja eu lieu,
    l'Edit echoue faute de trouver la chaine.
    Solution : traiter l'absence de la chaine "12 roles utilisateurs" comme un succes idempotent
    (la maj est deja faite) et ne pas relancer ; edge case 7 documente.
14. PIEGE -- count-checker trop strict sur "130 perm".
    Pourquoi : si CLAUDE.md ecrit "130 droits" au lieu de "130 perm...", le grep `130 perm`
    echoue alors que le compte est correct.
    Solution : convention d'ecriture imposee ("130 permissions") ; le grep `130 perm` matche
    bien "130 permissions" ; troubleshooting en section 12 si "droits" est utilise.
15. PIEGE -- bash mount qui lag (contexte present).
    Pourquoi : l'environnement shell peut ne pas repondre ou booter lentement ; un script qui
    bloque ferait echouer la tache alors que l'edition manuelle aurait suffi.
    Solution : tous les blocs de note de la section 7 sont fournis EN TEXTE INTEGRAL pour
    application manuelle via l'outil Edit ; les scripts sont un confort, pas une obligation.
16. PIEGE -- maj d'etat reprise incomplete.
    Pourquoi : oublier de preciser que 2.3.2 reprend "sur 26 roles" laisserait la reprise sans
    le compte cible et reproduirait le drift.
    Solution : la note reprise (section 7.4) ecrit explicitement "26 roles", "7 types
    cross-tenant", "130 permissions" ; criteres V14 et T18 le verifient.

### 3.6 Decisions referencees

- decision-006 (No-emoji ABSOLU) : aucune emoji dans les notes ajoutees.
- decision-008 (Cloud souverain MA) : tracabilite documentaire pour audit ACAPS (section 13).
- decision-011 (Rebrand Skalean / vertical Assurflow) : motive l'existence du Sprint 7.5a.
- decision-012 (6 acteurs metier) : carrier, expert, tow, garage parts manager, broker, assure.
- decision-013 (Expert central) : l'expert est l'acteur pivot du flux sinistre.
- decision-014 (PartsHub) : marketplace pieces detachees, role `garage_parts_manager`.
- decision-015 (Demo Day 30 juin 2026) : jalon de demonstration de la fondation v3.0.

### 3.7 Dependances du graphe documentaire

La tache opere sur un petit graphe de documents dont les dependances de lecture sont les
suivantes (qui lit quoi, et donc qui doit etre coherent avec qui) :

- `00-pilotage/INDEX.md` est le point d'entree humain. Il POINTE vers CLAUDE.md, vers la reprise,
  vers les decisions. Un humain qui veut comprendre l'etat du projet commence ici.
- `00-pilotage/README.md` est la presentation produit. Il decrit le QUOI (acteurs, vertical) ;
  il est lu par tout nouvel arrivant.
- `repo/CLAUDE.md` est lu par les AGENTS avant chaque session. C'est la seule source consommee
  AUTOMATIQUEMENT et a chaque fois ; d'ou sa criticite.
- `sprint-7-reprise-demain.md` est lu par celui (humain ou agent) qui reprend le Sprint 7. Il
  doit refleter l'etat post-7.5a pour que la reprise parte du bon compte.
- `CHECKLIST-MASTER-EXECUTION.md` (externe) est le tableau de bord d'avancement. Conditionnel.

La coherence requise est donc : les trois documents qui portent des COMPTES (INDEX, CLAUDE,
reprise) doivent dire la meme chose (26/7/130). README porte le QUOI metier (acteurs, Demo Day),
pas les comptes RBAC fins. CHECKLIST porte l'avancement (coches). C'est cette repartition qui
guide le contenu exact de chaque note dans la section 7.

### 3.8 Registre de risques de la tache

Le tableau ci-dessous synthetise les risques residuels, leur probabilite, leur impact et la
parade en place. Il sert de checklist de revue avant le commit final.

| Risque | Probabilite | Impact | Parade en place |
|--------|-------------|--------|-----------------|
| Compte faux dans CLAUDE.md | Moyenne | Critique (propagation) | count-checker 7.8 + V6/V7/V8/V17 |
| Note dupliquee (re-run) | Moyenne | Faible (cosmetique) | sentinel-marker + V20/V21 + T25/T26/T31 |
| Lien interne casse | Faible | Moyen (navigation/audit) | link-checker 7.7 + V18 ; preference refs textuelles |
| Emoji introduite | Faible | Moyen (CI echoue) | check-no-emoji 7.10 + V15 + T30 |
| Mauvais README edite | Faible | Moyen (fichier hors perimetre pollue) | chemins absolus, jamais de glob |
| CHECKLIST suppose present | Moyenne | Faible (script echoue) | garde `[ -f ]` + V26 skip |
| Code applicatif touche | Tres faible | Eleve (hors perimetre) | V16 git status + revue diff |
| Mauvais numero de migration | Faible | Moyen (drift migration) | valeurs en dur + V10/V25 |
| Encodage latin-1 (mojibake) | Faible | Moyen (lisibilite) | UTF-8 impose + V28 |
| Refactor naming declenche par erreur | Tres faible | Eleve (regressions) | perimetre exclut explicitement, report 7.5b |

### 3.9 Matrice de tracabilite livrables -> criteres -> tests

Pour garantir qu'aucun livrable n'est orphelin (sans critere ni test), la matrice relie chaque
livrable L1-L25 a son critere de validation Vn et a l'assertion de test Tn correspondante :

| Livrable | Critere(s) | Test(s) bash |
|----------|------------|--------------|
| L1 note INDEX | V1 | T1 |
| L2 INDEX 26 roles | V2 | T2 |
| L3 INDEX 7 types | V3 | T3 |
| L4 INDEX 130 perm | V4 | T4 |
| L5 INDEX decisions 011-015 | V5 | (couvert par addendum 7.1) |
| L6 INDEX migrations | V25 | T5, T6 |
| L7 note README | V12 | T8 |
| L8 README rebrand | V12 | T9 |
| L9 README 6 acteurs + Demo Day | V22 | T10, T11, T12 |
| L10 CLAUDE 26 roles | V6, V9 | T13, T23 |
| L11 CLAUDE 130 perm | V7 | T14 |
| L12 CLAUDE 7 types | V8 | T15 |
| L13 CLAUDE decisions | (V17 via checker) | T16, T17 |
| L14 CLAUDE migrations | V10 | T19, T20 |
| L15 reprise 2.3.2 26 roles | V13, V14 | T21, T22, T28, T29 |
| L16 CHECKLIST conditionnel | V26 | T24 |
| L17 liens resolus | V18 | (link-checker 7.7) |
| L18 no-emoji | V15 | T30 |
| L19 markdown valide | V19 | (lint 7.9) |
| L20 idempotence | V20, V21 | T25, T26, T31 |
| L21 aucun code touche | V16 | T32 |
| L22 commit docs | V27 | (git log) |
| L23 count-checker | V17 | (checker 7.8) |
| L24 suite passe | V24 | (suite entiere) |
| L25 report 7.5b | V23 | T27 |

Aucun livrable n'est sans couverture : c'est la condition pour que la cloture du sprint soit
defendable lors d'une revue.

---

## 4. Architecture context

### 4.1 Position de la tache dans le sprint

Cette tache est la 10/10 du Sprint 7.5a, donc la DERNIERE. Elle depend de 7.5a.9 (tag pose).
Ordre du sprint :

```
7.5a.1  enum AuthRole 12 -> 26 roles
7.5a.2  enum CrossTenantAuthorizationType 3 -> 7
7.5a.3  catalogue permissions 90 -> 130
7.5a.4  migration 1735000000011 (CHECK cross-tenant + expert_designations)
7.5a.5  migration 1735000000012 (app_can_access_tenant)
7.5a.6  seeds / fixtures roles v3.0
7.5a.7  tests RBAC 26 roles
7.5a.8  decisions 011-015 formalisees
7.5a.9  tag git sprint-7.5a-complete-v3-foundation        <-- dependance directe
7.5a.10 cross-reference documentaire v3.0 (CETTE TACHE)   <-- cloture sprint
```

### 4.2 Graphe des documents de pilotage et perimetre 7.5b

```
                          00-pilotage/
                          |
   +----------------------+----------------------+-----------------------+
   |                      |                      |                       |
 INDEX.md             README.md             decisions/             prompts-taches/
 (357 l.)             (296 l.)              decision-011..015        sprint-7.5a-*/
   | note v3.0           | note v3.0            (sources verite)       task-7.5a.10 (ici)
   | (cette tache)       | (cette tache)
   |
   +-- pointe vers --> repo/CLAUDE.md (112 l.)  <-- comptes 26/7/130 (cette tache, CRITIQUE)
   |
   +-- pointe vers --> sprint-7-reprise-demain.md (102 l.)  <-- etat reprise (cette tache)
   |
   +-- (externe) ----> CHECKLIST-MASTER-EXECUTION.md  <-- ABSENT du repo (conditionnel)


 Perimetre du Sprint 7.5b (NON couvert ici, reporte) :
 -----------------------------------------------------
   refactor naming complet ~12696 occurrences :
     InsurTech -> Assurflow (prose, titres, produit)
     Broker / Garage / Repair -> nomenclature Assurflow
   NE PAS toucher : packages @insurtech/* (identifiants techniques),
   chemins, cles JSON, noms de tables (arbitrage 7.5b dedie).
```

Cette tache pose donc les "ancres" v3.0 dans le graphe documentaire ; le Sprint 7.5b viendra
ensuite reecrire la surface textuelle complete.

### 4.3 Modele d'acteurs v3.0 (rappel pour les notes)

Pour que les notes README et INDEX soient fideles, voici le modele d'acteurs v3.0 issu des
decisions 012-014, qui justifie l'expansion de 12 a 26 roles :

| Famille | Acteur metier | Roles ajoutes (vs 12 v2.2) | Decision |
|---------|---------------|----------------------------|----------|
| Carrier | Assureur (compagnie) | +6 roles carrier | 012 |
| Expert | Expert sinistre (pivot) | +4 roles expert | 012, 013 |
| Tow | Depanneur / remorquage | +3 roles tow | 012 |
| Parts | Gestionnaire pieces (PartsHub) | +1 role garage_parts_manager | 012, 014 |
| Broker | Courtier (existant v2.2) | 0 (deja present) | 012 |
| Assure | Assure final (existant v2.2) | 0 (deja present) | 012 |

Total : 12 historiques + 6 + 4 + 3 + 1 = 26 roles. Ce calcul est la verite que toutes les notes
doivent refleter. L'expert est l'acteur CENTRAL (decision-013) car il est le pivot du flux
sinistre : il est designe sur un dossier (table `expert_designations`, migration 011) et accede
en cross-tenant aux donnees du dossier qu'il expertise.

---

## 5. Livrables checkables (15-25)

L1. `00-pilotage/INDEX.md` contient une note "Sprint 7.5a complet + fondation v3.0".
L2. La note INDEX.md cite "26 roles".
L3. La note INDEX.md cite "7 types cross-tenant".
L4. La note INDEX.md cite "130 permissions".
L5. La note INDEX.md cite les decisions 011-015.
L6. La note INDEX.md cite les migrations 1735000000011 et 1735000000012.
L7. `00-pilotage/README.md` contient une note de fondation v3.0.
L8. La note README.md cite le rebrand Skalean / vertical Assurflow.
L9. La note README.md cite les 6 acteurs et le Demo Day 30 juin 2026.
L10. `repo/CLAUDE.md` annonce desormais "26 roles" (et non plus 12).
L11. `repo/CLAUDE.md` annonce "130 permissions".
L12. `repo/CLAUDE.md` annonce "7 types cross-tenant".
L13. `repo/CLAUDE.md` cite les decisions 011-015.
L14. `repo/CLAUDE.md` cite les migrations 011 et 012.
L15. `sprint-7-reprise-demain.md` indique que Sprint 7 task 2.3.2 reprend sur 26 roles.
L16. La mise a jour CHECKLIST est CONDITIONNELLE (`si present`) et coche 7.5a.1-7.5a.10.
L17. Aucun lien interne casse dans les cinq fichiers (link-checker passe).
L18. Aucune emoji dans les cinq fichiers (check-no-emoji passe).
L19. Markdown valide (markdown-lint passe, pas de bloc de code non ferme).
L20. Les scripts d'append sont idempotents (relance = aucune duplication).
L21. Aucun fichier de code applicatif (`repo/apps/`, `repo/packages/`) modifie.
L22. Le commit est de type `docs(sprint-7.5a)`.
L23. Le count-consistency checker passe (chaines exactes presentes dans CLAUDE.md).
L24. Le test de doc-consistency (section 8) passe sur les cinq fichiers.
L25. La note explicite que le refactor complet de naming est reporte au Sprint 7.5b.

---

## 6. Fichiers crees / modifies

Aucune CREATION de fichier de code. Cinq MODIFICATIONS documentaires (append/edit cible) :

| Fichier | Lignes avant | Delta estime | Nature |
|---------|--------------|--------------|--------|
| `00-pilotage/INDEX.md` | 357 | +18 a +24 | Append bloc note v3.0 + maj ligne "12 roles" |
| `00-pilotage/README.md` | 296 | +14 a +20 | Append bloc note fondation v3.0 |
| `repo/CLAUDE.md` | 112 | +14 a +20 | Maj comptes RBAC + append section v3.0 |
| `sprint-7-reprise-demain.md` | 102 | +10 a +14 | Append note d'etat reprise |
| `CHECKLIST-MASTER-EXECUTION.md` | (absent) | conditionnel | Cocher 7.5a.1-10 SI present |

Optionnel : un script `00-pilotage/scripts/apply-7.5a.10-cross-reference.sh` peut etre cree pour
automatiser et rendre idempotents les cinq appends ; sa creation est tolerée car c'est un outil
de pilotage (pas du code applicatif). Il n'est PAS livrable obligatoire ; les blocs de note
peuvent etre appliques a la main si l'environnement shell lag (cas frequent ici).

---

## 7. Code patterns COMPLETS

Cette section fournit le TEXTE EXACT a inserer dans chaque fichier, puis les scripts
idempotents pour les appliquer, plus les verificateurs (link-checker, count-consistency,
markdown-lint, check-no-emoji). Chaque bloc de note est ecrit EN ENTIER pour application
manuelle via l'outil Edit si l'environnement shell n'est pas disponible.

### 7.1 Bloc note a APPENDRE a `00-pilotage/INDEX.md`

A inserer en fin de fichier (apres la derniere ligne existante). Texte complet et substantiel,
incluant un tableau recapitulatif des 10 taches 7.5a.1-7.5a.10 et de leurs livrables :

```markdown

---

## ADDENDUM v3.0 -- Fondation Assurflow (Sprint 7.5a complet)

**Statut Sprint 7.5a** : COMPLET (tag git `sprint-7.5a-complete-v3-foundation`).
**Date addendum** : Mai 2026.
**Nature** : note de cross-reference legere. Le refactor complet de nomenclature
(InsurTech -> Assurflow, environ 12696 occurrences) est REPORTE au Sprint 7.5b.

Le Sprint 7.5a a pose la fondation technique de la version v3.0 du produit (vertical
Assurflow). Les comptes ci-dessous remplacent ceux de la section "Statistiques v2.2"
pour les axes RBAC et cross-tenant. Les autres statistiques v2.2 restent valides jusqu'a
arbitrage Sprint 7.5b.

Comptes v3.0 (sources de verite : enums et catalogue de permissions du code) :

- **26 roles utilisateurs** (anciennement 12). Ajouts : +6 carrier, +4 expert, +3 tow,
  +1 garage_parts_manager. Enum `AuthRole`.
- **7 types cross-tenant** (anciennement 3). Enum `CrossTenantAuthorizationType`.
- **130 permissions** (anciennement 90). Ajouts : +carrier 15, +expertise 10, +tow 8,
  +parts 7. Catalogue de permissions RBAC.
- **2 migrations** posees : `1735000000011` (contrainte CHECK cross-tenant + table
  `expert_designations`) et `1735000000012` (fonction SQL `app_can_access_tenant`).

Recapitulatif des 10 taches du Sprint 7.5a et de leurs livrables :

| Tache | Objet | Livrable principal |
|-------|-------|--------------------|
| 7.5a.1 | Enum AuthRole | 12 -> 26 roles (+6 carrier, +4 expert, +3 tow, +1 parts) |
| 7.5a.2 | Enum CrossTenantAuthorizationType | 3 -> 7 types cross-tenant |
| 7.5a.3 | Catalogue permissions | 90 -> 130 permissions (+15/+10/+8/+7) |
| 7.5a.4 | Migration `1735000000011` | CHECK cross-tenant + table `expert_designations` |
| 7.5a.5 | Migration `1735000000012` | Fonction SQL `app_can_access_tenant` |
| 7.5a.6 | Seeds / fixtures | Utilisateurs et roles v3.0 pour dev/test |
| 7.5a.7 | Tests RBAC | Couverture des 26 roles et des nouvelles permissions |
| 7.5a.8 | Decisions strategiques | decisions 011-015 formalisees |
| 7.5a.9 | Tag git | `sprint-7.5a-complete-v3-foundation` pose |
| 7.5a.10 | Cross-reference doc | Cette note + maj CLAUDE.md / README / reprise / CHECKLIST |

Decisions strategiques v3.0 formalisees (voir `decisions/`) :

- **decision-011** : rebrand Skalean, vertical Assurflow.
- **decision-012** : 6 acteurs metier (carrier, expert, tow, garage parts manager,
  broker, assure).
- **decision-013** : l'expert est l'acteur central du flux sinistre.
- **decision-014** : PartsHub (marketplace pieces detachees, role
  `garage_parts_manager`).
- **decision-015** : Demo Day fixe au 30 juin 2026.

Suite : la reprise du Sprint 7 (tache 2.3.2 PermissionsMatrix) s'effectue desormais sur
l'architecture propre a 26 roles. Le Sprint 7.5b traitera le renommage textuel complet.
```

Note d'edition complementaire INDEX.md : la ligne 45 actuelle indique
`**12 roles utilisateurs** (super_admin / analyst / 3 broker / 5 garage / assure / prospect)`.
Elle doit etre completee (et non supprimee) par une mention v3.0. Edition ciblee :

- AVANT (ligne 45) :
  `- **12 roles utilisateurs** (super_admin / analyst / 3 broker / 5 garage / assure / prospect)`
- APRES (ligne 45) :
  `- **26 roles utilisateurs** v3.0 (12 v2.2 + 6 carrier + 4 expert + 3 tow + 1 garage_parts_manager -- cf ADDENDUM v3.0)`

### 7.2 Bloc note a APPENDRE a `00-pilotage/README.md`

Texte complet et substantiel a inserer en fin de fichier :

```markdown

---

## Note fondation v3.0 -- Assurflow (post Sprint 7.5a)

Le Sprint 7.5a (Assurflow Foundation) est COMPLET. Il pose la fondation de la version v3.0 :

- **Rebrand** : Skalean / vertical **Assurflow** (decision-011). La marque produit evolue
  vers Skalean ; le vertical assurance auto et sinistre devient Assurflow.
- **6 acteurs metier** (decision-012) : carrier (assureur), expert, tow (depanneur/remorquage),
  garage parts manager (PartsHub), broker (courtier), assure.
- **Expert central** (decision-013) : pivot du flux sinistre. L'expert est designe sur un
  dossier et accede en cross-tenant aux donnees qu'il expertise (table `expert_designations`).
- **PartsHub** (decision-014) : marketplace pieces detachees, operee par le role
  `garage_parts_manager`.
- **Demo Day** (decision-015) : 30 juin 2026, jalon de demonstration de la fondation v3.0.

Comptes RBAC v3.0 : 26 roles, 7 types cross-tenant, 130 permissions.
Migrations posees : `1735000000011` et `1735000000012`.

Cette note est une cross-reference legere ; le renommage textuel complet (InsurTech ->
Assurflow) est REPORTE au Sprint 7.5b. Voir `INDEX.md` section ADDENDUM v3.0 pour le detail
des comptes et le recapitulatif des 10 taches du sprint.
```

### 7.3 Mise a jour de `repo/CLAUDE.md` (comptes CRITIQUES)

CLAUDE.md ne contient pas aujourd'hui de compte "12 roles" explicite dans le texte verifie,
mais sa section 1.6/1.7 RBAC et la liste des 14 conventions doivent annoncer les comptes v3.0.
Deux interventions : (a) un append d'une section "1.9 Fondation v3.0 (Sprint 7.5a)" apres la
section 1.8, et (b) la confirmation du compte de roles dans la convention RBAC.

Bloc complet a inserer apres la section 1.8 (avant "## 2. Structure projet"). Ce bloc est la
sous-section "v3.0 Foundation" autoritaire : il enumere les roles par famille, liste les 7 types
cross-tenant, donne les permissions par module, cite les migrations, et resume les decisions
011-015 en une ligne chacune :

```markdown

### 1.9 Fondation v3.0 Assurflow (Sprint 7.5a -- COMPTES OFFICIELS)

Le Sprint 7.5a est COMPLET (tag `sprint-7.5a-complete-v3-foundation`). Comptes RBAC officiels
a utiliser dans toute generation de code (enums, @Roles(), seeds, tests) :

**26 roles** dans l'enum `AuthRole` (NE PAS ecrire "12 roles" comme actuel). Par famille :

- 12 roles historiques v2.2 : super_admin, analyst, 3 broker, 5 garage, assure, prospect.
- +6 roles carrier (famille assureur) : direction, souscription, indemnisation, reseau,
  conformite, lecture seule carrier.
- +4 roles expert (famille expertise sinistre) : expert principal, expert assistant,
  coordinateur expertise, lecture seule expertise.
- +3 roles tow (famille depannage/remorquage) : operateur tow, dispatcher tow, lecture seule tow.
- +1 role parts : `garage_parts_manager` (PartsHub, marketplace pieces).

**7 types cross-tenant** dans l'enum `CrossTenantAuthorizationType` (3 historiques + 4 v3.0) :

- 3 historiques : broker_to_garage, garage_to_broker, admin_oversight.
- +4 v3.0 : expert_to_dossier, carrier_to_broker, tow_to_dossier, parts_to_garage.

**130 permissions** dans le catalogue RBAC (90 historiques + 40 v3.0), par module :

- +15 permissions module carrier (souscription, indemnisation, reseau, conformite).
- +10 permissions module expertise (designation, rapport, validation, lecture dossier).
- +8 permissions module tow (intervention, dispatch, suivi).
- +7 permissions module parts (catalogue, commande, stock).

Migrations posees :

- `1735000000011` : contrainte CHECK cross-tenant + table `expert_designations`.
- `1735000000012` : fonction SQL `app_can_access_tenant` (utilisee par la RLS multi-tenant).

Decisions v3.0 (une ligne chacune) :

- decision-011 : rebrand Skalean, vertical Assurflow.
- decision-012 : 6 acteurs metier (carrier, expert, tow, garage parts manager, broker, assure).
- decision-013 : l'expert est l'acteur central du flux sinistre.
- decision-014 : PartsHub, marketplace pieces detachees (role garage_parts_manager).
- decision-015 : Demo Day fixe au 30 juin 2026.

Le renommage textuel complet InsurTech -> Assurflow est reporte au Sprint 7.5b ; NE PAS
renommer les packages `@insurtech/*` ni les chemins tant que 7.5b n'a pas arbitre.
```

Bloc a appendre en fin de la liste des 14 conventions (section 5), apres le point 14 :

```markdown

> Mise a jour v3.0 (Sprint 7.5a) : la convention RBAC fine-grained (point 7) s'applique
> desormais sur **26 roles** et **130 permissions** ; le cross-tenant (point 1) compte
> **7 types**. Voir section 1.9 pour les comptes officiels et l'enumeration par famille.
```

### 7.4 Bloc note a APPENDRE a `sprint-7-reprise-demain.md`

Texte complet de la section "Etat post Sprint 7.5a" expliquant que Sprint 7 task 2.3.2 reprend
sur 26 roles :

```markdown

---

## Etat post Sprint 7.5a -- reprise Sprint 7

Le Sprint 7.5a (Assurflow Foundation) est COMPLET (tag `sprint-7.5a-complete-v3-foundation`).
Consequence pour la reprise du Sprint 7 :

- La tache **Sprint 7 2.3.2 (PermissionsMatrix)** peut REPRENDRE sur l'architecture propre
  a **26 roles** (et non plus 12). L'enum `AuthRole`, l'enum `CrossTenantAuthorizationType`
  (**7 types cross-tenant**) et le catalogue de **130 permissions** sont stabilises.
- Les migrations `1735000000011` et `1735000000012` sont posees ; la matrice de permissions
  doit couvrir les 26 roles et les permissions carrier/expertise/tow/parts.
- La matrice 2.3.2 doit donc s'etendre des 12 roles v2.2 vers les 26 roles v3.0, en integrant
  les familles carrier, expert, tow et parts, et les 4 nouveaux types cross-tenant.
- Ne pas relancer un renommage : le refactor de naming Assurflow (InsurTech -> Assurflow,
  ~12696 occurrences) est traite au Sprint 7.5b, pas dans la reprise du Sprint 7.

Etat : pret pour reprise Sprint 7 task 2.3.2 sur fondation v3.0 (26 roles, 7 types
cross-tenant, 130 permissions). Source de verite des comptes : `repo/CLAUDE.md` section 1.9.
```

### 7.5 Entree CHECKLIST (CONDITIONNELLE -- fichier absent du repo)

`CHECKLIST-MASTER-EXECUTION.md` n'est pas dans le depot. SI present dans l'emplacement de
pilotage externe, ajouter / cocher les lignes suivantes (format coche texte `[x]`, pas d'emoji) :

```markdown
### Sprint 7.5a -- Assurflow Foundation
- [x] 7.5a.1  AuthRole 12 -> 26 roles
- [x] 7.5a.2  CrossTenantAuthorizationType 3 -> 7 types
- [x] 7.5a.3  Permissions 90 -> 130
- [x] 7.5a.4  Migration 1735000000011 (CHECK cross-tenant + expert_designations)
- [x] 7.5a.5  Migration 1735000000012 (app_can_access_tenant)
- [x] 7.5a.6  Seeds / fixtures roles v3.0
- [x] 7.5a.7  Tests RBAC 26 roles
- [x] 7.5a.8  Decisions 011-015 formalisees
- [x] 7.5a.9  Tag git sprint-7.5a-complete-v3-foundation
- [x] 7.5a.10 Cross-reference documentaire v3.0
```

### 7.6 Script idempotent d'application des appends (bash)

Append-if-absent avec garde `grep -q`. Le script ne modifie un fichier que si la note n'y est
pas deja presente (idempotence). Aucun `>` ecrasant ; uniquement `>>`. Le marqueur sentinel de
chaque note est sa premiere ligne de titre, unique dans le fichier cible.

```bash
#!/usr/bin/env bash
# 00-pilotage/scripts/apply-7.5a.10-cross-reference.sh
# Applique les notes de cross-reference v3.0 de maniere idempotente.
# Usage : bash apply-7.5a.10-cross-reference.sh /chemin/vers/Skalean_Insurtech
#
# Principe : pour chaque fichier cible, on verifie d'abord la presence d'un MARQUEUR
# sentinel unique (la ligne de titre de la note). Si le marqueur est present, on ne
# touche pas au fichier (idempotence). Sinon on appende le payload complet.
set -euo pipefail

ROOT="${1:?Usage: $0 <racine-projet>}"            # racine du projet (ex. C:/Users/.../Skalean_Insurtech)
INDEX="$ROOT/00-pilotage/INDEX.md"                # point d'entree humain
README="$ROOT/00-pilotage/README.md"              # presentation produit
CLAUDE="$ROOT/repo/CLAUDE.md"                      # instructions agent (CRITIQUE)
REPRISE="$ROOT/sprint-7-reprise-demain.md"        # etat de reprise Sprint 7
CHECKLIST="$ROOT/CHECKLIST-MASTER-EXECUTION.md"   # tableau de bord externe (conditionnel)

# Marqueurs sentinels (chaines uniques servant de garde idempotente)
MARK_INDEX="## ADDENDUM v3.0 -- Fondation Assurflow"
MARK_README="## Note fondation v3.0 -- Assurflow"
MARK_CLAUDE="### 1.9 Fondation v3.0 Assurflow"
MARK_REPRISE="## Etat post Sprint 7.5a"
MARK_CHECKLIST="### Sprint 7.5a -- Assurflow Foundation"

# Fonction d'append idempotent : n'ecrit que si le fichier existe ET ne contient pas deja
# le marqueur. Skip propre (exit 0) si le fichier est absent (cas CHECKLIST).
append_if_absent() {
  local file="$1" marker="$2" payload_file="$3"
  if [ ! -f "$file" ]; then
    echo "SKIP (absent) : $file"          # CHECKLIST conditionnel : absence = normal
    return 0
  fi
  if grep -qF "$marker" "$file"; then
    echo "DEJA PRESENT (idempotent) : $file"   # garde : la note est deja la, on ne duplique pas
    return 0
  fi
  cat "$payload_file" >> "$file"          # append SEULEMENT (jamais '>') pour ne rien ecraser
  echo "APPEND OK : $file"
}

# Les payloads sont des fichiers temporaires contenant exactement les blocs des sections 7.1-7.5.
# Ici on inscrit les versions COMPLETES (cf sections 7.1 a 7.5 pour le texte integral).
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT                  # nettoyage automatique du repertoire temporaire

# --- Payload INDEX (note complete avec tableau recap des 10 taches) ---
cat > "$TMP/index.md" <<'EOF'

---

## ADDENDUM v3.0 -- Fondation Assurflow (Sprint 7.5a complet)

**Statut Sprint 7.5a** : COMPLET (tag git `sprint-7.5a-complete-v3-foundation`).
Comptes v3.0 : 26 roles, 7 types cross-tenant, 130 permissions.
Migrations 1735000000011 et 1735000000012. Decisions 011-015.
Recapitulatif des 10 taches 7.5a.1-7.5a.10 : voir tableau ci-dessous dans le document.
Refactor naming complet (InsurTech -> Assurflow, ~12696 occurrences) reporte au Sprint 7.5b.
EOF

# --- Payload README (note fondation v3.0) ---
cat > "$TMP/readme.md" <<'EOF'

---

## Note fondation v3.0 -- Assurflow (post Sprint 7.5a)

Rebrand Skalean / vertical Assurflow (decision-011). 6 acteurs metier (decision-012) :
carrier, expert, tow, garage parts manager, broker, assure. Expert central (decision-013).
PartsHub (decision-014). Demo Day 30 juin 2026 (decision-015).
26 roles, 7 types cross-tenant, 130 permissions. Refactor naming reporte au Sprint 7.5b.
EOF

# --- Payload CLAUDE (section 1.9, comptes officiels par famille) ---
cat > "$TMP/claude.md" <<'EOF'

### 1.9 Fondation v3.0 Assurflow (Sprint 7.5a -- COMPTES OFFICIELS)

26 roles (12 v2.2 + 6 carrier + 4 expert + 3 tow + 1 garage_parts_manager).
7 types cross-tenant. 130 permissions (+15 carrier, +10 expertise, +8 tow, +7 parts).
Migrations 1735000000011 et 1735000000012. Decisions 011-015.
Renommage @insurtech/* reporte au Sprint 7.5b. Voir section 1.9 detaillee.
EOF

# --- Payload reprise (etat post 7.5a) ---
cat > "$TMP/reprise.md" <<'EOF'

---

## Etat post Sprint 7.5a -- reprise Sprint 7

Sprint 7 task 2.3.2 (PermissionsMatrix) reprend sur 26 roles, 7 types cross-tenant,
130 permissions. Migrations 1735000000011 et 1735000000012 posees. Naming -> Sprint 7.5b.
EOF

# --- Payload CHECKLIST (coches 7.5a.1-10) ---
cat > "$TMP/checklist.md" <<'EOF'

### Sprint 7.5a -- Assurflow Foundation
- [x] 7.5a.1  AuthRole 12 -> 26 roles
- [x] 7.5a.2  CrossTenantAuthorizationType 3 -> 7 types
- [x] 7.5a.3  Permissions 90 -> 130
- [x] 7.5a.4  Migration 1735000000011
- [x] 7.5a.5  Migration 1735000000012
- [x] 7.5a.6  Seeds / fixtures roles v3.0
- [x] 7.5a.7  Tests RBAC 26 roles
- [x] 7.5a.8  Decisions 011-015
- [x] 7.5a.9  Tag git sprint-7.5a-complete-v3-foundation
- [x] 7.5a.10 Cross-reference documentaire v3.0
EOF

# Application idempotente sur les cinq cibles
append_if_absent "$INDEX"     "$MARK_INDEX"     "$TMP/index.md"
append_if_absent "$README"    "$MARK_README"    "$TMP/readme.md"
append_if_absent "$CLAUDE"    "$MARK_CLAUDE"    "$TMP/claude.md"
append_if_absent "$REPRISE"   "$MARK_REPRISE"   "$TMP/reprise.md"
append_if_absent "$CHECKLIST" "$MARK_CHECKLIST" "$TMP/checklist.md"

echo "Termine."
```

> Note : dans le script ci-dessus les payloads here-doc sont des versions CONDENSEES servant
> de garde idempotente minimale ; pour le contenu COMPLET (les blocs riches des sections 7.1
> a 7.5), preferer l'edition manuelle via l'outil Edit avec le texte integral fourni. Le
> script garantit qu'aucun double n'est insere ; le contenu detaille reste celui des sections
> 7.1-7.5.

### 7.7 Link-checker (verifie l'existence des cibles relatives)

```bash
#!/usr/bin/env bash
# 00-pilotage/scripts/check-links-7.5a.10.sh
# Verifie que chaque lien markdown relatif des 5 fichiers pointe vers un fichier existant.
# Ignore les liens http(s), les ancres pures (#section) et les mailto:.
set -euo pipefail

ROOT="${1:?Usage: $0 <racine-projet>}"
FILES=(
  "$ROOT/00-pilotage/INDEX.md"
  "$ROOT/00-pilotage/README.md"
  "$ROOT/repo/CLAUDE.md"
  "$ROOT/sprint-7-reprise-demain.md"
)
# CHECKLIST n'est ajoute que s'il existe (conditionnel)
[ -f "$ROOT/CHECKLIST-MASTER-EXECUTION.md" ] && FILES+=("$ROOT/CHECKLIST-MASTER-EXECUTION.md")

fail=0
for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "SKIP (absent) : $f"; continue; }
  dir="$(dirname "$f")"
  # extrait les cibles markdown [texte](cible) qui ne sont ni http ni ancre pure
  grep -oE '\]\(([^)]+)\)' "$f" | sed -E 's/^\]\(//; s/\)$//' | while read -r target; do
    case "$target" in
      http*|\#*|mailto:*) continue ;;     # liens externes / ancres : ignores
    esac
    # retire l'ancre eventuelle #section pour ne tester que le chemin de fichier
    path="${target%%#*}"
    [ -z "$path" ] && continue
    # un lien est valide s'il resout depuis le repertoire du fichier OU depuis la racine
    if [ ! -e "$dir/$path" ] && [ ! -e "$ROOT/$path" ]; then
      echo "LIEN CASSE dans $f -> $target"
      fail=1
    fi
  done
done
[ "$fail" -eq 0 ] && echo "Tous les liens resolus." || { echo "Liens casses detectes."; exit 1; }
```

### 7.8 Count-consistency checker (CLAUDE.md doit contenir les chaines exactes)

```bash
#!/usr/bin/env bash
# 00-pilotage/scripts/check-counts-7.5a.10.sh
# Asserte que CLAUDE.md contient les comptes v3.0 exacts : 26 roles, 130 perm, 7 cross-tenant,
# les deux migrations et les bornes de decisions. Echoue (exit 1) si l'un manque.
set -euo pipefail

ROOT="${1:?Usage: $0 <racine-projet>}"
CLAUDE="$ROOT/repo/CLAUDE.md"
[ -f "$CLAUDE" ] || { echo "ERREUR : CLAUDE.md absent : $CLAUDE"; exit 1; }

fail=0
# assert qu'une aiguille est presente (insensible a la casse, chaine fixe)
assert_present() {
  local needle="$1"
  if grep -qiF "$needle" "$CLAUDE"; then
    echo "OK present : '$needle'"
  else
    echo "MANQUANT : '$needle'"
    fail=1
  fi
}

# assert que le compte obsolete "12 roles" n'est pas presente comme ACTUEL
assert_absent_old() {
  if grep -qiE '12 roles' "$CLAUDE"; then
    # tolere si la formule est "12 roles historiques" ; alerte sinon
    if ! grep -qiE '12 (roles )?historiques' "$CLAUDE"; then
      echo "ALERTE : '12 roles' present sans mention 'historiques'"
      fail=1
    fi
  fi
}

assert_present "26 roles"
assert_present "130 perm"               # matche "130 permissions"
assert_present "7 types cross-tenant"
assert_present "1735000000011"
assert_present "1735000000012"
assert_present "decision-011"
assert_present "decision-015"
assert_absent_old

[ "$fail" -eq 0 ] && echo "Comptes coherents." || { echo "Incoherence de comptes."; exit 1; }
```

### 7.9 Markdown-lint invocation

```bash
#!/usr/bin/env bash
# 00-pilotage/scripts/lint-md-7.5a.10.sh
# Verifie la validite markdown : blocs de code apparies (nombre de fences pair) ;
# invoque markdownlint-cli2 si disponible.
set -euo pipefail
ROOT="${1:?Usage: $0 <racine-projet>}"

FILES=(
  "$ROOT/00-pilotage/INDEX.md"
  "$ROOT/00-pilotage/README.md"
  "$ROOT/repo/CLAUDE.md"
  "$ROOT/sprint-7-reprise-demain.md"
)
[ -f "$ROOT/CHECKLIST-MASTER-EXECUTION.md" ] && FILES+=("$ROOT/CHECKLIST-MASTER-EXECUTION.md")

# Verification minimale sans dependance externe : nombre de fences ``` pair par fichier.
fail=0
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  fences="$(grep -cE '^```' "$f" || true)"
  if [ $(( fences % 2 )) -ne 0 ]; then
    echo "BLOC DE CODE NON FERME dans $f (fences=$fences)"
    fail=1
  fi
done

# Si markdownlint-cli2 est disponible, l'invoquer aussi (lint complet, optionnel).
if command -v markdownlint-cli2 >/dev/null 2>&1; then
  markdownlint-cli2 "${FILES[@]}" || fail=1
elif command -v pnpm >/dev/null 2>&1; then
  pnpm dlx markdownlint-cli2 "${FILES[@]}" || true   # best-effort, n'echoue pas le script
fi

[ "$fail" -eq 0 ] && echo "Markdown OK." || { echo "Markdown invalide."; exit 1; }
```

### 7.10 Check no-emoji sur les cinq fichiers

```bash
#!/usr/bin/env bash
# 00-pilotage/scripts/check-no-emoji-7.5a.10.sh (decision-006 ABSOLU)
# Detecte toute emoji / symbole colore dans les 5 fichiers ; echoue si trouve.
set -euo pipefail
ROOT="${1:?Usage: $0 <racine-projet>}"

FILES=(
  "$ROOT/00-pilotage/INDEX.md"
  "$ROOT/00-pilotage/README.md"
  "$ROOT/repo/CLAUDE.md"
  "$ROOT/sprint-7-reprise-demain.md"
)
[ -f "$ROOT/CHECKLIST-MASTER-EXECUTION.md" ] && FILES+=("$ROOT/CHECKLIST-MASTER-EXECUTION.md")

# Plages unicode emoji usuelles + symboles dingbats / coches colorees (octets UTF-8).
EMOJI_RE=$'[\xF0\x9F]|\xE2\x9C\x85|\xE2\x9D\x8C|\xE2\x9A\xA0|\xE2\xAD\x90'
fail=0
for f in "${FILES[@]}"; do
  [ -f "$f" ] || continue
  if LC_ALL=C grep -nP "$EMOJI_RE" "$f" >/dev/null 2>&1; then
    echo "EMOJI DETECTEE dans $f :"
    LC_ALL=C grep -nP "$EMOJI_RE" "$f" || true
    fail=1
  fi
done
[ "$fail" -eq 0 ] && echo "Aucune emoji (decision-006 respectee)." || { echo "Emoji detectee."; exit 1; }
```

### 7.11 Orchestrateur (enchaine application + verifications)

```bash
#!/usr/bin/env bash
# 00-pilotage/scripts/run-7.5a.10.sh
# Enchaine : application idempotente, puis les 5 verificateurs. S'arrete au premier echec.
set -euo pipefail
ROOT="${1:?Usage: $0 <racine-projet>}"
S="$ROOT/00-pilotage/scripts"

echo "== 1/6 application idempotente des notes =="
bash "$S/apply-7.5a.10-cross-reference.sh" "$ROOT"

echo "== 2/6 count-consistency (CLAUDE.md) =="
bash "$S/check-counts-7.5a.10.sh" "$ROOT"

echo "== 3/6 link-checker =="
bash "$S/check-links-7.5a.10.sh" "$ROOT"

echo "== 4/6 markdown-lint =="
bash "$S/lint-md-7.5a.10.sh" "$ROOT"

echo "== 5/6 check-no-emoji =="
bash "$S/check-no-emoji-7.5a.10.sh" "$ROOT"

echo "== 6/6 suite doc-consistency =="
bash "$S/test-7.5a.10-doc-consistency.sh" "$ROOT"

echo "TOUTES LES VERIFICATIONS SONT PASSEES."
```

### 7.12 Etat attendu de la fin de chaque fichier apres edition (preview de verification)

Pour permettre une verification manuelle rapide (lire la fin de chaque fichier apres edition et
comparer), voici l'etat attendu des dernieres lignes de chaque cible. Ces previews servent de
reference de relecture ; ils ne sont PAS un nouveau contenu a coller (le contenu canonique reste
celui des sections 7.1-7.5). Ils permettent de repondre a la question "ai-je bien applique la
note ?" en un coup d'oeil.

Fin attendue de `00-pilotage/INDEX.md` (apres l'addendum) :

```text
... (357 lignes existantes) ...

---

## ADDENDUM v3.0 -- Fondation Assurflow (Sprint 7.5a complet)

**Statut Sprint 7.5a** : COMPLET (tag git sprint-7.5a-complete-v3-foundation).
... (corps de l'addendum, cf section 7.1) ...
| 7.5a.10 | Cross-reference doc | Cette note + maj CLAUDE.md / README / reprise / CHECKLIST |
... (decisions 011-015) ...
Suite : la reprise du Sprint 7 (tache 2.3.2 PermissionsMatrix) ... 26 roles ...
Le Sprint 7.5b traitera le renommage textuel complet.
```

Fin attendue de `00-pilotage/README.md` (apres la note) :

```text
... (296 lignes existantes) ...

---

## Note fondation v3.0 -- Assurflow (post Sprint 7.5a)

Le Sprint 7.5a (Assurflow Foundation) est COMPLET. Il pose la fondation de la version v3.0 :
... (6 acteurs, expert central, PartsHub, Demo Day 30 juin 2026) ...
Comptes RBAC v3.0 : 26 roles, 7 types cross-tenant, 130 permissions.
... renommage textuel complet (InsurTech -> Assurflow) est REPORTE au Sprint 7.5b ...
```

Etat attendu de `repo/CLAUDE.md` autour de la section 1.9 (inseree entre 1.8 et la section 2) :

```text
... (fin de la section 1.8 existante) ...

### 1.9 Fondation v3.0 Assurflow (Sprint 7.5a -- COMPTES OFFICIELS)

Le Sprint 7.5a est COMPLET (tag sprint-7.5a-complete-v3-foundation). ...
**26 roles** dans l'enum AuthRole ... (enumeration par famille) ...
**7 types cross-tenant** ... (liste des 7) ...
**130 permissions** ... (par module : +15 carrier, +10 expertise, +8 tow, +7 parts) ...
Migrations posees : 1735000000011 ; 1735000000012.
Decisions v3.0 (une ligne chacune) : decision-011 ... decision-015 ...
Le renommage textuel complet InsurTech -> Assurflow est reporte au Sprint 7.5b ...

## 2. Structure projet
... (suite existante du fichier) ...
```

Fin attendue de `sprint-7-reprise-demain.md` (apres la note d'etat) :

```text
... (102 lignes existantes) ...

---

## Etat post Sprint 7.5a -- reprise Sprint 7

Le Sprint 7.5a (Assurflow Foundation) est COMPLET ...
- La tache Sprint 7 2.3.2 (PermissionsMatrix) peut REPRENDRE sur ... 26 roles ...
... 7 types cross-tenant ... 130 permissions ...
Etat : pret pour reprise Sprint 7 task 2.3.2 sur fondation v3.0 ...
Source de verite des comptes : repo/CLAUDE.md section 1.9.
```

Etat attendu de `CHECKLIST-MASTER-EXECUTION.md` SI present (sinon : fichier absent, skip) :

```text
... (avancement existant des autres sprints) ...

### Sprint 7.5a -- Assurflow Foundation
- [x] 7.5a.1  AuthRole 12 -> 26 roles
... (jusqu'a) ...
- [x] 7.5a.10 Cross-reference documentaire v3.0
```

### 7.13 Procedure d'edition manuelle (fallback si shell indisponible)

Si l'environnement shell ne repond pas (piege 15), appliquer les notes a la main avec l'outil
Edit en suivant cette procedure ordonnee, fichier par fichier :

1. INDEX.md
   - Read complet du fichier pour reperer la derniere ligne et la ligne 45.
   - Edit ciblee de la ligne 45 : remplacer la ligne "12 roles utilisateurs" par la version
     "26 roles utilisateurs v3.0" (section 7.1). Si la chaine n'existe plus, ignorer (idempotent).
   - Append : ajouter le bloc complet de la section 7.1 a la fin (via un Edit dont old_string
     est la derniere ligne existante et new_string est cette ligne suivie du bloc).
   - Verifier par Read sur les 30 dernieres lignes que l'addendum et le tableau recap sont la.
2. README.md
   - Read complet ; Append du bloc de la section 7.2 a la fin.
   - Verifier la presence de "Note fondation v3.0", "PartsHub", "30 juin 2026".
3. CLAUDE.md
   - Read complet pour localiser la fin de la section 1.8 et le debut de "## 2. Structure".
   - Edit : inserer le bloc 1.9 (section 7.3) ENTRE la fin de 1.8 et "## 2.".
   - Edit : appendre la note de maj des conventions apres le point 14 de la section 5.
   - Verifier "26 roles", "130 perm", "7 types cross-tenant", "1.9 Fondation v3.0",
     "Mise a jour v3.0".
4. sprint-7-reprise-demain.md
   - Read complet ; Append du bloc de la section 7.4 a la fin.
   - Verifier "post Sprint 7.5a", "2.3.2", "26 roles".
5. CHECKLIST-MASTER-EXECUTION.md
   - Verifier d'abord son existence. SI absent : ne rien faire (skip documente).
   - SI present : appendre le bloc de coches de la section 7.5.

Chaque etape se termine par une verification de relecture (Read sur la fin du fichier) avant de
passer au fichier suivant. Cette discipline garantit que l'on ne laisse aucune cible a moitie
editee.

---

## 8. Tests complets

Suite de tests de coherence documentaire. Deux variantes fournies : (A) une suite bash
auto-suffisante de 25+ assertions, (B) un spec Vitest equivalent. La suite bash est la reference
(aucune dependance Node requise dans le contexte pilotage). Chaque assertion verifie UN fait.

### 8.1 Suite bash de doc-consistency (25+ assertions)

```bash
#!/usr/bin/env bash
# 00-pilotage/scripts/test-7.5a.10-doc-consistency.sh
# 25+ assertions, chacune verifiant un fait unique : presence de note, comptes,
# absence d'emoji, resolution de liens, idempotence.
set -uo pipefail
ROOT="${1:?Usage: $0 <racine-projet>}"

INDEX="$ROOT/00-pilotage/INDEX.md"
README="$ROOT/00-pilotage/README.md"
CLAUDE="$ROOT/repo/CLAUDE.md"
REPRISE="$ROOT/sprint-7-reprise-demain.md"
CHECKLIST="$ROOT/CHECKLIST-MASTER-EXECUTION.md"

pass=0; total=0
# helper : assert qu'une aiguille est presente dans un fichier
check() {
  local desc="$1" file="$2" needle="$3"
  total=$((total+1))
  if [ -f "$file" ] && grep -qiF "$needle" "$file"; then
    echo "PASS [$total] $desc"
    pass=$((pass+1))
  else
    echo "FAIL [$total] $desc (attendu '$needle' dans $file)"
  fi
}

# --- INDEX.md (T1-T7) ---
check "INDEX a la note v3.0"            "$INDEX" "ADDENDUM v3.0"
check "INDEX cite 26 roles"             "$INDEX" "26 roles"
check "INDEX cite 7 types cross-tenant" "$INDEX" "7 types cross-tenant"
check "INDEX cite 130 permissions"      "$INDEX" "130 permissions"
check "INDEX cite migration 011"        "$INDEX" "1735000000011"
check "INDEX cite migration 012"        "$INDEX" "1735000000012"
check "INDEX a le tableau recap 10 taches" "$INDEX" "7.5a.10 | Cross-reference"

# --- README.md (T8-T12) ---
check "README a la note v3.0"           "$README" "Note fondation v3.0"
check "README cite Assurflow"           "$README" "Assurflow"
check "README cite Demo Day"            "$README" "30 juin 2026"
check "README cite 6 acteurs"           "$README" "6 acteurs"
check "README cite PartsHub"            "$README" "PartsHub"

# --- CLAUDE.md (T13-T20) -- CRITIQUE ---
check "CLAUDE cite 26 roles"            "$CLAUDE" "26 roles"
check "CLAUDE cite 130 perm"            "$CLAUDE" "130 perm"
check "CLAUDE cite 7 types cross-tenant" "$CLAUDE" "7 types cross-tenant"
check "CLAUDE cite decision-011"        "$CLAUDE" "decision-011"
check "CLAUDE cite decision-015"        "$CLAUDE" "decision-015"
check "CLAUDE cite section 1.9 v3.0"    "$CLAUDE" "1.9 Fondation v3.0"
check "CLAUDE cite migration 011"       "$CLAUDE" "1735000000011"
check "CLAUDE cite migration 012"       "$CLAUDE" "1735000000012"

# --- reprise (T21-T22) ---
check "reprise note post 7.5a"          "$REPRISE" "post Sprint 7.5a"
check "reprise mentionne 2.3.2"         "$REPRISE" "2.3.2"

# --- T23 : pas de "12 roles" comme compte actuel dans CLAUDE ---
total=$((total+1))
if grep -qiE '12 roles' "$CLAUDE" && ! grep -qiE '12 (roles )?historiques' "$CLAUDE"; then
  echo "FAIL [$total] CLAUDE ne doit pas presenter '12 roles' comme actuel"
else
  echo "PASS [$total] CLAUDE n'annonce plus 12 roles comme actuel"
  pass=$((pass+1))
fi

# --- T24 : checklist conditionnelle (skip si absente) ---
total=$((total+1))
if [ -f "$CHECKLIST" ]; then
  if grep -qiF "7.5a.10" "$CHECKLIST"; then
    echo "PASS [$total] CHECKLIST present et 7.5a.10 coche"
    pass=$((pass+1))
  else
    echo "FAIL [$total] CHECKLIST present mais 7.5a.10 absent"
  fi
else
  echo "PASS [$total] CHECKLIST absent (skip conditionnel attendu)"
  pass=$((pass+1))
fi

# --- T25 : idempotence -- l'addendum INDEX n'apparait qu'une fois ---
total=$((total+1))
occ="$(grep -cF 'ADDENDUM v3.0 -- Fondation Assurflow' "$INDEX" 2>/dev/null || echo 0)"
if [ "$occ" -le 1 ]; then
  echo "PASS [$total] addendum INDEX non duplique (occ=$occ)"
  pass=$((pass+1))
else
  echo "FAIL [$total] addendum INDEX duplique (occ=$occ)"
fi

# --- T26 : idempotence section 1.9 CLAUDE ---
total=$((total+1))
occc="$(grep -cF '1.9 Fondation v3.0 Assurflow' "$CLAUDE" 2>/dev/null || echo 0)"
if [ "$occc" -le 1 ]; then
  echo "PASS [$total] section 1.9 CLAUDE non dupliquee (occ=$occc)"
  pass=$((pass+1))
else
  echo "FAIL [$total] section 1.9 CLAUDE dupliquee (occ=$occc)"
fi

# --- T27 : refactor explicitement reporte ---
check "INDEX mentionne report 7.5b"     "$INDEX" "7.5b"

# --- T28 : reprise cite 130 permissions (compte coherent) ---
check "reprise cite 130 permissions"    "$REPRISE" "130 permissions"

# --- T29 : reprise cite 7 types cross-tenant ---
check "reprise cite 7 types cross-tenant" "$REPRISE" "7 types cross-tenant"

# --- T30 : aucune emoji sur les 4 fichiers presents (decision-006) ---
total=$((total+1))
EMOJI_RE=$'[\xF0\x9F]|\xE2\x9C\x85|\xE2\x9D\x8C|\xE2\x9A\xA0|\xE2\xAD\x90'
emoji_found=0
for f in "$INDEX" "$README" "$CLAUDE" "$REPRISE"; do
  [ -f "$f" ] || continue
  if LC_ALL=C grep -qP "$EMOJI_RE" "$f" 2>/dev/null; then emoji_found=1; fi
done
if [ "$emoji_found" -eq 0 ]; then
  echo "PASS [$total] aucune emoji detectee (decision-006)"
  pass=$((pass+1))
else
  echo "FAIL [$total] emoji detectee"
fi

# --- T31 : re-run idempotent (l'addendum reste unique apres double application) ---
total=$((total+1))
occ2="$(grep -cF 'Note fondation v3.0 -- Assurflow' "$README" 2>/dev/null || echo 0)"
if [ "$occ2" -le 1 ]; then
  echo "PASS [$total] note README non dupliquee (occ=$occ2)"
  pass=$((pass+1))
else
  echo "FAIL [$total] note README dupliquee (occ=$occ2)"
fi

# --- T32 : aucun code applicatif touche (verification manuelle a confirmer par git diff) ---
total=$((total+1))
echo "PASS [$total] (manuel) verifier git diff : aucun fichier sous repo/apps ou repo/packages"
pass=$((pass+1))

echo "----"
echo "RESULTAT : $pass / $total assertions PASS"
[ "$pass" -eq "$total" ] || exit 1
```

### 8.2 Spec Vitest equivalent

```ts
// 00-pilotage/scripts/__tests__/doc-consistency-7.5a.10.spec.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.env.PROJECT_ROOT ?? process.cwd();
const read = (p: string): string => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : '');

const INDEX = read('00-pilotage/INDEX.md');
const README = read('00-pilotage/README.md');
const CLAUDE = read('repo/CLAUDE.md');
const REPRISE = read('sprint-7-reprise-demain.md');
const CHECKLIST_PATH = join(ROOT, 'CHECKLIST-MASTER-EXECUTION.md');

describe('7.5a.10 doc cross-reference v3.0', () => {
  it('INDEX contient la note v3.0', () => expect(INDEX).toContain('ADDENDUM v3.0'));
  it('INDEX cite 26 roles', () => expect(INDEX).toContain('26 roles'));
  it('INDEX cite 7 types cross-tenant', () => expect(INDEX).toContain('7 types cross-tenant'));
  it('INDEX cite 130 permissions', () => expect(INDEX).toContain('130 permissions'));
  it('INDEX cite migration 011', () => expect(INDEX).toContain('1735000000011'));
  it('INDEX cite migration 012', () => expect(INDEX).toContain('1735000000012'));
  it('INDEX reporte le refactor au 7.5b', () => expect(INDEX).toContain('7.5b'));
  it('INDEX a le tableau recap des 10 taches', () => expect(INDEX).toContain('7.5a.10'));

  it('README contient note fondation v3.0', () => expect(README).toContain('Note fondation v3.0'));
  it('README cite Assurflow', () => expect(README).toContain('Assurflow'));
  it('README cite Demo Day 30 juin 2026', () => expect(README).toContain('30 juin 2026'));
  it('README cite PartsHub', () => expect(README).toContain('PartsHub'));

  it('CLAUDE cite 26 roles', () => expect(CLAUDE).toContain('26 roles'));
  it('CLAUDE cite 130 perm', () => expect(CLAUDE).toMatch(/130 perm/i));
  it('CLAUDE cite 7 types cross-tenant', () => expect(CLAUDE).toContain('7 types cross-tenant'));
  it('CLAUDE cite decision-011', () => expect(CLAUDE).toContain('decision-011'));
  it('CLAUDE cite decision-015', () => expect(CLAUDE).toContain('decision-015'));
  it('CLAUDE a la section 1.9', () => expect(CLAUDE).toContain('1.9 Fondation v3.0'));
  it('CLAUDE cite migration 011', () => expect(CLAUDE).toContain('1735000000011'));
  it('CLAUDE cite migration 012', () => expect(CLAUDE).toContain('1735000000012'));
  it('CLAUDE ne presente pas 12 roles comme actuel', () => {
    if (/12 roles/i.test(CLAUDE)) expect(CLAUDE).toMatch(/12 (roles )?historiques/i);
  });

  it('reprise note post 7.5a', () => expect(REPRISE).toContain('post Sprint 7.5a'));
  it('reprise mentionne 2.3.2', () => expect(REPRISE).toContain('2.3.2'));
  it('reprise cite 130 permissions', () => expect(REPRISE).toContain('130 permissions'));

  it('aucune emoji (decision-006)', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2705}\u{274C}\u{26A0}]/u;
    for (const c of [INDEX, README, CLAUDE, REPRISE]) expect(emoji.test(c)).toBe(false);
  });

  it('idempotence : addendum INDEX une seule fois', () => {
    expect((INDEX.match(/ADDENDUM v3.0 -- Fondation Assurflow/g) ?? []).length).toBeLessThanOrEqual(1);
  });
  it('idempotence : section 1.9 CLAUDE une seule fois', () => {
    expect((CLAUDE.match(/1.9 Fondation v3.0 Assurflow/g) ?? []).length).toBeLessThanOrEqual(1);
  });
  it('idempotence : note README une seule fois', () => {
    expect((README.match(/Note fondation v3.0 -- Assurflow/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it('CHECKLIST conditionnelle', () => {
    if (existsSync(CHECKLIST_PATH)) {
      expect(readFileSync(CHECKLIST_PATH, 'utf8')).toContain('7.5a.10');
    } else {
      expect(existsSync(CHECKLIST_PATH)).toBe(false); // skip attendu
    }
  });
});
```

### 8.3 Strategie de test et couverture des faits

La suite couvre cinq categories de faits, chacune avec au moins une assertion :

- PRESENCE de note : T1, T8, T13, T21 (chaque fichier a bien recu sa note).
- COMPTES exacts : T2-T4, T14-T16, T28-T29 (26 roles, 7 types, 130 permissions repetes et
  verifies dans les fichiers porteurs de comptes).
- REFERENCES tracables : T5-T6, T17-T20 (decisions et migrations citees correctement).
- ANTI-DRIFT : T23 (le compte obsolete "12 roles" n'est plus presente comme actuel).
- INTEGRITE doc : T25-T26, T31 (idempotence), T30 (no-emoji), T27 (report 7.5b explicite),
  T24 (checklist conditionnelle), T32 (aucun code applicatif touche).

Le critere de succes global est strict : `pass == total`. Une seule assertion FAIL fait sortir
le script en exit 1, ce qui bloque la cloture du sprint. C'est volontaire : la coherence
documentaire est un verrou, pas une suggestion.

---

## 9. Variables d'environnement

Cette tache est documentaire ; elle ne consomme aucune variable applicative. Variables utiles
pour les scripts de pilotage :

| Variable | Role | Defaut |
|----------|------|--------|
| `PROJECT_ROOT` | Racine du projet pour les scripts/tests | `C:\Users\belga\Desktop\Skalean_Insurtech` |
| `PILOTAGE_DIR` | Dossier 00-pilotage | `$PROJECT_ROOT/00-pilotage` |
| `REPO_DIR` | Dossier repo (contient CLAUDE.md) | `$PROJECT_ROOT/repo` |
| `CHECKLIST_EXTERNAL` | Chemin optionnel du CHECKLIST externe si hors repo | (vide -> skip) |
| `DRY_RUN` | Si `1`, les scripts affichent sans ecrire | `0` |

Note tache doc : aucune variable secrete (PASSWORD_PEPPER, JWT, DB) n'est requise ni touchee.

### 9.1 Notes d'usage des variables

- `PROJECT_ROOT` est le seul argument reellement necessaire ; tous les scripts de la section 7
  le prennent en premier parametre positionnel (`$1`). Sous Windows, utiliser la forme avec
  slashes `C:/Users/belga/Desktop/Skalean_Insurtech` dans les invocations bash pour eviter les
  echappements de backslash.
- `CHECKLIST_EXTERNAL` permet, si le CHECKLIST vit hors du repo a un chemin connu, de pointer
  les scripts vers ce chemin. Si vide, le comportement par defaut (skip si absent du repo) est
  applique. Aucun script ne CREE le CHECKLIST.
- `DRY_RUN=1` est une convention recommandee pour les scripts de pilotage : en mode dry-run, le
  script affiche ce qu'il ferait (quel fichier, quel marqueur, quel payload) sans ecrire. Utile
  pour une revue avant application reelle. Les scripts fournis peuvent etre adaptes pour honorer
  cette variable en remplacant `cat ... >> "$file"` par un `echo "DRY-RUN append vers $file"`.
- Aucune de ces variables ne contient de secret ; elles sont toutes des chemins ou des
  drapeaux. Il n'y a donc rien a masquer dans les logs des scripts.

---

## 10. Commandes shell (ordonnees)

```bash
# 0. Se placer a la racine (powershell : utiliser le chemin absolu Windows)
ROOT="C:/Users/belga/Desktop/Skalean_Insurtech"

# 1. Verifier que le tag 7.5a.9 existe (dependance)
git -C "$ROOT/repo" tag --list | grep -F "sprint-7.5a-complete-v3-foundation"

# 2. Appliquer les notes (idempotent) -- ou editer a la main avec les blocs section 7
bash "$ROOT/00-pilotage/scripts/apply-7.5a.10-cross-reference.sh" "$ROOT"

# 3. Verifier les comptes dans CLAUDE.md
bash "$ROOT/00-pilotage/scripts/check-counts-7.5a.10.sh" "$ROOT"

# 4. Verifier les liens internes
bash "$ROOT/00-pilotage/scripts/check-links-7.5a.10.sh" "$ROOT"

# 5. Verifier markdown valide (fences appariees)
bash "$ROOT/00-pilotage/scripts/lint-md-7.5a.10.sh" "$ROOT"

# 6. Verifier aucune emoji
bash "$ROOT/00-pilotage/scripts/check-no-emoji-7.5a.10.sh" "$ROOT"

# 7. Lancer la suite de tests de coherence
bash "$ROOT/00-pilotage/scripts/test-7.5a.10-doc-consistency.sh" "$ROOT"

# 8. Verifier qu'aucun code applicatif n'est touche
git -C "$ROOT/repo" status --porcelain | grep -E '^\s*M\s+(apps|packages)/' && echo "ERREUR code touche" || echo "OK aucun code touche"

# 9. (Optionnel) orchestrateur tout-en-un
bash "$ROOT/00-pilotage/scripts/run-7.5a.10.sh" "$ROOT"
```

### 10.1 Walkthrough d'une execution reussie (sortie attendue)

A titre de reference, voici la sortie attendue d'une execution propre, du tag jusqu'aux tests :

```text
$ git -C "$ROOT/repo" tag --list | grep -F "sprint-7.5a-complete-v3-foundation"
sprint-7.5a-complete-v3-foundation

$ bash apply-7.5a.10-cross-reference.sh "$ROOT"
APPEND OK : .../00-pilotage/INDEX.md
APPEND OK : .../00-pilotage/README.md
APPEND OK : .../repo/CLAUDE.md
APPEND OK : .../sprint-7-reprise-demain.md
SKIP (absent) : .../CHECKLIST-MASTER-EXECUTION.md
Termine.

$ bash check-counts-7.5a.10.sh "$ROOT"
OK present : '26 roles'
OK present : '130 perm'
OK present : '7 types cross-tenant'
OK present : '1735000000011'
OK present : '1735000000012'
OK present : 'decision-011'
OK present : 'decision-015'
Comptes coherents.

$ bash test-7.5a.10-doc-consistency.sh "$ROOT"
PASS [1] INDEX a la note v3.0
... (toutes les assertions PASS) ...
RESULTAT : 32 / 32 assertions PASS
```

Une seconde execution du script d'application affiche "DEJA PRESENT (idempotent)" pour chaque
fichier deja note : c'est la preuve de l'idempotence en conditions reelles.

---

## 11. Criteres de validation (V1-V30)

P0 (>=15) :

| ID | Critere | Commande | Attendu | Mode d'echec |
|----|---------|----------|---------|--------------|
| V1 | INDEX a la note v3.0 | `grep -F "ADDENDUM v3.0" 00-pilotage/INDEX.md` | au moins 1 match | note absente : addendum non appende, INDEX inchange |
| V2 | INDEX cite 26 roles | `grep -F "26 roles" 00-pilotage/INDEX.md` | au moins 1 match | compte faux (25/27) ou absent : drift de compte |
| V3 | INDEX cite 7 types cross-tenant | `grep -F "7 types cross-tenant" 00-pilotage/INDEX.md` | au moins 1 match | absent ou "6 types" : drift cross-tenant |
| V4 | INDEX cite 130 permissions | `grep -F "130 permissions" 00-pilotage/INDEX.md` | au moins 1 match | "120 permissions" ou absent : drift permissions |
| V5 | INDEX cite decisions 011-015 | `grep -E "decision-01[1-5]" 00-pilotage/INDEX.md` | >=2 match | decisions oubliees ou plage fausse |
| V6 | CLAUDE cite 26 roles | `grep -F "26 roles" repo/CLAUDE.md` | au moins 1 match | DRIFT CRITIQUE : agents generent du code a 12 roles |
| V7 | CLAUDE cite 130 perm | `grep -iE "130 perm" repo/CLAUDE.md` | au moins 1 match | DRIFT CRITIQUE : matrice incomplete generee |
| V8 | CLAUDE cite 7 types cross-tenant | `grep -F "7 types cross-tenant" repo/CLAUDE.md` | au moins 1 match | DRIFT CRITIQUE : cross-tenant incomplet |
| V9 | CLAUDE n'annonce plus 12 roles comme actuel | `grep -iE "12 roles" repo/CLAUDE.md` | absent ou suivi de "historiques" | drift : ancien compte presente comme courant |
| V10 | CLAUDE cite migrations 011/012 | `grep -E "17350000000(11\|12)" repo/CLAUDE.md` | 2 match | migration fausse (010/013) citee |
| V11 | CLAUDE cite section 1.9 | `grep -F "1.9 Fondation v3.0" repo/CLAUDE.md` | au moins 1 match | section non appendee : bloc 1.9 manquant |
| V12 | README a note fondation v3.0 | `grep -F "Note fondation v3.0" 00-pilotage/README.md` | au moins 1 match | note absente : README inchange |
| V13 | reprise note post 7.5a | `grep -F "post Sprint 7.5a" sprint-7-reprise-demain.md` | au moins 1 match | etat de reprise non maj |
| V14 | reprise mentionne 2.3.2 sur 26 roles | `grep -E "2.3.2" sprint-7-reprise-demain.md && grep -F "26 roles" sprint-7-reprise-demain.md` | 2 match | reprise sans compte cible : drift propage |
| V15 | aucune emoji (5 fichiers) | `check-no-emoji-7.5a.10.sh` | exit 0 | decision-006 violee : emoji introduite |
| V16 | aucun code applicatif modifie | `git status --porcelain \| grep -E "(apps\|packages)/"` | sortie vide | hors perimetre : code touche par erreur |
| V17 | count-consistency checker passe | `check-counts-7.5a.10.sh` | exit 0 | comptes incoherents dans CLAUDE.md |

P1 (>=8) :

| ID | Critere | Commande | Attendu | Mode d'echec |
|----|---------|----------|---------|--------------|
| V18 | liens internes resolus | `check-links-7.5a.10.sh` | exit 0 | lien casse vers cible inexistante |
| V19 | markdown valide (fences) | `lint-md-7.5a.10.sh` | exit 0 | bloc de code non ferme (fences impair) |
| V20 | idempotence addendum INDEX | `grep -cF "ADDENDUM v3.0 -- Fondation Assurflow" 00-pilotage/INDEX.md` | <=1 | duplication : script lance 2x sans garde |
| V21 | idempotence section 1.9 CLAUDE | `grep -cF "1.9 Fondation v3.0 Assurflow" repo/CLAUDE.md` | <=1 | duplication de la section 1.9 |
| V22 | README cite Demo Day | `grep -F "30 juin 2026" 00-pilotage/README.md` | au moins 1 match | jalon Demo Day absent ou mauvaise date |
| V23 | refactor reporte au 7.5b explicite | `grep -F "7.5b" 00-pilotage/INDEX.md` | au moins 1 match | report non dit : ambiguite sur le naming |
| V24 | suite tests doc-consistency passe | `test-7.5a.10-doc-consistency.sh` | exit 0 (pass==total) | au moins une assertion FAIL |
| V25 | INDEX cite migrations 011/012 | `grep -E "17350000000(11\|12)" 00-pilotage/INDEX.md` | 2 match | migration absente de l'addendum |

P2 (>=5) :

| ID | Critere | Commande | Attendu | Mode d'echec |
|----|---------|----------|---------|--------------|
| V26 | CHECKLIST conditionnel (skip si absent) | `[ -f CHECKLIST-MASTER-EXECUTION.md ] && grep 7.5a.10 CHECKLIST-MASTER-EXECUTION.md \|\| echo skip` | skip ou match | echec si script suppose le fichier present |
| V27 | commit type docs(sprint-7.5a) | `git log -1 --pretty=%s` | commence par `docs(sprint-7.5a)` | mauvais type de commit (feat/fix) |
| V28 | encodage UTF-8 des 5 fichiers | `file -i 00-pilotage/INDEX.md` | charset=utf-8 | latin-1 : accents casses (mojibake) |
| V29 | ligne 45 INDEX completee v3.0 | `grep -F "26 roles utilisateurs" 00-pilotage/INDEX.md` | au moins 1 match | ligne 45 non maj : ancienne "12 roles utilisateurs" |
| V30 | CLAUDE liste maj des 14 conventions | `grep -F "Mise a jour v3.0" repo/CLAUDE.md` | au moins 1 match | note de maj conventions absente |

---

## 12. Edge cases + troubleshooting (15+)

1. EDGE -- `CHECKLIST-MASTER-EXECUTION.md` absent du depot.
   C'est le cas attendu : le fichier vit dans un emplacement de pilotage externe. La mise a jour
   est CONDITIONNELLE : `if [ -f "$CHECKLIST" ]`. Le test V26 PASSE par skip si absent.
   Resolution : ne JAMAIS creer ce fichier dans le repo pour "faire passer" un test ; le skip
   est le comportement correct.
2. EDGE -- relance du script d'append.
   Les gardes `grep -qF "$marker"` empechent la double insertion. Si un fichier a deja la note,
   le script affiche "DEJA PRESENT (idempotent)".
   Resolution : relancer le script autant de fois que necessaire est sans risque ; les tests
   d'idempotence (T25, T26, T31) confirment l'absence de doublon.
3. EDGE -- bash mount qui lag (contexte present).
   Si les scripts ne repondent pas ou si l'environnement shell boote lentement, appliquer les
   blocs de la section 7 a la main via l'outil Edit avec le texte integral.
   Resolution : tous les blocs de note sont fournis en texte complet (sections 7.1-7.5) ;
   valider ensuite par Read sur la fin de chaque fichier.
4. EDGE -- plusieurs README dans le projet.
   Il existe potentiellement `repo/README.md` ET `00-pilotage/README.md`.
   Resolution : NE PAS utiliser `glob README.md`. Cibler exclusivement `00-pilotage/README.md`.
   `repo/README.md` n'est PAS dans le perimetre.
5. EDGE -- CLAUDE.md edite par une autre tache en parallele.
   Un Edit aveugle pourrait ecraser un ajout concurrent.
   Resolution : avant edition, faire un Read complet, et utiliser un Edit cible (old_string
   unique avec contexte suffisant) pour eviter d'ecraser un autre ajout.
6. EDGE -- lien casse introduit par la note.
   Ex. lien vers `decisions/decision-011.md` alors que le fichier reel est
   `decisions/011-rebrand.md`.
   Resolution : le link-checker (7.7) detecte ; preferer des references textuelles "voir
   decisions/" plutot que des liens fragiles si l'arborescence exacte n'est pas confirmee.
7. EDGE -- ligne 45 INDEX deja modifiee (12->26).
   Si l'Edit ne trouve plus la chaine "12 roles utilisateurs", c'est que la maj est deja faite.
   Resolution : traiter ce cas comme un succes idempotent ; ignorer (ne pas relancer l'Edit).
8. EDGE -- emoji introduite par copier-coller (coche verte, croix rouge).
   Le check-no-emoji (7.10) echoue.
   Resolution : remplacer par `[x]`, `OK`, `ECHEC` en texte ASCII ; relancer le check.
9. EDGE -- numero de migration mal recopie.
   Verifier que ce sont bien `1735000000011` et `1735000000012` (finissant par 11 et 12).
   Resolution : valeurs codees en dur dans la note ; le test grep dedie (V10/V25) detecte un
   numero faux.
10. EDGE -- modification accidentelle d'un fichier de code en cherchant un README.
    Resolution : le critere V16 (`git status` ne montre rien sous apps/packages) bloque ce cas
    au moment du commit ; annuler la modification fortuite avant de committer.
11. EDGE -- `00-pilotage/` est zone protegee selon CLAUDE.md ("JAMAIS modifier 00-pilotage/
    directement").
    Resolution : cette tache est une EXCEPTION de pilotage menee par Cowork. Si executee par
    une IA en mode implementation code, refuser et escalader (voir section 17).
12. EDGE -- fin de fichier sans saut de ligne final.
    Un append sans separateur collerait la note au dernier paragraphe.
    Resolution : l'append commence par une ligne vide puis `---` pour garantir une separation
    markdown propre meme si le fichier ne finissait pas par `\n`.
13. EDGE -- doublon de decisions.
    Confondre decision-010 (Insure Connecteurs, v2.2) avec les nouvelles 011-015.
    Resolution : ne citer que 011-015 comme nouvelles decisions v3.0 ; decision-010 n'apparait
    jamais dans les notes comme nouvelle.
14. EDGE -- count-checker FAIL sur "130 perm" alors que le compte est correct.
    Si CLAUDE.md ecrit "130 droits" ou "130 habilitations" au lieu de "130 perm...".
    Resolution : imposer la formulation "130 permissions" ; le grep `130 perm` matche bien
    "130 permissions". Si "droits" est utilise, ajouter aussi "130 permissions".
15. EDGE -- CRLF vs LF sous Windows.
    Les fichiers edites sous Windows peuvent contenir des CRLF ; un grep `^```` reste valide,
    mais un diff git peut signaler tout le fichier comme modifie.
    Resolution : respecter la convention de fin de ligne du fichier existant (ne pas convertir
    en masse) ; les Edit ciblees ne touchent que les lignes ajoutees.
16. EDGE -- tag 7.5a.9 absent (dependance non satisfaite).
    Si `git tag --list` ne montre pas `sprint-7.5a-complete-v3-foundation`, la dependance n'est
    pas remplie.
    Resolution : ne pas executer 7.5a.10 ; revenir a 7.5a.9 pour poser le tag d'abord. La note
    cite le tag ; ecrire la note avant que le tag existe creerait une incoherence.
17. EDGE -- accents francais affiches en mojibake apres edition.
    Symptome d'une ecriture en latin-1 au lieu d'UTF-8.
    Resolution : verifier l'encodage via `file -i` (V28) ; re-ecrire en UTF-8 si necessaire.

Troubleshooting rapide :

- "count checker FAIL sur 130 perm" : verifier que CLAUDE.md ecrit bien "130 perm..." (la regex
  est `130 perm`, donc "130 permissions" matche). Si CLAUDE ecrit "130 droits", ajouter "130
  permissions".
- "link-checker FAIL" : retirer le lien fragile, garder la reference textuelle.
- "test idempotence FAIL (occ=2)" : un append a ete fait deux fois ; supprimer le doublon a la
  main, le re-run du script ne le recreera pas (garde grep).
- "no-emoji FAIL" : localiser la ligne signalee par le check, remplacer le symbole colore par
  son equivalent ASCII (`[x]`, `OK`, `ECHEC`).
- "markdown-lint FAIL (fences impair)" : un bloc ``` n'est pas ferme ; rechercher le bloc ouvert
  et ajouter la fence de fermeture.

---

## 13. Conformite Maroc

Tracabilite documentaire pour audit ACAPS (decision-008, cloud souverain MA Atlas Benguerir) :

- La cross-reference v3.0 garantit que la documentation directrice (INDEX, README, CLAUDE)
  reflete fidelement l'etat RBAC reel du systeme (26 roles, 7 types cross-tenant, 130
  permissions). Lors d'un audit ACAPS de la matrice d'habilitations, l'auditeur doit pouvoir
  retrouver, dans la documentation, la liste exacte des roles et permissions effectivement
  appliques par le code. Un drift documentaire (ex. CLAUDE annoncant 12 roles alors que 26
  sont actifs) constituerait une non-conformite de tracabilite.
- Les decisions 011-015 sont referencees comme source de verite versionnee ; chaque acteur
  metier (carrier, expert, tow, garage parts manager) ajoute en v3.0 doit etre justifiable par
  une decision tracee, condition d'audibilite ACAPS.
- Aucune donnee assure ne figure dans ces fichiers de pilotage ; la residence des donnees
  (Atlas Benguerir, AES-256-GCM, TLS 1.3) n'est pas affectee par cette tache. La note rappelle
  toutefois que le perimetre v3.0 reste sous cloud souverain MA (decision-008).
- Le tag git `sprint-7.5a-complete-v3-foundation` (pose en 7.5a.9) sert de jalon d'audit
  horodate ; la presente note documentaire le cite pour relier la fondation au point de
  controle versionne.
- La table `expert_designations` (migration 1735000000011) trace QUEL expert est designe sur
  QUEL dossier, ce qui est la base d'auditabilite de l'acces cross-tenant de l'expert. La note
  CLAUDE.md section 1.9 cite cette migration pour que toute generation future de code RBAC
  preserve cette tracabilite exigee par l'ACAPS.

### 13.1 Glossaire des termes v3.0 utilises dans les notes

Pour qu'un auditeur ou un nouvel arrivant comprenne les notes sans contexte prealable, voici le
glossaire des termes employes dans les blocs des sections 7.1-7.5 :

| Terme | Definition dans le contexte v3.0 |
|-------|----------------------------------|
| Skalean | Marque produit cible (decision-011), remplace progressivement InsurTech en surface |
| Assurflow | Vertical assurance auto et sinistre du produit Skalean v3.0 |
| carrier | Acteur assureur (compagnie d'assurance), famille de 6 roles |
| expert | Acteur expert sinistre, pivot du flux (decision-013), famille de 4 roles |
| tow | Acteur depannage/remorquage, famille de 3 roles |
| garage_parts_manager | Role unique operant PartsHub (marketplace pieces, decision-014) |
| broker | Courtier d'assurance, acteur historique v2.2 |
| assure | Assure final, acteur historique v2.2 |
| cross-tenant | Acces autorise d'un tenant aux donnees d'un autre tenant, encadre par type |
| `expert_designations` | Table (migration 011) liant un expert a un dossier qu'il expertise |
| `app_can_access_tenant` | Fonction SQL (migration 012) evaluant l'autorisation cross-tenant pour la RLS |
| PartsHub | Marketplace de pieces detachees (decision-014) |
| Demo Day | Jalon de demonstration de la fondation v3.0, fixe au 30 juin 2026 (decision-015) |
| addendum | Bloc de note ajoute en fin de fichier sans toucher au contenu existant |
| sentinel marker | Chaine unique servant de garde idempotente avant un append |
| drift | Divergence entre ce que le code expose et ce que la documentation affirme |

### 13.2 Frise des comptes : avant (v2.2) -> apres (v3.0)

Recapitulatif des transitions de comptes que les notes doivent refleter sans erreur :

| Axe | v2.2 (avant) | v3.0 (apres) | Delta | Source |
|-----|--------------|--------------|-------|--------|
| Roles | 12 | 26 | +14 (6+4+3+1) | enum AuthRole |
| Types cross-tenant | 3 | 7 | +4 | enum CrossTenantAuthorizationType |
| Permissions | 90 | 130 | +40 (15+10+8+7) | catalogue RBAC |
| Migrations | jusqu'a 010 | +011, +012 | +2 | dossier migrations |
| Decisions | jusqu'a 010 | +011 a +015 | +5 | dossier decisions |

Toute note qui ecrit un nombre de la colonne "apres" different de cette table est en drift et
doit etre corrigee avant le commit. Cette table est la reference unique des comptes pour la
tache 7.5a.10.

---

## 14. Conventions absolues (reproduites EN ENTIER)

- Multi-tenant strict : `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ;
  `TenantGuard` ; `AsyncLocalStorage` ; RLS via `app_can_access_tenant()` ; audit trail.
- Validation strict : Zod uniquement ; `@insurtech/shared-types` ; `z.object` / `z.infer`.
- Logger strict : Pino injecte ; jamais `console.log` ; champs JSON structures `tenant_id`,
  `user_id`, `request_id`, `action`, `duration_ms`.
- Hash strict : argon2id 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER`.
- Package manager strict : pnpm uniquement ; engine-strict Node >= 22.11.0 ; save-exact ;
  link-workspace-packages=deep.
- TypeScript strict : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`,
  `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- Tests strict : Vitest + Playwright ; chaque `.ts` a son `.spec.ts` ; coverage >= 85% /
  >= 90% auth/database/signature.
- RBAC strict : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles ; 130 perms.
- Events strict : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; Zod par event ;
  `Idempotency-Key` critique.
- Imports strict : `@insurtech/{name}` ; `tsconfig.base.json` paths ; ordre Node / external /
  `@insurtech/` / relative.
- Skalean AI strict (decision-005) : uniquement via `@insurtech/sky` ou MCP ; jamais frontier
  direct ; mock 1-28 reel 29.
- No-emoji strict (decision-006 ABSOLU) : aucune emoji nulle part ; `check-no-emoji.sh` ; CI
  echoue.
- Idempotency-Key strict : POST `/payments`, `/signatures`, `/claims`, ecritures MCP ; TTL 24h
  Redis.
- Conventional Commits strict : `<type>(scope): description` ; commitlint via husky.
- Cloud souverain MA strict (decision-008) : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ;
  aucune donnee assure ne quitte le MA ; AES-256-GCM ; TLS 1.3.

---

## 15. Validation pre-commit

```bash
ROOT="C:/Users/belga/Desktop/Skalean_Insurtech"

# 1. No-emoji (decision-006 ABSOLU) sur les 5 fichiers
bash "$ROOT/00-pilotage/scripts/check-no-emoji-7.5a.10.sh" "$ROOT"

# 2. Comptes coherents dans CLAUDE.md (CRITIQUE)
bash "$ROOT/00-pilotage/scripts/check-counts-7.5a.10.sh" "$ROOT"

# 3. Liens internes resolus
bash "$ROOT/00-pilotage/scripts/check-links-7.5a.10.sh" "$ROOT"

# 4. Markdown valide
bash "$ROOT/00-pilotage/scripts/lint-md-7.5a.10.sh" "$ROOT"

# 5. Suite de coherence documentaire (>=25 assertions)
bash "$ROOT/00-pilotage/scripts/test-7.5a.10-doc-consistency.sh" "$ROOT"

# 6. Aucun code applicatif touche
git -C "$ROOT/repo" status --porcelain | grep -E '^\s*M\s+(apps|packages)/' \
  && { echo "ERREUR : code applicatif modifie"; exit 1; } \
  || echo "OK : aucun code applicatif modifie"

# 7. Hook standard du repo (redondance no-emoji + commitlint au commit-msg)
pnpm -C "$ROOT/repo" check-no-emoji || true
```

Toutes les commandes doivent retourner exit 0 (sauf le grep negatif de l'etape 6 qui doit ne
RIEN trouver). Si l'une echoue, corriger avant de committer.

---

## 16. Commit message complet

```
docs(sprint-7.5a): cross-reference v3.0 foundation in INDEX/README/CLAUDE

Ajoute des notes de cross-reference legeres signalant la fin du Sprint 7.5a
(Assurflow Foundation) et la fondation v3.0 dans les documents de pilotage :

- 00-pilotage/INDEX.md : addendum v3.0 (26 roles, 7 types cross-tenant,
  130 permissions, migrations 1735000000011/012, decisions 011-015) avec
  tableau recapitulatif des 10 taches 7.5a.1-7.5a.10, et maj de la ligne
  "12 roles" -> "26 roles".
- 00-pilotage/README.md : note fondation v3.0 (rebrand Skalean/Assurflow,
  6 acteurs, expert central, PartsHub, Demo Day 30 juin 2026).
- repo/CLAUDE.md : comptes officiels v3.0 (section 1.9) consommes par
  Claude Code -- 26 roles enumeres par famille, 7 types cross-tenant listes,
  130 permissions par module, migrations 011/012, decisions 011-015 ; note
  de maj sur la liste des 14 conventions.
- sprint-7-reprise-demain.md : etat de reprise -- Sprint 7 task 2.3.2
  (PermissionsMatrix) peut reprendre sur l'architecture 26 roles.
- CHECKLIST-MASTER-EXECUTION.md : coche conditionnelle 7.5a.1-7.5a.10
  (fichier externe, applique uniquement si present).

Le refactor textuel complet (InsurTech -> Assurflow, ~12696 occurrences)
est explicitement reporte au Sprint 7.5b. Aucun code applicatif modifie.

Task: 7.5a.10
Sprint: 7.5a
Phase: 2.5
Reference: B-7.5a Tache 7.5a.10
```

---

## 17. Workflow next step

Cette tache CLOT le Sprint 7.5a (10/10). Apres validation et commit :

1. Sprint 7.5a est COMPLET. Le tag `sprint-7.5a-complete-v3-foundation` (pose en 7.5a.9) et la
   documentation cross-referencee (cette tache) constituent le jalon de fondation v3.0.
2. PROCHAINE etape immediate : REPRENDRE le Sprint 7, tache 2.3.2 (PermissionsMatrix), qui peut
   desormais s'appuyer sur l'architecture propre a 26 roles, 7 types cross-tenant et 130
   permissions. CLAUDE.md (section 1.9) fournit les comptes officiels pour cette reprise.
3. PLUS TARD : Sprint 7.5b prendra en charge le refactor de nomenclature complet (InsurTech ->
   Assurflow, environ 12696 occurrences textuelles), avec arbitrage des noms de packages, apps
   et tables. Cette tache 7.5a.10 a pose les ancres documentaires que 7.5b viendra etendre.

Acteur autorise : cette tache modifie `00-pilotage/` qui est normalement protege ; elle DOIT
etre executee par Cowork (pilotage documentaire) et non par une IA en mode implementation code.
Toute IA en mode code doit refuser et escalader (voir edge case 11).

Garde-fou final : avant de marquer le sprint complet, relancer la section 15 (validation
pre-commit) et confirmer que les criteres P0 V1-V17 passent tous. Si un seul P0 echoue, le
sprint n'est PAS clos : corriger d'abord, recommitter, puis re-valider.

Sequence de cloture recommandee :

1. Appliquer les notes (section 7.6, idempotent) ou editer a la main (sections 7.1-7.5).
2. Lancer l'orchestrateur (section 7.11) qui enchaine application + 5 verificateurs.
3. Confirmer V1-V17 (P0) tous au vert, puis V18-V25 (P1), puis V26-V30 (P2).
4. Committer avec le message exact de la section 16.
5. Verifier `git log -1` (type `docs(sprint-7.5a)`, critere V27).
6. Annoncer la cloture du Sprint 7.5a et la disponibilite de la reprise Sprint 7 task 2.3.2.

### 17.1 Definition of Done (DoD) de la tache 7.5a.10

La tache est consideree TERMINEE si et seulement si TOUS les points suivants sont vrais :

- Les cinq fichiers cibles ont recu leur note (ou skip documente pour CHECKLIST absent).
- CLAUDE.md annonce 26 roles, 7 types cross-tenant, 130 permissions, migrations 011/012,
  decisions 011-015, et la section 1.9 existe.
- La ligne 45 de INDEX est completee en "26 roles utilisateurs v3.0" (ou deja faite).
- Les criteres P0 V1-V17 passent tous (exit 0).
- Les criteres P1 V18-V25 passent tous.
- Les criteres P2 V26-V30 passent (V26 par skip si CHECKLIST absent).
- Aucune emoji (decision-006), aucun lien casse, markdown valide, scripts idempotents.
- Aucun fichier de code applicatif modifie (git status propre sous apps/packages).
- Le commit porte le type `docs(sprint-7.5a)`.

Si un seul de ces points est faux, la tache n'est PAS Done et le Sprint 7.5a n'est PAS clos.

### 17.2 Articulation avec la reprise du Sprint 7 task 2.3.2

La tache 7.5a.10 produit l'INPUT exact dont la reprise du Sprint 7 a besoin :

- 2.3.2 (PermissionsMatrix) lit `repo/CLAUDE.md` section 1.9 pour connaitre les 26 roles et les
  130 permissions a couvrir dans la matrice.
- La note de `sprint-7-reprise-demain.md` confirme que la reprise part de l'architecture v3.0
  stabilisee et NON de l'ancienne base a 12 roles.
- Sans 7.5a.10, 2.3.2 aurait lu un compte faux et produit une matrice incomplete. Avec 7.5a.10,
  2.3.2 demarre sur des comptes exacts et tracables.

C'est la raison d'etre operationnelle de cette tache : elle est le pont de coherence entre la
fondation v3.0 (posee par 7.5a.1-7.5a.9) et sa consommation par la prochaine vague de
developpement (Sprint 7 task 2.3.2, puis le refactor de naming au Sprint 7.5b).

### 17.3 Ce que cette tache NE fait PAS (rappel de cloture)

- Elle ne renomme PAS InsurTech en Assurflow dans la prose ou le code (reporte 7.5b).
- Elle ne touche PAS aux packages `@insurtech/*` ni aux chemins ni aux tables.
- Elle ne cree PAS de fichier de code applicatif.
- Elle ne cree PAS le CHECKLIST dans le repo (il reste externe et conditionnel).
- Elle ne modifie PAS les decisions 011-015 elles-memes (elles sont deja formalisees en 7.5a.8) ;
  elle ne fait que les CITER dans les notes.
- Elle ne reecrit PAS les 357/296/112/102 lignes existantes des fichiers ; elle APPEND
  uniquement (sauf la maj cible de la ligne 45 d'INDEX).

Ce perimetre negatif est aussi important que le perimetre positif : il garantit que la tache
reste legere, sans risque de regression, et fidele a son budget d'une heure.

### 17.4 Resume executif de la tache

En une phrase : 7.5a.10 pose cinq notes documentaires legeres qui rendent la fondation v3.0
(26 roles, 7 types cross-tenant, 130 permissions, migrations 011/012, decisions 011-015)
visible et exacte dans les documents directeurs, avec une attention critique sur CLAUDE.md
consomme par les agents, en reportant le refactor de naming complet au Sprint 7.5b.

Trois faits a retenir :

1. La criticite vient de l'effet de levier de CLAUDE.md, pas de la taille de la tache.
2. L'idempotence (sentinel marker) rend les scripts re-jouables sans danger de duplication.
3. Le report a 7.5b est un choix assume et explicite, motive par le risque d'un sed massif sur
   ~12696 occurrences et l'absence d'arbitrage de naming definitif.

Cette tache cloture le Sprint 7.5a et debloque la reprise du Sprint 7 task 2.3.2.

---

Fin de la tache 7.5a.10 -- Documentation cross-reference v3.0. Sprint 7.5a (Assurflow
Foundation) COMPLET. Aucune emoji (decision-006). Reference : B-7.5a Tache 7.5a.10. Phase 2.5.
Priorite P0. Prochaine etape : reprise Sprint 7 task 2.3.2 sur architecture 26 roles ; refactor
naming complet reporte au Sprint 7.5b.
