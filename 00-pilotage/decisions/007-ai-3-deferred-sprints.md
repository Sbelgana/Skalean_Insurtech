# Decision 007 -- AI Defere Strategy (Mock Sprint 20 -> Real Sprint 29)

**Date** : 2026-01
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-007-ai-defere-pattern.md`

---

## Contexte

Skalean InsurTech utilise Skalean AI pour :
- Estimation photos sinistre vehicule (vision)
- Agent Sky multilingue (LLM + tools)
- Generation documents (futur)

Initialement plan : Skalean AI client Sprint 8-9 (Phase 3). Probleme : dependance externe ecosystem Skalean Group + cout calls reels pendant dev + tests deterministes difficiles.

## Probleme adresse

- API Skalean AI peut evoluer pendant Phase 3-6 dev
- Real calls Skalean AI couteux pendant dev (mock gratuit)
- Tests deterministes : mock retourne data consistent
- Pas de bloquant flows downstream (Sprint 21, 22, 24 utilisent estimation)
- Activation gradual rollout production critique

## Decision

**Pattern AI-defere : Mock realistic pendant dev -> Real swap one-line config**.

Cycle :
- **Sprint 20 (Phase 5)** : `MockIaEstimationClient` -- mock realistic data
- **Sprint 29 (Phase 7)** : `SkaleanAiVisionClient` -- real Skalean AI integration
- **Swap** : `IA_ESTIMATION_PROVIDER=mock` -> `skalean_ai` (one-line `.env` change)

Activation gradual rollout :
- Sprint 29 : 10% trafic real / 90% mock
- Sprint 30 : 50/50
- Sprint 31 : 100% real
- Rollback procedure < 60s switch back

Pattern reutilise pour autres AI features :
- Skalean AI MCP server (Sprint 30)
- Agent Sky multilingue (Sprint 31)

## Avantages

1. **Predictabilite execution Phase 3-6** : ne depend pas ecosystem externe
2. **Cost reduction dev** : 100% mock = 0 MAD facture Skalean AI
3. **Tests deterministes** : mock retourne data consistente
4. **Rollback safety** : swap config one-line si issues prod
5. **Pattern reutilisable** : applique aux autres AI features

## Inconvenients

1. **Drift mock vs real** : mock peut diverger comportement reel (mitige : interface contract strict)
2. **Migration validation Sprint 29** : 100 estimations Mock vs Real comparison
3. **Equipe attente** : pas de demo IA reelle avant Phase 7

## Impact technique

- **Sprint 20** : interface `IaEstimationPhotosClient` + `MockIaEstimationClient`
- **Sprint 29** : `SkaleanAiVisionClient` + DI swap factory + circuit breaker fallback Mock
- Variables env : `IA_ESTIMATION_PROVIDER` controle swap

## Communication

Equipe technique : pattern explicit dans `8-skalean-insurtech-prompt-master.md` Section 8.1.
Investisseurs : justification execution predictable + rollback safety.

## References

- Sprint 20 (B-20), 29 (B-29) : implementation
- `9-roadmap-execution.md` Section 3 : AI-defere strategy detaillee
- ADR-007 : pattern technique
