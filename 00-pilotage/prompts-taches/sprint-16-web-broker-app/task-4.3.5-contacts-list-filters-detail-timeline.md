# TACHE 4.3.5 -- Contacts Page : List + Filters + Create/Edit + Detail Timeline

**Sprint** : 16 (Phase 4 -- Vertical Insure / Sprint 3 dans phase / 16e cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.5)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0
**Effort** : 7h
**Dependances** : Tache 4.3.4 (Dashboard 6 widgets) ; consume endpoints Sprint 8 CRM (contacts complets : list, detail, timeline, bulk-action), Sprint 9 (envoi messages WhatsApp/Email), Sprint 8 booking (rendez-vous), Sprint 14 (polices d'un contact)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Implementer la page Contacts complete dans l'app `web-broker` (port 3001) : liste pagine + filtres avances + create/edit modaux + page de detail avec timeline d'interactions. Cette page constitue le coeur metier du CRM Skalean pour les courtiers d'assurance marocains -- elle materialise l'acces aux fiches client (prospects, leads, assures, VIP) via une experience industrielle Next.js 15 App Router + TanStack Table + TanStack Query 5 + react-hook-form + Zod + nuqs.

A la sortie de cette tache : l'URL `/contacts` affiche une DataTable shadcn/ui avec colonnes (avatar+nom, email, phone, company, segment, derniere interaction, owner), filtres synchronises URL (`?segment=lead,prospect&tags=vip&search=ahmed&assigned_to=u_xxx`), recherche debounced 300ms en darija/arabe/francais, pagination cursor, tri multi-colonnes, bulk actions (tag, assign, export CSV stream, delete soft), modal create/edit avec validation Zod (CIN MA `/^[A-Z]{1,2}\d{1,7}$/`, telephone E.164 MA `/^\+212[5-7]\d{8}$/`, email RFC 5322 max 255), page `/contacts/[id]` avec onglets (Info, Timeline Interactions, Deals, Polices, Documents, Communications) et actions rapides (Send Message, Schedule Appointment, Create Deal, Generate Quote). Tous les mutations utilisent optimistic UI avec onMutate / onError revert. Tests Vitest unitaires (15+) et Playwright E2E (12+) verts. Conformite CNDP Loi 09-08 (CIN masquage dans URL et logs) et Loi 31-08 (right to erasure via soft delete + retention 5 ans audit). Cette tache bloque 4.3.6 (Companies, qui copie le pattern), et est consumee transversalement par 4.3.7 (Deals -- relation contact), 4.3.8 (Polices -- souscripteur), 4.3.9 (Broker Queue -- client a valider).

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

La page Contacts est la **premiere page metier riche** du portail courtier apres le bootstrap (4.3.1), l'auth (4.3.2), le shell (4.3.3) et le dashboard (4.3.4). Elle valide la chaine integrale : Server Components Next.js 15 -> Server Actions -> API NestJS Sprint 8 (multi-tenant + RBAC + audit) -> PostgreSQL multi-schema -> TanStack Query cache client -> shadcn/ui composants -> tests E2E. Toute deviation ici se propagera aux 8 pages metier restantes du sprint 16 (Companies, Deals, Polices, Broker-Queue, Sinistres, Parametres, Profile, Dashboard widgets).

Le contact CRM est l'entite de plus haute frequence d'interaction utilisateur dans le quotidien d'un courtier marocain : un cabinet moyen detient 3000 a 15000 contacts (leads froids, prospects qualifies, assures actifs, VIP referents, anciens clients churned). La page doit supporter :

- **Performance** : list de 10000+ rows sans freeze (cursor pagination 50/page + virtualization recommandee >5000)
- **Recherche multi-langue** : darija (transliteree latin ou ecrite arabe), arabe classique, francais ; tolerance accents (`Mohammed` = `Mohamed` = `محمد`)
- **Filtres composables** : segment + tags + assigned_to + search combinables via nuqs URL state (deep-linkable, shareable, browser back/forward)
- **Bulk actions** : 100+ contacts selectables, action serveur streamee (CSV export 50000 rows sans timeout)
- **Mobile-friendly** : table degrade en cards stack <768px (courtier en visite client tablet/phone)
- **RBAC** : `broker_assistant` voit liste mais ne peut pas delete ; `broker_user` voit ses contacts assignes ; `broker_admin` voit tous
- **Audit trail** : chaque create/update/delete logge dans `audit_log` Sprint 6 avec actor + IP + diff

La modal create/edit gere 14 champs dont des champs custom dynamiques (Sprint 8 a livre `custom_field_definitions` par tenant -- ex : "Date de fin contrat actuel", "Type vehicule prefere", "Banque domiciliation"). Le rendu dynamique types (text/number/date/select/boolean) avec Zod schema construit a la volee est la complexite cle de la modal.

La page detail `/contacts/[id]` agrege 6 sources de donnees :

1. Contact fields (Sprint 8 `/contacts/:id`)
2. Timeline interactions (Sprint 8 `/contacts/:id/timeline`) -- appels, emails, WhatsApp, SMS, meetings, notes, tasks, status_changes
3. Deals associes (Sprint 8 `/contacts/:id/deals`)
4. Polices souscrites (Sprint 14 `/contacts/:id/policies`)
5. Documents lies (Sprint 10 `/contacts/:id/documents`)
6. Communications history (Sprint 9 `/contacts/:id/communications`)

Chaque onglet est un Server Component avec son propre `Suspense` boundary, charge en streaming. Les actions rapides ouvrent des dialogs reutilisables (`<SendMessageDialog>`, `<ScheduleAppointmentDialog>`, `<CreateDealDialog>`, `<GenerateQuoteDialog>`) qui pre-remplissent le contexte du contact courant.

### Alternatives considerees

#### TanStack Table 8 vs react-table 7 vs Material React Table vs AG Grid

| Critere | TanStack Table 8 (CHOIX) | react-table 7 | Material React Table | AG Grid |
|---------|---------------------------|---------------|----------------------|---------|
| Bundle size gzipped | ~14 ko (headless) | ~12 ko | ~80 ko (MUI bundled) | ~250 ko (enterprise) |
| Headless vs styled | Headless (s'integre shadcn) | Headless | Styled (MUI tied) | Styled (proprietary) |
| TypeScript inference | Excellent (v8 reecrit TS) | Faible (v7) | Bon | Bon |
| Column resizing | Natif | Plugin | Natif | Natif |
| Column ordering drag | Natif | Plugin | Natif | Natif |
| Row selection | Natif | Plugin | Natif | Natif |
| Virtualization | Plugin `@tanstack/react-virtual` | Plugin | Natif | Natif (rapide) |
| Pinning | Natif | Plugin | Natif | Natif |
| Subrows / grouping | Natif | Plugin | Natif | Natif |
| Server-side mode | Natif (manualPagination, manualFiltering) | Plugin | Natif | Natif |
| Licence | MIT | MIT | MIT | Community MIT + Enterprise commerciale |
| React Server Components | Compatible (client part) | Compatible | Non (MUI emotion SSR issues) | Non |
| Maintainer | tanstack (Tanner Linsley) | discontinue (v8 = renommage) | community | ag-grid Ltd |

**Decision** : TanStack Table 8.20.6 -- headless integre shadcn/ui, TypeScript inference forte, lifecycle methods clairs pour server-side mode (cursor pagination + filters + sort transmis au backend), bundle leger compatible Sprint 4 constraint, et meme maintainer que TanStack Query 5 deja choisi Sprint 4 (alignement equipe).

#### Cursor pagination vs offset pagination

| Critere | Cursor (CHOIX) | Offset |
|---------|----------------|--------|
| Performance large dataset | Constant O(1) par page | O(N) deteriore (PostgreSQL `OFFSET 50000`) |
| Duplicates / missed rows sur insert/delete | Aucun | Frequent (race conditions) |
| Implementation complexite | Moyenne (encoder cursor base64) | Simple |
| Random page jump | Impossible (next/prev only) | Possible (page 47) |
| URL state nuqs | Cursor encoded base64 dans `?cursor=` | `?page=47` simple |
| Bookmarkable | Oui (cursor fige) | Oui mais incoherent si DB change |

**Decision** : Cursor pagination. Justifie pour 10000+ contacts ou offset PostgreSQL devient prohibitif (>500ms par page lointaine). Le backend Sprint 8 a deja livre cursor pagination sur tous endpoints CRM (`GET /contacts?cursor=eyJpZCI6...&limit=50` retourne `{ items, next_cursor, has_more }`). On expose dans l'UI seulement Next/Previous (pas de "page 47"), avec compteur "1-50 sur 3247". Le revers : tri arbitraire impacte le cursor -- on impose tri par `created_at DESC` par defaut et fournit toggle limites (last_name ASC/DESC, last_interaction DESC, segment).

#### react-hook-form + Zod vs Formik + Yup vs custom + Zod

| Critere | rhf + Zod (CHOIX) | Formik + Yup | Custom + Zod |
|---------|-------------------|--------------|--------------|
| Re-render granularity | Uncontrolled, minimal re-renders | Contolled, frequent re-renders | Custom (peut etre optimise) |
| Bundle size | ~25 ko (rhf + resolvers + zod) | ~40 ko (formik + yup) | 0 (custom) |
| TypeScript inference | Excellent (resolver tied to schema) | Faible (Yup v1 amelioration en cours) | Excellent (Zod natif) |
| Field arrays dynamic | Natif `useFieldArray` | `FieldArray` component | Manuel |
| Watch / subscribe | Selector pattern performant | re-renders on any change | Manuel |
| Validation server-side reuse | Zod schema partage front+back possible | Yup non transferable | Zod transferable |
| Async validation | Natif `validate: async` | Natif | Manuel |
| Maintenance | Active (rhf 7.54 + zod 3.24) | Active mais slower | DIY |

**Decision** : react-hook-form 7.54 + Zod 3.24. Choisi pour performance (modal 14 champs + custom fields dynamiques = potentiel 30+ inputs sans re-render cascade), TypeScript inference automatique des types `Contact` depuis le schema Zod, et reuse Sprint 8 server schema (Contact Zod schema dans `packages/shared-types/contact.schema.ts` partage front + back).

#### nuqs vs useSearchParams + manual sync vs URL libraries (next-usequerystate predecessor)

| Critere | nuqs 2.0 (CHOIX) | useSearchParams manual | Other |
|---------|------------------|------------------------|-------|
| App Router support | Natif Next.js 15 | Natif mais boilerplate | Variable |
| Parsers built-in | string, number, boolean, json, array, date | Manuel | Variable |
| Shallow updates (no reload) | Natif `shallow: true` | Manuel `router.replace` | Variable |
| Default values | Natif | Manuel fallback | Variable |
| TypeScript types | Excellent (parser-driven) | Faible (URLSearchParams = string\|null) | Variable |
| Server Component support | `createSearchParamsCache` | Natif via `searchParams` prop | Variable |
| Batching writes | Natif `useQueryStates` | Manuel | Variable |

**Decision** : nuqs 2.0. Choisi pour App Router native support, parsers typed (notamment `parseAsArrayOf(parseAsString)` pour `tags=vip,gold`), shallow updates qui ne re-fetch pas les Server Components, et batching pour appliquer plusieurs filtres simultanement.

#### Optimistic UI : TanStack Query onMutate vs Server Action useOptimistic vs zustand local

| Critere | onMutate (CHOIX) | useOptimistic | zustand |
|---------|------------------|----------------|---------|
| Granularity | Per-query cache update | Per-component transition | Global store |
| Cache invalidation | Natif (`queryClient.invalidateQueries`) | Manuel | Manuel |
| Rollback on error | Built-in via `context` retourne | Auto (transition se replace) | Manuel |
| Server response sync | Built-in (`onSuccess` replace optimistic) | Auto | Manuel |
| Cross-component sync | Cache-wide (toutes les list/detail re-rendent) | Component-scoped | Store-wide |
| Cooperation Server Actions | Compatible | Tied | Compatible |

**Decision** : TanStack Query 5.62 `onMutate` + `onError` rollback + `onSettled` invalidate. Pattern : on cree un contact, le cache list est immediatement mis a jour avec un objet `_optimistic: true` (rendu avec opacite 0.6 + spinner badge), le serveur repond, on remplace par l'objet reel ; si erreur, on rollback via context capture. `useOptimistic` React 19 reste utile pour Server Actions pures, mais le mix Server Component + Client Component avec mutations frequentes converge vers TanStack Query.

### Trade-offs explicites

1. **Custom fields dynamiques avec Zod build-time vs runtime** : Zod schemas sont construits a la volee depuis `custom_field_definitions` du tenant. Cela empeche TypeScript inference statique sur les custom fields. Mitigation : on type comme `Record<string, string | number | boolean | Date>` avec validation Zod runtime, et on utilise type guards specifiques par definition (`z.discriminatedUnion` selon `field.type`).

2. **CIN MA masquage URL** : la regle CNDP impose de ne pas exposer un CIN dans l'URL en clair. Cependant `/contacts/[id]` utilise un `id` UUID, pas le CIN -- conforme. Si un courtier search par CIN, on debounce + envoi POST `/contacts/search` (body) plutot que GET `/contacts?cin=AA123456` (URL). Tracker dans request log seulement le hash SHA-256 du CIN, jamais en clair.

3. **Pagination cursor + sort multi-colonne incompatible** : le cursor encode `(sort_column, sort_value, id)` -- si on permet tri sur 5 colonnes simultanement, le cursor explose. Compromis : un seul sort actif a la fois (UI : click une colonne = nouveau sort, shift-click = ajoute secondaire ignore en cursor mode). Backend Sprint 8 supporte deja cette contrainte.

4. **Search debounce 300ms vs instant** : Trop court (100ms) genere requete API a chaque keystroke (couteux). Trop long (1000ms) frustre user. 300ms est le sweet spot UX prouve (utilise par Algolia, GitHub, Notion). On annule la requete in-flight via `AbortController` quand un nouveau keystroke arrive.

5. **Bulk export CSV streaming server vs client** : 50000 contacts en CSV = ~15 MB. Generation client (JSON -> CSV via PapaParse) freeze le navigateur 5s+. Server stream avec `Transfer-Encoding: chunked` + `Content-Disposition: attachment` evite ce probleme. Trade-off : on doit gerer la progression cote client (download progress via Service Worker ou simple toast "Export en cours").

6. **Timeline groupee par date vs flat** : Une timeline de 200 interactions sur 5 ans est illisible flat. On groupe par jour calendaire (`format(date, 'PPP', locale)`) avec headers sticky. Trade-off : si trop de groupes (e.g. 50 jours), scroll long -- mitigation : virtualization si >100 interactions, et pagination "Charger plus" avec cursor.

7. **Optimistic UI sur create vs disabled-until-confirmed** : Optimistic ajoute complexite (rollback, cache sync) mais ameliore perceived performance de 300-500ms. Pour le create contact, on choisit optimistic ; pour delete on demande confirmation modal (pas optimistic). Pour bulk actions, on disable boutons jusqu'a confirmation (action lourde, pas optimistic).

8. **DataTable client-side filtering vs server-side** : Server-side pour respecter pagination cursor et eviter de charger 10000 rows. Mais filtres tags (multi-select) genere `WHERE tags @> ARRAY[...]` couteux -- backend Sprint 8 a indexe `tags` GIN, donc OK jusqu'a 100000 rows par tenant.

9. **Photo upload >5MB rejected** : 5MB couvre une photo smartphone HD jpg. Backend Sprint 10 (Documents) accepte jusqu'a 10MB. On limite cote front a 5MB pour eviter latence upload 4G/3G (Maroc rural). Mitigation : message clair "Photo trop lourde, compresser ou prendre nouvelle". Possibilite future : compression client-side via `browser-image-compression`.

10. **Soft delete vs hard delete** : Loi 31-08 (CNDP) impose droit a l'oubli MAIS Loi 09-08 + ACAPS imposent retention 5 ans audit financier. Compromis : soft delete (flag `deleted_at`) avec masquage UI immediat, hard delete planifie apres 5 ans via job batch. Restore possible pendant 30 jours via page corbeille (UX Sprint 17+).

11. **Recherche fuzzy arabe** : `محمد` vs `محمّد` (avec shadda) vs `Mohammed` vs `Mohamed`. Backend Sprint 8 utilise PostgreSQL `unaccent` + `arabic_stem` (extension custom). Front envoie raw query, serveur normalise. Front affiche highlighted matches (lib `mark.js` client-side).

12. **Africa/Casablanca timezone display** : Toutes dates timestamp UTC en DB. Front affiche via `date-fns-tz` + `Africa/Casablanca`. Daylight saving (Maroc abandonne DST 2018, fige a UTC+1 puis suspend Ramadan -> UTC+0 puis retour +1). `date-fns-tz` gere correctement via IANA timezone database.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : `apps/web-broker` reside dans monorepo root `/repo`. Imports cross-package via `@insurtech/shared-types/contact.schema` (Zod schema partage) et `@insurtech/shared-ui` (composants Card, Badge, Button, Avatar, DropdownMenu, Sheet, Dialog, DataTable).
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans labels, segment names, tags pre-suggested, messages JSON i18n. Si user tape un emoji dans un nom de contact (free text), on le sauvegarde tel quel mais on ne suggere jamais d'emoji. Linter CI bloque les commit avec emoji dans le code source.
- **decision-008 (cloud souverain MA)** : Atlas Cloud Benguerir, donc photos contacts uploaded dans `s3.bgr.atlascloudservices.ma`. `images.remotePatterns` Next.js inclut ce domaine + presigned URLs scope tenant.
- **decision-009 (multilinguisme MA)** : trois locales fr / ar-MA (Darija) / ar (classique). Tous labels page Contacts traduits. `last_interaction` formate via `date-fns` locale `fr` / `ar`. Numero telephone affichage E.164 avec espaces `+212 6 12 34 56 78` lisible en LTR meme en RTL (force LTR via `dir="ltr"` sur span phone).
- **decision-010 (web-broker first vertical)** : la page Contacts est la **premiere page metier complete CRUD** du programme. Toute decision pattern (DataTable + Dialog + Sheet + nuqs URL state + optimistic mutations + Server Component initial fetch) sera repliquee dans 4.3.6 Companies, 4.3.7 Deals, 4.3.8 Polices, etc.
- **decision-011 (conformite CNDP Loi 09-08)** : CIN classified PII -> jamais en URL (UUID seulement), jamais dans logs Sentry (scrubbing rule), consent banner sur create form ("Le contact a-t-il consenti au traitement de ses donnees ?" checkbox required).
- **decision-012 (audit trail 5 ans)** : tous mutations contact loguees Sprint 6 audit_log avec actor + IP + tenant + diff JSON + reason (optional). Front affiche diff dans timeline tab.

### Pieges techniques connus (15 minimum)

1. **TanStack Query v5 staleTime vs gcTime confusion** : v5 a renomme `cacheTime` -> `gcTime`. Confondre les deux fait expirer prematurement le cache. `staleTime: 30_000` = considere frais 30s (pas de refetch background). `gcTime: 300_000` = garde en memoire 5min apres derniere observation. Pour liste contacts : `staleTime: 30_000` (refetch si revient onglet apres 30s), `gcTime: 300_000`.

2. **Hydration mismatch sur cursor encoded** : si le serveur (Server Component) decode `?cursor=eyJp...` differemment du client (re-decode via nuqs), DOM mismatch. Solution : decoder identique des deux cotes via util commun `decodeCursor()` dans `lib/cursor.ts`.

3. **Debounce search avec stale closure** : `useDebounce(searchQuery, 300)` retourne valeur stale si on ne re-cree pas l'effect a chaque keystroke. Solution : `useEffect(() => { const id = setTimeout(...); return () => clearTimeout(id); }, [searchQuery])`.

4. **AbortController + TanStack Query** : v5 supporte `signal` natif via queryFn `({ signal }) => fetch(url, { signal })`. Si on omet, le keystroke spam genere 10 requetes paralleles dont 9 sont jetees. Toujours forwarder le signal.

5. **Modal re-render reset form values** : ouvrir/fermer modal recreee le composant -> form values resettent. Pattern : `<Dialog open={open}>` avec `<DialogContent forceMount>` evite remount, mais alors form reset doit etre manuel via `form.reset(initialValues)` dans `useEffect(open ? reset : noop)`.

6. **Zod custom field union runtime** : construire `z.discriminatedUnion('type', [...])` depuis `customFieldDefinitions` array a chaque render = inefficient. Memoiser via `useMemo` avec dependence sur la signature des definitions (sha-256 ou simple `definitions.map(d => d.id).join(',')`).

7. **CIN MA validation edge case `AA` prefix** : pattern `/^[A-Z]{1,2}\d{1,7}$/` accepte `A1`, `AA1234567`, mais aussi `XY9999999` non assigne. Regex stricte impossible (les codes prefix sont opaques ACAPS). Solution : pattern lax + warning UX si prefix inconnu (lib `cin-ma-validator` Sprint 4 expose `getCinPrefixRegion()`).

8. **Phone E.164 auto-correct** : user tape `0612345678` (format MA local), on doit auto-convertir `+212612345678`. react-hook-form `setValue` apres `onBlur` -> mais re-render perdu si user re-edit. Solution : transform Zod `.transform((val) => val.startsWith('0') ? '+212' + val.slice(1) : val)`.

9. **CSV export Excel BOM** : Excel sur Windows ouvre CSV mal si pas de BOM UTF-8 (`﻿` prefix). Backend doit prepend BOM dans stream. Sans : `محمد` apparait `???????`. Front detecte OS et offre option "Compatible Excel" qui appelle endpoint avec query `?excel=true`.

10. **Optimistic UI race condition** : 3 mutations create paralleles -> 3 onMutate appends a la liste -> 3 onSuccess essaient de remplacer le meme placeholder optimistic. Solution : utiliser `tempId` UUID dans `onMutate` retourne en context, match par `tempId` dans onSuccess.

11. **TanStack Table column sizing persisted** : si user resize column, persist en localStorage `contacts-table-sizing-v1`. Sinon perdu a chaque navigation. Cle versionnee pour invalider si schema columns change.

12. **Sheet vs Dialog Mobile** : sur mobile, Dialog modal occupe 90% ecran mais reste centre -> mauvais UX clavier virtuel. Solution : `<Sheet side="bottom">` sur mobile (bottom sheet pattern), `<Dialog>` sur desktop. Detecter via `useMediaQuery('(min-width: 768px)')`.

13. **Bulk actions large selection** : selectionner 5000 contacts via "Select all" -> POST body 5000 IDs trop gros (>1MB). Backend Sprint 8 supporte `select_all_matching_filters: true` au lieu d'IDs -> on envoie filters courants. Pattern : checkbox "Selectionner les 5000 contacts correspondants" affiche apres "Select all visible 50".

14. **Sentry PII scrubbing** : par defaut Sentry capture URLs + form values -> CIN, email, phone leak. Configurer `beforeSend` qui scrub keys `cin`, `email`, `phone`, `cnss`. Test dedie verify `sentry.event.request.data.cin === '[REDACTED]'`.

15. **Loi 09-08 CNDP consent obligatoire** : avant create contact, checkbox "Le contact a consenti par ecrit/oral au traitement". Stocker `consent_given_at` + `consent_source` (verbal/written/online). Si non coche, modal bloque submit avec error legal.

16. **Soft delete dans cache TanStack Query** : delete -> backend retourne 204, mais cache list contient encore le contact. `onSuccess: () => queryClient.invalidateQueries(['contacts'])` ne suffit pas si cursor cache est complexe. Solution : `queryClient.setQueryData(['contacts'], old => ({ ...old, items: old.items.filter(c => c.id !== deletedId) }))` instant + invalidate background.

17. **next-intl messages keys missing build break** : `t('contacts.bulk.export.success')` -> si manque dans `ar.json`, build TypeScript casse (types stricts). CI valide cles cross-locale via `scripts/validate-i18n-keys.ts`. Toujours ajouter cle dans les 3 locales simultanement.

18. **Timeline icon mapping** : 8 types interactions (call, email, whatsapp, sms, meeting, note, task, status_change) -> 8 icones Lucide React (Phone, Mail, MessageCircle, Smartphone, Calendar, StickyNote, CheckSquare, GitBranch). Type union TS exhaustive check via `never` assert pour eviter oubli.

19. **Avatar fallback initials** : photo_url manquant -> afficher initiales `MA` (Mohamed Amine). Si nom arabe `محمد علي` -> initiales `م ع` ou `MA` transliteree ? Decision : afficher dans locale active (RTL `م ع`, LTR `MA`). Lib `arabic-name-transliterator` (custom Sprint 16) ou fallback `getInitials(name, locale)`.

20. **Tags multi-select large catalog** : un tenant peut avoir 200+ tags. Combobox Command shadcn avec virtualization (`cmdk` natif >100 items). Pre-charge top 50 tags les plus utilises via separate query, lazy load le reste a la recherche.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16

`task-4.3.5` est la **5e tache du Sprint 16** et la **premiere page CRUD metier riche** apres le bootstrap (4.3.1-4.3.4).

```
Sprint 16 -- Web Broker App (14 taches)

[4.3.1 App skeleton]
   |
[4.3.2 Pages Auth]
   |
[4.3.3 Layout principal]
   |
[4.3.4 Dashboard 6 widgets]
   |
[4.3.5 CONTACTS PAGE]  <-- TACHE COURANTE (premier CRUD riche)
   |
   +--> [4.3.6 Companies]   (copie pattern : table + filters + form dialog + detail)
   |
   +--> [4.3.7 Deals]       (kanban + table -- reutilise filters + form pattern)
   |
   +--> [4.3.8 Polices]     (table + detail multi-tabs -- reutilise pattern)
   |
   +--> [4.3.9 Broker Queue]
   |
[4.3.10 Sinistres] [4.3.11 Settings] [4.3.12 RBAC] [4.3.13 i18n] [4.3.14 E2E]
```

Sequence dans la semaine 1 du sprint :
- Jour 1 : 4.3.1, 4.3.2 (12h)
- Jour 2 : 4.3.3, 4.3.4 (11h)
- Jour 3 matin + apres-midi : **4.3.5 (7h) -- TACHE COURANTE**
- Jour 4 : 4.3.6 (5h) en copiant patron 4.3.5
- Jour 5 : 4.3.7 (6h)

### Position dans le programme

Cette tache fait partie de la **Phase 4 Vertical Insure** (Sprints 14-17). Apres 4.3.5 :
- Sprint 17 (Web Customer Portal) : SEO public, pas de contacts UI.
- Sprint 18 (Web Assure Portal) : assure connecte voit son propre profil (sous-ensemble de Contact UI).
- Sprint 22 (Garage App) : voit contacts assures associes a leurs claims (vue limitee).
- Sprint 27 (Reporting ACAPS) : exporte contacts pour declarations annuelles.

Le pattern DataTable + nuqs URL filters + form dialog Zod + optimistic mutations est **canonique** pour toutes les listes metier futures.

### Diagramme ASCII de la feature Contacts

```
apps/web-broker/
|
|-- src/app/[locale]/(protected)/contacts/
|   |
|   |-- page.tsx                              # Server Component initial fetch + DataTable client (L1)
|   |-- loading.tsx                           # Skeleton table 10 rows
|   |-- error.tsx                             # Error boundary contacts
|   |
|   |-- [id]/
|   |   |-- page.tsx                          # Server Component fetch contact + tabs (L2)
|   |   |-- loading.tsx                       # Skeleton detail
|   |   |-- not-found.tsx                     # Contact deleted/missing
|   |   |
|   |   |-- info/
|   |   |   |-- page.tsx                      # tab Info (sous-route App Router parallele optional)
|   |
|   |-- new/
|   |   |-- page.tsx                          # Alternative deep-link "?create=true"
|
|-- src/components/contacts/
|   |
|   |-- contacts-table.tsx                    # ~300 lignes columns TanStack Table (L3)
|   |-- contacts-filters.tsx                  # ~200 lignes nuqs URL state filters (L4)
|   |-- contact-form-dialog.tsx               # ~280 lignes rhf + Zod create/edit (L5)
|   |-- contact-timeline.tsx                  # ~220 lignes grouped by date + icones (L6)
|   |-- contact-bulk-actions.tsx              # ~150 lignes tag/assign/export/delete (L7)
|   |-- contact-card.tsx                      # ~100 lignes header detail (L8)
|   |-- contact-info-tab.tsx                  # ~150 lignes display fields + custom
|   |-- contact-deals-tab.tsx                 # ~120 lignes liste deals associes (L9)
|   |-- contact-polices-tab.tsx               # ~120 lignes liste polices Sprint 14 (L10)
|   |-- contact-documents-tab.tsx             # ~100 lignes liste documents Sprint 10 (L11)
|   |-- contact-communications-tab.tsx        # ~100 lignes liste communications Sprint 9
|   |-- contact-quick-actions.tsx             # ~150 lignes Send Message/Schedule/Create Deal (L12)
|   |-- contact-avatar.tsx                    # ~60 lignes Avatar fallback initials
|   |-- contact-segment-badge.tsx             # ~40 lignes Badge couleur par segment
|   |-- contact-tags-display.tsx              # ~60 lignes Badge list tags
|   |-- contact-tags-combobox.tsx             # ~180 lignes multi-select tags Combobox shadcn
|   |-- contact-custom-fields.tsx             # ~200 lignes dynamic fields rendering
|   |-- send-message-dialog.tsx               # ~150 lignes Dialog send WhatsApp/Email
|   |-- schedule-appointment-dialog.tsx       # ~150 lignes Dialog calendrier booking
|   |-- create-deal-from-contact-dialog.tsx   # ~120 lignes Dialog create Deal pre-fill
|   |-- delete-contact-dialog.tsx             # ~80 lignes confirmation soft delete
|   |-- export-contacts-dialog.tsx            # ~120 lignes options CSV + filters scope
|
|-- src/lib/queries/contacts.queries.ts       # ~300 lignes TanStack Query hooks (L13)
|-- src/lib/api/contacts.api.ts               # ~250 lignes Axios calls typed (L14)
|-- src/lib/schemas/contact.schema.ts         # ~200 lignes Zod schemas (L15)
|-- src/lib/utils/cin-ma-validator.ts         # ~120 lignes CIN MA validation strict (L16)
|-- src/lib/utils/phone-ma-formatter.ts       # ~80 lignes phone E.164 normalize
|-- src/lib/utils/cursor.ts                   # ~50 lignes encode/decode cursor base64
|-- src/lib/utils/contact-initials.ts         # ~40 lignes get initials fr/ar
|
|-- src/hooks/use-contacts-filters.ts         # ~80 lignes nuqs filters hook
|-- src/hooks/use-debounced-value.ts          # ~30 lignes debounce hook
|-- src/hooks/use-row-selection.ts            # ~100 lignes table row selection state
|
|-- src/messages/{fr,ar-MA,ar}.json           # +60 keys contacts.* namespace
|
|-- e2e/contacts/
|   |-- contacts-list.spec.ts                 # ~200 lignes 4 tests Playwright
|   |-- contacts-crud.spec.ts                 # ~250 lignes 4 tests Playwright
|   |-- contacts-bulk.spec.ts                 # ~180 lignes 2 tests Playwright
|   |-- contacts-detail.spec.ts               # ~200 lignes 2 tests Playwright
|
|-- src/components/contacts/__tests__/
|   |-- contacts-table.spec.tsx               # ~150 lignes Vitest 5 tests
|   |-- contact-form-dialog.spec.tsx          # ~180 lignes Vitest 4 tests
|   |-- contact-timeline.spec.tsx             # ~120 lignes Vitest 3 tests
|   |-- contact-bulk-actions.spec.tsx         # ~100 lignes Vitest 2 tests
|
|-- src/lib/__tests__/
|   |-- cin-ma-validator.spec.ts              # ~140 lignes Vitest 6 tests
|   |-- phone-ma-formatter.spec.ts            # ~80 lignes Vitest 4 tests
|   |-- contact-schema.spec.ts                # ~120 lignes Vitest 5 tests
```

Total : ~30 fichiers crees/modifies, ~4500 lignes nettes hors tests, ~1500 lignes tests.

---

## 4. Livrables checkables (28+ deliverables)

- [ ] **L1** : `apps/web-broker/src/app/[locale]/(protected)/contacts/page.tsx` Server Component (~150 lignes) avec `searchParams` typed via `createSearchParamsCache(nuqs)`, fetch initial contacts via `contactsApi.list(filters)` server-side, render `<ContactsPageClient initialData={...} />` qui hydrate TanStack Query. Inclus `<Suspense>` boundary autour de `<ContactsTable>`, `metadata` export pour SEO interne (`title: "Contacts | Skalean Broker"`), `revalidate = 0` (always fresh).

- [ ] **L2** : `apps/web-broker/src/app/[locale]/(protected)/contacts/[id]/page.tsx` Server Component (~220 lignes) avec `params: Promise<{ id: string, locale: string }>` (Next.js 15 async params), parallel fetch contact + counts (deals_count, policies_count, documents_count), tabs via `<Tabs defaultValue="info">` shadcn, fallback `notFound()` si 404. Inclus breadcrumb "Contacts / [Nom complet]".

- [ ] **L3** : `apps/web-broker/src/components/contacts/contacts-table.tsx` (~300 lignes) Client Component `'use client'` :
  - `useReactTable` config avec `columnDefs` exhaustifs : avatar+name (custom cell render), email (truncate + tooltip full), phone (formate E.164 lisible LTR force), company (link to company detail), segment (Badge colore), last_interaction (relative time + tooltip absolute), owner (Avatar + name), actions menu (Edit / Delete / View detail).
  - Server-side mode : `manualPagination`, `manualSorting`, `manualFiltering`.
  - Row selection multi via checkbox col 0.
  - Pagination cursor controls (Next / Previous) + count "1-50 sur 3247".
  - Sort dropdown (last_name, email, last_interaction_at, segment, created_at).
  - Empty state si 0 results + CTA "Ajouter contact".
  - Sticky header.

- [ ] **L4** : `apps/web-broker/src/components/contacts/contacts-filters.tsx` (~200 lignes) :
  - Search input avec debounce 300ms + icon Search Lucide + clear button.
  - Segment multi-chip select (lead / prospect / customer / vip) -- toggle chips, Badge style.
  - Tags multi-select Combobox shadcn (pre-load top 50, lazy on search).
  - Assigned_to Select (broker users du tenant via separate query).
  - Reset filters button.
  - URL state synced via `useQueryStates` nuqs (shallow update, no full reload).
  - Active filters count badge.

- [ ] **L5** : `apps/web-broker/src/components/contacts/contact-form-dialog.tsx` (~280 lignes) :
  - Modal Dialog responsive (Sheet bottom mobile, Dialog desktop).
  - react-hook-form `useForm({ resolver: zodResolver(ContactSchema) })`.
  - 14 fields + custom fields dynamiques.
  - Sections accordeon : Identite / Contact / Segmentation / Custom Fields / Adresse.
  - Submit : POST `/contacts` create ou PATCH `/contacts/:id` edit.
  - Loading state pendant submit + disabled buttons.
  - Toast success "Contact cree" / "Contact mis a jour".
  - Error mapping Zod -> field errors.
  - Consent banner CNDP Loi 09-08 sur create only.

- [ ] **L6** : `apps/web-broker/src/components/contacts/contact-timeline.tsx` (~220 lignes) :
  - Timeline verticale grouped by date (header sticky par jour).
  - 8 types interactions avec icones + couleurs : call (Phone, blue), email (Mail, indigo), whatsapp (MessageCircle, green), sms (Smartphone, cyan), meeting (Calendar, purple), note (StickyNote, yellow), task (CheckSquare, orange), status_change (GitBranch, gray).
  - Relative time + tooltip absolute (`Africa/Casablanca`).
  - Filter by type (multi-toggle chips).
  - Load more cursor pagination.
  - Empty state.
  - Expand/collapse note long content.

- [ ] **L7** : `apps/web-broker/src/components/contacts/contact-bulk-actions.tsx` (~150 lignes) :
  - Toolbar visible si selection > 0.
  - Buttons : Tag (apply tags multi), Assign (assign to broker_user), Export CSV (stream download), Delete soft.
  - Compteur "12 contacts selectionnes".
  - Confirmation dialog pour delete bulk.
  - Toast progress pour export (loading -> "Telechargement pret").

- [ ] **L8** : `apps/web-broker/src/components/contacts/contact-card.tsx` (~100 lignes) header detail page :
  - Avatar large (96x96 desktop, 64x64 mobile) avec photo_url ou initials fallback.
  - Nom complet (display_name + last_name).
  - Segment Badge.
  - Tags Badge list.
  - Quick stats : "X deals / Y polices / Z documents".
  - Action bar : Edit / Send Message / Schedule / Create Deal / More menu.

- [ ] **L9** : `apps/web-broker/src/components/contacts/contact-deals-tab.tsx` (~120 lignes) liste deals associes au contact (table simple stage + amount + close_date + status), bouton "Nouveau deal" pre-rempli contact_id.

- [ ] **L10** : `apps/web-broker/src/components/contacts/contact-polices-tab.tsx` (~120 lignes) liste polices souscrites (consume Sprint 14 endpoint), columns : policy_number / branche / start_date / end_date / status / prime_annuelle. Link vers `/polices/[id]`.

- [ ] **L11** : `apps/web-broker/src/components/contacts/contact-documents-tab.tsx` (~100 lignes) liste documents lies (CIN scan, justificatifs, KYC) -- consume Sprint 10. Icone par mime type + download button + preview modal pdf/image.

- [ ] **L12** : `apps/web-broker/src/components/contacts/contact-quick-actions.tsx` (~150 lignes) dropdown menu :
  - "Envoyer message" -> `<SendMessageDialog>` (canal WhatsApp/Email/SMS selon `preferred_channel`).
  - "Planifier RDV" -> `<ScheduleAppointmentDialog>` (consume Sprint 8 booking).
  - "Creer deal" -> `<CreateDealDialog>` pre-rempli contact_id.
  - "Generer devis" -> redirect `/quotes/new?contact_id=...`.
  - "Voir parcours" -> redirect `/customer-journey/[contact_id]` (Sprint 17+).

- [ ] **L13** : `apps/web-broker/src/lib/queries/contacts.queries.ts` (~300 lignes) TanStack Query hooks :
  - `useContactsList(filters, cursor)` queryKey `['contacts', filters, cursor]`.
  - `useContactDetail(id)` queryKey `['contact', id]`.
  - `useContactTimeline(id, cursor)` queryKey `['contact', id, 'timeline', cursor]` `infiniteQuery`.
  - `useCreateContact()` mutation avec onMutate optimistic + onError rollback + onSettled invalidate.
  - `useUpdateContact()` similaire.
  - `useDeleteContact()` mutation soft delete.
  - `useBulkAction()` mutation tag/assign/delete/export.
  - `useContactDeals(id)`, `useContactPolicies(id)`, `useContactDocuments(id)`.

- [ ] **L14** : `apps/web-broker/src/lib/api/contacts.api.ts` (~250 lignes) Axios calls typed :
  - `list(filters): Promise<{ items: Contact[], next_cursor: string | null, total_count: number }>`.
  - `detail(id): Promise<Contact>`.
  - `create(payload): Promise<Contact>`.
  - `update(id, payload): Promise<Contact>`.
  - `softDelete(id): Promise<void>`.
  - `bulkAction(payload): Promise<{ affected: number }>`.
  - `timeline(id, cursor): Promise<{ items: Interaction[], next_cursor: string | null }>`.
  - `exportCsv(filters): Promise<Blob>` (streamed).

- [ ] **L15** : `apps/web-broker/src/lib/schemas/contact.schema.ts` (~200 lignes) Zod schemas :
  - `ContactCoreSchema` : first_name, last_name, email, phone, cin, segment, tags.
  - `ContactPreferencesSchema` : preferred_language, preferred_channel.
  - `ContactAddressSchema` : street, city, region, postal_code, country (default `MA`).
  - `ContactSchema = merge` des 3 + custom_fields `z.record(z.any())`.
  - `CreateContactInputSchema` (consent_given required, photo_url optional).
  - `UpdateContactInputSchema` (partial).
  - Type inference `export type Contact = z.infer<typeof ContactSchema>`.

- [ ] **L16** : `apps/web-broker/src/lib/utils/cin-ma-validator.ts` (~120 lignes) :
  - `isValidCinMa(cin: string): boolean` -- pattern `/^[A-Z]{1,2}\d{1,7}$/i` + uppercase normalize.
  - `getCinPrefixRegion(cin: string): string | null` -- map prefixes (`A` = Rabat, `B` = Casablanca, `BE` = Casa anfa, etc.).
  - `maskCin(cin: string): string` -- masque "AA123456" -> "AA12****" pour logs.
  - `formatCin(cin: string): string` -- uppercase + trim.
  - Tests 6+ unitaires.

- [ ] **L17** : `apps/web-broker/src/lib/utils/phone-ma-formatter.ts` (~80 lignes) :
  - `normalizePhoneMa(raw: string): string` -- accepte `0612345678`, `+212612345678`, `212612345678` -> `+212612345678`.
  - `formatPhoneMaDisplay(phone: string): string` -- `+212 6 12 34 56 78`.
  - `isValidPhoneMa(phone: string): boolean` -- pattern `/^\+212[5-7]\d{8}$/`.
  - Tests 4+ unitaires.

- [ ] **L18** : `apps/web-broker/src/hooks/use-contacts-filters.ts` (~80 lignes) :
  - `useQueryStates({ search: parseAsString.withDefault(''), segments: parseAsArrayOf(parseAsString), tags: parseAsArrayOf(parseAsString), assigned_to: parseAsString, cursor: parseAsString, sort: parseAsString.withDefault('created_at:desc') }, { shallow: true })`.
  - Debounced search derived.
  - `resetFilters()` helper.

- [ ] **L19** : `apps/web-broker/src/components/contacts/send-message-dialog.tsx` (~150 lignes) :
  - Select canal (WhatsApp default si `preferred_channel`, fallback Email).
  - Template picker (Sprint 9 templates).
  - Body editor (textarea ou MJML preview email).
  - Send button -> POST `/communications/send`.

- [ ] **L20** : `apps/web-broker/src/components/contacts/schedule-appointment-dialog.tsx` (~150 lignes) :
  - Calendar shadcn `<Calendar>` pour date selection.
  - Time slots disponibles (consume Sprint 8 booking endpoint `/booking/availability`).
  - Notes textarea.
  - Submit -> POST `/booking/appointments`.

- [ ] **L21** : `apps/web-broker/src/components/contacts/contact-custom-fields.tsx` (~200 lignes) :
  - Lit `customFieldDefinitions` du tenant.
  - Render dynamique : text (Input), number (Input type=number), date (Calendar), select (Select), boolean (Switch), textarea, multiselect.
  - Zod schema build a la volee via `useMemo`.
  - Required + helper text + placeholder par definition.

- [ ] **L22** : `apps/web-broker/src/messages/fr.json` +60 keys namespace `contacts.*` : list / filters / form / timeline / bulk / detail / errors / validation.

- [ ] **L23** : `apps/web-broker/src/messages/ar-MA.json` +60 keys translation Darija.

- [ ] **L24** : `apps/web-broker/src/messages/ar.json` +60 keys translation arabe classique.

- [ ] **L25** : Tests Vitest 15+ : cin-ma-validator (6) + phone-formatter (4) + contact-schema (5) + contacts-table render (5) + form dialog validation (4) + timeline grouping (3) + bulk actions logic (2).

- [ ] **L26** : Tests Playwright 12+ : list+filters (3), search debounce (1), CRUD (4), bulk tag (1), bulk export (1), bulk delete (1), detail tabs (2), optimistic UI fail revert (1), Arabic search (1), pagination cursor (1).

- [ ] **L27** : Validation : `pnpm --filter @insurtech/web-broker dev` page `/contacts` charge < 1s, table render < 500ms, search input lag < 50ms, CIN validation feedback < 100ms.

- [ ] **L28** : Sentry config scrub PII : `beforeSend` filter `cin`, `email`, `phone`, `cnss` -> `[REDACTED]`. Test integration.

- [ ] **L29** : Documentation inline JSDoc tous hooks + utils + composants exports.

- [ ] **L30** : RBAC UI : si `!hasPermission('crm.contacts.delete')` -> bouton delete masque ET button menu item disabled. Verify backend rejette aussi.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
apps/web-broker/
  src/app/[locale]/(protected)/contacts/
    page.tsx                                         # ~150 lignes -- L1
    loading.tsx                                      # ~30 lignes
    error.tsx                                        # ~40 lignes
    [id]/
      page.tsx                                       # ~220 lignes -- L2
      loading.tsx                                    # ~30 lignes
      not-found.tsx                                  # ~25 lignes

  src/components/contacts/
    contacts-table.tsx                               # ~300 lignes -- L3
    contacts-filters.tsx                             # ~200 lignes -- L4
    contact-form-dialog.tsx                          # ~280 lignes -- L5
    contact-timeline.tsx                             # ~220 lignes -- L6
    contact-bulk-actions.tsx                         # ~150 lignes -- L7
    contact-card.tsx                                 # ~100 lignes -- L8
    contact-info-tab.tsx                             # ~150 lignes
    contact-deals-tab.tsx                            # ~120 lignes -- L9
    contact-polices-tab.tsx                          # ~120 lignes -- L10
    contact-documents-tab.tsx                        # ~100 lignes -- L11
    contact-communications-tab.tsx                   # ~100 lignes
    contact-quick-actions.tsx                        # ~150 lignes -- L12
    contact-avatar.tsx                               # ~60 lignes
    contact-segment-badge.tsx                        # ~40 lignes
    contact-tags-display.tsx                         # ~60 lignes
    contact-tags-combobox.tsx                        # ~180 lignes
    contact-custom-fields.tsx                        # ~200 lignes -- L21
    send-message-dialog.tsx                          # ~150 lignes -- L19
    schedule-appointment-dialog.tsx                  # ~150 lignes -- L20
    create-deal-from-contact-dialog.tsx              # ~120 lignes
    delete-contact-dialog.tsx                        # ~80 lignes
    export-contacts-dialog.tsx                       # ~120 lignes
    consent-cnpd-checkbox.tsx                        # ~60 lignes
    bulk-tag-dialog.tsx                              # ~120 lignes
    bulk-assign-dialog.tsx                           # ~100 lignes

  src/lib/queries/
    contacts.queries.ts                              # ~300 lignes -- L13

  src/lib/api/
    contacts.api.ts                                  # ~250 lignes -- L14

  src/lib/schemas/
    contact.schema.ts                                # ~200 lignes -- L15

  src/lib/utils/
    cin-ma-validator.ts                              # ~120 lignes -- L16
    phone-ma-formatter.ts                            # ~80 lignes -- L17
    cursor.ts                                        # ~50 lignes
    contact-initials.ts                              # ~40 lignes
    interaction-icon-map.ts                          # ~50 lignes

  src/hooks/
    use-contacts-filters.ts                          # ~80 lignes -- L18
    use-debounced-value.ts                           # ~30 lignes
    use-row-selection.ts                             # ~100 lignes
    use-media-query.ts                               # ~30 lignes

  src/messages/
    fr.json                                          # +60 keys -- L22
    ar-MA.json                                       # +60 keys -- L23
    ar.json                                          # +60 keys -- L24

  e2e/contacts/
    contacts-list.spec.ts                            # ~200 lignes
    contacts-crud.spec.ts                            # ~250 lignes
    contacts-bulk.spec.ts                            # ~180 lignes
    contacts-detail.spec.ts                          # ~200 lignes

  src/components/contacts/__tests__/
    contacts-table.spec.tsx                          # ~150 lignes
    contact-form-dialog.spec.tsx                     # ~180 lignes
    contact-timeline.spec.tsx                        # ~120 lignes
    contact-bulk-actions.spec.tsx                    # ~100 lignes

  src/lib/__tests__/
    cin-ma-validator.spec.ts                         # ~140 lignes
    phone-ma-formatter.spec.ts                       # ~80 lignes
    contact-schema.spec.ts                           # ~120 lignes
```

Total : ~50 fichiers, ~4500 lignes nettes, ~1500 lignes tests.

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `apps/web-broker/src/lib/schemas/contact.schema.ts` (~200 lignes)

```typescript
/**
 * Zod schemas pour Contact CRM -- Sprint 16 web-broker.
 *
 * Strategie :
 *  - Compose ContactSchema depuis sous-schemas (Core, Preferences, Address)
 *  - Inference type TS automatique
 *  - Reuse cote backend (packages/shared-types/contact.schema.ts) -- single source of truth
 *  - Validation CIN MA pattern strict + telephone E.164 MA + email RFC 5322
 *  - Consent CNDP Loi 09-08 required pour create
 *
 * Reference decision-011 (CNDP) + decision-009 (multilinguisme).
 */
import { z } from 'zod';

// =====================================================================
// CONSTANTES METIER
// =====================================================================

export const CONTACT_SEGMENTS = ['lead', 'prospect', 'customer', 'vip'] as const;
export const CONTACT_PREFERRED_CHANNELS = ['email', 'whatsapp', 'sms', 'phone', 'in_person'] as const;
export const CONTACT_PREFERRED_LANGUAGES = ['fr', 'ar-MA', 'ar', 'en'] as const;
export const CONTACT_CONSENT_SOURCES = ['verbal', 'written', 'online_form', 'imported_legacy'] as const;

// CIN Maroc : 1-2 lettres majuscules + 1-7 chiffres (e.g. AA123456, BE9999999)
export const CIN_MA_PATTERN = /^[A-Z]{1,2}\d{1,7}$/;

// Telephone Maroc E.164 : +212 + (5/6/7 mobile) + 8 chiffres
export const PHONE_MA_PATTERN = /^\+212[5-7]\d{8}$/;

// Email RFC 5322 simplifie (max 255 chars)
export const EMAIL_MAX_LENGTH = 255;

// ICE Maroc (Identifiant Commun de l'Entreprise) -- pour companies tab "company" link
export const ICE_PATTERN = /^\d{15}$/;

// =====================================================================
// SOUS-SCHEMAS
// =====================================================================

export const ContactSegmentSchema = z.enum(CONTACT_SEGMENTS);
export type ContactSegment = z.infer<typeof ContactSegmentSchema>;

export const ContactPreferredChannelSchema = z.enum(CONTACT_PREFERRED_CHANNELS);
export type ContactPreferredChannel = z.infer<typeof ContactPreferredChannelSchema>;

export const ContactPreferredLanguageSchema = z.enum(CONTACT_PREFERRED_LANGUAGES);
export type ContactPreferredLanguage = z.infer<typeof ContactPreferredLanguageSchema>;

export const ContactConsentSourceSchema = z.enum(CONTACT_CONSENT_SOURCES);
export type ContactConsentSource = z.infer<typeof ContactConsentSourceSchema>;

// =====================================================================
// CORE FIELDS
// =====================================================================

export const ContactCoreSchema = z.object({
  first_name: z
    .string()
    .min(1, 'errors.contacts.firstName.required')
    .max(100, 'errors.contacts.firstName.max')
    .trim(),
  last_name: z
    .string()
    .min(1, 'errors.contacts.lastName.required')
    .max(100, 'errors.contacts.lastName.max')
    .trim(),
  email: z
    .string()
    .email('errors.contacts.email.invalid')
    .max(EMAIL_MAX_LENGTH, 'errors.contacts.email.max')
    .toLowerCase()
    .trim()
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .transform((val) => {
      // Auto-correct local format to E.164
      const cleaned = val.replace(/\s+/g, '').replace(/[-.()]/g, '');
      if (cleaned.startsWith('0')) return '+212' + cleaned.slice(1);
      if (cleaned.startsWith('212') && !cleaned.startsWith('+')) return '+' + cleaned;
      return cleaned;
    })
    .refine((val) => val === '' || PHONE_MA_PATTERN.test(val), {
      message: 'errors.contacts.phone.invalid',
    })
    .optional()
    .or(z.literal('')),
  cin: z
    .string()
    .transform((val) => val.toUpperCase().replace(/\s+/g, '').trim())
    .refine((val) => val === '' || CIN_MA_PATTERN.test(val), {
      message: 'errors.contacts.cin.invalid',
    })
    .optional()
    .or(z.literal('')),
  segment: ContactSegmentSchema.default('lead'),
  tags: z.array(z.string().min(1).max(50)).max(20, 'errors.contacts.tags.maxCount').default([]),
  birthday: z.string().date().optional().or(z.literal('')),
  photo_url: z
    .string()
    .url('errors.contacts.photo.invalidUrl')
    .max(2048)
    .optional()
    .or(z.literal('')),
  company_id: z.string().uuid().optional().nullable(),
});

export type ContactCore = z.infer<typeof ContactCoreSchema>;

// =====================================================================
// PREFERENCES
// =====================================================================

export const ContactPreferencesSchema = z.object({
  preferred_language: ContactPreferredLanguageSchema.default('fr'),
  preferred_channel: ContactPreferredChannelSchema.default('email'),
  marketing_consent: z.boolean().default(false),
  transactional_consent: z.boolean().default(true), // requis pour notifications police
});

export type ContactPreferences = z.infer<typeof ContactPreferencesSchema>;

// =====================================================================
// ADRESSE MA
// =====================================================================

export const ContactAddressSchema = z.object({
  street: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  region: z
    .enum([
      'tanger-tetouan-al-hoceima',
      'oriental',
      'fes-meknes',
      'rabat-sale-kenitra',
      'beni-mellal-khenifra',
      'casablanca-settat',
      'marrakech-safi',
      'draa-tafilalet',
      'souss-massa',
      'guelmim-oued-noun',
      'laayoune-sakia-el-hamra',
      'dakhla-oued-ed-dahab',
    ])
    .optional()
    .nullable(),
  postal_code: z
    .string()
    .regex(/^\d{5}$/, 'errors.contacts.postalCode.invalid')
    .optional()
    .or(z.literal('')),
  country: z.string().length(2).default('MA'),
});

export type ContactAddress = z.infer<typeof ContactAddressSchema>;

// =====================================================================
// CONTACT COMPLET (merge)
// =====================================================================

export const ContactSchema = ContactCoreSchema.merge(ContactPreferencesSchema)
  .merge(ContactAddressSchema)
  .extend({
    id: z.string().uuid(),
    tenant_id: z.string().uuid(),
    owner_id: z.string().uuid().nullable(),
    custom_fields: z.record(z.any()).default({}),
    consent_given_at: z.string().datetime().nullable(),
    consent_source: ContactConsentSourceSchema.nullable(),
    last_interaction_at: z.string().datetime().nullable(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable(),
  });

export type Contact = z.infer<typeof ContactSchema>;

// =====================================================================
// INPUT CREATE (sans IDs auto + consent required)
// =====================================================================

export const CreateContactInputSchema = ContactCoreSchema.merge(ContactPreferencesSchema)
  .merge(ContactAddressSchema)
  .extend({
    custom_fields: z.record(z.any()).default({}),
    consent_given: z
      .boolean()
      .refine((val) => val === true, {
        message: 'errors.contacts.consent.required',
      }),
    consent_source: ContactConsentSourceSchema,
    owner_id: z.string().uuid().optional().nullable(),
  });

export type CreateContactInput = z.infer<typeof CreateContactInputSchema>;

// =====================================================================
// INPUT UPDATE (partial)
// =====================================================================

export const UpdateContactInputSchema = ContactCoreSchema.merge(ContactPreferencesSchema)
  .merge(ContactAddressSchema)
  .partial()
  .extend({
    custom_fields: z.record(z.any()).optional(),
  });

export type UpdateContactInput = z.infer<typeof UpdateContactInputSchema>;

// =====================================================================
// FILTERS LIST
// =====================================================================

export const ContactsListFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  segments: z.array(ContactSegmentSchema).optional(),
  tags: z.array(z.string()).optional(),
  assigned_to: z.string().uuid().optional(),
  has_email: z.boolean().optional(),
  has_phone: z.boolean().optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
  sort: z
    .enum([
      'created_at:desc',
      'created_at:asc',
      'last_name:asc',
      'last_name:desc',
      'last_interaction_at:desc',
      'segment:asc',
    ])
    .default('created_at:desc'),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export type ContactsListFilters = z.infer<typeof ContactsListFiltersSchema>;

// =====================================================================
// BULK ACTION
// =====================================================================

export const BulkActionPayloadSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('tag'),
    contact_ids: z.array(z.string().uuid()).min(1).max(5000),
    tags_to_add: z.array(z.string().min(1).max(50)).min(1),
    tags_to_remove: z.array(z.string()).optional().default([]),
  }),
  z.object({
    action: z.literal('assign'),
    contact_ids: z.array(z.string().uuid()).min(1).max(5000),
    owner_id: z.string().uuid(),
  }),
  z.object({
    action: z.literal('delete'),
    contact_ids: z.array(z.string().uuid()).min(1).max(5000),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('export'),
    contact_ids: z.array(z.string().uuid()).optional(),
    select_all_matching_filters: z.boolean().optional(),
    filters: ContactsListFiltersSchema.optional(),
    columns: z.array(z.string()).optional(),
    excel_compatible: z.boolean().default(true),
  }),
]);

export type BulkActionPayload = z.infer<typeof BulkActionPayloadSchema>;
```

---

### 6.2 `apps/web-broker/src/lib/utils/cin-ma-validator.ts` (~120 lignes)

```typescript
/**
 * CIN Marocain (Carte d'Identite Nationale) -- utilities validation et formatage.
 *
 * Reference :
 *  - Decision-011 : CNDP Loi 09-08 -- CIN classified PII, masquage logs
 *  - Pattern officiel : 1-2 lettres prefix region + 1-7 chiffres
 *  - Prefixes connus (non exhaustif, opaques ACAPS) :
 *      A   = Rabat / Sale
 *      B   = Casablanca (anciens)
 *      BB  = Mohammedia
 *      BE  = Casablanca Anfa
 *      BH  = Ben Slimane
 *      C   = Fes
 *      D   = Meknes
 *      E   = El Jadida
 *      F   = Marrakech
 *      G   = Beni Mellal
 *      H   = Agadir / Inezgane
 *      I   = Ouarzazate
 *      J   = Tan Tan
 *      K   = Tanger
 *      L   = Tetouan
 *      M   = Nador
 *      N   = Oujda
 *      P   = Larache
 *      Q   = Ksar El Kebir
 *      R   = Khemisset
 *      S   = Kenitra
 *      T   = Errachidia
 *      U   = Settat
 *      V   = Khouribga
 *      W   = Safi
 *      X   = Khenifra
 *      Y   = Berkane
 *      Z   = Taroudant
 *      ZG  = Guelmim
 *      ZH  = Laayoune
 *      ZT  = Smara
 */

export const CIN_MA_PATTERN = /^[A-Z]{1,2}\d{1,7}$/;

const CIN_PREFIX_TO_REGION: Record<string, string> = {
  A: 'Rabat / Sale',
  B: 'Casablanca',
  BB: 'Mohammedia',
  BE: 'Casablanca Anfa',
  BH: 'Ben Slimane',
  C: 'Fes',
  D: 'Meknes',
  E: 'El Jadida',
  F: 'Marrakech',
  G: 'Beni Mellal',
  H: 'Agadir / Inezgane',
  I: 'Ouarzazate',
  J: 'Tan Tan',
  K: 'Tanger',
  L: 'Tetouan',
  M: 'Nador',
  N: 'Oujda',
  P: 'Larache',
  Q: 'Ksar El Kebir',
  R: 'Khemisset',
  S: 'Kenitra',
  T: 'Errachidia',
  U: 'Settat',
  V: 'Khouribga',
  W: 'Safi',
  X: 'Khenifra',
  Y: 'Berkane',
  Z: 'Taroudant',
  ZG: 'Guelmim',
  ZH: 'Laayoune',
  ZT: 'Smara',
};

/**
 * Normalise un CIN : uppercase + strip whitespace + trim.
 */
export function normalizeCin(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '').trim();
}

/**
 * Valide un CIN MA strict (1-2 lettres + 1-7 chiffres).
 *
 * @example
 *   isValidCinMa('AA123456')  // true
 *   isValidCinMa('aa123456')  // true (case-insensitive via normalize)
 *   isValidCinMa('A1234567')  // true
 *   isValidCinMa('123456')    // false (manque prefix)
 *   isValidCinMa('ABC123456') // false (3 lettres)
 */
export function isValidCinMa(raw: string): boolean {
  if (!raw) return false;
  const normalized = normalizeCin(raw);
  return CIN_MA_PATTERN.test(normalized);
}

/**
 * Extrait le prefix lettre du CIN.
 *
 * @example
 *   extractCinPrefix('AA123456') // 'AA'
 *   extractCinPrefix('A123456')  // 'A'
 *   extractCinPrefix('123456')   // null
 */
export function extractCinPrefix(raw: string): string | null {
  const normalized = normalizeCin(raw);
  const match = normalized.match(/^([A-Z]{1,2})/);
  return match ? match[1] : null;
}

/**
 * Retourne la region associee au prefix CIN, ou null si inconnu.
 *
 * @example
 *   getCinPrefixRegion('AA123456') // null (prefix AA inconnu)
 *   getCinPrefixRegion('A123456')  // 'Rabat / Sale'
 *   getCinPrefixRegion('BE99999')  // 'Casablanca Anfa'
 */
export function getCinPrefixRegion(raw: string): string | null {
  const prefix = extractCinPrefix(raw);
  if (!prefix) return null;
  return CIN_PREFIX_TO_REGION[prefix] ?? null;
}

/**
 * Masque un CIN pour usage logs / Sentry / URL.
 *
 * @example
 *   maskCin('AA123456') // 'AA12****'
 *   maskCin('A99')      // 'A9**'
 */
export function maskCin(raw: string): string {
  const normalized = normalizeCin(raw);
  if (normalized.length <= 4) return normalized.slice(0, 2) + '**';
  const prefix = normalized.match(/^[A-Z]{1,2}/)?.[0] ?? '';
  const digits = normalized.slice(prefix.length);
  const visibleDigits = digits.slice(0, 2);
  const hiddenCount = digits.length - 2;
  return prefix + visibleDigits + '*'.repeat(hiddenCount);
}

/**
 * Format CIN pour display (uppercase, no whitespace).
 */
export function formatCin(raw: string): string {
  return normalizeCin(raw);
}

/**
 * Hash SHA-256 du CIN (pour audit log sans exposer PII).
 * Note : utilise WebCrypto API browser ; cote serveur utiliser node:crypto.
 */
export async function hashCinSha256(raw: string): Promise<string> {
  const normalized = normalizeCin(raw);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

---

### 6.3 `apps/web-broker/src/lib/utils/phone-ma-formatter.ts` (~80 lignes)

```typescript
/**
 * Telephone Marocain -- normalize + format display + validate.
 *
 * Format E.164 MA : +212 (5|6|7) XXXXXXXX
 *  - 5 : fixe (lignes commerciales modernes)
 *  - 6 : mobile (operateurs historiques)
 *  - 7 : mobile (operateurs recents Inwi etc.)
 */

export const PHONE_MA_PATTERN = /^\+212[5-7]\d{8}$/;
export const PHONE_MA_LOCAL_PATTERN = /^0[5-7]\d{8}$/;

/**
 * Normalise un numero MA en E.164.
 *
 * @example
 *   normalizePhoneMa('0612345678')      // '+212612345678'
 *   normalizePhoneMa('+212612345678')   // '+212612345678'
 *   normalizePhoneMa('212612345678')    // '+212612345678'
 *   normalizePhoneMa('06 12 34 56 78')  // '+212612345678'
 *   normalizePhoneMa('06-12-34-56-78')  // '+212612345678'
 *   normalizePhoneMa('(0)612345678')    // '+212612345678'
 */
export function normalizePhoneMa(raw: string): string {
  if (!raw) return '';
  const cleaned = raw.replace(/[\s\-.()]/g, '');

  if (cleaned.startsWith('+212')) return cleaned;
  if (cleaned.startsWith('212')) return '+' + cleaned;
  if (cleaned.startsWith('00212')) return '+' + cleaned.slice(2);
  if (cleaned.startsWith('0')) return '+212' + cleaned.slice(1);
  // Fallback : prefix sans 0
  if (/^[5-7]\d{8}$/.test(cleaned)) return '+212' + cleaned;

  return cleaned; // laisse passer pour rejet validate
}

/**
 * Valide un numero MA en E.164.
 *
 * @example
 *   isValidPhoneMa('+212612345678')  // true
 *   isValidPhoneMa('0612345678')     // false (pas E.164)
 *   isValidPhoneMa('+212812345678')  // false (prefix 8 invalide)
 */
export function isValidPhoneMa(phone: string): boolean {
  if (!phone) return false;
  return PHONE_MA_PATTERN.test(phone);
}

/**
 * Formate pour affichage user-friendly.
 *
 * @example
 *   formatPhoneMaDisplay('+212612345678') // '+212 6 12 34 56 78'
 */
export function formatPhoneMaDisplay(phone: string): string {
  if (!isValidPhoneMa(phone)) return phone;
  const digits = phone.slice(4); // strip '+212'
  // 6 12 34 56 78
  return `+212 ${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
}

/**
 * Format href tel: pour click-to-call.
 */
export function formatPhoneTelHref(phone: string): string {
  return `tel:${phone}`;
}

/**
 * Format href wa.me pour WhatsApp deep link.
 */
export function formatPhoneWhatsappHref(phone: string, prefilledMessage?: string): string {
  const cleaned = phone.replace(/[\s+]/g, '');
  const msg = prefilledMessage ? `?text=${encodeURIComponent(prefilledMessage)}` : '';
  return `https://wa.me/${cleaned}${msg}`;
}

/**
 * Detecte le type operateur (heuristique simple).
 */
export function detectPhoneOperator(phone: string): 'maroc_telecom' | 'orange' | 'inwi' | 'unknown' {
  if (!isValidPhoneMa(phone)) return 'unknown';
  const localDigits = phone.slice(4);
  const firstTwo = localDigits.slice(0, 2);
  // Plages indicatives (non exhaustives, peuvent evoluer)
  if (['61', '62', '63', '67'].includes(firstTwo)) return 'maroc_telecom';
  if (['64', '65', '66'].includes(firstTwo)) return 'orange';
  if (['70', '76', '77'].includes(firstTwo)) return 'inwi';
  return 'unknown';
}
```

---

### 6.4 `apps/web-broker/src/lib/api/contacts.api.ts` (~250 lignes)

```typescript
/**
 * Contacts API client -- consume backend Sprint 8 CRM endpoints.
 *
 * Endpoints documentes :
 *  GET     /api/v1/crm/contacts                  -- list cursor pagination + filters
 *  GET     /api/v1/crm/contacts/:id              -- detail single
 *  POST    /api/v1/crm/contacts                  -- create
 *  PATCH   /api/v1/crm/contacts/:id              -- update (partial)
 *  DELETE  /api/v1/crm/contacts/:id              -- soft delete
 *  POST    /api/v1/crm/contacts/bulk-action      -- bulk tag/assign/export/delete
 *  GET     /api/v1/crm/contacts/:id/timeline     -- interactions chronological
 *  GET     /api/v1/crm/contacts/:id/deals        -- deals associes
 *  GET     /api/v1/crm/contacts/:id/policies     -- polices souscrites (Sprint 14)
 *  GET     /api/v1/crm/contacts/:id/documents    -- documents lies (Sprint 10)
 *  GET     /api/v1/crm/contacts/:id/communications -- communications history (Sprint 9)
 *
 * Headers injectes automatiquement par interceptor api-client.ts (Sprint 4) :
 *  - Authorization: Bearer ${token}
 *  - x-tenant-id: ${currentTenantId}
 *  - x-trace-id: ${crypto.randomUUID()}
 *  - Idempotency-Key: ${uuid} (POST/PATCH/DELETE only)
 *  - Accept-Language: ${locale}
 */
import { apiClient } from '@/lib/api-client';
import type {
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ContactsListFilters,
  BulkActionPayload,
} from '@/lib/schemas/contact.schema';

// =====================================================================
// TYPES RESPONSE
// =====================================================================

export interface CursorPaginatedResponse<T> {
  items: T[];
  next_cursor: string | null;
  total_count: number;
  has_more: boolean;
}

export interface Interaction {
  id: string;
  type: 'call' | 'email' | 'whatsapp' | 'sms' | 'meeting' | 'note' | 'task' | 'status_change';
  occurred_at: string;
  actor_id: string;
  actor_name: string;
  actor_avatar_url: string | null;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  outbound: boolean;
  duration_seconds: number | null;
  attachments: Array<{ id: string; filename: string; size_bytes: number; mime: string }>;
}

export interface ContactDealSummary {
  id: string;
  title: string;
  stage: string;
  amount_cents: number;
  currency: string;
  expected_close_date: string | null;
  status: 'open' | 'won' | 'lost';
  created_at: string;
}

export interface ContactPolicySummary {
  id: string;
  policy_number: string;
  branche: 'auto' | 'sante' | 'multirisque_habitation' | 'rc_pro' | 'vie' | 'voyage' | 'other';
  start_date: string;
  end_date: string;
  status: 'active' | 'suspended' | 'cancelled' | 'expired' | 'pending_renewal';
  prime_annuelle_cents: number;
  currency: 'MAD';
}

export interface ContactDocumentSummary {
  id: string;
  filename: string;
  mime: string;
  size_bytes: number;
  category: 'cin_scan' | 'kyc' | 'policy_pdf' | 'invoice' | 'other';
  uploaded_at: string;
  uploaded_by: string;
  download_url: string;
}

export interface ContactCommunicationSummary {
  id: string;
  channel: 'email' | 'whatsapp' | 'sms';
  direction: 'outbound' | 'inbound';
  subject: string | null;
  preview: string;
  sent_at: string;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
}

// =====================================================================
// API CALLS
// =====================================================================

export const contactsApi = {
  /**
   * Liste paginee curseur des contacts.
   * Renvoie 50 par defaut, max 200 par requete.
   */
  async list(filters: ContactsListFilters): Promise<CursorPaginatedResponse<Contact>> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.segments?.length) params.set('segments', filters.segments.join(','));
    if (filters.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
    if (filters.has_email != null) params.set('has_email', String(filters.has_email));
    if (filters.has_phone != null) params.set('has_phone', String(filters.has_phone));
    if (filters.created_after) params.set('created_after', filters.created_after);
    if (filters.created_before) params.set('created_before', filters.created_before);
    if (filters.sort) params.set('sort', filters.sort);
    if (filters.cursor) params.set('cursor', filters.cursor);
    params.set('limit', String(filters.limit ?? 50));

    const { data } = await apiClient.get<CursorPaginatedResponse<Contact>>(
      `/api/v1/crm/contacts?${params.toString()}`,
    );
    return data;
  },

  /**
   * Detail d'un contact par UUID.
   */
  async detail(id: string): Promise<Contact> {
    const { data } = await apiClient.get<Contact>(`/api/v1/crm/contacts/${id}`);
    return data;
  },

  /**
   * Cree un nouveau contact.
   * Le backend retourne le contact avec id + timestamps.
   */
  async create(input: CreateContactInput): Promise<Contact> {
    const { data } = await apiClient.post<Contact>(`/api/v1/crm/contacts`, input);
    return data;
  },

  /**
   * Met a jour partiellement un contact.
   */
  async update(id: string, input: UpdateContactInput): Promise<Contact> {
    const { data } = await apiClient.patch<Contact>(`/api/v1/crm/contacts/${id}`, input);
    return data;
  },

  /**
   * Soft delete : flag deleted_at = now().
   * Backend conserve 5 ans pour audit ACAPS puis hard delete batch.
   */
  async softDelete(id: string, reason?: string): Promise<void> {
    await apiClient.delete(`/api/v1/crm/contacts/${id}`, {
      data: reason ? { reason } : undefined,
    });
  },

  /**
   * Bulk action sur N contacts (jusqu'a 5000 par requete).
   */
  async bulkAction(payload: BulkActionPayload): Promise<{ affected: number; failed: number; export_download_url?: string }> {
    const { data } = await apiClient.post(`/api/v1/crm/contacts/bulk-action`, payload);
    return data;
  },

  /**
   * Export CSV stream (Server-Sent ou direct download).
   */
  async exportCsv(filters: ContactsListFilters, excelCompatible = true): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.segments?.length) params.set('segments', filters.segments.join(','));
    if (filters.tags?.length) params.set('tags', filters.tags.join(','));
    if (filters.assigned_to) params.set('assigned_to', filters.assigned_to);
    params.set('excel', String(excelCompatible));

    const response = await apiClient.get(`/api/v1/crm/contacts/export?${params.toString()}`, {
      responseType: 'blob',
    });
    return response.data as Blob;
  },

  /**
   * Timeline interactions cursor pagination.
   */
  async timeline(id: string, cursor?: string, limit = 50): Promise<CursorPaginatedResponse<Interaction>> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    params.set('limit', String(limit));
    const { data } = await apiClient.get<CursorPaginatedResponse<Interaction>>(
      `/api/v1/crm/contacts/${id}/timeline?${params.toString()}`,
    );
    return data;
  },

  /**
   * Deals associes a un contact.
   */
  async deals(id: string): Promise<ContactDealSummary[]> {
    const { data } = await apiClient.get<{ items: ContactDealSummary[] }>(
      `/api/v1/crm/contacts/${id}/deals`,
    );
    return data.items;
  },

  /**
   * Polices souscrites par un contact (consume Sprint 14).
   */
  async policies(id: string): Promise<ContactPolicySummary[]> {
    const { data } = await apiClient.get<{ items: ContactPolicySummary[] }>(
      `/api/v1/crm/contacts/${id}/policies`,
    );
    return data.items;
  },

  /**
   * Documents lies (KYC, CIN scan) -- consume Sprint 10.
   */
  async documents(id: string): Promise<ContactDocumentSummary[]> {
    const { data } = await apiClient.get<{ items: ContactDocumentSummary[] }>(
      `/api/v1/crm/contacts/${id}/documents`,
    );
    return data.items;
  },

  /**
   * Communications history (Sprint 9).
   */
  async communications(id: string, cursor?: string): Promise<CursorPaginatedResponse<ContactCommunicationSummary>> {
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    const { data } = await apiClient.get<CursorPaginatedResponse<ContactCommunicationSummary>>(
      `/api/v1/crm/contacts/${id}/communications?${params.toString()}`,
    );
    return data;
  },

  /**
   * Upload photo contact (multipart, max 5MB cote front).
   */
  async uploadPhoto(id: string, file: File): Promise<{ photo_url: string }> {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Photo trop lourde (max 5MB)');
    }
    const formData = new FormData();
    formData.append('photo', file);
    const { data } = await apiClient.post<{ photo_url: string }>(
      `/api/v1/crm/contacts/${id}/photo`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  /**
   * Restore soft-deleted contact (apres delete dans les 30 jours).
   */
  async restore(id: string): Promise<Contact> {
    const { data } = await apiClient.post<Contact>(`/api/v1/crm/contacts/${id}/restore`);
    return data;
  },
};
```

---

### 6.5 `apps/web-broker/src/lib/queries/contacts.queries.ts` (~300 lignes)

```typescript
/**
 * TanStack Query 5 hooks pour Contacts CRM.
 *
 * Patterns appliques :
 *  - Cursor pagination via standard useQuery (pas useInfiniteQuery pour table -- cursor next/prev simple)
 *  - useInfiniteQuery pour timeline (scroll continue load more)
 *  - Optimistic mutations avec onMutate / onError / onSettled
 *  - queryKey hierarchique pour invalidation ciblee
 *  - staleTime 30s liste, 60s detail
 */
'use client';

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { contactsApi, type CursorPaginatedResponse, type Interaction } from '@/lib/api/contacts.api';
import type {
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ContactsListFilters,
  BulkActionPayload,
} from '@/lib/schemas/contact.schema';

// =====================================================================
// QUERY KEYS (hierarchical)
// =====================================================================

export const contactQueryKeys = {
  all: ['contacts'] as const,
  lists: () => [...contactQueryKeys.all, 'list'] as const,
  list: (filters: ContactsListFilters) => [...contactQueryKeys.lists(), filters] as const,
  details: () => [...contactQueryKeys.all, 'detail'] as const,
  detail: (id: string) => [...contactQueryKeys.details(), id] as const,
  timeline: (id: string) => [...contactQueryKeys.detail(id), 'timeline'] as const,
  deals: (id: string) => [...contactQueryKeys.detail(id), 'deals'] as const,
  policies: (id: string) => [...contactQueryKeys.detail(id), 'policies'] as const,
  documents: (id: string) => [...contactQueryKeys.detail(id), 'documents'] as const,
  communications: (id: string) => [...contactQueryKeys.detail(id), 'communications'] as const,
};

// =====================================================================
// LIST
// =====================================================================

export function useContactsList(filters: ContactsListFilters) {
  return useQuery({
    queryKey: contactQueryKeys.list(filters),
    queryFn: ({ signal }) => contactsApi.list(filters),
    staleTime: 30_000,
    gcTime: 300_000,
    placeholderData: keepPreviousData, // garde ancien data pendant filtre change
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) return false;
      return failureCount < 3;
    },
  });
}

// =====================================================================
// DETAIL
// =====================================================================

export function useContactDetail(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: contactQueryKeys.detail(id),
    queryFn: () => contactsApi.detail(id),
    staleTime: 60_000,
    gcTime: 600_000,
    enabled: options?.enabled !== false && Boolean(id),
  });
}

// =====================================================================
// TIMELINE (infinite)
// =====================================================================

export function useContactTimeline(id: string) {
  return useInfiniteQuery({
    queryKey: contactQueryKeys.timeline(id),
    queryFn: ({ pageParam }) => contactsApi.timeline(id, pageParam, 50),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    staleTime: 30_000,
    gcTime: 300_000,
    enabled: Boolean(id),
  });
}

// =====================================================================
// DEALS / POLICIES / DOCUMENTS / COMMUNICATIONS
// =====================================================================

export function useContactDeals(id: string) {
  return useQuery({
    queryKey: contactQueryKeys.deals(id),
    queryFn: () => contactsApi.deals(id),
    staleTime: 60_000,
  });
}

export function useContactPolicies(id: string) {
  return useQuery({
    queryKey: contactQueryKeys.policies(id),
    queryFn: () => contactsApi.policies(id),
    staleTime: 60_000,
  });
}

export function useContactDocuments(id: string) {
  return useQuery({
    queryKey: contactQueryKeys.documents(id),
    queryFn: () => contactsApi.documents(id),
    staleTime: 60_000,
  });
}

// =====================================================================
// CREATE -- optimistic
// =====================================================================

interface OptimisticCreateContext {
  tempId: string;
  previousLists: Array<[readonly unknown[], CursorPaginatedResponse<Contact> | undefined]>;
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  const t = useTranslations('contacts');

  return useMutation<Contact, Error, CreateContactInput, OptimisticCreateContext>({
    mutationFn: (input) => contactsApi.create(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: contactQueryKeys.lists() });

      const tempId = `optimistic-${crypto.randomUUID()}`;
      const optimisticContact: Contact = {
        id: tempId,
        tenant_id: 'optimistic',
        owner_id: input.owner_id ?? null,
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone,
        cin: input.cin,
        segment: input.segment,
        tags: input.tags,
        birthday: input.birthday,
        photo_url: input.photo_url,
        company_id: input.company_id ?? null,
        preferred_language: input.preferred_language,
        preferred_channel: input.preferred_channel,
        marketing_consent: input.marketing_consent,
        transactional_consent: input.transactional_consent,
        street: input.street,
        city: input.city,
        region: input.region,
        postal_code: input.postal_code,
        country: input.country,
        custom_fields: input.custom_fields,
        consent_given_at: new Date().toISOString(),
        consent_source: input.consent_source,
        last_interaction_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      };

      const previousLists: OptimisticCreateContext['previousLists'] = [];

      queryClient.setQueriesData<CursorPaginatedResponse<Contact>>(
        { queryKey: contactQueryKeys.lists() },
        (old) => {
          if (!old) return old;
          previousLists.push([contactQueryKeys.lists(), old]);
          return {
            ...old,
            items: [optimisticContact, ...old.items],
            total_count: old.total_count + 1,
          };
        },
      );

      return { tempId, previousLists };
    },
    onError: (error, _input, context) => {
      if (context) {
        for (const [key, value] of context.previousLists) {
          queryClient.setQueryData(key, value);
        }
      }
      toast.error(t('errors.create.failed'), { description: error.message });
    },
    onSuccess: (created, _input, context) => {
      if (context) {
        queryClient.setQueriesData<CursorPaginatedResponse<Contact>>(
          { queryKey: contactQueryKeys.lists() },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              items: old.items.map((c) => (c.id === context.tempId ? created : c)),
            };
          },
        );
      }
      queryClient.setQueryData(contactQueryKeys.detail(created.id), created);
      toast.success(t('toasts.created'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contactQueryKeys.lists() });
    },
  });
}

// =====================================================================
// UPDATE -- optimistic
// =====================================================================

export function useUpdateContact(id: string) {
  const queryClient = useQueryClient();
  const t = useTranslations('contacts');

  return useMutation<Contact, Error, UpdateContactInput, { previous?: Contact }>({
    mutationFn: (input) => contactsApi.update(id, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: contactQueryKeys.detail(id) });
      const previous = queryClient.getQueryData<Contact>(contactQueryKeys.detail(id));
      if (previous) {
        const optimistic = { ...previous, ...input, updated_at: new Date().toISOString() };
        queryClient.setQueryData(contactQueryKeys.detail(id), optimistic);
      }
      return { previous };
    },
    onError: (error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(contactQueryKeys.detail(id), context.previous);
      }
      toast.error(t('errors.update.failed'), { description: error.message });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(contactQueryKeys.detail(id), updated);
      toast.success(t('toasts.updated'));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contactQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: contactQueryKeys.detail(id) });
    },
  });
}

// =====================================================================
// DELETE -- soft delete
// =====================================================================

export function useDeleteContact() {
  const queryClient = useQueryClient();
  const t = useTranslations('contacts');

  return useMutation<void, Error, { id: string; reason?: string }>({
    mutationFn: ({ id, reason }) => contactsApi.softDelete(id, reason),
    onSuccess: (_data, { id }) => {
      queryClient.setQueriesData<CursorPaginatedResponse<Contact>>(
        { queryKey: contactQueryKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.filter((c) => c.id !== id),
            total_count: Math.max(0, old.total_count - 1),
          };
        },
      );
      queryClient.removeQueries({ queryKey: contactQueryKeys.detail(id) });
      toast.success(t('toasts.deleted'));
    },
    onError: (error) => {
      toast.error(t('errors.delete.failed'), { description: error.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contactQueryKeys.lists() });
    },
  });
}

// =====================================================================
// BULK ACTION
// =====================================================================

export function useBulkAction() {
  const queryClient = useQueryClient();
  const t = useTranslations('contacts');

  return useMutation({
    mutationFn: (payload: BulkActionPayload) => contactsApi.bulkAction(payload),
    onSuccess: (result, payload) => {
      switch (payload.action) {
        case 'tag':
          toast.success(t('toasts.bulk.tagged', { count: result.affected }));
          break;
        case 'assign':
          toast.success(t('toasts.bulk.assigned', { count: result.affected }));
          break;
        case 'delete':
          toast.success(t('toasts.bulk.deleted', { count: result.affected }));
          break;
        case 'export':
          if (result.export_download_url) {
            window.open(result.export_download_url, '_blank');
          }
          toast.success(t('toasts.bulk.exported', { count: result.affected }));
          break;
      }
    },
    onError: (error: Error) => {
      toast.error(t('errors.bulk.failed'), { description: error.message });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: contactQueryKeys.lists() });
    },
  });
}
```

---

### 6.6 `apps/web-broker/src/app/[locale]/(protected)/contacts/page.tsx` (~150 lignes)

```typescript
/**
 * Page Contacts -- Server Component initial fetch + Client DataTable.
 *
 * App Router Next.js 15 :
 *  - searchParams: Promise<Record<string, string | string[]>> (async)
 *  - parallel fetch initial contacts + tenant members (owners list)
 *  - hydrate TanStack Query cote client via dehydrate/HydrationBoundary
 */
import { Suspense } from 'react';
import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { contactsApi } from '@/lib/api/contacts.api';
import { contactQueryKeys } from '@/lib/queries/contacts.queries';
import { ContactsListFiltersSchema, type ContactsListFilters } from '@/lib/schemas/contact.schema';
import { ContactsPageClient } from '@/components/contacts/contacts-page-client';
import { ContactsTableSkeleton } from '@/components/contacts/contacts-table-skeleton';
import { PageHeader } from '@/components/layout/page-header';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contacts.meta' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

interface ContactsPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ContactsPage({ params, searchParams }: ContactsPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale, namespace: 'contacts' });

  // Parse filters from searchParams (server-side cache for nuqs)
  const parsedFilters: ContactsListFilters = {
    search: typeof sp.search === 'string' ? sp.search : undefined,
    segments: typeof sp.segments === 'string' ? (sp.segments.split(',') as any) : undefined,
    tags: typeof sp.tags === 'string' ? sp.tags.split(',') : undefined,
    assigned_to: typeof sp.assigned_to === 'string' ? sp.assigned_to : undefined,
    cursor: typeof sp.cursor === 'string' ? sp.cursor : undefined,
    sort: (typeof sp.sort === 'string' ? sp.sort : 'created_at:desc') as any,
    limit: 50,
  };
  const filters = ContactsListFiltersSchema.parse(parsedFilters);

  // Pre-fetch server-side
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  });

  await queryClient.prefetchQuery({
    queryKey: contactQueryKeys.list(filters),
    queryFn: () => contactsApi.list(filters),
  });

  const dehydratedState = dehydrate(queryClient);

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title={t('page.title')}
        description={t('page.description')}
        breadcrumbs={[
          { label: t('breadcrumbs.home'), href: `/${locale}/dashboard` },
          { label: t('breadcrumbs.contacts') },
        ]}
      />

      <HydrationBoundary state={dehydratedState}>
        <Suspense fallback={<ContactsTableSkeleton />}>
          <ContactsPageClient initialFilters={filters} locale={locale} />
        </Suspense>
      </HydrationBoundary>
    </div>
  );
}
```

---

### 6.7 `apps/web-broker/src/components/contacts/contacts-page-client.tsx` (~150 lignes)

```typescript
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Upload } from 'lucide-react';
import { Button } from '@insurtech/shared-ui';
import { useContactsList } from '@/lib/queries/contacts.queries';
import { useContactsFilters } from '@/hooks/use-contacts-filters';
import { ContactsTable } from './contacts-table';
import { ContactsFilters } from './contacts-filters';
import { ContactBulkActions } from './contact-bulk-actions';
import { ContactFormDialog } from './contact-form-dialog';
import { ImportContactsDialog } from './import-contacts-dialog';
import { usePermission } from '@/lib/auth/use-permissions';
import type { ContactsListFilters } from '@/lib/schemas/contact.schema';

interface ContactsPageClientProps {
  initialFilters: ContactsListFilters;
  locale: string;
}

export function ContactsPageClient({ initialFilters, locale }: ContactsPageClientProps) {
  const t = useTranslations('contacts');
  const [filters, setFilters] = useContactsFilters(initialFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const canCreate = usePermission('crm.contacts.create');
  const canImport = usePermission('crm.contacts.import');

  const { data, isLoading, isFetching, error } = useContactsList(filters);

  const handleFiltersChange = useCallback(
    (next: Partial<ContactsListFilters>) => {
      setFilters({ ...filters, ...next, cursor: undefined }); // reset cursor on filter change
      setSelectedIds(new Set()); // reset selection
    },
    [filters, setFilters],
  );

  const handlePageNext = useCallback(() => {
    if (data?.next_cursor) {
      setFilters({ ...filters, cursor: data.next_cursor });
    }
  }, [data?.next_cursor, filters, setFilters]);

  const selectedContacts = useMemo(
    () => (data?.items ?? []).filter((c) => selectedIds.has(c.id)),
    [data?.items, selectedIds],
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ContactsFilters filters={filters} onChange={handleFiltersChange} />
        <div className="flex items-center gap-2">
          {canImport && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="me-2 h-4 w-4" />
              {t('actions.import')}
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="me-2 h-4 w-4" />
              {t('actions.add')}
            </Button>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <ContactBulkActions
          selectedIds={Array.from(selectedIds)}
          selectedContacts={selectedContacts}
          totalMatching={data?.total_count ?? 0}
          currentFilters={filters}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <ContactsTable
        contacts={data?.items ?? []}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        totalCount={data?.total_count ?? 0}
        hasMore={data?.has_more ?? false}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onPageNext={handlePageNext}
        onPagePrev={() => {
          /* TODO previous cursor stack management */
        }}
        sort={filters.sort}
        onSortChange={(sort) => handleFiltersChange({ sort } as any)}
        locale={locale}
      />

      <ContactFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        locale={locale}
      />

      <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
```

---

### 6.8 `apps/web-broker/src/components/contacts/contacts-table.tsx` (~300 lignes)

```typescript
'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Row,
} from '@tanstack/react-table';
import {
  Mail,
  Phone,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Checkbox,
  Button,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@insurtech/shared-ui';
import { ContactAvatar } from './contact-avatar';
import { ContactSegmentBadge } from './contact-segment-badge';
import { ContactTagsDisplay } from './contact-tags-display';
import { DeleteContactDialog } from './delete-contact-dialog';
import { ContactFormDialog } from './contact-form-dialog';
import { formatPhoneMaDisplay } from '@/lib/utils/phone-ma-formatter';
import { usePermission } from '@/lib/auth/use-permissions';
import type { Contact } from '@/lib/schemas/contact.schema';

interface ContactsTableProps {
  contacts: Contact[];
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  totalCount: number;
  hasMore: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onPageNext: () => void;
  onPagePrev: () => void;
  sort: string;
  onSortChange: (sort: string) => void;
  locale: string;
}

export function ContactsTable({
  contacts,
  isLoading,
  isFetching,
  error,
  totalCount,
  hasMore,
  selectedIds,
  onSelectionChange,
  onPageNext,
  onPagePrev,
  sort,
  onSortChange,
  locale,
}: ContactsTableProps) {
  const t = useTranslations('contacts.table');
  const router = useRouter();
  const dateLocale = locale === 'fr' ? fr : ar;

  const canEdit = usePermission('crm.contacts.update');
  const canDelete = usePermission('crm.contacts.delete');

  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);

  const columns = useMemo<ColumnDef<Contact>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              contacts.length > 0 &&
              contacts.every((c) => selectedIds.has(c.id))
            }
            onCheckedChange={(checked) => {
              const next = new Set(selectedIds);
              if (checked) {
                contacts.forEach((c) => next.add(c.id));
              } else {
                contacts.forEach((c) => next.delete(c.id));
              }
              onSelectionChange(next);
            }}
            aria-label={t('selectAll')}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onCheckedChange={(checked) => {
              const next = new Set(selectedIds);
              if (checked) next.add(row.original.id);
              else next.delete(row.original.id);
              onSelectionChange(next);
            }}
            aria-label={t('selectRow')}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        size: 40,
      },
      {
        id: 'name',
        header: t('columns.name'),
        cell: ({ row }) => {
          const c = row.original;
          return (
            <div className="flex items-center gap-3">
              <ContactAvatar contact={c} size="sm" />
              <div className="flex flex-col">
                <span className="font-medium">
                  {c.first_name} {c.last_name}
                </span>
                {c.cin && <span className="text-xs text-muted-foreground">CIN: {c.cin}</span>}
              </div>
            </div>
          );
        },
      },
      {
        id: 'email',
        header: t('columns.email'),
        cell: ({ row }) => {
          const email = row.original.email;
          if (!email) return <span className="text-muted-foreground">-</span>;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-2 max-w-[200px] truncate hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Mail className="h-3 w-3 shrink-0" />
                  <span className="truncate">{email}</span>
                </a>
              </TooltipTrigger>
              <TooltipContent>{email}</TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: 'phone',
        header: t('columns.phone'),
        cell: ({ row }) => {
          const phone = row.original.phone;
          if (!phone) return <span className="text-muted-foreground">-</span>;
          return (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-2 hover:underline"
              dir="ltr"
              onClick={(e) => e.stopPropagation()}
            >
              <Phone className="h-3 w-3" />
              {formatPhoneMaDisplay(phone)}
            </a>
          );
        },
      },
      {
        id: 'segment',
        header: t('columns.segment'),
        cell: ({ row }) => <ContactSegmentBadge segment={row.original.segment} />,
      },
      {
        id: 'tags',
        header: t('columns.tags'),
        cell: ({ row }) => <ContactTagsDisplay tags={row.original.tags} maxVisible={2} />,
      },
      {
        id: 'last_interaction',
        header: t('columns.lastInteraction'),
        cell: ({ row }) => {
          const date = row.original.last_interaction_at;
          if (!date) return <span className="text-muted-foreground">-</span>;
          const parsed = new Date(date);
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  {formatDistanceToNow(parsed, { locale: dateLocale, addSuffix: true })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {format(parsed, 'PPPp', { locale: dateLocale })}
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        id: 'owner',
        header: t('columns.owner'),
        cell: ({ row }) => {
          const ownerId = row.original.owner_id;
          if (!ownerId) return <Badge variant="outline">{t('unassigned')}</Badge>;
          return <span className="text-sm">{ownerId.slice(0, 8)}</span>;
        },
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const c = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={t('actions.menu')}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/${locale}/contacts/${c.id}`)}>
                  <Eye className="me-2 h-4 w-4" />
                  {t('actions.view')}
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem onClick={() => setEditingContact(c)}>
                    <Pencil className="me-2 h-4 w-4" />
                    {t('actions.edit')}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => setDeletingContact(c)}
                    className="text-destructive"
                  >
                    <Trash2 className="me-2 h-4 w-4" />
                    {t('actions.delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        size: 60,
      },
    ],
    [contacts, selectedIds, onSelectionChange, t, dateLocale, canEdit, canDelete, locale, router],
  );

  const table = useReactTable({
    data: contacts,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  });

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4 text-destructive">
        {t('error', { message: error.message })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-[240px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at:desc">{t('sort.createdDesc')}</SelectItem>
            <SelectItem value="created_at:asc">{t('sort.createdAsc')}</SelectItem>
            <SelectItem value="last_name:asc">{t('sort.lastNameAsc')}</SelectItem>
            <SelectItem value="last_name:desc">{t('sort.lastNameDesc')}</SelectItem>
            <SelectItem value="last_interaction_at:desc">{t('sort.lastInteraction')}</SelectItem>
            <SelectItem value="segment:asc">{t('sort.segment')}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {isFetching ? t('refreshing') : t('totalCount', { count: totalCount })}
        </span>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
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
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {columns.map((_c, idx) => (
                    <TableCell key={idx}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                  {t('empty')}
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row: Row<Contact>) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/30"
                  data-optimistic={row.original.id.startsWith('optimistic-')}
                  onClick={() => router.push(`/${locale}/contacts/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('paginationCount', { shown: contacts.length, total: totalCount })}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPagePrev}>
            <ChevronLeft className="me-2 h-4 w-4" />
            {t('previous')}
          </Button>
          <Button variant="outline" size="sm" disabled={!hasMore} onClick={onPageNext}>
            {t('next')}
            <ChevronRight className="ms-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      {editingContact && (
        <ContactFormDialog
          open={Boolean(editingContact)}
          onOpenChange={(open) => !open && setEditingContact(null)}
          mode="edit"
          contact={editingContact}
          locale={locale}
        />
      )}
      {deletingContact && (
        <DeleteContactDialog
          contact={deletingContact}
          open={Boolean(deletingContact)}
          onOpenChange={(open) => !open && setDeletingContact(null)}
        />
      )}
    </div>
  );
}
```

---

### 6.9 `apps/web-broker/src/components/contacts/contacts-filters.tsx` (~200 lignes)

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Search, X, Filter } from 'lucide-react';
import {
  Input,
  Button,
  Badge,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@insurtech/shared-ui';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTenantTags } from '@/lib/queries/tags.queries';
import { useTenantMembers } from '@/lib/queries/members.queries';
import {
  CONTACT_SEGMENTS,
  type ContactsListFilters,
  type ContactSegment,
} from '@/lib/schemas/contact.schema';

interface ContactsFiltersProps {
  filters: ContactsListFilters;
  onChange: (next: Partial<ContactsListFilters>) => void;
}

export function ContactsFilters({ filters, onChange }: ContactsFiltersProps) {
  const t = useTranslations('contacts.filters');
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  // Sync debounced search to filters (skip initial mount)
  useEffect(() => {
    if (debouncedSearch !== (filters.search ?? '')) {
      onChange({ search: debouncedSearch || undefined });
    }
  }, [debouncedSearch]);

  const { data: tagsCatalog = [] } = useTenantTags();
  const { data: members = [] } = useTenantMembers();

  const toggleSegment = useCallback(
    (segment: ContactSegment) => {
      const current = filters.segments ?? [];
      const next = current.includes(segment)
        ? current.filter((s) => s !== segment)
        : [...current, segment];
      onChange({ segments: next.length > 0 ? next : undefined });
    },
    [filters.segments, onChange],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const current = filters.tags ?? [];
      const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
      onChange({ tags: next.length > 0 ? next : undefined });
    },
    [filters.tags, onChange],
  );

  const activeFiltersCount =
    (filters.segments?.length ?? 0) +
    (filters.tags?.length ?? 0) +
    (filters.assigned_to ? 1 : 0) +
    (filters.search ? 1 : 0);

  const resetAll = () => {
    setSearchInput('');
    onChange({
      search: undefined,
      segments: undefined,
      tags: undefined,
      assigned_to: undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="w-[280px] ps-9 pe-8"
          aria-label={t('searchLabel')}
        />
        {searchInput && (
          <button
            type="button"
            aria-label={t('clearSearch')}
            className="absolute end-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-muted"
            onClick={() => setSearchInput('')}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {CONTACT_SEGMENTS.map((segment) => {
          const active = filters.segments?.includes(segment) ?? false;
          return (
            <Badge
              key={segment}
              variant={active ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggleSegment(segment)}
              role="checkbox"
              aria-checked={active}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleSegment(segment);
                }
              }}
            >
              {t(`segments.${segment}`)}
            </Badge>
          );
        })}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm">
            <Filter className="me-2 h-4 w-4" />
            {t('tags.button')}
            {filters.tags && filters.tags.length > 0 && (
              <Badge variant="secondary" className="ms-2">
                {filters.tags.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('tags.searchPlaceholder')} />
            <CommandList>
              <CommandEmpty>{t('tags.empty')}</CommandEmpty>
              <CommandGroup>
                {tagsCatalog.map((tag) => {
                  const selected = filters.tags?.includes(tag) ?? false;
                  return (
                    <CommandItem key={tag} onSelect={() => toggleTag(tag)}>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          readOnly
                          checked={selected}
                          className="rounded border-gray-300"
                        />
                        <span>{tag}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Select
        value={filters.assigned_to ?? 'all'}
        onValueChange={(v) => onChange({ assigned_to: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder={t('owner.placeholder')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t('owner.all')}</SelectItem>
          {members.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.display_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeFiltersCount > 0 && (
        <Button variant="ghost" size="sm" onClick={resetAll}>
          <X className="me-2 h-4 w-4" />
          {t('reset', { count: activeFiltersCount })}
        </Button>
      )}
    </div>
  );
}
```

---

### 6.10 `apps/web-broker/src/components/contacts/contact-form-dialog.tsx` (~280 lignes)

```typescript
'use client';

import { useEffect, useMemo } from 'react';
import { useForm, useFormContext } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Checkbox,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  FormErrorMessage,
} from '@insurtech/shared-ui';
import {
  CreateContactInputSchema,
  UpdateContactInputSchema,
  CONTACT_SEGMENTS,
  CONTACT_PREFERRED_CHANNELS,
  CONTACT_PREFERRED_LANGUAGES,
  CONTACT_CONSENT_SOURCES,
  type CreateContactInput,
  type UpdateContactInput,
  type Contact,
} from '@/lib/schemas/contact.schema';
import { useCreateContact, useUpdateContact } from '@/lib/queries/contacts.queries';
import { ContactCustomFields } from './contact-custom-fields';
import { ContactTagsCombobox } from './contact-tags-combobox';

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  contact?: Contact;
  locale: string;
}

export function ContactFormDialog({ open, onOpenChange, mode, contact, locale }: ContactFormDialogProps) {
  const t = useTranslations('contacts.form');
  const isDesktop = useMediaQuery('(min-width: 768px)');

  const schema = mode === 'create' ? CreateContactInputSchema : UpdateContactInputSchema;
  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact(contact?.id ?? '');

  const defaultValues = useMemo(
    () => ({
      first_name: contact?.first_name ?? '',
      last_name: contact?.last_name ?? '',
      email: contact?.email ?? '',
      phone: contact?.phone ?? '',
      cin: contact?.cin ?? '',
      segment: contact?.segment ?? 'lead',
      tags: contact?.tags ?? [],
      birthday: contact?.birthday ?? '',
      photo_url: contact?.photo_url ?? '',
      preferred_language: contact?.preferred_language ?? locale,
      preferred_channel: contact?.preferred_channel ?? 'email',
      marketing_consent: contact?.marketing_consent ?? false,
      transactional_consent: contact?.transactional_consent ?? true,
      street: contact?.street ?? '',
      city: contact?.city ?? '',
      region: contact?.region ?? null,
      postal_code: contact?.postal_code ?? '',
      country: contact?.country ?? 'MA',
      custom_fields: contact?.custom_fields ?? {},
      consent_given: mode === 'edit',
      consent_source: contact?.consent_source ?? 'verbal',
    }),
    [contact, locale, mode],
  );

  const form = useForm<CreateContactInput | UpdateContactInput>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
  });

  useEffect(() => {
    if (open) form.reset(defaultValues as any);
  }, [open, defaultValues, form]);

  const onSubmit = async (values: CreateContactInput | UpdateContactInput) => {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(values as CreateContactInput);
      } else {
        await updateMutation.mutateAsync(values as UpdateContactInput);
      }
      onOpenChange(false);
    } catch {
      // toast handled by mutation
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const formBody = (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Tabs defaultValue="identity">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="identity">{t('tabs.identity')}</TabsTrigger>
          <TabsTrigger value="contact">{t('tabs.contact')}</TabsTrigger>
          <TabsTrigger value="prefs">{t('tabs.preferences')}</TabsTrigger>
          <TabsTrigger value="address">{t('tabs.address')}</TabsTrigger>
        </TabsList>

        <TabsContent value="identity" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="first_name">{t('fields.firstName')} *</Label>
              <Input id="first_name" {...form.register('first_name')} autoComplete="given-name" />
              <FormErrorMessage error={form.formState.errors.first_name?.message as string} />
            </div>
            <div>
              <Label htmlFor="last_name">{t('fields.lastName')} *</Label>
              <Input id="last_name" {...form.register('last_name')} autoComplete="family-name" />
              <FormErrorMessage error={form.formState.errors.last_name?.message as string} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cin">{t('fields.cin')}</Label>
              <Input
                id="cin"
                {...form.register('cin')}
                placeholder="AA123456"
                autoComplete="off"
                onBlur={(e) => form.setValue('cin', e.target.value.toUpperCase())}
              />
              <FormErrorMessage error={form.formState.errors.cin?.message as string} />
              <p className="text-xs text-muted-foreground mt-1">{t('hints.cin')}</p>
            </div>
            <div>
              <Label htmlFor="birthday">{t('fields.birthday')}</Label>
              <Input id="birthday" type="date" {...form.register('birthday')} />
            </div>
          </div>
          <div>
            <Label htmlFor="segment">{t('fields.segment')} *</Label>
            <Select
              value={form.watch('segment')}
              onValueChange={(v) => form.setValue('segment', v as any)}
            >
              <SelectTrigger id="segment">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_SEGMENTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`segments.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tags">{t('fields.tags')}</Label>
            <ContactTagsCombobox
              value={form.watch('tags') ?? []}
              onChange={(tags) => form.setValue('tags', tags)}
            />
          </div>
        </TabsContent>

        <TabsContent value="contact" className="space-y-4">
          <div>
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input id="email" type="email" {...form.register('email')} autoComplete="email" />
            <FormErrorMessage error={form.formState.errors.email?.message as string} />
          </div>
          <div>
            <Label htmlFor="phone">{t('fields.phone')}</Label>
            <Input
              id="phone"
              {...form.register('phone')}
              placeholder="+212 6 12 34 56 78"
              autoComplete="tel"
              dir="ltr"
            />
            <FormErrorMessage error={form.formState.errors.phone?.message as string} />
            <p className="text-xs text-muted-foreground mt-1">{t('hints.phone')}</p>
          </div>
          <div>
            <Label htmlFor="photo_url">{t('fields.photoUrl')}</Label>
            <Input id="photo_url" type="url" {...form.register('photo_url')} />
          </div>
        </TabsContent>

        <TabsContent value="prefs" className="space-y-4">
          <div>
            <Label>{t('fields.preferredLanguage')}</Label>
            <Select
              value={form.watch('preferred_language')}
              onValueChange={(v) => form.setValue('preferred_language', v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_PREFERRED_LANGUAGES.map((l) => (
                  <SelectItem key={l} value={l}>
                    {t(`languages.${l}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('fields.preferredChannel')}</Label>
            <Select
              value={form.watch('preferred_channel')}
              onValueChange={(v) => form.setValue('preferred_channel', v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_PREFERRED_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`channels.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch('marketing_consent') ?? false}
              onCheckedChange={(v) => form.setValue('marketing_consent', v)}
            />
            <Label className="flex-1">{t('fields.marketingConsent')}</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={form.watch('transactional_consent') ?? true}
              onCheckedChange={(v) => form.setValue('transactional_consent', v)}
            />
            <Label className="flex-1">{t('fields.transactionalConsent')}</Label>
          </div>
          <ContactCustomFields control={form.control} />
        </TabsContent>

        <TabsContent value="address" className="space-y-4">
          <div>
            <Label htmlFor="street">{t('fields.street')}</Label>
            <Input id="street" {...form.register('street')} autoComplete="street-address" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="city">{t('fields.city')}</Label>
              <Input id="city" {...form.register('city')} autoComplete="address-level2" />
            </div>
            <div>
              <Label htmlFor="postal_code">{t('fields.postalCode')}</Label>
              <Input
                id="postal_code"
                {...form.register('postal_code')}
                autoComplete="postal-code"
                placeholder="20000"
              />
              <FormErrorMessage error={form.formState.errors.postal_code?.message as string} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {mode === 'create' && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent_given"
              checked={form.watch('consent_given' as any) ?? false}
              onCheckedChange={(v) => form.setValue('consent_given' as any, v)}
            />
            <div className="flex-1 space-y-2">
              <Label htmlFor="consent_given" className="text-sm font-medium">
                {t('cnpd.consentLabel')}
              </Label>
              <p className="text-xs text-muted-foreground">{t('cnpd.consentDescription')}</p>
              <Select
                value={(form.watch('consent_source' as any) as string) ?? 'verbal'}
                onValueChange={(v) => form.setValue('consent_source' as any, v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTACT_CONSENT_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {t(`consentSources.${s}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormErrorMessage error={(form.formState.errors as any).consent_given?.message} />
            </div>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? t('actions.submitting') : mode === 'create' ? t('actions.create') : t('actions.save')}
        </Button>
      </DialogFooter>
    </form>
  );

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? t('title.create') : t('title.edit')}</DialogTitle>
            <DialogDescription>{t('description')}</DialogDescription>
          </DialogHeader>
          {formBody}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh]">
        <SheetHeader>
          <SheetTitle>{mode === 'create' ? t('title.create') : t('title.edit')}</SheetTitle>
        </SheetHeader>
        {formBody}
      </SheetContent>
    </Sheet>
  );
}
```

---

### 6.11 `apps/web-broker/src/components/contacts/contact-timeline.tsx` (~220 lignes)

```typescript
'use client';

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import { useTranslations } from 'next-intl';
import {
  Phone,
  Mail,
  MessageCircle,
  Smartphone,
  Calendar as CalendarIcon,
  StickyNote,
  CheckSquare,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';
import { format, formatDistanceToNow, isSameDay, parseISO } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { Badge, Button, Card } from '@insurtech/shared-ui';
import { useContactTimeline } from '@/lib/queries/contacts.queries';
import type { Interaction } from '@/lib/api/contacts.api';

const INTERACTION_ICON_MAP: Record<Interaction['type'], { icon: LucideIcon; color: string }> = {
  call: { icon: Phone, color: 'text-blue-600 bg-blue-100 dark:bg-blue-950' },
  email: { icon: Mail, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-950' },
  whatsapp: { icon: MessageCircle, color: 'text-green-600 bg-green-100 dark:bg-green-950' },
  sms: { icon: Smartphone, color: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-950' },
  meeting: { icon: CalendarIcon, color: 'text-purple-600 bg-purple-100 dark:bg-purple-950' },
  note: { icon: StickyNote, color: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-950' },
  task: { icon: CheckSquare, color: 'text-orange-600 bg-orange-100 dark:bg-orange-950' },
  status_change: { icon: GitBranch, color: 'text-gray-600 bg-gray-100 dark:bg-gray-900' },
};

const INTERACTION_TYPES = Object.keys(INTERACTION_ICON_MAP) as Interaction['type'][];

interface ContactTimelineProps {
  contactId: string;
  locale: string;
}

export function ContactTimeline({ contactId, locale }: ContactTimelineProps) {
  const t = useTranslations('contacts.timeline');
  const dateLocale = locale === 'fr' ? fr : ar;
  const [typeFilters, setTypeFilters] = useState<Set<Interaction['type']>>(
    new Set(INTERACTION_TYPES),
  );

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useContactTimeline(contactId);

  const allInteractions = useMemo(
    () => (data?.pages.flatMap((p) => p.items) ?? []).filter((i) => typeFilters.has(i.type)),
    [data, typeFilters],
  );

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: Date; items: Interaction[] }> = [];
    for (const interaction of allInteractions) {
      const date = parseISO(interaction.occurred_at);
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && isSameDay(lastGroup.date, date)) {
        lastGroup.items.push(interaction);
      } else {
        groups.push({ date, items: [interaction] });
      }
    }
    return groups;
  }, [allInteractions]);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const toggleType = (type: Interaction['type']) => {
    setTypeFilters((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (allInteractions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">{t('empty')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('emptyHint')}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {INTERACTION_TYPES.map((type) => {
          const active = typeFilters.has(type);
          const { icon: Icon, color } = INTERACTION_ICON_MAP[type];
          return (
            <Badge
              key={type}
              variant={active ? 'default' : 'outline'}
              className="cursor-pointer select-none inline-flex items-center gap-1"
              onClick={() => toggleType(type)}
            >
              <Icon className="h-3 w-3" />
              {t(`types.${type}`)}
            </Badge>
          );
        })}
      </div>

      <div className="flex flex-col gap-6">
        {groupedByDate.map((group, gi) => (
          <Fragment key={gi}>
            <div className="sticky top-0 z-10 -mx-2 bg-background/95 backdrop-blur py-2 px-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {format(group.date, 'PPPP', { locale: dateLocale })}
              </h3>
            </div>
            <div className="ms-4 border-s border-border ps-6 space-y-4 relative">
              {group.items.map((interaction) => {
                const { icon: Icon, color } = INTERACTION_ICON_MAP[interaction.type];
                return (
                  <div key={interaction.id} className="relative">
                    <div
                      className={`absolute -start-[34px] -top-1 flex h-6 w-6 items-center justify-center rounded-full ${color}`}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    <Card className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{interaction.title}</p>
                          {interaction.body && (
                            <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
                              {interaction.body}
                            </p>
                          )}
                          {interaction.duration_seconds != null && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t('duration', {
                                minutes: Math.round(interaction.duration_seconds / 60),
                              })}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(parseISO(interaction.occurred_at), 'HH:mm', { locale: dateLocale })}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{interaction.actor_name}</span>
                        <span>-</span>
                        <span>
                          {formatDistanceToNow(parseISO(interaction.occurred_at), {
                            locale: dateLocale,
                            addSuffix: true,
                          })}
                        </span>
                        <Badge variant="outline" className="ml-auto">
                          {interaction.outbound ? t('outbound') : t('inbound')}
                        </Badge>
                      </div>
                    </Card>
                  </div>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>

      <div ref={sentinelRef} />

      {isFetchingNextPage && (
        <div className="text-center text-sm text-muted-foreground py-4">{t('loadingMore')}</div>
      )}

      {!hasNextPage && groupedByDate.length > 0 && (
        <div className="text-center text-xs text-muted-foreground py-4">{t('end')}</div>
      )}
    </div>
  );
}
```

---

### 6.12 `apps/web-broker/src/components/contacts/contact-bulk-actions.tsx` (~150 lignes)

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Tag, UserCheck, Download, Trash2, X } from 'lucide-react';
import { Button, Badge } from '@insurtech/shared-ui';
import { BulkTagDialog } from './bulk-tag-dialog';
import { BulkAssignDialog } from './bulk-assign-dialog';
import { ExportContactsDialog } from './export-contacts-dialog';
import { useBulkAction } from '@/lib/queries/contacts.queries';
import { usePermission } from '@/lib/auth/use-permissions';
import type { Contact, ContactsListFilters } from '@/lib/schemas/contact.schema';

interface ContactBulkActionsProps {
  selectedIds: string[];
  selectedContacts: Contact[];
  totalMatching: number;
  currentFilters: ContactsListFilters;
  onClear: () => void;
}

export function ContactBulkActions({
  selectedIds,
  selectedContacts,
  totalMatching,
  currentFilters,
  onClear,
}: ContactBulkActionsProps) {
  const t = useTranslations('contacts.bulk');
  const [tagOpen, setTagOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const canBulkTag = usePermission('crm.contacts.update');
  const canBulkAssign = usePermission('crm.contacts.assign');
  const canBulkExport = usePermission('crm.contacts.export');
  const canBulkDelete = usePermission('crm.contacts.delete');

  const bulkMutation = useBulkAction();

  const handleDelete = async () => {
    await bulkMutation.mutateAsync({
      action: 'delete',
      contact_ids: selectedIds,
      reason: 'Bulk delete from contacts list',
    });
    setConfirmDelete(false);
    onClear();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/50 bg-primary/5 p-3">
      <Badge variant="secondary" className="me-2">
        {t('selectedCount', { count: selectedIds.length, total: totalMatching })}
      </Badge>

      {canBulkTag && (
        <Button variant="outline" size="sm" onClick={() => setTagOpen(true)}>
          <Tag className="me-2 h-4 w-4" />
          {t('actions.tag')}
        </Button>
      )}

      {canBulkAssign && (
        <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}>
          <UserCheck className="me-2 h-4 w-4" />
          {t('actions.assign')}
        </Button>
      )}

      {canBulkExport && (
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download className="me-2 h-4 w-4" />
          {t('actions.export')}
        </Button>
      )}

      {canBulkDelete && (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="me-2 h-4 w-4" />
          {t('actions.delete')}
        </Button>
      )}

      <Button variant="ghost" size="sm" onClick={onClear} className="ms-auto">
        <X className="me-2 h-4 w-4" />
        {t('clear')}
      </Button>

      {tagOpen && (
        <BulkTagDialog
          open={tagOpen}
          onOpenChange={setTagOpen}
          selectedIds={selectedIds}
          onComplete={onClear}
        />
      )}
      {assignOpen && (
        <BulkAssignDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          selectedIds={selectedIds}
          onComplete={onClear}
        />
      )}
      {exportOpen && (
        <ExportContactsDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          selectedIds={selectedIds}
          currentFilters={currentFilters}
          totalMatching={totalMatching}
        />
      )}
      {confirmDelete && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full">
            <h3 className="font-semibold text-lg">{t('confirmDelete.title')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('confirmDelete.description', { count: selectedIds.length })}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={bulkMutation.isPending}>
                {t('confirmDelete.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={bulkMutation.isPending}
              >
                {bulkMutation.isPending ? t('confirmDelete.deleting') : t('confirmDelete.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 6.13 `apps/web-broker/src/app/[locale]/(protected)/contacts/[id]/page.tsx` (~220 lignes)

```typescript
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { contactsApi } from '@/lib/api/contacts.api';
import { contactQueryKeys } from '@/lib/queries/contacts.queries';
import { ContactDetailClient } from '@/components/contacts/contact-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id, locale } = await params;
  try {
    const contact = await contactsApi.detail(id);
    return {
      title: `${contact.first_name} ${contact.last_name} | Contacts`,
    };
  } catch {
    return { title: 'Contact | Skalean Broker' };
  }
}

export default async function ContactDetailPage({ params }: PageProps) {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: 'contacts.detail' });

  const queryClient = new QueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: contactQueryKeys.detail(id),
      queryFn: () => contactsApi.detail(id),
    });
  } catch (error: any) {
    if (error?.response?.status === 404) {
      notFound();
    }
    throw error;
  }

  // Parallel prefetch related data (deals + policies + documents)
  await Promise.allSettled([
    queryClient.prefetchQuery({
      queryKey: contactQueryKeys.deals(id),
      queryFn: () => contactsApi.deals(id),
    }),
    queryClient.prefetchQuery({
      queryKey: contactQueryKeys.policies(id),
      queryFn: () => contactsApi.policies(id),
    }),
    queryClient.prefetchQuery({
      queryKey: contactQueryKeys.documents(id),
      queryFn: () => contactsApi.documents(id),
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 p-6">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<div>{t('loading')}</div>}>
          <ContactDetailClient contactId={id} locale={locale} />
        </Suspense>
      </HydrationBoundary>
    </div>
  );
}
```

---

### 6.14 `apps/web-broker/src/components/contacts/contact-detail-client.tsx` (~200 lignes)

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Card,
  Badge,
} from '@insurtech/shared-ui';
import { useContactDetail } from '@/lib/queries/contacts.queries';
import { ContactCard } from './contact-card';
import { ContactInfoTab } from './contact-info-tab';
import { ContactTimeline } from './contact-timeline';
import { ContactDealsTab } from './contact-deals-tab';
import { ContactPolicesTab } from './contact-polices-tab';
import { ContactDocumentsTab } from './contact-documents-tab';
import { ContactCommunicationsTab } from './contact-communications-tab';
import { ContactQuickActions } from './contact-quick-actions';
import { ContactFormDialog } from './contact-form-dialog';

interface ContactDetailClientProps {
  contactId: string;
  locale: string;
}

export function ContactDetailClient({ contactId, locale }: ContactDetailClientProps) {
  const t = useTranslations('contacts.detail');
  const { data: contact, isLoading, error } = useContactDetail(contactId);
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-32 w-full animate-pulse rounded bg-muted" />
        <div className="h-96 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (error || !contact) {
    return (
      <Card className="p-6">
        <p className="text-destructive">{t('error.notFound')}</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ContactCard
        contact={contact}
        onEdit={() => setEditOpen(true)}
        renderActions={() => <ContactQuickActions contact={contact} locale={locale} />}
      />

      <Tabs defaultValue="info">
        <TabsList className="grid w-full grid-cols-6 max-w-3xl">
          <TabsTrigger value="info">{t('tabs.info')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('tabs.timeline')}</TabsTrigger>
          <TabsTrigger value="deals">{t('tabs.deals')}</TabsTrigger>
          <TabsTrigger value="polices">{t('tabs.polices')}</TabsTrigger>
          <TabsTrigger value="documents">{t('tabs.documents')}</TabsTrigger>
          <TabsTrigger value="communications">{t('tabs.communications')}</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <ContactInfoTab contact={contact} locale={locale} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <ContactTimeline contactId={contactId} locale={locale} />
        </TabsContent>

        <TabsContent value="deals" className="mt-4">
          <ContactDealsTab contactId={contactId} locale={locale} />
        </TabsContent>

        <TabsContent value="polices" className="mt-4">
          <ContactPolicesTab contactId={contactId} locale={locale} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <ContactDocumentsTab contactId={contactId} locale={locale} />
        </TabsContent>

        <TabsContent value="communications" className="mt-4">
          <ContactCommunicationsTab contactId={contactId} locale={locale} />
        </TabsContent>
      </Tabs>

      <ContactFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        contact={contact}
        locale={locale}
      />
    </div>
  );
}
```

---

### 6.15 `apps/web-broker/src/components/contacts/contact-quick-actions.tsx` (~150 lignes)

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MessageSquare, Calendar, Briefcase, FileText, MoreHorizontal } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@insurtech/shared-ui';
import { SendMessageDialog } from './send-message-dialog';
import { ScheduleAppointmentDialog } from './schedule-appointment-dialog';
import { CreateDealFromContactDialog } from './create-deal-from-contact-dialog';
import { usePermission } from '@/lib/auth/use-permissions';
import type { Contact } from '@/lib/schemas/contact.schema';

interface ContactQuickActionsProps {
  contact: Contact;
  locale: string;
}

export function ContactQuickActions({ contact, locale }: ContactQuickActionsProps) {
  const t = useTranslations('contacts.quickActions');
  const router = useRouter();

  const [messageOpen, setMessageOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [createDealOpen, setCreateDealOpen] = useState(false);

  const canSendMessage = usePermission('comms.send');
  const canScheduleAppointment = usePermission('booking.create');
  const canCreateDeal = usePermission('crm.deals.create');
  const canGenerateQuote = usePermission('quotes.generate');

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canSendMessage && (
        <Button onClick={() => setMessageOpen(true)} variant="default" size="sm">
          <MessageSquare className="me-2 h-4 w-4" />
          {t('sendMessage')}
        </Button>
      )}
      {canScheduleAppointment && (
        <Button onClick={() => setScheduleOpen(true)} variant="outline" size="sm">
          <Calendar className="me-2 h-4 w-4" />
          {t('schedule')}
        </Button>
      )}
      {canCreateDeal && (
        <Button onClick={() => setCreateDealOpen(true)} variant="outline" size="sm">
          <Briefcase className="me-2 h-4 w-4" />
          {t('createDeal')}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canGenerateQuote && (
            <DropdownMenuItem
              onClick={() => router.push(`/${locale}/quotes/new?contact_id=${contact.id}`)}
            >
              <FileText className="me-2 h-4 w-4" />
              {t('generateQuote')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => router.push(`/${locale}/contacts/${contact.id}/journey`)}
          >
            {t('viewJourney')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => navigator.clipboard.writeText(contact.id)}
          >
            {t('copyId')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {messageOpen && (
        <SendMessageDialog
          open={messageOpen}
          onOpenChange={setMessageOpen}
          contact={contact}
        />
      )}
      {scheduleOpen && (
        <ScheduleAppointmentDialog
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          contact={contact}
        />
      )}
      {createDealOpen && (
        <CreateDealFromContactDialog
          open={createDealOpen}
          onOpenChange={setCreateDealOpen}
          contact={contact}
        />
      )}
    </div>
  );
}
```

---

### 6.16 `apps/web-broker/src/hooks/use-contacts-filters.ts` (~80 lignes)

```typescript
'use client';

import { useCallback } from 'react';
import {
  parseAsString,
  parseAsArrayOf,
  parseAsStringEnum,
  useQueryStates,
} from 'nuqs';
import { CONTACT_SEGMENTS, type ContactsListFilters } from '@/lib/schemas/contact.schema';

const segmentParser = parseAsStringEnum([...CONTACT_SEGMENTS]);

export function useContactsFilters(initial: ContactsListFilters) {
  const [state, setState] = useQueryStates(
    {
      search: parseAsString.withDefault(''),
      segments: parseAsArrayOf(segmentParser).withDefault([]),
      tags: parseAsArrayOf(parseAsString).withDefault([]),
      assigned_to: parseAsString.withDefault(''),
      cursor: parseAsString.withDefault(''),
      sort: parseAsString.withDefault('created_at:desc'),
    },
    { shallow: true, history: 'replace' },
  );

  const filters: ContactsListFilters = {
    search: state.search || undefined,
    segments: state.segments.length > 0 ? state.segments : undefined,
    tags: state.tags.length > 0 ? state.tags : undefined,
    assigned_to: state.assigned_to || undefined,
    cursor: state.cursor || undefined,
    sort: state.sort as ContactsListFilters['sort'],
    limit: 50,
  };

  const setFilters = useCallback(
    (next: ContactsListFilters) => {
      setState({
        search: next.search ?? '',
        segments: (next.segments ?? []) as any,
        tags: next.tags ?? [],
        assigned_to: next.assigned_to ?? '',
        cursor: next.cursor ?? '',
        sort: next.sort ?? 'created_at:desc',
      });
    },
    [setState],
  );

  return [filters, setFilters] as const;
}
```

---

### 6.17 `apps/web-broker/src/hooks/use-debounced-value.ts` (~30 lignes)

```typescript
'use client';

import { useEffect, useState } from 'react';

/**
 * Renvoie une version debouncee de la valeur passee.
 * Le delai par defaut est 300ms (sweet spot UX search).
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timeoutId);
  }, [value, delay]);

  return debounced;
}
```

---

## 7. Tests Vitest unitaires (15+ tests, ~1000 lignes)

### 7.1 `apps/web-broker/src/lib/__tests__/cin-ma-validator.spec.ts` (~140 lignes, 6 tests)

```typescript
import { describe, it, expect } from 'vitest';
import {
  isValidCinMa,
  normalizeCin,
  extractCinPrefix,
  getCinPrefixRegion,
  maskCin,
  formatCin,
} from '@/lib/utils/cin-ma-validator';

describe('cin-ma-validator', () => {
  describe('isValidCinMa', () => {
    it('accepte un CIN avec 1 lettre + 1-7 chiffres', () => {
      expect(isValidCinMa('A1')).toBe(true);
      expect(isValidCinMa('A1234567')).toBe(true);
      expect(isValidCinMa('B999999')).toBe(true);
    });

    it('accepte un CIN avec 2 lettres + 1-7 chiffres', () => {
      expect(isValidCinMa('AA123456')).toBe(true);
      expect(isValidCinMa('BE9999999')).toBe(true);
    });

    it('rejette les formats invalides', () => {
      expect(isValidCinMa('')).toBe(false);
      expect(isValidCinMa('123456')).toBe(false); // pas de prefix
      expect(isValidCinMa('ABC123456')).toBe(false); // 3 lettres
      expect(isValidCinMa('AA12345678')).toBe(false); // 8 chiffres
      expect(isValidCinMa('A')).toBe(false); // pas de chiffres
      expect(isValidCinMa('AA-1234')).toBe(false); // separator
    });

    it('est insensible a la casse (via normalize)', () => {
      expect(isValidCinMa('aa123456')).toBe(true);
      expect(isValidCinMa('Aa1234')).toBe(true);
      expect(isValidCinMa('  AA123456  ')).toBe(true);
    });
  });

  describe('normalizeCin', () => {
    it('uppercase + strip whitespace', () => {
      expect(normalizeCin('aa 123 456')).toBe('AA123456');
      expect(normalizeCin(' bE9999 ')).toBe('BE9999');
    });
  });

  describe('extractCinPrefix', () => {
    it('extrait le prefix lettre', () => {
      expect(extractCinPrefix('AA123456')).toBe('AA');
      expect(extractCinPrefix('A1234567')).toBe('A');
      expect(extractCinPrefix('BE9999')).toBe('BE');
    });

    it('retourne null si aucun prefix', () => {
      expect(extractCinPrefix('123456')).toBe(null);
      expect(extractCinPrefix('')).toBe(null);
    });
  });

  describe('getCinPrefixRegion', () => {
    it('retourne la region pour prefix connu', () => {
      expect(getCinPrefixRegion('A123456')).toBe('Rabat / Sale');
      expect(getCinPrefixRegion('BE9999')).toBe('Casablanca Anfa');
      expect(getCinPrefixRegion('K12345')).toBe('Tanger');
    });

    it('retourne null pour prefix inconnu', () => {
      expect(getCinPrefixRegion('XY123')).toBe(null);
    });
  });

  describe('maskCin', () => {
    it('masque les chiffres apres les 2 premiers', () => {
      expect(maskCin('AA123456')).toBe('AA12****');
      expect(maskCin('BE9999999')).toBe('BE99*****');
      expect(maskCin('A1234567')).toBe('A12*****');
    });

    it('gere les CIN courts', () => {
      expect(maskCin('A99')).toBe('A9**');
      expect(maskCin('AA1')).toBe('AA**');
    });
  });

  describe('formatCin', () => {
    it('uppercase + trim', () => {
      expect(formatCin('  aa123456  ')).toBe('AA123456');
    });
  });
});
```

---

### 7.2 `apps/web-broker/src/lib/__tests__/phone-ma-formatter.spec.ts` (~80 lignes, 4 tests)

```typescript
import { describe, it, expect } from 'vitest';
import {
  normalizePhoneMa,
  isValidPhoneMa,
  formatPhoneMaDisplay,
  detectPhoneOperator,
} from '@/lib/utils/phone-ma-formatter';

describe('phone-ma-formatter', () => {
  describe('normalizePhoneMa', () => {
    it('convertit format local 0XXXXXXXXX en E.164', () => {
      expect(normalizePhoneMa('0612345678')).toBe('+212612345678');
      expect(normalizePhoneMa('0712345678')).toBe('+212712345678');
      expect(normalizePhoneMa('0512345678')).toBe('+212512345678');
    });

    it('preserve E.164 deja correct', () => {
      expect(normalizePhoneMa('+212612345678')).toBe('+212612345678');
    });

    it('ajoute le + si format 212XXX sans +', () => {
      expect(normalizePhoneMa('212612345678')).toBe('+212612345678');
    });

    it('strippe les separateurs courants', () => {
      expect(normalizePhoneMa('06 12 34 56 78')).toBe('+212612345678');
      expect(normalizePhoneMa('06-12-34-56-78')).toBe('+212612345678');
      expect(normalizePhoneMa('06.12.34.56.78')).toBe('+212612345678');
      expect(normalizePhoneMa('(0)612345678')).toBe('+212612345678');
    });

    it('gere prefix 00212', () => {
      expect(normalizePhoneMa('00212612345678')).toBe('+212612345678');
    });
  });

  describe('isValidPhoneMa', () => {
    it('valide E.164 MA mobile/fixe', () => {
      expect(isValidPhoneMa('+212512345678')).toBe(true);
      expect(isValidPhoneMa('+212612345678')).toBe(true);
      expect(isValidPhoneMa('+212712345678')).toBe(true);
    });

    it('rejette format local non normalize', () => {
      expect(isValidPhoneMa('0612345678')).toBe(false);
    });

    it('rejette prefix invalide', () => {
      expect(isValidPhoneMa('+212812345678')).toBe(false);
      expect(isValidPhoneMa('+212912345678')).toBe(false);
      expect(isValidPhoneMa('+212012345678')).toBe(false);
    });

    it('rejette longueur invalide', () => {
      expect(isValidPhoneMa('+21261234567')).toBe(false); // 7 chiffres
      expect(isValidPhoneMa('+2126123456789')).toBe(false); // 9 chiffres
    });
  });

  describe('formatPhoneMaDisplay', () => {
    it('formate avec espaces lisibles', () => {
      expect(formatPhoneMaDisplay('+212612345678')).toBe('+212 6 12 34 56 78');
    });

    it('retourne tel quel si invalide', () => {
      expect(formatPhoneMaDisplay('0612345678')).toBe('0612345678');
    });
  });

  describe('detectPhoneOperator', () => {
    it('detecte Maroc Telecom', () => {
      expect(detectPhoneOperator('+212612345678')).toBe('maroc_telecom');
    });
    it('detecte Orange', () => {
      expect(detectPhoneOperator('+212664000000')).toBe('orange');
    });
    it('detecte Inwi', () => {
      expect(detectPhoneOperator('+212771234567')).toBe('inwi');
    });
    it('retourne unknown pour invalide', () => {
      expect(detectPhoneOperator('+212012345678')).toBe('unknown');
    });
  });
});
```

---

### 7.3 `apps/web-broker/src/lib/__tests__/contact-schema.spec.ts` (~120 lignes, 5 tests)

```typescript
import { describe, it, expect } from 'vitest';
import {
  ContactCoreSchema,
  CreateContactInputSchema,
  ContactsListFiltersSchema,
  BulkActionPayloadSchema,
} from '@/lib/schemas/contact.schema';

describe('ContactCoreSchema', () => {
  it('accepte un contact complet valide', () => {
    const result = ContactCoreSchema.safeParse({
      first_name: 'Mohamed',
      last_name: 'El Amrani',
      email: 'mohamed@example.ma',
      phone: '+212612345678',
      cin: 'AA123456',
      segment: 'customer',
      tags: ['vip', 'auto'],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.first_name).toBe('Mohamed');
      expect(result.data.email).toBe('mohamed@example.ma');
    }
  });

  it('auto-corrige format telephone local en E.164', () => {
    const result = ContactCoreSchema.safeParse({
      first_name: 'A',
      last_name: 'B',
      phone: '0612345678',
      cin: 'AA123456',
      segment: 'lead',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('+212612345678');
    }
  });

  it('rejette email invalide', () => {
    const result = ContactCoreSchema.safeParse({
      first_name: 'A',
      last_name: 'B',
      email: 'not-an-email',
      segment: 'lead',
    });
    expect(result.success).toBe(false);
  });

  it('rejette CIN format invalide', () => {
    const result = ContactCoreSchema.safeParse({
      first_name: 'A',
      last_name: 'B',
      cin: 'ABC1234567', // 3 lettres
      segment: 'lead',
    });
    expect(result.success).toBe(false);
  });

  it('rejette plus de 20 tags', () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    const result = ContactCoreSchema.safeParse({
      first_name: 'A',
      last_name: 'B',
      segment: 'lead',
      tags,
    });
    expect(result.success).toBe(false);
  });
});

describe('CreateContactInputSchema', () => {
  it('rejette si consent_given !== true', () => {
    const result = CreateContactInputSchema.safeParse({
      first_name: 'A',
      last_name: 'B',
      segment: 'lead',
      consent_given: false,
      consent_source: 'verbal',
    });
    expect(result.success).toBe(false);
  });

  it('accepte si consent_given === true', () => {
    const result = CreateContactInputSchema.safeParse({
      first_name: 'A',
      last_name: 'B',
      segment: 'lead',
      consent_given: true,
      consent_source: 'verbal',
    });
    expect(result.success).toBe(true);
  });
});

describe('ContactsListFiltersSchema', () => {
  it('applique le sort default', () => {
    const result = ContactsListFiltersSchema.parse({});
    expect(result.sort).toBe('created_at:desc');
    expect(result.limit).toBe(50);
  });

  it('rejette limit > 200', () => {
    const result = ContactsListFiltersSchema.safeParse({ limit: 300 });
    expect(result.success).toBe(false);
  });
});

describe('BulkActionPayloadSchema', () => {
  it('discriminates sur action', () => {
    const tag = BulkActionPayloadSchema.parse({
      action: 'tag',
      contact_ids: ['00000000-0000-0000-0000-000000000001'],
      tags_to_add: ['vip'],
    });
    expect(tag.action).toBe('tag');

    const assign = BulkActionPayloadSchema.parse({
      action: 'assign',
      contact_ids: ['00000000-0000-0000-0000-000000000001'],
      owner_id: '00000000-0000-0000-0000-000000000002',
    });
    expect(assign.action).toBe('assign');
  });

  it('rejette 0 contact_ids', () => {
    const result = BulkActionPayloadSchema.safeParse({
      action: 'tag',
      contact_ids: [],
      tags_to_add: ['vip'],
    });
    expect(result.success).toBe(false);
  });

  it('rejette plus de 5000 contact_ids', () => {
    const ids = Array.from({ length: 5001 }, () => '00000000-0000-0000-0000-000000000001');
    const result = BulkActionPayloadSchema.safeParse({
      action: 'tag',
      contact_ids: ids,
      tags_to_add: ['vip'],
    });
    expect(result.success).toBe(false);
  });
});
```

---

## 8. Tests Playwright E2E (12+ scenarios, ~830 lignes)

### 8.1 `apps/web-broker/e2e/contacts/contacts-list.spec.ts` (~200 lignes, 4 tests)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBrokerUser, seedContacts } from '../fixtures/auth-helpers';

test.describe('Contacts List + Filters', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBrokerUser(page);
    await seedContacts(page, 25); // seed 25 contacts test
  });

  test('affiche la table de contacts paginee avec count', async ({ page }) => {
    await page.goto('/fr/contacts');
    await expect(page.getByRole('heading', { name: /Contacts/i })).toBeVisible();
    await expect(page.getByText(/25 contacts/i)).toBeVisible();
    const rows = page.locator('tbody tr:not([data-skeleton])');
    await expect(rows).toHaveCount(25);
  });

  test('filtre par segment et persiste dans URL', async ({ page }) => {
    await page.goto('/fr/contacts');
    await page.getByRole('checkbox', { name: /prospect/i }).click();
    await expect(page).toHaveURL(/segments=prospect/);

    // Reload pour verifier persistence URL
    await page.reload();
    await expect(page.getByRole('checkbox', { name: /prospect/i })).toBeChecked();
  });

  test('search debounced 300ms ne lance pas de requete avant', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/crm/contacts')) requests.push(req.url());
    });
    await page.goto('/fr/contacts');
    requests.length = 0;

    await page.getByPlaceholder(/Rechercher/i).fill('mohamed');
    await page.waitForTimeout(150);
    expect(requests.filter((u) => u.includes('search=mohamed'))).toHaveLength(0);

    await page.waitForTimeout(400);
    expect(requests.filter((u) => u.includes('search=mohamed')).length).toBeGreaterThan(0);
  });

  test('pagination cursor next/prev', async ({ page }) => {
    await seedContacts(page, 75);
    await page.goto('/fr/contacts');

    await expect(page.locator('tbody tr')).toHaveCount(50);
    await page.getByRole('button', { name: /suivant/i }).click();
    await expect(page).toHaveURL(/cursor=/);

    await page.getByRole('button', { name: /precedent/i }).click();
    await expect(page.locator('tbody tr')).toHaveCount(50);
  });
});
```

---

### 8.2 `apps/web-broker/e2e/contacts/contacts-crud.spec.ts` (~250 lignes, 4 tests)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBrokerUser } from '../fixtures/auth-helpers';

test.describe('Contacts CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBrokerUser(page);
    await page.goto('/fr/contacts');
  });

  test('CREATE contact avec validation Zod', async ({ page }) => {
    await page.getByRole('button', { name: /ajouter/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Submit vide -> erreurs
    await page.getByRole('button', { name: /creer/i }).click();
    await expect(page.getByText(/Prenom requis/i)).toBeVisible();
    await expect(page.getByText(/Nom requis/i)).toBeVisible();

    // CIN invalide
    await page.getByLabel(/prenom/i).fill('Mohamed');
    await page.getByLabel(/nom/i).fill('El Amrani');
    await page.getByLabel(/CIN/i).fill('ABC1234567');
    await page.getByLabel(/CIN/i).blur();
    await page.getByRole('button', { name: /creer/i }).click();
    await expect(page.getByText(/CIN invalide/i)).toBeVisible();

    // Telephone auto-correction
    await page.getByLabel(/CIN/i).fill('AA123456');
    await page.getByLabel(/telephone/i).fill('0612345678');
    await page.getByLabel(/email/i).fill('mohamed@example.ma');

    // Consent CNDP required
    await page.getByRole('checkbox', { name: /consent/i }).check();
    await page.getByRole('button', { name: /creer/i }).click();
    await expect(page.getByText(/Contact cree/i)).toBeVisible();
    await expect(page.getByRole('cell', { name: /El Amrani/i })).toBeVisible();
  });

  test('CREATE optimistic UI : contact affiche immediatement puis confirme', async ({ page }) => {
    await page.route('**/api/v1/crm/contacts', async (route) => {
      if (route.request().method() === 'POST') {
        await page.waitForTimeout(1000); // delay server
        await route.continue();
      } else {
        await route.continue();
      }
    });

    await page.getByRole('button', { name: /ajouter/i }).click();
    await page.getByLabel(/prenom/i).fill('Ali');
    await page.getByLabel(/nom/i).fill('Hassan');
    await page.getByRole('checkbox', { name: /consent/i }).check();
    await page.getByRole('button', { name: /creer/i }).click();

    // Ligne optimistic visible (data-optimistic=true)
    await expect(page.locator('[data-optimistic="true"]')).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator('[data-optimistic="true"]')).toHaveCount(0);
  });

  test('EDIT contact', async ({ page }) => {
    await page
      .getByRole('row', { name: /El Amrani/i })
      .getByRole('button', { name: /menu/i })
      .click();
    await page.getByRole('menuitem', { name: /modifier/i }).click();
    await page.getByLabel(/email/i).fill('updated@example.ma');
    await page.getByRole('button', { name: /enregistrer/i }).click();
    await expect(page.getByText(/Contact mis a jour/i)).toBeVisible();
  });

  test('DELETE soft contact + verifier retrait liste', async ({ page }) => {
    await page
      .getByRole('row', { name: /El Amrani/i })
      .getByRole('button', { name: /menu/i })
      .click();
    await page.getByRole('menuitem', { name: /supprimer/i }).click();
    await page.getByRole('button', { name: /confirmer/i }).click();
    await expect(page.getByText(/El Amrani/i)).not.toBeVisible();
  });
});
```

---

### 8.3 `apps/web-broker/e2e/contacts/contacts-bulk.spec.ts` (~180 lignes, 3 tests)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBrokerUser, seedContacts } from '../fixtures/auth-helpers';

test.describe('Contacts Bulk Actions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsBrokerUser(page);
    await seedContacts(page, 10);
    await page.goto('/fr/contacts');
  });

  test('bulk tag : applique tags a N contacts', async ({ page }) => {
    // Select first 3 rows
    const rows = page.locator('tbody tr');
    await rows.nth(0).getByRole('checkbox').click();
    await rows.nth(1).getByRole('checkbox').click();
    await rows.nth(2).getByRole('checkbox').click();

    await expect(page.getByText(/3 contacts selectionnes/i)).toBeVisible();

    await page.getByRole('button', { name: /tag/i }).click();
    await page.getByLabel(/tags a ajouter/i).fill('vip');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /appliquer/i }).click();

    await expect(page.getByText(/3 contacts tagues/i)).toBeVisible();
  });

  test('bulk export CSV stream telecharge fichier', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await rows.nth(0).getByRole('checkbox').click();
    await rows.nth(1).getByRole('checkbox').click();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /exporter/i }).click();
    await page.getByRole('button', { name: /telecharger/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/contacts.*\.csv/);
  });

  test('bulk delete affiche confirmation et retire les contacts', async ({ page }) => {
    const rows = page.locator('tbody tr');
    await rows.nth(0).getByRole('checkbox').click();
    await rows.nth(1).getByRole('checkbox').click();

    await page.getByRole('button', { name: /supprimer/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /confirmer/i }).click();

    await expect(page.getByText(/2 contacts supprimes/i)).toBeVisible();
  });
});
```

---

### 8.4 `apps/web-broker/e2e/contacts/contacts-detail.spec.ts` (~200 lignes, 3 tests)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBrokerUser, seedContactWithTimeline } from '../fixtures/auth-helpers';

test.describe('Contact Detail Page', () => {
  let contactId: string;

  test.beforeEach(async ({ page }) => {
    await loginAsBrokerUser(page);
    contactId = await seedContactWithTimeline(page);
  });

  test('affiche tabs Info / Timeline / Deals / Polices / Documents / Communications', async ({ page }) => {
    await page.goto(`/fr/contacts/${contactId}`);

    await expect(page.getByRole('tab', { name: /info/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /timeline/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /deals/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /polices/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /documents/i })).toBeVisible();
  });

  test('timeline groupes par date avec icones par type', async ({ page }) => {
    await page.goto(`/fr/contacts/${contactId}`);
    await page.getByRole('tab', { name: /timeline/i }).click();

    await expect(page.locator('[data-interaction-type="call"]').first()).toBeVisible();
    await expect(page.locator('[data-interaction-type="email"]').first()).toBeVisible();
    await expect(page.locator('[data-interaction-type="whatsapp"]').first()).toBeVisible();

    // Filtre toggle : enleve les emails
    await page.getByRole('checkbox', { name: /email/i }).click();
    await expect(page.locator('[data-interaction-type="email"]')).toHaveCount(0);
  });

  test('quick actions ouvre dialogs Send Message / Schedule / Create Deal', async ({ page }) => {
    await page.goto(`/fr/contacts/${contactId}`);

    await page.getByRole('button', { name: /envoyer message/i }).click();
    await expect(page.getByRole('dialog', { name: /envoyer message/i })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /planifier/i }).click();
    await expect(page.getByRole('dialog', { name: /planifier/i })).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: /creer deal/i }).click();
    await expect(page.getByRole('dialog', { name: /creer deal/i })).toBeVisible();
  });
});
```

---

## 9. Endpoints API consommes (Sprint 8 + 9 + 10 + 14)

| Methode | Endpoint | Sprint origine | Usage frontend |
|---------|----------|----------------|-----------------|
| GET     | `/api/v1/crm/contacts` | Sprint 8 | List + filters + cursor pagination |
| GET     | `/api/v1/crm/contacts/:id` | Sprint 8 | Detail Server Component prefetch |
| POST    | `/api/v1/crm/contacts` | Sprint 8 | Create modal submit |
| PATCH   | `/api/v1/crm/contacts/:id` | Sprint 8 | Edit modal submit |
| DELETE  | `/api/v1/crm/contacts/:id` | Sprint 8 | Soft delete (single + bulk) |
| POST    | `/api/v1/crm/contacts/:id/restore` | Sprint 8 | Restore corbeille (UX future Sprint 17) |
| POST    | `/api/v1/crm/contacts/:id/photo` | Sprint 10 | Photo upload multipart |
| POST    | `/api/v1/crm/contacts/bulk-action` | Sprint 8 | Bulk tag / assign / delete |
| GET     | `/api/v1/crm/contacts/export` | Sprint 8 | Export CSV stream blob |
| GET     | `/api/v1/crm/contacts/:id/timeline` | Sprint 8 | Timeline interactions infinite scroll |
| GET     | `/api/v1/crm/contacts/:id/deals` | Sprint 8 | Tab Deals associes |
| GET     | `/api/v1/crm/contacts/:id/policies` | Sprint 14 | Tab Polices souscrites |
| GET     | `/api/v1/crm/contacts/:id/documents` | Sprint 10 | Tab Documents lies |
| GET     | `/api/v1/crm/contacts/:id/communications` | Sprint 9 | Tab Communications history |
| GET     | `/api/v1/crm/tags` | Sprint 8 | Combobox tags pre-loaded top 50 |
| GET     | `/api/v1/crm/members` | Sprint 7 | Owner selector + assign bulk |
| GET     | `/api/v1/crm/custom-fields` | Sprint 8 | Definitions dynamic form fields |
| POST    | `/api/v1/comms/send` | Sprint 9 | Quick action Send Message |
| GET     | `/api/v1/booking/availability` | Sprint 8 booking | Schedule appointment slots |
| POST    | `/api/v1/booking/appointments` | Sprint 8 booking | Schedule appointment submit |
| POST    | `/api/v1/crm/deals` | Sprint 8 | Quick action Create Deal pre-rempli |

**Headers requis sur tous appels** :
- `Authorization: Bearer ${access_token}` (Sprint 5)
- `x-tenant-id: ${current_tenant_id}` (Sprint 6)
- `x-trace-id: ${crypto.randomUUID()}` (observability)
- `Idempotency-Key: ${uuid}` (POST/PATCH/DELETE only)
- `Accept-Language: ${locale}` (i18n responses)

---

## 10. Criteres de validation V1-V28

### P0 (16 criteres bloquants)

- **V1 (P0)** : `pnpm --filter @insurtech/web-broker dev` page `/fr/contacts` charge HTTP 200 < 1s sans erreur console.
- **V2 (P0)** : DataTable affiche 50 contacts pagine par defaut avec colonnes (avatar+name, email, phone, company, segment, last_interaction, owner, actions).
- **V3 (P0)** : Recherche debounce 300ms : aucune requete API n'est envoyee avant les 300ms d'inactivite.
- **V4 (P0)** : Filtres segment + tags + assigned_to synchronises avec URL via nuqs (`?segments=lead,prospect&tags=vip`).
- **V5 (P0)** : Pagination cursor : bouton "Suivant" charge la page suivante via `cursor` param ; "Precedent" revient.
- **V6 (P0)** : Tri par 6 options (created_at asc/desc, last_name asc/desc, last_interaction_at desc, segment) fonctionne et persiste URL.
- **V7 (P0)** : Bulk actions visibles si selection > 0 : Tag / Assign / Export / Delete + compteur.
- **V8 (P0)** : Modal Create avec validation Zod : CIN MA pattern strict, phone E.164 auto-correct, email RFC 5322, consent CNDP required.
- **V9 (P0)** : Modal Edit pre-rempli avec data contact ; submit PATCH partiel.
- **V10 (P0)** : Optimistic UI Create : contact apparait immediatement avec `data-optimistic="true"`, replace par data serveur < 2s.
- **V11 (P0)** : Optimistic UI fail revert : si POST 500, contact retire et toast erreur.
- **V12 (P0)** : Page detail `/contacts/[id]` charge avec 6 tabs (Info / Timeline / Deals / Polices / Documents / Communications).
- **V13 (P0)** : Timeline groupes par date (header sticky) avec 8 types interactions icones + couleurs.
- **V14 (P0)** : Quick actions buttons : Send Message / Schedule Appointment / Create Deal / Generate Quote operational.
- **V15 (P0)** : Soft delete contact : disparait de la liste UI, backend conserve avec `deleted_at`.
- **V16 (P0)** : Tests Vitest 15+ tests passent, Playwright 12+ tests passent en CI.

### P1 (7 criteres importants)

- **V17 (P1)** : RBAC UI : `broker_assistant` ne voit pas bouton "Supprimer" (masque + backend rejette).
- **V18 (P1)** : Mobile responsive : Sheet bottom remplace Dialog desktop < 768px.
- **V19 (P1)** : RTL correct ar-MA / ar : layout flip, icones miroir, ordre actions inverse.
- **V20 (P1)** : Custom fields dynamiques rendent types text/number/date/select/boolean correctement.
- **V21 (P1)** : Bulk export CSV stream telecharge fichier avec BOM UTF-8 + headers locales.
- **V22 (P1)** : Photo upload max 5MB, message clair si depasse.
- **V23 (P1)** : Sentry PII scrubbing : `cin`, `email`, `phone` jamais en plain text dans Sentry events.

### P2 (5 criteres nice-to-have)

- **V24 (P2)** : Virtualization table si > 5000 contacts (performance scroll).
- **V25 (P2)** : Persist column resizing dans localStorage `contacts-table-sizing-v1`.
- **V26 (P2)** : Highlight matches dans table cells lors de recherche.
- **V27 (P2)** : Keyboard shortcuts : `c` ouvre Create modal, `/` focus search.
- **V28 (P2)** : Coverage tests > 80% sur lib/utils + composants critiques.

---

## 11. Edge cases (12 EC)

1. **EC1 -- CIN duplicate** : POST avec CIN existant -> backend retourne 409 Conflict avec `existing_contact_id`. Front affiche modal "Ce CIN existe deja pour [Nom complet]. Voulez-vous voir le contact ?" avec bouton "Voir".

2. **EC2 -- Phone format auto-correct** : User tape `0612345678` -> Zod transform auto-converti `+212612345678`. UX : afficher la valeur normalisee dans le champ apres `onBlur`.

3. **EC3 -- Email duplicate** : POST avec email existant -> backend retourne 409. Toast warning "Email deja utilise par un autre contact" + link vers existing.

4. **EC4 -- Soft delete restore** : Contact supprime apparait dans page corbeille `/contacts/trash` (Sprint 17). Restore bouton appelle POST `/contacts/:id/restore`. Disponible 30 jours.

5. **EC5 -- Bulk action 0 selection** : Selection vide -> boutons Bulk disabled. Toast "Selectionnez au moins un contact" si tentative via API.

6. **EC6 -- Search caracteres arabes** : User tape `محمد` -> backend normalise via `unaccent` + `arabic_stem`. Match `Mohamed`, `Mohammed`, `محمّد` (avec shadda).

7. **EC7 -- Timeline empty** : Aucune interaction -> Card centre "Aucune interaction enregistree" + CTA "Ajouter une note" (Sprint 17).

8. **EC8 -- Optimistic UI fail revert** : POST timeout 30s ou 500 -> rollback cache `previousLists`, toast erreur "Echec de creation, reessayez".

9. **EC9 -- Large list >10000 contacts** : `total_count > 5000` -> active `<ContactsTableVirtualized>` avec `@tanstack/react-virtual` (rows visibles + overscan 10).

10. **EC10 -- Custom fields rendering dynamic** : Field type `select` avec 0 options -> warning admin "Definir options". Type `date` -> ISO 8601 string parse + locale display.

11. **EC11 -- Photo upload >5MB** : File picker accept image/* ; on `onChange` check `file.size > 5 * 1024 * 1024` -> toast error "Photo > 5MB, compresser SVP". Pas d'upload.

12. **EC12 -- Network offline pendant submit** : `navigator.onLine === false` -> Disable submit + banner "Hors ligne, reconnectez-vous". Future Sprint 17+ : queue local offline.

---

## 12. Conformite Maroc

### Loi 09-08 -- Protection donnees personnelles (CNDP)

- **CIN classified PII** : pattern `[A-Z]{1,2}\d{1,7}` -> jamais dans URL en clair (UUID en URL seulement), jamais dans logs (`maskCin()` avant log), jamais dans Sentry events (`beforeSend` scrub).
- **Consent banner obligatoire** : modal Create exige checkbox "Le contact a consenti au traitement" + select source (verbal / written / online_form / imported_legacy) + auto-set `consent_given_at = NOW()`.
- **Email + phone considered PII** : Sentry scrub key `email`, `phone`. Logs Pino exclus via redact rules `req.body.email`, `req.body.phone`, `req.body.cin`.
- **CNDP declaration** : ce traitement releve d'une declaration prealable (numero a renseigner dans Settings tenant Sprint 11). Toutes operations create/update/delete log dans audit_log.

### Loi 31-08 -- Droit a l'oubli

- **Soft delete imediate** : flag `deleted_at` masque UI immediat.
- **Hard delete batch apres 5 ans** : job CRON Sprint 31 efface physiquement les contacts dont `deleted_at < NOW() - INTERVAL '5 years'` ET non lies a une police active.
- **Restore window** : 30 jours dans `/contacts/trash` (Sprint 17 future), bouton "Restaurer".
- **Audit retention** : `audit_log` Sprint 6 conserve trace 5 ans (exigence ACAPS).

### ACAPS Circulaire 17/2023 -- Reporting reglementaire

- **Audit trail required** : tous create/update/delete contact ecrit dans `audit_log` avec actor_id + tenant_id + entity_id + diff JSON + ip + user_agent + timestamp.
- **Diff JSON** : capture old vs new values pour update. Stocke chiffre AES-256 (Sprint 7 vault).

### Timezone Africa/Casablanca

- Tous timestamps backend UTC ISO 8601.
- Display front via `date-fns-tz formatInTimeZone(date, 'Africa/Casablanca', pattern, locale)`.
- Pas de DST (Maroc fige a UTC+1 hors Ramadan -> UTC+0 pendant Ramadan).

### Format phone +212

- Validation E.164 stricte : `+212` + (5/6/7) + 8 chiffres.
- Auto-correct local `0XX...` -> `+212XX...`.
- Display LTR force meme en RTL contexte (eviter ambiguite read order).

### Format ICE compagnie (lien company_id)

- 15 chiffres pattern `^\d{15}$`.
- Checksum custom MA (Modulo 97) -- validate cote backend Sprint 8.

---

## 13. Conventions completes (rappel)

- **Indentation** : 2 espaces, jamais de tabs.
- **Quotes** : single quotes en TS/TSX.
- **Imports** : ordonnees -- React/Next d'abord, libs externes, puis locaux via `@/`, finalement types.
- **Naming** :
  - Components : PascalCase `ContactFormDialog`.
  - Hooks : camelCase prefix `use` `useContactsFilters`.
  - Utils : camelCase `formatPhoneMaDisplay`.
  - Types : PascalCase `Contact`, `ContactsListFilters`.
  - Constantes : SCREAMING_SNAKE `CIN_MA_PATTERN`.
  - Files : kebab-case `contact-form-dialog.tsx`.
- **JSDoc** : tous exports publics doivent avoir `@param` + `@returns` + `@example` quand utile.
- **No emoji** : decision-006 strictement applique. Accents francais et caracteres arabes OK.
- **No console.log** en src/ (uniquement tests).
- **No `any`** sauf type guards documentes.
- **Tests** : suffix `.spec.ts` ou `.spec.tsx`, dossier `__tests__` colocalise.
- **Async params Next 15** : tous `params` et `searchParams` typed `Promise<...>` et `await` requis.
- **`'use client'`** : top-of-file uniquement si necessaire. Server Components par defaut.
- **shadcn/ui** : importer depuis `@insurtech/shared-ui`, pas duplique localement.
- **TanStack Query keys** : hierarchical via `contactQueryKeys.list(filters)`.
- **Optimistic mutations** : pattern onMutate / onError / onSettled standard.
- **RTL** : utiliser `me-`, `ms-`, `start-`, `end-` Tailwind utilities, JAMAIS `ml-`, `mr-`, `left-`, `right-` direct.
- **i18n** : tous textes via `useTranslations('contacts.xxx')`. Cles dans namespace hierarchique.
- **Date formatting** : `date-fns-tz formatInTimeZone(..., 'Africa/Casablanca', ...)`.
- **Audit log** : ne pas dupliquer cote front. Backend Sprint 6 capture automatique.
- **Sentry scrub** : `beforeSend` filtre `cin`, `email`, `phone`, `cnss`, `iban` -> `[REDACTED]`.
- **Cookies** : `httpOnly` + `Secure` + `SameSite=lax`. Aucun token dans localStorage.

---

## 14. Stack specifique (versions confirmees)

| Package | Version | Justification |
|---------|---------|---------------|
| `@tanstack/react-table` | `8.20.6` | DataTable headless integre shadcn |
| `@tanstack/react-virtual` | `3.10.9` | Virtualization > 5000 rows (lazy) |
| `@tanstack/react-query` | `5.62.7` | Sprint 4 deja install, mutations optimistic |
| `@tanstack/react-query-devtools` | `5.62.7` | Dev only |
| `react-hook-form` | `7.54.0` | Form management uncontrolled |
| `@hookform/resolvers` | `3.9.1` | Zod resolver |
| `zod` | `3.24.1` | Validation runtime |
| `nuqs` | `2.0.4` | URL state filters App Router |
| `sonner` | `1.7.1` | Toasts notifications |
| `date-fns` | `4.1.0` | Date utils |
| `date-fns-tz` | `3.2.0` | Timezone Africa/Casablanca |
| `lucide-react` | `0.469.0` | Icones |
| `cmdk` | `1.0.4` | Command palette + Combobox tags |
| `@dnd-kit/core` | `6.3.1` | Reserve Sprint 4.3.7 (kanban deals) |
| `react-day-picker` | `9.4.4` | Calendar shadcn |
| `papaparse` | `5.4.1` | CSV parsing fallback client (export server-side prefer) |
| `mark.js` | `8.11.1` | Highlight search matches (P2) |

---

## 15. Performance budget

| Metric | Cible | Note |
|--------|-------|------|
| FCP (First Contentful Paint) | < 800ms | Server Component initial fetch |
| LCP (Largest Contentful Paint) | < 1.5s | Skeleton DataTable durant fetch |
| TTI (Time to Interactive) | < 2.5s | Hydration TanStack Query state |
| CLS (Cumulative Layout Shift) | < 0.1 | Skeletons same height que rows |
| INP (Interaction to Next Paint) | < 200ms | Filters debounce + optimistic UI |
| Bundle size route | < 200 KB gzip | Code split par route App Router |
| Recherche keystroke -> request | 300ms debounce | `useDebouncedValue` |
| Pagination cursor click -> data | < 500ms | Cache `keepPreviousData` |
| Modal open -> mounted | < 100ms | Pas de fetch async dans open |

---

## 16. Telemetry & Observability

- **Sentry** : `Sentry.captureException` sur tous `onError` mutations + queries 5xx. Tag `feature: 'contacts'`.
- **Web Vitals** : envoye via `next/web-vitals` -> endpoint `/api/v1/metrics/web-vitals` (Sprint 13 livre).
- **Custom events** : `analytics.track('contact_created', { segment, has_phone, has_email })`, `analytics.track('contact_deleted', { reason })`, `analytics.track('bulk_action', { action, count })`.
- **Trace ID propagation** : header `x-trace-id` injecte interceptor Sprint 4 -> propage backend OpenTelemetry.
- **Log levels** : Sprint 13 livre `logger.info('contacts.list', { filters: maskFilters(filters) })`, `logger.warn`, `logger.error`.

---

## 17. Notes de mise en oeuvre & ordre d'execution

### Ordre d'implementation recommande (7h)

1. **0h00 -- 0h30** : Setup schemas Zod + types (L15).
2. **0h30 -- 1h00** : Utils CIN + phone validators + tests unitaires (L16, L17, 7.1, 7.2).
3. **1h00 -- 2h00** : API client + TanStack Query hooks (L13, L14).
4. **2h00 -- 2h30** : Hook nuqs filters + debounced value (L18, hooks/use-debounced-value).
5. **2h30 -- 3h30** : Page Server Component + Client wrapper (L1, contacts-page-client).
6. **3h30 -- 4h30** : DataTable columns + sort + pagination (L3).
7. **4h30 -- 5h00** : Filters component + segment chips + tags Combobox (L4).
8. **5h00 -- 5h45** : Modal Create/Edit Form Dialog + custom fields (L5, L21).
9. **5h45 -- 6h15** : Detail page tabs + Timeline + Quick actions (L2, L6, L12).
10. **6h15 -- 6h45** : Bulk actions + dialogs (L7 + bulk-tag/assign/export).
11. **6h45 -- 7h00** : Tests Playwright critiques (CRUD + search debounce + bulk).

### Anti-patterns a eviter

- NE PAS appeler `fetch()` directement dans Server Components -- toujours via `contactsApi` typed.
- NE PAS oublier `signal` AbortController dans queryFn -> spam requests.
- NE PAS muter `data` retourne par TanStack Query -> immutable, utiliser `setQueryData` ou `select`.
- NE PAS skip consent CNDP -> bug legal.
- NE PAS afficher CIN dans URL ou logs en clair.
- NE PAS construire Zod schema dans render body -> memoize.
- NE PAS oublier `aria-label` sur boutons icone-only (a11y WCAG).
- NE PAS coder en dur `'fr'` -> toujours via `useLocale()` ou `params.locale`.

### Definition of Done

- [ ] Tous L1-L30 livrables implementes
- [ ] Tests Vitest 15+ verts (`pnpm test`)
- [ ] Tests Playwright 12+ verts (`pnpm test:e2e`)
- [ ] `pnpm typecheck` zero erreur
- [ ] `pnpm lint --max-warnings 0` propre
- [ ] Lighthouse Performance >= 70 sur `/fr/contacts`
- [ ] Coverage > 80% sur `src/lib/utils/` et `src/components/contacts/`
- [ ] Code review approuve par lead frontend + lead backend (mention si API gap)
- [ ] Documentation inline JSDoc complete
- [ ] Branche fusionnee dans `main` apres CI green

### Handoff vers 4.3.6 Companies

La tache 4.3.6 reutilisera STRICTEMENT le pattern etabli ici :
- Meme structure `app/[locale]/(protected)/companies/page.tsx` + `[id]/page.tsx`.
- Memes hooks pattern `useCompaniesList`, `useCompanyDetail`, `useCreateCompany`, `useUpdateCompany`, `useDeleteCompany`, `useBulkAction`.
- Meme structure `companies-table.tsx`, `companies-filters.tsx`, `company-form-dialog.tsx`.
- Validation ICE pattern `^\d{15}$` + checksum Modulo 97 (utility `lib/utils/ice-ma-validator.ts`).
- Detail tabs : Info / Contacts / Deals / Polices / Documents.

Toute deviation reclame justification dans PR description.

---

**Fin du prompt task-4.3.5 v1.0.**

Ce document est auto-suffisant : aucune lecture annexe necessaire pour implementer la tache. Les meta-prompts B-04 (Sprint 4 bootstrap) et B-16 (Sprint 16 sommaire) ne sont consultes qu'en cas de doute strategique. Toutes les dependances Sprint 8 (CRM), Sprint 9 (Comms), Sprint 10 (Docs), Sprint 14 (Polices) sont supposees livrees et stables.
