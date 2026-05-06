# Meta-prompts B-XX -- skalean-insurtech v2.2

**Version** : 2.2.0 (Option B detaillee)
**Date** : Mai 2026
**Statut** : 35/35 sprints livres
**AUCUNE EMOJI AUTORISEE**

---

## Vue d'ensemble

Ce dossier contient les **35 meta-prompts B-XX** -- specifications detaillees de chaque sprint pour Cowork.

Chaque meta-prompt B-XX contient :
- Metadonnees sprint (Phase / Sprint / Effort / Priorite / Numerotation)
- Objectif global du sprint
- Frontiere du sprint (INCLUS / EXCLU)
- Lectures prealables obligatoires
- Dependencies Sprint precedents (explicites)
- Stack imposee (versions exactes)
- Vue d'ensemble des N taches
- **Pour chaque tache** :
  - Metadonnees (Phase / Sprint / Priorite / Effort / Dependences)
  - But (1 sentence)
  - Contexte (multi-line)
  - Livrables checkables (5-12 par tache)
  - Fichiers crees / modifies
  - Notes implementation
  - Criteres validation V1-V10 (P0/P1/P2)

---

## Navigation par phase

### Phase 1 -- Bootstrap Infrastructure (4 sprints)
- B-01-sprint-01-bootstrap.md (60 ko / 15 taches)
- B-02-sprint-02-database-kafka.md
- B-03-sprint-03-api-bootstrap.md
- B-04-sprint-04-frontend-bootstrap.md

### Phase 2 -- Securite (3 sprints)
- B-05-sprint-05-auth-foundations.md
- B-06-sprint-06-multi-tenant.md
- B-07-sprint-07-rbac.md

### Phase 3 -- Modules Horizontaux (6 sprints)
- B-08-sprint-08-crm-booking.md
- B-09-sprint-09-comm-wa-email.md
- B-10-sprint-10-docs-signature.md
- B-11-sprint-11-pay-ma-multi.md
- B-12-sprint-12-books-compliance.md
- B-13-sprint-13-analytics-stock-hr.md

### Phase 4 -- Vertical Insure (5 sprints)
- B-14-sprint-14-insure-foundation.md
- B-15-sprint-15-insure-lifecycle-police.md
- B-16-sprint-16-web-broker-app.md
- B-17-sprint-17-web-customer-portal.md
- B-18-sprint-18-web-assure-portal-mobile.md

### Phase 5 -- Vertical Repair (7 sprints)
- B-19-sprint-19-vertical-repair-foundation.md
- B-20-sprint-20-ia-estimation-photos.md
- B-21-sprint-21-sinistre-workflow.md
- B-22-sprint-22-web-garage-app.md
- B-23-sprint-23-web-garage-mobile.md
- B-24-sprint-24-flux-sinistre-client.md (Flux M8 end-to-end)
- B-25-sprint-25-cross-tenant-framework.md

### Phase 6 -- Admin Platform (3 sprints)
- B-26-sprint-26-admin-foundation.md
- B-27-sprint-27-tenants-management.md
- B-28-sprint-28-admin-reports-compliance.md

### Phase 7 -- Hardening + Integrations + Pilote (7 sprints)
- B-29-sprint-29-skalean-ai-rest.md
- B-30-sprint-30-skalean-ai-mcp.md
- B-31-sprint-31-agent-sky.md
- B-32-sprint-32-insure-connecteurs.md
- B-33-sprint-33-pentest-securite.md
- B-34-sprint-34-performance-scaling.md
- B-35-sprint-35-pilote-marrakech-go-live.md

---

## Comment utiliser un meta-prompt

```bash
# 1. Lire le meta-prompt sprint
cat 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md

# 2. Cowork genere prompts taches X.Y.Z dans prompts-taches/sprint-01-*/

# 3. Cowork execute taches sequentielles selon orchestrateur C-01
cat 00-pilotage/orchestrateurs/C-01-sprint-01-bootstrap.md

# 4. Apres taches : verification automatique via V-01
cat 00-pilotage/verifications/V-01-sprint-01-bootstrap.md
```

---

## Triade B/C/V

Pour chaque sprint :
- **B-XX** (ce dossier) : specifications detaillees
- **C-XX** (../orchestrateurs/) : orchestration sequentielle Cowork
- **V-XX** (../verifications/) : verification automatique post-execution

---

**Total** : 35 meta-prompts / 1.4 Mo / 462 taches detaillees.
