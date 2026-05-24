# E2E Test Conventions -- Skalean Insurtech v2.2

Reusable patterns + scaffolding for in-process HTTP E2E tests against the
NestJS API. Established Sprint 8 Task 8.14b Phase 2 (foundation Session A),
hardened in Session B (TestApp boots reliably + smoke 2/2 passing).

## Two test layers in this codebase

| Layer        | Runner    | Boots                  | Hits                | Path                                |
|--------------|-----------|------------------------|---------------------|-------------------------------------|
| Unit         | Vitest    | Services in isolation  | Mocked deps         | `apps/api/src/**/*.spec.ts`         |
| Integration  | Vitest    | Services + real DataSource | Real DB             | `apps/api/test/**/*.spec.ts`        |
| **E2E**      | Vitest    | Full AppModule via FastifyAdapter | HTTP routes (`app.inject()` or supertest) | `apps/api/e2e/**/*.e2e-spec.ts` |
| Playwright   | Playwright| External server (`pnpm dev`) | HTTP routes        | `apps/api/e2e/*.spec.ts`            |

E2E (Vitest, in-process) is what Task 8.14b foundation introduces. Faster
than Playwright (no separate server process), more realistic than unit tests
(real HTTP guards / pipes / interceptors / middleware stack).

## Files delivered by Sprint 8.14b Phase 2 (foundation)

```
apps/api/
+- e2e/
|  +- setup/
|  |  +- test-app.factory.ts       <- createTestApp() / closeTestApp() / TestAppContext
|  |  +- e2e-env-setup.ts          <- env vars set BEFORE module load (vitest setupFiles)
|  +- smoke.e2e-spec.ts            <- describe.skip(...) until boot hardened
+- vitest.e2e.config.ts             <- E2E vitest config (60s timeout, singleFork, setupFiles)
+- package.json                     <- new script: "test:e2e:unit"
```

## Quickstart (once boot is hardened)

```typescript
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  closeTestApp,
  createTestApp,
  type TestAppContext,
} from './setup/test-app.factory.js';

describe('My workflow E2E', () => {
  let ctx: TestAppContext;
  beforeAll(async () => { ctx = await createTestApp(); });
  afterAll(async () => { if (ctx) await closeTestApp(ctx); });

  it('GET /some-route returns 200', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/some-route' });
    expect(res.statusCode).toBe(200);
  });
});
```

Run with `pnpm --filter @insurtech/api test:e2e:unit`.

## Required environment for E2E boot

The `e2e-env-setup.ts` setup file primes process.env BEFORE any module
import. It cascades through :
1. `.env.test` (test stack overrides)
2. `.env` (base values incl. JWT_PRIVATE_KEY / JWT_PUBLIC_KEY)
3. Hard-coded fallbacks (PASSWORD_PEPPER, MFA_SECRET_ENCRYPTION_KEY,
   CALENDAR_TOKEN_ENCRYPTION_KEY, OAuth placeholders, Redis test
   password, etc.)

### Test stack ports (Sprint 7.5b convention)

| Service  | Port | Container               | Notes                                |
|----------|------|-------------------------|--------------------------------------|
| Postgres | 5433 | skalean-postgres-test   | user/pass : `skalean / skalean_test` |
| Redis    | 6380 | skalean-redis-test      | password : `skalean_redis_test`      |
| Kafka    | 9095 | skalean-kafka-test      | KRaft mode (no Zookeeper)            |

## Session B achievements (commit d56d524)

The smoke spec passes reliably (2/2) -- AppModule boots in <1s after first
cold compile. Hardening that landed :

1. **DB credentials** : forced to `skalean:skalean_test@localhost:5433/skalean_insurtech_test`
   via hard override in `e2e-env-setup.ts` (supersedes any leaked
   `test:test` env from prior sprints).
2. **Redis auth** : `:skalean_redis_test@localhost:6380` matches the
   `--requirepass` arg of the `skalean-redis-test` container.
3. **Kafka brokers** : `localhost:9095` (Sprint 7.5b port convention).
4. **RSA keypair runtime** : `generateKeyPairSync(rsa, 2048, spki/pkcs8)` in
   setup file -- avoids dotenv parsing of base64 multi-line PEM in `.env`.
5. **Encryption keys hard-forced** : PASSWORD_PEPPER >= 32 chars,
   MFA_SECRET_ENCRYPTION_KEY = 64 hex chars (32 bytes), CALENDAR_TOKEN_*
   same.
6. **OAuth + OTel disabled** : placeholders for Google/Microsoft, OTel
   exporters set to `none`.
7. **CustomFieldsValidatorService defensive guard** : the production
   `onModuleInit` now tolerates a missing `this.definitions` injection
   (logs warn + skips invalidator registration). Production unchanged
   when DI resolves correctly ; tests no longer explode.

## Session B remaining hardening (deferred to Session C)

The first real workflow E2E (`apps/api/e2e/crm/companies.e2e-spec.ts`) is
`describe.skip`-ed because :

1. **AllExceptionsFilter Express/Fastify mismatch** : the filter calls
   `reply.status()` (Express API) instead of Fastify's `reply.code()`.
   Workaround : `createTestApp({ skipGlobals: true })`. Real fix : audit
   `apps/api/src/filters/all-exceptions.filter.ts` for Fastify
   compatibility.
2. **JwtAuthGuard JWT acceptance** : `signTestToken()` in
   `auth-helper.ts` generates a token that JwtAuthGuard returns 401 for.
   Likely a session-id check in Redis (test JWT carries a random `sid`
   not registered in `sessions:` Redis hash). Fix : either (a) bypass
   session verification in test mode, or (b) seed a session entry in
   Redis before each test.
3. **Database migrations** : the E2E setup assumes the test DB already
   has Sprint 8 migrations applied. `pnpm db:reset` must run once before
   the suite. Future polish : add `pretest:e2e:unit` script.

## JWT generation (for authenticated E2E)

The `.env` already contains base64-encoded RS256 RSA keypair
(`JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY`). Test JWT generation, once the boot
is reliable, uses `JwtService.signAccessToken({ sub, tenant_id, ... })`.
A future `auth-helper.ts` will expose role-specific builders :

```typescript
// apps/api/e2e/setup/auth-helper.ts (to be added in Session B)
createBrokerAdminToken(jwtService, tenantId): string
createBrokerUserToken(jwtService, tenantId, userId): string
createSuperAdminToken(jwtService): string
```

The token is then passed in the `Authorization: Bearer <token>` header on
each `app.inject({...})` call. The `x-tenant-id` header must also match
the JWT's `tenant_id` claim (TenantContextMiddleware enforces coherence).

## Seeds for E2E (deferred to Session B)

Sprint 8.14b Phase 2 plan calls for `apps/api/src/database/seeds/sprint-08-seed.ts`
producing : 3 tenants Maroc + 5 companies + 20 contacts + 8 rooms +
30 appointments + 10 deals + 15 interactions. Idempotent (skip if marker
tenant `broker-casa-001` already exists). Compatible with
`infrastructure/scripts/seed-with-tsx.sh` heritage (Sprint 7.5b.0).

## Workflow scenarios target (40+ tests, deferred)

See `00-pilotage/meta-prompts/B-08-sprint-08-crm-booking.md` task 3.1.14
for the full scenario list. Categories :

| Category             | Tests | Status                                    |
|----------------------|-------|-------------------------------------------|
| CRM Deals lifecycle  |   3   | deferred                                  |
| CRM Interactions     |   3   | deferred                                  |
| CRM FTS              |   2   | deferred                                  |
| CRM Custom Fields    |   2   | deferred                                  |
| Pipeline reorder     |   1   | deferred                                  |
| Soft delete          |   2   | deferred                                  |
| Booking EXCLUDE GIST |   3   | deferred                                  |
| Booking state machine|   4   | deferred                                  |
| Availability         |   3   | deferred                                  |
| iCal feed            |   3   | deferred                                  |
| Calendar Sync (conditional, PLACEHOLDER_* skip) | 10 | deferred |
| Multi-tenant isolation |  5  | deferred                                  |
| **Total**            | **40+** | deferred                                |

## Recommended Session B prompt

> Resume Sprint 8 Task 8.14b Phase 2. Foundation files in
> `apps/api/e2e/setup/` are in place. First, harden TestApp boot via
> smoke.e2e-spec.ts (un-skip describe, fix the DB user issue, mock
> Sentry/Kafka if needed). Then add the 40+ workflow tests per
> `B-08 task 3.1.14` and `docs/e2e-test-conventions.md`. Finally, tag
> `sprint-08-complete` + push.

## Tag deferral rationale

Tag `sprint-08-complete` intentionally NOT created in this session. The tag
should mark a state where 14/14 tasks are 100% complete, not partial. Phase 2
of 8.14 (E2E + seeds Maroc) being deferred keeps Sprint 8 at 13.7/14. Tag
ships with Session B when 14/14 is achieved.
