# Decision 013 -- Expert acteur central designe par la compagnie

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-013-expert-acteur-central.md`

---

## Contexte

Dans le circuit reel d'un sinistre automobile au Maroc, l'evaluation du dommage n'est pas faite par le garage seul ni par la compagnie seule : elle est confiee a un expert automobile agree par l'ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale). Les 29 corrections de terrain apportees par Saad (CTO) a l'analyse strategique v2.0 insistent sur ce point : sans expert, le produit ne represente pas un sinistre reel.

L'expert est designe par la compagnie d'assurance (le Carrier). Il intervient pour valider, modifier ou rejeter le devis etabli par le garage. Son agrement ACAPS lui impose une independance vis-a-vis du garage qu'il contre-expertise : un expert ne peut donc pas etre un employe ou un sous-traitant du garage. Le marche presente plusieurs structures reelles : l'expert independant (personne physique agreee), le cabinet d'expertise (structure multi-associes avec un administrateur et des associes), et l'expert interne a une compagnie (salarie de la compagnie qui realise certaines expertises en interne).

## Probleme adresse

- Modeliser l'expert comme un acteur central du workflow sinistre, designe par la compagnie.
- Garantir l'independance de l'expert vis-a-vis du garage (exigence d'agrement ACAPS).
- Capturer les structures reelles d'expertise (independant, cabinet, interne compagnie).
- Tracer la designation et la decision de l'expert de maniere auditable.
- Respecter la residence des donnees MA pour les rapports d'expertise (donnees d'assures).

## Decision

**L'expert est un acteur central du workflow sinistre, designe par la compagnie d'assurance, agree ACAPS, et independant du garage.**

### Les 4 roles expert

| Role | Description | Tenant |
|------|-------------|--------|
| expert_independent | Expert automobile independant, personne physique agreee ACAPS, opere seul | Tenant expert (independant) |
| expert_firm_admin | Administrateur d'un cabinet d'expertise multi-associes | Tenant expert (cabinet) |
| expert_associate | Expert associe au sein d'un cabinet d'expertise | Tenant expert (cabinet) |
| expert_carrier_internal | Expert salarie interne d'une compagnie d'assurance | Tenant compagnie (role interne) |

Regle d'independance : aucun de ces roles ne peut etre rattache au tenant Garage. L'expert independant et le cabinet d'expertise sont des tenants distincts. L'expert interne compagnie est rattache au tenant Carrier, jamais au tenant Garage. Cette regle materialise l'exigence d'independance imposee par l'agrement ACAPS : l'expert qui contre-expertise un devis ne peut pas appartenir a la structure qui a etabli ce devis.

### Workflow de designation et de validation

Le workflow se deroule en sept etapes auditables :

1. **Survenance du sinistre.** Un sinistre (claim) est ouvert dans le systeme. Il est rattache a une police portee par une compagnie (Carrier).

2. **Designation de l'expert par la compagnie.** La compagnie (role carrier_claims_manager ou carrier_expert_manager) designe un expert sur le sinistre. Cette designation cree une entree dans la table `expert_designations` (sinistre, expert, compagnie, date, statut). Elle s'appuie sur la nouvelle table cross-tenant et la fonction RLS app_can_access_tenant etendue (decision-012, tache 7.5a.5).

3. **Acces de l'expert au devis du garage.** L'expert accede au devis etabli par le garage via le type de cross-tenant authorization `garage_to_expert_request` (decision-012, type numero 6). Cet acces est en lecture sur le devis et les photos du vehicule, jamais sur le portefeuille global du garage.

4. **Decision de l'expert : valider, modifier ou rejeter.** L'expert evalue le dommage et le devis. Trois issues possibles :
   - Valider : le devis est accepte tel quel.
   - Modifier : l'expert ajuste des postes du devis (quantites, prix, pieces) et produit une version contre-expertisee.
   - Rejeter : le devis est refuse avec motif ; le garage doit le revoir.

5. **Production du rapport d'expertise.** L'expert produit un rapport d'expertise (donnee d'assure, soumise a residence MA, decision-008). Ce rapport peut faire l'objet d'une signature electronique (decision-009, Barid eSign, loi 43-20) pour les decisions engageantes.

6. **Mise en copie de la compagnie.** La compagnie suit la decision de l'expert via le type de cross-tenant authorization `garage_to_carrier_quote` (decision-012, type numero 7) qui permet au garage d'envoyer le devis en copie a la compagnie. Elle suit ainsi la decision de l'expert sans intervenir directement dans la contre-expertise.

7. **Cloture de la designation.** Une fois la decision rendue, la designation passe au statut `completed` dans `expert_designations`, avec horodatage et tracabilite de l'utilisateur expert ayant rendu la decision. Les statuts possibles : `designated`, `accepted`, `rejected`, `completed`, `cancelled`.

### Tables impliquees

- `expert_designations` : lien tenant -> carrier_tenant_id -> carrier_user_id -> expert_tenant_id -> expert_user_id -> sinistre_id, avec statut (designated / accepted / rejected / completed / cancelled), date de designation, date d'acceptation, date de rejet, motif de rejet, date de completion, notes. RLS active via app_can_access_tenant.

Note : la table expert (identite, numero agrement ACAPS) sera creee dans un sprint ulterieur dedie a la verticale Expert (sprint apparente C-22.7 Expert App). Pour Sprint 7.5a, seule la table `expert_designations` est creee pour materialiser le workflow de designation.

## Avantages

1. Representation fidele du role de l'expert dans le circuit sinistre marocain.
2. Independance garantie par construction (expert jamais rattache au tenant garage).
3. Conformite ACAPS : agrement trace, independance materialisee dans le modele.
4. Tracabilite auditable de la designation et de la decision (5 statuts, timestamps).
5. Couverture des structures reelles (independant, cabinet, interne compagnie).

## Inconvenients

1. Complexite du workflow (sept etapes, deux types cross-tenant new v3.0) : mitige par une table de designation dediee et un statut explicite.
2. Quatre roles a verrouiller : mitige par le RolesGuard global et le decorateur @Roles().
3. Donnees de rapport d'expertise sensibles : mitige par residence MA (decision-008) et chiffrement au repos.

## Impact technique

- **Tache 7.5a.2** : roles expert_independent, expert_firm_admin, expert_associate, expert_carrier_internal ajoutes a l'enum AuthRole.
- **Tache 7.5a.3** : types garage_to_expert_request, garage_to_carrier_quote ajoutes a CrossTenantAuthorizationType.
- **Tache 7.5a.4** : creation de la table expert_designations avec RLS.
- **Tache 7.5a.5** : helper postgres app_can_access_tenant() etendu pour ces nouveaux types.
- **Tache 7.5a.6** : permissions module expertise (~10 perms : missions, validate/modify/reject quote, report sign, honoraires).
- **Sprint signature (decision-009)** : signature du rapport d'expertise via Barid eSign.

## Communication

Equipe : l'expert ne doit jamais etre rattache au tenant garage ; cette regle est non-negociable car elle materialise l'independance ACAPS.
ACAPS : le numero d'agrement de l'expert sera trace dans la table expert (sprint ulterieur) ; le dossier Programme Emergence presente l'independance expert/garage.
CNDP : les rapports d'expertise sont des donnees d'assures hebergees au Maroc.

## References

- decision-012-ecosysteme-6-acteurs.md : l'expert dans l'ecosysteme a 6 acteurs et les types cross-tenant.
- decision-008-data-residency-maroc.md : residence MA des rapports d'expertise.
- decision-009-signature-loi-43-20.md : signature electronique du rapport d'expertise.
- B-7.5a-sprint-7.5a-assurflow-foundation.md (meta-prompt Sprint 7.5a Assurflow Foundation).
- ACAPS : agrement des experts automobiles, exigence d'independance.
- ADR-013 : detail du workflow et du modele de donnees expert.
