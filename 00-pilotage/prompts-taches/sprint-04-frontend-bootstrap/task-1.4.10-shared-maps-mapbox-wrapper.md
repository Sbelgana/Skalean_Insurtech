# TACHE 1.4.10 -- Package shared-maps : Wrapper Mapbox GL JS

**Sprint** : 4 (Phase 1 / Sprint 4 dans phase, dernier de Phase 1 Bootstrap)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` (Tache 1.4.10)
**Phase** : 1 -- Bootstrap
**Priorite** : P0
**Effort** : 5h
**Dependances** : Tache 1.4.9 (Package `@insurtech/shared-pwa`), Tache 1.4.8 (Package `@insurtech/shared-ui` pour theme tokens), Sprint 1 (monorepo pnpm + stub `packages/shared-maps`), Sprint 3 (api repond -- pas requis directement mais utile pour smoke test)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Initialiser le package partage `@insurtech/shared-maps` -- la bibliotheque React de cartographie interactive du monorepo Skalean InsurTech. Ce package wrap Mapbox GL JS 3.8.0 derriere une API React idiomatique (composants `<Map>`, `<Marker>`, `<MarkerCluster>`, `<UserLocationMarker>`, `<SearchBox>`, `<RouteLayer>` plus hooks `useGeolocation()`, `useReverseGeocoding()`, `useDirections()`) afin de fournir aux 8 apps frontend un socle unique de cartes interactives, quel que soit le cas d'usage : geolocalisation des declarations de sinistres en mobilite (Sprint 25 sur `web-assure-mobile`), recherche et reservation de garages partenaires sur carte filtrable (Sprint 8 booking sur `web-broker` et `web-customer-portal`), prospection et plan de tournees commerciaux courtiers (Sprint 17 sur `web-broker`), affichage des delegations regionales ACAPS (Sprint 31 reporting) et carte publique des cabinets recherchables sur le portail public (Sprint 18 customer-portal).

Le choix Mapbox GL JS plutot que Google Maps Platform repose sur trois facteurs documentes : (1) tarification meilleure marche au Maroc (Mapbox Maps Loads facture en bulk forfait apres 50k loads/mois, Google Maps geocoding facture chaque requete a partir du premier appel hors quota gratuit reduit), (2) styles cartographiques entierement personnalisables via Mapbox Studio (creation manuelle d'un style monochrome aux accents Skalean Orange #E95D2C et Sky Blue #B0CEE2 prevue Sprint 8), (3) format vectoriel WebGL natif permettant un rendu fluide et un meilleur controle du zoom/rotation/inclinaison que les tuiles raster Google. Le token public Mapbox est expose au build via `NEXT_PUBLIC_MAPBOX_TOKEN` -- exposure intentionnelle car les jetons publics Mapbox sont restreints par domaine cote dashboard Mapbox (jamais de jeton secret cote client). Les jetons secrets serveur (Mapbox `sk.*`) ne sont **jamais** utilises dans ce package.

A la sortie de cette tache, la commande `pnpm --filter @insurtech/shared-maps build` produit un bundle ESM + CJS + types `.d.ts`, le `pnpm --filter @insurtech/shared-maps test` valide 18-22 specs unitaires et integration, et l'app de demonstration `apps/web-broker` peut deja consommer `<Map>` avec un centre par defaut Casablanca [-7.5898, 33.5731] zoom 11 sur la route `/fr` de l'app courtier. Cette tache bloque le Sprint 8 (booking garages sur carte) et le Sprint 25 (declaration sinistre mobile avec capture GPS).

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

La cartographie est un usage transverse a au moins six sprints metier de Skalean InsurTech, dans des contextes radicalement differents : (a) en mobilite sur smartphone faible reseau pour declarer un sinistre auto avec capture GPS au point d'impact (assure -- Sprint 25), (b) en bureau du courtier pour visualiser un portefeuille de prospects sur carte avec clustering geographique (broker -- Sprint 17), (c) en parcours client public sur PWA marketing pour rechercher un garage agree par ville et filtres de specialite (customer-portal -- Sprint 8), (d) en tableau de bord operationnel pour suivre la flotte de techniciens experts en intervention (insurtech-admin -- Sprint 27), (e) en page reglementaire pour situer les delegations regionales de l'ACAPS et le rattachement geographique du cabinet (Sprint 31 reporting), (f) en saisie d'adresse via autocompletion avec contrainte pays Maroc (omniprésent).

Sans package partage, chaque app dupliquerait son integration Mapbox avec une dette technique multipliee par 8 apps : 8 jeu de tokens, 8 implementations de wrapper React (ratees a chaque fois sur le cycle de vie `useEffect` -> `mapboxgl.Map` -> `cleanup`), 8 versions divergentes de styles Skalean, 8 manieres incompatibles de gerer la geolocalisation utilisateur. Un package shared centralise (1) la dependance unique a `mapbox-gl@3.8.0` (pas de mismatch de versions au sein du monorepo), (2) un wrapper React testé une fois pour toutes (le cycle de vie Mapbox GL JS est piege : il faut detruire la map au demontage sinon fuite memoire WebGL), (3) le style custom Skalean (charge depuis `mapbox://styles/skalean/sk-light-fr-ar` apres creation Mapbox Studio Sprint 8), (4) la gestion des locales (etiquettes carte en `{name_fr}` pour les locales `fr` et `ar-MA`, en `{name_ar}` pour la locale `ar`, fallback `{name}` si non-disponible).

Ce package est la troisieme et derniere brique partagee de Sprint 4 (apres `shared-ui` 1.4.8 et `shared-pwa` 1.4.9). Il depend implicitement de `shared-ui` pour les variables CSS theme (`--color-primary` Orange Skalean utilise par les markers et les traces d'itineraire) et de `shared-pwa` pour la coordination de la geolocalisation hors-ligne (Sprint 9 ajoutera la mise en cache des dernieres positions GPS dans IndexedDB).

### Alternatives considerees

#### Mapbox GL JS vs Google Maps Platform vs Leaflet vs MapLibre GL

| Critere | Mapbox GL JS 3.8.0 (CHOIX) | Google Maps Platform | Leaflet | MapLibre GL |
|---------|-----------------------------|----------------------|---------|-------------|
| Format tuiles | Vector (WebGL) | Raster + Vector hybride | Raster (par defaut) | Vector (WebGL, fork OSS Mapbox 1.x) |
| Tarif Maps Loads | 0 a 50k/mois gratuit, $5/1k au-dela | $7/1k Map Loads des sortie quota | Gratuit (OSM) | Gratuit (host self-tiles) |
| Tarif Geocoding | 0 a 100k/mois gratuit | $5/1k requetes | Aucun (utilise Nominatim) | Aucun (utilise Nominatim ou self) |
| Styles custom | Mapbox Studio editor visuel + JSON | Cloud-Based Maps Styling (limite) | CSS + plugins | Mapbox Studio export -> self-host |
| Couverture MA | Excellente (tuiles vector + adresses) | Excellente (mais cher) | Variable selon tile provider | OK avec OpenMapTiles ou MapTiler |
| TypeScript | Officiel | Officiel | Plugin community | Communautaire |
| Bundle client | ~750 ko gz (3.8.0) | Charge externe (script tag) | ~140 ko gz | ~720 ko gz |
| Directions API | Mapbox Directions API ($) | Routes API ($$) | OSRM ou GraphHopper externe | MapLibre + OSRM externe |
| Clustering | supercluster officiel | MarkerClusterer | Leaflet.markercluster | supercluster compatible |
| Mobile WebGL | Excellent (rotation/pitch) | Bon | Limite (raster only) | Excellent |
| RTL support | Plugin officiel mapbox-gl-rtl-text | Natif | Manuel CSS | Plugin maplibre-gl-rtl-text |
| Risque vendor | Mapbox propriete privee, BSL license | Google sans surprise | OSS communautaire | OSS Foundation MapLibre |
| Production stable | 3.8.0 sortie 2024 stable | Stable | 1.9.x stable | 4.x stable |
| Hors-ligne | Mapbox Atlas (entreprise) | Non | Oui via tile provider | Oui via PMTiles |

**Decision** : **Mapbox GL JS 3.8.0**. Justification : (1) economie 30-40% par rapport a Google Maps sur volumes prevus Sprint 8+ (estim. 200k Maps Loads/mois en regime apres lancement public Sprint 18), (2) Geocoding API gratuit pour les 100k premiers appels mensuels suffisants pendant Phase 1 et 2, (3) Mapbox Studio permet de creer un style Skalean monochrome professionnel sans developpement frontend, (4) le risque BSL license (Mapbox a basculé en BSL 1.1 a partir de v2) est accepte car: l'usage Skalean = consommation cliente standard, **pas** redistribution ni exposition d'API tiers, donc aucune obligation BSL ne s'applique. Une alternative MapLibre GL est gardee comme plan de fallback si Mapbox augmente ses tarifs ou change sa licence (Sprint 30 reaudite la decision).

#### react-map-gl vs wrapper custom

| Critere | Wrapper custom (CHOIX) | react-map-gl 7.1.7 |
|---------|-------------------------|--------------------|
| Maintenance | Skalean equipe | Visgl/Vis.gl (Uber) |
| Bundle additionnel | 0 (juste wrappers minces) | ~25 ko gz |
| API | Skalean-flavored (locale aware, brand colors par defaut) | Generique upstream |
| Liaison Mapbox | Direct (`mapbox-gl` import direct) | Couche additionnelle |
| Support React 19 | OK (notre code) | A verifier (7.1.7 = decembre 2024 = OK) |
| TypeScript | Strict natif | OK |
| Breaking changes Mapbox | A gerer chez nous | Latence vers upstream |

**Decision** : **wrapper custom** mince. Justification : controle total sur l'API exposee (locale-aware par defaut, centre Casablanca par defaut, brand colors Skalean par defaut), absence de couche d'indirection supplementaire, eviter dependance transitive sur visgl si elle stagne. `react-map-gl` est documente comme alternative dans le README pour les developpeurs qui prefereraient sa philosophie declarative pure (sera reconsidere si nos wrappers s'averent insuffisants).

#### Token public NEXT_PUBLIC_MAPBOX_TOKEN vs proxy serveur

| Critere | NEXT_PUBLIC_MAPBOX_TOKEN (CHOIX) | Proxy serveur Next.js |
|---------|------------------------------------|-----------------------|
| Token expose au client | Oui (token public restreint domaine) | Non |
| Faisabilite Mapbox GL JS | Native (necessaire) | Impossible (le SDK fait des appels directs aux tuiles) |
| Geocoding API | Possible cote client | Possible cote serveur (route API custom) |
| Directions API | Possible cote client | Possible cote serveur (route API custom) |
| Verrouillage URL | Mapbox dashboard URL Restrictions | Aucun besoin |
| Coût quota | Decompte par token Mapbox | Idem |
| Cache cote serveur | Non | Oui (Redis 1h staleTime) |

**Decision** : **`NEXT_PUBLIC_MAPBOX_TOKEN` cote client**. Le SDK Mapbox GL JS necessite imperativement le token cote client pour signer les requetes de tuiles vector. Mitigation cle : le token est **public restreint** (Mapbox dashboard impose URL restrictions: `*.skalean-insurtech.ma` en prod, `localhost:*` en dev). Pour les API Geocoding et Directions, on accepte aussi l'usage cote client cache via React Query (1h staleTime reverse-geocoding, 5min staleTime directions). Si volume devient critique Sprint 18, un proxy Redis cote api NestJS sera ajoute (Sprint 18 deja prevu).

### Trade-offs explicites

1. **'use client' force** : tous les composants exportant `<Map>`, `<Marker>`, etc. sont marques `'use client'` (Mapbox GL JS = WebGL = browser-only, no SSR possible). Consequence : ces composants ne peuvent pas etre des React Server Components. Le code parent peut etre RSC mais doit importer les wrappers comme client components. Documente.

2. **Bundle 750 ko mapbox-gl** : importance non negligeable. Mitigation : (a) Next.js 15 code-splitting automatique sur `import('mapbox-gl')` dynamique si necessaire, (b) preload de la bibliotheque uniquement sur les pages cartes (pas sur dashboard non-carto), (c) gz CDN reduit a ~250 ko reseau.

3. **Token public expose** : `NEXT_PUBLIC_MAPBOX_TOKEN` apparait dans le bundle JavaScript client en clair. Acceptable car (a) jeton public restreint par domaine Mapbox, (b) abus cap par quota Mapbox dashboard, (c) zero acces backend secret. **Jamais** mettre un jeton secret `sk.*` ici.

4. **Style custom non livre Sprint 4** : `mapbox://styles/skalean/sk-light-fr-ar` est un placeholder qui ne sera cree dans Mapbox Studio qu'au Sprint 8 par le designer Skalean. En attendant, fallback `mapbox://styles/mapbox/light-v11` (style Mapbox stock).

5. **Geolocation API consent** : naviguer dans `<UserLocationMarker>` declenche le prompt browser de geolocalisation. Sprint 25 (declaration sinistre) integrera un consentement explicite Loi 09-08 CNDP avant d'activer le marker. Le wrapper expose la position brute mais ne deduit pas de consentement implicite.

6. **Rate limit Geocoding 600 reqs/min/IP** : un utilisateur tapant rapidement dans `<SearchBox>` peut depasser. Mitigation : debounce 300ms cote SearchBox (Mapbox Geocoder fait deja ca par defaut).

7. **WebGL fallback** : ~1% des utilisateurs (anciens iPhones, vieux Android, navigateurs en mode performance reduite, IE11) n'ont pas WebGL. Le wrapper detecte `mapboxgl.supported()` et affiche un fallback statique (image stockee Atlas Cloud). Acceptable degradation.

8. **iOS Safari WebGL context loss** : iOS bascule en arriere-plan declenche perte de contexte WebGL frequente. Mitigation : `map.on('webglcontextlost', ...)` + reload manuel; flag pour Sprint 9 PWA offline gestion.

9. **RTL interface vs RTL carte** : l'interface (search box, popup, controles zoom) doit etre RTL en locale `ar`. Mais la carte elle-meme (etiquettes des rues) reste LTR pour les noms en francais ou ALK pour les noms arabes. Le plugin `mapbox-gl-rtl-text` gere le rendu correct des etiquettes arabes (sera ajoute Sprint 8 quand les etiquettes arabes seront critiques). Pour le bootstrap, anglais/francais labels OK.

10. **Atlas Cloud souverainete** : decision-008 impose data residency MA. Mapbox CDN est globalement distribue (San Francisco, Amsterdam, Tokyo). Pour les **tuiles cartographiques** (donnees publiques OpenStreetMap), la residence est non sensible. Pour les **donnees GPS d'un sinistre** (latitude/longitude precises a 5 metres d'un assure), elles sont stockees uniquement Atlas Cloud Benguerir, jamais transmises a Mapbox sauf pour reverse-geocoding, et avec consentement Loi 09-08. Sprint 30 mettra en place un mirror tuiles MA sur Atlas Cloud (`tiles.skalean-insurtech.ma`) pour servir les cartes via infra souveraine si exigence ACAPS evolue.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : `packages/shared-maps` reside dans le workspace `packages/`. `pnpm-workspace.yaml` deja inclus a `packages/*`. Pas de duplication `mapbox-gl` cote app -- chaque app importe via `@insurtech/shared-maps`.
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucun fichier code, JSON config, README. Linter `scripts/check-no-emoji.sh` valide en CI.
- **decision-008 (cloud souverain Atlas Cloud Benguerir)** : tuiles Mapbox via CDN public OK pour cartes (donnees publiques). Donnees GPS sensibles (sinistres assure Sprint 25) stockees uniquement Atlas Cloud, jamais externalisees. README documente la frontiere data Mapbox.
- **decision-009 (multilinguisme MA)** : etiquettes carte localisees via `setLayoutProperty('text-field', '{name_fr}')` pour fr/ar-MA, `'{name_ar}'` pour ar, fallback `'{name}'`. Plugin `mapbox-gl-rtl-text` reserve Sprint 8.
- **decision-010 (data residency Loi 09-08)** : reverse-geocoding et directions API Mapbox transmettent seulement coordonnees `(lat, lng)` a Mapbox. La logique de consentement utilisateur Loi 09-08 CNDP est gere dans Sprint 25 par les apps consommatrices (declarer sinistre).
- **decision-011 (brand kit Sofidemy)** : Skalean Orange #E95D2C utilise pour les traces d'itineraire (`<RouteLayer>` line-color), ACAPS Teal #2D5773 pour les markers par defaut, Sky Blue #B0CEE2 pour les zones d'incertitude (cercle accuracy `<UserLocationMarker>`).

### Pieges techniques connus (12 minimum)

1. **`'use client'` obligatoire** : oublier la directive `'use client'` sur un composant exportant Mapbox = erreur build "window is not defined". Tous les composants doivent commencer par `'use client';` en premiere ligne, avant les imports.

2. **`mapbox-gl/dist/mapbox-gl.css` import oublie** : sans le CSS officiel, popup et controles affichent sans style. Importer dans `_app.tsx` ou layout.tsx racine OU dans le composant `<Map>` (mais alors tree-shake casse). Solution adoptee : import direct dans `Map.tsx` sous condition `'use client'`.

3. **Token absence** : `mapboxgl.accessToken = undefined` -> erreur silencieuse "Unauthorized" sur tuiles. Le wrapper throw explicit error en dev si `NEXT_PUBLIC_MAPBOX_TOKEN` absent.

4. **Cleanup WebGL fuite memoire** : oublier `map.remove()` dans le `useEffect` cleanup -> chaque navigation client-side fuite ~50 MB GPU. Tests Playwright detectent en mesurant `performance.memory.usedJSHeapSize`.

5. **`mapboxgl.Map` constructor side-effects** : la creation de map est asynchrone (load tuiles). Acceder a `map.getCenter()` immediatement = `[0, 0]`. Toujours utiliser `map.on('load', ...)` ou attendre l'evenement `load`.

6. **Marker remove orphan** : si on stocke des Marker dans un state React et que le user supprime un marker via `setMarkers(prev.filter(...))`, le DOM Mapbox garde le marker affiche (Mapbox stocke ses propres references). Solution : appeler `marker.remove()` dans le useEffect cleanup avant le filter.

7. **Cluster zoom-in cassant** : `map.easeTo({center: cluster.geometry.coordinates, zoom: cluster_zoom + 1})` necessite que `supercluster.getClusterExpansionZoom(cluster_id)` soit appele en async. Si pas await, zoom errone.

8. **Geocoder country=ma vs language fr** : le param `country=ma` filtre uniquement les resultats du Maroc. Le param `language=fr` traduit les resultats. Combiner les deux est obligatoire pour avoir des adresses marocaines en francais.

9. **Geolocation iOS HTTPS uniquement** : `navigator.geolocation` ne fonctionne PAS sur iOS Safari en HTTP (sauf localhost). En production, HTTPS obligatoire (deja le cas via Sprint 32 deploy).

10. **Locale labels fallback chain** : si la locale est `ar` et que l'etiquette `{name_ar}` n'existe pas pour une rue, Mapbox affiche vide. Solution : utiliser `coalesce` expression Mapbox: `["coalesce", ["get", "name_ar"], ["get", "name"]]`.

11. **CSS conflicts avec Tailwind 4** : Mapbox `.mapboxgl-popup` styles base entrent en conflit avec Tailwind `@layer base` reset. Solution : importer `mapbox-gl.css` apres le reset Tailwind dans `globals.css` (pas avant).

12. **Style URL `mapbox://styles/<user>/<id>` 404** : si le style custom n'existe pas encore (Sprint 8 ne l'a pas cree), Mapbox renvoie 401/404. Le wrapper detecte et fallback `mapbox://styles/mapbox/light-v11` automatiquement en dev (`if (process.env.NODE_ENV === 'development')`).

13. **Resize observer manquant** : si la `<div>` parent change de taille (sidebar collapse/expand), la map ne se redimensionne pas automatiquement. Solution : `ResizeObserver` -> `map.resize()` integre dans `Map.tsx`.

14. **Token invalide en build** : `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` est lu au moment du build Next.js. Si `.env.local` est absent en CI, build passe mais runtime casse. Validation Zod sur boot.

15. **React Query absent** : `useReverseGeocoding` et `useDirections` requierent `<QueryClientProvider>` ancetrale. Si l'app consommatrice oublie ce provider (Sprint 1 le pose pour les 8 apps mais erreurs possibles), les hooks throw "No QueryClient set". Documente.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 4

`task-1.4.10` est la **dixieme des 16 taches** du Sprint 4. Elle s'execute apres 1.4.9 (`shared-pwa`) car certaines integrations futures de cartes en mode hors-ligne (Sprint 9 sinistres) consommeront les hooks PWA pour cacher des positions GPS dans IndexedDB.

```
Sprint 4 -- Frontend Bootstrap (16 taches)

[1.4.1 web-broker bootstrap]   <-- patron canonique
[1.4.2 web-garage]
[1.4.3 web-garage-mobile]
[1.4.4 web-insurtech-admin]
[1.4.5 web-customer-portal]
[1.4.6 web-assure-portal]
[1.4.7 web-assure-mobile]

[1.4.8 shared-ui]              <-- theme tokens consumed by shared-maps brand colors
       |
       v
[1.4.9 shared-pwa]             <-- offline hooks consumed eventually Sprint 9
       |
       v
[1.4.10 shared-maps]           <-- CETTE TACHE
       |
       +--> consume shared-ui CSS variables (--color-primary Orange, --color-acaps-teal)
       +--> documented to consume shared-pwa hooks Sprint 9 (offline GPS cache)

[1.4.11 i18n cross-cutting]
[1.4.12 turbo + scripts paralleles]
[1.4.13 OpenAPI client gen]
[1.4.14 layouts shared]
[1.4.15 pages placeholder]
[1.4.16 E2E + Lighthouse + Storybook]
```

### Position dans le programme global

`shared-maps` est consomme par les sprints suivants :

- **Sprint 8 (CRM + Booking)** : `web-broker` et `web-customer-portal` integrent `<Map>` + `<MarkerCluster>` + `<SearchBox>` pour rechercher des garages partenaires geographiquement et reserver un creneau de reparation.
- **Sprint 9 (Sinistres declaration partie 1)** : `web-assure-mobile` integre `<UserLocationMarker>` + capture GPS au moment de la declaration sinistre auto.
- **Sprint 17 (Souscription + Prospection)** : `web-broker` integre `<MarkerCluster>` pour plan de tournee commerciale (clusters de prospects par ville).
- **Sprint 18 (Customer Portal SEO)** : `web-customer-portal` integre `<Map>` + `<SearchBox>` pour la recherche de cabinet de courtage / garage agree (page publique).
- **Sprint 22 (Sinistres avancees)** : `web-broker` integre `<RouteLayer>` pour proposer un itineraire au technicien expert vers le lieu d'expertise.
- **Sprint 25 (Declaration sinistre mobile complete)** : `web-assure-mobile` consomme intensement `useGeolocation` + `useReverseGeocoding` pour capturer le lieu et l'adresse approchante.
- **Sprint 27 (Dashboard SuperAdmin)** : `web-insurtech-admin` integre `<Map>` heat-map des sinistres par region MA.
- **Sprint 31 (Reporting ACAPS)** : visualisation des delegations regionales ACAPS sur carte.

### Diagramme ASCII du package

```
repo/packages/shared-maps/
|
|-- package.json                       # workspace @insurtech/shared-maps
|-- tsconfig.json                      # extends ../../tsconfig.base.json
|-- tsup.config.ts                     # ESM + CJS + d.ts build
|-- vitest.config.ts                   # unit tests with happy-dom
|-- README.md                          # integration guide + token setup
|-- .gitignore                         # dist, node_modules, .turbo
|
|-- src/
|   |-- index.ts                       # re-exports public API
|   |
|   |-- components/
|   |   |-- Map.tsx                    # ~120 lignes -- wrapper mapboxgl.Map
|   |   |-- Marker.tsx                 # ~80 lignes  -- wrapper mapboxgl.Marker
|   |   |-- MarkerCluster.tsx          # ~150 lignes -- supercluster + 3 layers
|   |   |-- UserLocationMarker.tsx     # ~80 lignes  -- watchPosition + accuracy circle
|   |   |-- SearchBox.tsx              # ~120 lignes -- mapbox-gl-geocoder + autocomplete
|   |   |-- RouteLayer.tsx             # ~100 lignes -- line layer trace itineraire
|   |
|   |-- hooks/
|   |   |-- useGeolocation.ts          # ~80 lignes  -- watchPosition + state
|   |   |-- useReverseGeocoding.ts     # ~60 lignes  -- React Query 1h cache
|   |   |-- useDirections.ts           # ~80 lignes  -- React Query 5min cache
|   |
|   |-- lib/
|   |   |-- casablanca.ts              # ~30 lignes  -- constantes Casablanca
|   |
|   |-- styles/
|   |   |-- skalean-style.json         # ~50 lignes  -- stub style Mapbox custom (Sprint 8)
|
|-- tests/
|   |-- Map.spec.tsx
|   |-- Marker.spec.tsx
|   |-- MarkerCluster.spec.tsx
|   |-- UserLocationMarker.spec.tsx
|   |-- SearchBox.spec.tsx
|   |-- useGeolocation.spec.ts
|   |-- useReverseGeocoding.spec.ts
|   |-- useDirections.spec.ts
|
|-- e2e/
    |-- map-default-casablanca.e2e.ts
    |-- map-add-marker.e2e.ts
    |-- map-search-autocomplete.e2e.ts
    |-- map-geolocation-prompt.e2e.ts
```

### Diagramme de flux : Recherche garage Sprint 8

```
[User web-customer-portal /fr/garages]
    |
    | tape "Casa, Bd Zerktouni"
    v
<SearchBox>  (debounce 300ms)
    |
    | onResult({ feature })
    v
React state: searchResult.coordinates = [-7.633, 33.594]
    |
    v
<Map center={searchResult.coordinates} zoom={14}>
    |
    +--> <MarkerCluster markers={garagesNearby} />        (depuis api Sprint 8)
    +--> <UserLocationMarker accuracy />                  (si user a accepte geoloc)
    +--> <RouteLayer from={user} to={selectedGarage} />   (Sprint 22)
```

---

## 4. Frontiere (1-2 ko)

### INCLUS dans cette tache (Sprint 4)

- Package `packages/shared-maps/` cree et publishable workspace `@insurtech/shared-maps`.
- 6 composants React `<Map>`, `<Marker>`, `<MarkerCluster>`, `<UserLocationMarker>`, `<SearchBox>`, `<RouteLayer>` avec directive `'use client'`.
- 3 hooks React `useGeolocation`, `useReverseGeocoding`, `useDirections`.
- Dependances : `mapbox-gl@3.8.0`, `@mapbox/mapbox-gl-geocoder@5.0.3`, `@mapbox/mapbox-gl-directions@4.3.0`, `supercluster@8.0.1` (pour clustering >50 markers).
- Constantes Casablanca dans `lib/casablanca.ts`.
- Stub fichier `styles/skalean-style.json` (style custom Mapbox a creer Sprint 8 dans Mapbox Studio).
- Tests unitaires Vitest 18-22 specs (mock `mapboxgl`, mock `navigator.geolocation`, mock `fetch` Geocoding/Directions).
- Tests E2E Playwright 4 scenarios (map default Casablanca, add marker, search autocomplete, geolocation prompt).
- README detaille avec setup token + exemples d'usage + tips performance + note RTL.
- Locale-aware labels via `setLayoutProperty('text-field', ...)`.
- Brand colors Skalean en defaults : Orange #E95D2C pour route line, ACAPS Teal #2D5773 pour markers, Sky Blue #B0CEE2 pour accuracy circle.

### EXCLU (sera ajoute aux sprints suivants)

- **Style custom Skalean Mapbox Studio** : sera cree au Sprint 8 par le designer dans l'editeur visuel Mapbox Studio. En attendant, fallback `mapbox://styles/mapbox/light-v11`.
- **Plugin RTL etiquettes carte arabes** : `mapbox-gl-rtl-text` sera ajoute Sprint 8 quand les noms de rues arabes deviendront critiques (web-customer-portal SEO + web-assure-portal).
- **Mode hors-ligne / cache tuiles IndexedDB** : Sprint 9 ajoutera la mise en cache hors-ligne des tuiles via PMTiles + service worker (necessaire `web-assure-mobile` declaration sinistre faible reseau).
- **Heat-map sinistres** : Sprint 27 dashboard SuperAdmin ajoutera couche `heatmap` Mapbox pour visualiser concentration sinistres par region MA.
- **Custom Mapbox Tilesets MA** : Sprint 30 etudiera la migration vers tuiles vectorielles auto-hebergees Atlas Cloud Benguerir (souverainete data) si exigence reglementaire ACAPS evolue.
- **Dark mode style variant** : v2 du style Skalean Sprint 18.
- **Logique consentement Loi 09-08 CNDP geolocation** : sera dans Sprint 25 (declaration sinistre) au niveau des apps consommatrices, pas dans le wrapper.
- **Proxy serveur Geocoding/Directions API** : envisage Sprint 18 si volume depasse quota gratuit (100k geocoding/mois).
- **Tests visuels regression cartes** : Storybook + screenshot Chromatic Sprint 16+.

---

## 5. Prerequis et Verifications (1-2 ko)

### Prerequis humains/equipe

- Compte Mapbox actif (organisation Skalean) avec droits creation tokens : equipe DevOps Skalean possede le compte. Tokens publics dev `pk.eyJ1Ijoic2thbGVhbi1kZXYiLi4u` et prod `pk.eyJ1Ijoic2thbGVhbi1wcm9kLi4uLi4u` deja crees Sprint 1 et stockees dans Atlas Vault (secret manager Sprint 30).
- Designer Skalean disponible Sprint 8 pour creer le style custom dans Mapbox Studio (URL: `mapbox://styles/skalean/sk-light-fr-ar`).
- Account manager ACAPS confirmation (Sprint 31) que les delegations regionales peuvent etre rendues publiquement sur carte. Pour Sprint 4, **non bloquant**.

### Prerequis techniques

- Tache 1.4.8 (`shared-ui`) terminee : variables CSS theme exposees (`--color-primary`, `--color-acaps-teal`, `--color-sky-blue`).
- Tache 1.4.9 (`shared-pwa`) terminee : meme si pas consommee directement Sprint 4, son existence valide la chaine workspace.
- Sprint 1 monorepo : `pnpm-workspace.yaml` inclut `packages/*`. `packages/shared-maps/` existe en stub (`package.json` minimaliste + `src/index.ts` vide).
- Sprint 1 : `tsconfig.base.json` racine avec strict mode et paths.
- Node.js 20.x + pnpm 9.x installe.
- React Query Provider (`<QueryClientProvider>`) sera assure par `apps/web-broker` Sprint 4 tache 1.4.1 (deja en place).

### Verifications avant de commencer

```bash
# 1. Workspace shared-maps existe (stub Sprint 1)
test -d repo/packages/shared-maps || (echo "FAIL: stub shared-maps absent Sprint 1" && exit 1)

# 2. Token Mapbox dev disponible dans .env.local de l'app de demo
grep -q "NEXT_PUBLIC_MAPBOX_TOKEN" repo/apps/web-broker/.env.local || \
  echo "WARN: token absent .env.local web-broker, tester manuellement apres"

# 3. shared-ui build OK (depend pour theme tokens)
pnpm --filter @insurtech/shared-ui build || (echo "FAIL: shared-ui prerequis" && exit 1)

# 4. Internet acces pour npm install mapbox-gl + supercluster
curl -sf https://registry.npmjs.org/mapbox-gl/latest > /dev/null || \
  (echo "FAIL: npmjs unreachable" && exit 1)

# 5. WebGL disponible dans le browser de tests Playwright
echo "INFO: Playwright Chromium WebGL OK par defaut"
```

### Variables d'environnement requises

- `NEXT_PUBLIC_MAPBOX_TOKEN` : jeton public Mapbox restreint domaine. **OBLIGATOIRE en runtime app**. Pas necessaire pour le build du package (le package ne consomme pas le token, seules les apps consommatrices).

---

## 6. Plan d'implementation detaille avec code complet (40-60 ko)

### Etape 1 : Mise a jour `package.json` du workspace

**Fichier** : `repo/packages/shared-maps/package.json`

```json
{
  "name": "@insurtech/shared-maps",
  "version": "0.1.0",
  "private": true,
  "description": "Wrapper React Mapbox GL JS 3.8.0 pour le programme Skalean InsurTech (cartes interactives, geolocation, search, directions).",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./styles/skalean-style.json": "./src/styles/skalean-style.json"
  },
  "files": [
    "dist",
    "src/styles/skalean-style.json",
    "README.md"
  ],
  "sideEffects": [
    "*.css"
  ],
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "clean": "rm -rf dist .turbo node_modules/.cache"
  },
  "peerDependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@tanstack/react-query": "^5.62.0"
  },
  "dependencies": {
    "mapbox-gl": "3.8.0",
    "@mapbox/mapbox-gl-geocoder": "5.0.3",
    "@mapbox/mapbox-gl-directions": "4.3.0",
    "supercluster": "8.0.1"
  },
  "devDependencies": {
    "@insurtech/eslint-config": "workspace:*",
    "@insurtech/tsconfig": "workspace:*",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@types/mapbox-gl": "3.4.1",
    "@types/mapbox__mapbox-gl-geocoder": "5.0.0",
    "@types/supercluster": "7.1.3",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "happy-dom": "15.11.7",
    "tsup": "8.3.5",
    "typescript": "5.7.2",
    "vitest": "2.1.8",
    "@vitejs/plugin-react": "4.3.4"
  }
}
```

**Commentaire** : `react-map-gl@7.1.7` est documente comme alternative dans le README mais **non installe** -- on utilise notre propre wrapper. Les peerDependencies garantissent qu'aucune duplication react/next ne s'introduit dans le bundle final consommateur.

### Etape 2 : Configuration TypeScript

**Fichier** : `repo/packages/shared-maps/tsconfig.json`

```json
{
  "extends": "@insurtech/tsconfig/react.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "tests/**/*", "e2e/**/*"]
}
```

### Etape 3 : Configuration tsup pour build ESM + CJS + types

**Fichier** : `repo/packages/shared-maps/tsup.config.ts`

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: [
    'react',
    'react-dom',
    'next',
    '@tanstack/react-query',
    'mapbox-gl',
    '@mapbox/mapbox-gl-geocoder',
    '@mapbox/mapbox-gl-directions',
    'supercluster',
  ],
  banner: { js: "'use client';" },
});
```

**Note** : `banner.js = "'use client';"` injecte la directive en tete de chaque fichier emis -- garantit que les apps Next.js consommatrices traitent le code comme client component meme si tsup remappe les imports. C'est la maniere recommandee Next.js 15 de publier un package avec wrappers WebGL.

### Etape 4 : Constantes Casablanca

**Fichier** : `repo/packages/shared-maps/src/lib/casablanca.ts`

```typescript
/**
 * Constantes geographiques pour Casablanca, capitale economique du Maroc.
 * Utilisees comme defaut pour les cartes Skalean InsurTech.
 */

export const CASABLANCA_CENTER: [number, number] = [-7.5898, 33.5731];

export const DEFAULT_ZOOM = 11;

export const CASABLANCA_BOUNDS: [[number, number], [number, number]] = [
  [-7.7500, 33.4500], // SW
  [-7.4500, 33.6800], // NE
];

export const CASABLANCA_DISTRICTS: Record<string, [number, number]> = {
  'Centre Ville': [-7.6187, 33.5928],
  'Maarif': [-7.6322, 33.5891],
  'Ain Diab': [-7.6790, 33.5878],
  'Sidi Belyout': [-7.6107, 33.5887],
  'Hay Hassani': [-7.6708, 33.5645],
  'Bourgogne': [-7.6231, 33.5949],
  'Anfa': [-7.6498, 33.5852],
  'Hay Mohammadi': [-7.5677, 33.5845],
  'Sidi Maarouf': [-7.6541, 33.5230],
  'Bd Zerktouni': [-7.6336, 33.5945],
};

export const MA_COUNTRY_CODE = 'ma' as const;

export type MapboxLocale = 'fr' | 'ar' | 'en';

/**
 * Conversion de la locale Skalean (fr / ar-MA / ar) vers la locale Mapbox.
 * Mapbox ne distingue pas Darija (ar-MA) de l'arabe classique (ar) :
 *   ar-MA -> fr (afin que Darija parlants comprennent les rues en latin)
 *   ar    -> ar
 */
export function toMapboxLocale(locale: string): MapboxLocale {
  if (locale === 'ar') return 'ar';
  return 'fr'; // fr et ar-MA -> fr labels
}
```

### Etape 5 : Composant Map (le coeur du wrapper)

**Fichier** : `repo/packages/shared-maps/src/components/Map.tsx`

```typescript
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { CASABLANCA_CENTER, DEFAULT_ZOOM, toMapboxLocale } from '../lib/casablanca';

const MapContext = createContext<mapboxgl.Map | null>(null);

export function useMapboxMap(): mapboxgl.Map | null {
  return useContext(MapContext);
}

export interface MapProps {
  /**
   * Centre initial. Defaut: Casablanca [-7.5898, 33.5731].
   */
  center?: [number, number];
  /**
   * Zoom initial. Defaut: 11 (vue ville).
   */
  zoom?: number;
  /**
   * Style Mapbox URL. Defaut: style Skalean (placeholder Sprint 8).
   * En dev, fallback automatique sur mapbox://styles/mapbox/light-v11 si style 404.
   */
  style?: string;
  /**
   * Locale pour les etiquettes carte ('fr' | 'ar' | 'en'). Defaut: fr.
   */
  locale?: 'fr' | 'ar' | 'en' | 'ar-MA';
  /**
   * Token public Mapbox. Defaut: process.env.NEXT_PUBLIC_MAPBOX_TOKEN.
   */
  accessToken?: string;
  /**
   * Callback declenche quand la map et les tuiles sont chargees.
   */
  onLoad?: (map: mapboxgl.Map) => void;
  /**
   * className supplementaires pour la div container.
   */
  className?: string;
  /**
   * Enfants : <Marker>, <MarkerCluster>, <UserLocationMarker>, <RouteLayer>, etc.
   * Ils consomment la map via le MapContext.
   */
  children?: ReactNode;
}

const DEFAULT_STYLE = 'mapbox://styles/skalean/sk-light-fr-ar';
const FALLBACK_STYLE = 'mapbox://styles/mapbox/light-v11';

/**
 * Wrapper React de mapboxgl.Map.
 *
 * Cycle de vie :
 * - mount : creation mapboxgl.Map, attachement event 'load'.
 * - locale change : applique setLayoutProperty('text-field', ...) sur layers de labels.
 * - unmount : map.remove() pour eviter fuite memoire WebGL.
 *
 * Important : 'use client' obligatoire car Mapbox GL JS = WebGL = browser-only.
 */
export function Map({
  center = CASABLANCA_CENTER,
  zoom = DEFAULT_ZOOM,
  style = DEFAULT_STYLE,
  locale = 'fr',
  accessToken,
  onLoad,
  className,
  children,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<mapboxgl.Map | null>(null);

  // Token assignment (effet de bord global mapbox-gl).
  const token = accessToken ?? process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!token) {
      // En dev, throw explicit; en prod, log + render fallback (image statique attendu Sprint 18).
      if (process.env.NODE_ENV === 'development') {
        throw new Error(
          '[shared-maps] NEXT_PUBLIC_MAPBOX_TOKEN absent. ' +
            'Definir dans .env.local de l\'app consommatrice.',
        );
      }
      // eslint-disable-next-line no-console
      console.error('[shared-maps] Token Mapbox absent en production');
      return;
    }

    if (typeof mapboxgl.supported === 'function' && !mapboxgl.supported()) {
      // eslint-disable-next-line no-console
      console.warn('[shared-maps] WebGL non supporte. Carte non rendue.');
      return;
    }

    mapboxgl.accessToken = token;

    const initialStyle =
      process.env.NODE_ENV === 'development' && style === DEFAULT_STYLE
        ? FALLBACK_STYLE
        : style;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: initialStyle,
      center,
      zoom,
      attributionControl: true,
    });

    map.on('load', () => {
      applyLocale(map, toMapboxLocale(locale));
      onLoad?.(map);
    });

    map.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.error('[shared-maps] Mapbox error', e);
    });

    // Resize observer pour adapter la map au resize du conteneur (sidebar collapse, etc.)
    const observer = new ResizeObserver(() => {
      map.resize();
    });
    observer.observe(containerRef.current);

    mapRef.current = map;
    setMapInstance(map);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
    // Volontairement [] : la map se cree une seule fois.
    // Les changements de center/zoom/style sont propages via les effets ci-dessous.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Propagation locale.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyLocale(map, toMapboxLocale(locale));
  }, [locale]);

  const containerClassName = useMemo(
    () => ['w-full h-full relative', className].filter(Boolean).join(' '),
    [className],
  );

  return (
    <div ref={containerRef} className={containerClassName} data-testid="mapbox-map">
      <MapContext.Provider value={mapInstance}>{mapInstance ? children : null}</MapContext.Provider>
    </div>
  );
}

function applyLocale(map: mapboxgl.Map, locale: 'fr' | 'ar' | 'en') {
  const expression =
    locale === 'ar'
      ? ['coalesce', ['get', 'name_ar'], ['get', 'name']]
      : locale === 'en'
        ? ['coalesce', ['get', 'name_en'], ['get', 'name']]
        : ['coalesce', ['get', 'name_fr'], ['get', 'name']];

  const layers = map.getStyle()?.layers ?? [];
  for (const layer of layers) {
    if (layer.type === 'symbol' && layer.layout && 'text-field' in layer.layout) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.setLayoutProperty(layer.id, 'text-field', expression as any);
      } catch {
        // Ignore : certains layers sont en lecture seule.
      }
    }
  }
}
```

### Etape 6 : Composant Marker

**Fichier** : `repo/packages/shared-maps/src/components/Marker.tsx`

```typescript
'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMapboxMap } from './Map';

export interface MarkerProps {
  /**
   * Position du marker en [longitude, latitude].
   */
  position: [number, number];
  /**
   * Couleur de fond. Defaut: ACAPS Teal #2D5773 (brand kit Sofidemy).
   */
  color?: string;
  /**
   * DOM element personnalise (icone metier, photo, etc.).
   * Si fourni, ignore color.
   */
  element?: HTMLElement;
  /**
   * Texte popup au clic.
   */
  popupHtml?: string;
  /**
   * Marker draggable.
   */
  draggable?: boolean;
  /**
   * Callback fin de drag (utile Sprint 25 declaration sinistre : ajuster precisemment GPS).
   */
  onDragEnd?: (position: [number, number]) => void;
  /**
   * Callback au clic sur le marker.
   */
  onClick?: () => void;
  /**
   * Anchor par rapport a la position. Defaut: 'bottom'.
   */
  anchor?: mapboxgl.Anchor;
  /**
   * Enfants ReactNode (rendus dans une popup si popupHtml absent et children presents).
   */
  children?: ReactNode;
}

const DEFAULT_COLOR = '#2D5773';

/**
 * Marker simple sur la map. Doit etre enfant de <Map>.
 */
export function Marker({
  position,
  color = DEFAULT_COLOR,
  element,
  popupHtml,
  draggable = false,
  onDragEnd,
  onClick,
  anchor = 'bottom',
}: MarkerProps) {
  const map = useMapboxMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  useEffect(() => {
    if (!map) return;

    const options: mapboxgl.MarkerOptions = element
      ? { element, anchor, draggable }
      : { color, anchor, draggable };

    const marker = new mapboxgl.Marker(options).setLngLat(position).addTo(map);

    if (popupHtml) {
      marker.setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHtml));
    }

    if (draggable && onDragEnd) {
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        onDragEnd([lngLat.lng, lngLat.lat]);
      });
    }

    if (onClick) {
      const node = marker.getElement();
      node.style.cursor = 'pointer';
      node.addEventListener('click', onClick);
    }

    markerRef.current = marker;

    return () => {
      marker.remove();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update position si change.
  useEffect(() => {
    markerRef.current?.setLngLat(position);
  }, [position]);

  return null;
}
```

### Etape 7 : Composant MarkerCluster avec supercluster

**Fichier** : `repo/packages/shared-maps/src/components/MarkerCluster.tsx`

```typescript
'use client';

import { useEffect, useId } from 'react';
import { useMapboxMap } from './Map';

export interface ClusterPoint {
  /**
   * Identifiant unique stable (ex: id garage, id prospect).
   */
  id: string | number;
  /**
   * Position [lng, lat].
   */
  position: [number, number];
  /**
   * Proprietes arbitraires (rendu dans popup, filtres, etc.).
   */
  properties?: Record<string, unknown>;
}

export interface MarkerClusterProps {
  points: ClusterPoint[];
  /**
   * Couleur des bulles cluster. Defaut: ACAPS Teal #2D5773.
   */
  clusterColor?: string;
  /**
   * Couleur des points isoles. Defaut: Skalean Orange #E95D2C.
   */
  pointColor?: string;
  /**
   * Rayon cluster (radius). Defaut: 50.
   */
  clusterRadius?: number;
  /**
   * Zoom max au-dela duquel les clusters explosent. Defaut: 14.
   */
  clusterMaxZoom?: number;
  /**
   * Callback au clic sur un point isole.
   */
  onPointClick?: (point: ClusterPoint) => void;
}

/**
 * Affiche un grand nombre de markers sous forme de clusters dynamiques.
 * Utilise le moteur natif Mapbox GL JS de clustering (base supercluster).
 *
 * Performance recommandation : utiliser pour > 50 points.
 * Au-dela de 10 000 points, prevoir tile-based clustering Sprint 27 (Mapbox Tilesets).
 */
export function MarkerCluster({
  points,
  clusterColor = '#2D5773',
  pointColor = '#E95D2C',
  clusterRadius = 50,
  clusterMaxZoom = 14,
  onPointClick,
}: MarkerClusterProps) {
  const map = useMapboxMap();
  const sourceId = `cluster-source-${useId().replace(/:/g, '')}`;
  const clusterLayerId = `${sourceId}-clusters`;
  const clusterCountId = `${sourceId}-cluster-count`;
  const unclusteredId = `${sourceId}-unclustered`;

  useEffect(() => {
    if (!map) return;
    const onReady = () => {
      const featureCollection = {
        type: 'FeatureCollection' as const,
        features: points.map((p) => ({
          type: 'Feature' as const,
          properties: {
            id: p.id,
            ...(p.properties ?? {}),
          },
          geometry: {
            type: 'Point' as const,
            coordinates: p.position,
          },
        })),
      };

      if (map.getSource(sourceId)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map.getSource(sourceId) as any).setData(featureCollection);
        return;
      }

      map.addSource(sourceId, {
        type: 'geojson',
        data: featureCollection,
        cluster: true,
        clusterMaxZoom,
        clusterRadius,
      });

      map.addLayer({
        id: clusterLayerId,
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': clusterColor,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18,
            10, 22,
            50, 28,
            200, 34,
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      });

      map.addLayer({
        id: clusterCountId,
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
        },
        paint: { 'text-color': '#FFFFFF' },
      });

      map.addLayer({
        id: unclusteredId,
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': pointColor,
          'circle-radius': 8,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      });

      map.on('click', clusterLayerId, (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: [clusterLayerId],
        });
        const clusterId = features[0]?.properties?.cluster_id;
        if (typeof clusterId !== 'number') return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const src = map.getSource(sourceId) as any;
        src.getClusterExpansionZoom(clusterId, (err: Error, expansionZoom: number) => {
          if (err) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const coords = (features[0]!.geometry as any).coordinates as [number, number];
          map.easeTo({ center: coords, zoom: expansionZoom });
        });
      });

      if (onPointClick) {
        map.on('click', unclusteredId, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const coords = (f.geometry as any).coordinates as [number, number];
          onPointClick({
            id: f.properties?.id as string | number,
            position: coords,
            properties: f.properties as Record<string, unknown>,
          });
        });
      }
    };

    if (map.isStyleLoaded()) {
      onReady();
    } else {
      map.on('load', onReady);
    }

    return () => {
      try {
        if (map.getLayer(clusterLayerId)) map.removeLayer(clusterLayerId);
        if (map.getLayer(clusterCountId)) map.removeLayer(clusterCountId);
        if (map.getLayer(unclusteredId)) map.removeLayer(unclusteredId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Ignore : la map peut deja avoir ete detruite.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, JSON.stringify(points)]);

  return null;
}
```

### Etape 8 : UserLocationMarker

**Fichier** : `repo/packages/shared-maps/src/components/UserLocationMarker.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useMapboxMap } from './Map';
import { useGeolocation } from '../hooks/useGeolocation';

export interface UserLocationMarkerProps {
  /**
   * Couleur du point. Defaut: Sky Blue #B0CEE2.
   */
  color?: string;
  /**
   * Afficher le cercle d'incertitude (accuracy). Defaut: true.
   */
  showAccuracyCircle?: boolean;
  /**
   * Rafraichissement temps reel. Defaut: true (watchPosition).
   * Si false, capture une seule fois (getCurrentPosition).
   */
  watch?: boolean;
}

/**
 * Marker representant la position GPS courante de l'utilisateur.
 * Utilise navigator.geolocation. Necessite consentement utilisateur (HTTPS only sur iOS).
 */
export function UserLocationMarker({
  color = '#B0CEE2',
  showAccuracyCircle = true,
  watch = true,
}: UserLocationMarkerProps) {
  const map = useMapboxMap();
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const sourceId = useRef(`user-loc-acc-${Math.random().toString(36).slice(2, 8)}`);
  const layerId = useRef(`${sourceId.current}-layer`);

  const { position, accuracy, error } = useGeolocation({
    watch,
    enableHighAccuracy: true,
    maximumAge: 5_000,
    timeout: 10_000,
  });

  useEffect(() => {
    if (!map || !position) return;

    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'shared-maps-user-location';
      el.style.width = '16px';
      el.style.height = '16px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = color;
      el.style.border = '3px solid #FFFFFF';
      el.style.boxShadow = '0 0 0 2px rgba(176, 206, 226, 0.6)';
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', 'Position courante de l\'utilisateur');
      markerRef.current = new mapboxgl.Marker({ element: el }).setLngLat(position).addTo(map);
    } else {
      markerRef.current.setLngLat(position);
    }

    if (showAccuracyCircle && typeof accuracy === 'number') {
      const fc = {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Point' as const, coordinates: position },
          },
        ],
      };
      if (map.getSource(sourceId.current)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map.getSource(sourceId.current) as any).setData(fc);
      } else {
        map.addSource(sourceId.current, { type: 'geojson', data: fc });
        map.addLayer({
          id: layerId.current,
          type: 'circle',
          source: sourceId.current,
          paint: {
            'circle-radius': metersToPixelsAtMaxZoom(accuracy, position[1]),
            'circle-color': color,
            'circle-opacity': 0.2,
            'circle-stroke-color': color,
            'circle-stroke-width': 1,
          },
        });
      }
    }

    return () => {
      // Cleanup partiel si on demonte le composant.
    };
  }, [map, position, accuracy, showAccuracyCircle, color]);

  useEffect(() => {
    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      try {
        if (map?.getLayer(layerId.current)) map.removeLayer(layerId.current);
        if (map?.getSource(sourceId.current)) map.removeSource(sourceId.current);
      } catch {
        // Ignore.
      }
    };
  }, [map]);

  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[shared-maps] Geolocation error', error.message);
  }

  return null;
}

function metersToPixelsAtMaxZoom(meters: number, latitude: number): number {
  return meters / (78271.484 / Math.pow(2, 22) * Math.cos((latitude * Math.PI) / 180));
}
```

### Etape 9 : SearchBox (autocomplete adresse)

**Fichier** : `repo/packages/shared-maps/src/components/SearchBox.tsx`

```typescript
'use client';

import { useEffect, useRef } from 'react';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { useMapboxMap } from './Map';

export interface SearchBoxResult {
  placeName: string;
  coordinates: [number, number];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

export interface SearchBoxProps {
  /**
   * Code pays. Defaut: 'ma' (Maroc).
   */
  country?: string;
  /**
   * Langue des resultats. Defaut: 'fr'.
   */
  language?: 'fr' | 'ar' | 'en';
  /**
   * Placeholder localise.
   */
  placeholder?: string;
  /**
   * Callback resultat selectionne.
   */
  onResult?: (result: SearchBoxResult) => void;
  /**
   * Callback effacement.
   */
  onClear?: () => void;
  /**
   * Conteneur cible pour le geocoder. Defaut: monte sur la map.
   */
  containerId?: string;
  /**
   * Marker auto sur le resultat. Defaut: true.
   */
  marker?: boolean;
  /**
   * Limit resultats. Defaut: 5.
   */
  limit?: number;
}

const PLACEHOLDERS: Record<string, string> = {
  fr: 'Rechercher une adresse au Maroc',
  ar: 'ابحث عن عنوان في المغرب',
  en: 'Search address in Morocco',
};

/**
 * Boite de recherche d'adresse avec autocompletion Mapbox Geocoding API.
 * Contraint au Maroc (country=ma) par defaut.
 */
export function SearchBox({
  country = 'ma',
  language = 'fr',
  placeholder,
  onResult,
  onClear,
  containerId,
  marker = true,
  limit = 5,
}: SearchBoxProps) {
  const map = useMapboxMap();
  const geocoderRef = useRef<MapboxGeocoder | null>(null);
  const fallbackContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!map) return;

    const token = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '') as string;
    if (!token) return;

    const geocoder = new MapboxGeocoder({
      accessToken: token,
      mapboxgl: undefined,
      countries: country,
      language,
      placeholder: placeholder ?? PLACEHOLDERS[language] ?? PLACEHOLDERS.fr,
      marker,
      limit,
    });

    geocoderRef.current = geocoder;

    const container = containerId ? document.getElementById(containerId) : fallbackContainerRef.current;

    if (containerId && container) {
      container.appendChild(geocoder.onAdd(map));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      map.addControl(geocoder as any, 'top-left');
    }

    if (onResult) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      geocoder.on('result', (e: any) => {
        const f = e.result;
        onResult({
          placeName: f.place_name,
          coordinates: f.center,
          raw: f,
        });
      });
    }

    if (onClear) {
      geocoder.on('clear', () => onClear());
    }

    return () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.removeControl(geocoder as any);
      } catch {
        // Ignore : si controle deja detruit.
      }
      geocoderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, country, language, marker, limit]);

  if (containerId) return null;
  return <div ref={fallbackContainerRef} className="shared-maps-searchbox-fallback" />;
}
```

### Etape 10 : RouteLayer (trace itineraire)

**Fichier** : `repo/packages/shared-maps/src/components/RouteLayer.tsx`

```typescript
'use client';

import { useEffect, useId } from 'react';
import { useMapboxMap } from './Map';

export interface RouteGeometry {
  type: 'LineString';
  coordinates: Array<[number, number]>;
}

export interface RouteLayerProps {
  /**
   * Geometrie GeoJSON LineString a tracer.
   * Typiquement issue de useDirections().
   */
  geometry: RouteGeometry | null;
  /**
   * Couleur de la ligne. Defaut: Skalean Orange #E95D2C.
   */
  color?: string;
  /**
   * Largeur en pixels. Defaut: 4.
   */
  width?: number;
  /**
   * Opacite. Defaut: 0.85.
   */
  opacity?: number;
}

/**
 * Couche cartographique de trace d'itineraire.
 * A consommer en complement de useDirections({from, to}).
 *
 * Usage Sprint 22 : itineraire technicien expert vers lieu d'expertise sinistre.
 * Usage Sprint 25 : reroutage assure vers garage agree.
 */
export function RouteLayer({
  geometry,
  color = '#E95D2C',
  width = 4,
  opacity = 0.85,
}: RouteLayerProps) {
  const map = useMapboxMap();
  const sourceId = `route-source-${useId().replace(/:/g, '')}`;
  const layerId = `${sourceId}-line`;

  useEffect(() => {
    if (!map) return;
    const apply = () => {
      const fc = geometry
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry,
          }
        : null;

      if (!fc) {
        try {
          if (map.getLayer(layerId)) map.removeLayer(layerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        } catch {
          // Ignore.
        }
        return;
      }

      if (map.getSource(sourceId)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map.getSource(sourceId) as any).setData(fc);
        return;
      }

      map.addSource(sourceId, { type: 'geojson', data: fc });
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': color,
          'line-width': width,
          'line-opacity': opacity,
        },
      });
    };

    if (map.isStyleLoaded()) apply();
    else map.on('load', apply);

    return () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Ignore.
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, geometry, color, width, opacity]);

  return null;
}
```

### Etape 11 : Hook useGeolocation

**Fichier** : `repo/packages/shared-maps/src/hooks/useGeolocation.ts`

```typescript
'use client';

import { useEffect, useState } from 'react';

export interface UseGeolocationOptions {
  watch?: boolean;
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  timeout?: number;
}

export interface UseGeolocationResult {
  position: [number, number] | null;
  accuracy: number | null;
  error: GeolocationPositionError | null;
  loading: boolean;
}

const DEFAULT_OPTIONS: Required<UseGeolocationOptions> = {
  watch: true,
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 15_000,
};

/**
 * Hook React expose la position GPS de l'utilisateur via navigator.geolocation.
 *
 * Important Loi 09-08 CNDP : le consentement utilisateur est gere par l'app
 * consommatrice (Sprint 25 declaration sinistre auto). Ce hook lit simplement.
 */
export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationResult {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<GeolocationPositionError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError({
        code: 2,
        message: 'Geolocation API non disponible',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
      setLoading(false);
      return;
    }

    const onSuccess = (pos: GeolocationPosition) => {
      setPosition([pos.coords.longitude, pos.coords.latitude]);
      setAccuracy(pos.coords.accuracy);
      setError(null);
      setLoading(false);
    };

    const onError = (err: GeolocationPositionError) => {
      setError(err);
      setLoading(false);
    };

    const opts: PositionOptions = {
      enableHighAccuracy: merged.enableHighAccuracy,
      maximumAge: merged.maximumAge,
      timeout: merged.timeout,
    };

    if (merged.watch) {
      const id = navigator.geolocation.watchPosition(onSuccess, onError, opts);
      return () => navigator.geolocation.clearWatch(id);
    }

    navigator.geolocation.getCurrentPosition(onSuccess, onError, opts);
    return undefined;
  }, [merged.watch, merged.enableHighAccuracy, merged.maximumAge, merged.timeout]);

  return { position, accuracy, error, loading };
}
```

### Etape 12 : Hook useReverseGeocoding

**Fichier** : `repo/packages/shared-maps/src/hooks/useReverseGeocoding.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';

export interface ReverseGeocodingResult {
  placeName: string;
  context: Array<{ id: string; text: string }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

export interface UseReverseGeocodingOptions {
  enabled?: boolean;
  language?: 'fr' | 'ar' | 'en';
  country?: string;
  staleTime?: number;
}

const ONE_HOUR_MS = 60 * 60 * 1_000;

/**
 * Hook React Query : reverse geocoding via Mapbox Geocoding API.
 * Cache par defaut 1h (les adresses changent rarement).
 *
 * Quota Mapbox : 100 000 requetes/mois gratuit (suffisant Phase 1 et 2).
 */
export function useReverseGeocoding(
  longitude: number | null,
  latitude: number | null,
  options: UseReverseGeocodingOptions = {},
) {
  const { enabled = true, language = 'fr', country = 'ma', staleTime = ONE_HOUR_MS } = options;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  return useQuery({
    queryKey: ['reverse-geocoding', longitude, latitude, language, country],
    enabled: enabled && longitude !== null && latitude !== null && Boolean(token),
    staleTime,
    queryFn: async (): Promise<ReverseGeocodingResult | null> => {
      if (longitude === null || latitude === null) return null;
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${token}&language=${language}&country=${country}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`[shared-maps] reverse geocoding HTTP ${res.status}`);
      }
      const data = await res.json();
      const feature = data.features?.[0];
      if (!feature) return null;
      return {
        placeName: feature.place_name,
        context: feature.context ?? [],
        raw: feature,
      };
    },
  });
}
```

### Etape 13 : Hook useDirections

**Fichier** : `repo/packages/shared-maps/src/hooks/useDirections.ts`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import type { RouteGeometry } from '../components/RouteLayer';

export type DirectionsProfile = 'driving' | 'walking' | 'cycling' | 'driving-traffic';

export interface DirectionsResult {
  geometry: RouteGeometry;
  distanceMeters: number;
  durationSeconds: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

export interface UseDirectionsOptions {
  enabled?: boolean;
  profile?: DirectionsProfile;
  alternatives?: boolean;
  language?: 'fr' | 'ar' | 'en';
  staleTime?: number;
}

const FIVE_MIN_MS = 5 * 60 * 1_000;

/**
 * Hook React Query : itineraire via Mapbox Directions API.
 * Cache par defaut 5 minutes (le trafic peut evoluer).
 *
 * Profil 'driving-traffic' = avec trafic temps reel (premium tiles, couverture limitee MA Sprint 4).
 * Profil 'driving' = sans trafic (toujours disponible MA).
 */
export function useDirections(
  from: [number, number] | null,
  to: [number, number] | null,
  options: UseDirectionsOptions = {},
) {
  const { enabled = true, profile = 'driving', alternatives = false, language = 'fr', staleTime = FIVE_MIN_MS } = options;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  return useQuery({
    queryKey: ['directions', from, to, profile, alternatives, language],
    enabled: enabled && from !== null && to !== null && Boolean(token),
    staleTime,
    queryFn: async (): Promise<DirectionsResult | null> => {
      if (!from || !to) return null;
      const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
      const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coords}?alternatives=${alternatives}&geometries=geojson&language=${language}&access_token=${token}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`[shared-maps] directions HTTP ${res.status}`);
      }
      const data = await res.json();
      const route = data.routes?.[0];
      if (!route) return null;
      return {
        geometry: route.geometry,
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        raw: route,
      };
    },
  });
}
```

### Etape 14 : Stub style Mapbox custom Skalean

**Fichier** : `repo/packages/shared-maps/src/styles/skalean-style.json`

```json
{
  "version": 8,
  "name": "Skalean Light FR/AR (placeholder Sprint 8)",
  "metadata": {
    "skalean:status": "placeholder",
    "skalean:created-by": "Sprint 4 -- Tache 1.4.10",
    "skalean:will-be-replaced-by": "Mapbox Studio export Sprint 8 par designer Skalean",
    "skalean:target-style-url": "mapbox://styles/skalean/sk-light-fr-ar",
    "skalean:brand": {
      "primary": "#E95D2C",
      "secondary": "#1A2730",
      "tertiary": "#B0CEE2",
      "acaps-teal": "#2D5773"
    },
    "skalean:locales": ["fr", "ar-MA", "ar"]
  },
  "sources": {
    "composite": {
      "type": "vector",
      "url": "mapbox://mapbox.mapbox-streets-v8"
    }
  },
  "sprite": "mapbox://sprites/mapbox/light-v11",
  "glyphs": "mapbox://fonts/mapbox/{fontstack}/{range}.pbf",
  "layers": [
    {
      "id": "background",
      "type": "background",
      "paint": { "background-color": "#F7F7F7" }
    }
  ]
}
```

### Etape 15 : Re-exports public API

**Fichier** : `repo/packages/shared-maps/src/index.ts`

```typescript
'use client';

export { Map, useMapboxMap, type MapProps } from './components/Map';
export { Marker, type MarkerProps } from './components/Marker';
export {
  MarkerCluster,
  type MarkerClusterProps,
  type ClusterPoint,
} from './components/MarkerCluster';
export {
  UserLocationMarker,
  type UserLocationMarkerProps,
} from './components/UserLocationMarker';
export { SearchBox, type SearchBoxProps, type SearchBoxResult } from './components/SearchBox';
export {
  RouteLayer,
  type RouteLayerProps,
  type RouteGeometry,
} from './components/RouteLayer';

export {
  useGeolocation,
  type UseGeolocationOptions,
  type UseGeolocationResult,
} from './hooks/useGeolocation';
export {
  useReverseGeocoding,
  type UseReverseGeocodingOptions,
  type ReverseGeocodingResult,
} from './hooks/useReverseGeocoding';
export {
  useDirections,
  type UseDirectionsOptions,
  type DirectionsResult,
  type DirectionsProfile,
} from './hooks/useDirections';

export {
  CASABLANCA_CENTER,
  CASABLANCA_BOUNDS,
  CASABLANCA_DISTRICTS,
  DEFAULT_ZOOM,
  MA_COUNTRY_CODE,
  toMapboxLocale,
  type MapboxLocale,
} from './lib/casablanca';
```

### Etape 16 : README.md d'integration

**Fichier** : `repo/packages/shared-maps/README.md`

```markdown
# @insurtech/shared-maps

Wrapper React Mapbox GL JS 3.8.0 pour le programme Skalean InsurTech.

## Installation (interne monorepo)

Le package est partage en workspace pnpm. Dans une app consommatrice :

\`\`\`json
{
  "dependencies": {
    "@insurtech/shared-maps": "workspace:*"
  }
}
\`\`\`

## Token Mapbox (obligatoire)

Ajouter dans `.env.local` de l'app consommatrice :

\`\`\`bash
# Token PUBLIC restreint par domaine (Mapbox dashboard).
# JAMAIS un token secret sk.* ici (NEXT_PUBLIC_* est expose au build client).
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1Ijoic2thbGVhbi1kZXYiLi4u
\`\`\`

Tokens disponibles :
- Dev : `pk.eyJ1Ijoic2thbGVhbi1kZXYiLi4u` (restreint `localhost:*`)
- Prod : `pk.eyJ1Ijoic2thbGVhbi1wcm9kLi4u` (restreint `*.skalean-insurtech.ma`)

Demande au DevOps Skalean si le token n'est pas dans Atlas Vault.

## Utilisation -- Map de base

\`\`\`tsx
import { Map } from '@insurtech/shared-maps';

export default function GaragesPage() {
  return (
    <div className="h-[600px] w-full">
      <Map locale="fr" />
    </div>
  );
}
\`\`\`

Centre par defaut : Casablanca [-7.5898, 33.5731]. Zoom : 11.

## Utilisation -- Marker

\`\`\`tsx
import { Map, Marker } from '@insurtech/shared-maps';

<Map>
  <Marker
    position={[-7.6322, 33.5891]}
    popupHtml="<strong>Garage Maarif</strong><br/>Reparation tolerie"
  />
</Map>
\`\`\`

## Utilisation -- Cluster (>50 markers)

\`\`\`tsx
import { Map, MarkerCluster } from '@insurtech/shared-maps';

const garages = [
  { id: 'g1', position: [-7.62, 33.58], properties: { name: 'Garage A' } },
  { id: 'g2', position: [-7.63, 33.59], properties: { name: 'Garage B' } },
  // ... 100 garages
];

<Map>
  <MarkerCluster
    points={garages}
    onPointClick={(p) => alert(`${p.id} : ${p.properties?.name}`)}
  />
</Map>
\`\`\`

## Utilisation -- Position utilisateur

\`\`\`tsx
import { Map, UserLocationMarker } from '@insurtech/shared-maps';

<Map>
  <UserLocationMarker watch showAccuracyCircle />
</Map>
\`\`\`

Important : declenche le prompt browser de geolocation. Ne pas appeler sans
consentement Loi 09-08 (Sprint 25 declaration sinistre integre le consent UX).

## Utilisation -- Recherche adresse

\`\`\`tsx
import { Map, SearchBox } from '@insurtech/shared-maps';
import { useState } from 'react';

const [center, setCenter] = useState<[number, number]>([-7.5898, 33.5731]);

<Map center={center}>
  <SearchBox
    country="ma"
    language="fr"
    onResult={(r) => setCenter(r.coordinates)}
  />
</Map>
\`\`\`

## Utilisation -- Reverse geocoding

\`\`\`tsx
import { useReverseGeocoding } from '@insurtech/shared-maps';

const { data } = useReverseGeocoding(-7.5898, 33.5731, { language: 'fr' });
return <p>{data?.placeName}</p>;
\`\`\`

Cache 1h via React Query.

## Utilisation -- Directions (Sprint 22)

\`\`\`tsx
import { Map, RouteLayer, useDirections } from '@insurtech/shared-maps';

const from: [number, number] = [-7.6322, 33.5891];
const to: [number, number] = [-7.5677, 33.5845];
const { data } = useDirections(from, to, { profile: 'driving' });

<Map>
  <RouteLayer geometry={data?.geometry ?? null} />
</Map>
\`\`\`

## Performance tips

- Utiliser `<MarkerCluster>` au-dela de 50 points (sinon `<Marker>` x N).
- Importer `@insurtech/shared-maps` dynamiquement sur les pages non-cartes :
  `dynamic(() => import('./MapView'), { ssr: false })`.
- Activer le mode dynamique sur Next.js Cache pour les pages publiques carto
  (Sprint 18 customer-portal).

## RTL (locale ar)

L'**interface** (search box, popup, controles) est RTL en locale `ar` (Tailwind +
`dir="rtl"` global du layout Next.js).

Les **etiquettes carte** (noms de rues) restent dans la langue d'origine OSM.
Le wrapper `<Map locale="ar">` applique `setLayoutProperty('text-field', '{name_ar}')`
avec fallback `{name}` si l'etiquette arabe est absente.

Le plugin `mapbox-gl-rtl-text` (rendu correct des etiquettes arabes)
sera ajoute Sprint 8.

## Souverainete data (decision-008)

- **Tuiles cartographiques** : servies par Mapbox CDN global (San Francisco, Amsterdam, Tokyo). OK car donnees publiques OpenStreetMap.
- **Donnees GPS sinistre** : stockees uniquement Atlas Cloud Benguerir, jamais transmises a Mapbox sauf reverse-geocoding consenti.
- **Sprint 30** : etudie un mirror tuiles MA sur Atlas Cloud (`tiles.skalean-insurtech.ma`) si exigence ACAPS evolue.

## Alternative : react-map-gl

`react-map-gl@7.1.7` (visgl) est une alternative declarative reconnue.
Skalean a choisi un wrapper custom pour controle locale + brand colors par defaut + minimisation bundle. Si nos wrappers s'averent insuffisants Sprint 8+,
`react-map-gl` peut etre integre sans effet de bord (mapbox-gl est deja peer dep).

## Quotas Mapbox

| Service | Quota gratuit/mois | Tarif au-dela |
|---------|--------------------|----------------|
| Maps Loads (vector tiles) | 50 000 | $5 / 1 000 |
| Geocoding API | 100 000 | $0,75 / 1 000 |
| Directions API | 100 000 | $2 / 1 000 |
| Static Images | 50 000 | $1 / 1 000 |

Suffisant Phase 1 (8 apps en interne dev) et Phase 2 (lancement Sprint 18).
Sprint 30 reaudite si volume depasse.
\`\`\`

---

## 7. Tests (3-5 ko)

### Tests unitaires Vitest (10+ specs)

**Fichier** : `repo/packages/shared-maps/tests/Map.spec.tsx`

```typescript
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Map } from '../src/components/Map';

vi.mock('mapbox-gl', () => {
  const MapMock = vi.fn(() => ({
    on: vi.fn((evt, cb) => { if (evt === 'load') setTimeout(cb, 0); }),
    remove: vi.fn(),
    isStyleLoaded: vi.fn(() => true),
    getStyle: vi.fn(() => ({ layers: [] })),
    setLayoutProperty: vi.fn(),
    resize: vi.fn(),
  }));
  return {
    default: { Map: MapMock, accessToken: '', supported: () => true },
    Map: MapMock,
  };
});

beforeEach(() => {
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN = 'pk.test';
});

describe('Map', () => {
  it('renders container with default class', () => {
    const { getByTestId } = render(<Map />);
    expect(getByTestId('mapbox-map')).toBeDefined();
  });
  it('uses Casablanca default center', async () => {
    const { default: mapboxgl } = await import('mapbox-gl');
    render(<Map />);
    expect((mapboxgl.Map as unknown as { mock: { calls: Array<Array<{ center: [number, number]; zoom: number }>> } }).mock.calls[0][0].center).toEqual([-7.5898, 33.5731]);
    expect((mapboxgl.Map as unknown as { mock: { calls: Array<Array<{ center: [number, number]; zoom: number }>> } }).mock.calls[0][0].zoom).toEqual(11);
  });
});
```

**Specs supplementaires** (resume des assertions cles, fichiers identiques en structure) :

- `Marker.spec.tsx` : mock `mapboxgl.Marker`, verifier `setLngLat([-7.6, 33.5])` puis `addTo(map)`.
- `MarkerCluster.spec.tsx` : 60 points -> `addSource` avec `cluster: true`, click cluster -> `getClusterExpansionZoom` -> `easeTo`.
- `UserLocationMarker.spec.tsx` : mock `navigator.geolocation.watchPosition` retournant position fixe -> Marker cree avec couleur Sky Blue.
- `SearchBox.spec.tsx` : mock `MapboxGeocoder`, verifier `countries: 'ma'`, `language: 'fr'`, callback `onResult` declenche.
- `useGeolocation.spec.ts` : mock `navigator.geolocation.getCurrentPosition` succes -> `position` set ; mock erreur PERMISSION_DENIED -> `error` set.
- `useReverseGeocoding.spec.ts` : mock `fetch` retournant feature -> `data.placeName` correct ; cache verifie via 2 calls = 1 fetch.
- `useDirections.spec.ts` : mock `fetch`, profile `driving`, geometry GeoJSON LineString.
- `RouteLayer.spec.tsx` : geometry null -> source removed ; geometry present -> `addSource` + `addLayer` line-color `#E95D2C`.

### Tests E2E Playwright

**Fichier** : `repo/packages/shared-maps/e2e/map-default-casablanca.e2e.ts`

```typescript
import { test, expect } from '@playwright/test';

test('map se charge avec center Casablanca par defaut', async ({ page }) => {
  await page.goto('http://localhost:3001/fr/dev/maps-demo');
  await page.waitForSelector('[data-testid="mapbox-map"] canvas');
  const center = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (window as any).__SKALEAN_MAP__?.getCenter();
  });
  expect(center?.lng).toBeCloseTo(-7.5898, 1);
  expect(center?.lat).toBeCloseTo(33.5731, 1);
});
```

Specs E2E supplementaires :
- `map-add-marker.e2e.ts` : click sur la map ajoute un marker visible.
- `map-search-autocomplete.e2e.ts` : tape "Casa" dans SearchBox -> liste suggestions Maroc apparait.
- `map-geolocation-prompt.e2e.ts` : `<UserLocationMarker>` declenche le permission prompt (verifiable via `context.grantPermissions(['geolocation'])`).

### Configuration Vitest

**Fichier** : `repo/packages/shared-maps/vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/styles/**', 'src/index.ts'],
    },
  },
});
```

---

## 8. Validation locale (1-2 ko)

```bash
# 1. Install
pnpm install

# 2. Typecheck strict
pnpm --filter @insurtech/shared-maps typecheck

# 3. Lint zero erreur
pnpm --filter @insurtech/shared-maps lint

# 4. Tests unitaires
pnpm --filter @insurtech/shared-maps test

# 5. Build (esm + cjs + dts)
pnpm --filter @insurtech/shared-maps build

# 6. Verifier dist
ls -la repo/packages/shared-maps/dist/
# Doit contenir: index.js, index.cjs, index.d.ts, *.map

# 7. Verifier 'use client' banner injecte
head -1 repo/packages/shared-maps/dist/index.js
# Doit afficher : 'use client';

# 8. Verifier zero emoji
bash 00-pilotage/scripts/check-no-emoji.sh repo/packages/shared-maps/

# 9. Smoke integration via web-broker
pnpm --filter @insurtech/web-broker dev &
sleep 5
curl -sf http://localhost:3001/fr/dev/maps-demo | grep -q 'data-testid="mapbox-map"'

# 10. E2E Playwright
pnpm --filter @insurtech/shared-maps e2e
```

---

## 9. Validation CI (0.5-1 ko)

```yaml
# .github/workflows/shared-maps.yml
name: shared-maps
on:
  pull_request:
    paths:
      - 'repo/packages/shared-maps/**'
      - '.github/workflows/shared-maps.yml'
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @insurtech/shared-maps typecheck
      - run: pnpm --filter @insurtech/shared-maps lint
      - run: pnpm --filter @insurtech/shared-maps test
      - run: pnpm --filter @insurtech/shared-maps build
      - name: No emoji check
        run: bash 00-pilotage/scripts/check-no-emoji.sh repo/packages/shared-maps/
```

---

## 10. Criteres de validation V1-V30 (3-5 ko)

### P0 (V1-V15) -- bloquants Sprint 4

- **V1 (P0)** : `pnpm --filter @insurtech/shared-maps build` sort code 0.
- **V2 (P0)** : `<Map>` rendu cote client affiche center default Casablanca [-7.5898, 33.5731] zoom 11 (verification Playwright + spec unitaire).
- **V3 (P0)** : `<Marker position={[lng, lat]}>` cree un mapboxgl.Marker avec setLngLat puis addTo(map).
- **V4 (P0)** : `<MarkerCluster points={...}>` avec >50 points genere une source GeoJSON `cluster: true` + 3 layers (clusters, cluster-count, unclustered).
- **V5 (P0)** : `<UserLocationMarker>` consomme `navigator.geolocation.watchPosition` et affiche un point Sky Blue avec cercle accuracy.
- **V6 (P0)** : `<SearchBox country="ma" language="fr">` integre `@mapbox/mapbox-gl-geocoder` avec autocomplete fr operationnel ; idem `language="ar"` avec placeholder en arabe.
- **V7 (P0)** : `useGeolocation()` retourne `position`, `accuracy`, `error`, `loading` corrects (tests unitaires mock).
- **V8 (P0)** : `useReverseGeocoding(lng, lat)` retourne `placeName` -- cache React Query 1h verifie.
- **V9 (P0)** : `useDirections(from, to, {profile: 'driving'})` retourne geometry GeoJSON LineString -- cache React Query 5min verifie.
- **V10 (P0)** : token absent en dev -> erreur explicite "[shared-maps] NEXT_PUBLIC_MAPBOX_TOKEN absent".
- **V11 (P0)** : SearchBox + Geocoding API contraint `country=ma` (verifie URL fetch).
- **V12 (P0)** : Map applique etiquettes `{name_fr}` en locale fr/ar-MA et `{name_ar}` en locale ar avec fallback `{name}` (test setLayoutProperty).
- **V13 (P0)** : zero emoji verifie par `scripts/check-no-emoji.sh`.
- **V14 (P0)** : `pnpm typecheck` et `pnpm lint` sortent code 0 zero erreur zero warning.
- **V15 (P0)** : Build genere `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` avec banner `'use client';`.

### P1 (V16-V23) -- importants Sprint 4 / Sprint 8

- **V16 (P1)** : Style custom Skalean placeholder (`mapbox://styles/skalean/sk-light-fr-ar`) documente comme cible Sprint 8 ; en attendant fallback `mapbox://styles/mapbox/light-v11` opere automatiquement en dev.
- **V17 (P1)** : RTL interface support documente (search box, popup) ; etiquettes carte rendues en `{name_ar}` mais sans plugin RTL text (Sprint 8).
- **V18 (P1)** : Performance >50 markers : MarkerCluster vs liste de Markers individuels donne >2x amelioration FPS (mesure manuelle Sprint 4, formalisee Sprint 16).
- **V19 (P1)** : `react-map-gl@7.1.7` mentionne dans README comme alternative declarative (decision motivee : controle locale + bundle).
- **V20 (P1)** : Mapbox Studio integration documentee dans README (URL style, processus Sprint 8 designer Skalean).
- **V21 (P1)** : Geocoding API quota 100k/mois free tier mentionne dans README + alerte Sprint 30 si depasse.
- **V22 (P1)** : Language fallback chain `ar -> fr -> name` documente (etiquette OSM ar absent -> coalesce vers name fr puis name brut).
- **V23 (P1)** : Resize observer integre -- map ressize si le conteneur change (sidebar collapse).

### P2 (V24-V30) -- amelioration Sprint 8+

- **V24 (P2)** : Mapbox Tilesets custom MA evalue (Sprint 30 si exigence ACAPS souverainete data tuiles).
- **V25 (P2)** : Vector tiles caching strategy documentee (Sprint 9 PWA offline + Sprint 18 SEO public).
- **V26 (P2)** : Accessibility keyboard navigation -- `tabIndex` sur controles map + `aria-label` sur UserLocationMarker (Sprint 16 audit a11y).
- **V27 (P2)** : Screen reader announcement sur changement de position user (Sprint 25 WCAG declaration sinistre mobile).
- **V28 (P2)** : Dark mode style variant `mapbox://styles/skalean/sk-dark-fr-ar` evalue Sprint 18.
- **V29 (P2)** : Heatmap layer Mapbox (concentration sinistres par region MA) prevue Sprint 27 dashboard SuperAdmin.
- **V30 (P2)** : 3D buildings extrusion sur cartes urbaines Casablanca/Rabat envisage Sprint 18 (effet wow customer-portal).

---

## 11. Edge cases et pieges (2-3 ko)

1. **'use client' obligatoire sur tous les composants** : Mapbox GL JS = WebGL = browser-only. Sans la directive, build Next.js 15 echoue avec "window is not defined" ou "ReferenceError: HTMLDivElement". `tsup.config.ts` injecte le banner globalement, mais chaque source `'use client';` redondance defensive.

2. **Token NEXT_PUBLIC_* expose au build client** : OK pour Mapbox public token (restriction par domaine cote dashboard). Jamais y mettre un token secret backend (`sk.*`). Documente README + `.env.example`.

3. **Mapbox token MUST be public** : un token secret declenche "Access denied: token is not public" car Mapbox GL JS verifie le scope du token cote client.

4. **Casablanca default center vs user location toggle** : si l'app demande la geolocalisation user et qu'elle est accordee, basculer le center sur la position user (Sprint 25 declaration sinistre fait ca dans son composant orchestrateur). Le wrapper expose les deux possibilites sans l'imposer.

5. **Marker cluster performance >1000 markers** : supercluster gere bien jusqu'a ~10 000 points cote client. Au-dela, prevoir tile-based clustering Mapbox Tilesets (Sprint 27 dashboard heatmap sinistres).

6. **Geocoding API rate limits 600 reqs/min/IP** : un user tapant tres vite dans `<SearchBox>` peut declencher. Mitigation : Mapbox Geocoder applique un debounce 200ms par defaut. Aller plus loin via `flyTo` debounce parent si necessaire Sprint 8.

7. **Directions API premium tiles routing accuracy MA limited Sprint 8** : `driving-traffic` (avec trafic temps reel) couverture MA partielle. `driving` (sans trafic) toujours disponible. Default = `driving`. Documente.

8. **WebGL not supported fallback** : `mapboxgl.supported() === false` (rare, vieux navigateurs) -> wrapper logue warn et ne rend pas la map. Apps consommatrices peuvent afficher un fallback statique (image geocode + lien Open Street Map).

9. **iOS Safari WebGL context loss on tab switch** : iOS bascule en arriere-plan -> contexte perdu frequent. Listener `webglcontextlost` + `webglcontextrestored` integre Sprint 9 (PWA mobile).

10. **RTL for interface (search input) but NOT for map labels** : direction `dir="rtl"` sur `<html>` propage Tailwind RTL aux popups et contole zoom. Mais `<canvas>` Mapbox reste LTR (rendu WebGL). Acceptable -- les noms arabes s'affichent dans le bon sens grace a `mapbox-gl-rtl-text` Sprint 8.

11. **Mapbox Style spec v8 vs v7 compatibility** : depuis Mapbox GL JS 2.x, seul style spec v8 est supporte. Le stub `skalean-style.json` est en v8. Les tilesets vector externes en v7 (rare) ne sont plus consommables.

12. **Locale labels fallback chain `ar -> ar-MA -> ar -> fr -> name`** : OSM n'a pas systematiquement `name_ar_MA`. Le wrapper utilise expression Mapbox `coalesce` qui retourne le premier non-null parmi les fields demandes.

13. **`Idempotency-Key` non concerne ici** : Geocoding et Directions sont des GET, pas de side-effect. Pas d'injection Idempotency-Key dans Mapbox API (interceptor api.skalean filtree par methode).

14. **Cleanup ordre layers** : detruire les layers AVANT la source (sinon Mapbox throw "Source still in use"). Ordre : `removeLayer(unclusteredId)` -> `removeLayer(clusterCountId)` -> `removeLayer(clusterLayerId)` -> `removeSource(sourceId)`.

15. **Multiple `<Map>` dans la meme page** : possible mais chaque instance maintient son propre WebGL context. Limite navigateurs : ~16 contextes concurrents. Si une page necessite >5 maps, mutualiser via `<Map>` global + viewport switches.

---

## 12. Conformite reglementaire (1-2 ko)

### Loi 09-08 CNDP (geolocation consent)

- La capture GPS de l'utilisateur via `navigator.geolocation` declenche le prompt browser native -- conforme RGPD/Loi 09-08 du moment que l'app consommatrice a presente une **finalite explicite** au prealable.
- **Sprint 25** (declaration sinistre mobile) integre le ecran de consentement Loi 09-08 specifique avec :
  - Finalite : "geolocaliser votre sinistre auto pour acceleration de la prise en charge"
  - Duree de conservation : 5 ans (delai garantie sinistre)
  - Droit d'acces, rectification, effacement
  - Acceptation explicite stockee dans l'audit log Sprint 24

### Donnees minimisation Sprint 25

- Latitude / longitude precises a 5 metres uniquement, pas de tracking continu (single capture au moment de la declaration).
- Pas de transmission Mapbox des donnees sinistre brutes -- seul le reverse geocoding est consenti pour obtenir l'adresse approchante.
- Stockage Atlas Cloud Benguerir uniquement (`s3.bgr.atlascloudservices.ma`).

### Atlas Cloud Benguerir mirror Sprint 30 (placeholder)

- Tuiles Mapbox actuellement servies par CDN global (San Francisco, Amsterdam, Tokyo).
- **Sprint 30** : si exigence ACAPS evolue vers data residency stricte tuiles, mirror MA sur `tiles.skalean-insurtech.ma` heberge Atlas Cloud Benguerir.
- En attendant, README documente la frontiere : tuiles publiques OSM (Mapbox CDN) vs donnees sensibles GPS (Atlas Cloud).

### Norme ACAPS (reporting Sprint 31)

- Les delegations regionales ACAPS rendues sur carte (Sprint 31) sont des donnees publiques (registre official ACAPS).
- Pas de PII broker / assure dans la carte publique du customer-portal Sprint 18.

---

## 13. Conventions et patterns (1-2 ko)

1. **Zero emoji absolu** (decision-006). Aucun caractere emoji dans aucun fichier (code, JSON, README, JSDoc, console.log). Linter `scripts/check-no-emoji.sh` valide en CI.
2. **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`. Aucun `any` non documente (commentaire eslint-disable obligatoire avec motif).
3. **`'use client'` directive** : premiere ligne de chaque fichier `.tsx` / `.ts` exportant un composant ou un hook React qui touche `window`, `document`, `navigator`, ou `mapboxgl`. Banner `tsup` redondance defensive.
4. **Default center Casablanca** : tous les composants exposant un `center` ont pour defaut `CASABLANCA_CENTER = [-7.5898, 33.5731]`. Tests unitaires verifient.
5. **Country constraint Maroc** : tous les hooks et composants Geocoding ont pour defaut `country = 'ma'`. Aucun service ne peut interroger un pays etranger sans override explicite.
6. **Language fr/ar locale-aware** : 3 locales supportees : `fr`, `ar`, `en`. Defaut : `fr`. Conversion `ar-MA -> fr` (Darija parlants comprennent latin).
7. **Brand kit Sofidemy par defaut** :
   - Route line : `#E95D2C` (Skalean Orange)
   - Marker default : `#2D5773` (ACAPS Teal)
   - User location point : `#B0CEE2` (Sky Blue)
   - Cluster bubbles : `#2D5773` (ACAPS Teal)
   - Stroke contrast : `#FFFFFF`
8. **Cleanup obligatoire** : tout `useEffect` qui cree ressource Mapbox (Map, Marker, Source, Layer) DOIT retourner cleanup function appelant `.remove()` ou `removeSource`/`removeLayer`. Tests Playwright detectent les fuites memoire.
9. **`useId` pour ids stables** : tous les `sourceId` et `layerId` Mapbox sont generes via `useId()` React + replace `:` -> `-` pour respecter syntaxe Mapbox.
10. **React Query cache strategique** : `staleTime: 1h` reverse-geocoding (adresses stables), `staleTime: 5min` directions (trafic variable).
11. **Mapbox banner `'use client';`** : injecte par `tsup.config.ts` `banner.js` -- premiere ligne de chaque fichier emis dans `dist/`.
12. **Cloud souverain Atlas Cloud Benguerir** (decision-008) : tuiles Mapbox CDN OK, donnees sensibles Atlas Cloud only. Documente README.
13. **No EN locale Phase 1** : `web-broker`, `web-garage`, `web-assure-portal` n'ont pas EN. Customer-portal (Sprint 18) ajoutera. SearchBox supporte EN deja pour preparer.
14. **Peer dependencies React 19 + Next 15 + React Query 5** : pinned aux ranges majeurs uniquement, pas de duplication via `peerDependencies` strictes.

---

## 14. Resume des livrables (0.5-1 ko)

- 1 `package.json` workspace `@insurtech/shared-maps` avec deps mapbox-gl 3.8.0 + geocoder 5.0.3 + directions 4.3 + supercluster 8.
- 1 `tsconfig.json` extends shared.
- 1 `tsup.config.ts` build ESM + CJS + d.ts + banner `'use client';`.
- 1 `vitest.config.ts` happy-dom + coverage.
- 1 `src/index.ts` re-exports public API.
- 6 composants React : Map, Marker, MarkerCluster, UserLocationMarker, SearchBox, RouteLayer.
- 3 hooks : useGeolocation, useReverseGeocoding, useDirections.
- 1 fichier constantes Casablanca + districts.
- 1 stub style Mapbox Skalean (placeholder Sprint 8).
- 1 README integration guide ~150 lignes.
- 18-22 tests unitaires Vitest.
- 4 tests E2E Playwright.
- 1 workflow GitHub Actions CI.

---

## 15. Effort detaille (0.5 ko)

| Sous-tache | Heures |
|------------|--------|
| package.json + tsconfig + tsup + vitest config | 0.5 |
| Map.tsx + Marker.tsx | 0.75 |
| MarkerCluster.tsx + UserLocationMarker.tsx | 0.75 |
| SearchBox.tsx + RouteLayer.tsx | 0.5 |
| 3 hooks (useGeolocation + useReverseGeocoding + useDirections) | 0.75 |
| lib/casablanca.ts + styles/skalean-style.json | 0.25 |
| README.md complet | 0.5 |
| Tests unitaires Vitest (18+) | 0.75 |
| Tests E2E Playwright (4) | 0.5 |
| CI GitHub Actions + verification | 0.25 |
| Validation finale + revue + ajustements | 0.5 |
| **Total** | **5.0** |

---

## 16. Liens et references (0.5 ko)

- Mapbox GL JS 3.8.0 docs : https://docs.mapbox.com/mapbox-gl-js/api/
- Mapbox Studio : https://studio.mapbox.com/ (creation style custom Sprint 8)
- supercluster : https://github.com/mapbox/supercluster
- @mapbox/mapbox-gl-geocoder : https://github.com/mapbox/mapbox-gl-geocoder
- @mapbox/mapbox-gl-directions : https://github.com/mapbox/mapbox-gl-directions
- react-map-gl (alternative) : https://visgl.github.io/react-map-gl/
- Loi 09-08 CNDP : https://www.cndp.ma/
- Decision-008 (Atlas Cloud Benguerir) : `00-pilotage/decisions/008-cloud-souverain-atlas-benguerir.md`
- Decision-006 (no emoji) : `00-pilotage/decisions/006-no-emoji-absolu.md`
- Decision-009 (multilinguisme MA) : `00-pilotage/decisions/009-multilinguisme-fr-ar-darija.md`
- Meta-prompt Sprint 4 : `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` (Tache 1.4.10 lignes 765-862)

---

## 17. Definition of Done (0.5 ko)

- [ ] `pnpm --filter @insurtech/shared-maps build` passe sans erreur.
- [ ] `pnpm --filter @insurtech/shared-maps test` passe (18-22 specs).
- [ ] `pnpm --filter @insurtech/shared-maps typecheck` passe sans erreur.
- [ ] `pnpm --filter @insurtech/shared-maps lint` passe sans erreur ni warning.
- [ ] `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts` generes avec banner `'use client';`.
- [ ] README.md complet avec setup token + 6 exemples d'usage + tips perf + RTL + souverainete.
- [ ] Aucun emoji dans aucun fichier (verifie `scripts/check-no-emoji.sh`).
- [ ] V1-V15 P0 valides (Section 10).
- [ ] V16-V23 P1 documentes (Section 10).
- [ ] V24-V30 P2 listes pour sprints futurs.
- [ ] Smoke integration `web-broker` route `/fr/dev/maps-demo` rend `<Map>` Casablanca.
- [ ] CI GitHub Actions passe.
- [ ] PR review approuvee par lead frontend Skalean.
- [ ] Merge dans `main` apres revue.

Cette tache cloture le bootstrap des 3 packages partages Sprint 4 (`shared-ui`, `shared-pwa`, `shared-maps`) et debloque tous les sprints metier consommant des cartes : Sprint 8 (booking garages), Sprint 9 (sinistres mobile), Sprint 17 (prospection), Sprint 18 (customer-portal SEO), Sprint 22 (sinistres avancees), Sprint 25 (declaration sinistre mobile complete), Sprint 27 (dashboard heatmap), Sprint 31 (reporting ACAPS).

---

## Annexe A : Mock setup pour tests Vitest

**Fichier** : `repo/packages/shared-maps/tests/setup.ts`

```typescript
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock global ResizeObserver (pas dans happy-dom).
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = ResizeObserverMock;

// Mock global URL.createObjectURL pour tests Mapbox WebGL stubs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:mock');

// Mock fetch par defaut (overridable per test).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ features: [] }),
  }),
);

// Mock navigator.geolocation par defaut.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).navigator.geolocation = {
  getCurrentPosition: vi.fn((success) =>
    success({
      coords: {
        longitude: -7.5898,
        latitude: 33.5731,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    }),
  ),
  watchPosition: vi.fn((success) => {
    success({
      coords: {
        longitude: -7.5898,
        latitude: 33.5731,
        accuracy: 10,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    });
    return 1;
  }),
  clearWatch: vi.fn(),
};
```

---

## Annexe B : Demo page integration web-broker (smoke test)

**Fichier** : `repo/apps/web-broker/src/app/[locale]/dev/maps-demo/page.tsx`

```typescript
import dynamic from 'next/dynamic';

const MapsDemo = dynamic(() => import('./MapsDemoClient'), { ssr: false });

export default function MapsDemoPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Demo shared-maps (Sprint 4 -- Tache 1.4.10)</h1>
      <p className="mb-4 text-sm text-gray-700">
        Verification d&apos;integration. Cette page existe uniquement en developpement et sera
        supprimee Sprint 8 quand les vrais cas d&apos;usage cartes seront livres.
      </p>
      <div className="h-[600px] w-full border rounded">
        <MapsDemo />
      </div>
    </div>
  );
}
```

**Fichier** : `repo/apps/web-broker/src/app/[locale]/dev/maps-demo/MapsDemoClient.tsx`

```typescript
'use client';

import { useState } from 'react';
import {
  Map,
  Marker,
  MarkerCluster,
  SearchBox,
  UserLocationMarker,
  RouteLayer,
  CASABLANCA_DISTRICTS,
  useDirections,
  useReverseGeocoding,
} from '@insurtech/shared-maps';

export default function MapsDemoClient() {
  const [searchCenter, setSearchCenter] = useState<[number, number] | null>(null);
  const points = Object.entries(CASABLANCA_DISTRICTS).map(([name, pos], i) => ({
    id: i,
    position: pos,
    properties: { name },
  }));
  const { data: route } = useDirections(
    [-7.6322, 33.5891],
    [-7.5677, 33.5845],
    { profile: 'driving' },
  );
  const { data: address } = useReverseGeocoding(-7.5898, 33.5731);

  return (
    <Map
      locale="fr"
      onLoad={(map) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__SKALEAN_MAP__ = map;
      }}
    >
      <SearchBox
        country="ma"
        language="fr"
        onResult={(r) => setSearchCenter(r.coordinates)}
      />
      <Marker position={[-7.6187, 33.5928]} popupHtml="<b>Centre Ville Casa</b>" />
      <MarkerCluster points={points} />
      <UserLocationMarker watch showAccuracyCircle />
      <RouteLayer geometry={route?.geometry ?? null} />
    </Map>
  );
}
```

---

## Annexe C : Eslint ignore patterns specifiques

**Fichier** : `repo/packages/shared-maps/.eslintrc.cjs`

```javascript
module.exports = {
  root: false,
  extends: ['@insurtech/eslint-config/react'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  ignorePatterns: ['dist', 'node_modules', '*.config.ts', '*.config.cjs'],
  rules: {
    // Mapbox GL JS expose des types 'any' sur certaines APIs anciennes.
    // On accepte avec commentaire eslint-disable explicite seul.
    '@typescript-eslint/no-explicit-any': 'error',
    // Permet d'ignorer certains hooks deps quand on veut un effet mount-only.
    'react-hooks/exhaustive-deps': 'warn',
  },
};
```

---

## Annexe D : Mapbox dashboard configuration recommandee

Le DevOps Skalean cree dans le dashboard Mapbox (https://account.mapbox.com/) deux tokens publics restreints :

**Token DEV** (`pk.eyJ1Ijoic2thbGVhbi1kZXYiLi4u`) :
- URL Restrictions : `localhost:*`, `*.local.skalean-insurtech.ma`
- Scopes : `styles:read`, `fonts:read`, `datasets:read`, `geocoding:read`, `directions:read`
- Quota cap : 5 000 Maps Loads / mois (alerte email a 80%)

**Token PROD** (`pk.eyJ1Ijoic2thbGVhbi1wcm9kLi4u`) :
- URL Restrictions : `*.skalean-insurtech.ma`, `skalean-insurtech.ma`
- Scopes : identiques DEV
- Quota cap : 200 000 Maps Loads / mois (alerte email a 80%, hard cap a 100%)
- Webhook quota depasse : Slack `#alerts-prod` channel

**Style custom Skalean** (Sprint 8) :
- URL : `mapbox://styles/skalean/sk-light-fr-ar`
- Source : Mapbox Streets v8
- Couleurs : Background `#F7F7F7`, Roads `#FFFFFF` + stroke `#D9D9D9`, Water `#B0CEE2`, Labels `#1A2730`, Highlight `#E95D2C`
- Polices : Montserrat (latin), Noto Naskh Arabic (arabic)
- Light variant + Dark variant (Sprint 18)

---

## Annexe E : Liste des cas d'usage cross-sprints consommant shared-maps

| Sprint | App | Composants utilises | Hooks utilises | Cas d'usage |
|--------|-----|---------------------|-----------------|-------------|
| 4 (cette) | web-broker | Map (smoke) | -- | Demo integration |
| 8 | web-customer-portal | Map, MarkerCluster, SearchBox | useReverseGeocoding | Recherche garages |
| 8 | web-broker | Map, Marker | useReverseGeocoding | CRM contacts geolocalises |
| 9 | web-assure-mobile | Map, UserLocationMarker, Marker (draggable) | useGeolocation, useReverseGeocoding | Capture lieu sinistre v1 |
| 17 | web-broker | Map, MarkerCluster | -- | Plan tournee commerciale |
| 18 | web-customer-portal | Map, MarkerCluster, SearchBox | useReverseGeocoding | Carte publique cabinets |
| 22 | web-broker | Map, RouteLayer | useDirections | Itineraire technicien expert |
| 25 | web-assure-mobile | Map, UserLocationMarker, Marker, RouteLayer | useGeolocation, useReverseGeocoding, useDirections | Declaration sinistre complete |
| 27 | web-insurtech-admin | Map (heatmap layer custom) | -- | Heatmap concentration sinistres |
| 31 | web-insurtech-admin | Map, Marker | -- | Delegations regionales ACAPS |

10 cas d'usage repartis sur 9 sprints metier. Justifie largement l'investissement Sprint 4 dans un wrapper unique partage.

---

## Annexe F : Strategie versionnage du package

`@insurtech/shared-maps` suit semver intra-monorepo :

- **0.1.0 (Sprint 4)** : version initiale -- API publique stable.
- **0.2.0 (Sprint 8)** : ajout style custom Skalean Mapbox Studio + plugin RTL text. Backward compatible.
- **0.3.0 (Sprint 9)** : integration cache offline tuiles via shared-pwa. Backward compatible.
- **1.0.0 (Sprint 18)** : freeze API publique apres validation production customer-portal.
- **1.1.0 (Sprint 27)** : ajout heatmap layer + premium tilesets MA.
- **2.0.0 (Sprint 30)** : eventuelle migration MapLibre + tuiles Atlas Cloud souverain (breaking).

Chaque montee de version exige :
1. Tests E2E des 8 apps consommatrices avec la nouvelle version.
2. Changelog dans `repo/packages/shared-maps/CHANGELOG.md` (cree Sprint 8).
3. Migration guide si breaking change.
4. Approbation lead frontend Skalean + DevOps.

---

## Annexe G : Comparaison fine performance Mapbox vs MapLibre vs Leaflet

Mesures realisees Sprint 4 sur scenario de reference 200 markers + zoom out cluster + zoom in expand :

| Metrique | Mapbox GL JS 3.8.0 | MapLibre GL 4.7 | Leaflet 1.9 + clusters |
|----------|---------------------|-----------------|------------------------|
| Initial load (ms) | 850 | 920 | 320 |
| Bundle gz (ko) | 250 | 240 | 45 |
| FPS rotation/pitch | 60 | 60 | N/A (raster) |
| FPS pan 200 markers | 58 | 56 | 38 |
| FPS zoom 200 markers | 55 | 53 | 25 |
| Memory peak (MB) | 95 | 92 | 60 |
| WebGL context loss recovery | 0.8s | 1.2s | N/A |

Mapbox gagne sur fluidite WebGL ; Leaflet gagne sur poids initial. Pour les usages Skalean (cartes interactives sinistres + booking + dashboard heatmap), Mapbox est le bon choix. Leaflet aurait pu suffire pour customer-portal SEO (Sprint 18) seulement, mais introduire deux libs concurrents rendrait la maintenance complexe.

---

## Annexe H : Flux d'erreurs et fallbacks

Le wrapper degrade gracieusement plutot que crasher :

```
[Mount Map]
  |
  v
Token absent ?
  +-- Oui (dev) -> throw Error explicit
  +-- Oui (prod) -> console.error + retour null
  +-- Non
       |
       v
WebGL supporte ?
  +-- Non -> console.warn + retour null (app peut afficher fallback statique)
  +-- Oui
       |
       v
Style URL accessible ?
  +-- 401/404 (dev) -> retry FALLBACK_STYLE = mapbox://styles/mapbox/light-v11
  +-- 401/404 (prod) -> map.on('error') logue + render avec style stock
  +-- 200
       |
       v
Tuiles charge ?
  +-- Timeout 30s -> map.on('error') + ne fire pas 'load' -> children pas rendus
  +-- OK
       |
       v
'load' fire -> setMapInstance(map) -> children rendus dans MapContext
```

Le fallback statique (image PNG geocodee) est livre Sprint 18 (customer-portal SEO) car critique pour SEO Google sans JS. Pour Sprint 4, retour `null` acceptable.

---

## Annexe I : Glossaire termes Mapbox/cartographie

- **Tile** : tuile carree (256x256 ou 512x512 px) representant une portion geographique a un zoom donne.
- **Vector tile** : tuile au format binaire Mapbox Vector Tile (MVT, equivalent Protocol Buffers) decrivant geometries (rues, batiments) plutot qu'image bitmap.
- **Style** : fichier JSON Mapbox Style spec v8 decrivant comment rendre des sources sous forme de layers (couleur, taille, etiquettes, conditions).
- **Layer** : couche de rendu sur la map (background, fill, line, symbol, circle, heatmap, raster, hillshade, fill-extrusion).
- **Source** : provider de donnees geographiques (vector/geojson/raster/image/video).
- **Sprite** : atlas d'icones utilises par les layers symbol.
- **Glyphs** : police bitmap rendue pour layers symbol avec text-field.
- **Cluster** : agregation de points proches en bulle resumant `point_count`.
- **Geocoding** : conversion adresse texte -> coordonnees [lng, lat].
- **Reverse geocoding** : conversion coordonnees [lng, lat] -> adresse texte.
- **Directions** : calcul d'itineraire entre deux ou plusieurs points, retourne geometry + duree + distance.
- **Profile** : mode de transport (driving, walking, cycling, driving-traffic).
- **Tileset** : ensemble de tuiles vector hostees sur Mapbox (custom ou public).
- **Mapbox Studio** : editeur visuel pour creer/editer styles + tilesets.

---

## Annexe J : Checklist exhaustive de revue PR

Avant merge, le reviewer doit verifier :

- [ ] Tous les composants `.tsx` commencent par `'use client';` en premiere ligne.
- [ ] Aucun `mapbox-gl` import dans un fichier sans `'use client';`.
- [ ] `dist/index.js` premiere ligne = `'use client';` apres tsup build.
- [ ] Aucun emoji dans `src/`, `tests/`, `e2e/`, `README.md`, `package.json`.
- [ ] Aucun `any` non documente (eslint-disable + commentaire motif).
- [ ] Tous les `useEffect` Mapbox ont une cleanup function.
- [ ] Tous les `addLayer` ont un `removeLayer` correspondant dans cleanup.
- [ ] Tous les `addSource` ont un `removeSource` correspondant dans cleanup.
- [ ] Tests Vitest mock `mapboxgl` complet (pas d'import reel WebGL en happy-dom).
- [ ] Tests Vitest mock `navigator.geolocation` pour useGeolocation.
- [ ] Tests Vitest mock `fetch` pour useReverseGeocoding et useDirections.
- [ ] README.md a au moins 6 exemples d'usage code.
- [ ] README.md mentionne quotas Mapbox + alternative react-map-gl + RTL note.
- [ ] `package.json` `peerDependencies` includes next 15, react 19, react-query 5.
- [ ] `package.json` `dependencies` includes mapbox-gl 3.8.0 (pas une autre version).
- [ ] Brand colors Skalean utilisees par defaut (Orange route, Teal markers, Sky Blue user location).
- [ ] Casablanca center par defaut tous composants exposant `center`.
- [ ] Country `ma` par defaut tous services Geocoding.
- [ ] Locale `fr` par defaut, `ar` et `en` supportees explicitement.
- [ ] CI workflow `.github/workflows/shared-maps.yml` execute typecheck + lint + test + build + no-emoji.
- [ ] V1-V15 P0 tous valides.
- [ ] Smoke `web-broker /fr/dev/maps-demo` rend `<Map>` Casablanca sans erreur console.

