# META-PROMPT B-22 -- SPRINT 22 WEB GARAGE APP

**Version** : v2.2 (Option B)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Sprint** : 22 / 35 (cumul) -- Phase 5 Sprint 4
**Position** : Apres Sinistre Workflow, avant Web Garage Mobile
**Numerotation taches** : 5.4.1 a 5.4.13
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (UI metier production garage -- consume backend Sprint 19-21)

---

## Objectif Global du Sprint

Construire l'application **web-garage** (port 3002) Next.js 15 App Router : interface metier complete pour personnel garage (4 roles : garage_admin / garage_chef / garage_technicien / garage_gestionnaire). Consume tous endpoints backend Sprint 19-21 (entities + workflows + documents). Skalean Atlas premier garage tenant.

A la sortie de ce sprint :
- App web-garage Next.js 15 desktop (port 3002 dev / `garage.skalean-insurtech.ma` prod)
- 12 pages applicatives : login + MFA + dashboard + sinistres + receptions + diagnostics + devis + orders + qc + livraisons + invoices + parametres
- Pattern Next.js 15 reutilise Sprint 16 web-broker
- 4 roles UI : voir features specifiques
- IA Estimation suggestions visualization (Sprint 20)
- Workflow visualization : etapes sinistre avec status visuels
- Facturation split UI : preview avant generation
- Documents browser + download + envoi
- I18n fr/ar-MA/ar + RTL
- Tests Playwright E2E + WCAG 2.1 AA

---

## Frontiere du Sprint

**INCLUS** :
- App Next.js 15 production-ready
- 12 pages applicatives core
- 4 roles garage UI conditional rendering
- IA suggestions visualization
- Workflow status timeline
- Facturation split preview
- Tests Playwright E2E

**EXCLU** (sera ajoute aux sprints suivants) :
- web-garage-mobile PWA (technicien) -- Sprint 23
- Real-time updates WebSocket (poll temporary) -- Phase 7+
- IA chatbot Agent Sky -- Sprint 31 (defere)

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 16 : pattern Next.js 15 stable
2. Sortie Sprint 19, 20, 21 : entities Repair + IA + workflow
3. Sortie Sprint 13 : Analytics dashboards
4. Sortie Sprint 7 : RBAC matrice etendue Sprint 19+21

---

## Stack Imposee (Sprint 22)

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.0.4 | App Router |
| react | 19.0.0 | with React Compiler |
| @tanstack/react-query | 5.62.0 | mutations |
| recharts | 2.13.x | dashboards |
| react-pdf | 9.x | PDF preview documents |
| @dnd-kit/core | 6.x | drag-drop kanban sinistres |
| zod | 3.24.1 | validation |

Variables env : `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_NAME=skalean-garage`.

---

## Vue d'Ensemble des 13 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 5.4.1 | App skeleton + middleware auth/tenant + layout (sidebar + topbar) | 6h | P0 | Sprint 21 |
| 5.4.2 | Pages auth : reuse pattern Sprint 16 (login + MFA + recovery) | 4h | P0 | 5.4.1 |
| 5.4.3 | Dashboard garage : 6 widgets (sinistres en cours, throughput, revenue, ratings, parts low stock, technicien charge) | 6h | P0 | 5.4.2 |
| 5.4.4 | Sinistres page : Kanban view (status colonnes) + Table view + filters | 7h | P0 | 5.4.3 |
| 5.4.5 | Sinistre detail page : timeline + tabs (reception/diag/devis/orders/qc/delivery/warranty) | 8h | P0 | 5.4.4 |
| 5.4.6 | Reception page : checklist 12 points + photos upload + signature reception | 6h | P0 | 5.4.5 |
| 5.4.7 | Diagnostics page : IA suggestions visualization + validation technicien + rapport gen | 7h | P0 | 5.4.6 |
| 5.4.8 | Devis page : create from diagnostic + items editor + send + tracking | 6h | P0 | 5.4.7 |
| 5.4.9 | Orders page : list orders en cours + tracking real-time + log hours + parts consume | 6h | P0 | 5.4.8 |
| 5.4.10 | QC + Delivery page : checklist + signature livraison + bon livraison | 5h | P0 | 5.4.9 |
| 5.4.11 | Invoices page : list + preview split insurer/customer + PDF download | 5h | P0 | 5.4.10 |
| 5.4.12 | Parametres + 4 roles RBAC UI + i18n | 4h | P0 | 5.4.11 |
| 5.4.13 | Tests Playwright E2E (20+) + WCAG 2.1 AA + Lighthouse | 8h | P0 | 5.4.12 |

**Total** : 78 heures.

---

# DETAIL DES 13 TACHES

---

## Tache 5.4.1 -- App Skeleton + Layout

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 6h / Depend de Sprint 21

**But** : Initialiser app `web-garage` reutilisant pattern Sprint 16 (middleware auth + tenant + i18n) + layout adapte garage workflow.

**Livrables checkables** :
- [ ] Folder `repo/apps/web-garage/`
- [ ] App skeleton Next.js 15 + design tokens Sofidemy Sprint 4
- [ ] Middleware reutilise pattern Sprint 16 (cookies httpOnly + tenant context + locale)
- [ ] Layout principal :
  - **Sidebar gauche** : Dashboard / Sinistres (avec badge count en cours) / Receptions / Diagnostics / Devis / Orders / QC / Livraisons / Invoices / Garanties / Stock (link Sprint 13) / HR (link Sprint 13) / Parametres
  - **Topbar** : search global (sinistres + customer + plate immat) + tenant switcher + locale + user menu
- [ ] FAB "Nouveau sinistre" : visible toujours (creation manuelle si client direct)
- [ ] Notifications bell : poll 30s
- [ ] Tests : app demarre + middleware redirect + layout

**Fichiers crees / modifies** :
```
repo/apps/web-garage/                                                            # full Next.js 15 app
repo/apps/web-garage/middleware.ts                                                # reuse pattern Sprint 16
repo/apps/web-garage/app/[locale]/(auth)/layout.tsx
repo/apps/web-garage/app/[locale]/(protected)/layout.tsx
repo/apps/web-garage/components/layout/sidebar.tsx                                # ~150 lignes
repo/apps/web-garage/components/layout/topbar.tsx                                  # ~150 lignes
repo/apps/web-garage/components/layout/new-sinistre-fab.tsx                        # ~80 lignes
repo/apps/web-garage/messages/{fr,ar-MA,ar}.json                                    # 3 locales
```

**Criteres validation** :
- V1 (P0) : App demarre port 3002
- V2 (P0) : Middleware fonctionne
- V3 (P0) : Layout sidebar + topbar
- V4 (P0) : FAB visible
- V5 (P0) : Tests setup 5+ scenarios

---

## Tache 5.4.2 -- Pages Auth Reuse Sprint 16

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 4h / Depend de 5.4.1

**But** : Reutilise pattern auth Sprint 16 : login + MFA + signup + recovery + select-tenant.

**Livrables checkables** :
- [ ] Reuse 7 pages auth Sprint 16 (copy-paste avec adaptations garage branding)
- [ ] Endpoints API auth deja dispos Sprint 5
- [ ] Tests 5+ scenarios

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(auth)/{7 pages}.tsx                            # ~700 lignes total
repo/apps/web-garage/components/auth/{several reuse}                                # ~300 lignes
```

**Criteres validation** :
- V1 (P0) : Login + MFA flow OK
- V2 (P0) : Tests 5+ scenarios

---

## Tache 5.4.3 -- Dashboard Garage : 6 Widgets

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 6h / Depend de 5.4.2

**But** : Dashboard accueil avec widgets specifiques garage operations.

**Livrables checkables** :
- [ ] 6 widgets :
  1. **Sinistres en cours** : count per status (declared / under_repair / awaiting_approval / etc.) -- bar chart
  2. **Throughput** : sinistres traites/jour cette semaine vs precedente -- line chart
  3. **Revenue YTD** : graph mensuel + total
  4. **Customer ratings** : moyenne + count last 30 days + distribution stars
  5. **Parts low stock alert** : items < threshold (Sprint 13 Stock alerts)
  6. **Technicien charge** : workload per technicien (heures cumulees + sinistres assignes)
- [ ] Filters : date_range + technicien + service_type
- [ ] Loading + empty states
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/dashboard/page.tsx                     # ~120 lignes
repo/apps/web-garage/components/dashboard/{6 widgets}.tsx                            # ~600 lignes total
repo/apps/web-garage/lib/queries/dashboard.queries.ts                                  # TanStack
```

**Criteres validation** :
- V1 (P0) : 6 widgets render
- V2 (P0) : Filters apply
- V3 (P0) : Tests 5+ scenarios

---

## Tache 5.4.4 -- Sinistres Page : Kanban + Table

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 7h / Depend de 5.4.3

**But** : Page sinistres avec 2 vues : Kanban par status (similar deals Sprint 16) + Table.

**Livrables checkables** :
- [ ] View toggle : Kanban / Table
- [ ] Vue Kanban : 10 colonnes (10 status sinistre Sprint 19) + drag-drop transitions valides
- [ ] On drop : POST `/api/v1/repair/sinistres/:id/transition` (state machine valide Sprint 19)
- [ ] Cards : sinistre_number + customer + vehicle + technicien + dates + priority badge
- [ ] Optimistic UI : transition immediate + revert si state machine reject
- [ ] Vue Table : DataTable + filters (status, technicien, branche, date_range, priority)
- [ ] Bulk actions : assign technicien + change priority
- [ ] Search : sinistre_number + customer name + vehicle plate
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/sinistres/page.tsx                     # ~150 lignes
repo/apps/web-garage/components/sinistres/sinistres-kanban.tsx                        # ~250 lignes (drag-drop)
repo/apps/web-garage/components/sinistres/sinistres-table.tsx                          # ~200 lignes
repo/apps/web-garage/components/sinistres/sinistre-card.tsx                            # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Kanban 10 colonnes
- V2 (P0) : Drag-drop transitions
- V3 (P0) : Optimistic UI + revert
- V4 (P0) : Table filters + search
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.4.5 -- Sinistre Detail Page : Timeline + Tabs

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 8h / Depend de 5.4.4

**But** : Page detail sinistre riche avec timeline visuelle + tabs pour chaque etape workflow.

**Livrables checkables** :
- [ ] Header : sinistre_number + status big badge + customer + vehicle + dates
- [ ] **Timeline visuelle** : 10 etapes status avec dates + responsable + comments (audit history Sprint 19)
- [ ] Tabs :
  - **Info** : details complets sinistre + vehicle + customer
  - **Reception** : Tache 5.4.6 (checklist + photos + docs)
  - **Diagnostic** : Tache 5.4.7 (IA + technicien + rapport)
  - **Devis** : Tache 5.4.8 (current + history avenants)
  - **Orders** : Tache 5.4.9 (orders en cours + tracking)
  - **QC + Livraison** : Tache 5.4.10
  - **Invoices** : Tache 5.4.11
  - **Garantie** : warranty + claims
  - **Documents** : tous documents lies (PDF preview + download)
  - **Communication** : interactions historique (Sprint 8 CRM lecture)
- [ ] Action buttons contextual :
  - "Acknowledge" si status='declared'
  - "Schedule appointment" si 'acknowledged'
  - "Receive vehicle" si 'appointment_scheduled'
  - "Start diagnostic" si 'received'
  - etc.
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/page.tsx                # ~250 lignes
repo/apps/web-garage/components/sinistres/sinistre-timeline.tsx                       # ~200 lignes
repo/apps/web-garage/components/sinistres/sinistre-detail-tabs.tsx                     # ~300 lignes
repo/apps/web-garage/components/sinistres/contextual-actions.tsx                        # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Detail tabs all functional
- V2 (P0) : Timeline visuelle
- V3 (P0) : Contextual actions selon status
- V4 (P0) : Tests 10+ scenarios

---

## Tache 5.4.6 -- Reception Page

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 6h / Depend de 5.4.5

**But** : Page reception (Tab dans sinistre detail) : checklist 12 points + photos upload + 3 documents customer + signature reception.

**Livrables checkables** :
- [ ] Form react-hook-form 12 points checklist (Sprint 21 Tache 5.3.1) :
  - Carrosserie face/cote droit/cote gauche/arriere : radio (intact/rayures/bosses) + commentaire
  - Pare-brise + vitres : radio (intact/fissure)
  - Roues + pneus : 4 inputs etat individuel
  - Niveau carburant + kilometrage : numeric
  - Interieur (tableau bord/sieges/coffre) : radio + commentaire
  - Cle + papiers : checkbox confirmation
- [ ] Photos uploader : multiple photos (recommande 8-12 angles)
- [ ] Documents customer upload :
  - Carte grise (S3 multi-tenant)
  - Permis de conduire
  - Attestation assurance
- [ ] Signature pad customer : html5 canvas signature OR Barid eSign embed
- [ ] Submit : POST endpoint reception + transition sinistre
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/reception/page.tsx       # ~150 lignes
repo/apps/web-garage/components/reception/checklist-12-points.tsx                       # ~250 lignes
repo/apps/web-garage/components/reception/photos-uploader.tsx                            # ~150 lignes
repo/apps/web-garage/components/reception/signature-pad.tsx                              # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : 12 points checklist form
- V2 (P0) : Photos upload S3
- V3 (P0) : 3 docs customer upload
- V4 (P0) : Signature pad
- V5 (P0) : Tests 6+ scenarios

---

## Tache 5.4.7 -- Diagnostics Page : IA + Technicien

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 7h / Depend de 5.4.6

**But** : Page diagnostic avec **visualization IA suggestions Sprint 20** + technicien validation/edit/reject + rapport generation.

**Livrables checkables** :
- [ ] Section "IA Suggestions" :
  - Confidence score (visual gauge 0-100%)
  - Damages detected : list cards avec severity badges + photos overlay
  - Parts needed : table (name + quantity + unit_cost + total)
  - Labor estimate : hours range + total cost
  - Total estimate range (min - max)
  - Warnings : si confidence < 0.90 ou photos manquantes
- [ ] Actions :
  - **Accept all** : button -> POST apply-ia-estimation action='accept'
  - **Edit** : modify items -> POST apply action='edit' avec edits
  - **Reject** : button -> POST action='reject' + manual diagnostic
- [ ] Section "Manual Diagnostic" :
  - Form add problems manuellement
  - Form add parts needed manuellement
  - Form labor hours estimate
- [ ] Photos additionnelles upload (technicien analyse approfondie)
- [ ] Bouton "Generate Report" -> rapport technique PDF
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx       # ~200 lignes
repo/apps/web-garage/components/diagnostic/ia-suggestions-display.tsx                    # ~250 lignes
repo/apps/web-garage/components/diagnostic/manual-diagnostic-form.tsx                     # ~200 lignes
repo/apps/web-garage/components/diagnostic/confidence-gauge.tsx                            # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : IA suggestions display complete
- V2 (P0) : 3 actions (accept/edit/reject)
- V3 (P0) : Manual diagnostic alternative
- V4 (P0) : Photos additionnelles
- V5 (P0) : Report generation
- V6 (P0) : Tests 8+ scenarios

---

## Tache 5.4.8 -- Devis Page : Create + Items + Send

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 6h / Depend de 5.4.7

**But** : Page devis : creation depuis diagnostic + editor items + envoi assureur/client + tracking lecture/approbation.

**Livrables checkables** :
- [ ] Bouton "Create Devis" depuis diagnostic completed
- [ ] Auto-populate items depuis diagnostic (parts + labor)
- [ ] Items editor :
  - Table editable : description + quantity + unit_price + total
  - Type per ligne : parts / labor / misc
  - Add line button
  - Remove line button
  - Auto-compute totals (HT + TVA + TTC)
- [ ] Validity date selector (default 14 jours)
- [ ] Recipients selection :
  - Si police : insurer (default) + customer (cc)
  - Sinon : customer only
- [ ] Bouton "Send" : trigger Sprint 21 Tache 5.3.3 envoi + tracking
- [ ] Tracking visualization : sent_at + read_at (insurer + customer) + status
- [ ] Bouton "Create Avenant" si devis approved et reparation revele pieces additionnelles
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/devis/page.tsx              # ~200 lignes
repo/apps/web-garage/components/devis/devis-editor.tsx                                    # ~250 lignes
repo/apps/web-garage/components/devis/devis-tracking.tsx                                   # ~120 lignes
repo/apps/web-garage/components/devis/avenant-form.tsx                                      # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Create from diagnostic
- V2 (P0) : Items editor + auto totals
- V3 (P0) : Send + recipients
- V4 (P0) : Tracking visualization
- V5 (P0) : Avenants supported
- V6 (P0) : Tests 8+ scenarios

---

## Tache 5.4.9 -- Orders Page : Tracking + Hours + Parts

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 6h / Depend de 5.4.8

**But** : Page orders : list orders en cours + tracking real-time (% completion + parts arrival) + log hours + consume parts.

**Livrables checkables** :
- [ ] Page liste : orders en cours + filters (technicien, status, date_range)
- [ ] Page detail order :
  - Header : order number + status + assigned technicien
  - Tasks checklist : check tasks completed + % auto
  - Parts arrival status : table (part name + status: pending/ordered/arrived/used + expected_date)
  - Hours log : timer "Start work" / "Stop work" + manual entry alternative
  - Parts consumption : button "Consume part" -> select part + quantity (Stock Sprint 13)
  - Photos progress : upload photos d'avancement
  - Bouton "Mark Complete" (status -> completed)
- [ ] Real-time updates : poll 30s
- [ ] Notifications customer trigger automatic milestones (Sprint 21 Tache 5.3.5)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/orders/page.tsx                           # ~120 lignes
repo/apps/web-garage/app/[locale]/(protected)/orders/[id]/page.tsx                       # ~250 lignes
repo/apps/web-garage/components/orders/tasks-checklist.tsx                               # ~150 lignes
repo/apps/web-garage/components/orders/parts-arrival-status.tsx                            # ~150 lignes
repo/apps/web-garage/components/orders/hours-tracker.tsx                                  # ~200 lignes (timer)
repo/apps/web-garage/components/orders/parts-consumer-dialog.tsx                            # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Order detail complete
- V2 (P0) : Hours timer + manual log
- V3 (P0) : Parts consumer integration Stock
- V4 (P0) : Photos progress
- V5 (P0) : Tests 8+ scenarios

---

## Tache 5.4.10 -- QC + Delivery Page

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 5h / Depend de 5.4.9

**But** : Pages QC checklist 10 points + livraison + signature reception customer + bon livraison.

**Livrables checkables** :
- [ ] Page QC :
  - Form 10 points checklist (Sprint 21 Tache 5.3.6)
  - Photos after upload (avant/apres comparison)
  - Inspector signature
  - Bouton "Mark Passed" / "Mark Failed" (avec items)
- [ ] Page Delivery (post-QC passed) :
  - Recap : sinistre + vehicle + work executed
  - Bon livraison preview PDF
  - Signature customer (pad OR Barid eSign)
  - Customer satisfaction rating (5 stars + feedback textarea optional)
  - Bouton "Confirm Delivery" -> transition 'delivered' + send confirmation customer
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/qc/page.tsx                 # ~150 lignes
repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/delivery/page.tsx           # ~150 lignes
repo/apps/web-garage/components/qc/checklist-10-points.tsx                                # ~200 lignes
repo/apps/web-garage/components/delivery/delivery-confirmation.tsx                          # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : QC 10 points + photos + signature
- V2 (P0) : Pass/Fail workflow
- V3 (P0) : Delivery + signature customer
- V4 (P0) : Satisfaction rating
- V5 (P0) : Tests 6+ scenarios

---

## Tache 5.4.11 -- Invoices Page : Split Preview + Download

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 5h / Depend de 5.4.10

**But** : Page invoices : list factures (split insurer + customer) + preview avant generation + PDF download + tracking paiement.

**Livrables checkables** :
- [ ] Page list invoices : DataTable filtres status + recipient_type
- [ ] **Preview split avant generation** (UX critique) :
  - Show breakdown : total_ttc + franchise + exclusions + coverage_cap
  - Compute insurer_amount + customer_amount
  - Visual : 2 cards previewing futures factures
  - Bouton "Generate Invoices" -> trigger backend split logic Sprint 21
- [ ] Page detail invoice :
  - Recipient info + items + totals
  - PDF preview (`react-pdf`)
  - Download PDF
  - Status badge + bouton "Send Email" (re-envoi)
  - Mark paid (manual entry pour assureurs virement)
  - History tracking lecture/payment
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/sinistres/[id]/invoices/page.tsx           # ~200 lignes
repo/apps/web-garage/components/invoices/split-preview.tsx                                # ~200 lignes
repo/apps/web-garage/components/invoices/invoice-detail.tsx                                # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Split preview avant generation
- V2 (P0) : Generate produit 2 factures
- V3 (P0) : PDF preview + download
- V4 (P0) : Mark paid manual
- V5 (P0) : Tests 6+ scenarios

---

## Tache 5.4.12 -- Parametres + 4 Roles RBAC + I18n

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 4h / Depend de 5.4.11

**But** : Pages parametres garage + RBAC UI 4 roles + i18n complete.

**Livrables checkables** :
- [ ] Page parametres (garage_admin only) :
  - Garage info : nom + adresse + horaires + specialties + capacity
  - Services + tarifs (8 services types Sprint 19)
  - Users + roles (4 roles)
  - QC checklist customization (advanced)
- [ ] RBAC UI Sprint 16 pattern reutilise :
  - `garage_admin` : tout + parametres
  - `garage_chef` : assign technicien + approuver devis + manage QC
  - `garage_technicien` : reception + diagnostic + orders (assignes lui)
  - `garage_gestionnaire` : invoices + reports + customer relations
- [ ] I18n fr/ar-MA/ar messages complets (~600 keys)
- [ ] RTL CSS
- [ ] Locale switcher
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-garage/app/[locale]/(protected)/parametres/page.tsx                        # ~150 lignes
repo/apps/web-garage/components/auth/has-role-garage.tsx                                  # ~50 lignes
repo/apps/web-garage/messages/{fr,ar-MA,ar}.json                                          # 600+ keys
```

**Criteres validation** :
- V1 (P0) : Parametres garage_admin only
- V2 (P0) : 4 roles UI conditional
- V3 (P0) : I18n 3 locales
- V4 (P0) : RTL fonctionne
- V5 (P0) : Tests 6+ scenarios

---

## Tache 5.4.13 -- Tests Playwright + WCAG + Lighthouse

**Metadonnees** : Phase 5 / Sprint 22 / P0 / 8h / Depend de 5.4.12

**But** : Suite tests Playwright E2E + accessibility WCAG 2.1 AA + Lighthouse audits.

**Livrables checkables** :

**Tests E2E (20+)** :
- [ ] Auth login + MFA (3)
- [ ] Dashboard widgets (2)
- [ ] Sinistres Kanban + Table + transitions (4)
- [ ] Sinistre detail tabs (3)
- [ ] Reception checklist + photos + signature (2)
- [ ] Diagnostic IA + technicien validation (2)
- [ ] Devis editor + send (2)
- [ ] Orders tracking + hours + parts (2)
- [ ] QC + Delivery (2)
- [ ] Invoices split preview (1)

**WCAG 2.1 AA + Lighthouse** :
- [ ] axe-core integrated
- [ ] Performance > 90
- [ ] Accessibility > 90
- [ ] SEO > 80 (internal app)
- [ ] Best Practices > 95

**Fichiers crees / modifies** :
```
repo/apps/web-garage/e2e/{20+ specs}.spec.ts
repo/apps/web-garage/playwright.config.ts
```

**Criteres validation** :
- V1 (P0) : 20+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Accessibility WCAG 2.1 AA
- V4 (P0) : Lighthouse perf 90+
- V5 (P0) : Reproducibility 5x

---

## Sortie du Sprint 22

A la fin de l'execution des 13 taches :

```
Web Garage App operational :
  - Next.js 15 web-garage (port 3002)
  - 12 pages : auth + dashboard + sinistres + receptions + diagnostics + devis + orders + qc + livraisons + invoices + parametres
  - Sinistres Kanban 10 colonnes drag-drop transitions
  - Sinistre detail timeline + 9 tabs riche
  - Reception checklist 12 points + photos + signature
  - Diagnostic IA visualization + workflow validation
  - Devis editor + tracking
  - Orders tracking real-time + hours timer + parts consumer
  - QC checklist 10 points + delivery + signature customer
  - Invoices split preview + PDF
  - 4 roles garage RBAC UI
  - I18n fr/ar-MA/ar + RTL
  - 20+ tests Playwright E2E + WCAG 2.1 AA + Lighthouse perf 90+
```

**Sprint 23 (Web Garage Mobile PWA technicien) demarre avec** :
- Backend Repair complet
- Pattern Next.js 15 + PWA reutilise Sprint 18
- Focus mobile-first technicien : reception camera + diagnostic photos + log hours timer rapide

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-5.4.X-*.md` dans `00-pilotage/prompts-taches/sprint-22-web-garage-app/`.

**Patterns code inline conserves** : pattern Next.js 15 reutilise Sprint 16. Sinistres Kanban drag-drop transitions valides via state machine.

**Reference** : Sprint 16 web-broker pattern Next.js 15 + Sprints 19-21 endpoints backend.

---

**Fin du meta-prompt B-22 v2.2 format Option B.**
