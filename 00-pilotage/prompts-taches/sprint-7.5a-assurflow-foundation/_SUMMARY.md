# Sprint 7.5a -- Assurflow v3.0 Foundation (Migration Critique) -- SUMMARY

**Phase** : 2.5 -- Migration Assurflow (intercalee entre Phase 2 Securite et Phase 3 Horizontaux)
**Sprint** : 7.5a / 40 (cumul v3.0) -- Sprint Migration #1
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-7.5a-sprint-7.5a-assurflow-foundation.md`
**Priorite** : P0 BLOQUANT (avant reprise Sprint 7 tache 2.3.2 PermissionsMatrix)
**Effort total** : ~25 heures developpement / 2-3 jours intensifs
**Generation** : Phase A (Cowork Generation Agent v2) -- prompts taches denses auto-suffisants
**AUCUNE EMOJI (decision-006 ABSOLUE)**

---

## Objectif du sprint

Mettre en place les fondations techniques de la migration Assurflow v3.0 AVANT de continuer Sprint 7 RBAC tache 2.3.2. Construire la PermissionsMatrix sur 12 roles puis refactorer sur 26 roles couterait 15-20h de retravail cascade ; ce sprint fige donc l'architecture 26 roles + 7 types cross-tenant + 130 permissions au prealable.

A la sortie : 5 decisions strategiques 011-015 formalisees, AuthRole enum 12 -> 26 roles, CrossTenantAuthorizationType 3 -> 7 types, migration DB (CHECK + table expert_designations), helper postgres `app_can_access_tenant()` etendu, catalog permissions 90 -> 130, documentation `5-roles-permissions.md` v3.0, suite de tests RBAC + RLS sans regression, commit + tag `sprint-7.5a-complete-v3-foundation`, et cross-references pilotage.

---

## Ordre d'execution des 10 taches (sequentiel strict)

Ne JAMAIS demarrer la tache N+1 avant que la tache N soit PASS sur ses criteres P0.

| Ordre | Fichier task | Titre | Effort | Depend de | Densite |
|-------|--------------|-------|--------|-----------|---------|
| 1 | `task-7.5a.1-decisions-strategiques-011-015.md` | Decisions strategiques 011-015 formalisees | 3h | Sprint 7 task 2.3.1 | ~90 ko |
| 2 | `task-7.5a.2-authrole-enum-extension-26-roles.md` | AuthRole enum extension +14 roles (12 -> 26) | 3h | 7.5a.1 | ~87 ko |
| 3 | `task-7.5a.3-crosstenant-authorization-type-extension.md` | CrossTenantAuthorizationType extension +4 types (3 -> 7) | 2h | 7.5a.2 | ~87 ko |
| 4 | `task-7.5a.4-migration-crosstenant-check-expert-designations.md` | Migration DB : CHECK 7 types + table expert_designations | 3h | 7.5a.3 | ~101 ko |
| 5 | `task-7.5a.5-app-can-access-tenant-helper-update.md` | Helper postgres app_can_access_tenant() etendu | 2h | 7.5a.4 | ~89 ko |
| 6 | `task-7.5a.6-permissions-catalog-extension-130.md` | Catalog permissions extension 90 -> 130 | 4h | 7.5a.5 | ~94 ko |
| 7 | `task-7.5a.7-documentation-5-roles-permissions-v3.md` | Documentation 5-roles-permissions.md v3.0 (26 x 130) | 3h | 7.5a.6 | ~97 ko |
| 8 | `task-7.5a.8-tests-rbac-rls-no-regression.md` | Tests RBAC + RLS additionnels (0 regression 1071+) | 3h | 7.5a.7 | ~98 ko |
| 9 | `task-7.5a.9-commit-tag-sprint-7-5a-foundation.md` | Commit + tag sprint-7.5a-complete-v3-foundation | 1h | 7.5a.8 | ~95 ko |
| 10 | `task-7.5a.10-documentation-cross-reference-v3.md` | Cross-reference INDEX/README/CLAUDE.md notes v3.0 | 1h | 7.5a.9 | ~94 ko |

**Total effort** : 25 heures.

---

## Architecture v3.0 figee par ce sprint

### Les 6 acteurs ecosystem (decision-012)

Acteurs historiques v2.2 (3) : Broker (cabinet courtage), Garage (reparation auto), Assure (client final).
Acteurs nouveaux v3.0 (3) : Carrier (compagnie d'assurance), Expert (expert auto agree ACAPS), Tow (remorqueur). Plus PartsHub comme module integre a la verticale Garage (decision-014).

### AuthRole : 12 -> 26 roles (tache 7.5a.2)

- Platform (2) : super_admin_platform, analyst_support
- Broker (3) : broker_admin, broker_user, broker_assistant
- Garage (6) : garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial, garage_parts_manager (NOUVEAU)
- Carrier (6 NOUVEAUX) : carrier_admin, carrier_claims_manager, carrier_finance, carrier_compliance, carrier_expert_manager, carrier_partner_manager
- Expert (4 NOUVEAUX) : expert_independent, expert_firm_admin, expert_associate, expert_carrier_internal
- Tow (3 NOUVEAUX) : tow_admin, tow_driver, tow_dispatcher
- Assure (1) : assure
- Public (1) : prospect

### CrossTenantAuthorizationType : 3 -> 7 types (taches 7.5a.3 / 7.5a.4 / 7.5a.5)

Historiques (3) : broker_to_garage_assignment, assure_to_garage_visit, multi_tenant_user_access.
Nouveaux (4) : client_to_tower_dispatch, tower_to_garage_delivery, garage_to_expert_request, garage_to_carrier_quote.
Resource types : 5 -> 8 (+ mission, expertise, parts_order).

### Permissions : 90 -> 130 (tache 7.5a.6)

4 nouveaux modules : carrier (15), expertise (10), tow (8), parts (7). Modules au total : 20 -> 24.

### DB (taches 7.5a.4 / 7.5a.5)

Migrations TypeORM `1735000000011-Sprint75aCrossTenantV3` (CHECK 7 types + resource_type 8 + table expert_designations avec RLS) et `1735000000012-Sprint75aRlsHelperUpdate` (CREATE OR REPLACE FUNCTION app_can_access_tenant pour 7 types). Trigger updated_at reutilise `set_updated_at_column()`. Roles applicatifs : insurtech_app / insurtech_admin / insurtech_ro.

---

## Decisions strategiques formalisees (tache 7.5a.1)

| # | Decision | Impact |
|---|----------|--------|
| 011 | Rebranding : Skalean = editeur / Assurflow = produit InsurTech | Naming programme |
| 012 | Ecosysteme a 6 acteurs (vs 3) | 26 roles, 7 types, 130 perms |
| 013 | Expert acteur central designe par le carrier | Table expert_designations, module expertise |
| 014 | PartsHub module Phase 1 integre Garage | Role garage_parts_manager, module parts |
| 015 | Demo Day 30 juin 2026 scope complet | Jalonnement sprints |

---

## Statistiques de generation (Phase A)

| Metrique | Valeur |
|----------|--------|
| Taches generees | 10 / 10 |
| Lignes totales | ~16 210 lignes |
| Densite moyenne | ~93 ko / task |
| Densite minimum | ~87 ko (7.5a.2, 7.5a.3) -- conforme >= 80 ko |
| Densite maximum | ~101 ko (7.5a.4) -- conforme <= 150 ko |
| Volume total sprint | ~932 ko |
| Blocs code complets | >= 8 par task (entites, migrations, specs, scripts) |
| Cas de tests / scenarios | ~350 cumules (unit Vitest + integration RLS + assertions bash) |
| Criteres de validation | ~317 cumules (V1-Vn par task, P0/P1/P2) |
| Edge cases documentes | >= 10 par task |
| Emoji | 0 (decision-006 ABSOLUE) |
| Placeholders TODO/FIXME | 0 |

Note sur la mesure : la session de generation presentait un decalage de synchronisation du mount Linux (bash) vis-a-vis du systeme de fichiers Windows. Les tailles ci-dessus sont derivees du nombre de lignes (source autoritaire via l'outil de lecture) et de la densite mesuree exacte sur les fichiers lisibles directement (7.5a.1 = 90,5 ko, 7.5a.2 = 86,7 ko, 7.5a.8 = 98,0 ko). Pour un controle exact, relancer `wc -c *.md` dans une session fraiche.

---

## Jalon GO / NO-GO (rappel B-7.5a)

GO (peut reprendre Sprint 7 tache 2.3.2) si TOUS PASS :
1. AuthRole enum = 26 valeurs
2. CrossTenantAuthorizationType = 7 valeurs
3. Catalog permissions = 130
4. Migration DB executee + reversible
5. Helper app_can_access_tenant accepte 7 types
6. 1071+ tests existants PASS sans regression
7. Tests nouveaux scenarios PASS (50+ RLS + RBAC guards)
8. 5 decisions 011-015 formalisees
9. Tag `sprint-7.5a-complete-v3-foundation` pose
10. Documentation INDEX/README/CLAUDE.md mise a jour

NO-GO si : regressions > 5, migration irreversible (down() fail), enum casse la compatibilite TypeScript, helper postgres casse les RLS existantes. Action : revert commit 7.5a, reviser, re-tenter.

---

## Suite apres Sprint 7.5a

1. Reprise Sprint 7 tache 2.3.2 (PermissionsMatrix) sur architecture 26 roles propre.
2. Sprint 7.5b (apres Sprint 7 complet) : refactor naming massif (~12696 references), migration domains, specifications nouveaux sprints (Tow / Expert / Carrier Portal / Sky AI pre-training), refontes meta-prompts B-14/17/18/21/24/25/32/09.

---

**Fin du _SUMMARY.md Sprint 7.5a Assurflow v3.0 Foundation. 10 taches generees. AUCUNE EMOJI (decision-006).**
