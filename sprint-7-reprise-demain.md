# Sprint 7 Reprise Plan -- demain matin frais

## Etat actuel (fin session 2026-05-21)

- Sprint 7 Tache 2.3.1 livre : 90 permissions / 20 modules / 12 roles catalog
- Dernier tag : `sprint-06-complete-validated`
- Dernier commit : `15e80cb feat(sprint-07): definition 12 roles + 85+ permissions catalog`
- Tests auth : **381 PASS** (+28 RBAC catalog Sprint 7)
- Tests api : 690 PASS / 16 fails Sprint 5 pre-existants / 35 templates skipped
- Cumul projet : ~1071 tests PASS

## Docker stack (laisse UP pour reprise rapide)

- skalean-postgres-test : Up healthy (port 5433)
- skalean-redis-test : Up healthy (port 6380)
- skalean-kafka-test : Up healthy (port 9095)

## Plan reprise

### Session 1 (4-5h matin frais)

- **2.3.2 PermissionsMatrix + RoleHierarchy** (CRITIQUE - pierre angulaire RBAC)
  - Mapper chaque role -> permissions[] (Set<PermissionValue>)
  - broker_admin ~60 / broker_user ~30 / garage_admin ~55 / garage_technicien ~20 / etc.
  - super_admin_platform -> RBAC_WILDCARD (bypass)
  - analyst_support -> read-only subset (getAllReadPermissions)
  - Eviter explosion combinatoire : Set Operations, pas string regex
- **2.3.3 RbacService** evaluation principale (canAccess, getEffectivePermissions, cache integration prep)
- **2.3.4 RoleGuard + decorators** `@Role()`, `@MinRole()` composable
- **2.3.5 PermissionGuard + @RequirePermission()** decorator
- **2.3.6 Types ABAC** PolicyContext / PolicyResult interfaces

### Session 2 (3-4h apres-midi)

- **2.3.7 AbacService + 4 policies** : Ownership, TimeWindow, Status, Workflow
- **2.3.8 AbacGuard + @AbacPolicy** + resource loader
- **2.3.9 RbacAuditService** log granted/denied (loi 09-08 obligatoire)
- **2.3.10 PermissionCacheService Redis** TTL 5min + invalidation
- **2.3.11 PermissionsController** admin endpoints (CRUD roles users)
- **2.3.12 Tests 80+ scenarios + seeds 12 users** (12 users couvrant tous roles)
- V-07 verification + tag `sprint-07-complete`

### Items defere a wire dans Sprint 7 (rappel Sprint 6 closure)

- **JWT iat < 8h check** : enrichir TenantContext avec `authenticatedAt`, SuperAdminGuard verifie session age
- **Rate limit 200/min admin** : Throttler Sprint 5 wire class-level sur AdminControllers

## Conventions critiques RAPPEL (voir KNOWN-ISSUES.md section 0 pour full)

### Multi-tenant + RLS (Sprint 6 + Pause #4)
- FORCE ROW LEVEL SECURITY actif sur 33 tables -> cleanup tests via `set_config('app.is_super_admin', 'true', true)`
- Role applicatif Postgres : `insurtech_app` (PAS `skalean_app`)
- Helpers tests RLS : `withRlsTenantContextCommit` (COMMIT) / `withRlsTenantContext` (ROLLBACK) / `withRlsBypass` / `withRlsSuperAdminContext`
- TenantContext via AsyncLocalStorage
- 7-couches defense in depth deja en place

### TypeScript strict
- `noUncheckedIndexedAccess: true` + `exactOptionalPropertyTypes: true`
- AUCUN `any` implicite -> preferer `unknown` + narrowing
- AUCUN `// @ts-ignore` -> `// @ts-expect-error` avec commentaire

### Tests
- Vitest + `--passWithNoTests` sur stubs
- Mocks vi.hoisted() pour variables top-level
- Pattern : direct instantiation NestJS controllers (pas Test.createTestingModule sauf integration)

### Securite + conformite
- argon2id passwords / RS256 JWT / Pino structured logs / 0 emoji
- Loi 09-08 CNDP audit obligatoire role changes
- ACAPS InsurTech compliance preparation

### Format commits
- Conventional Commits : `feat(sprint-07): description lowercase`
- Footer : `Task: 2.3.X` / `Sprint: 7 (Phase 2 / Sprint 3)`

## Commit summary aujourd'hui

```
15e80cb feat(sprint-07): definition 12 roles + 85+ permissions catalog  [Sprint 7]
4c145bb test(sprint-06): live runtime validation pause technique #4     [Pause #4]
76fac61 feat(sprint-06): rls test specs skeleton + cndp purge procedure [2.2.12]
5431105 feat(sprint-06): resource quota service with tier-based limits  [2.2.11]
a403c45 feat(sprint-06): super admin guard with audit and role distinctions [2.2.10]
... (+18 commits Sprint 6 anterior)
```

## Pre-flight check demain matin

```bash
cd "C:/Users/belga/Desktop/Skalean_Insurtech/repo"

# Verify stack still UP
docker compose -p skalean-insurtech-test -f infrastructure/docker/docker-compose.test.yaml ps

# Verify tests still PASS
pnpm --filter @insurtech/auth test

# Verify branch state
git log --oneline | head -3
```

Bonne nuit. Sprint 7 vous attend demain frais et bien repose.
