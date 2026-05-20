# @insurtech/api-client

Generated TypeScript API client for the Skalean InsurTech NestJS backend.
Auto-generated from the OpenAPI 3.1 Swagger spec exposed at `/docs-json`.

## Why this package exists

- **No drift** between backend DTOs (NestJS class-validator) and frontend types (TypeScript).
- **Autocomplete** on every endpoint, every parameter, every response shape.
- **Compile-time error** if the backend renames a field or removes an endpoint.
- **Runtime guarantees**: middleware chain injects multi-tenant headers, JWT bearer + refresh, idempotency.

## Installation (already done in monorepo)

This package is automatically linked in all 8 frontend apps via:

```json
"dependencies": {
  "@insurtech/api-client": "workspace:*"
}
```

## Usage

### Basic GET request

```typescript
import { apiClient } from '@insurtech/api-client/client';

const { data, error, response } = await apiClient.GET('/api/v1/policies/{id}', {
  params: { path: { id: policyId } },
});

if (error) {
  console.error('API error', error);
} else {
  console.log('Policy', data); // typed as PolicyDto
}
```

### React Query hook

```tsx
import { useApiQuery } from '@insurtech/api-client';

export function PolicyView({ id }: { id: string }) {
  const { data, isLoading, error } = useApiQuery('/api/v1/policies/{id}', {
    params: { path: { id } },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  return <div>{JSON.stringify(data)}</div>;
}
```

### Mutation with invalidation + Idempotency

```tsx
import { useApiMutation } from '@insurtech/api-client';

const createPolicy = useApiMutation('/api/v1/policies', 'post', {
  invalidateQueries: [['api', '/api/v1/policies']],
  successToastMessage: 'Police creee',
});

createPolicy.mutate({
  name: 'Auto Tiers',
  premium: 1500,
  startDate: '2026-06-01',
});
```

The middleware automatically:
- injects `Authorization: Bearer <accessToken>`
- injects `Idempotency-Key: <UUIDv7>` (stored in sessionStorage 24h for safe retry)
- injects `x-tenant-id: <currentTenantId>`, `x-trace-id`, `x-user-id`

### Cursor pagination

```tsx
const { data, fetchNextPage, hasNextPage } = useApiInfiniteQuery(
  '/api/v1/contacts',
  { query: { sortBy: 'createdAt' } },
  { pageSize: 50 },
);

const allContacts = data?.pages.flatMap((p) => p.items) ?? [];
```

## Regeneration workflow

### Manual

```bash
# 1. Start backend
pnpm --filter @insurtech/api dev

# 2. Regenerate (from repo root)
pnpm generate:api-client

# 3. Verify
pnpm --filter @insurtech/api-client typecheck
pnpm --filter @insurtech/api-client test

# 4. Commit
git add packages/api-client/src/types.gen.ts
git commit -m "chore(api-client): regenerate from OpenAPI"
```

### One-shot orchestrator (auto starts backend, auto commits)

```bash
pnpm generate:api-client --commit
```

### CI workflow (post-merge)

`.github/workflows/regenerate-api-client.yml` (Sprint 4 task 1.4.13 deliverable):
- Trigger: `push` on main branch + paths `apps/api/**`
- Job: spin up Postgres + backend, run `pnpm generate:api-client --commit --push`
- Result: types.gen.ts always in sync with main backend

## Type-safety guarantees

| Scenario | Result |
|----------|--------|
| Endpoint exists, params correct | Compiles, autocomplete works |
| Endpoint does not exist | TypeScript compile error |
| Path param missing | TypeScript compile error |
| Path param wrong type | TypeScript compile error |
| Response field not in schema | TypeScript compile error |
| Backend renames field, not regenerated | Compile error after regeneration |

## Architecture

```
src/
  client.ts              -- openapi-fetch factory, singleton, middleware composition
  types.gen.ts           -- AUTO-GENERATED from OpenAPI. DO NOT EDIT.
  middleware/
    tenant-middleware    -- x-tenant-id, x-trace-id, x-user-id, Accept-Language
    auth-middleware      -- Authorization Bearer + refresh rotation with mutex
    idempotency-middleware -- Idempotency-Key UUIDv7 for POST/PUT/PATCH/DELETE
  hooks/
    useApiQuery          -- typed wrapper around useQuery
    useApiMutation       -- typed wrapper around useMutation + invalidation + toast
    useApiInfiniteQuery  -- cursor pagination with useInfiniteQuery
  zod-schemas/
    index.ts             -- runtime validation (Sprint 5+ enriches)

scripts/
  generate.ts            -- fetch /docs-json, run openapi-typescript, prettier, atomic write
  validate.ts            -- typecheck + smoke tests post-generation
```

## Refresh token rotation flow

```
GET /api/v1/policies (with expired access token)
  -> 401 Unauthorized
  -> auth-middleware intercepts, calls refreshAccessToken()
  -> refreshPromise (module-scope mutex) starts
  -> POST /api/v1/auth/refresh { refreshToken }
  -> 200 { accessToken: "new", refreshToken: "rotated" }
  -> useAuthStore.setTokens(...)
  -> mutex resolves with new token
  -> original request retried with new Authorization header
  -> 200 OK -> data returned
```

If refresh fails (refresh token also expired):
  -> redirect to `/login?reason=session-expired`
  -> Sprint 5 auth flow takes over

## Idempotency-Key flow

For POST/PUT/PATCH/DELETE:
1. Compute storage key: `insurtech.idempotency.<METHOD> <URL> <body slice>`
2. If sessionStorage has entry < 24h old, reuse same UUIDv7.
3. Else generate fresh UUIDv7, store, attach to request.
4. Backend (Sprint 14) deduplicates: same key + same body -> returns cached response.

This makes mutations safe to retry on network errors.

## Error handling + toast integration

`useApiMutation` automatically shows a Sonner toast (from `@insurtech/shared-ui/components/toaster`) on error.
Disable per call with `showErrorToast: false`.

## Examples per app

### web-broker (Sprint 5 Auth)

```tsx
const login = useApiMutation('/api/v1/auth/login', 'post', {
  successToastMessage: 'Connexion reussie',
});
login.mutate({ email, password });
```

### web-garage (Sprint 22 Sinistres)

```tsx
const claims = useApiInfiniteQuery('/api/v1/claims', {
  query: { status: 'pending', garageId },
});
```

### web-insurtech-admin (Sprint 27 Dashboards)

```tsx
const stats = useApiQuery(
  '/api/v1/admin/dashboard/stats',
  { params: { query: { range: '30d' } } },
  { staleTime: 5 * 60_000 },
);
```

## Sprint 5+ extensions

- Zod schemas auto-derived from OpenAPI (see `src/zod-schemas/index.ts` placeholder)
- MSW (Mock Service Worker) handlers auto-generated for offline E2E tests
- React Query Suspense mode integration with Next.js 15 RSC
- Versioned client publishing for external partners (Sprint 28+)

## Troubleshooting

### "Backend not reachable"

Run `pnpm --filter @insurtech/api dev` first.

### "Typecheck failed on generated types.gen.ts"

The OpenAPI spec is malformed. Check backend for circular schemas or missing `@ApiProperty` decorators.

### "Conflict on types.gen.ts during git merge"

```bash
git checkout --theirs packages/api-client/src/types.gen.ts
pnpm generate:api-client
git add packages/api-client/src/types.gen.ts
git commit
```

The file is deterministic, so regenerating produces a clean state.

## Conventions

- NO EMOJI in any file or commit message (decision-006).
- TypeScript strict mode, `noUncheckedIndexedAccess` enabled.
- Generated file header is sacred -- `no-edit-generated-types` rule enforces.
- All middlewares are pure functions (no hidden side effects beyond documented stores).

## License

Proprietary -- Skalean SAS, Atlas Cloud Benguerir, Maroc.
