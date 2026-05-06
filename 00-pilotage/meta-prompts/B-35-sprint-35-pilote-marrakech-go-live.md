# META-PROMPT B-35 -- SPRINT 35 PILOTE MARRAKECH + GO-LIVE

**Version** : v2.2 (Option B -- SPRINT FINAL)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 35 / 35 (cumul) -- Phase 7 Sprint 7 (DERNIER -- FIN DU PROJET)
**Position** : Apres tous les sprints precedents, lancement production
**Numerotation taches** : 7.7.1 a 7.7.14
**Effort total** : ~150 heures developpement + ops / 4 semaines + suivi
**Priorite** : P0 (sprint final -- valide TOUT le programme)

---

## Objectif Global du Sprint

**Lancer pilote production Marrakech** : 50-200 users sur 4 semaines avec validation criteria Go-Live -> generalisation commerciale.

**Stakeholders pilote** :
- **1 assureur partenaire** : Wafa Assurance (connecteur Sprint 32 active)
- **1 garage interne** : Skalean Atlas (Sprint 19 deja seed)
- **2-3 brokers tenants partenaires** : agences courtiers Marrakech (Type 2 managed_partner Sprint 25)
- **1-2 garages partenaires** : Type 2 managed_partner ou Type 3 api_partner
- **50-200 customers** : assures Marrakech (assurance auto B2C)
- **Equipe Skalean** : office Marrakech + support 24/7

**Sprint 35 = SUCCESS CRITERIA** :
- 50+ polices souscrites en 30 jours
- 30+ sinistres traites end-to-end (M8 workflow Sprint 24)
- NPS > 8 (customer satisfaction)
- 0 incidents critique securite
- 0 incidents critique data privacy CNDP
- SLOs Sprint 34 maintenu sustained
- Conformite ACAPS reports trimestriel green
- ROI projection positive (Sprint 27 billing tenants)

A la sortie de ce sprint :
- **PROGRAMME COMPLETE 35 SPRINTS** : Skalean InsurTech production-ready
- Pilote Marrakech valide
- Plan generalisation commercial Phase 8 (Casablanca + Rabat)
- Lessons learned documentees
- Equipe ready pour scale-up

---

## Frontiere du Sprint

**INCLUS** :
- Pre-pilote preparation (4 semaines avant launch)
- Onboarding partenaires + customers
- Launch day operations (war room)
- 4 semaines pilote intensif
- Customer feedback loop
- Issue resolution rapide
- Daily standups + weekly reviews
- Plan generalisation Phase 8
- Programme closure

**EXCLU** (Phase 8+) :
- Expansion Casablanca + Rabat
- Onboarding 50+ brokers + 20+ garages
- IA-powered features avances
- Multi-region deployment
- Mobile native apps iOS/Android
- B2B2C marketplace public

---

## Lectures Prealables Obligatoires

1. Toutes sorties Phase 1-7 (Sprints 1-34)
2. Sprint 33 audit securite green (0 critical/high)
3. Sprint 34 performance scaling validated
4. Sprint 32 Wafa connecteur operational
5. Decision strategique Skalean Atlas + brokers + garages identifies

---

## Stack Imposee (Sprint 35)

Pas de nouvelle stack -- consume tout deja livre.

| Ressources additionnelles | Notes |
|---------------------------|-------|
| Bureau Marrakech | location office + IT setup |
| Equipe Skalean Marrakech | 4-6 personnes (CTO + ops + sales + support) |
| Communication agency | RP launch + marketing |
| Customer support tools | Zendesk/Intercom integrate (Sprint 9 Comm) |

---

## Vue d'Ensemble des 14 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 7.7.1 | Pre-pilote checklist : Sprint 33+34 acceptance criteria + freeze code | 8h | P0 | Sprint 34 |
| 7.7.2 | Onboarding Skalean Atlas + Wafa Assurance + setup tenants | 10h | P0 | 7.7.1 |
| 7.7.3 | Onboarding 2-3 brokers tenants Marrakech (Type 2 managed_partner) | 12h | P0 | 7.7.2 |
| 7.7.4 | Onboarding 1-2 garages partenaires (Type 2 ou 3 selon profile) | 10h | P0 | 7.7.3 |
| 7.7.5 | Customer acquisition : 50+ assures Marrakech (campagne digital + agence) | 14h | P0 | 7.7.4 |
| 7.7.6 | Office Marrakech setup + equipe locale + support 24/7 hotline | 10h | P0 | 7.7.5 |
| 7.7.7 | Communications launch : RP + marketing + ACAPS notification + presse MA | 8h | P0 | 7.7.6 |
| 7.7.8 | Launch day operations : war room + monitoring intensif premier 72h | 16h | P0 | 7.7.7 |
| 7.7.9 | Pilote 4 semaines : daily standups + weekly reviews + issues triage | 24h | P0 | 7.7.8 |
| 7.7.10 | Customer feedback loop : NPS surveys + interviews + ratings + iterations | 10h | P0 | 7.7.9 |
| 7.7.11 | KPIs tracking + dashboards C-level + ACAPS reporting trimestriel | 8h | P0 | 7.7.10 |
| 7.7.12 | Lessons learned + retrospective + documentation post-pilote | 6h | P0 | 7.7.11 |
| 7.7.13 | Plan generalisation Phase 8 : Casablanca + Rabat + scale-up roadmap | 8h | P0 | 7.7.12 |
| 7.7.14 | **Programme closure** : 35 sprints completes + livrables finals + handover | 6h | P0 | 7.7.13 |

**Total** : 150 heures (+ 4 semaines pilote duration).

---

# DETAIL DES 14 TACHES

---

## Tache 7.7.1 -- Pre-Pilote Checklist + Freeze Code

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 8h / Depend de Sprint 34

**But** : Verification finale Sprint 33 + Sprint 34 acceptance criteria + code freeze + final testing.

**Livrables checkables** :
- [ ] **Sprint 33 prerequisites** :
  - 0 critical + 0 high vulnerabilities open
  - ASVS Level 2 certified
  - Threat model + incident response runbook complets
  - DR plan tested
  - Internal red team operational
- [ ] **Sprint 34 prerequisites** :
  - SLOs sustained 7 jours staging green
  - Load testing 200 concurrent users green
  - Chaos experiments RTO < 60s validated
  - Cost projection < budget
  - Backups verifies daily
  - On-call rotation etablie (au moins 2 personnes Skalean Atlas + 2 personnes Marrakech equipe)
- [ ] **Code freeze** : 7 jours pre-launch, no new features, hotfixes only
- [ ] **Smoke testing complet** sur staging :
  - Scenario complete M8 : declaration -> dispatch -> reparation -> livraison
  - Tous workflows critiques
  - Tests cross-tenant isolation
  - Tests Sky AI Sprint 31
- [ ] **Backup pre-launch** : snapshot DB + S3 + configurations
- [ ] **Go/no-go decision** : meeting executive Skalean (CEO + CTO + COO + Legal) -> sign-off official

**Fichiers crees / modifies** :
```
repo/docs/pilote/pre-pilote-checklist.md                                                                                            # ~400 lignes (checklist exhaustive)
repo/docs/pilote/go-no-go-decision-template.md                                                                                       # ~150 lignes
repo/infrastructure/scripts/pre-pilote-smoke-test.sh                                                                                   # ~200 lignes
```

**Notes implementation** :
- Code freeze critical : eviter regressions launch day
- Go/no-go formal : engagement contractuel envers tenants
- Backup pre-launch : restore point si rollback necessaire
- Smoke test : 100% workflows critiques avant launch

**Criteres validation** :
- V1 (P0) : Checklist 100% green
- V2 (P0) : Smoke tests green
- V3 (P0) : Go/no-go signed off
- V4 (P0) : Backup snapshot

---

## Tache 7.7.2 -- Onboarding Skalean Atlas + Wafa Assurance

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 10h / Depend de 7.7.1

**But** : Activate Skalean Atlas (deja seed Sprint 19) + onboarding Wafa Assurance (connecteur Sprint 32).

**Livrables checkables** :
- [ ] Skalean Atlas activation production :
  - Tenant migration staging -> production
  - Verify capabilities matrix Sprint 25 (Type 1 atlas)
  - Equipe Atlas 8 employees onboarded (4 roles : admin/chef/technicien/gestionnaire)
  - Stock pieces realistic Sprint 13 (100+ items pieces auto)
  - Services + tarifs configures (8 services Sprint 19)
- [ ] Wafa Assurance connecteur Sprint 32 :
  - Activation production : credentials KMS encrypted
  - Test push policy : create policy via Skalean Broker -> push Wafa -> receive ack
  - Test push sinistre : Atlas declare via M8 -> push Wafa
  - Test webhook : Wafa updates -> verify reception
  - Circuit breaker tested + fallback
  - Cost monitoring active
- [ ] Documentation operationnelle :
  - Atlas runbook (gestion quotidienne)
  - Wafa connecteur runbook (incidents handling)

**Fichiers crees / modifies** :
```
repo/docs/pilote/atlas-onboarding-complete.md                                                                                          # ~250 lignes
repo/docs/pilote/wafa-connecteur-activation.md                                                                                          # ~200 lignes
repo/infrastructure/scripts/promote-staging-to-production.ts                                                                              # ~250 lignes
```

**Criteres validation** :
- V1 (P0) : Atlas operationnel production
- V2 (P0) : Wafa connecteur active + tests OK
- V3 (P0) : 8 employees Atlas onboarded
- V4 (P0) : Runbooks complets

---

## Tache 7.7.3 -- Onboarding 2-3 Brokers Tenants Partenaires

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 12h / Depend de 7.7.2

**But** : Identifier + onboarder 2-3 agences courtiers Marrakech (Type 2 managed_partner Sprint 25).

**Livrables checkables** :
- [ ] Identification + signature contrats partenariat :
  - Recherche 5-10 agences candidates (recommandations + reseau Skalean)
  - Pitch + demo + negotiation
  - Signature 2-3 agreements partnership (commission + SaaS pricing Sprint 27)
- [ ] Onboarding wizard Sprint 25/26 execute pour chaque tenant :
  - Validate partner data (ICE + RC + adresse)
  - Create tenant + capabilities Type 2
  - Create admin user + invitation email
  - Configure tenant settings (commission_rate, saas_tier, etc.)
- [ ] Formation users :
  - 2 jours formation per tenant : 5-10 users (broker_admin + broker + supervisor + commercial + ops)
  - Materiel formation : video tutorials + guides PDF + FAQ
  - Hands-on workshop : creer polices + traiter sinistres
  - Certification users : test final + badge
- [ ] Migration data legacy (si tenant existant) -- **decision strategique pilote** :
  - **OPTION choisie pilote Sprint 35** : migration **ad-hoc one-shot** par equipe ops (pas service backend dedie)
  - Procedure : export ancien systeme (Excel/CSV/SQL dump du systeme legacy) -> normaliser via scripts Python ad-hoc -> import via API endpoints `/api/v1/admin/import/{customers,polices}` (Sprint 26 admin foundation a livre les imports CSV)
  - Outil : scripts Python custom per tenant (pas reutilisable -- 1 dev jour par tenant)
  - **Pas de migration framework reutilisable Phase 7** (out-of-scope pilote)
  - Phase 8+ post-pilote : decision creer Migration Data Service unifie SI demande commerciale > 5 tenants/mois necessitant migration
  - Verification data integrity post-migration : audit row count + checksums + 5 sample records validation manuelle
  - Backup pre-migration : DB snapshot + S3 export ancien systeme (conservation 1 an)
- [ ] Support dedicated premiers 30 jours : hotline + Slack channel + on-site visits

**Fichiers crees / modifies** :
```
repo/docs/pilote/brokers-onboarding-{tenant1,tenant2,tenant3}.md                                                                          # 3 docs onboarding
repo/docs/training/broker-formation-materials/{several}.md                                                                                   # materiel formation
repo/infrastructure/scripts/data-migration-legacy-{tenant}.ts                                                                                  # scripts migration per tenant
```

**Notes implementation** :
- Pilote 2-3 brokers : maintenir focus + qualite onboarding
- Formation 2 jours : balance between thorough vs time-investment
- Support intensif premier mois : critical pour adoption

**Criteres validation** :
- V1 (P0) : 2-3 brokers tenants activated
- V2 (P0) : Users formed + certified
- V3 (P0) : Data migration complete (si applicable)
- V4 (P0) : Support hotline active

---

## Tache 7.7.4 -- Onboarding 1-2 Garages Partenaires

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 10h / Depend de 7.7.3

**But** : Onboarder 1-2 garages partenaires Marrakech (Type 2 managed_partner ou Type 3 api_partner).

**Livrables checkables** :
- [ ] Identification garages :
  - Critere : digital readiness + reputation + capacity reparations auto
  - Negotiation : Type 2 (utilise Skalean Garage ERP) ou Type 3 (API integration leur ERP existant)
- [ ] Onboarding workflow Sprint 25/26 :
  - Type 2 : full Skalean Garage ERP setup (reuse pattern Atlas)
  - Type 3 : API integration setup + webhooks + mapping config
- [ ] Formation users garage :
  - 1 jour formation : garage_admin + garage_chef + 2-3 techniciens
  - PWA mobile Sprint 23 install + test sur smartphones reels
  - Workflow sinistre M8 simulation
- [ ] Tests integration end-to-end :
  - Sinistre declare via web-assure-mobile -> dispatch garage partenaire -> reparation -> livraison
- [ ] Support hotline dedicated

**Fichiers crees / modifies** :
```
repo/docs/pilote/garages-onboarding-{garage1,garage2}.md                                                                                       # 2 docs
repo/docs/training/garage-formation-materials/{several}.md                                                                                       # materiel
```

**Criteres validation** :
- V1 (P0) : 1-2 garages activated
- V2 (P0) : Tests integration M8 OK
- V3 (P0) : Users formes
- V4 (P0) : Support hotline

---

## Tache 7.7.5 -- Customer Acquisition (50+ Assures)

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 14h / Depend de 7.7.4

**But** : Acquisition 50+ customers Marrakech via campagne digital + agence physique + brokers partners referrals.

**Livrables checkables** :
- [ ] Strategie acquisition multi-channel :
  - **Digital** : Facebook + Google Ads ciblage Marrakech (budget 50k MAD pre-pilote) -> landing page web-customer-portal Sprint 17
  - **Agence physique** : office Marrakech walk-in customers + commerciaux outreach
  - **Brokers partners** : referrals customers existants
  - **Skalean Atlas** : customers existants Skalean Group
- [ ] Materiel marketing :
  - Landing page web-customer-portal optimisee
  - Brochures + cartes business Marrakech
  - Videos tutorials (souscription en ligne 5min)
- [ ] Offre incitative pilote :
  - Reduction 10% premiere annee
  - Sky AI assistance gratuite (vs payant Phase 8)
  - Service prioritaire 24/7
- [ ] KPIs acquisition :
  - Cible : 50+ customers en 4 semaines
  - CAC (Customer Acquisition Cost) < 500 MAD
  - Conversion rate landing page > 3%
- [ ] Support sales : Sprint 8 CRM tracker pipelines

**Fichiers crees / modifies** :
```
repo/docs/pilote/customer-acquisition-strategy.md                                                                                              # ~250 lignes
repo/docs/marketing/{several materials}.pdf                                                                                                       # brochures + videos scripts
repo/apps/web-customer-portal/app/[locale]/landing-pilote/page.tsx                                                                                 # landing page dedicated
```

**Criteres validation** :
- V1 (P0) : 50+ customers acquired
- V2 (P0) : CAC < 500 MAD
- V3 (P0) : Conversion rate target met

---

## Tache 7.7.6 -- Office Marrakech Setup + Support 24/7

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 10h / Depend de 7.7.5

**But** : Etablir presence physique Marrakech : office + equipe + support 24/7 hotline.

**Livrables checkables** :
- [ ] Office Marrakech : location 50-100m2 quartier business + IT setup
- [ ] Equipe locale 4-6 personnes :
  - 1 Country Manager (Skalean Maroc)
  - 1-2 Support customers (bilingue fr/ar-MA)
  - 1 Sales/Account Manager (relations brokers/garages partners)
  - 1 Ops technical (incidents resolution)
  - 1 Compliance officer (ACAPS + DGI + AMC interactions)
- [ ] Support 24/7 hotline :
  - Telephone + WhatsApp + email
  - Tier 1 (operations bureau hours) : equipe Marrakech
  - Tier 2 (technical hors bureau) : on-call rotation Skalean Casa+Marrakech
  - Tier 3 (critical incidents) : CTO escalation
- [ ] Tools support :
  - Zendesk/Intercom integration (Sprint 9 Comm)
  - Customer impersonation (Sprint 26) pour debug
  - Sprint 31 Sky integration : self-service first
- [ ] SLA support :
  - P0 (critical) : 1h response + 4h resolution
  - P1 (high) : 4h response + 24h resolution
  - P2 (medium) : 24h response + 72h resolution
  - P3 (low) : 72h response

**Fichiers crees / modifies** :
```
repo/docs/pilote/office-marrakech-setup.md                                                                                                            # ~200 lignes
repo/docs/pilote/support-24-7-runbook.md                                                                                                                # ~300 lignes
repo/docs/pilote/sla-support-customers.md                                                                                                                # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Office operationnel
- V2 (P0) : Equipe locale onboarded
- V3 (P0) : Hotline 24/7 active
- V4 (P0) : SLA documente + tests

---

## Tache 7.7.7 -- Communications Launch

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 8h / Depend de 7.7.6

**But** : Communications launch officiel : RP + marketing + ACAPS notification + presse MA.

**Livrables checkables** :
- [ ] RP Strategy :
  - Communique de presse : "Skalean InsurTech lance pilote Marrakech -- premiere plateforme InsurTech complete au Maroc"
  - Press conference : journalistes economiques + tech MA (Le Matin / Telquel / TelQuel / Bayane / etc.)
  - Interviews podcasts MA tech
  - Video case study Skalean Atlas success
- [ ] Marketing :
  - Campagne LinkedIn ciblage decision makers (brokers + garages + assureurs)
  - Articles thought leadership : ACAPS conformity + AI insurtech
  - Webinaires : "Le futur de l'assurance au Maroc"
- [ ] ACAPS notification officielle :
  - Document declaration plateforme + features + compliance
  - Meeting executif ACAPS : explanation M8 workflow + benefits regulator
  - Premier rapport ACAPS trimestriel pre-emptif (apres 30 jours)
- [ ] Stakeholders communications :
  - Tenants partners email officiel
  - Customers existants Skalean Group notification
  - Investors update : milestone achievement
- [ ] Web presence :
  - Press kit page web-customer-portal
  - Blog launch : techn detail + business value

**Fichiers crees / modifies** :
```
repo/docs/pilote/launch-communications-plan.md                                                                                                              # ~250 lignes
repo/docs/pilote/communique-presse.md                                                                                                                          # ~150 lignes
repo/docs/pilote/acaps-notification-official.md                                                                                                                # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Communique presse distribue
- V2 (P0) : ACAPS notification + meeting
- V3 (P0) : Stakeholders informes
- V4 (P0) : Web presence updated

---

## Tache 7.7.8 -- Launch Day Operations

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 16h / Depend de 7.7.7

**But** : Day-of launch operations : war room + monitoring intensif premier 72h.

**Livrables checkables** :
- [ ] **War room** : equipe Skalean dedicated 72h (rotation 24/7)
  - Casablanca : CTO + 2 backend devs + 2 frontend devs
  - Marrakech : Country Manager + 2 support
  - Communication channel dedicated : Slack #pilote-launch + screen sharing
- [ ] Monitoring intensif :
  - Dashboards Datadog/Grafana visible permanent
  - APM traces : every request inspected
  - SLOs : alerts critical immediate response
  - Audit logs : real-time check anomalies
  - Costs : real-time tracking (eviter cost surge)
- [ ] Issues triage :
  - P0 : war room responds < 15 min
  - P1 : war room responds < 1h
  - P2/P3 : log + post-launch handling
- [ ] Hotfixes preparation :
  - Procedure hotfix deployment 30 min cycle
  - Rollback ready : env var change OR git revert + deploy
- [ ] Comms hourly first 24h :
  - Status updates equipe interne
  - Updates tenants si necessary
- [ ] Customer-facing transparency :
  - Status page : status.skalean-insurtech.ma
  - Updates real-time si incidents

**Fichiers crees / modifies** :
```
repo/docs/pilote/launch-day-runbook.md                                                                                                                          # ~400 lignes
repo/docs/pilote/war-room-protocols.md                                                                                                                            # ~200 lignes
repo/infrastructure/scripts/hotfix-deploy.sh                                                                                                                        # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : War room 72h sustained
- V2 (P0) : Monitoring continuous
- V3 (P0) : Issues triage SLA met
- V4 (P0) : 0 incident critique non-resolu

---

## Tache 7.7.9 -- Pilote 4 Semaines Operations

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 24h / Depend de 7.7.8

**But** : Operations pilote 4 semaines + daily standups + weekly reviews + issues triage continu.

**Livrables checkables** :
- [ ] **Daily standups** (15 min) :
  - Casa + Marrakech equipes
  - Reviews : KPIs jour precedent + issues + decisions
- [ ] **Weekly reviews** (1h) :
  - KPIs hebdomadaires : polices souscrites + sinistres traites + NPS + SLOs
  - Issues retrospective + actions
  - Decisions priority backlog
- [ ] **Issues triage** :
  - Tous P0/P1 : resolution rapide
  - P2/P3 : backlog Phase 8
- [ ] Iteration features :
  - Hotfixes critical : deployment continuous
  - Improvements UX detected via user feedback
  - Sky agent prompts adjustments
- [ ] **Bi-weekly business reviews** : C-level Skalean
- [ ] Documentation evolutive : decisions + learnings

**Fichiers crees / modifies** :
```
repo/docs/pilote/daily-standups-log.md                                                                                                                                # ~500 lignes (4 weeks logs)
repo/docs/pilote/weekly-reviews-{w1,w2,w3,w4}.md                                                                                                                       # 4 weekly reports
repo/docs/pilote/iterations-log.md                                                                                                                                       # ~300 lignes
```

**Criteres validation** :
- V1 (P0) : Daily standups sustained 4 semaines
- V2 (P0) : Weekly reviews documente
- V3 (P0) : Issues triage SLA met
- V4 (P0) : Iterations applique

---

## Tache 7.7.10 -- Customer Feedback Loop

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 10h / Depend de 7.7.9

**But** : Loop feedback customers + NPS surveys + interviews + ratings + iterations rapides.

**Livrables checkables** :
- [ ] NPS surveys post-interactions critiques :
  - Apres souscription police
  - Apres declaration sinistre
  - Apres reparation completee
  - Apres usage Sky agent
- [ ] Interviews qualitatives : 10-15 customers + 5-10 partner users
- [ ] Ratings collectes Sprint 22 web-garage post-livraison
- [ ] Analytics dashboard `/admin/feedback` :
  - NPS score moyen + trends
  - Pain points top mentioned
  - Feature requests
  - Cible NPS > 8 sur 10
- [ ] Iterations weekly basees feedback :
  - UX adjustments
  - Sky prompts improvements
  - Process simplifications
- [ ] Public reviews encourager : Google Reviews + Trustpilot

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/feedback/page.tsx                                                                                                  # ~200 lignes
repo/packages/feedback/src/services/nps-tracker.service.ts                                                                                                                  # ~200 lignes
repo/docs/pilote/customer-feedback-analysis.md                                                                                                                                # ~300 lignes
```

**Criteres validation** :
- V1 (P0) : NPS surveys + interviews
- V2 (P0) : Dashboard feedback
- V3 (P0) : Iterations applique
- V4 (P0) : NPS > 8 cible

---

## Tache 7.7.11 -- KPIs Tracking + ACAPS Reporting

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 8h / Depend de 7.7.10

**But** : Tracking KPIs intensif + dashboards C-level + ACAPS reporting trimestriel pre-emptif.

**Livrables checkables** :
- [ ] **KPIs Business** :
  - Polices souscrites : cible 50+ en 30 jours
  - Sinistres traites end-to-end : cible 30+ en 30 jours
  - Revenue Skalean : commissions + SaaS subscription Sprint 27
  - CAC + LTV (Customer Lifetime Value)
  - Churn rate : cible < 5%
- [ ] **KPIs Operationnels** :
  - SLO compliance % (Sprint 34)
  - Incidents count + MTTR (Mean Time To Resolution)
  - Support tickets count + resolution time
  - Sky usage : conversations + tools usage + accuracy
- [ ] **KPIs Compliance** :
  - ACAPS reports submission on-time
  - DGI SAFT-MA submitted
  - AML alerts processed
  - 0 data breaches (CNDP)
- [ ] Dashboards C-level :
  - Daily : `/admin/c-level-daily` super-restricted access
  - Weekly executive summary email
  - Monthly board report
- [ ] **ACAPS reporting trimestriel** : premier rapport pilote 30 jours (Sprint 28 backend deja consume)

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/c-level-daily/page.tsx                                                                                                # ~250 lignes (super-admin only)
repo/docs/pilote/kpis-tracking-framework.md                                                                                                                                    # ~250 lignes
repo/docs/pilote/acaps-first-report-pilote-q1.md                                                                                                                                # ~300 lignes (formal report)
```

**Criteres validation** :
- V1 (P0) : KPIs tracking framework
- V2 (P0) : Dashboards C-level
- V3 (P0) : ACAPS report submitted

---

## Tache 7.7.12 -- Lessons Learned + Retrospective

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 6h / Depend de 7.7.11

**But** : Retrospective post-pilote + lessons learned documentees + planning Phase 8.

**Livrables checkables** :
- [ ] Retrospective sessions :
  - Equipe technique
  - Equipe ops Marrakech
  - Tenants partners (broker + garage)
  - Customers focus group (10-15 customers)
- [ ] Format retrospective : "Started / Stopped / Continued / Discovered"
- [ ] Lessons learned documents :
  - Technique : architecture decisions success/failure
  - Business : market fit insights + customer behaviors
  - Operations : processes ameliorables
- [ ] Plan corrections + improvements Phase 8

**Fichiers crees / modifies** :
```
repo/docs/pilote/retrospective-pilote-marrakech.md                                                                                                                                # ~400 lignes
repo/docs/pilote/lessons-learned-{technique,business,operations}.md                                                                                                                  # 3 docs
```

**Criteres validation** :
- V1 (P0) : Retrospectives 4 stakeholders groups
- V2 (P0) : Lessons documente

---

## Tache 7.7.13 -- Plan Generalisation Phase 8

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 8h / Depend de 7.7.12

**But** : Plan generalisation post-pilote : Casablanca + Rabat + scale-up roadmap Phase 8.

**Livrables checkables** :
- [ ] Document strategique `repo/docs/phase-8-roadmap-scale-up.md` :
  - **Phase 8.1 Casablanca** (Q3 2026) :
    - 50+ brokers + 20+ garages + 1000+ customers
    - 2-3 assureurs additionnels (vs Wafa pilote)
    - Office expansion Casablanca
  - **Phase 8.2 Rabat** (Q4 2026) :
    - Replication pattern Casablanca
    - 3rd office
  - **Phase 8.3 Autres villes** (Q1 2027) :
    - Tanger + Agadir + Fes
- [ ] Scale-up requirements :
  - Tech : multi-region routing + capacity 10k+ users
  - Business : equipe sales + marketing + support 30+ FTE
  - Compliance : extension reportings volumes superieurs
  - Ai : Skalean AI rollout 100% (Sprint 29 cible)
- [ ] Investment plan : levee fonds Series A si necessary
- [ ] Plan iterations features post-pilote :
  - **Quick wins** Phase 8.1 (top 10 features customers asked)
  - **Medium term** Phase 8.2-3 (next 20 features)
  - **Long term** Phase 9+ (vision strategique)
- [ ] Expansion internationale prep : Tunisie + Algerie (Phase 9)

**Fichiers crees / modifies** :
```
repo/docs/phase-8-roadmap-scale-up.md                                                                                                                                                  # ~600 lignes
repo/docs/phase-8-investment-plan.md                                                                                                                                                      # ~250 lignes
repo/docs/feature-backlog-prioritized.md                                                                                                                                                    # ~400 lignes
```

**Criteres validation** :
- V1 (P0) : Roadmap Phase 8 detaillee
- V2 (P0) : Scale-up requirements
- V3 (P0) : Feature backlog priorise

---

## Tache 7.7.14 -- Programme Closure

**Metadonnees** : Phase 7 / Sprint 35 / P0 / 6h / Depend de 7.7.13

**But** : **Programme closure officielle** : 35 sprints completes + livrables finals + handover documentation.

**Livrables checkables** :
- [ ] **Programme closure document** `repo/docs/programme-closure-final.md` :
  - 35 sprints livres : 35/35 OK
  - 8 apps production-ready
  - 16+ packages metier
  - 470+ taches detaillees executees
  - 69+ tables data
  - Compliance MA complete : ACAPS + DGI + AMC + CNDP
  - Securite ASVS Level 2 certified
  - Performance SLOs validated
  - Pilote Marrakech success
- [ ] **Livrables finals** :
  - Documentation technique complete (300+ docs)
  - Documentation business + operations
  - Code repository transferred to ops team
  - Runbooks ops complets
  - Architecture diagrams final
- [ ] **Handover** :
  - Tech team -> ops team formal handover
  - Equipe Skalean Marrakech : full ownership pilote ongoing
  - Sprint 35 final standup : celebration + acknowledgments
- [ ] **Communications closure** :
  - Annonce internal employees Skalean
  - Annonce partners + customers : pilote success + Phase 8 incoming
  - Press release : milestone achievement
- [ ] Backlog Phase 8 official : Jira/Linear setup with Phase 8 epics

**Fichiers crees / modifies** :
```
repo/docs/programme-closure-final.md                                                                                                                                                          # ~600 lignes
repo/docs/handover-tech-to-ops.md                                                                                                                                                              # ~300 lignes
repo/docs/celebration-acknowledgments.md                                                                                                                                                          # acknowledgments equipe
```

**Criteres validation** :
- V1 (P0) : Programme closure officielle
- V2 (P0) : Handover complete
- V3 (P0) : Communications closure
- V4 (P0) : Phase 8 backlog ready

---

## Sortie du Sprint 35 -- PROGRAMME COMPLETE

A la fin de l'execution des 14 taches :

```
PILOTE MARRAKECH success :
  - Pre-pilote checklist + freeze code + go/no-go signed off
  - Skalean Atlas + Wafa Assurance operational production
  - 2-3 brokers tenants partenaires onboarded + formes
  - 1-2 garages partenaires onboarded + tested
  - 50+ customers acquired Marrakech
  - Office Marrakech + equipe locale 4-6 personnes + support 24/7
  - Communications launch : RP + marketing + ACAPS official + presse MA
  - War room launch day 72h sustained
  - 4 semaines pilote operations : standups + reviews + iterations
  - Customer feedback loop : NPS > 8 + interviews + ratings
  - KPIs tracking C-level + ACAPS reporting trimestriel pilote
  - Lessons learned + retrospective stakeholders
  - Plan Phase 8 scale-up : Casablanca + Rabat + autres villes
  - Programme closure officielle + handover tech -> ops

PROGRAMME 35 SPRINTS COMPLETE -- SKALEAN INSURTECH PRODUCTION-READY
```

---

## RECAP FINAL DU PROGRAMME

**Phases 1-7 : 35 sprints completes**

| Phase | Sprints | Modules livres |
|-------|---------|---------------|
| **Phase 1 Bootstrap** | 4/4 | Monorepo + DB + Kafka + API NestJS + Frontend Next.js |
| **Phase 2 Securite** | 3/3 | Auth + Multi-tenant 3 niveaux + RBAC matrice |
| **Phase 3 Modules Horizontaux** | 6/6 | CRM + Booking + Comm + Docs + Pay + Books + Stock + HR + Analytics |
| **Phase 4 Vertical Insure** | 5/5 | Skalean Broker ERP + 4 webs apps |
| **Phase 5 Vertical Repair** | 7/7 | Skalean Garage ERP + Atlas + IA + flux M8 + Cross-Tenant |
| **Phase 6 Admin Platform** | 3/3 | Admin foundation + tenants management + ACAPS/DGI/AMC/CNDP compliance |
| **Phase 7 Hardening + Pilote** | 7/7 | Skalean AI REST + MCP + Sky + Wafa connecteur + Pentest + Performance + Pilote Marrakech |
| **TOTAL** | **35/35** | **Plateforme InsurTech complete** |

**Livrables consolides** :
- **8 apps web/mobile** : web-broker / web-garage / web-customer-portal / web-assure-portal / web-assure-mobile PWA / web-garage-mobile PWA / web-insurtech-admin / mcp-server
- **API monolithique** + **MCP server** dedicated AI tools
- **16+ packages metier** : auth / database / cache / kafka / crm / booking / comm / docs / pay / books / stock / hr / analytics / insure / repair / sky / ...
- **470+ taches executees** chaque avec checklist + livrables + criteres validation V1-V10 P0/P1/P2
- **69+ tables data** Postgres avec multi-tenant strict + RLS
- **Compliance MA complete** : 4 regulators (ACAPS / DGI / AMC / CNDP)
- **Conformite legale** : 9+ lois MA respectees (43-20 / 09-08 / 17-99 / 9-88 / 43-05 / etc.)
- **Securite certified** : OWASP ASVS Level 2
- **AI integration** : Skalean AI REST + MCP server + Agent Sky multilingue 4 langues
- **Pattern AI-defere** : Mock realistic Sprint 20 -> Real Sprint 29 swap one-line config

**Differentiation marche MA** :
- **Premiere plateforme InsurTech complete** au Maroc
- **Workflow M8** : declaration -> dispatch -> reparation sans courtier actif
- **Multi-tenant strict** : 3 types tenants Repair (Atlas + managed + API partners)
- **Compliance native** : ACAPS + DGI + AMC + CNDP

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-7.7.X-*.md` dans `00-pilotage/prompts-taches/sprint-35-pilote-marrakech/`.

**Sprint final** : moins de patterns code, plus de processus + operations + communications.

**Reference** : Toutes Phases 1-7 deliverables.

---

## ACKNOWLEDGMENTS

Programme realise grace a :
- **Saad** (CTO co-fondateur Skalean) : architecture decisions + execution
- **Abla** (CEO co-fondatrice Skalean) : vision + business model + partnerships
- **Equipe Skalean Maroc** : developpement + ops + support
- **Partners pilote** : Wafa Assurance + Skalean Atlas + 2-3 brokers + 1-2 garages Marrakech
- **Customers pilote** : 50+ assures Marrakech early adopters
- **ACAPS** : regulator Maroc soutien institutionnel
- **Programme Emergence ACAPS** : framework regulatoire enabler
- **Investors** : confiance + financement
- **Cowork + Anthropic Claude** : framework execution + meta-prompts

---

**Fin du meta-prompt B-35 v2.2 format Option B. PROGRAMME 35/35 SPRINTS COMPLETE. SKALEAN INSURTECH PRODUCTION-READY.**

**MISSION ACCOMPLIE** -- Premier au Maroc.
