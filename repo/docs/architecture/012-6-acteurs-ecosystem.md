# Decision 012 -- 6 Acteurs Ecosystem Assurflow (vs 3 v2.2)

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-012-6-acteurs-ecosystem.md`

---

## Contexte

L'architecture v2.2 du programme Skalean InsurTech etait centree sur **3 acteurs** :
- Broker (Skalean Broker ERP)
- Garage (Skalean Garage ERP)
- Customer / Assure (web apps)

Les autres acteurs de la chaine de valeur assurance auto MA etaient :
- **Carriers** : reduits a "connecteurs API differes Sprint 32" sans app dediee
- **Experts** : juste mentionnes comme role HR interne garage (technicien expert)
- **Remorqueurs (Tow)** : completement absents du programme

Analyse strategique v2.0 (22-23 mai 2026) a mis en evidence que :

1. **Couverture incomplete = pitch decousu** : pitcher "plateforme InsurTech complete" avec 3 acteurs sur 6 est incoherent. Les carriers refusent partenariat car pas de portail dedie a eux.

2. **Differentiation perdue vs Courtizen** : Courtizen couvre 3 acteurs (carriers, intermediaires, customers) avec API connecteurs. Si Assurflow couvre aussi 3 acteurs sans differentiation app remorqueur ni expert, **combat marketing perdu**.

3. **App Remorqueur Uber-style = differentiation absolue marche MA** : aucun concurrent local n'a app Remorqueur dediee. C'est un blue ocean marche.

4. **Expert designe par carrier = realite terrain Maroc** : workflow sinistre auto au MA passe systematiquement par expert agree ACAPS designe par le carrier. L'absence de l'expert = workflow faux + pitch incoherent.

5. **PartsHub integre Garage = revenue stream additionnel** : commission 3-5% sur transactions pieces fournisseurs = 600k-2M MAD/mois si 100 garages adopte.

Solutions etudiees :
- (A) Garder 3 acteurs v2.2
- (B) Ajouter 3 acteurs manquants (Carrier Portal + Expert + Tow)
- (C) Ajouter 6 acteurs et reconnaitre PartsHub comme module integre

## Probleme adresse

Comment etendre l'architecture du programme pour :
- Couvrir l'ecosysteme complet assurance auto MA (vs partiel v2.2)
- Etablir differentiation defensive face a Courtizen
- Corriger workflow sinistre realiste avec expert central
- Servir les carriers comme acteur de plein droit (vs juste consommateur API)
- Capitaliser sur App Remorqueur Uber-style unique au Maroc
- Capitaliser sur historique reel garage Saad (Sky AI training)

## Decision

**Adoption Option B+C combinees : 6 acteurs ecosystem + PartsHub module integre**.

### Liste des 6 acteurs

| # | Acteur | App Assurflow | Roles utilisateurs |
|---|--------|---------------|---------------------|
| 1 | **Carrier (Assurance)** | Assurflow Carrier Portal (NOUVEAU) | 6 roles : admin, claims_manager, finance, compliance, expert_manager, partner_manager |
| 2 | **Broker (Courtier)** | Assurflow Broker | 3 roles : admin, user, assistant |
| 3 | **Garage (Garagiste)** | Assurflow Garage + PartsHub integre | 6 roles : admin, chef, technicien, comptable, commercial, parts_manager (NOUVEAU) |
| 4 | **Client (Customer + Assure)** | Customer Portal + Assure Portal + Mobile PWA | 2 roles : assure, prospect |
| 5 | **Remorqueur (Tow)** | Assurflow Tow Mobile PWA (NOUVEAU) | 3 roles : admin, driver, dispatcher |
| 6 | **Expert (Claims Expert)** | Assurflow Expert desktop + mobile PWA (NOUVEAU) | 4 roles : independent, firm_admin, associate, carrier_internal |

**Plus** : 2 roles platform conserves (super_admin_platform + analyst_support)

**Total : 24 roles utilisateurs** (vs 12 v2.2).

### Cross-tenant authorizations (7 types vs 3 v2.2)

| Type | Description | Sprint introduction |
|------|-------------|---------------------|
| broker_to_garage_assignment | Broker assigne sinistre a garage | Sprint 6 (existant) |
| assure_to_garage_visit | Assure visite garage (selection M8) | Sprint 6 (existant) |
| multi_tenant_user_access | super_admin platform-level | Sprint 6 (existant) |
| **client_to_tower_dispatch** | **Client commande remorqueur via app (NOUVEAU)** | Sprint 7.5a |
| **tower_to_garage_delivery** | **Remorqueur livre vehicule au garage (NOUVEAU)** | Sprint 7.5a |
| **garage_to_expert_request** | **Garage communique avec expert designe (NOUVEAU)** | Sprint 7.5a |
| **garage_to_carrier_quote** | **Garage envoie info au carrier en CC (NOUVEAU)** | Sprint 7.5a |

### Apps web Assurflow (12 vs 9 v2.2)

| App | Port | Statut |
|-----|------|--------|
| api | 4000 | Existant |
| web-insurtech-admin | 3000 | Existant (renommer Assurflow Admin) |
| web-broker | 3001 | Existant (renommer Assurflow Broker) |
| web-garage | 3002 | Existant (renommer Assurflow Garage) |
| web-garage-mobile | 3003 | Existant (renommer Assurflow Garage Mobile) |
| web-customer-portal | 3004 | Existant (renommer Assurflow Customer) |
| web-assure-portal | 3005 | Existant (renommer Assurflow Assure) |
| web-assure-mobile | 3006 | Existant (renommer Assurflow Assure Mobile) |
| **web-tow-mobile** | **3007** | **NOUVEAU (Sprint 22.5)** |
| **web-carrier-portal** | **3008** | **NOUVEAU (Sprint 26.5)** |
| **web-expert** | **3009** | **NOUVEAU (Sprint 22.7)** |
| **web-expert-mobile** | **3010** | **NOUVEAU (Sprint 22.7)** |
| mcp-server | 4001 | Existant |

### Entites DB additionnelles (16 nouvelles)

| Entite | Sprint introduction |
|--------|---------------------|
| **insure_experts** | Sprint 14 (etendu) |
| **insure_expert_assignments** | Sprint 14 (etendu) |
| **insure_expert_reports** | Sprint 14 (etendu) |
| **insure_expert_signatures** | Sprint 22.7 Expert App |
| **tow_drivers** | Sprint 22.5 Tow App |
| **tow_missions** | Sprint 22.5 Tow App |
| **tow_vehicle_proofs** | Sprint 22.5 Tow App |
| **tow_ratings** | Sprint 22.5 Tow App |
| **carrier_dashboards_config** | Sprint 26.5 Carrier Portal |
| **carrier_compliance_reports** | Sprint 26.5 Carrier Portal |
| **carrier_payment_approvals** | Sprint 26.5 Carrier Portal |
| **carrier_partners_stats** | Sprint 26.5 Carrier Portal |
| **parts_suppliers** | Sprint 21 etendu (PartsHub) |
| **parts_supplier_catalog** | Sprint 21 etendu (PartsHub) |
| **parts_orders** | Sprint 21 etendu (PartsHub) |
| **parts_commission_log** | Sprint 21 etendu (PartsHub) |

**Total : 85 tables** (vs 69 v2.2).

### Permissions etendues (130 vs 90 v2.2)

| Module | Permissions actuelles v2.2 | Permissions ajoutees v3.0 |
|--------|----------------------------|---------------------------|
| Carrier (NOUVEAU module) | 0 | ~15 |
| Expert (NOUVEAU module) | 0 | ~10 |
| Tow (NOUVEAU module) | 0 | ~8 |
| PartsHub (NOUVEAU module) | 0 | ~7 |
| Existants modifies | ~85 | ~85 + transitions workflow |
| **Total** | **90** | **~130** |

## Strategie de mitigation pendant developpement

Pendant l'execution v3.0, pour eviter regression :
- Sprint 7.5a livre les fondations (24 roles + 7 cross-tenant types + 130 perms catalog)
- Sprint 7 reprise (tache 2.3.2+) construit RBAC directement sur 24 roles
- Tests existants (1071 PASS) continuent de PASS sans modification
- Nouveaux sprints (22.5 Tow, 22.7 Expert, 26.5 Carrier Portal) ajoutent apps progressivement
- Migration cross-tenant types (Sprint 7.5a) verifie 0 leak RLS via 50+ scenarios

## Plan d'execution

| Sprint | Action |
|--------|--------|
| Sprint 7.5a (immediat) | Decisions formalisees + AuthRole +12 + CrossTenantType +4 + DB migration + catalog 130 perms |
| Sprint 7 reprise (tache 2.3.2+) | RBAC construit sur 24 roles directement |
| Sprint 8-13 | Modules horizontaux avec types contact "expert" et "tow_driver" |
| Sprint 14 etendu | +3 entites experts |
| Sprint 21 etendu | +6 taches PartsHub integre |
| Sprint 22.5 nouveau | App Tow complete |
| Sprint 22.7 nouveau | App Expert complete |
| Sprint 26.5 nouveau | App Carrier Portal complete |
| Sprint 32 etendu | 8 carriers (vs 5) incluant MATU + Sanad |
| Sprint 35 redefini | Pilote 5 acteurs coordonnes |

## Avantages

1. **Couverture ecosystem complete** : 6 acteurs vs 3 = differentiation absolue vs Courtizen
2. **Workflow sinistre realiste** : expert central designe par carrier (decision-013)
3. **Carrier devient client paying** : Carrier Portal dedie = premier paye recurrent
4. **App Remorqueur Uber-style** : differentiation unique marche MA + Maghreb
5. **PartsHub revenue stream** : 600k-2M MAD/mois potentiel
6. **Effet de reseau renforce** : 6 acteurs interconnectes vs 3 isoles
7. **Pitch coherent** : ACAPS + carriers + brokers + garages voient tout le tableau
8. **Moat metier profond** : 16 entites supplementaires = switching cost enorme une fois adopte
9. **Reuse foundation v2.2** : Sprint 1-7 conserves, juste extension naturelle
10. **Effort progressif** : 5 nouveaux sprints = ~330h sur 12 mois total programme

## Inconvenients

1. **Effort total programme +18%** : 3220h v3.0 vs 2720h v2.2
2. **Complexite RBAC** : 24 roles x 130 permissions = matrice plus large
3. **Tests etendus** : 7000+ scenarios cumules vs 5284 v2.2
4. **3 apps web supplementaires** : effort frontend important (Tow + Expert + Carrier Portal)
5. **Risque dispersion focus** : 6 acteurs = 6 personas a comprendre profondement

Inconvenients juges acceptables car compenses par differentiation strategique majeure.

## Impact technique

- **Code livre conserve** : Sprint 1-6 + Sprint 7 task 2.3.1 inchanges
- **Sprint 7.5a impact** : extension AuthRole enum + CrossTenantAuthorizationType + DB migration + catalog
- **Sprint 7 reprise** : PermissionsMatrix construit sur 24 roles
- **Sprints metier 8-35** : naming + entites + apps elargis
- **Tests RLS** : 50+ scenarios additionnels pour 4 nouveaux cross-tenant types

## Communication

Cette decision est communiquee :
- A l'equipe technique : 24 roles + 7 cross-tenant types deviennent standard v3.0
- A l'equipe business : pitch carriers + brokers + garages + experts + remorqueurs = pitch ecosystem complet
- A ACAPS : dossier Programme Emergence mentionne 6 acteurs assurance auto MA (vs 3 v2.2)
- A investisseurs : pitch differentiation 6 acteurs + 16 entites supplementaires = moat technique + metier

---

**Decision finale** : OK pour adoption 6 acteurs ecosystem complet. Apps Tow + Expert + Carrier Portal ajoutees au programme. PartsHub module integre Sprint 21.

**References** :
- decision-011-assurflow-rebrand.md (naming aligned)
- decision-013-expert-acteur-central.md (workflow expert correct)
- decision-014-partshub-phase1.md (PartsHub integration)
- assurflow-analyse-strategique-v2.docx (analyse strategique v2.0 source)
- B-7.5a-sprint-7.5a-assurflow-foundation.md (sprint d'execution)
- B-22.5-sprint-tow-app.md (a creer Sprint 7.5b)
- B-22.7-sprint-expert-app.md (a creer Sprint 7.5b)
- B-26.5-sprint-carrier-portal.md (a creer Sprint 7.5b)
