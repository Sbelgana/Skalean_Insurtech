# TEMPLATE -- FICHIER TACHE INDIVIDUELLE

**Usage** : Ce template guide la creation d'un fichier `task-{X}.{Y}.{Z}-prompt.md` qui contient le prompt complet d'une tache individuelle a executer par Claude Code.

**Fichier cible** : `prompts/tasks/task-{X}.{Y}.{Z}-prompt.md`

**Convention de numerotation** :
- `{X}` = numero de phase (1 a 10)
- `{Y}` = numero de sprint dans la phase (1, 2, 3, ...)
- `{Z}` = numero de tache dans le sprint (1, 2, 3, ...)

---

## STRUCTURE COMPLETE D'UNE TACHE

Une tache contient 11 sections obligatoires dans l'ordre suivant. Toute deviation invalide la tache.

```markdown
# TACHE {X}.{Y}.{Z} : {Titre court}

## METADONNEES
## CONTEXTE
## OBJECTIF
## ETAT ACTUEL DU REPO
## REFERENCES CONFIGURATION
## IMPLEMENTATION REQUISE
## TESTS REQUIS
## CRITERES DE VALIDATION
## COMMANDES A EXECUTER
## NOTES IMPORTANTES
```

---

## SECTION 1 -- TITRE

```markdown
# TACHE {X}.{Y}.{Z} : {Titre court}
```

**Exemples valides** :
- `# TACHE 1.1.1 : Initialisation Monorepo pnpm + Turborepo`
- `# TACHE 4.4.5 : Adapter CMI -- Integration API officielle 3D Secure 2`
- `# TACHE 6.2.7 : Service Estimation IA via Skalean AI Agents`
- `# TACHE 10.1.13 : Bilan Pilote 30 jours avec Metriques Cibles`

**Regles** :
- Titre informatif et autonome
- Pas d'emoji, pas de caracteres exotiques
- Maximum 80 caracteres
- En francais (jargon technique en anglais conserve)

---

## SECTION 2 -- METADONNEES

```markdown
## METADONNEES
- Phase: {X} -- {Nom phase}
- Sprint: {Y} -- {Nom sprint}
- Priorite: {P0|P1|P2}
- Duree estimee: {N} heures
- Dependances: {Liste taches prerequis ou "Aucune"}
- Dashboard concerne: {Nom app ou "N/A (infrastructure transverse)"}
- Roles impactes: {Liste roles ou "N/A (setup initial)"}
```

**Regles de priorite** :
- **P0** = critique, bloque le sprint si echec, doit etre 100% PASS
- **P1** = importante, peut etre completee en hot-fix post-sprint si necessaire
- **P2** = nice-to-have, peut etre reportee au sprint suivant sans impact bloquant

**Convention dependances** :
- Premiere tache du sprint : `Dependances: Sprint precedent termine`
- Si depend d'une tache anterieure du meme sprint : `Dependances: Tache {X}.{Y}.{Z-1}`
- Si plusieurs : separateur virgule

**Convention dashboards** :
- web-broker, web-garage, web-garage-mobile, web-insurtech-admin
- N/A si infrastructure transverse

**Convention roles** :
- SuperAdminPlatform, AdminTenant
- Phase 5 Broker : Courtier, Gestionnaire, Souscripteur, Comptable, Assure
- Phase 6 Garage : ChefAtelier, Technicien, Receptionniste, Comptable
- AnalystSupport (transverse)

---

## SECTION 3 -- CONTEXTE

Section narrative en prose qui explique :

1. La place de cette tache dans la Phase et le Sprint
2. Le code et les modules existants sur lesquels elle s'appuie
3. Le besoin metier ou technique qu'elle satisfait
4. Les implications pour les taches suivantes

**Longueur** : 3 a 6 paragraphes, chacun de 4 a 8 lignes.

**Style** :
- Phrases completes, pas de bullet points
- Explication causale (pourquoi cette tache existe)
- Pas de jargon non explique
- Aucune emoji

**Exemple** (Tache 4.4.5 -- Adapter CMI) :

```markdown
## CONTEXTE

Cette tache implemente l'adapter CMI dans le module orchestrateur de paiement multi-passerelles marocaines. Le CMI (Centre Monetique Interbancaire) est l'epine dorsale historique des paiements en ligne au Maroc, fonde en 2004 par 9 banques marocaines. Il accepte toutes les cartes bancaires marocaines (Visa, Mastercard, CMI) emises par les banques locales et impose le protocole 3D Secure 2 pour la securite.

A ce stade du Sprint 4.4 (Pay MA Multi-Passerelles), le package `@insurtech/horizontal-pay-ma` a ete initialise (Tache 4.4.2) et l'architecture Strategy + Adapter pattern a ete mise en place (Tache 4.4.3). Le schema PostgreSQL avec les tables `pay_transactions`, `pay_gateways_config`, `pay_webhooks_log` et `pay_refunds` est operationnel (Tache 4.4.4). Cette tache implemente concretement le premier des 6 adapters de passerelles.

L'adapter CMI doit gerer trois flux principaux. Le premier est l'initialisation d'une transaction : reception du montant en MAD, generation d'un identifiant unique, calcul du hash SHA-512 selon les specifications CMI, redirection vers la page de paiement securisee CMI. Le second est le retour utilisateur apres saisie carte : verification du hash retour, mise a jour du statut transaction, declenchement de l'event Kafka `insurtech.events.pay.transaction.captured`. Le troisieme est la reception du webhook asynchrone CMI : verification de la signature, idempotence, replay protection.

Apres cette tache, le module pay-ma supportera CMI en production. Les 5 autres adapters (YouCan Pay, PayZone, Inwi Money, Orange Money, M-Wallet BAM) seront implementes dans les taches suivantes du sprint avec un pattern similaire mais adapte aux specificites de chaque API.
```

---

## SECTION 4 -- OBJECTIF

Liste claire et atomique de ce que la tache doit livrer.

```markdown
## OBJECTIF

{Titre synthetique en une ligne}

- {Livrable 1 concret et verifiable}
- {Livrable 2 concret et verifiable}
- ...
```

**Regles** :
- Chaque bullet verifiable independamment
- Pas de bullets vagues -- preferer "implementer", "creer", "valider"
- 5 a 12 bullets typiquement
- Couvre code, tests, documentation, integration

---

## SECTION 5 -- ETAT ACTUEL DU REPO

Description factuelle de ce qui existe au moment ou la tache demarre.

```markdown
## ETAT ACTUEL DU REPO

A ce stade du Sprint {X}.{Y} :

- Le package `@insurtech/horizontal-pay-ma` existe avec sa structure de base
- Les fichiers `src/gateways/base-gateway.ts` et `src/gateways/index.ts` ont ete crees a la Tache {X}.{Y}.{Z-2}
- Le schema PostgreSQL est en place avec les tables `pay_transactions`, `pay_gateways_config`, `pay_webhooks_log`, `pay_refunds`
- Les types TypeScript partages sont definis dans `src/types/payment.types.ts`
- Les variables d'environnement CMI ne sont pas encore configurees -- elles seront ajoutees dans cette tache

Les modules suivants de skalean-insurtech sont disponibles et utilisables :
- `@insurtech/shared-config` pour la lecture des variables d'environnement
- `@insurtech/shared-events` pour la publication Kafka
- `@insurtech/shared-utils` pour les fonctions de hash et formatage
- `@insurtech/database` pour l'acces TypeORM aux tables PostgreSQL
- `@insurtech/auth` pour authentification multi-tenant et RBAC
- `@insurtech/shared-skalean-ai-client` pour appels Skalean AI (si necessaire)
```

---

## SECTION 6 -- REFERENCES CONFIGURATION

```markdown
## REFERENCES CONFIGURATION

- Stack: `1-stack-technique.yaml` sections `{section1}`, `{section2}`, ...
- Env: `2-variables-environnement.env` variables `{VAR1}`, `{VAR2}`, ...
- Packages partages utilises: `{liste packages}` ou `aucun`

Versions de reference issues de la stack technique :
- {Outil 1} : {version}
- {Outil 2} : {version}
- ...
```

**Exemple** (Tache 4.4.5 CMI) :

```markdown
## REFERENCES CONFIGURATION

- Stack: `1-stack-technique.yaml` sections `payment`, `security`, `events`
- Env: `2-variables-environnement.env` variables `CMI_MERCHANT_ID`, `CMI_API_KEY`, `CMI_HASH_SECRET`, `CMI_WEBHOOK_URL`, `CMI_3DS_ENABLED`, `CMI_SANDBOX`
- Packages partages utilises: `@insurtech/shared-config`, `@insurtech/shared-events`, `@insurtech/shared-utils`, `@insurtech/database`, `@insurtech/auth`

Versions de reference issues de la stack technique :
- Node.js : 22.20.0 (LTS)
- TypeScript : 5.7.3
- NestJS : 10.4.x
- node-forge : 1.3.1 (signature SHA-512)
- axios : 1.7.x (client HTTP CMI)
```

---

## SECTION 7 -- IMPLEMENTATION REQUISE

Section principale et la plus volumineuse. Decrit en detail tout ce qui doit etre implemente.

**Sous-sections typiques** :

```markdown
## IMPLEMENTATION REQUISE

### Structure de Fichiers a Creer

[arbre de fichiers complet]

### Contrats d'Interface

[interfaces TypeScript a respecter]

### Logique Metier Critique

[algorithmes, flows, calculs sensibles]

### Securite

[verifications obligatoires, pieges a eviter]

### Integration avec skalean-insurtech

[dependances modules existants]

### Migrations Base de Donnees

[scripts SQL ou migrations TypeORM si applicable]

### Variables d'Environnement

[liste complete avec valeurs sandbox et prod]

### Endpoints API a exposer

[methode, route, body, response, codes erreur]

### Events Kafka a publier ou consommer

[topic insurtech.events.*, schema event, conditions de declenchement]

### Appels Skalean AI (si applicable)

[modules Automate/Chat/Agents utilises, prompts, attendus, fallbacks]
```

**Style** :
- Code complet pour les interfaces et structures critiques
- Pseudo-code pour les algorithmes complexes
- Commentaires en francais expliquant les decisions techniques
- Mention systematique des regles skalean-insurtech (multi-tenant, Pino, Zod, argon2id)

**Longueur** : 200 a 800 lignes selon complexite. Sprint 4.4 (paiement) ou Sprint 6.2 (IA) auront les sections d'implementation les plus volumineuses.

---

## SECTION 8 -- TESTS REQUIS

Specifie tous les tests Vitest que la tache doit produire. Tests obligatoires.

```markdown
## TESTS REQUIS

### Tests Unitaires (`*.spec.ts`)

Fichier `src/gateways/cmi.gateway.spec.ts` :
- Test 1 : description et resultat attendu
- Test 2 : ...

Fichier `src/gateways/cmi.hash.spec.ts` :
- ...

### Tests d'Integration (`*.integration.spec.ts`)

Fichier `src/gateways/cmi.gateway.integration.spec.ts` :
- Test 1 : appel sandbox CMI avec carte test 4111111111111111
- Test 2 : verification webhook avec payload sandbox
- ...

### Couverture Cible
- Lignes : minimum 85%
- Branches : minimum 80%
- Fonctions : minimum 90%

### Tests E2E (si applicable)
Fichier `tests/e2e/cmi-payment-flow.e2e.spec.ts` (Playwright) :
- Scenario 1 end-to-end navigateur
- ...
```

**Regles** :
- Chaque fichier `.ts` du code de production a son `.spec.ts` correspondant
- Tests unitaires : Vitest uniquement (jamais Jest, Mocha, etc.)
- Mocks : `vi.fn()` (Vitest natif)
- Tests d'integration : base PostgreSQL test-only avec rollback systematique
- Tests E2E : Playwright

---

## SECTION 9 -- CRITERES DE VALIDATION

Liste enumerée des points qui seront verifies automatiquement par `verify-sprint-{cumul}.md`.

```markdown
## CRITERES DE VALIDATION

### Critere V1 : Fichiers crees
- [ ] Le fichier `src/gateways/cmi.gateway.ts` existe et exporte la classe `CmiGateway`
- [ ] Le fichier `src/gateways/cmi.gateway.spec.ts` existe avec au moins 12 tests
- [ ] Le fichier `docs/cmi-onboarding.md` existe et fait au moins 200 lignes

### Critere V2 : Compilation et types
- [ ] `pnpm tsc --noEmit` passe sans erreur dans `packages/horizontal-pay-ma`
- [ ] La classe `CmiGateway` implemente entierement l'interface `IPaymentGateway`
- [ ] Aucun usage de type `any` implicite ou explicite

### Critere V3 : Tests
- [ ] `pnpm vitest run packages/horizontal-pay-ma/src/gateways/cmi` retourne 100% PASS
- [ ] La couverture est superieure a 85% (lignes)
- [ ] Au moins 3 tests d'integration sandbox passent

### Critere V4 : Conformite skalean-insurtech
- [ ] Toutes les requetes DB filtrent sur `tenant_id`
- [ ] Aucun usage de `console.log` -- uniquement `this.logger` Pino
- [ ] Aucune emoji dans le code, commentaires ou logs
- [ ] La validation des inputs utilise Zod (jamais class-validator)

### Critere V5 : Securite paiement
- [ ] Le hash SHA-512 est calcule cote serveur uniquement
- [ ] Le webhook CMI verifie la signature avant tout traitement
- [ ] L'idempotence est garantie sur les transactions (cle unique merchant_id + order_id)
- [ ] Le replay protection est actif (timestamp dans une fenetre de 5 minutes)

### Critere V6 : Events Kafka
- [ ] L'event `insurtech.events.pay.transaction.captured` est publie apres confirmation CMI
- [ ] L'event `insurtech.events.pay.transaction.failed` est publie apres echec
- [ ] Le payload des events respecte le schema defini dans `@insurtech/shared-events`

### Critere V7 : Compliance ACAPS
- [ ] Chaque transaction CMI declenche une entree dans `compliance_acaps_audits`
- [ ] L'audit contient tenant_id, user_id, amount, gateway, timestamp, status
```

**Convention** :
- Chaque critere a un identifiant `V{n}` reutilisable
- Criteres P0 marques explicitement -- 100% PASS requis
- Tests concrets, pas subjectifs

---

## SECTION 10 -- COMMANDES A EXECUTER

Liste sequentielle bash que Claude Code execute apres avoir implemente.

```markdown
## COMMANDES A EXECUTER

### Etape 1 : Validation TypeScript
```bash
cd packages/horizontal-pay-ma
pnpm tsc --noEmit
```

### Etape 2 : Lint
```bash
pnpm eslint src/gateways/cmi.gateway.ts --max-warnings 0
```

### Etape 3 : Tests unitaires
```bash
pnpm vitest run src/gateways/cmi.gateway.spec.ts --coverage
```

### Etape 4 : Tests d'integration sandbox
```bash
CMI_SANDBOX=true CMI_MERCHANT_ID=test_merchant pnpm vitest run src/gateways/cmi.gateway.integration.spec.ts
```

### Etape 5 : Commit
```bash
cd ../..
git add packages/horizontal-pay-ma/
git add docs/cmi-onboarding.md
git commit -m "feat(pay-ma): implement CMI gateway adapter with 3D Secure 2

- Add CmiGateway class implementing IPaymentGateway
- Add SHA-512 hash generation per CMI v2 spec
- Add transaction init with 3DS2 redirection
- Add webhook reception with signature verification
- Add idempotency and replay protection
- Add unit tests with 85%+ coverage
- Add sandbox integration tests
- Add merchant onboarding documentation

Task: 4.4.5
Sprint: 13 (Phase 4 / Sprint 4)
Phase: 4"
```

**Regles strictes commit** :
- Format Conventional Commits (`feat`, `fix`, `chore`, `docs`, `test`, `refactor`)
- Le scope indique le module concerne
- Le pied de page mentionne obligatoirement Task, Sprint (cumul + phase/sprint), Phase
- Aucune emoji dans les messages de commit

---

## SECTION 11 -- NOTES IMPORTANTES

Section finale qui consigne les pieges, points de vigilance, decisions architecturales explicites.

```markdown
## NOTES IMPORTANTES

### Note 1 : Securite des secrets CMI
Les variables `CMI_API_KEY` et `CMI_HASH_SECRET` ne doivent JAMAIS etre commitees, ni apparaitre dans les logs Pino. Le `2-variables-environnement.env.example` contient des placeholders, le fichier `.env` reel est dans `.gitignore` et stocke dans Vault.

### Note 2 : Comportement en cas d'echec partiel
Si la signature CMI retournee differe de celle calculee localement, le service NE DOIT PAS marquer la transaction comme reussie meme si le statut indique "success". Toujours faire confiance a la signature.

### Note 3 : Sandbox vs Production
Le mode sandbox CMI utilise des cartes test (4111111111111111). Ne JAMAIS executer le code en production avec un merchant ID sandbox.

### Note 4 : Conformite ACAPS
Cette tache produit des transactions financieres auditees par l'ACAPS. Le tracking complet (qui, quand, combien, statut, gateway) est obligatoire et fait partie de la conformite legale.

### Note 5 : Performance
L'appel a CMI peut prendre jusqu'a 8 secondes en production (incluant 3DS2). Le timeout cote serveur skalean-insurtech doit etre fixe a 12 secondes pour laisser une marge.
```

---

## REGLES TRANSVERSALES POUR TOUTES LES TACHES skalean-insurtech

### Regle T1 -- Multi-tenant strict
Chaque service implementant un endpoint filtre obligatoirement sur `tenant_id` ET valide la presence du header `x-tenant-id` via `TenantGuard`. Aucune exception meme pour les endpoints "publics".

### Regle T2 -- Audit trail systematique
Chaque ecriture sur les tables `insure_*`, `repair_*`, `pay_*` declenche obligatoirement une entree dans `compliance_acaps_audits` avec qui, quand, quoi, ancien etat, nouvel etat, contexte technique.

### Regle T3 -- Donnees residentes au Maroc
Aucune donnee d'assure final, de police, de sinistre, ou de paiement ne doit transiter par un datacenter hors Maroc. Le module `compliance-acaps` valide a chaque ecriture critique.

### Regle T4 -- Multilinguisme
Toute communication generee (notifications, emails, WhatsApp) doit etre disponible en Francais, Darija et Arabe classique. Templates utilisent le pattern i18n etabli en Phase 1.

### Regle T5 -- Anti-fraude par defaut
Toute interface acceptant des montants, des photos ou des reclamations sinistre passe obligatoirement par les modules anti-fraude (via Skalean AI Agents).

### Regle T6 -- Skalean AI client externe
Aucun module skalean-insurtech ne reimplemente de LLM, de RAG, de vector store, ou de MCP server. Tous les besoins IA passent par `@insurtech/shared-skalean-ai-client` qui appelle les modules Automate, Chat, Agents de Skalean AI en service externe.

---

**Fin du template `03-template-task.md`.**
**Voir `04-template-verification.md` pour le format des fichiers de verification automatique.**
