# TEMPLATE -- FICHIER ORCHESTRATEUR DE SPRINT

**Usage** : Ce template guide la creation d'un fichier `orchestrateur-sprint-{cumul}.md` qui pilote l'execution sequentielle complete d'un sprint par Claude Code.

**Fichier cible** : `prompts/sprints/orchestrateur-sprint-{cumul}.md`

**Convention de numerotation** : `{cumul}` = numero cumule du sprint (1 a 32).

**Difference avec le fichier sprint complet** : Le `sprint-{cumul}-prompt-complet.md` contient le code et les details de chaque tache. Le `orchestrateur-sprint-{cumul}.md` ne contient PAS le code mais les instructions sur COMMENT executer le sprint, dans quel ordre, avec quelles regles, et quoi faire en cas d'echec.

---

## STRUCTURE DU FICHIER ORCHESTRATEUR

Le fichier suit obligatoirement cette structure :

```markdown
# ORCHESTRATEUR SPRINT {cumul} -- Phase {X} / Sprint {Y} : {Nom}
# {Nombre de taches} taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

[En-tete d'instructions a Claude Code]

## STRUCTURE DES FICHIERS
## REGLES D'EXECUTION CRITIQUES
## REGLES ABSOLUES skalean-insurtech (a appliquer dans CHAQUE tache)
## CONTEXTE PHASE {X}
## EXECUTION SEQUENTIELLE DES {N} TACHES
## VERIFICATION DU SPRINT {cumul}
## RESUME DU WORKFLOW
## COMMANDES DE LANCEMENT
```

---

## SECTION 1 -- EN-TETE DU FICHIER

L'en-tete commence par trois lignes obligatoires :

```markdown
# ORCHESTRATEUR SPRINT {cumul} -- Phase {X} / Sprint {Y} : {Nom complet}
# {Nombre de taches} taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE
```

**Exemples valides** :

```markdown
# ORCHESTRATEUR SPRINT 13 -- Phase 4 / Sprint 4 : Pay MA Multi-Passerelles
# 16 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE
```

```markdown
# ORCHESTRATEUR SPRINT 22 -- Phase 6 / Sprint 2 : IA Estimation Photos et Anti-Fraude
# 15 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE
```

Apres ces 3 lignes, une instruction directe :

```markdown
Tu es Claude Code. Tu dois executer TOUTES les taches du Sprint {cumul} UNE PAR UNE,
puis lancer la verification automatique du sprint.
```

Cette instruction est invariante.

---

## SECTION 2 -- STRUCTURE DES FICHIERS

Section qui liste les fichiers dont l'orchestrateur a besoin :

```markdown
## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/prompts/tasks/
  task-{X}.{Y}.1-prompt.md       # {Nom court tache 1}
  task-{X}.{Y}.2-prompt.md       # {Nom court tache 2}
  ...
  task-{X}.{Y}.{Z}-prompt.md     # {Nom court derniere tache}
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/prompts/verifications/verify-sprint-{cumul}.md
```
```

**Exemple Sprint 13 (Phase 4 / Sprint 4 : Pay MA Multi-Passerelles)** :

```markdown
## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/prompts/tasks/
  task-4.4.1-prompt.md       # Etude marche : negociations affiliations
  task-4.4.2-prompt.md       # Architecture Strategy + Adapter pattern
  task-4.4.3-prompt.md       # Schema PostgreSQL pay_*
  task-4.4.4-prompt.md       # Interface IPaymentGateway
  task-4.4.5-prompt.md       # Adapter CMI 3D Secure 2
  task-4.4.6-prompt.md       # Adapter YouCan Pay + CashPlus
  task-4.4.7-prompt.md       # Adapter PayZone
  task-4.4.8-prompt.md       # Adapter Inwi Money
  task-4.4.9-prompt.md       # Adapter Orange Money
  task-4.4.10-prompt.md      # Adapter M-Wallet BAM
  task-4.4.11-prompt.md      # Orchestrateur selection + fallback
  task-4.4.12-prompt.md      # Webhooks reception securisee
  task-4.4.13-prompt.md      # Anti-fraude via Skalean AI Agents
  task-4.4.14-prompt.md      # Page checkout unifiee Next.js
  task-4.4.15-prompt.md      # Reconciliation Books
  task-4.4.16-prompt.md      # Tests integration sandbox 6 passerelles
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/prompts/verifications/verify-sprint-13.md
```
```

---

## SECTION 3 -- REGLES D'EXECUTION CRITIQUES

Section invariante :

```markdown
## REGLES D'EXECUTION CRITIQUES

### Execution sequentielle obligatoire

Tu DOIS attendre qu'une tache soit COMPLETEMENT TERMINEE avant de demarrer la suivante.
Cela signifie :
1. Lire le fichier prompt de la tache
2. Implementer TOUT le code demande
3. Verifier que ca compile (`pnpm tsc --noEmit`)
4. Executer les tests (`pnpm vitest run`)
5. Commit (`git add -A && git commit`)
6. SEULEMENT APRES le commit, passer a la tache suivante

Raison : les taches ont des dependances entre elles. La tache N peut importer du code cree
par la tache N-1. Executer en parallele ou sauter des etapes creerait des conflits.

### Si une tache echoue

1. Tente de reparer l'erreur (3 tentatives maximum)
2. Si impossible, note l'erreur dans le rapport et passe a la tache suivante
3. N'arrete JAMAIS l'execution du sprint entier -- continue les taches restantes

### Verification finale

APRES avoir execute les {N} taches et commite chacune, tu lances la verification :
```
cat skalean-insurtech/prompts/verifications/verify-sprint-{cumul}.md
```
Puis tu executes CHAQUE section du fichier de verification (il contient les commandes bash).
```

Cette section est strictement invariante. Identique pour tous les sprints.

---

## SECTION 4 -- REGLES ABSOLUES skalean-insurtech

Section invariante qui rappelle les regles non-negociables :

```markdown
## REGLES ABSOLUES skalean-insurtech (a appliquer dans CHAQUE tache)

- Multi-tenant : CHAQUE query DB filtre par tenant_id, header x-tenant-id
- Validation : Zod (JAMAIS class-validator)
- Logger : Pino via this.logger (JAMAIS console.log, JAMAIS new Logger())
- Events : Kafka sur insurtech.events.* pour chaque action metier
- RBAC : @Roles() + RolesGuard + TenantGuard sur chaque endpoint
- Tests : Vitest, chaque fichier .ts a un fichier .spec.ts
- Types : TypeScript strict, aucun 'any' implicite
- Hash : argon2id (JAMAIS bcrypt)
- Package manager : pnpm (JAMAIS npm ou yarn)
- Imports : @insurtech/* pour les packages partages
- Skalean AI : utilise UNIQUEMENT via @insurtech/shared-skalean-ai-client
  (JAMAIS de duplication de LLM, RAG, vector store, MCP server dans skalean-insurtech)
- AUCUNE EMOJI dans le code, commentaires ou logs

### Regles supplementaires InsurTech Maroc

- Audit ACAPS : chaque ecriture sur tables insure_*, repair_*, pay_* declenche une entree dans compliance_acaps_audits
- Donnees Maroc : aucune donnee assure, police, sinistre, paiement ne transite hors datacenter Maroc
- Multilinguisme : toute communication assure (notifications, emails, WhatsApp) supporte FR, Darija, Arabe classique
- Anti-fraude : interfaces acceptant montants ou photos passent par scoring statistique via Skalean AI
- Conformite loi 43-20 : signatures electroniques utilisent uniquement le module docs-signature-ma
- Conformite loi 09-08 : consentement explicite RGPD-CNDP, procedures de purge sur demande
```

---

## SECTION 5 -- CONTEXTE PHASE

Section qui rappelle la position du sprint dans la phase et son apport. Specifique a chaque phase :

```markdown
## CONTEXTE PHASE {X} -- {Nom Phase}

### Position du Sprint {Y} dans la Phase {X}

{Une paragraph qui explique la position du sprint dans la phase, ce qu'il apporte, et ce qu'il debloque pour les sprints suivants de la meme phase ou des phases ulterieures.}

### Modules concernes par cette Phase

{Liste des packages et apps principalement modifies dans cette phase}

### Roles principaux impactes

{Liste des roles utilisateurs qui beneficient des fonctionnalites livrees}
```

**Exemple Sprint 13 (Phase 4 / Sprint 4 : Pay MA Multi-Passerelles)** :

```markdown
## CONTEXTE PHASE 4 -- Modules Horizontaux Fondamentaux

### Position du Sprint 4 dans la Phase 4

Ce sprint est le 4e des 6 sprints de la Phase 4 qui construit les modules horizontaux reutilises par Broker (Phase 5) ET Garage (Phase 6). Avant ce sprint, les modules CRM, Booking, Comm WhatsApp, Comm Email, et Docs Signature loi 43-20 ont ete livres (Sprints 4.1, 4.2, 4.3). Apres ce sprint, les modules Books, Compliance ACAPS, Analytics, Stock Parts et HR Techniciens seront construits (Sprints 4.5, 4.6).

Ce sprint est CRITIQUE pour la viabilite commerciale de skalean-insurtech car aucun SaaS InsurTech ne peut fonctionner au Maroc sans une integration solide avec les passerelles de paiement marocaines. Une integration de moindre qualite peut perdre 20 a 40% des transactions au checkout.

### Modules concernes

- @insurtech/horizontal-pay-ma (creation complete dans ce sprint)
- @insurtech/database (extension avec tables pay_*)
- @insurtech/shared-events (extension avec events pay.*)
- @insurtech/shared-skalean-ai-client (utilise pour anti-fraude)

### Roles principaux impactes

- Tous les roles a partir de Phase 5 utiliseront ce module pour les paiements
- Comptable : reconciliation automatique avec Books (Sprint 4.5)
- Assure : page checkout unifiee accessible depuis web-broker et web-garage
```

---

## SECTION 6 -- EXECUTION SEQUENTIELLE DES TACHES

Section principale qui decrit pour chaque tache :
1. Le rappel de son but
2. La commande exacte pour la lire
3. Les actions principales attendues
4. Les commandes de validation et commit

```markdown
## EXECUTION SEQUENTIELLE DES {N} TACHES

### Tache 1 / {N} : {Nom court}

**But** : {Une phrase qui decrit l'apport de la tache}

**Commande de lecture** :
```bash
cat skalean-insurtech/prompts/tasks/task-{X}.{Y}.1-prompt.md
```

**Actions principales attendues** :
- {Action 1}
- {Action 2}
- {Action 3}

**Validation** :
```bash
cd packages/{module-concerne}
pnpm tsc --noEmit
pnpm vitest run
cd ../..
```

**Commit** :
```bash
git add -A
git commit -m "{message commit conforme Conventional Commits}

Task: {X}.{Y}.1
Sprint: {cumul} (Phase {X} / Sprint {Y})
Phase: {X}"
```

---

### Tache 2 / {N} : {Nom court}

[Meme structure pour chaque tache]

---

[... toutes les taches dans l'ordre ...]
```

**Exemple Sprint 13 -- Tache 1** :

```markdown
### Tache 1 / 16 : Etude marche -- negociations affiliations passerelles MA

**But** : Realiser l'etude prealable des conditions commerciales et techniques des 6 passerelles marocaines avant tout developpement.

**Commande de lecture** :
```bash
cat skalean-insurtech/prompts/tasks/task-4.4.1-prompt.md
```

**Actions principales attendues** :
- Documenter conditions affiliation CMI : frais setup 2 500-4 000 MAD, commission 1.5-2.5%, delai 2-4 semaines
- Documenter conditions YouCan Pay : startup-friendly, onboarding 48-72h, SDK officiel, support CashPlus
- Documenter conditions PayZone : alternative startup, 300-800 MAD/mois, commission 2.0-3.5%
- Documenter conditions Inwi Money et Orange Money pour les 40% non-bancarises
- Documenter standard M-Wallet BAM (interoperable Bank Al-Maghrib)
- Produire un tableau comparatif markdown dans `docs/passerelles-paiement-ma.md`
- Demarrer les demarches d'affiliation pour les 5 passerelles principales
- Aucun code dans cette tache -- documentation et negociation prealable

**Validation** :
```bash
test -f docs/passerelles-paiement-ma.md
wc -l docs/passerelles-paiement-ma.md  # >= 200 lignes attendues
```

**Commit** :
```bash
git add docs/passerelles-paiement-ma.md
git commit -m "docs(pay-ma): study Moroccan payment gateways and start affiliations

- Document CMI conditions and integration requirements
- Document YouCan Pay startup-friendly approach with CashPlus support
- Document PayZone as alternative startup option
- Document Inwi Money and Orange Money for non-banked population
- Document M-Wallet BAM interoperable standard
- Produce comparison matrix and start affiliation procedures

Task: 4.4.1
Sprint: 13 (Phase 4 / Sprint 4)
Phase: 4"
```
```

---

## SECTION 7 -- VERIFICATION DU SPRINT

Apres la derniere tache, l'orchestrateur enchaine sur la verification :

```markdown
## VERIFICATION DU SPRINT {cumul}

Une fois les {N} taches terminees et commitees, lancer la verification automatique :

```bash
cat skalean-insurtech/prompts/verifications/verify-sprint-{cumul}.md
```

Le fichier de verification contient :
- {NOMBRE} criteres de validation
- Auto-reparation pour les criteres recuperables
- Generation automatique du rapport `sprint{cumul}-verify-report.md`
- Calcul du score global et statut GO/NO-GO

**Score minimum requis pour GO** : 95%
**Score minimum requis pour GO CONDITIONNEL** : 85%
**En dessous de 85%** : NO-GO, le sprint doit etre repris

Apres execution, lire le rapport :

```bash
cat sprint{cumul}-verify-report.md
```

Si le statut est GO ou GO CONDITIONNEL, executer le commit de cloture du sprint :

```bash
git add sprint{cumul}-verify-report.md
git commit -m "chore(sprint-{cumul}): close sprint {cumul} with verification report

- Score global : {SCORE}%
- Statut : {GO|GO CONDITIONNEL}
- Phase : {X}
- Sprint : {cumul} (Phase {X} / Sprint {Y})

Sprint {cumul} completed."
```
```

---

## SECTION 8 -- RESUME DU WORKFLOW

Section recapitulative avec diagramme ASCII :

```markdown
## RESUME DU WORKFLOW

```
[Demarrage Sprint {cumul}]
   |
   v
[Tache {X}.{Y}.1] -> compile -> tests -> commit
   |
   v
[Tache {X}.{Y}.2] -> compile -> tests -> commit
   |
   v
   ...
   |
   v
[Tache {X}.{Y}.{N}] -> compile -> tests -> commit
   |
   v
[Verification automatique sprint -- {NB} criteres]
   |
   v
[Rapport sprint{cumul}-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint {cumul+1}
[Score >= 85%] -> GO CONDITIONNEL -> hot fix puis commit
[Score < 85%]  -> NO-GO -> reprise du sprint
```

**Duree totale estimee** : {X heures} ({Y heures par tache en moyenne}).

**Volume code attendu** : {Z lignes} de code TypeScript + {W lignes} de tests.

**Modules skalean-insurtech affectes** : {liste packages}.

**Apport metier principal** : {une phrase synthetique}.

**Prerequis pour Sprint {cumul+1}** : {ce qui doit etre PASS dans la verification}.
```

**Exemple Sprint 13** :

```markdown
## RESUME DU WORKFLOW

```
[Demarrage Sprint 13]
   |
   v
[Tache 4.4.1: etude passerelles MA] -> documentation -> commit
   |
   v
[Tache 4.4.2: Strategy/Adapter pattern] -> compile -> tests -> commit
   |
   v
[Tache 4.4.3: Schema PostgreSQL pay_*] -> migrations -> tests -> commit
   |
   v
[Tache 4.4.4: Interface IPaymentGateway] -> compile -> tests -> commit
   |
   v
[Taches 4.4.5-4.4.10: 6 adapters passerelles MA] -> tests sandbox -> commits
   |
   v
[Tache 4.4.11: Orchestrateur selection + fallback] -> tests -> commit
   |
   v
[Tache 4.4.12: Webhooks securises] -> tests securite -> commit
   |
   v
[Tache 4.4.13: Anti-fraude via Skalean AI Agents] -> tests -> commit
   |
   v
[Tache 4.4.14: Page checkout unifiee] -> tests E2E -> commit
   |
   v
[Tache 4.4.15: Reconciliation Books] -> tests integration -> commit
   |
   v
[Tache 4.4.16: Tests integration globaux] -> tests sandbox 6 passerelles -> commit
   |
   v
[Verification automatique 287 criteres]
   |
   v
[Rapport sprint13-verify-report.md]
   |
   v
[Score >= 95%] -> GO -> commit cloture sprint -> Sprint 14
```

**Duree totale estimee** : 80 heures (5 heures par tache en moyenne).

**Volume code attendu** : ~6 800 lignes de code TypeScript + ~3 400 lignes de tests.

**Modules skalean-insurtech affectes** : packages/horizontal-pay-ma/, packages/database/, packages/shared-events/, packages/shared-skalean-ai-client/.

**Apport metier principal** : skalean-insurtech peut accepter les paiements de toutes les cartes marocaines (CMI, YouCan Pay, PayZone) plus les wallets mobiles (Inwi Money, Orange Money, M-Wallet BAM) avec orchestration intelligente selon profil payeur, anti-fraude et reconciliation comptable automatique.

**Prerequis pour Sprint 14** : Sprint 13 GO complet, les 6 passerelles testees en sandbox, reconciliation Books fonctionnelle.
```

---

## SECTION 9 -- COMMANDES DE LANCEMENT

Section finale avec les commandes que l'humain execute pour declencher l'orchestration :

```markdown
## COMMANDES DE LANCEMENT

Pour lancer l'execution complete du Sprint {cumul} via Claude Code :

```bash
# 1. Se placer a la racine du monorepo
cd skalean-insurtech

# 2. Verifier que le repo est dans un etat propre (pas de modifications en attente)
git status

# 3. Verifier que le sprint precedent est bien termine
git log --oneline | head -5
# Verifier la presence du commit "chore(sprint-{cumul-1}): close sprint {cumul-1}"

# 4. Lancer Claude Code et donner cet orchestrateur en input
# claude-code execute skalean-insurtech/prompts/sprints/orchestrateur-sprint-{cumul}.md

# 5. Attendre la fin de l'execution (peut prendre plusieurs heures)

# 6. Lire le rapport de verification produit
cat sprint{cumul}-verify-report.md

# 7. Si GO : passer au Sprint {cumul+1}
# Si GO CONDITIONNEL : appliquer les hot fixes manuels puis re-lancer la verification
# Si NO-GO : analyser les FAIL et reprendre les taches problematiques
```

**Variables d'environnement requises** avant lancement :

```bash
# Database
export DATABASE_URL="postgresql://insurtech_user:..."
export REDIS_HOST="localhost"
export REDIS_PORT="6379"
export REDIS_PASSWORD="..."

# Skalean AI service externe
export SKALEAN_AI_BASE_URL="https://api.skalean.ai"
export SKALEAN_AI_API_KEY="..."
export SKALEAN_AI_MCP_URL="https://mcp.skalean.ai"

# Variables specifiques au sprint
{Variables specifiques, ex pour Sprint 13 :}
export CMI_SANDBOX="true"
export CMI_MERCHANT_ID="..."
export CMI_API_KEY="..."
export YOUCAN_PAY_SANDBOX="true"
export YOUCAN_PAY_PUBLIC_KEY="..."
export YOUCAN_PAY_PRIVATE_KEY="..."
export PAYZONE_SANDBOX="true"
export PAYZONE_API_KEY="..."
export INWI_MONEY_SANDBOX="true"
export ORANGE_MONEY_SANDBOX="true"
export MWALLET_BAM_SANDBOX="true"
{etc pour chaque passerelle}
```
```

---

## CONVENTIONS SPECIFIQUES PAR PHASE

### Phase 1 (Infrastructure) -- Sprints 1 a 4

Les orchestrateurs incluent une note speciale : aucun module metier dans cette phase, focus sur le squelette technique. Les commits utilisent principalement les types `chore`, `build`, `ci`.

### Phase 2 (Auth Multi-tenant RBAC) -- Sprints 5 a 7

Les orchestrateurs insistent sur les tests d'isolation tenant -- bloquant si un test echoue. Pas de progression sans isolation prouvee.

### Phase 3 (Skalean AI Client) -- Sprints 8 et 9

Les orchestrateurs incluent une section sur la configuration du mock server Skalean AI pour les tests CI. Aucun appel reel a Skalean AI en CI -- uniquement mock.

### Phase 4 (Modules Horizontaux) -- Sprints 10 a 15

Les orchestrateurs verifient que chaque module reste utilisable independamment avant de passer aux verticaux. Tests d'integration croisee obligatoires en fin de sprint.

### Phase 5 (Vertical Insure / Broker) -- Sprints 16 a 20

Les orchestrateurs incluent les variables specifiques aux 5 connecteurs assureurs marocains et aux scenarios sandbox de souscription. Configuration agent Sky en debut de sprint 5.4.

### Phase 6 (Vertical Repair / Garage) -- Sprints 21 a 25

Les orchestrateurs incluent les variables Skalean AI Agents pour estimation IA et anti-fraude. Tests de precision modeles obligatoires (>= 85% accuracy).

### Phase 7 (Cross-tenant) -- Sprint 26

L'orchestrateur insiste sur les tests d'isolation stricte ET de revocation immediate.

### Phase 8 (InsurTech Admin) -- Sprints 27 a 29

Les orchestrateurs verifient que les KPIs cross-tenant respectent l'isolation -- jamais d'acces aux donnees brutes des tenants depuis l'admin.

### Phase 9 (Hardening) -- Sprints 30 et 31

Les orchestrateurs incluent les commandes de pentest externe et de tests de charge k6. Aucun GO si vulnerabilite High ou Critical residuelle.

### Phase 10 (Pilote) -- Sprint 32

L'orchestrateur n'execute qu'une partie des taches automatiquement -- le pilote 30 jours est par nature manuel et necessite de la coordination humaine avec les equipes garage et courtiers.

---

## CONVENTIONS DE QUALITE

### C1 -- Lisibilite humaine
Le fichier orchestrateur doit etre lisible par un developpeur humain en moins de 15 minutes. Pas de jargon non explique, pas de commandes opaques.

### C2 -- Auto-suffisance
Le fichier doit suffire a Claude Code pour executer le sprint sans intervention humaine, dans la mesure du possible.

### C3 -- Tracabilite
Chaque action executee est tracee : commit Git, log Pino, entree dans `sprint{cumul}-verify-report.md`. Aucune action invisible.

### C4 -- Reproductibilite
Le sprint peut etre rejoue depuis le debut sur un environnement vierge en suivant strictement l'orchestrateur.

### C5 -- Aucune emoji
Verifie dans le fichier orchestrateur lui-meme et dans toutes les commandes. Regle absolue.

---

## VALIDATION FINALE DU TEMPLATE

Pour qu'un fichier orchestrateur soit considere conforme :

1. Le titre niveau 1 respecte le format `# ORCHESTRATEUR SPRINT {cumul} -- Phase {X} / Sprint {Y} : {Nom}`
2. Les 3 lignes d'en-tete sont presentes (titre, nombre taches, mention "AUCUNE EMOJI AUTORISEE")
3. Les 9 sections obligatoires sont presentes dans l'ordre
4. Les regles d'execution critiques sont citees verbatim (invariantes entre sprints)
5. Les regles absolues skalean-insurtech sont citees verbatim plus regles supplementaires phase si applicable
6. La section CONTEXTE PHASE explique la position du sprint dans la phase
7. Chaque tache du sprint a son bloc d'execution (but, lecture, actions, validation, commit)
8. La section verification pointe vers le fichier `verify-sprint-{cumul}.md` correct
9. Le resume du workflow est present avec diagramme ASCII
10. Les commandes de lancement sont completes avec variables d'environnement
11. Aucune emoji n'est presente dans aucune section
12. Le nom du fichier respecte `orchestrateur-sprint-{cumul}.md`

---

**Fin du template `05-template-orchestrateur.md`.**

**Suite naturelle** : Pour produire un sprint complet de skalean-insurtech, suivre cet ordre de creation :

1. Creer chaque fichier `task-{X}.{Y}.{Z}-prompt.md` selon `03-template-task.md`
2. Compiler le fichier consolide `sprint-{cumul}-prompt-complet.md` selon `02-template-sprint.md`
3. Creer le fichier `verify-sprint-{cumul}.md` selon `04-template-verification.md`
4. Creer le fichier `orchestrateur-sprint-{cumul}.md` selon ce template

Les 4 fichiers travaillent ensemble pour permettre l'execution autonome d'un sprint par Claude Code, avec verification automatique et generation de rapport.
