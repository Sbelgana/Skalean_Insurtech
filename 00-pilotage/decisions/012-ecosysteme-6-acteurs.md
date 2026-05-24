# Decision 012 -- Ecosysteme a 6 acteurs (v3.0) au lieu de 3 (v2.2)

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-012-ecosysteme-6-acteurs.md`

---

## Contexte

La version v2.2 d'Assurflow reposait sur trois acteurs :

- **Broker** (cabinet de courtage d'assurance) : intermediaire qui place les contrats et gere le portefeuille de l'assure.
- **Garage** (atelier de reparation automobile) : etablit les devis de reparation et realise les travaux.
- **Customer / Assure** (le client final) : personne physique ou morale assuree.

L'analyse strategique v2.0 (mai 2026), revue par Saad (CTO) qui y a apporte 29 corrections de terrain, a montre que ce triptyque ne represente pas le circuit reel d'un sinistre automobile au Maroc. Un sinistre met en jeu trois acteurs supplementaires que la v2.2 ignorait :

- **Carrier** (compagnie d'assurance) : porte le risque, paie l'indemnisation, designe l'expert. Sans la compagnie, le flux financier du sinistre (franchise assure, indemnisation, recours) n'est pas modelisable.
- **Expert** (expert automobile agree ACAPS) : evalue le dommage, valide, modifie ou rejette le devis du garage. C'est un acteur central, traite en detail dans la decision-013.
- **Tow** (remorqueur) : intervient des la survenance du sinistre, genere des couts a tracer et a refacturer.

L'analyse concurrentielle de Courtizen a confirme que les acteurs etablis couvrent le triptyque courtier-garage-assure mais laissent un angle mort sur l'orchestration multi-acteurs du sinistre. C'est le positionnement differenciant d'Assurflow.

L'audit du code source v2.2 a confirme que l'architecture multi-tenant a trois niveaux (decision-002) et le framework RBAC absorbent l'extension a 6 acteurs de maniere additive, sans refonte.

## Probleme adresse

- Representer le circuit reel d'un sinistre automobile marocain (compagnie + expert + remorqueur en plus du courtier, garage, assure).
- Isoler les donnees de chaque acteur dans son propre tenant (la compagnie ne voit pas les portefeuilles concurrents, l'expert ne voit que les sinistres qui lui sont designes).
- Etendre le modele de roles RBAC sans casser les 12 roles v2.2 deja testes.
- Etendre les autorisations cross-tenant pour couvrir les nouveaux flux (designation expert, livraison vehicule, demande de remorquage, devis carrier).
- Garantir la conformite : nouveaux tenants Carrier et Expert traitant des donnees d'assures, soumis a la loi 09-08 (CNDP) et a la residence MA (decision-008).

## Decision

**Assurflow v3.0 repose sur un ecosysteme a 6 acteurs.** Cette extension entraine trois evolutions chiffrees, contractuelles pour les sprints aval :

- **Roles RBAC : 12 -> 26 roles** (extension additive : 12 roles v2.2 conserves + 14 roles nouveaux v3.0).
- **Types de cross-tenant authorization : 3 -> 7 types** (3 conserves + 4 nouveaux).
- **Permissions : 90 -> 130 permissions** (90 conservees + 40 nouvelles environ).

### Table des 6 acteurs

| Acteur | Nom marocain / description | Type de tenant | Nouveau en v3.0 | Donnees sensibles |
|--------|----------------------------|----------------|-----------------|-------------------|
| Broker | Cabinet de courtage d'assurance | Tenant Customer B2B | Non (v2.2) | Portefeuille polices, donnees assures |
| Garage | Atelier de reparation automobile | Tenant Customer B2B | Non (v2.2) | Devis, photos vehicules, pieces |
| Customer / Assure | Client final assure (L3 dans tenant) | Niveau 3 dans tenant | Non (v2.2) | CIN, polices, sinistres personnels |
| Carrier | Compagnie d'assurance | Tenant Customer B2B | Oui (v3.0) | Contrats, indemnisations, donnees risque |
| Expert | Expert automobile agree ACAPS | Tenant Customer B2B distinct | Oui (v3.0) | Rapports d'expertise, devis contre-expertise |
| Tow | Remorqueur | Tenant Customer B2B | Oui (v3.0) | Demandes de remorquage, couts intervention |

### Decomposition des 26 roles RBAC

Les 12 roles v2.2 sont conserves a l'identique (pas de renommage) et 14 roles sont ajoutes en v3.0. Repartition par acteur :

| # | Role | Acteur de rattachement | Origine |
|---|------|------------------------|---------|
| 1 | super_admin_platform | Plateforme (Skalean staff) | v2.2 |
| 2 | analyst_support | Plateforme (Skalean staff) | v2.2 |
| 3 | broker_admin | Broker | v2.2 |
| 4 | broker_user | Broker | v2.2 |
| 5 | broker_assistant | Broker | v2.2 |
| 6 | garage_admin | Garage | v2.2 |
| 7 | garage_chef | Garage | v2.2 |
| 8 | garage_technicien | Garage | v2.2 |
| 9 | garage_comptable | Garage | v2.2 |
| 10 | garage_commercial | Garage | v2.2 |
| 11 | assure | Customer / Assure (L3) | v2.2 |
| 12 | prospect | Public | v2.2 |
| 13 | garage_parts_manager | Garage (module PartsHub) | v3.0 |
| 14 | carrier_admin | Carrier | v3.0 |
| 15 | carrier_claims_manager | Carrier | v3.0 |
| 16 | carrier_finance | Carrier | v3.0 |
| 17 | carrier_compliance | Carrier | v3.0 |
| 18 | carrier_expert_manager | Carrier | v3.0 |
| 19 | carrier_partner_manager | Carrier | v3.0 |
| 20 | expert_independent | Expert | v3.0 |
| 21 | expert_firm_admin | Expert | v3.0 |
| 22 | expert_associate | Expert | v3.0 |
| 23 | expert_carrier_internal | Expert (interne compagnie) | v3.0 |
| 24 | tow_admin | Tow | v3.0 |
| 25 | tow_driver | Tow | v3.0 |
| 26 | tow_dispatcher | Tow | v3.0 |

Total : 26 roles (12 conserves de v2.2 + 14 ajoutes en v3.0). Les 4 roles expert (expert_independent, expert_firm_admin, expert_associate, expert_carrier_internal) sont detailles dans la decision-013. Le role garage_parts_manager est detaille dans la decision-014.

### Les 7 types de cross-tenant authorization

Les 3 types v2.2 sont conserves et 4 types sont ajoutes en v3.0 :

| # | Type | Description | Origine |
|---|------|-------------|---------|
| 1 | broker_to_garage_assignment | Le courtier assigne un sinistre a un garage | v2.2 |
| 2 | assure_to_garage_visit | L'assure autorise un garage a voir son sinistre | v2.2 |
| 3 | multi_tenant_user_access | Un utilisateur opere pour plusieurs tenants | v2.2 |
| 4 | client_to_tower_dispatch | L'assure ou courtier declenche une mission de remorquage | v3.0 |
| 5 | tower_to_garage_delivery | Le remorqueur livre le vehicule au garage cible | v3.0 |
| 6 | garage_to_expert_request | Le garage notifie l'expert designe pour validation devis | v3.0 |
| 7 | garage_to_carrier_quote | Le garage envoie le devis a la compagnie en copie | v3.0 |

### Les permissions 90 -> 130

Les 90 permissions v2.2 sont conservees ; environ 40 permissions sont ajoutees, reparties sur les nouveaux modules : module carrier (~15 permissions : dashboard, claims, payment approval multi-level, experts designation), module expertise (~10 permissions : missions, validate/modify/reject quote, report sign), module tow (~8 permissions : missions, photos, availability, earnings), et module parts (~7 permissions, decision-014). Le compte cible est 130 permissions.

## Avantages

1. Representation fidele du circuit reel d'un sinistre automobile marocain.
2. Isolation stricte des donnees par tenant (compagnie, expert, remorqueur separes).
3. Differenciation marche : orchestration multi-acteurs absente chez Courtizen.
4. Extension additive : les 12 roles, 3 types, 90 permissions v2.2 sont conserves a l'identique.
5. Conformite : nouveaux tenants soumis a residence MA et loi 09-08 des leur creation.

## Inconvenients

1. Surface d'attaque cross-tenant accrue (7 types au lieu de 3) : mitige par RLS Postgres (decision-002) et tests d'isolation exhaustifs.
2. Complexite RBAC (26 roles) : mitige par le decorateur @Roles() systematique et le RolesGuard global.
3. Volume de permissions (130) : mitige par une organisation en modules clairs (carrier, expertise, tow, parts).

## Impact technique

- **Tache 7.5a.2** : extension de l'enum AuthRole de 12 a 26 roles (consomme cette decision et la decision-013).
- **Tache 7.5a.3** : extension de CrossTenantAuthorizationType de 3 a 7 types.
- **Tache 7.5a.4** : migration DB cross_tenant_authorizations CHECK + table expert_designations.
- **Tache 7.5a.5** : helper postgres app_can_access_tenant() etendu pour 7 types.
- **Tache 7.5a.6** : extension des permissions de 90 a 130.

## Communication

Equipe : l'extension est additive ; ne jamais modifier ni renumeroter les 12 roles v2.2. Le compte cible 26 roles / 7 types / 130 permissions est contractuel.
ACAPS : les nouveaux tenants Carrier et Expert sont presentes dans le dossier Programme Emergence avec leur isolation.
CNDP : les nouveaux tenants traitant des donnees d'assures respectent la residence MA (decision-008).

## References

- decision-002-multi-tenant-3-niveaux.md : architecture multi-tenant qui absorbe les 6 acteurs.
- decision-008-data-residency-maroc.md : residence MA des nouveaux tenants.
- decision-013-expert-acteur-central.md : detail des 4 roles expert et du workflow.
- decision-014-partshub-module-garage.md : detail du role garage_parts_manager.
- B-7.5a-sprint-7.5a-assurflow-foundation.md (meta-prompt Sprint 7.5a Assurflow Foundation).
- Loi 17-99 Code des assurances : legitimite de l'acteur Carrier.
- ADR-012 : detail de l'extension RBAC additive.
