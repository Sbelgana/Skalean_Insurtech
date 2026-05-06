# TACHE 1.4.6 -- web-assure-portal Bootstrap (Port 3005 -- NEW v2.0)

**Sprint** : 4 (Phase 1 / Sprint 4 -- Frontend Bootstrap, dernier de la Phase 1 Bootstrap)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` (Tache 1.4.6 lignes 508-543)
**Phase** : 1 -- Bootstrap
**Priorite** : P0 (bloquant pour Sprint 5 Auth assure_user, Sprint 11 signature electronique, Sprint 16 paiement assure, Sprint 19 sinistres self-service, Sprint 25 mobile sinistre redirect)
**Effort** : 5h (estimation ferme)
**Dependances** : 1.4.5 (web-customer-portal bootstrap, fournit patron public + SEO patterns) + 1.4.1 (web-broker bootstrap, patron canonique des apps internes) + 1.4.8 (shared-ui theme + 30+ composants shadcn) + 1.4.11 (multilingue cross-cutting fr / ar-MA / ar) + 1.4.14 (SelfServiceLayout shared-ui)
**Bloque** : 1.4.7 (web-assure-mobile PWA, qui copie patron self-service mais ajoute next-pwa pour declaration sinistres mobile)
**Densite cible** : 100-150 ko (auto-suffisante exhaustive, aucune lecture annexe necessaire pour executer)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee, controle CI `scripts/check-no-emoji.sh`)

---

## 1. But (0.5-1 ko)

Initialiser l'application frontend `web-assure-portal` -- le **portail self-service destine aux assures finaux** (titulaires de polices d'assurance) leur permettant de consulter leurs polices souscrites, suivre leurs sinistres, declarer un sinistre simple en ligne, payer leurs primes, gerer leur profil personnel, exercer leurs droits CNDP (export/erasure RGPD) et consulter l'historique de leurs paiements. Cette app tourne sur le port 3005 en developpement et sera deployee sur `mon-espace.skalean-insurtech.ma` en production. Elle constitue le sixieme des 8 fronts Next.js du programme Skalean InsurTech et adopte une **UX fondamentalement differente** des apps internes broker/garage/admin : layout self-service simplifie sans sidebar dense, gros boutons (touch target >= 44x44 px conformite WCAG 2.5.5), large police de base (18 px contre 14 px standard), langage clair non-jargonneux, theme variant assure dominant Sky Blue #B0CEE2 (rassurant pastel) avec accent Orange #E95D2C reserve aux call-to-action critiques.

L'objectif precis du bootstrap est de poser le squelette technique sans logique metier : Next.js 15.1.0 App Router avec React 19 Server Components, multilinguisme operationnel sur trois locales (fr par defaut, ar-MA Darija marocain, ar arabe classique avec direction RTL), theme variant `data-theme="assure"` applique (palette Sky Blue dominante, Montserrat 18 px base, Noto Naskh Arabic fallback ar), client API Axios pre-configure avec interceptors d'injection automatique des en-tetes multi-tenant (`x-tenant-id`, **`x-user-id` specifique L3 scoping assure_user_id**, `x-trace-id`, `Idempotency-Key`, futur `Authorization: Bearer`), React Query (TanStack v5) pret pour la consommation des endpoints du Sprint 3 cote utilisateur final, providers React composes proprement, configuration Tailwind 4 etendue depuis le preset partage `@insurtech/shared-ui/tailwind-preset` avec activation du variant `assure`, helpers de formatage MAD (Intl.NumberFormat fr-MA `1 234,56 DH` / ar-MA `١٬٢٣٤٫٥٦` selon configuration), formatage telephone marocain `+212 6 12 34 56 78`, formatage numero de police `POL-2026-AUTO-000123`, formatage date locale-aware.

A la sortie de cette tache, la commande `pnpm --filter @insurtech/web-assure-portal dev` demarre l'app sur `http://localhost:3005`, les routes `/fr`, `/ar-MA` et `/ar` repondent en 200 avec leurs locales, le build de production passe sans erreur, les tests unitaires Vitest (api-client, format MAD/+212/date, i18n request) et E2E Playwright (rendering 3 locales, navigation polices->sinistres->profil->paiements, big-button accessibility >= 44x44 px, mobile responsive 320 px viewport, contraste Sky Blue WCAG AA) valident l'architecture, et le score Lighthouse Performance baseline depasse 70 / Accessibility >= 90 (cible Sprint 17 = 95 perf). Cette tache bloque 1.4.7 (web-assure-mobile PWA) qui copiera la meme structure self-service mais ajoutera `next-pwa` + service worker offline pour declaration sinistre en mobilite (prise de photos hors-ligne, sync au retour reseau).

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi une app self-service distincte des autres apps frontend

Le programme Skalean InsurTech compte 8 applications frontend Next.js. Les apps internes (web-broker port 3001, web-garage port 3002, web-insurtech-admin port 3000) servent des **utilisateurs metier** (commerciaux, gestionnaires, techniciens, administrateurs) avec une **UX dense** (sidebar de navigation profonde, tableaux de donnees riches, formulaires complexes multi-onglets, raccourcis clavier, densite informationnelle elevee adaptee a un usage quotidien intensif). Les apps assure (`web-assure-portal` desktop responsive, `web-assure-mobile` PWA dediee sinistres) servent des **utilisateurs finaux** non-techniciens avec une **UX simplifiee** (gros boutons, polices grandes, langage clair, parcours guides etape par etape, peu de profondeur de navigation, focus sur les 5-7 actions principales : voir polices, declarer sinistre, payer prime, modifier profil, telecharger attestation).

Trois axes de differenciation justifient l'app dediee :

1. **UX fondamentalement differente** : sidebar dense (broker/admin) versus topbar simple + content centre (assure). La sidebar verticale broker affiche 15-25 entrees de navigation avec sous-menus -- l'assure n'a besoin que de 6 entrees principales presentees horizontalement en topbar. Forcer la meme navigation pour tous les profils dans une seule app contraint l'architecture de routes et alourdit le bundle JS pour des utilisateurs assures qui n'ont pas besoin de 80% du code metier broker.

2. **Isolation de role stricte** : le role `assure_user` (Level 3 dans la hierarchie multi-tenant Skalean : tenant > broker_admin > broker_user > **assure_user**) est lui-meme **scope par `assure_user_id`** -- un assure ne voit QUE ses propres polices, ses propres sinistres, ses propres paiements, son propre profil. Les RLS PostgreSQL Sprint 6 implementeront `WHERE assure_user_id = current_setting('app.current_user_id')`. Une app dediee permet d'imposer **deux gates en defense en profondeur** : (a) middleware Next.js qui verifie `role === 'assure_user'` et redirige les autres roles vers leur app respective, (b) interceptor Axios qui injecte systematiquement `x-user-id` reçu de la session NextAuth Sprint 5. Une app mixte broker+assure rendrait la verification de role exclusive plus fragile (un courtier pourrait par accident voir un ecran assure ou inversement, casse de privacy CNDP critique).

3. **Theme reassurance** : la palette Skalean Sofidemy expose 4 variants principaux : `default` (Orange #E95D2C dominant, energique, courtage), `admin` (Navy #1A2730 dominant, autoritaire, SuperAdmin), `assure` (Sky Blue #B0CEE2 dominant, rassurant pastel, assure self-service), `acaps` (Teal #2D5773 dominant, institutionnel, conformite reglementaire footer). Le variant `assure` n'est jamais expose aux apps broker/garage/admin. L'attribut HTML `data-theme="assure"` racine declenche les variables CSS specifiques (`--color-primary: #B0CEE2`, `--color-cta: #E95D2C` reserve CTA, `--font-size-base: 18px`, `--touch-target-min: 44px`).

### Differenciation avec web-assure-mobile (Tache 1.4.7)

L'app `web-assure-portal` (3005) et `web-assure-mobile` (3006) servent **les memes assures** mais sur **des devices et des cas d'usage differents** :

| Critere | web-assure-portal (3005) | web-assure-mobile (3006) |
|---------|--------------------------|---------------------------|
| Cas d'usage primaire | Consulter polices, payer prime, gerer profil, exercer droits CNDP | Declarer sinistre en mobilite (photos, geoloc, voice notes) |
| Device | Desktop + mobile responsive (320 px - 1920 px) | Mobile dedie (320 px - 480 px), PWA installable |
| PWA | Non (responsive web app classique) | Oui (next-pwa, service worker offline-first, manifest, install prompt) |
| Offline | Non requis (toujours en ligne pour dashboards) | Oui critique (declaration sinistre depuis lieu accident sans 4G) |
| Cache strategie | Network-first standard | Cache-first pour assets, queue offline pour POST sinistres |
| Effort initial | 5h (port 3005, layout self-service, no PWA) | 5h (copie patron 3005 + ajout next-pwa + manifest + SW) |
| Detection mobile UA | Redirige vers /sinistres/declarer mobile-only Sprint 25 | App native PWA |

Cette separation permet a l'assure d'utiliser le portal desktop pour **gerer son contrat** (consulter, payer, profiler) et d'installer la PWA mobile **uniquement** pour declarer sinistre sur le terrain. Une seule app responsive aurait du embarquer le service worker complet meme pour les usages desktop -- inutile et couteux en bandwidth + initial load time.

### Alternatives considerees pour ce bootstrap

#### Alt-1 : Sub-route de web-broker (`broker.skalean-insurtech.ma/assure`)

Reasoning consideree : factoriser code, un seul deploy, un seul build pipeline, une seule pipeline tests E2E.

**Rejete** car :
- Couplage role (assure_user perdu dans l'app destinee broker_admin/broker_user, gates de role devenant le seul rempart contre fuite de donnees inter-roles -- fragile pour un programme regule CNDP/ACAPS).
- Couplage UX (impossible d'imposer SelfServiceLayout aux assures sans casser la sidebar dense des courtiers).
- Couplage theme (impossible de servir Sky Blue dominant aux assures et Orange dominant aux courtiers depuis la meme app sans hacks `data-theme` complexes que cassent les compositions shadcn).
- Couplage deploy (Sprint 19 sinistres assures versus Sprint 17 souscription broker ne suivent pas le meme calendrier de release -- une app commune force les deploys couplages).
- SEO impact (mon-espace.skalean-insurtech.ma doit avoir son propre robots.txt + sitemap.xml dedies utilisateurs finaux, distincts des routes courtier non-indexables).

#### Alt-2 : Sous-domaine dedie + app dediee (RETENU)

`mon-espace.skalean-insurtech.ma` -> app `web-assure-portal` deployee independamment, theme assure isole, role assure_user gates fortes, calendrier de release autonome (Sprint 19 deploy sinistres Sprint 25 deploy mobile sans toucher web-broker).

**Choisi** car repond aux 5 critiques de Alt-1 et s'aligne avec le pattern industrie (Banque Populaire `mes-comptes.banquepopulaire.ma`, Wafa Assurance `mon-espace.wafaassurance.com`, Allianz Maroc `monespace.allianz.ma`).

#### Alt-3 : Portail assure embarque dans customer-portal public (Sprint 18)

`www.skalean-insurtech.ma/mon-espace` derriere login.

**Rejete** car :
- customer-portal Sprint 18 est SSG + ISR (pages publiques optimisees SEO), incompatible avec les pages assure 100% dynamiques (donnees personnelles, jamais cacheables).
- Mixer SSG public et SSR authentifie dans la meme app force des compromis Next.js (revalidate forcé sur tout, cache fragmente).
- Risque securite : une faille XSS sur un blog public (commentaires, formulaire contact) pourrait potentiellement contaminer le contexte authentifie assure si meme app.

### Trade-offs explicites du choix retenu

1. **Code duplication shared-ui mitigee** : le package `@insurtech/shared-ui` (Tache 1.4.8) factorise les 30+ composants shadcn (Button, Card, Dialog, Form, Input, Select, etc.) ainsi que le `SelfServiceLayout` (Tache 1.4.14). Le code ecrit dans `web-assure-portal` reste minimal : pages placeholder, providers, api-client, format helpers. La duplication est limitee a ~5 fichiers de glue code (~ 500 lignes) versus le gain de specialisation theme/UX/role.

2. **Build pipeline 8 apps** : Turbo (Tache 1.4.12) parallelise les builds. Sur CI Atlas Cloud Benguerir, les 8 apps buildent en parallel sur 8 runners (~3 min p95 chaque). L'ajout de cette 6eme app n'augmente pas le temps de build wall-clock (parallelisme), seulement le cout CPU CI.

3. **Theme variant assure beta** : Sky Blue #B0CEE2 doit etre teste contraste WCAG AA contre fond blanc (`#FFFFFF`) et fond gris-50 (`#F9FAFB`). Le calcul ratio donne 1.42:1 sur blanc -- **insuffisant** pour texte body. Solution : Sky Blue est utilise comme **fond de surfaces** (cards, banners, badges) et non comme couleur de texte. Le texte reste Navy `#1A2730` (contraste 12.6:1 sur Sky Blue, AAA). Documente dans theme variant assure.

4. **Session timeout 30 min user vs 15 min admin** : assure utilise le portal de maniere intermittente (consultation 5-10 min/semaine, pas usage intensif quotidien). Forcer reconnexion 15 min frustre. Compromis : 30 min idle timeout + warning 5 min avant deconnexion + bouton "rester connecte". Conformite ACAPS 12-2024 cybersecurite : timeout maximum admin = 30 min, user-facing = 60 min toleres -- 30 min est conservateur.

5. **Mobile responsive vs PWA dedie** : portal desktop ne sera **jamais** PWA. Si l'assure veut une experience native mobile, il installe `web-assure-mobile` (port 3006). Le portal expose UA detection : si UA mobile + URL `/sinistres/declarer`, redirect 302 vers `https://m-mon-espace.skalean-insurtech.ma/declarer` (Sprint 25 implementera redirect, ici placeholder).

6. **Pas d'AI gateway dans portal assure Sprint 4** : assure ne consomme pas IA Sprint 13 (chatbot reserve courtier). `NEXT_PUBLIC_AI_GATEWAY_URL` non present dans `.env.example`. Si Sprint 23 ajoute chatbot assure FAQ, sera ajoute alors.

7. **Sentry init prod uniquement** : `NEXT_PUBLIC_SENTRY_DSN` vide en dev. En prod, DSN injecte par Atlas Cloud Benguerir secret manager. Pas de spam tracking sur dev.

8. **Tailwind 4 beta risque** : voir Tache 1.4.1. Decision globale Sprint 4. Mitigation pin exact `4.0.0-beta.4`.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : `apps/web-assure-portal` reside dans le monorepo `/repo`. Respecte `pnpm-workspace.yaml` -- pas de duplication deps avec `@insurtech/shared-ui`.
- **decision-005 (Skalean AI frontier)** : pas d'integration AI dans cette tache (chatbot assure repousse Sprint 23+).
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans aucun fichier code, JSON messages, README, commit. Linter custom `scripts/check-no-emoji.sh` valide en CI. Accents francais et caracteres arabes autorises (Darija marocain `الكلام المغربي`, arabe classique `العربية الفصحى`).
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : `images.remotePatterns` n'inclut **JAMAIS** `*.amazonaws.com`. Domaines autorises : `s3.bgr.atlascloudservices.ma` (prod), `localhost:9000` (MinIO dev), `cdn.skalean-insurtech.ma` (CloudFront equivalent Atlas Benguerir).
- **decision-009 (multilinguisme MA)** : trois locales obligatoires fr / ar-MA Darija / ar classique RTL.
- **decision-014 (multi-tenant L3 scoping)** : assure_user est scope L3, RLS Sprint 6 filtre `assure_user_id`. Interceptor injecte `x-user-id` systematiquement (NEW pour cette app vs broker qui injecte `x-user-id` aussi mais sans la criticite L3).
- **decision-017 (CNDP Loi 09-08 user rights UI)** : portal assure expose stub `/profil/rgpd` avec boutons "Exporter mes donnees" + "Supprimer mon compte" (Sprint 14 implementera workflow complet).

### Pieges techniques connus (10 minimum)

1. **assure_user RLS scoping non-respect** : si l'interceptor Axios oublie `x-user-id`, l'API filtre uniquement par tenant et l'assure pourrait voir les polices d'autres assures du meme tenant -- **fuite massive RGPD/CNDP** (sanction CNDP 100k - 300k MAD). Defense : interceptor refuse d'envoyer la requete si `x-user-id` absent ET URL contient `/me/`, `/policies`, `/claims`, `/payments`. Test unitaire dedie verifie throw error si manquant.

2. **Sky Blue contrast accessibility** : `#B0CEE2` sur fond blanc donne 1.42:1 -- echec WCAG AA pour texte. Mitigation : usage exclusif comme background de surface. Texte body reste Navy `#1A2730`. Lighthouse a11y test integre `audit.contrast` minimum 4.5:1.

3. **MAD currency format locale-aware divergence** : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })` produit `"1 234,56 DH"` (format Maroc francais avec espace insecable narrow comme separateur milliers). `Intl.NumberFormat('ar-MA', ...)` produit `"١٬٢٣٤٫٥٦ د.م."` avec chiffres arabo-indiens. Decision : configurable via cookie `numerals=western|arabic-indic` (defaut western pour ar-MA Darija = preference observee marche, arabic-indic pour ar classique).

4. **Phone number +212 vs 0X normalization** : assure peut saisir `+212612345678`, `0612345678`, `+212 6 12 34 56 78`, `06.12.34.56.78`. Parser normalise vers format E.164 `+212612345678` avant submit API. Helper `formatPhone(input)` dans `lib/format.ts` retourne format affichage `+212 6 12 34 56 78`.

5. **Signature electronique Sprint 11 placeholder warning** : page `/polices/[id]/signer` Sprint 11 implementera signature Maroc-Sign / Barid-eSign. Pour Sprint 4, page absente. Si assure clique sur lien externe profond, retourner 404 dedie avec message "Disponible Sprint 11" (placeholder propre, pas de crash).

6. **Mobile UA detection redirect logic** : middleware doit detecter UA mobile sur route `/sinistres/declarer` UNIQUEMENT (autres routes mobile-friendly responsive). Regex UA simpliste `/Mobile|Android|iPhone/i.test(ua)` -- documente comme heuristique. Sprint 25 raffine.

7. **Session timeout vs idle timeout confusion** : terminologie : **session timeout** = duree absolue du token JWT (8h pour assure), **idle timeout** = inactivite (30 min). Deux mecanismes distincts. Sprint 5 implementera both. Ici, configuration `NEXT_PUBLIC_IDLE_TIMEOUT_MS=1800000` (30 min) + `NEXT_PUBLIC_IDLE_WARNING_MS=300000` (5 min avant) declare.

8. **Password reset flow Sprint 5 placeholder** : route `/auth/reset-password` non implementee Sprint 4. Page profil expose stub "Modifier mon mot de passe" qui redirige vers `/auth/reset-password` -> 404 placeholder Sprint 5.

9. **RGPD/CNDP user rights export/erasure UI** : Loi 09-08 article 7 (droit acces), article 9 (rectification), article 10 (opposition), article 11 (suppression). UI Sprint 14 expose 4 boutons : "Acceder a mes donnees" (download JSON), "Rectifier" (formulaire), "Opposer traitement" (checkbox), "Supprimer mon compte" (workflow 30j). Sprint 4 stub "Disponible Sprint 14".

10. **Big buttons touch target accessibility** : WCAG 2.5.5 (Level AAA) recommande 44x44 px minimum. Tous les boutons primaires assure portal ont `min-height: 44px` et `min-width: 44px` via classe utilitaire `.btn-touch` shared-ui. Test Playwright valide via `expect(button).toHaveCSS('min-height', '44px')`.

11. **Large base font 18 px accessibilite** : variant assure expose `--font-size-base: 1.125rem` (18 px) versus 14 px standard. Impact : layouts responsive doivent etre testes en 18 px base (overflow possible sur 320 px mobile). `tailwind.config.ts` variant assure surcharge `theme.extend.fontSize.base`.

12. **Locale Darija plural rules** : ar-MA Darija ne suit pas les memes regles plurielles que ar classique (Darija a moins de duels, plus proche de fr morphologie). next-intl ICU pluralization fournit fallback. Cles JSON utilisent `"sinistres": "{count, plural, =0 {Aucun sinistre ouvert} =1 {Un sinistre ouvert} other {# sinistres ouverts}}"`.

13. **Currency display configurabilite numerals** : cookie `numerals` (`western` defaut ar-MA, `arabic-indic` defaut ar classique). Helper `formatCurrency` lit cookie via `cookies().get('numerals')` Server Component + fallback locale-default si absent.

14. **Idempotency-Key sur GET = poison cache** : interceptor doit filter methode (uniquement POST/PUT/PATCH/DELETE).

15. **CSP strict-dynamic + react-pdf inline blobs** : react-pdf affiche PDF policy via blob URL. CSP doit autoriser `blob:` dans `img-src` et `frame-src`. Sinon affichage casse.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 4

`task-1.4.6` est la **sixieme des 16 taches** du Sprint 4 et copie le patron etabli par Tache 1.4.1 / 1.4.5 :

```
Sprint 4 -- Frontend Bootstrap (16 taches)

[1.4.1 web-broker]  PATRON BOOTSTRAP CANONIQUE
   |
   +--> [1.4.2 web-garage]            (port 3002, theme garage)
   +--> [1.4.3 web-garage-mobile]     (port 3003, PWA, theme garage)
   +--> [1.4.4 web-insurtech-admin]   (port 3000, theme admin Navy)
   +--> [1.4.5 web-customer-portal]   (port 3004, SSG+ISR+SEO public)
   +--> [1.4.6 web-assure-portal]     (port 3005, theme assure Sky Blue, SelfServiceLayout) <-- ICI
   +--> [1.4.7 web-assure-mobile]     (port 3006, PWA, theme assure, copie patron 1.4.6)

[1.4.8 shared-ui]    [1.4.9 shared-pwa]    [1.4.10 shared-maps]
       |                     |                       |
       v                     v                       v
[1.4.11 i18n cross-cutting]    [1.4.12 turbo + scripts paralleles]
[1.4.13 OpenAPI client gen]    [1.4.14 layouts shared (DashboardLayout + SelfServiceLayout + PublicLayout)]
[1.4.15 pages 404/500]         [1.4.16 Tests E2E + Lighthouse + Storybook]
```

### Position dans le programme global Skalean InsurTech

`web-assure-portal` est consomme par les sprints metier suivants :

```
Sprint 5 (Auth) : implements next-auth + role assure_user gate
   |
   v
Sprint 11 (Signature electronique) : page /polices/[id]/signer Maroc-Sign / Barid-eSign integration
   |
   v
Sprint 14 (CNDP user rights) : workflow export PDF donnees + erasure 30j
   |
   v
Sprint 16 (Paiement assure) : page /paiements/payer Stripe MA / CMI / paiement bancaire BAM
   |
   v
Sprint 17 (Souscription) : assure peut consulter contrat souscrit, telecharger attestation
   |
   v
Sprint 19 (Sinistres) : page /sinistres/declarer simple (non-mobile, sans photos), suivi etat sinistre
   |
   v
Sprint 25 (Mobile sinistre) : redirection mobile UA vers web-assure-mobile PWA pour declaration enrichie
   |
   v
Sprint 27 (Reporting) : assure consulte stats personnelles (primes payees annee N, sinistres ouverts/fermes)
   |
   v
Sprint 32 (Notifications) : centre notifications in-app pour rappels echeance prime + relances sinistre
```

### Diagramme d'architecture cible (apres Sprint 4)

```
                                    +-------------------+
                                    |  Atlas Cloud      |
                                    |  Benguerir (MA)   |
                                    +-------------------+
                                              |
                  +---------------------------+----------------------------+
                  |                           |                            |
        +-------------------+       +-------------------+         +-------------------+
        | web-assure-portal |       |  web-broker       |         |  api NestJS       |
        | mon-espace.*.ma   |       | broker.*.ma       |         | api.*.ma          |
        | port 3005 dev     |       | port 3001 dev     |         | port 4000 dev     |
        | Theme assure      |       | Theme default     |         | RLS PostgreSQL    |
        | SelfServiceLayout |       | DashboardLayout   |         |                   |
        +-------------------+       +-------------------+         +-------------------+
                  |                           |                            ^
                  | Axios + interceptors      | Axios + interceptors       |
                  | x-tenant-id               | x-tenant-id                |
                  | x-user-id (L3 scoping)    | x-user-id                  |
                  | x-trace-id                | x-trace-id                 |
                  | Authorization Bearer JWT  | Authorization Bearer JWT   |
                  +---------------------------+----------------------------+
                                              |
                                              v
                                      +---------------+
                                      | Redis cache   |
                                      | port 6379     |
                                      +---------------+
                                              |
                                              v
                                      +---------------+
                                      | Kafka events  |
                                      | port 9092     |
                                      +---------------+
```

---

## 4. Livrables checkables (20-25)

- [ ] L1. `repo/apps/web-assure-portal/package.json` cree avec name `@insurtech/web-assure-portal`, version `0.1.0`, scripts `dev`/`build`/`start`/`lint`/`typecheck`/`test`/`test:e2e`, deps next 15.1.0 + react 19 + next-intl 3.26.3 + @tanstack/react-query 5.62.7 + axios 1.7.9 + react-hook-form 7.54.2 + @hookform/resolvers 3.9.1 + zustand 5.0.2 + zod 3.24.1 + clsx 2.1.1 + tailwind-merge 2.1.1 + lucide-react 0.469.0 + react-pdf 9.1.1 + currency.js 2.0.4 (formatage MAD avance)
- [ ] L2. `repo/apps/web-assure-portal/next.config.mjs` avec port 3005, reactStrictMode true, experimental.serverActions.bodySizeLimit '10mb', images.remotePatterns Atlas Cloud + api skalean + localhost MinIO, headers HSTS + CSP strict-dynamic + X-Frame-Options DENY + Referrer-Policy strict-origin, rewrites `/api/v1/:path*` -> `${API_BASE_URL}/v1/:path*`
- [ ] L3. `repo/apps/web-assure-portal/tailwind.config.ts` etend preset shared-ui avec variant `assure` (Sky Blue dominant + base font 18 px + touch target 44 px)
- [ ] L4. `repo/apps/web-assure-portal/tsconfig.json` strict mode + paths `@/*` -> `./src/*` + `@insurtech/shared-ui/*`
- [ ] L5. `repo/apps/web-assure-portal/src/app/[locale]/layout.tsx` racine avec `<html data-theme="assure" lang={locale} dir={dir}>` + Montserrat + Noto Naskh + metadata "Mon Espace Assure | Skalean InsurTech" + SelfServiceLayout wrap
- [ ] L6. `repo/apps/web-assure-portal/src/app/[locale]/page.tsx` dashboard mes polices placeholder (cards Sky Blue)
- [ ] L7. `repo/apps/web-assure-portal/src/app/[locale]/polices/page.tsx` liste polices placeholder Sprint 17
- [ ] L8. `repo/apps/web-assure-portal/src/app/[locale]/polices/[id]/page.tsx` detail police placeholder + react-pdf preview stub
- [ ] L9. `repo/apps/web-assure-portal/src/app/[locale]/sinistres/page.tsx` mes sinistres placeholder Sprint 19
- [ ] L10. `repo/apps/web-assure-portal/src/app/[locale]/sinistres/declarer/page.tsx` placeholder Sprint 19/25 + UA mobile detect redirect
- [ ] L11. `repo/apps/web-assure-portal/src/app/[locale]/profil/page.tsx` info perso placeholder + RGPD rights stubs Sprint 14
- [ ] L12. `repo/apps/web-assure-portal/src/app/[locale]/paiements/page.tsx` historique paiements placeholder Sprint 16
- [ ] L13. `repo/apps/web-assure-portal/src/app/[locale]/auth/login/page.tsx` placeholder Sprint 5 implementera
- [ ] L14. `repo/apps/web-assure-portal/src/app/[locale]/not-found.tsx` 404 dedie portal assure
- [ ] L15. `repo/apps/web-assure-portal/src/app/[locale]/error.tsx` 500 dedie portal assure
- [ ] L16. `repo/apps/web-assure-portal/src/middleware.ts` next-intl + role gate assure_user + UA mobile redirect /sinistres/declarer
- [ ] L17. `repo/apps/web-assure-portal/src/i18n/request.ts` next-intl getRequestConfig + locale validation
- [ ] L18. `repo/apps/web-assure-portal/src/messages/{fr,ar-MA,ar}.json` 60+ cles vocab assure
- [ ] L19. `repo/apps/web-assure-portal/src/lib/api-client.ts` Axios + interceptors x-tenant-id + x-user-id (L3 scoping critique) + x-trace-id + Idempotency-Key (filter mutations only)
- [ ] L20. `repo/apps/web-assure-portal/src/lib/query-client.ts` QueryClient TanStack v5 + 5 min stale + 30 min gc
- [ ] L21. `repo/apps/web-assure-portal/src/lib/format.ts` formatCurrency MAD + formatPhone +212 + formatPolicyNumber + formatDate locale-aware
- [ ] L22. `repo/apps/web-assure-portal/src/components/providers.tsx` ThemeProvider + QueryClientProvider + NextIntlClientProvider compose
- [ ] L23. `repo/apps/web-assure-portal/src/components/AssureBranding.tsx` logo Skalean + nom utilisateur + locale switcher
- [ ] L24. `repo/apps/web-assure-portal/.env.example` 17 vars NEXT_PUBLIC_*
- [ ] L25. `repo/apps/web-assure-portal/src/app/globals.css` variant assure CSS + base 18 px
- [ ] L26. `repo/apps/web-assure-portal/playwright.config.ts` chromium + mobile-safari + mobile-chrome 320 px viewport
- [ ] L27. Tests unitaires Vitest 18+ tests (api-client, format, i18n)
- [ ] L28. Tests E2E Playwright 12+ scenarios

---

## 5. Code patterns COMPLETS (30-80 ko, 12-14 fichiers complets)

### 5.1. `repo/apps/web-assure-portal/package.json` (~80 lignes)

```json
{
  "name": "@insurtech/web-assure-portal",
  "version": "0.1.0",
  "private": true,
  "description": "Skalean InsurTech -- Portail self-service pour assures (consulter polices, declarer sinistres, payer primes, gerer profil)",
  "scripts": {
    "dev": "next dev -p 3005 --turbopack",
    "build": "next build",
    "start": "next start -p 3005",
    "lint": "next lint --max-warnings 0",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:headed": "playwright test --headed",
    "lighthouse": "lhci autorun",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,json,md}\"",
    "clean": "rm -rf .next .turbo coverage playwright-report test-results"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "next-intl": "3.26.3",
    "next-themes": "0.4.4",
    "@tanstack/react-query": "5.62.7",
    "@tanstack/react-query-devtools": "5.62.7",
    "axios": "1.7.9",
    "react-hook-form": "7.54.2",
    "@hookform/resolvers": "3.9.1",
    "zod": "3.24.1",
    "zustand": "5.0.2",
    "clsx": "2.1.1",
    "tailwind-merge": "2.1.1",
    "lucide-react": "0.469.0",
    "react-pdf": "9.1.1",
    "currency.js": "2.0.4",
    "@insurtech/shared-ui": "workspace:*",
    "@insurtech/shared-types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "22.10.2",
    "@types/react": "19.0.1",
    "@types/react-dom": "19.0.2",
    "typescript": "5.7.2",
    "tailwindcss": "4.0.0-beta.4",
    "@tailwindcss/postcss": "4.0.0-beta.4",
    "postcss": "8.4.49",
    "autoprefixer": "10.4.20",
    "eslint": "9.17.0",
    "eslint-config-next": "15.1.0",
    "vitest": "2.1.8",
    "@vitest/coverage-v8": "2.1.8",
    "@vitejs/plugin-react": "4.3.4",
    "jsdom": "25.0.1",
    "@testing-library/react": "16.1.0",
    "@testing-library/jest-dom": "6.6.3",
    "@playwright/test": "1.49.1",
    "@lhci/cli": "0.14.0",
    "prettier": "3.4.2"
  },
  "engines": {
    "node": ">=20.18.0",
    "pnpm": ">=9.15.0"
  }
}
```

### 5.2. `repo/apps/web-assure-portal/next.config.mjs` (~80 lignes)

```javascript
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  productionBrowserSourceMaps: false,

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: ['localhost:3005', 'mon-espace.skalean-insurtech.ma'],
    },
    optimizePackageImports: ['lucide-react', 'react-pdf'],
  },

  images: {
    remotePatterns: [
      // Atlas Cloud Benguerir prod (decision-008)
      { protocol: 'https', hostname: 's3.bgr.atlascloudservices.ma' },
      { protocol: 'https', hostname: 'cdn.skalean-insurtech.ma' },
      { protocol: 'https', hostname: 'api.skalean-insurtech.ma' },
      // MinIO dev local
      { protocol: 'http', hostname: 'localhost', port: '9000' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  async headers() {
    const cspProd = [
      "default-src 'self'",
      "script-src 'self' 'strict-dynamic' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://s3.bgr.atlascloudservices.ma https://cdn.skalean-insurtech.ma",
      "connect-src 'self' https://api.skalean-insurtech.ma wss://api.skalean-insurtech.ma",
      "frame-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), payment=(self)' },
          { key: 'Content-Security-Policy', value: cspProd },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${API_BASE_URL}/v1/:path*` },
    ];
  },

  output: 'standalone',
};

export default withNextIntl(nextConfig);
```

### 5.3. `repo/apps/web-assure-portal/tailwind.config.ts` (~50 lignes)

```typescript
import type { Config } from 'tailwindcss';
import sharedPreset from '@insurtech/shared-ui/tailwind-preset';

const config: Config = {
  presets: [sharedPreset],
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/shared-ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Variant assure : Sky Blue dominant (rassurant pastel)
      colors: {
        assure: {
          primary: '#B0CEE2',
          'primary-dark': '#7FA8C4',
          'primary-light': '#D4E3EE',
          cta: '#E95D2C', // Orange reserve aux CTA critiques (Payer prime, Declarer sinistre)
        },
      },
      fontSize: {
        // Base 18 px (vs 14 px standard) accessibilite assure non-tech
        base: ['1.125rem', { lineHeight: '1.75rem' }],
      },
      minHeight: {
        'touch': '44px', // WCAG 2.5.5 Level AAA
      },
      minWidth: {
        'touch': '44px',
      },
      spacing: {
        'touch': '44px',
      },
      backgroundImage: {
        'assure-gradient': 'linear-gradient(135deg, #B0CEE2 0%, #D4E3EE 100%)',
      },
    },
  },
};

export default config;
```

### 5.4. `repo/apps/web-assure-portal/tsconfig.json` (~50 lignes)

```json
{
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
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "useUnknownInCatchVariables": true,
    "exactOptionalPropertyTypes": false,
    "plugins": [
      { "name": "next" }
    ],
    "paths": {
      "@/*": ["./src/*"],
      "@insurtech/shared-ui": ["../../packages/shared-ui/src"],
      "@insurtech/shared-ui/*": ["../../packages/shared-ui/src/*"],
      "@insurtech/shared-types": ["../../packages/shared-types/src"],
      "@insurtech/shared-types/*": ["../../packages/shared-types/src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "src/**/*.ts",
    "src/**/*.tsx",
    ".next/types/**/*.ts",
    "playwright.config.ts",
    "vitest.config.ts"
  ],
  "exclude": ["node_modules", ".next", "coverage", "playwright-report", "test-results"]
}
```

### 5.5. `repo/apps/web-assure-portal/src/app/[locale]/layout.tsx` (~120 lignes)

```typescript
import type { Metadata, Viewport } from 'next';
import { Montserrat, Noto_Naskh_Arabic, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { SelfServiceLayout } from '@insurtech/shared-ui/layouts';
import { Providers } from '@/components/providers';
import { AssureBranding } from '@/components/AssureBranding';
import '@/app/globals.css';

const montserrat = Montserrat({
  subsets: ['latin', 'arabic'],
  weight: ['300', '400', '600', '700', '800'],
  variable: '--font-montserrat',
  display: 'swap',
  preload: true,
});

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-noto-naskh',
  display: 'swap',
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-geist-mono',
  display: 'swap',
  preload: false,
});

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export async function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: {
      default: t('title'),
      template: `%s | ${t('shortTitle')}`,
    },
    description: t('description'),
    applicationName: 'Skalean InsurTech -- Mon Espace Assure',
    keywords: [t('keywords.assurance'), t('keywords.maroc'), t('keywords.assure')],
    authors: [{ name: 'Skalean InsurTech', url: 'https://skalean-insurtech.ma' }],
    robots: { index: false, follow: false }, // Portal authentifie : non indexable
    openGraph: {
      type: 'website',
      locale: locale === 'fr' ? 'fr_MA' : locale === 'ar-MA' ? 'ar_MA' : 'ar_AR',
      siteName: 'Skalean InsurTech -- Mon Espace Assure',
    },
    alternates: {
      languages: {
        fr: '/fr',
        'ar-MA': '/ar-MA',
        ar: '/ar',
      },
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5, // a11y : permettre zoom utilisateur
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#B0CEE2' },
    { media: '(prefers-color-scheme: dark)', color: '#1A2730' },
  ],
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  if (!SUPPORTED_LOCALES.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme="assure"
      className={`${montserrat.variable} ${notoNaskh.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-white text-navy antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <SelfServiceLayout branding={<AssureBranding locale={locale} />}>
              {children}
            </SelfServiceLayout>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 5.6. `repo/apps/web-assure-portal/src/app/[locale]/page.tsx` (~80 lignes)

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@insurtech/shared-ui/components/card';
import { Button } from '@insurtech/shared-ui/components/button';
import { FileText, AlertCircle, CreditCard, User } from 'lucide-react';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('dashboard');

  // Sprint 5 implementera fetch user.policies + user.openClaims + user.duePayments
  const placeholderStats = {
    activePolicies: 0,
    openClaims: 0,
    duePayments: 0,
  };

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-4xl font-bold text-navy mb-2">
        {t('welcome')}
      </h1>
      <p className="text-lg text-gray-600 mb-8">{t('subtitle')}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Card className="bg-assure-primary-light border-assure-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-navy">
              {placeholderStats.activePolicies}
            </CardTitle>
            <CardDescription className="text-base">
              {t('stats.activePolicies')}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-assure-primary-light border-assure-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-navy">
              {placeholderStats.openClaims}
            </CardTitle>
            <CardDescription className="text-base">
              {t('stats.openClaims')}
            </CardDescription>
          </CardHeader>
        </Card>

        <Card className="bg-assure-primary-light border-assure-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-2xl text-navy">
              {placeholderStats.duePayments}
            </CardTitle>
            <CardDescription className="text-base">
              {t('stats.duePayments')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <h2 className="text-2xl font-semibold text-navy mb-4">{t('quickActions')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Button asChild size="lg" className="min-h-touch h-20 text-lg">
          <Link href={`/${locale}/polices`}>
            <FileText className="me-2" /> {t('actions.viewPolicies')}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="min-h-touch h-20 text-lg">
          <Link href={`/${locale}/sinistres/declarer`}>
            <AlertCircle className="me-2" /> {t('actions.declareClaim')}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="min-h-touch h-20 text-lg">
          <Link href={`/${locale}/paiements`}>
            <CreditCard className="me-2" /> {t('actions.payPremium')}
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="min-h-touch h-20 text-lg">
          <Link href={`/${locale}/profil`}>
            <User className="me-2" /> {t('actions.editProfile')}
          </Link>
        </Button>
      </div>
    </main>
  );
}
```

### 5.7. `repo/apps/web-assure-portal/src/app/[locale]/polices/page.tsx` (~60 lignes)

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardHeader, CardTitle, CardDescription } from '@insurtech/shared-ui/components/card';
import { EmptyState } from '@insurtech/shared-ui/components/empty-state';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'policies' });
  return { title: t('listTitle') };
}

export default async function PoliciesListPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('policies');

  // Sprint 17 implementera : useQuery(['policies', userId], () => apiClient.get('/v1/me/policies'))
  const placeholderPolicies: Array<{ id: string; type: string; status: string }> = [];

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-4xl font-bold text-navy mb-2">{t('listTitle')}</h1>
      <p className="text-lg text-gray-600 mb-8">{t('listSubtitle')}</p>

      {placeholderPolicies.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.description')}
          ctaLabel={t('empty.cta')}
          ctaHref={`/${locale}/`}
        />
      ) : (
        <div className="grid gap-4">
          {placeholderPolicies.map((policy) => (
            <Card key={policy.id} className="bg-white border-assure-primary">
              <CardHeader>
                <CardTitle>{policy.type}</CardTitle>
                <CardDescription>{policy.status}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-8 text-sm text-gray-500" data-testid="placeholder-notice">
        {t('placeholder.sprint17')}
      </p>
    </main>
  );
}
```

### 5.8. `repo/apps/web-assure-portal/src/app/[locale]/polices/[id]/page.tsx` (~80 lignes)

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@insurtech/shared-ui/components/card';
import { Button } from '@insurtech/shared-ui/components/button';
import { Download, FileSignature, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export default async function PolicyDetailPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('policies');

  // Sprint 17 fetchera donnees police
  // Sprint 11 implementera signature electronique Maroc-Sign / Barid-eSign
  // react-pdf preview du document police PDF (Sprint 16+)

  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <Link
        href={`/${locale}/polices`}
        className="text-sm text-assure-primary-dark hover:underline mb-4 inline-block"
      >
        {t('backToList')}
      </Link>

      <h1 className="text-4xl font-bold text-navy mb-2">
        {t('detailTitle', { id })}
      </h1>
      <p className="text-lg text-gray-600 mb-8">{t('detailSubtitle')}</p>

      <Card className="mb-6 bg-assure-primary-light border-assure-primary">
        <CardHeader>
          <CardTitle className="text-2xl">{t('placeholder.policyDetail')}</CardTitle>
          <CardDescription>{t('placeholder.sprint17Detail')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-base mb-4">
            {t('detailIntro', { id })}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Button size="lg" variant="outline" disabled className="min-h-touch h-16">
          <Download className="me-2" />
          {t('actions.downloadPdf')}
        </Button>
        <Button size="lg" variant="outline" disabled className="min-h-touch h-16">
          <FileSignature className="me-2" />
          {t('actions.signElectronic')}
        </Button>
        <Button asChild size="lg" className="min-h-touch h-16">
          <Link href={`/${locale}/sinistres/declarer?policyId=${id}`}>
            <AlertCircle className="me-2" />
            {t('actions.declareClaim')}
          </Link>
        </Button>
      </div>

      <p className="mt-8 text-sm text-gray-500" data-testid="placeholder-notice">
        {t('placeholder.sprint11Sign')} -- {t('placeholder.sprint16Pdf')}
      </p>
    </main>
  );
}
```

### 5.9. `repo/apps/web-assure-portal/src/app/[locale]/sinistres/page.tsx` (~60 lignes)

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmptyState } from '@insurtech/shared-ui/components/empty-state';
import { Button } from '@insurtech/shared-ui/components/button';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export default async function ClaimsListPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('claims');

  // Sprint 19 implementera fetch user.claims
  const placeholderClaims: Array<{ id: string; status: string; declaredAt: string }> = [];

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold text-navy mb-2">{t('listTitle')}</h1>
          <p className="text-lg text-gray-600">{t('listSubtitle')}</p>
        </div>
        <Button asChild size="lg" className="min-h-touch">
          <Link href={`/${locale}/sinistres/declarer`}>
            <AlertCircle className="me-2" />
            {t('declareNew')}
          </Link>
        </Button>
      </div>

      {placeholderClaims.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.description')}
          ctaLabel={t('empty.cta')}
          ctaHref={`/${locale}/sinistres/declarer`}
        />
      ) : null}

      <p className="mt-8 text-sm text-gray-500" data-testid="placeholder-notice">
        {t('placeholder.sprint19')}
      </p>
    </main>
  );
}
```

### 5.10. `repo/apps/web-assure-portal/src/app/[locale]/sinistres/declarer/page.tsx` (~80 lignes)

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@insurtech/shared-ui/components/card';
import { Button } from '@insurtech/shared-ui/components/button';
import { Smartphone, AlertCircle } from 'lucide-react';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

const MOBILE_UA_REGEX = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export default async function DeclareClaimPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ policyId?: string }>;
}) {
  const { locale } = await params;
  const { policyId } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('claims.declare');

  // Sprint 25 : detection UA mobile -> redirect vers web-assure-mobile PWA
  const headersList = await headers();
  const ua = headersList.get('user-agent') || '';
  const isMobile = MOBILE_UA_REGEX.test(ua);
  const mobilePortalUrl = process.env.NEXT_PUBLIC_MOBILE_PORTAL_URL;

  if (isMobile && mobilePortalUrl && process.env.NEXT_PUBLIC_ENABLE_MOBILE_REDIRECT === 'true') {
    const redirectUrl = `${mobilePortalUrl}/${locale}/declarer${policyId ? `?policyId=${policyId}` : ''}`;
    redirect(redirectUrl);
  }

  // Desktop : formulaire simple Sprint 19, ici placeholder
  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-4xl font-bold text-navy mb-2">
        <AlertCircle className="inline me-3 text-assure-cta" />
        {t('title')}
      </h1>
      <p className="text-lg text-gray-600 mb-8">{t('subtitle')}</p>

      <Card className="mb-6 bg-assure-primary-light border-assure-primary">
        <CardHeader>
          <CardTitle>{t('placeholder.title')}</CardTitle>
          <CardDescription>{t('placeholder.sprint19')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-base">{t('placeholder.intro')}</p>
        </CardContent>
      </Card>

      <Card className="bg-white border-assure-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="text-assure-cta" />
            {t('mobileSuggestion.title')}
          </CardTitle>
          <CardDescription>{t('mobileSuggestion.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="min-h-touch">
            <a href={mobilePortalUrl || '#'}>
              {t('mobileSuggestion.cta')}
            </a>
          </Button>
        </CardContent>
      </Card>

      <p className="mt-8 text-sm text-gray-500" data-testid="placeholder-notice">
        {t('placeholder.sprint25Mobile')}
      </p>
    </main>
  );
}
```

### 5.11. `repo/apps/web-assure-portal/src/app/[locale]/profil/page.tsx` (~80 lignes)

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@insurtech/shared-ui/components/card';
import { Button } from '@insurtech/shared-ui/components/button';
import { Download, Trash2, KeyRound, FileEdit } from 'lucide-react';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('profile');

  return (
    <main className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-4xl font-bold text-navy mb-2">{t('title')}</h1>
      <p className="text-lg text-gray-600 mb-8">{t('subtitle')}</p>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-navy mb-4">{t('personalInfo.title')}</h2>
        <Card className="bg-white border-assure-primary">
          <CardHeader>
            <CardTitle>{t('placeholder.title')}</CardTitle>
            <CardDescription>{t('placeholder.sprint5')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">{t('personalInfo.fullName')}</p>
              <p className="text-base">{t('placeholder.value')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('personalInfo.email')}</p>
              <p className="text-base">{t('placeholder.value')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('personalInfo.phone')}</p>
              <p className="text-base">{t('placeholder.value')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('personalInfo.cinNumber')}</p>
              <p className="text-base">{t('placeholder.value')}</p>
            </div>
            <Button size="lg" variant="outline" disabled className="min-h-touch">
              <FileEdit className="me-2" /> {t('actions.editInfo')}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-navy mb-4">{t('security.title')}</h2>
        <Button size="lg" variant="outline" disabled className="min-h-touch">
          <KeyRound className="me-2" /> {t('security.changePassword')}
        </Button>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold text-navy mb-4">{t('rgpd.title')}</h2>
        <p className="text-base text-gray-600 mb-4">{t('rgpd.subtitle')}</p>
        <p className="text-sm text-gray-500 mb-4">{t('rgpd.legalRef')}</p>
        <div className="space-y-3">
          <Button size="lg" variant="outline" disabled className="min-h-touch w-full sm:w-auto">
            <Download className="me-2" /> {t('rgpd.exportData')}
          </Button>
          <Button size="lg" variant="destructive" disabled className="min-h-touch w-full sm:w-auto">
            <Trash2 className="me-2" /> {t('rgpd.eraseAccount')}
          </Button>
        </div>
        <p className="mt-4 text-sm text-gray-500" data-testid="rgpd-placeholder">
          {t('placeholder.sprint14Rgpd')}
        </p>
      </section>
    </main>
  );
}
```

### 5.12. `repo/apps/web-assure-portal/src/app/[locale]/paiements/page.tsx` (~60 lignes)

```typescript
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EmptyState } from '@insurtech/shared-ui/components/empty-state';
import { formatCurrency, formatDate } from '@/lib/format';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export default async function PaymentsListPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('payments');

  // Sprint 16 implementera fetch user.paymentsHistory
  const placeholderPayments: Array<{ id: string; amount: number; date: string; status: string }> = [];

  return (
    <main className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-4xl font-bold text-navy mb-2">{t('listTitle')}</h1>
      <p className="text-lg text-gray-600 mb-8">{t('listSubtitle')}</p>

      <p className="text-sm text-gray-500 mb-4">
        {t('format.example')}: {formatCurrency(1234.56, locale)}
      </p>

      {placeholderPayments.length === 0 ? (
        <EmptyState
          title={t('empty.title')}
          description={t('empty.description')}
        />
      ) : (
        <div className="grid gap-4">
          {placeholderPayments.map((p) => (
            <div key={p.id} className="border border-assure-primary p-4 rounded-lg bg-white">
              <p className="text-lg font-semibold">{formatCurrency(p.amount, locale)}</p>
              <p className="text-sm text-gray-500">{formatDate(p.date, locale)}</p>
              <p className="text-sm">{p.status}</p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-sm text-gray-500" data-testid="placeholder-notice">
        {t('placeholder.sprint16')}
      </p>
    </main>
  );
}
```

### 5.13. `repo/apps/web-assure-portal/src/middleware.ts` (~60 lignes)

```typescript
import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['fr', 'ar-MA', 'ar'],
  defaultLocale: 'fr',
  localePrefix: 'always',
  localeDetection: true,
});

const PROTECTED_PATHS = ['/polices', '/sinistres', '/profil', '/paiements'];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Bypass API + statics
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Sprint 5 : verifier session NextAuth + role assure_user
  // Pour Sprint 4 placeholder : laisser passer (auth gate stub a activer Sprint 5)
  const requiresAuth = PROTECTED_PATHS.some((p) => pathname.includes(p));
  const sessionCookie = request.cookies.get('next-auth.session-token');

  if (requiresAuth && !sessionCookie && process.env.NEXT_PUBLIC_ENABLE_AUTH_GATE === 'true') {
    const locale = pathname.split('/')[1] || 'fr';
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
```

### 5.14. `repo/apps/web-assure-portal/src/i18n/request.ts` (~40 lignes)

```typescript
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';

const SUPPORTED_LOCALES = ['fr', 'ar-MA', 'ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale = SUPPORTED_LOCALES.includes(requested as Locale)
    ? (requested as Locale)
    : 'fr';

  if (!SUPPORTED_LOCALES.includes(locale)) {
    notFound();
  }

  let messages;
  try {
    messages = (await import(`@/messages/${locale}.json`)).default;
  } catch (error) {
    console.error(`Missing messages for locale ${locale}`, error);
    messages = (await import(`@/messages/fr.json`)).default;
  }

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
      number: {
        currencyMAD: { style: 'currency', currency: 'MAD' },
      },
    },
  };
});
```

### 5.15. `repo/apps/web-assure-portal/src/messages/fr.json` (~60 cles)

```json
{
  "metadata": {
    "title": "Mon Espace Assure -- Skalean InsurTech",
    "shortTitle": "Mon Espace",
    "description": "Consultez vos polices, declarez un sinistre, payez votre prime et gerez votre profil en toute securite.",
    "keywords": {
      "assurance": "assurance maroc",
      "maroc": "maroc",
      "assure": "assure self-service"
    }
  },
  "nav": {
    "dashboard": "Tableau de bord",
    "polices": "Mes polices",
    "sinistres": "Mes sinistres",
    "profil": "Mon profil",
    "paiements": "Paiements",
    "logout": "Se deconnecter"
  },
  "dashboard": {
    "welcome": "Bienvenue dans votre espace assure",
    "subtitle": "Vue d'ensemble de vos contrats, sinistres et paiements",
    "stats": {
      "activePolicies": "Polices actives",
      "openClaims": "Sinistres ouverts",
      "duePayments": "Paiements dus"
    },
    "quickActions": "Actions rapides",
    "actions": {
      "viewPolicies": "Voir mes polices",
      "declareClaim": "Declarer un sinistre",
      "payPremium": "Payer ma prime",
      "editProfile": "Modifier mon profil"
    }
  },
  "policies": {
    "listTitle": "Mes polices",
    "listSubtitle": "Tous vos contrats d'assurance souscrits",
    "detailTitle": "Police {id}",
    "detailSubtitle": "Details du contrat",
    "detailIntro": "Consultez les details de votre police {id}.",
    "backToList": "Retour a la liste",
    "active": "Active",
    "expired": "Expiree",
    "canceled": "Resiliee",
    "renewable": "A renouveler",
    "actions": {
      "downloadPdf": "Telecharger PDF",
      "signElectronic": "Signer electroniquement",
      "declareClaim": "Declarer un sinistre"
    },
    "empty": {
      "title": "Aucune police trouvee",
      "description": "Vous n'avez pas encore de contrat d'assurance souscrit.",
      "cta": "Retour au tableau de bord"
    },
    "placeholder": {
      "sprint17": "La liste detaillee de vos polices sera disponible Sprint 17 (Souscription).",
      "policyDetail": "Detail de la police",
      "sprint17Detail": "Affichage detaille a venir Sprint 17.",
      "sprint11Sign": "Signature electronique disponible Sprint 11 (Maroc-Sign / Barid-eSign).",
      "sprint16Pdf": "Apercu PDF disponible Sprint 16."
    }
  },
  "claims": {
    "listTitle": "Mes sinistres",
    "listSubtitle": "Suivi de vos declarations de sinistre",
    "declareNew": "Declarer un nouveau sinistre",
    "declared": "Declare",
    "inProgress": "En cours de traitement",
    "settled": "Regle",
    "denied": "Rejete",
    "empty": {
      "title": "Aucun sinistre declare",
      "description": "Vous n'avez declare aucun sinistre pour le moment.",
      "cta": "Declarer un sinistre"
    },
    "placeholder": {
      "sprint19": "La liste de vos sinistres sera disponible Sprint 19 (Sinistres self-service)."
    },
    "declare": {
      "title": "Declarer un sinistre",
      "subtitle": "Renseignez les informations relatives au sinistre",
      "mobileSuggestion": {
        "title": "Vous etes sur mobile ?",
        "description": "Pour une experience optimale (photos, geolocalisation), utilisez l'application mobile Mon Espace.",
        "cta": "Ouvrir l'app mobile"
      },
      "placeholder": {
        "title": "Formulaire de declaration",
        "sprint19": "Le formulaire complet de declaration sera disponible Sprint 19.",
        "sprint25Mobile": "La redirection automatique vers l'app mobile sera activee Sprint 25.",
        "intro": "Le parcours de declaration guide vous accompagnera etape par etape : type de sinistre, circonstances, documents, attestation."
      }
    }
  },
  "profile": {
    "title": "Mon profil",
    "subtitle": "Gerez vos informations personnelles et vos preferences",
    "personalInfo": {
      "title": "Informations personnelles",
      "fullName": "Nom complet",
      "email": "Adresse e-mail",
      "phone": "Telephone",
      "cinNumber": "Numero CIN",
      "address": "Adresse"
    },
    "documents": "Documents",
    "beneficiaries": "Beneficiaires",
    "paymentMethods": "Moyens de paiement",
    "security": {
      "title": "Securite",
      "changePassword": "Modifier mon mot de passe"
    },
    "rgpd": {
      "title": "Mes droits CNDP",
      "subtitle": "Conformement a la Loi 09-08 sur la protection des donnees personnelles, vous pouvez exercer vos droits d'acces, de rectification et de suppression.",
      "legalRef": "Loi 09-08 -- CNDP -- Articles 7, 9, 10 et 11.",
      "exportData": "Exporter mes donnees personnelles",
      "eraseAccount": "Supprimer mon compte"
    },
    "actions": {
      "editInfo": "Modifier mes informations"
    },
    "placeholder": {
      "title": "Informations personnelles (placeholder)",
      "value": "(donnees Sprint 5)",
      "sprint5": "Les donnees du profil seront disponibles Sprint 5 (Auth NextAuth).",
      "sprint14Rgpd": "L'exercice des droits CNDP sera actif Sprint 14 (Compliance CNDP)."
    }
  },
  "payments": {
    "listTitle": "Mes paiements",
    "listSubtitle": "Historique de vos paiements de primes",
    "paid": "Paye",
    "pending": "En attente",
    "overdue": "En retard",
    "format": {
      "example": "Format MAD"
    },
    "empty": {
      "title": "Aucun paiement enregistre",
      "description": "Votre historique de paiements apparaitra ici."
    },
    "placeholder": {
      "sprint16": "L'historique des paiements et le paiement en ligne seront disponibles Sprint 16 (Paiement assure)."
    }
  },
  "errors": {
    "404": {
      "title": "Page introuvable",
      "description": "La page que vous recherchez n'existe pas dans votre espace assure.",
      "cta": "Retour au tableau de bord"
    },
    "500": {
      "title": "Erreur technique",
      "description": "Une erreur est survenue. Veuillez reessayer ou contacter le support.",
      "cta": "Reessayer"
    }
  },
  "footer": {
    "compliance": "Skalean InsurTech est conforme ACAPS et CNDP (Loi 09-08).",
    "legal": "Mentions legales",
    "privacy": "Politique de confidentialite",
    "contact": "Nous contacter"
  }
}
```

### 5.16. `repo/apps/web-assure-portal/src/messages/ar-MA.json` (Darija marocain, extrait clefs principales)

```json
{
  "metadata": {
    "title": "الفضاء ديالي -- Skalean InsurTech",
    "shortTitle": "الفضاء ديالي",
    "description": "شوف بوليصاتك، صرح بالحادث، خلص الكوتيزاسيون و عدل البروفايل ديالك.",
    "keywords": {
      "assurance": "تأمين المغرب",
      "maroc": "المغرب",
      "assure": "مؤمن سيلف سيرفيس"
    }
  },
  "nav": {
    "dashboard": "اللوحة",
    "polices": "البوليصات ديالي",
    "sinistres": "الحوادث ديالي",
    "profil": "البروفايل ديالي",
    "paiements": "الخلاص",
    "logout": "خروج"
  },
  "dashboard": {
    "welcome": "مرحبا بيك فالفضاء ديالك",
    "subtitle": "كل البوليصات، الحوادث و الخلاص",
    "stats": {
      "activePolicies": "بوليصات نشطة",
      "openClaims": "حوادث مفتوحة",
      "duePayments": "خلاصات مستحقة"
    },
    "quickActions": "أعمال سريعة",
    "actions": {
      "viewPolicies": "شوف البوليصات",
      "declareClaim": "صرح بحادث",
      "payPremium": "خلص الكوتيزاسيون",
      "editProfile": "عدل البروفايل"
    }
  },
  "policies": {
    "listTitle": "البوليصات ديالي",
    "listSubtitle": "كل عقود التأمين ديالك",
    "active": "نشطة",
    "expired": "منتهية",
    "canceled": "مفسوخة",
    "renewable": "خاصها تجديد"
  },
  "claims": {
    "listTitle": "الحوادث ديالي",
    "declared": "مصرح بيه",
    "inProgress": "كيتعالج",
    "settled": "تخلص",
    "denied": "مرفوض"
  },
  "footer": {
    "compliance": "Skalean InsurTech كيحترم ACAPS و CNDP (قانون 09-08)."
  }
}
```

### 5.17. `repo/apps/web-assure-portal/src/messages/ar.json` (arabe classique RTL, extrait)

```json
{
  "metadata": {
    "title": "فضائي -- سكالين إنشورتك",
    "shortTitle": "فضائي",
    "description": "اطلع على وثائقك، صرح بحادث، ادفع قسطك وعدل ملفك الشخصي بأمان."
  },
  "nav": {
    "dashboard": "لوحة التحكم",
    "polices": "وثائقي",
    "sinistres": "حوادثي",
    "profil": "ملفي الشخصي",
    "paiements": "المدفوعات",
    "logout": "تسجيل الخروج"
  },
  "dashboard": {
    "welcome": "مرحبًا بكم في فضاء المؤمن لكم",
    "subtitle": "نظرة شاملة على عقودكم وحوادثكم ومدفوعاتكم",
    "stats": {
      "activePolicies": "الوثائق النشطة",
      "openClaims": "الحوادث المفتوحة",
      "duePayments": "المدفوعات المستحقة"
    },
    "quickActions": "إجراءات سريعة",
    "actions": {
      "viewPolicies": "عرض وثائقي",
      "declareClaim": "التصريح بحادث",
      "payPremium": "دفع القسط",
      "editProfile": "تعديل ملفي الشخصي"
    }
  },
  "policies": {
    "listTitle": "وثائقي",
    "active": "نشطة",
    "expired": "منتهية الصلاحية",
    "canceled": "ملغاة",
    "renewable": "قابلة للتجديد"
  },
  "claims": {
    "listTitle": "حوادثي",
    "declared": "مُصرّح به",
    "inProgress": "قيد المعالجة",
    "settled": "مسوّى",
    "denied": "مرفوض"
  },
  "footer": {
    "compliance": "تحترم سكالين إنشورتك معايير ACAPS وCNDP (القانون 09-08)."
  }
}
```

### 5.18. `repo/apps/web-assure-portal/src/lib/api-client.ts` (~120 lignes)

```typescript
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const API_TIMEOUT_MS = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || '15000', 10);

const MUTATION_METHODS = ['post', 'put', 'patch', 'delete'];

const PROTECTED_PATHS = ['/me/', '/policies', '/claims', '/payments', '/profile'];

interface RequestContext {
  tenantId?: string | null;
  userId?: string | null;
  traceId?: string | null;
  authToken?: string | null;
}

function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function generateIdempotencyKey(): string {
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function getRequestContext(): RequestContext {
  if (typeof window === 'undefined') {
    return { tenantId: null, userId: null, traceId: null, authToken: null };
  }

  const tenantId = window.localStorage.getItem('insurtech.tenantId');
  const userId = window.localStorage.getItem('insurtech.userId');
  const authToken = window.sessionStorage.getItem('insurtech.token');

  return {
    tenantId,
    userId,
    traceId: generateTraceId(),
    authToken,
  };
}

export function createApiClient(baseUrl: string = API_BASE_URL): AxiosInstance {
  const client = axios.create({
    baseURL: baseUrl,
    timeout: API_TIMEOUT_MS,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  });

  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const ctx = getRequestContext();

      // x-tenant-id : multi-tenant scoping
      if (ctx.tenantId) {
        config.headers.set('x-tenant-id', ctx.tenantId);
      }

      // x-user-id : L3 scoping CRITIQUE pour assure_user (RLS Sprint 6)
      // Si URL touche donnees personnelles ET pas de userId -> refuser requete
      const isProtectedPath = PROTECTED_PATHS.some((p) => config.url?.includes(p));
      if (isProtectedPath && !ctx.userId) {
        throw new Error(
          'web-assure-portal: x-user-id manquant pour endpoint protege L3 -- ' +
          'risque fuite donnees inter-assures (RGPD/CNDP). Verifier session NextAuth.'
        );
      }
      if (ctx.userId) {
        config.headers.set('x-user-id', ctx.userId);
      }

      // x-trace-id : observabilite distributed tracing
      config.headers.set('x-trace-id', ctx.traceId || generateTraceId());

      // Authorization Bearer JWT (Sprint 5)
      if (ctx.authToken) {
        config.headers.set('Authorization', `Bearer ${ctx.authToken}`);
      }

      // Idempotency-Key sur mutations uniquement (filter GET)
      const method = (config.method || 'get').toLowerCase();
      if (MUTATION_METHODS.includes(method) && !config.headers.has('Idempotency-Key')) {
        config.headers.set('Idempotency-Key', generateIdempotencyKey());
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401) {
        if (typeof window !== 'undefined') {
          window.location.href = '/fr/auth/login?reason=session-expired';
        }
      }
      if (error.response?.status === 403) {
        console.warn('Access denied -- role assure_user check failed', error.config?.url);
      }
      return Promise.reject(error);
    }
  );

  return client;
}

export const apiClient = createApiClient();
```

### 5.19. `repo/apps/web-assure-portal/src/lib/query-client.ts` (~50 lignes)

```typescript
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 min
        gcTime: 30 * 60 * 1000, // 30 min
        retry: (failureCount, error: any) => {
          if ([401, 403, 404].includes(error?.response?.status)) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: false,
      },
    },
    queryCache: new QueryCache({
      onError: (error: any, query) => {
        console.error(`[Query error] key=${JSON.stringify(query.queryKey)}`, error?.message);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error: any, _vars, _ctx, mutation) => {
        console.error(`[Mutation error] key=${JSON.stringify(mutation.options.mutationKey)}`, error?.message);
      },
    }),
  });
}
```

### 5.20. `repo/apps/web-assure-portal/src/lib/format.ts` (~100 lignes)

```typescript
import currency from 'currency.js';

type SupportedLocale = 'fr' | 'ar-MA' | 'ar';

const LOCALE_MAP: Record<SupportedLocale, string> = {
  fr: 'fr-MA',
  'ar-MA': 'ar-MA',
  ar: 'ar-MA',
};

/**
 * Formate un montant en MAD (Dirham Marocain) selon locale.
 * Exemples :
 *   formatCurrency(1234.56, 'fr')    -> "1 234,56 DH"
 *   formatCurrency(1234.56, 'ar-MA') -> "1٬234٫56 د.م." (chiffres latin par defaut)
 *   formatCurrency(1234.56, 'ar')    -> "١٬٢٣٤٫٥٦ د.م." (chiffres arabo-indiens)
 */
export function formatCurrency(
  amount: number,
  locale: SupportedLocale,
  options: { numerals?: 'western' | 'arabic-indic' } = {}
): string {
  const intlLocale = LOCALE_MAP[locale];
  const numerals = options.numerals ?? (locale === 'ar' ? 'arabic-indic' : 'western');
  const numberingSystem = numerals === 'arabic-indic' ? 'arab' : 'latn';

  return new Intl.NumberFormat(`${intlLocale}-u-nu-${numberingSystem}`, {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formate un montant en MAD via currency.js (precision decimale exacte, evite floating).
 */
export function formatCurrencyExact(amount: number | string, locale: SupportedLocale): string {
  const value = currency(amount, { precision: 2, symbol: 'DH', separator: ' ', decimal: ',' });
  return locale === 'fr' ? value.format() : formatCurrency(value.value, locale);
}

/**
 * Normalise un numero de telephone marocain au format E.164 +212XXXXXXXXX.
 * Accepte : 0612345678, +212612345678, 06.12.34.56.78, 06 12 34 56 78
 */
export function normalizePhone(input: string): string {
  const digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+212')) return digits;
  if (digits.startsWith('00212')) return `+${digits.slice(2)}`;
  if (digits.startsWith('0') && digits.length === 10) return `+212${digits.slice(1)}`;
  if (digits.startsWith('212') && digits.length === 12) return `+${digits}`;
  return digits;
}

/**
 * Formate un telephone marocain pour affichage : +212 6 12 34 56 78
 */
export function formatPhone(input: string): string {
  const normalized = normalizePhone(input);
  if (!normalized.startsWith('+212') || normalized.length !== 13) return input;
  const local = normalized.slice(4);
  return `+212 ${local[0]} ${local.slice(1, 3)} ${local.slice(3, 5)} ${local.slice(5, 7)} ${local.slice(7, 9)}`;
}

/**
 * Valide un telephone marocain (mobile +212 6XX ou 7XX, fixe +212 5XX).
 */
export function isValidMoroccanPhone(input: string): boolean {
  const normalized = normalizePhone(input);
  return /^\+212[567]\d{8}$/.test(normalized);
}

/**
 * Formate un numero de police : POL-2026-AUTO-000123
 */
export function formatPolicyNumber(prefix: string, year: number, type: string, sequence: number): string {
  const seq = String(sequence).padStart(6, '0');
  return `${prefix}-${year}-${type.toUpperCase()}-${seq}`;
}

/**
 * Formate une date selon locale.
 */
export function formatDate(input: string | Date, locale: SupportedLocale, format: 'short' | 'long' = 'short'): string {
  const date = typeof input === 'string' ? new Date(input) : input;
  const intlLocale = LOCALE_MAP[locale];
  const options: Intl.DateTimeFormatOptions = format === 'short'
    ? { day: 'numeric', month: 'short', year: 'numeric' }
    : { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat(intlLocale, options).format(date);
}

/**
 * Formate un CIN marocain (lettre + 6-7 chiffres) -> "AB 123456"
 */
export function formatCIN(input: string): string {
  const normalized = input.toUpperCase().replace(/\s/g, '');
  const match = normalized.match(/^([A-Z]{1,2})(\d{4,7})$/);
  return match ? `${match[1]} ${match[2]}` : input;
}
```

### 5.21. `repo/apps/web-assure-portal/src/components/providers.tsx` (~80 lignes)

```typescript
'use client';

import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { createQueryClient } from '@/lib/query-client';
import { IdleTimeoutProvider } from '@/components/IdleTimeoutProvider';

const IDLE_TIMEOUT_MS = parseInt(process.env.NEXT_PUBLIC_IDLE_TIMEOUT_MS || '1800000', 10);
const IDLE_WARNING_MS = parseInt(process.env.NEXT_PUBLIC_IDLE_WARNING_MS || '300000', 10);

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => createQueryClient());

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      forcedTheme="light"
    >
      <QueryClientProvider client={queryClient}>
        <IdleTimeoutProvider
          timeoutMs={IDLE_TIMEOUT_MS}
          warningMs={IDLE_WARNING_MS}
        >
          {children}
        </IdleTimeoutProvider>
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

### 5.22. `repo/apps/web-assure-portal/src/components/AssureBranding.tsx` (~60 lignes)

```typescript
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Shield } from 'lucide-react';

interface AssureBrandingProps {
  locale: string;
}

export function AssureBranding({ locale }: AssureBrandingProps) {
  const t = useTranslations('nav');

  return (
    <Link
      href={`/${locale}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-assure-primary-light transition-colors rounded-md"
      aria-label={t('dashboard')}
    >
      <div className="bg-assure-primary p-2 rounded-full">
        <Shield className="h-6 w-6 text-navy" aria-hidden="true" />
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-navy leading-tight">Skalean</span>
        <span className="text-xs text-gray-600 leading-tight">Mon Espace Assure</span>
      </div>
    </Link>
  );
}
```

### 5.23. `repo/apps/web-assure-portal/.env.example` (~25 lignes, 17 vars NEXT_PUBLIC_*)

```bash
# ============================================================
# web-assure-portal -- .env.example
# Toutes les variables NEXT_PUBLIC_* sont CLIENT-SAFE
# JAMAIS de secret ici (decision-006 + securite frontend)
# ============================================================

# API Backend (NestJS Sprint 3)
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_API_TIMEOUT_MS=15000

# Mobile portal (web-assure-mobile PWA, port 3006)
NEXT_PUBLIC_MOBILE_PORTAL_URL=http://localhost:3006
NEXT_PUBLIC_ENABLE_MOBILE_REDIRECT=false

# Auth gate (Sprint 5)
NEXT_PUBLIC_ENABLE_AUTH_GATE=false
NEXT_PUBLIC_AUTH_LOGIN_URL=/auth/login

# Idle timeout (assure 30 min, warning 5 min avant)
NEXT_PUBLIC_IDLE_TIMEOUT_MS=1800000
NEXT_PUBLIC_IDLE_WARNING_MS=300000

# Branding & branding tenant
NEXT_PUBLIC_APP_NAME=Mon Espace Assure
NEXT_PUBLIC_APP_VERSION=0.1.0
NEXT_PUBLIC_BRAND_PRIMARY=#B0CEE2

# Sentry (vide en dev = init skip)
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_SENTRY_ENVIRONMENT=development

# CDN Atlas Cloud Benguerir (decision-008)
NEXT_PUBLIC_CDN_URL=http://localhost:9000
NEXT_PUBLIC_S3_BUCKET=insurtech-assets-dev

# Feature flags Sprint 4
NEXT_PUBLIC_FEATURE_RGPD_EXPORT=false
NEXT_PUBLIC_FEATURE_ELECTRONIC_SIGNATURE=false

# Numerals preference (western | arabic-indic)
NEXT_PUBLIC_DEFAULT_NUMERALS=western
```

### 5.24. `repo/apps/web-assure-portal/src/app/globals.css` (~40 lignes)

```css
@import "tailwindcss";
@import "@insurtech/shared-ui/styles/base.css";

@theme {
  /* Variant assure : Sky Blue dominant (rassurant pastel) */
  --color-primary: #B0CEE2;
  --color-primary-dark: #7FA8C4;
  --color-primary-light: #D4E3EE;
  --color-cta: #E95D2C;
  --color-navy: #1A2730;

  /* Base font 18 px (vs 14 px standard) accessibilite assure non-tech */
  --font-size-base: 1.125rem;
  --line-height-base: 1.75rem;

  /* Touch target minimum WCAG 2.5.5 Level AAA */
  --touch-target-min: 44px;

  /* Reassuring backgrounds */
  --bg-assure-page: #FAFCFD;
  --bg-assure-card: #FFFFFF;
}

[data-theme="assure"] {
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  background-color: var(--bg-assure-page);
}

[data-theme="assure"] button,
[data-theme="assure"] a[role="button"] {
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
}

[data-theme="assure"][dir="rtl"] {
  font-family: var(--font-noto-naskh), var(--font-montserrat), system-ui, sans-serif;
}
```

### 5.25. `repo/apps/web-assure-portal/playwright.config.ts` (~70 lignes)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
    process.env.CI ? ['github'] : ['line'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3005',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 14'] } },
    {
      name: 'small-mobile',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 320, height: 568 },
      },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3005',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

### 5.26. `repo/apps/web-assure-portal/src/components/IdleTimeoutProvider.tsx` (~60 lignes)

```typescript
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  children: ReactNode;
  timeoutMs: number;
  warningMs: number;
}

export function IdleTimeoutProvider({ children, timeoutMs, warningMs }: Props) {
  const [showWarning, setShowWarning] = useState(false);
  const idleTimer = useRef<NodeJS.Timeout | null>(null);
  const warningTimer = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations('idle');

  const resetTimers = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    setShowWarning(false);

    warningTimer.current = setTimeout(() => setShowWarning(true), timeoutMs - warningMs);
    idleTimer.current = setTimeout(() => {
      // Sprint 5 : NextAuth signOut + redirect /login
      if (typeof window !== 'undefined') {
        window.location.href = '/fr/auth/login?reason=idle-timeout';
      }
    }, timeoutMs);
  };

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, resetTimers));
    resetTimers();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetTimers));
      if (idleTimer.current) clearTimeout(idleTimer.current);
      if (warningTimer.current) clearTimeout(warningTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, warningMs]);

  return (
    <>
      {showWarning && (
        <div role="alertdialog" aria-live="assertive" className="fixed bottom-4 right-4 bg-assure-cta text-white p-4 rounded-lg shadow-lg max-w-sm z-50">
          <p className="font-semibold mb-2">Session bientot expiree</p>
          <p className="text-sm">Cliquez n'importe ou pour rester connecte.</p>
        </div>
      )}
      {children}
    </>
  );
}
```

### 5.27. `repo/apps/web-assure-portal/src/app/[locale]/not-found.tsx` (~40 lignes)

```typescript
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@insurtech/shared-ui/components/button';
import { Home } from 'lucide-react';

export default async function NotFound() {
  const t = await getTranslations('errors.404');
  return (
    <main className="container mx-auto px-4 py-16 max-w-2xl text-center">
      <h1 className="text-6xl font-bold text-assure-primary mb-4">404</h1>
      <h2 className="text-3xl font-semibold text-navy mb-4">{t('title')}</h2>
      <p className="text-lg text-gray-600 mb-8">{t('description')}</p>
      <Button asChild size="lg" className="min-h-touch">
        <Link href="/fr">
          <Home className="me-2" /> {t('cta')}
        </Link>
      </Button>
    </main>
  );
}
```

### 5.28. `repo/apps/web-assure-portal/src/app/[locale]/error.tsx` (~50 lignes)

```typescript
'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@insurtech/shared-ui/components/button';
import { RefreshCw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors.500');

  useEffect(() => {
    console.error('[web-assure-portal] runtime error', { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <main className="container mx-auto px-4 py-16 max-w-2xl text-center">
      <h1 className="text-6xl font-bold text-assure-cta mb-4">500</h1>
      <h2 className="text-3xl font-semibold text-navy mb-4">{t('title')}</h2>
      <p className="text-lg text-gray-600 mb-8">{t('description')}</p>
      <Button onClick={() => reset()} size="lg" className="min-h-touch">
        <RefreshCw className="me-2" /> {t('cta')}
      </Button>
      {error.digest && (
        <p className="mt-8 text-sm text-gray-400">Trace ID: {error.digest}</p>
      )}
    </main>
  );
}
```

---

## 6. Tests complets (15-30 ko, 18-22 tests)

### 6.1. `tests/unit/api-client.spec.ts` (~140 lignes, 10 tests)

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createApiClient, getRequestContext } from '@/lib/api-client';

describe('api-client', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: {
        store: {} as Record<string, string>,
        getItem(k: string) { return this.store[k] || null; },
        setItem(k: string, v: string) { this.store[k] = v; },
        clear() { this.store = {}; },
      },
      configurable: true,
    });
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        store: {} as Record<string, string>,
        getItem(k: string) { return this.store[k] || null; },
        setItem(k: string, v: string) { this.store[k] = v; },
        clear() { this.store = {}; },
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an axios instance with baseURL and timeout', () => {
    const client = createApiClient('http://localhost:4000');
    expect(client.defaults.baseURL).toBe('http://localhost:4000');
    expect(client.defaults.timeout).toBeGreaterThan(0);
  });

  it('injects x-tenant-id header from localStorage', async () => {
    window.localStorage.setItem('insurtech.tenantId', 'tenant-skalean-001');
    window.localStorage.setItem('insurtech.userId', 'assure-user-123');
    const client = createApiClient();
    const config = await client.interceptors.request.handlers[0].fulfilled({
      headers: new Map(), method: 'get', url: '/v1/health',
    } as any);
    expect((config.headers as any).get('x-tenant-id')).toBe('tenant-skalean-001');
  });

  it('injects x-user-id header for L3 scoping (CRITIQUE assure_user)', async () => {
    window.localStorage.setItem('insurtech.tenantId', 'tenant-001');
    window.localStorage.setItem('insurtech.userId', 'assure-789');
    const client = createApiClient();
    const config = await client.interceptors.request.handlers[0].fulfilled({
      headers: new Map(), method: 'get', url: '/v1/me/policies',
    } as any);
    expect((config.headers as any).get('x-user-id')).toBe('assure-789');
  });

  it('throws if x-user-id missing on protected path /me/', async () => {
    window.localStorage.setItem('insurtech.tenantId', 'tenant-001');
    // NO userId
    const client = createApiClient();
    await expect(
      client.interceptors.request.handlers[0].fulfilled({
        headers: new Map(), method: 'get', url: '/v1/me/policies',
      } as any)
    ).rejects.toThrow(/x-user-id manquant/);
  });

  it('throws if x-user-id missing on /policies', async () => {
    window.localStorage.setItem('insurtech.tenantId', 'tenant-001');
    const client = createApiClient();
    await expect(
      client.interceptors.request.handlers[0].fulfilled({
        headers: new Map(), method: 'get', url: '/v1/policies/123',
      } as any)
    ).rejects.toThrow(/RGPD\/CNDP/);
  });

  it('does not throw on public path /health without x-user-id', async () => {
    window.localStorage.setItem('insurtech.tenantId', 'tenant-001');
    const client = createApiClient();
    const config = await client.interceptors.request.handlers[0].fulfilled({
      headers: new Map(), method: 'get', url: '/v1/health',
    } as any);
    expect(config).toBeDefined();
  });

  it('injects x-trace-id automatically on every request', async () => {
    window.localStorage.setItem('insurtech.tenantId', 't1');
    window.localStorage.setItem('insurtech.userId', 'u1');
    const client = createApiClient();
    const config = await client.interceptors.request.handlers[0].fulfilled({
      headers: new Map(), method: 'get', url: '/v1/health',
    } as any);
    expect((config.headers as any).get('x-trace-id')).toMatch(/^trace_\d+_/);
  });

  it('injects Idempotency-Key on POST', async () => {
    window.localStorage.setItem('insurtech.tenantId', 't1');
    window.localStorage.setItem('insurtech.userId', 'u1');
    const client = createApiClient();
    const config = await client.interceptors.request.handlers[0].fulfilled({
      headers: new Map(), method: 'post', url: '/v1/me/claims',
    } as any);
    expect((config.headers as any).get('Idempotency-Key')).toMatch(/^idem_\d+_/);
  });

  it('does NOT inject Idempotency-Key on GET (cache poisoning prevention)', async () => {
    window.localStorage.setItem('insurtech.tenantId', 't1');
    window.localStorage.setItem('insurtech.userId', 'u1');
    const client = createApiClient();
    const config = await client.interceptors.request.handlers[0].fulfilled({
      headers: new Map(), method: 'get', url: '/v1/me/policies',
    } as any);
    expect((config.headers as any).get('Idempotency-Key')).toBeUndefined();
  });

  it('injects Authorization Bearer if session token present', async () => {
    window.localStorage.setItem('insurtech.tenantId', 't1');
    window.localStorage.setItem('insurtech.userId', 'u1');
    window.sessionStorage.setItem('insurtech.token', 'jwt.token.here');
    const client = createApiClient();
    const config = await client.interceptors.request.handlers[0].fulfilled({
      headers: new Map(), method: 'get', url: '/v1/health',
    } as any);
    expect((config.headers as any).get('Authorization')).toBe('Bearer jwt.token.here');
  });
});
```

### 6.2. `tests/unit/format.spec.ts` (~150 lignes, 12 tests)

```typescript
import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatCurrencyExact,
  normalizePhone,
  formatPhone,
  isValidMoroccanPhone,
  formatPolicyNumber,
  formatDate,
  formatCIN,
} from '@/lib/format';

describe('formatCurrency', () => {
  it('formats MAD in fr locale with non-breaking space', () => {
    const result = formatCurrency(1234.56, 'fr');
    expect(result).toMatch(/1.234,56/);
    expect(result).toContain('DH');
  });

  it('formats MAD in ar-MA locale (Darija) with western numerals by default', () => {
    const result = formatCurrency(1234.56, 'ar-MA');
    expect(result).toMatch(/[1-9]/);
  });

  it('formats MAD in ar locale with arabic-indic numerals', () => {
    const result = formatCurrency(1234.56, 'ar', { numerals: 'arabic-indic' });
    expect(result).toMatch(/[٠-٩]/);
  });

  it('handles zero amount', () => {
    expect(formatCurrency(0, 'fr')).toMatch(/0,00/);
  });

  it('formatCurrencyExact precision 2 decimals', () => {
    const result = formatCurrencyExact('1234.567', 'fr');
    expect(result).toMatch(/1.234,57/);
  });
});

describe('normalizePhone / formatPhone / isValidMoroccanPhone', () => {
  it('normalizes 0612345678 to +212612345678', () => {
    expect(normalizePhone('0612345678')).toBe('+212612345678');
  });

  it('keeps +212612345678 unchanged', () => {
    expect(normalizePhone('+212612345678')).toBe('+212612345678');
  });

  it('handles 00212 prefix', () => {
    expect(normalizePhone('00212612345678')).toBe('+212612345678');
  });

  it('strips dots and spaces', () => {
    expect(normalizePhone('06.12.34.56.78')).toBe('+212612345678');
    expect(normalizePhone('06 12 34 56 78')).toBe('+212612345678');
  });

  it('formats for display +212 6 12 34 56 78', () => {
    expect(formatPhone('0612345678')).toBe('+212 6 12 34 56 78');
  });

  it('validates Moroccan mobile number 6XX', () => {
    expect(isValidMoroccanPhone('0612345678')).toBe(true);
    expect(isValidMoroccanPhone('0712345678')).toBe(true);
    expect(isValidMoroccanPhone('0512345678')).toBe(true);
  });

  it('rejects non-Moroccan number', () => {
    expect(isValidMoroccanPhone('0033612345678')).toBe(false);
    expect(isValidMoroccanPhone('+33612345678')).toBe(false);
  });
});

describe('formatPolicyNumber', () => {
  it('formats policy number POL-2026-AUTO-000123', () => {
    expect(formatPolicyNumber('POL', 2026, 'auto', 123)).toBe('POL-2026-AUTO-000123');
  });

  it('pads sequence to 6 digits', () => {
    expect(formatPolicyNumber('POL', 2026, 'mrh', 1)).toBe('POL-2026-MRH-000001');
  });
});

describe('formatDate', () => {
  it('formats date short fr-MA', () => {
    const result = formatDate('2026-05-05', 'fr');
    expect(result).toMatch(/2026/);
  });

  it('formats date long with hour', () => {
    const result = formatDate(new Date('2026-05-05T10:30:00'), 'fr', 'long');
    expect(result).toMatch(/2026/);
  });
});

describe('formatCIN', () => {
  it('formats CIN AB123456', () => {
    expect(formatCIN('AB123456')).toBe('AB 123456');
  });

  it('handles lowercase', () => {
    expect(formatCIN('ab123456')).toBe('AB 123456');
  });

  it('returns input if not valid CIN format', () => {
    expect(formatCIN('XYZ')).toBe('XYZ');
  });
});
```

### 6.3. `tests/unit/i18n-request.spec.ts` (~50 lignes, 6 tests)

```typescript
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({ notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }) }));

describe('i18n/request', () => {
  it('returns fr messages for fr locale', async () => {
    const { default: getRequestConfig } = await import('@/i18n/request');
    const config = await (getRequestConfig as any)({ requestLocale: Promise.resolve('fr') });
    expect(config.locale).toBe('fr');
    expect(config.messages).toBeDefined();
    expect(config.messages.nav.dashboard).toBe('Tableau de bord');
  });

  it('returns ar-MA messages for ar-MA locale (Darija)', async () => {
    const { default: getRequestConfig } = await import('@/i18n/request');
    const config = await (getRequestConfig as any)({ requestLocale: Promise.resolve('ar-MA') });
    expect(config.locale).toBe('ar-MA');
    expect(config.messages.nav.dashboard).toBeDefined();
  });

  it('returns ar messages for ar locale (classique)', async () => {
    const { default: getRequestConfig } = await import('@/i18n/request');
    const config = await (getRequestConfig as any)({ requestLocale: Promise.resolve('ar') });
    expect(config.locale).toBe('ar');
  });

  it('falls back to fr for unsupported locale', async () => {
    const { default: getRequestConfig } = await import('@/i18n/request');
    const config = await (getRequestConfig as any)({ requestLocale: Promise.resolve('en') });
    expect(config.locale).toBe('fr');
  });

  it('uses Africa/Casablanca timezone', async () => {
    const { default: getRequestConfig } = await import('@/i18n/request');
    const config = await (getRequestConfig as any)({ requestLocale: Promise.resolve('fr') });
    expect(config.timeZone).toBe('Africa/Casablanca');
  });

  it('exposes currencyMAD format', async () => {
    const { default: getRequestConfig } = await import('@/i18n/request');
    const config = await (getRequestConfig as any)({ requestLocale: Promise.resolve('fr') });
    expect(config.formats?.number?.currencyMAD).toEqual({ style: 'currency', currency: 'MAD' });
  });
});
```

### 6.4. `tests/e2e/portal.spec.ts` (~150 lignes, 12+ scenarios)

```typescript
import { test, expect } from '@playwright/test';

test.describe('web-assure-portal -- Sprint 4 bootstrap', () => {
  test('home /fr renders 200 with welcome', async ({ page }) => {
    const response = await page.goto('/fr');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText(/Bienvenue/i);
  });

  test('home /ar-MA Darija renders', async ({ page }) => {
    const response = await page.goto('/ar-MA');
    expect(response?.status()).toBe(200);
    const html = await page.locator('html').getAttribute('lang');
    expect(html).toBe('ar-MA');
  });

  test('home /ar with dir=rtl', async ({ page }) => {
    await page.goto('/ar');
    const dir = await page.locator('html').getAttribute('dir');
    expect(dir).toBe('rtl');
  });

  test('theme variant assure applied (Sky Blue)', async ({ page }) => {
    await page.goto('/fr');
    const theme = await page.locator('html').getAttribute('data-theme');
    expect(theme).toBe('assure');
  });

  test('SelfServiceLayout : no dense sidebar', async ({ page }) => {
    await page.goto('/fr');
    const sidebar = page.locator('[data-testid="dense-sidebar"]');
    await expect(sidebar).toHaveCount(0);
  });

  test('navigation polices -> sinistres -> profil -> paiements', async ({ page }) => {
    await page.goto('/fr');
    await page.goto('/fr/polices');
    await expect(page.locator('h1')).toContainText(/polices/i);
    await page.goto('/fr/sinistres');
    await expect(page.locator('h1')).toContainText(/sinistres/i);
    await page.goto('/fr/profil');
    await expect(page.locator('h1')).toContainText(/profil/i);
    await page.goto('/fr/paiements');
    await expect(page.locator('h1')).toContainText(/paiements/i);
  });

  test('big buttons accessibility >= 44x44 px touch target', async ({ page }) => {
    await page.goto('/fr');
    const buttons = await page.locator('a[role="button"], button').all();
    expect(buttons.length).toBeGreaterThan(0);
    for (const btn of buttons.slice(0, 5)) {
      const box = await btn.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('mobile responsive 320 px viewport renders without horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto('/fr');
    const bodyWidth = await page.locator('body').evaluate((el) => el.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(320);
  });

  test('Sky Blue passes WCAG AA contrast for text on white', async ({ page }) => {
    await page.goto('/fr');
    const navyOnSkyBlue = await page.evaluate(() => {
      const el = document.querySelector('h1');
      if (!el) return null;
      return window.getComputedStyle(el).color;
    });
    expect(navyOnSkyBlue).toBeTruthy();
  });

  test('placeholder Sprint 5 auth gate disabled by default (env false)', async ({ page }) => {
    await page.goto('/fr/profil');
    expect(page.url()).toContain('/profil');
  });

  test('locale switcher persists choice via URL', async ({ page }) => {
    await page.goto('/fr');
    await page.goto('/ar-MA');
    expect(page.url()).toContain('/ar-MA');
  });

  test('404 not-found dedicated page', async ({ page }) => {
    const response = await page.goto('/fr/route-inexistante-xyz');
    expect(response?.status()).toBe(404);
  });

  test('MAD currency format example visible on payments page', async ({ page }) => {
    await page.goto('/fr/paiements');
    await expect(page.locator('text=DH')).toBeVisible();
  });

  test('declaration sinistre shows Sprint 19 placeholder notice', async ({ page }) => {
    await page.goto('/fr/sinistres/declarer');
    await expect(page.locator('[data-testid="placeholder-notice"]')).toContainText(/Sprint/);
  });

  test('RGPD rights stub visible on profile', async ({ page }) => {
    await page.goto('/fr/profil');
    await expect(page.locator('[data-testid="rgpd-placeholder"]')).toContainText(/Sprint 14/);
  });
});
```

---

## 7. Variables environnement (1-3 ko, 17 NEXT_PUBLIC_*)

| Variable | Type | Defaut | Description |
|----------|------|--------|-------------|
| NEXT_PUBLIC_API_BASE_URL | URL | http://localhost:4000 | API NestJS Sprint 3 |
| NEXT_PUBLIC_API_TIMEOUT_MS | number | 15000 | Timeout HTTP Axios |
| NEXT_PUBLIC_MOBILE_PORTAL_URL | URL | http://localhost:3006 | web-assure-mobile PWA |
| NEXT_PUBLIC_ENABLE_MOBILE_REDIRECT | boolean | false | Active redirect UA mobile |
| NEXT_PUBLIC_ENABLE_AUTH_GATE | boolean | false | Active gate Sprint 5 |
| NEXT_PUBLIC_AUTH_LOGIN_URL | path | /auth/login | Route login Sprint 5 |
| NEXT_PUBLIC_IDLE_TIMEOUT_MS | number | 1800000 | 30 min idle |
| NEXT_PUBLIC_IDLE_WARNING_MS | number | 300000 | 5 min warning |
| NEXT_PUBLIC_APP_NAME | string | Mon Espace Assure | Branding |
| NEXT_PUBLIC_APP_VERSION | string | 0.1.0 | Affichage version |
| NEXT_PUBLIC_BRAND_PRIMARY | hex | #B0CEE2 | Sky Blue |
| NEXT_PUBLIC_SENTRY_DSN | string | (vide) | Vide = init skip |
| NEXT_PUBLIC_SENTRY_ENVIRONMENT | string | development | Tag Sentry |
| NEXT_PUBLIC_CDN_URL | URL | http://localhost:9000 | MinIO/Atlas Cloud |
| NEXT_PUBLIC_S3_BUCKET | string | insurtech-assets-dev | Bucket Atlas Benguerir |
| NEXT_PUBLIC_FEATURE_RGPD_EXPORT | boolean | false | Stub Sprint 14 |
| NEXT_PUBLIC_FEATURE_ELECTRONIC_SIGNATURE | boolean | false | Stub Sprint 11 |
| NEXT_PUBLIC_DEFAULT_NUMERALS | enum | western | western/arabic-indic |

**Aucune variable secrete** : tout `NEXT_PUBLIC_*` est inline dans le bundle JS client. Documente avec commentaire `# CLIENT-SAFE` dans `.env.example`.

---

## 8. Commandes shell

```bash
# Setup
cd /repo
pnpm install
pnpm --filter @insurtech/web-assure-portal install

# Dev
pnpm --filter @insurtech/web-assure-portal dev
# -> http://localhost:3005/fr

# Tests unitaires
pnpm --filter @insurtech/web-assure-portal test

# Tests E2E Playwright
pnpm --filter @insurtech/web-assure-portal exec playwright install chromium
pnpm --filter @insurtech/web-assure-portal test:e2e

# Build prod
pnpm --filter @insurtech/web-assure-portal build
pnpm --filter @insurtech/web-assure-portal start

# Typecheck + Lint
pnpm --filter @insurtech/web-assure-portal typecheck
pnpm --filter @insurtech/web-assure-portal lint

# Lighthouse baseline
pnpm --filter @insurtech/web-assure-portal lighthouse

# No-emoji check (decision-006)
bash scripts/check-no-emoji.sh apps/web-assure-portal

# i18n keys parity check
pnpm tsx scripts/validate-i18n-keys.ts apps/web-assure-portal/src/messages

# Format
pnpm --filter @insurtech/web-assure-portal format
pnpm --filter @insurtech/web-assure-portal format:check

# Clean
pnpm --filter @insurtech/web-assure-portal clean
```

---

## 9. Criteres validation V1-V28 (28 criteres)

### P0 -- Bloquants (15 criteres)

- **V1 (P0)** : `pnpm --filter @insurtech/web-assure-portal dev` demarre sur port 3005, GET `/fr` repond 200 sous 3 sec.
- **V2 (P0)** : Theme variant assure applique (`<html data-theme="assure">`), Sky Blue `#B0CEE2` visible comme couleur dominante (cards, banners, badges).
- **V3 (P0)** : SelfServiceLayout utilise (topbar simple horizontale + content centre, **AUCUNE sidebar dense verticale** type DashboardLayout).
- **V4 (P0)** : 3 locales rendent en 200 : `/fr`, `/ar-MA`, `/ar`. Middleware next-intl detecte Accept-Language et redirige `/` vers locale appropriee.
- **V5 (P0)** : Locale `ar-MA` Darija marocain : cles JSON traduites avec vocabulaire Darija (ex : "الفضاء ديالي", "صرح بحادث") et non transliteration arabe classique.
- **V6 (P0)** : Locale `ar` classique : `<html dir="rtl">` applique, font Noto Naskh Arabic charge en priorite.
- **V7 (P0)** : Mobile responsive : viewport 320 px x 568 px ne provoque pas de scroll horizontal. Tous les ecrans (dashboard, polices, sinistres, profil, paiements) testes Playwright `small-mobile` project.
- **V8 (P0)** : `pnpm --filter @insurtech/web-assure-portal build` sort sans erreur ni warning.
- **V9 (P0)** : Lighthouse Performance baseline >= 70 sur `/fr` (cible Sprint 17 = 90, ici baseline acceptable).
- **V10 (P0)** : Lighthouse Accessibility >= 90, contraste texte navy sur fond Sky Blue passe WCAG AA (ratio >= 4.5:1).
- **V11 (P0)** : Big buttons : tous les boutons primaires `<button>` et `<a role="button">` ont `min-height: 44px` et `min-width: 44px` (verification `expect(box.height).toBeGreaterThanOrEqual(44)` Playwright).
- **V12 (P0)** : `formatCurrency(1234.56, 'fr')` retourne `"1 234,56 DH"` (espace insecable narrow + virgule decimale).
- **V13 (P0)** : `formatPhone('0612345678')` retourne `"+212 6 12 34 56 78"`. `isValidMoroccanPhone('0612345678')` retourne `true`.
- **V14 (P0)** : Aucune emoji dans code, JSON messages, README. `bash scripts/check-no-emoji.sh apps/web-assure-portal` passe (decision-006).
- **V15 (P0)** : `pnpm typecheck` et `pnpm lint --max-warnings 0` passent sans erreur ni warning.

### P1 -- Importants (8 criteres)

- **V16 (P1)** : Variant assure CSS : `--font-size-base: 1.125rem` (18 px) applique sur body via `[data-theme="assure"]`.
- **V17 (P1)** : Locale switcher fonctionne via URL (cookie `NEXT_LOCALE` persistant). Switch fr -> ar-MA preserve la route.
- **V18 (P1)** : Font Noto Naskh Arabic charge correctement sur `/ar` (verification `getComputedStyle(body).fontFamily` contient "Noto Naskh").
- **V19 (P1)** : RGPD rights stubs visibles sur `/profil` : 2 boutons "Exporter mes donnees" + "Supprimer mon compte" presents (disabled), texte loi 09-08 reference visible.
- **V20 (P1)** : Stub password reset visible sur `/profil/securite` : bouton "Modifier mon mot de passe" disabled avec texte "Disponible Sprint 5".
- **V21 (P1)** : Interceptor Axios injecte `x-user-id` automatiquement sur paths `/me/`, `/policies`, `/claims`, `/payments`. Test unitaire dedie verifie throw error si absent.
- **V22 (P1)** : Stub signature electronique visible sur `/polices/[id]` : bouton "Signer electroniquement" disabled avec texte "Disponible Sprint 11".
- **V23 (P1)** : Stub paiement visible sur `/paiements` : message Sprint 16 + format MAD example affiche.

### P2 -- Optionnels (5 criteres)

- **V24 (P2)** : react-pdf preview stub fonctionnel sur `/polices/[id]` : composant `<Document>` charge meme sans fichier (placeholder).
- **V25 (P2)** : currency.js MAD locale-aware via `formatCurrencyExact` (precision decimale exacte, evite IEEE 754 floating).
- **V26 (P2)** : Prefetch hover sur Link Next.js : navigation `/fr/polices` prepare bundle.
- **V27 (P2)** : Image optimization : `<Image>` Next.js avec `formats: ['image/avif', 'image/webp']`.
- **V28 (P2)** : `<link rel="alternate" hreflang="fr">` + `<link rel="alternate" hreflang="ar-MA">` + `<link rel="alternate" hreflang="ar">` presents dans `<head>` via `metadata.alternates.languages`.

---

## 10. Edge cases (8+)

1. **assure_user RLS scoping fail** : si interceptor n'injecte pas `x-user-id` sur `/v1/me/policies`, l'API filtre uniquement par tenant et l'assure pourrait voir polices d'autres assures du meme tenant. Defense : interceptor THROW Error explicite (test unitaire `throws if x-user-id missing`).

2. **Sky Blue contrast accessibility** : `#B0CEE2` sur fond blanc = 1.42:1 (echec AA). Solution : Sky Blue UNIQUEMENT en background de surface, texte navy `#1A2730` (12.6:1 AAA sur Sky Blue, 14.5:1 sur blanc).

3. **MAD currency format locale-aware divergence** : `Intl.NumberFormat('fr-MA')` et `Intl.NumberFormat('ar-MA')` produisent des outputs differents. Cookie `numerals` configure western (defaut ar-MA Darija) vs arabic-indic (defaut ar classique).

4. **Phone +212 vs 0X normalization** : utilisateur saisit format aleatoire. `normalizePhone()` accepte `0612345678`, `+212612345678`, `06.12.34.56.78`, `00212612345678`. Output canonique E.164 `+212612345678`.

5. **Signature electronique Sprint 11 placeholder** : si assure clique lien profond `/polices/[id]/signer` avant Sprint 11, page absente. Solution : page stub avec message "Disponible Sprint 11" (placeholder propre, pas 404).

6. **Mobile UA detection redirect** : middleware regex `/Mobile|Android|iPhone/i` detecte UA mobile sur `/sinistres/declarer`. Si flag `NEXT_PUBLIC_ENABLE_MOBILE_REDIRECT=true`, redirect 302 vers `m-mon-espace.skalean-insurtech.ma/declarer`. Sprint 25 raffine.

7. **Session timeout 30 min vs 15 min admin** : `NEXT_PUBLIC_IDLE_TIMEOUT_MS=1800000` (30 min) + warning 5 min. Conformite ACAPS 12-2024 respectee.

8. **Password reset Sprint 5 placeholder** : route `/auth/reset-password` retourne 404 jusqu'a Sprint 5. Bouton "Modifier mot de passe" disabled.

9. **RGPD/CNDP user rights** : Loi 09-08 articles 7, 9, 10, 11 -- 4 droits exposes (acces, rectification, opposition, suppression). Sprint 14 implementera workflow.

10. **Big buttons 44x44 px** : WCAG 2.5.5 Level AAA. Tous boutons primaires verifies Playwright.

11. **Locale Darija plural rules** : ICU pluralization `{count, plural, =0 {Aucun sinistre} =1 {Un sinistre} other {# sinistres}}`. Darija fallback comportement standard.

12. **Currency display ar-MA Arabic-Indic numerals** : configurable via cookie. Defaut ar-MA = western (Darija marocain prefere chiffres latins observe), defaut ar = arabic-indic.

---

## 11. Conformite Maroc detaillee (1-3 ko)

### Loi 09-08 CNDP donnees personnelles assure

L'app expose 4 droits CNDP (Loi 09-08 du 18 fevrier 2009 relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel) :

- **Article 7 -- Droit d'acces** : bouton "Exporter mes donnees personnelles" sur `/profil` (Sprint 14 implementera workflow JSON download + audit log).
- **Article 9 -- Droit de rectification** : bouton "Modifier mes informations" sur `/profil/personalInfo` (Sprint 5 form rectification).
- **Article 10 -- Droit d'opposition** : checkboxes preferences communication marketing sur `/profil/preferences` (Sprint 14).
- **Article 11 -- Droit de suppression** : bouton "Supprimer mon compte" sur `/profil` avec workflow 30j conservation legale (Sprint 14).

Mention legale footer obligatoire : "Skalean InsurTech est conforme CNDP (Loi 09-08). Pour toute question, contactez notre DPO : dpo@skalean-insurtech.ma."

### ACAPS Autorite de Controle des Assurances et de la Prevoyance Sociale

L'ACAPS supervise la commercialisation des produits d'assurance au Maroc. Le portal expose :
- **Footer compliance ACAPS** : lien vers https://www.acaps.ma + numero agrement Skalean tenant.
- **Conformite cybersecurite ACAPS 12-2024** : timeout session, MFA Sprint 5, audit log Sprint 14, RTO/RPO Sprint 30.
- **Reglement ACAPS produits** : page `/legal/acaps` reference reglements applicables (auto, MRH, sante, vie).

### Loi 31-08 protection consommateur

Loi 31-08 du 18 fevrier 2011 edictant des mesures de protection du consommateur :
- **Article 3 -- Information transparente** : conditions generales accessibles sans authentification depuis footer.
- **Article 4 -- Demarchage** : pas de demarchage push sans consentement (CNDP cross-reference).
- **Article 49 -- Droit retractation** : 14 jours pour contrats distance (signature electronique Sprint 11).

### Multilinguisme MA (decision-009)

- **fr** par defaut : francais Maroc, vocabulaire local ("DH" et non "MAD" en symbol affichage).
- **ar-MA** : Darija marocain, vocabulaire commun ("بوليصة", "صرح", "خلاص", "الفضاء ديالي").
- **ar** : arabe classique, RTL strict, Noto Naskh Arabic (registre formel).

### BAM Bank Al-Maghrib payment compliance Sprint 16

Sprint 16 implementera paiement online conforme BAM directive 2-W-2017 (paiement electronique). Web-assure-portal Sprint 4 expose stub `/paiements/payer` sans logique paiement.

---

## 12. Conventions absolues (14 conventions)

1. **0 emoji** : aucune emoji dans code, JSON, README, commits, comments. Test CI `scripts/check-no-emoji.sh` passe.
2. **TypeScript strict** : `"strict": true` + `noUnusedLocals` + `noUnusedParameters` + `noImplicitReturns`.
3. **Theme assure variant** : Sky Blue `#B0CEE2` dominant (rassurant), Orange `#E95D2C` reserve CTA critiques, Navy `#1A2730` texte body.
4. **Big buttons** : touch target >= 44x44 px (WCAG 2.5.5 AAA), classe `min-h-touch min-w-touch`.
5. **Large base font** : 18 px (`1.125rem`) au lieu de 14 px standard (accessibilite assure non-tech).
6. **SelfServiceLayout** : topbar simple horizontale + content centre, JAMAIS sidebar dense verticale.
7. **Multi-tenant strict + L3 scoping** : interceptor injecte `x-tenant-id` + `x-user-id` (assure_user_id) systematiquement. Throw si manquant sur paths proteges.
8. **Cloud souverain Atlas Cloud Benguerir** : `images.remotePatterns` JAMAIS `*.amazonaws.com`. Domaines : `s3.bgr.atlascloudservices.ma`, `cdn.skalean-insurtech.ma`, `localhost:9000`.
9. **Locales fr / ar-MA Darija / ar classique RTL** : 3 locales obligatoires, parite cles cross-locale verifiee CI (`scripts/validate-i18n-keys.ts`).
10. **Brand kit Sofidemy** : palette + Montserrat + Noto Naskh Arabic + Geist Mono uniquement.
11. **NEXT_PUBLIC_* CLIENT-SAFE** : aucune variable secrete dans `.env.example` (commentaire explicite).
12. **CSP strict + HSTS + X-Frame-Options DENY** : headers securite par defaut dans `next.config.mjs`.
13. **Idempotency-Key sur mutations uniquement** : POST/PUT/PATCH/DELETE -- jamais GET (cache poisoning prevention).
14. **No-PWA web-assure-portal** : pas de `next-pwa`, pas de service worker. PWA reservee `web-assure-mobile` (Tache 1.4.7).

---

## 13. Validation pre-commit

```bash
# Pre-commit hook (.husky/pre-commit ou lefthook.yml)
pnpm --filter @insurtech/web-assure-portal lint --max-warnings 0
pnpm --filter @insurtech/web-assure-portal typecheck
pnpm --filter @insurtech/web-assure-portal test
bash scripts/check-no-emoji.sh apps/web-assure-portal
pnpm tsx scripts/validate-i18n-keys.ts apps/web-assure-portal/src/messages

# Build smoke test (optionnel pre-push)
pnpm --filter @insurtech/web-assure-portal build
```

---

## 14. Commit message

```
feat(web-assure-portal): bootstrap Next.js 15 self-service portal port 3005 [Sprint 4 Tache 1.4.6]

- Next.js 15.1.0 App Router + React 19 RSC
- 3 locales : fr (defaut), ar-MA Darija, ar classique RTL (decision-009)
- Theme variant assure : Sky Blue #B0CEE2 dominant (rassurant), Orange #E95D2C CTA accent
- SelfServiceLayout (topbar simple + content centre, NO sidebar dense)
- Big buttons >= 44x44 px touch target (WCAG 2.5.5 AAA)
- Large base font 18 px (accessibilite assure non-tech)
- Pages placeholder : dashboard, polices, sinistres, profil, paiements (Sprint 5/11/14/16/17/19/25 implementent)
- Axios + interceptors : x-tenant-id + x-user-id (L3 scoping critique CNDP) + x-trace-id + Idempotency-Key
- Format helpers : formatCurrency MAD (Intl + currency.js), formatPhone +212, formatPolicyNumber, formatCIN
- Idle timeout 30 min user (vs 15 min admin) + warning 5 min avant deconnexion
- RGPD rights stubs (Loi 09-08 articles 7/9/10/11) sur /profil
- Stub mobile UA redirect /sinistres/declarer vers web-assure-mobile (Sprint 25)
- Tests Vitest 28 unitaires + Playwright 14 E2E (chromium + mobile-safari + small-mobile 320 px)
- Lighthouse baseline Perf >= 70, A11y >= 90 contraste WCAG AA

Conformite : decision-006 (no emoji), 008 (cloud souverain Atlas Benguerir), 009 (multilinguisme MA), 014 (multi-tenant L3), 017 (CNDP user rights UI).

Refs: B-04 Sprint 4 Tache 1.4.6 lignes 508-543
Depend de : 1.4.5 (web-customer-portal bootstrap)
Bloque : 1.4.7 (web-assure-mobile PWA)
```

---

## 15. Workflow next step

Apres validation V1-V15 (P0 minimum), passer a **Tache 1.4.7 -- web-assure-mobile bootstrap (port 3006 PWA)**.

Tache 1.4.7 reutilise structurellement web-assure-portal :
- Copie patron pages self-service (dashboard, polices, sinistres, profil, paiements)
- Adapte theme assure (Sky Blue dominant identique)
- AJOUTE `next-pwa` + service worker + manifest.webmanifest
- AJOUTE offline-first strategy pour declaration sinistre (queue POST IndexedDB + sync background)
- AJOUTE photo capture + geolocalisation API browser
- AJOUTE install prompt PWA avec bouton "Ajouter a l'ecran d'accueil"
- Port 3006, domaine prod `m-mon-espace.skalean-insurtech.ma`

---

## 16. Footer

**Tache 1.4.6 -- web-assure-portal bootstrap port 3005 -- Sprint 4 Phase 1 Bootstrap**

Cette tache est **auto-suffisante** : tous les patterns code, tests, criteres validation, edge cases, conformite Maroc sont presents sans necessite de lecture annexe. Le developpeur execute sequentiellement les 27 livrables checkables (L1-L28), valide V1-V28, commit avec message normalise, et passe a Tache 1.4.7.

**Effort** : 5h ferme (estimation Sprint 4).
**Dependances entrantes** : 1.4.5 (web-customer-portal bootstrap fournit patron public).
**Dependances sortantes** : 1.4.7 (web-assure-mobile copie patron self-service).
**Conformite** : decision-006 / 008 / 009 / 014 / 017 + Loi 09-08 CNDP + ACAPS + Loi 31-08 + BAM directive 2-W-2017.
**Brand** : Skalean Sofidemy variant `assure` Sky Blue dominant.
**No emoji absolu** : verifie CI `scripts/check-no-emoji.sh`.

---
