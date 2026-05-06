# ROADMAP EXECUTION skalean-insurtech v2.2

**Version** : 2.2.0
**Date** : 2026-05-05
**Statut** : ALIGNE v2.2 -- 35 sprints / 7 phases / 12 mois
**AUCUNE EMOJI AUTORISEE**

**Changelog v2.2** :
- Restructuration 7 phases (vs 10 v2.0)
- decision-007 AI-defere : Skalean AI client deplace de Phase 3 (v2.0) -> Phase 7 Sprint 29-31
- decision-010 Insure Connecteurs defere : ancien Sprint 15 -> Sprint 32 (Phase 7)
- Pattern AI-defere + ecosystem-defere : tout dependance externe groupee Phase 7
- Cascade renumerotation appliquee

---

## 1. PRINCIPES STRUCTURANTS

### 1.1 Pourquoi 7 phases (vs 10 v2.0)

La structure v2.0 (10 phases) avait des phases mono-sprint (Phase 7 Cross-tenant = 1 sprint, Phase 10 Pilote = 1 sprint) qui ne justifiaient pas une separation phase. v2.2 reorganise en 7 phases coherentes :

| Phase | Sprints | Justification |
|---|---|---|
| 1 Bootstrap | 4 | Setup infrastructure complete |
| 2 Securite | 3 | Auth + Multi-tenant + RBAC = security foundation |
| 3 Modules Horizontaux | 6 | Building blocks horizontaux (CRM/Pay/Books/etc.) |
| 4 Vertical Insure | 5 | Skalean Broker ERP complet |
| 5 Vertical Repair | 7 | Skalean Garage ERP + Atlas + Cross-Tenant + flux M8 |
| 6 Admin Platform | 3 | Skalean Admin coherent |
| 7 Hardening + Pilote | 7 | Tout dependance externe (AI + connecteurs) + audits + pilote |

### 1.2 Strategie ecosystem-defere

Tout module dependant ecosystem externe -> Phase 7 :
- Skalean AI (decision-007) : Mock Sprint 20 -> Real Sprint 29 swap one-line
- Connecteurs assureurs (decision-010) : lookup Sprint 14 -> Real Sprint 32 swap

Rationale : predictabilite execution + negociations en parallele + pilote 1 partenaire suffisant.

### 1.3 Strategie ressource

- 1 sprint = 2 semaines = ~70-80h dev (1 dev FTE)
- 35 sprints x 2 sem = ~16 mois (1 dev FTE)
- Avec 2 devs FTE : ~12 mois (cible)
- Pilote Mois 12 + 4 sem suivi

---

## 2. ORDRE EXECUTION DETAILLE

### Phase 1 -- Bootstrap (Sprints 1-4 -- 8 semaines)

| Sprint | Cumul | Theme | Duree |
|---|---|---|---|
| 1.1 | 1 | Bootstrap monorepo + Docker + Postgres+RLS + Kafka + MinIO | 2 sem |
| 1.2 | 2 | Database 32 tables + Kafka topics + seeds | 2 sem |
| 1.3 | 3 | API NestJS + Fastify + observability + Swagger | 2 sem |
| 1.4 | 4 | Frontend 8 apps Next.js + 5 packages shared + i18n + PWA | 2 sem |

Sortie : 9 apps deployables (mcp-server stub Sprint 1, implemente Sprint 30).

### Phase 2 -- Securite (Sprints 5-7 -- 6 semaines)

| Sprint | Cumul | Theme |
|---|---|---|
| 2.1 | 5 | Auth (argon2id + JWT + MFA) |
| 2.2 | 6 | Multi-tenant 3 niveaux (Platform / Tenant / L3 Assure) |
| 2.3 | 7 | RBAC (12 roles x 85+ permissions) |

Sortie : 0 leak cross-tenant + 80+ tests RBAC.

### Phase 3 -- Modules Horizontaux (Sprints 8-13 -- 12 semaines)

| Sprint | Cumul | Theme |
|---|---|---|
| 3.1 | 8 | CRM + Booking |
| 3.2 | 9 | Comm WhatsApp + Email |
| 3.3 | 10 | Docs + Signature loi 43-20 |
| 3.4 | 11 | Pay multi-passerelles MA |
| 3.5 | 12 | Books CGNC + Compliance ACAPS/DGI/AMC |
| 3.6 | 13 | Analytics ClickHouse + Stock + HR |

Sortie : 30+ entities + 100+ endpoints + Conformite 09-08/43-20/ACAPS/CGNC/AMC.

NOTE : Sprint 8-9 NE sont PAS Skalean AI (vs v2.0). AI -> Phase 7 (decision-007).

### Phase 4 -- Vertical Insure (Sprints 14-18 -- 10 semaines)

| Sprint | Cumul | Theme |
|---|---|---|
| 4.1 | 14 | Insure Foundation (7 entities + tarification lookup) |
| 4.2 | 15 | Insure Lifecycle Avance (transferts/flottes/queue/provisional) |
| 4.3 | 16 | Web Broker App |
| 4.4 | 17 | Web Customer Portal vente en ligne SEO |
| 4.5 | 18 | Web Assure Portal + Mobile PWA |

Sortie : Skalean Broker ERP production-ready (sans connecteurs reels -- decision-010).

### Phase 5 -- Vertical Repair (Sprints 19-25 -- 14 semaines)

| Sprint | Cumul | Theme |
|---|---|---|
| 5.1 | 19 | Vertical Repair Foundation (Skalean Atlas seed) |
| 5.2 | 20 | IA Estimation Photos (mock + DI swap -- decision-007) |
| 5.3 | 21 | Sinistre Workflow detaille |
| 5.4 | 22 | Web Garage App |
| 5.5 | 23 | Web Garage Mobile PWA technicien (WebAuthn) |
| 5.6 | 24 | Flux Sinistre Client M8 end-to-end |
| 5.7 | 25 | Cross-Tenant Framework (3 types tenants Repair) |

Sortie : Skalean Garage ERP production-ready + premier flux M8 marche MA.

### Phase 6 -- Admin Platform (Sprints 26-28 -- 6 semaines)

| Sprint | Cumul | Theme |
|---|---|---|
| 6.1 | 26 | Admin Foundation (web-insurtech-admin + impersonation) |
| 6.2 | 27 | Tenants Management (onboarding wizard + billing) |
| 6.3 | 28 | Admin Reports + Compliance (4 regulators MA) |

### Phase 7 -- Hardening + Integrations + Pilote (Sprints 29-35 -- 14 semaines)

| Sprint | Cumul | Theme |
|---|---|---|
| 7.1 | 29 | Skalean AI REST integration (swap Mock -> Real -- decision-007) |
| 7.2 | 30 | Skalean AI MCP server (port 4001 -- 15 tools metier) |
| 7.3 | 31 | Agent Sky multilingue (4 langues -- 3 apps) |
| 7.4 | 32 | Insure Connecteurs Assureurs (5 connecteurs -- decision-010) |
| 7.5 | 33 | Pentest Securite (audit externe + ASVS Level 2) |
| 7.6 | 34 | Performance Scaling (load + chaos + SLOs) |
| 7.7 | 35 | Pilote Marrakech + Go-Live (4 sem + suivi) |

Sortie : Plateforme production-ready + Pilote Marrakech success.

---

## 3. AI-DEFERE STRATEGY (decision-007)

### 3.1 Pattern Mock -> Real swap

- Sprint 20 (Phase 5) : MockIaEstimationClient -- mock realistic
- Sprint 29 (Phase 7) : SkaleanAiVisionClient -- real Skalean AI
- Swap : IA_ESTIMATION_PROVIDER=mock -> skalean_ai (one-line)

### 3.2 Pourquoi defere

1. API Skalean AI peut evoluer pendant Phase 5-6 dev
2. Cout : real calls couteux pendant dev
3. Tests deterministes (mock consistent)
4. Pas de bloquant flows downstream

### 3.3 Strategie activation gradual

- Sprint 29 : 10% trafic real / 90% mock
- Sprint 30 : 50/50
- Sprint 31 : 100% real
- Rollback < 60s

---

## 4. ECOSYSTEM-DEFERE STRATEGY (decision-010)

### 4.1 Pattern lookup -> connecteurs

- Sprint 14 (Phase 4) : lookup tables (data assureurs cached)
- Sprint 32 (Phase 7) : 5 connecteurs API real-time (Wafa+Atlanta+Saham+RMA+AXA)
- Adapter pattern : TarificationOrchestrator route lookup vs API si dispo

### 4.2 Pourquoi defere

1. Partenariats commerciaux + sandboxes acquisition AVANT integration
2. API maturity variable (Wafa moderne ; AXA/RMA partiel)
3. ACAPS Programme Emergence ne demande pas connecteurs reels
4. Pilote 1 assureur Wafa suffisant Sprint 35

### 4.3 Mitigation Phase 4-6

- Tarification lookup Sprint 14 (10-20% off acceptable)
- Souscription : signature Skalean fonctionne sans push assureur
- Sinistres : declaration interne Skalean
- ACAPS reports : donnees internes Skalean

---

## 5. JALONS BUSINESS

| Jalon | Mois | Sprint | Apport |
|---|---|---|---|
| J1 | 2 | 4 | Infrastructure + 9 apps demarrent |
| J2 | 3 | 7 | Auth + RLS + RBAC complete |
| J3 | 6 | 13 | Modules horizontaux complets |
| J4 | 8 | 18 | Skalean Broker ERP + vente en ligne |
| J5 | 10 | 25 | Skalean Garage ERP + Flux M8 |
| J6 | 11 | 28 | Admin Platform + Compliance 4 regulators |
| J7 | 12 | 35 | Pilote Marrakech success + Go-Live |

---

## 6. RISQUES + MITIGATIONS

| Risque | Mitigation |
|---|---|
| Skalean AI API non prete Sprint 29 | decision-007 mock + circuit breaker fallback |
| Wafa partenariat retarde | decision-010 lookup tables suffisent |
| Pentest critical findings | Pre-audit hardening Sprint 33 + 0 critical/high BLOCK Sprint 35 |
| ACAPS reports non valides | Sprint 12 + 28 + audit pre-emptive |
| Performance issues > 200 users | Sprint 34 load + chaos + autoscaling |
| Customer acquisition < 50 polices Sprint 35 | Multi-channel + offre incitative |
| Sous-effectif equipe | 2 devs FTE minimum + freelance backup |

---

## 7. COMMUNICATION

- Daily standups (15min)
- Weekly demos stakeholders (30min)
- Bi-weekly business reviews C-level (1h)
- Monthly board reports investisseurs + ACAPS update

---

## 8. PROCHAINES ETAPES (post Phase A)

1. Phase A : alignement documentation racine v2.2 -- EN COURS
2. Phase B : 8 actions P1 (Sky web-assure-portal, migration data legacy, etc.)
3. Phase C : 8 actions P2 (qualite optionnelle)
4. Generation 35 orchestrateurs C-XX
5. Generation 35 verifications V-XX
6. Onboarding Cowork pour generation prompts taches individuels
7. Demarrage execution Sprint 1 (Bootstrap)

---

## 9. VERSION HISTORY

| Version | Date | Changements |
|---|---|---|
| v1.0 | 2025-12 | 32 sprints / 9 phases initial |
| v2.0 | 2026-04 | 35 sprints / 10 phases (3 apps clientes) |
| v2.1 | 2026-05 | Densification Option B (en cours) |
| v2.2 | 2026-05-05 | 35 sprints / 7 phases / decision-007 + decision-010 cascade |

---

Fin 9-roadmap-execution.md v2.2.
