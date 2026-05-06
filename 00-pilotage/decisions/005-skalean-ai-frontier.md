# Decision 005 -- Skalean AI Frontier Model (vs Self-hosted)

**Date** : 2026-02
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-005-skalean-ai-frontier.md`

---

## Contexte

Skalean InsurTech necessite IA pour :
- Estimation photos sinistre vehicule (Sprint 20 + 29)
- Agent Sky multilingue (Sprint 31)
- Generation documents PDF (futur)
- Detection fraude (futur Phase 8+)

Options evaluees :
- **Skalean AI Frontier** (service externe Skalean Group)
- **Self-hosted models** (Llama 3 / Mistral via Ollama)
- **External providers** (OpenAI / Anthropic direct)

## Probleme adresse

- Cost predictabilite per call vs subscription
- Data residency MA (CNDP loi 09-08 critical)
- Latence acceptable (< 5s LLM, < 60s vision)
- Multi-modale : vision + LLM + embeddings
- Compatibility OpenAI-format pour SDKs standards

## Decision

**Skalean AI Frontier** retenu (service externe Skalean Group).

Rationale :
- **Data residency MA** : Skalean AI infrastructure Maroc (vs OpenAI USA)
- **Coherence ecosystem Skalean** : vendor-neutral pour InsurTech, mais leverage ecosystem Skalean Group
- **OpenAI-compatible API** : facilite migration si decision change futur
- **Multi-modale natif** : vision + LLM + embeddings 1 service

Self-hosted rejete :
- Maintenance infra non-core business
- Performance vs frontier models inferieure
- Cout total ownership > frontier API
- Equipe Skalean InsurTech focus business

External providers (OpenAI/Anthropic) rejete :
- Data residency hors MA (CNDP issue)
- Cost predictability variable (token-based)

## Avantages

1. **Data residency MA** = compliance CNDP automatic
2. OpenAI-compatible API = SDKs standards utilisables
3. Multi-modale 1 service (vision + LLM + embeddings)
4. Sprint 29 swap one-line config (Mock -> Real)
5. Cost monitoring + budget alerts integres

## Inconvenients

1. **Lock-in vendor Skalean Group** (mitige : SDK adapter pattern Sprint 29)
2. Latence reseau (Maroc -> Skalean AI infra)
3. Pas tests offline (mitige : MockIaEstimationClient Sprint 20)

## Impact technique

- **Sprint 20** : Mock client realistic pendant dev
- **Sprint 29** : Real client + activation gradual rollout (10% -> 50% -> 100%)
- **Sprint 30** : MCP server expose tools metier a Skalean AI
- **Sprint 31** : Agent Sky multilingue

## Communication

Equipe : pattern AI-defere (decision-007) explicit. Sprint 20 fournit interface stable.
Investisseurs : choix Skalean Group strategic alignment.

## References

- Decision-007 : AI-defere strategy (Mock -> Real swap)
- Sprint 20, 29, 30, 31 : implementation
- ADR-005 : detail benchmarks frontier models
