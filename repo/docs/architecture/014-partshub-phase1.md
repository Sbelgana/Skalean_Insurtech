# Decision 014 -- PartsHub Phase 1 Module Integre Assurflow Garage

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-014-partshub-phase1.md`

---

## Contexte

L'architecture v2.2 du programme Skalean InsurTech ne couvre PAS le sujet de la gestion des pieces detachees automobiles :

- Stock interne : module Sprint 13 (Stock + HR + Analytics) gere stock pieces INTERNE garage
- Fournisseurs externes : juste mention dans Sprint 19 (`StockItemsService.createOnDemand()` pour piece nouvelle)
- Marketplace pieces : INEXISTANT
- Commande automatique fournisseurs : INEXISTANT
- Commission Assurflow : INEXISTANT

Saad (CTO + connaissance terrain via garage de son pere a Marrakech) a propose lors de la revision v2.0 (mai 2026) :

> "On peut penser a rajouter une option dans notre systeme qui peut batir une base de donnees de pieces de rechange pour nous donner des estimations de prix et de temps"

> "Ce module est tres important et pourra etre une source de revenu importante pour nous en tant que fournisseur de solution. Je t'explique pourquoi il faut creer une base de donnees commune de tous les fournisseurs de pieces avec qui les garagistes dans chaque region font affaire, pour que : 1- avoir plus de transparence sur les prix des pieces, 2- accelerer le processus de devis, le tout va etre centralise dans une seule base de donnees et la commande se fera automatiquement au fournisseur quand le garagiste click sur le bouton de commande"

> "Ce module doit pouvoir etre vendu seul a des fournisseurs et doit se pluger au module garagiste facilement, pour des ventes par module"

> "Cela sous-entend aussi que il y aura une gestion de stock de livraison de paiement en ligne aussi pour ce module"

Solutions etudiees :
- (A) Module integre dans Assurflow Garage (pas standalone, juste une feature)
- (B) Produit standalone vendu aussi a fournisseurs pieces (Assurflow PartsHub.com)
- (C) Plateforme horizontale Skalean (sert auto + sante + autres verticaux)

## Probleme adresse

Comment introduire la gestion des pieces detachees + marketplace fournisseurs dans Assurflow pour :
- Accelerer processus devis (Sky AI estimation + catalog prix transparents)
- Reduire delais d'attente client (commande automatique vs telephone)
- Capitaliser sur fragmentation marche fournisseurs MA (~thousands de revendeurs)
- Creer revenue stream additionnel (commission 3-5% par transaction)
- Pilote validable avec garage Saad + 10 fournisseurs locaux Marrakech
- Eviter dispersion produit (focus Phase 1 sur core 6 acteurs)

## Decision

**Adoption Option A : PartsHub = Module INTEGRE dans Assurflow Garage Phase 1**.

Pas standalone pour Phase 1. Phase 2 standalone possible si traction > 100 garages adopte le module.

### Specifications PartsHub Phase 1

#### Position dans le programme

| Element | Valeur |
|---------|--------|
| Sprint d'introduction | Sprint 21 (Sinistre Workflow Detaille) etendu |
| Position numerique | 5.3.14 a 5.3.19 (6 taches ajoutees apres les 13 existantes) |
| Effort total Sprint 21 | 70h (v2.2) -> 100h (v3.0) -- +30h pour PartsHub |
| Standalone product (Phase 2) | NON pour Phase 1, possibilite Phase 2 selon traction |
| Modele commercial | Commission 3-5% par transaction piece |
| Pilote cible | Garage de pere Saad + ~10 fournisseurs locaux Marrakech |

#### Architecture technique

```
Assurflow Garage (app garagiste -- existant)
    |
    +-- Module Stock interne (Sprint 13 -- existant)
    +-- Module Comptabilite (Sprint 12 -- existant)
    +-- Module HR (Sprint 13 -- existant)
    +-- Module Workflow Reparation (Sprint 21 -- existant + redefini)
    +-- Module PartsHub (NOUVEAU Sprint 21 -- 6 taches integrees)
            |
            +-- Catalogue fournisseurs locaux
            +-- Commandes automatiques (click-to-order)
            +-- Tracking livraison
            +-- Paiement en ligne aux fournisseurs (via Sprint 11 Pay)
            +-- Mise a jour stocks fournisseurs auto
            +-- Commission Assurflow 3-5% par transaction tracee
```

#### Entites DB additionnelles (4 nouvelles)

| Entite | Description | Colonnes principales |
|--------|-------------|----------------------|
| **parts_suppliers** | Catalog fournisseurs pieces | id, tenant_id, supplier_name, address, geoloc, contact, kyc_documents, commission_rate, status (active/suspended/deleted), onboarded_at |
| **parts_supplier_catalog** | Catalogue pieces par fournisseur | id, supplier_id, part_reference, part_name, brand, vehicle_models[], price_ht, price_ttc, stock_available, delivery_time_days |
| **parts_orders** | Commandes pieces garage -> fournisseur | id, tenant_id (garage), supplier_id, sinistre_id, part_ref, quantity, total_amount, status (draft/sent/accepted/delivered/cancelled), commission_amount, payment_status |
| **parts_commission_log** | Tracking commission Assurflow 3-5% | id, order_id, commission_rate, commission_amount, payable_to_assurflow_at, paid_at |

#### Workflow PartsHub integre Sprint 21

```
PHASE 1 -- Diagnostic garage (Tache 5.3.2)
[GARAGE] Sky AI estimation devis avec pieces necessaires (Sprint 20)
   |
   v
PHASE 2 -- Commande pieces (NOUVELLE -- Taches 5.3.14 a 5.3.19)
[GARAGE] Click "Commander pieces" dans Assurflow Garage UI
   |
   v
[PARTSHUB] Affiche catalog fournisseurs disponibles selon :
  - Reference piece + brand
  - Geographie (proximite garage)
  - Stock disponible
  - Prix
  - Delai livraison
  - Rating fournisseur
   |
   v
[GARAGE] Selectionne fournisseur (1-click)
[GARAGE] Confirme commande
   |
   v
[PARTSHUB] Envoie commande automatique au fournisseur (API + email + SMS)
[PARTSHUB] Bloque commission 3-5% du prix
   |
   v
[FOURNISSEUR] Recoit commande dans son portail
[FOURNISSEUR] Accepte + planifie livraison
   |
   v
[PARTSHUB] Tracking livraison real-time
   |
   v
[GARAGE] Recoit piece + valide reception
[GARAGE] Update stock interne (integration Sprint 13)
   |
   v
[FOURNISSEUR] Recoit paiement (moins commission Assurflow)
[ASSURFLOW] Encaisse commission tracee dans parts_commission_log
   |
   v
PHASE 3 -- Continuation reparation (Tache 5.3.5)
[GARAGE] Continue workflow reparation normalement
```

#### 6 taches Sprint 21 etendues (PartsHub Phase 1)

| Tache | Theme | Effort |
|-------|-------|--------|
| **5.3.14** | PartsHub : catalog fournisseurs + onboarding KYB | 6h |
| **5.3.15** | PartsHub : commande automatique fournisseur (API + email) | 5h |
| **5.3.16** | PartsHub : tracking livraison + statut real-time | 4h |
| **5.3.17** | PartsHub : paiement en ligne fournisseurs (integration Sprint 11) | 5h |
| **5.3.18** | PartsHub : commission tracking 3-5% + log | 5h |
| **5.3.19** | PartsHub : dashboard analytics garage + Assurflow + tests E2E | 5h |
| **Total** | | **30h** |

#### Role utilisateur additionnel (Sprint 7 catalog)

| Role | Description |
|------|-------------|
| **garage_parts_manager** | Gestionnaire pieces dans le tenant garage. Gere commandes PartsHub + relation fournisseurs |

Permissions :
- `parts.suppliers.read`
- `parts.suppliers.add_to_favorites`
- `parts.orders.create`
- `parts.orders.read`
- `parts.orders.cancel_within_window`
- `parts.commission.view_dashboard`
- `parts.invoices.read`

### Revenue model projection

| Metric | Valeur |
|--------|--------|
| Volume estime pilote (garage Saad) | 200-400 pieces commandees/mois |
| Prix moyen piece | 500-2000 MAD |
| Volume mensuel revenue | 150 000 - 500 000 MAD |
| Commission 4% (centre fourchette) | 6 000 - 20 000 MAD/mois sur 1 garage |
| **Scaled a 100 garages adopte** | **600 000 - 2 000 000 MAD/mois** |
| Scaled a 500 garages | 3M - 10M MAD/mois (potentiel CIMA expansion) |

### Strategie pilote Phase 1

Pilote PartsHub demarrera avec :
- **1 garage seed** : garage de pere Saad a Marrakech (validation terrain)
- **10 fournisseurs locaux Marrakech** : selection par Saad (relation existante)
- **Catalog initial** : 200-500 pieces les plus frequemment commandees (basees historique reel garage Saad)
- **Validation modele commercial** : 3-5% commission acceptee par fournisseurs
- **Duree pilote** : 2-3 mois avant Sprint 35 Pilote Marrakech complet

### Strategie Phase 2 (post-pilote, T3 2027+)

Selon traction PartsHub Phase 1 :

**Si > 100 garages adopte module PartsHub** : extraction en produit standalone
- Repo separe `assurflow-partshub` (ou conserve dans monorepo, module a part)
- App web dedie `parts.assurflow.com`
- Onboarding fournisseurs en masse (objectif 200+)
- Marketplace public (autres garages non-Assurflow peuvent s'inscrire)
- Revenue stream additionnel : SaaS fournisseurs + ads premium placement

**Si < 100 garages adopte** : module reste integre Assurflow Garage
- Focus amelioration UX + plus de fournisseurs
- Pas de scale standalone premature

## Strategie de mitigation pendant developpement

- Sprint 7.5a integre +1 role garage_parts_manager + ~7 permissions PartsHub
- Sprint 7.5b redefinit Sprint 21 avec +6 taches PartsHub
- Sprint 11 (Pay) integration via passerelles MA pour paiement fournisseurs (CMI, YouCan Pay, etc.)
- Sprint 13 (Stock) garage interne continue de fonctionner -- PartsHub vient en complement (pas remplacement)
- Tests E2E Sprint 21 valident workflow complet : devis -> commande PartsHub -> livraison -> reception -> stock

## Plan d'execution

| Sprint | Action PartsHub |
|--------|-----------------|
| Sprint 7.5a | +1 role + ~7 permissions catalog |
| Sprint 7.5b | Specifications detaillees 6 taches Sprint 21 etendu |
| Sprint 11 | Integration Pay fournisseurs (passerelles MA) |
| Sprint 13 | Module Stock interne (base architecturale PartsHub) |
| Sprint 21 | **Implementation 6 taches PartsHub** (30h) |
| Sprint 22 | UI PartsHub dans Assurflow Garage app |
| Sprint 35 | Pilote PartsHub avec garage Saad + 10 fournisseurs |

## Avantages

1. **Revenue stream additionnel important** : 600k-2M MAD/mois potentiel scaled
2. **Accelere processus devis** : Sky AI + catalog transparent = -50% temps devis
3. **Resoud pain point reel** : "Quel fournisseur ? Quel prix ? Quel delai ?" = oxygene operationnel garage
4. **Differentiation forte** : aucun concurrent local n'a module similaire integre ERP garage
5. **Effet reseau marketplace** : plus de garages = plus de fournisseurs attires, et inversement
6. **Pilote valide rapidement** : garage Saad + 10 fournisseurs locaux = MVP testable
7. **Effort raisonnable** : 30h ajoutees a Sprint 21 (vs +6 mois si standalone)
8. **Phase 2 flexibilite** : peut extraire en standalone si traction confirmee

## Inconvenients

1. **Effort Sprint 21 augmente** : 70h -> 100h (+30h)
2. **Complexite UI Assurflow Garage app** : Sprint 22 Web Garage doit integrer UI PartsHub
3. **Onboarding fournisseurs manuel pilote** : Saad doit personnellement onboarder 10 premiers fournisseurs
4. **Risque adoption fournisseurs** : si fournisseurs refusent commission 3-5%, modele a ajuster
5. **Module non-standalone Phase 1** : revenue potentiel limite a garages Assurflow
6. **Pas de vente directe fournisseurs Phase 1** : revenue limite a commission garages

Inconvenients juges acceptables car compenses par pilote validation rapide + Phase 2 flexibilite.

## Impact technique

- **Aucun code livre touche** : Sprint 1-7 livres conserves
- **Sprint 7.5a impact** : +1 role garage_parts_manager + ~7 permissions catalog
- **Sprint 7.5b impact** : specifications detaillees Sprint 21 etendu
- **Sprint 11 impact** : adapter pay system pour beneficiaires "fournisseurs pieces" (vs juste assureurs + brokers)
- **Sprint 21 impact** : +6 taches + 4 nouvelles entites DB + workflow PartsHub
- **Sprint 22 impact** : UI PartsHub dans web-garage
- **Tests E2E** : scenarios Sprint 21 validateurs : devis -> PartsHub -> reception -> reparation

## Communication

Cette decision est communiquee :
- A l'equipe technique : PartsHub = module integre Sprint 21 (pas sprint nouveau)
- A Saad : pilote demarrera avec garage de son pere + 10 fournisseurs locaux Marrakech
- A l'equipe business : pitch garages met en avant "commande pieces 1-click via catalog transparent"
- A pool fournisseurs MA (post-pilote) : invitation Phase 2 marketplace standalone si traction
- A investisseurs : revenue stream PartsHub = 600k-2M MAD/mois projection scaled

---

**Decision finale** : OK pour PartsHub = module INTEGRE dans Assurflow Garage Phase 1. Sprint 21 etendu de 70h a 100h. Pilote garage Saad + 10 fournisseurs locaux Marrakech. Modele commission 3-5%. Phase 2 standalone reevaluable post-pilote.

**References** :
- decision-011-assurflow-rebrand.md (Assurflow Garage dans liste apps)
- decision-012-6-acteurs-ecosystem.md (Garage = acteur 3, PartsHub feature integree)
- decision-013-expert-acteur-central.md (workflow expert dans Sprint 21)
- assurflow-analyse-strategique-v2.docx (PartsHub idee Saad)
- B-7.5a-sprint-7.5a-assurflow-foundation.md (sprint d'execution)
- B-21-sprint-21-sinistre-workflow.md (a refonder Sprint 7.5b)
