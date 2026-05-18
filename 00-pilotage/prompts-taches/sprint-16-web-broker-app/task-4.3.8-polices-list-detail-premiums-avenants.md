# TACHE 4.3.8 -- Polices Page : List + Detail (Timeline + Premiums + Avenants + Renouvellements + Operations)

**Sprint** : 16 (Phase 4 / Sprint 3 dans phase, Web Broker App)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.8)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0
**Effort** : 7h
**Dependances** : task-4.3.7 (Deals Kanban -- pattern DataTable + dialogs + optimistic UI reutilise + bouton Generate Quote depuis deal won), task-4.3.6 (Companies autocomplete pour souscripteur entreprise), task-4.3.5 (Contacts autocomplete pour souscripteur particulier + beneficiaires), task-4.3.3 (Layout principal sidebar/topbar), Sprint 14 (Insure API endpoints policies + premiums + branches + assureurs partenaires), Sprint 15 (Insure Lifecycle services : cancel + suspend + transfer + avenant + renewal + BrokerValidationQueue + ProvisionalPolicy), Sprint 10 (Docs service : signature ANRT TSA loi 43-20 + audit trail), Sprint 11 (Pay service : initier paiement echeance), Sprint 5 (Auth JWT), Sprint 6 (Tenant context x-tenant-id), Sprint 7 (RBAC permissions insure.policies.*), Sprint 4 (Design tokens Sofidemy + shadcn/ui DataTable + Tabs + Dialog + Sheet), Sprint 1 (Monorepo pnpm)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Construire la page **Polices** (contrats d'assurance) de l'application `web-broker` (port 3001) avec une vue liste DataTable shadcn/ui filtree multi-critere (status / branche / souscripteur / expiring_soon / expired / assureur partenaire), une pagination cursor performante, un bouton "Generate Quote" qui redirige vers le quote-builder Sprint 17 alimente avec le souscripteur deal won, et une page detail riche multi-onglets (Info / Premiums echeancier / Avenants history / Renouvellements proposals / Documents signes ANRT TSA / Operations audit trail). Cette page est l'ecran central du metier courtier : c'est ici que se trouve la totalite des contrats actifs (active), suspendus (suspended), brouillons (draft), resilies (cancelled), expires (expired) du portefeuille, avec les actions lifecycle conformes Loi 17-99 code des assurances MA (resiliation avec pro-rata refund, suspension temporaire, transfert beneficiaire, avenant modification garanties, proposition renouvellement 60j avant echeance).

L'objectif precis est de livrer (1) une liste DataTable performante avec 8 colonnes triables (policy_number / souscripteur / branche / start_date / end_date / status / prime_annuelle MAD / commission_broker MAD), filters URL-state via nuqs incluant un filtre derive "expiring_soon" (<60j avant end_date selon Africa/Casablanca timezone), un filtre "expired" (end_date < today), un filtre souscripteur autocomplete reutilisant contacts/companies Sprint 8, et un export CSV bulk via Sprint 13 Analytics ; (2) une page detail multi-onglets avec un header card affichant policy_number + status badge couleur (active=green, draft=gray, suspended=orange, cancelled=red, expired=dark gray) + souscripteur link cliquable + branche icon + assureur partenaire logo + prime_annuelle MAD formattee + commission_broker MAD, suivi de 6 tabs orchestres : (a) Info avec details garanties souscrites + exclusions clauses + franchise + plafond + beneficiaires liste, (b) Premiums avec echeancier complet (mensuel/trimestriel/annuel) + status paiements (paid green / pending yellow / overdue red avec days_overdue) + bouton "Initier paiement" liant au flow Sprint 11, (c) Avenants avec history chronologique des modifications + bouton "Nouvel avenant" ouvrant un dialog form, (d) Renouvellements avec current renewal status + bouton "Proposer renouvellement" disponible J-60 avant echeance, (e) Documents avec liste PDFs police + attestations + signature audit trail Loi 43-20 ANRT TSA, (f) Operations avec audit complet transferts beneficiaire + suspensions + resiliations + timeline events ; (3) 5 dialogs specialises pour les actions lifecycle : CancelPolicyDialog avec preview pro-rata refund calcule loi 17-99 article 23 + signature ANRT TSA obligatoire, SuspendPolicyDialog avec date_start + date_end + impact paiements suspendus, TransferPolicyDialog avec contact selector cross-tenant interdit, NewAvenantDialog avec type avenant (extension garanties / reduction / changement adresse risque / changement vehicule) + adjustment prime + effective_date, ProposeRenewalDialog avec adjusted_prime + new_dates + send proposal email.

A la sortie de cette tache, l'utilisateur broker_admin/broker_user accede a `/fr/polices` (RTL `/ar-MA/polices` `/ar/polices` adapte), voit la liste paginee filtrable de toutes les polices de son tenant, peut cliquer une ligne pour ouvrir `/fr/polices/[id]` avec les 6 onglets fonctionnels, peut declencher chaque action lifecycle avec validation Zod + idempotency + signature ANRT TSA pour les actions critiques (cancel/transfer), et peut suivre toute l'historique d'audit conforme ACAPS et Loi 09-08 CNDP. Cette tache bloque 4.3.9 (Broker Validation Queue) qui consomme la ProvisionalPolicy generee depuis broker queue validate puis remplacee par la police definitive listee ici, et bloque indirectement 4.3.10 (Sinistres read-only) qui lie chaque sinistre a une police visible ici.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

La police d'assurance est l'**actif central** du business courtier : sans police, pas de commission, pas de service client, pas de reporting ACAPS. La page polices doit etre la plus solide de l'app web-broker -- bugs = perte de chiffre d'affaires immediate (cancel mal calcule = sur-refund = perte sur commission ; transfer rate = client perdu chez concurrent). Cette page concentre **5 services backend lifecycle Sprint 15** : CancelPolicyService, SuspendPolicyService, TransferPolicyService, AvenantService, RenewalProposalService -- chacun avec ses regles metier (pro-rata loi 17-99, signature loi 43-20, audit Loi 09-08, reporting ACAPS).

Le portefeuille moyen d'un cabinet courtier marocain cible Skalean est de 800-3000 polices actives reparties sur 7 branches assurance (auto 45%, sante 18%, habitation 12%, vie 8%, RC pro 7%, RC entreprise 6%, multirisque 4%) avec des cycles de vie etales sur 12 mois roulants. Le filtre "expiring_soon" (<60j) est l'outil tactique critique : un courtier consulte cette liste chaque lundi matin pour planifier ses appels de renouvellement de la semaine -- s'il rate la fenetre J-60, le client peut souscrire ailleurs (au Maroc, la concurrence est rude : Wafa Assurance, AXA, Atlanta Sanad, Sanlam Maroc, RMA Watanya, Saham Assurance, Allianz Maroc, Marocaine Vie sollicitent activement). Le filtre "expired" est l'outil de recuperation : polices expirees recentes (<30j) representent souvent des renouvellements oublies recuperables par appel commercial.

La page detail multi-onglets reflete la **structure metier d'une police** : un contrat (Info) qui produit des echeances de paiement (Premiums), qui peut etre modifie par avenants (Avenants), qui doit etre renouvele a echeance (Renouvellements), qui produit des documents signes (Documents) et qui peut subir des operations exceptionnelles (Operations : transferts, suspensions, resiliations). Cette structure 6-tabs n'est pas decorative -- elle correspond aux **6 aggregates DDD** du domaine Insure Sprint 14/15 : Policy / Premium / Avenant / Renewal / PolicyDocument / PolicyOperation.

Les **actions lifecycle** (cancel/suspend/transfer/avenant/renewal) sont les plus sensibles : chacune declenche des effets de bord backend (notification assureur partenaire, calcul refund, lock periodes paiement, generation document signe ANRT TSA, audit trail Loi 09-08, declaration ACAPS mensuelle). Les dialogs frontend doivent etre **dissuasifs sans etre bloquants** : preview clair des consequences (montants, dates, signature obligatoire), confirmation explicite ("Tapez RESILIER pour confirmer"), et signature electronique ANRT TSA pour cancel + transfer (Loi 43-20 article 6 -- signature electronique avancee qualifiee requise pour modifications contractuelles).

### Alternatives considerees

#### DataTable library : @tanstack/react-table vs ag-grid vs react-data-grid

| Critere | @tanstack/react-table 8.20.x (CHOIX) | ag-grid Community 33.x (rejete) | react-data-grid 7.x (rejete) |
|---------|--------------------------------------|-----------------------------------|------------------------------|
| Bundle size | ~14 ko gzipped (headless) | ~250 ko gzipped (full) | ~80 ko gzipped |
| Headless / unstyled | Oui (full controle CSS via shadcn) | Non (styles ag-theme imposes) | Partiellement |
| TypeScript | First-class avec generics ColumnDef | Oui mais complexe | Oui |
| Server-side pagination cursor | Native via `manualPagination` | Native via DataSource enterprise | Manual |
| Multi-column sort | Native | Native | Manual |
| Column filters | Native + custom filters | Native | Native |
| Column resize / reorder / pin | Hook `useTableHandle` | Native UI | Native UI |
| Row selection bulk | Native | Native | Native |
| Virtualization | Compat TanStack Virtual | Native | Native |
| Licence | MIT (gratuit prod) | MIT Community + paid Enterprise ($999/dev/an) | MIT |
| Pattern shadcn align | Oui (template shadcn DataTable) | Non (theme propre) | Possible mais hors-pattern |
| Sprint 16 utilise deja | Oui (Sprints 4.3.5/4.3.6/4.3.7) | Non | Non |

**Decision** : `@tanstack/react-table` 8.20.6 + `@tanstack/react-query` 5.62 pour data fetching. Headless permet customisation totale via shadcn DataTable template. Bundle leger critique vu que web-broker integrera 8+ DataTables differentes (contacts, companies, deals, polices, queue, sinistres, transactions, users). ag-grid Enterprise serait surdimentionne (et payant). Alignement avec convention Skalean Sprints 4.3.5/4.3.6/4.3.7.

#### Tabs orchestration : shadcn Tabs vs Radix Tabs primitives vs Next.js parallel routes

| Critere | shadcn Tabs (Radix wrap) (CHOIX) | Radix Tabs primitives raw (rejete) | Next.js parallel routes @info @premiums... (rejete) |
|---------|-----------------------------------|-------------------------------------|-----------------------------------------------------|
| Style align Sofidemy | Oui (preset shadcn customise Sprint 4) | Manual styling necessaire | Manual |
| URL state per tab | Manual via nuqs `?tab=premiums` | Manual | Native via parallel routes |
| Server Component compat | Oui (children RSC ok) | Oui | Native parallel slots |
| Bundle | ~2 ko (Radix Tabs primitives) | Identique | 0 (server-side) |
| Conditional render lazy | Possible via React.lazy + Suspense | Identique | Native via @slot fallback |
| Reuse code Sprint 4.3.5/6/7 detail tabs | Oui (meme pattern) | Recreate | Different paradigm |
| Switch animation | Builtin shadcn smooth | Manual | Native page transition |
| Mobile UX | Scroll horizontal native | Manual | Different |

**Decision** : shadcn Tabs (Radix wrapped) avec URL state nuqs `?tab=info|premiums|avenants|renouvellements|documents|operations`. Lazy load tabs lourds (Premiums tab charge echeancier + Pay status, Operations tab charge audit complet) via `React.lazy` + `Suspense fallback={<Skeleton />}`. Alignement Sprint 4.3.5 contact detail tabs.

#### Pro-rata refund calculation : frontend client-side vs backend authoritative + preview

| Critere | Backend authoritative + preview endpoint (CHOIX) | Frontend client-side calc (rejete) | Both (frontend preview + backend reconcile) (rejete) |
|---------|---------------------------------------------------|-------------------------------------|-------------------------------------------------------|
| Source of truth | Backend (legal compliance loi 17-99) | Frontend (risque divergence) | Hybrid (complexe + bugs) |
| Loi 17-99 art 23 alignment | Calcule via service Sprint 15 CancelPolicyService.previewRefund() | Risque si formule change | Risque sync |
| UX preview rapidite | ~150-300ms API call | <16ms instant | <16ms |
| Force majeure detection | Backend connait policy state complet | Frontend doit recevoir tout state | Hybrid |
| Audit trail | Une seule source | Two sources to log | Hybrid |
| Code duplication | Aucune | Duplique frontend + backend | Duplique |
| Testing | Backend unit tests + frontend mock | Frontend tests + backend tests | Triple tests |

**Decision** : Backend authoritative via `POST /api/v1/insure/policies/:id/cancel/preview` -- frontend appelle preview en ouverture dialog + a chaque changement reason (force majeure detect change refund 100%). Loading skeleton pendant ~200ms acceptable car action critique non-instantanee. Frontend a SEULEMENT un helper `pro-rata-calculator.ts` (~80 lignes) pour debugging / display visualization, **jamais** comme source de truth.

#### Signature ANRT TSA Loi 43-20 : iframe TSA externe vs SDK natif vs upload signature image

| Critere | SDK natif `@anrt/tsa-sdk` (CHOIX) | Iframe TSA externe (rejete) | Upload signature image manuscrite (rejete) |
|---------|------------------------------------|------------------------------|---------------------------------------------|
| Loi 43-20 compliance | Article 6 conforme (signature avancee qualifiee) | Article 6 conforme | Article 5 simple (insuffisant pour resiliation) |
| ANRT certification | Native | Native | Non certifie |
| UX in-page | Oui (modal in-app) | Non (popup externe) | Oui mais non conforme |
| TSA token persisted | Sprint 10 service Docs | Sprint 10 | N/A |
| Mobile compat | Oui (signature pad tactile) | Difficile (popup mobile broken) | Manual |
| Test mockability | Mock SDK | Hard mock iframe | Easy |
| Sprint 10 livre | Oui (DocsService.signWithANRT) | Oui (alternative) | Non |
| Bundle SDK | ~25 ko gzipped | 0 | 0 |

**Decision** : SDK natif `@anrt/tsa-sdk` 2.1.x via Sprint 10 DocsService wrapper. Frontend appelle `POST /api/v1/docs/sign` qui retourne `signature_token` puis `POST /api/v1/insure/policies/:id/cancel` avec header `X-Signature-Token`. Sprint 10 a livre l'integration backend, web-broker consume via API proxy Next.js routes `/api/docs/sign`.

#### Date timezone handling : date-fns-tz vs Luxon vs dayjs

| Critere | date-fns 4.1 + date-fns-tz 4.1 (CHOIX) | Luxon 3.5.x (rejete) | dayjs 1.11.x + plugins (rejete) |
|---------|----------------------------------------|----------------------|----------------------------------|
| Bundle size | ~13 ko gzipped (tree-shake) | ~21 ko gzipped | ~7 ko gzipped + plugins ~12 ko |
| Africa/Casablanca TZ | Native | Native | Plugin timezone require |
| date-fns API style | Functional pure (composable) | OO (class-based) | OO chain |
| Locale fr + ar | Native | Native | Plugin |
| Hijri calendar | Plugin `date-fns-hijri` Sprint 22 | Native partial | Plugin |
| TypeScript | First-class | First-class | First-class |
| Sprint 4 deja choix | Oui (date-fns 4.1) | Non | Non |
| Next.js 15 SSR compat | Oui | Oui | Oui |

**Decision** : `date-fns` 4.1.0 + `date-fns-tz` 4.1.0 (deja livre Sprint 4). Toutes les dates polices stockees UTC ISO 8601 backend, affichees Africa/Casablanca via `formatInTimeZone(date, 'Africa/Casablanca', 'PPP', { locale: fr })`. Critique pour end_date police (echeance precise minuit Casablanca, pas UTC midnight).

#### Echeancier display : table vs timeline vs gantt chart

| Critere | Table shadcn + status badges (CHOIX) | Timeline horizontal (rejete) | Gantt chart recharts (rejete) |
|---------|--------------------------------------|------------------------------|--------------------------------|
| Lisibilite annuel 12 echeances | Excellent | Bon mais compact | Pauvre (overdense) |
| Mobile responsive | Scroll horizontal | Difficile | Tres difficile |
| Action "Initier paiement" inline | Easy (button cell) | Difficile | Tres difficile |
| Status filtering | Easy column filter | Manual | Tres difficile |
| Bundle size | 0 (reuse DataTable) | recharts ~85 ko | recharts ~85 ko |
| Print-friendly | Excellent (Sprint 4 print.css) | Mauvais | Mauvais |
| Accessibility | Native table semantics + ARIA | Manual ARIA | Tres difficile |

**Decision** : Table shadcn dans Premiums tab avec colonnes (due_date / amount_due MAD / payment_method / status / paid_date / actions). Recharts optionnel pour cumul paye/du en graphique area chart en HEADER du tab (visualization summary 12 mois). Print-friendly critique pour rapports comptables courtier (envoi mensuel comite).

### Trade-offs explicites

1. **Pagination cursor vs offset** : cursor pagination via `?after=cursor_token` choisie (alignement Sprint 14 API). Avantage : performance constante O(1) meme 10k+ polices. Inconvenient : pas de jump page direct (`?page=42`). Mitigation : "Page suivante / Page precedente" + "Jump to first / last" boutons. Si grand portefeuille (>5000 polices), filter aggressif > pagination.

2. **Lazy load tabs** : seul `Info` tab eagerly loaded, autres tabs (Premiums / Avenants / Renouvellements / Documents / Operations) charges au click via `React.lazy` + `Suspense`. Avantage : Time-to-interactive page detail ~600ms. Inconvenient : flash skeleton premier click. Mitigation : prefetch tabs au hover si tab non-active.

3. **Pro-rata preview API call** : ouverture CancelPolicyDialog declenche `POST /preview` (200-400ms). Bloque submit jusqu'a preview recu. Inconvenient : delay perceptible. Mitigation : skeleton + "Calcul du remboursement en cours..." + cache preview key=[policyId, reason] pour eviter re-fetch si user reopen meme dialog.

4. **Signature ANRT TSA blocking** : actions cancel + transfer requierent signature electronique avant submit. UX : modal overlay signature pad pendant 30-60 secondes (user dessine signature tactile + confirme code OTP envoye SMS). Mitigation : sauvegarde brouillon dialog state localStorage si user abandonne signature, recuperation au reopen.

5. **Force majeure detection** : reason dropdown inclut "Force majeure -- catastrophe naturelle / deces souscripteur / fraude assureur" qui declenche refund 100% (vs pro-rata standard). UX : preview API renvoie `refund_type: 'force_majeure'` + montant 100% + warning visuel "Remboursement integral garanti par la loi 17-99 article 24". Inconvenient : risque abuse user check force majeure pour grossir refund. Mitigation : backend valide preuve documentaire (Sprint 15 service requires document_id upload).

6. **Avenant retroactive date < today** : NewAvenantDialog accepte `effective_date < today` (avenant retroactif legitime ex: declaration tardive sinistre justifiant extension garanties retroactive). UX : warning visuel "Avenant retroactif -- impact comptable" + champ commentaire obligatoire. Backend Sprint 15 valide regle metier (max 90j retroactivite admise).

7. **Transfer cross-tenant interdit** : TransferPolicyDialog contact selector filtre seulement contacts du tenant courant. Cross-tenant transfer (changement cabinet courtier) est un workflow distinct (Sprint 17 cession portefeuille) hors scope cette tache. Frontend affiche message clair "Pour transferer la police a un autre cabinet, contactez le support Skalean".

8. **Renouvellement proposal expiration 60j** : ProposeRenewalDialog disponible UNIQUEMENT entre J-60 et J+30 apres echeance (window 90j). Au-dela J+30 expire = nouvelle souscription requise (nouveau quote-builder Sprint 17). UX : bouton "Proposer renouvellement" disabled hors window avec tooltip explication.

9. **Status auto-update expired** : police end_date < today doit etre status='expired' automatiquement. Logic backend Sprint 14 (cron daily Africa/Casablanca timezone 00:01) NOT frontend. Frontend affiche le status DB tel quel. Si end_date passe mais status='active' (cron pas tourne ou bug), frontend affiche status='active' + warning visuel "Echeance depassee -- mise a jour status en cours". Mitigation refresh force via `invalidateQueries`.

10. **Currency MAD format Intl.NumberFormat** : tout montant affiche via `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2 })`. Outputs : `12 500,00 MAD` (fr-MA) / `12,500.00 د.م.` (ar-MA Darija) / `12,500.00 درهم مغربي` (ar classique). Conventions banque centrale MA Bank Al-Maghrib BAM 2 decimales. Pas de fractions inferieures 0.01 MAD.

11. **Africa/Casablanca timezone strict** : toutes dates contractuelles (start_date, end_date, due_date premiums, effective_date avenants) interpretees Africa/Casablanca timezone. Risque : un broker en deplacement Paris (Europe/Paris) voit dates locales decalees -1h sans formatInTimeZone. Mitigation : tous date formatters forcent `Africa/Casablanca` explicite, jamais `toLocaleString` natif.

12. **Idempotency-Key sur mutations** : toutes mutations POST (cancel/suspend/transfer/avenant/renewal) injectent `Idempotency-Key: ${crypto.randomUUID()}` via Axios interceptor (Sprint 4 livre). Permet retry safe si network failure mid-request. TanStack Query retry 3x avec backoff exponentiel utilise meme key durant retry.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : `repo/apps/web-broker/components/polices/...` reside dans monorepo root. Reutilise `@insurtech/shared-ui` (DataTable template Sprint 4.3.5 base).
- **decision-005 (Skalean AI frontier)** : pas d'IA cette tache. Sprint 26+ ajoutera prediction renouvellement (modele churn) + suggestion avenant garanties.
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucun fichier code, JSON messages, UI labels, README. Status badges utilisent texte + couleur + icon Lucide (CheckCircle / AlertCircle / XCircle / Clock / Ban), JAMAIS emoji.
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : documents PDFs polices stockes Atlas Cloud S3 (`s3.bgr.atlascloudservices.ma`), JAMAIS AWS. PDF viewer integre via iframe URL Atlas signe Sprint 10.
- **decision-009 (multilinguisme MA)** : 3 locales fr / ar-MA / ar -- tous labels traduits dans `messages/{locale}.json` Section `polices.*` (~120 cles).
- **decision-010 (Skalean Broker ERP suite cliente)** : page polices est la VITRINE du produit -- toute regression frontend = perte deal client. Priorite P0 absolue testing E2E.

### Pieges techniques connus (12 minimum)

1. **Status badge couleur RTL flip** : status badges en flexbox utilisent `gap-2` + `flex-row` -- en RTL `ar-MA/ar`, l'ordre icon+label doit flip naturellement via `dir="rtl"` sur parent (pas `flex-row-reverse` hardcode qui casse fr). Solution : utiliser `gap-2` + `flex-row` simples, browser RTL flip natif.

2. **Pro-rata refund preview stale** : si user change reason dans CancelPolicyDialog rapidement (force_majeure -> non_paiement -> force_majeure), 3 preview API calls in-flight. Race condition : la derniere reponse recue n'est pas la derniere demandee. Solution : `useMutation` avec `mutationKey: ['preview-refund', policyId, reason]` + `AbortController.signal` -- annule requetes obsoletes automatiquement.

3. **Signature ANRT TSA expiry token** : signature_token retourne par `/api/v1/docs/sign` expire apres 15 minutes (Loi 43-20 article 8 -- horodatage strict). Si user signe puis abandonne dialog cancel 16 minutes, submit cancel rejette `signature_expired`. Solution : compteur visible "Signature valide 15:00" + auto-refresh signature si user revient dialog apres 10min.

4. **TanStack Query cache invalidation tab switching** : apres cancel police, Operations tab cache stale (audit trail nouveau evenement non visible). Si user switche tab apres cancel, voit donnees obsoletes. Solution : `queryClient.invalidateQueries({ queryKey: ['policy', policyId] })` apres succes cancel -- invalide TOUTES sub-queries (info, premiums, avenants, operations, etc.).

5. **Echeancier overdue display rouge clignotant inaccessible** : badge "overdue" en rouge clignotant (`animate-pulse`) inaccessible WCAG 2.1 (motion sickness). Solution : badge rouge statique + texte "En retard {days_overdue}j" + icon `AlertCircle` sans animation. Animation reserved seul pour spinner loading.

6. **Date end_date displayed vs DB stored timezone confusion** : end_date stocke `2026-12-31T23:59:59Z` UTC = `2027-01-01 00:59:59 Africa/Casablanca` (+1h hiver) ou `2027-01-01 01:59:59` (+2h ete avec DST). Pour user marocain, "echeance 31 dec 2026" attendu pas "1 jan 2027". Solution : end_date stocke comme `2026-12-31 23:59:59 Africa/Casablanca` interprete (backend Sprint 14 convention) -- frontend display via `formatInTimeZone(date, 'Africa/Casablanca', 'PPP')` direct.

7. **Tabs URL param conflict pagination** : `?tab=premiums&page=3` sur premiums echeancier table, puis user clique "Avenants" tab -> URL devient `?tab=avenants&page=3` mais avenants tab a aussi pagination. Solution : nuqs key namespacing `?tab=premiums&prm_page=3&avn_page=1` (prefix per tab) OR reset pagination on tab change via `router.replace`.

8. **Suspend date overlap validation** : SuspendPolicyDialog date_start + date_end doivent (a) date_start >= today, (b) date_end > date_start, (c) date_start < end_date police, (d) pas d'overlap avec autre suspension existante. Validation Zod refine + backend Sprint 15 valide aussi. Frontend display erreurs claires : "Suspension chevauche periode 15/03 - 30/03 existante".

9. **Transfer beneficiaire same tenant verification** : autocomplete contact selector dans TransferPolicyDialog charge contacts via `GET /api/v1/crm/contacts?search=...` -- tenant header `x-tenant-id` injecte auto par Axios interceptor Sprint 4. Risque : cas edge ou response contient contact d'autre tenant (bug backend Sprint 6). Solution : frontend revalide `contact.tenant_id === currentTenantId` cote client avant submit.

10. **Avenant prime adjustment calc** : NewAvenantDialog champ `prime_adjustment` (positive ou negative). User saisit "+500 MAD/an" -> nouveau prime_annuelle = ancien + 500. Backend Sprint 15 valide regle metier (max +/- 50% prime initiale). Frontend preview live : "Nouvelle prime : X MAD -> Y MAD (+5.2%)". Pas de submit si > 50%.

11. **Renouvellement proposal email send** : ProposeRenewalDialog declenche `POST /api/v1/insure/policies/:id/propose-renewal` qui envoie email automatique au souscripteur (Sprint 9 Comm service). UX : confirmation "Email envoye a {email}" + tracking_link visible pour suivre lecture. Si email bounce, notification toast 24h plus tard via WebSocket Sprint 26.

12. **Force majeure preuve documentaire required** : CancelPolicyDialog reason=force_majeure requiert upload document preuve (certificat deces, acte notarie catastrophe, etc.). Sans document, backend Sprint 15 rejette 400. Frontend valide presence document avant submit + upload via `POST /api/v1/docs/upload` (Sprint 10) puis pass `document_id` au cancel payload.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16

`task-4.3.8` est la **huitieme des 14 taches** du Sprint 16 et depend de la stack progressive :

```
Sprint 16 -- Web Broker App (14 taches)

[4.3.1] App skeleton + middleware + i18n
   |
[4.3.2] Auth pages
   |
[4.3.3] Layout sidebar + topbar
   |
[4.3.4] Dashboard 6 widgets
   |
[4.3.5] Contacts CRUD + detail timeline       <-- pattern DataTable + filters + detail-tabs
   |
[4.3.6] Companies CRUD                         <-- reuse pattern 4.3.5
   |
[4.3.7] Deals Kanban + Table                   <-- reuse pattern + ajoute drag-drop
   |
[4.3.8] POLICES list + detail multi-tabs       <-- CETTE TACHE, reuse pattern + ajoute lifecycle dialogs
   |
[4.3.9] Broker Queue validate/reject           <-- consume policies created from queue
   |
[4.3.10] Sinistres read-only                   <-- link policies vues ici
   |
[4.3.11-14] Parametres + Profile + RBAC + I18n + Tests E2E
```

### Position dans le programme

- **Sprint 14** (Insure Core) livre les endpoints `/api/v1/insure/policies/*` consumes ici (CRUD policies, branches, assureurs partenaires, premiums echeancier).
- **Sprint 15** (Insure Lifecycle) livre les services lifecycle (CancelPolicyService, SuspendPolicyService, TransferPolicyService, AvenantService, RenewalProposalService, BrokerValidationQueueService, ProvisionalPolicyService) consumes via API endpoints `/api/v1/insure/policies/:id/{cancel,suspend,transfer,avenants,renouvellements}`.
- **Sprint 10** (Docs) livre la signature ANRT TSA via `POST /api/v1/docs/sign` + signature audit trail.
- **Sprint 11** (Pay) livre l'initier paiement echeance via `POST /api/v1/pay/initiate` link depuis Premiums tab.
- **Sprint 17** (Web Customer Portal) reutilisera : pattern detail-tabs pour assure self-service view (subset read-only) + invoque les memes endpoints insure depuis app cliente.

### Diagramme ASCII de l'app polices

```
repo/apps/web-broker/
|
|-- src/app/[locale]/(protected)/
|   |-- polices/
|   |   |-- page.tsx                          # Server Component initial fetch -- L1
|   |   |-- [id]/
|   |   |   |-- page.tsx                      # Server Component detail -- L2
|   |   |   |-- error.tsx                     # error boundary policy detail
|   |   |   |-- loading.tsx                   # Suspense fallback
|
|-- src/components/polices/
|   |-- polices-table.tsx                     # DataTable TanStack -- L3 (~250 lignes)
|   |-- polices-filters.tsx                   # nuqs filters bar -- L4 (~200 lignes)
|   |-- policy-header-card.tsx                # detail header -- L5 (~150 lignes)
|   |-- policy-detail-tabs.tsx                # tabs orchestrator -- L6 (~200 lignes)
|   |-- tabs/
|   |   |-- policy-info-tab.tsx               # Info tab -- L7 (~180 lignes)
|   |   |-- policy-premiums-tab.tsx           # Premiums echeancier -- L8 (~200 lignes)
|   |   |-- policy-avenants-tab.tsx           # Avenants history -- L9 (~180 lignes)
|   |   |-- policy-renouvellements-tab.tsx    # Renewals proposals -- L10 (~180 lignes)
|   |   |-- policy-documents-tab.tsx          # Documents signed -- L11 (~150 lignes)
|   |   |-- policy-operations-tab.tsx         # Audit trail -- L12 (~150 lignes)
|   |-- dialogs/
|   |   |-- cancel-policy-dialog.tsx          # Cancel + pro-rata + signature -- L13 (~220 lignes)
|   |   |-- suspend-policy-dialog.tsx         # Suspend date range -- L14 (~180 lignes)
|   |   |-- transfer-policy-dialog.tsx        # Transfer beneficiary -- L15 (~200 lignes)
|   |   |-- new-avenant-dialog.tsx            # New avenant form -- L16 (~250 lignes)
|   |   |-- propose-renewal-dialog.tsx        # Propose renewal -- L17 (~200 lignes)
|
|-- src/lib/queries/
|   |-- polices.queries.ts                    # TanStack Query hooks -- L18 (~200 lignes)
|
|-- src/lib/api/
|   |-- polices.api.ts                        # Axios API wrappers -- L19 (~180 lignes)
|
|-- src/lib/schemas/
|   |-- policy.schema.ts                      # Zod schemas exhaustifs -- L20 (~250 lignes)
|
|-- src/lib/utils/
|   |-- pro-rata-calculator.ts                # Refund preview helper -- L21 (~80 lignes)
|
|-- src/lib/formatters/
|   |-- policy-formatters.ts                  # MAD, status colors, branche i18n -- L22 (~150 lignes)
|
|-- src/messages/
|   |-- fr.json                               # +120 keys polices.*
|   |-- ar-MA.json                            # +120 keys Darija
|   |-- ar.json                               # +120 keys arabe classique
|
|-- src/__tests__/polices/
|   |-- pro-rata-calculator.spec.ts           # 6 tests Vitest
|   |-- policy.schema.spec.ts                 # 5 tests Vitest
|   |-- policy-formatters.spec.ts             # 4 tests Vitest
|   |-- polices-table.spec.tsx                # 3 tests Vitest RTL
|
|-- e2e/polices/
|   |-- polices-list.spec.ts                  # 4 tests Playwright
|   |-- polices-detail.spec.ts                # 3 tests Playwright
|   |-- cancel-policy.spec.ts                 # 2 tests Playwright
|   |-- suspend-transfer.spec.ts              # 2 tests Playwright
|   |-- avenant-renewal.spec.ts               # 1 test Playwright
```

### Provider chain dans page detail policy

```
<RootLayout locale="fr">
  <ProtectedLayout> [middleware auth + tenant]
    <Sidebar /> <Topbar />
    <main>
      <Suspense fallback={<PolicyDetailSkeleton />}>
        <PolicyDetailPage params={{ id }}>
          [Server Component fetch GET /policies/:id]
          <PolicyHeaderCard policy={policy} />
          <PolicyDetailTabs policy={policy}>
            [client tabs orchestrator nuqs ?tab=...]
            <Tabs.Root value={tab}>
              <Tabs.List>...</Tabs.List>
              <Suspense fallback={<TabSkeleton />}>
                <Tabs.Content value="info">
                  <PolicyInfoTab policy={policy} />
                </Tabs.Content>
                <Tabs.Content value="premiums">
                  <PolicyPremiumsTab policyId={policy.id} />
                  [TanStack Query useQuery(['premiums', id])]
                </Tabs.Content>
                ... idem 4 autres tabs ...
              </Suspense>
            </Tabs.Root>
            <ActionButtonsBar>
              [<CancelButton onClick={openCancelDialog} />, etc.]
            </ActionButtonsBar>
            <CancelPolicyDialog open={...} policy={policy} />
            <SuspendPolicyDialog />
            ... etc 5 dialogs ...
          </PolicyDetailTabs>
        </PolicyDetailPage>
      </Suspense>
    </main>
  </ProtectedLayout>
</RootLayout>
```

---

## 4. Livrables checkables (28+ deliverables)

- [ ] **L1** : `repo/apps/web-broker/src/app/[locale]/(protected)/polices/page.tsx` (~80 lignes) -- Server Component qui fetch initial liste polices via `searchParams` parsed + cursor, render `<PolicesFilters />` + `<PolicesTable initialData={data} />`. Metadata function `generateMetadata` titre i18n "Polices -- Skalean Broker".

- [ ] **L2** : `repo/apps/web-broker/src/app/[locale]/(protected)/polices/[id]/page.tsx` (~120 lignes) -- Server Component fetch police via `params.id`, redirect 404 si introuvable, render `<PolicyHeaderCard />` + `<PolicyDetailTabs policy={...} />`. Metadata dynamique titre policy_number.

- [ ] **L3** : `repo/apps/web-broker/src/components/polices/polices-table.tsx` (~250 lignes) -- Client Component `'use client'` DataTable TanStack 8.20.x avec 8 colonnes (policy_number / souscripteur / branche / start_date / end_date / status / prime_annuelle / commission), sort multi-column, row click navigate `/polices/[id]`, row selection bulk, action menu inline (View / Cancel / Suspend), pagination cursor "Suivant / Precedent" + count total.

- [ ] **L4** : `repo/apps/web-broker/src/components/polices/polices-filters.tsx` (~200 lignes) -- Client Component nuqs URL state, filters (status MultiSelect / branche MultiSelect / souscripteur Combobox autocomplete / expiring_soon Switch / expired Switch / assureur_partenaire Select), bouton "Reset filtres", debounce 300ms, integration export CSV button.

- [ ] **L5** : `repo/apps/web-broker/src/components/polices/policy-header-card.tsx` (~150 lignes) -- Carte header detail page : policy_number h1 + status badge couleur + souscripteur link / + branche icon Lucide + assureur partenaire logo + prime_annuelle MAD + commission_broker MAD + breadcrumb (Polices > policy_number).

- [ ] **L6** : `repo/apps/web-broker/src/components/polices/policy-detail-tabs.tsx` (~200 lignes) -- Client Component orchestrator tabs nuqs URL state `?tab=info|premiums|avenants|renouvellements|documents|operations`, lazy load tabs non-Info via `React.lazy` + Suspense skeletons, ActionButtonsBar avec 5 boutons (Cancel / Suspend / Transfer / New avenant / Propose renewal) avec disabled state selon status police (cancelled/expired -> disabled tous, draft -> seul Edit + Delete).

- [ ] **L7** : `repo/apps/web-broker/src/components/polices/tabs/policy-info-tab.tsx` (~180 lignes) -- Display infos police (souscripteur details, branche, assureur, start_date, end_date, prime_annuelle, commission, garanties souscrites liste avec icons + montant garantie chacune, exclusions clauses liste rouge, franchise, plafond, beneficiaires array avec contacts liens).

- [ ] **L8** : `repo/apps/web-broker/src/components/polices/tabs/policy-premiums-tab.tsx` (~200 lignes) -- Table echeancier 12 lignes (due_date / amount_due MAD / payment_method / status badge / paid_date / actions), status filter (paid/pending/overdue), bouton "Initier paiement" inline pour status=pending qui redirect Sprint 11 /pay/initiate/:premiumId. Recharts AreaChart cumul paye/du en header (optionnel).

- [ ] **L9** : `repo/apps/web-broker/src/components/polices/tabs/policy-avenants-tab.tsx` (~180 lignes) -- Timeline chronologique avenants : pour chaque avenant card (effective_date / type avenant / description / prime_adjustment / signed_at / signed_by / document_id link PDF), bouton "Nouvel avenant" top droite qui ouvre NewAvenantDialog.

- [ ] **L10** : `repo/apps/web-broker/src/components/polices/tabs/policy-renouvellements-tab.tsx` (~180 lignes) -- Current renewal status display + history renouvellements anterieurs + bouton "Proposer renouvellement" conditionnel J-60 J+30 echeance + status badge (pending_customer_response / accepted / refused / expired) + countdown days_remaining.

- [ ] **L11** : `repo/apps/web-broker/src/components/polices/tabs/policy-documents-tab.tsx` (~150 lignes) -- Liste documents associes police : police PDF principale + attestations + endorsements PDFs + chaque card avec download button + view inline iframe Atlas Cloud signed URL + signature audit trail link Sprint 10.

- [ ] **L12** : `repo/apps/web-broker/src/components/polices/tabs/policy-operations-tab.tsx` (~150 lignes) -- Audit trail timeline complete operations : chaque event row (timestamp Africa/Casablanca + actor user + action_type icon + details JSON expandable + ip_address + user_agent). Filter par action_type (cancel/suspend/transfer/avenant/renewal/payment).

- [ ] **L13** : `repo/apps/web-broker/src/components/polices/dialogs/cancel-policy-dialog.tsx` (~220 lignes) -- Dialog cancel police : reason dropdown (resiliation_volontaire / non_paiement / fraude_souscripteur / force_majeure / autre custom) + preview pro-rata refund API call `/cancel/preview` skeleton 200ms + display refund MAD breakdown (prime_payee_total / days_consumed / days_remaining / refund_amount / management_fees 5pct / net_refund) + warning si force_majeure refund 100% + upload preuve documentaire si force_majeure + signature ANRT TSA pad + checkbox "Je confirme la resiliation" + submit POST `/cancel` Idempotency-Key.

- [ ] **L14** : `repo/apps/web-broker/src/components/polices/dialogs/suspend-policy-dialog.tsx` (~180 lignes) -- Dialog suspend : date_start (DatePicker shadcn) + date_end (DatePicker shadcn validation > date_start) + reason text + impact display ("X echeances seront suspendues : Y MAD montant total") + submit POST `/suspend` Idempotency-Key.

- [ ] **L15** : `repo/apps/web-broker/src/components/polices/dialogs/transfer-policy-dialog.tsx` (~200 lignes) -- Dialog transfer beneficiaire : new_beneficiary_contact selector Combobox autocomplete contacts/companies tenant courant (filter tenant_id check client-side defense profondeur) + reason text + signature ANRT TSA pad + warning "Transfert irreversible" + submit POST `/transfer` Idempotency-Key.

- [ ] **L16** : `repo/apps/web-broker/src/components/polices/dialogs/new-avenant-dialog.tsx` (~250 lignes) -- Dialog new avenant : type avenant Select (extension_garanties / reduction_garanties / changement_adresse_risque / changement_vehicule / changement_beneficiaire_secondaire / autre) + description text + effective_date DatePicker (validation retroactif max 90j + warning visuel) + prime_adjustment NumberInput MAD positive/negative + preview "Nouvelle prime : X -> Y (+Z%)" live calc + champ commentaire si retroactif obligatoire + submit POST `/avenants` Idempotency-Key.

- [ ] **L17** : `repo/apps/web-broker/src/components/polices/dialogs/propose-renewal-dialog.tsx` (~200 lignes) -- Dialog propose renouvellement : new_start_date DatePicker (defaults end_date+1) + new_end_date DatePicker (defaults +12 mois) + adjusted_prime NumberInput MAD (defaults prime actuelle, ajustable indexation inflation 2-5% annuel) + new_garanties optional editor + send_email_to_subscriber checkbox + submit POST `/propose-renewal` Idempotency-Key.

- [ ] **L18** : `repo/apps/web-broker/src/lib/queries/polices.queries.ts` (~200 lignes) -- TanStack Query hooks : `usePolicesList(filters)` infinite query cursor, `usePolicy(id)` single fetch, `usePolicyPremiums(id)`, `usePolicyAvenants(id)`, `usePolicyRenouvellements(id)`, `usePolicyDocuments(id)`, `usePolicyOperations(id)`, `useCancelPolicy()`, `useSuspendPolicy()`, `useTransferPolicy()`, `useCreateAvenant()`, `useProposeRenewal()`, `usePreviewRefund()` mutation avec abortController.

- [ ] **L19** : `repo/apps/web-broker/src/lib/api/polices.api.ts` (~180 lignes) -- Axios wrappers low-level : `getPolicesList(params, signal)`, `getPolicy(id)`, `getPolicyPremiums(id)`, `getPolicyAvenants(id)`, `getPolicyRenouvellements(id)`, `getPolicyDocuments(id)`, `getPolicyOperations(id)`, `cancelPolicy(id, payload, signatureToken)`, `suspendPolicy(id, payload)`, `transferPolicy(id, payload, signatureToken)`, `createAvenant(id, payload)`, `proposeRenewal(id, payload)`, `previewRefund(id, reason)`.

- [ ] **L20** : `repo/apps/web-broker/src/lib/schemas/policy.schema.ts` (~250 lignes) -- Zod schemas exhaustifs : `PolicySchema` (id, policy_number, tenant_id, souscripteur_contact_id, souscripteur_company_id, branche enum, start_date, end_date, status enum, prime_annuelle MAD positive, commission_broker MAD, assureur_partenaire_id, garanties array, exclusions array, franchise MAD, plafond MAD, beneficiaires array), `PolicyStatusSchema` (draft/active/suspended/cancelled/expired), `BrancheSchema` (auto/sante/habitation/vie/rc_pro/rc_entreprise/multirisque), `CancelPolicyPayloadSchema`, `SuspendPolicyPayloadSchema`, `TransferPolicyPayloadSchema`, `NewAvenantPayloadSchema`, `ProposeRenewalPayloadSchema`, `RefundPreviewResponseSchema`.

- [ ] **L21** : `repo/apps/web-broker/src/lib/utils/pro-rata-calculator.ts` (~80 lignes) -- Helper client-side preview pro-rata refund (display only, NOT source of truth) : `computeProRataRefund(prime_annuelle, start_date, end_date, cancel_date, reason)` returns { days_total, days_consumed, days_remaining, refund_gross, management_fees_5pct, refund_net, refund_type: 'pro_rata'|'force_majeure'|'no_refund' }. Force_majeure -> 100%. non_paiement -> 0%.

- [ ] **L22** : `repo/apps/web-broker/src/lib/formatters/policy-formatters.ts` (~150 lignes) -- Formatters i18n : `formatMAD(amount, locale)` Intl.NumberFormat, `formatPolicyStatus(status, locale)` traduction + couleur badge variant shadcn, `formatBranche(branche, locale)` traduction + icon Lucide name, `formatPolicyDates(date, locale)` formatInTimeZone Africa/Casablanca via date-fns-tz, `getDaysUntilExpiry(end_date)` retourne nombre jours + label "Expire dans Xj" / "Expiree depuis Yj".

- [ ] **L23** : Messages i18n : `fr.json` + `ar-MA.json` + `ar.json` -- ajouter ~120 cles section `polices.*` (titre page, columns DataTable, status labels, branche labels, actions buttons, dialogs labels, validation messages, toast messages).

- [ ] **L24** : Tests Vitest unitaires : `pro-rata-calculator.spec.ts` (6 tests : standard pro-rata, force_majeure 100%, non_paiement 0%, edge case <1j, edge case full year consume, fees 5pct exact), `policy.schema.spec.ts` (5 tests : valid policy, invalid status enum, invalid branche, prime negative reject, dates inversees reject), `policy-formatters.spec.ts` (4 tests : MAD fr-MA, MAD ar, status badge color, days until expiry edge cases), `polices-table.spec.tsx` (3 tests RTL + Vitest Testing Library : render columns, sort click, pagination next).

- [ ] **L25** : Tests Playwright E2E : `polices-list.spec.ts` (4 tests : list render, filter status active, filter expiring_soon, export CSV), `polices-detail.spec.ts` (3 tests : detail tabs navigation, info tab garanties display, premiums tab table), `cancel-policy.spec.ts` (2 tests : cancel standard pro-rata + cancel force_majeure 100%), `suspend-transfer.spec.ts` (2 tests : suspend date range valid, transfer to contact selector), `avenant-renewal.spec.ts` (1 test : create avenant + propose renewal full flow).

- [ ] **L26** : Validation commande : `pnpm --filter @insurtech/web-broker dev` puis `curl http://localhost:3001/fr/polices` retourne 200 + HTML render DataTable. `pnpm --filter @insurtech/web-broker test` 100% pass Vitest 18+ tests. `pnpm --filter @insurtech/web-broker test:e2e -- polices` 100% pass Playwright 12+ tests.

- [ ] **L27** : `grep -r "emoji-regex" repo/apps/web-broker/src/components/polices/` retourne 0 ligne. `grep -rE "[\x{1F300}-\x{1F9FF}]" repo/apps/web-broker/src/components/polices/` retourne 0 ligne.

- [ ] **L28** : Lighthouse run `/fr/polices` : Performance >= 70, Accessibility >= 95, Best Practices >= 90, SEO >= 80. WCAG 2.1 AA verifie via axe-core integre test E2E.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-broker/
  src/app/[locale]/(protected)/polices/
    page.tsx                                      # ~80 lignes  -- L1
    [id]/
      page.tsx                                    # ~120 lignes -- L2
      error.tsx                                   # ~40 lignes
      loading.tsx                                 # ~30 lignes
  src/components/polices/
    polices-table.tsx                             # ~250 lignes -- L3
    polices-filters.tsx                           # ~200 lignes -- L4
    policy-header-card.tsx                        # ~150 lignes -- L5
    policy-detail-tabs.tsx                        # ~200 lignes -- L6
    policy-status-badge.tsx                       # ~50 lignes
    policy-branche-icon.tsx                       # ~40 lignes
    tabs/
      policy-info-tab.tsx                         # ~180 lignes -- L7
      policy-premiums-tab.tsx                     # ~200 lignes -- L8
      policy-avenants-tab.tsx                     # ~180 lignes -- L9
      policy-renouvellements-tab.tsx              # ~180 lignes -- L10
      policy-documents-tab.tsx                    # ~150 lignes -- L11
      policy-operations-tab.tsx                   # ~150 lignes -- L12
    dialogs/
      cancel-policy-dialog.tsx                    # ~220 lignes -- L13
      suspend-policy-dialog.tsx                   # ~180 lignes -- L14
      transfer-policy-dialog.tsx                  # ~200 lignes -- L15
      new-avenant-dialog.tsx                      # ~250 lignes -- L16
      propose-renewal-dialog.tsx                  # ~200 lignes -- L17
      anrt-tsa-signature-pad.tsx                  # ~100 lignes
  src/lib/queries/
    polices.queries.ts                            # ~200 lignes -- L18
  src/lib/api/
    polices.api.ts                                # ~180 lignes -- L19
  src/lib/schemas/
    policy.schema.ts                              # ~250 lignes -- L20
  src/lib/utils/
    pro-rata-calculator.ts                        # ~80 lignes  -- L21
  src/lib/formatters/
    policy-formatters.ts                          # ~150 lignes -- L22
  src/messages/
    fr.json                                       # +120 keys polices.* -- L23
    ar-MA.json                                    # +120 keys
    ar.json                                       # +120 keys
  src/__tests__/polices/
    pro-rata-calculator.spec.ts                   # ~120 lignes (6 tests) -- L24
    policy.schema.spec.ts                         # ~90 lignes  (5 tests)
    policy-formatters.spec.ts                     # ~70 lignes  (4 tests)
    polices-table.spec.tsx                        # ~120 lignes (3 tests)

repo/e2e/web/polices/
  polices-list.spec.ts                            # ~150 lignes (4 tests) -- L25
  polices-detail.spec.ts                          # ~120 lignes (3 tests)
  cancel-policy.spec.ts                           # ~100 lignes (2 tests)
  suspend-transfer.spec.ts                        # ~100 lignes (2 tests)
  avenant-renewal.spec.ts                         # ~80 lignes  (1 test)
  fixtures/
    policy-fixtures.ts                            # ~80 lignes (mock policies)
    anrt-tsa-mock.ts                              # ~60 lignes (mock signature flow)
```

Total : ~35 fichiers crees, ~4500 lignes nettes hors tests, ~1100 lignes tests.

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `repo/apps/web-broker/src/app/[locale]/(protected)/polices/page.tsx` (~80 lignes)

```typescript
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { PolicesTable } from '@/components/polices/polices-table';
import { PolicesFilters } from '@/components/polices/polices-filters';
import { PolicesTableSkeleton } from '@/components/polices/polices-table-skeleton';
import { getPolicesList } from '@/lib/api/polices.api';
import { policiesSearchParamsCache } from '@/lib/schemas/policy.schema';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'polices' });
  return {
    title: `${t('list.title')} -- Skalean Broker`,
    description: t('list.description'),
  };
}

interface PolicesPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PolicesPage({ params, searchParams }: PolicesPageProps) {
  const { locale } = await params;
  const rawSearchParams = await searchParams;
  const filters = policiesSearchParamsCache.parse(rawSearchParams);
  const t = await getTranslations({ locale, namespace: 'polices' });

  const initialData = await getPolicesList({
    status: filters.status,
    branche: filters.branche,
    souscripteur_id: filters.souscripteur_id,
    expiring_soon: filters.expiring_soon,
    expired: filters.expired,
    assureur_partenaire_id: filters.assureur_partenaire_id,
    after: filters.cursor,
    limit: 25,
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('list.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('list.subtitle', { count: initialData.total_count })}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/${locale}/quote-builder`} className="...">{t('list.actions.generate_quote')}</Link>
          <Link href={`/${locale}/polices/new`} className="...">{t('list.actions.new_policy')}</Link>
        </div>
      </header>

      <PolicesFilters />

      <Suspense fallback={<PolicesTableSkeleton />}>
        <PolicesTable initialData={initialData} locale={locale} />
      </Suspense>
    </div>
  );
}
```

### 6.2 `repo/apps/web-broker/src/app/[locale]/(protected)/polices/[id]/page.tsx` (~120 lignes)

```typescript
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { PolicyHeaderCard } from '@/components/polices/policy-header-card';
import { PolicyDetailTabs } from '@/components/polices/policy-detail-tabs';
import { PolicyDetailSkeleton } from '@/components/polices/policy-detail-skeleton';
import { getPolicy } from '@/lib/api/polices.api';
import type { Metadata } from 'next';

interface PolicyDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}

export async function generateMetadata({ params }: PolicyDetailPageProps): Promise<Metadata> {
  const { locale, id } = await params;
  try {
    const policy = await getPolicy(id);
    return {
      title: `${policy.policy_number} -- Skalean Broker`,
      description: `Police d'assurance ${policy.branche} -- souscripteur ${policy.souscripteur_display_name}`,
    };
  } catch {
    return { title: 'Police introuvable -- Skalean Broker' };
  }
}

export default async function PolicyDetailPage({ params, searchParams }: PolicyDetailPageProps) {
  const { locale, id } = await params;
  const { tab } = await searchParams;

  let policy;
  try {
    policy = await getPolicy(id);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('404')) {
      notFound();
    }
    throw err;
  }

  if (!policy) notFound();

  const t = await getTranslations({ locale, namespace: 'polices.detail' });

  return (
    <div className="flex flex-col gap-6 p-6">
      <nav aria-label="breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href={`/${locale}/polices`} className="hover:text-foreground">{t('breadcrumb.polices')}</Link>
        <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
        <span className="text-foreground font-medium">{policy.policy_number}</span>
      </nav>

      <PolicyHeaderCard policy={policy} locale={locale} />

      <Suspense fallback={<PolicyDetailSkeleton />}>
        <PolicyDetailTabs policy={policy} locale={locale} initialTab={tab ?? 'info'} />
      </Suspense>
    </div>
  );
}
```

### 6.3 `repo/apps/web-broker/src/components/polices/polices-table.tsx` (~250 lignes)

```typescript
'use client';

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { MoreHorizontalIcon, ExternalLinkIcon, BanIcon, PauseIcon, RepeatIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PolicyStatusBadge } from '@/components/polices/policy-status-badge';
import { PolicyBrancheIcon } from '@/components/polices/policy-branche-icon';
import { formatMAD, formatPolicyDates } from '@/lib/formatters/policy-formatters';
import { getPolicesList, type PolicyListItem } from '@/lib/api/polices.api';
import { usePolicesFilters } from '@/lib/queries/polices.queries';

interface PolicesTableProps {
  initialData: { data: PolicyListItem[]; next_cursor: string | null; total_count: number };
  locale: string;
}

export function PolicesTable({ initialData, locale }: PolicesTableProps) {
  const t = useTranslations('polices.list.columns');
  const tActions = useTranslations('polices.list.actions');
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);
  const filters = usePolicesFilters();

  const query = useInfiniteQuery({
    queryKey: ['polices', filters, sorting],
    queryFn: async ({ pageParam }) => {
      return getPolicesList({
        ...filters,
        after: pageParam as string | undefined,
        sort: sorting.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`).join(','),
        limit: 25,
      });
    },
    initialData: { pages: [initialData], pageParams: [undefined] },
    initialPageParam: undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });

  const rows = useMemo(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  const columns = useMemo<ColumnDef<PolicyListItem>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label={t('select_all')}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            onClick={(e) => e.stopPropagation()}
            aria-label={t('select_row')}
          />
        ),
        size: 40,
      },
      {
        accessorKey: 'policy_number',
        header: t('policy_number'),
        cell: ({ row }) => (
          <span className="font-mono text-sm">{row.original.policy_number}</span>
        ),
      },
      {
        accessorKey: 'souscripteur_display_name',
        header: t('souscripteur'),
        cell: ({ row }) => <span>{row.original.souscripteur_display_name}</span>,
      },
      {
        accessorKey: 'branche',
        header: t('branche'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <PolicyBrancheIcon branche={row.original.branche} className="h-4 w-4" />
            <span>{t(`branches.${row.original.branche}`)}</span>
          </div>
        ),
      },
      {
        accessorKey: 'start_date',
        header: t('start_date'),
        cell: ({ row }) => formatPolicyDates(row.original.start_date, locale),
      },
      {
        accessorKey: 'end_date',
        header: t('end_date'),
        cell: ({ row }) => formatPolicyDates(row.original.end_date, locale),
      },
      {
        accessorKey: 'status',
        header: t('status'),
        cell: ({ row }) => <PolicyStatusBadge status={row.original.status} locale={locale} />,
      },
      {
        accessorKey: 'prime_annuelle',
        header: t('prime_annuelle'),
        cell: ({ row }) => (
          <span className="font-semibold">{formatMAD(row.original.prime_annuelle, locale)}</span>
        ),
      },
      {
        accessorKey: 'commission_broker',
        header: t('commission'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatMAD(row.original.commission_broker, locale)}</span>
        ),
      },
      {
        id: 'actions',
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                <MoreHorizontalIcon className="h-4 w-4" />
                <span className="sr-only">{tActions('open_menu')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/${locale}/polices/${row.original.id}`)}>
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                {tActions('view_detail')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={row.original.status !== 'active'}>
                <PauseIcon className="mr-2 h-4 w-4" />
                {tActions('suspend')}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!['active', 'suspended'].includes(row.original.status)}>
                <RepeatIcon className="mr-2 h-4 w-4" />
                {tActions('transfer')}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!['active', 'suspended'].includes(row.original.status)}
                className="text-destructive"
              >
                <BanIcon className="mr-2 h-4 w-4" />
                {tActions('cancel')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 60,
      },
    ],
    [t, tActions, locale, router],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    enableRowSelection: true,
  });

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id} style={{ width: h.column.columnDef.size }}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {t('empty_state')}
              </TableCell>
            </TableRow>
          )}
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? 'selected' : undefined}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => router.push(`/${locale}/polices/${row.original.id}`)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between p-4 border-t">
        <div className="text-sm text-muted-foreground">
          {tActions('selected', { count: table.getFilteredSelectedRowModel().rows.length, total: rows.length })}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.fetchNextPage()}
            disabled={!query.hasNextPage || query.isFetchingNextPage}
          >
            {query.isFetchingNextPage ? tActions('loading') : tActions('load_more')}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### 6.4 `repo/apps/web-broker/src/components/polices/polices-filters.tsx` (~200 lignes)

```typescript
'use client';

import { useQueryStates, parseAsString, parseAsBoolean, parseAsArrayOf } from 'nuqs';
import { useTranslations } from 'next-intl';
import { useDebouncedCallback } from 'use-debounce';
import { XIcon, DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { ContactsAutocomplete } from '@/components/contacts/contacts-autocomplete';
import { AssureursPartenairesSelect } from '@/components/polices/assureurs-partenaires-select';
import { POLICY_STATUSES, BRANCHES } from '@/lib/schemas/policy.schema';
import { exportPolicesCSV } from '@/lib/api/polices.api';
import { toast } from 'sonner';

export function PolicesFilters() {
  const t = useTranslations('polices.list.filters');
  const tBranches = useTranslations('polices.list.columns.branches');
  const tStatuses = useTranslations('polices.statuses');

  const [filters, setFilters] = useQueryStates(
    {
      status: parseAsArrayOf(parseAsString).withDefault([]),
      branche: parseAsArrayOf(parseAsString).withDefault([]),
      souscripteur_id: parseAsString.withDefault(''),
      expiring_soon: parseAsBoolean.withDefault(false),
      expired: parseAsBoolean.withDefault(false),
      assureur_partenaire_id: parseAsString.withDefault(''),
    },
    { history: 'replace', shallow: false, throttleMs: 300 },
  );

  const hasFilters =
    filters.status.length > 0 ||
    filters.branche.length > 0 ||
    Boolean(filters.souscripteur_id) ||
    filters.expiring_soon ||
    filters.expired ||
    Boolean(filters.assureur_partenaire_id);

  const debouncedSetSouscripteur = useDebouncedCallback((id: string) => {
    void setFilters({ souscripteur_id: id });
  }, 300);

  async function handleExportCSV() {
    try {
      const blob = await exportPolicesCSV(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `polices_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('export_success'));
    } catch {
      toast.error(t('export_error'));
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="filter-status">{t('status_label')}</Label>
          <MultiSelect
            id="filter-status"
            options={POLICY_STATUSES.map((s) => ({ label: tStatuses(s), value: s }))}
            value={filters.status}
            onChange={(v) => setFilters({ status: v })}
            placeholder={t('status_placeholder')}
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="filter-branche">{t('branche_label')}</Label>
          <MultiSelect
            id="filter-branche"
            options={BRANCHES.map((b) => ({ label: tBranches(b), value: b }))}
            value={filters.branche}
            onChange={(v) => setFilters({ branche: v })}
            placeholder={t('branche_placeholder')}
          />
        </div>

        <div className="flex-1 min-w-[240px]">
          <Label htmlFor="filter-souscripteur">{t('souscripteur_label')}</Label>
          <ContactsAutocomplete
            id="filter-souscripteur"
            value={filters.souscripteur_id}
            onChange={debouncedSetSouscripteur}
            placeholder={t('souscripteur_placeholder')}
            includeCompanies
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <Label htmlFor="filter-assureur">{t('assureur_label')}</Label>
          <AssureursPartenairesSelect
            id="filter-assureur"
            value={filters.assureur_partenaire_id}
            onChange={(v) => setFilters({ assureur_partenaire_id: v })}
            placeholder={t('assureur_placeholder')}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <Switch
            id="filter-expiring"
            checked={filters.expiring_soon}
            onCheckedChange={(v) => setFilters({ expiring_soon: v })}
          />
          <Label htmlFor="filter-expiring" className="cursor-pointer">{t('expiring_soon_label')}</Label>
          <span className="text-xs text-muted-foreground">{t('expiring_soon_hint')}</span>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="filter-expired"
            checked={filters.expired}
            onCheckedChange={(v) => setFilters({ expired: v })}
          />
          <Label htmlFor="filter-expired" className="cursor-pointer">{t('expired_label')}</Label>
        </div>

        <div className="flex-1" />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({
                status: [],
                branche: [],
                souscripteur_id: '',
                expiring_soon: false,
                expired: false,
                assureur_partenaire_id: '',
              })
            }
          >
            <XIcon className="mr-2 h-4 w-4" />
            {t('reset')}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={handleExportCSV}>
          <DownloadIcon className="mr-2 h-4 w-4" />
          {t('export_csv')}
        </Button>
      </div>
    </div>
  );
}
```

### 6.5 `repo/apps/web-broker/src/components/polices/policy-header-card.tsx` (~150 lignes)

```typescript
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ExternalLinkIcon, AlertTriangleIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PolicyStatusBadge } from '@/components/polices/policy-status-badge';
import { PolicyBrancheIcon } from '@/components/polices/policy-branche-icon';
import { formatMAD, formatPolicyDates, getDaysUntilExpiry } from '@/lib/formatters/policy-formatters';
import type { Policy } from '@/lib/schemas/policy.schema';

interface PolicyHeaderCardProps {
  policy: Policy;
  locale: string;
}

export function PolicyHeaderCard({ policy, locale }: PolicyHeaderCardProps) {
  const t = useTranslations('polices.detail.header');
  const tBranches = useTranslations('polices.list.columns.branches');
  const daysUntilExpiry = getDaysUntilExpiry(policy.end_date);
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 60;
  const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;
  const souscripteurHref = policy.souscripteur_type === 'company'
    ? `/${locale}/companies/${policy.souscripteur_company_id}`
    : `/${locale}/contacts/${policy.souscripteur_contact_id}`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex-1 min-w-[300px]">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold font-mono tracking-tight">{policy.policy_number}</h2>
              <PolicyStatusBadge status={policy.status} locale={locale} size="lg" />
            </div>

            <Link
              href={souscripteurHref}
              className="mt-2 inline-flex items-center gap-1 text-base text-primary hover:underline"
            >
              {policy.souscripteur_display_name}
              <ExternalLinkIcon className="h-3 w-3" aria-hidden="true" />
            </Link>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <PolicyBrancheIcon branche={policy.branche} className="h-4 w-4" />
                <span>{tBranches(policy.branche)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span>{t('period')}:</span>
                <span className="font-medium text-foreground">
                  {formatPolicyDates(policy.start_date, locale)} -- {formatPolicyDates(policy.end_date, locale)}
                </span>
              </div>
              {isExpiringSoon && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                  <AlertTriangleIcon className="h-3 w-3" aria-hidden="true" />
                  {t('expiring_in_days', { days: daysUntilExpiry })}
                </span>
              )}
              {isExpired && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-300">
                  <AlertTriangleIcon className="h-3 w-3" aria-hidden="true" />
                  {t('expired_since_days', { days: Math.abs(daysUntilExpiry!) })}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {policy.assureur_partenaire_logo_url && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">{t('assureur')}</span>
                <Image
                  src={policy.assureur_partenaire_logo_url}
                  alt={policy.assureur_partenaire_name}
                  width={80}
                  height={40}
                  className="object-contain"
                />
              </div>
            )}

            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground">{t('prime_annuelle')}</div>
              <div className="text-2xl font-bold text-primary">{formatMAD(policy.prime_annuelle, locale)}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t('commission')}: {formatMAD(policy.commission_broker, locale)}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.6 `repo/apps/web-broker/src/components/polices/policy-detail-tabs.tsx` (~200 lignes)

```typescript
'use client';

import { lazy, Suspense, useState } from 'react';
import { useQueryState, parseAsString } from 'nuqs';
import { useTranslations } from 'next-intl';
import { BanIcon, PauseIcon, RepeatIcon, FilePlusIcon, RefreshCwIcon } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PolicyInfoTab } from './tabs/policy-info-tab';
import type { Policy } from '@/lib/schemas/policy.schema';

const PolicyPremiumsTab = lazy(() =>
  import('./tabs/policy-premiums-tab').then((m) => ({ default: m.PolicyPremiumsTab })),
);
const PolicyAvenantsTab = lazy(() =>
  import('./tabs/policy-avenants-tab').then((m) => ({ default: m.PolicyAvenantsTab })),
);
const PolicyRenouvellementsTab = lazy(() =>
  import('./tabs/policy-renouvellements-tab').then((m) => ({ default: m.PolicyRenouvellementsTab })),
);
const PolicyDocumentsTab = lazy(() =>
  import('./tabs/policy-documents-tab').then((m) => ({ default: m.PolicyDocumentsTab })),
);
const PolicyOperationsTab = lazy(() =>
  import('./tabs/policy-operations-tab').then((m) => ({ default: m.PolicyOperationsTab })),
);

const CancelPolicyDialog = lazy(() =>
  import('./dialogs/cancel-policy-dialog').then((m) => ({ default: m.CancelPolicyDialog })),
);
const SuspendPolicyDialog = lazy(() =>
  import('./dialogs/suspend-policy-dialog').then((m) => ({ default: m.SuspendPolicyDialog })),
);
const TransferPolicyDialog = lazy(() =>
  import('./dialogs/transfer-policy-dialog').then((m) => ({ default: m.TransferPolicyDialog })),
);
const NewAvenantDialog = lazy(() =>
  import('./dialogs/new-avenant-dialog').then((m) => ({ default: m.NewAvenantDialog })),
);
const ProposeRenewalDialog = lazy(() =>
  import('./dialogs/propose-renewal-dialog').then((m) => ({ default: m.ProposeRenewalDialog })),
);

interface PolicyDetailTabsProps {
  policy: Policy;
  locale: string;
  initialTab: string;
}

export function PolicyDetailTabs({ policy, locale, initialTab }: PolicyDetailTabsProps) {
  const t = useTranslations('polices.detail.tabs');
  const tActions = useTranslations('polices.detail.actions');
  const [tab, setTab] = useQueryState(
    'tab',
    parseAsString.withDefault(initialTab ?? 'info'),
  );

  const [cancelOpen, setCancelOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [avenantOpen, setAvenantOpen] = useState(false);
  const [renewalOpen, setRenewalOpen] = useState(false);

  const isLifecycleDisabled = ['cancelled', 'expired'].includes(policy.status);
  const isCancelDisabled = !['active', 'suspended', 'draft'].includes(policy.status);
  const isSuspendDisabled = policy.status !== 'active';
  const isTransferDisabled = !['active', 'suspended'].includes(policy.status);
  const isAvenantDisabled = !['active', 'suspended'].includes(policy.status);
  const isRenewalDisabled = isLifecycleDisabled;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs value={tab} onValueChange={setTab} className="flex-1">
          <TabsList className="w-full overflow-x-auto flex justify-start">
            <TabsTrigger value="info">{t('info')}</TabsTrigger>
            <TabsTrigger value="premiums">{t('premiums')}</TabsTrigger>
            <TabsTrigger value="avenants">{t('avenants')}</TabsTrigger>
            <TabsTrigger value="renouvellements">{t('renouvellements')}</TabsTrigger>
            <TabsTrigger value="documents">{t('documents')}</TabsTrigger>
            <TabsTrigger value="operations">{t('operations')}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={isAvenantDisabled} onClick={() => setAvenantOpen(true)}>
            <FilePlusIcon className="mr-2 h-4 w-4" />
            {tActions('new_avenant')}
          </Button>
          <Button variant="outline" size="sm" disabled={isRenewalDisabled} onClick={() => setRenewalOpen(true)}>
            <RefreshCwIcon className="mr-2 h-4 w-4" />
            {tActions('propose_renewal')}
          </Button>
          <Button variant="outline" size="sm" disabled={isTransferDisabled} onClick={() => setTransferOpen(true)}>
            <RepeatIcon className="mr-2 h-4 w-4" />
            {tActions('transfer')}
          </Button>
          <Button variant="outline" size="sm" disabled={isSuspendDisabled} onClick={() => setSuspendOpen(true)}>
            <PauseIcon className="mr-2 h-4 w-4" />
            {tActions('suspend')}
          </Button>
          <Button variant="destructive" size="sm" disabled={isCancelDisabled} onClick={() => setCancelOpen(true)}>
            <BanIcon className="mr-2 h-4 w-4" />
            {tActions('cancel')}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsContent value="info" className="mt-6">
          <PolicyInfoTab policy={policy} locale={locale} />
        </TabsContent>
        <TabsContent value="premiums" className="mt-6">
          <Suspense fallback={<TabSkeleton />}>
            <PolicyPremiumsTab policyId={policy.id} locale={locale} />
          </Suspense>
        </TabsContent>
        <TabsContent value="avenants" className="mt-6">
          <Suspense fallback={<TabSkeleton />}>
            <PolicyAvenantsTab policyId={policy.id} locale={locale} onCreateAvenant={() => setAvenantOpen(true)} />
          </Suspense>
        </TabsContent>
        <TabsContent value="renouvellements" className="mt-6">
          <Suspense fallback={<TabSkeleton />}>
            <PolicyRenouvellementsTab policy={policy} locale={locale} onProposeRenewal={() => setRenewalOpen(true)} />
          </Suspense>
        </TabsContent>
        <TabsContent value="documents" className="mt-6">
          <Suspense fallback={<TabSkeleton />}>
            <PolicyDocumentsTab policyId={policy.id} locale={locale} />
          </Suspense>
        </TabsContent>
        <TabsContent value="operations" className="mt-6">
          <Suspense fallback={<TabSkeleton />}>
            <PolicyOperationsTab policyId={policy.id} locale={locale} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <Suspense fallback={null}>
        {cancelOpen && (
          <CancelPolicyDialog policy={policy} open={cancelOpen} onClose={() => setCancelOpen(false)} locale={locale} />
        )}
        {suspendOpen && (
          <SuspendPolicyDialog policy={policy} open={suspendOpen} onClose={() => setSuspendOpen(false)} locale={locale} />
        )}
        {transferOpen && (
          <TransferPolicyDialog policy={policy} open={transferOpen} onClose={() => setTransferOpen(false)} locale={locale} />
        )}
        {avenantOpen && (
          <NewAvenantDialog policy={policy} open={avenantOpen} onClose={() => setAvenantOpen(false)} locale={locale} />
        )}
        {renewalOpen && (
          <ProposeRenewalDialog policy={policy} open={renewalOpen} onClose={() => setRenewalOpen(false)} locale={locale} />
        )}
      </Suspense>
    </>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

### 6.7 `repo/apps/web-broker/src/components/polices/tabs/policy-premiums-tab.tsx` (~200 lignes)

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CheckCircle2Icon, ClockIcon, AlertCircleIcon, CreditCardIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatMAD, formatPolicyDates } from '@/lib/formatters/policy-formatters';
import { getPolicyPremiums } from '@/lib/api/polices.api';
import type { Premium } from '@/lib/schemas/policy.schema';

interface PolicyPremiumsTabProps {
  policyId: string;
  locale: string;
}

export function PolicyPremiumsTab({ policyId, locale }: PolicyPremiumsTabProps) {
  const t = useTranslations('polices.detail.premiums');
  const router = useRouter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['policy', policyId, 'premiums'],
    queryFn: () => getPolicyPremiums(policyId),
    staleTime: 60_000,
  });

  if (isLoading) return <PremiumsSkeleton />;
  if (error || !data) return <p className="text-destructive">{t('error')}</p>;

  const totals = data.reduce(
    (acc, p) => {
      if (p.status === 'paid') acc.paid += p.amount_due;
      else if (p.status === 'pending') acc.pending += p.amount_due;
      else if (p.status === 'overdue') acc.overdue += p.amount_due;
      return acc;
    },
    { paid: 0, pending: 0, overdue: 0 },
  );

  const chartData = data.map((p) => ({
    due_date: p.due_date,
    label: formatPolicyDates(p.due_date, locale),
    paid: p.status === 'paid' ? p.amount_due : 0,
    due: p.amount_due,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label={t('summary.paid')} amount={totals.paid} variant="success" locale={locale} />
        <SummaryCard label={t('summary.pending')} amount={totals.pending} variant="warning" locale={locale} />
        <SummaryCard label={t('summary.overdue')} amount={totals.overdue} variant="danger" locale={locale} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('chart_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => formatMAD(v as number, locale)} />
                <Tooltip formatter={(v: number) => formatMAD(v, locale)} />
                <Area type="monotone" dataKey="due" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted))" />
                <Area type="monotone" dataKey="paid" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.3)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('table_title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('columns.due_date')}</TableHead>
                <TableHead>{t('columns.amount_due')}</TableHead>
                <TableHead>{t('columns.payment_method')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead>{t('columns.paid_date')}</TableHead>
                <TableHead className="text-right">{t('columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatPolicyDates(p.due_date, locale)}</TableCell>
                  <TableCell className="font-medium">{formatMAD(p.amount_due, locale)}</TableCell>
                  <TableCell>{t(`methods.${p.payment_method}`)}</TableCell>
                  <TableCell>
                    <PremiumStatusBadge premium={p} locale={locale} />
                  </TableCell>
                  <TableCell>{p.paid_date ? formatPolicyDates(p.paid_date, locale) : '--'}</TableCell>
                  <TableCell className="text-right">
                    {p.status !== 'paid' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/${locale}/pay/initiate/${p.id}`)}
                      >
                        <CreditCardIcon className="mr-2 h-4 w-4" />
                        {t('actions.initiate_payment')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, amount, variant, locale }: { label: string; amount: number; variant: 'success' | 'warning' | 'danger'; locale: string }) {
  const colorClass = variant === 'success' ? 'text-green-600' : variant === 'warning' ? 'text-orange-600' : 'text-red-600';
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-bold ${colorClass}`}>{formatMAD(amount, locale)}</p>
      </CardContent>
    </Card>
  );
}

function PremiumStatusBadge({ premium, locale }: { premium: Premium; locale: string }) {
  const t = useTranslations('polices.detail.premiums.statuses');
  if (premium.status === 'paid') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle2Icon className="h-3 w-3" />
        {t('paid')}
      </span>
    );
  }
  if (premium.status === 'overdue') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
        <AlertCircleIcon className="h-3 w-3" />
        {t('overdue', { days: premium.days_overdue })}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
      <ClockIcon className="h-3 w-3" />
      {t('pending')}
    </span>
  );
}

function PremiumsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-96" />
    </div>
  );
}
```

### 6.8 `repo/apps/web-broker/src/components/polices/dialogs/cancel-policy-dialog.tsx` (~220 lignes)

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { AlertTriangleIcon, ShieldCheckIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AnrtTsaSignaturePad } from './anrt-tsa-signature-pad';
import { DocumentUploadInline } from '@/components/docs/document-upload-inline';
import { previewRefund, cancelPolicy } from '@/lib/api/polices.api';
import { CancelPolicyPayloadSchema, type Policy } from '@/lib/schemas/policy.schema';
import { formatMAD } from '@/lib/formatters/policy-formatters';

const FormSchema = z.object({
  reason: z.enum(['resiliation_volontaire', 'non_paiement', 'fraude_souscripteur', 'force_majeure', 'autre']),
  reason_custom: z.string().optional(),
  proof_document_id: z.string().optional(),
  signature_token: z.string().min(1),
  confirm: z.boolean().refine((v) => v === true),
}).refine((v) => v.reason !== 'force_majeure' || Boolean(v.proof_document_id), {
  message: 'Force majeure requires proof document',
  path: ['proof_document_id'],
}).refine((v) => v.reason !== 'autre' || (v.reason_custom && v.reason_custom.length >= 10), {
  message: 'Autre reason requires custom text >=10 chars',
  path: ['reason_custom'],
});

interface CancelPolicyDialogProps {
  policy: Policy;
  open: boolean;
  onClose: () => void;
  locale: string;
}

export function CancelPolicyDialog({ policy, open, onClose, locale }: CancelPolicyDialogProps) {
  const t = useTranslations('polices.detail.dialogs.cancel');
  const queryClient = useQueryClient();
  const [signatureToken, setSignatureToken] = useState<string | null>(null);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { reason: 'resiliation_volontaire', confirm: false, signature_token: '' },
  });

  const reason = form.watch('reason');

  const preview = useMutation({
    mutationKey: ['preview-refund', policy.id, reason],
    mutationFn: () => previewRefund(policy.id, reason),
  });

  useEffect(() => {
    if (open && reason) {
      preview.mutate();
    }
  }, [reason, open]);

  const cancel = useMutation({
    mutationFn: (payload: z.infer<typeof CancelPolicyPayloadSchema>) =>
      cancelPolicy(policy.id, payload, signatureToken!),
    onSuccess: () => {
      toast.success(t('toast_success'));
      void queryClient.invalidateQueries({ queryKey: ['policy', policy.id] });
      void queryClient.invalidateQueries({ queryKey: ['polices'] });
      onClose();
    },
    onError: (err: Error) => {
      toast.error(t('toast_error', { message: err.message }));
    },
  });

  async function onSubmit(values: z.infer<typeof FormSchema>) {
    if (!signatureToken) {
      toast.error(t('signature_required'));
      return;
    }
    cancel.mutate({
      reason: values.reason,
      reason_custom: values.reason_custom,
      proof_document_id: values.proof_document_id,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangleIcon className="h-5 w-5" />
            {t('title', { policyNumber: policy.policy_number })}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reason_label')}</label>
            <Select value={reason} onValueChange={(v) => form.setValue('reason', v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resiliation_volontaire">{t('reasons.resiliation_volontaire')}</SelectItem>
                <SelectItem value="non_paiement">{t('reasons.non_paiement')}</SelectItem>
                <SelectItem value="fraude_souscripteur">{t('reasons.fraude_souscripteur')}</SelectItem>
                <SelectItem value="force_majeure">{t('reasons.force_majeure')}</SelectItem>
                <SelectItem value="autre">{t('reasons.autre')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {reason === 'autre' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('reason_custom_label')}</label>
              <Textarea
                {...form.register('reason_custom')}
                rows={3}
                placeholder={t('reason_custom_placeholder')}
              />
            </div>
          )}

          {reason === 'force_majeure' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('proof_document_label')}</label>
              <DocumentUploadInline
                allowedTypes={['application/pdf', 'image/jpeg', 'image/png']}
                onUploaded={(id) => form.setValue('proof_document_id', id)}
              />
              <p className="text-xs text-muted-foreground">{t('proof_document_hint')}</p>
            </div>
          )}

          <Alert>
            <AlertTitle>{t('refund_preview_title')}</AlertTitle>
            <AlertDescription>
              {preview.isPending && (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}
              {preview.data && (
                <div className="mt-2 space-y-1 text-sm">
                  <RefundRow label={t('refund.prime_payee')} value={formatMAD(preview.data.prime_payee_total, locale)} />
                  <RefundRow label={t('refund.days_consumed')} value={`${preview.data.days_consumed}j / ${preview.data.days_total}j`} />
                  <RefundRow label={t('refund.refund_gross')} value={formatMAD(preview.data.refund_gross, locale)} />
                  <RefundRow label={t('refund.management_fees')} value={`-${formatMAD(preview.data.management_fees_5pct, locale)}`} />
                  <div className="mt-2 border-t pt-2 flex items-center justify-between">
                    <span className="font-semibold">{t('refund.refund_net')}</span>
                    <span className="text-lg font-bold text-primary">{formatMAD(preview.data.refund_net, locale)}</span>
                  </div>
                  {preview.data.refund_type === 'force_majeure' && (
                    <Alert className="mt-3 border-green-200 bg-green-50">
                      <ShieldCheckIcon className="h-4 w-4 text-green-700" />
                      <AlertDescription className="text-green-900">{t('refund.force_majeure_notice')}</AlertDescription>
                    </Alert>
                  )}
                  {preview.data.refund_type === 'no_refund' && (
                    <Alert variant="destructive" className="mt-3">
                      <AlertTriangleIcon className="h-4 w-4" />
                      <AlertDescription>{t('refund.no_refund_notice')}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <FileTextIcon className="h-4 w-4" />
              {t('signature_label')}
            </label>
            <AnrtTsaSignaturePad
              context={{ policy_id: policy.id, action: 'cancel' }}
              onSigned={(token) => {
                setSignatureToken(token);
                form.setValue('signature_token', token);
              }}
            />
            <p className="text-xs text-muted-foreground">{t('signature_hint')}</p>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox id="confirm-cancel" {...form.register('confirm')} />
            <label htmlFor="confirm-cancel" className="text-sm cursor-pointer">{t('confirm_checkbox')}</label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={cancel.isPending}>
              {t('cancel_button')}
            </Button>
            <Button type="submit" variant="destructive" disabled={cancel.isPending || !signatureToken}>
              {cancel.isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('submit_button')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RefundRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
```

### 6.9 `repo/apps/web-broker/src/components/polices/dialogs/new-avenant-dialog.tsx` (~250 lignes)

```typescript
'use client';

import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { addDays, differenceInDays, isBefore } from 'date-fns';
import { AlertTriangleIcon, Loader2Icon, FilePlusIcon } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { createAvenant } from '@/lib/api/polices.api';
import type { Policy } from '@/lib/schemas/policy.schema';
import { formatMAD } from '@/lib/formatters/policy-formatters';

const FormSchema = z.object({
  type: z.enum([
    'extension_garanties',
    'reduction_garanties',
    'changement_adresse_risque',
    'changement_vehicule',
    'changement_beneficiaire_secondaire',
    'autre',
  ]),
  description: z.string().min(20, 'Description min 20 chars').max(500),
  effective_date: z.date(),
  prime_adjustment: z.number().refine((v) => Math.abs(v) > 0 || true, 'Prime adjustment requise'),
  retroactive_comment: z.string().optional(),
}).refine((v) => {
  const today = new Date();
  const retroactiveDays = differenceInDays(today, v.effective_date);
  if (retroactiveDays > 0 && retroactiveDays <= 90) {
    return Boolean(v.retroactive_comment && v.retroactive_comment.length >= 10);
  }
  return true;
}, { message: 'Avenant retroactif requiert commentaire >=10 chars', path: ['retroactive_comment'] }).refine((v) => {
  const retroactiveDays = differenceInDays(new Date(), v.effective_date);
  return retroactiveDays <= 90;
}, { message: 'Avenant retroactif max 90j', path: ['effective_date'] });

interface NewAvenantDialogProps {
  policy: Policy;
  open: boolean;
  onClose: () => void;
  locale: string;
}

export function NewAvenantDialog({ policy, open, onClose, locale }: NewAvenantDialogProps) {
  const t = useTranslations('polices.detail.dialogs.avenant');
  const queryClient = useQueryClient();
  const [primeAdjustmentInput, setPrimeAdjustmentInput] = useState('0');

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      type: 'extension_garanties',
      description: '',
      effective_date: addDays(new Date(), 1),
      prime_adjustment: 0,
    },
  });

  const effectiveDate = form.watch('effective_date');
  const primeAdjustment = form.watch('prime_adjustment');
  const isRetroactive = effectiveDate && isBefore(effectiveDate, new Date());
  const retroactiveDays = effectiveDate ? differenceInDays(new Date(), effectiveDate) : 0;

  const previewPrime = useMemo(() => {
    const current = policy.prime_annuelle;
    const next = current + primeAdjustment;
    const percent = current > 0 ? ((primeAdjustment / current) * 100).toFixed(1) : '0';
    const exceedsLimit = Math.abs(primeAdjustment) > current * 0.5;
    return { current, next, percent, exceedsLimit, sign: primeAdjustment >= 0 ? '+' : '' };
  }, [policy.prime_annuelle, primeAdjustment]);

  const create = useMutation({
    mutationFn: (payload: z.infer<typeof FormSchema>) =>
      createAvenant(policy.id, {
        type: payload.type,
        description: payload.description,
        effective_date: payload.effective_date.toISOString(),
        prime_adjustment: payload.prime_adjustment,
        retroactive_comment: payload.retroactive_comment,
      }),
    onSuccess: () => {
      toast.success(t('toast_success'));
      void queryClient.invalidateQueries({ queryKey: ['policy', policy.id] });
      onClose();
    },
    onError: (err: Error) => toast.error(t('toast_error', { message: err.message })),
  });

  function onSubmit(values: z.infer<typeof FormSchema>) {
    if (previewPrime.exceedsLimit) {
      toast.error(t('prime_limit_error'));
      return;
    }
    create.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePlusIcon className="h-5 w-5" />
            {t('title', { policyNumber: policy.policy_number })}
          </DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('type_label')}</label>
            <Select value={form.watch('type')} onValueChange={(v) => form.setValue('type', v as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="extension_garanties">{t('types.extension_garanties')}</SelectItem>
                <SelectItem value="reduction_garanties">{t('types.reduction_garanties')}</SelectItem>
                <SelectItem value="changement_adresse_risque">{t('types.changement_adresse_risque')}</SelectItem>
                <SelectItem value="changement_vehicule">{t('types.changement_vehicule')}</SelectItem>
                <SelectItem value="changement_beneficiaire_secondaire">{t('types.changement_beneficiaire_secondaire')}</SelectItem>
                <SelectItem value="autre">{t('types.autre')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('description_label')}</label>
            <Textarea {...form.register('description')} rows={4} placeholder={t('description_placeholder')} />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('effective_date_label')}</label>
            <DatePicker
              value={effectiveDate}
              onChange={(d) => form.setValue('effective_date', d as Date)}
              max={policy.end_date}
            />
            {isRetroactive && (
              <Alert variant="default" className="border-orange-200 bg-orange-50">
                <AlertTriangleIcon className="h-4 w-4 text-orange-700" />
                <AlertDescription className="text-orange-900">
                  {t('retroactive_warning', { days: retroactiveDays })}
                </AlertDescription>
              </Alert>
            )}
            {retroactiveDays > 90 && (
              <p className="text-xs text-destructive">{t('retroactive_max_error')}</p>
            )}
          </div>

          {isRetroactive && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('retroactive_comment_label')}</label>
              <Textarea
                {...form.register('retroactive_comment')}
                rows={3}
                placeholder={t('retroactive_comment_placeholder')}
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('prime_adjustment_label')}</label>
            <Input
              type="number"
              step="0.01"
              value={primeAdjustmentInput}
              onChange={(e) => {
                setPrimeAdjustmentInput(e.target.value);
                const num = Number(e.target.value);
                if (!Number.isNaN(num)) form.setValue('prime_adjustment', num);
              }}
              placeholder={t('prime_adjustment_placeholder')}
            />
            <p className="text-xs text-muted-foreground">{t('prime_adjustment_hint')}</p>
          </div>

          <Alert>
            <AlertDescription>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">{t('preview.current_prime')}</p>
                  <p className="font-semibold">{formatMAD(previewPrime.current, locale)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('preview.adjustment')}</p>
                  <p className="font-semibold">{previewPrime.sign}{formatMAD(primeAdjustment, locale)} ({previewPrime.sign}{previewPrime.percent}%)</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('preview.new_prime')}</p>
                  <p className={`text-lg font-bold ${previewPrime.exceedsLimit ? 'text-destructive' : 'text-primary'}`}>
                    {formatMAD(previewPrime.next, locale)}
                  </p>
                </div>
              </div>
              {previewPrime.exceedsLimit && (
                <p className="mt-2 text-xs text-destructive flex items-center gap-1">
                  <AlertTriangleIcon className="h-3 w-3" />
                  {t('prime_limit_warning')}
                </p>
              )}
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
              {t('cancel_button')}
            </Button>
            <Button type="submit" disabled={create.isPending || previewPrime.exceedsLimit}>
              {create.isPending ? <Loader2Icon className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('submit_button')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.10 `repo/apps/web-broker/src/lib/queries/polices.queries.ts` (~200 lignes)

```typescript
'use client';

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useQueryStates, parseAsString, parseAsBoolean, parseAsArrayOf } from 'nuqs';
import * as api from '@/lib/api/polices.api';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export function usePolicesFilters() {
  const [filters] = useQueryStates({
    status: parseAsArrayOf(parseAsString).withDefault([]),
    branche: parseAsArrayOf(parseAsString).withDefault([]),
    souscripteur_id: parseAsString.withDefault(''),
    expiring_soon: parseAsBoolean.withDefault(false),
    expired: parseAsBoolean.withDefault(false),
    assureur_partenaire_id: parseAsString.withDefault(''),
  });
  return filters;
}

export function usePolicesList() {
  const filters = usePolicesFilters();
  return useInfiniteQuery({
    queryKey: ['polices', filters],
    queryFn: ({ pageParam, signal }) =>
      api.getPolicesList({ ...filters, after: pageParam as string | undefined, limit: 25 }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    staleTime: 30_000,
  });
}

export function usePolicy(id: string) {
  return useQuery({
    queryKey: ['policy', id],
    queryFn: ({ signal }) => api.getPolicy(id, signal),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function usePolicyPremiums(id: string) {
  return useQuery({
    queryKey: ['policy', id, 'premiums'],
    queryFn: ({ signal }) => api.getPolicyPremiums(id, signal),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function usePolicyAvenants(id: string) {
  return useQuery({
    queryKey: ['policy', id, 'avenants'],
    queryFn: ({ signal }) => api.getPolicyAvenants(id, signal),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function usePolicyRenouvellements(id: string) {
  return useQuery({
    queryKey: ['policy', id, 'renouvellements'],
    queryFn: ({ signal }) => api.getPolicyRenouvellements(id, signal),
    enabled: Boolean(id),
  });
}

export function usePolicyDocuments(id: string) {
  return useQuery({
    queryKey: ['policy', id, 'documents'],
    queryFn: ({ signal }) => api.getPolicyDocuments(id, signal),
    enabled: Boolean(id),
  });
}

export function usePolicyOperations(id: string) {
  return useQuery({
    queryKey: ['policy', id, 'operations'],
    queryFn: ({ signal }) => api.getPolicyOperations(id, signal),
    enabled: Boolean(id),
  });
}

export function usePreviewRefund(policyId: string) {
  return useMutation({
    mutationKey: ['preview-refund', policyId],
    mutationFn: (reason: string) => api.previewRefund(policyId, reason),
  });
}

export function useCancelPolicy(policyId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('polices.toasts.cancel');
  return useMutation({
    mutationFn: ({ payload, signatureToken }: { payload: Parameters<typeof api.cancelPolicy>[1]; signatureToken: string }) =>
      api.cancelPolicy(policyId, payload, signatureToken),
    onSuccess: () => {
      toast.success(t('success'));
      void queryClient.invalidateQueries({ queryKey: ['policy', policyId] });
      void queryClient.invalidateQueries({ queryKey: ['polices'] });
    },
    onError: (err: Error) => toast.error(t('error', { message: err.message })),
  });
}

export function useSuspendPolicy(policyId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('polices.toasts.suspend');
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.suspendPolicy>[1]) => api.suspendPolicy(policyId, payload),
    onSuccess: () => {
      toast.success(t('success'));
      void queryClient.invalidateQueries({ queryKey: ['policy', policyId] });
    },
    onError: (err: Error) => toast.error(t('error', { message: err.message })),
  });
}

export function useTransferPolicy(policyId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('polices.toasts.transfer');
  return useMutation({
    mutationFn: ({ payload, signatureToken }: { payload: Parameters<typeof api.transferPolicy>[1]; signatureToken: string }) =>
      api.transferPolicy(policyId, payload, signatureToken),
    onSuccess: () => {
      toast.success(t('success'));
      void queryClient.invalidateQueries({ queryKey: ['policy', policyId] });
    },
    onError: (err: Error) => toast.error(t('error', { message: err.message })),
  });
}

export function useCreateAvenant(policyId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('polices.toasts.avenant');
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.createAvenant>[1]) => api.createAvenant(policyId, payload),
    onSuccess: () => {
      toast.success(t('success'));
      void queryClient.invalidateQueries({ queryKey: ['policy', policyId] });
    },
    onError: (err: Error) => toast.error(t('error', { message: err.message })),
  });
}

export function useProposeRenewal(policyId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('polices.toasts.renewal');
  return useMutation({
    mutationFn: (payload: Parameters<typeof api.proposeRenewal>[1]) => api.proposeRenewal(policyId, payload),
    onSuccess: () => {
      toast.success(t('success'));
      void queryClient.invalidateQueries({ queryKey: ['policy', policyId] });
    },
    onError: (err: Error) => toast.error(t('error', { message: err.message })),
  });
}
```

### 6.11 `repo/apps/web-broker/src/lib/api/polices.api.ts` (~180 lignes)

```typescript
import { apiClient } from '@/lib/api-client';
import { crypto_random_uuid } from '@/lib/crypto-id';
import type {
  Policy,
  PolicyListItem,
  Premium,
  Avenant,
  Renouvellement,
  PolicyDocument,
  PolicyOperation,
  RefundPreview,
} from '@/lib/schemas/policy.schema';

interface PolicesListParams {
  status?: string[];
  branche?: string[];
  souscripteur_id?: string;
  expiring_soon?: boolean;
  expired?: boolean;
  assureur_partenaire_id?: string;
  after?: string;
  limit?: number;
  sort?: string;
}

interface PolicesListResponse {
  data: PolicyListItem[];
  next_cursor: string | null;
  total_count: number;
}

export async function getPolicesList(params: PolicesListParams, signal?: AbortSignal): Promise<PolicesListResponse> {
  const { data } = await apiClient.get('/api/v1/insure/policies', {
    params: {
      status: params.status?.join(','),
      branche: params.branche?.join(','),
      souscripteur_id: params.souscripteur_id || undefined,
      expiring_soon: params.expiring_soon || undefined,
      expired: params.expired || undefined,
      assureur_partenaire_id: params.assureur_partenaire_id || undefined,
      after: params.after,
      limit: params.limit ?? 25,
      sort: params.sort,
    },
    signal,
  });
  return data;
}

export async function getPolicy(id: string, signal?: AbortSignal): Promise<Policy> {
  const { data } = await apiClient.get(`/api/v1/insure/policies/${id}`, { signal });
  return data;
}

export async function getPolicyPremiums(id: string, signal?: AbortSignal): Promise<Premium[]> {
  const { data } = await apiClient.get(`/api/v1/insure/policies/${id}/premiums`, { signal });
  return data;
}

export async function getPolicyAvenants(id: string, signal?: AbortSignal): Promise<Avenant[]> {
  const { data } = await apiClient.get(`/api/v1/insure/policies/${id}/avenants`, { signal });
  return data;
}

export async function getPolicyRenouvellements(id: string, signal?: AbortSignal): Promise<Renouvellement[]> {
  const { data } = await apiClient.get(`/api/v1/insure/policies/${id}/renouvellements`, { signal });
  return data;
}

export async function getPolicyDocuments(id: string, signal?: AbortSignal): Promise<PolicyDocument[]> {
  const { data } = await apiClient.get(`/api/v1/insure/policies/${id}/documents`, { signal });
  return data;
}

export async function getPolicyOperations(id: string, signal?: AbortSignal): Promise<PolicyOperation[]> {
  const { data } = await apiClient.get(`/api/v1/insure/policies/${id}/operations`, { signal });
  return data;
}

export async function previewRefund(id: string, reason: string): Promise<RefundPreview> {
  const { data } = await apiClient.post(`/api/v1/insure/policies/${id}/cancel/preview`, { reason });
  return data;
}

export interface CancelPayload {
  reason: 'resiliation_volontaire' | 'non_paiement' | 'fraude_souscripteur' | 'force_majeure' | 'autre';
  reason_custom?: string;
  proof_document_id?: string;
}

export async function cancelPolicy(id: string, payload: CancelPayload, signatureToken: string): Promise<{ id: string; status: 'cancelled' }> {
  const { data } = await apiClient.post(`/api/v1/insure/policies/${id}/cancel`, payload, {
    headers: {
      'Idempotency-Key': crypto_random_uuid(),
      'X-Signature-Token': signatureToken,
    },
  });
  return data;
}

export interface SuspendPayload {
  date_start: string;
  date_end: string;
  reason: string;
}

export async function suspendPolicy(id: string, payload: SuspendPayload): Promise<{ id: string; status: 'suspended' }> {
  const { data } = await apiClient.post(`/api/v1/insure/policies/${id}/suspend`, payload, {
    headers: { 'Idempotency-Key': crypto_random_uuid() },
  });
  return data;
}

export interface TransferPayload {
  new_beneficiary_contact_id?: string;
  new_beneficiary_company_id?: string;
  reason: string;
}

export async function transferPolicy(id: string, payload: TransferPayload, signatureToken: string): Promise<{ id: string }> {
  const { data } = await apiClient.post(`/api/v1/insure/policies/${id}/transfer`, payload, {
    headers: {
      'Idempotency-Key': crypto_random_uuid(),
      'X-Signature-Token': signatureToken,
    },
  });
  return data;
}

export interface AvenantPayload {
  type: 'extension_garanties' | 'reduction_garanties' | 'changement_adresse_risque' | 'changement_vehicule' | 'changement_beneficiaire_secondaire' | 'autre';
  description: string;
  effective_date: string;
  prime_adjustment: number;
  retroactive_comment?: string;
}

export async function createAvenant(id: string, payload: AvenantPayload): Promise<Avenant> {
  const { data } = await apiClient.post(`/api/v1/insure/policies/${id}/avenants`, payload, {
    headers: { 'Idempotency-Key': crypto_random_uuid() },
  });
  return data;
}

export interface RenewalPayload {
  new_start_date: string;
  new_end_date: string;
  adjusted_prime: number;
  new_garanties?: Array<{ name: string; limite: number; franchise: number }>;
  send_email: boolean;
}

export async function proposeRenewal(id: string, payload: RenewalPayload): Promise<Renouvellement> {
  const { data } = await apiClient.post(`/api/v1/insure/policies/${id}/propose-renewal`, payload, {
    headers: { 'Idempotency-Key': crypto_random_uuid() },
  });
  return data;
}

export async function exportPolicesCSV(filters: PolicesListParams): Promise<Blob> {
  const { data } = await apiClient.get('/api/v1/insure/policies/export', {
    params: filters,
    responseType: 'blob',
  });
  return data;
}
```

### 6.12 `repo/apps/web-broker/src/lib/schemas/policy.schema.ts` (~250 lignes)

```typescript
import { z } from 'zod';
import { createSearchParamsCache, parseAsString, parseAsBoolean, parseAsArrayOf } from 'nuqs/server';

export const POLICY_STATUSES = ['draft', 'active', 'suspended', 'cancelled', 'expired'] as const;
export const PolicyStatusSchema = z.enum(POLICY_STATUSES);
export type PolicyStatus = z.infer<typeof PolicyStatusSchema>;

export const BRANCHES = ['auto', 'sante', 'habitation', 'vie', 'rc_pro', 'rc_entreprise', 'multirisque'] as const;
export const BrancheSchema = z.enum(BRANCHES);
export type Branche = z.infer<typeof BrancheSchema>;

export const GarantieSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  limite_mad: z.number().nonnegative(),
  franchise_mad: z.number().nonnegative(),
  exclusions: z.array(z.string()).default([]),
});
export type Garantie = z.infer<typeof GarantieSchema>;

export const BeneficiaireSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['contact', 'company']),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  display_name: z.string(),
  pourcentage: z.number().min(0).max(100),
  role: z.enum(['principal', 'secondaire', 'tiers']),
});
export type Beneficiaire = z.infer<typeof BeneficiaireSchema>;

export const PolicySchema = z.object({
  id: z.string().uuid(),
  policy_number: z.string().min(1),
  tenant_id: z.string().uuid(),
  souscripteur_type: z.enum(['contact', 'company']),
  souscripteur_contact_id: z.string().uuid().optional(),
  souscripteur_company_id: z.string().uuid().optional(),
  souscripteur_display_name: z.string(),
  branche: BrancheSchema,
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
  status: PolicyStatusSchema,
  prime_annuelle: z.number().positive(),
  commission_broker: z.number().nonnegative(),
  assureur_partenaire_id: z.string().uuid(),
  assureur_partenaire_name: z.string(),
  assureur_partenaire_logo_url: z.string().url().optional(),
  garanties: z.array(GarantieSchema).default([]),
  exclusions: z.array(z.string()).default([]),
  franchise: z.number().nonnegative().default(0),
  plafond: z.number().nonnegative(),
  beneficiaires: z.array(BeneficiaireSchema).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  created_by: z.string().uuid(),
}).refine((p) => new Date(p.end_date) > new Date(p.start_date), {
  message: 'end_date must be after start_date',
  path: ['end_date'],
});
export type Policy = z.infer<typeof PolicySchema>;

export const PolicyListItemSchema = PolicySchema.pick({
  id: true,
  policy_number: true,
  souscripteur_display_name: true,
  branche: true,
  start_date: true,
  end_date: true,
  status: true,
  prime_annuelle: true,
  commission_broker: true,
});
export type PolicyListItem = z.infer<typeof PolicyListItemSchema>;

export const PremiumSchema = z.object({
  id: z.string().uuid(),
  policy_id: z.string().uuid(),
  due_date: z.string().datetime(),
  amount_due: z.number().positive(),
  amount_paid: z.number().nonnegative().default(0),
  status: z.enum(['paid', 'pending', 'overdue']),
  paid_date: z.string().datetime().optional(),
  payment_method: z.enum(['cb', 'virement', 'cheque', 'cash', 'prelevement', 'cmi']),
  days_overdue: z.number().int().nonnegative().default(0),
  echeance_label: z.string().optional(),
});
export type Premium = z.infer<typeof PremiumSchema>;

export const AvenantTypeSchema = z.enum([
  'extension_garanties',
  'reduction_garanties',
  'changement_adresse_risque',
  'changement_vehicule',
  'changement_beneficiaire_secondaire',
  'autre',
]);

export const AvenantSchema = z.object({
  id: z.string().uuid(),
  policy_id: z.string().uuid(),
  type: AvenantTypeSchema,
  description: z.string().min(20),
  effective_date: z.string().datetime(),
  prime_adjustment: z.number(),
  new_prime_annuelle: z.number().positive(),
  retroactive_comment: z.string().optional(),
  signed_at: z.string().datetime().optional(),
  signed_by_user_id: z.string().uuid().optional(),
  document_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
});
export type Avenant = z.infer<typeof AvenantSchema>;

export const RenouvellementSchema = z.object({
  id: z.string().uuid(),
  policy_id: z.string().uuid(),
  status: z.enum(['draft', 'pending_customer_response', 'accepted', 'refused', 'expired']),
  proposed_at: z.string().datetime(),
  proposed_by_user_id: z.string().uuid(),
  new_start_date: z.string().datetime(),
  new_end_date: z.string().datetime(),
  adjusted_prime: z.number().positive(),
  customer_response_at: z.string().datetime().optional(),
  expires_at: z.string().datetime(),
  email_sent: z.boolean(),
  tracking_link: z.string().url().optional(),
});
export type Renouvellement = z.infer<typeof RenouvellementSchema>;

export const PolicyDocumentSchema = z.object({
  id: z.string().uuid(),
  policy_id: z.string().uuid(),
  type: z.enum(['police_pdf', 'attestation', 'endorsement', 'annexe_garantie', 'cni_souscripteur', 'preuve_force_majeure']),
  filename: z.string(),
  size_bytes: z.number().int().positive(),
  mime_type: z.string(),
  signed_url: z.string().url(),
  signed_url_expires_at: z.string().datetime(),
  uploaded_at: z.string().datetime(),
  signature_audit_id: z.string().uuid().optional(),
});
export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;

export const PolicyOperationSchema = z.object({
  id: z.string().uuid(),
  policy_id: z.string().uuid(),
  action_type: z.enum([
    'created',
    'activated',
    'cancelled',
    'suspended',
    'resumed',
    'transferred',
    'avenant_created',
    'renewal_proposed',
    'renewal_accepted',
    'renewal_refused',
    'payment_received',
    'payment_overdue',
    'status_auto_updated',
  ]),
  actor_user_id: z.string().uuid(),
  actor_display_name: z.string(),
  timestamp: z.string().datetime(),
  details: z.record(z.unknown()),
  ip_address: z.string().optional(),
  user_agent: z.string().optional(),
});
export type PolicyOperation = z.infer<typeof PolicyOperationSchema>;

export const RefundPreviewSchema = z.object({
  refund_type: z.enum(['pro_rata', 'force_majeure', 'no_refund']),
  prime_payee_total: z.number().nonnegative(),
  days_total: z.number().int().positive(),
  days_consumed: z.number().int().nonnegative(),
  days_remaining: z.number().int().nonnegative(),
  refund_gross: z.number().nonnegative(),
  management_fees_5pct: z.number().nonnegative(),
  refund_net: z.number().nonnegative(),
  legal_reference: z.string().default('Loi 17-99 article 23'),
});
export type RefundPreview = z.infer<typeof RefundPreviewSchema>;

export const CancelPolicyPayloadSchema = z.object({
  reason: z.enum(['resiliation_volontaire', 'non_paiement', 'fraude_souscripteur', 'force_majeure', 'autre']),
  reason_custom: z.string().optional(),
  proof_document_id: z.string().uuid().optional(),
});

export const SuspendPolicyPayloadSchema = z.object({
  date_start: z.string().datetime(),
  date_end: z.string().datetime(),
  reason: z.string().min(10),
}).refine((p) => new Date(p.date_end) > new Date(p.date_start), {
  message: 'date_end must be after date_start',
  path: ['date_end'],
});

export const TransferPolicyPayloadSchema = z.object({
  new_beneficiary_contact_id: z.string().uuid().optional(),
  new_beneficiary_company_id: z.string().uuid().optional(),
  reason: z.string().min(10),
}).refine((p) => Boolean(p.new_beneficiary_contact_id) !== Boolean(p.new_beneficiary_company_id), {
  message: 'exactly one of new_beneficiary_contact_id / new_beneficiary_company_id required',
});

export const NewAvenantPayloadSchema = z.object({
  type: AvenantTypeSchema,
  description: z.string().min(20).max(500),
  effective_date: z.string().datetime(),
  prime_adjustment: z.number(),
  retroactive_comment: z.string().optional(),
});

export const ProposeRenewalPayloadSchema = z.object({
  new_start_date: z.string().datetime(),
  new_end_date: z.string().datetime(),
  adjusted_prime: z.number().positive(),
  new_garanties: z.array(GarantieSchema.omit({ id: true })).optional(),
  send_email: z.boolean().default(true),
});

export const policiesSearchParamsCache = createSearchParamsCache({
  status: parseAsArrayOf(parseAsString).withDefault([]),
  branche: parseAsArrayOf(parseAsString).withDefault([]),
  souscripteur_id: parseAsString.withDefault(''),
  expiring_soon: parseAsBoolean.withDefault(false),
  expired: parseAsBoolean.withDefault(false),
  assureur_partenaire_id: parseAsString.withDefault(''),
  cursor: parseAsString,
  tab: parseAsString.withDefault('info'),
});
```

### 6.13 `repo/apps/web-broker/src/lib/utils/pro-rata-calculator.ts` (~80 lignes)

```typescript
import { differenceInDays } from 'date-fns';

export type RefundType = 'pro_rata' | 'force_majeure' | 'no_refund';

export interface ProRataResult {
  days_total: number;
  days_consumed: number;
  days_remaining: number;
  refund_gross: number;
  management_fees_5pct: number;
  refund_net: number;
  refund_type: RefundType;
}

/**
 * Compute pro-rata refund preview client-side (DISPLAY ONLY).
 * Source of truth = backend Sprint 15 CancelPolicyService.previewRefund().
 * Loi 17-99 article 23 -- code des assurances Maroc.
 *
 * Rules:
 * - resiliation_volontaire / autre -> pro-rata standard refund = (prime_annuelle * days_remaining/days_total) - 5% management fees
 * - non_paiement -> NO REFUND (article 21 -- assure defaillant)
 * - fraude_souscripteur -> NO REFUND (article 22 -- police nulle ab initio)
 * - force_majeure -> FULL REFUND 100% (article 24 -- evenement force majeure documente)
 */
export function computeProRataRefund(
  primeAnnuelle: number,
  startDate: Date,
  endDate: Date,
  cancelDate: Date,
  reason: string,
): ProRataResult {
  const days_total = Math.max(1, differenceInDays(endDate, startDate));
  const days_consumed = Math.max(0, Math.min(days_total, differenceInDays(cancelDate, startDate)));
  const days_remaining = Math.max(0, days_total - days_consumed);

  if (reason === 'non_paiement' || reason === 'fraude_souscripteur') {
    return {
      days_total,
      days_consumed,
      days_remaining,
      refund_gross: 0,
      management_fees_5pct: 0,
      refund_net: 0,
      refund_type: 'no_refund',
    };
  }

  if (reason === 'force_majeure') {
    return {
      days_total,
      days_consumed,
      days_remaining,
      refund_gross: primeAnnuelle,
      management_fees_5pct: 0,
      refund_net: primeAnnuelle,
      refund_type: 'force_majeure',
    };
  }

  const refund_gross = (primeAnnuelle * days_remaining) / days_total;
  const management_fees_5pct = refund_gross * 0.05;
  const refund_net = Math.max(0, refund_gross - management_fees_5pct);

  return {
    days_total,
    days_consumed,
    days_remaining,
    refund_gross: roundMAD(refund_gross),
    management_fees_5pct: roundMAD(management_fees_5pct),
    refund_net: roundMAD(refund_net),
    refund_type: 'pro_rata',
  };
}

/** Round to 2 decimals (BAM convention). */
function roundMAD(value: number): number {
  return Math.round(value * 100) / 100;
}
```

### 6.14 `repo/apps/web-broker/src/lib/formatters/policy-formatters.ts` (~150 lignes)

```typescript
import { formatInTimeZone } from 'date-fns-tz';
import { fr, ar } from 'date-fns/locale';
import { differenceInDays, parseISO } from 'date-fns';
import type { PolicyStatus, Branche } from '@/lib/schemas/policy.schema';

const CASABLANCA_TZ = 'Africa/Casablanca';

export function formatMAD(amount: number, locale: string): string {
  const intlLocale = mapLocaleToIntl(locale);
  return new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function mapLocaleToIntl(locale: string): string {
  if (locale === 'ar-MA' || locale === 'ar') return 'ar-MA';
  return 'fr-MA';
}

function mapLocaleToDateFns(locale: string) {
  if (locale === 'ar-MA' || locale === 'ar') return ar;
  return fr;
}

export function formatPolicyDates(dateInput: string | Date, locale: string): string {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  return formatInTimeZone(date, CASABLANCA_TZ, 'PPP', { locale: mapLocaleToDateFns(locale) });
}

export function formatPolicyDateTime(dateInput: string | Date, locale: string): string {
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  return formatInTimeZone(date, CASABLANCA_TZ, 'PPPp', { locale: mapLocaleToDateFns(locale) });
}

export function getDaysUntilExpiry(endDate: string | Date): number | null {
  try {
    const date = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    return differenceInDays(date, new Date());
  } catch {
    return null;
  }
}

export interface StatusBadgeStyle {
  variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'success' | 'warning';
  className: string;
  iconName: 'CheckCircle2' | 'PauseCircle' | 'XCircle' | 'Clock' | 'Ban' | 'AlertCircle';
}

export function getPolicyStatusStyle(status: PolicyStatus): StatusBadgeStyle {
  switch (status) {
    case 'active':
      return {
        variant: 'success',
        className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
        iconName: 'CheckCircle2',
      };
    case 'draft':
      return {
        variant: 'secondary',
        className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
        iconName: 'Clock',
      };
    case 'suspended':
      return {
        variant: 'warning',
        className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
        iconName: 'PauseCircle',
      };
    case 'cancelled':
      return {
        variant: 'destructive',
        className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        iconName: 'Ban',
      };
    case 'expired':
      return {
        variant: 'outline',
        className: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
        iconName: 'AlertCircle',
      };
  }
}

export function getBrancheIconName(branche: Branche): string {
  switch (branche) {
    case 'auto': return 'Car';
    case 'sante': return 'Heart';
    case 'habitation': return 'Home';
    case 'vie': return 'Users';
    case 'rc_pro': return 'Briefcase';
    case 'rc_entreprise': return 'Building2';
    case 'multirisque': return 'Shield';
  }
}

export function isPolicyExpiringSoon(endDate: string | Date, thresholdDays = 60): boolean {
  const days = getDaysUntilExpiry(endDate);
  return days !== null && days >= 0 && days <= thresholdDays;
}

export function isPolicyExpired(endDate: string | Date): boolean {
  const days = getDaysUntilExpiry(endDate);
  return days !== null && days < 0;
}
```

---

## 7. Tests Vitest unitaires (~18 tests)

### 7.1 `src/__tests__/polices/pro-rata-calculator.spec.ts` (6 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { computeProRataRefund } from '@/lib/utils/pro-rata-calculator';

describe('computeProRataRefund', () => {
  const startDate = new Date('2026-01-01T00:00:00+01:00');
  const endDate = new Date('2026-12-31T23:59:59+01:00');

  it('computes standard pro-rata refund mid-year', () => {
    const cancelDate = new Date('2026-07-01T00:00:00+01:00');
    const result = computeProRataRefund(12000, startDate, endDate, cancelDate, 'resiliation_volontaire');
    expect(result.refund_type).toBe('pro_rata');
    expect(result.days_consumed).toBeGreaterThanOrEqual(180);
    expect(result.days_consumed).toBeLessThanOrEqual(182);
    expect(result.refund_gross).toBeGreaterThan(5900);
    expect(result.refund_gross).toBeLessThan(6100);
    expect(result.management_fees_5pct).toBeCloseTo(result.refund_gross * 0.05, 1);
    expect(result.refund_net).toBeCloseTo(result.refund_gross - result.management_fees_5pct, 1);
  });

  it('returns force_majeure 100% refund regardless of date', () => {
    const cancelDate = new Date('2026-11-30T00:00:00+01:00');
    const result = computeProRataRefund(12000, startDate, endDate, cancelDate, 'force_majeure');
    expect(result.refund_type).toBe('force_majeure');
    expect(result.refund_gross).toBe(12000);
    expect(result.management_fees_5pct).toBe(0);
    expect(result.refund_net).toBe(12000);
  });

  it('returns no_refund for non_paiement (article 21)', () => {
    const cancelDate = new Date('2026-03-15T00:00:00+01:00');
    const result = computeProRataRefund(12000, startDate, endDate, cancelDate, 'non_paiement');
    expect(result.refund_type).toBe('no_refund');
    expect(result.refund_net).toBe(0);
  });

  it('returns no_refund for fraude_souscripteur (article 22)', () => {
    const cancelDate = new Date('2026-05-15T00:00:00+01:00');
    const result = computeProRataRefund(15000, startDate, endDate, cancelDate, 'fraude_souscripteur');
    expect(result.refund_type).toBe('no_refund');
    expect(result.refund_net).toBe(0);
  });

  it('handles edge case <1 day remaining (cancel on day before end)', () => {
    const cancelDate = new Date('2026-12-31T00:00:00+01:00');
    const result = computeProRataRefund(12000, startDate, endDate, cancelDate, 'resiliation_volontaire');
    expect(result.days_remaining).toBeLessThanOrEqual(1);
    expect(result.refund_net).toBeLessThan(50);
  });

  it('handles full year consumed (cancel exactly at end_date)', () => {
    const cancelDate = endDate;
    const result = computeProRataRefund(12000, startDate, endDate, cancelDate, 'resiliation_volontaire');
    expect(result.days_remaining).toBe(0);
    expect(result.refund_gross).toBe(0);
    expect(result.refund_net).toBe(0);
  });
});
```

### 7.2 `src/__tests__/polices/policy.schema.spec.ts` (5 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { PolicySchema, SuspendPolicyPayloadSchema, NewAvenantPayloadSchema, TransferPolicyPayloadSchema } from '@/lib/schemas/policy.schema';

describe('PolicySchema', () => {
  const validPolicy = {
    id: '00000000-0000-0000-0000-000000000001',
    policy_number: 'POL-2026-00001',
    tenant_id: '00000000-0000-0000-0000-000000000002',
    souscripteur_type: 'contact' as const,
    souscripteur_contact_id: '00000000-0000-0000-0000-000000000003',
    souscripteur_display_name: 'Jean Dupont',
    branche: 'auto' as const,
    start_date: '2026-01-01T00:00:00.000Z',
    end_date: '2026-12-31T23:59:59.000Z',
    status: 'active' as const,
    prime_annuelle: 12000,
    commission_broker: 1200,
    assureur_partenaire_id: '00000000-0000-0000-0000-000000000004',
    assureur_partenaire_name: 'Wafa Assurance',
    plafond: 100000,
    created_at: '2025-12-01T00:00:00.000Z',
    updated_at: '2025-12-01T00:00:00.000Z',
    created_by: '00000000-0000-0000-0000-000000000005',
  };

  it('parses a valid policy object', () => {
    const result = PolicySchema.safeParse(validPolicy);
    expect(result.success).toBe(true);
  });

  it('rejects invalid status enum', () => {
    const result = PolicySchema.safeParse({ ...validPolicy, status: 'foo' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid branche enum', () => {
    const result = PolicySchema.safeParse({ ...validPolicy, branche: 'crypto' });
    expect(result.success).toBe(false);
  });

  it('rejects negative prime_annuelle', () => {
    const result = PolicySchema.safeParse({ ...validPolicy, prime_annuelle: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects end_date before start_date', () => {
    const result = PolicySchema.safeParse({
      ...validPolicy,
      start_date: '2026-12-31T00:00:00.000Z',
      end_date: '2026-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('SuspendPolicyPayloadSchema', () => {
  it('rejects date_end <= date_start', () => {
    const result = SuspendPolicyPayloadSchema.safeParse({
      date_start: '2026-06-01T00:00:00.000Z',
      date_end: '2026-05-01T00:00:00.000Z',
      reason: 'Maladie longue duree assure',
    });
    expect(result.success).toBe(false);
  });
});

describe('TransferPolicyPayloadSchema', () => {
  it('rejects when both contact_id and company_id provided', () => {
    const result = TransferPolicyPayloadSchema.safeParse({
      new_beneficiary_contact_id: '00000000-0000-0000-0000-000000000001',
      new_beneficiary_company_id: '00000000-0000-0000-0000-000000000002',
      reason: 'Restructuration legale',
    });
    expect(result.success).toBe(false);
  });
});
```

### 7.3 `src/__tests__/polices/policy-formatters.spec.ts` (4 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { formatMAD, formatPolicyDates, getDaysUntilExpiry, getPolicyStatusStyle } from '@/lib/formatters/policy-formatters';

describe('formatMAD', () => {
  it('formats MAD currency in fr-MA locale', () => {
    const out = formatMAD(12500.5, 'fr');
    expect(out).toContain('12');
    expect(out).toMatch(/MAD/);
  });

  it('formats MAD currency in ar-MA locale', () => {
    const out = formatMAD(12500.5, 'ar-MA');
    expect(out).toBeTruthy();
  });
});

describe('getPolicyStatusStyle', () => {
  it('returns success variant for active', () => {
    const style = getPolicyStatusStyle('active');
    expect(style.variant).toBe('success');
    expect(style.className).toContain('green');
    expect(style.iconName).toBe('CheckCircle2');
  });
});

describe('getDaysUntilExpiry edge cases', () => {
  it('returns negative number for expired policy', () => {
    const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const days = getDaysUntilExpiry(pastDate.toISOString());
    expect(days).toBeLessThan(0);
  });

  it('returns null for invalid date', () => {
    const days = getDaysUntilExpiry('not-a-date');
    expect(days).toBeNull();
  });
});
```

### 7.4 `src/__tests__/polices/polices-table.spec.tsx` (3 tests)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { PolicesTable } from '@/components/polices/polices-table';
import { messages } from '@/test/fixtures/messages';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const renderWithProviders = (ui: React.ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="fr" messages={messages.fr} timeZone="Africa/Casablanca">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
};

const fixture = {
  data: [
    {
      id: '1',
      policy_number: 'POL-2026-00001',
      souscripteur_display_name: 'Jean Dupont',
      branche: 'auto' as const,
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T23:59:59.000Z',
      status: 'active' as const,
      prime_annuelle: 12000,
      commission_broker: 1200,
    },
  ],
  next_cursor: null,
  total_count: 1,
};

describe('PolicesTable', () => {
  it('renders columns headers', () => {
    renderWithProviders(<PolicesTable initialData={fixture} locale="fr" />);
    expect(screen.getByText(/POL-2026-00001/i)).toBeInTheDocument();
    expect(screen.getByText('Jean Dupont')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    renderWithProviders(<PolicesTable initialData={{ data: [], next_cursor: null, total_count: 0 }} locale="fr" />);
    expect(screen.getByText(/aucune police/i)).toBeInTheDocument();
  });

  it('disables load_more when no next_cursor', () => {
    renderWithProviders(<PolicesTable initialData={fixture} locale="fr" />);
    const button = screen.getByRole('button', { name: /charger plus|load more/i });
    expect(button).toBeDisabled();
  });
});
```

---

## 8. Tests Playwright E2E (~12 tests)

### 8.1 `e2e/polices/polices-list.spec.ts` (4 tests)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBrokerAdmin } from '../fixtures/auth-helpers';
import { seedTestPolices } from '../fixtures/test-tenant-setup';

test.describe('Polices List Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBrokerAdmin(page);
    await seedTestPolices(page, { count: 15 });
  });

  test('renders DataTable with policies', async ({ page }) => {
    await page.goto('/fr/polices');
    await expect(page.getByRole('heading', { name: /polices/i })).toBeVisible();
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(15);
  });

  test('filters by status active', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.getByLabel(/statut/i).click();
    await page.getByRole('option', { name: /active/i }).click();
    await expect(page).toHaveURL(/status=active/);
    const activeBadges = page.locator('[data-status="active"]');
    await expect(activeBadges.first()).toBeVisible();
  });

  test('filters by expiring_soon switch', async ({ page }) => {
    await page.goto('/fr/polices');
    await page.getByLabel(/expire bientot/i).click();
    await expect(page).toHaveURL(/expiring_soon=true/);
  });

  test('exports CSV via filters', async ({ page }) => {
    await page.goto('/fr/polices');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /exporter csv/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/polices_\d{4}-\d{2}-\d{2}\.csv/);
  });
});
```

### 8.2 `e2e/polices/polices-detail.spec.ts` (3 tests)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBrokerAdmin } from '../fixtures/auth-helpers';
import { seedTestPolicy } from '../fixtures/policy-fixtures';

test.describe('Policy Detail Page', () => {
  let policyId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsBrokerAdmin(page);
    policyId = await seedTestPolicy(page);
  });

  test('navigates tabs and renders Info, Premiums, Avenants', async ({ page }) => {
    await page.goto(`/fr/polices/${policyId}`);
    await expect(page.getByRole('tab', { name: /info/i })).toHaveAttribute('data-state', 'active');

    await page.getByRole('tab', { name: /premiums|echeances/i }).click();
    await expect(page).toHaveURL(/tab=premiums/);
    await expect(page.getByRole('cell', { name: /\d+ \w+ 2026/ }).first()).toBeVisible();

    await page.getByRole('tab', { name: /avenants/i }).click();
    await expect(page).toHaveURL(/tab=avenants/);
  });

  test('displays garanties list in Info tab', async ({ page }) => {
    await page.goto(`/fr/polices/${policyId}?tab=info`);
    await expect(page.getByText(/garanties souscrites/i)).toBeVisible();
    await expect(page.locator('[data-test="garantie-item"]').first()).toBeVisible();
  });

  test('shows initiate payment button for pending premium', async ({ page }) => {
    await page.goto(`/fr/polices/${policyId}?tab=premiums`);
    const initButton = page.getByRole('button', { name: /initier paiement/i }).first();
    await expect(initButton).toBeVisible();
  });
});
```

### 8.3 `e2e/polices/cancel-policy.spec.ts` (2 tests)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBrokerAdmin } from '../fixtures/auth-helpers';
import { seedTestPolicy } from '../fixtures/policy-fixtures';
import { mockAnrtTsaSignature } from '../fixtures/anrt-tsa-mock';

test.describe('Cancel Policy Dialog', () => {
  let policyId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsBrokerAdmin(page);
    policyId = await seedTestPolicy(page);
    await mockAnrtTsaSignature(page);
  });

  test('cancels with pro-rata refund standard', async ({ page }) => {
    await page.goto(`/fr/polices/${policyId}`);
    await page.getByRole('button', { name: /annuler la police|cancel/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/motif/i).click();
    await page.getByRole('option', { name: /resiliation volontaire/i }).click();

    await expect(dialog.getByText(/calcul du remboursement|refund/i)).toBeVisible();
    await expect(dialog.getByText(/jours restants|days_remaining/i)).toBeVisible();

    await dialog.getByRole('button', { name: /signer/i }).click();
    await dialog.getByText(/signature valide/i).waitFor();

    await dialog.getByLabel(/je confirme/i).check();
    await dialog.getByRole('button', { name: /confirmer la resiliation/i }).click();

    await expect(page.getByText(/police annulee avec succes/i)).toBeVisible();
    await expect(page.locator('[data-status="cancelled"]')).toBeVisible();
  });

  test('cancels with force_majeure 100% refund', async ({ page }) => {
    await page.goto(`/fr/polices/${policyId}`);
    await page.getByRole('button', { name: /annuler la police/i }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/motif/i).click();
    await page.getByRole('option', { name: /force majeure/i }).click();

    await expect(dialog.getByText(/remboursement integral garanti/i)).toBeVisible();
    await expect(dialog.getByLabel(/preuve documentaire/i)).toBeVisible();

    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'preuve.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('mock pdf content'),
    });
    await dialog.getByText(/upload reussi/i).waitFor();

    await dialog.getByRole('button', { name: /signer/i }).click();
    await dialog.getByLabel(/je confirme/i).check();
    await dialog.getByRole('button', { name: /confirmer/i }).click();

    await expect(page.getByText(/police annulee/i)).toBeVisible();
  });
});
```

### 8.4 `e2e/polices/suspend-transfer.spec.ts` (2 tests)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBrokerAdmin } from '../fixtures/auth-helpers';
import { seedTestPolicy } from '../fixtures/policy-fixtures';
import { mockAnrtTsaSignature } from '../fixtures/anrt-tsa-mock';

test('suspends policy with valid date range', async ({ page }) => {
  await loginAsBrokerAdmin(page);
  const policyId = await seedTestPolicy(page);
  await page.goto(`/fr/polices/${policyId}`);
  await page.getByRole('button', { name: /suspendre/i }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/date debut/i).fill('2026-06-01');
  await dialog.getByLabel(/date fin/i).fill('2026-08-31');
  await dialog.getByLabel(/motif/i).fill('Voyage prolonge assure 90 jours hors MA');
  await expect(dialog.getByText(/echeances seront suspendues/i)).toBeVisible();

  await dialog.getByRole('button', { name: /suspendre/i }).click();
  await expect(page.getByText(/suspension activee/i)).toBeVisible();
});

test('transfers policy to selected contact', async ({ page }) => {
  await loginAsBrokerAdmin(page);
  const policyId = await seedTestPolicy(page);
  await mockAnrtTsaSignature(page);

  await page.goto(`/fr/polices/${policyId}`);
  await page.getByRole('button', { name: /transferer/i }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(/nouveau beneficiaire/i).click();
  await page.getByRole('option', { name: /fatima alaoui/i }).click();
  await dialog.getByLabel(/motif/i).fill('Cession a heritier suite deces');

  await dialog.getByRole('button', { name: /signer/i }).click();
  await dialog.getByRole('button', { name: /transferer/i }).click();
  await expect(page.getByText(/transfert effectue/i)).toBeVisible();
});
```

### 8.5 `e2e/polices/avenant-renewal.spec.ts` (1 test)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBrokerAdmin } from '../fixtures/auth-helpers';
import { seedTestPolicy } from '../fixtures/policy-fixtures';

test('creates avenant then proposes renewal', async ({ page }) => {
  await loginAsBrokerAdmin(page);
  const policyId = await seedTestPolicy(page, { end_date_offset_days: 45 });

  await page.goto(`/fr/polices/${policyId}`);
  await page.getByRole('button', { name: /nouvel avenant/i }).click();

  const avenantDialog = page.getByRole('dialog');
  await avenantDialog.getByLabel(/type/i).click();
  await page.getByRole('option', { name: /extension garanties/i }).click();
  await avenantDialog.getByLabel(/description/i).fill('Ajout garantie bris de glace tous risques');
  await avenantDialog.getByLabel(/ajustement prime/i).fill('500');

  await expect(avenantDialog.getByText(/nouvelle prime/i)).toBeVisible();
  await avenantDialog.getByRole('button', { name: /creer avenant/i }).click();
  await expect(page.getByText(/avenant cree/i)).toBeVisible();

  await page.getByRole('tab', { name: /renouvellements/i }).click();
  await page.getByRole('button', { name: /proposer renouvellement/i }).click();

  const renewalDialog = page.getByRole('dialog');
  await renewalDialog.getByLabel(/prime ajustee/i).fill('13000');
  await renewalDialog.getByLabel(/envoyer email/i).check();
  await renewalDialog.getByRole('button', { name: /envoyer la proposition/i }).click();

  await expect(page.getByText(/proposition envoyee/i)).toBeVisible();
});
```

---

## 9. Criteres de validation V1-V28

### Criteres P0 obligatoires (16)

**V1 (P0) -- App demarre + route /polices accessible**
- Commande : `pnpm --filter @insurtech/web-broker dev` puis `curl -I http://localhost:3001/fr/polices -H "Cookie: access_token=...; current_tenant_id=..."`
- Expected : HTTP 200 + Content-Type `text/html` + body contient `<h1>Polices</h1>`
- Failure mode : middleware redirect /login si pas auth, 404 si route absente

**V2 (P0) -- DataTable render 25 lignes initial fetch**
- Commande : `pnpm --filter @insurtech/web-broker test:e2e -- polices-list.spec.ts -g "renders DataTable"`
- Expected : 15 lignes table affichees, columns sortables, pagination "Charger plus" visible
- Failure mode : API call fail, columns header missing, infinite spinner

**V3 (P0) -- Filters nuqs URL state apply**
- Commande : test E2E `filters by status active`
- Expected : URL contient `?status=active`, only active policies visible
- Failure mode : URL pas mise a jour, filter not applied API call

**V4 (P0) -- Filter expiring_soon <60j fonctionne**
- Commande : test E2E `filters by expiring_soon`
- Expected : URL `?expiring_soon=true`, polices avec end_date < J+60 only
- Failure mode : tous polices restent affichees

**V5 (P0) -- Export CSV download**
- Commande : test E2E `exports CSV`
- Expected : download file `polices_YYYY-MM-DD.csv` mime type `text/csv`
- Failure mode : button disabled, no download triggered

**V6 (P0) -- Page detail render policy_number header**
- Commande : E2E `polices-detail.spec.ts -g "navigates tabs"`
- Expected : header card affiche `POL-2026-00001`, status badge couleur correcte
- Failure mode : 404, header card vide

**V7 (P0) -- Tabs nuqs URL state per tab**
- Commande : E2E `navigates tabs and renders Info, Premiums, Avenants`
- Expected : URL evolue `?tab=info`, `?tab=premiums`, `?tab=avenants`
- Failure mode : URL ne change pas, tabs ne switch pas

**V8 (P0) -- Premiums echeancier table affiche 12 lignes echeances**
- Commande : E2E `polices-detail.spec.ts -g "shows initiate payment"`
- Expected : Table avec colonnes due_date / amount_due / status / actions, bouton "Initier paiement" visible pour pending
- Failure mode : table vide, button absent

**V9 (P0) -- CancelPolicyDialog preview pro-rata refund**
- Commande : E2E `cancel-policy.spec.ts -g "cancels with pro-rata"`
- Expected : Dialog ouvre + reason dropdown + preview API call + display refund breakdown skeleton -> data
- Failure mode : dialog ne s'ouvre pas, preview API stuck loading, refund_net incorrect

**V10 (P0) -- CancelPolicyDialog force_majeure 100% refund**
- Commande : E2E `cancel-policy.spec.ts -g "cancels with force_majeure 100%"`
- Expected : refund_type=force_majeure, refund_net=prime_annuelle, upload preuve obligatoire
- Failure mode : refund pas 100%, upload optionnel

**V11 (P0) -- SuspendPolicyDialog dates validation**
- Commande : E2E `suspends policy with valid date range`
- Expected : dialog ouvre + dates DatePicker + impact "X echeances suspendues Y MAD" + submit success
- Failure mode : dates invalides acceptees, impact pas calcule

**V12 (P0) -- TransferPolicyDialog contact selector + signature**
- Commande : E2E `transfers policy to selected contact`
- Expected : combobox autocomplete contacts tenant + signature ANRT TSA + submit success
- Failure mode : contacts cross-tenant visibles, signature non bloquante

**V13 (P0) -- NewAvenantDialog prime adjustment preview live**
- Commande : E2E `creates avenant then proposes renewal`
- Expected : prime_adjustment input -> preview "Nouvelle prime: X -> Y (+Z%)" live + warning si >50%
- Failure mode : preview pas live, > 50% accepte

**V14 (P0) -- ProposeRenewalDialog email send**
- Commande : E2E test renewal flow
- Expected : dialog avec adjusted_prime + send_email checkbox + submit -> toast "Proposition envoyee"
- Failure mode : email pas envoye, dialog stuck

**V15 (P0) -- Idempotency-Key header sur toutes mutations**
- Commande : DevTools Network tab inspect POST /cancel /suspend /transfer /avenants /propose-renewal
- Expected : Header `Idempotency-Key: <uuid>` present sur chaque request
- Failure mode : header missing -> retry duplicate cancel/transfer

**V16 (P0) -- Tests Vitest + Playwright 30+ tests pass**
- Commande : `pnpm --filter @insurtech/web-broker test && pnpm --filter @insurtech/web-broker test:e2e`
- Expected : Vitest 18+ tests pass + Playwright 12+ tests pass, 0 fail
- Failure mode : >0 test fail, CI red

### Criteres P1 souhaitables (7)

**V17 (P1) -- Lazy load tabs non-Info Suspense skeleton**
- Commande : Lighthouse Performance run + DevTools Coverage tab
- Expected : Premiums tab JS chunk separate, only loaded on click
- Failure mode : tous tabs charges initial = bundle bloated

**V18 (P1) -- ANRT TSA signature pad render + token expiry 15min**
- Commande : E2E test cancel flow + wait 16 min + retry submit
- Expected : signature_token expired -> dialog auto-refresh signature
- Failure mode : expired token accepted -> 401 backend

**V19 (P1) -- RTL ar-MA polices page render correctement**
- Commande : navigation `/ar-MA/polices` + Lighthouse a11y
- Expected : `dir="rtl"` sur html, icons + buttons mirror, status badges aligned right
- Failure mode : layout casse RTL, margins LTR persists

**V20 (P1) -- Recharts area chart premiums cumul paye/du**
- Commande : visual inspection Premiums tab
- Expected : chart 12 mois avec area paid + area due, tooltip MAD formatte
- Failure mode : chart pas render, data wrong, MAD pas formatte

**V21 (P1) -- Documents tab signed URL Atlas Cloud iframe**
- Commande : E2E click document download
- Expected : iframe ou redirect signed URL `s3.bgr.atlascloudservices.ma` valid 1h
- Failure mode : URL expired, AWS domain (non-conforme decision-008)

**V22 (P1) -- Operations tab audit timeline filter par action_type**
- Commande : E2E filter operations cancel only
- Expected : timeline filtree, count visible, dates Africa/Casablanca formatees
- Failure mode : filter pas applique, dates UTC raw

**V23 (P1) -- Currency MAD format 2 decimales fr-MA + ar-MA**
- Commande : Vitest formatters test `formatMAD`
- Expected : fr-MA `12 500,50 MAD` / ar-MA `12,500.50 د.م.`
- Failure mode : decimales manquantes, separateurs incorrects

### Criteres P2 nice-to-have (5)

**V24 (P2) -- Lighthouse Performance >= 70 / a11y >= 95**
- Commande : `pnpm lh /fr/polices`
- Expected : Performance >= 70, Accessibility >= 95, Best Practices >= 90, SEO >= 80
- Failure mode : scores < seuils

**V25 (P2) -- Prefetch tabs on hover**
- Commande : DevTools Network + hover tab non-actif
- Expected : JS chunk preload starts on hover
- Failure mode : chunk load only on click = delay

**V26 (P2) -- Pro-rata calculator client utilise debug DevTools**
- Commande : import `computeProRataRefund` console + verify preview matches backend
- Expected : difference < 0.01 MAD vs backend response
- Failure mode : divergence > 1 MAD

**V27 (P2) -- WCAG 2.1 AA axe-core 0 violations critical**
- Commande : E2E test `await injectAxe(page); const violations = await getViolations(page);`
- Expected : 0 violations critical/serious
- Failure mode : color contrast fail, ARIA labels missing

**V28 (P2) -- Bundle size polices page chunk < 80 KB gzipped**
- Commande : `pnpm build && next-bundle-analyzer`
- Expected : polices page initial chunk < 80 KB gzipped
- Failure mode : > 80 KB = perf degradee

---

## 10. Edge cases (12 minimum)

**EC1 -- Police draft sans premium**
- Cas : police creee en `status='draft'` n'a pas encore echeancier (genere a activation).
- Comportement : Premiums tab affiche empty state "Aucune echeance -- la police doit etre activee" + bouton "Activer la police".
- Verification : E2E seed policy draft, check empty state.

**EC2 -- Premium overdue display rouge**
- Cas : premium status='overdue' + days_overdue=15.
- Comportement : badge rouge "En retard 15j" sans animation pulse (WCAG accessibility), bouton "Initier paiement" rouge variant=destructive.
- Verification : Vitest snapshot + Playwright visual regression.

**EC3 -- Avenant retroactif date < today**
- Cas : NewAvenantDialog effective_date = aujourd'hui - 30j.
- Comportement : warning visuel orange "Avenant retroactif -- impact comptable" + champ retroactive_comment obligatoire min 10 chars + max 90j retroactivite (>90j Submit disabled).
- Verification : Vitest schema refine + E2E test.

**EC4 -- Transfer to contact same tenant**
- Cas : user selectionne contact via autocomplete -- contact.tenant_id === currentTenantId.
- Comportement : submit success + audit trail `transferred` + email new beneficiaire.
- Verification : E2E happy path.

**EC5 -- Transfer cross-tenant interdit**
- Cas : autocomplete API leak contact d'autre tenant (bug Sprint 6 theoretique).
- Comportement : frontend defense profondeur revalide `contact.tenant_id === currentTenantId` avant submit, sinon toast error "Transfer cross-tenant interdit".
- Verification : Vitest unit test client-side validation.

**EC6 -- Suspension date overlap existante**
- Cas : police a deja suspension active 01/03 - 30/03, user tente nouvelle suspension 15/03 - 15/04.
- Comportement : backend Sprint 15 rejette 409 Conflict, frontend toast error "Suspension chevauche periode existante 01/03 - 30/03".
- Verification : E2E test backend 409 -> toast.

**EC7 -- Renouvellement proposal expired 60j post-echeance**
- Cas : police end_date il y a 70j, user tente bouton "Proposer renouvellement".
- Comportement : bouton disabled + tooltip "Renouvellement expire -- creer nouvelle souscription via Quote Builder".
- Verification : E2E test seed expired policy.

**EC8 -- Signature ANRT TSA fails network**
- Cas : SDK ANRT timeout 30s.
- Comportement : retry button + toast error "Service signature indisponible -- reessayer dans 1 minute" + dialog conserve state.
- Verification : Playwright mock network failure + E2E test.

**EC9 -- Expired status auto-update via cron daily**
- Cas : police end_date = hier (Africa/Casablanca), cron pas encore tourne 00:01.
- Comportement : frontend affiche status='active' (DB stale) + warning visuel "Echeance depassee -- mise a jour en cours". invalidateQueries refresh.
- Verification : Vitest test + manual cron timing.

**EC10 -- Force majeure refund 100% sans preuve**
- Cas : user select force_majeure mais skip upload preuve documentaire.
- Comportement : submit disabled + message "Document preuve obligatoire pour force majeure".
- Verification : E2E test seed without doc + assert disabled.

**EC11 -- Pro-rata < 1 jour remaining**
- Cas : cancel le jour de l'echeance (days_remaining = 0).
- Comportement : refund_net = 0 MAD + display "Police arrive a echeance -- aucun remboursement applicable".
- Verification : Vitest unit test edge case.

**EC12 -- Currency MAD format ar locale right-to-left**
- Cas : user locale `ar` affiche montant 12500.50.
- Comportement : `12,500.50 درهم مغربي` avec chiffres arabes-indiens optionnels (Intl) + alignement RTL natif.
- Verification : Vitest formatter test + Playwright visual RTL.

---

## 11. Conformite Maroc (compliance MA)

### 11.1 Loi 17-99 code des assurances MA

**Article 21** -- Non-paiement de prime : assure defaillant -> NO REFUND a la resiliation. Frontend display alert destructive "Aucun remboursement applicable -- defaut de paiement (article 21)". Backend Sprint 15 valide source of truth.

**Article 22** -- Fraude souscripteur : police nulle ab initio -> NO REFUND. Frontend display alert destructive "Police annulee pour fraude -- aucun remboursement (article 22)".

**Article 23** -- Resiliation volontaire : pro-rata refund = `prime_annuelle * (days_remaining / days_total) - management_fees_5pct`. Backend authoritative. Frontend preview display `legal_reference: 'Loi 17-99 article 23'`.

**Article 24** -- Force majeure : remboursement integral 100% si preuve documentaire fournie (certificat deces, acte notarie catastrophe, decision judiciaire). Frontend impose upload document avant submit. Backend Sprint 15 valide signature notaire / officier etat civil.

**Article 27** -- Avenants modification garanties : effective_date obligatoire + signature + notification assureur partenaire 5j avant. Frontend NewAvenantDialog impose description min 20 chars + valid date range + max 90j retroactivite.

**Article 35** -- Renouvellement automatique vs proposition explicite : Skalean choisit proposition explicite (60j avant echeance) pour transparence client. Frontend ProposeRenewalDialog dispo J-60 J+30 window.

### 11.2 Loi 43-20 signature electronique

**Article 6** -- Signature electronique avancee qualifiee requise pour resiliation + transfert beneficiaire. Frontend impose signature ANRT TSA via SDK natif `@anrt/tsa-sdk` 2.1.x. Token horodatage TSA valide 15min (article 8).

**Article 8** -- Horodatage strict TSA. Frontend affiche compteur "Signature valide 15:00" + auto-refresh si user revient apres 10min.

### 11.3 Loi 09-08 CNDP (donnees personnelles)

**Article 38** -- Traceabilite actions sur donnees personnelles assures. Operations tab audit trail timeline complete : timestamp Africa/Casablanca + actor user + action_type + ip_address + user_agent. Conservation 5 ans (article 14).

**Beneficiaires PII** -- liste beneficiaires (contacts + companies) traitee comme donnees sensibles : pas d'export bulk sans audit + droit acces / rectification / suppression (articles 9, 10, 12).

### 11.4 ACAPS reporting

**Operations declarees mensuelles** -- cancellations + transfers + suspensions doivent etre exportees rapport ACAPS XML mensuel (Sprint 31 reporting -- hors scope cette tache). Frontend assure audit trail Operations tab consultable pour audits ACAPS surprise.

### 11.5 Africa/Casablanca timezone

**Dates contractuelles** -- start_date, end_date, due_date premiums, effective_date avenants interpretees Africa/Casablanca. Frontend utilise `formatInTimeZone(date, 'Africa/Casablanca', ...)` systematique via `policy-formatters.ts`. DST handled by date-fns-tz IANA TZ database.

### 11.6 MAD currency Intl

**Bank Al-Maghrib BAM** -- 2 decimales obligatoires. `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', minimumFractionDigits: 2, maximumFractionDigits: 2 })`. Pas de fractions <0.01 MAD.

---

## 12. Conventions code (20+ conventions Skalean)

1. **NO EMOJI ABSOLU** (decision-006) -- zero emoji dans code, JSON messages, UI labels, commit. Linter `scripts/check-no-emoji.sh` CI bloquant.

2. **TypeScript strict mode** -- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true`. Zero `any` non-justifie.

3. **Composants client** -- directive `'use client'` premiere ligne quand interactivite necessaire. Server Components par defaut sinon.

4. **Imports tries** -- ESLint `import/order` enforce ordre : builtin -> external -> internal -> parent -> sibling -> index. Alphabetique intra-groupe.

5. **Path alias `@/*`** -- `@/components/...`, `@/lib/...`, `@/messages/...`. Pas de chemins relatifs `../../../`.

6. **Naming** -- composants PascalCase (`PolicesTable`), hooks camelCase (`usePolicesList`), files kebab-case (`policy-header-card.tsx`), types PascalCase (`Policy`, `Premium`).

7. **Props interface** -- chaque composant client expose `interface XxxProps`. Pas de `type XxxProps = {...}` (interface plus extensible).

8. **Default exports interdits** sauf Next.js pages/layouts. Named exports systematique pour tree-shaking.

9. **Async/await** prefere a `.then().catch()`. Try/catch explicite avec narrow Error types via `instanceof Error`.

10. **Toast feedback** -- `import { toast } from 'sonner'`. Success / error / info. Pas de `alert()` natif.

11. **Form validation** -- `react-hook-form` + `zodResolver` systematique. Pas de useState manuel validation.

12. **Schemas Zod** -- centralises `@/lib/schemas/*.schema.ts`. Reuse cross-component. `.refine` pour cross-field validations.

13. **API calls** -- via `@/lib/api/*.api.ts` modules (Axios wrappers). Pas de fetch direct in component.

14. **TanStack Query** -- queryKey structure `['domain', id, 'subresource']` ex `['policy', policyId, 'premiums']`. `staleTime` explicite.

15. **Mutations** -- toujours `useMutation` + `onSuccess invalidateQueries` + `onError toast`. Pas de side-effects manuels.

16. **Idempotency-Key** -- toutes mutations POST inject `Idempotency-Key: ${crypto.randomUUID()}` via Axios interceptor Sprint 4 OR explicit header.

17. **i18n** -- toutes UI strings via `useTranslations('namespace')`. Pas de string literal hardcode. JSON messages `fr.json`/`ar-MA.json`/`ar.json` parite obligatoire CI check.

18. **Date formatters** -- via `@/lib/formatters/policy-formatters.ts` `formatPolicyDates`. Africa/Casablanca timezone EXPLICITE. Jamais `toLocaleString` natif.

19. **Currency** -- via `formatMAD(amount, locale)` helper. Jamais `${amount} MAD` template.

20. **Status badges** -- via `<PolicyStatusBadge status={...} locale={...} />` component. Couleurs centralisees `getPolicyStatusStyle`. Pas de hardcode `bg-red-500`.

21. **Icons** -- `lucide-react` only. Pas d'emoji, pas de FontAwesome, pas de SVG inline custom (sauf brand logos via `next/image`).

22. **shadcn/ui components** -- Sprint 4 setup. Re-export depuis `@/components/ui/*`. Variants via `cva` (class-variance-authority).

23. **nuqs URL state** -- pour filters + tab + pagination. `useQueryStates` + `parseAsXxx`. Pas de `useSearchParams` direct.

24. **Tests collocation** -- `__tests__/` subfolder par module OR `*.spec.ts` next to file. Coverage critical paths.

25. **No console.log** -- linter `no-console` error. Logger via `@/lib/logger` (Pino client-compat) si necessaire.

---

## 13. Decisions referenced

- **decision-001** (monorepo pnpm + Turbo) -- shared-ui reuse, single deps tree.
- **decision-005** (Skalean AI frontier) -- pas d'IA cette tache, Sprint 26+ ajoutera churn prediction.
- **decision-006** (NO EMOJI ABSOLU) -- linter CI bloquant.
- **decision-008** (cloud souverain MA Atlas Cloud Benguerir) -- documents PDFs Atlas S3 only, JAMAIS AWS.
- **decision-009** (multilinguisme MA) -- fr default + ar-MA Darija + ar classique.
- **decision-010** (Skalean Broker ERP suite cliente) -- page polices = vitrine P0 absolue.

---

## 14. Rappel conventions Skalean InsurTech

```
PORTS DEV
  3001 web-broker (cette app)
  3002 web-garage
  3003 web-garage-mobile (PWA)
  3004 web-customer-portal (SSG+ISR SEO)
  3005 web-assure-portal
  3006 web-assure-mobile (PWA)
  4000 api NestJS (backend)
  4001 bff aggregator

PALETTE SOFIDEMY (Sprint 4)
  Skalean Orange   #E95D2C (primary)
  Skalean Navy     #1A2730 (foreground)
  Sky Blue         #B0CEE2 (accent)
  ACAPS Teal       #2D5773 (secondary)
  Success Green    #2D9D4B
  Warning Orange   #E89B2C
  Destructive Red  #C0392B

TYPOGRAPHY
  Montserrat (latin) -- titres + body
  Noto Naskh Arabic (arabic) -- ar-MA + ar

I18N LOCALES
  fr        -- defaut, professionnel courtier MA
  ar-MA     -- Darija (arabe dialectal marocain ecrit)
  ar        -- arabe classique formel

TIMEZONE
  Africa/Casablanca (UTC+1 hiver / UTC+2 ete avec DST debut 2024 abandonnee -- toujours +1)

CURRENCY
  MAD Dirham marocain
  Format Bank Al-Maghrib BAM : 2 decimales obligatoires
  Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })

DATE FORMAT
  formatInTimeZone(date, 'Africa/Casablanca', 'PPP', { locale: fr|ar })
  Output fr : "1 janvier 2026"
  Output ar : "1 يناير 2026"

CONVENTIONS API
  Cursor pagination : ?after=cursor_token&limit=25
  Filters multi : ?status=active,suspended (comma-separated)
  Sort multi : ?sort=end_date:asc,prime_annuelle:desc
  Idempotency-Key : header sur POST/PUT/PATCH/DELETE only
  X-Tenant-ID : inject auto via Axios interceptor (Sprint 6)
  X-Trace-ID : crypto.randomUUID() inject auto (Sprint 4)
  Accept-Language : ${locale} inject auto

STATUS POLICY
  draft     -> brouillon non active (pas d'echeancier)
  active    -> active (echeancier present, paiements en cours)
  suspended -> suspendue temporairement (date_start/date_end)
  cancelled -> resiliee definitive (audit trail signature)
  expired   -> expiree (end_date < today, cron daily update)

BRANCHES ASSURANCE MA
  auto             45% portefeuille moyen
  sante            18%
  habitation       12%
  vie              8%
  rc_pro           7%
  rc_entreprise    6%
  multirisque      4%

ASSUREURS PARTENAIRES MA (top 10)
  Wafa Assurance
  AXA Maroc
  Atlanta Sanad
  Sanlam Maroc
  RMA Watanya
  Saham Assurance
  Allianz Maroc
  Marocaine Vie
  La Marocaine Vie (groupe Societe Generale)
  Mutuelle Centrale Marocaine d'Assurances (MCMA)

LEGAL REFERENCES
  Loi 17-99 (code des assurances MA, dahir 2002)
  Loi 43-20 (signature electronique, dahir 2020)
  Loi 09-08 (protection donnees personnelles CNDP, dahir 2009)
  ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)
  ANRT (Agence Nationale de Reglementation des Telecommunications -- TSA timestamping)
  CNDP (Commission Nationale de controle de la protection des Donnees a caractere Personnel)
  BAM (Bank Al-Maghrib -- banque centrale, normes MAD)
```

---

## 15. Stack specifique cette tache

| Package | Version | Usage |
|---------|---------|-------|
| `@tanstack/react-query` | 5.62.7 | Data fetching + mutations + cache invalidation |
| `@tanstack/react-table` | 8.20.6 | DataTable headless polices-table |
| `nuqs` | 2.0.4 | URL state filters + tab + pagination |
| `react-hook-form` | 7.54.x | Forms dialogs |
| `@hookform/resolvers` | 3.9.x | Zod resolver |
| `zod` | 3.24.1 | Schemas validation |
| `date-fns` | 4.1.0 | Dates manipulation |
| `date-fns-tz` | 4.1.0 | Africa/Casablanca timezone formatting |
| `recharts` | 2.13.x | AreaChart premiums cumul |
| `lucide-react` | 0.469.0 | Icons (CheckCircle2, AlertCircle, Ban, etc.) |
| `sonner` | 1.7.x | Toasts |
| `use-debounce` | 10.x | Debounce autocomplete contact selector |
| `@anrt/tsa-sdk` | 2.1.x | Signature ANRT TSA Loi 43-20 |
| `framer-motion` | 11.x | Animations dialogs (optional) |
| `clsx` + `tailwind-merge` | 2.5.5 | className composition |

Pas d'ajout nouveau package non-prevu Sprint 4 -- toutes deps deja livre.

---

## 16. Notes implementation

1. **Server Components first** : page.tsx + [id]/page.tsx Server Components avec initial fetch. Tabs orchestrator + dialogs Client Components.

2. **Suspense boundaries** : lazy tabs avec `React.lazy` + `Suspense fallback={<TabSkeleton />}`. Premier load Info eager, autres lazy.

3. **Optimistic updates** : pour move-stage like operations dans avenant create (Sprint 4.3.7 pattern). Cancel/transfer/suspend -> wait response (action critique pas optimistic).

4. **Error boundaries** : `error.tsx` Next.js par route. Reset boundary via `router.refresh()`.

5. **Loading states** : skeletons shadcn/ui partout (`<Skeleton className="h-X w-Y" />`). Pas de spinners centres (mauvaise UX).

6. **Empty states** : message + CTA + illustration optionnelle. Ex: "Aucune police -- Creer une premiere police via le Quote Builder" + bouton.

7. **Mobile responsive** : DataTable scroll horizontal < 768px. Tabs scroll horizontal natif. Dialogs `max-h-[90vh] overflow-y-auto`.

8. **Print-friendly** : Premiums tab + Operations tab utilises print.css Sprint 4 (header/footer cachet courtier, columns visibles, status badge sans couleur).

9. **Accessibility a11y** : tous boutons icons ont `aria-label`. Dialogs ont `<DialogTitle>` + `<DialogDescription>` Radix natif. Status badges ont texte + icon (jamais couleur seule).

10. **i18n RTL** : `dir="rtl"` automatique via NextIntlClientProvider Sprint 4. Verify margins via `ms-X` / `me-X` (start/end) jamais `ml-X` / `mr-X`.

11. **Defense en profondeur** : meme si UI cache action lifecycle (status disabled), backend Sprint 15 valide policy.status compatible action. Frontend = UX, jamais source of truth security.

12. **Audit trail forensique** : chaque mutation log via backend Sprint 7 audit_logs table + IP + user_agent. Frontend ne stocke aucun secret.

---

## 17. Risques + mitigations

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| API Sprint 15 Lifecycle services pas pret a temps | M | H | Mock APIs locales early sprint + sync Sprint 15 weekly |
| Signature ANRT TSA SDK breaking change v2.x -> v3.x | L | H | Pinning exact version `2.1.0` + fallback iframe externe documente |
| Pro-rata calc divergence frontend vs backend | M | M | Backend authoritative -- frontend display only avec disclaimer "Calcul estimatif" |
| Performance DataTable > 5000 polices | L | M | Virtualization via `@tanstack/virtual` Phase 7+ si feedback |
| RTL ar-MA layout bugs dialogs complexes | M | M | E2E tests dedies RTL + visual regression Chromatic Sprint 4.3.14 |
| Idempotency-Key collision UUID (statistiquement impossible) | TL | H | crypto.randomUUID() v4 -- 2^122 entropy |
| Force majeure abuse user check 100% sans preuve | L | H | Backend valide document_id requis + signature notaire/officier |
| Avenant retroactif >90j contournement | L | M | Zod refine + backend valide + audit log |
| Status auto-update expired cron miss | L | L | Frontend display warning + invalidateQueries manual refresh button |
| Bundle size polices page > 100 KB | M | M | Lazy tabs + code splitting + bundle analyzer CI gate < 80 KB |
| Concurrent edit conflict (2 users cancel meme police) | L | H | Backend Sprint 6 OCC optimistic concurrency control via version field |
| Atlas Cloud signed URL expire pendant download | L | L | Generate URL TTL 1h + frontend re-fetch sur 403 |

---

**Fin de la tache 4.3.8 -- Polices Page : List + Detail (Timeline + Premiums + Avenants + Renouvellements + Operations).**

Implementation reference complete, code patterns exhaustifs (14 fichiers principaux), tests Vitest 18+ + Playwright 12+, criteres validation V1-V28 (16 P0 + 7 P1 + 5 P2), edge cases 12, conformite Loi 17-99 + Loi 43-20 + Loi 09-08 + ACAPS, conventions Skalean 25, stack Sprint 4 reuse. Aucune emoji, decision-006 absolu respecte.

Tache suivante : **4.3.9 Broker Validation Queue** -- consume ProvisionalPolicy generee + validate/reject workflow + SLA timer.
