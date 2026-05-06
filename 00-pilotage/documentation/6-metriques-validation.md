# METRIQUES ET SEUILS DE VALIDATION skalean-insurtech v2.0

**Version** : 2.0.0
**Date** : 2026-05-04
**Description** : Seuils chiffres applicables a chaque sprint pour la verification automatique
**AUCUNE EMOJI AUTORISEE**

**Changelog v2.0** :
- Ajout metriques PWA (Lighthouse 90+ pour apps mobiles)
- Ajout metriques web-customer-portal (Lighthouse Performance 95+, conversion 15%+)
- Ajout metriques flux KYC (auto-approval rate, manual review rate)
- Ajout metriques cross-tenant client/garage
- Ajout metriques Mapbox (geocoding p95, tile cache)

---

## INTRODUCTION

Ce document definit precisement les seuils de validation pour chaque categorie de tests/metriques. La verification automatique apres chaque sprint utilise ces seuils pour decider PASS / FAIL / AVERTISSEMENT.

**Convention** :
- **P0 (critique)** : echec = sprint FAIL, blocage
- **P1 (important)** : echec = sprint AVERTISSEMENT, correction recommandee
- **P2 (souhaite)** : echec = note dans rapport, pas blocage

---

## CATEGORIE 1 -- TESTS UNITAIRES

### Couverture de code

| Metrique | Seuil P0 | Seuil P1 | Outil | Notes |
|----------|----------|----------|-------|-------|
| Lignes (lines) | >= 85% | >= 90% | vitest --coverage | Module critique : >= 90% |
| Branches | >= 80% | >= 85% | vitest --coverage | |
| Fonctions | >= 90% | >= 95% | vitest --coverage | |
| Statements | >= 85% | >= 90% | vitest --coverage | |

**Modules critiques exigeant 90%+ lignes** :
- packages/auth
- packages/horizontal-pay-ma
- packages/horizontal-compliance-acaps
- packages/horizontal-docs-signature-ma
- packages/customer-portal-services (NOUVEAU v2.0)
- packages/assure-portal-services (NOUVEAU v2.0)

### Performance des tests

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Duree totale unit tests | <= 5 min | <= 3 min | Sur runner CI standard |
| Tests flaky | 0 | 0 | Aucun test instable tolere |

---

## CATEGORIE 2 -- TESTS E2E

### Playwright (apps frontend)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Scenarios cles passes | 100% | 100% | Tous les "happy paths" |
| Scenarios degrades | >= 80% | >= 90% | Erreurs reseau, etc. |
| Duree totale E2E | <= 30 min | <= 20 min | |
| Browsers couverts | chromium | chromium + firefox | |

### Scenarios E2E par app v2.0

**web-broker** : 5 scenarios cles
- Login + dashboard
- Wizard creation police complete
- Renouvellement police
- Resiliation
- Onboarding utilisateur

**web-garage** : 5 scenarios cles
- Reception vehicule
- Workflow sinistre 10 etats
- Validation devis IA
- Restitution + signature
- Onboarding technicien

**web-customer-portal NOUVEAU v2.0** : 4 scenarios cles
- Cotation publique end-to-end
- Selection produit + signup
- KYC pre-approbation auto-approuve
- KYC pre-approbation escalade manuelle

**web-assure-mobile NOUVEAU v2.0** : 4 scenarios cles
- Installation PWA
- Declaration sinistre avec photos + voix darija
- Choix garage agree avec carte Mapbox
- Suivi sinistre temps reel

---

## CATEGORIE 3 -- PERFORMANCE

### Backend API

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| p95 latence endpoints critiques | <= 150ms | <= 100ms | Auth, polices, sinistres |
| p95 latence endpoints standards | <= 300ms | <= 200ms | CRM, listes |
| p95 latence endpoints lourds | <= 1000ms | <= 500ms | Comparateur 5 assureurs |
| p99 latence | <= 500ms | <= 300ms | |
| Throughput | >= 1000 RPS | >= 2000 RPS | Sur 1 instance |
| Memory leak | 0 | 0 | Aucune fuite tolerable |

### Frontend Lighthouse (mises a jour v2.0)

#### Apps SaaS B2B (web-broker, web-garage, web-insurtech-admin)

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Performance | >= 80 | >= 90 |
| Accessibility | >= 90 | >= 95 |
| Best Practices | >= 90 | >= 95 |
| SEO | >= 80 | >= 90 |

#### Apps PWA (web-garage-mobile, web-assure-mobile) -- NOUVEAU v2.0

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Performance | >= 80 | >= 90 |
| PWA | >= 90 | >= 95 |
| Accessibility | >= 90 | >= 95 |
| Best Practices | >= 90 | >= 95 |
| Manifest valide | OUI | OUI |
| Service worker actif | OUI | OUI |
| Offline shell | <= 500ms | <= 300ms |
| Installable iOS+Android | OUI | OUI |

#### Web-customer-portal (NOUVEAU v2.0 -- standards eleves)

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Performance | >= 95 | >= 98 |
| Accessibility | >= 95 | >= 98 |
| Best Practices | >= 90 | >= 95 |
| SEO | >= 95 | >= 98 |
| LCP | <= 2.0s | <= 1.5s |
| FID | <= 100ms | <= 50ms |
| CLS | <= 0.05 | <= 0.02 |
| Time to Interactive | <= 3.5s | <= 2.5s |

### Database

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| p95 query latency | <= 50ms | <= 30ms | Sur queries indexees |
| Slow queries (>1s) | <= 1% | <= 0.5% | Log slow query enabled |
| Connection pool saturation | <= 70% | <= 50% | PgBouncer monitoring |

---

## CATEGORIE 4 -- SECURITE

### Tests securite automatises

| Metrique | Seuil P0 | Seuil P1 | Outil |
|----------|----------|----------|-------|
| Vulnerabilites High/Critical | 0 | 0 | Snyk + dependabot |
| Secrets dans le code | 0 | 0 | gitleaks pre-commit |
| Headers HTTP securite | 100% | 100% | helmet active sur API |
| CSP en place | active | active + enforce | Phase 9+ |
| Tests RBAC | 100% PASS | 100% PASS | Tests automatises |

### Tests cross-tenant (NOUVEAU v2.0)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Tentative acces cross-tenant non autorise | 0 succes | 0 succes | Test tenant A accede tenant B |
| Tentative acces sans `x-tenant-id` | 0 succes | 0 succes | Sauf endpoints `/public/*` |
| Auto-authorization (tenant -> meme tenant) | 0 succes | 0 succes | Doit etre rejete |
| Acces apres expiration authorization | 0 succes | 0 succes | Expires_at respecte |

### Tests endpoints publics (NOUVEAU v2.0)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Rate limit /public/* | 30/min/IP | 30/min/IP | 31eme requete -> 429 |
| Endpoints `/public/*` sans auth | OUI | OUI | Acces sans header `x-tenant-id` |
| PII en DB persistante avant signup | 0 enregistrement | 0 enregistrement | Sessions Redis uniquement |

### Pentest externe (Phase 9 uniquement)

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Vulnerabilites Critical | 0 | 0 |
| Vulnerabilites High | 0 | 0 |
| Vulnerabilites Medium | <= 3 | 0 |
| Vulnerabilites Low | <= 10 | <= 5 |

---

## CATEGORIE 5 -- CONFORMITE

### Audit ACAPS

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Coverage audit sur tables `insure_*` | 100% | 100% | Auto via EventSubscriber |
| Coverage audit sur tables `repair_*` | 100% | 100% | |
| Coverage audit sur tables `pay_*` | 100% | 100% | |
| Coverage audit sur cross-tenant authorizations (NOUVEAU v2.0) | 100% | 100% | |
| Reports periodiques generes | OUI | OUI | Mensuel/trimestriel/annuel |

### Conformite loi 09-08 (CNDP)

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Consentement explicite avant traitement PII | 100% | 100% |
| Donnees residentes Maroc | 100% | 100% |
| Procedure purge sur demande operationnelle | OUI | OUI |
| TTL sessions prospects respecte (NOUVEAU v2.0) | 30 min | 30 min |
| Anonymisation prospects non-converti J+30 (NOUVEAU v2.0) | OUI | OUI |

### Conformite loi 43-20

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Tiers de confiance certifie utilise | OUI (Barid eSign) | OUI |
| Hash SHA-512 sur signatures | 100% | 100% |
| Horodatage qualifie RFC 3161 | 100% | 100% |
| Archivage legal 10 ans | OUI | OUI |
| Documents provisoires signes electroniquement (NOUVEAU v2.0) | OUI | OUI |

---

## CATEGORIE 6 -- INTEGRATIONS EXTERNES

### Skalean AI

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| p95 chat | <= 3s | <= 2s | LLM Sky |
| p95 agents | <= 5s | <= 3s | Anti-fraude, KYC |
| p95 cotation matching (NOUVEAU v2.0) | <= 8s | <= 5s | 5 assureurs en parallele |
| p95 KYC pre-approbation (NOUVEAU v2.0) | <= 5s | <= 3s | OCR CIN + scoring |
| p95 voice transcribe darija (NOUVEAU v2.0) | <= 4s | <= 3s | MCP tool |
| p95 MCP estimation photos | <= 60s | <= 30s | Long-running |
| Disponibilite | >= 99.5% | >= 99.9% | |

### Passerelles paiement

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| p95 CMI | <= 8s | <= 5s |
| p95 YouCan Pay | <= 5s | <= 3s |
| p95 PayZone | <= 5s | <= 3s |
| Disponibilite globale (au moins 1 fonctionne) | 99.99% | 99.99% |
| Webhooks idempotents | 100% | 100% |
| Signatures verifiees | 100% | 100% |

### Connecteurs assureurs (mises a jour v2.0)

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| p95 getDevis (par assureur) | <= 10s | <= 5s |
| p95 souscrire | <= 15s | <= 10s |
| p95 declarerSinistre (NOUVEAU v2.0) | <= 10s | <= 5s |
| p95 getGaragesAgrees (NOUVEAU v2.0) | <= 5s | <= 2s |
| p95 syncCatalog (NOUVEAU v2.0) | <= 5min | <= 3min |
| Comparateur 5 assureurs (parallele) | <= 10s | <= 8s |
| Health check disponibilite | 99% | 99.5% |

### Mapbox (NOUVEAU v2.0)

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| p95 geocoding | <= 800ms | <= 500ms |
| p95 tile load (cache hit) | <= 100ms | <= 50ms |
| p95 tile load (cache miss) | <= 1500ms | <= 800ms |
| Cache hit rate | >= 80% | >= 95% |

---

## CATEGORIE 7 -- METRIQUES BUSINESS

### Conversion prospects (NOUVEAU v2.0)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Taux conversion landing -> formulaire | >= 5% | >= 10% | Pendant pilote |
| Taux conversion formulaire -> cotation comparee | >= 80% | >= 90% | |
| Taux conversion cotation -> selection produit | >= 30% | >= 45% | |
| Taux conversion selection -> signup | >= 60% | >= 75% | |
| Taux conversion signup -> KYC submitted | >= 70% | >= 85% | |
| Taux conversion KYC -> document provisoire signe | >= 85% | >= 95% | |
| Taux conversion document -> paiement | >= 70% | >= 85% | |
| **Taux conversion global prospect -> assure** | **>= 15%** | **>= 25%** | Cible KPI v2.0 |

### KYC pre-approbation (NOUVEAU v2.0)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Taux auto-approval (score >= 0.85) | >= 60% | >= 75% | |
| Taux manual review (0.65-0.85) | <= 30% | <= 20% | |
| Taux auto-reject (< 0.30) | <= 10% | <= 5% | |
| Delai validation manuelle | <= 24h | <= 12h | |

### Sinistre client flow (NOUVEAU v2.0)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Delai declaration -> envoi assureur | <= 5 min | <= 2 min | Routage automatique |
| Delai declaration -> choix garage | <= 24h | <= 12h | Selection client |
| Delai choix garage -> reception vehicule | <= 48h | <= 24h | Garage prend rdv |
| **Delai sinistre total declaration -> cloture** | **<= 24h** | **<= 12h** | Cible KPI v2.0 (workflow IA garage) |

### Validation courtier (NOUVEAU v2.0)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| File queue validation moyenne | <= 50 dossiers | <= 20 dossiers | |
| Delai validation moyen | <= 12h | <= 6h | |
| Taux validation J+1 | >= 95% | >= 99% | |
| Taux rejet validation | <= 5% | <= 2% | |

### Skalean Garage performance

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Delai sinistre moyen reception -> cloture | <= 24h | <= 12h |
| Precision IA estimation vs expert | >= 85% | >= 90% |
| Taux validation IA chef atelier | >= 80% | >= 90% |
| Score qualite QA moyen | >= 4/5 | >= 4.5/5 |

### Skalean Broker performance

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Delai souscription police moyen | <= 5 min | <= 3 min |
| Taux pickup commissions | >= 95% | >= 98% |
| Taux retention clients courtage | >= 85% | >= 92% |

---

## CATEGORIE 8 -- METRIQUES PILOTE MARRAKECH

### Sprint 35 -- 30 jours pilote

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Disponibilite plateforme | 99.9% | 99.99% | |
| Incidents Critical | 0 | 0 | |
| Incidents High | <= 2 | 0 | |
| NPS pilote | > 30 | > 50 | |
| Satisfaction (echelle 5) | > 4 | > 4.5 | |
| Cabinets pilotes actifs | >= 2 | >= 3 | |
| **Prospects ayant utilise customer-portal (NOUVEAU v2.0)** | **>= 100** | **>= 200** | |
| **Polices vendues via flux online (NOUVEAU v2.0)** | **>= 30** | **>= 50** | |
| Polices vendues via flux agence | >= 50 | >= 100 | |
| Sinistres geres | >= 20 | >= 50 | |
| Bugs critiques rencontres | 0 | 0 | |

---

## CATEGORIE 9 -- METRIQUES OBSERVABILITE

### Logs Pino

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Logs structures JSON | 100% | 100% | Aucun console.log |
| Champs sensibles redacted | 100% | 100% | passwords, tokens, secrets |
| Trace ID present | 100% | 100% | Pour correlation |
| Tenant ID present | 100% | 100% | Sauf pre-auth |
| Volume logs | <= 10 GB/jour | <= 5 GB/jour | Production |

### Metrics Prometheus

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| /metrics endpoint expose | OUI | OUI |
| Custom metrics par module | OUI | OUI |
| Histograms latency | OUI | OUI |
| Counters business events | OUI | OUI |

### Alertes Grafana

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Alertes critiques routees vers PagerDuty | OUI | OUI |
| MTTR alertes critiques | <= 1h | <= 30 min |
| Faux positifs alertes | <= 5% | <= 1% |

---

## CATEGORIE 10 -- METRIQUES MONITORING APPS CLIENTES (NOUVEAU v2.0)

### Web-customer-portal

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Sessions actives concurrentes | jusqu'a 500 | jusqu'a 1000 |
| Erreurs JS frontend | <= 0.1% | <= 0.05% |
| Funnel conversion tracked (PostHog) | OUI | OUI |
| Heatmaps actives | OUI | OUI |

### Web-assure-mobile (PWA)

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Sessions actives concurrentes | jusqu'a 5000 | jusqu'a 20000 |
| Taux installation PWA | >= 30% | >= 50% |
| Push notifications opt-in | >= 50% | >= 70% |
| Erreurs JS frontend | <= 0.5% | <= 0.2% |
| Crash rate (PWA) | <= 0.1% | <= 0.05% |

---

## VERIFICATION AUTOMATIQUE PAR SPRINT

A la fin de chaque sprint, le verification-script automatise verifie :

1. **Tous les criteres P0** du sprint courant -> doivent etre 100% PASS
2. **Tous les criteres P0 globaux** (tests, securite, conformite) -> doivent etre 100% PASS
3. **Au moins 80% des criteres P1** -> doivent etre PASS

Si l'un de ces 3 niveaux n'est pas atteint : sprint en FAIL, blocage merge sur main.

Les criteres P2 sont notes dans le rapport mais n'influencent pas le statut.

---

## SEUILS PAR PHASE (mises a jour v2.0)

### Phase 1 (infrastructure)

Focus : tous les seuils de base operationnels.

### Phase 2 (auth)

Focus : tests RBAC 100% PASS + tests cross-tenant 0 succes non-autorise.

### Phase 4 (modules horizontaux)

Focus : couverture tests 85%+ + integration tests sandbox 100% PASS.

### Phase 5 (Broker + apps clientes v2.0)

Focus :
- Tests cross-tenant client/garage
- Lighthouse customer-portal 95+
- Conversion funnel tracking actif
- KYC pre-approbation operationnel

### Phase 6 (Garage + flux sinistre client v2.0)

Focus :
- IA estimation precision >= 85%
- Workflow sinistre 10 etats
- PWA web-assure-mobile Lighthouse 90+
- Voice darija transcription operationnelle

### Phase 7 (cross-tenant)

Focus : tests autorisations strictes 0 faille + audit complet.

### Phase 9 (hardening)

Focus : pentest sans High/Critical + CSP enforce + load tests 1000 tenants.

### Phase 10 (pilote)

Focus : metriques business pilote (NPS, conversion, sinistres geres).

---

**Fin du document `6-metriques-validation.md` v2.0.**

**Tous les seuils sont applicables a la verification automatique post-sprint.**

---

## CATEGORIE NOUVELLE v2.2 -- MCP SERVER + SKY AGENT METRIQUES

### MCP Server (Sprint 30)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Tools discovery latency | <= 500ms | <= 200ms | `GET /mcp/v1/discover` |
| Tool call latency p95 (read) | <= 1000ms | <= 500ms | tools read-only |
| Tool call latency p95 (write) | <= 3000ms | <= 1500ms | tools write avec audit |
| Tools count exposed | >= 15 | >= 20 | Sprint 30 livre 15+ |
| Tool errors rate | < 1% | < 0.1% | excluding capabilities denial legit |
| MCP token validation latency | <= 50ms | <= 20ms | jose JWT verify |
| Capabilities check latency | <= 30ms | <= 10ms | from Redis cache |
| Audit log write success | >= 99.9% | 100% | mcp_audit_log table |
| Idempotency dedup hit rate | track | track | Redis dedup 1h |

### Agent Sky (Sprint 31)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| Time-to-first-token (TTFT) | <= 2s | <= 1s | streaming response |
| End-to-end response p95 | <= 15s | <= 8s | conversation incl tool calls |
| Tool call iterations p95 | <= 3 | <= 2 | agent loop safety |
| Conversation success rate | >= 70% | >= 85% | resolved without escalation |
| User satisfaction rating | >= 4/5 | >= 4.5/5 | post-conversation rating |
| Cost per conversation MAD | track | track | budget alerts |
| Locale fallback rate | < 5% | < 1% | si locale demande non-supported |
| Voice transcription accuracy | >= 85% | >= 95% | fr-MA + ar (Sprint 18 + 31) |
| Confirmation modal acceptation rate | >= 80% | >= 90% | write tools confirm |

### Cost Monitoring AI (Sprint 29)

| Metrique | Seuil P0 | Seuil P1 |
|----------|----------|----------|
| Daily budget used | < 80% | < 60% |
| Monthly budget used | < 80% | < 60% |
| Budget alert thresholds triggered | 50%/75%/90% | NA |
| Cost per vision call MAD | <= 0.20 | <= 0.12 |
| Cost per LLM token MAD | <= 0.00002 | <= 0.000015 |

---

## CATEGORIE NOUVELLE v2.2 -- LIGHTHOUSE PER APP CIBLES PRECISES

### Tableau consolide cibles Lighthouse 9 apps v2.2

| App | Performance | Accessibility | Best Practices | SEO | PWA | Notes |
|-----|-------------|---------------|----------------|-----|-----|-------|
| web-insurtech-admin | >= 85 | >= 90 | >= 90 | NA | NA | Admin Skalean staff (Sprint 26) |
| web-broker | >= 85 | >= 90 | >= 90 | NA | NA | SaaS B2B courtiers (Sprint 16) |
| web-garage | >= 85 | >= 90 | >= 90 | NA | NA | SaaS B2B garages (Sprint 22) |
| web-garage-mobile | >= 90 | >= 90 | >= 90 | NA | **>= 95** | PWA technicien (Sprint 23) |
| **web-customer-portal** | **>= 95** | >= 95 | >= 95 | **100** | NA | Vente en ligne SEO (Sprint 17) |
| web-assure-portal | >= 90 | >= 90 | >= 90 | NA | NA | Assure desktop (Sprint 18) |
| web-assure-mobile | >= 90 | >= 90 | >= 90 | NA | **>= 100** | PWA assure (Sprint 18) |
| api | NA | NA | NA | NA | NA | Backend (pas Lighthouse) |
| mcp-server | NA | NA | NA | NA | NA | Backend (pas Lighthouse) |

### Justification cibles elevees

- **web-customer-portal Performance >= 95 + SEO 100** : impact direct conversion 15%+ prospect -> assure (Sprint 17). SSG landing + ISR catalogue = optimisation native Next.js 15
- **web-assure-mobile PWA >= 100** : critique pour adoption mobile assures (declaration sinistre M8 -- Sprint 18 + 24)
- **web-garage-mobile PWA >= 95** : technicien atelier productivite mobile (Sprint 23 WebAuthn biometric)
- **Apps B2B Performance 85+** : standards eleves mais pas critiques (users connectes vs prospects)

### Mesures Sprint 33 hardening

Sprint 33 Pentest livre rapports Lighthouse :
- Audit pre-prod toutes 7 apps web
- Tests sur reseau 3G simule (slow connections MA)
- Tests RTL (ar / ar-MA) -- Sprint 9 + 17 + 31
- Tests offline (PWA mobile)
- Score baseline + plan ameliorations Phase 8+ si necessaires

---

## CATEGORIE NOUVELLE v2.2 -- ATLAS CLOUD SERVICES INFRA SLOs (Sprint 34)

| Metrique | Seuil P0 | Seuil P1 | Notes |
|----------|----------|----------|-------|
| API uptime | >= 99.9% | >= 99.99% | DC1 Tier III (DC2 Tier IV pour critical workloads) |
| DB latency p95 | <= 50ms | <= 20ms | Atlas RDBMS managed |
| S3 Object Storage put p95 | <= 200ms | <= 100ms | Atlas Object Storage Benguerir |
| KMS decrypt latency p95 | <= 50ms | <= 20ms | Atlas Key Management |
| Failover DC1 -> DC2 RTO | <= 5 min | <= 1 min | DR strategy Tier IV |
| Cross-DC backup latency | <= 1h | <= 15min | snapshot + replication |

---

