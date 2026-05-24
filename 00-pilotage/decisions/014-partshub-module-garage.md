# Decision 014 -- PartsHub module Phase 1 integre a la verticale Garage

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-014-partshub-module-garage.md`

---

## Contexte

L'analyse concurrentielle de Courtizen a revele un angle mort : aucun acteur etabli ne monetise le flux de pieces detachees automobiles passant par la plateforme. Or, lors d'une reparation, le garage commande des pieces aupres de fournisseurs. Si ce flux de commandes transite par Assurflow, la plateforme peut capter une commission sur chaque commande de pieces. C'est un argument de revenu cle pour le pitch investisseurs du Demo Day du 30 juin 2026 (decision-015).

La question etait : PartsHub doit-il etre une application separee ou un module integre a la verticale Garage ? L'audit du code v2.2 a montre que le tenant Garage et son systeme d'authentification existent deja ; en faire un module integre evite de dupliquer la gestion tenant et l'authentification, et permet d'exploiter le module des le pilote Marrakech.

## Probleme adresse

- Capter une commission sur le flux de pieces detachees pour creer un revenu demontrable au Demo Day.
- Eviter la duplication tenant/auth d'une application separee.
- Livrer le module assez tot pour qu'il soit exploitable au pilote Marrakech.
- Tracer les commandes, les fournisseurs, les commissions et les factures de maniere auditable.

## Decision

**PartsHub est un module de Phase 1 integre a la verticale Garage, et non une application separee.**

### Role ajoute

- **garage_parts_manager** : gere les fournisseurs de pieces, les commandes de pieces, le tableau de bord des commissions et les factures, au sein du tenant Garage. Ce role est ajoute a l'enum AuthRole en v3.0 (decision-012, role numero 13).

### Module de permissions 'parts'

Le module 'parts' ajoute environ 7 permissions, comptees dans le passage de 90 a 130 permissions (decision-012) :

| Cle constante | Valeur permission | Description |
|---------------|-------------------|-------------|
| PARTS_SUPPLIERS_READ | parts.suppliers.read | Consulter les fournisseurs de pieces |
| PARTS_SUPPLIERS_ADD_FAVORITE | parts.suppliers.add_to_favorites | Ajouter un fournisseur aux favoris |
| PARTS_ORDERS_CREATE | parts.orders.create | Creer une commande de pieces |
| PARTS_ORDERS_READ | parts.orders.read | Consulter les commandes de pieces |
| PARTS_ORDERS_CANCEL | parts.orders.cancel_within_window | Annuler une commande dans la fenetre autorisee |
| PARTS_COMMISSION_VIEW | parts.commission.view_dashboard | Consulter le dashboard des commissions |
| PARTS_INVOICES_READ | parts.invoices.read | Consulter les factures de pieces |

### Style code (style `as const`, jamais enum)

Le catalog permissions doit etre exprime en TypeScript sous la forme `export const PERMISSIONS_CATALOG = {...} as const`, jamais sous forme d'enum. Cette regle interne (deja appliquee Sprint 7 tache 2.3.1) preserve la flexibilite des chaines applicatives `module.resource.action` et permet l'inference de types `as const`.

### Modele de revenu

Le revenu provient d'une commission sur les commandes de pieces routees via la plateforme. Chaque commande passee par le garage aupres d'un fournisseur reference dans PartsHub genere une commission percue par Assurflow. Le tableau de bord des commissions (permission parts.commission.view_dashboard) restitue le volume de commandes, le montant des commissions et la repartition par fournisseur.

## Avantages

1. Time-to-market : module exploitable des le pilote Marrakech.
2. Pas de duplication tenant/auth : reutilise le tenant Garage existant.
3. Revenu demontrable au Demo Day (commission pieces).
4. Tracabilite des commandes, fournisseurs, commissions et factures.

## Inconvenients

1. Couplage de PartsHub a la verticale Garage : si une autre verticale doit l'utiliser un jour, une extraction sera necessaire (couplage assume pour le pilote).
2. Un role et sept permissions supplementaires a verrouiller : mitige par le RolesGuard global.

## Impact technique

- **Tache 7.5a.2** : role garage_parts_manager ajoute a l'enum AuthRole.
- **Tache 7.5a.6** : sept permissions du module 'parts' ajoutees au catalog (style as const, ~130 perms total).
- **Sprints ulterieurs verticale Garage** : implementation effective du module parts (suppliers, orders, commission, invoices) dans la verticale Garage.

## Communication

Equipe : PartsHub vit dans la verticale Garage, pas dans une application separee. Le role garage_parts_manager appartient au tenant Garage.
Investisseurs : la commission sur pieces est un levier de revenu presente au Demo Day.

## References

- decision-012-ecosysteme-6-acteurs.md : role garage_parts_manager et compte de permissions.
- decision-015-demo-day-30-juin-2026.md : le module pieces est demontre au Demo Day.
- B-7.5a-sprint-7.5a-assurflow-foundation.md (meta-prompt Sprint 7.5a Assurflow Foundation).
- ADR-014 : detail du module parts et du modele de commission.
