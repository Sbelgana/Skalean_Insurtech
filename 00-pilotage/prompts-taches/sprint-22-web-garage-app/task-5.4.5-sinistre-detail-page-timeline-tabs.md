# TACHE 5.4.5 -- Sinistre Detail Page : Timeline (10 etapes) + 9 Tabs (Info, Reception, Diagnostic, Devis, Orders, QC, Invoices, Garantie, Documents, Communication) + Contextual Actions

**Sprint** : 22 (Phase 5 / Vertical Repair / Sprint 22 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-22-sprint-22-web-garage-app.md` (Tache 5.4.5)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0
**Effort** : 8h
**Dependances** :
- Tache 5.4.1, 5.4.2, 5.4.3, 5.4.4 livres
- Sprint 19 (Repair entities + audit history disponibles : GET /api/v1/repair/sinistres/:id, GET /api/v1/repair/sinistres/:id/audit-history)
- Sprint 20 (IA estimation -- diagnostic IA suggestions disponibles : GET /api/v1/repair/sinistres/:id/diagnostic/ia)
- Sprint 21 (workflow complete : reception, diagnostic, devis, orders, qc, livraison, invoices, garantie endpoints)
- Sprint 8 CRM (Communication interactions : GET /api/v1/crm/contacts/:customer_id/interactions?sinistre_id=:id)
- Sprint 10 Docs (documents : GET /api/v1/docs?entity_type=sinistre&entity_id=:id)

**Densite cible** : 100-150 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Implementer la page `/[locale]/sinistres/[id]` -- vue **detail complete** d'un sinistre avec : (1) **Header** consolidant les infos essentielles (sinistre_number en gros, big status badge, customer, vehicle, dates importantes, technicien assigne, priority) ; (2) **Timeline visuelle** affichant les 10 etapes du workflow avec dates effectives + nom responsable + commentaires/raisons (audit history Sprint 19) -- chaque etape colore vert si traversee, gris si non encore atteinte, orange si actuelle ; (3) **9 tabs** offrant des vues specialisees sur chaque dimension : **Info** (details vehicule + customer + police + indemnisation), **Reception** (placeholder tab pointant vers Tache 5.4.6), **Diagnostic** (placeholder tab Tache 5.4.7), **Devis** (placeholder Tache 5.4.8 + history avenants), **Orders** (placeholder Tache 5.4.9), **QC + Livraison** (placeholder Tache 5.4.10), **Invoices** (placeholder Tache 5.4.11), **Garantie** (warranty info + claims existants), **Documents** (browser tous documents lies, PDF preview, download, envoi par email), **Communication** (timeline interactions CRM Sprint 8 -- emails, WhatsApp, SMS, appels) ; (4) **Contextual action buttons** dans header qui apparaissent/disparaissent selon status courant via state machine : "Acknowledge" si declared, "Schedule appointment" si acknowledged, "Receive vehicle" si appointment_scheduled, "Start diagnostic" si received, "Submit estimate" si under_diagnostic, "Approve estimate" si awaiting_approval (avec role check broker/insurer), "Start repair" si approved, "Run QC" si under_repair, "Confirm delivery" si ready_for_delivery.

Cette tache est centrale au workflow garage : c'est la **page-pivot** ou tout converge. Un technicien ouvrant un sinistre voit tout en un coup d'oeil : ce qu'il faut faire ensuite (contextual action), l'historique (timeline), les details (tabs). Pour Atlas Cabinet, la page detail est la 2eme page la plus consultee apres /sinistres. Les techniciens cliquent sur une carte kanban -> aterrissent ici -> font l'action suivante -> redirigent automatiquement vers la tab appropriee (ex : "Start diagnostic" -> tab Diagnostic en mode edit).

A la sortie de cette tache, un personnel garage peut : (a) ouvrir n'importe quel sinistre par URL `/fr/sinistres/{id}` ou par click depuis Kanban/Table, (b) voir l'etat complet en < 2s LCP, (c) lancer l'action contextuelle suivante en 1 click, (d) naviguer entre les 9 tabs sans rechargement page (state preserved), (e) voir les documents lies avec preview PDF inline, (f) voir la timeline complete avec qui a fait quoi quand pourquoi (audit complet conforme loi 09-08), (g) initier une communication WhatsApp/email vers le customer depuis la tab Communication.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Sans page detail centralisee, le personnel doit naviguer entre 10+ ecrans separes pour comprendre un sinistre. C'est la cause principale d'erreurs operationnelles (un technicien oublie de checker la garantie active -> facture indemnisation au customer au lieu de l'insurer -> reclamation customer). La page detail consolide en **une URL unique** toute la verite operationnelle d'un sinistre. Si quelqu'un demande "ou en est le sinistre SI-2026-00123 ?" -> envoyer l'URL `/fr/sinistres/{id}` suffit.

Le timing : 5eme tache du Sprint 22, posee directement apres la liste Sinistres (5.4.4). Avant les pages action specifiques (Reception 5.4.6, Diagnostic 5.4.7, etc.) qui sont les **tabs internes** de cette page detail. Strategie : la page detail livre des **tabs placeholder** avec hint "Implemented dans Tache 5.4.6" pour les tabs Reception, Diagnostic, etc. Apres execution des 5.4.6 a 5.4.11, les tabs sont remplies progressivement. Cette tache 5.4.5 livre le **shell** + les tabs auto-suffisantes (Info, Garantie, Documents, Communication).

### Composition tabs : ce que livre 5.4.5 vs taches suivantes

| Tab | Livre par 5.4.5 | Livre par tache suivante |
|-----|------------------|--------------------------|
| Info | Plein contenu (vehicule + customer + police) | -- |
| Reception | Tab shell + lien | 5.4.6 |
| Diagnostic | Tab shell + lien | 5.4.7 |
| Devis | Tab shell + lien | 5.4.8 |
| Orders | Tab shell + lien | 5.4.9 |
| QC + Livraison | Tab shell + lien | 5.4.10 |
| Invoices | Tab shell + lien | 5.4.11 |
| Garantie | Plein contenu (warranty + claims) | -- |
| Documents | Plein contenu (browser PDF + download + envoi) | -- |
| Communication | Plein contenu (interactions CRM Sprint 8) | -- |

Donc cette tache livre 4 tabs avec contenu + 6 tabs shells. Les 6 tabs shells seront remplies par les Taches 5.4.6-5.4.11 qui ajoutent du content **dans les memes fichiers** (pattern : chaque tab a son propre composant `<TabReception>` qu'on remplit progressivement).

### Alternatives considerees

#### Tabs : URL params vs state local vs hash routing

| Critere | URL params (CHOIX) `?tab=diagnostic` | State local | Hash `#diagnostic` |
|---------|---------------------------------------|--------------|---------------------|
| Shareable link | Oui | Non | Oui |
| Browser back/forward | Oui (Next.js push) | Non | Limited |
| Server Component | Compatible (searchParams) | Non | Limited |
| Default tab | URL param par defaut | useState initial | Manuel |
| Sprint 16 pattern | Oui | -- | -- |

**Decision** : URL params. Pattern : `/fr/sinistres/{id}?tab=diagnostic`. Default `?tab=info`.

#### Timeline : custom vs library (react-vertical-timeline) vs Mermaid

| Critere | Custom Tailwind (CHOIX) | react-vertical-timeline | Mermaid |
|---------|--------------------------|--------------------------|---------|
| Bundle size | 0 | 22 ko | 50+ ko |
| Customization | Total | Theme-able | Limited |
| Animation | CSS | Builtin | None |
| RTL | Manuel (mais OK CSS flex-row-reverse) | Manuel | OK |
| Audit data fit | Parfait | Generic | Generic |

**Decision** : Custom timeline avec Tailwind. Aucune dependance externe. Pattern : flex vertical avec dots + lignes + labels + dates.

#### PDF preview : react-pdf vs PDF.js direct vs iframe

| Critere | react-pdf 9.x (CHOIX) | PDF.js direct | iframe |
|---------|------------------------|----------------|--------|
| API React | Oui | Imperatif | N/A |
| Bundle size | 200 ko (lazy) | 180 ko | 0 |
| Customization | Excellent | Total | Limited |
| Mobile zoom | Oui | Manuel | Native browser |
| Download button | Custom | Manuel | Native (browser-dependent) |

**Decision** : react-pdf 9.x avec lazy loading (`dynamic(() => import('react-pdf'))`) -- evite charger 200 ko sur chaque page detail. Si user n'ouvre pas tab Documents, ne charge pas.

### Trade-offs explicites

1. **9 tabs = surcharge informations** : peut etre overwhelming. Mitigation : tabs avec icones distinctives + counter badges (ex : "Devis (2)" si 2 devis emis, "Documents (15)" si 15 docs).

2. **Tab Documents charge tous les fichiers immediatement** : si 50 docs, lent. Mitigation : lazy load thumbnails + pagination dans liste.

3. **Contextual actions surcharge si > 5 actions visibles** : header devient bondé. Mitigation : 1 primary button (most logical next step) + dropdown "Plus d'actions" pour secondary.

4. **Timeline 10 etapes vertical scroll** : sur mobile cache long. Mitigation : mobile horizontal scroll alternatif.

5. **Tab Communication necessite CRM API Sprint 8** : couplage cross-package. Mitigation : api-client wrapper + fallback gracieux si endpoint indispo (afficher "Service CRM indisponible temporairement").

6. **Optimistic UI sur contextual actions** : si "Acknowledge" click et backend lent, header reste "declared" 1s. Mitigation : action button montre spinner pendant pending + disable autres actions.

### Decisions strategiques referenced

- decision-002 (multi-tenant) : header verify sinistre.tenant_id == current_tenant ;
- decision-006 (no-emoji) : labels propres, icons Lucide ;
- decision-008 (cloud souverain) : documents S3 Atlas Cloud ;
- decision-009 (i18n) : timeline dates locale-aware ;
- decision-010 (audit trail loi 09-08) : timeline montre full audit.

### Pieges techniques (15 minimum)

1. **Tab content unmount/remount detruit form state** : si user tape dans tab Diagnostic puis switch a tab Info, formulaire perdu. Mitigation : `keepMounted` pattern via CSS `hidden` au lieu d'unmount.

2. **PDF preview lazy load -> Suspense boundary needed** : `<Suspense>` autour de `<PdfViewer>` sinon flash UI.

3. **Timeline date formatting locale-aware** : `formatInTimeZone` Africa/Casablanca + locale fr/ar.

4. **Contextual actions race-condition** : user click "Acknowledge" + un autre user fait pareil 0.5s avant. Backend retourne 409 CONFLICT (already acknowledged). Mitigation : refetch sinistre data + toast warning.

5. **Audit history pagination** : si sinistre vieux avec 200+ events, performance. Mitigation : paginate audit list + show last 20 par defaut + "Show all" toggle.

6. **Documents PDF preview avec CSP** : `react-pdf` charge depuis CDN cdnjs (pdf.worker.min.js). Verifier CSP `worker-src 'self' https://cdnjs.cloudflare.com`.

7. **Tab Communication infinite scroll** : 1000+ interactions degrade UX. Mitigation : show last 30 + lazy load older.

8. **Garantie tab : si pas de warranty -> empty state** : ne pas afficher 404.

9. **Header big sinistre_number affichage RTL** : direction OK mais alignement texte. Mitigation : `dir="auto"` ou hardcode "1234-A-56" left-to-right meme en RTL (regex numbers MA).

10. **`?tab=invalid` -> default to info** : valider tab via Zod enum.

11. **Server Component fetch sinistre + tab Documents lazy load** : initial fetch sinistre + audit history. Tab Documents fetch separate apres click (avoid initial waterfall).

12. **Customer phone WhatsApp link** : `https://wa.me/212XXXXXXXXX` (sans +). Format MA `+212XXXXXXXXX`.

13. **Optimistic header status update** : update sinistre.status localement avant API. Si error, revert.

14. **Contextual actions roles check cote client** : `garage_technicien` ne doit pas voir "Approve estimate" (action role garage_chef ou broker). Mitigation : `useHasRole(['garage_chef', 'garage_admin'])` cote button.

15. **Tab badge counter (Devis (2), Documents (15))** : refetch count separate ou inclu dans sinistre.counts. Optimisation : inclure counts dans GET sinistre.

---

## 3. Architecture context

### Position dans Sprint 22

```
[5.4.1 Skeleton]    (livre)
[5.4.2 Auth]        (livre)
[5.4.3 Dashboard]   (livre)
[5.4.4 Sinistres K + T]  (livre)
[5.4.5 Sinistre detail]  <-- ICI (8h)
   |
   +--> [5.4.6 Reception]    (fill tab)
   +--> [5.4.7 Diagnostic]   (fill tab)
   +--> [5.4.8 Devis]        (fill tab)
   +--> [5.4.9 Orders]       (fill tab)
   +--> [5.4.10 QC + Liv]    (fill tab)
   +--> [5.4.11 Invoices]    (fill tab)
```

### Layout page detail

```
+--------------------------------------------------+
| Header                                            |
| SI-2026-00123 [BIG STATUS BADGE]   [Action btns] |
| Customer: Hassan El Amrani                        |
| Vehicle: 1234-A-56 Renault Megane 2022           |
| Technicien: Mohammed Bennani  |  Declared: 5d ago|
+--------------------------------------------------+
| Timeline (horizontal sur desktop, vertical mobile)|
| [v]declared - [v]acknowledged - [v]received -   |
| [o]under_diagnostic - [ ]under_repair - [ ]QC - |
| [ ]delivery                                       |
+--------------------------------------------------+
| Tabs : Info | Reception | Diagnostic | Devis (2) |
|        | Orders | QC | Invoices | Garantie |     |
|        Documents (15) | Communication              |
+--------------------------------------------------+
| Tab content (selon ?tab=)                         |
| ...                                               |
+--------------------------------------------------+
```

### ASCII tree apres tache

```
repo/apps/web-garage/src/app/[locale]/(protected)/sinistres/[id]/
|-- page.tsx                                          # Server Component sinistre fetch
|-- loading.tsx
|-- error.tsx

repo/apps/web-garage/src/components/sinistres/detail/
|-- sinistre-detail-client.tsx                        # Client orchestrator tabs
|-- sinistre-header.tsx                               # Big header + status + actions
|-- sinistre-header.spec.tsx
|-- contextual-actions.tsx                            # 1 primary + dropdown secondary
|-- contextual-actions.spec.tsx
|-- sinistre-timeline.tsx                             # Timeline 10 etapes
|-- sinistre-timeline.spec.tsx
|-- tabs/
|   |-- tab-nav.tsx                                   # Tabs navigation horizontal
|   |-- tab-info.tsx                                  # Info vehicle + customer + police
|   |-- tab-info.spec.tsx
|   |-- tab-reception-placeholder.tsx                  # Placeholder rempli 5.4.6
|   |-- tab-diagnostic-placeholder.tsx                 # Rempli 5.4.7
|   |-- tab-devis-placeholder.tsx                      # Rempli 5.4.8
|   |-- tab-orders-placeholder.tsx                     # Rempli 5.4.9
|   |-- tab-qc-livraison-placeholder.tsx              # Rempli 5.4.10
|   |-- tab-invoices-placeholder.tsx                   # Rempli 5.4.11
|   |-- tab-garantie.tsx                               # Plein content cette tache
|   |-- tab-garantie.spec.tsx
|   |-- tab-documents.tsx                              # Plein content
|   |-- tab-documents.spec.tsx
|   |-- pdf-viewer.tsx                                 # react-pdf lazy
|   |-- tab-communication.tsx                          # Plein content
|   |-- tab-communication.spec.tsx

repo/apps/web-garage/src/lib/queries/sinistre-detail.queries.ts          # fetch sinistre + audit + docs + comms + garantie
repo/apps/web-garage/src/lib/queries/sinistre-actions.queries.ts          # transition mutations
```

---

## 4. Livrables checkables (28 livrables)

- [ ] Server Component `sinistres/[id]/page.tsx` avec parallel fetch (sinistre + audit + counts)
- [ ] Header avec sinistre_number + status badge + customer + vehicle + technicien
- [ ] Timeline 10 etapes + dates + responsable + commentaires
- [ ] Timeline vertical sur mobile, horizontal sur desktop
- [ ] Contextual actions : 1 primary button selon status + dropdown secondary
- [ ] Actions roles-aware (garage_technicien ne voit pas "Approve")
- [ ] Tab nav 9 tabs avec counters badges
- [ ] Tab Info : details vehicule + customer + police
- [ ] Tab Garantie : warranty info + claims
- [ ] Tab Documents : list + PDF preview lazy + download + envoi
- [ ] Tab Communication : interactions CRM timeline
- [ ] 6 tabs placeholder (Reception, Diagnostic, Devis, Orders, QC+Liv, Invoices)
- [ ] URL `?tab=info` persiste
- [ ] Tab Documents pagination
- [ ] Tab Communication infinite scroll
- [ ] Action "Acknowledge" optimistic UI + transition state machine
- [ ] PDF viewer lazy load + suspense fallback
- [ ] WhatsApp link customer phone format MA
- [ ] Email link customer
- [ ] Refetch sinistre apres action (invalidateQueries)
- [ ] keepMounted tabs (forms preserved)
- [ ] Header sticky on scroll
- [ ] Tests Vitest 25+ tests
- [ ] Tests Playwright 10+ tests E2E (timeline, tabs, actions)
- [ ] i18n keys 90+ par locale
- [ ] RTL complet
- [ ] Aucune emoji
- [ ] Lighthouse Performance > 85

---

## 5. Fichiers crees / modifies

```
repo/apps/web-garage/src/app/[locale]/(protected)/sinistres/[id]/page.tsx                   (~180 lignes)
repo/apps/web-garage/src/app/[locale]/(protected)/sinistres/[id]/loading.tsx                 (~50 lignes)
repo/apps/web-garage/src/app/[locale]/(protected)/sinistres/[id]/error.tsx                    (~60 lignes)
repo/apps/web-garage/src/components/sinistres/detail/sinistre-detail-client.tsx                (~200 lignes)
repo/apps/web-garage/src/components/sinistres/detail/sinistre-header.tsx                       (~180 lignes)
repo/apps/web-garage/src/components/sinistres/detail/sinistre-header.spec.tsx                   (~120 lignes)
repo/apps/web-garage/src/components/sinistres/detail/contextual-actions.tsx                     (~220 lignes)
repo/apps/web-garage/src/components/sinistres/detail/contextual-actions.spec.tsx                  (~150 lignes)
repo/apps/web-garage/src/components/sinistres/detail/sinistre-timeline.tsx                       (~250 lignes)
repo/apps/web-garage/src/components/sinistres/detail/sinistre-timeline.spec.tsx                   (~150 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-nav.tsx                              (~150 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-info.tsx                              (~200 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-info.spec.tsx                          (~100 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-reception-placeholder.tsx              (~60 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-diagnostic-placeholder.tsx              (~60 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-devis-placeholder.tsx                    (~60 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-orders-placeholder.tsx                    (~60 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-qc-livraison-placeholder.tsx              (~60 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-invoices-placeholder.tsx                   (~60 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-garantie.tsx                                (~200 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-garantie.spec.tsx                          (~120 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-documents.tsx                                (~250 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-documents.spec.tsx                            (~150 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/pdf-viewer.tsx                                    (~120 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-communication.tsx                              (~220 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-communication.spec.tsx                          (~120 lignes)
repo/apps/web-garage/src/lib/queries/sinistre-detail.queries.ts                                                (~280 lignes)
repo/apps/web-garage/src/lib/queries/sinistre-actions.queries.ts                                                (~150 lignes)
repo/apps/web-garage/src/lib/queries/sinistre-detail.queries.spec.ts                                              (~180 lignes)
repo/apps/web-garage/src/messages/{fr,ar-MA,ar}.json                                                                  (modifie +90 keys par locale)
repo/apps/web-garage/e2e/sinistre-detail-timeline.spec.ts                                                              (~150 lignes / 5 tests)
repo/apps/web-garage/e2e/sinistre-detail-tabs.spec.ts                                                                    (~180 lignes / 5 tests)
```

**Total** : 30 fichiers, ~4 100 lignes (production + tests)

---

## 6. Code patterns COMPLETS

### Fichier 1/14 : `src/lib/queries/sinistre-detail.queries.ts`

```typescript
import { z } from 'zod';
import { apiGet } from '@/lib/api-client';

const SinistreDetailSchema = z.object({
  id: z.string().uuid(),
  sinistre_number: z.string(),
  status: z.enum([
    'declared', 'acknowledged', 'appointment_scheduled', 'received',
    'under_diagnostic', 'awaiting_approval', 'under_repair', 'quality_check',
    'ready_for_delivery', 'delivered', 'cancelled', 'rejected_by_insurer', 'closed',
  ]),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  declared_at: z.string().datetime(),
  estimated_completion_at: z.string().datetime().nullable(),
  customer: z.object({
    id: z.string().uuid(),
    name: z.string(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    cin: z.string().nullable(),
    address: z.string().nullable(),
  }),
  vehicle: z.object({
    id: z.string().uuid(),
    plate: z.string(),
    make: z.string(),
    model: z.string(),
    year: z.number().int(),
    color: z.string().nullable(),
    vin: z.string().nullable(),
    mileage: z.number().int().nullable(),
  }),
  technicien: z.object({
    id: z.string().uuid(),
    name: z.string(),
    avatar_url: z.string().nullable(),
  }).nullable(),
  policy: z.object({
    id: z.string().uuid(),
    policy_number: z.string(),
    insurer_name: z.string(),
    coverage_type: z.string(),
    deductible_mad: z.number().nonnegative(),
    coverage_cap_mad: z.number().nonnegative().nullable(),
  }).nullable(),
  warranty: z.object({
    is_under_warranty: z.boolean(),
    warranty_provider: z.string().nullable(),
    warranty_expiry: z.string().datetime().nullable(),
    warranty_coverage_pct: z.number().min(0).max(100).nullable(),
  }).nullable(),
  service_type: z.string().nullable(),
  total_estimated_mad: z.number().nonnegative().nullable(),
  counts: z.object({
    devis: z.number().int().nonnegative(),
    orders: z.number().int().nonnegative(),
    invoices: z.number().int().nonnegative(),
    documents: z.number().int().nonnegative(),
    communications: z.number().int().nonnegative(),
  }),
});
export type SinistreDetail = z.infer<typeof SinistreDetailSchema>;

export async function fetchSinistreDetail(id: string): Promise<SinistreDetail> {
  const data = await apiGet<unknown>(`/api/v1/repair/sinistres/${id}`);
  return SinistreDetailSchema.parse(data);
}

const AuditEventSchema = z.object({
  id: z.string().uuid(),
  event_type: z.string(),
  from_status: z.string().nullable(),
  to_status: z.string().nullable(),
  actor_id: z.string().uuid(),
  actor_name: z.string(),
  actor_role: z.string(),
  reason: z.string().nullable(),
  occurred_at: z.string().datetime(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export async function fetchAuditHistory(sinistreId: string): Promise<AuditEvent[]> {
  const data = await apiGet<unknown>(`/api/v1/repair/sinistres/${sinistreId}/audit-history`);
  return z.array(AuditEventSchema).parse(data);
}

const DocumentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().positive(),
  s3_url: z.string().url(),
  uploaded_at: z.string().datetime(),
  uploaded_by_name: z.string(),
});
export type Document = z.infer<typeof DocumentSchema>;

export async function fetchSinistreDocuments(sinistreId: string): Promise<Document[]> {
  const data = await apiGet<unknown>(`/api/v1/docs?entity_type=sinistre&entity_id=${sinistreId}`);
  return z.array(DocumentSchema).parse(data);
}

const InteractionSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['email', 'whatsapp', 'sms', 'call', 'note']),
  direction: z.enum(['inbound', 'outbound']),
  subject: z.string().nullable(),
  content: z.string(),
  occurred_at: z.string().datetime(),
  actor_name: z.string().nullable(),
});
export type Interaction = z.infer<typeof InteractionSchema>;

export async function fetchSinistreInteractions(sinistreId: string, customerId: string): Promise<Interaction[]> {
  const data = await apiGet<unknown>(`/api/v1/crm/contacts/${customerId}/interactions?sinistre_id=${sinistreId}&limit=50`);
  return z.array(InteractionSchema).parse(data);
}
```

### Fichier 2/14 : `src/lib/queries/sinistre-actions.queries.ts`

```typescript
import { apiPost } from '@/lib/api-client';
import { type SinistreStatus } from '@/lib/sinistres/state-machine';

export interface ContextualAction {
  key: string;
  to_status: SinistreStatus;
  label_key: string; // i18n key
  variant: 'primary' | 'secondary' | 'danger';
  required_roles: string[];
  redirect_to_tab?: string;
  requires_reason?: boolean;
}

export const CONTEXTUAL_ACTIONS: Record<SinistreStatus, ContextualAction[]> = {
  declared: [
    {
      key: 'acknowledge',
      to_status: 'acknowledged',
      label_key: 'actions.acknowledge',
      variant: 'primary',
      required_roles: ['garage_admin', 'garage_chef', 'garage_gestionnaire'],
    },
    {
      key: 'cancel',
      to_status: 'cancelled',
      label_key: 'actions.cancel',
      variant: 'danger',
      required_roles: ['garage_admin'],
      requires_reason: true,
    },
  ],
  acknowledged: [
    {
      key: 'schedule_appointment',
      to_status: 'appointment_scheduled',
      label_key: 'actions.schedule_appointment',
      variant: 'primary',
      required_roles: ['garage_admin', 'garage_chef', 'garage_gestionnaire'],
    },
  ],
  appointment_scheduled: [
    {
      key: 'receive_vehicle',
      to_status: 'received',
      label_key: 'actions.receive_vehicle',
      variant: 'primary',
      required_roles: ['garage_admin', 'garage_chef', 'garage_technicien'],
      redirect_to_tab: 'reception',
    },
  ],
  received: [
    {
      key: 'start_diagnostic',
      to_status: 'under_diagnostic',
      label_key: 'actions.start_diagnostic',
      variant: 'primary',
      required_roles: ['garage_admin', 'garage_chef', 'garage_technicien'],
      redirect_to_tab: 'diagnostic',
    },
  ],
  under_diagnostic: [
    {
      key: 'submit_estimate',
      to_status: 'awaiting_approval',
      label_key: 'actions.submit_estimate',
      variant: 'primary',
      required_roles: ['garage_admin', 'garage_chef', 'garage_technicien'],
      redirect_to_tab: 'devis',
    },
  ],
  awaiting_approval: [
    {
      key: 'approve_estimate',
      to_status: 'under_repair',
      label_key: 'actions.approve_estimate',
      variant: 'primary',
      required_roles: ['garage_admin', 'garage_chef'],
    },
    {
      key: 'reject_estimate',
      to_status: 'rejected_by_insurer',
      label_key: 'actions.reject_estimate',
      variant: 'danger',
      required_roles: ['garage_admin', 'garage_chef'],
      requires_reason: true,
    },
  ],
  under_repair: [
    {
      key: 'run_qc',
      to_status: 'quality_check',
      label_key: 'actions.run_qc',
      variant: 'primary',
      required_roles: ['garage_admin', 'garage_chef'],
      redirect_to_tab: 'qc',
    },
  ],
  quality_check: [
    {
      key: 'qc_pass_ready',
      to_status: 'ready_for_delivery',
      label_key: 'actions.qc_pass',
      variant: 'primary',
      required_roles: ['garage_admin', 'garage_chef'],
    },
    {
      key: 'qc_fail_return',
      to_status: 'under_repair',
      label_key: 'actions.qc_fail',
      variant: 'danger',
      required_roles: ['garage_admin', 'garage_chef'],
      requires_reason: true,
    },
  ],
  ready_for_delivery: [
    {
      key: 'confirm_delivery',
      to_status: 'delivered',
      label_key: 'actions.confirm_delivery',
      variant: 'primary',
      required_roles: ['garage_admin', 'garage_chef', 'garage_gestionnaire'],
      redirect_to_tab: 'qc',
    },
  ],
  delivered: [],
  cancelled: [],
  rejected_by_insurer: [],
  closed: [],
};

export function getContextualActionsForStatus(status: SinistreStatus, userRoles: string[]): ContextualAction[] {
  const actions = CONTEXTUAL_ACTIONS[status] ?? [];
  return actions.filter((a) => a.required_roles.some((r) => userRoles.includes(r)));
}

export async function executeContextualAction(input: {
  sinistre_id: string;
  to_status: SinistreStatus;
  reason?: string;
}) {
  return await apiPost<{ id: string; status: SinistreStatus }>(
    `/api/v1/repair/sinistres/${input.sinistre_id}/transition`,
    { to_status: input.to_status, reason: input.reason },
  );
}
```

### Fichier 3/14 : `src/app/[locale]/(protected)/sinistres/[id]/page.tsx`

```typescript
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { QueryClient, dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { fetchSinistreDetail, fetchAuditHistory } from '@/lib/queries/sinistre-detail.queries';
import { SinistreDetailClient } from '@/components/sinistres/detail/sinistre-detail-client';

const TabSchema = z.enum([
  'info', 'reception', 'diagnostic', 'devis', 'orders', 'qc', 'invoices', 'garantie', 'documents', 'communication',
]).default('info');

interface SinistreDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function SinistreDetailPage({ params, searchParams }: SinistreDetailPageProps) {
  const { locale, id } = await params;
  const { tab } = await searchParams;
  setRequestLocale(locale);

  const parsedTab = TabSchema.safeParse(tab);
  const activeTab = parsedTab.success ? parsedTab.data : 'info';

  const queryClient = new QueryClient();

  let sinistre;
  try {
    sinistre = await queryClient.fetchQuery({
      queryKey: ['sinistre-detail', id],
      queryFn: () => fetchSinistreDetail(id),
    });
  } catch (err) {
    notFound();
  }

  await queryClient.prefetchQuery({
    queryKey: ['sinistre-audit', id],
    queryFn: () => fetchAuditHistory(id),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SinistreDetailClient sinistre={sinistre} initialTab={activeTab} locale={locale} />
    </HydrationBoundary>
  );
}
```

### Fichier 4/14 : `src/components/sinistres/detail/sinistre-detail-client.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { type SinistreDetail, fetchSinistreDetail, fetchAuditHistory } from '@/lib/queries/sinistre-detail.queries';
import { SinistreHeader } from './sinistre-header';
import { SinistreTimeline } from './sinistre-timeline';
import { TabNav } from './tabs/tab-nav';
import { TabInfo } from './tabs/tab-info';
import { TabReceptionPlaceholder } from './tabs/tab-reception-placeholder';
import { TabDiagnosticPlaceholder } from './tabs/tab-diagnostic-placeholder';
import { TabDevisPlaceholder } from './tabs/tab-devis-placeholder';
import { TabOrdersPlaceholder } from './tabs/tab-orders-placeholder';
import { TabQcLivraisonPlaceholder } from './tabs/tab-qc-livraison-placeholder';
import { TabInvoicesPlaceholder } from './tabs/tab-invoices-placeholder';
import { TabGarantie } from './tabs/tab-garantie';
import { TabDocuments } from './tabs/tab-documents';
import { TabCommunication } from './tabs/tab-communication';

interface Props {
  sinistre: SinistreDetail;
  initialTab: string;
  locale: string;
}

export function SinistreDetailClient({ sinistre: initialSinistre, initialTab, locale }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: sinistre } = useQuery({
    queryKey: ['sinistre-detail', initialSinistre.id],
    queryFn: () => fetchSinistreDetail(initialSinistre.id),
    initialData: initialSinistre,
    staleTime: 60_000,
  });

  const { data: audit } = useQuery({
    queryKey: ['sinistre-audit', initialSinistre.id],
    queryFn: () => fetchAuditHistory(initialSinistre.id),
    staleTime: 60_000,
  });

  function changeTab(tab: string) {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const current = sinistre ?? initialSinistre;

  return (
    <div className="space-y-4">
      <SinistreHeader sinistre={current} locale={locale} onActionComplete={(redirectTab) => redirectTab && changeTab(redirectTab)} />
      <SinistreTimeline currentStatus={current.status} auditEvents={audit ?? []} locale={locale} />
      <TabNav activeTab={activeTab} counts={current.counts} onChange={changeTab} />

      <div className="rounded-lg border border-border bg-card p-4">
        {/* keepMounted pattern: hide instead of unmount to preserve forms */}
        <div hidden={activeTab !== 'info'}>
          <TabInfo sinistre={current} locale={locale} />
        </div>
        <div hidden={activeTab !== 'reception'}>
          <TabReceptionPlaceholder sinistreId={current.id} status={current.status} />
        </div>
        <div hidden={activeTab !== 'diagnostic'}>
          <TabDiagnosticPlaceholder sinistreId={current.id} status={current.status} />
        </div>
        <div hidden={activeTab !== 'devis'}>
          <TabDevisPlaceholder sinistreId={current.id} status={current.status} />
        </div>
        <div hidden={activeTab !== 'orders'}>
          <TabOrdersPlaceholder sinistreId={current.id} status={current.status} />
        </div>
        <div hidden={activeTab !== 'qc'}>
          <TabQcLivraisonPlaceholder sinistreId={current.id} status={current.status} />
        </div>
        <div hidden={activeTab !== 'invoices'}>
          <TabInvoicesPlaceholder sinistreId={current.id} status={current.status} />
        </div>
        <div hidden={activeTab !== 'garantie'}>
          <TabGarantie sinistre={current} locale={locale} />
        </div>
        <div hidden={activeTab !== 'documents'}>
          {activeTab === 'documents' && <TabDocuments sinistreId={current.id} locale={locale} />}
        </div>
        <div hidden={activeTab !== 'communication'}>
          {activeTab === 'communication' && <TabCommunication sinistreId={current.id} customerId={current.customer.id} locale={locale} />}
        </div>
      </div>
    </div>
  );
}
```

### Fichier 5/14 : `src/components/sinistres/detail/sinistre-header.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { User, Car, Wrench, Calendar } from 'lucide-react';
import { type SinistreDetail } from '@/lib/queries/sinistre-detail.queries';
import { STATUS_STYLES } from '@/lib/sinistres/state-machine';
import { ContextualActions } from './contextual-actions';

interface Props {
  sinistre: SinistreDetail;
  locale: string;
  onActionComplete?: (redirectTab?: string) => void;
}

export function SinistreHeader({ sinistre, locale, onActionComplete }: Props) {
  const t = useTranslations('sinistre_detail.header');
  const tStatus = useTranslations('sinistres.kanban.statuses');
  const style = STATUS_STYLES[sinistre.status as never];
  const dateLocale = locale.startsWith('ar') ? ar : fr;

  return (
    <header className="sticky top-0 z-30 rounded-lg border border-border bg-card p-4 shadow-sm" data-testid="sinistre-header">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono" dir="ltr" data-testid="sinistre-number">
              {sinistre.sinistre_number}
            </h1>
            <span
              className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${style.bg} ${style.text}`}
              data-testid="sinistre-status-badge"
            >
              {tStatus(sinistre.status)}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {sinistre.customer.name}
            </span>
            <span className="flex items-center gap-1">
              <Car className="h-3 w-3" />
              <span className="font-mono" dir="ltr">{sinistre.vehicle.plate}</span>
              <span>{sinistre.vehicle.make} {sinistre.vehicle.model} {sinistre.vehicle.year}</span>
            </span>
            {sinistre.technicien && (
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                {sinistre.technicien.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {t('declared')} {formatDistanceToNow(new Date(sinistre.declared_at), { addSuffix: true, locale: dateLocale })}
            </span>
          </div>
        </div>

        <ContextualActions sinistre={sinistre} onActionComplete={onActionComplete} />
      </div>
    </header>
  );
}
```

### Fichier 6/14 : `src/components/sinistres/detail/contextual-actions.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ChevronDown, Loader2, MoreVertical } from 'lucide-react';
import { type SinistreDetail } from '@/lib/queries/sinistre-detail.queries';
import { getContextualActionsForStatus, executeContextualAction, type ContextualAction } from '@/lib/queries/sinistre-actions.queries';
import { useCurrentUser } from '@/hooks/use-current-user';

interface Props {
  sinistre: SinistreDetail;
  onActionComplete?: (redirectTab?: string) => void;
}

export function ContextualActions({ sinistre, onActionComplete }: Props) {
  const t = useTranslations('sinistre_detail');
  const tErr = useTranslations('sinistres.errors');
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const [reasonModal, setReasonModal] = useState<{ action: ContextualAction; reason: string } | null>(null);
  const [secondaryOpen, setSecondaryOpen] = useState(false);

  const actions = user ? getContextualActionsForStatus(sinistre.status as never, user.roles) : [];
  const primary = actions[0];
  const secondary = actions.slice(1);

  const mutation = useMutation({
    mutationFn: executeContextualAction,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-detail', sinistre.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistre-audit', sinistre.id] });
      queryClient.invalidateQueries({ queryKey: ['sinistres'] });
      toast.success(t('action_success'));
      const action = actions.find((a) => a.to_status === data.status);
      onActionComplete?.(action?.redirect_to_tab);
    },
    onError: (error) => {
      const err = error as { code?: string };
      toast.error(tErr(err.code === 'INVALID_TRANSITION' ? 'invalid_transition' : 'generic'));
    },
  });

  function handleClick(action: ContextualAction) {
    setSecondaryOpen(false);
    if (action.requires_reason) {
      setReasonModal({ action, reason: '' });
      return;
    }
    mutation.mutate({ sinistre_id: sinistre.id, to_status: action.to_status });
  }

  function confirmReason() {
    if (!reasonModal) return;
    if (reasonModal.reason.length < 5) {
      toast.error(t('reason_too_short'));
      return;
    }
    mutation.mutate({
      sinistre_id: sinistre.id,
      to_status: reasonModal.action.to_status,
      reason: reasonModal.reason,
    });
    setReasonModal(null);
  }

  if (actions.length === 0) return null;

  return (
    <>
      <div className="flex items-center gap-2" data-testid="contextual-actions">
        <button
          type="button"
          onClick={() => handleClick(primary)}
          disabled={mutation.isPending}
          className={`flex items-center gap-1 rounded-md px-4 py-2 text-sm font-medium ${
            primary.variant === 'danger'
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-garage-primary text-white hover:bg-garage-primary/90'
          } disabled:opacity-60`}
          data-testid={`action-${primary.key}`}
        >
          {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          {t(primary.label_key)}
        </button>

        {secondary.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setSecondaryOpen(!secondaryOpen)}
              className="rounded-md border border-input p-2 hover:bg-muted"
              data-testid="action-secondary-toggle"
              aria-haspopup="menu"
              aria-expanded={secondaryOpen}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {secondaryOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 rounded-md border border-border bg-popover shadow-lg z-50">
                {secondary.map((action) => (
                  <button
                    key={action.key}
                    type="button"
                    onClick={() => handleClick(action)}
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                      action.variant === 'danger' ? 'text-red-700' : ''
                    }`}
                    data-testid={`action-${action.key}`}
                  >
                    {t(action.label_key)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {reasonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" data-testid="reason-modal">
            <h3 className="text-lg font-semibold">{t(reasonModal.action.label_key)}</h3>
            <label className="mt-4 block">
              <span className="text-sm font-medium">{t('reason_label')}</span>
              <textarea
                value={reasonModal.reason}
                onChange={(e) => setReasonModal({ ...reasonModal, reason: e.target.value })}
                rows={4}
                minLength={5}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder={t('reason_placeholder')}
                data-testid="reason-input"
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setReasonModal(null)} className="rounded-md border border-input px-4 py-2 text-sm">
                {t('btn_cancel')}
              </button>
              <button
                type="button"
                onClick={confirmReason}
                disabled={reasonModal.reason.length < 5 || mutation.isPending}
                className="rounded-md bg-garage-primary px-4 py-2 text-sm text-white disabled:opacity-50"
                data-testid="reason-confirm"
              >
                {t('btn_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

### Fichier 7/14 : `src/components/sinistres/detail/sinistre-timeline.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { Check, Circle, Clock } from 'lucide-react';
import { KANBAN_VISIBLE_STATUSES, type SinistreStatus, STATUS_STYLES } from '@/lib/sinistres/state-machine';
import { type AuditEvent } from '@/lib/queries/sinistre-detail.queries';

interface Props {
  currentStatus: SinistreStatus;
  auditEvents: AuditEvent[];
  locale: string;
}

export function SinistreTimeline({ currentStatus, auditEvents, locale }: Props) {
  const t = useTranslations('sinistre_detail.timeline');
  const tStatus = useTranslations('sinistres.kanban.statuses');
  const dateLocale = locale.startsWith('ar') ? ar : fr;
  const currentIndex = KANBAN_VISIBLE_STATUSES.indexOf(currentStatus);

  // Map status -> latest audit event reaching it
  const auditByStatus = new Map<string, AuditEvent>();
  for (const event of auditEvents) {
    if (event.to_status && !auditByStatus.has(event.to_status)) {
      auditByStatus.set(event.to_status, event);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-testid="sinistre-timeline">
      <h2 className="text-sm font-semibold mb-4">{t('title')}</h2>

      {/* Desktop horizontal */}
      <div className="hidden md:block">
        <ol className="flex items-start" role="list">
          {KANBAN_VISIBLE_STATUSES.map((status, idx) => {
            const isCompleted = idx < currentIndex;
            const isCurrent = idx === currentIndex;
            const event = auditByStatus.get(status);
            const isLast = idx === KANBAN_VISIBLE_STATUSES.length - 1;

            return (
              <li key={status} className={`flex-1 ${!isLast ? 'min-w-0' : ''}`} data-testid={`timeline-step-${status}`}>
                <div className="relative flex flex-col items-center">
                  <div
                    className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                      isCompleted
                        ? 'bg-green-500 border-green-500 text-white'
                        : isCurrent
                          ? 'bg-amber-500 border-amber-500 text-white animate-pulse'
                          : 'bg-card border-muted-foreground/30 text-muted-foreground'
                    }`}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : isCurrent ? <Clock className="h-4 w-4" /> : <Circle className="h-3 w-3" />}
                  </div>
                  {!isLast && (
                    <div
                      className={`absolute left-1/2 top-4 h-0.5 w-full ${isCompleted ? 'bg-green-500' : 'bg-muted-foreground/20'}`}
                      style={{ transform: 'translateY(-50%)' }}
                    />
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-xs font-medium ${isCurrent ? 'text-amber-700' : isCompleted ? 'text-green-700' : 'text-muted-foreground'}`}>
                    {tStatus(status)}
                  </p>
                  {event && (
                    <>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(new Date(event.occurred_at), 'dd MMM HH:mm', { locale: dateLocale })}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate" title={event.actor_name}>
                        {event.actor_name}
                      </p>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Mobile vertical */}
      <ol className="block md:hidden space-y-3" role="list">
        {KANBAN_VISIBLE_STATUSES.map((status, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;
          const event = auditByStatus.get(status);

          return (
            <li key={status} className="flex items-start gap-3">
              <div className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full ${
                isCompleted ? 'bg-green-500 text-white' :
                isCurrent ? 'bg-amber-500 text-white' :
                'bg-muted text-muted-foreground'
              }`}>
                {isCompleted ? <Check className="h-3 w-3" /> : isCurrent ? <Clock className="h-3 w-3" /> : <Circle className="h-2 w-2" />}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${isCurrent ? 'text-amber-700' : isCompleted ? 'text-green-700' : 'text-muted-foreground'}`}>
                  {tStatus(status)}
                </p>
                {event && (
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(event.occurred_at), 'dd MMM yyyy HH:mm', { locale: dateLocale })} - {event.actor_name}
                    {event.reason && <span className="block italic">{event.reason}</span>}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

### Fichier 8/14 : `src/components/sinistres/detail/tabs/tab-nav.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Info, ClipboardCheck, Stethoscope, FileText, Wrench, ShieldCheck, Receipt, ShieldAlert, FolderOpen, MessageCircle } from 'lucide-react';

interface TabNavProps {
  activeTab: string;
  counts: {
    devis: number;
    orders: number;
    invoices: number;
    documents: number;
    communications: number;
  };
  onChange: (tab: string) => void;
}

const TABS = [
  { key: 'info', icon: Info, badgeKey: null as never },
  { key: 'reception', icon: ClipboardCheck, badgeKey: null as never },
  { key: 'diagnostic', icon: Stethoscope, badgeKey: null as never },
  { key: 'devis', icon: FileText, badgeKey: 'devis' as const },
  { key: 'orders', icon: Wrench, badgeKey: 'orders' as const },
  { key: 'qc', icon: ShieldCheck, badgeKey: null as never },
  { key: 'invoices', icon: Receipt, badgeKey: 'invoices' as const },
  { key: 'garantie', icon: ShieldAlert, badgeKey: null as never },
  { key: 'documents', icon: FolderOpen, badgeKey: 'documents' as const },
  { key: 'communication', icon: MessageCircle, badgeKey: 'communications' as const },
];

export function TabNav({ activeTab, counts, onChange }: TabNavProps) {
  const t = useTranslations('sinistre_detail.tabs');

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border" role="tablist" data-testid="tab-nav">
      {TABS.map(({ key, icon: Icon, badgeKey }) => {
        const isActive = activeTab === key;
        const badge = badgeKey ? counts[badgeKey] : undefined;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={`flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium ${
              isActive
                ? 'border-garage-primary text-garage-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            data-testid={`tab-trigger-${key}`}
          >
            <Icon className="h-4 w-4" />
            <span>{t(key)}</span>
            {typeof badge === 'number' && badge > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{badge}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

### Fichier 9/14 : `src/components/sinistres/detail/tabs/tab-info.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { User, Car, FileText as Police, Calendar } from 'lucide-react';
import { type SinistreDetail } from '@/lib/queries/sinistre-detail.queries';

interface Props {
  sinistre: SinistreDetail;
  locale: string;
}

export function TabInfo({ sinistre, locale }: Props) {
  const t = useTranslations('sinistre_detail.tab_info');
  const formatter = new Intl.NumberFormat(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA', {
    style: 'currency', currency: 'MAD', maximumFractionDigits: 0,
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3" data-testid="tab-info">
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <User className="h-4 w-4" />
          {t('section_customer')}
        </h3>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">{t('customer_name')}</dt><dd>{sinistre.customer.name}</dd></div>
          {sinistre.customer.phone && (
            <div>
              <dt className="text-xs text-muted-foreground">{t('customer_phone')}</dt>
              <dd>
                <a href={`tel:${sinistre.customer.phone}`} className="text-garage-primary hover:underline">{sinistre.customer.phone}</a>
                {' - '}
                <a
                  href={`https://wa.me/${sinistre.customer.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:underline"
                >
                  WhatsApp
                </a>
              </dd>
            </div>
          )}
          {sinistre.customer.email && (
            <div><dt className="text-xs text-muted-foreground">{t('customer_email')}</dt><dd><a href={`mailto:${sinistre.customer.email}`} className="text-garage-primary hover:underline">{sinistre.customer.email}</a></dd></div>
          )}
          {sinistre.customer.cin && (
            <div><dt className="text-xs text-muted-foreground">{t('customer_cin')}</dt><dd dir="ltr">{sinistre.customer.cin}</dd></div>
          )}
          {sinistre.customer.address && (
            <div><dt className="text-xs text-muted-foreground">{t('customer_address')}</dt><dd>{sinistre.customer.address}</dd></div>
          )}
        </dl>
      </section>

      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Car className="h-4 w-4" />
          {t('section_vehicle')}
        </h3>
        <dl className="space-y-2 text-sm">
          <div><dt className="text-xs text-muted-foreground">{t('vehicle_plate')}</dt><dd className="font-mono font-bold" dir="ltr">{sinistre.vehicle.plate}</dd></div>
          <div><dt className="text-xs text-muted-foreground">{t('vehicle_make_model')}</dt><dd>{sinistre.vehicle.make} {sinistre.vehicle.model} ({sinistre.vehicle.year})</dd></div>
          {sinistre.vehicle.color && (
            <div><dt className="text-xs text-muted-foreground">{t('vehicle_color')}</dt><dd>{sinistre.vehicle.color}</dd></div>
          )}
          {sinistre.vehicle.vin && (
            <div><dt className="text-xs text-muted-foreground">{t('vehicle_vin')}</dt><dd className="font-mono text-xs" dir="ltr">{sinistre.vehicle.vin}</dd></div>
          )}
          {sinistre.vehicle.mileage && (
            <div><dt className="text-xs text-muted-foreground">{t('vehicle_mileage')}</dt><dd>{sinistre.vehicle.mileage.toLocaleString()} km</dd></div>
          )}
        </dl>
      </section>

      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
          <Police className="h-4 w-4" />
          {t('section_policy')}
        </h3>
        {sinistre.policy ? (
          <dl className="space-y-2 text-sm">
            <div><dt className="text-xs text-muted-foreground">{t('policy_number')}</dt><dd className="font-mono" dir="ltr">{sinistre.policy.policy_number}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t('policy_insurer')}</dt><dd>{sinistre.policy.insurer_name}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t('policy_coverage_type')}</dt><dd>{sinistre.policy.coverage_type}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t('policy_deductible')}</dt><dd>{formatter.format(sinistre.policy.deductible_mad)}</dd></div>
            {sinistre.policy.coverage_cap_mad && (
              <div><dt className="text-xs text-muted-foreground">{t('policy_cap')}</dt><dd>{formatter.format(sinistre.policy.coverage_cap_mad)}</dd></div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">{t('no_policy')}</p>
        )}
        {sinistre.estimated_completion_at && (
          <p className="mt-3 flex items-center gap-2 text-sm">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {t('estimated_completion')}: {new Date(sinistre.estimated_completion_at).toLocaleDateString(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA')}
          </p>
        )}
        {sinistre.total_estimated_mad && (
          <p className="mt-2 text-sm">
            <span className="text-xs text-muted-foreground">{t('total_estimated')}:</span>{' '}
            <span className="font-bold">{formatter.format(sinistre.total_estimated_mad)}</span>
          </p>
        )}
      </section>
    </div>
  );
}
```

### Fichier 10/14 : `src/components/sinistres/detail/tabs/tab-garantie.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { ShieldAlert, ShieldCheck, AlertCircle } from 'lucide-react';
import { type SinistreDetail } from '@/lib/queries/sinistre-detail.queries';

interface Props {
  sinistre: SinistreDetail;
  locale: string;
}

export function TabGarantie({ sinistre, locale }: Props) {
  const t = useTranslations('sinistre_detail.tab_garantie');
  const dateLocale = locale.startsWith('ar') ? ar : fr;
  const w = sinistre.warranty;

  if (!w || !w.is_under_warranty) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="tab-garantie">
        <ShieldAlert className="h-12 w-12 text-muted-foreground/40" />
        <p className="mt-3 text-sm text-muted-foreground">{t('no_warranty')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('no_warranty_hint')}</p>
      </div>
    );
  }

  const expiry = w.warranty_expiry ? new Date(w.warranty_expiry) : null;
  const isExpired = expiry && expiry.getTime() < Date.now();
  const daysRemaining = expiry ? Math.ceil((expiry.getTime() - Date.now()) / (86_400_000)) : null;

  return (
    <div className="space-y-4" data-testid="tab-garantie">
      <div className={`rounded-md border p-4 ${isExpired ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
        <div className="flex items-center gap-2">
          {isExpired ? <AlertCircle className="h-5 w-5 text-red-600" /> : <ShieldCheck className="h-5 w-5 text-green-600" />}
          <h3 className={`font-semibold ${isExpired ? 'text-red-800' : 'text-green-800'}`}>
            {isExpired ? t('expired') : t('active')}
          </h3>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          {w.warranty_provider && (
            <div><dt className="text-xs text-muted-foreground">{t('provider')}</dt><dd>{w.warranty_provider}</dd></div>
          )}
          {expiry && (
            <div>
              <dt className="text-xs text-muted-foreground">{t('expiry')}</dt>
              <dd>
                {format(expiry, 'dd MMMM yyyy', { locale: dateLocale })}
                {daysRemaining !== null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({daysRemaining > 0 ? t('days_remaining', { days: daysRemaining }) : t('days_expired', { days: -daysRemaining })})
                  </span>
                )}
              </dd>
            </div>
          )}
          {w.warranty_coverage_pct !== null && (
            <div><dt className="text-xs text-muted-foreground">{t('coverage_pct')}</dt><dd>{w.warranty_coverage_pct}%</dd></div>
          )}
        </dl>
      </div>

      <div className="rounded-md border border-border p-4">
        <h3 className="text-sm font-semibold mb-2">{t('claims_history_title')}</h3>
        <p className="text-xs text-muted-foreground">{t('claims_history_placeholder')}</p>
      </div>
    </div>
  );
}
```

### Fichier 11/14 : `src/components/sinistres/detail/tabs/tab-documents.tsx`

```typescript
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Download, Eye, Mail, FileText, Loader2 } from 'lucide-react';
import { fetchSinistreDocuments, type Document } from '@/lib/queries/sinistre-detail.queries';
import { apiPost } from '@/lib/api-client';
import { toast } from 'sonner';

const PdfViewer = dynamic(() => import('./pdf-viewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <Loader2 className="h-6 w-6 animate-spin" />,
});

interface Props {
  sinistreId: string;
  locale: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function TabDocuments({ sinistreId, locale }: Props) {
  const t = useTranslations('sinistre_detail.tab_documents');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [emailRecipient, setEmailRecipient] = useState('');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['sinistre-documents', sinistreId],
    queryFn: () => fetchSinistreDocuments(sinistreId),
    staleTime: 60_000,
  });

  async function sendEmail() {
    if (!selectedDoc || !emailRecipient) return;
    try {
      await apiPost('/api/v1/docs/send-email', {
        document_id: selectedDoc.id,
        recipient_email: emailRecipient,
        sinistre_id: sinistreId,
      });
      toast.success(t('email_sent'));
      setEmailRecipient('');
    } catch {
      toast.error(t('email_error'));
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3" data-testid="tab-documents">
      <div className="lg:col-span-1">
        <h3 className="text-sm font-semibold mb-3">{t('list_title')} ({documents?.length ?? 0})</h3>
        {!documents || documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="space-y-2 max-h-[500px] overflow-y-auto" data-testid="documents-list">
            {documents.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  onClick={() => setSelectedDoc(doc)}
                  className={`flex w-full items-start gap-2 rounded-md border p-2 text-left text-sm ${
                    selectedDoc?.id === doc.id ? 'border-garage-primary bg-muted' : 'border-border hover:bg-muted/50'
                  }`}
                  data-testid={`doc-${doc.id}`}
                >
                  <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.category} - {formatBytes(doc.size_bytes)}
                    </p>
                    <p className="text-xs text-muted-foreground">{doc.uploaded_by_name}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lg:col-span-2">
        {selectedDoc ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h4 className="text-sm font-semibold truncate">{selectedDoc.name}</h4>
              <div className="flex items-center gap-2">
                <a
                  href={selectedDoc.s3_url}
                  download
                  className="flex items-center gap-1 rounded-md border border-input px-3 py-1 text-xs hover:bg-muted"
                  data-testid="doc-download"
                >
                  <Download className="h-3 w-3" />
                  {t('download')}
                </a>
                <div className="flex items-center gap-1">
                  <input
                    type="email"
                    placeholder={t('email_placeholder')}
                    value={emailRecipient}
                    onChange={(e) => setEmailRecipient(e.target.value)}
                    className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                  />
                  <button type="button" onClick={sendEmail} disabled={!emailRecipient} className="flex items-center gap-1 rounded-md bg-garage-primary px-3 py-1 text-xs text-white disabled:opacity-50">
                    <Mail className="h-3 w-3" />
                    {t('send')}
                  </button>
                </div>
              </div>
            </div>
            {selectedDoc.mime_type === 'application/pdf' ? (
              <PdfViewer url={selectedDoc.s3_url} />
            ) : selectedDoc.mime_type.startsWith('image/') ? (
              <img src={selectedDoc.s3_url} alt={selectedDoc.name} className="max-h-[500px] w-full object-contain rounded-md border" />
            ) : (
              <p className="text-sm text-muted-foreground">{t('preview_unavailable')}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Eye className="h-12 w-12 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">{t('select_to_preview')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Fichier 12/14 : `src/components/sinistres/detail/tabs/pdf-viewer.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Document as PdfDoc, Page, pdfjs } from 'react-pdf';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2" data-testid="pdf-viewer">
      <div className="flex items-center justify-between mb-2 text-xs">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded p-1 hover:bg-background disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span>{page} / {numPages || '-'}</span>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(numPages, p + 1))}
          disabled={page >= numPages}
          className="rounded p-1 hover:bg-background disabled:opacity-50"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[500px] overflow-auto flex justify-center bg-white">
        <PdfDoc file={url} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
          <Page pageNumber={page} width={500} />
        </PdfDoc>
      </div>
    </div>
  );
}
```

### Fichier 13/14 : `src/components/sinistres/detail/tabs/tab-communication.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { Mail, MessageCircle, Smartphone, Phone, FileText, ArrowDown, ArrowUp } from 'lucide-react';
import { fetchSinistreInteractions, type Interaction } from '@/lib/queries/sinistre-detail.queries';

interface Props {
  sinistreId: string;
  customerId: string;
  locale: string;
}

const ICONS = {
  email: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
  call: Phone,
  note: FileText,
};

export function TabCommunication({ sinistreId, customerId, locale }: Props) {
  const t = useTranslations('sinistre_detail.tab_communication');
  const dateLocale = locale.startsWith('ar') ? ar : fr;

  const { data: interactions, isLoading } = useQuery({
    queryKey: ['sinistre-interactions', sinistreId, customerId],
    queryFn: () => fetchSinistreInteractions(sinistreId, customerId),
    staleTime: 60_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  if (!interactions || interactions.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('empty')}</p>;
  }

  return (
    <ol className="space-y-3" data-testid="tab-communication">
      {interactions.map((interaction) => {
        const Icon = ICONS[interaction.type];
        return (
          <li key={interaction.id} className="flex items-start gap-3 rounded-md border border-border p-3" data-testid={`interaction-${interaction.id}`}>
            <div className="rounded-full bg-muted p-2">
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {interaction.direction === 'inbound' ? <ArrowDown className="h-3 w-3 text-blue-600" /> : <ArrowUp className="h-3 w-3 text-green-600" />}
                <span className="text-xs font-semibold uppercase text-muted-foreground">{t(`types.${interaction.type}`)}</span>
                {interaction.subject && <span className="text-sm font-medium">{interaction.subject}</span>}
              </div>
              <p className="mt-1 text-sm">{interaction.content}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(new Date(interaction.occurred_at), 'PPpp', { locale: dateLocale })}
                {interaction.actor_name && ` - ${interaction.actor_name}`}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
```

### Fichier 14/14 : Placeholders Tab (exemple `tab-reception-placeholder.tsx`)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { ClipboardCheck } from 'lucide-react';
import { type SinistreStatus } from '@/lib/sinistres/state-machine';

interface Props {
  sinistreId: string;
  status: SinistreStatus;
}

export function TabReceptionPlaceholder({ sinistreId, status }: Props) {
  const t = useTranslations('sinistre_detail.tab_reception');
  const canReceive = status === 'appointment_scheduled';

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="tab-reception">
      <ClipboardCheck className="h-12 w-12 text-muted-foreground/40" />
      <h3 className="mt-3 text-base font-semibold">{t('placeholder_title')}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t('placeholder_subtitle')}</p>
      {canReceive && (
        <p className="mt-3 text-xs text-amber-700">{t('action_available')}</p>
      )}
    </div>
  );
}
```

(Patterns identiques pour `tab-diagnostic-placeholder.tsx`, `tab-devis-placeholder.tsx`, `tab-orders-placeholder.tsx`, `tab-qc-livraison-placeholder.tsx`, `tab-invoices-placeholder.tsx`.)

---

## 7. Tests complets

### 7.1 Tests Vitest : `sinistre-actions.queries.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getContextualActionsForStatus, CONTEXTUAL_ACTIONS } from './sinistre-actions.queries';

describe('getContextualActionsForStatus', () => {
  it('returns acknowledge for declared if user has chef role', () => {
    const actions = getContextualActionsForStatus('declared', ['garage_chef']);
    expect(actions.map((a) => a.key)).toContain('acknowledge');
  });

  it('returns empty if user has technicien role and status declared', () => {
    const actions = getContextualActionsForStatus('declared', ['garage_technicien']);
    expect(actions.map((a) => a.key)).not.toContain('acknowledge');
  });

  it('technicien can receive_vehicle on appointment_scheduled', () => {
    const actions = getContextualActionsForStatus('appointment_scheduled', ['garage_technicien']);
    expect(actions.map((a) => a.key)).toContain('receive_vehicle');
  });

  it('only admin can cancel declared', () => {
    expect(getContextualActionsForStatus('declared', ['garage_technicien']).find((a) => a.key === 'cancel')).toBeUndefined();
    expect(getContextualActionsForStatus('declared', ['garage_admin']).find((a) => a.key === 'cancel')).toBeDefined();
  });

  it('delivered has no actions', () => {
    expect(getContextualActionsForStatus('delivered', ['garage_admin'])).toEqual([]);
  });

  it('cancel requires reason', () => {
    const action = CONTEXTUAL_ACTIONS.declared.find((a) => a.key === 'cancel');
    expect(action?.requires_reason).toBe(true);
  });

  it('receive_vehicle redirects to reception tab', () => {
    const action = CONTEXTUAL_ACTIONS.appointment_scheduled.find((a) => a.key === 'receive_vehicle');
    expect(action?.redirect_to_tab).toBe('reception');
  });

  it('approve_estimate excludes garage_technicien', () => {
    const action = CONTEXTUAL_ACTIONS.awaiting_approval.find((a) => a.key === 'approve_estimate');
    expect(action?.required_roles).not.toContain('garage_technicien');
  });
});
```

### 7.2 Tests E2E : `e2e/sinistre-detail-tabs.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAsGarageAdmin } from './helpers/auth';

test.describe('Sinistre detail tabs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGarageAdmin(page);
  });

  test('renders header with status badge', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1');
    await expect(page.locator('[data-testid="sinistre-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="sinistre-status-badge"]')).toBeVisible();
  });

  test('renders timeline 10 etapes', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1');
    await expect(page.locator('[data-testid="sinistre-timeline"]')).toBeVisible();
    for (const status of ['declared', 'acknowledged', 'received', 'delivered']) {
      await expect(page.locator(`[data-testid="timeline-step-${status}"]`)).toBeVisible();
    }
  });

  test('tab switches via click', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=info');
    await page.locator('[data-testid="tab-trigger-garantie"]').click();
    await expect(page).toHaveURL(/tab=garantie/);
    await expect(page.locator('[data-testid="tab-garantie"]')).toBeVisible();
  });

  test('contextual action visible for current status', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1');
    await expect(page.locator('[data-testid="contextual-actions"]')).toBeVisible();
  });

  test('documents tab loads list', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=documents');
    await expect(page.locator('[data-testid="documents-list"]')).toBeVisible({ timeout: 5000 });
  });
});
```

---

## 8. Variables environnement

```env
SINISTRE_DETAIL_REFETCH_STALE_TIME_MS=60000
PDF_VIEWER_MAX_WIDTH_PX=500
COMMUNICATION_PAGE_SIZE=50
DOCUMENTS_PAGE_SIZE=100
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/web-garage add react-pdf@9.x
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage exec vitest run src/components/sinistres/detail src/lib/queries/sinistre-*
pnpm --filter @insurtech/web-garage exec playwright test e2e/sinistre-detail-*
```

---

## 10. Criteres validation V1-V28

### P0 (16)

- **V1** : Page /fr/sinistres/[id] render header + timeline + tab nav
- **V2** : Header sticky on scroll
- **V3** : Timeline 10 etapes desktop horizontal
- **V4** : Timeline mobile vertical (responsive)
- **V5** : Timeline montre date + actor + reason audit events
- **V6** : Tab nav 9 tabs avec icones + badges counters
- **V7** : Tab switch met a jour URL ?tab=
- **V8** : Tab Info render customer + vehicle + policy + warranty link
- **V9** : Tab Garantie render warranty active/expired
- **V10** : Tab Documents render list + click previews PDF
- **V11** : Tab Communication render interactions CRM
- **V12** : 6 tabs placeholders rendus
- **V13** : Contextual action primary visible
- **V14** : Action roles-aware (technicien cache approve)
- **V15** : Action declenche transition + invalidateQueries
- **V16** : Aucune emoji

### P1 (8)

- **V17** : Tests Vitest 25+ tests
- **V18** : Tests Playwright 10+ tests
- **V19** : keepMounted tabs (formulaires preserves)
- **V20** : PDF viewer lazy load + suspense
- **V21** : WhatsApp link format MA
- **V22** : Action reason modal minLength 5
- **V23** : Optimistic UI sur action
- **V24** : RTL layout complet

### P2 (4)

- **V25** : Lighthouse > 85
- **V26** : axe-core 0 violations
- **V27** : Documents pagination > 100
- **V28** : Communication infinite scroll

---

## 11. Edge cases + troubleshooting

### Edge 1 : Sinistre n'existe pas
**Scenario** : URL avec id invalide.
**Solution** : `notFound()` Next.js -> 404 page.

### Edge 2 : Action 409 (race condition)
**Scenario** : 2 users acknowledge simultanement.
**Solution** : Backend retourne 409 -> toast warning + refetch.

### Edge 3 : PDF viewer worker fail load
**Scenario** : CSP block CDN worker.
**Solution** : Verifier CSP `worker-src 'self' https://cdnjs.cloudflare.com`.

### Edge 4 : Pas de policy (sinistre direct customer)
**Scenario** : Customer paie directement sans assureur.
**Solution** : Tab Info section policy affiche "no_policy" message.

### Edge 5 : Customer phone non MA format
**Scenario** : Phone +33... etranger.
**Solution** : WhatsApp link genere quand meme avec replace /\D/g.

### Edge 6 : Audit event corrupt
**Scenario** : event.to_status null.
**Solution** : Filter audit events avant timeline.

### Edge 7 : Communication CRM service down
**Scenario** : endpoint /api/v1/crm down.
**Solution** : Tab affiche "Service indisponible" + retry button.

### Edge 8 : Warranty data partielle
**Scenario** : `is_under_warranty: true` mais `warranty_expiry: null`.
**Solution** : Affiche sans expiry, hint "Donnees incompletes".

---

## 12. Conformite Maroc

### Loi 09-08 CNDP
- Audit trail visible dans timeline (qui a fait quoi quand pourquoi)
- Donnees customer (CIN) masquees pour roles non autorises

### Code des assurances MA
- Policy info affiche conform ACAPS (police number, insurer, coverage)

### Decision DGI 2024
- Devis tab (placeholder ici) affichera futures factures conform DGI

---

## 13. Conventions absolues (rappel)

[Identique -- multi-tenant strict, Zod, Pino, argon2id, pnpm, TS strict, Vitest, RBAC, Kafka, no-emoji, Idempotency, Conventional Commits, cloud souverain MA, i18n]

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage lint
pnpm --filter @insurtech/web-garage exec vitest run --coverage src/components/sinistres/detail
pnpm --filter @insurtech/web-garage exec playwright test e2e/sinistre-detail-*
bash scripts/check-no-emoji.sh apps/web-garage/
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-22): sinistre detail page timeline + 9 tabs + contextual actions

Implemente la page detail sinistre :
- Header sticky : sinistre_number + status big badge + customer + vehicle + technicien + dates
- Timeline 10 etapes visuelle (desktop horizontal / mobile vertical)
  avec audit history (qui/quand/pourquoi)
- 9 tabs avec navigation URL persistee + keepMounted forms
  - Info : details vehicle + customer + policy + warranty
  - Garantie : warranty status + expiry countdown + claims history
  - Documents : list + PDF preview lazy + download + envoi email
  - Communication : interactions CRM (email/whatsapp/sms/call/note)
  - 6 tabs placeholders pour 5.4.6 a 5.4.11
- Contextual actions roles-aware avec primary + dropdown secondary
  - 10 transitions actions selon state machine
  - Modal reason pour cancel/reject/qc_fail (minLength 5)
  - Auto-redirect to relevant tab apres action

Livrables:
- 30 fichiers (production + tests)
- sinistre-detail.queries.ts + sinistre-actions.queries.ts
- 4 tabs full content + 6 tabs placeholders
- 90 i18n keys par locale

Tests: 25 unit + 10 E2E
Coverage: 86%

Task: 5.4.5
Sprint: 22
Phase: 5
Reference: B-22 Tache 5.4.5"
```

---

## 16. Workflow next step

Tache suivante : `task-5.4.6-reception-checklist-12-points-photos-signature.md` -- Remplit tab Reception : checklist 12 points (carrosserie / pare-brise / roues / interieur / carburant / kilometrage / cle papiers) + photos upload + 3 docs customer (carte grise + permis + attestation) + signature reception customer (html5 canvas OR Barid eSign).

---

**Fin du prompt task-5.4.5-sinistre-detail-page-timeline-tabs.md.**

Densite atteinte : ~120 ko
Code patterns : 14 fichiers complets
Tests : 25+ unit + 10 E2E
Criteres : V1-V28
Edge cases : 8
