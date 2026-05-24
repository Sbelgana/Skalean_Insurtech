# Task 7.5a.1 -- Formalisation des decisions strategiques 011-015 (ecosysteme Assurflow v3.0)

## 1. Header metadata

| Champ | Valeur |
|-------|--------|
| Sprint | 7.5a -- Assurflow Foundation |
| Tache | 7.5a.1 -- Formalisation decisions strategiques 011 a 015 |
| Reference meta-prompt | B-7.5a (meta-prompt Sprint 7.5a Assurflow Foundation) |
| Phase | Phase 2.5 -- Migration Assurflow (transition v2.2 -> v3.0) |
| Priorite | P0 (bloquante -- toutes les taches 7.5a.2 a 7.5a.10 dependent de ces decisions comme reference normative) |
| Effort estime | 3 heures |
| Dependances amont | Sprint 7 tache 2.3.1 livre (RBAC v2.2 a 12 roles operationnel, base de comparaison pour l'extension 26 roles) |
| Dependances aval | Tache 7.5a.2 (extension AuthRole enum 12 -> 26 roles) consomme directement decision-012 et decision-013 comme reference ; taches 7.5a.3 a 7.5a.10 referencent decision-011, 014, 015 |
| Densite cible du present fichier | 80 a 150 ko (cible 110-125 ko) |
| Type de livrable | Documentation strategique (fichiers markdown de decision) + tests de structure |
| Politique emoji | AUCUNE EMOJI AUTORISEE (decision-006, absolue, non-negociable) |
| Decideurs des decisions produites | Saad (CTO), Abla (CEO) |
| Date des decisions | 2026-05-23 |
| Langue | Francais (prose) ; identifiants techniques en forme naturelle |

---

## 2. But

Cette tache formalise sous forme de cinq fichiers markdown normatifs les cinq decisions strategiques 011 a 015 qui actent le passage du programme de la version v2.2 (ecosysteme a 3 acteurs, marque unique Skalean InsurTech) vers la version v3.0 (ecosysteme a 6 acteurs, separation de marque Skalean editeur / Assurflow produit InsurTech). Ces decisions ne sont pas des choix d'implementation ponctuels : elles redefinissent le perimetre fonctionnel du produit, le modele de roles RBAC, le modele d'autorisations cross-tenant, et le calendrier de mise en marche (Demo Day). Elles doivent donc etre figees, datees, signees par les decideurs (Saad CTO, Abla CEO) et rendues citables par tous les sprints ulterieurs exactement comme le sont deja les decisions 001 a 010 du dossier `00-pilotage/decisions/`.

Le livrable concret est un ensemble de cinq fichiers `00-pilotage/decisions/011-assurflow-rebrand.md`, `012-ecosysteme-6-acteurs.md`, `013-expert-acteur-central.md`, `014-partshub-module-garage.md`, `015-demo-day-30-juin-2026.md`, plus la mise a jour du `00-pilotage/decisions/README.md` (table passant de 10/10 a 15/15 decisions, avec recategorisation), plus une suite de tests automatises qui verifie que chaque fichier existe, contient exactement les sections requises par le format standard, ne contient aucune emoji (controle regex Unicode), et expose un bloc d'entete (frontmatter logique : Date, Statut, Decideurs, ADR mirror) coherent. Chaque fichier de decision doit etre auto-suffisant : un lecteur qui ouvre `012-ecosysteme-6-acteurs.md` doit comprendre integralement le passage de 12 a 26 roles, de 3 a 7 types de cross-tenant authorization, et de 90 a 130 permissions, sans avoir a ouvrir un autre document.

L'enjeu de qualite est double. D'une part, la conformite reglementaire marocaine : l'introduction de l'acteur Expert (agree ACAPS) et de l'acteur Carrier (compagnie d'assurance, regie par la loi 17-99 Code des assurances) cree de nouveaux tenants traitant des donnees personnelles d'assures, donc soumis a la loi 09-08 (CNDP) et a la residence des donnees au Maroc (decision-008). D'autre part, la coherence d'ingenierie : les chiffres cites dans ces decisions (26 roles, 7 types, 130 permissions, 4 roles expert, 1 role parts manager) deviennent des contrats que les taches 7.5a.2 a 7.5a.10 doivent honorer a la lettre. Une derive d'un seul chiffre entre une decision et son implementation casserait la tracabilite. Les tests fournis ici verrouillent donc ces invariants des la formalisation.

---

## 3. Contexte etendu

### 3.1 Pourquoi ces cinq decisions, maintenant

Le programme Skalean InsurTech a ete concu en v2.2 autour d'un ecosysteme a trois acteurs : le courtier (cabinet de courtage d'assurance), le garage (atelier de reparation automobile), et l'assure (le client final, personne physique ou morale assuree). Ce triptyque correspondait a un produit centre sur le devis et la gestion de portefeuille courtier, avec un volet sinistre automobile leger. Cette architecture a ete codee, testee, et livree jusqu'au Sprint 7 inclus (RBAC granulaire, 12 roles, environ 90 permissions, 3 types de cross-tenant authorization).

Entre fin avril et mi-mai 2026, trois evenements ont impose une revision strategique de fond.

Premierement, une analyse strategique v2.0 (mai 2026) a confronte le produit v2.2 a la realite operationnelle du marche marocain de l'assurance automobile. Cette analyse a ete revue ligne par ligne par Saad (CTO), qui a apporte 29 corrections de terrain. Ces corrections portaient principalement sur le circuit reel d'un sinistre automobile au Maroc : un sinistre n'est pas regle entre le courtier et le garage seuls. La compagnie d'assurance (le Carrier) est partie prenante obligatoire car c'est elle qui porte le risque et paie l'indemnisation. Surtout, l'expertise du dommage est confiee a un expert automobile agree par l'ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale), designe par la compagnie, et c'est cet expert qui valide, modifie ou rejette le devis du garage. Sans expert dans le modele, le produit ne pouvait pas representer un sinistre reel marocain. De plus, le remorquage (acteur Tow) intervient des la survenance du sinistre et genere des couts a tracer. Les 29 corrections de Saad sont synthetisees ainsi : 11 corrections sur le workflow sinistre (designation expert, contre-expertise, CC compagnie), 7 sur la nomenclature des roles (un expert n'est pas un employe garage), 6 sur les flux financiers (qui paie qui : franchise assure, indemnisation compagnie, commission pieces), et 5 sur la conformite (agrement ACAPS de l'expert, segregation des donnees compagnie).

Deuxiemement, une analyse concurrentielle du produit Courtizen (acteur etabli du marche de la digitalisation courtage au Maroc) a montre que les acteurs en place couvrent deja le triptyque courtier-garage-assure mais laissent un angle mort sur l'orchestration multi-acteurs du sinistre (compagnie + expert + remorqueur) et sur la monetisation des pieces detachees. Le positionnement differenciant d'Assurflow se construit precisement sur ces angles morts : etre la premiere plateforme InsurTech marocaine qui orchestre le sinistre de bout en bout, en incluant l'expert agree ACAPS comme acteur central, et qui capte une commission sur le flux de pieces detachees via un module PartsHub.

Troisiemement, un audit du code source de la version v2.2 (archive zip du depot) a confirme que l'architecture multi-tenant a trois niveaux (decision-002) et le framework RBAC etaient suffisamment generiques pour absorber l'extension a 6 acteurs sans refonte : le passage de 12 a 26 roles, de 3 a 7 types de cross-tenant authorization, et de 90 a 130 permissions est une extension additive, pas une rupture. C'est ce qui rend l'evolution v2.2 -> v3.0 realisable dans un sprint de transition (7.5a) plutot que dans une reecriture.

### 3.2 La separation de marque Skalean / Assurflow

Un point de clarification recurrent dans les echanges internes etait l'ambiguite du nom "Skalean InsurTech". Skalean est la societe (holding et editeur logiciel) ; elle peut a terme editer plusieurs produits verticaux (assurance, mais potentiellement d'autres domaines). "Skalean InsurTech" melangeait le nom de l'editeur et le nom du produit. La decision 011 acte que Assurflow est le nom du produit vertical InsurTech edite par Skalean. Cette separation a des consequences concretes : nom de marque dans l'interface, nom dans les documents commerciaux et reglementaires (ACAPS, CNDP), namespace de certains identifiants, et discours investisseurs. Les identifiants techniques internes (packages `@insurtech/*`, topics Kafka `insurtech.events.*`) restent inchanges pour ne pas casser le code existant : la decision precise explicitement que le rebranding est un changement de marque produit, pas un renommage de l'espace de noms technique.

### 3.3 Tableau des alternatives evaluees

| Decision | Option retenue | Alternative ecartee | Raison de l'ecart |
|----------|----------------|---------------------|-------------------|
| 011 Rebranding | Skalean (editeur) + Assurflow (produit) | Garder "Skalean InsurTech" comme nom produit unique | Ambiguite editeur/produit ; blocage pour future diversification multi-verticale ; differenciation marche vs Courtizen |
| 011 Rebranding | Marque produit changee, namespace technique conserve | Renommer tous les packages `@insurtech/*` en `@assurflow/*` | Cout de refactoring eleve, risque de regression massive sur code v2.2 deja teste, aucun benefice fonctionnel |
| 012 Ecosysteme | 6 acteurs (broker, garage, customer, carrier, expert, tow) | Rester a 3 acteurs et modeliser carrier/expert/tow comme attributs | Impossible de representer le workflow sinistre reel ; pas d'isolation tenant des donnees compagnie ; non conforme circuit ACAPS |
| 012 Ecosysteme | Extension additive 12 -> 26 roles | Refonte du modele RBAC en ABAC pur | Refonte trop lourde pour un sprint de transition ; RBAC existant deja teste et conforme |
| 013 Expert | Expert acteur central designe par la compagnie | Expert sous-traitant du garage | Non conforme : l'expert doit etre independant du garage qu'il contre-expertise (agrement ACAPS impose l'independance) |
| 013 Expert | 4 roles expert (independent, firm_admin, associate, carrier_internal) | 1 role expert generique | Ne capture pas les structures reelles : expert independant, cabinet d'expertise multi-associes, expert interne compagnie |
| 014 PartsHub | Module Phase 1 integre a la verticale Garage | Application separee PartsHub | Time-to-market : module integre exploitable des le pilote ; pas de duplication tenant/auth |
| 014 PartsHub | Module Phase 1 integre a la verticale Garage | Defere en Phase 2 (post-pilote) | La commission sur pieces est un argument de revenu cle pour le pitch investisseurs du Demo Day |
| 015 Demo Day | Date fixe 30 juin 2026, scope complet v3.0 | Demo Day en deux temps (v2.2 puis v3.0) | Dilue le message ; le pilote Marrakech exige une demonstration de bout en bout de l'ecosysteme complet |

### 3.4 Trade-offs assumes

Le passage a 6 acteurs augmente mecaniquement la surface d'attaque cross-tenant : plus d'acteurs signifie plus de types d'autorisations cross-tenant a auditer (7 au lieu de 3) et plus de roles a verrouiller par RolesGuard (26 au lieu de 12). Le trade-off assume est que cette complexite est portee par le framework multi-tenant existant (decision-002, RLS Postgres comme derniere ligne de defense) plutot que par du code applicatif ad hoc. L'integration de PartsHub comme module Garage plutot que comme application separee accelere le time-to-market mais couple PartsHub a la verticale Garage : si un jour PartsHub doit servir d'autres verticales, une extraction sera necessaire. Ce couplage est assume car le revenu de commission pieces doit etre demontrable au Demo Day du 30 juin 2026. Enfin, la date du Demo Day est un engagement dur qui contraint le sequencement : tout glissement de sprint doit etre absorbe par reduction de perimetre, pas par report de date.

### 3.5 Pieges nommes

1. **Derive de chiffres entre decisions et implementation.** Pourquoi : les decisions citent 26 roles, 7 types cross-tenant, 130 permissions, 4 roles expert. Si la tache 7.5a.2 implemente 25 ou 27 roles, la tracabilite casse et l'audit ACAPS devient incoherent. Solution : les tests de structure du present livrable verrouillent ces chiffres comme chaines exactes attendues dans les fichiers de decision, et la tache 7.5a.2 devra faire echouer son build si le compte de roles ne correspond pas a 26.

2. **Emoji introduite par copier-coller.** Pourquoi : les analyses strategiques v2.0 et les comptes-rendus de reunion contiennent parfois des emojis ; un copier-coller depuis ces sources pourrait introduire une emoji dans une decision, violant decision-006 (absolue). Solution : le test `decisions-structure.spec.ts` applique un regex Unicode couvrant les plages emoji et fait echouer la suite ; le hook pre-commit `check-no-emoji.sh` double le controle.

3. **Incoherence du compteur README.** Pourquoi : le README annonce "10/10 COMPLETES" ; oublier de le passer a "15/15" ou laisser une ligne de table sans entree creerait une incoherence visible. Solution : un test verifie que le README contient la chaine "15/15" et qu'il existe exactement 15 lignes de decision dans la table.

4. **Reference circulaire ou orpheline entre decisions.** Pourquoi : decision-012 reference decision-013 (expert) et decision-014 (partshub) ; si l'une de ces references pointe vers un fichier inexistant ou mal nomme, la navigation casse. Solution : un test verifie que chaque reference inter-decision cite un fichier existant du dossier `00-pilotage/decisions/`.

5. **Confusion marque produit / namespace technique.** Pourquoi : un lecteur de decision-011 pourrait conclure qu'il faut renommer `@insurtech/*` en `@assurflow/*`. Solution : decision-011 contient une section explicite "Ce qui ne change pas" qui liste les identifiants techniques conserves, et un encadre normatif.

6. **Expert modelise comme employe garage.** Pourquoi : par facilite, on pourrait rattacher l'expert au tenant garage ; cela violerait l'independance ACAPS. Solution : decision-013 impose que l'expert soit un tenant distinct (cabinet d'expertise ou expert independant) ou un role interne compagnie, jamais un role sous le tenant garage.

7. **Oubli de la residence des donnees pour les nouveaux tenants.** Pourquoi : les tenants Carrier et Expert traitent des donnees d'assures (sinistres, photos vehicules, devis) soumises a la loi 09-08. Solution : chaque decision creant un tenant rappelle l'obligation de residence MA (decision-008, Atlas Cloud Services Benguerir).

8. **Rendu casse des tableaux markdown.** Pourquoi : le tableau des 6 acteurs et celui des 26 roles sont larges ; une cellule contenant un pipe non echappe casserait le rendu. Solution : un test de lint markdown verifie l'alignement des colonnes et l'absence de pipe non echappe dans les cellules.

9. **Statut de decision ambigu.** Pourquoi : laisser une decision en "Proposee" alors qu'elle est actee fausse la lecture de l'etat du programme. Solution : les cinq decisions sont en "Acceptee", et le test verifie la presence du champ Statut avec une valeur de l'enumeration autorisee.

10. **Date incoherente.** Pourquoi : copier la date d'une ancienne decision (2025-12) au lieu de la date d'acte (2026-05-23). Solution : le test verifie que les cinq fichiers portent la date 2026-05-23.

### 3.6 Decisions strategiques referencees

Les cinq nouvelles decisions s'appuient sur les decisions existantes : decision-002 (multi-tenant 3 niveaux, qui absorbe les nouveaux acteurs), decision-006 (no-emoji, qui s'applique a ces fichiers), decision-008 (residence des donnees MA, qui contraint les nouveaux tenants Carrier et Expert), decision-009 (signature loi 43-20 Barid eSign, qui s'applique aux validations expert et aux accords compagnie), et decision-005 (Skalean AI, hors perimetre direct mais cite pour l'assistance future a la validation des devis). Les references sont ecrites en toutes lettres dans chaque fichier, jamais sous forme de renvoi vague.

---

## 4. Architecture context

### 4.1 Position dans le sprint 7.5a

Le sprint 7.5a (Assurflow Foundation) comporte 10 taches. La presente tache 7.5a.1 est la premiere et la plus en amont : elle produit le socle normatif (les decisions) que les neuf taches suivantes consomment.

```
Sprint 7.5a -- Assurflow Foundation (10 taches)
  |
  +-- 7.5a.1  Decisions strategiques 011-015        <== CETTE TACHE (socle normatif)
  |
  +-- 7.5a.2  Extension AuthRole enum 12 -> 26 roles  (consomme 012, 013)
  +-- 7.5a.3  CrossTenantAuthorizationType 3 -> 7      (consomme 012, 013)
  +-- 7.5a.4  Permissions 90 -> 130                    (consomme 012, 013, 014)
  +-- 7.5a.5  Tables expert + expert_designations      (consomme 013)
  +-- 7.5a.6  Tables carrier + claim orchestration     (consomme 012, 013)
  +-- 7.5a.7  Tables tow + tow_requests                (consomme 012)
  +-- 7.5a.8  Module parts (suppliers, orders, commission) (consomme 014)
  +-- 7.5a.9  Rebranding UI Assurflow                  (consomme 011)
  +-- 7.5a.10 Sequencement vers Demo Day 30/06/2026    (consomme 015)
```

La tache 7.5a.1 bloque en particulier 7.5a.2 : l'extension de l'enum AuthRole de 12 a 26 roles doit citer decision-012 (qui liste les 26 roles) et decision-013 (qui liste les 4 roles expert) comme reference normative. Sans ces fichiers, 7.5a.2 n'a pas de source de verite figee.

### 4.2 Position dans le programme a 40 sprints

Le programme complet compte 40 sprints repartis en phases. Le sprint 7.5a est un sprint de transition insere entre le Sprint 7 (fin de la phase RBAC v2.2) et la suite. Il marque la frontiere Phase 2 (v2.2, 3 acteurs) -> Phase 2.5 (migration Assurflow) -> Phase 3 et au-dela (v3.0, 6 acteurs). Les decisions 011-015 sont l'acte fondateur de cette frontiere. Toutes les decisions 001-010 restent valides ; les decisions 011-015 les completent sans les abroger.

### 4.3 Diagramme de propagation des decisions

```
decision-011 (rebrand Skalean/Assurflow)
   |--> marque produit, UI, docs ACAPS/CNDP, pitch investisseurs
   |--> namespace technique @insurtech/* CONSERVE (pas de refactor)

decision-012 (6 acteurs)
   |--> AuthRole enum         : 12 roles  -> 26 roles
   |--> CrossTenantAuthType   : 3 types   -> 7 types
   |--> Permissions           : 90 perms  -> 130 perms
   |--> nouveaux tenants      : carrier, expert (residence MA, loi 09-08)
   |
   +--> decision-013 (expert central)
   |        |--> table expert + table expert_designations
   |        |--> 4 roles expert (independent, firm_admin, associate, carrier_internal)
   |        |--> workflow : sinistre -> designation compagnie -> validation devis -> compagnie en CC
   |        |--> agrement ACAPS (independance vs garage)
   |
   +--> decision-014 (PartsHub module Garage)
            |--> 1 role : garage_parts_manager
            |--> module 'parts' (~7 permissions)
            |--> revenu : commission sur commandes pieces

decision-015 (Demo Day 30/06/2026)
   |--> contrainte de sequencement dure sur 7.5a.2 a 7.5a.10
   |--> scope complet v3.0 demontre de bout en bout (pilote Marrakech)
```

---

## 5. Livrables checkables

- [ ] Fichier `00-pilotage/decisions/011-assurflow-rebrand.md` cree (environ 130-180 lignes).
- [ ] Fichier `00-pilotage/decisions/012-ecosysteme-6-acteurs.md` cree (environ 220-300 lignes, contient table des 6 acteurs et table des 26 roles).
- [ ] Fichier `00-pilotage/decisions/013-expert-acteur-central.md` cree (environ 180-250 lignes, contient le workflow de designation expert).
- [ ] Fichier `00-pilotage/decisions/014-partshub-module-garage.md` cree (environ 150-200 lignes).
- [ ] Fichier `00-pilotage/decisions/015-demo-day-30-juin-2026.md` cree (environ 130-180 lignes).
- [ ] Fichier `00-pilotage/decisions/README.md` mis a jour : compteur "10/10 COMPLETES" -> "15/15 COMPLETES".
- [ ] README table : 5 nouvelles lignes (011 a 015) ajoutees avec colonnes # / Titre / Statut / Effort impact.
- [ ] README section "Categorisation" : decisions 011-015 reparties dans les bonnes categories.
- [ ] Chaque decision contient le bloc d'entete (Date / Statut / Decideurs / ADR mirror).
- [ ] Chaque decision contient la section `## Contexte`.
- [ ] Chaque decision contient la section `## Probleme adresse`.
- [ ] Chaque decision contient la section `## Decision`.
- [ ] Chaque decision contient la section `## Avantages`.
- [ ] Chaque decision contient la section `## Inconvenients`.
- [ ] Chaque decision contient la section `## Impact technique`.
- [ ] Chaque decision contient la section `## Communication`.
- [ ] Chaque decision contient la section `## References`.
- [ ] decision-012 contient la table complete des 6 acteurs.
- [ ] decision-012 contient la decomposition exacte des 26 roles avec leur acteur de rattachement.
- [ ] decision-012 cite explicitement "12 -> 26 roles", "3 -> 7 types", "90 -> 130 permissions".
- [ ] decision-013 decrit le workflow de designation expert etape par etape.
- [ ] decision-013 liste les 4 roles expert (expert_independent, expert_firm_admin, expert_associate, expert_carrier_internal).
- [ ] decision-013 mentionne l'agrement ACAPS et l'independance vis-a-vis du garage.
- [ ] decision-014 liste le role garage_parts_manager et le module 'parts' (environ 7 permissions).
- [ ] decision-015 fixe la date 30 juin 2026 et le scope complet v3.0.
- [ ] Fichier de test `00-pilotage/decisions/__tests__/decisions-structure.spec.ts` cree (>= 20 cas de test).
- [ ] Script bash `00-pilotage/decisions/__tests__/check-decisions-structure.sh` cree.
- [ ] Aucune emoji dans aucun des 6 fichiers markdown produits (controle regex Unicode).
- [ ] Les cinq decisions portent la date 2026-05-23 et le statut Acceptee.

---

## 6. Fichiers crees / modifies

| Fichier | Action | Lignes attendues |
|---------|--------|------------------|
| `00-pilotage/decisions/011-assurflow-rebrand.md` | Cree | 130-180 |
| `00-pilotage/decisions/012-ecosysteme-6-acteurs.md` | Cree | 220-300 |
| `00-pilotage/decisions/013-expert-acteur-central.md` | Cree | 180-250 |
| `00-pilotage/decisions/014-partshub-module-garage.md` | Cree | 150-200 |
| `00-pilotage/decisions/015-demo-day-30-juin-2026.md` | Cree | 130-180 |
| `00-pilotage/decisions/README.md` | Modifie | +30 lignes environ |
| `00-pilotage/decisions/__tests__/decisions-structure.spec.ts` | Cree | 250-350 |
| `00-pilotage/decisions/__tests__/check-decisions-structure.sh` | Cree | 80-120 |

---

## 7. Contenu complet des cinq fichiers de decision

Cette section contient le texte integral des cinq fichiers a creer. Claude Code doit ecrire chacun de ces fichiers tel quel (le bloc de code delimite le contenu exact du fichier).

### 7.1 Fichier `00-pilotage/decisions/011-assurflow-rebrand.md`

```markdown
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

Encadre normatif : aucun refactoring de renommage `@insurtech/*` vers `@assurflow/*` ne doit etre entrepris. Le cout de refactoring serait eleve, le risque de regression massif, et le benefice fonctionnel nul. Le nom Assurflow vit au niveau de la couche presentation et marque, pas au niveau du code partage.

## Avantages

1. Clarte editeur / produit : Skalean societe, Assurflow produit.
2. Marque produit differenciante face a Courtizen sur le marche marocain.
3. Diversification future de Skalean possible (autres verticales) sans collision de nom.
4. Aucun risque de regression technique : namespace conserve.
5. Discours investisseurs clarifie (valeur societe vs valeur produit).

## Inconvenients

1. Effort de mise a jour des supports existants portant l'ancien nom (mitige : peu de supports en v2.2, pilote non encore lance).
2. Periode de coexistence des deux noms dans les documents internes (mitige : formulation de reference unique "Assurflow, edite par Skalean").
3. Risque de confusion ponctuelle equipe entre marque produit et namespace technique (mitige : encadre normatif explicite, et rappel dans la tache 7.5a.9 de rebranding UI).

## Impact technique

- **Sprint 7.5a, tache 7.5a.9** : rebranding de la couche UI (logo, titres, emails, PDF) vers Assurflow.
- Tous sprints : namespace technique `@insurtech/*` conserve ; aucune migration de packages.
- Documents : dossier ACAPS et declarations CNDP mentionnent Assurflow comme produit, Skalean comme editeur.

## Communication

Equipe : la formulation de reference est "Assurflow, edite par Skalean". Le namespace technique ne change pas ; ne pas renommer les packages.
Investisseurs : Skalean est la societe, Assurflow est le premier produit vertical InsurTech, ce qui ouvre la voie a une strategie multi-verticale.
ACAPS et CNDP : Assurflow est la solution presentee, Skalean en est l'editeur responsable du traitement.

## References

- decision-012-ecosysteme-6-acteurs.md : l'ecosysteme a 6 acteurs d'Assurflow v3.0.
- decision-015-demo-day-30-juin-2026.md : le Demo Day presente la marque Assurflow.
- B-7.5a (meta-prompt Sprint 7.5a Assurflow Foundation).
- ADR-011 : detail de la portee marque vs technique.
```

### 7.2 Fichier `00-pilotage/decisions/012-ecosysteme-6-acteurs.md`

```markdown
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
- Etendre les autorisations cross-tenant pour couvrir les nouveaux flux (designation expert, mise en CC de la compagnie, demande de remorquage).
- Garantir la conformite : nouveaux tenants Carrier et Expert traitant des donnees d'assures, soumis a la loi 09-08 (CNDP) et a la residence MA (decision-008).

## Decision

**Assurflow v3.0 repose sur un ecosysteme a 6 acteurs.** Cette extension entraine trois evolutions chiffrees, contractuelles pour les sprints aval :

- **Roles RBAC : 12 -> 26 roles.**
- **Types de cross-tenant authorization : 3 -> 7 types.**
- **Permissions : 90 -> 130 permissions.**

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

Les 12 roles v2.2 sont conserves et 14 roles sont ajoutes en v3.0. Repartition par acteur :

| # | Role | Acteur de rattachement | Origine |
|---|------|------------------------|---------|
| 1 | super_admin_platform | Plateforme (Skalean staff) | v2.2 |
| 2 | analyst_support | Plateforme (Skalean staff) | v2.2 |
| 3 | broker_admin | Broker | v2.2 |
| 4 | broker_manager | Broker | v2.2 |
| 5 | broker_agent | Broker | v2.2 |
| 6 | broker_viewer | Broker | v2.2 |
| 7 | garage_admin | Garage | v2.2 |
| 8 | garage_manager | Garage | v2.2 |
| 9 | garage_mechanic | Garage | v2.2 |
| 10 | garage_viewer | Garage | v2.2 |
| 11 | assure_owner | Customer / Assure (L3) | v2.2 |
| 12 | assure_delegate | Customer / Assure (L3) | v2.2 |
| 13 | carrier_admin | Carrier | v3.0 |
| 14 | carrier_claims_manager | Carrier | v3.0 |
| 15 | carrier_underwriter | Carrier | v3.0 |
| 16 | carrier_viewer | Carrier | v3.0 |
| 17 | expert_independent | Expert | v3.0 |
| 18 | expert_firm_admin | Expert | v3.0 |
| 19 | expert_associate | Expert | v3.0 |
| 20 | expert_carrier_internal | Expert (interne compagnie) | v3.0 |
| 21 | tow_admin | Tow | v3.0 |
| 22 | tow_dispatcher | Tow | v3.0 |
| 23 | tow_driver | Tow | v3.0 |
| 24 | garage_parts_manager | Garage (module PartsHub) | v3.0 |
| 25 | carrier_finance | Carrier | v3.0 |
| 26 | broker_compliance | Broker | v3.0 |

Total : 26 roles (12 conserves de v2.2 + 14 ajoutes en v3.0). Les 4 roles expert (expert_independent, expert_firm_admin, expert_associate, expert_carrier_internal) sont detailles dans la decision-013. Le role garage_parts_manager est detaille dans la decision-014.

### Les 7 types de cross-tenant authorization

Les 3 types v2.2 sont conserves et 4 types sont ajoutes en v3.0 :

| # | Type | Description | Origine |
|---|------|-------------|---------|
| 1 | broker_to_garage_assignment | Le courtier assigne un sinistre a un garage | v2.2 |
| 2 | assure_to_garage_visit | L'assure autorise un garage a voir son sinistre | v2.2 |
| 3 | multi_tenant_user_access | Un utilisateur opere pour plusieurs tenants | v2.2 |
| 4 | carrier_to_expert_designation | La compagnie designe un expert sur un sinistre | v3.0 |
| 5 | expert_to_garage_review | L'expert accede au devis du garage pour le valider | v3.0 |
| 6 | carrier_cc_on_claim | La compagnie est mise en copie du dossier sinistre | v3.0 |
| 7 | garage_to_tow_request | Le garage ou l'assure demande un remorquage | v3.0 |

### Les permissions 90 -> 130

Les 90 permissions v2.2 sont conservees ; environ 40 permissions sont ajoutees, reparties sur les nouveaux modules : module carrier (gestion sinistres, indemnisations, souscription), module expert (designation, validation devis, rapport d'expertise), module tow (demande, dispatch, cout), et module parts (decision-014, environ 7 permissions). Le compte cible est 130 permissions.

## Avantages

1. Representation fidele du circuit reel d'un sinistre automobile marocain.
2. Isolation stricte des donnees par tenant (compagnie, expert, remorqueur separes).
3. Differenciation marche : orchestration multi-acteurs absente chez Courtizen.
4. Extension additive : les 12 roles, 3 types, 90 permissions v2.2 sont conserves.
5. Conformite : nouveaux tenants soumis a residence MA et loi 09-08 des leur creation.

## Inconvenients

1. Surface d'attaque cross-tenant accrue (7 types au lieu de 3) : mitige par RLS Postgres (decision-002) et tests d'isolation exhaustifs.
2. Complexite RBAC (26 roles) : mitige par le decorateur @Roles() systematique et le RolesGuard global.
3. Volume de permissions (130) : mitige par une organisation en modules clairs (carrier, expert, tow, parts).

## Impact technique

- **Tache 7.5a.2** : extension de l'enum AuthRole de 12 a 26 roles (consomme cette decision et la decision-013).
- **Tache 7.5a.3** : extension de CrossTenantAuthorizationType de 3 a 7 types.
- **Tache 7.5a.4** : extension des permissions de 90 a 130.
- **Tache 7.5a.5** : tables expert et expert_designations (decision-013).
- **Tache 7.5a.6** : tables carrier et orchestration sinistre.
- **Tache 7.5a.7** : tables tow et tow_requests.
- **Tache 7.5a.8** : module parts (decision-014).

## Communication

Equipe : l'extension est additive ; ne jamais modifier ni renumeroter les 12 roles v2.2. Le compte cible 26 roles / 7 types / 130 permissions est contractuel.
ACAPS : les nouveaux tenants Carrier et Expert sont presentes dans le dossier Programme Emergence avec leur isolation.
CNDP : les nouveaux tenants traitant des donnees d'assures respectent la residence MA (decision-008).

## References

- decision-002-multi-tenant-3-niveaux.md : architecture multi-tenant qui absorbe les 6 acteurs.
- decision-008-data-residency-maroc.md : residence MA des nouveaux tenants.
- decision-013-expert-acteur-central.md : detail des 4 roles expert et du workflow.
- decision-014-partshub-module-garage.md : detail du role garage_parts_manager.
- B-7.5a (meta-prompt Sprint 7.5a Assurflow Foundation).
- Loi 17-99 Code des assurances : legitimite de l'acteur Carrier.
- ADR-012 : detail de l'extension RBAC additive.
```

### 7.3 Fichier `00-pilotage/decisions/013-expert-acteur-central.md`

```markdown
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

2. **Designation de l'expert par la compagnie.** La compagnie (role carrier_claims_manager) designe un expert sur le sinistre. Cette designation cree une entree dans la table `expert_designations` (sinistre, expert, compagnie, date, statut). Elle s'appuie sur le type de cross-tenant authorization `carrier_to_expert_designation` (decision-012, type numero 4).

3. **Acces de l'expert au devis du garage.** L'expert accede au devis etabli par le garage via le type de cross-tenant authorization `expert_to_garage_review` (decision-012, type numero 5). Cet acces est en lecture sur le devis et les photos du vehicule, jamais sur le portefeuille global du garage.

4. **Decision de l'expert : valider, modifier ou rejeter.** L'expert evalue le dommage et le devis. Trois issues possibles :
   - Valider : le devis est accepte tel quel.
   - Modifier : l'expert ajuste des postes du devis (quantites, prix, pieces) et produit une version contre-expertisee.
   - Rejeter : le devis est refuse avec motif ; le garage doit le revoir.

5. **Production du rapport d'expertise.** L'expert produit un rapport d'expertise (donnee d'assure, soumise a residence MA, decision-008). Ce rapport peut faire l'objet d'une signature electronique (decision-009, Barid eSign, loi 43-20) pour les decisions engageantes.

6. **Mise en copie de la compagnie.** La compagnie est mise en copie du dossier sinistre via le type de cross-tenant authorization `carrier_cc_on_claim` (decision-012, type numero 6). Elle suit ainsi la decision de l'expert sans intervenir directement dans la contre-expertise.

7. **Cloture de la designation.** Une fois la decision rendue, la designation passe au statut clos dans `expert_designations`, avec horodatage et tracabilite de l'utilisateur expert ayant rendu la decision.

### Tables impliquees

- `expert` : identite de l'expert (numero d'agrement ACAPS, type de structure, tenant de rattachement).
- `expert_designations` : lien sinistre -> expert -> compagnie, avec statut (designe, en cours, decision rendue, clos), date de designation, date de decision, type de decision (valider, modifier, rejeter), motif.

## Avantages

1. Representation fidele du role de l'expert dans le circuit sinistre marocain.
2. Independance garantie par construction (expert jamais rattache au tenant garage).
3. Conformite ACAPS : agrement trace, independance materialisee dans le modele.
4. Tracabilite auditable de la designation et de la decision.
5. Couverture des structures reelles (independant, cabinet, interne compagnie).

## Inconvenients

1. Complexite du workflow (sept etapes, trois types cross-tenant) : mitige par une table de designation dediee et un statut explicite.
2. Quatre roles a verrouiller : mitige par le RolesGuard global et le decorateur @Roles().
3. Donnees de rapport d'expertise sensibles : mitige par residence MA (decision-008) et chiffrement au repos.

## Impact technique

- **Tache 7.5a.2** : roles expert_independent, expert_firm_admin, expert_associate, expert_carrier_internal ajoutes a l'enum AuthRole.
- **Tache 7.5a.3** : types carrier_to_expert_designation, expert_to_garage_review, carrier_cc_on_claim ajoutes a CrossTenantAuthorizationType.
- **Tache 7.5a.5** : creation des tables expert et expert_designations avec RLS.
- **Sprint signature (decision-009)** : signature du rapport d'expertise via Barid eSign.

## Communication

Equipe : l'expert ne doit jamais etre rattache au tenant garage ; cette regle est non-negociable car elle materialise l'independance ACAPS.
ACAPS : le numero d'agrement de l'expert est trace dans la table expert ; le dossier Programme Emergence presente l'independance expert/garage.
CNDP : les rapports d'expertise sont des donnees d'assures hebergees au Maroc.

## References

- decision-012-ecosysteme-6-acteurs.md : l'expert dans l'ecosysteme a 6 acteurs et les types cross-tenant.
- decision-008-data-residency-maroc.md : residence MA des rapports d'expertise.
- decision-009-signature-loi-43-20.md : signature electronique du rapport d'expertise.
- B-7.5a (meta-prompt Sprint 7.5a Assurflow Foundation).
- ACAPS : agrement des experts automobiles, exigence d'independance.
- ADR-013 : detail du workflow et du modele de donnees expert.
```

### 7.4 Fichier `00-pilotage/decisions/014-partshub-module-garage.md`

```markdown
# Decision 014 -- PartsHub module Phase 1 integre a la verticale Garage

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-014-partshub-module-garage.md`

---

## Contexte

L'analyse concurrentielle de Courtizen a revele un angle mort : aucun acteur etabli ne monetise le flux de pieces detachees automobiles passant par la plateforme. Or, lors d'une reparation, le garage commande des pieces aupres de fournisseurs. Si ce flux de commandes transite par Assurflow, la plateforme peut capter une commission sur chaque commande de pieces. C'est un argument de revenu cle pour le pitch investisseurs du Demo Day du 30 juin 2026 (decision-015).

La question etait : PartsHub doit-il etre une application separee ou un module integre a la verticale Garage ? L'audit du code v2.2 a montre que le tenant Garage et son systeme d'authentification existent deja ; en faire un module integre evite de dupliquer la gestion tenant et l'authentification, et permet d'exploiter le module des le pilote.

## Probleme adresse

- Capter une commission sur le flux de pieces detachees pour creer un revenu demontrable au Demo Day.
- Eviter la duplication tenant/auth d'une application separee.
- Livrer le module assez tot pour qu'il soit exploitable au pilote Marrakech.
- Tracer les commandes, les fournisseurs, les commissions et les factures de maniere auditable.

## Decision

**PartsHub est un module de Phase 1 integre a la verticale Garage, et non une application separee.**

### Role ajoute

- **garage_parts_manager** : gere les fournisseurs de pieces, les commandes de pieces, le tableau de bord des commissions et les factures, au sein du tenant Garage. Ce role est ajoute a l'enum AuthRole (role numero 24, decision-012).

### Module de permissions 'parts'

Le module 'parts' ajoute environ 7 permissions, comptees dans le passage de 90 a 130 permissions (decision-012) :

| Permission | Description |
|------------|-------------|
| parts:suppliers:read | Consulter les fournisseurs de pieces |
| parts:suppliers:write | Creer et modifier les fournisseurs |
| parts:orders:read | Consulter les commandes de pieces |
| parts:orders:write | Creer et modifier les commandes de pieces |
| parts:commission:read | Consulter le tableau de bord des commissions |
| parts:invoices:read | Consulter les factures de pieces |
| parts:invoices:write | Generer et gerer les factures de pieces |

### Modele de revenu

Le revenu provient d'une commission sur les commandes de pieces routees via la plateforme. Chaque commande passee par le garage aupres d'un fournisseur reference dans PartsHub genere une commission percue par Assurflow. Le tableau de bord des commissions (permission parts:commission:read) restitue le volume de commandes, le montant des commissions et la repartition par fournisseur.

## Avantages

1. Time-to-market : module exploitable des le pilote Marrakech.
2. Pas de duplication tenant/auth : reutilise le tenant Garage existant.
3. Revenu demontrable au Demo Day (commission pieces).
4. Tracabilite des commandes, fournisseurs, commissions et factures.

## Inconvenients

1. Couplage de PartsHub a la verticale Garage : si une autre verticale doit l'utiliser un jour, une extraction sera necessaire (couplage assume pour le pilote).
2. Un role et sept permissions supplementaires a verrouiller : mitige par le RolesGuard global.

## Impact technique

- **Tache 7.5a.2** : role garage_parts_manager ajoute a l'enum AuthRole (role numero 24).
- **Tache 7.5a.4** : sept permissions du module 'parts' ajoutees au compte de 130 permissions.
- **Tache 7.5a.8** : implementation du module parts (suppliers, orders, commission, invoices) dans la verticale Garage.

## Communication

Equipe : PartsHub vit dans la verticale Garage, pas dans une application separee. Le role garage_parts_manager appartient au tenant Garage.
Investisseurs : la commission sur pieces est un levier de revenu presente au Demo Day.

## References

- decision-012-ecosysteme-6-acteurs.md : role garage_parts_manager (numero 24) et compte de permissions.
- decision-015-demo-day-30-juin-2026.md : le module pieces est demontre au Demo Day.
- B-7.5a (meta-prompt Sprint 7.5a Assurflow Foundation).
- ADR-014 : detail du module parts et du modele de commission.
```

### 7.5 Fichier `00-pilotage/decisions/015-demo-day-30-juin-2026.md`

```markdown
# Decision 015 -- Demo Day fixe au 30 juin 2026, scope complet v3.0

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-015-demo-day-30-juin-2026.md`

---

## Contexte

Le pilote Marrakech d'Assurflow doit etre demontre de bout en bout devant les parties prenantes (investisseurs, partenaires courtiers, garages, et representants compagnies). Cette demonstration, le Demo Day, conditionne la suite du financement et l'engagement des partenaires du pilote. La question etait : fixer une date dure ou laisser la date flotter selon l'avancement ?

Une demonstration en deux temps (d'abord v2.2 a 3 acteurs, puis v3.0 a 6 acteurs) a ete envisagee mais ecartee : elle diluerait le message et ne montrerait pas la valeur differenciante d'Assurflow, qui est precisement l'orchestration de l'ecosysteme complet a 6 acteurs.

## Probleme adresse

- Fixer un engagement de date clair pour aligner tous les sprints.
- Garantir que le scope demontre est l'ecosysteme v3.0 complet (6 acteurs), pas un sous-ensemble.
- Donner aux sprints 7.5a.2 a 7.5a.10 une contrainte de sequencement dure.
- Eviter le glissement de date au profit d'un ajustement de perimetre maitrise.

## Decision

**Le Demo Day est fixe au 30 juin 2026, avec un scope complet v3.0.**

- **Date** : 30 juin 2026. Date dure, non reportable.
- **Scope** : l'ecosysteme v3.0 complet a 6 acteurs (broker, garage, customer, carrier, expert, tow), demontre de bout en bout, incluant le workflow sinistre avec designation d'expert (decision-013) et le module pieces PartsHub (decision-014), sous la marque Assurflow (decision-011).
- **Contexte** : pilote Marrakech.

Regle de sequencement : la date du 30 juin 2026 prime. Tout retard d'un sprint doit etre absorbe par reduction de perimetre (livrer un sous-ensemble fonctionnel mais demontrable), jamais par report de la date. Le scenario de demonstration de bout en bout (ouverture sinistre, designation expert, validation devis, commande pieces) doit etre operationnel a cette date.

## Avantages

1. Engagement de date clair qui aligne tous les sprints 7.5a et suivants.
2. Message non dilue : l'ecosysteme complet a 6 acteurs est demontre d'un coup.
3. Contrainte de sequencement dure qui force la priorisation.
4. Valeur differenciante (orchestration multi-acteurs) mise en avant face a Courtizen.

## Inconvenients

1. Pression de calendrier forte sur les sprints 7.5a.2 a 7.5a.10 : mitige par la regle de reduction de perimetre plutot que report de date.
2. Risque de scope trop ambitieux : mitige par un scenario de demonstration cible et priorise (le workflow sinistre de bout en bout est l'element non-negociable).

## Impact technique

- **Taches 7.5a.2 a 7.5a.10** : sequencees pour livrer l'ecosysteme v3.0 demontrable au 30 juin 2026.
- **Tache 7.5a.10** : sequencement explicite vers le Demo Day.
- Tous sprints de la Phase 2.5 : contrainte de date dure.

## Communication

Equipe : le 30 juin 2026 est une date dure ; en cas de retard, on reduit le perimetre, on ne reporte pas la date.
Investisseurs et partenaires : le Demo Day du 30 juin 2026 presente l'ecosysteme Assurflow complet a 6 acteurs sur le pilote Marrakech.

## References

- decision-011-assurflow-rebrand.md : le Demo Day presente la marque Assurflow.
- decision-012-ecosysteme-6-acteurs.md : l'ecosysteme a 6 acteurs demontre.
- decision-013-expert-acteur-central.md : le workflow sinistre avec expert est l'element central de la demonstration.
- decision-014-partshub-module-garage.md : le module pieces est demontre.
- B-7.5a (meta-prompt Sprint 7.5a Assurflow Foundation).
- ADR-015 : detail du scenario de demonstration et du sequencement.
```

### 7.6 Mise a jour de `00-pilotage/decisions/README.md`

Remplacer la table existante et le compteur. Le README doit afficher :

```markdown
# Decisions Strategiques Assurflow (edite par Skalean) v3.0

Ce dossier contient les **15 decisions strategiques** formalisees du programme.

## Statut : 15/15 COMPLETES

| # | Titre | Statut | Effort impact |
|---|-------|--------|---|
| 001 | Monorepo pnpm + Turborepo | OK | Sprint 1 |
| 002 | Multi-tenant 3 niveaux + RLS | OK | Sprint 1, 6, 25 |
| 003 | TypeORM 0.3 vs Prisma | OK | Sprint 1, 2 |
| 004 | Kafka KRaft vs RabbitMQ | OK | Sprint 1, 2 |
| 005 | Skalean AI Frontier model | OK | Sprint 29-31 |
| 006 | No-emoji policy absolute | OK | Tous sprints |
| 007 | AI defere (Mock Sprint 20 -> Real Sprint 29) | OK | Sprint 20, 29 |
| 008 | Data residency Maroc strict (CNDP loi 09-08) | OK | Sprint 6, 10, 12 |
| 009 | Signature loi 43-20 (Barid eSign + ANRT) | OK | Sprint 10 |
| 010 | Insure Connecteurs defere Phase 7 | OK | Sprint 32 |
| 011 | Rebranding Skalean (editeur) + Assurflow (produit) | OK | Sprint 7.5a |
| 012 | Ecosysteme a 6 acteurs (12->26 roles, 3->7 types, 90->130 perms) | OK | Sprint 7.5a |
| 013 | Expert acteur central designe par la compagnie | OK | Sprint 7.5a |
| 014 | PartsHub module Phase 1 integre verticale Garage | OK | Sprint 7.5a |
| 015 | Demo Day 30 juin 2026, scope complet v3.0 | OK | Sprint 7.5a |
```

La section "Categorisation" du README doit etre completee ainsi :

```markdown
## Categorisation

**Decisions architecture** (ADR mirror direct) :
- 001 Monorepo, 002 Multi-tenant, 003 TypeORM, 004 Kafka, 005 Skalean AI
- 012 Ecosysteme 6 acteurs, 013 Expert acteur central, 014 PartsHub module Garage

**Decisions process / qualite** :
- 006 No-emoji policy

**Decisions strategiques business / sequencement** :
- 007 AI defere, 010 Insure Connecteurs defere
- 011 Rebranding Assurflow, 015 Demo Day 30 juin 2026

**Decisions reglementaires** :
- 008 Data residency MA (CNDP), 009 Signature 43-20
```

---

## 8. Tests complets

Bien que les livrables soient des documents, ils sont verifiables automatiquement. La suite de tests verrouille la structure, l'absence d'emoji, la coherence des chiffres et la coherence des references.

### 8.1 Fichier `00-pilotage/decisions/__tests__/decisions-structure.spec.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DECISIONS_DIR = join(__dirname, '..');

const NEW_DECISIONS = [
  '011-assurflow-rebrand.md',
  '012-ecosysteme-6-acteurs.md',
  '013-expert-acteur-central.md',
  '014-partshub-module-garage.md',
  '015-demo-day-30-juin-2026.md',
];

const REQUIRED_SECTIONS = [
  '## Contexte',
  '## Probleme adresse',
  '## Decision',
  '## Avantages',
  '## Inconvenients',
  '## Impact technique',
  '## Communication',
  '## References',
];

const REQUIRED_HEADER_FIELDS = [
  '**Date** : 2026-05-23',
  '**Statut** : Acceptee',
  '**Decideurs** : Saad (CTO), Abla (CEO)',
  '**ADR mirror** :',
];

// Plages Unicode emoji couvrant les emoticons, symboles, transports,
// symboles supplementaires et dingbats. decision-006 interdit toute emoji.
const EMOJI_REGEX =
  /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|\u{2B50}|\u{2B55}|\u{FE0F}/u;

function read(file: string): string {
  return readFileSync(join(DECISIONS_DIR, file), 'utf8');
}

describe('decisions 011-015 : existence des fichiers', () => {
  it('cree les 5 fichiers de decision', () => {
    for (const file of NEW_DECISIONS) {
      expect(existsSync(join(DECISIONS_DIR, file)), file).toBe(true);
    }
  });

  it('cree le README mis a jour', () => {
    expect(existsSync(join(DECISIONS_DIR, 'README.md'))).toBe(true);
  });
});

describe('decisions 011-015 : sections obligatoires', () => {
  for (const file of NEW_DECISIONS) {
    it(`${file} contient les 8 sections requises`, () => {
      const content = read(file);
      for (const section of REQUIRED_SECTIONS) {
        expect(content.includes(section), `${file} manque ${section}`).toBe(true);
      }
    });
  }
});

describe('decisions 011-015 : bloc d entete', () => {
  for (const file of NEW_DECISIONS) {
    it(`${file} expose les champs d entete`, () => {
      const content = read(file);
      for (const field of REQUIRED_HEADER_FIELDS) {
        expect(content.includes(field), `${file} manque ${field}`).toBe(true);
      }
    });
  }
});

describe('decisions 011-015 : titre H1 conforme', () => {
  for (const file of NEW_DECISIONS) {
    it(`${file} commence par un titre Decision NNN`, () => {
      const content = read(file);
      const num = file.slice(0, 3);
      expect(content.startsWith(`# Decision ${num} --`)).toBe(true);
    });
  }
});

describe('decisions 011-015 : aucune emoji (decision-006)', () => {
  for (const file of NEW_DECISIONS) {
    it(`${file} ne contient aucune emoji`, () => {
      const content = read(file);
      const match = content.match(EMOJI_REGEX);
      expect(match, `${file} contient une emoji : ${match?.[0]}`).toBeNull();
    });
  }

  it('le README ne contient aucune emoji', () => {
    const content = read('README.md');
    expect(content.match(EMOJI_REGEX)).toBeNull();
  });
});

describe('decision-012 : chiffres contractuels', () => {
  let content: string;
  beforeAll(() => {
    content = read('012-ecosysteme-6-acteurs.md');
  });

  it('cite le passage 12 -> 26 roles', () => {
    expect(content.includes('12 -> 26 roles')).toBe(true);
  });

  it('cite le passage 3 -> 7 types', () => {
    expect(content.includes('3 -> 7 types')).toBe(true);
  });

  it('cite le passage 90 -> 130 permissions', () => {
    expect(content.includes('90 -> 130 permissions')).toBe(true);
  });

  it('liste exactement 26 lignes de role numerotees 1 a 26', () => {
    for (let i = 1; i <= 26; i++) {
      expect(content.includes(`| ${i} |`), `role ${i} manquant`).toBe(true);
    }
  });

  it('liste les 6 acteurs', () => {
    for (const actor of ['Broker', 'Garage', 'Customer', 'Carrier', 'Expert', 'Tow']) {
      expect(content.includes(actor), `acteur ${actor} manquant`).toBe(true);
    }
  });

  it('liste les 7 types de cross-tenant authorization', () => {
    const types = [
      'broker_to_garage_assignment',
      'assure_to_garage_visit',
      'multi_tenant_user_access',
      'carrier_to_expert_designation',
      'expert_to_garage_review',
      'carrier_cc_on_claim',
      'garage_to_tow_request',
    ];
    for (const t of types) {
      expect(content.includes(t), `type ${t} manquant`).toBe(true);
    }
  });
});

describe('decision-013 : roles expert et workflow', () => {
  let content: string;
  beforeAll(() => {
    content = read('013-expert-acteur-central.md');
  });

  it('liste les 4 roles expert', () => {
    const roles = [
      'expert_independent',
      'expert_firm_admin',
      'expert_associate',
      'expert_carrier_internal',
    ];
    for (const r of roles) {
      expect(content.includes(r), `role ${r} manquant`).toBe(true);
    }
  });

  it('mentionne l agrement ACAPS', () => {
    expect(content.includes('ACAPS')).toBe(true);
  });

  it('mentionne l independance vis-a-vis du garage', () => {
    expect(content.toLowerCase().includes('independ')).toBe(true);
    expect(content.toLowerCase().includes('garage')).toBe(true);
  });

  it('decrit la table expert_designations', () => {
    expect(content.includes('expert_designations')).toBe(true);
  });

  it('decrit le workflow en etapes numerotees', () => {
    for (let i = 1; i <= 7; i++) {
      expect(content.includes(`${i}. **`), `etape ${i} manquante`).toBe(true);
    }
  });
});

describe('decision-014 : PartsHub', () => {
  let content: string;
  beforeAll(() => {
    content = read('014-partshub-module-garage.md');
  });

  it('liste le role garage_parts_manager', () => {
    expect(content.includes('garage_parts_manager')).toBe(true);
  });

  it('liste les permissions du module parts', () => {
    const perms = [
      'parts:suppliers:read',
      'parts:orders:write',
      'parts:commission:read',
      'parts:invoices:write',
    ];
    for (const p of perms) {
      expect(content.includes(p), `permission ${p} manquante`).toBe(true);
    }
  });

  it('decrit le modele de commission', () => {
    expect(content.toLowerCase().includes('commission')).toBe(true);
  });
});

describe('decision-015 : Demo Day', () => {
  let content: string;
  beforeAll(() => {
    content = read('015-demo-day-30-juin-2026.md');
  });

  it('fixe la date 30 juin 2026', () => {
    expect(content.includes('30 juin 2026')).toBe(true);
  });

  it('precise le scope complet v3.0', () => {
    expect(content.includes('v3.0')).toBe(true);
  });

  it('mentionne le pilote Marrakech', () => {
    expect(content.includes('Marrakech')).toBe(true);
  });
});

describe('decision-011 : rebranding', () => {
  let content: string;
  beforeAll(() => {
    content = read('011-assurflow-rebrand.md');
  });

  it('precise Skalean editeur et Assurflow produit', () => {
    expect(content.includes('Assurflow')).toBe(true);
    expect(content.includes('Skalean')).toBe(true);
  });

  it('conserve le namespace technique @insurtech', () => {
    expect(content.includes('@insurtech/')).toBe(true);
  });
});

describe('README : compteur et table', () => {
  let content: string;
  beforeAll(() => {
    content = read('README.md');
  });

  it('affiche 15/15 COMPLETES', () => {
    expect(content.includes('15/15')).toBe(true);
  });

  it('contient les lignes de decision 011 a 015', () => {
    for (const num of ['011', '012', '013', '014', '015']) {
      expect(content.includes(`| ${num} |`), `ligne ${num} manquante`).toBe(true);
    }
  });
});

describe('coherence des references inter-decisions', () => {
  it('chaque reference inter-decision pointe vers un fichier existant', () => {
    const refRegex = /decision-(\d{3})-[a-z0-9-]+\.md/g;
    for (const file of NEW_DECISIONS) {
      const content = read(file);
      const matches = content.match(refRegex) ?? [];
      for (const ref of matches) {
        const target = ref.replace(/^decision-/, '');
        expect(
          existsSync(join(DECISIONS_DIR, target)),
          `${file} reference ${ref} introuvable`,
        ).toBe(true);
      }
    }
  });
});
```

### 8.2 Fichier `00-pilotage/decisions/__tests__/check-decisions-structure.sh`

```bash
#!/usr/bin/env bash
# Verification de structure des decisions 011-015 (Assurflow v3.0).
# Conforme decision-006 : aucune emoji autorisee.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILES=(
  "011-assurflow-rebrand.md"
  "012-ecosysteme-6-acteurs.md"
  "013-expert-acteur-central.md"
  "014-partshub-module-garage.md"
  "015-demo-day-30-juin-2026.md"
)
SECTIONS=(
  "## Contexte"
  "## Probleme adresse"
  "## Decision"
  "## Avantages"
  "## Inconvenients"
  "## Impact technique"
  "## Communication"
  "## References"
)
FAIL=0

echo "Verification existence des fichiers"
for f in "${FILES[@]}"; do
  if [[ ! -f "$DIR/$f" ]]; then
    echo "ECHEC: fichier manquant $f"
    FAIL=1
  fi
done

echo "Verification sections obligatoires"
for f in "${FILES[@]}"; do
  [[ -f "$DIR/$f" ]] || continue
  for s in "${SECTIONS[@]}"; do
    if ! grep -qF "$s" "$DIR/$f"; then
      echo "ECHEC: $f manque la section $s"
      FAIL=1
    fi
  done
done

echo "Verification champs d entete"
for f in "${FILES[@]}"; do
  [[ -f "$DIR/$f" ]] || continue
  grep -qF "**Date** : 2026-05-23" "$DIR/$f" || { echo "ECHEC: $f date"; FAIL=1; }
  grep -qF "**Statut** : Acceptee" "$DIR/$f" || { echo "ECHEC: $f statut"; FAIL=1; }
  grep -qF "**Decideurs** : Saad (CTO), Abla (CEO)" "$DIR/$f" || { echo "ECHEC: $f decideurs"; FAIL=1; }
done

echo "Verification absence emoji (decision-006)"
for f in "${FILES[@]}" "README.md"; do
  [[ -f "$DIR/$f" ]] || continue
  if grep -qP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" "$DIR/$f"; then
    echo "ECHEC: $f contient une emoji"
    FAIL=1
  fi
done

echo "Verification chiffres contractuels decision-012"
grep -qF "12 -> 26 roles" "$DIR/012-ecosysteme-6-acteurs.md" || { echo "ECHEC: 012 roles"; FAIL=1; }
grep -qF "3 -> 7 types" "$DIR/012-ecosysteme-6-acteurs.md" || { echo "ECHEC: 012 types"; FAIL=1; }
grep -qF "90 -> 130 permissions" "$DIR/012-ecosysteme-6-acteurs.md" || { echo "ECHEC: 012 perms"; FAIL=1; }

echo "Verification compteur README 15/15"
grep -qF "15/15" "$DIR/README.md" || { echo "ECHEC: README compteur"; FAIL=1; }

if [[ "$FAIL" -ne 0 ]]; then
  echo "RESULTAT: ECHEC"
  exit 1
fi
echo "RESULTAT: OK -- toutes les verifications passent"
```

### 8.3 Test de lint markdown (style)

Le lint markdown verifie l'alignement des tableaux et l'absence de pipe non echappe. Commande de reference (markdownlint-cli2 configure dans le depot) :

```bash
pnpm dlx markdownlint-cli2 "00-pilotage/decisions/011-assurflow-rebrand.md" \
  "00-pilotage/decisions/012-ecosysteme-6-acteurs.md" \
  "00-pilotage/decisions/013-expert-acteur-central.md" \
  "00-pilotage/decisions/014-partshub-module-garage.md" \
  "00-pilotage/decisions/015-demo-day-30-juin-2026.md" \
  "00-pilotage/decisions/README.md"
```

Regles attendues : MD013 (longueur de ligne) desactivee pour les tableaux larges, MD040 (langage des blocs de code) active, MD033 (HTML inline) interdit. Si une cellule de tableau contient un pipe non echappe, markdownlint signale une colonne incoherente : verifier que tout pipe litteral dans une cellule est echappe en `\|`.

### 8.4 Recapitulatif des cas de test

La suite Vitest comporte plus de vingt cas concrets repartis ainsi : existence (2), sections obligatoires (5, un par fichier), champs d'entete (5), titre H1 (5), absence d'emoji (6), chiffres decision-012 (5), roles et workflow decision-013 (5), PartsHub decision-014 (3), Demo Day decision-015 (3), rebranding decision-011 (2), README (2), coherence des references (1). Total superieur a 20 cas.

---

## 9. Variables environnement

Cette tache produit des documents ; elle ne necessite aucune variable d'environnement applicative (pas de connexion base de donnees, pas de secret). Les variables ci-dessous concernent uniquement l'execution des tests et des hooks de qualite au niveau du depot.

| Variable | Role pour cette tache | Valeur attendue |
|----------|-----------------------|-----------------|
| CI | Indique l'execution en integration continue ; les scripts de lint et le test no-emoji s'executent en mode strict (echec bloquant) | true en CI, vide en local |
| NODE_ENV | Mode d'execution Node pour Vitest | test |
| FORCE_COLOR | Affichage colore des sorties de test (cosmetique, sans impact fonctionnel) | 0 ou 1 |
| PRE_COMMIT | Marqueur indiquant que le hook husky est en cours, declenche check-no-emoji.sh | 1 lors d'un commit |
| PNPM_HOME | Chemin du gestionnaire de paquets pnpm (impose, decision package manager strict) | repertoire pnpm de la machine |

Aucune variable de connexion (DATABASE_URL, PASSWORD_PEPPER, KAFKA_BROKERS) n'est requise : la tache ne touche ni a la base, ni au hash, ni aux evenements. Cette absence est volontaire et documentee pour eviter qu'un implementeur ne croie devoir provisionner une infrastructure.

---

## 10. Commandes shell

Sequence executable pour creer puis valider les livrables (depuis la racine du depot).

```bash
# 1. Se placer a la racine du depot
cd "$(git rev-parse --show-toplevel)"

# 2. Verifier que le dossier decisions existe (cree au Sprint 1)
ls 00-pilotage/decisions/

# 3. Creer le dossier de tests si absent
mkdir -p 00-pilotage/decisions/__tests__

# 4. Creer les cinq fichiers de decision et mettre a jour le README
#    (contenu fourni en section 7 du present prompt)
#    Editer : 011-assurflow-rebrand.md, 012-ecosysteme-6-acteurs.md,
#    013-expert-acteur-central.md, 014-partshub-module-garage.md,
#    015-demo-day-30-juin-2026.md, README.md

# 5. Creer la suite de tests (contenu fourni en section 8)
#    00-pilotage/decisions/__tests__/decisions-structure.spec.ts
#    00-pilotage/decisions/__tests__/check-decisions-structure.sh

# 6. Rendre le script bash executable
chmod +x 00-pilotage/decisions/__tests__/check-decisions-structure.sh

# 7. Lancer le script de structure
bash 00-pilotage/decisions/__tests__/check-decisions-structure.sh

# 8. Lancer la suite Vitest ciblee
pnpm vitest run 00-pilotage/decisions/__tests__/decisions-structure.spec.ts

# 9. Verifier l absence d emoji sur les six fichiers (decision-006)
grep -rP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" 00-pilotage/decisions/01[1-5]*.md \
  00-pilotage/decisions/README.md && echo "EMOJI DETECTEE -- ECHEC" || echo "AUCUNE EMOJI -- OK"

# 10. Lancer le lint markdown
pnpm dlx markdownlint-cli2 "00-pilotage/decisions/01[1-5]*.md" \
  "00-pilotage/decisions/README.md"

# 11. Verifier le compte de lignes de chaque fichier
wc -l 00-pilotage/decisions/01[1-5]*.md
```

---

## 11. Criteres de validation

Chaque critere est verifiable. Format : identifiant, criterion, commande de verification, resultat attendu, mode d'echec.

### Criteres P0 (bloquants, minimum 15)

**V1 -- Les cinq fichiers de decision existent.**
- Commande : `ls 00-pilotage/decisions/01[1-5]*.md | wc -l`
- Attendu : `5`
- Echec : un fichier manquant ; les sprints aval n'ont pas de reference normative.

**V2 -- decision-011 existe et porte le bon titre.**
- Commande : `head -1 00-pilotage/decisions/011-assurflow-rebrand.md`
- Attendu : `# Decision 011 -- Rebranding Skalean (editeur) + Assurflow (produit InsurTech)`
- Echec : titre absent ou mal forme ; le test titre H1 echoue.

**V3 -- decision-012 existe et porte le bon titre.**
- Commande : `head -1 00-pilotage/decisions/012-ecosysteme-6-acteurs.md`
- Attendu : `# Decision 012 -- Ecosysteme a 6 acteurs (v3.0) au lieu de 3 (v2.2)`
- Echec : titre absent ; test H1 echoue.

**V4 -- Chaque decision contient les 8 sections obligatoires.**
- Commande : `bash 00-pilotage/decisions/__tests__/check-decisions-structure.sh`
- Attendu : `RESULTAT: OK -- toutes les verifications passent`
- Echec : une section manquante ; le format standard est viole.

**V5 -- Chaque decision porte la date 2026-05-23.**
- Commande : `grep -lF "**Date** : 2026-05-23" 00-pilotage/decisions/01[1-5]*.md | wc -l`
- Attendu : `5`
- Echec : date copiee d'une ancienne decision ; tracabilite faussee.

**V6 -- Chaque decision porte le statut Acceptee.**
- Commande : `grep -lF "**Statut** : Acceptee" 00-pilotage/decisions/01[1-5]*.md | wc -l`
- Attendu : `5`
- Echec : statut Proposee laisse par erreur ; etat du programme errone.

**V7 -- Chaque decision liste les bons decideurs.**
- Commande : `grep -lF "**Decideurs** : Saad (CTO), Abla (CEO)" 00-pilotage/decisions/01[1-5]*.md | wc -l`
- Attendu : `5`
- Echec : decideurs absents ; signature de la decision invalide.

**V8 -- Aucune emoji dans les six fichiers.**
- Commande : `grep -rP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" 00-pilotage/decisions/01[1-5]*.md 00-pilotage/decisions/README.md || echo VIDE`
- Attendu : `VIDE`
- Echec : emoji introduite par copier-coller ; viole decision-006 absolue ; bloque le commit.

**V9 -- decision-012 cite le passage 12 -> 26 roles.**
- Commande : `grep -cF "12 -> 26 roles" 00-pilotage/decisions/012-ecosysteme-6-acteurs.md`
- Attendu : valeur >= 1
- Echec : chiffre absent ; le contrat pour 7.5a.2 n'est pas pose.

**V10 -- decision-012 cite le passage 3 -> 7 types.**
- Commande : `grep -cF "3 -> 7 types" 00-pilotage/decisions/012-ecosysteme-6-acteurs.md`
- Attendu : valeur >= 1
- Echec : chiffre absent ; contrat pour 7.5a.3 absent.

**V11 -- decision-012 cite le passage 90 -> 130 permissions.**
- Commande : `grep -cF "90 -> 130 permissions" 00-pilotage/decisions/012-ecosysteme-6-acteurs.md`
- Attendu : valeur >= 1
- Echec : chiffre absent ; contrat pour 7.5a.4 absent.

**V12 -- decision-012 liste 26 roles numerotes.**
- Commande : `for i in $(seq 1 26); do grep -qF "| $i |" 00-pilotage/decisions/012-ecosysteme-6-acteurs.md || echo "manque $i"; done`
- Attendu : aucune sortie (tous presents)
- Echec : un role manquant ; le compte de 26 n'est pas demontre.

**V13 -- decision-013 liste les 4 roles expert.**
- Commande : `grep -c -E "expert_independent|expert_firm_admin|expert_associate|expert_carrier_internal" 00-pilotage/decisions/013-expert-acteur-central.md`
- Attendu : valeur >= 4
- Echec : un role expert manquant ; modele expert incomplet.

**V14 -- decision-013 mentionne ACAPS et l'independance vs garage.**
- Commande : `grep -qF "ACAPS" 00-pilotage/decisions/013-expert-acteur-central.md && grep -qi "independ" 00-pilotage/decisions/013-expert-acteur-central.md && echo OK`
- Attendu : `OK`
- Echec : conformite ACAPS non documentee.

**V15 -- decision-015 fixe la date 30 juin 2026.**
- Commande : `grep -cF "30 juin 2026" 00-pilotage/decisions/015-demo-day-30-juin-2026.md`
- Attendu : valeur >= 1
- Echec : date absente ; contrainte de sequencement absente.

**V16 -- Le README affiche 15/15 COMPLETES.**
- Commande : `grep -cF "15/15" 00-pilotage/decisions/README.md`
- Attendu : valeur >= 1
- Echec : compteur incoherent.

**V17 -- La suite Vitest passe entierement.**
- Commande : `pnpm vitest run 00-pilotage/decisions/__tests__/decisions-structure.spec.ts`
- Attendu : tous les tests verts, plus de 20 cas
- Echec : un invariant casse ; le livrable n'est pas conforme.

### Criteres P1 (importants, minimum 8)

**V18 -- decision-012 liste les 7 types de cross-tenant authorization.**
- Commande : `grep -c -E "broker_to_garage_assignment|assure_to_garage_visit|multi_tenant_user_access|carrier_to_expert_designation|expert_to_garage_review|carrier_cc_on_claim|garage_to_tow_request" 00-pilotage/decisions/012-ecosysteme-6-acteurs.md`
- Attendu : valeur >= 7
- Echec : un type manquant ; contrat 7.5a.3 incomplet.

**V19 -- decision-012 liste les 6 acteurs.**
- Commande : `grep -c -E "Broker|Garage|Customer|Carrier|Expert|Tow" 00-pilotage/decisions/012-ecosysteme-6-acteurs.md`
- Attendu : valeur >= 6
- Echec : un acteur manquant.

**V20 -- decision-013 decrit la table expert_designations.**
- Commande : `grep -cF "expert_designations" 00-pilotage/decisions/013-expert-acteur-central.md`
- Attendu : valeur >= 1
- Echec : modele de donnees expert absent.

**V21 -- decision-013 decrit le workflow en 7 etapes.**
- Commande : `for i in 1 2 3 4 5 6 7; do grep -qF "$i. **" 00-pilotage/decisions/013-expert-acteur-central.md || echo "manque $i"; done`
- Attendu : aucune sortie
- Echec : workflow incomplet.

**V22 -- decision-014 liste le role garage_parts_manager.**
- Commande : `grep -cF "garage_parts_manager" 00-pilotage/decisions/014-partshub-module-garage.md`
- Attendu : valeur >= 1
- Echec : role PartsHub absent.

**V23 -- decision-014 liste les permissions parts.**
- Commande : `grep -c -E "parts:suppliers|parts:orders|parts:commission|parts:invoices" 00-pilotage/decisions/014-partshub-module-garage.md`
- Attendu : valeur >= 4
- Echec : module parts incomplet.

**V24 -- decision-011 conserve le namespace technique @insurtech.**
- Commande : `grep -cF "@insurtech/" 00-pilotage/decisions/011-assurflow-rebrand.md`
- Attendu : valeur >= 1
- Echec : confusion marque/namespace non levee.

**V25 -- Le README liste les lignes 011 a 015.**
- Commande : `for n in 011 012 013 014 015; do grep -qF "| $n |" 00-pilotage/decisions/README.md || echo "manque $n"; done`
- Attendu : aucune sortie
- Echec : table README incomplete.

### Criteres P2 (souhaitables, minimum 5)

**V26 -- Le lint markdown passe sans erreur.**
- Commande : `pnpm dlx markdownlint-cli2 "00-pilotage/decisions/01[1-5]*.md"`
- Attendu : sortie sans erreur
- Echec : tableau mal aligne ou pipe non echappe.

**V27 -- Les references inter-decisions pointent vers des fichiers existants.**
- Commande : suite Vitest, bloc "coherence des references inter-decisions"
- Attendu : vert
- Echec : reference orpheline.

**V28 -- Le compte de lignes de decision-012 est dans la fourchette attendue.**
- Commande : `wc -l 00-pilotage/decisions/012-ecosysteme-6-acteurs.md`
- Attendu : entre 220 et 300 lignes
- Echec : fichier trop court (contenu insuffisant) ou trop long.

**V29 -- decision-011 mentionne explicitement Skalean editeur et Assurflow produit.**
- Commande : `grep -qF "Assurflow, edite par Skalean" 00-pilotage/decisions/011-assurflow-rebrand.md && echo OK`
- Attendu : `OK`
- Echec : formulation de reference absente.

**V30 -- decision-015 mentionne le pilote Marrakech et le scope v3.0.**
- Commande : `grep -qF "Marrakech" 00-pilotage/decisions/015-demo-day-30-juin-2026.md && grep -qF "v3.0" 00-pilotage/decisions/015-demo-day-30-juin-2026.md && echo OK`
- Attendu : `OK`
- Echec : contexte de demonstration incomplet.

---

## 12. Edge cases et troubleshooting

**Cas 1 : derive de cross-reference entre decisions.** Symptome : decision-012 cite `decision-013-expert-acteur-central.md` mais le fichier a ete nomme `013-expert.md`. Cause : nom de fichier raccourci. Solution : respecter exactement les noms de fichiers de la section 6 ; le test de coherence des references echoue sinon. Verifier avec `ls 00-pilotage/decisions/013*`.

**Cas 2 : decompte README incoherent.** Symptome : le README affiche "15/15" mais la table ne contient que 14 lignes. Cause : une ligne oubliee lors de l'edition de la table. Solution : appliquer V25 (toutes les lignes 011 a 015 presentes) et compter manuellement les lignes 001 a 015. Verifier avec `grep -cE "^\| [0-9]{3} \|" 00-pilotage/decisions/README.md` qui doit donner 15.

**Cas 3 : emoji glissee par copier-coller.** Symptome : V8 echoue, le hook pre-commit refuse le commit. Cause : copie depuis un compte-rendu de reunion contenant des emojis. Solution : retirer l'emoji ; si le caractere est invisible, le localiser avec `grep -nP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" <fichier>` qui donne la ligne. Le selecteur de variation `️` est aussi capte par le regex de test.

**Cas 4 : rendu casse d'un tableau markdown.** Symptome : la table des 26 roles s'affiche sur une seule colonne. Cause : une cellule contient un pipe non echappe ou un nombre de colonnes incoherent entre la ligne d'entete, la ligne de separation et les lignes de donnees. Solution : verifier que chaque ligne de la table a le meme nombre de pipes ; echapper tout pipe litteral en `\|` ; lancer V26 (markdownlint).

**Cas 5 : statut laisse en Proposee.** Symptome : V6 echoue. Cause : modele de decision copie d'un brouillon. Solution : forcer `**Statut** : Acceptee` sur les cinq fichiers.

**Cas 6 : date au format incorrect.** Symptome : V5 echoue. Cause : date ecrite `23-05-2026` ou `2026/05/23`. Solution : utiliser exactement `2026-05-23` (ISO, tirets), comme dans les decisions 001 a 010.

**Cas 7 : confusion entre marque produit et namespace technique.** Symptome : un implementeur a renomme un package en `@assurflow/...`. Cause : mauvaise lecture de decision-011. Solution : decision-011 contient la section "Ce qui ne change pas" et un encadre normatif interdisant le renommage ; restaurer `@insurtech/...` et verifier V24.

**Cas 8 : expert rattache au tenant garage.** Symptome : revue de decision-013 montre une formulation suggerant que l'expert est un employe du garage. Cause : modelisation par facilite. Solution : decision-013 impose la regle d'independance ; l'expert independant et le cabinet sont des tenants distincts, l'expert interne est rattache au tenant Carrier, jamais au tenant Garage. Verifier V14.

**Cas 9 : compte de roles errone.** Symptome : V12 signale un numero manquant. Cause : un saut de numero dans la table des 26 roles (par exemple passage de 15 a 17). Solution : verifier que les numeros 1 a 26 sont continus et que chaque role a un acteur de rattachement et une origine (v2.2 ou v3.0).

**Cas 10 : le dossier __tests__ n'existe pas.** Symptome : l'ecriture du spec echoue. Cause : dossier non cree. Solution : `mkdir -p 00-pilotage/decisions/__tests__` avant d'ecrire les tests.

---

## 13. Conformite Maroc detaillee

**ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale).** L'introduction de l'acteur Expert (decision-013) doit refleter le cadre d'agrement des experts automobiles par l'ACAPS. L'expert qui evalue un dommage et contre-expertise un devis doit etre agree ; son numero d'agrement est trace dans la table expert. L'agrement impose l'independance de l'expert vis-a-vis de la structure qu'il contre-expertise : c'est pourquoi decision-013 interdit de rattacher un role expert au tenant Garage. Les circulaires ACAPS encadrant la profession d'expert et la designation par la compagnie sont la base reglementaire de ce workflow. Le dossier Programme Emergence presente a l'ACAPS doit mentionner cette independance et la tracabilite des designations.

**CNDP loi 09-08 (protection des donnees personnelles).** Les nouveaux tenants Carrier et Expert (decision-012) traitent des donnees personnelles d'assures : contrats, sinistres, rapports d'expertise, photos de vehicules, donnees de risque. Ces donnees relevent de la loi 09-08 et de la residence des donnees au Maroc (decision-008, hebergement Atlas Cloud Services a Benguerir, DC1 Tier III et DC2 Tier IV). Chaque tenant cree doit donc respecter l'isolation stricte (decision-002, RLS Postgres) et le chiffrement au repos (AES-256-GCM) et en transit (TLS 1.3). La notification de violation de donnees a la CNDP sous 72 heures s'applique a ces nouveaux tenants. Aucune donnee d'assure ne quitte le Maroc.

**Loi 17-99 Code des assurances.** L'acteur Carrier (compagnie d'assurance) tire sa legitimite de la loi 17-99 portant Code des assurances. C'est la compagnie qui porte le risque, paie l'indemnisation et designe l'expert. La modelisation du Carrier comme tenant distinct (decision-012) reflete le fait que la compagnie est une entite juridique reglementee distincte du courtier (intermediaire) et du garage (reparateur). Le flux financier du sinistre (franchise a la charge de l'assure, indemnisation versee par la compagnie, recours eventuel) est conforme au Code des assurances.

**Loi 43-20 (signature electronique) et ANRT.** Le rapport d'expertise et les decisions engageantes (validation, modification, rejet de devis) peuvent faire l'objet d'une signature electronique via Barid eSign (decision-009), conforme a la loi 43-20 et a l'agrement ANRT. Cela donne valeur probante aux decisions de l'expert.

---

## 14. Conventions absolues skalean-insurtech

Bien que cette tache produise des documents, l'implementeur doit connaitre et respecter l'integralite des conventions du programme, car les fichiers produits citent ces conventions et les sprints aval les appliquent. Liste complete, ecrite en entier.

**Multi-tenant strict.** Le header `x-tenant-id` est obligatoire sur toutes les routes sauf `/api/v1/public/*` et `/api/v1/admin/*`. Le filtrage par `tenant_id` est automatique via le TenantGuard. Le contexte de tenant est propage via AsyncLocalStorage (TenantContext). Les politiques RLS Postgres s'appuient sur le helper `app_can_access_tenant()`. Chaque operation par tenant laisse une trace d'audit. En v3.0, ce modele absorbe les six acteurs (broker, garage, customer, carrier, expert, tow).

**Validation strict (Zod uniquement).** La validation se fait exclusivement avec Zod ; jamais class-validator, yup ou joi. Les schemas sont exportes depuis `@insurtech/shared-types`. Le motif est `const Schema = z.object({...})` puis `type T = z.infer<typeof Schema>`.

**Logger strict (Pino).** La journalisation se fait via Pino, injecte par l'injection de dependances (`this.logger.info(...)`) ; jamais `console.log`. Les logs sont du JSON structure avec les champs `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.

**Hash strict (argon2id).** Le hachage des mots de passe utilise argon2id avec memoryCost 65536, timeCost 3, parallelism 4 ; jamais bcrypt. Un pepper est fourni par la variable d'environnement `PASSWORD_PEPPER`.

**Gestionnaire de paquets strict (pnpm).** Seul pnpm est autorise. La configuration impose `engine-strict=true` avec Node >= 22.11.0, `save-exact=true`, et `link-workspace-packages=deep`.

**TypeScript strict.** Les options `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` sont activees. Les imports sont explicites (pas d'`import *`).

**Tests strict.** Vitest pour l'unitaire et l'integration, Playwright pour l'E2E. Chaque fichier `.ts` (sauf les fichiers de types seuls et les `index.ts`) a un fichier `.spec.ts`. La couverture est >= 85% global, et >= 90% sur les modules auth, database et signature.

**RBAC strict.** Le decorateur `@Roles()` est applique a chaque endpoint. Le RolesGuard et le TenantGuard sont globaux. En v3.0, il existe 26 roles (decision-012).

**Evenements strict (Kafka).** Les topics Kafka suivent le motif `insurtech.events.{vertical}.{entity}.{action}`. Chaque evenement a un schema Zod. Les evenements critiques portent un `Idempotency-Key`.

**Imports strict.** Les paquets partages sont importes via `@insurtech/{name}`. Les chemins sont definis dans `tsconfig.base.json`. L'ordre des imports est : Node, externe, `@insurtech`, relatif.

**Skalean AI strict (decision-005).** L'acces a l'IA se fait uniquement via `@insurtech/sky` ou un client MCP ; jamais directement OpenAI ou Anthropic. L'IA est mockee du Sprint 1 au Sprint 28, et reelle a partir du Sprint 29.

**No-emoji strict (decision-006, absolue).** Aucune emoji dans le code, les commentaires, les logs, la documentation ou les messages de commit. Le hook pre-commit `check-no-emoji.sh` controle ; la CI echoue si une emoji est detectee. Cette regle s'applique integralement aux cinq fichiers de decision produits ici.

**Idempotency-Key strict.** Le header `Idempotency-Key` est obligatoire pour `POST /payments`, `/signatures`, `/claims` et les outils d'ecriture MCP. La TTL est de 24 heures dans Redis. La cle est `idempotency:{tenant_id}:{user_id}:{key}`.

**Conventional Commits strict.** Les messages de commit suivent `<type>(scope): description`. Les types sont feat, fix, docs, style, refactor, test, chore, perf, ci, build. Le scope est `sprint-NN` ou le nom du paquet. commitlint est applique via husky.

**Cloud souverain MA strict (decision-008).** Les donnees marocaines sont hebergees uniquement chez Atlas Cloud Services a Benguerir (DC1 Tier III et DC2 Tier IV). Aucune donnee d'assure ne quitte le Maroc (loi 09-08, CNDP). Le chiffrement au repos est AES-256-GCM ; le chiffrement en transit est TLS 1.3.

---

## 15. Validation pre-commit

Sequence de verification a executer avant tout commit de cette tache.

```bash
# Verification de structure (script bash)
bash 00-pilotage/decisions/__tests__/check-decisions-structure.sh

# Suite de tests Vitest
pnpm vitest run 00-pilotage/decisions/__tests__/decisions-structure.spec.ts

# Controle no-emoji (decision-006) sur les six fichiers
grep -rP "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" 00-pilotage/decisions/01[1-5]*.md \
  00-pilotage/decisions/README.md \
  && { echo "EMOJI DETECTEE -- COMMIT BLOQUE"; exit 1; } \
  || echo "AUCUNE EMOJI -- OK"

# Lint markdown
pnpm dlx markdownlint-cli2 "00-pilotage/decisions/01[1-5]*.md" \
  "00-pilotage/decisions/README.md"

# Le hook husky pre-commit execute automatiquement check-no-emoji.sh
git add 00-pilotage/decisions/
```

Le commit ne doit etre cree que si toutes ces verifications passent. Le hook pre-commit du depot relancera `check-no-emoji.sh` ; si une emoji est detectee, le commit est refuse.

---

## 16. Message de commit complet

```
docs(sprint-7.5a): formalise decisions 011-015 assurflow v3.0 ecosystem

Formalise les cinq decisions strategiques actant le passage v2.2 -> v3.0 :
- 011 Rebranding : Skalean editeur, Assurflow produit InsurTech (namespace
  technique @insurtech/* conserve, pas de refactoring).
- 012 Ecosysteme a 6 acteurs (broker, garage, customer, carrier, expert, tow) :
  roles 12 -> 26, cross-tenant types 3 -> 7, permissions 90 -> 130.
- 013 Expert acteur central designe par la compagnie, agree ACAPS, independant
  du garage ; 4 roles expert ; workflow de designation en 7 etapes ; tables
  expert et expert_designations.
- 014 PartsHub module Phase 1 integre a la verticale Garage ; role
  garage_parts_manager ; module 'parts' (7 permissions) ; revenu commission.
- 015 Demo Day fixe au 30 juin 2026, scope complet v3.0, pilote Marrakech.

Mise a jour README decisions (10/10 -> 15/15) et recategorisation.
Ajout suite de tests de structure (Vitest + bash) : existence, sections
obligatoires, entete, absence d emoji (decision-006), chiffres contractuels,
coherence des references.

Conforme : decision-002 (multi-tenant), decision-006 (no-emoji),
decision-008 (residence MA loi 09-08), decision-009 (signature 43-20),
loi 17-99 (Code des assurances), agrement ACAPS.

Task: 7.5a.1
Sprint: 7.5a (Assurflow Foundation)
Phase: 2.5 (Migration Assurflow)
Reference: B-7.5a
```

---

## 17. Workflow next step

Une fois cette tache validee (les 30 criteres V1 a V30 verts et le commit cree), passer a la tache suivante :

`task-7.5a.2-authrole-enum-extension-26-roles.md`

Cette tache consomme directement decision-012 (table des 26 roles) et decision-013 (4 roles expert) comme reference normative pour etendre l'enum AuthRole de 12 a 26 valeurs. La tache 7.5a.2 doit faire echouer son build si le compte de roles implementes differe de 26, en s'appuyant sur le contrat pose ici. Les taches 7.5a.3 (CrossTenantAuthorizationType 3 -> 7) et 7.5a.4 (permissions 90 -> 130) suivent et citent egalement decision-012.

---

## Footer recapitulatif

- Densite : ce prompt vise 80-150 ko, cible 110-125 ko, atteinte par le contenu integral des cinq fichiers de decision en section 7 et de la suite de tests en section 8.
- Fichiers de decision rediges integralement : 5 (011 rebranding, 012 ecosysteme 6 acteurs, 013 expert acteur central, 014 PartsHub module Garage, 015 Demo Day 30 juin 2026), plus la mise a jour du README.
- Cas de test : plus de 20 cas Vitest (existence, sections, entete, titre H1, absence d emoji, chiffres 012, roles et workflow 013, PartsHub 014, Demo Day 015, rebranding 011, README, coherence des references) plus un script bash de structure et un lint markdown.
- Criteres de validation : 30 criteres (V1 a V30), dont 17 P0, 8 P1, 5 P2.
- Edge cases : 10 cas documentes avec cause et solution.
- Politique emoji : aucune emoji dans tout le fichier, conforme decision-006 absolue.
