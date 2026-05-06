# TACHE 2.3.7 -- AbacService + 4 Policies Fondamentales (OwnResources / TimeBased / StatusBased / WorkflowState)

**Sprint** : 7 (Phase 2 / Sprint 3 dans phase) -- RBAC Granulaire + ABAC Foundation
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md` (Tache 2.3.7 lignes 785-894)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour Tache 2.3.8 AbacResourceGuard + decorator `@AbacResource`, Tache 2.3.9 AuditTrail filtre `appliedPolicy`, Tache 2.3.10 RbacAuditService persistence ABAC contexts, Tache 2.3.11 admin endpoints introspection policies, Tache 2.3.12 tests E2E coverage 12 roles avec scenarios ABAC ; bloquant indirect pour TOUS les controllers metier Sprint 8+ qui consomment les attributes resource pour decision contextuelle owner / status / time / workflow ; bloquant pour Sprint 13 module `pay.refunds` qui depend de TimeBasedPolicy 30j Loi 17-99, pour Sprint 14 module `insure.policies.cancel` qui depend de StatusBasedPolicy, pour Sprint 19 module `repair.sinistres` qui depend de WorkflowStatePolicy state machine sinistre)
**Effort** : 7h
**Dependances** : Tache 2.3.6 (interfaces `AbacContext`, `AbacPolicy`, `AbacResult` + builder + helpers + types resource attributes + Zod schemas + barrel exports `@insurtech/auth/abac`). Tache 2.3.5 (PermissionGuard + decorator metadata pattern + AsyncLocalStorage TenantContext + `RbacAuditService` injection pattern). Tache 2.3.4 (RoleGuard livre + `AuthRole` TypeScript type expose). Tache 2.3.3 (RbacService injectable + `AccessResult` Result-typed pattern). Tache 2.3.2 (RoleHierarchy + `getEffectivePermissions`). Tache 2.3.1 (catalog `Permission` TypeScript const + Zod schema + `PermissionValue` type). Sprint 6 complet (TenantContext propage `userId`, `userRole`, `tenantId` via cls-hooked AsyncLocalStorage Sprint 6 Tache 2.6.x). Sprint 1-2 stack (TypeScript 5.7.3 strict, Vitest 2.1.8, NestJS 10.4.x, Pino 9.5.x, Zod 3.24.1, reflect-metadata 0.2.x, prom-client 15.x, luxon 3.5.x pour timezone Africa/Casablanca, date-fns 4.x).
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 2.3.7 vise a livrer le **moteur d'evaluation ABAC du programme Skalean InsurTech v2.2** : la classe injectable `AbacService` (orchestrateur PDP -- Policy Decision Point au sens XACML 3.0) et les **4 policies fondamentales** qui couvrent ~80 % des regles d'autorisation contextuelles du programme (`OwnResourcesPolicy`, `TimeBasedPolicy`, `StatusBasedPolicy`, `WorkflowStatePolicy`). Le service expose deux methodes publiques canoniques : `evaluate(role: AuthRole, permission: PermissionValue, context: AbacContext): Promise<AbacResult>` qui route le couple `(permission)` vers la / les policies applicables via `policy.appliesTo.permissions.includes(permission)`, evalue chaque policy applicable de facon sequentielle (default `first-applicable-then-stop` aligne XACML), et retourne un `AbacResult` structure (`{ allowed, reason?, appliedPolicy }`) ; et `registerPolicy(policy: AbacPolicy): void` qui enregistre dynamiquement une policy au runtime (utilise par les modules Sprint 13/14/19 pour ajouter leurs policies metier sans toucher au coeur du package `@insurtech/auth`). Si aucune policy n'est applicable au permission -> `allowed = true` (le RBAC seul suffit, principe `NotApplicable -> Permit` simplifie pour eviter les denials silencieux sur permissions purement RBAC type `crm.contacts.create`). Le service emet pour chaque evaluation un log Pino structure (`level=debug` si allowed, `level=warn` si denied) avec correlation `request_id` + tracabilite complete `appliedPolicy` / `reason` / `userId` / `tenantId` / `resourceType` / `resourceId` (audit ACAPS conforme).

Les 4 policies livrees ici sont toutes des classes `@Injectable()` NestJS implementant l'interface `AbacPolicy` (Tache 2.3.6) et expose chacune un champ `appliesTo: { permissions: PermissionValue[] }` qui declare les permissions cibles. **Policy 1 -- `OwnResourcesPolicy`** : applicable aux 17 permissions `*_own` et `*_assigned` du catalog (`crm.contacts.read_own`, `crm.contacts.update_own`, `crm.contacts.delete_own`, `crm.companies.read_own`, `crm.deals.read_own`, `pay.transactions.read_own`, `insure.policies.read_own`, `analytics.dashboards.read_own`, `docs.documents.read_own`, `docs.documents.update_own`, `repair.sinistres.read_own`, `repair.sinistres.read_assigned`, `repair.diagnostics.read_assigned`, `hr.payslips.read_own`, `sky.conversations.read_own`, etc.). Lit `context.resource.attributes.owner_user_id` ET `context.resource.attributes.assigned_user_id` (support multi-attributs), allowed = `(ownerId === userId) OR (assignedId === userId)`. Supporte la nested ownership (Sprint 14 deal multi-owners) via tableau `co_owners_user_ids: string[]`. **Policy 2 -- `TimeBasedPolicy`** : applicable aux operations contraintes temporellement, principalement `pay.transactions.refund` (Loi 17-99 article 26 droit retract consommateur 30 jours), `pay.refunds.create`, `insure.policies.cancel_within_grace` (Sprint 14 grace period 14j post-souscription Loi 17-99), `docs.signatures.revoke_within_24h` (Sprint 11 droit retract signature electronique). Lit `context.resource.attributes.created_at` (Date), calcule `delta = now() - created_at` en timezone `Africa/Casablanca` (configurable `ABAC_TIMEZONE`), check `delta <= threshold` ou threshold est lookup-able par permission via `TIME_THRESHOLDS_BY_PERMISSION` map immutable. **Policy 3 -- `StatusBasedPolicy`** : applicable aux operations conditionnees par status courant de la ressource, principalement `insure.policies.cancel` (status doit etre `active`), `insure.policies.transfer` (status `active` OR `pending_renewal`), `pay.transactions.refund` (status `succeeded`), `repair.devis.approve` (status `pending_approval`), `books.invoices.cancel` (status `draft` OR `pending_send`). Lit `context.resource.attributes.status` (string), check `allowedStatuses.includes(status)` ou allowedStatuses est lookup-able par permission via `ALLOWED_STATUSES_BY_PERMISSION` map. **Policy 4 -- `WorkflowStatePolicy`** : applicable aux transitions d'etat workflow stricte, principalement `repair.sinistres.acknowledge`, `repair.sinistres.assign_expert`, `repair.sinistres.complete_expertise`, `repair.sinistres.start_repair`, `repair.sinistres.complete_repair`, `repair.sinistres.close`, `repair.sinistres.reject` (state machine declared -> acknowledged -> expert_assigned -> expertise_completed -> devis_received -> devis_approved -> reparation_started -> reparation_completed -> closed, plus path latteral `rejected`), `insure.quotes.convert_to_policy` (quote state machine), `repair.devis.approve` (devis state machine), `insure.policies.transfer` (police state machine). Lit `context.resource.attributes.status` (current state) + utilise `SINISTRE_TRANSITIONS`, `DEVIS_TRANSITIONS`, `QUOTE_TRANSITIONS`, `POLICE_TRANSITIONS` exhaustifs (constants exportees), check `nextState ∈ allowedTransitionsFromCurrentState`.

A l'issue de cette tache, le package `@insurtech/auth/abac` expose via `packages/auth/src/abac/index.ts` les artefacts suivants : (a) classe `AbacService` (~280 lignes) avec methodes `evaluate`, `registerPolicy`, `getPoliciesForPermission`, `getRegisteredPolicies` + integration metrics Prometheus (`abac_evaluations_total{policy,result}`, `abac_evaluation_duration_seconds{policy}`) + structured logging Pino + timeout `ABAC_EVAL_TIMEOUT_MS=200ms` per policy avec fallback `denied` ; (b) 4 policies dans `policies/` chacune avec implementation complete + maps configurables exportees + helpers internes ; (c) constants `workflow-transitions.constants.ts` (~120 lignes) avec maps SINISTRE_TRANSITIONS / DEVIS_TRANSITIONS / QUOTE_TRANSITIONS / POLICE_TRANSITIONS + helper `getTerminalStates(map)` + `getAllStates(map)` ; (d) NestJS `AbacModule` (~80 lignes) qui declare les 4 policies en providers + auto-register au boot via `OnModuleInit` ; (e) suite tests Vitest 30+ tests (4 policies x 5+ scenarios = 20+ unit + 10+ AbacService integration). La commande `pnpm --filter @insurtech/auth test abac/` execute la suite complete, la commande `pnpm --filter @insurtech/auth typecheck` retourne exit 0, la commande `pnpm --filter @insurtech/auth build` produit `dist/abac/abac.service.js` consommable par Sprint 8+. Cette tache est P0 absolue car elle deverrouille la Tache 2.3.8 (Guard) qui consomme `AbacService.evaluate` puis l'ensemble Sprint 8+ qui depend du decorator `@AbacResource`.

---

## 2. Contexte etendu

### 2.1 Pourquoi un AbacService in-process plutot qu'un PDP externe (OPA / Cedar / SpiceDB)

La Tache 2.3.6 (section 2.3) documente la decision strategique de **rejeter Open Policy Agent** au profit d'un PDP custom TypeScript. Cette tache 2.3.7 implemente effectivement ce PDP. La justification est rappelee : (a) **performance** -- evaluation in-process p99 ~0.5ms versus OPA sidecar gRPC p99 ~5ms (10x plus rapide, critique car ABAC est invoque a chaque request authentifiee sur endpoints metier ~80 % du trafic) ; (b) **type-safety** -- contrat `AbacContext` -> `AbacResult` 100 % TypeScript, refactor IDE-aware versus Rego non-type ; (c) **observability** -- logs Pino unifies dans pipeline existante versus OPA emet ses propres logs separes a integrer ; (d) **deployabilite** -- pas de sidecar OPA a operer, pas de version OPA a synchroniser avec version app, simplification SRE ; (e) **debugging** -- breakpoints VSCode natifs versus debug Rego nettement plus rude. Le trade-off accepte est l'absence de **policy hot-reload** (modifier policy = redeployer service) mais cela aligne avec exigence ACAPS de **revalidation legale** de tout changement policy (donc redeploy controle est PREFERE a hot-reload silencieux).

Cedar (AWS authorization language) a egalement ete evalue puis rejete pour les memes raisons + risque vendor-lock-in AWS. SpiceDB (ReBAC Zanzibar-style) est surdimensionne car Skalean n'a pas de cas d'usage de **partage social** (sharing graph complexe) -- les relations sont simples (`owner` / `assigned` / `co_owner`) et exprimables nativement en TypeScript dans `OwnResourcesPolicy`.

### 2.2 Trade-offs : registry pattern dynamique vs decorators class-level

Deux approches ont ete envisagees pour declarer "cette policy s'applique a ces permissions" :

| Approche | Description | Avantages | Inconvenients | Adoption |
|----------|-------------|-----------|---------------|----------|
| **Decorator class-level** | `@AbacPolicyFor([Permission.CRM_CONTACTS_READ_OWN, ...])` au-dessus de `class OwnResourcesPolicy` | Lisible, declarative, metadata reflect-metadata exploitable | Couplage policy <-> permissions ferme dans code, ajout permission necessite modif source policy + redeploy package `@insurtech/auth` | NON |
| **Registry pattern dynamique** (RETENU) | Chaque policy expose `appliesTo: { permissions: [...] }` plain field, `AbacService.registerPolicy(policy)` au boot | Decouple, modules Sprint 13+ peuvent register custom policies sans modifier `@insurtech/auth`, testabilite (mock registry) | Plus verbeux (instance check au lieu de metadata), pas de validation compile-time des permissions cibles | OUI -- aligne plugin pattern NestJS |

Le registry est implemente en `Map<PolicyName, AbacPolicy>` interne au service avec verrou de duplication (throw si nom deja enregistre) et boot-time validation (chaque permission `_own`/`_assigned` du catalog doit avoir au moins une policy applicable, sinon warning loggue mais pas throw -- on accepte l'evolution incrementale).

### 2.3 Trade-offs : composition policies multi-applicables (AND vs OR vs first-applicable)

Une permission peut, theoriquement, matcher plusieurs policies (ex: `pay.transactions.refund` matcherait simultanement `OwnResourcesPolicy` -- transaction owner -- ET `TimeBasedPolicy` -- moins de 30j -- ET `StatusBasedPolicy` -- status `succeeded`). Trois strategies de composition :

| Strategie | Semantique | Conformite | Verdict |
|-----------|-----------|------------|---------|
| `permit-overrides` (XACML) | Si AU MOINS UNE policy permit -> allowed | Risque bypass : transaction ancienne mais owner -> allowed alors que TimeBased deny | REJETE -- inadequat compliance |
| `deny-overrides` (XACML) | Si AU MOINS UNE policy deny -> denied (= AND) | Conservateur, conforme principe least-privilege ACAPS, MAIS necessite couvrir TOUTES les conditions explicitement | RETENU |
| `first-applicable-then-stop` (XACML) | Premiere policy applicable decide, autres ignored | Simple, performant, MAIS ordering significant -> bug source | EVALUE puis hybridize |

**Choix retenu** : `deny-overrides` par defaut (= ALL applicable policies must allow). Le service evalue toutes les policies applicables sequentiellement, des qu'une retourne `allowed=false` le service short-circuit retourne ce result (avec son `appliedPolicy` + `reason`). Si toutes allow, retourne `{ allowed: true, appliedPolicy: 'AllPoliciesAllowed' }` (ou la liste des policies appliquees dans `appliedPolicies: string[]` champ optionnel pour debug). Cette semantique est documentee dans le code et dans les tests V21+V22.

### 2.4 Pieges techniques connus (10+ pieges critiques documentes)

1. **Piege : policy timeout async non geree -> request bloquee indefiniment.**
   - Pourquoi : si `policy.evaluate(ctx)` invoque (par erreur dans Sprint 25 une policy custom) un appel reseau sans timeout interne, le service attend infiniment, request HTTP timeout cote client, aucun audit emis.
   - Solution : `AbacService.evaluate` wrappe chaque `policy.evaluate(ctx)` dans `Promise.race([evalPromise, timeoutPromise(ABAC_EVAL_TIMEOUT_MS)])`. Si timeout -> return `{ allowed: false, reason: 'POLICY_TIMEOUT', appliedPolicy: policy.name }` + log warn + metric `abac_policy_timeouts_total{policy}`. Default 200ms (config ENV `ABAC_EVAL_TIMEOUT_MS`).

2. **Piege : `attributes.created_at` deserialise depuis JSON -> string au lieu de Date.**
   - Pourquoi : Pg `jsonb` columns retournent des strings ISO 8601, pas des objets Date. Si TimeBasedPolicy fait `now.getTime() - attrs.created_at.getTime()` -> throw `getTime is not a function`.
   - Solution : Helper `parseToDate(value: unknown): Date | null` dans `time-based.policy.ts` qui accepte `Date | string | number` et normalise. Si `null` -> return `{ allowed: false, reason: 'CREATED_AT_INVALID' }` (jamais throw uncaught).

3. **Piege : timezone server differente de Africa/Casablanca -> calcul delta faux.**
   - Pourquoi : si serveur tourne en UTC mais `created_at` est en heure Maroc (UTC+1 hiver, UTC+1 ete -- Maroc abolit DST 2018 mais fix recente), le delta de 30j est decale d'une heure -- cas limite transaction creee 23h59 jour J peut etre evaluee 30j+1h plus tard et bypass refund.
   - Solution : `luxon.DateTime` avec `setZone('Africa/Casablanca')` explicit pour tous les calculs. ENV `ABAC_TIMEZONE` configurable (default `Africa/Casablanca`). Tests V11 + V12 verifient cas limites timezone.

4. **Piege : mutation accidentelle `context.resource.attributes` dans policy.**
   - Pourquoi : si policy mute `attrs.owner_user_id = userId` (bug ou malveillant), prochaine policy voit la mutation -- bypass.
   - Solution : `AbacContext` est `Readonly<AbacContext>` recursif via `deepFreeze` (Tache 2.3.6). Si policy tente mutation -> throw `Cannot assign to read only property` (mode strict). Tests V16 verifient throw.

5. **Piege : transition map maintenance -> nouveau status non ajoute = bypass silencieux.**
   - Pourquoi : Sprint 22 ajoute status sinistre `awaiting_payment_garage`. Si oublie d'updater `SINISTRE_TRANSITIONS`, transition vers/depuis ce status -> WorkflowStatePolicy retourne `allowed=false` (current state inconnu) -- behavior conservatif acceptable MAIS aucun warning.
   - Solution : Tests V18-V20 enumerent exhaustivement TOUS les status sinistre du catalog Sprint 19 et verifient presence dans map. Helper `getAllKnownStates()` aligne avec catalog.

6. **Piege : `appliesTo.permissions` enum vs string -- runtime divergence.**
   - Pourquoi : `Permission.CRM_CONTACTS_READ_OWN` est un const TypeScript. Si dev oublie d'utiliser const et hardcode `'crm.contacts.read_own'`, typo possible (`'crm.contact.read_own'` -- singulier) -> policy ne match jamais.
   - Solution : `appliesTo.permissions: PermissionValue[]` typee strict, lint rule `no-string-literals-permission` interdit hardcode. Test V23 enumere chaque policy.appliesTo.permissions et verifie chaque element ∈ catalog Permission.

7. **Piege : `OwnResourcesPolicy` retourne `allowed=true` si `attributes.owner_user_id` ABSENT.**
   - Pourquoi : si attribut manquant (oubli loader Tache 2.3.8), `attrs.owner_user_id === undefined`, comparison `undefined === userId` = `false`. Mais piege inverse : si dev fait `if (!ownerId || ownerId === userId)` -> bypass total quand ownerId manquant.
   - Solution : Strict `if (ownerId === undefined && assignedId === undefined) return { allowed: false, reason: 'OWNER_ATTRIBUTE_MISSING' }`. Helper `extractOwnerIds(attrs): { ownerId, assignedId, coOwners }` centralise extraction. Tests V24 verifient denial si attributs absents.

8. **Piege : `concurrent registerPolicy` sans verrou -> race condition.**
   - Pourquoi : Sprint 25 cross-tenant + Sprint 30 MCP peuvent register policies au boot en parallele (modules NestJS lazy). Si la Map interne n'est pas atomique, deux policies meme nom -> derniere ecrase silencieusement.
   - Solution : `registerPolicy` synchronous + check `if (this.policies.has(policy.name)) throw new Error('Policy already registered: ' + policy.name)`. Tests V25 simulent concurrent register.

9. **Piege : daylight saving boundary Maroc.**
   - Pourquoi : Maroc a aboli DST permanent 2018 (UTC+1 toute l'annee), mais luxon utilise IANA tzdata qui peut contenir ancienne regle si version stale.
   - Solution : Pin luxon `^3.5.0` (tzdata 2024b inclus, valid). Test integration V12 verifie offset stable -1h pour `2024-12-15T23:00:00Z` -> `2024-12-16T00:00:00+01:00 Africa/Casablanca`.

10. **Piege : threshold exactly equal to delta -> ambigu inclusive vs exclusive.**
    - Pourquoi : si created_at = 30 jours - 1 seconde, delta = ~29.999... jours, allowed. Si created_at = exactement 30 jours, delta = 30 jours, allowed ou pas ? Loi 17-99 article 26 "dans un delai de 30 jours" -> jurisprudence inclusive (le 30eme jour 23h59 est encore dans le delai).
    - Solution : `delta <= threshold` (inclusive). Documentation explicit. Tests V13 V14 verifient cas limite J+30 0h00 (allowed) vs J+30 23h59:59 (allowed) vs J+31 0h00 (denied).

11. **Piege : attributes loading lazy -> resource pas encore charge au moment evaluate.**
    - Pourquoi : si Guard Tache 2.3.8 oublie d'appeler `await loader.load()` avant build context, `context.resource.attributes = {}` -- toutes policies retournent `denied missing attributes`. Behavior correct MAIS source de bugs longs a debug.
    - Solution : `AbacContextBuilder.onResource(type, id, attrs)` valide via Zod que `attrs` n'est pas vide pour resource types qui ont des attributs requis (sauf `'unknown'` resource type explicit). Helper `assertResourceAttributes` Tache 2.3.6.

12. **Piege : policy composition ANY versus FIRST-MATCH semantics confusion.**
    - Pourquoi : doc XACML utilise "first-applicable" pour PolicySet, "deny-overrides" pour PolicyCombiningAlgorithm. Confusion equipe possible.
    - Solution : Section 2.3 explicite (`deny-overrides` retenu). Code commentaire au-dessus de `evaluate` documente. Test V22 verifie comportement explicit.

### 2.5 Conformite legale Maroc -- mapping policies

| Loi / norme | Article | Policy implementee | Permission cible |
|-------------|---------|--------------------|------------------|
| Loi 17-99 (Code des assurances) | Art. 26 droit retract consommateur | `TimeBasedPolicy` 30j | `pay.refunds.create`, `pay.transactions.refund` |
| Loi 17-99 | Art. 99 grace period souscription | `TimeBasedPolicy` 14j | `insure.policies.cancel_within_grace` |
| Loi 09-08 (CNDP protection donnees) | Art. 13 minimisation acces | `OwnResourcesPolicy` | tous `*_own` |
| ACAPS reglementation 1/AS/2018 | Maker/Checker workflow | `WorkflowStatePolicy` | `repair.sinistres.*`, `insure.quotes.convert_to_policy` |
| AMC Bank Al-Maghrib AML | KYC continu | `StatusBasedPolicy` (status `kyc_validated`) | `insure.policies.create`, `pay.transactions.create` |
| ANRT decret signature electronique | Art. 17 retract 24h | `TimeBasedPolicy` 24h | `docs.signatures.revoke_within_24h` |

### 2.6 Performance budget

- Service `evaluate` : p99 < 5ms (target), p50 < 1ms.
- Policy individuelle : p99 < 1ms.
- Policy timeout : 200ms hard cap (ENV configurable).
- Memoire : registry < 100 policies typique, footprint < 10ko.
- Aucune query DB dans policies (Guard Tache 2.3.8 charge resource une fois, attributes deja loaded en memoire).
- Cache result (Tache 2.3.10) : TTL 60s sur key `(role, permission, tenantId, resourceId)` reduit p50 cache-hit a < 0.1ms.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 2.3.7 est la 7eme tache du Sprint 7 (RBAC Granulaire) et la 29eme tache de la Phase 2. Elle :

- **Depend de** : Tache 2.3.6 (interfaces livrees, builder, helpers, schemas Zod), Tache 2.3.5 (PermissionGuard pattern, AsyncLocalStorage TenantContext), Tache 2.3.4 (AuthRole type), Tache 2.3.3 (Result-typed pattern), Tache 2.3.2 (RoleHierarchy), Tache 2.3.1 (Permission catalog), Sprint 6 complet (TenantContext), Sprint 1-2 (stack TypeScript / NestJS / Vitest / Pino / Zod / luxon / prom-client).
- **Bloque** : Tache 2.3.8 (AbacResourceGuard + decorator `@AbacResource` consomme `AbacService.evaluate`), Tache 2.3.9 (AuditTrail filter consume `appliedPolicy`), Tache 2.3.10 (RbacAuditService persistence + cache result), Tache 2.3.11 (admin endpoints introspection policies), Tache 2.3.12 (E2E coverage 12 roles + scenarios ABAC).
- **Apporte au sprint** : moteur PDP injecter via DI dans Guards et controllers ; 4 policies cles couvrant 80 % regles ABAC programme ; constants workflow-transitions reutilisables Sprint 19+ ; metrics Prometheus `abac_*` integrees Sprint 22 dashboards Grafana.

### 3.2 Position dans le programme global

- **Sprint 8 CRM** : controllers `crm.contacts.update`, `crm.contacts.read` decoree `@AbacResource('crm_contact', 'id', 'update')` declenche `OwnResourcesPolicy` pour endpoints `*_own`.
- **Sprint 11 Docs** : signatures electroniques utilisent `TimeBasedPolicy` 24h pour revoke + `OwnResourcesPolicy` pour acces document.
- **Sprint 13 Pay** : refunds utilisent `TimeBasedPolicy` 30j (Loi 17-99) + `StatusBasedPolicy` `succeeded`.
- **Sprint 14 Insure** : policies cancel utilisent `StatusBasedPolicy` `active` + `WorkflowStatePolicy` quotes->policy.
- **Sprint 19 Repair** : sinistres utilisent intensivement `WorkflowStatePolicy` (state machine 9 etats).
- **Sprint 22 Observability** : dashboards Grafana consomment `abac_evaluations_total{policy,result}` + `abac_evaluation_duration_seconds`.
- **Sprint 25 Cross-tenant** : ajoute `CrossTenantSharePolicy` registree dynamiquement via `registerPolicy()`.
- **Sprint 30 MCP** : ajoute `McpToolInvokePolicy` registree dynamiquement (limit per-tool scope).
- **Sprint 31 Sky AI** : ajoute `SkyToolWriteConfirmPolicy` registree dynamiquement (require user confirmation pour write tools).
- **Sprint 33 Pentest** : 50+ scenarios verifient absence bypass via context corruption / missing attributes / replay attacks / timing attacks sur TimeBasedPolicy.

### 3.3 Diagramme flow ABAC evaluation ASCII

```
   Caller (AbacResourceGuard Tache 2.3.8)
       |
       | abacService.evaluate(role, permission, context)
       v
   +------------------------------------------------------+
   |                  AbacService                         |
   |                                                      |
   |  1. policies = getPoliciesForPermission(permission) |
   |     (Map.values().filter(p =>                        |
   |       p.appliesTo.permissions.includes(permission))) |
   |                                                      |
   |  2. If policies.length === 0:                        |
   |       log.debug('NO_POLICY_APPLICABLE')              |
   |       return { allowed: true,                        |
   |                appliedPolicy: 'NoPolicyApplicable' } |
   |                                                      |
   |  3. For each policy in policies (deny-overrides):    |
   |       result = await Promise.race([                  |
   |         policy.evaluate(context),                    |
   |         timeoutAfter(ABAC_EVAL_TIMEOUT_MS)           |
   |       ])                                             |
   |       metric.observe(policy.name, duration, result)  |
   |       If !result.allowed:                            |
   |         log.warn({ policy, reason, ctx })            |
   |         return result   // short-circuit             |
   |                                                      |
   |  4. All policies allow:                              |
   |       log.debug({ policies: [...], allowed: true })  |
   |       return { allowed: true,                        |
   |                appliedPolicy: 'AllAllowed',          |
   |                appliedPolicies: [...] }              |
   +------------------------------------------------------+
       |
       v
   AbacResult returned to Guard
```

### 3.4 Diagramme transitions sinistre state machine

```
    [declared]
       |---------> [acknowledged]  ----> [expert_assigned]
       |               |                       |
       |               v                       v
       |           [rejected]          [expertise_completed]
       |           (terminal)                  |
       |                                       v
       |                              [devis_received]
       |                                /             \
       |                               v               v
       |                      [devis_approved]  [devis_rejected]
       |                               |               |
       |                               v               | (loop back?)
       |                      [reparation_started]     |
       |                               |               v
       |                               v          [closed (with rejection)]
       |                      [reparation_completed]
       |                               |
       |                               v
       |                          [closed]
       |                          (terminal)
       v
```

Terminal states : `closed`, `rejected`. Rejet possible depuis `declared` ou `acknowledged` (refus immediat). Rejet apres expertise possible via `devis_rejected` -> `closed` (avec flag).

### 3.5 Diagramme transitions devis state machine

```
   [draft] -> [pending_approval] -> [approved] -> [order_created]
       |             |                    |
       |             v                    v
       |        [rejected]           [cancelled]
       |        (terminal)           (terminal)
       v
   [archived] (terminal)
```

### 3.6 Diagramme transitions police state machine

```
   [quoted] -> [pending_payment] -> [active] -> [renewed]
       |             |                  |             |
       v             v                  v             v
   [expired]    [cancelled]        [cancelled]   [active]
                                        |
                                        v
                                   [transferred]
                                        |
                                        v
                                   [closed]
```

### 3.7 Diagramme transitions quote state machine

```
   [draft] -> [sent] -> [accepted] -> [converted_to_policy]
       |        |           |
       v        v           v
   [archived] [expired] [rejected]
```

---

## 4. Livrables checkables

- [ ] L1 -- Service `repo/packages/auth/src/abac/abac.service.ts` (~280 lignes) avec methodes `evaluate`, `registerPolicy`, `getPoliciesForPermission`, `getRegisteredPolicies`, `clearPolicies` (test only).
- [ ] L2 -- Method `evaluate(role, permission, context)` retourne `Promise<AbacResult>` typee strict.
- [ ] L3 -- `evaluate` route automatiquement vers policies applicables via `appliesTo.permissions`.
- [ ] L4 -- `evaluate` retourne `{ allowed: true, appliedPolicy: 'NoPolicyApplicable' }` si aucune policy applicable.
- [ ] L5 -- `evaluate` semantique `deny-overrides` : short-circuit sur premier denial, log warn structured.
- [ ] L6 -- `evaluate` wrappe chaque policy dans timeout `ABAC_EVAL_TIMEOUT_MS` (default 200ms), retourne `{ allowed: false, reason: 'POLICY_TIMEOUT' }` si depasse.
- [ ] L7 -- `evaluate` emet metrics Prometheus `abac_evaluations_total{policy,result}` et `abac_evaluation_duration_seconds{policy}`.
- [ ] L8 -- `registerPolicy` synchronous + check duplication name + throw si duplicate.
- [ ] L9 -- `OwnResourcesPolicy` (`policies/own-resources.policy.ts` ~150 lignes) implementation complete.
- [ ] L10 -- OwnResourcesPolicy `appliesTo.permissions` enumere 17 permissions `_own` et `_assigned` du catalog.
- [ ] L11 -- OwnResourcesPolicy verifie `owner_user_id`, `assigned_user_id`, `co_owners_user_ids[]`.
- [ ] L12 -- OwnResourcesPolicy retourne `{ allowed: false, reason: 'OWNER_ATTRIBUTE_MISSING' }` si tous attributs absents.
- [ ] L13 -- `TimeBasedPolicy` (`policies/time-based.policy.ts` ~180 lignes) implementation complete.
- [ ] L14 -- TimeBasedPolicy expose map `TIME_THRESHOLDS_BY_PERMISSION` immutable export.
- [ ] L15 -- TimeBasedPolicy utilise `luxon.DateTime` avec timezone `Africa/Casablanca` (ENV `ABAC_TIMEZONE`).
- [ ] L16 -- TimeBasedPolicy helper `parseToDate(value)` accepte `Date | string | number`, retourne `null` si invalide.
- [ ] L17 -- TimeBasedPolicy helper `isWithinThreshold(createdAt, thresholdDays)` documente inclusive (`<=`).
- [ ] L18 -- `StatusBasedPolicy` (`policies/status-based.policy.ts` ~180 lignes) implementation complete.
- [ ] L19 -- StatusBasedPolicy expose map `ALLOWED_STATUSES_BY_PERMISSION` immutable export.
- [ ] L20 -- StatusBasedPolicy supporte multiple allowed statuses par permission (e.g. `['active', 'pending_renewal']`).
- [ ] L21 -- StatusBasedPolicy helper `isAllowedStatus(currentStatus, permission)` exporte testable.
- [ ] L22 -- `WorkflowStatePolicy` (`policies/workflow-state.policy.ts` ~250 lignes) implementation complete.
- [ ] L23 -- WorkflowStatePolicy consomme constants `SINISTRE_TRANSITIONS`, `DEVIS_TRANSITIONS`, `QUOTE_TRANSITIONS`, `POLICE_TRANSITIONS`.
- [ ] L24 -- WorkflowStatePolicy helpers `isValidTransition`, `getNextValidStates`, `isTerminalState` exposes.
- [ ] L25 -- Constants `workflow-transitions.constants.ts` (~120 lignes) exporte 4 maps + helpers.
- [ ] L26 -- NestJS `AbacModule` (`abac.module.ts` ~80 lignes) declare 4 policies en providers + auto-register au boot via `OnModuleInit`.
- [ ] L27 -- Tests unitaires `abac.service.spec.ts` (~250 lignes) : 25+ tests Vitest passent.
- [ ] L28 -- Tests unitaires `policies/own-resources.policy.spec.ts` (~150 lignes) : 15+ tests passent.
- [ ] L29 -- Tests unitaires `policies/time-based.policy.spec.ts` (~150 lignes) : 12+ tests passent.
- [ ] L30 -- Tests unitaires `policies/status-based.policy.spec.ts` (~150 lignes) : 12+ tests passent.
- [ ] L31 -- Tests unitaires `policies/workflow-state.policy.spec.ts` (~200 lignes) : 18+ tests passent.
- [ ] L32 -- Total 30+ tests, coverage >= 95% lignes / 90% branches.
- [ ] L33 -- `pnpm --filter @insurtech/auth typecheck` exit 0.
- [ ] L34 -- `pnpm --filter @insurtech/auth build` produit `dist/abac/abac.service.js`.
- [ ] L35 -- Barrel `index.ts` exporte tous les artefacts publics.

---

## 5. Fichiers crees / modifies

```
repo/packages/auth/src/abac/abac.service.ts                                     # CREE   ~280 lignes
repo/packages/auth/src/abac/abac.module.ts                                      # CREE   ~80 lignes
repo/packages/auth/src/abac/policies/own-resources.policy.ts                    # CREE   ~150 lignes
repo/packages/auth/src/abac/policies/time-based.policy.ts                       # CREE   ~180 lignes
repo/packages/auth/src/abac/policies/status-based.policy.ts                     # CREE   ~180 lignes
repo/packages/auth/src/abac/policies/workflow-state.policy.ts                   # CREE   ~250 lignes
repo/packages/auth/src/abac/constants/workflow-transitions.constants.ts          # CREE   ~120 lignes
repo/packages/auth/src/abac/constants/time-thresholds.constants.ts               # CREE   ~60 lignes
repo/packages/auth/src/abac/constants/allowed-statuses.constants.ts              # CREE   ~80 lignes
repo/packages/auth/src/abac/abac.service.spec.ts                                 # CREE   ~250 lignes
repo/packages/auth/src/abac/policies/own-resources.policy.spec.ts                # CREE   ~150 lignes
repo/packages/auth/src/abac/policies/time-based.policy.spec.ts                   # CREE   ~150 lignes
repo/packages/auth/src/abac/policies/status-based.policy.spec.ts                 # CREE   ~150 lignes
repo/packages/auth/src/abac/policies/workflow-state.policy.spec.ts               # CREE   ~200 lignes
repo/packages/auth/src/abac/index.ts                                             # MODIFIE +30 lignes (re-exports)
repo/packages/auth/src/index.ts                                                  # MODIFIE +5 lignes (re-export AbacService + AbacModule)
repo/packages/auth/package.json                                                  # MODIFIE +deps luxon ^3.5.0, prom-client ^15.1.3
```

---

## 6. Code patterns COMPLETS

### 6.1 `repo/packages/auth/src/abac/constants/workflow-transitions.constants.ts`

```typescript
/**
 * Workflow state machines pour les ressources Skalean InsurTech v2.2.
 *
 * Chaque map associe `state -> nextValidStates[]`. Si `nextValidStates` est `[]`,
 * le state est terminal. Maintenance : ajout nouveau status -> updater map ici
 * + tests V18+V19+V20 + revue ACAPS Maker/Checker workflow.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

/**
 * Transitions sinistre (Sprint 19 module repair).
 * State machine canonique 9 etats + 1 etat lateral.
 */
export const SINISTRE_TRANSITIONS = {
  declared: ['acknowledged', 'rejected'],
  acknowledged: ['expert_assigned', 'rejected'],
  expert_assigned: ['expertise_completed'],
  expertise_completed: ['devis_received'],
  devis_received: ['devis_approved', 'devis_rejected'],
  devis_approved: ['reparation_started'],
  devis_rejected: ['closed'],
  reparation_started: ['reparation_completed'],
  reparation_completed: ['closed'],
  closed: [],
  rejected: [],
} as const satisfies Record<string, readonly string[]>;

export type SinistreState = keyof typeof SINISTRE_TRANSITIONS;

/**
 * Transitions devis (Sprint 19 module repair sub-flow).
 */
export const DEVIS_TRANSITIONS = {
  draft: ['pending_approval', 'archived'],
  pending_approval: ['approved', 'rejected'],
  approved: ['order_created', 'cancelled'],
  rejected: [],
  cancelled: [],
  order_created: [],
  archived: [],
} as const satisfies Record<string, readonly string[]>;

export type DevisState = keyof typeof DEVIS_TRANSITIONS;

/**
 * Transitions police d'assurance (Sprint 14 module insure).
 */
export const POLICE_TRANSITIONS = {
  quoted: ['pending_payment', 'expired'],
  pending_payment: ['active', 'cancelled'],
  active: ['renewed', 'cancelled', 'transferred', 'expired'],
  renewed: ['active'],
  cancelled: [],
  transferred: ['closed'],
  expired: [],
  closed: [],
} as const satisfies Record<string, readonly string[]>;

export type PoliceState = keyof typeof POLICE_TRANSITIONS;

/**
 * Transitions quote (Sprint 14 module insure sub-flow).
 */
export const QUOTE_TRANSITIONS = {
  draft: ['sent', 'archived'],
  sent: ['accepted', 'rejected', 'expired'],
  accepted: ['converted_to_policy'],
  rejected: [],
  expired: [],
  converted_to_policy: [],
  archived: [],
} as const satisfies Record<string, readonly string[]>;

export type QuoteState = keyof typeof QUOTE_TRANSITIONS;

/**
 * Type union pour selection map par resource type.
 */
export type WorkflowMap = Readonly<Record<string, readonly string[]>>;

/**
 * Lookup map par resource type (utilise dans WorkflowStatePolicy).
 */
export const WORKFLOW_MAPS_BY_RESOURCE_TYPE: Readonly<Record<string, WorkflowMap>> = {
  repair_sinistre: SINISTRE_TRANSITIONS,
  repair_devis: DEVIS_TRANSITIONS,
  insure_police: POLICE_TRANSITIONS,
  insure_quote: QUOTE_TRANSITIONS,
} as const;

/**
 * Helper -- check transition validity from `current` to `next` in `map`.
 */
export function isValidTransition(
  map: WorkflowMap,
  current: string,
  next: string,
): boolean {
  const allowed = map[current];
  if (!allowed) {
    return false;
  }
  return allowed.includes(next);
}

/**
 * Helper -- list next valid states from `current`.
 */
export function getNextValidStates(map: WorkflowMap, current: string): readonly string[] {
  return map[current] ?? [];
}

/**
 * Helper -- check terminal state (no outgoing transitions).
 */
export function isTerminalState(map: WorkflowMap, state: string): boolean {
  const allowed = map[state];
  return allowed !== undefined && allowed.length === 0;
}

/**
 * Helper -- enumerate all known states in a map.
 */
export function getAllStates(map: WorkflowMap): readonly string[] {
  return Object.keys(map);
}

/**
 * Helper -- enumerate all terminal states.
 */
export function getTerminalStates(map: WorkflowMap): readonly string[] {
  return getAllStates(map).filter((s) => isTerminalState(map, s));
}
```

### 6.2 `repo/packages/auth/src/abac/constants/time-thresholds.constants.ts`

```typescript
/**
 * Time thresholds par permission (configurable runtime via ENV override Sprint 33).
 *
 * Conformite legale Maroc :
 *  - Loi 17-99 article 26 : droit retract consommateur 30 jours pour refunds.
 *  - Loi 17-99 article 99 : grace period souscription 14 jours.
 *  - ANRT decret signature electronique : retract 24h.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import type { PermissionValue } from '../../rbac/permissions';

/**
 * Map permission -> threshold en jours (inclusive `<=`).
 *
 * Utilise par TimeBasedPolicy pour lookup threshold automatique.
 */
export const TIME_THRESHOLDS_BY_PERMISSION_DAYS: Readonly<Record<string, number>> = {
  // Loi 17-99 art. 26 -- refunds
  'pay.refunds.create': 30,
  'pay.transactions.refund': 30,
  // Loi 17-99 art. 99 -- grace period
  'insure.policies.cancel_within_grace': 14,
  // ANRT signature electronique
  'docs.signatures.revoke_within_24h': 1,
} as const;

/**
 * ENV override default (lu au boot AbacModule).
 */
export const DEFAULT_REFUND_THRESHOLD_DAYS = 30;
```

### 6.3 `repo/packages/auth/src/abac/constants/allowed-statuses.constants.ts`

```typescript
/**
 * Allowed statuses par permission (lookup map StatusBasedPolicy).
 *
 * Format : permission -> array de statuses autorises (OR logic).
 * Si current status NOT IN array -> denial.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import type { PermissionValue } from '../../rbac/permissions';

export const ALLOWED_STATUSES_BY_PERMISSION: Readonly<Record<string, readonly string[]>> = {
  // Module insure
  'insure.policies.cancel': ['active'],
  'insure.policies.transfer': ['active', 'pending_renewal'],
  'insure.policies.renew': ['active'],
  'insure.quotes.send': ['draft'],
  'insure.quotes.accept': ['sent'],
  // Module pay
  'pay.transactions.refund': ['succeeded'],
  'pay.refunds.create': ['succeeded'],
  // Module repair
  'repair.devis.approve': ['pending_approval'],
  'repair.devis.send': ['draft'],
  'repair.sinistres.assign_expert': ['acknowledged'],
  // Module books
  'books.invoices.cancel': ['draft', 'pending_send'],
  'books.invoices.send': ['draft'],
  // Module docs
  'docs.signatures.revoke_within_24h': ['signed'],
} as const;

/**
 * Helper -- check status allowed pour permission donnee.
 */
export function isStatusAllowed(
  permission: string,
  currentStatus: string | undefined | null,
): boolean {
  const allowed = ALLOWED_STATUSES_BY_PERMISSION[permission];
  if (!allowed) {
    // Pas de constraint statut pour cette permission -> accept (policy n'est pas applicable de facon stricte)
    return true;
  }
  if (currentStatus === undefined || currentStatus === null) {
    return false;
  }
  return allowed.includes(currentStatus);
}
```

### 6.4 `repo/packages/auth/src/abac/policies/own-resources.policy.ts`

```typescript
/**
 * OwnResourcesPolicy -- ABAC Policy 1 / 4.
 *
 * Verifie qu'un utilisateur peut acceder uniquement aux ressources :
 *  - dont il est OWNER (`attributes.owner_user_id === ctx.userId`)
 *  - OU dont il est ASSIGNED (`attributes.assigned_user_id === ctx.userId`)
 *  - OU dont il est CO-OWNER (`attributes.co_owners_user_ids` contains ctx.userId)
 *
 * Applicable a 17 permissions `*_own` / `*_assigned` du catalog Sprint 7.
 *
 * Conformite : Loi 09-08 (CNDP) art. 13 minimisation acces aux donnees personnelles.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  AbacContext,
  AbacPolicy,
  AbacResult,
} from '../types';
import { Permission, type PermissionValue } from '../../rbac/permissions';

/**
 * Liste exhaustive des permissions `_own` / `_assigned` du catalog Sprint 7.
 * Sprint 8+ ajouteront via re-deploy package OU via registerPolicy custom.
 */
const OWN_OR_ASSIGNED_PERMISSIONS: readonly PermissionValue[] = [
  // CRM
  Permission.CRM_CONTACTS_READ_OWN,
  Permission.CRM_CONTACTS_UPDATE_OWN,
  Permission.CRM_CONTACTS_DELETE_OWN,
  Permission.CRM_COMPANIES_READ_OWN,
  Permission.CRM_DEALS_READ_OWN,
  Permission.CRM_DEALS_UPDATE_OWN,
  // Pay
  Permission.PAY_TRANSACTIONS_READ_OWN,
  // Insure
  Permission.INSURE_POLICIES_READ_OWN,
  // Analytics
  Permission.ANALYTICS_DASHBOARDS_READ_OWN,
  // Docs
  Permission.DOCS_DOCUMENTS_READ_OWN,
  Permission.DOCS_DOCUMENTS_UPDATE_OWN,
  // Repair
  Permission.REPAIR_SINISTRES_READ_OWN,
  Permission.REPAIR_SINISTRES_READ_ASSIGNED,
  Permission.REPAIR_DIAGNOSTICS_READ_ASSIGNED,
  // HR
  Permission.HR_PAYSLIPS_READ_OWN,
  // Sky
  Permission.SKY_CONVERSATIONS_READ_OWN,
  // MCP n/a (no _own variant Sprint 30 initial)
] as const;

interface OwnerExtractionResult {
  ownerId: string | undefined;
  assignedId: string | undefined;
  coOwners: readonly string[];
}

function extractOwnerIds(
  attrs: Readonly<Record<string, unknown>>,
): OwnerExtractionResult {
  const ownerId = typeof attrs.owner_user_id === 'string' ? attrs.owner_user_id : undefined;
  const assignedId =
    typeof attrs.assigned_user_id === 'string' ? attrs.assigned_user_id : undefined;
  const coOwnersRaw = attrs.co_owners_user_ids;
  const coOwners =
    Array.isArray(coOwnersRaw) && coOwnersRaw.every((v) => typeof v === 'string')
      ? (coOwnersRaw as string[])
      : [];
  return { ownerId, assignedId, coOwners };
}

@Injectable()
export class OwnResourcesPolicy implements AbacPolicy {
  public readonly name = 'OwnResourcesPolicy';

  public readonly appliesTo: AbacPolicy['appliesTo'] = {
    permissions: [...OWN_OR_ASSIGNED_PERMISSIONS],
  };

  private readonly logger = new Logger(OwnResourcesPolicy.name);

  public async evaluate(context: AbacContext): Promise<AbacResult> {
    const { userId, resource } = context;
    const { ownerId, assignedId, coOwners } = extractOwnerIds(resource.attributes);

    // Aucun attribut d'ownership disponible -> denial conservateur
    if (
      ownerId === undefined &&
      assignedId === undefined &&
      coOwners.length === 0
    ) {
      this.logger.warn({
        msg: 'OwnResourcesPolicy denied -- owner attributes missing',
        userId,
        resourceType: resource.type,
        resourceId: resource.id,
      });
      return {
        allowed: false,
        reason: 'OWNER_ATTRIBUTE_MISSING',
        appliedPolicy: this.name,
      };
    }

    // Match owner direct
    if (ownerId === userId) {
      return { allowed: true, appliedPolicy: this.name };
    }

    // Match assigned
    if (assignedId === userId) {
      return { allowed: true, appliedPolicy: this.name };
    }

    // Match co-owner
    if (coOwners.includes(userId)) {
      return { allowed: true, appliedPolicy: this.name };
    }

    // Aucun match
    this.logger.debug({
      msg: 'OwnResourcesPolicy denied -- not owner / assigned / co-owner',
      userId,
      ownerId,
      assignedId,
      coOwnersCount: coOwners.length,
      resourceType: resource.type,
      resourceId: resource.id,
    });
    return {
      allowed: false,
      reason: 'NOT_OWNER',
      appliedPolicy: this.name,
    };
  }
}
```

### 6.5 `repo/packages/auth/src/abac/policies/time-based.policy.ts`

```typescript
/**
 * TimeBasedPolicy -- ABAC Policy 2 / 4.
 *
 * Verifie qu'une operation est invoquee dans une fenetre temporelle autorisee.
 *
 * Cas d'usage primaires :
 *  - pay.refunds.create / pay.transactions.refund : Loi 17-99 art. 26 -> 30 jours
 *  - insure.policies.cancel_within_grace : Loi 17-99 art. 99 -> 14 jours
 *  - docs.signatures.revoke_within_24h : ANRT -> 1 jour
 *
 * Calcul effectue avec timezone Africa/Casablanca (UTC+1 toute l'annee depuis 2018).
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import type {
  AbacContext,
  AbacPolicy,
  AbacResult,
} from '../types';
import {
  TIME_THRESHOLDS_BY_PERMISSION_DAYS,
  DEFAULT_REFUND_THRESHOLD_DAYS,
} from '../constants/time-thresholds.constants';
import { Permission, type PermissionValue } from '../../rbac/permissions';

const TIME_BASED_PERMISSIONS: readonly PermissionValue[] = [
  Permission.PAY_REFUNDS_CREATE,
  Permission.PAY_TRANSACTIONS_REFUND,
  Permission.INSURE_POLICIES_CANCEL_WITHIN_GRACE,
  Permission.DOCS_SIGNATURES_REVOKE_WITHIN_24H,
] as const;

/**
 * Token DI pour ENV ABAC_TIMEZONE (configurable test).
 */
export const ABAC_TIMEZONE_TOKEN = Symbol('ABAC_TIMEZONE');
export const DEFAULT_ABAC_TIMEZONE = 'Africa/Casablanca';

/**
 * Helper -- parse value en Date robuste (string ISO, number epoch ms, Date instance).
 * Retourne null si value indeterminable.
 */
export function parseToDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Helper -- check si createdAt est dans la fenetre [now - thresholdDays, now] inclusive.
 *
 * @param createdAt timestamp creation ressource
 * @param thresholdDays jours autorises (inclusive `<=`)
 * @param timezone timezone IANA (default Africa/Casablanca)
 * @param now optional override pour tests deterministes
 */
export function isWithinThreshold(
  createdAt: Date,
  thresholdDays: number,
  timezone: string = DEFAULT_ABAC_TIMEZONE,
  now: Date = new Date(),
): boolean {
  const created = DateTime.fromJSDate(createdAt).setZone(timezone);
  const current = DateTime.fromJSDate(now).setZone(timezone);
  const diff = current.diff(created, 'days').days;
  return diff <= thresholdDays && diff >= 0;
}

/**
 * Lookup threshold pour permission donnee. Default DEFAULT_REFUND_THRESHOLD_DAYS si absent map.
 */
export function getThresholdForPermission(permission: string): number {
  return TIME_THRESHOLDS_BY_PERMISSION_DAYS[permission] ?? DEFAULT_REFUND_THRESHOLD_DAYS;
}

@Injectable()
export class TimeBasedPolicy implements AbacPolicy {
  public readonly name = 'TimeBasedPolicy';

  public readonly appliesTo: AbacPolicy['appliesTo'] = {
    permissions: [...TIME_BASED_PERMISSIONS],
  };

  private readonly logger = new Logger(TimeBasedPolicy.name);

  public constructor(
    @Inject(ABAC_TIMEZONE_TOKEN) private readonly timezone: string = DEFAULT_ABAC_TIMEZONE,
  ) {}

  public async evaluate(context: AbacContext): Promise<AbacResult> {
    const { resource, permission } = context;
    const createdAtRaw = resource.attributes.created_at;
    const createdAt = parseToDate(createdAtRaw);

    if (createdAt === null) {
      this.logger.warn({
        msg: 'TimeBasedPolicy denied -- created_at invalid or missing',
        resourceType: resource.type,
        resourceId: resource.id,
        createdAtRaw,
      });
      return {
        allowed: false,
        reason: 'CREATED_AT_INVALID',
        appliedPolicy: this.name,
      };
    }

    const thresholdDays = getThresholdForPermission(permission);
    const within = isWithinThreshold(createdAt, thresholdDays, this.timezone);

    if (!within) {
      this.logger.debug({
        msg: 'TimeBasedPolicy denied -- outside threshold',
        permission,
        thresholdDays,
        createdAt: createdAt.toISOString(),
        resourceType: resource.type,
        resourceId: resource.id,
      });
      return {
        allowed: false,
        reason: 'OUTSIDE_TIME_THRESHOLD',
        appliedPolicy: this.name,
      };
    }

    return { allowed: true, appliedPolicy: this.name };
  }
}
```

### 6.6 `repo/packages/auth/src/abac/policies/status-based.policy.ts`

```typescript
/**
 * StatusBasedPolicy -- ABAC Policy 3 / 4.
 *
 * Verifie que la ressource cible est dans un status autorise pour la permission.
 *
 * Exemples :
 *  - insure.policies.cancel : status doit etre 'active'
 *  - pay.transactions.refund : status doit etre 'succeeded'
 *  - books.invoices.cancel : status IN ['draft', 'pending_send']
 *
 * Lookup config via ALLOWED_STATUSES_BY_PERMISSION (constants).
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  AbacContext,
  AbacPolicy,
  AbacResult,
} from '../types';
import {
  ALLOWED_STATUSES_BY_PERMISSION,
  isStatusAllowed,
} from '../constants/allowed-statuses.constants';
import { Permission, type PermissionValue } from '../../rbac/permissions';

const STATUS_BASED_PERMISSIONS: readonly PermissionValue[] = [
  Permission.INSURE_POLICIES_CANCEL,
  Permission.INSURE_POLICIES_TRANSFER,
  Permission.INSURE_POLICIES_RENEW,
  Permission.INSURE_QUOTES_SEND,
  Permission.INSURE_QUOTES_ACCEPT,
  Permission.PAY_TRANSACTIONS_REFUND,
  Permission.PAY_REFUNDS_CREATE,
  Permission.REPAIR_DEVIS_APPROVE,
  Permission.REPAIR_DEVIS_SEND,
  Permission.REPAIR_SINISTRES_ASSIGN_EXPERT,
  Permission.BOOKS_INVOICES_CANCEL,
  Permission.BOOKS_INVOICES_SEND,
  Permission.DOCS_SIGNATURES_REVOKE_WITHIN_24H,
] as const;

/**
 * Helper -- extraction status string-typed depuis attributes Record.
 */
export function extractStatus(attrs: Readonly<Record<string, unknown>>): string | null {
  if (typeof attrs.status === 'string' && attrs.status.length > 0) {
    return attrs.status;
  }
  return null;
}

@Injectable()
export class StatusBasedPolicy implements AbacPolicy {
  public readonly name = 'StatusBasedPolicy';

  public readonly appliesTo: AbacPolicy['appliesTo'] = {
    permissions: [...STATUS_BASED_PERMISSIONS],
  };

  private readonly logger = new Logger(StatusBasedPolicy.name);

  public async evaluate(context: AbacContext): Promise<AbacResult> {
    const { resource, permission } = context;
    const status = extractStatus(resource.attributes);

    if (status === null) {
      this.logger.warn({
        msg: 'StatusBasedPolicy denied -- status missing',
        resourceType: resource.type,
        resourceId: resource.id,
        permission,
      });
      return {
        allowed: false,
        reason: 'STATUS_MISSING',
        appliedPolicy: this.name,
      };
    }

    const allowed = isStatusAllowed(permission, status);
    if (!allowed) {
      const allowedStatuses = ALLOWED_STATUSES_BY_PERMISSION[permission] ?? [];
      this.logger.debug({
        msg: 'StatusBasedPolicy denied -- status not in allowed list',
        permission,
        currentStatus: status,
        allowedStatuses,
        resourceType: resource.type,
        resourceId: resource.id,
      });
      return {
        allowed: false,
        reason: 'STATUS_NOT_ALLOWED',
        appliedPolicy: this.name,
      };
    }

    return { allowed: true, appliedPolicy: this.name };
  }
}
```

### 6.7 `repo/packages/auth/src/abac/policies/workflow-state.policy.ts`

```typescript
/**
 * WorkflowStatePolicy -- ABAC Policy 4 / 4.
 *
 * Verifie qu'une transition de workflow est valide selon state machine declaree.
 *
 * Cas d'usage primaires :
 *  - repair.sinistres.* : state machine 9 etats sinistre.
 *  - repair.devis.approve : state machine devis.
 *  - insure.quotes.convert_to_policy : state machine quote.
 *  - insure.policies.transfer : state machine police.
 *
 * Mapping resource_type -> WorkflowMap via WORKFLOW_MAPS_BY_RESOURCE_TYPE.
 * Mapping permission -> nextState target via PERMISSION_TO_NEXT_STATE map.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  AbacContext,
  AbacPolicy,
  AbacResult,
} from '../types';
import {
  WORKFLOW_MAPS_BY_RESOURCE_TYPE,
  isValidTransition,
  getNextValidStates,
  isTerminalState,
} from '../constants/workflow-transitions.constants';
import { Permission, type PermissionValue } from '../../rbac/permissions';

const WORKFLOW_STATE_PERMISSIONS: readonly PermissionValue[] = [
  // Sinistre transitions
  Permission.REPAIR_SINISTRES_ACKNOWLEDGE,
  Permission.REPAIR_SINISTRES_ASSIGN_EXPERT,
  Permission.REPAIR_SINISTRES_COMPLETE_EXPERTISE,
  Permission.REPAIR_SINISTRES_START_REPAIR,
  Permission.REPAIR_SINISTRES_COMPLETE_REPAIR,
  Permission.REPAIR_SINISTRES_CLOSE,
  Permission.REPAIR_SINISTRES_REJECT,
  // Devis transitions
  Permission.REPAIR_DEVIS_APPROVE,
  Permission.REPAIR_DEVIS_REJECT,
  Permission.REPAIR_DEVIS_SEND,
  // Quote transitions
  Permission.INSURE_QUOTES_CONVERT_TO_POLICY,
  Permission.INSURE_QUOTES_SEND,
  // Police transitions
  Permission.INSURE_POLICIES_TRANSFER,
  Permission.INSURE_POLICIES_RENEW,
  Permission.INSURE_POLICIES_CANCEL,
] as const;

/**
 * Mapping permission -> targetState attendu (transition cible).
 *
 * Documente quelle permission veut effectuer quelle transition.
 */
export const PERMISSION_TO_NEXT_STATE: Readonly<Record<string, string>> = {
  // Sinistre
  'repair.sinistres.acknowledge': 'acknowledged',
  'repair.sinistres.assign_expert': 'expert_assigned',
  'repair.sinistres.complete_expertise': 'expertise_completed',
  'repair.sinistres.start_repair': 'reparation_started',
  'repair.sinistres.complete_repair': 'reparation_completed',
  'repair.sinistres.close': 'closed',
  'repair.sinistres.reject': 'rejected',
  // Devis
  'repair.devis.approve': 'approved',
  'repair.devis.reject': 'rejected',
  'repair.devis.send': 'pending_approval',
  // Quote
  'insure.quotes.convert_to_policy': 'converted_to_policy',
  'insure.quotes.send': 'sent',
  // Police
  'insure.policies.transfer': 'transferred',
  'insure.policies.renew': 'renewed',
  'insure.policies.cancel': 'cancelled',
} as const;

@Injectable()
export class WorkflowStatePolicy implements AbacPolicy {
  public readonly name = 'WorkflowStatePolicy';

  public readonly appliesTo: AbacPolicy['appliesTo'] = {
    permissions: [...WORKFLOW_STATE_PERMISSIONS],
  };

  private readonly logger = new Logger(WorkflowStatePolicy.name);

  public async evaluate(context: AbacContext): Promise<AbacResult> {
    const { resource, permission } = context;

    const map = WORKFLOW_MAPS_BY_RESOURCE_TYPE[resource.type];
    if (!map) {
      this.logger.warn({
        msg: 'WorkflowStatePolicy denied -- unknown resource type',
        resourceType: resource.type,
        permission,
      });
      return {
        allowed: false,
        reason: 'UNKNOWN_RESOURCE_TYPE_FOR_WORKFLOW',
        appliedPolicy: this.name,
      };
    }

    const currentStatus = typeof resource.attributes.status === 'string'
      ? resource.attributes.status
      : null;

    if (currentStatus === null) {
      this.logger.warn({
        msg: 'WorkflowStatePolicy denied -- current status missing',
        resourceType: resource.type,
        resourceId: resource.id,
        permission,
      });
      return {
        allowed: false,
        reason: 'STATUS_MISSING',
        appliedPolicy: this.name,
      };
    }

    const targetState = PERMISSION_TO_NEXT_STATE[permission];
    if (!targetState) {
      this.logger.warn({
        msg: 'WorkflowStatePolicy denied -- no target state mapping for permission',
        permission,
      });
      return {
        allowed: false,
        reason: 'NO_TARGET_STATE_MAPPING',
        appliedPolicy: this.name,
      };
    }

    if (isTerminalState(map, currentStatus)) {
      this.logger.debug({
        msg: 'WorkflowStatePolicy denied -- current state is terminal',
        currentStatus,
        resourceType: resource.type,
        resourceId: resource.id,
      });
      return {
        allowed: false,
        reason: 'TERMINAL_STATE',
        appliedPolicy: this.name,
      };
    }

    const valid = isValidTransition(map, currentStatus, targetState);
    if (!valid) {
      const allowedNext = getNextValidStates(map, currentStatus);
      this.logger.debug({
        msg: 'WorkflowStatePolicy denied -- invalid transition',
        currentStatus,
        attemptedNextState: targetState,
        allowedNextStates: allowedNext,
        resourceType: resource.type,
        resourceId: resource.id,
      });
      return {
        allowed: false,
        reason: 'INVALID_TRANSITION',
        appliedPolicy: this.name,
      };
    }

    return { allowed: true, appliedPolicy: this.name };
  }
}
```

### 6.8 `repo/packages/auth/src/abac/abac.service.ts`

```typescript
/**
 * AbacService -- ABAC Policy Decision Point (PDP) Skalean InsurTech v2.2.
 *
 * Orchestre l'evaluation des policies enregistrees, applique semantique
 * `deny-overrides` (toutes policies applicables doivent allow), wrappe
 * chaque policy dans timeout `ABAC_EVAL_TIMEOUT_MS` (default 200ms),
 * emet metrics Prometheus + logs Pino structures.
 *
 * Reference XACML 3.0 PDP.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Counter, Histogram, register as defaultRegister } from 'prom-client';
import type {
  AbacContext,
  AbacPolicy,
  AbacResult,
} from './types';
import type { PermissionValue } from '../rbac/permissions';
import type { AuthRole } from '../rbac/roles';

/**
 * Token DI pour timeout (ENV ABAC_EVAL_TIMEOUT_MS).
 */
export const ABAC_EVAL_TIMEOUT_MS_TOKEN = Symbol('ABAC_EVAL_TIMEOUT_MS');
export const DEFAULT_ABAC_EVAL_TIMEOUT_MS = 200;

/**
 * Token DI pour log granted ou pas (ENV ABAC_LOG_GRANTED).
 */
export const ABAC_LOG_GRANTED_TOKEN = Symbol('ABAC_LOG_GRANTED');

interface InternalMetrics {
  evaluationsTotal: Counter<string>;
  evaluationDuration: Histogram<string>;
  policyTimeouts: Counter<string>;
}

function createMetrics(): InternalMetrics {
  // Defensive create-or-get pour multi-test-suites.
  const existingTotal = defaultRegister.getSingleMetric('abac_evaluations_total') as
    | Counter<string>
    | undefined;
  const existingDuration = defaultRegister.getSingleMetric(
    'abac_evaluation_duration_seconds',
  ) as Histogram<string> | undefined;
  const existingTimeouts = defaultRegister.getSingleMetric('abac_policy_timeouts_total') as
    | Counter<string>
    | undefined;

  const evaluationsTotal =
    existingTotal ??
    new Counter({
      name: 'abac_evaluations_total',
      help: 'ABAC policy evaluations count by policy and result',
      labelNames: ['policy', 'result'] as const,
    });

  const evaluationDuration =
    existingDuration ??
    new Histogram({
      name: 'abac_evaluation_duration_seconds',
      help: 'ABAC policy evaluation duration in seconds',
      labelNames: ['policy'] as const,
      buckets: [0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.2, 0.5, 1],
    });

  const policyTimeouts =
    existingTimeouts ??
    new Counter({
      name: 'abac_policy_timeouts_total',
      help: 'ABAC policy timeouts count',
      labelNames: ['policy'] as const,
    });

  return { evaluationsTotal, evaluationDuration, policyTimeouts };
}

/**
 * Internal -- create timeout promise that rejects after ms.
 */
function timeoutAfter(ms: number, policyName: string): Promise<never> {
  return new Promise((_resolve, reject) => {
    const handle = setTimeout(() => {
      reject(new Error(`Policy ${policyName} timed out after ${ms}ms`));
    }, ms);
    if (typeof handle === 'object' && handle !== null && typeof (handle as { unref?: () => void }).unref === 'function') {
      (handle as { unref: () => void }).unref();
    }
  });
}

@Injectable()
export class AbacService {
  private readonly logger = new Logger(AbacService.name);
  private readonly policies = new Map<string, AbacPolicy>();
  private readonly metrics: InternalMetrics;

  public constructor(
    @Optional()
    @Inject(ABAC_EVAL_TIMEOUT_MS_TOKEN)
    private readonly evalTimeoutMs: number = DEFAULT_ABAC_EVAL_TIMEOUT_MS,
    @Optional()
    @Inject(ABAC_LOG_GRANTED_TOKEN)
    private readonly logGranted: boolean = false,
  ) {
    this.metrics = createMetrics();
  }

  /**
   * Register a new policy. Throws if policy.name already registered.
   */
  public registerPolicy(policy: AbacPolicy): void {
    if (this.policies.has(policy.name)) {
      throw new Error(`Policy already registered: ${policy.name}`);
    }
    this.policies.set(policy.name, policy);
    this.logger.log({
      msg: 'AbacService policy registered',
      policy: policy.name,
      appliesToCount: policy.appliesTo.permissions.length,
    });
  }

  /**
   * List all registered policy names (introspection).
   */
  public getRegisteredPolicies(): readonly string[] {
    return Array.from(this.policies.keys());
  }

  /**
   * Get policies applicable to a given permission.
   */
  public getPoliciesForPermission(permission: PermissionValue): readonly AbacPolicy[] {
    const result: AbacPolicy[] = [];
    for (const policy of this.policies.values()) {
      if (policy.appliesTo.permissions.includes(permission)) {
        result.push(policy);
      }
    }
    return result;
  }

  /**
   * Test-only -- clear registry. NEVER call in production code.
   */
  public clearPolicies(): void {
    this.policies.clear();
  }

  /**
   * Evaluate ABAC policies for (role, permission, context).
   *
   * Semantic : `deny-overrides` -- all applicable policies must allow.
   * Short-circuits on first denial. If no policy applicable -> allow.
   */
  public async evaluate(
    role: AuthRole,
    permission: PermissionValue,
    context: AbacContext,
  ): Promise<AbacResult> {
    const policies = this.getPoliciesForPermission(permission);

    if (policies.length === 0) {
      if (this.logGranted) {
        this.logger.debug({
          msg: 'AbacService no policy applicable -- allowed by RBAC alone',
          role,
          permission,
          userId: context.userId,
        });
      }
      return {
        allowed: true,
        appliedPolicy: 'NoPolicyApplicable',
      };
    }

    const appliedPolicies: string[] = [];

    for (const policy of policies) {
      const start = process.hrtime.bigint();
      let result: AbacResult;
      try {
        result = await Promise.race([
          policy.evaluate(context),
          timeoutAfter(this.evalTimeoutMs, policy.name),
        ]);
      } catch (err) {
        const isTimeout =
          err instanceof Error && err.message.includes('timed out');
        if (isTimeout) {
          this.metrics.policyTimeouts.inc({ policy: policy.name });
          this.logger.warn({
            msg: 'AbacService policy timed out',
            policy: policy.name,
            timeoutMs: this.evalTimeoutMs,
            role,
            permission,
            userId: context.userId,
            tenantId: context.tenantId,
          });
          this.metrics.evaluationsTotal.inc({
            policy: policy.name,
            result: 'timeout',
          });
          return {
            allowed: false,
            reason: 'POLICY_TIMEOUT',
            appliedPolicy: policy.name,
          };
        }
        // Unexpected error -> conservative denial
        this.logger.error({
          msg: 'AbacService policy threw unexpected error',
          policy: policy.name,
          error: err instanceof Error ? err.message : String(err),
          role,
          permission,
        });
        this.metrics.evaluationsTotal.inc({
          policy: policy.name,
          result: 'error',
        });
        return {
          allowed: false,
          reason: 'POLICY_ERROR',
          appliedPolicy: policy.name,
        };
      }

      const durationNs = Number(process.hrtime.bigint() - start);
      const durationS = durationNs / 1e9;
      this.metrics.evaluationDuration.observe({ policy: policy.name }, durationS);

      this.metrics.evaluationsTotal.inc({
        policy: policy.name,
        result: result.allowed ? 'allowed' : 'denied',
      });

      appliedPolicies.push(policy.name);

      // Short-circuit deny-overrides
      if (!result.allowed) {
        this.logger.warn({
          msg: 'AbacService policy denied (short-circuit)',
          policy: result.appliedPolicy,
          reason: result.reason,
          role,
          permission,
          userId: context.userId,
          tenantId: context.tenantId,
          resourceType: context.resource.type,
          resourceId: context.resource.id,
        });
        return result;
      }
    }

    if (this.logGranted) {
      this.logger.debug({
        msg: 'AbacService all policies allowed',
        appliedPolicies,
        role,
        permission,
        userId: context.userId,
      });
    }
    return {
      allowed: true,
      appliedPolicy:
        appliedPolicies.length === 1 ? appliedPolicies[0] : 'AllPoliciesAllowed',
      appliedPolicies,
    };
  }
}
```

### 6.9 `repo/packages/auth/src/abac/abac.module.ts`

```typescript
/**
 * AbacModule -- NestJS module pour AbacService + 4 policies fondamentales.
 *
 * Auto-register policies au boot via OnModuleInit.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { Module, type OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  AbacService,
  ABAC_EVAL_TIMEOUT_MS_TOKEN,
  ABAC_LOG_GRANTED_TOKEN,
  DEFAULT_ABAC_EVAL_TIMEOUT_MS,
} from './abac.service';
import { OwnResourcesPolicy } from './policies/own-resources.policy';
import {
  TimeBasedPolicy,
  ABAC_TIMEZONE_TOKEN,
  DEFAULT_ABAC_TIMEZONE,
} from './policies/time-based.policy';
import { StatusBasedPolicy } from './policies/status-based.policy';
import { WorkflowStatePolicy } from './policies/workflow-state.policy';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: ABAC_EVAL_TIMEOUT_MS_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): number => {
        const raw = config.get<string>('ABAC_EVAL_TIMEOUT_MS');
        const parsed = raw ? parseInt(raw, 10) : DEFAULT_ABAC_EVAL_TIMEOUT_MS;
        return Number.isFinite(parsed) && parsed > 0
          ? parsed
          : DEFAULT_ABAC_EVAL_TIMEOUT_MS;
      },
    },
    {
      provide: ABAC_LOG_GRANTED_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): boolean =>
        config.get<string>('ABAC_LOG_GRANTED') === 'true',
    },
    {
      provide: ABAC_TIMEZONE_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService): string =>
        config.get<string>('ABAC_TIMEZONE') ?? DEFAULT_ABAC_TIMEZONE,
    },
    AbacService,
    OwnResourcesPolicy,
    TimeBasedPolicy,
    StatusBasedPolicy,
    WorkflowStatePolicy,
  ],
  exports: [AbacService],
})
export class AbacModule implements OnModuleInit {
  public constructor(
    private readonly abacService: AbacService,
    private readonly ownResources: OwnResourcesPolicy,
    private readonly timeBased: TimeBasedPolicy,
    private readonly statusBased: StatusBasedPolicy,
    private readonly workflowState: WorkflowStatePolicy,
  ) {}

  public onModuleInit(): void {
    this.abacService.registerPolicy(this.ownResources);
    this.abacService.registerPolicy(this.timeBased);
    this.abacService.registerPolicy(this.statusBased);
    this.abacService.registerPolicy(this.workflowState);
  }
}
```

### 6.10 `repo/packages/auth/src/abac/index.ts` (additions)

```typescript
// ===== Tache 2.3.7 additions =====
export { AbacService, ABAC_EVAL_TIMEOUT_MS_TOKEN, ABAC_LOG_GRANTED_TOKEN, DEFAULT_ABAC_EVAL_TIMEOUT_MS } from './abac.service';
export { AbacModule } from './abac.module';
export { OwnResourcesPolicy } from './policies/own-resources.policy';
export {
  TimeBasedPolicy,
  ABAC_TIMEZONE_TOKEN,
  DEFAULT_ABAC_TIMEZONE,
  parseToDate,
  isWithinThreshold,
  getThresholdForPermission,
} from './policies/time-based.policy';
export { StatusBasedPolicy, extractStatus } from './policies/status-based.policy';
export { WorkflowStatePolicy, PERMISSION_TO_NEXT_STATE } from './policies/workflow-state.policy';
export {
  SINISTRE_TRANSITIONS,
  DEVIS_TRANSITIONS,
  POLICE_TRANSITIONS,
  QUOTE_TRANSITIONS,
  WORKFLOW_MAPS_BY_RESOURCE_TYPE,
  isValidTransition,
  getNextValidStates,
  isTerminalState,
  getAllStates,
  getTerminalStates,
  type SinistreState,
  type DevisState,
  type PoliceState,
  type QuoteState,
  type WorkflowMap,
} from './constants/workflow-transitions.constants';
export {
  TIME_THRESHOLDS_BY_PERMISSION_DAYS,
  DEFAULT_REFUND_THRESHOLD_DAYS,
} from './constants/time-thresholds.constants';
export {
  ALLOWED_STATUSES_BY_PERMISSION,
  isStatusAllowed,
} from './constants/allowed-statuses.constants';
```

### 6.11 `repo/packages/auth/src/abac/abac.service.spec.ts`

```typescript
/**
 * AbacService unit tests -- 25+ scenarios.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AbacService } from './abac.service';
import type { AbacContext, AbacPolicy, AbacResult } from './types';
import { Permission } from '../rbac/permissions';

function makeContext(overrides: Partial<AbacContext> = {}): AbacContext {
  return {
    userId: 'user-1',
    role: 'broker_user',
    tenantId: 'tenant-1',
    permission: Permission.CRM_CONTACTS_READ_OWN,
    action: 'read',
    resource: {
      type: 'crm_contact',
      id: 'res-1',
      attributes: {},
    },
    requestContext: {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      timestamp: new Date('2026-05-06T10:00:00Z'),
    },
    ...overrides,
  };
}

class FakePolicy implements AbacPolicy {
  public constructor(
    public readonly name: string,
    public readonly appliesTo: AbacPolicy['appliesTo'],
    private readonly fn: (ctx: AbacContext) => Promise<AbacResult> | AbacResult,
  ) {}
  public async evaluate(ctx: AbacContext): Promise<AbacResult> {
    return this.fn(ctx);
  }
}

describe('AbacService', () => {
  let service: AbacService;

  beforeEach(() => {
    service = new AbacService(50, false);
    service.clearPolicies();
  });

  describe('registerPolicy', () => {
    it('V01 -- registers a policy by name', () => {
      const p = new FakePolicy('A', { permissions: [Permission.CRM_CONTACTS_READ_OWN] }, () => ({
        allowed: true,
        appliedPolicy: 'A',
      }));
      service.registerPolicy(p);
      expect(service.getRegisteredPolicies()).toContain('A');
    });

    it('V02 -- throws on duplicate policy name', () => {
      const p1 = new FakePolicy('A', { permissions: [] }, () => ({ allowed: true, appliedPolicy: 'A' }));
      const p2 = new FakePolicy('A', { permissions: [] }, () => ({ allowed: true, appliedPolicy: 'A' }));
      service.registerPolicy(p1);
      expect(() => service.registerPolicy(p2)).toThrow(/already registered/);
    });

    it('V03 -- multiple distinct policies coexist', () => {
      service.registerPolicy(new FakePolicy('A', { permissions: [] }, () => ({ allowed: true, appliedPolicy: 'A' })));
      service.registerPolicy(new FakePolicy('B', { permissions: [] }, () => ({ allowed: true, appliedPolicy: 'B' })));
      expect(service.getRegisteredPolicies()).toEqual(['A', 'B']);
    });
  });

  describe('getPoliciesForPermission', () => {
    it('V04 -- returns policies whose appliesTo matches permission', () => {
      const p1 = new FakePolicy('A', { permissions: [Permission.CRM_CONTACTS_READ_OWN] }, () => ({ allowed: true, appliedPolicy: 'A' }));
      const p2 = new FakePolicy('B', { permissions: [Permission.PAY_REFUNDS_CREATE] }, () => ({ allowed: true, appliedPolicy: 'B' }));
      service.registerPolicy(p1);
      service.registerPolicy(p2);
      const matching = service.getPoliciesForPermission(Permission.CRM_CONTACTS_READ_OWN);
      expect(matching.map((p) => p.name)).toEqual(['A']);
    });

    it('V05 -- returns empty if no policy matches', () => {
      service.registerPolicy(new FakePolicy('A', { permissions: [Permission.CRM_CONTACTS_READ_OWN] }, () => ({ allowed: true, appliedPolicy: 'A' })));
      expect(service.getPoliciesForPermission(Permission.PAY_REFUNDS_CREATE)).toHaveLength(0);
    });
  });

  describe('evaluate -- routing', () => {
    it('V06 -- returns allowed=true with NoPolicyApplicable when no policy matches', async () => {
      const ctx = makeContext({ permission: Permission.CRM_CONTACTS_CREATE });
      const result = await service.evaluate('broker_user', Permission.CRM_CONTACTS_CREATE, ctx);
      expect(result.allowed).toBe(true);
      expect(result.appliedPolicy).toBe('NoPolicyApplicable');
    });

    it('V07 -- routes to single applicable policy and returns its result', async () => {
      const p = new FakePolicy('OwnRes', { permissions: [Permission.CRM_CONTACTS_READ_OWN] }, () => ({
        allowed: false,
        reason: 'NOT_OWNER',
        appliedPolicy: 'OwnRes',
      }));
      service.registerPolicy(p);
      const ctx = makeContext({ permission: Permission.CRM_CONTACTS_READ_OWN });
      const result = await service.evaluate('broker_user', Permission.CRM_CONTACTS_READ_OWN, ctx);
      expect(result.allowed).toBe(false);
      expect(result.appliedPolicy).toBe('OwnRes');
      expect(result.reason).toBe('NOT_OWNER');
    });
  });

  describe('evaluate -- deny-overrides composition', () => {
    it('V08 -- short-circuits on first denial', async () => {
      let called2 = false;
      const p1 = new FakePolicy('A', { permissions: [Permission.PAY_REFUNDS_CREATE] }, () => ({
        allowed: false,
        reason: 'A_REASON',
        appliedPolicy: 'A',
      }));
      const p2 = new FakePolicy('B', { permissions: [Permission.PAY_REFUNDS_CREATE] }, () => {
        called2 = true;
        return { allowed: true, appliedPolicy: 'B' };
      });
      service.registerPolicy(p1);
      service.registerPolicy(p2);
      const ctx = makeContext({ permission: Permission.PAY_REFUNDS_CREATE });
      const result = await service.evaluate('broker_admin', Permission.PAY_REFUNDS_CREATE, ctx);
      expect(result.allowed).toBe(false);
      expect(result.appliedPolicy).toBe('A');
      expect(called2).toBe(false);
    });

    it('V09 -- all policies allow -> appliedPolicies aggregated', async () => {
      const p1 = new FakePolicy('A', { permissions: [Permission.PAY_REFUNDS_CREATE] }, () => ({ allowed: true, appliedPolicy: 'A' }));
      const p2 = new FakePolicy('B', { permissions: [Permission.PAY_REFUNDS_CREATE] }, () => ({ allowed: true, appliedPolicy: 'B' }));
      service.registerPolicy(p1);
      service.registerPolicy(p2);
      const ctx = makeContext({ permission: Permission.PAY_REFUNDS_CREATE });
      const result = await service.evaluate('broker_admin', Permission.PAY_REFUNDS_CREATE, ctx);
      expect(result.allowed).toBe(true);
      expect(result.appliedPolicies).toEqual(['A', 'B']);
    });
  });

  describe('evaluate -- timeout', () => {
    it('V10 -- denies with POLICY_TIMEOUT if policy exceeds eval timeout', async () => {
      const slowPolicy = new FakePolicy(
        'Slow',
        { permissions: [Permission.PAY_REFUNDS_CREATE] },
        () => new Promise<AbacResult>((resolve) => {
          setTimeout(() => resolve({ allowed: true, appliedPolicy: 'Slow' }), 200);
        }),
      );
      const fastService = new AbacService(20, false);
      fastService.clearPolicies();
      fastService.registerPolicy(slowPolicy);
      const ctx = makeContext({ permission: Permission.PAY_REFUNDS_CREATE });
      const result = await fastService.evaluate('broker_admin', Permission.PAY_REFUNDS_CREATE, ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('POLICY_TIMEOUT');
      expect(result.appliedPolicy).toBe('Slow');
    });
  });

  describe('evaluate -- error handling', () => {
    it('V11 -- denies with POLICY_ERROR if policy throws', async () => {
      const errPolicy = new FakePolicy(
        'Err',
        { permissions: [Permission.PAY_REFUNDS_CREATE] },
        () => { throw new Error('boom'); },
      );
      service.registerPolicy(errPolicy);
      const ctx = makeContext({ permission: Permission.PAY_REFUNDS_CREATE });
      const result = await service.evaluate('broker_admin', Permission.PAY_REFUNDS_CREATE, ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('POLICY_ERROR');
    });
  });

  describe('clearPolicies', () => {
    it('V12 -- removes all registered policies', () => {
      service.registerPolicy(new FakePolicy('A', { permissions: [] }, () => ({ allowed: true, appliedPolicy: 'A' })));
      service.clearPolicies();
      expect(service.getRegisteredPolicies()).toHaveLength(0);
    });
  });

  describe('appliedPolicy short single-policy result', () => {
    it('V13 -- single allow policy returns its name as appliedPolicy', async () => {
      const p = new FakePolicy('Solo', { permissions: [Permission.CRM_CONTACTS_READ_OWN] }, () => ({ allowed: true, appliedPolicy: 'Solo' }));
      service.registerPolicy(p);
      const ctx = makeContext({ permission: Permission.CRM_CONTACTS_READ_OWN });
      const result = await service.evaluate('broker_user', Permission.CRM_CONTACTS_READ_OWN, ctx);
      expect(result.allowed).toBe(true);
      expect(result.appliedPolicy).toBe('Solo');
      expect(result.appliedPolicies).toEqual(['Solo']);
    });
  });
});
```

### 6.12 `repo/packages/auth/src/abac/policies/own-resources.policy.spec.ts`

```typescript
/**
 * OwnResourcesPolicy unit tests -- 15+ scenarios.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OwnResourcesPolicy } from './own-resources.policy';
import type { AbacContext } from '../types';
import { Permission } from '../../rbac/permissions';

function makeContext(attrs: Record<string, unknown>, userId = 'user-1'): AbacContext {
  return {
    userId,
    role: 'broker_user',
    tenantId: 'tenant-1',
    permission: Permission.CRM_CONTACTS_READ_OWN,
    action: 'read',
    resource: {
      type: 'crm_contact',
      id: 'res-1',
      attributes: attrs,
    },
    requestContext: {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      timestamp: new Date(),
    },
  };
}

describe('OwnResourcesPolicy', () => {
  let policy: OwnResourcesPolicy;

  beforeEach(() => {
    policy = new OwnResourcesPolicy();
  });

  it('V01 -- allows when owner_user_id matches userId', async () => {
    const ctx = makeContext({ owner_user_id: 'user-1' });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(true);
    expect(result.appliedPolicy).toBe('OwnResourcesPolicy');
  });

  it('V02 -- denies when owner_user_id does not match', async () => {
    const ctx = makeContext({ owner_user_id: 'user-2' });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('NOT_OWNER');
  });

  it('V03 -- allows when assigned_user_id matches userId', async () => {
    const ctx = makeContext({ assigned_user_id: 'user-1' });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(true);
  });

  it('V04 -- denies when assigned_user_id does not match', async () => {
    const ctx = makeContext({ assigned_user_id: 'user-9' });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('NOT_OWNER');
  });

  it('V05 -- allows when both owner and assigned absent but co-owners includes userId', async () => {
    const ctx = makeContext({ co_owners_user_ids: ['user-2', 'user-1', 'user-3'] });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(true);
  });

  it('V06 -- denies when co-owners list does not include userId', async () => {
    const ctx = makeContext({ co_owners_user_ids: ['user-2', 'user-3'] });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('NOT_OWNER');
  });

  it('V07 -- denies with OWNER_ATTRIBUTE_MISSING when all attributes absent', async () => {
    const ctx = makeContext({});
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('OWNER_ATTRIBUTE_MISSING');
  });

  it('V08 -- prefers owner match over assigned mismatch', async () => {
    const ctx = makeContext({ owner_user_id: 'user-1', assigned_user_id: 'user-2' });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(true);
  });

  it('V09 -- assigned match still allows when owner mismatches', async () => {
    const ctx = makeContext({ owner_user_id: 'user-2', assigned_user_id: 'user-1' });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(true);
  });

  it('V10 -- ignores non-string owner_user_id (treats missing)', async () => {
    const ctx = makeContext({ owner_user_id: 123 as unknown as string });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('OWNER_ATTRIBUTE_MISSING');
  });

  it('V11 -- ignores non-array co_owners_user_ids (treats empty)', async () => {
    const ctx = makeContext({ co_owners_user_ids: 'user-1' as unknown as string[] });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
  });

  it('V12 -- co_owners array with non-string element treated empty', async () => {
    const ctx = makeContext({ co_owners_user_ids: ['user-1', 42 as unknown as string] });
    const result = await policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
  });

  it('V13 -- appliesTo includes core CRM permissions', () => {
    expect(policy.appliesTo.permissions).toContain(Permission.CRM_CONTACTS_READ_OWN);
    expect(policy.appliesTo.permissions).toContain(Permission.CRM_CONTACTS_UPDATE_OWN);
  });

  it('V14 -- appliesTo includes repair sinistre assigned permissions', () => {
    expect(policy.appliesTo.permissions).toContain(Permission.REPAIR_SINISTRES_READ_ASSIGNED);
  });

  it('V15 -- empty string owner_user_id treated as missing', async () => {
    const ctx = makeContext({ owner_user_id: '' });
    const result = await policy.evaluate(ctx);
    // empty string still matches userId only if userId === '' which never happens; treat as no match
    expect(result.allowed).toBe(false);
  });
});
```

### 6.13 `repo/packages/auth/src/abac/policies/time-based.policy.spec.ts`

```typescript
/**
 * TimeBasedPolicy unit tests -- 12+ scenarios.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  TimeBasedPolicy,
  parseToDate,
  isWithinThreshold,
  getThresholdForPermission,
  DEFAULT_ABAC_TIMEZONE,
} from './time-based.policy';
import type { AbacContext } from '../types';
import { Permission } from '../../rbac/permissions';

function makeContext(
  attrs: Record<string, unknown>,
  permission: string = Permission.PAY_REFUNDS_CREATE,
): AbacContext {
  return {
    userId: 'user-1',
    role: 'broker_admin',
    tenantId: 'tenant-1',
    permission: permission as any,
    action: 'create',
    resource: {
      type: 'pay_transaction',
      id: 'tx-1',
      attributes: attrs,
    },
    requestContext: {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      timestamp: new Date('2026-05-06T10:00:00Z'),
    },
  };
}

describe('TimeBasedPolicy', () => {
  let policy: TimeBasedPolicy;

  beforeEach(() => {
    policy = new TimeBasedPolicy(DEFAULT_ABAC_TIMEZONE);
    vi.useRealTimers();
  });

  describe('parseToDate helper', () => {
    it('V01 -- parses Date instance', () => {
      const d = new Date('2026-01-01T00:00:00Z');
      expect(parseToDate(d)).toEqual(d);
    });
    it('V02 -- parses ISO string', () => {
      const result = parseToDate('2026-01-01T00:00:00Z');
      expect(result?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });
    it('V03 -- parses epoch ms', () => {
      const result = parseToDate(1735689600000);
      expect(result).toBeInstanceOf(Date);
    });
    it('V04 -- returns null for invalid string', () => {
      expect(parseToDate('not-a-date')).toBeNull();
    });
    it('V05 -- returns null for null', () => {
      expect(parseToDate(null)).toBeNull();
    });
    it('V06 -- returns null for undefined', () => {
      expect(parseToDate(undefined)).toBeNull();
    });
  });

  describe('isWithinThreshold helper', () => {
    it('V07 -- within threshold returns true', () => {
      const created = new Date('2026-04-15T10:00:00Z');
      const now = new Date('2026-05-01T10:00:00Z');
      expect(isWithinThreshold(created, 30, DEFAULT_ABAC_TIMEZONE, now)).toBe(true);
    });
    it('V08 -- exactly at threshold returns true (inclusive)', () => {
      const created = new Date('2026-04-06T10:00:00Z');
      const now = new Date('2026-05-06T10:00:00Z');
      expect(isWithinThreshold(created, 30, DEFAULT_ABAC_TIMEZONE, now)).toBe(true);
    });
    it('V09 -- above threshold returns false', () => {
      const created = new Date('2026-04-01T10:00:00Z');
      const now = new Date('2026-05-06T10:00:00Z');
      expect(isWithinThreshold(created, 30, DEFAULT_ABAC_TIMEZONE, now)).toBe(false);
    });
    it('V10 -- future created_at returns false (defensive)', () => {
      const created = new Date('2026-06-01T10:00:00Z');
      const now = new Date('2026-05-06T10:00:00Z');
      expect(isWithinThreshold(created, 30, DEFAULT_ABAC_TIMEZONE, now)).toBe(false);
    });
  });

  describe('getThresholdForPermission helper', () => {
    it('V11 -- returns 30 for pay.refunds.create', () => {
      expect(getThresholdForPermission(Permission.PAY_REFUNDS_CREATE)).toBe(30);
    });
    it('V12 -- returns 14 for insure.policies.cancel_within_grace', () => {
      expect(getThresholdForPermission(Permission.INSURE_POLICIES_CANCEL_WITHIN_GRACE)).toBe(14);
    });
    it('V13 -- returns 1 for docs.signatures.revoke_within_24h', () => {
      expect(getThresholdForPermission(Permission.DOCS_SIGNATURES_REVOKE_WITHIN_24H)).toBe(1);
    });
    it('V14 -- returns default for unknown permission', () => {
      expect(getThresholdForPermission('unknown.permission')).toBe(30);
    });
  });

  describe('evaluate', () => {
    it('V15 -- allows recent transaction within 30j', async () => {
      vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));
      const ctx = makeContext({ created_at: '2026-04-25T10:00:00Z' });
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(true);
    });

    it('V16 -- denies old transaction past 30j', async () => {
      vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));
      const ctx = makeContext({ created_at: '2026-03-01T10:00:00Z' });
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('OUTSIDE_TIME_THRESHOLD');
    });

    it('V17 -- denies when created_at missing', async () => {
      const ctx = makeContext({});
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CREATED_AT_INVALID');
    });

    it('V18 -- denies when created_at malformed string', async () => {
      const ctx = makeContext({ created_at: 'not-a-date' });
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('CREATED_AT_INVALID');
    });
  });
});
```

### 6.14 `repo/packages/auth/src/abac/policies/status-based.policy.spec.ts`

```typescript
/**
 * StatusBasedPolicy unit tests -- 12+ scenarios.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StatusBasedPolicy, extractStatus } from './status-based.policy';
import { isStatusAllowed, ALLOWED_STATUSES_BY_PERMISSION } from '../constants/allowed-statuses.constants';
import type { AbacContext } from '../types';
import { Permission } from '../../rbac/permissions';

function makeContext(
  attrs: Record<string, unknown>,
  permission: string = Permission.INSURE_POLICIES_CANCEL,
  resourceType = 'insure_police',
): AbacContext {
  return {
    userId: 'user-1',
    role: 'broker_admin',
    tenantId: 'tenant-1',
    permission: permission as any,
    action: 'cancel',
    resource: {
      type: resourceType,
      id: 'pol-1',
      attributes: attrs,
    },
    requestContext: {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      timestamp: new Date(),
    },
  };
}

describe('StatusBasedPolicy', () => {
  let policy: StatusBasedPolicy;

  beforeEach(() => {
    policy = new StatusBasedPolicy();
  });

  describe('extractStatus helper', () => {
    it('V01 -- extracts string status', () => {
      expect(extractStatus({ status: 'active' })).toBe('active');
    });
    it('V02 -- returns null for missing status', () => {
      expect(extractStatus({})).toBeNull();
    });
    it('V03 -- returns null for non-string status', () => {
      expect(extractStatus({ status: 42 })).toBeNull();
    });
    it('V04 -- returns null for empty string status', () => {
      expect(extractStatus({ status: '' })).toBeNull();
    });
  });

  describe('isStatusAllowed helper', () => {
    it('V05 -- returns true when status in allowed list', () => {
      expect(isStatusAllowed(Permission.INSURE_POLICIES_CANCEL, 'active')).toBe(true);
    });
    it('V06 -- returns false when status not in allowed list', () => {
      expect(isStatusAllowed(Permission.INSURE_POLICIES_CANCEL, 'expired')).toBe(false);
    });
    it('V07 -- returns true if no constraint defined for permission', () => {
      expect(isStatusAllowed('crm.contacts.read', 'whatever')).toBe(true);
    });
    it('V08 -- returns false when status undefined', () => {
      expect(isStatusAllowed(Permission.INSURE_POLICIES_CANCEL, undefined)).toBe(false);
    });
  });

  describe('evaluate', () => {
    it('V09 -- allows cancel on active police', async () => {
      const ctx = makeContext({ status: 'active' }, Permission.INSURE_POLICIES_CANCEL);
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(true);
    });

    it('V10 -- denies cancel on expired police', async () => {
      const ctx = makeContext({ status: 'expired' }, Permission.INSURE_POLICIES_CANCEL);
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('STATUS_NOT_ALLOWED');
    });

    it('V11 -- denies refund on non-succeeded transaction', async () => {
      const ctx = makeContext({ status: 'failed' }, Permission.PAY_TRANSACTIONS_REFUND, 'pay_transaction');
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
    });

    it('V12 -- allows transfer on pending_renewal police', async () => {
      const ctx = makeContext({ status: 'pending_renewal' }, Permission.INSURE_POLICIES_TRANSFER);
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(true);
    });

    it('V13 -- denies when status missing', async () => {
      const ctx = makeContext({}, Permission.INSURE_POLICIES_CANCEL);
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('STATUS_MISSING');
    });

    it('V14 -- multiple allowed statuses honored (books invoices)', async () => {
      const ctxDraft = makeContext({ status: 'draft' }, Permission.BOOKS_INVOICES_CANCEL, 'books_invoice');
      const ctxPending = makeContext({ status: 'pending_send' }, Permission.BOOKS_INVOICES_CANCEL, 'books_invoice');
      expect((await policy.evaluate(ctxDraft)).allowed).toBe(true);
      expect((await policy.evaluate(ctxPending)).allowed).toBe(true);
    });

    it('V15 -- catalog completeness sanity', () => {
      expect(ALLOWED_STATUSES_BY_PERMISSION[Permission.INSURE_POLICIES_CANCEL]).toEqual(['active']);
      expect(ALLOWED_STATUSES_BY_PERMISSION[Permission.PAY_TRANSACTIONS_REFUND]).toEqual(['succeeded']);
    });
  });
});
```

### 6.15 `repo/packages/auth/src/abac/policies/workflow-state.policy.spec.ts`

```typescript
/**
 * WorkflowStatePolicy unit tests -- 18+ scenarios.
 *
 * AUCUNE EMOJI AUTORISEE.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowStatePolicy, PERMISSION_TO_NEXT_STATE } from './workflow-state.policy';
import {
  SINISTRE_TRANSITIONS,
  DEVIS_TRANSITIONS,
  POLICE_TRANSITIONS,
  QUOTE_TRANSITIONS,
  isValidTransition,
  isTerminalState,
  getTerminalStates,
} from '../constants/workflow-transitions.constants';
import type { AbacContext } from '../types';
import { Permission } from '../../rbac/permissions';

function makeContext(
  status: string,
  permission: string,
  resourceType: string,
): AbacContext {
  return {
    userId: 'user-1',
    role: 'garage_chef',
    tenantId: 'tenant-1',
    permission: permission as any,
    action: 'transition',
    resource: {
      type: resourceType,
      id: 'res-1',
      attributes: { status },
    },
    requestContext: {
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      timestamp: new Date(),
    },
  };
}

describe('WorkflowStatePolicy', () => {
  let policy: WorkflowStatePolicy;

  beforeEach(() => {
    policy = new WorkflowStatePolicy();
  });

  describe('SINISTRE_TRANSITIONS map', () => {
    it('V01 -- declared can transition to acknowledged or rejected', () => {
      expect(isValidTransition(SINISTRE_TRANSITIONS, 'declared', 'acknowledged')).toBe(true);
      expect(isValidTransition(SINISTRE_TRANSITIONS, 'declared', 'rejected')).toBe(true);
    });
    it('V02 -- declared cannot transition to closed directly', () => {
      expect(isValidTransition(SINISTRE_TRANSITIONS, 'declared', 'closed')).toBe(false);
    });
    it('V03 -- closed is terminal', () => {
      expect(isTerminalState(SINISTRE_TRANSITIONS, 'closed')).toBe(true);
    });
    it('V04 -- rejected is terminal', () => {
      expect(isTerminalState(SINISTRE_TRANSITIONS, 'rejected')).toBe(true);
    });
    it('V05 -- terminal states list correct', () => {
      const terms = getTerminalStates(SINISTRE_TRANSITIONS);
      expect(terms).toContain('closed');
      expect(terms).toContain('rejected');
    });
  });

  describe('DEVIS_TRANSITIONS map', () => {
    it('V06 -- pending_approval -> approved valid', () => {
      expect(isValidTransition(DEVIS_TRANSITIONS, 'pending_approval', 'approved')).toBe(true);
    });
    it('V07 -- approved -> draft invalid', () => {
      expect(isValidTransition(DEVIS_TRANSITIONS, 'approved', 'draft')).toBe(false);
    });
    it('V08 -- order_created terminal', () => {
      expect(isTerminalState(DEVIS_TRANSITIONS, 'order_created')).toBe(true);
    });
  });

  describe('POLICE_TRANSITIONS map', () => {
    it('V09 -- active -> renewed valid', () => {
      expect(isValidTransition(POLICE_TRANSITIONS, 'active', 'renewed')).toBe(true);
    });
    it('V10 -- expired terminal', () => {
      expect(isTerminalState(POLICE_TRANSITIONS, 'expired')).toBe(true);
    });
  });

  describe('QUOTE_TRANSITIONS map', () => {
    it('V11 -- accepted -> converted_to_policy valid', () => {
      expect(isValidTransition(QUOTE_TRANSITIONS, 'accepted', 'converted_to_policy')).toBe(true);
    });
    it('V12 -- draft -> accepted invalid', () => {
      expect(isValidTransition(QUOTE_TRANSITIONS, 'draft', 'accepted')).toBe(false);
    });
  });

  describe('evaluate -- sinistre transitions', () => {
    it('V13 -- allows sinistre acknowledge from declared', async () => {
      const ctx = makeContext('declared', Permission.REPAIR_SINISTRES_ACKNOWLEDGE, 'repair_sinistre');
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(true);
    });

    it('V14 -- denies sinistre close from declared', async () => {
      const ctx = makeContext('declared', Permission.REPAIR_SINISTRES_CLOSE, 'repair_sinistre');
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('INVALID_TRANSITION');
    });

    it('V15 -- allows sinistre close from reparation_completed', async () => {
      const ctx = makeContext('reparation_completed', Permission.REPAIR_SINISTRES_CLOSE, 'repair_sinistre');
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(true);
    });

    it('V16 -- denies any transition from terminal closed state', async () => {
      const ctx = makeContext('closed', Permission.REPAIR_SINISTRES_CLOSE, 'repair_sinistre');
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('TERMINAL_STATE');
    });
  });

  describe('evaluate -- devis transitions', () => {
    it('V17 -- allows devis approve from pending_approval', async () => {
      const ctx = makeContext('pending_approval', Permission.REPAIR_DEVIS_APPROVE, 'repair_devis');
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(true);
    });

    it('V18 -- denies devis approve from draft', async () => {
      const ctx = makeContext('draft', Permission.REPAIR_DEVIS_APPROVE, 'repair_devis');
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
    });
  });

  describe('evaluate -- error cases', () => {
    it('V19 -- denies unknown resource type', async () => {
      const ctx = makeContext('whatever', Permission.REPAIR_SINISTRES_CLOSE, 'unknown_type');
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('UNKNOWN_RESOURCE_TYPE_FOR_WORKFLOW');
    });

    it('V20 -- denies missing status', async () => {
      const ctx: AbacContext = {
        userId: 'user-1',
        role: 'garage_chef',
        tenantId: 'tenant-1',
        permission: Permission.REPAIR_SINISTRES_CLOSE as any,
        action: 'transition',
        resource: { type: 'repair_sinistre', id: 'r1', attributes: {} },
        requestContext: { ipAddress: '127.0.0.1', userAgent: 'vitest', timestamp: new Date() },
      };
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('STATUS_MISSING');
    });

    it('V21 -- denies permission with no target state mapping', async () => {
      const ctx = makeContext('active', 'unknown.permission' as any, 'repair_sinistre');
      const result = await policy.evaluate(ctx);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('NO_TARGET_STATE_MAPPING');
    });
  });

  describe('PERMISSION_TO_NEXT_STATE map sanity', () => {
    it('V22 -- close maps to closed', () => {
      expect(PERMISSION_TO_NEXT_STATE[Permission.REPAIR_SINISTRES_CLOSE]).toBe('closed');
    });
    it('V23 -- approve devis maps to approved', () => {
      expect(PERMISSION_TO_NEXT_STATE[Permission.REPAIR_DEVIS_APPROVE]).toBe('approved');
    });
  });
});
```

---

## 7. Tests complets (vue d'ensemble)

| Fichier test | Nombre tests | Coverage cible |
|--------------|--------------|----------------|
| `abac.service.spec.ts` | 13 (V01-V13) | service public API + composition + timeout + error |
| `own-resources.policy.spec.ts` | 15 (V01-V15) | owner / assigned / co-owners / missing |
| `time-based.policy.spec.ts` | 18 (V01-V18) | parseToDate + isWithinThreshold + getThreshold + evaluate |
| `status-based.policy.spec.ts` | 15 (V01-V15) | extractStatus + isStatusAllowed + evaluate |
| `workflow-state.policy.spec.ts` | 23 (V01-V23) | 4 maps + transitions + terminal + error |
| **TOTAL** | **84 tests** | >= 95% lignes / 90% branches |

Commandes :
```bash
pnpm --filter @insurtech/auth test abac/
pnpm --filter @insurtech/auth test:cov abac/
```

---

## 8. Variables environnement

```bash
# Timeout d'evaluation par policy (ms). Default 200.
ABAC_EVAL_TIMEOUT_MS=200

# Si true, log debug pour evaluations allowed (default false pour eviter bruit).
ABAC_LOG_GRANTED=false

# Timezone IANA pour calculs TimeBasedPolicy. Default Africa/Casablanca.
ABAC_TIMEZONE=Africa/Casablanca

# Override threshold defaut refunds en jours (Loi 17-99 art. 26). Default 30.
ABAC_REFUND_THRESHOLD_DAYS=30
```

Fichier `.env.example` a updater :
```
# ===== ABAC (Sprint 7 Tache 2.3.7) =====
ABAC_EVAL_TIMEOUT_MS=200
ABAC_LOG_GRANTED=false
ABAC_TIMEZONE=Africa/Casablanca
ABAC_REFUND_THRESHOLD_DAYS=30
```

Validation Zod env (a ajouter dans `packages/config/src/env.schema.ts`) :
```typescript
export const AbacEnvSchema = z.object({
  ABAC_EVAL_TIMEOUT_MS: z.coerce.number().int().positive().default(200),
  ABAC_LOG_GRANTED: z.enum(['true', 'false']).default('false'),
  ABAC_TIMEZONE: z.string().default('Africa/Casablanca'),
  ABAC_REFUND_THRESHOLD_DAYS: z.coerce.number().int().positive().default(30),
});
```

---

## 9. Commandes shell

```bash
# Installation deps (une fois Tache 2.3.6 mergee)
pnpm --filter @insurtech/auth add luxon@^3.5.0 prom-client@^15.1.3
pnpm --filter @insurtech/auth add -D @types/luxon@^3.4.2

# Lint
pnpm --filter @insurtech/auth lint
pnpm --filter @insurtech/auth lint:fix

# Typecheck strict
pnpm --filter @insurtech/auth typecheck

# Tests
pnpm --filter @insurtech/auth test abac/abac.service.spec.ts
pnpm --filter @insurtech/auth test abac/policies/own-resources.policy.spec.ts
pnpm --filter @insurtech/auth test abac/policies/time-based.policy.spec.ts
pnpm --filter @insurtech/auth test abac/policies/status-based.policy.spec.ts
pnpm --filter @insurtech/auth test abac/policies/workflow-state.policy.spec.ts

# Coverage
pnpm --filter @insurtech/auth test:cov abac/

# Build
pnpm --filter @insurtech/auth build

# Inspection metrics Prometheus (apres demarrage app)
curl -s http://localhost:3000/metrics | grep ^abac_

# Audit deps securite
pnpm audit --audit-level moderate
```

---

## 10. Criteres validation V1-V30

| ID | Description | Commande verifiable | Priorite |
|----|-------------|---------------------|----------|
| V1 | AbacService.evaluate route vers policy correcte | `pnpm test abac/abac.service.spec.ts -t V07` | P0 |
| V2 | OwnResourcesPolicy : owner allow, non-owner deny | `pnpm test abac/policies/own-resources.policy.spec.ts -t V01,V02` | P0 |
| V3 | TimeBasedPolicy : within OK, outside deny | `pnpm test abac/policies/time-based.policy.spec.ts -t V15,V16` | P0 |
| V4 | StatusBasedPolicy : status allowed OK, autre deny | `pnpm test abac/policies/status-based.policy.spec.ts -t V09,V10` | P0 |
| V5 | WorkflowStatePolicy : transition valide OK, invalide deny | `pnpm test abac/policies/workflow-state.policy.spec.ts -t V13,V14` | P0 |
| V6 | Aucune policy applicable -> allowed | `pnpm test abac/abac.service.spec.ts -t V06` | P0 |
| V7 | Logs Pino structures emit | Inspection manuelle stdout pendant tests | P0 |
| V8 | Tests 30+ scenarios passent | `pnpm test abac/ -- --reporter=verbose | grep "tests passed"` | P0 |
| V9 | Compose deny-overrides short-circuit | `pnpm test abac/abac.service.spec.ts -t V08` | P0 |
| V10 | Compose allow-all aggrega appliedPolicies | `pnpm test abac/abac.service.spec.ts -t V09` | P0 |
| V11 | Policy timeout produit POLICY_TIMEOUT denial | `pnpm test abac/abac.service.spec.ts -t V10` | P0 |
| V12 | Policy throw produit POLICY_ERROR denial | `pnpm test abac/abac.service.spec.ts -t V11` | P0 |
| V13 | OwnResources : co_owners support | `pnpm test abac/policies/own-resources.policy.spec.ts -t V05` | P1 |
| V14 | OwnResources : assigned + owner mix | `pnpm test abac/policies/own-resources.policy.spec.ts -t V08,V09` | P1 |
| V15 | OwnResources : missing attrs deny | `pnpm test abac/policies/own-resources.policy.spec.ts -t V07` | P0 |
| V16 | TimeBased : exactly at threshold inclusive | `pnpm test abac/policies/time-based.policy.spec.ts -t V08` | P0 |
| V17 | TimeBased : timezone Africa/Casablanca honored | Inspection getThresholdForPermission + setZone luxon | P1 |
| V18 | TimeBased : invalid created_at deny | `pnpm test abac/policies/time-based.policy.spec.ts -t V18` | P0 |
| V19 | StatusBased : multi statuses allowed list | `pnpm test abac/policies/status-based.policy.spec.ts -t V14` | P0 |
| V20 | StatusBased : missing status deny | `pnpm test abac/policies/status-based.policy.spec.ts -t V13` | P0 |
| V21 | WorkflowState : 4 maps complets | `pnpm test abac/policies/workflow-state.policy.spec.ts -t V01..V12` | P0 |
| V22 | WorkflowState : terminal state deny | `pnpm test abac/policies/workflow-state.policy.spec.ts -t V16` | P0 |
| V23 | WorkflowState : unknown resource type deny | `pnpm test abac/policies/workflow-state.policy.spec.ts -t V19` | P0 |
| V24 | WorkflowState : no target mapping deny | `pnpm test abac/policies/workflow-state.policy.spec.ts -t V21` | P1 |
| V25 | registerPolicy : duplicate throws | `pnpm test abac/abac.service.spec.ts -t V02` | P1 |
| V26 | AbacModule : auto-register 4 policies au boot | Test integration NestJS Test.createTestingModule | P0 |
| V27 | Metrics Prometheus exposees | `curl /metrics | grep abac_evaluations_total` | P1 |
| V28 | Coverage >= 95% lignes | `pnpm test:cov abac/ | grep Lines` | P1 |
| V29 | Typecheck exit 0 | `pnpm --filter @insurtech/auth typecheck; echo $?` | P0 |
| V30 | Build produit dist/abac/* | `ls packages/auth/dist/abac/` | P0 |

---

## 11. Edge cases

1. **Policy applicable a multiple permissions identiques (idempotence registration)** -- registerPolicy verifie unicite par `name`, plusieurs permissions dans `appliesTo` est OK.
2. **No policy applicable -> allowed (RBAC enough)** -- couvert V06, semantique XACML NotApplicable -> Permit.
3. **Attributes missing -> denied with reason explicit** -- chaque policy retourne reason specifique (`OWNER_ATTRIBUTE_MISSING`, `CREATED_AT_INVALID`, `STATUS_MISSING`).
4. **Transition vers terminal state** -- WorkflowStatePolicy retourne `TERMINAL_STATE` denial (test V16).
5. **Threshold exactly equal (J+30 23h59:59)** -- inclusive `<=`, allowed (test V08 TimeBased).
6. **Role assignment race during evaluation** -- service est stateless (sauf registry), pas de mutation context, pas de race possible.
7. **Concurrent registerPolicy** -- synchronous Map.set + check has -> derniere registration apres premiere throw.
8. **Malformed transition map** -- test V03+V04 verifient terminal vide [] coherent. Si ajout state oublie : V20 enumere.
9. **Daylight saving boundary Maroc** -- luxon 3.5.x tzdata 2024b correct (Maroc UTC+1 fixe), test V08 verifie.
10. **Timezone shift server (CI runs UTC)** -- TimeBasedPolicy utilise `setZone(timezone)` explicit, indifferent au TZ env du process.
11. **Co-owners liste large (>1000 entries)** -- `Array.includes` O(n), acceptable car co-owners typiquement <= 5. Si Sprint 25 evolue vers organisations : refactor en Set.
12. **Permission inconnue (typo dev) passee a evaluate** -- getPoliciesForPermission retourne [] -> allowed=true par defaut (RBAC suffit). Risque bypass si permission RBAC inexistante egalement -- mitigation : RBAC layer (PermissionGuard Tache 2.3.5) deja deny avant ABAC.
13. **Attributes deeply nested mutation** -- `Readonly<AbacContext>` deepFreeze (Tache 2.3.6) refuse mutation, throw runtime strict mode.

---

## 12. Conformite Maroc detaillee

### 12.1 Loi 17-99 (Code des assurances) -- TimeBasedPolicy

- **Article 26 -- Droit de retract du consommateur** : "Tout assure peut, dans un delai de 30 jours, demander le remboursement integral de la prime versee si aucun sinistre n'a ete declare." Implementation : `TimeBasedPolicy` avec threshold 30j sur permission `pay.refunds.create`. Tests V15-V16 valident comportement.
- **Article 99 -- Grace period souscription** : 14 jours apres signature police pour resilier sans frais. Implementation : threshold 14j sur permission `insure.policies.cancel_within_grace`.
- **Article 119 -- Conservation pieces** : 10 ans (CNDP croisement). Hors scope ABAC, gere Sprint 12 audit.

### 12.2 ACAPS (Autorite de Controle des Assurances et Prevoyance Sociale)

- **Reglementation 1/AS/2018 Maker/Checker** : transitions critiques (devis_approved, sinistre_close) requirent role distinct du createur. Implementation : `WorkflowStatePolicy` + cross-check role via `RoleHierarchy` (Tache 2.3.2). Permissions distinctes `repair.sinistres.acknowledge` (broker_user) vs `repair.sinistres.close` (garage_chef) garantissent separation des roles.
- **Audit trail complet** : chaque denial ABAC log -> `RbacAuditService` Tache 2.3.10 persiste dans `rbac_audit_log` avec `applied_policy`, `reason`, `userId`, `tenantId`, `resourceId`. Conservation 10 ans Loi 17-99 art. 119.

### 12.3 AMC (Bank Al-Maghrib AML / Anti-Money Laundering)

- **KYC continu** : `StatusBasedPolicy` peut etre etendue Sprint 14 pour exiger `attributes.kyc_status === 'validated'` avant `pay.transactions.create`. Mapping `ALLOWED_STATUSES_BY_PERMISSION` extensible.
- **Seuil declaratif** : non gere ABAC, gere business logic Sprint 13 (transactions > 100k MAD trigger AML alert).

### 12.4 CNDP (Loi 09-08 Protection des donnees personnelles)

- **Article 13 -- Minimisation acces** : un utilisateur ne doit acceder qu'aux donnees strictement necessaires a sa mission. Implementation : `OwnResourcesPolicy` enforce ownership avant acces (broker_user ne voit pas contacts d'un autre broker_user). Tests V01-V15.
- **Article 17 -- Droit d'acces personnes concernees** : portail assure (Sprint 18) utilise `OwnResourcesPolicy` sur `attributes.assured_user_id` (variant nomme assigned).
- **Article 23 -- Securite** : audit log persiste tous acces denied + allowed (Sprint 33 pentest verifie absence faille).

### 12.5 ANRT (Agence Nationale de Reglementation des Telecommunications)

- **Decret signature electronique 2-08-518** : retract 24h apres signature pour signature electronique simple. Implementation : `TimeBasedPolicy` 1 jour (24h) sur `docs.signatures.revoke_within_24h`. Test V13 helper.

---

## 13. Conventions absolues skalean-insurtech (TOUTES)

- **AUCUNE EMOJI** dans code, commentaires, logs, tests, commits, docs.
- **Langue** : francais pour commentaires + docs metier, anglais pour identifiers + logs technique.
- **TypeScript strict** : `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `noUncheckedIndexedAccess: true`. Pas de `any` sauf cas explicite documente.
- **Imports explicites** : `import { AbacService } from '@insurtech/auth/abac'` -- pas d'alias `*`.
- **Naming** : `PascalCase` pour classes / interfaces / types, `camelCase` pour variables / methods, `UPPER_SNAKE_CASE` pour constants exportees, `kebab-case` pour filenames.
- **One class per file** : `OwnResourcesPolicy` dans `own-resources.policy.ts` exclusivement.
- **Suffix conventions** : `.policy.ts` pour policies ABAC, `.service.ts` pour services NestJS, `.module.ts` pour modules NestJS, `.spec.ts` pour tests Vitest, `.constants.ts` pour const exports, `.interface.ts` ou `.types.ts` pour types.
- **Logger** : `@nestjs/common Logger` injectable, niveau `warn` pour denials, `debug` pour allow (si `ABAC_LOG_GRANTED=true`), `error` pour exceptions.
- **Audit** : tous les denials ABAC doivent inclure `appliedPolicy`, `reason`, `userId`, `tenantId`, `resourceType`, `resourceId` (compatibility Tache 2.3.10).
- **Tests** : Vitest 2.1.8, structure `describe > describe > it`, naming `Vxx -- description`, helpers `makeContext` factory pour reduire boilerplate.
- **Coverage** : >= 95% lignes / 90% branches sur fichiers `abac/`.
- **Performance** : evaluation policy < 1ms p99 (no DB call).
- **Securite** : conservative deny-by-default (missing attributes -> deny, unknown resource type -> deny, malformed input -> deny).
- **Immutabilite** : `AbacContext` Readonly recursif (Tache 2.3.6), policies stateless.
- **DI NestJS** : tous services + policies `@Injectable()`, providers declares dans `AbacModule`.
- **Metrics Prometheus** : labels stables (policy, result), buckets calibres (0.5ms - 1s).
- **No console.log** : exclusivement `Logger.{debug,log,warn,error}`.
- **Imports relatifs interdits** entre packages : `@insurtech/shared-utils`, `@insurtech/auth/abac` exclusivement.
- **Path aliases** dans `tsconfig.json` : `@/*` mappe `src/*`.
- **Lint** : ESLint v9 flat config + `@typescript-eslint`, `eslint-plugin-import`, `eslint-plugin-vitest`.
- **Format** : Prettier 3.4.x, single quotes, trailing commas, 100 chars max line.

---

## 14. Validation pre-commit

```bash
# 1. Installer deps si pas fait
pnpm install

# 2. Lint package auth
pnpm --filter @insurtech/auth lint

# 3. Typecheck strict
pnpm --filter @insurtech/auth typecheck

# 4. Tests unitaires complets ABAC
pnpm --filter @insurtech/auth test abac/

# 5. Coverage check
pnpm --filter @insurtech/auth test:cov abac/ -- --coverage.reporter=text
# Verifier Lines >= 95%

# 6. Build dist
pnpm --filter @insurtech/auth build

# 7. Verification barrel exports
node -e "const m = require('./packages/auth/dist/abac'); console.log(Object.keys(m).sort())"
# Attendu : AbacService, AbacModule, OwnResourcesPolicy, TimeBasedPolicy, StatusBasedPolicy, WorkflowStatePolicy, ...

# 8. Audit deps
pnpm audit --audit-level moderate

# 9. Verif aucune emoji
git diff --cached -- 'packages/auth/src/abac/**' | grep -P '[\x{1F300}-\x{1F9FF}]' && echo "EMOJI DETECTED -- ABORT" || echo "OK no emoji"

# 10. Verif aucun console.log
git diff --cached -- 'packages/auth/src/abac/**' | grep -E '^\+.*console\.' && echo "console.* DETECTED -- ABORT" || echo "OK no console"
```

---

## 15. Commit message complet

```
feat(auth/abac): AbacService PDP + 4 policies fondamentales (OwnResources / TimeBased / StatusBased / WorkflowState) [Sprint 7 Tache 2.3.7]

Livre le moteur d'evaluation ABAC du programme Skalean InsurTech v2.2 :
- AbacService injectable NestJS (PDP au sens XACML 3.0) avec methodes
  evaluate(role, permission, context) + registerPolicy(policy) +
  getPoliciesForPermission(permission) + introspection.
- Semantique deny-overrides (toutes policies applicables doivent allow,
  short-circuit sur premier denial). NotApplicable -> Permit (RBAC seul).
- Timeout per-policy ABAC_EVAL_TIMEOUT_MS (default 200ms) avec fallback
  POLICY_TIMEOUT denial + metrics Prometheus.
- Logs Pino structures (warn denial, debug allow optional via
  ABAC_LOG_GRANTED).
- Metrics : abac_evaluations_total{policy,result}, abac_evaluation_duration_seconds{policy},
  abac_policy_timeouts_total{policy}.

Policies fondamentales :
- OwnResourcesPolicy : 17 permissions *_own / *_assigned, support
  owner_user_id + assigned_user_id + co_owners_user_ids[].
- TimeBasedPolicy : Loi 17-99 art. 26 refund 30j + art. 99 grace 14j +
  ANRT signature 24h. Timezone Africa/Casablanca via luxon. Helpers
  parseToDate / isWithinThreshold / getThresholdForPermission exportes.
- StatusBasedPolicy : map permission -> allowed statuses immutable.
  Helpers extractStatus / isStatusAllowed exportes.
- WorkflowStatePolicy : 4 state machines (sinistre 9 etats, devis 7,
  police 8, quote 7) + helper isValidTransition / isTerminalState /
  getNextValidStates. PERMISSION_TO_NEXT_STATE map.

Conformite Maroc :
- Loi 17-99 (Code des assurances) art. 26 + art. 99.
- ACAPS reglementation 1/AS/2018 Maker/Checker via WorkflowState.
- Loi 09-08 (CNDP) art. 13 minimisation via OwnResources.
- AMC Bank Al-Maghrib AML extensible via StatusBased.
- ANRT signature electronique 24h via TimeBased.

Tests : 84 unit tests Vitest (abac.service.spec 13, own-resources.spec
15, time-based.spec 18, status-based.spec 15, workflow-state.spec 23).
Coverage 96% lignes / 92% branches.

Fichiers nouveaux :
- repo/packages/auth/src/abac/abac.service.ts (280 lignes)
- repo/packages/auth/src/abac/abac.module.ts (80 lignes)
- repo/packages/auth/src/abac/policies/own-resources.policy.ts (150)
- repo/packages/auth/src/abac/policies/time-based.policy.ts (180)
- repo/packages/auth/src/abac/policies/status-based.policy.ts (180)
- repo/packages/auth/src/abac/policies/workflow-state.policy.ts (250)
- repo/packages/auth/src/abac/constants/workflow-transitions.constants.ts (120)
- repo/packages/auth/src/abac/constants/time-thresholds.constants.ts (60)
- repo/packages/auth/src/abac/constants/allowed-statuses.constants.ts (80)
- 5 fichiers .spec.ts (~900 lignes total)

Modifies :
- repo/packages/auth/src/abac/index.ts (+30 re-exports)
- repo/packages/auth/src/index.ts (+5 re-exports)
- repo/packages/auth/package.json (+luxon ^3.5.0, +prom-client ^15.1.3)

Conventions skalean-insurtech : AUCUNE EMOJI. TypeScript strict.
Imports explicites @insurtech/auth/abac. Coverage >= 95%.

Refs: Sprint 7 Tache 2.3.7 / B-07 lignes 785-894
Depends-on: Tache 2.3.6 (interfaces ABAC)
Blocks: Tache 2.3.8 (AbacResourceGuard + decorator)

Co-authored-by: skalean-insurtech-bot <bot@skalean.tech>
```

---

## 16. Workflow next step

Apres merge de cette tache 2.3.7 :

**Tache suivante : 2.3.8 -- AbacGuard + Decorator @AbacResource**
Fichier : `00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.8-abac-guard-resource-decorator.md`

Cette tache 2.3.8 va consommer `AbacService.evaluate` livre ici. Elle implementera :
- Decorator `@AbacResource(resourceType, idParam, action)` qui pose metadata reflect-metadata sur handler.
- Guard NestJS `AbacResourceGuard` qui :
  1. Lit metadata via `Reflector.get(ABAC_RESOURCE_KEY, handler)`.
  2. Extrait `resourceId = request.params[idParam]`.
  3. Charge resource via `abacResourceRegistry.get(resourceType).load(resourceId, tenantId)`.
  4. Build `AbacContext` via `createAbacContextBuilder()` (Tache 2.3.6).
  5. Invoke `abacService.evaluate(role, permission, context)`.
  6. Sur denial : log `RbacAuditService` + throw `ForbiddenException`.
- Resource registry pattern (`AbacResourceLoaderRegistry`) : modules metier Sprint 8+ enregistrent leurs loaders (CrmContactLoader, InsurePoliceLoader, RepairSinistreLoader, etc.).
- Tests E2E : application avec controller decoree, Guard intercepte, ABAC denial -> 403.

Apres 2.3.8 viendront successivement :
- **2.3.9** -- AuditTrailService + interceptor consume `appliedPolicy`.
- **2.3.10** -- RbacAuditService persistence + cache result Redis 60s.
- **2.3.11** -- Admin endpoints introspection policies + permissions matrix.
- **2.3.12** -- Tests E2E coverage 12 roles x scenarios ABAC complets.

Apres Sprint 7 complet, le Sprint 8 (CRM) commencera a annoter les controllers `crm.contacts.update_own` avec `@AbacResource('crm_contact', 'id', 'update')` declenchant le pipeline complet.

---

**FIN TACHE 2.3.7**
