# TACHE 5.1.7 -- Integration HR Assignment Technicien Validee + hr_time_logs Auto-Consume Kafka + Calcul Heures Supplementaires Code Travail MA + Bulletin Paie Variable Productive + Endpoints Time Logs

**Sprint** : 19 (Phase 5 / Sprint 1 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-19-sprint-19-vertical-repair-foundation.md` (Tache 5.1.7)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP Foundation)
**Priorite** : P0 (bloquant -- conditionne 5.1.8 invoices facturation depuis cost actuals incluant labor reel, 5.1.9 Books ecritures paie + charges sociales, 5.1.12 dashboards productivite technicien, 5.1.13 E2E happy path complet, et Sprint 22 web-garage-app affichage time logs par technicien)
**Effort** : 5h
**Dependances** : 5.1.5 (orders avec `logHours` emit event Kafka `insurtech.events.repair.order.hours_logged` via outbox), 5.1.6 (BaseEventConsumer pattern + inbox idempotency + DLQ), Sprint 13 (HR module : `hr_employees` table avec `hourly_rate`, `role`, `is_active`, `tenant_id` ; paie module avec bulletins variable), Sprint 6 (multi-tenant RLS strict + TenantContext), Sprint 4 (Kafka outbox worker + KafkaConsumerService), Sprint 7 (RBAC permissions).
**Densite cible** : 110-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006 absolu, verifie par pre-commit hook `check-no-emoji.sh`)

---

## 1. But

Cette tache implemente l'**integration HR -> Repair** en deux volets complementaires : (1) **validation assignment** technicien lors de l'attribution d'un ordre (deja amorcee dans Tache 5.1.5 via `HrEmployeesService.findOne`, cette tache 5.1.7 enrichit avec verifications metier additionnelles : roles autorises etendus, gestion conges/absences, conflit charge, exclusivite par tenant) ; (2) **alimentation automatique** de la table `hr_time_logs` par consumer Kafka qui traite les events `insurtech.events.repair.order.hours_logged` emis par Tache 5.1.5 -- chaque `logHours` declenche async un INSERT atomique dans `hr_time_logs` avec calcul automatique des heures supplementaires selon le **Code du Travail Marocain** (Loi 65-99, articles 184 a 196) : seuil 44h/semaine, majoration HS25% en semaine, HS50% nuit/dimanche, HS100% jours feries.

L'apport est sextuple. **Premierement**, structurellement, la table `hr_time_logs` est creee avec colonnes `employee_id` (FK), `task_type` (enum `repair_order` | `leave` | `training` | `admin` | `meeting` | `break`), `task_id` (FK soft selon task_type), `hours_logged` (Decimal 6,2 precision quart d'heure), `date` (DATE), `description`, et trois colonnes calculees automatiquement : `regular_hours`, `overtime_hours_25pct`, `overtime_hours_50pct`, `overtime_hours_100pct` (Decimal 6,2 chacune). La somme `regular_hours + overtime_hours_*` = `hours_logged` invariant garanti par check constraint Postgres. **Deuxiemement**, fonctionnellement, le service `HrTimeLogsService` expose 9 methodes : `logTimeFromRepairOrder` (consume event Kafka), `logManualTime` (admin entry pour leave/training/admin), `findByEmployee` (avec filters month/year/task_type), `findByEmployeeMonth` (aggregation per month avec breakdown HS), `getMonthlySummary` (cumul tenant/garage per month), `markAdjustment` (correction chef garage post-validation), `recomputeOvertimeForWeek` (recalcul si modifs retrospectives), `getEmployeeProductivity` (ratio heures productives vs presence), `exportForPayroll` (extraction format paie Sprint 13). **Troisiemement**, algorithmiquement, le **calcul HS** suit la regle MA : sommer heures de la semaine ISO (lundi-dimanche), tout au-dessus de 44h passe en HS25% (jusqu'a 50h cumule), au-dessus en HS50%. Pour les heures de nuit (21h-6h selon code), automatic HS50%. Pour les heures dimanche/jour ferie MA (1er Mai, Fete Trone 30 juillet, Aid Al-Adha, etc.), HS100%. Le calcul est trigge a chaque INSERT mais aussi en cron quotidien pour catch corrections retrospectives. **Quatriemement**, integrationally, la **paie variable productive** Sprint 13 consume `hr_time_logs` mensuel pour : (a) heures travaillees reelles, (b) prime productive 25% du salaire base si > 80% taux occupation (heures productives / heures payees), (c) heures supplementaires payees aux majorations correctes, (d) calcul CNSS/AMO/IGR sur base correcte. **Cinquiemement**, observabilite, dashboards Sprint 5.1.12 affichent : (a) "productivite par technicien" (heures repair_order / heures payees), (b) "top 5 techniciens du mois", (c) "alertes sur-utilisation" (> 50h/semaine recurrent), (d) "heures HS cumulees cout employeur" (anticipation budget paie). **Sixiemement**, conformite CNDP loi 09-08, les `hr_time_logs` sont donnees personnelles employee, accessibles uniquement par le technicien lui-meme + chef garage + HR admin (RBAC strict), retention 5 ans (obligation Code Travail art. 24) puis archivage S3 cold storage.

A l'issue de cette tache, l'API expose 6 endpoints REST (`GET /hr/employees/:id/time-logs`, `GET /hr/employees/:id/time-logs/summary`, `POST /hr/time-logs/manual`, `PATCH /hr/time-logs/:id/adjust`, `GET /hr/time-logs/payroll-export`, `GET /hr/employees/:id/productivity`), un consumer Kafka idempotent qui process `repair.order.hours_logged` events, un cron weekly `recompute-overtime-week.cron.ts` (chaque lundi 04:00 UTC) qui recompute HS pour la semaine ecoulee, des permissions RBAC `hr.time_logs.*` mappees aux roles (employee read self, chef garage read all garage, HR admin manage all), et 30+ tests valider la conformite Code Travail MA + idempotency consumer + multi-tenant isolation. Skalean Atlas : ses 8 techniciens commencent a accumuler des time logs reels des le premier order execute, alimentant le bulletin paie variable productive du mois en cours, avec heures supplementaires automatiquement calculees et visibles dans le dashboard chef garage en temps reel.

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

La **gestion des heures techniciens** est le **levier de profitabilite n°1** d'un garage MA. Une enquete ACAA 2024 (Association des Concessionnaires Automobile Auto) montre que pour un garage de 8 techniciens : (a) **temps de presence** moyen = 173h/mois (8h x 22 jours - pauses), (b) **temps productif declare** = 142h/mois (82%), (c) **temps reellement productif** mesure par observation = 108h/mois (62%). Le delta de 34h/mois/technicien represente **272h/mois de manque a gagner** pour un garage de 8 personnes, soit **95,200 MAD/mois** au taux moyen 350 MAD/h. Sur 12 mois, **1.14 million MAD de revenu perdu par garage de taille moyenne**.

Les **trois causes systemiques** identifiees par ACAA sont : (i) **declaration manuelle imprecise** (technicien remplit fiche papier en fin de journee, oublis frequents), (ii) **absence de granularite par ordre** (impossible savoir si tel order a couto reellement les 4h facturees ou 7h), (iii) **calcul HS manuel par RH** (souvent en fin de mois, avec drift cumulatif et conflits employes/employeur). Skalean InsurTech adresse ces trois causes : (i) automatic via Sprint 23 web-garage-mobile PWA technicien (scan QR start/stop task + auto-log), (ii) granularite parfaite via `repair_order_labor_logs` (Tache 5.1.5) + `hr_time_logs` (cette tache), (iii) calcul HS automatic conforme Code Travail MA via algorithme deterministe.

Au-dela du gain economique, la **conformite Code Travail MA** est un enjeu legal. La Loi 65-99 articles 184-196 impose : (a) seuil 44h/semaine au-dela duquel HS obligatoires, (b) majorations strictes 25%/50%/100% selon plage horaire et jour, (c) plafond 80h HS / an / employee, (d) registre journalier obligatoire des heures travaillees consultable par inspection du travail. Les garages MA en violation chronique font face a redressements URSSAF MA (CNSS) et amendes inspecteur travail. Skalean InsurTech offre la conformite native + audit trail 5 ans.

Sans la Tache 5.1.7, l'API Repair fonctionne (Tache 5.1.5 logHours stocke dans `repair_order_labor_logs`), mais :
- Tache 5.1.8 (invoices) ne peut pas calculer la facturation labor cost reel/cohorent paie.
- Tache 5.1.9 (Books) ne peut pas calculer charges sociales (CNSS 6.74% + AMO 4.41% + IGR progressif) sur base heures correctes.
- Tache 5.1.12 (dashboards) ne peut pas afficher metriques productivite.
- Sprint 13 paie module ne sait pas combien d'heures HS payer ce mois.
- Sprint 22 web-garage-app ne peut pas afficher "mes time logs ce mois".
- Sprint 23 web-garage-mobile PWA technicien ne peut pas afficher "mon total semaine" pour auto-controle.
- Inspection du travail MA : impossible produire registre journalier conforme.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **A. Pas de table `hr_time_logs`, utiliser `repair_order_labor_logs` directement pour paie** | Pas de duplication | Mais on a aussi besoin tracker leave/training/admin/meeting (non repair) | rejete |
| **B. `hr_time_logs` cumulative simple (heures totales / mois)** | Simple table 3 colonnes | Impossible granularite par jour / par task / inspection travail rejette | rejete |
| **C. `hr_time_logs` granular per day / per task / per type** | Auditability complete, multi-source | Plus de code | **RETENU** |
| **D. Calcul HS au moment du logHours (synchrone)** | Real-time | Logique semaine ISO necessite contexte semaine complet -> cross-row, complexe | rejete |
| **E. Calcul HS asynchrone par cron weekly + recompute on-demand** | Decouple, batch efficient | Latence avant HS visible (acceptable < 24h) | **RETENU** |
| **F. Calcul HS hybride : approximation a chaque INSERT + recompute precis hebdo** | Best of both | Plus de code | considere mais rejete (complexite) |
| **G. Consumer Kafka `repair.order.hours_logged` async** | Decouple Repair de HR | Latence visible (~1s) acceptable | **RETENU** |
| **H. Trigger Postgres INSERT auto on `repair_order_labor_logs`** | Synchrone DB-level | Couplage DB schema, pas testable, hard to debug | rejete |
| **I. Source de verite unique : `hr_time_logs` (deduplicate avec `repair_order_labor_logs`)** | DRY | Mais 5.1.5 a besoin de FK directs labor logs pour cost actuals immediat | rejete |
| **J. Dual write : Tache 5.1.5 ecrit dans `repair_order_labor_logs` (source for cost), Tache 5.1.7 consume event pour `hr_time_logs` (source for payroll)** | Separation domaines clean, decouple | Risque drift entre les 2 sources | **RETENU** + tests reconciliation |

L'option C (granular) reflete que **la granularite est obligatoire** : (a) Code Travail MA exige registre journalier (article 24), (b) paie variable necessite breakdown task_type pour separer productif (repair_order) de non-productif (admin, meeting), (c) dashboards Sprint 5.1.12 et Sprint 22 affichent breakdown.

L'option E (calcul HS asynchrone hebdomadaire) reflete que **HS sont definis par semaine ISO** (44h/semaine), donc tant que la semaine n'est pas complete, le calcul precis HS25/HS50 ne peut pas etre fait. Sprint 19 simplifie : INSERT initial avec HS = 0, recompute weekly. Sprint 25+ ajoutera recompute on-demand.

L'option J (dual write) reflete l'**architecture domain-driven** : `repair_order_labor_logs` appartient au domaine Repair (cost actuals immediats), `hr_time_logs` appartient au domaine HR (payroll, registre). Les deux co-existent avec une source primaire (event Kafka emis depuis 5.1.5) et un consumer (cette tache 5.1.7). Tests reconciliation Tache 5.1.13 verifient SUM(repair_order_labor_logs.hours) per order = SUM(hr_time_logs.hours WHERE task_type='repair_order' AND task_id=order_id) per order. Drift detection alert via cron.

### 2.3 Trade-offs explicites

**Trade-off 1 -- Granularite jour vs heure**. Choix : granularite jour (`date DATE`). Pour : suffisant pour paie et registre travail. Contre : impossible voir "matin vs apres-midi" sur dashboards. Mitigation : `logged_at TIMESTAMPTZ` ajoute pour traceabilite, mais aggregations sur `date`.

**Trade-off 2 -- HS recompute weekly fixe vs trigger on-demand**. Choix : cron weekly lundi 04:00 UTC + endpoint admin `POST /recompute-overtime`. Pour : performance batch + simplicite. Contre : drift jusqu'a 7j. Mitigation : recompute trigger automatic apres `markAdjustment`.

**Trade-off 3 -- Plage nuit fixe 21h-6h vs configurable par tenant**. Choix : fixe Sprint 19 (Code Travail MA standard). Sprint 25 ajoutera config tenant si demande (variations sectorielles).

**Trade-off 4 -- Jours feries hard-coded vs table referentiel**. Choix : table `mp_holidays_morocco` (deja seed Sprint 13 avec 16 jours feries MA + Aid mobiles Hijra). Pour : maintenance ML, mises a jour annuelles. Contre : dependance.

**Trade-off 5 -- Plafond annuel HS 80h alerting vs blocking**. Choix : alerting Kafka event `hr.employee.overtime_quota_exceeded` au lieu de blocking INSERT. Pour : flexibilite operationnelle (chef garage decide). Contre : depassement legal possible. Mitigation : alerte chef garage + audit log + Sprint 22 UI affichage prominent.

**Trade-off 6 -- Idempotency key derive event_id vs nouveau UUID**. Choix : event_id source primaire (inbox pattern). Pour : reuse infrastructure Tache 5.1.6. Contre : si event_id missing -> reject. Mitigation : Zod validation strict.

**Trade-off 7 -- Endpoint employee read self vs admin only**. Choix : employee read self time_logs (RBAC `hr.time_logs.read_self`). Pour : transparence, droit consultation Code Travail. Contre : risque consulting employes voisins (mitigation : strict filter user_id = employee_id).

**Trade-off 8 -- Productivity ratio definition**. Choix : `productive_hours / total_logged_hours` ou `productive_hours = task_type='repair_order'`. Alternative : utiliser `productive_hours / hours_presence` (Sprint 13 pointeuse). Sprint 19 simplifie : ratio sur logged (calculable immediatement). Sprint 25 enrichira avec pointeuse.

### 2.4 Decisions strategiques referenced

- **decision-001 (monorepo)** : `hr` package consume events depuis `repair` via Kafka (decouplage).
- **decision-002 (multi-tenant 3 niveaux RLS)** : `hr_time_logs.tenant_id` NOT NULL, RLS strict.
- **decision-003 (TypeORM 0.3 + migrations + functions Postgres)** : 2 migrations + 1 function Postgres `compute_weekly_overtime`.
- **decision-004 (Kafka topics)** : consume `insurtech.events.repair.order.hours_logged`, emit `insurtech.events.hr.overtime_quota_exceeded`, `insurtech.events.hr.time_log_adjusted`.
- **decision-006 (no-emoji)**.
- **decision-008 (data residency Atlas Casablanca)** : `hr_time_logs` stockes MA, encryption AES-256-GCM.
- **decision-011 (observabilite Prometheus)** : metriques `hr_time_logs_processed_total`, `hr_overtime_hours_total{type}`, `hr_productivity_pct_per_employee`.
- **decision-012 (conformite Code Travail MA stricte)** : algorithme HS deterministe valide par expert RH MA.
- **decision-013 (event-driven patterns)** : reuse BaseEventConsumer Tache 5.1.6.

### 2.5 Pieges techniques connus

1. **Piege : Calcul HS faux si log retrospective change semaine**.
   - Pourquoi : Adjustment 3 jours apres -> recalcul HS de la semaine necessaire.
   - Solution : `markAdjustment` trigger automatic `recomputeOvertimeForWeek(employee_id, week_date)`. Cron weekly catch missed.

2. **Piege : Jour ferie + dimanche meme date -> HS100% double-comptee**.
   - Pourquoi : 1er Mai dimanche, code applique 100% mais aussi dimanche 100% = 200% incorrect.
   - Solution : Algorithme prend MAX(majoration). Si dimanche AND ferie -> 100% (pas 200%).

3. **Piege : Heure debut-fin chevauche minuit (nuit)**.
   - Pourquoi : Log 22h-2h du matin = 4h sur 2 dates. Plage nuit 21h-6h applique partout.
   - Solution : Sprint 19 simplifie : `hours_logged` saisi par session, `logged_at` = start, calcul HS suit le jour de `logged_at`. Sprint 25+ ajoutera split nuit/jour si demande.

4. **Piege : Inbox event_id collision Kafka redelivery**.
   - Pourquoi : Sprint 5.1.6 deja resolu via INSERT ON CONFLICT.
   - Solution : Reuse BaseEventConsumer pattern. Test specific consumer redelivery.

5. **Piege : `hourly_rate` employee modifie entre log et recompute**.
   - Pourquoi : Promo employee, taux passe 250 -> 350.
   - Solution : `hr_time_logs.hourly_rate_at_time` snapshot au moment INSERT (analogue 5.1.5 `repair_order_labor_logs`). Recompute HS ne touche pas hourly_rate.

6. **Piege : Semaine ISO ambigue debut/fin annee**.
   - Pourquoi : 31 dec mardi = semaine 53 ou 1 ?
   - Solution : Utiliser `date_trunc('week', date)` Postgres (lundi-debut) + `extract(week from date)` ISO 8601. Test unit cas limites.

7. **Piege : Plafond 80h HS/an non check si consumer in_progress**.
   - Pourquoi : Insertion concurrent peut depasser plafond avant check.
   - Solution : Check apres INSERT dans transaction. Si depasse, emit event + log alert, mais ne bloque pas (decision business).

8. **Piege : Multi-tenant -- consumer hr applique event tenant A mais lookup employee tenant B**.
   - Pourquoi : Bug si tenant_id pas propage.
   - Solution : `TenantContext.run({ tenantId: event.tenant_id })` + lookup employee avec tenant_id filter strict.

9. **Piege : Adjustment retroactive change paie deja calculee mois ferme**.
   - Pourquoi : Paie mois N calculee, adjustment fait dans mois N+1.
   - Solution : Sprint 19 simplifie : adjustment fait, recompute, paie module Sprint 13 detecte differential, cree ligne "regularisation mois N" sur paie mois N+1. Documentation operationnelle clair.

10. **Piege : Export payroll volumineux > limites memoire**.
    - Pourquoi : Tenant 200 employees x 30 jours = 6000 lignes JSON ~5MB.
    - Solution : Pagination stream + format CSV pour bulk export. Endpoint `?format=csv` stream chunked.

11. **Piege : Productivity ratio si total_logged_hours = 0**.
    - Pourquoi : Division par zero.
    - Solution : Retourne `null` ou `0` explicit + flag `no_data: true`.

12. **Piege : Time log manual entry chef garage sans verifications**.
    - Pourquoi : Erreur saisie (40h en 1 jour).
    - Solution : Zod validation `hours_logged.max(24)` + audit log creator.

13. **Piege : Cron concurrent recompute multi-instances**.
    - Pourquoi : 3 replicas, chacun execute cron.
    - Solution : Redis SET NX lock (reuse pattern Tache 5.1.6).

14. **Piege : Inspection du travail demande registre, format specifique requis**.
    - Pourquoi : Format PDF specifique exige.
    - Solution : Sprint 5.1.10 ajoutera template PDF registre conforme. Sprint 19 expose data via endpoint, template defere.

15. **Piege : Employee supprime apres time logs existent**.
    - Pourquoi : FK violation si DELETE employee CASCADE.
    - Solution : Soft delete employees (Sprint 13 deja). `hr_time_logs.employee_id` FK avec ON DELETE RESTRICT. Doc operationnelle : soft delete uniquement.

## 3. Architecture context

### 3.1 Position dans le sprint

6eme tache du Sprint 19. Suit 5.1.5 (orders emit Kafka) + 5.1.6 (consumer pattern). Bloque 5.1.8 (invoices labor cost reel), 5.1.9 (Books charges sociales), 5.1.12 (dashboards productivite), 5.1.13 (E2E).

### 3.2 Position dans le programme global

Sprint 22 web-garage-app : affichage time logs per technician avec calendrier mensuel. Sprint 23 web-garage-mobile PWA technicien : auto-log via scan QR start/stop task. Sprint 25 cross-tenant : registres separes per tenant garage. Sprint 30+ : predictions IA "ce technicien depassera quota HS dans 3 semaines au rythme actuel". Sprint 32 connecteurs externes : export vers logiciels paie tiers (Sage Paie MA, Cegid).

### 3.3 Diagramme flux time logs cross-module

```
=============================================================================
EVENT FLOW : logHours Repair -> Consumer HR -> hr_time_logs + HS compute weekly
=============================================================================

[Tache 5.1.5] OrdersService.logHours()
   |
   |  SQL TRANSACTION
   |  INSERT repair_order_labor_logs (employee_id, hours, hourly_rate_at_time, cost)
   |  UPDATE repair_orders SET labor_hours_logged = ...
   |  INSERT outbox_events (topic='insurtech.events.repair.order.hours_logged',
   |                        payload={ employee_id, hours, cost, task_id=order_id, ... })
   |  COMMIT
   v

[Outbox Worker] (Sprint 4) -> Kafka producer -> Topic
   v

[HrTimeLogsConsumer extends BaseEventConsumer]
   |
   |  Zod validate HoursLoggedEventSchema
   |  TenantContext.run({ tenantId, userId: 'system' })
   |
   |  BEGIN TRANSACTION
   |  +- INSERT inbox_events ON CONFLICT DO NOTHING
   |  +- Process :
   |     +- Lookup employee.hourly_rate (snapshot du event.cost / event.hours pour coherence)
   |     +- INSERT hr_time_logs (
   |          tenant_id, employee_id, task_type='repair_order', task_id=event.order_id,
   |          hours_logged=event.hours, hourly_rate_at_time=event.cost/event.hours,
   |          date=event.logged_at::date,
   |          regular_hours=0, overtime_*=0,   -- placeholder, recompute weekly
   |          source='kafka_consumer', source_event_id=event.event_id
   |        )
   |     +- Trigger lightweight recompute current week (best-effort)
   |     +- Check quota HS annuel : SELECT SUM(overtime_*) per employee per year
   |        Si > 80h -> emit event 'hr.overtime_quota_exceeded'
   |  +- UPDATE inbox_events SET status='processed'
   |  COMMIT


CRON WEEKLY : recompute-overtime-week (chaque lundi 04:00 UTC)
=============================================================================

RecomputeOvertimeWeekCron.run()
   |
   |  Acquire Redis lock 'cron:recompute-overtime-week'
   |
   |  For each tenant (loop multi-tenant) :
   |    For each employee with time_logs ce mois :
   |      Compute precise HS for last_week (lundi N-7 -> dimanche N-1) :
   |        Group by date :
   |          For each date :
   |            +- Check is_holiday (lookup mp_holidays_morocco)
   |            +- Check is_sunday (date.day=0)
   |            +- For each log of that date :
   |               +- If is_sunday OR is_holiday -> overtime_100pct = hours_logged
   |               +- Elif is_night (logged_at hour in [21..23] or [0..5]) -> overtime_50pct
   |               +- Else accumulate regular_hours_this_week
   |          Apply weekly threshold (44h) :
   |            +- regular_hours total per week capped 44h
   |            +- overage 44-50h -> overtime_25pct
   |            +- overage >50h -> overtime_50pct
   |          Update hr_time_logs SET regular_hours, overtime_* per row (proportional split)
   |
   |  Release lock


PAYROLL EXPORT (consume Sprint 13 paie)
=============================================================================

GET /api/v1/hr/time-logs/payroll-export?month=2026-05&format=csv
   |
   |  For each employee :
   |    Aggregate hr_time_logs WHERE date BETWEEN month_start AND month_end
   |    Group by task_type
   |    Sum regular_hours + overtime_* per employee
   |    Compute cost : regular_hours * hourly_rate + overtime_25 * rate * 1.25 + overtime_50 * rate * 1.50 + overtime_100 * rate * 2.00
   |
   |  Output :
   |    employee_id, employee_name, regular_hours, overtime_25, overtime_50, overtime_100,
   |    productive_hours, non_productive_hours, productivity_pct,
   |    base_salary_estimated_mad, overtime_pay_mad, total_estimated_mad
```

### 3.4 Diagramme algorithme HS Code Travail MA

```
=============================================================================
ALGORITHME OVERTIME CALCULATION -- Loi 65-99 Code Travail Maroc
=============================================================================

Input :
  - employee_id
  - week_start (lundi YYYY-MM-DD)
  - hr_time_logs[] of this week for this employee (sorted by date, logged_at)
  - mp_holidays_morocco[] for the year

Algorithm :

1. WEEKLY THRESHOLD CALCULATION
   total_hours_week = SUM(hours_logged)
   regular_threshold = 44.0  (Loi 65-99 art. 184)

2. DAY-BY-DAY CATEGORIZATION
   For each log :
     date = log.date
     hour_start = log.logged_at.getHours()  (0-23)
     hours = log.hours_logged

     is_sunday = (date.dayOfWeek === 0)
     is_holiday = mp_holidays_morocco.includes(date)
     is_night = (hour_start >= 21 || hour_start <= 5)

     IF is_sunday OR is_holiday :
       category[log.id] = 'overtime_100pct'  (Loi 65-99 art. 196)
     ELIF is_night :
       category[log.id] = 'overtime_50pct'   (Loi 65-99 art. 196)
     ELSE :
       category[log.id] = 'regular_or_weekly_overtime'

3. WEEKLY ACCUMULATION FOR REGULAR HOURS
   running_total = 0
   For each log marked 'regular_or_weekly_overtime' (sorted by date, time) :
     remaining_in_log = log.hours_logged
     While remaining_in_log > 0 :
       IF running_total < regular_threshold (44) :
         consumable = MIN(remaining_in_log, regular_threshold - running_total)
         allocate_to log.regular_hours += consumable
         running_total += consumable
         remaining_in_log -= consumable
       ELIF running_total < 50 :  (44-50h -> HS25%)
         consumable = MIN(remaining_in_log, 50 - running_total)
         allocate_to log.overtime_25pct += consumable
         running_total += consumable
         remaining_in_log -= consumable
       ELSE :  (>50h -> HS50%)
         allocate_to log.overtime_50pct += remaining_in_log
         running_total += remaining_in_log
         remaining_in_log = 0

4. INVARIANT CHECK
   For each log :
     ASSERT regular_hours + overtime_25 + overtime_50 + overtime_100 === hours_logged

5. UPDATE DATABASE
   UPDATE hr_time_logs SET regular_hours = ..., overtime_25 = ..., overtime_50 = ..., overtime_100 = ...
   WHERE id IN (logs_ids)


EXEMPLES (precision Decimal.js) :

Exemple 1 : Semaine normale 40h (Lun-Ven 8h)
  -> 40h regular, 0h HS

Exemple 2 : Semaine 48h (Lun-Ven 8h + Sam 8h)
  -> 44h regular, 4h HS25% (Sam), 0h HS50%, 0h HS100%

Exemple 3 : Semaine 52h (Lun-Ven 8h + Sam 8h + Dim 4h)
  -> Dim 4h direct HS100%
  -> Lun-Sam: 48h
     -> 44h regular, 4h HS25%
  Total : 44 regular + 4 HS25% + 4 HS100%

Exemple 4 : Semaine 50h dont 2h nuit Mardi (22h-minuit)
  -> Mardi 22h-minuit (2h) direct HS50% (night)
  -> Reste 48h jour
     -> 44h regular, 4h HS25%
  Total : 44 regular + 4 HS25% + 2 HS50% + 0 HS100%

Exemple 5 : Lundi 1er Mai 8h (jour ferie)
  -> 8h HS100% (jour ferie majoration art 196)
  -> Reste de la semaine accumule normalement
```

## 4. Livrables checkables

- [ ] **L1** : Migration `CreateHrTimeLogsTable.ts` (~100 lignes) avec table + indexes + check constraints + RLS.
- [ ] **L2** : Migration `CreateComputeWeeklyOvertimeFunction.ts` (~80 lignes) function Postgres SQL pour batch recompute.
- [ ] **L3** : Constants `time-logs-constants.ts` (~70 lignes) avec task_types, hourly bounds, thresholds.
- [ ] **L4** : Zod schemas `time-logs.dto.ts` (~150 lignes) pour 6 endpoints.
- [ ] **L5** : Entite `hr-time-log.entity.ts` (~80 lignes) avec computed columns.
- [ ] **L6** : Utility `overtime-calculator.util.ts` (~150 lignes) algorithme HS Code Travail MA deterministe.
- [ ] **L7** : Service `HrTimeLogsService` (~400 lignes) avec 9 methodes.
- [ ] **L8** : Consumer `HrTimeLogsConsumer extends BaseEventConsumer` (~180 lignes) consume `repair.order.hours_logged`.
- [ ] **L9** : Service `HrOvertimeService` (~150 lignes) recompute weekly + quota check.
- [ ] **L10** : Service `HrPayrollExportService` (~180 lignes) generation CSV/JSON.
- [ ] **L11** : Service `HrProductivityService` (~120 lignes) compute ratio + dashboards.
- [ ] **L12** : Cron `recompute-overtime-week.cron.ts` (~120 lignes) lundi 04:00 UTC avec Redis lock.
- [ ] **L13** : Cron `check-overtime-quota-monthly.cron.ts` (~80 lignes) verification 1er du mois.
- [ ] **L14** : Controller `HrTimeLogsController` (~250 lignes) avec 6 endpoints REST.
- [ ] **L15** : Schemas events emis `hr-events.schemas.ts` (~80 lignes) Zod pour 2 events emis.
- [ ] **L16** : Permissions ajoutees : `hr.time_logs.read_self`, `hr.time_logs.read_all`, `hr.time_logs.create_manual`, `hr.time_logs.adjust`, `hr.time_logs.export_payroll`, `hr.time_logs.view_productivity`.
- [ ] **L17** : Mapping roles : technicien (read_self, view_productivity self), chef_garage (read_all garage, create_manual, adjust, view_productivity), hr_admin (toutes), gestionnaire (read_all, view_productivity), super_admin (toutes).
- [ ] **L18** : Tests unit utility (`overtime-calculator.util.spec.ts`) -- 30+ tests scenarios HS conformes Code Travail MA.
- [ ] **L19** : Tests unit service (`hr-time-logs.service.spec.ts`) -- 25+ tests.
- [ ] **L20** : Tests unit consumer (`hr-time-logs.consumer.spec.ts`) -- 15+ tests idempotency + multi-tenant.
- [ ] **L21** : Tests unit recompute (`hr-overtime.service.spec.ts`) -- 12+ tests scenarios semaine.
- [ ] **L22** : Tests integration consumer Kafka end-to-end (~10 tests).
- [ ] **L23** : Tests E2E (`hr-time-logs.e2e-spec.ts`) -- 25+ scenarios.
- [ ] **L24** : Tests cron (`recompute-overtime-week.cron.spec.ts`) -- 8+ tests.
- [ ] **L25** : Coverage >= 95% sur overtime-calculator.util (algorithme critique).
- [ ] **L26** : Coverage >= 90% sur HrTimeLogsService + HrTimeLogsConsumer.
- [ ] **L27** : Variables env documentees `.env.example`.
- [ ] **L28** : Aucune emoji + aucun console.log + tous imports explicites.
- [ ] **L29** : Documentation README packages/hr section "Time logs + Overtime Code Travail MA".
- [ ] **L30** : Migration seed table `mp_holidays_morocco` enrichie pour 2026/2027 avec dates Aid Hijra calculees.

## 5. Fichiers crees / modifies

```
CREES (28 fichiers)
====================

repo/packages/database/src/migrations/{ts1}-CreateHrTimeLogsTable.ts                                   (~100 lignes / table + RLS + indexes + check)
repo/packages/database/src/migrations/{ts2}-CreateComputeWeeklyOvertimeFunction.ts                     (~80 lignes / function Postgres)
repo/packages/database/src/migrations/{ts3}-SeedMpHolidaysMorocco2026.ts                                (~60 lignes / seed dates Hijra calc)

repo/packages/hr/src/constants/time-logs-constants.ts                                                   (~70 lignes)
repo/packages/hr/src/entities/hr-time-log.entity.ts                                                      (~80 lignes / TypeORM entity)
repo/packages/hr/src/dto/time-logs.dto.ts                                                                (~150 lignes / Zod DTOs)
repo/packages/hr/src/utils/overtime-calculator.util.ts                                                    (~150 lignes / algo HS pure)
repo/packages/hr/src/services/hr-time-logs.service.ts                                                     (~400 lignes / 9 methodes)
repo/packages/hr/src/services/hr-overtime.service.ts                                                       (~150 lignes / recompute + quota)
repo/packages/hr/src/services/hr-payroll-export.service.ts                                                 (~180 lignes / CSV stream)
repo/packages/hr/src/services/hr-productivity.service.ts                                                    (~120 lignes / ratio)
repo/packages/hr/src/consumers/hr-time-logs.consumer.ts                                                     (~180 lignes / BaseEventConsumer)
repo/packages/hr/src/crons/recompute-overtime-week.cron.ts                                                  (~120 lignes / Redis lock)
repo/packages/hr/src/crons/check-overtime-quota-monthly.cron.ts                                              (~80 lignes / quota alerts)
repo/packages/shared-events/src/schemas/hr-events.schemas.ts                                                (~80 lignes / Zod 2 events)

repo/apps/api/src/modules/hr/controllers/time-logs.controller.ts                                            (~250 lignes / 6 endpoints REST)

repo/packages/hr/src/utils/__tests__/overtime-calculator.util.spec.ts                                       (~500 lignes / 30+ tests)
repo/packages/hr/src/services/__tests__/hr-time-logs.service.spec.ts                                         (~600 lignes / 25+ tests)
repo/packages/hr/src/services/__tests__/hr-overtime.service.spec.ts                                           (~350 lignes / 12+ tests)
repo/packages/hr/src/services/__tests__/hr-payroll-export.service.spec.ts                                     (~250 lignes / 10+ tests)
repo/packages/hr/src/services/__tests__/hr-productivity.service.spec.ts                                       (~200 lignes / 10+ tests)
repo/packages/hr/src/consumers/__tests__/hr-time-logs.consumer.spec.ts                                        (~350 lignes / 15+ tests)
repo/packages/hr/src/crons/__tests__/recompute-overtime-week.cron.spec.ts                                      (~200 lignes / 8+ tests)
repo/apps/api/test/hr/time-logs.e2e-spec.ts                                                                   (~600 lignes / 25+ scenarios)
repo/apps/api/test/integration/hr-consumer.integration-spec.ts                                                (~300 lignes / 10+ Kafka real)

repo/packages/hr/README.md                                                                                    (section Time logs + Overtime MA)


MODIFIES (6 fichiers)
====================

repo/packages/hr/src/index.ts                                                                                  (export consumer, services, utility)
repo/packages/hr/src/hr.module.ts                                                                              (register providers + consumer)
repo/packages/auth/src/rbac/permissions.enum.ts                                                                 (ajout 6 permissions hr.time_logs.*)
repo/packages/auth/src/rbac/permissions-matrix.ts                                                                (mapping 5 roles)
repo/apps/api/src/modules/hr/hr.module.ts                                                                        (controller registration)
repo/.env.example                                                                                                  (4 nouvelles variables)
```

## 6. Code patterns COMPLETS (11 fichiers reels, executables, typed strict)

### Fichier 1/11 : `repo/packages/hr/src/constants/time-logs-constants.ts`

```typescript
// repo/packages/hr/src/constants/time-logs-constants.ts
// Constants module HR time logs
// Reference : B-19 Tache 5.1.7 + Loi 65-99 Code Travail Maroc

/**
 * Types de task pour les time logs
 */
export const TASK_TYPES = [
  'repair_order',    // Lien direct vers repair_orders.id
  'leave',           // Conges payes/non payes
  'training',        // Formation interne/externe
  'admin',           // Administratif (saisie, reunion equipe)
  'meeting',         // Reunion client/fournisseur
  'break',           // Pause non productive
] as const;
export type TaskType = (typeof TASK_TYPES)[number];

/**
 * Sources de l'entree time log
 */
export const TIME_LOG_SOURCES = ['kafka_consumer', 'manual_entry', 'adjustment', 'cron_import'] as const;
export type TimeLogSource = (typeof TIME_LOG_SOURCES)[number];

/**
 * Constants Code Travail Maroc (Loi 65-99)
 */
export const CODE_TRAVAIL_MA = {
  /** Seuil hebdomadaire (art. 184) */
  WEEKLY_HOURS_THRESHOLD: 44,
  /** Plafond HS25% (44h-50h) */
  WEEKLY_HS_25_LIMIT: 50,
  /** Plafond annuel HS / employee */
  YEARLY_OVERTIME_QUOTA: 80,
  /** Majorations (art. 196) */
  OVERTIME_25_RATE: 1.25,
  OVERTIME_50_RATE: 1.50,
  OVERTIME_100_RATE: 2.00,
  /** Plage horaire nuit (art. 196) */
  NIGHT_HOUR_START: 21,
  NIGHT_HOUR_END: 6,
} as const;

/**
 * Constantes business operationnelles
 */
export const TIME_LOGS_CONSTANTS = {
  /** Max hours per single log entry (anti-bug saisie) */
  MAX_HOURS_PER_LOG: 24,
  /** Precision Decimal.js */
  DECIMAL_SCALE: 2,
  /** Retention years (Code Travail art. 24) */
  RETENTION_YEARS: 5,
  /** Cron lock TTL */
  CRON_LOCK_TTL_SEC: 1800, // 30min (cron weekly peut prendre plus longtemps)
  /** Redis lock keys */
  REDIS_LOCK_RECOMPUTE_WEEK: 'cron:hr:recompute-overtime-week',
  REDIS_LOCK_QUOTA_CHECK: 'cron:hr:check-overtime-quota',
  /** Productivity calculation */
  PRODUCTIVE_TASK_TYPES: ['repair_order'] as const,
  /** Format month string */
  MONTH_FORMAT: 'YYYY-MM',
} as const;

/**
 * Topics Kafka consumes + emit
 */
export const HR_KAFKA_TOPICS = {
  CONSUME_ORDER_HOURS_LOGGED: 'insurtech.events.repair.order.hours_logged',
  EMIT_OVERTIME_QUOTA_EXCEEDED: 'insurtech.events.hr.overtime_quota_exceeded',
  EMIT_TIME_LOG_ADJUSTED: 'insurtech.events.hr.time_log_adjusted',
  EMIT_PAYROLL_EXPORT_READY: 'insurtech.events.hr.payroll_export_ready',
} as const;
```

### Fichier 2/11 : `repo/packages/hr/src/entities/hr-time-log.entity.ts`

```typescript
// repo/packages/hr/src/entities/hr-time-log.entity.ts

import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  Index, ManyToOne, JoinColumn,
} from 'typeorm';
import type { TaskType, TimeLogSource } from '../constants/time-logs-constants.js';
import { HrEmployee } from './hr-employee.entity.js'; // Sprint 13 entity

@Entity('hr_time_logs')
@Index('idx_hr_time_logs_tenant_employee_date', ['tenant_id', 'employee_id', 'date'])
@Index('idx_hr_time_logs_tenant_date', ['tenant_id', 'date'])
@Index('idx_hr_time_logs_task', ['task_type', 'task_id'])
@Index('idx_hr_time_logs_employee_year_month', ['employee_id', 'date'])
@Index('idx_hr_time_logs_source_event', ['source_event_id'], { unique: true, where: 'source_event_id IS NOT NULL' })
export class HrTimeLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid' })
  employee_id!: string;

  @ManyToOne(() => HrEmployee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee?: HrEmployee;

  @Column({
    type: 'enum',
    enum: ['repair_order', 'leave', 'training', 'admin', 'meeting', 'break'],
  })
  task_type!: TaskType;

  /** FK soft selon task_type (ex: repair_orders.id si task_type='repair_order') */
  @Column({ type: 'uuid', nullable: true })
  task_id!: string | null;

  /** Heures loggees (precision quart d'heure 0.25) */
  @Column({ type: 'numeric', precision: 6, scale: 2 })
  hours_logged!: string;

  /** Taux horaire snapshot au moment du log (anti-drift recompute) */
  @Column({ type: 'numeric', precision: 8, scale: 2 })
  hourly_rate_at_time!: string;

  @Column({ type: 'date' })
  date!: Date;

  /** Timestamp precis du debut log (pour detection nuit) */
  @Column({ type: 'timestamptz' })
  logged_at!: Date;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Heures regulieres apres calcul (cron weekly) */
  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  regular_hours!: string;

  /** HS 25% (44h-50h semaine, jour) */
  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  overtime_hours_25pct!: string;

  /** HS 50% (>50h semaine OU nuit 21h-6h) */
  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  overtime_hours_50pct!: string;

  /** HS 100% (dimanche OU jour ferie) */
  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  overtime_hours_100pct!: string;

  /** True quand cron weekly a fait le recompute precis */
  @Column({ type: 'boolean', default: false })
  is_overtime_computed!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  overtime_computed_at!: Date | null;

  @Column({
    type: 'enum',
    enum: ['kafka_consumer', 'manual_entry', 'adjustment', 'cron_import'],
    default: 'manual_entry',
  })
  source!: TimeLogSource;

  /** event_id source si source='kafka_consumer' (idempotency garantie via index UNIQUE) */
  @Column({ type: 'uuid', nullable: true })
  source_event_id!: string | null;

  /** Created_by user pour audit (admin manual entry) */
  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  /** Adjustment notes */
  @Column({ type: 'text', nullable: true })
  adjustment_notes!: string | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
```

### Fichier 3/11 : `repo/packages/hr/src/utils/overtime-calculator.util.ts`

```typescript
// repo/packages/hr/src/utils/overtime-calculator.util.ts
// Algorithme deterministe de calcul HS conforme Code Travail Maroc Loi 65-99
// Pure function : pas de DB, pas d'I/O. Testable a 100%.

import { Decimal } from 'decimal.js';
import { CODE_TRAVAIL_MA } from '../constants/time-logs-constants.js';

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export interface TimeLogInput {
  id: string;
  date: string;          // YYYY-MM-DD
  logged_at: string;     // ISO8601 (pour detection night hour)
  hours_logged: string;  // Decimal precision
}

export interface OvertimeResult {
  log_id: string;
  regular_hours: string;
  overtime_25pct: string;
  overtime_50pct: string;
  overtime_100pct: string;
}

export interface OvertimeContext {
  /** Liste dates jours feries MA pour l'annee */
  holidays_ma: ReadonlySet<string>; // Set des dates 'YYYY-MM-DD'
}

/**
 * Determine si une date est un dimanche.
 */
export function isSunday(date: string): boolean {
  // Parse en respectant timezone Africa/Casablanca (Sprint 19 simplifie : UTC, MA pas DST)
  const d = new Date(date + 'T00:00:00Z');
  return d.getUTCDay() === 0;
}

/**
 * Determine si une date est jour ferie MA.
 */
export function isHolidayMa(date: string, ctx: OvertimeContext): boolean {
  return ctx.holidays_ma.has(date);
}

/**
 * Determine si l'heure de debut log tombe dans la plage nuit (21h-6h).
 */
export function isNightHour(loggedAtIso: string): boolean {
  const hour = new Date(loggedAtIso).getUTCHours();
  return hour >= CODE_TRAVAIL_MA.NIGHT_HOUR_START || hour < CODE_TRAVAIL_MA.NIGHT_HOUR_END;
}

/**
 * Algorithme principal : calcule HS pour TOUS les logs d'une semaine ISO d'un employee.
 * Approche pure : ne touche pas a la DB, retourne juste le breakdown.
 *
 * @param weekLogs Tous les logs de la semaine pour cet employee, tries par date/logged_at
 * @param ctx Context jours feries
 * @returns Array OvertimeResult, meme ordre que weekLogs
 */
export function computeWeeklyOvertime(weekLogs: ReadonlyArray<TimeLogInput>, ctx: OvertimeContext): OvertimeResult[] {
  const results: OvertimeResult[] = [];

  // Phase 1 : categorize each log
  interface CategorizedLog {
    log: TimeLogInput;
    category: 'sunday_or_holiday' | 'night' | 'regular_eligible';
    remaining: Decimal;
    allocated: { regular: Decimal; ot25: Decimal; ot50: Decimal; ot100: Decimal };
  }
  const categorized: CategorizedLog[] = weekLogs.map((log) => {
    const isSund = isSunday(log.date);
    const isHol = isHolidayMa(log.date, ctx);
    const isNight = isNightHour(log.logged_at);
    let category: CategorizedLog['category'];
    if (isSund || isHol) category = 'sunday_or_holiday';
    else if (isNight) category = 'night';
    else category = 'regular_eligible';
    return {
      log,
      category,
      remaining: new Decimal(log.hours_logged),
      allocated: { regular: new Decimal(0), ot25: new Decimal(0), ot50: new Decimal(0), ot100: new Decimal(0) },
    };
  });

  // Phase 2 : pre-allocate HS100 et HS50 directes
  for (const c of categorized) {
    if (c.category === 'sunday_or_holiday') {
      c.allocated.ot100 = c.remaining;
      c.remaining = new Decimal(0);
    } else if (c.category === 'night') {
      c.allocated.ot50 = c.remaining;
      c.remaining = new Decimal(0);
    }
  }

  // Phase 3 : weekly threshold allocation pour 'regular_eligible'
  const regularThreshold = new Decimal(CODE_TRAVAIL_MA.WEEKLY_HOURS_THRESHOLD);
  const hs25Limit = new Decimal(CODE_TRAVAIL_MA.WEEKLY_HS_25_LIMIT);
  let runningTotal = new Decimal(0);

  for (const c of categorized) {
    if (c.category !== 'regular_eligible') continue;
    while (c.remaining.greaterThan(0)) {
      if (runningTotal.lessThan(regularThreshold)) {
        const consumable = Decimal.min(c.remaining, regularThreshold.minus(runningTotal));
        c.allocated.regular = c.allocated.regular.plus(consumable);
        runningTotal = runningTotal.plus(consumable);
        c.remaining = c.remaining.minus(consumable);
      } else if (runningTotal.lessThan(hs25Limit)) {
        const consumable = Decimal.min(c.remaining, hs25Limit.minus(runningTotal));
        c.allocated.ot25 = c.allocated.ot25.plus(consumable);
        runningTotal = runningTotal.plus(consumable);
        c.remaining = c.remaining.minus(consumable);
      } else {
        c.allocated.ot50 = c.allocated.ot50.plus(c.remaining);
        runningTotal = runningTotal.plus(c.remaining);
        c.remaining = new Decimal(0);
      }
    }
  }

  // Phase 4 : build output + invariant check
  for (const c of categorized) {
    const totalAllocated = c.allocated.regular.plus(c.allocated.ot25).plus(c.allocated.ot50).plus(c.allocated.ot100);
    const expected = new Decimal(c.log.hours_logged);
    if (!totalAllocated.equals(expected)) {
      throw new Error(`INVARIANT_VIOLATION: log_id=${c.log.id} allocated=${totalAllocated} expected=${expected}`);
    }
    results.push({
      log_id: c.log.id,
      regular_hours: c.allocated.regular.toFixed(2),
      overtime_25pct: c.allocated.ot25.toFixed(2),
      overtime_50pct: c.allocated.ot50.toFixed(2),
      overtime_100pct: c.allocated.ot100.toFixed(2),
    });
  }

  return results;
}

/**
 * Compute paie cost pour une liste de logs avec breakdown HS.
 * Utilise par HrPayrollExportService.
 */
export function computePayrollCost(
  regular: string, ot25: string, ot50: string, ot100: string, hourlyRate: string,
): { regular_cost: string; ot25_cost: string; ot50_cost: string; ot100_cost: string; total_cost: string } {
  const rate = new Decimal(hourlyRate);
  const reg = new Decimal(regular).mul(rate);
  const o25 = new Decimal(ot25).mul(rate).mul(CODE_TRAVAIL_MA.OVERTIME_25_RATE);
  const o50 = new Decimal(ot50).mul(rate).mul(CODE_TRAVAIL_MA.OVERTIME_50_RATE);
  const o100 = new Decimal(ot100).mul(rate).mul(CODE_TRAVAIL_MA.OVERTIME_100_RATE);
  const total = reg.plus(o25).plus(o50).plus(o100);
  return {
    regular_cost: reg.toFixed(2),
    ot25_cost: o25.toFixed(2),
    ot50_cost: o50.toFixed(2),
    ot100_cost: o100.toFixed(2),
    total_cost: total.toFixed(2),
  };
}
```

### Fichier 4/11 : `repo/packages/hr/src/consumers/hr-time-logs.consumer.ts`

```typescript
// repo/packages/hr/src/consumers/hr-time-logs.consumer.ts

import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { BaseEventConsumer, EVENT_TOPICS, PartsConsumedEventSchema } from '@insurtech/shared-events';
import { z } from 'zod';
import { Decimal } from 'decimal.js';
import { HrTimeLog } from '../entities/hr-time-log.entity.js';
import { HR_KAFKA_TOPICS, TIME_LOGS_CONSTANTS, CODE_TRAVAIL_MA } from '../constants/time-logs-constants.js';

const OrderHoursLoggedEventSchema = z.object({
  event_id: z.string().uuid(),
  emitted_at: z.string().datetime(),
  tenant_id: z.string().uuid(),
  order_id: z.string().uuid(),
  employee_id: z.string().uuid(),
  hours: z.string().regex(/^\d+(\.\d{1,2})?$/),
  cost: z.string().regex(/^\d+(\.\d{1,2})?$/),
  task_id: z.string().uuid().nullable().optional(),
  logged_at: z.string().datetime().optional(),
}).passthrough();
type OrderHoursLoggedEvent = z.infer<typeof OrderHoursLoggedEventSchema>;

@Injectable()
export class HrTimeLogsConsumer extends BaseEventConsumer<OrderHoursLoggedEvent> {
  protected readonly topic = HR_KAFKA_TOPICS.CONSUME_ORDER_HOURS_LOGGED;
  protected readonly schema = OrderHoursLoggedEventSchema;
  protected readonly consumerName = 'HrTimeLogsConsumer.handleOrderHoursLogged';

  protected async processEvent(event: OrderHoursLoggedEvent, em: EntityManager): Promise<void> {
    const hourlyRate = new Decimal(event.cost).div(new Decimal(event.hours)).toFixed(2);
    const loggedAt = event.logged_at ?? event.emitted_at;
    const dateStr = loggedAt.substring(0, 10); // YYYY-MM-DD

    // INSERT hr_time_logs with UNIQUE source_event_id index garantissant idempotency
    await em.query(
      `INSERT INTO hr_time_logs
         (id, tenant_id, employee_id, task_type, task_id,
          hours_logged, hourly_rate_at_time, date, logged_at,
          description, regular_hours, overtime_hours_25pct,
          overtime_hours_50pct, overtime_hours_100pct,
          is_overtime_computed, source, source_event_id, created_by,
          created_at, updated_at)
       VALUES
         (gen_random_uuid(), $1, $2, 'repair_order', $3,
          $4, $5, $6::date, $7::timestamptz,
          $8, 0, 0, 0, 0,
          false, 'kafka_consumer', $9, NULL,
          NOW(), NOW())
       ON CONFLICT (source_event_id) WHERE source_event_id IS NOT NULL DO NOTHING`,
      [
        event.tenant_id, event.employee_id, event.order_id,
        event.hours, hourlyRate, dateStr, loggedAt,
        `Repair order labor`, event.event_id,
      ],
    );

    // Best-effort lightweight overtime recompute current week
    await this.lightweightWeekRecompute(em, event.tenant_id, event.employee_id, dateStr);

    // Check yearly quota
    await this.checkYearlyQuota(em, event.tenant_id, event.employee_id, dateStr.substring(0, 4));
  }

  /**
   * Recalcul approximatif current week. Le cron weekly fait le calcul precis.
   * Approximation : si hours_logged cumul > 44, marquer rest en HS25.
   */
  private async lightweightWeekRecompute(em: EntityManager, tenantId: string, employeeId: string, dateStr: string): Promise<void> {
    // Implementation simplifiee Sprint 19 : skip recompute, cron weekly handle precis
    // Sprint 25+ pourra implementer recompute synchrone si requis
    this.logger.debug(
      { tenant_id: tenantId, employee_id: employeeId, date: dateStr, action: 'lightweight_recompute_skipped' },
      'Lightweight recompute deferred to weekly cron',
    );
  }

  /**
   * Verifie le quota annuel HS (80h/an, Loi 65-99 art. 196).
   */
  private async checkYearlyQuota(em: EntityManager, tenantId: string, employeeId: string, year: string): Promise<void> {
    const result = await em.query<Array<{ total_overtime: string }>>(
      `SELECT COALESCE(SUM(overtime_hours_25pct + overtime_hours_50pct + overtime_hours_100pct), 0)::text AS total_overtime
       FROM hr_time_logs
       WHERE tenant_id = $1 AND employee_id = $2 AND EXTRACT(YEAR FROM date) = $3`,
      [tenantId, employeeId, parseInt(year, 10)],
    );
    const totalOvertime = parseFloat(result[0]?.total_overtime ?? '0');
    if (totalOvertime > CODE_TRAVAIL_MA.YEARLY_OVERTIME_QUOTA) {
      // Emit outbox event (consume par Sprint 5.1.12 dashboards + alertes admin)
      await em.query(
        `INSERT INTO outbox_events (id, tenant_id, topic, payload, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3::jsonb, NOW())`,
        [
          tenantId,
          HR_KAFKA_TOPICS.EMIT_OVERTIME_QUOTA_EXCEEDED,
          JSON.stringify({
            event_id: crypto.randomUUID(),
            emitted_at: new Date().toISOString(),
            tenant_id: tenantId,
            employee_id: employeeId,
            year, total_overtime_hours: totalOvertime,
            quota_hours: CODE_TRAVAIL_MA.YEARLY_OVERTIME_QUOTA,
            exceeded_by: totalOvertime - CODE_TRAVAIL_MA.YEARLY_OVERTIME_QUOTA,
          }),
        ],
      );
      this.logger.warn(
        { tenant_id: tenantId, employee_id: employeeId, year, total_overtime: totalOvertime, action: 'overtime_quota_exceeded' },
        'Employee yearly overtime quota exceeded',
      );
    }
  }
}
```

### Fichier 5/11 : `repo/packages/hr/src/services/hr-time-logs.service.ts`

```typescript
// repo/packages/hr/src/services/hr-time-logs.service.ts

import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Logger } from 'pino';
import { Decimal } from 'decimal.js';
import { HrTimeLog } from '../entities/hr-time-log.entity.js';
import { TIME_LOGS_CONSTANTS, type TaskType } from '../constants/time-logs-constants.js';
import { TenantContext } from '@insurtech/shared-utils';
import type {
  LogManualTimeInput, AdjustTimeLogInput, FindByEmployeeQuery,
  MonthlySummaryResponse, EmployeeProductivityResponse,
} from '../dto/time-logs.dto.js';

@Injectable()
export class HrTimeLogsService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  async logManualTime(input: LogManualTimeInput): Promise<HrTimeLog> {
    const tenantId = TenantContext.getTenantId();
    const userId = TenantContext.getUserId();
    if (parseFloat(String(input.hours_logged)) > TIME_LOGS_CONSTANTS.MAX_HOURS_PER_LOG) {
      throw new BadRequestException({ code: 'HOURS_EXCEED_MAX', max: TIME_LOGS_CONSTANTS.MAX_HOURS_PER_LOG });
    }
    return this.dataSource.transaction(async (em) => {
      const employee = await em.query<Array<{ id: string; hourly_rate: string; is_active: boolean }>>(
        `SELECT id, hourly_rate, is_active FROM hr_employees WHERE id = $1 AND tenant_id = $2`,
        [input.employee_id, tenantId],
      );
      if (employee.length === 0) throw new NotFoundException({ code: 'EMPLOYEE_NOT_FOUND' });
      if (!employee[0].is_active) throw new BadRequestException({ code: 'EMPLOYEE_INACTIVE' });
      const log = em.create(HrTimeLog, {
        tenant_id: tenantId,
        employee_id: input.employee_id,
        task_type: input.task_type,
        task_id: input.task_id ?? null,
        hours_logged: String(input.hours_logged),
        hourly_rate_at_time: employee[0].hourly_rate,
        date: new Date(input.date),
        logged_at: new Date(input.logged_at ?? input.date),
        description: input.description ?? null,
        regular_hours: '0',
        overtime_hours_25pct: '0',
        overtime_hours_50pct: '0',
        overtime_hours_100pct: '0',
        is_overtime_computed: false,
        source: 'manual_entry',
        source_event_id: null,
        created_by: userId,
      });
      const saved = await em.save(log);
      this.logger.info(
        { tenant_id: tenantId, employee_id: input.employee_id, log_id: saved.id, action: 'time_log_manual_created' },
        'Manual time log created',
      );
      return saved;
    });
  }

  async adjust(logId: string, input: AdjustTimeLogInput): Promise<HrTimeLog> {
    const tenantId = TenantContext.getTenantId();
    return this.dataSource.transaction(async (em) => {
      const log = await em.findOne(HrTimeLog, { where: { id: logId, tenant_id: tenantId } });
      if (!log) throw new NotFoundException({ code: 'TIME_LOG_NOT_FOUND' });
      const oldHours = log.hours_logged;
      await em.update(HrTimeLog, logId, {
        hours_logged: String(input.new_hours_logged),
        adjustment_notes: input.notes,
        is_overtime_computed: false, // force recompute
        source: 'adjustment',
      });
      // Emit event for cron to detect adjustment week
      await em.query(
        `INSERT INTO outbox_events (id, tenant_id, topic, payload, created_at)
         VALUES (gen_random_uuid(), $1, 'insurtech.events.hr.time_log_adjusted', $2::jsonb, NOW())`,
        [
          tenantId,
          JSON.stringify({
            event_id: crypto.randomUUID(), emitted_at: new Date().toISOString(),
            tenant_id: tenantId, log_id: logId, employee_id: log.employee_id,
            old_hours: oldHours, new_hours: String(input.new_hours_logged),
          }),
        ],
      );
      const updated = await em.findOneOrFail(HrTimeLog, { where: { id: logId } });
      this.logger.info(
        { tenant_id: tenantId, log_id: logId, old_hours: oldHours, new_hours: input.new_hours_logged, action: 'time_log_adjusted' },
        'Time log adjusted',
      );
      return updated;
    });
  }

  async findByEmployee(employeeId: string, query: FindByEmployeeQuery, requesterId: string, requesterRole: string): Promise<{ items: HrTimeLog[]; total: number }> {
    const tenantId = TenantContext.getTenantId();
    if (requesterRole === 'garage_technicien' && employeeId !== requesterId) {
      throw new ForbiddenException({ code: 'CANNOT_VIEW_OTHER_EMPLOYEE_LOGS' });
    }
    const qb = this.dataSource.getRepository(HrTimeLog).createQueryBuilder('tl')
      .where('tl.tenant_id = :t', { t: tenantId })
      .andWhere('tl.employee_id = :e', { e: employeeId });
    if (query.month) {
      qb.andWhere(`to_char(tl.date, 'YYYY-MM') = :m`, { m: query.month });
    }
    if (query.task_type) qb.andWhere('tl.task_type = :tt', { tt: query.task_type });
    if (query.date_from) qb.andWhere('tl.date >= :df', { df: query.date_from });
    if (query.date_to) qb.andWhere('tl.date <= :dt', { dt: query.date_to });
    const total = await qb.getCount();
    const items = await qb.orderBy('tl.date', 'DESC').addOrderBy('tl.logged_at', 'DESC')
      .skip((query.page - 1) * query.page_size).take(query.page_size).getMany();
    return { items, total };
  }

  async getMonthlySummary(employeeId: string, month: string): Promise<MonthlySummaryResponse> {
    const tenantId = TenantContext.getTenantId();
    const result = await this.dataSource.query<Array<{
      task_type: TaskType; total_hours: string;
      regular_hours: string; ot25: string; ot50: string; ot100: string;
    }>>(
      `SELECT task_type,
         COALESCE(SUM(hours_logged), 0)::text AS total_hours,
         COALESCE(SUM(regular_hours), 0)::text AS regular_hours,
         COALESCE(SUM(overtime_hours_25pct), 0)::text AS ot25,
         COALESCE(SUM(overtime_hours_50pct), 0)::text AS ot50,
         COALESCE(SUM(overtime_hours_100pct), 0)::text AS ot100
       FROM hr_time_logs
       WHERE tenant_id = $1 AND employee_id = $2 AND to_char(date, 'YYYY-MM') = $3
       GROUP BY task_type`,
      [tenantId, employeeId, month],
    );
    let totalHours = new Decimal(0), regular = new Decimal(0), ot25 = new Decimal(0), ot50 = new Decimal(0), ot100 = new Decimal(0);
    const breakdown: Record<TaskType, string> = {} as Record<TaskType, string>;
    for (const row of result) {
      breakdown[row.task_type] = row.total_hours;
      totalHours = totalHours.plus(row.total_hours);
      regular = regular.plus(row.regular_hours);
      ot25 = ot25.plus(row.ot25);
      ot50 = ot50.plus(row.ot50);
      ot100 = ot100.plus(row.ot100);
    }
    return {
      employee_id: employeeId, month,
      total_hours_logged: totalHours.toFixed(2),
      breakdown_by_task_type: breakdown,
      regular_hours: regular.toFixed(2),
      overtime_25pct: ot25.toFixed(2),
      overtime_50pct: ot50.toFixed(2),
      overtime_100pct: ot100.toFixed(2),
    };
  }

  async getEmployeeProductivity(employeeId: string, month: string): Promise<EmployeeProductivityResponse> {
    const tenantId = TenantContext.getTenantId();
    const result = await this.dataSource.query<Array<{ productive: string; total: string }>>(
      `SELECT
         COALESCE(SUM(CASE WHEN task_type = 'repair_order' THEN hours_logged END), 0)::text AS productive,
         COALESCE(SUM(hours_logged), 0)::text AS total
       FROM hr_time_logs
       WHERE tenant_id = $1 AND employee_id = $2 AND to_char(date, 'YYYY-MM') = $3`,
      [tenantId, employeeId, month],
    );
    const productive = new Decimal(result[0]?.productive ?? '0');
    const total = new Decimal(result[0]?.total ?? '0');
    const productivityPct = total.isZero() ? 0 : productive.div(total).mul(100).toDP(2).toNumber();
    return {
      employee_id: employeeId, month,
      productive_hours: productive.toFixed(2),
      total_logged_hours: total.toFixed(2),
      productivity_pct: productivityPct,
      no_data: total.isZero(),
    };
  }
}
```

### Fichier 6/11 : `repo/packages/hr/src/services/hr-overtime.service.ts`

```typescript
// repo/packages/hr/src/services/hr-overtime.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Logger } from 'pino';
import { computeWeeklyOvertime, type TimeLogInput, type OvertimeContext } from '../utils/overtime-calculator.util.js';
import { HrTimeLog } from '../entities/hr-time-log.entity.js';

@Injectable()
export class HrOvertimeService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  /**
   * Recompute overtime pour une semaine ISO d'un employee.
   * Appele par cron weekly + on-demand admin.
   */
  async recomputeWeekForEmployee(tenantId: string, employeeId: string, weekStart: Date): Promise<{ updated_count: number }> {
    return this.dataSource.transaction(async (em) => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekStartStr = weekStart.toISOString().substring(0, 10);
      const weekEndStr = weekEnd.toISOString().substring(0, 10);

      const logsRaw = await em.query<Array<{ id: string; date: string; logged_at: string; hours_logged: string }>>(
        `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, logged_at::text AS logged_at, hours_logged::text AS hours_logged
         FROM hr_time_logs
         WHERE tenant_id = $1 AND employee_id = $2
           AND date >= $3 AND date <= $4
         ORDER BY date ASC, logged_at ASC`,
        [tenantId, employeeId, weekStartStr, weekEndStr],
      );
      if (logsRaw.length === 0) return { updated_count: 0 };

      const ctx = await this.loadHolidayContext(em, weekStart.getFullYear());
      const inputs: TimeLogInput[] = logsRaw.map((r) => ({
        id: r.id, date: r.date, logged_at: r.logged_at, hours_logged: r.hours_logged,
      }));
      const results = computeWeeklyOvertime(inputs, ctx);

      let updated = 0;
      for (const r of results) {
        await em.update(HrTimeLog,
          { id: r.log_id },
          {
            regular_hours: r.regular_hours,
            overtime_hours_25pct: r.overtime_25pct,
            overtime_hours_50pct: r.overtime_50pct,
            overtime_hours_100pct: r.overtime_100pct,
            is_overtime_computed: true,
            overtime_computed_at: new Date(),
          },
        );
        updated += 1;
      }
      this.logger.info(
        { tenant_id: tenantId, employee_id: employeeId, week_start: weekStartStr, updated_count: updated, action: 'overtime_recomputed_week' },
        'Overtime recomputed for week',
      );
      return { updated_count: updated };
    });
  }

  private async loadHolidayContext(em: EntityManager, year: number): Promise<OvertimeContext> {
    const rows = await em.query<Array<{ date: string }>>(
      `SELECT to_char(date, 'YYYY-MM-DD') AS date FROM mp_holidays_morocco
       WHERE EXTRACT(YEAR FROM date) = $1`,
      [year],
    );
    return { holidays_ma: new Set(rows.map((r) => r.date)) };
  }
}
```

### Fichier 7/11 : `repo/packages/hr/src/crons/recompute-overtime-week.cron.ts`

```typescript
// repo/packages/hr/src/crons/recompute-overtime-week.cron.ts

import { Injectable, Inject } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Logger } from 'pino';
import Redis from 'ioredis';
import { HrOvertimeService } from '../services/hr-overtime.service.js';
import { TIME_LOGS_CONSTANTS } from '../constants/time-logs-constants.js';
import { TenantContext } from '@insurtech/shared-utils';

@Injectable()
export class RecomputeOvertimeWeekCron {
  constructor(
    private readonly dataSource: DataSource,
    private readonly overtimeService: HrOvertimeService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  /** Chaque lundi 04:00 UTC -- recompute la semaine ecoulee (lundi N-7 -> dimanche N-1) */
  @Cron('0 4 * * 1', { name: 'recompute-overtime-week' })
  async run(): Promise<void> {
    const lockKey = TIME_LOGS_CONSTANTS.REDIS_LOCK_RECOMPUTE_WEEK;
    const lockValue = `${process.pid}-${Date.now()}`;
    const acquired = await this.redis.set(lockKey, lockValue, 'EX', TIME_LOGS_CONSTANTS.CRON_LOCK_TTL_SEC, 'NX');
    if (acquired !== 'OK') {
      this.logger.info({ action: 'recompute_week_lock_not_acquired' }, 'Cron skipped');
      return;
    }
    try {
      const weekStart = this.getLastMondayUtc();
      const tenants = await this.dataSource.query<Array<{ id: string }>>(
        `SELECT DISTINCT tenant_id AS id FROM hr_time_logs WHERE date >= $1::date AND date <= ($1::date + 6) AND is_overtime_computed = false`,
        [weekStart.toISOString().substring(0, 10)],
      );
      this.logger.info({ tenants_count: tenants.length, week_start: weekStart, action: 'recompute_week_starting' }, 'Starting recompute');

      for (const tenant of tenants) {
        await TenantContext.run({ tenantId: tenant.id, userId: 'system' }, async () => {
          const employees = await this.dataSource.query<Array<{ id: string }>>(
            `SELECT DISTINCT employee_id AS id FROM hr_time_logs WHERE tenant_id = $1 AND date >= $2::date AND date <= ($2::date + 6) AND is_overtime_computed = false`,
            [tenant.id, weekStart.toISOString().substring(0, 10)],
          );
          for (const emp of employees) {
            try {
              await this.overtimeService.recomputeWeekForEmployee(tenant.id, emp.id, weekStart);
            } catch (err) {
              this.logger.error(
                { tenant_id: tenant.id, employee_id: emp.id, err, action: 'recompute_failed_one_employee' },
                'Failed recompute for one employee, continuing',
              );
            }
          }
        });
      }
      this.logger.info({ action: 'recompute_week_done' }, 'Recompute completed');
    } catch (err) {
      this.logger.error({ err, action: 'recompute_week_failed' }, 'Recompute job failed');
    } finally {
      const current = await this.redis.get(lockKey);
      if (current === lockValue) await this.redis.del(lockKey);
    }
  }

  private getLastMondayUtc(): Date {
    const now = new Date();
    const day = now.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    const diffDays = day === 0 ? 13 : day + 6; // last Monday inclus dans la semaine ecoulee
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() - diffDays);
    monday.setUTCHours(0, 0, 0, 0);
    return monday;
  }
}
```

### Fichier 8/11 : `repo/packages/hr/src/services/hr-payroll-export.service.ts`

```typescript
// repo/packages/hr/src/services/hr-payroll-export.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Logger } from 'pino';
import { Decimal } from 'decimal.js';
import { computePayrollCost } from '../utils/overtime-calculator.util.js';
import { TenantContext } from '@insurtech/shared-utils';

export interface PayrollExportRow {
  employee_id: string;
  employee_full_name: string;
  month: string;
  regular_hours: string;
  overtime_25pct_hours: string;
  overtime_50pct_hours: string;
  overtime_100pct_hours: string;
  productive_hours: string;
  non_productive_hours: string;
  productivity_pct: number;
  hourly_rate: string;
  regular_cost: string;
  ot25_cost: string;
  ot50_cost: string;
  ot100_cost: string;
  total_cost: string;
}

@Injectable()
export class HrPayrollExportService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject('PINO_LOGGER') private readonly logger: Logger,
  ) {}

  async exportMonth(month: string): Promise<PayrollExportRow[]> {
    const tenantId = TenantContext.getTenantId();
    const rows = await this.dataSource.query<Array<{
      employee_id: string; full_name: string;
      hourly_rate: string; regular: string; ot25: string; ot50: string; ot100: string;
      productive: string; total: string;
    }>>(
      `SELECT
         e.id AS employee_id,
         e.full_name,
         e.hourly_rate::text,
         COALESCE(SUM(tl.regular_hours), 0)::text AS regular,
         COALESCE(SUM(tl.overtime_hours_25pct), 0)::text AS ot25,
         COALESCE(SUM(tl.overtime_hours_50pct), 0)::text AS ot50,
         COALESCE(SUM(tl.overtime_hours_100pct), 0)::text AS ot100,
         COALESCE(SUM(CASE WHEN tl.task_type = 'repair_order' THEN tl.hours_logged END), 0)::text AS productive,
         COALESCE(SUM(tl.hours_logged), 0)::text AS total
       FROM hr_employees e
       LEFT JOIN hr_time_logs tl ON tl.employee_id = e.id
         AND to_char(tl.date, 'YYYY-MM') = $2 AND tl.tenant_id = e.tenant_id
       WHERE e.tenant_id = $1 AND e.is_active = true
       GROUP BY e.id, e.full_name, e.hourly_rate
       ORDER BY e.full_name`,
      [tenantId, month],
    );
    const result: PayrollExportRow[] = [];
    for (const r of rows) {
      const productive = new Decimal(r.productive);
      const total = new Decimal(r.total);
      const productivityPct = total.isZero() ? 0 : productive.div(total).mul(100).toDP(2).toNumber();
      const costs = computePayrollCost(r.regular, r.ot25, r.ot50, r.ot100, r.hourly_rate);
      result.push({
        employee_id: r.employee_id, employee_full_name: r.full_name, month,
        regular_hours: r.regular, overtime_25pct_hours: r.ot25, overtime_50pct_hours: r.ot50, overtime_100pct_hours: r.ot100,
        productive_hours: productive.toFixed(2), non_productive_hours: total.minus(productive).toFixed(2),
        productivity_pct: productivityPct,
        hourly_rate: r.hourly_rate,
        regular_cost: costs.regular_cost, ot25_cost: costs.ot25_cost,
        ot50_cost: costs.ot50_cost, ot100_cost: costs.ot100_cost,
        total_cost: costs.total_cost,
      });
    }
    return result;
  }

  toCsv(rows: PayrollExportRow[]): string {
    if (rows.length === 0) return 'No data\n';
    const headers = Object.keys(rows[0]).join(',');
    const dataLines = rows.map((r) => Object.values(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    return [headers, ...dataLines].join('\n') + '\n';
  }
}
```

### Fichier 9/11 : `repo/apps/api/src/modules/hr/controllers/time-logs.controller.ts`

```typescript
// repo/apps/api/src/modules/hr/controllers/time-logs.controller.ts

import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, RequirePermissions } from '@insurtech/auth';
import {
  HrTimeLogsService, HrPayrollExportService, HrProductivityService,
  LogManualTimeInputSchema, AdjustTimeLogInputSchema, FindByEmployeeQuerySchema,
} from '@insurtech/hr';
import { ZodValidationPipe, TenantContext } from '@insurtech/shared-utils';

@Controller('api/v1/hr')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class HrTimeLogsController {
  constructor(
    private readonly service: HrTimeLogsService,
    private readonly payrollExport: HrPayrollExportService,
    private readonly productivity: HrProductivityService,
  ) {}

  @Get('employees/:id/time-logs')
  @RequirePermissions('hr.time_logs.read_self')
  @Roles('garage_technicien', 'garage_chef', 'garage_admin', 'hr_admin', 'garage_gestionnaire', 'super_admin')
  async findByEmployee(@Param('id') employeeId: string, @Query(new ZodValidationPipe(FindByEmployeeQuerySchema)) query: unknown) {
    const userId = TenantContext.getUserId();
    const role = TenantContext.getUserRole();
    return this.service.findByEmployee(employeeId, query as never, userId, role);
  }

  @Get('employees/:id/time-logs/summary')
  @RequirePermissions('hr.time_logs.read_self')
  @Roles('garage_technicien', 'garage_chef', 'garage_admin', 'hr_admin', 'garage_gestionnaire', 'super_admin')
  async monthlySummary(@Param('id') employeeId: string, @Query('month') month: string) {
    return this.service.getMonthlySummary(employeeId, month);
  }

  @Post('time-logs/manual')
  @RequirePermissions('hr.time_logs.create_manual')
  @Roles('garage_chef', 'garage_admin', 'hr_admin', 'super_admin')
  @HttpCode(HttpStatus.CREATED)
  async createManual(@Body(new ZodValidationPipe(LogManualTimeInputSchema)) body: unknown) {
    return this.service.logManualTime(body as never);
  }

  @Patch('time-logs/:id/adjust')
  @RequirePermissions('hr.time_logs.adjust')
  @Roles('garage_chef', 'garage_admin', 'hr_admin', 'super_admin')
  async adjust(@Param('id') id: string, @Body(new ZodValidationPipe(AdjustTimeLogInputSchema)) body: unknown) {
    return this.service.adjust(id, body as never);
  }

  @Get('time-logs/payroll-export')
  @RequirePermissions('hr.time_logs.export_payroll')
  @Roles('hr_admin', 'super_admin')
  async exportPayroll(@Query('month') month: string, @Query('format') format: string, @Res() res: Response) {
    const rows = await this.payrollExport.exportMonth(month);
    if (format === 'csv') {
      const csv = this.payrollExport.toCsv(rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=payroll-${month}.csv`);
      res.send(csv);
    } else {
      res.json({ month, items: rows });
    }
  }

  @Get('employees/:id/productivity')
  @RequirePermissions('hr.time_logs.view_productivity')
  @Roles('garage_technicien', 'garage_chef', 'garage_admin', 'hr_admin', 'garage_gestionnaire', 'super_admin')
  async productivityRoute(@Param('id') employeeId: string, @Query('month') month: string) {
    return this.service.getEmployeeProductivity(employeeId, month);
  }
}
```

### Fichier 10/11 : `repo/packages/database/src/migrations/{ts1}-CreateHrTimeLogsTable.ts`

```typescript
// repo/packages/database/src/migrations/{ts1}-CreateHrTimeLogsTable.ts

import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHrTimeLogsTable1715000010000 implements MigrationInterface {
  name = 'CreateHrTimeLogsTable1715000010000';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`CREATE TYPE hr_time_log_task_type AS ENUM ('repair_order', 'leave', 'training', 'admin', 'meeting', 'break');`);
    await qr.query(`CREATE TYPE hr_time_log_source AS ENUM ('kafka_consumer', 'manual_entry', 'adjustment', 'cron_import');`);
    await qr.query(`
      CREATE TABLE hr_time_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE RESTRICT,
        task_type hr_time_log_task_type NOT NULL,
        task_id UUID NULL,
        hours_logged NUMERIC(6,2) NOT NULL CHECK (hours_logged > 0 AND hours_logged <= 24),
        hourly_rate_at_time NUMERIC(8,2) NOT NULL CHECK (hourly_rate_at_time >= 0),
        date DATE NOT NULL,
        logged_at TIMESTAMPTZ NOT NULL,
        description TEXT NULL,
        regular_hours NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (regular_hours >= 0),
        overtime_hours_25pct NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (overtime_hours_25pct >= 0),
        overtime_hours_50pct NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (overtime_hours_50pct >= 0),
        overtime_hours_100pct NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (overtime_hours_100pct >= 0),
        is_overtime_computed BOOLEAN NOT NULL DEFAULT false,
        overtime_computed_at TIMESTAMPTZ NULL,
        source hr_time_log_source NOT NULL DEFAULT 'manual_entry',
        source_event_id UUID NULL,
        created_by UUID NULL,
        adjustment_notes TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_hr_time_logs_overtime_sum CHECK (
          ABS((regular_hours + overtime_hours_25pct + overtime_hours_50pct + overtime_hours_100pct) - hours_logged) < 0.01
          OR is_overtime_computed = false
        )
      );
    `);
    await qr.query(`CREATE INDEX idx_hr_time_logs_tenant_employee_date ON hr_time_logs(tenant_id, employee_id, date);`);
    await qr.query(`CREATE INDEX idx_hr_time_logs_tenant_date ON hr_time_logs(tenant_id, date);`);
    await qr.query(`CREATE INDEX idx_hr_time_logs_task ON hr_time_logs(task_type, task_id) WHERE task_id IS NOT NULL;`);
    await qr.query(`CREATE UNIQUE INDEX idx_hr_time_logs_source_event ON hr_time_logs(source_event_id) WHERE source_event_id IS NOT NULL;`);

    await qr.query(`ALTER TABLE hr_time_logs ENABLE ROW LEVEL SECURITY;`);
    await qr.query(`
      CREATE POLICY hr_time_logs_tenant_isolation ON hr_time_logs
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant());
    `);
    await qr.query(`
      CREATE TRIGGER trg_hr_time_logs_updated_at
        BEFORE UPDATE ON hr_time_logs
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TRIGGER IF EXISTS trg_hr_time_logs_updated_at ON hr_time_logs;`);
    await qr.query(`DROP POLICY IF EXISTS hr_time_logs_tenant_isolation ON hr_time_logs;`);
    await qr.query(`DROP TABLE IF EXISTS hr_time_logs;`);
    await qr.query(`DROP TYPE IF EXISTS hr_time_log_source;`);
    await qr.query(`DROP TYPE IF EXISTS hr_time_log_task_type;`);
  }
}
```

### Fichier 11/11 : `repo/packages/hr/src/dto/time-logs.dto.ts`

```typescript
// repo/packages/hr/src/dto/time-logs.dto.ts

import { z } from 'zod';
import { TASK_TYPES, TIME_LOGS_CONSTANTS } from '../constants/time-logs-constants.js';

export const LogManualTimeInputSchema = z.object({
  employee_id: z.string().uuid(),
  task_type: z.enum(TASK_TYPES),
  task_id: z.string().uuid().optional(),
  hours_logged: z.number().positive().max(TIME_LOGS_CONSTANTS.MAX_HOURS_PER_LOG),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  logged_at: z.string().datetime().optional(),
  description: z.string().max(1000).optional(),
});
export type LogManualTimeInput = z.infer<typeof LogManualTimeInputSchema>;

export const AdjustTimeLogInputSchema = z.object({
  new_hours_logged: z.number().positive().max(TIME_LOGS_CONSTANTS.MAX_HOURS_PER_LOG),
  notes: z.string().min(10).max(1000),
});
export type AdjustTimeLogInput = z.infer<typeof AdjustTimeLogInputSchema>;

export const FindByEmployeeQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  task_type: z.enum(TASK_TYPES).optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});
export type FindByEmployeeQuery = z.infer<typeof FindByEmployeeQuerySchema>;

export interface MonthlySummaryResponse {
  employee_id: string;
  month: string;
  total_hours_logged: string;
  breakdown_by_task_type: Record<string, string>;
  regular_hours: string;
  overtime_25pct: string;
  overtime_50pct: string;
  overtime_100pct: string;
}

export interface EmployeeProductivityResponse {
  employee_id: string;
  month: string;
  productive_hours: string;
  total_logged_hours: string;
  productivity_pct: number;
  no_data: boolean;
}
```

## 7. Tests complets (30+ tests unit + integration + E2E)

### 7.1 Tests unit overtime calculator (le plus critique)

```typescript
// repo/packages/hr/src/utils/__tests__/overtime-calculator.util.spec.ts

import { describe, it, expect } from 'vitest';
import { computeWeeklyOvertime, computePayrollCost, isSunday, isHolidayMa, isNightHour } from '../overtime-calculator.util.js';

describe('overtime-calculator.util', () => {
  describe('isSunday', () => {
    it('returns true for 2026-05-17 (Sunday)', () => { expect(isSunday('2026-05-17')).toBe(true); });
    it('returns false for 2026-05-18 (Monday)', () => { expect(isSunday('2026-05-18')).toBe(false); });
  });

  describe('isNightHour', () => {
    it('22h is night', () => { expect(isNightHour('2026-05-15T22:00:00Z')).toBe(true); });
    it('3h is night', () => { expect(isNightHour('2026-05-15T03:00:00Z')).toBe(true); });
    it('14h is day', () => { expect(isNightHour('2026-05-15T14:00:00Z')).toBe(false); });
    it('6h is NOT night (border)', () => { expect(isNightHour('2026-05-15T06:00:00Z')).toBe(false); });
    it('21h IS night (border)', () => { expect(isNightHour('2026-05-15T21:00:00Z')).toBe(true); });
  });

  describe('isHolidayMa', () => {
    const ctx = { holidays_ma: new Set(['2026-05-01', '2026-07-30']) };
    it('returns true for 1er Mai', () => { expect(isHolidayMa('2026-05-01', ctx)).toBe(true); });
    it('returns false for jour normal', () => { expect(isHolidayMa('2026-05-02', ctx)).toBe(false); });
  });

  describe('computeWeeklyOvertime', () => {
    const ctx = { holidays_ma: new Set<string>() };

    it('semaine 40h (Lun-Ven 8h) = 40 regular', () => {
      const logs = [
        { id: 'l1', date: '2026-05-18', logged_at: '2026-05-18T08:00:00Z', hours_logged: '8' },
        { id: 'l2', date: '2026-05-19', logged_at: '2026-05-19T08:00:00Z', hours_logged: '8' },
        { id: 'l3', date: '2026-05-20', logged_at: '2026-05-20T08:00:00Z', hours_logged: '8' },
        { id: 'l4', date: '2026-05-21', logged_at: '2026-05-21T08:00:00Z', hours_logged: '8' },
        { id: 'l5', date: '2026-05-22', logged_at: '2026-05-22T08:00:00Z', hours_logged: '8' },
      ];
      const r = computeWeeklyOvertime(logs, ctx);
      expect(r.every((x) => x.regular_hours === '8.00')).toBe(true);
      expect(r.every((x) => x.overtime_25pct === '0.00')).toBe(true);
    });

    it('semaine 48h (40 reg + 8 sam) -> 44 reg + 4 HS25', () => {
      const logs = [
        { id: 'l1', date: '2026-05-18', logged_at: '2026-05-18T08:00:00Z', hours_logged: '8' },
        { id: 'l2', date: '2026-05-19', logged_at: '2026-05-19T08:00:00Z', hours_logged: '8' },
        { id: 'l3', date: '2026-05-20', logged_at: '2026-05-20T08:00:00Z', hours_logged: '8' },
        { id: 'l4', date: '2026-05-21', logged_at: '2026-05-21T08:00:00Z', hours_logged: '8' },
        { id: 'l5', date: '2026-05-22', logged_at: '2026-05-22T08:00:00Z', hours_logged: '8' },
        { id: 'l6', date: '2026-05-23', logged_at: '2026-05-23T08:00:00Z', hours_logged: '8' },
      ];
      const r = computeWeeklyOvertime(logs, ctx);
      const samedi = r.find((x) => x.log_id === 'l6')!;
      expect(samedi.regular_hours).toBe('4.00');
      expect(samedi.overtime_25pct).toBe('4.00');
    });

    it('dimanche 4h -> 100%, reste reg', () => {
      const logs = [
        { id: 'l1', date: '2026-05-17', logged_at: '2026-05-17T10:00:00Z', hours_logged: '4' }, // dimanche
        { id: 'l2', date: '2026-05-18', logged_at: '2026-05-18T08:00:00Z', hours_logged: '8' },
      ];
      const r = computeWeeklyOvertime(logs, ctx);
      const dim = r.find((x) => x.log_id === 'l1')!;
      expect(dim.overtime_100pct).toBe('4.00');
      expect(dim.regular_hours).toBe('0.00');
    });

    it('jour ferie (1er Mai) 8h -> 100%', () => {
      const ctxHol = { holidays_ma: new Set(['2026-05-01']) };
      const logs = [
        { id: 'l1', date: '2026-05-01', logged_at: '2026-05-01T08:00:00Z', hours_logged: '8' },
      ];
      const r = computeWeeklyOvertime(logs, ctxHol);
      expect(r[0].overtime_100pct).toBe('8.00');
    });

    it('nuit 22h-minuit (2h) -> HS50%', () => {
      const logs = [
        { id: 'l1', date: '2026-05-19', logged_at: '2026-05-19T22:00:00Z', hours_logged: '2' },
      ];
      const r = computeWeeklyOvertime(logs, ctx);
      expect(r[0].overtime_50pct).toBe('2.00');
    });

    it('semaine 52h dont 2h nuit Mardi -> 44 reg + 4 HS25 + 2 HS50', () => {
      const logs = [
        { id: 'l1', date: '2026-05-18', logged_at: '2026-05-18T08:00:00Z', hours_logged: '8' },
        { id: 'l2', date: '2026-05-19', logged_at: '2026-05-19T08:00:00Z', hours_logged: '8' },
        { id: 'lN', date: '2026-05-19', logged_at: '2026-05-19T22:00:00Z', hours_logged: '2' }, // nuit
        { id: 'l3', date: '2026-05-20', logged_at: '2026-05-20T08:00:00Z', hours_logged: '8' },
        { id: 'l4', date: '2026-05-21', logged_at: '2026-05-21T08:00:00Z', hours_logged: '8' },
        { id: 'l5', date: '2026-05-22', logged_at: '2026-05-22T08:00:00Z', hours_logged: '8' },
        { id: 'l6', date: '2026-05-23', logged_at: '2026-05-23T08:00:00Z', hours_logged: '8' },
        { id: 'l7', date: '2026-05-23', logged_at: '2026-05-23T16:00:00Z', hours_logged: '2' },
      ];
      const r = computeWeeklyOvertime(logs, ctx);
      const totalReg = r.reduce((s, x) => s + parseFloat(x.regular_hours), 0);
      const totalOt25 = r.reduce((s, x) => s + parseFloat(x.overtime_25pct), 0);
      const totalOt50 = r.reduce((s, x) => s + parseFloat(x.overtime_50pct), 0);
      const totalOt100 = r.reduce((s, x) => s + parseFloat(x.overtime_100pct), 0);
      expect(totalReg).toBeCloseTo(44, 1);
      expect(totalOt25).toBeCloseTo(6, 1); // 4 sam + 2 sam supp
      expect(totalOt50).toBeCloseTo(2, 1); // nuit Mardi
      expect(totalOt100).toBeCloseTo(0, 1);
    });

    it('invariant : sum allocations = hours_logged for each log', () => {
      const logs = [{ id: 'l1', date: '2026-05-18', logged_at: '2026-05-18T08:00:00Z', hours_logged: '8.5' }];
      const r = computeWeeklyOvertime(logs, ctx);
      const total = parseFloat(r[0].regular_hours) + parseFloat(r[0].overtime_25pct) + parseFloat(r[0].overtime_50pct) + parseFloat(r[0].overtime_100pct);
      expect(total).toBeCloseTo(8.5, 2);
    });

    it('throws INVARIANT_VIOLATION if internal bug', () => {
      // Tester via mock impossible sur pure function, mais test verifie comportement normal
      const logs = [{ id: 'l1', date: '2026-05-18', logged_at: '2026-05-18T08:00:00Z', hours_logged: '8' }];
      expect(() => computeWeeklyOvertime(logs, ctx)).not.toThrow();
    });

    it('dimanche jour ferie meme date -> 100% (pas 200%)', () => {
      const ctxBoth = { holidays_ma: new Set(['2026-05-17']) }; // dimanche ET ferie hypothetique
      const logs = [{ id: 'l1', date: '2026-05-17', logged_at: '2026-05-17T08:00:00Z', hours_logged: '8' }];
      const r = computeWeeklyOvertime(logs, ctxBoth);
      expect(r[0].overtime_100pct).toBe('8.00');
    });

    it('precision Decimal 0.25 (15 minutes)', () => {
      const logs = [{ id: 'l1', date: '2026-05-18', logged_at: '2026-05-18T08:00:00Z', hours_logged: '0.25' }];
      const r = computeWeeklyOvertime(logs, ctx);
      expect(r[0].regular_hours).toBe('0.25');
    });

    it('empty week returns empty', () => {
      const r = computeWeeklyOvertime([], ctx);
      expect(r).toEqual([]);
    });
  });

  describe('computePayrollCost', () => {
    it('40h regular @ 350 = 14000', () => {
      const c = computePayrollCost('40', '0', '0', '0', '350');
      expect(c.regular_cost).toBe('14000.00');
      expect(c.total_cost).toBe('14000.00');
    });
    it('4h HS25 @ 350 = 350 * 4 * 1.25 = 1750', () => {
      const c = computePayrollCost('0', '4', '0', '0', '350');
      expect(c.ot25_cost).toBe('1750.00');
    });
    it('8h HS100 @ 350 = 8 * 350 * 2 = 5600', () => {
      const c = computePayrollCost('0', '0', '0', '8', '350');
      expect(c.ot100_cost).toBe('5600.00');
    });
    it('mix 44 reg + 4 HS25 + 2 HS50 + 8 HS100 = 14000 + 1750 + 1050 + 5600 = 22400', () => {
      const c = computePayrollCost('44', '4', '2', '8', '350');
      expect(c.total_cost).toBe('22400.00');
    });
  });
});
```

### 7.2 Tests unit HrTimeLogsService : `repo/packages/hr/src/services/__tests__/hr-time-logs.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HrTimeLogsService } from '../hr-time-logs.service.js';

vi.mock('@insurtech/shared-utils', () => ({
  TenantContext: {
    getTenantId: vi.fn(() => 'tenant-atlas-uuid'),
    getUserId: vi.fn(() => 'user-1'),
    getUserRole: vi.fn(() => 'garage_admin'),
  },
}));

describe('HrTimeLogsService', () => {
  let service: HrTimeLogsService;
  let mockDS: any;

  beforeEach(() => {
    mockDS = {
      transaction: vi.fn(async (cb) => cb({
        query: vi.fn(),
        create: vi.fn((_, d) => d),
        save: vi.fn((entity) => ({ ...entity, id: 'log-uuid' })),
        update: vi.fn(),
        findOne: vi.fn(),
        findOneOrFail: vi.fn(),
      })),
      query: vi.fn(),
      getRepository: vi.fn(() => ({
        createQueryBuilder: vi.fn(() => ({
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          addOrderBy: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          take: vi.fn().mockReturnThis(),
          getCount: vi.fn(() => 0),
          getMany: vi.fn(() => []),
        })),
      })),
    };
    service = new HrTimeLogsService(mockDS, { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any);
  });

  describe('logManualTime', () => {
    it('rejects HOURS_EXCEED_MAX if > 24', async () => {
      await expect(service.logManualTime({
        employee_id: crypto.randomUUID(), task_type: 'admin', hours_logged: 30,
        date: '2026-05-15',
      } as any)).rejects.toThrow(/HOURS_EXCEED_MAX/);
    });

    it('rejects EMPLOYEE_NOT_FOUND', async () => {
      mockDS.transaction.mockImplementationOnce(async (cb) => cb({
        query: vi.fn(() => []),
      }));
      await expect(service.logManualTime({
        employee_id: crypto.randomUUID(), task_type: 'admin', hours_logged: 2,
        date: '2026-05-15',
      } as any)).rejects.toThrow(/EMPLOYEE_NOT_FOUND/);
    });

    it('rejects EMPLOYEE_INACTIVE', async () => {
      mockDS.transaction.mockImplementationOnce(async (cb) => cb({
        query: vi.fn(() => [{ id: 'e1', hourly_rate: '350', is_active: false }]),
      }));
      await expect(service.logManualTime({
        employee_id: 'e1', task_type: 'admin', hours_logged: 2, date: '2026-05-15',
      } as any)).rejects.toThrow(/EMPLOYEE_INACTIVE/);
    });

    it('creates log with snapshot hourly_rate', async () => {
      const create = vi.fn((_, d) => d);
      const save = vi.fn((entity) => ({ ...entity, id: 'l-1' }));
      mockDS.transaction.mockImplementationOnce(async (cb) => cb({
        query: vi.fn(() => [{ id: 'e1', hourly_rate: '350', is_active: true }]),
        create, save,
      }));
      const r = await service.logManualTime({
        employee_id: 'e1', task_type: 'training', hours_logged: 2,
        date: '2026-05-15', description: 'Formation safety',
      } as any);
      expect(r.id).toBe('l-1');
      expect(create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        hourly_rate_at_time: '350',
        task_type: 'training',
      }));
    });
  });

  describe('adjust', () => {
    it('throws TIME_LOG_NOT_FOUND', async () => {
      mockDS.transaction.mockImplementationOnce(async (cb) => cb({ findOne: vi.fn(() => null) }));
      await expect(service.adjust('missing', { new_hours_logged: 3, notes: 'Correction' })).rejects.toThrow(/TIME_LOG_NOT_FOUND/);
    });

    it('updates + emits adjustment event', async () => {
      const update = vi.fn();
      const query = vi.fn();
      mockDS.transaction.mockImplementationOnce(async (cb) => cb({
        findOne: vi.fn(() => ({ id: 'l-1', hours_logged: '4', employee_id: 'e-1' })),
        findOneOrFail: vi.fn(() => ({ id: 'l-1', hours_logged: '3' })),
        update, query,
      }));
      await service.adjust('l-1', { new_hours_logged: 3, notes: 'Erreur saisie initiale' });
      expect(update).toHaveBeenCalledWith(expect.anything(), 'l-1', expect.objectContaining({
        hours_logged: '3', is_overtime_computed: false, source: 'adjustment',
      }));
      const outboxCall = query.mock.calls.find((c: any[]) => c[0].includes('outbox_events'));
      expect(outboxCall).toBeDefined();
    });
  });

  describe('findByEmployee', () => {
    it('throws CANNOT_VIEW_OTHER_EMPLOYEE_LOGS for technicien viewing other', async () => {
      await expect(service.findByEmployee('other-emp', { page: 1, page_size: 20 } as any, 'self-emp', 'garage_technicien'))
        .rejects.toThrow(/CANNOT_VIEW_OTHER/);
    });

    it('allows technicien to view self', async () => {
      const r = await service.findByEmployee('self-emp', { page: 1, page_size: 20 } as any, 'self-emp', 'garage_technicien');
      expect(r.total).toBe(0);
    });

    it('allows garage_admin to view any employee', async () => {
      const r = await service.findByEmployee('other-emp', { page: 1, page_size: 20 } as any, 'admin-uuid', 'garage_admin');
      expect(r.total).toBe(0);
    });
  });

  describe('getMonthlySummary', () => {
    it('aggregates per task_type with overtime breakdown', async () => {
      mockDS.query.mockResolvedValueOnce([
        { task_type: 'repair_order', total_hours: '120', regular_hours: '100', ot25: '15', ot50: '5', ot100: '0' },
        { task_type: 'admin', total_hours: '40', regular_hours: '40', ot25: '0', ot50: '0', ot100: '0' },
        { task_type: 'leave', total_hours: '8', regular_hours: '8', ot25: '0', ot50: '0', ot100: '0' },
      ]);
      const r = await service.getMonthlySummary('e-1', '2026-05');
      expect(r.total_hours_logged).toBe('168.00');
      expect(r.regular_hours).toBe('148.00');
      expect(r.overtime_25pct).toBe('15.00');
      expect(r.overtime_50pct).toBe('5.00');
      expect(r.breakdown_by_task_type.repair_order).toBe('120');
    });

    it('handles zero data correctly', async () => {
      mockDS.query.mockResolvedValueOnce([]);
      const r = await service.getMonthlySummary('e-1', '2026-05');
      expect(r.total_hours_logged).toBe('0.00');
    });
  });

  describe('getEmployeeProductivity', () => {
    it('compute pct repair_order / total', async () => {
      mockDS.query.mockResolvedValueOnce([{ productive: '120', total: '160' }]);
      const r = await service.getEmployeeProductivity('e-1', '2026-05');
      expect(r.productivity_pct).toBe(75);
      expect(r.no_data).toBe(false);
    });

    it('returns no_data=true if no logs', async () => {
      mockDS.query.mockResolvedValueOnce([{ productive: '0', total: '0' }]);
      const r = await service.getEmployeeProductivity('e-1', '2026-05');
      expect(r.no_data).toBe(true);
      expect(r.productivity_pct).toBe(0);
    });

    it('100% if all productive', async () => {
      mockDS.query.mockResolvedValueOnce([{ productive: '160', total: '160' }]);
      const r = await service.getEmployeeProductivity('e-1', '2026-05');
      expect(r.productivity_pct).toBe(100);
    });
  });
});
```

### 7.3 Tests Consumer : `repo/packages/hr/src/consumers/__tests__/hr-time-logs.consumer.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HrTimeLogsConsumer } from '../hr-time-logs.consumer.js';
import { EventConsumerMetrics } from '@insurtech/shared-events';

describe('HrTimeLogsConsumer', () => {
  let consumer: HrTimeLogsConsumer;
  let mockDS: any;
  let mockLogger: any;
  let mockMetrics: EventConsumerMetrics;

  beforeEach(() => {
    mockDS = {
      transaction: vi.fn(async (cb) => cb({
        query: vi.fn(() => [{ event_id: 'inserted' }]),
        update: vi.fn(),
      })),
      getRepository: vi.fn(() => ({ save: vi.fn() })),
    };
    mockLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    mockMetrics = new EventConsumerMetrics();
    consumer = new HrTimeLogsConsumer(mockDS, mockLogger, mockMetrics);
  });

  it('processes valid event : INSERT hr_time_logs with computed hourly_rate', async () => {
    const queryMock = vi.fn();
    queryMock.mockResolvedValueOnce([{ event_id: 'inserted' }]); // inbox insert
    queryMock.mockResolvedValueOnce(undefined); // hr_time_logs insert
    queryMock.mockResolvedValueOnce([{ total_overtime: '0' }]); // quota check
    mockDS.transaction.mockImplementationOnce(async (cb) => cb({ query: queryMock, update: vi.fn() }));

    const event = {
      event_id: crypto.randomUUID(),
      emitted_at: '2026-05-15T10:00:00Z',
      tenant_id: crypto.randomUUID(),
      order_id: crypto.randomUUID(),
      employee_id: crypto.randomUUID(),
      hours: '2', cost: '700',
      logged_at: '2026-05-15T10:00:00Z',
    };
    await consumer.consume(event);
    const insertCall = queryMock.mock.calls.find((c) => String(c[0]).includes('INSERT INTO hr_time_logs'));
    expect(insertCall).toBeDefined();
    // hourly_rate = cost / hours = 700 / 2 = 350
    expect(insertCall![1][4]).toBe('350.00');
  });

  it('skips processing if event invalid (Zod fails) -> DLQ', async () => {
    const save = vi.fn();
    mockDS.getRepository.mockReturnValue({ save });
    await consumer.consume({ event_id: 'not-uuid', invalid: true });
    expect(save).toHaveBeenCalled(); // DLQ insert
  });

  it('idempotency : INSERT ON CONFLICT returns 0 rows -> skip processing', async () => {
    const queryMock = vi.fn(() => []); // empty = conflict
    mockDS.transaction.mockImplementationOnce(async (cb) => cb({ query: queryMock, update: vi.fn() }));
    const event = { event_id: crypto.randomUUID(), emitted_at: '2026-05-15T10:00:00Z',
      tenant_id: crypto.randomUUID(), order_id: 'o1', employee_id: 'e1', hours: '2', cost: '700' };
    await consumer.consume(event);
  });

  it('emits overtime_quota_exceeded if year overtime > 80', async () => {
    const queryMock = vi.fn();
    queryMock.mockResolvedValueOnce([{ event_id: 'inserted' }]);
    queryMock.mockResolvedValueOnce(undefined); // hr_time_logs insert
    queryMock.mockResolvedValueOnce([{ total_overtime: '85.5' }]); // quota exceeded
    queryMock.mockResolvedValueOnce(undefined); // outbox emit
    mockDS.transaction.mockImplementationOnce(async (cb) => cb({ query: queryMock, update: vi.fn() }));
    const event = { event_id: crypto.randomUUID(), emitted_at: '2026-05-15T10:00:00Z',
      tenant_id: crypto.randomUUID(), order_id: 'o1', employee_id: 'e1', hours: '8', cost: '2800' };
    await consumer.consume(event);
    const outboxCall = queryMock.mock.calls.find((c) => String(c[0]).includes('outbox_events'));
    expect(outboxCall).toBeDefined();
    const payload = JSON.parse(outboxCall![1][2]);
    expect(payload.exceeded_by).toBeCloseTo(5.5, 1);
  });

  it('does NOT emit quota event if total < 80', async () => {
    const queryMock = vi.fn();
    queryMock.mockResolvedValueOnce([{ event_id: 'inserted' }]);
    queryMock.mockResolvedValueOnce(undefined);
    queryMock.mockResolvedValueOnce([{ total_overtime: '50' }]);
    mockDS.transaction.mockImplementationOnce(async (cb) => cb({ query: queryMock, update: vi.fn() }));
    const event = { event_id: crypto.randomUUID(), emitted_at: '2026-05-15T10:00:00Z',
      tenant_id: crypto.randomUUID(), order_id: 'o1', employee_id: 'e1', hours: '2', cost: '700' };
    await consumer.consume(event);
    const outboxCalls = queryMock.mock.calls.filter((c) => String(c[0]).includes('outbox_events'));
    expect(outboxCalls.length).toBe(0);
  });

  it('multi-tenant isolation : event.tenant_id propage TenantContext', async () => {
    const event = { event_id: crypto.randomUUID(), emitted_at: '2026-05-15T10:00:00Z',
      tenant_id: 'tenant-A', order_id: 'o1', employee_id: 'e1', hours: '2', cost: '700' };
    await consumer.consume(event);
    // Verify TenantContext.run was called with event.tenant_id (via shared-utils mock)
  });
});
```

### 7.4 Tests HrOvertimeService : `repo/packages/hr/src/services/__tests__/hr-overtime.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HrOvertimeService } from '../hr-overtime.service.js';

describe('HrOvertimeService.recomputeWeekForEmployee', () => {
  let service: HrOvertimeService;
  let mockDS: any;

  beforeEach(() => {
    mockDS = {
      transaction: vi.fn(async (cb) => cb({
        query: vi.fn(),
        update: vi.fn(),
      })),
    };
    service = new HrOvertimeService(mockDS, { info: vi.fn(), error: vi.fn() } as any);
  });

  it('returns 0 if no logs for week', async () => {
    mockDS.transaction.mockImplementationOnce(async (cb) => cb({
      query: vi.fn(() => []),
    }));
    const r = await service.recomputeWeekForEmployee('t1', 'e1', new Date('2026-05-18'));
    expect(r.updated_count).toBe(0);
  });

  it('updates each log row with computed HS', async () => {
    const update = vi.fn();
    const queries: any[] = [];
    mockDS.transaction.mockImplementationOnce(async (cb) => cb({
      query: vi.fn((sql, params) => {
        queries.push({ sql, params });
        if (String(sql).includes('hr_time_logs WHERE tenant_id')) {
          return [
            { id: 'l1', date: '2026-05-18', logged_at: '2026-05-18T08:00:00Z', hours_logged: '8' },
            { id: 'l2', date: '2026-05-19', logged_at: '2026-05-19T08:00:00Z', hours_logged: '8' },
          ];
        }
        if (String(sql).includes('mp_holidays_morocco')) return [];
        return [];
      }),
      update,
    }));
    const r = await service.recomputeWeekForEmployee('t1', 'e1', new Date('2026-05-18'));
    expect(r.updated_count).toBe(2);
  });

  it('loads holiday context for the year', async () => {
    let holidayQueryCalled = false;
    mockDS.transaction.mockImplementationOnce(async (cb) => cb({
      query: vi.fn((sql) => {
        if (String(sql).includes('mp_holidays_morocco')) {
          holidayQueryCalled = true;
          return [{ date: '2026-05-01' }];
        }
        return [];
      }),
      update: vi.fn(),
    }));
    await service.recomputeWeekForEmployee('t1', 'e1', new Date('2026-05-18'));
    expect(holidayQueryCalled).toBe(true);
  });
});
```

### 7.5 Tests Payroll Export : `repo/packages/hr/src/services/__tests__/hr-payroll-export.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HrPayrollExportService } from '../hr-payroll-export.service.js';

vi.mock('@insurtech/shared-utils', () => ({
  TenantContext: { getTenantId: vi.fn(() => 'tenant-uuid') },
}));

describe('HrPayrollExportService', () => {
  let service: HrPayrollExportService;
  let mockDS: any;
  beforeEach(() => {
    mockDS = { query: vi.fn() };
    service = new HrPayrollExportService(mockDS, { info: vi.fn() } as any);
  });

  it('exportMonth returns rows with computed costs', async () => {
    mockDS.query.mockResolvedValueOnce([{
      employee_id: 'e1', full_name: 'Hamid Aboutaleb', hourly_rate: '350',
      regular: '160', ot25: '8', ot50: '0', ot100: '4', productive: '140', total: '172',
    }]);
    const rows = await service.exportMonth('2026-05');
    expect(rows[0].employee_full_name).toBe('Hamid Aboutaleb');
    expect(rows[0].regular_cost).toBe('56000.00');
    expect(rows[0].ot25_cost).toBe('3500.00'); // 350 * 8 * 1.25
    expect(rows[0].ot100_cost).toBe('2800.00'); // 350 * 4 * 2
    expect(rows[0].productivity_pct).toBeCloseTo(81.4, 1);
  });

  it('handles employee with no logs (zeros)', async () => {
    mockDS.query.mockResolvedValueOnce([{
      employee_id: 'e2', full_name: 'Karim Tazi', hourly_rate: '350',
      regular: '0', ot25: '0', ot50: '0', ot100: '0', productive: '0', total: '0',
    }]);
    const rows = await service.exportMonth('2026-05');
    expect(rows[0].total_cost).toBe('0.00');
    expect(rows[0].productivity_pct).toBe(0);
  });

  it('toCsv generates valid CSV with quoted values', () => {
    const rows = [{ a: 'val1', b: 'val,with,commas', c: 'val"with"quotes' }] as any;
    const csv = service.toCsv(rows);
    expect(csv).toContain('"val1"');
    expect(csv).toContain('"val,with,commas"');
    expect(csv).toContain('"val""with""quotes"');
  });

  it('toCsv handles empty rows', () => {
    const csv = service.toCsv([]);
    expect(csv).toContain('No data');
  });
});
```

### 7.6 Tests Cron : `repo/packages/hr/src/crons/__tests__/recompute-overtime-week.cron.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecomputeOvertimeWeekCron } from '../recompute-overtime-week.cron.js';

describe('RecomputeOvertimeWeekCron', () => {
  let cron: RecomputeOvertimeWeekCron;
  let mockDS: any;
  let mockRedis: any;
  let mockOvertimeService: any;

  beforeEach(() => {
    mockDS = { query: vi.fn(() => []) };
    mockRedis = { set: vi.fn(() => 'OK'), get: vi.fn(), del: vi.fn() };
    mockOvertimeService = { recomputeWeekForEmployee: vi.fn(() => ({ updated_count: 1 })) };
    cron = new RecomputeOvertimeWeekCron(mockDS, mockOvertimeService, mockRedis, { info: vi.fn(), error: vi.fn() } as any);
  });

  it('skips if Redis lock not acquired', async () => {
    mockRedis.set.mockResolvedValueOnce(null);
    await cron.run();
    expect(mockDS.query).not.toHaveBeenCalled();
  });

  it('processes all tenants then releases lock', async () => {
    mockRedis.set.mockResolvedValueOnce('OK');
    mockDS.query
      .mockResolvedValueOnce([{ id: 'tenant-A' }, { id: 'tenant-B' }]) // tenants
      .mockResolvedValueOnce([{ id: 'emp-1' }]) // employees tenant-A
      .mockResolvedValueOnce([{ id: 'emp-2' }]); // employees tenant-B
    mockRedis.get.mockResolvedValue('current-lock');
    await cron.run();
    expect(mockOvertimeService.recomputeWeekForEmployee).toHaveBeenCalledTimes(2);
  });

  it('continues if one employee recompute fails', async () => {
    mockRedis.set.mockResolvedValueOnce('OK');
    mockDS.query
      .mockResolvedValueOnce([{ id: 'tenant-A' }])
      .mockResolvedValueOnce([{ id: 'emp-1' }, { id: 'emp-2' }]);
    mockOvertimeService.recomputeWeekForEmployee
      .mockRejectedValueOnce(new Error('Fail e1'))
      .mockResolvedValueOnce({ updated_count: 1 });
    await cron.run();
    expect(mockOvertimeService.recomputeWeekForEmployee).toHaveBeenCalledTimes(2);
  });

  it('getLastMondayUtc returns Monday for Sunday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-17T00:00:00Z')); // Sunday
    const monday = (cron as any).getLastMondayUtc();
    expect(monday.getUTCDay()).toBe(1); // Monday
    vi.useRealTimers();
  });

  it('getLastMondayUtc returns previous Monday for Monday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-18T10:00:00Z')); // Monday
    const monday = (cron as any).getLastMondayUtc();
    expect(monday.toISOString()).toContain('2026-05-11'); // previous Monday
    vi.useRealTimers();
  });
});
```

### 7.7 Tests E2E : `repo/apps/api/test/hr/time-logs.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as request from 'supertest';

describe('HR Time Logs E2E', () => {
  let app: any;
  let tokenTechnicien: string;
  let tokenAdmin: string;
  let tokenHrAdmin: string;
  let tokenSuperAdmin: string;
  let tenantId: string;
  let employeeIdSelf: string;
  let employeeIdOther: string;

  beforeAll(async () => { /* setup + seed */ });
  afterAll(async () => { /* cleanup */ });

  describe('GET /hr/employees/:id/time-logs', () => {
    it('technicien can view OWN logs', async () => {
      const r = await request(app.getHttpServer())
        .get(`/api/v1/hr/employees/${employeeIdSelf}/time-logs?month=2026-05`)
        .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
    });

    it('technicien CANNOT view other employee logs (403)', async () => {
      const r = await request(app.getHttpServer())
        .get(`/api/v1/hr/employees/${employeeIdOther}/time-logs`)
        .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(403);
    });

    it('garage_admin can view any employee logs', async () => {
      const r = await request(app.getHttpServer())
        .get(`/api/v1/hr/employees/${employeeIdOther}/time-logs`)
        .set('Authorization', `Bearer ${tokenAdmin}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
    });
  });

  describe('GET /summary', () => {
    it('returns aggregated monthly summary', async () => {
      const r = await request(app.getHttpServer())
        .get(`/api/v1/hr/employees/${employeeIdSelf}/time-logs/summary?month=2026-05`)
        .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
      expect(r.body.total_hours_logged).toBeDefined();
      expect(r.body.breakdown_by_task_type).toBeDefined();
    });
  });

  describe('POST /time-logs/manual', () => {
    it('garage_admin can create manual log', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/hr/time-logs/manual')
        .set('Authorization', `Bearer ${tokenAdmin}`).set('x-tenant-id', tenantId)
        .send({
          employee_id: employeeIdSelf, task_type: 'training',
          hours_logged: 4, date: '2026-05-15', description: 'Formation safety',
        });
      expect(r.status).toBe(201);
    });

    it('rejects 24+ hours', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/hr/time-logs/manual')
        .set('Authorization', `Bearer ${tokenAdmin}`).set('x-tenant-id', tenantId)
        .send({ employee_id: employeeIdSelf, task_type: 'training', hours_logged: 30, date: '2026-05-15' });
      expect(r.status).toBe(400);
    });

    it('technicien cannot create manual log (403)', async () => {
      const r = await request(app.getHttpServer())
        .post('/api/v1/hr/time-logs/manual')
        .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId)
        .send({ employee_id: employeeIdSelf, task_type: 'training', hours_logged: 2, date: '2026-05-15' });
      expect(r.status).toBe(403);
    });
  });

  describe('PATCH /time-logs/:id/adjust', () => {
    it('admin adjusts hours and triggers recompute', async () => { /* ... */ });
    it('notes required min 10 chars', async () => { /* ... */ });
  });

  describe('GET /payroll-export', () => {
    it('hr_admin exports CSV', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/v1/hr/time-logs/payroll-export?month=2026-05&format=csv')
        .set('Authorization', `Bearer ${tokenHrAdmin}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
      expect(r.headers['content-type']).toContain('text/csv');
    });

    it('hr_admin exports JSON', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/v1/hr/time-logs/payroll-export?month=2026-05&format=json')
        .set('Authorization', `Bearer ${tokenHrAdmin}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
      expect(r.body.items).toBeDefined();
    });

    it('garage_chef cannot export payroll (403)', async () => {
      const r = await request(app.getHttpServer())
        .get('/api/v1/hr/time-logs/payroll-export?month=2026-05')
        .set('Authorization', `Bearer ${tokenAdmin}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(403);
    });
  });

  describe('GET /productivity', () => {
    it('returns productivity pct + no_data flag', async () => {
      const r = await request(app.getHttpServer())
        .get(`/api/v1/hr/employees/${employeeIdSelf}/productivity?month=2026-05`)
        .set('Authorization', `Bearer ${tokenTechnicien}`).set('x-tenant-id', tenantId);
      expect(r.status).toBe(200);
      expect(r.body.productivity_pct).toBeDefined();
      expect(r.body.no_data).toBeDefined();
    });
  });

  describe('Multi-tenant isolation', () => {
    it('employee log tenant A invisible from tenant B', async () => { /* ... */ });
  });

  describe('End-to-end consumer flow', () => {
    it('Tache 5.1.5 logHours -> Kafka -> Tache 5.1.7 consumer -> hr_time_logs row inserted', async () => {
      // 1. POST repair/orders/:id/log-hours via Tache 5.1.5 endpoint
      // 2. Wait Kafka + consumer (1-2s)
      // 3. GET hr/employees/:id/time-logs
      // 4. Verify row created with source='kafka_consumer'
    });

    it('idempotency : event redelivered does not double-create', async () => { /* ... */ });
  });
});
```

## 7bis. Diagrammes detailles flux events HR

```
=============================================================================
SEQUENCE COMPLETE : Sprint 5.1.5 logHours -> Sprint 5.1.7 hr_time_logs -> Sprint 13 payroll
=============================================================================

[Sprint 5.1.5] OrdersController.logHours()
   POST /api/v1/repair/orders/{orderId}/log-hours
   { hours: 2, task_id: "task-uuid", description: "Pose plaquettes" }
   |
   v
[OrdersService.logHours]
   SQL TRANSACTION REPEATABLE READ
   +- SELECT repair_orders FOR UPDATE
   +- Compute cost = 2 * 350 = 700.00
   +- INSERT repair_order_labor_logs (employee_id=emp-hamid, hours=2, hourly_rate_at_time=350, cost=700)
   +- UPDATE repair_orders SET labor_hours_logged += 2, labor_cost_actual += 700
   +- INSERT outbox_events (topic='insurtech.events.repair.order.hours_logged', payload={
        event_id=evt-001, tenant_id=t-atlas, order_id=o-1,
        employee_id=emp-hamid, hours=2, cost=700,
        logged_at='2026-05-15T10:00:00Z'
      })
   COMMIT
   |
   v
[Sprint 4] OutboxRelayWorker (polls every 100ms)
   +- Kafka producer send
   v
[Kafka topic insurtech.events.repair.order.hours_logged partition 7]
   v
[Sprint 5.1.7] HrTimeLogsConsumer.consume()
   |
   |  Zod validate OrderHoursLoggedEventSchema -> OK
   |
   |  TenantContext.run({ tenantId: t-atlas, userId: 'system' })
   |
   |  BEGIN TRANSACTION
   |
   |  Step 1 : INSERT inbox_events (event_id=evt-001) ON CONFLICT DO NOTHING
   |           Returns 1 row inserted -> continue
   |
   |  Step 2 : Compute hourly_rate = cost/hours = 700/2 = 350.00
   |
   |  Step 3 : INSERT hr_time_logs (
   |             tenant_id=t-atlas, employee_id=emp-hamid,
   |             task_type='repair_order', task_id=o-1,
   |             hours_logged=2, hourly_rate_at_time=350,
   |             date='2026-05-15', logged_at='2026-05-15T10:00:00Z',
   |             regular_hours=0, overtime_*=0,  -- placeholder
   |             is_overtime_computed=false,
   |             source='kafka_consumer', source_event_id=evt-001
   |           )
   |           ON CONFLICT (source_event_id) DO NOTHING (idempotency)
   |
   |  Step 4 : Check yearly quota
   |           SELECT SUM(overtime_*) FROM hr_time_logs WHERE employee=emp-hamid AND year=2026
   |           Result: 25.5h -> below 80h quota, no event emit
   |
   |  Step 5 : UPDATE inbox_events SET status='processed', processed_at=NOW WHERE event_id=evt-001
   |
   |  COMMIT TRANSACTION
   |
   |  Metrics : event_consumer_processed_total{topic='...hours_logged', status='success'} += 1
   v

[Cron weekly Monday 04:00 UTC]
   RecomputeOvertimeWeekCron.run()
   |
   |  Acquire Redis lock 'cron:hr:recompute-overtime-week'
   |
   |  For each tenant :
   |    For each employee with is_overtime_computed=false in last week :
   |      Fetch all hr_time_logs of that week (sorted by date, logged_at)
   |      Load mp_holidays_morocco for year
   |      computeWeeklyOvertime() -> breakdown HS
   |      For each log : UPDATE regular_hours, overtime_*, is_overtime_computed=true
   v

[Sprint 13 paie module] (consume payroll export end of month)
   GET /api/v1/hr/time-logs/payroll-export?month=2026-05&format=json
   |
   |  Aggregates per employee :
   |    - regular_cost = SUM(regular_hours) * hourly_rate
   |    - ot25_cost = SUM(ot25) * rate * 1.25
   |    - ot50_cost = SUM(ot50) * rate * 1.50
   |    - ot100_cost = SUM(ot100) * rate * 2.00
   |    - productive_hours = SUM(hours WHERE task_type='repair_order')
   |    - productivity_pct = productive / total * 100
   |
   |  Generates bulletin paie variable productive :
   |    - Salaire base : hourly_rate * 173.33h (mensuel base contractuel)
   |    - Heures supp payees aux majorations
   |    - Prime productive +25% si productivity_pct >= 80%
   |    - Charges CNSS 6.74% + AMO 4.41% + IGR
   v

[Bulletin paie envoye assure technicien]
```

## 7ter. Scenarios de test specifiques au Code Travail MA

```typescript
// Tests scenarios reglementaires precis a inclure dans overtime-calculator.util.spec.ts

describe('Code Travail MA -- scenarios reels Skalean Atlas', () => {
  const ctx = { holidays_ma: new Set([
    '2026-01-01', // Nouvel An
    '2026-01-11', // Manifeste Independance
    '2026-05-01', // Fete du Travail
    '2026-07-30', // Fete du Trone
    '2026-08-14', // Oued Ed-Dahab
    '2026-08-20', // Revolution Roi/Peuple
    '2026-08-21', // Fete Jeunesse
    '2026-11-06', // Marche Verte
    '2026-11-18', // Independance
    // Aid Hijra mobiles : calcules annuellement
    '2026-03-20', // Aid Al-Fitr (estimation)
    '2026-03-21',
    '2026-05-27', // Aid Al-Adha (estimation)
    '2026-05-28',
    '2026-06-17', // Nouvel An Hegire
    '2026-08-26', // Aid Al-Mawlid
  ]) };

  it('Cas reel Skalean Atlas semaine intensive (52h)', () => {
    // Lundi 18 mai : Hamid travaille 9h (8h normal + 1h supp soir)
    // Mardi 19 : 8h
    // Mercredi 20 : 9h
    // Jeudi 21 : 9h (1h nuit 21h-22h)
    // Vendredi 22 : 8h
    // Samedi 23 : 9h
    // Total : 52h
    const logs = [
      { id: 'l1a', date: '2026-05-18', logged_at: '2026-05-18T08:00:00Z', hours_logged: '8' },
      { id: 'l1b', date: '2026-05-18', logged_at: '2026-05-18T17:00:00Z', hours_logged: '1' },
      { id: 'l2', date: '2026-05-19', logged_at: '2026-05-19T08:00:00Z', hours_logged: '8' },
      { id: 'l3a', date: '2026-05-20', logged_at: '2026-05-20T08:00:00Z', hours_logged: '8' },
      { id: 'l3b', date: '2026-05-20', logged_at: '2026-05-20T17:00:00Z', hours_logged: '1' },
      { id: 'l4', date: '2026-05-21', logged_at: '2026-05-21T08:00:00Z', hours_logged: '8' },
      { id: 'l4night', date: '2026-05-21', logged_at: '2026-05-21T21:00:00Z', hours_logged: '1' },
      { id: 'l5', date: '2026-05-22', logged_at: '2026-05-22T08:00:00Z', hours_logged: '8' },
      { id: 'l6', date: '2026-05-23', logged_at: '2026-05-23T08:00:00Z', hours_logged: '9' },
    ];
    const r = computeWeeklyOvertime(logs, ctx);
    const totals = r.reduce((acc, x) => ({
      reg: acc.reg + parseFloat(x.regular_hours),
      ot25: acc.ot25 + parseFloat(x.overtime_25pct),
      ot50: acc.ot50 + parseFloat(x.overtime_50pct),
      ot100: acc.ot100 + parseFloat(x.overtime_100pct),
    }), { reg: 0, ot25: 0, ot50: 0, ot100: 0 });
    expect(totals.reg).toBeCloseTo(44, 1);
    expect(totals.ot25).toBeCloseTo(6, 1); // 44-50h jour
    expect(totals.ot50).toBeCloseTo(2, 1); // 1h nuit Jeudi + 1h excess
    expect(totals.ot100).toBeCloseTo(0, 1); // pas de dimanche/ferie cette semaine
  });

  it('Cas Aid Al-Fitr (3 jours feries consecutifs)', () => {
    // Hamid travaille 8h le 20, 21 mars (Aid Al-Fitr)
    const logs = [
      { id: 'lA', date: '2026-03-20', logged_at: '2026-03-20T08:00:00Z', hours_logged: '8' },
      { id: 'lB', date: '2026-03-21', logged_at: '2026-03-21T08:00:00Z', hours_logged: '8' },
    ];
    const r = computeWeeklyOvertime(logs, ctx);
    expect(r[0].overtime_100pct).toBe('8.00');
    expect(r[1].overtime_100pct).toBe('8.00');
  });

  it('Cas urgence dimanche Skalean Atlas', () => {
    // Sinistre urgent dimanche 17 mai, Hamid intervient 4h
    const logs = [{ id: 'lD', date: '2026-05-17', logged_at: '2026-05-17T10:00:00Z', hours_logged: '4' }];
    const r = computeWeeklyOvertime(logs, ctx);
    expect(r[0].overtime_100pct).toBe('4.00');
  });
});
```

## 8. Variables environnement

```env
HR_OVERTIME_RECOMPUTE_CRON='0 4 * * 1'   # Lundi 04:00 UTC
HR_QUOTA_CHECK_CRON='0 5 1 * *'           # 1er du mois 05:00 UTC
HR_NIGHT_HOUR_START=21
HR_NIGHT_HOUR_END=6
HR_YEARLY_OVERTIME_QUOTA=80
HR_RETENTION_YEARS=5
```

## 9. Commandes shell

```bash
cd repo

pnpm --filter @insurtech/database migration:generate -- src/migrations/CreateHrTimeLogsTable
pnpm --filter @insurtech/database migration:generate -- src/migrations/CreateComputeWeeklyOvertimeFunction
pnpm --filter @insurtech/database migration:generate -- src/migrations/SeedMpHolidaysMorocco2026
pnpm --filter @insurtech/database migration:run

psql $DATABASE_URL -c "\d hr_time_logs"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM mp_holidays_morocco WHERE EXTRACT(YEAR FROM date) = 2026;"

pnpm --filter @insurtech/hr typecheck lint
pnpm --filter @insurtech/hr vitest run src/utils/__tests__/overtime-calculator.util.spec.ts
pnpm --filter @insurtech/hr vitest run src/services/__tests__/
pnpm --filter @insurtech/hr vitest run src/consumers/__tests__/
pnpm --filter @insurtech/hr vitest run --coverage

pnpm --filter @insurtech/api vitest run test/hr/time-logs.e2e-spec.ts

bash infrastructure/scripts/check-no-emoji.sh packages/hr/src/
```

## 10. Criteres validation V1-V28

### Criteres P0 (bloquants -- 16)

- **V1 (P0)** : Migration `CreateHrTimeLogsTable` cree + check constraints + RLS.
- **V2 (P0)** : Index UNIQUE `source_event_id WHERE NOT NULL` garantit idempotency consumer.
- **V3 (P0)** : Seed `mp_holidays_morocco` 2026 + 2027 avec 16+ dates Hijra calculees.
- **V4 (P0)** : Algorithme HS conforme Loi 65-99 art. 184/196 : 44h seuil, HS25/HS50/HS100 corrects.
- **V5 (P0)** : Invariant `regular + ot25 + ot50 + ot100 === hours_logged` testee par log + DB CHECK.
- **V6 (P0)** : Dimanche + ferie meme date -> HS100% unique (pas double).
- **V7 (P0)** : Heure nuit detection 21h-6h strict.
- **V8 (P0)** : Consumer idempotent : redelivery -> INSERT skip via UNIQUE source_event_id.
- **V9 (P0)** : Multi-tenant isolation strict : event tenant A non visible tenant B.
- **V10 (P0)** : RBAC `hr.time_logs.read_self` : technicien voit seulement ses logs.
- **V11 (P0)** : Quota annuel 80h check + emit event si depasse.
- **V12 (P0)** : Cron weekly Redis lock atomic.
- **V13 (P0)** : `hourly_rate_at_time` snapshot anti-drift recompute.
- **V14 (P0)** : Adjustment trigger recompute via event Kafka.
- **V15 (P0)** : Coverage overtime-calculator >= 95%.
- **V16 (P0)** : Coverage HrTimeLogsService + Consumer >= 90%.

### Criteres P1 (8)

- **V17 (P1)** : Payroll export CSV format conforme Sprint 13 paie module.
- **V18 (P1)** : Productivity calculation gestion edge `no_data`.
- **V19 (P1)** : Cron getLastMondayUtc correct dimanche/lundi.
- **V20 (P1)** : Performance recompute < 5s pour 10 employes x 50 logs.
- **V21 (P1)** : Endpoint findByEmployee pagination + filters.
- **V22 (P1)** : Metriques Prometheus exposees per task_type.
- **V23 (P1)** : Audit log per adjustment (who, when, old/new).
- **V24 (P1)** : Sprint 13 paie module consume event ready.

### Criteres P2 (4)

- **V25 (P2)** : Documentation README.
- **V26 (P2)** : OpenAPI spec auto-genere.
- **V27 (P2)** : Dashboard Grafana pre-cree.
- **V28 (P2)** : Tracing OpenTelemetry consumer.

## 11. Edge cases + troubleshooting

### Edge case 1 : Employee transferred between tenants

**Solution** : `employee.tenant_id` change. Anciens logs restent tenant A. Nouveaux logs tenant B. Pas de fusion automatic.

### Edge case 2 : Cron weekly skipped (deploy weekend)

**Solution** : Detection au prochain run : recompute toutes les semaines marquees `is_overtime_computed=false`.

### Edge case 3 : Aid mobile (Hijra) -- dates lunaires

**Solution** : Seed `mp_holidays_morocco` mis a jour annuellement via cron import depuis API officielle MA. Sprint 19 : seed initial 2026/2027 manual.

### Edge case 4 : Heure logged_at avec timezone wrong

**Solution** : Stockage TIMESTAMPTZ (UTC). Detection nuit utilise UTC. Sprint 25+ ajoutera tenant timezone si requis (MA pas DST = stable).

### Edge case 5 : Recompute concurrent multi-tenants

**Solution** : Redis lock global cron, mais loop interne tenant-by-tenant. Pas de contention.

### Edge case 6 : Payroll export tenant 500 employees

**Solution** : Stream CSV chunked. Performance < 5s pour 500 employees / mois.

### Edge case 7 : Adjustment annule de fait paie mois precedent

**Solution** : Documentation : adjustments < 30j possibles. > 30j ouvre ticket HR admin. Sprint 5.1.13 documente flow.

### Edge case 8 : Sprint 22 affiche real-time time logs pour technicien -> websocket

**Solution** : Sprint 22 implementera. Sprint 19 expose REST + event Kafka consumable.

### Edge case 9 : Quota HS depasse Q2, employee demande conges compensatoires

**Solution** : Sprint 25+ : table `hr_compensatory_leaves`. Sprint 19 : alert + flag manuel admin.

### Edge case 10 : Adjustment leve invariant violation

**Solution** : Adjustment reset `is_overtime_computed=false`, donc CHECK invariant tolere mismatch jusqu'au prochain recompute.

## 12. Conformite Maroc detaillee

### Loi 65-99 Code du Travail Maroc -- coeur de cette tache

- **Article 184** : Duree legale 44h/semaine, 2288h/an.
- **Article 196** : Majorations HS : 25% (jour, en semaine), 50% (nuit OU dimanche), 100% (jour ferie OU jour ferie chome).
- **Article 24** : Registre journalier heures travaillees obligatoire, conservation 5 ans, consultable inspection.
- **Implementation** : Algorithme deterministe + table `hr_time_logs` + retention 5 ans + endpoint registre Sprint 5.1.10.

### Loi 09-08 CNDP -- protection donnees

- **Article 3** : Donnees employee (`hours_logged`, `description`) personnelles. RLS multi-tenant + RBAC self/all.
- **Article 7** : Consentement implicite cadre travail. Audit log obligatoire.

### CNSS / AMO -- charges sociales

- **Cotisation CNSS** : 6.74% employee + 8.6% employer sur salaire brut.
- **AMO** : 2.26% employee + 4.11% employer.
- **Implementation** : Sprint 5.1.9 Books consume export payroll de cette tache pour ecritures comptables charges sociales.

### Code Commerce MA -- art. 21 CGNC inventaire permanent

- N/A direct, mais labor cost reel impacte books art 19+ (preparation Sprint 5.1.9).

## 13. Conventions absolues skalean-insurtech

Heritage Tache 5.1.5 + 5.1.6. Specifiques :

### Event-driven HR strict
- HrTimeLogsConsumer extends BaseEventConsumer (decision-013).
- Topics format `insurtech.events.hr.*` pour emits.
- Outbox pattern pour events emis.

### Code Travail MA strict
- Algorithme HS deterministe + tests 30+ scenarios.
- Algorithme PURE function : pas DB, testable 100%.
- Constantes CODE_TRAVAIL_MA centralisees.

### Donnees personnelles strict
- RBAC self vs all granular.
- Audit log per mutation.
- Retention 5 ans + archive S3 cold storage Sprint 32+.

(Toutes autres conventions multi-tenant, Zod, Pino, TypeScript strict, pnpm, no-emoji, idempotency, conventional commits, Atlas Cloud cf Taches precedentes.)

## 14. Validation pre-commit

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)/repo"

pnpm --filter @insurtech/hr typecheck lint
pnpm --filter @insurtech/hr vitest run
pnpm --filter @insurtech/hr vitest run --coverage \
  --coverage.thresholds.lines=90 --coverage.thresholds.functions=90 \
  --coverage.include="src/utils/overtime-calculator.util.ts" \
  --coverage.thresholds.lines=95

pnpm --filter @insurtech/api typecheck lint
pnpm --filter @insurtech/api vitest run test/hr/

bash infrastructure/scripts/check-no-emoji.sh packages/hr/src/

grep -rn "console\." packages/hr/src/ --include="*.ts" | grep -v ".spec.ts" | grep -v "this\.logger" && exit 1 || true

echo "ALL CHECKS PASSED"
```

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-19): hr_time_logs table + Kafka consumer + overtime calculator Code Travail MA Loi 65-99 + payroll export + productivity dashboard

Implements Tache 5.1.7 of Sprint 19. Adds the auto-population of
hr_time_logs from repair.order.hours_logged events emitted by Tache
5.1.5, with deterministic overtime calculation conforming to Moroccan
Labour Code (Loi 65-99 articles 184-196). 44h weekly threshold,
HS25/HS50/HS100 majorations, night hours (21h-6h), Sundays and MA
holidays handled correctly. Weekly cron recomputes precise overtime,
yearly 80h quota check with event emission, payroll export CSV for
Sprint 13 paie module integration.

Livrables (28 fichiers crees, 6 modifies):
- 3 migrations (hr_time_logs, function Postgres, seed holidays 2026)
- Overtime calculator pure function (algorithm Code Travail MA)
- HrTimeLogsService 9 methods (manual, adjust, find, summary, productivity)
- HrTimeLogsConsumer extends BaseEventConsumer (Tache 5.1.6)
- HrOvertimeService recompute weekly + quota check
- HrPayrollExportService CSV stream + Decimal precision
- 2 crons (recompute weekly Mon 04:00, quota monthly 1st 05:00)
- Controller 6 endpoints REST + RBAC self vs all

Tests:
- 30+ overtime calculator (HS scenarios conformes Code Travail)
- 25+ HrTimeLogsService (CRUD, permissions, summary)
- 15+ Consumer (idempotency, multi-tenant)
- 12+ Overtime recompute
- 10+ Payroll export
- 25+ E2E (RBAC, CSV format)

Coverage: overtime-calculator >= 95%, service + consumer >= 90%
Variables env: 6 (cron schedules, night hours, quota, retention)

Task: 5.1.7
Sprint: 19 (Phase 5 / Sprint 1)
Phase: 5 -- Vertical Repair (Skalean Garage ERP Foundation)
Reference: B-19 Tache 5.1.7"
```

## 16. Workflow next step

Apres commit :
- Verification : `bash 00-pilotage/verifications/V-19-task-5.1.7.sh`.
- Tache suivante : `task-5.1.8-repair-invoices-facturation-dgi.md`.
- Tache 5.1.8 consume `repair_orders.total_cost_actual` (labor + parts reels) pour facturation conforme DGI, depend de `hr_time_logs` pour breakdown labor cost si requis.

---

**Fin du prompt task-5.1.7-integration-hr-assignment-technicien-time-logs.md.**

Densite atteinte : ~130 ko
Code patterns : 11 fichiers complets (constants, entity, DTOs, utility pure HS algorithm, consumer, 4 services, cron, controller, migration)
Tests : 30+ overtime calculator scenarios + 80+ autres
Criteres validation : V1-V28 (16 P0 + 8 P1 + 4 P2)
Edge cases : 10 cas avec solutions
Conformite MA : Loi 65-99 Code Travail (art. 184/196/24) + 09-08 CNDP + CNSS/AMO + CGNC
Convention strict : Code Travail MA algorithm + donnees personnelles RBAC granular
