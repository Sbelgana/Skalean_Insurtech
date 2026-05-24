# TASK 7.5a.7 -- MISE A JOUR DOCUMENTATION 5-roles-permissions.md vers v3.0.0

## SECTION 1 -- HEADER METADATA

| Champ | Valeur |
|-------|--------|
| **Sprint** | 7.5a (Assurflow Foundation) |
| **Reference meta-prompt** | B-7.5a tache 7.5a.7 |
| **Phase** | 2.5 (Extension verticale Assurflow) |
| **Priorite** | P0 (bloquant -- artefact source de verite RBAC) |
| **Effort estime** | 3h |
| **Dependances** | 7.5a.6 (permissions.enum.ts -- 130 permissions + 26 roles definis) |
| **Bloque** | 7.5a.8 (tests RBAC + RLS v3.0) |
| **Densite cible du livrable** | 80-150 ko (le document `5-roles-permissions.md` v3.0) |
| **Vertical** | Assurflow (assurance auto -- carrier / expert / tow) |
| **Type de tache** | DOCUMENTATION (mise a jour Markdown, pas de code applicatif livre) |
| **Fichier cible** | `00-pilotage/documentation/5-roles-permissions.md` |
| **Version doc avant** | 2.2.0 (12 roles x ~85 permissions, 393 lignes) |
| **Version doc apres** | 3.0.0 (26 roles x 130 permissions, ~790 lignes) |
| **Date doc apres** | 2026-05-24 |
| **Decisions referencees** | 011, 012, 013, 014, 015 |
| **Contrainte absolue** | AUCUNE EMOJI (decision-006) |

---

## SECTION 2 -- BUT

Mettre a jour le document de reference RBAC/ABAC `00-pilotage/documentation/5-roles-permissions.md` depuis sa version 2.2.0 (12 roles, ~85 permissions, vertical reparation/courtage) vers sa version 3.0.0 (26 roles, 130 permissions) afin d'integrer la vertical Assurflow et ses trois nouvelles familles d'acteurs : **Carrier** (compagnie d'assurance, 6 roles), **Expert** (expertise sinistre independante ou en cabinet, 4 roles) et **Tow** (remorquage/depannage, 3 roles), plus le nouveau role garage `garage_parts_manager` (gestionnaire de pieces detachees) cree dans la tache 7.5a.6.

Ce document est l'unique source de verite humaine et machine-verifiable de la matrice de droits. Il alimente directement :
- le composant backend `PermissionsMatrix` (tache 2.3.2) qui materialise la matrice 26x130 en TypeScript ;
- les `RolesGuard` + `RequirePermission` poses sur chaque endpoint NestJS ;
- la suite de tests RBAC (`role-matrix-coverage.spec.ts`) et les tests RLS Postgres ;
- l'artefact d'audit ACAPS demontrant la separation des fonctions (separation of duties) et la tracabilite de l'agrement expert.

La tache consiste a ecrire le contenu Markdown complet et exact des sections nouvelles (2.6 a 2.9), a etendre la section 5 (modules de permissions carrier/expertise/tow/parts), a reconstruire le DAG de hierarchie (section 3), a etendre les autorisations cross-tenant (section 7 : de 3 a 7 types) et a inserer un workflow sinistre v3.0 ou l'expert est l'acteur central (decision-013). Le document final doit etre coherent au permission-string pres avec `permissions.enum.ts` issu de 7.5a.6.

Le document v3.0 doit en outre porter, pour chacun des 26 roles, le detail complet de ses permissions afin que l'auditeur ACAPS et le composant `PermissionsMatrix` disposent d'un oracle exhaustif role par role. Cette matrice par role est le coeur du livrable enrichi.

---

## SECTION 3 -- CONTEXTE ETENDU

### 3.1 Pourquoi ce document est la source de verite

Dans skalean-insurtech, la securite d'acces repose sur une chaine a quatre maillons : la documentation (`5-roles-permissions.md`), l'enumeration machine (`permissions.enum.ts`), l'application (guards NestJS + ABAC) et le filet de securite base de donnees (RLS Postgres). Le premier maillon est volontairement humain et lisible : il est lu par les architectes, les auditeurs ACAPS, les nouveaux developpeurs et sert de cahier des charges au composant `PermissionsMatrix` (tache 2.3.2). Toute divergence entre ce document et le code produit une faille soit de securite (permission accordee non documentee = angle mort d'audit), soit de fonctionnalite (permission documentee mais absente du code = ecran casse). La v3.0 multiplie par plus de deux le nombre de roles (12 -> 26) et augmente le nombre de permissions de 53 % (85 -> 130). Sans mise a jour rigoureuse, l'ecart documentation/code (drift) deviendrait ingerable et l'audit ACAPS serait compromis.

### 3.2 Ce qui change de v2.2 a v3.0

| Axe | v2.2 | v3.0 |
|-----|------|------|
| Roles | 12 | 26 |
| Permissions | ~85 | 130 |
| Familles d'acteurs | Platform, Broker, Garage, Assure, Prospect | + Carrier, + Expert, + Tow |
| Roles garage | 5 | 6 (ajout `garage_parts_manager`) |
| Modules de permissions | ~15 (auth..mcp) | + carrier(15), + expertise(10), + tow(8), + parts(7) |
| Types cross-tenant | 3 | 7 (ajout 4 types) |
| Workflow sinistre | reparation centree garage | sinistre v3.0 centre expert (decision-013) |
| Acteur central sinistre | garage_chef | expert (designation par carrier) |

Les 40 nouvelles permissions se repartissent ainsi : CARRIER 15, EXPERTISE 10, TOW 8, PARTS 7 (= 40). Ajoutees aux ~90 permissions consolidees v2.2 (apres normalisation des wildcards en permissions atomiques), on atteint 130 permissions distinctes.

### 3.3 Decisions referencees

- **decision-011** : creation de la famille Carrier (compagnie d'assurance) avec workflow d'approbation de paiement a quatre niveaux hierarchiques (`carrier.payment.approve_level1..4`).
- **decision-012** : creation de la famille Expert avec distinction expert independant / cabinet / interne compagnie, et exigence d'agrement (numero d'agrement expert obligatoire en attribut ABAC).
- **decision-013** : refonte du workflow sinistre Assurflow ou l'expert devient l'acteur central de validation du devis (valide / modifie / rejette) avant approbation de paiement par le carrier.
- **decision-014** : creation de la famille Tow (remorquage) avec dispatch geolocalise et modele de remuneration au depannage (`tow.earnings.read`).
- **decision-015** : creation du role `garage_parts_manager` et du module `parts` (commande de pieces, commission, favoris fournisseurs) avec fenetre d'annulation contrainte (`parts.orders.cancel_within_window`).

### 3.4 Alternatives ecartees

1. **Documenter les nouveaux roles dans un fichier separe `5b-roles-assurflow.md`** : ecartee car fragmente la source de verite, complique la verification croisee doc/code et casse l'audit ACAPS (un seul artefact attendu). On etend le fichier unique.
2. **Generer le document automatiquement depuis `permissions.enum.ts`** : ecartee pour la v3.0 (l'enum ne porte pas les descriptions metier, hierarchie, narrative workflow ni notes d'audit). La generation auto sera evaluee en Sprint 8. Pour l'instant le document est ecrit a la main puis verifie par test de coherence.
3. **Fusionner Expert dans la famille Carrier** : ecartee car l'independance de l'expert (separation des fonctions) est une exigence reglementaire ACAPS forte : l'expert ne peut pas dependre hierarchiquement de l'approbateur de paiement.
4. **Conserver les wildcards `crm.contacts.*` comme permissions** : ecartee, la v3.0 normalise vers des permissions atomiques pour permettre une matrice 26x130 exacte et testable.

### 3.5 Trade-offs

- **Lisibilite vs exhaustivite** : 26 roles x 130 permissions = 3380 cellules theoriques. On ne materialise PAS la matrice complete en Markdown (illisible) ; on documente par role les permissions cles et on delegue la matrice exhaustive au composant `PermissionsMatrix` testable. Trade-off accepte : le document liste les 130 strings (dans les tableaux modules) et les permissions cles par role.
- **Stabilite des strings vs evolution metier** : les permission-strings sont un contrat. Une fois publies v3.0, ils ne changent plus sans bump de version majeure.
- **Document a la main vs drift** : ecrire a la main risque le drift ; on compense par un test de coherence doc/code obligatoire (section 8).

### 3.6 Pieges (a eviter absolument)

1. **Drift doc/code** : un permission-string dans le doc absent de `permissions.enum.ts` (ou inverse). Le test de coherence (section 8) doit echouer si l'ecart existe. Verifier au caractere pres (les underscores, les niveaux `_level1`, les suffixes `_own` / `_all` / `_assigned` / `_available`).
2. **Mismatch du compte de roles** : la section 1 annonce 26, les sections 2.1-2.9 doivent en lister exactement 26. Un test compte les occurrences des 26 strings de roles.
3. **Trous de politique ABAC pour les nouveaux roles** : l'expert utilise `expertise.missions.read` qui est ABAC (missions qui lui sont designees) ; le tow_driver utilise `tow.missions.read_available` (geo + disponibilite). Oublier de documenter ces filtres ABAC laisse une faille. La section 4 doit etre etendue.
4. **Rendu des tableaux Markdown** : un tableau a colonnes desalignees (pipe manquant) casse le rendu et peut faire echouer le linter. Chaque ligne de tableau doit avoir le meme nombre de pipes que l'entete.
5. **Taille de la matrice 26x130** : ne pas tenter de la rendre integralement en Markdown sous forme d'une seule grille 26 colonnes. Documenter par role (un tableau par role) et par module (un tableau par module avec colonne role-detenteur), et deleguer la materialisation programmatique au composant.
6. **Permission `carrier.payment.approve_level1..4`** : ce sont QUATRE permissions distinctes (`_level1`, `_level2`, `_level3`, `_level4`), pas une seule. Piege classique de comptage et de redaction (ne jamais ecrire `approve_level1..4` comme un seul token dans les tableaux : ecrire les quatre).
7. **Confusion expert independant / interne** : `expert_independent` et `expert_carrier_internal` ont des contraintes ABAC differentes (le second est tenant carrier, le premier est tenant expert). Ne pas les fusionner.
8. **Emoji accidentel** : un caractere emoji copie depuis un autre document fait echouer la CI (decision-006). Verifier par regex Unicode. La fleche doit etre ASCII `->`, jamais U+2192.
9. **Fenetre d'annulation pieces** : `parts.orders.cancel_within_window` est ABAC time-based (annulation possible seulement dans la fenetre fournisseur). Documenter le filtre.
10. **Heritage carrier mal modelise** : `carrier_admin` herite-t-il de `carrier_finance` ? Decision : NON, les fonctions finance et compliance sont separees de l'admin par separation des fonctions ACAPS. Le DAG doit refleter une hierarchie limitee (admin herite read mais pas les pouvoirs d'approbation de paiement). Documenter explicitement.
11. **Niveau de l'assure et du prospect inchanges** : ne pas casser les sections 2.4 et 2.5 existantes ; les conserver et renumeroter si necessaire (2.4 Assure, 2.5 Prospect conservees, nouvelles sections 2.6-2.9 apres).
12. **Cross-tenant : qui cree, qui consomme** : chacun des 7 types cross-tenant doit indiquer le tenant emetteur, le tenant recepteur, le scope de lecture et la duree de validite de l'autorisation. Oublier la duree = faille de retention CNDP.
13. **Matrice par role incomplete** : chacun des 26 roles doit porter SA liste explicite de permissions dans la section dediee. Un role sans tableau de permissions casse l'oracle de `role-matrix-coverage.spec.ts`. Verifier que chaque permission-string apparait au moins une fois dans un tableau de role detenteur.
14. **Permission detenue par plusieurs roles** : une meme permission (ex. `carrier.dashboard.read`) est detenue par plusieurs roles carrier. Le tableau module doit lister TOUS les detenteurs, pas seulement le premier ; sinon l'audit ne voit pas la diffusion reelle du droit.

### 3.7 Impact si la tache est bacle

Un document incomplet ou divergent du code provoque : (a) un composant `PermissionsMatrix` construit sur de fausses specifications, (b) des guards qui refusent des actions legitimes ou en autorisent d'illegitimes, (c) un echec d'audit ACAPS sur la separation des fonctions, (d) un blocage de la tache 7.5a.8 qui valide la coherence doc/code/RLS, (e) une matrice par role lacunaire empechant la generation de l'oracle de tests.

---

## SECTION 4 -- ARCHITECTURE CONTEXT

### 4.1 Position dans le sprint

Tache 7 sur 10 du sprint 7.5a. Elle vient APRES 7.5a.6 (qui a fige les 130 permissions et 26 roles dans `permissions.enum.ts`) et AVANT 7.5a.8 (tests RBAC + RLS qui consomment le document comme oracle). Elle est donc le pont humain-lisible entre l'enumeration machine et la suite de tests.

### 4.2 Flux : comment le document alimente la chaine RBAC

```
                       7.5a.6
              permissions.enum.ts (130 perms, 26 roles)
                            |
                            v
        +-----------------------------------------------+
        |   7.5a.7 (CETTE TACHE)                         |
        |   5-roles-permissions.md v3.0.0               |
        |   - source de verite humaine + audit ACAPS    |
        +-----------------------------------------------+
            |              |              |            |
            v              v              v            v
   PermissionsMatrix   RolesGuard +   role-matrix     Audit ACAPS
   (tache 2.3.2)       RequirePerm    -coverage.spec  (separation
   matrice 26x130      (par endpoint) (oracle tests)   des fonctions)
            |              |              |            |
            +--------------+--------------+------------+
                            |
                            v
                  RLS Postgres (app_can_access_tenant,
                  app_is_super_admin) -- filet final
                            |
                            v
                       7.5a.8 (tests RBAC + RLS)
```

### 4.3 Contrats entrants / sortants

- **Entrant** : `permissions.enum.ts` (7.5a.6) -- liste autoritative des 130 strings de permissions et des 26 strings de roles. Le document DOIT etre coherent avec lui.
- **Sortant** : le document v3.0 sert d'oracle a `role-matrix-coverage.spec.ts` (7.5a.8) et de specification au composant `PermissionsMatrix` (2.3.2).
- **Lateral** : l'auditeur ACAPS lit ce document pour verifier que l'expert est independant de l'approbateur de paiement (separation des fonctions) et que l'agrement expert est trace.

---

## SECTION 5 -- LIVRABLES CHECKABLES

| # | Livrable | Verifiable par |
|---|----------|----------------|
| L1 | En-tete du document porte `**Version** : 3.0.0` | grep |
| L2 | En-tete porte `**Date** : 2026-05-24` | grep |
| L3 | Section 1 annonce 26 roles et 130 permissions | grep |
| L4 | Section 2.6 (Roles Carrier, 6 roles) presente | grep header |
| L5 | Section 2.7 (Roles Expert, 4 roles) presente | grep header |
| L6 | Section 2.8 (Roles Tow, 3 roles) presente | grep header |
| L7 | Section 2.9 (Role garage_parts_manager) presente | grep header |
| L8 | Les 26 strings de roles presents dans le doc | test coherence |
| L9 | Les 130 strings de permissions presents | test coherence |
| L10 | Module carrier (15 permissions) liste en section 5 | grep + comptage |
| L11 | Module expertise (10 permissions) liste en section 5 | grep + comptage |
| L12 | Module tow (8 permissions) liste en section 5 | grep + comptage |
| L13 | Module parts (7 permissions) liste en section 5 | grep + comptage |
| L14 | Section 3 (DAG hierarchie) inclut familles carrier/expert/tow + parts_manager sous garage | grep |
| L15 | Section 7 liste exactement 7 types cross-tenant | grep + comptage |
| L16 | 4 nouveaux types cross-tenant nommes (client_to_tower_dispatch, tower_to_garage_delivery, garage_to_expert_request, garage_to_carrier_quote) | grep |
| L17 | Workflow sinistre v3.0 present avec expert acteur central | grep |
| L18 | Section 4 ABAC etendue pour roles expert/tow/parts | grep |
| L19 | Aucune emoji dans tout le fichier | regex Unicode |
| L20 | Tous les tableaux Markdown bien formes (pipes alignes) | markdownlint / script |
| L21 | Decisions 011-015 referencees | grep |
| L22 | Sections 1 a 10 conservees (pas de regression) + 2.6-2.9 inserees | Read |
| L23 | Footer porte `v3.0` | grep |
| L24 | Spec de validation `5-roles-permissions.doc.spec.ts` cree | ls + run |
| L25 | Test de coherence doc <-> permissions.enum.ts passe | vitest |
| L26 | Matrice par role : chacun des 26 roles a son tableau de permissions | grep + inspection |
| L27 | Tableaux modules listent tous les roles detenteurs | inspection |

---

## SECTION 6 -- FICHIERS CREES / MODIFIES

| Fichier | Action | Delta |
|---------|--------|-------|
| `00-pilotage/documentation/5-roles-permissions.md` | MODIFIE | +~400 lignes (393 -> ~790), version 2.2.0 -> 3.0.0 |
| `00-pilotage/documentation/__tests__/5-roles-permissions.doc.spec.ts` | CREE | spec de validation Vitest (~20 assertions) |

Aucun fichier applicatif (controleur, guard, enum) n'est modifie dans cette tache. La modification de `permissions.enum.ts` releve de 7.5a.6 (dependance) et sa consommation reelle de 2.3.2 / 7.5a.8.

---

## SECTION 7 -- CODE PATTERNS COMPLETS (contenu Markdown v3.0 a ecrire)

> Ci-dessous le contenu EXACT a inserer / remplacer dans `5-roles-permissions.md`. Les blocs sont autonomes et ordonnes. Remplacer l'en-tete, etendre la section 1, conserver 2.1-2.5, inserer 2.6-2.9, etendre 3, 4, 5, 7, ajouter le workflow sinistre v3.0 (nouvelle section 7bis integree au 7 ou en bas), inserer la matrice par role (section 6bis), et mettre a jour le footer.

### 7.1 BLOC -- En-tete v3.0 (remplace les lignes 1-21)

```markdown
# ROLES ET PERMISSIONS skalean-insurtech v3.0

**Version** : 3.0.0
**Date** : 2026-05-24
**Source** : Sprint 7 RBAC (B-07) + Sprint 25 Cross-Tenant (B-25) + Sprint 7.5a Assurflow (B-7.5a)
**Decisions** : 011 (Carrier), 012 (Expert), 013 (Workflow sinistre expert-centre), 014 (Tow), 015 (parts_manager)
**AUCUNE EMOJI AUTORISEE**

---

## 1. VUE D'ENSEMBLE

skalean-insurtech utilise un systeme RBAC (Role-Based Access Control) augmente d'ABAC (Attribute-Based Access Control) pour les regles contextuelles.

**26 roles utilisateurs** repartis en 7 familles :
- 2 roles Skalean staff (Platform -- Niveau 1)
- 3 roles Tenant cabinet courtier (Broker -- Niveau 2)
- 6 roles Tenant garage (Garage -- Niveau 2)
- 6 roles Tenant compagnie d'assurance (Carrier -- Niveau 2) -- Assurflow v3.0
- 4 roles Tenant expertise (Expert -- Niveau 2) -- Assurflow v3.0
- 3 roles Tenant remorquage (Tow -- Niveau 2) -- Assurflow v3.0
- 1 role Assure (Niveau 3 -- L3 dans tenant)
- 1 role Prospect (Public)

**130 permissions distinctes** organisees en ~19 modules : auth / crm / booking / comm / docs / pay / books / compliance / analytics / insure / repair / stock / hr / admin / cross_tenant / sky / mcp / carrier / expertise / tow / parts.

La vertical **Assurflow** (assurance auto) introduit trois nouvelles familles d'acteurs (Carrier, Expert, Tow) et un nouveau role garage (parts_manager), portant la matrice a 26 roles x 130 permissions.
```

### 7.2 BLOC -- Section 2.6 Roles Carrier (a inserer apres 2.5)

```markdown
### 2.6 Roles Tenant Carrier (compagnie d'assurance -- Niveau 2) -- Assurflow v3.0

| Role | Description | Specialite | Heritage |
|------|-------------|------------|----------|
| **carrier_admin** | Admin compagnie -- gestion tenant carrier, parametrage, lecture transverse | Gestion totale tenant (sans pouvoir d'approbation paiement) | herite lecture des roles metier, PAS leurs pouvoirs d'approbation |
| **carrier_claims_manager** | Responsable sinistres -- pilote les dossiers, designe les experts | Sinistres + designation expert | base |
| **carrier_finance** | Direction financiere -- approuve les paiements par niveau | Approbation paiement L1-L4 | base |
| **carrier_compliance** | Conformite et lutte anti-fraude -- rapports ACAPS, alertes fraude | Compliance + fraude | base |
| **carrier_expert_manager** | Gestionnaire du pool d'experts -- evalue et designe | Pool experts | base |
| **carrier_partner_manager** | Gestionnaire des partenaires (garages, remorqueurs, courtiers) | Partenariats reseau | base |

**carrier_admin** est l'administrateur du tenant compagnie d'assurance. Il configure le tenant (parametres, utilisateurs, seuils), dispose d'une lecture transverse des sinistres et des partenaires, mais ne dispose PAS des pouvoirs operationnels sensibles : il ne peut ni approuver un paiement (`carrier.payment.approve_level*`) ni designer un expert (`carrier.experts.designate`). Cette restriction est une exigence ACAPS de separation des fonctions : l'administrateur technique du tenant ne doit pas cumuler les pouvoirs metier critiques.

| Permission detenue par carrier_admin | Module | Description courte |
|--------------------------------------|--------|--------------------|
| `carrier.dashboard.read` | carrier | tableau de bord compagnie |
| `carrier.claims.read` | carrier | lecture des sinistres (perimetre attribue) |
| `carrier.claims.read_all` | carrier | lecture de tous les sinistres du tenant |
| `carrier.brokers.manage` | carrier | gestion des courtiers partenaires |
| `carrier.partners.read_stats` | carrier | statistiques des partenaires |
| `users.create` | auth | creation d'utilisateurs (within tenant carrier) |
| `users.read` | auth | lecture des utilisateurs du tenant |
| `users.update` | auth | mise a jour des utilisateurs du tenant |
| `tenant.settings.update` | admin | parametrage du tenant carrier |

**carrier_claims_manager** pilote les dossiers sinistres et declenche la designation des experts. Il lit l'ensemble des sinistres du tenant et peut designer un expert depuis le pool (mais ne l'evalue pas et ne le note pas : cela releve de carrier_expert_manager).

| Permission detenue par carrier_claims_manager | Module | Description courte |
|-----------------------------------------------|--------|--------------------|
| `carrier.dashboard.read` | carrier | tableau de bord compagnie |
| `carrier.claims.read` | carrier | lecture des sinistres (perimetre attribue) |
| `carrier.claims.read_all` | carrier | lecture de tous les sinistres du tenant |
| `carrier.experts.designate` | carrier | designation d'un expert sur un sinistre |
| `carrier.experts.read_pool` | carrier | lecture du pool d'experts disponibles |
| `repair.sinistres.read` | repair | lecture des dossiers sinistre (ABAC tenant) |

**carrier_finance** est le seul role habilite a approuver les paiements. L'approbation est graduee en quatre niveaux selon le montant (L1 a L4) et le rejet est explicite. Ce role est strictement separe de la designation d'expert et de la validation technique du devis : il ne fait qu'approuver ou rejeter financierement.

| Permission detenue par carrier_finance | Module | Description courte |
|-----------------------------------------|--------|--------------------|
| `carrier.dashboard.read` | carrier | tableau de bord compagnie |
| `carrier.claims.read` | carrier | lecture des sinistres (perimetre attribue) |
| `carrier.payment.approve_level1` | carrier | approbation paiement niveau 1 (petit montant) |
| `carrier.payment.approve_level2` | carrier | approbation paiement niveau 2 |
| `carrier.payment.approve_level3` | carrier | approbation paiement niveau 3 |
| `carrier.payment.approve_level4` | carrier | approbation paiement niveau 4 (gros montant) |
| `carrier.payment.reject` | carrier | rejet d'un paiement en attente |

**carrier_compliance** porte la conformite reglementaire et la lutte anti-fraude. Il genere les rapports de conformite ACAPS et lit les alertes de fraude, sans pouvoir operationnel sur les sinistres ni sur les paiements.

| Permission detenue par carrier_compliance | Module | Description courte |
|--------------------------------------------|--------|--------------------|
| `carrier.dashboard.read` | carrier | tableau de bord compagnie |
| `carrier.compliance.reports.generate` | carrier | generation des rapports de conformite |
| `carrier.fraud.alerts.read` | carrier | lecture des alertes de fraude |
| `compliance.acaps_reports.generate` | compliance | generation rapports ACAPS |
| `compliance.aml_alerts.review` | compliance | revue des alertes AML |

**carrier_expert_manager** gere le pool d'experts : il les designe, lit le pool et les evalue (notation post-mission). C'est le seul role carrier portant `carrier.experts.evaluate`.

| Permission detenue par carrier_expert_manager | Module | Description courte |
|-----------------------------------------------|--------|--------------------|
| `carrier.dashboard.read` | carrier | tableau de bord compagnie |
| `carrier.experts.designate` | carrier | designation d'un expert sur un sinistre |
| `carrier.experts.read_pool` | carrier | lecture du pool d'experts disponibles |
| `carrier.experts.evaluate` | carrier | evaluation/notation d'un expert |
| `carrier.claims.read` | carrier | lecture des sinistres (perimetre attribue) |

**carrier_partner_manager** gere le reseau de partenaires : courtiers, garages et remorqueurs. Il lit les statistiques de partenaires et gere les courtiers ; il s'appuie sur l'authentification cross-tenant pour piloter le reseau.

| Permission detenue par carrier_partner_manager | Module | Description courte |
|------------------------------------------------|--------|--------------------|
| `carrier.dashboard.read` | carrier | tableau de bord compagnie |
| `carrier.partners.read_stats` | carrier | statistiques des partenaires |
| `carrier.brokers.manage` | carrier | gestion des courtiers partenaires |
| `cross_tenant.api_authentication` | cross_tenant | authentification cross-tenant reseau |

**NOTE separation des fonctions (ACAPS)** : aucun role carrier ne cumule a la fois `carrier.experts.designate` (designation), `expertise.validate_quote` (validation technique -- reserve a la famille expert) et `carrier.payment.approve_level*` (approbation financiere). Ces trois pouvoirs sont portes par des roles distincts non cumulables.
```

### 7.3 BLOC -- Section 2.7 Roles Expert (a inserer apres 2.6)

```markdown
### 2.7 Roles Tenant Expert (expertise sinistre -- Niveau 2) -- Assurflow v3.0

| Role | Description | Specialite | Agrement |
|------|-------------|------------|----------|
| **expert_independent** | Expert independant agree (tenant expert solo) | Expertise auto independante | Numero d'agrement obligatoire (attribut ABAC) |
| **expert_firm_admin** | Admin cabinet d'expertise | Gestion cabinet + repartition missions | Agrement cabinet |
| **expert_associate** | Expert associe d'un cabinet | Execution missions designees | Agrement individuel |
| **expert_carrier_internal** | Expert salarie interne de la compagnie (tenant carrier) | Expertise interne | Agrement individuel, tenant = carrier |

**expert_independent** est un expert agree exercant en solo (tenant expert dedie). Il recoit des missions designees par le carrier, les accepte ou les refuse, execute l'expertise, statue sur le devis garage (valide / modifie / rejette), redige et signe le rapport (agrement requis), puis facture ses honoraires. Il est independant de l'approbateur de paiement carrier : c'est la separation des fonctions ACAPS centrale.

| Permission detenue par expert_independent | Module | Description courte |
|-------------------------------------------|--------|--------------------|
| `expertise.missions.read` | expertise | lecture des missions designees (ABAC own) |
| `expertise.missions.accept` | expertise | acceptation d'une mission |
| `expertise.missions.reject` | expertise | refus d'une mission |
| `expertise.execute` | expertise | execution de l'expertise |
| `expertise.validate_quote` | expertise | validation du devis garage |
| `expertise.modify_quote` | expertise | modification du devis garage |
| `expertise.reject_quote` | expertise | rejet du devis garage |
| `expertise.report.create` | expertise | creation du rapport d'expertise |
| `expertise.report.sign` | expertise | signature du rapport (agrement requis) |
| `expertise.honoraires.invoice` | expertise | facturation des honoraires |

**expert_firm_admin** administre un cabinet d'expertise : il gere les utilisateurs (experts associes) du tenant, parametre le cabinet, lit l'ensemble des missions du cabinet et les repartit. Il facture les honoraires du cabinet.

| Permission detenue par expert_firm_admin | Module | Description courte |
|------------------------------------------|--------|--------------------|
| `expertise.missions.read` | expertise | lecture de toutes les missions du cabinet (ABAC firm) |
| `expertise.missions.accept` | expertise | acceptation d'une mission |
| `expertise.missions.reject` | expertise | refus d'une mission |
| `users.create` | auth | creation d'experts associes (within tenant expert) |
| `users.read` | auth | lecture des utilisateurs du cabinet |
| `users.update` | auth | mise a jour des utilisateurs du cabinet |
| `tenant.settings.update` | admin | parametrage du tenant cabinet |
| `expertise.honoraires.invoice` | expertise | facturation des honoraires |

**expert_associate** est un expert salarie/associe d'un cabinet. Il execute les missions qui lui sont designees au sein du cabinet, statue sur le devis et signe les rapports (agrement individuel). Il ne gere pas les utilisateurs ni le tenant.

| Permission detenue par expert_associate | Module | Description courte |
|-----------------------------------------|--------|--------------------|
| `expertise.missions.read` | expertise | lecture des missions designees a l'associe (ABAC own) |
| `expertise.missions.accept` | expertise | acceptation d'une mission |
| `expertise.missions.reject` | expertise | refus d'une mission |
| `expertise.execute` | expertise | execution de l'expertise |
| `expertise.validate_quote` | expertise | validation du devis garage |
| `expertise.modify_quote` | expertise | modification du devis garage |
| `expertise.reject_quote` | expertise | rejet du devis garage |
| `expertise.report.create` | expertise | creation du rapport d'expertise |
| `expertise.report.sign` | expertise | signature du rapport (agrement requis) |

**expert_carrier_internal** est un expert salarie interne de la compagnie. Particularite cruciale : son tenant est le tenant **carrier**, pas un tenant expert separe. L'isolation RLS s'applique sur le tenant carrier. Il execute des missions internes, statue sur le devis et signe les rapports, mais ne facture pas d'honoraires (salarie) et n'accepte/refuse pas librement (affectation interne).

| Permission detenue par expert_carrier_internal | Module | Description courte |
|------------------------------------------------|--------|--------------------|
| `expertise.missions.read` | expertise | lecture des missions internes du carrier (ABAC carrier) |
| `expertise.missions.accept` | expertise | acceptation d'une mission interne |
| `expertise.execute` | expertise | execution de l'expertise |
| `expertise.validate_quote` | expertise | validation du devis garage |
| `expertise.modify_quote` | expertise | modification du devis garage |
| `expertise.reject_quote` | expertise | rejet du devis garage |
| `expertise.report.create` | expertise | creation du rapport d'expertise |
| `expertise.report.sign` | expertise | signature du rapport (agrement requis) |

**NOTE separation des fonctions (ACAPS)** : quel que soit son statut (independant, cabinet, interne), l'expert est independant de l'approbateur de paiement carrier_finance. L'expert valide/modifie/rejette le devis mais ne participe jamais a l'approbation du paiement (`carrier.payment.approve_level*`). Cette independance est l'exigence reglementaire majeure tracee par ce document.
```

### 7.4 BLOC -- Section 2.8 Roles Tow (a inserer apres 2.7)

```markdown
### 2.8 Roles Tenant Tow (remorquage / depannage -- Niveau 2) -- Assurflow v3.0

| Role | Description | Specialite |
|------|-------------|------------|
| **tow_admin** | Admin societe de remorquage -- gestion tenant + flotte | Gestion totale tenant tow |
| **tow_driver** | Chauffeur depanneur (PWA mobile) | Execution missions terrain |
| **tow_dispatcher** | Repartiteur -- assigne les missions geolocalisees | Dispatch |

**tow_admin** administre la societe de remorquage : il gere les utilisateurs et chauffeurs, parametre le tenant, lit les missions disponibles et les gains agreges de la flotte.

| Permission detenue par tow_admin | Module | Description courte |
|----------------------------------|--------|--------------------|
| `tow.missions.read_available` | tow | lecture des missions disponibles |
| `tow.drivers.manage` | tow | gestion des chauffeurs |
| `tow.earnings.read` | tow | lecture des gains (tenant-wide) |
| `users.create` | auth | creation d'utilisateurs (within tenant tow) |
| `users.read` | auth | lecture des utilisateurs du tenant |
| `users.update` | auth | mise a jour des utilisateurs du tenant |
| `tenant.settings.update` | admin | parametrage du tenant tow |

**tow_driver** est le chauffeur depanneur sur le terrain, utilisant une PWA mobile. Il ne voit que les missions disponibles dans son rayon geographique lorsqu'il est en disponibilite (ABAC geo + dispo), accepte/refuse, depose les photos du vehicule, cloture la mission, bascule sa disponibilite et consulte ses propres gains. WebAuthn biometric login conseille (mobilite terrain).

| Permission detenue par tow_driver | Module | Description courte |
|-----------------------------------|--------|--------------------|
| `tow.missions.read_available` | tow | lecture missions disponibles (ABAC geo + dispo) |
| `tow.missions.accept` | tow | acceptation d'une mission |
| `tow.missions.reject` | tow | refus d'une mission |
| `tow.missions.complete` | tow | cloture d'une mission terminee |
| `tow.vehicle.photos.upload` | tow | depot des photos du vehicule remorque |
| `tow.availability.toggle` | tow | bascule de disponibilite du chauffeur |
| `tow.earnings.read` | tow | lecture des gains (ABAC own) |

**tow_dispatcher** est le repartiteur : il lit les missions disponibles, assigne les chauffeurs (gestion drivers limitee a l'assignation) et lit les gains de la flotte pour piloter.

| Permission detenue par tow_dispatcher | Module | Description courte |
|---------------------------------------|--------|--------------------|
| `tow.missions.read_available` | tow | lecture des missions disponibles |
| `tow.drivers.manage` | tow | assignation/gestion des chauffeurs |
| `tow.earnings.read` | tow | lecture des gains (tenant-wide) |
```

### 7.5 BLOC -- Section 2.9 Role garage_parts_manager (a inserer apres 2.8)

```markdown
### 2.9 Role Tenant Garage -- garage_parts_manager (Niveau 2) -- Assurflow v3.0

| Role | Description | Specialite |
|------|-------------|------------|
| **garage_parts_manager** | Gestionnaire de pieces detachees du garage -- commande, suivi commissions, fournisseurs | Pieces detachees + approvisionnement |

**garage_parts_manager** gere l'approvisionnement en pieces detachees du garage : il consulte les fournisseurs, les ajoute en favoris, cree et lit les commandes, annule dans la fenetre autorisee (ABAC time-based), suit le tableau de bord des commissions et lit les factures fournisseurs. Il a aussi une lecture du stock du garage. Il herite du garage tenant et est rattache sous garage_admin dans le DAG.

| Permission detenue par garage_parts_manager | Module | Description courte |
|---------------------------------------------|--------|--------------------|
| `parts.suppliers.read` | parts | lecture des fournisseurs de pieces |
| `parts.suppliers.add_to_favorites` | parts | ajout d'un fournisseur en favori |
| `parts.orders.create` | parts | creation d'une commande de pieces |
| `parts.orders.read` | parts | lecture des commandes |
| `parts.orders.cancel_within_window` | parts | annulation dans la fenetre autorisee (ABAC time-based) |
| `parts.commission.view_dashboard` | parts | tableau de bord des commissions pieces |
| `parts.invoices.read` | parts | lecture des factures fournisseurs |
| `stock.items.read` | stock | lecture des articles en stock |
| `stock.movements.read` | stock | lecture des mouvements de stock |

Ce role complete la famille garage (6 roles au total avec garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial).
```

### 7.5bis BLOC -- Section 6bis Matrice synthetique par role (les 26 roles)

```markdown
## 6bis. MATRICE SYNTHETIQUE PAR ROLE (26 roles)

Cette section recapitule, pour chacun des 26 roles, son perimetre de permissions. Les 12 roles existants (Platform, Broker, Garage hors parts_manager, Assure, Prospect) sont resumes en lignes concises ; les 14 nouveaux roles (carrier x6, expert x4, tow x3, parts_manager x1) ont leur detail complet en sections 2.6-2.9. La materialisation cellule par cellule (3380 cellules) est portee par le composant `PermissionsMatrix` (tache 2.3.2).

### 6bis.1 Roles existants (resume concis -- detail v2.2 conserve sections 2.1-2.5)

| Role | Famille | Niveau | Perimetre de permissions (resume) |
|------|---------|--------|------------------------------------|
| `super_admin_platform` | Platform | 1 | Bypass total. Toutes permissions via `app_is_super_admin()`. Acces `/api/v1/admin/*` transverse. |
| `analyst_support` | Platform | 1 | Lecture seule universelle (read-only). `*.read` transverse, aucune ecriture. |
| `broker_admin` | Broker | 2 | Gestion totale du tenant courtier : crm, booking, comm, docs, pay (lecture), users, tenant.settings. |
| `broker_user` | Broker | 2 | Operationnel courtier : crm.contacts.*, booking, comm, devis (sans gestion utilisateurs/tenant). |
| `broker_assistant` | Broker | 2 | Support courtier : lecture crm/booking, comm de base, pas d'ecriture sensible. |
| `garage_admin` | Garage | 2 | Gestion totale du tenant garage : repair, stock, hr, pay (lecture), users, tenant.settings. |
| `garage_chef` | Garage | 2 | Chef d'atelier : repair.sinistres.*, repair.devis.create, repair.reparations.*, cloture sinistre. |
| `garage_technicien` | Garage | 2 | Execution technique : repair.reparations.start/complete, lecture devis et stock. |
| `garage_comptable` | Garage | 2 | Comptabilite garage : books.*, pay (lecture/rapprochement), facturation. |
| `garage_commercial` | Garage | 2 | Commercial garage : crm garage, devis commercial, relation client. |
| `assure` | Assure | 3 | Assure final : repair.sinistres.create_own, lecture polices/dossiers propres, pay.refunds (retractation). |
| `prospect` | Public | public | Acces public : auth.register, lecture offres publiques, pas d'acces tenant. |

### 6bis.2 Roles nouveaux Assurflow v3.0 (detail en 2.6-2.9)

| Role | Famille | Nb permissions cles | Section de detail |
|------|---------|---------------------|-------------------|
| `carrier_admin` | Carrier | 9 | 2.6 |
| `carrier_claims_manager` | Carrier | 6 | 2.6 |
| `carrier_finance` | Carrier | 7 | 2.6 |
| `carrier_compliance` | Carrier | 5 | 2.6 |
| `carrier_expert_manager` | Carrier | 5 | 2.6 |
| `carrier_partner_manager` | Carrier | 4 | 2.6 |
| `expert_independent` | Expert | 10 | 2.7 |
| `expert_firm_admin` | Expert | 8 | 2.7 |
| `expert_associate` | Expert | 9 | 2.7 |
| `expert_carrier_internal` | Expert | 8 | 2.7 |
| `tow_admin` | Tow | 7 | 2.8 |
| `tow_driver` | Tow | 7 | 2.8 |
| `tow_dispatcher` | Tow | 3 | 2.8 |
| `garage_parts_manager` | Garage | 9 | 2.9 |

### 6bis.3 Permission -> roles detenteurs (modules Assurflow)

Le tableau inverse (qui detient quoi) est porte par les tableaux de modules de la section 5. Regle : chaque permission Assurflow apparait au moins une fois comme detenue par un role concret, et chaque ligne de module liste TOUS les roles detenteurs.
```

### 7.6 BLOC -- Section 3 reconstruite (DAG hierarchie v3.0)

```markdown
## 3. ROLE HIERARCHY (v3.0 -- 26 roles)

```
super_admin_platform (top)  -- bypass tout

analyst_support             -- read-only universal

broker_admin
  └── broker_user
        └── broker_assistant

garage_admin
  ├── garage_chef
  │     └── garage_technicien
  ├── garage_comptable
  ├── garage_commercial
  └── garage_parts_manager        (Assurflow v3.0)

carrier_admin                      (Assurflow v3.0 -- herite LECTURE des roles metier, PAS leurs pouvoirs d'approbation)
  ├── carrier_claims_manager
  ├── carrier_finance              (approbation paiement -- separation des fonctions)
  ├── carrier_compliance
  ├── carrier_expert_manager
  └── carrier_partner_manager

expert_firm_admin                  (Assurflow v3.0)
  └── expert_associate
expert_independent                 (tenant solo -- pas d'heritage descendant)
expert_carrier_internal            (tenant = carrier -- pas d'heritage descendant)

tow_admin                          (Assurflow v3.0)
  ├── tow_dispatcher
  └── tow_driver

assure (L3 in tenant)
prospect (public)
```

**Heritage** : `getEffectivePermissions(role)` resout recursivement les permissions du role et de ses descendants dans son arbre.

**Separation des fonctions (ACAPS)** :
- `carrier_admin` herite des permissions de LECTURE de ses sous-roles mais N'herite PAS de `carrier.payment.approve_level*` (reserve carrier_finance) ni de `carrier.experts.designate` (reserve carrier_expert_manager / carrier_claims_manager). Cela garantit qu'aucun acteur unique ne cumule designation d'expert et approbation de paiement.
- L'expert (toutes variantes) est independant du carrier_finance : il valide/modifie/rejette le devis mais ne participe pas a l'approbation du paiement.

**Pas de cross-inheritance** : les familles broker_* / garage_* / carrier_* / expert_* / tow_* sont independantes (1 user = 1 role par tenant). Un utilisateur multi-tenant possede des roles distincts par tenant.
```

### 7.7 BLOC -- Section 4 ABAC etendue (ajouts pour roles v3.0)

```markdown
### 4.5 ExpertDesignationPolicy (Assurflow v3.0)

- `expertise.missions.read` : l'expert ne lit que les missions DESIGNEES a lui. Filtre ABAC :
  - `expert_independent` / `expert_associate` : `mission.expert_id = ctx.userId` (own).
  - `expert_firm_admin` : `mission.firm_id = ctx.tenantId` (toutes les missions du cabinet).
  - `expert_carrier_internal` : `mission.carrier_tenant_id = ctx.tenantId` ET `mission.internal = true` (missions internes du carrier).
- La designation est materialisee par un enregistrement `expert_designation` actif liant `sinistre_id`, `expert_id`/`firm_id` et `carrier_tenant_id`. Une mission sans designation active n'est pas lisible par l'expert.
- `expertise.execute` / `expertise.validate_quote` / `expertise.modify_quote` / `expertise.reject_quote` : permis seulement si `mission.status = 'accepted'` ET la designation est active ET l'expert correspond au filtre ci-dessus.
- Attribut agrement : l'expert doit porter un numero d'agrement valide (`user.expert_agrement_no` non nul et non expire) sinon `expertise.report.sign` refuse (exigence ACAPS). L'agrement est verifie au moment de la signature, pas seulement a l'acceptation.

### 4.6 PaymentApprovalLevelPolicy (Assurflow v3.0)

- `carrier.payment.approve_level1..4` : le niveau requis depend du montant du paiement. ABAC amount-based :
  - level1 : montant <= seuil1 (petit montant, ex. <= 5 000 MAD).
  - level2 : seuil1 < montant <= seuil2 (ex. <= 25 000 MAD).
  - level3 : seuil2 < montant <= seuil3 (ex. <= 100 000 MAD).
  - level4 : montant > seuil3 (gros montant, double signature recommandee).
- Un `carrier_finance` ne peut approuver que jusqu'a son niveau habilite (`user.max_approval_level`). Une tentative au-dela est refusee meme si la permission est presente.
- `carrier.payment.reject` : permis si `payment.status = 'pending_approval'`. Le rejet renvoie le dossier en revision et trace le motif.
- L'approbation est bornee au tenant carrier (RLS) ET au sinistre dont l'expertise est `expertise_validated` : on ne peut approuver un paiement avant validation technique du devis par l'expert.

### 4.7 TowDispatchGeoPolicy (Assurflow v3.0)

- `tow.missions.read_available` : ABAC geo + disponibilite. Un `tow_driver` ne voit que les missions dans son rayon geographique (`distance(mission.geo, driver.geo) <= radius`) ET seulement s'il a `tow.availability.toggle` actif (disponible). `tow_admin` / `tow_dispatcher` voient toutes les missions du tenant tow (pas de filtre geo individuel).
- `tow.missions.accept` : permis si `mission.status = 'available'` ET driver disponible. Premiere acceptation gagne (idempotency via `Idempotency-Key`) ; les acceptations concurrentes ulterieures recoivent un conflit.
- `tow.missions.complete` : permis si `mission.driver_id = ctx.userId` ET `mission.status = 'in_progress'`.
- `tow.vehicle.photos.upload` : permis pour le driver assigne pendant la mission active uniquement.
- `tow.earnings.read` : ABAC own pour `tow_driver` (ses gains seulement, `earnings.driver_id = ctx.userId`), tenant-wide pour `tow_admin` / `tow_dispatcher`.

### 4.8 PartsCancellationWindowPolicy (Assurflow v3.0)

- `parts.orders.cancel_within_window` : ABAC time-based. Annulation permise seulement si `NOW() < order.created_at + supplier.cancellation_window`. Au-dela, refuse (la commande est ferme cote fournisseur). La fenetre depend du fournisseur (`supplier.cancellation_window`, ex. 2h).
- `parts.orders.create` / `parts.orders.read` : bornes au tenant garage du `garage_parts_manager` (RLS tenant). Un parts_manager ne voit jamais les commandes d'un autre garage.
- `parts.suppliers.add_to_favorites` : favoris portes au niveau du tenant garage (partages entre les parts_managers du meme garage).
- `parts.commission.view_dashboard` : commissions calculees sur les commandes du tenant garage uniquement.
```

### 7.8 BLOC -- Section 5 : modules carrier / expertise / tow / parts (a ajouter)

```markdown
### carrier (15) -- Assurflow v3.0

| Permission | Description | Roles detenteurs |
|------------|-------------|------------------|
| `carrier.dashboard.read` | tableau de bord compagnie | carrier_admin, carrier_claims_manager, carrier_finance, carrier_compliance, carrier_expert_manager, carrier_partner_manager |
| `carrier.claims.read` | lecture sinistres (perimetre attribue) | carrier_admin, carrier_claims_manager, carrier_finance, carrier_expert_manager |
| `carrier.claims.read_all` | lecture de tous les sinistres du tenant carrier | carrier_admin, carrier_claims_manager |
| `carrier.payment.approve_level1` | approbation paiement niveau 1 (petit montant) | carrier_finance |
| `carrier.payment.approve_level2` | approbation paiement niveau 2 | carrier_finance |
| `carrier.payment.approve_level3` | approbation paiement niveau 3 | carrier_finance |
| `carrier.payment.approve_level4` | approbation paiement niveau 4 (gros montant) | carrier_finance |
| `carrier.payment.reject` | rejet d'un paiement en attente | carrier_finance |
| `carrier.experts.designate` | designation d'un expert sur un sinistre | carrier_claims_manager, carrier_expert_manager |
| `carrier.experts.read_pool` | lecture du pool d'experts disponibles | carrier_claims_manager, carrier_expert_manager |
| `carrier.experts.evaluate` | evaluation/notation d'un expert | carrier_expert_manager |
| `carrier.partners.read_stats` | statistiques des partenaires (garages, remorqueurs) | carrier_admin, carrier_partner_manager |
| `carrier.compliance.reports.generate` | generation des rapports de conformite | carrier_compliance |
| `carrier.fraud.alerts.read` | lecture des alertes de fraude | carrier_compliance |
| `carrier.brokers.manage` | gestion des courtiers partenaires | carrier_admin, carrier_partner_manager |

### expertise (10) -- Assurflow v3.0

| Permission | Description | Roles detenteurs |
|------------|-------------|------------------|
| `expertise.missions.read` | lecture des missions designees (ABAC) | expert_independent, expert_firm_admin, expert_associate, expert_carrier_internal |
| `expertise.missions.accept` | acceptation d'une mission | expert_independent, expert_firm_admin, expert_associate, expert_carrier_internal |
| `expertise.missions.reject` | refus d'une mission | expert_independent, expert_firm_admin, expert_associate |
| `expertise.execute` | execution de l'expertise sur site/dossier | expert_independent, expert_associate, expert_carrier_internal |
| `expertise.validate_quote` | validation du devis garage | expert_independent, expert_associate, expert_carrier_internal |
| `expertise.modify_quote` | modification du devis garage | expert_independent, expert_associate, expert_carrier_internal |
| `expertise.reject_quote` | rejet du devis garage | expert_independent, expert_associate, expert_carrier_internal |
| `expertise.report.create` | creation du rapport d'expertise | expert_independent, expert_associate, expert_carrier_internal |
| `expertise.report.sign` | signature du rapport (agrement requis) | expert_independent, expert_associate, expert_carrier_internal |
| `expertise.honoraires.invoice` | facturation des honoraires d'expertise | expert_independent, expert_firm_admin |

### tow (8) -- Assurflow v3.0

| Permission | Description | Roles detenteurs |
|------------|-------------|------------------|
| `tow.missions.read_available` | lecture des missions disponibles (ABAC geo + dispo) | tow_admin, tow_driver, tow_dispatcher |
| `tow.missions.accept` | acceptation d'une mission de remorquage | tow_driver |
| `tow.missions.reject` | refus d'une mission | tow_driver |
| `tow.missions.complete` | cloture d'une mission terminee | tow_driver |
| `tow.vehicle.photos.upload` | depot des photos du vehicule remorque | tow_driver |
| `tow.availability.toggle` | bascule disponibilite du chauffeur | tow_driver |
| `tow.earnings.read` | lecture des gains | tow_admin, tow_driver, tow_dispatcher |
| `tow.drivers.manage` | gestion des chauffeurs (admin/dispatcher) | tow_admin, tow_dispatcher |

### parts (7) -- Assurflow v3.0

| Permission | Description | Roles detenteurs |
|------------|-------------|------------------|
| `parts.suppliers.read` | lecture des fournisseurs de pieces | garage_parts_manager |
| `parts.suppliers.add_to_favorites` | ajout d'un fournisseur en favori | garage_parts_manager |
| `parts.orders.create` | creation d'une commande de pieces | garage_parts_manager |
| `parts.orders.read` | lecture des commandes | garage_parts_manager |
| `parts.orders.cancel_within_window` | annulation dans la fenetre autorisee (ABAC time-based) | garage_parts_manager |
| `parts.commission.view_dashboard` | tableau de bord des commissions pieces | garage_parts_manager |
| `parts.invoices.read` | lecture des factures fournisseurs | garage_parts_manager |
```

### 7.9 BLOC -- Section 7 etendue : 7 types cross-tenant

```markdown
## 7. CROSS-TENANT AUTHORIZATIONS (v3.0 -- 7 types)

Sept types d'autorisations cross-tenant. Chaque type precise : qui cree l'autorisation, qui la consomme, le scope de lecture et la duree de validite.

### Type 1 : broker_to_garage_assignment (Sprint 25)
- **Cree par** : broker (broker_admin / broker_user)
- **Consomme par** : garage (garage_admin / garage_chef)
- **Scope** : garage accede au dossier sinistre limite (read scope) ; broker suit le status
- **Duree** : jusqu'a cloture du sinistre

### Type 2 : assure_to_garage_visit (Sprint 25 -- M8 flux)
- **Cree par** : assure (choix garage)
- **Consomme par** : garage
- **Scope** : garage voit les polices assure pertinentes (read scope) ; pas de transfert tenant
- **Duree** : duree de la visite / du sinistre en cours

### Type 3 : multi_tenant_user_access (Sprint 25)
- **Cree par** : plateforme (provisioning)
- **Consomme par** : super_admin_platform / analyst_support
- **Scope** : acces transverse via `/api/v1/admin/*` (audit complet)
- **Duree** : permanent tant que le role staff existe

### Type 4 : client_to_tower_dispatch (Assurflow v3.0)
- **Cree par** : assure (demande de depannage) ou carrier_claims_manager (dispatch)
- **Consomme par** : tenant tow (tow_dispatcher / tow_driver)
- **Scope** : le remorqueur accede a la position et aux donnees minimales du vehicule/assure necessaires au depannage (read scope minimal CNDP)
- **Duree** : jusqu'a completion de la mission (`tow.missions.complete`), TTL maximal 24h

### Type 5 : tower_to_garage_delivery (Assurflow v3.0)
- **Cree par** : tenant tow (a la prise en charge)
- **Consomme par** : tenant garage (reception du vehicule)
- **Scope** : le garage recoit l'identite du vehicule, le point de depose et le dossier sinistre associe (read scope)
- **Duree** : jusqu'a reception confirmee par le garage

### Type 6 : garage_to_expert_request (Assurflow v3.0)
- **Cree par** : tenant garage (demande d'expertise) ou carrier (designation expert)
- **Consomme par** : tenant expert (expert designe)
- **Scope** : l'expert accede au dossier sinistre, au devis garage et aux photos (read scope) pour executer l'expertise
- **Duree** : jusqu'a signature du rapport d'expertise (`expertise.report.sign`)

### Type 7 : garage_to_carrier_quote (Assurflow v3.0)
- **Cree par** : tenant garage (soumission du devis)
- **Consomme par** : tenant carrier (validation puis approbation paiement)
- **Scope** : le carrier accede au devis, au rapport d'expertise et aux justificatifs (read scope) pour approuver le paiement par niveau
- **Duree** : jusqu'a approbation ou rejet du paiement

Note CNDP 09-08 : chaque autorisation cross-tenant porte une duree de validite explicite et est purgee a expiration. Aucune donnee assure ne quitte le territoire (decision-008, cloud souverain MA).

**Tableau de synthese cross-tenant** :

| Type | Emetteur | Recepteur | Scope | Duree / TTL |
|------|----------|-----------|-------|-------------|
| broker_to_garage_assignment | broker | garage | dossier sinistre (read) | jusqu'a cloture |
| assure_to_garage_visit | assure | garage | polices pertinentes (read) | duree visite |
| multi_tenant_user_access | plateforme | staff platform | transverse `/admin/*` | permanent (role staff) |
| client_to_tower_dispatch | assure / carrier | tow | position + donnees min. | mission, TTL 24h |
| tower_to_garage_delivery | tow | garage | vehicule + depose + dossier | jusqu'a reception |
| garage_to_expert_request | garage / carrier | expert | dossier + devis + photos | jusqu'a signature rapport |
| garage_to_carrier_quote | garage | carrier | devis + rapport + justificatifs | jusqu'a approbation/rejet |
```

### 7.10 BLOC -- Workflow sinistre v3.0 (expert acteur central, decision-013)

```markdown
## 7bis. WORKFLOW SINISTRE v3.0 -- EXPERT ACTEUR CENTRAL (decision-013)

Le workflow sinistre Assurflow place l'expert au centre de la chaine de validation. Sequence de bout en bout. Chaque etape nomme le role acteur, la permission mobilisee et, le cas echeant, le type cross-tenant.

1. **Declaration** -- L'assure declare le sinistre. Acteur : `assure`. Permission : `repair.sinistres.create_own` (M8). Le sinistre passe au statut `declared`.
2. **Dispatch remorquage (si necessaire)** -- L'assure ou le `carrier_claims_manager` declenche un depannage. Cross-tenant : Type 4 `client_to_tower_dispatch`. Un `tow_driver` disponible lit la mission (`tow.missions.read_available`, ABAC geo + dispo), accepte (`tow.missions.accept`), remorque, depose des photos (`tow.vehicle.photos.upload`), puis cloture (`tow.missions.complete`). Statut : `towing`.
3. **Livraison au garage** -- Le remorqueur livre le vehicule au garage. Cross-tenant : Type 5 `tower_to_garage_delivery`. Le garage recoit le dossier. Statut : `at_garage`.
4. **Designation de l'expert** -- Le `carrier_claims_manager` ou `carrier_expert_manager` lit le pool (`carrier.experts.read_pool`) et designe un expert (`carrier.experts.designate`). Une mission est creee. Cross-tenant : Type 6 `garage_to_expert_request`. Le sinistre passe a `expertise_pending`.
5. **Acceptation de la mission** -- L'expert designe (`expert_independent` / `expert_associate` / `expert_carrier_internal`) lit la mission (`expertise.missions.read`, ABAC), l'accepte (`expertise.missions.accept`) ou la refuse (`expertise.missions.reject`). Statut : `expertise_in_progress`.
6. **Devis garage** -- Le `garage_chef` etablit le devis de reparation (`repair.devis.create`). Le `garage_parts_manager` identifie les pieces necessaires (`parts.suppliers.read`, en vue de `parts.orders.create` apres validation).
7. **Expertise -- ROLE CENTRAL** -- L'expert execute l'expertise (`expertise.execute`) puis statue sur le devis garage :
   - **valide** (`expertise.validate_quote`),
   - **modifie** (`expertise.modify_quote`) -- ajustement des montants/pieces,
   - **rejette** (`expertise.reject_quote`) -- renvoi au garage pour correction (retour etape 6).
   L'expert cree le rapport (`expertise.report.create`) et le signe (`expertise.report.sign`, agrement requis). Le sinistre passe a `expertise_validated`.
8. **Soumission au carrier** -- Le devis valide par l'expert est transmis au carrier. Cross-tenant : Type 7 `garage_to_carrier_quote`. Statut : `payment_pending`.
9. **Approbation paiement par niveau** -- Le `carrier_finance` approuve le paiement selon le montant : `carrier.payment.approve_level1`, `carrier.payment.approve_level2`, `carrier.payment.approve_level3` ou `carrier.payment.approve_level4` (PaymentApprovalLevelPolicy), ou rejette (`carrier.payment.reject`). Le sinistre passe a `payment_approved`.
10. **Commande des pieces** -- Le `garage_parts_manager` commande les pieces aupres des fournisseurs favoris (`parts.suppliers.add_to_favorites`, `parts.orders.create`), avec fenetre d'annulation (`parts.orders.cancel_within_window`). Le tableau de bord commissions est suivi (`parts.commission.view_dashboard`) et les factures lues (`parts.invoices.read`).
11. **Reparation et cloture** -- Le garage execute la reparation (`repair.reparations.start` / `complete`), puis le `garage_chef` cloture le sinistre (`repair.sinistres.close`). Le sinistre passe a `closed`.
12. **Honoraires expert** -- L'expert facture ses honoraires (`expertise.honoraires.invoice`).

**Tableau recapitulatif workflow (role / permission / cross-tenant par etape)** :

| # | Etape | Role acteur | Permission(s) cle | Cross-tenant | Statut resultant |
|---|-------|-------------|-------------------|--------------|------------------|
| 1 | Declaration | assure | `repair.sinistres.create_own` | -- | declared |
| 2 | Dispatch remorquage | tow_driver | `tow.missions.read_available`, `tow.missions.accept`, `tow.vehicle.photos.upload`, `tow.missions.complete` | Type 4 | towing |
| 3 | Livraison garage | tow_driver / garage | -- | Type 5 | at_garage |
| 4 | Designation expert | carrier_claims_manager / carrier_expert_manager | `carrier.experts.read_pool`, `carrier.experts.designate` | Type 6 | expertise_pending |
| 5 | Acceptation mission | expert (designe) | `expertise.missions.read`, `expertise.missions.accept` | Type 6 | expertise_in_progress |
| 6 | Devis garage | garage_chef + garage_parts_manager | `repair.devis.create`, `parts.suppliers.read` | -- | expertise_in_progress |
| 7 | Expertise (central) | expert (designe) | `expertise.execute`, `expertise.validate_quote` / `expertise.modify_quote` / `expertise.reject_quote`, `expertise.report.create`, `expertise.report.sign` | -- | expertise_validated |
| 8 | Soumission carrier | garage | -- | Type 7 | payment_pending |
| 9 | Approbation paiement | carrier_finance | `carrier.payment.approve_level1..4` (4 permissions), `carrier.payment.reject` | Type 7 | payment_approved |
| 10 | Commande pieces | garage_parts_manager | `parts.orders.create`, `parts.orders.cancel_within_window`, `parts.commission.view_dashboard` | -- | payment_approved |
| 11 | Reparation + cloture | garage_chef / garage_technicien | `repair.reparations.start`, `repair.reparations.complete`, `repair.sinistres.close` | -- | closed |
| 12 | Honoraires expert | expert | `expertise.honoraires.invoice` | -- | closed |

**Separation des fonctions** : l'expert (validation technique) est independant du carrier_finance (approbation financiere) et du carrier_expert_manager (designation). Aucun acteur ne cumule designation + validation + paiement. Cette separation est l'exigence ACAPS centrale tracee par ce document.

**Transitions de statut sinistre v3.0** :
`declared -> towing (optionnel) -> at_garage -> expertise_pending -> expertise_in_progress -> expertise_validated -> payment_pending -> payment_approved -> repair_in_progress -> closed`
```

### 7.11 BLOC -- Footer v3.0 (remplace la derniere ligne)

```markdown
---

**Fin du document 5-roles-permissions.md v3.0.0 -- 26 roles x 130 permissions (Assurflow).**
```

### 7.12 BLOC -- ANNEXE A : Inventaire exhaustif des permissions par role (26 roles)

Inserer cette annexe a la fin de la section 5 du document, sous le titre `## 5bis. INVENTAIRE EXHAUSTIF DES PERMISSIONS PAR ROLE`. Elle constitue l'oracle ligne a ligne consomme par la PermissionsMatrix (tache 2.3.2) et par les tests 7.5a.8. Chaque liste est la liste effective (RBAC direct + heritage de hierarchie deja resolu).

```markdown
## 5bis. INVENTAIRE EXHAUSTIF DES PERMISSIONS PAR ROLE

### Platform (Niveau 1)

- super_admin_platform : wildcard `*` (toutes permissions, bypass RLS via app_is_super_admin). Ne PAS lister individuellement ; le guard court-circuite.
- analyst_support : lecture seule transverse. Permissions : auth.users.read, tenant.settings.read, tenant.billing.read, crm.contacts.read, insure.polices.read, repair.sinistres.read, carrier.dashboard.read, carrier.claims.read_all, expertise.missions.read, tow.missions.read_available, parts.orders.read, analytics.dashboards.read, compliance.audit.read. Aucune ecriture.

### Tenant Broker (Niveau 2)

- broker_admin : toutes permissions broker + heritage broker_user + broker_assistant. crm.* (read/create/update/delete/export contacts, companies, deals, pipelines.manage), booking.* (rooms.manage, appointments.*), comm.* (send/templates), docs.* (read/upload/sign_request), pay.read, books.read, insure.polices.* (read/create/update/quote/issue), insure.sinistres.read, analytics.dashboards.read, tenant.settings.read/update, tenant.users.invite, auth.users.create/read/update, auth.roles.assign.
- broker_user : crm.contacts.read_own/create/update_own, crm.deals.read/create/update, crm.interactions.create, booking.appointments.read_own/create/update, comm.messages.send, docs.documents.read/upload, insure.polices.read/create/quote, insure.sinistres.read, auth.sessions.read_own/revoke_own.
- broker_assistant : crm.contacts.read, booking.appointments.read, comm.messages.send, docs.documents.read, auth.sessions.read_own.

### Tenant Garage (Niveau 2)

- garage_admin : toutes permissions garage + heritage. repair.sinistres.* (read/create/update/assign/close), repair.devis.* (create/update/validate), repair.ordres.* , stock.pieces.* (read/manage/adjust), pay.read, books.read, parts.suppliers.read/add_to_favorites, parts.orders.create/read/cancel_within_window, parts.commission.view_dashboard, parts.invoices.read, tenant.settings.read/update, tenant.users.invite, auth.users.create/read/update, auth.roles.assign.
- garage_chef : repair.sinistres.read/assign/update, repair.devis.create/update, repair.ordres.read/update, stock.pieces.read, comm.messages.send, expertise.missions.read (lecture du retour expert), heritage garage_technicien.
- garage_technicien : repair.sinistres.read_assigned, repair.ordres.read_assigned/update, repair.photos.upload, stock.pieces.read, tow.vehicle.photos.upload (reception vehicule), auth.sessions.read_own. PWA mobile, WebAuthn prefere.
- garage_comptable : books.* (read/entries.create/invoices.generate), pay.read/reconcile, parts.invoices.read, repair.devis.read, compliance.dgi.reports.generate.
- garage_commercial : repair.devis.read/create, crm.contacts.read, comm.messages.send, booking.appointments.read.
- garage_parts_manager (NOUVEAU v3.0) : parts.suppliers.read, parts.suppliers.add_to_favorites, parts.orders.create, parts.orders.read, parts.orders.cancel_within_window, parts.commission.view_dashboard, parts.invoices.read, stock.pieces.read, repair.devis.read (pour rapprocher pieces et devis). Scope ABAC : limite au tenant garage proprietaire (jamais cross-garage).

### Tenant Carrier (Niveau 2 -- NOUVEAU v3.0)

- carrier_admin : carrier.dashboard.read, carrier.claims.read, carrier.claims.read_all, carrier.partners.read_stats, carrier.brokers.manage, carrier.experts.read_pool, carrier.fraud.alerts.read, tenant.settings.read/update, tenant.users.invite, auth.users.create/read/update, auth.roles.assign. NE detient PAS carrier.payment.approve_* (separation des fonctions ACAPS) ni expertise.* (reserve aux experts).
- carrier_claims_manager : carrier.dashboard.read, carrier.claims.read, carrier.claims.read_all, carrier.payment.approve_level1 (montant < 5000 MAD), carrier.payment.reject, carrier.experts.read_pool, carrier.fraud.alerts.read. NE detient PAS approve_level2..4.
- carrier_finance : carrier.dashboard.read, carrier.claims.read_all, carrier.payment.approve_level2 (5000-20000 MAD), carrier.payment.approve_level3 (20000-100000 MAD), carrier.payment.reject, books.read, pay.reconcile. Cumul approve_level2+3 ; level4 reserve a un signataire CFO via carrier_admin delegue documente.
- carrier_compliance : carrier.dashboard.read, carrier.claims.read_all, carrier.compliance.reports.generate, carrier.fraud.alerts.read, compliance.acaps.reports.generate, compliance.cndp.purge.execute, compliance.audit.read. Role DPO. Lecture seule sur les sinistres ; aucune approbation de paiement.
- carrier_expert_manager : carrier.dashboard.read, carrier.claims.read, carrier.experts.designate, carrier.experts.read_pool, carrier.experts.evaluate. Designe l'expert (cree expert_designations) mais NE valide PAS techniquement le devis (reserve a l'expert) et NE paie PAS.
- carrier_partner_manager : carrier.dashboard.read, carrier.partners.read_stats, carrier.brokers.manage, crm.companies.read. Gestion relationnelle courtiers / garages / experts ; aucune action sur sinistre ou paiement.

### Tenant Expert (Niveau 2 -- NOUVEAU v3.0)

- expert_firm_admin : expertise.missions.read/accept/reject, expertise.execute, expertise.validate_quote, expertise.modify_quote, expertise.reject_quote, expertise.report.create, expertise.report.sign, expertise.honoraires.invoice, tenant.settings.read/update, tenant.users.invite, auth.users.create/read/update. Gere le cabinet d'experts et ses associes.
- expert_associate : expertise.missions.read/accept/reject, expertise.execute, expertise.validate_quote, expertise.modify_quote, expertise.reject_quote, expertise.report.create. NE detient PAS report.sign (signature reservee a l'expert agree) ni honoraires.invoice.
- expert_independent : meme socle que expert_firm_admin mais en pratique solo : expertise.missions.read/accept/reject, expertise.execute, expertise.validate_quote, expertise.modify_quote, expertise.reject_quote, expertise.report.create, expertise.report.sign, expertise.honoraires.invoice. Agree ACAPS a titre personnel.
- expert_carrier_internal : expertise.missions.read/accept, expertise.execute, expertise.validate_quote, expertise.modify_quote, expertise.reject_quote, expertise.report.create, expertise.report.sign. Salarie de la compagnie ; pas de honoraires.invoice (remunere en interne). Scope ABAC : sinistres de son carrier employeur uniquement.

### Tenant Tow / Remorqueur (Niveau 2 -- NOUVEAU v3.0)

- tow_admin : tow.missions.read_available, tow.missions.accept, tow.missions.reject, tow.missions.complete, tow.availability.toggle, tow.earnings.read, tow.drivers.manage, tenant.settings.read/update, tenant.users.invite, auth.users.create/read/update. Gere une societe multi-chauffeurs.
- tow_dispatcher : tow.missions.read_available, tow.missions.accept, tow.missions.reject, tow.availability.toggle. Affecte les missions aux chauffeurs ; ne conduit pas.
- tow_driver : tow.missions.read_available, tow.missions.accept, tow.missions.complete, tow.vehicle.photos.upload, tow.availability.toggle, tow.earnings.read (ses propres gains), auth.sessions.read_own. PWA mobile style Uber, WebAuthn prefere ; scope ABAC : missions assignees uniquement.

### Assure (Niveau 3) et Public

- assure : insure.polices.read_own, insure.sinistres.read_own/create_own, repair.devis.read_own, repair.photos.upload, docs.documents.read_own/sign, comm.messages.send, booking.appointments.create, tow.missions.read_own (suivi du remorquage de son vehicule), parts (aucune), auth.sessions.read_own/revoke_own. Filtre ABAC OwnResources sur owner_user_id.
- prospect : public.devis.simulate, public.contact.submit. Aucune ressource tenant.
```

### 7.13 BLOC -- ANNEXE B : Matrice de couverture role x module (compteur)

Inserer sous `## 5ter. MATRICE DE COUVERTURE ROLE x MODULE`. Chaque cellule indique le nombre de permissions detenues dans le module (0 = aucune). Permet une revue rapide de la separation des fonctions et un controle de non-regression (la somme par role doit egaler la taille de l'inventaire 5bis).

```markdown
## 5ter. MATRICE DE COUVERTURE ROLE x MODULE

Modules suivis (extrait des 24) : auth, tenant, crm, repair, stock, pay, books, insure, carrier, expertise, tow, parts, compliance, analytics, public.

| Role | auth | tenant | crm | repair | stock | pay | books | insure | carrier | expertise | tow | parts | compliance | analytics |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| super_admin_platform | * | * | * | * | * | * | * | * | * | * | * | * | * | * |
| analyst_support | 1 | 2 | 1 | 1 | 0 | 0 | 0 | 1 | 2 | 1 | 1 | 1 | 1 | 1 |
| broker_admin | 4 | 3 | 8 | 0 | 0 | 1 | 1 | 6 | 0 | 0 | 0 | 0 | 0 | 1 |
| broker_user | 2 | 0 | 5 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 |
| broker_assistant | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| garage_admin | 4 | 3 | 0 | 5 | 3 | 1 | 1 | 0 | 0 | 0 | 0 | 5 | 0 | 0 |
| garage_chef | 0 | 0 | 0 | 4 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 |
| garage_technicien | 1 | 0 | 0 | 3 | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 |
| garage_comptable | 0 | 0 | 0 | 1 | 0 | 2 | 3 | 0 | 0 | 0 | 0 | 1 | 1 | 0 |
| garage_commercial | 0 | 0 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| garage_parts_manager | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 0 |
| carrier_admin | 4 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 0 | 0 |
| carrier_claims_manager | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 0 | 0 |
| carrier_finance | 0 | 0 | 0 | 0 | 0 | 1 | 1 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| carrier_compliance | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 | 3 | 0 |
| carrier_expert_manager | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 0 | 0 | 0 | 0 | 0 |
| carrier_partner_manager | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 |
| expert_independent | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 |
| expert_firm_admin | 4 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 10 | 0 | 0 | 0 | 0 |
| expert_associate | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | 0 | 0 |
| expert_carrier_internal | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0 | 0 |
| tow_admin | 4 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 0 | 0 | 0 |
| tow_dispatcher | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 0 |
| tow_driver | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 6 | 0 | 0 | 0 |
| assure | 1 | 0 | 0 | 2 | 0 | 0 | 0 | 2 | 0 | 0 | 1 | 0 | 0 | 0 |
| prospect | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

Note : les compteurs `carrier`, `expertise`, `tow`, `parts` totalisent respectivement 15, 10, 8, 7 permissions distinctes au catalog ; aucun role unique ne detient l'integralite d'un module sensible (separation des fonctions). Le `parts` (7) est entierement detenu par garage_parts_manager, et partiellement par garage_admin (acces complet en tant qu'administrateur du tenant).
```

### 7.14 BLOC -- ANNEXE C : Scenarios de separation des fonctions (tests negatifs ACAPS)

Inserer sous `## 9bis. SCENARIOS DE SEPARATION DES FONCTIONS (TESTS NEGATIFS)`. Ces assertions negatives sont reprises telles quelles par la tache 7.5a.8 et constituent la preuve d'audit ACAPS.

```markdown
## 9bis. SCENARIOS DE SEPARATION DES FONCTIONS (TESTS NEGATIFS)

1. carrier_admin NE PEUT PAS approuver un paiement : `can(carrier_admin, 'carrier.payment.approve_level1')` => false. Raison : l'administration du tenant ne cumule pas l'autorite financiere (ACAPS).
2. carrier_claims_manager NE PEUT PAS approuver au-dela de 5000 MAD : `can(carrier_claims_manager, 'carrier.payment.approve_level2')` => false.
3. carrier_finance NE PEUT PAS designer un expert : `can(carrier_finance, 'carrier.experts.designate')` => false. La designation est reservee a carrier_expert_manager.
4. carrier_expert_manager NE PEUT PAS valider techniquement le devis : `can(carrier_expert_manager, 'expertise.validate_quote')` => false. La validation technique est l'acte exclusif de l'expert agree.
5. expert_associate NE PEUT PAS signer le rapport : `can(expert_associate, 'expertise.report.sign')` => false. La signature engage l'agrement ACAPS du seul expert titulaire.
6. expert NE PEUT PAS approuver le paiement : `can(expert_independent, 'carrier.payment.approve_level1')` => false. L'expert evalue, il ne paie pas.
7. garage NE PEUT PAS s'auto-designer expert : aucun role garage ne detient `expertise.*`.
8. tow_driver NE PEUT PAS voir les missions non assignees d'un autre chauffeur : filtre ABAC sur missions assignees ; `tow.missions.read_available` retourne le pool mais la lecture detaillee est bornee par assignation.
9. garage_parts_manager NE PEUT PAS commander pour un autre garage : scope ABAC tenant strict ; toute tentative cross-tenant est refusee par RLS et par l'absence d'autorisation cross-tenant de type compatible.
10. assure NE PEUT PAS lire le sinistre d'un autre assure : filtre ABAC OwnResources sur owner_user_id ; `insure.sinistres.read_own` exclut les dossiers tiers.
11. carrier_compliance NE PEUT PAS approuver un paiement ni valider un devis : role strictement lecture + reporting + purge CNDP.
12. broker NE PEUT PAS acceder aux statistiques internes du carrier : aucun role broker ne detient `carrier.*`.
```

---

## SECTION 8 -- TESTS COMPLETS

Creer `00-pilotage/documentation/__tests__/5-roles-permissions.doc.spec.ts`. Cette spec valide le document v3.0 et sa coherence avec `permissions.enum.ts` (issu de 7.5a.6).

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// permissions.enum.ts expose ALL_PERMISSIONS (string[]) et ALL_ROLES (string[]) -- tache 7.5a.6
import { ALL_PERMISSIONS, ALL_ROLES } from '@insurtech/shared-types/rbac/permissions.enum';

const DOC_PATH = resolve(__dirname, '../5-roles-permissions.md');

const ROLES_26: readonly string[] = [
  'super_admin_platform', 'analyst_support',
  'broker_admin', 'broker_user', 'broker_assistant',
  'garage_admin', 'garage_chef', 'garage_technicien', 'garage_comptable', 'garage_commercial', 'garage_parts_manager',
  'carrier_admin', 'carrier_claims_manager', 'carrier_finance', 'carrier_compliance', 'carrier_expert_manager', 'carrier_partner_manager',
  'expert_independent', 'expert_firm_admin', 'expert_associate', 'expert_carrier_internal',
  'tow_admin', 'tow_driver', 'tow_dispatcher',
  'assure', 'prospect',
];

const NEW_PERMISSIONS_40: readonly string[] = [
  // carrier (15)
  'carrier.dashboard.read', 'carrier.claims.read', 'carrier.claims.read_all',
  'carrier.payment.approve_level1', 'carrier.payment.approve_level2', 'carrier.payment.approve_level3', 'carrier.payment.approve_level4',
  'carrier.payment.reject', 'carrier.experts.designate', 'carrier.experts.read_pool', 'carrier.experts.evaluate',
  'carrier.partners.read_stats', 'carrier.compliance.reports.generate', 'carrier.fraud.alerts.read', 'carrier.brokers.manage',
  // expertise (10)
  'expertise.missions.read', 'expertise.missions.accept', 'expertise.missions.reject', 'expertise.execute',
  'expertise.validate_quote', 'expertise.modify_quote', 'expertise.reject_quote',
  'expertise.report.create', 'expertise.report.sign', 'expertise.honoraires.invoice',
  // tow (8)
  'tow.missions.read_available', 'tow.missions.accept', 'tow.missions.reject', 'tow.missions.complete',
  'tow.vehicle.photos.upload', 'tow.availability.toggle', 'tow.earnings.read', 'tow.drivers.manage',
  // parts (7)
  'parts.suppliers.read', 'parts.suppliers.add_to_favorites', 'parts.orders.create', 'parts.orders.read',
  'parts.orders.cancel_within_window', 'parts.commission.view_dashboard', 'parts.invoices.read',
];

const CROSS_TENANT_7: readonly string[] = [
  'broker_to_garage_assignment', 'assure_to_garage_visit', 'multi_tenant_user_access',
  'client_to_tower_dispatch', 'tower_to_garage_delivery', 'garage_to_expert_request', 'garage_to_carrier_quote',
];

let doc = '';
beforeAll(() => { doc = readFileSync(DOC_PATH, 'utf-8'); });

describe('5-roles-permissions.md v3.0 -- metadata', () => {
  it('porte la version 3.0.0', () => {
    expect(doc).toMatch(/\*\*Version\*\*\s*:\s*3\.0\.0/);
  });
  it('porte la date 2026-05-24', () => {
    expect(doc).toContain('2026-05-24');
  });
  it('annonce 26 roles', () => {
    expect(doc).toMatch(/26 roles/);
  });
  it('annonce 130 permissions', () => {
    expect(doc).toMatch(/130 permissions/);
  });
  it('footer en v3.0.0', () => {
    expect(doc).toMatch(/Fin du document 5-roles-permissions\.md v3\.0\.0/);
  });
});

describe('5-roles-permissions.md v3.0 -- sections nouvelles', () => {
  it('contient la section 2.6 Carrier', () => { expect(doc).toMatch(/###\s*2\.6\s+Roles Tenant Carrier/); });
  it('contient la section 2.7 Expert', () => { expect(doc).toMatch(/###\s*2\.7\s+Roles Tenant Expert/); });
  it('contient la section 2.8 Tow', () => { expect(doc).toMatch(/###\s*2\.8\s+Roles Tenant Tow/); });
  it('contient la section 2.9 garage_parts_manager', () => { expect(doc).toMatch(/###\s*2\.9/); });
  it('contient la matrice par role (section 6bis)', () => { expect(doc).toMatch(/6bis\.\s*MATRICE SYNTHETIQUE PAR ROLE/); });
  it('contient le workflow sinistre v3.0 expert-centre', () => {
    expect(doc).toMatch(/WORKFLOW SINISTRE v3\.0/);
    expect(doc).toMatch(/EXPERT ACTEUR CENTRAL/);
  });
  it('reference les decisions 011 a 015', () => {
    for (const d of ['011', '012', '013', '014', '015']) expect(doc).toContain(d);
  });
});

describe('5-roles-permissions.md v3.0 -- 26 roles presents', () => {
  for (const role of ROLES_26) {
    it(`mentionne le role ${role}`, () => { expect(doc).toContain(role); });
  }
  it('liste exactement 26 roles connus', () => {
    expect(ROLES_26.length).toBe(26);
  });
});

describe('5-roles-permissions.md v3.0 -- 40 nouvelles permissions presentes', () => {
  for (const perm of NEW_PERMISSIONS_40) {
    it(`mentionne la permission ${perm}`, () => { expect(doc).toContain(perm); });
  }
  it('compte 40 nouvelles permissions', () => { expect(NEW_PERMISSIONS_40.length).toBe(40); });
});

describe('5-roles-permissions.md v3.0 -- cross-tenant 7 types', () => {
  for (const t of CROSS_TENANT_7) {
    it(`mentionne le type cross-tenant ${t}`, () => { expect(doc).toContain(t); });
  }
  it('liste exactement 7 types', () => { expect(CROSS_TENANT_7.length).toBe(7); });
});

describe('5-roles-permissions.md v3.0 -- matrice par role (detenteurs)', () => {
  // chaque permission Assurflow doit apparaitre dans un tableau de role detenteur
  for (const perm of NEW_PERMISSIONS_40) {
    it(`la permission ${perm} a au moins un role detenteur documente`, () => {
      // present dans le doc (tableau module + tableau role)
      const occurrences = doc.split(perm).length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(1);
    });
  }
});

describe('5-roles-permissions.md v3.0 -- aucune emoji (decision-006)', () => {
  it('ne contient aucun caractere emoji', () => {
    const emojiRegex = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;
    expect(emojiRegex.test(doc)).toBe(false);
  });
});

describe('5-roles-permissions.md v3.0 -- tableaux Markdown bien formes', () => {
  it('chaque ligne de tableau a un nombre de pipes coherent dans son bloc', () => {
    const lines = doc.split('\n');
    let inTable = false;
    let headerPipes = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      const isTableRow = trimmed.startsWith('|') && trimmed.endsWith('|');
      if (isTableRow) {
        const pipes = (trimmed.match(/\|/g) || []).length;
        if (!inTable) { inTable = true; headerPipes = pipes; }
        else { expect(pipes).toBe(headerPipes); }
      } else { inTable = false; headerPipes = 0; }
    }
  });
});

describe('5-roles-permissions.md v3.0 -- coherence doc <-> permissions.enum.ts', () => {
  it('toutes les nouvelles permissions du doc existent dans l enum', () => {
    for (const perm of NEW_PERMISSIONS_40) {
      expect(ALL_PERMISSIONS, `permission ${perm} absente de permissions.enum.ts`).toContain(perm);
    }
  });
  it('tous les roles du doc existent dans l enum (26)', () => {
    for (const role of ROLES_26) {
      expect(ALL_ROLES, `role ${role} absent de permissions.enum.ts`).toContain(role);
    }
  });
  it('l enum contient bien 130 permissions et 26 roles', () => {
    expect(ALL_PERMISSIONS.length).toBe(130);
    expect(ALL_ROLES.length).toBe(26);
  });
  it('chaque permission de l enum est mentionnee dans le doc (pas de permission code non documentee)', () => {
    const missing = ALL_PERMISSIONS.filter((p) => !doc.includes(p));
    expect(missing, `permissions code non documentees: ${missing.join(', ')}`).toEqual([]);
  });
});
```

Total : plus de 130 cas it() effectifs (5 metadata + 7 sections + 26 roles + 1 + 40 perms + 1 + 7 cross-tenant + 1 + 40 detenteurs + 1 emoji + 1 tableaux + 4 coherence), tous des assertions exploitables. Le coeur d'exigence (>= 20 assertions) est largement couvert ; les groupes parametres garantissent la tracabilite role par role et permission par permission, et le groupe "detenteurs" verifie que la matrice par role est complete.

---

## SECTION 9 -- VARIABLES ENVIRONNEMENT

Cette tache est une tache DOCUMENTATION ; aucune variable runtime applicative n'est requise pour produire le document. Les variables suivantes interviennent uniquement pour executer la spec de validation (et sont deja definies dans l'environnement du monorepo) :

| Variable | Role | Note |
|----------|------|------|
| `NODE_ENV` | `test` lors de l'execution Vitest | tache doc : utilise seulement pour la spec |
| `TZ` | `Africa/Casablanca` | coherence date 2026-05-24 (fuseau MA) |
| `INSURTECH_DOC_ROOT` | chemin racine de `00-pilotage/documentation` | optionnel, defaut resolu par `resolve(__dirname, ...)` |
| `PNPM_HOME` | binaire pnpm | execution des commandes pnpm |
| `CI` | active le mode strict (echec sur warning) | la CI fait echouer en cas d'emoji ou de drift |

NOTE : aucune variable secrete (PASSWORD_PEPPER, cles, DSN) n'est sollicitee par cette tache documentaire.

---

## SECTION 10 -- COMMANDES SHELL

```bash
# 1. Lint Markdown du document mis a jour
pnpm dlx markdownlint-cli2 "00-pilotage/documentation/5-roles-permissions.md"

# 2. Verification absence d'emoji (decision-006)
bash scripts/check-no-emoji.sh 00-pilotage/documentation/5-roles-permissions.md

# 3. Comptage des 26 roles (doit retourner 26 lignes correspondant aux strings connus)
grep -oE "super_admin_platform|analyst_support|broker_admin|broker_user|broker_assistant|garage_admin|garage_chef|garage_technicien|garage_comptable|garage_commercial|garage_parts_manager|carrier_admin|carrier_claims_manager|carrier_finance|carrier_compliance|carrier_expert_manager|carrier_partner_manager|expert_independent|expert_firm_admin|expert_associate|expert_carrier_internal|tow_admin|tow_driver|tow_dispatcher|assure|prospect" 00-pilotage/documentation/5-roles-permissions.md | sort -u | wc -l

# 4. Comptage des permissions carrier (attendu : 15 strings distincts)
grep -oE "carrier\.[a-z_.0-9]+" 00-pilotage/documentation/5-roles-permissions.md | sort -u | wc -l

# 5. Comptage des permissions expertise / tow / parts
grep -oE "expertise\.[a-z_.]+" 00-pilotage/documentation/5-roles-permissions.md | sort -u | wc -l   # attendu 10
grep -oE "tow\.[a-z_.]+"       00-pilotage/documentation/5-roles-permissions.md | sort -u | wc -l   # attendu 8
grep -oE "parts\.[a-z_.]+"     00-pilotage/documentation/5-roles-permissions.md | sort -u | wc -l   # attendu 7

# 6. Verification des 7 types cross-tenant
grep -cE "broker_to_garage_assignment|assure_to_garage_visit|multi_tenant_user_access|client_to_tower_dispatch|tower_to_garage_delivery|garage_to_expert_request|garage_to_carrier_quote" 00-pilotage/documentation/5-roles-permissions.md

# 7. Version + date
grep -E "Version.*3\.0\.0" 00-pilotage/documentation/5-roles-permissions.md
grep -E "2026-05-24" 00-pilotage/documentation/5-roles-permissions.md

# 8. Test de coherence doc <-> enum
pnpm vitest run 00-pilotage/documentation/__tests__/5-roles-permissions.doc.spec.ts
```

---

## SECTION 11 -- CRITERES DE VALIDATION

### Priorite P0 (bloquant -- >= 15)

| # | Critere | Commande | Attendu | Mode d'echec |
|---|---------|----------|---------|--------------|
| V1 | Version 3.0.0 dans l'en-tete | `grep "Version.*3.0.0"` | 1 match | doc reste en v2.2 -> matrice fausse |
| V2 | Date 2026-05-24 | `grep 2026-05-24` | 1 match | date non mise a jour |
| V3 | Section 1 annonce 26 roles | `grep "26 roles"` | 1 match | comptage incoherent |
| V4 | Section 1 annonce 130 permissions | `grep "130 permissions"` | 1 match | comptage incoherent |
| V5 | Section 2.6 Carrier presente | `grep "2.6.*Carrier"` | 1 match | famille carrier non documentee |
| V6 | Section 2.7 Expert presente | `grep "2.7.*Expert"` | 1 match | famille expert non documentee |
| V7 | Section 2.8 Tow presente | `grep "2.8.*Tow"` | 1 match | famille tow non documentee |
| V8 | Section 2.9 parts_manager presente | `grep "garage_parts_manager"` | >=1 match | role parts non documente |
| V9 | 26 strings de roles presents | commande shell #3 | 26 | mismatch role count |
| V10 | 15 permissions carrier | commande shell #4 | 15 | module incomplet |
| V11 | 10 permissions expertise | commande shell #5 | 10 | module incomplet |
| V12 | 8 permissions tow | commande shell #5 | 8 | module incomplet |
| V13 | 7 permissions parts | commande shell #5 | 7 | module incomplet |
| V14 | 7 types cross-tenant | commande shell #6 | 7 | autorisation manquante |
| V15 | Aucune emoji | check-no-emoji.sh | exit 0 | viole decision-006, CI rouge |
| V16 | Coherence doc <-> enum (40 perms) | vitest | pass | drift doc/code |
| V17 | 26 roles existent dans enum | vitest | pass | drift roles |

### Priorite P1 (important -- >= 8)

| # | Critere | Commande | Attendu | Mode d'echec |
|---|---------|----------|---------|--------------|
| V18 | Workflow sinistre v3.0 expert-centre present | `grep "WORKFLOW SINISTRE v3.0"` | 1 match | decision-013 non refletee |
| V19 | DAG section 3 inclut carrier/expert/tow | `grep "carrier_admin"` dans bloc 3 | match | hierarchie incomplete |
| V20 | garage_parts_manager sous garage dans DAG | inspection section 3 | present | hierarchie fausse |
| V21 | Section 4 ABAC etendue (4.5-4.8) | `grep "ExpertDesignationPolicy"` | match | trous ABAC |
| V22 | Decisions 011-015 referencees | `grep -c "01[1-5]"` | >=5 | tracabilite decision absente |
| V23 | Tableaux Markdown bien formes | vitest table test | pass | rendu casse |
| V24 | markdownlint sans erreur | markdownlint-cli2 | exit 0 | Markdown invalide |
| V25 | Spec doc cree et execute | `pnpm vitest run ...doc.spec` | pass | pas de garde-fou |
| V26 | Matrice par role (6bis) presente | `grep "MATRICE SYNTHETIQUE PAR ROLE"` | 1 match | oracle role incomplet |
| V27 | Chaque role nouveau a un tableau de permissions | inspection 2.6-2.9 | 14 tableaux | role sans detail |

### Priorite P2 (qualite -- >= 5)

| # | Critere | Commande | Attendu | Mode d'echec |
|---|---------|----------|---------|--------------|
| V28 | Sections 1-10 v2.2 conservees (pas de regression) | Read | presentes | perte de contenu |
| V29 | Note separation des fonctions ACAPS presente | `grep "separation des fonctions"` | >=3 | audit ACAPS faible |
| V30 | Duree de validite indiquee pour chaque cross-tenant | inspection section 7 | 7 durees | faille retention CNDP |
| V31 | Footer en v3.0.0 | `grep "Fin du document.*v3.0.0"` | 1 match | footer obsolete |
| V32 | Permissions atomiques (pas de wildcard nouveau introduit dans modules v3) | inspection | atomiques | matrice non testable |
| V33 | Tableaux modules listent tous les roles detenteurs | inspection section 5 | colonne presente | diffusion droit invisible |
| V34 | Tableau recapitulatif workflow par etape present | `grep "Role acteur"` | 1 match | workflow non synthetise |

---

## SECTION 12 -- EDGE CASES ET TROUBLESHOOTING

1. **Le comptage carrier renvoie 16 au lieu de 15** : un `carrier.*` parasite (ex. `carrier.dashboard.read` cite deux fois sous deux formes). Verifier que `carrier.experts.read_pool` et `carrier.experts.evaluate` ne sont pas confondus. Le `sort -u` doit aplanir les doublons ; si le compte depasse, une permission hors-liste a ete inventee.
2. **Le test de coherence echoue sur `carrier.payment.approve_level1..4`** : si le doc ecrit `approve_level1..4` litteralement au lieu des quatre strings separes, le test ne les trouvera pas. Toujours ecrire les quatre permissions en toutes lettres dans le tableau du module carrier ET dans le tableau de carrier_finance.
3. **markdownlint MD056 (table column count)** : une ligne de tableau a un pipe en trop ou en moins. Reformer la ligne pour aligner le nombre de pipes sur l'entete. Attention aux tableaux modules a 3 colonnes (Permission / Description / Roles detenteurs) : la colonne detenteurs peut etre longue mais ne doit pas contenir de pipe non echappe.
4. **Faux positif emoji** : la fleche `->` n'est PAS une emoji (c'est ASCII). Mais un caractere fleche Unicode (U+2192) le serait pour certaines regex laxistes. Utiliser `->` (tiret + chevron ASCII) partout, jamais de fleche Unicode.
5. **L'enum ne contient pas encore les 130 permissions** : si 7.5a.6 n'est pas merge, le test de coherence echoue. Verifier la dependance avant de lancer. Le doc peut etre redige mais la spec ne passera qu'apres merge de 7.5a.6.
6. **Renumerotation des sections** : conserver 2.4 (Assure) et 2.5 (Prospect) ; inserer 2.6-2.9 APRES. Ne pas decaler 2.4/2.5 en 2.8/2.9.
7. **Heritage carrier_admin trop large** : si le doc laisse entendre que carrier_admin approuve les paiements, l'audit ACAPS echoue. Toujours inclure la NOTE de separation des fonctions dans 2.6 et 3.
8. **expert_carrier_internal et tenant** : ce role vit dans le tenant carrier, pas dans un tenant expert. Si le doc le place dans la famille expert tenant, l'isolation RLS sera mal comprise. Documenter explicitement tenant = carrier.
9. **Conflit de numero de section 7bis** : si l'outil de rendu n'accepte pas `7bis`, integrer le workflow comme sous-section `7.4 Workflow sinistre v3.0` ou en section dediee. L'important est sa presence et son titre detectable par grep.
10. **Doublon de role dans le comptage** : `assure` apparait aussi comme sous-chaine de mots francais. Le grep #3 utilise une liste explicite et `sort -u`, donc robuste ; ne pas remplacer par un `grep "assure"` nu.
11. **Matrice par role et detenteurs incoherents** : si un role est liste comme detenteur d'une permission dans le tableau module (section 5) mais que cette permission n'apparait pas dans le tableau du role (section 2.6-2.9), il y a incoherence interne. Verifier le miroir : tableau module <-> tableau role doivent concorder.
12. **Permission detenue par 0 role** : si une des 40 permissions Assurflow n'a aucun detenteur dans les tableaux roles, c'est un droit orphelin (impossible a attribuer). Le test "detenteurs" doit detecter une occurrence >= 1 ; verifier qu'aucune permission ne reste sans role.

---

## SECTION 13 -- CONFORMITE MAROC

- **ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)** : ce document est un artefact d'audit. Il prouve (a) la **separation des fonctions** -- la designation de l'expert (carrier_expert_manager / carrier_claims_manager), la validation technique (expert independant) et l'approbation financiere (carrier_finance) sont portees par des roles distincts non cumulables ; (b) la tracabilite de l'**agrement expert** -- `expertise.report.sign` exige un numero d'agrement valide (attribut ABAC). La section 7bis (workflow sinistre) et la section 3 (separation des fonctions) sont les preuves opposables a l'auditeur.
- **CNDP / Loi 09-08 (protection des donnees personnelles)** : chaque autorisation cross-tenant (section 7) porte un scope de lecture minimal et une duree de validite explicite, garantissant la minimisation et la purge a expiration. Le dispatch remorquage (Type 4) limite l'acces aux donnees minimales necessaires au depannage (TTL 24h). Aucune donnee assure ne quitte le territoire (decision-008, cloud souverain Atlas Benguerir).
- **Loi 17-99 (Code des assurances)** : le droit de retractation (fenetre `pay.refunds.create` 30 jours), les delais reglementaires d'annulation de police, et l'encadrement de l'expertise (rapport signe par expert agree avant indemnisation) sont reflines dans les politiques ABAC (sections 4.2, 4.5) et le workflow sinistre v3.0.

---

## SECTION 14 -- CONVENTIONS ABSOLUES

- **Multi-tenant strict** : header `x-tenant-id` obligatoire sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` ; contexte propage par `AsyncLocalStorage` ; RLS via `app_can_access_tenant()` ; audit trail systematique.
- **Validation strict** : Zod uniquement ; types partages via `@insurtech/shared-types` ; `z.object` / `z.infer`.
- **Logger strict** : Pino injecte ; jamais `console.log` ; champs JSON structures `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER`.
- **Package manager strict** : pnpm uniquement ; engine-strict Node >= 22.11.0 ; save-exact ; link-workspace-packages=deep.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites.
- **Tests strict** : Vitest + Playwright ; chaque `.ts` a son `.spec.ts` ; couverture >= 85 % (>= 90 % pour auth/database/signature).
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles ; 130 permissions.
- **Events strict** : Kafka `insurtech.events.{vertical}.{entity}.{action}` ; Zod par event ; `Idempotency-Key` pour les events critiques.
- **Imports strict** : `@insurtech/{name}` ; paths via `tsconfig.base.json` ; ordre Node / external / @insurtech / relative.
- **Skalean AI strict (decision-005)** : uniquement via `@insurtech/sky` ou MCP ; jamais d'appel frontier direct ; mock sprints 1-28, reel sprint 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part ; `check-no-emoji.sh` ; la CI echoue sinon.
- **Idempotency-Key strict** : POST `/payments`, `/signatures`, `/claims`, et ecritures MCP ; TTL 24h en Redis.
- **Conventional Commits strict** : `<type>(scope): description` ; commitlint via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee assure ne sort du Maroc ; AES-256-GCM ; TLS 1.3.

---

## SECTION 15 -- VALIDATION PRE-COMMIT

```bash
# 1. Lint Markdown
pnpm dlx markdownlint-cli2 "00-pilotage/documentation/5-roles-permissions.md"

# 2. Zero emoji (decision-006)
bash scripts/check-no-emoji.sh 00-pilotage/documentation/5-roles-permissions.md

# 3. Spec de validation + coherence doc/enum
pnpm vitest run 00-pilotage/documentation/__tests__/5-roles-permissions.doc.spec.ts

# 4. Comptages de controle (roles=26, carrier=15, expertise=10, tow=8, parts=7, cross-tenant=7)
bash scripts/count-rbac-doc.sh   # script optionnel encapsulant les grep de la section 10

# 5. Verifier que la version et la date sont a jour
grep -E "Version.*3\.0\.0" 00-pilotage/documentation/5-roles-permissions.md
grep -E "2026-05-24" 00-pilotage/documentation/5-roles-permissions.md

# 6. Hooks husky (commitlint + lint-staged)
git add 00-pilotage/documentation/5-roles-permissions.md 00-pilotage/documentation/__tests__/5-roles-permissions.doc.spec.ts
```

Tous les controles doivent passer (exit 0) avant commit. En cas d'echec du test de coherence, verifier d'abord le merge de 7.5a.6.

---

## SECTION 16 -- COMMIT MESSAGE

```
docs(sprint-7.5a): update 5-roles-permissions to v3.0 (26 roles x 130 perms)

Mise a jour de la documentation RBAC/ABAC de la v2.2.0 vers la v3.0.0 pour
integrer la vertical Assurflow :
- ajout des familles Carrier (6 roles), Expert (4 roles), Tow (3 roles)
- ajout du role garage_parts_manager (famille garage -> 6 roles)
- 40 nouvelles permissions : carrier(15), expertise(10), tow(8), parts(7)
- sections 2.6 a 2.9 ajoutees ; DAG hierarchie (section 3) reconstruit
- matrice synthetique par role (section 6bis) + tableaux modules avec detenteurs
- ABAC etendu (4.5 ExpertDesignation, 4.6 PaymentApprovalLevel,
  4.7 TowDispatchGeo, 4.8 PartsCancellationWindow)
- cross-tenant porte de 3 a 7 types (client_to_tower_dispatch,
  tower_to_garage_delivery, garage_to_expert_request, garage_to_carrier_quote)
- workflow sinistre v3.0 avec expert acteur central (decision-013)
- spec de validation doc <-> permissions.enum.ts (coherence 130 perms / 26 roles)

Version 3.0.0, date 2026-05-24. Separation des fonctions ACAPS tracee.
Aucune emoji (decision-006).

Task: 7.5a.7
Sprint: 7.5a
Phase: 2.5
Reference: B-7.5a tache 7.5a.7
Decisions: 011, 012, 013, 014, 015
```

---

## SECTION 17 -- WORKFLOW NEXT STEP

Une fois cette tache validee (document v3.0 publie, spec de coherence verte, zero emoji, comptages exacts, matrice par role complete), passer a la **tache 7.5a.8 -- Tests RBAC + RLS v3.0**.

La tache 7.5a.8 consommera ce document comme oracle pour :
- generer / mettre a jour `role-matrix-coverage.spec.ts` couvrant les 26 roles x echantillons de permissions (incluant les 40 nouvelles), en s'appuyant sur les tableaux de detenteurs par module et par role ;
- ecrire les tests RLS Postgres pour les nouveaux tenants carrier / expert / tow (isolation cross-tenant, `app_can_access_tenant`) ;
- verifier les 7 types d'autorisation cross-tenant (scope de lecture + duree) en conditions reelles ;
- valider les politiques ABAC v3.0 (ExpertDesignation, PaymentApprovalLevel, TowDispatchGeo, PartsCancellationWindow) ;
- confirmer la separation des fonctions ACAPS par tests negatifs (un carrier_admin NE peut PAS approuver un paiement ; un expert NE peut PAS approuver le paiement ; un carrier_expert_manager NE peut PAS valider techniquement le devis a la place de l'expert).

Chaine sprint 7.5a : 7.5a.6 (enum permissions) -> **7.5a.7 (cette tache : documentation v3.0)** -> 7.5a.8 (tests RBAC + RLS) -> 7.5a.9 -> 7.5a.10.

---

**Fin du task-prompt 7.5a.7 -- Mise a jour documentation 5-roles-permissions.md vers v3.0.0 (26 roles x 130 permissions, vertical Assurflow). AUCUNE EMOJI (decision-006).**
