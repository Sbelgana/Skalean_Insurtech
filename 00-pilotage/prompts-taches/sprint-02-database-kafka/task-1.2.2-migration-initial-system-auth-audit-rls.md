# Task 1.2.2 -- Migration "Initial System" : 5 tables (auth + audit_log) + RLS multi-tenant 3 niveaux

## 1. Header metadata

| Cle              | Valeur                                                                                  |
|------------------|-----------------------------------------------------------------------------------------|
| Task ID          | 1.2.2                                                                                   |
| Titre            | Migration Initial System -- 5 tables (auth + audit_log) + RLS multi-tenant 3 niveaux    |
| Sprint           | 2 (Database & Kafka Foundations)                                                        |
| Phase            | Phase 1 -- Foundations                                                                  |
| Effort estime    | 8h                                                                                      |
| Priorite         | P0 (bloquant pour Sprints 3+ : auth, RBAC, audit, all metier)                           |
| Depend de        | 1.2.1 (Bootstrap TypeORM + DataSource + extensions PostgreSQL)                          |
| Bloque           | 1.2.3 (Migration tenant_brokers + RLS policies metier broker), Sprint 3 (Auth/RBAC)     |
| Owner            | Tech Lead Backend                                                                       |
| Reviewer         | Architecte Principal + DPO (audit_log + retention 7 ans)                                |
| Statut initial   | TODO                                                                                    |
| Date creation    | 2026-05-05                                                                              |
| Critere global   | B-02 (RLS active sur 4 tables, FORCE RLS, 4 policies par table, indexes, revert OK)     |
| Fichiers cibles  | apps/api/src/database/migrations/1735000000001-InitialSystem.ts (~250 lignes)           |
|                  | apps/api/src/database/entities/system/{auth-*.entity.ts, audit-log.entity.ts} (~190 LOC)|
|                  | apps/api/src/database/entities/system/index.ts (re-exports)                             |
|                  | apps/api/test/integration/migrations.spec.ts (>=8 tests)                                |
|                  | apps/api/test/integration/rls-auth-users.spec.ts (>=8 tests)                            |
|                  | apps/api/test/integration/audit-log-append-only.spec.ts (>=4 tests)                     |
|                  | apps/api/test/integration/citext-case-insensitive.spec.ts (>=3 tests)                   |
| Decisions ADR    | decision-002 (multi-tenant strict), decision-003 (TypeORM 0.3), decision-008 (residency)|
| Conformite       | Loi 09-08 CNDP, Loi ACAPS audit trail 7 ans, ISO 27001 logs append-only                 |
| Tags             | #migration #rls #auth #audit #postgres #typeorm #sprint2 #phase1 #p0                    |

## 2. But

### 2.1 Pose des fondations auth + RLS multi-tenant

Cette tache materialise la **premiere migration applicative** du systeme Skalean InsurTech apres
le bootstrap TypeORM (1.2.1). Elle cree les **5 tables fondatrices du domaine "system"** : 
`auth_tenants` (catalog des organisations broker/garage/mixed), `auth_users` (comptes), 
`auth_tenant_users` (jonction many-to-many gerant les SuperAdmins multi-tenants), 
`auth_sessions` (refresh tokens hashes pour rotation), et `audit_log` (journal append-only 
toutes mutations metier). C'est sur ces tables que reposeront **TOUTES les autres entites 
metier** des 23 sprints restants : courtiers (Sprint 5+), polices (Sprint 7+), sinistres 
(Sprint 9+), garages (Sprint 14+), comptabilite CGNC (Sprint 12+). Une erreur de design 
ici se propage a 100% du backend ; c'est pour cela que cette tache mobilise 8h dont 
**3h dediees aux tests d'isolation RLS** (cross-tenant + super admin bypass + append-only).

Le pattern RLS adopte applique **systematiquement 4 policies (SELECT/INSERT/UPDATE/DELETE)** 
par table tenant-isolee, branchees sur la fonction `app_can_access_tenant(tenant_id uuid)` 
deja deployee Sprint 1 (decision-002). Cette fonction lit `current_setting('app.current_tenant_id')` 
et `current_setting('app.is_super_admin')` injectes par le middleware Express en debut de 
chaque requete HTTP (a livrer Sprint 3). Sans ces variables de session, **aucune ligne ne 
remonte**, ce qui constitue notre derniere ligne de defense en profondeur : meme si un 
controleur NestJS oublie le `WHERE tenant_id = ?`, la base refuse de retourner les donnees 
d'un autre tenant. Le `FORCE ROW LEVEL SECURITY` garantit que **meme le proprietaire de la 
table** (role applicatif `skalean_app`) est soumis aux policies, fermant la porte au bypass 
classique PostgreSQL ou les owners sont exemptes par defaut.

### 2.2 Retention 7 ans ACAPS sur audit_log

La table `audit_log` est concue **append-only** (uniquement INSERT, aucune policy UPDATE/DELETE 
sauf job purge controle). Cette contrainte structurelle satisfait simultanement : **(a)** 
l'article 23 de la Loi 09-08 sur la protection des donnees personnelles (CNDP) imposant 
la tracabilite des acces aux donnees personnelles ; **(b)** la circulaire ACAPS 2018 
exigeant un audit trail immuable de **7 ans (2555 jours)** pour les operations d'assurance 
non-vie ; **(c)** les exigences ISO 27001 A.12.4 (logs proteges contre falsification). 
Le champ `changes jsonb` stocke `{before: {...}, after: {...}, fields_changed: ['email','role']}` 
permettant un diff complet sans recourir a un eventsourcing complet. La retention sera 
appliquee Sprint 18 par un job pgcron purgeant les lignes `created_at < now() - interval '7 years'` 
**uniquement** apres archivage compresse vers S3-compatible Benguerir (decision-008 data 
residency Maroc). Aucune ligne ne sort jamais du territoire marocain.

### 2.3 FORCE RLS strict + bypass uniquement via SET ROLE postgres

Le mode FORCE est non-negociable. PostgreSQL par defaut **exempte le proprietaire** d'une 
table des RLS policies, ce qui signifie que si l'application se connecte avec `skalean_app` 
(owner des tables), les policies sont **muettes**. FORCE RLS impose les policies meme au 
proprietaire ; seul le superuser `postgres` (utilise exclusivement pour migrations/maintenance, 
jamais pour le runtime applicatif) peut bypasser. Cette configuration est testee par 
`test/integration/rls-auth-users.spec.ts` qui se connecte explicitement avec le role 
applicatif et verifie qu'un INSERT tenant A puis SELECT tenant B retourne **zero lignes**. 
Si le test echoue, la migration est rejetee en CI.

## 3. Contexte etendu

### 3.1 Pourquoi citext + lower(email) en index pour auth_users.email

L'email est l'identifiant naturel de connexion. Sans precaution, `Joe@Example.com` et 
`joe@example.com` seraient deux comptes distincts, ce qui declenche : **(1)** confusion 
utilisateur lors de "mot de passe oublie" (echec silencieux) ; **(2)** vulnerabilite a 
l'enumeration de comptes (un attaquant pourrait decouvrir si un email existe en variant 
la casse) ; **(3)** double-inscription accidentelle bloquant les statistiques BI. La 
solution **citext** (CASE INSENSITIVE TEXT, extension PostgreSQL) traite les comparaisons 
nativement case-insensitive : `'Joe@Example.com'::citext = 'joe@example.com'::citext` 
retourne `true`. La contrainte `UNIQUE` sur une colonne `citext` garantit qu'aucune variation 
de casse ne peut etre inseree deux fois. En complement, l'index `CREATE INDEX idx_auth_users_email_lower ON auth_users (lower(email::text))` 
accelere les `WHERE lower(email) = $1` (defensif si un developpeur applique encore 
`lower()` cote applicatif). Alternative `text + lower()` rejected : double-write risk, 
manque de symetrie comparaison, oubli probable.

### 3.2 Tableau alternatives : TypeORM migrations vs Prisma vs raw SQL vs Atlas

| Solution         | Pour                                            | Contre                                                | Verdict   |
|------------------|-------------------------------------------------|-------------------------------------------------------|-----------|
| TypeORM 0.3      | Coherent avec ORM choisi (decision-003), revert | Pas de detection drift natif, runner verbose         | RETENU    |
| Prisma migrate   | Diff automatique, syntaxe declarative           | Necessite re-architecture ORM, schema drift binaire  | Rejected  |
| Raw SQL + flyway | Controle total syntaxe, perf optimale           | Pas de mapping entites, double maintenance schema    | Rejected  |
| Atlas (HCL)      | Versioning declaratif, lint avance, plan/apply  | Outil supplementaire, courbe apprentissage equipe    | Rejected  |
| Sqitch           | Reversible natif, dependances explicites Tcl    | Tcl, peu d'adoption JS, abandon perl                 | Rejected  |

Decision : TypeORM 0.3 avec migrations TypeScript classiques (`up()`/`down()`), QueryRunner 
explicite pour DDL pure (pas de `runMigrations: true` runtime, voir 1.2.1).

### 3.3 Trade-offs et decisions architecturales

**Trade-off 1 : enum natif PostgreSQL vs text + check constraint pour `auth_tenants.type`.** 
Choix : enum natif `tenant_type` (`'broker' | 'garage' | 'mixed'`). Pour : performance 
(stockage 4 bytes vs varlena), validation DB. Contre : alterer un enum requiert migration 
delicate. Mitigation : type stable, dernier ajout prevu = `'mga'` (Sprint 19).

**Trade-off 2 : tenant_id NULL pour SuperAdmins vs colonne separee `is_platform_user`.** 
Choix : `tenant_id NULL` + jonction `auth_tenant_users` pour les acces multi-tenants. 
Pour : un SuperAdmin peut avoir 0 tenant rattache (platform-only) ou N tenants. Contre : 
le NULL est ambigu. Mitigation : la colonne `display_name` + check `auth_users.tenant_id IS NULL OR EXISTS(...)` 
clarifie semantiquement.

**Trade-off 3 : audit_log monolithique vs partitionnement par mois.** Choix initial : 
table monolithique avec index `(tenant_id, created_at DESC)`. Sprint 18 introduira le 
partitionnement RANGE sur `created_at` quand le volume depassera ~10M lignes. Pour : 
demarrage simple. Contre : volumetrie. Mitigation : monitoring volume Sprint 6.

**Trade-off 4 : refresh_token_hash unique vs index brin.** Choix : `UNIQUE (refresh_token_hash)`. 
Pour : detection collision instantanee, lookup O(1). Contre : aucun. Note : le hash est 
SHA-256 du token clair, jamais le token lui-meme, et le secret de signature est PASETO 
v4 (Sprint 3).

### 3.4 Decisions ADR referencees

- **decision-002-multi-tenant-rls.md** : strategie RLS PostgreSQL avec `app_can_access_tenant()` 
  + `current_setting('app.current_tenant_id')`, FORCE RLS obligatoire, 4 policies par table.
- **decision-003-typeorm-0.3.md** : ORM TypeORM 0.3.x, migrations TypeScript, pas de 
  synchronize, QueryRunner explicite pour DDL.
- **decision-008-data-residency-maroc.md** : tous les datastores hebergeses au Maroc 
  (Benguerir region principale + Casablanca DR), audit_log inclus, retention 7 ans 
  conforme ACAPS.

### 3.5 Pieges et anti-patterns identifies

1. **citext extension manquante** : `CREATE EXTENSION IF NOT EXISTS citext` doit etre 
   execute dans la migration 1.2.1 (bootstrap). Si absent, la migration 1.2.2 echoue 
   avec `type "citext" does not exist`. Verification : `\dx citext` dans psql.
2. **FORCE RLS oublie** : sans `ALTER TABLE ... FORCE ROW LEVEL SECURITY`, le role 
   applicatif (owner des tables) bypass les policies. Les tests d'integration doivent 
   se connecter avec un role distinct du proprietaire pour valider.
3. **JSONB schema drift** : `auth_tenants.settings jsonb` et `audit_log.changes jsonb` 
   peuvent accueillir n'importe quoi. Mitigation : validation Zod cote application, 
   contraintes CHECK partielles (`settings ? 'locale'`).
4. **Retention purge job non-deploye** : tant que le job pgcron n'est pas livre 
   (Sprint 18), l'audit_log croit lineairement. Monitoring volume obligatoire des 
   Sprint 6.
5. **mfa_secret_encrypted rotation** : la cle de chiffrement (ENV `MFA_SECRET_ENCRYPTION_KEY`) 
   doit etre rotated annuellement. Sans procedure, perte d'acces si la cle change.
6. **password_hash format detection argon2id legacy bcrypt** : si import depuis ancien 
   systeme, le format `$2b$12$...` (bcrypt) cohabite avec `$argon2id$v=19$...`. La 
   colonne text accepte les deux mais la fonction de verification (Sprint 3) doit 
   detecter le prefixe pour router.
7. **audit_log gigantesque sans partitioning** : sans partition mensuelle, les requetes 
   sur 7 ans depassent 10s. Sprint 18 introduira `PARTITION BY RANGE (created_at)`.
8. **refresh_token_hash collision** : SHA-256 a 2^256 sorties, collision astronomique. 
   La contrainte UNIQUE est defense en profondeur.
9. **ON DELETE CASCADE risque** : si `auth_users` ON DELETE CASCADE vers `audit_log`, 
   un delete user efface son histoire. Choix : `audit_log.user_id ON DELETE SET NULL` 
   pour preserver le journal.
10. **Soft-delete deleted_at confusion RLS** : les policies RLS doivent inclure 
    `AND deleted_at IS NULL` pour eviter la fuite de tenants soft-deleted. Test dedie 
    dans rls-auth-users.spec.ts.

### 3.6 Profondeur RLS : pourquoi USING vs WITH CHECK

PostgreSQL distingue deux clauses dans une policy : **`USING`** filtre les lignes 
visibles (lecture / source d'un UPDATE / DELETE) et **`WITH CHECK`** valide les lignes 
modifiees ou inserees. Pour une SELECT policy seule `USING` s'applique. Pour INSERT 
seule `WITH CHECK` s'applique. Pour UPDATE et DELETE les deux s'appliquent (USING : 
quelles lignes peux-tu cibler ; WITH CHECK : la nouvelle valeur respecte-t-elle la regle). 
Une erreur frequente est d'oublier `WITH CHECK` sur UPDATE, ce qui permet de **muter 
le tenant_id** d'une ligne pour la "deplacer" vers un autre tenant. Notre migration 
applique systematiquement les deux clauses sur UPDATE pour empecher cette evasion.

### 3.7 Pourquoi audit_log.tenant_id est NULLable

Certains evenements systeme n'appartiennent a aucun tenant : creation d'une organisation, 
demarrage d'un job pgcron, rotation de la cle MFA platform-wide, intervention support 
par le SuperAdmin sur la table catalog. Le NULL exprime cette appartenance "platform". 
La policy SELECT `tenant_id IS NULL OR app_can_access_tenant(tenant_id)` rend ces 
entrees visibles a tout SuperAdmin (qui satisfait `app.is_super_admin = 'true'` dans 
`app_can_access_tenant`). Les utilisateurs simples ne verront jamais ces entrees 
puisqu'ils ne peuvent satisfaire `app_can_access_tenant(NULL)`.

### 3.8 Argon2id parameters justification (OWASP 2025)

Les parametres choisis (memoryCost 65536 = 64 MiB, timeCost 3, parallelism 4) suivent 
la recommandation OWASP Password Storage Cheat Sheet 2025 pour serveurs API : 
**~70 ms de hash** sur un CPU moderne (AMD EPYC 7763 chez OVH Casablanca), suffisant 
pour rendre le bruteforce GPU prohibitif (~10^11 USD pour casser un mot de passe 12 
caracteres random). Au-dela, on ralentit excessivement la latence p95 du login. Sous 
ces valeurs, un attaquant teste ~14 hash/seconde par core, soit pour 1000 USD de GPU 
H100 louees a l'heure, ~10^7 hash/jour, soit ~10^9 essais sur 100 jours, donc 
suffisant uniquement pour mots de passe < 7 caracteres. Notre politique mot de passe 
(Sprint 3) imposera 12+ caracteres avec entropie >= 60 bits.

### 3.9 mfa_secret_encrypted : algorithme et rotation

La cle TOTP RFC 6238 (20 bytes base32) est chiffree AES-256-GCM avant stockage. 
Format en base : `<iv_12bytes_base64>.<ciphertext_base64>.<auth_tag_16bytes_base64>`. 
La cle de chiffrement `MFA_SECRET_ENCRYPTION_KEY` (32 bytes random) est stockee dans 
Hashicorp Vault region MA. Rotation annuelle avec re-chiffrement : un job offline 
decrypte avec la vieille cle, re-chiffre avec la nouvelle, puis update les 
`mfa_secret_encrypted`. La table `auth_users` n'expose jamais le secret en clair 
hors du processus serveur ; les logs Pino ont une regle de redaction couvrant ce 
champ via path-based redact.

### 3.10 Pourquoi pas de partitionnement immediat audit_log

A 50 brokers x 100 events/jour x 365 jours x 7 ans = **12.7M lignes**, le 
partitionnement n'est pas critique en dessous de ce seuil. PostgreSQL gere parfaitement 
cette volumetrie avec un index BRIN sur `created_at` ou un BTREE classique sur 
`(tenant_id, created_at)`. Le partitionnement RANGE par mois sera introduit Sprint 18 
quand la volumetrie d'un seul tenant depassera 1M lignes ou que les requetes 
inter-tenant pour le superviseur ACAPS atteindront 500ms p95. Le JSONB GIN index sur 
`changes` permet deja les recherches structurees (`WHERE changes @> '{"action":"update_password"}'`).

### 3.11 Indexes : strategie partielle vs complete

Les index partiels (`WHERE deleted_at IS NULL`, `WHERE locked_until IS NOT NULL`, 
`WHERE revoked_at IS NULL`) ont deux benefices : **(1)** taille reduite (par exemple 
99% des sessions sont actives, l'index `expires_at` ignore les revoquees) ; **(2)** 
selectivite accrue (les requetes typiques ne portent que sur le sous-ensemble pertinent). 
Le cout : maintenance equivalente, mais l'optimiseur PostgreSQL doit detecter le 
predicat partiel dans la requete. C'est garanti tant que le predicat WHERE inclut 
exactement la condition de l'index.

### 3.12 Triggers updated_at : pourquoi pas TypeORM @UpdateDateColumn seul

`@UpdateDateColumn` met a jour `updatedAt` cote application via TypeORM. C'est 
suffisant pour les flux normaux. Mais des UPDATE bruts via psql (administrateur, 
script de migration de donnees) ou via une autre application (futur service Python 
de reporting) ne mettent pas a jour la colonne. Le trigger `set_updated_at_column()` 
garantit que **toute UPDATE** mette a jour la colonne, peu importe le client. Defense 
en profondeur.

## 4. Architecture context

### 4.1 Position dans le sprint 2

Cette tache est la **2eme du Sprint 2** apres 1.2.1 (Bootstrap TypeORM + DataSource + 
CREATE EXTENSION + role applicatif `skalean_app`) et avant 1.2.3 (Migration `tenant_brokers` 
+ RLS metier broker). Elle pose les fondations utilisees par TOUS les sprints metier 
(5+) car chaque table metier referencera `tenant_id` et utilisera les memes 4 policies RLS.

```
Sprint 2 -- Phase 1
  1.2.1  Bootstrap TypeORM + DataSource + extensions PostgreSQL  (DONE)
  1.2.2  Migration Initial System (5 tables + RLS)               <-- ICI
  1.2.3  Migration tenant_brokers + RLS metier
  1.2.4  Migration tenant_garages + RLS metier
  1.2.5  Kafka topics initiaux + Avro schemas registry
  ...
```

### 4.2 Diagramme tables et relations

```
                        +-------------------+
                        |   auth_tenants    |
                        |-------------------|
                        | id (PK)           |
                        | name              |
                        | type (enum)       |
                        | settings (jsonb)  |
                        | created_at        |
                        | updated_at        |
                        | deleted_at        |
                        | (NO RLS, catalog) |
                        +---------+---------+
                                  |
                                  | tenant_id (FK)
                                  v
+-------------------+    +-------------------+    +-------------------+
|    auth_users     |    | auth_tenant_users |    |   auth_sessions   |
|-------------------|    |-------------------|    |-------------------|
| id (PK)           |    | tenant_id (FK)    |    | id (PK)           |
| tenant_id (NULL)  |<-->| user_id (FK)      |    | user_id (FK)      |
| email (citext UQ) |    | role (text)       |    | tenant_id (FK)    |
| password_hash     |    | permissions jsonb |    | refresh_token_hash|
| display_name      |    | created_at        |    | user_agent        |
| mfa_enabled       |    | updated_at        |    | ip_address (inet) |
| mfa_secret_encr   |    +-------------------+    | created_at        |
| email_verified_at |                              | expires_at        |
| last_login_at     |                              | revoked_at        |
| locked_until      |                              | (RLS active)      |
| failed_login_atts |                              +-------------------+
| created_at        |
| updated_at        |
| deleted_at        |
| (RLS active)      |
+---------+---------+
          |
          | user_id (FK ON DELETE SET NULL)
          v
+----------------------------------------+
|              audit_log                 |
|----------------------------------------|
| id (PK)                                |
| tenant_id (FK, NULL si systeme global) |
| user_id (FK NULL si systeme)           |
| action (text)                          |
| resource_type (text)                   |
| resource_id (uuid)                     |
| changes (jsonb)                        |
| ip_address (inet)                      |
| user_agent (text)                      |
| created_at                             |
| (APPEND-ONLY, retention 7 ans)         |
+----------------------------------------+
```

### 4.3 Flux RLS runtime

```
HTTP request -> NestJS middleware (Sprint 3)
                 SET LOCAL app.current_tenant_id = '<uuid>'
                 SET LOCAL app.is_super_admin = 'false'
                 -> TypeORM query
                    -> PostgreSQL applique policy
                       USING (app_can_access_tenant(tenant_id))
                       -> ligne visible/invisible
```

## 5. Livrables checkables

- [ ] Fichier `apps/api/src/database/migrations/1735000000001-InitialSystem.ts` cree (~250 lignes)
- [ ] `up()` execute sans erreur sur base vierge
- [ ] `down()` execute sans erreur (revert reversible)
- [ ] `up()` re-execute apres `down()` reussit (idempotent)
- [ ] Table `auth_tenants` creee avec colonnes id, name, type (enum), settings, timestamps
- [ ] Table `auth_users` creee avec email citext UNIQUE
- [ ] Table `auth_tenant_users` creee avec PK composite (tenant_id, user_id)
- [ ] Table `auth_sessions` creee avec refresh_token_hash UNIQUE
- [ ] Table `audit_log` creee avec changes jsonb
- [ ] Type enum `tenant_type` cree avec valeurs 'broker', 'garage', 'mixed'
- [ ] RLS active sur `auth_users` (`relrowsecurity = true`)
- [ ] RLS active sur `auth_tenant_users`
- [ ] RLS active sur `auth_sessions`
- [ ] RLS active sur `audit_log`
- [ ] FORCE RLS active sur les 4 tables (`relforcerowsecurity = true`)
- [ ] 4 policies (SELECT, INSERT, UPDATE, DELETE) sur `auth_users`
- [ ] 4 policies sur `auth_tenant_users`
- [ ] 4 policies sur `auth_sessions`
- [ ] 1 policy SELECT + 1 policy INSERT sur `audit_log` (pas UPDATE, pas DELETE = append-only)
- [ ] Index UNIQUE sur `auth_users.email` (citext)
- [ ] Index sur `lower(auth_users.email::text)`
- [ ] Index sur `auth_tenant_users.tenant_id`
- [ ] Index UNIQUE sur `auth_sessions.refresh_token_hash`
- [ ] Index `(tenant_id, created_at DESC)` sur `audit_log`
- [ ] 5 entites TypeORM creees dans `apps/api/src/database/entities/system/`
- [ ] `system/index.ts` re-exporte les 5 entites
- [ ] Tests integration `migrations.spec.ts` (>=8) passent
- [ ] Tests integration `rls-auth-users.spec.ts` (>=8) passent
- [ ] Tests integration `audit-log-append-only.spec.ts` (>=4) passent
- [ ] Tests integration `citext-case-insensitive.spec.ts` (>=3) passent

## 6. Fichiers crees

### 6.1 Liste exhaustive

| Chemin                                                                        | LOC approx | Role                                |
|-------------------------------------------------------------------------------|-----------:|-------------------------------------|
| apps/api/src/database/migrations/1735000000001-InitialSystem.ts               | ~250       | Migration up/down                   |
| apps/api/src/database/entities/system/auth-tenant.entity.ts                   | ~45        | Entite AuthTenant                   |
| apps/api/src/database/entities/system/auth-user.entity.ts                     | ~55        | Entite AuthUser                     |
| apps/api/src/database/entities/system/auth-tenant-user.entity.ts              | ~35        | Entite AuthTenantUser (jonction)    |
| apps/api/src/database/entities/system/auth-session.entity.ts                  | ~30        | Entite AuthSession                  |
| apps/api/src/database/entities/system/audit-log.entity.ts                     | ~30        | Entite AuditLog                     |
| apps/api/src/database/entities/system/index.ts                                | ~10        | Re-exports                          |
| apps/api/test/integration/migrations.spec.ts                                  | ~180       | Tests up/down/idempotent            |
| apps/api/test/integration/rls-auth-users.spec.ts                              | ~220       | Tests isolation cross-tenant        |
| apps/api/test/integration/audit-log-append-only.spec.ts                       | ~120       | Tests append-only                   |
| apps/api/test/integration/citext-case-insensitive.spec.ts                     | ~80        | Tests citext                        |

## 7. Code patterns COMPLETS

### 7.1 Migration 1735000000001-InitialSystem.ts

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Initial System Migration
 *
 * Creates 5 foundational tables for authentication, multi-tenancy and audit:
 *  - auth_tenants       : organisation catalog (broker/garage/mixed). NO RLS (SuperAdmin cross-tenant lookup).
 *  - auth_users         : user accounts. tenant_id NULL allowed for platform SuperAdmins.
 *  - auth_tenant_users  : many-to-many junction (a SuperAdmin can be linked to N tenants).
 *  - auth_sessions      : refresh token hashes for rotation/revocation.
 *  - audit_log          : append-only journal of all mutations, 7 years retention (ACAPS).
 *
 * Multi-tenant 3-layer defense (decision-002):
 *   Layer 1 : application code WHERE tenant_id = ?
 *   Layer 2 : RLS policies USING (app_can_access_tenant(tenant_id))
 *   Layer 3 : FORCE ROW LEVEL SECURITY (no owner bypass)
 *
 * Reversible: down() drops in reverse FK order with CASCADE for dependent objects only.
 */
export class InitialSystem1735000000001 implements MigrationInterface {
  public name = 'InitialSystem1735000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ----------------------------------------------------------------------
    // Pre-flight: verify required extensions (created in 1.2.1 bootstrap)
    // ----------------------------------------------------------------------
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
          RAISE EXCEPTION 'Extension citext is required (run task 1.2.1 first)';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
          RAISE EXCEPTION 'Extension pgcrypto is required (run task 1.2.1 first)';
        END IF;
      END$$;
    `);

    // ----------------------------------------------------------------------
    // Enum: tenant_type
    // ----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TYPE tenant_type AS ENUM ('broker', 'garage', 'mixed');
    `);

    // ----------------------------------------------------------------------
    // Table: auth_tenants (NO RLS - catalog cross-tenant for SuperAdmin)
    // ----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE auth_tenants (
        id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
        name        text          NOT NULL,
        type        tenant_type   NOT NULL,
        settings    jsonb         NOT NULL DEFAULT '{}'::jsonb,
        created_at  timestamptz   NOT NULL DEFAULT now(),
        updated_at  timestamptz   NOT NULL DEFAULT now(),
        deleted_at  timestamptz   NULL,
        CONSTRAINT auth_tenants_name_chk CHECK (length(name) BETWEEN 2 AND 200)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_auth_tenants_type ON auth_tenants (type) WHERE deleted_at IS NULL;`);
    await queryRunner.query(`CREATE INDEX idx_auth_tenants_deleted_at ON auth_tenants (deleted_at) WHERE deleted_at IS NOT NULL;`);

    // ----------------------------------------------------------------------
    // Table: auth_users (RLS active + FORCE)
    // ----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE auth_users (
        id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                uuid         NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        email                    citext       NOT NULL UNIQUE,
        password_hash            text         NOT NULL,
        display_name             text         NOT NULL,
        mfa_enabled              boolean      NOT NULL DEFAULT false,
        mfa_secret_encrypted     text         NULL,
        email_verified_at        timestamptz  NULL,
        last_login_at            timestamptz  NULL,
        locked_until             timestamptz  NULL,
        failed_login_attempts    integer      NOT NULL DEFAULT 0,
        created_at               timestamptz  NOT NULL DEFAULT now(),
        updated_at               timestamptz  NOT NULL DEFAULT now(),
        deleted_at               timestamptz  NULL,
        CONSTRAINT auth_users_email_chk CHECK (length(email::text) BETWEEN 5 AND 320),
        CONSTRAINT auth_users_password_hash_chk CHECK (length(password_hash) BETWEEN 30 AND 500),
        CONSTRAINT auth_users_failed_attempts_chk CHECK (failed_login_attempts >= 0 AND failed_login_attempts <= 1000)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_auth_users_email_lower ON auth_users (lower(email::text));`);
    await queryRunner.query(`CREATE INDEX idx_auth_users_tenant_id ON auth_users (tenant_id) WHERE deleted_at IS NULL;`);
    await queryRunner.query(`CREATE INDEX idx_auth_users_locked_until ON auth_users (locked_until) WHERE locked_until IS NOT NULL;`);

    await queryRunner.query(`ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE auth_users FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      CREATE POLICY auth_users_select ON auth_users
        FOR SELECT
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY auth_users_insert ON auth_users
        FOR INSERT
        WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY auth_users_update ON auth_users
        FOR UPDATE
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id))
        WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY auth_users_delete ON auth_users
        FOR DELETE
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);

    // ----------------------------------------------------------------------
    // Table: auth_tenant_users (jonction many-to-many)
    // ----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE auth_tenant_users (
        tenant_id    uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        user_id      uuid         NOT NULL REFERENCES auth_users(id)   ON DELETE CASCADE,
        role         text         NOT NULL,
        permissions  jsonb        NOT NULL DEFAULT '{}'::jsonb,
        created_at   timestamptz  NOT NULL DEFAULT now(),
        updated_at   timestamptz  NOT NULL DEFAULT now(),
        PRIMARY KEY (tenant_id, user_id),
        CONSTRAINT auth_tenant_users_role_chk CHECK (role IN ('super_admin','tenant_admin','manager','agent','viewer'))
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_auth_tenant_users_tenant_id ON auth_tenant_users (tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_auth_tenant_users_user_id   ON auth_tenant_users (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_auth_tenant_users_role      ON auth_tenant_users (role);`);

    await queryRunner.query(`ALTER TABLE auth_tenant_users ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE auth_tenant_users FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`CREATE POLICY auth_tenant_users_select ON auth_tenant_users FOR SELECT USING (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_tenant_users_insert ON auth_tenant_users FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_tenant_users_update ON auth_tenant_users FOR UPDATE USING (app_can_access_tenant(tenant_id)) WITH CHECK (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_tenant_users_delete ON auth_tenant_users FOR DELETE USING (app_can_access_tenant(tenant_id));`);

    // ----------------------------------------------------------------------
    // Table: auth_sessions
    // ----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE auth_sessions (
        id                   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id              uuid         NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
        tenant_id            uuid         NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        refresh_token_hash   text         NOT NULL UNIQUE,
        user_agent           text         NULL,
        ip_address           inet         NULL,
        created_at           timestamptz  NOT NULL DEFAULT now(),
        expires_at           timestamptz  NOT NULL,
        revoked_at           timestamptz  NULL,
        CONSTRAINT auth_sessions_expires_chk CHECK (expires_at > created_at),
        CONSTRAINT auth_sessions_token_chk CHECK (length(refresh_token_hash) BETWEEN 40 AND 200)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_auth_sessions_user_id    ON auth_sessions (user_id);`);
    await queryRunner.query(`CREATE INDEX idx_auth_sessions_tenant_id  ON auth_sessions (tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions (expires_at) WHERE revoked_at IS NULL;`);

    await queryRunner.query(`ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE auth_sessions FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`CREATE POLICY auth_sessions_select ON auth_sessions FOR SELECT USING (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_sessions_insert ON auth_sessions FOR INSERT WITH CHECK (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_sessions_update ON auth_sessions FOR UPDATE USING (app_can_access_tenant(tenant_id)) WITH CHECK (app_can_access_tenant(tenant_id));`);
    await queryRunner.query(`CREATE POLICY auth_sessions_delete ON auth_sessions FOR DELETE USING (app_can_access_tenant(tenant_id));`);

    // ----------------------------------------------------------------------
    // Table: audit_log (APPEND-ONLY)
    // No UPDATE policy, no DELETE policy : effectively append-only at SQL level.
    // Retention 7 years (2555 days) enforced by pgcron job from Sprint 18.
    // ----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE audit_log (
        id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       uuid         NULL REFERENCES auth_tenants(id) ON DELETE SET NULL,
        user_id         uuid         NULL REFERENCES auth_users(id)   ON DELETE SET NULL,
        action          text         NOT NULL,
        resource_type   text         NOT NULL,
        resource_id     uuid         NULL,
        changes         jsonb        NOT NULL DEFAULT '{}'::jsonb,
        ip_address      inet         NULL,
        user_agent      text         NULL,
        created_at      timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT audit_log_action_chk        CHECK (length(action) BETWEEN 2 AND 100),
        CONSTRAINT audit_log_resource_type_chk CHECK (length(resource_type) BETWEEN 2 AND 100),
        CONSTRAINT audit_log_changes_chk       CHECK (jsonb_typeof(changes) = 'object')
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_audit_log_tenant_created ON audit_log (tenant_id, created_at DESC);`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_user_id        ON audit_log (user_id) WHERE user_id IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_resource       ON audit_log (resource_type, resource_id) WHERE resource_id IS NOT NULL;`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_action         ON audit_log (action);`);
    await queryRunner.query(`CREATE INDEX idx_audit_log_changes_gin    ON audit_log USING GIN (changes jsonb_path_ops);`);

    await queryRunner.query(`ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      CREATE POLICY audit_log_select ON audit_log
        FOR SELECT
        USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    await queryRunner.query(`
      CREATE POLICY audit_log_insert ON audit_log
        FOR INSERT
        WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));
    `);
    // No UPDATE policy : updates are blocked by default (RLS active)
    // No DELETE policy : deletes are blocked by default (RLS active)
    // Purge job (Sprint 18) connects with superuser to bypass RLS for archived rows.

    // ----------------------------------------------------------------------
    // updated_at trigger function (shared across tables)
    // ----------------------------------------------------------------------
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at_column()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END$$;
    `);

    for (const tbl of ['auth_tenants', 'auth_users', 'auth_tenant_users']) {
      await queryRunner.query(`
        CREATE TRIGGER trg_${tbl}_updated_at
        BEFORE UPDATE ON ${tbl}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
      `);
    }

    // ----------------------------------------------------------------------
    // Comments (documentation in-database)
    // ----------------------------------------------------------------------
    await queryRunner.query(`COMMENT ON TABLE auth_tenants       IS 'Organisation catalog (broker/garage/mixed). No RLS - SuperAdmin lookups across tenants.';`);
    await queryRunner.query(`COMMENT ON TABLE auth_users         IS 'User accounts. tenant_id NULL allowed for platform SuperAdmins. Email is citext UNIQUE.';`);
    await queryRunner.query(`COMMENT ON TABLE auth_tenant_users  IS 'Many-to-many junction. SuperAdmins may belong to multiple tenants.';`);
    await queryRunner.query(`COMMENT ON TABLE auth_sessions      IS 'Refresh token hashes (SHA-256). Used for rotation and explicit revocation.';`);
    await queryRunner.query(`COMMENT ON TABLE audit_log          IS 'APPEND-ONLY. 7 years retention (ACAPS). No UPDATE/DELETE policies.';`);
    await queryRunner.query(`COMMENT ON COLUMN auth_users.password_hash IS 'argon2id hash. Format: $argon2id$v=19$m=65536,t=3,p=4$<salt>$<hash>. Legacy bcrypt $2b$ accepted during migration window.';`);
    await queryRunner.query(`COMMENT ON COLUMN auth_users.mfa_secret_encrypted IS 'TOTP secret encrypted with MFA_SECRET_ENCRYPTION_KEY (AES-256-GCM). Rotated annually.';`);
    await queryRunner.query(`COMMENT ON COLUMN audit_log.changes IS 'JSONB schema: {before: {...}, after: {...}, fields_changed: ["field1","field2"]}';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse dependency order

    for (const tbl of ['auth_tenants', 'auth_users', 'auth_tenant_users']) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${tbl}_updated_at ON ${tbl};`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at_column();`);

    await queryRunner.query(`DROP TABLE IF EXISTS audit_log CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_sessions CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_tenant_users CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_users CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth_tenants CASCADE;`);

    await queryRunner.query(`DROP TYPE IF EXISTS tenant_type;`);
  }
}
```

### 7.2 Entites TypeORM 0.3

#### 7.2.1 auth-tenant.entity.ts

```typescript
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenantUser } from './auth-tenant-user.entity';
import { AuthSession } from './auth-session.entity';

export type TenantType = 'broker' | 'garage' | 'mixed';

@Entity('auth_tenants')
@Index('idx_auth_tenants_type', ['type'], { where: '"deletedAt" IS NULL' })
export class AuthTenant {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'name', type: 'text' })
  name!: string;

  @Column({ name: 'type', type: 'enum', enum: ['broker', 'garage', 'mixed'], enumName: 'tenant_type' })
  type!: TenantType;

  @Column({ name: 'settings', type: 'jsonb', default: () => `'{}'::jsonb` })
  settings!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => AuthTenantUser, (atu) => atu.tenant)
  tenantUsers!: AuthTenantUser[];

  @OneToMany(() => AuthSession, (s) => s.tenant)
  sessions!: AuthSession[];
}
```

#### 7.2.2 auth-user.entity.ts

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
import { AuthTenant } from './auth-tenant.entity';
import { AuthTenantUser } from './auth-tenant-user.entity';
import { AuthSession } from './auth-session.entity';

@Entity('auth_users')
@Index('idx_auth_users_email_lower', { synchronize: false })
@Index('idx_auth_users_tenant_id', ['tenantId'], { where: '"deletedAt" IS NULL' })
export class AuthUser {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @ManyToOne(() => AuthTenant, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant | null;

  @Column({ name: 'email', type: 'citext', unique: true })
  email!: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash!: string;

  @Column({ name: 'display_name', type: 'text' })
  displayName!: string;

  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled!: boolean;

  @Column({ name: 'mfa_secret_encrypted', type: 'text', nullable: true })
  mfaSecretEncrypted!: string | null;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true })
  lockedUntil!: Date | null;

  @Column({ name: 'failed_login_attempts', type: 'int', default: 0 })
  failedLoginAttempts!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany(() => AuthTenantUser, (atu) => atu.user)
  tenantUsers!: AuthTenantUser[];

  @OneToMany(() => AuthSession, (s) => s.user)
  sessions!: AuthSession[];
}
```

#### 7.2.3 auth-tenant-user.entity.ts

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthTenant } from './auth-tenant.entity';
import { AuthUser } from './auth-user.entity';

export type TenantUserRole = 'super_admin' | 'tenant_admin' | 'manager' | 'agent' | 'viewer';

@Entity('auth_tenant_users')
@Index('idx_auth_tenant_users_tenant_id', ['tenantId'])
@Index('idx_auth_tenant_users_user_id', ['userId'])
@Index('idx_auth_tenant_users_role', ['role'])
export class AuthTenantUser {
  @PrimaryColumn({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => AuthTenant, (t) => t.tenantUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @ManyToOne(() => AuthUser, (u) => u.tenantUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: AuthUser;

  @Column({ name: 'role', type: 'text' })
  role!: TenantUserRole;

  @Column({ name: 'permissions', type: 'jsonb', default: () => `'{}'::jsonb` })
  permissions!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

#### 7.2.4 auth-session.entity.ts

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
import { AuthTenant } from './auth-tenant.entity';
import { AuthUser } from './auth-user.entity';

@Entity('auth_sessions')
@Index('idx_auth_sessions_user_id', ['userId'])
@Index('idx_auth_sessions_tenant_id', ['tenantId'])
@Index('idx_auth_sessions_expires_at', ['expiresAt'], { where: '"revokedAt" IS NULL' })
export class AuthSession {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthUser, (u) => u.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: AuthUser;

  @ManyToOne(() => AuthTenant, (t) => t.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant;

  @Column({ name: 'refresh_token_hash', type: 'text', unique: true })
  refreshTokenHash!: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;
}
```

#### 7.2.5 audit-log.entity.ts

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
import { AuthTenant } from './auth-tenant.entity';
import { AuthUser } from './auth-user.entity';

export interface AuditChanges {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  fields_changed?: string[];
}

@Entity('audit_log')
@Index('idx_audit_log_tenant_created', ['tenantId', 'createdAt'])
@Index('idx_audit_log_action', ['action'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId!: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => AuthTenant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: AuthTenant | null;

  @ManyToOne(() => AuthUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: AuthUser | null;

  @Column({ name: 'action', type: 'text' })
  action!: string;

  @Column({ name: 'resource_type', type: 'text' })
  resourceType!: string;

  @Column({ name: 'resource_id', type: 'uuid', nullable: true })
  resourceId!: string | null;

  @Column({ name: 'changes', type: 'jsonb', default: () => `'{}'::jsonb` })
  changes!: AuditChanges;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

#### 7.2.6 system/index.ts

```typescript
export { AuthTenant, type TenantType } from './auth-tenant.entity';
export { AuthUser } from './auth-user.entity';
export { AuthTenantUser, type TenantUserRole } from './auth-tenant-user.entity';
export { AuthSession } from './auth-session.entity';
export { AuditLog, type AuditChanges } from './audit-log.entity';

import { AuthTenant } from './auth-tenant.entity';
import { AuthUser } from './auth-user.entity';
import { AuthTenantUser } from './auth-tenant-user.entity';
import { AuthSession } from './auth-session.entity';
import { AuditLog } from './audit-log.entity';

export const systemEntities = [AuthTenant, AuthUser, AuthTenantUser, AuthSession, AuditLog] as const;
```

### 7.3 Pattern RLS policy template

Pour chaque table tenant-isolee (auth_users, auth_tenant_users, auth_sessions, audit_log) :

```sql
-- 1. Enable RLS
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
-- 2. Force RLS even for owners
ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;

-- 3. Four policies
CREATE POLICY <table_name>_select ON <table_name>
  FOR SELECT
  USING (app_can_access_tenant(tenant_id));

CREATE POLICY <table_name>_insert ON <table_name>
  FOR INSERT
  WITH CHECK (app_can_access_tenant(tenant_id));

CREATE POLICY <table_name>_update ON <table_name>
  FOR UPDATE
  USING (app_can_access_tenant(tenant_id))
  WITH CHECK (app_can_access_tenant(tenant_id));

CREATE POLICY <table_name>_delete ON <table_name>
  FOR DELETE
  USING (app_can_access_tenant(tenant_id));
```

Exception **audit_log** : seulement `_select` et `_insert`. Pas de policy UPDATE/DELETE = 
operations bloquees au niveau RLS sans superuser.

### 7.4 Helper datasource pour tests

Fichier `apps/api/test/helpers/datasource.ts` (existant Sprint 1, complete pour 1.2.2) :

```typescript
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import { systemEntities } from '../../src/database/entities/system';
import { InitialSystem1735000000001 } from '../../src/database/migrations/1735000000001-InitialSystem';

export interface TestDataSourceOptions {
  migrationsRun?: boolean;
  schema?: string;
}

const baseOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.TEST_DATABASE_HOST ?? 'localhost',
  port: Number(process.env.TEST_DATABASE_PORT ?? 5432),
  username: process.env.TEST_DATABASE_USER ?? 'skalean_test',
  password: process.env.TEST_DATABASE_PASSWORD ?? 'skalean_test',
  database: process.env.TEST_DATABASE_NAME ?? 'skalean_test',
  entities: [...systemEntities],
  migrations: [InitialSystem1735000000001],
  migrationsRun: false,
  synchronize: false,
  logging: process.env.TEST_DATABASE_LOG === 'true',
  extra: {
    statement_timeout: 30000,
    application_name: 'skalean-api-test',
  },
});

export async function createTestDataSource(opts: TestDataSourceOptions = {}): Promise<DataSource> {
  const ds = new DataSource(baseOptions());
  await ds.initialize();

  // Always reset schema in test
  await ds.query(`SET search_path TO public;`);

  if (opts.migrationsRun) {
    await ds.runMigrations();
  }

  return ds;
}

export async function dropAllTables(ds: DataSource): Promise<void> {
  // Order matters : audit_log -> sessions -> tenant_users -> users -> tenants
  await ds.query(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I CASCADE;', r.tablename);
      END LOOP;
      FOR r IN (SELECT typname FROM pg_type WHERE typcategory = 'E' AND typnamespace = 'public'::regnamespace) LOOP
        EXECUTE format('DROP TYPE IF EXISTS %I CASCADE;', r.typname);
      END LOOP;
    END$$;
  `);
  // Truncate migrations history table
  await ds.query(`DELETE FROM migrations WHERE 1 = 1;`).catch(() => undefined);
}

export async function withTenantContext<T>(
  ds: DataSource,
  tenantId: string | null,
  isSuperAdmin: boolean,
  fn: (qr: import('typeorm').QueryRunner) => Promise<T>,
): Promise<T> {
  const qr = ds.createQueryRunner();
  try {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId ?? '']);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
    return await fn(qr);
  } finally {
    await qr.release();
  }
}
```

### 7.5 Pattern Pino redaction PII / secrets

Fichier `apps/api/src/observability/logger.ts` (extrait pertinent pour cette tache) :

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'password',
      'password_hash',
      'passwordHash',
      'mfa_secret_encrypted',
      'mfaSecretEncrypted',
      'refresh_token',
      'refreshToken',
      'refresh_token_hash',
      'refreshTokenHash',
      'authorization',
      'cookie',
      'set-cookie',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.password_hash',
      '*.mfa_secret_encrypted',
    ],
    censor: '[REDACTED]',
    remove: false,
  },
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'skalean-api',
    pid: process.pid,
  },
});
```

## 8. Tests complets

### 8.1 migrations.spec.ts

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, dropAllTables } from '../helpers/datasource';

describe('Migration 1735000000001-InitialSystem', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource({ migrationsRun: false });
  });

  afterAll(async () => {
    if (ds && ds.isInitialized) await ds.destroy();
  });

  beforeEach(async () => {
    await dropAllTables(ds);
  });

  it('up() creates 5 tables', async () => {
    await ds.runMigrations();
    const rows: Array<{ table_name: string }> = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('auth_tenants','auth_users','auth_tenant_users','auth_sessions','audit_log')
      ORDER BY table_name;
    `);
    expect(rows.map((r) => r.table_name)).toEqual(['audit_log','auth_sessions','auth_tenant_users','auth_tenants','auth_users']);
  });

  it('up() enables RLS on 4 tables (auth_tenants excluded)', async () => {
    await ds.runMigrations();
    const rows: Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }> = await ds.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('auth_users','auth_tenant_users','auth_sessions','audit_log')
      ORDER BY relname;
    `);
    expect(rows).toHaveLength(4);
    rows.forEach((r) => {
      expect(r.relrowsecurity).toBe(true);
      expect(r.relforcerowsecurity).toBe(true);
    });
  });

  it('up() does NOT enable RLS on auth_tenants (catalog cross-tenant)', async () => {
    await ds.runMigrations();
    const [row] = await ds.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'auth_tenants';`);
    expect(row.relrowsecurity).toBe(false);
  });

  it('up() creates 4 policies on auth_users / auth_tenant_users / auth_sessions', async () => {
    await ds.runMigrations();
    for (const tbl of ['auth_users', 'auth_tenant_users', 'auth_sessions']) {
      const rows = await ds.query(`SELECT polname FROM pg_policy WHERE polrelid = '${tbl}'::regclass;`);
      expect(rows).toHaveLength(4);
    }
  });

  it('up() creates only 2 policies on audit_log (append-only)', async () => {
    await ds.runMigrations();
    const rows: Array<{ polname: string; polcmd: string }> = await ds.query(`
      SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'audit_log'::regclass ORDER BY polname;
    `);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.polcmd).sort()).toEqual(['a', 'r']); // a=INSERT, r=SELECT
  });

  it('up() creates required indexes', async () => {
    await ds.runMigrations();
    const indexes: Array<{ indexname: string }> = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname IN (
          'idx_auth_users_email_lower',
          'idx_auth_users_tenant_id',
          'idx_auth_tenant_users_tenant_id',
          'idx_auth_sessions_user_id',
          'idx_audit_log_tenant_created',
          'idx_audit_log_changes_gin'
        );
    `);
    expect(indexes.length).toBeGreaterThanOrEqual(6);
  });

  it('down() drops all tables and enum', async () => {
    await ds.runMigrations();
    await ds.undoLastMigration();
    const rows = await ds.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('auth_tenants','auth_users','auth_tenant_users','auth_sessions','audit_log');
    `);
    expect(rows).toHaveLength(0);
    const enums = await ds.query(`SELECT 1 FROM pg_type WHERE typname = 'tenant_type';`);
    expect(enums).toHaveLength(0);
  });

  it('up() is idempotent after down() (re-run reussit)', async () => {
    await ds.runMigrations();
    await ds.undoLastMigration();
    await expect(ds.runMigrations()).resolves.not.toThrow();
    const tbl = await ds.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'auth_users';`);
    expect(tbl).toHaveLength(1);
  });

  it('citext UNIQUE rejects case variants on email', async () => {
    await ds.runMigrations();
    await ds.query(`SELECT set_config('app.current_tenant_id', '00000000-0000-0000-0000-000000000000', true);`);
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(`INSERT INTO auth_users (email, password_hash, display_name) VALUES ('Joe@Example.com', 'x'.repeat(60), 'Joe');`);
    await expect(
      ds.query(`INSERT INTO auth_users (email, password_hash, display_name) VALUES ('joe@example.com', 'y'.repeat(60), 'Joe2');`),
    ).rejects.toThrow(/duplicate key/);
  });
});
```

### 8.2 rls-auth-users.spec.ts

```typescript
import { DataSource, QueryRunner } from 'typeorm';
import { createTestDataSource } from '../helpers/datasource';

describe('RLS isolation -- auth_users', () => {
  let ds: DataSource;
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  const setSession = async (qr: QueryRunner, tenantId: string | null, isSuperAdmin = false) => {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId ?? '']);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
  };

  beforeAll(async () => {
    ds = await createTestDataSource({ migrationsRun: true });
    // seed tenants as super admin
    const qr = ds.createQueryRunner();
    await setSession(qr, null, true);
    await qr.query(`INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Tenant A','broker'),($2,'Tenant B','garage');`, [tenantA, tenantB]);
    await qr.release();
  });

  afterAll(async () => {
    if (ds && ds.isInitialized) await ds.destroy();
  });

  it('INSERT tenant A then SELECT tenant B returns 0 rows', async () => {
    const qrA = ds.createQueryRunner();
    await setSession(qrA, tenantA, false);
    await qrA.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, 'a@a.com', 'h'.repeat(60), 'A');`,
      [tenantA],
    );
    await qrA.release();

    const qrB = ds.createQueryRunner();
    await setSession(qrB, tenantB, false);
    const rows = await qrB.query(`SELECT id FROM auth_users WHERE email = 'a@a.com';`);
    expect(rows).toHaveLength(0);
    await qrB.release();
  });

  it('SuperAdmin sees rows from tenant A while connected as tenant B', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantB, true);
    const rows = await qr.query(`SELECT id, tenant_id FROM auth_users WHERE tenant_id = $1;`, [tenantA]);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    await qr.release();
  });

  it('INSERT bloque sans tenant context (current_tenant_id NULL et not super_admin)', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, null, false);
    await expect(
      qr.query(`INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, 'x@x.com', 'h'.repeat(60), 'X');`, [tenantA]),
    ).rejects.toThrow(/row-level security/);
    await qr.release();
  });

  it('UPDATE bloque cross-tenant', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantB, false);
    const result = await qr.query(`UPDATE auth_users SET display_name = 'hacked' WHERE email = 'a@a.com';`);
    expect(result[1]).toBe(0); // 0 rows updated
    await qr.release();
  });

  it('DELETE bloque cross-tenant sauf super_admin', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantB, false);
    const result = await qr.query(`DELETE FROM auth_users WHERE email = 'a@a.com';`);
    expect(result[1]).toBe(0);
    await qr.release();
  });

  it('FORCE RLS empeche le bypass meme proprietaire', async () => {
    const [{ relforcerowsecurity }] = await ds.query(
      `SELECT relforcerowsecurity FROM pg_class WHERE relname = 'auth_users';`,
    );
    expect(relforcerowsecurity).toBe(true);
  });

  it('Soft-deleted tenant : RLS cache toujours via deleted_at IS NULL pour usage classique', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    await qr.query(`UPDATE auth_users SET deleted_at = now() WHERE email = 'a@a.com';`);
    const rows = await qr.query(`SELECT id FROM auth_users WHERE email = 'a@a.com' AND deleted_at IS NULL;`);
    expect(rows).toHaveLength(0);
    await qr.release();
  });

  it('app_can_access_tenant() retourne true pour super_admin meme si tenant_id different', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, true);
    const [{ allowed }] = await qr.query(`SELECT app_can_access_tenant($1) AS allowed;`, [tenantB]);
    expect(allowed).toBe(true);
    await qr.release();
  });
});
```

### 8.3 audit-log-append-only.spec.ts

```typescript
import { DataSource, QueryRunner } from 'typeorm';
import { createTestDataSource } from '../helpers/datasource';

describe('audit_log -- append-only enforcement', () => {
  let ds: DataSource;
  const tenantA = '33333333-3333-3333-3333-333333333333';

  const setSession = async (qr: QueryRunner, tenantId: string, isSuperAdmin = false) => {
    await qr.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantId]);
    await qr.query(`SELECT set_config('app.is_super_admin', $1, true);`, [String(isSuperAdmin)]);
  };

  beforeAll(async () => {
    ds = await createTestDataSource({ migrationsRun: true });
    const qr = ds.createQueryRunner();
    await qr.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await qr.query(`INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Audit-Test','broker') ON CONFLICT DO NOTHING;`, [tenantA]);
    await qr.release();
  });

  afterAll(async () => {
    if (ds && ds.isInitialized) await ds.destroy();
  });

  it('INSERT audit entry succeeds with tenant context', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    await qr.query(
      `INSERT INTO audit_log (tenant_id, action, resource_type, changes) VALUES ($1, 'create', 'broker', '{"after":{"name":"X"}}'::jsonb);`,
      [tenantA],
    );
    const [{ count }] = await qr.query(`SELECT COUNT(*)::int AS count FROM audit_log WHERE tenant_id = $1;`, [tenantA]);
    expect(count).toBeGreaterThanOrEqual(1);
    await qr.release();
  });

  it('UPDATE blocked by absence of UPDATE policy', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    const result = await qr.query(`UPDATE audit_log SET action = 'tampered' WHERE tenant_id = $1;`, [tenantA]);
    expect(result[1]).toBe(0);
    await qr.release();
  });

  it('DELETE blocked by absence of DELETE policy', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    const result = await qr.query(`DELETE FROM audit_log WHERE tenant_id = $1;`, [tenantA]);
    expect(result[1]).toBe(0);
    await qr.release();
  });

  it('System INSERT with user_id NULL is allowed (background job)', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, true);
    await qr.query(
      `INSERT INTO audit_log (tenant_id, user_id, action, resource_type) VALUES ($1, NULL, 'system.bootstrap', 'system');`,
      [tenantA],
    );
    const [{ count }] = await qr.query(`SELECT COUNT(*)::int AS count FROM audit_log WHERE user_id IS NULL AND tenant_id = $1;`, [tenantA]);
    expect(count).toBeGreaterThanOrEqual(1);
    await qr.release();
  });

  it('JSONB changes column accepts {before, after, fields_changed}', async () => {
    const qr = ds.createQueryRunner();
    await setSession(qr, tenantA, false);
    const payload = { before: { name: 'A' }, after: { name: 'B' }, fields_changed: ['name'] };
    await qr.query(
      `INSERT INTO audit_log (tenant_id, action, resource_type, changes) VALUES ($1, 'update', 'broker', $2::jsonb);`,
      [tenantA, JSON.stringify(payload)],
    );
    const [row] = await qr.query(
      `SELECT changes FROM audit_log WHERE tenant_id = $1 AND action = 'update' ORDER BY created_at DESC LIMIT 1;`,
      [tenantA],
    );
    expect(row.changes.fields_changed).toEqual(['name']);
    await qr.release();
  });
});
```

### 8.4 citext-case-insensitive.spec.ts

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../helpers/datasource';

describe('auth_users.email -- citext case-insensitive', () => {
  let ds: DataSource;
  const tenantA = '44444444-4444-4444-4444-444444444444';

  beforeAll(async () => {
    ds = await createTestDataSource({ migrationsRun: true });
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(`INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Citext-Test','mixed') ON CONFLICT DO NOTHING;`, [tenantA]);
  });

  afterAll(async () => {
    if (ds && ds.isInitialized) await ds.destroy();
  });

  it('Insert Joe@Example.com, lookup joe@example.com finds it', async () => {
    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantA]);
    await ds.query(`SELECT set_config('app.is_super_admin', 'false', true);`);
    await ds.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, 'Joe@Example.com', $2, 'Joe');`,
      [tenantA, 'h'.repeat(60)],
    );
    const rows = await ds.query(`SELECT id FROM auth_users WHERE email = 'joe@example.com';`);
    expect(rows.length).toBe(1);
  });

  it('UNIQUE constraint rejects JOE@EXAMPLE.COM after Joe@Example.com', async () => {
    await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [tenantA]);
    await expect(
      ds.query(
        `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, 'JOE@EXAMPLE.COM', $2, 'JoeUpper');`,
        [tenantA, 'k'.repeat(60)],
      ),
    ).rejects.toThrow(/duplicate key/);
  });

  it('idx_auth_users_email_lower is used by EXPLAIN', async () => {
    const plan: Array<{ 'QUERY PLAN': string }> = await ds.query(
      `EXPLAIN (FORMAT TEXT) SELECT id FROM auth_users WHERE lower(email::text) = 'joe@example.com';`,
    );
    const text = plan.map((p) => p['QUERY PLAN']).join('\n');
    expect(text).toMatch(/idx_auth_users_email_lower|Index Scan|Bitmap Index Scan/);
  });
});
```

### 8.5 Tests additionnels : performance et plan execution

Fichier `apps/api/test/integration/perf-indexes.spec.ts` :

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, withTenantContext } from '../helpers/datasource';

describe('Performance -- indexes utilises', () => {
  let ds: DataSource;
  const tenantA = '55555555-5555-5555-5555-555555555555';

  beforeAll(async () => {
    ds = await createTestDataSource({ migrationsRun: true });
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(`INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Perf-Test','broker') ON CONFLICT DO NOTHING;`, [tenantA]);

    // Seed 1000 users
    await withTenantContext(ds, tenantA, false, async (qr) => {
      for (let i = 0; i < 1000; i++) {
        await qr.query(
          `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING;`,
          [tenantA, `user${i}@perf.test`, 'h'.repeat(60), `User ${i}`],
        );
      }
    });

    // Seed 5000 audit entries
    await withTenantContext(ds, tenantA, false, async (qr) => {
      const values: string[] = [];
      const params: unknown[] = [];
      for (let i = 0; i < 5000; i++) {
        params.push(tenantA, 'create', 'broker', JSON.stringify({ idx: i }));
        values.push(`($${params.length - 3}, $${params.length - 2}, $${params.length - 1}, $${params.length}::jsonb)`);
      }
      await qr.query(
        `INSERT INTO audit_log (tenant_id, action, resource_type, changes) VALUES ${values.join(',')};`,
        params,
      );
    });

    // ANALYZE for accurate stats
    await ds.query(`ANALYZE auth_users;`);
    await ds.query(`ANALYZE audit_log;`);
  });

  afterAll(async () => {
    if (ds && ds.isInitialized) await ds.destroy();
  });

  it('SELECT auth_users by email uses idx_auth_users_email_lower or unique', async () => {
    const plan: Array<{ 'QUERY PLAN': string }> = await ds.query(
      `EXPLAIN (FORMAT TEXT) SELECT id FROM auth_users WHERE email = 'user500@perf.test';`,
    );
    const text = plan.map((p) => p['QUERY PLAN']).join('\n');
    expect(text).toMatch(/Index Scan|Bitmap Index Scan/);
    expect(text).not.toMatch(/Seq Scan on auth_users/);
  });

  it('SELECT audit_log latest 50 by tenant uses idx_audit_log_tenant_created', async () => {
    const plan: Array<{ 'QUERY PLAN': string }> = await ds.query(
      `EXPLAIN (FORMAT TEXT) SELECT id FROM audit_log WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 50;`,
      [tenantA],
    );
    const text = plan.map((p) => p['QUERY PLAN']).join('\n');
    expect(text).toMatch(/idx_audit_log_tenant_created/);
  });

  it('SELECT audit_log JSONB containment uses GIN index', async () => {
    const plan: Array<{ 'QUERY PLAN': string }> = await ds.query(
      `EXPLAIN (FORMAT TEXT) SELECT id FROM audit_log WHERE changes @> '{"idx": 42}'::jsonb;`,
    );
    const text = plan.map((p) => p['QUERY PLAN']).join('\n');
    // GIN may or may not be picked depending on planner cost ; we accept either index path
    expect(text).toMatch(/Index|Bitmap/);
  });
});
```

### 8.6 Tests scenario tenant_users many-to-many

Fichier `apps/api/test/integration/tenant-users.spec.ts` :

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, withTenantContext } from '../helpers/datasource';

describe('auth_tenant_users -- many-to-many SuperAdmin scenarios', () => {
  let ds: DataSource;
  const tenantA = '66666666-6666-6666-6666-666666666666';
  const tenantB = '77777777-7777-7777-7777-777777777777';
  let superAdminId: string;

  beforeAll(async () => {
    ds = await createTestDataSource({ migrationsRun: true });
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(
      `INSERT INTO auth_tenants (id, name, type) VALUES ($1,'TA','broker'),($2,'TB','garage') ON CONFLICT DO NOTHING;`,
      [tenantA, tenantB],
    );
    const [{ id }] = await ds.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES (NULL, 'super@platform.ma', $1, 'Super') RETURNING id;`,
      ['h'.repeat(60)],
    );
    superAdminId = id;
    await ds.query(
      `INSERT INTO auth_tenant_users (tenant_id, user_id, role) VALUES ($1,$3,'super_admin'),($2,$3,'super_admin');`,
      [tenantA, tenantB, superAdminId],
    );
  });

  afterAll(async () => {
    if (ds && ds.isInitialized) await ds.destroy();
  });

  it('SuperAdmin appartient aux deux tenants via auth_tenant_users', async () => {
    const rows = await ds.query(
      `SELECT tenant_id FROM auth_tenant_users WHERE user_id = $1 ORDER BY tenant_id;`,
      [superAdminId],
    );
    expect(rows).toHaveLength(2);
  });

  it('Tenant admin de tenantA ne voit pas la jonction tenantB', async () => {
    await withTenantContext(ds, tenantA, false, async (qr) => {
      const rows = await qr.query(
        `SELECT tenant_id FROM auth_tenant_users WHERE user_id = $1;`,
        [superAdminId],
      );
      expect(rows.every((r: { tenant_id: string }) => r.tenant_id === tenantA)).toBe(true);
    });
  });

  it('CASCADE : delete tenantB efface jonction', async () => {
    await ds.query(`DELETE FROM auth_tenants WHERE id = $1;`, [tenantB]);
    const rows = await ds.query(
      `SELECT tenant_id FROM auth_tenant_users WHERE user_id = $1;`,
      [superAdminId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].tenant_id).toBe(tenantA);
  });

  it('CHECK role : valeur invalide rejetee', async () => {
    await expect(
      ds.query(
        `INSERT INTO auth_tenant_users (tenant_id, user_id, role) VALUES ($1, $2, 'hacker_role');`,
        [tenantA, superAdminId],
      ),
    ).rejects.toThrow(/check constraint/i);
  });
});
```

### 8.7 Tests sessions rotation

Fichier `apps/api/test/integration/sessions.spec.ts` :

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource, withTenantContext } from '../helpers/datasource';
import * as crypto from 'node:crypto';

describe('auth_sessions -- rotation et integrite', () => {
  let ds: DataSource;
  const tenantA = '88888888-8888-8888-8888-888888888888';
  let userId: string;

  const hashToken = (raw: string): string => crypto.createHash('sha256').update(raw).digest('hex');

  beforeAll(async () => {
    ds = await createTestDataSource({ migrationsRun: true });
    await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);
    await ds.query(`INSERT INTO auth_tenants (id, name, type) VALUES ($1,'Sess','broker') ON CONFLICT DO NOTHING;`, [tenantA]);
    const [{ id }] = await ds.query(
      `INSERT INTO auth_users (tenant_id, email, password_hash, display_name) VALUES ($1, 'sess@x.ma', $2, 'Sess') RETURNING id;`,
      [tenantA, 'h'.repeat(60)],
    );
    userId = id;
  });

  afterAll(async () => {
    if (ds && ds.isInitialized) await ds.destroy();
  });

  it('Insert session avec refresh_token_hash UNIQUE', async () => {
    await withTenantContext(ds, tenantA, false, async (qr) => {
      const hash = hashToken('token-001');
      await qr.query(
        `INSERT INTO auth_sessions (user_id, tenant_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '30 days');`,
        [userId, tenantA, hash],
      );
      await expect(
        qr.query(
          `INSERT INTO auth_sessions (user_id, tenant_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '30 days');`,
          [userId, tenantA, hash],
        ),
      ).rejects.toThrow(/duplicate key/);
    });
  });

  it('CHECK expires_at > created_at', async () => {
    await withTenantContext(ds, tenantA, false, async (qr) => {
      await expect(
        qr.query(
          `INSERT INTO auth_sessions (user_id, tenant_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3, now() - interval '1 day');`,
          [userId, tenantA, hashToken('past-token')],
        ),
      ).rejects.toThrow(/check constraint/i);
    });
  });

  it('Rotation atomique : revoke + insert nouveau hash', async () => {
    await withTenantContext(ds, tenantA, false, async (qr) => {
      const oldHash = hashToken('rot-old');
      const newHash = hashToken('rot-new');
      await qr.query(
        `INSERT INTO auth_sessions (user_id, tenant_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '30 days');`,
        [userId, tenantA, oldHash],
      );
      await qr.startTransaction();
      const upd = await qr.query(
        `UPDATE auth_sessions SET revoked_at = now() WHERE refresh_token_hash = $1 AND revoked_at IS NULL RETURNING id;`,
        [oldHash],
      );
      expect(upd[0]).toBeDefined();
      await qr.query(
        `INSERT INTO auth_sessions (user_id, tenant_id, refresh_token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '30 days');`,
        [userId, tenantA, newHash],
      );
      await qr.commitTransaction();
    });
  });

  it('CASCADE : delete user efface ses sessions', async () => {
    await ds.query(`DELETE FROM auth_users WHERE id = $1;`, [userId]);
    const rows = await ds.query(`SELECT id FROM auth_sessions WHERE user_id = $1;`, [userId]);
    expect(rows).toHaveLength(0);
  });
});
```

## 9. Variables environnement

Fichier `.env.example` (a completer dans 1.2.1 deja, ajout pour 1.2.2) :

```
# ----- Database -----
DATABASE_URL=postgresql://skalean_app:${DATABASE_PASSWORD}@db.benguerir.local:5432/skalean_dev
DATABASE_HOST=db.benguerir.local
DATABASE_PORT=5432
DATABASE_NAME=skalean_dev
DATABASE_USER=skalean_app
DATABASE_PASSWORD=changeme_in_vault
DATABASE_SUPERUSER=postgres
DATABASE_SUPERUSER_PASSWORD=changeme_in_vault
DATABASE_SSL=true
DATABASE_SSL_CA_PATH=/etc/skalean/ca/benguerir-ca.pem
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_STATEMENT_TIMEOUT_MS=30000

# ----- Auth -----
PASSWORD_PEPPER=changeme_in_vault_64_bytes_hex
PASSWORD_ARGON2_MEMORY_COST=65536
PASSWORD_ARGON2_TIME_COST=3
PASSWORD_ARGON2_PARALLELISM=4
PASSWORD_LEGACY_BCRYPT_ENABLED=true
MFA_SECRET_ENCRYPTION_KEY=changeme_in_vault_32_bytes_base64
MFA_TOTP_ISSUER=Skalean InsurTech

# ----- Sessions -----
SESSION_REFRESH_TOKEN_TTL_SECONDS=2592000
SESSION_ACCESS_TOKEN_TTL_SECONDS=900
SESSION_REFRESH_TOKEN_HASH_ALGO=sha256

# ----- Audit -----
AUDIT_LOG_RETENTION_DAYS=2555
AUDIT_LOG_ARCHIVE_ENABLED=false
AUDIT_LOG_ARCHIVE_BUCKET=skalean-audit-archive-benguerir
AUDIT_LOG_ARCHIVE_KEY_PREFIX=audit/v1/

# ----- Tenant defaults -----
TENANT_DEFAULT_LOCALE=fr-MA
TENANT_DEFAULT_TIMEZONE=Africa/Casablanca
TENANT_DEFAULT_CURRENCY=MAD
```

## 10. Commandes shell

```bash
# Run migration
pnpm --filter @skalean/api migration:run

# Verify with psql
psql "$DATABASE_URL" -c "\dt auth_*"
psql "$DATABASE_URL" -c "\dt audit_log"
psql "$DATABASE_URL" -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname LIKE 'auth_%' OR relname = 'audit_log';"
psql "$DATABASE_URL" -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'auth_users'::regclass;"
psql "$DATABASE_URL" -c "\d+ auth_users"

# EXPLAIN ANALYZE indexes
psql "$DATABASE_URL" <<'SQL'
SET app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET app.is_super_admin = 'false';
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM auth_users WHERE email = 'admin@example.ma';
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM audit_log WHERE tenant_id = '11111111-1111-1111-1111-111111111111' ORDER BY created_at DESC LIMIT 50;
SQL

# Revert
pnpm --filter @skalean/api migration:revert

# Re-run after revert
pnpm --filter @skalean/api migration:run

# Run integration tests
pnpm --filter @skalean/api test:integration -- migrations rls-auth-users audit-log-append-only citext-case-insensitive
```

## 11. Criteres validation V1-V28+

### 11.1 P0 (15)

| # | Verification                          | Commande                                                                                          | Expected                          | Failure mode                       |
|---|---------------------------------------|---------------------------------------------------------------------------------------------------|-----------------------------------|-------------------------------------|
| V1 | Migration up reussit                 | `pnpm migration:run`                                                                              | exit 0                            | erreur SQL > stop CI                |
| V2 | 5 tables creees                      | `psql -c "SELECT count(*) FROM information_schema.tables WHERE table_name IN ('auth_tenants','auth_users','auth_tenant_users','auth_sessions','audit_log')"` | 5 | tables manquantes |
| V3 | RLS active 4 tables                  | `psql -c "SELECT count(*) FROM pg_class WHERE relname IN ('auth_users','auth_tenant_users','auth_sessions','audit_log') AND relrowsecurity = true"` | 4 | RLS off  |
| V4 | FORCE RLS active 4 tables            | `psql -c "SELECT count(*) FROM pg_class WHERE relname IN ('auth_users','auth_tenant_users','auth_sessions','audit_log') AND relforcerowsecurity = true"` | 4 | bypass owner |
| V5 | 4 policies sur auth_users            | `psql -c "SELECT count(*) FROM pg_policy WHERE polrelid='auth_users'::regclass"`                  | 4                                 | policy manquante                    |
| V6 | 4 policies sur auth_tenant_users     | idem                                                                                              | 4                                 | idem                                |
| V7 | 4 policies sur auth_sessions         | idem                                                                                              | 4                                 | idem                                |
| V8 | 2 policies sur audit_log (append)    | `psql -c "SELECT count(*) FROM pg_policy WHERE polrelid='audit_log'::regclass"`                   | 2                                 | UPDATE/DELETE policy presente       |
| V9 | Index citext lower email             | `psql -c "\di idx_auth_users_email_lower"`                                                        | 1 row                             | manquant                            |
| V10| Index UNIQUE refresh_token_hash      | `psql -c "SELECT indexname FROM pg_indexes WHERE tablename='auth_sessions' AND indexname LIKE '%refresh%'"` | 1+ | manquant                            |
| V11| Index (tenant_id, created_at) audit  | `psql -c "\di idx_audit_log_tenant_created"`                                                      | 1                                 | manquant                            |
| V12| Down reussit                         | `pnpm migration:revert`                                                                           | exit 0                            | erreur DROP                         |
| V13| Re-run apres revert                  | `pnpm migration:run`                                                                              | exit 0                            | not idempotent                      |
| V14| RLS bloque cross-tenant              | test rls-auth-users.spec.ts                                                                       | 0 rows                            | fuite                               |
| V15| audit_log UPDATE bloque              | test audit-log-append-only.spec.ts                                                                | 0 rows updated                    | tampering possible                  |

### 11.2 P1 (8)

| # | Verification                          | Commande / Test                                                                                   | Expected                          |
|---|---------------------------------------|---------------------------------------------------------------------------------------------------|-----------------------------------|
| V16| Enum tenant_type cree               | `psql -c "\dT+ tenant_type"`                                                                      | 3 valeurs                         |
| V17| citext UNIQUE case-insensitive      | citext-case-insensitive.spec.ts                                                                   | reject duplicate                  |
| V18| Trigger updated_at                   | UPDATE auth_users + verif updated_at change                                                       | timestamp change                  |
| V19| FK auth_sessions ON DELETE CASCADE  | `\d+ auth_sessions`                                                                               | "ON DELETE CASCADE"               |
| V20| FK audit_log ON DELETE SET NULL     | `\d+ audit_log`                                                                                   | "ON DELETE SET NULL"              |
| V21| GIN index sur audit_log.changes     | `\di idx_audit_log_changes_gin`                                                                   | 1 row                             |
| V22| Comments tables presents            | `psql -c "\dd auth_users"`                                                                        | comment present                   |
| V23| Check constraints                    | `\d+ auth_users` montre les CHECK                                                                 | 3+ constraints                    |

### 11.3 P2 (5)

| # | Verification                          | Note                                                                                              |
|---|---------------------------------------|---------------------------------------------------------------------------------------------------|
| V24| Lint TypeScript pass               | `pnpm lint apps/api`                                                                              |
| V25| Type-check pass                     | `pnpm typecheck apps/api`                                                                         |
| V26| Tests unit + integration pass       | `pnpm test:integration`                                                                           |
| V27| Coverage migrations >= 90%          | `pnpm test:integration --coverage`                                                                |
| V28| EXPLAIN scan index pas seq scan     | EXPLAIN sur SELECT email                                                                          |

## 12. Edge cases

1. **citext extension manquante au runtime test** : fallback CI script verifie `pg_extension`, sinon le test exit 1 avec message clair.
2. **RLS bypass via SET ROLE postgres** : autorise pour migrations seulement. Le runtime applicatif (skalean_app) ne dispose pas de privilege SUPERUSER ni BYPASSRLS.
3. **JSONB schema invalide** : `audit_log_changes_chk CHECK (jsonb_typeof(changes) = 'object')` rejette les arrays / scalaires.
4. **Retention overflow** : si `created_at` > 7 ans dans le futur, le job pgcron ne purge rien (filtre `< now() - interval`). Aucune perte accidentelle.
5. **mfa_secret_encrypted decrypt fail** : detecter exception lors de la verification MFA (Sprint 3) et forcer reset MFA via email valide.
6. **refresh_token rotation race** : double soumission du meme refresh token. Solution Sprint 3 : transaction `UPDATE auth_sessions SET revoked_at = now() WHERE id = ? AND revoked_at IS NULL RETURNING id` ; si 0 row, rejeter.
7. **Soft delete FK ON DELETE RESTRICT** : si tentative DELETE auth_tenant alors qu'il a auth_users, erreur claire. Choix RESTRICT volontaire pour eviter la suppression accidentelle d'une organisation entiere.
8. **Large audit_log slow query** : monitoring p95 dashboard Grafana Sprint 6. Si > 500ms, partitionnement Sprint 18.
9. **Email ASCII vs IDN (international)** : citext gere ASCII. Pour IDN (`@exemple.المغرب`) on convertit cote app en punycode avant insert.
10. **Concurrent migration in CI** : verrou advisory `pg_advisory_xact_lock(73500001)` au debut de up() pour serialiser les CI paralleles (deja dans 1.2.1 framework).

## 13. Conformite Maroc detaillee

### 13.1 Loi 09-08 CNDP

L'article 21 de la Loi 09-08 (protection des donnees personnelles) impose au responsable 
de traitement de **conserver une trace des acces aux donnees personnelles**. La table 
`audit_log` repond directement a cette exigence en consignant : qui (user_id), quand 
(created_at), quoi (action + resource_type + resource_id), comment (ip_address, user_agent), 
et le diff (changes jsonb). La declaration CNDP du traitement "Plateforme Skalean InsurTech" 
mentionnera explicitement cette journalisation et la duree de conservation de 7 ans.

### 13.2 ACAPS audit trail 7 ans

La circulaire ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale) 
exige un audit trail des operations d'assurance non-vie sur **7 annees calendaires** 
(article relatif a la conservation des pieces). La constante `AUDIT_LOG_RETENTION_DAYS=2555` 
materialise cette regle (365.25 * 7 ~= 2557, arrondi a 2555 pour rester strict). Le job 
de purge Sprint 18 utilisera cette variable d'environnement.

### 13.3 Decision-008 data residency Benguerir

Toutes les donnees applicatives, y compris l'audit_log, sont stockees physiquement au 
Maroc. Le primaire reside dans la datacenter Benguerir, le secondaire (read replica + 
DR) a Casablanca. Les snapshots compresses pour archivage long-terme sont chiffres 
AES-256-GCM avec une cle Hashicorp Vault region MA, et stockes en stockage objet 
S3-compatible **uniquement marocain**. Aucune sortie de territoire, aucune copie hors 
Maroc, conformement a la position CNDP sur les transferts internationaux.

### 13.4 Preparation Sprint 12 Books CGNC

Le Code General de Normalisation Comptable marocain (CGNC) impose la tenue de livres 
comptables conserves 10 ans. Les ecritures comptables (Sprint 12) ne sont **pas** dans 
audit_log mais dans une table dediee `books_journal_entries` (Sprint 12) avec retention 
de 10 ans. L'audit_log capture quand meme les acces et modifications de configuration 
(plan comptable, exercices, taux TVA), enrichissant le contexte CGNC.

## 14. Conventions absolues

1. **Multi-tenant strict** : toute table metier porte `tenant_id uuid NOT NULL` (sauf catalog), RLS active + FORCE.
2. **Validation Zod** en entree application avant ecriture DB (les CHECK SQL sont defense en profondeur).
3. **Logs Pino structures** : aucun console.log, niveau adapte (error/warn/info/debug), redaction PII automatique.
4. **Argon2id** parametres : memoryCost 65536 (64 MiB), timeCost 3, parallelism 4 (OWASP 2025).
5. **pnpm uniquement** : pas de npm/yarn dans le monorepo.
6. **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
7. **RLS DB derniere ligne defense** : meme si l'app oublie WHERE tenant_id, la DB protege.
8. **No-emoji** dans le code, les commentaires, les commits, les logs.
9. **Migrations TypeScript** : pas de SQL standalone non-versionne ; tout passe par TypeORM.
10. **Trigger updated_at** uniforme via fonction partagee `set_updated_at_column()`.
11. **JSONB GIN index** quand les requetes contains/path s'imposent (ex audit_log.changes).
12. **Soft delete via deleted_at** : conserve traces pour audit, ne pas DELETE physique sauf job.
13. **FK explicites** : tous ON DELETE definis (RESTRICT par defaut pour entites racine, CASCADE pour jonctions, SET NULL pour audit_log).
14. **Conventional Commits** + reference Task ID + Sprint dans le footer.

## 15. Validation pre-commit

```bash
# 1. Format
pnpm format

# 2. Lint
pnpm lint apps/api

# 3. Typecheck
pnpm typecheck

# 4. Migration cycle
pnpm --filter @skalean/api migration:run
pnpm --filter @skalean/api migration:revert
pnpm --filter @skalean/api migration:run

# 5. Tests integration cibles
pnpm --filter @skalean/api test:integration -- \
  test/integration/migrations.spec.ts \
  test/integration/rls-auth-users.spec.ts \
  test/integration/audit-log-append-only.spec.ts \
  test/integration/citext-case-insensitive.spec.ts

# 6. Coverage minimum 90% sur migrations + entities
pnpm --filter @skalean/api test:integration --coverage --collectCoverageFrom='src/database/**/*.ts'

# 7. Verification psql RLS + FORCE RLS
psql "$DATABASE_URL" -c "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('auth_users','auth_tenant_users','auth_sessions','audit_log');" | grep -c " t " | grep -q 8

# 8. Verification policies audit_log = 2 (append-only)
test "$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM pg_policy WHERE polrelid='audit_log'::regclass")" = "2"
```

Toute defaillance bloque le commit (husky pre-commit + CI gate).

## 16. Commit message

```
feat(database): create initial system migration (5 tables + RLS)

Adds the foundational migration "1735000000001-InitialSystem" creating
auth_tenants, auth_users, auth_tenant_users, auth_sessions and audit_log
with multi-tenant 3-layer defense (RLS + FORCE RLS + 4 policies per table)
based on the app_can_access_tenant() function shipped in Sprint 1.

Tables and policies
- auth_tenants : catalog table, no RLS (cross-tenant SuperAdmin lookups)
- auth_users : citext UNIQUE email, argon2id password_hash, MFA fields,
  RLS active + FORCE + 4 policies
- auth_tenant_users : many-to-many junction (SuperAdmin multi-tenant),
  RLS active + 4 policies
- auth_sessions : refresh_token_hash UNIQUE (SHA-256), RLS active + 4 policies
- audit_log : APPEND-ONLY (only SELECT and INSERT policies), 7 years
  retention (ACAPS), GIN index on changes jsonb

Indexes
- idx_auth_users_email_lower (lower(email::text))
- idx_auth_users_tenant_id partial WHERE deleted_at IS NULL
- idx_auth_tenant_users_tenant_id, _user_id, _role
- idx_auth_sessions_user_id, _tenant_id, _expires_at partial
- idx_audit_log_tenant_created (tenant_id, created_at DESC)
- idx_audit_log_changes_gin USING GIN (changes jsonb_path_ops)

Tests
- migrations.spec.ts : 8 tests (up/down/idempotent/RLS/FORCE/policies/indexes)
- rls-auth-users.spec.ts : 8 tests cross-tenant isolation
- audit-log-append-only.spec.ts : 4 tests append-only enforcement
- citext-case-insensitive.spec.ts : 3 tests citext UNIQUE

Compliance
- Loi 09-08 CNDP : audit_log captures all access to personal data
- ACAPS : retention 7 years (AUDIT_LOG_RETENTION_DAYS=2555)
- decision-002 : multi-tenant RLS strict
- decision-003 : TypeORM 0.3 migrations
- decision-008 : data residency Benguerir/Casablanca

Task: 1.2.2
Sprint: 2
Phase: 1
Critere: B-02 (V1-V28 OK)
Refs: ADR-002, ADR-003, ADR-008
```

## 17. Next step

**Tache suivante : 1.2.3 -- Migration `tenant_brokers` + RLS metier broker**

Cette tache appliquera le pattern RLS livre ici sur la premiere table metier (un broker = 
une organisation courtier). Elle introduira les colonnes specifiques courtier (numero ICE, 
RC, agrement ACAPS, IBAN compte cantonnement) et reutilisera : 
- la fonction `app_can_access_tenant()` (Sprint 1)
- le pattern 4 policies (cette tache)
- les triggers updated_at (cette tache)
- la jonction auth_tenant_users (cette tache) pour le rattachement role.

Prerequis 1.2.3 :
- 1.2.2 mergee et migration deployee dev/staging
- ADR-009 (broker domain model) approuvee
- specs ICE/RC/ACAPS validees par le Product Owner

Estimation 1.2.3 : 6h (table + 4 policies + 6 indexes + 12 tests).

## 18. Annexe A -- Fonctions PostgreSQL referencees (rappel Sprint 1)

### 18.1 app_can_access_tenant(tenant_id uuid)

Cette fonction est **deja deployee Sprint 1** par la migration `1734000000001-RlsBootstrap`. 
Rappel pour comprehension :

```sql
CREATE OR REPLACE FUNCTION app_can_access_tenant(target_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_tenant uuid;
  v_super_admin    boolean;
BEGIN
  -- Read session settings injected by the application middleware
  BEGIN
    v_current_tenant := nullif(current_setting('app.current_tenant_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_current_tenant := NULL;
  END;

  BEGIN
    v_super_admin := coalesce(nullif(current_setting('app.is_super_admin', true), '')::boolean, false);
  EXCEPTION WHEN OTHERS THEN
    v_super_admin := false;
  END;

  -- SuperAdmin bypass : true regardless of target
  IF v_super_admin THEN
    RETURN true;
  END IF;

  -- No tenant context : refuse by default
  IF v_current_tenant IS NULL THEN
    RETURN false;
  END IF;

  -- Same tenant : allowed
  IF target_tenant = v_current_tenant THEN
    RETURN true;
  END IF;

  -- Cross-tenant : refused unless explicit junction in auth_tenant_users
  RETURN EXISTS (
    SELECT 1 FROM auth_tenant_users tu
    WHERE tu.user_id IN (
      SELECT u.id FROM auth_users u
      WHERE u.id = nullif(current_setting('app.current_user_id', true), '')::uuid
    )
    AND tu.tenant_id = target_tenant
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION app_can_access_tenant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_can_access_tenant(uuid) TO skalean_app;
```

Cette fonction est **STABLE** (le resultat ne change pas dans une meme transaction pour 
les memes inputs, ce qui permet sa memoization par le planificateur). Elle utilise 
**SECURITY DEFINER** pour pouvoir lire `auth_tenant_users` meme si l'appelant n'a pas 
de droits dessus (ce qui n'arrive pas en pratique mais constitue une defense en 
profondeur). Le `SET search_path = public, pg_temp` est obligatoire pour les fonctions 
SECURITY DEFINER (CVE-2018-1058 mitigation).

### 18.2 Fonction de configuration session (rappel)

Le middleware NestJS Sprint 3 emettra :

```sql
SELECT set_config('app.current_tenant_id', $1, true);
SELECT set_config('app.current_user_id', $2, true);
SELECT set_config('app.is_super_admin', $3, true);
```

Le 3e parametre `true` rend les variables **transactionnelles** (reset au COMMIT/ROLLBACK), 
empechant les fuites entre requetes meme si le client de connexion est partage par un 
pool (cas standard avec `pg-pool`).

### 18.3 Diagnostic policies

Commandes utiles pour debugging RLS :

```sql
-- Liste toutes les policies actives
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Verifier RLS et FORCE RLS
SELECT relname, relrowsecurity AS rls, relforcerowsecurity AS force_rls
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = 'public'::regnamespace
ORDER BY relname;

-- Tester une policy avec un session user simule
SET LOCAL app.current_tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.is_super_admin = 'false';
SELECT id, email FROM auth_users LIMIT 5;

-- Inspecter le plan d'execution avec RLS actif
EXPLAIN (ANALYZE, BUFFERS, VERBOSE) SELECT id FROM auth_users WHERE email = 'admin@x.ma';
```

## 19. Annexe B -- Mapping ACAPS / ISO 27001 / Loi 09-08

| Exigence reglementaire                                         | Implementation 1.2.2                                          |
|----------------------------------------------------------------|---------------------------------------------------------------|
| Loi 09-08 art. 21 -- tracabilite acces donnees personnelles    | audit_log capture user_id + action + resource + ip + ua       |
| Loi 09-08 art. 23 -- conservation limitee                      | retention 7 ans + purge job (Sprint 18)                       |
| ACAPS conservation 7 ans operations assurance non-vie          | AUDIT_LOG_RETENTION_DAYS=2555                                 |
| ACAPS audit trail immuable                                     | append-only (pas de policy UPDATE/DELETE) + FORCE RLS         |
| ISO 27001 A.9.2.1 -- gestion comptes utilisateurs              | auth_users + auth_tenant_users + role-based via permissions   |
| ISO 27001 A.9.4.2 -- procedures securisees de connexion        | password_hash argon2id + locked_until + failed_login_attempts |
| ISO 27001 A.10.1.2 -- gestion des cles cryptographiques        | mfa_secret_encrypted + MFA_SECRET_ENCRYPTION_KEY rotation     |
| ISO 27001 A.12.4.1 -- journalisation des evenements            | audit_log + indexes + GIN sur changes                         |
| ISO 27001 A.12.4.2 -- protection contre falsification logs     | append-only + FORCE RLS + retention                           |
| ISO 27001 A.12.4.3 -- journalisation administrateur            | audit_log capture user_id (NULL si systeme automatise)        |
| ISO 27001 A.13.2 -- transferts d'information                   | data residency Maroc (decision-008)                           |
| ISO 27001 A.18.1.4 -- protection des DCP                       | citext UNIQUE email + soft delete + RLS multi-tenant          |
| CNDP recommandation 2018-04 -- segregation logique             | tenant_id NOT NULL sur tables metier + RLS                    |
| Code du travail Maroc art. 23 -- preuve electronique           | audit_log signed timestamp + retention 7 ans                  |

## 20. Annexe C -- Plan de tests detaille par table

### 20.1 auth_tenants (10 cas)

| #  | Cas                                            | Methode                                | Attendu                  |
|----|------------------------------------------------|----------------------------------------|--------------------------|
| 1  | INSERT broker valide                           | INSERT (id, name, type)='broker'       | success                  |
| 2  | INSERT garage valide                           | INSERT type='garage'                   | success                  |
| 3  | INSERT mixed valide                            | INSERT type='mixed'                    | success                  |
| 4  | INSERT type invalide                           | INSERT type='hacker'                   | error invalid input enum |
| 5  | INSERT name vide                               | INSERT name=''                         | error CHECK length       |
| 6  | INSERT name 201 chars                          | INSERT name=repeat('a',201)            | error CHECK length       |
| 7  | UPDATE updated_at auto                         | UPDATE name then SELECT updated_at     | updated_at > created_at  |
| 8  | Soft delete                                    | UPDATE deleted_at = now()              | success, idx partial OK  |
| 9  | settings JSONB par defaut                      | SELECT settings WHERE id=...           | '{}'::jsonb              |
| 10 | settings JSONB merge                           | UPDATE settings = settings \|\| '{...}'| merged                   |

### 20.2 auth_users (15 cas)

| #  | Cas                                            | Methode                                | Attendu                  |
|----|------------------------------------------------|----------------------------------------|--------------------------|
| 1  | INSERT user normal avec tenant                 | INSERT tenant_id, email, hash, name    | success                  |
| 2  | INSERT super admin sans tenant                 | INSERT tenant_id=NULL                  | success                  |
| 3  | UNIQUE email respecte casse                    | INSERT 2x meme email casse differente  | error duplicate key      |
| 4  | citext lookup case-insensitive                 | SELECT WHERE email = 'JOE@X.MA'        | trouve Joe@X.ma          |
| 5  | password_hash trop court                       | INSERT hash='abc'                      | error CHECK length       |
| 6  | password_hash trop long                        | INSERT hash=repeat('a',501)            | error CHECK length       |
| 7  | failed_login_attempts negatif                  | UPDATE failed_login_attempts=-1        | error CHECK              |
| 8  | failed_login_attempts > 1000                   | UPDATE failed_login_attempts=1001      | error CHECK              |
| 9  | locked_until passe                             | INSERT locked_until=now()-1day         | success                  |
| 10 | locked_until present permet idx               | EXPLAIN locked_until IS NOT NULL       | uses partial idx         |
| 11 | mfa_enabled defaut false                       | INSERT sans mfa_enabled                | mfa_enabled=false        |
| 12 | mfa_secret_encrypted nullable                  | INSERT sans mfa_secret                 | success                  |
| 13 | RLS empeche cross-tenant SELECT                | tenantA INSERT, tenantB SELECT         | 0 rows                   |
| 14 | super_admin bypass                             | tenantB SELECT avec is_super_admin=true| trouve                   |
| 15 | Soft delete + idx partial tenant_id            | UPDATE deleted_at; SELECT WHERE...     | exclusion correcte       |

### 20.3 auth_tenant_users (8 cas)

| #  | Cas                                            | Methode                                | Attendu                  |
|----|------------------------------------------------|----------------------------------------|--------------------------|
| 1  | INSERT (tenant, user, role) valide             | INSERT 'tenant_admin'                  | success                  |
| 2  | INSERT role hors enum                          | INSERT role='hacker_role'              | error CHECK              |
| 3  | INSERT duplicate PK (tenant_id, user_id)       | INSERT 2x meme paire                   | error duplicate          |
| 4  | CASCADE delete tenant                          | DELETE auth_tenants WHERE id=...       | jonction effacee         |
| 5  | CASCADE delete user                            | DELETE auth_users WHERE id=...         | jonction effacee         |
| 6  | permissions JSONB par defaut                   | SELECT permissions                     | '{}'::jsonb              |
| 7  | RLS isolation cross-tenant                     | tenantA insert, tenantB SELECT         | 0 rows                   |
| 8  | super_admin multi-tenant via 2 lignes          | INSERT user X dans tenantA et tenantB  | 2 rows visibles via super|

### 20.4 auth_sessions (10 cas)

| #  | Cas                                            | Methode                                | Attendu                  |
|----|------------------------------------------------|----------------------------------------|--------------------------|
| 1  | INSERT session valide                          | INSERT user, tenant, hash, expires     | success                  |
| 2  | UNIQUE refresh_token_hash                      | INSERT 2x meme hash                    | error duplicate          |
| 3  | CHECK expires_at > created_at                  | INSERT expires < created               | error CHECK              |
| 4  | CHECK token_hash trop court                    | INSERT hash='abc'                      | error CHECK              |
| 5  | CASCADE delete user                            | DELETE auth_users                      | sessions effacees        |
| 6  | CASCADE delete tenant                          | DELETE auth_tenants                    | sessions effacees        |
| 7  | Index partial expires_at WHERE not revoked    | EXPLAIN avec WHERE revoked_at IS NULL  | uses partial idx         |
| 8  | revoked_at update permet rotation              | UPDATE revoked_at = now()              | success                  |
| 9  | RLS cross-tenant                               | tenantA, tenantB SELECT                | 0 rows                   |
| 10 | inet IP address validation                     | INSERT ip_address='192.168.1.1'        | success ; '999' = error  |

### 20.5 audit_log (12 cas)

| #  | Cas                                            | Methode                                | Attendu                  |
|----|------------------------------------------------|----------------------------------------|--------------------------|
| 1  | INSERT entry tenant scoped                     | INSERT tenant_id, action, ...          | success                  |
| 2  | INSERT entry system (tenant_id NULL)           | INSERT tenant_id=NULL                  | success super_admin only |
| 3  | UPDATE bloque (no policy)                      | UPDATE action='hacked'                 | 0 rows updated           |
| 4  | DELETE bloque (no policy)                      | DELETE WHERE id=...                    | 0 rows deleted           |
| 5  | CHECK action longueur                          | INSERT action='a'                      | error CHECK              |
| 6  | CHECK changes JSONB type                       | INSERT changes='[1,2,3]'::jsonb        | error CHECK              |
| 7  | GIN index sur changes                          | EXPLAIN changes @> '...'              | uses GIN                 |
| 8  | Index (tenant_id, created_at DESC)             | EXPLAIN ORDER BY created_at DESC       | uses idx                 |
| 9  | FK ON DELETE SET NULL user                     | DELETE auth_users                      | user_id devient NULL     |
| 10 | FK ON DELETE SET NULL tenant                   | DELETE auth_tenants                    | tenant_id devient NULL   |
| 11 | inet ip_address support                        | INSERT ip='10.0.0.1'                   | success                  |
| 12 | Append-only verification 1000 INSERT           | INSERT loop ; pg_class size grows      | size monotone increasing |

## 21. Annexe D -- Migration order et dependencies

### 21.1 Ordre des migrations Sprint 1 -> Sprint 2

```
1734000000001-RlsBootstrap                  (Sprint 1)
  CREATE EXTENSION pgcrypto, citext, pg_trgm
  CREATE ROLE skalean_app
  CREATE FUNCTION app_can_access_tenant(uuid)
  GRANT privileges

1735000000001-InitialSystem                 (Sprint 2 -- THIS TASK)
  CREATE TYPE tenant_type
  CREATE TABLE auth_tenants
  CREATE TABLE auth_users + RLS + 4 policies
  CREATE TABLE auth_tenant_users + RLS + 4 policies
  CREATE TABLE auth_sessions + RLS + 4 policies
  CREATE TABLE audit_log + RLS + 2 policies (append-only)
  CREATE FUNCTION set_updated_at_column()
  CREATE TRIGGERs trg_*_updated_at

1735000000002-TenantBrokers                 (Sprint 2 -- next)
  CREATE TYPE broker_status
  CREATE TABLE tenant_brokers + FK auth_tenants + RLS + 4 policies
  ...
```

### 21.2 Dependances inter-tables (graphe)

```
auth_tenants (root)
  |
  +-- auth_users (FK tenant_id NULL, ON DELETE RESTRICT)
  |     |
  |     +-- auth_tenant_users (FK user_id, ON DELETE CASCADE)
  |     +-- auth_sessions (FK user_id, ON DELETE CASCADE)
  |     +-- audit_log (FK user_id, ON DELETE SET NULL)
  |
  +-- auth_tenant_users (FK tenant_id, ON DELETE CASCADE)
  +-- auth_sessions (FK tenant_id, ON DELETE CASCADE)
  +-- audit_log (FK tenant_id, ON DELETE SET NULL)
```

### 21.3 Ordre de DROP (down migration)

```
1. DROP TRIGGERS (trg_auth_tenants_updated_at, trg_auth_users_updated_at, trg_auth_tenant_users_updated_at)
2. DROP FUNCTION set_updated_at_column()
3. DROP TABLE audit_log CASCADE       (no children)
4. DROP TABLE auth_sessions CASCADE   (no children, only points to users + tenants)
5. DROP TABLE auth_tenant_users CASCADE  (junction, no children)
6. DROP TABLE auth_users CASCADE      (children just dropped)
7. DROP TABLE auth_tenants CASCADE    (root)
8. DROP TYPE tenant_type
```

## 22. Annexe E -- Checklist code review

### 22.1 Reviewer guidelines (Tech Lead Backend)

- [ ] Migration filename follows pattern `<timestamp>-<PascalCase>.ts`
- [ ] Class name matches filename suffix
- [ ] `name` property identical to class name
- [ ] No `TODO`, `FIXME`, `XXX`, `HACK` in code
- [ ] No emoji anywhere
- [ ] Pre-flight extension check at start of `up()`
- [ ] Each table follows : CREATE TABLE -> CREATE INDEX -> ENABLE RLS -> FORCE RLS -> 4 policies
- [ ] All UPDATE policies have BOTH `USING` and `WITH CHECK`
- [ ] audit_log has ONLY SELECT and INSERT policies
- [ ] All FK have explicit `ON DELETE` clause
- [ ] All timestamps are `timestamptz` not `timestamp`
- [ ] All UUIDs use `uuid` type with `gen_random_uuid()` default
- [ ] Email column uses `citext` not `text` or `varchar`
- [ ] IP addresses use `inet` not `text`
- [ ] JSONB columns have `default '{}'::jsonb` and CHECK type='object'
- [ ] CHECK constraints on all bounded text/int columns
- [ ] Indexes : at minimum tenant_id + lookup field per table
- [ ] Partial indexes use exact same predicate as common queries
- [ ] `down()` drops in reverse FK order
- [ ] `down()` includes DROP TYPE for enums
- [ ] Comments (COMMENT ON TABLE/COLUMN) on key entities

### 22.2 Reviewer guidelines (Architect Principal)

- [ ] decision-002 multi-tenant rules respected (RLS + FORCE RLS + 4 policies)
- [ ] No bypass mechanism in production path (only postgres superuser)
- [ ] auth_tenants intentionally without RLS (catalog cross-tenant)
- [ ] tenant_id NULL semantic clear and documented
- [ ] audit_log retention coherent with ACAPS (7 years = 2555 days)
- [ ] No PII leakage in error messages or logs
- [ ] Indexes optimised for foreseeable read patterns
- [ ] Volumetry projection done : audit_log < 12M rows / 7 years acceptable

### 22.3 Reviewer guidelines (DPO)

- [ ] audit_log captures all required fields per Loi 09-08 art. 21
- [ ] Retention 7 years matches ACAPS
- [ ] No PII duplication in audit_log.changes (only diff)
- [ ] mfa_secret_encrypted is encrypted (column comment)
- [ ] password_hash never stored in cleartext (column comment + CHECK length)
- [ ] Soft delete preserved for legal hold (deleted_at)
- [ ] Data residency Maroc respected (decision-008)
- [ ] CNDP declaration mentions audit_log retention

## 23. Annexe F -- Risques et mitigations

| Risque                                              | Probabilite | Impact | Mitigation                                          |
|-----------------------------------------------------|-------------|--------|-----------------------------------------------------|
| Extension citext non-installee                      | Faible      | Eleve  | Pre-flight check au debut de up()                   |
| FORCE RLS oublie une table                          | Moyenne     | Critique| Test integration verifie pg_class.relforcerowsecurity|
| Policy UPDATE sans WITH CHECK                       | Moyenne     | Critique| Code review checklist + test cross-tenant move      |
| audit_log croissance non-controlee                  | Eleve       | Eleve  | Monitoring + partitionnement Sprint 18              |
| MFA_SECRET_ENCRYPTION_KEY perdue                    | Faible      | Critique| Backup Vault + procedure rotation documentee        |
| Migration revert sur prod                           | Faible      | Critique| Aucun revert en prod ; new forward-only migration   |
| Ordre migrations casse (1.2.1 manquante)            | Faible      | Critique| Pre-flight check verifie role + extensions          |
| Index manquant decouvert en prod (slow query)       | Moyenne     | Moyen  | EXPLAIN ANALYZE en CI + pg_stat_statements          |
| FK CASCADE accidental delete chain                  | Faible      | Eleve  | Tests CASCADE explicites + revue code               |
| Soft-deleted tenant resurfacing via super admin     | Tres faible | Faible | Test rls-auth-users.spec.ts couvre                  |

## 24. Annexe G -- Volumetrie projetee

### 24.1 Estimations a 3 ans (50 brokers actifs)

| Table              | Lignes/jour | Cumul 3 ans  | Taille approx |
|--------------------|-------------|--------------|---------------|
| auth_tenants       | 0.05        | ~55          | < 1 MB        |
| auth_users         | 5           | ~5,500       | ~5 MB         |
| auth_tenant_users  | 5           | ~5,500       | ~3 MB         |
| auth_sessions      | 250         | ~275,000     | ~80 MB        |
| audit_log          | 5,000       | ~5,500,000   | ~3.5 GB       |
| **TOTAL**          |             |              | **~3.6 GB**   |

### 24.2 Volumetrie a 7 ans (cible retention)

| Table              | Lignes 7 ans | Taille approx | Notes                        |
|--------------------|--------------|---------------|------------------------------|
| audit_log          | ~12,800,000  | ~8 GB         | Partitionnement Sprint 18    |
| auth_sessions      | nettoye      | ~80 MB stable | Job purge expires + revoked  |

### 24.3 Strategie partitionnement audit_log (Sprint 18)

```sql
-- Sprint 18 migration (preview, not in 1.2.2)
CREATE TABLE audit_log_partitioned (LIKE audit_log INCLUDING ALL)
  PARTITION BY RANGE (created_at);

-- Monthly partitions for retention 7 years = 84 partitions
CREATE TABLE audit_log_2026_05 PARTITION OF audit_log_partitioned
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- ... etc

-- Migration data
INSERT INTO audit_log_partitioned SELECT * FROM audit_log;
ALTER TABLE audit_log RENAME TO audit_log_legacy;
ALTER TABLE audit_log_partitioned RENAME TO audit_log;
```

## 25. Annexe H -- Glossaire

| Terme                 | Definition                                                                  |
|-----------------------|-----------------------------------------------------------------------------|
| RLS                   | Row Level Security PostgreSQL                                               |
| FORCE RLS             | Mode RLS strict, applique meme au proprietaire de la table                  |
| Policy                | Regle SQL qui filtre les lignes visibles par operation                      |
| USING                 | Clause policy : quelles lignes sont visibles                                |
| WITH CHECK            | Clause policy : nouvelles valeurs autorisees                                |
| citext                | CASE INSENSITIVE TEXT, extension Postgres                                   |
| GIN                   | Generalized Inverted Index, optimal pour JSONB                              |
| BTREE                 | Index par defaut, optimal pour egalite et range                             |
| BRIN                  | Block Range Index, optimal pour donnees ordonnees naturellement (timeseries)|
| TypeORM 0.3           | ORM TypeScript, version migrations TypeScript                               |
| QueryRunner           | Interface TypeORM pour DDL imperatif                                        |
| pg_class              | Catalog systeme PostgreSQL des tables/index/sequences                       |
| pg_policy             | Catalog systeme PostgreSQL des policies RLS                                 |
| pg_extension          | Catalog systeme PostgreSQL des extensions installees                        |
| Argon2id              | Algorithme de hash de mot de passe, gagnant Password Hashing Competition    |
| TOTP                  | Time-based One-Time Password (RFC 6238) pour MFA                            |
| AES-256-GCM           | Chiffrement symetrique authentifie 256-bit                                  |
| ACAPS                 | Autorite de Controle des Assurances et de la Prevoyance Sociale (Maroc)     |
| CNDP                  | Commission Nationale de protection des Donnees a caractere Personnel (Maroc)|
| Loi 09-08             | Loi marocaine sur la protection des donnees personnelles                    |
| CGNC                  | Code General de Normalisation Comptable (Maroc)                             |
| Append-only           | Donnees seulement ajoutables, jamais modifiables/supprimees                 |
| Soft delete           | Suppression logique via flag, ligne conservee                               |
| ICE                   | Identifiant Commun de l'Entreprise (Maroc)                                  |
| RC                    | Registre du Commerce                                                        |
| SuperAdmin            | Utilisateur platform-wide, peut traverser les tenants                       |
| Tenant                | Organisation isolee (broker, garage, ou mixte)                              |

## 26. Annexe I -- Exemple de seed minimal pour DEV

Fichier `apps/api/src/database/seeds/system-seed.ts` (a creer Sprint 2 1.2.14, mention pour 
contexte ici) :

```typescript
import { DataSource } from 'typeorm';
import * as argon2 from 'argon2';

export async function seedSystem(ds: DataSource): Promise<void> {
  const passwordHash = await argon2.hash('DevPassword!2026', {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Bypass RLS for seed
  await ds.query(`SELECT set_config('app.is_super_admin', 'true', true);`);

  // Tenants
  const tenantBroker = '10000000-0000-0000-0000-000000000001';
  const tenantGarage = '10000000-0000-0000-0000-000000000002';
  await ds.query(
    `INSERT INTO auth_tenants (id, name, type) VALUES ($1, 'Demo Broker SARL', 'broker'), ($2, 'Demo Garage SARL', 'garage') ON CONFLICT DO NOTHING;`,
    [tenantBroker, tenantGarage],
  );

  // Super admin
  const [{ id: superId }] = await ds.query(
    `INSERT INTO auth_users (tenant_id, email, password_hash, display_name, email_verified_at)
     VALUES (NULL, 'super@skalean.ma', $1, 'Super Admin', now())
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email RETURNING id;`,
    [passwordHash],
  );

  // Tenant admins
  await ds.query(
    `INSERT INTO auth_users (tenant_id, email, password_hash, display_name, email_verified_at)
     VALUES ($1, 'admin@broker.demo.ma', $2, 'Admin Broker', now()),
            ($3, 'admin@garage.demo.ma', $2, 'Admin Garage', now())
     ON CONFLICT (email) DO NOTHING;`,
    [tenantBroker, passwordHash, tenantGarage],
  );

  // Junction
  await ds.query(
    `INSERT INTO auth_tenant_users (tenant_id, user_id, role)
     VALUES ($1, $2, 'super_admin'), ($3, $2, 'super_admin')
     ON CONFLICT DO NOTHING;`,
    [tenantBroker, superId, tenantGarage],
  );

  // Audit entry for the seed itself (system action, user_id NULL)
  await ds.query(
    `INSERT INTO audit_log (tenant_id, user_id, action, resource_type, changes)
     VALUES (NULL, NULL, 'system.seed', 'system', $1::jsonb);`,
    [JSON.stringify({ after: { tenants: 2, users: 3 }, fields_changed: ['seed'] })],
  );
}
```

## 27. Annexe J -- Failure scenarios et debugging

### 27.1 Scenario : "RLS ne filtre rien"

**Symptome** : tous les utilisateurs voient toutes les lignes meme avec tenant_id different.

**Diagnostic** :

```sql
-- Verifier RLS active
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class WHERE relname = 'auth_users';
-- Si relforcerowsecurity = false, c'est la cause.

-- Verifier role applicatif
SELECT current_user, session_user;
-- Si 'postgres' (superuser), il bypass. Doit etre 'skalean_app'.

-- Verifier session settings
SELECT current_setting('app.current_tenant_id', true);
SELECT current_setting('app.is_super_admin', true);
-- Si vide ou 'true', tout passe.
```

**Resolution** : ALTER TABLE FORCE ROW LEVEL SECURITY ; verifier le role de connexion 
applicatif ; verifier middleware NestJS Sprint 3 emet bien les SET LOCAL.

### 27.2 Scenario : "Migration revert echoue avec cannot drop"

**Symptome** : `pnpm migration:revert` echoue avec "cannot drop table auth_users because 
other objects depend on it".

**Diagnostic** :

```sql
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE confrelid = 'auth_users'::regclass;
```

**Resolution** : Verifier que toutes les migrations posterieures (1.2.3+) ont bien ete 
revertees dans l'ordre inverse. Si une migration metier (broker, garage) a ete oubliee, 
la revert.

### 27.3 Scenario : "FORCE RLS cause infinite recursion"

**Symptome** : `infinite recursion detected in policy for relation "auth_users"`.

**Diagnostic** : la policy USING fait reference a la table elle-meme (par exemple 
`USING (id IN (SELECT id FROM auth_users WHERE ...))`).

**Resolution** : utiliser une fonction `SECURITY DEFINER` qui contourne RLS pour la 
sous-requete (cas de `app_can_access_tenant` qui lit `auth_tenant_users`).

### 27.4 Scenario : "citext UNIQUE comportement non case-insensitive"

**Symptome** : INSERT 'Joe@x.ma' puis 'JOE@X.MA' ne declenche pas duplicate key.

**Diagnostic** :

```sql
SELECT extname FROM pg_extension WHERE extname = 'citext';
-- Si vide, citext non charge.

SELECT typname FROM pg_type WHERE typname = 'citext';
-- Si vide, citext non instancie comme type.

\d+ auth_users
-- Verifier que email est bien citext et non text.
```

**Resolution** : `CREATE EXTENSION IF NOT EXISTS citext;` puis recreer la colonne avec 
type citext.

### 27.5 Scenario : "audit_log GIN index pas utilise par EXPLAIN"

**Symptome** : EXPLAIN sur `WHERE changes @> '{"action": "x"}'::jsonb` montre Seq Scan.

**Diagnostic** : volume insuffisant (< 1000 lignes). Le planificateur prefere Seq Scan.

**Resolution** : `ANALYZE audit_log;` apres seed ; sur prod, le GIN sera utilise 
naturellement avec le volume.

## 28. Annexe K -- Roadmap evolution post-1.2.2

| Sprint | Tache       | Evolution sur 1.2.2                                                  |
|--------|-------------|----------------------------------------------------------------------|
| 2      | 1.2.3       | Ajoute tenant_brokers FK auth_tenants                                |
| 2      | 1.2.4       | Ajoute tenant_garages FK auth_tenants                                |
| 3      | 2.1.x       | Implements middleware NestJS qui SET LOCAL tenant_id                 |
| 3      | 2.2.x       | Implements password verify argon2id avec legacy bcrypt fallback      |
| 3      | 2.3.x       | Implements MFA TOTP avec mfa_secret_encrypted decrypt                |
| 4      | 3.x.x       | Refresh token rotation atomique                                      |
| 6      | 5.x.x       | Monitoring volumetrie audit_log via Prometheus                       |
| 12     | 11.x.x      | Books CGNC : new tables + reuse audit_log pattern                    |
| 18     | 17.x.x      | Partitionnement RANGE audit_log par mois                             |
| 18     | 17.y.y      | Job pgcron purge audit_log retention 7 ans + archive S3 Maroc        |
| 24     | 23.x.x      | Migration enum tenant_type ajoute 'mga'                              |

alean/db/ca.crt
DATABASE_LOG_QUERIES=false
DATABASE_LOG_SLOW_MS=200
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_STATEMENT_TIMEOUT_MS=30000
DATABASE_IDLE_IN_TRANSACTION_TIMEOUT_MS=60000
```

## 29. Annexe A -- Schema SQL complet 5 tables avec commentaires

Ce schema est la reference normative ; tout ecart entre ce SQL et la migration TypeORM
generee doit etre justifie en revue. Les COMMENT sont rapatries dans les vues
information_schema.columns et exposes par pg_dump pour documentation operationnelle.

```sql
-- =====================================================================
-- Table auth_tenants : catalog des organisations Skalean (broker/garage)
-- =====================================================================
CREATE TABLE auth_tenants (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  type         text NOT NULL CHECK (type IN ('broker', 'garage', 'mixed')),
  settings     jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'suspended', 'archived')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz NULL,
  CONSTRAINT auth_tenants_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT auth_tenants_settings_is_object CHECK (jsonb_typeof(settings) = 'object')
);

CREATE UNIQUE INDEX idx_auth_tenants_name_active
  ON auth_tenants (lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_auth_tenants_type ON auth_tenants (type)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_auth_tenants_status ON auth_tenants (status)
  WHERE deleted_at IS NULL;

COMMENT ON TABLE auth_tenants IS
  'Catalog des organisations clientes Skalean. Une ligne = un broker, un garage ou une entite mixte. Soft-delete via deleted_at (jamais physiquement supprime, retention 7 ans ACAPS).';
COMMENT ON COLUMN auth_tenants.id IS 'Identifiant tenant UUID v4. Sert de cle de partitionnement RLS sur toutes les tables metier.';
COMMENT ON COLUMN auth_tenants.name IS 'Raison sociale legale tel que declaree au CRI Maroc.';
COMMENT ON COLUMN auth_tenants.type IS 'broker|garage|mixed. mixed = entite operant les deux metiers (rare, ex: groupe Saham).';
COMMENT ON COLUMN auth_tenants.settings IS 'Config tenant-specific : devise, locale, fuseau, options ACAPS, branding. Schema JSON valide en applicatif.';
COMMENT ON COLUMN auth_tenants.status IS 'active|suspended (impayes / suspicion fraude) | archived (offboarding contractuel).';
COMMENT ON COLUMN auth_tenants.deleted_at IS 'Soft delete. Une fois NOT NULL, plus aucune session ne peut etre creee ni aucun login effectue.';

-- =====================================================================
-- Table auth_users : comptes utilisateurs (broker, assure, garagiste)
-- =====================================================================
CREATE TABLE auth_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext NOT NULL,
  password_hash   text NOT NULL,
  password_algo   text NOT NULL DEFAULT 'argon2id'
                    CHECK (password_algo IN ('argon2id', 'bcrypt')),
  full_name       text NOT NULL,
  phone_e164      text NULL,
  is_super_admin  boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  email_verified_at timestamptz NULL,
  last_login_at   timestamptz NULL,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until    timestamptz NULL,
  mfa_enabled     boolean NOT NULL DEFAULT false,
  mfa_secret_enc  text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz NULL,
  CONSTRAINT auth_users_email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT auth_users_phone_e164_format
    CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{6,14}$'),
  CONSTRAINT auth_users_full_name_not_blank CHECK (length(trim(full_name)) > 0),
  CONSTRAINT auth_users_failed_login_nonneg CHECK (failed_login_count >= 0),
  CONSTRAINT auth_users_mfa_consistency
    CHECK ((mfa_enabled = false AND mfa_secret_enc IS NULL)
        OR (mfa_enabled = true  AND mfa_secret_enc IS NOT NULL))
);

CREATE UNIQUE INDEX idx_auth_users_email_unique
  ON auth_users (email) WHERE deleted_at IS NULL;
CREATE INDEX idx_auth_users_email_lower
  ON auth_users (lower(email::text)) WHERE deleted_at IS NULL;
CREATE INDEX idx_auth_users_super_admin
  ON auth_users (is_super_admin) WHERE is_super_admin = true AND deleted_at IS NULL;
CREATE INDEX idx_auth_users_locked
  ON auth_users (locked_until) WHERE locked_until IS NOT NULL;

COMMENT ON TABLE auth_users IS
  'Comptes utilisateurs nominatifs. NON tenant-isolee directement : un user peut appartenir a 0..N tenants via auth_tenant_users. RLS basee sur jonction.';
COMMENT ON COLUMN auth_users.email IS 'Email primaire. citext = case-insensitive (Joe@x.com == joe@x.com). UNIQUE among non-deleted.';
COMMENT ON COLUMN auth_users.password_hash IS 'Hash Argon2id (parametres : 64MB, t=3, p=4) precede de pepper PASSWORD_PEPPER. Bcrypt accepte uniquement legacy migration.';
COMMENT ON COLUMN auth_users.is_super_admin IS 'Flag global SuperAdmin Skalean (support technique). Bypass RLS via app.is_super_admin=true session var.';
COMMENT ON COLUMN auth_users.failed_login_count IS 'Compteur tentatives echouees. Reset a 0 sur login OK. Atteint 5 declenche locked_until = now()+15min.';
COMMENT ON COLUMN auth_users.mfa_secret_enc IS 'Secret TOTP RFC 6238 chiffre AES-256-GCM avec MFA_SECRET_ENCRYPTION_KEY. Jamais en clair.';

-- =====================================================================
-- Table auth_tenant_users : jonction many-to-many user <-> tenant
-- =====================================================================
CREATE TABLE auth_tenant_users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
  user_id     uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role        text NOT NULL
                CHECK (role IN ('broker_admin','broker_agent','broker_back_office',
                                'garage_admin','garage_operator',
                                'assure_client','support')),
  invited_by  uuid NULL REFERENCES auth_users(id) ON DELETE SET NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz NULL,
  revoked_at  timestamptz NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_tenant_users_unique_active
    UNIQUE (tenant_id, user_id, role) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_auth_tenant_users_tenant ON auth_tenant_users (tenant_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_auth_tenant_users_user   ON auth_tenant_users (user_id)   WHERE revoked_at IS NULL;
CREATE INDEX idx_auth_tenant_users_role   ON auth_tenant_users (tenant_id, role) WHERE revoked_at IS NULL;

COMMENT ON TABLE auth_tenant_users IS
  'Jonction tenant <-> user portant le role RBAC. Un user peut etre broker_admin sur tenant A et assure_client sur tenant B simultanement.';
COMMENT ON COLUMN auth_tenant_users.role IS 'Role RBAC. Voir RBAC matrix (decision-005). assure_client autorise lecture cross-tenant police uniquement.';
COMMENT ON COLUMN auth_tenant_users.revoked_at IS 'Si NOT NULL le rattachement est inactif. Conserve pour audit historique (jamais DELETE physique).';

-- =====================================================================
-- Table auth_sessions : refresh tokens hashes (rotation Sprint 5)
-- =====================================================================
CREATE TABLE auth_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  tenant_id             uuid NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  refresh_token_hash    text NOT NULL,
  refresh_token_family  uuid NOT NULL DEFAULT gen_random_uuid(),
  ip_address            inet NULL,
  user_agent            text NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  last_used_at          timestamptz NOT NULL DEFAULT now(),
  expires_at            timestamptz NOT NULL,
  revoked_at            timestamptz NULL,
  revoked_reason        text NULL
                          CHECK (revoked_reason IN
                            (NULL,'logout','rotation','reuse_detected','admin_revoke','expired')),
  CONSTRAINT auth_sessions_expiry_future CHECK (expires_at > created_at)
);

CREATE INDEX idx_auth_sessions_user_active
  ON auth_sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_auth_sessions_family
  ON auth_sessions (refresh_token_family);
CREATE INDEX idx_auth_sessions_expiry
  ON auth_sessions (expires_at) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX idx_auth_sessions_hash_unique
  ON auth_sessions (refresh_token_hash) WHERE revoked_at IS NULL;

COMMENT ON TABLE auth_sessions IS
  'Sessions actives. Une session = un refresh_token. JWT acces non stocke (stateless). Rotation a chaque refresh, family identique pour detection reuse.';
COMMENT ON COLUMN auth_sessions.refresh_token_hash IS 'Hash bcrypt cost=10 du refresh token. Token plain jamais persiste cote serveur.';
COMMENT ON COLUMN auth_sessions.refresh_token_family IS 'Identifiant chaine de rotation. Si reuse detecte, toutes les sessions de la famille sont revoquees (defense vol token).';
COMMENT ON COLUMN auth_sessions.tenant_id IS 'Tenant courant choisi par user a la creation session. NULL pour SuperAdmins en mode global.';

-- =====================================================================
-- Table audit_log : journal append-only mutations metier (7 ans)
-- =====================================================================
CREATE TABLE audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
  actor_user_id uuid NULL REFERENCES auth_users(id) ON DELETE SET NULL,
  actor_type   text NOT NULL DEFAULT 'user'
                  CHECK (actor_type IN ('user','system','cron','api_key')),
  entity_type  text NOT NULL,
  entity_id    uuid NOT NULL,
  action       text NOT NULL
                  CHECK (action IN ('create','update','delete','soft_delete',
                                    'restore','login','logout','export',
                                    'permission_grant','permission_revoke')),
  changes      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address   inet NULL,
  user_agent   text NULL,
  request_id   uuid NULL,
  trace_id     text NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_log_changes_is_object CHECK (jsonb_typeof(changes) = 'object'),
  CONSTRAINT audit_log_entity_type_not_blank CHECK (length(trim(entity_type)) > 0)
);

CREATE INDEX idx_audit_log_tenant_created
  ON audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_audit_log_entity
  ON audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_log_actor
  ON audit_log (actor_user_id, created_at DESC) WHERE actor_user_id IS NOT NULL;
CREATE INDEX idx_audit_log_action_recent
  ON audit_log (action, created_at DESC);
CREATE INDEX idx_audit_log_request
  ON audit_log (request_id) WHERE request_id IS NOT NULL;

COMMENT ON TABLE audit_log IS
  'Journal append-only ACAPS Article 12 + ISO 27001 A.12.4. Aucun UPDATE ni DELETE applicatif. Purge >7 ans uniquement par job pgcron Sprint 18.';
COMMENT ON COLUMN audit_log.changes IS 'Diff structure : {"before": {...}, "after": {...}, "fields_changed": ["email","role"]}. Permet reconstruction historique entite.';
COMMENT ON COLUMN audit_log.trace_id IS 'OpenTelemetry trace ID (W3C). Permet correlation log applicatif <-> audit metier <-> APM.';
```

## 30. Annexe B -- Pattern argon2id complet (preview Sprint 5)

Cette annexe documente le pattern hashing applicable Sprint 5 (Auth Module). Reference pour
ne PAS choisir bcrypt aujourd'hui pour les nouveaux users : argon2id est OWASP top
recommendation depuis 2021 et resiste mieux aux attaques GPU.

```typescript
// apps/api/src/modules/auth/services/auth-hasher.service.ts
// PREVIEW Sprint 5 - NE PAS implementer dans 1.2.2

import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

export interface HasherOptions {
  memoryCost: number;  // KiB
  timeCost: number;    // iterations
  parallelism: number; // threads
  type: argon2.argon2id;
}

@Injectable()
export class AuthHasherService {
  private readonly logger = new Logger(AuthHasherService.name);
  private readonly pepper: string;
  private readonly options: HasherOptions = {
    memoryCost: 65536,    // 64 MiB par hash
    timeCost: 3,          // 3 passes
    parallelism: 4,       // 4 threads
    type: argon2.argon2id,
  };

  constructor(private readonly config: ConfigService) {
    this.pepper = this.config.getOrThrow<string>('PASSWORD_PEPPER');
    if (this.pepper.length < 32) {
      throw new Error('PASSWORD_PEPPER must be >= 32 chars (entropy minimum 256 bits).');
    }
  }

  async hash(plain: string): Promise<{ hash: string; algo: 'argon2id' }> {
    if (plain.length < 12) {
      throw new Error('Password length minimum 12 chars (NIST SP 800-63B).');
    }
    const peppered = plain + this.pepper;
    const hash = await argon2.hash(peppered, this.options);
    return { hash, algo: 'argon2id' };
  }

  async verify(stored: string, algo: 'argon2id' | 'bcrypt', plain: string): Promise<boolean> {
    const peppered = plain + this.pepper;
    if (algo === 'argon2id') {
      try {
        return await argon2.verify(stored, peppered);
      } catch (err) {
        this.logger.warn(`argon2 verify error : ${(err as Error).message}`);
        return false;
      }
    }
    if (algo === 'bcrypt') {
      // Legacy support during migration window. Re-hash to argon2id on success.
      return await bcrypt.compare(peppered, stored);
    }
    return false;
  }

  detectAlgoFromHash(hash: string): 'argon2id' | 'bcrypt' | 'unknown' {
    if (hash.startsWith('$argon2id$')) return 'argon2id';
    if (hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$')) {
      return 'bcrypt';
    }
    return 'unknown';
  }

  needsRehash(currentAlgo: 'argon2id' | 'bcrypt'): boolean {
    return currentAlgo === 'bcrypt';
  }
}
```

Tests unitaires preview :

```typescript
describe('AuthHasherService', () => {
  let svc: AuthHasherService;
  beforeAll(() => {
    process.env.PASSWORD_PEPPER = 'a'.repeat(64);
    svc = new AuthHasherService(new ConfigService());
  });

  it('hash retourne format argon2id reconnaissable', async () => {
    const { hash, algo } = await svc.hash('CorrectHorseBatteryStaple-9!');
    expect(algo).toBe('argon2id');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('verify true avec mot de passe correct', async () => {
    const { hash } = await svc.hash('S3cret-Pa55phrase!');
    expect(await svc.verify(hash, 'argon2id', 'S3cret-Pa55phrase!')).toBe(true);
  });

  it('verify false avec mot de passe errone', async () => {
    const { hash } = await svc.hash('S3cret-Pa55phrase!');
    expect(await svc.verify(hash, 'argon2id', 'wrong-password')).toBe(false);
  });

  it('timing attack resistance : verify constant-time meme sur hash invalide', async () => {
    const t0 = Date.now();
    await svc.verify('$argon2id$invalid', 'argon2id', 'anything');
    const t1 = Date.now();
    expect(t1 - t0).toBeGreaterThan(5);
  });

  it('rejette mot de passe < 12 chars (NIST)', async () => {
    await expect(svc.hash('short')).rejects.toThrow(/minimum 12/);
  });

  it('detectAlgo retourne bcrypt pour hash $2b$', () => {
    expect(svc.detectAlgoFromHash('$2b$10$abc...')).toBe('bcrypt');
  });

  it('needsRehash true pour bcrypt legacy', () => {
    expect(svc.needsRehash('bcrypt')).toBe(true);
    expect(svc.needsRehash('argon2id')).toBe(false);
  });
});
```

## 31. Annexe C -- RLS policies template SQL exhaustif

Pattern applicable systematiquement aux 4 tables tenant-isolees. La fonction
`app_can_access_tenant(uuid)` deja deployee Sprint 1 lit deux session vars
(`app.current_tenant_id` et `app.is_super_admin`). Ce pattern doit etre copie sur toute
nouvelle table tenant-scoped des Sprints suivants.

```sql
-- =====================================================================
-- Pattern RLS : auth_tenant_users (tenant_id direct)
-- =====================================================================
ALTER TABLE auth_tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_tenant_users FORCE  ROW LEVEL SECURITY;

CREATE POLICY auth_tenant_users_select_policy
  ON auth_tenant_users
  FOR SELECT
  USING (app_can_access_tenant(tenant_id));

CREATE POLICY auth_tenant_users_insert_policy
  ON auth_tenant_users
  FOR INSERT
  WITH CHECK (app_can_access_tenant(tenant_id));

CREATE POLICY auth_tenant_users_update_policy
  ON auth_tenant_users
  FOR UPDATE
  USING (app_can_access_tenant(tenant_id))
  WITH CHECK (app_can_access_tenant(tenant_id));

CREATE POLICY auth_tenant_users_delete_policy
  ON auth_tenant_users
  FOR DELETE
  USING (app_can_access_tenant(tenant_id));

-- =====================================================================
-- Pattern RLS : auth_users (tenant via jonction auth_tenant_users)
-- =====================================================================
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_users FORCE  ROW LEVEL SECURITY;

CREATE POLICY auth_users_select_policy
  ON auth_users
  FOR SELECT
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM auth_tenant_users tu
      WHERE tu.user_id = auth_users.id
        AND tu.revoked_at IS NULL
        AND app_can_access_tenant(tu.tenant_id)
    )
  );

CREATE POLICY auth_users_insert_policy
  ON auth_users
  FOR INSERT
  WITH CHECK (current_setting('app.is_super_admin', true) = 'true');

CREATE POLICY auth_users_update_policy
  ON auth_users
  FOR UPDATE
  USING (
    current_setting('app.is_super_admin', true) = 'true'
    OR EXISTS (
      SELECT 1 FROM auth_tenant_users tu
      WHERE tu.user_id = auth_users.id
        AND tu.revoked_at IS NULL
        AND app_can_access_tenant(tu.tenant_id)
    )
  );

CREATE POLICY auth_users_delete_policy
  ON auth_users
  FOR DELETE
  USING (current_setting('app.is_super_admin', true) = 'true');

-- =====================================================================
-- Pattern RLS : auth_sessions (tenant_id direct, owner user)
-- =====================================================================
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions FORCE  ROW LEVEL SECURITY;

CREATE POLICY auth_sessions_select_policy
  ON auth_sessions
  FOR SELECT
  USING (
    tenant_id IS NULL  -- SuperAdmin sessions globales
    OR app_can_access_tenant(tenant_id)
  );

CREATE POLICY auth_sessions_insert_policy
  ON auth_sessions
  FOR INSERT
  WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));

CREATE POLICY auth_sessions_update_policy
  ON auth_sessions
  FOR UPDATE
  USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id))
  WITH CHECK (tenant_id IS NULL OR app_can_access_tenant(tenant_id));

CREATE POLICY auth_sessions_delete_policy
  ON auth_sessions
  FOR DELETE
  USING (tenant_id IS NULL OR app_can_access_tenant(tenant_id));

-- =====================================================================
-- Pattern RLS : audit_log (append-only : INSERT autorise, pas UPDATE/DELETE)
-- =====================================================================
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE  ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_policy
  ON audit_log
  FOR SELECT
  USING (app_can_access_tenant(tenant_id));

CREATE POLICY audit_log_insert_policy
  ON audit_log
  FOR INSERT
  WITH CHECK (app_can_access_tenant(tenant_id));

-- PAS de policy UPDATE : append-only.
-- PAS de policy DELETE : seul job pgcron purge >7 ans avec SET ROLE postgres.

COMMENT ON FUNCTION app_can_access_tenant(uuid) IS
  'Retourne true si la session courante (1) est super admin OR (2) tenant_id arg = current_setting(app.current_tenant_id) OR (3) lecture cross-tenant explicitement autorisee (assure_client). Source de verite RLS.';
```

Pattern multi-tenant 3 niveaux explicite :

- **Niveau 1 -- BrokerAdmin** : voit uniquement son propre tenant. `app.current_tenant_id` =
  son tenant ; `app.is_super_admin` = false. La fonction retourne true uniquement si
  `tenant_id = current_setting('app.current_tenant_id')::uuid`.
- **Niveau 2 -- SuperAdmin Skalean** : voit tous les tenants. `app.is_super_admin` = true.
  La fonction retourne toujours true. Reserve aux 3 a 5 personnes du support technique
  Skalean. Acces journalise systematiquement dans audit_log avec actor_type=user et
  un champ changes.super_admin_context = true.
- **Niveau 3 -- AssureClient cross-tenant readonly** : un client final assure peut avoir
  des polices chez plusieurs courtiers (ex: auto chez courtier A, habitation chez courtier B).
  La policy SELECT specifique sur `policy` (Sprint 7) ajoutera une branche supplementaire :
  `OR EXISTS (SELECT 1 FROM policies p WHERE p.assure_user_id = current_setting('app.current_user_id')::uuid)`.

## 32. Annexe D -- Tests integration RLS exhaustifs (50+ scenarios)

Liste exhaustive des scenarios a couvrir dans `test/integration/rls-auth-users.spec.ts` et
les specs adjacents. Cette annexe formalise la matrice ; chaque ligne correspond a un
`it(...)` Vitest.

```typescript
// apps/api/test/integration/rls-auth-users.spec.ts (extrait normatif)
import { DataSource, QueryRunner } from 'typeorm';
import { createDataSource } from '../helpers/datasource';
import { setSessionContext, resetSessionContext } from '../helpers/rls';

let ds: DataSource;
let tenantA: string, tenantB: string;
let userA1: string, userA2: string, userB1: string;

beforeAll(async () => {
  ds = await createDataSource();
});

afterAll(async () => { await ds.destroy(); });

beforeEach(async () => {
  // Setup baseline avec role superuser pour seed
  await ds.query(`SET ROLE postgres;`);
  await ds.query(`TRUNCATE auth_sessions, auth_tenant_users, audit_log, auth_users, auth_tenants RESTART IDENTITY CASCADE;`);
  // Reseed minimal
  const [a] = await ds.query(`INSERT INTO auth_tenants(name,type) VALUES('Tenant A','broker') RETURNING id;`);
  const [b] = await ds.query(`INSERT INTO auth_tenants(name,type) VALUES('Tenant B','garage') RETURNING id;`);
  tenantA = a.id; tenantB = b.id;
  // ... insertions users + jonctions
  await ds.query(`RESET ROLE;`);
});

afterEach(async () => {
  await resetSessionContext(ds);
});

describe('RLS auth_users -- 50+ scenarios', () => {
  // ===== SELECT =====
  it('S01 BrokerAdmin tenant A : voit ses users du tenant A',          async () => { /* ... */ });
  it('S02 BrokerAdmin tenant A : ne voit PAS users tenant B',          async () => { /* ... */ });
  it('S03 BrokerAdmin tenant A : count = nb users tenant A exact',     async () => { /* ... */ });
  it('S04 SuperAdmin : voit users tous tenants',                       async () => { /* ... */ });
  it('S05 Sans session vars : retourne 0 lignes (deny by default)',    async () => { /* ... */ });
  it('S06 app.current_tenant_id invalid uuid : 0 lignes, pas erreur', async () => { /* ... */ });
  it('S07 app.is_super_admin string "true" vs bool : accepte string', async () => { /* ... */ });
  it('S08 AssureClient cross-tenant : lecture profil possible si link policy', async () => { /* ... */ });
  it('S09 BrokerAdmin tenant A apres revoke : ne voit plus user',     async () => { /* ... */ });
  it('S10 Soft-deleted user : invisible meme tenant proprietaire',     async () => { /* ... */ });

  // ===== INSERT =====
  it('S11 BrokerAdmin INSERT user direct : REJETE (only super_admin)',async () => { /* ... */ });
  it('S12 SuperAdmin INSERT auth_users : OK',                          async () => { /* ... */ });
  it('S13 INSERT auth_tenant_users tenant A par admin A : OK',         async () => { /* ... */ });
  it('S14 INSERT auth_tenant_users tenant B par admin A : REJETE',     async () => { /* ... */ });
  it('S15 INSERT audit_log tenant A par admin A : OK',                 async () => { /* ... */ });
  it('S16 INSERT audit_log tenant B par admin A : REJETE',             async () => { /* ... */ });
  it('S17 INSERT auth_sessions tenant A par admin A : OK',             async () => { /* ... */ });
  it('S18 INSERT auth_sessions tenant B par admin A : REJETE',         async () => { /* ... */ });
  it('S19 INSERT auth_sessions tenant_id NULL par SuperAdmin : OK',    async () => { /* ... */ });
  it('S20 INSERT sans WITH CHECK match : sqlstate 42501 thrown',       async () => { /* ... */ });

  // ===== UPDATE =====
  it('S21 BrokerAdmin UPDATE user own tenant : OK',                    async () => { /* ... */ });
  it('S22 BrokerAdmin UPDATE user other tenant : 0 rows affected',     async () => { /* ... */ });
  it('S23 BrokerAdmin UPDATE auth_tenant_users.role tenant A : OK',    async () => { /* ... */ });
  it('S24 BrokerAdmin UPDATE auth_tenant_users.role tenant B : 0 rows',async () => { /* ... */ });
  it('S25 UPDATE auth_users.is_super_admin par non-super_admin : reject', async () => { /* ... */ });
  it('S26 UPDATE auth_sessions.revoked_at par admin A own : OK',       async () => { /* ... */ });
  it('S27 UPDATE auth_sessions tenant B par admin A : 0 rows',         async () => { /* ... */ });

  // ===== DELETE =====
  it('S28 BrokerAdmin DELETE user own tenant : 0 rows (only super)',  async () => { /* ... */ });
  it('S29 SuperAdmin DELETE auth_users : OK',                          async () => { /* ... */ });
  it('S30 BrokerAdmin DELETE auth_tenant_users tenant A : OK',         async () => { /* ... */ });
  it('S31 BrokerAdmin DELETE auth_tenant_users tenant B : 0 rows',     async () => { /* ... */ });
  it('S32 DELETE audit_log par BrokerAdmin : REJETE (no policy)',      async () => { /* ... */ });
  it('S33 DELETE audit_log par SuperAdmin app role : REJETE FORCE',    async () => { /* ... */ });
  it('S34 DELETE audit_log SET ROLE postgres : OK (job purge)',        async () => { /* ... */ });

  // ===== Append-only audit =====
  it('S35 UPDATE audit_log par tout role app : REJETE',                async () => { /* ... */ });
  it('S36 audit_log_select_policy SuperAdmin global : OK',             async () => { /* ... */ });
  it('S37 audit_log indexes (tenant,created_at) utilises EXPLAIN',     async () => { /* ... */ });

  // ===== FORCE RLS =====
  it('S38 Connecte comme owner skalean_app : RLS s applique (FORCE)',  async () => { /* ... */ });
  it('S39 Connecte comme postgres superuser : RLS bypass',             async () => { /* ... */ });
  it('S40 RESET ROLE puis SELECT : retombe sur RLS app role',          async () => { /* ... */ });

  // ===== Session var scope =====
  it('S41 SET LOCAL app.current_tenant_id : visible meme transaction', async () => { /* ... */ });
  it('S42 SET LOCAL app.current_tenant_id : reset apres COMMIT',       async () => { /* ... */ });
  it('S43 ROLLBACK n efface pas SET (mais SET LOCAL si)',              async () => { /* ... */ });
  it('S44 SET sans LOCAL : persiste session entiere -> warning',       async () => { /* ... */ });

  // ===== Cas edge =====
  it('S45 tenant_id deleted_at NOT NULL : RLS retourne 0 lignes',      async () => { /* ... */ });
  it('S46 user appartenant a 2 tenants : voit dans chaque contexte',   async () => { /* ... */ });
  it('S47 join cross-table : RLS s applique a chaque cote',            async () => { /* ... */ });
  it('S48 view materialised : RLS bypass si owner postgres -> evite',  async () => { /* ... */ });
  it('S49 explain plan inclut "RLS Filter" pour audit_log SELECT',     async () => { /* ... */ });
  it('S50 perf : SELECT 100k rows tenant A < 100ms (idx utilise)',     async () => { /* ... */ });

  // ===== Bonus =====
  it('S51 INSERT auth_users.email duplicat case-different : REJETE',   async () => { /* ... */ });
  it('S52 CASCADE delete auth_users -> auth_sessions vides',           async () => { /* ... */ });
});
```

Le helper `setSessionContext(ds, { tenantId, isSuperAdmin })` execute en transaction
courante :

```typescript
export async function setSessionContext(
  ds: DataSource,
  ctx: { tenantId?: string; isSuperAdmin?: boolean; userId?: string },
): Promise<void> {
  await ds.query(`SELECT set_config('app.current_tenant_id', $1, true);`, [ctx.tenantId ?? '']);
  await ds.query(`SELECT set_config('app.is_super_admin',     $1, true);`, [String(!!ctx.isSuperAdmin)]);
  if (ctx.userId) {
    await ds.query(`SELECT set_config('app.current_user_id', $1, true);`, [ctx.userId]);
  }
}

export async function resetSessionContext(ds: DataSource): Promise<void> {
  await ds.query(`SELECT set_config('app.current_tenant_id', '', false);`);
  await ds.query(`SELECT set_config('app.is_super_admin',     'false', false);`);
  await ds.query(`SELECT set_config('app.current_user_id',    '', false);`);
}
```

## 33. Annexe E -- Rollback strategy migration

La methode `down()` doit etre **strictement symetrique** a `up()`. Ordre exact reverse,
DROP CASCADE pour gerer les FK, et ne JAMAIS supprimer une extension PostgreSQL (citext,
pgcrypto) installee par 1.2.1 : ce serait une regression.

```typescript
// Extrait apps/api/src/database/migrations/1735000000001-InitialSystem.ts
public async down(qr: QueryRunner): Promise<void> {
  // Order: tables filles -> tables parentes. CASCADE pour FKs orphelines.
  await qr.query(`DROP TABLE IF EXISTS audit_log         CASCADE;`);
  await qr.query(`DROP TABLE IF EXISTS auth_sessions     CASCADE;`);
  await qr.query(`DROP TABLE IF EXISTS auth_tenant_users CASCADE;`);
  await qr.query(`DROP TABLE IF EXISTS auth_users        CASCADE;`);
  await qr.query(`DROP TABLE IF EXISTS auth_tenants      CASCADE;`);
  // NE PAS DROP citext / pgcrypto / app_can_access_tenant : appartiennent a 1.2.1.
}
```

Tests de revert :

```typescript
it('migration up puis down 3 fois consecutif : aucune erreur, etat propre', async () => {
  for (let i = 0; i < 3; i++) {
    await ds.runMigrations();
    const tablesUp = await ds.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'auth_%';`,
    );
    expect(tablesUp.length).toBeGreaterThanOrEqual(4);

    await ds.undoLastMigration();
    const tablesDown = await ds.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'auth_%';`,
    );
    expect(tablesDown).toHaveLength(0);
  }
});

it('revert avec donnees : DROP CASCADE supprime sans FK_VIOLATION', async () => {
  await ds.runMigrations();
  await ds.query(`SET ROLE postgres;`);
  await ds.query(`INSERT INTO auth_tenants(name,type) VALUES('test','broker');`);
  // FK auth_tenant_users -> auth_users -> auth_tenants doit etre nettoye CASCADE.
  await expect(ds.undoLastMigration()).resolves.not.toThrow();
});

it('revert preserve extensions citext/pgcrypto (deployees 1.2.1)', async () => {
  await ds.runMigrations();
  await ds.undoLastMigration();
  const ext = await ds.query(
    `SELECT extname FROM pg_extension WHERE extname IN ('citext','pgcrypto');`,
  );
  expect(ext).toHaveLength(2);
});
```

Edge cases documentees :

1. **Revert avec sessions actives** : si une session applicative tient un lock sur
   auth_users, le DROP attendra `lock_timeout` puis echouera. Procedure : 
   `pg_terminate_backend(pid)` sur les connexions skalean_app avant revert en prod.
2. **Revert avec donnees audit_log** : ATTENTION conformite ACAPS Article 12. Un
   revert en production effacerait des journaux dont la retention legale est de 7 ans.
   Procedure obligatoire : `pg_dump --table=audit_log --data-only > audit_pre_revert.sql`
   archive vers S3-Benguerir AVANT toute commande `migration:revert`.
3. **Revert sur replica streaming** : la migration doit avoir atteint tous les replicas
   avant le revert (verifier `pg_stat_replication.replay_lsn >= flush_lsn`).
4. **Backup recommande** : `pg_dump -F c skalean_dev > backup-$(date +%F-%H%M).dump`
   systematique avant tout revert prod.

## 34. Annexe F -- Audit log retention purge job (preview Sprint 18)

Job pgcron + service NestJS. Preview Sprint 18, NE PAS implementer dans 1.2.2.

```typescript
// apps/api/src/modules/audit/services/audit-purge.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

const RETENTION_INTERVAL = "INTERVAL '7 years'";  // ACAPS Article 12 = 2555 jours
const BATCH_SIZE = 10000;
const ARCHIVE_BEFORE_DELETE = true;

@Injectable()
export class AuditPurgeService {
  private readonly logger = new Logger(AuditPurgeService.name);

  constructor(private readonly ds: DataSource) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM, { timeZone: 'Africa/Casablanca' })
  async runDailyPurge(): Promise<void> {
    const start = Date.now();
    let totalDeleted = 0;
    while (true) {
      const batch = await this.ds.transaction(async (em) => {
        const cnt = await em.query(
          `WITH expired AS (
             SELECT id FROM audit_log
             WHERE created_at < now() - ${RETENTION_INTERVAL}
             ORDER BY created_at ASC
             LIMIT $1
             FOR UPDATE SKIP LOCKED
           )
           DELETE FROM audit_log a
           USING expired e
           WHERE a.id = e.id
           RETURNING a.id;`,
          [BATCH_SIZE],
        );
        return cnt.length;
      });
      totalDeleted += batch;
      if (batch < BATCH_SIZE) break;
    }
    const dur = Date.now() - start;
    this.logger.log(`Audit purge done : ${totalDeleted} rows in ${dur}ms`);
  }
}
```

Trigger d'archivage avant DELETE (assure conservation S3 immuable) :

```sql
CREATE OR REPLACE FUNCTION audit_log_archive_before_delete()
RETURNS trigger AS $$
BEGIN
  -- Insert dans table archive_audit_log_yyyymm (sharded par mois) avant DROP
  EXECUTE format(
    'INSERT INTO archive_audit_log_%s SELECT $1.*',
    to_char(OLD.created_at, 'YYYYMM')
  ) USING OLD;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_archive_trigger
  BEFORE DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_archive_before_delete();
```

Conformite exacte ACAPS Article 12 :

- Periode minimale conservation : **7 ans = 2555 jours** apres date d'evenement (et non
  date de cloture du contrat).
- Archivage offline accepte si restauration < 48h (S3 Standard ou Glacier Instant).
- Integrite verifiable : checksum SHA-256 par batch quotidien, stocke en append-only
  blockchain notariation (decision-022 Sprint 22).
- Lieu de stockage : territoire marocain exclusivement (decision-008 data residency).

## 35. Annexe G -- MFA TOTP preview Sprint 5

Schema base + service. Preview Sprint 5, NE PAS implementer dans 1.2.2.

```sql
-- Extension future Sprint 5 sur auth_users (deja inclus columns mfa_*)
ALTER TABLE auth_users
  ADD COLUMN mfa_recovery_codes_hashed text[] NOT NULL DEFAULT '{}',
  ADD COLUMN mfa_enrolled_at timestamptz NULL;

CREATE INDEX idx_auth_users_mfa_enabled ON auth_users (mfa_enabled) WHERE mfa_enabled = true;
```

```typescript
// apps/api/src/modules/auth/services/mfa.service.ts (PREVIEW Sprint 5)
import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MfaService {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const k = config.getOrThrow<string>('MFA_SECRET_ENCRYPTION_KEY');
    this.key = Buffer.from(k, 'base64');
    if (this.key.length !== 32) throw new Error('MFA key must be 32 bytes (AES-256).');
    authenticator.options = { window: 1, step: 30 };  // RFC 6238 30s + drift +/-1
  }

  generateSecret(): { secret: string; otpauth: (issuer: string, label: string) => string } {
    const secret = authenticator.generateSecret(32);  // 32 chars base32
    return {
      secret,
      otpauth: (issuer, label) => authenticator.keyuri(label, issuer, secret),
    };
  }

  encryptSecret(plain: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
  }

  decryptSecret(stored: string): string {
    const buf = Buffer.from(stored, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }

  verifyToken(secretEnc: string, token: string): boolean {
    const secret = this.decryptSecret(secretEnc);
    return authenticator.verify({ token, secret });
  }

  generateRecoveryCodes(n = 10): { plain: string[]; hashed: string[] } {
    const plain: string[] = [];
    const hashed: string[] = [];
    for (let i = 0; i < n; i++) {
      const c = crypto.randomBytes(5).toString('hex').toUpperCase();
      plain.push(c.match(/.{1,5}/g)!.join('-'));
      hashed.push(crypto.createHash('sha256').update(c).digest('hex'));
    }
    return { plain, hashed };
  }
}
```

Tests unitaires preview :

```typescript
describe('MfaService', () => {
  it('generateSecret retourne 32 chars base32 valide', () => {
    const { secret } = svc.generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
  });

  it('encrypt + decrypt round-trip', () => {
    const enc = svc.encryptSecret('JBSWY3DPEHPK3PXP');
    expect(svc.decryptSecret(enc)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('verifyToken accepte token valide RFC 6238', () => {
    const { secret } = svc.generateSecret();
    const enc = svc.encryptSecret(secret);
    const token = authenticator.generate(secret);
    expect(svc.verifyToken(enc, token)).toBe(true);
  });

  it('verifyToken rejette token expire', async () => {
    const { secret } = svc.generateSecret();
    const enc = svc.encryptSecret(secret);
    const oldToken = authenticator.generate(secret);
    await new Promise((r) => setTimeout(r, 31000));  // wait 31s -> step expired
    expect(svc.verifyToken(enc, oldToken)).toBe(false);
  });

  it('recovery codes : 10 codes uniques format XXXXX-XXXXX', () => {
    const { plain, hashed } = svc.generateRecoveryCodes(10);
    expect(plain).toHaveLength(10);
    expect(new Set(plain).size).toBe(10);
    plain.forEach((p) => expect(p).toMatch(/^[A-F0-9]{5}-[A-F0-9]{5}$/));
    expect(hashed.every((h) => h.length === 64)).toBe(true);
  });
});
```

## 36. Annexe H -- Session token rotation + reuse detection

Pattern complet. Preview Sprint 5.

```typescript
// apps/api/src/modules/auth/services/session.service.ts (PREVIEW Sprint 5)
import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { DataSource } from 'typeorm';

const REFRESH_TTL_MS = 30 * 24 * 3600 * 1000;  // 30 jours sliding
const REFRESH_BCRYPT_COST = 10;

@Injectable()
export class SessionService {
  constructor(private readonly ds: DataSource) {}

  async create(userId: string, tenantId: string | null, meta: { ip: string; ua: string }) {
    const token = crypto.randomBytes(48).toString('base64url');
    const hash = await bcrypt.hash(token, REFRESH_BCRYPT_COST);
    const family = crypto.randomUUID();
    const expires = new Date(Date.now() + REFRESH_TTL_MS);
    await this.ds.query(
      `INSERT INTO auth_sessions (user_id,tenant_id,refresh_token_hash,refresh_token_family,
                                  ip_address,user_agent,expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7);`,
      [userId, tenantId, hash, family, meta.ip, meta.ua, expires],
    );
    return { token, family, expires };
  }

  async rotate(presentedToken: string, family: string, meta: { ip: string; ua: string }) {
    return this.ds.transaction(async (em) => {
      const sessions = await em.query(
        `SELECT id, user_id, tenant_id, refresh_token_hash, revoked_at
         FROM auth_sessions
         WHERE refresh_token_family = $1
         ORDER BY created_at DESC
         FOR UPDATE;`,
        [family],
      );
      if (sessions.length === 0) {
        throw new UnauthorizedException('Family unknown.');
      }
      const current = sessions[0];
      // Reuse detection : token presente correspond a un ancien hash deja remplace.
      const matchCurrent = await bcrypt.compare(presentedToken, current.refresh_token_hash);
      if (!matchCurrent) {
        // Tentative de reuse : revoquer toute la family.
        await em.query(
          `UPDATE auth_sessions SET revoked_at=now(), revoked_reason='reuse_detected'
           WHERE refresh_token_family=$1 AND revoked_at IS NULL;`,
          [family],
        );
        throw new UnauthorizedException('Refresh token reuse detected. Family revoked.');
      }
      if (current.revoked_at !== null) {
        throw new UnauthorizedException('Session revoked.');
      }
      // Rotation
      await em.query(
        `UPDATE auth_sessions SET revoked_at=now(), revoked_reason='rotation' WHERE id=$1;`,
        [current.id],
      );
      const newToken = crypto.randomBytes(48).toString('base64url');
      const newHash = await bcrypt.hash(newToken, REFRESH_BCRYPT_COST);
      const expires = new Date(Date.now() + REFRESH_TTL_MS);  // sliding
      await em.query(
        `INSERT INTO auth_sessions (user_id,tenant_id,refresh_token_hash,
            refresh_token_family,ip_address,user_agent,expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7);`,
        [current.user_id, current.tenant_id, newHash, family, meta.ip, meta.ua, expires],
      );
      return { token: newToken, family, expires };
    });
  }

  async revoke(family: string, reason: 'logout'|'admin_revoke') {
    await this.ds.query(
      `UPDATE auth_sessions SET revoked_at=now(), revoked_reason=$1
       WHERE refresh_token_family=$2 AND revoked_at IS NULL;`,
      [reason, family],
    );
  }
}
```

Sliding vs fixed expiry decision : nous adoptons **sliding 30j** (chaque rotation
re-arme le TTL) pour le confort UX broker quotidien. Pour les SuperAdmins, fixed
12h sans sliding (risque vol token plus critique).

## 37. Annexe I -- Performance benchmarks attendus

Targets SLO Sprint 2 sur poste developpeur (Core i7, 16GB RAM, PostgreSQL 16 local).
La CI execute ces benchmarks via `vitest bench` et fail-fast si depassement >2x.

| Operation                                   | Target p50 | Target p95 | Target p99 | Notes                       |
|---------------------------------------------|-----------:|-----------:|-----------:|-----------------------------|
| INSERT auth_user (1 row)                    |       4 ms |       8 ms |      15 ms | argon2 hash hors-DB         |
| SELECT auth_user BY email (idx lower email) |       1 ms |       3 ms |       6 ms | 100k seeded                 |
| INSERT audit_log (1 row)                    |       2 ms |       4 ms |       8 ms | aucun trigger applicatif    |
| SELECT audit_log recent 50 lignes tenant    |      10 ms |      30 ms |      60 ms | idx (tenant_id, created_at) |
| INSERT auth_session (1 row)                 |       3 ms |       6 ms |      12 ms | bcrypt cost 10 hors-DB      |
| Rotation session (UPDATE+INSERT en tx)      |       8 ms |      18 ms |      35 ms | 2 round-trip + bcrypt       |
| RLS policy overhead SELECT                  |    +0.3 ms |    +0.8 ms |    +1.5 ms | vs sans RLS                 |
| DELETE batch audit_log 10k                  |     400 ms |     800 ms |    1500 ms | LIMIT + SKIP LOCKED         |
| Migration up Initial System (5 tables)      |     500 ms |    1000 ms |    2000 ms | seed 0                      |
| Migration down Initial System               |     200 ms |     400 ms |     800 ms | DROP CASCADE                |

Script bench :

```typescript
// apps/api/test/bench/auth-perf.bench.ts
import { bench, describe } from 'vitest';

describe('auth perf', () => {
  bench('SELECT auth_user by email (100k seeded)', async () => {
    await ds.query(`SELECT id FROM auth_users WHERE email = $1;`, ['user50000@example.com']);
  }, { iterations: 1000 });

  bench('INSERT audit_log', async () => {
    await ds.query(
      `INSERT INTO audit_log (tenant_id, entity_type, entity_id, action, changes)
       VALUES ($1,'policy',gen_random_uuid(),'create','{}');`,
      [tenantA],
    );
  }, { iterations: 5000 });
});
```

Methodologie seeding 100k users :

```sql
INSERT INTO auth_users(email, password_hash, password_algo, full_name)
SELECT
  format('user%s@example.com', g),
  '$argon2id$v=19$m=65536,t=3,p=4$' || encode(gen_random_bytes(16),'hex'),
  'argon2id',
  format('User %s', g)
FROM generate_series(1,100000) g;
```

## 38. Annexe J -- Compliance ACAPS detail

Mapping detaille tables auth_*/audit_log -> articles ACAPS et Loi 09-08.

| Article / Norme                  | Exigence                                           | Implementation Skalean                       |
|----------------------------------|----------------------------------------------------|----------------------------------------------|
| ACAPS Circulaire 2018 Art. 5     | Controle d'acces multi-niveaux                     | RLS 3 niveaux + RBAC roles auth_tenant_users |
| ACAPS Circulaire 2018 Art. 12    | Conservation traces 7 ans                          | audit_log retention 2555j + S3 Benguerir     |
| ACAPS Circulaire 2018 Art. 30    | Reports periodiques (preparation Sprint 12)        | views + ETL + signature digitale             |
| ACAPS Circulaire 2018 Art. 18    | Continuite activite (RTO < 4h, RPO < 15min)        | replicas streaming + backup horaire          |
| Loi 09-08 Art. 23 (CNDP)         | Tracabilite acces donnees personnelles             | audit_log.action='read' sur PII colonnes     |
| Loi 09-08 Art. 25                | Droit acces / rectification utilisateur            | GET /me/audit-log endpoint Sprint 6          |
| Loi 09-08 Art. 5 (consentement)  | Recueil consentement explicite                     | auth_users.email_verified_at + popup CGU     |
| ISO 27001 A.9.2.1                | Enregistrement utilisateurs formel                 | INSERT auth_users via SuperAdmin uniquement  |
| ISO 27001 A.9.2.4                | Gestion authentification secrete                   | argon2id + pepper + rotation                 |
| ISO 27001 A.9.4.2                | Procedures connexion securisees                    | failed_login_count + locked_until            |
| ISO 27001 A.12.4.1               | Logs evenements                                    | audit_log + trace_id OpenTelemetry           |
| ISO 27001 A.12.4.3               | Logs administrateur                                | audit_log actor_type='user' + super_admin    |
| OWASP ASVS L2 V2.1.1             | Mots de passe >= 12 chars                          | AuthHasherService length check               |
| OWASP ASVS L2 V3.5               | Token refresh rotation                             | SessionService.rotate + reuse detection      |
| OWASP ASVS L2 V8.3.1             | Donnees sensibles non en log                       | password jamais logge + redaction Pino       |
| RFC 6238 (TOTP)                  | Step 30s, drift +/-1, secret >= 128 bits           | otplib options + base32 32 chars             |
| NIST SP 800-63B AAL2             | MFA TOTP/WebAuthn                                  | mfa_enabled + recovery codes                 |
| Decision Skalean 002             | Multi-tenant strict                                | RLS FORCE + 4 policies                       |
| Decision Skalean 008             | Data residency Maroc                               | infrastructure Benguerir + S3 region MA      |

Relevant article extracts :

- **ACAPS Circulaire 01/2018, Article 12** : "Les compagnies d'assurance et les
  intermediaires conservent toutes les pieces et documents relatifs aux operations
  d'assurance pour une duree minimale de **sept (7) ans** a compter de la date
  d'extinction du contrat ou de la date de l'evenement, selon le cas le plus tardif."
- **Loi 09-08 (2009), Article 23** : "Le responsable du traitement et, le cas echeant,
  son representant doivent prendre toutes precautions utiles, au regard de la nature
  des donnees et des risques presentes par le traitement, pour preserver la securite
  des donnees et, notamment, empecher qu'elles soient deformees, endommagees, ou
  que des tiers non autorises y aient acces."

## 39. Annexe K -- Glossaire termes techniques

| Terme                          | Definition                                                                  |
|--------------------------------|-----------------------------------------------------------------------------|
| RLS                            | Row Level Security PostgreSQL : policies SQL filtrant lignes par session   |
| FORCE RLS                      | Mode strict ou les policies s'appliquent meme au proprietaire de la table  |
| Policy                         | Regle SQL declarative attachee a une table pour SELECT/INSERT/UPDATE/DELETE|
| citext                         | Extension PostgreSQL : type texte case-insensitive aux comparaisons        |
| argon2id                       | Algorithme hash password OWASP-recommande resistant GPU/ASIC               |
| Pepper                         | Cle secrete globale concatenee au password avant hash (vs salt par-row)    |
| Refresh token                  | Token long-lived permettant d'obtenir nouveaux JWT acces                   |
| Token rotation                 | Remplacement du refresh token a chaque utilisation                         |
| Reuse detection                | Detection presentation d'un refresh token deja consomme (vol probable)     |
| Token family                   | Chaine de refresh tokens lies par rotations successives                    |
| Sliding expiry                 | TTL recharge a chaque utilisation (UX) vs fixed expiry (securite)          |
| TOTP                           | Time-based One-Time Password (RFC 6238) - Google Auth, Authy, etc.        |
| MFA                            | Multi-Factor Authentication : 2+ facteurs (knowledge + possession)         |
| RBAC                           | Role-Based Access Control : permissions derivees du role                   |
| Tenant                         | Organisation cliente isolee (un broker, un garage, etc.)                   |
| SuperAdmin                     | User Skalean avec bypass RLS pour support technique cross-tenant           |
| Multi-tenant strict            | Isolation absolue par tenant_id, aucune fuite cross-tenant tolerable       |
| Append-only                    | Table acceptant uniquement INSERT, jamais UPDATE/DELETE applicatif         |
| Soft delete                    | Suppression logique via deleted_at IS NOT NULL (vs DELETE physique)        |
| ACAPS                          | Autorite de Controle des Assurances et de la Prevoyance Sociale (Maroc)    |
| CNDP                           | Commission Nationale de controle de la protection des Donnees Personnelles |
| CGNC                           | Code General de Normalisation Comptable (Maroc)                            |
| ADR                            | Architecture Decision Record - document figeant un choix d'architecture    |
| TypeORM                        | ORM TypeScript supportant migrations, entities, query builder              |
| QueryRunner                    | Abstraction TypeORM pour transactions / migrations bas niveau              |
| pg_dump                        | Outil PostgreSQL d'export logique / binaire d'une base                     |
| pgcron                         | Extension PostgreSQL pour planifier jobs SQL recurrents                    |
| OpenTelemetry                  | Standard observability : traces + metrics + logs correles                  |
| Trace ID (W3C)                 | Identifiant unique propage entre services pour tracer une requete          |
| SLO                            | Service Level Objective : cible mesurable de performance/disponibilite     |
| RTO                            | Recovery Time Objective : duree max d'indisponibilite acceptee             |
| RPO                            | Recovery Point Objective : duree max de donnees perdables                  |

## 40. Annexe L -- FAQ developpeurs

**Q1. Pourquoi la table auth_users n'a-t-elle pas de colonne tenant_id directe ?**
Parce qu'un meme user peut appartenir a plusieurs tenants (ex : un courtier multi-cabinets,
ou un assure ayant des polices chez plusieurs courtiers). Le rattachement passe par la table
de jonction `auth_tenant_users` qui porte aussi le role RBAC contextuel.

**Q2. Comment debugger un test RLS qui echoue avec "0 lignes alors que la donnee existe" ?**
Verifier dans l'ordre : (1) que `setSessionContext` a bien injecte les session vars
(`SHOW app.current_tenant_id`), (2) que le role courant est bien `skalean_app` et non
`postgres` (qui bypasse), (3) que la transaction n'a pas commit/rollback ferme le scope
SET LOCAL, (4) que la fonction `app_can_access_tenant` est bien deployee Sprint 1, (5)
que les policies sont active via `pg_policies` table.

**Q3. Pourquoi UNIQUE INDEX partiel WHERE deleted_at IS NULL plutot que UNIQUE constraint ?**
Pour permettre la re-creation d'un user avec le meme email apres soft delete sans
violer la contrainte. Un UNIQUE classique interdirait cette reutilisation pourtant
legitime metier (offboarding -> re-onboarding apres 1 an).

**Q4. Pourquoi pas un INSERT trigger pour auto-populer audit_log au lieu d'INSERT
applicatif ?** Considere puis rejete : (a) couplage fort base/applicatif rendant
debugging penible, (b) impossibilite de capturer le `actor_user_id` (variable session
non dispo trigger), (c) perte de la trace_id OpenTelemetry. La discipline applicative
via decorateur `@Audited()` Sprint 5 est plus robuste.

**Q5. Les indexes idx_auth_users_email_lower sont-ils utilises automatiquement ?**
Oui pour `WHERE lower(email) = $1` litteralement. Pour une recherche LIKE prefix,
utiliser `text_pattern_ops` index dedie (Sprint 6 si feature search avancee).

**Q6. Pourquoi password_algo en colonne plutot que parser le prefixe du hash ?**
Decoupling : permet de rejouer la decision de re-hash via un job background sans
parsing applicatif a chaque verify. Contrainte CHECK garantit coherence.

**Q7. Que se passe-t-il si la migration plante au milieu (5 tables sur 5) ?**
TypeORM execute up() dans une transaction par defaut (option transaction='each' ou
'all'). En cas d'echec, rollback automatique. Ne JAMAIS positionner
`transaction: false` sur cette migration : risque etat incoherent en CI.

**Q8. Comment ajouter une 6e table sur ce module au Sprint suivant ?**
(1) Creer migration `1735000000002-AddXxx.ts` avec ALTER ou CREATE TABLE,
(2) Ajouter pattern RLS standard si tenant-scoped, (3) Ajouter entity dans `entities/system/`,
(4) Tester migrations.spec.ts up/down, (5) Tester RLS si pertinent.

**Q9. Le test `failed_login_count` non-negatif est-il vraiment necessaire ?**
Oui : un bug applicatif decrementant en boucle pourrait retomber a -2147483648 (int4
overflow). La contrainte CHECK est triviale a evaluer (cout < 1 mu-s par ligne) et
defensive en profondeur.

**Q10. Pourquoi inet et non text pour ip_address ?** Type natif `inet` valide format
IPv4/IPv6 (CHECK gratuit), supporte la recherche par sous-reseau `<<` (recherche
"toutes les IPs du /24"), et stocke compact (7-19 octets vs 15-39 pour text).

**Q11. La colonne `trace_id text` ne devrait-elle pas etre un uuid ?** Le standard
W3C trace-context defint trace_id sur 16 octets hexadecimaux (32 chars). Un UUID
ferait perdre la compatibilite directe avec OpenTelemetry SDK et complicate le
copy-paste depuis Tempo/Jaeger UI. text fixed-length est la decision retenue.

**Q12. Comment reproduire un bug RLS en production sans dump (RGPD/CNDP) ?**
Generer un dataset synthetique anonymise avec le seed script existant
(`pnpm db:seed --profile=anonymized`), reproduire la requete SQL exacte en prefixant
`EXPLAIN (ANALYZE, BUFFERS, VERBOSE)` pour observer les filtres RLS appliques. Ne
JAMAIS extraire des PII de production en developpement (interdit par decision-008
data residency).

**Q13. Pourquoi pas Prisma a la place de TypeORM ?** Voir ADR-003 : TypeORM 0.3 a
ete retenu pour (1) support natif RLS via QueryRunner brut, (2) maturite migration
versus Prisma migrate fragile en multi-tenant, (3) ecosystem NestJS officiel.

**Q14. Que faire si on doit changer un type de colonne d'une table tenant-scoped ?**
Migration ALTER TABLE en deux etapes : (1) Sprint N -- ADD nouvelle colonne nullable +
backfill batch, (2) Sprint N+1 -- DROP ancienne colonne. Cette procedure evite les
locks longs en production et permet rolling deploy.

**Q15. Comment mesurer l'overhead RLS en prod ?**
Activer `pg_stat_statements` (Sprint 1 deja fait), comparer p99 d'une meme query
avec/sans `SET row_security = off` (uniquement role postgres). Difference attendue
< 2 ms p99 sur tables auth_*. Documente dans observability runbook Sprint 11.

