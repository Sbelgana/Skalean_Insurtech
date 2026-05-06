# META-PROMPT B-02 -- SPRINT 2 DATABASE TYPEORM + KAFKA TOPICS + MIGRATIONS

**Version** : v2.2 (Option B)
**Phase** : 1 -- Bootstrap
**Sprint** : 2 / 35 (cumul)
**Position** : Phase 1 Sprint 2 -- juste apres Bootstrap Infrastructure
**Numerotation taches** : 1.2.1 a 1.2.15
**Effort total** : ~80 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous les sprints metier suivants)

---

## Objectif Global du Sprint

Etablir le **modele de donnees complet** des 32 tables de PARTIE1 (systeme + 6 modules horizontaux) avec migrations TypeORM, RLS multi-tenant 3 niveaux applique partout, et le **systeme d'evenements Kafka** complet (publisher + consumer base + schemas Zod).

A la sortie de ce sprint :
- 32 tables creees via 7 migrations TypeORM ordonnees
- RLS policies actives sur toutes les tables avec `tenant_id`
- Indexes performants (BTREE + GIN trigram + EXCLUDE constraint Booking)
- 3 subscribers TypeORM transverses (auto-injection tenant_id, audit log, timestamps)
- Topics Kafka enrichis (50+ topics avec schemas Zod associes)
- Package `@insurtech/shared-events` operationnel (Topics enum + Zod schemas + types TypeScript)
- KafkaPublisher service NestJS reutilisable (idempotent + retry + circuit breaker)
- KafkaConsumerBase abstract class (manual ack + retry exponential + DLQ)
- Seeds dev exhaustifs : 5 assureurs MA + 1 cabinet courtier + 1 garage + 50 contacts + 20 polices fictives
- Tests integration end-to-end : migrations reversibles + RLS bloque cross-tenant + Kafka pub/sub fonctionnel

---

## Frontiere du Sprint

**INCLUS** :
- 7 migrations TypeORM des 32 tables PARTIE1 (system + horizontaux)
- RLS policies sur toutes les tables avec `tenant_id`
- 3 subscribers TypeORM (TenantIdInjector, AuditLogWriter, TimestampsInjector)
- Topics Kafka enrichis : 50+ topics
- Package `shared-events` (Topics enum + Zod schemas + helpers)
- KafkaPublisher + KafkaConsumerBase services
- Seeds dev exhaustifs
- Tests integration migrations + RLS + Kafka

**EXCLU** (sera ajoute aux sprints suivants) :
- Tables PARTIE2 (verticaux Insure + Repair) -- Sprints 14, 15, 16, 20
- Tables PARTIE3 (admin platform + extensions v2.0) -- Sprints 27, 28, 29
- Services NestJS metier consommant ces tables -- Sprints 5+
- Indexes optimisations advanced (PARTIAL, BRIN) -- ajustements Sprint 34 Performance
- Backups / restore strategy -- Sprint 35

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` -- 32 tables avec colonnes, indexes, contraintes
2. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles transverses (multi-tenant, audit, retention)
3. `00-pilotage/documentation/4-templates-generation.md` -- patterns RLS + audit log + soft delete
4. `00-pilotage/documentation/7-glossaire-exemples.md` -- vocabulaire tables (police, sinistre, etc.)
5. Sortie Sprint 1 : `repo/packages/database/` (DataSource), `repo/packages/shared-config/` (env), Postgres avec helpers RLS

---

## Stack Imposee (Sprint 2)

| Composant | Version | Notes |
|-----------|---------|-------|
| TypeORM | 0.3.20 | DataSource + entities + migrations + subscribers |
| pg | 8.13.1 | driver Postgres |
| reflect-metadata | 0.2.2 | requis decorators TypeORM |
| KafkaJS | 2.2.4 | client Kafka Node |
| Zod | 3.24.1 | schemas events |
| ulid | 2.3.0 | event_id stable (alternative UUID) |
| date-fns | 4.1.0 | manipulation dates seeds |
| @faker-js/faker | 9.2.0 | seeds dev realistes (locale fr_MA) |

---

## Vue d'Ensemble des 15 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 1.2.1 | Enrichir `@insurtech/database` -- entities + migrations infrastructure + scripts CLI | 6h | P0 | Sprint 1 |
| 1.2.2 | Migration "Initial System" -- 5 tables (auth + audit_log) + RLS | 8h | P0 | 1.2.1 |
| 1.2.3 | Migration "CRM" -- 4 tables + RLS + indexes trigram | 6h | P0 | 1.2.2 |
| 1.2.4 | Migration "Booking" -- 3 tables + EXCLUDE constraint anti-overlap | 5h | P0 | 1.2.3 |
| 1.2.5 | Migration "Communications" -- 4 tables (messages, templates, opt-outs, webhooks) | 5h | P0 | 1.2.4 |
| 1.2.6 | Migration "Docs + Pay" -- 6 tables (documents + versions + access logs + transactions) | 6h | P0 | 1.2.5 |
| 1.2.7 | Migration "Books + Compliance" -- 6 tables (factures + comptes + audits ACAPS) | 6h | P0 | 1.2.6 |
| 1.2.8 | Migration "Analytics + Stock + HR" -- 5 tables | 5h | P0 | 1.2.7 |
| 1.2.9 | TypeORM Subscribers -- 3 transverses (TenantIdInjector + AuditLogWriter + TimestampsInjector) | 5h | P0 | 1.2.8 |
| 1.2.10 | Topics Kafka enrichi -- 50+ topics avec configuration retention differenciee | 4h | P0 | 1.2.9 |
| 1.2.11 | Init `@insurtech/shared-events` -- Topics enum + Zod schemas + types | 6h | P0 | 1.2.10 |
| 1.2.12 | KafkaPublisher service -- NestJS provider idempotent + retry + circuit breaker | 5h | P0 | 1.2.11 |
| 1.2.13 | KafkaConsumerBase abstract class -- manual ack + retry exponential + DLQ | 6h | P0 | 1.2.12 |
| 1.2.14 | Seeds dev exhaustifs -- 5 assureurs MA + 1 cabinet + 1 garage + 50 contacts + 20 polices | 4h | P0 | 1.2.13 |
| 1.2.15 | Tests integration -- migrations reversibles + RLS bloque cross-tenant + Kafka E2E | 5h | P0 | 1.2.14 |

**Total** : 82 heures.

---

# DETAIL DES 15 TACHES

---

## Tache 1.2.1 -- Enrichir @insurtech/database

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 6h / Depend de Sprint 1

**But** : Etendre le package `database` avec structure d'entities, infrastructure migrations, scripts CLI, et helpers transactionnels pour multi-tenant.

**Contexte** : Sprint 1 a livre le `DataSource` brut. Sprint 2 ajoute le squelette pour entities (organisation par module), pattern abstrait `BaseEntity` avec champs communs (id, tenant_id, created_at, updated_at, deleted_at), helpers `withTenantContext()` pour transactions multi-tenant.

**Livrables checkables** :
- [ ] `repo/packages/database/src/entities/` structure par module : `system/`, `crm/`, `booking/`, `comm/`, `docs/`, `pay/`, `books/`, `compliance/`, `analytics/`
- [ ] `repo/packages/database/src/entities/base/base-entity.ts` -- abstract class avec id (UUID gen_random_uuid), tenant_id (uuid), created_at, updated_at, deleted_at (soft delete)
- [ ] `repo/packages/database/src/entities/base/auditable-entity.ts` -- extends BaseEntity + created_by, updated_by (uuid users)
- [ ] `repo/packages/database/src/migrations/` dossier structure
- [ ] `repo/packages/database/src/subscribers/` dossier (peuple Tache 1.2.9)
- [ ] `repo/packages/database/src/helpers/with-tenant-context.ts` -- wrapper executant query avec `SET LOCAL app.current_tenant_id`
- [ ] `repo/packages/database/src/helpers/with-super-admin.ts` -- bypass RLS pour endpoints `/api/v1/admin/*`
- [ ] Scripts CLI dans package.json : `migration:create`, `migration:generate`, `migration:run`, `migration:revert`, `migration:show`, `seeds:run`, `seeds:reset`
- [ ] Configuration `migrations: ['dist/migrations/*.js']` (compile avant run en dev pour eviter ts-node overhead)
- [ ] DataSource exporte aussi en `repo/packages/database/src/cli-data-source.ts` pour CLI typeorm

**Pattern critique : helper withTenantContext**

```typescript
// repo/packages/database/src/helpers/with-tenant-context.ts
export async function withTenantContext<T>(
  manager: EntityManager,
  tenantId: string,
  fn: (em: EntityManager) => Promise<T>,
  options?: { isSuperAdmin?: boolean; userId?: string; assureUserId?: string }
): Promise<T> {
  return manager.transaction(async (em) => {
    await em.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    if (options?.isSuperAdmin) await em.query(`SET LOCAL app.is_super_admin = 'true'`);
    if (options?.userId) await em.query(`SET LOCAL app.current_user_id = '${options.userId}'`);
    if (options?.assureUserId) await em.query(`SET LOCAL app.assure_user_id = '${options.assureUserId}'`);
    return fn(em);
  });
}
```

Tous les services NestJS metier (Sprint 5+) utilisent ce helper systematiquement.

**Fichiers crees / modifies** :
```
repo/packages/database/package.json                              # enrichi (KafkaJS deps Tache 1.2.12)
repo/packages/database/src/entities/base/base-entity.ts          # ~30 lignes
repo/packages/database/src/entities/base/auditable-entity.ts     # ~15 lignes
repo/packages/database/src/entities/base/index.ts
repo/packages/database/src/entities/{9 dossiers modules}/        # vides, peuples par migrations
repo/packages/database/src/migrations/                           # vide, peuple Taches 1.2.2-1.2.8
repo/packages/database/src/subscribers/                          # vide, peuple Tache 1.2.9
repo/packages/database/src/helpers/with-tenant-context.ts        # ~25 lignes
repo/packages/database/src/helpers/with-super-admin.ts           # ~15 lignes
repo/packages/database/src/helpers/index.ts
repo/packages/database/src/cli-data-source.ts                    # alias DataSource pour CLI
repo/packages/database/src/index.ts                              # enrichi reexports
```

**Notes implementation** :
- BaseEntity utilise `@PrimaryGeneratedColumn('uuid')` avec `default: () => 'gen_random_uuid()'` (utilise pgcrypto Sprint 1)
- Soft delete : colonne `deleted_at` nullable + `@DeleteDateColumn()` TypeORM
- AuditableEntity ajoute `created_by` + `updated_by` (FK vers auth_users) -- peuples par AuditLogWriter subscriber Tache 1.2.9
- `withTenantContext` utilise `SET LOCAL` (pas `SET`) pour scope = transaction (auto-revert au commit/rollback)
- ATTENTION SQL injection : tenant_id doit etre valide UUID v4 -- valide en amont par Zod (Sprint 6 implementera)
- Migrations compilees JS plutot que TS pour vitesse en CI (saute ts-node)

**Criteres validation** :
- V1 (P0) : Structure dossiers entities/migrations/subscribers/helpers presente
- V2 (P0) : `BaseEntity` abstract avec id, tenant_id, timestamps, soft delete
- V3 (P0) : `AuditableEntity` extends BaseEntity + created_by + updated_by
- V4 (P0) : `withTenantContext()` execute SET LOCAL et fn dans meme transaction
- V5 (P0) : Scripts CLI `migration:create/generate/run/revert/show` fonctionnent (vide initialement)
- V6 (P0) : Re-export propre dans `index.ts` (peut importer `BaseEntity`, `withTenantContext`, etc.)
- V7 (P0) : `pnpm --filter @insurtech/database build` reussit
- V8 (P1) : Tests unitaires `withTenantContext` (mock EntityManager) couvrent happy path + super admin

---

## Tache 1.2.2 -- Migration "Initial System" : 5 Tables (Auth + Audit Log) + RLS

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 8h / Depend de 1.2.1

**But** : Creer 5 tables fondatrices (auth_tenants, auth_users, auth_tenant_users, auth_sessions, audit_log) avec RLS policies multi-tenant 3 niveaux activees.

**Contexte** : Tables auth sont accedees par tous les modules (foreign keys + audit). RLS active des cette migration -- le `app_can_access_tenant()` defini Sprint 1 est utilise dans les policies.

**Livrables checkables** :
- [ ] Migration `1735000000001-InitialSystem.ts` (timestamp + nom)
- [ ] Table `auth_tenants` : id (uuid PK), name (text NOT NULL), type (enum 'broker' | 'garage' | 'mixed'), settings (jsonb), created_at, updated_at, deleted_at
- [ ] Table `auth_users` : id (uuid PK), tenant_id (uuid FK auth_tenants -- NULL si SuperAdmin platform), email (citext UNIQUE), password_hash (text), display_name, mfa_enabled (bool), mfa_secret_encrypted (text), email_verified_at, last_login_at, locked_until, failed_login_attempts (int), created_at, updated_at, deleted_at
- [ ] Table `auth_tenant_users` (jonction many-to-many users x tenants car SuperAdmin peut acceder plusieurs) : tenant_id, user_id, role (text), permissions (jsonb), created_at
- [ ] Table `auth_sessions` : id (uuid PK), user_id (FK), tenant_id (FK), refresh_token_hash (text UNIQUE), user_agent (text), ip_address (inet), created_at, expires_at, revoked_at
- [ ] Table `audit_log` : id (uuid PK), tenant_id, user_id (NULL si systeme), action (text), resource_type (text), resource_id (uuid), changes (jsonb -- before/after), ip_address (inet), user_agent (text), created_at -- **append-only, retention 7 ans**
- [ ] RLS active sur 4 tables (auth_users, auth_tenant_users, auth_sessions, audit_log) -- pas auth_tenants car table catalog visible cross-tenant pour SuperAdmin
- [ ] Policy SELECT/INSERT/UPDATE/DELETE utilisant `app_can_access_tenant(tenant_id)`
- [ ] Indexes : email UNIQUE + lower(email) sur auth_users, tenant_id sur auth_tenant_users, refresh_token_hash UNIQUE sur sessions, (tenant_id, created_at DESC) sur audit_log
- [ ] Migration `up()` cree tables + RLS + indexes, `down()` drop tables (reversible)
- [ ] Test : migration run + revert + run reussit sans erreur

**Pattern critique : RLS policy template SQL**

Pour chaque table avec `tenant_id`, applique 4 policies (SELECT, INSERT, UPDATE, DELETE) :

```sql
-- Active RLS
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_users FORCE ROW LEVEL SECURITY;  -- s'applique meme au owner

-- Policy SELECT : visible si super admin OU same tenant OU cross-tenant auth active
CREATE POLICY auth_users_select ON auth_users FOR SELECT
  USING (app_can_access_tenant(tenant_id));

-- Policy INSERT : impose tenant_id = app_current_tenant() OU super admin
CREATE POLICY auth_users_insert ON auth_users FOR INSERT
  WITH CHECK (
    app_is_super_admin() OR
    tenant_id = app_current_tenant()
  );

-- Policy UPDATE
CREATE POLICY auth_users_update ON auth_users FOR UPDATE
  USING (app_can_access_tenant(tenant_id))
  WITH CHECK (app_can_access_tenant(tenant_id));

-- Policy DELETE (soft delete via UPDATE deleted_at en pratique, mais policy au cas ou)
CREATE POLICY auth_users_delete ON auth_users FOR DELETE
  USING (app_is_super_admin());  -- seul super admin peut hard delete
```

`FORCE ROW LEVEL SECURITY` garantit que meme le user owner de la table (postgres dev, role app prod) doit passer les policies.

**Pattern : audit_log retention**

Table append-only :
- AUCUNE UPDATE policy
- AUCUNE DELETE policy (sauf job cron Sprint 33 supprimant rows > 7 ans)
- `INSERT` simple (auto-injection tenant_id par AuditLogWriter Sprint 5+)

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/1735000000001-InitialSystem.ts   # ~250 lignes (5 tables + RLS + indexes)
repo/packages/database/src/entities/system/auth-tenant.entity.ts        # ~40 lignes
repo/packages/database/src/entities/system/auth-user.entity.ts          # ~50 lignes
repo/packages/database/src/entities/system/auth-tenant-user.entity.ts   # ~30 lignes
repo/packages/database/src/entities/system/auth-session.entity.ts       # ~35 lignes
repo/packages/database/src/entities/system/audit-log.entity.ts          # ~35 lignes
repo/packages/database/src/entities/system/index.ts                     # reexports
```

**Notes implementation** :
- `email citext UNIQUE` -- type case-insensitive (extension Sprint 1) evite conflits Joe@example.com vs joe@example.com
- `password_hash text` -- argon2id genere strings ~95 chars (cf. Sprint 5 pour params)
- `mfa_secret_encrypted text` -- secret TOTP chiffre avec MFA_SECRET_ENCRYPTION_KEY (Sprint 5)
- `auth_tenants.settings jsonb` -- preferences customizables (timezone, locale defaut, branding)
- `audit_log.changes jsonb` schema stable : `{ before: {...}, after: {...}, fields_changed: ['email', 'phone'] }`
- Index audit_log `(tenant_id, created_at DESC)` -- queries `SELECT * WHERE tenant_id = X ORDER BY created_at DESC LIMIT 50` typiques
- Pas de FK cross-tables avec `ON DELETE CASCADE` -- soft delete force conservation pour audit
- TypeORM Entity utilise `@Entity('auth_users')` -- nom table en snake_case explicite

**Criteres validation** :
- V1 (P0) : `pnpm migration:run` reussit sans erreur
- V2 (P0) : 5 tables creees : `\dt auth_*` + `\dt audit_log`
- V3 (P0) : RLS active sur 4 tables : `SELECT relname FROM pg_class WHERE relrowsecurity = true`
- V4 (P0) : 4 policies par table : `\d auth_users` montre policies SELECT/INSERT/UPDATE/DELETE
- V5 (P0) : `FORCE ROW LEVEL SECURITY` actif : `relforcerowsecurity = true`
- V6 (P0) : Indexes presents : `\d auth_users` montre email UNIQUE + lower(email)
- V7 (P0) : `pnpm migration:revert` reussit (drop tables proprement)
- V8 (P0) : Re-run migration apres revert reussit
- V9 (P0) : Test cross-tenant : INSERT auth_user avec tenant A puis SELECT avec tenant B retourne 0 rows
- V10 (P1) : `audit_log.changes` accepte JSONB valide

---

## Tache 1.2.3 -- Migration "CRM" : 4 Tables + RLS + Indexes Trigram

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 6h / Depend de 1.2.2

**But** : Creer les 4 tables CRM (companies, contacts, deals, interactions) avec RLS et indexes trigram pour full-text search.

**Livrables checkables** :
- [ ] Migration `1735000000002-CRM.ts`
- [ ] Table `crm_companies` : id, tenant_id (FK), name, industry, ice (text -- Identifiant Commun de l'Entreprise MA, format 15 chiffres), rc (text -- Registre Commerce), patente, address, city, country, phone, email, website, owner_user_id (FK), tags (text[]), notes, created_at, updated_at, deleted_at
- [ ] Table `crm_contacts` : id, tenant_id (FK), company_id (FK NULL si independant), first_name, last_name, full_name (computed), email (citext), phone, cin (text -- Carte Identite Nationale, format 6 chiffres + lettre), preferred_language (enum 'fr' | 'ar-MA' | 'ar'), preferred_channel (enum 'whatsapp' | 'email' | 'sms' | 'voice'), tags, created_at, updated_at, deleted_at
- [ ] Table `crm_deals` : id, tenant_id (FK), contact_id (FK), company_id (FK NULL), title, stage (enum 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'), amount_dirham (numeric 15,2), currency (default 'MAD'), expected_close_date, won_at, lost_at, lost_reason, owner_user_id, created_at, updated_at, deleted_at
- [ ] Table `crm_interactions` : id, tenant_id (FK), contact_id (FK), deal_id (FK NULL), type (enum 'call' | 'email' | 'whatsapp' | 'meeting' | 'note'), direction (enum 'inbound' | 'outbound'), subject, content (text), occurred_at, created_by (FK auth_users), created_at -- **append-only**
- [ ] RLS active sur 4 tables (toutes ont tenant_id)
- [ ] Indexes BTREE : (tenant_id, deleted_at IS NULL), email, phone, cin, ice, owner_user_id
- [ ] Indexes GIN trigram : `pg_trgm` sur full_name, name, email pour full-text search
- [ ] Foreign keys avec `ON DELETE RESTRICT` (pas CASCADE -- preservation pour audit)
- [ ] Constraint UNIQUE (tenant_id, ice) sur crm_companies (un ICE = un tenant)
- [ ] Constraint UNIQUE (tenant_id, cin) sur crm_contacts (un CIN = un tenant)

**Pattern critique : index GIN trigram pour full-text search**

```sql
-- Recherche `ILIKE '%john%'` ou `pg_trgm.similarity()` accelere par GIN trigram
CREATE INDEX idx_crm_contacts_full_name_trgm ON crm_contacts
  USING GIN (full_name gin_trgm_ops);

CREATE INDEX idx_crm_companies_name_trgm ON crm_companies
  USING GIN (name gin_trgm_ops);
```

Performance : recherche "Mohamed Bennani" parmi 100k contacts retourne en < 50ms (vs > 1s avec scan sequentiel).

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/1735000000002-CRM.ts          # ~200 lignes
repo/packages/database/src/entities/crm/crm-company.entity.ts       # ~50 lignes
repo/packages/database/src/entities/crm/crm-contact.entity.ts       # ~60 lignes
repo/packages/database/src/entities/crm/crm-deal.entity.ts          # ~50 lignes
repo/packages/database/src/entities/crm/crm-interaction.entity.ts   # ~40 lignes
repo/packages/database/src/entities/crm/index.ts
```

**Notes implementation** :
- `ice` (Identifiant Commun de l'Entreprise) : 15 chiffres, format precis MA. Validation regex au niveau service (Sprint 8)
- `cin` (Carte Identite Nationale) : format `[A-Z]{1,2}[0-9]{6,8}` (varie selon prefecture). Validation Zod amont
- `full_name computed` : trigger Postgres ou colonne generee `GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED`
- `preferred_language` enum : utilise pour Comm (Sprint 9) selection template traduit
- Trigram index utilise par operations `ILIKE '%pattern%'` ou `WHERE similarity(name, 'query') > 0.3`
- Soft delete partiel index : `WHERE deleted_at IS NULL` reduit taille index 90% en pratique

**Criteres validation** :
- V1 (P0) : Migration up reussit
- V2 (P0) : 4 tables creees avec colonnes specifiees
- V3 (P0) : RLS active sur les 4 tables
- V4 (P0) : Indexes GIN trigram presents : `\d crm_contacts`
- V5 (P0) : UNIQUE (tenant_id, ice) actif : tentative 2eme INSERT meme ICE same tenant fail
- V6 (P0) : Recherche trigram performante : `EXPLAIN ANALYZE SELECT * WHERE full_name ILIKE '%john%'` utilise GIN
- V7 (P0) : Foreign keys ON DELETE RESTRICT actifs
- V8 (P0) : Migration revert reversible
- V9 (P0) : Test RLS : INSERT contact tenant A, SELECT tenant B retourne 0
- V10 (P1) : Computed column full_name auto-mise a jour quand first/last name change

---

## Tache 1.2.4 -- Migration "Booking" : 3 Tables + EXCLUDE Constraint

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 5h / Depend de 1.2.3

**But** : Creer 3 tables Booking (rooms, appointments, calendar_syncs) avec contrainte EXCLUDE Postgres anti-overlap pour eviter double-booking.

**Contexte** : Le Booking est utilise par Insure (RDV courtage) et Repair (RDV garage). EXCLUDE constraint utilise `btree_gist` (extension Sprint 1) pour valider en SQL natif qu'aucun RDV ne se chevauche pour la meme room.

**Livrables checkables** :
- [ ] Migration `1735000000003-Booking.ts`
- [ ] Table `booking_rooms` : id, tenant_id (FK), name, capacity (int), location (text), color (text -- hex), active (bool default true), created_at, updated_at, deleted_at
- [ ] Table `booking_appointments` : id, tenant_id (FK), room_id (FK), contact_id (FK crm_contacts), assigned_user_id (FK auth_users), title, description, time_range (tstzrange -- type Postgres), status (enum 'scheduled' | 'confirmed' | 'cancelled' | 'no_show' | 'completed'), reminder_sent_at, created_by, created_at, updated_at, cancelled_at, cancel_reason
- [ ] Table `booking_calendar_syncs` : id, tenant_id (FK), user_id (FK), provider (enum 'google' | 'outlook' | 'caldav'), provider_account_id, access_token_encrypted, refresh_token_encrypted, last_sync_at, sync_enabled (bool), created_at
- [ ] **EXCLUDE constraint** sur `booking_appointments` : pas deux RDV meme room avec time_range overlap
- [ ] RLS active sur 3 tables
- [ ] Indexes : (tenant_id, room_id, time_range), (tenant_id, contact_id), (tenant_id, status, time_range)

**Pattern critique : EXCLUDE constraint anti-overlap**

```sql
ALTER TABLE booking_appointments ADD CONSTRAINT no_overlap_per_room
  EXCLUDE USING GIST (
    tenant_id WITH =,
    room_id WITH =,
    time_range WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show'));
```

Operateur `&&` = "ranges overlap". `WITH =` pour egalite. Resultat : INSERT ou UPDATE creant un RDV chevauchant un existant rejete par DB.

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/1735000000003-Booking.ts            # ~150 lignes
repo/packages/database/src/entities/booking/booking-room.entity.ts        # ~30 lignes
repo/packages/database/src/entities/booking/booking-appointment.entity.ts # ~50 lignes
repo/packages/database/src/entities/booking/booking-calendar-sync.entity.ts # ~35 lignes
repo/packages/database/src/entities/booking/index.ts
```

**Notes implementation** :
- `tstzrange` = Time Stamp Zone Range, type Postgres natif. Format : `'[2026-05-15 14:00, 2026-05-15 15:00)'` (inclusive start, exclusive end)
- TypeORM ne supporte pas tstzrange nativement -- utiliser `@Column('tstzrange')` + casts manuels
- Tokens calendar provider chiffres avec MFA_SECRET_ENCRYPTION_KEY ou cle dediee
- `sync_enabled` permet pause sync sans supprimer config OAuth
- WHERE sur EXCLUDE : exclut RDV `cancelled` et `no_show` (peuvent re-overlap, ne sont plus actifs)
- `gist_btree` extension requise (deja Sprint 1)

**Criteres validation** :
- V1 (P0) : Migration up reussit, tables creees
- V2 (P0) : EXCLUDE constraint actif : `\d booking_appointments` montre `EXCLUDE USING GIST`
- V3 (P0) : Test anti-overlap : INSERT 2 RDV meme room time chevauchant -> 2eme rejete
- V4 (P0) : INSERT 2 RDV meme room time differente -> les 2 reussissent
- V5 (P0) : INSERT 2 RDV chevauchants si premier `cancelled` -> 2eme reussit (WHERE clause)
- V6 (P0) : RLS bloque cross-tenant
- V7 (P0) : tokens calendar_syncs stockes chiffres (pas plain text)
- V8 (P0) : Migration revert reversible
- V9 (P1) : Performance : INSERT RDV reste < 10ms meme avec 100k RDV existants

---

## Tache 1.2.5 -- Migration "Communications" : 4 Tables

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 5h / Depend de 1.2.4

**But** : Creer 4 tables (messages, templates, opt-outs, webhooks_received) supportant WhatsApp + Email + SMS multilingue (fr / ar-MA / ar).

**Livrables checkables** :
- [ ] Migration `1735000000004-Communications.ts`
- [ ] Table `comm_messages` : id, tenant_id (FK), contact_id (FK NULL si broadcast), channel (enum 'whatsapp' | 'email' | 'sms' | 'voice'), direction (enum 'inbound' | 'outbound'), to_address (text -- email ou phone E.164), from_address, subject (NULL pour SMS/WA), body (text), template_id (FK NULL), template_variables (jsonb), status (enum 'pending' | 'queued' | 'sent' | 'delivered' | 'read' | 'failed'), provider (text -- 'meta' | 'twilio' | 'sendgrid' | 'mailgun'), provider_message_id, sent_at, delivered_at, read_at, failed_at, fail_reason, created_at, updated_at
- [ ] Table `comm_templates` : id, tenant_id (FK), name, channel (enum), category (enum 'marketing' | 'transactional' | 'reminder'), language (enum 'fr' | 'ar-MA' | 'ar'), subject_template (NULL si SMS/WA), body_template (text -- avec placeholders {{var_name}}), variables_schema (jsonb -- description vars), meta_template_name (text -- nom WA Meta approuve si applicable), meta_template_status (enum 'draft' | 'pending_review' | 'approved' | 'rejected'), active (bool), created_at, updated_at
- [ ] Table `comm_optouts` : id, tenant_id (FK), contact_id (FK), channel (enum), optout_at, reason (text NULL), created_by_contact (bool -- user a click unsubscribe vs admin a opt-out)
- [ ] Table `comm_webhooks_received` : id, tenant_id (NULL si webhook public not yet routed), provider (text), event_type (text), payload (jsonb), signature_valid (bool), processed_at, processed_status (enum 'pending' | 'success' | 'duplicate' | 'invalid_signature' | 'error'), idempotency_key (text UNIQUE), created_at -- **append-only**
- [ ] RLS active sur comm_messages, comm_templates, comm_optouts (tenant_id present)
- [ ] Pas de RLS sur comm_webhooks_received (tenant_id NULL initialement, route apres parsing)
- [ ] Indexes : (tenant_id, channel, status, sent_at DESC), (tenant_id, contact_id, created_at DESC), UNIQUE (idempotency_key)

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/1735000000004-Communications.ts   # ~180 lignes
repo/packages/database/src/entities/comm/comm-message.entity.ts          # ~60 lignes
repo/packages/database/src/entities/comm/comm-template.entity.ts         # ~50 lignes
repo/packages/database/src/entities/comm/comm-optout.entity.ts           # ~25 lignes
repo/packages/database/src/entities/comm/comm-webhook-received.entity.ts # ~35 lignes
repo/packages/database/src/entities/comm/index.ts
```

**Notes implementation** :
- `to_address` : phone E.164 (ex `+212661234567`) ou email -- validation Zod amont
- `template_variables jsonb` schema : `{ "user_name": "Mohamed", "police_id": "POL-2026-001" }`
- WhatsApp Meta requires templates pre-approved -- `meta_template_name` + `meta_template_status` track ce workflow (Sprint 9)
- `opt-out` peut etre par channel : user opt-out WA mais accepte encore email
- `webhooks_received.idempotency_key` UNIQUE pour deduplication retry providers (Meta resend webhook si pas 200 sous 5s)
- `signature_valid` calcule au receipt -- false rejected sans traitement
- Index `(tenant_id, channel, status, sent_at DESC)` : query "messages whatsapp failed last 24h" utilise (Sprint 9 dashboard)

**Criteres validation** :
- V1 (P0) : Migration up reussit
- V2 (P0) : 4 tables creees
- V3 (P0) : RLS active sur 3 tables (pas webhooks_received)
- V4 (P0) : UNIQUE (idempotency_key) actif : 2eme INSERT meme key fail
- V5 (P0) : Indexes performants : `EXPLAIN` sur "messages WA failed today" utilise index
- V6 (P0) : Enum `language` accepte fr / ar-MA / ar
- V7 (P0) : Migration revert reversible
- V8 (P1) : `template_variables` accepte JSONB arbitraire valide

---

## Tache 1.2.6 -- Migration "Docs + Pay" : 6 Tables

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 6h / Depend de 1.2.5

**But** : Creer 3 tables Docs (documents, versions, access logs) + 3 tables Pay (transactions, methods, reconciliation).

**Livrables checkables** :

**Docs (3 tables)** :
- [ ] Table `doc_documents` : id, tenant_id (FK), type (enum 'police' | 'devis' | 'facture' | 'sinistre' | 'kyc' | 'contrat' | 'autre'), title, description, related_resource_type, related_resource_id (uuid -- ex police_id), s3_bucket, s3_key, mime_type, size_bytes, sha256, status (enum 'draft' | 'final' | 'signed' | 'archived'), retention_until (date -- 10 ans+1 pour signed), created_by, created_at, updated_at, deleted_at
- [ ] Table `doc_versions` : id, document_id (FK), version_number (int), s3_key, size_bytes, sha256, change_summary, created_by, created_at -- **append-only**
- [ ] Table `doc_access_logs` : id, document_id (FK), user_id (FK auth_users NULL si anonymous via presigned URL), action (enum 'view' | 'download' | 'share'), ip_address, user_agent, created_at -- **append-only**

**Pay (3 tables)** :
- [ ] Table `pay_methods` : id, tenant_id (FK), name, provider (enum 'cmi' | 'youcan' | 'payzone' | 'm_wallet_inwi' | 'm_wallet_orange' | 'm_wallet_iam' | 'cash' | 'cheque' | 'virement'), config_encrypted (jsonb -- credentials API chiffrees), priority (int -- ordre affichage), active (bool), created_at, updated_at
- [ ] Table `pay_transactions` : id, tenant_id (FK), pay_method_id (FK), related_resource_type, related_resource_id, amount_dirham (numeric 15,2), currency (default 'MAD'), status (enum 'initiated' | 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded'), provider_transaction_id, provider_response (jsonb), customer_name, customer_email, customer_phone, callback_url, success_url, cancel_url, initiated_at, completed_at, failed_at, fail_reason, created_by, created_at, updated_at -- **append-mostly**
- [ ] Table `pay_reconciliation` : id, tenant_id (FK), transaction_id (FK), bank_statement_ref, reconciled_at, reconciled_by, status (enum 'matched' | 'unmatched' | 'discrepancy'), discrepancy_amount, notes, created_at

- [ ] RLS active sur 6 tables
- [ ] Indexes : (tenant_id, type, created_at DESC) sur documents, (tenant_id, status, initiated_at DESC) sur transactions
- [ ] Foreign keys appropriees, UNIQUE (document_id, version_number) sur doc_versions

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/1735000000005-DocsPayments.ts       # ~250 lignes
repo/packages/database/src/entities/docs/{3 entities}.ts                  # ~120 lignes total
repo/packages/database/src/entities/pay/{3 entities}.ts                   # ~120 lignes total
repo/packages/database/src/entities/{docs,pay}/index.ts
```

**Notes implementation** :
- `doc_documents.retention_until` : auto-calcule par trigger Postgres ou service apres signature (Sprint 12)
- `sha256` : verification integrite document (compare avec hash a la generation initiale)
- `pay_methods.config_encrypted jsonb` : `{ "api_key": "encrypted...", "merchant_id": "...", "secret": "encrypted..." }`
- `pay_transactions.related_resource_type/id` polymorphic : police_id, sinistre_id, facture_id, devis_id
- `pay_transactions.provider_response jsonb` : full payload provider stocke pour debug + audit
- Reconciliation Sprint 11 (matche bank statement avec transactions) -- table preparee Sprint 2
- Index transactions (tenant_id, status) optimal pour dashboards "transactions echouees"

**Criteres validation** :
- V1 (P0) : Migration up reussit, 6 tables creees
- V2 (P0) : RLS active sur 6 tables
- V3 (P0) : UNIQUE (document_id, version_number) actif
- V4 (P0) : `pay_methods.config_encrypted` accepte JSONB
- V5 (P0) : Indexes performants : "transactions failed last 24h" utilise index
- V6 (P0) : Migration revert reversible
- V7 (P1) : doc_access_logs append-only (verifier qu'aucune UPDATE policy)

---

## Tache 1.2.7 -- Migration "Books + Compliance" : 6 Tables

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 6h / Depend de 1.2.6

**But** : Creer 3 tables Books (factures, comptes, ecritures) + 3 tables Compliance (audits, declarations ACAPS, retention).

**Livrables checkables** :

**Books (3 tables)** :
- [ ] Table `books_invoices` : id, tenant_id (FK), invoice_number (text -- format YYYY-NNNNN), type (enum 'invoice' | 'credit_note' | 'proforma'), customer_name, customer_ice, customer_address, issue_date, due_date, currency (default 'MAD'), subtotal_ht (numeric 15,2), tva_amount (numeric 15,2), total_ttc (numeric 15,2), tva_rate (numeric 5,2 -- 20.00 par defaut), status (enum 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'), pdf_document_id (FK doc_documents NULL), created_by, created_at, updated_at
- [ ] Table `books_invoice_lines` : id, invoice_id (FK), description, quantity, unit_price_ht, total_ht, tva_rate, sort_order
- [ ] Table `books_accounts` : id, tenant_id (FK), account_number (text -- plan comptable MA), name, type (enum 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'), parent_account_id (FK NULL self-ref)

**Compliance (3 tables)** :
- [ ] Table `compliance_acaps_reports` : id, tenant_id (FK), period_start, period_end, report_type (enum 'monthly_production' | 'quarterly_sinistralite' | 'annual_solvency'), status (enum 'draft' | 'submitted' | 'accepted' | 'rejected'), submitted_at, acaps_reference, file_document_id (FK), created_by, created_at, updated_at
- [ ] Table `compliance_data_retention_policies` : id, tenant_id (FK), resource_type (text), retention_days (int), legal_basis (text -- ex 'ACAPS Article 12 retention 7 ans'), created_at, updated_at
- [ ] Table `compliance_consent_logs` : id, tenant_id (FK), contact_id (FK), consent_type (enum 'cnic_processing' | 'data_marketing' | 'data_third_party'), consent_given (bool), consent_method (enum 'web_form' | 'whatsapp_optin' | 'paper_signed'), evidence_document_id (FK NULL), expires_at, withdrawn_at, created_at -- **append-only**

- [ ] RLS active sur 6 tables
- [ ] UNIQUE (tenant_id, invoice_number) sur books_invoices (numerotation par tenant)
- [ ] UNIQUE (tenant_id, account_number) sur books_accounts
- [ ] Indexes appropries (tenant_id, status, issue_date DESC) sur invoices

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/1735000000006-BooksCompliance.ts    # ~280 lignes
repo/packages/database/src/entities/books/{3 entities}.ts                 # ~150 lignes total
repo/packages/database/src/entities/compliance/{3 entities}.ts            # ~120 lignes total
repo/packages/database/src/entities/{books,compliance}/index.ts
```

**Notes implementation** :
- Format `invoice_number` MA : `2026-00001` (annee + sequence padded). Generation Sprint 12
- `customer_ice` : copie ICE du client au moment d'emission (preserve meme si client modifie son ICE plus tard)
- TVA MA standard 20%, mais existent 7%, 10%, 14%, 0% selon produits/services
- `books_accounts.account_number` : Plan comptable marocain (CGNC) format `7XX` revenus, `6XX` charges, etc.
- `acaps_reports` : retention 7 ans minimum (loi MA assurance)
- `consent_logs` append-only critical pour conformite CNDP / RGPD-MA -- preuve consentement
- `data_retention_policies` config par tenant -- different selon type donnee

**Criteres validation** :
- V1 (P0) : Migration up reussit, 6 tables creees
- V2 (P0) : RLS active sur 6 tables
- V3 (P0) : UNIQUE (tenant_id, invoice_number) actif
- V4 (P0) : Auto-ref books_accounts.parent_account_id pour hierarchie comptes
- V5 (P0) : consent_logs append-only (pas UPDATE policy)
- V6 (P0) : Migration revert reversible
- V7 (P1) : Index issue_date DESC sur invoices performant

---

## Tache 1.2.8 -- Migration "Analytics + Stock + HR" : 5 Tables

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 5h / Depend de 1.2.7

**But** : Creer 5 tables (analytics_events, stock_items, stock_movements, hr_employees, hr_attendance).

**Livrables checkables** :

**Analytics (1 table)** :
- [ ] Table `analytics_events` : id, tenant_id (FK), event_name (text -- ex 'police_souscrite', 'sinistre_declare'), user_id (FK NULL), session_id, properties (jsonb), occurred_at, created_at -- **append-only, partition par mois (preparation Sprint 35)**

**Stock (2 tables, utilises Vertical Repair Sprint 20)** :
- [ ] Table `stock_items` : id, tenant_id (FK), sku (text -- code interne), name, description, category, unit (enum 'unit' | 'liter' | 'kg' | 'meter'), unit_price_ht (numeric 15,2), tva_rate, current_quantity (numeric 15,3), min_threshold (numeric 15,3 -- alert reorder), supplier_name, created_at, updated_at
- [ ] Table `stock_movements` : id, tenant_id (FK), item_id (FK), movement_type (enum 'in' | 'out' | 'adjustment' | 'inventory'), quantity (numeric 15,3 -- positive in/out direction in type), unit_price_ht_at_time, related_resource_type, related_resource_id, reason, created_by, created_at -- **append-only**

**HR (2 tables, utilises Vertical Repair Sprint 20)** :
- [ ] Table `hr_employees` : id, tenant_id (FK), user_id (FK auth_users NULL si pas d'acces app), full_name, role (enum 'mecanicien' | 'tolier' | 'peintre' | 'chef_atelier' | 'expert' | 'comptable' | 'commercial' | 'admin'), employee_number, hire_date, hourly_rate_dirham, monthly_salary_dirham, social_security_number (text), active (bool), created_at, updated_at
- [ ] Table `hr_attendance` : id, tenant_id (FK), employee_id (FK), check_in_at (timestamptz), check_out_at (timestamptz NULL), break_minutes (int default 0), notes, created_at -- **append-only**

- [ ] RLS active sur 5 tables
- [ ] UNIQUE (tenant_id, sku) sur stock_items
- [ ] UNIQUE (tenant_id, employee_number) sur hr_employees
- [ ] Indexes : (tenant_id, occurred_at DESC) sur analytics_events, (tenant_id, current_quantity, min_threshold) sur stock_items pour alertes

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/1735000000007-AnalyticsStockHR.ts   # ~220 lignes
repo/packages/database/src/entities/analytics/analytics-event.entity.ts   # ~30 lignes
repo/packages/database/src/entities/stock/{2 entities}.ts                 # ~80 lignes
repo/packages/database/src/entities/hr/{2 entities}.ts                    # ~80 lignes
repo/packages/database/src/entities/{analytics,stock,hr}/index.ts
```

**Notes implementation** :
- `analytics_events.properties jsonb` : free-form, schema specifique par event_name
- Partitioning analytics_events par mois (`occurred_at`) preparation -- pas implemente Sprint 2 (Sprint 35 Performance)
- `stock_items.current_quantity` : maintenu par triggers ou par service Sprint 13 (rebuild from movements en cas de drift)
- `min_threshold` declenche alerte WhatsApp/Email (Sprint 13)
- `hr_employees.role` : roles metier (vs role applicatif `auth_tenant_users.role`)
- `hr_attendance.break_minutes` : pause repas / priere (specifique MA, ramadan)
- Foreign key `hr_employees.user_id` NULLable : tous employes pas necessairement utilisateurs app (ex: stagiaire, chauffeur)

**Criteres validation** :
- V1 (P0) : Migration up reussit, 5 tables creees
- V2 (P0) : RLS active
- V3 (P0) : UNIQUE constraints actifs (sku, employee_number)
- V4 (P0) : Indexes performants pour queries "stock low alert" et "attendance today"
- V5 (P0) : Migration revert reversible
- V6 (P1) : `analytics_events.properties` accepte JSONB arbitraire

---

## Tache 1.2.9 -- TypeORM Subscribers : 3 Transverses

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 5h / Depend de 1.2.8

**But** : Implementer 3 subscribers TypeORM globaux qui s'executent automatiquement sur tous les events DB : injection tenant_id, ecriture audit log, gestion timestamps.

**Contexte** : Subscribers eliminent le risque d'oubli (developpeur Sprint 8 cree service CRM, n'a pas besoin de penser a injecter tenant_id manuellement -- subscriber le fait). Ces 3 subscribers sont la derniere ligne de defense fonctionnelle (RLS DB est la derniere ligne SECURITE).

**Livrables checkables** :

**Subscriber 1 : TenantIdInjector**
- [ ] `repo/packages/database/src/subscribers/tenant-id-injector.subscriber.ts`
- [ ] Implements `EntitySubscriberInterface` TypeORM
- [ ] Hook `beforeInsert(event)` : si entity etend BaseEntity et tenant_id manquant, lit `app_current_tenant()` via query SQL et injecte
- [ ] Throw error si tenant_id manquant ET pas de current_tenant set ET pas super admin (mode strict)
- [ ] Whitelist tables systeme exemptees : `auth_tenants`, `audit_log` (gerees specifiquement)

**Subscriber 2 : AuditLogWriter**
- [ ] `repo/packages/database/src/subscribers/audit-log-writer.subscriber.ts`
- [ ] Hook `afterInsert`, `afterUpdate`, `afterRemove` (soft delete inclus)
- [ ] Determine si entity est "auditable" (whitelist : auth_users, auth_sessions, insure_polices Sprint 14, repair_sinistres Sprint 20, pay_transactions, doc_documents)
- [ ] Compute diff before/after pour UPDATE (utilise databaseEntity vs entity)
- [ ] INSERT row dans audit_log avec action, resource_type, resource_id, changes (jsonb), user_id (lu depuis app_current_user_id), ip_address (lu depuis context si dispo)
- [ ] Eviter recursion : ne pas auditer audit_log lui-meme

**Subscriber 3 : TimestampsInjector**
- [ ] `repo/packages/database/src/subscribers/timestamps-injector.subscriber.ts`
- [ ] Hook `beforeInsert` : set created_at = NOW() si manquant
- [ ] Hook `beforeUpdate` : set updated_at = NOW()
- [ ] Hook soft delete (`@DeleteDateColumn`) : auto par TypeORM, mais log dans audit
- [ ] Pas necessaire si entity utilise `@CreateDateColumn` / `@UpdateDateColumn` decorators (auto TypeORM) -- verifier coherence

**Pattern critique : Subscriber TypeORM signature**

```typescript
// repo/packages/database/src/subscribers/tenant-id-injector.subscriber.ts
@EventSubscriber()
export class TenantIdInjectorSubscriber implements EntitySubscriberInterface {
  async beforeInsert(event: InsertEvent<BaseEntity>): Promise<void> {
    if (!(event.entity instanceof BaseEntity)) return;
    if (event.entity.tenant_id) return; // already set

    const result = await event.queryRunner.query('SELECT app_current_tenant() AS tid');
    const tid = result[0]?.tid;
    const isSuperAdmin = (await event.queryRunner.query('SELECT app_is_super_admin() AS sa'))[0]?.sa;

    if (!tid && !isSuperAdmin) {
      throw new Error(`Cannot insert ${event.metadata.tableName}: no tenant context set and not super admin`);
    }
    event.entity.tenant_id = tid;
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/subscribers/tenant-id-injector.subscriber.ts      # ~50 lignes
repo/packages/database/src/subscribers/audit-log-writer.subscriber.ts        # ~120 lignes
repo/packages/database/src/subscribers/timestamps-injector.subscriber.ts     # ~40 lignes
repo/packages/database/src/subscribers/index.ts                              # reexports
repo/packages/database/src/subscribers/audit-log-writer.spec.ts              # ~80 lignes
repo/packages/database/src/subscribers/tenant-id-injector.spec.ts            # ~60 lignes
repo/packages/database/src/data-source.ts                                    # update : add subscribers
```

**Notes implementation** :
- Subscribers enregistres dans DataSource config : `subscribers: [TenantIdInjectorSubscriber, AuditLogWriterSubscriber, TimestampsInjectorSubscriber]`
- AuditLogWriter doit eviter logger ses propres INSERTs (recursion infinie)
- AuditLogWriter compare `event.databaseEntity` (avant) vs `event.entity` (apres) pour diff fields
- Diff fields : changes JSONB stocke `{ before: { email: 'a@b.com' }, after: { email: 'b@c.com' }, fields_changed: ['email'] }`
- TenantIdInjector throw error -> rollback transaction TypeORM
- Test integration : INSERT user sans tenant context -> error attendue
- Test : INSERT user avec super admin -> reussit avec tenant_id NULL

**Criteres validation** :
- V1 (P0) : 3 subscribers enregistres dans DataSource
- V2 (P0) : INSERT sans tenant context throw error (sauf super admin)
- V3 (P0) : INSERT avec tenant context auto-injecte tenant_id
- V4 (P0) : UPDATE auditable entity ecrit row dans audit_log
- V5 (P0) : audit_log.changes contient diff before/after correct
- V6 (P0) : Pas de recursion : INSERT audit_log ne genere PAS un audit log additionel
- V7 (P0) : Tables exemptees (auth_tenants, audit_log) pas affectees par TenantIdInjector
- V8 (P0) : Tests integration covers happy path + error path
- V9 (P1) : Performance : subscriber overhead < 5ms par operation

---

## Tache 1.2.10 -- Topics Kafka Enrichi : 50+ Topics

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 4h / Depend de 1.2.9

**But** : Etendre le script `init-topics.sh` Sprint 1 (30 topics) pour atteindre 50+ topics couvrant tous les events documentes Sprint 2 et Sprints futurs (anticipation).

**Livrables checkables** :
- [ ] Script `repo/infrastructure/docker/kafka/init-topics.sh` enrichi
- [ ] Topics Auth (7) -- deja Sprint 1
- [ ] Topics CRM (5) -- deja Sprint 1, ajouter `interaction_email_received` (6 part)
- [ ] Topics Booking (3) -- deja Sprint 1
- [ ] Topics Comm (3) -- deja Sprint 1, ajouter : `template_created`, `template_approved`, `template_rejected`, `optout_recorded`, `webhook_received` (6 part)
- [ ] Topics Pay (4) -- deja Sprint 1, ajouter : `reconciliation_matched`, `reconciliation_discrepancy`
- [ ] Topics Insure (4) -- deja Sprint 1 (anticipation Sprint 14-16)
- [ ] Topics Repair (3) -- deja Sprint 1 (anticipation Sprint 20-22)
- [ ] Topics Audit (1) deja Sprint 1, ajouter : `compliance_data_purged`, `compliance_acaps_submitted`
- [ ] Topics Books (2 nouveaux) : `invoice_issued`, `invoice_paid`
- [ ] Topics Stock (2 nouveaux) : `stock_low_threshold`, `stock_movement_recorded`
- [ ] Topics HR (2 nouveaux) : `attendance_recorded`, `salary_processed`
- [ ] Topics System (3 nouveaux) : `user_password_reset_requested`, `tenant_created`, `tenant_settings_changed`
- [ ] Topics DLQ (5 enrichis) : `dlq.comm`, `dlq.pay`, `dlq.insure`, `dlq.repair`, `dlq.compliance` (1 partition chacun, retention 30 jours)
- [ ] Total >= 50 topics
- [ ] Configuration retention differenciee : audit / compliance topics retention 30 jours (vs 7 jours standard)

**Fichiers crees / modifies** :
```
repo/infrastructure/docker/kafka/init-topics.sh    # enrichi, ~150 lignes
```

**Notes implementation** :
- Helper function `create_topic()` reutilisee (deja Sprint 1)
- Naming convention strict : `insurtech.events.{vertical}.{entity}.{action}`
- Topics audit (compliance, audit) retention 30 jours pour replay analyse
- Topics DLQ : retention 30 jours minimum (replay tardif)
- Idempotent : `--if-not-exists` permet re-execution sans erreur
- Anticipation Sprint 14+ : topics Insure/Repair declares Sprint 2 meme si producteurs viendront plus tard (preparation infra)

**Criteres validation** :
- V1 (P0) : Script execute sans erreur (incluant re-execution)
- V2 (P0) : Total topics >= 50
- V3 (P0) : Naming convention respectee
- V4 (P0) : Topics DLQ avec retention 30 jours
- V5 (P0) : Topics compliance avec retention 30 jours
- V6 (P0) : `kafka-topics.sh --describe --topic insurtech.events.compliance.acaps_submitted` montre retention.ms=2592000000

---

## Tache 1.2.11 -- Init @insurtech/shared-events : Topics enum + Zod schemas + types

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 6h / Depend de 1.2.10

**But** : Centraliser les noms topics, schemas Zod des events, types TypeScript inferes, et helpers (build event id, etc.) dans un package partage par tous les producteurs et consommateurs.

**Contexte** : Sans schemas Zod centralises, drift garanti entre producteurs et consommateurs. Le package shared-events est SOURCE UNIQUE de verite pour : noms topics, structure events, validation runtime, types TypeScript.

**Livrables checkables** :
- [ ] Package `repo/packages/shared-events/` avec `package.json`, `tsconfig.json`, `src/`
- [ ] `src/topics.ts` exposant enum `Topics` avec tous les topics (50+)
- [ ] `src/schemas/auth/` -- 7 schemas Zod (un par event auth)
- [ ] `src/schemas/crm/` -- 6 schemas Zod
- [ ] `src/schemas/booking/` -- 3 schemas Zod
- [ ] `src/schemas/comm/` -- 8 schemas Zod
- [ ] `src/schemas/pay/` -- 6 schemas Zod
- [ ] `src/schemas/insure/` -- 4 schemas Zod (anticipation)
- [ ] `src/schemas/repair/` -- 3 schemas Zod (anticipation)
- [ ] `src/schemas/audit/` -- 3 schemas Zod
- [ ] `src/schemas/books/` -- 2 schemas Zod
- [ ] `src/schemas/stock/` -- 2 schemas Zod
- [ ] `src/schemas/hr/` -- 2 schemas Zod
- [ ] `src/schemas/system/` -- 3 schemas Zod
- [ ] `src/schemas/index.ts` reexports + Map `Topics -> ZodSchema` pour validation auto
- [ ] `src/types/event-envelope.ts` -- enveloppe commune (event_id, event_name, event_version, occurred_at, tenant_id, user_id, correlation_id, payload)
- [ ] `src/helpers/build-event-id.ts` -- ULID generator (sortable)
- [ ] `src/helpers/validate-event.ts` -- valide payload contre schema correspondant au topic
- [ ] Types TypeScript inferes via `z.infer<typeof XSchema>` exportes

**Pattern critique : event envelope structure**

Tous events Kafka skalean-insurtech suivent ce schema :

```typescript
// repo/packages/shared-events/src/types/event-envelope.ts
export const EventEnvelopeSchema = z.object({
  event_id: z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/), // ULID
  event_name: z.string(),                                  // ex 'police_created'
  event_version: z.string().default('1.0'),                // semver schema
  occurred_at: z.string().datetime(),
  tenant_id: z.string().uuid().nullable(),                 // null pour events systeme
  user_id: z.string().uuid().nullable(),                   // null si systeme
  correlation_id: z.string().uuid().nullable(),            // tracking distributed
  payload: z.unknown(),                                    // schema specifique par event
});

export type EventEnvelope<T = unknown> = z.infer<typeof EventEnvelopeSchema> & { payload: T };
```

Schema specifique :

```typescript
// repo/packages/shared-events/src/schemas/auth/user-signed-in.schema.ts
export const UserSignedInPayloadSchema = z.object({
  user_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  signin_method: z.enum(['password', 'mfa', 'recovery_code']),
  ip_address: z.string().ip(),
  user_agent: z.string(),
  signed_in_at: z.string().datetime(),
});

export type UserSignedInPayload = z.infer<typeof UserSignedInPayloadSchema>;
```

**Fichiers crees / modifies** :
```
repo/packages/shared-events/package.json                       # ~15 lignes (deps : zod, ulid)
repo/packages/shared-events/tsconfig.json
repo/packages/shared-events/src/topics.ts                       # ~80 lignes (enum + display names)
repo/packages/shared-events/src/types/event-envelope.ts         # ~25 lignes
repo/packages/shared-events/src/schemas/{12 dossiers}/{50+ schemas .schema.ts}   # ~3-5 lignes payload + types
repo/packages/shared-events/src/schemas/index.ts                # reexports + Map<Topics, ZodSchema>
repo/packages/shared-events/src/helpers/build-event-id.ts       # ULID generator
repo/packages/shared-events/src/helpers/validate-event.ts       # ~30 lignes
repo/packages/shared-events/src/index.ts
repo/packages/shared-events/src/schemas/auth/user-signed-in.spec.ts   # ~30 lignes
```

**Notes implementation** :
- `Topics` enum permet TypeScript autocomplete : `publisher.publish(Topics.AUTH_USER_SIGNED_IN, payload)`
- ULID (vs UUID) : sortable lexicographiquement = ordering naturel par event_id
- `event_version` semver : `1.0` initial, `1.1` ajout field optional, `2.0` breaking change (rare)
- `correlation_id` : permet tracking d'une requete originale a travers plusieurs services (web -> API -> Kafka -> consumer)
- `tenant_id nullable` : events systeme (ex `tenant_created`) n'ont pas tenant_id (ou ont tenant_id de l'admin platform)
- Map `Topics -> ZodSchema` permet validation generique : `validateEvent(topic, payload)` retourne success/error
- Tests minimum 1 schema par module (unit test couvrant happy path + error)

**Criteres validation** :
- V1 (P0) : Package build reussit
- V2 (P0) : `Topics` enum exporte 50+ valeurs
- V3 (P0) : 50+ schemas Zod presents et valides
- V4 (P0) : `validateEvent(Topics.AUTH_USER_SIGNED_IN, payload)` reussit avec payload conforme
- V5 (P0) : `validateEvent` echoue avec payload non-conforme (return error details)
- V6 (P0) : Map `Topics -> ZodSchema` complete (chaque topic a un schema)
- V7 (P0) : ULID generator produit IDs valides (regex match)
- V8 (P0) : Types TypeScript inferes : `UserSignedInPayload` typed correctement
- V9 (P1) : Tests unitaires 12 schemas (1 par module)

---

## Tache 1.2.12 -- KafkaPublisher Service NestJS

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 5h / Depend de 1.2.11

**But** : Service NestJS reutilisable publiant events vers Kafka avec validation Zod automatique, idempotency, retry exponential, et circuit breaker.

**Contexte** : Tous les services NestJS metier (Sprints 5+) utilisent ce service pour publier events. Centraliser garantit : pas d'event publie sans schema validation, retry automatique en cas Kafka down, observability uniformisee.

**Livrables checkables** :
- [ ] Service NestJS `repo/packages/shared-events/src/publisher/kafka-publisher.service.ts`
- [ ] Methode `publish<T>(topic: Topics, payload: T, options?: PublishOptions): Promise<void>`
- [ ] Validation Zod automatique avant envoi : si payload invalide, throw `InvalidEventError`
- [ ] Construction enveloppe : event_id (ULID), event_name (depuis topic mapping), event_version (depuis schema), occurred_at (NOW), tenant_id (depuis context si dispo), correlation_id (depuis context si dispo)
- [ ] Idempotency : `event_id` unique permet deduplication consumers (key = ULID)
- [ ] Partition key : `tenant_id` pour preserver ordering per-tenant
- [ ] Retry strategy : 3 tentatives avec backoff exponential 100ms / 500ms / 2000ms
- [ ] Circuit breaker : apres 5 echecs consecutifs, bypass Kafka et stocker dans table outbox (Sprint 35 finalisera)
- [ ] Logs Pino structures : event_id, topic, partition, offset retournes par Kafka
- [ ] Metrics OpenTelemetry : `kafka_publish_duration_ms`, `kafka_publish_success_total`, `kafka_publish_failure_total`
- [ ] Module NestJS `KafkaPublisherModule.forRoot({ brokers, clientId })` pour configuration
- [ ] Tests unitaires : happy path, validation error, retry on transient error, circuit breaker open
- [ ] Tests integration : publish reel vers Kafka dev + verification consume cote test

**Pattern critique : signature publish + retry**

```typescript
async publish<T>(
  topic: Topics,
  payload: T,
  options?: { tenantId?: string; userId?: string; correlationId?: string }
): Promise<void> {
  // 1. Validate payload against schema
  const schema = topicSchemaMap.get(topic);
  if (!schema) throw new Error(`No schema registered for topic ${topic}`);
  const validation = schema.safeParse(payload);
  if (!validation.success) throw new InvalidEventError(topic, validation.error);

  // 2. Build envelope
  const envelope: EventEnvelope<T> = {
    event_id: ulid(),
    event_name: topicEventNameMap.get(topic)!,
    event_version: '1.0',
    occurred_at: new Date().toISOString(),
    tenant_id: options?.tenantId ?? null,
    user_id: options?.userId ?? null,
    correlation_id: options?.correlationId ?? null,
    payload,
  };

  // 3. Publish with retry
  await this.publishWithRetry(topic, envelope);
}
```

**Fichiers crees / modifies** :
```
repo/packages/shared-events/src/publisher/kafka-publisher.service.ts          # ~150 lignes
repo/packages/shared-events/src/publisher/kafka-publisher.module.ts           # ~30 lignes
repo/packages/shared-events/src/publisher/errors.ts                            # ~15 lignes
repo/packages/shared-events/src/publisher/kafka-publisher.service.spec.ts     # ~120 lignes
repo/packages/shared-events/package.json                                       # add deps : kafkajs, @nestjs/common
```

**Notes implementation** :
- KafkaJS Producer config : `idempotent: true` (Kafka native dedup) + `transactionalId` per service
- Partition key tenant_id : meme tenant -> meme partition -> ordering preserve
- Retry transient errors uniquement : `KafkaJSConnectionError`, `KafkaJSRequestTimeoutError`. NetworkError = retry. ValidationError = NO retry
- Circuit breaker : library `opossum` ou implementation custom avec compteur erreurs + timer reset
- Module NestJS `forRoot` config + `forFeature` pour usage dans autres modules
- Test integration : utiliser test container Kafka ou `docker-compose.test.yaml`

**Criteres validation** :
- V1 (P0) : Service publie evenement vers Kafka reel (test integration)
- V2 (P0) : Payload invalide rejete par Zod avant envoi
- V3 (P0) : event_id genere (ULID valide)
- V4 (P0) : Partition key = tenant_id verifiable cote consumer
- V5 (P0) : Retry 3 fois sur transient error
- V6 (P0) : Circuit breaker ouvre apres 5 echecs (test : Kafka down)
- V7 (P0) : Logs structures emit avec event_id + topic
- V8 (P0) : Metrics OTEL emis (verifier endpoint Prometheus)
- V9 (P1) : Tests unitaires + integration passent
- V10 (P1) : Module NestJS forRoot configurable

---

## Tache 1.2.13 -- KafkaConsumerBase Abstract Class

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 6h / Depend de 1.2.12

**But** : Classe abstraite NestJS reutilisable pour ecrire consumers Kafka avec manual ack, validation Zod automatique, retry exponential, DLQ, et idempotency check.

**Contexte** : Tous les consumers (notification handlers, audit listeners, etc. Sprints 9+) etendront cette base. Logic transverse centralisee : log structuredevenirs offset, gestion erreurs, retry, deduplication.

**Livrables checkables** :
- [ ] Classe abstraite `repo/packages/shared-events/src/consumer/kafka-consumer.base.ts`
- [ ] Method abstract `handle(payload: T, envelope: EventEnvelope<T>): Promise<void>` -- override par consumer concret
- [ ] Method abstract `getTopic(): Topics` -- override pour declarer topic ecoute
- [ ] Method abstract `getGroupId(): string` -- override pour group consumer (e.g. `notifications-handler`)
- [ ] Hook `onMessage(message)` : parse JSON + validate Zod + idempotency check + appel `handle()` + ack
- [ ] Manual ack : `eachMessage` avec `commitOffsetsIfNecessary` apres succes
- [ ] Idempotency : table `consumer_processed_events` (event_id, group_id, processed_at) -- check avant `handle()`, INSERT apres succes
- [ ] Retry exponential : 3 tentatives avec 1s / 5s / 30s
- [ ] DLQ : apres 3 echecs, publish dans `insurtech.events.dlq.{module}` avec metadata erreur (stacktrace, attempt count)
- [ ] Validation Zod : payload validate vs `topicSchemaMap.get(topic)` avant `handle()`
- [ ] Logs structures : event_id, topic, partition, offset, attempt, duration
- [ ] Migration DB pour table `consumer_processed_events`
- [ ] Tests unitaires : happy path, validation error, retry on error, DLQ apres 3 echecs, idempotency check

**Pattern critique : signature consumer concret**

```typescript
// Exemple usage Sprint 9
@Injectable()
export class WhatsAppNotificationConsumer extends KafkaConsumerBase<UserSignedInPayload> {
  getTopic(): Topics { return Topics.AUTH_USER_SIGNED_IN; }
  getGroupId(): string { return 'whatsapp-notifications-handler'; }

  async handle(payload: UserSignedInPayload, envelope: EventEnvelope<UserSignedInPayload>): Promise<void> {
    // Logic metier : envoyer notification WhatsApp si user opt-in
    await this.whatsAppService.sendSecurityNotice(payload.user_id);
  }
}
```

**Schema migration table consumer_processed_events**

```sql
CREATE TABLE consumer_processed_events (
  event_id text NOT NULL,
  group_id text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, group_id)
);

-- TTL cleanup : evenements > 30 jours peuvent etre supprimes (fenetre dedup raisonnable)
CREATE INDEX idx_consumer_processed_events_processed_at ON consumer_processed_events(processed_at);
```

**Fichiers crees / modifies** :
```
repo/packages/shared-events/src/consumer/kafka-consumer.base.ts            # ~200 lignes
repo/packages/shared-events/src/consumer/kafka-consumer.module.ts          # ~40 lignes
repo/packages/database/src/migrations/1735000000008-ConsumerProcessedEvents.ts   # ~30 lignes
repo/packages/database/src/entities/system/consumer-processed-event.entity.ts    # ~20 lignes
repo/packages/shared-events/src/consumer/kafka-consumer.base.spec.ts       # ~150 lignes
```

**Notes implementation** :
- KafkaJS Consumer : `eachMessage` callback pattern (vs `eachBatch` plus complexe)
- Manual commit : `await consumer.commitOffsetsIfNecessary()` APRES `handle()` succes
- Idempotency check : `SELECT 1 FROM consumer_processed_events WHERE event_id = $1 AND group_id = $2`
- INSERT idempotency : `INSERT ... ON CONFLICT DO NOTHING` (course condition possible)
- DLQ message format : `{ original_envelope, error: { message, stack, attempt }, dlq_at: timestamp }`
- Cleanup table : job cron Sprint 33 supprime rows > 30 jours
- Retry au niveau consumer (vs Kafka native retry) car permet logique custom (ne PAS retry validation errors)

**Criteres validation** :
- V1 (P0) : Classe abstraite compile
- V2 (P0) : Subclass simple fonctionne (test : consumer concret recoit message)
- V3 (P0) : Validation Zod amont -- payload invalide pas envoye a `handle()`
- V4 (P0) : Idempotency : 2eme processing meme event_id ne re-execute pas `handle()`
- V5 (P0) : Retry exponential 3 fois sur erreur transient
- V6 (P0) : DLQ : apres 3 echecs, message publie dans DLQ topic
- V7 (P0) : Manual ack apres succes (offset commite)
- V8 (P0) : Logs structures avec event_id + topic + offset
- V9 (P0) : Migration consumer_processed_events appliquee
- V10 (P1) : Tests unitaires + integration passent

---

## Tache 1.2.14 -- Seeds Dev Exhaustifs

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 4h / Depend de 1.2.13

**But** : Script TypeScript peuplant la DB dev avec donnees realistes pour faciliter dev/demo : 5 assureurs MA + 1 cabinet courtier + 1 garage + 50 contacts + 20 polices fictives.

**Livrables checkables** :
- [ ] `repo/infrastructure/scripts/seed-dev.ts` (executable via `pnpm seeds:run`)
- [ ] `repo/infrastructure/scripts/seed-reset.ts` (TRUNCATE all tables, reset ID sequences via `pnpm seeds:reset`)
- [ ] Seed 1 : tenant Skalean Platform (super admin)
- [ ] Seed 2 : 1 tenant cabinet courtier "Cabinet Bennani Assurance" (Casablanca)
- [ ] Seed 3 : 1 tenant garage "Garage Atlas Auto" (Marrakech)
- [ ] Seed 4 : 5 utilisateurs role mix : 1 super_admin_platform, 1 broker_admin (Bennani), 1 broker_user (Bennani), 1 garage_chef (Atlas), 1 garage_technicien (Atlas)
- [ ] Seed 5 : 50 contacts CRM realistes (faker locale fr_MA pour noms, ICE, CIN, phone +212 valides) repartis 30 Bennani + 20 Atlas
- [ ] Seed 6 : 20 deals CRM (mix stages : 5 lead, 5 qualified, 5 proposal, 5 won)
- [ ] Seed 7 : 5 assureurs MA dans table `insure_assureurs` (preparation Sprint 14) -- Wafa Assurance, Atlanta Sanad, Saham Assurance, RMA Assurance, AXA Assurance Maroc
- [ ] Seed 8 : 5 produits assurance par assureur (auto TR, auto TP, habitation, vie, sante)
- [ ] Seed 9 : 20 polices fictives (mix actives, expirees, annulees) reliees a contacts Bennani
- [ ] Seed 10 : 10 RDV booking dans futur (Bennani + Atlas)
- [ ] Seed 11 : 30 messages comm dans historique (mix WA + email)
- [ ] Idempotent : seeds peuvent etre re-executes sans dupliquer (check existence via UNIQUE keys)
- [ ] Logs progress : `Seeded 50 contacts (30 Bennani + 20 Atlas)`
- [ ] Performance : seed complet termine en < 30s

**Fichiers crees / modifies** :
```
repo/infrastructure/scripts/seed-dev.ts               # ~400 lignes (orchestration + faker calls)
repo/infrastructure/scripts/seed-reset.ts             # ~30 lignes (TRUNCATE all)
repo/infrastructure/scripts/seed-data/                # JSON seed data si applicable
  ├── assureurs-ma.json                               # 5 assureurs reels MA
  ├── produits-assurance.json                         # 25 produits (5 par assureur)
  └── villes-ma.json                                  # 20 villes principales MA pour adresses
```

**Notes implementation** :
- Faker configure `faker.locale = fr` ou installation `@faker-js/faker` extension `fr_MA` si dispo
- ICE genere format 15 chiffres : `'001234567890123'` (verifie unicite par (tenant_id, ice))
- CIN genere format `[A-Z][0-9]{6}` : `'A123456'`
- Phone E.164 MA : `+212661234567` (mobile commence `+2126XX` ou `+2127XX`)
- Email : `prenom.nom@example.ma` (faker fr + domaine MA)
- Polices : numero format `POL-2026-{seq}` (sequence par tenant)
- Idempotency : use `INSERT ... ON CONFLICT DO NOTHING` pour seeds
- Tests : `pnpm seeds:run` reussit, `pnpm seeds:reset && pnpm seeds:run` reussit

**Criteres validation** :
- V1 (P0) : `pnpm seeds:run` reussit en < 30s
- V2 (P0) : 50 contacts crees (30 Bennani + 20 Atlas)
- V3 (P0) : 20 deals crees, mix stages
- V4 (P0) : 20 polices reliees a contacts Bennani
- V5 (P0) : Re-execution idempotent (pas de doublons)
- V6 (P0) : `pnpm seeds:reset` clean toutes tables
- V7 (P0) : Donnees realistes (noms MA plausibles, ICE/CIN format valide)
- V8 (P1) : Logs progress informatifs

---

## Tache 1.2.15 -- Tests Integration : Migrations + RLS + Kafka End-to-End

**Metadonnees** : Phase 1 / Sprint 2 / P0 / 5h / Depend de 1.2.14

**But** : Battery de tests integration validant que tout le Sprint 2 fonctionne end-to-end : migrations reversibles, RLS bloque cross-tenant, subscribers actifs, Kafka pub/sub round-trip.

**Livrables checkables** :
- [ ] Suite tests `repo/packages/database/test/integration/`
- [ ] Test 1 : `migrations.spec.ts` -- toutes 8 migrations up + down + up reussissent sequentiellement
- [ ] Test 2 : `rls-multi-tenant.spec.ts` -- INSERT contact tenant A puis SELECT tenant B retourne 0 rows (verifie pour les 32 tables)
- [ ] Test 3 : `rls-super-admin.spec.ts` -- super admin bypass RLS (voit cross-tenant)
- [ ] Test 4 : `subscribers-tenant-id.spec.ts` -- INSERT sans tenant context throw error, INSERT avec context auto-injecte
- [ ] Test 5 : `subscribers-audit-log.spec.ts` -- UPDATE auth_user genere row dans audit_log avec diff fields
- [ ] Test 6 : `subscribers-timestamps.spec.ts` -- INSERT/UPDATE auto-set created_at/updated_at
- [ ] Test 7 : `kafka-publisher.spec.ts` (integration) -- publish event reel + recoit cote consumer
- [ ] Test 8 : `kafka-consumer-base.spec.ts` (integration) -- consumer concret recoit + ack + idempotency check
- [ ] Test 9 : `kafka-dlq.spec.ts` -- erreur 3 fois envoie message dans DLQ
- [ ] Test 10 : `seeds.spec.ts` -- `pnpm seeds:run` reussit, donnees coherentes
- [ ] Tous tests passent en CI (services Postgres + Kafka + Redis)
- [ ] Coverage tests integration >= 80% lignes packages/database et packages/shared-events
- [ ] Tests reproducibles (cleanup avant chaque test, pas de state shared)

**Fichiers crees / modifies** :
```
repo/packages/database/test/integration/migrations.spec.ts             # ~80 lignes
repo/packages/database/test/integration/rls-multi-tenant.spec.ts       # ~150 lignes
repo/packages/database/test/integration/rls-super-admin.spec.ts        # ~80 lignes
repo/packages/database/test/integration/subscribers-tenant-id.spec.ts  # ~70 lignes
repo/packages/database/test/integration/subscribers-audit-log.spec.ts  # ~80 lignes
repo/packages/database/test/integration/subscribers-timestamps.spec.ts # ~50 lignes
repo/packages/shared-events/test/integration/kafka-publisher.spec.ts   # ~100 lignes
repo/packages/shared-events/test/integration/kafka-consumer-base.spec.ts # ~120 lignes
repo/packages/shared-events/test/integration/kafka-dlq.spec.ts         # ~80 lignes
repo/packages/database/test/integration/seeds.spec.ts                  # ~60 lignes
repo/packages/database/test/integration/setup.ts                        # cleanup helpers ~40 lignes
```

**Notes implementation** :
- Cleanup avant chaque test : TRUNCATE tables avec `RESTART IDENTITY CASCADE`
- Tests Kafka : timeout 30s (consumer group join lent en CI)
- RLS test : ouvrir 2 connexions Postgres, set `app.current_tenant_id` different sur chacune
- Audit log test : verifier diff `changes.fields_changed` exact
- DLQ test : timing important (consumer doit recevoir + processer + fail 3 fois + DLQ)
- Seeds test : run sur DB clean, verifier counts (50 contacts, 20 deals, etc.)
- Test integration ne doit PAS dependre des autres tests integration (isolation)

**Criteres validation** :
- V1 (P0) : Tous 10 tests integration passent localement (`pnpm test`)
- V2 (P0) : Tous tests passent en CI (services PG + Kafka + Redis)
- V3 (P0) : Migrations up/down/up reussit
- V4 (P0) : RLS verifie sur les 32 tables
- V5 (P0) : Subscribers fonctionnels (3 verifies)
- V6 (P0) : Kafka publisher + consumer integres
- V7 (P0) : DLQ recoit messages apres 3 echecs
- V8 (P0) : Seeds reussissent
- V9 (P0) : Coverage >= 80% lines sur packages concernes
- V10 (P1) : Tests reproducibles (run 5 fois consecutif passe)

---

## Sortie du Sprint 2

A la fin de l'execution des 15 taches :

```
DB Postgres skalean_insurtech :
  - 32 tables creees (PARTIE1) avec RLS active
  - 8 migrations TypeORM appliquees (numerotation 1735000000001-008)
  - 6 helpers SQL multi-tenant (Sprint 1) + 3 subscribers TypeORM operationnels
  - Donnees seeds : 5 assureurs + 2 tenants (cabinet + garage) + 5 users + 50 contacts + 20 deals + 20 polices

Kafka :
  - 50+ topics catalogues
  - shared-events package complet (Topics enum + 50+ schemas Zod + types TS)
  - KafkaPublisher service operationnel (validation + retry + circuit breaker)
  - KafkaConsumerBase abstract class (manual ack + retry + DLQ + idempotency)

Tests :
  - 10 suites tests integration passent
  - Coverage >= 80% packages/database + packages/shared-events
```

**Sprint 3 demarre avec** :
- Couche persistance complete et testee
- Systeme events Kafka pret a etre branche aux services NestJS
- Contexte multi-tenant (helpers + subscribers) functional
- Donnees seeds permettant dev visible immediatement

---

## Specifications Format Tache (pour Generation par Cowork)

Quand Cowork genere les fichiers `task-1.2.X-*.md` dans `00-pilotage/prompts-taches/sprint-02-database-kafka/`, suivre la structure de ce meta-prompt : Metadonnees / But / Contexte (si necessaire) / Livrables checkables / Fichiers crees / modifies / Notes implementation / Criteres validation V1-V10.

**Code inline reserve aux patterns critiques skalean-insurtech non-evidents** : helper `withTenantContext`, RLS policy template, EXCLUDE constraint Booking, subscriber TypeORM signature, event envelope schema, signature consumer concret.

**Reference complete** : `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` contient le SQL complet des 32 tables avec colonnes exactes, types, constraints. Cowork doit s'aligner sur ce fichier source.

---

**Fin du meta-prompt B-02 v2.2 format Option B.**
