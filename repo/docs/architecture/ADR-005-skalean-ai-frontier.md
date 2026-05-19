# ADR-005 : Skalean AI Frontier (decouplage strict)

**Date** : 2026-01-15
**Statut** : Acceptee
**Decideurs** : Saad Belgana (CTO), Abla Ait Kassi (CEO)
**Mirror** : `00-pilotage/decisions/005-skalean-ai-frontier.md`

## Contexte

Skalean ecosystem comprend 2 plateformes :
- Skalean InsurTech (ce programme) : SaaS B2B assurance
- Skalean AI : Conversational + Vision API + agents (separate)

Risque : couplage tight entre les deux = maintenance enfer + lock-in modele AI.

## Decision

**Frontiere stricte : Skalean InsurTech consomme Skalean AI, JAMAIS l'inverse**.

### Architecture
- `@insurtech/sky` : REST client pour Skalean AI Conversational + Vision
- `apps/mcp-server` : expose tools metier Skalean InsurTech via MCP (Model Context Protocol)
- Skalean AI agents (Sky chatbot Sprint 31) consomment MCP tools depuis InsurTech
- Direction : InsurTech -> AI (REST), AI -> InsurTech (MCP)

### JAMAIS
- InsurTech NE PAS appel direct OpenAI/Anthropic
- InsurTech NE PAS heberge modeles AI

### Mock pendant Sprint 1-28 (decision-007)
- Sprint 1-28 : `SKALEAN_AI_USE_MOCK=true` (factory pattern Sprint 20)
- Sprint 29 : swap real Skalean AI

## Consequences

### Positives (+)
- Decouplage clair, evolutivites independantes
- Pas de lock-in modele AI specifique (OpenAI/Anthropic/etc.)
- Mock dev permet developpement sans Skalean AI ready
- MCP standard ouvert (ModelContextProtocol)

### Negatives (-)
- Sprint 29 swap mock -> real necessite tests integration nouveau
- MCP server (Sprint 30) ajoute complexite operationnelle (port 4001)
- Tests E2E Sprint 31 dependents Skalean AI staging

## References

- decision-005 (mirror)
- Sprint 1 (B-01) : SKALEAN_AI_USE_MOCK env var
- Sprint 20 (B-20) : Mock factory IA Estimation
- Sprint 29 (B-29) : Skalean AI swap mock -> real
- Sprint 30 (B-30) : MCP server 15+ tools metier
- Sprint 31 (B-31) : Sky chatbot consomme MCP
