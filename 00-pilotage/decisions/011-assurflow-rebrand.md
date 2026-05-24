# Decision 011 -- Rebranding Skalean (editeur) + Assurflow (produit InsurTech)

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-011-assurflow-rebrand.md`

---

## Contexte

Le programme a ete designe jusqu'a la version v2.2 sous le nom unique "Skalean InsurTech". Ce nom melange deux niveaux :

- **Skalean** : la societe (holding et editeur logiciel). Skalean peut a terme editer plusieurs produits verticaux, dans l'assurance et au-dela.
- **InsurTech** : un descriptif de domaine, pas un nom de produit.

Cette ambiguite a genere des frictions concretes :

- Les documents commerciaux et reglementaires (dossier ACAPS Programme Emergence, declarations CNDP) ne savaient pas s'il fallait nommer l'editeur ou le produit.
- Le discours investisseurs confondait la valeur de la societe et celle du produit vertical.
- Toute future diversification (un deuxieme produit vertical edite par Skalean) etait bloquee par un nom produit qui captait le nom de l'editeur.
- Le positionnement marche face a Courtizen exigeait une marque produit forte et memorable, distincte du nom corporate.

## Probleme adresse

- Clarifier que Skalean est l'editeur et que le produit vertical InsurTech a un nom propre.
- Donner au produit une marque differenciante sur le marche marocain de la digitalisation de l'assurance.
- Ne pas casser le code v2.2 deja livre et teste : le rebranding est un changement de marque produit, pas un renommage de l'espace de noms technique.
- Preparer une future diversification multi-verticale de Skalean.

## Decision

**Le produit vertical InsurTech edite par Skalean s'appelle Assurflow.**

- **Skalean** = societe, editeur, holding. Apparait dans les mentions legales, le pied de page corporate, les contrats d'edition, le discours societe aux investisseurs.
- **Assurflow** = produit vertical InsurTech. Apparait dans l'interface utilisateur, le nom commercial du SaaS, les supports marketing produit, le dossier ACAPS en tant que solution, la communication aux courtiers, garages, compagnies, experts et assures.

La formulation de reference est : "Assurflow, edite par Skalean".

### Ce qui change

- Marque affichee dans l'interface (logo, titre d'application, emails transactionnels, modeles WhatsApp, documents PDF generes).
- Nom dans les supports commerciaux et le pitch investisseurs.
- Nom de la solution dans les dossiers ACAPS et les declarations CNDP (en tant que produit, l'editeur reste Skalean).
- Nom de domaine produit et identite visuelle.

### Ce qui ne change pas

Le rebranding est strictement une evolution de marque produit. Les identifiants techniques internes sont conserves a l'identique pour ne pas introduire de regression sur le code v2.2 deja teste :

- Les packages restent `@insurtech/{name}` (par exemple `@insurtech/shared-types`, `@insurtech/sky`).
- Les topics Kafka restent `insurtech.events.{vertical}.{entity}.{action}`.
- Les chemins d'API restent `/api/v1/...`.
- Les noms de tables, de variables d'environnement et de schemas Zod restent inchanges.

Encadre normatif : aucun refactoring de renommage `@insurtech/*` vers `@assurflow/*` ne doit etre entrepris dans le sprint 7.5a. Le cout de refactoring serait eleve, le risque de regression massif, et le benefice fonctionnel nul. Le nom Assurflow vit au niveau de la couche presentation et marque, pas au niveau du code partage. Un eventuel refactor du namespace technique est defere a un sprint dedie ulterieur (Phase 2 post-pilote).

## Avantages

1. Clarte editeur / produit : Skalean societe, Assurflow produit.
2. Marque produit differenciante face a Courtizen sur le marche marocain.
3. Diversification future de Skalean possible (autres verticales) sans collision de nom.
4. Aucun risque de regression technique : namespace conserve.
5. Discours investisseurs clarifie (valeur societe vs valeur produit).

## Inconvenients

1. Effort de mise a jour des supports existants portant l'ancien nom (mitige : peu de supports en v2.2, pilote non encore lance).
2. Periode de coexistence des deux noms dans les documents internes (mitige : formulation de reference unique "Assurflow, edite par Skalean").
3. Risque de confusion ponctuelle equipe entre marque produit et namespace technique (mitige : encadre normatif explicite, et rappel dans la tache 7.5a.10 de cross-reference documentation).

## Impact technique

- **Sprint 7.5a, tache 7.5a.10** : cross-reference Assurflow v3.0 dans la documentation pilotage (INDEX, README, CLAUDE.md).
- Tous sprints : namespace technique `@insurtech/*` conserve ; aucune migration de packages.
- Documents : dossier ACAPS et declarations CNDP mentionnent Assurflow comme produit, Skalean comme editeur.
- Le rebranding UI complet (logo, titres, emails, PDFs) est defere a un sprint UI ulterieur (Sprint 7.5b ou apres).

## Communication

Equipe : la formulation de reference est "Assurflow, edite par Skalean". Le namespace technique ne change pas ; ne pas renommer les packages.
Investisseurs : Skalean est la societe, Assurflow est le premier produit vertical InsurTech, ce qui ouvre la voie a une strategie multi-verticale.
ACAPS et CNDP : Assurflow est la solution presentee, Skalean en est l'editeur responsable du traitement.

## References

- decision-012-ecosysteme-6-acteurs.md : l'ecosysteme a 6 acteurs d'Assurflow v3.0.
- decision-015-demo-day-30-juin-2026.md : le Demo Day presente la marque Assurflow.
- B-7.5a-sprint-7.5a-assurflow-foundation.md (meta-prompt Sprint 7.5a Assurflow Foundation).
- ADR-011 : detail de la portee marque vs technique.
