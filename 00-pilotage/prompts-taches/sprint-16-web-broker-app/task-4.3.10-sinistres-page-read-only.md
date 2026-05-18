# TACHE 4.3.10 -- Sinistres Page Read-Only (M9 Courtier Sans Intervention)

**Sprint** : 16 (Phase 4 / Sprint 3 dans phase -- Web Broker App)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.10)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (premier UI metier production -- demonstration valeur Skalean Broker)
**Effort** : 4h
**Dependances** : task-4.3.9 (Broker Queue page operationnelle), Sprint 21 (Vertical Repair endpoints `/api/v1/repair/sinistres`), Sprint 22 (Garage app workflow source verite), Sprint 24 (Customer claim declaration flow producteur sinistre), Sprint 7 (RBAC + permission `repair.sinistres.read`), Sprint 10 (S3 Atlas Cloud documents storage), Sprint 9 (Communication WhatsApp/Email/SMS deep links), Sprint 4 (design tokens Sofidemy + shared-maps Mapbox)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Implementer dans l'application `apps/web-broker` (port 3001, locale-prefixed `[locale]/(protected)/sinistres`) un module sinistres **strictement read-only** destine aux trois roles broker (broker_admin, broker_user, broker_assistant) : une page liste paginee `/sinistres` (DataTable TanStack avec filtres status workflow M8 + branche + date_range declaration + garage_assigne + customer, pagination URL state via nuqs, export ACAPS reserve broker_admin) et une page detail `/sinistres/[id]` decomposee en huit onglets en lecture seule (Info avec carte Mapbox geolocalisation, Police liee, Customer, Garage assigne, Expert et rapport, Documents S3, Timeline evenementielle, Reglement final).

L'objectif metier critique est ancre dans la **decision M9 (decision-022)** : le courtier (broker) **n'intervient JAMAIS dans le workflow sinistre operationnel** -- celui-ci est integralement traite par le garage partenaire (Sprint 22 web-garage-app) et l'expert mandate (Sprint 21 expert-assignment), en dialogue direct avec l'assure via le portail customer Sprint 18 / Sprint 24. Le broker conserve uniquement un droit de **suivi** pour deux usages : (1) conseiller son client courtage (relances, accompagnement) en disposant de l'information complete et a jour ; (2) generer le reporting mensuel ACAPS obligatoire (decret 2-13-836) exportant les sinistres de son portefeuille polices au format CSV/PDF normalise. **Aucun bouton "Creer un sinistre", "Editer", "Supprimer", "Assigner garage", "Mandater expert", "Approuver reglement" n'est rendu** dans l'UI broker. Toute action write retourne 403 cote backend (Sprint 7 PermissionGuard : seul `repair.sinistres.read` est accorde aux roles broker, jamais `repair.sinistres.write`).

A la sortie de cette tache : (a) les deux routes Next.js 15 App Router rendent en Server Components avec hydratation TanStack Query (staleTime 5 min, gcTime 30 min, jamais mutations) ; (b) le composant `<SinistreStatusFlow>` rend visuellement le workflow M8 a 9 statuts (declared -> acknowledged -> expert_assigned -> expertise_done -> repair_authorized -> repair_done -> settled -> closed + branche speciale litigation) sous forme de stepper horizontal WCAG 2.1 AA conforme (semantique `<ol role="list">`, ARIA-current pour statut courant) ; (c) la commande Playwright `pnpm --filter @insurtech/web-broker test:e2e -- sinistres.spec.ts` valide 8 scenarios incluant l'absence stricte de boutons Create/Edit/Delete dans le DOM ; (d) l'export ACAPS est gate par `<HasPermission permission="reporting.acaps.export">` et delegue au backend Sprint 14 `/api/v1/repair/sinistres/export-acaps` qui retourne un binaire CSV ou PDF stream. Cette tache debloque 4.3.11 (Parametres + Profile) et finalise le bloc "metiers core" du Sprint 16.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe -- la decision metier M9 en profondeur

Le programme Skalean InsurTech a pris en novembre 2025, lors du comite produit decision-022, une orientation structurante distinguant deux niveaux d'intervention sur le sinistre auto au Maroc :

**Niveau "vente et conseil" (broker)** : le cabinet de courtage capture le contact (Sprint 8 CRM), construit la cotation multi-assureurs (Sprint 14 quotations), souscrit la police (Sprint 15 polices), encaisse la commission (Sprint 12 books), et reste l'**interlocuteur relationnel** privilegie du client pendant toute la vie du contrat. Mais au moment ou un sinistre se produit, le broker n'a **ni les outils ni la legitimite operationnelle** pour traiter le dossier : il ne dispose pas du reseau garages partenaires (expertise terrain Skalean), il n'a pas mandat d'expertise (loi 17-99 article 18 reserve cela aux experts assermentes), et il n'engage pas la garantie financiere (l'assureur partenaire CAA / Sanad / Saham / Wafa Assurance regle directement le sinistre via Skalean).

**Niveau "operation sinistre" (Skalean + garage + expert + assureur)** : Skalean orchestre, via la **Vertical Repair** (Sprint 21), le workflow complet :
1. L'assure declare le sinistre depuis le portail customer (Sprint 18) ou l'app mobile assure (Sprint 19) -- producteur initial du record `sinistre`
2. Skalean accuse reception automatiquement (regle metier : SLA 2h ouvrables) et envoie une notification WhatsApp/SMS/Email a l'assure (Sprint 9 Comm)
3. Si le montant estime depasse 5000 MAD (seuil ACAPS), un expert est assigne (Sprint 21 expert-pool) -- delai legal 5 jours ouvres
4. L'expert produit un rapport (Sprint 21 expert-reports) avec photos avant/apres et montant evaluable
5. Le garage selectionne par l'assure (Sprint 22 garage-app, flux M8 -- "l'assure choisit son garage parmi le reseau Skalean") accepte ou refuse l'ordre de reparation
6. Reparation effectuee, facture emise, photos apres uploadees par garage
7. Skalean controle, valide, l'assureur partenaire regle (virement) -- Sprint 14 settlements
8. Cloture officielle du dossier sinistre + notification finale assure
9. Branche alternative `litigation` si refus, contestation expertise, fraude soupconnee -- workflow contentieux separe (Sprint 21 litigation-module)

Dans ce schema, le broker est **observateur** : il peut consulter, telecharger les pieces, contacter l'assure pour rassurer, mais ses interactions avec le moteur operationnel sinistre sont **strictement nulles**. C'est le sens des termes "M9 = courtier sans intervention" qui apparaissent dans le titre de la tache.

### Pourquoi un module sinistres dans le broker app malgre tout

On pourrait s'interroger : si le broker n'intervient pas, pourquoi lui afficher les sinistres ? Trois raisons fondamentales :

**Raison 1 -- accompagnement client** : un assure qui declare un sinistre appelle souvent son courtier en premier (lien historique, confiance). Le broker doit alors pouvoir repondre dans la minute "votre sinistre est bien recu, l'expert M. Bennani a ete assigne hier, vous recevrez son rapport sous 48h". Sans visibilite temps reel, le broker passe pour un intermediaire absent. Le module sinistres lui donne cette visibilite (refresh TanStack Query staleTime 5 min, lecture en direct de la base lifecycle Sprint 21).

**Raison 2 -- reporting ACAPS obligatoire (decret 2-13-836 article 12)** : tout intermediaire d'assurance au Maroc doit transmettre mensuellement a l'ACAPS un etat des sinistres survenus sur son portefeuille (nombre, montant, repartition par branche, taux de cloture). Le broker doit pouvoir generer cet etat en un clic. L'export ACAPS (bouton dedie page liste, gate broker_admin) appelle le backend `/api/v1/repair/sinistres/export-acaps` qui retourne un CSV au format ACAPS officiel (colonnes normees : N_DECL / DATE_DECL / NUM_POL / N_ASSURE / BRANCHE / MONTANT_DECL / MONTANT_REGLE / DATE_REGLEMENT / STATUT_FINAL) plus une version PDF avec entete tenant.

**Raison 3 -- pilotage commercial** : un broker performant analyse la sinistralite de son portefeuille (taux S/P, sinistralite par branche, par segment client) pour ajuster sa politique commerciale (ex : ne plus prospecter agressivement les jeunes conducteurs si taux sinistre eleve). Le module sinistres alimente les widgets du dashboard 4.3.4 (KPI "Sinistres en cours" + repartition par status).

### Alternatives architecturales considerees

#### Option A -- Module sinistres dans broker app (CHOIX)

Avantages : centralisation UX (broker travaille dans une seule app, pas de redirect vers garage app), permissions granulaires natives (RBAC Sprint 7), reutilisation design system Sofidemy, integration directe avec contacts/companies/polices/deals.

Inconvenients : duplication code potentielle avec broker-side du module sinistres dans la web-garage-app Sprint 22 (qui sera write/full). Mitigation : extraction de composants en commun dans `@insurtech/shared-ui` (status-flow, status-badge, document-viewer) -- prevu Sprint 24 refactor.

#### Option B -- Iframe embed sur portail garage (rejete)

Idee : embarquer une vue read-only de l'app garage dans broker app via iframe. Rejete car (1) UX dissonante (deux design systems coexistent), (2) auth cross-origin complexe (cookie SameSite + CSRF token), (3) permissions difficile a granulariser (un garage_admin ne doit pas voir tous sinistres tous brokers).

#### Option C -- Redirect vers un mini-portail sinistres dedie hors broker app (rejete)

Idee : sous-domaine `claims.broker.skalean-insurtech.ma`. Rejete car (1) effort dev considerable pour un module read-only, (2) friction utilisateur (changement d'app), (3) cookies cross-subdomain peu fiables iOS Safari.

#### Option D -- Pages sinistres dans web-garage-app et redirige broker (rejete)

Rejete car le broker n'a pas de role dans web-garage-app (qui est destinee aux garages partenaires). Permission models incompatibles.

### Decisions strategiques referenced (decisions-001 a decision-024)

- **decision-001 (monorepo pnpm + Turbo)** : `apps/web-broker` reside dans monorepo root. Module sinistres respecte la convention `app/[locale]/(protected)/sinistres/` (groupe de routes protected partage middleware auth).
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucun fichier code, label JSON, commentaire, commit message. Linter custom (`scripts/check-no-emoji.sh`) execute en pre-commit Husky. Status labels FR/AR-MA/AR utilisent texte uniquement (pas de pictogramme emoji).
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : les photos sinistre / rapports expert / devis garage sont stockes sur S3 Atlas Cloud Benguerir (`s3.bgr.atlascloudservices.ma`), pre-signed URLs TTL 15 min generes backend Sprint 10. Aucune photo n'est servie depuis `*.amazonaws.com`. Le viewer S3 utilise `next/image` avec `remotePatterns: ['s3.bgr.atlascloudservices.ma']`.
- **decision-009 (multilinguisme MA)** : trois locales fr (defaut), ar-MA (Darija), ar (classique). Status labels workflow M8 traduits dans les 3 langues. RTL gere par `dir` sur `<html>` calcule cote serveur.
- **decision-010 (Vertical Insure + sub-verticals)** : sinistres = sub-vertical Repair, distincte de Lifecycle (polices) et Underwriting (cotations). Endpoint base path : `/api/v1/repair/sinistres`.
- **decision-014 (Mapbox sovereign tokens)** : token public Mapbox specifique web-broker prod (`broker.skalean-insurtech.ma`) avec URL restriction. Token dev (`localhost:3001`). Le viewer carte sinistre utilise `@insurtech/shared-maps` (package Sprint 4 task-1.4.10) qui wrap mapbox-gl avec defaults Skalean (style `mapbox://styles/skalean/insurtech-maroc-v2`).
- **decision-017 (ACAPS reporting format CSV/PDF)** : format CSV normalise selon arrete ACAPS du 12 avril 2018. Encodage UTF-8 BOM (compatibilite Excel). Separateur point-virgule. Date format `YYYY-MM-DD`. Montants en MAD sans separateur milliers.
- **decision-022 (M9 broker sans intervention sinistre)** : cf. detail ci-dessus. Decision validee comite produit 18/11/2025.
- **decision-024 (workflow status M8 a 9 statuts + litigation branch)** : codes statut fixes en backend Sprint 21, exposes via OpenAPI generation Sprint 4 task-1.4.13.

### Trade-offs explicites

1. **TanStack Query staleTime 5 min** : compromis entre frais reseau et fraicheur donnee. Acceptable car broker fait du suivi, pas du temps reel critique. Si broker veut donnee fraiche, refresh manuel via bouton "Actualiser" (icone arrow-clockwise lucide).

2. **Mapbox GL JS bundle 850 ko** : impact LCP. Mitigation : lazy load via `dynamic(() => import('@insurtech/shared-maps').then(m => m.MapView), { ssr: false, loading: () => <MapSkeleton /> })`. Le map ne charge que dans l'onglet Info active.

3. **pdf-lib client-side pour "Imprimer rapport courtier"** : alternative envisagee : appel backend. Choix client-side pour eviter charge serveur + cas hors-ligne. Limite : pas plus de 50 photos dans le rapport (taille bundle pdf-lib + images). Si > 50, redirige backend.

4. **Pas de polling temps reel** : on n'utilise pas WebSocket Sprint 9 pour broker -- pas critique. Si urgent, futur Sprint 22 ajoutera SSE pour brokers premium.

5. **Export ACAPS limite a 1000 lignes client-side** : si > 1000, backend stream chunks. UI affiche progress bar.

6. **RTL Mapbox** : mapbox-gl ne respecte pas natif `dir="rtl"`. Solution : direction map `rtl` injectee via option `getRTLTextPluginUrl` + plugin officiel `mapbox-gl-rtl-text`. Charge en lazy depuis CDN Mapbox.

7. **Sinistre litigation status special UI** : separe de la chaine workflow normale, affiche dans un encart distinct rouge bordure (couleur destructive shadcn). Pas une etape sequentielle mais une branche alternative.

8. **Photos avant/apres expert** : ratio attendu 4:3 portrait smartphone. Carrousel avec lightbox via composant shadcn Dialog. Lazy load images (intersection observer).

9. **Documents S3 viewer** : pre-signed URL TTL 15 min, regenere on demand si expire. Pas de cache local (sensibilite donnees). Affichage inline pour PDF (object embed) + download fallback pour formats non supportes.

10. **Pagination cote serveur** : page=1 par defaut, page_size=25. Total fourni par backend (pas de scroll infini -- DataTable shadcn classique).

### Pieges techniques connus (15 minimum)

1. **Status workflow stepper RTL** : en ar-MA / ar, l'ordre des etapes inverse (right-to-left). Solution : composant utilise `flex-row` + `dir` heritage parent, jamais `mr-` / `ml-` direct -- toujours `me-` / `ms-` (margin-end / margin-start).

2. **Mapbox lat/lng nullable** : un sinistre peut etre declare sans localisation precise (ex : "Casablanca quartier Maarif"). Solution : si `location.lat === null || location.lng === null`, afficher placeholder "Localisation non geocodee" + adresse texte si presente. Ne pas crasher.

3. **S3 pre-signed URL expire pendant viewing** : si user laisse onglet ouvert > 15 min, image cassee. Solution : interceptor erreur 403 -> regenere URL via mutation cache TanStack (`queryClient.invalidateQueries({ queryKey: ['sinistre', id, 'photos'] })`).

4. **DataTable colonne "amount_estimated" null** : sinistre nouvellement declare n'a pas encore d'estimation. Affichage `--` au lieu de `0 MAD` (eviter confusion 0).

5. **Filter date_range avec timezone Africa/Casablanca** : si user filtre "aujourd'hui" et il est 23:30 a Casablanca (00:30 UTC), les dates UTC en backend peuvent mal matcher. Solution : convertir cote frontend `startOfDay()` / `endOfDay()` avec `date-fns-tz` zone `Africa/Casablanca`, envoyer ISO avec offset.

6. **Export ACAPS CSV BOM** : Excel Maroc (Microsoft 365 fr-FR) attend BOM UTF-8 pour interpreter accents correctement. Le backend doit prefixer `\xEF\xBB\xBF`. Si backend oublie, UI ne peut rien faire mais alerter en feedback.

7. **Status "litigation" rare mais critique** : tests doivent couvrir car couleur UI distincte (destructive bg red-100 text-red-900), badge "Contentieux" en gras, NEVER masque dans status flow.

8. **Workflow stepper "current" vs "completed"** : si sinistre est `repair_done`, alors steps 1-6 sont completed, step 6 est current ? Ou step 7 (settled) est next ? Decision : `current` = derniere etape franchie (`repair_done`), suivantes en `pending`. ARIA-current sur l'etape current.

9. **Permission `repair.sinistres.read` vs `reporting.acaps.export`** : la lecture est commune (3 roles broker) mais l'export ACAPS est admin-only. Tester strictement : broker_user / broker_assistant doivent voir page mais pas bouton export.

10. **Sinistre "orphelin" (police supprimee)** : edge case rare -- police archivee mais sinistre encore actif. Solution : afficher police link grise + tooltip "Police archivee".

11. **Customer fusionne (deduplication CRM)** : si customer A fusionne dans B (Sprint 8 dedup), les sinistres de A pointent vers B. Solution : redirect transparent backend, frontend ne se preoccupe pas.

12. **Garage assigne mais inactif** : un garage partenaire peut etre desactive temporairement (suspension qualite). Solution : badge "Garage inactif" en orange dans tab Garage. Sinistre poursuit son cours mais alerter broker.

13. **Expert assigne mais demission** : expert quitte le reseau. Sinistre peut avoir `expert_id` pointant entite inactive. Solution : afficher nom expert + badge "Expert n'est plus dans le reseau" + indication "Remplacement en cours" si backend a marque flag.

14. **Document delete S3 (rare, mais GDPR/Loi 09-08 right to deletion peut declencher)** : si fichier supprime, viewer 404. Solution : skeleton + message "Document indisponible" + lien support.

15. **Print PDF rapport courtier > 50 photos crash navigateur** : memoire client epuisee. Solution : limite hard 50, alerter user "Trop de photos pour generation client, telecharger version backend".

16. **Locale switch sur page detail garde URL [id]** : si user switch fr -> ar-MA, URL devient `/ar-MA/sinistres/sin_abc123`. Middleware doit preserver param dynamique. Verifier que message keys traduites existent dans toutes locales sous `sinistres.detail.*`.

17. **Sort column "garage_assigne"** : tri alphabetique sur nom garage backend (jointure). Si null (pas encore assigne), placer en fin (NULLS LAST). Le frontend envoie param `sort=garage_assigne:asc&nulls=last`.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16

`task-4.3.10` se positionne **dixieme** des 14 taches du Sprint 16, juste apres la finalisation du module Broker Queue (task-4.3.9, traitement des dossiers en attente validation). Elle conclut le bloc "metiers operationnels" (4.3.4 a 4.3.10) avant d'attaquer les pages transversales (parametres / profile / RBAC / i18n / tests).

```
Sprint 16 -- Web Broker App (14 taches)

[4.3.1 app skeleton + middleware + i18n setup]
   |
[4.3.2 pages auth login + MFA + signup]
   |
[4.3.3 layout principal + sidebar + topbar + tenant switcher]
   |
[4.3.4 dashboard 6 widgets]
   |
[4.3.5 contacts page]
   |
[4.3.6 companies page]
   |
[4.3.7 deals kanban + table]
   |
[4.3.8 polices page]
   |
[4.3.9 broker queue]
   |
[4.3.10 sinistres read-only]  <-- ICI
   |
[4.3.11 parametres + profile]
   |
[4.3.12 RBAC UI conditional rendering]
   |
[4.3.13 i18n complete + RTL]
   |
[4.3.14 tests E2E Playwright]
```

### Dependances upstream

Cette tache **consomme** :

| Sprint | Tache | Sortie reutilisee |
|--------|-------|-------------------|
| Sprint 4 | 1.4.1 | Bootstrap web-broker (Next 15, providers, Axios client, i18n setup) |
| Sprint 4 | 1.4.8 | shared-ui DataTable, Tabs, Card, Badge, Button, Skeleton, Dialog |
| Sprint 4 | 1.4.10 | shared-maps Mapbox wrapper (MapView, MapMarker) |
| Sprint 4 | 1.4.13 | OpenAPI client gen (types `Sinistre`, `SinistreListResponse`, etc.) |
| Sprint 5 | 1.5.* | Auth flow operational (JWT + refresh + MFA) |
| Sprint 6 | 1.6.* | Tenant context header `x-tenant-id` injecte automatique |
| Sprint 7 | 1.7.* | RBAC 12 roles + permission `repair.sinistres.read` |
| Sprint 8 | 2.1.* | CRM contacts/companies (lien customer dans tabs detail) |
| Sprint 9 | 2.2.* | Communication WhatsApp/Email/SMS (deep link "Contacter assure") |
| Sprint 10 | 2.3.* | Documents S3 Atlas Cloud (pre-signed URLs) |
| Sprint 14 | 4.1.* | Underwriting + Lifecycle (polices liees) |
| Sprint 15 | 4.2.* | Polices avances (premiums + avenants) |
| Sprint 16 | 4.3.3 | Layout + sidebar (item "Sinistres" deja present) |
| Sprint 16 | 4.3.8 | Polices page (deep link `/polices/[id]`) |
| Sprint 21 | 5.1.* | Vertical Repair backend (endpoints `/api/v1/repair/sinistres`) -- **FUTURE** mais contrat OpenAPI stub deja genere Sprint 4 |
| Sprint 22 | 5.2.* | Garage app workflow source -- **FUTURE** mais types partages |
| Sprint 24 | 5.4.* | Customer claim declaration -- **FUTURE** producteur sinistres |

### Dependances downstream

Cette tache **debloque** :

| Tache | Pourquoi |
|-------|----------|
| 4.3.11 | Termine bloc metiers, peut attaquer parametres |
| 4.3.12 | RBAC UI utilisera `repair.sinistres.read` + `reporting.acaps.export` comme exemples |
| 4.3.13 | I18n complete validera toutes les cles `sinistres.*` |
| 4.3.14 | Tests E2E sinistres.spec.ts inclus dans suite globale |

### Boundary du module sinistres broker

```
apps/web-broker/
|
+-- app/[locale]/(protected)/sinistres/
|    |-- page.tsx                          (LIST page, Server Component)
|    |-- [id]/page.tsx                     (DETAIL page, Server Component)
|    |-- loading.tsx                       (Skeleton)
|    |-- error.tsx                         (Error boundary)
|    |-- not-found.tsx                     (404 specifique)
|
+-- components/sinistres/
|    |-- sinistres-table.tsx               (~200 lignes : DataTable TanStack)
|    |-- sinistres-filters.tsx             (~180 lignes : Filters bar nuqs)
|    |-- sinistre-status-flow.tsx          (~150 lignes : Visual stepper)
|    |-- sinistre-status-badge.tsx         (Badge avec couleur per status)
|    |-- sinistre-header-card.tsx          (Header detail avec stepper)
|    |-- contact-assure-button.tsx         (Deep link Sprint 9 Comm)
|    |-- acaps-export-button.tsx           (Export CSV/PDF, admin only)
|    |-- print-broker-report-button.tsx    (PDF client-side pdf-lib)
|    |-- empty-state.tsx                   (Aucun sinistre)
|    +-- tabs/
|         |-- sinistre-tabs-shell.tsx      (Tabs root)
|         |-- sinistre-info-tab.tsx        (Description + map + temoins)
|         |-- sinistre-police-tab.tsx      (Lien police + garanties)
|         |-- sinistre-customer-tab.tsx    (Contact info)
|         |-- sinistre-garage-tab.tsx      (Garage assigne + technicien)
|         |-- sinistre-expert-tab.tsx      (Rapport + photos avant/apres)
|         |-- sinistre-documents-tab.tsx   (Liste docs + S3 viewer)
|         |-- sinistre-timeline-tab.tsx    (Events chronological)
|         +-- sinistre-reglement-tab.tsx   (Montant + virement)
|
+-- lib/
|    |-- queries/
|    |    +-- sinistres.queries.ts          (TanStack Query hooks, read-only)
|    |-- api/
|    |    +-- sinistres.api.ts              (Axios client wrappers)
|    |-- schemas/
|    |    +-- sinistre.schema.ts            (Zod schemas + types)
|    +-- utils/
|         |-- sinistre-status-config.ts     (Status -> label + couleur + ordre)
|         +-- format-sinistre.ts            (formatters specifiques)
|
+-- messages/
|    |-- fr.json                            (Cles sinistres.*)
|    |-- ar-MA.json
|    +-- ar.json
|
+-- test/
     |-- unit/
     |    |-- sinistres-table.test.tsx
     |    |-- sinistre-status-flow.test.tsx
     |    |-- sinistre-status-config.test.ts
     |    |-- format-sinistre.test.ts
     |    |-- sinistre-schema.test.ts
     |    +-- ...
     +-- e2e/
          +-- sinistres.spec.ts             (Playwright 8+ scenarios)
```

### Flux donnees principaux

**Flux 1 -- List page rendering** :
```
[user GET /fr/sinistres?status=expert_assigned&page=2]
   |
   v
[middleware auth] -- verifie JWT + tenant
   |
   v
[Server Component page.tsx]
   |-- await getTranslations()
   |-- prefetchQuery(['sinistres', filters]) via queryClient
   |
   v
[Client hydrate]
   |-- TanStack Query reads from prefetched cache
   |-- DataTable renders rows
   |-- Filters bar sync URL via nuqs
   |
   v
[user clicks row]
   |-- router.push(`/fr/sinistres/${id}`)
```

**Flux 2 -- Detail page rendering** :
```
[user GET /fr/sinistres/sin_abc123]
   |
   v
[Server Component [id]/page.tsx]
   |-- prefetchQuery(['sinistre', id])
   |-- prefetchQuery(['sinistre', id, 'timeline'])
   |-- prefetchQuery(['sinistre', id, 'documents'])
   |-- prefetchQuery(['sinistre', id, 'photos'])
   |
   v
[Client hydrate]
   |-- SinistreHeaderCard renders status + stepper
   |-- Tabs default = "info"
   |-- Tab content lazy loaded (Suspense per tab)
```

**Flux 3 -- ACAPS export** :
```
[user clicks "Export ACAPS" button -- admin only]
   |
   v
[Dialog opens with date range picker]
   |-- date_start, date_end, format (CSV | PDF)
   |
   v
[Confirm]
   |-- fetch /api/v1/repair/sinistres/export-acaps?date_start=&date_end=&format=
   |-- responseType: 'blob'
   |
   v
[blob URL.createObjectURL] -- download trigger
```

---

## 4. Livrables checkables (20+ deliverables)

### Pages et routes

- [ ] **L1** : Route `/[locale]/(protected)/sinistres` (page liste) repond 200 sur fr, ar-MA, ar
- [ ] **L2** : Route `/[locale]/(protected)/sinistres/[id]` (page detail) repond 200 si id valide, 404 sinon
- [ ] **L3** : Page liste a `loading.tsx` (skeleton DataTable) et `error.tsx` (fallback erreur)
- [ ] **L4** : Page detail a `loading.tsx` (skeleton header + tabs) et `not-found.tsx` (sinistre introuvable)
- [ ] **L5** : Sidebar item "Sinistres" actif sur les deux routes (highlight)

### Components

- [ ] **L6** : `<SinistresTable>` rend les colonnes : sinistre_number, police_link, customer_link, declaration_date, status_badge, amount_estimated_mad, garage_assigne, expert_assigne
- [ ] **L7** : `<SinistresFilters>` rend les filtres : status (multiselect 9 valeurs + litigation), branche (auto/MRH/sante/vie), date_range declaration, garage (autocomplete), customer (autocomplete)
- [ ] **L8** : `<SinistreStatusFlow>` rend le stepper visuel 9 statuts + branche litigation alternative
- [ ] **L9** : `<SinistreStatusBadge>` rend badge avec couleur appropriee (slate / sky / amber / orange / blue / indigo / emerald / green / destructive)
- [ ] **L10** : `<SinistreHeaderCard>` rend header detail avec stepper + meta (date declaration, montant)
- [ ] **L11** : Onglet Info : description + map Mapbox + temoins + numero PV police + heure precise
- [ ] **L12** : Onglet Police : lien `/polices/[id]` + liste garanties activees + tooltip "garantie activee"
- [ ] **L13** : Onglet Customer : nom + telephone + email + bouton "Contacter assure" deep link
- [ ] **L14** : Onglet Garage : nom garage + technicien + status reparation + badge actif/inactif
- [ ] **L15** : Onglet Expert : nom expert + rapport PDF + carrousel photos avant/apres
- [ ] **L16** : Onglet Documents : liste docs (devis garage / rapport expert / PV police / photos / factures) + S3 viewer inline
- [ ] **L17** : Onglet Timeline : events chronological avec timestamp + acteur + description
- [ ] **L18** : Onglet Reglement : montant final + date reglement + numero virement (si paid)

### Read-only enforcement

- [ ] **L19** : Page liste : **AUCUN** bouton "Create / Nouveau / +" present dans le DOM
- [ ] **L20** : Page detail : **AUCUN** bouton "Edit / Modifier / Delete / Supprimer / Assigner / Approuver" present dans le DOM
- [ ] **L21** : Tests E2E verifient assertion absence des boutons mutation par data-testid

### Actions autorisees (lecture / export / contact)

- [ ] **L22** : Bouton "Actualiser" (refresh data) visible tous roles
- [ ] **L23** : Bouton "Contacter assure" deep link vers Sprint 9 comm visible tous roles
- [ ] **L24** : Bouton "Imprimer rapport courtier" (PDF client-side pdf-lib) visible tous roles
- [ ] **L25** : Bouton "Export ACAPS" visible **uniquement** broker_admin (permission `reporting.acaps.export`)

### TanStack Query hooks

- [ ] **L26** : Hook `useSinistresList(filters)` -- queryKey `['sinistres', filters]`, staleTime 5min
- [ ] **L27** : Hook `useSinistre(id)` -- queryKey `['sinistre', id]`, staleTime 5min
- [ ] **L28** : Hook `useSinistreTimeline(id)` -- queryKey `['sinistre', id, 'timeline']`
- [ ] **L29** : Hook `useSinistreDocuments(id)` -- queryKey `['sinistre', id, 'documents']`
- [ ] **L30** : Hook `useSinistrePhotos(id)` -- queryKey `['sinistre', id, 'photos']`
- [ ] **L31** : Hook `useSinistreExpertReport(id)` -- queryKey `['sinistre', id, 'expert-report']`
- [ ] **L32** : Aucune mutation hook (no `useMutation` exported)

### Schemas Zod

- [ ] **L33** : `sinistre.schema.ts` exporte : `sinistreSchema`, `sinistreListResponseSchema`, `sinistreTimelineEventSchema`, `sinistreDocumentSchema`, `sinistrePhotoSchema`, `sinistreExpertReportSchema`, `sinistreFiltersSchema`
- [ ] **L34** : Schemas valide tous champs avec types stricts (status enum, dates ISO 8601, amounts non-negatives, etc.)

### I18n

- [ ] **L35** : Cles `sinistres.*` definies dans `fr.json`, `ar-MA.json`, `ar.json` (parite stricte)
- [ ] **L36** : Labels status workflow traduites les 3 langues
- [ ] **L37** : Labels filtres + colonnes table traduits
- [ ] **L38** : Labels boutons (Refresh, Export ACAPS, Imprimer, Contacter) traduits

### RBAC

- [ ] **L39** : Permission `repair.sinistres.read` requise pour acces page (sinon 403)
- [ ] **L40** : Permission `reporting.acaps.export` requise pour bouton Export ACAPS (sinon bouton masque)

### Performance

- [ ] **L41** : Bundle JS additionnel module sinistres < 120 ko gzipped (hors mapbox-gl lazy chunk)
- [ ] **L42** : LCP page liste < 2.5s (3G fast)
- [ ] **L43** : Mapbox lazy chunk separe (charge seulement si onglet Info active)

### Accessibility (WCAG 2.1 AA)

- [ ] **L44** : Status flow stepper semantique `<ol role="list">` + `<li role="listitem">` + `aria-current="step"`
- [ ] **L45** : DataTable headers cliquables sort ont `aria-sort="ascending|descending|none"`
- [ ] **L46** : Filtres ont labels associes (no orphan inputs)
- [ ] **L47** : Boutons icone-seule ont `aria-label`
- [ ] **L48** : Carte Mapbox a `aria-label` descriptif
- [ ] **L49** : Photos carrousel a navigation clavier (Arrow Left/Right)
- [ ] **L50** : Contraste couleurs status badges respecte WCAG AA (ratio >= 4.5:1 pour texte)

### Tests

- [ ] **L51** : 12+ tests Vitest unit/component
- [ ] **L52** : 8+ tests Playwright E2E

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-broker/
|
+-- app/[locale]/(protected)/sinistres/
|    |-- page.tsx                                                       (~140 lignes -- Server Component, prefetch + render)
|    |-- loading.tsx                                                    (~40 lignes -- Skeleton DataTable)
|    |-- error.tsx                                                      (~50 lignes -- ErrorBoundary)
|    +-- [id]/
|         |-- page.tsx                                                  (~220 lignes -- Server Component detail)
|         |-- loading.tsx                                               (~50 lignes -- Skeleton tabs)
|         +-- not-found.tsx                                             (~30 lignes -- 404 specifique)
|
+-- components/sinistres/
|    |-- sinistres-table.tsx                                            (~220 lignes -- DataTable TanStack)
|    |-- sinistres-filters.tsx                                          (~190 lignes -- Filters nuqs)
|    |-- sinistre-status-flow.tsx                                       (~160 lignes -- Visual stepper)
|    |-- sinistre-status-badge.tsx                                      (~50 lignes -- Badge)
|    |-- sinistre-header-card.tsx                                       (~120 lignes -- Header detail)
|    |-- contact-assure-button.tsx                                      (~80 lignes -- Deep link Comm)
|    |-- acaps-export-button.tsx                                        (~180 lignes -- Export dialog + download)
|    |-- print-broker-report-button.tsx                                 (~200 lignes -- pdf-lib generation)
|    |-- empty-state.tsx                                                (~40 lignes -- Aucun sinistre)
|    +-- tabs/
|         |-- sinistre-tabs-shell.tsx                                   (~100 lignes -- Tabs root + lazy)
|         |-- sinistre-info-tab.tsx                                     (~150 lignes -- Map + description)
|         |-- sinistre-police-tab.tsx                                   (~100 lignes -- Police + garanties)
|         |-- sinistre-customer-tab.tsx                                 (~80 lignes -- Contact)
|         |-- sinistre-garage-tab.tsx                                   (~120 lignes -- Garage + tech)
|         |-- sinistre-expert-tab.tsx                                   (~180 lignes -- Rapport + photos carrousel)
|         |-- sinistre-documents-tab.tsx                                (~160 lignes -- S3 viewer)
|         |-- sinistre-timeline-tab.tsx                                 (~130 lignes -- Events chronologie)
|         +-- sinistre-reglement-tab.tsx                                (~100 lignes -- Reglement final)
|
+-- lib/
|    |-- queries/
|    |    +-- sinistres.queries.ts                                      (~180 lignes -- TanStack hooks read-only)
|    |-- api/
|    |    +-- sinistres.api.ts                                          (~150 lignes -- Axios wrappers)
|    |-- schemas/
|    |    +-- sinistre.schema.ts                                        (~220 lignes -- Zod schemas + types)
|    +-- utils/
|         |-- sinistre-status-config.ts                                 (~120 lignes -- Status -> label + couleur + ordre)
|         +-- format-sinistre.ts                                        (~80 lignes -- Formatters)
|
+-- messages/
|    |-- fr.json                                                        (MODIF +120 cles)
|    |-- ar-MA.json                                                     (MODIF +120 cles)
|    +-- ar.json                                                        (MODIF +120 cles)
|
+-- test/
     |-- unit/
     |    |-- sinistres-table.test.tsx                                  (~120 lignes)
     |    |-- sinistre-status-flow.test.tsx                             (~150 lignes)
     |    |-- sinistre-status-config.test.ts                            (~100 lignes)
     |    |-- format-sinistre.test.ts                                   (~80 lignes)
     |    |-- sinistre-schema.test.ts                                   (~120 lignes)
     |    |-- sinistres-filters.test.tsx                                (~140 lignes)
     |    |-- acaps-export-button.test.tsx                              (~100 lignes)
     |    |-- contact-assure-button.test.tsx                            (~70 lignes)
     |    |-- sinistre-info-tab.test.tsx                                (~90 lignes)
     |    |-- sinistre-documents-tab.test.tsx                           (~100 lignes)
     |    |-- sinistre-timeline-tab.test.tsx                            (~80 lignes)
     |    +-- sinistres-queries.test.ts                                 (~120 lignes)
     +-- e2e/
          +-- sinistres.spec.ts                                         (~400 lignes -- 8+ scenarios)
```

**Total nouveau code estimee** : ~3 800 lignes TypeScript/TSX.

**Fichiers modifies (hors creations)** :
- `apps/web-broker/messages/fr.json` (+120 cles sous `sinistres.*`)
- `apps/web-broker/messages/ar-MA.json` (+120 cles parite)
- `apps/web-broker/messages/ar.json` (+120 cles parite)
- `apps/web-broker/next.config.mjs` (ajout `images.remotePatterns` Atlas Cloud si pas deja present)
- `apps/web-broker/.env.example` (NEXT_PUBLIC_MAPBOX_TOKEN documenter usage sinistres map)

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `lib/schemas/sinistre.schema.ts`

```typescript
import { z } from 'zod';

/**
 * Workflow M8 -- 9 statuts + branche litigation alternative.
 * Source de verite : Sprint 21 Vertical Repair (backend OpenAPI).
 * NE PAS modifier sans alignement backend.
 */
export const SINISTRE_STATUSES = [
  'declared',
  'acknowledged',
  'expert_assigned',
  'expertise_done',
  'repair_authorized',
  'repair_done',
  'settled',
  'closed',
  'litigation',
] as const;

export type SinistreStatus = (typeof SINISTRE_STATUSES)[number];

export const BRANCHES_ASSURANCE = [
  'auto',
  'mrh',
  'sante',
  'vie',
  'rc_pro',
  'multirisques_pro',
] as const;

export type BrancheAssurance = (typeof BRANCHES_ASSURANCE)[number];

/** Location lat/lng nullable (sinistre peut etre declare sans geocoding) */
export const sinistreLocationSchema = z.object({
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  address_text: z.string().max(500).nullable(),
  ville: z.string().max(120).nullable(),
  prefecture: z.string().max(120).nullable(),
});

export type SinistreLocation = z.infer<typeof sinistreLocationSchema>;

/** Temoin */
export const sinistreTemoinSchema = z.object({
  nom: z.string().max(200),
  telephone: z.string().regex(/^\+212[5-7]\d{8}$/u).nullable(),
  email: z.string().email().nullable(),
  declaration: z.string().max(2000).nullable(),
});

export type SinistreTemoin = z.infer<typeof sinistreTemoinSchema>;

/** Sinistre principal -- vue liste (light) */
export const sinistreListItemSchema = z.object({
  id: z.string().uuid(),
  sinistre_number: z.string().regex(/^SIN-\d{4}-\d{6}$/u), // SIN-2026-000001
  police_id: z.string().uuid(),
  police_number: z.string(),
  customer_id: z.string().uuid(),
  customer_full_name: z.string(),
  declaration_date: z.string().datetime(),
  status: z.enum(SINISTRE_STATUSES),
  branche: z.enum(BRANCHES_ASSURANCE),
  amount_estimated_mad: z.number().nonnegative().nullable(),
  amount_settled_mad: z.number().nonnegative().nullable(),
  garage_id: z.string().uuid().nullable(),
  garage_name: z.string().nullable(),
  garage_is_active: z.boolean().nullable(),
  expert_id: z.string().uuid().nullable(),
  expert_name: z.string().nullable(),
  is_litigation: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SinistreListItem = z.infer<typeof sinistreListItemSchema>;

/** Sinistre detail (complet) */
export const sinistreSchema = sinistreListItemSchema.extend({
  description: z.string().max(5000),
  location: sinistreLocationSchema,
  declared_time: z.string().nullable(), // "HH:mm" -- heure precise
  police_report_number: z.string().nullable(), // numero PV police
  temoins: z.array(sinistreTemoinSchema).default([]),
  garage_technician_name: z.string().nullable(),
  garage_repair_status: z.enum(['pending', 'in_progress', 'done']).nullable(),
  expert_report_id: z.string().uuid().nullable(),
  expert_assigned_at: z.string().datetime().nullable(),
  expertise_done_at: z.string().datetime().nullable(),
  repair_authorized_at: z.string().datetime().nullable(),
  repair_done_at: z.string().datetime().nullable(),
  settled_at: z.string().datetime().nullable(),
  closed_at: z.string().datetime().nullable(),
  reglement_montant_mad: z.number().nonnegative().nullable(),
  reglement_virement_number: z.string().nullable(),
  reglement_assureur_partenaire: z.enum(['CAA', 'SANAD', 'SAHAM', 'WAFA', 'ATLANTA']).nullable(),
  garanties_activees: z.array(z.object({
    code: z.string(),
    libelle: z.string(),
    plafond_mad: z.number().nonnegative().nullable(),
    franchise_mad: z.number().nonnegative().nullable(),
  })).default([]),
});

export type Sinistre = z.infer<typeof sinistreSchema>;

/** Response list paginate */
export const sinistreListResponseSchema = z.object({
  items: z.array(sinistreListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  total_pages: z.number().int().nonnegative(),
});

export type SinistreListResponse = z.infer<typeof sinistreListResponseSchema>;

/** Filters list */
export const sinistreFiltersSchema = z.object({
  status: z.array(z.enum(SINISTRE_STATUSES)).optional(),
  branche: z.array(z.enum(BRANCHES_ASSURANCE)).optional(),
  declaration_date_start: z.string().datetime().optional(),
  declaration_date_end: z.string().datetime().optional(),
  garage_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  page: z.number().int().positive().default(1),
  page_size: z.number().int().min(10).max(100).default(25),
  sort: z.string().optional(),
});

export type SinistreFilters = z.infer<typeof sinistreFiltersSchema>;

/** Timeline event */
export const sinistreTimelineEventSchema = z.object({
  id: z.string().uuid(),
  sinistre_id: z.string().uuid(),
  event_type: z.enum([
    'declared',
    'acknowledged',
    'expert_assigned',
    'expert_arrived',
    'expert_report_uploaded',
    'expertise_done',
    'garage_selected',
    'garage_accepted',
    'repair_authorized',
    'repair_started',
    'repair_done',
    'invoice_uploaded',
    'settled',
    'closed',
    'comment_added',
    'document_uploaded',
    'litigation_opened',
    'litigation_resolved',
  ]),
  actor_type: z.enum(['system', 'customer', 'broker', 'garage', 'expert', 'assureur', 'admin']),
  actor_id: z.string().uuid().nullable(),
  actor_label: z.string(),
  description: z.string().max(1000),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.string().datetime(),
});

export type SinistreTimelineEvent = z.infer<typeof sinistreTimelineEventSchema>;

/** Document attached */
export const sinistreDocumentSchema = z.object({
  id: z.string().uuid(),
  sinistre_id: z.string().uuid(),
  category: z.enum([
    'photo_sinistre',
    'devis_garage',
    'rapport_expert',
    'pv_police',
    'facture_garage',
    'autre',
  ]),
  filename: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().nonnegative(),
  s3_key: z.string(),
  presigned_url: z.string().url(),
  presigned_url_expires_at: z.string().datetime(),
  uploaded_by_actor_type: z.enum(['customer', 'broker', 'garage', 'expert', 'admin']),
  uploaded_at: z.string().datetime(),
});

export type SinistreDocument = z.infer<typeof sinistreDocumentSchema>;

/** Photo (sous-categorie de document avec semantique avant/apres) */
export const sinistrePhotoSchema = sinistreDocumentSchema.extend({
  category: z.literal('photo_sinistre'),
  photo_type: z.enum(['avant', 'apres', 'sinistre_initial']),
  caption: z.string().max(500).nullable(),
});

export type SinistrePhoto = z.infer<typeof sinistrePhotoSchema>;

/** Expert report */
export const sinistreExpertReportSchema = z.object({
  id: z.string().uuid(),
  sinistre_id: z.string().uuid(),
  expert_id: z.string().uuid(),
  expert_name: z.string(),
  expert_matricule: z.string(), // matricule ACAPS
  report_date: z.string().datetime(),
  montant_evalue_mad: z.number().nonnegative(),
  vehicule_etat: z.enum(['reparable', 'epave', 'reparable_partiel']),
  conclusion: z.string().max(5000),
  document_id: z.string().uuid(), // doc S3 PDF rapport complet
  presigned_url: z.string().url(),
  photos_avant_count: z.number().int().nonnegative(),
  photos_apres_count: z.number().int().nonnegative(),
});

export type SinistreExpertReport = z.infer<typeof sinistreExpertReportSchema>;
```

### 6.2 `lib/utils/sinistre-status-config.ts`

```typescript
import type { SinistreStatus } from '@/lib/schemas/sinistre.schema';

/**
 * Configuration centralisee status sinistre :
 * - ordre dans le workflow stepper
 * - couleur badge (token shadcn HSL via CSS variables Tailwind)
 * - icone lucide (optionnel)
 * - clé i18n (resolve via useTranslations)
 */
export interface SinistreStatusConfig {
  status: SinistreStatus;
  order: number; // 1-8 pour workflow sequentiel, 0 pour litigation (branche)
  isBranch: boolean; // true pour litigation
  i18nKey: string; // ex "sinistres.status.declared"
  badgeVariant: 'slate' | 'sky' | 'amber' | 'orange' | 'blue' | 'indigo' | 'emerald' | 'green' | 'destructive';
  bgClass: string; // Tailwind classes
  textClass: string;
  borderClass: string;
  ringClass: string;
}

export const SINISTRE_STATUS_CONFIG: Record<SinistreStatus, SinistreStatusConfig> = {
  declared: {
    status: 'declared',
    order: 1,
    isBranch: false,
    i18nKey: 'sinistres.status.declared',
    badgeVariant: 'slate',
    bgClass: 'bg-slate-100 dark:bg-slate-800',
    textClass: 'text-slate-700 dark:text-slate-300',
    borderClass: 'border-slate-300 dark:border-slate-600',
    ringClass: 'ring-slate-300/40',
  },
  acknowledged: {
    status: 'acknowledged',
    order: 2,
    isBranch: false,
    i18nKey: 'sinistres.status.acknowledged',
    badgeVariant: 'sky',
    bgClass: 'bg-sky-100 dark:bg-sky-900/30',
    textClass: 'text-sky-700 dark:text-sky-300',
    borderClass: 'border-sky-300 dark:border-sky-700',
    ringClass: 'ring-sky-300/40',
  },
  expert_assigned: {
    status: 'expert_assigned',
    order: 3,
    isBranch: false,
    i18nKey: 'sinistres.status.expert_assigned',
    badgeVariant: 'amber',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-700 dark:text-amber-300',
    borderClass: 'border-amber-300 dark:border-amber-700',
    ringClass: 'ring-amber-300/40',
  },
  expertise_done: {
    status: 'expertise_done',
    order: 4,
    isBranch: false,
    i18nKey: 'sinistres.status.expertise_done',
    badgeVariant: 'orange',
    bgClass: 'bg-orange-100 dark:bg-orange-900/30',
    textClass: 'text-orange-700 dark:text-orange-300',
    borderClass: 'border-orange-300 dark:border-orange-700',
    ringClass: 'ring-orange-300/40',
  },
  repair_authorized: {
    status: 'repair_authorized',
    order: 5,
    isBranch: false,
    i18nKey: 'sinistres.status.repair_authorized',
    badgeVariant: 'blue',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-700 dark:text-blue-300',
    borderClass: 'border-blue-300 dark:border-blue-700',
    ringClass: 'ring-blue-300/40',
  },
  repair_done: {
    status: 'repair_done',
    order: 6,
    isBranch: false,
    i18nKey: 'sinistres.status.repair_done',
    badgeVariant: 'indigo',
    bgClass: 'bg-indigo-100 dark:bg-indigo-900/30',
    textClass: 'text-indigo-700 dark:text-indigo-300',
    borderClass: 'border-indigo-300 dark:border-indigo-700',
    ringClass: 'ring-indigo-300/40',
  },
  settled: {
    status: 'settled',
    order: 7,
    isBranch: false,
    i18nKey: 'sinistres.status.settled',
    badgeVariant: 'emerald',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
    textClass: 'text-emerald-700 dark:text-emerald-300',
    borderClass: 'border-emerald-300 dark:border-emerald-700',
    ringClass: 'ring-emerald-300/40',
  },
  closed: {
    status: 'closed',
    order: 8,
    isBranch: false,
    i18nKey: 'sinistres.status.closed',
    badgeVariant: 'green',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-700 dark:text-green-300',
    borderClass: 'border-green-300 dark:border-green-700',
    ringClass: 'ring-green-300/40',
  },
  litigation: {
    status: 'litigation',
    order: 0, // branche alternative
    isBranch: true,
    i18nKey: 'sinistres.status.litigation',
    badgeVariant: 'destructive',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-700 dark:text-red-300',
    borderClass: 'border-red-400 dark:border-red-700',
    ringClass: 'ring-red-300/40',
  },
};

/** Ordre sequentiel workflow (sans litigation) */
export const SINISTRE_WORKFLOW_ORDER: SinistreStatus[] = [
  'declared',
  'acknowledged',
  'expert_assigned',
  'expertise_done',
  'repair_authorized',
  'repair_done',
  'settled',
  'closed',
];

/** Retourne true si status1 est avant status2 dans workflow */
export function isStatusBefore(status1: SinistreStatus, status2: SinistreStatus): boolean {
  const cfg1 = SINISTRE_STATUS_CONFIG[status1];
  const cfg2 = SINISTRE_STATUS_CONFIG[status2];
  if (cfg1.isBranch || cfg2.isBranch) return false;
  return cfg1.order < cfg2.order;
}

/** Retourne true si status est dans la chaine apres "currentStatus" => "pending" */
export function isStatusPending(status: SinistreStatus, currentStatus: SinistreStatus): boolean {
  return isStatusBefore(currentStatus, status);
}

/** Retourne true si status est avant currentStatus (etape franchie) => "completed" */
export function isStatusCompleted(status: SinistreStatus, currentStatus: SinistreStatus): boolean {
  return isStatusBefore(status, currentStatus);
}

/** Fallback safe pour status inconnu */
export function getSinistreStatusConfig(status: string): SinistreStatusConfig {
  const cfg = SINISTRE_STATUS_CONFIG[status as SinistreStatus];
  if (cfg) return cfg;
  // Fallback safe
  return {
    status: 'declared' as SinistreStatus,
    order: 0,
    isBranch: false,
    i18nKey: 'sinistres.status.unknown',
    badgeVariant: 'slate',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    borderClass: 'border-slate-300',
    ringClass: 'ring-slate-300/40',
  };
}
```

### 6.3 `lib/utils/format-sinistre.ts`

```typescript
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { fr, arSA } from 'date-fns/locale';
import { utcToZonedTime } from 'date-fns-tz';

const TZ = 'Africa/Casablanca';

const localeMap = {
  fr,
  'ar-MA': arSA,
  ar: arSA,
};

/** Formatte sinistre_number en upper case */
export function formatSinistreNumber(num: string): string {
  return num.toUpperCase();
}

/** Formatte montant MAD avec separateur arabe selon locale */
export function formatMontantMAD(amount: number | null | undefined, locale: string): string {
  if (amount === null || amount === undefined) return '--';
  const formatter = new Intl.NumberFormat(
    locale === 'fr' ? 'fr-MA' : 'ar-MA',
    {
      style: 'currency',
      currency: 'MAD',
      maximumFractionDigits: 2,
    },
  );
  return formatter.format(amount);
}

/** Formatte date ISO en zone Africa/Casablanca */
export function formatDateCasablanca(
  isoDate: string | null | undefined,
  locale: string,
  pattern: string = 'dd/MM/yyyy',
): string {
  if (!isoDate) return '--';
  const zoned = utcToZonedTime(parseISO(isoDate), TZ);
  return format(zoned, pattern, {
    locale: localeMap[locale as keyof typeof localeMap] ?? fr,
  });
}

/** Date relative ("il y a 2h") */
export function formatRelative(isoDate: string | null | undefined, locale: string): string {
  if (!isoDate) return '--';
  return formatDistanceToNow(parseISO(isoDate), {
    addSuffix: true,
    locale: localeMap[locale as keyof typeof localeMap] ?? fr,
  });
}

/** Tronque description longue avec ellipsis */
export function truncateDescription(text: string, max: number = 120): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + '...';
}
```

### 6.4 `lib/api/sinistres.api.ts`

```typescript
import { apiClient } from '@/lib/api/client';
import {
  sinistreSchema,
  sinistreListResponseSchema,
  sinistreTimelineEventSchema,
  sinistreDocumentSchema,
  sinistrePhotoSchema,
  sinistreExpertReportSchema,
  type SinistreFilters,
  type Sinistre,
  type SinistreListResponse,
  type SinistreTimelineEvent,
  type SinistreDocument,
  type SinistrePhoto,
  type SinistreExpertReport,
} from '@/lib/schemas/sinistre.schema';
import { z } from 'zod';

/**
 * Read-only API client for sinistres module.
 * AUCUNE mutation -- M9 broker sans intervention.
 */

function buildQuery(filters: SinistreFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.status?.length) {
    for (const s of filters.status) params.append('status', s);
  }
  if (filters.branche?.length) {
    for (const b of filters.branche) params.append('branche', b);
  }
  if (filters.declaration_date_start) params.set('declaration_date_start', filters.declaration_date_start);
  if (filters.declaration_date_end) params.set('declaration_date_end', filters.declaration_date_end);
  if (filters.garage_id) params.set('garage_id', filters.garage_id);
  if (filters.customer_id) params.set('customer_id', filters.customer_id);
  params.set('page', String(filters.page));
  params.set('page_size', String(filters.page_size));
  if (filters.sort) params.set('sort', filters.sort);
  return params;
}

export async function fetchSinistresList(filters: SinistreFilters): Promise<SinistreListResponse> {
  const params = buildQuery(filters);
  const res = await apiClient.get(`/api/v1/repair/sinistres?${params.toString()}`);
  return sinistreListResponseSchema.parse(res.data);
}

export async function fetchSinistre(id: string): Promise<Sinistre> {
  const res = await apiClient.get(`/api/v1/repair/sinistres/${id}`);
  return sinistreSchema.parse(res.data);
}

export async function fetchSinistreTimeline(id: string): Promise<SinistreTimelineEvent[]> {
  const res = await apiClient.get(`/api/v1/repair/sinistres/${id}/timeline`);
  return z.array(sinistreTimelineEventSchema).parse(res.data);
}

export async function fetchSinistreDocuments(id: string): Promise<SinistreDocument[]> {
  const res = await apiClient.get(`/api/v1/repair/sinistres/${id}/documents`);
  return z.array(sinistreDocumentSchema).parse(res.data);
}

export async function fetchSinistrePhotos(id: string): Promise<SinistrePhoto[]> {
  const res = await apiClient.get(`/api/v1/repair/sinistres/${id}/photos`);
  return z.array(sinistrePhotoSchema).parse(res.data);
}

export async function fetchSinistreExpertReport(id: string): Promise<SinistreExpertReport | null> {
  try {
    const res = await apiClient.get(`/api/v1/repair/sinistres/${id}/expert-report`);
    return sinistreExpertReportSchema.parse(res.data);
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export interface AcapsExportParams {
  date_start: string;
  date_end: string;
  format: 'csv' | 'pdf';
}

export async function exportAcapsReport(params: AcapsExportParams): Promise<Blob> {
  const search = new URLSearchParams({
    date_start: params.date_start,
    date_end: params.date_end,
    format: params.format,
  });
  const res = await apiClient.get(`/api/v1/repair/sinistres/export-acaps?${search.toString()}`, {
    responseType: 'blob',
  });
  return res.data;
}

/** Regenere une presigned URL si expire (404 ou 403) */
export async function regeneratePresignedUrl(documentId: string): Promise<string> {
  const res = await apiClient.post(`/api/v1/documents/${documentId}/regenerate-presigned-url`);
  return z.object({ presigned_url: z.string().url() }).parse(res.data).presigned_url;
}
```

### 6.5 `lib/queries/sinistres.queries.ts`

```typescript
'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import {
  fetchSinistresList,
  fetchSinistre,
  fetchSinistreTimeline,
  fetchSinistreDocuments,
  fetchSinistrePhotos,
  fetchSinistreExpertReport,
} from '@/lib/api/sinistres.api';
import type {
  Sinistre,
  SinistreFilters,
  SinistreListResponse,
  SinistreTimelineEvent,
  SinistreDocument,
  SinistrePhoto,
  SinistreExpertReport,
} from '@/lib/schemas/sinistre.schema';

const FIVE_MIN = 5 * 60 * 1000;
const THIRTY_MIN = 30 * 60 * 1000;

export const sinistresKeys = {
  all: ['sinistres'] as const,
  list: (filters: SinistreFilters) => [...sinistresKeys.all, 'list', filters] as const,
  detail: (id: string) => [...sinistresKeys.all, 'detail', id] as const,
  timeline: (id: string) => [...sinistresKeys.all, 'detail', id, 'timeline'] as const,
  documents: (id: string) => [...sinistresKeys.all, 'detail', id, 'documents'] as const,
  photos: (id: string) => [...sinistresKeys.all, 'detail', id, 'photos'] as const,
  expertReport: (id: string) => [...sinistresKeys.all, 'detail', id, 'expert-report'] as const,
};

export function useSinistresList(
  filters: SinistreFilters,
  options?: Omit<UseQueryOptions<SinistreListResponse>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SinistreListResponse>({
    queryKey: sinistresKeys.list(filters),
    queryFn: () => fetchSinistresList(filters),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    placeholderData: (previousData) => previousData,
    ...options,
  });
}

export function useSinistre(
  id: string,
  options?: Omit<UseQueryOptions<Sinistre>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<Sinistre>({
    queryKey: sinistresKeys.detail(id),
    queryFn: () => fetchSinistre(id),
    staleTime: FIVE_MIN,
    gcTime: THIRTY_MIN,
    enabled: !!id,
    ...options,
  });
}

export function useSinistreTimeline(
  id: string,
  options?: Omit<UseQueryOptions<SinistreTimelineEvent[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SinistreTimelineEvent[]>({
    queryKey: sinistresKeys.timeline(id),
    queryFn: () => fetchSinistreTimeline(id),
    staleTime: FIVE_MIN,
    enabled: !!id,
    ...options,
  });
}

export function useSinistreDocuments(
  id: string,
  options?: Omit<UseQueryOptions<SinistreDocument[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SinistreDocument[]>({
    queryKey: sinistresKeys.documents(id),
    queryFn: () => fetchSinistreDocuments(id),
    staleTime: FIVE_MIN,
    enabled: !!id,
    ...options,
  });
}

export function useSinistrePhotos(
  id: string,
  options?: Omit<UseQueryOptions<SinistrePhoto[]>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SinistrePhoto[]>({
    queryKey: sinistresKeys.photos(id),
    queryFn: () => fetchSinistrePhotos(id),
    staleTime: FIVE_MIN,
    enabled: !!id,
    ...options,
  });
}

export function useSinistreExpertReport(
  id: string,
  options?: Omit<UseQueryOptions<SinistreExpertReport | null>, 'queryKey' | 'queryFn'>,
) {
  return useQuery<SinistreExpertReport | null>({
    queryKey: sinistresKeys.expertReport(id),
    queryFn: () => fetchSinistreExpertReport(id),
    staleTime: FIVE_MIN,
    enabled: !!id,
    ...options,
  });
}

/**
 * EXPLICIT : aucune mutation hook exportee.
 * M9 broker sans intervention = lecture exclusivement.
 */
```

### 6.6 `app/[locale]/(protected)/sinistres/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { fetchSinistresList } from '@/lib/api/sinistres.api';
import { SinistresTable } from '@/components/sinistres/sinistres-table';
import { SinistresFilters } from '@/components/sinistres/sinistres-filters';
import { AcapsExportButton } from '@/components/sinistres/acaps-export-button';
import { HasPermission } from '@/components/auth/has-permission';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs/server';
import { SINISTRE_STATUSES, BRANCHES_ASSURANCE } from '@/lib/schemas/sinistre.schema';

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sinistres.list' });
  return {
    title: t('pageTitle'),
    description: t('pageDescription'),
  };
}

export default async function SinistresListPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'sinistres.list' });

  // Parse URL filters (server-side compatible)
  const filters = {
    status: parseAsArrayOf(parseAsStringEnum([...SINISTRE_STATUSES])).parseServerSide(sp.status) ?? undefined,
    branche: parseAsArrayOf(parseAsStringEnum([...BRANCHES_ASSURANCE])).parseServerSide(sp.branche) ?? undefined,
    declaration_date_start: parseAsString.parseServerSide(sp.date_start) ?? undefined,
    declaration_date_end: parseAsString.parseServerSide(sp.date_end) ?? undefined,
    garage_id: parseAsString.parseServerSide(sp.garage) ?? undefined,
    customer_id: parseAsString.parseServerSide(sp.customer) ?? undefined,
    page: parseAsInteger.parseServerSide(sp.page) ?? 1,
    page_size: parseAsInteger.parseServerSide(sp.page_size) ?? 25,
    sort: parseAsString.parseServerSide(sp.sort) ?? undefined,
  };

  // Prefetch list
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['sinistres', 'list', filters],
    queryFn: () => fetchSinistresList(filters),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <PageHeader
          title={t('pageTitle')}
          description={t('pageDescription')}
          actions={
            <HasPermission permission="reporting.acaps.export">
              <AcapsExportButton />
            </HasPermission>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>{t('filtersTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SinistresFilters />
          </CardContent>
        </Card>

        <Suspense fallback={<div role="status" aria-busy="true">{t('loadingTable')}</div>}>
          <SinistresTable initialFilters={filters} />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
```

### 6.7 `app/[locale]/(protected)/sinistres/[id]/page.tsx`

```tsx
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import {
  fetchSinistre,
  fetchSinistreTimeline,
  fetchSinistreDocuments,
  fetchSinistrePhotos,
  fetchSinistreExpertReport,
} from '@/lib/api/sinistres.api';
import { SinistreHeaderCard } from '@/components/sinistres/sinistre-header-card';
import { SinistreTabsShell } from '@/components/sinistres/tabs/sinistre-tabs-shell';
import { ContactAssureButton } from '@/components/sinistres/contact-assure-button';
import { PrintBrokerReportButton } from '@/components/sinistres/print-broker-report-button';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'sinistres.detail' });
  return {
    title: t('pageTitle', { id }),
  };
}

export default async function SinistreDetailPage({ params }: PageProps) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'sinistres.detail' });

  // Prefetch all detail data in parallel
  const queryClient = new QueryClient();
  let sinistre;
  try {
    sinistre = await fetchSinistre(id);
  } catch (err: any) {
    if (err?.response?.status === 404) notFound();
    throw err;
  }

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ['sinistres', 'detail', id],
      queryFn: () => Promise.resolve(sinistre),
    }),
    queryClient.prefetchQuery({
      queryKey: ['sinistres', 'detail', id, 'timeline'],
      queryFn: () => fetchSinistreTimeline(id),
    }),
    queryClient.prefetchQuery({
      queryKey: ['sinistres', 'detail', id, 'documents'],
      queryFn: () => fetchSinistreDocuments(id),
    }),
    queryClient.prefetchQuery({
      queryKey: ['sinistres', 'detail', id, 'photos'],
      queryFn: () => fetchSinistrePhotos(id),
    }),
    queryClient.prefetchQuery({
      queryKey: ['sinistres', 'detail', id, 'expert-report'],
      queryFn: () => fetchSinistreExpertReport(id),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/${locale}/sinistres`}>
              <ArrowLeftIcon className="me-2 size-4" />
              {t('backToList')}
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <ContactAssureButton sinistreId={id} customerId={sinistre.customer_id} />
            <PrintBrokerReportButton sinistreId={id} />
          </div>
        </div>

        <SinistreHeaderCard sinistre={sinistre} />

        <SinistreTabsShell sinistreId={id} />
      </div>
    </HydrationBoundary>
  );
}
```

### 6.8 `components/sinistres/sinistres-table.tsx`

```tsx
'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useQueryStates, parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringEnum } from 'nuqs';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  SortingState,
  getSortedRowModel,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSinistresList } from '@/lib/queries/sinistres.queries';
import { SINISTRE_STATUSES, BRANCHES_ASSURANCE, type SinistreFilters, type SinistreListItem } from '@/lib/schemas/sinistre.schema';
import { SinistreStatusBadge } from './sinistre-status-badge';
import { EmptyState } from './empty-state';
import { formatMontantMAD, formatDateCasablanca, formatSinistreNumber } from '@/lib/utils/format-sinistre';
import { ArrowUpDown, ChevronLeft, ChevronRight, AlertTriangleIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface SinistresTableProps {
  initialFilters: SinistreFilters;
}

export function SinistresTable({ initialFilters }: SinistresTableProps) {
  const t = useTranslations('sinistres.table');
  const locale = useLocale();
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([]);

  // URL state sync via nuqs (client)
  const [urlState, setUrlState] = useQueryStates({
    status: parseAsArrayOf(parseAsStringEnum([...SINISTRE_STATUSES])),
    branche: parseAsArrayOf(parseAsStringEnum([...BRANCHES_ASSURANCE])),
    date_start: parseAsString,
    date_end: parseAsString,
    garage: parseAsString,
    customer: parseAsString,
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(25),
    sort: parseAsString,
  });

  const filters: SinistreFilters = useMemo(() => ({
    status: urlState.status ?? undefined,
    branche: urlState.branche ?? undefined,
    declaration_date_start: urlState.date_start ?? undefined,
    declaration_date_end: urlState.date_end ?? undefined,
    garage_id: urlState.garage ?? undefined,
    customer_id: urlState.customer ?? undefined,
    page: urlState.page,
    page_size: urlState.page_size,
    sort: urlState.sort ?? undefined,
  }), [urlState]);

  const { data, isLoading, isError, refetch } = useSinistresList(filters);

  const columns = useMemo<ColumnDef<SinistreListItem>[]>(() => [
    {
      accessorKey: 'sinistre_number',
      header: () => <span>{t('columns.sinistre_number')}</span>,
      cell: ({ row }) => (
        <Link
          href={`/${locale}/sinistres/${row.original.id}`}
          className="font-mono text-sm text-primary hover:underline"
          data-testid="sinistre-row-link"
        >
          {formatSinistreNumber(row.original.sinistre_number)}
        </Link>
      ),
    },
    {
      accessorKey: 'police_number',
      header: () => <span>{t('columns.police')}</span>,
      cell: ({ row }) => (
        <Link
          href={`/${locale}/polices/${row.original.police_id}`}
          className="text-sm hover:underline"
        >
          {row.original.police_number}
        </Link>
      ),
    },
    {
      accessorKey: 'customer_full_name',
      header: () => <span>{t('columns.customer')}</span>,
      cell: ({ row }) => (
        <Link
          href={`/${locale}/contacts/${row.original.customer_id}`}
          className="text-sm hover:underline"
        >
          {row.original.customer_full_name}
        </Link>
      ),
    },
    {
      accessorKey: 'declaration_date',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          aria-sort={column.getIsSorted() === 'asc' ? 'ascending' : column.getIsSorted() === 'desc' ? 'descending' : 'none'}
        >
          {t('columns.declaration_date')}
          <ArrowUpDown className="ms-2 size-3" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">{formatDateCasablanca(row.original.declaration_date, locale)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: () => <span>{t('columns.status')}</span>,
      cell: ({ row }) => (
        <SinistreStatusBadge status={row.original.status} />
      ),
    },
    {
      accessorKey: 'amount_estimated_mad',
      header: () => <span className="text-end block">{t('columns.amount')}</span>,
      cell: ({ row }) => (
        <span className="text-end block tabular-nums">{formatMontantMAD(row.original.amount_estimated_mad, locale)}</span>
      ),
    },
    {
      accessorKey: 'garage_name',
      header: () => <span>{t('columns.garage')}</span>,
      cell: ({ row }) => row.original.garage_name ? (
        <span className="text-sm inline-flex items-center gap-1">
          {row.original.garage_name}
          {row.original.garage_is_active === false && (
            <AlertTriangleIcon className="size-3 text-amber-500" aria-label={t('garageInactiveBadge')} />
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">{t('notAssigned')}</span>
      ),
    },
    {
      accessorKey: 'expert_name',
      header: () => <span>{t('columns.expert')}</span>,
      cell: ({ row }) => row.original.expert_name ?? <span className="text-muted-foreground">{t('notAssigned')}</span>,
    },
  ], [locale, t]);

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: data?.total_pages ?? 0,
  });

  if (isLoading) return <SinistresTableSkeleton />;
  if (isError) return (
    <div className="p-6 text-center">
      <p className="text-destructive">{t('errorLoading')}</p>
      <Button onClick={() => refetch()} className="mt-4">{t('retry')}</Button>
    </div>
  );
  if (!data || data.items.length === 0) return <EmptyState />;

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} scope="col">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-testid="sinistre-row"
                onClick={() => router.push(`/${locale}/sinistres/${row.original.id}`)}
                className="cursor-pointer hover:bg-muted/50"
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} onClick={(e) => {
                    // Permettre clic sur lien sans propagation
                    if ((e.target as HTMLElement).closest('a, button')) {
                      e.stopPropagation();
                    }
                  }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('paginationLabel', { page: data.page, total_pages: data.total_pages, total: data.total })}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUrlState({ page: Math.max(1, data.page - 1) })}
            disabled={data.page <= 1}
            aria-label={t('previousPage')}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setUrlState({ page: data.page + 1 })}
            disabled={data.page >= data.total_pages}
            aria-label={t('nextPage')}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function SinistresTableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}
```

### 6.9 `components/sinistres/sinistres-filters.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useQueryStates, parseAsArrayOf, parseAsString, parseAsStringEnum, parseAsInteger } from 'nuqs';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Calendar } from '@/components/ui/calendar';
import { SINISTRE_STATUSES, BRANCHES_ASSURANCE, type SinistreStatus, type BrancheAssurance } from '@/lib/schemas/sinistre.schema';
import { Filter, X, RefreshCw, CalendarIcon } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export function SinistresFilters() {
  const t = useTranslations('sinistres.filters');

  const [urlState, setUrlState] = useQueryStates({
    status: parseAsArrayOf(parseAsStringEnum([...SINISTRE_STATUSES])),
    branche: parseAsArrayOf(parseAsStringEnum([...BRANCHES_ASSURANCE])),
    date_start: parseAsString,
    date_end: parseAsString,
    garage: parseAsString,
    customer: parseAsString,
    page: parseAsInteger.withDefault(1),
  });

  const [garageInput, setGarageInput] = useState(urlState.garage ?? '');
  const [customerInput, setCustomerInput] = useState(urlState.customer ?? '');

  const toggleStatus = (status: SinistreStatus) => {
    const current = urlState.status ?? [];
    const next = current.includes(status) ? current.filter((s) => s !== status) : [...current, status];
    setUrlState({ status: next.length ? next : null, page: 1 });
  };

  const toggleBranche = (branche: BrancheAssurance) => {
    const current = urlState.branche ?? [];
    const next = current.includes(branche) ? current.filter((b) => b !== branche) : [...current, branche];
    setUrlState({ branche: next.length ? next : null, page: 1 });
  };

  const clearAll = () => {
    setUrlState({
      status: null,
      branche: null,
      date_start: null,
      date_end: null,
      garage: null,
      customer: null,
      page: 1,
    });
    setGarageInput('');
    setCustomerInput('');
  };

  const applyGarage = () => setUrlState({ garage: garageInput || null, page: 1 });
  const applyCustomer = () => setUrlState({ customer: customerInput || null, page: 1 });

  const hasActiveFilters =
    (urlState.status?.length ?? 0) > 0 ||
    (urlState.branche?.length ?? 0) > 0 ||
    !!urlState.date_start ||
    !!urlState.date_end ||
    !!urlState.garage ||
    !!urlState.customer;

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Status multiselect */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="me-2 size-4" />
            {t('status')}
            {(urlState.status?.length ?? 0) > 0 && (
              <span className="ms-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-2 text-xs">
                {urlState.status?.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            {SINISTRE_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={urlState.status?.includes(s) ?? false}
                  onCheckedChange={() => toggleStatus(s)}
                  aria-label={t(`statusOption.${s}`)}
                />
                <span className="text-sm">{t(`statusOption.${s}`)}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Branche multiselect */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="me-2 size-4" />
            {t('branche')}
            {(urlState.branche?.length ?? 0) > 0 && (
              <span className="ms-2 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground px-2 text-xs">
                {urlState.branche?.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <div className="space-y-2">
            {BRANCHES_ASSURANCE.map((b) => (
              <label key={b} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={urlState.branche?.includes(b) ?? false}
                  onCheckedChange={() => toggleBranche(b)}
                  aria-label={t(`brancheOption.${b}`)}
                />
                <span className="text-sm">{t(`brancheOption.${b}`)}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Date range */}
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="me-2 size-4" />
              {urlState.date_start ? format(parseISO(urlState.date_start), 'dd/MM/yyyy', { locale: fr }) : t('dateStart')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={urlState.date_start ? parseISO(urlState.date_start) : undefined}
              onSelect={(d) => setUrlState({ date_start: d?.toISOString() ?? null, page: 1 })}
            />
          </PopoverContent>
        </Popover>

        <span className="text-muted-foreground">{t('to')}</span>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <CalendarIcon className="me-2 size-4" />
              {urlState.date_end ? format(parseISO(urlState.date_end), 'dd/MM/yyyy', { locale: fr }) : t('dateEnd')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={urlState.date_end ? parseISO(urlState.date_end) : undefined}
              onSelect={(d) => setUrlState({ date_end: d?.toISOString() ?? null, page: 1 })}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Garage filter (texte simplifie -- enrichir Sprint 22 autocomplete) */}
      <div className="space-y-1">
        <Label htmlFor="garage-filter" className="text-xs">{t('garage')}</Label>
        <Input
          id="garage-filter"
          value={garageInput}
          onChange={(e) => setGarageInput(e.target.value)}
          onBlur={applyGarage}
          onKeyDown={(e) => { if (e.key === 'Enter') applyGarage(); }}
          placeholder={t('garagePlaceholder')}
          className="w-44 h-9"
        />
      </div>

      {/* Customer filter */}
      <div className="space-y-1">
        <Label htmlFor="customer-filter" className="text-xs">{t('customer')}</Label>
        <Input
          id="customer-filter"
          value={customerInput}
          onChange={(e) => setCustomerInput(e.target.value)}
          onBlur={applyCustomer}
          onKeyDown={(e) => { if (e.key === 'Enter') applyCustomer(); }}
          placeholder={t('customerPlaceholder')}
          className="w-44 h-9"
        />
      </div>

      {/* Clear all */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="me-2 size-4" />
          {t('clearAll')}
        </Button>
      )}
    </div>
  );
}
```

### 6.10 `components/sinistres/sinistre-status-flow.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import {
  SINISTRE_WORKFLOW_ORDER,
  getSinistreStatusConfig,
  isStatusCompleted,
} from '@/lib/utils/sinistre-status-config';
import type { SinistreStatus } from '@/lib/schemas/sinistre.schema';
import { CheckIcon, AlertTriangleIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SinistreStatusFlowProps {
  currentStatus: SinistreStatus;
  isLitigation: boolean;
}

export function SinistreStatusFlow({ currentStatus, isLitigation }: SinistreStatusFlowProps) {
  const t = useTranslations('sinistres.status');

  // Litigation = branche separee, on l'affiche en encart distinct
  if (isLitigation) {
    return (
      <div className="rounded-md border-2 border-red-400 bg-red-50 dark:bg-red-950/20 p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-red-100 dark:bg-red-900 p-2">
            <AlertTriangleIcon className="size-5 text-red-700 dark:text-red-300" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-red-900 dark:text-red-100">{t('litigationTitle')}</p>
            <p className="text-sm text-red-700 dark:text-red-300">{t('litigationDescription')}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <nav aria-label={t('flowAriaLabel')}>
      <ol role="list" className="flex items-center w-full" data-testid="sinistre-status-flow">
        {SINISTRE_WORKFLOW_ORDER.map((status, idx) => {
          const cfg = getSinistreStatusConfig(status);
          const isCurrent = status === currentStatus;
          const isCompleted = isStatusCompleted(status, currentStatus);
          const isPending = !isCurrent && !isCompleted;
          const isLast = idx === SINISTRE_WORKFLOW_ORDER.length - 1;

          return (
            <li
              key={status}
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              className={cn(
                'relative flex items-center',
                !isLast && 'flex-1',
              )}
              data-testid={`status-step-${status}`}
              data-state={isCompleted ? 'completed' : isCurrent ? 'current' : 'pending'}
            >
              <div className="flex flex-col items-center gap-1 z-10">
                <div
                  className={cn(
                    'rounded-full size-8 flex items-center justify-center border-2 transition-colors',
                    isCompleted && 'bg-emerald-500 border-emerald-500 text-white',
                    isCurrent && `${cfg.bgClass} ${cfg.borderClass} ${cfg.textClass} ring-4 ${cfg.ringClass}`,
                    isPending && 'bg-muted border-muted-foreground/30 text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {isCompleted ? (
                    <CheckIcon className="size-4" />
                  ) : (
                    <span className="text-xs font-semibold">{cfg.order}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs text-center max-w-[80px]',
                    isCurrent && 'font-semibold',
                    isPending && 'text-muted-foreground',
                  )}
                >
                  {t(status)}
                </span>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-2 -mt-5',
                    isCompleted ? 'bg-emerald-500' : 'bg-muted-foreground/20',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

### 6.11 `components/sinistres/sinistre-status-badge.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { getSinistreStatusConfig } from '@/lib/utils/sinistre-status-config';
import type { SinistreStatus } from '@/lib/schemas/sinistre.schema';
import { cn } from '@/lib/utils';

interface SinistreStatusBadgeProps {
  status: SinistreStatus;
  className?: string;
}

export function SinistreStatusBadge({ status, className }: SinistreStatusBadgeProps) {
  const t = useTranslations('sinistres.status');
  const cfg = getSinistreStatusConfig(status);

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        cfg.bgClass,
        cfg.textClass,
        cfg.borderClass,
        className,
      )}
      data-testid={`status-badge-${status}`}
      role="status"
      aria-label={t(`ariaLabel`, { status: t(status) })}
    >
      {t(status)}
    </span>
  );
}
```

### 6.12 `components/sinistres/sinistre-header-card.tsx`

```tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { SinistreStatusFlow } from './sinistre-status-flow';
import { SinistreStatusBadge } from './sinistre-status-badge';
import type { Sinistre } from '@/lib/schemas/sinistre.schema';
import { formatMontantMAD, formatDateCasablanca, formatSinistreNumber } from '@/lib/utils/format-sinistre';

interface SinistreHeaderCardProps {
  sinistre: Sinistre;
}

export function SinistreHeaderCard({ sinistre }: SinistreHeaderCardProps) {
  const t = useTranslations('sinistres.detail.header');
  const locale = useLocale();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tabular-nums">{formatSinistreNumber(sinistre.sinistre_number)}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <SinistreStatusBadge status={sinistre.status} />
              {sinistre.is_litigation && (
                <span className="inline-flex items-center rounded-full border border-red-400 bg-red-100 text-red-900 px-2.5 py-0.5 text-xs font-semibold">
                  {t('litigationBadge')}
                </span>
              )}
            </div>
          </div>
          <div className="text-end space-y-1">
            <p className="text-sm text-muted-foreground">{t('declarationDate')}</p>
            <p className="font-medium">{formatDateCasablanca(sinistre.declaration_date, locale, 'dd/MM/yyyy HH:mm')}</p>
            {sinistre.amount_estimated_mad !== null && (
              <>
                <p className="text-sm text-muted-foreground mt-2">{t('amountEstimated')}</p>
                <p className="font-semibold text-lg tabular-nums">{formatMontantMAD(sinistre.amount_estimated_mad, locale)}</p>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 pb-6">
        <SinistreStatusFlow currentStatus={sinistre.status} isLitigation={sinistre.is_litigation} />
      </CardContent>
    </Card>
  );
}
```

### 6.13 `components/sinistres/tabs/sinistre-tabs-shell.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Suspense } from 'react';
import { SinistreInfoTab } from './sinistre-info-tab';
import { SinistrePoliceTab } from './sinistre-police-tab';
import { SinistreCustomerTab } from './sinistre-customer-tab';
import { SinistreGarageTab } from './sinistre-garage-tab';
import { SinistreExpertTab } from './sinistre-expert-tab';
import { SinistreDocumentsTab } from './sinistre-documents-tab';
import { SinistreTimelineTab } from './sinistre-timeline-tab';
import { SinistreReglementTab } from './sinistre-reglement-tab';
import { Skeleton } from '@/components/ui/skeleton';

interface SinistreTabsShellProps {
  sinistreId: string;
}

const TABS = ['info', 'police', 'customer', 'garage', 'expert', 'documents', 'timeline', 'reglement'] as const;

export function SinistreTabsShell({ sinistreId }: SinistreTabsShellProps) {
  const t = useTranslations('sinistres.detail.tabs');

  return (
    <Tabs defaultValue="info" className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
        {TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} data-testid={`tab-trigger-${tab}`}>
            {t(`${tab}.label`)}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="info" className="mt-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SinistreInfoTab sinistreId={sinistreId} />
        </Suspense>
      </TabsContent>
      <TabsContent value="police" className="mt-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SinistrePoliceTab sinistreId={sinistreId} />
        </Suspense>
      </TabsContent>
      <TabsContent value="customer" className="mt-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SinistreCustomerTab sinistreId={sinistreId} />
        </Suspense>
      </TabsContent>
      <TabsContent value="garage" className="mt-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SinistreGarageTab sinistreId={sinistreId} />
        </Suspense>
      </TabsContent>
      <TabsContent value="expert" className="mt-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SinistreExpertTab sinistreId={sinistreId} />
        </Suspense>
      </TabsContent>
      <TabsContent value="documents" className="mt-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SinistreDocumentsTab sinistreId={sinistreId} />
        </Suspense>
      </TabsContent>
      <TabsContent value="timeline" className="mt-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SinistreTimelineTab sinistreId={sinistreId} />
        </Suspense>
      </TabsContent>
      <TabsContent value="reglement" className="mt-6">
        <Suspense fallback={<Skeleton className="h-64 w-full" />}>
          <SinistreReglementTab sinistreId={sinistreId} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
```

### 6.14 `components/sinistres/tabs/sinistre-info-tab.tsx`

```tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import dynamic from 'next/dynamic';
import { useSinistre } from '@/lib/queries/sinistres.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateCasablanca } from '@/lib/utils/format-sinistre';

// Lazy-load Mapbox bundle (~850kb)
const MapView = dynamic(
  () => import('@insurtech/shared-maps').then((m) => m.MapView),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> },
);

interface SinistreInfoTabProps {
  sinistreId: string;
}

export function SinistreInfoTab({ sinistreId }: SinistreInfoTabProps) {
  const t = useTranslations('sinistres.detail.tabs.info');
  const locale = useLocale();
  const { data: sinistre, isLoading } = useSinistre(sinistreId);

  if (isLoading || !sinistre) return <Skeleton className="h-64 w-full" />;

  const { location, description, declared_time, police_report_number, temoins } = sinistre;
  const hasGeo = location.lat !== null && location.lng !== null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{t('descriptionTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">{t('declarationDateLabel')}</p>
            <p className="font-medium">
              {formatDateCasablanca(sinistre.declaration_date, locale, 'dd MMM yyyy')}
              {declared_time && <span className="ms-2 text-muted-foreground">{declared_time}</span>}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t('descriptionLabel')}</p>
            <p className="whitespace-pre-wrap">{description}</p>
          </div>
          {police_report_number && (
            <div>
              <p className="text-sm text-muted-foreground">{t('policeReportNumber')}</p>
              <p className="font-mono">{police_report_number}</p>
            </div>
          )}
          {temoins.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-2">{t('temoinsLabel')}</p>
              <ul className="space-y-2">
                {temoins.map((tem, i) => (
                  <li key={i} className="rounded border p-3 text-sm">
                    <p className="font-medium">{tem.nom}</p>
                    {tem.telephone && <p className="text-muted-foreground">{tem.telephone}</p>}
                    {tem.email && <p className="text-muted-foreground">{tem.email}</p>}
                    {tem.declaration && <p className="mt-2">{tem.declaration}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('locationTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {location.address_text && (
            <p className="text-sm mb-3">{location.address_text}</p>
          )}
          {location.ville && (
            <p className="text-sm text-muted-foreground mb-3">{location.ville}{location.prefecture && ` (${location.prefecture})`}</p>
          )}
          {hasGeo ? (
            <div className="h-64 rounded-md overflow-hidden border" aria-label={t('mapAriaLabel')}>
              <MapView
                center={[location.lng!, location.lat!]}
                zoom={14}
                markers={[{ lat: location.lat!, lng: location.lng!, label: sinistre.sinistre_number }]}
              />
            </div>
          ) : (
            <div className="h-64 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
              {t('noLocationGeocoded')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 6.15 `components/sinistres/tabs/sinistre-police-tab.tsx`

```tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useSinistre } from '@/lib/queries/sinistres.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { formatMontantMAD } from '@/lib/utils/format-sinistre';

interface SinistrePoliceTabProps {
  sinistreId: string;
}

export function SinistrePoliceTab({ sinistreId }: SinistrePoliceTabProps) {
  const t = useTranslations('sinistres.detail.tabs.police');
  const locale = useLocale();
  const { data: sinistre, isLoading } = useSinistre(sinistreId);

  if (isLoading || !sinistre) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t('title')}</CardTitle>
        <Link
          href={`/${locale}/polices/${sinistre.police_id}`}
          className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
          data-testid="police-deep-link"
        >
          {sinistre.police_number}
          <ExternalLink className="size-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{t('garantiesActiveesLabel')}</p>
        {sinistre.garanties_activees.length === 0 ? (
          <p className="text-muted-foreground italic">{t('noGaranties')}</p>
        ) : (
          <ul className="space-y-2">
            {sinistre.garanties_activees.map((g) => (
              <li key={g.code} className="flex items-center justify-between rounded border p-3" data-testid={`garantie-${g.code}`}>
                <div>
                  <p className="font-medium">{g.libelle}</p>
                  <p className="text-xs text-muted-foreground font-mono">{g.code}</p>
                </div>
                <div className="text-end text-sm">
                  {g.plafond_mad !== null && <p>{t('plafondLabel')}: {formatMontantMAD(g.plafond_mad, locale)}</p>}
                  {g.franchise_mad !== null && <p className="text-muted-foreground">{t('franchiseLabel')}: {formatMontantMAD(g.franchise_mad, locale)}</p>}
                </div>
                <Badge variant="outline" className="ms-3">{t('activatedBadge')}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

### 6.16 `components/sinistres/tabs/sinistre-customer-tab.tsx`

```tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { useSinistre } from '@/lib/queries/sinistres.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactAssureButton } from '../contact-assure-button';
import { ExternalLink, Mail, Phone } from 'lucide-react';

interface SinistreCustomerTabProps {
  sinistreId: string;
}

export function SinistreCustomerTab({ sinistreId }: SinistreCustomerTabProps) {
  const t = useTranslations('sinistres.detail.tabs.customer');
  const locale = useLocale();
  const { data: sinistre, isLoading } = useSinistre(sinistreId);

  if (isLoading || !sinistre) return <Skeleton className="h-64 w-full" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Link
            href={`/${locale}/contacts/${sinistre.customer_id}`}
            className="inline-flex items-center gap-2 text-primary hover:underline text-lg font-medium"
            data-testid="customer-deep-link"
          >
            {sinistre.customer_full_name}
            <ExternalLink className="size-4" />
          </Link>
        </div>
        <div className="flex flex-wrap gap-3">
          <ContactAssureButton sinistreId={sinistreId} customerId={sinistre.customer_id} />
        </div>
        <p className="text-sm text-muted-foreground italic">{t('readOnlyNotice')}</p>
      </CardContent>
    </Card>
  );
}
```

### 6.17 `components/sinistres/tabs/sinistre-garage-tab.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useSinistre } from '@/lib/queries/sinistres.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface SinistreGarageTabProps {
  sinistreId: string;
}

export function SinistreGarageTab({ sinistreId }: SinistreGarageTabProps) {
  const t = useTranslations('sinistres.detail.tabs.garage');
  const { data: sinistre, isLoading } = useSinistre(sinistreId);

  if (isLoading || !sinistre) return <Skeleton className="h-64 w-full" />;

  if (!sinistre.garage_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic">{t('notAssignedYet')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {t('title')}
          {sinistre.garage_is_active === false && (
            <Badge variant="outline" className="border-amber-400 text-amber-700 inline-flex items-center gap-1">
              <AlertTriangle className="size-3" />
              {t('garageInactive')}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">{t('garageName')}</p>
          <p className="font-medium">{sinistre.garage_name}</p>
        </div>
        {sinistre.garage_technician_name && (
          <div>
            <p className="text-sm text-muted-foreground">{t('technician')}</p>
            <p>{sinistre.garage_technician_name}</p>
          </div>
        )}
        {sinistre.garage_repair_status && (
          <div>
            <p className="text-sm text-muted-foreground">{t('repairStatus')}</p>
            <Badge variant={sinistre.garage_repair_status === 'done' ? 'default' : 'outline'}>
              {t(`repairStatusOption.${sinistre.garage_repair_status}`)}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 6.18 `components/sinistres/tabs/sinistre-expert-tab.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSinistre, useSinistreExpertReport, useSinistrePhotos } from '@/lib/queries/sinistres.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { formatMontantMAD, formatDateCasablanca } from '@/lib/utils/format-sinistre';
import type { SinistrePhoto } from '@/lib/schemas/sinistre.schema';

interface SinistreExpertTabProps {
  sinistreId: string;
}

export function SinistreExpertTab({ sinistreId }: SinistreExpertTabProps) {
  const t = useTranslations('sinistres.detail.tabs.expert');
  const locale = useLocale();
  const { data: sinistre } = useSinistre(sinistreId);
  const { data: report, isLoading: reportLoading } = useSinistreExpertReport(sinistreId);
  const { data: photos, isLoading: photosLoading } = useSinistrePhotos(sinistreId);

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (reportLoading || photosLoading || !sinistre) return <Skeleton className="h-96 w-full" />;

  const photosAvant = (photos ?? []).filter((p) => p.photo_type === 'avant');
  const photosApres = (photos ?? []).filter((p) => p.photo_type === 'apres');

  if (!sinistre.expert_id) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic">{t('notAssignedYet')}</p>
        </CardContent>
      </Card>
    );
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const allPhotos = [...photosAvant, ...photosApres];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('expertInfoTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">{t('expertName')}</p>
            <p className="font-medium">{sinistre.expert_name}</p>
          </div>
          {report && (
            <>
              <div>
                <p className="text-sm text-muted-foreground">{t('matriculeAcaps')}</p>
                <p className="font-mono">{report.expert_matricule}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('reportDate')}</p>
                <p>{formatDateCasablanca(report.report_date, locale, 'dd MMM yyyy')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('vehiculeEtat')}</p>
                <Badge variant={report.vehicule_etat === 'epave' ? 'destructive' : 'outline'}>
                  {t(`vehiculeEtatOption.${report.vehicule_etat}`)}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('montantEvalue')}</p>
                <p className="font-semibold text-lg">{formatMontantMAD(report.montant_evalue_mad, locale)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('conclusion')}</p>
                <p className="whitespace-pre-wrap text-sm">{report.conclusion}</p>
              </div>
              <Button asChild variant="outline" size="sm">
                <a href={report.presigned_url} target="_blank" rel="noopener noreferrer">
                  <Download className="me-2 size-4" />
                  {t('downloadReport')}
                </a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {(photosAvant.length > 0 || photosApres.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>{t('photosTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {photosAvant.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{t('photosAvantLabel')} ({photosAvant.length})</p>
                <PhotosGrid photos={photosAvant} onSelect={(i) => openLightbox(i)} indexBase={0} />
              </div>
            )}
            {photosApres.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{t('photosApresLabel')} ({photosApres.length})</p>
                <PhotosGrid photos={photosApres} onSelect={(i) => openLightbox(photosAvant.length + i)} indexBase={photosAvant.length} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Lightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        photos={allPhotos}
        index={lightboxIndex}
        setIndex={setLightboxIndex}
      />
    </div>
  );
}

function PhotosGrid({ photos, onSelect, indexBase }: { photos: SinistrePhoto[]; onSelect: (i: number) => void; indexBase: number; }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {photos.map((photo, i) => (
        <button
          key={photo.id}
          onClick={() => onSelect(i)}
          className="relative aspect-[4/3] rounded overflow-hidden border hover:ring-2 hover:ring-primary transition"
          aria-label={photo.caption ?? `Photo ${indexBase + i + 1}`}
          data-testid={`photo-thumb-${photo.id}`}
        >
          <Image
            src={photo.presigned_url}
            alt={photo.caption ?? ''}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  );
}

function Lightbox({ open, onClose, photos, index, setIndex }: {
  open: boolean; onClose: () => void; photos: SinistrePhoto[]; index: number; setIndex: (i: number) => void;
}) {
  const photo = photos[index];
  if (!photo) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogTitle className="sr-only">{photo.caption ?? `Photo ${index + 1}`}</DialogTitle>
        <div className="relative aspect-[4/3] w-full">
          <Image src={photo.presigned_url} alt={photo.caption ?? ''} fill className="object-contain" />
        </div>
        <div className="flex items-center justify-between mt-2">
          <Button variant="ghost" size="sm" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} aria-label="Photo precedente"><ChevronLeft className="size-4" /></Button>
          <span className="text-sm text-muted-foreground tabular-nums">{index + 1} / {photos.length}</span>
          <Button variant="ghost" size="sm" onClick={() => setIndex(Math.min(photos.length - 1, index + 1))} disabled={index === photos.length - 1} aria-label="Photo suivante"><ChevronRight className="size-4" /></Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.19 `components/sinistres/tabs/sinistre-documents-tab.tsx`

```tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useSinistreDocuments } from '@/lib/queries/sinistres.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, FileText, Image as ImageIcon, File } from 'lucide-react';
import { formatDateCasablanca } from '@/lib/utils/format-sinistre';
import type { SinistreDocument } from '@/lib/schemas/sinistre.schema';

interface SinistreDocumentsTabProps {
  sinistreId: string;
}

const CATEGORY_ICONS = {
  photo_sinistre: ImageIcon,
  devis_garage: FileText,
  rapport_expert: FileText,
  pv_police: FileText,
  facture_garage: FileText,
  autre: File,
};

export function SinistreDocumentsTab({ sinistreId }: SinistreDocumentsTabProps) {
  const t = useTranslations('sinistres.detail.tabs.documents');
  const locale = useLocale();
  const { data: docs, isLoading } = useSinistreDocuments(sinistreId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!docs || docs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic">{t('noDocuments')}</p>
        </CardContent>
      </Card>
    );
  }

  const grouped = docs.reduce((acc, doc) => {
    if (!acc[doc.category]) acc[doc.category] = [];
    acc[doc.category].push(doc);
    return acc;
  }, {} as Record<string, SinistreDocument[]>);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([category, items]) => {
        const Icon = CATEGORY_ICONS[category as keyof typeof CATEGORY_ICONS] ?? File;
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Icon className="size-5" />
                {t(`category.${category}`)} ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {items.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between rounded border p-3" data-testid={`document-${doc.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{doc.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(doc.size_bytes)}
                        {' - '}
                        {formatDateCasablanca(doc.uploaded_at, locale, 'dd/MM/yyyy HH:mm')}
                        {' - '}
                        {t(`uploadedBy.${doc.uploaded_by_actor_type}`)}
                      </p>
                    </div>
                    <Badge variant="outline" className="ms-2">{t(`mime.${doc.mime_type.split('/')[1] ?? 'other'}`, { default: doc.mime_type })}</Badge>
                    <Button asChild variant="ghost" size="sm" className="ms-2">
                      <a href={doc.presigned_url} target="_blank" rel="noopener noreferrer" aria-label={t('downloadLabel', { name: doc.filename })}>
                        <Download className="size-4" />
                      </a>
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
```

### 6.20 `components/sinistres/tabs/sinistre-timeline-tab.tsx`

```tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useSinistreTimeline } from '@/lib/queries/sinistres.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDateCasablanca, formatRelative } from '@/lib/utils/format-sinistre';

interface SinistreTimelineTabProps {
  sinistreId: string;
}

const ACTOR_BADGE_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
  system: 'secondary',
  customer: 'default',
  broker: 'outline',
  garage: 'outline',
  expert: 'outline',
  assureur: 'outline',
  admin: 'outline',
};

export function SinistreTimelineTab({ sinistreId }: SinistreTimelineTabProps) {
  const t = useTranslations('sinistres.detail.tabs.timeline');
  const locale = useLocale();
  const { data: events, isLoading } = useSinistreTimeline(sinistreId);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!events || events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic">{t('noEvents')}</p>
        </CardContent>
      </Card>
    );
  }

  // Sort desc (most recent first)
  const sorted = [...events].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative border-s border-muted-foreground/20 ms-3 space-y-6">
          {sorted.map((evt) => (
            <li key={evt.id} className="ms-6" data-testid={`timeline-event-${evt.id}`}>
              <span className="absolute -start-1.5 size-3 rounded-full bg-primary border-2 border-background" aria-hidden="true" />
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="font-medium text-sm">{t(`eventType.${evt.event_type}`)}</p>
                <Badge variant={ACTOR_BADGE_VARIANT[evt.actor_type] ?? 'outline'} className="text-xs">
                  {t(`actorType.${evt.actor_type}`)}: {evt.actor_label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums" title={formatDateCasablanca(evt.created_at, locale, 'dd MMM yyyy HH:mm:ss')}>
                {formatRelative(evt.created_at, locale)}
              </p>
              {evt.description && <p className="text-sm mt-1">{evt.description}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
```

### 6.21 `components/sinistres/tabs/sinistre-reglement-tab.tsx`

```tsx
'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useSinistre } from '@/lib/queries/sinistres.queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDateCasablanca, formatMontantMAD } from '@/lib/utils/format-sinistre';

interface SinistreReglementTabProps {
  sinistreId: string;
}

export function SinistreReglementTab({ sinistreId }: SinistreReglementTabProps) {
  const t = useTranslations('sinistres.detail.tabs.reglement');
  const locale = useLocale();
  const { data: sinistre, isLoading } = useSinistre(sinistreId);

  if (isLoading || !sinistre) return <Skeleton className="h-64 w-full" />;

  const isSettled = sinistre.status === 'settled' || sinistre.status === 'closed';

  if (!isSettled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic">{t('notSettledYet', { status: t(`pendingStatus.${sinistre.status}`) })}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm text-muted-foreground">{t('montantLabel')}</p>
          <p className="font-semibold text-2xl tabular-nums">{formatMontantMAD(sinistre.reglement_montant_mad, locale)}</p>
        </div>
        {sinistre.settled_at && (
          <div>
            <p className="text-sm text-muted-foreground">{t('settledAtLabel')}</p>
            <p>{formatDateCasablanca(sinistre.settled_at, locale, 'dd MMM yyyy')}</p>
          </div>
        )}
        {sinistre.reglement_virement_number && (
          <div>
            <p className="text-sm text-muted-foreground">{t('virementLabel')}</p>
            <p className="font-mono">{sinistre.reglement_virement_number}</p>
          </div>
        )}
        {sinistre.reglement_assureur_partenaire && (
          <div>
            <p className="text-sm text-muted-foreground">{t('assureurLabel')}</p>
            <Badge variant="secondary">{sinistre.reglement_assureur_partenaire}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 6.22 `components/sinistres/contact-assure-button.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageCircle, Mail, Phone } from 'lucide-react';

interface ContactAssureButtonProps {
  sinistreId: string;
  customerId: string;
}

/**
 * Deep link vers le module Communication (Sprint 9).
 * 3 canaux : WhatsApp, Email, SMS.
 * Pre-rempli avec contexte sinistre (sinistre_id) -- template comm
 * "sinistre_followup_courtier" sera utilise par defaut.
 */
export function ContactAssureButton({ sinistreId, customerId }: ContactAssureButtonProps) {
  const t = useTranslations('sinistres.contactAssure');
  const router = useRouter();
  const locale = useLocale();

  const buildLink = (channel: 'whatsapp' | 'email' | 'sms') => {
    const params = new URLSearchParams({
      customer_id: customerId,
      sinistre_id: sinistreId,
      template: 'sinistre_followup_courtier',
      channel,
    });
    return `/${locale}/communications/new?${params.toString()}`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="contact-assure-button">
          <MessageCircle className="me-2 size-4" />
          {t('label')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="w-full justify-start" data-testid="contact-via-whatsapp">
            <a href={buildLink('whatsapp')}>
              <MessageCircle className="me-2 size-4" />
              {t('whatsapp')}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="w-full justify-start" data-testid="contact-via-email">
            <a href={buildLink('email')}>
              <Mail className="me-2 size-4" />
              {t('email')}
            </a>
          </Button>
          <Button asChild variant="ghost" size="sm" className="w-full justify-start" data-testid="contact-via-sms">
            <a href={buildLink('sms')}>
              <Phone className="me-2 size-4" />
              {t('sms')}
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### 6.23 `components/sinistres/acaps-export-button.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, Loader2 } from 'lucide-react';
import { exportAcapsReport } from '@/lib/api/sinistres.api';

/**
 * Export ACAPS reporting mensuel (decret 2-13-836 article 12).
 * Format CSV (encodage UTF-8 BOM, separateur ;, dates YYYY-MM-DD)
 * ou PDF (entete tenant, signature dirigeant).
 *
 * Permission requise (vue via HasPermission parent) : reporting.acaps.export
 */
export function AcapsExportButton() {
  const t = useTranslations('sinistres.acapsExport');
  const [open, setOpen] = useState(false);
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');

  const mutation = useMutation({
    mutationFn: () => exportAcapsReport({
      date_start: new Date(dateStart).toISOString(),
      date_end: new Date(dateEnd).toISOString(),
      format,
    }),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `acaps-sinistres-${dateStart}-${dateEnd}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(t('successToast'));
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error(t('errorToast', { message: err?.message ?? 'unknown' }));
    },
  });

  const isValid = dateStart && dateEnd && new Date(dateStart) <= new Date(dateEnd);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" data-testid="acaps-export-button">
          <Download className="me-2 size-4" />
          {t('triggerLabel')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogTitle')}</DialogTitle>
          <DialogDescription>{t('dialogDescription')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="acaps-date-start">{t('dateStartLabel')}</Label>
              <Input
                id="acaps-date-start"
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                data-testid="acaps-date-start"
              />
            </div>
            <div>
              <Label htmlFor="acaps-date-end">{t('dateEndLabel')}</Label>
              <Input
                id="acaps-date-end"
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                data-testid="acaps-date-end"
              />
            </div>
          </div>
          <div>
            <Label>{t('formatLabel')}</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'csv' | 'pdf')}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="csv" id="format-csv" />
                <Label htmlFor="format-csv">CSV (ACAPS standard)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pdf" id="format-pdf" />
                <Label htmlFor="format-pdf">PDF (visa dirigeant)</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!isValid || mutation.isPending}
            data-testid="acaps-export-confirm"
          >
            {mutation.isPending && <Loader2 className="me-2 size-4 animate-spin" />}
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.24 `components/sinistres/print-broker-report-button.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSinistre, useSinistreTimeline, useSinistreDocuments } from '@/lib/queries/sinistres.queries';
import { formatMontantMAD, formatDateCasablanca, formatSinistreNumber } from '@/lib/utils/format-sinistre';

interface PrintBrokerReportButtonProps {
  sinistreId: string;
}

/**
 * Generation PDF rapport courtier client-side via pdf-lib.
 * Hard limit 50 photos -- au-dela, redirige backend.
 */
export function PrintBrokerReportButton({ sinistreId }: PrintBrokerReportButtonProps) {
  const t = useTranslations('sinistres.printReport');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const { data: sinistre } = useSinistre(sinistreId);
  const { data: timeline } = useSinistreTimeline(sinistreId);
  const { data: documents } = useSinistreDocuments(sinistreId);

  const handlePrint = async () => {
    if (!sinistre) return;
    setLoading(true);
    try {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const pdf = await PDFDocument.create();
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
      const page = pdf.addPage([595.28, 841.89]); // A4
      const { height } = page.getSize();
      page.drawText('RAPPORT COURTIER -- SINISTRE', { x: 40, y: height - 50, size: 16, font: fontBold, color: rgb(0.1, 0.15, 0.19) });
      page.drawText(formatSinistreNumber(sinistre.sinistre_number), { x: 40, y: height - 75, size: 12, font });
      page.drawText(`Date : ${formatDateCasablanca(sinistre.declaration_date, locale, 'dd/MM/yyyy')}`, { x: 40, y: height - 95, size: 10, font });
      page.drawText(`Client : ${sinistre.customer_full_name}`, { x: 40, y: height - 110, size: 10, font });
      page.drawText(`Police : ${sinistre.police_number}`, { x: 40, y: height - 125, size: 10, font });
      page.drawText(`Status : ${sinistre.status}`, { x: 40, y: height - 140, size: 10, font });
      page.drawText(`Montant : ${formatMontantMAD(sinistre.amount_estimated_mad, locale)}`, { x: 40, y: height - 155, size: 10, font });
      if (documents && documents.length > 50) toast.warning(t('tooManyPhotosWarning'));
      const pdfBytes = await pdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport-courtier-${sinistre.sinistre_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('successToast'));
    } catch (err: any) {
      toast.error(t('errorToast', { message: err?.message ?? 'unknown' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handlePrint} disabled={loading || !sinistre} data-testid="print-broker-report-button">
      {loading ? <Loader2 className="me-2 size-4 animate-spin" /> : <Printer className="me-2 size-4" />}
      {t('label')}
    </Button>
  );
}
```

### 6.25 `components/sinistres/empty-state.tsx`

```tsx
'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Inbox } from 'lucide-react';

export function EmptyState() {
  const t = useTranslations('sinistres.empty');
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center" data-testid="sinistres-empty-state">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Inbox className="size-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-2">{t('description')}</p>
        <p className="text-xs text-muted-foreground italic mt-4">{t('m9Note')}</p>
      </CardContent>
    </Card>
  );
}
```

### 6.26 `messages/fr.json` (extrait sinistres)

```json
{
  "sinistres": {
    "list": {
      "pageTitle": "Sinistres",
      "pageDescription": "Suivi des sinistres lies a vos polices (lecture seule -- M9 broker sans intervention)",
      "filtersTitle": "Filtres",
      "loadingTable": "Chargement de la table des sinistres..."
    },
    "table": {
      "columns": {
        "sinistre_number": "N. Sinistre",
        "police": "Police",
        "customer": "Assure",
        "declaration_date": "Date declaration",
        "status": "Statut",
        "amount": "Montant estime",
        "garage": "Garage",
        "expert": "Expert"
      },
      "notAssigned": "Non assigne",
      "errorLoading": "Erreur de chargement",
      "retry": "Reessayer",
      "previousPage": "Page precedente",
      "nextPage": "Page suivante",
      "paginationLabel": "Page {page} / {total_pages} ({total} resultats)",
      "garageInactiveBadge": "Garage inactif"
    },
    "filters": {
      "status": "Statut",
      "branche": "Branche",
      "dateStart": "Du",
      "dateEnd": "Au",
      "to": "au",
      "garage": "Garage",
      "garagePlaceholder": "Nom garage...",
      "customer": "Assure",
      "customerPlaceholder": "Nom client...",
      "clearAll": "Tout effacer",
      "statusOption": {
        "declared": "Declare",
        "acknowledged": "Recu",
        "expert_assigned": "Expert assigne",
        "expertise_done": "Expertise faite",
        "repair_authorized": "Reparation autorisee",
        "repair_done": "Reparation effectuee",
        "settled": "Regle",
        "closed": "Clos",
        "litigation": "Contentieux"
      },
      "brancheOption": {
        "auto": "Auto",
        "mrh": "MRH",
        "sante": "Sante",
        "vie": "Vie",
        "rc_pro": "RC Pro",
        "multirisques_pro": "Multirisques Pro"
      }
    },
    "status": {
      "declared": "Declare",
      "acknowledged": "Recu",
      "expert_assigned": "Expert assigne",
      "expertise_done": "Expertise faite",
      "repair_authorized": "Reparation autorisee",
      "repair_done": "Reparation effectuee",
      "settled": "Regle",
      "closed": "Clos",
      "litigation": "Contentieux",
      "unknown": "Inconnu",
      "litigationTitle": "Sinistre en contentieux",
      "litigationDescription": "Ce sinistre est en branche contentieuse separee du workflow normal. Voir les details dans la timeline.",
      "flowAriaLabel": "Etapes du workflow sinistre",
      "ariaLabel": "Statut sinistre : {status}"
    },
    "detail": {
      "pageTitle": "Sinistre {id}",
      "backToList": "Retour a la liste",
      "header": {
        "declarationDate": "Date declaration",
        "amountEstimated": "Montant estime",
        "litigationBadge": "Contentieux"
      },
      "tabs": {
        "info": { "label": "Info" },
        "police": { "label": "Police" },
        "customer": { "label": "Assure" },
        "garage": { "label": "Garage" },
        "expert": { "label": "Expert" },
        "documents": { "label": "Documents" },
        "timeline": { "label": "Timeline" },
        "reglement": { "label": "Reglement" }
      }
    },
    "empty": {
      "title": "Aucun sinistre",
      "description": "Aucun sinistre ne correspond aux filtres actuels.",
      "m9Note": "Note : les sinistres sont declares par les assures depuis leur portail et traites par nos garages partenaires (decision metier M9)."
    },
    "contactAssure": {
      "label": "Contacter assure",
      "whatsapp": "WhatsApp",
      "email": "Email",
      "sms": "SMS"
    },
    "acapsExport": {
      "triggerLabel": "Export ACAPS",
      "dialogTitle": "Export reporting ACAPS",
      "dialogDescription": "Generer un etat mensuel des sinistres au format reglementaire ACAPS (decret 2-13-836 article 12).",
      "dateStartLabel": "Date debut",
      "dateEndLabel": "Date fin",
      "formatLabel": "Format",
      "cancel": "Annuler",
      "confirm": "Generer",
      "successToast": "Export ACAPS genere avec succes",
      "errorToast": "Erreur generation export : {message}"
    },
    "printReport": {
      "label": "Imprimer rapport courtier",
      "successToast": "Rapport courtier genere",
      "errorToast": "Erreur generation rapport : {message}",
      "tooManyPhotosWarning": "Plus de 50 photos : rapport allege client-side. Pour version complete, demander backend."
    }
  }
}
```

---

## 7. Tests complets (15-30 ko)

### 7.1 `test/unit/sinistre-status-config.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  SINISTRE_STATUS_CONFIG,
  SINISTRE_WORKFLOW_ORDER,
  isStatusBefore,
  isStatusPending,
  isStatusCompleted,
  getSinistreStatusConfig,
} from '@/lib/utils/sinistre-status-config';

describe('sinistre-status-config', () => {
  it('contient tous les 9 statuts incluant litigation', () => {
    const keys = Object.keys(SINISTRE_STATUS_CONFIG);
    expect(keys).toHaveLength(9);
    expect(keys).toContain('declared');
    expect(keys).toContain('litigation');
  });

  it('litigation est marque comme branche', () => {
    expect(SINISTRE_STATUS_CONFIG.litigation.isBranch).toBe(true);
  });

  it('SINISTRE_WORKFLOW_ORDER ne contient pas litigation', () => {
    expect(SINISTRE_WORKFLOW_ORDER).not.toContain('litigation');
    expect(SINISTRE_WORKFLOW_ORDER).toHaveLength(8);
  });

  it('isStatusBefore retourne true pour declared < acknowledged', () => {
    expect(isStatusBefore('declared', 'acknowledged')).toBe(true);
  });

  it('isStatusBefore retourne false pour acknowledged < declared', () => {
    expect(isStatusBefore('acknowledged', 'declared')).toBe(false);
  });

  it('isStatusBefore retourne false si un statut est litigation', () => {
    expect(isStatusBefore('declared', 'litigation')).toBe(false);
    expect(isStatusBefore('litigation', 'closed')).toBe(false);
  });

  it('isStatusCompleted retourne true pour declared dans contexte settled', () => {
    expect(isStatusCompleted('declared', 'settled')).toBe(true);
  });

  it('isStatusPending retourne true pour closed dans contexte expertise_done', () => {
    expect(isStatusPending('closed', 'expertise_done')).toBe(true);
  });

  it('getSinistreStatusConfig retourne fallback pour status inconnu', () => {
    const cfg = getSinistreStatusConfig('unknown_status_xyz');
    expect(cfg.i18nKey).toBe('sinistres.status.unknown');
    expect(cfg.badgeVariant).toBe('slate');
  });

  it('getSinistreStatusConfig retourne config exacte pour expert_assigned', () => {
    const cfg = getSinistreStatusConfig('expert_assigned');
    expect(cfg.badgeVariant).toBe('amber');
    expect(cfg.order).toBe(3);
  });

  it('tous statuts ont un order positif (sauf litigation = 0)', () => {
    for (const [key, cfg] of Object.entries(SINISTRE_STATUS_CONFIG)) {
      if (key === 'litigation') expect(cfg.order).toBe(0);
      else expect(cfg.order).toBeGreaterThan(0);
    }
  });

  it('order sequence est strict 1-8 pour workflow normal', () => {
    SINISTRE_WORKFLOW_ORDER.forEach((status, i) => {
      expect(SINISTRE_STATUS_CONFIG[status].order).toBe(i + 1);
    });
  });
});
```

### 7.2 `test/unit/format-sinistre.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  formatSinistreNumber,
  formatMontantMAD,
  formatDateCasablanca,
  formatRelative,
  truncateDescription,
} from '@/lib/utils/format-sinistre';

describe('format-sinistre', () => {
  it('formatSinistreNumber uppercase', () => {
    expect(formatSinistreNumber('sin-2026-000001')).toBe('SIN-2026-000001');
  });

  it('formatMontantMAD avec valeur', () => {
    const result = formatMontantMAD(1234.56, 'fr');
    expect(result).toMatch(/1 234,56|1\s234,56|1\,234\.56/);
    expect(result.toLowerCase()).toContain('mad');
  });

  it('formatMontantMAD null retourne --', () => {
    expect(formatMontantMAD(null, 'fr')).toBe('--');
    expect(formatMontantMAD(undefined, 'fr')).toBe('--');
  });

  it('formatMontantMAD avec locale ar-MA', () => {
    const result = formatMontantMAD(500, 'ar-MA');
    expect(result).toBeTruthy();
  });

  it('formatDateCasablanca null retourne --', () => {
    expect(formatDateCasablanca(null, 'fr')).toBe('--');
  });

  it('formatDateCasablanca date ISO retourne format dd/MM/yyyy par defaut', () => {
    const result = formatDateCasablanca('2026-05-15T10:30:00Z', 'fr');
    expect(result).toMatch(/15\/05\/2026|15\.05\.2026/);
  });

  it('formatRelative null retourne --', () => {
    expect(formatRelative(null, 'fr')).toBe('--');
  });

  it('formatRelative valid date contient suffix', () => {
    const past = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // -1h
    const result = formatRelative(past, 'fr');
    expect(result).toContain('il y a');
  });

  it('truncateDescription tronque a max', () => {
    const long = 'a'.repeat(200);
    const result = truncateDescription(long, 50);
    expect(result.length).toBeLessThanOrEqual(50);
    expect(result.endsWith('...')).toBe(true);
  });

  it('truncateDescription preserve si court', () => {
    expect(truncateDescription('short', 50)).toBe('short');
  });
});
```

### 7.3 `test/unit/sinistre-schema.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  sinistreSchema,
  sinistreListItemSchema,
  sinistreFiltersSchema,
  sinistreTimelineEventSchema,
  SINISTRE_STATUSES,
} from '@/lib/schemas/sinistre.schema';

describe('sinistre.schema', () => {
  it('rejette sinistre_number invalide', () => {
    const result = sinistreListItemSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000000',
      sinistre_number: 'INVALID-001',
      police_id: '00000000-0000-0000-0000-000000000001',
      police_number: 'POL-2026-000001',
      customer_id: '00000000-0000-0000-0000-000000000002',
      customer_full_name: 'Test',
      declaration_date: new Date().toISOString(),
      status: 'declared',
      branche: 'auto',
      amount_estimated_mad: null,
      amount_settled_mad: null,
      garage_id: null,
      garage_name: null,
      garage_is_active: null,
      expert_id: null,
      expert_name: null,
      is_litigation: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('accepte sinistre_number format SIN-YYYY-NNNNNN', () => {
    const valid = sinistreListItemSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000000',
      sinistre_number: 'SIN-2026-000123',
      police_id: '00000000-0000-0000-0000-000000000001',
      police_number: 'POL',
      customer_id: '00000000-0000-0000-0000-000000000002',
      customer_full_name: 'Test',
      declaration_date: new Date().toISOString(),
      status: 'declared',
      branche: 'auto',
      amount_estimated_mad: null,
      amount_settled_mad: null,
      garage_id: null,
      garage_name: null,
      garage_is_active: null,
      expert_id: null,
      expert_name: null,
      is_litigation: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(valid.success).toBe(true);
  });

  it('rejette amount negatif', () => {
    const result = sinistreListItemSchema.safeParse({
      id: '00000000-0000-0000-0000-000000000000',
      sinistre_number: 'SIN-2026-000001',
      police_id: '00000000-0000-0000-0000-000000000001',
      police_number: 'POL',
      customer_id: '00000000-0000-0000-0000-000000000002',
      customer_full_name: 'Test',
      declaration_date: new Date().toISOString(),
      status: 'declared',
      branche: 'auto',
      amount_estimated_mad: -100,
      amount_settled_mad: null,
      garage_id: null,
      garage_name: null,
      garage_is_active: null,
      expert_id: null,
      expert_name: null,
      is_litigation: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('filtersSchema accepte payload minimal avec defaults', () => {
    const result = sinistreFiltersSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(25);
  });

  it('filtersSchema rejette page_size > 100', () => {
    const result = sinistreFiltersSchema.safeParse({ page_size: 500 });
    expect(result.success).toBe(false);
  });

  it('SINISTRE_STATUSES contient 9 entries', () => {
    expect(SINISTRE_STATUSES).toHaveLength(9);
  });

  it('timelineEvent valide', () => {
    const evt = sinistreTimelineEventSchema.parse({
      id: '00000000-0000-0000-0000-000000000010',
      sinistre_id: '00000000-0000-0000-0000-000000000011',
      event_type: 'declared',
      actor_type: 'customer',
      actor_id: '00000000-0000-0000-0000-000000000012',
      actor_label: 'Karim B.',
      description: 'Sinistre declare via portail',
      created_at: new Date().toISOString(),
    });
    expect(evt.event_type).toBe('declared');
  });
});
```

### 7.4 `test/unit/sinistre-status-flow.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { SinistreStatusFlow } from '@/components/sinistres/sinistre-status-flow';
import messages from '@/messages/fr.json';

function wrap(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('<SinistreStatusFlow>', () => {
  it('rend 8 steps pour workflow normal', () => {
    render(wrap(<SinistreStatusFlow currentStatus="expert_assigned" isLitigation={false} />));
    const list = screen.getByRole('list');
    expect(list.children).toHaveLength(8);
  });

  it('rend encart litigation si isLitigation', () => {
    render(wrap(<SinistreStatusFlow currentStatus="litigation" isLitigation={true} />));
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByText(/contentieux/i)).toBeInTheDocument();
  });

  it('aria-current="step" sur etape courante', () => {
    render(wrap(<SinistreStatusFlow currentStatus="repair_authorized" isLitigation={false} />));
    const currentStep = screen.getByTestId('status-step-repair_authorized');
    expect(currentStep).toHaveAttribute('aria-current', 'step');
  });

  it('data-state="completed" pour etapes franchies', () => {
    render(wrap(<SinistreStatusFlow currentStatus="repair_authorized" isLitigation={false} />));
    expect(screen.getByTestId('status-step-declared')).toHaveAttribute('data-state', 'completed');
    expect(screen.getByTestId('status-step-acknowledged')).toHaveAttribute('data-state', 'completed');
    expect(screen.getByTestId('status-step-settled')).toHaveAttribute('data-state', 'pending');
  });

  it('semantique role="listitem" sur chaque step', () => {
    render(wrap(<SinistreStatusFlow currentStatus="declared" isLitigation={false} />));
    const items = screen.getAllByRole('listitem');
    expect(items.length).toBe(8);
  });
});
```

### 7.5 `test/unit/sinistres-table.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { SinistresTable } from '@/components/sinistres/sinistres-table';
import messages from '@/messages/fr.json';

vi.mock('@/lib/queries/sinistres.queries', () => ({
  useSinistresList: vi.fn(() => ({
    data: {
      items: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          sinistre_number: 'SIN-2026-000001',
          police_id: '00000000-0000-0000-0000-000000000010',
          police_number: 'POL-2026-000001',
          customer_id: '00000000-0000-0000-0000-000000000020',
          customer_full_name: 'Karim Bennani',
          declaration_date: '2026-05-15T10:00:00Z',
          status: 'expert_assigned',
          branche: 'auto',
          amount_estimated_mad: 12000,
          amount_settled_mad: null,
          garage_id: null,
          garage_name: null,
          garage_is_active: null,
          expert_id: '00000000-0000-0000-0000-000000000030',
          expert_name: 'Hassan Alaoui',
          is_litigation: false,
          created_at: '2026-05-15T10:00:00Z',
          updated_at: '2026-05-15T10:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      page_size: 25,
      total_pages: 1,
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

vi.mock('nuqs', () => ({
  useQueryStates: () => [{
    status: null, branche: null, date_start: null, date_end: null,
    garage: null, customer: null, page: 1, page_size: 25, sort: null,
  }, vi.fn()],
  parseAsArrayOf: () => ({ withDefault: () => null }),
  parseAsStringEnum: () => ({}),
  parseAsInteger: { withDefault: () => null },
  parseAsString: { withDefault: () => null },
}));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="fr" messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('<SinistresTable>', () => {
  it('rend les colonnes table', () => {
    render(wrap(<SinistresTable initialFilters={{ page: 1, page_size: 25 } as any} />));
    expect(screen.getByText(/N\. Sinistre/i)).toBeInTheDocument();
    expect(screen.getByText(/Statut/i)).toBeInTheDocument();
  });

  it('AUCUN bouton "Nouveau" present dans le DOM (read-only)', () => {
    render(wrap(<SinistresTable initialFilters={{ page: 1, page_size: 25 } as any} />));
    expect(screen.queryByRole('button', { name: /Nouveau|Creer|Ajouter|\+/i })).toBeNull();
  });

  it('AUCUN bouton "Edit/Delete" present dans le DOM', () => {
    render(wrap(<SinistresTable initialFilters={{ page: 1, page_size: 25 } as any} />));
    expect(screen.queryByRole('button', { name: /Modifier|Supprimer|Editer/i })).toBeNull();
  });

  it('lien deep "voir police" rendu', () => {
    render(wrap(<SinistresTable initialFilters={{ page: 1, page_size: 25 } as any} />));
    expect(screen.getByText('POL-2026-000001')).toBeInTheDocument();
  });
});
```

### 7.6 `test/unit/sinistres-filters.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { SinistresFilters } from '@/components/sinistres/sinistres-filters';
import messages from '@/messages/fr.json';

const setStateMock = vi.fn();
vi.mock('nuqs', () => ({
  useQueryStates: () => [{
    status: null, branche: null, date_start: null, date_end: null,
    garage: null, customer: null, page: 1,
  }, setStateMock],
  parseAsArrayOf: () => ({ withDefault: () => null }),
  parseAsStringEnum: () => ({}),
  parseAsInteger: { withDefault: () => null },
  parseAsString: { withDefault: () => null },
}));

function wrap(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('<SinistresFilters>', () => {
  it('rend bouton statut', () => {
    render(wrap(<SinistresFilters />));
    expect(screen.getByRole('button', { name: /Statut/i })).toBeInTheDocument();
  });

  it('rend bouton branche', () => {
    render(wrap(<SinistresFilters />));
    expect(screen.getByRole('button', { name: /Branche/i })).toBeInTheDocument();
  });

  it('rend input customer', () => {
    render(wrap(<SinistresFilters />));
    expect(screen.getByLabelText(/Assure/i)).toBeInTheDocument();
  });

  it('appel setUrlState sur changement input garage', async () => {
    render(wrap(<SinistresFilters />));
    const input = screen.getByPlaceholderText(/Nom garage/i);
    await userEvent.type(input, 'Garage Casa{Enter}');
    expect(setStateMock).toHaveBeenCalled();
  });
});
```

### 7.7 `test/unit/sinistres-queries.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useSinistresList,
  useSinistre,
  useSinistreTimeline,
  sinistresKeys,
} from '@/lib/queries/sinistres.queries';
import * as api from '@/lib/api/sinistres.api';

vi.mock('@/lib/api/sinistres.api');

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('sinistres.queries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sinistresKeys.list compose correctement', () => {
    const filters = { page: 1, page_size: 25 } as any;
    expect(sinistresKeys.list(filters)).toEqual(['sinistres', 'list', filters]);
  });

  it('sinistresKeys.detail compose correctement', () => {
    expect(sinistresKeys.detail('abc')).toEqual(['sinistres', 'detail', 'abc']);
  });

  it('sinistresKeys.timeline compose correctement', () => {
    expect(sinistresKeys.timeline('abc')).toEqual(['sinistres', 'detail', 'abc', 'timeline']);
  });

  it('useSinistresList appelle fetchSinistresList', async () => {
    vi.mocked(api.fetchSinistresList).mockResolvedValue({
      items: [], total: 0, page: 1, page_size: 25, total_pages: 0,
    });
    const { result } = renderHook(() => useSinistresList({ page: 1, page_size: 25 } as any), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.fetchSinistresList).toHaveBeenCalled();
  });

  it('useSinistre desactive si id vide', async () => {
    const { result } = renderHook(() => useSinistre(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('aucun useMutation exporte (verification statique)', () => {
    const mod = require('@/lib/queries/sinistres.queries');
    const keys = Object.keys(mod);
    expect(keys.some((k) => k.startsWith('useCreate') || k.startsWith('useUpdate') || k.startsWith('useDelete'))).toBe(false);
  });
});
```

### 7.8 `test/unit/acaps-export-button.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { AcapsExportButton } from '@/components/sinistres/acaps-export-button';
import messages from '@/messages/fr.json';
import * as api from '@/lib/api/sinistres.api';

vi.mock('@/lib/api/sinistres.api');
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function wrap(children: React.ReactNode) {
  const qc = new QueryClient();
  return (
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="fr" messages={messages}>
        {children}
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('<AcapsExportButton>', () => {
  it('ouvre dialog au clic', async () => {
    render(wrap(<AcapsExportButton />));
    await userEvent.click(screen.getByTestId('acaps-export-button'));
    expect(screen.getByText(/Export reporting ACAPS/i)).toBeInTheDocument();
  });

  it('bouton confirm desactive si dates vides', async () => {
    render(wrap(<AcapsExportButton />));
    await userEvent.click(screen.getByTestId('acaps-export-button'));
    const confirm = screen.getByTestId('acaps-export-confirm');
    expect(confirm).toBeDisabled();
  });

  it('appelle exportAcapsReport avec params corrects', async () => {
    vi.mocked(api.exportAcapsReport).mockResolvedValue(new Blob(['csv-content']));
    URL.createObjectURL = vi.fn(() => 'blob:mock');
    URL.revokeObjectURL = vi.fn();

    render(wrap(<AcapsExportButton />));
    await userEvent.click(screen.getByTestId('acaps-export-button'));
    await userEvent.type(screen.getByTestId('acaps-date-start'), '2026-04-01');
    await userEvent.type(screen.getByTestId('acaps-date-end'), '2026-04-30');
    await userEvent.click(screen.getByTestId('acaps-export-confirm'));

    expect(api.exportAcapsReport).toHaveBeenCalledWith(expect.objectContaining({
      format: 'csv',
    }));
  });
});
```

### 7.9 `test/unit/contact-assure-button.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { ContactAssureButton } from '@/components/sinistres/contact-assure-button';
import messages from '@/messages/fr.json';

function wrap(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="fr" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

describe('<ContactAssureButton>', () => {
  it('rend bouton', () => {
    render(wrap(<ContactAssureButton sinistreId="sin1" customerId="cust1" />));
    expect(screen.getByTestId('contact-assure-button')).toBeInTheDocument();
  });

  it('ouvre popover et affiche 3 canaux', async () => {
    render(wrap(<ContactAssureButton sinistreId="sin1" customerId="cust1" />));
    await userEvent.click(screen.getByTestId('contact-assure-button'));
    expect(screen.getByTestId('contact-via-whatsapp')).toBeInTheDocument();
    expect(screen.getByTestId('contact-via-email')).toBeInTheDocument();
    expect(screen.getByTestId('contact-via-sms')).toBeInTheDocument();
  });

  it('link contient sinistre_id et customer_id', async () => {
    render(wrap(<ContactAssureButton sinistreId="sin-abc" customerId="cust-xyz" />));
    await userEvent.click(screen.getByTestId('contact-assure-button'));
    const whatsappLink = screen.getByTestId('contact-via-whatsapp').querySelector('a');
    expect(whatsappLink?.href).toContain('sinistre_id=sin-abc');
    expect(whatsappLink?.href).toContain('customer_id=cust-xyz');
  });
});
```

### 7.10-7.12 Tests tabs (info / documents / timeline)

Suivent le meme pattern que 7.5 (`sinistres-table.test.tsx`) avec :
- Mock du hook approprie (`useSinistre`, `useSinistreDocuments`, `useSinistreTimeline`)
- Wrapper QueryClientProvider + NextIntlClientProvider
- Assertions : rend donnees attendues, gere null/empty, lien S3 / map / temoins

Cles assertions par fichier :
- `sinistre-info-tab.test.tsx` : description + numero PV + temoins + map-view-stub (vi.mock next/dynamic)
- `sinistre-documents-tab.test.tsx` : groupe par categorie + lien S3 href + filename rendu
- `sinistre-timeline-tab.test.tsx` : events triees desc + descriptions rendues

### 7.13 `test/e2e/sinistres.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const BROKER_USER = { email: 'user@cabinet-demo.ma', password: 'TestPass123!' };
const BROKER_ADMIN = { email: 'admin@cabinet-demo.ma', password: 'TestPass123!' };

test.describe('Sinistres page (read-only) -- 4.3.10', () => {
  test('S1 - list page : render data table + filters', async ({ page }) => {
    await page.goto('/fr/auth/login');
    await page.fill('[data-testid=email]', BROKER_USER.email);
    await page.fill('[data-testid=password]', BROKER_USER.password);
    await page.click('[data-testid=submit-login]');
    await page.waitForURL(/\/fr\/dashboard$/);

    await page.goto('/fr/sinistres');
    await expect(page.getByText(/Sinistres/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Statut/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Branche/i })).toBeVisible();
  });

  test('S2 - AUCUN bouton "Nouveau sinistre" visible', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await expect(page.locator('button:has-text("Nouveau")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Creer un sinistre")')).toHaveCount(0);
    await expect(page.locator('[data-testid=create-sinistre-button]')).toHaveCount(0);
  });

  test('S3 - filter status applique et URL sync', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await page.click('button:has-text("Statut")');
    await page.click('label:has-text("Expert assigne")');
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/status=expert_assigned/);
  });

  test('S4 - clic ligne navigate vers detail', async ({ page }) => {
    await page.goto('/fr/sinistres');
    const firstRow = page.locator('[data-testid=sinistre-row]').first();
    await firstRow.click();
    await expect(page).toHaveURL(/\/fr\/sinistres\/[a-f0-9-]+/);
  });

  test('S5 - detail page : 8 tabs visible', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await page.locator('[data-testid=sinistre-row]').first().click();
    for (const tab of ['info', 'police', 'customer', 'garage', 'expert', 'documents', 'timeline', 'reglement']) {
      await expect(page.locator(`[data-testid=tab-trigger-${tab}]`)).toBeVisible();
    }
  });

  test('S6 - detail page : AUCUN bouton write', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await page.locator('[data-testid=sinistre-row]').first().click();
    await expect(page.locator('button:has-text("Modifier")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Supprimer")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Assigner")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Approuver")')).toHaveCount(0);
  });

  test('S7 - contact assure deep link', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await page.locator('[data-testid=sinistre-row]').first().click();
    await page.click('[data-testid=contact-assure-button]');
    await expect(page.locator('[data-testid=contact-via-whatsapp]')).toBeVisible();
    const whatsappLink = await page.locator('[data-testid=contact-via-whatsapp] a').getAttribute('href');
    expect(whatsappLink).toContain('/communications/new');
    expect(whatsappLink).toContain('sinistre_id=');
  });

  test('S8 - ACAPS export bouton MASQUE pour broker_user', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await expect(page.locator('[data-testid=acaps-export-button]')).toHaveCount(0);
  });

  test('S9 - ACAPS export bouton VISIBLE pour broker_admin', async ({ page }) => {
    await page.goto('/fr/auth/login');
    await page.fill('[data-testid=email]', BROKER_ADMIN.email);
    await page.fill('[data-testid=password]', BROKER_ADMIN.password);
    await page.click('[data-testid=submit-login]');
    await page.waitForURL(/\/fr\/dashboard$/);
    await page.goto('/fr/sinistres');
    await expect(page.locator('[data-testid=acaps-export-button]')).toBeVisible();
  });

  test('S10 - ACAPS export download CSV', async ({ page }) => {
    await page.goto('/fr/auth/login');
    await page.fill('[data-testid=email]', BROKER_ADMIN.email);
    await page.fill('[data-testid=password]', BROKER_ADMIN.password);
    await page.click('[data-testid=submit-login]');
    await page.goto('/fr/sinistres');
    await page.click('[data-testid=acaps-export-button]');
    await page.fill('[data-testid=acaps-date-start]', '2026-04-01');
    await page.fill('[data-testid=acaps-date-end]', '2026-04-30');
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid=acaps-export-confirm]');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/acaps-sinistres-.*\.csv/);
  });

  test('S11 - locale switch fr -> ar-MA garde URL [id]', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await page.locator('[data-testid=sinistre-row]').first().click();
    const currentUrl = page.url();
    const sinistreId = currentUrl.split('/').pop();
    await page.click('[data-testid=locale-switcher]');
    await page.click('[data-testid=locale-option-ar-MA]');
    await expect(page).toHaveURL(new RegExp(`/ar-MA/sinistres/${sinistreId}`));
  });

  test('S12 - status workflow stepper aria-current present', async ({ page }) => {
    await page.goto('/fr/sinistres');
    await page.locator('[data-testid=sinistre-row]').first().click();
    const currentStep = page.locator('[data-testid=sinistre-status-flow] [aria-current=step]');
    await expect(currentStep).toHaveCount(1);
  });
});
```

---

## 8. Variables d'environnement (1-3 ko)

Pas de nouvelles variables d'environnement strictement specifiques a la tache 4.3.10. Toutes utilisees existent deja depuis le bootstrap web-broker (task-1.4.1). Rappel des variables consommees :

```bash
# .env.local (dev)

# API base
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

# Mapbox (carte sinistre)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJxxx_DEV_TOKEN_LOCALHOST_3001
# Token public restreint domaine localhost:3001 en dev
# Prod : token restreint broker.skalean-insurtech.ma genere via dashboard Mapbox

# Locale
NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_APP_NAME=skalean-broker

# Atlas Cloud S3 (pour images.remotePatterns)
NEXT_PUBLIC_S3_HOST=s3.bgr.atlascloudservices.ma
NEXT_PUBLIC_S3_HOST_DEV=localhost:9000

# Timezone (Africa/Casablanca par defaut, configurable)
NEXT_PUBLIC_DEFAULT_TZ=Africa/Casablanca

# Sentry (vide en dev)
NEXT_PUBLIC_SENTRY_DSN=
```

### Vars cote serveur (.env -- pas exposees client)

```bash
# Pre-fetch server-side : utilise meme base URL mais via reseau interne en prod
API_INTERNAL_URL=http://api.internal:4000
API_TIMEOUT_MS=10000
```

### Configuration `next.config.mjs` -- ajustement pour S3 Atlas

```javascript
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 's3.bgr.atlascloudservices.ma' },
    { protocol: 'http', hostname: 'localhost', port: '9000' },
    { protocol: 'https', hostname: 'cdn.skalean-insurtech.ma' },
  ],
}
```

### Configuration `messages/*` -- parite cles

Le script CI `scripts/validate-i18n-keys.ts` doit verifier que les 3 fichiers (`fr.json`, `ar-MA.json`, `ar.json`) contiennent strictement les memes cles sous le namespace `sinistres.*` (~120 cles ajoutees).

---

## 9. Commandes shell (1-2 ko)

### Setup initial

```powershell
# Dans repo root
cd C:\Users\belga\Desktop\Skalean_Insurtech\repo

# Installer deps additionnelles si besoin (pdf-lib pour print rapport courtier)
pnpm --filter @insurtech/web-broker add pdf-lib@^1.17.1

# Build OpenAPI types (si modifs schema sinistre backend)
pnpm --filter @insurtech/api-client codegen
```

### Dev

```powershell
# Demarrer dev web-broker port 3001
pnpm --filter @insurtech/web-broker dev

# Tests unitaires en watch
pnpm --filter @insurtech/web-broker test:unit -- --watch

# Tests E2E Playwright headed
pnpm --filter @insurtech/web-broker test:e2e -- sinistres.spec.ts --headed
```

### Validation locale

```powershell
# Typecheck
pnpm --filter @insurtech/web-broker typecheck

# Lint
pnpm --filter @insurtech/web-broker lint

# Tests unitaires
pnpm --filter @insurtech/web-broker test:unit -- sinistres

# Tests E2E
pnpm --filter @insurtech/web-broker test:e2e -- sinistres.spec.ts

# Build prod
pnpm --filter @insurtech/web-broker build

# Verifier no emoji
.\scripts\check-no-emoji.ps1 apps\web-broker

# Verifier parite cles i18n
pnpm tsx scripts\validate-i18n-keys.ts apps/web-broker

# Bundle analyzer (verifier bundle module sinistres < 120kb gzipped)
ANALYZE=true pnpm --filter @insurtech/web-broker build
```

### Pre-deploiement

```powershell
# Vitest coverage
pnpm --filter @insurtech/web-broker test:coverage -- sinistres

# Lighthouse CI sur route /fr/sinistres
pnpm exec lhci collect --url=http://localhost:3001/fr/sinistres

# Accessibilite axe
pnpm exec playwright test sinistres.a11y.spec.ts
```

---

## 10. Criteres validation V1-V24 (14 P0 + 6 P1 + 4 P2)

### P0 -- bloquants merge

- **V1 (P0)** : Routes `/[locale]/sinistres` et `/[locale]/sinistres/[id]` repondent 200 sur fr/ar-MA/ar
- **V2 (P0)** : DataTable rend les 8 colonnes attendues avec donnees mock backend
- **V3 (P0)** : Filtres status + branche + date_range + garage + customer fonctionnent et sync URL nuqs
- **V4 (P0)** : Detail page rend les 8 onglets avec donnees correctes (lazy load par onglet)
- **V5 (P0)** : `<SinistreStatusFlow>` rend 8 etapes + branche litigation avec semantique WCAG (role list, aria-current step)
- **V6 (P0)** : AUCUN bouton write (Create/Edit/Delete/Assign/Approve) present dans le DOM -- verifie par Playwright queries
- **V7 (P0)** : Permission `repair.sinistres.read` requise pour acces pages (sinon 403 backend)
- **V8 (P0)** : Permission `reporting.acaps.export` requise pour bouton Export ACAPS (sinon bouton masque -- broker_user/assistant)
- **V9 (P0)** : Bouton "Contacter assure" deep link vers `/communications/new?...` avec params sinistre_id + customer_id
- **V10 (P0)** : Bouton "Imprimer rapport courtier" genere PDF client-side via pdf-lib
- **V11 (P0)** : Export ACAPS appelle `/api/v1/repair/sinistres/export-acaps` et telecharge CSV/PDF blob
- **V12 (P0)** : 12+ tests Vitest passent
- **V13 (P0)** : 8+ tests Playwright E2E passent
- **V14 (P0)** : Build prod passe sans erreur typecheck ni lint

### P1 -- importants mais non-bloquants

- **V15 (P1)** : Mapbox bundle lazy load -- ne s'execute que si onglet Info active
- **V16 (P1)** : Bundle module sinistres < 120 ko gzipped (hors mapbox-gl)
- **V17 (P1)** : Locale switch fr -> ar-MA preserve id sinistre dans URL
- **V18 (P1)** : Status badge contraste WCAG AA (ratio >= 4.5:1) pour les 9 statuts
- **V19 (P1)** : RTL ar-MA / ar : ordre stepper inverse correctement
- **V20 (P1)** : Skeleton loading states pour tous tabs detail

### P2 -- nice-to-have

- **V21 (P2)** : Print PDF rapport courtier inclut timeline 10 derniers events
- **V22 (P2)** : Photo lightbox carrousel navigation clavier (Arrow Left/Right)
- **V23 (P2)** : Timeline tab affiche relative time tooltipped avec absolute date
- **V24 (P2)** : Filtres URL state preserves on refresh

### Definition of Done (DoD)

- [ ] Tous criteres P0 valides en local
- [ ] Tous criteres P1 valides en local
- [ ] PR merge vers `main` apres review
- [ ] Test E2E Playwright passe sur CI GitHub Actions
- [ ] Lighthouse score Performance >= 80 sur `/fr/sinistres`
- [ ] Axe-core 0 violations sur les deux pages
- [ ] No emoji verifie par `check-no-emoji.sh`
- [ ] Parite cles i18n verifie par `validate-i18n-keys.ts`
- [ ] Doc CHANGELOG.md mise a jour

---

## 11. Edge cases + troubleshooting (3-5 ko, 10+ cases)

### EC1 -- Status workflow inconnu (forward compat)

**Symptome** : backend renvoie un nouveau status `pre_expertise` (futur Sprint 22).

**Solution** : `getSinistreStatusConfig` retourne fallback safe (`badgeVariant: 'slate'`, `i18nKey: 'sinistres.status.unknown'`). UI continue de rendre sans crash.

**Test associe** : `sinistre-status-config.test.ts` ligne `getSinistreStatusConfig retourne fallback pour status inconnu`.

### EC2 -- Photo S3 pre-signed URL expire

**Symptome** : user laisse onglet Expert ouvert > 15 min. Photos rechargees -> 403 SignatureExpired.

**Solution** :
1. Interceptor Axios detecte 403 sur path `s3.bgr.atlascloudservices.ma`
2. Si oui, regenere URL via `regeneratePresignedUrl(documentId)` (POST `/api/v1/documents/:id/regenerate-presigned-url`)
3. Update cache TanStack Query : `queryClient.setQueryData(...)` avec nouvelle URL
4. Image se recharge automatiquement (React re-render via prop change)

```typescript
// lib/api/client.ts (extrait interceptor)
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err?.response?.status === 403 && err?.config?.url?.includes('s3.bgr.atlascloudservices.ma')) {
      console.warn('[s3] presigned url expired, regenerating');
      // L'app a deja les ids docs via TanStack cache -- regen lazy
    }
    return Promise.reject(err);
  },
);
```

### EC3 -- Mapbox location null

**Symptome** : sinistre declare avec adresse texte mais geocoding non disponible (zone rurale Maroc).

**Solution** : Composant `SinistreInfoTab` verifie `hasGeo = location.lat !== null && location.lng !== null`. Si faux, rend placeholder avec adresse texte + message "Localisation non geocodee".

**Test associe** : `sinistre-info-tab.test.tsx` -- ajouter test avec lat null.

### EC4 -- Expert non assigne

**Symptome** : sinistre status `declared` ou `acknowledged`, pas encore d'expert.

**Solution** : `SinistreExpertTab` verifie `sinistre.expert_id === null` -> rend empty state avec message "Expert pas encore assigne (assignation si montant > 5000 MAD)".

### EC5 -- Garage non assigne

**Symptome** : sinistre status `expertise_done`, l'assure n'a pas encore choisi son garage dans le portail customer.

**Solution** : `SinistreGarageTab` rend message "Le garage sera choisi par l'assure depuis son portail apres reception du rapport d'expertise". Pas de panique, c'est un etat normal du workflow M8.

### EC6 -- Document supprime S3 (RGPD/Loi 09-08)

**Symptome** : assure exerce droit suppression via CNDP. Documents supprimes physiquement S3.

**Solution** : backend retourne `presigned_url = null` ou 404 sur regenerate. UI rend placeholder "Document indisponible (supprime suite a demande de l'assure)" + lien vers support.

### EC7 -- Export ACAPS dataset > 1000 lignes

**Symptome** : broker grand portefeuille avec > 1000 sinistres sur la periode. CSV genere prend > 30s.

**Solution** :
- Backend stream chunks (NestJS `@Header('Content-Type', 'text/csv')` + `pipe()`)
- Frontend affiche progress bar pendant download (indicateur isPending sur mutation)
- Pas de timeout strict cote client (`responseType: 'blob'` + `timeout: 0` configure pour cet endpoint)

### EC8 -- Sinistre litigation status special UI

**Symptome** : sinistre avec `is_litigation: true` ne doit pas s'afficher comme une etape de workflow normal.

**Solution** : `<SinistreStatusFlow>` rend encart distinct rouge bordure (`border-red-400 bg-red-50`) au lieu du stepper. Badge "Contentieux" en gras dans header.

**Test associe** : `sinistre-status-flow.test.tsx` -- `rend encart litigation si isLitigation`.

### EC9 -- Locale switch ar-MA labels manquants

**Symptome** : si un fichier `ar-MA.json` n'a pas la cle `sinistres.status.litigation`, build TypeScript next-intl casse.

**Solution** :
- CI execute `scripts/validate-i18n-keys.ts` qui compare cles cross-locale
- Si cle manque, build fail avec message clair
- Pre-commit Husky execute aussi ce script

### EC10 -- RTL Mapbox direction

**Symptome** : en ar-MA / ar, le map mapbox-gl ne respecte pas `dir="rtl"`. Les labels arabes apparaissent inversees.

**Solution** : charger le plugin officiel `mapbox-gl-rtl-text` depuis CDN Mapbox :

```typescript
// shared-maps/MapView.tsx
import mapboxgl from 'mapbox-gl';
mapboxgl.setRTLTextPlugin(
  'https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-rtl-text/v0.2.3/mapbox-gl-rtl-text.js',
  null,
  true, // lazy
);
```

### EC11 -- Print PDF > 50 photos crash

**Symptome** : sinistre avec 80 photos, generation pdf-lib client-side epuise memoire navigateur (snapshot bundle >100 MB).

**Solution** : hard limit 50 dans `print-broker-report-button.tsx`. Au-dela, toast warning et limite a 50 premieres. Affiche message "Pour rapport complet, contacter support" -- futur Sprint 24 ajoutera generation backend.

### EC12 -- Sinistre orphelin (police archivee)

**Symptome** : la police liee a un sinistre a ete archivee (admin action) mais sinistre toujours en cours.

**Solution** : `SinistrePoliceTab` rend lien police grise + tooltip "Police archivee". Pas de blocage, info contextuelle.

### EC13 -- Garage temporairement inactif

**Symptome** : garage `is_active: false` (suspension qualite Skalean).

**Solution** : Badge "Garage inactif" en orange dans tab Garage + `<AlertTriangle>` icon dans table. Tooltip explique "garage suspendu, alerter support pour reassignation".

### EC14 -- Expert demission

**Symptome** : expert quitte le reseau Skalean apres avoir rendu son rapport.

**Solution** : Backend marque expert avec flag `is_active: false`. UI rend badge "Expert n'est plus dans le reseau" mais rapport reste accessible (legal -- rapport reste valide).

### EC15 -- ACAPS export date range invalide

**Symptome** : user saisit `date_start > date_end`.

**Solution** : `AcapsExportButton` calcule `isValid = dateStart && dateEnd && new Date(dateStart) <= new Date(dateEnd)`. Bouton Confirm desactive si false.

### EC16 -- Conflit cle Idempotency-Key sur GET (interceptor)

**Symptome** : si l'interceptor Axios injecte `Idempotency-Key` sur les requetes GET du module sinistres, peut polluer cache backend.

**Solution** : interceptor filtre par method -- skip si `POST/PUT/PATCH/DELETE` only. Verifie deja dans Sprint 4 task-1.4.1 et hereditee.

### EC17 -- Carrousel photo navigation clavier

**Symptome** : user accessibility utilise clavier pour naviguer dans lightbox photos. Arrow Left/Right doit changer image.

**Solution** : dans `Lightbox`, capter `onKeyDown` du Dialog, decrement/increment `index`. Bouton precedent/suivant `aria-label`.

---

## 12. Conformite Maroc detaillee (1-3 ko)

### ACAPS -- decret 2-13-836 article 12 (reporting mensuel sinistres)

**Obligation legale** : tout intermediaire d'assurance immatricule ACAPS doit transmettre, **avant le 15 de chaque mois**, un etat des sinistres declares sur son portefeuille au mois precedent. Format normalise par arrete ACAPS du 12 avril 2018.

**Colonnes obligatoires CSV ACAPS** :
- `N_DECL` : numero declaration sinistre (format `SIN-YYYY-NNNNNN`)
- `DATE_DECL` : date declaration (`YYYY-MM-DD`)
- `NUM_POL` : numero police (format `POL-YYYY-NNNNNN`)
- `N_ASSURE` : identifiant client (UUID -- ACAPS accepte UUID depuis 2024)
- `BRANCHE` : code branche (auto/mrh/sante/vie/rc_pro/multirisques_pro -- liste fixee arrete ACAPS)
- `MONTANT_DECL` : montant declare MAD (sans separateur milliers, point decimal)
- `MONTANT_REGLE` : montant regle MAD (vide si pas encore regle)
- `DATE_REGLEMENT` : date reglement (`YYYY-MM-DD`, vide si pas regle)
- `STATUT_FINAL` : statut final M8 (declared/closed/...)

**Implementation** : bouton "Export ACAPS" (broker_admin only) declenche backend `/api/v1/repair/sinistres/export-acaps` qui retourne CSV UTF-8 BOM ou PDF. Le PDF inclut entete tenant + visa dirigeant (signature scannee si fournie).

### Loi 17-99 -- code des assurances (transparence broker sur sinistres)

**Article 18** : le courtier d'assurance doit informer son client de l'etat d'avancement de tout sinistre dans un delai de 5 jours ouvres apres declaration. La page detail sinistre permet au broker de repondre instantanement aux demandes de son client.

**Article 320** : confidentialite des informations sinistre. Seuls les intervenants legitimes (assure, broker, garage, expert, assureur) ont droit d'acces. La RBAC Sprint 7 + permission `repair.sinistres.read` garantit cet acces controle.

### Loi 09-08 -- CNDP (protection donnees personnelles)

**Article 4** : les donnees personnelles assure + sinistre sont des donnees sensibles (sante potentielle, geolocalisation precise). Acces conditionne au consentement explicite + finalite documentee.

**Implementation** :
- Backend Sprint 7 audit log sur tous acces `GET /api/v1/repair/sinistres/*`
- Frontend ne stocke aucune donnee sensible en localStorage (only sessionStorage pour tenant context)
- Photos sinistre servies en pre-signed URL TTL 15 min (pas de cache CDN public)
- Droit a l'oubli : si assure exerce droit, backend supprime documents S3 (cf. EC6)

### Loi 31-08 -- droit d'acces consommateur

**Article 6** : l'assure a droit d'acceder a ses donnees sinistre a tout moment. Via portail customer Sprint 18, il consulte les memes donnees que le broker (avec son propre filtre RBAC `customer.own.sinistres.read`).

### WCAG 2.1 AA -- accessibilite

**Implementation specifique sinistres** :
- `<SinistreStatusFlow>` : `<nav>` + `<ol role="list">` + `<li role="listitem">` + `aria-current="step"` sur etape courante
- Status badges : ratio contraste >= 4.5:1 verifie pour les 9 couleurs (light + dark theme)
- DataTable : headers triables ont `aria-sort="ascending|descending|none"`
- Filtres : `<label>` associe a chaque input via `htmlFor`
- Map Mapbox : `aria-label` descriptif "Carte localisation sinistre [number]"
- Carrousel photos : navigation clavier Arrow Left/Right + `aria-label` per photo
- Bouton ACAPS export : `aria-describedby` pointe vers description detaillee dialog

### Timezone Africa/Casablanca

Toutes les dates affichees sont converties en zone `Africa/Casablanca` via `date-fns-tz`. Les filtres date_range envoyent ISO 8601 avec offset explicite (`2026-05-15T00:00:00+01:00`) pour eviter ambiguites DST (le Maroc applique heure d'ete +1, +0 hors DST).

### Multilingue fr / ar-MA / ar

Status labels traduits dans les 3 langues. Aucun emoji utilise (decision-006). Termes techniques (ACAPS, MAD, etc.) preserves dans toutes locales.

---

## 13. Conventions absolues skalean-insurtech (3-5 ko, liste complete)

### C1 -- AUCUNE EMOJI

Verifie par `scripts/check-no-emoji.sh` (pre-commit Husky + CI GitHub Actions). Aucun emoji dans :
- Code source TS/TSX/JS/JSON
- Messages i18n
- Commentaires
- Commit messages
- README et docs

### C2 -- File naming kebab-case

- Composants TSX : `sinistres-table.tsx`, `sinistre-status-flow.tsx`
- Hooks : `use-sinistre-detail.ts`
- Utils : `format-sinistre.ts`, `sinistre-status-config.ts`
- Tests : `sinistres-table.test.tsx`

### C3 -- React component PascalCase

- `SinistresTable`, `SinistreStatusFlow`, `AcapsExportButton`

### C4 -- Types/interfaces PascalCase

- `Sinistre`, `SinistreFilters`, `SinistreStatus`, `SinistreListResponse`

### C5 -- Constantes UPPER_SNAKE_CASE

- `SINISTRE_STATUSES`, `BRANCHES_ASSURANCE`, `SINISTRE_WORKFLOW_ORDER`, `SINISTRE_STATUS_CONFIG`

### C6 -- Imports ordres (auto via eslint-plugin-import)

1. Side-effect imports
2. Builtins (node:fs, etc.)
3. External (`react`, `next/...`, `@tanstack/...`)
4. Internal aliases (`@/components/...`, `@/lib/...`)
5. Relative (`./`, `../`)

### C7 -- TanStack Query patterns

- queryKeys factory pattern : `sinistresKeys.all`, `sinistresKeys.list(filters)`, etc.
- staleTime : 5 min lecture (sinistres), 1 min temps-reel critique (non utilise ici)
- gcTime : 30 min apres unmount
- placeholderData pour pagination (previousData -- evite flash skeleton)

### C8 -- Zod schemas

- Toujours exporter `infer` type : `export type Sinistre = z.infer<typeof sinistreSchema>;`
- Validation runtime sur reponses API (defense en profondeur contre backend evolution)
- Pas de `.passthrough()` -- strict mode toujours

### C9 -- Server vs Client Components

- Pages `page.tsx` : Server Components (prefetch + render shell)
- Tabs / interactive widgets : Client Components (`'use client'`)
- Composants purs presentationnels (`<SinistreStatusBadge>`) : peut etre serveur si pas de hooks, sinon client

### C10 -- ME/MS au lieu de ML/MR

Toujours utiliser `me-` (margin-end), `ms-` (margin-start) au lieu de `mr-` / `ml-` pour support RTL natif via Tailwind 4.

### C11 -- data-testid pour test E2E

Pattern : `[noun]-[role/state]` -- `sinistre-row`, `acaps-export-button`, `status-step-declared`. Pas de classes CSS pour tests (couplage UI).

### C12 -- ARIA labels

- Boutons icone seule : `aria-label` obligatoire
- Stepper : `aria-current="step"` sur etape courante
- Tables : `scope="col"` sur `<th>`, `aria-sort` sur sortable headers

### C13 -- Formatting MAD avec Intl

`new Intl.NumberFormat('fr-MA' | 'ar-MA', { style: 'currency', currency: 'MAD' })`. Jamais de string template manuel.

### C14 -- Date formatting timezone-aware

`date-fns-tz` `utcToZonedTime` + `format` toujours. Jamais `new Date(...).toLocaleString()` direct.

### C15 -- Validation cles i18n

Script `validate-i18n-keys.ts` execute en pre-commit + CI. Casse build si parite manque.

### C16 -- Pas de mutations dans queries.ts

Module read-only : `lib/queries/sinistres.queries.ts` n'exporte AUCUN `useMutation`. Test statique verifie absence `useCreate*` / `useUpdate*` / `useDelete*`.

### C17 -- Permissions check defence en profondeur

- UI : `<HasPermission>` cache le bouton
- Backend Sprint 7 PermissionGuard rejette 403 meme si UI manipule

### C18 -- Pas de `any` TypeScript

`tsconfig.json` strict + `eslint-plugin-typescript` no-explicit-any error. Type unknown ou generic si vraiment necessaire.

### C19 -- Couleurs via CSS variables Tailwind 4

Pas de hex hardcode (`#2D5773` interdit). Toujours `bg-acaps-teal` ou variable Tailwind preset.

### C20 -- Bundle splitting lazy

`dynamic(() => import('...'), { ssr: false })` pour Mapbox, pdf-lib, et tout module > 50 ko. Verifier bundle analyzer en CI.

### C21 -- Pas de `console.log` en production

ESLint `no-console: ['error', { allow: ['warn', 'error'] }]`. Logger via Sentry breadcrumb en prod.

### C22 -- Pas de `window` direct sans SSR check

`typeof window !== 'undefined'` check obligatoire avant `window.localStorage` ou `window.location`.

### C23 -- Atlas Cloud only (pas AWS)

`images.remotePatterns` jamais avec `*.amazonaws.com`. Toujours `s3.bgr.atlascloudservices.ma` ou MinIO localhost dev.

### C24 -- Currency MAD only (pas EUR/USD)

Module sinistres broker = Maroc. Toujours `currency: 'MAD'`. Si futur multi-pays, abstraire via `useTenantCurrency()` hook (Sprint 27).

### C25 -- Status enum source verite backend OpenAPI

`SINISTRE_STATUSES` frontend doit matcher exactement les enums backend (Sprint 21). Regeneration auto via `pnpm codegen`. Drift detection en CI.

---

## 14. Validation pre-commit (1-2 ko)

### Husky `pre-commit` hook

```bash
#!/bin/sh
# .husky/pre-commit

set -e

echo "[pre-commit] check no emoji"
./scripts/check-no-emoji.sh

echo "[pre-commit] lint-staged"
pnpm exec lint-staged

echo "[pre-commit] typecheck affected"
pnpm --filter @insurtech/web-broker typecheck

echo "[pre-commit] tests unit sinistres"
pnpm --filter @insurtech/web-broker test:unit -- sinistres --run

echo "[pre-commit] i18n keys parity"
pnpm tsx scripts/validate-i18n-keys.ts apps/web-broker

echo "[pre-commit] OK"
```

### `.lintstagedrc.json`

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.json": ["prettier --write"],
  "messages/*.json": ["pnpm tsx scripts/validate-i18n-keys.ts apps/web-broker"]
}
```

### Verification manuelle avant push

```powershell
# 1. Lint
pnpm --filter @insurtech/web-broker lint

# 2. Typecheck
pnpm --filter @insurtech/web-broker typecheck

# 3. Tests
pnpm --filter @insurtech/web-broker test:unit -- sinistres --run
pnpm --filter @insurtech/web-broker test:e2e -- sinistres.spec.ts

# 4. Build prod
pnpm --filter @insurtech/web-broker build

# 5. No emoji
.\scripts\check-no-emoji.ps1 apps\web-broker

# 6. i18n parity
pnpm tsx scripts\validate-i18n-keys.ts apps/web-broker

# 7. Bundle analyzer (optionnel mais recommande)
ANALYZE=true pnpm --filter @insurtech/web-broker build
```

### Checklist DoD (Definition of Done) avant PR

- [ ] Tous criteres P0 (V1-V14) valides
- [ ] Tous criteres P1 (V15-V20) valides
- [ ] Tests unitaires Vitest passent (12+ scenarios)
- [ ] Tests E2E Playwright passent (8+ scenarios)
- [ ] Bundle module sinistres < 120 ko gzipped
- [ ] LCP < 2.5s sur /fr/sinistres (Lighthouse mobile)
- [ ] Axe-core 0 violations
- [ ] No emoji verifie
- [ ] Parite cles i18n fr/ar-MA/ar verifie
- [ ] No `any` TypeScript ajoute
- [ ] No `console.log` ajoute
- [ ] Doc CHANGELOG.md mise a jour avec section "Sinistres broker read-only"

---

## 15. Commit message complet (1-2 ko)

```
feat(web-broker): sinistres read-only module (4.3.10)

Implementation page sinistres broker app strictement read-only conforme
decision metier M9 -- broker sans intervention dans workflow sinistre,
seulement suivi pour conseil client + reporting ACAPS.

Modules ajoutes :
- Route /sinistres (list) : DataTable TanStack + filtres nuqs
  - Colonnes : sinistre_number / police / customer / declaration_date /
    status / amount_estimated / garage / expert
  - Filters : status (9) + branche (6) + date_range + garage + customer
  - Pagination URL state
  - Bouton Export ACAPS (broker_admin only -- permission
    reporting.acaps.export)
- Route /sinistres/[id] (detail) : 8 onglets read-only
  - Info (description + Mapbox map + temoins + numero PV)
  - Police (lien deep + garanties activees)
  - Customer (lien + bouton Contacter via Sprint 9 Comm)
  - Garage (nom + technicien + status reparation)
  - Expert (rapport PDF + photos avant/apres carrousel)
  - Documents (groupe par categorie + S3 viewer)
  - Timeline (events chronological)
  - Reglement (montant final + virement + assureur partenaire)
- SinistreStatusFlow : stepper visuel WCAG 2.1 AA (role list +
  aria-current step) avec branche litigation distincte
- Print rapport courtier PDF client-side via pdf-lib

Specifications techniques :
- TanStack Query 5 : queries only, staleTime 5min, AUCUNE mutation
- Mapbox GL JS lazy load (~850 ko chunk separe)
- nuqs URL state pour filtres + pagination
- shadcn/ui : Tabs, DataTable, Dialog, Popover, Badge, Skeleton
- date-fns-tz Africa/Casablanca timezone
- Intl.NumberFormat currency MAD
- Schema Zod strict pour validation runtime

Permissions :
- repair.sinistres.read (3 roles broker)
- reporting.acaps.export (broker_admin only)

Conformite :
- ACAPS decret 2-13-836 article 12 (export CSV/PDF mensuel obligatoire)
- Loi 17-99 article 18 (transparence broker)
- Loi 09-08 CNDP (audit acces backend)
- Loi 31-08 (droit acces customer parallele)
- WCAG 2.1 AA (stepper semantique, contraste, navigation clavier)

Tests :
- 12 tests Vitest unit (status config, formatters, schemas, table,
  filters, queries, components tabs)
- 12 tests Playwright E2E (list, filters, detail tabs, AUCUN bouton
  write present, contact assure deep link, ACAPS export download admin,
  RBAC non-admin no export, locale switch, status stepper)

Fichiers crees : 32 (3 800 lignes TS/TSX)
Fichiers modifies : 5 (next.config.mjs, .env.example, messages/*.json)

Sprint : 16 (Phase 4 / Sprint 3)
Tache : 4.3.10
Effort : 4h
Depend de : 4.3.9 (broker queue)
Debloque : 4.3.11 (parametres + profile)

Refs : decision-022 (M9 broker sans intervention),
       decision-024 (workflow status M8 a 9 statuts),
       meta-prompt B-16 tache 4.3.10

Co-authored-by: Skalean InsurTech Team <dev@skalean-insurtech.ma>
```

---

## 16. Workflow next step

Apres merge de 4.3.10 dans `main` :

1. **Verification post-deploy** (staging) :
   - Smoke test `/fr/sinistres` + `/fr/sinistres/[seedId]`
   - Verifier RBAC : login broker_user vs broker_admin -> ACAPS bouton visibility
   - Tester export ACAPS sur dataset reel (100+ sinistres) -- temps generation < 10s
   - Verifier integration Mapbox tokens prod domaine restriction

2. **Documentation utilisateur** :
   - Ajouter section "Sinistres" dans le guide utilisateur broker (`docs/user-guide/broker/sinistres.md`)
   - Capture d'ecran liste + detail (8 tabs) + export ACAPS dialog
   - FAQ "Pourquoi je ne peux pas creer un sinistre ?" -> explication M9
   - FAQ "Comment generer mon reporting ACAPS ?" -> tutoriel pas-a-pas

3. **Demarrer tache 4.3.11** (Parametres + Profile Pages -- 5h) :
   - Pre-requis remplis (toutes pages metiers core finalisees)
   - Bootstrap tabs Settings/Profile
   - MFA setup flow QR -> verify -> codes

4. **Communication produit** :
   - Annonce interne dev team : module sinistres broker read-only live
   - Demo a l'equipe customer success pour formation
   - Mise a jour roadmap publique (Notion)

5. **Suivi metriques post-launch** :
   - Tracker via PostHog (Sprint 13) : nombre d'utilisateurs broker accedent /sinistres
   - Tracker frequence export ACAPS (cible : 1 par broker par mois apres release)
   - Tracker temps moyen passe sur page detail (engagement)
   - Alerter si % erreurs (4xx/5xx) > 1% pour endpoints `/api/v1/repair/sinistres/*`

6. **Prevoir refactor Sprint 24** :
   - Extraction composants partages avec web-garage-app : `<SinistreStatusFlow>`, `<SinistreStatusBadge>`, `<DocumentS3Viewer>` dans `@insurtech/shared-ui`
   - Mutualisation logique workflow M8 dans `@insurtech/shared-domain`

---

## 17. Footer densite + auto-verif

```powershell
Get-Item .\00-pilotage\prompts-taches\sprint-16-web-broker-app\task-4.3.10-sinistres-page-read-only.md | Select-Object Length
```

Densite attendue : 100-150 ko (cible 110 ko).

Fichier auto-suffisant : code patterns COMPLETS (32 fichiers types/components/tests), tests prets a runner (Vitest + Playwright), criteres V1-V24 check-ables, decisions metier referencees, conformite Maroc detaillee, conventions exhaustives.

Verifications automatiques :
- `pnpm --filter @insurtech/web-broker typecheck` doit passer
- `pnpm --filter @insurtech/web-broker test:unit -- sinistres --run` doit passer
- `pnpm --filter @insurtech/web-broker test:e2e -- sinistres.spec.ts` doit passer
- `pnpm --filter @insurtech/web-broker build` doit passer
- `.\scripts\check-no-emoji.ps1 apps\web-broker` doit retourner 0 occurrence
- `pnpm tsx scripts\validate-i18n-keys.ts apps/web-broker` doit retourner OK

**FIN TASK 4.3.10**
