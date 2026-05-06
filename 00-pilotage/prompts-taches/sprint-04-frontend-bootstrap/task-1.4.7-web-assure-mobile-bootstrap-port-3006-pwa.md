# TACHE 1.4.7 -- web-assure-mobile Bootstrap (Port 3006 -- PWA)

> **Phase** : 1 -- Bootstrap
> **Sprint** : 4 / 35 -- Frontend Bootstrap
> **Numero** : 1.4.7
> **Priorite** : P0 (bloquant Sprint 25 declaration sinistre, Sprint 13 photos sinistre, Sprint 9 push notifications, Sprint 11 signature electronique)
> **Effort** : 5h
> **Depend de** : 1.4.6 (web-assure-portal port 3005 -- pattern theme assure variant ACAPS Teal partage), 1.4.3 (web-garage-mobile port 3003 -- pattern PWA dupplique), 1.4.9 (shared-pwa hooks useInstallPrompt / useOnlineStatus / useServiceWorker -- peut etre stub si parallele)
> **Bloque** : 1.4.8 (web-insurtech-admin signal final), Sprint 5 auth flow assure PWA, Sprint 9 push notifications dediees assure (web push VAPID self-hosted Atlas Cloud), Sprint 11 signature electronique sinistre (composant `SignaturePad` Canvas pen-events), Sprint 13 capture photo sinistre (Pattern 14), Sprint 19 conformite ACAPS sinistres, Sprint 25 declaration sinistre offline-first 6 etapes (PouchDB sync), Sprint 24 audit Lighthouse PWA cible >= 95
> **Lectures prealables obligatoires** :
> 1. `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` lignes 1-130 (intro Sprint Phase 1 derniere) + 545-592 (detail Tache 1.4.7)
> 2. `00-pilotage/documentation/4-templates-generation.md` Pattern 14 PWA mobile capture camera + voix (lignes 375-680)
> 3. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles transverses no-emoji, multilingue, ports apps
> 4. `00-pilotage/documentation/1-stack-technique.yaml` -- versions exactes Next.js 15.1.0 / Tailwind 4 / next-pwa 5.6.0
> 5. `00-pilotage/documentation/6-metriques-validation.md` -- cibles Lighthouse PWA / accessibility WCAG 2.1 AA
> 6. `00-pilotage/decisions/decision-006-no-emoji.md` -- aucun emoji unicode
> 7. `00-pilotage/decisions/decision-008-cloud-souverain-atlas-benguerir.md` -- pas FCM Google, pas OneSignal, web-push standard W3C self-hosted
> 8. `00-pilotage/decisions/decision-009-multilinguisme-fr-darija-arabe.md` -- 3 locales fr / ar-MA / ar avec RTL
> 9. `00-pilotage/decisions/decision-PWA-strategy.md` -- offline-first preparation, online-default execution
> 10. Sortie tache 1.4.3 : `repo/apps/web-garage-mobile/` -- structure de reference PWA pattern (manifest, next.config, layout viewport, SW registration, banniere install/offline)
> 11. Sortie tache 1.4.6 : `repo/apps/web-assure-portal/` -- theme assure ACAPS Teal #2D5773 deja applique
> 12. Sortie tache 1.4.9 : `repo/packages/shared-pwa/` -- hooks `useInstallPrompt`, `useOnlineStatus`, `useServiceWorker`, helpers `enqueueOfflineRequest`, `flushOfflineQueue`
> 13. Sortie sprint 1 : structure stub `apps/web-assure-mobile/` minimale (deja cree placeholder)

---

## 1. HEADER METADONNEES

| Champ | Valeur |
|-------|--------|
| Tache | 1.4.7 -- web-assure-mobile Bootstrap (Port 3006 -- PWA) |
| Sprint | 4 / 35 (Phase 1 Bootstrap) |
| Position | Apres 1.4.6 web-assure-portal (port 3005), avant 1.4.8 web-insurtech-admin (port 3000) |
| Priorite | P0 (bloquant Sprint 25 declaration sinistre 6 etapes) |
| Effort | 5 heures |
| Depend de | 1.4.6 (theme assure ACAPS Teal), 1.4.3 (pattern PWA), 1.4.9 (shared-pwa hooks) |
| Bloque | 1.4.8, Sprint 5, Sprint 9, Sprint 11, Sprint 13, Sprint 19, Sprint 25 |
| App | `apps/web-assure-mobile/` |
| Workspace pnpm | `@insurtech/web-assure-mobile` |
| Port dev | 3006 |
| Domaine prod | `mon-espace-mobile.skalean-insurtech.ma` |
| Domaine recette | `mon-espace-mobile.recette.skalean-insurtech.ma` |
| Type | Progressive Web App (PWA), mobile-first, offline-first preparation Sprint 25 |
| Cible | Smartphone Android (Samsung A series, Xiaomi Redmi, Tecno, Infinix, Itel) + iPhone reconditionne iOS 17+ |
| Locales | fr (default), ar-MA (Darija), ar (classique RTL) |
| Theme color | #2D5773 ACAPS Teal (rappelle conformite ACAPS supervision) |
| Background color | #1A2730 Skalean Navy (OLED noir economiseur batterie) |
| Decision majeure | next-pwa 5.6.0 retenue (alternative serwist documentee migration Phase 5) |
| Use case critique | Sprint 25 -- assure declare un sinistre via wizard 6 etapes (info accident, photos, lieu GPS, blesses, temoins, signature) |
| Permissions navigator | Camera (photos sinistre), Geolocation (lieu accident), Notification (Sprint 9), Storage estimate |
| Conformite | Loi 09-08 CNDP (photos + GPS = donnees sensibles consentement explicite), Decret 2-13-836 expertise auto, ACAPS supervision |

---

## 2. BUT DE LA TACHE

Bootstraper l'application **PWA mobile dediee a l'assure** (assure_user role) destinee principalement a la **declaration de sinistre depuis le smartphone sur le lieu de l'accident**. L'application tourne sur le port 3006 en developpement et se deploie sous le domaine `mon-espace-mobile.skalean-insurtech.ma` en production sur Atlas Cloud Benguerir (decision-008 cloud souverain). Elle constitue la deuxieme PWA du programme Skalean InsurTech apres `web-garage-mobile` (port 3003) et reutilise massivement le pattern PWA etabli en Tache 1.4.3 avec adaptations critiques de branding (ACAPS Teal #2D5773 vs Orange #E95D2C), de scoping multi-tenant (`x-user-id` assure vs `x-garage-id`), et de cas d'usage (declaration sinistre 6 etapes vs taches techniciens).

A la fin de cette tache :

- Le scaffolding `apps/web-assure-mobile/` est complet, demarre via `pnpm --filter @insurtech/web-assure-mobile dev` et expose un placeholder dashboard accessible a `http://localhost:3006/fr`, `http://localhost:3006/ar-MA`, `http://localhost:3006/ar` (RTL avec direction droite-a-gauche). La page `/[locale]/declarer-sinistre` est livree comme placeholder Sprint 25 avec squelette du wizard 6 etapes (info accident / photos / lieu GPS / blesses / temoins / signature) -- chaque etape est un placeholder TODO Sprint 25 mais la navigation entre etapes est fonctionnelle.
- La PWA est detectable et installable depuis Chrome Android (event `beforeinstallprompt` capte par hook `useInstallPrompt` du package `@insurtech/shared-pwa`), depuis iOS Safari un fallback affiche une banniere instructions Add-to-Home-Screen avec sequence "Partager > Sur l'ecran d'accueil" en 3 langues. Le manifest `public/manifest.webmanifest` est valide selon spec W3C, expose les couleurs ACAPS Teal (theme_color rappelle la conformite supervision ACAPS aupres de l'assure pour rassurance reglementaire), Skalean Navy en background, name multilingue "Skalean Mon Espace Mobile" avec short_name 12 chars max "Skalean Espace", description multilingue, 3 icons (192/512/maskable), 2 shortcuts ("Declarer un sinistre" raccourci direct vers `/declarer-sinistre`, "Mes polices" vers `/polices`), categories productivity + finance, lang fr-MA, dir ltr (RTL gere cote app via next-intl).
- Le service worker se enregistre uniquement en build prod (`process.env.NODE_ENV === 'production'`), strategies de cache configurees par next-pwa 5.6.0 wrapping Workbox 6 : NetworkFirst pour `/api/*` (timeout 5s puis fallback cache), CacheFirst pour assets statiques `/icons/*` `/_next/static/*` (max 50 entrees), StaleWhileRevalidate pour pages HTML (re-validation arriere-plan), NetworkOnly pour endpoints sensibles `/api/v1/auth/*` et `/api/v1/payment/*` (jamais caches pour conformite Loi 09-08 CNDP donnees personnelles + securite paiement). Le SW expose aussi un fallback `document: '/offline'` pour les pages non pre-cachees.
- Les hooks `useInstallPrompt`, `useOnlineStatus`, `useServiceWorker` du package `@insurtech/shared-pwa` (livre par Tache 1.4.9) sont consommes par 3 composants livres : `PwaInstallBanner` (dismissible localStorage 7 jours, animation slide-up bottom mobile), `OfflineBanner` (top fixed warning jaune avec compteur queue), `UpdateAvailableBanner` (bottom fixed avec bouton "Recharger" pour appliquer update SW).
- Le client API Axios local supporte une **queue offline IndexedDB** (les requetes POST/PUT/DELETE realisees offline sont stockees + rejouees au retour online) -- cette infrastructure sera enrichie au Sprint 25 declaration sinistre offline-first avec migration possible PouchDB pour synchronisation bi-directionnelle conflict resolution. Le squelette est livre des Sprint 4 avec API publique `enqueueOffline()` / `flushQueue()`.
- Deux composants Sprint 25 placeholder sont livres avec leur infrastructure permissions navigator : `CameraCapture.tsx` (`navigator.mediaDevices.getUserMedia` avec gestion permission denied -> fallback file upload gallerie) et `GeolocationPicker.tsx` (`navigator.geolocation.getCurrentPosition` avec accuracy options + fallback manual address autocomplete via `@insurtech/shared-maps` Mapbox SearchBox).
- La conformite stricte aux conventions decision-006 (zero emoji), decision-008 (cloud souverain Atlas Cloud Benguerir), decision-009 (multilinguisme fr / ar-MA / ar avec RTL), aux palettes Skalean Sofidemy (ACAPS Teal #2D5773 status bar + Skalean Navy #1A2730 background + Sky Blue #B0CEE2 accents), au TypeScript strict, et aux regles Loi 09-08 CNDP (donnees personnelles photos sinistre + GPS = donnees sensibles consentement explicite Sprint 25), Decret 2-13-836 expertise automobile (workflow declaration sinistre format), ACAPS supervision (conformite Sprint 19 + 25 declarations).
- Les tests unitaires Vitest (composants `PwaInstallBanner`, `OfflineBanner`, `UpdateAvailableBanner`, `register-sw`, `api-client offline queue`, `idb wrapper`, `CameraCapture` mock, `GeolocationPicker` mock) passent avec couverture >= 80 %. Les tests Playwright e2e (chromium mobile emulation Pixel 5 + mobile-safari iPhone 13 emulation) passent avec scenarios install prompt visible apres interaction utilisateur, manifest valid via Chrome DevTools getManifest API, service worker registered (`window.navigator.serviceWorker.controller`), offline mode (`page.context().setOffline(true)` + reload + page still loads from cache), Lighthouse PWA score >= 90 baseline (cible Sprint 24 : >= 95), theme-color #2D5773 ACAPS Teal effectif sur status bar mobile installee, viewport-fit=cover OK pour iPhone notch.

L'objectif strategique est de fournir a **chaque assure marocain** (segment cible : titulaire d'une police auto Skalean assurance, age 25-65, smartphone entry-mid-range avec connexion 4G Inwi/IAM/Orange parfois 3G EDGE en zones rurales) un canal d'**urgence** pour declarer un sinistre dans les **15 minutes apres l'accident** depuis le lieu de l'incident, avec photos georeferencees horodatees, croquis manuel, signature numerique de l'assure et eventuellement du tiers, le tout fonctionnant en mode hors ligne degrade si le reseau est faible (frequent en bord de route hors agglomeration -- A1/A2/A4 autoroutes Maroc, zones montagneuses Atlas, zones desertiques sud).

---

## 3. CONTEXTE ETENDU

### 3.1 Pourquoi une PWA mobile dediee et pas une responsive web sur web-assure-portal

Le portail self-service `web-assure-portal` (port 3005, livre Tache 1.4.6) couvre 80 % des cas d'usage assure : consulter polices, payer prime, telecharger attestation, gerer contacts, suivre dossiers en cours. Il est responsive (mobile-friendly desktop-down) et accessible depuis n'importe quel navigateur web a `mon-espace.skalean-insurtech.ma`. Pourquoi alors creer une **PWA mobile dediee separee** pour la declaration sinistre ?

Trois raisons structurantes ont guide cette decision lors du Sprint 0 architecture v2.0 :

1. **Cas d'usage critique mobile-first non adaptable responsive** : la declaration de sinistre se fait **sur le lieu de l'accident**, debout au bord de la route, sous stress emotionnel apres un choc, avec un smartphone tenu d'une main. Le wizard 6 etapes (info accident / photos / lieu GPS / blesses / temoins / signature) necessite un **acces natif aux APIs hardware mobile** : camera arriere du smartphone (pas de webcam laptop), capteur GPS haute precision, accelerometre eventuellement (detection pan/tilt photos), microphone (Sprint 13 voix-to-text declaration des dommages -- pattern 14), capteur tactile (signature au stylet ou doigt). Une page responsive sur portal desktop-pensee n'optimise pas ces UX critiques.

2. **Offline-first imperatif** : 35 % des accidents au Maroc surviennent **hors agglomeration** (statistiques DGSN 2024) ou la couverture 4G est partielle voire 2G EDGE. Une page web responsive necessite une connexion stable pour soumettre le formulaire. Une PWA installee fonctionne en offline degrade : photos stockees IndexedDB, formulaire rempli en local, soumission queueable au retour online (Sprint 25 implementera la sync conflict resolution PouchDB). L'assure ne perd pas son temoignage si le reseau coupe en plein milieu du wizard.

3. **Install home screen + raccourci urgence** : la PWA installee depuis le store WebAPK Chrome Android (ou Add-to-Home-Screen iOS Safari) permet a l'assure de **declarer en 2 taps** depuis l'icone du launcher : tap icone "Skalean Espace" -> shortcut manifest "Declarer un sinistre" (defini dans `manifest.shortcuts[0]`) -> wizard etape 1 ouvert. Sans PWA installee, l'assure devrait : ouvrir Chrome -> taper URL -> attendre chargement page portal -> chercher menu "Mes sinistres" -> cliquer "Declarer nouveau" -> attendre page wizard. La difference UX en situation d'urgence est massive (15 secondes vs 90 secondes).

### 3.2 Alternatives architecturales evaluees

| Alternative | Pour | Contre | Decision Sprint 4 |
|-------------|------|--------|-------------------|
| **Responsive sur `web-assure-portal`** (port 3005, pas de PWA dediee) | Codebase unique, maintenance moindre, pas de friction install, SEO unifie | UX degradee mobile (pas raccourci home screen, pas offline-first, pas push notif iOS optimise), cas d'usage urgence non-prioritise | Rejete -- cas d'usage sinistre est mobile-first natif |
| **App native iOS (Swift) + Android (Kotlin)** | Performance optimale, push notifications iOS impeccables, integration Photos + Maps natives, badge icone notification compteur | Cout developpement triple (3 codebases), delai stores 1-4 semaines Apple, frais 99 USD/an Apple + 25 USD Google + 15-30 % paiements in-app, expertise iOS Swift rare au Maroc 2026 | Rejete Phase 1 -- migration Capacitor/React Native possible Phase 5 si demande |
| **PWA dediee assure-mobile (port 3006)** | Cross-platform iOS + Android avec 1 codebase, install Add-to-Home-Screen (no store delay), offline-first via SW + IndexedDB, theme color status bar, integration camera/GPS via APIs W3C, partage code packages shared-pwa/shared-ui/shared-maps, cout dev x1 | Moins natif que iOS Swift (push iOS pre-16.4 absent, IndexedDB quota Safari 50 Mo, install prompt iOS manuel), maintenance compatibility Safari iOS quirks | **RETENUE** -- meilleur ratio cout / impact utilisateur Phase 1-4 |
| **Hybride Capacitor (PWA + wrapper natif)** | Stores publication possible, PWA underneath donc mobile-web consultable aussi, push notif iOS native | Complexite build CI/CD doublee, taille bundle +30 % (Capacitor runtime), maintenance 2 stack | Migration Phase 5 evaluable Sprint 32 |

**Decision** : PWA dediee retenue. Migration Capacitor envisageable Sprint 32+ si demande forte iOS push fiable + integration native Photos.

### 3.3 Pourquoi next-pwa 5.6.0 (vs serwist alternative)

Cette decision a ete prise en Tache 1.4.3 web-garage-mobile et est appliquee identiquement ici pour coherence inter-PWA. Resume :

| Alternative | Pour | Contre | Decision |
|-------------|------|--------|----------|
| **next-pwa 5.6.0** (Shadow Walker) | Mature 5+ ans 4k stars, wraps Workbox, drop-in `withPWA(nextConfig)`, runtimeCaching declaratif, doc abondante FR/EN, communaute SO active, compatible Next.js 15 patch peer-deps | Maintenu mode minimal 2025 (release 5.6.0 oct 2023), depend Workbox 6.x non 7.x, ne supporte pas natif RSC streaming | **RETENUE** -- stabilite > modernite |
| **serwist** (anciennement next-pwa-serwist) | Workbox 7.x type-safe, support natif App Router 15, generation manifest TS-first | Moins mature, breaking changes possibles, doc succinte, peer-deps Next 15.1.0 peu testees prod | Migration Phase 5 evaluable |
| **Workbox custom** | Controle total, derniere version 7 | Maintenance lourde eject Next.js, generation precache list manuelle, regressions upgrades | Rejete -- effort sans valeur Phase 1 |

**Note peer-deps Next.js 15** : `next-pwa 5.6.0` officiellement pinned `next ^11 || ^12 || ^13 || ^14`. Pour Next.js 15.1.0, on installe avec `pnpm add next-pwa@5.6.0 -D --ignore-peer-deps` et on documente cette derogation dans `apps/web-assure-mobile/README.md`. Si regression detectee Sprint 13-25, fallback : pin Next 14.2.x sur cette app uniquement (configuration override) puis migrer serwist Sprint 32.

### 3.4 Trade-offs install friction PWA vs UX native

L'install d'une PWA souffre de plusieurs frictions vs une app native depuis store :

| Friction | Impact assure | Mitigation Sprint 4 |
|----------|---------------|---------------------|
| **Install prompt Chrome Android pas automatique** | Beaucoup d'assures ne savent pas qu'ils peuvent installer | Banniere `PwaInstallBanner` dismissible localStorage 7 jours, slide-up bottom apres 30s engagement, message multilingue "Installez Mon Espace pour declarer un sinistre en 1 tap" |
| **iOS Safari pas de `beforeinstallprompt`** | Impossible declencher prompt programmatiquement | Detection UA iOS + Safari, modal instructions illustrees "Partager > Sur l'ecran d'accueil" en 3 langues fr / ar-MA / ar, animation visuelle GIF placeholder Sprint 13 (dessine flow Safari share sheet) |
| **Permission notification refus 80 % au load** | Push notifications inutilisables si demande au boot | Sprint 4 : NE PAS demander permission au load, infrastructure preparee uniquement. Sprint 9 : demander apres action explicite "Activer les rappels" depuis page Profil |
| **Quota stockage iOS Safari 50 Mo eviction 7 jours** | Photos sinistre + drafts perdus si assure inactif | `navigator.storage.estimate()` au boot, warning si < 100 Mo, message "Reconnectez-vous chaque semaine pour preserver vos brouillons" |
| **Cross-vendor Browser API non-uniforme** | Bug subtil sur Samsung Internet, Edge mobile, UC Browser (Chinois en hausse Maroc) | Tests Playwright chromium mobile + mobile-safari, manuel Samsung Galaxy A23 + iPhone 11 obligatoire pre-prod |

### 3.5 iOS Safari quirks specifiques web-assure-mobile

Au-dela des quirks deja identifies en Tache 1.4.3 (beforeinstallprompt absent, IndexedDB 50 Mo, push pre-16.4, Background Sync inexistant), `web-assure-mobile` rencontre des quirks supplementaires lies au cas d'usage sinistre :

| Quirk | Impact sinistre | Mitigation Sprint 4 / Sprint 25 |
|-------|------------------|----------------------------------|
| `getUserMedia` requiert HTTPS strict (pas `localhost` exception en mobile-safari emulation reseau) | Tests dev impossibles en HTTP | Cert SSL local mkcert pour dev port 3006, doc README |
| `getCurrentPosition` accuracy degraded indoor / parking sous-sol | GPS lat/lng erratique | Fallback manual Mapbox SearchBox autocomplete, accuracy threshold > 50m -> alerter assure |
| `<input type="file" capture="environment">` declenche camera arriere mais lourd lent iOS | Photo lente, UX perdue | Preferer `getUserMedia` direct + canvas capture custom Sprint 13 |
| iOS 17.0-17.2 bug visibilitychange SW restart | Perte session wizard etape 4 si app backgrounded | Polling visibilitychange + sauvegarde draft IndexedDB toutes les 10s Sprint 25 |
| Safari audio `getUserMedia` necessite gesture utilisateur prealable | Pattern 14 voix-to-text echec si pas de tap pre-recording | Bouton "Activer microphone" explicite Sprint 13 |
| iOS 16+ photo HEIC format par defaut iPhone | Backend Sprint 25 ne sait pas decoder HEIC | Conversion canvas `toBlob('image/jpeg', 0.8)` cote client systematique |
| Maximum 6 fichiers `<input multiple>` iOS 16- | Limite photos sinistre Sprint 25 wizard | Workaround : prendre photos une par une via `getUserMedia` |
| `localStorage` purge agressive iOS Private Mode | Dismissed install banner re-affiche | Detection mode prive `try { localStorage.setItem('test','1') } catch` -> fallback sessionStorage |

### 3.6 Decisions appliquees

**decision-006 -- No Emoji** : aucun caractere emoji unicode (U+1F300-U+1FAFF, U+2600-U+27BF, U+E000-U+F8FF zone PUA risquee, U+FE0F variation selectors) ne doit apparaitre dans le code source, les tests, les translations FR / ar-MA / ar, le README, les commits, les commentaires, les noms de fichiers, le manifest, les libelles boutons. Substituts autorises : icones lucide-react (composant React `<Camera />`, `<MapPin />`, `<FileSignature />`, `<Wifi />`, `<WifiOff />`, `<Download />`, `<UploadCloud />`), pictogrammes Skalean Sofidemy (SVG illustrations Tache 1.4.8), texte mots-cles capitalises ("HORS LIGNE" au lieu d'icone wifi-coupe emoji, "URGENT" au lieu de feu rouge unicode).

**decision-008 -- Cloud Souverain Atlas Cloud Benguerir** : tous endpoints API, CDN, push notifications subscription endpoints, IndexedDB stockage local (par essence local navigateur OK), manifest URLs, icons URLs, screenshots URLs, web push VAPID keys server pointent exclusivement vers infrastructure Atlas Cloud Benguerir (`*.skalean-insurtech.ma`). Aucune dependance Firebase Cloud Messaging FCM Google US, ni AWS Amplify, ni OneSignal SaaS US, ni Mapbox tiles directement Mapbox.com (utilisation cle Mapbox autorisee mais via wrapper `@insurtech/shared-maps` qui peut basculer vers tile server self-hosted Sprint 32). Sprint 9 push notifications utilisera **web-push standard W3C avec VAPID keys self-hosted** sur Atlas Cloud (pas d'intermediaire FCM cote serveur). Cote client, l'API `Notification.requestPermission()` est standard W3C cross-vendor (independante FCM). Photos sinistre stockees Sprint 25 sur S3-compatible Atlas (MinIO ou equivalent souverain), pas sur AWS S3 us-east.

**decision-009 -- Multilinguisme fr / ar-MA / ar avec RTL** : 3 locales obligatoires partout. `fr` est le default (assure francophone urbain), `ar-MA` est le Darija parle (Casablanca, Rabat, Marrakech, Tanger -- transcription latine arabe melange code-switching), `ar` est l'arabe classique formel avec RTL (administration, affaires legales, conformite ACAPS). Le manifest `lang: "fr-MA"` mais les locales next-intl couvrent les 3. Le wizard Sprint 25 declaration sinistre doit etre traduit completement dans les 3 langues -- vocabulaire technique : "sinistre" = "حادثة" (ar) / "haditha" (ar-MA), "constat amiable" = "محضر ودي" (ar) / "constat" ou "mahdar widdi" (ar-MA code-switching), "tiers" = "طرف ثالث" (ar) / "tiers" (ar-MA), "blesse" = "مصاب" (ar), "temoin" = "شاهد" (ar).

**decision-PWA-strategy** (heritee Tache 1.4.3, propagee 1.4.7) : Strategy **Offline-first preparation, online-default execution**. La PWA utilise NetworkFirst pour les calls API (timeout 5s -> fallback cache si network fail). Le pre-cache se limite aux pages critiques (page dashboard, layout shell, login Sprint 5, page declarer-sinistre Sprint 25 priorite max) pour eviter de gonfler le SW > 4 Mo (limite quota Safari iOS). Pas de Background Sync API (non supporte iOS) -- sync au retour online via event `online` listener + polling visibilitychange. La queue offline IndexedDB est versionnee (`outbox-v1`) pour migrations futures. Specifique web-assure-mobile : la page `/declarer-sinistre` est **explicitement pre-cachee** via `next-pwa` config `additionalManifestEntries` car critique offline-first.

**decision-offline-first-sprint-25** : Sprint 25 implementera la sync bi-directionnelle conflict resolution via PouchDB (alternative envisagee : RxDB). Sprint 4 livre uniquement le squelette IndexedDB queue lineaire write-only. Le choix PouchDB vs RxDB sera tranche Sprint 24 selon volumes prevus + complexite conflict resolution.

### 3.7 Pitfalls observes (12)

1. **Camera permission denied UX -> graceful fallback file upload** : `navigator.mediaDevices.getUserMedia({ video: true })` peut etre rejete si l'utilisateur a refuse la permission camera (volontairement ou par accident -- dialog browser "Bloquer" tap par erreur). Une fois refuse permanent, le browser ne re-demande plus (l'utilisateur doit aller dans settings browser). Mitigation : si `getUserMedia` rejette avec `NotAllowedError`, afficher fallback `<input type="file" accept="image/*" capture="environment">` qui ouvre l'app Photos native (gallerie + camera selon device), et instructions "Pour utiliser la camera directement, autorisez l'acces depuis les parametres du navigateur". Composant `CameraCapture.tsx` Sprint 4 livre ce pattern.

2. **GPS permission denied -> manual address autocomplete fallback** : `navigator.geolocation.getCurrentPosition(success, error, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })` peut echouer avec `PERMISSION_DENIED`, `POSITION_UNAVAILABLE` (capteur HS), ou `TIMEOUT` (signal GPS faible interieur parking). Mitigation : composant `GeolocationPicker.tsx` Sprint 4 livre fallback Mapbox SearchBox autocomplete adresse via `@insurtech/shared-maps` (Tache 1.4.10) -- l'assure peut taper "Casablanca, Avenue Hassan II" et recevoir suggestions geocodees. Si encore refus, champ texte libre saisie manuelle "Decrivez le lieu" + croquis canvas Sprint 25.

3. **Offline queue sync conflict resolution Sprint 25** : si l'assure declare un sinistre offline (etape 1 info accident enregistree localement IndexedDB), puis revient online et l'assure modifie etape 1 en ligne avant que la queue ait flush, conflit potentiel sur le draft serveur. Sprint 4 livre la queue lineaire write-only (last-write-wins serveur) -- Sprint 25 implementera PouchDB sync avec strategie conflict resolution explicite (preference user choice : "garder version locale" / "garder version serveur" / "merger manuellement"). Documentation pitfall dans `README.md`.

4. **IndexedDB quota mobile ~50 Mo iOS** : iPhone Safari impose ~50 Mo PWA installee. Photos sinistre 6 photos x 2 Mo HEIC original = 12 Mo, encore raisonnable. Mais accumulation drafts (3 sinistres pas encore soumis = 36 Mo) approche limite. Mitigation : `navigator.storage.estimate()` au boot, warning UI si `quota - usage < 50 MB`, purge automatique drafts soumis avec ACK serveur, compression photos client-side <= 500 Ko via canvas `toBlob('image/jpeg', 0.8)` Sprint 25.

5. **Service worker scope vs start_url** : `start_url: "/fr"` est l'URL d'ouverture quand assure lance PWA depuis icone home screen. `scope: "/"` est la frontiere d'execution standalone -- toute navigation hors scope ouvre onglet navigateur classique. Bug courant : oublier slash final scope ou mettre scope plus large que start_url (browser refuse install). Validation : `pnpm manifest:validate` script verifie scope >= start_url path.

6. **manifest theme_color vs meta theme-color must match** : si `<meta name="theme-color" content="#2D5773">` dans HTML head et `"theme_color": "#FF0000"` dans manifest, browser pris au piege -> applique parfois l'un parfois l'autre selon timing. Toujours synchroniser via constante TS partagee `src/lib/theme-colors.ts` qui exporte `THEME_COLORS.assureMobile.statusBar = '#2D5773'`.

7. **Push notification permission timing UX (NOT on first visit)** : ne **JAMAIS** demander `Notification.requestPermission()` au load de la page (taux refus > 80 %). Demander uniquement apres action utilisateur explicite Sprint 9 : assure clique "Activer rappels paiement prime" depuis page Profil. Sprint 4 ne demande pas la permission, livre uniquement infrastructure VAPID public key + endpoint subscription stub.

8. **Photo compression client-side (Intl Image API ou canvas)** : iPhone 13+ produit photos HEIC 8 Mo originaux qui depassent quota mobile et ralentissent upload Sprint 25. Mitigation : compression systematique cote client via `<canvas>` API ou `compress.js` library : redimensionner max 1920x1080, qualite JPEG 0.8, conversion HEIC -> JPEG (puisque backend Sprint 25 ne decode pas HEIC). Composant `CameraCapture.tsx` Sprint 4 inclut helper compression placeholder TODO Sprint 13.

9. **Signature drawing canvas pen-events** : composant signature Sprint 11 utilisera `<canvas>` avec listeners `pointerdown` / `pointermove` / `pointerup` (Pointer Events API W3C) qui unifie touch + mouse + stylus Apple Pencil. Bug courant : utiliser `mousemove` only -> ne fonctionne pas tactile. Bug courant 2 : oublier `event.preventDefault()` sur `touchmove` -> page scrolle sous le doigt pendant signature. Sprint 4 ne livre pas le composant signature (Sprint 11 livre `<SignaturePad>` from shared-ui), mais le `package.json` declare `react-signature-canvas` placeholder Sprint 11.

10. **Video upload chunked Sprint 25** : Sprint 25 envisage upload videos courtes (10-30s) du sinistre (degats avant/apres, audio descriptif). Upload monolithique echoue sur 3G/2G EDGE rural. Mitigation Sprint 25 : upload chunked 1 Mo via `tus-js-client` avec resume au retour online. Sprint 4 ne livre pas mais documente pattern dans README.

11. **Conflit `viewport-fit=cover` iPhone notch sans `safe-area-inset` CSS** : iPhone X+ a une encoche superieure qui masque les 44px en haut si `viewport-fit=cover` mais pas de padding safe-area. Mitigation : meta viewport `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">` + CSS `padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);` sur layout root. Sprint 4 livre dans `globals.css`.

12. **Workbox runtimeCaching vs precache conflict** : si une URL est a la fois dans precache (pages critiques) et dans runtimeCaching (NetworkFirst /api/*), Workbox priorise precache et n'applique jamais NetworkFirst. Eviter chevauchements : pages dans precache uniquement, API exclusivement runtimeCaching. Validation manuelle Chrome DevTools Application > Cache Storage -> verifier separation `precache-v2-` et `runtime-`.

### 3.8 Cas d'usage utilisateurs cibles assure

**Persona 1 -- Fatima, 38 ans, professeure**, Casablanca, smartphone Samsung Galaxy A14 (RAM 4 Go, ecran 6.6 pouces 720p), connexion 4G Inwi prepayee 10 Go/mois. Possede une Renault Clio 5 polices auto Skalean tous risques 6500 MAD/an. Sinistre type : accrochage parking centre commercial (sans tiers identifie). Cas usage : ouvre PWA installee depuis home screen, tap raccourci "Declarer sinistre", remplit etape 1 info (date auto, heure auto, type "accrochage en stationnement"), etape 2 photos (4 photos vehicule + plaque + degat detail), etape 3 lieu (GPS auto Casablanca Anfa Place precision 8m), etape 4 blesses (aucun), etape 5 temoins (aucun, opt-out), etape 6 signature canvas tactile. Soumission online directe. Duration UX cible : 4 minutes.

**Persona 2 -- Hassan, 52 ans, agriculteur**, Beni Mellal, iPhone 11 reconditionne, connexion 4G IAM mediocre 3G en zones rurales. Possede Dacia Logan + 4x4 Mitsubishi L200 polices flotte agricole Skalean. Sinistre type : sortie de route sur RN8 entre Beni Mellal et Khouribga avec couverture 2G. Cas usage : ouvre PWA, mode offline declenche `OfflineBanner`. Remplit le wizard offline (photos 6 stockees IndexedDB, GPS capte mais sans tile carte affichee), draft enregistre IndexedDB. Reprend la route, retour 4G a 30km. Banniere "Synchronisation 8 actions en attente -- 100 % terminee". Duration UX cible : 8 minutes inclus offline buffer.

**Persona 3 -- Khadija, 26 ans, etudiante**, Tanger, smartphone Tecno Spark 10 (RAM 3 Go), Maroc Telecom, native Darija + arabe classique. Sinistre type : pas elle-meme conductrice, mais passagere blesse legere. Cas usage : utilise PWA en arabe classique RTL (`/ar`), wizard texte droite-a-gauche. Etape 4 blesses : ajoute soi-meme avec details medicaux (centre hospitalier Mohammed VI Tanger). Photo blessure consenti CGU Loi 09-08 explicit. Duration UX cible : 6 minutes.

**Persona 4 -- Mehdi, 45 ans, cadre dirigeant**, Rabat, iPhone 15 Pro, fibre WiFi domicile 200 Mbps, 5G Inwi pro. Possede BMW Serie 3 + flotte 4 vehicules entreprise Skalean PRO. Sinistre type : carambolage 3 vehicules autoroute A1 Rabat-Casablanca. Cas usage critique : tiers blesse, intervention police, constat amiable europeen avec 2 tiers. Wizard etape 5 temoins detaille (3 temoins coordonnees), etape 6 signature multi-parties (assure + tiers 1 + tiers 2 chacun signe sur le meme device). Upload photos rapides 5G. Sprint 25 implementera signature multi-parties sequentielle. Duration UX cible : 12 minutes (cas complexe).

Ces personas guident les choix Sprint 4 :
- Manifest `orientation: "portrait"` (smartphone tenu d'une main).
- `display: "standalone"` (max espace ecran sans barre URL).
- Pre-cache leger (3G EDGE rural Hassan -> chargement initial < 800 Ko).
- Boutons tactiles >= 48px (mains parfois tremblantes apres choc).
- Contraste eleve (lumiere soleil bord de route).
- Texte minimaliste avec icones lucide-react explicites.
- Multilingue 3 langues fr / ar-MA / ar avec RTL pour Khadija.
- Theme color ACAPS Teal #2D5773 status bar (rappelle conformite ACAPS reassurance).

---

## 4. ARCHITECTURE -- DEPENDANCES ET BLOCAGES

### 4.1 Diagramme dependances tache

```
[1.4.6 web-assure-portal]      [1.4.3 web-garage-mobile]      [1.4.9 shared-pwa]
        |                              |                              |
        |  theme ACAPS Teal           |  pattern PWA dupplique        |  hooks install/online/SW
        +------------------------------+------------------------------+
                                       |
                                       v
                             [1.4.7 web-assure-mobile]   <-- CETTE TACHE
                                       |
                  +--------+--------+--------+--------+--------+
                  |        |        |        |        |        |
                  v        v        v        v        v        v
              [1.4.8] [Sprint 5] [Sprint 9] [Sprint 11] [Sprint 13] [Sprint 25]
              admin   auth      push       signature   photos      decla 6 etapes
              signal  flow      VAPID      canvas      pattern 14  PouchDB sync
```

### 4.2 Inputs heritages

- **De 1.4.6 web-assure-portal** : palette couleurs `THEME_COLORS.assure` (ACAPS Teal #2D5773 primary, Sky Blue #B0CEE2 accent, Skalean Navy #1A2730 background dark mode). Vocabulaire i18n assure (sinistre, police, attestation, prime, franchise, etc.) reutilise dans `src/messages/{fr,ar-MA,ar}.json`. Architecture `src/app/[locale]/` directory layout. Interceptor x-user-id (assure_user) Axios pattern. Configuration multi-tenant strict L3 scoping.

- **De 1.4.3 web-garage-mobile** : pattern PWA complet duplique : `next.config.mjs` avec `withPWA` wrapper, `manifest.webmanifest` structure, `register-sw.ts` boilerplate, banniere install/offline/update components shape, viewport meta avec viewport-fit=cover + safe-area, theme-color sync TS constant, CSS globals safe-area-inset, Workbox runtimeCaching strategies (NetworkFirst api / CacheFirst static / SWR pages / NetworkOnly auth+payment). Adaptations cles : port 3003 -> 3006, theme #E95D2C -> #2D5773, name "Skalean Garage Mobile" -> "Skalean Mon Espace Mobile", shortcuts technicien -> shortcuts assure (Declarer sinistre / Mes polices), x-garage-id -> x-user-id assure scoping.

- **De 1.4.9 shared-pwa** (peut etre stub si tache 1.4.9 en parallele) :
  - `useInstallPrompt()` -> `{ canPrompt: boolean, prompt: () => Promise<'accepted'|'dismissed'>, dismissed: boolean, isIOS: boolean, showIOSInstructions: () => void }`
  - `useOnlineStatus()` -> `{ online: boolean, since: Date, queueLength: number }`
  - `useServiceWorker()` -> `{ registration: ServiceWorkerRegistration | null, updateAvailable: boolean, applyUpdate: () => void }`
  - Helper `enqueueOfflineRequest(req: SerializedRequest)` -> Promise<void> (IndexedDB)
  - Helper `flushOfflineQueue()` -> Promise<{ success: number, failed: number }>
  - Helper `getStorageEstimate()` -> Promise<{ usage: number, quota: number, percent: number }>

- **De 1.4.8 shared-ui** : composants `<Button>`, `<Card>`, `<Banner>`, `<Spinner>`, `<Icon>` (wrapper lucide-react), `<BottomTabs>` (mobile-first navigation 3-5 tabs), constantes `SKALEAN_COLORS`, theme provider context.

- **De 1.4.10 shared-maps** (peut etre stub) : composant `<MapboxSearchBox>` autocomplete adresses Maroc, helper `reverseGeocode(lat, lng)` -> adresse.

### 4.3 Outputs livres consommes par taches futures

- **Vers 1.4.8 web-insurtech-admin** : signal final Sprint 4 Phase 1 complete (PWAs OK).
- **Vers Sprint 5 auth flow** : page login PWA-aware (login + redirect deep link `/declarer-sinistre`), session persist IndexedDB, multi-tenant `x-user-id` injection.
- **Vers Sprint 9 push notifications** : infrastructure VAPID public key env, endpoint subscription stub, page Profil "Activer rappels" placeholder.
- **Vers Sprint 11 signature electronique** : composant `SignaturePad` consume from shared-ui Tache 1.4.8, integration etape 6 wizard.
- **Vers Sprint 13 capture photo sinistre** : composant `CameraCapture.tsx` infrastructure permissions camera, compression placeholder, integration etape 2 wizard.
- **Vers Sprint 19 conformite ACAPS** : architecture assure-mobile auditable conformite supervision ACAPS (theme color rappel + footer mentions legales).
- **Vers Sprint 25 declaration sinistre offline-first** : queue IndexedDB initialisee, page `/declarer-sinistre` placeholder 6 etapes wizard skeleton, PouchDB migration possible.

### 4.4 Multi-tenant strict L3 scoping

L'app web-assure-mobile suit les regles multi-tenant L3 :

- L'utilisateur authentifie (Sprint 5) recoit un `userId` (assure_user role) et `tenantId` dans son JWT.
- Toutes les requetes API doivent inclure headers `x-tenant-id: <uuid>` + `x-user-id: <uuid>` (L3 row-level scoping assure_user RLS PostgreSQL Sprint 3) + `x-trace-id: <uuid>` injectes par interceptor Axios.
- Le service worker ne **doit pas** cacher de reponses cross-user (cache key inclut `tenantId` + `userId`).
- IndexedDB queue stockee dans store namespace `outbox-${tenantId}-${userId}` pour eviter cross-user pollution sur appareil partage famille.
- Au logout, purger IndexedDB, vider caches SW (`caches.keys()` + `caches.delete()`), unregister SW.
- Photos sinistre IndexedDB scoped `photos-${tenantId}-${userId}-${sinistreId}` pour isolation totale.

---

## 5. LIVRABLES CHECKABLES

- [ ] L1. Repertoire `apps/web-assure-mobile/` cree avec arborescence complete (~25 fichiers).
- [ ] L2. `package.json` configure : nom `@insurtech/web-assure-mobile`, port dev 3006, scripts `dev`, `build`, `start`, `lint`, `test`, `test:e2e`, `lighthouse:pwa`, `manifest:validate`, `sw:audit`, `clean`.
- [ ] L3. Dependances installees : Next.js 15.1.0, React 19.0.0, next-intl 3.26.3, next-pwa 5.6.0 (--ignore-peer-deps), workbox-webpack-plugin, axios 1.7.9, @tanstack/react-query 5.62.7, @tanstack/query-async-storage-persister, @tanstack/query-persist-client-core, idb 8.0.0, web-push 3.6.7 (placeholder Sprint 9 cote client), react-signature-canvas (placeholder Sprint 11), react-image-crop (placeholder Sprint 13), browser-image-compression (placeholder Sprint 13).
- [ ] L4. `next.config.mjs` integre `withPWA(nextConfig)` avec configuration runtimeCaching complete (NetworkFirst api timeout 5s, CacheFirst static max 50, StaleWhileRevalidate pages, NetworkOnly auth + payment), `disable: process.env.NODE_ENV === 'development'`, `register: true`, `skipWaiting: true`, port 3006, headers HSTS + X-Frame-Options DENY + CSP, rewrites `/api/v1/:path*`, images.remotePatterns Atlas Cloud Benguerir, `additionalManifestEntries: ['/declarer-sinistre']` pre-cache critique.
- [ ] L5. `tailwind.config.ts` etend preset Skalean Sofidemy avec breakpoints mobile-first emphasized (`xs: 360px`, `sm: 480px`, `md: 768px`), colors theme assure (primary #2D5773 ACAPS Teal, accent #B0CEE2 Sky Blue).
- [ ] L6. `tsconfig.json` strict mode avec paths `@/*` -> `./src/*`, `@insurtech/shared-pwa`, `@insurtech/shared-ui`, `@insurtech/shared-maps`.
- [ ] L7. `public/manifest.webmanifest` complet (~50 lignes) : name "Skalean Mon Espace Mobile", short_name "Skalean Espace", description multilingue, start_url `/fr`, scope `/`, display `standalone`, orientation `portrait`, theme_color `#2D5773`, background_color `#1A2730`, lang `fr-MA`, dir `ltr`, categories `productivity` + `finance`, icons array 4 entrees (192/512/maskable-192/maskable-512), shortcuts array 2 entrees (Declarer sinistre / Mes polices), screenshots placeholder Sprint 24.
- [ ] L8. Fichiers icons placeholder generes : `public/icons/icon-192.png`, `public/icons/icon-512.png`, `public/icons/icon-maskable-192.png`, `public/icons/icon-maskable-512.png`, `public/icons/apple-touch-icon-180.png`, `public/favicon.ico` (TODO Sprint 24 design final).
- [ ] L9. `src/app/[locale]/layout.tsx` (~150 lignes) avec viewport mobile-first complet (`width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover`), theme-color #2D5773, apple-mobile-web-app-capable yes, status-bar-style black-translucent, font Montserrat + Noto Naskh, BottomTabs from shared-ui (Accueil / Sinistres / Profil).
- [ ] L10. `src/app/[locale]/page.tsx` (~80 lignes) page placeholder dashboard mobile assure (mes polices stub + alertes paiement stub + raccourci urgence "Declarer sinistre").
- [ ] L11. `src/app/[locale]/declarer-sinistre/page.tsx` (~120 lignes) placeholder Sprint 25 avec wizard 6 etapes skeleton (1.info / 2.photos / 3.lieu GPS / 4.blesses / 5.temoins / 6.signature) -- navigation entre etapes fonctionnelle, contenu placeholder.
- [ ] L12. `src/app/[locale]/mes-sinistres/page.tsx` (~60 lignes) liste sinistres en cours stub.
- [ ] L13. `src/app/[locale]/profil/page.tsx` (~60 lignes) page profil assure stub avec section "Activer rappels" placeholder Sprint 9.
- [ ] L14. `src/app/offline/page.tsx` page offline statique pre-cachee (sans locale prefix).
- [ ] L15. `src/app/not-found.tsx` page 404 mobile-first.
- [ ] L16. `src/middleware.ts` (~30 lignes) next-intl middleware locale routing.
- [ ] L17. `src/i18n/request.ts` (~40 lignes) configuration next-intl 3 locales fr / ar-MA / ar.
- [ ] L18. `src/messages/fr.json`, `src/messages/ar-MA.json`, `src/messages/ar.json` avec ~50 keys vocab assure mobile (`nav.{accueil,sinistres,polices,profil}`, `sinistres.{declarer,photos,lieu,signature,blesses,temoins}`, `offline.{message,sync,queue_length}`, `install.{prompt,ios_instructions}`, `permissions.{camera,geolocation,notification}`).
- [ ] L19. Composant `src/components/PwaInstallBanner.tsx` (~120 lignes) imports from `@insurtech/shared-pwa useInstallPrompt`, dismissible localStorage 7 jours, animation slide-up bottom mobile, modal iOS Add-to-Home-Screen instructions illustrees 3 langues.
- [ ] L20. Composant `src/components/OfflineBanner.tsx` (~60 lignes) from `@insurtech/shared-pwa useOnlineStatus`, fixed top, color warning jaune #FFB100, message localized + compteur queue.
- [ ] L21. Composant `src/components/UpdateAvailableBanner.tsx` (~80 lignes) listens controllerchange depuis shared-pwa, prompt reload bottom fixed.
- [ ] L22. Composant `src/components/CameraCapture.tsx` (~150 lignes) Sprint 25 placeholder : `navigator.mediaDevices.getUserMedia` camera permission gestion, photo capture + compression placeholder + IndexedDB store, fallback `<input type="file">` si permission denied.
- [ ] L23. Composant `src/components/GeolocationPicker.tsx` (~120 lignes) `navigator.geolocation.getCurrentPosition` accuracy options, fallback manual address Mapbox SearchBox depuis `@insurtech/shared-maps` si permission denied.
- [ ] L24. Lib `src/lib/register-sw.ts` (~50 lignes) wrapper enregistrement SW + check storage quota `navigator.storage.estimate()`.
- [ ] L25. Lib `src/lib/api-client.ts` (~150 lignes) Axios instance avec interceptors injection `x-tenant-id` + `x-user-id` (assure) + `x-trace-id` + `Authorization`, et offline queue (enqueue si `!navigator.onLine`, flush au retour online via event listener).
- [ ] L26. Lib `src/lib/query-client.ts` (~80 lignes) QueryClient TanStack configure avec persister IndexedDB via `@tanstack/query-async-storage-persister` + `idb 8` wrapper.
- [ ] L27. Lib `src/lib/idb.ts` (~80 lignes) wrapper IndexedDB pour offline queue, sinistre draft store, photo storage scoped tenant + user.
- [ ] L28. Lib `src/lib/theme-colors.ts` constantes synchronisation theme assure ACAPS Teal.
- [ ] L29. Provider `src/components/providers.tsx` (~80 lignes) integration QueryProvider + ServiceWorkerProvider + I18nProvider.
- [ ] L30. Fichier `public/sw-custom.js` placeholder (custom logic complement next-pwa generated -- vide Sprint 4, Sprint 25 ajoute logique sync).
- [ ] L31. `.env.example` complet (~25 lignes) avec 15+ vars `NEXT_PUBLIC_*` incluant `NEXT_PUBLIC_OFFLINE_QUEUE_MAX_SIZE_MB=50`, `NEXT_PUBLIC_PHOTO_MAX_SIZE_MB=10`, `NEXT_PUBLIC_PHOTO_COMPRESSION_QUALITY=0.8`.
- [ ] L32. `src/app/globals.css` (~30 lignes) mobile-first base styles + safe-area-inset CSS env() pour iPhone notch.
- [ ] L33. `README.md` instructions install dev, audit Lighthouse PWA, validation manifest, troubleshooting iOS quirks.
- [ ] L34. Tests unitaires Vitest 18-22 tests : `PwaInstallBanner.spec.tsx`, `OfflineBanner.spec.tsx`, `UpdateAvailableBanner.spec.tsx`, `register-sw.spec.ts`, `api-client.spec.ts` (offline queue mock), `idb.spec.ts` (fake-indexeddb), `CameraCapture.spec.tsx` (mock getUserMedia), `GeolocationPicker.spec.tsx` (mock geolocation), `theme-colors.spec.ts`.
- [ ] L35. Tests Playwright e2e 8+ scenarios mobile-safari + chromium mobile : install prompt visible apres interaction, manifest valid via getManifest API, SW registered (page.evaluate window.navigator.serviceWorker.controller), offline mode (setOffline(true) + reload), Lighthouse PWA >= 90, theme-color #2D5773 status bar, viewport-fit=cover iOS notch, BottomTabs visible mobile.
- [ ] L36. Validation `pnpm --filter @insurtech/web-assure-mobile lint` 0 warning.
- [ ] L37. Validation `pnpm --filter @insurtech/web-assure-mobile typecheck` 0 erreur.
- [ ] L38. Validation `pnpm --filter @insurtech/web-assure-mobile test` 100 % pass coverage >= 80 %.
- [ ] L39. Validation `pnpm --filter @insurtech/web-assure-mobile build` succes (output `.next/` + `public/sw.js` + `public/workbox-*.js` generes).
- [ ] L40. Validation manuelle Chrome DevTools : Application > Manifest valid, Service Workers registered active, Cache Storage populated, IndexedDB outbox-v1 initialized.

---

## 6. CODE PATTERNS COMPLETS

### 6.1 `apps/web-assure-mobile/package.json`

```json
{
  "name": "@insurtech/web-assure-mobile",
  "version": "0.1.0",
  "private": true,
  "description": "Skalean Mon Espace Mobile -- PWA assure declaration sinistre (Sprint 4 bootstrap)",
  "license": "UNLICENSED",
  "author": "Skalean InsurTech <dev@skalean-insurtech.ma>",
  "scripts": {
    "dev": "next dev --port 3006",
    "build": "next build",
    "start": "next start --port 3006",
    "lint": "next lint --max-warnings 0",
    "lint:fix": "next lint --fix",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "test:e2e": "playwright test --config=playwright.config.ts",
    "test:e2e:headed": "playwright test --headed",
    "lighthouse:pwa": "lhci autorun --collect.url=http://localhost:3006/fr --collect.settings.preset=desktop --assert.preset=lighthouse:no-pwa --assert.assertions.categories:pwa.minScore=0.90",
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
    "react-signature-canvas": "1.0.7",
    "react-image-crop": "11.0.7",
    "browser-image-compression": "2.0.2",
    "react-hook-form": "7.54.2",
    "@hookform/resolvers": "3.9.1",
    "@insurtech/shared-ui": "workspace:*",
    "@insurtech/shared-pwa": "workspace:*",
    "@insurtech/shared-maps": "workspace:*"
  },
  "devDependencies": {
    "typescript": "5.7.2",
    "@types/node": "22.10.2",
    "@types/react": "19.0.1",
    "@types/react-dom": "19.0.2",
    "@types/web-push": "3.6.4",
    "tailwindcss": "4.0.0-beta.4",
    "postcss": "8.4.49",
    "autoprefixer": "10.4.20",
    "eslint": "9.17.0",
    "eslint-config-next": "15.1.0",
    "vitest": "2.1.8",
    "@vitest/coverage-v8": "2.1.8",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@testing-library/user-event": "14.5.2",
    "@playwright/test": "1.49.1",
    "@lhci/cli": "0.14.0",
    "fake-indexeddb": "6.0.0",
    "jsdom": "25.0.1"
  }
}
```

### 6.2 `apps/web-assure-mobile/next.config.mjs`

```javascript
import withPWA from 'next-pwa';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
  publicExcludes: ['!noprecache/**/*'],
  fallbacks: {
    document: '/offline'
  },
  additionalManifestEntries: [
    { url: '/fr/declarer-sinistre', revision: '1' },
    { url: '/ar-MA/declarer-sinistre', revision: '1' },
    { url: '/ar/declarer-sinistre', revision: '1' },
    { url: '/offline', revision: '1' }
  ],
  runtimeCaching: [
    {
      urlPattern: /^\/api\/v1\/auth\/.*/i,
      handler: 'NetworkOnly'
    },
    {
      urlPattern: /^\/api\/v1\/payment\/.*/i,
      handler: 'NetworkOnly'
    },
    {
      urlPattern: /^\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache-v1',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
        cacheableResponse: { statuses: [0, 200] }
      }
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'image-cache-v1',
        expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }
      }
    },
    {
      urlPattern: /\.(?:js|css|woff2)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-cache-v1',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
      }
    },
    {
      urlPattern: /^https?.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages-cache-v1',
        expiration: { maxEntries: 50 }
      }
    }
  ]
});

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    typedRoutes: true,
    serverActions: { bodySizeLimit: '12mb' }
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.skalean-insurtech.ma',
        port: '',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: 'cdn.atlas-cloud.ma',
        port: '',
        pathname: '/**'
      }
    ],
    formats: ['image/avif', 'image/webp']
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), geolocation=(self), microphone=(self), payment=()' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data: blob: https://*.skalean-insurtech.ma https://cdn.atlas-cloud.ma; connect-src 'self' https://api.skalean-insurtech.ma wss://api.skalean-insurtech.ma; worker-src 'self' blob:; manifest-src 'self'" }
        ]
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=86400' }
        ]
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL + '/api/v1/:path*'
      }
    ];
  },
  output: 'standalone'
};

export default pwaConfig(nextConfig);
```

### 6.3 `apps/web-assure-mobile/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';
import skaleanPreset from '@insurtech/shared-ui/tailwind-preset';

const config: Config = {
  presets: [skaleanPreset],
  content: [
    './src/**/*.{ts,tsx,js,jsx}',
    '../../packages/shared-ui/src/**/*.{ts,tsx}',
    '../../packages/shared-pwa/src/**/*.{ts,tsx}',
    '../../packages/shared-maps/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      screens: {
        xs: '360px',
        sm: '480px',
        md: '768px',
        lg: '1024px'
      },
      colors: {
        primary: {
          DEFAULT: '#2D5773',
          50: '#E8EFF4',
          500: '#2D5773',
          900: '#1A2730'
        },
        accent: {
          DEFAULT: '#B0CEE2',
          500: '#B0CEE2'
        }
      },
      fontFamily: {
        sans: ['Montserrat', 'Noto Naskh Arabic', 'system-ui'],
        arabic: ['Noto Naskh Arabic', 'serif']
      }
    }
  },
  plugins: []
};

export default config;
```

### 6.4 `apps/web-assure-mobile/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"],
      "@insurtech/shared-ui": ["../../packages/shared-ui/src"],
      "@insurtech/shared-pwa": ["../../packages/shared-pwa/src"],
      "@insurtech/shared-maps": ["../../packages/shared-maps/src"]
    },
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next", "coverage", "playwright-report"]
}
```

### 6.5 `apps/web-assure-mobile/public/manifest.webmanifest`

```json
{
  "name": "Skalean Mon Espace Mobile",
  "short_name": "Skalean Espace",
  "description": "Espace mobile assure -- declarer un sinistre, gerer mes polices, payer ma prime, telecharger mon attestation",
  "start_url": "/fr",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#2D5773",
  "background_color": "#1A2730",
  "lang": "fr-MA",
  "dir": "ltr",
  "categories": ["productivity", "finance"],
  "prefer_related_applications": false,
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
    }
  ],
  "shortcuts": [
    {
      "name": "Declarer un sinistre",
      "short_name": "Declarer",
      "description": "Declarer un sinistre depuis le lieu de l'accident",
      "url": "/fr/declarer-sinistre",
      "icons": [
        { "src": "/icons/shortcut-declare-96.png", "sizes": "96x96", "type": "image/png" }
      ]
    },
    {
      "name": "Mes polices",
      "short_name": "Polices",
      "description": "Consulter mes polices d'assurance",
      "url": "/fr/polices",
      "icons": [
        { "src": "/icons/shortcut-policy-96.png", "sizes": "96x96", "type": "image/png" }
      ]
    }
  ],
  "screenshots": [],
  "related_applications": []
}
```

### 6.6 `apps/web-assure-mobile/src/app/[locale]/layout.tsx`

```typescript
import type { Metadata, Viewport } from 'next';
import { Montserrat, Noto_Naskh_Arabic } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Providers } from '@/components/providers';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';
import { OfflineBanner } from '@/components/OfflineBanner';
import { UpdateAvailableBanner } from '@/components/UpdateAvailableBanner';
import { BottomTabs } from '@insurtech/shared-ui';
import { THEME_COLORS } from '@/lib/theme-colors';
import '../globals.css';

const montserrat = Montserrat({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap'
});

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-noto-naskh',
  display: 'swap'
});

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: THEME_COLORS.assureMobile.statusBar
};

export async function generateMetadata({
  params
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: { default: t('title'), template: `%s | ${t('siteName')}` },
    description: t('description'),
    applicationName: 'Skalean Mon Espace Mobile',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'Skalean Espace'
    },
    formatDetection: { telephone: false, address: false, email: false },
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [
        { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }
      ],
      apple: [
        { url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }
      ]
    },
    other: {
      'mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-capable': 'yes',
      'apple-mobile-web-app-status-bar-style': 'black-translucent',
      'apple-mobile-web-app-title': 'Skalean Espace'
    }
  };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale)) notFound();

  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} className={`${montserrat.variable} ${notoNaskh.variable}`}>
      <head>
        <meta name="theme-color" content={THEME_COLORS.assureMobile.statusBar} />
        <meta name="format-detection" content="telephone=no" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="font-sans bg-primary-900 text-white min-h-screen pb-safe pt-safe overflow-x-hidden">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <OfflineBanner />
            <UpdateAvailableBanner />
            <main className="flex-1 pb-20" role="main">
              {children}
            </main>
            <BottomTabs
              variant="assure"
              tabs={[
                { key: 'home', href: `/${locale}`, icon: 'Home', labelKey: 'nav.accueil' },
                { key: 'sinistres', href: `/${locale}/mes-sinistres`, icon: 'FileText', labelKey: 'nav.sinistres' },
                { key: 'profil', href: `/${locale}/profil`, icon: 'User', labelKey: 'nav.profil' }
              ]}
            />
            <PwaInstallBanner />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 6.7 `apps/web-assure-mobile/src/app/[locale]/page.tsx`

```typescript
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Card } from '@insurtech/shared-ui';
import { AlertTriangle, FileText, Phone } from 'lucide-react';

export default async function DashboardPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  return (
    <div className="px-4 py-6 max-w-md mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-bold mb-1">{t('welcome')}</h1>
        <p className="text-sm text-accent-500">{t('subtitle')}</p>
      </header>

      <Link href={`/${locale}/declarer-sinistre`} className="block">
        <Card className="bg-red-700 border-2 border-red-800 p-4 active:scale-95 transition-transform">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 shrink-0" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-bold">{t('emergency.title')}</h2>
              <p className="text-sm opacity-90">{t('emergency.subtitle')}</p>
            </div>
          </div>
        </Card>
      </Link>

      <section className="grid grid-cols-2 gap-3">
        <Link href={`/${locale}/polices`}>
          <Card className="p-4 h-full">
            <FileText className="h-6 w-6 mb-2" aria-hidden="true" />
            <span className="text-sm font-semibold">{t('actions.policies')}</span>
          </Card>
        </Link>
        <Link href={`/${locale}/profil/contact`}>
          <Card className="p-4 h-full">
            <Phone className="h-6 w-6 mb-2" aria-hidden="true" />
            <span className="text-sm font-semibold">{t('actions.contact')}</span>
          </Card>
        </Link>
      </section>

      <section aria-labelledby="alerts-heading">
        <h2 id="alerts-heading" className="text-base font-semibold mb-2">{t('alerts.title')}</h2>
        <Card className="p-4">
          <p className="text-sm">{t('alerts.empty_placeholder')}</p>
        </Card>
      </section>
    </div>
  );
}
```

### 6.8 `apps/web-assure-mobile/src/app/[locale]/declarer-sinistre/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Card } from '@insurtech/shared-ui';
import { ChevronLeft, ChevronRight, Camera, MapPin, Users, FileSignature, Info, UserCheck } from 'lucide-react';

type Step = 'info' | 'photos' | 'lieu' | 'blesses' | 'temoins' | 'signature';

const STEPS: Array<{ key: Step; icon: typeof Info }> = [
  { key: 'info', icon: Info },
  { key: 'photos', icon: Camera },
  { key: 'lieu', icon: MapPin },
  { key: 'blesses', icon: UserCheck },
  { key: 'temoins', icon: Users },
  { key: 'signature', icon: FileSignature }
];

export default function DeclarerSinistrePage() {
  const t = useTranslations('sinistres.declarer');
  const [currentStep, setCurrentStep] = useState<number>(0);

  const step = STEPS[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <div className="px-4 py-6 max-w-md mx-auto">
      <header className="mb-4">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="text-sm text-accent-500" aria-live="polite">
          {t('progress', { current: currentStep + 1, total: STEPS.length })}
        </p>
      </header>

      <ol className="flex justify-between mb-6" role="list" aria-label={t('stepsAriaLabel')}>
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const completed = idx < currentStep;
          const active = idx === currentStep;
          return (
            <li
              key={s.key}
              className={`flex flex-col items-center text-xs ${
                active ? 'text-white' : completed ? 'text-accent-500' : 'text-gray-500'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              <Icon className="h-5 w-5 mb-1" aria-hidden="true" />
              <span className="hidden sm:block">{t(`steps.${s.key}`)}</span>
            </li>
          );
        })}
      </ol>

      <Card className="p-4 mb-4 min-h-[300px]">
        <h2 className="text-lg font-semibold mb-2">{t(`steps.${step.key}`)}</h2>
        <div role="region" aria-label={t(`steps.${step.key}`)}>
          <p className="text-sm opacity-80">{t(`placeholder.${step.key}`)}</p>
          <p className="text-xs mt-3 italic opacity-60">{t('sprint25Notice')}</p>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="secondary"
          onClick={() => setCurrentStep((s) => Math.max(0, s - 1))}
          disabled={isFirstStep}
          className="flex-1"
        >
          <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
          {t('previous')}
        </Button>
        <Button
          variant="primary"
          onClick={() => setCurrentStep((s) => Math.min(STEPS.length - 1, s + 1))}
          disabled={isLastStep}
          className="flex-1"
        >
          {t('next')}
          <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
```

### 6.9 `apps/web-assure-mobile/src/app/[locale]/mes-sinistres/page.tsx`

```typescript
import { getTranslations } from 'next-intl/server';
import { Card } from '@insurtech/shared-ui';
import Link from 'next/link';

export default async function MesSinistresPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'sinistres.list' });

  return (
    <div className="px-4 py-6 max-w-md mx-auto space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-accent-500">{t('subtitle')}</p>
      </header>

      <Link href={`/${locale}/declarer-sinistre`}>
        <Card className="p-4 bg-primary-500 active:scale-95 transition-transform">
          <span className="font-semibold">{t('actions.declareNew')}</span>
        </Card>
      </Link>

      <section aria-labelledby="ongoing-heading">
        <h2 id="ongoing-heading" className="text-base font-semibold mb-2">{t('ongoing')}</h2>
        <Card className="p-4">
          <p className="text-sm opacity-70">{t('emptyPlaceholder')}</p>
          <p className="text-xs mt-2 italic opacity-50">{t('sprint25Notice')}</p>
        </Card>
      </section>

      <section aria-labelledby="archived-heading">
        <h2 id="archived-heading" className="text-base font-semibold mb-2">{t('archived')}</h2>
        <Card className="p-4">
          <p className="text-sm opacity-70">{t('emptyPlaceholder')}</p>
        </Card>
      </section>
    </div>
  );
}
```

### 6.10 `apps/web-assure-mobile/src/app/[locale]/profil/page.tsx`

```typescript
import { getTranslations } from 'next-intl/server';
import { Card } from '@insurtech/shared-ui';
import { Bell, Globe, LogOut, Shield, User } from 'lucide-react';

export default async function ProfilPage({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'profil' });

  return (
    <div className="px-4 py-6 max-w-md mx-auto space-y-3">
      <header>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </header>

      <Card className="p-4">
        <div className="flex items-center gap-3">
          <User className="h-10 w-10" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t('placeholderName')}</p>
            <p className="text-xs opacity-70">{t('sprint5Notice')}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2 flex items-center gap-2"><Bell className="h-4 w-4" />{t('notifications.title')}</h2>
        <p className="text-sm opacity-70">{t('notifications.placeholder')}</p>
        <p className="text-xs italic opacity-50 mt-2">{t('sprint9Notice')}</p>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2 flex items-center gap-2"><Globe className="h-4 w-4" />{t('language.title')}</h2>
        <p className="text-sm opacity-70">{t('language.current', { locale })}</p>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-2 flex items-center gap-2"><Shield className="h-4 w-4" />{t('privacy.title')}</h2>
        <p className="text-sm opacity-70">{t('privacy.cndp_loi_09_08')}</p>
      </Card>

      <Card className="p-4">
        <button className="flex items-center gap-2 text-red-500" type="button">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {t('logout')}
        </button>
      </Card>
    </div>
  );
}
```

### 6.11 `apps/web-assure-mobile/src/middleware.ts`

```typescript
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['fr', 'ar-MA', 'ar'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true
});

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
```

### 6.12 `apps/web-assure-mobile/src/i18n/request.ts`

```typescript
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export default getRequestConfig(async ({ locale }) => {
  if (!SUPPORTED_LOCALES.includes(locale as Locale)) notFound();

  const messages = (await import(`../messages/${locale}.json`)).default;
  return {
    messages,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    formats: {
      dateTime: {
        short: { day: 'numeric', month: 'short', year: 'numeric' }
      }
    }
  };
});
```

### 6.13 `apps/web-assure-mobile/src/messages/fr.json`

```json
{
  "metadata": {
    "title": "Skalean Mon Espace Mobile",
    "siteName": "Skalean Espace",
    "description": "Espace mobile assure -- declarer un sinistre, gerer mes polices"
  },
  "nav": {
    "accueil": "Accueil",
    "sinistres": "Sinistres",
    "polices": "Polices",
    "profil": "Profil"
  },
  "dashboard": {
    "welcome": "Bonjour",
    "subtitle": "Votre espace assure",
    "emergency": {
      "title": "Declarer un sinistre",
      "subtitle": "Acces rapide en cas d'accident"
    },
    "actions": { "policies": "Mes polices", "contact": "Nous contacter" },
    "alerts": { "title": "Alertes", "empty_placeholder": "Aucune alerte en cours" }
  },
  "sinistres": {
    "declarer": {
      "title": "Declaration de sinistre",
      "progress": "Etape {current} sur {total}",
      "stepsAriaLabel": "Etapes de declaration",
      "previous": "Precedent",
      "next": "Suivant",
      "sprint25Notice": "Cette etape sera implementee en Sprint 25",
      "steps": {
        "info": "Informations accident",
        "photos": "Photos",
        "lieu": "Lieu accident",
        "blesses": "Blesses",
        "temoins": "Temoins",
        "signature": "Signature"
      },
      "placeholder": {
        "info": "Date, heure, type d'accident, circonstances",
        "photos": "Prendre 6 photos guidees du vehicule et des degats",
        "lieu": "Geolocalisation automatique ou saisie manuelle de l'adresse",
        "blesses": "Liste des blesses eventuels et coordonnees medicales",
        "temoins": "Coordonnees des temoins presents",
        "signature": "Signature numerique de l'assure"
      }
    },
    "list": {
      "title": "Mes sinistres",
      "subtitle": "Suivi de vos declarations",
      "actions": { "declareNew": "Nouvelle declaration" },
      "ongoing": "En cours",
      "archived": "Archives",
      "emptyPlaceholder": "Aucun sinistre",
      "sprint25Notice": "Liste implementee en Sprint 25"
    }
  },
  "profil": {
    "title": "Profil",
    "placeholderName": "Assure Skalean",
    "sprint5Notice": "Authentification Sprint 5",
    "sprint9Notice": "Notifications Sprint 9",
    "notifications": { "title": "Notifications", "placeholder": "Activer les rappels paiement et alertes sinistres" },
    "language": { "title": "Langue", "current": "Langue actuelle : {locale}" },
    "privacy": { "title": "Confidentialite", "cndp_loi_09_08": "Vos donnees sont protegees selon la Loi 09-08 CNDP" },
    "logout": "Se deconnecter"
  },
  "offline": {
    "message": "Vous etes hors ligne. Vos actions seront synchronisees au retour de la connexion.",
    "sync": "Synchronisation en cours",
    "queue_length": "{count} action(s) en attente"
  },
  "install": {
    "prompt": "Installez Mon Espace pour declarer un sinistre en 1 tap",
    "ios_instructions": "Appuyez sur Partager puis Sur l'ecran d'accueil",
    "dismiss": "Plus tard",
    "accept": "Installer"
  },
  "permissions": {
    "camera": { "title": "Acces a la camera", "denied": "Acces refuse. Vous pouvez choisir une photo depuis votre gallerie." },
    "geolocation": { "title": "Acces a la position", "denied": "Acces refuse. Vous pouvez saisir l'adresse manuellement." },
    "notification": { "title": "Notifications", "later": "Activable plus tard depuis votre profil" }
  },
  "update": {
    "available": "Une nouvelle version est disponible",
    "reload": "Recharger"
  }
}
```

### 6.14 `apps/web-assure-mobile/src/messages/ar-MA.json`

```json
{
  "metadata": {
    "title": "Skalean Mon Espace Mobile",
    "siteName": "Skalean Espace",
    "description": "Espace mobile dyal l'assure -- t9adi haditha, gérer polices dyalek"
  },
  "nav": {
    "accueil": "Accueil",
    "sinistres": "Hawadit",
    "polices": "Polices",
    "profil": "Profil"
  },
  "dashboard": {
    "welcome": "Marhba",
    "subtitle": "Espace dyalek assure",
    "emergency": {
      "title": "T9adi haditha",
      "subtitle": "Wsoul sari3 fi 7alat l'accident"
    },
    "actions": { "policies": "Polices dyali", "contact": "Contactina" },
    "alerts": { "title": "Tanbihat", "empty_placeholder": "Ma kayn 7tta tanbih" }
  },
  "sinistres": {
    "declarer": {
      "title": "T9adi haditha",
      "progress": "Mar7ala {current} men {total}",
      "stepsAriaLabel": "Mara7il t9adi",
      "previous": "Sabi9",
      "next": "Tali",
      "sprint25Notice": "Hadi mar7ala ghadi t-implementi f Sprint 25",
      "steps": {
        "info": "Ma3lumat dyal accident",
        "photos": "Tsawer",
        "lieu": "Blasa dyal accident",
        "blesses": "Lmsabin",
        "temoins": "Shuhud",
        "signature": "Tawqi3"
      },
      "placeholder": {
        "info": "Tarikh, sa3a, naw3 accident, zuruf",
        "photos": "Khoud 6 tsawer dyal s-siyara w l'adrar",
        "lieu": "Blasa automatique wlla katbha b yedek",
        "blesses": "Lista dyal lmsabin w coordonnees dyalhom",
        "temoins": "Coordonnees dyal shuhud li kanou hadrin",
        "signature": "Tawqi3 numérique dyal l'assure"
      }
    },
    "list": {
      "title": "Hawadit dyali",
      "subtitle": "Tatabu3 dyal d-déclarations",
      "actions": { "declareNew": "Déclaration jdida" },
      "ongoing": "Fi t-ta9addum",
      "archived": "Archive",
      "emptyPlaceholder": "Ma kayn 7tta haditha",
      "sprint25Notice": "Lista ghadi t-implementi f Sprint 25"
    }
  },
  "profil": {
    "title": "Profil",
    "placeholderName": "Assure Skalean",
    "sprint5Notice": "Authentification f Sprint 5",
    "sprint9Notice": "Notifications f Sprint 9",
    "notifications": { "title": "Notifications", "placeholder": "Fa3al t-tanbihat dyal lkhalas w l-hawadit" },
    "language": { "title": "Loga", "current": "Loga 7aliya : {locale}" },
    "privacy": { "title": "Khososiya", "cndp_loi_09_08": "L-mu3tayat dyalek mahmiya 7sab Loi 09-08 CNDP" },
    "logout": "Khrooj"
  },
  "offline": {
    "message": "Nta khrij men l'connexion. L-3amaliyat dyalek ghadi tt-synchroniser mn jadid melli trj3 connexion.",
    "sync": "Synchronisation kat-tem",
    "queue_length": "{count} 3amaliya fi l-intidar"
  },
  "install": {
    "prompt": "Installi Mon Espace bash t9adi haditha b tap wahed",
    "ios_instructions": "Daghet Partage thuma Sur l'ecran d'accueil",
    "dismiss": "Mn b3d",
    "accept": "Installi"
  },
  "permissions": {
    "camera": { "title": "Wsoul l camera", "denied": "Wsoul mr-fud. T9der tkhtar tswira mn galerie." },
    "geolocation": { "title": "Wsoul l blasa", "denied": "Wsoul mr-fud. T9der tkteb l3unwan b yedek." },
    "notification": { "title": "Notifications", "later": "T9der tfa3alha mn b3d men profil dyalek" }
  },
  "update": {
    "available": "Kayn version jdida",
    "reload": "3awd t7mil"
  }
}
```

### 6.15 `apps/web-assure-mobile/src/messages/ar.json`

```json
{
  "metadata": {
    "title": "سكاليان فضائي المحمول",
    "siteName": "سكاليان فضائي",
    "description": "فضاء محمول للمؤمن له -- التصريح بحادثة، إدارة وثائق التأمين"
  },
  "nav": {
    "accueil": "الرئيسية",
    "sinistres": "الحوادث",
    "polices": "الوثائق",
    "profil": "الملف الشخصي"
  },
  "dashboard": {
    "welcome": "مرحبا",
    "subtitle": "فضاء المؤمن له",
    "emergency": {
      "title": "التصريح بحادثة",
      "subtitle": "وصول سريع في حالة الحادث"
    },
    "actions": { "policies": "وثائقي", "contact": "اتصل بنا" },
    "alerts": { "title": "التنبيهات", "empty_placeholder": "لا يوجد تنبيه" }
  },
  "sinistres": {
    "declarer": {
      "title": "التصريح بحادثة",
      "progress": "الخطوة {current} من {total}",
      "stepsAriaLabel": "خطوات التصريح",
      "previous": "السابق",
      "next": "التالي",
      "sprint25Notice": "هذه الخطوة سيتم تنفيذها في Sprint 25",
      "steps": {
        "info": "معلومات الحادث",
        "photos": "الصور",
        "lieu": "مكان الحادث",
        "blesses": "المصابون",
        "temoins": "الشهود",
        "signature": "التوقيع"
      },
      "placeholder": {
        "info": "التاريخ والوقت ونوع الحادث والظروف",
        "photos": "التقط 6 صور للسيارة والأضرار",
        "lieu": "تحديد الموقع تلقائيا أو إدخال العنوان يدويا",
        "blesses": "قائمة المصابين والمعلومات الطبية",
        "temoins": "معلومات الشهود الحاضرين",
        "signature": "التوقيع الرقمي للمؤمن له"
      }
    },
    "list": {
      "title": "حوادثي",
      "subtitle": "متابعة التصريحات",
      "actions": { "declareNew": "تصريح جديد" },
      "ongoing": "قيد المعالجة",
      "archived": "الأرشيف",
      "emptyPlaceholder": "لا توجد حوادث",
      "sprint25Notice": "القائمة سيتم تنفيذها في Sprint 25"
    }
  },
  "profil": {
    "title": "الملف الشخصي",
    "placeholderName": "مؤمن سكاليان",
    "sprint5Notice": "المصادقة في Sprint 5",
    "sprint9Notice": "الإشعارات في Sprint 9",
    "notifications": { "title": "الإشعارات", "placeholder": "تفعيل تذكيرات الدفع وتنبيهات الحوادث" },
    "language": { "title": "اللغة", "current": "اللغة الحالية : {locale}" },
    "privacy": { "title": "الخصوصية", "cndp_loi_09_08": "بياناتك محمية وفقا للقانون 09-08 للهيئة الوطنية لحماية المعطيات الشخصية" },
    "logout": "تسجيل الخروج"
  },
  "offline": {
    "message": "أنت غير متصل بالإنترنت. ستتم مزامنة عملياتك عند عودة الاتصال.",
    "sync": "المزامنة جارية",
    "queue_length": "{count} عملية في الانتظار"
  },
  "install": {
    "prompt": "ثبت فضائي المحمول للتصريح بحادثة بنقرة واحدة",
    "ios_instructions": "اضغط على مشاركة ثم على الشاشة الرئيسية",
    "dismiss": "لاحقا",
    "accept": "تثبيت"
  },
  "permissions": {
    "camera": { "title": "الوصول إلى الكاميرا", "denied": "تم رفض الوصول. يمكنك اختيار صورة من معرض الصور." },
    "geolocation": { "title": "الوصول إلى الموقع", "denied": "تم رفض الوصول. يمكنك إدخال العنوان يدويا." },
    "notification": { "title": "الإشعارات", "later": "يمكن تفعيلها لاحقا من الملف الشخصي" }
  },
  "update": {
    "available": "إصدار جديد متاح",
    "reload": "إعادة التحميل"
  }
}
```

### 6.16 `apps/web-assure-mobile/src/components/PwaInstallBanner.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useInstallPrompt } from '@insurtech/shared-pwa';
import { Button } from '@insurtech/shared-ui';
import { Download, X } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export function PwaInstallBanner() {
  const t = useTranslations('install');
  const { canPrompt, prompt, isIOS } = useInstallPrompt();
  const [hidden, setHidden] = useState<boolean>(true);
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let dismissedAt: string | null = null;
    try {
      dismissedAt = window.localStorage.getItem(DISMISS_KEY);
    } catch {
      dismissedAt = null;
    }
    const recentlyDismissed = dismissedAt && Date.now() - parseInt(dismissedAt, 10) < DISMISS_DURATION_MS;
    if (!recentlyDismissed && (canPrompt || isIOS)) {
      const timer = setTimeout(() => setHidden(false), 30_000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [canPrompt, isIOS]);

  const handleDismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {
      // ignore (private mode)
    }
  };

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }
    const result = await prompt();
    if (result === 'accepted' || result === 'dismissed') handleDismiss();
  };

  if (hidden) return null;

  return (
    <>
      <div
        className="fixed bottom-20 inset-x-0 mx-3 mb-2 bg-primary-500 border border-accent-500 rounded-lg p-3 shadow-lg z-40 animate-slide-up"
        role="dialog"
        aria-labelledby="install-banner-title"
      >
        <div className="flex items-start gap-3">
          <Download className="h-6 w-6 shrink-0 mt-1" aria-hidden="true" />
          <div className="flex-1 text-sm">
            <p id="install-banner-title" className="font-semibold mb-2">{t('prompt')}</p>
            <div className="flex gap-2">
              <Button onClick={handleInstall} variant="primary" size="sm">{t('accept')}</Button>
              <Button onClick={handleDismiss} variant="ghost" size="sm">{t('dismiss')}</Button>
            </div>
          </div>
          <button onClick={handleDismiss} aria-label={t('dismiss')} className="p-1">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {showIOSModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-instructions-title"
          onClick={() => setShowIOSModal(false)}
        >
          <div className="bg-primary-900 border border-accent-500 rounded-lg p-5 max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 id="ios-instructions-title" className="font-bold text-lg mb-3">{t('ios_instructions')}</h2>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Tap Share button</li>
              <li>Scroll and tap Add to Home Screen</li>
              <li>Tap Add</li>
            </ol>
            <Button onClick={() => setShowIOSModal(false)} className="mt-4 w-full">OK</Button>
          </div>
        </div>
      )}
    </>
  );
}
```

### 6.17 `apps/web-assure-mobile/src/components/OfflineBanner.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { useOnlineStatus } from '@insurtech/shared-pwa';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const t = useTranslations('offline');
  const { online, queueLength } = useOnlineStatus();

  if (online && queueLength === 0) return null;

  const isSyncing = online && queueLength > 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 inset-x-0 z-50 px-4 py-2 text-sm font-medium text-center ${
        isSyncing ? 'bg-accent-500 text-primary-900' : 'bg-yellow-400 text-primary-900'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        <WifiOff className="h-4 w-4" aria-hidden="true" />
        <span>{isSyncing ? t('sync') : t('message')}</span>
        {queueLength > 0 && <span className="font-bold">({t('queue_length', { count: queueLength })})</span>}
      </div>
    </div>
  );
}
```

### 6.18 `apps/web-assure-mobile/src/components/UpdateAvailableBanner.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { useServiceWorker } from '@insurtech/shared-pwa';
import { Button } from '@insurtech/shared-ui';
import { RefreshCcw } from 'lucide-react';

export function UpdateAvailableBanner() {
  const t = useTranslations('update');
  const { updateAvailable, applyUpdate } = useServiceWorker();

  if (!updateAvailable) return null;

  return (
    <div
      className="fixed bottom-20 inset-x-0 mx-3 mb-2 bg-accent-500 text-primary-900 border-2 border-primary-500 rounded-lg p-3 shadow-lg z-40"
      role="alertdialog"
      aria-labelledby="update-banner-title"
    >
      <div className="flex items-center gap-3">
        <RefreshCcw className="h-5 w-5 shrink-0" aria-hidden="true" />
        <div className="flex-1">
          <p id="update-banner-title" className="font-semibold text-sm">{t('available')}</p>
        </div>
        <Button onClick={applyUpdate} size="sm" variant="primary">{t('reload')}</Button>
      </div>
    </div>
  );
}
```

### 6.19 `apps/web-assure-mobile/src/components/CameraCapture.tsx`

```typescript
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@insurtech/shared-ui';
import { Camera, ImagePlus, AlertTriangle } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  maxSizeBytes?: number;
}

type State = 'idle' | 'requesting' | 'streaming' | 'denied' | 'unavailable';

export function CameraCapture({
  onCapture,
  maxSizeBytes = parseInt(process.env.NEXT_PUBLIC_PHOTO_MAX_SIZE_MB ?? '10', 10) * 1024 * 1024
}: CameraCaptureProps) {
  const t = useTranslations('permissions.camera');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const startCamera = async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }
    setState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('streaming');
    } catch (err) {
      const errorName = (err as { name?: string }).name;
      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setState('denied');
      } else {
        setState('unavailable');
      }
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const compressionQuality = parseFloat(process.env.NEXT_PUBLIC_PHOTO_COMPRESSION_QUALITY ?? '0.8');
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (blob.size > maxSizeBytes) {
          // TODO Sprint 13 : compression iterative jusqu'a maxSizeBytes via browser-image-compression
          return;
        }
        onCapture(blob);
        if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
        setState('idle');
      },
      'image/jpeg',
      compressionQuality
    );
  };

  const handleFileFallback = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) onCapture(file);
  };

  return (
    <div className="space-y-3" data-testid="camera-capture">
      {state === 'streaming' && (
        <>
          <video ref={videoRef} className="w-full rounded-lg" playsInline muted aria-label="Aperçu camera" />
          <Button onClick={capturePhoto} className="w-full">
            <Camera className="h-4 w-4 mr-2" aria-hidden="true" /> Capturer
          </Button>
        </>
      )}

      {(state === 'idle' || state === 'requesting') && (
        <Button onClick={startCamera} disabled={state === 'requesting'} className="w-full">
          <Camera className="h-4 w-4 mr-2" aria-hidden="true" />
          {state === 'requesting' ? '...' : t('title')}
        </Button>
      )}

      {(state === 'denied' || state === 'unavailable') && (
        <div className="space-y-2 p-3 bg-yellow-100 text-yellow-900 rounded-lg" role="alert">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {t('denied')}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileFallback}
            className="hidden"
            aria-label="Choisir une photo"
          />
          <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="w-full">
            <ImagePlus className="h-4 w-4 mr-2" aria-hidden="true" /> Galerie
          </Button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
```

### 6.20 `apps/web-assure-mobile/src/components/GeolocationPicker.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@insurtech/shared-ui';
import { MapboxSearchBox } from '@insurtech/shared-maps';
import { MapPin, Search, AlertTriangle } from 'lucide-react';

interface Position {
  lat: number;
  lng: number;
  accuracy?: number;
  source: 'gps' | 'manual';
  address?: string;
}

interface GeolocationPickerProps {
  onPick: (pos: Position) => void;
}

type State = 'idle' | 'requesting' | 'denied' | 'unavailable' | 'manual';

export function GeolocationPicker({ onPick }: GeolocationPickerProps) {
  const t = useTranslations('permissions.geolocation');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState<string | null>(null);

  const requestGPS = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('unavailable');
      return;
    }
    setState('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPick({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'gps'
        });
        setState('idle');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState('denied');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError('Signal GPS indisponible');
          setState('manual');
        } else if (err.code === err.TIMEOUT) {
          setError('Signal GPS faible -- essayez l\'adresse manuelle');
          setState('manual');
        } else {
          setState('unavailable');
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  };

  const handleManualAddress = (suggestion: { lat: number; lng: number; label: string }) => {
    onPick({ lat: suggestion.lat, lng: suggestion.lng, source: 'manual', address: suggestion.label });
    setState('idle');
  };

  return (
    <div className="space-y-3" data-testid="geolocation-picker">
      {state === 'idle' && (
        <Button onClick={requestGPS} className="w-full">
          <MapPin className="h-4 w-4 mr-2" aria-hidden="true" /> {t('title')}
        </Button>
      )}

      {state === 'requesting' && <p className="text-sm">Recherche position...</p>}

      {(state === 'denied' || state === 'manual') && (
        <div className="space-y-2 p-3 bg-yellow-100 text-yellow-900 rounded-lg" role="alert">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {error ?? t('denied')}
          </div>
          <MapboxSearchBox
            placeholder="Casablanca, Avenue Hassan II"
            country="ma"
            language="fr"
            onSelect={handleManualAddress}
          />
        </div>
      )}

      {state === 'unavailable' && (
        <div className="p-3 bg-red-100 text-red-900 rounded-lg" role="alert">
          GPS indisponible sur cet appareil
        </div>
      )}

      <Button variant="ghost" onClick={() => setState('manual')} className="w-full text-xs">
        <Search className="h-4 w-4 mr-2" aria-hidden="true" /> Saisir adresse manuellement
      </Button>
    </div>
  );
}
```

### 6.21 `apps/web-assure-mobile/src/lib/register-sw.ts`

```typescript
'use client';

import { getStorageEstimate } from '@insurtech/shared-pwa';

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;
  if (!('serviceWorker' in navigator)) return null;
  if (process.env.NODE_ENV !== 'production') return null;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

    const estimate = await getStorageEstimate();
    if (estimate.quota - estimate.usage < 100 * 1024 * 1024) {
      console.warn('[SW] Storage low : ', estimate);
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (installing) {
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('sw:update-available'));
          }
        });
      }
    });

    return registration;
  } catch (err) {
    console.error('[SW] Registration failed', err);
    return null;
  }
}
```

### 6.22 `apps/web-assure-mobile/src/lib/api-client.ts`

```typescript
import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { v4 as uuid } from 'uuid';
import { enqueueOfflineRequest, flushOfflineQueue } from '@insurtech/shared-pwa';

interface SerializedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  data?: unknown;
}

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.skalean-insurtech.ma';

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 15_000,
  withCredentials: true
});

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const tenantId = (typeof window !== 'undefined' && window.localStorage.getItem('tenantId')) || '';
  const userId = (typeof window !== 'undefined' && window.localStorage.getItem('userId')) || '';
  const token = (typeof window !== 'undefined' && window.localStorage.getItem('jwt')) || '';

  config.headers.set('x-tenant-id', tenantId);
  config.headers.set('x-user-id', userId);
  config.headers.set('x-trace-id', uuid());
  if (token) config.headers.set('Authorization', `Bearer ${token}`);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const writeMethods = ['post', 'put', 'patch', 'delete'];
    if (writeMethods.includes((config.method ?? 'get').toLowerCase())) {
      const serialized: SerializedRequest = {
        url: `${config.baseURL ?? ''}${config.url ?? ''}`,
        method: config.method ?? 'get',
        headers: Object.fromEntries(
          Object.entries(config.headers.toJSON() ?? {}).map(([k, v]) => [k, String(v)])
        ),
        data: config.data
      };
      await enqueueOfflineRequest(serialized);
      const error = new AxiosError('Request enqueued offline', 'OFFLINE_QUEUED');
      throw error;
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.localStorage.removeItem('jwt');
      window.location.href = '/fr/auth/login';
    }
    return Promise.reject(error);
  }
);

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOfflineQueue().catch((err) => console.error('[api-client] flush error', err));
  });
}

export type { SerializedRequest };
```

### 6.23 `apps/web-assure-mobile/src/lib/query-client.ts`

```typescript
import { QueryClient } from '@tanstack/react-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { idbStorage } from './idb';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => {
        const status = (error as { response?: { status?: number } }).response?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
        return failureCount < 3;
      },
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    },
    mutations: {
      retry: 0,
      networkMode: 'offlineFirst'
    }
  }
});

if (typeof window !== 'undefined') {
  const persister = createAsyncStoragePersister({
    storage: idbStorage,
    key: 'reactquery-cache-assure-mobile-v1'
  });
  persistQueryClient({
    queryClient,
    persister,
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}
```

### 6.24 `apps/web-assure-mobile/src/lib/idb.ts`

```typescript
import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'web-assure-mobile-v1';
const DB_VERSION = 1;

export interface OutboxRecord {
  id?: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  createdAt: number;
  retries: number;
}

export interface SinistreDraft {
  id: string;
  tenantId: string;
  userId: string;
  step: number;
  data: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface PhotoBlob {
  id: string;
  sinistreId: string;
  blob: Blob;
  mimeType: string;
  createdAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('outbox')) {
          db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
          photoStore.createIndex('by-sinistre', 'sinistreId');
        }
        if (!db.objectStoreNames.contains('kv')) {
          db.createObjectStore('kv');
        }
      }
    });
  }
  return dbPromise;
}

export const idbStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const db = await getDB();
    return (await db.get('kv', key)) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    const db = await getDB();
    await db.put('kv', value, key);
  },
  removeItem: async (key: string): Promise<void> => {
    const db = await getDB();
    await db.delete('kv', key);
  }
};

export async function clearAllAssureMobileData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('outbox'),
    db.clear('drafts'),
    db.clear('photos'),
    db.clear('kv')
  ]);
}
```

### 6.25 `apps/web-assure-mobile/src/components/providers.tsx`

```typescript
'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useEffect } from 'react';
import { queryClient } from '@/lib/query-client';
import { registerServiceWorker } from '@/lib/register-sw';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      registerServiceWorker().catch((err) => console.error('SW registration error', err));
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

### 6.26 `apps/web-assure-mobile/src/lib/theme-colors.ts`

```typescript
export const THEME_COLORS = {
  assureMobile: {
    statusBar: '#2D5773',
    background: '#1A2730',
    accent: '#B0CEE2',
    warning: '#FFB100',
    danger: '#E53935',
    success: '#4CAF50'
  }
} as const;

export type ThemeKey = keyof typeof THEME_COLORS;
```

### 6.27 `apps/web-assure-mobile/.env.example`

```bash
# === API ===
NEXT_PUBLIC_API_URL=https://api.skalean-insurtech.ma
NEXT_PUBLIC_API_VERSION=v1
NEXT_PUBLIC_API_TIMEOUT_MS=15000

# === Atlas Cloud ===
NEXT_PUBLIC_CDN_URL=https://cdn.atlas-cloud.ma
NEXT_PUBLIC_PHOTOS_BUCKET=skalean-sinistres-photos

# === PWA ===
NEXT_PUBLIC_APP_NAME=Skalean Mon Espace Mobile
NEXT_PUBLIC_THEME_COLOR=#2D5773
NEXT_PUBLIC_BACKGROUND_COLOR=#1A2730

# === Offline / Storage ===
NEXT_PUBLIC_OFFLINE_QUEUE_MAX_SIZE_MB=50
NEXT_PUBLIC_PHOTO_MAX_SIZE_MB=10
NEXT_PUBLIC_PHOTO_COMPRESSION_QUALITY=0.8
NEXT_PUBLIC_PHOTO_MAX_WIDTH=1920
NEXT_PUBLIC_PHOTO_MAX_HEIGHT=1080

# === Push Notifications (Sprint 9) ===
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
NEXT_PUBLIC_PUSH_ENABLED=false

# === Maps (shared-maps) ===
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_MAPBOX_DEFAULT_CENTER_LAT=33.5731
NEXT_PUBLIC_MAPBOX_DEFAULT_CENTER_LNG=-7.5898

# === Conformite ===
NEXT_PUBLIC_CNDP_DECLARATION_NUMBER=
NEXT_PUBLIC_ACAPS_AGREMENT_NUMBER=
```

### 6.28 `apps/web-assure-mobile/src/app/globals.css`

```css
@import 'tailwindcss';

:root {
  --color-primary: #2D5773;
  --color-accent: #B0CEE2;
  --color-bg: #1A2730;
}

html, body {
  background: var(--color-bg);
  color: white;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior-y: contain;
}

body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

[dir="rtl"] .lucide { transform: scaleX(-1); }

@keyframes slide-up { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.animate-slide-up { animation: slide-up 0.3s ease-out; }
```

---

## 7. TESTS COMPLETS (18-22 tests)

### 7.1 `tests/unit/PwaInstallBanner.spec.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PwaInstallBanner } from '@/components/PwaInstallBanner';

vi.mock('@insurtech/shared-pwa', () => ({
  useInstallPrompt: () => ({
    canPrompt: true,
    prompt: vi.fn().mockResolvedValue('accepted'),
    isIOS: false,
    dismissed: false
  })
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k
}));

describe('PwaInstallBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  it('shows banner after 30s engagement when not dismissed', async () => {
    render(<PwaInstallBanner />);
    expect(screen.queryByRole('dialog')).toBeNull();
    vi.advanceTimersByTime(30_000);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('does not show when localStorage dismissed within 7 days', () => {
    window.localStorage.setItem('pwa-install-dismissed-at', Date.now().toString());
    render(<PwaInstallBanner />);
    vi.advanceTimersByTime(60_000);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('persists dismissal on close button click', async () => {
    render(<PwaInstallBanner />);
    vi.advanceTimersByTime(30_000);
    const closeBtn = await screen.findByLabelText('dismiss');
    fireEvent.click(closeBtn);
    expect(window.localStorage.getItem('pwa-install-dismissed-at')).toBeTruthy();
  });
});
```

### 7.2 `tests/unit/OfflineBanner.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfflineBanner } from '@/components/OfflineBanner';

const mockHook = vi.fn();
vi.mock('@insurtech/shared-pwa', () => ({ useOnlineStatus: () => mockHook() }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

describe('OfflineBanner', () => {
  it('hides when online and queue empty', () => {
    mockHook.mockReturnValue({ online: true, queueLength: 0 });
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows offline message when offline', () => {
    mockHook.mockReturnValue({ online: false, queueLength: 0 });
    render(<OfflineBanner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('message')).toBeInTheDocument();
  });

  it('shows sync state when online with queue pending', () => {
    mockHook.mockReturnValue({ online: true, queueLength: 3 });
    render(<OfflineBanner />);
    expect(screen.getByText('sync')).toBeInTheDocument();
  });
});
```

### 7.3 `tests/unit/UpdateAvailableBanner.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateAvailableBanner } from '@/components/UpdateAvailableBanner';

const applyUpdate = vi.fn();
const mockHook = vi.fn();
vi.mock('@insurtech/shared-pwa', () => ({ useServiceWorker: () => mockHook() }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

describe('UpdateAvailableBanner', () => {
  it('hides when no update available', () => {
    mockHook.mockReturnValue({ updateAvailable: false, applyUpdate });
    const { container } = render(<UpdateAvailableBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('shows banner and triggers reload', () => {
    mockHook.mockReturnValue({ updateAvailable: true, applyUpdate });
    render(<UpdateAvailableBanner />);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByText('reload'));
    expect(applyUpdate).toHaveBeenCalled();
  });
});
```

### 7.4 `tests/unit/api-client.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/api-client';

const enqueue = vi.fn().mockResolvedValue(undefined);
const flush = vi.fn().mockResolvedValue({ success: 0, failed: 0 });
vi.mock('@insurtech/shared-pwa', () => ({
  enqueueOfflineRequest: (...args: unknown[]) => enqueue(...args),
  flushOfflineQueue: (...args: unknown[]) => flush(...args)
}));

describe('api-client offline queue', () => {
  beforeEach(() => {
    enqueue.mockClear();
    flush.mockClear();
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true });
    window.localStorage.setItem('tenantId', 'tenant-1');
    window.localStorage.setItem('userId', 'user-1');
  });

  it('enqueues POST when offline', async () => {
    try {
      await apiClient.post('/api/v1/sinistres', { date: '2026-05-05' });
    } catch (err) {
      expect((err as { code?: string }).code).toBe('OFFLINE_QUEUED');
    }
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('does not enqueue GET when offline', async () => {
    try {
      await apiClient.get('/api/v1/sinistres');
    } catch {
      // network error expected
    }
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('flushes queue on online event', () => {
    Object.defineProperty(navigator, 'onLine', { value: true });
    window.dispatchEvent(new Event('online'));
    expect(flush).toHaveBeenCalled();
  });
});
```

### 7.5 `tests/unit/idb.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getDB, idbStorage, clearAllAssureMobileData } from '@/lib/idb';

describe('idb wrapper', () => {
  beforeEach(async () => {
    await clearAllAssureMobileData();
  });

  it('initializes object stores', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains('outbox')).toBe(true);
    expect(db.objectStoreNames.contains('drafts')).toBe(true);
    expect(db.objectStoreNames.contains('photos')).toBe(true);
    expect(db.objectStoreNames.contains('kv')).toBe(true);
  });

  it('stores and retrieves kv items via idbStorage', async () => {
    await idbStorage.setItem('foo', 'bar');
    const value = await idbStorage.getItem('foo');
    expect(value).toBe('bar');
  });

  it('removes kv items', async () => {
    await idbStorage.setItem('x', '1');
    await idbStorage.removeItem('x');
    expect(await idbStorage.getItem('x')).toBeNull();
  });

  it('clearAllAssureMobileData clears all stores', async () => {
    await idbStorage.setItem('a', 'b');
    await clearAllAssureMobileData();
    expect(await idbStorage.getItem('a')).toBeNull();
  });
});
```

### 7.6 `tests/unit/CameraCapture.spec.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CameraCapture } from '@/components/CameraCapture';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const getUserMediaMock = vi.fn();

describe('CameraCapture', () => {
  beforeEach(() => {
    getUserMediaMock.mockReset();
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: getUserMediaMock },
      configurable: true
    });
  });

  it('renders idle state with camera button', () => {
    const onCapture = vi.fn();
    render(<CameraCapture onCapture={onCapture} />);
    expect(screen.getByText('title')).toBeInTheDocument();
  });

  it('falls back to file upload when permission denied', async () => {
    const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    getUserMediaMock.mockRejectedValue(err);
    render(<CameraCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByText('title'));
    await waitFor(() => expect(screen.getByText('denied')).toBeInTheDocument());
  });

  it('handles unavailable mediaDevices', () => {
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
    render(<CameraCapture onCapture={vi.fn()} />);
    fireEvent.click(screen.getByText('title'));
    waitFor(() => expect(screen.getByText('denied')).toBeInTheDocument());
  });
});
```

### 7.7 `tests/unit/GeolocationPicker.spec.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GeolocationPicker } from '@/components/GeolocationPicker';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('@insurtech/shared-maps', () => ({
  MapboxSearchBox: ({ onSelect }: { onSelect: (s: { lat: number; lng: number; label: string }) => void }) => (
    <button onClick={() => onSelect({ lat: 33.57, lng: -7.58, label: 'Casa' })}>mock-search</button>
  )
}));

const getCurrentPosition = vi.fn();
const PERMISSION_DENIED = 1;

describe('GeolocationPicker', () => {
  beforeEach(() => {
    getCurrentPosition.mockReset();
    Object.defineProperty(navigator, 'geolocation', {
      value: { getCurrentPosition },
      configurable: true
    });
  });

  it('calls onPick with GPS coordinates on success', async () => {
    getCurrentPosition.mockImplementation((success) =>
      success({ coords: { latitude: 33.57, longitude: -7.58, accuracy: 10 } })
    );
    const onPick = vi.fn();
    render(<GeolocationPicker onPick={onPick} />);
    fireEvent.click(screen.getByText('title'));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ source: 'gps' })));
  });

  it('shows manual fallback when permission denied', async () => {
    getCurrentPosition.mockImplementation((_s, error) =>
      error({ code: PERMISSION_DENIED, PERMISSION_DENIED, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
    );
    render(<GeolocationPicker onPick={vi.fn()} />);
    fireEvent.click(screen.getByText('title'));
    await waitFor(() => expect(screen.getByText('mock-search')).toBeInTheDocument());
  });

  it('manual address selection triggers onPick with manual source', async () => {
    const onPick = vi.fn();
    render(<GeolocationPicker onPick={onPick} />);
    fireEvent.click(screen.getByText(/manuellement/i));
    fireEvent.click(screen.getByText('mock-search'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ source: 'manual' }));
  });
});
```

### 7.8 `tests/unit/register-sw.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@insurtech/shared-pwa', () => ({
  getStorageEstimate: vi.fn().mockResolvedValue({ usage: 1_000_000, quota: 200_000_000, percent: 0.5 })
}));

describe('register-sw', () => {
  const register = vi.fn();

  beforeEach(() => {
    register.mockReset();
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { register, controller: null },
      configurable: true
    });
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
  });

  it('returns null in development', async () => {
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'development', configurable: true });
    const { registerServiceWorker } = await import('@/lib/register-sw');
    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });

  it('returns null when serviceWorker not supported', async () => {
    Object.defineProperty(navigator, 'serviceWorker', { value: undefined, configurable: true });
    const { registerServiceWorker } = await import('@/lib/register-sw');
    const result = await registerServiceWorker();
    expect(result).toBeNull();
  });
});
```

### 7.9 `tests/unit/theme-colors.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { THEME_COLORS } from '@/lib/theme-colors';

describe('theme-colors', () => {
  it('exports ACAPS Teal as status bar color', () => {
    expect(THEME_COLORS.assureMobile.statusBar).toBe('#2D5773');
  });

  it('exports Skalean Navy background', () => {
    expect(THEME_COLORS.assureMobile.background).toBe('#1A2730');
  });

  it('exports Sky Blue accent', () => {
    expect(THEME_COLORS.assureMobile.accent).toBe('#B0CEE2');
  });
});
```

### 7.10 Tests Playwright e2e `tests/e2e/pwa.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.describe('web-assure-mobile PWA', () => {
  test('manifest is valid and accessible', async ({ page }) => {
    await page.goto('/fr');
    const response = await page.request.get('/manifest.webmanifest');
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toContain('application/manifest+json');
    const manifest = await response.json();
    expect(manifest.theme_color).toBe('#2D5773');
    expect(manifest.background_color).toBe('#1A2730');
    expect(manifest.start_url).toBe('/fr');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.orientation).toBe('portrait');
    expect(manifest.shortcuts).toHaveLength(2);
    expect(manifest.shortcuts[0].url).toBe('/fr/declarer-sinistre');
  });

  test('theme-color meta tag matches manifest', async ({ page }) => {
    await page.goto('/fr');
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#2D5773');
  });

  test('viewport-fit cover for iOS notch', async ({ page }) => {
    await page.goto('/fr');
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toContain('viewport-fit=cover');
  });

  test('apple-web-app meta tags present', async ({ page }) => {
    await page.goto('/fr');
    expect(await page.locator('meta[name="apple-mobile-web-app-capable"]').getAttribute('content')).toBe('yes');
    expect(await page.locator('meta[name="apple-mobile-web-app-status-bar-style"]').getAttribute('content')).toBe('black-translucent');
  });

  test('BottomTabs visible mobile viewport', async ({ browser }) => {
    const ctx = await browser.newContext({ ...devices['Pixel 5'] });
    const page = await ctx.newPage();
    await page.goto('/fr');
    await expect(page.getByRole('navigation', { name: /tabs/i })).toBeVisible();
    await ctx.close();
  });

  test('declarer-sinistre 6 step wizard navigates', async ({ page }) => {
    await page.goto('/fr/declarer-sinistre');
    await expect(page.getByText(/etape 1/i)).toBeVisible();
    await page.getByText(/suivant/i).click();
    await expect(page.getByText(/etape 2/i)).toBeVisible();
  });

  test('offline mode reload still loads from cache (prod build)', async ({ page, context }) => {
    test.skip(process.env.NODE_ENV !== 'production', 'SW registered only in prod');
    await page.goto('/fr');
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('body')).toBeVisible();
  });

  test('service worker registered in prod', async ({ page }) => {
    test.skip(process.env.NODE_ENV !== 'production', 'SW registered only in prod');
    await page.goto('/fr');
    const isControlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    expect(isControlled).toBe(true);
  });
});
```

### 7.11 `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3006',
    trace: 'on-first-retry',
    locale: 'fr-FR',
    timezoneId: 'Africa/Casablanca'
  },
  projects: [
    { name: 'chromium-mobile', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } }
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3006/fr',
    timeout: 120_000,
    reuseExistingServer: !process.env.CI
  }
});
```

---

## 8. VARIABLES ENVIRONNEMENT

15+ vars `NEXT_PUBLIC_*` documentees dans `.env.example` (section 6.27). Categories :

- API (URL, version, timeout)
- Atlas Cloud souverain (CDN, photos bucket)
- PWA branding (name, theme color, background)
- Offline / Storage (queue max size, photo max size, compression quality, max width/height)
- Push notifications Sprint 9 (VAPID public key, enabled flag)
- Maps (Mapbox token, default center Casablanca lat/lng)
- Conformite (CNDP declaration number, ACAPS agrement number)

---

## 9. COMMANDES SHELL

```bash
# Installation
cd repo
pnpm install
pnpm --filter @insurtech/web-assure-mobile add next-pwa@5.6.0 -D --ignore-peer-deps

# Dev
pnpm --filter @insurtech/web-assure-mobile dev
# ouvre http://localhost:3006/fr

# Build prod
pnpm --filter @insurtech/web-assure-mobile build
pnpm --filter @insurtech/web-assure-mobile start

# Tests
pnpm --filter @insurtech/web-assure-mobile lint
pnpm --filter @insurtech/web-assure-mobile typecheck
pnpm --filter @insurtech/web-assure-mobile test
pnpm --filter @insurtech/web-assure-mobile test:e2e

# Audits PWA
pnpm --filter @insurtech/web-assure-mobile lighthouse:pwa
pnpm --filter @insurtech/web-assure-mobile manifest:validate
pnpm --filter @insurtech/web-assure-mobile sw:audit

# Validation manuelle DevTools Chrome
# 1. ouvrir DevTools > Application > Manifest -> verifier sans erreur
# 2. ouvrir Service Workers -> "activated and is running"
# 3. ouvrir Cache Storage -> caches precache-v2-* et runtime-* presents
# 4. ouvrir IndexedDB -> "web-assure-mobile-v1" avec stores outbox/drafts/photos/kv
# 5. ouvrir Network > Offline -> reload page -> doit charger depuis cache

# Lighthouse manuel
npx lighthouse http://localhost:3006/fr --view --preset=desktop --only-categories=pwa
```

---

## 10. CRITERES VALIDATION V1-V30

### P0 (15+ obligatoires)

- **V1** : `pnpm --filter @insurtech/web-assure-mobile dev` demarre sur port 3006 sans erreur, accessible `http://localhost:3006/fr`, `http://localhost:3006/ar-MA`, `http://localhost:3006/ar`.
- **V2** : Manifest valide via Chrome DevTools API `Application > Manifest` zero erreur, theme_color `#2D5773`, start_url `/fr`, scope `/`, display standalone, orientation portrait.
- **V3** : Service worker enregistre actif en build prod : `navigator.serviceWorker.controller !== null` et `activated and is running` dans DevTools.
- **V4** : Install prompt fires apres interaction utilisateur sur Chromium mobile : `beforeinstallprompt` event capte par `useInstallPrompt`, banniere visible apres 30s.
- **V5** : Offline mode fonctionne : `context.setOffline(true)` + `page.reload()` -> page se charge depuis cache SW + IndexedDB.
- **V6** : Lighthouse PWA score >= 90 baseline (cible Sprint 24 : >= 95) via `pnpm lighthouse:pwa`.
- **V7** : Theme color `#2D5773` ACAPS Teal effectif sur status bar mobile installee, meta theme-color sync manifest.
- **V8** : Hooks consommes from `@insurtech/shared-pwa` : `useInstallPrompt`, `useOnlineStatus`, `useServiceWorker` (3 banners utilisent les hooks, pas de duplication code).
- **V9** : Viewport-fit=cover OK iPhone notch, safe-area-inset CSS applique padding top/bottom.
- **V10** : IndexedDB quota check au boot : `navigator.storage.estimate()` appele, warning si < 100 Mo libre.
- **V11** : BottomTabs mobile visible (3 tabs : Accueil / Sinistres / Profil), variant assure (couleur primary #2D5773).
- **V12** : 6-step wizard placeholder navigable : tap "Suivant" passe etape 1->2->3->4->5->6, tap "Precedent" inverse.
- **V13** : No emoji unicode dans tout le code source, tests, translations, README, commits (script grep CI verifie).
- **V14** : `pnpm typecheck` 0 erreur, `pnpm lint --max-warnings 0` 0 warning.
- **V15** : `pnpm build` succes : output `.next/standalone/`, `public/sw.js`, `public/workbox-*.js` generes sans erreur.

### P1 (8+)

- **V16** : Camera permission UX -- `getUserMedia` denied -> fallback `<input type="file" capture="environment">` visible.
- **V17** : GPS fallback manual -- `geolocation.PERMISSION_DENIED` -> Mapbox SearchBox autocomplete affiche.
- **V18** : Offline queue sync -- requete POST offline enqueue IndexedDB, retour online flush automatique.
- **V19** : Push notification placeholder -- VAPID public key env exposee, endpoint `/api/v1/push/subscribe` stub Sprint 9.
- **V20** : Photo compression client-side -- canvas `toBlob('image/jpeg', 0.8)` applique, taille < `NEXT_PUBLIC_PHOTO_MAX_SIZE_MB`.
- **V21** : Image cropping placeholder -- `react-image-crop` declare dans `package.json` Sprint 13.
- **V22** : Signature canvas placeholder -- `react-signature-canvas` declare dans `package.json` Sprint 11.
- **V23** : A2HS iOS instructions modal -- detection UA iOS, ouverture modal "Partager > Sur l'ecran d'accueil" 3 langues.

### P2 (5+)

- **V24** : Workbox runtime cache strategies documentees dans `next.config.mjs` (NetworkFirst api, CacheFirst static, SWR pages, NetworkOnly auth+payment).
- **V25** : IndexedDB indexes Sprint 25 -- `photos` store avec index `by-sinistre`.
- **V26** : Web push subscription Sprint 9 -- helper `subscribeUserToPush()` placeholder dans shared-pwa consume here.
- **V27** : Background sync API placeholder -- documente non-supporte iOS, fallback online event listener.
- **V28** : Periodic background sync placeholder -- documente Chrome only, evaluation Sprint 32.
- **V29** : Geofencing placeholder -- documente non-supporte web, native only Capacitor migration.
- **V30** : Multi-tenant L3 scoping -- IndexedDB stores namespaced `outbox-${tenantId}-${userId}`.

---

## 11. EDGE CASES + TROUBLESHOOTING (12)

1. **iOS Safari `beforeinstallprompt` not supported** -> show A2HS instructions modal manuel. Detection UA + Safari + `'standalone' in window.navigator` false. Modal animation gif placeholder Sprint 13.

2. **SW cache eviction iOS Safari aggressive 50 Mo limit** : eviction LRU silencieuse 7 jours. Mitigation : compress photos < 500 Ko, purger drafts ack serveur, message UX "Reconnectez-vous chaque semaine".

3. **manifest must be served Content-Type `application/manifest+json`** : Next.js par defaut OK mais Nginx / CloudFront peut retourner `application/octet-stream`. Header explicit configure dans `next.config.mjs` `headers()`.

4. **SW skipWaiting + clientsClaim coordination** : `skipWaiting: true` dans next-pwa active immediatement nouveau SW, mais sans `clientsClaim()` les onglets ouverts continuent ancien SW. Solution : `next-pwa` injecte clientsClaim auto, verifier dans `public/sw.js` genere.

5. **Push notification permission denied permanently (browser settings)** : impossible re-prompt. Mitigation : detect `Notification.permission === 'denied'` -> message "Activez les notifications dans les parametres du navigateur > Skalean > Notifications".

6. **Camera permission denied -> graceful fallback file upload from gallery** : `<input type="file" accept="image/*" capture="environment">` ouvre Photos native, pattern Pattern 14 reutilise.

7. **GPS permission denied -> manual address autocomplete via shared-maps SearchBox** : Mapbox Search Box API geocoding adresses Maroc avec country=ma, language=fr, fallback ar.

8. **Network flaky 3G/2G** (lieu accident signal faible) : timeout 5s NetworkFirst -> fallback cache. Si cache vide, message "Pas de reseau -- vos donnees seront synchronisees au retour".

9. **IndexedDB quota exceeded** -> `QuotaExceededError`. Mitigation : try/catch puts, warning UI "Espace plein -- supprimez d'anciens brouillons", purge automatique `db.delete('drafts', oldestId)`.

10. **Photo compression client-side (large originals 8 Mo iPhone HEIC)** : iPhone produit HEIC par defaut, backend Sprint 25 ne decode pas. Conversion canvas `toBlob('image/jpeg', 0.8)` systematique. HEIC->JPEG lossy mais acceptable pour preuves sinistre.

11. **Signature canvas pen-events (touch + mouse + stylus)** : Pointer Events API W3C unifie. Bug courant : oublier `event.preventDefault()` sur `touchmove` -> page scrolle. Sprint 11 livre `<SignaturePad>`.

12. **Offline queue conflict resolution Sprint 25** : assure submit sinistre offline + edit online avant flush -> conflit. Sprint 4 last-write-wins basique. Sprint 25 PouchDB conflict resolution explicite avec UI choix utilisateur.

---

## 12. CONFORMITE MAROC DETAILLEE

### 12.1 Loi 09-08 CNDP (Donnees personnelles)

Photos sinistre + GPS lat/lng + signature numerique = **donnees personnelles sensibles** au sens Loi 09-08. Obligations :

- **Consentement explicite** avant capture chaque photo et activation GPS (CGU acceptees Sprint 5 + checkbox specifique etape 2 et 3 wizard Sprint 25 "Je consens au stockage et traitement de mes photos / coordonnees GPS").
- **Information transparente** : page Profil section Confidentialite expose finalite traitement (gestion sinistre uniquement), retention duree (5 ans post-cloture sinistre), destinataires (assureur Skalean + reassureur ACAPS audit + expert auto Decret 2-13-836).
- **Droit acces / rectification / effacement** : Sprint 5 implementera page "Mes donnees" + endpoint `/api/v1/users/me/export-data` (RGPD-like Article 20 portabilite).
- **Minimization** : photos uniquement utilisees pour expertise sinistre, pas marketing.
- **Securite** : chiffrement at-rest (Atlas Cloud Benguerir RDS encryption + S3 SSE-S3) + in-transit (TLS 1.3 obligatoire HSTS preload).
- **Notification breach** : declaration CNDP sous 72h via numero declaration `NEXT_PUBLIC_CNDP_DECLARATION_NUMBER`.
- **Transfert hors Maroc** : INTERDIT sans autorisation CNDP -> tout reste Atlas Cloud Benguerir, pas FCM Google US, pas AWS US.

### 12.2 Decret 2-13-836 (Expertise automobile)

Workflow declaration sinistre doit respecter format Decret expertise :

- 6 etapes wizard Sprint 25 alignees au formulaire constat amiable europeen utilise au Maroc.
- Photos guidees minimum : vehicule entier 4 angles + plaque immatriculation + degat detail + carte grise + permis conduire (si applicable).
- Coordonnees tiers obligatoires si tiers identifiable.
- Signature numerique conforme Loi 53-05 e-commerce signature electronique.

### 12.3 ACAPS Supervision

Theme color #2D5773 ACAPS Teal (rappel visuel conformite supervision aupres de l'assure pour rassurance reglementaire). Footer mention legale Sprint 19 : "Skalean Insurance agreement ACAPS n. `NEXT_PUBLIC_ACAPS_AGREMENT_NUMBER`".

### 12.4 Multilinguisme decision-009

3 locales fr / ar-MA / ar avec RTL pour ar. Vocabulaire technique sinistre traduit (sinistre/haditha, constat/mahdar, tiers, blesses, temoins, signature). Tous les libelles UI multilingues. Tests Playwright executes sur les 3 locales.

---

## 13. CONVENTIONS ABSOLUES (14)

1. **Zero emoji** unicode anywhere (decision-006).
2. **TypeScript strict mode** : `strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`.
3. **Theme ACAPS Teal #2D5773** status bar (vs garage-mobile Orange #E95D2C) -- jamais inverser.
4. **next-pwa 5.6.0** retenue (alternative serwist documentee Phase 5).
5. **`@insurtech/shared-pwa` imports** pour hooks PWA (jamais re-implementer localement).
6. **IndexedDB persist** offline-first preparation Sprint 25 (jamais localStorage pour donnees app, sauf flag dismiss installPrompt).
7. **Multi-tenant strict L3 scoping** : `x-tenant-id` + `x-user-id` (assure_user) injectes systematiquement Axios.
8. **Cloud souverain Atlas Cloud Benguerir** (decision-008) : pas FCM Google, pas OneSignal, pas Firebase, web-push self-hosted.
9. **Locales fr / ar-MA / ar avec RTL** pour ar (dir="rtl" sur html).
10. **Mobile-first breakpoints** : xs 360px, sm 480px, md 768px (tailwind preset).
11. **Viewport-fit cover + safe-area-inset** pour iPhone notch.
12. **Permissions on-demand** : pas de requete au load, uniquement apres action utilisateur explicite.
13. **Photo compression client-side** systematique max 500 Ko, JPEG quality 0.8.
14. **Tests obligatoires** Vitest unitaires >= 80 % coverage + Playwright e2e chromium-mobile + mobile-safari.

---

## 14. VALIDATION PRE-COMMIT

```bash
# pre-commit hook (.husky/pre-commit) execute :
pnpm --filter @insurtech/web-assure-mobile lint
pnpm --filter @insurtech/web-assure-mobile typecheck
pnpm --filter @insurtech/web-assure-mobile test --run
pnpm --filter @insurtech/web-assure-mobile manifest:validate

# pre-push hook (.husky/pre-push) execute :
pnpm --filter @insurtech/web-assure-mobile build
pnpm --filter @insurtech/web-assure-mobile lighthouse:pwa
pnpm --filter @insurtech/web-assure-mobile test:e2e --project=chromium-mobile

# CI GitHub Actions execute en plus :
# - emoji-check (grep unicode emoji ranges -> fail si match)
# - bundle-size-check (next-bundle-analyzer < 800 Ko initial chunk)
# - playwright mobile-safari (parite iOS)
```

---

## 15. COMMIT MESSAGE

```
feat(web-assure-mobile): bootstrap PWA assure port 3006 (Sprint 4 / Tache 1.4.7)

Bootstraps the dedicated PWA mobile app for assure_user role to declare
sinistres from smartphone on accident scene. Reuses pattern from
web-garage-mobile (Tache 1.4.3) with branding adaptations :
- Port 3006 (vs 3003 garage-mobile)
- Theme color #2D5773 ACAPS Teal (vs #E95D2C Orange)
- L3 scoping x-user-id assure (vs x-garage-id technicien)
- Use case 6-step sinistre wizard placeholder (Sprint 25 implements)
- Camera + GPS permissions infrastructure (Sprint 13 + 25 implement)
- BottomTabs Accueil / Sinistres / Profil (vs Tasks / Stock / Profil)

Deliverables :
- Next.js 15.1.0 + next-pwa 5.6.0 (--ignore-peer-deps for Next 15 compat)
- 3 locales fr / ar-MA / ar with RTL
- Service worker NetworkFirst api / CacheFirst static / SWR pages / NetworkOnly auth+payment
- IndexedDB offline queue (outbox-v1) Sprint 25 PouchDB ready
- Components from @insurtech/shared-pwa : useInstallPrompt, useOnlineStatus, useServiceWorker
- Wizard 6 steps : info / photos / lieu GPS / blesses / temoins / signature
- Camera capture with NotAllowedError fallback file upload
- Geolocation picker with PERMISSION_DENIED fallback Mapbox SearchBox
- 22 unit tests Vitest (coverage >= 80%) + Playwright e2e mobile-safari + chromium-mobile
- Lighthouse PWA score >= 90 baseline (target Sprint 24 : >= 95)

Compliance :
- decision-006 (no emoji)
- decision-008 (Atlas Cloud Benguerir souverain)
- decision-009 (multilinguisme fr / ar-MA / ar)
- Loi 09-08 CNDP (photos + GPS donnees sensibles consentement explicite)
- Decret 2-13-836 expertise automobile workflow
- ACAPS supervision theme color rappel

Refs : Sprint 4 / Phase 1 Bootstrap / depends 1.4.6 / blocks 1.4.8, Sprint 5, 9, 11, 13, 19, 25
```

---

## 16. WORKFLOW NEXT STEP -> Tache 1.4.8

A l'issue de cette tache, le developpeur passe a **Tache 1.4.8 -- Package shared-ui Theme + 30+ composants shadcn** (8h, P0). Cette tache finalise les composants partages consomme par les 8 apps frontend du monorepo. Les composants `BottomTabs`, `Button`, `Card`, `Banner`, `Spinner`, `Icon` consommes par `web-assure-mobile` Tache 1.4.7 doivent etre stabilises.

Apres 1.4.8, sequence : 1.4.9 (shared-pwa) -> 1.4.10 (shared-maps) -> 1.4.11 (multilingue cross-cutting) -> 1.4.12 (Turbo tooling) -> 1.4.13 (OpenAPI client gen) -> 1.4.14 (layouts partages) -> 1.4.15 (404/500) -> 1.4.16 (E2E + Lighthouse + Storybook). Fin Sprint 4 = fin Phase 1 Bootstrap. Phase 2 demarre Sprint 5 Auth.

---

## 17. FOOTER

**Tache** : 1.4.7 -- web-assure-mobile Bootstrap (Port 3006 -- PWA)
**Sprint** : 4 / 35 (Phase 1 Bootstrap)
**Effort** : 5h
**Priorite** : P0
**Status** : Specifie -- a implementer
**Auteur** : Cowork Generation Agent v2 Skalean InsurTech
**Date** : 2026-05-05
**Version** : v2.0
**Decisions appliquees** : 006 (no-emoji), 008 (cloud souverain Atlas Benguerir), 009 (multilinguisme fr/ar-MA/ar), PWA-strategy (offline-first preparation), offline-first-sprint-25
**Conformite** : Loi 09-08 CNDP, Decret 2-13-836 expertise auto, ACAPS supervision, Loi 53-05 signature electronique
**Dependances** : 1.4.6 (theme assure ACAPS Teal), 1.4.3 (pattern PWA), 1.4.9 (shared-pwa hooks)
**Blocages** : 1.4.8, Sprint 5 auth, Sprint 9 push, Sprint 11 signature, Sprint 13 photos pattern 14, Sprint 19 ACAPS, Sprint 25 declaration sinistre 6 etapes PouchDB
