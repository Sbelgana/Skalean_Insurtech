# VERIFICATIONS V-XX -- Phase Validation skalean-insurtech v2.2 (DETAILED)

**Version** : 2.2.0 (Option B detaillee)
**Date** : Mai 2026
**Statut** : 35/35 verifications detaillees livrees
**AUCUNE EMOJI AUTORISEE**

---

## Vue d'ensemble

Ce dossier contient les **35 verifications sprint detaillees** qui valident automatiquement chaque sprint apres execution complete par **Claude Code / Cowork**.

Chaque verification extrait les criteres reels de son meta-prompt B-XX correspondant :
- **Criteres P0/P1/P2** par tache (V1, V2, V3...) extraits B-XX
- **Verifications fichiers** (existence + contenu)
- **Verifications transversales** sprint (build / typecheck / tests / lint / no-emoji)
- **Auto-reparation** pour criteres recuperables
- **Generation rapport** `sprint{N}-verify-report.md` markdown structure
- **Calcul score** GO / GO CONDITIONNEL / NO-GO

**Triade complete B/C/V** :
- `B-XX-sprint-XX-*.md` : Specifications detaillees code (~30-40 ko -- code patterns + tests + criteres V1-V10)
- `C-XX-sprint-XX-*.md` : Orchestration sequentielle pour Cowork (~30-40 ko -- ordre taches + commits)
- `V-XX-sprint-XX-*.md` : **Verification automatique (~50 ko -- bash criteres + auto-reparation + rapport)**

---

## Statistiques globales (DETAILED)

| Metric | Valeur |
|---|---|
| Fichiers V-XX livres | 35/35 + README |
| Total criteres taches extraits | **2 727** (V1-VN par tache) |
| Total criteres transversaux | ~350 (10 par sprint moyenne) |
| Volume cumul | **1.7 Mo** |
| Taille moyenne par V-XX | 50 ko |

---

## Structure standard de chaque V-XX

1. **En-tete** : metadata sprint + reference B-XX et C-XX
2. **Regles d'execution** : sequencement obligatoire + auto-reparation
3. **Format du rapport** : conventions IDs (T{NN}-V{N}, TR-{TYPE}) + statuts (PASS/PASS*/FAIL/SKIP/WARN)
4. **Phase de preparation** : initialisation `sprint{N}-verify-report.md` + variables globales + helpers DB
5. **Verifications par tache** ({N} sections) : pour chaque tache : verification fichiers + criteres P0/P1/P2 (extrait du B-XX)
6. **Verifications transversales** (10+ sections) :
   - **TR-BUILD** : build complet monorepo
   - **TR-TYPECHECK** : TypeScript strict 0 erreur
   - **TR-TESTS** : Vitest unitaires PASS
   - **TR-COVERAGE** : couverture >= 85%
   - **TR-LINT** : Biome lint propre
   - **TR-NO-EMOJI** : aucune emoji (decision-006)
   - **TR-CONSOLE** : aucun console.* (Pino obligatoire)
   - **TR-COMMITS** : Conventional Commits
   - **TR-TENANT** : multi-tenant filter present
   - **TR-ZOD** : validation Zod (no class-validator)
7. **Sections conditionnelles** (selon sprint) :
   - **TR-MIGRATIONS** : migrations DB (sprints DB)
   - **TR-ACAPS** : conformite ACAPS audit (sprints metier insure/repair/pay)
   - **TR-KAFKA** : topics Kafka actifs (Sprint 2+)
   - **TR-ATLAS** : Atlas Cloud Services connectivity (Sprint 35)
   - **TR-SKALEAN-AI** : Skalean AI service (Sprints 29-31)
   - **TR-MCP** : MCP server fonctionnel (Sprints 30-31)
   - **TR-LIGHTHOUSE** : Lighthouse scores (sprints frontend)
8. **Generation rapport final** : tableau resultats + score global + statut GO/NO-GO
9. **Instruction finale** : commit cloture sprint + escalation si NO-GO

---

## Conventions IDs criteres

| Pattern | Signification | Exemple |
|---------|---------------|---------|
| `T{NN}-V{N}` | Critere V{N} de Tache {NN} | `T01-V1`, `T15-V3` |
| `T{NN}-F{N}` | Critere fichier de Tache {NN} | `T01-F1`, `T15-F2` |
| `TR-{TYPE}` | Critere transversal sprint | `TR-BUILD`, `TR-NO-EMOJI` |

## Statuts criteres

| Statut | Signification | Impact score |
|--------|---------------|--------------|
| `PASS` | Reussi premier essai | +1 vers GO |
| `PASS*` | Reussi apres reparation auto | +1 vers GO |
| `FAIL` | Echec, reparation impossible | Bloquant si P0 |
| `SKIP` | Ignore (prerequis manquant) | Neutre |
| `WARN` | Partiellement reussi / manuel | Neutre |

## Calcul GO/NO-GO

| Score | Statut | Action |
|-------|--------|--------|
| >= 95% | **GO** | Sprint valide -- demarrer Sprint suivant |
| 85-94% | **GO CONDITIONNEL** | Hot fixes requis dans la semaine -- puis sprint suivant |
| < 85% | **NO-GO** | Reprise sprint -- escalation Saad/Abla decision (cut scope OR delai) |

---

## Navigation par phase

### Phase 1 -- Bootstrap Infrastructure (4 sprints)

| Sprint | Verification | Taches | Criteres taches | Volume |
|--------|--------------|--------|-----------------|--------|
| 1 | V-01-sprint-01-bootstrap.md | 15 | 124 | 66 ko |
| 2 | V-02-sprint-02-database-kafka.md | 15 | 127 | 68 ko |
| 3 | V-03-sprint-03-api-bootstrap.md | 15 | 124 | 67 ko |
| 4 | V-04-sprint-04-frontend-bootstrap.md | 16 | 118 | 61 ko |

### Phase 2 -- Securite (3 sprints)

| Sprint | Verification | Taches | Criteres taches | Volume |
|--------|--------------|--------|-----------------|--------|
| 5 | V-05-sprint-05-auth-foundations.md | 15 | 132 | 65 ko |
| 6 | V-06-sprint-06-multi-tenant.md | 12 | 106 | 58 ko |
| 7 | V-07-sprint-07-rbac.md | 12 | 82 | 51 ko |

### Phase 3 -- Modules Horizontaux (6 sprints)

| Sprint | Verification | Taches | Criteres taches | Volume |
|--------|--------------|--------|-----------------|--------|
| 8 | V-08-sprint-08-crm-booking.md | 14 | 111 | 60 ko |
| 9 | V-09-sprint-09-comm-wa-email.md | 13 | 90 | 55 ko |
| 10 | V-10-sprint-10-docs-signature.md | 13 | 91 | 55 ko |
| 11 | V-11-sprint-11-pay-ma-multi.md | 14 | 75 | 51 ko |
| 12 | V-12-sprint-12-books-compliance.md | 13 | 78 | 52 ko |
| 13 | V-13-sprint-13-analytics-stock-hr.md | 14 | 80 | 51 ko |

### Phase 4 -- Vertical Insure (5 sprints)

| Sprint | Verification | Taches | Criteres taches | Volume |
|--------|--------------|--------|-----------------|--------|
| 14 | V-14-sprint-14-insure-foundation.md | 14 | 66 | 49 ko |
| 15 | V-15-sprint-15-insure-lifecycle-police.md | 13 | 67 | 48 ko |
| 16 | V-16-sprint-16-web-broker-app.md | 14 | 83 | 52 ko |
| 17 | V-17-sprint-17-web-customer-portal.md | 14 | 72 | 48 ko |
| 18 | V-18-sprint-18-web-assure-portal-mobile.md | 14 | 70 | 48 ko |

### Phase 5 -- Vertical Repair (7 sprints)

| Sprint | Verification | Taches | Criteres taches | Volume |
|--------|--------------|--------|-----------------|--------|
| 19 | V-19-sprint-19-vertical-repair-foundation.md | 13 | 62 | 45 ko |
| 20 | V-20-sprint-20-ia-estimation-photos.md | 12 | 53 | 40 ko |
| 21 | V-21-sprint-21-sinistre-workflow.md | 13 | 64 | 47 ko |
| 22 | V-22-sprint-22-web-garage-app.md | 13 | 61 | 44 ko |
| 23 | V-23-sprint-23-web-garage-mobile.md | 12 | 63 | 43 ko |
| 24 | V-24-sprint-24-flux-sinistre-client.md | 13 | 58 | 43 ko |
| 25 | V-25-sprint-25-cross-tenant-framework.md | 12 | 46 | 39 ko |

### Phase 6 -- Admin Platform (3 sprints)

| Sprint | Verification | Taches | Criteres taches | Volume |
|--------|--------------|--------|-----------------|--------|
| 26 | V-26-sprint-26-admin-foundation.md | 12 | 59 | 43 ko |
| 27 | V-27-sprint-27-tenants-management.md | 12 | 52 | 40 ko |
| 28 | V-28-sprint-28-admin-reports-compliance.md | 12 | 55 | 42 ko |

### Phase 7 -- Hardening + Integrations + Pilote (7 sprints)

| Sprint | Verification | Taches | Criteres taches | Volume |
|--------|--------------|--------|-----------------|--------|
| 29 | V-29-sprint-29-skalean-ai-rest.md | 12 | 51 | 41 ko |
| 30 | V-30-sprint-30-skalean-ai-mcp.md | 12 | 45 | 38 ko |
| 31 | V-31-sprint-31-agent-sky.md | 13 | 57 | 44 ko |
| 32 | V-32-sprint-32-insure-connecteurs.md | 13 | 48 | 43 ko |
| 33 | V-33-sprint-33-pentest-securite.md | 12 | 52 | 39 ko |
| 34 | V-34-sprint-34-performance-scaling.md | 12 | 55 | 41 ko |
| 35 | V-35-sprint-35-pilote-marrakech-go-live.md | 14 | 51 | 43 ko |

---

## Workflow execution Cowork

```
Sprint N : execution toutes taches via C-{N}
    |
    v
Cowork lit V-{N}-sprint-{N}-*.md (verification)
    |
    v
Cowork execute Phase de preparation :
    - Initialise sprint{N}-verify-report.md
    - Variables PASS/FAIL/SKIP/WARN/PASS_REPAIRED = 0
    - Helpers DB pg_query()
    |
    v
Cowork execute verifications par tache :
    - Pour chaque tache : verifier fichiers crees
    - Pour chaque critere V1-VN : verification + auto-reparation
    - Statut PASS / PASS* / FAIL / SKIP / WARN
    |
    v
Cowork execute verifications transversales :
    - TR-BUILD / TR-TYPECHECK / TR-TESTS / TR-COVERAGE
    - TR-LINT / TR-NO-EMOJI / TR-CONSOLE / TR-COMMITS
    - TR-TENANT / TR-ZOD
    - + sections conditionnelles (TR-MIGRATIONS / TR-ACAPS / TR-KAFKA / TR-MCP / TR-AI / TR-ATLAS / TR-LIGHTHOUSE)
    |
    v
Generation rapport final :
    - Tableau resultats complet (T{NN}-V{N} + TR-{TYPE})
    - Score global PASS%
    - Statut GO / GO CONDITIONNEL / NO-GO
    |
    v
Score >= 95% : GO -> commit cloture sprint -> Sprint N+1
Score 85-94% : GO CONDITIONNEL -> hot fix puis cloture
Score < 85%  : NO-GO -> reprise sprint
```

---

## Notes implementation Cowork

### Auto-reparation

Le pattern auto-reparation tente une correction automatique avant FAIL :

```bash
# Test : fichier doit exister
if [ -f "repo/path/file.ts" ]; then
  add_row "T01-F1" "Fichier existe" "PASS" "Cree"
else
  echo "[REPAIR] Fichier manquant, tentative creation depuis template..."
  # Logique de reparation (sed, generation, ...)
  if [ -f "repo/path/file.ts" ]; then
    add_row "T01-F1" "Fichier existe" "PASS*" "Cree apres reparation"
  else
    add_row "T01-F1" "Fichier existe" "FAIL" "Reparation impossible"
  fi
fi
```

### Criteres extraits du B-XX

Pour chaque critere V1-VN du B-XX, la verification genere un check **WARN par defaut** avec reference vers B-XX pour test detaille. **Cowork doit interpreter** et automatiser ces tests selon le contexte :
- Critere automatisable (e.g. `pnpm typecheck reussit`) -> commande automatique PASS/FAIL
- Critere business (e.g. `30 scenarios E2E couvrent flux insure complet`) -> WARN manuel

### Sections conditionnelles activation

| Section | Sprints actives |
|---------|-----------------|
| TR-MIGRATIONS | 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 20, 21, 23, 24, 25, 26, 27, 28, 30, 31, 32 |
| TR-ACAPS | 12, 14, 15, 21, 24, 28 |
| TR-KAFKA | 2+ |
| TR-ATLAS | 35 |
| TR-SKALEAN-AI | 29, 30, 31 |
| TR-MCP | 30, 31 |
| TR-LIGHTHOUSE | 16, 17, 18, 22, 23, 26 |

---

## Programme complet skalean-insurtech-plan v2.2

```
Skalean_Insurtech/                    # 5.9 Mo total
├── INDEX.md + README.md                   # 29 ko -- navigation v2.2
├── audits/                                # 39 ko
├── _archive-v2.0/                         # 66 ko (3 plans deprecies)
├── decisions/                             # 40 ko (10 decisions formalisees)
├── documentation/                         # 312 ko (13 fichiers reference v2.2)
└── meta-prompts/
    ├── meta-prompts/                       # 1.4 Mo (35 sprints Option B)
    ├── orchestrateurs/                     # 1.2 Mo (35 orchestrateurs DETAILLES)
    └── verifications/                      # 1.7 Mo (35 verifications DETAILLES)
```

---

## Triade B/C/V complete -- exemple Sprint 1

| Phase | Fichier | Volume | Role |
|-------|---------|--------|------|
| **B** | B-01-sprint-01-bootstrap.md | 60 ko | Specs detaillees Sprint 1 (15 taches + code + tests) |
| **C** | C-01-sprint-01-bootstrap.md | 41 ko | Orchestration sequentielle 15 taches pour Cowork |
| **V** | V-01-sprint-01-bootstrap.md | 66 ko | Verification automatique (124 criteres + 10 transversaux) |

Total Sprint 1 : **167 ko** de specifications + orchestration + verification.

---

## Prochaines etapes

**Apres generation 35 verifications V-XX detaillees**, programme complet livre :

1. **Sprint 1 execution** : demarrage immediate avec triade B-01 / C-01 / V-01
2. **Onboarding Cowork** : preparer instructions Cowork lecture orchestrateur + execution + verification
3. **Package final livraison** : ZIP complet Skalean_Insurtech/ pour handoff equipe
4. **Pilote Marrakech** : objectif 4 mois apres demarrage Sprint 1

---

**Fin du README verifications V-XX v2.2 detaillee.**
