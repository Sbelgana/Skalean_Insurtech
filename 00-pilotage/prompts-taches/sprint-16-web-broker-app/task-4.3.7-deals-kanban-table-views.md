# TACHE 4.3.7 -- Deals Page : Kanban View + Table View + Create + Move Stage

**Sprint** : 16 (Phase 4 / Sprint 3 dans phase, Web Broker App)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.7)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0
**Effort** : 6h
**Dependances** : task-4.3.6 (Companies page), task-4.3.5 (Contacts page, autocompletes reutilises), task-4.3.3 (Layout principal), Sprint 8 (CRM API endpoints deals + move-stage + won/lost), Sprint 5 (Auth JWT), Sprint 6 (Tenant context), Sprint 7 (RBAC), Sprint 4 (Design tokens + shadcn/ui), Sprint 1 (Monorepo)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Construire la page **Deals** (opportunites commerciales) de l'application `web-broker` (port 3001) avec deux vues paralleles toggleables (Kanban / Table), un modal de creation/edition, un systeme de drag-drop optimistic entre stages du pipeline commercial, des raccourcis Won/Lost avec motifs (Loi 09-08 + traceabilite ACAPS), et une page detail multi-onglets (Info / Timeline transitions / Interactions / Notes / Tasks / Linked Policies). Cette page est le coeur metier du CRM courtier : c'est la ou les commerciaux suivent la conversion lead -> contrat signe sur le pipeline 6-stages (lead 10% -> qualified 30% -> proposal 50% -> negotiation 70% -> won 100% / lost 0%).

L'objectif precis est de livrer une vue Kanban performante (drag-drop fluide avec animations framer-motion, virtualization > 50 deals/colonne, support touch mobile), une vue Table riche (filters multi-critere stage / owner / date_range / amount_range MAD / branche assurance), un modal DealFormDialog avec autocompletes contact + company + branche, des dialogs specialises (won-lost avec motif libre + dropdown, move-stage-reason si regression detectee), et une page detail avec timeline d'audit des transitions de stages (conformite Loi 09-08 article 38 -- traceabilite des actions sur donnees personnelles assurees). L'optimistic UI via TanStack Query 5.62 doit garantir une UX instantanee (< 16ms feedback drop) avec rollback transparent en cas d'echec API.

A la sortie de cette tache, l'utilisateur broker_admin / broker_user accede a `/fr/deals` (ou `/ar-MA/deals` / `/ar/deals` avec RTL adapte), voit ses deals organises en 6 colonnes Kanban draggables, peut creer un nouveau deal en 5 secondes via le bouton "Nouveau deal" en topbar, peut faire glisser une carte d'une colonne a l'autre avec un prompt si regression (ex: proposal -> lead requiert motif), peut basculer vers la vue tableau pour appliquer des filtres complexes ou exporter, peut cliquer sur un deal pour ouvrir sa page detail multi-onglets. Cette tache bloque 4.3.8 (Polices page) qui reutilisera le pattern DataTable + filters + detail-tabs et qui consommera les deals "won" pour generer les quotes.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Le CRM courtier (Sprint 8 backend) expose les endpoints deals avec un pipeline configurable mais des defaults bien arretes : `lead -> qualified -> proposal -> negotiation -> won | lost`. La majorite des courtiers marocains que Skalean cible (cabinets familiaux 5-30 collaborateurs, agences regionales Casa / Rabat / Marrakech / Tanger / Agadir) utilisent aujourd'hui des tableurs Excel ou des outils legacy non visuels (Sage Saari, AS400 mainframe pour les plus anciens). Le pipeline Kanban visuel est leur premiere experience d'un suivi commercial moderne, et c'est l'argument de vente principal de Skalean Broker face aux concurrents Connect Insure et Wafa Assurance Pro.

La vue Kanban doit donc etre **immediatement comprehensible** (zero formation), **performante** (un cabinet moyen suit 50-200 deals actifs simultanement, certains gros cabinets jusqu'a 800), et **resiliente offline** (les commerciaux terrain doivent pouvoir consulter en deplacement, meme si le mode offline complet est differe a Sprint 26). Le drag-drop est l'interaction critique : si elle laggue, glitche, ou perd des deals, la confiance utilisateur s'ecroule en 2 jours.

La vue Table est complementaire : pour les broker_admin qui veulent analyser, exporter en Excel pour reporting hebdomadaire au comite, ou filtrer sur des criteres composites (deals > 50k MAD en negotiation, owner Hassan, expected_close_date < 30j). Le toggle entre les deux vues est persiste dans l'URL via `nuqs` (`?view=kanban` ou `?view=table`) pour permettre le partage de liens contextuels (ex: manager envoie `https://app.skalean-insurtech.ma/fr/deals?view=table&stage=negotiation&owner=hassan_b` a son collaborateur).

### Alternatives considerees

#### Library drag-drop : @dnd-kit vs react-beautiful-dnd vs react-dnd

| Critere | @dnd-kit/core 6.1.x (CHOIX) | react-beautiful-dnd 13.x (rejete) | react-dnd 16.x (rejete) |
|---------|------------------------------|-------------------------------------|-------------------------|
| Maintenu | Oui (active 2024-2026) | Non (Atlassian a archive janvier 2023) | Oui mais lent |
| Bundle size | ~12 ko gzipped core | ~31 ko gzipped | ~22 ko gzipped |
| React 19 compat | Oui (officielle) | Non (broken hooks legacy) | Partielle |
| Touch / mobile support | Excellent (PointerSensor + TouchSensor) | Bon | Manuel |
| Accessibility (keyboard / screen reader) | Excellent (KeyboardSensor + ARIA announcements) | Excellent | Faible |
| Virtualization compat | Oui (utilise @dnd-kit/virtual ou TanStack Virtual) | Non (force render all) | Manuel |
| RTL support | Oui (CollisionDetection adapte) | Buggy en RTL | Manuel |
| TypeScript | First-class | Types tiers | First-class |
| Customization sensors | Tres flexible (Pointer / Keyboard / Touch / Mouse) | Limite | Tres flexible |
| Animations | Hook `useDndContext` + CSS transforms | CSS-only basique | Manuel |
| Multi-container drag | Natif (DroppableContainer) | Natif | Manuel verbeux |

**Decision** : `@dnd-kit/core` 6.1.0 + `@dnd-kit/sortable` 8.0.0 + `@dnd-kit/utilities` 3.2.2. react-beautiful-dnd archive est red flag absolu pour code production 2026+. react-dnd HTML5 backend est moins fluide sur mobile (touch synthetics laggy). @dnd-kit est le standard de facto post-2023 (utilise par Linear, Notion clones, ClickUp).

#### Pipeline stages : configurable backend vs hardcoded frontend

| Critere | Configurable backend (CHOIX -- aligne avec Sprint 8) | Hardcoded frontend (rejete) |
|---------|------------------------------------------------------|------------------------------|
| Flexibilite per-tenant | Oui (chaque cabinet peut customiser : ajouter "qualif_acaps", renommer "negotiation" en "devis_envoye") | Non |
| Migration future stages | Trivial (ajout DB row) | Code change + redeploy |
| Defaults sains | Oui (6 stages defaults injected si tenant_config null) | Implicite |
| Couplage front/back | API renvoie config, front consume | Front decide, back valide |
| Test difficulty | Mock API config response | Pas de mock |
| Sprint 8 architecture | `GET /api/v1/crm/pipeline-config` renvoie stages + probabilities | N/A |

**Decision** : Front consomme `GET /api/v1/crm/pipeline-config` au mount via `useDealPipeline()` hook, avec fallback `DEFAULT_STAGES` hardcode si endpoint indispo ou tenant nouveau. Defaults = 6 stages avec probabilities.

#### View toggle : tabs vs segmented control vs separate routes

| Critere | Segmented control + URL param (CHOIX) | Tabs shadcn (rejete) | Separate routes /deals/kanban + /deals/table (rejete) |
|---------|---------------------------------------|----------------------|-----------------------------------------------------|
| URL persistence | nuqs `?view=kanban` | Manuel | Native |
| Shareability | Oui | Non | Oui |
| Animation transition | Smooth (framer-motion) | Builtin shadcn | Page transition |
| Server Component routing | Meme route, RSC suspend par vue | Meme route | 2 routes RSC |
| Mobile UX | Compact (2 boutons) | Plus large | Browser back/forward navigue par vue |
| RBAC scoping | Meme permission | Meme permission | Meme permission |

**Decision** : Segmented control en topbar de page avec `nuqs` URL state. Animations framer-motion entre les deux vues. Une seule route `/deals` qui suspend la vue active.

#### State management vues filters : nuqs vs zustand vs URL search params manual

| Critere | nuqs 2.0.x (CHOIX) | zustand (rejete) | URL manual `useSearchParams` (rejete) |
|---------|---------------------|------------------|--------------------------------------|
| URL sync auto | Oui | Non (manual) | Manual avec router.replace |
| TypeScript | First-class avec parsers | Oui | Lossy (string only) |
| Server Component compat | Oui (`createSearchParamsCache`) | Non | Oui |
| Browser back/forward | Auto | Non | Auto |
| Debounce builtin | Oui (`throttleMs`) | Non | Non |
| Bundle size | ~3 ko gzipped | ~1 ko | 0 (native) |
| Shareability | URL = state complet | Non shareable | URL = state |

**Decision** : `nuqs` 2.0.4 pour tous les filters + view toggle. Aligne avec convention Skalean (deja utilise Sprints 4.3.5 contacts, 4.3.6 companies).

#### Optimistic mutation strategy : TanStack Query vs Server Actions revalidation

| Critere | TanStack Query optimistic mutate (CHOIX) | Server Actions + revalidatePath (rejete) |
|---------|------------------------------------------|------------------------------------------|
| Latence visuelle | < 16ms (instant local update) | ~200-800ms (round-trip server) |
| Rollback transparent | Oui (`onError` restore) | Manual via toast + manual revert |
| Cache invalidation | Fine-grained (`invalidateQueries`) | Path-level (gross) |
| Compatible Server Components | Avec hydration | Native RSC |
| Stack maturite | Standard 2024+ | Next.js 15 emergeant |
| Test difficulty | MockServiceWorker + queryClient | Mock server actions |
| Conflict resolution (2 users move same deal) | onError + ETag/version check | Last-write-wins par defaut |

**Decision** : TanStack Query 5.62.0 optimistic mutations pour toutes les mutations (move-stage, won, lost, create, update). Server Actions reservees aux flows transactionnels lourds (Sprint 17+).

### Diagramme architecture deals page

```
+--------------------------------------------------------------+
| /fr/deals?view=kanban&stage=negotiation&owner=hassan        |
+--------------------------------------------------------------+
                              |
                              v
+--------------------------------------------------------------+
| app/[locale]/(protected)/deals/page.tsx (Server Component)  |
| - Read searchParams via createSearchParamsCache              |
| - Fetch initial deals server-side (RSC)                      |
| - Pass to <DealsViewSwitcher /> client component             |
+--------------------------------------------------------------+
                              |
                              v
+--------------------------------------------------------------+
| <DealsViewSwitcher> (Client Component)                       |
|  - useQueryState('view') via nuqs                            |
|  - <DealsFilters /> sticky top                               |
|  - {view === 'kanban' ? <DealsKanban /> : <DealsTable />}    |
|  - <DealFormDialog open={create_open} />                     |
+--------------------------------------------------------------+
       |                              |
       v                              v
+----------------+         +-------------------------+
| <DealsKanban>  |         | <DealsTable>            |
| DndContext     |         | TanStack Table          |
| 6x KanbanCol   |         | Pagination + Sort       |
| each = drop   |         | Filters bind to URL     |
| zone for deal |         | Click row -> /deals/[id]|
+----------------+         +-------------------------+
       |
       v
+-------------------------+
| <DealCard draggable />  |
| - useDraggable hook     |
| - framer-motion layout  |
| - onDoubleClick -> open |
+-------------------------+
       |
       | (drop event)
       v
+----------------------------------+
| handleDragEnd                    |
| - detect source / target stage   |
| - if regression (stage_order_new |
|   < stage_order_old) -> show     |
|   <MoveStageReasonDialog />      |
| - else -> direct mutation        |
+----------------------------------+
       |
       v
+----------------------------------+
| useMoveStageMutation             |
| onMutate -> optimistic update    |
| onError -> rollback + toast      |
| onSuccess -> invalidateQueries   |
+----------------------------------+
       |
       v
+----------------------------------+
| POST /api/v1/crm/deals/:id/      |
| move-stage                       |
| Body: { stage, reason? }         |
| Headers: Idempotency-Key:        |
|   <uuid>                         |
+----------------------------------+
```

### Decisions architecturales heritees

- **Idempotency-Key obligatoire** sur toutes mutations (decision-008 Sprint 3) : header genere via `crypto.randomUUID()` cote client, envoye sur chaque POST/PATCH. Le backend deduplique sur 24h.
- **x-tenant-id automatique** via interceptor Axios (Sprint 4 deja en place dans `lib/api-client.ts`).
- **Africa/Casablanca timezone** pour tous les `expected_close_date`, `signed_at`, `created_at`. Affichage via `date-fns-tz` formatInTimeZone(Africa/Casablanca).
- **MAD currency obligatoire** : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`. Pas de conversion auto, le deal stocke amount + currency, l'affichage formatte selon locale.
- **Audit log Loi 09-08** : chaque move-stage genere une entree dans `deal_stage_transitions` (backend Sprint 8). Le front consume `GET /:id/timeline` pour afficher l'historique.
- **RBAC** : broker_admin = full CRUD, broker_user = CRUD sur ses deals (owner_id = user_id), broker_assistant = read + create only (pas de move-stage ni won/lost). Verifie via `usePermissions()` hook (Sprint 4.3.12).
- **Pas de delete deal** : un deal lost reste dans la base pour analytics. La regle metier impose lost + reason au lieu de delete.

### Risques et mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Drag-drop laggy avec 500+ deals/colonne | Moyenne | Eleve (UX) | Virtualization @dnd-kit + react-virtual au-dela de 50 deals |
| Conflit move-stage simultane 2 users | Faible | Moyen | ETag header + 409 Conflict handling + refresh prompt |
| Touch drag mobile inutilisable | Moyenne | Eleve | TouchSensor avec delay 250ms + tolerance 5px |
| RTL drag direction inversee | Moyenne | Faible | CollisionDetection adapte + tests E2E ar-MA |
| Optimistic update cache stale | Faible | Moyen | invalidateQueries onSettled + ETag check |
| Probability mismatch stage vs custom | Faible | Faible | Validation Zod stage-probability tuple |
| Currency display fr vs ar-MA | Faible | Faible | Intl.NumberFormat locale-aware |
| Win amount > original deal amount | Moyenne | Faible | Validation Zod + warning toast si > 150% |
| Loss without reason validation | Moyenne | Moyen | Zod schema `reason: z.string().min(10)` |
| Kanban scroll horizontal mobile | Moyenne | Moyen | `overflow-x-auto` + snap-x + scroll indicators |

---

## 3. Architecture context (3-5 ko)

### Structure de fichiers cibles (Sprint 16 -- web-broker)

```
repo/apps/web-broker/
|-- app/
|   |-- [locale]/
|   |   |-- (protected)/
|   |   |   |-- deals/
|   |   |   |   |-- page.tsx                              # NEW -- Server Component initial fetch + view switcher
|   |   |   |   |-- loading.tsx                           # NEW -- Suspense skeleton
|   |   |   |   |-- error.tsx                             # NEW -- Error boundary
|   |   |   |   |-- [id]/
|   |   |   |   |   |-- page.tsx                          # NEW -- Detail page Server Component
|   |   |   |   |   |-- loading.tsx                       # NEW
|   |   |   |   |   |-- error.tsx                         # NEW
|   |   |   |   |-- _components/                          # private RSC components
|   |   |   |   |   |-- deals-page-header.tsx             # NEW
|   |-- api/                                              # (no API routes -- backend Sprint 8 fournit)
|-- components/
|   |-- deals/
|   |   |-- deals-view-switcher.tsx                       # NEW -- segmented control + view selector
|   |   |-- deals-kanban.tsx                              # NEW -- DnD-Kit context + 6 columns
|   |   |-- kanban-column.tsx                             # NEW -- droppable scrollable column
|   |   |-- deal-card.tsx                                 # NEW -- draggable compact card
|   |   |-- deals-table.tsx                               # NEW -- TanStack Table DataTable
|   |   |-- deals-filters.tsx                             # NEW -- nuqs filters bar
|   |   |-- deal-form-dialog.tsx                          # NEW -- create/edit modal
|   |   |-- won-lost-dialog.tsx                           # NEW -- shortcut won OR lost
|   |   |-- move-stage-reason-dialog.tsx                  # NEW -- prompt regression
|   |   |-- deal-timeline.tsx                             # NEW -- audit transitions list
|   |   |-- deal-detail-tabs.tsx                          # NEW -- tabs orchestration
|   |   |-- deal-detail-info.tsx                          # NEW -- info tab content
|   |   |-- deal-detail-interactions.tsx                  # NEW
|   |   |-- deal-detail-notes.tsx                         # NEW
|   |   |-- deal-detail-tasks.tsx                         # NEW
|   |   |-- deal-detail-policies.tsx                      # NEW
|   |   |-- empty-state.tsx                               # NEW
|-- lib/
|   |-- api/
|   |   |-- deals.api.ts                                  # NEW -- axios calls deals
|   |-- queries/
|   |   |-- deals.queries.ts                              # NEW -- TanStack hooks + optimistic
|   |-- schemas/
|   |   |-- deal.schema.ts                                # NEW -- Zod validators
|   |-- hooks/
|   |   |-- use-deal-pipeline.ts                          # NEW -- pipeline config hook
|   |   |-- use-deal-permissions.ts                       # NEW -- RBAC helpers
|   |-- utils/
|   |   |-- deal-formatters.ts                            # NEW -- format MAD, dates, probabilities
|-- tests/
|   |-- unit/
|   |   |-- deals/
|   |   |   |-- deal-schema.test.ts                       # NEW
|   |   |   |-- deal-formatters.test.ts                   # NEW
|   |   |   |-- deals-kanban.test.tsx                     # NEW
|   |   |   |-- deal-form-dialog.test.tsx                 # NEW
|   |   |   |-- won-lost-dialog.test.tsx                  # NEW
|   |   |   |-- move-stage-reason-dialog.test.tsx         # NEW
|   |   |   |-- use-deal-pipeline.test.ts                 # NEW
|   |-- e2e/
|   |   |-- deals-kanban.spec.ts                          # NEW -- 5 scenarios
|   |   |-- deals-table.spec.ts                           # NEW -- 3 scenarios
|   |   |-- deals-create.spec.ts                          # NEW -- 2 scenarios
|   |   |-- deals-won-lost.spec.ts                        # NEW -- 2 scenarios
|   |   |-- deals-detail.spec.ts                          # NEW -- 2 scenarios
|-- messages/
|   |-- fr.json                                           # MODIFIED -- ajout namespace deals
|   |-- ar-MA.json                                        # MODIFIED
|   |-- ar.json                                           # MODIFIED
|-- package.json                                          # MODIFIED -- ajout @dnd-kit/* + framer-motion
```

### Pipeline stages canonique

```typescript
export const DEFAULT_PIPELINE_STAGES = [
  { key: 'lead',        order: 1, probability: 10,  color: 'slate',   labelFr: 'Lead',          labelArMA: 'Lead',         labelAr: 'عميل محتمل' },
  { key: 'qualified',   order: 2, probability: 30,  color: 'blue',    labelFr: 'Qualifie',      labelArMA: 'Qualifie',     labelAr: 'مؤهل' },
  { key: 'proposal',    order: 3, probability: 50,  color: 'amber',   labelFr: 'Proposition',   labelArMA: 'Proposition',  labelAr: 'عرض' },
  { key: 'negotiation', order: 4, probability: 70,  color: 'orange',  labelFr: 'Negociation',   labelArMA: 'Negociation',  labelAr: 'تفاوض' },
  { key: 'won',         order: 5, probability: 100, color: 'green',   labelFr: 'Gagne',         labelArMA: 'Gagne',        labelAr: 'مربوح' },
  { key: 'lost',        order: 6, probability: 0,   color: 'red',     labelFr: 'Perdu',         labelArMA: 'Perdu',        labelAr: 'خاسر' },
] as const;
```

### API contract deals (Sprint 8 CRM)

```yaml
GET /api/v1/crm/deals
  query:
    stage?: lead|qualified|proposal|negotiation|won|lost
    owner_id?: uuid
    contact_id?: uuid
    company_id?: uuid
    branche?: auto|habitation|sante|vie|rc_pro|transport|multirisque_pro
    amount_min?: number (MAD)
    amount_max?: number (MAD)
    close_from?: ISO date
    close_to?: ISO date
    search?: string (title fuzzy)
    cursor?: string
    limit?: 50 (default) | max 200
  response: { items: Deal[], next_cursor?: string, total: number }

POST /api/v1/crm/deals
  headers: Idempotency-Key, x-tenant-id, Authorization Bearer
  body: DealCreateDTO
  response: 201 Deal

PATCH /api/v1/crm/deals/:id
  headers: Idempotency-Key, If-Match: <etag>
  body: Partial<DealUpdateDTO>
  response: 200 Deal | 409 Conflict

POST /api/v1/crm/deals/:id/move-stage
  headers: Idempotency-Key
  body: { stage: PipelineStage, reason?: string }
  response: 200 Deal | 422 { code: 'REASON_REQUIRED' }

POST /api/v1/crm/deals/:id/won
  headers: Idempotency-Key
  body: { amount_final: number, reason: string, signed_at: ISODate }
  response: 200 Deal

POST /api/v1/crm/deals/:id/lost
  headers: Idempotency-Key
  body: { reason: string, lost_to_competitor?: string }
  response: 200 Deal

GET /api/v1/crm/deals/:id
  response: DealDetail (with embedded contact, company, owner, interactions, notes, tasks, linked_policies)

GET /api/v1/crm/deals/:id/timeline
  response: { items: StageTransition[] }

StageTransition: {
  id: uuid
  from_stage: PipelineStage | null
  to_stage: PipelineStage
  reason: string | null
  actor_user_id: uuid
  actor_name: string
  occurred_at: ISODate
  duration_in_previous_stage_ms: number | null
}

Deal: {
  id: uuid
  tenant_id: uuid
  title: string (max 200)
  amount: number (MAD)
  currency: 'MAD' (locked Sprint 16)
  stage: PipelineStage
  probability: number (0-100, auto from stage by default)
  contact_id: uuid | null
  contact?: ContactBrief
  company_id: uuid | null
  company?: CompanyBrief
  owner_id: uuid
  owner?: UserBrief
  branche: BrancheAssurance | null
  expected_close_date: ISODate | null
  source: 'inbound' | 'outbound' | 'referral' | 'partner' | 'other'
  tags: string[]
  signed_at: ISODate | null
  lost_at: ISODate | null
  lost_reason: string | null
  lost_to_competitor: string | null
  amount_final: number | null
  notes_count: number
  interactions_count: number
  tasks_count: number
  linked_policies_count: number
  etag: string
  created_at: ISODate
  updated_at: ISODate
}
```

---

## 4. Livrables checkables (20+ deliverables)

- [ ] L1 -- Page `/[locale]/(protected)/deals/page.tsx` Server Component avec parsing `searchParams` (view, stage, owner_id, amount_min, amount_max, close_from, close_to, branche, search) via `createSearchParamsCache` de nuqs.
- [ ] L2 -- Server-side initial fetch des deals via `dealsApi.list()` (avec headers tenant + auth injected).
- [ ] L3 -- View toggle segmented control (Kanban / Table) en topbar de page, URL persistance via `nuqs` (`?view=kanban` ou `?view=table`).
- [ ] L4 -- Composant `<DealsKanban>` : `DndContext` racine + 6 colonnes (`<KanbanColumn>`) basees sur pipeline config (defaults DEFAULT_PIPELINE_STAGES).
- [ ] L5 -- Chaque colonne : header (label localise + count + somme MAD), zone droppable scrollable, deals draggables.
- [ ] L6 -- `<DealCard>` draggable : title + amount MAD formatte + contact name + expected_close_date relative + owner avatar + tags (max 2) + probability badge.
- [ ] L7 -- Drag-drop handler `onDragEnd` : detection source/target stage, declenchement mutation.
- [ ] L8 -- Mutation optimistic `useMoveStage` : update local cache instant, rollback `onError`, invalidate `onSettled`.
- [ ] L9 -- Detection regression stage (stage_order_new < stage_order_old) -> ouverture `<MoveStageReasonDialog>` qui force reason (min 10 chars).
- [ ] L10 -- POST `/api/v1/crm/deals/:id/move-stage` avec Idempotency-Key header + body { stage, reason }.
- [ ] L11 -- Animations framer-motion : `layout` prop sur DealCard (smooth re-position) + drop zone visual feedback (`<motion.div animate={{ scale: isOver ? 1.02 : 1 }}>`).
- [ ] L12 -- Virtualization si > 50 deals/colonne (use `@tanstack/react-virtual` integration avec DndContext).
- [ ] L13 -- Composant `<DealsTable>` : DataTable shadcn + colonnes (title, contact, company, stage badge, amount MAD, branche, owner, expected_close_date, probability%) + sort + pagination cursor-based.
- [ ] L14 -- Composant `<DealsFilters>` : multi-select stage, autocomplete owner, autocomplete contact, autocomplete company, select branche, range slider amount MAD, date range picker expected_close_date.
- [ ] L15 -- Tous filters sync URL via nuqs avec `parseAsString`, `parseAsArrayOf`, `parseAsInteger`, `parseAsIsoDateTime`.
- [ ] L16 -- Composant `<DealFormDialog>` : create/edit mode, fields = title / amount / currency (MAD locked) / stage / contact autocomplete / company autocomplete / branche / expected_close_date / probability (auto from stage default, overridable) / source / tags.
- [ ] L17 -- Validation form via `react-hook-form` + `zodResolver(dealCreateSchema)`.
- [ ] L18 -- POST `/api/v1/crm/deals` avec Idempotency-Key + revalidate cache list.
- [ ] L19 -- Bouton "Won" sur DealCard contextual menu -> `<WonLostDialog mode="won">` : amount_final (default = amount) + reason (libre) + signed_at + sync probability = 100.
- [ ] L20 -- Bouton "Lost" sur DealCard contextual menu -> `<WonLostDialog mode="lost">` : reason dropdown (PRICE_TOO_HIGH / COMPETITOR_WON / NO_NEED / NO_BUDGET / UNRESPONSIVE / OTHER) + libre + lost_to_competitor optional + sync probability = 0.
- [ ] L21 -- Page detail `/[locale]/(protected)/deals/[id]/page.tsx` Server Component avec fetch deal detail + timeline.
- [ ] L22 -- `<DealDetailTabs>` : 5 tabs (Info / Timeline / Interactions / Notes / Tasks / Linked Policies si applicable).
- [ ] L23 -- Tab Timeline : `<DealTimeline>` liste verticale des transitions (from_stage -> to_stage + actor + reason + duration_in_previous_stage formate).
- [ ] L24 -- Empty states : "Aucun deal" general + "Aucun deal dans cette colonne" Kanban + "Aucun resultat avec ces filtres" Table.
- [ ] L25 -- Loading states : skeletons Kanban (6 colonnes avec 3 cards squelette chacune) + table skeleton + detail page skeleton.
- [ ] L26 -- Error boundary : `error.tsx` page + ErrorBoundary component dans DealsKanban (catch dnd errors).
- [ ] L27 -- I18n : namespace `deals` dans `messages/fr.json`, `ar-MA.json`, `ar.json` (50+ cles).
- [ ] L28 -- RTL : Kanban scroll horizontal reverse en ar/ar-MA + drag direction adapte (CollisionDetection).
- [ ] L29 -- Accessibility : keyboard navigation Kanban (arrow keys move card focus, Space pick up, Enter drop), ARIA live announcements ("Deal X moved to stage Y"), focus management modal.
- [ ] L30 -- RBAC : broker_assistant ne voit pas boutons move-stage / won / lost (read+create only).
- [ ] L31 -- Tests Vitest unit 12+ : schemas, formatters, kanban drag logic, dialog validation, pipeline hook, permissions hook, regression detection, won/lost validation, currency formatting, date Africa/Casablanca, RTL detection, RBAC scoping.
- [ ] L32 -- Tests Playwright E2E 10+ : drag deal between stages, regression prompt reason, table filters apply, create deal full flow, won shortcut full flow, lost shortcut full flow, detail timeline display, view toggle URL persist, RBAC assistant restricted, mobile touch drag.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
[NEW]  repo/apps/web-broker/app/[locale]/(protected)/deals/page.tsx                          # ~140 lignes -- Server Component initial
[NEW]  repo/apps/web-broker/app/[locale]/(protected)/deals/loading.tsx                       # ~40 lignes -- Suspense skeleton
[NEW]  repo/apps/web-broker/app/[locale]/(protected)/deals/error.tsx                         # ~30 lignes -- Error boundary
[NEW]  repo/apps/web-broker/app/[locale]/(protected)/deals/[id]/page.tsx                     # ~200 lignes -- Detail page
[NEW]  repo/apps/web-broker/app/[locale]/(protected)/deals/[id]/loading.tsx                  # ~35 lignes
[NEW]  repo/apps/web-broker/app/[locale]/(protected)/deals/[id]/error.tsx                    # ~25 lignes
[NEW]  repo/apps/web-broker/app/[locale]/(protected)/deals/_components/deals-page-header.tsx # ~80 lignes
[NEW]  repo/apps/web-broker/components/deals/deals-view-switcher.tsx                         # ~120 lignes
[NEW]  repo/apps/web-broker/components/deals/deals-kanban.tsx                                # ~350 lignes
[NEW]  repo/apps/web-broker/components/deals/kanban-column.tsx                               # ~150 lignes
[NEW]  repo/apps/web-broker/components/deals/deal-card.tsx                                   # ~120 lignes
[NEW]  repo/apps/web-broker/components/deals/deals-table.tsx                                 # ~220 lignes
[NEW]  repo/apps/web-broker/components/deals/deals-filters.tsx                               # ~180 lignes
[NEW]  repo/apps/web-broker/components/deals/deal-form-dialog.tsx                            # ~280 lignes
[NEW]  repo/apps/web-broker/components/deals/won-lost-dialog.tsx                             # ~180 lignes
[NEW]  repo/apps/web-broker/components/deals/move-stage-reason-dialog.tsx                    # ~100 lignes
[NEW]  repo/apps/web-broker/components/deals/deal-timeline.tsx                               # ~150 lignes
[NEW]  repo/apps/web-broker/components/deals/deal-detail-tabs.tsx                            # ~120 lignes
[NEW]  repo/apps/web-broker/components/deals/deal-detail-info.tsx                            # ~140 lignes
[NEW]  repo/apps/web-broker/components/deals/deal-detail-interactions.tsx                    # ~90 lignes
[NEW]  repo/apps/web-broker/components/deals/deal-detail-notes.tsx                           # ~90 lignes
[NEW]  repo/apps/web-broker/components/deals/deal-detail-tasks.tsx                           # ~90 lignes
[NEW]  repo/apps/web-broker/components/deals/deal-detail-policies.tsx                        # ~70 lignes
[NEW]  repo/apps/web-broker/components/deals/empty-state.tsx                                 # ~50 lignes
[NEW]  repo/apps/web-broker/lib/api/deals.api.ts                                             # ~180 lignes
[NEW]  repo/apps/web-broker/lib/queries/deals.queries.ts                                     # ~260 lignes -- optimistic mutations
[NEW]  repo/apps/web-broker/lib/schemas/deal.schema.ts                                       # ~150 lignes
[NEW]  repo/apps/web-broker/lib/hooks/use-deal-pipeline.ts                                   # ~80 lignes
[NEW]  repo/apps/web-broker/lib/hooks/use-deal-permissions.ts                                # ~60 lignes
[NEW]  repo/apps/web-broker/lib/utils/deal-formatters.ts                                     # ~100 lignes
[NEW]  repo/apps/web-broker/tests/unit/deals/deal-schema.test.ts                             # ~150 lignes
[NEW]  repo/apps/web-broker/tests/unit/deals/deal-formatters.test.ts                         # ~120 lignes
[NEW]  repo/apps/web-broker/tests/unit/deals/deals-kanban.test.tsx                           # ~200 lignes
[NEW]  repo/apps/web-broker/tests/unit/deals/deal-form-dialog.test.tsx                       # ~180 lignes
[NEW]  repo/apps/web-broker/tests/unit/deals/won-lost-dialog.test.tsx                        # ~140 lignes
[NEW]  repo/apps/web-broker/tests/unit/deals/move-stage-reason-dialog.test.tsx               # ~110 lignes
[NEW]  repo/apps/web-broker/tests/unit/deals/use-deal-pipeline.test.ts                       # ~80 lignes
[NEW]  repo/apps/web-broker/tests/e2e/deals-kanban.spec.ts                                   # ~220 lignes (5 scenarios)
[NEW]  repo/apps/web-broker/tests/e2e/deals-table.spec.ts                                    # ~140 lignes (3 scenarios)
[NEW]  repo/apps/web-broker/tests/e2e/deals-create.spec.ts                                   # ~120 lignes (2 scenarios)
[NEW]  repo/apps/web-broker/tests/e2e/deals-won-lost.spec.ts                                 # ~150 lignes (2 scenarios)
[NEW]  repo/apps/web-broker/tests/e2e/deals-detail.spec.ts                                   # ~100 lignes (2 scenarios)
[MOD]  repo/apps/web-broker/messages/fr.json                                                 # +60 cles namespace deals
[MOD]  repo/apps/web-broker/messages/ar-MA.json                                              # +60 cles
[MOD]  repo/apps/web-broker/messages/ar.json                                                 # +60 cles
[MOD]  repo/apps/web-broker/package.json                                                     # +@dnd-kit/core 6.1.0 +@dnd-kit/sortable 8.0.0 +@dnd-kit/utilities 3.2.2 +framer-motion 11.15.0 +@tanstack/react-virtual 3.11.0
[MOD]  repo/apps/web-broker/components/layout/topbar.tsx                                     # add "Nouveau deal" button visible on /deals route
```

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `lib/schemas/deal.schema.ts`

```typescript
import { z } from 'zod';

export const PIPELINE_STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const BRANCHES_ASSURANCE = [
  'auto',
  'habitation',
  'sante',
  'vie',
  'rc_pro',
  'transport',
  'multirisque_pro',
  'voyage',
  'accidents_corporels',
] as const;
export type BrancheAssurance = (typeof BRANCHES_ASSURANCE)[number];

export const DEAL_SOURCES = ['inbound', 'outbound', 'referral', 'partner', 'other'] as const;
export type DealSource = (typeof DEAL_SOURCES)[number];

export const LOST_REASONS = [
  'PRICE_TOO_HIGH',
  'COMPETITOR_WON',
  'NO_NEED',
  'NO_BUDGET',
  'UNRESPONSIVE',
  'TIMING_BAD',
  'OTHER',
] as const;
export type LostReason = (typeof LOST_REASONS)[number];

export const dealCreateSchema = z.object({
  title: z
    .string()
    .min(3, 'Le titre doit contenir au moins 3 caracteres')
    .max(200, 'Le titre ne peut pas depasser 200 caracteres')
    .trim(),
  amount: z
    .number({ invalid_type_error: 'Le montant doit etre un nombre' })
    .positive('Le montant doit etre positif')
    .max(100_000_000, 'Montant trop eleve (max 100M MAD)'),
  currency: z.literal('MAD'),
  stage: z.enum(PIPELINE_STAGES).default('lead'),
  contact_id: z.string().uuid('Contact invalide').nullable().optional(),
  company_id: z.string().uuid('Entreprise invalide').nullable().optional(),
  branche: z.enum(BRANCHES_ASSURANCE).nullable().optional(),
  expected_close_date: z
    .string()
    .datetime({ message: 'Date attendue invalide (ISO 8601)' })
    .nullable()
    .optional()
    .refine(
      (v) => !v || new Date(v).getTime() > Date.now() - 86400000,
      { message: 'La date de cloture ne peut etre dans le passe' }
    ),
  probability: z
    .number()
    .int('La probabilite doit etre un entier')
    .min(0)
    .max(100)
    .optional(),
  source: z.enum(DEAL_SOURCES).default('inbound'),
  tags: z
    .array(z.string().trim().min(1).max(40))
    .max(10, 'Maximum 10 tags')
    .default([]),
  owner_id: z.string().uuid('Owner invalide').optional(),
});

export type DealCreateInput = z.infer<typeof dealCreateSchema>;

export const dealUpdateSchema = dealCreateSchema.partial();
export type DealUpdateInput = z.infer<typeof dealUpdateSchema>;

export const moveStageSchema = z.object({
  stage: z.enum(PIPELINE_STAGES),
  reason: z.string().trim().min(10, 'Motif requis (min 10 caracteres)').max(500).optional(),
});

export const moveStageRegressionSchema = moveStageSchema.extend({
  reason: z.string().trim().min(10, 'Motif requis pour regression').max(500),
});

export const wonSchema = z.object({
  amount_final: z.number().positive('Montant final doit etre positif'),
  reason: z.string().trim().min(5, 'Commentaire requis (min 5 caracteres)').max(500),
  signed_at: z.string().datetime('Date signature invalide'),
});

export const lostSchema = z.object({
  reason: z.enum(LOST_REASONS),
  reason_text: z.string().trim().min(10, 'Commentaire detaille requis').max(500),
  lost_to_competitor: z.string().trim().max(200).optional(),
});

export const dealFiltersSchema = z.object({
  stage: z.array(z.enum(PIPELINE_STAGES)).optional(),
  owner_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  branche: z.enum(BRANCHES_ASSURANCE).optional(),
  amount_min: z.number().min(0).optional(),
  amount_max: z.number().min(0).optional(),
  close_from: z.string().datetime().optional(),
  close_to: z.string().datetime().optional(),
  search: z.string().trim().max(100).optional(),
});

export type DealFilters = z.infer<typeof dealFiltersSchema>;

export interface Deal {
  id: string;
  tenant_id: string;
  title: string;
  amount: number;
  currency: 'MAD';
  stage: PipelineStage;
  probability: number;
  contact_id: string | null;
  contact?: { id: string; full_name: string; email: string | null };
  company_id: string | null;
  company?: { id: string; legal_name: string };
  owner_id: string;
  owner?: { id: string; full_name: string; avatar_url: string | null };
  branche: BrancheAssurance | null;
  expected_close_date: string | null;
  source: DealSource;
  tags: string[];
  signed_at: string | null;
  lost_at: string | null;
  lost_reason: LostReason | null;
  lost_reason_text: string | null;
  lost_to_competitor: string | null;
  amount_final: number | null;
  notes_count: number;
  interactions_count: number;
  tasks_count: number;
  linked_policies_count: number;
  etag: string;
  created_at: string;
  updated_at: string;
}

export interface StageTransition {
  id: string;
  deal_id: string;
  from_stage: PipelineStage | null;
  to_stage: PipelineStage;
  reason: string | null;
  actor_user_id: string;
  actor_name: string;
  occurred_at: string;
  duration_in_previous_stage_ms: number | null;
}
```

### 6.2 `lib/api/deals.api.ts`

```typescript
import { apiClient } from '@/lib/api-client';
import type {
  Deal,
  DealCreateInput,
  DealUpdateInput,
  DealFilters,
  StageTransition,
  PipelineStage,
  LostReason,
} from '@/lib/schemas/deal.schema';

export interface DealsListResponse {
  items: Deal[];
  next_cursor: string | null;
  total: number;
}

export interface PipelineConfig {
  stages: Array<{
    key: PipelineStage;
    order: number;
    probability: number;
    color: string;
    label_fr: string;
    label_ar_ma: string;
    label_ar: string;
  }>;
}

function buildIdempotencyKey(): string {
  return crypto.randomUUID();
}

function toQueryParams(filters: DealFilters & { cursor?: string; limit?: number }): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.stage?.length) filters.stage.forEach((s) => params.append('stage', s));
  if (filters.owner_id) params.set('owner_id', filters.owner_id);
  if (filters.contact_id) params.set('contact_id', filters.contact_id);
  if (filters.company_id) params.set('company_id', filters.company_id);
  if (filters.branche) params.set('branche', filters.branche);
  if (filters.amount_min !== undefined) params.set('amount_min', String(filters.amount_min));
  if (filters.amount_max !== undefined) params.set('amount_max', String(filters.amount_max));
  if (filters.close_from) params.set('close_from', filters.close_from);
  if (filters.close_to) params.set('close_to', filters.close_to);
  if (filters.search) params.set('search', filters.search);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.limit) params.set('limit', String(filters.limit));
  return params;
}

export const dealsApi = {
  async list(filters: DealFilters & { cursor?: string; limit?: number } = {}): Promise<DealsListResponse> {
    const params = toQueryParams(filters);
    const { data } = await apiClient.get<DealsListResponse>(`/api/v1/crm/deals?${params.toString()}`);
    return data;
  },

  async listAllForKanban(filters: DealFilters = {}): Promise<Deal[]> {
    const items: Deal[] = [];
    let cursor: string | null = null;
    do {
      const page = await this.list({ ...filters, cursor: cursor ?? undefined, limit: 200 });
      items.push(...page.items);
      cursor = page.next_cursor;
    } while (cursor);
    return items;
  },

  async getById(id: string): Promise<Deal> {
    const { data } = await apiClient.get<Deal>(`/api/v1/crm/deals/${id}`);
    return data;
  },

  async getTimeline(id: string): Promise<{ items: StageTransition[] }> {
    const { data } = await apiClient.get<{ items: StageTransition[] }>(
      `/api/v1/crm/deals/${id}/timeline`,
    );
    return data;
  },

  async create(input: DealCreateInput): Promise<Deal> {
    const { data } = await apiClient.post<Deal>('/api/v1/crm/deals', input, {
      headers: { 'Idempotency-Key': buildIdempotencyKey() },
    });
    return data;
  },

  async update(id: string, input: DealUpdateInput, etag: string): Promise<Deal> {
    const { data } = await apiClient.patch<Deal>(`/api/v1/crm/deals/${id}`, input, {
      headers: {
        'Idempotency-Key': buildIdempotencyKey(),
        'If-Match': etag,
      },
    });
    return data;
  },

  async moveStage(id: string, stage: PipelineStage, reason?: string): Promise<Deal> {
    const { data } = await apiClient.post<Deal>(
      `/api/v1/crm/deals/${id}/move-stage`,
      { stage, reason },
      { headers: { 'Idempotency-Key': buildIdempotencyKey() } },
    );
    return data;
  },

  async markWon(
    id: string,
    payload: { amount_final: number; reason: string; signed_at: string },
  ): Promise<Deal> {
    const { data } = await apiClient.post<Deal>(`/api/v1/crm/deals/${id}/won`, payload, {
      headers: { 'Idempotency-Key': buildIdempotencyKey() },
    });
    return data;
  },

  async markLost(
    id: string,
    payload: { reason: LostReason; reason_text: string; lost_to_competitor?: string },
  ): Promise<Deal> {
    const { data } = await apiClient.post<Deal>(`/api/v1/crm/deals/${id}/lost`, payload, {
      headers: { 'Idempotency-Key': buildIdempotencyKey() },
    });
    return data;
  },

  async getPipelineConfig(): Promise<PipelineConfig> {
    const { data } = await apiClient.get<PipelineConfig>('/api/v1/crm/pipeline-config');
    return data;
  },
};
```

### 6.3 `lib/queries/deals.queries.ts`

```typescript
'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { dealsApi, type DealsListResponse } from '@/lib/api/deals.api';
import type {
  Deal,
  DealCreateInput,
  DealUpdateInput,
  DealFilters,
  PipelineStage,
  LostReason,
} from '@/lib/schemas/deal.schema';

export const dealsKeys = {
  all: ['deals'] as const,
  lists: () => [...dealsKeys.all, 'list'] as const,
  list: (filters: DealFilters) => [...dealsKeys.lists(), filters] as const,
  kanban: (filters: DealFilters) => [...dealsKeys.all, 'kanban', filters] as const,
  details: () => [...dealsKeys.all, 'detail'] as const,
  detail: (id: string) => [...dealsKeys.details(), id] as const,
  timeline: (id: string) => [...dealsKeys.detail(id), 'timeline'] as const,
  pipelineConfig: () => ['pipeline-config'] as const,
};

export function useDealsList(filters: DealFilters) {
  return useInfiniteQuery({
    queryKey: dealsKeys.list(filters),
    queryFn: ({ pageParam }) => dealsApi.list({ ...filters, cursor: pageParam, limit: 50 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function useDealsKanban(filters: DealFilters) {
  return useQuery({
    queryKey: dealsKeys.kanban(filters),
    queryFn: () => dealsApi.listAllForKanban(filters),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useDealDetail(id: string) {
  return useQuery({
    queryKey: dealsKeys.detail(id),
    queryFn: () => dealsApi.getById(id),
    staleTime: 15_000,
    enabled: Boolean(id),
  });
}

export function useDealTimeline(id: string) {
  return useQuery({
    queryKey: dealsKeys.timeline(id),
    queryFn: () => dealsApi.getTimeline(id),
    staleTime: 60_000,
    enabled: Boolean(id),
  });
}

export function usePipelineConfig() {
  return useQuery({
    queryKey: dealsKeys.pipelineConfig(),
    queryFn: () => dealsApi.getPipelineConfig(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
}

export function useCreateDeal() {
  const qc = useQueryClient();
  const t = useTranslations('deals.toasts');
  return useMutation({
    mutationFn: (input: DealCreateInput) => dealsApi.create(input),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: dealsKeys.all });
      toast.success(t('created', { title: deal.title }));
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : t('createFailed');
      toast.error(msg);
    },
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  const t = useTranslations('deals.toasts');
  return useMutation({
    mutationFn: ({ id, input, etag }: { id: string; input: DealUpdateInput; etag: string }) =>
      dealsApi.update(id, input, etag),
    onSuccess: (deal) => {
      qc.setQueryData(dealsKeys.detail(deal.id), deal);
      qc.invalidateQueries({ queryKey: dealsKeys.lists() });
      qc.invalidateQueries({ queryKey: dealsKeys.kanban({}) });
      toast.success(t('updated'));
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : t('updateFailed');
      toast.error(msg);
    },
  });
}

interface MoveStageVars {
  deal_id: string;
  target_stage: PipelineStage;
  reason?: string;
  current_filters: DealFilters;
}

export function useMoveStage() {
  const qc = useQueryClient();
  const t = useTranslations('deals.toasts');

  return useMutation({
    mutationFn: ({ deal_id, target_stage, reason }: MoveStageVars) =>
      dealsApi.moveStage(deal_id, target_stage, reason),

    onMutate: async ({ deal_id, target_stage, current_filters }) => {
      const kanbanKey = dealsKeys.kanban(current_filters);
      await qc.cancelQueries({ queryKey: kanbanKey });
      const previous = qc.getQueryData<Deal[]>(kanbanKey);
      qc.setQueryData<Deal[]>(kanbanKey, (old) =>
        (old ?? []).map((d) =>
          d.id === deal_id
            ? { ...d, stage: target_stage, probability: probabilityForStage(target_stage, d.probability) }
            : d,
        ),
      );
      return { previous, kanbanKey };
    },

    onError: (err, _vars, ctx) => {
      if (ctx?.previous && ctx?.kanbanKey) {
        qc.setQueryData(ctx.kanbanKey, ctx.previous);
      }
      const msg = err instanceof Error ? err.message : t('moveFailed');
      toast.error(t('moveReverted', { reason: msg }));
    },

    onSuccess: (deal) => {
      toast.success(t('moved', { title: deal.title, stage: deal.stage }));
    },

    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: dealsKeys.kanban(vars.current_filters) });
      qc.invalidateQueries({ queryKey: dealsKeys.detail(vars.deal_id) });
      qc.invalidateQueries({ queryKey: dealsKeys.timeline(vars.deal_id) });
    },
  });
}

function probabilityForStage(stage: PipelineStage, currentProbability: number): number {
  const map: Record<PipelineStage, number> = {
    lead: 10,
    qualified: 30,
    proposal: 50,
    negotiation: 70,
    won: 100,
    lost: 0,
  };
  return map[stage] ?? currentProbability;
}

export function useMarkWon() {
  const qc = useQueryClient();
  const t = useTranslations('deals.toasts');
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { amount_final: number; reason: string; signed_at: string };
    }) => dealsApi.markWon(id, payload),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: dealsKeys.all });
      toast.success(t('won', { title: deal.title }));
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : t('wonFailed');
      toast.error(msg);
    },
  });
}

export function useMarkLost() {
  const qc = useQueryClient();
  const t = useTranslations('deals.toasts');
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { reason: LostReason; reason_text: string; lost_to_competitor?: string };
    }) => dealsApi.markLost(id, payload),
    onSuccess: (deal) => {
      qc.invalidateQueries({ queryKey: dealsKeys.all });
      toast.success(t('lost', { title: deal.title }));
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : t('lostFailed');
      toast.error(msg);
    },
  });
}
```

### 6.4 `lib/hooks/use-deal-pipeline.ts`

```typescript
'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { usePipelineConfig } from '@/lib/queries/deals.queries';
import type { PipelineStage } from '@/lib/schemas/deal.schema';

export interface PipelineStageInfo {
  key: PipelineStage;
  order: number;
  probability: number;
  color: string;
  label: string;
}

const DEFAULT_STAGES: Omit<PipelineStageInfo, 'label'>[] = [
  { key: 'lead', order: 1, probability: 10, color: 'slate' },
  { key: 'qualified', order: 2, probability: 30, color: 'blue' },
  { key: 'proposal', order: 3, probability: 50, color: 'amber' },
  { key: 'negotiation', order: 4, probability: 70, color: 'orange' },
  { key: 'won', order: 5, probability: 100, color: 'green' },
  { key: 'lost', order: 6, probability: 0, color: 'red' },
];

const STAGE_LABELS: Record<string, Record<PipelineStage, string>> = {
  fr: {
    lead: 'Lead',
    qualified: 'Qualifie',
    proposal: 'Proposition',
    negotiation: 'Negociation',
    won: 'Gagne',
    lost: 'Perdu',
  },
  'ar-MA': {
    lead: 'Lead',
    qualified: 'Qualifie',
    proposal: 'Proposition',
    negotiation: 'Negociation',
    won: 'Gagne',
    lost: 'Perdu',
  },
  ar: {
    lead: 'عميل محتمل',
    qualified: 'مؤهل',
    proposal: 'عرض',
    negotiation: 'تفاوض',
    won: 'مربوح',
    lost: 'خاسر',
  },
};

export function useDealPipeline() {
  const { data: config } = usePipelineConfig();
  const locale = useLocale();

  return useMemo(() => {
    const stages: PipelineStageInfo[] = (config?.stages ?? DEFAULT_STAGES).map((s) => ({
      key: s.key as PipelineStage,
      order: s.order,
      probability: s.probability,
      color: s.color ?? 'slate',
      label:
        (s as { label_fr?: string; label_ar_ma?: string; label_ar?: string })[
          locale === 'fr' ? 'label_fr' : locale === 'ar-MA' ? 'label_ar_ma' : 'label_ar'
        ] ?? STAGE_LABELS[locale]?.[s.key as PipelineStage] ?? s.key,
    }));

    return {
      stages,
      stageMap: new Map(stages.map((s) => [s.key, s])),
      getStageOrder: (key: PipelineStage) => stages.find((s) => s.key === key)?.order ?? 0,
      isRegression: (from: PipelineStage, to: PipelineStage) => {
        const fromOrder = stages.find((s) => s.key === from)?.order ?? 0;
        const toOrder = stages.find((s) => s.key === to)?.order ?? 0;
        return toOrder < fromOrder && to !== 'lost' && to !== 'won';
      },
      probabilityForStage: (key: PipelineStage) =>
        stages.find((s) => s.key === key)?.probability ?? 0,
    };
  }, [config, locale]);
}
```

### 6.5 `lib/hooks/use-deal-permissions.ts`

```typescript
'use client';

import { useAuth } from '@/lib/auth/use-auth';
import type { Deal } from '@/lib/schemas/deal.schema';

export function useDealPermissions() {
  const { user } = useAuth();
  const role = user?.role;

  return {
    canCreate: role === 'broker_admin' || role === 'broker_user' || role === 'broker_assistant',
    canEdit: (deal: Deal) =>
      role === 'broker_admin' || (role === 'broker_user' && deal.owner_id === user?.id),
    canMoveStage: (deal: Deal) =>
      role === 'broker_admin' || (role === 'broker_user' && deal.owner_id === user?.id),
    canMarkWonLost: (deal: Deal) =>
      role === 'broker_admin' || (role === 'broker_user' && deal.owner_id === user?.id),
    canViewAll: role === 'broker_admin',
    isAssistant: role === 'broker_assistant',
  };
}
```

### 6.6 `lib/utils/deal-formatters.ts`

```typescript
import { formatInTimeZone } from 'date-fns-tz';
import { formatDistanceToNowStrict, differenceInDays } from 'date-fns';
import { fr, arSA } from 'date-fns/locale';

const TZ = 'Africa/Casablanca';

export function formatMAD(amount: number, locale: string): string {
  const normalizedLocale = locale === 'ar-MA' ? 'ar-MA' : locale === 'ar' ? 'ar' : 'fr-MA';
  return new Intl.NumberFormat(normalizedLocale, {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatMADCompact(amount: number, locale: string): string {
  const normalizedLocale = locale === 'ar-MA' || locale === 'ar' ? 'ar' : 'fr-MA';
  return new Intl.NumberFormat(normalizedLocale, {
    style: 'currency',
    currency: 'MAD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatDealDate(iso: string | null, locale: string): string {
  if (!iso) return '-';
  return formatInTimeZone(new Date(iso), TZ, 'dd MMM yyyy', {
    locale: locale.startsWith('ar') ? arSA : fr,
  });
}

export function formatDealDateRelative(iso: string | null, locale: string): string {
  if (!iso) return '-';
  return formatDistanceToNowStrict(new Date(iso), {
    addSuffix: true,
    locale: locale.startsWith('ar') ? arSA : fr,
  });
}

export function getDealUrgency(iso: string | null): 'overdue' | 'urgent' | 'soon' | 'normal' {
  if (!iso) return 'normal';
  const diff = differenceInDays(new Date(iso), new Date());
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'urgent';
  if (diff <= 14) return 'soon';
  return 'normal';
}

export function formatDurationMs(ms: number | null, locale: string): string {
  if (ms === null || ms === undefined) return '-';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const isAr = locale.startsWith('ar');
  if (days >= 1) {
    return isAr ? `${days} يوم` : `${days} j`;
  }
  return isAr ? `${hours} س` : `${hours} h`;
}

export function probabilityColor(probability: number): string {
  if (probability >= 70) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (probability >= 40) return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  if (probability >= 10) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
}

export function stageBadgeColor(stage: string): string {
  const map: Record<string, string> = {
    lead: 'bg-slate-100 text-slate-800',
    qualified: 'bg-blue-100 text-blue-800',
    proposal: 'bg-amber-100 text-amber-800',
    negotiation: 'bg-orange-100 text-orange-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800',
  };
  return map[stage] ?? 'bg-slate-100 text-slate-800';
}
```

### 6.7 `app/[locale]/(protected)/deals/page.tsx`

```typescript
import { Suspense } from 'react';
import { createSearchParamsCache, parseAsString, parseAsArrayOf, parseAsInteger, parseAsIsoDateTime } from 'nuqs/server';
import { getTranslations } from 'next-intl/server';
import { DealsViewSwitcher } from '@/components/deals/deals-view-switcher';
import { DealsPageHeader } from './_components/deals-page-header';
import { DealsKanbanSkeleton } from '@/components/deals/deals-kanban';
import { dealsApi } from '@/lib/api/deals.api';

export const dynamic = 'force-dynamic';

const searchParamsCache = createSearchParamsCache({
  view: parseAsString.withDefault('kanban'),
  stage: parseAsArrayOf(parseAsString).withDefault([]),
  owner_id: parseAsString,
  contact_id: parseAsString,
  company_id: parseAsString,
  branche: parseAsString,
  amount_min: parseAsInteger,
  amount_max: parseAsInteger,
  close_from: parseAsIsoDateTime,
  close_to: parseAsIsoDateTime,
  search: parseAsString.withDefault(''),
});

interface DealsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: DealsPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'deals.meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function DealsPage({ params, searchParams }: DealsPageProps) {
  const { locale } = await params;
  const resolvedSearch = await searchParams;
  const parsed = searchParamsCache.parse(resolvedSearch);

  const t = await getTranslations({ locale, namespace: 'deals' });

  const initialData = await dealsApi.list({
    stage: parsed.stage.length ? (parsed.stage as never) : undefined,
    owner_id: parsed.owner_id ?? undefined,
    contact_id: parsed.contact_id ?? undefined,
    company_id: parsed.company_id ?? undefined,
    branche: parsed.branche as never | undefined,
    amount_min: parsed.amount_min ?? undefined,
    amount_max: parsed.amount_max ?? undefined,
    close_from: parsed.close_from?.toISOString(),
    close_to: parsed.close_to?.toISOString(),
    search: parsed.search || undefined,
    limit: 200,
  }).catch(() => ({ items: [], next_cursor: null, total: 0 }));

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen">
      <DealsPageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: initialData.total })}
        totalCount={initialData.total}
      />
      <Suspense fallback={<DealsKanbanSkeleton />}>
        <DealsViewSwitcher initialDeals={initialData.items} initialView={parsed.view as 'kanban' | 'table'} />
      </Suspense>
    </div>
  );
}
```

### 6.8 `components/deals/deals-view-switcher.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Table as TableIcon, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DealsKanban } from './deals-kanban';
import { DealsTable } from './deals-table';
import { DealsFilters } from './deals-filters';
import { DealFormDialog } from './deal-form-dialog';
import type { Deal } from '@/lib/schemas/deal.schema';
import { useDealPermissions } from '@/lib/hooks/use-deal-permissions';

interface DealsViewSwitcherProps {
  initialDeals: Deal[];
  initialView: 'kanban' | 'table';
}

export function DealsViewSwitcher({ initialDeals, initialView }: DealsViewSwitcherProps) {
  const t = useTranslations('deals');
  const [view, setView] = useQueryState(
    'view',
    parseAsString.withDefault(initialView).withOptions({ shallow: false }),
  );
  const [createOpen, setCreateOpen] = useState(false);
  const { canCreate } = useDealPermissions();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as 'kanban' | 'table')}
          aria-label={t('viewToggle.ariaLabel')}
        >
          <ToggleGroupItem value="kanban" aria-label={t('viewToggle.kanban')}>
            <LayoutGrid className="h-4 w-4 me-2" />
            {t('viewToggle.kanban')}
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label={t('viewToggle.table')}>
            <TableIcon className="h-4 w-4 me-2" />
            {t('viewToggle.table')}
          </ToggleGroupItem>
        </ToggleGroup>

        {canCreate && (
          <Button onClick={() => setCreateOpen(true)} data-testid="btn-create-deal">
            <Plus className="h-4 w-4 me-2" />
            {t('actions.create')}
          </Button>
        )}
      </div>

      <DealsFilters />

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {view === 'kanban' ? (
            <DealsKanban initialDeals={initialDeals} />
          ) : (
            <DealsTable initialDeals={initialDeals} />
          )}
        </motion.div>
      </AnimatePresence>

      <DealFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
```

### 6.9 `components/deals/deals-kanban.tsx`

```typescript
'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { KanbanColumn } from './kanban-column';
import { DealCard } from './deal-card';
import { MoveStageReasonDialog } from './move-stage-reason-dialog';
import { WonLostDialog } from './won-lost-dialog';
import { useDealsKanban, useMoveStage } from '@/lib/queries/deals.queries';
import { useDealPipeline } from '@/lib/hooks/use-deal-pipeline';
import { useDealPermissions } from '@/lib/hooks/use-deal-permissions';
import { useDealsFilters } from './deals-filters';
import { Skeleton } from '@/components/ui/skeleton';
import type { Deal, PipelineStage } from '@/lib/schemas/deal.schema';
import { Loader2 } from 'lucide-react';

interface DealsKanbanProps {
  initialDeals: Deal[];
}

interface PendingMove {
  deal: Deal;
  target_stage: PipelineStage;
}

export function DealsKanban({ initialDeals }: DealsKanbanProps) {
  const t = useTranslations('deals.kanban');
  const filters = useDealsFilters();
  const { data: deals = initialDeals, isLoading } = useDealsKanban(filters);
  const { stages, isRegression } = useDealPipeline();
  const { canMoveStage, canMarkWonLost } = useDealPermissions();
  const moveStageMutation = useMoveStage();

  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [wonLostMode, setWonLostMode] = useState<{ deal: Deal; mode: 'won' | 'lost' } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<PipelineStage, Deal[]>();
    stages.forEach((s) => map.set(s.key, []));
    deals.forEach((d) => {
      const arr = map.get(d.stage);
      if (arr) arr.push(d);
    });
    return map;
  }, [deals, stages]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const deal = deals.find((d) => d.id === event.active.id);
      if (deal && canMoveStage(deal)) {
        setActiveDeal(deal);
      }
    },
    [deals, canMoveStage],
  );

  const handleDragOver = useCallback((_event: DragOverEvent) => {
    // visual feedback handled by KanbanColumn via useDroppable
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDeal(null);
      const { active, over } = event;
      if (!over) return;
      const deal = deals.find((d) => d.id === active.id);
      if (!deal) return;
      if (!canMoveStage(deal)) return;

      const targetStage = over.id as PipelineStage;
      if (deal.stage === targetStage) return;

      if ((targetStage === 'won' || targetStage === 'lost') && canMarkWonLost(deal)) {
        setWonLostMode({ deal, mode: targetStage });
        return;
      }

      if (isRegression(deal.stage, targetStage)) {
        setPendingMove({ deal, target_stage: targetStage });
        return;
      }

      moveStageMutation.mutate({
        deal_id: deal.id,
        target_stage: targetStage,
        current_filters: filters,
      });
    },
    [deals, canMoveStage, canMarkWonLost, isRegression, moveStageMutation, filters],
  );

  if (isLoading && !deals.length) {
    return <DealsKanbanSkeleton />;
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div
          className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory rtl:flex-row-reverse"
          data-testid="kanban-board"
          role="region"
          aria-label={t('boardAriaLabel')}
        >
          {stages.map((stage) => (
            <KanbanColumn
              key={stage.key}
              stage={stage}
              deals={dealsByStage.get(stage.key) ?? []}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeDeal ? (
            <motion.div
              initial={{ rotate: 0, scale: 1 }}
              animate={{ rotate: 2, scale: 1.04 }}
              transition={{ duration: 0.15 }}
              className="opacity-90"
            >
              <DealCard deal={activeDeal} isDragging />
            </motion.div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {pendingMove && (
        <MoveStageReasonDialog
          deal={pendingMove.deal}
          targetStage={pendingMove.target_stage}
          open={Boolean(pendingMove)}
          onOpenChange={(o) => !o && setPendingMove(null)}
          onConfirm={(reason) => {
            moveStageMutation.mutate({
              deal_id: pendingMove.deal.id,
              target_stage: pendingMove.target_stage,
              reason,
              current_filters: filters,
            });
            setPendingMove(null);
          }}
        />
      )}

      {wonLostMode && (
        <WonLostDialog
          deal={wonLostMode.deal}
          mode={wonLostMode.mode}
          open={Boolean(wonLostMode)}
          onOpenChange={(o) => !o && setWonLostMode(null)}
        />
      )}

      {moveStageMutation.isPending && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 rounded-md bg-card border px-3 py-2 shadow-md">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t('syncing')}</span>
        </div>
      )}
    </>
  );
}

export function DealsKanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="w-80 flex-shrink-0 space-y-3">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} className="h-32 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### 6.10 `components/deals/kanban-column.tsx`

```typescript
'use client';

import { useDroppable } from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { DealCard } from './deal-card';
import { formatMADCompact } from '@/lib/utils/deal-formatters';
import type { Deal } from '@/lib/schemas/deal.schema';
import type { PipelineStageInfo } from '@/lib/hooks/use-deal-pipeline';

interface KanbanColumnProps {
  stage: PipelineStageInfo;
  deals: Deal[];
}

const COLUMN_COLOR_MAP: Record<string, string> = {
  slate: 'bg-slate-50 dark:bg-slate-900/40 border-slate-200',
  blue: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200',
  amber: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200',
  orange: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200',
  green: 'bg-green-50 dark:bg-green-950/30 border-green-200',
  red: 'bg-red-50 dark:bg-red-950/30 border-red-200',
};

export function KanbanColumn({ stage, deals }: KanbanColumnProps) {
  const t = useTranslations('deals.kanban');
  const locale = useLocale();
  const { isOver, setNodeRef } = useDroppable({ id: stage.key });
  const scrollRef = useRef<HTMLDivElement>(null);

  const totalAmount = deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const shouldVirtualize = deals.length > 50;

  const virtualizer = useVirtualizer({
    count: deals.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 144,
    overscan: 6,
    enabled: shouldVirtualize,
  });

  return (
    <motion.div
      ref={setNodeRef}
      animate={{
        scale: isOver ? 1.01 : 1,
        boxShadow: isOver
          ? '0 0 0 2px var(--ring), 0 12px 24px -8px rgba(0,0,0,0.18)'
          : '0 1px 2px 0 rgba(0,0,0,0.05)',
      }}
      transition={{ duration: 0.15 }}
      className={cn(
        'w-80 flex-shrink-0 snap-start rounded-lg border-2 border-dashed',
        COLUMN_COLOR_MAP[stage.color] ?? COLUMN_COLOR_MAP.slate,
        isOver && 'border-solid',
      )}
      data-testid={`kanban-column-${stage.key}`}
      data-stage={stage.key}
    >
      <div className="sticky top-0 z-10 p-3 border-b backdrop-blur-sm bg-card/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide">{stage.label}</h3>
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-muted">
              {deals.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">{stage.probability}%</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {formatMADCompact(totalAmount, locale)}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="overflow-y-auto max-h-[calc(100vh-280px)] p-2"
        role="list"
        aria-label={t('columnAriaLabel', { stage: stage.label, count: deals.length })}
      >
        {deals.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            {t('emptyColumn')}
          </div>
        ) : shouldVirtualize ? (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const deal = deals[virtualRow.index];
              return (
                <div
                  key={deal.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <DealCard deal={deal} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {deals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

### 6.11 `components/deals/deal-card.tsx`

```typescript
'use client';

import { useDraggable } from '@dnd-kit/core';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { MoreHorizontal, Calendar, Building2, User, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  formatMAD,
  formatDealDate,
  formatDealDateRelative,
  getDealUrgency,
  probabilityColor,
} from '@/lib/utils/deal-formatters';
import { useDealPermissions } from '@/lib/hooks/use-deal-permissions';
import type { Deal } from '@/lib/schemas/deal.schema';

interface DealCardProps {
  deal: Deal;
  isDragging?: boolean;
  onWonClick?: (deal: Deal) => void;
  onLostClick?: (deal: Deal) => void;
  onEditClick?: (deal: Deal) => void;
}

export function DealCard({ deal, isDragging, onWonClick, onLostClick, onEditClick }: DealCardProps) {
  const t = useTranslations('deals.card');
  const locale = useLocale();
  const { canMoveStage, canMarkWonLost, canEdit } = useDealPermissions();
  const { attributes, listeners, setNodeRef, transform, isDragging: dragging } = useDraggable({
    id: deal.id,
    disabled: !canMoveStage(deal),
    data: { deal },
  });

  const urgency = getDealUrgency(deal.expected_close_date);
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <motion.div
      layout
      layoutId={`deal-${deal.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing',
        (dragging || isDragging) && 'opacity-50',
        urgency === 'overdue' && 'border-red-300 dark:border-red-700',
      )}
      data-testid={`deal-card-${deal.id}`}
      data-deal-id={deal.id}
      data-stage={deal.stage}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/deals/${deal.id}`}
          className="text-sm font-medium leading-tight hover:underline truncate flex-1"
          onClick={(e) => e.stopPropagation()}
        >
          {deal.title}
        </Link>
        {(canEdit(deal) || canMarkWonLost(deal)) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100"
                aria-label={t('moreActions')}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canEdit(deal) && (
                <DropdownMenuItem onClick={() => onEditClick?.(deal)}>{t('edit')}</DropdownMenuItem>
              )}
              {canMarkWonLost(deal) && deal.stage !== 'won' && deal.stage !== 'lost' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onWonClick?.(deal)}>
                    <Badge className="bg-green-100 text-green-800 me-2">{t('won')}</Badge>
                    {t('markAsWon')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onLostClick?.(deal)}>
                    <Badge className="bg-red-100 text-red-800 me-2">{t('lost')}</Badge>
                    {t('markAsLost')}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="mt-2 text-base font-semibold text-primary">
        {formatMAD(deal.amount, locale)}
      </div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {deal.contact && (
          <div className="flex items-center gap-1.5 truncate">
            <User className="h-3 w-3" />
            <span className="truncate">{deal.contact.full_name}</span>
          </div>
        )}
        {deal.company && (
          <div className="flex items-center gap-1.5 truncate">
            <Building2 className="h-3 w-3" />
            <span className="truncate">{deal.company.legal_name}</span>
          </div>
        )}
        {deal.expected_close_date && (
          <div
            className={cn(
              'flex items-center gap-1.5',
              urgency === 'overdue' && 'text-red-600 font-medium',
              urgency === 'urgent' && 'text-orange-600',
            )}
          >
            <Calendar className="h-3 w-3" />
            <span>
              {formatDealDate(deal.expected_close_date, locale)}
              {' '}
              <span className="opacity-70">({formatDealDateRelative(deal.expected_close_date, locale)})</span>
            </span>
            {urgency === 'overdue' && <AlertCircle className="h-3 w-3 text-red-600" />}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1 flex-wrap">
          {deal.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
          {deal.tags.length > 2 && (
            <span className="text-[10px] text-muted-foreground">+{deal.tags.length - 2}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn('text-[10px] px-1.5 py-0', probabilityColor(deal.probability))}>
            {deal.probability}%
          </Badge>
          {deal.owner && (
            <Avatar className="h-5 w-5">
              <AvatarImage src={deal.owner.avatar_url ?? undefined} alt={deal.owner.full_name} />
              <AvatarFallback className="text-[9px]">
                {deal.owner.full_name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </motion.div>
  );
}
```

### 6.12bis `components/deals/deals-filters.tsx`

```typescript
'use client';

import { useMemo } from 'react';
import {
  useQueryStates,
  parseAsArrayOf,
  parseAsString,
  parseAsInteger,
  parseAsIsoDateTime,
} from 'nuqs';
import { useTranslations } from 'next-intl';
import { X, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ContactAutocomplete } from '@/components/contacts/contact-autocomplete';
import { CompanyAutocomplete } from '@/components/companies/company-autocomplete';
import { UserAutocomplete } from '@/components/users/user-autocomplete';
import { PIPELINE_STAGES, BRANCHES_ASSURANCE, type DealFilters } from '@/lib/schemas/deal.schema';

const filtersParsers = {
  stage: parseAsArrayOf(parseAsString).withDefault([]),
  owner_id: parseAsString,
  contact_id: parseAsString,
  company_id: parseAsString,
  branche: parseAsString,
  amount_min: parseAsInteger,
  amount_max: parseAsInteger,
  close_from: parseAsIsoDateTime,
  close_to: parseAsIsoDateTime,
  search: parseAsString.withDefault(''),
};

export function useDealsFilters(): DealFilters {
  const [filters] = useQueryStates(filtersParsers);
  return useMemo(
    () => ({
      stage: filters.stage.length ? (filters.stage as never) : undefined,
      owner_id: filters.owner_id ?? undefined,
      contact_id: filters.contact_id ?? undefined,
      company_id: filters.company_id ?? undefined,
      branche: filters.branche as never | undefined,
      amount_min: filters.amount_min ?? undefined,
      amount_max: filters.amount_max ?? undefined,
      close_from: filters.close_from?.toISOString(),
      close_to: filters.close_to?.toISOString(),
      search: filters.search || undefined,
    }),
    [filters],
  );
}

export function DealsFilters() {
  const t = useTranslations('deals.filters');
  const [filters, setFilters] = useQueryStates(filtersParsers, {
    shallow: false,
    throttleMs: 300,
  });

  const activeCount = Object.entries(filters).filter(
    ([k, v]) => k !== 'search' && (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined),
  ).length;

  const reset = () =>
    setFilters({
      stage: [],
      owner_id: null,
      contact_id: null,
      company_id: null,
      branche: null,
      amount_min: null,
      amount_max: null,
      close_from: null,
      close_to: null,
      search: '',
    });

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-card p-4" data-testid="deals-filters">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search ?? ''}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder={t('searchPlaceholder')}
            className="ps-9"
            data-testid="filter-search"
          />
        </div>
        <Select
          value={(filters.stage[0] as string) ?? ''}
          onValueChange={(v) => setFilters({ stage: v ? [v] : [] })}
        >
          <SelectTrigger className="w-44" data-testid="filter-stage">
            <SelectValue placeholder={t('stagePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`stages.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={(filters.branche as string) ?? ''}
          onValueChange={(v) => setFilters({ branche: v || null })}
        >
          <SelectTrigger className="w-44" data-testid="filter-branche">
            <SelectValue placeholder={t('branchePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {BRANCHES_ASSURANCE.map((b) => (
              <SelectItem key={b} value={b}>
                {t(`branches.${b}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <UserAutocomplete
          value={filters.owner_id ?? null}
          onChange={(id) => setFilters({ owner_id: id })}
          placeholder={t('ownerPlaceholder')}
          roleFilter={['broker_admin', 'broker_user']}
          data-testid="filter-owner"
        />
        <DateRangePicker
          from={filters.close_from ?? null}
          to={filters.close_to ?? null}
          onChange={(from, to) =>
            setFilters({
              close_from: from?.toISOString() ?? null,
              close_to: to?.toISOString() ?? null,
            })
          }
          placeholder={t('closeDatePlaceholder')}
          data-testid="filter-date"
        />
        <div className="flex items-center gap-2 min-w-[220px]">
          <span className="text-xs text-muted-foreground">{t('amountLabel')}:</span>
          <Slider
            min={0}
            max={1_000_000}
            step={5_000}
            value={[filters.amount_min ?? 0, filters.amount_max ?? 1_000_000]}
            onValueChange={([min, max]) =>
              setFilters({
                amount_min: min > 0 ? min : null,
                amount_max: max < 1_000_000 ? max : null,
              })
            }
            data-testid="filter-amount"
          />
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} data-testid="filters-reset">
            <X className="h-4 w-4 me-1" />
            {t('reset')}
            <Badge variant="secondary" className="ms-2">
              {activeCount}
            </Badge>
          </Button>
        )}
      </div>
    </div>
  );
}
```

### 6.12 `components/deals/deals-table.tsx`

```typescript
'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatMAD, formatDealDate, stageBadgeColor, probabilityColor } from '@/lib/utils/deal-formatters';
import { useDealsList } from '@/lib/queries/deals.queries';
import { useDealsFilters } from './deals-filters';
import { EmptyState } from './empty-state';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { Deal } from '@/lib/schemas/deal.schema';

interface DealsTableProps {
  initialDeals: Deal[];
}

export function DealsTable({ initialDeals }: DealsTableProps) {
  const t = useTranslations('deals.table');
  const locale = useLocale();
  const filters = useDealsFilters();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useDealsList(filters);
  const rows: Deal[] = data ? data.pages.flatMap((p) => p.items) : initialDeals;

  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<Deal>[]>(
    () => [
      {
        accessorKey: 'title',
        header: t('cols.title'),
        cell: ({ row }) => (
          <Link href={`/deals/${row.original.id}`} className="font-medium hover:underline">
            {row.original.title}
          </Link>
        ),
      },
      {
        accessorKey: 'amount',
        header: t('cols.amount'),
        cell: ({ row }) => formatMAD(row.original.amount, locale),
      },
      {
        accessorKey: 'stage',
        header: t('cols.stage'),
        cell: ({ row }) => (
          <Badge className={stageBadgeColor(row.original.stage)}>
            {t(`stages.${row.original.stage}`)}
          </Badge>
        ),
      },
      {
        accessorKey: 'probability',
        header: t('cols.probability'),
        cell: ({ row }) => (
          <Badge className={probabilityColor(row.original.probability)}>
            {row.original.probability}%
          </Badge>
        ),
      },
      {
        accessorKey: 'contact',
        header: t('cols.contact'),
        cell: ({ row }) => row.original.contact?.full_name ?? '-',
      },
      {
        accessorKey: 'company',
        header: t('cols.company'),
        cell: ({ row }) => row.original.company?.legal_name ?? '-',
      },
      {
        accessorKey: 'branche',
        header: t('cols.branche'),
        cell: ({ row }) =>
          row.original.branche ? t(`branches.${row.original.branche}`) : '-',
      },
      {
        accessorKey: 'expected_close_date',
        header: t('cols.expectedClose'),
        cell: ({ row }) => formatDealDate(row.original.expected_close_date, locale),
      },
      {
        accessorKey: 'owner',
        header: t('cols.owner'),
        cell: ({ row }) =>
          row.original.owner ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={row.original.owner.avatar_url ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {row.original.owner.full_name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{row.original.owner.full_name}</span>
            </div>
          ) : (
            '-'
          ),
      },
    ],
    [t, locale],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return <EmptyState title={t('empty.title')} description={t('empty.description')} />;
  }

  return (
    <div className="rounded-md border" data-testid="deals-table">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead
                  key={h.id}
                  onClick={h.column.getToggleSortingHandler()}
                  className="cursor-pointer select-none"
                >
                  <div className="flex items-center gap-1">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === 'asc' && <ChevronUp className="h-3 w-3" />}
                    {h.column.getIsSorted() === 'desc' && <ChevronDown className="h-3 w-3" />}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id} data-deal-id={row.original.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hasNextPage && (
        <div className="p-4 text-center">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            data-testid="load-more"
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin me-2" />
                {t('loadingMore')}
              </>
            ) : (
              t('loadMore')
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 6.13 `components/deals/deal-form-dialog.tsx` (create / edit modal)

```typescript
'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { TagsInput } from '@/components/ui/tags-input';
import { ContactAutocomplete } from '@/components/contacts/contact-autocomplete';
import { CompanyAutocomplete } from '@/components/companies/company-autocomplete';
import { dealCreateSchema, type DealCreateInput, PIPELINE_STAGES, BRANCHES_ASSURANCE, DEAL_SOURCES } from '@/lib/schemas/deal.schema';
import { useCreateDeal, useUpdateDeal } from '@/lib/queries/deals.queries';
import { useDealPipeline } from '@/lib/hooks/use-deal-pipeline';
import type { Deal } from '@/lib/schemas/deal.schema';
import { Loader2 } from 'lucide-react';

interface DealFormDialogProps {
  mode: 'create' | 'edit';
  deal?: Deal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealFormDialog({ mode, deal, open, onOpenChange }: DealFormDialogProps) {
  const t = useTranslations('deals.form');
  const { probabilityForStage } = useDealPipeline();
  const createMutation = useCreateDeal();
  const updateMutation = useUpdateDeal();

  const form = useForm<DealCreateInput>({
    resolver: zodResolver(dealCreateSchema),
    defaultValues: {
      title: deal?.title ?? '',
      amount: deal?.amount ?? 0,
      currency: 'MAD',
      stage: deal?.stage ?? 'lead',
      contact_id: deal?.contact_id ?? null,
      company_id: deal?.company_id ?? null,
      branche: deal?.branche ?? null,
      expected_close_date: deal?.expected_close_date ?? null,
      probability: deal?.probability ?? 10,
      source: deal?.source ?? 'inbound',
      tags: deal?.tags ?? [],
    },
  });

  const watchedStage = form.watch('stage');
  useEffect(() => {
    if (mode === 'create') form.setValue('probability', probabilityForStage(watchedStage));
  }, [watchedStage, probabilityForStage, form, mode]);

  const submit = form.handleSubmit(async (values) => {
    if (mode === 'create') await createMutation.mutateAsync(values);
    else if (deal) await updateMutation.mutateAsync({ id: deal.id, input: values, etag: deal.etag });
    onOpenChange(false);
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]" data-testid="deal-form-dialog">
        <DialogHeader>
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">{t('fields.title')} *</Label>
            <Input id="title" {...form.register('title')} data-testid="deal-title" />
            {form.formState.errors.title && <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">{t('fields.amount')} (MAD) *</Label>
              <Input id="amount" type="number" step="0.01" {...form.register('amount', { valueAsNumber: true })} data-testid="deal-amount" />
              {form.formState.errors.amount && <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stage">{t('fields.stage')} *</Label>
              <Controller control={form.control} name="stage" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="stage" data-testid="deal-stage"><SelectValue /></SelectTrigger>
                  <SelectContent>{PIPELINE_STAGES.map((s) => <SelectItem key={s} value={s}>{t(`stages.${s}`)}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t('fields.contact')}</Label>
              <Controller control={form.control} name="contact_id" render={({ field }) => <ContactAutocomplete value={field.value ?? null} onChange={field.onChange} />} />
            </div>
            <div className="grid gap-2">
              <Label>{t('fields.company')}</Label>
              <Controller control={form.control} name="company_id" render={({ field }) => <CompanyAutocomplete value={field.value ?? null} onChange={field.onChange} />} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t('fields.branche')}</Label>
              <Controller control={form.control} name="branche" render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)}>
                  <SelectTrigger data-testid="deal-branche"><SelectValue placeholder={t('fields.branchePlaceholder')} /></SelectTrigger>
                  <SelectContent>{BRANCHES_ASSURANCE.map((b) => <SelectItem key={b} value={b}>{t(`branches.${b}`)}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
            <div className="grid gap-2">
              <Label>{t('fields.source')}</Label>
              <Controller control={form.control} name="source" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger data-testid="deal-source"><SelectValue /></SelectTrigger>
                  <SelectContent>{DEAL_SOURCES.map((s) => <SelectItem key={s} value={s}>{t(`sources.${s}`)}</SelectItem>)}</SelectContent>
                </Select>
              )} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t('fields.expectedCloseDate')}</Label>
              <Controller control={form.control} name="expected_close_date" render={({ field }) => (
                <DatePicker value={field.value ? new Date(field.value) : null} onChange={(d) => field.onChange(d?.toISOString() ?? null)} timezone="Africa/Casablanca" />
              )} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="probability">{t('fields.probability')} (%)</Label>
              <Input id="probability" type="number" min="0" max="100" step="5" {...form.register('probability', { valueAsNumber: true })} data-testid="deal-probability" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t('fields.tags')}</Label>
            <Controller control={form.control} name="tags" render={({ field }) => <TagsInput value={field.value} onChange={field.onChange} maxTags={10} />} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>{t('actions.cancel')}</Button>
            <Button type="submit" disabled={isSubmitting} data-testid="deal-submit">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {mode === 'create' ? t('actions.create') : t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.14 `components/deals/won-lost-dialog.tsx` (won / lost shortcuts with reason)

```typescript
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { wonSchema, lostSchema, LOST_REASONS, type Deal } from '@/lib/schemas/deal.schema';
import { useMarkWon, useMarkLost } from '@/lib/queries/deals.queries';
import { Loader2 } from 'lucide-react';

interface WonLostDialogProps {
  deal: Deal;
  mode: 'won' | 'lost';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WonLostDialog({ deal, mode, open, onOpenChange }: WonLostDialogProps) {
  const t = useTranslations('deals.wonLost');
  const wonMutation = useMarkWon();
  const lostMutation = useMarkLost();
  if (mode === 'won') return <WonForm deal={deal} open={open} onOpenChange={onOpenChange} mutation={wonMutation} t={t} />;
  return <LostForm deal={deal} open={open} onOpenChange={onOpenChange} mutation={lostMutation} t={t} />;
}

function WonForm({ deal, open, onOpenChange, mutation, t }: any) {
  const form = useForm({
    resolver: zodResolver(wonSchema),
    defaultValues: { amount_final: deal.amount, reason: '', signed_at: new Date().toISOString() },
  });
  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync({ id: deal.id, payload: values });
    onOpenChange(false);
  });
  const amountFinal = form.watch('amount_final');
  const showWarning = amountFinal > deal.amount * 1.5;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="won-dialog">
        <DialogHeader>
          <DialogTitle>{t('won.title', { title: deal.title })}</DialogTitle>
          <DialogDescription>{t('won.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount_final">{t('won.amountFinal')} (MAD) *</Label>
            <Input id="amount_final" type="number" step="0.01" {...form.register('amount_final', { valueAsNumber: true })} data-testid="won-amount" />
            {showWarning && <p className="text-xs text-amber-600">{t('won.warningAmountHigh')}</p>}
          </div>
          <div className="grid gap-2">
            <Label>{t('won.signedAt')} *</Label>
            <Controller control={form.control} name="signed_at" render={({ field }) => (
              <DatePicker value={field.value ? new Date(field.value) : null} onChange={(d) => field.onChange(d?.toISOString() ?? new Date().toISOString())} timezone="Africa/Casablanca" />
            )} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">{t('won.reason')} *</Label>
            <Textarea id="reason" rows={3} {...form.register('reason')} placeholder={t('won.reasonPlaceholder')} data-testid="won-reason" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('actions.cancel')}</Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="won-submit">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}{t('won.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LostForm({ deal, open, onOpenChange, mutation, t }: any) {
  const form = useForm({
    resolver: zodResolver(lostSchema),
    defaultValues: { reason: 'PRICE_TOO_HIGH', reason_text: '', lost_to_competitor: '' },
  });
  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync({ id: deal.id, payload: { reason: values.reason, reason_text: values.reason_text, lost_to_competitor: values.lost_to_competitor || undefined } });
    onOpenChange(false);
  });
  const watchedReason = form.watch('reason');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="lost-dialog">
        <DialogHeader>
          <DialogTitle>{t('lost.title', { title: deal.title })}</DialogTitle>
          <DialogDescription>{t('lost.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label>{t('lost.reason')} *</Label>
            <Controller control={form.control} name="reason" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger data-testid="lost-reason"><SelectValue /></SelectTrigger>
                <SelectContent>{LOST_REASONS.map((r) => <SelectItem key={r} value={r}>{t(`lost.reasons.${r}`)}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          {watchedReason === 'COMPETITOR_WON' && (
            <div className="grid gap-2">
              <Label>{t('lost.competitor')}</Label>
              <Input {...form.register('lost_to_competitor')} data-testid="lost-competitor" />
            </div>
          )}
          <div className="grid gap-2">
            <Label>{t('lost.reasonText')} *</Label>
            <Textarea rows={3} {...form.register('reason_text')} placeholder={t('lost.reasonTextPlaceholder')} data-testid="lost-reason-text" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t('actions.cancel')}</Button>
            <Button type="submit" disabled={mutation.isPending} variant="destructive" data-testid="lost-submit">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}{t('lost.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.15 `components/deals/move-stage-reason-dialog.tsx` (regression prompt)

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import type { Deal, PipelineStage } from '@/lib/schemas/deal.schema';
import { useDealPipeline } from '@/lib/hooks/use-deal-pipeline';

interface MoveStageReasonDialogProps {
  deal: Deal;
  targetStage: PipelineStage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function MoveStageReasonDialog({ deal, targetStage, open, onOpenChange, onConfirm }: MoveStageReasonDialogProps) {
  const t = useTranslations('deals.moveStageReason');
  const { stageMap } = useDealPipeline();
  const [reason, setReason] = useState('');
  const fromLabel = stageMap.get(deal.stage)?.label ?? deal.stage;
  const toLabel = stageMap.get(targetStage)?.label ?? targetStage;
  const valid = reason.trim().length >= 10;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="move-stage-reason-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /><DialogTitle>{t('title')}</DialogTitle></div>
          <DialogDescription>{t('description', { from: fromLabel, to: toLabel, title: deal.title })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="reason">{t('reasonLabel')} *</Label>
          <Textarea id="reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('reasonPlaceholder')} data-testid="move-stage-reason-text" />
          <p className="text-xs text-muted-foreground">{t('reasonHint')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
          <Button onClick={() => valid && onConfirm(reason.trim())} disabled={!valid} data-testid="move-stage-reason-confirm">{t('confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.16 `components/deals/deal-timeline.tsx` (audit log display)

```typescript
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Clock, User as UserIcon } from 'lucide-react';
import { useDealTimeline } from '@/lib/queries/deals.queries';
import { useDealPipeline } from '@/lib/hooks/use-deal-pipeline';
import { formatDealDate, formatDurationMs, stageBadgeColor } from '@/lib/utils/deal-formatters';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function DealTimeline({ dealId }: { dealId: string }) {
  const t = useTranslations('deals.timeline');
  const locale = useLocale();
  const { data, isLoading } = useDealTimeline(dealId);
  const { stageMap } = useDealPipeline();
  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  if (!data || data.items.length === 0) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  return (
    <ol className="relative border-s ps-6 space-y-6" data-testid="deal-timeline">
      {data.items.map((tr) => (
        <li key={tr.id} className="relative">
          <span className="absolute -start-[33px] top-1 inline-flex h-4 w-4 rounded-full border-2 border-background bg-primary" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {tr.from_stage ? (
              <><Badge className={stageBadgeColor(tr.from_stage)}>{stageMap.get(tr.from_stage)?.label ?? tr.from_stage}</Badge><ArrowRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" /></>
            ) : (<span className="text-xs text-muted-foreground">{t('created')}</span>)}
            <Badge className={stageBadgeColor(tr.to_stage)}>{stageMap.get(tr.to_stage)?.label ?? tr.to_stage}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{tr.actor_name}</span>
            <span>{formatDealDate(tr.occurred_at, locale)}</span>
            {tr.duration_in_previous_stage_ms !== null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{t('duration', { duration: formatDurationMs(tr.duration_in_previous_stage_ms, locale) })}</span>}
          </div>
          {tr.reason && <blockquote className="mt-2 border-s-2 ps-3 text-xs italic text-muted-foreground">{tr.reason}</blockquote>}
        </li>
      ))}
    </ol>
  );
}
```

### 6.17 `app/[locale]/(protected)/deals/[id]/page.tsx` (detail page Server Component)

```typescript
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DealDetailTabs } from '@/components/deals/deal-detail-tabs';
import { DealDetailHeader } from '@/components/deals/deal-detail-header';
import { dealsApi } from '@/lib/api/deals.api';

export const dynamic = 'force-dynamic';

interface DealDetailPageProps { params: Promise<{ locale: string; id: string }>; }

export async function generateMetadata({ params }: DealDetailPageProps) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'deals.detail' });
  try {
    const deal = await dealsApi.getById(id);
    return { title: t('metaTitle', { title: deal.title }) };
  } catch { return { title: t('metaTitleFallback') }; }
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;
  let deal;
  try { deal = await dealsApi.getById(id); }
  catch (err: any) { if (err?.response?.status === 404) notFound(); throw err; }
  return (
    <div className="flex flex-col gap-6 p-6">
      <DealDetailHeader deal={deal} />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
        <DealDetailTabs deal={deal} />
      </Suspense>
    </div>
  );
}
```

### 6.18 `components/deals/deal-detail-tabs.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DealDetailInfo } from './deal-detail-info';
import { DealTimeline } from './deal-timeline';
import { DealDetailInteractions } from './deal-detail-interactions';
import { DealDetailNotes } from './deal-detail-notes';
import { DealDetailTasks } from './deal-detail-tasks';
import { DealDetailPolicies } from './deal-detail-policies';
import type { Deal } from '@/lib/schemas/deal.schema';

export function DealDetailTabs({ deal }: { deal: Deal }) {
  const t = useTranslations('deals.detail.tabs');
  const [tab, setTab] = useState('info');
  return (
    <Tabs value={tab} onValueChange={setTab} data-testid="deal-detail-tabs">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="info">{t('info')}</TabsTrigger>
        <TabsTrigger value="timeline">{t('timeline')}</TabsTrigger>
        <TabsTrigger value="interactions">{t('interactions')} ({deal.interactions_count})</TabsTrigger>
        <TabsTrigger value="notes">{t('notes')} ({deal.notes_count})</TabsTrigger>
        <TabsTrigger value="tasks">{t('tasks')} ({deal.tasks_count})</TabsTrigger>
        {deal.linked_policies_count > 0 && <TabsTrigger value="policies">{t('policies')} ({deal.linked_policies_count})</TabsTrigger>}
      </TabsList>
      <TabsContent value="info" className="mt-6"><DealDetailInfo deal={deal} /></TabsContent>
      <TabsContent value="timeline" className="mt-6"><DealTimeline dealId={deal.id} /></TabsContent>
      <TabsContent value="interactions" className="mt-6"><DealDetailInteractions dealId={deal.id} /></TabsContent>
      <TabsContent value="notes" className="mt-6"><DealDetailNotes dealId={deal.id} /></TabsContent>
      <TabsContent value="tasks" className="mt-6"><DealDetailTasks dealId={deal.id} /></TabsContent>
      {deal.linked_policies_count > 0 && <TabsContent value="policies" className="mt-6"><DealDetailPolicies dealId={deal.id} /></TabsContent>}
    </Tabs>
  );
}
```

---

## 7. Tests complets (15-30 ko)

### 7.1 `tests/unit/deals/deal-schema.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { dealCreateSchema, moveStageRegressionSchema, wonSchema, lostSchema, PIPELINE_STAGES, BRANCHES_ASSURANCE } from '@/lib/schemas/deal.schema';

describe('dealCreateSchema', () => {
  const valid = { title: 'Souscription auto', amount: 12500, currency: 'MAD' as const, stage: 'lead' as const, source: 'inbound' as const, tags: [] };
  it('accepts valid payload', () => expect(dealCreateSchema.parse(valid)).toMatchObject(valid));
  it('rejects empty title', () => expect(dealCreateSchema.safeParse({ ...valid, title: '' }).success).toBe(false));
  it('rejects title > 200', () => expect(dealCreateSchema.safeParse({ ...valid, title: 'x'.repeat(201) }).success).toBe(false));
  it('rejects negative amount', () => expect(dealCreateSchema.safeParse({ ...valid, amount: -100 }).success).toBe(false));
  it('rejects amount > 100M', () => expect(dealCreateSchema.safeParse({ ...valid, amount: 100_000_001 }).success).toBe(false));
  it('rejects currency != MAD', () => expect(dealCreateSchema.safeParse({ ...valid, currency: 'EUR' as any }).success).toBe(false));
  it('accepts all stages', () => PIPELINE_STAGES.forEach((s) => expect(dealCreateSchema.safeParse({ ...valid, stage: s }).success).toBe(true)));
  it('accepts all branches', () => BRANCHES_ASSURANCE.forEach((b) => expect(dealCreateSchema.safeParse({ ...valid, branche: b }).success).toBe(true)));
  it('rejects probability > 100', () => expect(dealCreateSchema.safeParse({ ...valid, probability: 101 }).success).toBe(false));
  it('rejects > 10 tags', () => expect(dealCreateSchema.safeParse({ ...valid, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success).toBe(false));
  it('rejects past close_date', () => expect(dealCreateSchema.safeParse({ ...valid, expected_close_date: new Date(Date.now() - 2 * 86400000).toISOString() }).success).toBe(false));
});

describe('moveStageRegressionSchema', () => {
  it('requires reason >= 10 chars', () => {
    expect(moveStageRegressionSchema.safeParse({ stage: 'lead', reason: 'short' }).success).toBe(false);
    expect(moveStageRegressionSchema.safeParse({ stage: 'lead', reason: 'Prix trop eleve' }).success).toBe(true);
  });
});

describe('wonSchema and lostSchema', () => {
  it('won requires positive amount', () => expect(wonSchema.safeParse({ amount_final: -1, reason: 'Signed', signed_at: new Date().toISOString() }).success).toBe(false));
  it('won requires reason >= 5', () => expect(wonSchema.safeParse({ amount_final: 1000, reason: 'ok', signed_at: new Date().toISOString() }).success).toBe(false));
  it('lost requires enum reason', () => expect(lostSchema.safeParse({ reason: 'INVALID' as any, reason_text: 'detailed reason here' }).success).toBe(false));
  it('lost requires reason_text >= 10', () => expect(lostSchema.safeParse({ reason: 'PRICE_TOO_HIGH', reason_text: 'short' }).success).toBe(false));
});
```

### 7.2 `tests/e2e/deals-kanban.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Deals Kanban', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fr/login');
    await page.fill('[data-testid="email"]', 'broker_admin@demo.skalean.ma');
    await page.fill('[data-testid="password"]', 'TestPassword123!');
    await page.click('[data-testid="submit"]');
    await page.waitForURL('/fr/dashboard');
    await page.goto('/fr/deals?view=kanban');
  });

  test('displays 6 stage columns', async ({ page }) => {
    for (const s of ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost']) {
      await expect(page.getByTestId(`kanban-column-${s}`)).toBeVisible();
    }
  });

  test('drags forward without prompt', async ({ page }) => {
    await page.waitForSelector('[data-stage="lead"] [data-testid^="deal-card-"]');
    const card = page.locator('[data-stage="lead"] [data-testid^="deal-card-"]').first();
    const target = page.getByTestId('kanban-column-qualified');
    const cb = await card.boundingBox(); const tb = await target.boundingBox();
    if (!cb || !tb) throw new Error('boxes');
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + 50, tb.y + 100, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByText(/deplace|moved/i)).toBeVisible({ timeout: 5000 });
  });

  test('regression prompts reason dialog', async ({ page }) => {
    const card = page.locator('[data-stage="proposal"] [data-testid^="deal-card-"]').first();
    const target = page.getByTestId('kanban-column-lead');
    const cb = await card.boundingBox(); const tb = await target.boundingBox();
    if (!cb || !tb) throw new Error('boxes');
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + 50, tb.y + 100, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('move-stage-reason-dialog')).toBeVisible();
    await expect(page.getByTestId('move-stage-reason-confirm')).toBeDisabled();
    await page.fill('[data-testid="move-stage-reason-text"]', 'Le client demande de tout reprendre');
    await page.click('[data-testid="move-stage-reason-confirm"]');
    await expect(page.getByTestId('move-stage-reason-dialog')).toBeHidden();
  });

  test('drop on Won opens WonLost dialog', async ({ page }) => {
    const card = page.locator('[data-stage="negotiation"] [data-testid^="deal-card-"]').first();
    const target = page.getByTestId('kanban-column-won');
    const cb = await card.boundingBox(); const tb = await target.boundingBox();
    if (!cb || !tb) throw new Error('boxes');
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
    await page.mouse.down();
    await page.mouse.move(tb.x + 50, tb.y + 100, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId('won-dialog')).toBeVisible();
  });

  test('table filters by stage', async ({ page }) => {
    await page.goto('/fr/deals?view=table');
    await page.click('[data-testid="filter-stage"]');
    await page.getByRole('option', { name: /negociation/i }).click();
    await expect(page).toHaveURL(/stage=negotiation/);
  });

  test('view toggle persists URL', async ({ page }) => {
    await page.getByRole('button', { name: /table/i }).click();
    await expect(page).toHaveURL(/view=table/);
    await page.getByRole('button', { name: /kanban/i }).click();
    await expect(page).toHaveURL(/view=kanban/);
  });

  test('creates a deal end-to-end', async ({ page }) => {
    await page.click('[data-testid="btn-create-deal"]');
    await page.fill('[data-testid="deal-title"]', 'E2E Test Deal');
    await page.fill('[data-testid="deal-amount"]', '15000');
    await page.click('[data-testid="deal-submit"]');
    await expect(page.getByText('E2E Test Deal')).toBeVisible({ timeout: 5000 });
  });

  test('marks deal as won via menu', async ({ page }) => {
    const card = page.locator('[data-stage="negotiation"] [data-testid^="deal-card-"]').first();
    await card.hover();
    await card.getByRole('button', { name: /more/i }).click();
    await page.getByText(/gagne|won/i).click();
    await expect(page.getByTestId('won-dialog')).toBeVisible();
    await page.fill('[data-testid="won-reason"]', 'Contrat signe ce matin');
    await page.click('[data-testid="won-submit"]');
    await expect(page.getByTestId('won-dialog')).toBeHidden();
  });

  test('marks deal as lost with competitor', async ({ page }) => {
    const card = page.locator('[data-stage="proposal"] [data-testid^="deal-card-"]').first();
    await card.hover();
    await card.getByRole('button', { name: /more/i }).click();
    await page.getByText(/perdu|lost/i).click();
    await page.click('[data-testid="lost-reason"]');
    await page.getByRole('option', { name: /concurrent|competitor/i }).click();
    await page.fill('[data-testid="lost-competitor"]', 'Wafa Assurance');
    await page.fill('[data-testid="lost-reason-text"]', 'Le client a choisi Wafa pour 12% moins cher');
    await page.click('[data-testid="lost-submit"]');
    await expect(page.getByTestId('lost-dialog')).toBeHidden();
  });

  test('detail page tabs work', async ({ page }) => {
    await page.goto('/fr/deals?view=table');
    await page.locator('[data-testid="deals-table"] tbody tr a').first().click();
    await page.waitForURL(/\/deals\/.+/);
    await expect(page.getByTestId('deal-detail-tabs')).toBeVisible();
    await page.getByRole('tab', { name: /timeline|chronologie/i }).click();
    await expect(page.getByTestId('deal-timeline')).toBeVisible();
  });

  test('RBAC: broker_assistant cannot move-stage', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/fr/login');
    await page.fill('[data-testid="email"]', 'broker_assistant@demo.skalean.ma');
    await page.fill('[data-testid="password"]', 'TestPassword123!');
    await page.click('[data-testid="submit"]');
    await page.goto('/fr/deals?view=kanban');
    const card = page.locator('[data-testid^="deal-card-"]').first();
    await card.hover();
    await expect(card.getByRole('button', { name: /more/i })).toHaveCount(0);
  });
});
```

---

## 8. Variables d'environnement (1-3 ko)

```bash
# apps/web-broker/.env.local
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=skalean-broker
NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar
NEXT_PUBLIC_FEATURE_KANBAN_VIRTUALIZATION=true
NEXT_PUBLIC_KANBAN_VIRTUALIZE_THRESHOLD=50
NEXT_PUBLIC_TOAST_DURATION_MS=4000
NEXT_PUBLIC_OPTIMISTIC_ROLLBACK_TIMEOUT_MS=8000
NEXT_PUBLIC_DEFAULT_CURRENCY=MAD
NEXT_PUBLIC_TIMEZONE=Africa/Casablanca
NEXT_PUBLIC_SENTRY_DSN=
USE_MOCK_API=false
```

Variables consommees server-side dans `app/[locale]/(protected)/deals/page.tsx` via `process.env.NEXT_PUBLIC_*`. Pas de secrets dans web-broker (tous backend).

---

## 9. Commandes shell (1-2 ko)

```powershell
# Installation des nouvelles dependances
pnpm --filter @insurtech/web-broker add `
  @dnd-kit/core@6.1.0 `
  @dnd-kit/sortable@8.0.0 `
  @dnd-kit/utilities@3.2.2 `
  framer-motion@11.15.0 `
  @tanstack/react-virtual@3.11.0

# Dev / lint / typecheck
pnpm --filter @insurtech/web-broker dev
pnpm --filter @insurtech/web-broker lint
pnpm --filter @insurtech/web-broker typecheck

# Tests unit deals
pnpm --filter @insurtech/web-broker test:unit -- tests/unit/deals --coverage

# Tests E2E deals
pnpm --filter @insurtech/web-broker test:e2e tests/e2e/deals-kanban.spec.ts

# Build production
pnpm --filter @insurtech/web-broker build

# Bundle analysis
ANALYZE=true pnpm --filter @insurtech/web-broker build
```

---

## 10. Criteres validation V1-V27 (5-10 ko)

| Id | Description | Type | Comment verifier |
|----|-------------|------|------------------|
| V1 | Page `/fr/deals` repond 200 avec vue Kanban par defaut | Manuel + E2E | curl + DOM check |
| V2 | View toggle Kanban / Table switch URL `?view=` | E2E | Click toggle |
| V3 | View toggle persiste apres reload | E2E | Reload, view persists |
| V4 | Kanban affiche 6 colonnes | E2E | DOM count |
| V5 | Drag-drop forward sans prompt | E2E | Mouse simulation |
| V6 | Drag-drop regression ouvre MoveStageReasonDialog | E2E | Dialog visible |
| V7 | MoveStageReasonDialog rejette reason < 10 | Unit + E2E | Button disabled |
| V8 | POST move-stage avec Idempotency-Key | Reseau | Network inspect |
| V9 | Optimistic UI : changement instant | Manuel | Network throttle |
| V10 | Rollback automatique sur 4xx/5xx | Unit | Mock error |
| V11 | Drop Won column ouvre WonLostDialog won | E2E | Dialog visible |
| V12 | Drop Lost column ouvre WonLostDialog lost | E2E | Dialog visible |
| V13 | Table DataTable avec sort | E2E | Click header |
| V14 | Filters bar complete | Manuel | Tous visibles |
| V15 | Filters sync URL via nuqs | E2E | URL contains params |
| V16 | Reset filters efface URL | E2E | URL clean |
| V17 | Create modal validation required | E2E | Submit empty -> errors |
| V18 | Create POST avec Idempotency-Key | Reseau | Headers inspect |
| V19 | Probability auto-update sur stage change | Unit + E2E | qualified -> 30 |
| V20 | Won warning si amount > 150% | Unit | Tester warning |
| V21 | Lost competitor field si reason=COMPETITOR_WON | E2E | Field appears |
| V22 | Detail page 5 tabs | E2E | Tabs visibles |
| V23 | Timeline transitions avec duration | E2E | Visible |
| V24 | RBAC assistant : pas move-stage / won / lost | E2E | Boutons absents |
| V25 | RTL ar/ar-MA : direction RTL | E2E | direction check |
| V26 | Tests Vitest 12+ passent | CI | Exit 0 |
| V27 | Tests Playwright 10+ passent | CI | Exit 0 |

---

## 11. Edge cases + troubleshooting (3-5 ko, 12+ cases)

### EC1 -- Drag sur invalid drop zone
**Symptome** : `onDragEnd` recoit `over: null`.
**Mitigation** : `if (!over) return;` early.

### EC2 -- Drag pendant fetch en cours
**Symptome** : Deal disparait pendant cache refresh.
**Mitigation** : `cancelQueries` + snapshot + invalidate onSettled.

### EC3 -- Regression vers won / lost
**Symptome** : `isRegression('proposal', 'lost')` faux positif.
**Mitigation** : Exclure explicitement `to === 'won' || to === 'lost'`.

### EC4 -- Won amount > original par grand facteur
**Symptome** : Erreur saisie 15000 au lieu de 1500.
**Mitigation** : Warning UI si > 150%. Pas de blocage (upsell legitime).

### EC5 -- Lost sans reason
**Symptome** : Backend 422 si reason_text < 10 chars.
**Mitigation** : Validation Zod cote client.

### EC6 -- Currency non-MAD legacy
**Symptome** : Cabinet ayant EUR dans tool legacy.
**Mitigation** : `z.literal('MAD')`. Migration Sprint 9 faite.

### EC7 -- Drag mobile lag / scroll accidental
**Symptome** : Scroll vertical declenche drag.
**Mitigation** : TouchSensor `delay: 250ms` + `tolerance: 5px`.

### EC8 -- Kanban large > 500 deals/colonne
**Symptome** : Render slow, fps drop.
**Mitigation** : `@tanstack/react-virtual` si > 50 deals.

### EC9 -- RTL drag direction
**Symptome** : Mouvement visuel inverse.
**Mitigation** : `rtl:flex-row-reverse` + collision detection adapte.

### EC10 -- Mouvements simultanes 2 users
**Symptome** : Conflict 409.
**Mitigation** : If-Match etag + onError refresh prompt.

### EC11 -- Browser back/forward apres view switch
**Symptome** : History pas synch.
**Mitigation** : `nuqs shallow: false` + replaceState.

### EC12 -- Idempotency-Key retry replay
**Symptome** : Retry meme cle, backend cache.
**Mitigation** : Cle generee une fois par `mutate()`.

### EC13 -- Deal sans contact / company
**Symptome** : Card affiche "-".
**Mitigation** : Conditional rendering.

### EC14 -- Date close passee mais stage actif
**Symptome** : Deal en retard.
**Mitigation** : Badge rouge AlertCircle + animation pulse.

### EC15 -- DragOverlay sur scroll vertical
**Symptome** : Overlay decroche.
**Mitigation** : DragOverlay au niveau racine en portal.

### EC16 -- Pipeline config API indispo
**Symptome** : Hook retourne undefined.
**Mitigation** : Fallback `DEFAULT_STAGES`.

### EC17 -- Drag cancel via Escape
**Symptome** : User annule mid-drag.
**Mitigation** : `@dnd-kit` natif. `onDragCancel` restore.

### EC18 -- Probability override manuel
**Symptome** : Saisie 75 sur stage lead (default 10).
**Mitigation** : Accepte. Backend conserve les deux.

### EC19 -- Drop sur meme colonne
**Symptome** : Mutation inutile.
**Mitigation** : `if (deal.stage === targetStage) return;`.

### EC20 -- Tags arabe Unicode
**Symptome** : Tag arabe cause issues.
**Mitigation** : Zod accepte tout Unicode. UI RTL-aware.

### EC21 -- Owner deleted (orphan)
**Symptome** : `deal.owner` null.
**Mitigation** : Affiche "Non assigne" gracefully.

### EC22 -- Rapid clicks (mutations concurrentes)
**Symptome** : Race condition.
**Mitigation** : TanStack enqueue. invalidate onSettled.

### EC23 -- Reset filters scroll position
**Symptome** : Scroll reste bas apres reset.
**Mitigation** : `window.scrollTo({ top: 0 })`.

### EC24 -- Reload pendant mutation pending
**Symptome** : Mutation perdue.
**Mitigation** : `beforeUnload` warn si mutations > 500ms.

---

## 12. Conformite Maroc detaillee (1-3 ko)

### Loi 09-08 (protection donnees personnelles)
- **Article 38 -- Traceabilite** : chaque move-stage genere transition log avec actor_user_id + occurred_at + reason. Conservation 5 ans backend (Sprint 8 retention policy).
- **Article 9 -- Consentement** : pas applicable directement aux deals (donnees professionnelles), mais contact_id reference Contact qui porte le consentement.
- **Article 31 -- Information sujet** : si deal supprime (jamais en pratique), DPO notifie contact.

### Bank Al-Maghrib / ACAPS
- **Devise MAD obligatoire** : `Intl.NumberFormat('fr-MA', { currency: 'MAD' })`. Pas de conversion implicite.
- **Audit ACAPS** : timeline transitions consultable. Export Sprint 13 (analytics) inclut deals.
- **Branches assurance** : aligne nomenclature ACAPS (auto, habitation, sante, vie, RC pro, transport, multirisque pro, voyage, accidents corporels).

### Timezone
- **Africa/Casablanca** : timestamps UTC backend, affiches `formatInTimeZone` cote front via `date-fns-tz`.
- **expected_close_date** : input via DatePicker timezone-aware, sent ISO UTC, displayed locale-formatted.

### Langues
- **fr** : Lead / Qualifie / Proposition / Negociation / Gagne / Perdu.
- **ar-MA** : darija conservatrice professionnelle (memes termes lettres latines).
- **ar** : عميل محتمل / مؤهل / عرض / تفاوض / مربوح / خاسر.
- **RTL** : flex-row-reverse + scroll horizontal inverse + drag-drop miroir.

---

## 13. Conventions absolues skalean-insurtech (3-5 ko)

- Aucune emoji (decision-006).
- `'use client'` explicite uniquement quand necessaire.
- TypeScript strict, pas de `any` sauf wrapper bibliotheque tierce.
- Zod schemas source de verite ; types via `z.infer`.
- TanStack Query keys factories typees.
- Idempotency-Key obligatoire sur mutations POST/PATCH.
- x-tenant-id injecte via Axios interceptor.
- MAD via `Intl.NumberFormat`, jamais string concat.
- Africa/Casablanca via `date-fns-tz`, jamais `toLocaleString()`.
- RBAC via `useDealPermissions()`, jamais test direct `user.role`.
- i18n via `useTranslations`, aucun string hardcode UI.
- data-testid sur tous interactifs.
- ARIA `aria-label`, `aria-live`, `role` sur composants custom.
- RTL : logical properties (`ps-*`, `pe-*`, `start-*`, `end-*`).
- CSS variables design tokens Sofidemy.
- shadcn/ui depuis `@/components/ui/*`.
- Pas de delete deal : workflow lost + reason.
- Optimistic UI : cancelQueries + setQueryData + onError rollback + onSettled invalidate.
- Server Components par defaut, `'use client'` opt-in.
- Suspense boundaries autour async.
- error.tsx boundary + ErrorBoundary catch dnd.
- Toast via `sonner`, jamais `alert()`.
- Date locale date-fns (fr / arSA).
- URL state via nuqs, pas useState pour filters partageables.
- HTTP errors : axios interceptor + toast + Sentry breadcrumb.
- Bundle treeshakeable imports.
- framer-motion `layout` modere (eviter listes > 100).
- A11y : keyboard nav, focus mgmt modal, ARIA announcements drag-drop.
- Tests Vitest 70% coverage min, Playwright 10+ scenarios.
- Commits conventional `feat(web-broker): ...`.

---

## 14. Validation pre-commit (1-2 ko)

```bash
pnpm --filter @insurtech/web-broker lint
pnpm --filter @insurtech/web-broker typecheck
pnpm --filter @insurtech/web-broker test:unit -- tests/unit/deals --coverage
pnpm --filter @insurtech/web-broker test:e2e tests/e2e/deals-kanban.spec.ts
pnpm --filter @insurtech/web-broker build
ANALYZE=true pnpm --filter @insurtech/web-broker build
pnpm --filter @insurtech/web-broker test:a11y -- /fr/deals
```

Checklist :
- [ ] Aucune emoji
- [ ] Aucun `console.log` debug
- [ ] Aucun `any` non documente
- [ ] data-testid alignes avec tests
- [ ] i18n cles 3 locales
- [ ] RBAC verifie 3 roles
- [ ] RTL teste ar locale
- [ ] Mobile touch teste
- [ ] Network throttle 3G ok
- [ ] Lighthouse Performance > 75 sur /fr/deals

---

## 15. Commit message complet (1-2 ko)

```
feat(web-broker): deals page with kanban + table views, drag-drop optimistic moves

Implements the Deals CRM page on web-broker (port 3001) as a toggleable
Kanban / Table view experience with full CRUD operations on the 6-stage
sales pipeline (lead, qualified, proposal, negotiation, won, lost).

Changes:
- Add app/[locale]/(protected)/deals/page.tsx server component
- Add detail page [id]/page.tsx with multi-tab layout
- Add DealsKanban component with @dnd-kit drag-drop, framer-motion animations
- Add KanbanColumn with virtualization via @tanstack/react-virtual (>50 deals)
- Add DealCard draggable with contextual menu (edit / won / lost shortcuts)
- Add DealsTable with sortable columns and cursor pagination
- Add DealsFilters with nuqs URL state (stage, owner, branche, amount, date)
- Add DealFormDialog (create/edit) with react-hook-form + zodResolver
- Add WonLostDialog with reason capture (Loi 09-08 audit compliance)
- Add MoveStageReasonDialog prompted on regression detection
- Add DealTimeline with audit transitions display
- Add optimistic mutations via TanStack Query 5.62 with onMutate rollback
- Add 6 detail tabs (Info / Timeline / Interactions / Notes / Tasks / Policies)
- Add i18n namespace 'deals' for fr / ar-MA / ar with RTL support
- Add 7 Vitest unit suites, 5 Playwright E2E specs (10+ scenarios)

Dependencies:
- @dnd-kit/core 6.1.0, @dnd-kit/sortable 8.0.0, @dnd-kit/utilities 3.2.2
- framer-motion 11.15.0
- @tanstack/react-virtual 3.11.0

API integration (Sprint 8 CRM backend):
- GET /api/v1/crm/deals (filters + cursor)
- POST /api/v1/crm/deals (Idempotency-Key)
- PATCH /api/v1/crm/deals/:id (If-Match etag)
- POST /api/v1/crm/deals/:id/move-stage (with optional reason)
- POST /api/v1/crm/deals/:id/won (amount_final, reason, signed_at)
- POST /api/v1/crm/deals/:id/lost (reason enum + reason_text)
- GET /api/v1/crm/deals/:id/timeline (audit log)
- GET /api/v1/crm/pipeline-config (stage labels + probabilities)

Conformity:
- MAD currency via Intl.NumberFormat
- Africa/Casablanca timezone via date-fns-tz
- Loi 09-08 article 38 audit trail on all stage transitions
- ACAPS branches assurance nomenclature

RBAC:
- broker_admin: full CRUD
- broker_user: CRUD on own deals (owner_id check)
- broker_assistant: read + create only

Refs: task-4.3.7, Sprint 16, Phase 4 Vertical Insure
Depends on: task-4.3.6, Sprint 8 CRM API
Blocks: task-4.3.8 (Polices page)
```

---

## 16. Workflow next step

Apres validation :

1. Merger PR `feat/sprint-16-deals-page` -> `main`
2. Tag `sprint-16-task-4.3.7-done`
3. Demarrer task-4.3.8 Polices page
4. Mise a jour `00-pilotage/decisions/decisions-log.md` decision library drag-drop (@dnd-kit)
5. QA cabinet pilote staging URL
6. Lighthouse > 90 cible Sprint 17 acceptance

---

## 17. Footer densite + auto-verif

```powershell
Get-Item .\00-pilotage\prompts-taches\sprint-16-web-broker-app\task-4.3.7-deals-kanban-table-views.md | Select-Object Length
```

Fichier auto-suffisant : code patterns COMPLETS, tests prets a runner, criteres V1-V27 check-ables.

**FIN TASK 4.3.7**
### 6.13 `components/deals/deal-form-dialog.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { TagsInput } from '@/components/ui/tags-input';
import { ContactAutocomplete } from '@/components/contacts/contact-autocomplete';
import { CompanyAutocomplete } from '@/components/companies/company-autocomplete';
import { dealCreateSchema, type DealCreateInput, PIPELINE_STAGES, BRANCHES_ASSURANCE, DEAL_SOURCES } from '@/lib/schemas/deal.schema';
import { useCreateDeal, useUpdateDeal } from '@/lib/queries/deals.queries';
import { useDealPipeline } from '@/lib/hooks/use-deal-pipeline';
import type { Deal } from '@/lib/schemas/deal.schema';
import { Loader2 } from 'lucide-react';

interface DealFormDialogProps {
  mode: 'create' | 'edit';
  deal?: Deal;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealFormDialog({ mode, deal, open, onOpenChange }: DealFormDialogProps) {
  const t = useTranslations('deals.form');
  const { probabilityForStage } = useDealPipeline();
  const createMutation = useCreateDeal();
  const updateMutation = useUpdateDeal();

  const form = useForm<DealCreateInput>({
    resolver: zodResolver(dealCreateSchema),
    defaultValues: {
      title: deal?.title ?? '',
      amount: deal?.amount ?? 0,
      currency: 'MAD',
      stage: deal?.stage ?? 'lead',
      contact_id: deal?.contact_id ?? null,
      company_id: deal?.company_id ?? null,
      branche: deal?.branche ?? null,
      expected_close_date: deal?.expected_close_date ?? null,
      probability: deal?.probability ?? 10,
      source: deal?.source ?? 'inbound',
      tags: deal?.tags ?? [],
    },
  });

  const watchedStage = form.watch('stage');

  useEffect(() => {
    if (mode === 'create') {
      form.setValue('probability', probabilityForStage(watchedStage));
    }
  }, [watchedStage, probabilityForStage, form, mode]);

  useEffect(() => {
    if (open && deal && mode === 'edit') {
      form.reset({
        title: deal.title,
        amount: deal.amount,
        currency: 'MAD',
        stage: deal.stage,
        contact_id: deal.contact_id,
        company_id: deal.company_id,
        branche: deal.branche,
        expected_close_date: deal.expected_close_date,
        probability: deal.probability,
        source: deal.source,
        tags: deal.tags,
      });
    } else if (open && mode === 'create') {
      form.reset();
    }
  }, [open, deal, mode, form]);

  const submit = form.handleSubmit(async (values) => {
    if (mode === 'create') {
      await createMutation.mutateAsync(values);
    } else if (deal) {
      await updateMutation.mutateAsync({ id: deal.id, input: values, etag: deal.etag });
    }
    onOpenChange(false);
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]" data-testid="deal-form-dialog">
        <DialogHeader>
          <DialogTitle>{t(`${mode}.title`)}</DialogTitle>
          <DialogDescription>{t(`${mode}.description`)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">{t('fields.title')} *</Label>
            <Input id="title" {...form.register('title')} data-testid="deal-title" />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">{t('fields.amount')} (MAD) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                {...form.register('amount', { valueAsNumber: true })}
                data-testid="deal-amount"
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stage">{t('fields.stage')} *</Label>
              <Controller
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="stage" data-testid="deal-stage">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`stages.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>{t('fields.contact')}</Label>
              <Controller
                control={form.control}
                name="contact_id"
                render={({ field }) => (
                  <ContactAutocomplete value={field.value ?? null} onChange={field.onChange} />
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label>{t('fields.company')}</Label>
              <Controller
                control={form.control}
                name="company_id"
                render={({ field }) => (
                  <CompanyAutocomplete value={field.value ?? null} onChange={field.onChange} />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="branche">{t('fields.branche')}</Label>
              <Controller
                control={form.control}
                name="branche"
                render={({ field }) => (
                  <Select value={field.value ?? ''} onValueChange={(v) => field.onChange(v || null)}>
                    <SelectTrigger id="branche" data-testid="deal-branche">
                      <SelectValue placeholder={t('fields.branchePlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {BRANCHES_ASSURANCE.map((b) => (
                        <SelectItem key={b} value={b}>
                          {t(`branches.${b}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="source">{t('fields.source')}</Label>
              <Controller
                control={form.control}
                name="source"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="source" data-testid="deal-source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DEAL_SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`sources.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="expected_close_date">{t('fields.expectedCloseDate')}</Label>
              <Controller
                control={form.control}
                name="expected_close_date"
                render={({ field }) => (
                  <DatePicker
                    value={field.value ? new Date(field.value) : null}
                    onChange={(d) => field.onChange(d?.toISOString() ?? null)}
                    timezone="Africa/Casablanca"
                  />
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="probability">{t('fields.probability')} (%)</Label>
              <Input
                id="probability"
                type="number"
                min="0"
                max="100"
                step="5"
                {...form.register('probability', { valueAsNumber: true })}
                data-testid="deal-probability"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>{t('fields.tags')}</Label>
            <Controller
              control={form.control}
              name="tags"
              render={({ field }) => <TagsInput value={field.value} onChange={field.onChange} maxTags={10} />}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} data-testid="deal-submit">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {mode === 'create' ? t('actions.create') : t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.14 `components/deals/won-lost-dialog.tsx`

```typescript
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { wonSchema, lostSchema, LOST_REASONS, type Deal } from '@/lib/schemas/deal.schema';
import { useMarkWon, useMarkLost } from '@/lib/queries/deals.queries';
import { Loader2 } from 'lucide-react';

interface WonLostDialogProps {
  deal: Deal;
  mode: 'won' | 'lost';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WonLostDialog({ deal, mode, open, onOpenChange }: WonLostDialogProps) {
  const t = useTranslations('deals.wonLost');
  const wonMutation = useMarkWon();
  const lostMutation = useMarkLost();

  if (mode === 'won') {
    return <WonForm deal={deal} open={open} onOpenChange={onOpenChange} mutation={wonMutation} t={t} />;
  }
  return <LostForm deal={deal} open={open} onOpenChange={onOpenChange} mutation={lostMutation} t={t} />;
}

function WonForm({ deal, open, onOpenChange, mutation, t }: any) {
  const form = useForm({
    resolver: zodResolver(wonSchema),
    defaultValues: {
      amount_final: deal.amount,
      reason: '',
      signed_at: new Date().toISOString(),
    },
  });

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync({ id: deal.id, payload: values });
    onOpenChange(false);
  });

  const amountFinal = form.watch('amount_final');
  const showWarning = amountFinal > deal.amount * 1.5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="won-dialog">
        <DialogHeader>
          <DialogTitle>{t('won.title', { title: deal.title })}</DialogTitle>
          <DialogDescription>{t('won.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount_final">{t('won.amountFinal')} (MAD) *</Label>
            <Input
              id="amount_final"
              type="number"
              step="0.01"
              {...form.register('amount_final', { valueAsNumber: true })}
              data-testid="won-amount"
            />
            {showWarning && (
              <p className="text-xs text-amber-600">{t('won.warningAmountHigh')}</p>
            )}
            {form.formState.errors.amount_final && (
              <p className="text-xs text-destructive">{String(form.formState.errors.amount_final.message)}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="signed_at">{t('won.signedAt')} *</Label>
            <Controller
              control={form.control}
              name="signed_at"
              render={({ field }) => (
                <DatePicker
                  value={field.value ? new Date(field.value) : null}
                  onChange={(d) => field.onChange(d?.toISOString() ?? new Date().toISOString())}
                  timezone="Africa/Casablanca"
                />
              )}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">{t('won.reason')} *</Label>
            <Textarea
              id="reason"
              rows={3}
              {...form.register('reason')}
              placeholder={t('won.reasonPlaceholder')}
              data-testid="won-reason"
            />
            {form.formState.errors.reason && (
              <p className="text-xs text-destructive">{String(form.formState.errors.reason.message)}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="won-submit">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t('won.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LostForm({ deal, open, onOpenChange, mutation, t }: any) {
  const form = useForm({
    resolver: zodResolver(lostSchema),
    defaultValues: { reason: 'PRICE_TOO_HIGH', reason_text: '', lost_to_competitor: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync({
      id: deal.id,
      payload: {
        reason: values.reason,
        reason_text: values.reason_text,
        lost_to_competitor: values.lost_to_competitor || undefined,
      },
    });
    onOpenChange(false);
  });

  const watchedReason = form.watch('reason');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="lost-dialog">
        <DialogHeader>
          <DialogTitle>{t('lost.title', { title: deal.title })}</DialogTitle>
          <DialogDescription>{t('lost.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="reason">{t('lost.reason')} *</Label>
            <Controller
              control={form.control}
              name="reason"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="reason" data-testid="lost-reason">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOST_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`lost.reasons.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {watchedReason === 'COMPETITOR_WON' && (
            <div className="grid gap-2">
              <Label htmlFor="lost_to_competitor">{t('lost.competitor')}</Label>
              <Input id="lost_to_competitor" {...form.register('lost_to_competitor')} data-testid="lost-competitor" />
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="reason_text">{t('lost.reasonText')} *</Label>
            <Textarea
              id="reason_text"
              rows={3}
              {...form.register('reason_text')}
              placeholder={t('lost.reasonTextPlaceholder')}
              data-testid="lost-reason-text"
            />
            {form.formState.errors.reason_text && (
              <p className="text-xs text-destructive">{String(form.formState.errors.reason_text.message)}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={mutation.isPending} variant="destructive" data-testid="lost-submit">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t('lost.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.15 `components/deals/move-stage-reason-dialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import type { Deal, PipelineStage } from '@/lib/schemas/deal.schema';
import { useDealPipeline } from '@/lib/hooks/use-deal-pipeline';

interface MoveStageReasonDialogProps {
  deal: Deal;
  targetStage: PipelineStage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function MoveStageReasonDialog({
  deal,
  targetStage,
  open,
  onOpenChange,
  onConfirm,
}: MoveStageReasonDialogProps) {
  const t = useTranslations('deals.moveStageReason');
  const { stageMap } = useDealPipeline();
  const [reason, setReason] = useState('');
  const fromLabel = stageMap.get(deal.stage)?.label ?? deal.stage;
  const toLabel = stageMap.get(targetStage)?.label ?? targetStage;
  const valid = reason.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="move-stage-reason-dialog">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>{t('title')}</DialogTitle>
          </div>
          <DialogDescription>
            {t('description', { from: fromLabel, to: toLabel, title: deal.title })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="reason">{t('reasonLabel')} *</Label>
          <Textarea
            id="reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
            data-testid="move-stage-reason-text"
          />
          <p className="text-xs text-muted-foreground">{t('reasonHint')}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => valid && onConfirm(reason.trim())}
            disabled={!valid}
            data-testid="move-stage-reason-confirm"
          >
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.16 `components/deals/deal-timeline.tsx`

```typescript
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Clock, User as UserIcon } from 'lucide-react';
import { useDealTimeline } from '@/lib/queries/deals.queries';
import { useDealPipeline } from '@/lib/hooks/use-deal-pipeline';
import { formatDealDate, formatDurationMs, stageBadgeColor } from '@/lib/utils/deal-formatters';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export function DealTimeline({ dealId }: { dealId: string }) {
  const t = useTranslations('deals.timeline');
  const locale = useLocale();
  const { data, isLoading } = useDealTimeline(dealId);
  const { stageMap } = useDealPipeline();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.items.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <ol className="relative border-s ps-6 space-y-6" data-testid="deal-timeline">
      {data.items.map((tr) => (
        <li key={tr.id} className="relative">
          <span className="absolute -start-[33px] top-1 inline-flex h-4 w-4 rounded-full border-2 border-background bg-primary" />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {tr.from_stage ? (
              <>
                <Badge className={stageBadgeColor(tr.from_stage)}>
                  {stageMap.get(tr.from_stage)?.label ?? tr.from_stage}
                </Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground rtl:rotate-180" />
              </>
            ) : (
              <span className="text-xs text-muted-foreground">{t('created')}</span>
            )}
            <Badge className={stageBadgeColor(tr.to_stage)}>
              {stageMap.get(tr.to_stage)?.label ?? tr.to_stage}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <UserIcon className="h-3 w-3" />
              {tr.actor_name}
            </span>
            <span>{formatDealDate(tr.occurred_at, locale)}</span>
            {tr.duration_in_previous_stage_ms !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t('duration', { duration: formatDurationMs(tr.duration_in_previous_stage_ms, locale) })}
              </span>
            )}
          </div>
          {tr.reason && (
            <blockquote className="mt-2 border-s-2 ps-3 text-xs italic text-muted-foreground">
              {tr.reason}
            </blockquote>
          )}
        </li>
      ))}
    </ol>
  );
}
```

### 6.17 `app/[locale]/(protected)/deals/[id]/page.tsx`

```typescript
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DealDetailTabs } from '@/components/deals/deal-detail-tabs';
import { DealDetailHeader } from '@/components/deals/deal-detail-header';
import { dealsApi } from '@/lib/api/deals.api';

export const dynamic = 'force-dynamic';

interface DealDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: DealDetailPageProps) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'deals.detail' });
  try {
    const deal = await dealsApi.getById(id);
    return { title: t('metaTitle', { title: deal.title }) };
  } catch {
    return { title: t('metaTitleFallback') };
  }
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { id } = await params;
  let deal;
  try {
    deal = await dealsApi.getById(id);
  } catch (err: any) {
    if (err?.response?.status === 404) notFound();
    throw err;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <DealDetailHeader deal={deal} />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-muted" />}>
        <DealDetailTabs deal={deal} />
      </Suspense>
    </div>
  );
}
```

### 6.18 `components/deals/deal-detail-tabs.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DealDetailInfo } from './deal-detail-info';
import { DealTimeline } from './deal-timeline';
import { DealDetailInteractions } from './deal-detail-interactions';
import { DealDetailNotes } from './deal-detail-notes';
import { DealDetailTasks } from './deal-detail-tasks';
import { DealDetailPolicies } from './deal-detail-policies';
import type { Deal } from '@/lib/schemas/deal.schema';

export function DealDetailTabs({ deal }: { deal: Deal }) {
  const t = useTranslations('deals.detail.tabs');
  const [tab, setTab] = useState('info');

  return (
    <Tabs value={tab} onValueChange={setTab} data-testid="deal-detail-tabs">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="info">{t('info')}</TabsTrigger>
        <TabsTrigger value="timeline">
          {t('timeline')}
        </TabsTrigger>
        <TabsTrigger value="interactions">
          {t('interactions')} ({deal.interactions_count})
        </TabsTrigger>
        <TabsTrigger value="notes">
          {t('notes')} ({deal.notes_count})
        </TabsTrigger>
        <TabsTrigger value="tasks">
          {t('tasks')} ({deal.tasks_count})
        </TabsTrigger>
        {deal.linked_policies_count > 0 && (
          <TabsTrigger value="policies">
            {t('policies')} ({deal.linked_policies_count})
          </TabsTrigger>
        )}
      </TabsList>
      <TabsContent value="info" className="mt-6">
        <DealDetailInfo deal={deal} />
      </TabsContent>
      <TabsContent value="timeline" className="mt-6">
        <DealTimeline dealId={deal.id} />
      </TabsContent>
      <TabsContent value="interactions" className="mt-6">
        <DealDetailInteractions dealId={deal.id} />
      </TabsContent>
      <TabsContent value="notes" className="mt-6">
        <DealDetailNotes dealId={deal.id} />
      </TabsContent>
      <TabsContent value="tasks" className="mt-6">
        <DealDetailTasks dealId={deal.id} />
      </TabsContent>
      {deal.linked_policies_count > 0 && (
        <TabsContent value="policies" className="mt-6">
          <DealDetailPolicies dealId={deal.id} />
        </TabsContent>
      )}
    </Tabs>
  );
}
```

---
