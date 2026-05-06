# PLAN DE REALISATION skalean-insurtech -- PARTIE 2/3 v2.0

(Suite directe de `01-plan-realisation-PARTIE1.md`)

**Version** : 2.0.0
**Date** : 2026-05-04
**Description** : Phases 5-7 du plan -- Skalean Broker (etendu avec apps clientes), Skalean Garage (etendu avec flux sinistre client), Cross-tenant
**AUCUNE EMOJI AUTORISEE**

**Changelog v2.0** :
- Phase 5 : ajout Sprint 21 (web-customer-portal) et Sprint 22 (web-assure-portal + web-assure-mobile)
- Phase 6 : renumerotation cumul (23-28 au lieu de 21-25) + ajout Sprint 28 (Flux Sinistre Client)
- Phase 7 : Cross-tenant authorization etendue avec autorisation client/garage

---

## 5. PHASE 5 -- SKALEAN BROKER + APPS CLIENTES (7 SPRINTS) v2.0

**Objectif phase** : Construire le module vertical Insure avec ses connecteurs assureurs, le SaaS Broker complet (web-broker app), et les 3 apps clientes (web-customer-portal pour prospects, web-assure-portal et web-assure-mobile pour assures).

**Pourquoi en cinquieme position** : la Phase 4 a fourni tous les modules horizontaux (CRM, Booking, Comm, Docs, Pay, Books, Compliance, Analytics). On compose maintenant le SaaS metier en y ajoutant le module vertical specifique a l'assurance, puis on ouvre les flux client (vente en ligne et espace assure).

**Prerequis** : Phases 1, 2, 3, 4 completes. Accords API avec les 5 assureurs marocains a anticiper -- demarrer les negociations 6 mois avant ce sprint.

**Cumul sprints** : Sprints 16 a 22 (7 sprints au lieu de 5 en v1.0).

**Apport business jalon J3 (mois 6)** : Skalean Broker v1.0 deployable apres Sprint 20.
**Apport business jalon J4 (mois 7)** : Apps clientes deployees apres Sprint 22 -- vente en ligne possible.

### Sprint 5.1 (cumul 16) -- Vertical Insure Foundation

**Objectif sprint** : Etablir le socle du module vertical assurance et les modeles de donnees.

**Taches** (13) -- INCHANGE v1.0 :

- 5.1.1 Initialisation package `@insurtech/vertical-insure`
- 5.1.2 Schema PostgreSQL : tables `insure_assureurs`, `insure_produits`, `insure_garanties`
- 5.1.3 Schema PostgreSQL : tables `insure_devis`, `insure_polices`, `insure_avenants`
- 5.1.4 Schema PostgreSQL : tables `insure_sinistres_lite` (cote courtier), `insure_commissions`, `insure_renouvellements`
- 5.1.5 Module NestJS `InsureModule` avec services CRUD de base
- 5.1.6 Validation Zod : schemas pour devis, polices, avenants, sinistres, commissions
- 5.1.7 Events Kafka `insurtech.events.insure.*` (publishers et consumers)
- 5.1.8 Audit trail via Compliance ACAPS (Phase 4) sur chaque ecriture
- 5.1.9 Roles InsurTech : Courtier, Gestionnaire, Souscripteur, Assure -- liaison avec RBAC Phase 2
- 5.1.10 Seeds dev : 5 assureurs (Wafa, Atlanta, Saham, RMA, AXA), produits, garanties typiques
- 5.1.11 Tests unitaires et integration (couverture 85% minimum)
- 5.1.12 Storybook composants UI primitifs assurance
- 5.1.13 Documentation OpenAPI Swagger pour endpoints Insure

**Pourquoi cet ordre** : Tables (5.1.2-5.1.4) avant services (5.1.5). Validation Zod (5.1.6) avant services qui l'utilisent. Events (5.1.7) avant audit trail (5.1.8) qui ecoute des events.

### Sprint 5.2 (cumul 17) -- Connecteurs Assureurs Marocains (etendu v2.0)

**Objectif sprint** : Connecter les 5 assureurs majeurs marocains via leurs APIs avec un contrat unifie etendu pour la vente, le sinistre et la sync catalogue.

**Taches** (15) :

- 5.2.1 Connector base abstrait `BaseAssureurConnector` avec contrat type `IAssureurConnector` etendu v2.0 :
  - getDevis (existant)
  - souscrire (existant)
  - **declarerSinistre (NOUVEAU v2.0)** -- pour le flux sinistre client
  - **getGaragesAgrees (NOUVEAU v2.0)** -- pour permettre choix garage par client
  - getCommissions (existant)
  - **syncCatalog (NOUVEAU v2.0)** -- pour sync quotidienne produits/garanties/baremes
  - healthCheck (existant)
- 5.2.2 Connecteur Wafa Assurance : implementation des 6 methodes du contrat
- 5.2.3 Connecteur Atlanta Sanad : implementation des 6 methodes
- 5.2.4 Connecteur Saham Assurance : implementation des 6 methodes
- 5.2.5 Connecteur RMA Watanya : implementation des 6 methodes
- 5.2.6 Connecteur AXA Maroc : implementation des 6 methodes
- 5.2.7 ConnectorRegistry + factory pattern pour selection dynamique
- 5.2.8 ComparateurDevis -- appel parallele 5 assureurs (Promise.allSettled, p95 <= 10s)
- 5.2.9 **Cron job sync catalogue assureurs (NOUVEAU v2.0)** -- quotidien 3h Africa/Casablanca
- 5.2.10 **Service GaragesAgreesSyncService (NOUVEAU v2.0)** -- met a jour `assureur_garages_agrees` en DB
- 5.2.11 Mock servers locaux pour les 5 connecteurs (Express + ports 9001-9005)
- 5.2.12 Anti-fraude pre-soumission via Skalean AI Agent `fraud-souscription-v1`
- 5.2.13 Cache Redis sur reponses non-personnelles (catalogue, baremes -- TTL 24h)
- 5.2.14 Tests integration sandbox 5 assureurs + tests fallback panne assureur
- 5.2.15 Documentation OpenAPI etendu + guide d'integration assureur

**Pourquoi cet ordre** : Contrat (5.2.1) avant implementations (5.2.2-5.2.6). Sync catalogue (5.2.9) doit etre apres les implementations. Tests (5.2.14) tout a la fin.

### Sprint 5.3 (cumul 18) -- Insure Lifecycle Police complet (etendu v2.0)

**Objectif sprint** : Implementer le cycle de vie complet d'une police : devis, signature, activation, avenants, renouvellement, annulation. **NOUVEAU v2.0** : ajout workflow validation courtier pour les souscriptions arrivant du flux web-customer-portal + workflow document provisoire.

**Taches** (15) :

- 5.3.1 DevisService complet : creation, comparaison, validation, expiration TTL 7j
- 5.3.2 DevisWorkflow state machine (draft -> compared -> selected -> validated -> expired)
- 5.3.3 Endpoint POST /devis/compare utilisant ComparateurDevis Sprint 17
- 5.3.4 PolicesService cycle de vie complet (cree, signe, active, modifie, resilie, renouvelle)
- 5.3.5 PolicesWorkflow state machine (draft -> quoted -> signed -> active -> renewed/cancelled/expired)
- 5.3.6 Integration Pay Sprint 13 + Docs Signature Sprint 12 sur signature police
- 5.3.7 AvenantsService (modifications mid-contract avec impact prime)
- 5.3.8 RenouvellementsService + scheduler (J-60, J-30, J-7 avant fin contrat)
- 5.3.9 CommissionsService + scheduler mensuel + reconciliation Books Sprint 14
- 5.3.10 SinistresLiteService (vue cote courtier, redirige vers Garage Phase 6)
- 5.3.11 **NOUVEAU v2.0 -- BrokerValidationQueueService** : file d'attente des dossiers issus du flux web-customer-portal en attente de validation courtier
- 5.3.12 **NOUVEAU v2.0 -- ProvisionalPolicyService** : generation document provisoire post-pre-approbation, signature electronique, TTL 7 jours
- 5.3.13 Endpoints REST complets : /devis, /polices, /avenants, /commissions, **/broker/queue (v2.0)**
- 5.3.14 Notifications WhatsApp + Email a chaque etape (multilingue FR/Darija/Arabe)
- 5.3.15 Tests E2E flux complet souscription auto end-to-end

**Pourquoi cet ordre** : Devis avant Polices (logique business). Workflow et services avant endpoints. **NOUVEAU v2.0** : ProvisionalPolicyService (5.3.12) avant BrokerValidationQueue (5.3.11) car la queue contient des provisional policies.

### Sprint 5.4 (cumul 19) -- Agent IA Sky Multilingue

**Objectif sprint** : Integrer l'agent conversationnel Sky pour assister les utilisateurs Skalean Broker dans leur travail quotidien et les prospects pendant la cotation.

**Taches** (12) -- INCHANGE v1.0 :

- 5.4.1 Migration `insure_sky_conversations` selon schema PARTIE2
- 5.4.2 SkyService orchestrateur conversationnel via `@insurtech/shared-skalean-ai-client`
- 5.4.3 ConversationStateService (Redis cache TTL 24h + DB persistence)
- 5.4.4 ToolRouterService -- 5 tools Sky : search_polices, compare_devis, get_garanties, declare_sinistre, get_police_status
- 5.4.5 EscalationService (criteres : sentiment negatif, demande explicite, 3 incomprehensions)
- 5.4.6 System prompts trilingues FR / Darija / Arabe (revus par natifs)
- 5.4.7 KnowledgeBaseService (FAQ insurtech MA, glossaire, >= 50 entrees)
- 5.4.8 Endpoints /sky/start, /sky/message, /sky/escalate
- 5.4.9 WebSocket pour streaming reponses Sky en temps reel
- 5.4.10 Composants UI SkyChatWidget dans web-broker (mobile-first, RTL)
- 5.4.11 Tests automatises Sky (eval framework 100 questions, cible 85% precision)
- 5.4.12 Documentation guide d'utilisation Sky cote courtier

**Pourquoi cet ordre** : Migration avant SkyService. State avant ToolRouter. Streaming WebSocket apres backend complet.

### Sprint 5.5 (cumul 20) -- Web-Broker App + Broker Admin Dashboard (etendu v2.0)

**Objectif sprint** : Construire l'application web-broker complete avec dashboard, pages applicatives, et sous-section Broker Admin Dashboard. **NOUVEAU v2.0** : ajout vue read-only sinistres clients pour courtier (visibilite sans intervention).

**Taches** (15) :

- 5.5.1 Dashboard courtier (KPIs polices actives, MRR, commissions, deals en cours)
- 5.5.2 Page Polices liste (Server Component + filters + bulk actions)
- 5.5.3 Page Police detail (cycle vie + signature + paiement + avenants + audit)
- 5.5.4 Wizard creation police (5 etapes : contact -> comparaison -> selection -> signature -> paiement) -- partage le moteur avec web-customer-portal Sprint 21
- 5.5.5 Pages Contacts + import CSV avec dedup
- 5.5.6 **NOUVEAU v2.0 -- Page Sinistres en LECTURE SEULE** : courtier voit les sinistres de ses clients via vue materialisee `mv_broker_sinistres_clients`
- 5.5.7 Page Commissions (calendrier + rapports + export Excel/PDF)
- 5.5.8 Sky Chat sticky button + integration page
- 5.5.9 Composants UI specifiques broker (PoliceTimeline, GarantieGrid, ComparateurTable)
- 5.5.10 Broker Admin Dashboard : KPIs strategiques (NPS, churn, MRR)
- 5.5.11 Broker Admin : page gestion equipe (utilisateurs cabinet, roles, invitations)
- 5.5.12 Broker Admin : page rapports commissions detailles
- 5.5.13 Broker Admin : page configuration cabinet (assureurs actifs, baremes, branding)
- 5.5.14 **NOUVEAU v2.0 -- Page Validation Queue** : courtier consulte et valide les dossiers prospects issus de web-customer-portal (`v_broker_validation_queue`)
- 5.5.15 Tests E2E Playwright -- 6 scenarios cles utilisateur (1 ajoute pour validation queue)

**Pourquoi cet ordre** : Dashboard avant pages detaillees. **NOUVEAU v2.0** : la page validation queue (5.5.14) doit etre prete a la fin car elle ne marche que si le flux customer-portal genere des dossiers en attente -- mais elle est testable avec des seeds dev.

### Sprint 5.6 (cumul 21) -- NOUVEAU v2.0 -- Web-Customer-Portal (Vente En Ligne Publique)

**Objectif sprint** : Construire l'application publique pour les prospects, optimisee SEO et performance. Permet la cotation, la comparaison, la souscription et la pre-approbation KYC sans inscription prealable.

**Pourquoi nouveau v2.0** : Le projet doit ouvrir un canal commercial direct B2C en complement du flux agence courtier. Premiere offre de souscription assurance en ligne au Maroc avec comparateur multi-assureurs natif.

**Prerequis** : Sprints 16-20 termines (Insure foundation + connecteurs etendus + lifecycle avec validation courtier + Broker app).

**Taches** (16) :

- 5.6.1 Initialisation app `web-customer-portal` (port 3004, domaine `assurance.skalean-insurtech.ma`)
- 5.6.2 Configuration Next.js 15 App Router avec strategies de rendu :
  - SSG pour landing pages
  - ISR pour catalogue produits (revalidate 24h)
  - SSR uniquement pour cotation dynamique
- 5.6.3 SEO complet : next-seo + next-sitemap + structured data JSON-LD
- 5.6.4 Multilingue FR / Darija / Arabe (next-intl + RTL automatique)
- 5.6.5 Initialisation package `@insurtech/customer-portal-services`
- 5.6.6 Migration tables `customer_session_states`, `prospect_quote_requests`, `prospect_quotes_results` selon schema PARTIE3
- 5.6.7 Service ProspectQuoteService -- gestion sessions Redis TTL 30 min
- 5.6.8 Endpoints publics REST `/api/v1/public/quote/*` :
  - POST /start (demarrer cotation)
  - POST /compare (lancer comparaison parallele 5 assureurs)
  - POST /select (selectionner produit)
  - POST /account/create (signup post-selection)
- 5.6.9 PublicEndpointGuard avec rate limiting strict (30/min/IP, 100/heure/IP)
- 5.6.10 CotationMatchingService -- agent Skalean AI `cotation-matching-v1` qui ranke et recommande les resultats des 5 assureurs
- 5.6.11 Migration tables `assure_documents_uploaded`, `assure_provisional_policies` selon schema PARTIE3
- 5.6.12 KycPreApprovalService (pattern 16) -- 2 agents Skalean AI (CIN extraction + fraud scoring), 3 seuils (0.85 / 0.65 / 0.30)
- 5.6.13 ProvisionalPolicyService -- generation PDF + signature electronique loi 43-20 + TTL 7 jours
- 5.6.14 Pages frontales (pattern 13) :
  - Landing page hero + benefits + testimonials
  - /quote/[type] -- formulaire wizard 3 etapes
  - /quote/compare -- table comparative 5 assureurs interactive
  - /quote/select -- selection produit + recap
  - /signup -- creation compte
  - /kyc -- upload pieces justificatives
  - /provisional/sign -- signature document provisoire
  - /payment -- choix passerelle + paiement
  - /thank-you -- confirmation + suivi dossier dans web-assure-portal
- 5.6.15 Analytics PostHog : funnel conversion + session replay 10% + feature flags
- 5.6.16 Tests E2E Playwright -- 4 scenarios cles + tests Lighthouse (Performance >= 95, SEO >= 95, Accessibility >= 95)

**Pourquoi cet ordre** :
- Initialisation app (5.6.1) avant tout
- SEO/multilingue (5.6.3-5.6.4) avant pages
- Tables (5.6.6, 5.6.11) avant services qui les utilisent
- KYC (5.6.12) avant ProvisionalPolicy (5.6.13) car KYC valide avant generer document
- Pages frontales (5.6.14) en dernier car elles consomment tous les services
- Tests Lighthouse (5.6.16) en validation finale

### Sprint 5.7 (cumul 22) -- NOUVEAU v2.0 -- Web-Assure-Portal + Web-Assure-Mobile

**Objectif sprint** : Construire les apps clientes pour assures connectes : version desktop (web-assure-portal) et version mobile PWA (web-assure-mobile). L'assure peut consulter ses polices, ses documents, ses paiements, et **declarer un sinistre rapidement** depuis son telephone.

**Prerequis** : Sprint 21 termine (KYC operationnel, signup fonctionne).

**Taches** (16) :

- 5.7.1 Initialisation app `web-assure-portal` (port 3005, domaine `mon-espace.skalean-insurtech.ma`)
- 5.7.2 Initialisation app `web-assure-mobile` (port 3006, meme domaine, PWA)
- 5.7.3 Configuration PWA next-pwa 5.6 + Workbox 7 (manifest, service worker, runtime caching)
- 5.7.4 Initialisation package `@insurtech/assure-portal-services`
- 5.7.5 Initialisation package `@insurtech/shared-pwa` (service workers configurations partagees)
- 5.7.6 Initialisation package `@insurtech/shared-maps` (composants Mapbox + geolocation hooks)
- 5.7.7 Migration tables `assure_sinistre_declarations`, `assureur_garages_agrees` selon schema PARTIE3
- 5.7.8 AssurePoliciesService -- liste, detail, documents (RBAC Assure niveau 3 strict)
- 5.7.9 AssureSinistresService -- creation declaration, suivi, choix garage
- 5.7.10 Endpoints REST `/api/v1/assure/*` :
  - GET /policies, GET /policies/:id
  - POST /sinistres/declare
  - GET /sinistres/:id/garages-available
  - POST /sinistres/:id/select-garage
  - GET /sinistres/:id/status
  - POST /sinistres/transcribe (voice darija via MCP)
- 5.7.11 GuardCustomerAssureGuard -- valide acces uniquement aux ressources de l'assure
- 5.7.12 Pages web-assure-portal (desktop) :
  - /mon-espace/dashboard
  - /mon-espace/polices
  - /mon-espace/sinistres
  - /mon-espace/documents
  - /mon-espace/paiements
  - /mon-espace/profile
- 5.7.13 Pages web-assure-mobile (PWA) :
  - / (dashboard mobile compact)
  - /polices (liste cards)
  - /sinistres/declarer (wizard 5 etapes)
  - /sinistres/[id]/choisir-garage (carte Mapbox + liste)
  - /sinistres/[id] (suivi temps reel)
- 5.7.14 Composant PhotoCapture (pattern 14) -- camera arriere + compression cote client
- 5.7.15 Composant VoiceDescription (pattern 14) -- RecordRTC + transcription Skalean AI MCP voice-transcribe-ma
- 5.7.16 Composant GaragesMapPicker (pattern 17) -- Mapbox + geolocation + tri par distance + popup interactive
- 5.7.17 Push notifications PWA (VAPID + Web Push API)
- 5.7.18 WebSocket `/ws/assure` pour suivi sinistre temps reel
- 5.7.19 Tests E2E Playwright + tests Lighthouse PWA >= 90 sur les 2 apps (chromium mobile)

**Pourquoi cet ordre** :
- 2 apps initialisees (5.7.1-5.7.2) avant les services
- Packages partages (5.7.5-5.7.6) avant qu'ils soient consommes
- Tables (5.7.7) avant services
- Services + endpoints (5.7.8-5.7.11) avant pages frontales
- Composants natifs PWA (5.7.14-5.7.16) avant pages qui les consomment
- Tests Lighthouse PWA en validation finale

---

## 6. PHASE 6 -- SKALEAN GARAGE + FLUX SINISTRE CLIENT (6 SPRINTS) v2.0

**Objectif phase** : Construire le module vertical Repair (sinistres, devis IA, atelier), le SaaS Garage complet, et le flux sinistre client end-to-end (declaration assure -> routage assureur -> choix garage -> autorisation cross-tenant client/garage).

**Pourquoi en sixieme position** : la Phase 5 a fourni le SaaS Broker complet et les apps clientes. Le flux sinistre client (Sprint 28) requiert la fois l'app `web-assure-mobile` (Sprint 22) ET le SaaS Garage operationnel pour gerer les dossiers.

**Prerequis** : Phases 1-5 completes.

**Cumul sprints** : Sprints 23 a 28 (6 sprints au lieu de 5 en v1.0).

**Apport business jalon J5 (mois 9)** : Skalean Garage v1.0 + flux sinistre client end-to-end.

### Sprint 6.1 (cumul 23) -- Vertical Repair Foundation

**Objectif sprint** : Etablir le socle du module vertical reparation et les modeles de donnees. Sprint anciennement Sprint 21 (cumul 21) en v1.0.

**Taches** (13) -- INCHANGE v1.0 (renumerotation cumul uniquement) :

- 6.1.1 Initialisation package `@insurtech/vertical-repair`
- 6.1.2 Migrations tables `repair_sinistres`, `repair_devis`, `repair_factures`
- 6.1.3 Migrations tables `repair_pieces_remplacees`, `repair_main_oeuvre`
- 6.1.4 Migrations tables `repair_photos_dossier`, `repair_vin_history`, `repair_audits_qualite`, `repair_baremes`
- 6.1.5 Services CRUD de base (Sinistres, Devis, Factures)
- 6.1.6 Services CRUD secondaires (Pieces, Main Oeuvre, Photos, Audits Qualite)
- 6.1.7 Schemas Zod normalises
- 6.1.8 Events Kafka `insurtech.events.repair.*`
- 6.1.9 Audit ACAPS auto sur ecritures `repair_*`
- 6.1.10 VinDecoder integration (decodage VIN auto via NHTSA ou library)
- 6.1.11 Roles InsurTech Garage : ChefAtelier, Technicien, Receptionniste
- 6.1.12 Seeds dev : garage Marrakech avec equipe + baremes 5 assureurs
- 6.1.13 Tests unitaires + integration (couverture 85%)

### Sprint 6.2 (cumul 24) -- IA Estimation Photos

**Objectif sprint** : Integrer l'IA d'estimation des degats par photos via Skalean AI Agents + MCP. Anciennement Sprint 22 en v1.0.

**Taches** (13) -- INCHANGE v1.0 (renumerotation uniquement) :

- 6.2.1 Spec fonctionnelle + agents Skalean AI a configurer (`damage-detection-vision-v1`, etc.)
- 6.2.2 AiEstimationService (orchestrateur)
- 6.2.3 DamageDetectionService (appel agent vision via MCP)
- 6.2.4 PhotoPreprocessorService (sharp resize 2048px + EXIF anonymise)
- 6.2.5 BaremeMatcherService (matching zones detectees -> baremes assureur)
- 6.2.6 AutoDevisGeneratorService (creation `repair_devis` automatique)
- 6.2.7 ConfidenceScorerService (eval confidence + bandeau "verifier humain")
- 6.2.8 Endpoint POST /repair/sinistres/{id}/photos + estimate
- 6.2.9 ReviewerService (validation humaine si confidence < 0.85)
- 6.2.10 UI atelier capture photos guide + previsualisation IA
- 6.2.11 Anti-fraude photos (detection re-utilisation, EXIF altere)
- 6.2.12 Eval framework : 100 cas tests vs ground truth (cible >= 85%)
- 6.2.13 Tests integration sandbox + monitoring confidence en CI

### Sprint 6.3 (cumul 25) -- Sinistre Workflow Complet (Garage)

**Objectif sprint** : Workflow sinistre 10 etats cote garage. Anciennement Sprint 23 en v1.0.

**Taches** (13) -- INCHANGE v1.0 (renumerotation uniquement) :

- 6.3.1 SinistreWorkflow (orchestrateur transitions etats)
- 6.3.2 SinistreStateMachine (XState ou enum + guards)
- 6.3.3 Endpoints REST par transition (10 status)
- 6.3.4 DiagnosticService
- 6.3.5 ValidationDevisService (chef atelier valide / rejette / ajuste)
- 6.3.6 AtelierTrackingService (start/stop interventions, planning equipe)
- 6.3.7 QualityCheckService (checklist + photos finales + audit qualite)
- 6.3.8 FacturationService (generation facture certifiee + integration Books)
- 6.3.9 RestitutionService (notif client + signature reception + cloture)
- 6.3.10 AntiFraudeStatistiqueService (analyse statistique pour fraude)
- 6.3.11 Notifications client a chaque etape (WhatsApp + Email multilingue)
- 6.3.12 Reports SLA atelier : delais moyens + cas long
- 6.3.13 Tests E2E workflow complet end-to-end (10 etats)

### Sprint 6.4 (cumul 26) -- Web-Garage App + Garage Admin Dashboard

**Objectif sprint** : Construire le SaaS Garage complet (web-garage) avec sous-section Garage Admin Dashboard. Anciennement Sprint 24 en v1.0.

**Taches** (13) -- INCHANGE v1.0 (renumerotation uniquement) :

- 6.4.1 Dashboard garage (KPIs dossiers + CA + delais)
- 6.4.2 Page Reception (formulaire entree vehicule + photos)
- 6.4.3 Page Sinistres liste (kanban par statut)
- 6.4.4 Page Sinistre detail (workflow visualise + actions par etat)
- 6.4.5 Page Atelier (planning interventions + tracking en temps reel)
- 6.4.6 Page Qualite (checklist + photos finales + signature audit)
- 6.4.7 Page Facturation (factures en attente + emise + payees)
- 6.4.8 Page Stock (alertes seuil bas + commandes fournisseurs)
- 6.4.9 Page Equipe (planning + rentabilite par technicien)
- 6.4.10 Garage Admin Dashboard : KPIs strategiques (CA, NPS, churn)
- 6.4.11 Garage Admin : page rentabilite (par dossier, technicien, assureur)
- 6.4.12 Garage Admin : page configuration (baremes, branding, equipe)
- 6.4.13 Tests E2E Playwright -- 5 scenarios cles utilisateur

### Sprint 6.5 (cumul 27) -- Web-Garage-Mobile PWA Technicien

**Objectif sprint** : App PWA mobile pour les techniciens en atelier (capture photos, punches, signature client). Anciennement Sprint 25 en v1.0.

**Taches** (12) -- INCHANGE v1.0 (renumerotation uniquement) :

- 6.5.1 Configuration PWA next-pwa + manifest + service worker
- 6.5.2 Composant PhotoCapture mobile-first (camera arriere + compression)
- 6.5.3 Composant PunchTracker (start/stop interventions par dossier + geolocation)
- 6.5.4 Page mes-dossiers (liste + filters)
- 6.5.5 Page dossier detail (vue technicien)
- 6.5.6 Page reception vehicule (capture photos guide)
- 6.5.7 Page execution intervention (timer + photos progress)
- 6.5.8 Signature client tablette (signature electronique reception)
- 6.5.9 Push notifications (assignment dossier, urgence)
- 6.5.10 Mode offline avec sync au retour (queue actions)
- 6.5.11 Tests E2E Playwright + Lighthouse PWA >= 90
- 6.5.12 Documentation guide d'installation PWA technicien

### Sprint 6.6 (cumul 28) -- NOUVEAU v2.0 -- Flux Sinistre Client

**Objectif sprint** : Connecter le bout-en-bout du flux sinistre client : declaration depuis web-assure-mobile (Sprint 22) -> routage automatique a l'assureur via API (Sprint 17) -> liste garages agrees -> choix garage par client -> creation autorisation cross-tenant client/garage -> prise en charge automatique par garage (Sprint 25).

**Pourquoi nouveau v2.0** : Le flux sinistre client est un differenciateur majeur. Il evite au courtier d'etre intermediaire et permet une gestion directe entre client/assureur/garage. Premier au Maroc.

**Prerequis** : Sprints 17 (declarerSinistre + getGaragesAgrees), 22 (web-assure-mobile), 23-25 (Garage operationnel).

**Taches** (14) :

- 6.6.1 SinistreDeclarationOrchestrator -- service backend qui orchestre les 7 etapes du flux
- 6.6.2 Etape 1 : reception declaration depuis web-assure-mobile (POST /api/v1/assure/sinistres/declare)
- 6.6.3 Etape 2 : routage automatique a l'assureur via `IAssureurConnector.declarerSinistre()`
  - Stockage `insurer_reference` retourne par assureur
  - Status `sent_to_insurer` -> `insurer_acknowledged`
- 6.6.4 Etape 3 : recuperation liste garages agrees via `IAssureurConnector.getGaragesAgrees()`
  - Filtrage par ville/region client
  - Tri par distance (Mapbox geocoding) + rating + capacity
- 6.6.5 Endpoint GET /api/v1/assure/sinistres/:id/garages-available -- retourne liste enrichie avec coordonnees GPS
- 6.6.6 GarageSelectionService (pattern 15) -- creation autorisation cross-tenant client -> garage en transaction DB
- 6.6.7 Endpoint POST /api/v1/assure/sinistres/:id/select-garage -- declenche creation cross-tenant
- 6.6.8 CrossTenantClientGarageGuard -- valide acces garage aux donnees client (verifie autorisation active)
- 6.6.9 Etape 6-7 : creation entree `repair_sinistres` cote garage avec lien vers `assure_sinistre_declarations`
- 6.6.10 Notification WhatsApp + email garage (template "new_sinistre_received")
- 6.6.11 Synchronisation status sinistre garage -> assure (events Kafka)
- 6.6.12 Page web-assure-mobile `/sinistres/[id]/suivi` -- timeline temps reel (WebSocket /ws/assure)
- 6.6.13 Vue read-only courtier dans web-broker (vue materialisee `mv_broker_sinistres_clients` rafraichie 5 min)
- 6.6.14 Tests E2E complets : 4 scenarios couvrant le flux end-to-end + tests cross-tenant securite

**Pourquoi cet ordre** :
- Backend (6.6.1-6.6.11) avant frontend (6.6.12-6.6.13)
- Routage assureur (6.6.3) avant getGaragesAgrees (6.6.4) car assureur valide d'abord
- Cross-tenant authorization (6.6.6-6.6.8) avant creation repair_sinistres (6.6.9)
- Notifications (6.6.10) en derniere etape backend
- Tests E2E (6.6.14) en validation finale

---

## 7. PHASE 7 -- CROSS-TENANT AUTHORIZATION (1 SPRINT)

**Objectif phase** : Generaliser le framework cross-tenant authorization au-dela du flux client/garage. Permettre acces temporaires admin et visibilites read-only courtier sur sinistres clients.

**Pourquoi en septieme position** : La Phase 6 a deja construit le cas d'usage principal (client -> garage). La Phase 7 generalise pour les autres cas d'usage et durcit la securite.

**Prerequis** : Phases 1-6 completes.

**Cumul sprints** : Sprint 29.

### Sprint 7.1 (cumul 29) -- Cross-Tenant Framework etendu (mise a jour v2.0)

**Objectif sprint** : Framework complet pour gerer les 3 types d'autorisations cross-tenant identifies en v2.0.

**Taches** (12) :

- 7.1.1 Ajout colonne `authorization_type` a `cross_tenant_authorizations` (deja fait Sprint 28 si pris en avance, sinon ici)
- 7.1.2 Service CrossTenantAuthorizationService -- API generique pour tous les types
- 7.1.3 Type 1 -- `client_to_garage` : utilise par flux sinistre Sprint 28 (deja partiellement implemente)
- 7.1.4 Type 2 -- `broker_readonly_garage` : courtier acces lecture seule via vues materialisees
  - Pas une vraie autorisation cross-tenant (pas d'acces direct au tenant garage)
  - Implementee via vue materialisee + RBAC strict cote API
- 7.1.5 Type 3 -- `admin_temporary_access` : Skalean Admin acces temporaire avec MFA
  - Limite 4h, audit complet
  - Notif a l'AdminTenant cible
- 7.1.6 CrossTenantAuthGuard generique -- selectionne le bon guard selon type
- 7.1.7 Service de revocation immediate (cascade : audit + notif tenants concernes)
- 7.1.8 Job cron quotidien : verifier expirations + envoyer notifications J-7 J-1
- 7.1.9 Page web-insurtech-admin /admin/cross-tenant-authorizations -- monitoring temps reel
- 7.1.10 Page assure : voir/revoquer ses autorisations actives (`/mon-espace/autorisations`)
- 7.1.11 Reports compliance : rapport mensuel des autorisations cross-tenant
- 7.1.12 Tests securite : 0 succes acces cross-tenant non-autorise + audit complet

**Pourquoi cet ordre** : Type 1 deja existant (Sprint 28). Type 2 est principalement RBAC pas vrai cross-tenant. Type 3 (admin temporaire) le plus risque securite -> en derniere position avec MFA strict.

---

(Suite dans `01-plan-realisation-PARTIE3.md`.)

**Fin du document `01-plan-realisation-PARTIE2.md` v2.0.**
