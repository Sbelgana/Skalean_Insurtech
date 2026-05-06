# META-PROMPT B-31 -- SPRINT 31 AGENT SKY MULTILINGUE

**Version** : v2.2 (Option B)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 31 / 35 (cumul) -- Phase 7 Sprint 3
**Position** : Apres MCP Server, avant Pentest Securite
**Numerotation taches** : 7.3.1 a 7.3.12
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (Sky chatbot multilingue critical pour UX brokers + garages + customers)

---

## Objectif Global du Sprint

Implementer **Agent Sky** : chatbot multilingue (fr / ar-MA darija / ar classique / en) integre dans 4 apps (web-broker + web-garage + web-customer-portal + web-assure-portal). Sky utilise MCP client (Sprint 30) pour appeler 15 tools metier + Skalean AI conversational backend pour formuler reponses naturelles. Sky apporte UX dramatic improvement : "what is policy P-2026-00123 status" -> immediate answer in user's language vs 5 clicks navigation Sprint 22 desktop.

A la sortie de ce sprint :
- Chatbot Sky integre 4 apps (chat widget bottom-right)
- Multilingue 4 langues : fr / ar-MA (darija) / ar (classique) / en
- MCP client consume Sprint 30 tools (15 tools)
- Conversational UI : streaming responses + history conversation + context window
- Confirmation modal pour write tools (Sprint 30 idempotency)
- Voice-to-text input (Web Speech API fr-MA + ar)
- Quick suggestions per role : 4-6 prompts contextuels
- Analytics conversations : success rate + tools usage + user satisfaction
- Persistance conversations : history user (last 30 jours)
- Tests E2E + WCAG accessibility

---

## Frontiere du Sprint

**INCLUS** :
- Chat widget integre 4 apps
- Multilingue 4 langues + RTL
- MCP client integration (consume Sprint 30 tools)
- Confirmation modals write tools
- Voice-to-text input
- Conversation history + persistance
- Analytics dashboard
- Tests E2E

**EXCLU** (sera ajoute aux sprints suivants) :
- Sky integre web-garage-mobile + web-assure-mobile (PWA mobile) -- Phase 7+ (UX mobile-first specifique a developper)
- Sky integre web-insurtech-admin (Skalean staff) -- pas necessaire (super admins ont autres outils admin)
- Voice output text-to-speech -- Phase 7+
- Sky generative document creation -- Phase 7+
- Sky proactif (push suggestions) -- Phase 7+

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 30 : MCP server + 15 tools + auth tokens
2. Sortie Sprint 29 : Skalean AI REST integration pattern
3. Sortie Sprint 16 : web-broker pattern + auth context
4. Sortie Sprint 9 : Sprint Comm i18n templates fr/ar-MA/ar

---

## Stack Imposee (Sprint 31)

| Composant | Version | Notes |
|-----------|---------|-------|
| @modelcontextprotocol/sdk | latest | MCP client |
| @ai-sdk/react | 4.x | streaming + chat hooks (Vercel AI SDK) |
| react-markdown | 9.x | render Sky responses (markdown supported) |
| openai | 4.x | client format compatible (Skalean AI exposes OpenAI-compatible API) |
| zod | 3.24.1 | validation |

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 7.3.1 | Backend Sky orchestrator : Skalean AI conversational + MCP client setup | 7h | P0 | Sprint 30 |
| 7.3.2 | System prompts multilingues per app (broker / garage / customer) | 5h | P0 | 7.3.1 |
| 7.3.3 | MCP tool calling : agent loop + tool selection + result integration | 6h | P0 | 7.3.2 |
| 7.3.4 | Backend conversations persistance + history retrieval | 5h | P0 | 7.3.3 |
| 7.3.5 | Chat widget UI shared package (3 apps) + streaming + markdown render | 7h | P0 | 7.3.4 |
| 7.3.6 | Integration web-broker (Sprint 16) + i18n fr/ar-MA/ar/en | 5h | P0 | 7.3.5 |
| 7.3.7 | Integration web-garage (Sprint 22) + role-specific suggestions | 5h | P0 | 7.3.6 |
| 7.3.8 | Integration web-customer-portal (Sprint 17) + onboarding adapted | 5h | P0 | 7.3.7 |
| 7.3.8b | Integration web-assure-portal (Sprint 18) + suggestions assure post-souscription | 4h | P0 | 7.3.8 |
| 7.3.9 | Confirmation modals write tools + idempotency UI | 5h | P0 | 7.3.8 |
| 7.3.10 | Voice-to-text input + analytics dashboard Sky | 6h | P0 | 7.3.9 |
| 7.3.11 | Documentation + onboarding users + best prompts catalog | 4h | P0 | 7.3.10 |
| 7.3.12 | Tests E2E (15+) + WCAG + Lighthouse | 9h | P0 | 7.3.11 |

**Total** : 73 heures (incl. 4h Tache 7.3.8b web-assure-portal).

---

# DETAIL DES 12 TACHES

---

## Tache 7.3.1 -- Backend Sky Orchestrator + MCP Client

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 7h / Depend de Sprint 30

**But** : Backend orchestrator Sky : appel Skalean AI conversational API (OpenAI-compatible) + setup MCP client pour tool calling.

**Livrables checkables** :
- [ ] Service `sky-orchestrator.service.ts` :
  - Endpoint `POST /api/v1/sky/chat` body { message, conversation_id?, app_context, locale }
  - Init MCP client Sprint 30 + load tools list
  - Construct messages array (system + history + user message + tool calls/results)
  - Call Skalean AI streaming endpoint
  - Stream response to client (SSE)
- [ ] MCP client init :
  - Exchange user JWT via `POST /mcp/v1/auth/exchange` -> MCP token (Sprint 30 Tache 7.2.3)
  - Discover tools list from `GET /mcp/v1/discover`
  - Cache tool definitions per session
- [ ] Skalean AI conversational format : OpenAI-compatible (function calling)
- [ ] Tool calling loop :
  1. Send messages + tools to Skalean AI
  2. If response has tool_calls : execute via MCP client
  3. Append tool results to messages
  4. Re-call Skalean AI for final response
  5. Repeat max 5 iterations (avoid infinite loops)
- [ ] Streaming SSE proxied to chat UI
- [ ] Tests : flow + tool calling

**Pattern critique : Sky orchestrator avec tool calling**

```typescript
// repo/packages/sky/src/services/sky-orchestrator.service.ts
@Injectable()
export class SkyOrchestrator {
  constructor(
    private mcpClient: McpClientService,
    private skaleanAiClient: SkaleanAiConversationalClient,
    private conversationsService: ConversationsService,
    private logger: Logger,
  ) {}

  async *chat(params: SkyChatParams): AsyncGenerator<SkyEvent> {
    const { message, conversation_id, app_context, locale, user_id, tenant_id } = params;

    // Load or create conversation
    const conversation = conversation_id
      ? await this.conversationsService.findById(conversation_id)
      : await this.conversationsService.create({ user_id, app_context, locale });

    // Get MCP tools (cached or fresh)
    const tools = await this.mcpClient.getToolsForUser(user_id, tenant_id);

    // Build messages
    const systemPrompt = this.getSystemPrompt(app_context, locale);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversation.messages.map(m => ({ role: m.role, content: m.content, ...(m.tool_calls && { tool_calls: m.tool_calls }) })),
      { role: 'user', content: message },
    ];

    let iteration = 0;
    const maxIterations = 5;

    while (iteration < maxIterations) {
      iteration++;

      // Call Skalean AI streaming
      const stream = await this.skaleanAiClient.chatCompletion({
        model: 'skalean-conversational-v1',
        messages,
        tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
        stream: true,
      });

      let assistantMessage: AssistantMessage = { role: 'assistant', content: '', tool_calls: [] };

      // Stream chunks
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          assistantMessage.content += delta.content;
          yield { type: 'content_delta', delta: delta.content };
        }
        if (delta?.tool_calls) {
          // Accumulate tool_calls (streaming format)
          this.mergeToolCallDeltas(assistantMessage.tool_calls, delta.tool_calls);
        }
      }

      messages.push(assistantMessage);

      // No tool calls : final response
      if (assistantMessage.tool_calls.length === 0) {
        await this.conversationsService.appendMessage(conversation.id, assistantMessage);
        yield { type: 'done', conversation_id: conversation.id };
        return;
      }

      // Execute tool calls
      yield { type: 'tools_calling', tools: assistantMessage.tool_calls.map(tc => tc.function.name) };

      for (const toolCall of assistantMessage.tool_calls) {
        try {
          const result = await this.mcpClient.callTool({
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments),
            idempotency_key: `${conversation.id}:${toolCall.id}`,
          });
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
          yield { type: 'tool_result', tool_call_id: toolCall.id, success: true };
        } catch (error) {
          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: error.message }),
          });
          yield { type: 'tool_result', tool_call_id: toolCall.id, success: false, error: error.message };
        }
      }
      // Loop : re-call Skalean AI with tool results
    }

    // Max iterations reached : warn
    yield { type: 'error', error: 'Max iterations reached, stopping' };
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/sky/                                                                                  # full package
repo/packages/sky/src/services/sky-orchestrator.service.ts                                          # ~400 lignes
repo/packages/sky/src/services/mcp-client.service.ts                                                  # ~250 lignes
repo/packages/sky/src/services/skalean-ai-conversational.client.ts                                     # ~250 lignes
repo/apps/api/src/modules/sky/sky.controller.ts                                                          # ~150 lignes
repo/apps/api/src/modules/sky/sky.module.ts                                                              # ~80 lignes
```

**Notes implementation** :
- Vercel AI SDK pattern : `streamText` with tools
- Tool calling loop max 5 iterations : eviter infinite loops
- Idempotency-Key per tool call : eviter double execution si retry
- Streaming SSE proxied client : faible latency perceived

**Criteres validation** :
- V1 (P0) : Endpoint chat + streaming
- V2 (P0) : MCP client integration
- V3 (P0) : Tool calling loop functional
- V4 (P0) : Max iterations safety
- V5 (P0) : Tests 8+ scenarios

---

## Tache 7.3.2 -- System Prompts Multilingues Per App

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 5h / Depend de 7.3.1

**But** : System prompts adaptes per app + per locale -- Sky comprend contexte business + langue user.

**Livrables checkables** :
- [ ] System prompts per app (4 apps x 4 locales = 16 prompts) :
  - **web-broker** : "Tu es Sky, assistant courtier Skalean Insurtech. Tu aides les courtiers a gerer polices, devis, sinistres, customers..."
  - **web-garage** : "Tu es Sky, assistant garage. Tu aides chef garage et techniciens..."
  - **web-customer-portal** : "Tu es Sky, assistant assure. Tu aides clients a souscrire..."
- [ ] Each prompt includes :
  - Role + capabilities + langue
  - Tools available (auto-injected from MCP discovery)
  - Examples interactions
  - Limitations : Sky ne donne pas conseil juridique, ne fait pas commitments business sans validation, etc.
  - Tone : professionnel + chaleureux + concis
- [ ] Locale-specific :
  - **fr** : francais Maroc (terminology assurance MA)
  - **ar-MA** : darija casablanca (informel friendly)
  - **ar** : arabe classique (formel)
  - **en** : English Maghreb (international team Skalean)
- [ ] Service `system-prompts.service.ts` : compose prompt selon app + locale + user role
- [ ] Tests : prompts loaded correctly

**Fichiers crees / modifies** :
```
repo/packages/sky/src/prompts/{web-broker,web-garage,web-customer-portal}-{fr,ar-MA,ar,en}.md         # 12 prompts
repo/packages/sky/src/services/system-prompts.service.ts                                                # ~150 lignes
```

**Notes implementation** :
- Prompts en markdown : faciles editer + version control
- Examples interactions : few-shot learning
- Limitations explicites : safety + business compliance
- Tone calibrated : Skalean brand identity

**Criteres validation** :
- V1 (P0) : 12 prompts disponibles
- V2 (P0) : Service compose correctement
- V3 (P0) : Tests 5+ scenarios

---

## Tache 7.3.3 -- MCP Tool Calling : Agent Loop

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 6h / Depend de 7.3.2

**But** : Implementation complete agent loop : tool selection + execution + result integration + safety checks.

**Livrables checkables** :
- [ ] Loop logic Tache 7.3.1 enrichi :
  - Tool selection : Skalean AI decide quel tool appeler selon message + tools available
  - Validation arguments : Zod check input avant execute (defense supplementaire)
  - Execution via MCP client (Sprint 30)
  - Result integration : append tool result message
  - Re-prompt Skalean AI avec results
- [ ] Safety checks :
  - Max iterations 5
  - Timeout total 60s (sinon yield 'timeout' + stop)
  - Whitelist tools per app context (e.g. customer-portal cannot call `create_quote_draft`)
  - Forbidden tools per role (e.g. customer cannot access analytics tools)
- [ ] Tool result formatting : succes -> JSON ; error -> `{ error: ..., suggestion: ... }` (Sky comprend context)
- [ ] Logging : every tool call attempted + outcome
- [ ] Tests : iterations + safety + edge cases

**Fichiers crees / modifies** :
```
repo/packages/sky/src/services/agent-loop.service.ts                                                    # ~300 lignes
repo/packages/sky/src/services/tool-permissions.service.ts                                                # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Tool selection automatic
- V2 (P0) : Whitelist per app + role
- V3 (P0) : Safety max iterations + timeout
- V4 (P0) : Error handling graceful
- V5 (P0) : Tests 10+ scenarios

---

## Tache 7.3.4 -- Conversations Persistance

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 5h / Depend de 7.3.3

**But** : Persister conversations Sky : history per user + retrieval + cleanup retention.

**Livrables checkables** :
- [ ] Migration : table `sky_conversations` :
  - id, user_id, tenant_id, app_context, locale, started_at, last_message_at, total_messages, summary (jsonb : auto-generated TLDR last 5 messages)
- [ ] Migration : table `sky_messages` :
  - id, conversation_id, role (user/assistant/tool), content, tool_calls (jsonb), tool_call_id, created_at
- [ ] Service `conversations.service.ts` :
  - `create(params)` : INSERT row
  - `appendMessage(conversationId, msg)` : INSERT message + update conversation
  - `getHistory(userId, limit)` : list user's conversations recent
  - `getMessages(conversationId)` : full thread
  - `deleteOld(retention_days=30)` : cron daily cleanup
- [ ] Endpoints :
  - `GET /api/v1/sky/conversations` (user's history)
  - `GET /api/v1/sky/conversations/:id/messages`
  - `DELETE /api/v1/sky/conversations/:id`
- [ ] Permissions : user can only see own conversations
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-SkyConversations.ts                                          # ~50 lignes
repo/packages/database/src/migrations/{date}-SkyMessages.ts                                                # ~50 lignes
repo/packages/sky/src/entities/{2 entities}.ts                                                              # ~80 lignes
repo/packages/sky/src/services/conversations.service.ts                                                      # ~250 lignes
repo/apps/api/src/modules/sky/conversations.controller.ts                                                     # ~120 lignes
repo/packages/sky/src/jobs/cleanup-old-conversations.cron.ts                                                  # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : Conversations persisted
- V2 (P0) : History retrieval
- V3 (P0) : Cleanup retention
- V4 (P0) : Permissions own only
- V5 (P0) : Tests 6+ scenarios

---

## Tache 7.3.5 -- Chat Widget UI Shared Package

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 7h / Depend de 7.3.4

**But** : Package shared UI chat widget reutilisable 3 apps : streaming + markdown + history.

**Livrables checkables** :
- [ ] Package `repo/packages/sky-ui/`
- [ ] Component `<SkyChatWidget>` :
  - Bottom-right fixed position (z-index high)
  - Toggle open/close
  - Hidden initially, FAB Sky icon visible
  - Locale auto from user preference
- [ ] Sub-components :
  - `<ChatHeader>` : title + locale switcher + close button
  - `<MessagesList>` : conversation history + auto-scroll
  - `<MessageBubble>` : differentiated user / assistant / tool result
  - `<MessageInput>` : textarea + send button + voice-to-text icon (Tache 7.3.10)
  - `<ToolCallDisplay>` : visualisation tool en cours d'execution + result
  - `<QuickSuggestions>` : 4-6 prompts contextuels (Sprint 31 enriches per app Tache 7.3.6-8)
- [ ] Streaming :
  - Use `@ai-sdk/react` `useChat` hook
  - Display chunks comme arrivent
  - Show "Sky reflechit..." spinner pendant tool execution
- [ ] Markdown render : `react-markdown` + code blocks + lists
- [ ] Conversation history : load past conversations + switch
- [ ] Tests Storybook

**Fichiers crees / modifies** :
```
repo/packages/sky-ui/                                                                                       # full package
repo/packages/sky-ui/src/components/sky-chat-widget.tsx                                                       # ~250 lignes
repo/packages/sky-ui/src/components/{several sub-components}.tsx                                                # ~700 lignes
repo/packages/sky-ui/src/hooks/use-sky-chat.ts                                                                  # ~150 lignes
repo/packages/sky-ui/src/styles.css                                                                              # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Widget integrable
- V2 (P0) : Streaming display
- V3 (P0) : Markdown render
- V4 (P0) : Tests Storybook 8+ scenarios

---

## Tache 7.3.6 -- Integration web-broker + I18n

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 5h / Depend de 7.3.5

**But** : Integration `<SkyChatWidget>` dans web-broker (Sprint 16) + i18n fr/ar-MA/ar/en + suggestions specifiques.

**Livrables checkables** :
- [ ] Integration : import widget dans `app/[locale]/(protected)/layout.tsx` web-broker
- [ ] Quick suggestions web-broker :
  - "Quel est le statut de la police P-2026-00123 ?"
  - "Liste mes devis en attente d'approbation"
  - "Combien de polices ai-je vendues ce mois ?"
  - "Recherche customer Mohamed Alami"
  - "Cree un devis brouillon pour customer X"
  - "Tendance sinistres dernier trimestre"
- [ ] I18n suggestions per locale (4 langues)
- [ ] RTL ar : widget positionne bottom-left au lieu bottom-right
- [ ] Tests integration

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(protected)/layout.tsx                                                        # update : add widget
repo/apps/web-broker/messages/{fr,ar-MA,ar,en}.json                                                              # update : Sky keys
repo/apps/web-broker/components/sky/quick-suggestions-broker.tsx                                                   # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Widget integre
- V2 (P0) : Quick suggestions per locale
- V3 (P0) : RTL position correct
- V4 (P0) : Tests 5+ scenarios

---

## Tache 7.3.7 -- Integration web-garage + Role-Specific Suggestions

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 5h / Depend de 7.3.6

**But** : Integration web-garage (Sprint 22) + suggestions per role garage.

**Livrables checkables** :
- [ ] Integration : import widget web-garage layout
- [ ] Quick suggestions per role :
  - **garage_admin** : "Statistiques garage ce mois" + "Configurer nouveau service" + "Liste des techniciens"
  - **garage_chef** : "Sinistres pending dispatch" + "Capacity techniciens" + "Re-assigner sinistre X"
  - **garage_technicien** : "Mes orders aujourd'hui" + "Status sinistre Y" + "Photos diagnostic recentes"
  - **garage_gestionnaire** : "Invoices a generer" + "Paiements en retard" + "Customer feedback"
- [ ] Service detection role + suggestions appropriate
- [ ] I18n
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/layout.tsx                                                          # update : add widget
repo/apps/web-garage/messages/{fr,ar-MA,ar,en}.json                                                                 # update
repo/apps/web-garage/components/sky/quick-suggestions-garage.tsx                                                       # ~150 lignes (per role)
```

**Criteres validation** :
- V1 (P0) : Widget integre 4 roles
- V2 (P0) : Suggestions per role
- V3 (P0) : Tests 5+ scenarios

---

## Tache 7.3.8 -- Integration web-customer-portal + Onboarding Adapted

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 5h / Depend de 7.3.7

**But** : Integration web-customer-portal (Sprint 17) + tone friendly + onboarding adapted assure.

**Livrables checkables** :
- [ ] Integration widget web-customer-portal
- [ ] Tone customer-friendly (less technical jargon)
- [ ] Quick suggestions :
  - "Combien coute une assurance auto pour ma voiture ?"
  - "Comment souscrire en ligne ?"
  - "Quels sont les documents requis ?"
  - "Trouvez moi un garage pres de chez moi"
  - "Statut de mon devis"
- [ ] Onboarding first-time : popup welcome "Bonjour ! Je suis Sky..." (close-able)
- [ ] Restrictions tools : seulement read tools customer-relevant + book_appointment
  - PAS access : create_quote_draft, list polices other customers, analytics, etc.
- [ ] I18n + RTL
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/[locale]/layout.tsx                                                                # update : add widget
repo/apps/web-customer-portal/messages/{fr,ar-MA,ar,en}.json                                                            # update
repo/apps/web-customer-portal/components/sky/onboarding-popup.tsx                                                        # ~120 lignes
repo/apps/web-customer-portal/components/sky/quick-suggestions-customer.tsx                                                # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Widget integre customer
- V2 (P0) : Tools whitelist customer-context
- V3 (P0) : Onboarding popup
- V4 (P0) : Tests 5+ scenarios

---

## Tache 7.3.8b -- Integration web-assure-portal + Suggestions Assure Post-Souscription

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 4h / Depend de 7.3.8

**But** : Integration `<SkyChatWidget>` dans web-assure-portal (Sprint 18 desktop) + suggestions assure context (post-souscription self-service) + tools whitelist limit.

**Contexte** : Assure connecte (web-assure-portal port 3005) different prospect (web-customer-portal). Dispose deja de polices + sinistres + paiements. Sky aide naviguer self-service : "Ou en est mon sinistre S-2026-0042 ?", "Quand est ma prochaine echeance prime ?", "Comment changer de garage agree ?". Pas integrer dans web-assure-mobile (PWA mobile-first specifique -- Phase 7+).

**Livrables checkables** :
- [ ] Integration : import widget dans `app/[locale]/(protected)/layout.tsx` web-assure-portal
- [ ] System prompt assure-context (4 locales fr/ar-MA/ar/en) :
  - "Tu es Sky, assistant assure Skalean. Tu aides l'assure connecte a suivre ses polices, sinistres, paiements, documents..."
  - Tone : empathique + simple + clair (pas jargon technique)
  - Rappels safety : "Pour declarer un nouveau sinistre, je peux te guider mais tu dois confirmer"
- [ ] Quick suggestions web-assure-portal (4 par locale) :
  - "Statut de mon sinistre en cours"
  - "Mes prochaines echeances primes"
  - "Telecharger mes documents"
  - "Comment changer mes coordonnees ?"
- [ ] Tools whitelist assure-context (read-only sur ses propres data) :
  - `get_policy_by_number` (own only -- ABAC owner_id = userId)
  - `list_my_policies`
  - `get_sinistre_by_reference` (own only)
  - `list_my_sinistres`
  - `get_invoice_by_reference` (own only)
  - `list_my_invoices`
  - `find_garages_by_location` (read-only public catalog)
  - PAS de write tools (declaration sinistre via wizard dedie Sprint 18 -- pas via chatbot)
- [ ] Onboarding popup : "Bienvenue ! Sky vous aide a gerer votre espace assure. Posez vos questions"
- [ ] Tests E2E 5+ scenarios

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/app/[locale]/(protected)/layout.tsx                              # update : add widget
repo/apps/web-assure-portal/messages/{fr,ar-MA,ar,en}.json                                    # update : Sky keys assure-context
repo/apps/web-assure-portal/components/sky/quick-suggestions-assure.tsx                       # ~120 lignes
repo/packages/sky/src/prompts/web-assure-portal-{fr,ar-MA,ar,en}.md                          # 4 prompts (ajout aux 12 existants -> 16 prompts)
repo/packages/sky/src/tools-whitelist/web-assure-portal.ts                                    # ~60 lignes (whitelist tools assure)
```

**Notes implementation** :
- Reuse pattern Tache 7.3.8 web-customer-portal (whitelist tools + onboarding popup)
- ABAC critical : tous tools doivent verifier `ctx.userId = resource.owner_id` (assure ne voit QUE ses propres data)
- Pas integrer web-assure-mobile (mobile-first UX specifique developper Phase 7+)
- Pas integrer web-insurtech-admin (super admins ont d'autres outils)

**Criteres validation** :
- V1 (P0) : Widget integre web-assure-portal layout
- V2 (P0) : Tools whitelist assure-context (read-only own resources)
- V3 (P0) : Onboarding popup
- V4 (P0) : System prompt 4 locales empathique
- V5 (P0) : ABAC verification : assure ne peut pas accéder polices/sinistres autres users
- V6 (P0) : Tests 5+ scenarios

---

## Tache 7.3.9 -- Confirmation Modals Write Tools

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 5h / Depend de 7.3.8

**But** : Modal confirmation user avant Sky execute write tools (book_appointment, create_quote_draft, send_communication).

**Livrables checkables** :
- [ ] Quand Sky propose tool write : intercepter dans agent loop -> stream event `requires_confirmation`
- [ ] Frontend display modal :
  - Title : "Sky veut executer une action"
  - Description : tool name + description + arguments
  - Visual format : "Reserver RDV avec garage Atlas le 15/05/2026 a 10h"
  - Boutons : "Confirmer" + "Annuler"
- [ ] Si confirme : send confirm event back to backend -> agent execute tool
- [ ] Si cancel : agent receives cancel + responds appropriately
- [ ] Idempotency-Key generated client-side : eviter double execution si user double-tap
- [ ] Audit : confirmation/cancellation logged
- [ ] Tests : workflow complet

**Pattern critique : confirmation flow client-server**

```typescript
// repo/packages/sky-ui/src/hooks/use-sky-chat.ts (extract)
function useSkyChat(params) {
  const [pendingConfirmation, setPendingConfirmation] = useState<ToolCallPending | null>(null);

  // SSE event handler
  const handleEvent = (event: SkyEvent) => {
    switch (event.type) {
      case 'content_delta': /* ... append content ... */ break;
      case 'requires_confirmation':
        setPendingConfirmation(event.tool_call); // Show modal
        break;
      case 'tool_result': /* ... */ break;
      case 'done': /* ... */ break;
    }
  };

  const confirmTool = async (idempotencyKey: string) => {
    setPendingConfirmation(null);
    await fetch(`/api/v1/sky/conversations/${conversationId}/confirm-tool`, {
      method: 'POST',
      body: JSON.stringify({
        tool_call_id: pendingConfirmation.id,
        confirmed: true,
        idempotency_key: idempotencyKey,
      }),
    });
  };

  const cancelTool = async () => {
    setPendingConfirmation(null);
    await fetch(`/api/v1/sky/conversations/${conversationId}/confirm-tool`, {
      method: 'POST',
      body: JSON.stringify({ tool_call_id: pendingConfirmation.id, confirmed: false }),
    });
  };

  return { messages, sendMessage, pendingConfirmation, confirmTool, cancelTool };
}
```

**Fichiers crees / modifies** :
```
repo/packages/sky-ui/src/components/confirmation-modal.tsx                                                            # ~200 lignes
repo/packages/sky-ui/src/hooks/use-sky-chat.ts                                                                          # update confirmation flow
repo/packages/sky/src/services/agent-loop.service.ts                                                                     # update : pause for confirmation
repo/apps/api/src/modules/sky/sky.controller.ts                                                                          # update : confirm-tool endpoint
```

**Criteres validation** :
- V1 (P0) : Modal display
- V2 (P0) : Confirm/Cancel flow
- V3 (P0) : Idempotency Key
- V4 (P0) : Audit logged
- V5 (P0) : Tests 6+ scenarios

---

## Tache 7.3.10 -- Voice-to-Text + Analytics Dashboard

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 6h / Depend de 7.3.9

**But** : Voice-to-text input (Web Speech API) + analytics dashboard Sky usage.

**Livrables checkables** :
- [ ] Voice-to-text :
  - Bouton micro dans `<MessageInput>` : tap to record + tap to stop
  - Web Speech API `SpeechRecognition` : languages supportes (fr-MA + ar)
  - Fallback : keyboard typing si unsupported (Safari iOS < 14.5)
  - Transcript displayed live + editable avant send
- [ ] Analytics dashboard `/ai-monitoring/sky-conversations` (super_admin) :
  - Total conversations YTD
  - Conversations per app + per locale
  - Top tools used (consume MCP audit Sprint 30)
  - Avg conversation length
  - Success rate (conversations completed without 'error' events)
  - User satisfaction : rating ask post-conversation (5 stars + optional feedback)
  - Response latency p50/p95/p99
- [ ] **ETL ClickHouse Sky analytics (Sprint 13 ETL pattern)** :
  - **Decision design** : reuse Sprint 13 ETL polling 5min Postgres (`sky_conversations` + `sky_messages` + `sky_satisfaction_ratings`) -> ClickHouse table `sky_analytics_events`
  - Tables ClickHouse cibles :
    - `sky_conversations_olap` (denormalized view conversations + computed metrics : avg_latency, total_tokens_used, total_cost_mad)
    - `sky_messages_olap` (granular events per message + tool calls)
    - `sky_satisfaction_olap` (ratings + feedback)
  - ETL job : extension Sprint 13 `etl-postgres-to-clickhouse.service.ts` -- ajouter routes :
    - `extractSkyConversations(since: Date)` -> 5min polling
    - `extractSkyMessages(since: Date)` -> 5min polling
    - `extractSkySatisfactionRatings(since: Date)` -> 5min polling
  - Materialized views ClickHouse pour pre-aggregations rapides (top tools used, success rate per app, latency percentiles)
  - Dashboard queries via ClickHouse (vs Postgres direct) -> latency 50ms vs 2s sur 1M+ messages
  - Retention ClickHouse : 90 jours raw + 1 an aggregations
- [ ] Migration : table `sky_satisfaction_ratings` (conversation_id, rating 1-5, feedback, rated_at)
- [ ] Tests : ETL polling + ClickHouse queries + dashboard render

**Fichiers crees / modifies** :
```
repo/packages/sky-ui/src/components/voice-input-button.tsx                                                                # ~150 lignes
repo/packages/database/src/migrations/{date}-SkySatisfactionRatings.ts                                                       # ~30 lignes
repo/packages/sky/src/services/sky-analytics.service.ts                                                                       # ~250 lignes
repo/apps/web-insurtech-admin/app/[locale]/(protected)/ai-monitoring/sky-conversations/page.tsx                                # ~250 lignes
```

**Criteres validation** :
- V1 (P0) : Voice-to-text fr/ar
- V2 (P0) : Fallback typing
- V3 (P0) : Analytics dashboard
- V4 (P0) : Satisfaction ratings
- V5 (P0) : Tests 6+ scenarios

---

## Tache 7.3.11 -- Documentation + Onboarding Users + Best Prompts

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 4h / Depend de 7.3.10

**But** : Documentation Sky + onboarding guide users + catalog best prompts.

**Livrables checkables** :
- [ ] Documents :
  - `repo/docs/sky-architecture.md` (technique)
  - `repo/docs/sky-user-guide-broker.md` (broker focus)
  - `repo/docs/sky-user-guide-garage.md` (garage roles focus)
  - `repo/docs/sky-user-guide-customer.md` (assure simple)
  - `repo/docs/sky-best-prompts-catalog.md` (50+ prompts examples 4 langues)

**Fichiers crees / modifies** :
```
repo/docs/sky-architecture.md                                                                                                 # ~250 lignes
repo/docs/sky-user-guide-{broker,garage,customer}.md                                                                            # 3 docs ~400 lignes total
repo/docs/sky-best-prompts-catalog.md                                                                                            # ~300 lignes (50+ prompts)
```

**Criteres validation** :
- V1 (P0) : 5 documents complets
- V2 (P0) : Prompts catalog 4 langues
- V3 (P0) : User-friendly guides

---

## Tache 7.3.12 -- Tests E2E + WCAG + Lighthouse

**Metadonnees** : Phase 7 / Sprint 31 / P0 / 9h / Depend de 7.3.11

**But** : Suite tests E2E + WCAG + Lighthouse pour 3 apps integrations.

**Livrables checkables** :

**Tests E2E (15+)** :
- [ ] Sky widget integre 3 apps (3)
- [ ] Streaming response display (1)
- [ ] Tool calling read flow (3 tools tested) (3)
- [ ] Confirmation modal write tool (2)
- [ ] Voice-to-text input (1)
- [ ] Conversation history retrieve (1)
- [ ] I18n 4 langues (2)
- [ ] RTL display ar (1)
- [ ] Restrictions customer (no admin tools) (1)

**WCAG 2.1 AA** :
- [ ] axe-core integrated 3 apps
- [ ] Keyboard nav complete
- [ ] Screen reader announcements

**Lighthouse** :
- [ ] Perf > 90 / Access > 90 / Best Practices > 95

**Fichiers crees / modifies** :
```
repo/apps/web-broker/e2e/sky/{several specs}.spec.ts
repo/apps/web-garage/e2e/sky/{several specs}.spec.ts
repo/apps/web-customer-portal/e2e/sky/{several specs}.spec.ts
```

**Criteres validation** :
- V1 (P0) : 15+ tests passent 3 apps
- V2 (P0) : WCAG AA
- V3 (P0) : Lighthouse green
- V4 (P0) : CI green
- V5 (P0) : Reproducibility 5x

---

## Sortie du Sprint 31

A la fin de l'execution des 12 taches :

```
Agent Sky Multilingue operational :
  - Sky chatbot integre 3 apps (web-broker / web-garage / web-customer-portal)
  - 4 langues : fr / ar-MA (darija) / ar (classique) / en
  - MCP client consume Sprint 30 tools (15 tools available)
  - Skalean AI conversational backend integration
  - Agent loop : tool selection + execution + safety checks (max 5 iter + 60s timeout)
  - System prompts adaptes per app + per locale (12 prompts)
  - Conversation history persisted + retention 30 jours
  - Confirmation modals write tools + idempotency
  - Voice-to-text fr/ar + fallback typing
  - Analytics dashboard : conversations + tools usage + satisfaction ratings
  - Onboarding popup customer first-time
  - Quick suggestions per app + per role
  - 5 documents : architecture + 3 user guides + best prompts catalog 50+ examples
  - 15+ tests E2E + WCAG + Lighthouse green
```

**Sprint 32 deja livre Phase 5/Phase 7 transition** (decision-010 : Insure Connecteurs).

**Sprint 33 (Pentest Securite) demarre avec** :
- Plateforme complete : 8 apps + Sky AI + MCP server + cross-tenant + compliance MA
- Sprint 33 : audit securite externe + corrections vulnerabilities

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-7.3.X-*.md` dans `00-pilotage/prompts-taches/sprint-31-agent-sky/`.

**Patterns code inline conserves** : Sky orchestrator avec tool calling loop streaming + max iterations safety, confirmation flow client-server avec Idempotency-Key.

**Reference** : Sprint 30 MCP server + Sprint 29 Skalean AI REST integration patterns.

---

**Fin du meta-prompt B-31 v2.2 format Option B.**
