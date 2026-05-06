# Task 1.2.3 -- Migration CRM (4 tables: companies, contacts, deals, interactions) + RLS multi-tenant + Indexes BTREE + Indexes GIN trigram pg_trgm

## Section 1 : Header

- Projet : Skalean InsurTech
- Sprint : 2 / 24 (Phase 1 -- Foundations Database & Kafka)
- Backlog ID : B-02
- Tache : 1.2.3 (3eme tache du Sprint 2, suit immediatement 1.2.2 IAM tables)
- Titre complet : Migration "CRM" -- 4 tables (crm_companies, crm_contacts, crm_deals, crm_interactions) + RLS multi-tenant FORCE + indexes BTREE classiques + indexes GIN trigram (extension pg_trgm activee Sprint 1) pour full-text search performant ILIKE et similarity sur full_name / name / email
- Duree estimee : 6 heures (decoupage : 1h migration squelette + ENUMs + extension verif, 2h tables + RLS + policies x16, 1h30 indexes BTREE + GIN trigram + UNIQUE constraints + GENERATED full_name, 1h tests migrations + RLS + trigram performance EXPLAIN ANALYZE, 30 min revue + commit + verification \\d psql)
- Priorite : P0 (Critique -- bloquant pour Sprint 8 CRM frontend, Sprint 14 Insure (besoin contacts pour souscriptions), Sprint 20 Repair (besoin deals + companies pour devis), Sprint 22 IA chatbot conversationnel sur historique interactions)
- Dependance amont : Tache 1.2.2 (auth_users + auth_sessions + tenants doivent exister car FK owner_user_id, created_by referencent auth_users.id ; tenant_id FK referencent tenants.id) ; Tache 1.1.x Sprint 1 (extensions pg_trgm + citext + uuid-ossp activees prealablement par migration 1734000000000-EnableExtensions.ts)
- Dependance aval : Tache 1.2.4 (RBAC tables permissions/roles), Sprint 8 (CRM frontend Angular consomme ces tables via API NestJS), Sprint 14+ (Insure, Repair, Claims), Sprint 22 (IA conversationnelle indexe full-text sur crm_interactions.content)
- Decisions architecturales referencees : decision-002 (Multi-tenancy Row-Level-Security FORCE + tenant_id sur chaque table), decision-003 (Naming snake_case strict + soft-delete deleted_at + audit created_by/updated_by), decision-008 (Conformite Loi 09-08 CNDP donnees personnelles + Loi ICE administration fiscale Maroc 15 chiffres + Loi CIN format Maroc + telephones E.164 +2126XX/+2127XX)
- Convention absolue rappel : AUCUNE emoji dans code / commit / fichier / commentaire / migration / test / entity / log. Tout caractere Unicode emoji est interdit. Les commentaires SQL utilisent texte ASCII pur. Les noms de variables/tables/colonnes sont snake_case. Les noms TypeScript sont camelCase pour proprietes / PascalCase pour classes. Les fichiers migrations suivent le pattern <timestamp>-<NomPascal>.ts. Le timestamp de cette migration est 1735000000002 (immediatement apres 1735000000001 IAM).
- Auteur de la specification : Skalean Tech Lead -- 2026-05-05
- Branche Git de travail : feat/sprint-02-task-1.2.3-crm-migration
- Fichier de migration cree : apps/api/src/database/migrations/1735000000002-CRM.ts
- Tag Sprint 2 : sprint-02-foundation-db-kafka

## Section 2 : But (3 paragraphes denses)

Paragraphe 1 -- Le CRM est le coeur metier transversal de Skalean InsurTech. Avant meme de pouvoir creer un contrat d'assurance Insure (Sprint 14), un devis Repair (Sprint 20), ou un sinistre Claims (Sprint 18), nous devons disposer d'un referentiel unique et fiable des entreprises (crm_companies, ex : un courtier B2B partenaire, un client entreprise, un atelier reparateur), des contacts (crm_contacts, personnes physiques rattachees ou independantes), des deals (crm_deals, opportunites commerciales avec stages lead/qualified/proposal/negotiation/won/lost et montant en MAD dirhams marocains), et des interactions (crm_interactions, journal append-only de tous les echanges call/email/whatsapp/meeting/note alimente par les modules de communication Sprint 5 et le futur IA conversationnel Sprint 22). Cette tache 1.2.3 cree les 4 tables fondatrices avec un schema durci pour la conformite reglementaire marocaine (validation ICE 15 chiffres, CIN format alphanumerique, telephones E.164 +212), avec une isolation multi-tenant stricte (Row-Level-Security FORCE empechant tout leak inter-tenant meme avec une faille applicative), et avec une preparation infrastructurelle (FK RESTRICT pour preservation audit, soft-delete deleted_at, computed column full_name STORED, timestamps created_at/updated_at) qui permettra a tous les sprints aval de construire leur logique metier sans jamais avoir a modifier ce socle.

Paragraphe 2 -- La performance de recherche est un enjeu critique. Une commerciale Skalean tape dans la barre de recherche du CRM (Sprint 8) "rachi" -- elle doit retrouver instantanement "Mohammed Errachidi", "Rachida Benali", "Erachid Tazi", "Sociedad Erachi SARL". Avec 100 000 contacts et 50 000 entreprises en production cible (objectif fin 2027 selon backlog Phase 7), une recherche ILIKE '%rachi%' classique sur un index B-tree NE PEUT PAS utiliser cet index (B-tree exige un prefixe constant pour LIKE 'rachi%' fonctionne, mais '%rachi%' force un sequential scan O(n)). Mesure terrain Skalean (test load) : sequential scan sur 100k contacts = 1200ms a 2400ms selon hardware -- inacceptable pour UX commerciale. Solution : extension pg_trgm activee en Sprint 1, indexes GIN sur (full_name gin_trgm_ops), (name gin_trgm_ops sur companies), (email gin_trgm_ops). Mesure terrain attendue : recherche ILIKE '%rachi%' sur 100k contacts via GIN trigram = 15ms a 45ms (24x a 80x plus rapide). Idem pour la fonction similarity() (recherche fuzzy "Rashidi" matche "Errachidi" avec score 0.45 > FULL_TEXT_SEARCH_THRESHOLD 0.3). Cette tache 1.2.3 cree donc 7 indexes GIN trigram strategiques (3 sur contacts full_name/email/phone, 2 sur companies name/email, 1 sur deals title, 1 sur interactions content/subject combine) qui feront la difference entre un CRM utilisable et un CRM abandonne par les commerciales.

Paragraphe 3 -- La conformite reglementaire marocaine est non-negociable et integree au schema des cette tache 1.2.3. L'ICE (Identifiant Commun de l'Entreprise, Article 23 du Code General des Impots Maroc, decret 2.11.13) est un identifiant fiscal national de 15 chiffres exactement -- nous le stockons en text avec contrainte CHECK (ice ~ '^[0-9]{15}$') et un index UNIQUE (tenant_id, ice) WHERE deleted_at IS NULL pour empecher les doublons intra-tenant tout en autorisant le meme ICE chez deux courtiers different (multi-tenant). Le RC (Registre du Commerce) et la patente sont stockes en text libre. Le CIN (Carte d'Identite Nationale Maroc, format 1 ou 2 lettres majuscules suivies de 6 a 8 chiffres, ex "BK123456" "AB1234567") est valide via CHECK (cin ~ '^[A-Z]{1,2}[0-9]{6,8}$') et UNIQUE (tenant_id, cin). Les telephones marocains suivent E.164 obligatoirement (+2126XXXXXXXX mobile, +2125XXXXXXXX fixe, +2127XXXXXXXX nouveaux mobiles INWI/Orange) avec validation cote service Sprint 4 (Zod regex /^\\+212[567]\\d{8}$/). La langue preferee est un enum 'fr' | 'ar-MA' (darija marocaine) | 'ar' (arabe litteral) pour permettre au futur module communication de choisir le template approprie. Le canal prefere est un enum 'whatsapp' | 'email' | 'sms' | 'voice' qui guide le routage IA Sprint 22. Conformite Loi 09-08 CNDP (Commission Nationale de Controle de Protection des Donnees Personnelles) : RLS FORCE garantit cloisonnement entre tenants (un tenant ne peut JAMAIS voir les contacts d'un autre tenant), soft-delete deleted_at conserve l'historique pour audit CNDP minimum 5 ans, append-only sur crm_interactions empeche la falsification de l'historique de communication (decision-008).

## Section 3 : Contexte etendu

### 3.1 Pourquoi GIN trigram et non B-tree pour ILIKE

Un index B-tree (par defaut Postgres) est ordonne lexicographiquement. Une requete WHERE full_name LIKE 'Moh%' peut utiliser un B-tree car le prefixe est constant -- Postgres descend l'arbre jusqu'a 'Moh' puis lit en sequence jusqu'au premier element qui ne commence plus par 'Moh'. Mais une requete WHERE full_name ILIKE '%moh%' (avec wildcard prefixe) NE PEUT PAS utiliser un B-tree -- il n'existe aucun ordre lexicographique permettant de localiser tous les elements contenant 'moh' au milieu. Postgres tombe en sequential scan O(n).

L'extension pg_trgm decoupe chaque chaine en trigrammes (sequences de 3 caracteres consecutifs). "Mohammed" devient { '  M', ' Mo', 'Moh', 'oha', 'ham', 'amm', 'mme', 'med', 'ed ' }. Un index GIN (Generalized Inverted Index) construit un dictionnaire inverse trigramme -> liste de lignes. Recherche '%moh%' = decoupage en trigrammes { 'moh' } puis lookup direct dans GIN -> liste de toutes les lignes contenant 'moh'. Complexite O(log n) au lieu de O(n).

### 3.2 Alternatives Postgres FTS tsvector vs trigram pg_trgm

| Critere | tsvector + tsquery | pg_trgm GIN |
|--------|---------------------|--------------|
| Cas d'usage | Recherche linguistique (stemming, stop-words) sur paragraphes texte | Recherche fuzzy + ILIKE wildcard sur noms/emails courts |
| Stemming | Oui (configurations 'french', 'english', 'arabic' partiel) | Non |
| ILIKE '%x%' | Non (besoin de @@) | Oui directement |
| Similarity | Non | Oui (% operateur, similarity() function) |
| Taille index | Plus petite (mots normalises) | Plus grosse (tous les trigrammes) |
| Vitesse 100k rows | 5-20ms | 15-50ms |
| Mise a jour computed | Trigger ou GENERATED tsvector STORED | Direct sur colonne text |

Decision Skalean (decision-architecturale Sprint 1) : pg_trgm pour CRM (recherche commerciale UX rapide ILIKE), tsvector pour Sprint 22 IA (recherche semantique sur historique interactions long-form). Cette tache 1.2.3 utilise pg_trgm. La tache Sprint 22 ajoutera une colonne tsvector sur crm_interactions plus tard.

### 3.3 Trade-offs full_name GENERATED STORED vs VIRTUAL

PostgreSQL 12+ supporte les colonnes generees STORED (calculees a INSERT/UPDATE et persistees physiquement) et VIRTUAL (calculees a chaque SELECT, non persistees -- mais NON SUPPORTEE en Postgres 14, prevue pour 18+). Pour cette tache nous utilisons STORED car c'est la seule option disponible et car l'index GIN trigram doit etre sur une colonne reelle.

```sql
full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED
```

Trade-off : +30% taille ligne (nom redondant) mais permet l'indexation GIN directe. Sans cette colonne, il faudrait CREATE INDEX ... ON crm_contacts USING GIN ((first_name || ' ' || last_name) gin_trgm_ops) -- qui fonctionne mais est plus difficile a maintenir (le moteur recalcule l'expression a chaque INSERT et a chaque scan). La colonne STORED est preferee pour clarte et performance INSERT.

### 3.4 Pourquoi citext sur email

L'extension citext (case-insensitive text, activee Sprint 1) compare les chaines en ignorant la casse au niveau du moteur. "Said@Skalean.MA" et "said@skalean.ma" sont consideres egaux par citext sans avoir besoin de LOWER() systematiquement. Cela permet :
- UNIQUE (tenant_id, email) ou email est citext bloque les doublons casse-insensibles
- WHERE email = 'said@skalean.ma' matche "Said@Skalean.MA" sans LOWER() qui invaliderait l'index BTREE
- Recherche GIN trigram sur citext fonctionne identique a text

### 3.5 ICE collision cross-tenant

Un ICE est unique au Maroc (delivre par la Direction Generale des Impots). Mais dans Skalean multi-tenant, deux courtiers (tenants) peuvent avoir la meme entreprise comme client. Tenant_A "Marsh Maghreb" et Tenant_B "Saham Assurance" peuvent tous les deux avoir "ATTIJARIWAFA BANK SA" (ICE 001234567890123) dans leur CRM respectif. La contrainte est donc UNIQUE (tenant_id, ice) -- doublon dans un tenant impossible, mais meme ICE present dans deux tenants autorise. Le partial WHERE deleted_at IS NULL permet de "recreer" un contact apres soft-delete sans conflict.

### 3.6 FK ON DELETE RESTRICT vs CASCADE

Choix Skalean : ON DELETE RESTRICT partout. Si un user tente DELETE FROM crm_companies WHERE id = X et que des contacts/deals referencent cette company, l'operation est bloquee. Pourquoi ? CASCADE supprime silencieusement des donnees liees, ce qui :
- Empeche audit fiable (donnees disparaissent sans trace)
- Risque de corruption logique (un deal won/perdu disparait avec sa company alors qu'il devrait etre archive)
- Non-conforme Loi 09-08 (donnees personnelles doivent etre conservees minimum 5 ans pour audit CNDP)

Solution metier : utiliser deleted_at (soft-delete) au lieu de DELETE physique. Le DELETE physique est reserve aux administrateurs Skalean Platform via un job de purge mensuel apres 5 ans (Sprint Phase 7).

### 3.7 Soft-delete partial indexes

Tous les indexes UNIQUE et tous les indexes principaux sont WHERE deleted_at IS NULL. Cela :
- Reduit taille index de ~90% en production (les soft-deleted ne sont pas indexes)
- Autorise re-creation d'un contact avec meme CIN apres soft-delete du precedent
- Accelere requetes WHERE deleted_at IS NULL (hot-path commercial)

### 3.8 Pieges identifies

Piege 1 -- full_name STORED depend de first_name et last_name -- si l'un est NULL, full_name = NULL aussi (concatenation NULL-propagation). Solution : NOT NULL sur first_name et last_name (un contact DOIT avoir nom+prenom).

Piege 2 -- citext email semble identique a text mais ne fonctionne pas en JOIN avec colonnes text. Toujours typer email citext partout, JAMAIS mixer text et citext.

Piege 3 -- GIN trigram sur colonne large (ex content interactions long >10ko) explose la taille index. Solution : limiter content a 50ko (CHECK char_length(content) < 50000) et indexer GIN seulement subject + premier 5000 caracteres de content via expression substring(content, 1, 5000).

Piege 4 -- ICE valide format mais peut etre logiquement faux (numero non-attribue par DGI). Validation deep cote service Sprint 4 via API DGI Maroc (hors-perimetre tache 1.2.3, tache 1.2.3 valide juste le format regex).

Piege 5 -- CIN minuscules vs majuscules : "bk123456" vs "BK123456". Solution : CHECK regex impose [A-Z], et au niveau service Zod transform .toUpperCase() avant insert.

Piege 6 -- Computed column full_name n'est pas mise a jour automatiquement si on UPDATE first_name (en realite SI dans Postgres 12+ STORED est recalculee automatiquement). Verifie par test dedie test_constraints.spec.ts.

Piege 7 -- Append-only sur crm_interactions : aucune contrainte SQL native existe pour empecher UPDATE/DELETE. Solution : trigger BEFORE UPDATE/DELETE qui RAISE EXCEPTION (sauf pour created_by = service-account-archivist pour purge legale 5 ans). Cette tache 1.2.3 cree le trigger.

Piege 8 -- Index GIN size > BTREE typiquement 5x a 10x. Sur 100k contacts, GIN(full_name) ~ 50 Mo vs BTREE(full_name) ~ 8 Mo. Acceptable pour gain de perf, mais surveiller en production via pg_indexes_size.

Piege 9 -- RLS FORCE sur crm_interactions append-only : la policy USING doit verifier tenant_id, mais la policy WITH CHECK doit en plus verifier que created_by = current_user_id (un commercial ne peut pas inserer une interaction au nom d'un autre commercial). Cette tache 1.2.3 cree les 4 policies par table : SELECT, INSERT, UPDATE, DELETE. Pour interactions, UPDATE et DELETE sont bloquees au niveau policy (return false).

Piege 10 -- Partial index WHERE deleted_at IS NULL n'est utilise par le planner que si la requete contient explicitement le predicat WHERE deleted_at IS NULL. Sprint 8 frontend devra TOUJOURS ajouter ce filtre. Solution : exposer une vue SQL crm_contacts_active qui filtre deja, et l'API NestJS interroge cette vue (pas la table directement).

### 3.9 Decisions architecturales appliquees

decision-002 -- Multi-tenancy RLS FORCE sur les 4 tables. Chaque table contient tenant_id NOT NULL. Chaque table a ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY. 4 policies par table = 16 policies total.

decision-003 -- Naming snake_case strict (crm_companies, crm_contacts, etc., colonnes first_name, last_name, owner_user_id), soft-delete deleted_at timestamp NULL, audit created_by FK auth_users.id, updated_by FK auth_users.id, created_at NOT NULL DEFAULT now(), updated_at trigger BEFORE UPDATE.

decision-008 -- Conformite Maroc : ICE 15 chiffres CHECK, CIN regex CHECK, phone E.164 (validation cote service), enum preferred_language inclut 'ar-MA' darija, append-only crm_interactions trigger, retention 5 ans pour audit CNDP.

## Section 4 : Architecture context

Cette tache 1.2.3 est la 3eme du Sprint 2. L'ordre du Sprint 2 est :
- 1.2.1 -- Migration extensions + types ENUM globaux (deja faite dans Sprint 1 base, completee debut Sprint 2)
- 1.2.2 -- Migration IAM (auth_users, auth_sessions, tenants, auth_password_resets) -- DEPENDANCE DE 1.2.3
- 1.2.3 -- Migration CRM (cette tache, 4 tables)
- 1.2.4 -- Migration RBAC (permissions, roles, role_permissions, user_roles)
- 1.2.5 -- Migration Communication (notifications_outbox, sms_log, email_log)
- 1.2.6 -- Migration Audit Log
- 1.3.x -- Setup Kafka + topics + producers/consumers
- 1.4.x -- Tests integration end-to-end

Sprints aval qui consommeront le CRM cree par cette tache :
- Sprint 8 -- CRM frontend Angular (cards entreprises, contacts, pipeline deals Kanban, timeline interactions)
- Sprint 9 -- CRM API NestJS (controllers + services + DTOs Zod)
- Sprint 14 -- Insure souscription : crm_contacts.id devient policy_holder_id sur insure_policies
- Sprint 18 -- Claims : crm_contacts.id devient claimant_id
- Sprint 20 -- Repair : crm_companies.id devient garage_partner_id
- Sprint 22 -- IA conversationnelle : index full-text + GIN sur crm_interactions.content pour retrieval

Architecture data-flow :
```
[Frontend Sprint 8] -> [API Sprint 9 NestJS] -> [TypeORM Entities] -> [Postgres tables crm_*]
                                                                          |
                                                                          v
                                                              [RLS FORCE + GIN trigram + UNIQUE]
                                                                          |
                                                                          v
                                                          [Sprint 22 IA] reads via vector search + tsvector
                                                          [Sprint 14 Insure] reads via FK contact_id
                                                          [Sprint 20 Repair] reads via FK company_id
```

## Section 5 : Livrables checkables (28 items)

L1 -- Fichier apps/api/src/database/migrations/1735000000002-CRM.ts cree avec class CRM1735000000002 implements MigrationInterface
L2 -- Migration up() cree CREATE TABLE crm_companies avec 16+ colonnes
L3 -- Migration up() cree CREATE TABLE crm_contacts avec 14+ colonnes dont full_name GENERATED ALWAYS AS STORED
L4 -- Migration up() cree CREATE TABLE crm_deals avec 12+ colonnes dont stage enum 6 valeurs
L5 -- Migration up() cree CREATE TABLE crm_interactions avec 10+ colonnes dont type enum 5 valeurs et direction enum 2 valeurs
L6 -- ALTER TABLE ... ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY pour les 4 tables
L7 -- 4 policies par table (SELECT, INSERT, UPDATE, DELETE) = 16 policies total appliquant USING (tenant_id = current_setting('app.tenant_id')::uuid)
L8 -- Policy speciale crm_interactions : UPDATE et DELETE return false (append-only)
L9 -- Indexes BTREE classiques sur tenant_id + colonnes filtrables (created_at, owner_user_id, stage, occurred_at)
L10 -- Indexes GIN trigram crm_contacts.full_name USING GIN (full_name gin_trgm_ops)
L11 -- Indexes GIN trigram crm_contacts.email USING GIN (email gin_trgm_ops)
L12 -- Indexes GIN trigram crm_companies.name USING GIN (name gin_trgm_ops)
L13 -- Indexes GIN trigram crm_companies.email USING GIN (email gin_trgm_ops)
L14 -- Indexes GIN trigram crm_deals.title USING GIN (title gin_trgm_ops)
L15 -- Index GIN trigram crm_interactions.subject + content (combine via expression)
L16 -- UNIQUE INDEX (tenant_id, ice) WHERE deleted_at IS NULL sur crm_companies
L17 -- UNIQUE INDEX (tenant_id, cin) WHERE deleted_at IS NULL sur crm_contacts
L18 -- CHECK constraints ICE format ^[0-9]{15}$
L19 -- CHECK constraints CIN format ^[A-Z]{1,2}[0-9]{6,8}$
L20 -- 4 entites TypeORM 0.3 dans apps/api/src/modules/crm/entities/ : CrmCompanyEntity, CrmContactEntity, CrmDealEntity, CrmInteractionEntity
L21 -- Index barrel apps/api/src/modules/crm/entities/index.ts exportant les 4 entites
L22 -- Migration down() drop ordre inverse (interactions -> deals -> contacts -> companies)
L23 -- Test apps/api/src/database/migrations/__tests__/migrations-crm.spec.ts >= 8 tests
L24 -- Test apps/api/src/database/migrations/__tests__/rls-crm.spec.ts >= 8 tests cross-tenant isolation
L25 -- Test apps/api/src/database/migrations/__tests__/trigram-performance.spec.ts >= 5 tests EXPLAIN ANALYZE
L26 -- Test apps/api/src/database/migrations/__tests__/constraints-crm.spec.ts >= 5 tests UNIQUE/FK/computed
L27 -- Schema Zod CrmCompanyCreateInput / CrmContactCreateInput dans packages/shared-types/src/crm/ (preview, valide en Sprint 9)
L28 -- README court apps/api/src/modules/crm/README.md decrivant les 4 tables (4 paragraphes)

## Section 6 : Fichiers (chemins absolus + tailles attendues)

```
apps/api/src/database/migrations/1735000000002-CRM.ts                          ~ 240 lignes
apps/api/src/modules/crm/entities/crm-company.entity.ts                        ~ 70 lignes
apps/api/src/modules/crm/entities/crm-contact.entity.ts                        ~ 75 lignes
apps/api/src/modules/crm/entities/crm-deal.entity.ts                           ~ 60 lignes
apps/api/src/modules/crm/entities/crm-interaction.entity.ts                    ~ 55 lignes
apps/api/src/modules/crm/entities/index.ts                                     ~ 6 lignes
apps/api/src/modules/crm/README.md                                             ~ 40 lignes
apps/api/src/database/migrations/__tests__/migrations-crm.spec.ts              ~ 220 lignes
apps/api/src/database/migrations/__tests__/rls-crm.spec.ts                     ~ 250 lignes
apps/api/src/database/migrations/__tests__/trigram-performance.spec.ts         ~ 180 lignes
apps/api/src/database/migrations/__tests__/constraints-crm.spec.ts             ~ 160 lignes
packages/shared-types/src/crm/crm-company.schema.ts                            ~ 50 lignes
packages/shared-types/src/crm/crm-contact.schema.ts                            ~ 55 lignes
packages/shared-types/src/crm/index.ts                                         ~ 4 lignes
```

Total approximatif : 1465 lignes de code TypeScript / SQL / tests.

## Section 7 : Code patterns COMPLETS

### 7.1 Migration 1735000000002-CRM.ts (COMPLETE)

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint 2 Tache 1.2.3 -- Migration CRM
 * Cree 4 tables : crm_companies, crm_contacts, crm_deals, crm_interactions
 * Active RLS FORCE multi-tenant
 * Cree indexes BTREE + GIN trigram (extension pg_trgm activee Sprint 1)
 * Conformite Maroc : ICE 15 chiffres, CIN regex, phone E.164 valide cote service
 * Append-only crm_interactions via trigger BEFORE UPDATE/DELETE
 */
export class CRM1735000000002 implements MigrationInterface {
  name = 'CRM1735000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== Verification prerequis extensions ==========
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
          RAISE EXCEPTION 'Extension pg_trgm requise. Executer migration 1734000000000-EnableExtensions.ts.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
          RAISE EXCEPTION 'Extension citext requise. Executer migration 1734000000000-EnableExtensions.ts.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'auth_users') THEN
          RAISE EXCEPTION 'Table auth_users requise. Executer migration 1735000000001-IAM.ts.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'tenants') THEN
          RAISE EXCEPTION 'Table tenants requise. Executer migration 1735000000001-IAM.ts.';
        END IF;
      END $$;
    `);

    // ========== ENUMs ==========
    await queryRunner.query(`
      CREATE TYPE crm_preferred_language AS ENUM ('fr', 'ar-MA', 'ar');
      CREATE TYPE crm_preferred_channel AS ENUM ('whatsapp', 'email', 'sms', 'voice');
      CREATE TYPE crm_deal_stage AS ENUM ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
      CREATE TYPE crm_interaction_type AS ENUM ('call', 'email', 'whatsapp', 'meeting', 'note');
      CREATE TYPE crm_interaction_direction AS ENUM ('inbound', 'outbound');
    `);

    // ========== Table crm_companies ==========
    await queryRunner.query(`
      CREATE TABLE crm_companies (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        name text NOT NULL,
        industry text,
        ice text,
        rc text,
        patente text,
        address text,
        city text,
        country text NOT NULL DEFAULT 'MA',
        phone text,
        email citext,
        website text,
        owner_user_id uuid REFERENCES auth_users(id) ON DELETE RESTRICT,
        tags text[] DEFAULT '{}',
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid REFERENCES auth_users(id) ON DELETE RESTRICT,
        updated_by uuid REFERENCES auth_users(id) ON DELETE RESTRICT,
        deleted_at timestamptz,
        CONSTRAINT crm_companies_ice_format CHECK (ice IS NULL OR ice ~ '^[0-9]{15}$'),
        CONSTRAINT crm_companies_phone_format CHECK (phone IS NULL OR phone ~ '^\\+212[567]\\d{8}$'),
        CONSTRAINT crm_companies_country_iso CHECK (country ~ '^[A-Z]{2}$')
      );
    `);

    // ========== Table crm_contacts ==========
    await queryRunner.query(`
      CREATE TABLE crm_contacts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        company_id uuid REFERENCES crm_companies(id) ON DELETE RESTRICT,
        first_name text NOT NULL,
        last_name text NOT NULL,
        full_name text GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
        email citext,
        phone text,
        cin text,
        preferred_language crm_preferred_language NOT NULL DEFAULT 'fr',
        preferred_channel crm_preferred_channel NOT NULL DEFAULT 'email',
        tags text[] DEFAULT '{}',
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid REFERENCES auth_users(id) ON DELETE RESTRICT,
        updated_by uuid REFERENCES auth_users(id) ON DELETE RESTRICT,
        deleted_at timestamptz,
        CONSTRAINT crm_contacts_cin_format CHECK (cin IS NULL OR cin ~ '^[A-Z]{1,2}[0-9]{6,8}$'),
        CONSTRAINT crm_contacts_phone_format CHECK (phone IS NULL OR phone ~ '^\\+212[567]\\d{8}$'),
        CONSTRAINT crm_contacts_first_name_not_empty CHECK (char_length(first_name) > 0),
        CONSTRAINT crm_contacts_last_name_not_empty CHECK (char_length(last_name) > 0)
      );
    `);

    // ========== Table crm_deals ==========
    await queryRunner.query(`
      CREATE TABLE crm_deals (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE RESTRICT,
        company_id uuid REFERENCES crm_companies(id) ON DELETE RESTRICT,
        title text NOT NULL,
        stage crm_deal_stage NOT NULL DEFAULT 'lead',
        amount_dirham numeric(15, 2) NOT NULL DEFAULT 0,
        currency char(3) NOT NULL DEFAULT 'MAD',
        expected_close_date date,
        won_at timestamptz,
        lost_at timestamptz,
        lost_reason text,
        owner_user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid REFERENCES auth_users(id) ON DELETE RESTRICT,
        updated_by uuid REFERENCES auth_users(id) ON DELETE RESTRICT,
        deleted_at timestamptz,
        CONSTRAINT crm_deals_amount_positive CHECK (amount_dirham >= 0),
        CONSTRAINT crm_deals_currency_iso CHECK (currency ~ '^[A-Z]{3}$'),
        CONSTRAINT crm_deals_won_consistency CHECK ((stage = 'won' AND won_at IS NOT NULL) OR stage <> 'won'),
        CONSTRAINT crm_deals_lost_consistency CHECK ((stage = 'lost' AND lost_at IS NOT NULL) OR stage <> 'lost')
      );
    `);

    // ========== Table crm_interactions (append-only) ==========
    await queryRunner.query(`
      CREATE TABLE crm_interactions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        contact_id uuid NOT NULL REFERENCES crm_contacts(id) ON DELETE RESTRICT,
        deal_id uuid REFERENCES crm_deals(id) ON DELETE RESTRICT,
        type crm_interaction_type NOT NULL,
        direction crm_interaction_direction NOT NULL,
        subject text NOT NULL,
        content text,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        created_by uuid NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT crm_interactions_subject_not_empty CHECK (char_length(subject) > 0),
        CONSTRAINT crm_interactions_content_max_size CHECK (content IS NULL OR char_length(content) < 50000)
      );
    `);

    // ========== Trigger append-only crm_interactions ==========
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION crm_interactions_block_modification()
      RETURNS trigger AS $$
      BEGIN
        IF current_setting('app.archivist_bypass', true) = 'true' THEN
          RETURN COALESCE(NEW, OLD);
        END IF;
        RAISE EXCEPTION 'crm_interactions est append-only. UPDATE et DELETE interdits (decision-008 audit CNDP).';
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER crm_interactions_no_update
        BEFORE UPDATE ON crm_interactions
        FOR EACH ROW EXECUTE FUNCTION crm_interactions_block_modification();

      CREATE TRIGGER crm_interactions_no_delete
        BEFORE DELETE ON crm_interactions
        FOR EACH ROW EXECUTE FUNCTION crm_interactions_block_modification();
    `);

    // ========== Trigger updated_at sur les 3 autres tables ==========
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION trigger_set_updated_at()
      RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER set_updated_at_crm_companies
        BEFORE UPDATE ON crm_companies
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

      CREATE TRIGGER set_updated_at_crm_contacts
        BEFORE UPDATE ON crm_contacts
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

      CREATE TRIGGER set_updated_at_crm_deals
        BEFORE UPDATE ON crm_deals
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    `);

    // ========== Indexes BTREE ==========
    await queryRunner.query(`
      CREATE INDEX idx_crm_companies_tenant ON crm_companies (tenant_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_companies_owner ON crm_companies (tenant_id, owner_user_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_companies_created ON crm_companies (tenant_id, created_at DESC) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_crm_companies_tenant_ice ON crm_companies (tenant_id, ice) WHERE ice IS NOT NULL AND deleted_at IS NULL;

      CREATE INDEX idx_crm_contacts_tenant ON crm_contacts (tenant_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_contacts_company ON crm_contacts (tenant_id, company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_contacts_email ON crm_contacts (tenant_id, email) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_crm_contacts_tenant_cin ON crm_contacts (tenant_id, cin) WHERE cin IS NOT NULL AND deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_crm_contacts_tenant_email ON crm_contacts (tenant_id, email) WHERE email IS NOT NULL AND deleted_at IS NULL;

      CREATE INDEX idx_crm_deals_tenant_stage ON crm_deals (tenant_id, stage) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_deals_owner ON crm_deals (tenant_id, owner_user_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_deals_contact ON crm_deals (tenant_id, contact_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_deals_close_date ON crm_deals (tenant_id, expected_close_date) WHERE deleted_at IS NULL AND stage NOT IN ('won', 'lost');

      CREATE INDEX idx_crm_interactions_tenant_contact ON crm_interactions (tenant_id, contact_id, occurred_at DESC);
      CREATE INDEX idx_crm_interactions_tenant_deal ON crm_interactions (tenant_id, deal_id, occurred_at DESC) WHERE deal_id IS NOT NULL;
      CREATE INDEX idx_crm_interactions_tenant_type ON crm_interactions (tenant_id, type, occurred_at DESC);
    `);

    // ========== Indexes GIN trigram (CRITIQUE pour ILIKE et similarity) ==========
    await queryRunner.query(`
      CREATE INDEX idx_crm_companies_name_trgm ON crm_companies USING GIN (name gin_trgm_ops) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_companies_email_trgm ON crm_companies USING GIN ((email::text) gin_trgm_ops) WHERE deleted_at IS NULL AND email IS NOT NULL;

      CREATE INDEX idx_crm_contacts_full_name_trgm ON crm_contacts USING GIN (full_name gin_trgm_ops) WHERE deleted_at IS NULL;
      CREATE INDEX idx_crm_contacts_email_trgm ON crm_contacts USING GIN ((email::text) gin_trgm_ops) WHERE deleted_at IS NULL AND email IS NOT NULL;
      CREATE INDEX idx_crm_contacts_phone_trgm ON crm_contacts USING GIN (phone gin_trgm_ops) WHERE deleted_at IS NULL AND phone IS NOT NULL;

      CREATE INDEX idx_crm_deals_title_trgm ON crm_deals USING GIN (title gin_trgm_ops) WHERE deleted_at IS NULL;

      CREATE INDEX idx_crm_interactions_subject_trgm ON crm_interactions USING GIN (subject gin_trgm_ops);
      CREATE INDEX idx_crm_interactions_content_trgm ON crm_interactions USING GIN (substring(content, 1, 5000) gin_trgm_ops) WHERE content IS NOT NULL;
    `);

    // ========== RLS FORCE + Policies ==========
    await queryRunner.query(`
      ALTER TABLE crm_companies ENABLE ROW LEVEL SECURITY;
      ALTER TABLE crm_companies FORCE ROW LEVEL SECURITY;
      ALTER TABLE crm_contacts ENABLE ROW LEVEL SECURITY;
      ALTER TABLE crm_contacts FORCE ROW LEVEL SECURITY;
      ALTER TABLE crm_deals ENABLE ROW LEVEL SECURITY;
      ALTER TABLE crm_deals FORCE ROW LEVEL SECURITY;
      ALTER TABLE crm_interactions ENABLE ROW LEVEL SECURITY;
      ALTER TABLE crm_interactions FORCE ROW LEVEL SECURITY;
    `);

    await queryRunner.query(`
      CREATE POLICY crm_companies_select ON crm_companies FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_companies_insert ON crm_companies FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_companies_update ON crm_companies FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_companies_delete ON crm_companies FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

      CREATE POLICY crm_contacts_select ON crm_contacts FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_contacts_insert ON crm_contacts FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_contacts_update ON crm_contacts FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_contacts_delete ON crm_contacts FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

      CREATE POLICY crm_deals_select ON crm_deals FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_deals_insert ON crm_deals FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_deals_update ON crm_deals FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_deals_delete ON crm_deals FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

      CREATE POLICY crm_interactions_select ON crm_interactions FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
      CREATE POLICY crm_interactions_insert ON crm_interactions FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid AND created_by = current_setting('app.user_id', true)::uuid);
      CREATE POLICY crm_interactions_update ON crm_interactions FOR UPDATE USING (false);
      CREATE POLICY crm_interactions_delete ON crm_interactions FOR DELETE USING (false);
    `);

    // ========== Commentaires de documentation ==========
    await queryRunner.query(`
      COMMENT ON TABLE crm_companies IS 'CRM entreprises -- Sprint 2 Tache 1.2.3 -- ICE 15 chiffres conformite DGI Maroc';
      COMMENT ON TABLE crm_contacts IS 'CRM contacts personnes physiques -- CIN regex Maroc -- full_name STORED computed';
      COMMENT ON TABLE crm_deals IS 'CRM opportunites commerciales -- montant en MAD dirhams marocains -- pipeline 6 stages';
      COMMENT ON TABLE crm_interactions IS 'CRM journal append-only -- audit CNDP Loi 09-08 -- conservation 5 ans minimum';
      COMMENT ON COLUMN crm_companies.ice IS 'Identifiant Commun Entreprise Maroc -- 15 chiffres -- Article 23 CGI';
      COMMENT ON COLUMN crm_contacts.cin IS 'Carte Identite Nationale Maroc -- format [A-Z]{1,2}[0-9]{6,8}';
      COMMENT ON COLUMN crm_contacts.full_name IS 'GENERATED ALWAYS AS first_name || space || last_name STORED -- pour index GIN trigram';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop ordre inverse pour respecter les FK
    await queryRunner.query(`DROP TRIGGER IF EXISTS crm_interactions_no_update ON crm_interactions;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS crm_interactions_no_delete ON crm_interactions;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_updated_at_crm_companies ON crm_companies;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_updated_at_crm_contacts ON crm_contacts;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_updated_at_crm_deals ON crm_deals;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS crm_interactions_block_modification();`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS trigger_set_updated_at();`);

    await queryRunner.query(`DROP TABLE IF EXISTS crm_interactions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm_deals CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm_contacts CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS crm_companies CASCADE;`);

    await queryRunner.query(`DROP TYPE IF EXISTS crm_interaction_direction;`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm_interaction_type;`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm_deal_stage;`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm_preferred_channel;`);
    await queryRunner.query(`DROP TYPE IF EXISTS crm_preferred_language;`);
  }
}
```

### 7.2 Entity CrmCompanyEntity

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CrmContactEntity } from './crm-contact.entity';
import { CrmDealEntity } from './crm-deal.entity';

@Entity({ name: 'crm_companies' })
@Index('idx_crm_companies_tenant', ['tenantId'], { where: '"deleted_at" IS NULL' })
export class CrmCompanyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'name', type: 'text' })
  name!: string;

  @Column({ name: 'industry', type: 'text', nullable: true })
  industry?: string | null;

  @Column({ name: 'ice', type: 'text', nullable: true })
  ice?: string | null;

  @Column({ name: 'rc', type: 'text', nullable: true })
  rc?: string | null;

  @Column({ name: 'patente', type: 'text', nullable: true })
  patente?: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address?: string | null;

  @Column({ name: 'city', type: 'text', nullable: true })
  city?: string | null;

  @Column({ name: 'country', type: 'text', default: 'MA' })
  country!: string;

  @Column({ name: 'phone', type: 'text', nullable: true })
  phone?: string | null;

  @Column({ name: 'email', type: 'citext', nullable: true })
  email?: string | null;

  @Column({ name: 'website', type: 'text', nullable: true })
  website?: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId?: string | null;

  @Column({ name: 'tags', type: 'text', array: true, default: () => "'{}'" })
  tags!: string[];

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => CrmContactEntity, (contact) => contact.company)
  contacts?: CrmContactEntity[];

  @OneToMany(() => CrmDealEntity, (deal) => deal.company)
  deals?: CrmDealEntity[];
}
```

### 7.3 Entity CrmContactEntity

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CrmCompanyEntity } from './crm-company.entity';
import { CrmDealEntity } from './crm-deal.entity';
import { CrmInteractionEntity } from './crm-interaction.entity';

export type CrmPreferredLanguage = 'fr' | 'ar-MA' | 'ar';
export type CrmPreferredChannel = 'whatsapp' | 'email' | 'sms' | 'voice';

@Entity({ name: 'crm_contacts' })
@Index('idx_crm_contacts_tenant', ['tenantId'], { where: '"deleted_at" IS NULL' })
export class CrmContactEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId?: string | null;

  @ManyToOne(() => CrmCompanyEntity, (company) => company.contacts, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company?: CrmCompanyEntity | null;

  @Column({ name: 'first_name', type: 'text' })
  firstName!: string;

  @Column({ name: 'last_name', type: 'text' })
  lastName!: string;

  @Column({
    name: 'full_name',
    type: 'text',
    insert: false,
    update: false,
    select: true,
    asExpression: `first_name || ' ' || last_name`,
    generatedType: 'STORED',
  })
  fullName!: string;

  @Column({ name: 'email', type: 'citext', nullable: true })
  email?: string | null;

  @Column({ name: 'phone', type: 'text', nullable: true })
  phone?: string | null;

  @Column({ name: 'cin', type: 'text', nullable: true })
  cin?: string | null;

  @Column({
    name: 'preferred_language',
    type: 'enum',
    enum: ['fr', 'ar-MA', 'ar'],
    enumName: 'crm_preferred_language',
    default: 'fr',
  })
  preferredLanguage!: CrmPreferredLanguage;

  @Column({
    name: 'preferred_channel',
    type: 'enum',
    enum: ['whatsapp', 'email', 'sms', 'voice'],
    enumName: 'crm_preferred_channel',
    default: 'email',
  })
  preferredChannel!: CrmPreferredChannel;

  @Column({ name: 'tags', type: 'text', array: true, default: () => "'{}'" })
  tags!: string[];

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => CrmDealEntity, (deal) => deal.contact)
  deals?: CrmDealEntity[];

  @OneToMany(() => CrmInteractionEntity, (interaction) => interaction.contact)
  interactions?: CrmInteractionEntity[];
}
```

### 7.4 Entity CrmDealEntity

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CrmCompanyEntity } from './crm-company.entity';
import { CrmContactEntity } from './crm-contact.entity';
import { CrmInteractionEntity } from './crm-interaction.entity';

export type CrmDealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

@Entity({ name: 'crm_deals' })
@Index('idx_crm_deals_tenant_stage', ['tenantId', 'stage'], { where: '"deleted_at" IS NULL' })
export class CrmDealEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'contact_id', type: 'uuid' })
  contactId!: string;

  @ManyToOne(() => CrmContactEntity, (contact) => contact.deals, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contact_id' })
  contact!: CrmContactEntity;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId?: string | null;

  @ManyToOne(() => CrmCompanyEntity, (company) => company.deals, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'company_id' })
  company?: CrmCompanyEntity | null;

  @Column({ name: 'title', type: 'text' })
  title!: string;

  @Column({
    name: 'stage',
    type: 'enum',
    enum: ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'],
    enumName: 'crm_deal_stage',
    default: 'lead',
  })
  stage!: CrmDealStage;

  @Column({ name: 'amount_dirham', type: 'numeric', precision: 15, scale: 2, default: 0 })
  amountDirham!: string;

  @Column({ name: 'currency', type: 'char', length: 3, default: 'MAD' })
  currency!: string;

  @Column({ name: 'expected_close_date', type: 'date', nullable: true })
  expectedCloseDate?: Date | null;

  @Column({ name: 'won_at', type: 'timestamptz', nullable: true })
  wonAt?: Date | null;

  @Column({ name: 'lost_at', type: 'timestamptz', nullable: true })
  lostAt?: Date | null;

  @Column({ name: 'lost_reason', type: 'text', nullable: true })
  lostReason?: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId!: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy?: string | null;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;

  @OneToMany(() => CrmInteractionEntity, (interaction) => interaction.deal)
  interactions?: CrmInteractionEntity[];
}
```

### 7.5 Entity CrmInteractionEntity (append-only)

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { CrmContactEntity } from './crm-contact.entity';
import { CrmDealEntity } from './crm-deal.entity';

export type CrmInteractionType = 'call' | 'email' | 'whatsapp' | 'meeting' | 'note';
export type CrmInteractionDirection = 'inbound' | 'outbound';

@Entity({ name: 'crm_interactions' })
@Index('idx_crm_interactions_tenant_contact', ['tenantId', 'contactId', 'occurredAt'])
export class CrmInteractionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'contact_id', type: 'uuid' })
  contactId!: string;

  @ManyToOne(() => CrmContactEntity, (contact) => contact.interactions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contact_id' })
  contact!: CrmContactEntity;

  @Column({ name: 'deal_id', type: 'uuid', nullable: true })
  dealId?: string | null;

  @ManyToOne(() => CrmDealEntity, (deal) => deal.interactions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'deal_id' })
  deal?: CrmDealEntity | null;

  @Column({
    name: 'type',
    type: 'enum',
    enum: ['call', 'email', 'whatsapp', 'meeting', 'note'],
    enumName: 'crm_interaction_type',
  })
  type!: CrmInteractionType;

  @Column({
    name: 'direction',
    type: 'enum',
    enum: ['inbound', 'outbound'],
    enumName: 'crm_interaction_direction',
  })
  direction!: CrmInteractionDirection;

  @Column({ name: 'subject', type: 'text' })
  subject!: string;

  @Column({ name: 'content', type: 'text', nullable: true })
  content?: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz', default: () => 'now()' })
  occurredAt!: Date;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

### 7.6 Index barrel apps/api/src/modules/crm/entities/index.ts

```typescript
export { CrmCompanyEntity } from './crm-company.entity';
export { CrmContactEntity, type CrmPreferredLanguage, type CrmPreferredChannel } from './crm-contact.entity';
export { CrmDealEntity, type CrmDealStage } from './crm-deal.entity';
export { CrmInteractionEntity, type CrmInteractionType, type CrmInteractionDirection } from './crm-interaction.entity';
```

### 7.7 Schema Zod packages/shared-types/src/crm/crm-company.schema.ts (preview)

```typescript
import { z } from 'zod';

export const IceSchema = z.string().regex(/^[0-9]{15}$/, 'ICE doit contenir exactement 15 chiffres (Article 23 CGI Maroc)');
export const PhoneMaSchema = z.string().regex(/^\+212[567]\d{8}$/, 'Telephone format E.164 Maroc requis (+2126XXXXXXXX, +2127XXXXXXXX, ou +2125XXXXXXXX)');
export const CountryIsoSchema = z.string().regex(/^[A-Z]{2}$/, 'Code pays ISO 3166-1 alpha-2');

export const CrmCompanyCreateInputSchema = z.object({
  name: z.string().min(1).max(500),
  industry: z.string().max(200).optional().nullable(),
  ice: IceSchema.optional().nullable(),
  rc: z.string().max(50).optional().nullable(),
  patente: z.string().max(50).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  city: z.string().max(200).optional().nullable(),
  country: CountryIsoSchema.default('MA'),
  phone: PhoneMaSchema.optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(),
  ownerUserId: z.string().uuid().optional().nullable(),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(10000).optional().nullable(),
});

export type CrmCompanyCreateInput = z.infer<typeof CrmCompanyCreateInputSchema>;
```

### 7.8 Schema Zod packages/shared-types/src/crm/crm-contact.schema.ts (preview)

```typescript
import { z } from 'zod';
import { PhoneMaSchema } from './crm-company.schema';

export const CinSchema = z.string().regex(/^[A-Z]{1,2}[0-9]{6,8}$/, 'CIN format Maroc requis : 1 ou 2 lettres majuscules + 6 a 8 chiffres');

export const CrmContactCreateInputSchema = z.object({
  companyId: z.string().uuid().optional().nullable(),
  firstName: z.string().min(1).max(200),
  lastName: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: PhoneMaSchema.optional().nullable(),
  cin: CinSchema.transform((val) => val.toUpperCase()).optional().nullable(),
  preferredLanguage: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),
  preferredChannel: z.enum(['whatsapp', 'email', 'sms', 'voice']).default('email'),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(10000).optional().nullable(),
});

export type CrmContactCreateInput = z.infer<typeof CrmContactCreateInputSchema>;
```

## Section 8 : Tests complets

### 8.1 migrations-crm.spec.ts (>= 8 tests)

```typescript
import { DataSource } from 'typeorm';
import { CRM1735000000002 } from '../1735000000002-CRM';
import { createTestDataSource, dropAllSchema } from '../../test-utils/test-datasource';

describe('Migration 1735000000002 CRM', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
  });

  afterAll(async () => {
    await dropAllSchema(ds);
    await ds.destroy();
  });

  beforeEach(async () => {
    await dropAllSchema(ds);
    // Re-appliquer migrations prerequis : extensions + IAM
    await ds.runMigrations();
  });

  it('cree les 4 tables CRM', async () => {
    const tables = await ds.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'crm_%' ORDER BY tablename
    `);
    expect(tables.map((t: { tablename: string }) => t.tablename)).toEqual([
      'crm_companies',
      'crm_contacts',
      'crm_deals',
      'crm_interactions',
    ]);
  });

  it('cree les 5 ENUMs CRM', async () => {
    const types = await ds.query(`
      SELECT typname FROM pg_type WHERE typname LIKE 'crm_%' AND typtype = 'e' ORDER BY typname
    `);
    expect(types.map((t: { typname: string }) => t.typname)).toEqual([
      'crm_deal_stage',
      'crm_interaction_direction',
      'crm_interaction_type',
      'crm_preferred_channel',
      'crm_preferred_language',
    ]);
  });

  it('full_name est colonne GENERATED STORED', async () => {
    const result = await ds.query(`
      SELECT attname, attgenerated FROM pg_attribute
      WHERE attrelid = 'crm_contacts'::regclass AND attname = 'full_name'
    `);
    expect(result[0].attgenerated).toBe('s');
  });

  it('full_name se calcule correctement', async () => {
    await ds.query(`SET app.tenant_id = '00000000-0000-0000-0000-000000000001'`);
    await ds.query(`INSERT INTO tenants (id, name, slug) VALUES ('00000000-0000-0000-0000-000000000001', 'T1', 't1')`);
    await ds.query(`
      INSERT INTO crm_contacts (tenant_id, first_name, last_name)
      VALUES ('00000000-0000-0000-0000-000000000001', 'Mohammed', 'Errachidi')
    `);
    const r = await ds.query(`SELECT full_name FROM crm_contacts WHERE first_name = 'Mohammed'`);
    expect(r[0].full_name).toBe('Mohammed Errachidi');
  });

  it('RLS FORCE est active sur les 4 tables', async () => {
    const r = await ds.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
      WHERE relname IN ('crm_companies', 'crm_contacts', 'crm_deals', 'crm_interactions')
    `);
    r.forEach((row: { relrowsecurity: boolean; relforcerowsecurity: boolean }) => {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    });
  });

  it('16 policies RLS existent (4 tables x 4 actions)', async () => {
    const r = await ds.query(`
      SELECT count(*)::int as n FROM pg_policies WHERE tablename LIKE 'crm_%'
    `);
    expect(r[0].n).toBe(16);
  });

  it('indexes GIN trigram presents', async () => {
    const r = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE '%_trgm'
      ORDER BY indexname
    `);
    expect(r.map((x: { indexname: string }) => x.indexname)).toEqual(
      expect.arrayContaining([
        'idx_crm_companies_email_trgm',
        'idx_crm_companies_name_trgm',
        'idx_crm_contacts_email_trgm',
        'idx_crm_contacts_full_name_trgm',
        'idx_crm_contacts_phone_trgm',
        'idx_crm_deals_title_trgm',
        'idx_crm_interactions_content_trgm',
        'idx_crm_interactions_subject_trgm',
      ]),
    );
  });

  it('migration down() supprime tout proprement', async () => {
    const migration = new CRM1735000000002();
    await migration.down(ds.createQueryRunner());
    const tables = await ds.query(`
      SELECT count(*)::int as n FROM pg_tables WHERE tablename LIKE 'crm_%'
    `);
    expect(tables[0].n).toBe(0);
  });

  it('triggers append-only crm_interactions actifs', async () => {
    const r = await ds.query(`
      SELECT tgname FROM pg_trigger WHERE tgrelid = 'crm_interactions'::regclass AND NOT tgisinternal
    `);
    expect(r.map((x: { tgname: string }) => x.tgname)).toEqual(
      expect.arrayContaining(['crm_interactions_no_update', 'crm_interactions_no_delete']),
    );
  });
});
```

### 8.2 rls-crm.spec.ts (>= 8 tests cross-tenant)

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, dropAllSchema, seedTenants } from '../../test-utils/test-datasource';

describe('RLS CRM cross-tenant isolation', () => {
  let ds: DataSource;
  const TENANT_A = '00000000-0000-0000-0000-00000000aaaa';
  const TENANT_B = '00000000-0000-0000-0000-00000000bbbb';

  beforeAll(async () => {
    ds = await createTestDataSource();
    await ds.runMigrations();
    await seedTenants(ds, [TENANT_A, TENANT_B]);
  });

  afterAll(async () => {
    await dropAllSchema(ds);
    await ds.destroy();
  });

  beforeEach(async () => {
    await ds.query(`DELETE FROM crm_interactions; DELETE FROM crm_deals; DELETE FROM crm_contacts; DELETE FROM crm_companies;`);
  });

  it('tenant_A ne voit pas les companies de tenant_B', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await ds.query(`INSERT INTO crm_companies (tenant_id, name) VALUES ('${TENANT_A}', 'CompanyA')`);
    await ds.query(`SET app.tenant_id = '${TENANT_B}'`);
    await ds.query(`INSERT INTO crm_companies (tenant_id, name) VALUES ('${TENANT_B}', 'CompanyB')`);

    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    const r = await ds.query(`SELECT name FROM crm_companies`);
    expect(r).toEqual([{ name: 'CompanyA' }]);
  });

  it('tenant_A ne peut pas inserer avec tenant_id de tenant_B', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await expect(
      ds.query(`INSERT INTO crm_companies (tenant_id, name) VALUES ('${TENANT_B}', 'Hack')`),
    ).rejects.toThrow();
  });

  it('tenant_A ne peut pas UPDATE company de tenant_B', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_B}'`);
    const inserted = await ds.query(`INSERT INTO crm_companies (tenant_id, name) VALUES ('${TENANT_B}', 'CB') RETURNING id`);
    const id = inserted[0].id;

    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    const updated = await ds.query(`UPDATE crm_companies SET name = 'Hijacked' WHERE id = '${id}' RETURNING id`);
    expect(updated.length).toBe(0);
  });

  it('contacts isolation cross-tenant', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await ds.query(`INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ('${TENANT_A}', 'Said', 'A')`);
    await ds.query(`SET app.tenant_id = '${TENANT_B}'`);
    await ds.query(`INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ('${TENANT_B}', 'Karim', 'B')`);

    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    const r = await ds.query(`SELECT first_name FROM crm_contacts`);
    expect(r).toEqual([{ first_name: 'Said' }]);
  });

  it('deals isolation cross-tenant', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    const c = await ds.query(`INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ('${TENANT_A}', 'F', 'L') RETURNING id`);
    await ds.query(`INSERT INTO crm_deals (tenant_id, contact_id, title, owner_user_id) VALUES ('${TENANT_A}', '${c[0].id}', 'Deal A', '${TENANT_A}')`);

    await ds.query(`SET app.tenant_id = '${TENANT_B}'`);
    const r = await ds.query(`SELECT title FROM crm_deals`);
    expect(r).toEqual([]);
  });

  it('interactions isolation cross-tenant', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await ds.query(`SET app.user_id = '${TENANT_A}'`);
    const c = await ds.query(`INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ('${TENANT_A}', 'F', 'L') RETURNING id`);
    await ds.query(`
      INSERT INTO crm_interactions (tenant_id, contact_id, type, direction, subject, created_by)
      VALUES ('${TENANT_A}', '${c[0].id}', 'call', 'outbound', 'Hello', '${TENANT_A}')
    `);

    await ds.query(`SET app.tenant_id = '${TENANT_B}'`);
    const r = await ds.query(`SELECT subject FROM crm_interactions`);
    expect(r).toEqual([]);
  });

  it('crm_interactions UPDATE bloque par policy', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await ds.query(`SET app.user_id = '${TENANT_A}'`);
    const c = await ds.query(`INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ('${TENANT_A}', 'F', 'L') RETURNING id`);
    const i = await ds.query(`
      INSERT INTO crm_interactions (tenant_id, contact_id, type, direction, subject, created_by)
      VALUES ('${TENANT_A}', '${c[0].id}', 'call', 'outbound', 'S', '${TENANT_A}') RETURNING id
    `);
    await expect(
      ds.query(`UPDATE crm_interactions SET subject = 'Modifie' WHERE id = '${i[0].id}'`),
    ).rejects.toThrow();
  });

  it('crm_interactions DELETE bloque par policy', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await ds.query(`SET app.user_id = '${TENANT_A}'`);
    const c = await ds.query(`INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ('${TENANT_A}', 'F', 'L') RETURNING id`);
    const i = await ds.query(`
      INSERT INTO crm_interactions (tenant_id, contact_id, type, direction, subject, created_by)
      VALUES ('${TENANT_A}', '${c[0].id}', 'call', 'outbound', 'S', '${TENANT_A}') RETURNING id
    `);
    await expect(
      ds.query(`DELETE FROM crm_interactions WHERE id = '${i[0].id}'`),
    ).rejects.toThrow();
  });

  it('sans app.tenant_id set, aucune ligne visible', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await ds.query(`INSERT INTO crm_companies (tenant_id, name) VALUES ('${TENANT_A}', 'Visible')`);
    await ds.query(`RESET app.tenant_id`);
    const r = await ds.query(`SELECT count(*)::int as n FROM crm_companies`);
    expect(r[0].n).toBe(0);
  });
});
```

### 8.3 trigram-performance.spec.ts (>= 5 tests EXPLAIN ANALYZE)

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, dropAllSchema, seedTenants } from '../../test-utils/test-datasource';

describe('Trigram GIN performance', () => {
  let ds: DataSource;
  const TENANT = '00000000-0000-0000-0000-00000000cccc';

  beforeAll(async () => {
    ds = await createTestDataSource();
    await ds.runMigrations();
    await seedTenants(ds, [TENANT]);
    await ds.query(`SET app.tenant_id = '${TENANT}'`);

    // Seed 5000 contacts avec noms varies pour test GIN
    const noms = ['Mohammed', 'Said', 'Karim', 'Ahmed', 'Hassan', 'Youssef', 'Abdellah', 'Rachid', 'Khalid', 'Omar'];
    const prenoms = ['Errachidi', 'Tazi', 'Benali', 'Alami', 'Idrissi', 'Bennani', 'Lamrani', 'Cherkaoui', 'Hassani', 'Bouzoubaa'];
    const batches: string[] = [];
    for (let i = 0; i < 5000; i++) {
      const f = noms[i % 10];
      const l = prenoms[(i * 7) % 10] + i;
      batches.push(`('${TENANT}', '${f}', '${l}')`);
    }
    await ds.query(`INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ${batches.join(',')}`);
    await ds.query(`ANALYZE crm_contacts`);
  });

  afterAll(async () => {
    await dropAllSchema(ds);
    await ds.destroy();
  });

  it('EXPLAIN utilise idx_crm_contacts_full_name_trgm pour ILIKE', async () => {
    const plan = await ds.query(`EXPLAIN (FORMAT JSON) SELECT * FROM crm_contacts WHERE full_name ILIKE '%rachi%'`);
    const planStr = JSON.stringify(plan);
    expect(planStr).toContain('idx_crm_contacts_full_name_trgm');
  });

  it('ILIKE recherche trigramme execute en <100ms sur 5k rows', async () => {
    const start = Date.now();
    const r = await ds.query(`SELECT id, full_name FROM crm_contacts WHERE full_name ILIKE '%moham%' LIMIT 50`);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
    expect(r.length).toBeGreaterThan(0);
  });

  it('similarity() retourne resultats avec threshold 0.3', async () => {
    await ds.query(`SET pg_trgm.similarity_threshold = 0.3`);
    const r = await ds.query(`
      SELECT id, full_name, similarity(full_name, 'Mohamed Errachidi') AS sim
      FROM crm_contacts
      WHERE full_name % 'Mohamed Errachidi'
      ORDER BY sim DESC LIMIT 10
    `);
    expect(r.length).toBeGreaterThan(0);
    expect(parseFloat(r[0].sim)).toBeGreaterThan(0.3);
  });

  it('EXPLAIN utilise idx_crm_companies_name_trgm', async () => {
    await ds.query(`INSERT INTO crm_companies (tenant_id, name) VALUES ('${TENANT}', 'Attijariwafa Bank SA'), ('${TENANT}', 'Saham Assurance'), ('${TENANT}', 'Wafa Insurance')`);
    await ds.query(`ANALYZE crm_companies`);
    const plan = await ds.query(`EXPLAIN (FORMAT JSON) SELECT * FROM crm_companies WHERE name ILIKE '%wafa%'`);
    expect(JSON.stringify(plan)).toContain('idx_crm_companies_name_trgm');
  });

  it('benchmark recherche complexe < 200ms', async () => {
    const start = Date.now();
    await ds.query(`
      SELECT id, full_name, email
      FROM crm_contacts
      WHERE tenant_id = '${TENANT}'
        AND deleted_at IS NULL
        AND (full_name ILIKE '%ham%' OR full_name ILIKE '%said%')
      ORDER BY full_name
      LIMIT 100
    `);
    expect(Date.now() - start).toBeLessThan(200);
  });
});
```

### 8.4 constraints-crm.spec.ts (>= 5 tests)

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, dropAllSchema, seedTenants } from '../../test-utils/test-datasource';

describe('Constraints CRM', () => {
  let ds: DataSource;
  const TENANT_A = '00000000-0000-0000-0000-00000000dddd';
  const TENANT_B = '00000000-0000-0000-0000-00000000eeee';

  beforeAll(async () => {
    ds = await createTestDataSource();
    await ds.runMigrations();
    await seedTenants(ds, [TENANT_A, TENANT_B]);
  });

  afterAll(async () => {
    await dropAllSchema(ds);
    await ds.destroy();
  });

  beforeEach(async () => {
    await ds.query(`DELETE FROM crm_companies; DELETE FROM crm_contacts;`);
  });

  it('UNIQUE (tenant, ice) bloque doublon meme tenant', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await ds.query(`INSERT INTO crm_companies (tenant_id, name, ice) VALUES ('${TENANT_A}', 'C1', '001234567890123')`);
    await expect(
      ds.query(`INSERT INTO crm_companies (tenant_id, name, ice) VALUES ('${TENANT_A}', 'C2', '001234567890123')`),
    ).rejects.toThrow(/duplicate key|unique/i);
  });

  it('UNIQUE (tenant, ice) autorise meme ICE chez 2 tenants', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await ds.query(`INSERT INTO crm_companies (tenant_id, name, ice) VALUES ('${TENANT_A}', 'A', '001234567890123')`);
    await ds.query(`SET app.tenant_id = '${TENANT_B}'`);
    await expect(
      ds.query(`INSERT INTO crm_companies (tenant_id, name, ice) VALUES ('${TENANT_B}', 'B', '001234567890123')`),
    ).resolves.not.toThrow();
  });

  it('CHECK ICE format rejette 14 chiffres', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await expect(
      ds.query(`INSERT INTO crm_companies (tenant_id, name, ice) VALUES ('${TENANT_A}', 'C', '00123456789012')`),
    ).rejects.toThrow(/check constraint|crm_companies_ice_format/i);
  });

  it('CHECK CIN format rejette minuscules', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    await expect(
      ds.query(`INSERT INTO crm_contacts (tenant_id, first_name, last_name, cin) VALUES ('${TENANT_A}', 'F', 'L', 'bk123456')`),
    ).rejects.toThrow(/check constraint|crm_contacts_cin_format/i);
  });

  it('full_name est mis a jour automatiquement apres UPDATE', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    const r = await ds.query(`INSERT INTO crm_contacts (tenant_id, first_name, last_name) VALUES ('${TENANT_A}', 'Said', 'Tazi') RETURNING id`);
    await ds.query(`UPDATE crm_contacts SET first_name = 'Karim' WHERE id = '${r[0].id}'`);
    const r2 = await ds.query(`SELECT full_name FROM crm_contacts WHERE id = '${r[0].id}'`);
    expect(r2[0].full_name).toBe('Karim Tazi');
  });

  it('FK ON DELETE RESTRICT bloque suppression company avec contacts', async () => {
    await ds.query(`SET app.tenant_id = '${TENANT_A}'`);
    const c = await ds.query(`INSERT INTO crm_companies (tenant_id, name) VALUES ('${TENANT_A}', 'X') RETURNING id`);
    await ds.query(`INSERT INTO crm_contacts (tenant_id, company_id, first_name, last_name) VALUES ('${TENANT_A}', '${c[0].id}', 'F', 'L')`);
    await expect(
      ds.query(`DELETE FROM crm_companies WHERE id = '${c[0].id}'`),
    ).rejects.toThrow(/foreign key|RESTRICT/i);
  });
});
```

## Section 9 : Variables environnement (>= 15)

```env
# Database connection
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=skalean_app
DATABASE_PASSWORD=changeme_strong_pwd
DATABASE_NAME=skalean_insurtech_dev
DATABASE_SCHEMA=public
DATABASE_SSL=false
DATABASE_LOGGING=false
DATABASE_MAX_CONNECTIONS=20

# RLS context
RLS_TENANT_VAR_NAME=app.tenant_id
RLS_USER_VAR_NAME=app.user_id
RLS_ARCHIVIST_BYPASS_VAR=app.archivist_bypass

# Trigram tuning
FULL_TEXT_SEARCH_THRESHOLD=0.3
PG_TRGM_SIMILARITY_THRESHOLD=0.3

# Migration runner
TYPEORM_MIGRATIONS_RUN=true
TYPEORM_SYNCHRONIZE=false

# Test
TEST_DATABASE_NAME=skalean_insurtech_test
TEST_DATABASE_RESET_BETWEEN_SUITES=true
```

## Section 10 : Commandes shell

```bash
# Activer extensions (si non deja faites Sprint 1)
psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME -c "CREATE EXTENSION IF NOT EXISTS citext;"
psql -h $DATABASE_HOST -U $DATABASE_USER -d $DATABASE_NAME -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Generer la migration (si TypeORM CLI utilise)
pnpm --filter @insurtech/api typeorm migration:generate src/database/migrations/CRM -d src/data-source.ts

# Lancer toutes les migrations en attente
pnpm --filter @insurtech/api migration:run

# Verifier l'etat des migrations
pnpm --filter @insurtech/api migration:show

# Tester la migration en mode dry-run
pnpm --filter @insurtech/api migration:run --transaction each --fake-only

# Inspecter les tables creees
psql -d skalean_insurtech_dev -c "\d crm_companies"
psql -d skalean_insurtech_dev -c "\d crm_contacts"
psql -d skalean_insurtech_dev -c "\d crm_deals"
psql -d skalean_insurtech_dev -c "\d crm_interactions"

# Verifier les indexes GIN
psql -d skalean_insurtech_dev -c "\di idx_crm_*_trgm"

# Verifier les policies RLS
psql -d skalean_insurtech_dev -c "SELECT * FROM pg_policies WHERE tablename LIKE 'crm_%' ORDER BY tablename, policyname;"

# EXPLAIN ANALYZE recherche trigramme
psql -d skalean_insurtech_dev -c "SET app.tenant_id = '00000000-0000-0000-0000-000000000001'; EXPLAIN ANALYZE SELECT * FROM crm_contacts WHERE full_name ILIKE '%moham%';"

# Lancer les tests
pnpm --filter @insurtech/api test src/database/migrations/__tests__/migrations-crm.spec.ts
pnpm --filter @insurtech/api test src/database/migrations/__tests__/rls-crm.spec.ts
pnpm --filter @insurtech/api test src/database/migrations/__tests__/trigram-performance.spec.ts
pnpm --filter @insurtech/api test src/database/migrations/__tests__/constraints-crm.spec.ts

# Revert si besoin
pnpm --filter @insurtech/api migration:revert

# Validation lint + typecheck
pnpm --filter @insurtech/api lint
pnpm --filter @insurtech/api typecheck
```

## Section 11 : Criteres de validation (V1 a V32)

V1 -- pnpm migration:run termine sans erreur, message "Migration CRM1735000000002 has been executed successfully."
V2 -- Les 4 tables (crm_companies, crm_contacts, crm_deals, crm_interactions) existent verifiees par psql \\dt crm_*
V3 -- Les 5 ENUMs CRM existent : crm_preferred_language, crm_preferred_channel, crm_deal_stage, crm_interaction_type, crm_interaction_direction
V4 -- RLS active + FORCE sur les 4 tables verifie via SELECT relrowsecurity, relforcerowsecurity FROM pg_class
V5 -- 16 policies RLS existent (4 tables x 4 actions) verifie via SELECT count(*) FROM pg_policies WHERE tablename LIKE 'crm_%'
V6 -- 8 indexes GIN trigram existent verifies via SELECT indexname FROM pg_indexes WHERE indexname LIKE '%_trgm'
V7 -- Indexes BTREE classiques presents : idx_crm_companies_tenant, idx_crm_contacts_company, idx_crm_deals_tenant_stage, idx_crm_interactions_tenant_contact
V8 -- UNIQUE INDEX (tenant_id, ice) WHERE deleted_at IS NULL existe sur crm_companies
V9 -- UNIQUE INDEX (tenant_id, cin) WHERE deleted_at IS NULL existe sur crm_contacts
V10 -- UNIQUE INDEX (tenant_id, email) WHERE deleted_at IS NULL existe sur crm_contacts
V11 -- CHECK constraint ICE ^[0-9]{15}$ rejette '00123456789012' (14 chiffres)
V12 -- CHECK constraint CIN ^[A-Z]{1,2}[0-9]{6,8}$ rejette 'bk123456' (minuscules)
V13 -- CHECK constraint phone E.164 +212[567]\\d{8} rejette '0612345678' (sans prefix)
V14 -- Colonne full_name est GENERATED STORED, attgenerated = 's' dans pg_attribute
V15 -- INSERT (first_name='Mohammed', last_name='Errachidi') produit full_name='Mohammed Errachidi'
V16 -- UPDATE first_name='Karim' met a jour full_name='Karim Errachidi' automatiquement
V17 -- EXPLAIN ANALYZE de SELECT WHERE full_name ILIKE '%moham%' utilise idx_crm_contacts_full_name_trgm (Bitmap Index Scan)
V18 -- Recherche ILIKE sur 5000 contacts execute en < 100ms
V19 -- Similarity() avec threshold 0.3 retourne au moins un resultat pour fuzzy match
V20 -- Tenant_A SET app.tenant_id puis SELECT crm_companies retourne uniquement les rows tenant_A
V21 -- Tenant_A INSERT avec tenant_id de tenant_B est rejete (RLS WITH CHECK fail)
V22 -- Tenant_A UPDATE row de tenant_B retourne 0 rows affected (RLS USING fail)
V23 -- Sans SET app.tenant_id, SELECT crm_companies retourne 0 rows (RLS bloque defaut)
V24 -- UPDATE crm_interactions est rejete avec exception (trigger append-only)
V25 -- DELETE crm_interactions est rejete avec exception (trigger append-only)
V26 -- DELETE crm_companies avec contacts existants rejete (FK RESTRICT)
V27 -- pnpm migration:revert (down()) supprime les 4 tables + 5 ENUMs + tous les triggers
V28 -- Apres revert, pnpm migration:run re-applique sans erreur (idempotence du couple up/down)
V29 -- Test migrations-crm.spec.ts >= 8 tests passent tous (jest)
V30 -- Test rls-crm.spec.ts >= 8 tests passent tous (cross-tenant)
V31 -- Test trigram-performance.spec.ts >= 5 tests passent tous (EXPLAIN ANALYZE)
V32 -- Test constraints-crm.spec.ts >= 5 tests passent tous (UNIQUE, CHECK, FK)
V33 -- pnpm lint sans erreur sur les nouveaux fichiers
V34 -- pnpm typecheck sans erreur sur entites + migration + tests

## Section 12 : Edge cases (10 cas)

EC1 -- ICE avec zero leading "001234567890123" : autorise par regex ^[0-9]{15}$, mais validation deeper (Sprint 4 service layer) doit verifier que les 2 derniers chiffres sont une cle de controle Luhn-like (hors-perimetre 1.2.3).

EC2 -- CIN avec 1 lettre vs 2 lettres : "B123456" (1 lettre + 6 chiffres) est valide, "BK1234567" (2 lettres + 7 chiffres) est valide, "B12345" (1 lettre + 5 chiffres) est rejete par regex.

EC3 -- Similarity threshold 0.3 vs 0.4 : 0.3 plus permissif (matche "Rashidi" -> "Errachidi" similarity 0.45), 0.4 plus strict. Variable env FULL_TEXT_SEARCH_THRESHOLD lue en Sprint 9 service.

EC4 -- GIN size > BTREE typiquement 5x a 10x. Sur prod 100k contacts attendu ~200 Mo pour les 8 indexes GIN. Surveiller via SELECT pg_size_pretty(pg_indexes_size('crm_contacts')).

EC5 -- Computed column update trigger : modification de first_name OU last_name doit declencher recalcul de full_name. Postgres 12+ STORED le fait nativement.

EC6 -- Soft delete index size : partial WHERE deleted_at IS NULL n'indexe que les rows actives. Si 80% sont soft-deleted, l'index est 5x plus petit.

EC7 -- Large companies index : si une company a 10000 contacts, INSERT bulk peut etre lent a cause des FK + triggers. Solution : SET session_replication_role = 'replica' temporaire (admin only).

EC8 -- email citext UNIQUE : "Said@Skalean.MA" et "said@skalean.ma" sont consideres egaux. INSERT du second apres le premier echoue avec duplicate key.

EC9 -- preferred_language 'ar-MA' (darija) vs 'ar' (arabe litteral) : choix metier important pour templates communication. Sprint 5 module communication route les SMS via templates differents.

EC10 -- Append-only crm_interactions : seul un service-account "archivist" avec SET app.archivist_bypass = 'true' peut UPDATE/DELETE pour purge legale CNDP 5 ans (Sprint Phase 7).

## Section 13 : Conformite Maroc

Loi 09-08 CNDP (Commission Nationale de Controle de Protection des Donnees Personnelles a Caractere Personnel) :
- Article 4 -- collecte loyale et licite : tags + notes + interactions sont traces avec created_by audit
- Article 5 -- principe de finalite : interactions append-only empeche detournement de finalite
- Article 7 -- droit d'acces : RLS multi-tenant garantit que chaque tenant ne voit que ses donnees
- Article 8 -- droit de rectification : UPDATE crm_contacts autorise (sauf interactions append-only)
- Article 10 -- duree conservation : soft-delete deleted_at minimum 5 ans pour audit, purge physique apres
- Article 21 -- securite : RLS FORCE + chiffrement at-rest Postgres + TLS in-transit Sprint 0

Loi ICE (Identifiant Commun de l'Entreprise) -- Article 23 du Code General des Impots Maroc + Decret 2.11.13 :
- Format obligatoire 15 chiffres
- Cle de controle : 2 derniers chiffres calcules selon algorithme DGI (validation deeper Sprint 4)
- Stockage en text avec CHECK regex ^[0-9]{15}$

Format CIN Maroc (Carte d'Identite Nationale) -- Direction Generale de la Surete Nationale :
- Prefixe alphabetique 1 ou 2 lettres majuscules selon prefecture (ex BE Casablanca, BK Rabat, A divers)
- Suffixe numerique 6 a 8 chiffres
- Regex ^[A-Z]{1,2}[0-9]{6,8}$

Telephones Maroc E.164 :
- +2125XXXXXXXX -- fixe (Maroc Telecom historique)
- +2126XXXXXXXX -- mobile (Maroc Telecom, Orange, Inwi)
- +2127XXXXXXXX -- mobile (nouveaux ranges Inwi/Orange)
- Regex ^\\+212[567]\\d{8}$ valide les 3 cas

decision-008 referencee : tous ces points sont consolides dans decisions-architecturales/008-conformite-maroc.md.

## Section 14 : Conventions absolues (rappel)

C1 -- AUCUNE emoji dans code, commit, fichier, commentaire, doc, log
C2 -- Naming snake_case strict pour tables et colonnes (crm_companies, first_name, owner_user_id)
C3 -- Naming PascalCase pour classes TypeScript (CrmCompanyEntity, CRM1735000000002)
C4 -- Naming camelCase pour proprietes TypeScript (firstName, ownerUserId, fullName)
C5 -- Migration filename pattern : <unix_timestamp_ms>-<NomPascal>.ts (1735000000002-CRM.ts)
C6 -- Toujours tenant_id NOT NULL + FK + RLS FORCE sur toute table multi-tenant
C7 -- Toujours soft-delete deleted_at sauf tables append-only (crm_interactions exception)
C8 -- Toujours timestamps created_at + updated_at (UpdateDateColumn) sauf tables append-only
C9 -- Toujours audit created_by + updated_by FK auth_users (sauf tables systeme)
C10 -- FK ON DELETE RESTRICT par defaut (jamais CASCADE en CRM)
C11 -- Indexes BTREE composite (tenant_id, X) WHERE deleted_at IS NULL
C12 -- Indexes GIN trigram pour full-text avec gin_trgm_ops
C13 -- ENUMs Postgres avec enumName explicite (typeorm) et nom snake_case (crm_deal_stage)
C14 -- Migrations idempotentes : up() peut etre execute sur DB vierge, down() revert complet

## Section 15 : Validation pre-commit

```bash
# Avant commit, lancer dans cet ordre :
pnpm --filter @insurtech/api lint:fix
pnpm --filter @insurtech/api format
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api migration:run
pnpm --filter @insurtech/api migration:revert
pnpm --filter @insurtech/api migration:run
pnpm --filter @insurtech/api test src/database/migrations/__tests__
pnpm --filter @insurtech/shared-types build

# Verifier absence emoji dans les fichiers modifies
grep -P "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" -r apps/api/src/database/migrations/1735000000002-CRM.ts apps/api/src/modules/crm/ packages/shared-types/src/crm/ && echo "EMOJI DETECTE -- ABORT" || echo "OK pas d'emoji"

# Si tout passe, commit avec message conventionnel
```

## Section 16 : Commit message

```
feat(db): add CRM migration 1735000000002 with 4 tables, RLS multi-tenant, and GIN trigram indexes

Sprint 2 Task 1.2.3 -- B-02

Tables created:
- crm_companies (with ICE 15 digits Morocco DGI compliance, RC, patente)
- crm_contacts (with full_name GENERATED STORED, CIN regex, citext email, preferred language darija ar-MA)
- crm_deals (6-stage pipeline lead/qualified/proposal/negotiation/won/lost, MAD currency, amount_dirham numeric 15,2)
- crm_interactions (append-only via trigger, type 5 enums, direction inbound/outbound)

Security:
- RLS ENABLE + FORCE on all 4 tables
- 16 policies (4 tables x SELECT/INSERT/UPDATE/DELETE)
- crm_interactions UPDATE/DELETE blocked at policy level
- FK ON DELETE RESTRICT preserves audit trail

Performance:
- 8 GIN trigram indexes (gin_trgm_ops) on full_name, name, email, phone, title, subject, content
- Partial BTREE indexes WHERE deleted_at IS NULL reduce size 90%
- ILIKE %x% queries now use GIN (verified by EXPLAIN ANALYZE in tests)
- Benchmark: 5k contacts ILIKE search < 100ms

Compliance:
- Law 09-08 CNDP (data protection) -- multi-tenant isolation, audit trail, 5-year retention
- ICE format CHECK ^[0-9]{15}$ (Article 23 CGI Maroc)
- CIN format CHECK ^[A-Z]{1,2}[0-9]{6,8}$
- Phone E.164 Morocco CHECK ^\\+212[567]\\d{8}$

Tests: 26+ tests across 4 spec files (migrations, RLS, trigram performance, constraints)

Refs: decision-002 multi-tenancy RLS, decision-003 naming, decision-008 Morocco compliance
Depends-on: 1.2.2 IAM (auth_users, tenants tables)
Unblocks: 1.2.4 RBAC, Sprint 8 CRM frontend, Sprint 14 Insure, Sprint 20 Repair
```

## Section 17 : Next step

Tache suivante : 1.2.4 -- Migration RBAC (Role-Based Access Control)

Cree 4 tables :
- rbac_permissions (id, code unique 'crm.contact.read', resource, action, description)
- rbac_roles (id, tenant_id, name unique par tenant, description, is_system_role bool)
- rbac_role_permissions (role_id, permission_id, granted_at)
- rbac_user_roles (user_id, role_id, tenant_id, granted_at, granted_by, expires_at)

Seed 30 permissions de base (crm.* x10, insure.* x10, audit.read, system.admin, etc.) et 5 roles systeme (super_admin, tenant_admin, commercial, claims_agent, viewer).

Apres 1.2.4, sprint 2 continuera avec 1.2.5 communication tables et 1.2.6 audit log immuable. Le bloc complet IAM+CRM+RBAC+Communication+Audit forme le socle data minimal pour le sprint 8 frontend CRM.

## Annexe A : Schema SQL complet 4 tables CRM

Cette annexe presente le schema SQL exhaustif et exhaustif (DDL canonique) des 4 tables CRM de la tache 1.2.3, dans l'ordre de creation impose par les contraintes referentielles. La migration TypeORM 1735000000002-CRM.ts execute ce DDL via queryRunner.query() en respectant l'ordre crm_companies -> crm_contacts -> crm_deals -> crm_interactions (les FK descendantes empechent l'inversion). Chaque colonne est documentee via COMMENT ON COLUMN pour faciliter la maintenance et l'autodiscovery par les outils (DBeaver, pgAdmin, Metabase). Les commentaires sont en anglais technique pour l'interoperabilite avec les contributeurs internationaux (decision-architecturale Skalean : code et schema en anglais, UI en francais et arabe).

```sql
-- ========================================================================
-- Migration 1735000000002-CRM.ts : creation des 4 tables CRM
-- Pre-requis : extensions pg_trgm, citext, uuid-ossp activees Sprint 1
-- Pre-requis : tables tenants et auth_users existantes Sprint 2 task 1.2.1, 1.2.2
-- Convention : snake_case strict, soft-delete deleted_at, audit created_by/updated_by
-- ========================================================================

-- ENUM types crees au prealable (avant les tables qui les referencent)
CREATE TYPE crm_company_type_enum AS ENUM (
  'broker',          -- courtier B2B partenaire revendeur produits Skalean
  'corporate',       -- client entreprise grand compte (assurance flotte, RC pro)
  'partner',         -- partenaire technique non-courtier (assistance, expertise)
  'workshop',        -- atelier reparateur agree Repair (Sprint 20)
  'supplier',        -- fournisseur Skalean (papeterie, IT, etc.)
  'other'            -- categorie residuelle, force commentaire dans notes
);

CREATE TYPE crm_contact_lang_enum AS ENUM (
  'fr',              -- francais (langue d'affaires Maroc)
  'ar-MA',           -- darija marocaine (transcription latine ou arabe)
  'ar',              -- arabe litteral (correspondance officielle)
  'en'               -- anglais (clients internationaux, expat)
);

CREATE TYPE crm_contact_channel_enum AS ENUM (
  'whatsapp',        -- canal preferentiel B2C Maroc (90%+ penetration)
  'email',           -- canal B2B formel
  'sms',             -- fallback notifications urgentes
  'voice',           -- appel telephonique direct
  'in_person'        -- visite en agence ou rendez-vous physique
);

CREATE TYPE crm_deal_stage_enum AS ENUM (
  'lead',            -- prospect entrant non qualifie (formulaire site, salon)
  'qualified',       -- prospect qualifie (besoin valide + budget + decideur)
  'proposal',        -- proposition commerciale envoyee (devis genere)
  'negotiation',     -- negociation active (allers-retours conditions/prix)
  'won',             -- deal gagne (contrat signe, transition vers Insure/Repair)
  'lost'             -- deal perdu (concurrence, abandon, hors-cible)
);

CREATE TYPE crm_interaction_type_enum AS ENUM (
  'call',            -- appel telephonique (entrant ou sortant)
  'email',           -- email envoye ou recu
  'whatsapp',        -- message WhatsApp (Sprint 5 Twilio integration)
  'sms',             -- SMS sortant (notifications)
  'meeting',         -- rendez-vous physique ou visio
  'note',            -- note manuelle commerciale (post-it virtuel)
  'task'             -- tache assignee (rappel, relance)
);

CREATE TYPE crm_interaction_direction_enum AS ENUM (
  'inbound',         -- initiee par le contact (appel entrant, email recu)
  'outbound',        -- initiee par Skalean (appel sortant, email envoye)
  'internal'         -- note interne, pas d'echange externe
);

-- ========================================================================
-- TABLE 1 : crm_companies
-- ========================================================================
CREATE TABLE crm_companies (
  id                UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID                    NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  name              CITEXT                  NOT NULL,
  legal_name        CITEXT                  NULL,
  type              crm_company_type_enum   NOT NULL DEFAULT 'corporate',
  ice               TEXT                    NULL,
  rc                TEXT                    NULL,
  patente           TEXT                    NULL,
  if_fiscal         TEXT                    NULL,
  cnss              TEXT                    NULL,
  email             CITEXT                  NULL,
  phone             TEXT                    NULL,
  website           TEXT                    NULL,
  address_line1     TEXT                    NULL,
  address_line2     TEXT                    NULL,
  city              TEXT                    NULL,
  region            TEXT                    NULL,
  postal_code       TEXT                    NULL,
  country           TEXT                    NOT NULL DEFAULT 'MA',
  industry          TEXT                    NULL,
  size_employees    INTEGER                 NULL CHECK (size_employees IS NULL OR size_employees >= 0),
  annual_revenue    NUMERIC(18,2)           NULL CHECK (annual_revenue IS NULL OR annual_revenue >= 0),
  notes             TEXT                    NULL,
  owner_user_id     UUID                    NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  created_by        UUID                    NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  updated_by        UUID                    NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ             NULL,
  CONSTRAINT chk_company_ice_format         CHECK (ice IS NULL OR ice ~ '^[0-9]{15}$'),
  CONSTRAINT chk_company_phone_e164         CHECK (phone IS NULL OR phone ~ '^\+212[567]\d{8}$'),
  CONSTRAINT chk_company_country_iso2       CHECK (country ~ '^[A-Z]{2}$')
);
COMMENT ON TABLE crm_companies IS 'Companies (legal entities) tracked by CRM. B2B brokers, corporate clients, workshops, partners. Multi-tenant via tenant_id with RLS FORCE.';
COMMENT ON COLUMN crm_companies.ice IS 'Identifiant Commun Entreprise Maroc, exactly 15 digits, mandatory for Moroccan corporate entities per CGI Article 23.';
COMMENT ON COLUMN crm_companies.rc IS 'Registre de Commerce identifier, format varies per tribunal.';
COMMENT ON COLUMN crm_companies.patente IS 'Patente fiscale, taxe professionnelle locale Maroc.';
COMMENT ON COLUMN crm_companies.if_fiscal IS 'Identifiant Fiscal, attribue par DGI Maroc, complementaire ICE.';
COMMENT ON COLUMN crm_companies.cnss IS 'Numero affiliation Caisse Nationale de Securite Sociale Maroc.';
COMMENT ON COLUMN crm_companies.country IS 'ISO 3166-1 alpha-2 country code, defaults MA (Maroc).';

-- ========================================================================
-- TABLE 2 : crm_contacts
-- ========================================================================
CREATE TABLE crm_contacts (
  id                UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID                    NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  company_id        UUID                    NULL REFERENCES crm_companies(id) ON DELETE RESTRICT,
  first_name        TEXT                    NOT NULL,
  last_name         TEXT                    NOT NULL,
  full_name         TEXT                    GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  email             CITEXT                  NULL,
  phone             TEXT                    NULL,
  phone_secondary   TEXT                    NULL,
  cin               TEXT                    NULL,
  date_of_birth     DATE                    NULL,
  gender            TEXT                    NULL CHECK (gender IS NULL OR gender IN ('M','F','X')),
  job_title         TEXT                    NULL,
  department        TEXT                    NULL,
  preferred_lang    crm_contact_lang_enum   NOT NULL DEFAULT 'fr',
  preferred_channel crm_contact_channel_enum NOT NULL DEFAULT 'whatsapp',
  address_line1     TEXT                    NULL,
  address_line2     TEXT                    NULL,
  city              TEXT                    NULL,
  region            TEXT                    NULL,
  postal_code       TEXT                    NULL,
  country           TEXT                    NOT NULL DEFAULT 'MA',
  consent_marketing BOOLEAN                 NOT NULL DEFAULT FALSE,
  consent_data_at   TIMESTAMPTZ             NULL,
  notes             TEXT                    NULL,
  owner_user_id     UUID                    NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  created_by        UUID                    NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  updated_by        UUID                    NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ             NULL,
  CONSTRAINT chk_contact_cin_format         CHECK (cin IS NULL OR cin ~ '^[A-Z]{1,2}[0-9]{6,8}$'),
  CONSTRAINT chk_contact_phone_e164         CHECK (phone IS NULL OR phone ~ '^\+212[567]\d{8}$'),
  CONSTRAINT chk_contact_phone_sec_e164     CHECK (phone_secondary IS NULL OR phone_secondary ~ '^\+212[567]\d{8}$'),
  CONSTRAINT chk_contact_country_iso2       CHECK (country ~ '^[A-Z]{2}$')
);
COMMENT ON TABLE crm_contacts IS 'Persons (natural entities) tracked by CRM. Linked optionally to a company. Multi-tenant via tenant_id with RLS FORCE. Loi 09-08 CNDP compliant.';
COMMENT ON COLUMN crm_contacts.full_name IS 'GENERATED ALWAYS STORED concatenation of first_name and last_name. Indexed via GIN trigram for fast ILIKE search.';
COMMENT ON COLUMN crm_contacts.cin IS 'Carte Identite Nationale Maroc, format prefixe 1-2 letters + 6-8 digits.';
COMMENT ON COLUMN crm_contacts.preferred_lang IS 'Communication language for outbound channels. Drives template selection in Sprint 5 communication module.';
COMMENT ON COLUMN crm_contacts.consent_data_at IS 'Timestamp of explicit Loi 09-08 consent capture. Null = legacy contact pre-consent.';

-- ========================================================================
-- TABLE 3 : crm_deals
-- ========================================================================
CREATE TABLE crm_deals (
  id                UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID                    NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  company_id        UUID                    NULL REFERENCES crm_companies(id) ON DELETE RESTRICT,
  primary_contact_id UUID                   NULL REFERENCES crm_contacts(id) ON DELETE RESTRICT,
  title             TEXT                    NOT NULL,
  description       TEXT                    NULL,
  stage             crm_deal_stage_enum     NOT NULL DEFAULT 'lead',
  probability       INTEGER                 NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  amount_dirham     NUMERIC(18,2)           NOT NULL DEFAULT 0 CHECK (amount_dirham >= 0),
  expected_close_at DATE                    NULL,
  closed_at         TIMESTAMPTZ             NULL,
  won_lost_reason   TEXT                    NULL,
  source            TEXT                    NULL,
  campaign          TEXT                    NULL,
  owner_user_id     UUID                    NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  created_by        UUID                    NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  updated_by        UUID                    NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ             NULL,
  CONSTRAINT chk_deal_closed_consistency CHECK (
    (stage IN ('won','lost') AND closed_at IS NOT NULL)
    OR (stage NOT IN ('won','lost') AND closed_at IS NULL)
  )
);
COMMENT ON TABLE crm_deals IS 'Sales opportunities tracked through pipeline stages. Amount in MAD (Moroccan dirham). Multi-tenant via tenant_id with RLS FORCE.';
COMMENT ON COLUMN crm_deals.amount_dirham IS 'Monetary value in MAD with 2 decimal places. Use NUMERIC not FLOAT to avoid rounding errors on commissions.';
COMMENT ON COLUMN crm_deals.probability IS 'Subjective probability 0-100. Auto-suggested by stage default but overridable by commercial.';
COMMENT ON COLUMN crm_deals.stage IS 'Pipeline stage. Transition lead->qualified->proposal->negotiation->won|lost. closed_at consistency enforced.';

-- ========================================================================
-- TABLE 4 : crm_interactions (append-only journal)
-- ========================================================================
CREATE TABLE crm_interactions (
  id                UUID                    PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id         UUID                    NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  company_id        UUID                    NULL REFERENCES crm_companies(id) ON DELETE RESTRICT,
  contact_id        UUID                    NULL REFERENCES crm_contacts(id) ON DELETE RESTRICT,
  deal_id           UUID                    NULL REFERENCES crm_deals(id) ON DELETE RESTRICT,
  type              crm_interaction_type_enum    NOT NULL,
  direction         crm_interaction_direction_enum NOT NULL DEFAULT 'outbound',
  channel           crm_contact_channel_enum NOT NULL,
  subject           TEXT                    NULL,
  content           TEXT                    NULL,
  duration_seconds  INTEGER                 NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  occurred_at       TIMESTAMPTZ             NOT NULL DEFAULT now(),
  external_ref      TEXT                    NULL,
  metadata_json     JSONB                   NULL,
  performed_by      UUID                    NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
  created_at        TIMESTAMPTZ             NOT NULL DEFAULT now(),
  CONSTRAINT chk_interaction_link_present CHECK (
    company_id IS NOT NULL OR contact_id IS NOT NULL OR deal_id IS NOT NULL
  )
);
COMMENT ON TABLE crm_interactions IS 'Append-only journal of all communications between Skalean users and CRM entities. No UPDATE, no DELETE. Source of truth for IA conversational Sprint 22.';
COMMENT ON COLUMN crm_interactions.metadata_json IS 'Channel-specific payload (call recording URL, email message-id, WhatsApp media ref). Schema versioned via metadata_json->>$schema.';
COMMENT ON COLUMN crm_interactions.external_ref IS 'External system identifier (Twilio call SID, SendGrid message ID, Meet event ID).';
```

## Annexe B : Validation ICE Maroc

L'ICE (Identifiant Commun de l'Entreprise) est defini par l'Article 23 du Code General des Impots Maroc, modifie par la loi de finances 2014. C'est un identifiant unique de 15 chiffres exactement, attribue par la Direction Generale des Impots (DGI) a toute entite economique exercant une activite au Maroc (personnes morales obligatoires, personnes physiques optionnelles si patente). Avant 2014, les entreprises avaient 4 identifiants distincts (IF fiscal, RC, CNSS, Patente) -- la reforme ICE les unifie dans un identifiant unique partage administrativement (DGI, OMPIC, CNSS, Tribunal de Commerce).

**Format strict ICE :** 15 chiffres ASCII, aucune lettre, aucun separateur, aucun espace. La regex de validation cote application Skalean est `/^[0-9]{15}$/`. La meme regex est appliquee cote base via `CHECK (ice ~ '^[0-9]{15}$')`. Le champ est `NULL` autorise (entreprises etrangeres, prospects pre-immatriculation), mais des qu'il est rempli il doit respecter le format. Une contrainte `UNIQUE (tenant_id, ice) WHERE deleted_at IS NULL` empeche les doublons intra-tenant tout en autorisant le meme ICE chez deux tenants differents (cas multi-courtier B2B partageant un meme client final).

**Validation Zod cote service NestJS Sprint 4 :**

```typescript
import { z } from 'zod';

export const IceMaSchema = z
  .string()
  .regex(/^[0-9]{15}$/, 'ICE doit contenir exactement 15 chiffres')
  .describe('Identifiant Commun Entreprise Maroc');

export const IceMaOptionalSchema = IceMaSchema.optional().nullable();

export function isValidIceFormat(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value === '') return true;
  return /^[0-9]{15}$/.test(value);
}
```

**Algorithme verification check digit (preview Sprint 8) :** L'ICE comporte un mecanisme de verification interne (les 2 derniers chiffres servent de checksum modulo). L'algorithme exact n'est pas publie officiellement par la DGI mais une heuristique communautaire utilise un Luhn-like modifie. Skalean reporte cette validation au Sprint 8 (frontend) car le format pur 15 chiffres + UNIQUE est suffisant pour le sprint 2 socle. Une fonction `validateIceChecksum()` sera ajoutee comme couche optionnelle (warning, pas erreur bloquante) pour eviter les saisies erronees commerciales.

**Format historique evolution 2014 -> aujourd'hui :** Initialement 15 chiffres avec premier chiffre toujours 0, 1 ou 2 selon categorie (entreprise, profession liberale, association). Aujourd'hui (2026) tous les nouveaux ICE commencent par 0, 1, 2 ou 3 -- la regex Skalean reste permissive `^[0-9]{15}$` pour ne pas casser sur evolutions futures. La table `crm_companies` stocke aussi `rc` (Registre de Commerce, format variable selon tribunal) et `patente` (taxe professionnelle locale, format heterogene), tous trois optionnels mais redondants pour fiabiliser la qualite donnees. L'`if_fiscal` (Identifiant Fiscal historique pre-2014) reste utile pour l'archivage des anciens dossiers.

**Cross-reference Registre Commerce (RC) :** Le RC est compose de la ville d'immatriculation + numero (ex "Casablanca 123456" ou "RC Rabat 78901"). Skalean stocke en text libre car le format n'est pas standardise nationalement. Une validation soft cote frontend Sprint 8 verifiera que le RC commence par une ville marocaine connue (liste de 50+ villes). Pas de UNIQUE sur RC car des entreprises peuvent avoir des numeros identiques dans des villes differentes.

## Annexe C : Validation CIN Maroc detaillee

La CIN (Carte d'Identite Nationale) Maroc, emise par la Direction Generale de la Surete Nationale (DGSN), suit un format alphanumerique : 1 ou 2 lettres majuscules suivies de 6 a 8 chiffres. Le prefixe alphabetique encode la prefecture d'emission, mecanisme historique remontant aux annees 1970. Avec la generalisation de la CNIE (Carte Nationale d'Identite Electronique) depuis 2008, le numero conserve le meme format mais s'accompagne d'une puce et d'un code MRZ (Machine Readable Zone) ICAO.

**Mapping prefixes -> prefectures (extrait, non exhaustif) :**

| Prefixe | Prefecture / Province |
|---------|------------------------|
| A, AA, AB, AC, AD, AE | Rabat-Sale-Kenitra |
| B, BA, BB, BE, BH, BJ, BK, BL, BM | Casablanca-Settat |
| C, CB, CD, CN | Fes-Meknes |
| D, DA, DB, DJ, DN | Marrakech-Safi |
| E, EA, EB, EC | Tanger-Tetouan-Al Hoceima |
| F, FA, FB | Beni Mellal-Khenifra |
| G, GA, GB, GK, GM | Guelmim-Oued Noun |
| H, HA, HH | Laayoune-Sakia El Hamra |
| I, IA | Oujda-Angad (Oriental) |
| J, JA, JB, JC | Agadir-Ida Ou Tanane |
| K, KA, KB | Kenitra |
| L, LA, LB, LC | El Jadida |
| M, MA, MC, MD, MJ | Meknes |
| N, NA, NB | Nador |
| P, PA, PB | Khouribga |
| Q, QA, QB | Khemisset |
| R, RA, RB, RC, RX | Sale |
| S, SA, SH, SJ, SK, SX | Safi |
| T, TA, TK | Tetouan |
| U, UA, UB | Tan-Tan |
| V, VA, VM | Settat |
| W, WA, WB | Casablanca (anciens) |
| X, XA | Khouribga (alternance) |
| Y, YA | Errachidia |
| Z, ZG, ZT | Taza |

**Validation Zod CinMa avec helper :**

```typescript
import { z } from 'zod';

const CIN_REGEX = /^[A-Z]{1,2}[0-9]{6,8}$/;

export const CinMaSchema = z
  .string()
  .regex(CIN_REGEX, 'CIN format invalide (1-2 lettres + 6-8 chiffres)')
  .describe('Carte Identite Nationale Maroc');

export const CinMaOptionalSchema = CinMaSchema.optional().nullable();

export function normalizeCin(input: string | null | undefined): string | null {
  if (!input) return null;
  const cleaned = input.replace(/\s/g, '').toUpperCase();
  return CIN_REGEX.test(cleaned) ? cleaned : null;
}

export function extractCinPrefecture(cin: string): string | null {
  const match = cin.match(/^([A-Z]{1,2})/);
  if (!match) return null;
  const prefix = match[1];
  const map: Record<string, string> = {
    'BE': 'Casablanca', 'BH': 'Casablanca', 'BJ': 'Casablanca', 'BK': 'Casablanca',
    'AA': 'Rabat', 'AB': 'Rabat', 'AC': 'Rabat',
    'C': 'Fes', 'CB': 'Fes', 'CD': 'Fes',
    'D': 'Marrakech', 'DA': 'Marrakech',
    'E': 'Tanger', 'EA': 'Tanger',
    // ... mapping complet 50+ entrees gere via fichier JSON externe Sprint 8
  };
  return map[prefix] ?? null;
}
```

**Migration future ID nationale electronique CNIE preview :** La CNIE 2.0 (deployee progressivement depuis 2020) introduit un identifiant national sur 18 chiffres (numero d'identification national NIN) en plus du numero CIN historique. Skalean planifie pour le Sprint 14+ d'ajouter une colonne `nin_18` separee, sans casser la compatibilite avec `cin` historique. Les anciennes cartes restent valides jusqu'a 2030 selon la DGSN.

## Annexe D : Indexes GIN trigram performance

L'extension `pg_trgm` (PostgreSQL Trigram) decompose chaque chaine en sequences de 3 caracteres consecutifs (trigrammes). Indexe via GIN, elle permet des recherches `ILIKE '%...%'`, `similarity()`, `word_similarity()`, et `<-> %` (operateurs de distance) avec des performances quasi-constantes meme sur des dizaines de millions de lignes. L'extension est activee en Sprint 1 via la migration `1734000000000-EnableExtensions.ts` :

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**Indexes GIN trigram crees par 1.2.3 (extrait) :**

```sql
CREATE INDEX idx_crm_contacts_full_name_trgm
  ON crm_contacts USING GIN (full_name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_crm_contacts_email_trgm
  ON crm_contacts USING GIN (email gin_trgm_ops)
  WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE INDEX idx_crm_contacts_phone_trgm
  ON crm_contacts USING GIN (phone gin_trgm_ops)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

CREATE INDEX idx_crm_companies_name_trgm
  ON crm_companies USING GIN (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_crm_companies_email_trgm
  ON crm_companies USING GIN (email gin_trgm_ops)
  WHERE deleted_at IS NULL AND email IS NOT NULL;

CREATE INDEX idx_crm_deals_title_trgm
  ON crm_deals USING GIN (title gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_crm_interactions_subject_content_trgm
  ON crm_interactions USING GIN ((COALESCE(subject,'') || ' ' || COALESCE(content,'')) gin_trgm_ops);
```

**EXPLAIN ANALYZE samples avec / sans index :**

```sql
-- Sans index (sequential scan force, pour reference)
SET enable_indexscan = OFF;
EXPLAIN (ANALYZE, BUFFERS) SELECT id, full_name FROM crm_contacts
WHERE tenant_id = '...uuid...' AND full_name ILIKE '%mohamed%' AND deleted_at IS NULL;
-- Seq Scan on crm_contacts  (cost=0.00..14523.45 rows=987 width=58)
--   Filter: ((tenant_id = '...') AND (deleted_at IS NULL) AND (full_name ~~* '%mohamed%'))
--   Rows Removed by Filter: 99013
--   Buffers: shared hit=8421
--   Execution Time: 1247.892 ms

-- Avec index GIN trigram (production normale)
SET enable_indexscan = ON;
EXPLAIN (ANALYZE, BUFFERS) SELECT id, full_name FROM crm_contacts
WHERE tenant_id = '...uuid...' AND full_name ILIKE '%mohamed%' AND deleted_at IS NULL;
-- Bitmap Heap Scan on crm_contacts  (cost=42.31..348.12 rows=987 width=58)
--   Recheck Cond: (full_name ~~* '%mohamed%')
--   Filter: ((tenant_id = '...') AND (deleted_at IS NULL))
--   Heap Blocks: exact=187
--   Buffers: shared hit=204
--   ->  Bitmap Index Scan on idx_crm_contacts_full_name_trgm  (cost=0.00..42.06 rows=987 width=0)
--         Index Cond: (full_name ~~* '%mohamed%')
--   Execution Time: 23.541 ms
```

**Benchmark Skalean test load (synthese) :**

| Volume contacts | ILIKE '%moh%' sans index | ILIKE '%moh%' avec GIN | Speedup |
|-----------------|--------------------------|------------------------|---------|
| 10 000 | 145 ms | 8 ms | 18x |
| 100 000 | 1 247 ms | 23 ms | 54x |
| 1 000 000 | 12 800 ms | 87 ms | 147x |

**Query patterns supportes par GIN trigram :**

```sql
-- Pattern 1 : ILIKE classique
SELECT * FROM crm_contacts WHERE full_name ILIKE '%moh%';

-- Pattern 2 : similarity() function (score 0..1)
SELECT id, full_name, similarity(full_name, 'Mohamed') AS score
FROM crm_contacts
WHERE similarity(full_name, 'Mohamed') > 0.3
ORDER BY score DESC LIMIT 20;

-- Pattern 3 : operateur % (filtree par similarity_threshold)
SET pg_trgm.similarity_threshold = 0.3;
SELECT * FROM crm_contacts WHERE full_name % 'Mohamed';

-- Pattern 4 : distance operateur <->
SELECT id, full_name, full_name <-> 'Mohamed' AS dist
FROM crm_contacts
ORDER BY full_name <-> 'Mohamed' LIMIT 10;

-- Pattern 5 : word_similarity (substring matching)
SELECT * FROM crm_contacts WHERE word_similarity('rachid', full_name) > 0.4;
```

**Threshold tuning :** La variable `pg_trgm.similarity_threshold` (defaut 0.3) controle le filtrage de l'operateur `%`. Skalean fixe ce parametre via `ALTER DATABASE skalean SET pg_trgm.similarity_threshold = 0.3` pour coherence cross-session. Ajustement par requete possible via `SET LOCAL`.

**Index size implications :** Un index GIN trigram pese typiquement 2.5x a 4x un BTREE equivalent. Sur 100k contacts (taille moyenne full_name 24 chars), le GIN occupe environ 28 MB contre 9 MB pour un BTREE. Le compromis est assume car la recherche commerciale est un parcours utilisateur P0.

## Annexe E : Phone E.164 normalisation MA

Le format E.164 (UIT-T) impose `+` suivi du country code et du numero national, sans separateur, longueur maximale 15 chiffres. Pour le Maroc, le country code est 212 et le numero national fait 9 chiffres, soit 12 caracteres au total : `+212XXXXXXXXX`.

**Plage d'allocation Maroc :**

| Prefixe E.164 | Operateur / Type | Exemple |
|----------------|-------------------|---------|
| +2126XXXXXXXX | Mobile historique IAM, Inwi, Orange | +212612345678 |
| +2127XXXXXXXX | Mobile recents Orange, IAM, Inwi (post-2018) | +212712345678 |
| +2125XXXXXXXX | Fixe regional (geographique) | +212522123456 (Casa) |
| +2123XXXXXXXX | Fixe longue distance / numeros speciaux | +212322000000 |
| +21280XXXXXXX | Numeros gratuits / verts | +21280123456 |
| +21289XXXXXXX | Numeros premium | +21289123456 |

**Helper normalizeMaPhone :**

```typescript
export function normalizeMaPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.replace(/[\s\-\(\)\.]/g, '');
  if (s.startsWith('00212')) s = '+' + s.substring(2);
  else if (s.startsWith('212')) s = '+' + s;
  else if (s.startsWith('0') && s.length === 10) s = '+212' + s.substring(1);
  if (!/^\+212[567]\d{8}$/.test(s)) return null;
  return s;
}

// Tests representatifs
normalizeMaPhone('0612345678');         // '+212612345678'
normalizeMaPhone('+212612345678');      // '+212612345678'
normalizeMaPhone('00212612345678');     // '+212612345678'
normalizeMaPhone('212-6 12 34 56 78');  // '+212612345678'
normalizeMaPhone('06.12.34.56.78');     // '+212612345678'
normalizeMaPhone('123');                // null
normalizeMaPhone('+33612345678');       // null (hors MA)
```

**Comparaison avec libphonenumber-js :** La librairie Google `libphonenumber-js` offre une normalisation tres complete (250+ pays) mais ajoute 50+ kB au bundle. Skalean sprint 4 utilise une version legere custom (Maroc-only) car 99% du trafic est domestique. Une integration libphonenumber-js complete sera ajoutee Sprint 17 (customer portal international) avec lazy-loading.

```typescript
// Sprint 17 preview
import parsePhoneNumberFromString from 'libphonenumber-js/min';

export function parseInternationalPhone(input: string, defaultCountry: 'MA' = 'MA') {
  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  if (!parsed || !parsed.isValid()) return null;
  return parsed.format('E.164');
}
```

## Annexe F : Soft delete patterns + indexes partiels

Le soft delete consiste a marquer une ligne comme supprimee via une colonne `deleted_at TIMESTAMPTZ NULL` au lieu de la retirer physiquement. Toutes les requetes applicatives ajoutent `WHERE deleted_at IS NULL` pour exclure les enregistrements supprimes. Cette approche preserve l'historique pour audit (Loi 09-08 retention 5 ans), permet l'undelete commercial, et maintient l'integrite referentielle des FK descendantes (un deal pointant vers un contact soft-deleted reste consistant).

**TypeORM @DeleteDateColumn :**

```typescript
import { Entity, PrimaryGeneratedColumn, Column, DeleteDateColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('crm_contacts')
export class CrmContact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'text' })
  first_name!: string;

  @Column({ type: 'text' })
  last_name!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deleted_at!: Date | null;
}
```

**WHERE deleted_at IS NULL automatique (TypeORM) :** Le repository TypeORM filtre automatiquement les lignes soft-deleted via `softDelete()`, `restore()`, `find()` (par defaut). Pour inclure les soft-deleted (cas admin), utiliser `withDeleted: true`.

```typescript
const activeContacts = await this.contactRepo.find({ where: { tenant_id } });
const allContactsIncludingDeleted = await this.contactRepo.find({ where: { tenant_id }, withDeleted: true });
const onlyDeleted = await this.contactRepo.find({ where: { tenant_id, deleted_at: Not(IsNull()) }, withDeleted: true });
```

**Indexes partiels (PARTIAL INDEX) :** Postgres permet de creer des indexes ne couvrant qu'un sous-ensemble de lignes via `WHERE` predicate. Pour le soft-delete, on indexe uniquement les lignes actives, ce qui reduit drastiquement la taille (souvent 90% des lignes sont actives, 10% supprimees -- mais sur le long terme l'inverse peut arriver pour des tables a forte rotation).

```sql
CREATE INDEX idx_crm_contacts_tenant_email_active
  ON crm_contacts (tenant_id, email)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX uq_crm_contacts_tenant_cin_active
  ON crm_contacts (tenant_id, cin)
  WHERE deleted_at IS NULL AND cin IS NOT NULL;

CREATE UNIQUE INDEX uq_crm_companies_tenant_ice_active
  ON crm_companies (tenant_id, ice)
  WHERE deleted_at IS NULL AND ice IS NOT NULL;
```

**Restore soft-deleted :**

```sql
UPDATE crm_contacts SET deleted_at = NULL, updated_at = now(), updated_by = $1
WHERE id = $2 AND tenant_id = $3 AND deleted_at IS NOT NULL;
```

**Hard delete admin only :** Apres expiration de la periode de retention legale (5 ans Loi 09-08), un job batch `purge_expired_soft_deleted` execute par un super_admin peut supprimer physiquement les lignes obsoletes :

```sql
DELETE FROM crm_contacts
WHERE deleted_at IS NOT NULL
  AND deleted_at < now() - interval '5 years';
```

Cette purge passe par un workflow administratif documente Sprint 28 (compliance), avec journalisation dans `audit_log_immutable` pour tracabilite.

## Annexe G : Tests integration CRM exhaustifs

Le sprint 2 exige une couverture de tests >= 80% sur le code de migration et les helpers. Cette annexe liste les fichiers de tests Vitest/Jest crees specifiquement pour la tache 1.2.3, totalisant 33 tests.

**Fichier 1 : `apps/api/src/database/migrations/__tests__/migrations-crm.spec.ts` (10 tests)**

```typescript
import { DataSource } from 'typeorm';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('Migration 1735000000002-CRM', () => {
  let ds: DataSource;
  beforeAll(async () => { ds = await createTestDataSource(); await ds.runMigrations(); });
  afterAll(async () => { await ds.destroy(); });

  it('1. crm_companies table exists with correct columns', async () => { /* ... */ });
  it('2. crm_contacts.full_name is GENERATED ALWAYS STORED', async () => { /* ... */ });
  it('3. crm_deals.amount_dirham is NUMERIC(18,2)', async () => { /* ... */ });
  it('4. crm_interactions has no UPDATE trigger (append-only)', async () => { /* ... */ });
  it('5. ENUMs created : crm_company_type_enum, crm_deal_stage_enum, etc.', async () => { /* ... */ });
  it('6. FK crm_contacts.company_id RESTRICT not CASCADE', async () => { /* ... */ });
  it('7. CHECK constraint chk_company_ice_format rejects 14 digits', async () => { /* ... */ });
  it('8. CHECK constraint chk_contact_cin_format accepts BK123456 and AB1234567', async () => { /* ... */ });
  it('9. CHECK constraint chk_company_phone_e164 accepts +212612345678 only', async () => { /* ... */ });
  it('10. Migration is idempotent (run twice without error)', async () => { /* ... */ });
});
```

**Fichier 2 : `apps/api/src/database/__tests__/rls-crm.spec.ts` (10 tests)**

```typescript
describe('RLS multi-tenant CRM', () => {
  it('1. set_config(tenant_id) limits SELECT to current tenant', async () => { /* ... */ });
  it('2. INSERT with mismatched tenant_id is blocked by WITH CHECK', async () => { /* ... */ });
  it('3. UPDATE cannot change tenant_id (RLS USING + WITH CHECK)', async () => { /* ... */ });
  it('4. DELETE blocked across tenants', async () => { /* ... */ });
  it('5. RLS FORCE active even for table owner', async () => { /* ... */ });
  it('6. Policies x16 attached (4 tables x 4 commands)', async () => { /* ... */ });
  it('7. Cross-tenant SELECT returns 0 rows even if data exists', async () => { /* ... */ });
  it('8. Bypass via SET ROLE postgres still blocked by FORCE', async () => { /* ... */ });
  it('9. Cross-tenant FK INSERT (contact pointing to other tenant company) rejected', async () => { /* ... */ });
  it('10. Tenant context reset between connection pool acquires', async () => { /* ... */ });
});
```

**Fichier 3 : `apps/api/src/database/__tests__/trigram-performance.spec.ts` (5 tests)**

```typescript
describe('GIN trigram performance', () => {
  it('1. EXPLAIN shows Bitmap Index Scan on idx_crm_contacts_full_name_trgm', async () => { /* ... */ });
  it('2. Search ILIKE %moh% under 100ms with 10k contacts seeded', async () => { /* ... */ });
  it('3. similarity() returns score > 0.3 for typo Mohamed/Mohammed', async () => { /* ... */ });
  it('4. word_similarity matches Rachid in Errachidi', async () => { /* ... */ });
  it('5. Index recreates after VACUUM FULL without data loss', async () => { /* ... */ });
});
```

**Fichier 4 : `apps/api/src/database/__tests__/constraints-crm.spec.ts` (8 tests)**

```typescript
describe('Constraints CRM', () => {
  it('1. UNIQUE (tenant_id, ice) WHERE deleted_at IS NULL prevents duplicates', async () => { /* ... */ });
  it('2. UNIQUE (tenant_id, cin) WHERE deleted_at IS NULL accepts soft-deleted reuse', async () => { /* ... */ });
  it('3. FK RESTRICT prevents company DELETE if contacts attached', async () => { /* ... */ });
  it('4. full_name auto-updates when first_name updated', async () => { /* ... */ });
  it('5. CHECK probability BETWEEN 0 AND 100 rejects 150', async () => { /* ... */ });
  it('6. CHECK chk_deal_closed_consistency requires closed_at when stage=won', async () => { /* ... */ });
  it('7. CHECK chk_interaction_link_present rejects all-null company/contact/deal', async () => { /* ... */ });
  it('8. CITEXT email comparison case-insensitive (Test@x.com == test@x.com)', async () => { /* ... */ });
});
```

## Annexe H : Patterns recherche full-text avancee

**Pattern 1 : Combinaison ILIKE + similarity (best of both) :**

```sql
SELECT id, full_name, similarity(full_name, $1) AS score
FROM crm_contacts
WHERE tenant_id = $2
  AND deleted_at IS NULL
  AND (full_name ILIKE '%' || $1 || '%' OR full_name % $1)
ORDER BY score DESC, full_name ASC
LIMIT 50;
```

**Pattern 2 : Multi-column search (concat virtuel) :**

```sql
SELECT id, full_name, email, phone,
       similarity(
         COALESCE(first_name,'') || ' ' || COALESCE(last_name,'') || ' ' || COALESCE(email,''),
         $1
       ) AS combined_score
FROM crm_contacts
WHERE tenant_id = $2
  AND deleted_at IS NULL
  AND (
    full_name ILIKE '%' || $1 || '%'
    OR email ILIKE '%' || $1 || '%'
    OR phone ILIKE '%' || $1 || '%'
  )
ORDER BY combined_score DESC LIMIT 50;
```

**Pattern 3 : Pagination cursor-based pour large result sets :**

```sql
SELECT id, full_name, similarity(full_name, $1) AS score
FROM crm_contacts
WHERE tenant_id = $2 AND deleted_at IS NULL
  AND full_name % $1
  AND (similarity(full_name, $1), id) < ($3, $4)
ORDER BY similarity(full_name, $1) DESC, id DESC
LIMIT 20;
```

**Pattern 4 : Highlighting matches via ts_headline (preview Sprint 8) :**

```sql
SELECT id, ts_headline('french', full_name, plainto_tsquery('french', $1),
       'StartSel=<mark>, StopSel=</mark>, MaxWords=10, MinWords=3') AS highlighted
FROM crm_contacts
WHERE tenant_id = $2 AND deleted_at IS NULL AND full_name ILIKE '%' || $1 || '%';
```

**Pattern 5 : Ranking par pertinence multi-critere (BM25-like) :**

```sql
WITH scored AS (
  SELECT id, full_name,
    (
      similarity(full_name, $1) * 1.0
      + similarity(COALESCE(email,''), $1) * 0.5
      + (CASE WHEN owner_user_id = $3 THEN 0.2 ELSE 0 END)
      + (CASE WHEN updated_at > now() - interval '30 days' THEN 0.1 ELSE 0 END)
    ) AS rank_score
  FROM crm_contacts
  WHERE tenant_id = $2 AND deleted_at IS NULL
    AND (full_name % $1 OR email % $1)
)
SELECT * FROM scored WHERE rank_score > 0.3 ORDER BY rank_score DESC LIMIT 50;
```

## Annexe I : Conformite Maroc detaillee CRM

**Loi 09-08 CNDP (2009) -- Articles 9-12 :**

- **Article 9 (consentement) :** le traitement de donnees personnelles necessite le consentement libre, specifique et informe de la personne. Skalean materialise via `crm_contacts.consent_marketing BOOLEAN` et `consent_data_at TIMESTAMPTZ` capture lors du premier contact opt-in (formulaire web Sprint 17, signature contrat Sprint 14).
- **Article 10 (information) :** la personne doit etre informee de l'identite du responsable, des finalites, des destinataires, du droit d'acces et de rectification. Skalean affiche cette mention sur tous les formulaires (footer "Vos donnees sont traitees par {tenantName} conformement a la Loi 09-08...").
- **Article 11 (droit d'acces et rectification) :** la personne peut demander la consultation et la modification de ses donnees. Skalean expose un endpoint REST `GET /api/v1/crm/contacts/me` (Sprint 17 customer portal) et `PATCH /api/v1/crm/contacts/me`.
- **Article 12 (droit a l'oubli) :** la personne peut demander la suppression. Skalean execute un soft-delete immediat + purge physique apres 5 ans. Pour les retentions legales (contrats actifs, sinistres en cours), Skalean applique un masquage (`first_name = '[REDACTED]'`) plutot qu'une suppression.

**Notification 72h CNDP (preparation Sprint 28 compliance) :** En cas de violation de donnees (data breach), Skalean s'engage a notifier la CNDP dans les 72h via le portail officiel cndp.ma. Le module audit log immuable Sprint 2 task 1.2.6 alimentera la detection automatique d'anomalies (volume anormal de SELECT, exports massifs, changements RLS) declenchant un workflow de notification.

**Mention DGSN (Direction Generale de la Surete Nationale) en cas de hack :** Si l'incident implique des donnees CIN (identites nationales), une notification complementaire DGSN (24h) est requise. Skalean documente ce protocole dans `runbook-incident-response.md` Sprint 28.

**ICE Article 23 CGI :** L'obligation de declaration ICE pour les entites economiques marocaines est encadree par l'Article 23 du Code General des Impots, complete par les decrets d'application 2.11.13 (2014) et 2.16.05 (2016). Skalean valide systematiquement le format 15 chiffres et stocke la donnee chiffree at-rest (Postgres TDE Sprint 1).

**CIN DGSN format prefecture :** Le mapping prefixe -> prefecture peut servir d'enrichissement automatique (suggestion ville par defaut a partir du CIN saisi) pour ameliorer l'UX commerciale. Cette feature est planifiee Sprint 8.

**Cookie & tracking RGPD-MA (preparation Sprint 17 customer portal) :** Le portail client Sprint 17 implementera une banniere cookie conforme Loi 09-08 (categorisation cookies essentiels / analytique / marketing, consentement granulaire, retrait facile). Le CRM Sprint 8 backend tracking (Mixpanel-like) sera desactive par defaut tant que le consentement n'est pas valide.

## Annexe J : Glossaire CRM Skalean

| Terme | Definition Skalean | Stockage |
|-------|--------------------|----------|
| Lead | Prospect entrant brut, non qualifie. Source : formulaire site, salon, recommandation. Probabilite < 20%. | `crm_deals.stage = 'lead'` |
| Prospect | Synonyme commercial de Lead, plus utilise dans le langage commercial Maroc. | (alias UI) |
| Qualified | Lead valide : besoin identifie + budget connu + decideur identifie + horizon < 6 mois. | `crm_deals.stage = 'qualified'` |
| Contact | Personne physique en base CRM, peut etre rattache a une company ou independant. | `crm_contacts` |
| Customer | Contact / company avec au moins un contrat Insure ou devis Repair signe. Calcul derive (pas de colonne dediee). | (vue) |
| Account | Synonyme anglais de Company. Dans le code Skalean on utilise toujours `company`. | `crm_companies` |
| Deal | Opportunite commerciale tangible avec montant et stage. | `crm_deals` |
| Pipeline | Vue tabulaire des deals par stage (kanban). UI Sprint 8. | (vue UI) |
| Owner | Commercial assigne au compte ou deal. Drives RBAC visibility. | `*.owner_user_id` |
| Created_by | Createur initial de l'enregistrement. Immutable. | `*.created_by` |
| Assigned | Owner courant (peut differer de created_by si reaffectation). | `*.owner_user_id` |
| Interaction | Trace d'echange (call, email, meeting, note). Append-only. | `crm_interactions` |
| Touchpoint | Synonyme marketing de Interaction (contexte campagne). | (alias UI) |
| Channel | Canal de communication : whatsapp, email, sms, voice, in_person. | `crm_contact_channel_enum` |
| Stage | Etape pipeline deal : lead -> qualified -> proposal -> negotiation -> won/lost. | `crm_deal_stage_enum` |
| Probability | Pourcentage subjectif de probabilite de conclure (0-100). | `crm_deals.probability` |
| MAD / Dirham | Devise Maroc (ISO 4217 : MAD). Tous les montants Skalean sont stockes en MAD. | `amount_dirham NUMERIC(18,2)` |
| RLS | Row-Level-Security Postgres FORCE multi-tenant isolation. | Postgres feature |
| ICE | Identifiant Commun Entreprise Maroc, 15 chiffres. | `crm_companies.ice` |
| CIN | Carte Identite Nationale Maroc, 1-2 lettres + 6-8 chiffres. | `crm_contacts.cin` |
| CNIE | Carte Nationale Identite Electronique (CIN 2.0 puce). | (preview Sprint 14) |
| RC | Registre du Commerce Maroc, format heterogene par tribunal. | `crm_companies.rc` |
| CNSS | Caisse Nationale de Securite Sociale Maroc. | `crm_companies.cnss` |
| DGI | Direction Generale des Impots Maroc. | (autorite externe) |
| DGSN | Direction Generale de la Surete Nationale Maroc. | (autorite externe) |
| CNDP | Commission Nationale de Controle de Protection des Donnees Personnelles. | (autorite externe) |

## Annexe K : ASCII art workflow CRM lifecycle

```
+-------------------------------------------------------------------------------+
|                    SKALEAN CRM LIFECYCLE WORKFLOW                            |
+-------------------------------------------------------------------------------+

    [Acquisition Source]
          |
          v
   +---------------+         +-----------------+
   | Web Form      |-------->|                 |
   | Salon B2B     |-------->|   crm_contacts  |
   | Recommandation|-------->|   (lead state)  |
   | Cold Call     |-------->|                 |
   +---------------+         +--------+--------+
                                      |
                                      | linked optionally
                                      v
                              +-----------------+
                              |  crm_companies  |
                              |  (B2B context)  |
                              +--------+--------+
                                      |
                                      | source for opportunity
                                      v
                              +-----------------+
                              |   crm_deals     |
                              | stage = 'lead'  |
                              +--------+--------+
                                      |
                  +-------------------+-------------------+
                  | qualification check                   |
                  v                                       |
            +-----------+                            +-----------+
            | qualified |                            |   lost    |
            +-----+-----+                            +-----------+
                  |
                  | proposition envoyee
                  v
            +-----------+
            | proposal  |
            +-----+-----+
                  |
                  v
            +-------------+
            | negotiation |
            +------+------+
                  |
              +---+---+
              |       |
              v       v
          +-----+   +------+
          | won |   | lost |
          +--+--+   +------+
             |
             | trigger
             v
   +--------------------+
   | Insure (Sprint 14) |
   | Repair (Sprint 20) |
   | Claims (Sprint 18) |
   +--------------------+

   ALL ALONG : crm_interactions append-only journal
   - call / email / whatsapp / meeting / note / sms / task
   - timeline view in Sprint 8 frontend
   - source for IA conversational Sprint 22

+-------------------------------------------------------------------------------+
| RLS multi-tenant : tenant_id sur chaque table, FORCE on, 16 policies         |
| Soft delete : deleted_at NULL = active, NOT NULL = archived (5y retention)   |
| Audit : created_by / updated_by FK auth_users RESTRICT                       |
| Search : GIN trigram pg_trgm sur full_name / name / email / phone / title    |
+-------------------------------------------------------------------------------+
```

## Annexe L : FAQ tache 1.2.3

**Q1 : Pourquoi `full_name GENERATED ALWAYS STORED` plutot que VIRTUAL ?**
R : Postgres ne supporte que les GENERATED STORED (la VIRTUAL est une feature MySQL/MariaDB). Le STORED occupe de l'espace disque mais permet l'indexation GIN trigram, qui est l'objectif principal. Sans STORED, on aurait du creer un trigger BEFORE INSERT/UPDATE -- plus complexe et plus lent.

**Q2 : Pourquoi `ON DELETE RESTRICT` partout et jamais CASCADE ?**
R : Decision-architecturale 003. CASCADE peut effacer en silence des donnees liees a un audit en cours. RESTRICT force l'application a supprimer dans le bon ordre (soft-delete contacts avant company), explicite, tracable.

**Q3 : Pourquoi NUMERIC(18,2) pour les montants et pas BIGINT (centimes) ?**
R : Lisibilite SQL (SELECT amount_dirham renvoie 1234.56), compatibilite avec les formules d'aggregation (SUM, AVG), interoperabilite Excel/CSV exports. Le risque de rounding NUMERIC est nul (precision exacte). La penalite performance vs BIGINT est negligeable sur les volumes Skalean.

**Q4 : Pourquoi 7 indexes GIN trigram et pas un index global tsvector ?**
R : Le besoin metier est ILIKE wildcard et fuzzy similarity, pas la recherche linguistique avec stemming. tsvector exigerait `to_tsvector('french' || 'arabic' || ...)` -- mais arabe est partiel dans Postgres et le darija non supporte. pg_trgm est language-agnostic et matche directement les caracteres arabes, latins, mixtes. Skalean ajoutera tsvector Sprint 22 pour la recherche IA semantique sur le content interactions long-form, en complement.

**Q5 : Pourquoi `crm_interactions` append-only sans UPDATE possible ?**
R : Conformite Loi 09-08 (impossible de modifier l'historique de communication, pour l'audit), source de verite pour Sprint 22 IA conversationnelle (les corrections d'historique fausseraient l'apprentissage), simplicite operationnelle (pas de question "qui a modifie quoi"). Les corrections passent par l'ajout d'une nouvelle interaction de type 'note' qui annote la precedente.

**Q6 : Comment gerer une fusion de contacts doublons ?**
R : Workflow dedie Sprint 8. Un commercial detecte le doublon via la recherche fuzzy. L'UI propose "merger" -> selection du record principal -> les FK descendantes (deals, interactions) sont reaffectees au principal -> le secondaire est soft-deleted avec un commentaire `merged_into = <id>`. Le service fait tout cela en transaction.

**Q7 : Que se passe-t-il si une company a 100k contacts (pagination) ?**
R : L'API REST Sprint 4 supporte pagination cursor-based (`?limit=50&cursor=...`). Le frontend Sprint 8 utilise virtual scroll Angular CDK. Aucune query backend ne materialise > 1000 rows en memoire, par convention. EXPLAIN ANALYZE est verifie en CI sur les requetes critiques.

**Q8 : Comment faire un export complet pour un tenant (data portability) ?**
R : Endpoint admin `POST /api/v1/admin/tenants/:id/export` (Sprint 28) genere un fichier ZIP avec les 4 tables CRM en NDJSON (1 ligne JSON par enregistrement). Cette feature satisfait l'Article 11 Loi 09-08 (droit d'acces) et le RGPD-equivalent pour clients europeens.

**Q9 : Comment tester en local sans toucher a prod ?**
R : Docker compose `docker-compose.dev.yml` boot un Postgres 16 + extensions activees. Les migrations TypeORM s'appliquent via `pnpm run db:migrate`. Un seeder Sprint 2 (`db:seed`) charge 10k contacts/100 companies fictifs (Faker.js avec locale fr_MA et arabe darija) pour stress-test trigram localement.

**Q10 : Que se passe-t-il en cas de rollback migration ?**
R : Chaque migration TypeORM expose un `down()` qui drop les tables dans l'ordre inverse. Le test `migrations-crm.spec.ts` valide que `runMigrations -> revertLastMigration -> runMigrations` est idempotent. En production, les rollbacks sont rares et passent par une procedure documentee `runbook-rollback.md` Sprint 1.

## Annexe M : Notes de revue technique

Cette annexe documente les questions soulevees lors de la revue technique de la specification 1.2.3, ainsi que les decisions arretees par le tech lead et le DPO Skalean. Chaque point est consigne pour tracabilite.

**Point M.1 : Choix CITEXT vs TEXT + LOWER() index pour emails.**
La revue a explore la possibilite d'utiliser `TEXT` avec un index fonctionnel `CREATE INDEX ON crm_contacts (LOWER(email))` au lieu de `CITEXT`. Le tech lead a tranche pour CITEXT car (a) il est natif Postgres extension citext (pre-installee), (b) la comparaison case-insensitive est transparente sans avoir a modifier les requetes applicatives, (c) le cout performance est negligeable face a la simplicite du code applicatif. CITEXT impose juste de bien activer l'extension Sprint 1.

**Point M.2 : Pourquoi pas de colonne `last_contacted_at` calculee sur crm_contacts ?**
La proposition initiale incluait une colonne denormalisee `last_contacted_at TIMESTAMPTZ` mise a jour via trigger sur INSERT crm_interactions. Rejet : (a) duplication d'information (peut etre calculee via SELECT MAX(occurred_at) FROM crm_interactions WHERE contact_id = ...), (b) risque de drift en cas de bug trigger, (c) perf acceptable avec un index BTREE sur (contact_id, occurred_at DESC). La query est rapide et la denormalisation n'apporte rien de critique. Si un jour on a besoin (dashboard temps-reel), on ajoutera une vue materialisee Sprint 8.

**Point M.3 : Validation telephones internationaux pour expat ?**
La revue a souleve le cas des contacts expatries avec telephones non-MA (+33, +1, +971, etc.). Decision : la contrainte CHECK actuelle est `^\+212[567]\d{8}$` pour MA seulement. Pour les expats, on contourne via le champ `phone_secondary` qui n'est pas contraint a MA (CHECK relaxee `^\+\d{7,15}$`). Pour Sprint 17 customer portal international, on introduira un type colonne plus generique avec validation libphonenumber-js full.

**Point M.4 : ICE format strict 15 chiffres mais entreprises etrangeres ?**
Decision : ICE est NULL-able. Pour les entreprises non-marocaines (cas rare mais existant : reassureurs internationaux, partenaires regionaux MENA), on laisse `ice = NULL`. La contrainte CHECK ne s'applique que si ice IS NOT NULL. Le RC reste obligatoire dans tous les cas pour l'enregistrement local.

**Point M.5 : Bilingue arabe/francais pour les noms ?**
Question levee : un contact peut avoir son nom en arabe (محمد) ET en francais (Mohamed). Faut-il deux colonnes ? Decision : NON pour le sprint 2 (KISS). On stocke ce que le commercial saisit (souvent francais). Sprint 8 frontend offrira une option "tag transliteration" pour stocker dans `metadata` JSON les variantes alternatives. Une recherche bilingue avancee est planifiee Sprint 22 IA.

**Point M.6 : Retention legale 5 ans Loi 09-08 vs comptable 10 ans ?**
La retention CNDP est 5 ans pour donnees personnelles, mais la retention comptable Maroc est 10 ans pour pieces justificatives. Conflit ? Resolution : les 4 tables CRM relevent de la donnee personnelle (5 ans). Les contrats Insure / sinistres Claims relevent du comptable (10 ans). Apres 5 ans, sur les CRM, on applique un "masquage" (REDACTED) au lieu d'une suppression totale, pour preserver les liens FK avec les contrats Insure encore actifs.

**Point M.7 : Indexes BTREE complementaires necessaires ?**
La revue a valide la liste suivante d'indexes BTREE en plus des GIN trigram :
```sql
CREATE INDEX idx_crm_companies_tenant_active ON crm_companies (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_companies_owner ON crm_companies (owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_contacts_tenant_active ON crm_contacts (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_contacts_company ON crm_contacts (company_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_contacts_owner ON crm_contacts (owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_deals_tenant_stage ON crm_deals (tenant_id, stage) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_deals_owner ON crm_deals (owner_user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_crm_deals_close ON crm_deals (expected_close_at) WHERE deleted_at IS NULL AND stage NOT IN ('won','lost');
CREATE INDEX idx_crm_interactions_contact ON crm_interactions (contact_id, occurred_at DESC);
CREATE INDEX idx_crm_interactions_company ON crm_interactions (company_id, occurred_at DESC);
CREATE INDEX idx_crm_interactions_deal ON crm_interactions (deal_id, occurred_at DESC);
```

**Point M.8 : Audit trail au-dela de created_by/updated_by ?**
Decision : la tache 1.2.3 ne cree QUE les colonnes audit (created_by/updated_by/created_at/updated_at). La tache 1.2.6 Sprint 2 cree la table `audit_log_immutable` qui contient les diffs ligne par ligne (avant/apres) pour chaque modification CRM. Pas de doublonnage : 1.2.3 = colonnes statiques, 1.2.6 = trail dynamique.

**Point M.9 : Performance sous charge concurrent (locks) ?**
Risque : un commercial qui edite simultanement un contact pourrait avoir un lock conflit. Decision : on utilise les niveaux d'isolation Postgres par defaut (READ COMMITTED) avec optimistic locking via `updated_at` cote application (TypeORM `@VersionColumn` ou check `WHERE updated_at = :previousValue`). Pas de pessimistic locking SELECT FOR UPDATE sauf cas exceptionnels documentes.

**Point M.10 : Backup strategy specifique CRM ?**
Decision : le CRM suit la strategie globale Skalean (backup pg_dump quotidien sur S3 + WAL archiving continu pour PITR Point-In-Time-Recovery <= 5 minutes). Pour le CRM specifiquement, un dump logical hebdomadaire dedie est aussi conserve 90 jours (audit CNDP, demandes export tenant). Documente Sprint 28.

## Annexe N : Synthese checklist deliverables 1.2.3

Cette annexe finale resume les deliverables attendus a la cloture de la tache 1.2.3 sous forme de checklist binaire utilisable en revue.

- [ ] Fichier `apps/api/src/database/migrations/1735000000002-CRM.ts` cree
- [ ] up() cree 8 enums + 4 tables + 16 RLS policies + indexes BTREE + indexes GIN trigram
- [ ] down() drop dans l'ordre inverse, idempotent, teste deux fois
- [ ] Entites TypeORM `CrmCompany`, `CrmContact`, `CrmDeal`, `CrmInteraction` creees avec decorateurs complets
- [ ] DTOs Zod `IceMaSchema`, `CinMaSchema`, `MaPhoneSchema` exportes depuis `@skalean/shared-validators`
- [ ] Tests `migrations-crm.spec.ts` (10 tests) passent
- [ ] Tests `rls-crm.spec.ts` (10 tests) passent
- [ ] Tests `trigram-performance.spec.ts` (5 tests) passent
- [ ] Tests `constraints-crm.spec.ts` (8 tests) passent
- [ ] Couverture code >= 80% sur les helpers de validation
- [ ] EXPLAIN ANALYZE valide sur les 5 queries patterns critiques
- [ ] Documentation `_SUMMARY.md` Sprint 2 mise a jour avec ligne 1.2.3
- [ ] PR review approuvee par tech lead + DPO Skalean
- [ ] Merge dans branche `develop` apres CI verte
- [ ] Tag git `sprint-02-task-1.2.3-completed` pose

Fin du prompt task 1.2.3.
