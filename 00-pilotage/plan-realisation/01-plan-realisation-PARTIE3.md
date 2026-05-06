# PLAN DE REALISATION skalean-insurtech -- PARTIE 3/3 v2.0

(Suite directe de `01-plan-realisation-PARTIE2.md`)

**Version** : 2.0.0
**Date** : 2026-05-04
**Description** : Phases 8-10 du plan -- Skalean InsurTech Admin, Hardening, Pilote Marrakech
**AUCUNE EMOJI AUTORISEE**

**Changelog v2.0** :
- Renumerotation cumul des sprints (30-35 au lieu de 27-32) suite a l'ajout de 3 sprints en Phase 5-6
- Phase 8 etendue pour gerer 8 apps (vs 5) dans Skalean InsurTech Admin
- Phase 9 : audit pentest etendu aux 8 apps + endpoints publics
- Phase 10 : pilote etendu avec metriques apps clientes

---

## 8. PHASE 8 -- SKALEAN INSURTECH ADMIN (3 SPRINTS) v2.0

**Objectif phase** : Construire l'application web-insurtech-admin pour l'equipe Skalean. Gestion des clients (cabinets courtage et garages), reporting consolide, support technique, conformite globale.

**Pourquoi en huitieme position** : Phases 5-7 ont fourni les SaaS B2B et apps clientes operationnels. Avant le Go-Live commercial, l'equipe Skalean a besoin d'outils internes pour gerer la croissance et superviser tous les tenants.

**Prerequis** : Phases 1-7 completes.

**Cumul sprints** : Sprints 30 a 32 (renumerotation v2.0 -- etait 27-29 en v1.0).

**Apport business** : Capacite a operer la plateforme a l'echelle multi-tenant.

### Sprint 8.1 (cumul 30) -- Admin Foundation

**Objectif sprint** : Initialiser l'app web-insurtech-admin avec authentification renforcee (MFA obligatoire), navigation, et dashboard global plateforme.

**Taches** (12) :

- 8.1.1 Initialisation app `web-insurtech-admin` (port 3000 deja attribue, domaine `admin.skalean-insurtech.ma`)
- 8.1.2 Auth Skalean stricte : MFA TOTP obligatoire sur tous les comptes SuperAdminPlatform et AnalystSupport
- 8.1.3 Layout admin avec navigation principale (Tenants, Reports, Compliance, Support, Settings)
- 8.1.4 Dashboard global :
  - Nombre total de tenants actifs (par type : courtier vs garage)
  - **NOUVEAU v2.0 : nombre prospects actifs sur web-customer-portal**
  - **NOUVEAU v2.0 : nombre assures actifs (web-assure-portal/mobile)**
  - MRR consolide
  - Volume sinistres en cours (toutes phases)
  - Alertes systeme (incidents, alertes ACAPS, breaches)
- 8.1.5 Page Tenants liste -- recherche multi-criteres (par type, region, status, date inscription)
- 8.1.6 Page Tenant detail -- vue 360 (utilisateurs, polices/sinistres, paiements, support)
- 8.1.7 Page Utilisateurs (cross-tenant view, AnalystSupport limite, SuperAdminPlatform total)
- 8.1.8 Audit log des actions admin (toute lecture/ecriture cross-tenant tracee)
- 8.1.9 Notifications internes (Slack/email) pour alertes critiques
- 8.1.10 Search global (Cmd+K) -- recherche tenants, utilisateurs, polices, sinistres
- 8.1.11 Tests E2E + tests RBAC strict (acces SuperAdminPlatform vs AnalystSupport)
- 8.1.12 Documentation operations admin pour equipe Skalean

**Pourquoi cet ordre** : Initialisation app + auth MFA en priorite (8.1.1-8.1.2). Layout + dashboard avant pages detaillees. Search global a la fin (depend des pages existantes).

### Sprint 8.2 (cumul 31) -- Tenants Management

**Objectif sprint** : Outils complets pour onboarding, suspension, lifecycle des tenants clients.

**Taches** (12) :

- 8.2.1 Onboarding nouveau tenant cabinet courtier (formulaire complet : ICE, RC, contact, plan abonnement, branding initial)
- 8.2.2 Onboarding nouveau tenant garage (formulaire complet : ICE, RC, ville, specialites, capacity_slots, baremes assureurs)
- 8.2.3 Service automatique provisioning : creation tenant + AdminTenant + envoi credentials initial
- 8.2.4 Page Subscription par tenant (plan actuel, billing Stripe, factures B2B, MRR)
- 8.2.5 Suspension/reactivation tenant (avec audit trail + notification AdminTenant)
- 8.2.6 Migration tenant : changement plan, fusion, scission (rare mais necessaire)
- 8.2.7 Page Health Tenant : metriques d'utilisation, dernieres connexions, alertes
- 8.2.8 **NOUVEAU v2.0 -- Page Validation Queue Globale** : voir tous les dossiers prospects en attente courtier (cross-tenant)
- 8.2.9 **NOUVEAU v2.0 -- Page Assignment Algorithm Config** : configurer la repartition des prospects entre cabinets courtiers (round_robin / by_region / least_busy)
- 8.2.10 Export CSV/Excel des metriques tenants (compliance + business)
- 8.2.11 Tests E2E onboarding complet bout-en-bout
- 8.2.12 Documentation runbook : onboarding, suspension, migration

**Pourquoi cet ordre** : Onboarding (8.2.1-8.2.3) avant suspension (8.2.5). Migration (8.2.6) en fin. NOUVEAU v2.0 : validation queue (8.2.8) suit la logique de gestion tenants.

### Sprint 8.3 (cumul 32) -- Admin Reports + Compliance

**Objectif sprint** : Reporting consolide global et automatisation conformite ACAPS pour la plateforme.

**Taches** (12) :

- 8.3.1 Reports cross-tenant : volume polices vendues, sinistres reglees, commissions versees
- 8.3.2 Reports business plateforme : MRR Skalean, croissance tenants, churn
- 8.3.3 **NOUVEAU v2.0 -- Reports apps clientes** : conversion funnel customer-portal + activation web-assure-mobile
- 8.3.4 Reports compliance ACAPS automatises (mensuel, trimestriel, annuel)
- 8.3.5 Reports CNDP : preuves residence donnees Maroc + audit consents
- 8.3.6 Reports loi 43-20 : volume signatures + archivage legal verifie
- 8.3.7 Page Compliance Dashboard : indicateurs temps reel + alertes
- 8.3.8 Page Support Tickets : centralisation tickets cross-tenant + tag priorite
- 8.3.9 Integration ticketing (Linear, Zendesk, Jira -- au choix Skalean)
- 8.3.10 Notification automatique tenant si dossier compliance non conforme
- 8.3.11 Export PDF/Excel des reports avec branding Skalean
- 8.3.12 Tests E2E generation reports + verification format conformite

**Pourquoi cet ordre** : Reports cross-tenant (8.3.1-8.3.3) avant compliance (8.3.4-8.3.6). Pages dashboard (8.3.7-8.3.8) consomment les reports. Tests en fin.

---

## 9. PHASE 9 -- HARDENING + PENTEST (2 SPRINTS) v2.0

**Objectif phase** : Durcir la securite et la performance avant le Go-Live commercial. Pentest externe sans High/Critical residuel. Tests de charge 1000+ tenants.

**Pourquoi en neuvieme position** : 8 apps + 16 packages + ~470 taches developpees. Avant de lancer le pilote commercial, on doit attester d'un niveau securite et performance professionnel.

**Prerequis** : Phases 1-8 completes.

**Cumul sprints** : Sprints 33 a 34 (renumerotation v2.0 -- etait 30-31 en v1.0).

### Sprint 9.1 (cumul 33) -- Pentest + Securite (etendu v2.0)

**Objectif sprint** : Pentest externe complet sur les 8 apps + endpoints publics + flux clients. Correction de toutes les vulnerabilites High/Critical avant Go-Live.

**Taches** (13) :

- 9.1.1 Selection prestataire pentest specialise InsurTech (cible : 2-3 societes marocaines + 1 internationale)
- 9.1.2 Scope pentest etendu v2.0 : les 8 apps + endpoints publics `/public/*` + flux clients
- 9.1.3 Audit code interne (SAST Snyk + audit manuel des modules critiques)
- 9.1.4 Tests OWASP Top 10 sur tous les endpoints
- 9.1.5 Tests authentification : JWT manipulation, session hijacking, MFA bypass
- 9.1.6 Tests authorization : escalation privileges, cross-tenant access
- 9.1.7 **NOUVEAU v2.0 -- Tests endpoints publics** : DDoS, injection sur formulaires prospect, scraping
- 9.1.8 **NOUVEAU v2.0 -- Tests cross-tenant client/garage** : forge autorisation, replay, expiration bypass
- 9.1.9 Tests integrations externes : Skalean AI MITM, passerelles paiement, signature provider
- 9.1.10 Tests RGPD-CNDP : exfiltration donnees, breach notification trigger
- 9.1.11 Implementation CSP enforce (apres period report-only Phase 8)
- 9.1.12 Correction et reverification toutes les vulnerabilites High/Critical
- 9.1.13 Documentation rapport pentest + plan d'action correctifs

**Pourquoi cet ordre** : Selection prestataire en premier. Scope avant tests. Tests internes (9.1.3-9.1.4) en parallele du pentest externe. Corrections (9.1.12) apres tous les tests.

### Sprint 9.2 (cumul 34) -- Performance + Scaling

**Objectif sprint** : Tests de charge prouvant 1000+ tenants concurrents avec p95 < 150ms sur endpoints critiques.

**Taches** (12) :

- 9.2.1 Setup environnement load testing (k6 ou JMeter) avec donnees realistes (10k tenants seedes)
- 9.2.2 Tests de charge endpoints critiques (auth, polices, sinistres, comparateur)
- 9.2.3 **NOUVEAU v2.0 -- Tests de charge endpoints publics** : 500 prospects concurrents sur web-customer-portal
- 9.2.4 **NOUVEAU v2.0 -- Tests de charge web-assure-mobile** : 5000 PWA actives concurrent
- 9.2.5 Profiling backend (Pino traces + Prometheus + Grafana)
- 9.2.6 Optimisations queries DB (analyze pg_stat_statements, ajout indexes manquants)
- 9.2.7 Optimisations cache Redis (hit rate, TTL adjustments)
- 9.2.8 Tuning PgBouncer pool sizes selon resultats
- 9.2.9 Tests de charge soutenue 24h (memory leaks, connexion drains)
- 9.2.10 Auto-scaling Kubernetes selon CPU/RAM
- 9.2.11 Validation SLA : disponibilite 99.9% pendant test 24h
- 9.2.12 Documentation runbook performance + dashboards Grafana production

**Pourquoi cet ordre** : Setup environnement (9.2.1) avant tests. Tests (9.2.2-9.2.4) avant optimisations (9.2.5-9.2.8). Test soutenu (9.2.9) en validation. Auto-scaling (9.2.10) en prevision production.

---

## 10. PHASE 10 -- PILOTE MARRAKECH + GO-LIVE (1 SPRINT + 4 SEMAINES) v2.0

**Objectif phase** : Pilote commercial reel sur Marrakech. 30 jours de production avec 2+ cabinets courtiers et 1 garage. Mesure satisfaction et NPS. Decision Go-Live commercial generalise.

**Pourquoi en dixieme position (finale)** : Toutes les apps developpees, securisees, performantes. Le pilote valide le product-market fit en conditions reelles avant l'expansion nationale.

**Prerequis** : Phases 1-9 completes.

**Cumul sprints** : Sprint 35 (renumerotation v2.0 -- etait 32 en v1.0).

**Apport business jalon J7 (mois 12)** : Pilote reussi -> Go-Live commercial.

### Sprint 10.1 (cumul 35) -- Pilote Marrakech 30 Jours + Go-Live (etendu v2.0)

**Objectif sprint** : Lancer le pilote sur Marrakech, accompagner les utilisateurs pilotes, mesurer en continu, et valider les criteres Go-Live.

**Duree** : 4 semaines (1 sprint + suivi 4 semaines pilote).

**Taches** (15) :

- 10.1.1 Selection 2 cabinets courtiers pilotes a Marrakech (criteres : tailles distinctes, branches differentes)
- 10.1.2 Onboarding cabinet 1 (formation 2 jours + setup tenant + branding + import donnees existantes)
- 10.1.3 Onboarding cabinet 2 (formation 2 jours + setup tenant)
- 10.1.4 Onboarding garage Marrakech (formation 2 jours + setup tenant + equipe technique)
- 10.1.5 **NOUVEAU v2.0 -- Lancement marketing web-customer-portal** : campagne SEO + Facebook Ads ciblee Marrakech
- 10.1.6 Pilotage en continu : daily standup pendant 30 jours avec equipe Skalean + cabinets pilotes
- 10.1.7 Monitoring intensif : alertes Sentry, Grafana dashboards verifies 3x/jour
- 10.1.8 Support 7j/7 : hotline + chat + Slack interne avec cabinets
- 10.1.9 **NOUVEAU v2.0 -- Suivi KPIs apps clientes** :
  - Nombre prospects ayant utilise customer-portal (cible >= 100)
  - Nombre polices vendues via flux online (cible >= 30)
  - Conversion prospect -> assure (cible >= 15%)
  - Taux installation web-assure-mobile par les nouveaux assures
- 10.1.10 Suivi KPIs business :
  - Polices vendues via flux agence (cible >= 50)
  - Sinistres geres (cible >= 20)
  - Delai souscription moyen (cible <= 5 min)
  - Delai sinistre moyen (cible <= 24h)
- 10.1.11 Mesure NPS pilote (cible > 30) + satisfaction (cible > 4/5)
- 10.1.12 Audits ACAPS et CNDP attestation : verification residence donnees + audit trails complets
- 10.1.13 Rapport hebdomadaire d'avancement pilote -- diffuse a board Skalean + cabinets pilotes
- 10.1.14 Decision Go-Live : verification 100% criteres P0 + 80%+ P1 + ZERO incident Critical
- 10.1.15 Documentation Go-Live : runbook deploiement national + plan formation reseau partenaires

**Pourquoi cet ordre** : Onboarding pilotes (10.1.1-10.1.4) en pre-lancement. Marketing customer-portal (10.1.5) **declenche apres onboarding cabinets** car les prospects seront repartis entre les cabinets pilotes. Pilotage et monitoring (10.1.6-10.1.10) durant les 30 jours. Mesure NPS + audits (10.1.11-10.1.12) en fin. Decision Go-Live (10.1.14) en validation finale.

---

## SYNTHESE GLOBALE PROJET v2.0

### Vue chronologique 12 mois

| Mois | Phase | Sprints | Theme |
|------|-------|---------|-------|
| 1-2 | Phase 1 | 1-4 | Infrastructure 8 apps |
| 2-3 | Phase 2 | 5-7 | Auth multi-tenant + RBAC |
| 3-4 | Phase 3 | 8-9 | Skalean AI client |
| 4-6 | Phase 4 | 10-15 | 10 modules horizontaux |
| 6-8 | Phase 5 | 16-22 | Broker + apps clientes |
| 8-9 | Phase 6 | 23-28 | Garage + flux sinistre client |
| 9 | Phase 7 | 29 | Cross-tenant framework |
| 10 | Phase 8 | 30-32 | Skalean Admin |
| 11 | Phase 9 | 33-34 | Hardening + pentest |
| 12 | Phase 10 | 35 | Pilote + Go-Live |

### Bilan effort

| Phase | Sprints | Taches | Heures equipe |
|-------|---------|--------|---------------|
| 1 | 4 | 56 | ~250 |
| 2 | 3 | 38 | ~170 |
| 3 | 2 | 24 | ~110 |
| 4 | 6 | 81 | ~360 |
| 5 | 7 | 100 | ~440 |
| 6 | 6 | 78 | ~340 |
| 7 | 1 | 12 | ~50 |
| 8 | 3 | 36 | ~160 |
| 9 | 2 | 25 | ~110 |
| 10 | 1 | 15 | ~150 (hors pilote 4 semaines) |
| **Total** | **35** | **~465** | **~2140** |

### Jalons business synthetique

| Jalon | Mois | Apport |
|-------|------|--------|
| J1 | M2 | Auth + Skalean AI operationnels |
| J2 | M4 | 10 modules horizontaux livres |
| J3 | M6 | Skalean Broker v1.0 deployable |
| **J4** | **M7** | **Apps clientes deployees -- vente en ligne** (NOUVEAU v2.0) |
| J5 | M9 | Skalean Garage v1.0 + flux sinistre client (NOUVEAU v2.0) |
| J6 | M11 | Hardening complet attestable |
| J7 | M12 | Go-Live commercial |

### Couverture cas d'usage ACAPS

| Cas | Description | Sprints couvrants | Status |
|-----|-------------|-------------------|--------|
| 02 | Comparaison produits assurance | 17, 18, 21 (NOUVEAU v2.0) | Complet |
| 03 | Souscription en ligne | 18, 21 (NOUVEAU v2.0) | Complet |
| 04 | Gestion relation client courtier | 10, 11, 20 | Complet |
| 07 | Gestion sinistres et reparations | 23-28 | Complet (avec flux client v2.0) |

### Innovation differenciante

Skalean InsurTech apporte 4 innovations "premier au Maroc" :
1. **Comparateur multi-assureurs natif sans inscription** (Sprint 21 web-customer-portal)
2. **App mobile PWA pour assures avec declaration sinistre instantanee** (Sprint 22 web-assure-mobile)
3. **IA d'estimation des degats par photos en moins de 3 minutes** (Sprint 24)
4. **Flux sinistre client end-to-end sans intervention courtier** (Sprint 28)

---

## CONCLUSION

Ce plan v2.0 acte la transformation d'une plateforme B2B 5 apps vers une plateforme B2B+B2C 8 apps avec 3 flux utilisateur principaux. Le programme reste sur 12 mois avec ajout de 3 sprints et ~40 taches additionnelles. Les jalons business clefs (J3 mois 6, J4 mois 7, J5 mois 9) permettent un Go-Live commercial structure.

La separation claire client/courtier/assureur/garage dans les 3 flux principaux assure une experience fluide et conforme aux attentes du marche InsurTech moderne, tout en respectant les regulations marocaines (ACAPS, CNDP loi 09-08, loi 43-20).

---

**Fin du document `01-plan-realisation-PARTIE3.md` v2.0.**

**Plan complet (3 parties) : 35 sprints, 10 phases, 12 mois, 8 apps, 470 taches estimees.**
