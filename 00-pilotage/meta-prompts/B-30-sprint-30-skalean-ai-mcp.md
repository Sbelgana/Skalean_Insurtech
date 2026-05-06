# META-PROMPT B-30 -- SPRINT 30 SKALEAN AI MCP SERVER

**Version** : v2.2 (Option B)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 30 / 35 (cumul) -- Phase 7 Sprint 2
**Position** : Apres Skalean AI REST Integration, avant Agent Sky multilingue
**Numerotation taches** : 7.2.1 a 7.2.12
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (MCP server expose data InsurTech a Skalean AI agents -- prerequis Sprint 31 Sky)

---

## Objectif Global du Sprint

Implementer **MCP server Skalean InsurTech** : expose data plateforme a Skalean AI via Model Context Protocol standard. Inverse de Sprint 29 (Skalean InsurTech CALL Skalean AI) : Sprint 30 = Skalean AI CALL Skalean InsurTech via tools MCP standardises.

**Cas d'usage type** : courtier discute avec Agent Sky (Sprint 31) et demande "Quel est le statut de la police P-2026-00123 ?" -> Sky appelle MCP tool `get_policy_by_number` expose par Skalean InsurTech -> recupere data -> formule reponse multilingue. Sprint 30 livre **infrastructure tools** ; Sprint 31 livre **client agent multilingue** consumant.

A la sortie de ce sprint :
- MCP server Skalean InsurTech operational (port 4001 dedicated)
- 15+ tools MCP exposes : policies + sinistres + customers + garages + invoices + analytics + actions
- Authentification MCP server tokens (separate JWT lifecycle)
- Tools registry + discovery automatic
- Tenant context propagation (Skalean AI agent acts on behalf user with tenant scope)
- Streaming responses pour large datasets
- Audit complet : qui a appele quel tool quand
- Documentation OpenAPI-style pour MCP tools (descriptions + schemas)
- Tests integration MCP client + server
- Pattern reutilisable Sprint 31 Agent Sky comme MCP client

---

## Frontiere du Sprint

**INCLUS** :
- MCP server SDK integration
- 15+ tools metier exposes (read + write controlle)
- Auth MCP tokens + permissions per tool
- Tenant context propagation
- Tools registry + discovery
- Streaming responses
- Audit + Kafka events
- Tests integration

**EXCLU** (sera ajoute aux sprints suivants) :
- Agent Sky client multilingue (consume MCP) -- Sprint 31
- IA-powered agentic workflows complex -- Sprint 31+
- MCP federation multi-servers -- Phase 7+
- Tools custom per tenant (config UI) -- Phase 7+

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 29 : Skalean AI REST integration pattern (auth + headers)
2. Documentation MCP standard : https://modelcontextprotocol.io
3. Sortie Sprint 7 : RBAC permissions catalog
4. Sortie Sprint 14, 19, 21 : entities Insure + Repair (data exposes)

---

## Stack Imposee (Sprint 30)

| Composant | Version | Notes |
|-----------|---------|-------|
| @modelcontextprotocol/sdk | latest | MCP server SDK |
| zod | 3.24.1 | tools schemas validation |
| undici | 7.1.1 | HTTP server (separate port 4001) |
| jose | 6.x | JWT MCP tokens |

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 7.2.1 | MCP server foundation : SDK setup + transport HTTP + bootstrap port 4001 | 6h | P0 | Sprint 29 |
| 7.2.2 | Auth MCP tokens : JWT separate lifecycle + scopes per tool + KMS rotation | 6h | P0 | 7.2.1 |
| 7.2.3 | Tenant context propagation : x-tenant-id + sub-user impersonation | 5h | P0 | 7.2.2 |
| 7.2.4 | Tools registry + discovery : metadata + JSON Schema + versioning | 5h | P0 | 7.2.3 |
| 7.2.5 | Tools read Insure (5) : get_policy + list_policies + get_quote + lookup_customer + get_invoice | 7h | P0 | 7.2.4 |
| 7.2.6 | Tools read Repair (5) : get_sinistre + list_sinistres + get_diagnostic + get_garage + get_warranty | 7h | P0 | 7.2.5 |
| 7.2.7 | Tools write controlle (3) : create_quote + book_appointment + send_communication (audit + idempotency) | 6h | P0 | 7.2.6 |
| 7.2.8 | Tools analytics (2) : query_kpis + search_anomalies | 5h | P0 | 7.2.7 |
| 7.2.9 | Streaming responses : large datasets + cursor pagination + abort handling | 5h | P0 | 7.2.8 |
| 7.2.10 | Audit + rate limiting + monitoring tools usage | 5h | P0 | 7.2.9 |
| 7.2.11 | Documentation OpenAPI-style + onboarding Sky team | 4h | P0 | 7.2.10 |
| 7.2.12 | Tests integration MCP client + server (15+) | 9h | P0 | 7.2.11 |

**Total** : 70 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 7.2.1 -- MCP Server Foundation

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 6h / Depend de Sprint 29

**But** : Bootstrap MCP server Skalean InsurTech : SDK MCP + transport HTTP + port 4001 dedicated.

**Livrables checkables** :
- [ ] App `repo/apps/mcp-server/` (Nest microservice OR standalone Node)
- [ ] Setup `@modelcontextprotocol/sdk` server
- [ ] Transport HTTP (vs stdio) pour reuse infrastructure (load balancer, monitoring)
- [ ] Port 4001 dedicated (separate de api 4000)
- [ ] Endpoint discovery : `GET /mcp/v1/discover` retourne capabilities + tools list
- [ ] Endpoint tool call : `POST /mcp/v1/tools/{tool_name}/call`
- [ ] Health check : `GET /mcp/v1/health`
- [ ] Tests setup + smoke test discovery

**Pattern critique : MCP server bootstrap**

```typescript
// repo/apps/mcp-server/src/main.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { HttpServerTransport } from '@modelcontextprotocol/sdk/server/http.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  {
    name: 'skalean-insurtech-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools (discovery)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: await toolsRegistry.getAllToolsMetadata(),
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const tool = await toolsRegistry.getTool(name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }

  // Authentification + tenant context already verified by HTTP middleware
  // Execute tool
  const result = await tool.execute(args, getCurrentRequestContext());
  return {
    content: [
      { type: 'text', text: JSON.stringify(result) },
    ],
  };
});

const transport = new HttpServerTransport({
  port: 4001,
  authMiddleware: mcpAuthMiddleware,
  tenantContextMiddleware: mcpTenantContextMiddleware,
});

await server.connect(transport);
console.log('MCP Server Skalean InsurTech listening port 4001');
```

**Fichiers crees / modifies** :
```
repo/apps/mcp-server/                                                                # full app
repo/apps/mcp-server/src/main.ts                                                       # ~150 lignes
repo/apps/mcp-server/src/server.module.ts                                                # ~80 lignes
repo/apps/mcp-server/src/transport/http-transport.ts                                       # ~150 lignes
repo/apps/mcp-server/Dockerfile
repo/apps/mcp-server/package.json
```

**Notes implementation** :
- Port 4001 separate api 4000 : isolation network + ressources
- Transport HTTP (non stdio) : permits scaling horizontal + load balancing
- Logs tous calls MCP separes audit_log table
- Health check : verify DB connection + readiness Sprint 1

**Criteres validation** :
- V1 (P0) : Server demarre port 4001
- V2 (P0) : Discovery endpoint
- V3 (P0) : Tool call endpoint structure
- V4 (P0) : Health check
- V5 (P0) : Tests 5+ scenarios

---

## Tache 7.2.2 -- Auth MCP Tokens

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 6h / Depend de 7.2.1

**But** : Auth strategy MCP server : JWT tokens separate lifecycle (Sky agent tokens) + scopes per tool + KMS rotation.

**Livrables checkables** :
- [ ] Migration : table `mcp_client_credentials` :
  - id, client_id (unique), client_name (e.g. 'agent-sky'), scopes (jsonb : array tool names autorises), api_key_hash, status (enum 'active' | 'revoked'), created_by, created_at, last_used_at
- [ ] Service `mcp-auth.service.ts` :
  - `issueToken(clientId, userContext)` : JWT validity 1h avec claims (client_id, user_id, tenant_id, scopes)
  - `verifyToken(token)` : verify signature + check scopes
  - `revokeClient(clientId)` : invalidate
- [ ] Endpoint `POST /mcp/v1/auth/token` : exchange client_id + api_key + user JWT -> MCP token
- [ ] Middleware HTTP : verify MCP token avant tool call
- [ ] Scopes per tool : decorator `@RequiresScope('mcp.tools.policies.read')`
- [ ] KMS rotation : api_key client rotateable
- [ ] Tests auth scenarios

**Pattern critique : MCP auth + scopes**

```typescript
// repo/apps/mcp-server/src/auth/mcp-auth.middleware.ts
export async function mcpAuthMiddleware(req: Request): Promise<McpRequestContext> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError({ code: 'MCP_TOKEN_MISSING' });
  }

  const token = authHeader.substring(7);
  const decoded = await verifyJwt(token);

  // Verify client active
  const client = await mcpClientService.findById(decoded.client_id);
  if (!client || client.status !== 'active') {
    throw new UnauthorizedError({ code: 'MCP_CLIENT_REVOKED' });
  }

  // Verify scopes for requested tool (if specific tool)
  const requestedTool = req.body?.params?.name;
  if (requestedTool) {
    const requiredScope = getRequiredScopeForTool(requestedTool);
    if (!decoded.scopes.includes(requiredScope)) {
      throw new ForbiddenError({ code: 'MCP_INSUFFICIENT_SCOPE', required: requiredScope });
    }
  }

  // Update last_used_at async
  mcpClientService.touchLastUsed(decoded.client_id).catch(() => {});

  return {
    client_id: decoded.client_id,
    user_id: decoded.user_id,
    tenant_id: decoded.tenant_id,
    scopes: decoded.scopes,
  };
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-McpClientCredentials.ts                       # ~50 lignes
repo/packages/auth/src/services/mcp-auth.service.ts                                          # ~250 lignes
repo/apps/mcp-server/src/auth/mcp-auth.middleware.ts                                          # ~150 lignes
repo/apps/mcp-server/src/auth/scope-mapping.ts                                                  # ~80 lignes (tool -> scope mapping)
repo/apps/api/src/modules/admin/controllers/mcp-clients.controller.ts                          # ~120 lignes (admin manage)
```

**Notes implementation** :
- JWT separate API tokens lifecycle 1h max (vs API 4h Sprint 26)
- Scopes per tool granulaire : Sky peut avoir scope partial (e.g. read only)
- KMS rotation : revoke compromised client immediately
- Audit complete chaque auth attempt + tool call

**Criteres validation** :
- V1 (P0) : MCP token issuance
- V2 (P0) : Scopes verification
- V3 (P0) : Client revocation
- V4 (P0) : Tests 8+ scenarios

---

## Tache 7.2.3 -- Tenant Context Propagation

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 5h / Depend de 7.2.2

**But** : Propagation context tenant + user (Sky agent agit pour user dans tenant donne). MCP tools respect RLS multi-tenant + capabilities tenant Sprint 25 (Type 2/3 tenants).

**Livrables checkables** :
- [ ] Middleware `mcpTenantContextMiddleware` :
  - Read tenant_id + user_id from MCP token claims
  - Set TenantContext (Sprint 6) pour requete
  - Apply RLS comme si user normal API
- [ ] **Capabilities check tenant (Sprint 25 integration)** :
  - Avant execute tool : verifier `tenant.capabilities` includes capability requise
  - Tool registry definit : `tool.required_capabilities: ['repair.sinistres.read', 'insure.policies.read', etc.]`
  - CapabilitiesGuard middleware (port from Sprint 25) -- reuse meme logique :
    1. Get tenant_subtype from `auth_tenants` (atlas / managed_partner / api_partner)
    2. Lookup CAPABILITIES_MATRIX_REPAIR + CAPABILITIES_MATRIX_INSURE
    3. Verify intersection : tool.required_capabilities subset tenant capabilities
    4. Si Type 3 api_partner essaie call tool requiring `repair.diagnostics.read` -> 403 Forbidden
  - Reject with structured error : `{ error: 'tool_not_authorized_for_tenant_type', tenant_subtype: 'api_partner', required_capabilities: ['repair.diagnostics.read'] }`
- [ ] Audit log enrichi : `via_mcp` flag + `mcp_client_id` field + `capabilities_check_passed: bool`
- [ ] Endpoint exchange : `POST /mcp/v1/auth/exchange` :
  - User connecte web-broker (Sprint 16) initie chat avec Sky
  - Frontend genere demande exchange : MCP token avec user_id + tenant_id + scopes selon role
  - Token MCP retourne valide 1h + tenant_subtype injected dans claims
- [ ] Sky agent (Sprint 31) utilise ce token pour appeler tools MCP au nom user
- [ ] Tests : isolation respect + audit complete + capabilities check 8+ scenarios (Atlas full access / managed_partner restricted / api_partner minimal)

**Fichiers crees / modifies** :
```
repo/apps/mcp-server/src/auth/mcp-tenant-context.middleware.ts                                 # ~150 lignes
repo/packages/auth/src/services/mcp-token-exchange.service.ts                                    # ~200 lignes
repo/apps/api/src/modules/auth/controllers/mcp-token-exchange.controller.ts                       # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Tenant context set correctly
- V2 (P0) : RLS isolation respect
- V3 (P0) : Audit via_mcp flag
- V4 (P0) : Tests isolation 6+ scenarios

---

## Tache 7.2.4 -- Tools Registry + Discovery

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 5h / Depend de 7.2.3

**But** : Registry centralise tools + metadata + JSON Schema input/output + versioning + discovery automatic.

**Livrables checkables** :
- [ ] Service `tools-registry.service.ts` :
  - `registerTool(tool: McpTool)` : add to registry
  - `getAllToolsMetadata()` : return discovery list
  - `getTool(name)` : retrieve tool implementation
- [ ] Interface `McpTool` :
  - `name` (e.g. `get_policy_by_number`)
  - `description` (used by Sky agent for tool selection)
  - `input_schema` (Zod -> JSON Schema)
  - `output_schema` (Zod)
  - `required_scope` (e.g. `mcp.tools.policies.read`)
  - `version` (e.g. `1.0.0`)
  - `execute(args, context)` : Promise<output>
- [ ] Versioning : tools peuvent etre `@deprecated` (Sky agent prefer non-deprecated)
- [ ] Discovery output structured pour Sky comprehension (descriptions clear)
- [ ] Tests registry

**Pattern critique : tool registration**

```typescript
// repo/apps/mcp-server/src/tools/tools-registry.service.ts
export interface McpTool<TInput, TOutput> {
  name: string;
  description: string;
  input_schema: z.ZodType<TInput>;
  output_schema: z.ZodType<TOutput>;
  required_scope: string;
  version: string;
  deprecated?: boolean;
  execute(args: TInput, context: McpRequestContext): Promise<TOutput>;
}

@Injectable()
export class ToolsRegistry {
  private tools = new Map<string, McpTool<any, any>>();

  registerTool<TI, TO>(tool: McpTool<TI, TO>): void {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): McpTool<any, any> | undefined {
    return this.tools.get(name);
  }

  getAllToolsMetadata() {
    return Array.from(this.tools.values())
      .filter(t => !t.deprecated)
      .map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: zodToJsonSchema(t.input_schema),
        version: t.version,
      }));
  }
}

// Example registration
const getPolicyByNumberTool: McpTool<{ policy_number: string }, PolicyOutput> = {
  name: 'get_policy_by_number',
  description: 'Retrieve insurance policy details by policy number. Returns customer info, garanties, premium, status. Use when user asks about a specific policy.',
  input_schema: z.object({
    policy_number: z.string().min(1, 'Policy number required'),
  }),
  output_schema: PolicyOutputSchema,
  required_scope: 'mcp.tools.policies.read',
  version: '1.0.0',
  execute: async (args, context) => {
    return await policiesService.findByNumber(args.policy_number);
  },
};
```

**Fichiers crees / modifies** :
```
repo/apps/mcp-server/src/tools/tools-registry.service.ts                                       # ~200 lignes
repo/apps/mcp-server/src/tools/types.ts                                                          # ~80 lignes
repo/apps/mcp-server/src/tools/tools-discovery.controller.ts                                       # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Registry CRUD
- V2 (P0) : Metadata discovery
- V3 (P0) : JSON Schema generated
- V4 (P0) : Versioning + deprecated
- V5 (P0) : Tests 6+ scenarios

---

## Tache 7.2.5 -- Tools Read Insure (5)

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 7h / Depend de 7.2.4

**But** : Implementer 5 tools read Insure : `get_policy_by_number` + `list_policies` + `get_quote_by_number` + `lookup_customer` + `get_invoice_by_number`.

**Livrables checkables** :
- [ ] **`get_policy_by_number`** :
  - Input : `{ policy_number: string }`
  - Output : full policy details (customer + branche + garanties + status + dates)
  - Scope : `mcp.tools.policies.read`
- [ ] **`list_policies`** :
  - Input : `{ customer_id?, branche?, status?, page?, page_size? }`
  - Output : paginated policies
  - Scope : `mcp.tools.policies.read`
- [ ] **`get_quote_by_number`** :
  - Input : `{ quote_number: string }`
  - Output : quote details + items + totals + status
  - Scope : `mcp.tools.quotes.read`
- [ ] **`lookup_customer`** :
  - Input : `{ search_query: string }` (name + email + CIN + phone)
  - Output : customers matching (max 10, fuzzy match)
  - Scope : `mcp.tools.customers.read`
- [ ] **`get_invoice_by_number`** :
  - Input : `{ invoice_number: string }`
  - Output : invoice details + payment status
  - Scope : `mcp.tools.invoices.read`
- [ ] Each tool : registry + Zod schemas + execute via existing services
- [ ] Tests per tool

**Fichiers crees / modifies** :
```
repo/apps/mcp-server/src/tools/insure/{5 tools}.ts                                                 # ~600 lignes total
repo/apps/mcp-server/src/tools/insure/index.ts                                                       # registration
repo/apps/mcp-server/src/tools/insure/tests/{5 specs}.spec.ts                                          # tests
```

**Criteres validation** :
- V1 (P0) : 5 tools registered
- V2 (P0) : Schemas valides
- V3 (P0) : Permissions respectees
- V4 (P0) : Tests 10+ scenarios

---

## Tache 7.2.6 -- Tools Read Repair (5)

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 7h / Depend de 7.2.5

**But** : Implementer 5 tools read Repair : `get_sinistre_by_number` + `list_sinistres` + `get_diagnostic` + `get_garage` + `get_warranty`.

**Livrables checkables** :
- [ ] **`get_sinistre_by_number`** :
  - Input : `{ sinistre_number: string }`
  - Output : full sinistre + status + cycle phase + parties + ETA
  - Scope : `mcp.tools.sinistres.read`
- [ ] **`list_sinistres`** :
  - Input : `{ status?, customer_id?, garage_id?, branche?, page?, page_size? }`
  - Scope : `mcp.tools.sinistres.read`
- [ ] **`get_diagnostic`** :
  - Input : `{ sinistre_id: string }`
  - Output : diagnostic + IA suggestions + technicien validation + photos URLs
  - Scope : `mcp.tools.diagnostics.read`
- [ ] **`get_garage`** :
  - Input : `{ garage_id?: string, lat?, lng?, max_distance_km? }` (search by ID OR proximity)
  - Output : garage info + capacity + ratings + services
  - Scope : `mcp.tools.garages.read`
- [ ] **`get_warranty`** :
  - Input : `{ warranty_id?: string, sinistre_id?: string }`
  - Output : warranty + claims + expiration
  - Scope : `mcp.tools.warranties.read`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/mcp-server/src/tools/repair/{5 tools}.ts                                                 # ~600 lignes total
repo/apps/mcp-server/src/tools/repair/index.ts                                                       # registration
```

**Criteres validation** :
- V1 (P0) : 5 tools registered
- V2 (P0) : Tests 10+ scenarios

---

## Tache 7.2.7 -- Tools Write Controlle (3)

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 6h / Depend de 7.2.6

**But** : 3 tools WRITE strictly audited + idempotency + scope strict : `create_quote_draft` + `book_appointment` + `send_communication`.

**Livrables checkables** :
- [ ] **`create_quote_draft`** :
  - Input : `{ customer_id, branche, garanties[], coverage_amount }`
  - Output : created draft quote (status='draft' -- requires manual broker review before send)
  - Scope : `mcp.tools.quotes.write_draft`
  - Idempotency-Key obligatoire (eviter double creation si Sky retry)
- [ ] **`book_appointment`** :
  - Input : `{ customer_id, type, datetime, garage_id?, broker_id? }`
  - Output : booking + confirmation
  - Scope : `mcp.tools.appointments.write`
- [ ] **`send_communication`** :
  - Input : `{ to_user_id, template, channel, variables }`
  - Output : communication queued (consume Sprint 9 Comm orchestrator)
  - Scope : `mcp.tools.communications.send`
  - Restrictions : only templates whitelisted (eviter Sky envoie spam)
- [ ] Audit complet : Sky a appele tool + qui a benefice + impact business
- [ ] Confirmation user requise pour write tools (Sky propose -> user valide via UI Sprint 31)
- [ ] Tests

**Pattern critique : write tool with idempotency**

```typescript
// repo/apps/mcp-server/src/tools/repair/book-appointment.tool.ts
const bookAppointmentTool: McpTool<BookAppointmentInput, BookAppointmentOutput> = {
  name: 'book_appointment',
  description: 'Schedule an appointment for customer with broker or garage. Confirms via email/WhatsApp.',
  input_schema: z.object({
    customer_id: z.string().uuid(),
    appointment_type: z.enum(['consultation', 'reception_garage', 'expertise']),
    datetime_iso: z.string().datetime(),
    garage_id: z.string().uuid().optional(),
    broker_id: z.string().uuid().optional(),
    notes: z.string().max(500).optional(),
  }),
  output_schema: BookAppointmentOutputSchema,
  required_scope: 'mcp.tools.appointments.write',
  version: '1.0.0',
  execute: async (args, context) => {
    const idempotencyKey = context.headers['idempotency-key'];
    if (!idempotencyKey) {
      throw new BadRequestError({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Write tools require Idempotency-Key header' });
    }

    // Check idempotency cache
    const existing = await idempotencyCache.lookup(`book_appointment:${idempotencyKey}`);
    if (existing) return existing;

    // Audit BEFORE execute (track intent)
    await auditService.log({
      action: 'mcp.tool.book_appointment.start',
      via_mcp: true,
      mcp_client_id: context.client_id,
      executed_by: context.user_id,
      tenant_id: context.tenant_id,
      input: args,
      idempotency_key: idempotencyKey,
    });

    // Execute via Sprint 8 booking service
    const appointment = await bookingService.create({
      customer_id: args.customer_id,
      type: args.appointment_type,
      datetime: new Date(args.datetime_iso),
      garage_id: args.garage_id,
      broker_id: args.broker_id,
      notes: args.notes,
      created_via: 'mcp_agent',
    });

    const output = {
      appointment_id: appointment.id,
      confirmation_number: appointment.confirmation_number,
      datetime: appointment.datetime,
      participants: appointment.participants,
    };

    // Cache idempotency 24h
    await idempotencyCache.set(`book_appointment:${idempotencyKey}`, output, 86400);

    return output;
  },
};
```

**Fichiers crees / modifies** :
```
repo/apps/mcp-server/src/tools/write/{3 tools}.ts                                                  # ~600 lignes total
repo/apps/mcp-server/src/services/idempotency-cache.service.ts                                       # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : 3 write tools
- V2 (P0) : Idempotency obligatoire
- V3 (P0) : Audit BEFORE execute
- V4 (P0) : Templates whitelist comm
- V5 (P0) : Tests 10+ scenarios

---

## Tache 7.2.8 -- Tools Analytics (2)

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 5h / Depend de 7.2.7

**But** : 2 tools analytics : `query_kpis` + `search_anomalies` -- consume ETL ClickHouse Sprint 13.

**Livrables checkables** :
- [ ] **`query_kpis`** :
  - Input : `{ metric_name, period, filters?, aggregation? }`
  - Output : data point + trend (vs previous period)
  - Examples : `revenue_ytd`, `sinistres_count_per_branche`, `customer_acquisition_rate`
  - Scope : `mcp.tools.analytics.read`
- [ ] **`search_anomalies`** :
  - Input : `{ entity_type, time_window_days }` (entities : sinistres / payments / policies)
  - Output : anomalies detected statistical (outliers > 2 sigmas) + investigations suggestions
  - Scope : `mcp.tools.analytics.advanced`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/mcp-server/src/tools/analytics/{2 tools}.ts                                                # ~400 lignes total
```

**Criteres validation** :
- V1 (P0) : 2 tools registered
- V2 (P0) : Tests 6+ scenarios

---

## Tache 7.2.9 -- Streaming Responses

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 5h / Depend de 7.2.8

**But** : Streaming responses pour large datasets (e.g. liste 1000 polices) + cursor pagination + abort handling.

**Livrables checkables** :
- [ ] Update tools `list_*` : support streaming via Server-Sent Events
- [ ] Cursor pagination : `next_cursor` + `has_more`
- [ ] Abort handling : si Sky abort request, server stop processing
- [ ] Memory efficient : chunks 100 items max per stream message
- [ ] Tests streaming + abort

**Fichiers crees / modifies** :
```
repo/apps/mcp-server/src/streaming/sse-streaming.service.ts                                            # ~200 lignes
repo/apps/mcp-server/src/tools/insure/list-policies.tool.ts                                              # update streaming
```

**Criteres validation** :
- V1 (P0) : Streaming SSE
- V2 (P0) : Cursor pagination
- V3 (P0) : Abort handling
- V4 (P0) : Tests 5+ scenarios

---

## Tache 7.2.10 -- Audit + Rate Limiting + Monitoring

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 5h / Depend de 7.2.9

**But** : Audit complet tools usage + rate limiting per client + monitoring dashboard.

**Livrables checkables** :
- [ ] Migration : table `mcp_tool_calls_log` :
  - id, mcp_client_id, user_id, tenant_id, tool_name, input (jsonb redacted), output_summary (jsonb), latency_ms, status (success/failed/timeout), called_at
- [ ] Service `mcp-tool-calls-logger.service.ts`
- [ ] Rate limiting per client :
  - Default : 100 calls/min, 10000 calls/jour
  - Configurable per client
  - 429 retry-after si exceeded
- [ ] Kafka events : `mcp.tool.called`
- [ ] ETL ClickHouse : sync logs -> dashboard analytics
- [ ] Dashboard admin : `/ai-monitoring/mcp-server` :
  - Top tools called
  - Top clients
  - Errors rate per tool
  - Latency p95 per tool
  - Real-time stream calls last 5min
- [ ] Tests rate limit + audit

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-McpToolCallsLog.ts                                        # ~50 lignes
repo/apps/mcp-server/src/services/mcp-tool-calls-logger.service.ts                                       # ~200 lignes
repo/apps/mcp-server/src/middleware/rate-limit.middleware.ts                                              # ~150 lignes
repo/apps/web-insurtech-admin/app/[locale]/(protected)/ai-monitoring/mcp-server/page.tsx                   # ~250 lignes
```

**Criteres validation** :
- V1 (P0) : Audit complete logs
- V2 (P0) : Rate limit per client
- V3 (P0) : Dashboard admin
- V4 (P0) : Tests 8+ scenarios

---

## Tache 7.2.11 -- Documentation OpenAPI-Style + Onboarding

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 4h / Depend de 7.2.10

**But** : Documentation tools complete (OpenAPI-style) + onboarding guide Sky team Sprint 31.

**Livrables checkables** :
- [ ] Documents :
  - `repo/docs/mcp-server-architecture.md`
  - `repo/docs/mcp-tools-catalog.md` (15 tools described avec exemples)
  - `repo/docs/mcp-onboarding-sky-team.md` (Sprint 31 prep)
- [ ] OpenAPI-style spec : auto-generated from registry + Zod schemas
- [ ] Examples per tool : input + expected output
- [ ] Best practices Sky usage : tools selection + idempotency + error handling

**Fichiers crees / modifies** :
```
repo/docs/mcp-server-architecture.md                                                                    # ~250 lignes
repo/docs/mcp-tools-catalog.md                                                                            # ~400 lignes
repo/docs/mcp-onboarding-sky-team.md                                                                       # ~200 lignes
repo/infrastructure/scripts/generate-mcp-openapi-spec.ts                                                    # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : 3 documents complets
- V2 (P0) : OpenAPI auto-generated
- V3 (P0) : Sprint 31 ready

---

## Tache 7.2.12 -- Tests Integration MCP Client + Server

**Metadonnees** : Phase 7 / Sprint 30 / P0 / 9h / Depend de 7.2.11

**But** : Suite tests integration MCP client (mock Sky agent) + server + scenarios end-to-end.

**Livrables checkables** :

**Tests integration (15+)** :
- [ ] Auth + scopes (3)
- [ ] Tenant context isolation (2)
- [ ] Tools read Insure 5 tools (3)
- [ ] Tools read Repair 5 tools (3)
- [ ] Tools write controlle 3 tools + idempotency (3)
- [ ] Streaming + cursor pagination (1)

**Fichiers crees / modifies** :
```
repo/apps/mcp-server/test/{15+ specs}.spec.ts
repo/apps/mcp-server/test/mock-mcp-client.ts                                                               # ~200 lignes (mock Sky)
```

**Criteres validation** :
- V1 (P0) : 15+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Reproducibility 5x

---

## Sortie du Sprint 30

A la fin de l'execution des 12 taches :

```
Skalean AI MCP Server operational :
  - MCP server SDK + transport HTTP port 4001
  - Auth MCP tokens + scopes per tool + KMS rotation
  - Tenant context propagation + RLS isolation respect
  - Tools registry + discovery + JSON Schema + versioning
  - 15 tools exposes :
    - 5 read Insure : policies + quotes + customers + invoices + lookup
    - 5 read Repair : sinistres + diagnostics + garages + warranties
    - 3 write controlle : create_quote_draft + book_appointment + send_communication (idempotency)
    - 2 analytics : query_kpis + search_anomalies
  - Streaming SSE + cursor pagination + abort handling
  - Audit complete + rate limiting per client + dashboard admin
  - Documentation OpenAPI-style + onboarding Sky team

15+ tests integration green

INFRASTRUCTURE TOOLS PRETE -- Sprint 31 Agent Sky multilingue consume
```

**Sprint 31 (Agent Sky multilingue) demarre avec** :
- MCP server complete
- 15 tools available pour Sky
- Sprint 31 : Sky chatbot multilingue (fr/ar-MA/ar/en) + UI integration web-broker / web-garage / web-customer-portal

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-7.2.X-*.md` dans `00-pilotage/prompts-taches/sprint-30-skalean-ai-mcp/`.

**Patterns code inline conserves** : MCP server bootstrap + handlers, MCP auth middleware avec scopes verification, tool registration interface + Zod schemas, write tool avec idempotency obligatoire + audit BEFORE execute.

**Reference** : Sprint 29 Skalean AI REST + Sprint 14/19 entities + Sprint 7 RBAC.

---

**Fin du meta-prompt B-30 v2.2 format Option B.**
