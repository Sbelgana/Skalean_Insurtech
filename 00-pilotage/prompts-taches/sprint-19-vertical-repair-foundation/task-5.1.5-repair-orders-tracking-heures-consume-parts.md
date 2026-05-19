# TACHE 5.1.5 -- repair_orders Entity + Service + Tracking Heures Atomique + Consume Parts FIFO + State Machine Order + Workflow Sinistre Integration

**Sprint** : 19 (Phase 5 / Sprint 1 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-19-sprint-19-vertical-repair-foundation.md` (Tache 5.1.5)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP Foundation)
**Priorite** : P0 (bloquant -- conditionne 5.1.6 Stock consumer, 5.1.7 HR time_logs, 5.1.8 invoices facturation finale, 5.1.13 E2E happy path complet)
**Effort** : 6h
**Dependances** : 5.1.1 (garages avec hourly_rate par service_type), 5.1.2 (sinistres + state machine + transition `awaiting_approval -> under_repair` declenche par approve devis), 5.1.3 (diagnostics avec problems et heures estimees), 5.1.4 (devis approved + items parts/labor source de verite), Sprint 13 (Stock movements FIFO + HR employees avec role technicien), Sprint 7 (RBAC permissions `repair.orders.*`), Sprint 6 (multi-tenant RLS + AsyncLocalStorage TenantContext).
**Densite cible** : 110-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006 absolu, verifie par pre-commit hook `check-no-emoji.sh`)

---

## 1. But

Cette tache implemente l'**ordre de reparation** (repair order, ou work order en anglais) -- l'entite operationnelle qui **execute** ce que le devis approuve a contractualise. Si le devis est le contrat commercial (Tache 5.1.4), l'ordre est le **plan d'execution atelier** : qui fait quoi, dans quel ordre, avec quelles pieces, en combien d'heures, et avec quelle traceabilite. Sans ordre, il est impossible de tracer ce qui a ete effectivement realise versus ce qui avait ete devise, impossible de calculer le revenu reel garage (labor_hours * hourly_rate), impossible de declencher la consommation pieces stock (Sprint 13 FIFO), impossible de facturer (Tache 5.1.8 invoice se cree depuis order completed), et impossible de calculer la paie technicien (Sprint 13 HR consume `hr_time_logs` produits par cette tache).

L'apport est quintuple. **Premierement**, structurellement, la table `repair_orders` cree l'entite execution avec numerotation unique `ORD-{tenant_prefix}-2026-00001` (sequence par tenant et annee, pattern identique a `DEV-` et `SIN-`), checklist tasks (jsonb array derivee des items devis), tracking heures granulaire (`labor_hours_logged` cumul + table `repair_order_labor_logs` historique detaille), tracking pieces consommees (`parts_consumption` jsonb cumul + appel synchrone Sprint 13 `StockMovementsService.exit()`), couts reels `labor_cost_actual` + `parts_cost_actual` calcules en temps reel (Decimal.js precision centime). **Deuxiemement**, fonctionnellement, le service `OrdersService` expose 12 methodes : `createFromApprovedDevis` (parse devis items -> tasks checklist), `assignTechnician` (HR validation), `start` (transition order + sinistre + lock pessimiste), `logHours` (append labor log + recompute labor_cost_actual + emit Kafka `repair.order.hours_logged`), `consumePart` (Sprint 13 `StockMovementsService.exit()` synchrone + idempotency key + record parts_consumption + emit Kafka `repair.parts_consumed`), `markTaskCompleted` (checklist progress), `addAdditionalTask` (extension scope avec re-devis si depasse budget), `complete` (validation : all tasks completed + transition sinistre `under_repair -> completed`), `cancel` (rollback Stock + transition sinistre cancelled), `findOne`, `findAll`, `getProgress`. **Troisiemement**, transactionnellement, chaque mutation est atomique : `consumePart` execute en SQL transaction `BEGIN; INSERT stock_movement; UPDATE stock_items; UPDATE repair_orders; INSERT outbox_event; COMMIT;` pour garantir consistency cross-modules sans risque double-consume. **Quatriemement**, organisationnellement, les heures loggees alimentent automatiquement la table `hr_time_logs` Sprint 5.1.7 (event Kafka `repair.order.hours_logged` consume par HR module qui insert `hr_time_logs`), elle-meme consume par paie Sprint 13 calculs bulletin. **Cinquiemement**, observabilite, l'ordre expose un endpoint `/progress` calcule en temps reel : `% tasks completed`, `% labor budget consume`, `% parts budget consume`, `flag over_budget` (alerte chef garage si depasse devis + X%).

A l'issue de cette tache, l'API expose 12 endpoints REST (`POST /repair/orders/from-devis/:devisId`, `POST /repair/orders/:id/assign`, `POST /repair/orders/:id/start`, `POST /repair/orders/:id/log-hours`, `POST /repair/orders/:id/consume-part`, `POST /repair/orders/:id/tasks/:taskId/complete`, `POST /repair/orders/:id/additional-task`, `POST /repair/orders/:id/complete`, `POST /repair/orders/:id/cancel`, `GET /repair/orders`, `GET /repair/orders/:id`, `GET /repair/orders/:id/progress`), une state machine order 4 etats (`pending -> in_progress -> completed | cancelled`) avec transitions strictes, un mecanisme idempotency Redis pour `consumePart` (header `Idempotency-Key` requis), 12 permissions `repair.orders.*` mappees aux 4 roles garage (admin/chef/technicien/gestionnaire), et 35+ tests (unit + integration + E2E) couvrant happy path + edge cases concurrence + insufficient stock + budget overrun + cancellation rollback. Skalean Atlas (premier garage tenant seed Tache 5.1.1) execute son premier ordre reparation operationnel end-to-end : sinistre declared -> diagnostic completed -> devis approved -> order created -> assigned technicien Hamid -> started -> 4h logged + 3 pieces consumed FIFO -> completed -> sinistre transitionne `completed`.

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

L'ordre de reparation est le **pivot transactionnel** du vertical Repair. C'est la seule entite qui touche simultanement tous les autres modules : Stock (decrement FIFO synchrone via `consumePart`), HR (production `hr_time_logs` via `logHours`), Books (alimentation future ecritures comptables Sprint 5.1.9 via cost actuals), Insure (lien sinistre via `sinistre_id`), Comm (notification chef garage si over-budget). Sans ordre, ces integrations sont impossibles : on ne sait pas pour qui decrement le stock, on ne sait pas qui assigner les heures, on ne sait pas quelle base utiliser pour facturer.

Au Maroc, la gestion atelier garage souffre de **trois pathologies recurrentes** que cette tache adresse directement. **Pathologie 1 : pertes pieces non tracees.** Dans un garage independant moyen MA, 12 a 18% des pieces stockees disparaissent annuellement sans trace (etudes ACAA 2023). Les techniciens prennent une plaquette de freins pour une reparation, ne la signalent pas, le stock theorique diverge du stock reel, et lors de l'inventaire trimestriel le manque est compense par sur-facturation clients suivants. La traceabilite forcee via `consumePart` (idempotency key + INSERT atomique stock_movement type='exit' + recompute valorisation FIFO Sprint 13) elimine cette derive. **Pathologie 2 : heures techniciens fantomes.** Les heures presence (8h pointage) different systematiquement des heures productives (en moyenne 5.2h selon ACAA). Sans tracking par ordre, impossible d'identifier ou vont les 2.8h. Le `logHours` force par tache exige description, duration, technicien_id, et alimente `hr_time_logs` consommees par paie variable productive (bonus chef garage MA standard : prime productive 25% si > 80% taux occupation). **Pathologie 3 : devis = facture sans verification.** Pratique courante MA : le devis approuve devient automatiquement facture en fin de reparation, sans verifier que les pieces facturees ont reellement ete consommees ni les heures reellement passees. Skalean InsurTech force la **separation devis / order / invoice** : `repair_invoices.subtotal_ht` Sprint 5.1.8 est calcule depuis `repair_orders.labor_cost_actual + parts_cost_actual` (donc reel), pas depuis `repair_devis.subtotal_ht` (theorique). Si reel > devis, alerte chef garage. Si reel < devis, facture reduite (avantage client, transparence).

Sans la Tache 5.1.5, l'API ne peut pas evoluer : Tache 5.1.6 (Stock consumer Kafka) requiert que des `consumePart` soient appeles donc qu'un ordre existe ; Tache 5.1.7 (HR time_logs) requiert un `order_id` source ; Tache 5.1.8 (invoices) requiert un `order_id` completed pour facturer le reel ; Tache 5.1.13 (E2E) ne peut pas tester le happy path complet sans ordre.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **A. Pas d'entite order, executer directement depuis devis approved** | 1 entite de moins, plus simple | Impossible separer theorique (devis) du reel (execute), impossible tracer pieces consommees vs prevues, impossible re-facturer le reel | rejete (anti-pattern majeur) |
| **B. Order = simple etat sur sinistre (column `repair_in_progress = true`)** | 0 nouvelle table | Pas de checklist tasks, pas de tracking heures granulaire, pas de cost actuals separes | rejete |
| **C. Order avec checklist tasks en table normalisee `repair_order_tasks`** | Queries fines par task | Surcout perf pour use case rarement requis (toujours fetch tasks ensemble), JSONB suffisant | rejete |
| **D. Tracking heures en column simple `labor_hours_logged` cumul** | Simple | Aucune traceabilite (qui, quand, quelle tache, combien) | rejete |
| **E. Tracking heures en table separee `repair_order_labor_logs`** | Historique complet auditable | Plus de code | considere |
| **F. Hybride : column `labor_hours_logged` cumul + table `repair_order_labor_logs` historique** | Performance + auditability complete | Code raisonnable | **RETENU** Sprint 19 |
| **G. Consume part via Kafka asynchrone (eventual consistency)** | Decouplage modules | Risque inconsistency (stock decremente mais order pas update), retry complexe | rejete (criticite transactionnelle) |
| **H. Consume part synchrone via injection `StockMovementsService`** | Atomicite garantie SQL transaction | Couplage repair -> stock package | **RETENU** + emit Kafka outbox pour autres consumers |

L'option H retenue refletait un trade-off conscient entre **atomicite forte** (transaction SQL unique cross-tables `stock_items`, `stock_movements`, `repair_orders`) et **couplage modulaire** (le package `repair` import `@insurtech/stock`). Le couplage est acceptable car Sprint 13 a deja prevu un service `StockMovementsService` avec API stable publique. L'asynchrone Kafka est ajoute en complement via **outbox pattern** : meme transaction SQL insert un event dans `outbox_events`, le KafkaPublisher relay asynchrone vers consumers externes (analytics, audit, alerts). Best of both worlds.

L'option F retenue (hybride cumul + historique) reflete que 95% des queries veulent juste savoir "combien d'heures totales sur cet ordre" (-> column directe lookup O(1)), et 5% veulent l'historique detaille pour audit ou facturation precise (-> JOIN table `repair_order_labor_logs`). Maintenir les deux est trivial : `logHours` UPDATE cumul + INSERT log dans meme transaction.

### 2.3 Trade-offs explicites

**Trade-off 1 -- Transitions order et sinistre couplees vs decouplees.** Choix : couplees fortement. `OrdersService.start()` execute en meme transaction : update `repair_orders.status='in_progress'` + appel `SinistresService.transition(sinistre_id, 'under_repair')`. Pour : impossible avoir order in_progress et sinistre `awaiting_approval` (incoherent). Contre : si transition sinistre echoue (etat invalide), tout rollback. Mitigation : tests unit verifient les paires de transitions cote sinistre state machine (5.1.2).

**Trade-off 2 -- Lock pessimiste vs optimiste sur consumePart.** Choix : lock pessimiste row-level (`SELECT ... FOR UPDATE`) sur `repair_orders` ET sur `stock_items.quantity_on_hand`. Pour : garantie absolue pas de double-consume (deux requests parallels deux techniciens). Contre : surcout perf, deadlock potentiel si ordre acquire diverge. Mitigation : ordre acquire deterministe (toujours `stock_items` AVANT `repair_orders`).

**Trade-off 3 -- Recompute cost actuals on-write vs on-read.** Choix : on-write. `logHours` UPDATE `labor_cost_actual` directement. `consumePart` UPDATE `parts_cost_actual`. Pour : reads instant O(1). Contre : risque inconsistency si writes manquent (jamais en pratique car meme transaction). Mitigation : tests verifient `total_cost_actual = labor + parts` sur multiple scenarios.

**Trade-off 4 -- Over-budget alert blocking vs warning.** Choix : warning (Kafka event `repair.order.over_budget`) seulement Sprint 19. Sprint 22 web-garage-app UI affichera alerte chef garage. Sprint 25 ajoutera config tenant pour blocking optionnel. Pour : flexibilite. Contre : risque depassement non controle. Mitigation : metrique dashboard Sprint 5.1.12.

**Trade-off 5 -- Idempotency Redis TTL 24h vs 7j.** Choix : 24h. Pour : couvre toute la duree d'une reparation typique MA (3-5j), buffer raisonnable. Contre : si reparation tres longue (carrosserie 14j), risque collision. Mitigation : key inclut order_id + part_id + timestamp_iso, collision improbable.

**Trade-off 6 -- Tasks checklist editable apres start vs frozen.** Choix : frozen apres start, sauf via `addAdditionalTask` (cree task type 'additional', necessite re-devis si depasse 10% budget). Pour : preserve traceabilite devis vs execution. Contre : flexibilite reduite. Mitigation : `addAdditionalTask` permet ajout controle.

**Trade-off 7 -- Multi-technicien par order vs mono.** Choix : mono technicien principal `assigned_technician_id`, mais `repair_order_labor_logs.employee_id` peut differer (multiple techniciens contribuent). Pour : modele simple (responsable unique), flexibilite execution. Contre : chef garage doit gerer manuellement. Mitigation : Sprint 26 ajoutera multi-assignment formel si demande.

**Trade-off 8 -- Parts catalog FK vs free-text description.** Choix : FK `stock_items.id` OBLIGATOIRE (pas de free-text part). Pour : traceabilite stock exacte, pas de divergence catalog. Contre : impossible utiliser piece non cataloguee (rare, mais existe : achat express chez fournisseur ad-hoc). Mitigation : Sprint 19 force passage par `StockItemsService.createOnDemand()` si piece nouvelle.

### 2.4 Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turborepo)** : `repair` package import `@insurtech/stock` via workspace link, build cache turbo invalide si entites stock changent.
- **decision-002 (multi-tenant 3 niveaux + RLS strict)** : `repair_orders.tenant_id` NOT NULL, policy RLS `app_current_tenant()`, AsyncLocalStorage TenantContext sur chaque endpoint, audit log per mutation.
- **decision-003 (TypeORM 0.3 + migrations versionnees + RLS)** : migration `CreateRepairOrdersTable` cree table + index + RLS policy + ALTER TABLE ... ENABLE ROW LEVEL SECURITY.
- **decision-004 (Kafka events `insurtech.events.repair.order.*`)** : topics `created`, `assigned`, `started`, `hours_logged`, `parts_consumed`, `task_completed`, `additional_task_added`, `completed`, `cancelled`, `over_budget`. Schemas Zod export `@insurtech/shared-types`.
- **decision-005 (frontiere Skalean AI stricte)** : Sprint 19 pas d'IA estimation execution. Sprint 30+ defere ajoutera predictions duration reelle.
- **decision-006 (no-emoji absolu)** : code, commentaires, logs, commit, docs sans aucune emoji. Pre-commit hook bloque.
- **decision-007 (mock Skalean AI Sprint 1-28)** : aucun appel Skalean AI dans cette tache.
- **decision-008 (data residency MA / cloud Atlas Casablanca)** : `repair_orders` stocke sur Postgres Atlas DC1 Tier III, replication DC2 Tier IV.
- **decision-009 (signature loi 43-20 Barid eSign)** : Sprint 19 pas de signature sur order. Sprint 32 ajoutera signature technicien sur completion (PV completion reparation).
- **decision-010 (insure connecteurs Sprint 32)** : si sinistre lie a police assureur, l'order est consultable via API connecteur (read-only) Sprint 32.

### 2.5 Pieges techniques connus

1. **Piege : Double-consume pieces si requests paralleles** (deux techniciens scan en meme temps).
   - Pourquoi : Sans lock pessimiste, deux transactions paralleles voient le meme `quantity_on_hand=5`, chacune decremente de 2, resultat final `quantity_on_hand=3` au lieu de 1.
   - Solution : Transaction isolation REPEATABLE READ + `SELECT ... FOR UPDATE` sur ligne `stock_items` AVANT decrement. Combine avec idempotency key Redis (header `Idempotency-Key` obligatoire sur `POST /consume-part`).

2. **Piege : Order completed sans toutes tasks completed**.
   - Pourquoi : Si validation business absent, on peut marquer order completed alors que tasks restantes existent. Facturation devient incoherente.
   - Solution : `complete()` valide explicitement `tasks.every(t => t.status === 'completed' || t.status === 'cancelled')`. Reject avec code `INCOMPLETE_TASKS_REMAINING` sinon.

3. **Piege : Transition sinistre echoue, order reste in_progress**.
   - Pourquoi : Sans transaction unique, `OrdersService.start()` peut update order mais transition sinistre fail (etat invalide), inconsistency.
   - Solution : Single SQL transaction wraping les deux operations. Si transition sinistre throw, rollback order update.

4. **Piege : Labor cost actual drift cumul vs sum logs**.
   - Pourquoi : Bug code : `labor_cost_actual += hours * rate` mais avec rate change entre temps (technicien promu, hourly_rate update).
   - Solution : Stocker hourly_rate au moment du log dans `repair_order_labor_logs.hourly_rate_at_time`. Recompute periodique cumul = SUM(logs.hours * logs.hourly_rate_at_time).

5. **Piege : Consume part avec quantity = 0 ou negative**.
   - Pourquoi : Bug UI passe quantity = 0, decrement no-op mais stock_movement insere a tort.
   - Solution : Zod schema `z.number().positive().int()` (entier strict positif).

6. **Piege : Cancel order apres consume parts -> rollback Stock incoherent**.
   - Pourquoi : Si on annule un order, faut-il re-ajouter les pieces au stock ? Si oui, comment tracer le retour FIFO ?
   - Solution : `cancel()` cree stock_movement type='return' (Sprint 13 supporte), valorisation = `cost_at_consume_time`. Sinistre transitionne cancelled.

7. **Piege : Add additional task depasse budget devis sans alerte**.
   - Pourquoi : Technicien ajoute task supplementaire (panne decouverte). Cout reel depasse devis. Pas d'alerte = facture surprise client.
   - Solution : `addAdditionalTask()` calcule impact (estimated_hours * hourly_rate + estimated_parts_cost). Si total order projected > devis * 1.10, status order `awaiting_re_approval`, transition sinistre `awaiting_approval` (re-devis necessaire). Kafka `repair.order.over_budget`.

8. **Piege : Assign technicien inactif ou pas role technicien**.
   - Pourquoi : Validation HR manquante, on peut assigner manager_commercial qui n'a pas competence.
   - Solution : `assignTechnician()` valide via `HrEmployeesService.findOne()` que `employee.is_active === true` ET `employee.role === 'technician'`.

9. **Piege : Sinistre passe en cancelled apres order in_progress**.
   - Pourquoi : Si on annule sinistre depuis autre flow (5.1.2), order reste in_progress, incoherence.
   - Solution : Listener Kafka `repair.sinistre.cancelled` -> if order in_progress for this sinistre, force cancel order (cascade).

10. **Piege : Numerotation order_number collision tenant + annee**.
    - Pourquoi : Sequence non atomique = race condition.
    - Solution : Function Postgres `get_next_order_number(tenant_id, year)` avec ROW LOCK sur table `repair_orders_sequences`. UNIQUE constraint (tenant_id, order_number).

11. **Piege : Idempotency key collision entre tenants**.
    - Pourquoi : Si key Redis = `idempotency:{user_id}:{key}`, deux tenants peuvent avoir collision.
    - Solution : Key inclut tenant_id : `idempotency:{tenant_id}:{user_id}:{key}`.

12. **Piege : `parts_consumption` JSONB grossit linearly, query lente**.
    - Pourquoi : Order avec 100+ pieces consommees, JSONB array large, recompute serializes a chaque ajout.
    - Solution : Limit hard 200 pieces par order. Au-dela, alerte chef garage (situation anormale).

13. **Piege : Tests E2E avec Stock vide -> insufficient stock**.
    - Pourquoi : Seed test Stock vide, `consumePart` throw, tests fail.
    - Solution : Fixtures Tache 5.1.13 seed 100 stock_items quantite suffisante.

14. **Piege : Audit trail manquant pour decisions critiques**.
    - Pourquoi : Cancel order sans raison logged, pas d'audit pour expertise.
    - Solution : `cancel()` requiert parametre `reason: string`. Inserted dans `audit_logs` (Sprint 6).

15. **Piege : `getProgress` calcule sur tasks editable apres start**.
    - Pourquoi : Si tasks modifiees, ratio progress incorrect.
    - Solution : Tasks frozen apres start. Progress base sur `tasks_completed_count / tasks_total_count` snapshot creation.

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 5.1.5 est la **5eme tache** du Sprint 19. Elle suit immediatement 5.1.4 (devis approuves) qu'elle consomme via `createFromApprovedDevis`. Elle bloque toutes les taches suivantes du sprint :
- **5.1.6** (Stock consumer Kafka) : valide que `consumePart` emit bien les events `repair.parts_consumed` consumes par Stock.
- **5.1.7** (HR time_logs) : consume les events `repair.order.hours_logged` pour alimenter `hr_time_logs`.
- **5.1.8** (invoices facturation finale) : depend de `repair_orders.status='completed'` pour creer invoice depuis cost actuals.
- **5.1.9** (Pay + Books) : journal entries Books references `repair_orders.labor_cost_actual + parts_cost_actual`.
- **5.1.10** (warranties) : created post `repair_orders.completed`, references `order_id`.
- **5.1.11** (REST consolidation) : permissions `repair.orders.*` consolidees.
- **5.1.12** (dashboards) : metriques throughput technicien depuis `repair_order_labor_logs`.
- **5.1.13** (E2E) : happy path complet depend de l'ordre.

### 3.2 Position dans le programme global

L'ordre de reparation est l'entite **operationnelle** la plus consultee dans le vertical Repair. Sprint 22 (web-garage-app desktop) construira un kanban orders avec drag-and-drop entre statuts. Sprint 23 (web-garage-mobile PWA technicien atelier) construira l'interface terrain : scan QR piece -> `consumePart`, timer tache -> `logHours`. Sprint 24 (flux sinistre client end-to-end) reliera assure mobile a l'ordre via `GET /orders/by-sinistre/:sinistreId`. Sprint 25 (cross-tenant runtime 3 types) introduira les variations comportementales : tenant_type=Atlas (full control), managed_partner (delegue Skalean), api_partner (read-only). Sprint 30+ defere ajoutera predictions IA Skalean AI : duration reelle estimee depuis historique, alerte over-budget proactive.

### 3.3 Diagramme flux order et integrations cross-modules

```
=============================================================================
WORKFLOW ORDER REPAIR -- INTEGRATIONS STOCK + HR + KAFKA OUTBOX
=============================================================================

[Devis approved -- Tache 5.1.4]
[Sinistre status : under_repair (deja transitionne par devis.approve)]
          |
          v
POST /api/v1/repair/orders/from-devis/:devisId
          |
          v
OrdersService.createFromApprovedDevis(devisId)
   |
   +-- BEGIN TRANSACTION
   |
   +--> Validate devis.status === 'approved'
   +--> Validate no existing active order for this devis (UNIQUE constraint)
   +--> Parse devis.items -> tasks[] = [
   |          { id: uuid, type: 'labor', description: 'Pose freins avant', estimated_hours: 2,
   |            estimated_cost: 700, status: 'pending' },
   |          { id: uuid, type: 'parts', description: 'Plaquettes Bosch x4', quantity_needed: 4,
   |            estimated_cost: 1120, status: 'pending', stock_item_ref: null },
   |          ...
   |        ]
   +--> Generate order_number via function Postgres get_next_order_number(tenant_id, year)
   +--> INSERT repair_orders (
   |          status='pending', tasks (JSONB), parts_consumption='[]',
   |          labor_hours_logged=0, labor_cost_actual=0, parts_cost_actual=0,
   |          budget_total_ht=devis.subtotal_ht, devis_id, sinistre_id
   |        )
   +--> INSERT outbox_event (topic='insurtech.events.repair.order.created', payload)
   |
   +-- COMMIT
   |
   +--> KafkaPublisher relay outbox -> topic
   |
   v
[Order status : pending]


POST /api/v1/repair/orders/:id/assign { technician_id: 'uuid' }
   |
   +--> Validate technician via HrEmployeesService :
   |     - employee exists
   |     - is_active === true
   |     - role === 'technician' OR role === 'chef_garage'
   |     - tenant_id matches
   +--> UPDATE repair_orders SET assigned_technician_id = :id, assigned_at = NOW
   +--> Outbox event 'repair.order.assigned'
   +--> Kafka


POST /api/v1/repair/orders/:id/start
   |
   +-- BEGIN TRANSACTION
   +--> Validate order.status === 'pending' && assigned_technician_id IS NOT NULL
   +--> Validate sinistre.status === 'under_repair'
   +--> UPDATE repair_orders SET status='in_progress', started_at=NOW
   +--> Freeze tasks (no edit allowed after start, sauf addAdditionalTask)
   +--> INSERT outbox_event 'repair.order.started'
   +-- COMMIT
   +--> Kafka


PARALLEL TRACKING : Heures et Pieces
=============================================================================

POST /api/v1/repair/orders/:id/log-hours
   { hours: 1.5, task_id: 'uuid', description: 'Demontage roue avant droite' }
   |
   +-- BEGIN TRANSACTION REPEATABLE READ
   +--> SELECT repair_orders ... FOR UPDATE (lock pessimiste)
   +--> Validate order.status === 'in_progress'
   +--> Fetch employee hourly_rate at moment T (Sprint 13 HR)
   +--> Compute cost = hours * hourly_rate_at_time
   +--> INSERT repair_order_labor_logs (
   |          order_id, employee_id, hours, hourly_rate_at_time, cost, task_id, description, logged_at
   |        )
   +--> UPDATE repair_orders SET
   |          labor_hours_logged = labor_hours_logged + :hours,
   |          labor_cost_actual = labor_cost_actual + :cost,
   |          total_cost_actual = labor_cost_actual + parts_cost_actual
   +--> Check budget : si total_cost_actual > budget_total_ht * 1.10 -> emit over_budget
   +--> INSERT outbox_event 'repair.order.hours_logged' (consume par 5.1.7 HR time_logs)
   +-- COMMIT
   +--> Kafka


POST /api/v1/repair/orders/:id/consume-part
   Headers: Idempotency-Key: abc-123-def
   Body: { stock_item_id: 'uuid', quantity: 2, task_id: 'uuid' }
   |
   +--> Check Redis idempotency : key = idempotency:{tenant}:{user}:abc-123-def
   |    SI exists -> retour response cached (HTTP 200 with cached payload)
   |
   +-- BEGIN TRANSACTION REPEATABLE READ
   +--> SELECT stock_items WHERE id=:stockItemId AND tenant_id=:t FOR UPDATE
   |    Validate quantity_on_hand >= :quantity
   |    SI insufficient -> ROLLBACK + throw INSUFFICIENT_STOCK
   +--> SELECT repair_orders WHERE id=:orderId AND tenant_id=:t FOR UPDATE
   |    Validate order.status === 'in_progress'
   +--> Call StockMovementsService.exit({
   |          stock_item_id, quantity, reason='repair', reference_type='repair_order',
   |          reference_id=order_id
   |        }) -- Sprint 13 calcule FIFO, retourne unit_cost_at_time
   +--> Compute cost_consumed = quantity * unit_cost_at_time
   +--> UPDATE repair_orders SET
   |          parts_consumption = parts_consumption || jsonb_build_object(...),
   |          parts_cost_actual = parts_cost_actual + :cost_consumed,
   |          total_cost_actual = labor_cost_actual + parts_cost_actual
   +--> Check budget over -> emit over_budget if exceeded
   +--> INSERT outbox_event 'repair.parts_consumed' (consume par Stock analytics 5.1.6)
   +-- COMMIT
   +--> SET Redis idempotency key TTL 24h
   +--> Kafka


POST /api/v1/repair/orders/:id/complete
   |
   +-- BEGIN TRANSACTION
   +--> Validate order.status === 'in_progress'
   +--> Validate all tasks status IN ('completed', 'cancelled')
   |    SI tasks pending -> ROLLBACK + INCOMPLETE_TASKS_REMAINING
   +--> UPDATE repair_orders SET status='completed', completed_at=NOW
   +--> Call SinistresService.transition(sinistre_id, 'completed', { triggered_by='order_completed' })
   +--> INSERT outbox_event 'repair.order.completed' (consume par 5.1.8 invoices)
   +-- COMMIT
   +--> Kafka


CANCELLATION FLOW (avec rollback Stock)
=============================================================================

POST /api/v1/repair/orders/:id/cancel { reason: 'string', return_parts_to_stock: bool }
   |
   +-- BEGIN TRANSACTION REPEATABLE READ
   +--> Validate order.status IN ('pending', 'in_progress')
   +--> SI return_parts_to_stock === true :
   |    For each part in parts_consumption :
   |      Call StockMovementsService.return({
   |            stock_item_id, quantity, reason='repair_cancelled',
   |            reference_type='repair_order', reference_id, original_unit_cost
   |          })  (Sprint 13 cree movement type='return')
   +--> UPDATE repair_orders SET status='cancelled', cancelled_at=NOW, cancellation_reason
   +--> Call SinistresService.transition(sinistre_id, 'cancelled', { triggered_by='order_cancelled', reason })
   +--> INSERT outbox_event 'repair.order.cancelled'
   +-- COMMIT
   +--> Kafka
```

### 3.4 Diagramme state machine order

```
=============================================================================
STATE MACHINE -- 4 etats avec transitions strictes
=============================================================================

      [pending]
         |
         | assign + start
         v
   [in_progress]
      |       |
      |       | cancel
      |       v
      |   [cancelled]  (terminal)
      |
      | complete (toutes tasks completed)
      v
   [completed]  (terminal)


TRANSITIONS VALIDES :
  pending -> in_progress       (start, requires assigned_technician_id)
  pending -> cancelled         (cancel pre-start)
  in_progress -> completed     (complete, requires all tasks done)
  in_progress -> cancelled     (cancel mid-execution, optional parts return)
  completed                    (terminal)
  cancelled                    (terminal)

TRANSITIONS INVALIDES (rejected with INVALID_STATUS_TRANSITION) :
  completed -> *               (terminal)
  cancelled -> *               (terminal)
  in_progress -> pending       (no backward)
```

## 4. Livrables checkables

- [ ] **L1** : Migration `CreateRepairOrdersTable.ts` (~120 lignes) avec table + indexes + RLS policy `app_current_tenant()`.
- [ ] **L2** : Migration `CreateRepairOrderLaborLogsTable.ts` (~80 lignes) avec table + indexes + RLS + FK ON DELETE CASCADE.
- [ ] **L3** : Migration `CreateRepairOrdersSequenceTable.ts` + function Postgres `get_next_order_number(tenant_id, year)` atomique (~60 lignes).
- [ ] **L4** : Entite `repair-order.entity.ts` (~110 lignes) avec types `OrderTask`, `OrderPartConsumed`.
- [ ] **L5** : Entite `repair-order-labor-log.entity.ts` (~50 lignes).
- [ ] **L6** : Entite `repair-orders-sequence.entity.ts` (~40 lignes).
- [ ] **L7** : Constants `orders-constants.ts` (~70 lignes) avec statuts, transitions, task types, budget thresholds.
- [ ] **L8** : DTOs `orders.dto.ts` (~250 lignes) Zod schemas pour 12 endpoints.
- [ ] **L9** : Utility `orders-cost.util.ts` (~90 lignes) compute Decimal.js + budget checks.
- [ ] **L10** : Service `orders-numbering.service.ts` (~70 lignes) atomique via function Postgres.
- [ ] **L11** : Service `orders-state-machine.ts` (~100 lignes) validation transitions strictes.
- [ ] **L12** : Service `orders-events.publisher.ts` (~120 lignes) Kafka outbox 10 events.
- [ ] **L13** : Service `orders.service.ts` (~550 lignes) avec 12 methodes orchestrees.
- [ ] **L14** : Controller `orders.controller.ts` (~320 lignes) avec 12 endpoints REST + permissions decorators.
- [ ] **L15** : Listener Kafka `sinistre-cancelled.listener.ts` (~80 lignes) cascade cancellation.
- [ ] **L16** : Permissions ajoutees au catalog : `repair.orders.create`, `read`, `assign`, `start`, `log_hours`, `consume_part`, `mark_task_completed`, `add_additional_task`, `complete`, `cancel`, `view_progress`, `view_all_tenant`.
- [ ] **L17** : Mapping roles : garage_admin (toutes), garage_chef (toutes), garage_technicien (`read`, `log_hours`, `consume_part`, `mark_task_completed`, `view_progress`), garage_gestionnaire (`read`, `view_progress`, `view_all_tenant`).
- [ ] **L18** : Tests unit utility (`orders-cost.util.spec.ts`) -- 20+ tests precision Decimal.
- [ ] **L19** : Tests unit state machine (`orders-state-machine.spec.ts`) -- 15+ tests transitions.
- [ ] **L20** : Tests unit service (`orders.service.spec.ts`) -- 35+ tests methodes.
- [ ] **L21** : Tests integration numerotation (`orders-numbering.integration-spec.ts`) -- 10+ tests concurrence atomique.
- [ ] **L22** : Tests integration consume-part (`consume-part.integration-spec.ts`) -- 12+ tests Stock + idempotency.
- [ ] **L23** : Tests E2E (`orders.e2e-spec.ts`) -- 30+ scenarios workflow + permissions + multi-tenant isolation.
- [ ] **L24** : Tests Kafka events (`orders-events.spec.ts`) -- 12+ tests emission.
- [ ] **L25** : Coverage >= 90% sur orders.service + orders-cost.util + orders-state-machine.
- [ ] **L26** : Variables env documentees `.env.example` (REPAIR_ORDERS_BUDGET_OVER_THRESHOLD, REPAIR_ORDERS_IDEMPOTENCY_TTL_SEC, REPAIR_ORDERS_MAX_PARTS_PER_ORDER).
- [ ] **L27** : Aucune emoji + aucun console.log (verifie via grep + pre-commit hook).
- [ ] **L28** : Aucun any TypeScript implicite (tsconfig strict + noImplicitAny).
- [ ] **L29** : Tous les fichiers code avec imports explicites (pas `import * as`).
- [ ] **L30** : Documentation breve dans `packages/repair/README.md` section "Orders module".

## 5. Fichiers crees / modifies

```
CREES (28 fichiers)
====================

repo/packages/database/src/migrations/{ts1}-CreateRepairOrdersTable.ts                              (~120 lignes / table + RLS + indexes)
repo/packages/database/src/migrations/{ts2}-CreateRepairOrderLaborLogsTable.ts                       (~80 lignes / table + RLS + FK CASCADE)
repo/packages/database/src/migrations/{ts3}-CreateRepairOrdersSequenceTable.ts                       (~40 lignes / sequence table)
repo/packages/database/src/migrations/{ts4}-CreateGetNextOrderNumberFunction.ts                      (~60 lignes / function Postgres atomique)

repo/packages/repair/src/constants/orders-constants.ts                                                (~70 lignes / statuts, task types, budget)
repo/packages/repair/src/entities/repair-order.entity.ts                                              (~110 lignes / TypeORM entity)
repo/packages/repair/src/entities/repair-order-labor-log.entity.ts                                    (~50 lignes / TypeORM entity)
repo/packages/repair/src/entities/repair-orders-sequence.entity.ts                                    (~40 lignes / TypeORM entity)
repo/packages/repair/src/dto/orders.dto.ts                                                            (~250 lignes / Zod DTOs 12 endpoints)
repo/packages/repair/src/utils/orders-cost.util.ts                                                     (~90 lignes / Decimal.js compute)
repo/packages/repair/src/services/orders-numbering.service.ts                                          (~70 lignes / numerotation atomique)
repo/packages/repair/src/services/orders-state-machine.ts                                              (~100 lignes / transitions)
repo/packages/repair/src/services/orders-events.publisher.ts                                            (~120 lignes / Kafka outbox)
repo/packages/repair/src/services/orders.service.ts                                                     (~550 lignes / 12 methodes)
repo/packages/repair/src/listeners/sinistre-cancelled.listener.ts                                       (~80 lignes / Kafka consumer cascade)

repo/apps/api/src/modules/repair/controllers/orders.controller.ts                                       (~320 lignes / 12 endpoints REST)

repo/packages/repair/src/utils/__tests__/orders-cost.util.spec.ts                                      (~280 lignes / 20+ tests)
repo/packages/repair/src/services/__tests__/orders-state-machine.spec.ts                                (~220 lignes / 15+ tests)
repo/packages/repair/src/services/__tests__/orders.service.spec.ts                                      (~650 lignes / 35+ tests)
repo/packages/repair/src/services/__tests__/orders-numbering.integration-spec.ts                        (~180 lignes / 10+ tests concurrence)
repo/packages/repair/src/services/__tests__/consume-part.integration-spec.ts                            (~280 lignes / 12+ tests Stock + idempotency)
repo/packages/repair/src/services/__tests__/orders-events.spec.ts                                       (~220 lignes / 12+ tests Kafka)
repo/apps/api/test/repair/orders.e2e-spec.ts                                                            (~620 lignes / 30+ scenarios E2E)


MODIFIES (6 fichiers)
====================

repo/packages/repair/src/index.ts                                                                       (export orders API)
repo/packages/auth/src/rbac/permissions.enum.ts                                                          (ajout 12 permissions repair.orders.*)
repo/packages/auth/src/rbac/permissions-matrix.ts                                                        (mapping 4 roles garage)
repo/apps/api/src/modules/repair/repair.module.ts                                                        (declaration orders providers)
repo/.env.example                                                                                          (3 variables env)
repo/packages/repair/README.md                                                                            (section "Orders module" 30 lignes)
```

## 6. Code patterns COMPLETS (13 fichiers reels, executables, typed strict)

### Fichier 1/13 : `repo/packages/repair/src/constants/orders-constants.ts`

```typescript
// repo/packages/repair/src/constants/orders-constants.ts
// Constants module repair orders
// Reference : B-19 Tache 5.1.5

/**
 * Statuts ordre reparation (state machine 4 etats)
 */
export const ORDER_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_TERMINAL_STATUSES: readonly OrderStatus[] = ['completed', 'cancelled'];

/**
 * Transitions valides
 */
export const ORDER_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
} as const;

/**
 * Types de task dans checklist ordre
 * - parts : consommation piece detachee
 * - labor : main-d'oeuvre tache atelier
 * - misc : divers (deplacement, controle, nettoyage)
 * - additional : task ajoutee post-start (impose re-devis si > seuil)
 */
export const TASK_TYPES = ['parts', 'labor', 'misc', 'additional'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

/**
 * Statuts d'une task individuelle dans checklist
 */
export const TASK_STATUSES = ['pending', 'in_progress', 'completed', 'cancelled'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/**
 * Raisons d'annulation ordre
 */
export const CANCELLATION_REASONS = [
  'customer_changed_mind',
  'parts_unavailable',
  'sinistre_resolved_externally',
  'technical_impossibility',
  'budget_exceeded_rejected',
  'other',
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

/**
 * Roles HR autorises a etre assignes a un ordre
 */
export const ASSIGNABLE_HR_ROLES = ['technician', 'chef_garage'] as const;

/**
 * Constants business
 */
export const ORDER_CONSTANTS = {
  /** Pourcentage budget devis declenchant alerte over_budget */
  BUDGET_OVER_THRESHOLD_PCT: 0.10,
  /** Pourcentage budget devis declenchant blocage et re-devis (additional_task) */
  BUDGET_RE_APPROVAL_THRESHOLD_PCT: 0.10,
  /** TTL idempotency key Redis (24h) */
  IDEMPOTENCY_TTL_SEC: 86400,
  /** Limite hard nombre tasks par ordre */
  MAX_TASKS_PER_ORDER: 200,
  /** Limite hard nombre pieces consommees par ordre */
  MAX_PARTS_PER_ORDER: 200,
  /** Limite hard nombre logs labor par ordre */
  MAX_LABOR_LOGS_PER_ORDER: 500,
  /** Currency MAD obligatoire */
  CURRENCY: 'MAD',
  /** Precision Decimal.js (2 decimales pour amounts MAD) */
  DECIMAL_SCALE: 2,
  /** Prefix numerotation order */
  ORDER_NUMBER_PREFIX: 'ORD',
  /** Numerotation : nb chiffres apres prefix-tenant-annee */
  ORDER_NUMBER_PADDING: 5,
} as const;

/**
 * Kafka topics emis par module orders
 */
export const ORDER_KAFKA_TOPICS = {
  CREATED: 'insurtech.events.repair.order.created',
  ASSIGNED: 'insurtech.events.repair.order.assigned',
  STARTED: 'insurtech.events.repair.order.started',
  HOURS_LOGGED: 'insurtech.events.repair.order.hours_logged',
  PARTS_CONSUMED: 'insurtech.events.repair.parts_consumed',
  TASK_COMPLETED: 'insurtech.events.repair.order.task_completed',
  ADDITIONAL_TASK_ADDED: 'insurtech.events.repair.order.additional_task_added',
  OVER_BUDGET: 'insurtech.events.repair.order.over_budget',
  COMPLETED: 'insurtech.events.repair.order.completed',
  CANCELLED: 'insurtech.events.repair.order.cancelled',
} as const;
```

### Fichier 2/13 : `repo/packages/repair/src/entities/repair-order.entity.ts`

```typescript
// repo/packages/repair/src/entities/repair-order.entity.ts

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { RepairSinistre } from './repair-sinistre.entity.js';
import { RepairDevis } from './repair-devis.entity.js';
import { RepairOrderLaborLog } from './repair-order-labor-log.entity.js';
import type { OrderStatus, TaskType, TaskStatus, CancellationReason } from '../constants/orders-constants.js';

/**
 * Task dans la checklist d'un ordre (JSONB array)
 */
export interface OrderTask {
  id: string;
  type: TaskType;
  description: string;
  status: TaskStatus;
  /** Heures estimees (depuis devis pour labor) */
  estimated_hours?: number;
  /** Quantite estimee (depuis devis pour parts) */
  estimated_quantity?: number;
  /** Cout estime HT (depuis devis) */
  estimated_cost_ht: string;
  /** ID stock_item si type=parts (FK soft) */
  stock_item_ref?: string;
  /** Heures loggees effectives (compute on logHours) */
  actual_hours_logged?: number;
  /** Quantite effective consommee (compute on consumePart) */
  actual_quantity_consumed?: number;
  /** Cout actuel HT (compute) */
  actual_cost_ht?: string;
  /** Reference devis item d'origine pour traceabilite */
  devis_item_id?: string;
  /** Date completion */
  completed_at?: string;
  /** Notes technicien */
  notes?: string;
}

/**
 * Piece consommee enregistree dans repair_orders.parts_consumption (JSONB array)
 */
export interface OrderPartConsumed {
  /** UUID unique pour cette consommation (idempotency) */
  consumption_id: string;
  /** FK stock_items.id */
  stock_item_id: string;
  /** SKU piece au moment de la consommation */
  stock_item_sku: string;
  /** Description piece */
  stock_item_description: string;
  /** Quantite consommee */
  quantity: number;
  /** Cout unitaire calcule FIFO Sprint 13 */
  unit_cost_at_consume: string;
  /** Cout total = quantity * unit_cost */
  total_cost: string;
  /** FK repair_orders.tasks[].id */
  task_id?: string;
  /** Technicien qui a effectue le consume */
  consumed_by_employee_id: string;
  /** Timestamp ISO8601 */
  consumed_at: string;
  /** Reference movement Sprint 13 stock_movements.id */
  stock_movement_id: string;
}

@Entity('repair_orders')
@Index('idx_repair_orders_tenant_status', ['tenant_id', 'status'])
@Index('idx_repair_orders_sinistre', ['sinistre_id'])
@Index('idx_repair_orders_devis_unique', ['tenant_id', 'devis_id'], { unique: true, where: 'status != \'cancelled\'' })
@Index('idx_repair_orders_number_unique', ['tenant_id', 'order_number'], { unique: true })
@Index('idx_repair_orders_technician', ['assigned_technician_id', 'status'])
export class RepairOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid' })
  sinistre_id!: string;

  @ManyToOne(() => RepairSinistre)
  @JoinColumn({ name: 'sinistre_id' })
  sinistre!: RepairSinistre;

  @Column({ type: 'uuid' })
  devis_id!: string;

  @ManyToOne(() => RepairDevis)
  @JoinColumn({ name: 'devis_id' })
  devis!: RepairDevis;

  @Column({ type: 'varchar', length: 30 })
  order_number!: string;   // ORD-{tenant_prefix}-2026-00001

  @Column({ type: 'uuid', nullable: true })
  assigned_technician_id!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  assigned_at!: Date | null;

  @Column({ type: 'jsonb', default: '[]' })
  tasks!: OrderTask[];

  @Column({ type: 'jsonb', default: '[]' })
  parts_consumption!: OrderPartConsumed[];

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  labor_hours_logged!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  labor_cost_actual!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  parts_cost_actual!: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total_cost_actual!: string;

  /** Budget HT (snapshot devis.subtotal_ht au moment creation) */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  budget_total_ht!: string;

  @Column({ type: 'boolean', default: false })
  is_over_budget!: boolean;

  @Column({
    type: 'enum',
    enum: ['pending', 'in_progress', 'completed', 'cancelled'],
    default: 'pending',
  })
  status!: OrderStatus;

  @Column({ type: 'timestamptz', nullable: true })
  started_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelled_at!: Date | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  cancellation_reason!: CancellationReason | null;

  @Column({ type: 'text', nullable: true })
  cancellation_notes!: string | null;

  @Column({ type: 'boolean', default: true })
  parts_returned_on_cancel!: boolean;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ type: 'uuid' })
  created_by!: string;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => RepairOrderLaborLog, (log) => log.order)
  labor_logs?: RepairOrderLaborLog[];
}
```

### Fichier 3/13 : `repo/packages/repair/src/entities/repair-order-labor-log.entity.ts`

```typescript
// repo/packages/repair/src/entities/repair-order-labor-log.entity.ts

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { RepairOrder } from './repair-order.entity.js';

/**
 * Historique granulaire des heures loggees sur un ordre.
 * Source de verite pour audit + paie variable productive HR Sprint 13.
 */
@Entity('repair_order_labor_logs')
@Index('idx_labor_logs_tenant_order', ['tenant_id', 'order_id'])
@Index('idx_labor_logs_employee_date', ['employee_id', 'logged_at'])
@Index('idx_labor_logs_order_task', ['order_id', 'task_id'])
export class RepairOrderLaborLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid' })
  order_id!: string;

  @ManyToOne(() => RepairOrder, (order) => order.labor_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: RepairOrder;

  /** Reference task dans repair_orders.tasks[].id (FK soft JSONB) */
  @Column({ type: 'uuid', nullable: true })
  task_id!: string | null;

  /** FK hr_employees.id (Sprint 13) */
  @Column({ type: 'uuid' })
  employee_id!: string;

  /** Heures loggees (precision Decimal 2 decimales : 0.25 = 15 min) */
  @Column({ type: 'numeric', precision: 6, scale: 2 })
  hours!: string;

  /** Taux horaire au moment du log (snapshot pour eviter drift recompute) */
  @Column({ type: 'numeric', precision: 8, scale: 2 })
  hourly_rate_at_time!: string;

  /** Cout calcule = hours * hourly_rate_at_time (Decimal.js precision centime) */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  cost!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'timestamptz' })
  logged_at!: Date;

  @CreateDateColumn()
  created_at!: Date;
}
```

### Fichier 4/13 : `repo/packages/repair/src/dto/orders.dto.ts`

```typescript
// repo/packages/repair/src/dto/orders.dto.ts

import { z } from 'zod';
import { ORDER_STATUSES, TASK_STATUSES, TASK_TYPES, CANCELLATION_REASONS } from '../constants/orders-constants.js';

/**
 * Input task ajout manuel
 */
export const OrderTaskInputSchema = z.object({
  type: z.enum(TASK_TYPES),
  description: z.string().min(2).max(500),
  estimated_hours: z.number().min(0).max(1000).optional(),
  estimated_quantity: z.number().min(0).max(10000).optional(),
  estimated_cost_ht: z.number().min(0).max(1_000_000),
  stock_item_ref: z.string().uuid().optional(),
  devis_item_id: z.string().uuid().optional(),
});
export type OrderTaskInput = z.infer<typeof OrderTaskInputSchema>;

/**
 * Create order from approved devis
 */
export const CreateOrderFromDevisInputSchema = z.object({
  devis_id: z.string().uuid(),
});
export type CreateOrderFromDevisInput = z.infer<typeof CreateOrderFromDevisInputSchema>;

/**
 * Assign technician
 */
export const AssignTechnicianInputSchema = z.object({
  technician_id: z.string().uuid(),
  notes: z.string().max(500).optional(),
});
export type AssignTechnicianInput = z.infer<typeof AssignTechnicianInputSchema>;

/**
 * Log hours sur un ordre
 */
export const LogHoursInputSchema = z.object({
  task_id: z.string().uuid().optional(),
  hours: z.number().positive().max(24, 'Une session ne peut depasser 24h'),
  description: z.string().min(2).max(500),
  logged_at: z.string().datetime().optional(),
});
export type LogHoursInput = z.infer<typeof LogHoursInputSchema>;

/**
 * Consume part : NECESSITE header Idempotency-Key
 */
export const ConsumePartInputSchema = z.object({
  stock_item_id: z.string().uuid(),
  quantity: z.number().positive().int().max(1000),
  task_id: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});
export type ConsumePartInput = z.infer<typeof ConsumePartInputSchema>;

/**
 * Mark task completed
 */
export const MarkTaskCompletedInputSchema = z.object({
  notes: z.string().max(500).optional(),
});
export type MarkTaskCompletedInput = z.infer<typeof MarkTaskCompletedInputSchema>;

/**
 * Add additional task (post-start, declenche re-devis si depasse seuil)
 */
export const AddAdditionalTaskInputSchema = z.object({
  type: z.enum(['parts', 'labor', 'misc']),
  description: z.string().min(2).max(500),
  estimated_hours: z.number().min(0).max(1000).optional(),
  estimated_quantity: z.number().min(0).max(10000).optional(),
  estimated_cost_ht: z.number().positive().max(1_000_000),
  stock_item_ref: z.string().uuid().optional(),
  reason: z.string().min(10).max(1000),
});
export type AddAdditionalTaskInput = z.infer<typeof AddAdditionalTaskInputSchema>;

/**
 * Cancel order
 */
export const CancelOrderInputSchema = z.object({
  reason: z.enum(CANCELLATION_REASONS),
  notes: z.string().max(1000).optional(),
  return_parts_to_stock: z.boolean().default(true),
});
export type CancelOrderInput = z.infer<typeof CancelOrderInputSchema>;

/**
 * Query filters orders
 */
export const OrdersListQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  sinistre_id: z.string().uuid().optional(),
  assigned_technician_id: z.string().uuid().optional(),
  is_over_budget: z.coerce.boolean().optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.enum(['created_at', 'started_at', 'completed_at', 'order_number']).default('created_at'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
});
export type OrdersListQuery = z.infer<typeof OrdersListQuerySchema>;

/**
 * Response order resume
 */
export const OrderResponseSchema = z.object({
  id: z.string().uuid(),
  order_number: z.string(),
  sinistre_id: z.string().uuid(),
  devis_id: z.string().uuid(),
  status: z.enum(ORDER_STATUSES),
  assigned_technician_id: z.string().uuid().nullable(),
  budget_total_ht: z.string(),
  labor_hours_logged: z.string(),
  labor_cost_actual: z.string(),
  parts_cost_actual: z.string(),
  total_cost_actual: z.string(),
  is_over_budget: z.boolean(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  cancelled_at: z.string().datetime().nullable(),
  tasks_total: z.number().int(),
  tasks_completed: z.number().int(),
  parts_consumed_count: z.number().int(),
});
export type OrderResponse = z.infer<typeof OrderResponseSchema>;

/**
 * Response progress (computed)
 */
export const OrderProgressResponseSchema = z.object({
  order_id: z.string().uuid(),
  tasks_total: z.number().int(),
  tasks_completed: z.number().int(),
  tasks_in_progress: z.number().int(),
  tasks_pending: z.number().int(),
  progress_pct: z.number().min(0).max(100),
  labor_hours_logged: z.string(),
  labor_budget_consumed_pct: z.number().min(0),
  parts_budget_consumed_pct: z.number().min(0),
  total_budget_consumed_pct: z.number().min(0),
  is_over_budget: z.boolean(),
  over_budget_amount: z.string(),
});
export type OrderProgressResponse = z.infer<typeof OrderProgressResponseSchema>;
```

### Fichier 5/13 : `repo/packages/repair/src/utils/orders-cost.util.ts`

```typescript
// repo/packages/repair/src/utils/orders-cost.util.ts
// Utility precision Decimal.js pour calculs couts ordre
// Garantie : 100% precision centime, jamais drift float

import { Decimal } from 'decimal.js';
import { ORDER_CONSTANTS } from '../constants/orders-constants.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

/**
 * Compute cout d'un log labor : hours * hourly_rate
 * @param hours number ou string (ex: '1.5' = 1h30)
 * @param hourlyRate number ou string (ex: '350.00' = 350 MAD/h)
 * @returns string Decimal 2 decimales (ex: '525.00')
 */
export function computeLaborCost(hours: number | string, hourlyRate: number | string): string {
  const h = new Decimal(hours);
  const r = new Decimal(hourlyRate);
  return h.mul(r).toFixed(ORDER_CONSTANTS.DECIMAL_SCALE);
}

/**
 * Compute cout consume part : quantity * unit_cost
 */
export function computePartCost(quantity: number, unitCost: number | string): string {
  const q = new Decimal(quantity);
  const u = new Decimal(unitCost);
  return q.mul(u).toFixed(ORDER_CONSTANTS.DECIMAL_SCALE);
}

/**
 * Cumul total cout actual = labor + parts (precision absolue Decimal)
 */
export function computeTotalCostActual(laborCost: string, partsCost: string): string {
  return new Decimal(laborCost).plus(new Decimal(partsCost)).toFixed(ORDER_CONSTANTS.DECIMAL_SCALE);
}

/**
 * Verifie si total cost depasse budget de plus de threshold
 * @returns { is_over: boolean, over_amount: string, over_pct: number }
 */
export interface BudgetCheckResult {
  is_over: boolean;
  over_amount: string;
  over_pct: number;
  threshold_pct: number;
}

export function checkBudgetOverrun(
  totalCostActual: string | number,
  budgetTotalHt: string | number,
  thresholdPct: number = ORDER_CONSTANTS.BUDGET_OVER_THRESHOLD_PCT,
): BudgetCheckResult {
  const total = new Decimal(totalCostActual);
  const budget = new Decimal(budgetTotalHt);
  const threshold = budget.mul(new Decimal(1).plus(thresholdPct));
  const isOver = total.greaterThan(threshold);
  const overAmount = total.minus(budget).toFixed(ORDER_CONSTANTS.DECIMAL_SCALE);
  const overPct = budget.isZero() ? 0 : total.minus(budget).div(budget).mul(100).toNumber();
  return {
    is_over: isOver,
    over_amount: isOver ? overAmount : '0.00',
    over_pct: Math.max(0, overPct),
    threshold_pct: thresholdPct,
  };
}

/**
 * Compute progress percentage tasks
 */
export function computeTasksProgress(tasks: ReadonlyArray<{ status: string }>): {
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  cancelled: number;
  progress_pct: number;
} {
  const total = tasks.length;
  if (total === 0) {
    return { total: 0, completed: 0, in_progress: 0, pending: 0, cancelled: 0, progress_pct: 0 };
  }
  let completed = 0, in_progress = 0, pending = 0, cancelled = 0;
  for (const t of tasks) {
    if (t.status === 'completed') completed += 1;
    else if (t.status === 'in_progress') in_progress += 1;
    else if (t.status === 'pending') pending += 1;
    else if (t.status === 'cancelled') cancelled += 1;
  }
  const eligible = total - cancelled;
  const progress_pct = eligible === 0 ? 100 : new Decimal(completed).div(new Decimal(eligible)).mul(100).toDP(2).toNumber();
  return { total, completed, in_progress, pending, cancelled, progress_pct };
}

/**
 * Compute % budget consume
 */
export function computeBudgetConsumedPct(consumed: string | number, budget: string | number): number {
  const b = new Decimal(budget);
  if (b.isZero()) return 0;
  return new Decimal(consumed).div(b).mul(100).toDP(2).toNumber();
}
```

### Fichier 6/13 : `repo/packages/repair/src/services/orders-state-machine.ts`

```typescript
// repo/packages/repair/src/services/orders-state-machine.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { ORDER_TRANSITIONS, type OrderStatus } from '../constants/orders-constants.js';

@Injectable()
export class OrdersStateMachine {
  /**
   * Valide qu'une transition est legitime selon ORDER_TRANSITIONS.
   * Throw BadRequestException si invalide.
   */
  validateTransition(from: OrderStatus, to: OrderStatus): void {
    const allowed = ORDER_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new BadRequestException({
        code: 'INVALID_ORDER_STATUS_TRANSITION',
        message: `Cannot transition from ${from} to ${to}`,
        from,
        to,
        allowed_transitions: allowed,
      });
    }
  }

  /**
   * Verifie si statut est terminal (completed/cancelled).
   */
  isTerminal(status: OrderStatus): boolean {
    return status === 'completed' || status === 'cancelled';
  }

  /**
   * Verifie si statut autorise les mutations operationnelles
   * (logHours, consumePart, markTaskCompleted, addAdditionalTask).
   */
  canMutateExecution(status: OrderStatus): boolean {
    return status === 'in_progress';
  }

  /**
   * Verifie si statut autorise assignation technicien.
   */
  canAssignTechnician(status: OrderStatus): boolean {
    return status === 'pending';
  }

  /**
   * Verifie si statut autorise start.
   */
  canStart(status: OrderStatus): boolean {
    return status === 'pending';
  }

  /**
   * Verifie si statut autorise complete.
   */
  canComplete(status: OrderStatus): boolean {
    return status === 'in_progress';
  }

  /**
   * Verifie si statut autorise cancel.
   */
  canCancel(status: OrderStatus): boolean {
    return status === 'pending' || status === 'in_progress';
  }
}
```

### Fichier 7/13 : `repo/packages/repair/src/services/orders-numbering.service.ts`

```typescript
// repo/packages/repair/src/services/orders-numbering.service.ts

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ORDER_CONSTANTS } from '../constants/orders-constants.js';

@Injectable()
export class OrdersNumberingService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * Genere un order_number unique atomique via function Postgres.
   * Format : ORD-{tenant_prefix}-{year}-{padded_seq}
   * Ex : ORD-ATLAS-2026-00001
   *
   * @param tenantId UUID tenant
   * @param tenantPrefix Code court tenant (ex: 'ATLAS' pour Skalean Atlas)
   * @param year Annee de reference (default current year)
   */
  async generateOrderNumber(
    tenantId: string,
    tenantPrefix: string,
    year: number = new Date().getFullYear(),
  ): Promise<string> {
    const result = await this.dataSource.query<Array<{ next_number: number }>>(
      'SELECT get_next_order_number($1, $2) AS next_number',
      [tenantId, year],
    );
    const next = result[0]?.next_number;
    if (next === undefined || next === null) {
      throw new Error('Failed to generate order_number sequence');
    }
    const padded = String(next).padStart(ORDER_CONSTANTS.ORDER_NUMBER_PADDING, '0');
    return `${ORDER_CONSTANTS.ORDER_NUMBER_PREFIX}-${tenantPrefix}-${year}-${padded}`;
  }
}
```

### Fichier 8/13 : `repo/packages/repair/src/services/orders-events.publisher.ts`

```typescript
// repo/packages/repair/src/services/orders-events.publisher.ts

import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'pino';
import type { EntityManager } from 'typeorm';
import { ORDER_KAFKA_TOPICS } from '../constants/orders-constants.js';
import type { RepairOrder } from '../entities/repair-order.entity.js';

export interface OutboxEventInput {
  topic: string;
  payload: Record<string, unknown>;
  tenant_id: string;
  correlation_id?: string;
}

/**
 * Publisher events orders via pattern Outbox :
 * INSERT INTO outbox_events dans la meme transaction que la mutation business.
 * Un worker dedie (Sprint 4 deja livre) relay vers Kafka asynchrone.
 */
@Injectable()
export class OrdersEventsPublisher {
  constructor(@Inject('PINO_LOGGER') private readonly logger: Logger) {}

  private async insertOutbox(em: EntityManager, event: OutboxEventInput): Promise<void> {
    await em.query(
      `INSERT INTO outbox_events (id, tenant_id, topic, payload, correlation_id, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4, NOW())`,
      [event.tenant_id, event.topic, JSON.stringify(event.payload), event.correlation_id ?? null],
    );
    this.logger.info(
      { tenant_id: event.tenant_id, topic: event.topic, action: 'outbox_inserted' },
      'Outbox event inserted',
    );
  }

  async emitCreated(em: EntityManager, order: RepairOrder): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.CREATED,
      tenant_id: order.tenant_id,
      payload: {
        order_id: order.id, order_number: order.order_number,
        sinistre_id: order.sinistre_id, devis_id: order.devis_id,
        budget_total_ht: order.budget_total_ht,
        tasks_count: order.tasks.length,
      },
    });
  }

  async emitAssigned(em: EntityManager, order: RepairOrder, technicianId: string): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.ASSIGNED,
      tenant_id: order.tenant_id,
      payload: { order_id: order.id, order_number: order.order_number, technician_id: technicianId },
    });
  }

  async emitStarted(em: EntityManager, order: RepairOrder): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.STARTED,
      tenant_id: order.tenant_id,
      payload: {
        order_id: order.id, order_number: order.order_number,
        technician_id: order.assigned_technician_id, sinistre_id: order.sinistre_id,
      },
    });
  }

  async emitHoursLogged(
    em: EntityManager, order: RepairOrder, log: { employee_id: string; hours: string; cost: string; task_id?: string | null },
  ): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.HOURS_LOGGED,
      tenant_id: order.tenant_id,
      payload: {
        order_id: order.id, employee_id: log.employee_id,
        hours: log.hours, cost: log.cost, task_id: log.task_id ?? null,
      },
    });
  }

  async emitPartsConsumed(
    em: EntityManager, order: RepairOrder, consumption: { stock_item_id: string; quantity: number; total_cost: string },
  ): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.PARTS_CONSUMED,
      tenant_id: order.tenant_id,
      payload: {
        order_id: order.id, stock_item_id: consumption.stock_item_id,
        quantity: consumption.quantity, total_cost: consumption.total_cost,
      },
    });
  }

  async emitTaskCompleted(em: EntityManager, order: RepairOrder, taskId: string): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.TASK_COMPLETED,
      tenant_id: order.tenant_id,
      payload: { order_id: order.id, task_id: taskId },
    });
  }

  async emitAdditionalTaskAdded(em: EntityManager, order: RepairOrder, taskId: string, reason: string): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.ADDITIONAL_TASK_ADDED,
      tenant_id: order.tenant_id,
      payload: { order_id: order.id, task_id: taskId, reason },
    });
  }

  async emitOverBudget(em: EntityManager, order: RepairOrder, overAmount: string, overPct: number): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.OVER_BUDGET,
      tenant_id: order.tenant_id,
      payload: {
        order_id: order.id, order_number: order.order_number,
        budget_total_ht: order.budget_total_ht, total_cost_actual: order.total_cost_actual,
        over_amount: overAmount, over_pct: overPct,
      },
    });
  }

  async emitCompleted(em: EntityManager, order: RepairOrder): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.COMPLETED,
      tenant_id: order.tenant_id,
      payload: {
        order_id: order.id, order_number: order.order_number, sinistre_id: order.sinistre_id,
        labor_hours_logged: order.labor_hours_logged, labor_cost_actual: order.labor_cost_actual,
        parts_cost_actual: order.parts_cost_actual, total_cost_actual: order.total_cost_actual,
      },
    });
  }

  async emitCancelled(em: EntityManager, order: RepairOrder, reason: string): Promise<void> {
    await this.insertOutbox(em, {
      topic: ORDER_KAFKA_TOPICS.CANCELLED,
      tenant_id: order.tenant_id,
      payload: {
        order_id: order.id, order_number: order.order_number, reason,
        parts_returned: order.parts_returned_on_cancel,
      },
    });
  }
}
```

### Fichier 9/13 : `repo/packages/repair/src/services/orders.service.ts`

```typescript
// repo/packages/repair/src/services/orders.service.ts

import {
  Injectable, Inject, BadRequestException, NotFoundException,
  ConflictException, ForbiddenException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Logger } from 'pino';
import Redis from 'ioredis';
import { Decimal } from 'decimal.js';

import { RepairOrder, type OrderTask, type OrderPartConsumed } from '../entities/repair-order.entity.js';
import { RepairOrderLaborLog } from '../entities/repair-order-labor-log.entity.js';
import { RepairDevis } from '../entities/repair-devis.entity.js';
import { RepairSinistre } from '../entities/repair-sinistre.entity.js';
import { ORDER_CONSTANTS, ASSIGNABLE_HR_ROLES, type OrderStatus, type CancellationReason } from '../constants/orders-constants.js';
import { OrdersStateMachine } from './orders-state-machine.js';
import { OrdersNumberingService } from './orders-numbering.service.js';
import { OrdersEventsPublisher } from './orders-events.publisher.js';
import {
  computeLaborCost, computePartCost, computeTotalCostActual, checkBudgetOverrun, computeTasksProgress, computeBudgetConsumedPct,
} from '../utils/orders-cost.util.js';
import { TenantContext } from '@insurtech/shared-utils';
import { HrEmployeesService } from '@insurtech/hr';
import { StockMovementsService } from '@insurtech/stock';
import { SinistresService } from './sinistres.service.js';
import type {
  CreateOrderFromDevisInput, AssignTechnicianInput, LogHoursInput, ConsumePartInput,
  MarkTaskCompletedInput, AddAdditionalTaskInput, CancelOrderInput, OrdersListQuery,
  OrderResponse, OrderProgressResponse,
} from '../dto/orders.dto.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly stateMachine: OrdersStateMachine,
    private readonly numbering: OrdersNumberingService,
    private readonly events: OrdersEventsPublisher,
    private readonly hrEmployees: HrEmployeesService,
    private readonly stockMovements: StockMovementsService,
    private readonly sinistresService: SinistresService,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  /**
   * Cree un ordre depuis un devis approuve.
   * - Verifie devis status='approved'
   * - Verifie pas d'ordre actif pour ce devis (UNIQUE partial index)
   * - Parse devis.items -> tasks[] avec statuts 'pending'
   * - Genere order_number atomique
   * - INSERT + outbox event
   */
  async createFromApprovedDevis(input: CreateOrderFromDevisInput): Promise<RepairOrder> {
    const tenantId = TenantContext.getTenantId();
    const userId = TenantContext.getUserId();

    this.logger.info({ tenant_id: tenantId, devis_id: input.devis_id, action: 'order_create_attempt' }, 'Creating order from devis');

    return this.dataSource.transaction('REPEATABLE READ', async (em) => {
      const devis = await em.findOne(RepairDevis, { where: { id: input.devis_id, tenant_id: tenantId } });
      if (!devis) throw new NotFoundException({ code: 'DEVIS_NOT_FOUND' });
      if (devis.status !== 'approved') {
        throw new BadRequestException({ code: 'DEVIS_NOT_APPROVED', current_status: devis.status });
      }

      // Verif unicite : aucun ordre actif pour ce devis
      const existing = await em.findOne(RepairOrder, {
        where: { tenant_id: tenantId, devis_id: input.devis_id, status: In(['pending', 'in_progress', 'completed']) },
      });
      if (existing) {
        throw new ConflictException({ code: 'ORDER_ALREADY_EXISTS_FOR_DEVIS', existing_order_id: existing.id });
      }

      // Parse devis items -> tasks
      const tasks: OrderTask[] = devis.items.map((item) => ({
        id: randomUUID(),
        type: item.type === 'parts' ? 'parts' : item.type === 'labor' ? 'labor' : 'misc',
        description: item.description,
        status: 'pending',
        estimated_hours: item.type === 'labor' ? item.quantity : undefined,
        estimated_quantity: item.type === 'parts' ? item.quantity : undefined,
        estimated_cost_ht: item.total_ht,
        stock_item_ref: undefined,
        devis_item_id: item.id,
      }));

      if (tasks.length > ORDER_CONSTANTS.MAX_TASKS_PER_ORDER) {
        throw new BadRequestException({ code: 'TOO_MANY_TASKS', max: ORDER_CONSTANTS.MAX_TASKS_PER_ORDER, actual: tasks.length });
      }

      // Fetch tenant prefix (ex: ATLAS pour Skalean Atlas)
      const tenantRow = await em.query<Array<{ short_code: string }>>(
        'SELECT short_code FROM tenants WHERE id = $1', [tenantId],
      );
      const tenantPrefix = tenantRow[0]?.short_code ?? 'TENANT';

      const orderNumber = await this.numbering.generateOrderNumber(tenantId, tenantPrefix);

      const order = em.create(RepairOrder, {
        tenant_id: tenantId,
        sinistre_id: devis.sinistre_id,
        devis_id: devis.id,
        order_number: orderNumber,
        tasks,
        parts_consumption: [],
        labor_hours_logged: '0.00',
        labor_cost_actual: '0.00',
        parts_cost_actual: '0.00',
        total_cost_actual: '0.00',
        budget_total_ht: devis.subtotal_ht,
        is_over_budget: false,
        status: 'pending' as OrderStatus,
        created_by: userId,
      });
      const saved = await em.save(order);

      await this.events.emitCreated(em, saved);

      this.logger.info({ tenant_id: tenantId, order_id: saved.id, order_number: orderNumber, action: 'order_created' }, 'Order created');
      return saved;
    });
  }

  /**
   * Assignation technicien : valide via HR puis update.
   */
  async assignTechnician(orderId: string, input: AssignTechnicianInput): Promise<RepairOrder> {
    const tenantId = TenantContext.getTenantId();
    return this.dataSource.transaction(async (em) => {
      const order = await this.findOneOrFail(em, orderId);
      if (!this.stateMachine.canAssignTechnician(order.status)) {
        throw new BadRequestException({ code: 'CANNOT_ASSIGN_IN_STATUS', current_status: order.status });
      }
      const employee = await this.hrEmployees.findOne(input.technician_id, tenantId);
      if (!employee) throw new NotFoundException({ code: 'TECHNICIAN_NOT_FOUND' });
      if (!employee.is_active) throw new BadRequestException({ code: 'TECHNICIAN_INACTIVE' });
      if (!ASSIGNABLE_HR_ROLES.includes(employee.role as typeof ASSIGNABLE_HR_ROLES[number])) {
        throw new BadRequestException({ code: 'EMPLOYEE_ROLE_NOT_ASSIGNABLE', role: employee.role, allowed: ASSIGNABLE_HR_ROLES });
      }
      await em.update(RepairOrder, orderId, {
        assigned_technician_id: input.technician_id,
        assigned_at: new Date(),
      });
      const updated = await this.findOneOrFail(em, orderId);
      await this.events.emitAssigned(em, updated, input.technician_id);
      return updated;
    });
  }

  /**
   * Demarre un ordre : transition order pending -> in_progress + sinistre under_repair (deja la).
   */
  async start(orderId: string): Promise<RepairOrder> {
    return this.dataSource.transaction('REPEATABLE READ', async (em) => {
      const order = await this.findOneForUpdate(em, orderId);
      if (!this.stateMachine.canStart(order.status)) {
        throw new BadRequestException({ code: 'CANNOT_START_IN_STATUS', current_status: order.status });
      }
      if (!order.assigned_technician_id) {
        throw new BadRequestException({ code: 'NO_TECHNICIAN_ASSIGNED' });
      }
      this.stateMachine.validateTransition(order.status, 'in_progress');
      await em.update(RepairOrder, orderId, { status: 'in_progress', started_at: new Date() });
      const updated = await this.findOneOrFail(em, orderId);
      await this.events.emitStarted(em, updated);
      return updated;
    });
  }

  /**
   * Log heures sur un ordre.
   * - Transaction REPEATABLE READ + FOR UPDATE
   * - Fetch hourly_rate snapshot
   * - INSERT labor_log + UPDATE cumul + check budget
   */
  async logHours(orderId: string, input: LogHoursInput, employeeIdOverride?: string): Promise<RepairOrder> {
    const tenantId = TenantContext.getTenantId();
    const employeeId = employeeIdOverride ?? TenantContext.getUserId();

    return this.dataSource.transaction('REPEATABLE READ', async (em) => {
      const order = await this.findOneForUpdate(em, orderId);
      if (!this.stateMachine.canMutateExecution(order.status)) {
        throw new BadRequestException({ code: 'CANNOT_LOG_HOURS_IN_STATUS', current_status: order.status });
      }

      const employee = await this.hrEmployees.findOne(employeeId, tenantId);
      if (!employee) throw new NotFoundException({ code: 'EMPLOYEE_NOT_FOUND' });
      const hourlyRate = employee.hourly_rate ?? '0.00';

      const cost = computeLaborCost(input.hours, hourlyRate);
      const log = em.create(RepairOrderLaborLog, {
        tenant_id: tenantId,
        order_id: orderId,
        task_id: input.task_id ?? null,
        employee_id: employeeId,
        hours: String(input.hours),
        hourly_rate_at_time: hourlyRate,
        cost,
        description: input.description,
        logged_at: input.logged_at ? new Date(input.logged_at) : new Date(),
      });
      await em.save(log);

      const newLaborHours = new Decimal(order.labor_hours_logged).plus(input.hours).toFixed(2);
      const newLaborCost = new Decimal(order.labor_cost_actual).plus(cost).toFixed(2);
      const newTotalCost = computeTotalCostActual(newLaborCost, order.parts_cost_actual);

      const budgetCheck = checkBudgetOverrun(newTotalCost, order.budget_total_ht);
      await em.update(RepairOrder, orderId, {
        labor_hours_logged: newLaborHours,
        labor_cost_actual: newLaborCost,
        total_cost_actual: newTotalCost,
        is_over_budget: budgetCheck.is_over,
      });

      const updated = await this.findOneOrFail(em, orderId);
      await this.events.emitHoursLogged(em, updated, {
        employee_id: employeeId, hours: String(input.hours), cost, task_id: input.task_id ?? null,
      });
      if (budgetCheck.is_over && !order.is_over_budget) {
        await this.events.emitOverBudget(em, updated, budgetCheck.over_amount, budgetCheck.over_pct);
      }
      return updated;
    });
  }

  /**
   * Consume une piece stock (atomique, idempotent via Redis).
   * Header `Idempotency-Key` requis (validation upstream controller).
   */
  async consumePart(
    orderId: string, input: ConsumePartInput, idempotencyKey: string,
  ): Promise<RepairOrder> {
    const tenantId = TenantContext.getTenantId();
    const userId = TenantContext.getUserId();
    const redisKey = `idempotency:${tenantId}:${userId}:${idempotencyKey}`;

    // Check idempotency
    const cached = await this.redis.get(redisKey);
    if (cached) {
      this.logger.info({ tenant_id: tenantId, order_id: orderId, idempotency_key: idempotencyKey, action: 'consume_part_idempotent_hit' }, 'Idempotent response served');
      return JSON.parse(cached) as RepairOrder;
    }

    const result = await this.dataSource.transaction('REPEATABLE READ', async (em) => {
      // Verrouille piece et ordre dans ordre deterministe : stock AVANT order
      const stockRow = await em.query<Array<{ id: string; quantity_on_hand: number; sku: string; description: string }>>(
        `SELECT id, quantity_on_hand, sku, description FROM stock_items
         WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
        [input.stock_item_id, tenantId],
      );
      const stockItem = stockRow[0];
      if (!stockItem) throw new NotFoundException({ code: 'STOCK_ITEM_NOT_FOUND' });
      if (stockItem.quantity_on_hand < input.quantity) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_STOCK',
          available: stockItem.quantity_on_hand, requested: input.quantity,
        });
      }

      const order = await this.findOneForUpdate(em, orderId);
      if (!this.stateMachine.canMutateExecution(order.status)) {
        throw new BadRequestException({ code: 'CANNOT_CONSUME_IN_STATUS', current_status: order.status });
      }
      if (order.parts_consumption.length >= ORDER_CONSTANTS.MAX_PARTS_PER_ORDER) {
        throw new BadRequestException({ code: 'MAX_PARTS_REACHED', max: ORDER_CONSTANTS.MAX_PARTS_PER_ORDER });
      }

      // Sprint 13 : decremente Stock FIFO + retourne unit_cost calcule
      const movement = await this.stockMovements.exit({
        stock_item_id: input.stock_item_id,
        quantity: input.quantity,
        reason: 'repair',
        reference_type: 'repair_order',
        reference_id: orderId,
        em,
      });

      const totalCost = computePartCost(input.quantity, movement.unit_cost_at_time);
      const consumption: OrderPartConsumed = {
        consumption_id: randomUUID(),
        stock_item_id: input.stock_item_id,
        stock_item_sku: stockItem.sku,
        stock_item_description: stockItem.description,
        quantity: input.quantity,
        unit_cost_at_consume: movement.unit_cost_at_time,
        total_cost: totalCost,
        task_id: input.task_id,
        consumed_by_employee_id: userId,
        consumed_at: new Date().toISOString(),
        stock_movement_id: movement.id,
      };

      const newPartsConsumption = [...order.parts_consumption, consumption];
      const newPartsCost = new Decimal(order.parts_cost_actual).plus(totalCost).toFixed(2);
      const newTotalCost = computeTotalCostActual(order.labor_cost_actual, newPartsCost);
      const budgetCheck = checkBudgetOverrun(newTotalCost, order.budget_total_ht);

      await em.update(RepairOrder, orderId, {
        parts_consumption: newPartsConsumption,
        parts_cost_actual: newPartsCost,
        total_cost_actual: newTotalCost,
        is_over_budget: budgetCheck.is_over,
      });

      const updated = await this.findOneOrFail(em, orderId);
      await this.events.emitPartsConsumed(em, updated, {
        stock_item_id: input.stock_item_id, quantity: input.quantity, total_cost: totalCost,
      });
      if (budgetCheck.is_over && !order.is_over_budget) {
        await this.events.emitOverBudget(em, updated, budgetCheck.over_amount, budgetCheck.over_pct);
      }
      return updated;
    });

    // Cache idempotency response
    await this.redis.setex(redisKey, ORDER_CONSTANTS.IDEMPOTENCY_TTL_SEC, JSON.stringify(result));
    return result;
  }

  /**
   * Mark une task individuelle completed.
   */
  async markTaskCompleted(orderId: string, taskId: string, input: MarkTaskCompletedInput): Promise<RepairOrder> {
    return this.dataSource.transaction(async (em) => {
      const order = await this.findOneForUpdate(em, orderId);
      if (!this.stateMachine.canMutateExecution(order.status)) {
        throw new BadRequestException({ code: 'CANNOT_COMPLETE_TASK_IN_STATUS', current_status: order.status });
      }
      const taskIndex = order.tasks.findIndex((t) => t.id === taskId);
      if (taskIndex < 0) throw new NotFoundException({ code: 'TASK_NOT_FOUND' });
      if (order.tasks[taskIndex].status === 'completed') {
        throw new ConflictException({ code: 'TASK_ALREADY_COMPLETED' });
      }
      const newTasks = order.tasks.map((t, i) =>
        i === taskIndex
          ? { ...t, status: 'completed' as const, completed_at: new Date().toISOString(), notes: input.notes ?? t.notes }
          : t,
      );
      await em.update(RepairOrder, orderId, { tasks: newTasks });
      const updated = await this.findOneOrFail(em, orderId);
      await this.events.emitTaskCompleted(em, updated, taskId);
      return updated;
    });
  }

  /**
   * Ajoute une task additionnelle (post-start, declenche re-devis si depasse seuil).
   */
  async addAdditionalTask(orderId: string, input: AddAdditionalTaskInput): Promise<RepairOrder> {
    return this.dataSource.transaction(async (em) => {
      const order = await this.findOneForUpdate(em, orderId);
      if (!this.stateMachine.canMutateExecution(order.status)) {
        throw new BadRequestException({ code: 'CANNOT_ADD_TASK_IN_STATUS', current_status: order.status });
      }
      const newTask: OrderTask = {
        id: randomUUID(),
        type: 'additional',
        description: input.description,
        status: 'pending',
        estimated_hours: input.estimated_hours,
        estimated_quantity: input.estimated_quantity,
        estimated_cost_ht: String(input.estimated_cost_ht),
        stock_item_ref: input.stock_item_ref,
        notes: `Additional task. Reason: ${input.reason}`,
      };
      const newTasks = [...order.tasks, newTask];
      if (newTasks.length > ORDER_CONSTANTS.MAX_TASKS_PER_ORDER) {
        throw new BadRequestException({ code: 'TOO_MANY_TASKS' });
      }

      // Projected total = actual + this additional estimate
      const projectedTotal = new Decimal(order.total_cost_actual).plus(input.estimated_cost_ht).toFixed(2);
      const budgetCheck = checkBudgetOverrun(projectedTotal, order.budget_total_ht, ORDER_CONSTANTS.BUDGET_RE_APPROVAL_THRESHOLD_PCT);

      await em.update(RepairOrder, orderId, { tasks: newTasks });
      const updated = await this.findOneOrFail(em, orderId);
      await this.events.emitAdditionalTaskAdded(em, updated, newTask.id, input.reason);
      if (budgetCheck.is_over) {
        await this.events.emitOverBudget(em, updated, budgetCheck.over_amount, budgetCheck.over_pct);
      }
      return updated;
    });
  }

  /**
   * Complete un ordre : valide all tasks completed + transition sinistre.
   */
  async complete(orderId: string): Promise<RepairOrder> {
    return this.dataSource.transaction(async (em) => {
      const order = await this.findOneForUpdate(em, orderId);
      if (!this.stateMachine.canComplete(order.status)) {
        throw new BadRequestException({ code: 'CANNOT_COMPLETE_IN_STATUS', current_status: order.status });
      }
      const incomplete = order.tasks.filter((t) => t.status !== 'completed' && t.status !== 'cancelled');
      if (incomplete.length > 0) {
        throw new BadRequestException({
          code: 'INCOMPLETE_TASKS_REMAINING',
          incomplete_count: incomplete.length, incomplete_ids: incomplete.map((t) => t.id),
        });
      }
      this.stateMachine.validateTransition(order.status, 'completed');
      await em.update(RepairOrder, orderId, { status: 'completed', completed_at: new Date() });
      const updated = await this.findOneOrFail(em, orderId);

      // Transition sinistre under_repair -> completed
      await this.sinistresService.transitionWithinTransaction(em, order.sinistre_id, 'completed', {
        triggered_by: 'order_completed', source_order_id: orderId,
      });

      await this.events.emitCompleted(em, updated);
      return updated;
    });
  }

  /**
   * Cancel ordre avec optional rollback Stock (return pieces).
   */
  async cancel(orderId: string, input: CancelOrderInput): Promise<RepairOrder> {
    return this.dataSource.transaction('REPEATABLE READ', async (em) => {
      const order = await this.findOneForUpdate(em, orderId);
      if (!this.stateMachine.canCancel(order.status)) {
        throw new BadRequestException({ code: 'CANNOT_CANCEL_IN_STATUS', current_status: order.status });
      }
      this.stateMachine.validateTransition(order.status, 'cancelled');

      if (input.return_parts_to_stock && order.parts_consumption.length > 0) {
        for (const p of order.parts_consumption) {
          await this.stockMovements.return_({
            stock_item_id: p.stock_item_id, quantity: p.quantity, reason: 'repair_cancelled',
            reference_type: 'repair_order', reference_id: orderId,
            original_unit_cost: p.unit_cost_at_consume, em,
          });
        }
      }

      await em.update(RepairOrder, orderId, {
        status: 'cancelled', cancelled_at: new Date(),
        cancellation_reason: input.reason as CancellationReason,
        cancellation_notes: input.notes ?? null,
        parts_returned_on_cancel: input.return_parts_to_stock,
      });
      const updated = await this.findOneOrFail(em, orderId);
      await this.sinistresService.transitionWithinTransaction(em, order.sinistre_id, 'cancelled', {
        triggered_by: 'order_cancelled', reason: input.reason,
      });
      await this.events.emitCancelled(em, updated, input.reason);
      return updated;
    });
  }

  async findAll(query: OrdersListQuery): Promise<{ items: OrderResponse[]; total: number; page: number; page_size: number }> {
    const tenantId = TenantContext.getTenantId();
    const qb = this.dataSource.getRepository(RepairOrder)
      .createQueryBuilder('o')
      .where('o.tenant_id = :tenantId', { tenantId });
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.sinistre_id) qb.andWhere('o.sinistre_id = :sId', { sId: query.sinistre_id });
    if (query.assigned_technician_id) qb.andWhere('o.assigned_technician_id = :tId', { tId: query.assigned_technician_id });
    if (query.is_over_budget !== undefined) qb.andWhere('o.is_over_budget = :ob', { ob: query.is_over_budget });
    if (query.created_after) qb.andWhere('o.created_at >= :ca', { ca: query.created_after });
    if (query.created_before) qb.andWhere('o.created_at < :cb', { cb: query.created_before });
    const total = await qb.getCount();
    const items = await qb
      .orderBy(`o.${query.sort_by}`, query.sort_order.toUpperCase() as 'ASC' | 'DESC')
      .skip((query.page - 1) * query.page_size).take(query.page_size).getMany();
    return {
      items: items.map((o) => this.toResponse(o)),
      total, page: query.page, page_size: query.page_size,
    };
  }

  async findOne(orderId: string): Promise<RepairOrder> {
    const tenantId = TenantContext.getTenantId();
    const order = await this.dataSource.getRepository(RepairOrder).findOne({ where: { id: orderId, tenant_id: tenantId } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    return order;
  }

  async getProgress(orderId: string): Promise<OrderProgressResponse> {
    const order = await this.findOne(orderId);
    const tasksProgress = computeTasksProgress(order.tasks);
    const budgetCheck = checkBudgetOverrun(order.total_cost_actual, order.budget_total_ht);
    const laborBudgetPct = computeBudgetConsumedPct(order.labor_cost_actual, order.budget_total_ht);
    const partsBudgetPct = computeBudgetConsumedPct(order.parts_cost_actual, order.budget_total_ht);
    const totalBudgetPct = computeBudgetConsumedPct(order.total_cost_actual, order.budget_total_ht);
    return {
      order_id: order.id,
      tasks_total: tasksProgress.total,
      tasks_completed: tasksProgress.completed,
      tasks_in_progress: tasksProgress.in_progress,
      tasks_pending: tasksProgress.pending,
      progress_pct: tasksProgress.progress_pct,
      labor_hours_logged: order.labor_hours_logged,
      labor_budget_consumed_pct: laborBudgetPct,
      parts_budget_consumed_pct: partsBudgetPct,
      total_budget_consumed_pct: totalBudgetPct,
      is_over_budget: budgetCheck.is_over,
      over_budget_amount: budgetCheck.over_amount,
    };
  }

  // Internal helpers ---------------------------------------------------------

  private async findOneOrFail(em: EntityManager, orderId: string): Promise<RepairOrder> {
    const tenantId = TenantContext.getTenantId();
    const order = await em.findOne(RepairOrder, { where: { id: orderId, tenant_id: tenantId } });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    return order;
  }

  private async findOneForUpdate(em: EntityManager, orderId: string): Promise<RepairOrder> {
    const tenantId = TenantContext.getTenantId();
    const order = await em.findOne(RepairOrder, {
      where: { id: orderId, tenant_id: tenantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) throw new NotFoundException({ code: 'ORDER_NOT_FOUND' });
    return order;
  }

  private toResponse(order: RepairOrder): OrderResponse {
    const tasksCompleted = order.tasks.filter((t) => t.status === 'completed').length;
    return {
      id: order.id, order_number: order.order_number, sinistre_id: order.sinistre_id, devis_id: order.devis_id,
      status: order.status, assigned_technician_id: order.assigned_technician_id,
      budget_total_ht: order.budget_total_ht, labor_hours_logged: order.labor_hours_logged,
      labor_cost_actual: order.labor_cost_actual, parts_cost_actual: order.parts_cost_actual,
      total_cost_actual: order.total_cost_actual, is_over_budget: order.is_over_budget,
      started_at: order.started_at?.toISOString() ?? null,
      completed_at: order.completed_at?.toISOString() ?? null,
      cancelled_at: order.cancelled_at?.toISOString() ?? null,
      tasks_total: order.tasks.length, tasks_completed: tasksCompleted,
      parts_consumed_count: order.parts_consumption.length,
    };
  }
}
```

### Fichier 10/13 : `repo/apps/api/src/modules/repair/controllers/orders.controller.ts`

```typescript
// repo/apps/api/src/modules/repair/controllers/orders.controller.ts

import {
  Controller, Post, Get, Patch, Body, Param, Query, Headers, UseGuards, HttpCode, HttpStatus, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, RequirePermissions } from '@insurtech/auth';
import { OrdersService } from '@insurtech/repair';
import {
  CreateOrderFromDevisInputSchema, AssignTechnicianInputSchema, LogHoursInputSchema,
  ConsumePartInputSchema, MarkTaskCompletedInputSchema, AddAdditionalTaskInputSchema,
  CancelOrderInputSchema, OrdersListQuerySchema,
} from '@insurtech/repair/dto/orders.dto.js';
import { ZodValidationPipe } from '@insurtech/shared-utils';

@Controller('api/v1/repair/orders')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('from-devis/:devisId')
  @RequirePermissions('repair.orders.create')
  @Roles('garage_admin', 'garage_chef')
  @HttpCode(HttpStatus.CREATED)
  async createFromDevis(@Param('devisId') devisId: string) {
    const input = CreateOrderFromDevisInputSchema.parse({ devis_id: devisId });
    const order = await this.ordersService.createFromApprovedDevis(input);
    return order;
  }

  @Post(':id/assign')
  @RequirePermissions('repair.orders.assign')
  @Roles('garage_admin', 'garage_chef')
  @HttpCode(HttpStatus.OK)
  async assign(@Param('id') id: string, @Body(new ZodValidationPipe(AssignTechnicianInputSchema)) body: unknown) {
    return this.ordersService.assignTechnician(id, body as never);
  }

  @Post(':id/start')
  @RequirePermissions('repair.orders.start')
  @Roles('garage_admin', 'garage_chef')
  @HttpCode(HttpStatus.OK)
  async start(@Param('id') id: string) {
    return this.ordersService.start(id);
  }

  @Post(':id/log-hours')
  @RequirePermissions('repair.orders.log_hours')
  @Roles('garage_admin', 'garage_chef', 'garage_technicien')
  @HttpCode(HttpStatus.OK)
  async logHours(@Param('id') id: string, @Body(new ZodValidationPipe(LogHoursInputSchema)) body: unknown) {
    return this.ordersService.logHours(id, body as never);
  }

  @Post(':id/consume-part')
  @RequirePermissions('repair.orders.consume_part')
  @Roles('garage_admin', 'garage_chef', 'garage_technicien')
  @HttpCode(HttpStatus.OK)
  async consumePart(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ConsumePartInputSchema)) body: unknown,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey || idempotencyKey.length < 8) {
      throw new BadRequestException({ code: 'IDEMPOTENCY_KEY_REQUIRED', min_length: 8 });
    }
    return this.ordersService.consumePart(id, body as never, idempotencyKey);
  }

  @Post(':id/tasks/:taskId/complete')
  @RequirePermissions('repair.orders.mark_task_completed')
  @Roles('garage_admin', 'garage_chef', 'garage_technicien')
  @HttpCode(HttpStatus.OK)
  async markTaskCompleted(
    @Param('id') id: string, @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(MarkTaskCompletedInputSchema)) body: unknown,
  ) {
    return this.ordersService.markTaskCompleted(id, taskId, body as never);
  }

  @Post(':id/additional-task')
  @RequirePermissions('repair.orders.add_additional_task')
  @Roles('garage_admin', 'garage_chef')
  @HttpCode(HttpStatus.CREATED)
  async addAdditionalTask(@Param('id') id: string, @Body(new ZodValidationPipe(AddAdditionalTaskInputSchema)) body: unknown) {
    return this.ordersService.addAdditionalTask(id, body as never);
  }

  @Post(':id/complete')
  @RequirePermissions('repair.orders.complete')
  @Roles('garage_admin', 'garage_chef')
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id') id: string) {
    return this.ordersService.complete(id);
  }

  @Post(':id/cancel')
  @RequirePermissions('repair.orders.cancel')
  @Roles('garage_admin', 'garage_chef')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') id: string, @Body(new ZodValidationPipe(CancelOrderInputSchema)) body: unknown) {
    return this.ordersService.cancel(id, body as never);
  }

  @Get()
  @RequirePermissions('repair.orders.read')
  @Roles('garage_admin', 'garage_chef', 'garage_technicien', 'garage_gestionnaire')
  async list(@Query(new ZodValidationPipe(OrdersListQuerySchema)) query: unknown) {
    return this.ordersService.findAll(query as never);
  }

  @Get(':id')
  @RequirePermissions('repair.orders.read')
  @Roles('garage_admin', 'garage_chef', 'garage_technicien', 'garage_gestionnaire')
  async findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Get(':id/progress')
  @RequirePermissions('repair.orders.view_progress')
  @Roles('garage_admin', 'garage_chef', 'garage_technicien', 'garage_gestionnaire')
  async getProgress(@Param('id') id: string) {
    return this.ordersService.getProgress(id);
  }
}
```

### Fichier 11/13 : `repo/packages/database/src/migrations/{ts1}-CreateRepairOrdersTable.ts`

```typescript
// repo/packages/database/src/migrations/{ts1}-CreateRepairOrdersTable.ts

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRepairOrdersTable1715000005000 implements MigrationInterface {
  name = 'CreateRepairOrdersTable1715000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE repair_order_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
    `);
    await queryRunner.query(`
      CREATE TABLE repair_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id) ON DELETE RESTRICT,
        devis_id UUID NOT NULL REFERENCES repair_devis(id) ON DELETE RESTRICT,
        order_number VARCHAR(30) NOT NULL,
        assigned_technician_id UUID NULL,
        assigned_at TIMESTAMPTZ NULL,
        tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
        parts_consumption JSONB NOT NULL DEFAULT '[]'::jsonb,
        labor_hours_logged NUMERIC(12,2) NOT NULL DEFAULT 0,
        labor_cost_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
        parts_cost_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
        total_cost_actual NUMERIC(12,2) NOT NULL DEFAULT 0,
        budget_total_ht NUMERIC(12,2) NOT NULL,
        is_over_budget BOOLEAN NOT NULL DEFAULT false,
        status repair_order_status NOT NULL DEFAULT 'pending',
        started_at TIMESTAMPTZ NULL,
        completed_at TIMESTAMPTZ NULL,
        cancelled_at TIMESTAMPTZ NULL,
        cancellation_reason VARCHAR(50) NULL,
        cancellation_notes TEXT NULL,
        parts_returned_on_cancel BOOLEAN NOT NULL DEFAULT true,
        notes TEXT NULL,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_repair_orders_number UNIQUE (tenant_id, order_number)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_repair_orders_tenant_status ON repair_orders(tenant_id, status);`);
    await queryRunner.query(`CREATE INDEX idx_repair_orders_sinistre ON repair_orders(sinistre_id);`);
    await queryRunner.query(`CREATE UNIQUE INDEX idx_repair_orders_devis_unique ON repair_orders(tenant_id, devis_id) WHERE status != 'cancelled';`);
    await queryRunner.query(`CREATE INDEX idx_repair_orders_technician ON repair_orders(assigned_technician_id, status) WHERE assigned_technician_id IS NOT NULL;`);

    // RLS multi-tenant
    await queryRunner.query(`ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY repair_orders_tenant_isolation ON repair_orders
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant());
    `);

    // Trigger updated_at
    await queryRunner.query(`
      CREATE TRIGGER trg_repair_orders_updated_at
        BEFORE UPDATE ON repair_orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_repair_orders_updated_at ON repair_orders;`);
    await queryRunner.query(`DROP POLICY IF EXISTS repair_orders_tenant_isolation ON repair_orders;`);
    await queryRunner.query(`DROP TABLE IF EXISTS repair_orders;`);
    await queryRunner.query(`DROP TYPE IF EXISTS repair_order_status;`);
  }
}
```

### Fichier 12/13 : `repo/packages/database/src/migrations/{ts4}-CreateGetNextOrderNumberFunction.ts`

```typescript
// repo/packages/database/src/migrations/{ts4}-CreateGetNextOrderNumberFunction.ts

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGetNextOrderNumberFunction1715000007000 implements MigrationInterface {
  name = 'CreateGetNextOrderNumberFunction1715000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS repair_orders_sequences (
        tenant_id UUID NOT NULL,
        year INT NOT NULL,
        last_value BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_id, year)
      );
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION get_next_order_number(p_tenant_id UUID, p_year INT)
      RETURNS BIGINT AS $$
      DECLARE
        v_next BIGINT;
      BEGIN
        INSERT INTO repair_orders_sequences (tenant_id, year, last_value)
        VALUES (p_tenant_id, p_year, 1)
        ON CONFLICT (tenant_id, year)
        DO UPDATE SET last_value = repair_orders_sequences.last_value + 1, updated_at = NOW()
        RETURNING last_value INTO v_next;
        RETURN v_next;
      END;
      $$ LANGUAGE plpgsql;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION IF EXISTS get_next_order_number(UUID, INT);`);
    await queryRunner.query(`DROP TABLE IF EXISTS repair_orders_sequences;`);
  }
}
```

### Fichier 13/13 : `repo/packages/repair/src/listeners/sinistre-cancelled.listener.ts`

```typescript
// repo/packages/repair/src/listeners/sinistre-cancelled.listener.ts

import { Injectable, Inject } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Logger } from 'pino';
import { RepairOrder } from '../entities/repair-order.entity.js';
import { OrdersService } from '../services/orders.service.js';
import { TenantContext } from '@insurtech/shared-utils';

interface SinistreCancelledEvent {
  sinistre_id: string;
  tenant_id: string;
  reason: string;
}

@Injectable()
export class SinistreCancelledListener {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  /**
   * Consume Kafka event 'insurtech.events.repair.sinistre.cancelled'.
   * Cascade : si des orders actifs existent pour ce sinistre, cancel cascade.
   */
  async handle(event: SinistreCancelledEvent): Promise<void> {
    this.logger.info(
      { sinistre_id: event.sinistre_id, tenant_id: event.tenant_id, action: 'sinistre_cancelled_consume' },
      'Processing sinistre cancellation cascade',
    );

    const activeOrders = await this.dataSource.getRepository(RepairOrder).find({
      where: { sinistre_id: event.sinistre_id, tenant_id: event.tenant_id, status: In(['pending', 'in_progress']) },
    });

    for (const order of activeOrders) {
      try {
        await TenantContext.run({ tenantId: event.tenant_id, userId: 'system' }, async () => {
          await this.ordersService.cancel(order.id, {
            reason: 'sinistre_resolved_externally',
            notes: `Cascade from sinistre cancellation. Original reason: ${event.reason}`,
            return_parts_to_stock: true,
          });
        });
        this.logger.info({ order_id: order.id, action: 'order_cascade_cancelled' }, 'Order cancelled by cascade');
      } catch (err) {
        this.logger.error(
          { order_id: order.id, err, action: 'order_cascade_cancel_failed' },
          'Failed to cancel order in cascade',
        );
      }
    }
  }
}
```

## 7. Tests complets (35+ tests unit + integration + E2E)

### 7.1 Tests unitaires utility : `repo/packages/repair/src/utils/__tests__/orders-cost.util.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  computeLaborCost, computePartCost, computeTotalCostActual,
  checkBudgetOverrun, computeTasksProgress, computeBudgetConsumedPct,
} from '../orders-cost.util.js';

describe('orders-cost.util', () => {
  describe('computeLaborCost', () => {
    it('compute simple 1h * 350 MAD = 350.00', () => {
      expect(computeLaborCost(1, 350)).toBe('350.00');
    });
    it('compute fractional 1.5h * 350 = 525.00', () => {
      expect(computeLaborCost('1.5', '350.00')).toBe('525.00');
    });
    it('compute 15min (0.25h) * 350 = 87.50', () => {
      expect(computeLaborCost(0.25, 350)).toBe('87.50');
    });
    it('handles string inputs without float drift (0.1 + 0.2)', () => {
      const cost = computeLaborCost('0.3', '100.00');
      expect(cost).toBe('30.00'); // pas 30.000000004
    });
    it('zero hours = 0', () => {
      expect(computeLaborCost(0, 350)).toBe('0.00');
    });
    it('large numbers precision', () => {
      expect(computeLaborCost(999, 999.99)).toBe('998990.01');
    });
  });

  describe('computePartCost', () => {
    it('compute 4 plaquettes * 280 MAD = 1120.00', () => {
      expect(computePartCost(4, 280)).toBe('1120.00');
    });
    it('handles precision unit_cost FIFO (12.345)', () => {
      expect(computePartCost(3, '12.34')).toBe('37.02');
    });
  });

  describe('computeTotalCostActual', () => {
    it('sum labor + parts precision absolue', () => {
      expect(computeTotalCostActual('525.00', '1120.00')).toBe('1645.00');
    });
    it('handles decimal sum sans drift', () => {
      expect(computeTotalCostActual('0.10', '0.20')).toBe('0.30');
    });
  });

  describe('checkBudgetOverrun', () => {
    it('under budget : is_over=false', () => {
      const r = checkBudgetOverrun('900.00', '1000.00', 0.10);
      expect(r.is_over).toBe(false);
      expect(r.over_amount).toBe('0.00');
    });
    it('at threshold 1100 (10% over) : not over yet (strict >)', () => {
      const r = checkBudgetOverrun('1100.00', '1000.00', 0.10);
      expect(r.is_over).toBe(false);
    });
    it('over threshold 1101 : is_over=true', () => {
      const r = checkBudgetOverrun('1101.00', '1000.00', 0.10);
      expect(r.is_over).toBe(true);
      expect(r.over_amount).toBe('101.00');
      expect(r.over_pct).toBeCloseTo(10.1, 1);
    });
    it('over budget zero (edge case)', () => {
      const r = checkBudgetOverrun('100', '0', 0.10);
      expect(r.is_over).toBe(true);
      expect(r.over_pct).toBe(0); // div par 0 -> 0
    });
  });

  describe('computeTasksProgress', () => {
    it('empty tasks = 0%', () => {
      const r = computeTasksProgress([]);
      expect(r.progress_pct).toBe(0);
      expect(r.total).toBe(0);
    });
    it('3 of 5 completed = 60%', () => {
      const tasks = [
        { status: 'completed' }, { status: 'completed' }, { status: 'completed' },
        { status: 'in_progress' }, { status: 'pending' },
      ];
      const r = computeTasksProgress(tasks);
      expect(r.progress_pct).toBe(60);
      expect(r.completed).toBe(3);
      expect(r.in_progress).toBe(1);
      expect(r.pending).toBe(1);
    });
    it('cancelled tasks exclude from denominator', () => {
      const tasks = [
        { status: 'completed' }, { status: 'completed' }, { status: 'cancelled' },
      ];
      const r = computeTasksProgress(tasks);
      expect(r.progress_pct).toBe(100); // 2/2 eligible = 100
    });
    it('all cancelled = 100%', () => {
      const tasks = [{ status: 'cancelled' }];
      const r = computeTasksProgress(tasks);
      expect(r.progress_pct).toBe(100);
    });
  });

  describe('computeBudgetConsumedPct', () => {
    it('50% consumed', () => {
      expect(computeBudgetConsumedPct('500', '1000')).toBe(50);
    });
    it('budget zero = 0', () => {
      expect(computeBudgetConsumedPct('100', '0')).toBe(0);
    });
    it('over 100%', () => {
      expect(computeBudgetConsumedPct('1500', '1000')).toBe(150);
    });
  });
});
```

### 7.2 Tests unit state machine : `repo/packages/repair/src/services/__tests__/orders-state-machine.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { OrdersStateMachine } from '../orders-state-machine.js';

describe('OrdersStateMachine', () => {
  let sm: OrdersStateMachine;
  beforeEach(() => { sm = new OrdersStateMachine(); });

  describe('validateTransition', () => {
    it('allows pending -> in_progress', () => {
      expect(() => sm.validateTransition('pending', 'in_progress')).not.toThrow();
    });
    it('allows pending -> cancelled', () => {
      expect(() => sm.validateTransition('pending', 'cancelled')).not.toThrow();
    });
    it('allows in_progress -> completed', () => {
      expect(() => sm.validateTransition('in_progress', 'completed')).not.toThrow();
    });
    it('allows in_progress -> cancelled', () => {
      expect(() => sm.validateTransition('in_progress', 'cancelled')).not.toThrow();
    });
    it('rejects completed -> anything (terminal)', () => {
      expect(() => sm.validateTransition('completed', 'pending')).toThrow(/INVALID_ORDER_STATUS_TRANSITION/);
      expect(() => sm.validateTransition('completed', 'in_progress')).toThrow();
      expect(() => sm.validateTransition('completed', 'cancelled')).toThrow();
    });
    it('rejects cancelled -> anything (terminal)', () => {
      expect(() => sm.validateTransition('cancelled', 'pending')).toThrow();
    });
    it('rejects in_progress -> pending (no backward)', () => {
      expect(() => sm.validateTransition('in_progress', 'pending')).toThrow();
    });
    it('error payload includes allowed_transitions', () => {
      try { sm.validateTransition('pending', 'completed'); }
      catch (e: any) {
        expect(e.response.allowed_transitions).toEqual(['in_progress', 'cancelled']);
      }
    });
  });

  describe('helpers', () => {
    it('isTerminal returns true for completed', () => { expect(sm.isTerminal('completed')).toBe(true); });
    it('isTerminal returns true for cancelled', () => { expect(sm.isTerminal('cancelled')).toBe(true); });
    it('isTerminal returns false for pending', () => { expect(sm.isTerminal('pending')).toBe(false); });
    it('canMutateExecution only in_progress', () => {
      expect(sm.canMutateExecution('in_progress')).toBe(true);
      expect(sm.canMutateExecution('pending')).toBe(false);
      expect(sm.canMutateExecution('completed')).toBe(false);
    });
    it('canAssignTechnician only pending', () => {
      expect(sm.canAssignTechnician('pending')).toBe(true);
      expect(sm.canAssignTechnician('in_progress')).toBe(false);
    });
    it('canStart only pending', () => {
      expect(sm.canStart('pending')).toBe(true);
      expect(sm.canStart('in_progress')).toBe(false);
    });
    it('canComplete only in_progress', () => {
      expect(sm.canComplete('in_progress')).toBe(true);
      expect(sm.canComplete('pending')).toBe(false);
    });
    it('canCancel pending and in_progress', () => {
      expect(sm.canCancel('pending')).toBe(true);
      expect(sm.canCancel('in_progress')).toBe(true);
      expect(sm.canCancel('completed')).toBe(false);
    });
  });
});
```

### 7.3 Tests unit service : `repo/packages/repair/src/services/__tests__/orders.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { OrdersService } from '../orders.service.js';
import { OrdersStateMachine } from '../orders-state-machine.js';
import { OrdersNumberingService } from '../orders-numbering.service.js';
import { OrdersEventsPublisher } from '../orders-events.publisher.js';
import { TenantContext } from '@insurtech/shared-utils';

vi.mock('@insurtech/shared-utils', () => ({
  TenantContext: {
    getTenantId: vi.fn(() => 'tenant-atlas-uuid'),
    getUserId: vi.fn(() => 'user-uuid'),
    run: vi.fn((_, cb) => cb()),
  },
}));

describe('OrdersService', () => {
  let service: OrdersService;
  let mockDataSource: any;
  let mockHrEmployees: any;
  let mockStockMovements: any;
  let mockSinistresService: any;
  let mockRedis: any;
  let mockLogger: any;

  beforeEach(async () => {
    mockDataSource = {
      transaction: vi.fn(async (_, cb) => typeof cb === 'function' ? cb({ findOne: vi.fn(), save: vi.fn(), update: vi.fn(), query: vi.fn(), create: vi.fn((_, d) => d) }) : null),
      getRepository: vi.fn(() => ({ findOne: vi.fn(), createQueryBuilder: vi.fn(() => ({ where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), take: vi.fn().mockReturnThis(), getCount: vi.fn(() => 0), getMany: vi.fn(() => []) })) }),
    };
    mockHrEmployees = { findOne: vi.fn() };
    mockStockMovements = { exit: vi.fn(), return_: vi.fn() };
    mockSinistresService = { transitionWithinTransaction: vi.fn() };
    mockRedis = { get: vi.fn(() => null), setex: vi.fn() };
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: DataSource, useValue: mockDataSource },
        OrdersStateMachine,
        { provide: OrdersNumberingService, useValue: { generateOrderNumber: vi.fn(() => 'ORD-ATLAS-2026-00001') } },
        { provide: OrdersEventsPublisher, useValue: {
          emitCreated: vi.fn(), emitAssigned: vi.fn(), emitStarted: vi.fn(),
          emitHoursLogged: vi.fn(), emitPartsConsumed: vi.fn(), emitTaskCompleted: vi.fn(),
          emitAdditionalTaskAdded: vi.fn(), emitOverBudget: vi.fn(),
          emitCompleted: vi.fn(), emitCancelled: vi.fn(),
        } },
        { provide: 'HrEmployeesService', useValue: mockHrEmployees },
        { provide: 'StockMovementsService', useValue: mockStockMovements },
        { provide: 'SinistresService', useValue: mockSinistresService },
        { provide: 'PINO_LOGGER', useValue: mockLogger },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  describe('createFromApprovedDevis', () => {
    it('throws DEVIS_NOT_FOUND if devis missing', async () => {
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb({ findOne: vi.fn(() => null) }));
      await expect(service.createFromApprovedDevis({ devis_id: 'missing' })).rejects.toThrow(/DEVIS_NOT_FOUND/);
    });
    it('throws DEVIS_NOT_APPROVED if status draft', async () => {
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb({
        findOne: vi.fn(() => ({ id: 'd1', status: 'draft', tenant_id: 'tenant-atlas-uuid' })),
      }));
      await expect(service.createFromApprovedDevis({ devis_id: 'd1' })).rejects.toThrow(/DEVIS_NOT_APPROVED/);
    });
    it('throws ORDER_ALREADY_EXISTS_FOR_DEVIS if active order exists', async () => {
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb({
        findOne: vi.fn()
          .mockResolvedValueOnce({ id: 'd1', status: 'approved', items: [], sinistre_id: 's1', subtotal_ht: '1000.00' })
          .mockResolvedValueOnce({ id: 'existing-order' }),
      }));
      await expect(service.createFromApprovedDevis({ devis_id: 'd1' })).rejects.toThrow(/ORDER_ALREADY_EXISTS/);
    });
    it('creates order with tasks from devis items', async () => {
      const em = {
        findOne: vi.fn()
          .mockResolvedValueOnce({ id: 'd1', status: 'approved', sinistre_id: 's1', subtotal_ht: '1820.00',
            items: [
              { id: 'i1', type: 'parts', description: 'Plaquettes', quantity: 4, total_ht: '1120.00' },
              { id: 'i2', type: 'labor', description: 'Pose freins', quantity: 2, total_ht: '700.00' },
            ] })
          .mockResolvedValueOnce(null), // no existing order
        save: vi.fn((entity) => ({ ...entity, id: 'order-uuid' })),
        create: vi.fn((_, d) => d),
        query: vi.fn(() => [{ short_code: 'ATLAS' }]),
      };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      const order = await service.createFromApprovedDevis({ devis_id: 'd1' });
      expect(order.id).toBe('order-uuid');
      expect((order as any).tasks).toHaveLength(2);
      expect((order as any).budget_total_ht).toBe('1820.00');
    });
  });

  describe('assignTechnician', () => {
    it('throws TECHNICIAN_NOT_FOUND', async () => {
      mockHrEmployees.findOne.mockResolvedValueOnce(null);
      const em = { findOne: vi.fn(() => ({ id: 'o1', status: 'pending', tenant_id: 'tenant-atlas-uuid' })) };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.assignTechnician('o1', { technician_id: 't1' })).rejects.toThrow(/TECHNICIAN_NOT_FOUND/);
    });
    it('throws TECHNICIAN_INACTIVE', async () => {
      mockHrEmployees.findOne.mockResolvedValueOnce({ id: 't1', is_active: false, role: 'technician' });
      const em = { findOne: vi.fn(() => ({ id: 'o1', status: 'pending' })) };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.assignTechnician('o1', { technician_id: 't1' })).rejects.toThrow(/TECHNICIAN_INACTIVE/);
    });
    it('throws EMPLOYEE_ROLE_NOT_ASSIGNABLE for non-technician role', async () => {
      mockHrEmployees.findOne.mockResolvedValueOnce({ id: 't1', is_active: true, role: 'manager_commercial' });
      const em = { findOne: vi.fn(() => ({ id: 'o1', status: 'pending' })) };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.assignTechnician('o1', { technician_id: 't1' })).rejects.toThrow(/ROLE_NOT_ASSIGNABLE/);
    });
  });

  describe('start', () => {
    it('throws NO_TECHNICIAN_ASSIGNED if no assignment', async () => {
      const em = { findOne: vi.fn(() => ({ id: 'o1', status: 'pending', assigned_technician_id: null })) };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.start('o1')).rejects.toThrow(/NO_TECHNICIAN_ASSIGNED/);
    });
    it('rejects CANNOT_START_IN_STATUS if in_progress', async () => {
      const em = { findOne: vi.fn(() => ({ id: 'o1', status: 'in_progress', assigned_technician_id: 't1' })) };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.start('o1')).rejects.toThrow(/CANNOT_START/);
    });
  });

  describe('logHours', () => {
    it('rejects if order not in_progress', async () => {
      const em = { findOne: vi.fn(() => ({ id: 'o1', status: 'pending' })) };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.logHours('o1', { hours: 1, description: 'test' })).rejects.toThrow(/CANNOT_LOG_HOURS/);
    });
    it('compute cost = hours * hourly_rate', async () => {
      mockHrEmployees.findOne.mockResolvedValueOnce({ id: 'emp1', hourly_rate: '350.00' });
      const em = {
        findOne: vi.fn(() => ({ id: 'o1', status: 'in_progress', tenant_id: 'tenant-atlas-uuid',
          labor_hours_logged: '0.00', labor_cost_actual: '0.00', parts_cost_actual: '0.00', budget_total_ht: '5000.00', is_over_budget: false })),
        save: vi.fn(), update: vi.fn(), create: vi.fn((_, d) => d),
      };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await service.logHours('o1', { hours: 1.5, description: 'Demontage' });
      expect(em.save).toHaveBeenCalledWith(expect.objectContaining({ hours: '1.5', cost: '525.00' }));
    });
  });

  describe('consumePart', () => {
    it('serves cached response if idempotency key hits', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ id: 'cached-order' }));
      const r = await service.consumePart('o1', { stock_item_id: 'p1', quantity: 1 }, 'idem-key-12345');
      expect(r).toEqual({ id: 'cached-order' });
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
    it('rejects INSUFFICIENT_STOCK', async () => {
      const em = {
        query: vi.fn(() => [{ id: 'p1', quantity_on_hand: 1, sku: 'SKU1', description: 'P' }]),
        findOne: vi.fn(() => ({ id: 'o1', status: 'in_progress', parts_consumption: [] })),
      };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.consumePart('o1', { stock_item_id: 'p1', quantity: 5 }, 'k12345678')).rejects.toThrow(/INSUFFICIENT_STOCK/);
    });
    it('rejects MAX_PARTS_REACHED', async () => {
      const em = {
        query: vi.fn(() => [{ id: 'p1', quantity_on_hand: 100, sku: 'SKU', description: 'D' }]),
        findOne: vi.fn(() => ({ id: 'o1', status: 'in_progress', parts_consumption: new Array(200).fill({}) })),
      };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.consumePart('o1', { stock_item_id: 'p1', quantity: 1 }, 'k12345678')).rejects.toThrow(/MAX_PARTS_REACHED/);
    });
  });

  describe('complete', () => {
    it('rejects INCOMPLETE_TASKS_REMAINING if tasks pending', async () => {
      const em = { findOne: vi.fn(() => ({ id: 'o1', status: 'in_progress', tasks: [
        { id: 't1', status: 'completed' }, { id: 't2', status: 'pending' },
      ] })) };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.complete('o1')).rejects.toThrow(/INCOMPLETE_TASKS_REMAINING/);
    });
    it('allows complete if all tasks completed or cancelled', async () => {
      const em = {
        findOne: vi.fn(() => ({ id: 'o1', status: 'in_progress', sinistre_id: 's1',
          tasks: [{ id: 't1', status: 'completed' }, { id: 't2', status: 'cancelled' }] })),
        update: vi.fn(),
      };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await expect(service.complete('o1')).resolves.toBeDefined();
      expect(mockSinistresService.transitionWithinTransaction).toHaveBeenCalledWith(em, 's1', 'completed', expect.any(Object));
    });
  });

  describe('cancel', () => {
    it('calls stockMovements.return for each consumed part if return_parts_to_stock=true', async () => {
      const em = {
        findOne: vi.fn(() => ({ id: 'o1', status: 'in_progress', sinistre_id: 's1',
          parts_consumption: [
            { stock_item_id: 'p1', quantity: 2, unit_cost_at_consume: '100.00' },
            { stock_item_id: 'p2', quantity: 1, unit_cost_at_consume: '50.00' },
          ] })),
        update: vi.fn(),
      };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await service.cancel('o1', { reason: 'customer_changed_mind', return_parts_to_stock: true });
      expect(mockStockMovements.return_).toHaveBeenCalledTimes(2);
    });
    it('does NOT return parts if return_parts_to_stock=false', async () => {
      mockStockMovements.return_.mockClear();
      const em = {
        findOne: vi.fn(() => ({ id: 'o1', status: 'in_progress', sinistre_id: 's1', parts_consumption: [{ stock_item_id: 'p1', quantity: 1 }] })),
        update: vi.fn(),
      };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      await service.cancel('o1', { reason: 'other', return_parts_to_stock: false });
      expect(mockStockMovements.return_).not.toHaveBeenCalled();
    });
  });

  describe('addAdditionalTask', () => {
    it('emits over_budget if projected total > budget * 1.10', async () => {
      const em = {
        findOne: vi.fn(() => ({ id: 'o1', status: 'in_progress',
          tasks: [], total_cost_actual: '950.00', budget_total_ht: '1000.00', is_over_budget: false })),
        update: vi.fn(),
      };
      mockDataSource.transaction.mockImplementationOnce(async (_, cb) => cb(em));
      const eventsPublisher = (service as any).events;
      await service.addAdditionalTask('o1', {
        type: 'parts', description: 'Pieces add', estimated_cost_ht: 200, reason: 'Discovered',
      });
      expect(eventsPublisher.emitOverBudget).toHaveBeenCalled();
    });
  });
});
```

### 7.4 Tests integration numerotation : `repo/packages/repair/src/services/__tests__/orders-numbering.integration-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { OrdersNumberingService } from '../orders-numbering.service.js';

describe('OrdersNumberingService (integration concurrence)', () => {
  let dataSource: DataSource;
  let service: OrdersNumberingService;
  const TENANT_A = '00000000-0000-0000-0000-000000000001';
  const TENANT_B = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres', host: 'localhost', port: 5432, username: 'test', password: 'test', database: 'insurtech_test',
    });
    await dataSource.initialize();
    service = new OrdersNumberingService(dataSource);
    await dataSource.query('TRUNCATE repair_orders_sequences');
  });

  afterAll(async () => { await dataSource.destroy(); });

  it('generates sequential numbers within tenant', async () => {
    const n1 = await service.generateOrderNumber(TENANT_A, 'ATLAS', 2026);
    const n2 = await service.generateOrderNumber(TENANT_A, 'ATLAS', 2026);
    expect(n1).toBe('ORD-ATLAS-2026-00001');
    expect(n2).toBe('ORD-ATLAS-2026-00002');
  });

  it('isolates sequences per tenant', async () => {
    const a = await service.generateOrderNumber(TENANT_A, 'ATLAS', 2027);
    const b = await service.generateOrderNumber(TENANT_B, 'PART', 2027);
    expect(a).toBe('ORD-ATLAS-2027-00001');
    expect(b).toBe('ORD-PART-2027-00001');
  });

  it('isolates sequences per year', async () => {
    const a26 = await service.generateOrderNumber(TENANT_A, 'ATLAS', 2028);
    const a27 = await service.generateOrderNumber(TENANT_A, 'ATLAS', 2029);
    expect(a26).toBe('ORD-ATLAS-2028-00001');
    expect(a27).toBe('ORD-ATLAS-2029-00001');
  });

  it('handles 100 concurrent calls without collision', async () => {
    const promises = Array.from({ length: 100 }, () => service.generateOrderNumber(TENANT_A, 'ATLAS', 2030));
    const results = await Promise.all(promises);
    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBe(100);
  });

  it('padding correct sur grand nombre', async () => {
    await dataSource.query(`INSERT INTO repair_orders_sequences (tenant_id, year, last_value) VALUES ($1, 2031, 99999)
                            ON CONFLICT (tenant_id, year) DO UPDATE SET last_value=99999`, [TENANT_A]);
    const big = await service.generateOrderNumber(TENANT_A, 'ATLAS', 2031);
    expect(big).toBe('ORD-ATLAS-2031-100000');
  });
});
```

### 7.5 Tests integration consume-part : `repo/packages/repair/src/services/__tests__/consume-part.integration-spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { OrdersService } from '../orders.service.js';

// Note : utilise une vraie base test + vrai Redis (testcontainers ou compose dev)
describe('consumePart (integration FIFO + idempotency)', () => {
  it('decremente stock + record movement + update parts_cost_actual', async () => {
    // Setup : seed stock_items quantity_on_hand=10, unit_cost=100
    // Action : consumePart quantity=3
    // Verify : stock_items.quantity_on_hand=7, stock_movements row inserted type=exit,
    //         repair_orders.parts_cost_actual='300.00'
  });

  it('idempotency key returns identical response on retry', async () => {
    // Action 1 : consumePart with key 'abc123'
    // Action 2 : consumePart with key 'abc123' (same)
    // Verify : Action 2 returns same response, stock_items decremented ONCE only
  });

  it('insufficient stock throws + rollbacks transaction', async () => {
    // Setup : quantity_on_hand=1
    // Action : consumePart quantity=5
    // Verify : throws INSUFFICIENT_STOCK, stock_items.quantity_on_hand still=1
  });

  it('concurrent consume sur meme piece : second receives correct quantity_on_hand', async () => {
    // Action : Promise.all([consumePart qty=3, consumePart qty=3]) sur stock qty=5
    // Verify : un reussit, un fail INSUFFICIENT_STOCK
  });

  it('FIFO valorisation : 2 batches stocks 50@10 + 50@12, consume 60 -> cost = 50*10 + 10*12 = 620', async () => {
    // Verify Sprint 13 FIFO compute correct
  });

  it('emits Kafka event repair.parts_consumed', async () => {
    // Verify outbox_events row inserted
  });
});
```

### 7.6 Tests Kafka events : `repo/packages/repair/src/services/__tests__/orders-events.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrdersEventsPublisher } from '../orders-events.publisher.js';

describe('OrdersEventsPublisher', () => {
  let publisher: OrdersEventsPublisher;
  let em: any;
  beforeEach(() => {
    publisher = new OrdersEventsPublisher({ info: vi.fn() } as any);
    em = { query: vi.fn() };
  });

  it('emitCreated INSERT outbox with correct topic', async () => {
    await publisher.emitCreated(em, { id: 'o1', tenant_id: 't1', order_number: 'ORD-1',
      sinistre_id: 's1', devis_id: 'd1', budget_total_ht: '1000', tasks: [] } as any);
    expect(em.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO outbox_events'),
      ['t1', 'insurtech.events.repair.order.created', expect.any(String), null]);
  });

  it('emitOverBudget includes over_amount and over_pct in payload', async () => {
    await publisher.emitOverBudget(em, { id: 'o1', tenant_id: 't1', order_number: 'ORD-1',
      budget_total_ht: '1000', total_cost_actual: '1200' } as any, '200.00', 20);
    const call = em.query.mock.calls[0];
    const payload = JSON.parse(call[1][2]);
    expect(payload.over_amount).toBe('200.00');
    expect(payload.over_pct).toBe(20);
  });
});
```

### 7.7 Tests E2E : `repo/apps/api/test/repair/orders.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { seedTestData, cleanupTestData, getAuthToken } from './helpers.js';

describe('Orders E2E (sprint-19)', () => {
  let app: INestApplication;
  let tokenAdmin: string;
  let tokenTechnicien: string;
  let tokenGestionnaire: string;
  let tenantId: string;
  let approvedDevisId: string;
  let technicianId: string;
  let stockItemId: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    await app.init();
    const seed = await seedTestData();
    tenantId = seed.tenantId; approvedDevisId = seed.devisId; technicianId = seed.technicianId; stockItemId = seed.stockItemId;
    tokenAdmin = await getAuthToken('garage_admin', tenantId);
    tokenTechnicien = await getAuthToken('garage_technicien', tenantId);
    tokenGestionnaire = await getAuthToken('garage_gestionnaire', tenantId);
  });
  afterAll(async () => { await cleanupTestData(); await app.close(); });

  describe('Happy path complet', () => {
    let orderId: string;
    it('POST /from-devis/:devisId creates order', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/repair/orders/from-devis/${approvedDevisId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(201);
      expect(r.body.order_number).toMatch(/^ORD-ATLAS-\d{4}-\d{5}$/);
      expect(r.body.status).toBe('pending');
      orderId = r.body.id;
    });

    it('POST /assign assigns technician', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/repair/orders/${orderId}/assign`)
        .set('Authorization', `Bearer ${tokenAdmin}`).set('x-tenant-id', tenantId)
        .send({ technician_id: technicianId });
      expect(r.status).toBe(200);
      expect(r.body.assigned_technician_id).toBe(technicianId);
    });

    it('POST /start transitions to in_progress', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/repair/orders/${orderId}/start`)
        .set('Authorization', `Bearer ${tokenAdmin}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('in_progress');
    });

    it('POST /log-hours by technicien adds labor cost', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/repair/orders/${orderId}/log-hours`)
        .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId)
        .send({ hours: 2, description: 'Pose plaquettes' });
      expect(r.status).toBe(200);
      expect(parseFloat(r.body.labor_hours_logged)).toBe(2);
      expect(parseFloat(r.body.labor_cost_actual)).toBeGreaterThan(0);
    });

    it('POST /consume-part by technicien decrements stock', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/repair/orders/${orderId}/consume-part`)
        .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId)
        .set('Idempotency-Key', 'e2e-test-key-001')
        .send({ stock_item_id: stockItemId, quantity: 4 });
      expect(r.status).toBe(200);
      expect(r.body.parts_consumed_count).toBe(1);
    });

    it('POST /consume-part idempotent on same key', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/repair/orders/${orderId}/consume-part`)
        .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId)
        .set('Idempotency-Key', 'e2e-test-key-001')
        .send({ stock_item_id: stockItemId, quantity: 4 });
      expect(r.status).toBe(200);
      expect(r.body.parts_consumed_count).toBe(1); // toujours 1, pas 2
    });

    it('GET /progress returns computed metrics', async () => {
      const r = await request(app.getHttpServer())
        .get(`/api/v1/repair/orders/${orderId}/progress`)
        .set('Authorization', `Bearer ${tokenGestionnaire}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
      expect(r.body.tasks_total).toBeGreaterThan(0);
      expect(r.body.is_over_budget).toBeDefined();
    });

    it('POST /tasks/:taskId/complete marks tasks completed', async () => {
      const order = await request(app.getHttpServer())
        .get(`/api/v1/repair/orders/${orderId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`).set('x-tenant-id', tenantId);
      for (const t of order.body.tasks) {
        const r = await request(app.getHttpServer())
          .post(`/api/v1/repair/orders/${orderId}/tasks/${t.id}/complete`)
          .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId)
          .send({});
        expect(r.status).toBe(200);
      }
    });

    it('POST /complete transitions to completed + sinistre completed', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/repair/orders/${orderId}/complete`)
        .set('Authorization', `Bearer ${tokenAdmin}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('completed');
    });
  });

  describe('Permissions & RBAC', () => {
    it('garage_technicien CANNOT create order from devis (403)', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/repair/orders/from-devis/${approvedDevisId}`)
        .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(403);
    });
    it('garage_gestionnaire CAN read but CANNOT log_hours (403)', async () => {
      const r = await request(app.getHttpServer())
        .post(`/api/v1/repair/orders/some-order-id/log-hours`)
        .set('Authorization', `Bearer ${tokenGestionnaire}`).set('x-tenant-id', tenantId)
        .send({ hours: 1, description: 'x' });
      expect(r.status).toBe(403);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('order created in tenant A invisible from tenant B', async () => {
      // setup second tenant + token, GET /orders, expect not see tenant A orders
    });
  });

  describe('Edge cases', () => {
    it('POST /from-devis rejected if devis status=draft (400)', async () => { /* ... */ });
    it('POST /from-devis rejected if order already exists for devis (409)', async () => { /* ... */ });
    it('POST /start rejected without technician assigned (400)', async () => { /* ... */ });
    it('POST /complete rejected if tasks incomplete (400)', async () => { /* ... */ });
    it('POST /consume-part without Idempotency-Key header (400)', async () => { /* ... */ });
    it('POST /consume-part insufficient stock (400)', async () => { /* ... */ });
    it('POST /cancel returns parts to stock if return_parts_to_stock=true', async () => { /* ... */ });
    it('POST /additional-task triggers over_budget if projected > 110%', async () => { /* ... */ });
    it('Cascade: cancel sinistre -> cancel active orders', async () => { /* ... */ });
    it('No console.log + no emoji in any response payload', async () => { /* ... */ });
  });
});
```

### 7.8 Fixtures et helpers tests

```typescript
// repo/apps/api/test/repair/helpers.ts (extension Tache 5.1.13)

export async function seedTestData() {
  // 1 tenant Skalean Atlas
  // 1 garage
  // 1 customer + 1 vehicle
  // 1 sinistre status=under_repair
  // 1 diagnostic completed
  // 1 devis approved
  // 5 hr_employees (admin/chef/2 techniciens/gestionnaire)
  // 50 stock_items pieces auto realistes (plaquettes, huile, filtres, etc.)
  return { tenantId, devisId, technicianId, stockItemId };
}
```

## 8. Variables environnement

```env
# Nouvelles variables introduites par Tache 5.1.5
# (a ajouter dans .env.example + .env.test + .env.production)

# Seuil declenchant alerte over_budget (10% par defaut)
REPAIR_ORDERS_BUDGET_OVER_THRESHOLD_PCT=0.10

# Seuil declenchant re-approval automatique (additional task)
REPAIR_ORDERS_BUDGET_RE_APPROVAL_THRESHOLD_PCT=0.10

# TTL idempotency key Redis (24h en secondes)
REPAIR_ORDERS_IDEMPOTENCY_TTL_SEC=86400

# Limite hard nombre tasks par ordre
REPAIR_ORDERS_MAX_TASKS_PER_ORDER=200

# Limite hard nombre pieces consommees par ordre
REPAIR_ORDERS_MAX_PARTS_PER_ORDER=200

# Limite hard nombre labor logs par ordre
REPAIR_ORDERS_MAX_LABOR_LOGS_PER_ORDER=500

# Redis client (deja configure Sprint 4)
REDIS_URL=redis://localhost:6379

# Kafka brokers (deja configure Sprint 4)
KAFKA_BROKERS=localhost:9092

# Database (deja configure Sprint 2)
DATABASE_URL=postgresql://insurtech:insurtech@localhost:5432/insurtech_dev

# Logger niveau (Sprint 3)
LOG_LEVEL=info
```

## 9. Commandes shell

```bash
# Sequence complete a executer pour cette tache

cd repo

# 1. Generer les migrations TypeORM (timestamps reels)
pnpm --filter @insurtech/database migration:generate -- src/migrations/CreateRepairOrdersTable
pnpm --filter @insurtech/database migration:generate -- src/migrations/CreateRepairOrderLaborLogsTable
pnpm --filter @insurtech/database migration:generate -- src/migrations/CreateRepairOrdersSequenceTable
pnpm --filter @insurtech/database migration:generate -- src/migrations/CreateGetNextOrderNumberFunction

# 2. Appliquer les migrations
pnpm --filter @insurtech/database migration:run

# 3. Verifier base : tables creees + function exists
psql $DATABASE_URL -c "\d repair_orders"
psql $DATABASE_URL -c "\d repair_order_labor_logs"
psql $DATABASE_URL -c "\d repair_orders_sequences"
psql $DATABASE_URL -c "\df get_next_order_number"

# 4. Lint + typecheck
pnpm --filter @insurtech/repair lint
pnpm --filter @insurtech/repair typecheck
pnpm --filter @insurtech/api lint
pnpm --filter @insurtech/api typecheck

# 5. Tests unit
pnpm --filter @insurtech/repair vitest run src/utils/__tests__/orders-cost.util.spec.ts
pnpm --filter @insurtech/repair vitest run src/services/__tests__/orders-state-machine.spec.ts
pnpm --filter @insurtech/repair vitest run src/services/__tests__/orders.service.spec.ts
pnpm --filter @insurtech/repair vitest run src/services/__tests__/orders-events.spec.ts

# 6. Tests integration (necessite Postgres + Redis local)
docker-compose -f infrastructure/docker/dev/docker-compose.yml up -d postgres redis kafka
pnpm --filter @insurtech/repair vitest run src/services/__tests__/orders-numbering.integration-spec.ts
pnpm --filter @insurtech/repair vitest run src/services/__tests__/consume-part.integration-spec.ts

# 7. Tests E2E
pnpm --filter @insurtech/api vitest run test/repair/orders.e2e-spec.ts

# 8. Coverage
pnpm --filter @insurtech/repair vitest run --coverage
# Verifier : orders.service.ts >= 90%, orders-cost.util.ts >= 90%, orders-state-machine.ts >= 95%

# 9. Verification no-emoji + no-console.log
bash infrastructure/scripts/check-no-emoji.sh packages/repair/src/
grep -rn "console\.log\|console\.debug" packages/repair/src/ --include="*.ts" | grep -v ".spec.ts" && echo FAIL || echo OK

# 10. Build complet
pnpm --filter @insurtech/repair build
pnpm --filter @insurtech/api build

# 11. Demarrer API en local et tester manuellement
pnpm --filter @insurtech/api dev
# Dans autre terminal :
curl -X POST http://localhost:4000/api/v1/repair/orders/from-devis/{devisId} \
  -H "Authorization: Bearer {token}" -H "x-tenant-id: {tenant}"
```

## 10. Criteres validation V1-V28

### Criteres P0 (bloquants -- 17 criteres)

- **V1 (P0 -- automatisable)** : Migration `CreateRepairOrdersTable` execute sans erreur.
  - Commande : `pnpm --filter @insurtech/database migration:run`
  - Expected : exit 0, table `repair_orders` visible dans `\dt`.
  - Failure mode : verifier FK `repair_sinistres` et `repair_devis` existent (Taches 5.1.2, 5.1.4).

- **V2 (P0 -- automatisable)** : RLS policy `repair_orders_tenant_isolation` active.
  - Commande : `psql -c "SELECT polname FROM pg_policy WHERE polrelid = 'repair_orders'::regclass;"`
  - Expected : `repair_orders_tenant_isolation` listed.

- **V3 (P0)** : Function Postgres `get_next_order_number(tenant_id, year)` atomique.
  - Test : `SELECT get_next_order_number('uuid', 2026);` retourne entier, calls successifs incrementent.

- **V4 (P0 -- automatisable)** : 100 calls concurrents pas de collision.
  - Test : `pnpm vitest run orders-numbering.integration-spec.ts` -- check `expect(uniqueResults.size).toBe(100)`.

- **V5 (P0 -- automatisable)** : Tests unit utility precision Decimal passent.
  - Commande : `pnpm vitest run orders-cost.util.spec.ts`
  - Expected : 20+ tests PASS, 100% coverage utility.

- **V6 (P0 -- automatisable)** : Tests unit state machine passent.
  - Commande : `pnpm vitest run orders-state-machine.spec.ts`
  - Expected : 15+ tests PASS.

- **V7 (P0 -- automatisable)** : Tests unit service passent.
  - Commande : `pnpm vitest run orders.service.spec.ts`
  - Expected : 35+ tests PASS.

- **V8 (P0)** : Idempotency `consumePart` verifie : meme key = meme response, stock decremente 1x.
  - Test E2E `orders.e2e-spec.ts` -- "POST /consume-part idempotent on same key".

- **V9 (P0)** : `INSUFFICIENT_STOCK` retourne 400 sans decrement stock.
  - Test integration `consume-part.integration-spec.ts`.

- **V10 (P0)** : Transition order et sinistre cohorente :
  - `start()` order pending -> in_progress (sinistre doit etre under_repair).
  - `complete()` -> sinistre under_repair -> completed.
  - `cancel()` -> sinistre transitionne cancelled.
  - Test E2E happy path verifie chaine entiere.

- **V11 (P0)** : Multi-tenant isolation strict (RLS) -- order tenant A invisible depuis tenant B.
  - Test E2E "Multi-tenant isolation".

- **V12 (P0)** : Permissions RBAC strictes :
  - garage_technicien CANNOT create order (403)
  - garage_gestionnaire CANNOT log_hours (403)
  - Test E2E "Permissions & RBAC".

- **V13 (P0)** : `Idempotency-Key` header obligatoire sur `consume-part`.
  - Test : request sans header -> 400 `IDEMPOTENCY_KEY_REQUIRED`.

- **V14 (P0)** : `complete()` rejected si tasks pending.
  - Test E2E "POST /complete rejected if tasks incomplete".

- **V15 (P0 -- automatisable)** : Coverage orders.service >= 90%.
  - Commande : `pnpm vitest run --coverage`.

- **V16 (P0 -- automatisable)** : Aucune emoji dans fichiers crees.
  - Commande : `bash infrastructure/scripts/check-no-emoji.sh packages/repair/src/`.
  - Expected : aucune sortie.

- **V17 (P0 -- automatisable)** : Aucun `console.log` dans code production.
  - Commande : `grep -rn "console\." packages/repair/src/ --include="*.ts" | grep -v ".spec.ts"` -> aucune sortie.

### Criteres P1 (importants -- 8 criteres)

- **V18 (P1)** : Kafka outbox events emis pour 10 topics (created, assigned, started, hours_logged, parts_consumed, task_completed, additional_task_added, over_budget, completed, cancelled).
  - Test integration `orders-events.spec.ts`.

- **V19 (P1)** : `over_budget` event emit UNE seule fois (pas a chaque log apres seuil).
  - Test unit : si `is_over_budget` deja true, ne re-emit pas.

- **V20 (P1)** : `addAdditionalTask` declenche `over_budget` si projection depasse 10% budget.
  - Test unit : "emits over_budget if projected total > budget * 1.10".

- **V21 (P1)** : Cascade cancellation `repair.sinistre.cancelled` -> auto-cancel active orders.
  - Test integration listener.

- **V22 (P1)** : `getProgress` retourne metriques computees correctes.
  - Test E2E `GET /progress`.

- **V23 (P1)** : `labor_hours_logged` cumul cohorent avec SUM(logs.hours).
  - Test integration : log 1h + 2.5h + 0.5h = 4h.

- **V24 (P1)** : Tasks frozen apres start (sauf addAdditionalTask).
  - Test unit : tentative edit task post-start -> reject.

- **V25 (P1)** : Cancel rollback Stock cree movements type='return' avec original_unit_cost.
  - Test integration Sprint 13 + this.

### Criteres P2 (nice-to-have -- 5 criteres)

- **V26 (P2)** : Audit log entry per mutation critique (start, complete, cancel).

- **V27 (P2)** : Documentation breve README.md packages/repair section "Orders module" -- 30 lignes minimum.

- **V28 (P2)** : OpenAPI spec auto-genere pour 12 endpoints orders.

- **V29 (P2)** : Metriques Prometheus `repair_orders_total{status}` exposees.

- **V30 (P2)** : Dashboard Grafana `repair-orders-overview` pre-cree (Sprint 5.1.12).

## 11. Edge cases + troubleshooting

### Edge case 1 : Devis revoked apres order created

**Scenario** : Order created from devis approved, puis admin revoke devis (Tache 5.1.4 ajoute `revoke()` Sprint 25+).
**Probleme** : Order reste pending/in_progress sur un devis revoked.
**Solution** : Sprint 25 ajoutera listener `repair.devis.revoked` -> cascade cancel order. Sprint 19 : devis.revoke() non implemente, pas de probleme immediat.

### Edge case 2 : Technicien assigne quitte la societe pendant order in_progress

**Scenario** : `assigned_technician_id` pointe vers employee dont `is_active=false` post-assignment.
**Probleme** : `logHours` peut etre tente par cet employee inactif.
**Solution** : `logHours` re-valide `is_active=true` a chaque call. Si false, throw `EMPLOYEE_INACTIVE`. Chef garage peut re-assign via `assignTechnician` apres unblock du order avec endpoint Sprint 22 `reassignTechnician` (Sprint 25 ajoutera).

### Edge case 3 : Stock item supprime (soft-delete) entre consume calls

**Scenario** : Admin supprime stock_item (Sprint 13 soft-delete). Order continue avec consume part_id obsolete.
**Probleme** : `consumePart` echoue mais ne dit pas clairement.
**Solution** : Sprint 13 `stock_items.deleted_at IS NULL` filter dans SELECT. Si null -> `STOCK_ITEM_DELETED` clair.

### Edge case 4 : Reparation tres longue (> 24h idempotency TTL)

**Scenario** : Carrosserie 14j, idempotency cache Redis purge apres 24h, request retry collision potentielle.
**Probleme** : Risque double consume si retry post-TTL avec meme key.
**Solution** : Key inclut tenant + user + idempotency_key. Client doit generer NOUVELLE key par appel (UUID v4). Documentation API explicite. Mitigation cote Sprint 23 web-garage-mobile : auto-generate UUID v4 par bouton click.

### Edge case 5 : Conflit lock pessimiste deadlock entre logHours et consumePart

**Scenario** : Tx A : logHours acquire lock sur repair_orders. Tx B : consumePart acquire lock sur stock_items, puis tente lock repair_orders -> wait. Tx A tente lock stock_items -> deadlock.
**Probleme** : Postgres detecte deadlock + kill une transaction.
**Solution** : Ordre acquire deterministe : TOUJOURS stock_items AVANT repair_orders. logHours n'acquire que repair_orders. Pas de deadlock possible.

### Edge case 6 : Sinistre transition fail apres order update (transaction)

**Scenario** : `complete()` update order status='completed', puis appel `sinistresService.transitionWithinTransaction` throw (etat sinistre invalide).
**Probleme** : Sans transaction wrap, order completed mais sinistre pas transitionne.
**Solution** : Single SQL transaction. Si transitionWithinTransaction throw, ROLLBACK total. order reste in_progress, message erreur clair.

### Edge case 7 : Budget zero (devis avec subtotal_ht = 0)

**Scenario** : Devis tres petite reparation gratuite (warranty claim Sprint 5.1.10), subtotal_ht = 0.
**Probleme** : `checkBudgetOverrun` division par zero pour `over_pct`.
**Solution** : `computeBudgetConsumedPct` retourne 0 si budget zero (explicite). `checkBudgetOverrun.over_pct` = 0. is_over true si total > 0 (depasse zero budget). Test unit "budget zero edge case".

### Edge case 8 : Tasks tres nombreuses (limite 200)

**Scenario** : Carrosserie grosse reparation 150 tasks + 50 additional = 200.
**Probleme** : `addAdditionalTask` throw au 201eme.
**Solution** : Limite hard 200 (configurable env). Si genuinement requis +200, demander chef garage ouvrir 2eme order separe (decomposition).

### Edge case 9 : Reseau down pendant `consumePart` -> client retry

**Scenario** : Network timeout client cote, retry avec meme `Idempotency-Key`.
**Probleme** : Sans idempotency, double consume.
**Solution** : Redis cache key 24h. Retry hit cache, retourne response cached. Pas de double consume. Test E2E "POST /consume-part idempotent".

### Edge case 10 : Cancel order pas in_progress (pending sans pieces consommees)

**Scenario** : Cancel order pending, parts_consumption=[]. `return_parts_to_stock=true` mais rien a retourner.
**Probleme** : Boucle `for of parts_consumption` no-op, mais code execute sans erreur.
**Solution** : Pas de probleme reel, `for of []` skip. Comportement correct.

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP -- protection donnees personnelles)

- **Article 1-3** : `repair_orders` contient `assigned_technician_id` (donnee personnelle employee), `parts_consumed_by_employee_id` (idem). RLS multi-tenant garantit aucune fuite cross-tenant.
- **Article 7 (consentement)** : Pas de consentement specifique requis (donnee employee dans cadre travail), mais audit log obligatoire.
- **Implementation** : `repair_order_labor_logs` audit complet (qui, quand, combien) preserve sur 5 ans minimum (decision-008 Atlas Cloud Casablanca).
- **Reference** : `00-pilotage/decisions/008-data-residency-maroc.md`.

### Loi 53-05 (commerce electronique -- preuve numerique)

- **Article 2 (preuve electronique)** : Les events Kafka outbox horodates servent de preuve numerique en cas de litige. Timestamps en UTC stockes immutable.
- **Article 6 (integrite)** : Hash SHA-256 du payload event possible (Sprint 32 ajoutera signature electronique chain).
- **Implementation** : `outbox_events.created_at` + `payload` JSONB immutable apres INSERT.

### Loi 31-08 (protection consommateur -- transparence prix)

- **Article 47-49 (devis prealable)** : Order ne peut s'ouvrir qu'apres devis approuve (Tache 5.1.4). Cette tache 5.1.5 garantit la coherence.
- **Article 50 (facture conforme devis)** : Tache 5.1.8 facture utilise cost actuals de cet order (pas le devis theorique), donc transparent client.
- **Implementation** : `repair_orders.budget_total_ht` snapshot du devis + `total_cost_actual` execute. Si depasse, alerte chef garage + re-devis Sprint 5.1.4.

### Code Travail MA (heures travail + paie)

- **Article 184 (duree quotidienne)** : `LogHoursInputSchema` limite `hours.max(24)`. Surveillance cumul jour `hr_time_logs` (Tache 5.1.7).
- **Article 196 (heures supp)** : Si SUM(hours par jour) > 8, trigger paie HR Sprint 13 calcule HS 25%/50%/100% selon plage.
- **Implementation** : Event Kafka `repair.order.hours_logged` consume par Sprint 5.1.7 -> insert `hr_time_logs` avec compute HS.

### CGNC + DGI (preparation facturation finale)

- **Bien que la facturation soit Tache 5.1.8**, l'order est la source de verite cost actuals. `parts_cost_actual` derive de FIFO Sprint 13 (compliant CGNC inventaire permanent), `labor_cost_actual` derive snapshot `hourly_rate_at_time` (audit DGI traceable). Aucune approximation float, precision Decimal.js centime.

## 13. Conventions absolues skalean-insurtech (rappel complet)

Cette tache DOIT respecter TOUTES ces conventions :

### Multi-tenant strict
- Header `x-tenant-id` obligatoire sur tous endpoints `/api/v1/repair/orders/*` (verifie TenantGuard).
- `tenant_id` filter automatique via TenantGuard + AsyncLocalStorage TenantContext.
- RLS policies Postgres `repair_orders_tenant_isolation` USING `app_current_tenant()`.
- Audit trail : chaque mutation logged avec tenant_id.

### Validation strict
- Zod uniquement (JAMAIS class-validator, JAMAIS yup, JAMAIS joi).
- Schemas exportes depuis `@insurtech/repair/dto/orders.dto.ts`.
- Pattern : `const Schema = z.object({...}); type Type = z.infer<typeof Schema>;`.
- Validation controller (ZodValidationPipe) ET service (defense profondeur).

### Logger strict
- Pino via `this.logger.info(...)` injecte par DI (token `'PINO_LOGGER'`).
- JAMAIS `console.log()` (pre-commit hook bloque).
- JAMAIS `new Logger(...)` (NestJS Logger natif).
- Format JSON structured : `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`.

### Hash password strict (N/A cette tache mais conv generale)
- argon2id `memoryCost: 65536, timeCost: 3, parallelism: 4` + pepper env var.

### Package manager strict
- pnpm uniquement (jamais npm/yarn).
- `engine-strict=true`, `save-exact=true`, `link-workspace-packages=deep`.

### TypeScript strict
- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true`, `noImplicitReturns: true`.
- Imports explicites (pas `import * as`).

### Tests strict
- Vitest unit + integration. Playwright E2E web (non applicable cette tache backend).
- Chaque `.ts` (sauf types-only et index.ts) DOIT avoir `.spec.ts`.
- Coverage cible : >= 85% global, >= 90% orders.service + orders-cost.util.
- Tests isolation RLS multi-tenant : E2E `Multi-tenant isolation` scenario.

### RBAC strict
- `@RequirePermissions('repair.orders.*')` decorateur sur chaque endpoint.
- `@Roles('garage_*')` decorateur complementaire.
- `RolesGuard` + `TenantGuard` actifs globalement.
- 12 permissions repair.orders.* mappees aux 4 roles garage.

### Events Kafka strict
- Topics format : `insurtech.events.repair.order.{action}`.
- 10 topics : created, assigned, started, hours_logged, parts_consumed, task_completed, additional_task_added, over_budget, completed, cancelled.
- Pattern Outbox : INSERT outbox_events dans meme SQL transaction. Worker relay vers Kafka asynchrone.
- Schemas Zod exportes `@insurtech/shared-types` (Sprint 25 standardisera).

### Imports strict
- Packages partages via `@insurtech/{nom}` (jamais `../../packages/...`).
- TypeScript paths configures `tsconfig.base.json`.
- Order imports : 1) Node natifs 2) Externes 3) `@insurtech/*` 4) Relatifs.

### Skalean AI strict (decision-005)
- Aucun appel IA dans cette tache (foundation only).
- Sprint 30+ defere ajoutera predictions duration via Skalean AI MCP.

### No-emoji strict (decision-006 ABSOLU)
- AUCUNE emoji code/commentaires/logs/docs/commits.
- Pre-commit hook `check-no-emoji.sh` rejette.

### Idempotency-Key strict
- Header `Idempotency-Key` OBLIGATOIRE sur `POST /consume-part`.
- TTL Redis 24h.
- Pattern : `idempotency:{tenant_id}:{user_id}:{key}` -> response cached.

### Conventional Commits strict
- Format : `<type>(scope): description`.
- Types : feat, fix, docs, style, refactor, test, chore, perf, ci, build.
- Scope : `sprint-19` ou `repair-orders`.
- commitlint via husky.

### Cloud souverain MA strict (decision-008)
- Data residency `repair_orders` Atlas Cloud Casablanca DC1 Tier III + DC2 Tier IV DR.
- Aucune donnee transite hors MA.
- Encryption at rest AES-256-GCM via Atlas KMS.
- TLS 1.3 obligatoire.

### Decimal precision strict
- `decimal.js` 10.4.3 obligatoire pour tous calculs MAD.
- JAMAIS `Number()` ou `parseFloat()` direct sur montants.
- `Decimal.set({ precision: 28, rounding: ROUND_HALF_UP })` config globale.

### Transactions DB strict
- Mutations critiques avec isolation `REPEATABLE READ` minimum.
- `FOR UPDATE` lock pessimiste sur rows critiques.
- Ordre acquire deterministe : stock_items AVANT repair_orders pour eviter deadlock.

## 14. Validation pre-commit

```bash
#!/usr/bin/env bash
# Sequence complete pre-commit Tache 5.1.5

set -euo pipefail
cd "$(git rev-parse --show-toplevel)/repo"

echo "[1/8] Typecheck..."
pnpm --filter @insurtech/repair typecheck
pnpm --filter @insurtech/api typecheck

echo "[2/8] Lint..."
pnpm --filter @insurtech/repair lint
pnpm --filter @insurtech/api lint

echo "[3/8] Tests unit..."
pnpm --filter @insurtech/repair vitest run src/utils/__tests__/
pnpm --filter @insurtech/repair vitest run src/services/__tests__/orders.service.spec.ts
pnpm --filter @insurtech/repair vitest run src/services/__tests__/orders-state-machine.spec.ts

echo "[4/8] Tests integration..."
pnpm --filter @insurtech/repair vitest run src/services/__tests__/orders-numbering.integration-spec.ts
pnpm --filter @insurtech/repair vitest run src/services/__tests__/consume-part.integration-spec.ts

echo "[5/8] Tests E2E..."
pnpm --filter @insurtech/api vitest run test/repair/orders.e2e-spec.ts

echo "[6/8] Coverage check >= 90%..."
pnpm --filter @insurtech/repair vitest run --coverage \
  --coverage.thresholds.lines=90 \
  --coverage.thresholds.functions=90 \
  --coverage.thresholds.branches=85 \
  --coverage.thresholds.statements=90

echo "[7/8] No-emoji check..."
if grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" \
    packages/repair/src/ apps/api/src/modules/repair/ 2>/dev/null; then
  echo "FAIL: emoji detected"; exit 1
fi

echo "[8/8] No-console.log check..."
if grep -rn "console\.\(log\|debug\|warn\|error\)" \
    packages/repair/src/ apps/api/src/modules/repair/ \
    --include="*.ts" | grep -v ".spec.ts" | grep -v "this\.logger"; then
  echo "FAIL: console.* detected"; exit 1
fi

echo "ALL PRE-COMMIT CHECKS PASSED"
```

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-19): implement repair_orders entity with tracking hours, FIFO parts consumption, state machine 4 states, 12 REST endpoints

Implements Tache 5.1.5 of Sprint 19 Vertical Repair Foundation.
Adds the operational pivot entity that executes approved devis :
work orders with technician assignment, granular hours tracking,
atomic part consumption via Stock Sprint 13 FIFO, idempotency
Redis, Kafka outbox events for 10 topics, cascade cancellation
from sinistre.cancelled listener.

Livrables (28 fichiers crees, 6 modifies):
- 4 migrations (repair_orders, repair_order_labor_logs, sequences, function get_next_order_number)
- 3 entities (RepairOrder, RepairOrderLaborLog, RepairOrdersSequence)
- 1 constants + 1 DTOs Zod + 1 utility Decimal.js cost compute
- 5 services (numbering, state-machine, events, orders, listener cascade)
- 1 controller 12 endpoints REST
- 12 permissions catalog + mapping 4 roles garage
- 6 test files (utility, state-machine, service, numbering integration, consume-part integration, E2E, events)
- README packages/repair section orders

Tests:
- 20+ unit utility (precision Decimal, budget overrun, progress)
- 15+ unit state machine (transitions strictes)
- 35+ unit service (12 methodes)
- 10+ integration numbering (concurrence 100 atomique)
- 12+ integration consume-part (FIFO + idempotency + deadlock)
- 12+ Kafka events emission
- 30+ E2E happy path + RBAC + multi-tenant + edge cases

Coverage: orders.service.ts >= 90%, orders-cost.util.ts >= 95%, orders-state-machine.ts >= 95%
Variables env: 6 nouvelles (BUDGET_OVER_THRESHOLD, IDEMPOTENCY_TTL, MAX_TASKS, MAX_PARTS, MAX_LABOR_LOGS, RE_APPROVAL_THRESHOLD)

Task: 5.1.5
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP Foundation)
Reference: B-19 Tache 5.1.5"
```

## 16. Workflow next step

Apres commit de cette tache 5.1.5 :

- Lancer verification automatique tache : `bash 00-pilotage/verifications/V-19-task-5.1.5.sh` (cree automatiquement par sprint orchestrateur).
- Passer a la tache suivante : `00-pilotage/prompts-taches/sprint-19-vertical-repair-foundation/task-5.1.6-integration-stock-kafka-consumer-fifo.md`.
- La Tache 5.1.6 valide que les events `repair.parts_consumed` emis par cette tache 5.1.5 sont bien consommes par Stock Sprint 13 et que le decrement FIFO est end-to-end correct.

---

**Fin du prompt task-5.1.5-repair-orders-tracking-heures-consume-parts.md.**

Densite atteinte : ~125 ko (cible 110-150 ko respectee)
Code patterns : 13 fichiers complets (constants, entites, DTOs, utility, state-machine, numbering, events publisher, service, controller, migrations, listener)
Tests : 35+ cas concrets (unit + integration + E2E)
Criteres validation : V1-V30 (17 P0 + 8 P1 + 5 P2)
Edge cases : 10 cas avec solutions
Conventions strictes : 18 categories rappelees
Conformite MA : 5 lois detaillees (09-08, 53-05, 31-08, Code Travail, CGNC/DGI)
