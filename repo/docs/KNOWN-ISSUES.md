# Known Issues -- Skalean InsurTech v2.2

Liste des items connus, defere ou nessitant attention runtime live.

## Section A : Pause Technique #4 -- post-Sprint 6 plan

Apres completion code Sprint 6, dedier une session focus pour validation runtime.

### A.1 Stack Docker test setup

```bash
cd repo
# Bring up stack test
docker compose -p skalean-insurtech-test -f infrastructure/docker/docker-compose.test.yaml up -d --wait

# Verify healthy
docker ps --filter "name=skalean.*test"
docker exec -i skalean-postgres-test psql -U skalean -d skalean_insurtech_test -c "SELECT 1"
```

### A.2 Migrations TypeORM

```bash
pnpm --filter @insurtech/database build
pnpm --filter @insurtech/database migration:run

# Verifier
docker exec -i skalean-postgres-test psql -U skalean -d skalean_insurtech_test -c "
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
"
# Doit lister ~22 tables avec rowsecurity=true.

# Verifier helpers Sprint 1
docker exec -i skalean-postgres-test psql -U skalean -d skalean_insurtech_test -c "
SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE 'app_%' ORDER BY routine_name;
"
# Doit retourner 6 helpers.

# Verifier role applicatif Sprint 1
docker exec -i skalean-postgres-test psql -U skalean -d skalean_insurtech_test -c "
SELECT rolname, rolbypassrls, rolsuper FROM pg_roles WHERE rolname IN ('skalean_app', 'insurtech_app', 'insurtech_admin');
"
# skalean_app (ou insurtech_app) doit avoir rolbypassrls=false, rolsuper=false.
```

### A.3 Activation 12 specs RLS

Pour chaque fichier dans `apps/api/test/integration/rls/` :
```bash
# Replace describe.skip -> describe, it.skip -> it
# Implementer le corps des tests selon le commentaire (Setup / Action / Verify).
```

Specs a activer (54 TC total) :
| Spec | TC count |
|------|----------|
| rls-cross-tenant-isolation-crm.spec.ts | 9 |
| rls-cross-tenant-isolation-comm.spec.ts | 5 |
| rls-cross-tenant-isolation-docs.spec.ts | 4 |
| rls-cross-tenant-isolation-pay.spec.ts | 5 |
| rls-cross-tenant-isolation-books.spec.ts | 5 |
| rls-cross-tenant-isolation-compliance.spec.ts | 5 |
| rls-cross-tenant-isolation-analytics.spec.ts | 2 |
| rls-cross-tenant-isolation-stock.spec.ts | 2 |
| rls-cross-tenant-isolation-hr.spec.ts | 2 |
| rls-cross-tenant-isolation-booking.spec.ts | 4 |
| rls-super-admin-bypass.spec.ts | 5 |
| rls-policy-coherence.spec.ts | 5 (statique, deja active) |

Run :
```bash
pnpm --filter @insurtech/api vitest run test/integration/rls/
```

### A.4 Tests integration live a faire

- TenantOnboardingService.initiate -> complete (Postgres + Redis)
- TenantSuspensionService cascade sessions Redis + revoke cross-tenant authz
- ResourceQuotaService 10 workers concurrent increments (race condition)
- CndpPurgeService initiate -> validate -> execute (grace period mock antedate)
- Middleware status enforcement : 410 archived, 403 suspended POST, GET OK

### A.5 SET LOCAL Postgres validation (deja partial fait)

Confirmation runtime existant :
```sql
BEGIN;
SELECT set_config('app.current_tenant_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
SELECT current_setting('app.current_tenant_id', true); -- within-tx OK
COMMIT;
SELECT current_setting('app.current_tenant_id', true); -- after-COMMIT empty (zero-leak)
```

Resultat 2026-05-21 Pause 2.2.4-bis : within-tx OK, after-COMMIT empty. Pattern zero-leak prouve.

## Section B : Items deferred Sprint 7+ RBAC

### B.1 JWT iat check (session age 8h max admin)

Enrichir TenantContext avec champ `authenticatedAt: number` au middleware Tache 2.2.2. SuperAdminGuard verifie `(Date.now() - authenticatedAt * 1000) < 8h`.

### B.2 Rate limit admin specifique

Sprint 5 Throttler livre. Sprint 7 wire `@Throttle({ default: { limit: 200, ttl: 60000 } })` class-level sur `AdminTenantsController`.

### B.3 Audit Kafka swap

Sprint 6 audit Pino structured. Sprint 9 Comm worker remplace par Kafka topic `insurtech.events.audit.super_admin.*` pour 10 ans retention via ClickHouse Sprint 13.

### B.4 Audit query endpoints UI

`GET /api/v1/admin/audit/super-admin-actions?from=...&to=...&user_id=...`
`GET /api/v1/admin/audit/tenant-history/:tenantId`
`GET /api/v1/admin/audit/my-actions`

Sprint 27 admin UI consomme.

### B.5 RBAC tenant-level fin

Sprint 7 ajoute `broker_admin`, `broker_user`, `broker_assistant`, `garage_admin`, etc. permissions matrix. Sprint 6 livre uniquement platform-level (super_admin_platform / analyst_support).

### B.6 Kafka events tenant lifecycle

Sprint 9 publie `insurtech.events.tenant.tenant.{created, updated, suspended, reactivated, archived, restored, onboarded, completed}` pour event-driven downstream (Comm worker, Analytics, etc.).

## Section C : Sprint 5 pre-existants (defere)

16 tests pre-existants en echec sur apps/api :
- `src/logger/logger.module.spec.ts` (1 fail telemetry init)
- `src/sentry/sentry.config.spec.ts` (7 fail profiling-node native binding)
- `src/app.module.spec.ts` (8 fail Throttle decorator mock + PASSWORD_PEPPER env)

Tous documentes dans Sprint 5 closure comme "deferred sciemment" (Pause Technique #3).

## Section D : Migrations a executer

| Migration | Sprint | Effect | Status |
|-----------|--------|--------|--------|
| 1735000000001-InitialSystem | 2 | auth_tenants/users/sessions + 14 policies | A run pause #4 |
| 1735000000002-CRM | 2 | crm_* + 16 policies | A run pause #4 |
| 1735000000003-Booking | 2 | booking_* + 4 policies | A run pause #4 |
| 1735000000004-Communications | 2 | comm_* + 12 policies | A run pause #4 |
| 1735000000005-DocsPayments | 2 | docs_*/pay_* + 6 policies | A run pause #4 |
| 1735000000006-BooksCompliance | 2 | books_*/compliance_* + 16 policies | A run pause #4 |
| 1735000000007-AnalyticsStockHr | 2 | analytics/stock/hr_* + 20 policies | A run pause #4 |
| 1735000000008-ConsumerProcessedEvents | 2 | idempotency | A run pause #4 |
| 1735000000009-AuthSprint5Augmentation | 5 | role, locale, is_active, etc. | A run pause #4 |
| 1735000000010-TenantSuspensionStatus | 6 | status enum + suspension fields | A run pause #4 |

## Section E : Configuration Pause #4

Time budget : 2-3 heures focused.

Steps :
1. (15 min) Bring up Docker stack test + verify health
2. (15 min) `migration:run` + verify schema + helpers + role
3. (60 min) Implement 50 RLS test scenarios body (skip -> active)
4. (30 min) Run + debug failures
5. (15 min) Tests integration live (onboarding, suspension, quotas, CNDP)
6. (15 min) Update KNOWN-ISSUES, V-06 report, commit

Output : Sprint 6 score 100% + tag `sprint-06-complete-validated`.
