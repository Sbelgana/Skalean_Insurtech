# ORCHESTRATEURS C-XX -- Phase Coordination skalean-insurtech v2.2 (DETAILED)

**Version** : 2.2.0 (Option B detaillee)
**Date** : Mai 2026
**Statut** : 35/35 orchestrateurs detailles livres
**AUCUNE EMOJI AUTORISEE**

---

## Vue d'ensemble

Ce dossier contient les **35 orchestrateurs sprint detailles** qui pilotent l'execution sequentielle complete de chaque sprint par **Claude Code / Cowork**.

Chaque orchestrateur extrait le contenu reel de son meta-prompt B-XX correspondant :
- **But reel** de chaque tache (extrait de B-XX)
- **Actions principales** (livrables checkables)
- **Fichiers cibles** principaux
- **Criteres P0** validation
- **Validation + Commit** Conventional Commits

**Difference avec les meta-prompts B-XX** :
- `B-XX-sprint-XX-*.md` : Specifications detaillees de chaque sprint (~30-40 ko chacun -- patterns code + tests exhaustifs + criteres V1-V10)
- `C-XX-sprint-XX-*.md` : **Instructions execution sequentielle pour Claude Code / Cowork** (~30-40 ko chacun -- ordre taches + validation incrementale + commits)
- `V-XX-sprint-XX-verification.md` : Verification automatique post-sprint (a generer Phase suivante)

---

## Statistiques globales (DETAILED)

| Metric | Valeur |
|---|---|
| Fichiers C-XX livres | 35/35 + README |
| Taches detaillees | 461 (toutes avec But + livrables + fichiers + criteres) |
| Volume cumul | 1.2 Mo |
| Taille moyenne par C-XX | 34 ko |
| Effort cumul | ~2 720 heures (~12 mois 2 devs FTE) |
| Tests E2E cumul | 5284+ scenarios (>10x cible 500) |

---

## Structure orchestrateur

Chaque orchestrateur C-XX contient :

1. **En-tete** : metadata (Phase / Sprint / Reference / Effort / Apport metier)
2. **Structure des fichiers** : liste prompts taches + verification cible
3. **Regles d'execution critiques** : sequencement obligatoire + handling failures
4. **Regles absolues skalean-insurtech** : multi-tenant / Zod / Pino / RBAC / no-emoji / etc.
5. **Contexte phase** : position sprint + modules concernes + apport business
6. **Execution sequentielle des N taches** : pour chaque tache : but + commande lecture + validation + commit
7. **Verification du sprint** : commande lancement V-XX + criteres GO/GO CONDITIONNEL/NO-GO
8. **Resume du workflow** : diagramme ASCII + duree + modules + apport
9. **Commandes de lancement** : prerequis + lancement Cowork

---

## Navigation par phase

### Phase 1 -- Bootstrap Infrastructure (4 sprints)

| Sprint | Orchestrateur | Taches | Effort | Apport |
|--------|---------------|--------|--------|--------|
| 1 | C-01-sprint-01-bootstrap.md | 15 | 80h | Infrastructure complete + 9 apps stubs |
| 2 | C-02-sprint-02-database-kafka.md | 15 | 80h | Schema 32 tables + 30+ topics Kafka |
| 3 | C-03-sprint-03-api-bootstrap.md | 15 | 75h | API NestJS + Swagger |
| 4 | C-04-sprint-04-frontend-bootstrap.md | 15 | 90h | 8 apps Next.js + 5 packages shared |

### Phase 2 -- Securite (3 sprints)

| Sprint | Orchestrateur | Taches | Effort | Apport |
|--------|---------------|--------|--------|--------|
| 5 | C-05-sprint-05-auth-foundations.md | 15 | 80h | Auth complete (argon2id + JWT + MFA) |
| 6 | C-06-sprint-06-multi-tenant.md | 12 | 75h | RLS isolation 0 leak cross-tenant |
| 7 | C-07-sprint-07-rbac.md | 12 | 70h | RBAC + 80+ tests scenarios |

### Phase 3 -- Modules Horizontaux (6 sprints)

| Sprint | Orchestrateur | Taches | Effort | Apport |
|--------|---------------|--------|--------|--------|
| 8 | C-08-sprint-08-crm-booking.md | 14 | 75h | CRM + Booking + integrations |
| 9 | C-09-sprint-09-comm-wa-email.md | 13 | 75h | WhatsApp + Email + 4 locales |
| 10 | C-10-sprint-10-docs-signature.md | 13 | 75h | Signature loi 43-20 (Barid + ANRT) |
| 11 | C-11-sprint-11-pay-ma-multi.md | 14 | 80h | 6 passerelles MA |
| 12 | C-12-sprint-12-books-compliance.md | 13 | 75h | CGNC + ACAPS + DGI + AMC |
| 13 | C-13-sprint-13-analytics-stock-hr.md | 14 | 75h | ClickHouse + Stock + HR |

### Phase 4 -- Vertical Insure (5 sprints)

| Sprint | Orchestrateur | Taches | Effort | Apport |
|--------|---------------|--------|--------|--------|
| 14 | C-14-sprint-14-insure-foundation.md | 14 | 80h | Skalean Broker Foundation |
| 15 | C-15-sprint-15-insure-lifecycle-police.md | 13 | 75h | Lifecycle police complet |
| 16 | C-16-sprint-16-web-broker-app.md | 14 | 75h | web-broker port 3001 |
| 17 | C-17-sprint-17-web-customer-portal.md | 14 | 80h | Vente en ligne SEO Lighthouse 95+ |
| 18 | C-18-sprint-18-web-assure-portal-mobile.md | 14 | 85h | Espace assure desktop + PWA mobile |

### Phase 5 -- Vertical Repair (7 sprints)

| Sprint | Orchestrateur | Taches | Effort | Apport |
|--------|---------------|--------|--------|--------|
| 19 | C-19-sprint-19-vertical-repair-foundation.md | 13 | 75h | Skalean Garage + Atlas seed |
| 20 | C-20-sprint-20-ia-estimation-photos.md | 12 | 70h | IA Estimation Mock realistic |
| 21 | C-21-sprint-21-sinistre-workflow.md | 13 | 70h | Sinistre Workflow + split facturation |
| 22 | C-22-sprint-22-web-garage-app.md | 13 | 75h | web-garage port 3002 |
| 23 | C-23-sprint-23-web-garage-mobile.md | 12 | 70h | PWA technicien + WebAuthn biometric |
| 24 | C-24-sprint-24-flux-sinistre-client.md | 13 | 75h | Flux M8 end-to-end (premier marche MA) |
| 25 | C-25-sprint-25-cross-tenant-framework.md | 12 | 70h | Cross-tenant 3 types tenants Repair |

### Phase 6 -- Admin Platform (3 sprints)

| Sprint | Orchestrateur | Taches | Effort | Apport |
|--------|---------------|--------|--------|--------|
| 26 | C-26-sprint-26-admin-foundation.md | 12 | 70h | web-insurtech-admin + impersonation |
| 27 | C-27-sprint-27-tenants-management.md | 12 | 70h | Onboarding wizard + billing |
| 28 | C-28-sprint-28-admin-reports-compliance.md | 12 | 70h | Reports 4 regulators MA |

### Phase 7 -- Hardening + Integrations + Pilote (7 sprints)

| Sprint | Orchestrateur | Taches | Effort | Apport |
|--------|---------------|--------|--------|--------|
| 29 | C-29-sprint-29-skalean-ai-rest.md | 12 | 70h | Skalean AI swap Mock -> Real |
| 30 | C-30-sprint-30-skalean-ai-mcp.md | 12 | 75h | MCP server 15+ tools metier |
| 31 | C-31-sprint-31-agent-sky.md | 13 | 75h | Sky agent 4 langues 4 apps |
| 32 | C-32-sprint-32-insure-connecteurs.md | 13 | 80h | 5 connecteurs assureurs reels |
| 33 | C-33-sprint-33-pentest-securite.md | 12 | 75h | Pentest + 0 critical/high |
| 34 | C-34-sprint-34-performance-scaling.md | 12 | 70h | Load 1000+ tenants + chaos |
| 35 | C-35-sprint-35-pilote-marrakech-go-live.md | 14 | 150h | Pilote Marrakech success |

---

## Statistiques globales

- **Total sprints** : 35
- **Total taches** : 461
- **Effort cumul** : ~2 600 heures (~12 mois 2 devs FTE)
- **Volume orchestrateurs** : ~590 ko (35 fichiers)

---

## Workflow execution Cowork

```
1. Saad lance Sprint N
   |
   v
2. Cowork lit C-{N:02d}-sprint-{N:02d}-*.md (orchestrateur)
   |
   v
3. Cowork genere prompts-taches/sprint-{N:02d}-*/task-X.Y.Z-prompt.md a partir de B-{N:02d}
   |
   v
4. Cowork execute taches sequentielles dans ordre orchestrateur :
   - Lit task-X.Y.Z-prompt.md
   - Modifie repo/ (code + tests)
   - Compile (pnpm tsc --noEmit)
   - Tests (pnpm vitest run)
   - Commit Conventional Commits
   - Passe a tache suivante
   |
   v
5. Apres derniere tache : Cowork lance verification V-{N:02d}-sprint-{N:02d}-verification.md
   |
   v
6. Verification produit sprint{N:02d}-verify-report.md
   |
   v
7. Score >= 95% : GO -> commit cloture sprint -> Sprint N+1
   Score 85-94% : GO CONDITIONNEL -> hot fix puis commit cloture -> Sprint N+1
   Score < 85%  : NO-GO -> reprise sprint
```

---

## Regles cross-sprints

### Handoff entre sprints

Chaque sprint produit des outputs consommes par sprints suivants :
- **Sprint 1** : Infrastructure -> tous sprints suivants
- **Sprint 2** : Schema DB -> tous sprints metier
- **Sprint 5-7** : Auth + RLS + RBAC -> tous sprints metier
- **Sprint 14** : Insure Foundation -> Sprint 15-18 + 32 + 35
- **Sprint 19** : Repair Foundation -> Sprint 20-25 + 35
- **Sprint 33** : Pentest -> prerequis Sprint 34-35

Voir `9-roadmap-execution.md` pour graphe complet dependances.

### Failure recovery

Si un sprint echoue verification :
1. Status NO-GO documente dans rapport
2. Identification root cause
3. Reprise sprint avec corrections (max 1 semaine retard tolere)
4. Re-verification + GO -> Sprint suivant
5. Si retard > 1 semaine : escalation Saad/Abla decision (cut scope OR delai)

### Sprints critiques

Sprints qui requirent attention particuliere :
- **Sprint 1** : foundation -- erreurs ici impact tous suivants
- **Sprint 6** : multi-tenant -- 0 leak cross-tenant non-negociable
- **Sprint 24** : flux M8 -- premier marche MA, exposure differentiation
- **Sprint 33** : pentest -- BLOQUE Sprint 35 si critical/high findings
- **Sprint 35** : pilote -- 4 semaines duree (vs 2 sem standard) + suivi post

---

## Prochaines etapes

**Apres generation 35 orchestrateurs** :

1. **Generation 35 verifications V-XX** (~10-15h) -- prochaine etape recommandee
2. **Onboarding Cowork** : preparation Sprint 1 execution
3. **Generation prompts taches individuels** (~470 fichiers task-X.Y.Z) -- Cowork le fait sprint par sprint
4. **Sprint 1 execution** : demarrage programme

---

**Fin du README orchestrateurs C-XX v2.2.**
