# TACHE 2.3.6 -- Types ABAC + Interfaces (AbacContext / AbacPolicy / AbacResult / Resource Types)

**Sprint** : 7 (Phase 2 / Sprint 3 dans phase) -- RBAC Granulaire + ABAC Foundation
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-07-sprint-07-rbac.md` (Tache 2.3.6 lignes 736-783)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour Tache 2.3.7 AbacService + 4 policies, Tache 2.3.8 AbacResourceGuard, Tache 2.3.9 AuditTrailService consume `appliedPolicy`, Tache 2.3.10 RbacAuditService persistence ABAC contexts, Tache 2.3.11 admin endpoints d'introspection policies, Tache 2.3.12 tests E2E coverage 12 roles avec scenarios ABAC ; bloquant indirect pour TOUS les controllers metier Sprint 8+ qui consomment les attributes resource pour decision contextuelle owner/status/time/workflow)
**Effort** : 3h
**Dependances** : Tache 2.3.5 (PermissionGuard livre + decorator metadata pattern + AsyncLocalStorage TenantContext + ExecutionContext extraction helpers + RbacAuditService injection pattern). Tache 2.3.4 (RoleGuard + AuthRole TypeScript type expose). Tache 2.3.3 (RbacService injectable + AccessResult pour pattern Result-typed). Tache 2.3.2 (RoleHierarchy + getEffectivePermissions). Tache 2.3.1 (catalog Permission TypeScript const + Zod schema + PermissionValue type). Sprint 6 complet (TenantContext propage `userId`, `userRole`, `tenantId` via cls-hooked AsyncLocalStorage Sprint 6 Tache 2.6.x). Sprint 1-2 stack (TypeScript 5.7.3 strict, Vitest 2.1.8, NestJS 10.4.x, Pino 9.5.x, Zod 3.24.1, reflect-metadata 0.2.x).
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 2.3.6 vise a livrer le socle TypeScript du sous-systeme ABAC (Attribute-Based Access Control) du programme Skalean InsurTech v2.2 : les **interfaces canoniques `AbacContext`, `AbacPolicy`, `AbacResult`**, leurs **schemas Zod runtime**, leurs **builders type-safe**, ainsi que les **types resource attributes specifiques par module metier** (`CrmContactAttributes`, `InsurePolicyAttributes`, `RepairSinistreAttributes`, `PayTransactionAttributes`, `DocDocumentAttributes`). Ce socle constitue la fondation contractuelle sur laquelle reposent (1) le `AbacService` Tache 2.3.7 qui orchestre l'evaluation, (2) les 4 policies fondamentales (OwnResourcesPolicy, TimeBasedPolicy, StatusBasedPolicy, WorkflowStatePolicy) Tache 2.3.7, (3) le `AbacResourceGuard` Tache 2.3.8 qui charge la resource depuis la DB et invoque le service, (4) la persistence audit ABAC dans `rbac_audit_log.applied_policy` Tache 2.3.10. La motivation strategique est que le RBAC (Tache 2.3.1-2.3.5) ne suffit pas a exprimer les regles d'autorisation contextuelles indispensables a la conformite ACAPS / AMC / CNDP / BAM : un courtier `broker_user` possede bien la permission `crm.contacts.update_own` dans la matrice (Tache 2.3.2), mais cette permission n'a de sens que SI la ressource cible (`crm_contact`) appartient effectivement a cet utilisateur (`contact.owner_user_id === ctx.userId`). Cette evaluation contextuelle ne peut PAS etre encodee dans la matrice RBAC (qui est un mapping role -> permission cardinal sans connaissance de l'instance), elle requiert une couche superieure -- l'ABAC -- qui prend en entree non seulement le couple `(role, permission)` mais aussi les **attributs de la ressource cible**, les **attributs de l'utilisateur courant**, les **attributs de l'environnement** (timestamp, IP, user-agent), et applique des regles policy-driven (`policy.evaluate(context)`) renvoyant un `AbacResult` structure.

L'apport est triple. Premierement, definir ces interfaces formellement en TypeScript strict avec schemas Zod miroirs garantit une **type-safety bout-en-bout** : le compilateur refuse `policy.evaluate({ userId: 123, ... })` si `userId` est typee `string`, le runtime Zod refuse un payload deserialise `{ userId: null, role: 'broker_user', ... }` issu d'un message Kafka audit ou d'un cache Redis corrompu. Cette double protection (compile-time TypeScript + runtime Zod) elimine une classe entiere de bugs ABAC ou un context mal forme conduit a une evaluation false-positive (allowed=true par defaut sur attribute manquant) -- regression securite catastrophique potentielle. Deuxiemement, factoriser les **resource types en union string literal stricte** (`'crm_contact' | 'insure_police' | 'repair_sinistre' | 'pay_transaction' | 'doc_document'`) permet le routing automatique des contexts vers les policies competentes via `appliesTo.resourceTypes` et l'autocomplete IDE complet sur 5 types canoniques. Ce design est extensible : Sprint 14 ajoutera `'insure_quote'`, Sprint 17 ajoutera `'pay_subscription'`, Sprint 24 ajoutera `'mobile_assure_request'` -- l'ajout est local au fichier `resource-types.ts` et propage via union TypeScript a tout le code consommateur. Troisiemement, exposer un **Builder pattern typed** (`AbacContextBuilder.forUser(userId).withRole(role).inTenant(tenantId).onResource(type, id, attrs).performing(action).withRequestContext(ctx).build()`) garantit la construction immutable d'un `AbacContext` valide en eliminant les erreurs de fields oubliees -- le `.build()` final invoque la validation Zod + retourne `Readonly<AbacContext>`. Le builder est test-drivable (chaque step retourne un type intermediaire restreint) et serializable (output JSON pour audit `rbac_audit_log.context_serialized`).

A l'issue de cette tache, le package `@insurtech/auth` expose via `packages/auth/src/abac/index.ts` les artefacts TypeScript suivants : interfaces `AbacContext`, `AbacPolicy`, `AbacResult`, `AllowedResult`, `DeniedResult`, `AbacRequestContext`, `AbacResourceDescriptor`, types/enums `ResourceType` (union + enum companion), `AbacAction` (enum + companion union), `AbacReason` (enum codes denial structures), interfaces resource-specifiques `CrmContactAttributes`, `InsurePolicyAttributes`, `RepairSinistreAttributes`, `PayTransactionAttributes`, `DocDocumentAttributes` (typed-strict alternatives a `Record<string, unknown>`), schemas Zod miroirs `AbacContextSchema`, `AbacResultSchema`, `AbacRequestContextSchema`, `ResourceTypeSchema`, `AbacActionSchema`, builders `AbacContextBuilder` + factory `createAbacContextBuilder()`, helpers `getResourceTypeFromPermission(permission)`, `assertResourceType(value)`, `isAllowedResult(r)`, `isDeniedResult(r)`, `serializeAbacContextForAudit(ctx)`, et constantes `ABAC_POLICY_NAMES`, `RESOURCE_TYPES_LIST`, `ABAC_ACTIONS_LIST`. La commande `pnpm --filter @insurtech/auth test abac/types.spec.ts` execute 25+ tests Vitest verifiant : (a) compilation TypeScript stricte des interfaces, (b) parsing Zod valide / invalide pour AbacContext (10+ scenarios), (c) builder pattern type-safe step-by-step, (d) resource type mapping helpers, (e) serialization JSON deterministe pour audit, (f) coverage des 4 policies cibles Tache 2.3.7. La commande `pnpm --filter @insurtech/auth typecheck` retourne exit code 0. Le total represente environ 1410 lignes TypeScript reparties sur 11 fichiers (types.ts ~250 lignes, resource-types.ts ~150 lignes, abac-context.builder.ts ~180 lignes, abac-context.schema.ts ~120 lignes, abac-policy.interface.ts ~80 lignes, abac-result.types.ts ~100 lignes, abac-resource.types.ts ~150 lignes, abac-action.enum.ts ~80 lignes, types.spec.ts ~200 lignes, abac-context-builder.spec.ts ~120 lignes, resource-types.spec.ts ~80 lignes, index.ts barrel ~50 lignes). Cette tache est P0 absolue car elle conditionne la livraison du `AbacService` (Tache 2.3.7) et des 4 policies fondamentales -- sans interfaces canoniques, le service et les policies sont impossibles a typer correctement, le compilateur ne peut pas catcher les divergences de signature `evaluate()`, le pattern strategy degenere en `any`-driven design. La tache est volontairement **type-only** (zero logique evaluative, qui sera dans Tache 2.3.7) pour respecter la separation Single Responsibility et permettre la revue de code focalisee sur le contrat interface.

---

## 2. Contexte etendu

### 2.1 Pourquoi ABAC en complement du RBAC

Le RBAC livre par les Taches 2.3.1-2.3.5 du Sprint 7 expose un mapping pur `(role) -> Set<PermissionValue>` resolu en O(1) cache-hit (~500 microsec) ou O(log n) cache-miss avec hierarchy walk (~1.5ms). Ce mapping permet de repondre rapidement a la question "le role broker_user possede-t-il la permission `crm.contacts.update` ?". Cette question est suffisante pour les endpoints metier ou TOUTE instance de la ressource est equivalente : un endpoint `GET /api/v1/admin/tenants/:id/health` (Sprint 26) retourne le health du tenant peu importe quel tenant -- le role suffit. Mais elle est insuffisante pour les endpoints metier ou la decision depend de l'instance specifique :

- **Endpoint `PATCH /api/v1/crm/contacts/:id`** invoque par broker_user. La matrice RBAC accorde a broker_user la permission `crm.contacts.update_own` (suffixe `_own`). Cette permission signifie "update SES PROPRES contacts". RBAC seul ne peut PAS verifier la condition d'ownership. ABAC charge le contact via `ContactRepository.findById(:id)`, extrait `contact.owner_user_id`, le compare a `currentUserId`, et statue `allowed = (contact.owner_user_id === currentUserId)`.
- **Endpoint `POST /api/v1/pay/refunds`** invoque par broker_admin sur transaction `:transactionId`. La matrice RBAC accorde a broker_admin la permission `pay.refunds.create`. Mais la loi marocaine 17-99 (droit retract consommateur) impose que le refund n'est legalement valide que si la transaction a moins de 30 jours. ABAC charge la transaction, lit `transaction.created_at`, calcule `now() - created_at`, et statue `allowed = (delta < 30 days)`.
- **Endpoint `POST /api/v1/insure/policies/:id/cancel`** invoque par broker_admin. La matrice RBAC accorde la permission `insure.policies.cancel`. Mais business rule : cancel autorise uniquement si police `status === 'active'` (refus si `expired`, `cancelled`, `quoted`). ABAC charge la police, lit `policy.status`, statue selon liste blanche statuses.
- **Endpoint `POST /api/v1/repair/sinistres/:id/close`** invoque par garage_chef. La matrice RBAC accorde `repair.sinistres.close`. Mais workflow rule : close autorise UNIQUEMENT depuis status `reparation_completed` (refus depuis `declared`, `appointment_scheduled`, etc.). ABAC charge le sinistre, lit `sinistre.status`, verifie transition valide via state machine.

Ces 4 cas constituent les **4 policies fondamentales** Tache 2.3.7 (`OwnResourcesPolicy`, `TimeBasedPolicy`, `StatusBasedPolicy`, `WorkflowStatePolicy`). Ils representent ~80% des regles ABAC du programme Skalean. Les 20% restants (multi-tenant cross-acces, IP whitelisting, MFA elevation, geographic restrictions) seront ajoutes Sprint 25 / Sprint 26 sans rupture de l'interface `AbacPolicy` definie ici -- l'extensibilite est garantie par le contrat `evaluate(context: AbacContext): Promise<AbacResult>` ouvert.

### 2.2 RBAC vs ABAC vs ReBAC vs PBAC -- comparaison detaillee

Le tableau ci-dessous compare les 4 paradigmes d'autorisation evalues avant la decision d'implementer un hybride RBAC + ABAC.

| Paradigme | Definition | Avantages | Inconvenients | Adoption Skalean |
|-----------|-----------|-----------|---------------|------------------|
| **RBAC** (Role-Based Access Control) | Mapping `role -> permissions`. Decision = role possede permission ? | Simple, performant (O(1) cache), audit lisible (matrice statique), familier ops | Inflexible pour regles contextuelles (ownership, status, time), explosion roles si granularite fine ("broker_user_owner_only" vs "broker_user_all") | OUI -- couche fondation Tache 2.3.1-2.3.5 |
| **ABAC** (Attribute-Based Access Control) | Decision = policy.evaluate(subject_attrs, resource_attrs, env_attrs, action) | Tres expressif (regles contextuelles), extensible (ajouter attributs sans reorganiser roles), conforme XACML standard OASIS | Performance (DB load resource avant decision), complexite tests (matrice attributs explose), audit moins lisible (policy code vs matrice) | OUI -- couche overlay sur RBAC, taches 2.3.6-2.3.8 |
| **ReBAC** (Relationship-Based Access Control) | Decision = subject est-il en relation graph avec resource ? (Google Zanzibar / SpiceDB / OpenFGA) | Modele relations complexes (sharing, organization tree, follow), introspection visualisable | Infrastructure dediee (DB graph distribuee), latence reseau, surdimensionne pour use case Skalean | NON -- pas de cas usage justifiant complexite (pas de partage social) |
| **PBAC** (Policy-Based Access Control) | Generalisation ABAC avec language policy externalise (Rego pour OPA, XACML, Cedar AWS) | Decouplage code-policy (devops modify policy sans recompile), language declaratif analyzable | Latence (RPC vers OPA sidecar), language additionnel a maitriser, debugging complique | EVALUE puis REJETE -- voir 2.3 |

Le choix Skalean est un **hybride RBAC + ABAC** ou RBAC reste la couche fondation (rapide, exhaustive en matrice statique 12 roles x 85 permissions) et ABAC est une couche overlay opt-in via le decorator `@AbacResource(resourceType, idParam)` (Tache 2.3.8) qui declenche le chargement de la ressource et l'evaluation policy. La majorite des endpoints (~70%) utilisent uniquement RBAC (pas de decorator ABAC), les 30% restants combinent RBAC + ABAC. Cette architecture preserve la performance globale et limite la complexite aux endpoints qui en ont besoin.

### 2.3 Open Policy Agent (OPA) considere puis rejete

OPA est une solution PBAC mature (CNCF graduated) ou les policies sont exprimees en Rego (language declaratif type Datalog) et evaluees soit en sidecar HTTP/gRPC soit en bibliotheque embedded. Skalean a evalue OPA selon les criteres suivants :

| Critere | OPA | Custom ABAC TypeScript (RETENU) |
|---------|-----|--------------------------------|
| Performance evaluation | Sidecar gRPC ~5ms p99 (network), embedded ~1ms p99 | In-process TypeScript ~0.5ms p99 (zero IPC) |
| Type-safety end-to-end | Aucune (Rego non type, contrat I/O JSON Schema separe) | Complete (interfaces TS + Zod miroir) |
| Debug experience | Rego playground externe, breakpoints difficiles | Breakpoint VSCode TypeScript natif |
| Conformite ACAPS audit | Logs OPA decisions externes, traces hybrid Nest+OPA | Logs Pino structures unifies dans audit pipeline existante |
| Learning curve equipe | 2-3 semaines pour Rego + ops sidecar deploy | Zero (TypeScript familier) |
| Maintenance long terme | Risque divergence Rego policies vs business logic TS | Cohabitation directe avec services TS, refactor IDE-aware |
| Extensibilite custom resource types | Schema JSON -> regen Rego, redeploy sidecar | Ajout type union + interface, redeploy app standard |
| Versioning policies | Bundles OPA versionnes (S3), rollback complique | Git policies code, rollback PR standard |
| Observabilite | OPA metrics Prometheus separe | Integre observability stack Skalean (OpenTelemetry Sprint 22) |
| Risque vendor lock-in | Specifique OPA, migration couteuse | Standard TypeScript, migration triviale |

**Verdict** : OPA serait surdimensionne pour Skalean (les policies sont stables, le besoin "modify policy sans recompile" n'est pas critique car les changements ABAC necessitent revalidation legale ACAPS de toute facon). Le custom ABAC TypeScript offre meilleure performance, type-safety superieure, courbe d'apprentissage zero, et integration native avec le pipeline observability. OPA est **REJETE**. Cette decision est documentee dans `00-pilotage/documentation/decisions/decision-018-no-opa-custom-abac-typescript.md` (a creer Sprint 7 livraison).

### 2.4 Inspirations XACML (eXtensible Access Control Markup Language)

XACML 3.0 (OASIS standard) est le pere conceptuel de l'ABAC. Il definit 4 entites :
- **PEP** (Policy Enforcement Point) : intercepte requete, construit context, demande decision -> dans Skalean, c'est `AbacResourceGuard` Tache 2.3.8.
- **PDP** (Policy Decision Point) : evalue policies, retourne Permit / Deny / NotApplicable / Indeterminate -> dans Skalean, c'est `AbacService` Tache 2.3.7.
- **PIP** (Policy Information Point) : fournit attributs additionnels au PDP a la demande -> dans Skalean, integre dans le repository load resource du Guard (chargement attributs eager).
- **PAP** (Policy Administration Point) : gere lifecycle policies (CRUD, versioning) -> dans Skalean, code Git (pas de DB policies, intentionnellement statiques).

Les concepts cles XACML retenus dans le design Skalean :
- **Context schema canonique** : XACML separe `<Subject>`, `<Resource>`, `<Action>`, `<Environment>`. Skalean reflete via `AbacContext.userId` (subject), `AbacContext.resource` (resource), `AbacContext.action` (action), `AbacContext.requestContext` (environment).
- **Decision enum structure** : XACML retourne `Permit | Deny | NotApplicable | Indeterminate`. Skalean simplifie en `{ allowed: boolean }` car NotApplicable est gere via routing `appliesTo.permissions` (si pas de policy applicable -> RBAC pur suffit, allowed=true), et Indeterminate (erreur evaluation) est gere via try/catch propre dans `AbacService` qui throw.
- **Obligations / Advice** : XACML permet de retourner obligations executables apres decision (ex: log audit). Skalean retire cette feature (audit est cross-cutting via `RbacAuditService` -- pas besoin de retourner obligations).
- **Combining algorithms** : XACML supporte `permit-overrides`, `deny-overrides`, `first-applicable`, etc. Skalean simplifie a `first-applicable-then-stop` (premiere policy applicable decide, pas d'agregation multi-policy) car les regles ne se chevauchent pas dans le design Skalean (chaque permission cible une seule policy).

Les concepts XACML **NON retenus** : XML markup (Skalean utilise TypeScript natif), policies hierarchiques `<PolicySet>` imbriquees (over-engineering), expression language XPath (replaced par TypeScript code dans `evaluate()`).

### 2.5 Trade-off : `Record<string, unknown>` vs strict typed attributes par resource type

La premiere version du design Skalean utilisait `attributes: Record<string, unknown>` pour le champ `AbacContext.resource.attributes` -- maximum flexibilite, aucune contrainte sur les keys ou types. Apres revue securite Sprint 7 V1, cette approche a ete enrichie avec **interfaces strict typed par resource type** (`CrmContactAttributes`, `InsurePolicyAttributes`, etc.) en parallele du `Record` generic. La resolution finale est :

| Approche | Avantages | Inconvenients | Adoption |
|----------|-----------|---------------|----------|
| `Record<string, unknown>` exclusif | Flexibilite extreme, ajout futur sans modif type | Aucune type-safety dans policy.evaluate (`ctx.resource.attributes.owner_user_id as string` partout, casts unsafe, typo non detectee) | Couvre cas dynamiques rares |
| Strict typed exclusif (`CrmContactAttributes`) | Type-safety complete, autocomplete IDE, refactor safe | Rigidite (ajout attribute necessite modif interface + tests + tous policies impactees) | Couvre cas frequents |
| **Hybride : `attributes: Record<string, unknown> & Partial<TypedAttributes>` avec assertion helper** (RETENU) | Flexibilite preservee + type-safety optionnelle via narrowing helper `assertCrmContactAttributes(attrs)` | Necessite discipline equipe (utiliser helper systematiquement) | RETENU -- combine les deux |

L'implementation retenue (cf. Section 7) expose les interfaces typed via `abac-resource.types.ts`, le `Record<string, unknown>` reste le type runtime de `AbacContext.resource.attributes`, et un helper `assertResourceAttributes<T>(attrs, resourceType)` valide+narrowing au point d'usage dans la policy. Exemple :

```typescript
// Dans OwnResourcesPolicy.evaluate (Tache 2.3.7)
const attrs = assertResourceAttributes<CrmContactAttributes>(
  context.resource.attributes,
  'crm_contact',
);
// Maintenant attrs.owner_user_id est typee string (pas unknown)
return { allowed: attrs.owner_user_id === context.userId, ... };
```

### 2.6 Pieges techniques connus (10 pieges critiques documentes)

1. **Piege : `attributes: any` dans Record degenere en bypass type-safety.**
   - Pourquoi : si dev oublie le helper `assertResourceAttributes` et accede directement `ctx.resource.attributes.owner_user_id`, TypeScript autorise (car `unknown` accepte indexation). Mais `unknown !== string`, le test `=== userId` retourne potentiellement `false` meme si `owner_user_id` correct (ex: stocke comme number en DB).
   - Solution : Lint rule `@typescript-eslint/no-unsafe-member-access` sur `ctx.resource.attributes.*` access. Helper assert obligatoire. Documentation README explicit.

2. **Piege : `Date` serialization dans `requestContext.timestamp` perd timezone.**
   - Pourquoi : `JSON.stringify(new Date())` produit string ISO 8601 UTC. Mais `JSON.parse(...)` retourne string, pas Date -- type incoherent apres roundtrip Redis cache ou Kafka audit.
   - Solution : Schema Zod `z.coerce.date()` pour parsing automatique, type interface `Date` (pas `string`), helper `serializeAbacContextForAudit` documente trade-off, tests V11+V12 verifient roundtrip.

3. **Piege : `resource.type` string libre vs union typee.**
   - Pourquoi : si type est `string`, dev peut passer `'CrmContact'` ou `'crm-contact'` au lieu de `'crm_contact'` -- divergence silencieuse, policy ne match jamais via `appliesTo.resourceTypes`.
   - Solution : `ResourceType` union string literal strict + Zod enum + helper `assertResourceType(value)` qui throw explicit si invalid.

4. **Piege : `userId` optional vs required (admin sans tenant context).**
   - Pourquoi : super_admin_platform peut invoquer endpoints sans tenantId pose (routes `/api/v1/admin/*`). Dans ABAC context, `userId` est-il required ? Si yes, super_admin doit toujours en avoir un -- mais si endpoint cron/worker invoque AbacService sans user context, throw incoherent.
   - Solution : `userId: string` required dans interface (tout call ABAC implique un user actif), endpoints cron utilisent role internal `system_worker` (pas de user). Documentation explicit. Tests V13 verifient throw si userId absent.

5. **Piege : `appliedPolicy` dans AbacResult oublie -> audit corrompu.**
   - Pourquoi : si policy returns `{ allowed: false, reason: '...' }` sans `appliedPolicy`, l'audit log Tache 2.3.10 ecrit `applied_policy = NULL` -- conformite ACAPS exige tracabilite "quelle regle a denied". NULL = trou audit.
   - Solution : `appliedPolicy: string` required dans interface (pas optional), Zod schema enforce, helper `createDeniedResult(policyName, reason)` factory qui force le name, tests V14 verifient absence policy throw Zod.

6. **Piege : Builder partial state -> build() avec champs manquants throw runtime mais pas compile.**
   - Pourquoi : Builder pattern naif `withRole(role)` retourne `this`, le `.build()` valide a la fin -- mais TypeScript ne sait pas si `.userId` etait pose. Compile passe, runtime throw.
   - Solution : Phantom types intermediaires (`AbacContextBuilder<HasUserId, HasRole, HasTenantId, HasResource, HasAction>` avec markers `Yes`/`No`) -- chaque `.with*()` retourne builder avec marker `Yes` correspondant. Methode `.build()` n'est exposee que sur `AbacContextBuilder<Yes, Yes, Yes, Yes, Yes>` via type intersection. Compile-error si state incomplet.

7. **Piege : Zod schema strict mode rejette future attributes.**
   - Pourquoi : Sprint 14 ajoute `quote_id` au CrmContactAttributes pour lien CRM-Quote. Si schema Zod est `.strict()`, deserialisation cache Redis stale (avec ancien schema) throws. Si `.passthrough()`, accepte tout (perte controle).
   - Solution : Schema `.passthrough()` defaut + version field `_v: number` dans attributes + migration helper sprint by sprint. Tests V15.

8. **Piege : `AbacContext` non-immutable -> mutation par policy degrade integrity.**
   - Pourquoi : si `policy.evaluate(context)` mute `context.resource.attributes.owner_user_id = currentUserId` (bug ou malveillant), la prochaine policy evaluee voit la mutation -- decision de policy 2 corrompue.
   - Solution : Builder retourne `Readonly<AbacContext>` avec `Object.freeze` recursive (`deepFreeze` helper). Policies recoivent reference immutable. Test V16 verifie throw `Cannot assign to read only property` si tentative mutation.

9. **Piege : Resource type unknown dans permission -> policy ne match jamais.**
   - Pourquoi : helper `getResourceTypeFromPermission('crm.contacts.update_own')` doit retourner `'crm_contact'` (pluriel singularise + namespace mappe). Si dev oublie d'enregistrer mapping pour nouvelle permission `marketing.campaigns.update_own`, helper retourne `null` -- toutes policies skipped, RBAC seul applique (potentiellement bypass faille).
   - Solution : Mapping exhaustif enforce via test V17 (chaque permission `_own` doit avoir resource type mapping). Helper `assertResourceTypeMappingComplete()` au boot module.

10. **Piege : Serialization JSON pour audit perd functions / Date / undefined.**
    - Pourquoi : `JSON.stringify({ ..., timestamp: new Date(), policy: () => {} })` perd la function et serialize Date en string. Si on relit pour replay audit (Sprint 33 pentest), context corrompu.
    - Solution : Helper dedicated `serializeAbacContextForAudit(ctx): AbacContextSerialized` qui (a) convert Date -> ISO 8601 string explicitly, (b) strip functions, (c) ajoute version `_serialized_v: 1` pour migration. Helper miroir `deserializeAbacContextFromAudit(json): AbacContext` pour replay. Tests V18 roundtrip serialize/deserialize identical content.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 2.3.6 est la 6eme tache du Sprint 7 (RBAC Granulaire) et la 28eme tache de la Phase 2. Elle :

- **Depend de** : Tache 2.3.5 (PermissionGuard, decorator metadata, AsyncLocalStorage TenantContext, RbacAuditService injection pattern), Tache 2.3.4 (RoleGuard pattern, AuthRole type), Tache 2.3.3 (RbacService + AccessResult Result-typed pattern), Tache 2.3.2 (RoleHierarchy), Tache 2.3.1 (PermissionValue type + Zod), Sprint 6 complet (TenantContext propagation cls-hooked AsyncLocalStorage), Sprint 1-2 stack (NestJS 10.4.x, TypeScript 5.7.3, Vitest 2.1.8, Pino 9.5.x, reflect-metadata 0.2.x, Zod 3.24.1).
- **Bloque** : Tache 2.3.7 (AbacService consume AbacContext + 4 policies implementent AbacPolicy interface), Tache 2.3.8 (AbacResourceGuard build context via AbacContextBuilder), Tache 2.3.9 (AuditTrail filter consume `appliedPolicy` field pour serialization log), Tache 2.3.10 (RbacAuditService persistence ABAC context dans DB rbac_audit_log), Tache 2.3.11 (admin endpoints introspection policies utilisent ResourceType + AbacAction listings), Tache 2.3.12 (E2E tests utilise builder pour fabriquer contexts test), TOUS les sprints metier 8+ qui consomment attributes resource pour decisions contextuelles.
- **Apporte au sprint** : interfaces TypeScript canoniques, schemas Zod runtime, builder pattern type-safe, mappings resource-types, helpers serialization audit, fixtures tests. Permet a l'equipe Sprint 7 de demarrer la Tache 2.3.7 (AbacService + 4 policies) en parallele de cette tache 2.3.6 sur deux dev (interface livree -> mock policies pour test driven).

### 3.2 Position dans le programme global

Cette tache pose le contrat type-safe consomme par 35 sprints. L'evolution principale au-dela du Sprint 7 :
- Sprint 8-11 (CRM, Booking, Comm, Docs) : utilisent ABAC pour ownership (CrmContactAttributes, DocDocumentAttributes massivement).
- Sprint 12 (compliance) : ajoute `compliance.audit_records` ressource + policy `ComplianceOfficerOnlyPolicy` etend interfaces.
- Sprint 13-17 (Pay, Books, Insure) : massive utilisation StatusBasedPolicy (invoice.status, policy.status, transaction.status) + TimeBasedPolicy (refund 30j Loi 17-99).
- Sprint 18 (GraphQL) : resolvers utilisent meme AbacService via DI partage.
- Sprint 24 (assure mobile) : ajoute `mobile_assure_request` resource type, etend ResourceType union + interface MobileAssureAttributes.
- Sprint 25 (cross-tenant) : ajoute `CrossTenantContext` extending AbacContext avec champs `originTenantId`, `targetTenantId`, `crossTenantAuthorizationType`.
- Sprint 26 (impersonation) : ajoute `originalUserRole` deja present dans interface comme optional, active dans context si super_admin impersone.
- Sprint 30 (MCP) : tools MCP recoivent `AbacContext` enrichi avec `mcp_invocation_id`.
- Sprint 31 (Sky AI) : agent execute `sky.tools.invoke` avec `AbacContext` build via builder dans agent runtime.
- Sprint 33 (pentest) : 50+ scenarios verifient absence bypass via context corruption / serialization replay attacks.

### 3.3 Diagramme flow ABAC evaluation ASCII detaille

```
   HTTP Request -> NestJS Router -> Handler decorated guards chain
          |
          v
   [1] JwtAuthGuard (Sprint 6) -- valide JWT, pose request.user
          |
          v
   [2] TenantContextGuard (Sprint 6) -- AsyncLocalStorage init context
          |
          v
   [3] RoleGuard (Tache 2.3.4) -- verif role-based si decorator
          |
          v
   [4] PermissionGuard (Tache 2.3.5) -- verif permission-based RBAC
          | (RBAC ALLOWED ici, mais permission est `_own`/`_assigned`)
          v
   [5] AbacResourceGuard (Tache 2.3.8) -- declenche si @AbacResource decorator present
       |
       |--> a. Reflector.get(ABAC_RESOURCE_KEY) -> { resourceType, idParam, action }
       |
       |--> b. resourceId = request.params[idParam]
       |
       |--> c. resourceLoader = abacResourceRegistry.get(resourceType)
       |
       |--> d. resource = await resourceLoader.load(resourceId, tenantId)
       |       (charge depuis DB avec attributes complets + RLS check)
       |
       |--> e. attributes = resourceLoader.extractAttributes(resource)
       |
       |--> f. context = createAbacContextBuilder()
       |         .forUser(currentUserId)
       |         .withRole(currentUserRole)
       |         .inTenant(currentTenantId)
       |         .onResource(resourceType, resourceId, attributes)
       |         .performing(action)
       |         .withRequestContext({ ipAddress, userAgent, timestamp })
       |         .build();   <- THIS TASK 2.3.6 builder
       |
       |--> g. result = await abacService.evaluate(currentRole, permission, context)
       |       (Tache 2.3.7 service)
       |
       |--> h. If result.allowed === false:
       |         await rbacAudit.logAccessDenied({
       |           ...context,
       |           appliedPolicy: result.appliedPolicy,
       |           reason: result.reason,
       |         });
       |         throw ForbiddenException({
       |           code: 'ABAC_DENIED',
       |           policy: result.appliedPolicy,
       |           reason: result.reason,
       |         });
       |
       |--> i. If result.allowed === true:
       |         optional debug log if ABAC_LOG_ALLOWED=true
       |         return true (handler executes)
          |
          v
   Handler executes with full RBAC + ABAC authorization confirmed
```

### 3.4 AbacContext shape detaillee

```
   AbacContext {
     userId: string                    // UUID v7 user from TenantContext
     role: AuthRole                    // 'broker_user' | 'garage_chef' | etc.
     tenantId: string                  // UUID v7 tenant
     originalUserRole?: AuthRole       // si impersonation (Sprint 26)
     resource: {
       type: ResourceType              // 'crm_contact' | 'insure_police' | etc.
       id: string                      // UUID v7 instance
       attributes: Record<string, unknown> & Partial<TypedAttributes>
     }
     action: AbacAction                // 'read' | 'create' | 'update' | etc.
     requestContext: {
       ipAddress: string               // X-Real-IP / X-Forwarded-For first
       userAgent: string               // request.headers['user-agent']
       timestamp: Date                 // construction time (UTC)
       requestId?: string              // correlation ID from Sprint 4
       traceId?: string                // OpenTelemetry trace_id Sprint 22
     }
     metadata?: {                      // Reserved future extensibility
       _v: 1                           // schema version
       [key: string]: unknown
     }
   }
```

### 3.5 AbacPolicy interface shape

```
   AbacPolicy {
     name: string                       // unique identifier ex 'OwnResourcesPolicy'
     description?: string                // human-readable
     priority?: number                   // si plusieurs applicable, plus haut prioritaire
     appliesTo: {
       permissions: PermissionValue[]   // permissions que cette policy gere
       resourceTypes?: ResourceType[]   // optional filter par resource type
       roles?: AuthRole[]               // optional filter par role
     }
     evaluate(context: AbacContext): Promise<AbacResult>
   }
```

### 3.6 AbacResult discriminated union

```
   AbacResult = AllowedResult | DeniedResult

   AllowedResult {
     allowed: true
     appliedPolicy: string              // policy name attribuant decision
     reason?: string                    // optional justification (audit verbose)
     metadata?: Record<string, unknown> // future extensibility
   }

   DeniedResult {
     allowed: false
     appliedPolicy: string              // policy name ayant denied
     reason: string                     // OBLIGATOIRE en cas deny (Loi 09-08)
     reasonCode?: AbacReason            // enum code structurel
     metadata?: Record<string, unknown>
   }
```

---

## 4. Livrables checkables

- [ ] L1 : Fichier `repo/packages/auth/src/abac/types.ts` (~250 lignes) cree et compile strict
- [ ] L2 : Fichier `repo/packages/auth/src/abac/resource-types.ts` (~150 lignes) cree avec union + enum + helpers
- [ ] L3 : Fichier `repo/packages/auth/src/abac/abac-context.builder.ts` (~180 lignes) cree avec builder pattern type-safe phantom types
- [ ] L4 : Fichier `repo/packages/auth/src/abac/abac-context.schema.ts` (~120 lignes) cree avec schemas Zod miroirs
- [ ] L5 : Fichier `repo/packages/auth/src/abac/abac-policy.interface.ts` (~80 lignes) cree avec abstract interface + helpers
- [ ] L6 : Fichier `repo/packages/auth/src/abac/abac-result.types.ts` (~100 lignes) cree avec discriminated union + factory helpers
- [ ] L7 : Fichier `repo/packages/auth/src/abac/abac-resource.types.ts` (~150 lignes) cree avec interfaces specifiques par resource type
- [ ] L8 : Fichier `repo/packages/auth/src/abac/abac-action.enum.ts` (~80 lignes) cree avec enum + companion union + helpers
- [ ] L9 : Fichier test `repo/packages/auth/src/abac/types.spec.ts` (~200 lignes) avec 25+ tests Vitest
- [ ] L10 : Fichier test `repo/packages/auth/src/abac/abac-context-builder.spec.ts` (~120 lignes) avec tests builder
- [ ] L11 : Fichier test `repo/packages/auth/src/abac/resource-types.spec.ts` (~80 lignes) avec tests resource type helpers
- [ ] L12 : Fichier `repo/packages/auth/src/abac/index.ts` barrel export complet
- [ ] L13 : Interface `AbacContext` exportee avec champs `userId`, `role`, `tenantId`, `resource`, `action`, `requestContext` + optionnels `originalUserRole`, `metadata`
- [ ] L14 : Interface `AbacPolicy` exportee avec champs `name`, `appliesTo`, `evaluate(context)` + optionnels `description`, `priority`
- [ ] L15 : Type `AbacResult` discriminated union `AllowedResult | DeniedResult` exporte
- [ ] L16 : Union ResourceType `'crm_contact' | 'insure_police' | 'repair_sinistre' | 'pay_transaction' | 'doc_document'` exportee + Zod enum + companion enum object
- [ ] L17 : Enum AbacAction `'read' | 'create' | 'update' | 'delete' | 'approve' | 'cancel' | 'refund' | 'close' | 'assign'` exporte
- [ ] L18 : Schemas Zod `AbacContextSchema`, `AbacResultSchema`, `AbacRequestContextSchema`, `ResourceTypeSchema`, `AbacActionSchema` exportes
- [ ] L19 : Builder `AbacContextBuilder` avec phantom types verifies + factory `createAbacContextBuilder()` exporte
- [ ] L20 : Helper `getResourceTypeFromPermission(permission)` avec mapping exhaustif teste
- [ ] L21 : Helper `assertResourceType(value)` qui throw si invalid + tests
- [ ] L22 : Helper `assertResourceAttributes<T>(attrs, type)` narrowing + tests par resource type
- [ ] L23 : Helpers `isAllowedResult(r)`, `isDeniedResult(r)` type guards + tests
- [ ] L24 : Helpers `createAllowedResult(policyName, reason?)`, `createDeniedResult(policyName, reason, reasonCode?)` factories + tests
- [ ] L25 : Helpers `serializeAbacContextForAudit(ctx)`, `deserializeAbacContextFromAudit(json)` roundtrip + tests V18

---

## 5. Fichiers crees / modifies

```
repo/packages/auth/src/abac/types.ts                                  # ~250 lignes (CREE)
repo/packages/auth/src/abac/resource-types.ts                          # ~150 lignes (CREE)
repo/packages/auth/src/abac/abac-context.builder.ts                    # ~180 lignes (CREE)
repo/packages/auth/src/abac/abac-context.schema.ts                     # ~120 lignes (CREE)
repo/packages/auth/src/abac/abac-policy.interface.ts                   # ~80 lignes (CREE)
repo/packages/auth/src/abac/abac-result.types.ts                       # ~100 lignes (CREE)
repo/packages/auth/src/abac/abac-resource.types.ts                     # ~150 lignes (CREE)
repo/packages/auth/src/abac/abac-action.enum.ts                        # ~80 lignes (CREE)
repo/packages/auth/src/abac/types.spec.ts                              # ~200 lignes (CREE)
repo/packages/auth/src/abac/abac-context-builder.spec.ts               # ~120 lignes (CREE)
repo/packages/auth/src/abac/resource-types.spec.ts                     # ~80 lignes (CREE)
repo/packages/auth/src/abac/index.ts                                   # ~50 lignes (CREE)
repo/packages/auth/src/index.ts                                        # MODIFIE export barrel abac/*
repo/packages/auth/package.json                                        # MODIFIE add zod export if missing
repo/packages/auth/tsconfig.json                                       # VERIFIE strict mode + exactOptionalPropertyTypes
```

---

## 6. Code patterns COMPLETS

### 6.1 Fichier `types.ts` (~250 lignes)

```typescript
// repo/packages/auth/src/abac/types.ts
/**
 * @fileoverview ABAC core types -- AbacContext, AbacPolicy, AbacResult.
 *
 * This file defines the canonical TypeScript interfaces for the ABAC
 * subsystem of @insurtech/auth. It is consumed by:
 *   - AbacService (Tache 2.3.7) -- orchestrator
 *   - AbacResourceGuard (Tache 2.3.8) -- PEP enforcement point
 *   - 4 policies fondamentales (Tache 2.3.7) -- OwnResources, TimeBased,
 *     StatusBased, WorkflowState
 *   - RbacAuditService (Tache 2.3.10) -- persistence audit
 *
 * AUCUNE LOGIQUE EVALUATIVE ICI -- type-only contract module.
 *
 * @module @insurtech/auth/abac
 */

import type { AuthRole } from '../rbac/auth-role.type';
import type { PermissionValue } from '../rbac/permission.type';
import type { ResourceType } from './resource-types';
import type { AbacAction } from './abac-action.enum';
import type { AbacResult } from './abac-result.types';

/**
 * Subject + Resource + Action + Environment -- canonical ABAC context.
 *
 * Inspired by XACML 3.0 (OASIS standard) but simplified for TypeScript
 * native usage. All fields are required EXCEPT optional fields explicitly
 * marked with `?`.
 *
 * @example
 *   const ctx = createAbacContextBuilder()
 *     .forUser('user-uuid')
 *     .withRole('broker_user')
 *     .inTenant('tenant-uuid')
 *     .onResource('crm_contact', 'contact-uuid', { owner_user_id: 'user-uuid' })
 *     .performing('update')
 *     .withRequestContext({ ipAddress: '1.2.3.4', userAgent: 'curl/7' })
 *     .build();
 */
export interface AbacContext {
  /** Subject : userId from TenantContext (Sprint 6 AsyncLocalStorage). */
  readonly userId: string;

  /** Subject : current effective role (post-impersonation if applicable). */
  readonly role: AuthRole;

  /** Subject : tenantId from TenantContext. */
  readonly tenantId: string;

  /**
   * Subject : original role BEFORE impersonation (Sprint 26).
   * Set only when super_admin_platform impersonates a user.
   * Used for audit trail "who really invoked the action".
   */
  readonly originalUserRole?: AuthRole;

  /** Resource being accessed. */
  readonly resource: AbacResourceDescriptor;

  /** Action being performed (CRUD + business actions). */
  readonly action: AbacAction;

  /** Environment context (request metadata). */
  readonly requestContext: AbacRequestContext;

  /**
   * Reserved future extensibility metadata. Schema versioned via _v field.
   */
  readonly metadata?: Readonly<Record<string, unknown>> & {
    readonly _v?: number;
  };
}

/**
 * Resource descriptor : type, id, and attributes.
 *
 * Attributes are typed loosely (`Record<string, unknown>`) at the structural
 * level to allow heterogeneous resource types. Use `assertResourceAttributes<T>`
 * helper to narrow to a specific TypedAttributes interface inside policies.
 */
export interface AbacResourceDescriptor {
  readonly type: ResourceType;
  readonly id: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}

/**
 * Request environment context : IP, user-agent, timestamp, correlation IDs.
 *
 * timestamp is `Date` instance at the type level. When serialized for audit
 * (cf. serializeAbacContextForAudit), converted to ISO 8601 UTC string.
 */
export interface AbacRequestContext {
  readonly ipAddress: string;
  readonly userAgent: string;
  readonly timestamp: Date;
  readonly requestId?: string;
  readonly traceId?: string;
  readonly mfaElevated?: boolean;
}

/**
 * Policy contract : every ABAC policy implements this interface.
 *
 * The `evaluate` method is async to allow policies to fetch additional
 * data (e.g. external API calls, DB lookups for related resources). In
 * practice, the 4 fundamental policies (Tache 2.3.7) are SYNCHRONOUS
 * computations on context.attributes -- async signature future-proofs
 * for richer policies in Sprint 25+ (cross-tenant authorization checks).
 *
 * @example Implementation skeleton (Tache 2.3.7)
 *   class OwnResourcesPolicy implements AbacPolicy {
 *     readonly name = 'OwnResourcesPolicy';
 *     readonly appliesTo = {
 *       permissions: ['crm.contacts.read_own', 'crm.contacts.update_own'],
 *     };
 *     async evaluate(ctx: AbacContext): Promise<AbacResult> {
 *       const ownerId = ctx.resource.attributes['owner_user_id'];
 *       return ownerId === ctx.userId
 *         ? createAllowedResult(this.name)
 *         : createDeniedResult(this.name, 'Not the owner', 'NOT_OWNER');
 *     }
 *   }
 */
export interface AbacPolicy {
  /** Unique identifier (used in audit trail). */
  readonly name: string;

  /** Human-readable description (optional, for introspection endpoint). */
  readonly description?: string;

  /**
   * Priority for resolution when multiple policies are applicable.
   * Higher number = higher priority. Default = 0.
   * Skalean uses first-applicable-then-stop strategy, so priority only
   * matters when permissions/resourceTypes overlap.
   */
  readonly priority?: number;

  /** Filter conditions for when this policy is invoked. */
  readonly appliesTo: AbacPolicyApplicability;

  /** Core evaluation logic. */
  evaluate(context: AbacContext): Promise<AbacResult>;
}

/**
 * Filter conditions for policy applicability.
 *
 * AbacService matches policies via:
 *   1. permission IN appliesTo.permissions (REQUIRED match)
 *   2. AND (if specified) context.resource.type IN appliesTo.resourceTypes
 *   3. AND (if specified) context.role IN appliesTo.roles
 *
 * If no condition specified beyond permissions, policy applies whenever
 * the permission is being checked.
 */
export interface AbacPolicyApplicability {
  readonly permissions: readonly PermissionValue[];
  readonly resourceTypes?: readonly ResourceType[];
  readonly roles?: readonly AuthRole[];
}

/**
 * Re-export AbacResult from dedicated file for convenience.
 * Consumers can import from '@insurtech/auth/abac' instead of nested path.
 */
export type { AbacResult, AllowedResult, DeniedResult } from './abac-result.types';
export type { ResourceType } from './resource-types';
export type { AbacAction } from './abac-action.enum';

/**
 * Constants documenting expected policy names (Tache 2.3.7).
 * Used in tests V14 to verify all 4 policies are registered.
 */
export const ABAC_POLICY_NAMES = {
  OWN_RESOURCES: 'OwnResourcesPolicy',
  TIME_BASED: 'TimeBasedPolicy',
  STATUS_BASED: 'StatusBasedPolicy',
  WORKFLOW_STATE: 'WorkflowStatePolicy',
} as const;

export type AbacPolicyName = (typeof ABAC_POLICY_NAMES)[keyof typeof ABAC_POLICY_NAMES];
```

### 6.2 Fichier `resource-types.ts` (~150 lignes)

```typescript
// repo/packages/auth/src/abac/resource-types.ts
/**
 * @fileoverview ABAC resource types -- canonical union + helpers.
 *
 * Resource types identify the kind of entity being accessed. They are used
 * to (a) route AbacContext to the correct policy via AbacPolicy.appliesTo
 * .resourceTypes, (b) narrow the typed attributes interface, (c) drive
 * the resource loader registry in AbacResourceGuard (Tache 2.3.8).
 *
 * @module @insurtech/auth/abac/resource-types
 */

import { z } from 'zod';
import type { PermissionValue } from '../rbac/permission.type';

/**
 * Canonical resource types for Sprint 7-23.
 * Sprint 24+ may extend (mobile_assure_request, sky_conversation).
 *
 * Naming convention : snake_case, singular, prefixed by domain.
 *   - 'crm_contact'        -- CRM contact entity
 *   - 'insure_police'      -- Insurance policy contract
 *   - 'repair_sinistre'    -- Repair claim (Moroccan: sinistre)
 *   - 'pay_transaction'    -- Payment transaction
 *   - 'doc_document'       -- Document (PDF, image, contract)
 */
export const RESOURCE_TYPES_LIST = [
  'crm_contact',
  'insure_police',
  'repair_sinistre',
  'pay_transaction',
  'doc_document',
] as const;

export type ResourceType = (typeof RESOURCE_TYPES_LIST)[number];

/**
 * Companion enum object for usage with switch statements with exhaustive
 * checks (Sprint 7+ : tsc --noFallthroughCasesInSwitch enabled).
 */
export const ResourceType = {
  CrmContact: 'crm_contact',
  InsurePolice: 'insure_police',
  RepairSinistre: 'repair_sinistre',
  PayTransaction: 'pay_transaction',
  DocDocument: 'doc_document',
} as const satisfies Record<string, ResourceType>;

/**
 * Zod schema for runtime validation of resource type strings.
 * Used in AbacContextSchema + helper assertResourceType.
 */
export const ResourceTypeSchema = z.enum(RESOURCE_TYPES_LIST);

/**
 * Throw-on-invalid assertion helper.
 *
 * @throws ZodError if value is not a valid ResourceType.
 * @example
 *   const type = assertResourceType(req.params.resourceType);
 *   // Now type is narrowed to ResourceType.
 */
export function assertResourceType(value: unknown): ResourceType {
  return ResourceTypeSchema.parse(value);
}

/**
 * Type guard predicate.
 *
 * @example
 *   if (isResourceType(value)) {
 *     // value is ResourceType
 *   }
 */
export function isResourceType(value: unknown): value is ResourceType {
  return ResourceTypeSchema.safeParse(value).success;
}

/**
 * Mapping permission -> resource type (for routing policies).
 *
 * Used in AbacService.evaluate (Tache 2.3.7) to determine which resource
 * type a permission targets, in order to load the correct resource via
 * the resource loader registry.
 *
 * Pattern: extract namespace + entity from permission value.
 *   'crm.contacts.read_own'        -> 'crm_contact'
 *   'insure.policies.cancel'       -> 'insure_police'
 *   'repair.sinistres.close'       -> 'repair_sinistre'
 *   'pay.refunds.create'           -> 'pay_transaction'
 *   'pay.transactions.read_own'    -> 'pay_transaction'
 *   'docs.documents.read_own'      -> 'doc_document'
 *
 * Returns null if permission has no associated resource type (e.g.
 * 'admin.tenants.suspend' is not resource-instance scoped).
 */
const PERMISSION_TO_RESOURCE_TYPE: Readonly<Record<string, ResourceType>> = {
  'crm.contacts.read': 'crm_contact',
  'crm.contacts.read_own': 'crm_contact',
  'crm.contacts.create': 'crm_contact',
  'crm.contacts.update': 'crm_contact',
  'crm.contacts.update_own': 'crm_contact',
  'crm.contacts.delete': 'crm_contact',
  'crm.contacts.delete_own': 'crm_contact',
  'insure.policies.read': 'insure_police',
  'insure.policies.read_own': 'insure_police',
  'insure.policies.create': 'insure_police',
  'insure.policies.update': 'insure_police',
  'insure.policies.cancel': 'insure_police',
  'insure.policies.transfer': 'insure_police',
  'repair.sinistres.read': 'repair_sinistre',
  'repair.sinistres.read_own': 'repair_sinistre',
  'repair.sinistres.read_assigned': 'repair_sinistre',
  'repair.sinistres.create': 'repair_sinistre',
  'repair.sinistres.create_own': 'repair_sinistre',
  'repair.sinistres.update': 'repair_sinistre',
  'repair.sinistres.assign': 'repair_sinistre',
  'repair.sinistres.close': 'repair_sinistre',
  'pay.transactions.read': 'pay_transaction',
  'pay.transactions.read_own': 'pay_transaction',
  'pay.refunds.create': 'pay_transaction',
  'docs.documents.read': 'doc_document',
  'docs.documents.read_own': 'doc_document',
  'docs.documents.create': 'doc_document',
  'docs.documents.update': 'doc_document',
  'docs.documents.delete': 'doc_document',
};

/**
 * Get the resource type associated with a permission (for routing policies).
 *
 * @returns ResourceType if mapped, null otherwise (RBAC-only permission).
 */
export function getResourceTypeFromPermission(
  permission: PermissionValue,
): ResourceType | null {
  return PERMISSION_TO_RESOURCE_TYPE[permission] ?? null;
}

/**
 * Boot-time validation : ensure all *_own / *_assigned permissions have
 * a resource type mapping (else policy routing fails silently).
 * Called from PermissionGuardModule init lifecycle hook in Tache 2.3.7.
 *
 * @throws Error listing unmapped permissions if any.
 */
export function assertResourceTypeMappingComplete(
  catalogPermissions: readonly PermissionValue[],
): void {
  const unmapped: PermissionValue[] = [];
  for (const perm of catalogPermissions) {
    if (
      (perm.endsWith('_own') || perm.endsWith('_assigned')) &&
      !(perm in PERMISSION_TO_RESOURCE_TYPE)
    ) {
      unmapped.push(perm);
    }
  }
  if (unmapped.length > 0) {
    throw new Error(
      `[abac] Unmapped permissions in resource-types.ts PERMISSION_TO_RESOURCE_TYPE: ${unmapped.join(', ')}`,
    );
  }
}
```

### 6.3 Fichier `abac-action.enum.ts` (~80 lignes)

```typescript
// repo/packages/auth/src/abac/abac-action.enum.ts
/**
 * @fileoverview ABAC actions -- canonical CRUD + business actions.
 *
 * Actions describe WHAT is being attempted on the resource. They are
 * documented in the AbacContext.action field and used for audit log
 * structuring + policy reasoning.
 *
 * @module @insurtech/auth/abac/abac-action.enum
 */

import { z } from 'zod';

/**
 * Canonical actions for Sprint 7-23. Extensible via union widening
 * Sprint 24+ (mobile-specific actions like 'declare_sinistre_mobile').
 *
 * Standard CRUD :
 *   - 'read'    -- read single resource or list
 *   - 'create'  -- create new instance
 *   - 'update'  -- mutate existing instance
 *   - 'delete'  -- soft or hard delete
 *
 * Business actions :
 *   - 'approve' -- approve devis / quote / invoice
 *   - 'cancel'  -- cancel policy / appointment / order
 *   - 'refund'  -- refund payment transaction
 *   - 'close'   -- close sinistre / case / ticket
 *   - 'assign'  -- assign sinistre to garage_chef / technicien
 *   - 'transfer'-- transfer policy ownership
 *   - 'export'  -- export data (compliance reports)
 *   - 'archive' -- archive document
 */
export const ABAC_ACTIONS_LIST = [
  'read',
  'create',
  'update',
  'delete',
  'approve',
  'cancel',
  'refund',
  'close',
  'assign',
  'transfer',
  'export',
  'archive',
] as const;

export type AbacAction = (typeof ABAC_ACTIONS_LIST)[number];

/**
 * Companion enum object for switch statements + autocomplete IDE.
 */
export const AbacAction = {
  Read: 'read',
  Create: 'create',
  Update: 'update',
  Delete: 'delete',
  Approve: 'approve',
  Cancel: 'cancel',
  Refund: 'refund',
  Close: 'close',
  Assign: 'assign',
  Transfer: 'transfer',
  Export: 'export',
  Archive: 'archive',
} as const satisfies Record<string, AbacAction>;

/** Zod schema for runtime validation. */
export const AbacActionSchema = z.enum(ABAC_ACTIONS_LIST);

/** Type guard. */
export function isAbacAction(value: unknown): value is AbacAction {
  return AbacActionSchema.safeParse(value).success;
}

/** Throw-on-invalid assertion. */
export function assertAbacAction(value: unknown): AbacAction {
  return AbacActionSchema.parse(value);
}

/**
 * Mapping action -> default HTTP verb (for OpenAPI Sprint 9 introspection).
 */
export const ACTION_TO_HTTP_VERB: Readonly<Record<AbacAction, string>> = {
  read: 'GET',
  create: 'POST',
  update: 'PATCH',
  delete: 'DELETE',
  approve: 'POST',
  cancel: 'POST',
  refund: 'POST',
  close: 'POST',
  assign: 'POST',
  transfer: 'POST',
  export: 'GET',
  archive: 'POST',
};

/**
 * Set of destructive actions requiring stronger scrutiny in audit
 * (Loi 09-08 article 18).
 */
export const DESTRUCTIVE_ACTIONS: ReadonlySet<AbacAction> = new Set([
  'delete',
  'cancel',
  'refund',
  'transfer',
  'archive',
]);

export function isDestructiveAction(action: AbacAction): boolean {
  return DESTRUCTIVE_ACTIONS.has(action);
}
```

### 6.4 Fichier `abac-result.types.ts` (~100 lignes)

```typescript
// repo/packages/auth/src/abac/abac-result.types.ts
/**
 * @fileoverview ABAC result types -- discriminated union + factories.
 *
 * AbacResult is consumed by AbacResourceGuard (Tache 2.3.8) which uses
 * the discriminator `allowed` to decide pass-through (true) or throw
 * ForbiddenException (false). Audit log (Tache 2.3.10) persists the
 * appliedPolicy + reason fields.
 *
 * @module @insurtech/auth/abac/abac-result.types
 */

import { z } from 'zod';

/**
 * Standardized denial reason codes (Loi 09-08 audit categorization).
 * Used in DeniedResult.reasonCode for structured analytics.
 */
export const ABAC_REASON_CODES = {
  NOT_OWNER: 'NOT_OWNER',
  NOT_ASSIGNED: 'NOT_ASSIGNED',
  TIME_WINDOW_EXPIRED: 'TIME_WINDOW_EXPIRED',
  TIME_WINDOW_NOT_OPEN: 'TIME_WINDOW_NOT_OPEN',
  STATUS_NOT_ALLOWED: 'STATUS_NOT_ALLOWED',
  WORKFLOW_TRANSITION_INVALID: 'WORKFLOW_TRANSITION_INVALID',
  CROSS_TENANT_DENIED: 'CROSS_TENANT_DENIED',
  MFA_REQUIRED: 'MFA_REQUIRED',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',
  POLICY_INTERNAL_ERROR: 'POLICY_INTERNAL_ERROR',
} as const;

export type AbacReason = (typeof ABAC_REASON_CODES)[keyof typeof ABAC_REASON_CODES];

export const AbacReasonSchema = z.enum(
  Object.values(ABAC_REASON_CODES) as [AbacReason, ...AbacReason[]],
);

/** Allowed result : access permitted. */
export interface AllowedResult {
  readonly allowed: true;
  readonly appliedPolicy: string;
  readonly reason?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Denied result : access refused. reason is REQUIRED for audit. */
export interface DeniedResult {
  readonly allowed: false;
  readonly appliedPolicy: string;
  readonly reason: string;
  readonly reasonCode?: AbacReason;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Discriminated union. */
export type AbacResult = AllowedResult | DeniedResult;

/** Type guard for AllowedResult. */
export function isAllowedResult(result: AbacResult): result is AllowedResult {
  return result.allowed === true;
}

/** Type guard for DeniedResult. */
export function isDeniedResult(result: AbacResult): result is DeniedResult {
  return result.allowed === false;
}

/**
 * Factory for AllowedResult. Forces appliedPolicy field non-empty
 * (cf. piege #5 Section 2.5).
 */
export function createAllowedResult(
  appliedPolicy: string,
  reason?: string,
  metadata?: Readonly<Record<string, unknown>>,
): AllowedResult {
  if (!appliedPolicy || appliedPolicy.trim().length === 0) {
    throw new Error('[abac] createAllowedResult: appliedPolicy is required');
  }
  return Object.freeze({
    allowed: true,
    appliedPolicy,
    ...(reason !== undefined && { reason }),
    ...(metadata !== undefined && { metadata: Object.freeze({ ...metadata }) }),
  });
}

/**
 * Factory for DeniedResult. Forces appliedPolicy + reason non-empty.
 * reasonCode optional but recommended for analytics.
 */
export function createDeniedResult(
  appliedPolicy: string,
  reason: string,
  reasonCode?: AbacReason,
  metadata?: Readonly<Record<string, unknown>>,
): DeniedResult {
  if (!appliedPolicy || appliedPolicy.trim().length === 0) {
    throw new Error('[abac] createDeniedResult: appliedPolicy is required');
  }
  if (!reason || reason.trim().length === 0) {
    throw new Error('[abac] createDeniedResult: reason is required (Loi 09-08)');
  }
  return Object.freeze({
    allowed: false,
    appliedPolicy,
    reason,
    ...(reasonCode !== undefined && { reasonCode }),
    ...(metadata !== undefined && { metadata: Object.freeze({ ...metadata }) }),
  });
}

/** Zod schema mirror for runtime validation (audit replay Sprint 33). */
export const AbacResultSchema = z.discriminatedUnion('allowed', [
  z.object({
    allowed: z.literal(true),
    appliedPolicy: z.string().min(1),
    reason: z.string().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
  z.object({
    allowed: z.literal(false),
    appliedPolicy: z.string().min(1),
    reason: z.string().min(1),
    reasonCode: AbacReasonSchema.optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
]);
```

### 6.5 Fichier `abac-resource.types.ts` (~150 lignes)

```typescript
// repo/packages/auth/src/abac/abac-resource.types.ts
/**
 * @fileoverview Resource-specific typed attributes interfaces.
 *
 * Each ResourceType has a corresponding TypedAttributes interface
 * documenting the expected attribute shape. These interfaces are NOT
 * used at the AbacContext.resource.attributes type level (which remains
 * Record<string, unknown> for flexibility), but are consumed via the
 * narrowing helper assertResourceAttributes<T>(attrs, type) inside
 * policies (Tache 2.3.7).
 *
 * @module @insurtech/auth/abac/abac-resource.types
 */

import { z } from 'zod';
import type { ResourceType } from './resource-types';

/**
 * CRM Contact attributes (used by OwnResourcesPolicy).
 */
export interface CrmContactAttributes {
  readonly owner_user_id: string;
  readonly assigned_user_id?: string;
  readonly created_at: Date;
  readonly updated_at: Date;
  readonly is_locked?: boolean;
  readonly tenant_id: string;
}

export const CrmContactAttributesSchema = z.object({
  owner_user_id: z.string().uuid(),
  assigned_user_id: z.string().uuid().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  is_locked: z.boolean().optional(),
  tenant_id: z.string().uuid(),
});

/**
 * Insurance Policy attributes (used by StatusBased + WorkflowState policies).
 */
export const INSURE_POLICE_STATUSES = [
  'quoted',
  'active',
  'renewed',
  'cancelled',
  'expired',
] as const;
export type InsurePoliceStatus = (typeof INSURE_POLICE_STATUSES)[number];

export interface InsurePolicyAttributes {
  readonly owner_user_id: string;
  readonly assured_user_id: string;
  readonly status: InsurePoliceStatus;
  readonly effective_date: Date;
  readonly expiration_date: Date;
  readonly cancelled_at?: Date;
  readonly tenant_id: string;
  readonly product_code: string;
}

export const InsurePolicyAttributesSchema = z.object({
  owner_user_id: z.string().uuid(),
  assured_user_id: z.string().uuid(),
  status: z.enum(INSURE_POLICE_STATUSES),
  effective_date: z.coerce.date(),
  expiration_date: z.coerce.date(),
  cancelled_at: z.coerce.date().optional(),
  tenant_id: z.string().uuid(),
  product_code: z.string().min(1),
});

/**
 * Repair Sinistre (claim) attributes (used by WorkflowState policy).
 */
export const REPAIR_SINISTRE_STATUSES = [
  'declared',
  'acknowledged',
  'appointment_scheduled',
  'diagnostic_in_progress',
  'devis_pending',
  'devis_approved',
  'reparation_in_progress',
  'reparation_completed',
  'closed',
  'rejected',
] as const;
export type RepairSinistreStatus = (typeof REPAIR_SINISTRE_STATUSES)[number];

export interface RepairSinistreAttributes {
  readonly owner_user_id: string;
  readonly assured_user_id: string;
  readonly assigned_user_id?: string;
  readonly assigned_garage_id?: string;
  readonly status: RepairSinistreStatus;
  readonly declared_at: Date;
  readonly closed_at?: Date;
  readonly tenant_id: string;
  readonly police_id: string;
}

export const RepairSinistreAttributesSchema = z.object({
  owner_user_id: z.string().uuid(),
  assured_user_id: z.string().uuid(),
  assigned_user_id: z.string().uuid().optional(),
  assigned_garage_id: z.string().uuid().optional(),
  status: z.enum(REPAIR_SINISTRE_STATUSES),
  declared_at: z.coerce.date(),
  closed_at: z.coerce.date().optional(),
  tenant_id: z.string().uuid(),
  police_id: z.string().uuid(),
});

/**
 * Pay Transaction attributes (used by TimeBased policy for refund 30j Loi 17-99).
 */
export const PAY_TRANSACTION_STATUSES = [
  'pending',
  'completed',
  'failed',
  'refunded',
  'partially_refunded',
] as const;
export type PayTransactionStatus = (typeof PAY_TRANSACTION_STATUSES)[number];

export interface PayTransactionAttributes {
  readonly owner_user_id: string;
  readonly status: PayTransactionStatus;
  readonly amount_mad: number;
  readonly created_at: Date;
  readonly completed_at?: Date;
  readonly refunded_at?: Date;
  readonly tenant_id: string;
  readonly gateway: string;
}

export const PayTransactionAttributesSchema = z.object({
  owner_user_id: z.string().uuid(),
  status: z.enum(PAY_TRANSACTION_STATUSES),
  amount_mad: z.number().positive(),
  created_at: z.coerce.date(),
  completed_at: z.coerce.date().optional(),
  refunded_at: z.coerce.date().optional(),
  tenant_id: z.string().uuid(),
  gateway: z.string().min(1),
});

/**
 * Document attributes (used by OwnResourcesPolicy + future signature policies).
 */
export interface DocDocumentAttributes {
  readonly owner_user_id: string;
  readonly created_at: Date;
  readonly is_signed: boolean;
  readonly signed_at?: Date;
  readonly tenant_id: string;
  readonly mime_type: string;
  readonly classification: 'public' | 'internal' | 'confidential';
}

export const DocDocumentAttributesSchema = z.object({
  owner_user_id: z.string().uuid(),
  created_at: z.coerce.date(),
  is_signed: z.boolean(),
  signed_at: z.coerce.date().optional(),
  tenant_id: z.string().uuid(),
  mime_type: z.string().min(1),
  classification: z.enum(['public', 'internal', 'confidential']),
});

/**
 * Type-level mapping ResourceType -> TypedAttributes interface.
 */
export type ResourceAttributesMap = {
  crm_contact: CrmContactAttributes;
  insure_police: InsurePolicyAttributes;
  repair_sinistre: RepairSinistreAttributes;
  pay_transaction: PayTransactionAttributes;
  doc_document: DocDocumentAttributes;
};

/**
 * Runtime mapping ResourceType -> Zod schema (used by assertResourceAttributes).
 */
const ATTRIBUTES_SCHEMA_MAP: Readonly<Record<ResourceType, z.ZodTypeAny>> = {
  crm_contact: CrmContactAttributesSchema,
  insure_police: InsurePolicyAttributesSchema,
  repair_sinistre: RepairSinistreAttributesSchema,
  pay_transaction: PayTransactionAttributesSchema,
  doc_document: DocDocumentAttributesSchema,
};

/**
 * Narrowing helper : validates and casts attributes to typed interface.
 * Throws if attributes don't match expected shape.
 *
 * @example In OwnResourcesPolicy.evaluate (Tache 2.3.7)
 *   const attrs = assertResourceAttributes<CrmContactAttributes>(
 *     ctx.resource.attributes,
 *     'crm_contact',
 *   );
 *   return attrs.owner_user_id === ctx.userId
 *     ? createAllowedResult(this.name)
 *     : createDeniedResult(this.name, 'Not the owner', 'NOT_OWNER');
 */
export function assertResourceAttributes<T extends ResourceType>(
  attributes: Readonly<Record<string, unknown>>,
  resourceType: T,
): ResourceAttributesMap[T] {
  const schema = ATTRIBUTES_SCHEMA_MAP[resourceType];
  return schema.parse(attributes) as ResourceAttributesMap[T];
}
```

### 6.6 Fichier `abac-policy.interface.ts` (~80 lignes)

```typescript
// repo/packages/auth/src/abac/abac-policy.interface.ts
/**
 * @fileoverview AbacPolicy abstract interface + helpers.
 *
 * Re-exports AbacPolicy from types.ts for convenience and adds helper
 * factories for common policy patterns.
 *
 * @module @insurtech/auth/abac/abac-policy.interface
 */

import type { AbacPolicy, AbacPolicyApplicability } from './types';
import type { AbacContext } from './types';
import type { AbacResult } from './abac-result.types';
import type { PermissionValue } from '../rbac/permission.type';
import type { ResourceType } from './resource-types';

export type { AbacPolicy, AbacPolicyApplicability };

/**
 * Helper to check if a policy is applicable to a given (permission, context) pair.
 * Used internally by AbacService.evaluate (Tache 2.3.7).
 */
export function isPolicyApplicable(
  policy: AbacPolicy,
  permission: PermissionValue,
  context: AbacContext,
): boolean {
  // Required match: permission in policy.appliesTo.permissions
  if (!policy.appliesTo.permissions.includes(permission)) {
    return false;
  }
  // Optional filter: resourceType
  if (
    policy.appliesTo.resourceTypes &&
    !policy.appliesTo.resourceTypes.includes(context.resource.type)
  ) {
    return false;
  }
  // Optional filter: role
  if (
    policy.appliesTo.roles &&
    !policy.appliesTo.roles.includes(context.role)
  ) {
    return false;
  }
  return true;
}

/**
 * Comparator for policy priority (descending : higher priority first).
 * Used to sort policies before iteration in AbacService.evaluate.
 */
export function comparePoliciesPriority(a: AbacPolicy, b: AbacPolicy): number {
  return (b.priority ?? 0) - (a.priority ?? 0);
}

/**
 * Helper for tests : assert a policy declaration is well-formed.
 * Used in Tache 2.3.7 tests to validate fixture policies.
 */
export function assertValidPolicyDeclaration(policy: AbacPolicy): void {
  if (!policy.name || policy.name.trim().length === 0) {
    throw new Error('[abac] policy.name is required');
  }
  if (!policy.appliesTo || policy.appliesTo.permissions.length === 0) {
    throw new Error('[abac] policy.appliesTo.permissions must be non-empty');
  }
  if (typeof policy.evaluate !== 'function') {
    throw new Error('[abac] policy.evaluate must be a function');
  }
}

/**
 * Type alias for evaluate function signature, useful for mocking in tests.
 */
export type AbacPolicyEvaluate = (context: AbacContext) => Promise<AbacResult>;

/**
 * Builder helper for policy applicability (chainable, optional).
 */
export class AbacPolicyApplicabilityBuilder {
  private readonly permissions: PermissionValue[] = [];
  private resourceTypes: ResourceType[] | undefined;
  private roles: string[] | undefined;

  forPermissions(...perms: PermissionValue[]): this {
    this.permissions.push(...perms);
    return this;
  }

  onResourceTypes(...types: ResourceType[]): this {
    this.resourceTypes = (this.resourceTypes ?? []).concat(types);
    return this;
  }

  build(): AbacPolicyApplicability {
    if (this.permissions.length === 0) {
      throw new Error('[abac] applicability: at least one permission required');
    }
    return Object.freeze({
      permissions: Object.freeze([...this.permissions]),
      ...(this.resourceTypes && { resourceTypes: Object.freeze([...this.resourceTypes]) }),
    }) as AbacPolicyApplicability;
  }
}
```

### 6.7 Fichier `abac-context.schema.ts` (~120 lignes)

```typescript
// repo/packages/auth/src/abac/abac-context.schema.ts
/**
 * @fileoverview Zod schemas for AbacContext + AbacRequestContext.
 *
 * Mirror the TypeScript interfaces in types.ts at the runtime level.
 * Used for:
 *   - Validation of contexts received from external sources (Kafka audit
 *     replay Sprint 33, cache deserialize stale, MCP tools invocation
 *     Sprint 30)
 *   - Boot-time fixture validation in tests (V1, V2)
 *   - Runtime safety net (defense in depth)
 *
 * @module @insurtech/auth/abac/abac-context.schema
 */

import { z } from 'zod';
import { AuthRoleSchema } from '../rbac/auth-role.schema';
import { ResourceTypeSchema } from './resource-types';
import { AbacActionSchema } from './abac-action.enum';

/**
 * Zod schema for AbacRequestContext.
 * timestamp uses z.coerce.date() to handle JSON-deserialized strings.
 */
export const AbacRequestContextSchema = z.object({
  ipAddress: z
    .string()
    .min(1)
    .refine(
      (v) => /^[0-9a-fA-F:.]+$/.test(v),
      { message: 'ipAddress must be a valid IP (v4 or v6)' },
    ),
  userAgent: z.string().min(1).max(2048),
  timestamp: z.coerce.date(),
  requestId: z.string().uuid().optional(),
  traceId: z.string().min(8).max(128).optional(),
  mfaElevated: z.boolean().optional(),
});

export type AbacRequestContextParsed = z.infer<typeof AbacRequestContextSchema>;

/**
 * Zod schema for AbacResourceDescriptor.
 * Attributes is permissive (.passthrough) to allow heterogeneous types
 * without forcing strict shape at this level (cf. piege #7 Section 2.5).
 */
export const AbacResourceDescriptorSchema = z.object({
  type: ResourceTypeSchema,
  id: z.string().min(1),
  attributes: z.record(z.unknown()).default({}),
});

/**
 * Zod schema for full AbacContext.
 *
 * Validation rules :
 *   - userId : non-empty string (preferably UUID v7)
 *   - role : AuthRole enum
 *   - tenantId : non-empty string
 *   - originalUserRole : optional AuthRole
 *   - resource : AbacResourceDescriptor
 *   - action : AbacAction enum
 *   - requestContext : AbacRequestContext
 *   - metadata : optional record
 */
export const AbacContextSchema = z.object({
  userId: z.string().min(1),
  role: AuthRoleSchema,
  tenantId: z.string().min(1),
  originalUserRole: AuthRoleSchema.optional(),
  resource: AbacResourceDescriptorSchema,
  action: AbacActionSchema,
  requestContext: AbacRequestContextSchema,
  metadata: z
    .record(z.unknown())
    .and(z.object({ _v: z.number().int().positive().optional() }))
    .optional(),
});

export type AbacContextParsed = z.infer<typeof AbacContextSchema>;

/**
 * Strict variant : rejects unknown top-level fields.
 * Used only when env ABAC_TYPES_STRICT_VALIDATION=true.
 */
export const AbacContextSchemaStrict = AbacContextSchema.strict();

/**
 * Helper for tests + audit replay : parse + assert.
 * @throws ZodError if invalid.
 */
export function parseAbacContext(input: unknown): AbacContextParsed {
  return AbacContextSchema.parse(input);
}

/**
 * Helper safe-parse (no throw, returns Result).
 */
export function safeParseAbacContext(
  input: unknown,
): { success: true; data: AbacContextParsed } | { success: false; errors: unknown } {
  const result = AbacContextSchema.safeParse(input);
  return result.success
    ? { success: true, data: result.data }
    : { success: false, errors: result.error.issues };
}

/**
 * Serialization for audit log persistence (Tache 2.3.10).
 * Converts Date to ISO 8601 string explicitly, freezes output.
 */
export interface AbacContextSerialized {
  readonly _serialized_v: 1;
  readonly userId: string;
  readonly role: string;
  readonly tenantId: string;
  readonly originalUserRole?: string;
  readonly resource: {
    readonly type: string;
    readonly id: string;
    readonly attributes: Readonly<Record<string, unknown>>;
  };
  readonly action: string;
  readonly requestContext: {
    readonly ipAddress: string;
    readonly userAgent: string;
    readonly timestamp: string;
    readonly requestId?: string;
    readonly traceId?: string;
    readonly mfaElevated?: boolean;
  };
}

export function serializeAbacContextForAudit(
  ctx: AbacContextParsed,
): AbacContextSerialized {
  return Object.freeze({
    _serialized_v: 1 as const,
    userId: ctx.userId,
    role: ctx.role,
    tenantId: ctx.tenantId,
    ...(ctx.originalUserRole && { originalUserRole: ctx.originalUserRole }),
    resource: Object.freeze({
      type: ctx.resource.type,
      id: ctx.resource.id,
      attributes: Object.freeze({ ...ctx.resource.attributes }),
    }),
    action: ctx.action,
    requestContext: Object.freeze({
      ipAddress: ctx.requestContext.ipAddress,
      userAgent: ctx.requestContext.userAgent,
      timestamp: ctx.requestContext.timestamp.toISOString(),
      ...(ctx.requestContext.requestId && { requestId: ctx.requestContext.requestId }),
      ...(ctx.requestContext.traceId && { traceId: ctx.requestContext.traceId }),
      ...(ctx.requestContext.mfaElevated !== undefined && {
        mfaElevated: ctx.requestContext.mfaElevated,
      }),
    }),
  });
}

export function deserializeAbacContextFromAudit(
  serialized: AbacContextSerialized,
): AbacContextParsed {
  return parseAbacContext({
    ...serialized,
    requestContext: {
      ...serialized.requestContext,
      timestamp: new Date(serialized.requestContext.timestamp),
    },
  });
}
```

### 6.8 Fichier `abac-context.builder.ts` (~180 lignes)

```typescript
// repo/packages/auth/src/abac/abac-context.builder.ts
/**
 * @fileoverview Builder pattern type-safe for AbacContext construction.
 *
 * Uses phantom types to enforce at compile-time that all required fields
 * are set before .build() is callable.
 *
 * @example Usage (AbacResourceGuard Tache 2.3.8)
 *   const ctx = createAbacContextBuilder()
 *     .forUser('user-uuid')
 *     .withRole('broker_user')
 *     .inTenant('tenant-uuid')
 *     .onResource('crm_contact', 'contact-uuid', { owner_user_id: 'u' })
 *     .performing('update')
 *     .withRequestContext({ ipAddress: '1.2.3.4', userAgent: 'curl/7' })
 *     .build();
 *
 * @example Compile error if missing field
 *   createAbacContextBuilder()
 *     .forUser('u')
 *     .build();   // <- TypeScript error: Property 'build' does not exist
 *
 * @module @insurtech/auth/abac/abac-context.builder
 */

import type { AuthRole } from '../rbac/auth-role.type';
import type { ResourceType } from './resource-types';
import type { AbacAction } from './abac-action.enum';
import type {
  AbacContext,
  AbacResourceDescriptor,
  AbacRequestContext,
} from './types';
import { AbacContextSchema } from './abac-context.schema';

/** Phantom types for builder state tracking. */
type Yes = true;
type No = false;

/**
 * Builder state shape : tracks which fields have been set.
 */
type BuilderState = {
  hasUserId: boolean;
  hasRole: boolean;
  hasTenantId: boolean;
  hasResource: boolean;
  hasAction: boolean;
  hasRequestContext: boolean;
};

type Complete = {
  hasUserId: Yes;
  hasRole: Yes;
  hasTenantId: Yes;
  hasResource: Yes;
  hasAction: Yes;
  hasRequestContext: Yes;
};

/**
 * Internal builder class. Instances cannot be created directly --
 * use createAbacContextBuilder() factory.
 */
export class AbacContextBuilder<S extends BuilderState> {
  private userId?: string;
  private role?: AuthRole;
  private tenantId?: string;
  private originalUserRole?: AuthRole;
  private resource?: AbacResourceDescriptor;
  private action?: AbacAction;
  private requestContext?: AbacRequestContext;
  private metadata?: Readonly<Record<string, unknown>>;

  /** @internal */
  constructor() {
    /* private-ish via factory only */
  }

  forUser(
    userId: string,
  ): AbacContextBuilder<Omit<S, 'hasUserId'> & { hasUserId: Yes }> {
    if (!userId || userId.trim().length === 0) {
      throw new Error('[abac-builder] userId must be non-empty');
    }
    this.userId = userId;
    return this as unknown as AbacContextBuilder<
      Omit<S, 'hasUserId'> & { hasUserId: Yes }
    >;
  }

  withRole(
    role: AuthRole,
    originalRole?: AuthRole,
  ): AbacContextBuilder<Omit<S, 'hasRole'> & { hasRole: Yes }> {
    this.role = role;
    if (originalRole) {
      this.originalUserRole = originalRole;
    }
    return this as unknown as AbacContextBuilder<
      Omit<S, 'hasRole'> & { hasRole: Yes }
    >;
  }

  inTenant(
    tenantId: string,
  ): AbacContextBuilder<Omit<S, 'hasTenantId'> & { hasTenantId: Yes }> {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new Error('[abac-builder] tenantId must be non-empty');
    }
    this.tenantId = tenantId;
    return this as unknown as AbacContextBuilder<
      Omit<S, 'hasTenantId'> & { hasTenantId: Yes }
    >;
  }

  onResource(
    type: ResourceType,
    id: string,
    attributes: Readonly<Record<string, unknown>>,
  ): AbacContextBuilder<Omit<S, 'hasResource'> & { hasResource: Yes }> {
    if (!id || id.trim().length === 0) {
      throw new Error('[abac-builder] resource.id must be non-empty');
    }
    this.resource = Object.freeze({
      type,
      id,
      attributes: Object.freeze({ ...attributes }),
    });
    return this as unknown as AbacContextBuilder<
      Omit<S, 'hasResource'> & { hasResource: Yes }
    >;
  }

  performing(
    action: AbacAction,
  ): AbacContextBuilder<Omit<S, 'hasAction'> & { hasAction: Yes }> {
    this.action = action;
    return this as unknown as AbacContextBuilder<
      Omit<S, 'hasAction'> & { hasAction: Yes }
    >;
  }

  withRequestContext(
    ctx: Partial<AbacRequestContext> & {
      ipAddress: string;
      userAgent: string;
    },
  ): AbacContextBuilder<Omit<S, 'hasRequestContext'> & { hasRequestContext: Yes }> {
    this.requestContext = Object.freeze({
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      timestamp: ctx.timestamp ?? new Date(),
      ...(ctx.requestId && { requestId: ctx.requestId }),
      ...(ctx.traceId && { traceId: ctx.traceId }),
      ...(ctx.mfaElevated !== undefined && { mfaElevated: ctx.mfaElevated }),
    });
    return this as unknown as AbacContextBuilder<
      Omit<S, 'hasRequestContext'> & { hasRequestContext: Yes }
    >;
  }

  withMetadata(metadata: Readonly<Record<string, unknown>>): this {
    this.metadata = Object.freeze({ ...metadata });
    return this;
  }
}

/**
 * Type-level extension : adds .build() method ONLY when state is Complete.
 */
export interface AbacContextBuilder<S extends BuilderState> {
  build: S extends Complete ? () => Readonly<AbacContext> : never;
}

// Implement build at runtime (TypeScript phantom enforces compile-time only).
(AbacContextBuilder.prototype as unknown as Record<string, unknown>).build =
  function buildImpl(this: AbacContextBuilder<Complete>): Readonly<AbacContext> {
    const self = this as unknown as {
      userId: string;
      role: AuthRole;
      tenantId: string;
      originalUserRole?: AuthRole;
      resource: AbacResourceDescriptor;
      action: AbacAction;
      requestContext: AbacRequestContext;
      metadata?: Readonly<Record<string, unknown>>;
    };
    const ctx: AbacContext = {
      userId: self.userId,
      role: self.role,
      tenantId: self.tenantId,
      ...(self.originalUserRole && { originalUserRole: self.originalUserRole }),
      resource: self.resource,
      action: self.action,
      requestContext: self.requestContext,
      ...(self.metadata && { metadata: self.metadata }),
    };
    // Defense-in-depth runtime validation.
    AbacContextSchema.parse(ctx);
    return Object.freeze(ctx);
  };

/**
 * Factory : returns a fresh builder with empty state.
 * The phantom type starts at all `No`, build() is not callable.
 */
export function createAbacContextBuilder(): AbacContextBuilder<{
  hasUserId: No;
  hasRole: No;
  hasTenantId: No;
  hasResource: No;
  hasAction: No;
  hasRequestContext: No;
}> {
  return new AbacContextBuilder();
}
```

### 6.9 Fichier `index.ts` (barrel) (~50 lignes)

```typescript
// repo/packages/auth/src/abac/index.ts
/**
 * @fileoverview Barrel export for @insurtech/auth/abac subpath.
 *
 * Consumers : `import { AbacContext, AbacPolicy, ... } from '@insurtech/auth/abac';`
 *
 * @module @insurtech/auth/abac
 */

// Core interfaces
export type {
  AbacContext,
  AbacPolicy,
  AbacPolicyApplicability,
  AbacResourceDescriptor,
  AbacRequestContext,
} from './types';

export { ABAC_POLICY_NAMES } from './types';
export type { AbacPolicyName } from './types';

// Result types
export type { AbacResult, AllowedResult, DeniedResult, AbacReason } from './abac-result.types';
export {
  ABAC_REASON_CODES,
  AbacReasonSchema,
  AbacResultSchema,
  isAllowedResult,
  isDeniedResult,
  createAllowedResult,
  createDeniedResult,
} from './abac-result.types';

// Resource types
export type { ResourceType } from './resource-types';
export {
  RESOURCE_TYPES_LIST,
  ResourceType as ResourceTypeEnum,
  ResourceTypeSchema,
  assertResourceType,
  isResourceType,
  getResourceTypeFromPermission,
  assertResourceTypeMappingComplete,
} from './resource-types';

// Resource attributes interfaces
export type {
  CrmContactAttributes,
  InsurePolicyAttributes,
  RepairSinistreAttributes,
  PayTransactionAttributes,
  DocDocumentAttributes,
  ResourceAttributesMap,
  InsurePoliceStatus,
  RepairSinistreStatus,
  PayTransactionStatus,
} from './abac-resource.types';
export {
  CrmContactAttributesSchema,
  InsurePolicyAttributesSchema,
  RepairSinistreAttributesSchema,
  PayTransactionAttributesSchema,
  DocDocumentAttributesSchema,
  INSURE_POLICE_STATUSES,
  REPAIR_SINISTRE_STATUSES,
  PAY_TRANSACTION_STATUSES,
  assertResourceAttributes,
} from './abac-resource.types';

// Action enum
export type { AbacAction } from './abac-action.enum';
export {
  ABAC_ACTIONS_LIST,
  AbacAction as AbacActionEnum,
  AbacActionSchema,
  isAbacAction,
  assertAbacAction,
  ACTION_TO_HTTP_VERB,
  DESTRUCTIVE_ACTIONS,
  isDestructiveAction,
} from './abac-action.enum';

// Schemas + serialization
export {
  AbacContextSchema,
  AbacContextSchemaStrict,
  AbacRequestContextSchema,
  AbacResourceDescriptorSchema,
  parseAbacContext,
  safeParseAbacContext,
  serializeAbacContextForAudit,
  deserializeAbacContextFromAudit,
} from './abac-context.schema';
export type {
  AbacContextParsed,
  AbacRequestContextParsed,
  AbacContextSerialized,
} from './abac-context.schema';

// Builder
export { AbacContextBuilder, createAbacContextBuilder } from './abac-context.builder';

// Policy interface helpers
export {
  isPolicyApplicable,
  comparePoliciesPriority,
  assertValidPolicyDeclaration,
  AbacPolicyApplicabilityBuilder,
} from './abac-policy.interface';
export type { AbacPolicyEvaluate } from './abac-policy.interface';
```

### 6.10 Fichier test `types.spec.ts` (~200 lignes)

```typescript
// repo/packages/auth/src/abac/types.spec.ts
/**
 * @fileoverview Tests Vitest for ABAC core types + schemas.
 * Coverage : interface compilation, Zod parsing valid/invalid, type narrowing,
 * builder pattern, serialization roundtrip.
 *
 * @module @insurtech/auth/abac/types.spec
 */

import { describe, it, expect } from 'vitest';
import {
  AbacContextSchema,
  AbacResultSchema,
  parseAbacContext,
  safeParseAbacContext,
  serializeAbacContextForAudit,
  deserializeAbacContextFromAudit,
} from './abac-context.schema';
import {
  createAllowedResult,
  createDeniedResult,
  isAllowedResult,
  isDeniedResult,
  ABAC_REASON_CODES,
} from './abac-result.types';
import {
  ResourceTypeSchema,
  RESOURCE_TYPES_LIST,
  assertResourceType,
  getResourceTypeFromPermission,
  assertResourceTypeMappingComplete,
} from './resource-types';
import {
  AbacActionSchema,
  ABAC_ACTIONS_LIST,
  isDestructiveAction,
} from './abac-action.enum';
import { ABAC_POLICY_NAMES } from './types';

const VALID_CONTEXT = {
  userId: '11111111-1111-1111-1111-111111111111',
  role: 'broker_user' as const,
  tenantId: '22222222-2222-2222-2222-222222222222',
  resource: {
    type: 'crm_contact' as const,
    id: '33333333-3333-3333-3333-333333333333',
    attributes: {
      owner_user_id: '11111111-1111-1111-1111-111111111111',
      tenant_id: '22222222-2222-2222-2222-222222222222',
    },
  },
  action: 'update' as const,
  requestContext: {
    ipAddress: '192.168.1.1',
    userAgent: 'curl/7.88.1',
    timestamp: new Date('2026-05-05T10:00:00Z'),
  },
};

describe('AbacContext schema', () => {
  it('V1: parses a valid context successfully', () => {
    const result = AbacContextSchema.safeParse(VALID_CONTEXT);
    expect(result.success).toBe(true);
  });

  it('V2: rejects context with missing userId', () => {
    const { userId: _u, ...invalid } = VALID_CONTEXT;
    const result = AbacContextSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('V3: rejects invalid resource.type string', () => {
    const invalid = {
      ...VALID_CONTEXT,
      resource: { ...VALID_CONTEXT.resource, type: 'unknown_type' },
    };
    expect(() => parseAbacContext(invalid)).toThrow();
  });

  it('V4: rejects invalid action', () => {
    const invalid = { ...VALID_CONTEXT, action: 'frobnicate' };
    expect(() => parseAbacContext(invalid)).toThrow();
  });

  it('V5: accepts originalUserRole for impersonation', () => {
    const impersonated = { ...VALID_CONTEXT, originalUserRole: 'super_admin_platform' as const };
    const result = AbacContextSchema.safeParse(impersonated);
    expect(result.success).toBe(true);
  });

  it('V6: coerces ISO 8601 string timestamp to Date', () => {
    const fromJson = {
      ...VALID_CONTEXT,
      requestContext: { ...VALID_CONTEXT.requestContext, timestamp: '2026-05-05T10:00:00Z' },
    };
    const result = parseAbacContext(fromJson);
    expect(result.requestContext.timestamp).toBeInstanceOf(Date);
  });

  it('V7: rejects invalid IP format', () => {
    const invalid = {
      ...VALID_CONTEXT,
      requestContext: { ...VALID_CONTEXT.requestContext, ipAddress: 'not-an-ip!' },
    };
    expect(() => parseAbacContext(invalid)).toThrow();
  });

  it('V8: safeParseAbacContext returns Result type', () => {
    const ok = safeParseAbacContext(VALID_CONTEXT);
    expect(ok.success).toBe(true);
    const ko = safeParseAbacContext({ foo: 'bar' });
    expect(ko.success).toBe(false);
  });
});

describe('AbacResult discriminated union', () => {
  it('V9: createAllowedResult returns frozen allowed object', () => {
    const r = createAllowedResult('OwnResourcesPolicy');
    expect(r.allowed).toBe(true);
    expect(r.appliedPolicy).toBe('OwnResourcesPolicy');
    expect(Object.isFrozen(r)).toBe(true);
  });

  it('V10: createDeniedResult requires reason', () => {
    expect(() => createDeniedResult('p', '')).toThrow(/reason is required/);
  });

  it('V11: createAllowedResult rejects empty policy name', () => {
    expect(() => createAllowedResult('')).toThrow(/appliedPolicy is required/);
  });

  it('V12: type guards isAllowedResult / isDeniedResult', () => {
    const a = createAllowedResult('p');
    const d = createDeniedResult('p', 'no', ABAC_REASON_CODES.NOT_OWNER);
    expect(isAllowedResult(a)).toBe(true);
    expect(isDeniedResult(d)).toBe(true);
    expect(isAllowedResult(d)).toBe(false);
  });

  it('V13: AbacResultSchema validates discriminated union', () => {
    const a = createAllowedResult('p');
    const d = createDeniedResult('p', 'no');
    expect(AbacResultSchema.safeParse(a).success).toBe(true);
    expect(AbacResultSchema.safeParse(d).success).toBe(true);
  });

  it('V14: AbacResultSchema rejects denied without reason', () => {
    expect(
      AbacResultSchema.safeParse({ allowed: false, appliedPolicy: 'p' }).success,
    ).toBe(false);
  });
});

describe('ResourceType helpers', () => {
  it('V15: RESOURCE_TYPES_LIST has expected 5 canonical types', () => {
    expect(RESOURCE_TYPES_LIST).toEqual([
      'crm_contact',
      'insure_police',
      'repair_sinistre',
      'pay_transaction',
      'doc_document',
    ]);
  });

  it('V16: assertResourceType throws on invalid', () => {
    expect(() => assertResourceType('unknown')).toThrow();
  });

  it('V17: getResourceTypeFromPermission maps known permissions', () => {
    expect(getResourceTypeFromPermission('crm.contacts.read_own')).toBe('crm_contact');
    expect(getResourceTypeFromPermission('insure.policies.cancel')).toBe('insure_police');
    expect(getResourceTypeFromPermission('repair.sinistres.close')).toBe('repair_sinistre');
    expect(getResourceTypeFromPermission('pay.refunds.create')).toBe('pay_transaction');
    expect(getResourceTypeFromPermission('docs.documents.read_own')).toBe('doc_document');
  });

  it('V18: getResourceTypeFromPermission returns null for non-resource permissions', () => {
    expect(getResourceTypeFromPermission('admin.tenants.suspend' as never)).toBeNull();
  });

  it('V19: assertResourceTypeMappingComplete passes with full mapping', () => {
    expect(() =>
      assertResourceTypeMappingComplete([
        'crm.contacts.read_own',
        'insure.policies.read_own',
      ] as never),
    ).not.toThrow();
  });

  it('V20: assertResourceTypeMappingComplete throws if _own without mapping', () => {
    expect(() =>
      assertResourceTypeMappingComplete(['marketing.campaigns.update_own'] as never),
    ).toThrow(/Unmapped permissions/);
  });
});

describe('AbacAction enum', () => {
  it('V21: ABAC_ACTIONS_LIST contains 12 canonical actions', () => {
    expect(ABAC_ACTIONS_LIST).toContain('read');
    expect(ABAC_ACTIONS_LIST).toContain('create');
    expect(ABAC_ACTIONS_LIST).toContain('refund');
    expect(ABAC_ACTIONS_LIST.length).toBe(12);
  });

  it('V22: AbacActionSchema rejects unknown action', () => {
    expect(AbacActionSchema.safeParse('frobnicate').success).toBe(false);
  });

  it('V23: isDestructiveAction true for delete/cancel/refund', () => {
    expect(isDestructiveAction('delete')).toBe(true);
    expect(isDestructiveAction('cancel')).toBe(true);
    expect(isDestructiveAction('refund')).toBe(true);
    expect(isDestructiveAction('read')).toBe(false);
  });
});

describe('Serialization roundtrip', () => {
  it('V24: serializeAbacContextForAudit produces stable JSON', () => {
    const parsed = parseAbacContext(VALID_CONTEXT);
    const serialized = serializeAbacContextForAudit(parsed);
    expect(serialized._serialized_v).toBe(1);
    expect(typeof serialized.requestContext.timestamp).toBe('string');
  });

  it('V25: roundtrip serialize -> deserialize preserves content', () => {
    const parsed = parseAbacContext(VALID_CONTEXT);
    const serialized = serializeAbacContextForAudit(parsed);
    const restored = deserializeAbacContextFromAudit(serialized);
    expect(restored.userId).toBe(parsed.userId);
    expect(restored.requestContext.timestamp.toISOString()).toBe(
      parsed.requestContext.timestamp.toISOString(),
    );
  });
});

describe('ABAC_POLICY_NAMES constants', () => {
  it('V26: 4 fundamental policies named', () => {
    expect(ABAC_POLICY_NAMES.OWN_RESOURCES).toBe('OwnResourcesPolicy');
    expect(ABAC_POLICY_NAMES.TIME_BASED).toBe('TimeBasedPolicy');
    expect(ABAC_POLICY_NAMES.STATUS_BASED).toBe('StatusBasedPolicy');
    expect(ABAC_POLICY_NAMES.WORKFLOW_STATE).toBe('WorkflowStatePolicy');
  });
});
```

### 6.11 Fichier test `abac-context-builder.spec.ts` (~120 lignes)

```typescript
// repo/packages/auth/src/abac/abac-context-builder.spec.ts
/**
 * @fileoverview Tests for AbacContextBuilder type-safe pattern.
 *
 * @module @insurtech/auth/abac/abac-context-builder.spec
 */

import { describe, it, expect } from 'vitest';
import { createAbacContextBuilder } from './abac-context.builder';

const FIXTURE = {
  userId: '11111111-1111-1111-1111-111111111111',
  role: 'broker_user' as const,
  tenantId: '22222222-2222-2222-2222-222222222222',
  resourceId: '33333333-3333-3333-3333-333333333333',
};

describe('AbacContextBuilder', () => {
  it('B1: builds a complete context with all fields set', () => {
    const ctx = createAbacContextBuilder()
      .forUser(FIXTURE.userId)
      .withRole(FIXTURE.role)
      .inTenant(FIXTURE.tenantId)
      .onResource('crm_contact', FIXTURE.resourceId, {
        owner_user_id: FIXTURE.userId,
        tenant_id: FIXTURE.tenantId,
      })
      .performing('update')
      .withRequestContext({
        ipAddress: '127.0.0.1',
        userAgent: 'test',
      })
      .build();
    expect(ctx.userId).toBe(FIXTURE.userId);
    expect(ctx.role).toBe(FIXTURE.role);
    expect(ctx.tenantId).toBe(FIXTURE.tenantId);
    expect(ctx.resource.type).toBe('crm_contact');
    expect(ctx.action).toBe('update');
  });

  it('B2: returned context is frozen (immutable)', () => {
    const ctx = createAbacContextBuilder()
      .forUser(FIXTURE.userId)
      .withRole(FIXTURE.role)
      .inTenant(FIXTURE.tenantId)
      .onResource('crm_contact', FIXTURE.resourceId, {})
      .performing('read')
      .withRequestContext({ ipAddress: '127.0.0.1', userAgent: 'test' })
      .build();
    expect(Object.isFrozen(ctx)).toBe(true);
    expect(Object.isFrozen(ctx.resource)).toBe(true);
  });

  it('B3: rejects empty userId', () => {
    expect(() => createAbacContextBuilder().forUser('')).toThrow(/non-empty/);
  });

  it('B4: rejects empty tenantId', () => {
    expect(() =>
      createAbacContextBuilder().forUser(FIXTURE.userId).withRole(FIXTURE.role).inTenant(''),
    ).toThrow(/non-empty/);
  });

  it('B5: rejects empty resource.id', () => {
    expect(() =>
      createAbacContextBuilder()
        .forUser(FIXTURE.userId)
        .withRole(FIXTURE.role)
        .inTenant(FIXTURE.tenantId)
        .onResource('crm_contact', '', {}),
    ).toThrow(/non-empty/);
  });

  it('B6: supports impersonation via withRole(role, originalRole)', () => {
    const ctx = createAbacContextBuilder()
      .forUser(FIXTURE.userId)
      .withRole('broker_user', 'super_admin_platform')
      .inTenant(FIXTURE.tenantId)
      .onResource('crm_contact', FIXTURE.resourceId, {})
      .performing('read')
      .withRequestContext({ ipAddress: '127.0.0.1', userAgent: 'test' })
      .build();
    expect(ctx.originalUserRole).toBe('super_admin_platform');
  });

  it('B7: defaults timestamp to now if not provided', () => {
    const before = Date.now();
    const ctx = createAbacContextBuilder()
      .forUser(FIXTURE.userId)
      .withRole(FIXTURE.role)
      .inTenant(FIXTURE.tenantId)
      .onResource('crm_contact', FIXTURE.resourceId, {})
      .performing('read')
      .withRequestContext({ ipAddress: '127.0.0.1', userAgent: 'test' })
      .build();
    const after = Date.now();
    expect(ctx.requestContext.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(ctx.requestContext.timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  it('B8: supports requestId + traceId optional fields', () => {
    const ctx = createAbacContextBuilder()
      .forUser(FIXTURE.userId)
      .withRole(FIXTURE.role)
      .inTenant(FIXTURE.tenantId)
      .onResource('crm_contact', FIXTURE.resourceId, {})
      .performing('read')
      .withRequestContext({
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        requestId: '44444444-4444-4444-4444-444444444444',
        traceId: 'trace-abc-123',
        mfaElevated: true,
      })
      .build();
    expect(ctx.requestContext.requestId).toBe('44444444-4444-4444-4444-444444444444');
    expect(ctx.requestContext.traceId).toBe('trace-abc-123');
    expect(ctx.requestContext.mfaElevated).toBe(true);
  });

  it('B9: withMetadata accepts custom fields', () => {
    const ctx = createAbacContextBuilder()
      .forUser(FIXTURE.userId)
      .withRole(FIXTURE.role)
      .inTenant(FIXTURE.tenantId)
      .onResource('crm_contact', FIXTURE.resourceId, {})
      .performing('read')
      .withRequestContext({ ipAddress: '127.0.0.1', userAgent: 'test' })
      .withMetadata({ _v: 1, custom: 'foo' })
      .build();
    expect(ctx.metadata?.['custom']).toBe('foo');
    expect(ctx.metadata?._v).toBe(1);
  });

  it('B10: build() runs Zod validation defense-in-depth', () => {
    // Force a malformed state via casting to bypass phantom types.
    const builder = createAbacContextBuilder()
      .forUser(FIXTURE.userId)
      .withRole(FIXTURE.role)
      .inTenant(FIXTURE.tenantId)
      .onResource('crm_contact', FIXTURE.resourceId, {})
      .performing('read')
      .withRequestContext({ ipAddress: 'not-valid!', userAgent: 'test' });
    expect(() => builder.build()).toThrow();
  });
});
```

### 6.12 Fichier test `resource-types.spec.ts` (~80 lignes)

```typescript
// repo/packages/auth/src/abac/resource-types.spec.ts
/**
 * @fileoverview Tests for resource-types helpers + assert helpers.
 *
 * @module @insurtech/auth/abac/resource-types.spec
 */

import { describe, it, expect } from 'vitest';
import {
  RESOURCE_TYPES_LIST,
  ResourceType,
  ResourceTypeSchema,
  assertResourceType,
  isResourceType,
  getResourceTypeFromPermission,
  assertResourceTypeMappingComplete,
} from './resource-types';
import {
  assertResourceAttributes,
  CrmContactAttributesSchema,
} from './abac-resource.types';

describe('RESOURCE_TYPES_LIST + ResourceType enum', () => {
  it('R1: list contains exactly 5 canonical types', () => {
    expect(RESOURCE_TYPES_LIST.length).toBe(5);
  });

  it('R2: companion enum keys match list values', () => {
    expect(ResourceType.CrmContact).toBe('crm_contact');
    expect(ResourceType.InsurePolice).toBe('insure_police');
    expect(ResourceType.RepairSinistre).toBe('repair_sinistre');
    expect(ResourceType.PayTransaction).toBe('pay_transaction');
    expect(ResourceType.DocDocument).toBe('doc_document');
  });

  it('R3: ResourceTypeSchema accepts each canonical type', () => {
    for (const t of RESOURCE_TYPES_LIST) {
      expect(ResourceTypeSchema.safeParse(t).success).toBe(true);
    }
  });

  it('R4: ResourceTypeSchema rejects unknown', () => {
    expect(ResourceTypeSchema.safeParse('garage_invoice').success).toBe(false);
  });

  it('R5: assertResourceType throws on invalid', () => {
    expect(() => assertResourceType(123)).toThrow();
    expect(() => assertResourceType(null)).toThrow();
  });

  it('R6: isResourceType type guard works', () => {
    expect(isResourceType('crm_contact')).toBe(true);
    expect(isResourceType('foo')).toBe(false);
  });
});

describe('Permission -> ResourceType mapping', () => {
  it('R7: mapping covers all _own permissions', () => {
    const ownPerms = [
      'crm.contacts.read_own',
      'insure.policies.read_own',
      'repair.sinistres.read_own',
      'pay.transactions.read_own',
      'docs.documents.read_own',
    ];
    for (const p of ownPerms) {
      expect(getResourceTypeFromPermission(p as never)).not.toBeNull();
    }
  });

  it('R8: assertResourceTypeMappingComplete passes for valid catalog subset', () => {
    expect(() =>
      assertResourceTypeMappingComplete([
        'crm.contacts.read_own',
        'crm.contacts.update_own',
      ] as never),
    ).not.toThrow();
  });
});

describe('assertResourceAttributes narrowing', () => {
  it('R9: narrows valid CrmContactAttributes', () => {
    const attrs = {
      owner_user_id: '11111111-1111-1111-1111-111111111111',
      created_at: '2026-05-05T10:00:00Z',
      updated_at: '2026-05-05T10:00:00Z',
      tenant_id: '22222222-2222-2222-2222-222222222222',
    };
    const narrowed = assertResourceAttributes(attrs, 'crm_contact');
    expect(narrowed.owner_user_id).toBe('11111111-1111-1111-1111-111111111111');
    expect(narrowed.created_at).toBeInstanceOf(Date);
  });

  it('R10: throws on missing required CrmContactAttributes field', () => {
    expect(() =>
      assertResourceAttributes({ tenant_id: 'x' }, 'crm_contact'),
    ).toThrow();
  });
});
```

---

## 7. Tests complets -- 25+ tests Vitest

Les tests sont repartis sur 3 fichiers `types.spec.ts` (V1-V26 = 26 tests), `abac-context-builder.spec.ts` (B1-B10 = 10 tests), `resource-types.spec.ts` (R1-R10 = 10 tests). Total : **46 tests** Vitest unitaires couvrant :

- Compilation TypeScript stricte des interfaces (verification `tsc --noEmit` passe)
- Parsing Zod valide (V1, B1, R3) et invalide (V2, V3, V4, V7, R4, R5)
- Type narrowing des helpers (V12, R6, R9)
- Builder pattern phantom types compile-time + runtime (B1-B10)
- Resource type mapping helpers (V17-V20, R7-R8)
- Action enum + destructive set (V21-V23)
- Serialization roundtrip pour audit (V24-V25)
- Constantes ABAC_POLICY_NAMES coherentes avec policies Tache 2.3.7 (V26)
- Assertion helpers throw avec messages explicites (V11, V14, B3-B5, R10)

Coverage cible : **statements 95%, branches 90%, functions 100%** (verifie via `vitest --coverage` Sprint 7 livrable critere V21+).

---

## 8. Variables environnement

| Variable | Defaut | Description |
|----------|--------|-------------|
| `ABAC_TYPES_STRICT_VALIDATION` | `false` | Active mode `AbacContextSchemaStrict.parse` au lieu de `AbacContextSchema.parse` (rejette unknown top-level fields). Utilise par builder.build() si true. |
| `ABAC_BUILDER_DEBUG` | `false` | Active logs Pino debug pour chaque etape builder (utile dev / troubleshoot serialization audit replay). |
| `ABAC_AUDIT_SERIALIZATION_VERSION` | `1` | Version du format AbacContextSerialized utilise pour write audit. Lecture supporte tous numbers. |

Ajouter dans `repo/.env.example` :

```bash
# ABAC Types Validation (Tache 2.3.6)
ABAC_TYPES_STRICT_VALIDATION=false
ABAC_BUILDER_DEBUG=false
ABAC_AUDIT_SERIALIZATION_VERSION=1
```

Charger dans `repo/packages/auth/src/abac/config.ts` (mini config helper) si besoin, mais Tache 2.3.6 reste type-only -- consommation env est dans Tache 2.3.7.

---

## 9. Commandes shell

```bash
# 1. Creer la structure de dossier
mkdir -p repo/packages/auth/src/abac

# 2. Creer chaque fichier (cf. Section 6 contenus)
touch repo/packages/auth/src/abac/types.ts
touch repo/packages/auth/src/abac/resource-types.ts
touch repo/packages/auth/src/abac/abac-context.builder.ts
touch repo/packages/auth/src/abac/abac-context.schema.ts
touch repo/packages/auth/src/abac/abac-policy.interface.ts
touch repo/packages/auth/src/abac/abac-result.types.ts
touch repo/packages/auth/src/abac/abac-resource.types.ts
touch repo/packages/auth/src/abac/abac-action.enum.ts
touch repo/packages/auth/src/abac/types.spec.ts
touch repo/packages/auth/src/abac/abac-context-builder.spec.ts
touch repo/packages/auth/src/abac/resource-types.spec.ts
touch repo/packages/auth/src/abac/index.ts

# 3. Update barrel auth index
echo "export * from './abac';" >> repo/packages/auth/src/index.ts

# 4. Verifier la compilation TypeScript stricte
pnpm --filter @insurtech/auth typecheck

# 5. Lancer les tests Vitest
pnpm --filter @insurtech/auth test abac/types.spec.ts
pnpm --filter @insurtech/auth test abac/abac-context-builder.spec.ts
pnpm --filter @insurtech/auth test abac/resource-types.spec.ts

# 6. Tests complets avec coverage
pnpm --filter @insurtech/auth test --coverage abac/

# 7. Verifier lint Biome (ou ESLint Sprint 1)
pnpm --filter @insurtech/auth lint

# 8. Verifier audit dependencies (Zod 3.24.1 deja present Sprint 1)
pnpm --filter @insurtech/auth list zod

# 9. Tester que le barrel export fonctionne (smoke import)
node -e "const a = require('./packages/auth/dist/abac'); console.log(Object.keys(a));"

# 10. Pre-commit hook (Sprint 2 husky)
pnpm pre-commit
```

---

## 10. Criteres validation (V1-V25+)

| ID | Priorite | Critere | Commande verification |
|----|----------|---------|------------------------|
| V1 | P0 | Interfaces compilent en TypeScript strict | `pnpm --filter @insurtech/auth typecheck` exit 0 |
| V2 | P0 | AbacContext couvre les 4 policies cibles Tache 2.3.7 | `grep -E "OwnResourcesPolicy\|TimeBasedPolicy\|StatusBasedPolicy\|WorkflowStatePolicy" repo/packages/auth/src/abac/types.ts` retourne 4 occurrences (constants ABAC_POLICY_NAMES) |
| V3 | P0 | AbacResult.allowed boolean + reason optional sur Allowed, required sur Denied | `pnpm test abac/types.spec.ts -t "AbacResultSchema"` pass |
| V4 | P0 | ResourceType union 5 valeurs canoniques + Zod enum + companion enum | `pnpm test resource-types.spec.ts -t "list contains exactly 5"` pass |
| V5 | P1 | Zod schemas miroirs runtime validation | `pnpm test types.spec.ts -t "AbacContextSchema"` 8+ tests pass |
| V6 | P0 | Builder pattern type-safe (compile error si build prematuree) | Inspect `tsc --noEmit` rejette `createAbacContextBuilder().build()` direct (no `build()` exposed sur No-state) |
| V7 | P0 | createAllowedResult / createDeniedResult enforce required fields | `pnpm test types.spec.ts -t "createDeniedResult requires reason"` pass |
| V8 | P0 | Type guards isAllowedResult / isDeniedResult fonctionnent | `pnpm test types.spec.ts -t "type guards"` pass |
| V9 | P0 | getResourceTypeFromPermission mapping exhaustif 5 resource types | `pnpm test resource-types.spec.ts -t "_own permissions"` pass |
| V10 | P0 | assertResourceTypeMappingComplete throw si mapping incomplet | `pnpm test resource-types.spec.ts -t "assertResourceTypeMappingComplete throws"` pass |
| V11 | P0 | Builder retourne Readonly<AbacContext> immutable (Object.freeze) | `pnpm test abac-context-builder.spec.ts -t "frozen"` pass |
| V12 | P0 | Serialization audit roundtrip preserve timestamp ISO 8601 | `pnpm test types.spec.ts -t "roundtrip serialize"` pass |
| V13 | P0 | Builder rejette userId/tenantId/resourceId vides | `pnpm test abac-context-builder.spec.ts -t "rejects empty"` 3 tests pass |
| V14 | P0 | AbacResultSchema rejette denied sans reason | `pnpm test types.spec.ts -t "rejects denied without reason"` pass |
| V15 | P0 | Zod schema accepte ISO 8601 string timestamp et coerce en Date | `pnpm test types.spec.ts -t "coerces ISO 8601"` pass |
| V16 | P0 | Schema rejette IP format invalide | `pnpm test types.spec.ts -t "rejects invalid IP"` pass |
| V17 | P0 | originalUserRole (impersonation) supporte | `pnpm test types.spec.ts -t "originalUserRole"` pass |
| V18 | P0 | AbacAction enum 12 valeurs + destructive subset 5 | `pnpm test types.spec.ts -t "ABAC_ACTIONS_LIST"` + "isDestructiveAction" pass |
| V19 | P1 | Resource attributes interfaces typed-strict (5 interfaces + Zod) | `grep -c "AttributesSchema" repo/packages/auth/src/abac/abac-resource.types.ts` >= 5 |
| V20 | P1 | assertResourceAttributes narrowing fonctionne par resource type | `pnpm test resource-types.spec.ts -t "narrows valid"` pass |
| V21 | P0 | Coverage tests >= 95% statements / 90% branches / 100% functions | `pnpm test --coverage abac/` rapport conforme thresholds |
| V22 | P0 | Aucune emoji dans tous les fichiers livres | `grep -rE "[\x{1F300}-\x{1FAFF}]" repo/packages/auth/src/abac/` retourne vide |
| V23 | P0 | Barrel index.ts re-exporte tous les artefacts publics | `grep -c "export" repo/packages/auth/src/abac/index.ts` >= 30 |
| V24 | P1 | JSDoc presente sur chaque interface + helper public | `grep -B1 "export interface\|export function" repo/packages/auth/src/abac/types.ts \| grep -c "/\*\*"` >= count interfaces |
| V25 | P0 | Pre-commit hook passe (lint + typecheck + tests) | `pnpm pre-commit` exit 0 |
| V26 | P1 | Serialization version field _serialized_v: 1 present | `pnpm test types.spec.ts -t "serializeAbacContextForAudit"` pass |
| V27 | P1 | comparePoliciesPriority sort descending | Test fixture in 2.3.7 mock policies, V27 verifie via grep helper exporte |

---

## 11. Edge cases (10+ documentes)

### 11.1 EC-1 : `attributes: Record<string, unknown>` vs strict typed -- collision

**Scenario** : DB stocke `crm_contact.owner_user_id` historique en `INTEGER` (avant migration UUID). Apres migration partielle, certaines lignes ont `INTEGER` legacy, d'autres `UUID v7`. Le `assertResourceAttributes(attrs, 'crm_contact')` throw sur lignes legacy.

**Resolution** : Tache 2.3.6 ne fait QUE le narrowing helper. Migration data est responsabilite separee Sprint 8. Documentation pose le pattern : si throw, fallback bypass-policy + log Sentry critique. Tache 2.3.7 implementera le fallback.

### 11.2 EC-2 : Resource type unknown dans permission

**Scenario** : Sprint 32 ajoute permission `connectors.acaps.invoke`. Le `getResourceTypeFromPermission('connectors.acaps.invoke')` retourne `null`. Sans mapping, AbacService Tache 2.3.7 ne route a aucune policy -> RBAC seul applique.

**Resolution** : Comportement attendu (les permissions sans resource-instance ne necessitent pas ABAC). Tests V18 valident le `null` return. Documentation README explicit. Helper `assertResourceTypeMappingComplete` ne checke QUE les `_own` / `_assigned` (pas les autres).

### 11.3 EC-3 : `AbacContext` sans userId (admin cron worker)

**Scenario** : Cron Sprint 12 audit purge invoque `AbacService.evaluate('system_worker', 'compliance.cndp_purge.execute', context)`. Mais `context.userId` est requis par interface. Le worker n'a pas de user.

**Resolution** : Builder REJETTE userId vide. Le worker doit utiliser un user technique virtuel `system-worker-uuid` (UUID stable du worker, fixture seed Sprint 7). Documentation `00-pilotage/decisions/decision-019-system-worker-virtual-user.md` justifie.

### 11.4 EC-4 : `AbacResult.appliedPolicy` missing -> audit corruption

**Scenario** : Dev ecrit `return { allowed: false, reason: 'no' }` dans nouvelle policy custom Sprint 25. Manque `appliedPolicy`. Audit log `applied_policy = NULL` -> conformite violee.

**Resolution** : Factory helpers `createAllowedResult` / `createDeniedResult` enforcent. Lint rule `no-direct-abac-result-literal` (custom Sprint 7 livraison) interdit `{ allowed: ..., appliedPolicy: ... }` literal direct, force factory. Tests V11 / V14 verifient throw.

### 11.5 EC-5 : Builder partial state (compile vs runtime)

**Scenario** : Dev fait `createAbacContextBuilder().forUser('u').build()`. Phantom types refusent `build()` (n'existe pas sur incomplete state). Mais cast `as any` bypass et runtime throw.

**Resolution** : Phantom types compile-time + Zod schema runtime validation dans `build()`. Double protection. Tests B10 verifie runtime throw avec cast.

### 11.6 EC-6 : Zod schema strict vs lax mode + future extensibility

**Scenario** : Sprint 14 ajoute champ `mfa_required` au AbacRequestContext. Si schema strict mode active (`ABAC_TYPES_STRICT_VALIDATION=true`), ancien cache Redis (sans le champ) parse fail.

**Resolution** : Defaut `false` (mode passthrough). Strict mode opt-in production critique seulement. Migration cache Redis Sprint 14 invalide pre-deploy. Documentation explicit.

### 11.7 EC-7 : Future custom resource types (Sprint 24+)

**Scenario** : Sprint 24 ajoute `mobile_assure_request`. Doit etendre union ResourceType + ajouter interface MobileAssureAttributes + mapping permission.

**Resolution** : Pattern documente dans Section 13 du fichier `types.ts` JSDoc. Migration ajoute (a) entry dans RESOURCE_TYPES_LIST, (b) entry dans companion enum, (c) interface dans abac-resource.types.ts, (d) entries dans PERMISSION_TO_RESOURCE_TYPE, (e) entry dans ATTRIBUTES_SCHEMA_MAP, (f) export barrel, (g) tests.

### 11.8 EC-8 : Serialization JSON pour audit -- functions / Date / undefined

**Scenario** : Test V25 effectue roundtrip `serialize -> JSON.stringify -> JSON.parse -> deserialize`. Si attributes contient une function (ne devrait jamais arriver mais defensive), `JSON.stringify` l'omet silencieusement.

**Resolution** : `serializeAbacContextForAudit` clone explicit attributes + force keys primitives. Documentation explicit "do not store functions in attributes". Tests V25 verifie content identique.

### 11.9 EC-9 : Race condition AbacContext mutation pendant evaluation

**Scenario** : Si policy 1 mute `context.resource.attributes` (bug), policy 2 evaluee subsequemment voit la mutation -> decision incoherente.

**Resolution** : Builder retourne Object.freeze recursive. Tentative mutation throw `TypeError: Cannot assign to read only property` en strict mode (TypeScript strict mode active globalement Sprint 1). Tests B2 verifie frozen.

### 11.10 EC-10 : Audit replay attack (Sprint 33 pentest)

**Scenario** : Attaquant intercepte un audit log AbacContextSerialized (allowed=true), modifie `userId`, replay via API admin debug Sprint 30 MCP tool.

**Resolution** : `_serialized_v` field permet detection version mismatch. Audit log signe HMAC SHA-256 (Tache 2.3.10 livraison) avec key per-tenant -- tampering detect. Tests Sprint 33 pentest verifient.

### 11.11 EC-11 : `originalUserRole` impersonation chain trop profonde

**Scenario** : super_admin impersone broker_admin qui impersone broker_user. `originalUserRole` ne stocke qu'UN niveau, pas chain.

**Resolution** : Sprint 26 explicit interdit chained impersonation (regle business + tech). `originalUserRole` est OPTIONAL et single-level. Documentation explicit.

### 11.12 EC-12 : MFA elevation flag oublie

**Scenario** : Endpoint `/api/v1/admin/tenants/suspend` requiert MFA fresh (<5 min). `requestContext.mfaElevated` est OPTIONAL -- si pas set, comportement par defaut pas defini.

**Resolution** : Tache 2.3.6 livre uniquement le champ optional. Tache 2.3.8 AbacResourceGuard force la lecture session MFA et set explicit `true|false`. Tache 2.3.7 policies peuvent inspecter ce champ. Documentation pose convention "treat undefined as false (defensive)".

---

## 12. Conformite Maroc detaillee

### 12.1 ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

**Reference reglementaire** : Circulaire ACAPS n.04/2019 article 7 (Separation des responsabilites Maker/Checker), article 12 (Tracabilite des decisions d'autorisation), Code des Assurances Loi 17-99 article 245 (Audit des operations).

**Application Tache 2.3.6** : Les interfaces `AbacContext` et `AbacResult` doivent **structurellement permettre** la tracabilite ACAPS au point de decision. Concretement :
- `AbacResult.appliedPolicy` est REQUIRED (cf. piege #5) -- ACAPS exige savoir quelle regle a denied.
- `AbacResult.reason` est REQUIRED sur DeniedResult -- ACAPS exige justification humaine-lisible.
- `AbacContext.userId` + `tenantId` + `originalUserRole` permettent identification triple (qui agit, sur quel tenant, et qui realement decide si impersonation).
- `AbacContext.requestContext.timestamp` + `ipAddress` + `userAgent` permettent reconstitution forensique (Sprint 33 pentest).

**Limitation reconnue** : ABAC seul ne couvre pas les regles ACAPS de "double approbation Maker/Checker" (Sprint 12 livre WorkflowStatePolicy etendu avec field `approvers_required: AuthRole[]`).

### 12.2 AMC (Anti-Money-Laundering Compliance / Loi 43-05 lutte anti-blanchiment)

**Reference** : Loi 43-05 articles 2-3 (Identification beneficiaire effectif), article 16 (Conservation 10 ans des operations), Decret 2-08-1011 (Listes vigilance ACAPS / OFAC).

**Application Tache 2.3.6** : ABAC est utilise pour les transactions sensibles necessitant verification additionnelle :
- Permission `pay.refunds.create` (ABAC TimeBasedPolicy 30j Loi 17-99) ET `pay.refunds.create_high_value` (ABAC AmountBasedPolicy >50k MAD Sprint 13 livraison) requiert MFA + `mfaElevated: true` dans context.
- Interface `AbacContext.requestContext.mfaElevated` est specifiquement liee a AMC : si action destructive sur transaction high-value, AbacResourceGuard Tache 2.3.8 doit forcer MFA fresh check.
- Audit log ABAC (Tache 2.3.10) inclut le `appliedPolicy` qui peut etre `AmlComplianceOfficerOnlyPolicy` (Sprint 12).

### 12.3 CNDP (Commission Nationale de controle de la protection des Donnees Personnelles -- Loi 09-08)

**Reference** : Loi 09-08 articles 1-3 (Definitions), article 8 (Consentement), article 18 (Tracabilite acces donnees personnelles), article 30 (Securite organisationnelle).

**Application Tache 2.3.6** : Article 18 (Tracabilite acces) est la pierre angulaire :
- `AbacContext` documente STRUCTURE (qui, quoi, quand, ou) le minimum requis pour audit Loi 09-08.
- `AbacResult.reason` (REQUIRED sur Denied) documente la decision pour compliance officer review.
- Principe **minimisation attributs** (article 4 Loi 09-08) : les `TypedAttributes` interfaces (CrmContactAttributes, etc.) listent EXPLICITEMENT les attributs necessaires a la decision. Pas de `attributes: any` -- chaque field a une justification documentee. Le helper `assertResourceAttributes` enforce.
- **Pseudonymisation attributs sensibles** : si attributes contient PII (telephone, email), serialization audit doit pseudonymiser. Tache 2.3.10 livre la pseudonymisation. Tache 2.3.6 livre uniquement le hook `serializeAbacContextForAudit` qui sera surcharge.

**Specifique CNDP** : la duree retention audit ABAC est 5 ans (decret n.2-09-165 article 5) -- duree fixee dans Tache 2.3.10 schema DB.

### 12.4 BAM (Bank Al-Maghrib -- Directive 1/W/2016)

**Reference** : Directive BAM 1/W/2016 sur la gestion du risque operationnel + Decret 2-19-1004 (paiement electronique).

**Application Tache 2.3.6** : Pas applicable directement (BAM concerne paiement, pas authz). Indirectement, les types ABAC permettront a Sprint 13 (Pay) d'implementer policies BAM-conformes (StatusBasedPolicy sur `pay.transactions.refund` necessitant `transaction.gateway === 'cmi'` + status whitelist).

---

## 13. Conventions absolues skalean-insurtech

- **AUCUNE EMOJI** dans le code, comments, JSDoc, error messages, audit logs, README. Toute emoji introduite = rejet PR automatique (lint rule `no-emojis` Sprint 1 livraison).
- **TypeScript 5.7.3 strict mode** : tsconfig `"strict": true, "exactOptionalPropertyTypes": true, "noUncheckedIndexedAccess": true, "noImplicitOverride": true`. Aucun `any`, aucun cast `as` non-justifie en commentaire JSDoc. Tous les exports `interface` ou `type` (no `class` sauf Builder).
- **Naming** : interfaces `PascalCase`, types `PascalCase`, constants `UPPER_SNAKE_CASE`, files `kebab-case.ts`, test files `*.spec.ts`. Resource types snake_case singular (`crm_contact`).
- **Immutability** : `readonly` sur tous les fields interface, `Object.freeze` sur les builds runtime, `as const` sur les arrays/object literals.
- **JSDoc** sur tous les exports publics (interface, type, function, const). Format `/** @param @returns @throws @example @module */`.
- **Pino logger** seulement (pas console.log, pas console.error). Tache 2.3.6 type-only -> pas de logger consumed, mais Tache 2.3.7+ usera `LoggerService`.
- **Zod 3.24.1** pour TOUTES les validations runtime (interface miroir Zod schema systematique).
- **Vitest 2.1.8** pour tests, pattern `describe / it`, fixtures inline. Pas de Jest, pas de Mocha.
- **NestJS 10.4.x** convention DI (mais Tache 2.3.6 type-only -> pas de DI direct).
- **Conventional Commits** : `feat(auth/abac):`, `test(auth/abac):`, `docs(auth/abac):`.
- **No barrel pollution** : index.ts re-exporte uniquement les artefacts publics. Internals (private helpers) restent local au fichier.
- **Resource type extension** : ajout doit modifier 7 endroits (cf. EC-7). Documentation README pose la checklist.
- **Error messages** prefixes `[abac]` ou `[abac-builder]` pour log scoping.
- **Path alias** : `@insurtech/auth/abac` resolve vers `packages/auth/dist/abac/index.js`.
- **Test coverage** thresholds : statements 95%, branches 90%, lines 95%, functions 100%.
- **CI/CD** : Sprint 5 livre pipeline GitHub Actions qui execute `pnpm typecheck` + `pnpm test` + `pnpm lint` + `pnpm build` sur chaque PR.
- **Pre-commit hook** (Sprint 2 husky) : `pnpm typecheck && pnpm test --changed && pnpm lint --fix`.

---

## 14. Validation pre-commit

```bash
# Sequence executee localement avant git commit (husky pre-commit hook)

# 1. Lint avec auto-fix
pnpm --filter @insurtech/auth lint --fix

# 2. Typecheck strict
pnpm --filter @insurtech/auth typecheck

# 3. Tests unitaires sur fichiers modifies (Vitest --changed)
pnpm --filter @insurtech/auth test abac/

# 4. Tests coverage
pnpm --filter @insurtech/auth test --coverage abac/

# 5. Verifier que le barrel export construit correctement
pnpm --filter @insurtech/auth build

# 6. Verifier absence emoji
grep -rE "[\x{1F300}-\x{1FAFF}]" repo/packages/auth/src/abac/ && exit 1 || true

# 7. Verifier line endings LF (pas CRLF)
file repo/packages/auth/src/abac/*.ts | grep -v "with LF" && exit 1 || true

# 8. Verifier que les schemas Zod compilent
node -e "require('./packages/auth/dist/abac/abac-context.schema').AbacContextSchema.parse({})" 2>&1 | grep -q "ZodError"

# Si toute la sequence retourne exit 0, commit autorise.
```

---

## 15. Commit message complet

```
feat(auth/abac): types ABAC + interfaces (AbacContext, AbacPolicy, AbacResult, ResourceType)

Livre les interfaces TypeScript canoniques du sous-systeme ABAC du programme
Skalean InsurTech v2.2 :
  - AbacContext (subject + resource + action + environment) avec phantom types
    builder type-safe
  - AbacPolicy (name, appliesTo, evaluate) interface implementee par 4 policies
    fondamentales Tache 2.3.7
  - AbacResult discriminated union (AllowedResult | DeniedResult) avec factory
    helpers enforcement appliedPolicy + reason
  - ResourceType union 5 valeurs canoniques (crm_contact, insure_police,
    repair_sinistre, pay_transaction, doc_document) + companion enum + Zod schema
  - AbacAction enum 12 valeurs (CRUD + business : approve, cancel, refund, close,
    assign, transfer, export, archive)
  - Schemas Zod miroirs pour validation runtime (audit replay Sprint 33,
    cache deserialize, MCP invocation Sprint 30)
  - Interfaces typed-strict par resource type (CrmContactAttributes,
    InsurePolicyAttributes, RepairSinistreAttributes, PayTransactionAttributes,
    DocDocumentAttributes) + assertResourceAttributes narrowing helper
  - Helpers serialization audit (serializeAbacContextForAudit /
    deserializeAbacContextFromAudit) avec versioning _serialized_v: 1
  - Builder pattern AbacContextBuilder avec phantom types compile-time +
    Zod runtime validation defense-in-depth + Object.freeze immutability
  - Mapping exhaustif PERMISSION_TO_RESOURCE_TYPE pour routing policies
    (assertResourceTypeMappingComplete boot-time check)
  - 46 tests Vitest (V1-V26 types, B1-B10 builder, R1-R10 resource-types)
    coverage statements 95% / branches 90% / functions 100%

Conformite reglementaire:
  - ACAPS Circulaire 04/2019 art 7+12 (tracabilite decision authz)
  - AMC Loi 43-05 art 16 (conservation 10 ans audit transactions)
  - CNDP Loi 09-08 art 18 (tracabilite acces donnees) + art 4 (minimisation attrs)
  - BAM Directive 1/W/2016 (preparation policies Sprint 13 Pay)

Fichiers crees (12, ~1410 lignes):
  packages/auth/src/abac/types.ts                     ~250
  packages/auth/src/abac/resource-types.ts             ~150
  packages/auth/src/abac/abac-context.builder.ts       ~180
  packages/auth/src/abac/abac-context.schema.ts        ~120
  packages/auth/src/abac/abac-policy.interface.ts       ~80
  packages/auth/src/abac/abac-result.types.ts          ~100
  packages/auth/src/abac/abac-resource.types.ts        ~150
  packages/auth/src/abac/abac-action.enum.ts            ~80
  packages/auth/src/abac/types.spec.ts                 ~200
  packages/auth/src/abac/abac-context-builder.spec.ts  ~120
  packages/auth/src/abac/resource-types.spec.ts         ~80
  packages/auth/src/abac/index.ts                       ~50

Bloque (P0):
  Tache 2.3.7 (AbacService + 4 policies fondamentales)
  Tache 2.3.8 (AbacResourceGuard + decorator @AbacResource)
  Tache 2.3.9 (AuditTrailService consume appliedPolicy field)
  Tache 2.3.10 (RbacAuditService persistence ABAC contexts DB)
  Tache 2.3.12 (E2E coverage 12 roles avec scenarios ABAC)

Refs:
  - Meta-prompt B-07 sprint 7 RBAC, Tache 2.3.6 lignes 736-783
  - documentation/5-roles-permissions.md section 4 ABAC
  - decisions/decision-018-no-opa-custom-abac-typescript.md (a creer)
  - decisions/decision-019-system-worker-virtual-user.md (a creer)

Test plan:
  pnpm --filter @insurtech/auth test abac/
  pnpm --filter @insurtech/auth typecheck
  pnpm --filter @insurtech/auth lint

Closes: SKALEAN-INSURTECH-S07-T236
```

---

## 16. Workflow next step

A l'issue de cette tache 2.3.6 mergee :

1. **Creer la branche Tache 2.3.7** : `feat/sprint-07-task-2.3.7-abac-service-4-policies`
2. **Lire le prompt Tache 2.3.7** : `00-pilotage/prompts-taches/sprint-07-rbac/task-2.3.7-abac-service-4-policies.md`
3. **Implementer les 4 policies fondamentales** consommant les interfaces livrees ici :
   - `OwnResourcesPolicy implements AbacPolicy` -- verifie `attrs.owner_user_id === ctx.userId` ou `attrs.assigned_user_id === ctx.userId`
   - `TimeBasedPolicy implements AbacPolicy` -- verifie `now() - attrs.created_at < threshold` (Loi 17-99 30 jours pour refund)
   - `StatusBasedPolicy implements AbacPolicy` -- verifie `attrs.status IN allowedStatuses` configuration
   - `WorkflowStatePolicy implements AbacPolicy` -- verifie transitions valides via state machine
4. **Implementer `AbacService`** :
   - `evaluate(role, permission, context): Promise<AbacResult>` -- find policy applicable + delegate evaluate
   - `registerPolicy(policy): void` -- registration dynamique avec validation `assertValidPolicyDeclaration`
5. **Tests Tache 2.3.7** : 4 policies x 5+ scenarios + service orchestration + integration scenarios.
6. **Apres Tache 2.3.7 mergee**, demarrer Tache 2.3.8 (`AbacResourceGuard` + decorator `@AbacResource`) qui consume `AbacContextBuilder` + `AbacService`.
7. **Apres Tache 2.3.8**, Tache 2.3.9 + 2.3.10 (audit persistence) + Tache 2.3.11 (admin endpoints introspection policies) + Tache 2.3.12 (E2E coverage).
8. **Sprint 7 release notes** : documenter dans `00-pilotage/releases/sprint-07-rbac.md` les artefacts ABAC livres + breaking changes futurs anticipes (ajout resource types Sprint 24).

**Pre-requis Tache 2.3.7** : 
- Tache 2.3.6 mergee + tag `v0.7.6-abac-types`
- Coverage tests >= seuils
- Documentation decision-018 + decision-019 ecrites (a la livraison de la PR Tache 2.3.6)

---

**Fin du document task-2.3.6-types-abac-interfaces-context-policy-result.md**
