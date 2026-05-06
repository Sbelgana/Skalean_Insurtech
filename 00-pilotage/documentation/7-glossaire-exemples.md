# GLOSSAIRE ET EXEMPLES skalean-insurtech v2.0

**Version** : 2.0.0
**Date** : 2026-05-04
**Description** : Dictionnaire technique et metier exhaustif du projet skalean-insurtech
**AUCUNE EMOJI AUTORISEE**

**Changelog v2.0** :
- Ajout ~30 nouveaux termes lies aux flux clients et nouvelles apps
- Mise a jour entrees existantes pour refleter les changements

---

## INTRODUCTION

Ce glossaire definit precisement chaque terme utilise dans le projet skalean-insurtech. Tout terme metier, technique, ou reglementaire doit etre defini ici en priorite avant utilisation dans le code, la documentation, ou les communications.

Les definitions sont volontairement detaillees pour eviter toute ambiguite. Les exemples concrets sont privilegies sur les definitions abstraites.

---

## TERMES METIER ASSURANCE MAROC

### ACAPS

Autorite de Controle des Assurances et de la Prevoyance Sociale. Regulateur du secteur de l'assurance au Maroc. Skalean InsurTech doit etre conforme aux exigences ACAPS du Programme Emergence (cas d'usage 02, 03, 04, 07).

### Assure

Personne physique ou morale beneficiaire d'une police d'assurance. Dans skalean-insurtech, l'assure est un role utilisateur de niveau 3 ayant acces a `web-assure-portal` (desktop) et `web-assure-mobile` (PWA). Permissions : lecture sur ses polices, ecriture uniquement sur ses declarations sinistre.

### Assureur

Compagnie d'assurance qui emet les polices et indemnise les sinistres. Au Maroc, les 5 leaders connectes a Skalean sont Wafa Assurance, Atlanta Sanad, Saham Assurance, RMA Watanya, AXA Maroc.

### Avenant

Modification d'une police d'assurance en cours de contrat. Exemples : changement d'adresse, ajout d'un conducteur, augmentation de garantie. Genere via `vertical-insure` -- table `insure_avenants`.

### Bareme

Tableau de tarification des reparations utilise par les garages agrees pour calculer le devis sinistre. Chaque assureur publie ses propres baremes par categorie de vehicule. Stockes dans `repair_baremes`.

### Cas d'usage 02 (ACAPS)

Comparaison et selection de produits d'assurance en ligne. Skalean Broker couvre ce cas via `vertical-insure` -- comparateur multi-assureurs.

### Cas d'usage 03 (ACAPS)

Souscription en ligne de produits d'assurance. Skalean Broker couvre ce cas via le wizard de souscription dans web-broker (et **NOUVEAU v2.0** via web-customer-portal pour le flux public).

### Cas d'usage 04 (ACAPS)

Gestion de la relation client courtier (CRM, suivi polices, communication). Skalean Broker couvre ce cas via `horizontal-crm` + `horizontal-comm-wa` + `horizontal-comm-email`.

### Cas d'usage 07 (ACAPS)

Gestion des sinistres et reparations. Skalean Garage couvre ce cas via `vertical-repair` + IA d'estimation par photos.

### CIN

Carte d'Identite Nationale marocaine. Document obligatoire pour identification client lors de la souscription. **NOUVEAU v2.0** : OCR automatique via Skalean AI agent `kyc-cin-extraction-v1` lors du flux pre-approbation web-customer-portal.

### Commission

Montant verse au courtier par l'assureur en remuneration de la vente d'une police. Calculee selon un bareme par produit. Reconciliee mensuellement entre Skalean et l'assureur via `insure_commissions`.

### Constat amiable

Document standard rempli par les conducteurs apres un accident de la route. Photographie ou scan obligatoire dans la declaration sinistre cote assure (web-assure-mobile). Stockage S3.

### Contrat-cadre

Convention etablie entre un courtier et un assureur definissant les conditions commerciales (commissions, produits accessibles, baremes). Hors perimetre Skalean -- gere off-platform.

### Conformite Loi 09-08

Loi marocaine equivalente au RGPD europeen, supervisee par la CNDP (Commission Nationale de controle de la protection des Donnees a caractere Personnel). Obligations clefs : consentement explicite, residence Maroc des donnees, procedures de purge sur demande, notification breach sous 72h.

### Conformite Loi 43-20

Loi marocaine sur la signature electronique au Maroc, completee par le decret 2-23-335. Exige l'utilisation d'un tiers de confiance certifie (Barid eSign), un hash SHA-512, un horodatage qualifie RFC 3161, et un archivage legal cryptographique pendant 10 ans.

### Courtier

Intermediaire commercial entre l'assure et l'assureur. Titulaire d'une licence ACAPS. Role utilisateur dans skalean-insurtech ayant acces a `web-broker`. Vend des polices, percoit des commissions, voit les sinistres en lecture seule (**M9 v2.0**).

### Cross-tenant authorization (mise a jour v2.0)

Mecanisme permettant a un tenant d'autoriser un autre tenant a acceder a certaines ressources. **v2.0** : 3 types distincts :
- `client_to_garage` : assure autorise garage agree a gerer son sinistre (cree quand l'assure choisit son garage)
- `broker_readonly_garage` : courtier visualise sinistres de ses clients en lecture seule (via vues materialisees, pas d'acces direct au tenant garage)
- `admin_temporary_access` : Skalean Admin acces temporaire pour support

Stocke dans `cross_tenant_authorizations` avec scope JSONB et expiration.

### Devis (assurance)

Estimation chiffree d'une police d'assurance produite par un assureur en reponse a une demande. Stocke dans `insure_devis`. Status : draft, compared, selected, validated, expired. TTL 7 jours.

### Devis (sinistre)

Estimation chiffree de la reparation d'un vehicule produite par un garage. Stocke dans `repair_devis`. Genere automatiquement par IA estimation photos (Sprint 24) ou manuellement.

### Document provisoire (NOUVEAU v2.0)

Document d'assurance temporaire genere immediatement apres pre-approbation KYC (flux web-customer-portal). Signe electroniquement par le prospect via tiers de confiance loi 43-20. Valide 7 jours en attente de validation finale par le courtier puis emission de la police definitive par l'assureur. Stocke dans `assure_provisional_policies`.

### Garage agree (mise a jour v2.0)

Garage automobile autorise par un assureur a effectuer des reparations dans le cadre des sinistres assures par ce dernier. Reseau referentiel synchronise quotidiennement depuis API assureur via `getGaragesAgrees()`. Stocke dans `assureur_garages_agrees`. Liaison optionnelle avec un tenant Skalean Garage si le garage est aussi client de la plateforme.

### Garantie

Couverture specifique d'une police d'assurance (ex : RC, vol, incendie, bris de glace, dommages tous risques). Stockee dans `insure_garanties` avec montant maximum, franchise, exclusions.

### ICE

Identifiant Commun de l'Entreprise au Maroc, code 15 chiffres obligatoire pour toute societe. Verification automatique de format dans `horizontal-crm` -- table `crm_companies`.

### Indemnisation

Montant verse par l'assureur a l'assure (ou directement au garage) pour reparer un dommage couvert. Hors perimetre Skalean (gere par l'assureur), mais Skalean Garage facture l'assureur via API et trace le paiement dans `pay_transactions`.

### KYC (NOUVEAU v2.0 -- amplifie)

Know Your Customer. Processus de verification d'identite et eligibilite d'un nouveau client. Dans skalean-insurtech, le KYC est automatise via Skalean AI Agents :
- OCR CIN (`kyc-cin-extraction-v1`)
- Anti-fraude statistique (`fraud-souscription-v1`)
- Verification ICE/RC pour professionnels

Score eligibilite calcule. Seuils configurables via env :
- `KYC_AUTO_APPROVAL_THRESHOLD=0.85` -> auto-approbation
- `KYC_MANUAL_REVIEW_THRESHOLD=0.65` -> escalade humaine
- `KYC_AUTO_REJECT_THRESHOLD=0.30` -> rejet automatique

### Loi 09-08

Voir "Conformite Loi 09-08".

### Loi 43-20

Voir "Conformite Loi 43-20".

### Numero de police

Identifiant unique d'une police d'assurance, attribue par l'assureur au moment de l'emission definitive. Format variable selon assureur. Stocke dans `insure_polices.policy_number`.

### Police d'assurance

Contrat formel entre un assure et un assureur. Stockee dans `insure_polices` avec dates debut/fin, garanties actives, prime annuelle, contact, assureur. Cycle de vie : draft -> quoted -> signed -> active -> renewed/cancelled/expired.

### Pre-approbation (NOUVEAU v2.0)

Etape automatique post-KYC dans le flux web-customer-portal. Si score KYC >= 0.85 : pre-approbation automatique. Si entre 0.65 et 0.85 : escalade vers validation manuelle courtier. Si < 0.30 : rejet automatique avec raison documentee. Apres pre-approbation, le document provisoire est genere et envoye au prospect pour signature.

### Prospect (NOUVEAU v2.0)

Visiteur de web-customer-portal qui n'a pas encore cree de compte. Pas un role authentifie. Devient `Assure` apres inscription complete + souscription d'une police. Sessions Redis TTL 30 min. Donnees PII non persistees en DB avant consentement explicite + creation de compte.

### Prime

Montant paye par l'assure pour beneficier de la couverture. Peut etre annuelle ou mensualisee. Stockee dans `insure_polices.amount_annual` et `amount_monthly`.

### Renouvellement

Action de prolonger une police d'assurance arrivant a expiration. Geree automatiquement par `insure_renouvellements` avec rappels J-60, J-30, J-7. Cree automatiquement un nouveau devis a J-30.

### RC

Responsabilite Civile. Garantie obligatoire au Maroc pour les vehicules a moteur. Couvre les dommages causes a des tiers.

### Sinistre

Evenement declenchant une garantie d'assurance (accident, vol, bris, incendie, etc.). Le client en declare un via `web-assure-mobile`. Apres choix du garage agree, le sinistre est gere de A a Z par le garage via `vertical-repair` (workflow 10 etats : received -> diagnosis -> quoted -> validated -> in_repair -> quality_check -> invoiced -> returned -> closed).

### Souscripteur

Personne authorisee par un courtier a souscrire des polices au nom du cabinet. Role utilisateur niveau 2 dans skalean-insurtech, distinct du Courtier titulaire de la licence ACAPS.

### Sync catalogue assureurs (NOUVEAU v2.0)

Job cron quotidien (3h du matin Africa/Casablanca) qui appelle chaque connecteur assureur pour rafraichir le referentiel local : produits actifs, garanties disponibles, baremes commissions, reseau garages agrees. Stockage Redis (TTL 24h) + DB pour fallback. Sans cette sync, web-customer-portal ne pourrait pas fournir de cotations actualisees.

### Tiers de confiance

Organisme certifie par l'autorite marocaine pour delivrer des signatures electroniques conformes loi 43-20. Skalean utilise Barid eSign comme tiers principal. Hors perimetre Skalean en termes de developpement (consomme via API).

---

## TERMES TECHNIQUES SKALEAN-INSURTECH

### Adapter pattern

Pattern de conception utilise pour les connecteurs assureurs et passerelles de paiement. Permet de cacher les specificites techniques de chaque API derriere un contrat unifie (`IAssureurConnector` ou `IPaymentGateway`).

### App clientes (NOUVEAU v2.0)

Designe les 3 nouvelles apps de la v2.0 : `web-customer-portal` (prospects publics), `web-assure-portal` (assures connectes desktop), `web-assure-mobile` (assures sur mobile PWA). Distinguees des "apps SaaS B2B" (web-broker, web-garage, web-garage-mobile, web-insurtech-admin).

### Audit ACAPS

Journal d'audit detaille de toute action critique sur les tables `insure_*`, `repair_*`, `pay_*`. Stocke dans `compliance_acaps_audits` avec qui, quand, quoi, ancien etat, nouvel etat, contexte technique. Genere automatiquement via TypeORM EventSubscriber.

### Authorization type (NOUVEAU v2.0)

Champ `authorization_type` ajoute a `cross_tenant_authorizations` pour distinguer les 3 categories d'autorisations cross-tenant (voir "Cross-tenant authorization").

### Broker validation queue (NOUVEAU v2.0)

File d'attente cote courtier pour valider les souscriptions provenant du flux web-customer-portal. Visible dans `/broker/admin/validation-queue`. SLA 24h configurable via `BROKER_VALIDATION_SLA_HOURS`. Vue SQL `v_broker_validation_queue`.

### Circuit breaker

Pattern de conception pour proteger contre les pannes en cascade. Si un service externe (Skalean AI, assureur, passerelle paiement) echoue 5 fois consecutives, le circuit ouvre pendant 60s, retournant immediatement une erreur sans appeler le service.

### Customer Portal (NOUVEAU v2.0)

Voir "web-customer-portal".

### Comparateur multi-assureurs

Service `ComparateurDevis` qui appelle en parallele les 5 connecteurs assureurs (Promise.allSettled) pour produire des devis comparables en moins de 10 secondes. Utilise dans le wizard web-broker (vente agence) et web-customer-portal (vente en ligne).

### Cotation matching (NOUVEAU v2.0)

Capacite Skalean AI agent `cotation-matching-v1` qui prend en entree les criteres prospect et les retours bruts des 5 assureurs, classe par pertinence (prix vs profil), et ajoute des recommandations contextuelles. Latence cible p95 8000ms.

### Document provisoire (NOUVEAU v2.0)

Voir partie metier ci-dessus.

### File d'attente courtier (NOUVEAU v2.0)

Voir "Broker validation queue".

### Geolocation HTML5

API native du navigateur pour obtenir position GPS de l'utilisateur. Utilisee dans `web-assure-mobile` pour :
- Capture lieu sinistre lors de la declaration
- Tri garages agrees par distance dans le choix garage

Precision cible : 50m. Timeout 5s.

### IAssureurConnector (mise a jour v2.0)

Interface TypeScript du contrat unifie pour tous les connecteurs assureurs. **Methodes v2.0** :
- `getDevis(input: DevisInput): Promise<DevisOutput>`
- `souscrire(input: SouscriptionInput): Promise<SouscriptionOutput>`
- `declarerSinistre(input: SinistreInput): Promise<SinistreOutput>` -- **NOUVEAU v2.0**
- `getGaragesAgrees(input: GaragesAgreesInput): Promise<GaragesAgreesOutput>` -- **NOUVEAU v2.0**
- `getCommissions(period: Period): Promise<CommissionsOutput>`
- `healthCheck(): Promise<HealthStatus>`
- `syncCatalog(): Promise<CatalogSyncResult>` -- **NOUVEAU v2.0**

### Mapbox (NOUVEAU v2.0)

Service externe SaaS de cartographie utilise pour :
- Geocoding adresses garages agrees
- Carte interactive choix garage (web-assure-mobile)
- Visualisation reseau partenaires (web-customer-portal)

Token via `MAPBOX_ACCESS_TOKEN`. Library cliente : `mapbox-gl` 3.x + `react-map-gl` 7.x.

### MCP

Model Context Protocol. Utilise pour les operations Skalean AI long-running ou interactives (>30s) : analyse photos sinistres, voice transcribe darija, generation documents structures. Connexion WebSocket persistante.

### Monorepo

Architecture de depot Git ou plusieurs apps et packages cohabitent dans une meme structure de fichiers. skalean-insurtech utilise pnpm workspaces + Turborepo. **v2.0** : 8 apps, 16 packages.

### Multi-tenant

Architecture ou plusieurs clients (tenants) partagent la meme infrastructure logicielle, isoles via `tenant_id` sur chaque table. **v2.0** : 4 niveaux :
- Niveau 0 : Skalean (plateforme)
- Niveau 1 : Cabinet courtier OU garage
- Niveau 2 : Utilisateurs internes
- Niveau 3 : Assures finaux (NOUVEAU v2.0)

### NPS

Net Promoter Score. Indicateur de satisfaction client mesure via une question simple ("Recommanderiez-vous ?"). Cible projet : NPS > 30 a la fin du pilote Marrakech.

### Patterns 13-17 (NOUVEAU v2.0)

Patterns de generation de code ajoutes en v2.0 :
- Pattern 13 : Page publique web-customer-portal
- Pattern 14 : PWA mobile capture camera + voix
- Pattern 15 : Cross-tenant authorization client -> garage
- Pattern 16 : Service backend KYC pre-approbation
- Pattern 17 : Composant carte Mapbox garages agrees

Voir `4-templates-generation.md`.

### PII

Personally Identifiable Information. Donnees personnelles identifiantes. **v2.0** : pour les prospects (avant inscription web-customer-portal), aucune PII n'est persistee en DB -- uniquement Redis TTL 30 min ou sessionStorage chiffre cote client.

### PWA (mise a jour v2.0)

Progressive Web App. Application web installable comme app native, fonctionnant offline, supportant push notifications. **v2.0** : 2 apps PWA dans skalean-insurtech :
- `web-garage-mobile` (technicien atelier)
- `web-assure-mobile` (assure mobile)

Lighthouse PWA score >= 90 obligatoire.

### Rate limiting

Limitation du nombre de requetes par utilisateur ou IP par minute/heure. **v2.0** : limites distinctes par type d'endpoint :
- `/api/v1/public/*` : 30/min/IP, 100/heure/IP
- `/api/v1/*` authentifie : 300/min/user
- `/api/v1/admin/*` : 600/min/user

### Skalean AI

Service externe Skalean fournissant LLM (Sky multilingue), Agents IA configurables, Workflows Automate (n8n), MCP server. Consomme via `@insurtech/shared-skalean-ai-client`. **v2.0** : 7 agents identifies + 3 MCP tools utilises.

### Strategy pattern

Pattern de conception ou plusieurs algorithmes interchangeables sont selectionnes au runtime. Utilise pour la selection de la passerelle paiement optimale (CMI vs YouCan Pay vs Inwi Money etc.) selon le profil payeur.

### Tenant root

Tenant unique de niveau 0 representant Skalean lui-meme. Utilise pour les operations administratives globales (web-insurtech-admin).

### Tiers de confiance

Voir definition metier ci-dessus.

### TTL

Time To Live. Duree de vie d'une donnee en cache ou DB. **v2.0 -- TTL importants** :
- Sessions prospects : 30 min (Redis)
- Documents provisoires : 7 jours
- Cache catalogue assureurs : 24h
- Audits ACAPS : 7 ans
- Archives signatures : 10 ans

### Vault

HashiCorp Vault. Gestionnaire de secrets en production. Toutes les API keys, mots de passe DB, certificats sont stockes dans Vault et charges au demarrage.

### Voice darija (NOUVEAU v2.0)

Capacite de transcription voix darija (dialecte arabe marocain) disponible via Skalean AI MCP tool `voice-transcribe-ma`. Utilisee dans web-assure-mobile pour declaration sinistre rapide. Latence cible p95 4000ms. Sample rate 16kHz.

### Wizard

Formulaire multi-etapes guidant l'utilisateur. Utilise pour :
- Souscription police (web-broker, vente agence)
- Cotation prospect (web-customer-portal, vente en ligne)
- Declaration sinistre (web-assure-mobile)

State management via Zustand store, sauvegarde intermediaire pour reprise.

---

## TERMES INFRASTRUCTURE

### App Router (Next.js)

Convention de routing introduite en Next.js 13+. Obligatoire dans skalean-insurtech (Next.js 15). Pas de Pages Router.

### Argon2id

Algorithme de hash de mot de passe recommande OWASP. Parametres v2.0 : memoryCost 65536 KB, timeCost 3, parallelism 4. EXCLUSIVEMENT cet algorithme -- jamais bcrypt.

### Custom session states (NOUVEAU v2.0)

Voir "customer_session_states" dans tables.

### Domains v2.0

8 sous-domaines :
- `api.skalean-insurtech.ma` (API)
- `broker.skalean-insurtech.ma` (web-broker)
- `garage.skalean-insurtech.ma` (web-garage)
- `garage-app.skalean-insurtech.ma` (web-garage-mobile)
- `admin.skalean-insurtech.ma` (web-insurtech-admin)
- `assurance.skalean-insurtech.ma` (web-customer-portal -- NOUVEAU)
- `mon-espace.skalean-insurtech.ma` (web-assure-portal et web-assure-mobile -- NOUVEAU)

### Endpoint public (NOUVEAU v2.0)

Endpoint API sans authentification, prefixe `/api/v1/public/*`. Rate-limite a 30/min/IP. Utilise par web-customer-portal pour cotation/comparaison sans inscription. Garde `PublicEndpointGuard` (rate limiting + sanitization headers).

### Kafka

Apache Kafka 3.7. Event bus du projet. Topics prefixes `insurtech.events.<vertical>.<entite>.<action>`. **v2.0 -- nouveaux topics** : prospect.*, assure.*, broker.*, crosstenant.*.

### KRaft

Mode coordination Kafka sans Zookeeper, introduit en Kafka 3.x. Utilise dans skalean-insurtech pour simplifier l'infrastructure.

### Lighthouse

Outil Google d'audit qualite frontend. **v2.0 -- cibles differenciees** :
- web-customer-portal : Performance >= 95, SEO >= 95
- web-garage-mobile, web-assure-mobile : PWA >= 90
- Autres apps : Performance >= 90, Accessibility >= 90

### NestJS

Framework backend Node.js base sur TypeScript. Version 10.4.x dans skalean-insurtech. HTTP adapter Fastify (plus performant qu'Express).

### Next.js

Framework frontend React. Version 15 dans skalean-insurtech. Obligatoire avec App Router.

### Pino

Logger Node.js performant. EXCLUSIVEMENT utilise dans skalean-insurtech. Jamais `console.log`. Injection NestJS via `nestjs-pino`.

### pnpm

Package manager Node.js fast et efficient. EXCLUSIVEMENT utilise dans skalean-insurtech. Jamais npm ni yarn. Version 9.15.0.

### PostgreSQL

Base de donnees relationnelle principale. Version 16. Extensions : uuid-ossp, pgcrypto, pg_trgm, pgvector. Pooling via PgBouncer.

### Redis

Cache et broker Pub/Sub. Version 7.4. Persistence AOF. **v2.0 -- usage par DB** :
- DB 0 : sessions auth
- DB 1 : BullMQ queues
- DB 2 : cache Skalean AI
- DB 3 : sessions prospects (NOUVEAU)

### Service Worker

Script JavaScript executant en background du navigateur. Auto-registre via next-pwa. Cache strategies definies dans `runtimeCaching`. Active sur web-garage-mobile et web-assure-mobile.

### TypeORM

ORM TypeScript pour PostgreSQL. Version 0.3.x. `synchronize: false` strict en production. Migrations versionnees dans `packages/database/src/migrations`.

### Turborepo

Build system pour monorepos. Version 2.4.0. Cache local + remote optionnel. Pipelines : build, test, lint, typecheck, dev.

### Vitest

Framework de tests unitaires. Version 2.x. EXCLUSIVEMENT utilise (jamais Jest). Couverture cible : 85% lignes, 80% branches, 90% fonctions.

### Volta

Version manager Node.js. OBLIGATOIRE dans skalean-insurtech pour eviter les incompatibilites Node 25+ qui cassent argon2 et Next.js 15. Pin Node 22.20.0 + pnpm 9.15.0.

### Workbox

Library Google pour service workers PWA. Version 7.x. Utilisee via next-pwa pour les apps web-garage-mobile et web-assure-mobile.

### Zod

Library de validation TypeScript-first. Version 3.23.x. EXCLUSIVEMENT utilisee dans skalean-insurtech (jamais class-validator). Pipe global `ZodValidationPipe`.

---

## EXEMPLES DE NOMMAGE

### Tables PostgreSQL

Pattern strict `<module>_<entite>` :

| Module | Entite | Nom table |
|--------|--------|-----------|
| auth | tenants | auth_tenants |
| auth | users | auth_users |
| crm | contacts | crm_contacts |
| insure | polices | insure_polices |
| insure | sinistres | insure_sinistres_lite |
| repair | sinistres | repair_sinistres |
| pay | transactions | pay_transactions |
| compliance | acaps_audits | compliance_acaps_audits |
| **prospect** | quote_requests | prospect_quote_requests **(NOUVEAU v2.0)** |
| **assure** | provisional_policies | assure_provisional_policies **(NOUVEAU v2.0)** |
| **assureur** | garages_agrees | assureur_garages_agrees **(NOUVEAU v2.0)** |

### Topics Kafka

Pattern strict `insurtech.events.<vertical>.<entite>.<action>` :

| Topic | Description |
|-------|-------------|
| insurtech.events.auth.user.created | Nouveau user cree |
| insurtech.events.insure.police.signed | Police signee |
| insurtech.events.insure.police.activated | Police activee |
| insurtech.events.repair.sinistre.received | Sinistre recu garage |
| insurtech.events.pay.transaction.captured | Paiement capture |
| **insurtech.events.prospect.quote.requested** | Cotation demandee **(NOUVEAU v2.0)** |
| **insurtech.events.assure.sinistre.declared** | Sinistre declare cote assure **(NOUVEAU v2.0)** |
| **insurtech.events.assure.garage.selected** | Garage agree choisi **(NOUVEAU v2.0)** |
| **insurtech.events.crosstenant.client_garage.authorized** | Autorisation client/garage creee **(NOUVEAU v2.0)** |
| **insurtech.events.broker.validation_required** | Courtier doit valider une souscription **(NOUVEAU v2.0)** |

### Variables d'environnement

Prefixes obligatoires :
- `WAFA_*`, `ATLANTA_*`, `SAHAM_*`, `RMA_*`, `AXA_*` : assureurs
- `CMI_*`, `YOUCAN_PAY_*`, `PAYZONE_*`, `INWI_MONEY_*`, `ORANGE_MONEY_*`, `MWALLET_BAM_*` : passerelles
- `SKALEAN_AI_*` : Skalean AI
- `WEB_*_URL` : URLs des apps
- **`MAPBOX_*`** : Mapbox **(NOUVEAU v2.0)**
- **`POSTHOG_*`** : analytics marketing **(NOUVEAU v2.0)**
- **`KYC_*`** : KYC pre-approbation **(NOUVEAU v2.0)**

### Endpoints API

Pattern strict `/api/v1/<module>/<resource>/<action?>` :

| Endpoint | Description |
|----------|-------------|
| GET /api/v1/auth/me | Mes infos |
| POST /api/v1/insure/polices | Creer police |
| POST /api/v1/insure/polices/:id/sign | Signer police |
| POST /api/v1/repair/sinistres | Creer sinistre garage |
| POST /api/v1/pay/webhooks/cmi | Webhook CMI |
| **GET /api/v1/public/quote/start** | Demarrer cotation prospect **(NOUVEAU v2.0)** |
| **POST /api/v1/public/account/create** | Creer compte apres cotation **(NOUVEAU v2.0)** |
| **GET /api/v1/assure/policies** | Mes polices (assure) **(NOUVEAU v2.0)** |
| **POST /api/v1/assure/sinistres/declare** | Declarer sinistre (assure) **(NOUVEAU v2.0)** |
| **GET /api/v1/assure/sinistres/:id/garages-available** | Liste garages agrees **(NOUVEAU v2.0)** |
| **POST /api/v1/assure/sinistres/:id/select-garage** | Choisir garage agree **(NOUVEAU v2.0)** |
| **GET /api/v1/broker/queue/pending-validations** | File validation courtier **(NOUVEAU v2.0)** |

### Roles utilisateurs

11 roles definis (inchanges entre v1.0 et v2.0 mais permissions etendues) :

- Niveau 0 : SuperAdminPlatform, AnalystSupport
- Niveau 1 : AdminTenant
- Niveau 2 : Courtier, Gestionnaire, Souscripteur, ChefAtelier, Technicien, Receptionniste, Comptable
- Niveau 3 : Assure (permissions strictes : read polices, write declarations sinistre uniquement)

Le **Prospect** (web-customer-portal sans compte) n'est PAS un role -- c'est un visiteur public anonyme. Il devient `Assure` apres inscription.

---

## CONVENTIONS DE COMMIT

Format Conventional Commits avec footer obligatoire :

```
{type}({scope}): {description courte}

- {Bullet 1}
- {Bullet 2}

Task: X.Y.Z
Sprint: {cumul} (Phase X / Sprint Y)
Phase: X
```

Types : feat, fix, refactor, docs, test, chore, perf, style, ci, build.

Scopes courants : auth, multi-tenant, rbac, broker, garage, admin, customer-portal (NOUVEAU v2.0), assure-portal (NOUVEAU v2.0), pay, signature, ai, kyc (NOUVEAU v2.0).

Exemple v2.0 :
```
feat(customer-portal): add prospect quote start endpoint

- Implements POST /api/v1/public/quote/start
- Validates Zod schema with consents required
- Stores quote_request with TTL 30 days
- Triggers async cotation matching to 5 insurers
- Adds rate limiting 30/min/IP

Task: 5.6.3
Sprint: 21 (Phase 5 / Sprint 6)
Phase: 5
```

---

**Fin du document `7-glossaire-exemples.md` v2.0.**

**~30 nouveaux termes ajoutes pour la v2.0 -- ~180 termes au total.**

---

## TERMES NOUVEAUX v2.2

### MCP (Model Context Protocol)

**Definition** : Standard ouvert (Anthropic) pour connecter LLMs a tools metier via JSON-RPC. Skalean InsurTech expose ses tools metier via **MCP server** (Sprint 30 -- port 4001) consume par Skalean AI agents (Sprint 31 -- Sky chatbot).

**Acronymes** :
- **MCP server** : Notre serveur expose tools (port 4001 -- `apps/mcp-server`)
- **MCP client** : Skalean AI / Sky agent qui consume tools
- **Tool** : Operation metier exposee (e.g. `get_policy_by_number`, `book_appointment`)
- **Discovery** : Endpoint `GET /mcp/v1/discover` qui retourne tools + schemas
- **Capability check** : Verification tenant_subtype peut invoquer tool (Sprint 25 integration)

### Sky (Agent IA multilingue)

**Definition** : Chatbot IA multilingue integre 4 apps (web-broker / web-garage / web-customer-portal / web-assure-portal) -- Sprint 31. Utilise Skalean AI conversational + MCP tools metier.

**Composants** :
- `packages/sky` : agent orchestrator + system prompts + MCP client
- `packages/sky-ui` : chat widget shared (streaming + markdown + voice-to-text)
- `sky_conversations` + `sky_messages` : tables persistance
- 16 system prompts (4 apps x 4 locales)

**Locales supportees** :
- `fr` : Francais (default)
- `ar-MA` : Darija marocaine (vernaculaire)
- `ar` : Arabe classique
- `en` : English (Maghreb context)

### M8 (Workflow sinistre client)

**Definition** : Premier flux marche MA permettant declaration sinistre par assure directement sur PWA mobile (Sprint 24) -- routage automatique vers garage choisi -- traitement complet sans courtier actif dans la chaine.

**Etapes M8** :
1. Declaration mobile (photos + geolocation + voix darija transcrite)
2. Routage cross-tenant (Sprint 25) vers garage Atlas ou partenaire
3. Garage reception + diagnostic
4. Reparation + facturation split insurer/customer
5. Customer satisfaction + cloture

**Cible** : sinistre traite end-to-end < 24h (vs 5 jours marche initial).

### Atlas (Skalean Atlas)

**Definition** : Garage interne Skalean -- premier seed Type 1 tenant Repair (Sprint 19). Sert de **reference operationnelle** pour la plateforme + premiere demonstration pilote Marrakech (Sprint 35).

**Type tenant** : Type 1 Atlas (vs Type 2 managed_partner / Type 3 api_partner).
**Capabilities** : full ERP + management complete.

**Note disambiguation** : "Atlas" peut referer a :
- **Skalean Atlas** : garage interne Skalean (entity metier)
- **Atlas Cloud Services** : provider cloud souverain MA hosting production (decision-008 -- infrastructure)

### Atlas Cloud Services

**Definition** : Cloud souverain marocain retenu pour hosting production Skalean InsurTech (decision-008 v2.2 -- remplace OVHcloud).

**Datacenters** :
- DC1 Benguerir : Tier III Uptime Institute
- DC2 Benguerir : Tier IV Uptime Institute (DR + critical workloads)

**Certifications** : ISO 9001/14001/27001/27017/27018/22301 + SOC1 Type 1 + SOC2 Type 2 + HIPAA + PCI DSS.

**Solutions** : Atlasx.Cloud (portail unifie) + Atlasx.Hub (modernization apps) + Atlasx.AI (data fabric).

**Strategic alignment** : ACAPS + Barid Maroc + Bank Al-Maghrib deja clients = coherence ecosystem regulators MA.

### AI-defere (Pattern Mock -> Real)

**Definition** : Pattern strategique consistant a livrer mock realistic Sprint X et real swap Sprint Y (decision-007).

**Application Skalean InsurTech** :
- Sprint 20 : `MockIaEstimationClient` (mock realistic vision)
- Sprint 29 : `SkaleanAiVisionClient` (real Skalean AI integration)
- Swap : `IA_ESTIMATION_PROVIDER=mock` -> `skalean_ai` (one-line config)

**Rollout strategy** : Sprint 29 (10% real / 90% mock) -> Sprint 30 (50/50) -> Sprint 31 (100% real).

### Ecosystem-defere (Pattern lookup -> connecteurs)

**Definition** : Pattern strategique consistant a defere les integrations ecosystem externe en Phase 7 (decision-010).

**Application Skalean InsurTech** :
- Sprint 14 : tarification via lookup tables (data assureurs cached)
- Sprint 32 : tarification via 5 connecteurs API real-time (Wafa+Atlanta+Saham+RMA+AXA)

**Rationale** : partenariats commerciaux + sandboxes acquisition AVANT integration. ACAPS Programme Emergence ne demande pas connecteurs reels.

### WebAuthn (Authentification biometrique)

**Definition** : Standard W3C pour authentification passwordless via biometric (Touch ID, Face ID, USB security keys). Implemente Sprint 23 pour `web-garage-mobile` -- technicien login biometric atelier.

**Table** : `auth_webauthn_credentials` (Sprint 23 -- voir 3-schemas-database-v2.2-additions.sql).

**Use case Skalean** : technicien atelier touchera son ecran (Touch ID iOS / Fingerprint Android) -- pas de saisie password en gants graisseux.

### Cloud souverain

**Definition** : Cloud hosted dans le pays de l'entreprise cliente, sous juridiction legale de ce pays, avec personnel local et certifications conformes.

**Skalean InsurTech** : production hostee Atlas Cloud Services Benguerir = cloud souverain MA conformite CNDP loi 09-08 (decision-008).

**Avantage strategique** : argument commercial vs competitors (premiere InsurTech 100% souveraine MA).

### Idempotency-Key

**Definition** : Header HTTP RFC standard pour eviter doublons sur mutations (POST/PUT/PATCH). Format UUID v4. Cache Redis dedup pendant fenetre temporelle.

**Application Skalean** :
- API endpoints mutations : header obligatoire
- MCP tools write : header obligatoire (Sprint 30)
- Webhooks Type 3 partners : header obligatoire (Sprint 25)
- Dedup window : 1h (Redis)

### Tier III / Tier IV (Uptime Institute)

**Definition** : Standards Uptime Institute pour datacenters :
- **Tier III** : 99.982% disponibilite (SLA equivalent)
- **Tier IV** : 99.995% disponibilite (fault tolerant)

**Skalean Production** : Atlas Cloud Services DC1 Benguerir Tier III + DC2 Benguerir Tier IV (DR strategy).

### Loi 17-99 (article 9 -- droit retract 30j)

**Definition** : Article 9 du Code des Assurances MA (loi 17-99) accordant a l'assure particulier (B2C uniquement) un **droit de retractation de 30 jours** apres souscription -- remboursement integral sans penalty.

**Application Skalean** : Sprint 15 resiliation police -- field `policies.is_b2c` flag + audit conformite ACAPS.

---

## CHANGELOG GLOSSAIRE

- **v1.0** : 150 termes initial
- **v2.0** : ~50 termes ajoutes (PWA, KYC, Mapbox, cross-tenant, customer-portal, M8, etc.)
- **v2.2** : 11 termes nouveaux ajoutes (MCP, Sky, M8, Atlas, Atlas Cloud Services, AI-defere, ecosystem-defere, WebAuthn, Cloud souverain, Idempotency-Key, Tier III/IV, Loi 17-99 article 9)

**Total termes glossaire v2.2** : ~210.

---
