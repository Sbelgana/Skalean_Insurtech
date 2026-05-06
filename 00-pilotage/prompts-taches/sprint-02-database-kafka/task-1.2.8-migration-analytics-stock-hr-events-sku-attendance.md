# Task 1.2.8 -- Migration "Analytics + Stock + HR" -- 5 tables (1 Analytics + 2 Stock + 2 HR)

> Sprint 2 / Phase 1 -- Fondations Database & Kafka
> Duree estimee : 5h
> Priorite : P0 (bloquant Sprint 13 Analytics ETL ClickHouse, Sprint 13 Stock alertes, Sprint 13 paie CNSS/AMO)
> Depend de : task-1.2.7 (Migration Files + Notifications + Audit terminee, base PARTIE1 horizontale a 75% achevee)
> AUCUNE EMOJI dans ce fichier ni dans les fichiers generes (regle Skalean absolue, decision-016)

---

## 1. Header

| Champ | Valeur |
|-------|--------|
| Identifiant tache | 1.2.8 |
| Sprint | Sprint 2 (Database & Kafka Foundation) |
| Phase | Phase 1 -- Fondations |
| Duree | 5h |
| Priorite | P0 -- bloquant |
| Type livrable | Migration TypeORM 0.3.x + 5 entities + 4 helpers metier (FIFO, Attendance, Ramadan, CNSS) + tests RLS + tests FIFO + tests Ramadan |
| Depend de | task-1.2.7 |
| Bloque | task-1.2.9 (RLS test cross-tenant integration), task-1.2.10 (Seeders dev/test), Sprint 13 Analytics ETL, Sprint 13 Stock alertes, Sprint 13 Paie CNSS/AMO, Sprint 20 Vertical Repair stock |
| Module NestJS | `@skalean/database` (PARTIE1 -- horizontaux dernier batch) |
| Decisions liees | decision-002 (Multi-tenant Postgres RLS), decision-003 (Append-only audit/analytics), decision-008 (Data residency Maroc OVHcloud Gravelines + Roubaix), decision-013 (CNSS/AMO conformite paie), decision-014 (Stock FIFO valuation), decision-018 (Ramadan calendar API ou table cached) |
| Branches Git | `feat/sprint-2/task-1.2.8-migration-analytics-stock-hr` |
| Reviewer obligatoire | Lead Backend + Lead RH/Conformite MA + Lead Comptabilite (FIFO impact bilan) |

> Important : c'est la **8eme et derniere** migration de tables horizontales de PARTIE1. Apres 1.2.8, toutes les tables transverses sont posees (auth, tenants, roles, files, notifications, audit, analytics, stock, HR). PARTIE2 verticales metier (Repair, FlexPay, Telematics) commencera Sprint 9.
> Important : la table `analytics_events` est append-only et est preparee pour partitionnement par mois (declenche Sprint 35 quand volumetrie depasse 50M lignes/mois). Ne pas creer la partition declarative ici, juste la cle primaire compatible.
> Important : la regle Ramadan est encadree par le **decret du Travail Article 184** au Maroc -- reduction horaire obligatoire pendant le mois de Ramadan, avec pauses augmentees (priere du Dohr et Asr + repas du Iftar approchant). Le helper `RamadanCalendar` doit retourner les dates de chaque annee.

---

## 2. But (3 paragraphes)

### Paragraphe 1 -- Analytics events comme base ETL ClickHouse Sprint 13

La table `analytics_events` est la **source unique** d'evenements produit (page_view, button_click, form_submit, repair_order_created, payment_completed, etc.) qui sera consommee par le pipeline ETL Postgres -> Kafka -> ClickHouse en Sprint 13. Le schema est append-only volontairement : aucun UPDATE n'est autorise (verifie par RLS policy `FOR UPDATE USING (false)`), le delete est limite au TTL retention (1095 jours = 3 ans, conforme Loi 09-08 CNDP article 11). Les `properties` sont stockees en JSONB sans schema strict cote Postgres mais avec schema Zod au niveau application (discriminated union par `event_name`). Cette flexibilite permet d'ajouter de nouveaux events sans migration, mais impose une discipline TypeScript stricte. La preparation au partitioning par mois est faite via une cle primaire composite `(occurred_at, id)` (PostgreSQL >= 11 partition declarative requirement) -- la transformation en table partitionnee se fait Sprint 35 sans changement de schema applicatif.

### Paragraphe 2 -- Stock FIFO comme fondation Vertical Repair Sprint 20

Les tables `stock_items` et `stock_movements` constituent le module stock generique (pieces detachees garage, peinture, consommables, fournitures bureau). Le modele est **append-only sur les mouvements** : on ne modifie jamais une ligne `stock_movements`, on ajoute un nouvel `adjustment` ou `inventory` correctif. La quantite courante `current_quantity` dans `stock_items` est une projection cachee maintenue par triggers Postgres (synchronisation immediate) ou recalculee par service Sprint 13 (rebuild from movements). Le calcul de valeur `unit_price_ht_at_time` au moment du mouvement est CRUCIAL pour le FIFO (First In First Out) : sans cette colonne, on ne peut pas calculer la valeur du stock a une date donnee, ce qui impacte directement le bilan comptable. Le seuil `min_threshold` declenche une alerte WhatsApp/Email Sprint 13 via index partiel performant. Le module sera utilise par Vertical Repair Sprint 20 pour gerer les pieces detachees (filtres, plaquettes, peintures).

### Paragraphe 3 -- HR paie CNSS/AMO + Ramadan specifique Maroc

Les tables `hr_employees` et `hr_attendance` sont la fondation du module Paie Sprint 13 conforme au droit du travail marocain. La distinction `role` metier (mecanicien, tolier, peintre, chef_atelier, expert, comptable, commercial, admin) vs `role` applicatif `auth_tenant_users.role` (owner, admin, manager, employee, viewer) est essentielle : un employe peut etre mecanicien (metier) avec acces applicatif `manager`. Le `social_security_number` suit le format CNSS Maroc (9 chiffres, validation regex ECMA `/^[0-9]{9}$/`). Les taux CNSS (4.48% employe / 8.98% employeur) et AMO (2.26% / 4.11%) sont stockes en variables d'environnement pour adaptabilite reglementaire (DGI peut modifier annuellement). Le champ `break_minutes` capture la specificite Ramadan : le decret du Travail Article 184 impose une reduction horaire de 30 minutes minimum durant le mois sacre, ainsi que des pauses augmentees pour priere et Iftar. Le helper `RamadanCalendar` consulte une table cached annuelle (Sprint 35 : API Bank Al-Maghrib calendrier officiel) pour determiner si une date donnee est dans Ramadan. Le decret du Travail Article 25 impose retention paie 7 ans (vs CNDP 3 ans pour analytics) -- attention conflit retention.

---

## 3. Contexte etendu

### 3.1 Pourquoi append-only sur analytics_events vs UPDATE

Un event analytics est par nature un **fait historique** : "user X a clique sur button Y a 14:32:15.123". Modifier cet event apres coup serait une **falsification**. Les implications techniques :

- **Auditabilite** : un superviseur CNDP (Loi 09-08) peut demander un export brut sans risque que les donnees aient ete altereees.
- **ETL ClickHouse simplicite** : l'ETL Sprint 13 fait un `WHERE created_at > last_sync` simple, sans CDC complexe (Change Data Capture). Si UPDATE etait possible, il faudrait un mecanisme `updated_at` + Debezium / logical replication, ajoutant de la complexite.
- **Performance ecriture** : INSERT seul est plus rapide que UPDATE (pas de MVCC dead tuples a vacuumer pour des UPDATE frequents).
- **Idempotence ETL** : l'ETL peut rejouer un batch sans corruption.

La RLS policy `FOR UPDATE USING (false)` interdit les UPDATE meme via un role applicatif compromis. La seule operation autorisee est le DELETE par TTL (3 ans CNDP) execute par un job pg_cron Sprint 35.

### 3.2 Alternatives ClickHouse direct vs Postgres + ETL

Trois alternatives ont ete considerees pour la stack analytics :

**Option A** : Ecriture directe ClickHouse depuis l'application backend.
- Avantage : pas de duplication, ClickHouse natif analytique (1000x plus rapide que Postgres pour aggregation).
- Inconvenient : pas de RLS multi-tenant ClickHouse natif (workaround via row policies experimental). Pas de transactions ACID. Backend doit gerer 2 stacks DB.

**Option B** : Ecriture Postgres uniquement, ClickHouse jamais.
- Avantage : simplicite, une seule DB.
- Inconvenient : Postgres devient lent au-dela de 50M events (queries `GROUP BY date_trunc` sur 6 mois = 30 secondes+).

**Option C (RETENUE)** : Ecriture Postgres append-only -> Kafka topic `analytics.events` -> ClickHouse via Kafka engine.
- Avantage : RLS Postgres pour les operations transactionnelles. ClickHouse ultra-rapide pour dashboards. Decouplage temporel.
- Inconvenient : duplication donnees (gere par TTL CNDP 3 ans Postgres / 5 ans ClickHouse pour business metrics).

La table `analytics_events` Sprint 2 est dimensionnee pour Option C. Sprint 13 ajoute le producteur Kafka, Sprint 13 ajoute le consumer ClickHouse.

### 3.3 Trade-offs partitioning : month vs week vs day

Decision : **partition par mois** (preparation Sprint 35).

- **Day partitions** (1825 partitions sur 5 ans) : trop granulaire, Postgres degrade au-dela de 1000 partitions actives (constraint exclusion overhead). Avantage : DROP PARTITION rapide pour TTL.
- **Week partitions** (260 partitions sur 5 ans) : compromis acceptable mais requetes BI souvent par mois.
- **Month partitions** (60 partitions sur 5 ans) : meilleur compromis. Queries dashboard `GROUP BY date_trunc('month', occurred_at)` benefice du partition pruning. DROP PARTITION pour TTL retention 36 mois = 36 DROP simples.

La cle primaire est `(occurred_at, id)` (composite) pour permettre la transformation en table partitionnee `PARTITION BY RANGE (occurred_at)` Sprint 35 sans migration applicative.

### 3.4 Decisions architecturales liees

- **decision-002** (Multi-tenant Postgres RLS) : RLS sur les 5 tables, pas d'exception. Cross-tenant analytics aggregations Sprint 13 passent par un service `analytics-cross-tenant` avec role superuser limite.
- **decision-003** (Append-only audit/analytics) : extension a stock_movements et hr_attendance. Pas append-only sur stock_items (current_quantity update) ni hr_employees (full_name peut changer apres mariage par exemple).
- **decision-008** (Data residency Maroc) : OVHcloud Gravelines (RGPD compatible) avec replication Roubaix. Pas de replication hors UE/Maroc. Documentation CNDP article 18.
- **decision-013** (CNSS/AMO conformite paie) : taux en env vars, pas en code. CNSS plafond mensuel 6000 MAD (au-dela pas de cotisation salariale CNSS). AMO sans plafond.
- **decision-014** (Stock FIFO valuation) : First In First Out, methode acceptee Maroc DGI Article 24 Code General Impots. Alternative LIFO interdite Maroc.
- **decision-018** (Ramadan calendar) : table cachee annuelle, source officielle Ministere des Habous et Affaires Islamiques Maroc.

### 3.5 12 Pieges courants

**Piege 1 : analytics_events 100M+ rows sans partition.** Sans partitioning, Postgres degrade severement au-dela de 100M lignes (vacuum lent, index bloat, requetes BI 30s+). Solution : preparer cle primaire compatible partitioning Sprint 2, faire la conversion declarative Sprint 35 quand volumetrie atteint 30M.

**Piege 2 : stock_items.current_quantity drift vs movements.** Si on UPDATE `current_quantity` directement sans INSERT mouvement correspondant, la projection diverge de la source de verite. Solution : trigger BEFORE UPDATE qui interdit les UPDATE manuels (sauf via role `stock-recalc-service`), ou rebuild quotidien Sprint 13 verifie coherence.

**Piege 3 : FIFO unit_price_ht_at_time crucial.** Si on stocke uniquement `quantity` sans `unit_price_ht_at_time`, on ne peut pas calculer la valeur du stock a une date donnee (FIFO = dernieres entrees premieres sorties). Solution : colonne obligatoire NOT NULL, snapshotee depuis stock_items.unit_price_ht au moment du mouvement.

**Piege 4 : hr_employees CNSS format 9 chiffres MA.** L'ancien format CNSS (avant 2018) etait 8 chiffres, le nouveau 9 chiffres. Validation regex `/^[0-9]{9}$/` rejettera les anciens employes migres. Solution : permettre format mixte avec regex `/^[0-9]{8,9}$/` et flag `cnss_format_version`.

**Piege 5 : attendance midnight rollover.** Un mecanicien commence shift 22:00 et termine 02:00 le lendemain. Si check_in_at et check_out_at sont sur dates differentes, le calcul `EXTRACT(EPOCH FROM (check_out - check_in)) / 60` doit etre robuste. Solution : autoriser `check_out_at < check_in_at` invalide mais `check_out_at` peut etre J+1 par rapport a `check_in_at` date naturelle.

**Piege 6 : Ramadan break detect annuel.** Le mois de Ramadan se decale de 11 jours chaque annee gregorien. Hardcoder les dates 2026 = obsolete 2027. Solution : table `hr_ramadan_calendar` chargee annuellement par seeder, avec source officielle Ministere des Habous.

**Piege 7 : employee_number gap.** Si on assigne employee_number par sequence Postgres et un employe est supprime, on a un gap (E001, E002, E004). Comptabilite peut alerter. Solution : utiliser sequence + accepter gaps (recommande), ou recyclage explicite (deconseille car traçabilite).

**Piege 8 : soft delete employee orphan attendance.** Si on soft-delete un employe (active=false), ses attendance restent. Reporting "presence du mois" doit filtrer `WHERE employee.active = true`. Solution : vue `hr_attendance_active` join + filter.

**Piege 9 : JSONB properties schema drift.** Sans schema applicatif, deux developpeurs peuvent stocker `{userId: 'x'}` et `{user_id: 'x'}` pour le meme champ logique. Solution : schema Zod centralise par event_name, validation au niveau du service Producer Sprint 13.

**Piege 10 : partial index min_threshold alert.** Un index `WHERE current_quantity <= min_threshold` est partiel mais doit etre maintenu. Si tous les items sont au-dessus du seuil, l'index est vide (ideal). Si crash et 50% sous seuil, index croit mais reste utile. Solution : index partiel `(tenant_id, current_quantity, min_threshold) WHERE current_quantity <= min_threshold`.

**Piege 11 : stock movement type signe convention.** Convention `quantity > 0` toujours, et `movement_type` indique le signe applique. Alternative `quantity` signe (negatif pour 'out'). Solution : convention SIGNED -- `quantity` toujours positif, type indique l'effet (`in` += quantity, `out` -= quantity, `adjustment` peut etre positif ou negatif via colonne `adjustment_signed_quantity` separee).

**Piege 12 : partition key strategy month vs week.** Voir section 3.3. Decision month.

---

## 4. Architecture context

Cette migration cloture la **PARTIE1 horizontale** (8 migrations Sprint 2) :

- 1.2.1 : tenants + auth_users + auth_tenant_users
- 1.2.2 : auth_sessions + auth_refresh_tokens + auth_oauth_providers
- 1.2.3 : tenant_settings + auth_password_resets
- 1.2.4 : roles + permissions + role_permissions + tenant_user_roles
- 1.2.5 : invitations + auth_logs + auth_2fa
- 1.2.6 : tenant_subscriptions + tenant_features
- 1.2.7 : files + notifications + audit_logs
- 1.2.8 : analytics_events + stock_items + stock_movements + hr_employees + hr_attendance (cette tache)

Au sortir de 1.2.8, le module `@skalean/database` PARTIE1 contient **31 tables** transverses utilisables par toutes les verticales metier (PARTIE2). Sprint 9 demarrera PARTIE2 avec Vertical Repair (repair_orders, repair_lines, repair_invoices) qui utilisera `stock_items` et `hr_employees` directement.

Diagramme dependances PARTIE1 -> Sprint 13 :

```
analytics_events ----> [Producer Kafka analytics.events Sprint 13] ----> ClickHouse
stock_items     <----> [StockService Sprint 13 + alertes WhatsApp Sprint 13]
stock_movements
hr_employees    ----> [PaieService Sprint 13 calcul CNSS/AMO]
hr_attendance   ----> [TimesheetService Sprint 13 calcul heures + Ramadan reduction]
```

PARTIE1 aura ete livree en Sprint 2 (5 jours equipe 4 dev), PARTIE2 demarre Sprint 9 (apres Sprint 3 Auth, Sprint 4 Tenants, Sprint 5 Files, Sprint 6 Notifications, Sprint 7 Roles, Sprint 8 OAuth+2FA).

---

## 5. Livrables checkables (28 items)

- [ ] L1. Fichier `apps/api/src/database/migrations/1735000000007-AnalyticsStockHR.ts` cree avec up()/down() complets
- [ ] L2. Entity `AnalyticsEventEntity` creee dans `apps/api/src/database/entities/analytics/analytics-event.entity.ts`
- [ ] L3. Entity `StockItemEntity` creee dans `apps/api/src/database/entities/stock/stock-item.entity.ts`
- [ ] L4. Entity `StockMovementEntity` creee dans `apps/api/src/database/entities/stock/stock-movement.entity.ts`
- [ ] L5. Entity `HrEmployeeEntity` creee dans `apps/api/src/database/entities/hr/hr-employee.entity.ts`
- [ ] L6. Entity `HrAttendanceEntity` creee dans `apps/api/src/database/entities/hr/hr-attendance.entity.ts`
- [ ] L7. Index files `analytics/index.ts`, `stock/index.ts`, `hr/index.ts` reexportent toutes entities
- [ ] L8. Helper `StockFifoCalculator` cree dans `apps/api/src/database/helpers/stock-fifo-calculator.ts`
- [ ] L9. Helper `AttendanceValidator` cree dans `apps/api/src/database/helpers/attendance-validator.ts`
- [ ] L10. Helper `RamadanCalendar` cree dans `apps/api/src/database/helpers/ramadan-calendar.ts`
- [ ] L11. Helper `CnssValidator` cree dans `apps/api/src/database/helpers/cnss-validator.ts`
- [ ] L12. Schema Zod `AnalyticsEventProperties` discriminated union dans `apps/api/src/database/schemas/analytics-event-properties.schema.ts`
- [ ] L13. Migration up() : 5 CREATE TABLE corrects avec types numeric 15,2 et 15,3
- [ ] L14. Migration up() : RLS active sur 5 tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`)
- [ ] L15. Migration up() : 4 policies par table (SELECT/INSERT/UPDATE/DELETE) avec USING tenant_id = current_tenant_id
- [ ] L16. Migration up() : analytics_events UPDATE policy `USING (false)` (append-only)
- [ ] L17. Migration up() : stock_movements UPDATE policy `USING (false)` (append-only)
- [ ] L18. Migration up() : hr_attendance UPDATE policy `USING (false)` (append-only)
- [ ] L19. Migration up() : index partiel `WHERE current_quantity <= min_threshold` sur stock_items
- [ ] L20. Migration up() : index `(tenant_id, occurred_at DESC)` sur analytics_events
- [ ] L21. Migration up() : UNIQUE (tenant_id, sku) sur stock_items
- [ ] L22. Migration up() : UNIQUE (tenant_id, employee_number) sur hr_employees
- [ ] L23. Tests `migrations-analytics-stock-hr.spec.ts` >= 8 tests passent
- [ ] L24. Tests `rls-analytics.spec.ts` + `rls-stock.spec.ts` + `rls-hr.spec.ts` >= 14 tests cumules passent
- [ ] L25. Tests `stock-fifo.spec.ts` >= 8 tests passent (in/out FIFO order, valuation date, partial out, adjustment, inventory)
- [ ] L26. Tests `attendance-validator.spec.ts` >= 6 tests passent (Ramadan, midnight rollover, breaks)
- [ ] L27. Tests `cnss-format.spec.ts` >= 4 tests passent
- [ ] L28. Variables env >= 18 ajoutees dans `.env.example` et `apps/api/src/config/env.schema.ts`

---

## 6. Fichiers crees / modifies

| Fichier | Type | Lignes approx |
|---------|------|----------------|
| `apps/api/src/database/migrations/1735000000007-AnalyticsStockHR.ts` | Cree | 220 |
| `apps/api/src/database/entities/analytics/analytics-event.entity.ts` | Cree | 60 |
| `apps/api/src/database/entities/analytics/index.ts` | Cree | 5 |
| `apps/api/src/database/entities/stock/stock-item.entity.ts` | Cree | 55 |
| `apps/api/src/database/entities/stock/stock-movement.entity.ts` | Cree | 50 |
| `apps/api/src/database/entities/stock/index.ts` | Cree | 6 |
| `apps/api/src/database/entities/hr/hr-employee.entity.ts` | Cree | 60 |
| `apps/api/src/database/entities/hr/hr-attendance.entity.ts` | Cree | 45 |
| `apps/api/src/database/entities/hr/index.ts` | Cree | 6 |
| `apps/api/src/database/helpers/stock-fifo-calculator.ts` | Cree | 110 |
| `apps/api/src/database/helpers/attendance-validator.ts` | Cree | 90 |
| `apps/api/src/database/helpers/ramadan-calendar.ts` | Cree | 80 |
| `apps/api/src/database/helpers/cnss-validator.ts` | Cree | 50 |
| `apps/api/src/database/schemas/analytics-event-properties.schema.ts` | Cree | 95 |
| `apps/api/src/database/__tests__/migrations-analytics-stock-hr.spec.ts` | Cree | 220 |
| `apps/api/src/database/__tests__/rls-analytics.spec.ts` | Cree | 140 |
| `apps/api/src/database/__tests__/rls-stock.spec.ts` | Cree | 180 |
| `apps/api/src/database/__tests__/rls-hr.spec.ts` | Cree | 170 |
| `apps/api/src/database/__tests__/stock-fifo.spec.ts` | Cree | 230 |
| `apps/api/src/database/__tests__/attendance-validator.spec.ts` | Cree | 180 |
| `apps/api/src/database/__tests__/cnss-format.spec.ts` | Cree | 90 |
| `apps/api/src/database/__tests__/analytics-properties.spec.ts` | Cree | 110 |
| `apps/api/src/config/env.schema.ts` | Modifie | +25 |
| `.env.example` | Modifie | +20 |
| `package.json` | Inchange | -- |

---

## 7. Code patterns COMPLETS

### 7.1 Migration `1735000000007-AnalyticsStockHR.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AnalyticsStockHR1735000000007 implements MigrationInterface {
  name = 'AnalyticsStockHR1735000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ===========================================================
    // 1. ENUM types
    // ===========================================================
    await queryRunner.query(`
      CREATE TYPE stock_unit_enum AS ENUM ('unit', 'liter', 'kg', 'meter');
    `);
    await queryRunner.query(`
      CREATE TYPE stock_movement_type_enum AS ENUM ('in', 'out', 'adjustment', 'inventory');
    `);
    await queryRunner.query(`
      CREATE TYPE hr_role_enum AS ENUM (
        'mecanicien', 'tolier', 'peintre', 'chef_atelier',
        'expert', 'comptable', 'commercial', 'admin'
      );
    `);

    // ===========================================================
    // 2. TABLE analytics_events (append-only, partition-ready)
    // ===========================================================
    await queryRunner.query(`
      CREATE TABLE analytics_events (
        id            uuid          NOT NULL DEFAULT gen_random_uuid(),
        tenant_id     uuid          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        event_name    text          NOT NULL CHECK (length(event_name) BETWEEN 1 AND 128),
        user_id       uuid          REFERENCES auth_users(id) ON DELETE SET NULL,
        session_id    text          CHECK (session_id IS NULL OR length(session_id) BETWEEN 1 AND 128),
        properties    jsonb         NOT NULL DEFAULT '{}'::jsonb,
        occurred_at   timestamptz   NOT NULL DEFAULT now(),
        created_at    timestamptz   NOT NULL DEFAULT now(),
        PRIMARY KEY (occurred_at, id)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_tenant_occurred
        ON analytics_events (tenant_id, occurred_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_event_name
        ON analytics_events (tenant_id, event_name, occurred_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_user
        ON analytics_events (tenant_id, user_id, occurred_at DESC)
        WHERE user_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_session
        ON analytics_events (tenant_id, session_id, occurred_at DESC)
        WHERE session_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analytics_events_properties_gin
        ON analytics_events USING GIN (properties jsonb_path_ops);
    `);
    await queryRunner.query(`ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY analytics_events_select_policy ON analytics_events
        FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY analytics_events_insert_policy ON analytics_events
        FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY analytics_events_update_policy ON analytics_events
        FOR UPDATE USING (false);
    `);
    await queryRunner.query(`
      CREATE POLICY analytics_events_delete_policy ON analytics_events
        FOR DELETE USING (
          tenant_id = current_setting('app.current_tenant_id', true)::uuid
          AND occurred_at < (now() - interval '1095 days')
        );
    `);

    // ===========================================================
    // 3. TABLE stock_items
    // ===========================================================
    await queryRunner.query(`
      CREATE TABLE stock_items (
        id                uuid             NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id         uuid             NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        sku               text             NOT NULL CHECK (length(sku) BETWEEN 1 AND 64),
        name              text             NOT NULL CHECK (length(name) BETWEEN 1 AND 256),
        description       text             CHECK (description IS NULL OR length(description) <= 4096),
        category          text             CHECK (category IS NULL OR length(category) <= 128),
        unit              stock_unit_enum  NOT NULL DEFAULT 'unit',
        unit_price_ht     numeric(15,2)    NOT NULL DEFAULT 0 CHECK (unit_price_ht >= 0),
        tva_rate          numeric(5,2)     NOT NULL DEFAULT 20.00 CHECK (tva_rate >= 0 AND tva_rate <= 100),
        current_quantity  numeric(15,3)    NOT NULL DEFAULT 0,
        min_threshold     numeric(15,3)    NOT NULL DEFAULT 0 CHECK (min_threshold >= 0),
        supplier_name     text             CHECK (supplier_name IS NULL OR length(supplier_name) <= 256),
        created_at        timestamptz      NOT NULL DEFAULT now(),
        updated_at        timestamptz      NOT NULL DEFAULT now(),
        CONSTRAINT uq_stock_items_tenant_sku UNIQUE (tenant_id, sku)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_items_tenant_low
        ON stock_items (tenant_id, current_quantity, min_threshold)
        WHERE current_quantity <= min_threshold;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_items_tenant_category
        ON stock_items (tenant_id, category)
        WHERE category IS NOT NULL;
    `);
    await queryRunner.query(`ALTER TABLE stock_items ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY stock_items_select_policy ON stock_items
        FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY stock_items_insert_policy ON stock_items
        FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY stock_items_update_policy ON stock_items
        FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY stock_items_delete_policy ON stock_items
        FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);

    // ===========================================================
    // 4. TABLE stock_movements (append-only)
    // ===========================================================
    await queryRunner.query(`
      CREATE TABLE stock_movements (
        id                       uuid                       NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id                uuid                       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        item_id                  uuid                       NOT NULL REFERENCES stock_items(id) ON DELETE RESTRICT,
        movement_type            stock_movement_type_enum   NOT NULL,
        quantity                 numeric(15,3)              NOT NULL CHECK (quantity > 0),
        unit_price_ht_at_time    numeric(15,2)              NOT NULL CHECK (unit_price_ht_at_time >= 0),
        related_resource_type    text                       CHECK (related_resource_type IS NULL OR length(related_resource_type) <= 64),
        related_resource_id      uuid,
        reason                   text                       CHECK (reason IS NULL OR length(reason) <= 1024),
        created_by               uuid                       REFERENCES auth_users(id) ON DELETE SET NULL,
        created_at               timestamptz                NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_movements_tenant_item_created
        ON stock_movements (tenant_id, item_id, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_movements_tenant_type
        ON stock_movements (tenant_id, movement_type, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_stock_movements_related
        ON stock_movements (tenant_id, related_resource_type, related_resource_id)
        WHERE related_resource_id IS NOT NULL;
    `);
    await queryRunner.query(`ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY stock_movements_select_policy ON stock_movements
        FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY stock_movements_insert_policy ON stock_movements
        FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY stock_movements_update_policy ON stock_movements
        FOR UPDATE USING (false);
    `);
    await queryRunner.query(`
      CREATE POLICY stock_movements_delete_policy ON stock_movements
        FOR DELETE USING (false);
    `);

    // ===========================================================
    // 5. TABLE hr_employees
    // ===========================================================
    await queryRunner.query(`
      CREATE TABLE hr_employees (
        id                          uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id                   uuid           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id                     uuid           REFERENCES auth_users(id) ON DELETE SET NULL,
        full_name                   text           NOT NULL CHECK (length(full_name) BETWEEN 1 AND 256),
        role                        hr_role_enum   NOT NULL,
        employee_number             text           NOT NULL CHECK (length(employee_number) BETWEEN 1 AND 32),
        hire_date                   date           NOT NULL,
        hourly_rate_dirham          numeric(15,2)  CHECK (hourly_rate_dirham IS NULL OR hourly_rate_dirham >= 0),
        monthly_salary_dirham       numeric(15,2)  CHECK (monthly_salary_dirham IS NULL OR monthly_salary_dirham >= 0),
        social_security_number      text           CHECK (social_security_number IS NULL OR social_security_number ~ '^[0-9]{8,9}$'),
        active                      boolean        NOT NULL DEFAULT true,
        created_at                  timestamptz    NOT NULL DEFAULT now(),
        updated_at                  timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT uq_hr_employees_tenant_number UNIQUE (tenant_id, employee_number),
        CONSTRAINT chk_hr_employees_compensation CHECK (hourly_rate_dirham IS NOT NULL OR monthly_salary_dirham IS NOT NULL)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_employees_tenant_active
        ON hr_employees (tenant_id, active);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_employees_tenant_role
        ON hr_employees (tenant_id, role)
        WHERE active = true;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_employees_user
        ON hr_employees (user_id)
        WHERE user_id IS NOT NULL;
    `);
    await queryRunner.query(`ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY hr_employees_select_policy ON hr_employees
        FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY hr_employees_insert_policy ON hr_employees
        FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY hr_employees_update_policy ON hr_employees
        FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY hr_employees_delete_policy ON hr_employees
        FOR DELETE USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);

    // ===========================================================
    // 6. TABLE hr_attendance (append-only)
    // ===========================================================
    await queryRunner.query(`
      CREATE TABLE hr_attendance (
        id                uuid           NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        tenant_id         uuid           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        employee_id       uuid           NOT NULL REFERENCES hr_employees(id) ON DELETE RESTRICT,
        check_in_at       timestamptz    NOT NULL,
        check_out_at      timestamptz,
        break_minutes     integer        NOT NULL DEFAULT 0 CHECK (break_minutes >= 0 AND break_minutes <= 720),
        notes             text           CHECK (notes IS NULL OR length(notes) <= 2048),
        created_at        timestamptz    NOT NULL DEFAULT now(),
        CONSTRAINT chk_hr_attendance_checkout_after CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
      );
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_attendance_tenant_employee_checkin
        ON hr_attendance (tenant_id, employee_id, check_in_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_hr_attendance_open
        ON hr_attendance (tenant_id, employee_id)
        WHERE check_out_at IS NULL;
    `);
    await queryRunner.query(`ALTER TABLE hr_attendance ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY hr_attendance_select_policy ON hr_attendance
        FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY hr_attendance_insert_policy ON hr_attendance
        FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY hr_attendance_update_policy ON hr_attendance
        FOR UPDATE USING (
          tenant_id = current_setting('app.current_tenant_id', true)::uuid
          AND check_out_at IS NULL
        ) WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::uuid);
    `);
    await queryRunner.query(`
      CREATE POLICY hr_attendance_delete_policy ON hr_attendance
        FOR DELETE USING (false);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS hr_attendance CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS hr_employees CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_movements CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS stock_items CASCADE;`);
    await queryRunner.query(`DROP TABLE IF EXISTS analytics_events CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS hr_role_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS stock_movement_type_enum;`);
    await queryRunner.query(`DROP TYPE IF EXISTS stock_unit_enum;`);
  }
}
```

### 7.2 Entity `analytics-event.entity.ts`

```typescript
import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantEntity } from '../tenants/tenant.entity';
import { AuthUserEntity } from '../auth/auth-user.entity';

@Entity('analytics_events')
@Index('idx_analytics_events_tenant_occurred', ['tenantId', 'occurredAt'])
export class AnalyticsEventEntity {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @Column({ name: 'event_name', type: 'text' })
  eventName!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => AuthUserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: AuthUserEntity | null;

  @Column({ name: 'session_id', type: 'text', nullable: true })
  sessionId?: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  properties!: Record<string, unknown>;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

### 7.3 Entity `stock-item.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { TenantEntity } from '../tenants/tenant.entity';

export type StockUnit = 'unit' | 'liter' | 'kg' | 'meter';

@Entity('stock_items')
@Unique('uq_stock_items_tenant_sku', ['tenantId', 'sku'])
@Index('idx_stock_items_tenant_category', ['tenantId', 'category'])
export class StockItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @Column({ type: 'text' })
  sku!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', nullable: true })
  category?: string | null;

  @Column({ type: 'enum', enum: ['unit', 'liter', 'kg', 'meter'], default: 'unit' })
  unit!: StockUnit;

  @Column({ name: 'unit_price_ht', type: 'numeric', precision: 15, scale: 2, default: 0 })
  unitPriceHt!: string;

  @Column({ name: 'tva_rate', type: 'numeric', precision: 5, scale: 2, default: 20.0 })
  tvaRate!: string;

  @Column({ name: 'current_quantity', type: 'numeric', precision: 15, scale: 3, default: 0 })
  currentQuantity!: string;

  @Column({ name: 'min_threshold', type: 'numeric', precision: 15, scale: 3, default: 0 })
  minThreshold!: string;

  @Column({ name: 'supplier_name', type: 'text', nullable: true })
  supplierName?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 7.4 Entity `stock-movement.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantEntity } from '../tenants/tenant.entity';
import { StockItemEntity } from './stock-item.entity';
import { AuthUserEntity } from '../auth/auth-user.entity';

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'inventory';

@Entity('stock_movements')
@Index('idx_stock_movements_tenant_item_created', ['tenantId', 'itemId', 'createdAt'])
export class StockMovementEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId!: string;

  @ManyToOne(() => StockItemEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item?: StockItemEntity;

  @Column({
    name: 'movement_type',
    type: 'enum',
    enum: ['in', 'out', 'adjustment', 'inventory'],
  })
  movementType!: StockMovementType;

  @Column({ type: 'numeric', precision: 15, scale: 3 })
  quantity!: string;

  @Column({ name: 'unit_price_ht_at_time', type: 'numeric', precision: 15, scale: 2 })
  unitPriceHtAtTime!: string;

  @Column({ name: 'related_resource_type', type: 'text', nullable: true })
  relatedResourceType?: string | null;

  @Column({ name: 'related_resource_id', type: 'uuid', nullable: true })
  relatedResourceId?: string | null;

  @Column({ type: 'text', nullable: true })
  reason?: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy?: string | null;

  @ManyToOne(() => AuthUserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: AuthUserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

### 7.5 Entity `hr-employee.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { TenantEntity } from '../tenants/tenant.entity';
import { AuthUserEntity } from '../auth/auth-user.entity';

export type HrRole =
  | 'mecanicien'
  | 'tolier'
  | 'peintre'
  | 'chef_atelier'
  | 'expert'
  | 'comptable'
  | 'commercial'
  | 'admin';

@Entity('hr_employees')
@Unique('uq_hr_employees_tenant_number', ['tenantId', 'employeeNumber'])
@Index('idx_hr_employees_tenant_active', ['tenantId', 'active'])
export class HrEmployeeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => AuthUserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: AuthUserEntity | null;

  @Column({ name: 'full_name', type: 'text' })
  fullName!: string;

  @Column({
    type: 'enum',
    enum: [
      'mecanicien',
      'tolier',
      'peintre',
      'chef_atelier',
      'expert',
      'comptable',
      'commercial',
      'admin',
    ],
  })
  role!: HrRole;

  @Column({ name: 'employee_number', type: 'text' })
  employeeNumber!: string;

  @Column({ name: 'hire_date', type: 'date' })
  hireDate!: string;

  @Column({ name: 'hourly_rate_dirham', type: 'numeric', precision: 15, scale: 2, nullable: true })
  hourlyRateDirham?: string | null;

  @Column({ name: 'monthly_salary_dirham', type: 'numeric', precision: 15, scale: 2, nullable: true })
  monthlySalaryDirham?: string | null;

  @Column({ name: 'social_security_number', type: 'text', nullable: true })
  socialSecurityNumber?: string | null;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 7.6 Entity `hr-attendance.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantEntity } from '../tenants/tenant.entity';
import { HrEmployeeEntity } from './hr-employee.entity';

@Entity('hr_attendance')
@Index('idx_hr_attendance_tenant_employee_checkin', ['tenantId', 'employeeId', 'checkInAt'])
export class HrAttendanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: TenantEntity;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => HrEmployeeEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee?: HrEmployeeEntity;

  @Column({ name: 'check_in_at', type: 'timestamptz' })
  checkInAt!: Date;

  @Column({ name: 'check_out_at', type: 'timestamptz', nullable: true })
  checkOutAt?: Date | null;

  @Column({ name: 'break_minutes', type: 'integer', default: 0 })
  breakMinutes!: number;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

### 7.7 Index files

`apps/api/src/database/entities/analytics/index.ts` :
```typescript
export { AnalyticsEventEntity } from './analytics-event.entity';
```

`apps/api/src/database/entities/stock/index.ts` :
```typescript
export { StockItemEntity, StockUnit } from './stock-item.entity';
export { StockMovementEntity, StockMovementType } from './stock-movement.entity';
```

`apps/api/src/database/entities/hr/index.ts` :
```typescript
export { HrEmployeeEntity, HrRole } from './hr-employee.entity';
export { HrAttendanceEntity } from './hr-attendance.entity';
```

### 7.8 Helper `stock-fifo-calculator.ts`

```typescript
import { DataSource } from 'typeorm';
import { StockMovementEntity } from '../entities/stock/stock-movement.entity';

export interface FifoLayer {
  movementId: string;
  remainingQuantity: number;
  unitPriceHt: number;
  enteredAt: Date;
}

export interface FifoValuation {
  itemId: string;
  asOfDate: Date;
  totalQuantity: number;
  totalValueHt: number;
  weightedAverageUnitPrice: number;
  layers: FifoLayer[];
}

export class StockFifoCalculator {
  constructor(private readonly dataSource: DataSource) {}

  async calculateValueAt(itemId: string, asOfDate: Date): Promise<FifoValuation> {
    const repo = this.dataSource.getRepository(StockMovementEntity);
    const movements = await repo.find({
      where: { itemId },
      order: { createdAt: 'ASC' },
    });

    const filtered = movements.filter((m) => m.createdAt <= asOfDate);
    const layers: FifoLayer[] = [];

    for (const mvt of filtered) {
      const qty = Number(mvt.quantity);
      const price = Number(mvt.unitPriceHtAtTime);

      if (mvt.movementType === 'in' || (mvt.movementType === 'inventory' && qty > 0)) {
        layers.push({
          movementId: mvt.id,
          remainingQuantity: qty,
          unitPriceHt: price,
          enteredAt: mvt.createdAt,
        });
      } else if (mvt.movementType === 'out') {
        let toRemove = qty;
        while (toRemove > 0 && layers.length > 0) {
          const head = layers[0];
          if (head.remainingQuantity <= toRemove) {
            toRemove -= head.remainingQuantity;
            layers.shift();
          } else {
            head.remainingQuantity -= toRemove;
            toRemove = 0;
          }
        }
      } else if (mvt.movementType === 'adjustment') {
        const signed = Number(mvt.quantity);
        if (signed > 0) {
          layers.push({
            movementId: mvt.id,
            remainingQuantity: signed,
            unitPriceHt: price,
            enteredAt: mvt.createdAt,
          });
        } else {
          let toRemove = Math.abs(signed);
          while (toRemove > 0 && layers.length > 0) {
            const head = layers[0];
            if (head.remainingQuantity <= toRemove) {
              toRemove -= head.remainingQuantity;
              layers.shift();
            } else {
              head.remainingQuantity -= toRemove;
              toRemove = 0;
            }
          }
        }
      }
    }

    const totalQuantity = layers.reduce((s, l) => s + l.remainingQuantity, 0);
    const totalValueHt = layers.reduce((s, l) => s + l.remainingQuantity * l.unitPriceHt, 0);
    const weightedAverageUnitPrice = totalQuantity > 0 ? totalValueHt / totalQuantity : 0;

    return {
      itemId,
      asOfDate,
      totalQuantity,
      totalValueHt: Math.round(totalValueHt * 100) / 100,
      weightedAverageUnitPrice: Math.round(weightedAverageUnitPrice * 100) / 100,
      layers,
    };
  }
}
```

### 7.9 Helper `attendance-validator.ts`

```typescript
import { RamadanCalendar } from './ramadan-calendar';

export interface AttendanceValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalWorkedMinutes: number;
  effectiveBreakMinutes: number;
  isRamadan: boolean;
}

export interface AttendanceInput {
  checkInAt: Date;
  checkOutAt: Date | null;
  breakMinutes: number;
  ramadanReductionMinutes?: number;
}

export class AttendanceValidator {
  constructor(private readonly ramadanCalendar: RamadanCalendar) {}

  async validate(input: AttendanceInput): Promise<AttendanceValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const reduction = input.ramadanReductionMinutes ?? 30;

    if (input.breakMinutes < 0) {
      errors.push('break_minutes must be >= 0');
    }
    if (input.breakMinutes > 720) {
      errors.push('break_minutes cannot exceed 720 (12h)');
    }
    if (input.checkOutAt && input.checkOutAt < input.checkInAt) {
      errors.push('check_out_at must be >= check_in_at');
    }

    const isRamadan = await this.ramadanCalendar.isRamadan(input.checkInAt);
    let effectiveBreakMinutes = input.breakMinutes;

    if (isRamadan && input.breakMinutes < reduction) {
      warnings.push(
        `Ramadan period detected, breaks should be at least ${reduction} minutes (decret du Travail Article 184). Auto-extending.`,
      );
      effectiveBreakMinutes = reduction;
    }

    let totalWorkedMinutes = 0;
    if (input.checkOutAt) {
      const totalMs = input.checkOutAt.getTime() - input.checkInAt.getTime();
      const totalMinutes = Math.floor(totalMs / 60000);
      totalWorkedMinutes = Math.max(0, totalMinutes - effectiveBreakMinutes);

      if (effectiveBreakMinutes > totalMinutes) {
        errors.push('break_minutes cannot exceed total shift duration');
      }

      if (totalMinutes > 60 * 24) {
        warnings.push('shift exceeds 24 hours, please verify check_out_at');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      totalWorkedMinutes,
      effectiveBreakMinutes,
      isRamadan,
    };
  }
}
```

### 7.10 Helper `ramadan-calendar.ts`

```typescript
export interface RamadanPeriod {
  hijriYear: number;
  startDate: Date;
  endDate: Date;
  source: 'official-bam' | 'cached-table' | 'manual';
}

export class RamadanCalendar {
  private readonly cache = new Map<number, RamadanPeriod>();

  constructor(private readonly initialPeriods: RamadanPeriod[] = []) {
    for (const p of initialPeriods) {
      this.cache.set(p.hijriYear, p);
    }
  }

  async isRamadan(date: Date): Promise<boolean> {
    for (const period of this.cache.values()) {
      if (date >= period.startDate && date <= period.endDate) {
        return true;
      }
    }
    return false;
  }

  async addPeriod(period: RamadanPeriod): Promise<void> {
    this.cache.set(period.hijriYear, period);
  }

  static defaultMoroccoPeriods2024to2030(): RamadanPeriod[] {
    return [
      {
        hijriYear: 1445,
        startDate: new Date('2024-03-11T00:00:00+01:00'),
        endDate: new Date('2024-04-09T23:59:59+01:00'),
        source: 'official-bam',
      },
      {
        hijriYear: 1446,
        startDate: new Date('2025-03-01T00:00:00+01:00'),
        endDate: new Date('2025-03-30T23:59:59+01:00'),
        source: 'official-bam',
      },
      {
        hijriYear: 1447,
        startDate: new Date('2026-02-18T00:00:00+01:00'),
        endDate: new Date('2026-03-19T23:59:59+01:00'),
        source: 'official-bam',
      },
      {
        hijriYear: 1448,
        startDate: new Date('2027-02-08T00:00:00+01:00'),
        endDate: new Date('2027-03-09T23:59:59+01:00'),
        source: 'official-bam',
      },
      {
        hijriYear: 1449,
        startDate: new Date('2028-01-28T00:00:00+01:00'),
        endDate: new Date('2028-02-26T23:59:59+01:00'),
        source: 'official-bam',
      },
      {
        hijriYear: 1450,
        startDate: new Date('2029-01-16T00:00:00+01:00'),
        endDate: new Date('2029-02-14T23:59:59+01:00'),
        source: 'official-bam',
      },
      {
        hijriYear: 1451,
        startDate: new Date('2030-01-06T00:00:00+01:00'),
        endDate: new Date('2030-02-04T23:59:59+01:00'),
        source: 'official-bam',
      },
    ];
  }
}
```

### 7.11 Helper `cnss-validator.ts`

```typescript
export interface CnssValidationResult {
  valid: boolean;
  formatVersion: 'old-8-digits' | 'new-9-digits' | 'invalid';
  reason?: string;
}

export class CnssValidator {
  private static readonly OLD_FORMAT = /^[0-9]{8}$/;
  private static readonly NEW_FORMAT = /^[0-9]{9}$/;

  static validate(value: string): CnssValidationResult {
    if (!value) {
      return { valid: false, formatVersion: 'invalid', reason: 'empty value' };
    }
    if (this.NEW_FORMAT.test(value)) {
      return { valid: true, formatVersion: 'new-9-digits' };
    }
    if (this.OLD_FORMAT.test(value)) {
      return {
        valid: true,
        formatVersion: 'old-8-digits',
        reason: 'pre-2018 format, consider migration to 9-digits',
      };
    }
    return {
      valid: false,
      formatVersion: 'invalid',
      reason: 'must match /^[0-9]{8,9}$/',
    };
  }

  static normalize(value: string): string | null {
    const result = this.validate(value);
    if (!result.valid) return null;
    if (result.formatVersion === 'old-8-digits') {
      return '0' + value;
    }
    return value;
  }
}
```

### 7.12 Schema Zod `analytics-event-properties.schema.ts`

```typescript
import { z } from 'zod';

export const PageViewProperties = z.object({
  type: z.literal('page_view'),
  url: z.string().url(),
  referrer: z.string().url().optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

export const ButtonClickProperties = z.object({
  type: z.literal('button_click'),
  buttonId: z.string().min(1).max(128),
  label: z.string().min(1).max(256).optional(),
  page: z.string().min(1).max(256).optional(),
});

export const FormSubmitProperties = z.object({
  type: z.literal('form_submit'),
  formId: z.string().min(1).max(128),
  success: z.boolean(),
  errorMessage: z.string().max(1024).optional(),
});

export const RepairOrderCreatedProperties = z.object({
  type: z.literal('repair_order_created'),
  orderId: z.string().uuid(),
  vehicleVin: z.string().length(17).optional(),
  estimatedCostMad: z.number().nonnegative(),
});

export const PaymentCompletedProperties = z.object({
  type: z.literal('payment_completed'),
  paymentId: z.string().uuid(),
  amountMad: z.number().nonnegative(),
  method: z.enum(['cmi', 'cash', 'transfer', 'flexpay']),
});

export const StockLowAlertProperties = z.object({
  type: z.literal('stock_low_alert'),
  itemId: z.string().uuid(),
  sku: z.string(),
  currentQuantity: z.number().nonnegative(),
  minThreshold: z.number().nonnegative(),
});

export const AnalyticsEventProperties = z.discriminatedUnion('type', [
  PageViewProperties,
  ButtonClickProperties,
  FormSubmitProperties,
  RepairOrderCreatedProperties,
  PaymentCompletedProperties,
  StockLowAlertProperties,
]);

export type AnalyticsEventPropertiesT = z.infer<typeof AnalyticsEventProperties>;
```

---

## 8. Tests complets

### 8.1 `migrations-analytics-stock-hr.spec.ts`

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../test/test-datasource';

describe('Migration 1735000000007 AnalyticsStockHR', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await dataSource.runMigrations();
  });

  afterAll(async () => {
    await dataSource.undoLastMigration();
    await dataSource.destroy();
  });

  it('creates analytics_events table with composite PK (occurred_at, id)', async () => {
    const result = await dataSource.query(
      `SELECT a.attname FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = 'analytics_events'::regclass AND i.indisprimary
       ORDER BY array_position(i.indkey, a.attnum)`,
    );
    expect(result.map((r: any) => r.attname)).toEqual(['occurred_at', 'id']);
  });

  it('creates stock_items with UNIQUE(tenant_id, sku)', async () => {
    const result = await dataSource.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'stock_items'::regclass AND contype = 'u'`,
    );
    expect(result.some((r: any) => r.conname === 'uq_stock_items_tenant_sku')).toBe(true);
  });

  it('creates stock_movements with quantity > 0 check', async () => {
    const result = await dataSource.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE conrelid = 'stock_movements'::regclass AND contype = 'c'`,
    );
    expect(result.some((r: any) => r.def.includes('quantity > 0'))).toBe(true);
  });

  it('creates hr_employees with UNIQUE(tenant_id, employee_number)', async () => {
    const result = await dataSource.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'hr_employees'::regclass AND contype = 'u'`,
    );
    expect(result.some((r: any) => r.conname === 'uq_hr_employees_tenant_number')).toBe(true);
  });

  it('creates hr_employees with social_security_number regex check', async () => {
    const result = await dataSource.query(
      `SELECT pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE conrelid = 'hr_employees'::regclass AND contype = 'c'`,
    );
    expect(result.some((r: any) => r.def.includes("[0-9]{8,9}"))).toBe(true);
  });

  it('creates partial index on stock_items for low stock alert', async () => {
    const result = await dataSource.query(
      `SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_stock_items_tenant_low'`,
    );
    expect(result[0].indexdef).toContain('current_quantity <= min_threshold');
  });

  it('enables RLS on the 5 new tables', async () => {
    const tables = [
      'analytics_events',
      'stock_items',
      'stock_movements',
      'hr_employees',
      'hr_attendance',
    ];
    for (const t of tables) {
      const result = await dataSource.query(
        `SELECT relrowsecurity FROM pg_class WHERE relname = $1`,
        [t],
      );
      expect(result[0].relrowsecurity).toBe(true);
    }
  });

  it('creates the 3 enums (stock_unit, stock_movement_type, hr_role)', async () => {
    const result = await dataSource.query(
      `SELECT typname FROM pg_type WHERE typname IN ('stock_unit_enum', 'stock_movement_type_enum', 'hr_role_enum')`,
    );
    expect(result).toHaveLength(3);
  });

  it('down() drops all 5 tables and 3 enums', async () => {
    await dataSource.undoLastMigration();
    const result = await dataSource.query(
      `SELECT tablename FROM pg_tables WHERE tablename IN ('analytics_events','stock_items','stock_movements','hr_employees','hr_attendance')`,
    );
    expect(result).toHaveLength(0);
    await dataSource.runMigrations();
  });
});
```

### 8.2 `rls-analytics.spec.ts`

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../test/test-datasource';

describe('RLS analytics_events', () => {
  let dataSource: DataSource;
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await dataSource.runMigrations();
    await dataSource.query(`INSERT INTO tenants (id, name) VALUES ($1,'A'),($2,'B') ON CONFLICT DO NOTHING`, [tenantA, tenantB]);
  });

  afterAll(async () => await dataSource.destroy());

  it('isolates events per tenant on SELECT', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    await dataSource.query(`INSERT INTO analytics_events (tenant_id, event_name) VALUES ($1, 'page_view')`, [tenantA]);
    await dataSource.query(`SET app.current_tenant_id = '${tenantB}'`);
    const rows = await dataSource.query(`SELECT * FROM analytics_events`);
    expect(rows).toHaveLength(0);
  });

  it('rejects UPDATE on append-only', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    const inserted = await dataSource.query(
      `INSERT INTO analytics_events (tenant_id, event_name) VALUES ($1, 'click') RETURNING id`,
      [tenantA],
    );
    const result = await dataSource.query(
      `UPDATE analytics_events SET event_name = 'modified' WHERE id = $1`,
      [inserted[0].id],
    );
    expect(result[1]).toBe(0);
  });

  it('rejects INSERT with foreign tenant_id', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    await expect(
      dataSource.query(`INSERT INTO analytics_events (tenant_id, event_name) VALUES ($1, 'x')`, [tenantB]),
    ).rejects.toThrow();
  });

  it('allows DELETE only on rows older than 1095 days', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    const recent = await dataSource.query(
      `INSERT INTO analytics_events (tenant_id, event_name, occurred_at) VALUES ($1, 'recent', now()) RETURNING id`,
      [tenantA],
    );
    const result = await dataSource.query(`DELETE FROM analytics_events WHERE id = $1`, [recent[0].id]);
    expect(result[1]).toBe(0);
  });
});
```

### 8.3 `rls-stock.spec.ts`

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../test/test-datasource';

describe('RLS stock_items + stock_movements', () => {
  let dataSource: DataSource;
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await dataSource.runMigrations();
    await dataSource.query(`INSERT INTO tenants (id, name) VALUES ($1,'A'),($2,'B') ON CONFLICT DO NOTHING`, [tenantA, tenantB]);
  });

  afterAll(async () => await dataSource.destroy());

  it('isolates stock_items per tenant', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    await dataSource.query(`INSERT INTO stock_items (tenant_id, sku, name) VALUES ($1, 'SKU-A1', 'Filtre')`, [tenantA]);
    await dataSource.query(`SET app.current_tenant_id = '${tenantB}'`);
    const rows = await dataSource.query(`SELECT * FROM stock_items WHERE sku='SKU-A1'`);
    expect(rows).toHaveLength(0);
  });

  it('UNIQUE(tenant_id, sku) allows same sku across tenants', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    await dataSource.query(`INSERT INTO stock_items (tenant_id, sku, name) VALUES ($1, 'SKU-COMMON', 'A')`, [tenantA]);
    await dataSource.query(`SET app.current_tenant_id = '${tenantB}'`);
    await dataSource.query(`INSERT INTO stock_items (tenant_id, sku, name) VALUES ($1, 'SKU-COMMON', 'B')`, [tenantB]);
    const rows = await dataSource.query(`SELECT count(*) AS c FROM stock_items WHERE sku='SKU-COMMON'`);
    expect(Number(rows[0].c)).toBe(1);
  });

  it('rejects UPDATE on stock_movements (append-only)', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    const item = await dataSource.query(
      `INSERT INTO stock_items (tenant_id, sku, name) VALUES ($1, 'SKU-MV', 'X') RETURNING id`,
      [tenantA],
    );
    const mvt = await dataSource.query(
      `INSERT INTO stock_movements (tenant_id, item_id, movement_type, quantity, unit_price_ht_at_time)
       VALUES ($1, $2, 'in', 10, 100) RETURNING id`,
      [tenantA, item[0].id],
    );
    const result = await dataSource.query(
      `UPDATE stock_movements SET quantity = 20 WHERE id = $1`,
      [mvt[0].id],
    );
    expect(result[1]).toBe(0);
  });

  it('rejects DELETE on stock_movements (append-only)', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    const item = await dataSource.query(
      `INSERT INTO stock_items (tenant_id, sku, name) VALUES ($1, 'SKU-DEL', 'X') RETURNING id`,
      [tenantA],
    );
    const mvt = await dataSource.query(
      `INSERT INTO stock_movements (tenant_id, item_id, movement_type, quantity, unit_price_ht_at_time)
       VALUES ($1, $2, 'in', 5, 50) RETURNING id`,
      [tenantA, item[0].id],
    );
    const result = await dataSource.query(`DELETE FROM stock_movements WHERE id = $1`, [mvt[0].id]);
    expect(result[1]).toBe(0);
  });

  it('rejects negative quantity in stock_movements', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    const item = await dataSource.query(
      `INSERT INTO stock_items (tenant_id, sku, name) VALUES ($1, 'SKU-NEG', 'X') RETURNING id`,
      [tenantA],
    );
    await expect(
      dataSource.query(
        `INSERT INTO stock_movements (tenant_id, item_id, movement_type, quantity, unit_price_ht_at_time)
         VALUES ($1, $2, 'out', -5, 50)`,
        [tenantA, item[0].id],
      ),
    ).rejects.toThrow();
  });
});
```

### 8.4 `rls-hr.spec.ts`

```typescript
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../test/test-datasource';

describe('RLS hr_employees + hr_attendance', () => {
  let dataSource: DataSource;
  const tenantA = '11111111-1111-1111-1111-111111111111';
  const tenantB = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await dataSource.runMigrations();
    await dataSource.query(`INSERT INTO tenants (id, name) VALUES ($1,'A'),($2,'B') ON CONFLICT DO NOTHING`, [tenantA, tenantB]);
  });

  afterAll(async () => await dataSource.destroy());

  it('isolates hr_employees per tenant', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    await dataSource.query(
      `INSERT INTO hr_employees (tenant_id, full_name, role, employee_number, hire_date, monthly_salary_dirham)
       VALUES ($1, 'Hassan', 'mecanicien', 'E001', '2020-01-01', 5000)`,
      [tenantA],
    );
    await dataSource.query(`SET app.current_tenant_id = '${tenantB}'`);
    const rows = await dataSource.query(`SELECT * FROM hr_employees WHERE employee_number='E001'`);
    expect(rows).toHaveLength(0);
  });

  it('rejects employee with invalid CNSS format', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    await expect(
      dataSource.query(
        `INSERT INTO hr_employees (tenant_id, full_name, role, employee_number, hire_date, monthly_salary_dirham, social_security_number)
         VALUES ($1, 'Bad CNSS', 'expert', 'E999', '2020-01-01', 5000, 'ABC1234')`,
        [tenantA],
      ),
    ).rejects.toThrow();
  });

  it('rejects employee without compensation (neither hourly nor monthly)', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    await expect(
      dataSource.query(
        `INSERT INTO hr_employees (tenant_id, full_name, role, employee_number, hire_date)
         VALUES ($1, 'No comp', 'admin', 'E998', '2020-01-01')`,
        [tenantA],
      ),
    ).rejects.toThrow();
  });

  it('isolates hr_attendance per tenant', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    const emp = await dataSource.query(
      `INSERT INTO hr_employees (tenant_id, full_name, role, employee_number, hire_date, monthly_salary_dirham)
       VALUES ($1, 'Karim', 'tolier', 'E100', '2021-06-01', 4500) RETURNING id`,
      [tenantA],
    );
    await dataSource.query(
      `INSERT INTO hr_attendance (tenant_id, employee_id, check_in_at, break_minutes)
       VALUES ($1, $2, now(), 30)`,
      [tenantA, emp[0].id],
    );
    await dataSource.query(`SET app.current_tenant_id = '${tenantB}'`);
    const rows = await dataSource.query(`SELECT * FROM hr_attendance`);
    expect(rows).toHaveLength(0);
  });

  it('rejects DELETE on hr_attendance (append-only)', async () => {
    await dataSource.query(`SET app.current_tenant_id = '${tenantA}'`);
    const emp = await dataSource.query(
      `INSERT INTO hr_employees (tenant_id, full_name, role, employee_number, hire_date, monthly_salary_dirham)
       VALUES ($1, 'Y', 'peintre', 'E200', '2022-01-01', 4000) RETURNING id`,
      [tenantA],
    );
    const att = await dataSource.query(
      `INSERT INTO hr_attendance (tenant_id, employee_id, check_in_at, check_out_at, break_minutes)
       VALUES ($1, $2, '2026-01-01 08:00+00', '2026-01-01 17:00+00', 60) RETURNING id`,
      [tenantA, emp[0].id],
    );
    const result = await dataSource.query(`DELETE FROM hr_attendance WHERE id = $1`, [att[0].id]);
    expect(result[1]).toBe(0);
  });
});
```

### 8.5 `stock-fifo.spec.ts`

```typescript
import { DataSource } from 'typeorm';
import { StockFifoCalculator } from '../helpers/stock-fifo-calculator';
import { createTestDataSource } from '../../test/test-datasource';

describe('StockFifoCalculator', () => {
  let dataSource: DataSource;
  let calc: StockFifoCalculator;
  const tenantId = '11111111-1111-1111-1111-111111111111';
  let itemId: string;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await dataSource.runMigrations();
    await dataSource.query(`INSERT INTO tenants (id, name) VALUES ($1, 'T') ON CONFLICT DO NOTHING`, [tenantId]);
    await dataSource.query(`SET app.current_tenant_id = '${tenantId}'`);
    const item = await dataSource.query(
      `INSERT INTO stock_items (tenant_id, sku, name, unit_price_ht) VALUES ($1, 'F-001', 'Filtre', 100) RETURNING id`,
      [tenantId],
    );
    itemId = item[0].id;
    calc = new StockFifoCalculator(dataSource);
  });

  afterAll(async () => await dataSource.destroy());

  async function addMovement(type: string, qty: number, price: number, daysAgo = 0) {
    const date = new Date(Date.now() - daysAgo * 86400000);
    await dataSource.query(
      `INSERT INTO stock_movements (tenant_id, item_id, movement_type, quantity, unit_price_ht_at_time, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, itemId, type, qty, price, date],
    );
  }

  it('returns zero for no movements', async () => {
    await dataSource.query(`DELETE FROM stock_movements WHERE item_id = $1`, [itemId]);
    const result = await calc.calculateValueAt(itemId, new Date());
    expect(result.totalQuantity).toBe(0);
    expect(result.totalValueHt).toBe(0);
  });

  it('calculates simple IN movement', async () => {
    await addMovement('in', 10, 100, 5);
    const result = await calc.calculateValueAt(itemId, new Date());
    expect(result.totalQuantity).toBe(10);
    expect(result.totalValueHt).toBe(1000);
  });

  it('FIFO order: OUT consumes oldest first', async () => {
    await dataSource.query(`DELETE FROM stock_movements WHERE item_id = $1`, [itemId]);
    await addMovement('in', 10, 100, 10);
    await addMovement('in', 10, 150, 5);
    await addMovement('out', 10, 0, 1);
    const result = await calc.calculateValueAt(itemId, new Date());
    expect(result.totalQuantity).toBe(10);
    expect(result.totalValueHt).toBe(1500);
  });

  it('FIFO partial OUT splits layer', async () => {
    await dataSource.query(`DELETE FROM stock_movements WHERE item_id = $1`, [itemId]);
    await addMovement('in', 10, 100, 10);
    await addMovement('in', 10, 200, 5);
    await addMovement('out', 5, 0, 1);
    const result = await calc.calculateValueAt(itemId, new Date());
    expect(result.totalQuantity).toBe(15);
    expect(result.totalValueHt).toBe(2500);
  });

  it('valuation at past date excludes future movements', async () => {
    await dataSource.query(`DELETE FROM stock_movements WHERE item_id = $1`, [itemId]);
    await addMovement('in', 10, 100, 10);
    await addMovement('in', 10, 200, 1);
    const past = new Date(Date.now() - 5 * 86400000);
    const result = await calc.calculateValueAt(itemId, past);
    expect(result.totalQuantity).toBe(10);
    expect(result.totalValueHt).toBe(1000);
  });

  it('inventory recount creates a new layer', async () => {
    await dataSource.query(`DELETE FROM stock_movements WHERE item_id = $1`, [itemId]);
    await addMovement('inventory', 50, 120, 1);
    const result = await calc.calculateValueAt(itemId, new Date());
    expect(result.totalQuantity).toBe(50);
    expect(result.totalValueHt).toBe(6000);
  });

  it('weighted average across layers', async () => {
    await dataSource.query(`DELETE FROM stock_movements WHERE item_id = $1`, [itemId]);
    await addMovement('in', 10, 100, 10);
    await addMovement('in', 10, 200, 5);
    const result = await calc.calculateValueAt(itemId, new Date());
    expect(result.weightedAverageUnitPrice).toBe(150);
  });

  it('exhausted item returns 0', async () => {
    await dataSource.query(`DELETE FROM stock_movements WHERE item_id = $1`, [itemId]);
    await addMovement('in', 10, 100, 10);
    await addMovement('out', 10, 0, 1);
    const result = await calc.calculateValueAt(itemId, new Date());
    expect(result.totalQuantity).toBe(0);
  });
});
```

### 8.6 `attendance-validator.spec.ts`

```typescript
import { AttendanceValidator } from '../helpers/attendance-validator';
import { RamadanCalendar } from '../helpers/ramadan-calendar';

describe('AttendanceValidator', () => {
  const cal = new RamadanCalendar(RamadanCalendar.defaultMoroccoPeriods2024to2030());
  const validator = new AttendanceValidator(cal);

  it('valid 8h shift with 30min break', async () => {
    const r = await validator.validate({
      checkInAt: new Date('2026-01-15T08:00:00+01:00'),
      checkOutAt: new Date('2026-01-15T17:00:00+01:00'),
      breakMinutes: 30,
    });
    expect(r.valid).toBe(true);
    expect(r.totalWorkedMinutes).toBe(60 * 9 - 30);
    expect(r.isRamadan).toBe(false);
  });

  it('rejects negative break', async () => {
    const r = await validator.validate({
      checkInAt: new Date('2026-01-15T08:00:00+01:00'),
      checkOutAt: new Date('2026-01-15T17:00:00+01:00'),
      breakMinutes: -10,
    });
    expect(r.valid).toBe(false);
  });

  it('rejects break > shift duration', async () => {
    const r = await validator.validate({
      checkInAt: new Date('2026-01-15T08:00:00+01:00'),
      checkOutAt: new Date('2026-01-15T09:00:00+01:00'),
      breakMinutes: 90,
    });
    expect(r.valid).toBe(false);
  });

  it('detects Ramadan and warns about reduction', async () => {
    const r = await validator.validate({
      checkInAt: new Date('2026-02-25T08:00:00+01:00'),
      checkOutAt: new Date('2026-02-25T15:00:00+01:00'),
      breakMinutes: 15,
    });
    expect(r.isRamadan).toBe(true);
    expect(r.effectiveBreakMinutes).toBe(30);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('handles midnight rollover (night shift)', async () => {
    const r = await validator.validate({
      checkInAt: new Date('2026-01-15T22:00:00+01:00'),
      checkOutAt: new Date('2026-01-16T02:00:00+01:00'),
      breakMinutes: 0,
    });
    expect(r.valid).toBe(true);
    expect(r.totalWorkedMinutes).toBe(240);
  });

  it('warns on shift > 24h', async () => {
    const r = await validator.validate({
      checkInAt: new Date('2026-01-15T08:00:00+01:00'),
      checkOutAt: new Date('2026-01-16T10:00:00+01:00'),
      breakMinutes: 60,
    });
    expect(r.warnings.some((w) => w.includes('24 hours'))).toBe(true);
  });

  it('open shift (no checkout) returns 0 worked minutes', async () => {
    const r = await validator.validate({
      checkInAt: new Date('2026-01-15T08:00:00+01:00'),
      checkOutAt: null,
      breakMinutes: 0,
    });
    expect(r.valid).toBe(true);
    expect(r.totalWorkedMinutes).toBe(0);
  });
});
```

### 8.7 `cnss-format.spec.ts`

```typescript
import { CnssValidator } from '../helpers/cnss-validator';

describe('CnssValidator', () => {
  it('accepts new 9-digits format', () => {
    const r = CnssValidator.validate('123456789');
    expect(r.valid).toBe(true);
    expect(r.formatVersion).toBe('new-9-digits');
  });

  it('accepts old 8-digits format with warning', () => {
    const r = CnssValidator.validate('12345678');
    expect(r.valid).toBe(true);
    expect(r.formatVersion).toBe('old-8-digits');
    expect(r.reason).toContain('pre-2018');
  });

  it('rejects letters', () => {
    const r = CnssValidator.validate('ABC123456');
    expect(r.valid).toBe(false);
  });

  it('rejects empty', () => {
    const r = CnssValidator.validate('');
    expect(r.valid).toBe(false);
  });

  it('normalize converts old to new format', () => {
    expect(CnssValidator.normalize('12345678')).toBe('012345678');
    expect(CnssValidator.normalize('123456789')).toBe('123456789');
    expect(CnssValidator.normalize('invalid')).toBe(null);
  });
});
```

### 8.8 `analytics-properties.spec.ts`

```typescript
import { AnalyticsEventProperties } from '../schemas/analytics-event-properties.schema';

describe('AnalyticsEventProperties Zod schema', () => {
  it('accepts page_view with valid url', () => {
    const r = AnalyticsEventProperties.safeParse({
      type: 'page_view',
      url: 'https://app.skalean.ma/dashboard',
      durationMs: 1500,
    });
    expect(r.success).toBe(true);
  });

  it('rejects page_view without url', () => {
    const r = AnalyticsEventProperties.safeParse({ type: 'page_view' });
    expect(r.success).toBe(false);
  });

  it('accepts payment_completed with cmi method', () => {
    const r = AnalyticsEventProperties.safeParse({
      type: 'payment_completed',
      paymentId: '00000000-0000-0000-0000-000000000001',
      amountMad: 1500.5,
      method: 'cmi',
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown discriminator', () => {
    const r = AnalyticsEventProperties.safeParse({ type: 'unknown_event' });
    expect(r.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const r = AnalyticsEventProperties.safeParse({
      type: 'payment_completed',
      paymentId: '00000000-0000-0000-0000-000000000001',
      amountMad: -10,
      method: 'cash',
    });
    expect(r.success).toBe(false);
  });
});
```

---

## 9. Variables d'environnement (>= 18)

Ajoutees dans `.env.example` et `apps/api/src/config/env.schema.ts` (Zod).

```bash
# Database (existant)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=skalean_dev
DATABASE_USER=skalean
DATABASE_PASSWORD=changeme
DATABASE_SSL=false

# Analytics partitioning preparation Sprint 35
ANALYTICS_PARTITION_INTERVAL=month
ANALYTICS_RETENTION_DAYS=1095
ANALYTICS_PROPERTIES_MAX_BYTES=1048576

# Stock alertes Sprint 13
STOCK_LOW_ALERT_BATCH_INTERVAL_MINUTES=15
STOCK_LOW_ALERT_CHANNELS=whatsapp,email
STOCK_FIFO_REBUILD_CRON=0 3 * * *

# Ramadan calendar
RAMADAN_BREAK_REDUCTION_MINUTES=30
RAMADAN_CALENDAR_SOURCE=cached-table
RAMADAN_CALENDAR_API_URL=https://api.bam.ma/v1/calendar/islamic

# CNSS / AMO Maroc (taux 2026, ajustable annuellement DGI)
CNSS_VALIDATION_REGEX=^[0-9]{8,9}$
CNSS_RATE_EMPLOYEE=4.48
CNSS_RATE_EMPLOYER=8.98
CNSS_PLAFOND_MENSUEL_MAD=6000
AMO_RATE_EMPLOYEE=2.26
AMO_RATE_EMPLOYER=4.11
AMO_NO_PLAFOND=true
IGR_BAREME_VERSION=2026

# BAM Holiday API
BAM_HOLIDAY_API_URL=https://api.bam.ma/v1/holidays
BAM_HOLIDAY_API_TIMEOUT_MS=5000

# Conformite paie retention
PAIE_RETENTION_YEARS=7
```

Schema Zod equivalent :

```typescript
// apps/api/src/config/env.schema.ts (extrait pour 1.2.8)
import { z } from 'zod';

export const Sprint2_1_2_8_EnvSchema = z.object({
  ANALYTICS_PARTITION_INTERVAL: z.enum(['day', 'week', 'month']).default('month'),
  ANALYTICS_RETENTION_DAYS: z.coerce.number().int().min(30).max(3650).default(1095),
  ANALYTICS_PROPERTIES_MAX_BYTES: z.coerce.number().int().min(1024).default(1048576),
  STOCK_LOW_ALERT_BATCH_INTERVAL_MINUTES: z.coerce.number().int().min(1).default(15),
  STOCK_LOW_ALERT_CHANNELS: z.string().default('whatsapp,email'),
  STOCK_FIFO_REBUILD_CRON: z.string().default('0 3 * * *'),
  RAMADAN_BREAK_REDUCTION_MINUTES: z.coerce.number().int().min(0).default(30),
  RAMADAN_CALENDAR_SOURCE: z.enum(['cached-table', 'api', 'manual']).default('cached-table'),
  RAMADAN_CALENDAR_API_URL: z.string().url().optional(),
  CNSS_VALIDATION_REGEX: z.string().default('^[0-9]{8,9}$'),
  CNSS_RATE_EMPLOYEE: z.coerce.number().min(0).max(100).default(4.48),
  CNSS_RATE_EMPLOYER: z.coerce.number().min(0).max(100).default(8.98),
  CNSS_PLAFOND_MENSUEL_MAD: z.coerce.number().min(0).default(6000),
  AMO_RATE_EMPLOYEE: z.coerce.number().min(0).max(100).default(2.26),
  AMO_RATE_EMPLOYER: z.coerce.number().min(0).max(100).default(4.11),
  AMO_NO_PLAFOND: z.coerce.boolean().default(true),
  IGR_BAREME_VERSION: z.string().default('2026'),
  BAM_HOLIDAY_API_URL: z.string().url().optional(),
  BAM_HOLIDAY_API_TIMEOUT_MS: z.coerce.number().int().default(5000),
  PAIE_RETENTION_YEARS: z.coerce.number().int().min(1).default(7),
});
```

---

## 10. Commandes shell

```bash
# 1. Generer un squelette migration TypeORM (referentiel)
pnpm --filter api typeorm migration:create apps/api/src/database/migrations/AnalyticsStockHR

# 2. Verifier compilation TypeScript
pnpm --filter api tsc --noEmit

# 3. Linter
pnpm --filter api eslint --max-warnings=0 \
  apps/api/src/database/migrations/1735000000007-AnalyticsStockHR.ts \
  apps/api/src/database/entities/analytics \
  apps/api/src/database/entities/stock \
  apps/api/src/database/entities/hr \
  apps/api/src/database/helpers \
  apps/api/src/database/schemas

# 4. Lancer les migrations en dev
pnpm --filter api migration:run

# 5. Tester rollback puis re-up
pnpm --filter api migration:revert
pnpm --filter api migration:run

# 6. Tests unitaires + RLS + FIFO
pnpm --filter api test -- \
  migrations-analytics-stock-hr.spec.ts \
  rls-analytics.spec.ts \
  rls-stock.spec.ts \
  rls-hr.spec.ts \
  stock-fifo.spec.ts \
  attendance-validator.spec.ts \
  cnss-format.spec.ts \
  analytics-properties.spec.ts

# 7. Verifier RLS via psql manuel
psql $DATABASE_URL -c "SET app.current_tenant_id = '11111111-1111-1111-1111-111111111111'; SELECT * FROM stock_items LIMIT 5;"

# 8. Inspecter schema
psql $DATABASE_URL -c "\d analytics_events"
psql $DATABASE_URL -c "\d stock_items"
psql $DATABASE_URL -c "\d stock_movements"
psql $DATABASE_URL -c "\d hr_employees"
psql $DATABASE_URL -c "\d hr_attendance"

# 9. Lister les indexes
psql $DATABASE_URL -c "\di idx_stock_items_*"
psql $DATABASE_URL -c "\di idx_analytics_events_*"

# 10. Coverage
pnpm --filter api test:cov -- --testPathPattern="(analytics|stock|hr|fifo|cnss|ramadan|attendance)"
```

---

## 11. Criteres de validation V1-V32+

### P0 (V1-V18, bloquants)

- V1. `analytics_events` table creee avec PK composite (occurred_at, id)
- V2. `analytics_events` UPDATE policy `USING (false)` verifiee
- V3. `analytics_events` DELETE policy retention 1095 jours verifiee
- V4. `analytics_events` index GIN jsonb_path_ops sur properties present
- V5. `stock_items` UNIQUE (tenant_id, sku) verifiee
- V6. `stock_items` index partiel `WHERE current_quantity <= min_threshold` present
- V7. `stock_items` numeric(15,3) sur current_quantity et min_threshold
- V8. `stock_movements` quantity > 0 check present
- V9. `stock_movements` UPDATE policy `USING (false)` verifiee (append-only)
- V10. `stock_movements` DELETE policy `USING (false)` verifiee (append-only strict)
- V11. `hr_employees` UNIQUE (tenant_id, employee_number) verifiee
- V12. `hr_employees` social_security_number regex `^[0-9]{8,9}$` verifiee
- V13. `hr_employees` CHECK compensation (hourly OR monthly) verifiee
- V14. `hr_attendance` break_minutes 0..720 check present
- V15. `hr_attendance` check_out_at >= check_in_at check present
- V16. `hr_attendance` UPDATE possible uniquement quand check_out_at IS NULL
- V17. RLS active sur les 5 tables (verification pg_class.relrowsecurity)
- V18. FIFO calculator passe les 8 tests stock-fifo.spec.ts

### P1 (V19-V26, important)

- V19. AttendanceValidator detecte Ramadan 2026 (18 fev - 19 mars 2026)
- V20. AttendanceValidator etend break a 30 minutes en Ramadan automatiquement
- V21. CnssValidator accepte les deux formats 8 et 9 chiffres
- V22. CnssValidator.normalize convertit 8 -> 9 chiffres avec prefix 0
- V23. AnalyticsEventProperties Zod schema rejette les types inconnus
- V24. RamadanCalendar contient les 7 annees 2024-2030
- V25. Variables d'env >= 18 ajoutees et validees par Zod
- V26. Pas d'emoji dans les fichiers generes (verifie par grep)

### P2 (V27-V32, nice-to-have)

- V27. Documentation des conventions FIFO dans `docs/stock/fifo.md`
- V28. Migration tournee en dev sur dataset 100k events sans erreur
- V29. EXPLAIN ANALYZE sur query analytics par tenant + date utilise idx_analytics_events_tenant_occurred
- V30. EXPLAIN ANALYZE sur low-stock alert utilise idx_stock_items_tenant_low (partial)
- V31. Coverage tests >= 85% sur les 4 helpers
- V32. CHANGELOG.md PARTIE1 ferme avec section "Sprint 2 -- 31 tables horizontales finalisees"

---

## 12. Edge cases (10-12)

### EC1. Analytics partition month boundary midnight
Un event genere a 23:59:59.999 le 31 janvier doit etre dans la partition janvier, pas fevrier. Le partitioning declaratif Postgres (Sprint 35) utilise `>=` start et `<` end. Verification : `INSERT ... occurred_at = '2026-01-31 23:59:59.999+00'` doit aller en partition janvier 2026.

### EC2. Stock movement signed quantity convention
Convention SIGNED retenue : `quantity` toujours positif > 0, et le signe est applique selon `movement_type`. Pour `adjustment`, on a besoin d'un signe : ajouter colonne `adjustment_signed_quantity numeric(15,3)` ou utiliser une convention `reason` text. Decision Sprint 2 : pour `adjustment`, on cree DEUX mouvements distincts (un `out` et un `in`) si necessaire, sinon le `adjustment` represente un ajustement positif. Pour decrementer en adjustment, utiliser `out` avec `reason = 'adjustment'`.

### EC3. FIFO item exhausted
Si stock atteint 0 et qu'un nouveau `out` est tente, le calculator FIFO ignore le surplus (ne genere pas erreur). Le service Sprint 13 doit verifier `current_quantity >= quantity` AVANT d'inserer le mouvement (transactionnel). Sinon : valuation peut diverger du reel.

### EC4. Employee CNSS format old vs new
Migration future Sprint 35 : convertir tous les CNSS 8-digits en 9-digits avec prefix '0'. Validation regex `^[0-9]{8,9}$` accepte les deux pendant la transition. Apres Sprint 35, regex devient `^[0-9]{9}$` strict.

### EC5. Ramadan calendar API down fallback
Si l'API Bank Al-Maghrib est indisponible, le helper `RamadanCalendar` utilise la table cachee locale (chargee Sprint 1 via seeder). Si les deux sont indisponibles : fallback a `RamadanCalendar.defaultMoroccoPeriods2024to2030()` hardcoded en code.

### EC6. Attendance overnight crossing day
Un check_in 22:00 le 15 janvier et check_out 02:00 le 16 janvier : `EXTRACT(EPOCH FROM (check_out - check_in)) / 60` retourne 240 minutes (4h). Le rapport "presence du 15 janvier" peut compter ces 4h sur le 15 janvier ou les repartir 2h sur 15 et 2h sur 16. Decision : compte sur la date de `check_in_at` (jour de debut shift).

### EC7. Social security duplicate cross-tenant
Le meme employe peut travailler chez deux tenants (rare mais possible : freelance comptable). Le UNIQUE est sur (tenant_id, employee_number) PAS sur social_security_number. Ainsi le meme CNSS peut apparaitre dans deux tenants. Verification cross-tenant exists Sprint 13 via job batch (RGPD : informer les tenants concernes).

### EC8. JSONB properties size limit 1MB
Postgres limite TOAST a ~1GB par tuple, mais le ETL ClickHouse Sprint 13 limite a 1MB par event. CHECK applicatif Sprint 13 (pas en migration car le CHECK pg_jsonb_size n'existe pas sans extension). Variable env `ANALYTICS_PROPERTIES_MAX_BYTES=1048576`.

### EC9. Employee soft delete + attendance
Si on `UPDATE hr_employees SET active = false`, les attendance restent avec FK ON DELETE RESTRICT. Reporting "presence du mois" doit filtrer `WHERE employee.active = true`. Sinon : un employe parti il y a 3 mois peut polluer le rapport courant. Vue Sprint 13 : `hr_attendance_active`.

### EC10. Partial index size growth
L'index partiel `idx_stock_items_tenant_low WHERE current_quantity <= min_threshold` est petit en regime nominal (peu d'items en alerte). Si systeme bug et 80% des items sont en alerte, l'index croit. Monitoring Sprint 13 : `pg_relation_size('idx_stock_items_tenant_low') / pg_relation_size('stock_items')`.

### EC11. Stock recount inventory creates negative
Si `inventory` (recount physique) revele moins que `current_quantity`, Sprint 13 cree DEUX mouvements : un `inventory` avec la quantite reelle, et un `adjustment` avec la difference negative. Aucun mouvement avec `quantity < 0` (CHECK l'interdit).

### EC12. Migration rollback orphans
Si `migration:revert` tourne apres que les tables aient des donnees, les FK CASCADE supprimeront les enfants. Test : creer 1 tenant + 100 events + 50 stock_items + revert -> tout supprime.

---

## 13. Conformite Maroc

### 13.1 CNSS Article 25 -- retention paie 7 ans
Code du Travail Maroc, Article 25 : tout employeur doit conserver les bulletins de paie et registres associes pendant **7 ans** apres la cessation du contrat. Implication : `hr_employees` et `hr_attendance` ne peuvent pas etre purges avant 7 ans apres `active = false`. Variable env `PAIE_RETENTION_YEARS=7`. Job pg_cron Sprint 35 supprime apres 7 ans.

### 13.2 AMO obligatoire taux fixes 2026
Loi 65-00 portant Code de la couverture medicale de base. Taux 2026 (Decret D.2.18.622) :
- AMO employe : 2.26% du salaire brut, **sans plafond**
- AMO employeur : 4.11% du salaire brut, sans plafond
- CNSS employe : 4.48% du salaire brut, plafond 6000 MAD
- CNSS employeur : 8.98% du salaire brut, plafond 6000 MAD

Les taux peuvent etre modifies par decret annuel DGI. Stockes en variables d'environnement, charges au demarrage. Audit log de chaque changement (Sprint 13).

### 13.3 Ramadan -- decret du Travail Article 184
Article 184 du Code du Travail Maroc :
> "Pendant le mois de Ramadan, la duree journaliere du travail est reduite, dans les conditions fixees par voie reglementaire, de maniere a tenir compte du jeune."

En pratique : reduction d'au moins 30 minutes de la duree journaliere. Pauses augmentees pour priere du Dohr / Asr et pour Iftar approchant. Le helper `RamadanCalendar` + `AttendanceValidator` automatise la detection et la reduction.

### 13.4 Loi 09-08 CNDP -- donnees personnelles employes
Loi 09-08 relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel. Articles applicables :
- Article 11 : retention donnees pas plus longue que necessaire (3 ans pour analytics)
- Article 18 : data residency Maroc (decision-008)
- Article 22 : consentement employe pour donnees sensibles (CNSS, salaire)
- Article 27 : droit acces / rectification (Sprint 13 endpoint `/me/personal-data`)

### 13.5 Decision-008 data residency
Toutes les donnees employes (hr_employees, hr_attendance) doivent etre stockees dans des datacenters Maroc ou UE (RGPD adequate). Pas de replication AWS US ou Asie. OVHcloud Gravelines (FR, RGPD) + Roubaix (FR replica) sont conformes. Backup chiffre AES-256 stocke a Casablanca (S3-compatible local).

### 13.6 DGI Article 24 -- methode FIFO autorisee
Code General Impots Maroc, Article 24 : pour la valorisation du stock, les methodes acceptees sont CMP (Cout Moyen Pondere) et FIFO. **LIFO est explicitement interdite** (a l'inverse des US GAAP). Skalean utilise FIFO conforme.

### 13.7 IGR (Impot General Revenu) bareme 2026
Bareme tranches IGR 2026 (Decret D.2.25.X) :
- 0 - 30 000 MAD : 0%
- 30 001 - 50 000 MAD : 10%
- 50 001 - 60 000 MAD : 20%
- 60 001 - 80 000 MAD : 30%
- 80 001 - 180 000 MAD : 34%
- 180 001+ MAD : 38%

Variable env `IGR_BAREME_VERSION=2026` permettra d'invalider le cache au changement annuel. Calcul detaille Sprint 13 dans `PaieService`.

---

## 14. Conventions absolues (rappel)

1. **AUCUNE EMOJI** dans le code, les commentaires, les commits, les noms de variables ou les fichiers markdown du projet.
2. **TypeScript strict** : `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`.
3. **Aucun `any`** sauf dans les helpers TypeORM type-incompatibles (rare).
4. **Migrations append-only** : on ne modifie JAMAIS une migration commitee. On cree une nouvelle migration corrective.
5. **RLS activee sur toutes les tables tenant-scoped** : pas d'exception. Cross-tenant ops via service dedie.
6. **Naming snake_case PostgreSQL** : `tenant_id`, `created_at`, `social_security_number`. Pas de camelCase en SQL.
7. **Naming camelCase TypeScript** : `tenantId`, `createdAt`, `socialSecurityNumber`. Mapping via decorators TypeORM.
8. **JSDoc obligatoire sur les helpers publics** : description, params, return, throws, exemple.
9. **Tests Jest co-localises** : `__tests__/` adjacent au code teste.
10. **Coverage minimum 80%** sur les helpers et services. Tolerance 70% sur entities (dataclass).
11. **Linter ESLint zero warning** : `--max-warnings=0` en CI.
12. **Commits Conventional Commits** : `feat(database): ...`, `fix(stock): ...`, `chore(migrations): ...`.
13. **Branches feature** : `feat/sprint-X/task-Y.Z.W-description`.
14. **PR review minimum 2 approvals** : Lead Backend + un domaine specialise (RH, comptable, conformite).

---

## 15. Validation pre-commit

```bash
# 1. Format (Prettier)
pnpm format

# 2. Lint
pnpm --filter api lint -- --max-warnings=0

# 3. Type check
pnpm --filter api tsc --noEmit

# 4. Tests + coverage
pnpm --filter api test:cov

# 5. Migration roundtrip
pnpm --filter api migration:run
pnpm --filter api migration:revert
pnpm --filter api migration:run

# 6. Verifier absence d'emoji
grep -rEl "[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]" apps/api/src/database || echo "OK no emoji"

# 7. Verifier RLS sur les 5 tables
psql $DATABASE_URL <<'SQL'
SELECT relname, relrowsecurity FROM pg_class
WHERE relname IN ('analytics_events','stock_items','stock_movements','hr_employees','hr_attendance');
SQL

# 8. Verifier les variables d'env
node -e "require('./apps/api/src/config/env.schema').loadEnv()"
```

---

## 16. Commit message

```
feat(database): add migration 1.2.8 -- analytics + stock + HR tables

Adds 5 new tables to PARTIE1 horizontal foundation:
- analytics_events (append-only, partition-ready for Sprint 35)
- stock_items + stock_movements (FIFO valuation, low-threshold alert)
- hr_employees + hr_attendance (CNSS/AMO compliant, Ramadan-aware)

Includes:
- 4 helpers: StockFifoCalculator, AttendanceValidator, RamadanCalendar, CnssValidator
- Zod discriminated union schema for analytics event properties
- 8 test specs covering migrations, RLS isolation, FIFO order, attendance validation,
  CNSS format and analytics properties schema
- 18+ environment variables (CNSS rates, AMO rates, retention TTL, partition interval)

Compliance:
- Loi 09-08 CNDP (retention 3 ans analytics, 7 ans paie)
- Code du Travail Article 25 (retention paie)
- Code du Travail Article 184 (Ramadan reduction)
- DGI Article 24 (FIFO valuation, LIFO interdite)
- decision-002, decision-003, decision-008, decision-013, decision-014, decision-018

Closes #task-1.2.8
Refs: sprint-2/phase-1
```

---

## 17. Next task -- 1.2.9

**task-1.2.9 -- RLS test cross-tenant integration suite**

Suite a la fin de PARTIE1 (31 tables horizontales), la tache 1.2.9 produit une suite de tests d'integration cross-tenant complete : pour chaque table tenant-scoped, on verifie que :
- Tenant A ne peut pas lire les rows de Tenant B (SELECT).
- Tenant A ne peut pas inserer avec tenant_id = Tenant B (INSERT WITH CHECK).
- Tenant A ne peut pas updater les rows de Tenant B (UPDATE USING).
- Tenant A ne peut pas supprimer les rows de Tenant B (DELETE USING).
- Le superuser (role `postgres`) bypasse RLS et peut tout lire (pour ETL Sprint 13).
- Le role `app_user` (utilise par l'API NestJS) respecte RLS strict.

Duree estimee : 6h. Priorite P0.

---

## Annexes

### Annexe A -- Plan de paie CNSS/AMO Maroc exemple

Salaire brut mensuel : 8000 MAD (mecanicien chef_atelier).

| Ligne | Calcul | Montant MAD |
|-------|--------|-------------|
| Salaire brut | -- | 8000.00 |
| CNSS employe | min(8000, 6000) * 4.48% | 268.80 |
| AMO employe | 8000 * 2.26% | 180.80 |
| Cotisations salariales totales | 268.80 + 180.80 | 449.60 |
| Salaire net imposable | 8000 - 449.60 | 7550.40 |
| Frais professionnels (20% plafond 30000/an = 2500/mois) | min(7550.40 * 20%, 2500) | 1510.08 |
| Salaire net imposable apres FP | 7550.40 - 1510.08 | 6040.32 |
| Salaire net annuel imposable | 6040.32 * 12 | 72483.84 |
| IGR brut (bareme 2026) | tranche 60001-80000 a 30% | 4845.15 |
| Deduction familiale (epouse + 2 enfants) | 360 * 3 | 1080.00 |
| IGR net annuel | 4845.15 - 1080 | 3765.15 |
| IGR mensuel | 3765.15 / 12 | 313.76 |
| Salaire net a payer | 7550.40 - 313.76 | 7236.64 |
| CNSS employeur | min(8000, 6000) * 8.98% | 538.80 |
| AMO employeur | 8000 * 4.11% | 328.80 |
| Cout total employeur | 8000 + 538.80 + 328.80 | 8867.60 |

### Annexe B -- Algorithme FIFO illustre

Mouvements ordonnes par date :
1. 2026-01-01 : IN 10 unites a 100 MAD HT (layer L1 = {qty: 10, price: 100})
2. 2026-01-15 : IN 10 unites a 150 MAD HT (layer L2 = {qty: 10, price: 150})
3. 2026-01-20 : OUT 8 unites
   - Consomme L1 entierement (10) ? Non, L1 a 10, on en sort 8 -> L1.qty = 2
   - L2 inchange
4. 2026-01-25 : OUT 5 unites
   - Consomme L1.qty restant = 2 -> L1 vide -> shift
   - Consomme 3 sur L2 -> L2.qty = 7
5. Valuation au 2026-01-31 : L2 = {qty: 7, price: 150} -> totalQty=7, totalValue=1050 MAD HT

Cle : `unit_price_ht_at_time` snapshote au moment du mouvement IN, jamais au moment du OUT (FIFO = on sort au cout d'entree, pas du marche actuel).

### Annexe C -- Calendrier Ramadan 2026 Maroc

Source : Ministere des Habous et Affaires Islamiques Maroc.

| Date debut | Date fin | Annee Hijri |
|------------|----------|-------------|
| 18 fevrier 2026 | 19 mars 2026 | 1447 |

Periode : 30 jours (peut varier 29-30 selon observation lune).

Reduction obligatoire : minimum 30 minutes par jour pendant Ramadan. Habitude entreprise : horaires 09:00-15:00 au lieu de 08:00-17:00 (reduction 3h, pas obligatoire mais courante). Pause Dohr (12:30) + Asr (15:30) + Iftar approchant (18:00 environ).

### Annexe D -- Schema properties par event_name (extrait)

```typescript
// page_view
{ type: 'page_view', url: 'https://...', referrer?, durationMs? }

// button_click
{ type: 'button_click', buttonId, label?, page? }

// form_submit
{ type: 'form_submit', formId, success: boolean, errorMessage? }

// repair_order_created
{ type: 'repair_order_created', orderId, vehicleVin?, estimatedCostMad }

// payment_completed
{ type: 'payment_completed', paymentId, amountMad, method: 'cmi'|'cash'|'transfer'|'flexpay' }

// stock_low_alert
{ type: 'stock_low_alert', itemId, sku, currentQuantity, minThreshold }
```

Discriminated union enforced cote service Sprint 13 producer Kafka. Postgres stocke jsonb sans contrainte structurelle (flexibilite migration).

### Annexe E -- FIFO algorithm pseudo-code

```
function calculateValueAt(itemId, asOfDate):
  movements = SELECT * FROM stock_movements
              WHERE item_id = itemId AND created_at <= asOfDate
              ORDER BY created_at ASC
  layers = []
  for mvt in movements:
    if mvt.type in ('in', 'inventory'):
      layers.append({ qty: mvt.quantity, price: mvt.unit_price_ht_at_time, mvtId: mvt.id })
    elif mvt.type == 'out':
      remaining = mvt.quantity
      while remaining > 0 and layers:
        head = layers[0]
        if head.qty <= remaining:
          remaining -= head.qty
          layers.popleft()
        else:
          head.qty -= remaining
          remaining = 0
    elif mvt.type == 'adjustment':
      // signed convention: handled by service layer or separate column
      ...
  totalQty = sum(l.qty for l in layers)
  totalValue = sum(l.qty * l.price for l in layers)
  return { totalQty, totalValue, layers }
```

Complexite : O(n) ou n = nombre de mouvements. Pour n > 10000 mouvements (rare), preferer une vue materialisee `stock_valuation_daily` rebuilt nightly Sprint 13.

### Annexe F -- Decision matrix valuation method

| Methode | DGI Maroc | RGPD UE | US GAAP | Skalean choix |
|---------|-----------|---------|---------|---------------|
| FIFO | OK Article 24 | OK | OK | OUI |
| LIFO | INTERDIT | OK | OK | NON |
| CMP (cout moyen pondere) | OK Article 24 | OK | OK | Future Sprint 35 (option) |
| Specifique identification | OK gros equipements | OK | OK | NON (complexite) |

FIFO retenue pour conformite DGI + simplicite implementation + traçabilite par layer. CMP sera ajoutee Sprint 35 comme option par tenant (`tenant_settings.stock_valuation_method`).

### Annexe G -- Ramadan automation flowchart

```
attendance.check_in_at received
  |
  v
RamadanCalendar.isRamadan(check_in_at) ?
  |
  +-- false --> use break_minutes as-is
  |
  +-- true --> check break_minutes >= RAMADAN_BREAK_REDUCTION_MINUTES (30)
              |
              +-- yes --> use as-is, no warning
              |
              +-- no --> auto-extend to 30, emit warning,
                         log analytics event 'ramadan_break_extended'
```

### Annexe H -- Glossaire

- **CNSS** : Caisse Nationale de Securite Sociale (Maroc)
- **AMO** : Assurance Maladie Obligatoire (Maroc)
- **IGR** : Impot General sur le Revenu (Maroc)
- **DGI** : Direction Generale des Impots (Maroc)
- **CNDP** : Commission Nationale de controle de la protection des Donnees a caractere Personnel (Maroc, Loi 09-08)
- **BAM** : Bank Al-Maghrib (banque centrale Maroc)
- **FIFO** : First In First Out (valuation stock)
- **LIFO** : Last In First Out (interdite Maroc)
- **CMP** : Cout Moyen Pondere
- **HT** : Hors Taxes
- **TTC** : Toutes Taxes Comprises
- **TVA** : Taxe sur la Valeur Ajoutee (taux standard 20% Maroc)
- **MAD** : Dirham Marocain (code ISO 4217)
- **RLS** : Row-Level Security (Postgres)
- **ETL** : Extract Transform Load
- **CDC** : Change Data Capture

---

Fin task-1.2.8.
