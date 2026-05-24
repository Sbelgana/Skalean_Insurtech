# E2E Test Conventions -- Skalean Insurtech v2.2

Reusable patterns + scaffolding for in-process HTTP E2E tests against the
NestJS API. Established Sprint 8 Task 8.14b Phase 2 (foundation), to be
hardened + populated with 40+ workflow tests in the follow-up session.

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

## Known issues hardening in Session B

The smoke spec is `describe.skip`-ed because the full AppModule boot surfaces
N+1 connection issues each requiring ~15-30s round-trips to debug. Track in
session B :

1. **DB credentials matchup** : `.env.test` says
   `postgresql://skalean:skalean_test@localhost:5433/skalean_insurtech_test`
   but TypeORM AppDataSource sees `user "test"` -- likely a parse / overload
   issue in `@insurtech/database/data-source`. Fix by passing explicit
   `host/user/password/database` env vars or harden the URL parser.
2. **Kafka topic creation** : KafkaModule may try to create topics at
   boot. Test stack `skalean-kafka-test` is empty -- either auto-create
   on first publish (preferred) or mock the producer at the module level.
3. **Sentry init** : `bootstrap-integration.spec.ts` already mocks
   `sentry.config` via `vi.mock`. The E2E factory can mirror that.
4. **OTel exporters** : already disabled via env (`OTEL_*_EXPORTER=none`).
5. **Database migrations** : `pnpm db:reset` must run before the E2E
   suite (heritage Sprint 7.5b). Add a `pretest:e2e:unit` script that
   runs `pnpm --filter @insurtech/database db:reset --test`.

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
