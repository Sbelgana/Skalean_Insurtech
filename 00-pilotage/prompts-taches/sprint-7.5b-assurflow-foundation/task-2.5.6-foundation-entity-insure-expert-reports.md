# Task 2.5.6 -- Foundation entity `insure_expert_reports`

## 1. Header

| Champ | Valeur |
| --- | --- |
| Sprint | 7.5b (Assurflow Foundation -- Phase 2 / Sprint 5 du plan d'ensemble) |
| Reference | B-7.5b -- tache renumerotee 2.5.6 |
| Titre | Foundation entity `insure_expert_reports` (rapport d'expertise sur devis garage) |
| Phase | 2 (Verticale Assurflow -- fondations donnees expertise) |
| Priorite | P0 (bloquant pour la chaine d'expertise et de paiement carrier) |
| Effort estime | 1 heure |
| Dependances | 2.5.5 (`insure_expert_assignments` -- cible de la FK `assignment_id`) ; 2.5.1 (squelette entites TypeORM) ; Sprint 1 (`set_updated_at_column()`, `app_can_access_tenant()`) |
| Bloque | 2.5.7 (services squelettes `@insurtech/expertise`) |
| Densite cible | 80-150 ko |
| Emoji | AUCUNE EMOJI (decision-006 ABSOLUE) |
| Migration | `1735000000015-Sprint75bInsureExpertReports.ts` |
| Classe migration | `Sprint75bInsureExpertReports1735000000015` |
| Table creee | `insure_expert_reports` |
| Cloud | Atlas Benguerir (Maroc -- decision-008) |
| Naming | Skalean (societe) / Assurflow (verticale) / Sofidemy (marque) -- decision-011 |

Cette tache cree UNE table de fondation `insure_expert_reports` via une migration TypeORM brute (raw SQL), sans logique metier. La logique de validation ligne-a-ligne du devis, la generation PDF, et la signature electronique (Barid eSign, loi 43-20) sont DIFFEREES aux Sprints 14 et 22.7. La presente tache se borne a poser le schema, les index, le trigger `updated_at`, la RLS multi-tenant, et l'alignement avec l'entite TypeORM squelette. Elle produit egalement un document de chemin d'extension `repo/docs/expert-reports-sprint-22.7-extension-path.md`.

---

## 2. But

Poser la table de fondation `insure_expert_reports` qui materialise le **rapport d'expertise** produit par un expert mandate sur un **devis (devis garage)** dans le cadre d'un sinistre auto. Conformement a la decision-013, l'expert ne se contente pas d'observer : il **valide, modifie ou rejette** le devis avant que la compagnie d'assurance (carrier) ne procede au paiement. Le rapport d'expertise est donc un artefact pivot dans la chaine sinistre -> expertise -> paiement.

Le but precis et borne de cette tache est :

1. Creer la table `insure_expert_reports` avec son schema exact (colonnes, types `timestamptz`, contraintes CHECK, defaults JSONB et `text[]`).
2. Etablir les cles etrangeres vers `auth_tenants(id)`, `insure_expert_assignments(id)`, `insure_experts(id)`, `auth_users(id)`, avec les politiques `ON DELETE` correctes (CASCADE pour le tenant, RESTRICT pour les references metier).
3. Creer 5 index : `tenant`, `assignment`, `expert`, `devis`, `status`.
4. Activer la RLS (ENABLE + FORCE) et poser la policy d'isolation tenant `insure_expert_reports_tenant_isolation` basee sur `app_can_access_tenant(tenant_id)`.
5. Poser le trigger `trg_insure_expert_reports_updated_at` reutilisant la fonction Sprint 1 `set_updated_at_column()`.
6. Documenter par COMMENTs SQL chaque colonne sensible (notamment `devis_id` qui n'a pas de FK, et les colonnes de signature differees).
7. Aligner l'entite TypeORM `insure-expert-report.entity.ts` (squelette issu de 2.5.1) avec le schema reel.
8. Produire le document `repo/docs/expert-reports-sprint-22.7-extension-path.md` decrivant les services differes (`expert-validation.service.ts`, `expert-report-signing.service.ts`, `expert-report-submission.service.ts`).

Ce qui N'EST PAS dans le perimetre : aucun controller, aucun endpoint REST, aucun service metier, aucune integration Barid eSign reelle, aucune generation PDF reelle, aucun producer Kafka. Tout cela est explicitement differe (Sprint 14 = expertise applicative ; Sprint 22.7 = signature + soumission carrier).

---

## 3. Contexte etendu

### 3.1 Le workflow d'expertise et la decision-013

Dans la chaine de gestion d'un sinistre automobile chez Assurflow, lorsqu'un assure declare un sinistre et qu'un garage produit un devis de reparation, la compagnie d'assurance (carrier) ne paie pas le devis brut. Un **expert** est mandate (via `insure_expert_assignments`, tache 2.5.5) pour examiner le devis et le vehicule, puis produire un **rapport d'expertise**. La decision-013 acte explicitement que l'expert dispose de trois pouvoirs sur le devis :

- **`validated`** : l'expert valide le devis en l'etat. Le montant et les lignes proposees par le garage sont juges conformes. Le carrier peut payer le montant du devis.
- **`modified`** : l'expert modifie le devis. Certaines lignes sont revues a la baisse (main d'oeuvre surestimee, piece neuve remplacee par une piece d'occasion conforme, taux horaire ajuste), certaines lignes peuvent etre ajoutees ou retirees. Le montant final differe du devis initial. Les modifications sont consignees dans la colonne `modifications` (JSONB).
- **`rejected`** : l'expert rejette le devis. Le devis est juge non conforme (sinistre non couvert, fraude suspectee, devis non lie au sinistre declare, montant abusif sans justification). Le carrier ne paie pas et le dossier suit un autre circuit (contre-expertise, contentieux).

Ce pouvoir de validation/modification/rejet est le coeur du metier d'expertise et la raison d'etre de cette table. Le rapport est l'artefact qui porte cette decision, sa justification, ses preuves photographiques, et son statut de signature.

### 3.2 Le cycle de vie du rapport (status lifecycle)

La colonne `status` modelise le cycle de vie complet du rapport, avec une contrainte CHECK stricte limitant les valeurs autorisees. Le flux nominal est :

```
draft
  -> completed
       -> signed
            -> submitted_to_carrier
                 -> accepted_by_carrier   (chemin nominal)
                 -> contested_by_carrier  (chemin contentieux)
```

Detail de chaque etat :

- **`draft`** (defaut) : le rapport est en cours de redaction par l'expert. Le contenu (`report_content`) est partiel, la decision peut ne pas encore etre prise, les photos sont en cours d'upload. C'est l'etat initial a la creation.
- **`completed`** : l'expert a fini de remplir le rapport. La `decision` est posee (`validated` / `modified` / `rejected`), la justification est ecrite, les modifications (si `modified`) sont consignees. Le rapport est pret a etre signe.
- **`signed`** : le rapport a ete signe electroniquement par l'expert (Barid eSign, loi 43-20). Les colonnes `signature_id`, `signed_at` et `signature_legal_status='signed'` sont renseignees. La signature confere au rapport sa valeur juridique probante.
- **`submitted_to_carrier`** : le rapport signe a ete transmis a la compagnie d'assurance. `submitted_to_carrier_at` est renseigne. Le carrier accuse reception via `carrier_received_at`.
- **`accepted_by_carrier`** : le carrier accepte le rapport. C'est le declencheur du paiement (paiement gere dans une autre verticale/sprint, hors perimetre ici).
- **`contested_by_carrier`** : le carrier conteste le rapport (desaccord sur la decision ou les montants). Le dossier entre en circuit de contre-expertise.

Important pour la presente tache : la table NE contient PAS de machine a etats applicative. Les transitions sont gerees plus tard (Sprint 22.7, `expert-report-submission.service.ts`). Ici, on garantit seulement que `status` ne peut prendre qu'une des sept valeurs autorisees via la contrainte CHECK. Le defaut est `draft`.

### 3.3 La signature electronique differee (loi 43-20, Barid eSign)

Le Maroc dispose d'un cadre legal pour la signature electronique : la loi 43-20 relative aux services de confiance pour les transactions electroniques (qui a abroge et remplace la loi 53-05). Barid eSign (Barid Al-Maghrib / Poste Maroc) est un prestataire de services de confiance qualifie. Une signature electronique qualifiee confere au document une valeur juridique equivalente a la signature manuscrite.

Pour le rapport d'expertise, la signature est essentielle : un rapport non signe n'engage pas juridiquement l'expert. La table prevoit donc des colonnes dediees :

- `signature_id uuid` : identifiant de la signature cote prestataire (Barid eSign).
- `signed_at timestamptz` : horodatage de la signature.
- `signature_legal_status varchar(20) DEFAULT 'pending'` : statut juridique de la signature, avec CHECK sur `('pending','signed','expired')`. Une signature peut expirer (certificat revoque, delai depasse).

L'integration reelle avec Barid eSign (appels API, gestion des certificats, horodatage qualifie, archivage probant) est DIFFEREE au Sprint 22.7 via le service `expert-report-signing.service.ts`. La presente tache pose uniquement les colonnes et leurs contraintes. Les colonnes sont nullable (sauf `signature_legal_status` qui a un defaut `'pending'`), car un rapport en `draft` ou `completed` n'est pas encore signe.

### 3.4 Structure JSONB : `report_content` et `modifications`

Deux colonnes JSONB portent le contenu structure du rapport :

**`report_content jsonb NOT NULL DEFAULT '{}'`** : le contenu integral du rapport d'expertise. Structure prevue (documentee, non contrainte par la base a ce stade) :

```jsonc
{
  "vehicule": {
    "immatriculation": "12345-A-67",
    "marque": "Dacia",
    "modele": "Logan",
    "kilometrage": 84500,
    "vin": "UU1XXXXXXXXXXXXXX"
  },
  "sinistre": {
    "reference": "SIN-2026-0001234",
    "date_sinistre": "2026-05-10",
    "circonstances": "Collision arriere a faible vitesse"
  },
  "constatations": [
    { "zone": "pare-chocs arriere", "etat": "enfonce", "gravite": "moyenne" },
    { "zone": "feu arriere droit", "etat": "casse", "gravite": "legere" }
  ],
  "devis_lignes_analysees": [
    {
      "ligne_id": "L1",
      "libelle": "Pare-chocs arriere (piece)",
      "montant_devis": 2400.00,
      "montant_retenu": 2400.00,
      "verdict": "validated"
    }
  ],
  "montant_devis_initial": 8600.00,
  "montant_retenu_total": 7950.00
}
```

**`modifications jsonb DEFAULT '{}'`** : les modifications apportees par l'expert au devis, renseignee uniquement lorsque `decision = 'modified'`. Structure prevue :

```jsonc
{
  "lignes_modifiees": [
    {
      "ligne_id": "L4",
      "champ": "montant",
      "valeur_initiale": 1200.00,
      "valeur_retenue": 850.00,
      "motif": "Taux horaire main d'oeuvre ramene au bareme conventionnel"
    }
  ],
  "lignes_supprimees": [
    { "ligne_id": "L7", "motif": "Dommage prexistant non lie au sinistre" }
  ],
  "lignes_ajoutees": [],
  "ecart_montant": -650.00
}
```

A ce stade, la base ne contraint pas le schema interne du JSONB (pas de contrainte JSON Schema cote PostgreSQL). La validation structurelle sera effectuee cote applicatif par les schemas Zod du service `expert-validation.service.ts` (Sprint 22.7), qui s'appuiera sur `decimal.js` pour la precision monetaire ligne par ligne.

### 3.5 Aval : Sprints 14 et 22.7

- **Sprint 14** : implementation applicative de l'expertise. Controllers, endpoints REST, generation des rapports, upload des photos vers le stockage souverain (Atlas Benguerir), generation PDF reelle (`pdf_url`, `pdf_generated_at`).
- **Sprint 22.7** : signature electronique (Barid eSign / loi 43-20) et soumission au carrier. Trois services y sont prevus, documentes dans `repo/docs/expert-reports-sprint-22.7-extension-path.md` :
  - `expert-validation.service.ts` : validation ligne par ligne du devis avec `decimal.js`.
  - `expert-report-signing.service.ts` : signature Barid eSign (loi 43-20).
  - `expert-report-submission.service.ts` : transitions de statut vers le carrier.

### 3.6 Alternatives envisagees et trade-offs

| # | Alternative | Description | Verdict | Raison |
| --- | --- | --- | --- | --- |
| A1 | Stocker le rapport dans `insure_expert_assignments` | Ajouter les colonnes de rapport directement sur l'affectation | Rejete | Un affectation peut donner lieu a plusieurs versions de rapport (re-expertise) ; separation des responsabilites ; assignment = mandat, report = livrable. |
| A2 | Schema relationnel pur pour `report_content` | Tables filles pour constatations, lignes de devis analysees | Rejete a ce stade | Structure tres variable selon le type de sinistre ; JSONB plus souple ; les requetes analytiques fines ne sont pas requises avant Sprint 14. |
| A3 | FK reelle sur `devis_id` | Contrainte FK vers une table `insure_devis` | Differe | La table `insure_devis` n'existe pas encore dans 7.5b ; on documente `devis_id` par COMMENT et on ajoutera la FK quand la table existera. Evite un couplage prematurate et un blocage de migration. |
| A4 | `decision` en type ENUM PostgreSQL | `CREATE TYPE ... AS ENUM` | Rejete | Les ENUM PostgreSQL sont penibles a faire evoluer (ALTER TYPE) ; CHECK sur varchar plus souple et coherent avec les autres tables Assurflow. |
| A5 | `status` gere par machine a etats en base (triggers) | Triggers controlant les transitions | Rejete | Logique metier en base difficile a tester et a versionner ; transitions gerees cote service Sprint 22.7. |
| A6 | Signature stockee inline (blob) | Stocker la signature binaire dans la table | Rejete | La signature qualifiee est geree par Barid eSign ; on ne stocke qu'un `signature_id` de reference (conformite et archivage probant cote prestataire). |
| A7 | `photos_urls` en table fille | Table `insure_expert_report_photos` | Rejete a ce stade | `text[]` suffit pour un MVP de fondation ; pas de metadonnees riches requises avant Sprint 14. |

Trade-offs retenus : on privilegie la souplesse (JSONB, CHECK varchar, `text[]`) et le decouplage (pas de FK `devis_id` prematuree, pas de machine a etats en base) pour ne pas bloquer 7.5b, au prix d'une validation structurelle reportee cote applicatif (Zod + decimal.js, Sprint 22.7).

### 3.7 Douze pieges nommes a eviter

1. **Piege P1 -- ON DELETE CASCADE sur `assignment_id`** : ne JAMAIS mettre CASCADE sur `assignment_id` ni `expert_id`. Supprimer une affectation ne doit pas effacer un rapport signe (valeur probante). Utiliser `ON DELETE RESTRICT`.
2. **Piege P2 -- oublier FORCE ROW LEVEL SECURITY** : `ENABLE` seul ne s'applique pas au proprietaire de la table. `FORCE` est obligatoire pour que la RLS s'applique meme au role proprietaire (defense en profondeur multi-tenant).
3. **Piege P3 -- recreer `set_updated_at_column()`** : la fonction existe depuis Sprint 1. La migration ne doit PAS la recreer (CREATE OR REPLACE) ni la dropper dans `down()`. Elle est partagee par toutes les tables.
4. **Piege P4 -- FK `devis_id`** : ne pas declarer de FK sur `devis_id` (table inexistante en 7.5b). Documenter par COMMENT. Ajouter un index simple pour les jointures futures.
5. **Piege P5 -- JSONB sans DEFAULT** : `report_content` est NOT NULL ; sans `DEFAULT '{}'`, toute insertion partielle echoue. Idem `modifications` et `photos_urls` (defaut `'{}'`).
6. **Piege P6 -- CHECK sur valeur nullable** : `decision` est nullable (un `draft` peut ne pas avoir de decision). Le CHECK `decision IN (...)` autorise NULL automatiquement en SQL (CHECK ne rejette pas NULL). Ne pas ajouter `NOT NULL` par erreur.
7. **Piege P7 -- timestamp sans timezone** : utiliser `timestamptz` partout (`created_at`, `updated_at`, `signed_at`, `pdf_generated_at`, `submitted_to_carrier_at`, `carrier_received_at`). Jamais `timestamp` nu (decalage UTC/Casablanca).
8. **Piege P8 -- ordre des drops dans `down()`** : dropper le trigger AVANT la table est inutile (DROP TABLE supprime le trigger), mais dropper la policy puis la table est l'ordre sur. Ne JAMAIS dropper la fonction partagee.
9. **Piege P9 -- index manquant sur `tenant_id`** : sans index `tenant`, la RLS scanne toute la table a chaque requete (la policy filtre sur `tenant_id`). Index obligatoire.
10. **Piege P10 -- policy sans `app_can_access_tenant`** : ne pas ecrire `USING (tenant_id = current_setting(...))` mais utiliser la fonction d'abstraction `app_can_access_tenant(tenant_id)` (coherence avec tout le socle, gestion centralisee de l'acces tenant + admin).
11. **Piege P11 -- non-idempotence de la migration** : verifier que `up()` puis `down()` puis `up()` rejoue sans erreur (test d'idempotence). Pas de `IF NOT EXISTS` masquant un etat incoherent, mais `down()` doit nettoyer integralement.
12. **Piege P12 -- desalignement entite/SQL** : l'entite TypeORM `insure-expert-report.entity.ts` doit refleter EXACTEMENT les colonnes, types et nullabilite du SQL. Un desalignement (ex. `report_content` non `nullable: false`) provoque des erreurs runtime ou des migrations fantomes.

### 3.8 Decisions architecturales referencees

- **decision-006** : aucune emoji nulle part (CI bloquante). S'applique au code, aux commentaires, aux docs.
- **decision-008** : cloud souverain Maroc (Atlas Benguerir). Les donnees d'assure (PII, photos de sinistre) ne quittent jamais le territoire.
- **decision-011** : naming v3.0 (Skalean / Assurflow / Sofidemy).
- **decision-012** : les entites d'expertise (`insure_experts`, `insure_expert_assignments`, `insure_expert_reports`) forment un sous-domaine coherent avec isolation tenant stricte et `ON DELETE RESTRICT` sur les liens metier pour preserver la valeur probante.
- **decision-013** : l'expert valide / modifie / rejette le devis avant paiement carrier. C'est la justification metier centrale de la colonne `decision` et de la table.

---

## 4. Architecture context

### 4.1 Position dans la sequence

Cette tache est la **6e sur 9** de la sequence de fondation Assurflow 7.5b (apres `insure_experts` et `insure_expert_assignments`, avant les services squelettes). Position : 6/9.

```
2.5.1  Squelettes entites TypeORM ......... [fait]
2.5.4  insure_experts (013) ............... [fait]
2.5.5  insure_expert_assignments (014) .... [fait]  <- cible FK assignment_id
2.5.6  insure_expert_reports (015) ........ [CETTE TACHE]  position 6/9
2.5.7  Services squelettes expertise ...... [bloque par 2.5.6]
2.5.8+ ...
```

### 4.2 Diagramme des relations (sous-domaine expertise + flux carrier)

```
                         auth_tenants (id)
                              |
                              | tenant_id (FK, ON DELETE CASCADE)
                              v
   +------------------------------------------------------------------+
   |                                                                  |
   |   insure_experts (id)                                            |
   |        ^                                                         |
   |        | expert_id (FK, ON DELETE RESTRICT)                      |
   |        |                                                         |
   |   insure_expert_assignments (id)   <-- 2.5.5                     |
   |        ^                                                         |
   |        | assignment_id (FK, ON DELETE RESTRICT)                  |
   |        |                                                         |
   |   insure_expert_reports (id)       <-- 2.5.6 (CETTE TACHE)       |
   |        |  - expert_id      -> insure_experts(id)   RESTRICT      |
   |        |  - expert_user_id -> auth_users(id)       RESTRICT      |
   |        |  - devis_id       -> (pas de FH, COMMENT)               |
   |        |  - decision : validated | modified | rejected           |
   |        |  - status   : draft -> completed -> signed ->           |
   |        |               submitted_to_carrier ->                   |
   |        |               accepted_by_carrier | contested_by_carrier|
   |        |                                                         |
   +--------|---------------------------------------------------------+
            |
            | (Sprint 22.7) soumission
            v
   +-------------------------+        +----------------------------+
   |  Carrier (compagnie)    |  --->  |  Paiement (autre verticale)|
   |  accepted / contested   |        |  declenche si accepted     |
   +-------------------------+        +----------------------------+
```

Flux de soumission carrier (gere Sprint 22.7, hors perimetre code ici) :

```
expert remplit le rapport (draft)
   -> rapport complete (completed) : decision posee
   -> signature Barid eSign (signed) : signature_legal_status=signed
   -> soumission carrier (submitted_to_carrier) : submitted_to_carrier_at
   -> accusE reception (carrier_received_at)
   -> carrier decide :
        accepted_by_carrier  -> declenche paiement
        contested_by_carrier -> contre-expertise / contentieux
```

### 4.3 Couplages

- **Amont (dependances)** : `auth_tenants`, `auth_users` (socle Sprint 1) ; `insure_experts` (2.5.4) ; `insure_expert_assignments` (2.5.5).
- **Aval (consommateurs)** : services `@insurtech/expertise` (2.5.7) ; expertise applicative (Sprint 14) ; signature + soumission carrier (Sprint 22.7).
- **Lateral (a venir)** : `insure_devis` (table devis garage, non encore creee) ; verticale paiement.

---

## 5. Livrables checkables

- [ ] L1. Fichier migration `repo/.../migrations/1735000000015-Sprint75bInsureExpertReports.ts` cree.
- [ ] L2. Classe `Sprint75bInsureExpertReports1735000000015` implementant `MigrationInterface`.
- [ ] L3. `up()` cree la table `insure_expert_reports` avec les 24 colonnes du schema exact.
- [ ] L4. Colonne `id uuid PK DEFAULT gen_random_uuid()`.
- [ ] L5. FK `tenant_id -> auth_tenants(id) ON DELETE CASCADE`.
- [ ] L6. FK `assignment_id -> insure_expert_assignments(id) ON DELETE RESTRICT`.
- [ ] L7. FK `expert_id -> insure_experts(id) ON DELETE RESTRICT`.
- [ ] L8. FK `expert_user_id -> auth_users(id) ON DELETE RESTRICT`.
- [ ] L9. `devis_id uuid` SANS FK + COMMENT explicatif.
- [ ] L10. `report_content jsonb NOT NULL DEFAULT '{}'`.
- [ ] L11. `photos_urls text[] DEFAULT '{}'`.
- [ ] L12. `decision varchar(20)` avec CHECK `IN ('validated','modified','rejected')` (nullable).
- [ ] L13. `modifications jsonb DEFAULT '{}'`.
- [ ] L14. Colonnes signature : `signature_id uuid`, `signed_at timestamptz`, `signature_legal_status varchar(20) DEFAULT 'pending'` + CHECK `IN ('pending','signed','expired')`.
- [ ] L15. `status varchar(30) NOT NULL DEFAULT 'draft'` + CHECK sur les 7 valeurs.
- [ ] L16. Colonnes carrier : `submitted_to_carrier_at timestamptz`, `carrier_received_at timestamptz`.
- [ ] L17. `created_at` / `updated_at` `timestamptz NOT NULL DEFAULT now()`.
- [ ] L18. Index `idx_insure_expert_reports_tenant`.
- [ ] L19. Index `idx_insure_expert_reports_assignment`.
- [ ] L20. Index `idx_insure_expert_reports_expert`.
- [ ] L21. Index `idx_insure_expert_reports_devis`.
- [ ] L22. Index `idx_insure_expert_reports_status`.
- [ ] L23. RLS `ENABLE` + `FORCE` sur la table.
- [ ] L24. Policy `insure_expert_reports_tenant_isolation USING (app_can_access_tenant(tenant_id))`.
- [ ] L25. Trigger `trg_insure_expert_reports_updated_at` BEFORE UPDATE EXECUTE `set_updated_at_column()`.
- [ ] L26. COMMENTs SQL sur la table et les colonnes sensibles.
- [ ] L27. `down()` drop trigger + policy + table, sans jamais dropper `set_updated_at_column()`.
- [ ] L28. GRANT au role `insurtech_app` si necessaire.
- [ ] L29. Entite TypeORM `insure-expert-report.entity.ts` alignee (24 colonnes).
- [ ] L30. Fichier `repo/.../1735000000015-Sprint75bInsureExpertReports.spec.ts` (test de structure migration).
- [ ] L31. Fichier integration `insure-expert-reports.integration.spec.ts` (24+ cas).
- [ ] L32. Doc `repo/docs/expert-reports-sprint-22.7-extension-path.md` (~80 lignes).
- [ ] L33. `pnpm migration:run` passe ; `pnpm migration:revert` passe ; re-run idempotent.
- [ ] L34. `check-no-emoji.sh` passe sur tous les fichiers crees.

---

## 6. Fichiers crees / modifies

| # | Chemin | Type | Action | Description |
| --- | --- | --- | --- | --- |
| 1 | `repo/packages/database/src/migrations/1735000000015-Sprint75bInsureExpertReports.ts` | TypeScript (migration) | Cree | Migration TypeORM : CREATE TABLE + 5 index + RLS + policy + trigger + COMMENTs ; `down()` revert complet. |
| 2 | `repo/packages/database/src/migrations/1735000000015-Sprint75bInsureExpertReports.spec.ts` | TypeScript (test) | Cree | Test unitaire de structure de la migration (up/down, presence des instructions). |
| 3 | `repo/packages/database/src/entities/insure-expert-report.entity.ts` | TypeScript (entite) | Modifie | Alignement du squelette 2.5.1 avec le schema reel (24 colonnes typees). |
| 4 | `repo/packages/database/test/insure-expert-reports.integration.spec.ts` | TypeScript (test integration) | Cree | 24+ cas : CHECK decision/status/signature, FK, RLS 2 tenants, JSONB defaults, down revert, idempotence. |
| 5 | `repo/docs/expert-reports-sprint-22.7-extension-path.md` | Markdown (doc) | Cree | Chemin d'extension Sprint 22.7 : 3 services differes. |
| 6 | `repo/packages/database/src/entities/index.ts` | TypeScript (barrel) | Modifie | Export de `InsureExpertReport` si pas deja present. |

---

## 7. Code patterns COMPLETS

### 7.1 Migration TypeORM complete

Fichier : `repo/packages/database/src/migrations/1735000000015-Sprint75bInsureExpertReports.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 7.5b -- Tache 2.5.6
 * Table de fondation: insure_expert_reports
 *
 * Rapport d'expertise produit par un expert mandate sur un devis garage.
 * Decision-013: l'expert valide / modifie / rejette le devis avant paiement carrier.
 *
 * Dependances:
 *  - auth_tenants(id), auth_users(id)        [Sprint 1]
 *  - insure_experts(id)                      [Tache 2.5.4]
 *  - insure_expert_assignments(id)           [Tache 2.5.5]
 *  - set_updated_at_column()                 [Sprint 1, fonction partagee, JAMAIS recreee/droppee]
 *  - app_can_access_tenant(uuid)             [Sprint 1, abstraction RLS]
 *
 * Signature electronique (Barid eSign, loi 43-20) + generation PDF + soumission carrier:
 *  DIFFEREES aux Sprints 14 et 22.7. Cette migration pose uniquement le schema.
 *
 * AUCUNE EMOJI (decision-006).
 */
export class Sprint75bInsureExpertReports1735000000015
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) Table principale
    await queryRunner.query(`
      CREATE TABLE "insure_expert_reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL,
        "assignment_id" uuid NOT NULL,
        "expert_id" uuid NOT NULL,
        "expert_user_id" uuid NOT NULL,
        "devis_id" uuid,
        "report_content" jsonb NOT NULL DEFAULT '{}',
        "photos_urls" text[] DEFAULT '{}',
        "decision" varchar(20),
        "decision_justification" text,
        "modifications" jsonb DEFAULT '{}',
        "pdf_url" text,
        "pdf_generated_at" timestamptz,
        "signature_id" uuid,
        "signed_at" timestamptz,
        "signature_legal_status" varchar(20) DEFAULT 'pending',
        "status" varchar(30) NOT NULL DEFAULT 'draft',
        "submitted_to_carrier_at" timestamptz,
        "carrier_received_at" timestamptz,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_insure_expert_reports" PRIMARY KEY ("id"),
        CONSTRAINT "chk_insure_expert_reports_decision"
          CHECK ("decision" IN ('validated', 'modified', 'rejected')),
        CONSTRAINT "chk_insure_expert_reports_signature_legal_status"
          CHECK ("signature_legal_status" IN ('pending', 'signed', 'expired')),
        CONSTRAINT "chk_insure_expert_reports_status"
          CHECK ("status" IN (
            'draft',
            'completed',
            'signed',
            'submitted_to_carrier',
            'accepted_by_carrier',
            'contested_by_carrier'
          )),
        CONSTRAINT "fk_insure_expert_reports_tenant"
          FOREIGN KEY ("tenant_id") REFERENCES "auth_tenants" ("id")
          ON DELETE CASCADE,
        CONSTRAINT "fk_insure_expert_reports_assignment"
          FOREIGN KEY ("assignment_id") REFERENCES "insure_expert_assignments" ("id")
          ON DELETE RESTRICT,
        CONSTRAINT "fk_insure_expert_reports_expert"
          FOREIGN KEY ("expert_id") REFERENCES "insure_experts" ("id")
          ON DELETE RESTRICT,
        CONSTRAINT "fk_insure_expert_reports_expert_user"
          FOREIGN KEY ("expert_user_id") REFERENCES "auth_users" ("id")
          ON DELETE RESTRICT
      )
    `);

    // 2) Index (RLS performante + jointures)
    await queryRunner.query(`
      CREATE INDEX "idx_insure_expert_reports_tenant"
        ON "insure_expert_reports" ("tenant_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_insure_expert_reports_assignment"
        ON "insure_expert_reports" ("assignment_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_insure_expert_reports_expert"
        ON "insure_expert_reports" ("expert_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_insure_expert_reports_devis"
        ON "insure_expert_reports" ("devis_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_insure_expert_reports_status"
        ON "insure_expert_reports" ("status")
    `);

    // 3) RLS: ENABLE + FORCE (defense en profondeur, s'applique aussi au proprietaire)
    await queryRunner.query(`
      ALTER TABLE "insure_expert_reports" ENABLE ROW LEVEL SECURITY
    `);
    await queryRunner.query(`
      ALTER TABLE "insure_expert_reports" FORCE ROW LEVEL SECURITY
    `);

    // 4) Policy d'isolation tenant via abstraction app_can_access_tenant()
    await queryRunner.query(`
      CREATE POLICY "insure_expert_reports_tenant_isolation"
        ON "insure_expert_reports"
        USING (app_can_access_tenant("tenant_id"))
    `);

    // 5) Trigger updated_at (reutilise la fonction partagee Sprint 1)
    await queryRunner.query(`
      CREATE TRIGGER "trg_insure_expert_reports_updated_at"
        BEFORE UPDATE ON "insure_expert_reports"
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at_column()
    `);

    // 6) GRANT au role applicatif (RLS reste appliquee via la policy)
    await queryRunner.query(`
      GRANT SELECT, INSERT, UPDATE, DELETE
        ON "insure_expert_reports" TO "insurtech_app"
    `);

    // 7) COMMENTs (documentation in-base, conformite + tracabilite)
    await queryRunner.query(`
      COMMENT ON TABLE "insure_expert_reports" IS
        'Sprint 7.5b 2.5.6 -- Rapport d''expertise sur devis garage. Decision-013: l''expert valide/modifie/rejette le devis avant paiement carrier. Signature (Barid eSign loi 43-20) et soumission carrier differees Sprint 14/22.7.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "insure_expert_reports"."devis_id" IS
        'Reference au devis garage. PAS de FK: la table insure_devis n''existe pas encore en 7.5b. FK a ajouter ulterieurement. Index idx_insure_expert_reports_devis present pour les jointures futures.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "insure_expert_reports"."report_content" IS
        'Contenu structure du rapport (vehicule, sinistre, constatations, lignes de devis analysees). Validation structurelle cote applicatif (Zod) Sprint 22.7.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "insure_expert_reports"."modifications" IS
        'Modifications apportees au devis quand decision=modified (lignes modifiees/supprimees/ajoutees, ecart montant). Validation decimal.js Sprint 22.7.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "insure_expert_reports"."decision" IS
        'Decision de l''expert sur le devis: validated | modified | rejected (decision-013). Nullable tant que status=draft.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "insure_expert_reports"."signature_id" IS
        'Identifiant de signature cote prestataire Barid eSign (loi 43-20). Integration reelle differee Sprint 22.7. On ne stocke jamais la signature binaire.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "insure_expert_reports"."signature_legal_status" IS
        'Statut juridique de la signature: pending | signed | expired (certificat revoque/delai depasse). Loi 43-20.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "insure_expert_reports"."status" IS
        'Cycle de vie: draft -> completed -> signed -> submitted_to_carrier -> accepted_by_carrier | contested_by_carrier. Transitions gerees Sprint 22.7 (expert-report-submission.service.ts).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN "insure_expert_reports"."photos_urls" IS
        'URLs des photos de sinistre (stockage souverain Atlas Benguerir, decision-008). PII -- protege par RLS (CNDP 09-08).'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordre de revert: trigger -> policy -> table.
    // NE JAMAIS dropper set_updated_at_column() ni app_can_access_tenant() (fonctions partagees Sprint 1).
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS "trg_insure_expert_reports_updated_at"
        ON "insure_expert_reports"
    `);
    await queryRunner.query(`
      DROP POLICY IF EXISTS "insure_expert_reports_tenant_isolation"
        ON "insure_expert_reports"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "insure_expert_reports"
    `);
  }
}
```

### 7.2 Test de structure de la migration

Fichier : `repo/packages/database/src/migrations/1735000000015-Sprint75bInsureExpertReports.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { QueryRunner } from 'typeorm';
import { Sprint75bInsureExpertReports1735000000015 } from './1735000000015-Sprint75bInsureExpertReports';

/**
 * Test unitaire de structure: on capture les requetes SQL emises
 * par up() et down() sans base reelle (QueryRunner mocke).
 * Verifie la presence et l'ordre des instructions critiques.
 */
describe('Sprint75bInsureExpertReports1735000000015 (structure)', () => {
  let queries: string[];
  let queryRunner: QueryRunner;

  beforeEach(() => {
    queries = [];
    queryRunner = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as unknown as QueryRunner;
  });

  it('expose le bon nom de classe (convention de numerotation)', () => {
    const migration = new Sprint75bInsureExpertReports1735000000015();
    expect(migration.constructor.name).toBe(
      'Sprint75bInsureExpertReports1735000000015',
    );
  });

  describe('up()', () => {
    beforeEach(async () => {
      const migration = new Sprint75bInsureExpertReports1735000000015();
      await migration.up(queryRunner);
    });

    it('cree la table insure_expert_reports', () => {
      const joined = queries.join('\n');
      expect(joined).toContain('CREATE TABLE "insure_expert_reports"');
    });

    it('definit id uuid PK DEFAULT gen_random_uuid()', () => {
      const joined = queries.join('\n');
      expect(joined).toContain('gen_random_uuid()');
      expect(joined).toContain('PRIMARY KEY ("id")');
    });

    it('cree la FK tenant ON DELETE CASCADE', () => {
      const joined = queries.join('\n');
      expect(joined).toMatch(
        /FOREIGN KEY \("tenant_id"\) REFERENCES "auth_tenants" \("id"\)\s+ON DELETE CASCADE/,
      );
    });

    it('cree les FK assignment/expert/expert_user en ON DELETE RESTRICT', () => {
      const joined = queries.join('\n');
      expect(joined).toContain('"insure_expert_assignments" ("id")');
      expect(joined).toContain('"insure_experts" ("id")');
      expect(joined).toContain('"auth_users" ("id")');
      const restrictCount = (joined.match(/ON DELETE RESTRICT/g) ?? []).length;
      expect(restrictCount).toBeGreaterThanOrEqual(3);
    });

    it('ne declare PAS de FK sur devis_id', () => {
      const joined = queries.join('\n');
      expect(joined).not.toMatch(
        /FOREIGN KEY \("devis_id"\)/,
      );
    });

    it('pose les 3 CHECK (decision, signature_legal_status, status)', () => {
      const joined = queries.join('\n');
      expect(joined).toContain("'validated', 'modified', 'rejected'");
      expect(joined).toContain("'pending', 'signed', 'expired'");
      expect(joined).toContain("'submitted_to_carrier'");
      expect(joined).toContain("'contested_by_carrier'");
    });

    it('cree les 5 index', () => {
      const joined = queries.join('\n');
      expect(joined).toContain('idx_insure_expert_reports_tenant');
      expect(joined).toContain('idx_insure_expert_reports_assignment');
      expect(joined).toContain('idx_insure_expert_reports_expert');
      expect(joined).toContain('idx_insure_expert_reports_devis');
      expect(joined).toContain('idx_insure_expert_reports_status');
    });

    it('active ENABLE et FORCE row level security', () => {
      const joined = queries.join('\n');
      expect(joined).toContain('ENABLE ROW LEVEL SECURITY');
      expect(joined).toContain('FORCE ROW LEVEL SECURITY');
    });

    it('cree la policy d isolation tenant via app_can_access_tenant', () => {
      const joined = queries.join('\n');
      expect(joined).toContain(
        'CREATE POLICY "insure_expert_reports_tenant_isolation"',
      );
      expect(joined).toContain('app_can_access_tenant("tenant_id")');
    });

    it('cree le trigger updated_at reutilisant set_updated_at_column()', () => {
      const joined = queries.join('\n');
      expect(joined).toContain(
        'CREATE TRIGGER "trg_insure_expert_reports_updated_at"',
      );
      expect(joined).toContain('EXECUTE FUNCTION set_updated_at_column()');
    });

    it('ne recree JAMAIS set_updated_at_column()', () => {
      const joined = queries.join('\n');
      expect(joined).not.toContain('CREATE OR REPLACE FUNCTION set_updated_at_column');
    });

    it('pose des COMMENTs (table + colonnes sensibles)', () => {
      const joined = queries.join('\n');
      expect(joined).toContain('COMMENT ON TABLE "insure_expert_reports"');
      expect(joined).toContain('COMMENT ON COLUMN "insure_expert_reports"."devis_id"');
    });

    it('utilise timestamptz partout (jamais timestamp nu)', () => {
      const joined = queries.join('\n');
      expect(joined).toContain('timestamptz');
      expect(joined).not.toMatch(/\btimestamp\b(?!tz)/);
    });
  });

  describe('down()', () => {
    beforeEach(async () => {
      const migration = new Sprint75bInsureExpertReports1735000000015();
      await migration.down(queryRunner);
    });

    it('drop le trigger, la policy et la table', () => {
      const joined = queries.join('\n');
      expect(joined).toContain('DROP TRIGGER IF EXISTS "trg_insure_expert_reports_updated_at"');
      expect(joined).toContain('DROP POLICY IF EXISTS "insure_expert_reports_tenant_isolation"');
      expect(joined).toContain('DROP TABLE IF EXISTS "insure_expert_reports"');
    });

    it('ne drop JAMAIS la fonction partagee set_updated_at_column()', () => {
      const joined = queries.join('\n');
      expect(joined).not.toContain('DROP FUNCTION');
      expect(joined).not.toContain('set_updated_at_column');
    });
  });
});
```

### 7.3 Test d'integration (harness pg reel)

Fichier : `repo/packages/database/test/insure-expert-reports.integration.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Client } from 'pg';

/**
 * Test d'integration sur PostgreSQL reel.
 * Pre-requis: la migration 1735000000015 a ete jouee (table presente),
 * ainsi que les migrations amont (auth_tenants, auth_users, insure_experts,
 * insure_expert_assignments), set_updated_at_column() et app_can_access_tenant().
 *
 * Strategie tenant: on simule le contexte applicatif via
 * SET LOCAL app.current_tenant_id (lu par app_can_access_tenant()).
 *
 * AUCUNE EMOJI.
 */
const CONN = {
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: Number(process.env.DATABASE_PORT ?? 5432),
  user: process.env.DATABASE_TEST_USER ?? 'insurtech_app',
  password: process.env.DATABASE_TEST_PASSWORD ?? 'insurtech_app_pwd',
  database: process.env.DATABASE_TEST_NAME ?? 'insurtech_test',
};

const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

let client: Client;

// Identifiants amont crees en setup (un par tenant)
const seed = {
  a: { expert: '', user: '', assignment: '' },
  b: { expert: '', user: '', assignment: '' },
};

async function setTenant(c: Client, tenantId: string): Promise<void> {
  // SET LOCAL doit etre dans une transaction
  await c.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
}

async function seedTenant(
  c: Client,
  tenantId: string,
): Promise<{ expert: string; user: string; assignment: string }> {
  await c.query('BEGIN');
  await setTenant(c, tenantId);

  await c.query(
    `INSERT INTO auth_tenants (id, name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO NOTHING`,
    [tenantId, `tenant-${tenantId.slice(0, 8)}`],
  );

  const userRes = await c.query(
    `INSERT INTO auth_users (tenant_id, email)
     VALUES ($1, $2)
     RETURNING id`,
    [tenantId, `expert-${tenantId.slice(0, 8)}@example.ma`],
  );
  const userId = userRes.rows[0].id as string;

  const expertRes = await c.query(
    `INSERT INTO insure_experts (tenant_id, user_id, full_name)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [tenantId, userId, 'Expert Test'],
  );
  const expertId = expertRes.rows[0].id as string;

  const assignRes = await c.query(
    `INSERT INTO insure_expert_assignments (tenant_id, expert_id)
     VALUES ($1, $2)
     RETURNING id`,
    [tenantId, expertId],
  );
  const assignmentId = assignRes.rows[0].id as string;

  await c.query('COMMIT');
  return { expert: expertId, user: userId, assignment: assignmentId };
}

async function insertReport(
  c: Client,
  tenantId: string,
  s: { expert: string; user: string; assignment: string },
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const cols: string[] = [
    'tenant_id',
    'assignment_id',
    'expert_id',
    'expert_user_id',
  ];
  const vals: unknown[] = [tenantId, s.assignment, s.expert, s.user];
  for (const [k, v] of Object.entries(overrides)) {
    cols.push(k);
    vals.push(v);
  }
  const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
  const res = await c.query(
    `INSERT INTO insure_expert_reports (${cols.join(', ')})
     VALUES (${placeholders})
     RETURNING id`,
    vals,
  );
  return res.rows[0].id as string;
}

beforeAll(async () => {
  client = new Client(CONN);
  await client.connect();
  seed.a = await seedTenant(client, TENANT_A);
  seed.b = await seedTenant(client, TENANT_B);
});

afterAll(async () => {
  await client.end();
});

beforeEach(async () => {
  // Nettoyage des rapports entre les tests (sous contexte tenant pour la RLS)
  await client.query('BEGIN');
  await setTenant(client, TENANT_A);
  await client.query('DELETE FROM insure_expert_reports');
  await client.query('COMMIT');
  await client.query('BEGIN');
  await setTenant(client, TENANT_B);
  await client.query('DELETE FROM insure_expert_reports');
  await client.query('COMMIT');
});

describe('insure_expert_reports -- structure et defaults', () => {
  it('cas 1: insertion minimale -> status defaut draft', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a);
    const res = await client.query(
      'SELECT status FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(res.rows[0].status).toBe('draft');
  });

  it('cas 2: report_content defaut = objet vide', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a);
    const res = await client.query(
      'SELECT report_content FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(res.rows[0].report_content).toEqual({});
  });

  it('cas 3: modifications defaut = objet vide', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a);
    const res = await client.query(
      'SELECT modifications FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(res.rows[0].modifications).toEqual({});
  });

  it('cas 4: photos_urls defaut = tableau vide', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a);
    const res = await client.query(
      'SELECT photos_urls FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(res.rows[0].photos_urls).toEqual([]);
  });

  it('cas 5: signature_legal_status defaut = pending', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a);
    const res = await client.query(
      'SELECT signature_legal_status FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(res.rows[0].signature_legal_status).toBe('pending');
  });

  it('cas 6: id genere automatiquement (uuid)', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a);
    await client.query('COMMIT');
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('cas 7: created_at et updated_at renseignes par defaut', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a);
    const res = await client.query(
      'SELECT created_at, updated_at FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(res.rows[0].created_at).toBeInstanceOf(Date);
    expect(res.rows[0].updated_at).toBeInstanceOf(Date);
  });
});

describe('insure_expert_reports -- contraintes CHECK', () => {
  it('cas 8: decision=validated accepte', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a, {
      decision: 'validated',
    });
    await client.query('COMMIT');
    expect(id).toBeTruthy();
  });

  it('cas 9: decision=modified accepte', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a, {
      decision: 'modified',
    });
    await client.query('COMMIT');
    expect(id).toBeTruthy();
  });

  it('cas 10: decision=rejected accepte', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a, {
      decision: 'rejected',
    });
    await client.query('COMMIT');
    expect(id).toBeTruthy();
  });

  it('cas 11: decision=NULL accepte (draft sans decision)', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a, {
      decision: null,
    });
    await client.query('COMMIT');
    expect(id).toBeTruthy();
  });

  it('cas 12: decision invalide rejetee par le CHECK', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    await expect(
      insertReport(client, TENANT_A, seed.a, { decision: 'approved' }),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
  });

  it('cas 13: status invalide rejete par le CHECK', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    await expect(
      insertReport(client, TENANT_A, seed.a, { status: 'archived' }),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
  });

  it('cas 14: tous les status valides acceptes', async () => {
    const valid = [
      'draft',
      'completed',
      'signed',
      'submitted_to_carrier',
      'accepted_by_carrier',
      'contested_by_carrier',
    ];
    for (const status of valid) {
      await client.query('BEGIN');
      await setTenant(client, TENANT_A);
      const id = await insertReport(client, TENANT_A, seed.a, { status });
      await client.query('COMMIT');
      expect(id).toBeTruthy();
    }
  });

  it('cas 15: signature_legal_status invalide rejete', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    await expect(
      insertReport(client, TENANT_A, seed.a, {
        signature_legal_status: 'revoked',
      }),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
  });

  it('cas 16: signature_legal_status=expired accepte', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a, {
      signature_legal_status: 'expired',
    });
    await client.query('COMMIT');
    expect(id).toBeTruthy();
  });
});

describe('insure_expert_reports -- cles etrangeres', () => {
  it('cas 17: FK assignment_id inexistant rejetee', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    await expect(
      insertReport(client, TENANT_A, {
        ...seed.a,
        assignment: '99999999-9999-9999-9999-999999999999',
      }),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
  });

  it('cas 18: FK expert_id inexistant rejetee', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    await expect(
      insertReport(client, TENANT_A, {
        ...seed.a,
        expert: '99999999-9999-9999-9999-999999999999',
      }),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
  });

  it('cas 19: FK expert_user_id inexistant rejetee', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    await expect(
      insertReport(client, TENANT_A, {
        ...seed.a,
        user: '99999999-9999-9999-9999-999999999999',
      }),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
  });

  it('cas 20: ON DELETE RESTRICT empeche la suppression d un assignment avec rapport', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    await insertReport(client, TENANT_A, seed.a);
    await expect(
      client.query('DELETE FROM insure_expert_assignments WHERE id = $1', [
        seed.a.assignment,
      ]),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
  });

  it('cas 21: devis_id accepte une valeur arbitraire (pas de FK)', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a, {
      devis_id: '88888888-8888-8888-8888-888888888888',
    });
    await client.query('COMMIT');
    expect(id).toBeTruthy();
  });
});

describe('insure_expert_reports -- RLS isolation tenant', () => {
  it('cas 22: tenant A ne voit pas les rapports du tenant B', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_B);
    await insertReport(client, TENANT_B, seed.b);
    await client.query('COMMIT');

    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const res = await client.query('SELECT id FROM insure_expert_reports');
    await client.query('COMMIT');
    expect(res.rows.length).toBe(0);
  });

  it('cas 23: tenant B voit ses propres rapports', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_B);
    await insertReport(client, TENANT_B, seed.b);
    const res = await client.query('SELECT id FROM insure_expert_reports');
    await client.query('COMMIT');
    expect(res.rows.length).toBe(1);
  });

  it('cas 24: insertion cross-tenant bloquee par la policy', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    // tenter d inserer une ligne portant le tenant_id de B sous contexte A
    await expect(
      insertReport(client, TENANT_B, seed.b),
    ).rejects.toThrow();
    await client.query('ROLLBACK');
  });
});

describe('insure_expert_reports -- trigger updated_at', () => {
  it('cas 25: updated_at change apres UPDATE', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a);
    const before = await client.query(
      'SELECT updated_at FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await new Promise((r) => setTimeout(r, 10));
    await client.query(
      `UPDATE insure_expert_reports SET status = 'completed' WHERE id = $1`,
      [id],
    );
    const after = await client.query(
      'SELECT updated_at FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(new Date(after.rows[0].updated_at).getTime()).toBeGreaterThan(
      new Date(before.rows[0].updated_at).getTime(),
    );
  });
});

describe('insure_expert_reports -- JSONB et tableaux', () => {
  it('cas 26: report_content accepte un objet structure', async () => {
    const content = {
      vehicule: { immatriculation: '12345-A-67', marque: 'Dacia' },
      montant_retenu_total: 7950.0,
    };
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a, {
      report_content: JSON.stringify(content),
    });
    const res = await client.query(
      'SELECT report_content FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(res.rows[0].report_content.vehicule.marque).toBe('Dacia');
  });

  it('cas 27: photos_urls accepte un tableau d URLs', async () => {
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a, {
      photos_urls: ['https://s3.atlas-benguerir.ma/p1.jpg', 'https://s3.atlas-benguerir.ma/p2.jpg'],
    });
    const res = await client.query(
      'SELECT photos_urls FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(res.rows[0].photos_urls).toHaveLength(2);
  });

  it('cas 28: modifications accepte un objet (decision=modified)', async () => {
    const mods = {
      lignes_modifiees: [
        { ligne_id: 'L4', valeur_initiale: 1200.0, valeur_retenue: 850.0 },
      ],
      ecart_montant: -350.0,
    };
    await client.query('BEGIN');
    await setTenant(client, TENANT_A);
    const id = await insertReport(client, TENANT_A, seed.a, {
      decision: 'modified',
      modifications: JSON.stringify(mods),
    });
    const res = await client.query(
      'SELECT modifications FROM insure_expert_reports WHERE id = $1',
      [id],
    );
    await client.query('COMMIT');
    expect(res.rows[0].modifications.ecart_montant).toBe(-350.0);
  });
});

describe('insure_expert_reports -- metadonnees de schema', () => {
  it('cas 29: la table existe avec les 24 colonnes', async () => {
    const res = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'insure_expert_reports'`,
    );
    const names = res.rows.map((r) => r.column_name);
    const expected = [
      'id', 'tenant_id', 'assignment_id', 'expert_id', 'expert_user_id',
      'devis_id', 'report_content', 'photos_urls', 'decision',
      'decision_justification', 'modifications', 'pdf_url', 'pdf_generated_at',
      'signature_id', 'signed_at', 'signature_legal_status', 'status',
      'submitted_to_carrier_at', 'carrier_received_at', 'notes',
      'created_at', 'updated_at',
    ];
    for (const col of expected) {
      expect(names).toContain(col);
    }
  });

  it('cas 30: les 5 index existent', async () => {
    const res = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'insure_expert_reports'`,
    );
    const idx = res.rows.map((r) => r.indexname);
    expect(idx).toContain('idx_insure_expert_reports_tenant');
    expect(idx).toContain('idx_insure_expert_reports_assignment');
    expect(idx).toContain('idx_insure_expert_reports_expert');
    expect(idx).toContain('idx_insure_expert_reports_devis');
    expect(idx).toContain('idx_insure_expert_reports_status');
  });

  it('cas 31: RLS activee et forcee', async () => {
    const res = await client.query(
      `SELECT relrowsecurity, relforcerowsecurity
       FROM pg_class WHERE relname = 'insure_expert_reports'`,
    );
    expect(res.rows[0].relrowsecurity).toBe(true);
    expect(res.rows[0].relforcerowsecurity).toBe(true);
  });

  it('cas 32: la policy d isolation existe', async () => {
    const res = await client.query(
      `SELECT policyname FROM pg_policies
       WHERE tablename = 'insure_expert_reports'`,
    );
    const pol = res.rows.map((r) => r.policyname);
    expect(pol).toContain('insure_expert_reports_tenant_isolation');
  });
});
```

### 7.4 Entite TypeORM alignee

Fichier : `repo/packages/database/src/entities/insure-expert-report.entity.ts` (squelette 2.5.1 mis a jour pour refleter le schema reel).

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Entite InsureExpertReport -- mappe la table insure_expert_reports.
 * Alignee EXACTEMENT sur la migration 1735000000015.
 * AUCUNE EMOJI.
 */
export type ExpertDecision = 'validated' | 'modified' | 'rejected';

export type SignatureLegalStatus = 'pending' | 'signed' | 'expired';

export type ExpertReportStatus =
  | 'draft'
  | 'completed'
  | 'signed'
  | 'submitted_to_carrier'
  | 'accepted_by_carrier'
  | 'contested_by_carrier';

@Entity({ name: 'insure_expert_reports' })
@Index('idx_insure_expert_reports_tenant', ['tenantId'])
@Index('idx_insure_expert_reports_assignment', ['assignmentId'])
@Index('idx_insure_expert_reports_expert', ['expertId'])
@Index('idx_insure_expert_reports_devis', ['devisId'])
@Index('idx_insure_expert_reports_status', ['status'])
export class InsureExpertReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @Column({ name: 'expert_id', type: 'uuid' })
  expertId!: string;

  @Column({ name: 'expert_user_id', type: 'uuid' })
  expertUserId!: string;

  // Pas de relation FK: la table insure_devis n'existe pas encore (7.5b).
  @Column({ name: 'devis_id', type: 'uuid', nullable: true })
  devisId!: string | null;

  @Column({ name: 'report_content', type: 'jsonb', default: () => `'{}'` })
  reportContent!: Record<string, unknown>;

  @Column({ name: 'photos_urls', type: 'text', array: true, default: () => `'{}'` })
  photosUrls!: string[];

  @Column({ name: 'decision', type: 'varchar', length: 20, nullable: true })
  decision!: ExpertDecision | null;

  @Column({ name: 'decision_justification', type: 'text', nullable: true })
  decisionJustification!: string | null;

  @Column({ name: 'modifications', type: 'jsonb', default: () => `'{}'` })
  modifications!: Record<string, unknown>;

  @Column({ name: 'pdf_url', type: 'text', nullable: true })
  pdfUrl!: string | null;

  @Column({ name: 'pdf_generated_at', type: 'timestamptz', nullable: true })
  pdfGeneratedAt!: Date | null;

  @Column({ name: 'signature_id', type: 'uuid', nullable: true })
  signatureId!: string | null;

  @Column({ name: 'signed_at', type: 'timestamptz', nullable: true })
  signedAt!: Date | null;

  @Column({
    name: 'signature_legal_status',
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  signatureLegalStatus!: SignatureLegalStatus;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'draft' })
  status!: ExpertReportStatus;

  @Column({ name: 'submitted_to_carrier_at', type: 'timestamptz', nullable: true })
  submittedToCarrierAt!: Date | null;

  @Column({ name: 'carrier_received_at', type: 'timestamptz', nullable: true })
  carrierReceivedAt!: Date | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

Alignement entite <-> SQL (verification croisee) :

| Colonne SQL | Type SQL | Propriete entite | Type TS | Nullable |
| --- | --- | --- | --- | --- |
| id | uuid PK | id | string | non |
| tenant_id | uuid | tenantId | string | non |
| assignment_id | uuid | assignmentId | string | non |
| expert_id | uuid | expertId | string | non |
| expert_user_id | uuid | expertUserId | string | non |
| devis_id | uuid | devisId | string \| null | oui |
| report_content | jsonb | reportContent | Record | non (def {}) |
| photos_urls | text[] | photosUrls | string[] | def {} |
| decision | varchar(20) | decision | ExpertDecision \| null | oui |
| decision_justification | text | decisionJustification | string \| null | oui |
| modifications | jsonb | modifications | Record | def {} |
| pdf_url | text | pdfUrl | string \| null | oui |
| pdf_generated_at | timestamptz | pdfGeneratedAt | Date \| null | oui |
| signature_id | uuid | signatureId | string \| null | oui |
| signed_at | timestamptz | signedAt | Date \| null | oui |
| signature_legal_status | varchar(20) | signatureLegalStatus | SignatureLegalStatus | def pending |
| status | varchar(30) | status | ExpertReportStatus | def draft |
| submitted_to_carrier_at | timestamptz | submittedToCarrierAt | Date \| null | oui |
| carrier_received_at | timestamptz | carrierReceivedAt | Date \| null | oui |
| notes | text | notes | string \| null | oui |
| created_at | timestamptz | createdAt | Date | non |
| updated_at | timestamptz | updatedAt | Date | non |

### 7.5 Barrel d'export (modification)

Fichier : `repo/packages/database/src/entities/index.ts` (ajout si absent).

```typescript
export { InsureExpertReport } from './insure-expert-report.entity';
export type {
  ExpertDecision,
  SignatureLegalStatus,
  ExpertReportStatus,
} from './insure-expert-report.entity';
```

### 7.6 Document de chemin d'extension Sprint 22.7

Fichier a creer : `repo/docs/expert-reports-sprint-22.7-extension-path.md`. Contenu integral (a ecrire tel quel) :

```markdown
# Chemin d'extension Sprint 22.7 -- Services rapport d'expertise

Statut: DIFFERE. La table insure_expert_reports (Sprint 7.5b, tache 2.5.6) pose
le schema. Les services applicatifs ci-dessous sont implementes au Sprint 22.7
(signature + soumission carrier), apres l'expertise applicative du Sprint 14.

AUCUNE EMOJI (decision-006).

## 1. expert-validation.service.ts

Role: validation ligne par ligne du devis garage avant decision de l'expert.

- Lit le devis (table insure_devis, creee avant le Sprint 14) et le rapport
  insure_expert_reports associe via devis_id.
- Pour chaque ligne du devis, compare le montant propose par le garage et le
  montant retenu par l'expert. Calculs monetaires avec decimal.js (jamais de
  flottant natif) pour eviter les erreurs d'arrondi (precision 2 decimales, MAD).
- Produit le bloc report_content.devis_lignes_analysees et calcule
  montant_retenu_total = somme des montants retenus.
- Determine la decision: validated (aucun ecart), modified (au moins une ligne
  ajustee/supprimee/ajoutee), rejected (devis non conforme).
- Renseigne modifications quand decision=modified (lignes_modifiees,
  lignes_supprimees, lignes_ajoutees, ecart_montant).
- Validation structurelle des entrees/sorties via schemas Zod exportes.
- Logger Pino structure: tenant_id, user_id, request_id, action, duration_ms.

## 2. expert-report-signing.service.ts

Role: signature electronique du rapport via Barid eSign (loi 43-20).

- Genere le PDF du rapport (report_content -> PDF), renseigne pdf_url et
  pdf_generated_at. Stockage souverain Atlas Benguerir (decision-008).
- Initie la signature qualifiee aupres de Barid eSign (prestataire de services
  de confiance qualifie, loi 43-20). On ne stocke jamais la signature binaire:
  uniquement signature_id (reference cote prestataire) et signed_at.
- Met a jour signature_legal_status: pending -> signed (succes) ou expired
  (certificat revoque / delai depasse).
- Transition status: completed -> signed.
- Idempotency-Key obligatoire (operation de signature = critique, TTL 24h Redis).
- Endpoint POST /api/v1/.../signatures protege par @Roles() (expert) +
  RolesGuard + TenantGuard. Coverage >= 90% (module signature).
- Evenement Kafka: insurtech.events.assurflow.expert_report.signed (schema Zod).

## 3. expert-report-submission.service.ts

Role: transitions de statut vers la compagnie d'assurance (carrier).

- Verifie les preconditions: status=signed et signature_legal_status=signed
  avant toute soumission (un rapport non signe n'engage pas l'expert).
- Transition signed -> submitted_to_carrier; renseigne submitted_to_carrier_at.
- Receptionne l'accuse du carrier; renseigne carrier_received_at.
- Transition submitted_to_carrier -> accepted_by_carrier (declenche le paiement,
  gere dans la verticale paiement) ou contested_by_carrier (contre-expertise).
- Machine a etats applicative stricte: toute transition non autorisee est
  rejetee (ex. draft -> submitted_to_carrier interdit).
- Evenements Kafka: insurtech.events.assurflow.expert_report.submitted,
  insurtech.events.assurflow.expert_report.accepted,
  insurtech.events.assurflow.expert_report.contested.
- Audit trail complet de chaque transition (tracabilite ACAPS).

## Dependances de donnees a poser avant le Sprint 22.7

- Table insure_devis (devis garage) + FK insure_expert_reports.devis_id.
- Integration Barid eSign (configuration prestataire, certificats).
- Bucket de stockage souverain pour les PDF signes (Atlas Benguerir).

## Garanties heritees de la table 7.5b

- RLS multi-tenant (app_can_access_tenant) deja active sur la table.
- Contraintes CHECK sur decision, status, signature_legal_status deja en place.
- Trigger updated_at deja pose.
- Les services 22.7 n'ont qu'a ajouter la logique, pas a modifier le schema
  (sauf ajout de la FK devis_id quand insure_devis existe).
```

---

## 8. Tests complets

La couverture de test s'appuie sur deux fichiers : le test de structure (section 7.2, QueryRunner mocke) et le test d'integration sur PostgreSQL reel (section 7.3). Le harness pg utilise `SET LOCAL app.current_tenant_id` dans une transaction pour simuler le contexte applicatif lu par `app_can_access_tenant()`.

### 8.1 Recapitulatif des 32 cas d'integration

| Cas | Groupe | Verifie | Resultat attendu |
| --- | --- | --- | --- |
| 1 | structure/defaults | status defaut | `draft` |
| 2 | structure/defaults | report_content defaut | `{}` |
| 3 | structure/defaults | modifications defaut | `{}` |
| 4 | structure/defaults | photos_urls defaut | `[]` |
| 5 | structure/defaults | signature_legal_status defaut | `pending` |
| 6 | structure/defaults | id genere | uuid valide |
| 7 | structure/defaults | created_at/updated_at | Date renseignee |
| 8 | CHECK | decision=validated | accepte |
| 9 | CHECK | decision=modified | accepte |
| 10 | CHECK | decision=rejected | accepte |
| 11 | CHECK | decision NULL | accepte (draft) |
| 12 | CHECK | decision invalide | rejete |
| 13 | CHECK | status invalide | rejete |
| 14 | CHECK | 6 status valides | tous acceptes |
| 15 | CHECK | signature_legal_status invalide | rejete |
| 16 | CHECK | signature_legal_status=expired | accepte |
| 17 | FK | assignment_id inexistant | rejete |
| 18 | FK | expert_id inexistant | rejete |
| 19 | FK | expert_user_id inexistant | rejete |
| 20 | FK | ON DELETE RESTRICT assignment | suppression bloquee |
| 21 | FK | devis_id arbitraire | accepte (pas de FK) |
| 22 | RLS | tenant A ne voit pas B | 0 lignes |
| 23 | RLS | tenant B voit ses lignes | 1 ligne |
| 24 | RLS | insertion cross-tenant | rejete |
| 25 | trigger | updated_at apres UPDATE | augmente |
| 26 | JSONB | report_content structure | lisible |
| 27 | tableau | photos_urls | longueur 2 |
| 28 | JSONB | modifications | ecart lisible |
| 29 | schema | 24 colonnes presentes | OK |
| 30 | schema | 5 index presents | OK |
| 31 | schema | RLS enable+force | true/true |
| 32 | schema | policy presente | OK |

### 8.2 Cas additionnels recommandes (down/idempotence)

Au-dela des 32 cas du fichier d'integration, le test de structure (section 7.2) couvre :

- structure-1 : nom de classe correct.
- structure-2 a structure-13 : presence des instructions critiques de `up()` (CREATE TABLE, PK, FK CASCADE, FK RESTRICT x3, absence FK devis_id, 3 CHECK, 5 index, ENABLE+FORCE, policy, trigger, non-recreation de la fonction, COMMENTs, timestamptz exclusif).
- structure-14 a structure-15 : `down()` drop trigger + policy + table, et ne drop jamais la fonction partagee.

### 8.3 Test d'idempotence (script dedie)

Le critere V (section 11) couvre l'idempotence via la sequence `migration:run` -> `migration:revert` -> `migration:run`. Verifier qu'aucune erreur n'est levee et que la table est identique apres re-run.

### 8.4 Couverture cible

- Migration : 100% des instructions (test de structure).
- Table database : >= 90% (regle renforcee `database` dans les conventions).
- Total package database : >= 85%.

---

## 9. Variables d'environnement

| Variable | Role | Exemple / defaut | Obligatoire |
| --- | --- | --- | --- |
| `DATABASE_HOST` | Hote PostgreSQL | `localhost` | oui |
| `DATABASE_PORT` | Port PostgreSQL | `5432` | oui |
| `DATABASE_TEST_USER` | Role applicatif de test (RLS appliquee) | `insurtech_app` | oui |
| `DATABASE_TEST_PASSWORD` | Mot de passe du role de test | `insurtech_app_pwd` | oui |
| `DATABASE_TEST_NAME` | Base de test isolee | `insurtech_test` | oui |
| `DATABASE_URL` | Chaine de connexion complete (CLI migration) | `postgres://insurtech_app:...@localhost:5432/insurtech_test` | oui |
| `NODE_ENV` | Environnement | `test` | recommande |
| `PASSWORD_PEPPER` | Pepper argon2id (socle, hors perimetre direct) | (secret) | herite |

Remarque : le role de test doit etre `insurtech_app` (role applicatif non superuser) pour que `FORCE ROW LEVEL SECURITY` s'applique reellement. Un superuser contournerait la RLS et invaliderait les cas 22-24.

---

## 10. Commandes shell

```bash
# Depuis la racine du monorepo (pnpm only, Node >= 22.11.0, engine-strict)
cd repo

# 1) Installer (si necessaire)
pnpm install

# 2) Lancer la base de test (docker compose local)
pnpm db:test:up

# 3) Jouer toutes les migrations jusqu a 1735000000015
pnpm --filter @insurtech/database migration:run

# 4) Verifier la presence de la table
psql "$DATABASE_URL" -c "\d+ insure_expert_reports"

# 5) Lancer le test de structure (migration mockee)
pnpm --filter @insurtech/database test src/migrations/1735000000015-Sprint75bInsureExpertReports.spec.ts

# 6) Lancer le test d integration (pg reel)
pnpm --filter @insurtech/database test test/insure-expert-reports.integration.spec.ts

# 7) Verifier le revert
pnpm --filter @insurtech/database migration:revert

# 8) Re-jouer (idempotence)
pnpm --filter @insurtech/database migration:run

# 9) Lint + typecheck
pnpm --filter @insurtech/database lint
pnpm --filter @insurtech/database typecheck

# 10) Verifier l absence d emoji (CI bloquante, decision-006)
bash scripts/check-no-emoji.sh \
  repo/packages/database/src/migrations/1735000000015-Sprint75bInsureExpertReports.ts \
  repo/packages/database/src/migrations/1735000000015-Sprint75bInsureExpertReports.spec.ts \
  repo/packages/database/src/entities/insure-expert-report.entity.ts \
  repo/packages/database/test/insure-expert-reports.integration.spec.ts \
  repo/docs/expert-reports-sprint-22.7-extension-path.md

# 11) Coverage du package database
pnpm --filter @insurtech/database test --coverage
```

---

## 11. Criteres de validation

Format : ID -- priorite -- commande -- attendu -- mode d'echec.

### Criteres P0 (bloquants -- minimum 15)

- **V1 (P0)** -- `pnpm --filter @insurtech/database migration:run` -- migration 015 appliquee sans erreur -- Echec : exception SQL (FK amont manquante, syntaxe).
- **V2 (P0)** -- `psql "$DATABASE_URL" -c "\dt insure_expert_reports"` -- la table existe -- Echec : table absente => `up()` n'a pas cree la table.
- **V3 (P0)** -- `psql "$DATABASE_URL" -c "\d insure_expert_reports"` -- 24 colonnes presentes -- Echec : colonne manquante => schema incomplet.
- **V4 (P0)** -- cas 6 integration -- `id` est un uuid genere par defaut -- Echec : id NULL => DEFAULT manquant.
- **V5 (P0)** -- cas 17 integration -- FK assignment_id inexistant rejetee -- Echec : insertion acceptee => FK absente.
- **V6 (P0)** -- cas 18 integration -- FK expert_id inexistant rejetee -- Echec : FK absente.
- **V7 (P0)** -- cas 19 integration -- FK expert_user_id inexistant rejetee -- Echec : FK absente.
- **V8 (P0)** -- cas 20 integration -- ON DELETE RESTRICT bloque la suppression d'un assignment lie -- Echec : suppression acceptee => mauvaise politique ON DELETE (CASCADE par erreur).
- **V9 (P0)** -- cas 12 integration -- decision invalide rejetee -- Echec : acceptee => CHECK absent.
- **V10 (P0)** -- cas 13 integration -- status invalide rejete -- Echec : accepte => CHECK absent.
- **V11 (P0)** -- cas 15 integration -- signature_legal_status invalide rejete -- Echec : accepte => CHECK absent.
- **V12 (P0)** -- cas 22 integration -- tenant A ne voit pas les rapports de B -- Echec : lignes visibles => RLS non FORCE ou policy absente.
- **V13 (P0)** -- cas 24 integration -- insertion cross-tenant bloquee -- Echec : insertion acceptee => policy mal definie.
- **V14 (P0)** -- cas 31 integration -- `relrowsecurity=true` ET `relforcerowsecurity=true` -- Echec : FORCE manquant => piege P2.
- **V15 (P0)** -- cas 32 integration -- policy `insure_expert_reports_tenant_isolation` presente -- Echec : policy absente.
- **V16 (P0)** -- `pnpm --filter @insurtech/database migration:revert` -- `down()` supprime trigger + policy + table -- Echec : exception ou table residuelle.
- **V17 (P0)** -- structure-15 -- `down()` ne contient pas `DROP FUNCTION`/`set_updated_at_column` -- Echec : fonction partagee droppee => piege P3/P8.

### Criteres P1 (importants -- minimum 8)

- **V18 (P1)** -- cas 1 integration -- status defaut `draft` -- Echec : autre valeur => DEFAULT mal pose.
- **V19 (P1)** -- cas 2/3 integration -- report_content et modifications defaut `{}` -- Echec : NULL => DEFAULT manquant (piege P5).
- **V20 (P1)** -- cas 4 integration -- photos_urls defaut `[]` -- Echec : NULL => DEFAULT manquant.
- **V21 (P1)** -- cas 5 integration -- signature_legal_status defaut `pending` -- Echec : autre valeur.
- **V22 (P1)** -- cas 25 integration -- updated_at change apres UPDATE -- Echec : inchange => trigger absent (piege P3).
- **V23 (P1)** -- cas 30 integration -- les 5 index presents -- Echec : index manquant => piege P9.
- **V24 (P1)** -- cas 14 integration -- 6 status valides acceptes -- Echec : un status rejete => CHECK trop restrictif.
- **V25 (P1)** -- structure-7 -- `up()` ne declare PAS de FK sur devis_id -- Echec : FK presente => piege P4 (table inexistante).
- **V26 (P1)** -- `pnpm --filter @insurtech/database typecheck` -- entite alignee compile (strict, exactOptionalPropertyTypes) -- Echec : erreur de type => desalignement (piege P12).

### Criteres P2 (qualite -- minimum 5)

- **V27 (P2)** -- cas 26/28 integration -- report_content/modifications acceptent un objet structure -- Echec : erreur de parse.
- **V28 (P2)** -- cas 27 integration -- photos_urls accepte un tableau -- Echec : erreur de type.
- **V29 (P2)** -- migration:run apres revert (idempotence) -- aucune erreur, table identique -- Echec : exception => piege P11.
- **V30 (P2)** -- `bash scripts/check-no-emoji.sh ...` -- exit 0 sur tous les fichiers -- Echec : emoji detecte => decision-006.
- **V31 (P2)** -- structure-13 -- timestamptz exclusif (aucun `timestamp` nu) -- Echec : timestamp nu => piege P7.
- **V32 (P2)** -- `test -f repo/docs/expert-reports-sprint-22.7-extension-path.md` -- le doc existe (~80 lignes) -- Echec : doc absent.
- **V33 (P2)** -- `pnpm --filter @insurtech/database test --coverage` -- coverage database >= 90% -- Echec : couverture insuffisante.

---

## 12. Edge cases et troubleshooting

1. **Le role de test est superuser** : la RLS ne s'applique pas (les cas 22-24 echouent silencieusement, lignes visibles). Solution : utiliser le role `insurtech_app` (non superuser) et verifier `FORCE ROW LEVEL SECURITY`. Diagnostic : `SELECT current_user;` dans le test.

2. **`SET LOCAL` hors transaction** : `SET LOCAL app.current_tenant_id` n'a aucun effet hors d'une transaction (`BEGIN`/`COMMIT`). Symptome : la policy ne voit aucun tenant et tout est filtre. Solution : encapsuler chaque operation dans `BEGIN ... COMMIT` (deja fait dans le harness).

3. **Migration amont 2.5.5 absente** : `up()` echoue sur `REFERENCES "insure_expert_assignments"`. Diagnostic : `\dt insure_expert_assignments`. Solution : jouer toutes les migrations dans l'ordre (`migration:run` global).

4. **`gen_random_uuid()` indisponible** : sur d'anciennes versions PostgreSQL (< 13), `gen_random_uuid()` necessitait l'extension `pgcrypto`. Solution : verifier que l'extension est activee (socle Sprint 1) ou la version PostgreSQL >= 13.

5. **Tentative de suppression d'un expert reference** : `DELETE FROM insure_experts` echoue (ON DELETE RESTRICT) si un rapport le reference. C'est le comportement voulu (valeur probante). Pour supprimer, dropper d'abord les rapports (sous contexte tenant).

6. **JSONB vs JSON** : utiliser `jsonb` (binaire, indexable, deduplique les cles) et non `json`. La migration utilise bien `jsonb`. Inserer une chaine JSON via le driver pg : passer `JSON.stringify(obj)` ou laisser le driver serialiser un objet selon la config.

7. **`photos_urls text[]` et le driver pg** : passer un tableau JS natif (`['a','b']`) -- le driver `pg` gere la conversion vers `text[]`. Ne pas passer une chaine `'{a,b}'` manuellement (risque d'echappement).

8. **Trigger non declenche sur INSERT** : `set_updated_at_column()` est cable `BEFORE UPDATE` uniquement. A l'INSERT, `updated_at` prend `DEFAULT now()`. Donc tester le trigger via un UPDATE (cas 25), pas un INSERT.

9. **`down()` echoue car table absente** : si la migration n'a jamais ete appliquee, `down()` avec `DROP ... IF EXISTS` ne leve pas d'erreur (idempotent). Verifier que tous les DROP utilisent `IF EXISTS`.

10. **Desalignement entite (exactOptionalPropertyTypes)** : avec `exactOptionalPropertyTypes: true`, une propriete nullable doit etre `T | null` et non optionnelle `?`. L'entite utilise `!: T | null` pour les colonnes nullable -- coherent avec le SQL. Un mauvais typage casse le `typecheck` (V26).

---

## 13. Conformite Maroc

### 13.1 Loi 43-20 -- signature electronique (differee Sprint 22.7)

La loi 43-20 relative aux services de confiance pour les transactions electroniques encadre la signature electronique au Maroc (elle remplace la loi 53-05). Une signature electronique qualifiee, emise par un prestataire qualifie (Barid eSign / Barid Al-Maghrib), confere au document une valeur juridique equivalente a la signature manuscrite. Le rapport d'expertise non signe n'engage pas juridiquement l'expert.

Implications pour cette tache (fondation) : on pose les colonnes `signature_id`, `signed_at`, `signature_legal_status` (`pending`/`signed`/`expired`) sans implementer l'integration. On ne stocke jamais la signature binaire, uniquement la reference cote prestataire (`signature_id`). L'integration reelle est differee au Sprint 22.7 (`expert-report-signing.service.ts`).

### 13.2 ACAPS -- le rapport comme artefact regule

L'ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale) regule le secteur des assurances au Maroc (loi 17-99 -- Code des assurances). Le rapport d'expertise est un artefact regule : il doit etre tracable, conserve, et auditable. Implications : `created_at`/`updated_at` horodates en `timestamptz` (UTC), trigger `updated_at` pour la tracabilite des modifications, ON DELETE RESTRICT pour empecher la perte d'un rapport probant, statut explicite du cycle de vie. L'audit trail complet des transitions est ajoute au Sprint 22.7.

### 13.3 CNDP -- loi 09-08 (donnees personnelles, photos)

La loi 09-08 relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel (autorite : CNDP) s'applique : le rapport contient des PII (immatriculation, VIN, references de sinistre, identite de l'assure dans `report_content`) et des photos de sinistre (`photos_urls`) susceptibles de contenir des donnees identifiantes (plaques, personnes). Implications : isolation tenant stricte par RLS (`app_can_access_tenant`), `FORCE ROW LEVEL SECURITY` (defense en profondeur), COMMENT signalant le caractere PII de `photos_urls`, stockage souverain Atlas Benguerir (decision-008) ou les donnees ne quittent jamais le territoire marocain, chiffrement AES-256-GCM au repos et TLS 1.3 en transit.

### 13.4 Loi 17-99 -- Code des assurances

Le Code des assurances (loi 17-99) encadre l'expertise dans le reglement des sinistres. Le pouvoir de l'expert de valider/modifier/rejeter le devis (decision-013) et la chaine de soumission au carrier s'inscrivent dans ce cadre. La table modelise fidelement cette chaine (colonnes `decision`, `decision_justification`, `modifications`, `status` carrier).

---

## 14. Conventions absolues skalean-insurtech

Reproduites integralement (a respecter dans tout code produit par cette tache et ses dependants) :

- **Multi-tenant strict** : en-tete `x-tenant-id` obligatoire sur toutes les routes sauf `/api/v1/public/*` et `/api/v1/admin/*` ; `TenantGuard` ; propagation via `AsyncLocalStorage` ; isolation base via RLS et `app_can_access_tenant()` ; audit trail systematique. Cette tache materialise l'isolation au niveau base (RLS + policy).
- **Validation strict** : Zod uniquement ; schemas exportes ; pattern `const XSchema = z.object({...})` puis `type X = z.infer<typeof XSchema>`. (Applicable aux services 22.7 ; ici la validation du JSONB est differee.)
- **Logger strict** : Pino injecte ; jamais `console.log` ; logs JSON structures avec champs `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.
- **Hash strict** : argon2id parametres 65536/3/4 ; jamais bcrypt ; `PASSWORD_PEPPER` applique. (Socle ; hors perimetre direct.)
- **Package manager strict** : pnpm exclusivement ; `engine-strict` Node `>= 22.11.0` ; `save-exact` ; `link-workspace-packages=deep`.
- **TypeScript strict** : `strict`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`, `exactOptionalPropertyTypes` ; imports explicites. L'entite respecte `exactOptionalPropertyTypes` (nullable = `T | null`).
- **Tests strict** : Vitest + Playwright ; chaque `.ts` a son `.spec.ts` ; coverage >= 85% global, >= 90% pour `auth`/`database`/`signature`. La migration et l'entite ont leurs specs.
- **RBAC strict** : `@Roles()` par endpoint ; `RolesGuard` + `TenantGuard` ; 26 roles v3.0. (Applicable aux endpoints 14/22.7.)
- **Events strict** : Kafka topic `insurtech.events.{vertical}.{entity}.{action}` ; schema Zod par evenement ; `Idempotency-Key` pour les operations critiques. (Evenements `expert_report.*` produits au 22.7.)
- **Imports strict** : alias `@insurtech/{name}` ; chemins definis dans `tsconfig.base.json` ; ordre des imports : Node, externe, `@insurtech/*`, relatif.
- **Skalean AI strict (decision-005)** : acces IA uniquement via `@insurtech/sky` ou MCP ; jamais d'appel direct a un fournisseur frontier ; mock en environnements 1-28, reel en environnement 29.
- **No-emoji strict (decision-006 ABSOLUE)** : aucune emoji nulle part (code, commentaires, docs, commits) ; verifie par `check-no-emoji.sh` ; CI bloquante.
- **Idempotency-Key strict** : obligatoire sur `POST /payments`, `/signatures`, `/claims`, et toutes les ecritures MCP ; TTL 24h en Redis. (La signature 22.7 l'applique.)
- **Conventional Commits strict** : format `<type>(scope): description` ; `commitlint` via husky.
- **Cloud souverain MA strict (decision-008)** : Atlas Benguerir ; DC1 Tier III + DC2 Tier IV ; aucune donnee d'assure ne quitte le Maroc ; chiffrement AES-256-GCM au repos ; TLS 1.3 en transit.
- **Naming v3.0 (decision-011)** : Skalean (societe), Assurflow (verticale assurance), Sofidemy (marque).

---

## 15. Validation pre-commit

Sequence a executer avant tout commit :

```bash
cd repo

# 1) Typecheck strict
pnpm --filter @insurtech/database typecheck

# 2) Lint
pnpm --filter @insurtech/database lint

# 3) Tests (structure + integration)
pnpm --filter @insurtech/database test \
  src/migrations/1735000000015-Sprint75bInsureExpertReports.spec.ts \
  test/insure-expert-reports.integration.spec.ts

# 4) Coverage >= 90% (database)
pnpm --filter @insurtech/database test --coverage

# 5) Migration run + revert + run (idempotence)
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/database migration:revert
pnpm --filter @insurtech/database migration:run

# 6) Anti-emoji (decision-006)
bash scripts/check-no-emoji.sh \
  repo/packages/database/src/migrations/1735000000015-Sprint75bInsureExpertReports.ts \
  repo/packages/database/src/migrations/1735000000015-Sprint75bInsureExpertReports.spec.ts \
  repo/packages/database/src/entities/insure-expert-report.entity.ts \
  repo/packages/database/test/insure-expert-reports.integration.spec.ts \
  repo/docs/expert-reports-sprint-22.7-extension-path.md

# 7) commitlint (verifie le format du message)
echo "feat(sprint-7.5b): foundation entity insure_expert_reports + 22.7 extension doc" | pnpm commitlint
```

Checklist pre-commit :

- [ ] Typecheck strict OK (aucune erreur, `exactOptionalPropertyTypes` respecte).
- [ ] Lint OK.
- [ ] Test de structure : 15 cas verts.
- [ ] Test d'integration : 32 cas verts.
- [ ] Coverage database >= 90%.
- [ ] migration:run / revert / run sans erreur (idempotence).
- [ ] Aucune emoji (check-no-emoji.sh exit 0).
- [ ] Entite alignee sur le SQL (24 colonnes).
- [ ] Doc 22.7 presente.
- [ ] Message de commit au format Conventional Commits.

---

## 16. Message de commit

```
feat(sprint-7.5b): foundation entity insure_expert_reports + 22.7 extension doc

Cree la table de fondation insure_expert_reports (migration TypeORM
1735000000015) qui materialise le rapport d'expertise sur devis garage.
Decision-013: l'expert valide / modifie / rejette le devis avant que le
carrier ne paie.

Contenu:
- Table insure_expert_reports (24 colonnes, timestamptz exclusif).
- FK auth_tenants (CASCADE), insure_expert_assignments / insure_experts /
  auth_users (RESTRICT, valeur probante). devis_id sans FK (table inexistante
  en 7.5b), documente par COMMENT + index.
- CHECK sur decision (validated|modified|rejected), status (cycle de vie 6
  etats vers le carrier), signature_legal_status (pending|signed|expired).
- 5 index (tenant, assignment, expert, devis, status).
- RLS ENABLE + FORCE + policy insure_expert_reports_tenant_isolation
  (app_can_access_tenant).
- Trigger trg_insure_expert_reports_updated_at (reutilise set_updated_at_column
  Sprint 1, jamais recreee ni droppee).
- Entite TypeORM insure-expert-report.entity.ts alignee.
- Tests: structure (QueryRunner mocke) + integration pg reel (32 cas, RLS 2
  tenants).
- Doc repo/docs/expert-reports-sprint-22.7-extension-path.md (services differes
  validation / signature Barid eSign loi 43-20 / soumission carrier).

Signature electronique et soumission carrier differees Sprint 14 et 22.7.
Aucune emoji (decision-006).

Task: 2.5.6
Sprint: 7.5b (Phase 2 / Sprint 5)
Phase: 2
Decisions: 013 + preview sprint 14 + sprint 22.7
```

---

## 17. Workflow -- prochaine etape

Une fois cette tache validee (tous les criteres P0 verts, migration appliquee et revertee, doc 22.7 presente, zero emoji) :

1. Marquer 2.5.6 comme terminee dans le pilotage.
2. Debloquer **task-2.5.7** : services squelettes `@insurtech/expertise`. Cette tache cree les squelettes de services (sans logique metier) qui consommeront l'entite `InsureExpertReport` :
   - Squelette `expert-validation.service.ts` (signature et types, logique differee 22.7).
   - Squelette `expert-report-signing.service.ts` (signature et types, integration Barid eSign differee 22.7).
   - Squelette `expert-report-submission.service.ts` (signature et types, transitions differees 22.7).
   - Le package `@insurtech/expertise` exposera ces services et l'entite via les alias `@insurtech/*`.
3. Le document `repo/docs/expert-reports-sprint-22.7-extension-path.md` produit ici sert de specification d'entree pour 2.5.7 et pour l'implementation Sprint 22.7.

Sequence aval immediate :

```
2.5.6 insure_expert_reports (CETTE TACHE) -- terminee
   -> 2.5.7 services squelettes @insurtech/expertise
        -> Sprint 14 expertise applicative (controllers, PDF, photos)
             -> Sprint 22.7 signature (Barid eSign loi 43-20) + soumission carrier
```

---

<!--
  Fin du fichier task-2.5.6-foundation-entity-insure-expert-reports.md
  Sprint 7.5b (Assurflow Foundation) -- Phase 2 / Sprint 5
  Reference: B-7.5b tache 2.5.6
  Migration: 1735000000015-Sprint75bInsureExpertReports.ts
  Classe: Sprint75bInsureExpertReports1735000000015
  Table: insure_expert_reports
  Depend de: 2.5.5 (insure_expert_assignments) -- Bloque: 2.5.7
  Decisions: 006 (no-emoji), 008 (cloud souverain), 011 (naming), 012, 013
  Conformite Maroc: loi 43-20 (e-sign, differee 22.7), ACAPS, CNDP loi 09-08, loi 17-99
  AUCUNE EMOJI -- decision-006 ABSOLUE
-->
