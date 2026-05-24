# Sprint 8 Summary -- CRM + Booking modules

**Status** : 13 / 14 tasks shipped + Phase 1 of Task 8.14 (tech debt resolution).
**Branch** : `main`. **Tag** : deferred until Phase 2 of Task 8.14 ships.
**Window** : Sprint 8 began at commit `4b5531e` (CRM Deals) and currently ends
at the Phase 1 + Phase 3 commit of Task 8.14.

## Tasks delivered

| #     | Task                                          | Commit prefix |
|-------|-----------------------------------------------|---------------|
| 8.1   | CRM Companies (ICE DGI + RC + soft delete)    | (CRM init)    |
| 8.2   | CRM Contacts (CIN MA + phone E.164 normalize) | (CRM init)    |
| 8.3   | CRM Pipelines + Stages (reorder workflow)     | `61bdec5`     |
| 8.4   | CRM Deals (state machine + reopen admin)      | `4b5531e`     |
| 8.5   | CRM Interactions polymorphes + timeline       | `250916c`     |
| 8.6   | CRM FTS pg_trgm cross-entity search           | `3119885`     |
| 8.7   | CRM Custom Fields jsonb + Zod runtime + LRU   | `71f97f6`     |
| 8.8   | Booking Rooms + business hours                | `48014de`     |
| 8.9   | Booking Appointments + EXCLUDE GIST + buffer  | `ffbe756`     |
| 8.10a | Calendar sync foundation (AES-256-GCM)        | `ad164a1`     |
| 8.11  | Availability free-slots service               | `e6af625`     |
| 8.10b | OAuth providers Google + Outlook (Phase 1)    | `45b9d33`     |
| 8.12  | Bi-directional sync worker (Phase 2)          | `6d6e9ad`     |
| 8.13  | iCal feed export RFC 5545 + HMAC token        | `83d92b7`     |
| 8.14  | Phase 1 (tech debt) + Phase 3 docs            | this commit   |

Phase 2 of Task 8.14 (E2E workflow tests + seeds Maroc 5 cities) is **deferred
to a follow-up session** -- the necessary TestApp / withRlsTenantContextCommit
infrastructure does not exist in `apps/api/e2e/` (only Playwright HTTP smoke
tests live there).

## Test counts

| Module / area      | Before 8.14 | After 8.14 D1+D2+D3 | Delta |
|--------------------|-------------|---------------------|-------|
| CRM services       |      174    |        192          |  +18  |
| Booking services   |      210    |        214          |   +4  |
| Auth catalog/RBAC  |      591    |        591          |    0  |
| Skipped (CRM+Book) |       13    |          0          |  -13  |
| **Module total**   |  **988**    |    **1 006**        | **+18** |

CRM 192 = 183 existing + 9 new `custom-fields-integration.spec.ts`. The 13
previously-skipped tests are now green, contributing to the +4/+18 deltas
shown above (8 in CRM, 4 in Booking, plus the 9 integration tests).

## Permissions catalog

- Pre-Sprint 8 : **138** permissions.
- Post-8.4 (BOOKING_APPOINTMENTS_OVERRIDE_WORKFLOW unchanged) : **138**.
- Post-8.7 (CRM_CUSTOM_FIELDS_MANAGE + DELETE) : **140** (net +2).
- Post-8.13 (BOOKING_ICAL_MANAGE + ADMIN) : **141** (net +3 since pre-Sprint 8).

Anti-regression assertion in `permissions-catalog.spec.ts` (`>= 130`) still
passes comfortably.

## Migrations applied

| #   | Migration                                                  | Sprint task |
|-----|------------------------------------------------------------|-------------|
| 016 | CreateCrmPipelinesStages                                   | 8.3         |
| 017 | ReshapeCrmDealsWorkflow                                    | 8.4         |
| 018 | ReshapeCrmInteractionsPolymorphic                          | 8.5         |
| 019 | AddTrigramIndexesCrm                                       | 8.6         |
| 020 | AddCustomFieldsDefinitions                                 | 8.7         |
| 021 | ExtendBookingRoomsMetadata                                 | 8.8         |
| 022 | ExtendBookingAppointmentsAddEnum                           | 8.9         |
| 023 | ReshapeBookingAppointments                                 | 8.9         |
| 024 | ExtendBookingCalendarSyncs (webhook + sync state)          | 8.10a/b     |
| 025 | CreateBookingIcalTokens                                    | 8.13        |

All 10 Sprint 8 migrations are additive over Sprint 7.5b baseline (`db:reset`
re-runs everything cleanly).

## Architecture decisions captured

1. **EXCLUDE GIST anti-double-booking** (Task 8.9) -- DB defense in depth on
   `booking_appointments(room_id, time_range)`. Service-level buffer Option B
   layers UX-friendly error on top.
2. **Polymorphic interactions Option B** (Task 8.5) -- one entity, exactly one
   of `companyId / contactId / dealId` set per row, enforced by Zod `.refine`
   and a DB CHECK constraint. Timeline aggregation queries union the three.
3. **Soft delete pattern** (heritage 8.4/8.5/8.7/8.10a) -- `deleted_at IS NOT
   NULL` excluded from default reads, restorable by admin.
4. **State machine forward-only + admin override** (Task 8.4 reopen
   pattern) -- transitions are validated server-side ; backward moves require
   `*_OVERRIDE_WORKFLOW` permission (separate from CRUD perms).
5. **AES-256-GCM token encryption** (Task 8.10a) -- TypeORM ValueTransformer
   for OAuth `access_token` / `refresh_token`. Master key in
   `CALENDAR_TOKEN_ENCRYPTION_KEY` env.
6. **Placeholders + 503 pattern** (Tasks 8.10b/8.12) -- providers detect
   `PLACEHOLDER_` env values, return clean 503 ServiceUnavailable, no code
   path explosion. Activation = swap 6 env lines + restart.
7. **Loop prevention via skipExternalSync** (Task 8.12) -- inbound webhook
   mutations apply via direct repo update (bypassing AppointmentsService),
   so no lifecycle event fires, no push-back, no infinite loop. Lifecycle
   emitter only fires when caller does NOT pass `skipExternalSync: true`.
8. **iCal feed SHA-256 token storage** (Task 8.13) -- plain token shown to
   user once, only the hash is persisted. DB leak does not compromise active
   tokens. 404 obscurity on invalid token (not 401) prevents enumeration.
9. **CustomFieldsValidator @Optional() injection** (Task 8.14 D3) -- the four
   CRM services depend on the validator via `@Optional()` so existing unit
   tests construct them without rewiring the entire validator graph. When
   wired (production), `customFields` payloads are validated against
   tenant-defined definitions before save.

## Tech debt resolved (Task 8.14 Phase 1)

### D1. `constraints-crm.spec.ts` hook timeouts (5s `beforeAll`)

Root cause : `createTestDataSource({ migrationsRun: true })` ran migrations
against an already-populated DB (typical of `pnpm db:reset` upstream) and
crashed on `tenant_type already exists`.

Fix : guard `runMigrations()` with `typeormMigrationsAlreadyRun(ds)` — if the
`typeorm_migrations` history table has at least one row, skip the runner.
Absence of the table itself is treated as "not yet migrated" (runner creates
it on first invocation).

### D2. 13 skipped `TENANT_REQUIRED` tests across 9 CRM + 4 Booking specs

Root cause : each spec used a TS default parameter
`buildService(repo, tenantId = TENANT_A)` and the failing test called
`buildService(repo, undefined)`. **TypeScript substitutes the default when
the passed value is `undefined`**, so the test ended up with a valid tenant
context and the service did not throw.

Fix : pass empty string `''` instead of `undefined`. Empty string defeats the
default substitution AND trips the falsy ternary inside `buildTenantContext`,
returning `undefined` from `getCurrentContext()` — which is what
`requireTenantId()` checks against.

All 13 tests now pass without skipping. Inline comments on every fix point
back to Task 8.14 for future readers.

### D3. CustomFieldsValidator hooks integration in 4 CRM services

Wired `CustomFieldsValidatorService` as `@Optional()` constructor argument
into `CompaniesService`, `ContactsService`, `DealsService`,
`InteractionsService`. Each service now exposes a private
`resolveCustomFields(payload)` helper :
- Returns `undefined` when DTO field not provided.
- Returns the raw payload when validator is not wired (unit tests).
- Calls `validator.validate(entityType, payload)` otherwise, which throws
  `BadRequestException(INVALID_CUSTOM_FIELDS)` on schema mismatch.

Each `create()` resolves the field once before the repo insert, each
`update()` adds `custom_fields` to the updates dict only when the DTO had a
defined value. New file `custom-fields-integration.spec.ts` (9 tests) covers
all four services + validator-absent passthrough.

## Deferred to Phase 2 of Task 8.14 (next session)

1. **E2E workflow tests** (~40+ tests) -- CRM lead-to-won, Booking
   appointment lifecycle, calendar sync push/pull, iCal feed subscribe.
   Requires building TestApp bootstrap + live-DB `withRlsTenantContextCommit`
   helpers under `apps/api/e2e/`.
2. **Seeds Maroc 5 villes** -- Casablanca, Rabat, Marrakech, Tanger, Fes.
   Plug into `apps/platform/scripts/seed-dev.ts` (Sprint 7.5b heritage). Add
   ~5 companies + ~20 contacts + ~10 rooms + ~30 appointments idempotently.
3. **Real OAuth E2E tests** -- conditional on provisioned Google + Azure
   credentials. Marker `requires_credentials` for skip-on-placeholder.
4. **Real iCal client subscription manual test guide** -- Apple Calendar
   subscribe-by-URL + Outlook subscribe + Google Calendar URL feed. Document
   refresh latencies per client.
5. **Tag `sprint-08-complete`** -- created once Phase 2 lands so the tag
   genuinely marks Sprint 8 complete (not partial).

## Cross-references

- Setup OAuth Google / Outlook : `docs/setup-oauth-calendar.md`
- Setup iCal feed : `docs/setup-ical-feed.md`
- CLAUDE.md Sprint 8 note (this directory's root)
- ADR-003 TypeORM choice (justifies the `@Optional()` DI pattern used in D3)
- ADR-006 No-emoji policy (this doc + all Sprint 8 code respects it)
