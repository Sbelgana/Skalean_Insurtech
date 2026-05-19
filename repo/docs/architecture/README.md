# Architecture Decision Records (ADR)

Ce dossier contient les ADRs (Architecture Decision Records) du programme Skalean InsurTech v2.2.

## Format

Chaque ADR suit le format Michael Nygard :
1. **Statut** : Acceptee / Proposee / Rejetee / Depreciee / Superseded by ADR-XXX
2. **Contexte** : Probleme a resoudre
3. **Decision** : Choix retenu
4. **Consequences** : Impact positif et negatif

## Index ADR

### Sprint 1 (Bootstrap)

- [ADR-001](./ADR-001-monorepo-structure.md) -- Monorepo pnpm + Turborepo (Acceptee)
- [ADR-002](./ADR-002-multi-tenant-3-levels.md) -- Multi-tenant 3 niveaux (Acceptee)
- [ADR-003](./ADR-003-typeorm-vs-prisma.md) -- TypeORM 0.3 retenu (Acceptee)
- [ADR-004](./ADR-004-kafka-vs-rabbitmq.md) -- Kafka KRaft retenu (Acceptee)
- [ADR-005](./ADR-005-skalean-ai-frontier.md) -- Skalean AI Frontier (Acceptee)
- [ADR-006](./ADR-006-no-emoji-policy.md) -- No-emoji ABSOLU (Acceptee)

### Sprints ulterieurs

- ADR-007 (Sprint 20) -- AI Estimation Mock factory pattern
- ADR-008 (Sprint 6) -- Data residency Maroc Atlas Cloud Services Benguerir
- ADR-009 (Sprint 10) -- Signature loi 43-20 Barid eSign + ANRT TSA
- ADR-010 (Sprint 32) -- Insure connecteurs Sprint 32 reactivation

## System overview

[system-overview.md](./system-overview.md) -- diagramme architecture haut niveau.
