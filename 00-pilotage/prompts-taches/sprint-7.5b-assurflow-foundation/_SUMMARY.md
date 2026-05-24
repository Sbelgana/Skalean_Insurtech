# Sprint 7.5b -- Assurflow v3.0 Foundation (Specifications Experts + PartsHub + Tow + Carrier) -- SUMMARY

**Phase** : 2 -- Securite (extensions Sprint 7 RBAC) ; sprint inter-phases
**Sprint** : 7.5b / 40 (cumul v3.0) -- Sprint Migration #2
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-7.5b-sprint-7.5b-specifications.md`
**Numerotation taches** : 2.5.1 a 2.5.9 (9 taches retenues apres epuration)
**Effort total** : ~9 heures developpement
**Generation** : Phase A (Cowork Generation Agent v2) -- prompts taches denses auto-suffisants
**AUCUNE EMOJI (decision-006 ABSOLUE)**

---

## Decision de cadrage (resolution de conflit 7.5a vs 7.5b)

Un conflit a ete detecte entre B-7.5b et le Sprint 7.5a deja livre (et le code reel). Decision retenue : **OPTION A -- Sprint 7.5a fait foi**. Le B-7.5b a ete **epure de 10 a 9 taches** :

- **SUPPRIMEE** -- l'ancienne tache "Cross-tenant 3->7 types" : deja livree par 7.5a avec le set autoritaire `broker_to_garage_assignment, assure_to_garage_visit, multi_tenant_user_access, client_to_tower_dispatch, tower_to_garage_delivery, garage_to_expert_request, garage_to_carrier_quote`. Taches suivantes renumerotees.
- **REVISEE** -- Permissions (2.5.3) : ne reprend PAS 85->130 (deja fait par 7.5a). Ajoute UNIQUEMENT le module `customer` (17 perms, decision-012 acteur 5). Total final = **147 permissions, 25 modules**.
- **REVISEE** -- insure_experts (2.5.4) : table catalog, COMPLEMENT de `expert_designations` (7.5a), pas remplacement.
- **REVISEE** -- insure_expert_assignments (2.5.5) : `ALTER TABLE expert_designations RENAME TO insure_expert_assignments` + `ALTER ADD` colonnes v3.0 ; data + RLS + FORCE preserves.
- **CONSERVEES** -- 2.5.1, 2.5.2, 2.5.6, 2.5.7, 2.5.8, 2.5.9 (aucun chevauchement).

### Alignement code reel strict (applique dans tous les prompts)
- `export const Permission = { CUSTOMER_X: 'customer.x', ... } as const` (JAMAIS `export enum Permission`).
- FK : `REFERENCES auth_tenants(id)` + `REFERENCES auth_users(id)` (jamais `tenants`/`users` nus).
- Trigger updated_at : `EXECUTE FUNCTION set_updated_at_column()` (fonction Sprint 1 existante, jamais recreee).
- Migrations TypeORM : format `1735000000NNN-Name.ts`. 7.5a = 011 + 012 ; 7.5b = **013** (insure_experts), **014** (rename assignments), **015** (insure_expert_reports).
- Role applicatif : `GRANT ... TO insurtech_app`.
- RLS + FORCE ROW LEVEL SECURITY sur insure_experts + insure_expert_assignments + insure_expert_reports.
- Conventional commits : `Task: 2.5.X` / `Sprint: 7.5b` / `Phase: 2`.

---

## Ordre d'execution des 9 taches (sequentiel strict)

| Ordre | Fichier task | Titre | Effort | Depend de | Densite |
|-------|--------------|-------|--------|-----------|---------|
| 1 | `task-2.5.1-package-expertise-structure-types.md` | Package @insurtech/expertise (structure + types + Zod + entites squelettes) | 1h | Sprint 7.5a | ~84 ko |
| 2 | `task-2.5.2-package-tow-structure-types.md` | Package @insurtech/tow (structure + types + Zod + entites squelettes) | 1h | 2.5.1 | ~92 ko |
| 3 | `task-2.5.3-permissions-customer-module-147.md` | Permissions +17 module customer (130 -> 147) | 1h | 2.5.2 | ~95 ko |
| 4 | `task-2.5.4-foundation-entity-insure-experts.md` | Entite foundation insure_experts (catalog) + RLS | 1h | 2.5.3 | ~114 ko |
| 5 | `task-2.5.5-rename-expert-designations-to-assignments.md` | RENAME expert_designations -> insure_expert_assignments + ALTER ADD v3.0 | 1h | 2.5.4 | ~97 ko |
| 6 | `task-2.5.6-foundation-entity-insure-expert-reports.md` | Entite foundation insure_expert_reports + doc extension 22.7 | 1h | 2.5.5 | ~89 ko |
| 7 | `task-2.5.7-services-squelettes-expertise.md` | Services squelettes @insurtech/expertise (NotImplementedException Sprint 14/22.7) | 1h | 2.5.6 | ~82 ko |
| 8 | `task-2.5.8-services-squelettes-tow.md` | Services squelettes @insurtech/tow (NotImplementedException Sprint 22.5) | 1h | 2.5.7 | ~87 ko |
| 9 | `task-2.5.9-documentation-extension-paths-integration.md` | Docs extension paths (4) + tests integration cross-package | 2h | 2.5.8 | ~100 ko |

**Total effort** : ~9 heures.

---

## Sorties produites par le sprint (consommees downstream)

- `@insurtech/expertise` : package (4 types + 3 schemas Zod + 3 entites squelettes + 4 services squelettes). Plein Sprint 14 + 22.7.
- `@insurtech/tow` : package (3 types + 2 schemas + 2 entites + 3 services squelettes). Plein Sprint 22.5.
- **Permissions 147** (130 de 7.5a + 17 customer), 25 modules, role `assure` dote des 17 perms customer.
- **3 entites foundation** : `insure_experts` (catalog), `insure_expert_assignments` (renommee depuis `expert_designations`), `insure_expert_reports`. RLS + FORCE sur les trois.
- **4 docs architecture** : `expertise-extension-path.md`, `tow-extension-path.md`, `cross-tenant-7-types-architecture.md`, `permissions-147-catalog.md`.
- **Tests integration** cross-package (>= 12 scenarios).

Sprints consommateurs : 14 (expertise full + 3 entites), 21 (expertise + PartsHub perms), 22.5 (tow full), 22.7 (expertise app full), 24 (tous packages + tous types), 26.5 (carrier + remplacement mocks).

---

## Statistiques de generation (Phase A)

| Metrique | Valeur |
|----------|--------|
| Taches generees | 9 / 9 |
| Lignes totales | ~16 500 lignes |
| Densite moyenne | ~93 ko / task |
| Densite minimum | ~82 ko (2.5.7) -- conforme >= 80 ko |
| Densite maximum | ~114 ko (2.5.4) -- conforme <= 150 ko |
| Volume total sprint | ~840 ko |
| Blocs code complets | >= 8 par task |
| Cas de tests / scenarios | ~300 cumules (unit Vitest + integration RLS + skeleton NotImplementedException + cross-package) |
| Criteres de validation | ~290 cumules (V1-Vn par task, P0/P1/P2) |
| Edge cases documentes | >= 8 par task |
| Emoji | 0 (decision-006 ABSOLUE) |
| Placeholders TODO/FIXME | 0 (les NotImplementedException sont des squelettes contractuels intentionnels) |

Note sur la mesure : la session de generation presentait un decalage de synchronisation du mount Linux (bash) vis-a-vis du systeme de fichiers Windows ; pour les fichiers reetoffes par editions, `wc -c` sous-estime la taille. Les valeurs ci-dessus sont derivees du nombre de lignes (source autoritaire via l'outil de lecture). Pour un controle exact, relancer `wc -c *.md` dans une session fraiche.

---

## Metriques de validation (rappel B-7.5b, ajustees Option A)

| Metrique | Cible | Mesure |
|----------|-------|--------|
| 9 commits Sprint 7.5b | 9/9 | git log Task: 2.5.* |
| Permissions enum count | 147 (NON 130) | `ALL_PERMISSIONS.length` |
| Modules | 25 | `ALL_MODULES.length` |
| Cross-tenant types | 7 (set 7.5a autoritaire) | CHECK constraint deja pose par 7.5a |
| RLS + FORCE 3 tables | 3/3 | insure_experts + insure_expert_assignments + insure_expert_reports |
| Tests integration | >= 12 | Vitest run |
| 0 emoji | 0 | grep recursif |
| Documentation extension | 4 docs | architecture/*.md |
| TypeScript strict | 0 errors | pnpm tsc --noEmit |
| Style Permission | const as const | jamais enum |

---

## Suite apres Sprint 7.5b

1. Sprint 8 (CRM + Booking) -- reprise du flux normal des phases.
2. Les squelettes (@insurtech/expertise, @insurtech/tow) et les 3 entites foundation sont remplis par : Sprint 14 (expertise full + entites), 22.5 (tow full), 22.7 (expert app), 24 (cross-tenant runtime), 26.5 (carrier).
3. Tag de cloture : `sprint-7.5b-complete-v3-foundation` (cf tache 2.5.9 section 16).

---

**Fin du _SUMMARY.md Sprint 7.5b Assurflow v3.0 Foundation. 9 taches generees. AUCUNE EMOJI (decision-006).**
