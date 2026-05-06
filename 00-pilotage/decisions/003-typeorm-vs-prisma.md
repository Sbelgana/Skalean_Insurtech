# Decision 003 -- TypeORM 0.3 vs Prisma

**Date** : 2025-12
**Statut** : Acceptee
**Decideurs** : Saad (CTO)
**ADR mirror** : `repo/docs/architecture/ADR-003-typeorm-vs-prisma.md`

---

## Contexte

ORM Node.js TypeScript : choix critique pour 69+ tables data avec multi-tenant strict + RLS Postgres.

Options evaluees :
- **TypeORM 0.3** : ORM mature, support natif RLS, Subscriber pattern
- **Prisma 6** : ORM moderne, type-safe, schema-first, queries fluentes

## Probleme adresse

- Support **natif RLS Postgres** (set local + helpers)
- **Subscriber pattern** : intercepter create/update/delete pour TenantIdInjector + AuditLogWriter automatic
- **Migrations TypeScript** code-based (vs Prisma schema-only)
- Multi-tenant : RLS execute par DB pas par ORM
- Performance pool connection compatible PgBouncer transaction mode

## Decision

**TypeORM 0.3.20** retenu.

Rationale principal :
1. **RLS natif** : `SET LOCAL` execute via Subscriber pattern transparent
2. **Subscribers** : `TenantIdInjector` + `AuditLogWriter` interceptent chaque ecriture
3. **Migrations TypeScript** : versionnage code + reproductible
4. **PgBouncer transaction mode** compatible (Prisma a struggles)

Prisma rejete car :
- RLS support indirect via `$queryRaw` (boilerplate)
- Pas de Subscriber pattern equivalent (Prisma middleware partiel)
- Schema-only Prisma DSL (vs TypeScript decorators)
- Generation client requise -- complique CI/CD

## Avantages TypeORM 0.3

1. RLS Postgres invisible du code app (transparent via Subscriber)
2. Audit + Tenant Injection automatique
3. Migrations TypeScript versionnees Git
4. PgBouncer transaction mode OK
5. Mature (10+ ans, large ecosystem)

## Inconvenients TypeORM 0.3

1. Type-safety moins stricte que Prisma (need extra Zod validation)
2. Documentation 0.3 partielle (vs 0.2)
3. Performance queries < Prisma sur cas simples (mitige : query builder optimizations)

## Impact technique

- **Sprint 1** : DataSource + scripts CLI migrations
- **Sprint 2** : 32 tables PARTIE1 + Subscribers TenantIdInjector + AuditLogWriter
- Tous sprints metier : entities decorators TypeScript

## Communication

Equipe : pattern entities + repositories standardise via Pattern 1 (`4-templates-generation.md`).

## References

- Sprint 1, 2 : implementation TypeORM 0.3
- ADR-003 : detail benchmarks TypeORM vs Prisma
- TypeORM 0.3 docs : https://typeorm.io
