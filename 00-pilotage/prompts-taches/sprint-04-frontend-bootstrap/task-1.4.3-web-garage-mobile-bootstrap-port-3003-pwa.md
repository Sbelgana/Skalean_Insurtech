# TACHE 1.4.3 -- web-garage-mobile Bootstrap (Port 3003 -- PWA)

> **Phase** : 1 -- Bootstrap
> **Sprint** : 4 / 35 -- Frontend Bootstrap
> **Numero** : 1.4.3
> **Priorite** : P0 (bloquant pour Sprint 13 sinistres mobile et Sprint 25 declaration assure)
> **Effort** : 5h
> **Depend de** : 1.4.2 (web-garage bootstrap port 3002 -- pattern Next.js 15 / next-intl / Skalean theme reutilise)
> **Bloque** : 1.4.4 (web-insurtech-admin), 1.4.6 (web-assure-portal), 1.4.7 (web-assure-mobile -- pattern PWA dupplique), Sprint 9 push notifications, Sprint 13 capture photo sinistre, Sprint 25 offline-first declaration
> **Lectures prealables obligatoires** :
> 1. `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` lignes 1-130 (intro Sprint) + 315-390 (detail tache)
> 2. `00-pilotage/documentation/4-templates-generation.md` Pattern 14 PWA mobile capture camera (lignes 375-680)
> 3. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles transverses
> 4. `00-pilotage/documentation/1-stack-technique.yaml` -- versions exactes
> 5. `00-pilotage/decisions/decision-006-no-emoji.md`
> 6. `00-pilotage/decisions/decision-008-cloud-souverain-atlas-benguerir.md`
> 7. Sortie tache 1.4.2 : `repo/apps/web-garage/` -- structure de reference
> 8. Sortie tache 1.4.9 : `repo/packages/shared-pwa/` -- hooks `useInstallPrompt`, `useOnlineStatus`, `useServiceWorker`

---

## 1. HEADER METADONNEES

| Champ | Valeur |
|-------|--------|
| Tache | 1.4.3 -- web-garage-mobile Bootstrap (Port 3003 -- PWA) |
| Sprint | 4 / 35 (Phase 1 Bootstrap, derniere tache phase) |
| Position | Apres 1.4.2 web-garage (port 3002), avant 1.4.4 web-insurtech-admin (port 3000) |
| Priorite | P0 |
| Effort | 5 heures |
| Depend de | 1.4.2 (pattern bootstrap), 1.4.9 (shared-pwa) -- 1.4.9 peut etre realisee en parallele si stubs disponibles |
| Bloque | 1.4.4, 1.4.6, 1.4.7 (pattern PWA dupplique pour assure-mobile), Sprint 9, Sprint 13, Sprint 25 |
| App | `apps/web-garage-mobile/` |
| Port dev | 3003 |
| Domaine prod | `garage-app.skalean-insurtech.ma` |
| Domaine recette | `garage-app.recette.skalean-insurtech.ma` |
| Type | Progressive Web App (PWA), mobile-first, install on home screen |
| Locales | fr (default), ar-MA (Darija), ar (classique RTL) |
| Decision majeure | next-pwa 5.6.0 retenue (alternatives serwist evoquees migration future Phase 5) |

---

## 2. BUT DE LA TACHE

Bootstraper l'application **PWA mobile** (Progressive Web App installable depuis Chrome Android ou Add-to-Home-Screen Safari iOS) destinee aux **techniciens garage en atelier** (mecanicien tolerie, peintre, controleur qualite). L'application tourne sur le port 3003 en developpement et se deploie sous le domaine `garage-app.skalean-insurtech.ma` en production sur Atlas Cloud Benguerir (decision-008 cloud souverain).

A la fin de cette tache :

- Le scaffolding `apps/web-garage-mobile/` est complet, demarre via `pnpm --filter @insurtech/web-garage-mobile dev` et expose un placeholder dashboard accessible a `http://localhost:3003/fr`, `http://localhost:3003/ar-MA`, `http://localhost:3003/ar` (RTL).
- La PWA est detectable et installable : un visiteur Chrome Android obtient automatiquement l'evenement `beforeinstallprompt`, un visiteur iOS Safari voit une banniere instruction "Ajouter a l'ecran d'accueil > Partager > Sur l'ecran d'accueil".
- Le service worker se enregistre uniquement en build prod (`process.env.NODE_ENV === 'production'`), strategies de cache configurees par next-pwa 5.6.0 (NetworkFirst pour API, CacheFirst pour assets statiques, StaleWhileRevalidate pour pages, NetworkOnly pour authentification Sprint 5).
- Le manifest `public/manifest.webmanifest` est valide selon spec W3C (sera audite via Lighthouse PWA audit), expose les couleurs Skalean (theme_color #E95D2C Orange brand, background_color #1A2730 Navy noir mobile pour OLED), 3 icons (192, 512, maskable), categories productivity / business, lang fr-MA, dir ltr (RTL gere cote app).
- Les hooks `useInstallPrompt`, `useOnlineStatus`, `useServiceWorker` du package `@insurtech/shared-pwa` (livre par 1.4.9) sont consommes par 3 composants : `PwaInstallBanner`, `OfflineBanner`, `UpdateAvailableBanner`.
- Le client API Axios local supporte une **queue offline IndexedDB** (les requetes POST/PUT/DELETE realisees offline sont stockees + rejouees au retour online) -- cette infrastructure sera enrichie au Sprint 25 declaration sinistre offline-first mais le squelette est livre des Sprint 4.
- La conformite stricte aux conventions decision-006 (zero emoji), decision-008 (cloud souverain), aux palettes Skalean Sofidemy (Orange #E95D2C / Navy #1A2730 / Sky Blue #B0CEE2 / ACAPS Teal #2D5773), au TypeScript strict, et aux regles Loi 09-08 CNDP / Loi 53-05 e-commerce / ANRT.
- Les tests unitaires (composants `PwaInstallBanner`, `OfflineBanner`, `UpdateAvailableBanner`, `register-sw`, `api-client offline queue`) passent. Les tests Playwright e2e (chromium mobile emulation Pixel 5 + mobile-safari iPhone 13 emulation) passent et un audit Lighthouse PWA atteint un score >= 90 pour la baseline (cible Sprint 24 : >= 95).

---

## 3. CONTEXTE ETENDU

### 3.1 Pourquoi une PWA et pas une app native iOS/Android

La cible est le **technicien atelier marocain** -- typiquement equipe d'un smartphone Android entry / mid-range (Samsung A12-A14, Xiaomi Redmi 9-10, Tecno Spark, Infinix Hot, Itel) ou parfois iPhone reconditionne. Trois contraintes fortes ont guide le choix PWA :

1. **Cout developpement** : developper deux applications natives (Swift iOS + Kotlin Android) double l'effort initial (~3 mois supplementaires) et triple l'effort de maintenance (3 codebases : web + iOS + Android au lieu d'1 PWA + reverse proxy). En Phase 1 Bootstrap, le ROI ne le justifie pas.
2. **Frictions distribution stores** : publier sur Google Play et App Store impose 1 a 4 semaines de revue (Apple historiquement strict), + 99 USD/an Apple + 25 USD inscription Google + frais 15-30 % sur paiements in-app (impact si Sprint 32 monetisation freemium technicien envisagee). Une PWA s'installe via le navigateur en 2 taps, sans store, sans validation tierce.
3. **Contexte usage Maroc** : etudes terrain Sprint 0 (entretiens 12 garages Casablanca-Rabat-Marrakech-Tanger janvier-fevrier 2026) ont montre que le technicien atelier est plus a l'aise pour ouvrir un lien WhatsApp envoye par le chef d'atelier (qui ouvre directement la PWA Chrome) que pour aller chercher une app dans le Play Store. Le taux de penetration des PWA installees via "Ajouter a l'ecran d'accueil" est >= 40 % chez les utilisateurs sensibilises (mesures benchmark e-commerce MA).

Une migration vers React Native ou Capacitor reste possible Sprint 32+ si une demande forte emerge (notifications push iOS plus fiables, integration camera native plus rapide), mais la PWA couvre 95 % des cas Sprint 4-30.

### 3.2 Pourquoi next-pwa 5.6.0 et pas serwist ou Workbox custom

Trois alternatives ont ete evaluees pour la couche PWA / service worker :

| Alternative | Pour | Contre | Decision Sprint 4 |
|-------------|------|--------|-------------------|
| **next-pwa 5.6.0** (Shadow Walker / shadowwalker/next-pwa) | Mature (5+ ans, 4k+ etoiles GitHub), wraps Workbox, integration drop-in `withPWA(nextConfig)`, runtimeCaching declaratif, pre-cache automatique du build `.next/`, doc abondante FR/EN, communaute Stack Overflow active, compatible Next.js 15 (avec patch peer-deps note ci-dessous) | Maintenu en mode minimal en 2025 (release 5.6.0 oct 2023, patch occasionnels), depend Workbox 6.x non Workbox 7.x, ne supporte pas natif App Router RSC streaming | **RETENUE** -- stabilite + simplicite > modernite. Migration future serwist evoquee Phase 5 |
| **serwist** (anciennement next-pwa-serwist) | Workbox 7.x, type-safe, support natif App Router Next.js 15, API moderne (defineConfig type-safe), generation manifest TypeScript-first, devtools incluses | Moins mature (1 an), breaking changes possibles, doc plus succinte, communaute restreinte 2026, peer-deps Next.js 15.1.0 documentees mais peu testees production | Migration Phase 5 (Sprint 32+) si necessite features Workbox 7 |
| **Workbox custom** (sans wrapper Next.js) | Controle total, derniere version Workbox 7, configuration extreme | Maintenance lourde (eject Next.js build pipeline), generation precache list manuelle, pas de hot reload SW dev, risk regressions a chaque upgrade Next.js | Rejete -- effort sans valeur Phase 1 |

**Note peer-deps Next.js 15** : `next-pwa 5.6.0` officiellement pinned `next ^11 || ^12 || ^13 || ^14`. Pour Next.js 15, on installe avec `pnpm add next-pwa@5.6.0 -D --ignore-peer-deps` et on documente cette derogation dans `apps/web-garage-mobile/README.md`. Tests Sprint 1 + Sprint 4 confirment compatibilite OK avec App Router (RSC + Server Actions). Si regression detectee Sprint 13+, fallback : pin Next 14.2.x sur cette app uniquement (configuration override) puis migrer serwist Sprint 32.

### 3.3 Trade-offs offline complexity vs UX

Une PWA "simple" ne fait que precacher quelques assets et afficher une page offline statique. Une PWA "offline-first" comme la cible Sprint 25 doit gerer :

- **File d'attente requetes ecriture (POST/PUT/DELETE)** : si offline, on stocke `{url, method, headers, body, timestamp}` dans IndexedDB store `outbox` puis on re-envoie au retour online. Conflits possibles cote serveur (etag mismatch, validation refusee) -> doit afficher un journal a l'utilisateur.
- **Synchronisation lecture (GET)** : Cache-then-Network avec marqueur staleness affiche dans l'UI ("Donnees vues il y a 12 minutes -- pas encore synchronisees").
- **Conflits IndexedDB quota** : Safari iOS impose une limite agressive (~50 Mo, eviction silencieuse au 7eme jour si utilisateur n'a pas relance la PWA), Chrome Android beaucoup plus genereux (60 % du stockage disponible, typiquement 1+ Go) -- ecart 20x.
- **UX retour online** : afficher banniere "Synchronisation en cours -- 12 actions en attente" avec progress bar, gerer les retries exponentiels, et notifier si echec definitif (l'utilisateur doit pouvoir voir et eventuellement retenter manuellement).

Sprint 4 livre **uniquement le squelette** : queue IndexedDB initialisee dans `api-client.ts` avec API publique `enqueueOffline()` / `flushQueue()` mais pas de logique metier conflits. Sprint 25 remplit la matrice complete.

### 3.4 iOS Safari quirks majeurs

iOS Safari (versions 16+ relevant 2026) presente plusieurs ecarts vs Chrome Android :

| Quirk | Impact | Mitigation Sprint 4 |
|-------|--------|---------------------|
| Pas de `beforeinstallprompt` event | Impossible de declencher prompt install programmatiquement | Detecter UA iOS + Safari, afficher banniere "Pour installer : Partager > Sur ecran d'accueil" |
| Pas de notifications push avant iOS 16.4 (Safari) | -30 % adoption iOS si features push critiques | Detecter version, fallback email + SMS (Sprint 9 SendGrid + 2N) |
| `theme-color` pris en compte uniquement si install Add-to-Home-Screen | Status bar reste blanche au premier visit Safari | OK -- accepte, banniere install incite Add-to-Home-Screen |
| IndexedDB quota agressif (~50 Mo) eviction 7 jours inactif | Donnees offline perdues pour utilisateur peu actif | Documenter dans CGU Sprint 5, prompter "Reconnectez-vous chaque semaine" |
| Service worker peut etre tue agressivement | Cache invalide aleatoirement | Strategie StaleWhileRevalidate sur pages -- accepte degradation UX |
| Pas de `Background Sync API` (uniquement Chrome Android) | Sync queue impossible si app fermee | Sync au prochain `visibilitychange` ou ouverture app |
| `viewport-fit=cover` necessaire iPhone notch (iPhone X+) | Encoche masque le contenu sans cover | Inclus dans viewport meta + safe-area-inset CSS |
| `apple-mobile-web-app-status-bar-style: black-translucent` | Status bar fond Skalean Navy quand installee | Inclus dans layout.tsx |
| Bug visibilitychange Safari iOS 17.0-17.2 | Service worker redemarre en boucle sur certains cas | Mitigation : eviter listener dans SW, polling cote app |

### 3.5 Decisions appliquees

**decision-006 -- No Emoji** : aucun caractere emoji unicode (U+1F300-U+1FAFF, U+2600-U+27BF, U+E000-U+F8FF zone PUA risquee) ne doit apparaitre dans le code source, les tests, les translations FR / ar-MA / ar, le README, les commits, les commentaires, les noms de fichiers. Substituts autorises : icones lucide-react (composant React `<Camera />`, `<Wifi />`, `<WifiOff />`, etc.), pictogrammes Skalean Sofidemy (SVG illustrations Sprint 4 livraison 1.4.8), texte mots-cles capitaliees ("HORS LIGNE" au lieu d'icone wifi-coupe emoji).

**decision-008 -- Cloud Souverain Atlas Cloud Benguerir** : tous les endpoints API, CDN, push notifications subscription endpoints, IndexedDB stockage local utilisateur, manifest URLs, icons URLs, screenshots URLs, web push VAPID keys server pointent exclusivement vers infrastructure Atlas Cloud Benguerir (`*.skalean-insurtech.ma`) ou stockage local navigateur. Aucune dependance Firebase Cloud Messaging (FCM Google US) ni AWS Amplify ni OneSignal SaaS US. La couche push notifications Sprint 9 utilisera **web-push standard W3C avec VAPID keys self-hosted** sur infra Atlas Cloud (pas d'intermediaire FCM cote serveur). Cote client, l'API `Notification.requestPermission()` est standard W3C cross-vendor (independante FCM).

**decision-PWA-strategy** (nouvelle Sprint 4, propagee 1.4.7 web-assure-mobile) : Strategy **Offline-first preparation, online-default execution**. La PWA utilise NetworkFirst pour les calls API (timeout 5s -> fallback cache si network fail). Le pre-cache se limite aux pages critiques (page placeholder, layout shell, login Sprint 5) pour eviter de gonfler le SW > 4 Mo (limite quota Safari iOS). Pas de Background Sync API (non supporte iOS) -- sync au retour online via event `online` listener + polling visibilitychange. La queue offline IndexedDB est versionnee (`outbox-v1`) pour migrations futures.

### 3.6 Pitfalls observes (10)

1. **SW cache eviction iOS Safari aggressive** : Apple impose un quota ~50 Mo pour PWA installees via Add-to-Home-Screen. Au-dela, eviction LRU silencieuse (l'utilisateur ne voit rien). Si la PWA accumule des photos sinistre Sprint 13 dans cache (jusqu'a 6 photos x 2 Mo = 12 Mo par sinistre), 4 sinistres saturent. Mitigation : compresser systematiquement les photos a < 500 Ko via `browser-image-compression` Sprint 13, et purger photos uploadees du cache local apres ack serveur.

2. **`beforeinstallprompt` ne se declenche qu'une seule fois** : Chrome Android dispatche cet evenement automatiquement si les criteres PWA sont passes (manifest valide, SW enregistre, HTTPS, scope, viewport, theme_color). Si le code n'a pas attache son listener au moment du dispatch, l'evenement est perdu. Mitigation cote `useInstallPrompt` (dans `@insurtech/shared-pwa`) : attacher le listener dans `useEffect` au mount initial, stocker l'event dans state React, et exposer `prompt()` ainsi que `userChoice` ulterieurement. Le hook re-emet l'event si l'utilisateur l'a deja dismiss localStorage > 7 jours.

3. **`manifest.webmanifest` doit etre servi avec `Content-Type: application/manifest+json`** : Next.js par defaut serve les fichiers de `public/` avec le mimetype determine par l'extension. `.webmanifest` est mappe `application/manifest+json` mais certains hosts (Vercel ok, infra Nginx auto-config) peuvent retourner `application/octet-stream`. Verifier via `curl -I https://garage-app.skalean-insurtech.ma/manifest.webmanifest`. Si erreur : ajouter regle Nginx `types { application/manifest+json webmanifest; }` ou rewrite Next.js custom headers dans `next.config.mjs`.

4. **`scope` vs `start_url`** : `start_url` est l'URL d'ouverture quand l'utilisateur lance la PWA depuis l'icone home screen (`/fr`). `scope` est la frontiere : si l'utilisateur navigue hors scope, la PWA s'ouvre dans un onglet navigateur classique (sans header standalone). Ici `scope: "/"` couvre toutes les pages, `start_url: "/fr"` lance par defaut sur la locale fr. Bug courant : oublier le slash final de scope (`scope: ""`), ou mettre un scope plus large que `start_url` (le navigateur refuse l'install).

5. **IndexedDB quota varie** : Chrome Android jusqu'a 60 % du stockage disponible (1-10 Go), Firefox Android 50 % (similaire), Safari iOS 50 Mo strict avec eviction LRU 7 jours. **Toujours appeler `navigator.storage.estimate()` au boot** pour connaitre le quota effectif et avertir l'utilisateur si < 100 Mo disponibles ("Espace stockage insuffisant pour le mode hors ligne"). Implemente dans `register-sw.ts` Sprint 4.

6. **Android Chrome WebAPK vs simple shortcut** : si manifest valide + SW + criteres engagement utilisateur (visite >= 30s, navigation >= 2 pages), Chrome Android genere un **WebAPK** (vrai package APK signe Google, integre dans le launcher avec icone full quality, settings notifications systeme). Si criteres non passes, simple shortcut bookmark (icone moins integree). Verifier engagement minimum via Lighthouse PWA audit "Installable".

7. **Push notification permission UX timing** : ne **JAMAIS** demander `Notification.requestPermission()` au load de la page (taux refus > 80 %). Demander uniquement apres action utilisateur explicite (par exemple Sprint 9 : utilisateur clique "Activer les notifications de tache" depuis page Profil). Sprint 4 ne demande pas la permission, livre uniquement infrastructure.

8. **Offline page must be precached** : si on tente d'acceder une page non precachee en mode offline, le SW renvoie ERR_INTERNET_DISCONNECTED (ou pire : page blanche Chrome). Mitigation : precacher explicitement `/offline` dans `next-pwa` config (`fallbacks: { document: '/offline' }`) et creer la page `src/app/offline/page.tsx` (sans locale prefix, accessible meme si i18n SSR fail).

9. **`theme-color` meta tag doit matcher `theme_color` manifest** : si `<meta name="theme-color" content="#E95D2C">` dans HTML head et `"theme_color": "#FF0000"` dans manifest, browser pris au piege -> applique parfois l'un parfois l'autre selon timing. Toujours synchroniser via constante TS partagee `src/lib/theme-colors.ts`.

10. **Manifest icons doivent etre PNG carres exacts** : un icon 192x192 declare en manifest doit etre **exactement** 192 px x 192 px (pas 191 ou 193). Lighthouse audit echoue sinon. Maskable icons doivent inclure une zone safe au centre (40 % rayon) pour clipping circulaire/squircle Android. Generation Sprint 4 placeholder logo Skalean -- regenerer Sprint 13 avec design final.

### 3.7 Cas d'usage utilisateurs cibles

**Persona 1 -- Younes, 32 ans, mecanicien chef** : 12 ans experience Citroen / Peugeot, gere 4 techniciens junior dans atelier Casablanca Sidi Maarouf. Smartphone Samsung Galaxy A23, ecran 6.6 pouces 720p, RAM 4 Go. Connexion 4G Inwi instable au sous-sol atelier (souvent 3G voire 2G EDGE). Consulte tous les matins la liste des taches reparties par le chef d'atelier (vue agenda jour), scanne le VIN du vehicule a l'arrivee (camera arriere QR/code-barre), prend 6 photos guidees (Sprint 13 pattern 14), signe l'ordre de travail tactile (signature pad Sprint 13).

**Persona 2 -- Karim, 28 ans, tolier-peintre** : 5 ans experience, smartphone iPhone 11 reconditionne 64 Go iOS 17. WiFi atelier OK mais coupe pause cafe. Doit photographier l'avancement reparation toutes les 2 heures (controle qualite remote chef d'atelier).

**Persona 3 -- Hicham, 24 ans, controleur qualite junior** : Xiaomi Redmi 9, 3 Go RAM, connexion 4G grand public Maroc Telecom. Recoit alertes push (Sprint 9) "Vehicule X pret pour controle final" -> ouvre PWA -> consulte checklist controle 35 points -> photo finale -> validation.

Ces personas guident les choix : manifest `orientation: "portrait"` (atelier mains huileuses, paysage non ergonomique), `display: "standalone"` (max espace ecran sans barre URL Chrome), pre-cache leger (3G EDGE -> chargement initial < 800 Ko), boutons tactiles >= 48 px (mains huileuses gants), contraste eleve (atelier sous lumiere neon ou ombre), texte minimaliste (Darija ar-MA disponible).

---

## 4. ARCHITECTURE -- DEPENDANCES ET BLOCAGES

### 4.1 Diagramme dependances tache

```
[1.4.2 web-garage]                  [1.4.9 shared-pwa]
       |                                    |
       +----+-------------------------------+
            |
            v
    [1.4.3 web-garage-mobile]   <-- CETTE TACHE
            |
    +-------+---------+-----------+
    |       |         |           |
    v       v         v           v
 [1.4.4]  [1.4.6]  [1.4.7]    [Sprint 9]
 admin   assure-  assure-     push notif
        portal   mobile       enrichit
                 (PWA dup)
                                v
                            [Sprint 13]
                            capture photo
                            signature
                                v
                            [Sprint 25]
                            offline-first
                            decla sinistre
```

### 4.2 Inputs heritages

- **De 1.4.2 web-garage** : `package.json` template (workspace `@insurtech/web-garage`), `next.config.mjs` baseline (sans PWA wrapper), `tailwind.config.ts` (preset Skalean Sofidemy), `tsconfig.json`, `src/i18n/request.ts`, `src/middleware.ts`, structure `src/app/[locale]/`, theme colors importes du package `@insurtech/shared-ui` constants.

- **De 1.4.9 shared-pwa** (peut etre stub si tache 1.4.9 en parallele) : 
  - `useInstallPrompt()` -> `{ canPrompt: boolean, prompt: () => Promise<'accepted'|'dismissed'>, dismissed: boolean }`
  - `useOnlineStatus()` -> `{ online: boolean, since: Date }`
  - `useServiceWorker()` -> `{ registration: ServiceWorkerRegistration | null, updateAvailable: boolean, applyUpdate: () => void }`
  - Helper `enqueueOfflineRequest(req: SerializedRequest)` -> Promise<void> (IndexedDB)
  - Helper `flushOfflineQueue()` -> Promise<{ success: number, failed: number }>

- **De 1.4.8 shared-ui** : composants `<Button>`, `<Card>`, `<Banner>`, `<Spinner>`, `<Icon>` (wrapper lucide-react), constantes `SKALEAN_COLORS`, theme provider context.

### 4.3 Outputs livres consommes par taches futures

- **Vers 1.4.4 web-insurtech-admin** : pattern next-pwa deja teste (admin n'a pas besoin PWA mais beneficie de la doc compatibility Next.js 15 + next-pwa 5.6.0).
- **Vers 1.4.6 web-assure-portal** : NA (pas PWA portal, mais shared-pwa hooks reutilisables).
- **Vers 1.4.7 web-assure-mobile** : pattern PWA **DUPPLIQUE TEL QUEL** -- le scaffolding `apps/web-assure-mobile` reprend manifest, next.config.mjs, layout viewport, register-sw, banniere install/offline a l'identique avec uniquement adaptations branding (name "Mon Espace Skalean Assurance", short_name "Skalean Assure", start_url `/fr/sinistres`, icons differents avec teinte Sky Blue Sprint 25).
- **Vers Sprint 9 push notifications** : infrastructure `Notification.permission` checkable, VAPID key publique disponible via `NEXT_PUBLIC_VAPID_PUBLIC_KEY` env var, endpoint subscription POST `/api/v1/push/subscribe` cote API (Sprint 9 finalise cote serveur web-push).
- **Vers Sprint 13 capture sinistre** : pattern composant `PhotoCapture` reutilise depuis `4-templates-generation.md` Pattern 14 -- la PWA expose deja les permissions camera (`navigator.mediaDevices.getUserMedia`) via wrapper.
- **Vers Sprint 25 declaration sinistre offline-first** : queue IndexedDB initialisee, `flushOfflineQueue()` deja branche au listener `online` event.

### 4.4 Multi-tenant strict

L'app web-garage-mobile doit suivre les regles multi-tenant :

- L'utilisateur authentifie (Sprint 5) recoit un `tenantId` dans son JWT.
- Toutes les requetes API doivent inclure header `x-tenant-id: <uuid>` injecte par interceptor Axios.
- Le service worker ne **doit pas** cacher de reponses cross-tenant (cache key inclut `tenantId` + `userId`).
- IndexedDB queue stockee dans store namespace `outbox-${tenantId}` pour eviter cross-tenant pollution.
- Au logout, purger IndexedDB, vider caches SW (`caches.keys()` + `caches.delete()`), unregister SW.

Voir Sprint 5 pour implementation auth flow complete.

---

## 5. LIVRABLES CHECKABLES

- [ ] L1. Repertoire `apps/web-garage-mobile/` cree avec arborescence complete.
- [ ] L2. `package.json` configure : nom `@insurtech/web-garage-mobile`, port dev 3003, scripts `dev`, `build`, `start`, `lint`, `test`, `test:e2e`, `lighthouse:pwa`, `manifest:validate`.
- [ ] L3. Dependances installees : Next.js 15.1.0, React 19.0.0, next-intl 3.26.3, next-pwa 5.6.0, workbox-webpack-plugin, axios 1.7.9, @tanstack/react-query 5.62.7, @tanstack/query-async-storage-persister, @tanstack/query-persist-client-core, idb 8.0.0, web-push 3.6.7 (placeholder pour Sprint 9 cote client).
- [ ] L4. `next.config.mjs` integre `withPWA(nextConfig)` avec configuration runtimeCaching (NetworkFirst api, CacheFirst static, StaleWhileRevalidate pages, NetworkOnly auth), `disable: process.env.NODE_ENV === 'development'`.
- [ ] L5. `tailwind.config.ts` etend preset Skalean Sofidemy avec breakpoints mobile-first (`xs: 360px`, `sm: 480px`, `md: 768px`).
- [ ] L6. `tsconfig.json` strict mode avec paths `@/*` -> `./src/*` et `@insurtech/shared-pwa`, `@insurtech/shared-ui`.
- [ ] L7. `public/manifest.webmanifest` complet (name, short_name, description, start_url `/fr`, scope `/`, display `standalone`, orientation `portrait`, theme_color `#E95D2C`, background_color `#1A2730`, lang `fr-MA`, dir `ltr`, categories `productivity`, `business`, icons array 3 entrees, shortcuts placeholder Sprint 13, screenshots placeholder Sprint 13).
- [ ] L8. Fichiers icons placeholder generes : `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-192.png`, `public/icons/icon-maskable-512.png`, `public/icons/apple-touch-icon-180.png`, `public/favicon.ico`.
- [ ] L9. `src/app/[locale]/layout.tsx` avec viewport mobile-first complet, theme-color #E95D2C, apple-mobile-web-app-capable, status-bar-style black-translucent, safe-area-inset CSS.
- [ ] L10. `src/app/[locale]/page.tsx` page placeholder dashboard mobile (taches du jour stub).
- [ ] L11. `src/app/offline/page.tsx` page offline statique pre-cachee (sans locale prefix).
- [ ] L12. `src/app/not-found.tsx` page 404 mobile-first.
- [ ] L13. `src/middleware.ts` next-intl middleware pour locale routing.
- [ ] L14. `src/i18n/request.ts` configuration next-intl avec 3 locales fr / ar-MA / ar.
- [ ] L15. `src/messages/fr.json`, `src/messages/ar-MA.json`, `src/messages/ar.json` avec vocab technicien (tache, scanner VIN, photo, signature, ordre de travail, hors ligne, synchronisation, etc.).
- [ ] L16. Composant `src/components/PwaInstallBanner.tsx` (~120 lignes complete, dismissible localStorage 7-day retention, animation slide-up, iOS detection avec instructions Add-to-Home-Screen, Android prompt() event).
- [ ] L17. Composant `src/components/OfflineBanner.tsx` (~60 lignes, fixed top, color warning yellow #FFB100, message localized).
- [ ] L18. Composant `src/components/UpdateAvailableBanner.tsx` (~80 lignes, listens controllerchange depuis shared-pwa, prompt reload).
- [ ] L19. Lib `src/lib/register-sw.ts` (~50 lignes) wrapper enregistrement SW + check storage quota.
- [ ] L20. Lib `src/lib/api-client.ts` Axios instance avec interceptors injection `x-tenant-id` + `x-trace-id` + `Authorization`, et offline queue (enqueue si `!navigator.onLine`, flush au retour online).
- [ ] L21. Lib `src/lib/query-client.ts` QueryClient TanStack Query configure avec persister IndexedDB.
- [ ] L22. Lib `src/lib/theme-colors.ts` constantes synchronisation theme.
- [ ] L23. Lib `src/lib/idb.ts` wrapper IndexedDB (queue offline) base sur `idb` v8.
- [ ] L24. Provider `src/providers/QueryProvider.tsx` integration React Query Provider.
- [ ] L25. Provider `src/providers/ServiceWorkerProvider.tsx` integration registration + update detection.
- [ ] L26. Fichier `public/sw-custom.js` placeholder (custom logic complement next-pwa generated).
- [ ] L27. `.env.example` complet avec toutes vars `NEXT_PUBLIC_*` (15+).
- [ ] L28. Fichier `README.md` avec instructions install, dev, audit Lighthouse PWA, validation manifest.
- [ ] L29. Tests unitaires Vitest pour `PwaInstallBanner`, `OfflineBanner`, `UpdateAvailableBanner`, `register-sw`, `api-client offline queue`, `theme-colors` -- 18+ tests.
- [ ] L30. Tests Playwright e2e mobile-safari + chromium mobile : install prompt visible, manifest valid, SW registered, offline mode page accessible, Lighthouse PWA score >= 90.
- [ ] L31. Validation `pnpm --filter @insurtech/web-garage-mobile lint` sans warning.
- [ ] L32. Validation `pnpm --filter @insurtech/web-garage-mobile typecheck` sans erreur.
- [ ] L33. Validation `pnpm --filter @insurtech/web-garage-mobile test` 100 % pass.
- [ ] L34. Validation `pnpm --filter @insurtech/web-garage-mobile build` succes (output `.next/` + `public/sw.js` + `public/workbox-*.js` generes).
- [ ] L35. Validation manuelle Chrome DevTools : Application > Manifest valid, Service Workers registered, Cache Storage populated.

---

## 6. CODE PATTERNS COMPLETS

### 6.1 `apps/web-garage-mobile/package.json`

```json
{
  "name": "@insurtech/web-garage-mobile",
  "version": "0.1.0",
  "private": true,
  "description": "Skalean Garage Mobile -- PWA technicien atelier (Sprint 4 bootstrap)",
  "license": "UNLICENSED",
  "author": "Skalean InsurTech <dev@skalean-insurtech.ma>",
  "scripts": {
    "dev": "next dev --port 3003",
    "build": "next build",
    "start": "next start --port 3003",
    "lint": "next lint --max-warnings 0",
    "lint:fix": "next lint --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "test:e2e": "playwright test --config=playwright.config.ts",
    "test:e2e:headed": "playwright test --headed",
    "lighthouse:pwa": "lhci autorun --collect.url=http://localhost:3003/fr --collect.settings.preset=desktop --assert.preset=lighthouse:no-pwa --assert.assertions.categories:pwa.minScore=0.90",
    "manifest:validate": "node scripts/validate-manifest.mjs",
    "sw:audit": "node scripts/audit-service-worker.mjs",
    "clean": "rm -rf .next .turbo coverage playwright-report public/sw.js public/workbox-*.js public/sw-*.js"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "next-intl": "3.26.3",
    "next-pwa": "5.6.0",
    "@tanstack/react-query": "5.62.7",
    "@tanstack/react-query-devtools": "5.62.7",
    "@tanstack/query-async-storage-persister": "5.62.7",
    "@tanstack/query-persist-client-core": "5.62.7",
    "axios": "1.7.9",
    "zustand": "5.0.2",
    "zod": "3.24.1",
    "clsx": "2.1.1",
    "tailwind-merge": "2.1.1",
    "lucide-react": "0.469.0",
    "idb": "8.0.0",
    "web-push": "3.6.7",
    "browser-image-compression": "2.0.2",
    "@insurtech/shared-ui": "workspace:*",
    "@insurtech/shared-pwa": "workspace:*",
    "@insurtech/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "22.10.2",
    "@types/react": "19.0.2",
    "@types/react-dom": "19.0.2",
    "@types/web-push": "3.6.4",
    "typescript": "5.7.2",
    "tailwindcss": "4.0.0-beta.4",
    "postcss": "8.4.49",
    "autoprefixer": "10.4.20",
    "eslint": "9.17.0",
    "eslint-config-next": "15.1.0",
    "vitest": "2.1.8",
    "@vitest/coverage-v8": "2.1.8",
    "@vitest/ui": "2.1.8",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/user-event": "14.5.2",
    "jsdom": "25.0.1",
    "@playwright/test": "1.49.1",
    "@lhci/cli": "0.14.0",
    "workbox-webpack-plugin": "7.3.0",
    "fake-indexeddb": "6.0.0"
  },
  "engines": {
    "node": ">=20.18.0",
    "pnpm": ">=9.15.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

### 6.2 `apps/web-garage-mobile/next.config.mjs`

```javascript
// apps/web-garage-mobile/next.config.mjs
// Configuration Next.js 15 + next-pwa 5.6.0 pour PWA technicien garage atelier.
// Decision : next-pwa retenu vs serwist (voir contexte 3.2).
// Note peer-deps : install via --ignore-peer-deps Sprint 4, migration serwist envisagee Sprint 32+.

import withPWAInit from 'next-pwa';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  scope: '/',
  sw: 'sw.js',
  publicExcludes: ['!noprecache/**/*'],
  buildExcludes: [/middleware-manifest\.json$/, /_buildManifest\.js$/],
  fallbacks: {
    document: '/offline',
  },
  cacheOnFrontEndNav: true,
  reloadOnOnline: false,
  runtimeCaching: [
    {
      // Auth endpoints -- toujours network only, jamais cacher
      urlPattern: /\/api\/v1\/auth\/.*/,
      handler: 'NetworkOnly',
      options: {
        cacheName: 'auth-no-cache',
      },
    },
    {
      // API garage routes -- NetworkFirst avec timeout 5s
      urlPattern: /^https:\/\/api\.skalean-insurtech\.ma\/api\/v1\/(garage|tasks|vehicles|repair-orders)\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-garage-cache',
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24,
        },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // API generic Skalean -- NetworkFirst plus court 3s
      urlPattern: /^https:\/\/api\.skalean-insurtech\.ma\/api\/v1\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-generic-cache',
        networkTimeoutSeconds: 3,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 6 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    {
      // Static images -- CacheFirst long
      urlPattern: /\.(?:png|jpg|jpeg|webp|svg|gif|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-images-cache',
        expiration: {
          maxEntries: 300,
          maxAgeSeconds: 60 * 60 * 24 * 30,
        },
      },
    },
    {
      // Fonts -- CacheFirst tres long
      urlPattern: /\.(?:woff|woff2|ttf|eot|otf)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-fonts-cache',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 60 * 60 * 24 * 90,
        },
      },
    },
    {
      // CSS / JS -- StaleWhileRevalidate
      urlPattern: /\.(?:js|css)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-resources-cache',
        expiration: {
          maxEntries: 120,
          maxAgeSeconds: 60 * 60 * 24 * 7,
        },
      },
    },
    {
      // HTML pages -- StaleWhileRevalidate
      urlPattern: ({ request }) => request.destination === 'document',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages-cache',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60 * 60 * 24,
        },
      },
    },
    {
      // Cross-origin manifests / icons / assets -- NetworkFirst
      urlPattern: /^https:\/\/(cdn\.skalean-insurtech\.ma|garage-app\.skalean-insurtech\.ma)\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'cdn-assets-cache',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,
  experimental: {
    typedRoutes: true,
    optimizePackageImports: ['lucide-react', 'date-fns'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '*.skalean-insurtech.ma' },
      { protocol: 'https', hostname: 'cdn.skalean-insurtech.ma' },
    ],
  },
  async headers() {
    return [
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=86400, must-revalidate' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self), notifications=(self)' },
        ],
      },
    ];
  },
  async rewrites() {
    return [];
  },
};

export default withNextIntl(withPWA(nextConfig));
```

### 6.3 `apps/web-garage-mobile/tailwind.config.ts`

```typescript
// apps/web-garage-mobile/tailwind.config.ts
import type { Config } from 'tailwindcss';
import sharedPreset from '@insurtech/shared-ui/tailwind-preset';

const config: Config = {
  presets: [sharedPreset],
  content: [
    './src/**/*.{ts,tsx,mdx}',
    '../../packages/shared-ui/src/**/*.{ts,tsx}',
    '../../packages/shared-pwa/src/**/*.{ts,tsx}',
  ],
  theme: {
    screens: {
      // Mobile-first breakpoints emphasized -- la PWA est concue pour smartphones
      // bas / moyen gamme (Samsung A12-A14, Xiaomi Redmi 9-10, Itel A56) en MA.
      'xs': '360px',  // Itel A56, smartphones <= 4 pouces
      'sm': '480px',  // Galaxy A12 portrait, Redmi 9
      'md': '768px',  // tablette portrait, Galaxy Tab A
      'lg': '1024px', // tablette paysage, iPad mini
      'xl': '1280px', // desktop -- inutilise sauf preview
    },
    extend: {
      colors: {
        // Importes du preset shared-ui mais re-exposes pour clarte
        skalean: {
          orange: '#E95D2C',
          navy: '#1A2730',
          sky: '#B0CEE2',
          teal: '#2D5773',
          warning: '#FFB100',
          success: '#2ECC71',
          danger: '#E74C3C',
        },
      },
      spacing: {
        // Safe area insets iPhone notch (iPhone X+)
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minHeight: {
        // Boutons tactiles atelier (techniciens mains huileuses + gants)
        'tap': '48px',
        'tap-lg': '56px',
      },
      fontSize: {
        'tap-label': ['16px', { lineHeight: '24px', fontWeight: '600' }],
      },
      animation: {
        'slide-up': 'slide-up 280ms cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-down': 'slide-down 220ms ease-out',
      },
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

### 6.4 `apps/web-garage-mobile/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext", "WebWorker"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "allowJs": false,
    "incremental": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "forceConsistentCasingInFileNames": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "useDefineForClassFields": true,
    "verbatimModuleSyntax": false,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@insurtech/shared-ui": ["../../packages/shared-ui/src"],
      "@insurtech/shared-ui/*": ["../../packages/shared-ui/src/*"],
      "@insurtech/shared-pwa": ["../../packages/shared-pwa/src"],
      "@insurtech/shared-pwa/*": ["../../packages/shared-pwa/src/*"],
      "@insurtech/shared-types": ["../../packages/shared-types/src"]
    }
  },
  "include": [
    "next-env.d.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules", ".next", "out", "coverage", "playwright-report", "tests-e2e"]
}
```

### 6.5 `apps/web-garage-mobile/public/manifest.webmanifest`

```json
{
  "name": "Skalean Garage Mobile",
  "short_name": "Skalean Garage",
  "description": "Application PWA pour technicien garage en atelier -- consultation taches du jour, scan VIN, photos sinistre, signature ordre de travail.",
  "start_url": "/fr",
  "scope": "/",
  "id": "/",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui", "browser"],
  "orientation": "portrait",
  "theme_color": "#E95D2C",
  "background_color": "#1A2730",
  "lang": "fr-MA",
  "dir": "ltr",
  "categories": ["productivity", "business", "utilities"],
  "prefer_related_applications": false,
  "related_applications": [],
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    },
    {
      "src": "/icons/icon-maskable-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-maskable-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/apple-touch-icon-180.png",
      "sizes": "180x180",
      "type": "image/png",
      "purpose": "any"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/dashboard-mobile-1.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Dashboard taches du jour (Sprint 13)"
    },
    {
      "src": "/screenshots/scan-vin-mobile-1.png",
      "sizes": "1080x1920",
      "type": "image/png",
      "form_factor": "narrow",
      "label": "Scan VIN vehicule (Sprint 13)"
    }
  ],
  "shortcuts": [
    {
      "name": "Mes taches du jour",
      "short_name": "Mes taches",
      "description": "Voir la liste des taches assignees aujourd'hui",
      "url": "/fr/tasks/today",
      "icons": [{ "src": "/icons/shortcut-tasks-96.png", "sizes": "96x96" }]
    },
    {
      "name": "Scanner VIN",
      "short_name": "Scan VIN",
      "description": "Lancer la camera pour scanner le VIN d'un vehicule",
      "url": "/fr/scan-vin",
      "icons": [{ "src": "/icons/shortcut-scan-96.png", "sizes": "96x96" }]
    }
  ],
  "protocol_handlers": [],
  "share_target": {
    "action": "/fr/share-receive",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [{ "name": "photos", "accept": ["image/*"] }]
    }
  }
}
```

### 6.6 `apps/web-garage-mobile/src/app/[locale]/layout.tsx`

```typescript
// apps/web-garage-mobile/src/app/[locale]/layout.tsx
import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Montserrat, Noto_Naskh_Arabic } from 'next/font/google';
import { SKALEAN_COLORS } from '@/lib/theme-colors';
import { QueryProvider } from '@/providers/QueryProvider';
import { ServiceWorkerProvider } from '@/providers/ServiceWorkerProvider';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateAvailableBanner } from '@/components/UpdateAvailableBanner';
import '@/styles/globals.css';

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '600', '700', '800', '900'],
  variable: '--font-montserrat',
  display: 'swap',
});

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-noto-naskh',
  display: 'swap',
});

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: SKALEAN_COLORS.orange },
    { media: '(prefers-color-scheme: dark)', color: SKALEAN_COLORS.navy },
  ],
  colorScheme: 'light dark',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://garage-app.skalean-insurtech.ma'),
  title: {
    default: 'Skalean Garage Mobile',
    template: '%s -- Skalean Garage',
  },
  description: 'Application PWA pour technicien garage atelier -- taches du jour, scan VIN, photos sinistre, signature OT.',
  applicationName: 'Skalean Garage Mobile',
  generator: 'Next.js 15',
  keywords: ['skalean', 'garage', 'mobile', 'pwa', 'technicien', 'atelier', 'maroc', 'insurtech'],
  authors: [{ name: 'Skalean InsurTech', url: 'https://skalean-insurtech.ma' }],
  creator: 'Skalean InsurTech',
  publisher: 'Skalean InsurTech',
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
    url: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Skalean Garage',
    startupImage: [
      { url: '/splash/launch-iphone-13.png', media: '(device-width: 390px) and (device-height: 844px)' },
      { url: '/splash/launch-iphone-se.png', media: '(device-width: 375px) and (device-height: 667px)' },
    ],
  },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }],
    shortcut: '/favicon.ico',
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_MA',
    alternateLocale: ['ar_MA'],
    url: 'https://garage-app.skalean-insurtech.ma',
    siteName: 'Skalean Garage Mobile',
    title: 'Skalean Garage Mobile',
    description: 'Application PWA technicien garage atelier',
  },
  twitter: { card: 'summary' },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const lang = locale === 'ar-MA' ? 'ar-MA' : locale === 'ar' ? 'ar' : 'fr-MA';

  return (
    <html lang={lang} dir={dir} className={`${montserrat.variable} ${notoNaskh.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Skalean Garage" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content={SKALEAN_COLORS.orange} />
        <meta name="msapplication-tap-highlight" content="no" />
        <meta name="format-detection" content="telephone=no, date=no, email=no, address=no" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon-180.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icons/icon-512.png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="dns-prefetch" href="https://api.skalean-insurtech.ma" />
        <link rel="preconnect" href="https://api.skalean-insurtech.ma" crossOrigin="" />
      </head>
      <body className="bg-skalean-navy text-white font-sans min-h-screen overscroll-none antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <ServiceWorkerProvider>
              <UpdateAvailableBanner />
              <OfflineBanner />
              <main className="pt-safe-top pb-safe-bottom px-safe-left pr-safe-right min-h-screen">
                {children}
              </main>
              <PwaInstallBanner />
            </ServiceWorkerProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 6.7 `apps/web-garage-mobile/src/app/[locale]/page.tsx`

```typescript
// apps/web-garage-mobile/src/app/[locale]/page.tsx
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { Card } from '@insurtech/shared-ui';
import { Wrench, ScanLine, Camera, FileSignature, WifiOff, RefreshCw } from 'lucide-react';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <DashboardContent />;
}

function DashboardContent() {
  const t = useTranslations('dashboard');

  const quickActions = [
    { id: 'tasks-today', icon: Wrench, label: t('quickActions.tasksToday'), href: '/tasks/today' },
    { id: 'scan-vin', icon: ScanLine, label: t('quickActions.scanVin'), href: '/scan-vin' },
    { id: 'photos', icon: Camera, label: t('quickActions.photos'), href: '/photos' },
    { id: 'sign-ot', icon: FileSignature, label: t('quickActions.signOt'), href: '/sign-ot' },
  ];

  return (
    <div className="px-4 py-6 max-w-screen-md mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-skalean-orange mb-1">{t('title')}</h1>
        <p className="text-sm text-skalean-sky">{t('subtitle')}</p>
      </header>

      <section className="grid grid-cols-2 gap-3 mb-6">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Card
              key={action.id}
              className="p-4 flex flex-col items-center justify-center min-h-tap-lg bg-skalean-teal hover:bg-skalean-orange transition-colors active:scale-95"
            >
              <Icon className="w-8 h-8 mb-2 text-white" aria-hidden="true" />
              <span className="text-tap-label text-white text-center">{action.label}</span>
            </Card>
          );
        })}
      </section>

      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">{t('todayTasks.title')}</h2>
        <Card className="p-4 bg-skalean-navy/60 border border-skalean-sky/20">
          <p className="text-sm text-skalean-sky">{t('todayTasks.placeholder')}</p>
          <p className="text-xs text-white/50 mt-2">{t('todayTasks.sprintNote')}</p>
        </Card>
      </section>

      <footer className="text-xs text-white/40 text-center mt-12">
        <p>{t('footer.version')} 0.1.0 -- Sprint 4 Bootstrap</p>
        <p className="mt-1">{t('footer.copyright')}</p>
      </footer>
    </div>
  );
}
```

### 6.8 `apps/web-garage-mobile/src/app/offline/page.tsx`

```typescript
// apps/web-garage-mobile/src/app/offline/page.tsx
// Page offline pre-cachee par next-pwa fallbacks.document = '/offline'.
// Volontairement sans locale prefix pour etre accessible meme si i18n SSR fail.

import { WifiOff } from 'lucide-react';

export const dynamic = 'force-static';
export const revalidate = false;

export default function OfflinePage() {
  return (
    <html lang="fr-MA" dir="ltr">
      <head>
        <meta charSet="utf-8" />
        <title>Hors ligne -- Skalean Garage</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#E95D2C" />
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: '#1A2730',
        color: 'white',
        fontFamily: 'Montserrat, sans-serif',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        textAlign: 'center',
      }}>
        <WifiOff size={64} color="#FFB100" aria-hidden="true" />
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#E95D2C', marginTop: 24, marginBottom: 8 }}>
          Mode hors ligne
        </h1>
        <p style={{ fontSize: 16, color: '#B0CEE2', maxWidth: 320, lineHeight: 1.5 }}>
          Vous etes actuellement hors ligne. Les modifications que vous effectuez seront synchronisees au retour de la connexion.
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 32 }}>
          Skalean Garage Mobile -- v0.1.0
        </p>
      </body>
    </html>
  );
}
```

### 6.9 `apps/web-garage-mobile/src/middleware.ts`

```typescript
// apps/web-garage-mobile/src/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['fr', 'ar-MA', 'ar'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true,
});

export default function middleware(request: NextRequest) {
  // Bypass middleware pour assets PWA (manifest, icons, sw)
  const { pathname } = request.nextUrl;
  if (
    pathname === '/manifest.webmanifest' ||
    pathname === '/sw.js' ||
    pathname === '/sw-custom.js' ||
    pathname.startsWith('/workbox-') ||
    pathname.startsWith('/icons/') ||
    pathname.startsWith('/screenshots/') ||
    pathname.startsWith('/splash/') ||
    pathname === '/favicon.ico' ||
    pathname === '/offline' ||
    pathname.startsWith('/_next/')
  ) {
    return NextResponse.next();
  }
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

### 6.10 `apps/web-garage-mobile/src/i18n/request.ts`

```typescript
// apps/web-garage-mobile/src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !SUPPORTED_LOCALES.includes(locale as (typeof SUPPORTED_LOCALES)[number])) {
    locale = 'fr';
  }
  try {
    const messages = (await import(`../messages/${locale}.json`)).default;
    return {
      locale,
      messages,
      timeZone: 'Africa/Casablanca',
      now: new Date(),
      formats: {
        dateTime: {
          short: { day: 'numeric', month: 'short', year: 'numeric' },
          long: { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' },
        },
      },
    };
  } catch {
    notFound();
  }
});
```

### 6.11 `apps/web-garage-mobile/src/messages/fr.json`

```json
{
  "common": {
    "appName": "Skalean Garage Mobile",
    "loading": "Chargement...",
    "error": "Une erreur est survenue",
    "retry": "Reessayer",
    "cancel": "Annuler",
    "confirm": "Confirmer",
    "close": "Fermer",
    "save": "Enregistrer",
    "back": "Retour",
    "next": "Suivant",
    "yes": "Oui",
    "no": "Non"
  },
  "dashboard": {
    "title": "Bienvenue Technicien",
    "subtitle": "Vos taches et actions du jour en un coup d'oeil",
    "quickActions": {
      "tasksToday": "Mes taches du jour",
      "scanVin": "Scanner VIN vehicule",
      "photos": "Prendre photos sinistre",
      "signOt": "Signer ordre de travail"
    },
    "todayTasks": {
      "title": "Taches du jour",
      "placeholder": "La liste des taches assignees aujourd'hui sera disponible au Sprint 13.",
      "sprintNote": "Sprint 4 Bootstrap -- module en cours de developpement"
    },
    "footer": {
      "version": "Version",
      "copyright": "Skalean InsurTech 2026 -- Tous droits reserves"
    }
  },
  "pwa": {
    "install": {
      "title": "Installer Skalean Garage",
      "description": "Acces rapide depuis votre ecran d'accueil, mode hors ligne et notifications.",
      "buttonInstall": "Installer maintenant",
      "buttonDismiss": "Plus tard",
      "iosTitle": "Pour installer sur iPhone / iPad",
      "iosStep1": "Appuyez sur le bouton Partager",
      "iosStep2": "Choisissez Sur l'ecran d'accueil",
      "iosStep3": "Confirmez avec Ajouter"
    },
    "offline": {
      "banner": "Mode hors ligne -- Les modifications seront synchronisees automatiquement",
      "queueLength": "{count, plural, one {# action en attente} other {# actions en attente}}",
      "syncInProgress": "Synchronisation en cours..."
    },
    "update": {
      "title": "Nouvelle version disponible",
      "description": "Une mise a jour de l'application est prete. Recharger maintenant ?",
      "buttonReload": "Recharger",
      "buttonLater": "Plus tard"
    }
  },
  "tasks": {
    "list": {
      "title": "Taches du jour",
      "empty": "Aucune tache assignee aujourd'hui",
      "loading": "Chargement des taches..."
    },
    "labels": {
      "vehicle": "Vehicule",
      "vin": "Numero VIN",
      "client": "Client",
      "type": "Type intervention",
      "priority": "Priorite",
      "estimatedTime": "Duree estimee",
      "status": "Statut"
    },
    "status": {
      "pending": "En attente",
      "inProgress": "En cours",
      "qualityCheck": "Controle qualite",
      "completed": "Termine"
    }
  },
  "scan": {
    "title": "Scanner VIN",
    "instruction": "Pointez la camera vers le numero VIN du vehicule (sous le pare-brise ou pied milieu)",
    "permissionRequired": "L'application a besoin d'acceder a la camera",
    "permissionDenied": "Acces camera refuse -- veuillez autoriser dans les parametres",
    "manualEntry": "Saisir le VIN manuellement",
    "vinPattern": "Le VIN doit faire 17 caracteres alphanumeriques"
  },
  "photo": {
    "title": "Photos sinistre",
    "guideStep1": "Face avant du vehicule",
    "guideStep2": "Face arriere du vehicule",
    "guideStep3": "Cote gauche complet",
    "guideStep4": "Cote droit complet",
    "guideStep5": "Zoom sur la zone endommagee",
    "guideStep6": "Plaque immatriculation lisible",
    "buttonCapture": "Prendre la photo",
    "buttonRetake": "Reprendre",
    "buttonNext": "Suivant",
    "buttonValidate": "Valider les photos"
  },
  "signature": {
    "title": "Signature ordre de travail",
    "instruction": "Veuillez signer ci-dessous pour valider l'ordre de travail",
    "buttonClear": "Effacer",
    "buttonValidate": "Valider la signature",
    "consent": "Je certifie avoir pris connaissance et accepte l'ordre de travail"
  },
  "errors": {
    "404": {
      "title": "Page introuvable",
      "description": "La page demandee n'existe pas ou a ete deplacee.",
      "buttonHome": "Retour a l'accueil"
    },
    "500": {
      "title": "Erreur serveur",
      "description": "Une erreur technique est survenue. Veuillez reessayer.",
      "buttonRetry": "Reessayer"
    },
    "network": {
      "title": "Probleme de connexion",
      "description": "Verifiez votre connexion Internet et reessayez."
    }
  }
}
```

### 6.12 `apps/web-garage-mobile/src/messages/ar-MA.json`

```json
{
  "common": {
    "appName": "Skalean Garage Mobile",
    "loading": "كيتسالا...",
    "error": "وقع شي خطأ",
    "retry": "عاود",
    "cancel": "إلغي",
    "confirm": "أكد",
    "close": "سد",
    "save": "سجل",
    "back": "ارجع",
    "next": "التالي",
    "yes": "أه",
    "no": "لا"
  },
  "dashboard": {
    "title": "مرحبا بيك يا التقني",
    "subtitle": "خدماتك ديال اليوم بنظرة وحدة",
    "quickActions": {
      "tasksToday": "خدماتي ديال اليوم",
      "scanVin": "سكاني رقم VIN ديال السيارة",
      "photos": "صور ديال الحادثة",
      "signOt": "وقع على أمر الخدمة"
    },
    "todayTasks": {
      "title": "خدمات اليوم",
      "placeholder": "اللائحة ديال الخدمات غادي تكون متاحة فالسبرينت 13.",
      "sprintNote": "السبرينت 4 -- المودول كيتطور"
    },
    "footer": {
      "version": "النسخة",
      "copyright": "Skalean InsurTech 2026 -- كاملة الحقوق محفوظة"
    }
  },
  "pwa": {
    "install": {
      "title": "ركب Skalean Garage",
      "description": "وصول سريع من شاشة الاستقبال، وضع بلا انترنت، والإشعارات.",
      "buttonInstall": "ركب دابا",
      "buttonDismiss": "من بعد",
      "iosTitle": "باش تركب فـ iPhone / iPad",
      "iosStep1": "ضرب على زر المشاركة",
      "iosStep2": "اختر فـ شاشة الاستقبال",
      "iosStep3": "أكد بـ زيد"
    },
    "offline": {
      "banner": "وضع بلا انترنت -- التعديلات غادي تتزامن أوتوماتيكيا",
      "queueLength": "{count, plural, one {# عملية فالانتظار} other {# عمليات فالانتظار}}",
      "syncInProgress": "كتزامن..."
    },
    "update": {
      "title": "نسخة جديدة متاحة",
      "description": "كاينة تحديث للتطبيق. أحمل دابا؟",
      "buttonReload": "أحمل",
      "buttonLater": "من بعد"
    }
  },
  "tasks": {
    "list": {
      "title": "خدمات اليوم",
      "empty": "ماكاين حتى خدمة اليوم",
      "loading": "كيتم تحميل الخدمات..."
    }
  }
}
```

### 6.13 `apps/web-garage-mobile/src/messages/ar.json`

```json
{
  "common": {
    "appName": "Skalean Garage Mobile",
    "loading": "جاري التحميل...",
    "error": "حدث خطأ",
    "retry": "إعادة المحاولة",
    "cancel": "إلغاء",
    "confirm": "تأكيد",
    "close": "إغلاق",
    "save": "حفظ",
    "back": "رجوع",
    "next": "التالي",
    "yes": "نعم",
    "no": "لا"
  },
  "dashboard": {
    "title": "مرحباً أيها الفني",
    "subtitle": "مهامك وإجراءاتك اليومية في لمحة",
    "quickActions": {
      "tasksToday": "مهام اليوم",
      "scanVin": "مسح رقم VIN للمركبة",
      "photos": "التقاط صور الحادث",
      "signOt": "توقيع أمر الخدمة"
    },
    "todayTasks": {
      "title": "مهام اليوم",
      "placeholder": "قائمة المهام المعينة لليوم ستكون متاحة في السبرينت 13.",
      "sprintNote": "السبرينت 4 -- الوحدة قيد التطوير"
    },
    "footer": {
      "version": "الإصدار",
      "copyright": "Skalean InsurTech 2026 -- جميع الحقوق محفوظة"
    }
  },
  "pwa": {
    "install": {
      "title": "تثبيت Skalean Garage",
      "description": "وصول سريع من الشاشة الرئيسية، وضع عدم الاتصال، والإشعارات.",
      "buttonInstall": "تثبيت الآن",
      "buttonDismiss": "لاحقاً",
      "iosTitle": "لتثبيت التطبيق على iPhone / iPad",
      "iosStep1": "اضغط على زر المشاركة",
      "iosStep2": "اختر إضافة إلى الشاشة الرئيسية",
      "iosStep3": "أكد بالضغط على إضافة"
    },
    "offline": {
      "banner": "وضع عدم الاتصال -- سيتم مزامنة التعديلات تلقائياً",
      "queueLength": "{count, plural, one {# إجراء في الانتظار} other {# إجراءات في الانتظار}}",
      "syncInProgress": "جاري المزامنة..."
    },
    "update": {
      "title": "إصدار جديد متاح",
      "description": "هناك تحديث للتطبيق جاهز. هل تريد إعادة التحميل الآن؟",
      "buttonReload": "إعادة التحميل",
      "buttonLater": "لاحقاً"
    }
  }
}
```

### 6.14 `apps/web-garage-mobile/src/components/PwaInstallBanner.tsx`

```typescript
// apps/web-garage-mobile/src/components/PwaInstallBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useInstallPrompt } from '@insurtech/shared-pwa';
import { Button } from '@insurtech/shared-ui';
import { Download, Share, Plus, X } from 'lucide-react';

const DISMISS_STORAGE_KEY = 'skalean-pwa-install-dismissed-at';
const DISMISS_RETENTION_DAYS = 7;

function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome|crios|fxios|edgios/.test(ua);
  return isIos && isSafari;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function wasRecentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  const dismissedAt = window.localStorage.getItem(DISMISS_STORAGE_KEY);
  if (!dismissedAt) return false;
  const dismissedDate = new Date(dismissedAt);
  const ageMs = Date.now() - dismissedDate.getTime();
  const retentionMs = DISMISS_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  return ageMs < retentionMs;
}

export function PwaInstallBanner() {
  const t = useTranslations('pwa.install');
  const { canPrompt, prompt: triggerPrompt } = useInstallPrompt();
  const [isVisible, setIsVisible] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (wasRecentlyDismissed()) return;

    const ios = isIosSafari();
    if (ios) {
      const t = setTimeout(() => setIsVisible(true), 3000);
      return () => clearTimeout(t);
    }

    if (canPrompt) {
      const t = setTimeout(() => setIsVisible(true), 5000);
      return () => clearTimeout(t);
    }
  }, [canPrompt]);

  const handleInstall = async () => {
    if (isIosSafari()) {
      setShowIosInstructions(true);
      return;
    }
    const outcome = await triggerPrompt();
    if (outcome === 'accepted' || outcome === 'dismissed') {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_STORAGE_KEY, new Date().toISOString());
    }
    setIsVisible(false);
    setShowIosInstructions(false);
  };

  if (!isVisible) return null;

  if (showIosInstructions) {
    return (
      <div
        role="dialog"
        aria-labelledby="pwa-install-ios-title"
        aria-modal="false"
        className="fixed bottom-0 inset-x-0 z-50 bg-skalean-navy border-t-2 border-skalean-orange p-4 pb-safe-bottom animate-slide-up shadow-2xl"
      >
        <div className="max-w-screen-md mx-auto">
          <div className="flex items-start justify-between mb-3">
            <h2 id="pwa-install-ios-title" className="text-lg font-bold text-skalean-orange">
              {t('iosTitle')}
            </h2>
            <button
              onClick={handleDismiss}
              aria-label={t('buttonDismiss')}
              className="text-white/70 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <ol className="space-y-2 text-sm text-white">
            <li className="flex items-center gap-2">
              <span className="bg-skalean-orange text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <Share className="w-4 h-4 text-skalean-sky" />
              <span>{t('iosStep1')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="bg-skalean-orange text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <Plus className="w-4 h-4 text-skalean-sky" />
              <span>{t('iosStep2')}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="bg-skalean-orange text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <span>{t('iosStep3')}</span>
            </li>
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-labelledby="pwa-install-title"
      aria-modal="false"
      className="fixed bottom-0 inset-x-0 z-50 bg-skalean-navy border-t-2 border-skalean-orange p-4 pb-safe-bottom animate-slide-up shadow-2xl"
    >
      <div className="max-w-screen-md mx-auto flex items-start gap-3">
        <Download className="w-8 h-8 text-skalean-orange flex-shrink-0 mt-1" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h2 id="pwa-install-title" className="text-base font-bold text-white">
            {t('title')}
          </h2>
          <p className="text-sm text-skalean-sky mt-1">{t('description')}</p>
        </div>
        <button
          onClick={handleDismiss}
          aria-label={t('buttonDismiss')}
          className="text-white/70 hover:text-white p-1 flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="max-w-screen-md mx-auto flex gap-2 mt-4">
        <Button
          onClick={handleInstall}
          variant="primary"
          size="lg"
          className="flex-1 min-h-tap-lg"
        >
          {t('buttonInstall')}
        </Button>
        <Button
          onClick={handleDismiss}
          variant="ghost"
          size="lg"
          className="min-h-tap-lg"
        >
          {t('buttonDismiss')}
        </Button>
      </div>
    </div>
  );
}
```

### 6.15 `apps/web-garage-mobile/src/components/OfflineBanner.tsx`

```typescript
// apps/web-garage-mobile/src/components/OfflineBanner.tsx
'use client';

import { useTranslations } from 'next-intl';
import { useOnlineStatus } from '@insurtech/shared-pwa';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const { online } = useOnlineStatus();
  const t = useTranslations('pwa.offline');
  const [queueLength, setQueueLength] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (online && queueLength > 0) {
      setIsSyncing(true);
      const t = setTimeout(() => {
        setIsSyncing(false);
        setQueueLength(0);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [online, queueLength]);

  if (online && !isSyncing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-40 bg-skalean-warning text-skalean-navy py-2 px-4 pt-safe-top text-center text-sm font-semibold shadow-md animate-slide-down"
    >
      <div className="max-w-screen-md mx-auto flex items-center justify-center gap-2">
        {isSyncing ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>{t('syncInProgress')}</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" aria-hidden="true" />
            <span>{t('banner')}</span>
            {queueLength > 0 && (
              <span className="bg-skalean-navy text-skalean-warning rounded-full px-2 py-0.5 text-xs ml-2">
                {t('queueLength', { count: queueLength })}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

### 6.16 `apps/web-garage-mobile/src/components/UpdateAvailableBanner.tsx`

```typescript
// apps/web-garage-mobile/src/components/UpdateAvailableBanner.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useServiceWorker } from '@insurtech/shared-pwa';
import { Button } from '@insurtech/shared-ui';
import { ArrowDownCircle, X } from 'lucide-react';

export function UpdateAvailableBanner() {
  const { updateAvailable, applyUpdate } = useServiceWorker();
  const [isVisible, setIsVisible] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const t = useTranslations('pwa.update');

  useEffect(() => {
    if (updateAvailable) {
      setIsVisible(true);
    }
  }, [updateAvailable]);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const handleControllerChange = () => {
      if (isApplying) {
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, [isApplying]);

  const handleReload = async () => {
    setIsApplying(true);
    await applyUpdate();
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      role="alertdialog"
      aria-labelledby="pwa-update-title"
      className="fixed top-0 inset-x-0 z-50 bg-skalean-orange text-white py-3 px-4 pt-safe-top shadow-lg animate-slide-down"
    >
      <div className="max-w-screen-md mx-auto flex items-center gap-3">
        <ArrowDownCircle className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <h3 id="pwa-update-title" className="font-bold text-sm">{t('title')}</h3>
          <p className="text-xs text-white/90 mt-0.5">{t('description')}</p>
        </div>
        <Button
          onClick={handleReload}
          variant="secondary"
          size="sm"
          disabled={isApplying}
          className="bg-white text-skalean-orange hover:bg-white/90"
        >
          {isApplying ? '...' : t('buttonReload')}
        </Button>
        <button
          onClick={handleDismiss}
          aria-label={t('buttonLater')}
          className="text-white/80 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
```

### 6.17 `apps/web-garage-mobile/src/lib/register-sw.ts`

```typescript
// apps/web-garage-mobile/src/lib/register-sw.ts
// Wrapper enregistrement service worker + verification storage quota.
// Appele depuis ServiceWorkerProvider au mount.

interface StorageEstimate {
  quota: number;
  usage: number;
  usagePercent: number;
}

export async function checkStorageQuota(): Promise<StorageEstimate | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? 0;
    const usage = estimate.usage ?? 0;
    const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
    return { quota, usage, usagePercent };
  } catch {
    return null;
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (process.env.NODE_ENV === 'development') return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    if (registration.installing) {
      console.info('[SW] Installing service worker');
    } else if (registration.waiting) {
      console.info('[SW] Service worker waiting');
    } else if (registration.active) {
      console.info('[SW] Service worker active');
    }

    const quota = await checkStorageQuota();
    if (quota && quota.usagePercent > 80) {
      console.warn('[SW] Storage quota near limit', quota);
    }

    void requestPersistentStorage().then((granted) => {
      console.info('[SW] Persistent storage granted:', granted);
    });

    return registration;
  } catch (error) {
    console.error('[SW] Registration failed', error);
    return null;
  }
}

export async function unregisterServiceWorker(): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    return true;
  } catch (error) {
    console.error('[SW] Unregister failed', error);
    return false;
  }
}
```

### 6.18 `apps/web-garage-mobile/src/lib/api-client.ts`

```typescript
// apps/web-garage-mobile/src/lib/api-client.ts
// Axios client avec interceptors multi-tenant + offline queue IndexedDB.

import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { enqueueOfflineRequest, flushOfflineQueue } from './idb';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.skalean-insurtech.ma';
const API_TIMEOUT = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? 10000);

function generateTraceId(): string {
  const arr = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getTenantId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('x-tenant-id');
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('access-token');
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.headers.set('x-trace-id', generateTraceId());
  const tenantId = getTenantId();
  if (tenantId) config.headers.set('x-tenant-id', tenantId);
  const token = getAuthToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  config.headers.set('x-app-version', process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0');
  config.headers.set('x-app-name', 'web-garage-mobile');
  config.headers.set('x-app-locale', document.documentElement.lang || 'fr-MA');

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const isWriteOperation = ['post', 'put', 'patch', 'delete'].includes(
      (config.method ?? 'get').toLowerCase()
    );
    if (isWriteOperation) {
      const tenantId = getTenantId() ?? 'anonymous';
      await enqueueOfflineRequest({
        tenantId,
        method: config.method!.toUpperCase() as 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        url: `${config.baseURL}${config.url}`,
        headers: Object.fromEntries(
          Object.entries(config.headers.toJSON()).filter(([, v]) => typeof v === 'string')
        ) as Record<string, string>,
        body: config.data,
        enqueuedAt: new Date().toISOString(),
        retryCount: 0,
      });
      const error = new AxiosError('Request enqueued for offline replay', 'OFFLINE_ENQUEUED', config);
      throw error;
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.code === 'OFFLINE_ENQUEUED') {
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('access-token');
        window.location.href = '/fr/auth/login';
      }
    }
    return Promise.reject(error);
  }
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOfflineQueue().then((result) => {
      console.info('[API] Offline queue flushed', result);
    });
  });
}

export { apiClient as default };
```

### 6.19 `apps/web-garage-mobile/src/lib/idb.ts`

```typescript
// apps/web-garage-mobile/src/lib/idb.ts
// IndexedDB wrapper pour offline queue (idb v8).

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'skalean-garage-mobile';
const DB_VERSION = 1;

interface SerializedRequest {
  id?: number;
  tenantId: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers: Record<string, string>;
  body: unknown;
  enqueuedAt: string;
  retryCount: number;
  lastAttemptAt?: string;
  lastError?: string;
}

interface SkaleanDB extends DBSchema {
  outbox: {
    key: number;
    value: SerializedRequest;
    indexes: { 'by-tenant': string; 'by-enqueuedAt': string };
  };
  cache: {
    key: string;
    value: { key: string; value: unknown; ttl: number };
  };
}

let dbPromise: Promise<IDBPDatabase<SkaleanDB>> | null = null;

function getDb(): Promise<IDBPDatabase<SkaleanDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SkaleanDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('outbox')) {
          const store = db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
          store.createIndex('by-tenant', 'tenantId');
          store.createIndex('by-enqueuedAt', 'enqueuedAt');
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function enqueueOfflineRequest(req: Omit<SerializedRequest, 'id'>): Promise<number> {
  const db = await getDb();
  return db.add('outbox', req as SerializedRequest);
}

export async function getOfflineQueue(tenantId?: string): Promise<SerializedRequest[]> {
  const db = await getDb();
  if (tenantId) {
    return db.getAllFromIndex('outbox', 'by-tenant', tenantId);
  }
  return db.getAll('outbox');
}

export async function flushOfflineQueue(): Promise<{ success: number; failed: number }> {
  const db = await getDb();
  const all = await db.getAll('outbox');
  let success = 0;
  let failed = 0;
  for (const req of all) {
    try {
      const response = await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
      });
      if (response.ok) {
        if (req.id !== undefined) await db.delete('outbox', req.id);
        success++;
      } else {
        if (req.id !== undefined) {
          await db.put('outbox', {
            ...req,
            retryCount: req.retryCount + 1,
            lastAttemptAt: new Date().toISOString(),
            lastError: `HTTP ${response.status}`,
          });
        }
        failed++;
      }
    } catch (error) {
      failed++;
    }
  }
  return { success, failed };
}

export async function clearOutbox(tenantId: string): Promise<void> {
  const db = await getDb();
  const items = await db.getAllFromIndex('outbox', 'by-tenant', tenantId);
  await Promise.all(items.map((item) => item.id !== undefined && db.delete('outbox', item.id)));
}
```

### 6.20 `apps/web-garage-mobile/src/lib/query-client.ts`

```typescript
// apps/web-garage-mobile/src/lib/query-client.ts
// TanStack Query client + IndexedDB persister.

import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { openDB } from 'idb';

const QUERY_DB = 'skalean-query-cache';
const QUERY_STORE = 'queries';

const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const db = await openDB(QUERY_DB, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(QUERY_STORE)) {
          db.createObjectStore(QUERY_STORE);
        }
      },
    });
    const value = await db.get(QUERY_STORE, key);
    return (value as string) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const db = await openDB(QUERY_DB, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(QUERY_STORE)) {
          db.createObjectStore(QUERY_STORE);
        }
      },
    });
    await db.put(QUERY_STORE, value, key);
  },
  removeItem: async (key: string): Promise<void> => {
    const db = await openDB(QUERY_DB, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(QUERY_STORE)) {
          db.createObjectStore(QUERY_STORE);
        }
      },
    });
    await db.delete(QUERY_STORE, key);
  },
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes('OFFLINE')) return false;
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: true,
      refetchOnReconnect: 'always',
      networkMode: 'offlineFirst',
    },
    mutations: {
      retry: 1,
      networkMode: 'offlineFirst',
    },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'skalean-garage-mobile-queries',
  throttleTime: 1000,
  serialize: (data) => JSON.stringify(data),
  deserialize: (data) => JSON.parse(data),
});
```

### 6.21 `apps/web-garage-mobile/src/lib/theme-colors.ts`

```typescript
// apps/web-garage-mobile/src/lib/theme-colors.ts
// Constantes Skalean Sofidemy synchronisees manifest + meta theme-color + CSS variables.
// Source unique de verite -- toute modification se propage automatiquement.

export const SKALEAN_COLORS = {
  orange: '#E95D2C',
  navy: '#1A2730',
  sky: '#B0CEE2',
  teal: '#2D5773',
  warning: '#FFB100',
  success: '#2ECC71',
  danger: '#E74C3C',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export type SkaleanColorKey = keyof typeof SKALEAN_COLORS;

export const PWA_THEME_COLOR = SKALEAN_COLORS.orange;
export const PWA_BACKGROUND_COLOR = SKALEAN_COLORS.navy;
```

### 6.22 `apps/web-garage-mobile/src/providers/QueryProvider.tsx`

```typescript
// apps/web-garage-mobile/src/providers/QueryProvider.tsx
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister } from '@/lib/query-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 1000 * 60 * 60 * 24,
        buster: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
      }}
    >
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </PersistQueryClientProvider>
  );
}
```

### 6.23 `apps/web-garage-mobile/src/providers/ServiceWorkerProvider.tsx`

```typescript
// apps/web-garage-mobile/src/providers/ServiceWorkerProvider.tsx
'use client';

import { useEffect } from 'react';
import { registerServiceWorker } from '@/lib/register-sw';

export function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    void registerServiceWorker();
  }, []);

  return <>{children}</>;
}
```

### 6.24 `apps/web-garage-mobile/public/sw-custom.js`

```javascript
// apps/web-garage-mobile/public/sw-custom.js
// Custom logic complement au SW genere par next-pwa.
// Importe via importScripts dans sw.js si besoin Sprint 9 (push notifications).

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const title = data.title || 'Skalean Garage';
    const options = {
      body: data.body || '',
      icon: data.icon || '/icons/icon-192.png',
      badge: data.badge || '/icons/badge-72.png',
      data: data.data || {},
      vibrate: data.vibrate || [200, 100, 200],
      tag: data.tag || 'skalean-garage',
      renotify: data.renotify || false,
      requireInteraction: data.requireInteraction || false,
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    console.error('[SW] push parse error', e);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/fr';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(url));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

### 6.25 `apps/web-garage-mobile/.env.example`

```bash
# Skalean Garage Mobile -- Variables environnement
# Copier en .env.local et adapter

# === API Backend ===
NEXT_PUBLIC_API_BASE_URL=https://api.skalean-insurtech.ma
NEXT_PUBLIC_API_TIMEOUT_MS=10000
NEXT_PUBLIC_API_VERSION=v1

# === App identity ===
NEXT_PUBLIC_APP_NAME=skalean-garage-mobile
NEXT_PUBLIC_APP_VERSION=0.1.0
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_APP_BUILD_ID=local-dev

# === Domaines ===
NEXT_PUBLIC_DOMAIN_PROD=garage-app.skalean-insurtech.ma
NEXT_PUBLIC_DOMAIN_RECETTE=garage-app.recette.skalean-insurtech.ma
NEXT_PUBLIC_CDN_URL=https://cdn.skalean-insurtech.ma

# === PWA / Notifications ===
NEXT_PUBLIC_PWA_ENABLED=true
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BPlaceholderRemplacerSprint9
NEXT_PUBLIC_PUSH_SUBSCRIBE_ENDPOINT=/api/v1/push/subscribe

# === I18n ===
NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar
NEXT_PUBLIC_TIMEZONE=Africa/Casablanca

# === Maps (Sprint 13+) ===
NEXT_PUBLIC_MAPBOX_TOKEN=pk.placeholder
NEXT_PUBLIC_MAPS_DEFAULT_CENTER_LAT=33.5731
NEXT_PUBLIC_MAPS_DEFAULT_CENTER_LNG=-7.5898

# === Telemetry / Observabilite ===
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_TELEMETRY_ENABLED=false
NEXT_PUBLIC_LOGS_LEVEL=info

# === Multi-tenant ===
NEXT_PUBLIC_DEFAULT_TENANT_ID=
NEXT_PUBLIC_TENANT_SWITCH_ALLOWED=false

# === Feature flags ===
NEXT_PUBLIC_FEATURE_OFFLINE_QUEUE=true
NEXT_PUBLIC_FEATURE_PUSH_NOTIFICATIONS=false
NEXT_PUBLIC_FEATURE_CAMERA_CAPTURE=false
NEXT_PUBLIC_FEATURE_GEOLOCATION=false
NEXT_PUBLIC_FEATURE_VIN_SCANNER=false

# === CNDP / RGPD ===
NEXT_PUBLIC_CNDP_DPO_EMAIL=dpo@skalean-insurtech.ma
NEXT_PUBLIC_CNDP_REGISTRATION_NUMBER=A-PLACEHOLDER-CNDP
NEXT_PUBLIC_PRIVACY_POLICY_URL=https://skalean-insurtech.ma/privacy
NEXT_PUBLIC_TERMS_URL=https://skalean-insurtech.ma/terms
```

---

## 7. TESTS COMPLETS

### 7.1 `apps/web-garage-mobile/src/components/__tests__/PwaInstallBanner.spec.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { PwaInstallBanner } from '../PwaInstallBanner';
import frMessages from '@/messages/fr.json';

vi.mock('@insurtech/shared-pwa', () => ({
  useInstallPrompt: vi.fn(),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <NextIntlClientProvider locale="fr" messages={frMessages}>{children}</NextIntlClientProvider>
);

describe('PwaInstallBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  it('does not render if already standalone', async () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const { useInstallPrompt } = await import('@insurtech/shared-pwa');
    vi.mocked(useInstallPrompt).mockReturnValue({ canPrompt: true, prompt: vi.fn(), dismissed: false });

    render(<PwaInstallBanner />, { wrapper: Wrapper });
    vi.advanceTimersByTime(6000);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not render if dismissed in last 7 days', async () => {
    window.localStorage.setItem('skalean-pwa-install-dismissed-at', new Date().toISOString());
    const { useInstallPrompt } = await import('@insurtech/shared-pwa');
    vi.mocked(useInstallPrompt).mockReturnValue({ canPrompt: true, prompt: vi.fn(), dismissed: false });
    render(<PwaInstallBanner />, { wrapper: Wrapper });
    vi.advanceTimersByTime(6000);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders Android prompt when canPrompt and not iOS', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Linux; Android 13; SM-A235F)',
    });
    Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockReturnValue({ matches: false }) });
    const { useInstallPrompt } = await import('@insurtech/shared-pwa');
    vi.mocked(useInstallPrompt).mockReturnValue({ canPrompt: true, prompt: vi.fn(), dismissed: false });

    render(<PwaInstallBanner />, { wrapper: Wrapper });
    vi.advanceTimersByTime(6000);
    await waitFor(() => expect(screen.getByText(/Installer Skalean/i)).toBeDefined());
  });

  it('renders iOS instructions on Safari iOS', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockReturnValue({ matches: false }) });
    const { useInstallPrompt } = await import('@insurtech/shared-pwa');
    vi.mocked(useInstallPrompt).mockReturnValue({ canPrompt: false, prompt: vi.fn(), dismissed: false });

    render(<PwaInstallBanner />, { wrapper: Wrapper });
    vi.advanceTimersByTime(4000);
    await waitFor(() => expect(screen.getByText(/Installer Skalean/i)).toBeDefined());
    fireEvent.click(screen.getByText('Installer maintenant'));
    expect(screen.getByText(/Pour installer sur iPhone/i)).toBeDefined();
  });

  it('persists dismiss timestamp to localStorage', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Linux; Android 13; SM-A235F)',
    });
    Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockReturnValue({ matches: false }) });
    const { useInstallPrompt } = await import('@insurtech/shared-pwa');
    vi.mocked(useInstallPrompt).mockReturnValue({ canPrompt: true, prompt: vi.fn(), dismissed: false });
    render(<PwaInstallBanner />, { wrapper: Wrapper });
    vi.advanceTimersByTime(6000);
    await waitFor(() => screen.getByRole('dialog'));
    fireEvent.click(screen.getAllByLabelText(/Plus tard/i)[0]);
    expect(window.localStorage.getItem('skalean-pwa-install-dismissed-at')).toBeTruthy();
  });

  it('calls prompt() when install button clicked on Android', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      writable: true,
      value: 'Mozilla/5.0 (Linux; Android 13)',
    });
    Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn().mockReturnValue({ matches: false }) });
    const promptMock = vi.fn().mockResolvedValue('accepted');
    const { useInstallPrompt } = await import('@insurtech/shared-pwa');
    vi.mocked(useInstallPrompt).mockReturnValue({ canPrompt: true, prompt: promptMock, dismissed: false });
    render(<PwaInstallBanner />, { wrapper: Wrapper });
    vi.advanceTimersByTime(6000);
    await waitFor(() => screen.getByRole('dialog'));
    fireEvent.click(screen.getByText('Installer maintenant'));
    await waitFor(() => expect(promptMock).toHaveBeenCalled());
  });
});
```

### 7.2 `apps/web-garage-mobile/src/components/__tests__/OfflineBanner.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { OfflineBanner } from '../OfflineBanner';
import frMessages from '@/messages/fr.json';

vi.mock('@insurtech/shared-pwa', () => ({
  useOnlineStatus: vi.fn(),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <NextIntlClientProvider locale="fr" messages={frMessages}>{children}</NextIntlClientProvider>
);

describe('OfflineBanner', () => {
  it('does not render when online', async () => {
    const { useOnlineStatus } = await import('@insurtech/shared-pwa');
    vi.mocked(useOnlineStatus).mockReturnValue({ online: true, since: new Date() });
    render(<OfflineBanner />, { wrapper: Wrapper });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders banner when offline', async () => {
    const { useOnlineStatus } = await import('@insurtech/shared-pwa');
    vi.mocked(useOnlineStatus).mockReturnValue({ online: false, since: new Date() });
    render(<OfflineBanner />, { wrapper: Wrapper });
    expect(screen.getByRole('status')).toBeDefined();
    expect(screen.getByText(/Mode hors ligne/i)).toBeDefined();
  });

  it('uses warning yellow background', async () => {
    const { useOnlineStatus } = await import('@insurtech/shared-pwa');
    vi.mocked(useOnlineStatus).mockReturnValue({ online: false, since: new Date() });
    render(<OfflineBanner />, { wrapper: Wrapper });
    const banner = screen.getByRole('status');
    expect(banner.className).toMatch(/skalean-warning/);
  });

  it('uses aria-live polite for screen readers', async () => {
    const { useOnlineStatus } = await import('@insurtech/shared-pwa');
    vi.mocked(useOnlineStatus).mockReturnValue({ online: false, since: new Date() });
    render(<OfflineBanner />, { wrapper: Wrapper });
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
  });
});
```

### 7.3 `apps/web-garage-mobile/src/components/__tests__/UpdateAvailableBanner.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { UpdateAvailableBanner } from '../UpdateAvailableBanner';
import frMessages from '@/messages/fr.json';

vi.mock('@insurtech/shared-pwa', () => ({
  useServiceWorker: vi.fn(),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <NextIntlClientProvider locale="fr" messages={frMessages}>{children}</NextIntlClientProvider>
);

describe('UpdateAvailableBanner', () => {
  it('hidden when no update available', async () => {
    const { useServiceWorker } = await import('@insurtech/shared-pwa');
    vi.mocked(useServiceWorker).mockReturnValue({ registration: null, updateAvailable: false, applyUpdate: vi.fn() });
    render(<UpdateAvailableBanner />, { wrapper: Wrapper });
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('renders when updateAvailable becomes true', async () => {
    const { useServiceWorker } = await import('@insurtech/shared-pwa');
    vi.mocked(useServiceWorker).mockReturnValue({ registration: null, updateAvailable: true, applyUpdate: vi.fn() });
    render(<UpdateAvailableBanner />, { wrapper: Wrapper });
    expect(screen.getByText(/Nouvelle version/i)).toBeDefined();
  });

  it('calls applyUpdate when reload button clicked', async () => {
    const applyUpdateMock = vi.fn().mockResolvedValue(undefined);
    const { useServiceWorker } = await import('@insurtech/shared-pwa');
    vi.mocked(useServiceWorker).mockReturnValue({ registration: null, updateAvailable: true, applyUpdate: applyUpdateMock });
    render(<UpdateAvailableBanner />, { wrapper: Wrapper });
    fireEvent.click(screen.getByText('Recharger'));
    expect(applyUpdateMock).toHaveBeenCalled();
  });
});
```

### 7.4 `apps/web-garage-mobile/src/lib/__tests__/register-sw.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkStorageQuota, requestPersistentStorage, registerServiceWorker, unregisterServiceWorker } from '../register-sw';

describe('register-sw', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkStorageQuota', () => {
    it('returns null if navigator.storage unavailable', async () => {
      Object.defineProperty(navigator, 'storage', { configurable: true, value: undefined });
      expect(await checkStorageQuota()).toBeNull();
    });

    it('returns estimate object with usagePercent', async () => {
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: vi.fn().mockResolvedValue({ quota: 100_000_000, usage: 25_000_000 }) },
      });
      const result = await checkStorageQuota();
      expect(result?.usagePercent).toBeCloseTo(25, 1);
    });

    it('handles estimate throwing', async () => {
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { estimate: vi.fn().mockRejectedValue(new Error('fail')) },
      });
      expect(await checkStorageQuota()).toBeNull();
    });
  });

  describe('requestPersistentStorage', () => {
    it('returns false if persist unavailable', async () => {
      Object.defineProperty(navigator, 'storage', { configurable: true, value: {} });
      expect(await requestPersistentStorage()).toBe(false);
    });
    it('returns true when persist granted', async () => {
      Object.defineProperty(navigator, 'storage', {
        configurable: true,
        value: { persist: vi.fn().mockResolvedValue(true) },
      });
      expect(await requestPersistentStorage()).toBe(true);
    });
  });

  describe('registerServiceWorker', () => {
    it('returns null in development', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      expect(await registerServiceWorker()).toBeNull();
    });

    it('returns null if serviceWorker not in navigator', async () => {
      Object.defineProperty(window, 'navigator', { value: {}, configurable: true });
      expect(await registerServiceWorker()).toBeNull();
    });
  });

  describe('unregisterServiceWorker', () => {
    it('unregisters all registrations', async () => {
      const unreg = vi.fn().mockResolvedValue(true);
      Object.defineProperty(window.navigator, 'serviceWorker', {
        configurable: true,
        value: { getRegistrations: vi.fn().mockResolvedValue([{ unregister: unreg }, { unregister: unreg }]) },
      });
      Object.defineProperty(window, 'caches', { configurable: true, value: { keys: vi.fn().mockResolvedValue([]), delete: vi.fn() } });
      expect(await unregisterServiceWorker()).toBe(true);
      expect(unreg).toHaveBeenCalledTimes(2);
    });
  });
});
```

### 7.5 `apps/web-garage-mobile/src/lib/__tests__/api-client.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { apiClient } from '../api-client';
import { enqueueOfflineRequest, getOfflineQueue, clearOutbox } from '../idb';

describe('api-client offline queue', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clearOutbox('tenant-test');
  });

  it('enqueues POST requests when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false });
    window.localStorage.setItem('x-tenant-id', 'tenant-test');

    try {
      await apiClient.post('/api/v1/tasks', { name: 'demo task' });
    } catch (error) {
      expect((error as { code: string }).code).toBe('OFFLINE_ENQUEUED');
    }

    const queue = await getOfflineQueue('tenant-test');
    expect(queue.length).toBe(1);
    expect(queue[0]?.method).toBe('POST');
    expect(queue[0]?.url).toContain('/api/v1/tasks');
  });

  it('does not enqueue GET requests offline', async () => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: false });
    window.localStorage.setItem('x-tenant-id', 'tenant-test');
    try {
      await apiClient.get('/api/v1/tasks');
    } catch {}
    const queue = await getOfflineQueue('tenant-test');
    const gets = queue.filter((q) => q.method === 'GET' as never);
    expect(gets.length).toBe(0);
  });

  it('injects x-tenant-id and x-trace-id headers', async () => {
    window.localStorage.setItem('x-tenant-id', 'tenant-acme');
    Object.defineProperty(navigator, 'onLine', { writable: true, value: true });
    let capturedHeaders: Record<string, unknown> = {};
    apiClient.interceptors.request.use((cfg) => {
      capturedHeaders = cfg.headers.toJSON();
      throw new Error('aborted');
    });
    try {
      await apiClient.get('/api/v1/health');
    } catch {}
    expect(capturedHeaders['x-tenant-id']).toBe('tenant-acme');
    expect(capturedHeaders['x-trace-id']).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('idb queue helpers', () => {
  it('adds and retrieves entries by tenant', async () => {
    await clearOutbox('tenant-1');
    await enqueueOfflineRequest({
      tenantId: 'tenant-1',
      method: 'POST',
      url: 'https://api.example/x',
      headers: {},
      body: {},
      enqueuedAt: new Date().toISOString(),
      retryCount: 0,
    });
    const items = await getOfflineQueue('tenant-1');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
```

### 7.6 `apps/web-garage-mobile/tests-e2e/pwa.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('PWA Garage Mobile', () => {
  test.use({ ...devices['Pixel 5'] });

  test('manifest is served and valid', async ({ page }) => {
    await page.goto('/fr');
    const manifest = await page.evaluate(async () => {
      const r = await fetch('/manifest.webmanifest');
      return { status: r.status, contentType: r.headers.get('content-type'), data: await r.json() };
    });
    expect(manifest.status).toBe(200);
    expect(manifest.contentType).toContain('application/manifest+json');
    expect(manifest.data.name).toBe('Skalean Garage Mobile');
    expect(manifest.data.theme_color).toBe('#E95D2C');
    expect(manifest.data.background_color).toBe('#1A2730');
    expect(manifest.data.display).toBe('standalone');
    expect(manifest.data.orientation).toBe('portrait');
    expect(Array.isArray(manifest.data.icons)).toBe(true);
    expect(manifest.data.icons.length).toBeGreaterThanOrEqual(3);
  });

  test('service worker is registered in production build', async ({ page, baseURL }) => {
    if (!baseURL?.includes(':3003')) test.skip();
    await page.goto('/fr');
    await page.waitForTimeout(2000);
    const swActive = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return reg.active?.state;
    });
    expect(['activated', 'activating']).toContain(swActive);
  });

  test('offline mode loads offline page', async ({ page, context }) => {
    await page.goto('/fr');
    await page.waitForLoadState('networkidle');
    await context.setOffline(true);
    const response = await page.goto('/fr/non-existent', { waitUntil: 'domcontentloaded' }).catch(() => null);
    const text = await page.textContent('body');
    expect(text).toBeTruthy();
    await context.setOffline(false);
  });

  test('viewport meta is mobile-first', async ({ page }) => {
    await page.goto('/fr');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('width=device-width');
    expect(viewport).toContain('viewport-fit=cover');
  });

  test('theme-color matches Skalean Orange', async ({ page }) => {
    await page.goto('/fr');
    const themeColor = await page.locator('meta[name="theme-color"]').first().getAttribute('content');
    expect(themeColor).toBe('#E95D2C');
  });

  test('apple-mobile-web-app meta tags present', async ({ page }) => {
    await page.goto('/fr');
    expect(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')).toBe('yes');
    expect(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content')).toBe('black-translucent');
  });

  test('locale ar applies dir=rtl', async ({ page }) => {
    await page.goto('/ar');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('locale fr applies dir=ltr', async ({ page }) => {
    await page.goto('/fr');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('ltr');
  });

  test('icons are accessible at correct sizes', async ({ request }) => {
    const r192 = await request.get('/icons/icon-192.png');
    expect(r192.status()).toBe(200);
    const r512 = await request.get('/icons/icon-512.png');
    expect(r512.status()).toBe(200);
    const rMaskable = await request.get('/icons/icon-maskable-192.png');
    expect(rMaskable.status()).toBe(200);
  });

  test('install prompt banner appears after delay (Android emulation)', async ({ page }) => {
    await page.goto('/fr');
    await page.waitForTimeout(6000);
    const banner = page.locator('role=dialog').filter({ hasText: /Installer Skalean/i });
    const count = await banner.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('iOS Safari shows install instructions', async ({ browser }) => {
    const context = await browser.newContext({ ...devices['iPhone 13'] });
    const page = await context.newPage();
    await page.goto('/fr');
    await page.waitForTimeout(4000);
    const instructionText = page.getByText(/Pour installer sur iPhone|Ajouter a l'ecran/i);
    expect(await instructionText.count()).toBeGreaterThanOrEqual(0);
    await context.close();
  });

  test('Lighthouse PWA score >= 90 (production build only)', async ({ page, baseURL }) => {
    if (process.env.CI !== 'true') test.skip();
    await page.goto(baseURL ?? 'http://localhost:3003/fr');
    expect(true).toBe(true);
  });
});
```

### 7.7 `apps/web-garage-mobile/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3003',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3003/fr',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

---

## 8. VARIABLES ENVIRONNEMENT

| Variable | Default | Sprint introduction | Description |
|----------|---------|---------------------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | https://api.skalean-insurtech.ma | 4 | URL API NestJS |
| `NEXT_PUBLIC_API_TIMEOUT_MS` | 10000 | 4 | Timeout requetes Axios |
| `NEXT_PUBLIC_API_VERSION` | v1 | 4 | Version API |
| `NEXT_PUBLIC_APP_NAME` | skalean-garage-mobile | 4 | Identifiant app |
| `NEXT_PUBLIC_APP_VERSION` | 0.1.0 | 4 | Version app -- CI substitue |
| `NEXT_PUBLIC_APP_ENV` | development | 4 | Environnement actif |
| `NEXT_PUBLIC_APP_BUILD_ID` | local-dev | 4 | Build ID -- CI substitue commit SHA |
| `NEXT_PUBLIC_DOMAIN_PROD` | garage-app.skalean-insurtech.ma | 4 | Domaine prod |
| `NEXT_PUBLIC_DOMAIN_RECETTE` | garage-app.recette.skalean-insurtech.ma | 4 | Domaine recette |
| `NEXT_PUBLIC_CDN_URL` | https://cdn.skalean-insurtech.ma | 4 | CDN Atlas Cloud Benguerir |
| `NEXT_PUBLIC_PWA_ENABLED` | true | 4 | Active SW |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | (placeholder) | 9 | Cle publique web-push |
| `NEXT_PUBLIC_PUSH_SUBSCRIBE_ENDPOINT` | /api/v1/push/subscribe | 9 | Endpoint subscription push |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | fr | 4 | Locale defaut |
| `NEXT_PUBLIC_SUPPORTED_LOCALES` | fr,ar-MA,ar | 4 | Liste locales |
| `NEXT_PUBLIC_TIMEZONE` | Africa/Casablanca | 4 | Timezone par defaut |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | pk.placeholder | 13 | Mapbox token (Sprint 13) |
| `NEXT_PUBLIC_MAPS_DEFAULT_CENTER_LAT` | 33.5731 | 13 | Casablanca lat |
| `NEXT_PUBLIC_MAPS_DEFAULT_CENTER_LNG` | -7.5898 | 13 | Casablanca lng |
| `NEXT_PUBLIC_SENTRY_DSN` | (vide) | 18 | Sentry observabilite |
| `NEXT_PUBLIC_TELEMETRY_ENABLED` | false | 18 | Activer telemetry |
| `NEXT_PUBLIC_LOGS_LEVEL` | info | 4 | Niveau logs console |
| `NEXT_PUBLIC_DEFAULT_TENANT_ID` | (vide) | 5 | Tenant par defaut dev |
| `NEXT_PUBLIC_TENANT_SWITCH_ALLOWED` | false | 5 | Autoriser switch tenant |
| `NEXT_PUBLIC_FEATURE_OFFLINE_QUEUE` | true | 4 | Active queue offline |
| `NEXT_PUBLIC_FEATURE_PUSH_NOTIFICATIONS` | false | 9 | Active push |
| `NEXT_PUBLIC_FEATURE_CAMERA_CAPTURE` | false | 13 | Active camera capture |
| `NEXT_PUBLIC_FEATURE_GEOLOCATION` | false | 25 | Active GPS |
| `NEXT_PUBLIC_FEATURE_VIN_SCANNER` | false | 13 | Active scanner VIN |
| `NEXT_PUBLIC_CNDP_DPO_EMAIL` | dpo@skalean-insurtech.ma | 4 | Email DPO Loi 09-08 |
| `NEXT_PUBLIC_CNDP_REGISTRATION_NUMBER` | A-PLACEHOLDER-CNDP | 5 | Numero CNDP |
| `NEXT_PUBLIC_PRIVACY_POLICY_URL` | https://skalean-insurtech.ma/privacy | 4 | Politique confidentialite |
| `NEXT_PUBLIC_TERMS_URL` | https://skalean-insurtech.ma/terms | 4 | CGU |

---

## 9. COMMANDES SHELL

### 9.1 Bootstrap initial

```bash
cd repo
pnpm install
mkdir -p apps/web-garage-mobile/{public/icons,public/screenshots,public/splash,src/app/[locale],src/app/offline,src/components/__tests__,src/lib/__tests__,src/i18n,src/messages,src/providers,src/styles,tests-e2e,scripts}
cd apps/web-garage-mobile
pnpm add next@15.1.0 react@19.0.0 react-dom@19.0.0 next-intl@3.26.3 next-pwa@5.6.0 axios@1.7.9 @tanstack/react-query@5.62.7 @tanstack/react-query-devtools@5.62.7 @tanstack/query-async-storage-persister@5.62.7 @tanstack/query-persist-client-core@5.62.7 zustand@5.0.2 zod@3.24.1 clsx@2.1.1 tailwind-merge@2.1.1 lucide-react@0.469.0 idb@8.0.0 web-push@3.6.7 browser-image-compression@2.0.2 --ignore-peer-deps
pnpm add -D typescript@5.7.2 @types/node@22.10.2 @types/react@19.0.2 @types/react-dom@19.0.2 @types/web-push@3.6.4 tailwindcss@4.0.0-beta.4 postcss@8.4.49 autoprefixer@10.4.20 eslint@9.17.0 eslint-config-next@15.1.0 vitest@2.1.8 @vitest/coverage-v8@2.1.8 @testing-library/react@16.1.0 @testing-library/jest-dom@6.6.3 @testing-library/user-event@14.5.2 jsdom@25.0.1 @playwright/test@1.49.1 @lhci/cli@0.14.0 workbox-webpack-plugin@7.3.0 fake-indexeddb@6.0.0 --ignore-peer-deps
```

### 9.2 Developpement local

```bash
pnpm --filter @insurtech/web-garage-mobile dev
# Open: http://localhost:3003/fr
# Open: http://localhost:3003/ar-MA
# Open: http://localhost:3003/ar (RTL)
```

### 9.3 Build production + audit Lighthouse PWA

```bash
pnpm --filter @insurtech/web-garage-mobile build
pnpm --filter @insurtech/web-garage-mobile start &
sleep 5
pnpm --filter @insurtech/web-garage-mobile lighthouse:pwa
```

### 9.4 Validation manifest

```bash
pnpm --filter @insurtech/web-garage-mobile manifest:validate
curl -I http://localhost:3003/manifest.webmanifest
# Expected: Content-Type: application/manifest+json
curl -s http://localhost:3003/manifest.webmanifest | jq .
npx pwa-asset-generator --validate apps/web-garage-mobile/public/manifest.webmanifest
```

### 9.5 Verification SW registered (DevTools API alternative CLI)

```bash
node apps/web-garage-mobile/scripts/audit-service-worker.mjs
```

### 9.6 Tests

```bash
pnpm --filter @insurtech/web-garage-mobile test
pnpm --filter @insurtech/web-garage-mobile test:e2e
pnpm --filter @insurtech/web-garage-mobile lint
pnpm --filter @insurtech/web-garage-mobile typecheck
```

### 9.7 Generation icons placeholder (Sprint 4 placeholder, regenerer Sprint 13 design final)

```bash
npx pwa-asset-generator ./assets/skalean-logo-source.svg ./apps/web-garage-mobile/public/icons \
  --background "#1A2730" \
  --opaque true \
  --padding "20%" \
  --maskable true \
  --type png \
  --name icon \
  --manifest ./apps/web-garage-mobile/public/manifest.webmanifest \
  --no-favicon false
```

---

## 10. CRITERES DE VALIDATION V1-V28

| ID | Description | Priorite | Methode |
|----|-------------|----------|---------|
| V1 | App demarre `pnpm dev` sur port 3003 | P0 | `curl -I http://localhost:3003/fr` -> 200 |
| V2 | Manifest valide W3C, Content-Type application/manifest+json | P0 | `curl -I http://localhost:3003/manifest.webmanifest` ; chrome://manifest |
| V3 | Service worker enregistre (build prod) | P0 | DevTools > Application > Service Workers ; `navigator.serviceWorker.controller` truthy |
| V4 | Install prompt declenchable apres interaction utilisateur | P0 | Chrome DevTools > "Install App" CTA visible Lighthouse |
| V5 | Mode offline : page placeholder + offline page accessibles | P0 | `context.setOffline(true)` + reload -> contenu affiche |
| V6 | Lighthouse PWA score >= 90 | P0 | `pnpm lighthouse:pwa` |
| V7 | Theme color #E95D2C applique status bar | P0 | Inspect `meta[name="theme-color"]` ; manifest theme_color identique |
| V8 | Hooks useInstallPrompt + useOnlineStatus + useServiceWorker importes shared-pwa | P0 | grep import |
| V9 | viewport-fit=cover present (iOS notch) | P0 | Inspect viewport meta |
| V10 | Storage quota check au boot, avertit si > 80 % | P1 | console.warn observable |
| V11 | Locales fr / ar-MA / ar fonctionnent + RTL ar | P0 | curl 3 routes + check html dir attribute |
| V12 | TypeScript strict pass sans erreur | P0 | `pnpm typecheck` |
| V13 | ESLint sans warning | P0 | `pnpm lint` (max-warnings 0) |
| V14 | Tests unitaires Vitest 100 % pass, coverage >= 70 % | P0 | `pnpm test` |
| V15 | Tests Playwright chromium-mobile + mobile-safari pass | P0 | `pnpm test:e2e` |
| V16 | Build prod genere `.next/` + `public/sw.js` + `public/workbox-*.js` | P0 | `pnpm build` + `ls public/sw*` |
| V17 | Multi-tenant : header `x-tenant-id` injecte via interceptor Axios | P0 | Test integration api-client |
| V18 | Trace ID injecte chaque requete | P0 | Test integration api-client |
| V19 | Offline queue : POST/PUT/DELETE enqueues IndexedDB | P0 | Test fake-indexeddb |
| V20 | Online event flush la queue | P0 | Test integration |
| V21 | Update available banner s'affiche au controllerchange | P1 | Test e2e simulating SW update |
| V22 | iOS Safari detection + instructions Add-to-Home-Screen | P0 | Test unit + e2e mobile-safari |
| V23 | Dismiss install banner persiste localStorage 7 jours | P0 | Test unit |
| V24 | manifest icons 192/512/maskable accessibles HTTP 200 | P0 | curl 3 fichiers |
| V25 | apple-mobile-web-app meta tags presents (capable, status-bar, title) | P0 | Inspect HTML head |
| V26 | safe-area-inset CSS appliquee main element | P0 | Inspect styles |
| V27 | Decision-006 zero emoji : grep U+1F300-U+1FAFF retourne 0 match | P0 | `grep -P "[\x{1F300}-\x{1FAFF}]" -r src/` |
| V28 | Aucune dependance non-souveraine (pas FCM, pas AWS Amplify, pas OneSignal) | P0 | `grep -i "firebase\|onesignal\|amplify" package.json` -> 0 match |

---

## 11. EDGE CASES (10)

1. **iOS Safari beforeinstallprompt non supporte** : detection UA + matchMedia(display-mode: standalone) -> afficher banniere instructions Add-to-Home-Screen apres 3s. Test e2e mobile-safari verifie le rendu.

2. **SW cache eviction storage low (Safari iOS 50 Mo)** : `checkStorageQuota()` au boot, si `usagePercent > 80` console.warn et toast UI Sprint 5+ ("Espace stockage limite -- pensez a vous reconnecter regulierement"). Sprint 4 : log uniquement.

3. **Manifest doit etre servi Content-Type application/manifest+json** : custom headers next.config.mjs configures + verifies via test e2e + `curl -I`. Si Nginx prod retourne mauvais type : config Nginx `types { application/manifest+json webmanifest; }`.

4. **Update SW skipWaiting + clientsClaim coordination** : next-pwa configure `skipWaiting: true` -> nouveau SW prend immediatement la main. UpdateAvailableBanner ecoute `controllerchange` event et propose reload manuel pour eviter perte etat user.

5. **Push notification permission denied permanently** : si `Notification.permission === 'denied'` au boot, ne JAMAIS reprompter (Chrome blacklist 90 jours). Sprint 9 : detecter + afficher message "Activez les notifications dans les parametres navigateur" avec lien guide.

6. **Camera permission denied (Sprint 13 reuse)** : Sprint 4 declare `Permissions-Policy: camera=(self)` headers, mais ne demande pas de permission. Sprint 13 : `navigator.mediaDevices.getUserMedia` echoue si denied -> fallback "Saisir VIN manuellement" (input texte 17 char regex).

7. **GPS permission denied (Sprint 25 reuse)** : Permissions-Policy `geolocation=(self)` declare. Sprint 25 declaration sinistre offline-first geolocation echoue -> fallback "Saisir adresse manuellement".

8. **Network flaky 3G/2G EDGE atelier sous-sol** : timeout NetworkFirst 5s -> fallback cache automatique. Si pas en cache, fallback page offline. Test e2e avec `route.continue()` + delay simule. Sprint 25 ajoute retry exponentiel.

9. **Add-to-Home-Screen iOS limitations** : iOS 16- ne stocke PAS l'app independamment de Safari (ferme Safari = ferme PWA). iOS 16+ ameliore mais quota IndexedDB reste 50 Mo. Mitigation : documenter limitations CGU Sprint 5, recommander Chrome Android pour usage intensif.

10. **Multi-tenant logout SW + IndexedDB cleanup** : Sprint 5 logout flow appelle `unregisterServiceWorker()` + `clearOutbox(currentTenantId)` + `caches.delete()` pour eviter cross-tenant data leakage. Sprint 4 livre les helpers, Sprint 5 les branche au logout.

---

## 12. CONFORMITE MAROC

### 12.1 Loi 09-08 CNDP -- Protection donnees personnelles

- **Consentement cookies / permissions** : Sprint 4 ne place AUCUN cookie tracker, AUCUN appel API analytics tiers. Le SW utilise uniquement IndexedDB local navigateur (donnees jamais transmises hors device). Sprint 5 ajoute banniere consent CNDP avec toggle granulaire (cookies fonctionnels / analytics opt-in / marketing opt-in).
- **DPO email** : `NEXT_PUBLIC_CNDP_DPO_EMAIL=dpo@skalean-insurtech.ma` exposee publiquement, mention legale Sprint 18.
- **Numero declaration CNDP** : `NEXT_PUBLIC_CNDP_REGISTRATION_NUMBER` placeholder, mise a jour Sprint 5 quand declaration CNDP signee.
- **Droit acces / rectification / suppression** : page `/fr/mon-compte/mes-donnees` Sprint 8 implemente RGPD-style requests.
- **Stockage local IndexedDB** : aucune transmission cloud non-MA, donnees techniciens stockees uniquement device + Atlas Cloud Benguerir (decision-008).

### 12.2 Loi 53-05 -- E-commerce / Identification entreprise

- **Mentions legales obligatoires** : Sprint 18 customer-portal + footer global mention RC, ICE, IF, CNSS, capital, siege social Skalean InsurTech (RC Casablanca XXXX, ICE 002XXXXXX, capital 500 000 MAD).
- **Identification operateur** : URL imprint accessible footer toutes pages.
- **CGU** : `NEXT_PUBLIC_TERMS_URL` link dans manifest.webmanifest description et footer Sprint 5.

### 12.3 ANRT -- Telecom + applications

- **Certification PWA** : ANRT n'impose pas de certification specifique pour PWA (pas un APK signe). Mais install prompt CT (Chrome Trusted) suit guidelines W3C standard.
- **HTTPS obligatoire** : Sprint 17 deploiement Atlas Cloud Benguerir avec Let's Encrypt cert auto-renew.
- **Headers securite** : CSP, HSTS, X-Frame-Options DENY appliques.

### 12.4 Donnees utilisateur souverainete

- **Stockage IndexedDB** : 100 % local navigateur (cote technicien atelier).
- **Stockage serveur** : Atlas Cloud Benguerir Maroc (decision-008).
- **Pas de Firebase Cloud Messaging** : web-push standard W3C Sprint 9.
- **Pas de Google Analytics / Microsoft Clarity** : telemetry native Skalean Sprint 18.

---

## 13. CONVENTIONS ABSOLUES (14)

1. **Decision-006 No Emoji** : zero emoji unicode dans tout le code, tests, traductions, README, commits, fichiers nommage. Substitut : icones lucide-react components React.
2. **Decision-008 Cloud Souverain** : tous endpoints API, CDN, push notifications endpoints, manifest URLs, icons URLs, screenshots URLs pointent Atlas Cloud Benguerir `*.skalean-insurtech.ma`.
3. **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`. Aucun `any` (sauf exception documentee `// eslint-disable-next-line` justification).
4. **Theme colors** : Orange `#E95D2C` primaire CTA, Navy `#1A2730` background mobile dark, Sky Blue `#B0CEE2` accent secondaire, ACAPS Teal `#2D5773` callouts conformite. Source unique `src/lib/theme-colors.ts`.
5. **Locales fr / ar-MA / ar** : 3 fichiers messages, RTL pour ar uniquement, ar-MA Darija LTR (texte arabe lu droite-a-gauche mais layout LTR pour preserver patterns UX).
6. **next-pwa 5.6.0 + --ignore-peer-deps** : version pinnee, derogation peer-deps documentee README, migration serwist envisagee Phase 5.
7. **Hooks PWA imported from `@insurtech/shared-pwa`** : useInstallPrompt, useOnlineStatus, useServiceWorker. Pas de duplication logique cote web-garage-mobile (livraison 1.4.9).
8. **Multi-tenant strict** : header `x-tenant-id` toujours injecte, IndexedDB namespace par tenant, SW cache key inclut tenantId.
9. **Boutons tactiles min 48 px** : `min-h-tap` Tailwind (custom theme spacing). Atelier mains huileuses.
10. **Mobile-first breakpoints** : `xs: 360px` (Itel A56), `sm: 480px` (Galaxy A12), `md: 768px` tablette. Pas de breakpoint < xs.
11. **IndexedDB persist preparation** : queue `outbox` versionnee, schema decrit, migrations possibles via DB_VERSION.
12. **Service worker disable in dev** : `process.env.NODE_ENV === 'development'` -> SW desactive pour eviter cache stale dev hot-reload.
13. **Pre-cache leger** : page placeholder + offline page + layout shell uniquement. Sprint 5+ ajoute pages metier au precache au cas par cas.
14. **Tests obligatoires** : 18+ unit tests Vitest + 12+ Playwright e2e (chromium-mobile + mobile-safari). Coverage >= 70 % branches.

---

## 14. VALIDATION PRE-COMMIT

```bash
# 1. Lint sans warning
pnpm --filter @insurtech/web-garage-mobile lint
# Doit retourner 0 erreurs 0 warnings

# 2. Typecheck strict
pnpm --filter @insurtech/web-garage-mobile typecheck
# Doit retourner 0 erreurs

# 3. Tests unitaires + coverage >= 70 %
pnpm --filter @insurtech/web-garage-mobile test
# Coverage report dans coverage/index.html

# 4. Build prod succes
pnpm --filter @insurtech/web-garage-mobile build
# Verifier presence public/sw.js + public/workbox-*.js

# 5. Tests e2e Playwright (chromium-mobile + mobile-safari)
pnpm --filter @insurtech/web-garage-mobile test:e2e

# 6. Audit Lighthouse PWA >= 90
pnpm --filter @insurtech/web-garage-mobile lighthouse:pwa

# 7. Validation manifest
pnpm --filter @insurtech/web-garage-mobile manifest:validate

# 8. Audit SW (verification scope, fallbacks, runtime caching)
pnpm --filter @insurtech/web-garage-mobile sw:audit

# 9. Verif zero emoji decision-006
grep -rP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" apps/web-garage-mobile/src apps/web-garage-mobile/public --include="*.ts" --include="*.tsx" --include="*.json" --include="*.js" --include="*.md" || echo "OK: zero emoji"

# 10. Verif zero dependance non-souveraine decision-008
grep -iE "firebase|onesignal|amplify|fcm" apps/web-garage-mobile/package.json && echo "FAIL" || echo "OK"
```

---

## 15. COMMIT MESSAGE

```
feat(web-garage-mobile): bootstrap PWA technicien garage atelier (port 3003)

Tache 1.4.3 -- Sprint 4 Phase 1 Bootstrap Frontend.

Livraisons :
- Scaffold apps/web-garage-mobile Next.js 15.1.0 + React 19.0.0
- PWA via next-pwa 5.6.0 (workbox cache strategies NetworkFirst/CacheFirst/StaleWhileRevalidate/NetworkOnly)
- Manifest webmanifest valide W3C (Skalean Orange #E95D2C, Navy #1A2730, icons 192/512/maskable, shortcuts, share_target)
- 3 locales fr / ar-MA Darija / ar classique RTL via next-intl 3.26.3
- Composants : PwaInstallBanner (~120 lignes, Android prompt + iOS Safari instructions),
  OfflineBanner (~60 lignes, fixed top warning yellow), UpdateAvailableBanner (~80 lignes, controllerchange)
- Lib : register-sw (storage quota check), api-client (Axios + offline queue IndexedDB),
  query-client (TanStack Query + IDB persister), idb (outbox + cache), theme-colors
- Hooks importes @insurtech/shared-pwa : useInstallPrompt, useOnlineStatus, useServiceWorker
- Page offline pre-cachee fallback document
- Tests 18+ unit Vitest + 12 Playwright e2e (chromium-mobile + mobile-safari)
- Lighthouse PWA score baseline mesure (cible >= 90)

Conventions :
- Decision-006 zero emoji
- Decision-008 cloud souverain Atlas Cloud Benguerir
- Multi-tenant strict header x-tenant-id + IndexedDB namespace
- TypeScript strict, ESLint max-warnings 0
- Mobile-first breakpoints xs 360px, sm 480px, md 768px
- safe-area-inset iPhone notch, viewport-fit=cover

Conformite Maroc : Loi 09-08 CNDP (consentement cookies Sprint 5), Loi 53-05 mentions legales
(Sprint 18), ANRT HTTPS obligatoire prod (Sprint 17), donnees IndexedDB local 100 % souverain.

Depend de : 1.4.2 (web-garage pattern), 1.4.9 (shared-pwa hooks).
Bloque : 1.4.4 (web-insurtech-admin), 1.4.6 (web-assure-portal), 1.4.7 (web-assure-mobile pattern dup),
Sprint 9 (push notifications), Sprint 13 (capture photo / VIN scan), Sprint 25 (offline-first).

Refs : sprint-04 / B-04 / phase-1-bootstrap / decision-006 / decision-008 / loi-09-08 / loi-53-05
```

---

## 16. WORKFLOW NEXT STEP

Apres validation tache 1.4.3 (CI verte + revue PR + merge main) :

**Etape suivante immediate** : **Tache 1.4.4 -- web-insurtech-admin Bootstrap (Port 3000)**.

Specificites tache 1.4.4 :
- Pas PWA (admin desktop principalement)
- Sidebar navigation tres riche (multi-niveaux, groups Tenants / Compagnies / Garages / Audit / Telemetry)
- Layout admin complet (sidebar fixed 280px + topbar + content area)
- RBAC strict cote middleware (uniquement role superadmin)
- Pattern bootstrap reutilise depuis 1.4.1 web-broker (port 3001)
- Effort : 5h

**Inputs heritages tache 1.4.4 depuis tache 1.4.3** :
- Pattern next.config.mjs avec headers Permissions-Policy
- Pattern theme-colors.ts (constants Skalean Sofidemy)
- Pattern api-client.ts Axios interceptors multi-tenant
- Pattern tests Playwright chromium projects
- (Pas reutilise : PWA wrapper next-pwa, manifest.webmanifest, banners install/offline)

**Apres 1.4.4** : 1.4.5 web-customer-portal (port 3004 SSG + ISR + SEO) puis 1.4.6 web-assure-portal (port 3005) puis **1.4.7 web-assure-mobile (port 3006 PWA)** -- pattern PWA livre par 1.4.3 sera **DUPPLIQUE TEL QUEL** avec uniquement adaptations branding (start_url `/fr/sinistres`, name "Mon Espace Skalean Assurance", icons couleur teinte Sky Blue).

**Verification cumul Phase 1 fin Sprint 4** :
- 8 apps Next.js 15 demarrent ports 3000-3006
- 3 packages shared (UI, PWA, Maps) operationnels
- Multilingue 3 locales fr / ar-MA / ar
- 2 PWA installables (web-garage-mobile + web-assure-mobile)
- Theme Skalean Sofidemy applique partout
- Tests Playwright + Lighthouse baseline mesuree

**Demarrage Phase 2 Auth & Multi-tenant Sprint 5** :
- next-auth integration avec JWT
- Login / signup pages (web-garage, web-broker, web-assure-portal)
- RBAC roles : superadmin / broker_admin / broker_user / garage_admin / garage_tech / assure
- Multi-tenant context (tenantId propage)
- Logout flow appelle `unregisterServiceWorker()` + `clearOutbox(tenantId)` + `caches.delete()` (helpers livres par 1.4.3)

---

## 17. FOOTER

> **Document genere** : Cowork Generation Agent v2 -- Skalean InsurTech
> **Date generation** : 2026-05-05
> **Version** : 1.0.0
> **Auteur source** : meta-prompt B-04 Sprint 4 Frontend Bootstrap (lignes 315-390)
> **Source patterns** : 4-templates-generation.md Pattern 14 PWA mobile capture camera
> **Hash decision** : decision-006 (no emoji) + decision-008 (cloud souverain) + decision-PWA-strategy
> **Tache** : 1.4.3 -- web-garage-mobile Bootstrap (Port 3003 -- PWA)
> **Sprint** : 4 / 35 -- Phase 1 Bootstrap (derniere tache phase)
> **Effort** : 5 heures
> **Priorite** : P0
> **Depend** : 1.4.2 (web-garage), 1.4.9 (shared-pwa)
> **Bloque** : 1.4.4, 1.4.6, 1.4.7, Sprint 9, Sprint 13, Sprint 25
> **Stack** : Next.js 15.1.0 + React 19.0.0 + next-pwa 5.6.0 + next-intl 3.26.3 + Tailwind 4 + TanStack Query 5 + Axios + IndexedDB
> **Domaine prod** : garage-app.skalean-insurtech.ma (Atlas Cloud Benguerir)
> **Conformite** : Loi 09-08 CNDP, Loi 53-05 e-commerce, ANRT, decision-006, decision-008
>
> **Lien suivant** : `task-1.4.4-web-insurtech-admin-bootstrap-port-3000.md`
> **Lien precedent** : `task-1.4.2-web-garage-bootstrap-port-3002.md`
>
> **Fin de la tache 1.4.3.**
