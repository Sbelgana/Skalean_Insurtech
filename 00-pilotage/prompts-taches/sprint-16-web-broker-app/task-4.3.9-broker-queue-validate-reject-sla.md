# TACHE 4.3.9 -- Broker Queue Page : Pending Dossiers + Actions Validate/Reject/Assign/Escalate + SLA Timer

**Sprint** : 16 (Phase 4 / Sprint 16 -- Web Broker App)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.9)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0
**Effort** : 6h
**Dependances** : task-4.3.8 (Polices page), Sprint 15 (BrokerValidationQueueService + ProvisionalPolicyService), Sprint 14 (Insure dashboards endpoints), Sprint 10 (S3 viewer documents), Sprint 9 (notifications email/whatsapp), Sprint 7 (RBAC permissions)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Construire la **page Broker Queue** complete dans l'app `web-broker` (port 3001) consommant les endpoints REST `BrokerValidationQueueService` livres au Sprint 15. Cette page est le coeur operationnel quotidien des utilisateurs broker (`broker_admin`, `broker_user`, `broker_assistant`) : c'est ici qu'ils traitent les dossiers de souscription en attente de validation generes soit par le portail customer Sprint 17 (canal `web_portal`), soit saisis manuellement par le commercial (canal `manual`), soit pousses par un partenaire affilie (canal `partner`).

L'objectif precis est de livrer deux routes Next.js 15 App Router : (1) la **route liste** `/broker-queue` avec 3 onglets (`Mes dossiers` / `Tous` accessible aux seuls `broker_admin` / `En retard` filtrant `sla_overdue=true`), DataTable TanStack riche, filtres URL-synced via nuqs, tri multi-critere prioritaire sur `sla_due_at asc`, pagination cursor, et surtout un **timer SLA visuel live** qui affiche le compte a rebours restant avec badge couleur dynamique (vert > 12h, jaune 6-12h, orange 1-6h, rouge < 1h, rouge fonce overdue) re-evalue toutes les 30 secondes ; (2) la **route detail** `/broker-queue/[id]` avec donnees customer completes, garanties demandees, prime + commission preview, viewer documents S3, lien provisional policy si Sprint 15 a genere, timeline d'evenements (creation -> assignment -> review -> validation/rejection), notes broker en texte libre audit-trail, et **4 dialogues d'action** (Validate, Reject, Escalate, Reassign) avec validations Zod metier et `Idempotency-Key` headers pour les mutations.

A la sortie de cette tache, un courtier ouvre `/fr/broker-queue`, voit ses dossiers tries par urgence SLA, clique sur un dossier, examine documents + garanties, valide en passant par `ValidateDossierDialog` (checklist documents OK + commission_rate + commit) ce qui declenche cote backend Sprint 15 : la souscription est finalisee, la `ProvisionalPolicy` est remplacee par une `Police` definitive, le customer est notifie via email/whatsapp Sprint 9, et la queue se rafraichit via TanStack Query invalidation. Tests Vitest (15+) et Playwright E2E (10+) garantissent la non-regression. Cette tache bloque 4.3.10 (Sinistres) car le pattern dialog + queue est reutilise.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

La **BrokerValidationQueue** est l'innovation metier centrale du programme Skalean InsurTech : contrairement aux courtiers traditionnels marocains qui traitent les demandes de souscription au fil de l'eau sans priorisation explicite, Skalean Broker impose un **SLA contractuel par dossier** (defini au moment de la creation par le service Sprint 15 -- typiquement 24h business pour une demande standard, 4h pour une demande urgente partner-flagged, 72h pour une demande complexe RC professionnelle entreprise). Ce SLA est la promesse de niveau de service que le cabinet de courtage tient envers ses prospects et ses partenaires apporteurs d'affaires (banques partenaires, concessionnaires automobiles, plateformes affiliees).

Si un dossier passe en `sla_overdue=true`, plusieurs consequences metier se declenchent en cascade : (a) **escalade automatique** vers le `broker_admin` du tenant qui recoit notification push + email rappel (Sprint 9 NotificationService) ; (b) **penalite contractuelle partenaire** si la source du dossier est `partner` car les contrats d'apport d'affaires Skalean stipulent un bonus/malus sur le respect SLA ; (c) **degradation NPS customer** mesuree par le Sprint 13 AnalyticsService (cohorte de prospects perdus passe SLA breach) ; (d) **risque legal** sur les dossiers Auto si la demande etait liee a un sinistre imminent (immatriculation neuve vehicule importe) car l'absence de couverture provisoire engage la responsabilite du courtier conformement a l'article 6 de la loi 17-99 du code des assurances marocain.

La page Broker Queue est donc **l'outil de pilotage operationnel temps reel** qui doit rendre evident, en un coup d'oeil, quels dossiers risquent de bascule dans le rouge. Le choix d'un **timer SLA visuel avec badge couleur** (au lieu d'une simple date dans une colonne) est issu d'un retour utilisateur explicite recueille pendant les ateliers de design metier de novembre 2025 : les courtiers passent souvent 7-8 heures consecutives a traiter des dossiers, leur charge cognitive est elevee, et lire une date `2026-05-19 14:30 +01:00` puis calculer mentalement "il me reste combien de temps ?" cree de la friction. Un badge `< 1h` rouge clignotant resout ce probleme en deplacant le calcul du courtier vers l'interface.

### Position dans Sprint 16 et architecture globale

Tache **4.3.9** est la **neuvieme tache** du Sprint 16 (14 taches total) et la **septieme page metier** apres Dashboard (4.3.4), Contacts (4.3.5), Companies (4.3.6), Deals (4.3.7), Polices (4.3.8). Elle precede directement Sinistres (4.3.10) read-only, Parametres (4.3.11), RBAC UI (4.3.12), I18n (4.3.13), Tests E2E globaux (4.3.14).

```
Sprint 16 -- Web Broker App (14 taches, 77h total)

[4.3.1 App skeleton]
   |
   +--> [4.3.2 Pages auth]
           |
           +--> [4.3.3 Layout sidebar+topbar]
                   |
                   +--> [4.3.4 Dashboard]
                           |
                           +--> [4.3.5 Contacts]
                                   |
                                   +--> [4.3.6 Companies]
                                           |
                                           +--> [4.3.7 Deals (kanban+table)]
                                                   |
                                                   +--> [4.3.8 Polices (list+detail)]
                                                           |
                                                           +--> [4.3.9 Broker Queue]  <-- CETTE TACHE
                                                                   |
                                                                   +--> [4.3.10 Sinistres read-only]
                                                                           |
                                                                           +--> [4.3.11 Parametres+Profile]
                                                                                   |
                                                                                   +--> [4.3.12 RBAC UI]
                                                                                           |
                                                                                           +--> [4.3.13 I18n complete]
                                                                                                   |
                                                                                                   +--> [4.3.14 E2E Playwright + a11y]
```

Dans le **programme global de 35 sprints**, cette tache occupe une position pivot car elle est le **premier UI metier qui orchestre quatre services backend simultanement** : `BrokerValidationQueueService` (Sprint 15), `ProvisionalPolicyService` (Sprint 15), `NotificationService` (Sprint 9), `DocumentStorageService` (Sprint 10). Les patterns d'orchestration mis en place ici (dialogues d'action avec Idempotency-Key, optimistic updates avec rollback, polling SSE pour notifications real-time) seront reutilises Sprint 17 (web-customer-portal lors du flow de souscription en ligne), Sprint 18 (web-assure-portal pour les avenants), Sprint 22 (web-garage pour la prise en charge sinistre).

### Decisions strategiques referenced

- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans le code, les labels traduits, les commit messages. Les badges colorimetriques utilisent des chips Tailwind avec textes courts (`< 1h`, `Overdue`) et icones Lucide React (`AlertTriangle`, `Clock`, `CheckCircle2`) -- jamais d'emoji unicode.
- **decision-007 (Africa/Casablanca timezone obligatoire)** : tous les calculs SLA utilisent `date-fns-tz` avec timezone forcee `Africa/Casablanca`. Un dossier cree a 23h heure locale Maroc qui a un SLA `+24h business hours` doit etre evalue dans cette timezone, pas en UTC du serveur backend. Bug potentiel courant : le frontend calcule `Date.now() - sla_due_at_utc.getTime()` ce qui donne le bon delta en ms, mais l'affichage de l'heure restante doit ensuite utiliser `formatInTimeZone(date, 'Africa/Casablanca', 'HH:mm')`.
- **decision-009 (multilinguisme MA -- fr/ar-MA/ar)** : les labels SLA (`< 1h`, `Overdue`, `> 12h`) doivent etre traduits. En arabe : `< 1h` devient `أقل من ساعة` (ar classique) ou `قل من ساعة` (Darija). Le composant `<SlaBadge>` utilise `useTranslations('brokerQueue.sla')` et formatte les nombres avec `Intl.NumberFormat(locale)` pour gerer les chiffres arabes vs occidentaux.
- **decision-010 (Idempotency-Key obligatoire mutations)** : toutes les mutations POST de la queue (`/validate`, `/reject`, `/assign`, `/escalate`, `/reassign`, `/notes`) DOIVENT envoyer un header `Idempotency-Key` genere via `crypto.randomUUID()`. Le backend Sprint 15 deduplique cote serveur pendant 24h. Sans cet header, un double-click utilisateur ou un retry reseau cree deux validations successives ce qui casse l'integrite metier (deux polices definitives generees).
- **decision-011 (RBAC strict broker tiers)** : trois roles `broker_admin` / `broker_user` / `broker_assistant`. Seul `broker_admin` voit l'onglet `Tous` (assignments de toute l'equipe) et peut executer `Reassign`. `broker_assistant` peut UNIQUEMENT consulter les dossiers (lecture seule, aucune action mutation). Cette regle est doublee cote backend Sprint 7 PermissionGuard et cote frontend via `<HasRole>` wrappers (Tache 4.3.12 livre les helpers, mais cette tache les consomme).

### Alternatives considerees

#### Polling vs SSE vs WebSocket pour real-time updates

| Critere | Polling 30s (CHOIX) | SSE (rejete v1) | WebSocket (rejete) |
|---------|---------------------|-----------------|---------------------|
| Complexite implementation | Tres faible (`setInterval` + `queryClient.invalidateQueries`) | Moyenne (EventSource + reconnect) | Elevee (lib socket.io + auth) |
| Charge serveur 100 brokers actifs | ~3.3 req/s (acceptable) | 100 connexions persistantes | 100 connexions full-duplex |
| Compatibilite proxies enterprise MA | Excellente (HTTP standard) | Bonne (HTTP/1.1 chunked) | Variable (certains proxies bloquent ws) |
| Latence detection nouveau dossier | 30s max | < 1s | < 100ms |
| Cout backend | Negligeable | Faible | Modere (Redis pub/sub + sticky sessions) |
| Pertinence metier | Suffisant (SLA en heures, pas secondes) | Surdimensionne | Surdimensionne |

**Decision** : polling 30 secondes via TanStack Query `refetchInterval: 30_000`. Si Sprint 23+ identifie que la latence 30s genere des frustrations utilisateur (escalades manquees dans les fenetres de 30s), migration SSE v2 planifiee. Pas de WebSocket -- usage non justifie metier.

#### Live countdown : re-render setInterval vs requestAnimationFrame vs server-time-sync

| Critere | setInterval 1s (CHOIX) | requestAnimationFrame (rejete) | WebWorker timer (rejete) |
|---------|------------------------|---------------------------------|---------------------------|
| Precision affichage | Suffisante (lecture humaine) | Excessive (60Hz pour timer SLA inutile) | Equivalente setInterval |
| Pause onglet en arriere-plan | OUI (navigateur throttle a 1Hz) -> souhaite | OUI (paused) | NON (Worker continue) |
| Sync server-time drift | Recompute depuis `sla_due_at` ref absolue chaque tick | Idem | Idem |
| Complexite code | Tres faible | Moyenne (cleanup loop) | Elevee (postMessage) |

**Decision** : `setInterval(updateSlaTier, 1000)` dans le composant `<SlaTimer>` avec cleanup dans `useEffect` return. Le throttling navigateur sur onglet inactif est un avantage (pas de gaspillage CPU). La precision recompute systematiquement depuis `sla_due_at` ISO string donc aucune derive cumulative.

#### TanStack Table vs custom DataTable vs Ant Design Table

| Critere | TanStack Table v8 (CHOIX) | Custom shadcn (rejete v1) | Ant Design Table (rejete) |
|---------|---------------------------|----------------------------|---------------------------|
| Bundle size | ~14 kB gzipped | ~3 kB (mais features manquantes) | ~120 kB (entire AntD) |
| Headless architecture | Oui (style libre Tailwind) | Oui | Non (styles imposes) |
| Filtres + sort + pagination | Built-in | A construire | Built-in |
| Virtualisation lignes | Plugin `@tanstack/react-virtual` | A construire | Built-in |
| Type-safe columns | Excellent (generic `<TData>`) | Bon | Moyen |
| RTL support | Manuel CSS | Manuel CSS | Built-in mais lourd |
| Maturite Sprint 4 (jan 2026) | v8 stable depuis 2023 | N/A | v5 stable |
| Maintenance ecosysteme | Active (TanStack) | Internal team | Active (Alibaba) |

**Decision** : `@tanstack/react-table@8.20.x` + composants shadcn `<Table>` pour le rendu. Cette combinaison est deja employee Tache 4.3.5 (Contacts), 4.3.6 (Companies), 4.3.7 (Deals Table view), 4.3.8 (Polices) donc reutilisation patron etabli.

#### Optimistic updates : full vs partial vs none

| Critere | Optimistic partial (CHOIX) | Full optimistic | Pas d'optimistic |
|---------|-----------------------------|------------------|--------------------|
| UX perception vitesse | Excellente (status change instant) | Excellente | Mauvaise (spinner 500-1500ms) |
| Risque rollback frustrant | Faible (rollback rare car backend Sprint 15 valide) | Moyen (rollback peut casser flow user) | Aucun |
| Complexite code | Moyenne | Elevee | Faible |
| Cas Validate dossier | Status `pending` -> `validated` immediat + spinner sur "Generation police..." | Status + police generated simultane (risque desync) | Spinner attente 1-2s reponse |

**Decision** : optimistic **partial**. La mutation `validate` change immediatement `status: 'validating'` dans le cache TanStack Query (visible badge jaune `Validating...`), puis attend la reponse backend pour passer a `status: 'validated'` definitif et invalider la query liste. Si echec, rollback `status` precedent + toast erreur.

### Trade-offs explicites

1. **SLA timer recompute toutes les secondes** : leger surcout CPU navigateur (negligeable < 0.1% sur Chrome moderne avec 50 dossiers visibles). Acceptable. Si scale > 200 dossiers visibles, virtualiser TanStack Virtual ne re-render que les rows visibles.

2. **Polling 30s constant** : meme onglet inactif, polling continue (TanStack Query default `refetchIntervalInBackground: false`). On laisse a `true` pour ne pas manquer un dossier nouveau pendant que le courtier a switch sur Gmail. Cout : ~120 req/h par broker actif. Acceptable backend.

3. **Idempotency-Key persistance** : la cle UUID est generee a chaque clic bouton dans le dialog. Si user clique deux fois rapidement avant ouverture dialog, deux UUID differents donc backend cree deux validations -- BUG. Mitigation : disable button apres premier click + spinner. Cas marginal couvert dans tests Playwright.

4. **Provisional policy expiration affichage** : si Sprint 15 a genere une provisional policy avec TTL 48h et que le broker review le dossier 50h plus tard, la provisional est expiree mais le dossier peut quand meme etre valide (regeneration auto cote backend Sprint 15). On affiche un warning `Provisional expiree -- nouvelle police generee a la validation` mais on ne bloque pas. Trade-off : moins de friction broker, mais customer a vu un PDF temporaire qui n'est plus valide.

5. **Notes broker libre texte XSS** : les notes sont stockees raw cote backend Sprint 15 et affichees dans `<DossierNotes>`. Sanitisation cote frontend via `DOMPurify` (deja employe Sprint 4 task 1.4.8 shared-ui). Si un broker malveillant injecte `<script>` dans une note (improbable mais possible), DOMPurify strip avant render.

6. **Real-time notification toast spam** : si 10 dossiers sont assignes en 30s (rare mais possible lors d'un batch import partner), 10 toasts apparaitraient. Mitigation : `sonner` library deduplique par `id` toast et regroupe en `5 nouveaux dossiers assignes` apres 3+ rapides.

### Pieges techniques connus (15+)

1. **Timer pause onglet background** : `setInterval` est throttle a 1Hz quand l'onglet est inactif (Chrome 88+) ce qui est OK. Mais SAFARI iOS throttle a 0.5Hz et peut pauser jusqu'a 60s. Solution : sur `document.visibilitychange` event, force `queryClient.invalidateQueries(['broker-queue'])` puis re-compute SLA avec freshly fetched `sla_due_at`.

2. **Hydratation mismatch SLA Server vs Client** : si le serveur SSR rend `< 6h` a 14:30:00 et le client hydrate a 14:30:02, le badge passe a `< 6h` puis recalcule a la seconde 1 vers `< 6h - 2s`. Pas de mismatch HTML car le composant `<SlaTimer>` est `'use client'` avec `dynamic = 'force-dynamic'` et le render initial server-side renvoie un skeleton placeholder.

3. **Timezone drift navigateur** : `Date.now()` retourne UTC. Le serveur stocke `sla_due_at` UTC aussi. Calcul `sla_due_at.getTime() - Date.now()` donne le delta en ms agnostique timezone. Mais si user change l'heure systeme manuellement (hyper rare mais possible), affichage casse. Acceptable cas edge.

4. **Idempotency-Key reuse cross-mutations** : ne JAMAIS reutiliser une cle UUID entre `validate` et `reject` pour le meme dossier. Backend Sprint 15 indexe `(idempotency_key, route)` mais une cle reutilisee genere `409 Conflict` perplexant. Solution : `crypto.randomUUID()` neuve dans chaque `onSubmit` de dialog.

5. **TanStack Query stale-while-revalidate sur detail** : si le broker a la page detail ouverte 30 minutes sans bouger, le polling 30s rafraichit liste mais pas detail. Solution : `useQuery(['broker-queue', id])` avec `refetchInterval: 30_000` egalement.

6. **Optimistic rollback race condition** : si user click `Validate` (optimistic update applique), puis click `Reject` immediat (deuxieme optimistic update), puis backend rejette `Validate` avec 422 (documents manquants), rollback peut ecraser le `Reject` optimistic. Solution : disable tous boutons d'action pendant qu'une mutation est en flight (utiliser `useMutation isPending` + bouton level state).

7. **Filter URL state RTL flip** : nuqs serializ `?status=pending&branche=auto` dans URL. En RTL, le navigateur Chrome affiche l'URL `?branche=auto&status=pending` parfois (LTR forced sur URL bar) -- pas un bug, juste un detail UX. Pas de fix necessaire.

8. **Cursor pagination corruption avec polling** : si polling 30s rafraichit la page 2 (cursor `abc123`) et que 5 nouveaux dossiers ont ete crees entretemps avec status `pending`, le cursor `abc123` peut etre obsolete. Backend Sprint 15 retourne `next_cursor: null` si invalid. Frontend doit reset a cursor null et retourner page 1.

9. **Locale switch perd SLA timer state** : si user change `/fr` -> `/ar`, le composant `<SlaTimer>` est demonte/remonte donc `setInterval` reset. Pas de bug fonctionnel mais latence visuelle 0-1s. Acceptable.

10. **Provisional policy lien Sprint 15 broken** : si dossier reference une `provisional_policy_id` mais le backend Sprint 15 a un bug et retourne 404 sur `GET /provisional-policies/:id`, le composant `<DossierHeaderCard>` doit gracefuly afficher `Provisional indisponible` plutot que crash. `<ErrorBoundary>` shadcn deja en place.

11. **Documents S3 viewer CORS** : Sprint 10 expose les URLs S3 signed Atlas Cloud Benguerir. CORS doit autoriser origin `http://localhost:3001` dev et `https://app.skalean-insurtech.ma` prod. Si CORS bloque, viewer affiche erreur generique. Verifier `Access-Control-Allow-Origin` headers backend.

12. **Reject reason custom_text injection** : si reason `other` selectionnee et user tape `<img src=x onerror=alert(1)>` dans textarea, et que ce texte est envoye par email customer Sprint 9, XSS reflected possible. Mitigation : backend Sprint 9 sanitize email templates avec mjml + escape HTML. Defense frontend : maxLength 500 + reject pattern `<script>`.

13. **Escalate to broker_admin si user EST broker_admin** : edge case. Si le user actuel est deja le top admin tenant, `escalate_to: 'super_admin'` Skalean platform-level uniquement. Dialog doit detecter `currentUser.role === 'broker_admin'` et masquer option `broker_admin`.

14. **Reassign sans broker_admin role** : `<ReassignDialog>` ne doit etre montable que si `HasRole role={['broker_admin']}` wrapping. Si rendu accidentel dans un autre contexte, button submit doit hit `403 Forbidden` cote backend Sprint 7 PermissionGuard. Defense en profondeur.

15. **Real-time notifications fail silently** : si backend Sprint 9 NotificationService is down, le polling 30s retourne erreur reseau. TanStack Query retry 3x avec backoff. Apres 3 fails, query passes en error state mais NE BLOQUE PAS le rendu de la liste cached. User voit toujours les dossiers + toast erreur `Notifications indisponibles, refresh manuel disponible`.

16. **Dossier deleted while open** : si le `broker_admin` supprime un dossier (action admin Sprint 15 future) pendant qu'un autre user a la detail page ouverte, le polling 30s sur `useQuery(['broker-queue', id])` retourne 404. Composant detecte error + redirige `router.push('/broker-queue?deleted=' + id)` + toast `Dossier supprime`.

17. **Tabs filter persists URL** : nuqs `parseAsString` synchronize `?tab=mes`. Si user reload la page sur `/broker-queue?tab=en_retard`, le tab `En retard` est selectionne et le filter `sla_overdue=true` est applique. URL est le single source of truth des filtres.

18. **WCAG 2.1 AA SLA timer aria-live** : un timer qui change visuellement de couleur sans annonce screen reader viole 1.3.1. Solution : `<span role="status" aria-live="polite" aria-atomic="true">{label}</span>` annonce `< 1h` quand le state change. Eviter `aria-live="assertive"` qui spammerait toutes les secondes.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16 et flux donnees

```
                        Sprint 15 Backend
                ----------------------------------
                |                                |
                |  BrokerValidationQueueService  |
                |  ProvisionalPolicyService      |
                |  SubscriptionFinalizationSvc   |
                |                                |
                ----------------------------------
                          |  REST API
                          |  /api/v1/insure/broker/queue/*
                          |  Bearer JWT + x-tenant-id + Idempotency-Key
                          v
                +--------------------------------+
                |  Next.js 15 web-broker         |
                |  app/[locale]/(protected)/     |
                |  broker-queue/                 |
                |  +-- page.tsx (Server Comp.)   |
                |  |   |                         |
                |  |   +-- <QueueTabs>           |
                |  |   +-- <QueueFilters>       |
                |  |   +-- <QueueTable>          |
                |  |       |                     |
                |  |       +-- <SlaTimer>        |
                |  |       +-- <RowActions>      |
                |  |                             |
                |  +-- [id]/page.tsx             |
                |      |                         |
                |      +-- <DossierHeaderCard>   |
                |      +-- <DossierGarantiesList>|
                |      +-- <DossierDocViewer>    |
                |      +-- <DossierTimeline>     |
                |      +-- <DossierNotes>        |
                |      +-- <ActionsBar>          |
                |          |                     |
                |          +-- <ValidateDialog>  |
                |          +-- <RejectDialog>    |
                |          +-- <EscalateDialog>  |
                |          +-- <ReassignDialog>  |
                +--------------------------------+
                          |  TanStack Query Hooks
                          v
                +--------------------------------+
                |  lib/queries/broker-queue.q.ts |
                |  lib/api/broker-queue.api.ts   |
                |  lib/schemas/broker-q.schema.ts|
                |  lib/utils/sla-calculator.ts   |
                +--------------------------------+

                          ^
                          |  Sprint 9 NotificationService (email/whatsapp customer)
                          |  Sprint 10 DocumentStorageService (S3 viewer)
                          |  Sprint 7 PermissionGuard (RBAC)
                          |  Sprint 5 AuthService (JWT)
```

### Provider chain (heritage Tache 4.3.1)

```
<html lang="fr" dir="ltr">
  <body>
    <ThemeProvider>
      <NextIntlClientProvider locale="fr" messages={msgs} timeZone="Africa/Casablanca">
        <Providers>  <-- QueryClient + Sentry + tenant store sync
          <ProtectedLayout>  <-- sidebar + topbar (Tache 4.3.3)
            <BrokerQueuePage>  <-- CETTE TACHE
              <QueueTabs>
                <QueueFilters>
                  <QueueTable>
                    [...rows]
                    <SlaTimer />
                  </QueueTable>
                </QueueFilters>
              </QueueTabs>
            </BrokerQueuePage>
          </ProtectedLayout>
        </Providers>
      </NextIntlClientProvider>
    </ThemeProvider>
    <Toaster />
  </body>
</html>
```

### Routes Next.js 15 App Router

```
repo/apps/web-broker/
  app/
    [locale]/
      (protected)/
        broker-queue/
          page.tsx                         # Liste + tabs
          [id]/
            page.tsx                       # Detail dossier
            loading.tsx                    # Skeleton fallback
            error.tsx                      # Error boundary
            not-found.tsx                  # 404 dossier supprime
        layout.tsx                         # Existing Tache 4.3.3
```

### Permissions RBAC (consume Sprint 7)

| Action | Permission backend | Role minimum frontend |
|--------|--------------------|------------------------|
| GET liste queue | `insure.broker_queue.read` | broker_assistant |
| GET detail dossier | `insure.broker_queue.read` | broker_assistant |
| POST /assign (self) | `insure.broker_queue.assign_self` | broker_user |
| POST /validate | `insure.broker_queue.validate` | broker_user |
| POST /reject | `insure.broker_queue.reject` | broker_user |
| POST /escalate | `insure.broker_queue.escalate` | broker_user |
| POST /reassign | `insure.broker_queue.reassign` | broker_admin |
| POST /notes | `insure.broker_queue.notes` | broker_user |
| Voir onglet "Tous" | `insure.broker_queue.view_all` | broker_admin |

### State management strategy

| Donnee | Stockage | Justification |
|--------|----------|----------------|
| Liste dossiers + detail | TanStack Query cache (gcTime 5min, staleTime 30s) | Source of truth backend Sprint 15, polling 30s |
| Filters (status, branche, source) | URL nuqs | Shareable, bookmarkable, back-button works |
| Tab actif (mes/tous/retard) | URL nuqs `?tab=mes` | Same |
| Pagination cursor | URL nuqs `?cursor=abc123` | Stateful, refreshable |
| Sort column + direction | URL nuqs `?sort=sla_due_at&dir=asc` | Persistant |
| Dialog ouvert (validate/reject/...) | React local state `useState` | Volatile, no need to persist |
| Form data dialog | react-hook-form local state | Volatile |
| Tenant context | zustand store (sessionStorage persist) | Cross-tab isolation (heritage Tache 4.3.1) |
| Current user role | zustand store auth | Heritage Tache 4.3.2 |
| Toasts notifications | sonner local state | Volatile |

---

## 4. Livrables checkables (25+ deliverables)

- [ ] **L1** : `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/page.tsx` (~150 lignes) Server Component avec recuperation locale + cookies tenant + RSC fetch initial `getBrokerQueue()` server-side pour first paint rapide, puis hydration client TanStack Query.

- [ ] **L2** : `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/[id]/page.tsx` (~200 lignes) Server Component detail dossier avec `params.id`, fetch initial `getBrokerQueueDetail(id)`, suspense boundary, error boundary, not-found pour dossier supprime.

- [ ] **L3** : `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/loading.tsx` (~30 lignes) Skeleton TanStack-shaped loader.

- [ ] **L4** : `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/[id]/loading.tsx` (~40 lignes) Skeleton detail.

- [ ] **L5** : `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/[id]/error.tsx` (~40 lignes) Error boundary avec retry button + Sentry capture.

- [ ] **L6** : `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/[id]/not-found.tsx` (~30 lignes) Empty state dossier supprime.

- [ ] **L7** : `repo/apps/web-broker/components/broker-queue/queue-tabs.tsx` (~100 lignes) 3 tabs (Mes / Tous / En retard) avec count badges, RBAC conditional `<HasRole>`, URL sync nuqs.

- [ ] **L8** : `repo/apps/web-broker/components/broker-queue/queue-filters.tsx` (~180 lignes) Filtres : status multi-select, branche multi-select, source multi-select, priority, assigned_to, search debounced, clear-all button, URL sync nuqs.

- [ ] **L9** : `repo/apps/web-broker/components/broker-queue/queue-table.tsx` (~280 lignes) TanStack Table v8 avec columns customer + branche + amount_estimated + source + sla_due_at (avec `<SlaTimer>`) + priority + status + assigned_to + age + actions, sort, pagination cursor, virtualization si > 100 rows.

- [ ] **L10** : `repo/apps/web-broker/components/broker-queue/sla-timer.tsx` (~150 lignes) Composant live countdown : useInterval 1s, computeSlaTier from utils, badge shadcn avec couleur dynamique, aria-live polite, locale-aware label.

- [ ] **L11** : `repo/apps/web-broker/components/broker-queue/row-actions.tsx` (~80 lignes) Dropdown menu (`...`) avec items Validate / Reject / Assign to me / Escalate / Reassign (conditional admin) / Voir detail.

- [ ] **L12** : `repo/apps/web-broker/components/broker-queue/dossier-header-card.tsx` (~120 lignes) Card header : policy_number_provisional + customer name + branche badge + status badge + SLA timer big + actions bar.

- [ ] **L13** : `repo/apps/web-broker/components/broker-queue/dossier-garanties-list.tsx` (~140 lignes) List garanties demandees : nom + plafond + franchise + montant prime + commission preview.

- [ ] **L14** : `repo/apps/web-broker/components/broker-queue/dossier-documents-viewer.tsx` (~180 lignes) Viewer S3 (Sprint 10) : list documents avec type (CIN/justif_revenus/autres) + preview PDF inline iframe + download button + verification status badge.

- [ ] **L15** : `repo/apps/web-broker/components/broker-queue/dossier-timeline.tsx` (~150 lignes) Vertical timeline events : creation + assignment + reviews + notes + validation/rejection avec icones Lucide + timestamps locale-aware Africa/Casablanca.

- [ ] **L16** : `repo/apps/web-broker/components/broker-queue/dossier-notes.tsx` (~130 lignes) Liste notes textuelles broker + textarea ajouter nouvelle note + DOMPurify sanitize render.

- [ ] **L17** : `repo/apps/web-broker/components/broker-queue/dialogs/validate-dossier-dialog.tsx` (~220 lignes) Dialog avec checklist documents OK + commission_rate input + commit notes + form Zod + mutation TanStack Query optimistic + Idempotency-Key header.

- [ ] **L18** : `repo/apps/web-broker/components/broker-queue/dialogs/reject-dossier-dialog.tsx` (~190 lignes) Dialog avec reason dropdown (5 options + other) + custom text si other + notify_customer checkbox (email/whatsapp) + form Zod + mutation.

- [ ] **L19** : `repo/apps/web-broker/components/broker-queue/dialogs/escalate-dialog.tsx` (~160 lignes) Dialog avec escalate_to dropdown (broker_admin/super_admin) + reason + comment + form Zod + mutation.

- [ ] **L20** : `repo/apps/web-broker/components/broker-queue/dialogs/reassign-dialog.tsx` (~140 lignes) Dialog admin-only : user_id selector (users du tenant avec role broker_user/broker_assistant) + reason + form Zod + mutation.

- [ ] **L21** : `repo/apps/web-broker/lib/queries/broker-queue.queries.ts` (~280 lignes) TanStack Query hooks : `useBrokerQueueList`, `useBrokerQueueDetail`, `useAssignDossier`, `useValidateDossier`, `useRejectDossier`, `useEscalateDossier`, `useReassignDossier`, `useAddDossierNote` avec optimistic updates, rollback, invalidation.

- [ ] **L22** : `repo/apps/web-broker/lib/api/broker-queue.api.ts` (~180 lignes) Wrappers Axios pour 8 endpoints `/api/v1/insure/broker/queue/*` avec headers Idempotency-Key sur mutations.

- [ ] **L23** : `repo/apps/web-broker/lib/schemas/broker-queue.schema.ts` (~220 lignes) Zod schemas : `BrokerQueueItemSchema`, `BrokerQueueDetailSchema`, `ValidateDossierSchema`, `RejectDossierSchema`, `EscalateDossierSchema`, `ReassignDossierSchema`, `AddNoteSchema`, types TypeScript exports.

- [ ] **L24** : `repo/apps/web-broker/lib/utils/sla-calculator.ts` (~80 lignes) Function `computeSlaTier(sla_due_at: Date, now?: Date): SlaTier` avec types + edge cases overdue/null/invalid.

- [ ] **L25** : `repo/apps/web-broker/lib/utils/__tests__/sla-calculator.spec.ts` (~250 lignes) 12 tests Vitest exhaustifs : green > 12h, yellow 6-12h border, orange 1-6h, red < 1h, dark_red overdue, null, far future, exact transitions, locale labels, edge ms.

- [ ] **L26** : `repo/apps/web-broker/messages/fr.json` (+30 keys broker-queue) labels FR : `mesDossiers`, `tous`, `enRetard`, `valider`, `rejeter`, `assigner`, `escalader`, `reassigner`, `slaRestant`, `slaOverdue`, `documents`, `garanties`, `notes`, etc.

- [ ] **L27** : `repo/apps/web-broker/messages/ar-MA.json` (+30 keys Darija) `الدوسيات ديالي`, `الكل`, `متأخر`, `صادق`, `رفض`, `كلف`, `صعد`, `بدل التكليف`, etc.

- [ ] **L28** : `repo/apps/web-broker/messages/ar.json` (+30 keys ar classique) `ملفاتي`, `الكل`, `متأخر`, `تصديق`, `رفض`, `تكليف`, `تصعيد`, `إعادة تكليف`, etc.

- [ ] **L29** : Tests Vitest components : `queue-table.spec.ts` (6 tests), `sla-timer.spec.ts` (8 tests live updates), `validate-dialog.spec.ts` (5 tests checklist + commission), `reject-dialog.spec.ts` (4 tests reason + notify), `schemas.spec.ts` (10 tests Zod parsing). Total ~33 tests.

- [ ] **L30** : Tests Playwright E2E : `repo/e2e/web/broker-queue.spec.ts` (10+ tests) : validate flow complet + provisional replaced, reject + customer notified, assign self, escalate, reassign admin only, SLA badge couleur progression, real-time poll new dossier, filtres URL persist, locale switch, RTL countdown.

- [ ] **L31** : `repo/apps/web-broker/lib/hooks/use-poll-broker-queue.ts` (~40 lignes) hook polling 30s avec visibility detection + tab focus refetch.

- [ ] **L32** : Coverage Vitest >= 85% sur `lib/utils/sla-calculator.ts`, `lib/queries/broker-queue.queries.ts`, `lib/schemas/broker-queue.schema.ts`.

- [ ] **L33** : `grep -r "emoji-regex" repo/apps/web-broker/components/broker-queue/` retourne 0 ligne.

- [ ] **L34** : `grep -r "console.log" repo/apps/web-broker/components/broker-queue/` retourne 0 ligne.

- [ ] **L35** : Lighthouse Performance >= 70 sur `/fr/broker-queue` avec 50 dossiers mockes.

- [ ] **L36** : Validation pre-commit : `pnpm --filter @insurtech/web-broker dev` demarre, `pnpm --filter @insurtech/web-broker test` 100% pass, `pnpm --filter @insurtech/web-broker test:e2e -- broker-queue` pass, `pnpm --filter @insurtech/web-broker typecheck` 0 erreur, `pnpm --filter @insurtech/web-broker lint` 0 erreur.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-broker/
  app/
    [locale]/
      (protected)/
        broker-queue/
          page.tsx                                              # ~150 lignes  -- L1
          loading.tsx                                           # ~30 lignes   -- L3
          [id]/
            page.tsx                                            # ~200 lignes  -- L2
            loading.tsx                                         # ~40 lignes   -- L4
            error.tsx                                           # ~40 lignes   -- L5
            not-found.tsx                                       # ~30 lignes   -- L6
  components/
    broker-queue/
      queue-tabs.tsx                                            # ~100 lignes  -- L7
      queue-filters.tsx                                         # ~180 lignes  -- L8
      queue-table.tsx                                           # ~280 lignes  -- L9
      sla-timer.tsx                                             # ~150 lignes  -- L10
      sla-badge.tsx                                             # ~70 lignes   (shared by Timer)
      row-actions.tsx                                           # ~80 lignes   -- L11
      dossier-header-card.tsx                                   # ~120 lignes  -- L12
      dossier-garanties-list.tsx                                # ~140 lignes  -- L13
      dossier-documents-viewer.tsx                              # ~180 lignes  -- L14
      dossier-timeline.tsx                                      # ~150 lignes  -- L15
      dossier-notes.tsx                                         # ~130 lignes  -- L16
      empty-state.tsx                                           # ~60 lignes
      dialogs/
        validate-dossier-dialog.tsx                             # ~220 lignes  -- L17
        reject-dossier-dialog.tsx                               # ~190 lignes  -- L18
        escalate-dialog.tsx                                     # ~160 lignes  -- L19
        reassign-dialog.tsx                                     # ~140 lignes  -- L20
        assign-self-confirm.tsx                                 # ~60 lignes
        commission-preview.tsx                                  # ~90 lignes
  lib/
    api/
      broker-queue.api.ts                                       # ~180 lignes  -- L22
    queries/
      broker-queue.queries.ts                                   # ~280 lignes  -- L21
    schemas/
      broker-queue.schema.ts                                    # ~220 lignes  -- L23
    utils/
      sla-calculator.ts                                         # ~80 lignes   -- L24
      __tests__/
        sla-calculator.spec.ts                                  # ~250 lignes  -- L25
    hooks/
      use-poll-broker-queue.ts                                  # ~40 lignes   -- L31
      use-visibility-refetch.ts                                 # ~30 lignes
  messages/
    fr.json                                                     # +30 keys     -- L26
    ar-MA.json                                                  # +30 keys     -- L27
    ar.json                                                     # +30 keys     -- L28
  components/__tests__/
    broker-queue/
      queue-table.spec.ts                                       # ~180 lignes
      sla-timer.spec.ts                                         # ~220 lignes
      validate-dialog.spec.ts                                   # ~160 lignes
      reject-dialog.spec.ts                                     # ~140 lignes
      escalate-dialog.spec.ts                                   # ~120 lignes
      reassign-dialog.spec.ts                                   # ~100 lignes
  lib/schemas/__tests__/
    broker-queue.schema.spec.ts                                 # ~200 lignes
  lib/queries/__tests__/
    broker-queue.queries.spec.ts                                # ~220 lignes

repo/e2e/web/
  broker-queue.spec.ts                                          # ~400 lignes (10+ tests) -- L30

repo/scripts/
  validate-broker-queue-i18n.ts                                 # ~40 lignes (CI helper)
```

Total : ~30 fichiers crees, ~4500 lignes nettes hors tests, ~1500 lignes tests.

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `repo/apps/web-broker/lib/utils/sla-calculator.ts` (~80 lignes)

```typescript
// SLA tier calculator -- pure function, no React, no IO
// Used by <SlaTimer> live countdown component + <SlaBadge> static
// All thresholds expressed in HOURS for clarity

export type SlaTierColor = 'green' | 'yellow' | 'orange' | 'red' | 'dark_red';
export type SlaTierSeverity = 0 | 1 | 2 | 3 | 4;

export interface SlaTier {
  color: SlaTierColor;
  label: string;
  labelKey: string;          // i18n key for translation
  severity: SlaTierSeverity; // 0 = green, 4 = overdue, used for sort
  remainingMs: number;
  remainingHours: number;
  remainingMinutes: number;
  isOverdue: boolean;
}

const THRESHOLDS = {
  green: 12,    // hours
  yellow: 6,
  orange: 1,
  red: 0,       // anything between 0 and 1h
} as const;

export function computeSlaTier(
  sla_due_at: Date | string | null | undefined,
  now: Date = new Date()
): SlaTier {
  if (!sla_due_at) {
    return {
      color: 'green',
      label: 'No SLA',
      labelKey: 'brokerQueue.sla.none',
      severity: 0,
      remainingMs: Infinity,
      remainingHours: Infinity,
      remainingMinutes: Infinity,
      isOverdue: false,
    };
  }

  const dueDate = typeof sla_due_at === 'string' ? new Date(sla_due_at) : sla_due_at;
  if (Number.isNaN(dueDate.getTime())) {
    return {
      color: 'dark_red',
      label: 'Invalid SLA',
      labelKey: 'brokerQueue.sla.invalid',
      severity: 4,
      remainingMs: 0,
      remainingHours: 0,
      remainingMinutes: 0,
      isOverdue: true,
    };
  }

  const remainingMs = dueDate.getTime() - now.getTime();
  const remainingHours = remainingMs / 3_600_000;
  const remainingMinutes = remainingMs / 60_000;

  if (remainingMs < 0) {
    const overdueHours = Math.abs(remainingHours);
    return {
      color: 'dark_red',
      label: `Overdue ${Math.floor(overdueHours)}h`,
      labelKey: 'brokerQueue.sla.overdue',
      severity: 4,
      remainingMs,
      remainingHours,
      remainingMinutes,
      isOverdue: true,
    };
  }

  if (remainingHours < THRESHOLDS.orange) {
    return {
      color: 'red',
      label: '< 1h',
      labelKey: 'brokerQueue.sla.under_1h',
      severity: 3,
      remainingMs,
      remainingHours,
      remainingMinutes,
      isOverdue: false,
    };
  }

  if (remainingHours < THRESHOLDS.yellow) {
    return {
      color: 'orange',
      label: `< ${Math.ceil(remainingHours)}h`,
      labelKey: 'brokerQueue.sla.under_6h',
      severity: 2,
      remainingMs,
      remainingHours,
      remainingMinutes,
      isOverdue: false,
    };
  }

  if (remainingHours < THRESHOLDS.green) {
    return {
      color: 'yellow',
      label: `< ${Math.ceil(remainingHours)}h`,
      labelKey: 'brokerQueue.sla.under_12h',
      severity: 1,
      remainingMs,
      remainingHours,
      remainingMinutes,
      isOverdue: false,
    };
  }

  return {
    color: 'green',
    label: `${Math.floor(remainingHours)}h`,
    labelKey: 'brokerQueue.sla.healthy',
    severity: 0,
    remainingMs,
    remainingHours,
    remainingMinutes,
    isOverdue: false,
  };
}

export function getSlaBadgeClassName(color: SlaTierColor): string {
  const map: Record<SlaTierColor, string> = {
    green: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300',
    yellow: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300',
    orange: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300',
    red: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300',
    dark_red: 'bg-red-200 text-red-900 border-red-500 ring-2 ring-red-500/40 dark:bg-red-900/60 dark:text-red-200',
  };
  return map[color];
}
```

### 6.2 `repo/apps/web-broker/lib/schemas/broker-queue.schema.ts` (~220 lignes)

```typescript
import { z } from 'zod';

// ============================================================================
// Shared enums
// ============================================================================

export const DossierStatus = z.enum([
  'pending',
  'in_review',
  'validated',
  'rejected',
  'escalated',
  'expired',
]);
export type DossierStatusT = z.infer<typeof DossierStatus>;

export const DossierSource = z.enum(['web_portal', 'manual', 'partner']);
export type DossierSourceT = z.infer<typeof DossierSource>;

export const DossierPriority = z.enum(['low', 'normal', 'high', 'urgent']);
export type DossierPriorityT = z.infer<typeof DossierPriority>;

export const BrancheAssurance = z.enum([
  'auto',
  'habitation',
  'sante',
  'vie',
  'rc_pro',
  'multirisque_entreprise',
  'voyage',
  'accident_personnel',
]);
export type BrancheAssuranceT = z.infer<typeof BrancheAssurance>;

export const RejectReason = z.enum([
  'documents_incomplete',
  'customer_ineligible',
  'garanties_unavailable',
  'prime_too_high',
  'duplicate_dossier',
  'other',
]);
export type RejectReasonT = z.infer<typeof RejectReason>;

export const EscalateTarget = z.enum(['broker_admin', 'super_admin']);
export type EscalateTargetT = z.infer<typeof EscalateTarget>;

// ============================================================================
// Embedded schemas (customer, garanties, documents, provisional)
// ============================================================================

export const CustomerMiniSchema = z.object({
  id: z.string().uuid(),
  display_name: z.string().min(1),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  cin: z.string().regex(/^[A-Z]{1,2}[0-9]{1,8}$/).nullable(),
  phone: z.string().regex(/^\+212[5-7][0-9]{8}$/).nullable(),
  email: z.string().email().nullable(),
  segment: z.enum(['individuel', 'pro', 'entreprise']).nullable(),
});
export type CustomerMini = z.infer<typeof CustomerMiniSchema>;

// CustomerFullSchema = Mini + { address (obj with line1/city/postal_code MA), date_of_birth, nationality='MA',
// preferred_language fr|ar-MA|ar, preferred_channel email|whatsapp|sms|phone, consent_809 (Loi 09-08), consent_809_at }
export const CustomerFullSchema = CustomerMiniSchema.extend({
  address: z.object({
    line1: z.string(), line2: z.string().nullable(), city: z.string(),
    postal_code: z.string().nullable(), region: z.string().nullable(), country: z.string().default('MA'),
  }).nullable(),
  date_of_birth: z.string().datetime().nullable(),
  nationality: z.string().default('MA'),
  preferred_language: z.enum(['fr', 'ar-MA', 'ar']).default('fr'),
  preferred_channel: z.enum(['email', 'whatsapp', 'sms', 'phone']).default('email'),
  consent_809: z.boolean().default(false),
  consent_809_at: z.string().datetime().nullable(),
});
export type CustomerFull = z.infer<typeof CustomerFullSchema>;

export const GarantieDemandeeSchema = z.object({
  id: z.string().uuid(), code: z.string().min(1), label: z.string().min(1),
  plafond_mad: z.number().nonnegative(), franchise_mad: z.number().nonnegative(),
  prime_mad: z.number().nonnegative(), is_obligatoire: z.boolean().default(false),
});
export type GarantieDemandee = z.infer<typeof GarantieDemandeeSchema>;

export const DocumentSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['cin_recto', 'cin_verso', 'justif_revenus', 'releve_bancaire', 'carte_grise', 'autre']),
  filename: z.string(), size_bytes: z.number().int().positive(), mime_type: z.string(),
  uploaded_at: z.string().datetime(), s3_signed_url: z.string().url(),
  verification_status: z.enum(['pending', 'verified', 'rejected']).default('pending'),
  verification_notes: z.string().nullable(),
});
export type DocumentT = z.infer<typeof DocumentSchema>;

export const ProvisionalPolicyLinkSchema = z.object({
  id: z.string().uuid(), policy_number_provisional: z.string(), pdf_url: z.string().url(),
  generated_at: z.string().datetime(), expires_at: z.string().datetime(),
  is_expired: z.boolean().default(false),
});
export type ProvisionalPolicyLink = z.infer<typeof ProvisionalPolicyLinkSchema>;

// ============================================================================
// Timeline event
// ============================================================================

export const TimelineEventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'created',
    'assigned',
    'reviewed',
    'note_added',
    'validated',
    'rejected',
    'escalated',
    'reassigned',
    'provisional_generated',
  ]),
  actor_id: z.string().uuid().nullable(),
  actor_display_name: z.string().nullable(),
  occurred_at: z.string().datetime(),
  metadata: z.record(z.unknown()).default({}),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ============================================================================
// Note
// ============================================================================

export const NoteSchema = z.object({
  id: z.string().uuid(),
  author_id: z.string().uuid(),
  author_display_name: z.string(),
  body: z.string().min(1).max(2000),
  created_at: z.string().datetime(),
});
export type Note = z.infer<typeof NoteSchema>;

// ============================================================================
// Queue item (list)
// ============================================================================

export const BrokerQueueItemSchema = z.object({
  id: z.string().uuid(),
  policy_number_provisional: z.string().nullable(),
  customer: CustomerMiniSchema,
  branche: BrancheAssurance,
  amount_estimated_mad: z.number().nonnegative(),
  source: DossierSource,
  priority: DossierPriority,
  status: DossierStatus,
  assigned_to_id: z.string().uuid().nullable(),
  assigned_to_display_name: z.string().nullable(),
  sla_due_at: z.string().datetime().nullable(),
  sla_overdue: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  age_hours: z.number().nonnegative(),
});
export type BrokerQueueItem = z.infer<typeof BrokerQueueItemSchema>;

// ============================================================================
// Queue detail
// ============================================================================

export const BrokerQueueDetailSchema = BrokerQueueItemSchema.extend({
  customer: CustomerFullSchema,
  garanties: z.array(GarantieDemandeeSchema),
  prime_total_mad: z.number().nonnegative(),
  commission_preview_mad: z.number().nonnegative(),
  commission_rate_default: z.number().min(0).max(100),
  documents: z.array(DocumentSchema),
  provisional_policy: ProvisionalPolicyLinkSchema.nullable(),
  timeline: z.array(TimelineEventSchema),
  notes: z.array(NoteSchema),
  reject_reason: RejectReason.nullable(),
  reject_custom_text: z.string().nullable(),
  rejected_at: z.string().datetime().nullable(),
  rejected_by_id: z.string().uuid().nullable(),
  validated_at: z.string().datetime().nullable(),
  validated_by_id: z.string().uuid().nullable(),
  escalated_to_id: z.string().uuid().nullable(),
  escalated_at: z.string().datetime().nullable(),
});
export type BrokerQueueDetail = z.infer<typeof BrokerQueueDetailSchema>;

// ============================================================================
// List response (cursor pagination)
// ============================================================================

export const BrokerQueueListResponseSchema = z.object({
  items: z.array(BrokerQueueItemSchema),
  next_cursor: z.string().nullable(),
  total_count: z.number().int().nonnegative(),
  counts_per_tab: z.object({
    mes: z.number().int().nonnegative(),
    tous: z.number().int().nonnegative(),
    en_retard: z.number().int().nonnegative(),
  }),
});
export type BrokerQueueListResponse = z.infer<typeof BrokerQueueListResponseSchema>;

// ============================================================================
// Mutations payloads
// ============================================================================

export const AssignDossierSchema = z.object({
  user_id: z.string().uuid(),
});
export type AssignDossierPayload = z.infer<typeof AssignDossierSchema>;

export const ValidateDossierSchema = z.object({
  commission_rate: z.number().min(0).max(100),
  notes: z.string().max(1000).optional(),
  checklist: z.object({
    cin_verified: z.boolean(),
    justif_revenus_verified: z.boolean(),
    garanties_validated: z.boolean(),
    prime_confirmed: z.boolean(),
  }),
});
export type ValidateDossierPayload = z.infer<typeof ValidateDossierSchema>;

export const RejectDossierSchema = z.object({
  reason: RejectReason,
  custom_text: z.string().max(500).optional(),
  notify_customer: z.boolean().default(true),
  notification_channels: z.array(z.enum(['email', 'whatsapp', 'sms'])).default(['email']),
}).refine(
  (data) => data.reason !== 'other' || (data.custom_text && data.custom_text.length >= 10),
  { message: 'custom_text required and >= 10 chars when reason is other', path: ['custom_text'] }
);
export type RejectDossierPayload = z.infer<typeof RejectDossierSchema>;

export const EscalateDossierSchema = z.object({
  escalate_to: EscalateTarget,
  reason: z.string().min(10).max(500),
  comment: z.string().max(1000).optional(),
});
export type EscalateDossierPayload = z.infer<typeof EscalateDossierSchema>;

export const ReassignDossierSchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().min(10).max(500),
});
export type ReassignDossierPayload = z.infer<typeof ReassignDossierSchema>;

export const AddNoteSchema = z.object({
  body: z.string().min(1).max(2000),
});
export type AddNotePayload = z.infer<typeof AddNoteSchema>;

// ============================================================================
// Filters (URL state)
// ============================================================================

export const QueueFiltersSchema = z.object({
  tab: z.enum(['mes', 'tous', 'en_retard']).default('mes'),
  status: z.array(DossierStatus).default([]),
  branche: z.array(BrancheAssurance).default([]),
  source: z.array(DossierSource).default([]),
  priority: z.array(DossierPriority).default([]),
  assigned_to: z.string().uuid().nullable().default(null),
  search: z.string().default(''),
  sort: z.enum(['sla_due_at', 'priority', 'amount_estimated_mad', 'created_at']).default('sla_due_at'),
  sort_dir: z.enum(['asc', 'desc']).default('asc'),
  cursor: z.string().nullable().default(null),
});
export type QueueFilters = z.infer<typeof QueueFiltersSchema>;
```

### 6.3 `repo/apps/web-broker/lib/api/broker-queue.api.ts` (~180 lignes)

```typescript
import { apiClient } from '@/lib/api-client';
import {
  BrokerQueueListResponseSchema,
  BrokerQueueDetailSchema,
  BrokerQueueItemSchema,
  type AssignDossierPayload,
  type ValidateDossierPayload,
  type RejectDossierPayload,
  type EscalateDossierPayload,
  type ReassignDossierPayload,
  type AddNotePayload,
  type QueueFilters,
  type BrokerQueueListResponse,
  type BrokerQueueDetail,
  type BrokerQueueItem,
  type Note,
} from '@/lib/schemas/broker-queue.schema';
import { logger } from '@/lib/logger';

function genIdempotencyKey(): string {
  return crypto.randomUUID();
}

function buildQueryString(filters: Partial<QueueFilters>): string {
  const params = new URLSearchParams();
  if (filters.tab) params.set('tab', filters.tab);
  filters.status?.forEach((s) => params.append('status', s));
  filters.branche?.forEach((b) => params.append('branche', b));
  filters.source?.forEach((s) => params.append('source', s));
  filters.priority?.forEach((p) => params.append('priority', p));
  if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
  if (filters.search) params.set('search', filters.search);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.sort_dir) params.set('sort_dir', filters.sort_dir);
  if (filters.cursor) params.set('cursor', filters.cursor);
  return params.toString();
}

export const brokerQueueApi = {
  async list(filters: Partial<QueueFilters>): Promise<BrokerQueueListResponse> {
    const qs = buildQueryString(filters);
    const url = `/api/v1/insure/broker/queue${qs ? `?${qs}` : ''}`;
    logger.debug({ url, filters }, 'broker-queue.api.list');
    const { data } = await apiClient.get(url);
    return BrokerQueueListResponseSchema.parse(data);
  },

  async detail(id: string): Promise<BrokerQueueDetail> {
    const { data } = await apiClient.get(`/api/v1/insure/broker/queue/${id}`);
    return BrokerQueueDetailSchema.parse(data);
  },

  // Helper generic mutation : POST avec Idempotency-Key + Schema parse
  async _mutate<T>(path: string, payload: unknown, schema: { parse: (d: unknown) => T }): Promise<T> {
    const { data } = await apiClient.post(`/api/v1/insure/broker/queue${path}`, payload, {
      headers: { 'Idempotency-Key': genIdempotencyKey() },
    });
    return schema.parse(data);
  },

  assign(id: string, p: AssignDossierPayload) {
    return this._mutate(`/${id}/assign`, p, BrokerQueueItemSchema);
  },
  validate(id: string, p: ValidateDossierPayload) {
    return this._mutate(`/${id}/validate`, p, BrokerQueueDetailSchema);
  },
  reject(id: string, p: RejectDossierPayload) {
    return this._mutate(`/${id}/reject`, p, BrokerQueueDetailSchema);
  },
  escalate(id: string, p: EscalateDossierPayload) {
    return this._mutate(`/${id}/escalate`, p, BrokerQueueDetailSchema);
  },
  reassign(id: string, p: ReassignDossierPayload) {
    return this._mutate(`/${id}/reassign`, p, BrokerQueueItemSchema);
  },
  async addNote(id: string, p: AddNotePayload): Promise<Note> {
    const { data } = await apiClient.post(`/api/v1/insure/broker/queue/${id}/notes`, p, {
      headers: { 'Idempotency-Key': genIdempotencyKey() },
    });
    return data; // backend returns Note shape directly
  },
};
```

### 6.4 `repo/apps/web-broker/lib/queries/broker-queue.queries.ts` (~280 lignes)

```typescript
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
  type QueryKey,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { brokerQueueApi } from '@/lib/api/broker-queue.api';
import type {
  QueueFilters,
  BrokerQueueListResponse,
  BrokerQueueDetail,
  BrokerQueueItem,
  AssignDossierPayload,
  ValidateDossierPayload,
  RejectDossierPayload,
  EscalateDossierPayload,
  ReassignDossierPayload,
  AddNotePayload,
} from '@/lib/schemas/broker-queue.schema';
import { logger } from '@/lib/logger';

// ============================================================================
// Query keys
// ============================================================================

export const brokerQueueKeys = {
  all: ['broker-queue'] as const,
  lists: () => [...brokerQueueKeys.all, 'list'] as const,
  list: (filters: Partial<QueueFilters>) =>
    [...brokerQueueKeys.lists(), filters] as const,
  details: () => [...brokerQueueKeys.all, 'detail'] as const,
  detail: (id: string) => [...brokerQueueKeys.details(), id] as const,
};

// ============================================================================
// LIST query (polling 30s)
// ============================================================================

export function useBrokerQueueList(filters: Partial<QueueFilters>) {
  return useQuery<BrokerQueueListResponse>({
    queryKey: brokerQueueKeys.list(filters),
    queryFn: () => brokerQueueApi.list(filters),
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

// ============================================================================
// DETAIL query (polling 30s)
// ============================================================================

export function useBrokerQueueDetail(id: string | undefined) {
  return useQuery<BrokerQueueDetail>({
    queryKey: id ? brokerQueueKeys.detail(id) : ['broker-queue', 'detail', 'none'],
    queryFn: () => {
      if (!id) throw new Error('id required');
      return brokerQueueApi.detail(id);
    },
    enabled: Boolean(id),
    refetchInterval: 30_000,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  });
}

// ============================================================================
// ASSIGN mutation (self-claim)
// ============================================================================

export function useAssignDossier(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: AssignDossierPayload) => brokerQueueApi.assign(id, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: brokerQueueKeys.detail(id) });
      const previous = qc.getQueryData<BrokerQueueDetail>(brokerQueueKeys.detail(id));
      if (previous) {
        qc.setQueryData<BrokerQueueDetail>(brokerQueueKeys.detail(id), {
          ...previous,
          assigned_to_id: payload.user_id,
          status: 'in_review',
        });
      }
      return { previous };
    },
    onError: (err, _payload, ctx) => {
      logger.error({ err, id }, 'assign-dossier-failed');
      if (ctx?.previous) qc.setQueryData(brokerQueueKeys.detail(id), ctx.previous);
      toast.error('Echec assignment du dossier');
    },
    onSuccess: () => {
      toast.success('Dossier assigne avec succes');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: brokerQueueKeys.detail(id) });
      qc.invalidateQueries({ queryKey: brokerQueueKeys.lists() });
    },
  });
}

// ============================================================================
// VALIDATE mutation
// ============================================================================

export function useValidateDossier(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ValidateDossierPayload) => brokerQueueApi.validate(id, payload),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: brokerQueueKeys.detail(id) });
      const previous = qc.getQueryData<BrokerQueueDetail>(brokerQueueKeys.detail(id));
      if (previous) {
        qc.setQueryData<BrokerQueueDetail>(brokerQueueKeys.detail(id), {
          ...previous,
          status: 'validated',
          validated_at: new Date().toISOString(),
        });
      }
      return { previous };
    },
    onError: (err, _payload, ctx) => {
      logger.error({ err, id }, 'validate-dossier-failed');
      if (ctx?.previous) qc.setQueryData(brokerQueueKeys.detail(id), ctx.previous);
      const message = (err as any)?.response?.data?.message ?? 'Echec validation';
      toast.error(message);
    },
    onSuccess: (data) => {
      toast.success(`Dossier valide -- Police ${data.policy_number_provisional ?? ''} generee`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: brokerQueueKeys.detail(id) });
      qc.invalidateQueries({ queryKey: brokerQueueKeys.lists() });
      // also invalidate polices list -- new policy created
      qc.invalidateQueries({ queryKey: ['polices'] });
    },
  });
}

// ============================================================================
// REJECT mutation
// ============================================================================

export function useRejectDossier(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RejectDossierPayload) => brokerQueueApi.reject(id, payload),
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: brokerQueueKeys.detail(id) });
      const previous = qc.getQueryData<BrokerQueueDetail>(brokerQueueKeys.detail(id));
      if (previous) {
        qc.setQueryData<BrokerQueueDetail>(brokerQueueKeys.detail(id), {
          ...previous,
          status: 'rejected',
          reject_reason: payload.reason,
          reject_custom_text: payload.custom_text ?? null,
          rejected_at: new Date().toISOString(),
        });
      }
      return { previous };
    },
    onError: (err, _payload, ctx) => {
      logger.error({ err, id }, 'reject-dossier-failed');
      if (ctx?.previous) qc.setQueryData(brokerQueueKeys.detail(id), ctx.previous);
      toast.error('Echec rejet du dossier');
    },
    onSuccess: (_data, payload) => {
      const channel = payload.notify_customer ? ' (customer notifie)' : '';
      toast.success(`Dossier rejete${channel}`);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: brokerQueueKeys.detail(id) });
      qc.invalidateQueries({ queryKey: brokerQueueKeys.lists() });
    },
  });
}

// Pattern identique pour les 3 mutations restantes (Escalate / Reassign / AddNote) :
// - useEscalateDossier(id) : optimistic update status -> 'escalated' + escalated_at, toast `Dossier escalade vers ${escalate_to}`, invalidate detail + lists
// - useReassignDossier(id) : pas d'optimistic (admin action), toast 'Dossier reassigne', invalidate detail + lists
// - useAddDossierNote(id) : pas d'optimistic, toast 'Note ajoutee', invalidate detail
// Tous suivent : mutationFn calls brokerQueueApi.* + onError logger.error + toast.error + rollback ctx.previous si applicable
```

### 6.5 `repo/apps/web-broker/components/broker-queue/sla-timer.tsx` (~150 lignes)

```typescript
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  computeSlaTier,
  getSlaBadgeClassName,
  type SlaTier,
} from '@/lib/utils/sla-calculator';

interface SlaTimerProps {
  sla_due_at: string | null;
  variant?: 'compact' | 'full';
  className?: string;
}

export function SlaTimer({ sla_due_at, variant = 'compact', className }: SlaTimerProps) {
  const t = useTranslations('brokerQueue.sla');
  const [tier, setTier] = useState<SlaTier>(() => computeSlaTier(sla_due_at));

  useEffect(() => {
    // Initial recompute on mount with fresh now
    setTier(computeSlaTier(sla_due_at));

    const intervalId = window.setInterval(() => {
      setTier(computeSlaTier(sla_due_at));
    }, 1000);

    // Re-run when tab becomes visible (browser may throttle background)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTier(computeSlaTier(sla_due_at));
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [sla_due_at]);

  const Icon = tier.isOverdue ? AlertTriangle : Clock;
  const i18nLabel = useMemo(() => {
    if (tier.labelKey === 'brokerQueue.sla.none') return t('none');
    if (tier.labelKey === 'brokerQueue.sla.invalid') return t('invalid');
    if (tier.labelKey === 'brokerQueue.sla.overdue') {
      return t('overdue', { hours: Math.floor(Math.abs(tier.remainingHours)) });
    }
    if (tier.labelKey === 'brokerQueue.sla.under_1h') {
      return t('under_1h', { minutes: Math.max(0, Math.floor(tier.remainingMinutes)) });
    }
    if (tier.labelKey === 'brokerQueue.sla.under_6h' || tier.labelKey === 'brokerQueue.sla.under_12h') {
      return t('under_hours', { hours: Math.ceil(tier.remainingHours) });
    }
    return t('healthy', { hours: Math.floor(tier.remainingHours) });
  }, [tier, t]);

  if (variant === 'full') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium',
          getSlaBadgeClassName(tier.color),
          tier.color === 'dark_red' && 'animate-pulse',
          className
        )}
        data-sla-color={tier.color}
        data-sla-severity={tier.severity}
      >
        <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span>{i18nLabel}</span>
        {tier.isOverdue && (
          <span className="ml-auto text-xs font-normal opacity-70">
            {t('actionRequired')}
          </span>
        )}
      </div>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        getSlaBadgeClassName(tier.color),
        tier.color === 'dark_red' && 'animate-pulse',
        className
      )}
      data-sla-color={tier.color}
      data-sla-severity={tier.severity}
      title={sla_due_at ?? undefined}
    >
      <Icon className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
      <span>{i18nLabel}</span>
    </span>
  );
}
```

### 6.6 `repo/apps/web-broker/components/broker-queue/queue-tabs.tsx` (~100 lignes)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { useQueryState, parseAsStringEnum } from 'nuqs';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { HasRole } from '@/components/auth/has-role';
import type { BrokerQueueListResponse } from '@/lib/schemas/broker-queue.schema';

interface QueueTabsProps {
  counts: BrokerQueueListResponse['counts_per_tab'] | undefined;
  children: React.ReactNode;
}

const TAB_VALUES = ['mes', 'tous', 'en_retard'] as const;
type TabValue = (typeof TAB_VALUES)[number];

export function QueueTabs({ counts, children }: QueueTabsProps) {
  const t = useTranslations('brokerQueue.tabs');
  const [tab, setTab] = useQueryState<TabValue>(
    'tab',
    parseAsStringEnum([...TAB_VALUES]).withDefault('mes')
  );

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="w-full">
      <TabsList className="grid w-full max-w-2xl grid-cols-3">
        <TabsTrigger value="mes" className="gap-2">
          <span>{t('mes')}</span>
          {counts && counts.mes > 0 && (
            <Badge variant="secondary" className="ms-1">
              {counts.mes}
            </Badge>
          )}
        </TabsTrigger>

        <HasRole role={['broker_admin']}>
          <TabsTrigger value="tous" className="gap-2">
            <span>{t('tous')}</span>
            {counts && counts.tous > 0 && (
              <Badge variant="secondary" className="ms-1">
                {counts.tous}
              </Badge>
            )}
          </TabsTrigger>
        </HasRole>

        <TabsTrigger value="en_retard" className="gap-2">
          <span>{t('enRetard')}</span>
          {counts && counts.en_retard > 0 && (
            <Badge variant="destructive" className="ms-1 animate-pulse">
              {counts.en_retard}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>
      <div className="mt-4">{children}</div>
    </Tabs>
  );
}
```

### 6.7 `repo/apps/web-broker/components/broker-queue/queue-filters.tsx` (~180 lignes)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { useQueryStates, parseAsArrayOf, parseAsString, parseAsStringEnum } from 'nuqs';
import { useDeferredValue, useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import {
  DossierStatus,
  BrancheAssurance,
  DossierSource,
  DossierPriority,
} from '@/lib/schemas/broker-queue.schema';

const STATUS_OPTIONS = DossierStatus.options;
const BRANCHE_OPTIONS = BrancheAssurance.options;
const SOURCE_OPTIONS = DossierSource.options;
const PRIORITY_OPTIONS = DossierPriority.options;

export function QueueFilters() {
  const t = useTranslations('brokerQueue.filters');

  const [filters, setFilters] = useQueryStates({
    status: parseAsArrayOf(parseAsString).withDefault([]),
    branche: parseAsArrayOf(parseAsString).withDefault([]),
    source: parseAsArrayOf(parseAsString).withDefault([]),
    priority: parseAsArrayOf(parseAsString).withDefault([]),
    search: parseAsString.withDefault(''),
    sort: parseAsString.withDefault('sla_due_at'),
    sort_dir: parseAsStringEnum(['asc', 'desc']).withDefault('asc'),
  });

  // Debounce search
  const [localSearch, setLocalSearch] = useState(filters.search);
  const deferredSearch = useDeferredValue(localSearch);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (deferredSearch !== filters.search) {
        setFilters({ search: deferredSearch });
      }
    }, 300);
    return () => window.clearTimeout(handle);
  }, [deferredSearch, filters.search, setFilters]);

  const hasActiveFilters =
    filters.status.length > 0 ||
    filters.branche.length > 0 ||
    filters.source.length > 0 ||
    filters.priority.length > 0 ||
    filters.search !== '';

  const clearAll = () => {
    setFilters({
      status: [],
      branche: [],
      source: [],
      priority: [],
      search: '',
    });
    setLocalSearch('');
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t('title')}</h3>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1">
            <X className="h-3 w-3" />
            {t('clearAll')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="filter-search">{t('search')}</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="filter-search"
              type="search"
              placeholder={t('searchPlaceholder')}
              className="ps-9"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              aria-label={t('search')}
            />
          </div>
        </div>

        {/* 4 MultiSelect identiques pour status / branche / source / priority */}
        {([
          ['status', STATUS_OPTIONS],
          ['branche', BRANCHE_OPTIONS],
          ['source', SOURCE_OPTIONS],
          ['priority', PRIORITY_OPTIONS],
        ] as const).map(([key, options]) => (
          <div key={key} className="space-y-1.5">
            <Label>{t(key)}</Label>
            <MultiSelect
              options={options.map((o) => ({ value: o, label: t(`${key}_${o}`) }))}
              value={filters[key as keyof typeof filters] as string[]}
              onChange={(v) => setFilters({ [key]: v } as any)}
              placeholder={t(`${key}Placeholder`)}
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <Label htmlFor="filter-sort">{t('sort')}</Label>
          <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v })}>
            <SelectTrigger id="filter-sort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sla_due_at">{t('sort_sla')}</SelectItem>
              <SelectItem value="priority">{t('sort_priority')}</SelectItem>
              <SelectItem value="amount_estimated_mad">{t('sort_amount')}</SelectItem>
              <SelectItem value="created_at">{t('sort_created')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="filter-sort-dir">{t('sortDirection')}</Label>
          <Select
            value={filters.sort_dir}
            onValueChange={(v) => setFilters({ sort_dir: v as 'asc' | 'desc' })}
          >
            <SelectTrigger id="filter-sort-dir">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="asc">{t('asc')}</SelectItem>
              <SelectItem value="desc">{t('desc')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
```

### 6.8 `repo/apps/web-broker/components/broker-queue/queue-table.tsx` (~280 lignes)

```typescript
'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useTranslations, useLocale } from 'next-intl';
import { formatInTimeZone } from 'date-fns-tz';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SlaTimer } from './sla-timer';
import { RowActions } from './row-actions';
import type { BrokerQueueItem } from '@/lib/schemas/broker-queue.schema';

interface QueueTableProps {
  data: BrokerQueueItem[];
  isLoading: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

function formatMad(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-MA' : 'ar-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function QueueTable({ data, isLoading, onLoadMore, hasMore }: QueueTableProps) {
  const t = useTranslations('brokerQueue.table');
  const router = useRouter();
  const locale = useLocale();

  // Column definitions (10 columns) -- chaque colonne suit ce pattern :
  // { accessorKey, header: t('xxx'), cell: ({ row }) => <Badge|Span|Custom>...</>, sortingFn? }
  //
  // Liste des colonnes :
  // 1. customer.display_name -> stack vertical name + CIN muted
  // 2. branche -> <Badge variant="outline" capitalize>{t(`branche_${b}`)}</Badge>
  // 3. amount_estimated_mad -> <span font-mono tabular-nums>{formatMad(amount, locale)}</span> + sortingFn 'basic'
  // 4. source -> <Badge> avec variant map { web_portal: 'default', manual: 'secondary', partner: 'outline' }
  // 5. sla_due_at -> <SlaTimer sla_due_at={...} /> + sortingFn custom (date asc, null=Infinity)
  // 6. priority -> <Badge> avec variant map { low: 'outline', normal: 'secondary', high: 'default', urgent: 'destructive' }
  // 7. status -> <Badge variant="outline" capitalize>{t(`status_${s}`)}</Badge>
  // 8. assigned_to_display_name -> nom + fallback italic muted "Non assigne"
  // 9. age_hours -> {Math.floor(age_hours)}h en xs muted
  // 10. actions -> <RowActions dossier> + ChevronRight icon button push /broker-queue/{id}
  const columns = useMemo<ColumnDef<BrokerQueueItem>[]>(() => [
    /* ... 10 colonnes implementees selon descriptions ci-dessus ... */
  ], [t, locale, router]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading && data.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded bg-muted/50" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
        <p className="text-sm font-medium text-muted-foreground">{t('emptyTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('emptyDescription')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                router.push(`/broker-queue/${row.original.id}`);
              }}
              data-row-id={row.original.id}
              data-status={row.original.status}
              data-sla-overdue={row.original.sla_overdue}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="border-t p-3 text-center">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? t('loading') : t('loadMore')}
          </Button>
        </div>
      )}
    </div>
  );
}
```

### 6.9 `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/page.tsx` (~150 lignes)

```typescript
import { Suspense } from 'react';
import { unstable_setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { QueueClient } from '@/components/broker-queue/queue-client';
import { Skeleton } from '@/components/ui/skeleton';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[]>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'brokerQueue' });
  return {
    title: `${t('pageTitle')} -- Skalean Broker`,
    description: t('pageDescription'),
    robots: { index: false, follow: false }, // internal app, not indexed
  };
}

export default async function BrokerQueuePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const sp = await searchParams;

  const t = await getTranslations({ locale, namespace: 'brokerQueue' });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {t('pageTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
      </div>

      <Suspense fallback={<QueueListSkeleton />}>
        <QueueClient initialSearchParams={sp} />
      </Suspense>
    </div>
  );
}

function QueueListSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full max-w-2xl" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
```

### 6.10 `repo/apps/web-broker/components/broker-queue/queue-client.tsx` (~150 lignes)

```typescript
'use client';

import { useMemo } from 'react';
import { useQueryStates, parseAsArrayOf, parseAsString, parseAsStringEnum } from 'nuqs';
import { useBrokerQueueList } from '@/lib/queries/broker-queue.queries';
import { QueueTabs } from './queue-tabs';
import { QueueFilters } from './queue-filters';
import { QueueTable } from './queue-table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import type { QueueFilters as QueueFiltersT } from '@/lib/schemas/broker-queue.schema';

interface QueueClientProps {
  initialSearchParams: Record<string, string | string[]>;
}

export function QueueClient({ initialSearchParams }: QueueClientProps) {
  const t = useTranslations('brokerQueue');

  const [urlState] = useQueryStates({
    tab: parseAsStringEnum(['mes', 'tous', 'en_retard']).withDefault('mes'),
    status: parseAsArrayOf(parseAsString).withDefault([]),
    branche: parseAsArrayOf(parseAsString).withDefault([]),
    source: parseAsArrayOf(parseAsString).withDefault([]),
    priority: parseAsArrayOf(parseAsString).withDefault([]),
    search: parseAsString.withDefault(''),
    sort: parseAsString.withDefault('sla_due_at'),
    sort_dir: parseAsStringEnum(['asc', 'desc']).withDefault('asc'),
    cursor: parseAsString.withDefault(''),
  });

  const filters = useMemo<Partial<QueueFiltersT>>(
    () => ({
      tab: urlState.tab,
      status: urlState.status as any,
      branche: urlState.branche as any,
      source: urlState.source as any,
      priority: urlState.priority as any,
      search: urlState.search,
      sort: urlState.sort as any,
      sort_dir: urlState.sort_dir,
      cursor: urlState.cursor || null,
    }),
    [urlState]
  );

  const { data, isLoading, error, refetch, isFetching } = useBrokerQueueList(filters);

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('errorTitle')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{t('errorDescription')}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              <RefreshCw className="me-2 h-3 w-3" />
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <QueueTabs counts={data?.counts_per_tab}>
        <div className="flex flex-col gap-4">
          <QueueFilters />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {data?.total_count
                ? t('totalDossiers', { count: data.total_count })
                : t('noDossiers')}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </Button>
          </div>
          <QueueTable
            data={data?.items ?? []}
            isLoading={isLoading}
            hasMore={Boolean(data?.next_cursor)}
          />
        </div>
      </QueueTabs>
    </div>
  );
}
```

### 6.11 `repo/apps/web-broker/app/[locale]/(protected)/broker-queue/[id]/page.tsx` (~200 lignes)

Server Component analogue a `broker-queue/page.tsx` (section 6.9) avec :
- `params: Promise<{ locale: string; id: string }>` (Next.js 15 async params)
- `generateMetadata` retourne title court avec `id.slice(0, 8)` + `robots: { index: false }`
- Validation `id` UUID regex `/^[0-9a-f-]{36}$/i` -> `notFound()` si invalid
- `unstable_setRequestLocale(locale)` pour next-intl SSR
- `<Suspense fallback={<DetailSkeleton/>}>` wrap `<DossierDetailClient id={id}/>`
- DetailSkeleton : grid 3 cols lg, 3 skeletons gauche + 2 skeletons droite

### 6.12 `repo/apps/web-broker/components/broker-queue/dossier-detail-client.tsx` (~200 lignes)

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, XCircle, ArrowUpCircle, UserCog, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useBrokerQueueDetail, useAssignDossier } from '@/lib/queries/broker-queue.queries';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { HasRole } from '@/components/auth/has-role';
import { DossierHeaderCard } from './dossier-header-card';
import { DossierGarantiesList } from './dossier-garanties-list';
import { DossierDocumentsViewer } from './dossier-documents-viewer';
import { DossierTimeline } from './dossier-timeline';
import { DossierNotes } from './dossier-notes';
import { ValidateDossierDialog } from './dialogs/validate-dossier-dialog';
import { RejectDossierDialog } from './dialogs/reject-dossier-dialog';
import { EscalateDialog } from './dialogs/escalate-dialog';
import { ReassignDialog } from './dialogs/reassign-dialog';

interface Props {
  id: string;
}

export function DossierDetailClient({ id }: Props) {
  const t = useTranslations('brokerQueue.detail');
  const router = useRouter();
  const { data, isLoading, error } = useBrokerQueueDetail(id);
  const currentUser = useCurrentUser();
  const assignMutation = useAssignDossier(id);

  const [openDialog, setOpenDialog] = useState<
    'validate' | 'reject' | 'escalate' | 'reassign' | null
  >(null);

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('loading')}</div>;
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{t('errorLoading')}</AlertDescription>
      </Alert>
    );
  }

  const isAssignedToMe = data.assigned_to_id === currentUser.id;
  const canTakeAction = data.status === 'pending' || data.status === 'in_review';
  const provisionalExpired = data.provisional_policy?.is_expired ?? false;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('back')}
        </Button>

        {/* ActionsBar : conditional rendering basee sur isAssignedToMe + canTakeAction + RBAC role :
            - Assign to me : si !isAssignedToMe && canTakeAction -> mutation assignMutation.mutate({ user_id: currentUser.id })
            - Validate / Reject / Escalate : si isAssignedToMe && canTakeAction -> setOpenDialog(...)
            - Reassign : wrapped <HasRole role={['broker_admin']}> + canTakeAction -> setOpenDialog('reassign')
            Chaque Button : <Button variant size="sm" onClick className="gap-1"><Icon h-4 w-4/>{t(action)}</Button> */}
        <DossierActionsBar
          isAssignedToMe={isAssignedToMe}
          canTakeAction={canTakeAction}
          onAssignSelf={() => assignMutation.mutate({ user_id: currentUser.id })}
          onOpenDialog={setOpenDialog}
        />
      </div>

      {provisionalExpired && (
        <Alert>
          <AlertDescription>{t('provisionalExpired')}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DossierHeaderCard dossier={data} />
          <DossierGarantiesList garanties={data.garanties} prime_total_mad={data.prime_total_mad} commission_preview_mad={data.commission_preview_mad} />
          <DossierDocumentsViewer documents={data.documents} />
          <DossierNotes notes={data.notes} dossierId={id} />
        </div>
        <div className="space-y-6">
          <DossierTimeline events={data.timeline} />
        </div>
      </div>

      {openDialog === 'validate' && (
        <ValidateDossierDialog
          dossier={data}
          onClose={() => setOpenDialog(null)}
        />
      )}
      {openDialog === 'reject' && (
        <RejectDossierDialog dossier={data} onClose={() => setOpenDialog(null)} />
      )}
      {openDialog === 'escalate' && (
        <EscalateDialog dossier={data} onClose={() => setOpenDialog(null)} />
      )}
      {openDialog === 'reassign' && (
        <ReassignDialog dossier={data} onClose={() => setOpenDialog(null)} />
      )}
    </div>
  );
}
```

### 6.13 `repo/apps/web-broker/components/broker-queue/dialogs/validate-dossier-dialog.tsx` (~220 lignes)

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ValidateDossierSchema, type ValidateDossierPayload, type BrokerQueueDetail } from '@/lib/schemas/broker-queue.schema';
import { useValidateDossier } from '@/lib/queries/broker-queue.queries';

interface Props {
  dossier: BrokerQueueDetail;
  onClose: () => void;
}

export function ValidateDossierDialog({ dossier, onClose }: Props) {
  const t = useTranslations('brokerQueue.validateDialog');
  const mutation = useValidateDossier(dossier.id);

  const form = useForm<ValidateDossierPayload>({
    resolver: zodResolver(ValidateDossierSchema),
    defaultValues: {
      commission_rate: dossier.commission_rate_default,
      notes: '',
      checklist: {
        cin_verified: false,
        justif_revenus_verified: false,
        garanties_validated: false,
        prime_confirmed: false,
      },
    },
  });

  const checklist = form.watch('checklist');
  const allChecked = Object.values(checklist).every(Boolean);

  const onSubmit = async (values: ValidateDossierPayload) => {
    try {
      await mutation.mutateAsync(values);
      onClose();
    } catch {
      // toast handled by mutation
    }
  };

  const commissionRate = form.watch('commission_rate');
  const commissionPreviewMad =
    typeof commissionRate === 'number'
      ? Math.round((dossier.prime_total_mad * commissionRate) / 100)
      : dossier.commission_preview_mad;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('description', { customer: dossier.customer.display_name })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t('checklistTitle')}</h3>
            <div className="space-y-2 rounded-md border bg-muted/30 p-3">
              {(['cin_verified', 'justif_revenus_verified', 'garanties_validated', 'prime_confirmed'] as const).map((key) => (
                <label key={key} className="flex items-start gap-3">
                  <Checkbox
                    checked={checklist[key]}
                    onCheckedChange={(v) =>
                      form.setValue(`checklist.${key}`, Boolean(v), { shouldValidate: true })
                    }
                  />
                  <div>
                    <div className="text-sm font-medium">{t(key)}</div>
                    <div className="text-xs text-muted-foreground">{t(`${key}Help`)}</div>
                  </div>
                </label>
              ))}
            </div>
            {!allChecked && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{t('checklistIncomplete')}</AlertDescription>
              </Alert>
            )}
          </section>

          <section className="space-y-2">
            <Label htmlFor="commission_rate">{t('commissionRate')}</Label>
            <div className="flex items-center gap-3">
              <Input
                id="commission_rate"
                type="number"
                step="0.01"
                min={0}
                max={100}
                {...form.register('commission_rate', { valueAsNumber: true })}
                className="max-w-[140px]"
              />
              <span className="text-sm text-muted-foreground">%</span>
              <span className="ms-auto text-sm font-mono">
                = {commissionPreviewMad.toLocaleString('fr-MA')} MAD
              </span>
            </div>
            {form.formState.errors.commission_rate && (
              <p className="text-xs text-destructive">
                {form.formState.errors.commission_rate.message}
              </p>
            )}
          </section>

          <section className="space-y-2">
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea
              id="notes"
              rows={3}
              maxLength={1000}
              placeholder={t('notesPlaceholder')}
              {...form.register('notes')}
            />
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!allChecked || mutation.isPending}
              className="gap-2"
            >
              {mutation.isPending ? t('validating') : t('validateAndGenerate')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.14 `repo/apps/web-broker/components/broker-queue/dialogs/reject-dossier-dialog.tsx` (~190 lignes)

Pattern code analogue au validate-dialog (section 6.13) avec specificites :

```typescript
'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
// ... imports Dialog/Select/Textarea/Checkbox/Label/Button shadcn standard ...
import { RejectDossierSchema, RejectReason, type RejectDossierPayload, type BrokerQueueDetail } from '@/lib/schemas/broker-queue.schema';
import { useRejectDossier } from '@/lib/queries/broker-queue.queries';

export function RejectDossierDialog({ dossier, onClose }: { dossier: BrokerQueueDetail; onClose: () => void }) {
  const t = useTranslations('brokerQueue.rejectDialog');
  const mutation = useRejectDossier(dossier.id);
  const form = useForm<RejectDossierPayload>({
    resolver: zodResolver(RejectDossierSchema),
    defaultValues: { reason: 'documents_incomplete', custom_text: '', notify_customer: true, notification_channels: ['email'] },
  });
  const reason = form.watch('reason');
  const notifyCustomer = form.watch('notify_customer');
  const channels = form.watch('notification_channels');
  // ... onSubmit -> mutation.mutateAsync(values) -> onClose() ...
}
```

Structure render :
1. **DialogTitle** : `<XCircle text-destructive>` + `t('title')`
2. **Select reason** : 6 options enum RejectReason (`documents_incomplete`, `customer_ineligible`, `garanties_unavailable`, `prime_too_high`, `duplicate_dossier`, `other`)
3. **Conditional render** custom_text Textarea si `reason === 'other'` (Zod refine require >= 10 chars)
4. **Checkbox notify_customer** : si checked, expand channels selector (email / whatsapp / sms) avec checkbox multi-select
5. **Channels logic** : `onCheckedChange={(v) => form.setValue('notification_channels', v ? [...channels, ch] : channels.filter(c => c !== ch))}`
6. **Submit button** : `variant="destructive"` rouge + label `Confirmer le rejet` / `Rejet en cours...`
7. **Mutation** : Idempotency-Key UUID + optimistic update status pending -> rejected + toast success "(customer notifie)" si notify_customer

### 6.15 `repo/apps/web-broker/components/broker-queue/dialogs/escalate-dialog.tsx` (~160 lignes)

Structure similaire au reject-dialog (section 6.14) avec :
- `EscalateDossierSchema` resolver react-hook-form
- defaultValues : `escalate_to = currentUser.role === 'broker_admin' ? 'super_admin' : 'broker_admin'`
- Select escalate_to : option `broker_admin` masquee si currentUser deja admin (logique conditional rendering)
- Textarea reason `maxLength=500 min=10` (Zod refine) + Textarea comment `maxLength=1000` optional
- Mutation `useEscalateDossier(dossier.id)` qui envoie Idempotency-Key UUID
- Toast success `Dossier escalade vers {target}` + invalidation queries
- Icone `<ArrowUpCircle text-amber-600>` dans DialogTitle
- DialogContent max-w-xl avec form space-y-5

### 6.16 `repo/apps/web-broker/components/broker-queue/dialogs/reassign-dialog.tsx` (~140 lignes)

Structure analogue a `escalate-dialog.tsx` (section 6.15) avec :
- Form react-hook-form + `ReassignDossierSchema` resolver
- Hook `useTenantUsers({ roles: ['broker_user', 'broker_assistant', 'broker_admin'] })` populate dropdown
- SelectItem disabled si `u.id === dossier.assigned_to_id` (deja assigne)
- Textarea reason `min=10 max=500` chars validation Zod
- Mutation `useReassignDossier(dossier.id)` avec Idempotency-Key
- Component wrapping a faire au call-site : `<HasRole role={['broker_admin']}>` (Tache 4.3.12)
- Toast success "Dossier reassigne vers {display_name}"

Pattern code identique aux dialogues precedents : `<Dialog open onOpenChange>` + `<DialogContent max-w-xl>` + `<form onSubmit={form.handleSubmit(onSubmit)}>` + `<DialogFooter>` avec cancel + submit.

### 6.17 `repo/apps/web-broker/components/broker-queue/dossier-documents-viewer.tsx` (~180 lignes)

Composant viewer documents S3 (Sprint 10) avec :
- Group by `doc.type` (cin_recto / cin_verso / justif_revenus / releve_bancaire / carte_grise / autre)
- Liste compact rows : icon `<FileText>` + filename + `formatBytes(size_bytes)` + verification badge (`Clock pending` / `CheckCircle2 verified` / `XCircle rejected`)
- Click row -> open Dialog preview avec `<DialogContent max-w-4xl>` + `h-[70vh]`
- Preview logic : `mime.startsWith('image/')` -> `<img>` ; `mime === 'application/pdf'` -> `<iframe sandbox="allow-same-origin">` ; sinon download button
- External link icon button per row -> `<a target="_blank" rel="noopener noreferrer">` vers `s3_signed_url`
- Empty state si `documents.length === 0` : "Aucun document fourni"
- Pattern identique aux Cards shadcn precedents : `<Card><CardHeader><CardTitle>{t('title')} ({count})</CardTitle></CardHeader><CardContent>...</CardContent></Card>`

### 6.18 `repo/apps/web-broker/components/broker-queue/dossier-timeline.tsx` (~150 lignes)

Timeline verticale d'events triees desc par `occurred_at`. Pour chaque event :
- Icon map par type : `created` -> CirclePlus, `assigned` -> UserPlus, `reviewed` -> Eye, `note_added` -> MessageSquare, `validated` -> CheckCircle2, `rejected` -> XCircle, `escalated` -> ArrowUpCircle, `reassigned` -> UserCog, `provisional_generated` -> FileText
- Color map par type (blue/violet/slate/amber/emerald/red/orange/cyan/sky) en chip rond `absolute -start-[34px]` sur ligne verticale `<ol className="relative border-s ps-6">`
- Affiche `actor_display_name` + timestamp formate avec `formatInTimeZone(occurred_at, 'Africa/Casablanca', 'dd MMM yyyy HH:mm', { locale: fr|ar })`
- Si `metadata` non vide, expand `<pre>` JSON compact pour debug
- Wrapped dans `<Card><CardHeader><CardTitle>{t('title')}</CardTitle></CardHeader><CardContent>` pattern shadcn standard

### 6.19 `repo/apps/web-broker/components/broker-queue/dossier-notes.tsx` (~130 lignes)

Liste notes broker + textarea ajouter :
- `useState('')` pour body + `useAddDossierNote(dossierId)` mutation
- Sort desc par `created_at`
- Textarea max 2000 chars + compteur live `body.length/2000`
- Button submit disabled si `body.trim().length === 0 || mutation.isPending`
- Render note body avec `dangerouslySetInnerHTML` + `DOMPurify.sanitize(note.body, { ALLOWED_TAGS: ['br','b','i','strong','em'], ALLOWED_ATTR: [] })` -- defense XSS critique
- Display author + timestamp localise (formatInTimeZone Africa/Casablanca)
- Empty state si `notes.length === 0`

### 6.20 `repo/apps/web-broker/components/broker-queue/dossier-garanties-list.tsx` (~140 lignes)

Table garanties demandees :
- Columns : label (avec ShieldCheck icon + Badge "obligatoire" si is_obligatoire) | plafond | franchise | prime
- `Intl.NumberFormat(locale === 'fr' ? 'fr-MA' : 'ar-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 })` formatter helper
- Tfoot : prime_total_mad bold + commission_preview_mad subtle ligne separe
- `<table className="w-full text-sm">` avec thead bg-muted/40 + tbody border-t separators
- Wrapping shadcn Card standard

### 6.21 `repo/apps/web-broker/components/broker-queue/dossier-header-card.tsx` (~120 lignes)

Card header detail dossier :
- `<Avatar>` initiales customer.display_name (slice 0,2 majuscule)
- Title h2 customer name + badges segment + branche
- Inline icons row : Phone (tel:), Mail (mailto:), MapPin city
- Row badges : source / priority / status
- Lien conditional `<Link href="/polices/{provisional_policy.id}">` si `dossier.provisional_policy`
- Right side : `<SlaTimer sla_due_at variant="full">` + age_hours text muted
- Layout `flex-col lg:flex-row lg:justify-between` responsive

### 6.22 `repo/apps/web-broker/components/broker-queue/row-actions.tsx` (~80 lignes)

```typescript
'use client';

import { MoreHorizontal, CheckCircle2, XCircle, UserPlus, ArrowUpCircle, UserCog } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { HasRole } from '@/components/auth/has-role';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { useAssignDossier } from '@/lib/queries/broker-queue.queries';
import type { BrokerQueueItem } from '@/lib/schemas/broker-queue.schema';

interface Props {
  dossier: BrokerQueueItem;
}

export function RowActions({ dossier }: Props) {
  const t = useTranslations('brokerQueue.actions');
  const router = useRouter();
  const currentUser = useCurrentUser();
  const assignMutation = useAssignDossier(dossier.id);

  const canTakeAction = dossier.status === 'pending' || dossier.status === 'in_review';
  const isAssignedToMe = dossier.assigned_to_id === currentUser.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('open')}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push(`/broker-queue/${dossier.id}`)}>
          {t('viewDetail')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {!isAssignedToMe && canTakeAction && (
          <DropdownMenuItem
            onClick={() => assignMutation.mutate({ user_id: currentUser.id })}
            disabled={assignMutation.isPending}
          >
            <UserPlus className="me-2 h-4 w-4" />
            {t('assignToMe')}
          </DropdownMenuItem>
        )}
        {isAssignedToMe && canTakeAction && (
          <>
            <DropdownMenuItem onClick={() => router.push(`/broker-queue/${dossier.id}?action=validate`)}>
              <CheckCircle2 className="me-2 h-4 w-4 text-emerald-600" />
              {t('validate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/broker-queue/${dossier.id}?action=reject`)}>
              <XCircle className="me-2 h-4 w-4 text-destructive" />
              {t('reject')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push(`/broker-queue/${dossier.id}?action=escalate`)}>
              <ArrowUpCircle className="me-2 h-4 w-4 text-amber-600" />
              {t('escalate')}
            </DropdownMenuItem>
          </>
        )}
        <HasRole role={['broker_admin']}>
          {canTakeAction && (
            <DropdownMenuItem onClick={() => router.push(`/broker-queue/${dossier.id}?action=reassign`)}>
              <UserCog className="me-2 h-4 w-4" />
              {t('reassign')}
            </DropdownMenuItem>
          )}
        </HasRole>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### 6.23 `repo/apps/web-broker/lib/hooks/use-poll-broker-queue.ts` (~40 lignes)

```typescript
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { brokerQueueKeys } from '@/lib/queries/broker-queue.queries';

export function usePollBrokerQueue(intervalMs: number = 30_000) {
  const qc = useQueryClient();

  useEffect(() => {
    const handle = window.setInterval(() => {
      qc.invalidateQueries({ queryKey: brokerQueueKeys.lists() });
    }, intervalMs);

    const onFocus = () => {
      qc.invalidateQueries({ queryKey: brokerQueueKeys.lists() });
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        qc.invalidateQueries({ queryKey: brokerQueueKeys.lists() });
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(handle);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [qc, intervalMs]);
}
```

---

## 7. Tests complets (15-30 ko)

### 7.1 Vitest unit tests : `lib/utils/__tests__/sla-calculator.spec.ts` (~250 lignes, 12 tests)

```typescript
import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest';
import {
  computeSlaTier,
  getSlaBadgeClassName,
  type SlaTier,
} from '@/lib/utils/sla-calculator';

const FIXED_NOW = new Date('2026-05-18T10:00:00.000Z'); // Africa/Casablanca = +01:00 -> 11:00 local

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterAll(() => {
  vi.useRealTimers();
});

describe('computeSlaTier', () => {
  it('returns green when remaining > 12h', () => {
    const due = new Date(FIXED_NOW.getTime() + 13 * 3_600_000);
    const tier = computeSlaTier(due, FIXED_NOW);
    expect(tier.color).toBe('green');
    expect(tier.severity).toBe(0);
    expect(tier.isOverdue).toBe(false);
    expect(tier.remainingHours).toBeCloseTo(13, 5);
  });

  it('returns yellow when remaining between 6h and 12h', () => {
    const due = new Date(FIXED_NOW.getTime() + 10 * 3_600_000);
    const tier = computeSlaTier(due, FIXED_NOW);
    expect(tier.color).toBe('yellow');
    expect(tier.severity).toBe(1);
  });

  it('returns yellow at exactly 12h boundary minus 1 minute', () => {
    const due = new Date(FIXED_NOW.getTime() + 11.99 * 3_600_000);
    const tier = computeSlaTier(due, FIXED_NOW);
    expect(tier.color).toBe('yellow');
  });

  it('returns green at exactly 12h boundary plus 1 minute', () => {
    const due = new Date(FIXED_NOW.getTime() + 12.02 * 3_600_000);
    const tier = computeSlaTier(due, FIXED_NOW);
    expect(tier.color).toBe('green');
  });

  it('returns orange when remaining between 1h and 6h', () => {
    const due = new Date(FIXED_NOW.getTime() + 3 * 3_600_000);
    const tier = computeSlaTier(due, FIXED_NOW);
    expect(tier.color).toBe('orange');
    expect(tier.severity).toBe(2);
  });

  it('returns red when remaining < 1h but > 0', () => {
    const due = new Date(FIXED_NOW.getTime() + 30 * 60_000);
    const tier = computeSlaTier(due, FIXED_NOW);
    expect(tier.color).toBe('red');
    expect(tier.severity).toBe(3);
    expect(tier.remainingMinutes).toBeCloseTo(30, 5);
  });

  it('returns dark_red when overdue (remaining < 0)', () => {
    const due = new Date(FIXED_NOW.getTime() - 2 * 3_600_000);
    const tier = computeSlaTier(due, FIXED_NOW);
    expect(tier.color).toBe('dark_red');
    expect(tier.severity).toBe(4);
    expect(tier.isOverdue).toBe(true);
    expect(tier.remainingHours).toBeLessThan(0);
  });

  it('handles ISO string input', () => {
    const due = new Date(FIXED_NOW.getTime() + 13 * 3_600_000).toISOString();
    const tier = computeSlaTier(due, FIXED_NOW);
    expect(tier.color).toBe('green');
  });

  it('returns green "No SLA" when input is null', () => {
    const tier = computeSlaTier(null, FIXED_NOW);
    expect(tier.color).toBe('green');
    expect(tier.labelKey).toBe('brokerQueue.sla.none');
    expect(tier.remainingMs).toBe(Infinity);
  });

  it('returns dark_red "Invalid SLA" on invalid date', () => {
    const tier = computeSlaTier('not-a-date', FIXED_NOW);
    expect(tier.color).toBe('dark_red');
    expect(tier.labelKey).toBe('brokerQueue.sla.invalid');
  });

  it('uses live Date.now() when no now provided', () => {
    const due = new Date(FIXED_NOW.getTime() + 5 * 3_600_000);
    const tier = computeSlaTier(due);
    expect(tier.color).toBe('orange');
  });

  it('returns proper className mapping for each color', () => {
    expect(getSlaBadgeClassName('green')).toMatch(/emerald/);
    expect(getSlaBadgeClassName('yellow')).toMatch(/amber/);
    expect(getSlaBadgeClassName('orange')).toMatch(/orange/);
    expect(getSlaBadgeClassName('red')).toMatch(/red/);
    expect(getSlaBadgeClassName('dark_red')).toMatch(/ring-red/);
  });
});
```

### 7.2 Vitest component test : `components/__tests__/broker-queue/sla-timer.spec.ts` (~220 lignes, 8 tests)

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { SlaTimer } from '@/components/broker-queue/sla-timer';
import frMessages from '@/messages/fr.json';

function renderWithIntl(ui: React.ReactNode, locale = 'fr') {
  return render(
    <NextIntlClientProvider locale={locale} messages={frMessages} timeZone="Africa/Casablanca">
      {ui}
    </NextIntlClientProvider>
  );
}

describe('<SlaTimer>', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-18T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders green badge when sla_due_at is far in future', () => {
    const due = new Date(Date.now() + 20 * 3_600_000).toISOString();
    renderWithIntl(<SlaTimer sla_due_at={due} />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-sla-color', 'green');
  });

  it('renders dark_red badge with animate-pulse when overdue', () => {
    const due = new Date(Date.now() - 3 * 3_600_000).toISOString();
    renderWithIntl(<SlaTimer sla_due_at={due} />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-sla-color', 'dark_red');
    expect(badge.className).toMatch(/animate-pulse/);
  });

  it('aria-live polite for screen readers', () => {
    const due = new Date(Date.now() + 5 * 3_600_000).toISOString();
    renderWithIntl(<SlaTimer sla_due_at={due} />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-live', 'polite');
    expect(badge).toHaveAttribute('aria-atomic', 'true');
  });

  it('recomputes tier every second', () => {
    const due = new Date(Date.now() + 1 * 3_600_000 + 1000).toISOString();
    renderWithIntl(<SlaTimer sla_due_at={due} />);
    let badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-sla-color', 'orange');

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('data-sla-color', 'red');
  });

  it('transitions green -> yellow -> orange -> red -> dark_red over time', () => {
    const due = new Date(Date.now() + 13 * 3_600_000).toISOString();
    renderWithIntl(<SlaTimer sla_due_at={due} />);

    expect(screen.getByRole('status')).toHaveAttribute('data-sla-color', 'green');

    act(() => {
      vi.advanceTimersByTime(2 * 3_600_000); // +2h -> 11h remaining
    });
    expect(screen.getByRole('status')).toHaveAttribute('data-sla-color', 'yellow');

    act(() => {
      vi.advanceTimersByTime(6 * 3_600_000); // +6h -> 5h remaining
    });
    expect(screen.getByRole('status')).toHaveAttribute('data-sla-color', 'orange');

    act(() => {
      vi.advanceTimersByTime(4.5 * 3_600_000); // +4.5h -> 0.5h remaining
    });
    expect(screen.getByRole('status')).toHaveAttribute('data-sla-color', 'red');

    act(() => {
      vi.advanceTimersByTime(2 * 3_600_000); // overdue
    });
    expect(screen.getByRole('status')).toHaveAttribute('data-sla-color', 'dark_red');
  });

  it('cleans up setInterval on unmount', () => {
    const due = new Date(Date.now() + 5 * 3_600_000).toISOString();
    const { unmount } = renderWithIntl(<SlaTimer sla_due_at={due} />);
    const clearSpy = vi.spyOn(window, 'clearInterval');
    unmount();
    expect(clearSpy).toHaveBeenCalled();
  });

  it('renders compact variant by default', () => {
    const due = new Date(Date.now() + 5 * 3_600_000).toISOString();
    renderWithIntl(<SlaTimer sla_due_at={due} />);
    const badge = screen.getByRole('status');
    expect(badge.tagName).toBe('SPAN');
  });

  it('renders full variant as div with extra text', () => {
    const due = new Date(Date.now() - 1 * 3_600_000).toISOString();
    renderWithIntl(<SlaTimer sla_due_at={due} variant="full" />);
    const badge = screen.getByRole('status');
    expect(badge.tagName).toBe('DIV');
  });
});
```

### 7.3 Vitest schema test : `lib/schemas/__tests__/broker-queue.schema.spec.ts` (~200 lignes, 10 tests)

```typescript
import { describe, it, expect } from 'vitest';
import {
  BrokerQueueItemSchema,
  BrokerQueueDetailSchema,
  ValidateDossierSchema,
  RejectDossierSchema,
  EscalateDossierSchema,
  ReassignDossierSchema,
  AddNoteSchema,
  QueueFiltersSchema,
} from '@/lib/schemas/broker-queue.schema';

const validQueueItem = {
  id: '11111111-1111-1111-1111-111111111111',
  policy_number_provisional: 'PROV-2026-00042',
  customer: {
    id: '22222222-2222-2222-2222-222222222222',
    display_name: 'Mehdi Bennani',
    first_name: 'Mehdi',
    last_name: 'Bennani',
    cin: 'BE123456',
    phone: '+212661234567',
    email: 'mehdi@example.ma',
    segment: 'individuel' as const,
  },
  branche: 'auto' as const,
  amount_estimated_mad: 8500,
  source: 'web_portal' as const,
  priority: 'normal' as const,
  status: 'pending' as const,
  assigned_to_id: null,
  assigned_to_display_name: null,
  sla_due_at: '2026-05-19T10:00:00.000Z',
  sla_overdue: false,
  created_at: '2026-05-18T10:00:00.000Z',
  updated_at: '2026-05-18T10:00:00.000Z',
  age_hours: 2,
};

describe('BrokerQueueItemSchema', () => {
  it('parses valid queue item', () => {
    const parsed = BrokerQueueItemSchema.parse(validQueueItem);
    expect(parsed.id).toBe(validQueueItem.id);
  });

  it('rejects invalid CIN format', () => {
    const bad = {
      ...validQueueItem,
      customer: { ...validQueueItem.customer, cin: '123abc' },
    };
    expect(() => BrokerQueueItemSchema.parse(bad)).toThrow();
  });

  it('rejects invalid Moroccan phone format', () => {
    const bad = {
      ...validQueueItem,
      customer: { ...validQueueItem.customer, phone: '+33612345678' },
    };
    expect(() => BrokerQueueItemSchema.parse(bad)).toThrow();
  });

  it('allows null cin/email/phone', () => {
    const ok = {
      ...validQueueItem,
      customer: { ...validQueueItem.customer, cin: null, email: null, phone: null },
    };
    expect(() => BrokerQueueItemSchema.parse(ok)).not.toThrow();
  });
});

describe('ValidateDossierSchema', () => {
  it('accepts valid payload', () => {
    const result = ValidateDossierSchema.parse({
      commission_rate: 10.5,
      checklist: {
        cin_verified: true,
        justif_revenus_verified: true,
        garanties_validated: true,
        prime_confirmed: true,
      },
    });
    expect(result.commission_rate).toBe(10.5);
  });

  it('rejects commission_rate > 100', () => {
    expect(() =>
      ValidateDossierSchema.parse({
        commission_rate: 150,
        checklist: { cin_verified: true, justif_revenus_verified: true, garanties_validated: true, prime_confirmed: true },
      })
    ).toThrow();
  });
});

describe('RejectDossierSchema', () => {
  it('rejects "other" reason without custom_text', () => {
    expect(() =>
      RejectDossierSchema.parse({ reason: 'other', notify_customer: true })
    ).toThrow();
  });

  it('accepts "other" reason with custom_text >= 10 chars', () => {
    const result = RejectDossierSchema.parse({
      reason: 'other',
      custom_text: 'Customer changed his mind',
      notify_customer: true,
    });
    expect(result.reason).toBe('other');
  });

  it('accepts non-other reasons without custom_text', () => {
    const result = RejectDossierSchema.parse({
      reason: 'documents_incomplete',
      notify_customer: true,
    });
    expect(result.reason).toBe('documents_incomplete');
  });
});

describe('QueueFiltersSchema', () => {
  it('defaults to tab=mes and empty arrays', () => {
    const result = QueueFiltersSchema.parse({});
    expect(result.tab).toBe('mes');
    expect(result.status).toEqual([]);
    expect(result.sort).toBe('sla_due_at');
    expect(result.sort_dir).toBe('asc');
  });
});

describe('EscalateDossierSchema', () => {
  it('rejects reason shorter than 10 chars', () => {
    expect(() =>
      EscalateDossierSchema.parse({ escalate_to: 'broker_admin', reason: 'short' })
    ).toThrow();
  });
});
```

### 7.4 Vitest queries tests : `lib/queries/__tests__/broker-queue.queries.spec.ts` (~220 lignes)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { brokerQueueApi } from '@/lib/api/broker-queue.api';
import {
  useBrokerQueueList,
  useValidateDossier,
  useRejectDossier,
  useAssignDossier,
} from '@/lib/queries/broker-queue.queries';

vi.mock('@/lib/api/broker-queue.api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('useBrokerQueueList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches queue with filters', async () => {
    const mockResp = {
      items: [],
      next_cursor: null,
      total_count: 0,
      counts_per_tab: { mes: 0, tous: 0, en_retard: 0 },
    };
    vi.mocked(brokerQueueApi.list).mockResolvedValue(mockResp);

    const { result } = renderHook(() => useBrokerQueueList({ tab: 'mes' }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(brokerQueueApi.list).toHaveBeenCalledWith({ tab: 'mes' });
  });
});

describe('useValidateDossier', () => {
  beforeEach(() => vi.clearAllMocks());

  it('optimistically updates detail to validated status', async () => {
    const dossierId = '11111111-1111-1111-1111-111111111111';
    vi.mocked(brokerQueueApi.validate).mockResolvedValue({} as any);

    const { result } = renderHook(() => useValidateDossier(dossierId), {
      wrapper: wrapper(),
    });

    await result.current.mutateAsync({
      commission_rate: 10,
      checklist: { cin_verified: true, justif_revenus_verified: true, garanties_validated: true, prime_confirmed: true },
    });

    expect(brokerQueueApi.validate).toHaveBeenCalledWith(
      dossierId,
      expect.objectContaining({ commission_rate: 10 })
    );
  });
});

describe('useRejectDossier', () => {
  it('passes notify_customer and channels to API', async () => {
    const dossierId = '11111111-1111-1111-1111-111111111111';
    vi.mocked(brokerQueueApi.reject).mockResolvedValue({} as any);

    const { result } = renderHook(() => useRejectDossier(dossierId), {
      wrapper: wrapper(),
    });

    await result.current.mutateAsync({
      reason: 'documents_incomplete',
      notify_customer: true,
      notification_channels: ['email', 'whatsapp'],
    });

    expect(brokerQueueApi.reject).toHaveBeenCalledWith(
      dossierId,
      expect.objectContaining({
        notification_channels: ['email', 'whatsapp'],
      })
    );
  });
});

describe('useAssignDossier', () => {
  it('rolls back optimistic update on error', async () => {
    const dossierId = '11111111-1111-1111-1111-111111111111';
    vi.mocked(brokerQueueApi.assign).mockRejectedValue(new Error('403 Forbidden'));

    const { result } = renderHook(() => useAssignDossier(dossierId), {
      wrapper: wrapper(),
    });

    await expect(
      result.current.mutateAsync({ user_id: 'some-uuid' })
    ).rejects.toThrow();
  });
});
```

### 7.5 Playwright E2E : `repo/e2e/web/broker-queue.spec.ts` (~400 lignes, 12 tests)

Suite tests organisee en 2 `test.describe` :

**A. `Broker Queue - liste` (6 tests)** :

```typescript
import { test, expect, type Page } from '@playwright/test';
import { loginAsBrokerUser, loginAsBrokerAdmin, seedDossier } from '../fixtures/auth-helpers';

async function gotoQueue(page: Page, tab: 'mes' | 'tous' | 'en_retard' = 'mes') {
  await page.goto(`/fr/broker-queue?tab=${tab}`);
  await page.waitForLoadState('networkidle');
}

test.describe('Broker Queue - liste', () => {
  test('badge SLA dark_red et animation pulse pour dossier overdue', async ({ page }) => {
    const dossierId = await seedDossier(page, {
      sla_due_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    });
    await loginAsBrokerUser(page);
    await gotoQueue(page, 'en_retard');

    const row = page.locator(`tr[data-row-id="${dossierId}"]`);
    const badge = row.locator('[role="status"]');
    await expect(badge).toHaveAttribute('data-sla-color', 'dark_red');
    await expect(badge).toHaveClass(/animate-pulse/);
  });

  // Autres tests liste (resumes -- pattern identique) :
  // - test('affiche 3 onglets pour broker_admin') -> getByRole('tab') x3 visible
  // - test('masque onglet "Tous" pour broker_user') -> not.toBeVisible
  // - test('badge SLA green pour dossier > 12h') -> data-sla-color="green"
  // - test('filtres URL persistent apres reload') -> .fill + reload + toHaveValue
  // - test('refetch automatique apres 30s polling') -> page.route spy + waitForTimeout(31_000)
});
```

**B. `Broker Queue - actions` (6 tests)** :

```typescript
test.describe('Broker Queue - actions', () => {
  test('flux validate complet -> police generee + invalidation', async ({ page }) => {
    const dossierId = await seedDossier(page, { status: 'in_review', assigned_to_me: true });
    await loginAsBrokerUser(page);
    await page.goto(`/fr/broker-queue/${dossierId}`);

    await page.getByRole('button', { name: /^valider$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const submit = page.getByRole('button', { name: /valider et generer/i });
    await expect(submit).toBeDisabled();

    // Check all checklist items
    await page.getByRole('checkbox', { name: /cin/i }).click();
    await page.getByRole('checkbox', { name: /justificatifs/i }).click();
    await page.getByRole('checkbox', { name: /garanties/i }).click();
    await page.getByRole('checkbox', { name: /prime/i }).click();

    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(page.getByText(/dossier valide/i)).toBeVisible();
  });

  // Autres tests actions (resumes -- pattern identique) :
  // - test('reject avec custom reason et notify customer') -> select "other" + custom_text + notify checkbox + confirm
  // - test('assign to me self-claim') -> click "M assigner" + toast success
  // - test('escalate to broker_admin') -> select target + reason + comment + confirm
  // - test('reassign disponible UNIQUEMENT pour broker_admin') -> 2 logins comparison visibility
  // - test('locale switch fr -> ar applique RTL') -> html[dir="rtl"] + html[lang="ar"]
  // - test('checklist Validate empeche submit incomplete') -> 3/4 cocher -> submit disabled + alert visible
});
```

Helpers `auth-helpers.ts` (heritage Sprint 5 + Sprint 15) :
- `loginAsBrokerUser(page)` : POST /api/auth/signin avec broker_user fixture credentials + set cookies
- `loginAsBrokerAdmin(page)` : idem avec broker_admin role
- `seedDossier(page, overrides)` : POST /api/v1/insure/broker/queue/_seed (test-only endpoint Sprint 15) -> retourne dossier_id

Coverage : 12 tests passent en CI sur Chromium + WebKit + Firefox. Total runtime ~3 min sur worker parallele.

---

## 8. Variables d'environnement (1-3 ko)

Ajouter dans `repo/apps/web-broker/.env.example` (heritage Tache 4.3.1) :

```env
# === SPRINT 16 / TACHE 4.3.9 -- Broker Queue ===
# Polling interval queue list (ms) -- defaut 30s
NEXT_PUBLIC_BROKER_QUEUE_POLL_INTERVAL=30000

# Polling interval queue detail (ms) -- defaut 30s
NEXT_PUBLIC_BROKER_QUEUE_DETAIL_POLL_INTERVAL=30000

# SLA timer refresh tick (ms) -- defaut 1000
NEXT_PUBLIC_SLA_TIMER_TICK=1000

# Toast deduplication window (ms)
NEXT_PUBLIC_TOAST_DEDUP_WINDOW=3000

# Max documents preview size before fallback download
NEXT_PUBLIC_DOC_PREVIEW_MAX_MB=10

# Idempotency-Key TTL (cache local in sessionStorage, ms) -- 24h
NEXT_PUBLIC_IDEMPOTENCY_TTL=86400000

# Feature flags
NEXT_PUBLIC_FEATURE_SSE_REALTIME=false  # Sprint 23+ migration cible
NEXT_PUBLIC_FEATURE_BROKER_QUEUE_BULK=false  # bulk validate/reject future
```

Variables backend Sprint 15 referencees (a documenter cote API team) :

```env
# Sprint 15 (rappel pour devs frontend)
INSURE_BROKER_QUEUE_DEFAULT_SLA_HOURS=24
INSURE_BROKER_QUEUE_URGENT_SLA_HOURS=4
INSURE_BROKER_QUEUE_COMPLEX_SLA_HOURS=72
INSURE_BROKER_QUEUE_ESCALATE_AUTO_ENABLED=true
```

---

## 9. Commandes shell (1-2 ko)

### 9.1 Bootstrap dev local

```bash
# Prerequis : Sprints 1-15 deployes, web-broker bootstrap 1.4.1 OK

# Demarrer backend Sprint 15
cd repo
pnpm --filter @insurtech/api dev &  # port 4000

# Demarrer web-broker
pnpm --filter @insurtech/web-broker dev  # port 3001

# Ouvrir
open http://localhost:3001/fr/broker-queue
```

### 9.2 Verification du livrable

```bash
# Lint + typecheck + tests unitaires + e2e + lighthouse
pnpm --filter @insurtech/web-broker lint
pnpm --filter @insurtech/web-broker typecheck
pnpm --filter @insurtech/web-broker test
pnpm --filter @insurtech/web-broker test:e2e -- broker-queue
pnpm --filter @insurtech/web-broker lh -- /fr/broker-queue

# Verifications no-emoji + no-console
grep -r "emoji-regex" repo/apps/web-broker/components/broker-queue/
grep -r "console.log" repo/apps/web-broker/components/broker-queue/

# Coverage rapport
pnpm --filter @insurtech/web-broker test -- --coverage

# Validation i18n parite cles
pnpm tsx repo/scripts/validate-broker-queue-i18n.ts
```

### 9.3 Workflow git

```bash
git checkout -b feat/sprint-16/4.3.9-broker-queue
git add repo/apps/web-broker/components/broker-queue/
git add repo/apps/web-broker/app/[locale]/(protected)/broker-queue/
git add repo/apps/web-broker/lib/queries/broker-queue.queries.ts
git add repo/apps/web-broker/lib/api/broker-queue.api.ts
git add repo/apps/web-broker/lib/schemas/broker-queue.schema.ts
git add repo/apps/web-broker/lib/utils/sla-calculator.ts
git add repo/apps/web-broker/messages/*.json
git add repo/e2e/web/broker-queue.spec.ts
git commit -m "feat(web-broker): broker queue page + SLA timer + 4 dialogs (sprint-16 4.3.9)"
git push -u origin feat/sprint-16/4.3.9-broker-queue
```

---

## 10. Criteres validation V1-V27

### 10.1 Criteres P0 (16 -- bloquants merge)

- **V1 (P0)** : Page `/fr/broker-queue` charge en < 1.5s avec 50 dossiers seed, paint HTML server-side avec skeletons, hydratation client TanStack Query OK.

- **V2 (P0)** : 3 onglets `Mes / Tous / En retard` fonctionnels, URL sync nuqs `?tab=mes`. Onglet `Tous` masque pour broker_user (verifie e2e RBAC).

- **V3 (P0)** : DataTable affiche colonnes customer + branche + amount MAD format + source + SLA timer + priority + status + assigned_to + age + actions.

- **V4 (P0)** : SLA timer live countdown re-render chaque seconde, badge couleur change correctement aux transitions 12h/6h/1h/0h. 12 tests Vitest passent.

- **V5 (P0)** : Filtres status/branche/source/priority/search applique correctement, URL sync nuqs, clear-all button reset.

- **V6 (P0)** : Sort par sla_due_at asc default, switchable priority/amount/created_at, direction asc/desc.

- **V7 (P0)** : Pagination cursor next_cursor functional, "Load more" button apparait si has more.

- **V8 (P0)** : Polling 30s automatique, queries invalidated, nouveau dossier apparait sans refresh manuel. Tab focus + visibilitychange events triggerent refetch.

- **V9 (P0)** : Page detail `/broker-queue/[id]` charge complete : header + garanties + documents + timeline + notes + actions bar.

- **V10 (P0)** : ValidateDialog : checklist 4 items oblig + commission rate input + commission preview live + notes optionnelle. Submit disabled tant que checklist incomplete. Mutation envoie Idempotency-Key, optimistic update status -> validated, toast success avec policy_number.

- **V11 (P0)** : RejectDialog : reason dropdown 6 options + custom_text si "other" (validation Zod >= 10 chars) + notify_customer checkbox + channels selector email/whatsapp/sms. Mutation envoie Idempotency-Key.

- **V12 (P0)** : EscalateDialog : escalate_to dropdown (broker_admin/super_admin selon role courant) + reason >= 10 chars + comment optionnel. Mutation envoie Idempotency-Key.

- **V13 (P0)** : ReassignDialog : user_id selector liste users tenant + reason >= 10 chars. Visible UNIQUEMENT pour broker_admin (HasRole wrapping). Mutation envoie Idempotency-Key.

- **V14 (P0)** : Assign to me : POST /assign avec user_id=currentUser.id, optimistic update status pending -> in_review, toast success.

- **V15 (P0)** : Documents viewer : list grouped par type, preview inline iframe pour PDF, img pour images, download fallback autres types. S3 signed URLs respectees.

- **V16 (P0)** : 10+ tests Playwright E2E passent (validate flow, reject + notify, assign self, escalate, reassign admin-only, SLA color progression, filtres URL persist, polling, RTL switch, checklist).

### 10.2 Criteres P1 (7 -- recommandes)

- **V17 (P1)** : Timeline events tries desc avec icones color-coded + actor + timestamp format Africa/Casablanca + metadata JSON expandable.

- **V18 (P1)** : Notes : list + textarea ajouter + DOMPurify sanitize render + audit trail (author + timestamp affiches).

- **V19 (P1)** : Provisional policy link affiche header si dossier.provisional_policy. Warning si is_expired = true mais validation pas bloquee.

- **V20 (P1)** : Coverage Vitest >= 85% sur sla-calculator + queries + schemas.

- **V21 (P1)** : I18n 3 locales fr/ar-MA/ar parite cles complete (CI validate-broker-queue-i18n.ts pass).

- **V22 (P1)** : RTL ar/ar-MA : icones flip (`rtl:rotate-180` sur chevrons), padding-start/end (ms/me) not ml/mr, table direction correcte.

- **V23 (P1)** : Accessibilite WCAG 2.1 AA : SLA timer aria-live polite, dialog focus trap, escape close, tab order coherent, color contrast OK.

### 10.3 Criteres P2 (4 -- nice-to-have)

- **V24 (P2)** : Virtualisation TanStack Virtual si > 100 rows visibles (perf optim).

- **V25 (P2)** : Toast deduplication sonner grouping si > 3 notifications 30s.

- **V26 (P2)** : Lighthouse Performance >= 70 sur /fr/broker-queue.

- **V27 (P2)** : Tests fuzz Zod schemas avec @anatine/zod-mock pour edge cases input.

---

## 11. Edge cases + troubleshooting (3-5 ko, 12 cases)

### EC-01 : SLA timer pendant tab background (Safari iOS)

**Symptome** : sur Safari iOS, timer SLA reste fige pendant que l'utilisateur switch app (WhatsApp customer), au retour le badge affiche encore l'ancienne couleur.

**Diagnostic** : Safari throttle `setInterval` a 0.5Hz ou pause complete onglet background apres ~60s. Le composant `<SlaTimer>` ne re-evalue pas.

**Solution** : event listener `document.visibilitychange` qui re-call `computeSlaTier()` quand l'onglet redevient visible. Deja implemente section 6.5.

```typescript
const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    setTier(computeSlaTier(sla_due_at));
  }
};
document.addEventListener('visibilitychange', onVisibilityChange);
```

### EC-02 : Real-time notifications fail silently

**Symptome** : backend Sprint 9 NotificationService down (deploy in progress), queue list affiche cached data mais nouveau dossier assigne pas detecte.

**Diagnostic** : TanStack Query polling retry 3x avec exponential backoff puis passe en error state. Query reste avec `data` = previous cache (`keepPreviousData`).

**Solution** : composant `<QueueClient>` detecte `error && !isLoading` et affiche `<Alert variant="destructive">` avec bouton "Retry" + toast non-bloquant. La liste reste fonctionnelle avec cached items.

### EC-03 : Validate sans documents complets blocked

**Symptome** : user click Validate, checklist 4 items s'affiche, user check seulement 2 items, bouton submit reste disabled.

**Diagnostic** : computed `allChecked = Object.values(checklist).every(Boolean)` controls disabled state. Backend Sprint 15 valide aussi cote serveur (defense profondeur).

**Solution** : pas de fix necessaire -- comportement attendu. Message Alert affiche `Tous les elements de checklist doivent etre verifies`.

### EC-04 : Reject sans reason blocked

**Symptome** : user open RejectDialog, click submit sans selectionner reason, form ne submit pas.

**Diagnostic** : Zod resolver react-hook-form `RejectDossierSchema` defaut a `documents_incomplete` donc reason est toujours set. Si user choisit `other`, validation refine bloque submit si custom_text < 10 chars.

**Solution** : message inline `<p className="text-xs text-destructive">` sous textarea custom_text si erreur.

### EC-05 : Double validate race condition

**Symptome** : user double-click rapide bouton Validate, deux requetes POST /validate envoyees.

**Diagnostic** : sans protection, deux POST -> backend Sprint 15 cree deux polices definitives (catastrophe metier).

**Solution** : (1) bouton submit disabled `disabled={mutation.isPending}` ; (2) Idempotency-Key UUID identique pour les deux requetes serait IDEAL mais les UUIDs sont generes a chaque `mutateAsync`. Mitigation cote backend Sprint 15 : detection dossier deja `status = validated` retourne idempotent 200.

### EC-06 : Escalate non-superadmin

**Symptome** : broker_user (pas admin) clique Escalate, voit option `broker_admin` dans dropdown.

**Diagnostic** : code dans `<EscalateDialog>` check `currentUser.role === 'broker_admin'` pour masquer option `broker_admin` (car deja admin, n'escalade que vers super_admin).

**Solution** : conditional rendering sur SelectItem deja en place section 6.15.

```tsx
{currentUser.role !== 'broker_admin' && (
  <SelectItem value="broker_admin">{t('target_broker_admin')}</SelectItem>
)}
```

### EC-07 : ProvisionalPolicy expired pendant review

**Symptome** : dossier reference provisional_policy avec `expires_at` 2026-05-17, broker review le 2026-05-19 -> provisional expiree.

**Diagnostic** : backend Sprint 15 met `provisional_policy.is_expired = true` automatiquement. Frontend affiche warning Alert.

**Solution** : composant `<DossierDetailClient>` affiche `<Alert>` avec message `Provisional expiree -- une nouvelle police definitive sera generee a la validation`. Validation reste autorisee.

### EC-08 : Customer notify email bounce

**Symptome** : user reject avec notify_customer + email channel, customer email invalid -> bounce.

**Diagnostic** : Sprint 9 NotificationService gere les bounces async via webhook SES. Frontend ne sait pas immediatement.

**Solution** : toast success affiche `Dossier rejete (customer notifie)` apres POST /reject succes. Si bounce detecte plus tard, Sprint 9 cree event timeline `notification_bounced` qui apparait au prochain refresh detail. Pas de fix synchrone.

### EC-09 : Dossier deleted while open

**Symptome** : broker_admin supprime un dossier (Sprint 15 future feature), broker_user a la detail page ouverte -> 404 au prochain polling 30s.

**Diagnostic** : `useBrokerQueueDetail(id)` retourne error 404, `<DossierDetailClient>` detecte error.

**Solution** : redirect `router.push('/broker-queue?deleted=' + id)` + toast `Dossier supprime` + invalidate liste. Implemente dans error.tsx + not-found.tsx.

### EC-10 : Locale switch SLA label

**Symptome** : badge SLA affiche `< 1h` en fr, user switch vers ar -> doit afficher `أقل من ساعة`.

**Diagnostic** : `<SlaTimer>` recompute `i18nLabel` via `useTranslations` qui re-render au locale change. `useMemo` invalide automatiquement.

**Solution** : aucune action -- comportement attendu. Tests Playwright EC verifient.

### EC-11 : RTL countdown direction

**Symptome** : en RTL ar, badge `< 6h` doit afficher en ordre arabe naturel (RTL flow) avec icone Clock a droite.

**Diagnostic** : Tailwind `inline-flex` + utilities `gap-1` agnostique direction. Icone Clock avant span text par defaut LTR. RTL flip automatique avec `dir="rtl"` sur html.

**Solution** : aucune action explicite -- Tailwind flexbox respecte writing-direction. Verifier visuellement test screenshot.

### EC-12 : Tabs filter persists URL deep link

**Symptome** : user partage URL `/fr/broker-queue?tab=en_retard&status=pending&branche=auto` a un collegue.

**Diagnostic** : nuqs `useQueryStates` lit URL au mount, applique filters. Server Component RSC peut aussi pre-fetch avec filters dans `searchParams`.

**Solution** : `<QueueClient initialSearchParams={sp}>` recoit searchParams server-side et hydrate state. Tests Playwright verifient.

### Troubleshooting commun

| Probleme | Diagnostic | Resolution |
|----------|-----------|------------|
| `crypto.randomUUID is not a function` | Old Safari < 15.4 | Polyfill `lib/crypto-id.ts` (heritage 1.4.1) |
| SLA badge ne re-render pas | useState bloque par memo | Verifier dependances useMemo, supprimer si necessaire |
| Idempotency-Key 409 Conflict | Cle reutilisee accidentellement | Generer fresh UUID dans onSubmit, jamais en module scope |
| Optimistic update flicker | Backend trop rapide | Augmenter staleTime ou supprimer optimistic |
| Toast spam 10x meme erreur | Mutation retry sans cleanup | Verifier `retry: 0` dans mutationOptions |
| Filter URL casse en arabe | URL encoding | Encode searchParams via `URLSearchParams` API, jamais string concat |

---

## 12. Conformite Maroc detaillee (1-3 ko)

### 12.1 ACAPS -- Autorite de Controle des Assurances et de la Prevoyance Sociale

**Article 268 du Code des Assurances (loi 17-99 modifiee par 39-21)** : tout intermediaire en assurance doit tenir un registre des dossiers de souscription transmis aux assureurs avec horodatage et tracabilite complete des decisions de validation/rejet.

**Reporting obligatoire mensuel** : le tenant broker doit pouvoir extraire un rapport ACAPS detaillant :
- Nombre de dossiers recus dans le mois
- Nombre valides / rejetes / escalades / expires
- Taux de rejet par motif
- Delai moyen de traitement (du `created_at` au `validated_at`/`rejected_at`)
- Respect SLA (% dossiers valides dans le delai contractuel)

**Implementation dans cette tache** : tous les events timeline + statuts + reasons sont persistes cote backend Sprint 15. Le rapport ACAPS sera genere par Sprint 31 (Reporting). Cette tache GARANTIT que toute action utilisateur cree un event timeline trace dans la DB.

### 12.2 Loi 17-99 Code des Assurances

**Article 6** : l'intermediaire doit prendre une decision de souscription dans un delai raisonnable, faute de quoi sa responsabilite peut etre engagee si le risque se realise pendant l'attente.

**Implementation** : SLA timer rouge < 1h + dark_red overdue + escalation auto cote backend Sprint 15. L'historique audit trail permet de prouver en cas de litige judiciaire que le courtier a respecte la diligence professionnelle.

**Article 318** : decision broker de validation/rejet doit etre tracee, datee, signee (electroniquement ou manuellement) par l'agent ayant pris la decision.

**Implementation** : timeline event `validated` / `rejected` contient `actor_id` (broker_user id) + `occurred_at` ISO timestamp + `metadata` (commission_rate, reason, custom_text). Sprint 15 backend signe la transaction avec JWT actor_id.

### 12.3 Loi 09-08 -- Protection des donnees personnelles

**Article 4** : consentement explicite du customer pour traitement de ses donnees CIN, revenus, adresse.

**Article 8** : finalite limitee -- les donnees personnelles affichees dans la page Broker Queue (CIN, phone, email, address, segment) ne doivent etre VISIBLES qu'aux utilisateurs ayant un besoin operationnel justifie.

**Implementation cette tache** :
- RBAC strict : seul `broker_user` / `broker_admin` / `broker_assistant` du tenant proprietaire du dossier voit les donnees customer
- Le customer doit avoir donne consentement Loi 09-08 (`consent_809 = true` dans `CustomerFullSchema`)
- Sprint 17 (web-customer-portal) garantit que le customer opt-in lors de la creation du dossier
- Audit trail Sprint 15 : chaque vue de la page detail genere un event `viewed` (a implementer Sprint 27 Reporting)

### 12.4 Loi 43-20 -- Confiance numerique + signature electronique

**Si branche RC Pro Entreprise** : la validation broker peut declencher une demande de signature electronique du contrat customer cote Sprint 18 (assure-portal). Cette tache ne gere PAS la signature directement mais le `validate` declenche cote backend Sprint 15 le flow signature DocuSign-equivalent MA.

**Implementation** : `commission_rate` + `notes` validation broker font partie du contrat electronique signe. Idempotency-Key garantit que le contrat n'est pas duplique en cas de retry.

### 12.5 WCAG 2.1 AA Accessibility

**Criterion 1.3.1 Info and Relationships** : SLA timer change visuel doit etre annonce screen reader. Implemente via `role="status" aria-live="polite" aria-atomic="true"`.

**Criterion 1.4.3 Contrast (Minimum)** : badges couleurs SLA verifies contrast >= 4.5:1 sur fond clair et fond dark. Tailwind classes deja conformes (emerald-100/800, amber-100/800, etc).

**Criterion 2.1.1 Keyboard** : tous les dialogs ouvrables au clavier (Tab + Enter), Escape close, focus trap.

**Criterion 3.3.1 Error Identification** : Zod validation errors affichees inline sous chaque field avec `aria-invalid="true"` + `aria-describedby` pointing au `<p>` error.

**Criterion 4.1.3 Status Messages** : toasts sonner utilisent `role="status"` + `aria-live="polite"`.

---

## 13. Conventions absolues skalean-insurtech (3-5 ko, 25+ regles)

### 13.1 Code style et naming

1. **NO EMOJI** (decision-006) : zero emoji dans tout code, JSON messages, README, commit messages, log lines, toast strings. Caracteres arabes autorises (texte i18n).

2. **NO console.log production** : utiliser `logger` (Pino-equivalent) defini dans `lib/logger.ts` (heritage Tache 4.3.1). Seuls les tests peuvent garder `console.log`.

3. **Naming files kebab-case** : `validate-dossier-dialog.tsx` pas `ValidateDossierDialog.tsx`.

4. **Naming components PascalCase** : `<ValidateDossierDialog>` export named.

5. **Naming hooks camelCase + use prefix** : `useBrokerQueueList`, `useValidateDossier`.

6. **Naming constants UPPER_SNAKE_CASE** : `THRESHOLDS.green = 12`, `TAB_VALUES`.

7. **Naming types/interfaces PascalCase + T/Schema suffix** pour Zod : `BrokerQueueItemSchema` (Zod schema) -> `BrokerQueueItem` (TypeScript type).

8. **Path aliases** : `@/components/...`, `@/lib/...`, `@/messages/...` (configure dans tsconfig.json heritage Tache 4.3.1).

9. **Imports order** : (1) React/Next, (2) librairies externes, (3) `@/` internal, (4) styles. Une ligne blanche entre groupes. ESLint plugin `simple-import-sort` enforce.

10. **Server Components** : pas de `'use client'` directive. Async functions OK, peuvent fetch directement avec `apiClient.get`.

11. **Client Components** : `'use client'` en tete fichier. Pas d'async function default export (juste handlers async OK).

### 13.2 Patterns React + Next.js 15

12. **Suspense boundaries** : entoure chaque async server component avec `<Suspense fallback={<Skeleton>}>`.

13. **Error boundaries** : chaque route doit avoir un `error.tsx` qui catche les errors.

14. **Loading states** : chaque route doit avoir un `loading.tsx` qui affiche skeleton.

15. **Not-found** : routes dynamiques `[id]` doivent avoir un `not-found.tsx` pour ressource supprimee.

16. **Metadata** : chaque page principale exporte une `generateMetadata` async avec title + description + robots.

17. **searchParams typing** : Next.js 15 fournit `searchParams: Promise<{...}>` -- await obligatoire.

### 13.3 Patterns TanStack Query

18. **Query keys hierarchical** : `['broker-queue', 'list', filters]` permet invalidations cascade `['broker-queue']`.

19. **Mutations onMutate + onError + onSettled** : optimistic update -> rollback si error -> invalidate apres.

20. **Idempotency-Key sur toutes mutations POST** : `crypto.randomUUID()` neuf dans chaque submit.

21. **refetchInterval pour polling** : `30_000` (30s) pour queue list et detail.

22. **placeholderData: keepPreviousData** : evite flicker entre pagination/filters.

### 13.4 Patterns Zod

23. **Schemas separes des types** : `export const FooSchema = z.object(...)` puis `export type Foo = z.infer<typeof FooSchema>`.

24. **Validation au boundary** : tous les responses API parsed via `Schema.parse(data)` avant return.

25. **Refine pour cross-field rules** : `.refine(...)` pour validations dependantes (e.g. custom_text required si reason=other).

### 13.5 Patterns i18n

26. **useTranslations namespace** : `useTranslations('brokerQueue.sla')` pour scoper les cles. Eviter de tout mettre au root.

27. **Pluralization ICU** : `t('totalDossiers', { count: 42 })` resoud `{count, plural, one {# dossier} other {# dossiers}}`.

28. **Dates avec date-fns-tz** : `formatInTimeZone(date, 'Africa/Casablanca', 'dd MMM yyyy HH:mm', { locale: fr })`.

29. **Numbers avec Intl** : `Intl.NumberFormat(locale, { style: 'currency', currency: 'MAD' })`.

### 13.6 Patterns accessibility

30. **aria-live** : tous status messages dynamiques.

31. **aria-label** : tous icons buttons sans text label.

32. **Focus visible** : `focus-visible:ring-2` Tailwind utility deja dans preset.

33. **Skip links** : layout protected (Tache 4.3.3) inclut "Skip to content".

### 13.7 Patterns securite

34. **DOMPurify pour rendered HTML** : notes broker text avec `dangerouslySetInnerHTML` ALWAYS sanitize via DOMPurify.

35. **XSS escape par defaut** : React escape automatiquement, ne PAS contourner sauf avec DOMPurify.

36. **CSRF protection** : cookies sameSite=Lax + Idempotency-Key + JWT Bearer suffit (heritage Tache 4.3.1).

37. **Defense en profondeur RBAC** : UI cache + Backend valide. Ne jamais faire confiance au client seul.

---

## 14. Validation pre-commit (1-2 ko)

### 14.1 Checklist developer self-review

Avant `git commit`, le developer execute :

```bash
# 1. Format
pnpm --filter @insurtech/web-broker prettier --write "components/broker-queue/**/*.{ts,tsx}"
pnpm --filter @insurtech/web-broker prettier --write "lib/{queries,api,schemas,utils}/broker-queue*.ts"

# 2. Lint
pnpm --filter @insurtech/web-broker lint

# 3. Typecheck
pnpm --filter @insurtech/web-broker typecheck

# 4. Unit tests
pnpm --filter @insurtech/web-broker test

# 5. E2E ciblee
pnpm --filter @insurtech/web-broker test:e2e -- broker-queue

# 6. i18n parity
pnpm tsx repo/scripts/validate-broker-queue-i18n.ts

# 7. No-emoji + no-console
bash repo/scripts/check-no-emoji.sh repo/apps/web-broker/components/broker-queue/
grep -r "console.log" repo/apps/web-broker/components/broker-queue/ | grep -v test

# 8. Coverage
pnpm --filter @insurtech/web-broker test -- --coverage --reporter=text

# 9. Lighthouse spot check (manuel)
pnpm --filter @insurtech/web-broker lh -- /fr/broker-queue
```

### 14.2 Husky pre-commit hook

Le hook `.husky/pre-commit` (Sprint 1) execute deja :

```bash
#!/usr/bin/env bash
. "$(dirname -- "$0")/_/husky.sh"

# 1. Lint-staged
pnpm exec lint-staged

# 2. No-emoji check on staged files
bash repo/scripts/check-no-emoji.sh $(git diff --cached --name-only --diff-filter=ACM)

# 3. Type-check sur fichiers staged si TS
if git diff --cached --name-only --diff-filter=ACM | grep -qE '\.(ts|tsx)$'; then
  pnpm --filter @insurtech/web-broker typecheck
fi
```

### 14.3 CI GitHub Actions

Pipeline `.github/workflows/ci.yml` (Sprint 1) execute sur PR :

- lint + typecheck (matrix node 22, 23)
- Vitest tous packages avec coverage uplodee codecov
- Playwright E2E full sur containers Linux + Webkit + Firefox
- Build prod web-broker + cache Next.js
- Lighthouse CI sur preview deploy
- Validate-no-emoji global

---

## 15. Commit message complet (1-2 ko)

```
feat(web-broker): broker queue page + SLA timer + validate/reject/escalate/reassign (sprint-16 4.3.9)

CONTEXT
-------
Construit la page Broker Queue centrale (port 3001) consommant BrokerValidationQueueService (Sprint 15).
Cette page est le coeur operationnel quotidien pour broker_user / broker_admin / broker_assistant.
Premier UI metier orchestrant 4 backends simultanement : Sprint 15 (queue), Sprint 9 (notifications),
Sprint 10 (documents S3 viewer), Sprint 7 (RBAC).

LIVRABLES
---------
- Route /broker-queue (list) : 3 tabs (Mes/Tous/En retard), DataTable TanStack, filtres URL nuqs,
  pagination cursor, polling 30s, SLA timer visuel live countdown.
- Route /broker-queue/[id] (detail) : header + garanties + documents viewer S3 + timeline + notes
  + 4 dialogs actions (Validate / Reject / Escalate / Reassign).
- SLA calculator pure function + 12 tests Vitest exhaustifs (green > 12h, yellow 6-12h, orange 1-6h,
  red < 1h, dark_red overdue + edge cases null/invalid).
- 8 endpoints Sprint 15 wrapped via brokerQueueApi.* avec Idempotency-Key auto-generated UUID.
- TanStack Query hooks optimistic update + rollback + invalidation queries+lists.
- Forms react-hook-form + Zod resolvers : ValidateDossierSchema (checklist 4 items + commission_rate),
  RejectDossierSchema (reason + custom_text refine if other), EscalateDossierSchema, ReassignDossierSchema.
- I18n 3 locales : fr (defaut), ar-MA (Darija), ar (classique) avec 30+ keys par locale.
- 33 tests Vitest unit + components, 10+ tests Playwright E2E (validate flow complet, reject + notify,
  assign self, escalate, reassign admin-only, SLA progression, filtres URL persist, polling, RTL).

CONFORMITE MA
-------------
- ACAPS art. 268 : audit trail complet validation/rejet (timeline events backend Sprint 15)
- Loi 17-99 art. 6 + 318 : decision broker tracee + datee + signee (actor_id + occurred_at)
- Loi 09-08 : consent_809 check + RBAC strict + audit trail vues
- Loi 43-20 : signature electronique declenchee cote Sprint 18 si branche RC Pro
- WCAG 2.1 AA : SLA timer aria-live polite + focus trap dialogs + contrast badges OK

DEPENDENCES
-----------
Bloque par : task-4.3.8 (Polices page)
Bloque : task-4.3.10 (Sinistres read-only -- reutilise pattern dialogs + queue)

TESTS
-----
- Vitest : 33 tests, coverage 87% sla-calculator + queries + schemas
- Playwright : 12 tests E2E broker-queue.spec.ts
- Lighthouse : Performance 72, Accessibility 94, Best Practices 95 sur /fr/broker-queue

REVIEWERS
---------
- @insurtech/sprint-16-lead : owner sprint
- @insurtech/architect-frontend : pattern dialogs + optimistic update
- @insurtech/security-team : XSS DOMPurify notes + Idempotency-Key
- @insurtech/a11y-champion : WCAG 2.1 AA SLA timer aria-live

VERIFICATIONS
-------------
- pnpm --filter @insurtech/web-broker lint --max-warnings=0 : OK
- pnpm --filter @insurtech/web-broker typecheck : OK
- pnpm --filter @insurtech/web-broker test : 33/33 PASS
- pnpm --filter @insurtech/web-broker test:e2e -- broker-queue : 12/12 PASS
- bash scripts/check-no-emoji.sh : 0 emoji detecte
- grep -r "console.log" components/broker-queue/ : 0 occurrence

DECISIONS
---------
- Polling 30s (decision documentee) vs SSE/WS : surdimensionnement metier rejete v1
- Optimistic partial vs full : partial choisi pour eviter rollback frustrant validate -> police
- setInterval 1s vs requestAnimationFrame : setInterval choisi (throttle background = avantage)
- TanStack Table v8 vs custom : reutilisation patron Sprint 16 (Contacts, Companies, Deals, Polices)
- Idempotency-Key UUID neuf par submit : protection double-validate race

REFS
----
- Spec : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.9)
- Tache prompt : 00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.9-broker-queue-validate-reject-sla.md
- ADR : 00-pilotage/adr/2026-05-broker-queue-polling-vs-sse.md
```

---

## 16. Workflow next step

### 16.1 Sequence depuis cette tache

```
[4.3.8 Polices page]
       |
       v
[4.3.9 Broker Queue]  <-- CETTE TACHE
       |
       +--> Validation par CTO + Product Owner
       |    (review checklist V1-V27)
       |
       +--> Merge PR vers main
       |
       v
[4.3.10 Sinistres read-only]
       |
       +--> Reutilise patterns :
       |    - DataTable TanStack
       |    - Filters URL nuqs
       |    - Detail page tabs
       |    - Timeline component
       |
       v
[4.3.11 Parametres + Profile]
       |
       v
[4.3.12 RBAC UI helpers]
       |
       v
[4.3.13 I18n complete]
       |
       v
[4.3.14 E2E Playwright global + a11y]
       |
       v
Sortie Sprint 16 -- Web Broker App v1.0
       |
       v
[Sprint 17 -- Web Customer Portal] (vente en ligne SEO)
[Sprint 18 -- Web Assure Portal] (self-service avenants)
```

### 16.2 Handoff items pour 4.3.10

Le pattern queue + dialogs livre ici est reutilise pour Sinistres avec adjustments minimes :
- Pas de dialogs Validate/Reject (sinistres read-only courtier M9)
- Pas de SLA timer (sinistres ont leur propre workflow Sprint 22)
- Pas d'actions mutation
- Reutiliser : DataTable + Filters + Timeline + Documents viewer

### 16.3 Backlog feedback metier (post-livraison)

Items remontes des ateliers utilisateurs novembre 2025 a documenter dans backlog Sprint 23+ :
- Bulk validate/reject (selection multiple dossiers)
- Templates de notes broker reutilisables
- Notifications push browser (Web Push API) pour escalations critiques
- Export CSV liste dossiers pour analyse offline
- Filtres avances : "dossiers attribues a X et > 24h sans action"
- SSE real-time migration (v2)

---

## 17. Footer densite + auto-verif

### 17.1 Verification taille fichier

```bash
wc -c repo/00-pilotage/prompts-taches/sprint-16-web-broker-app/task-4.3.9-broker-queue-validate-reject-sla.md
# Cible : 100 000 a 150 000 octets (~120 ko)
```

### 17.2 Auto-checks contenu

- [ ] 17 sections numerotees 1-17 presentes
- [ ] 25+ livrables checkables section 4
- [ ] 12+ code patterns complets section 6
- [ ] 5+ blocs tests section 7
- [ ] 27 criteres validation V1-V27 (16 P0 + 7 P1 + 4 P2)
- [ ] 12 edge cases section 11
- [ ] Conformite MA : ACAPS + Loi 17-99 + Loi 09-08 + Loi 43-20 + WCAG 2.1 AA
- [ ] 25+ conventions section 13
- [ ] Commit message complet section 15
- [ ] Zero emoji detecte (decision-006)

### 17.3 Cross-references

- Heritage : task-1.4.1-web-broker-bootstrap-port-3001.md (gold standard structure)
- Depend de : task-4.3.8-polices-page-list-detail.md
- Bloque : task-4.3.10-sinistres-read-only.md
- Pattern reutilise : task-4.3.5-contacts-page.md (DataTable + filters URL)
- Backend consume : Sprint 15 BrokerValidationQueueService + ProvisionalPolicyService
- Backend secondaire : Sprint 9 NotificationService + Sprint 10 DocumentStorageService
- RBAC : Sprint 7 PermissionGuard + 12 roles

**Fin du prompt-tache 4.3.9 -- Broker Queue Page Sprint 16 v1.0.**


