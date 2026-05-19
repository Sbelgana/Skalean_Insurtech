# TACHE 4.3.2 -- Pages Auth : Login + MFA Verify + Signup + Recovery

**Sprint** : 16 (Phase 4 / Sprint 3 dans phase) -- Web Broker App
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.2)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (bloque 4.3.3 layout principal + tous les sprints metier consommateurs de session)
**Effort** : 6h
**Dependances** : 4.3.1 (app skeleton + middleware auth + i18n + providers TanStack Query / next-themes / sonner), Sprint 5 complet (endpoints `/auth/signin`, `/auth/verify-mfa`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email`, `/auth/refresh`, `/auth/me`, `/auth/sessions`, `/auth/logout`, `/auth/select-tenant`), Sprint 4 (design tokens Sofidemy + shadcn/ui components)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Livrer la couche UI authentication complete de l'application `web-broker` -- les 9 pages publiques `/login`, `/verify-mfa`, `/signup`, `/email-sent`, `/forgot-password`, `/reset-password`, `/verify-email`, `/select-tenant`, `/logout` -- qui consomment les 11 endpoints REST `/api/v1/auth/*` exposes par l'API NestJS Sprint 5 et qui materialisent les flows d'authentification end-to-end utilises par les 3 roles broker (broker_admin, broker_user, broker_assistant) ainsi que les utilisateurs des autres apps web qui partageront ce patron (web-customer-portal Sprint 17, web-assure-portal Sprint 18, web-garage Sprint 22, web-insurtech-admin Sprint 27).

L'objectif precis est de poser une couche de presentation defensive en profondeur : (1) tous les formulaires sont valides cote client via `react-hook-form` + `zodResolver` avec les memes schemas Zod que ceux executes cote serveur Sprint 5 (donc les regles -- email format, password complexity 12+ chars min avec uppercase + lowercase + digit + special, CIN MA format `[A-Z]{1,2}\d{1,7}`, telephone E.164 marocain `+212[5-7]\d{8}`, MFA code 6 digits, locale ISO supportee -- sont synchronisees) ; (2) les tokens d'authentification (access_token TTL 15min + refresh_token TTL 30j + current_tenant_id) sont stockes dans des cookies `httpOnly + Secure + SameSite=lax + Path=/` poses serveur-side par les Route Handlers Next.js `/api/auth/*` (jamais touchees JavaScript client, immunes contre XSS) ; (3) le challenge MFA volatile (mfa_challenge_token TTL 5min) est stocke dans `sessionStorage` car il ne survit pas a la fermeture du browser et n'est jamais transmis cross-tab ; (4) la rotation des refresh tokens (Sprint 5 decision-014 theft detection) est integree dans le proxy `/api/auth/refresh` qui repose les nouveaux cookies a chaque rotation ; (5) tous les feedbacks utilisateur passent par `sonner` toast avec messages i18n fr / ar-MA / ar ; (6) les boutons sont disabled pendant les soumissions in-flight ; (7) le composant `<MfaCodeInput>` 6-digits auto-advance + auto-submit ergonomique reproduit le pattern industriel (Google, Microsoft, Stripe) ; (8) le composant `<PasswordStrengthIndicator>` integrant `@zxcvbn-ts/core` affiche un score 0-4 avec recommendations actionables ; (9) la page `/select-tenant` materialise le pattern multi-tenant Sprint 6 -- un user peut appartenir a plusieurs cabinets (rare mais reel : assistante administrative travaillant pour 2 cabinets) -- en proposant une selection visuelle avec carte par tenant qui pose le cookie `current_tenant_id` et redirige `/dashboard`.

A la sortie de cette tache, la suite des 9 flows Playwright E2E (login success, login bad credentials, login lockout, login MFA challenge, MFA success, MFA wrong code, MFA expired challenge, signup full flow, signup email duplicate, verify-email auto-redirect, forgot-password + email + reset complet, reset-password token expire, multi-tenant select, logout server-side invalidation, refresh-token rotation race) se deroule sans erreur, les schemas Zod sont 100% paritaires avec backend Sprint 5, la matrice `httpOnly + Secure + SameSite + Path` est correcte sur tous les cookies, et zero token n'est exposes a `document.cookie` cote JavaScript. Cette tache bloque 4.3.3 (layout protected avec topbar tenant switcher) qui suppose user authentifie + tenant selectionne.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

L'application `web-broker` a ete bootstrappee dans Sprint 4 (Tache 1.4.1) avec le squelette technique Next.js 15 App Router + middleware locale-detection + providers TanStack Query / next-themes / sonner. Le Sprint 5 a livre toute la couche backend authentification : services fondationnels (Argon2Service, JwtService, SessionService, EncryptionService), services metier (MfaService TOTP+recovery codes, EmailVerificationService, PasswordResetService, LockoutService, AuditLogService) et la couche d'integration NestJS (AuthModule + AuthController exposant 11 endpoints REST). Mais cote frontend, jusqu'a la Tache 4.3.1, aucune UI auth n'existe -- la seule chose qui marche est le middleware `apps/web-broker/middleware.ts` qui redirige les routes protegees `/[locale]/(protected)/*` vers `/[locale]/login` quand le cookie `access_token` est absent.

La Tache 4.3.2 referme cette boucle : elle livre les 9 pages publiques `/login`, `/verify-mfa`, `/signup`, `/email-sent`, `/forgot-password`, `/reset-password`, `/verify-email`, `/select-tenant`, `/logout` qui constituent le **premier point de contact utilisateur** avec la plateforme Skalean InsurTech. Ces pages doivent etre irreprochables sur trois axes :

- **Securite** : aucun token JWT n'est manipule cote JavaScript client (defense XSS), les cookies sont poses cote serveur avec les flags `httpOnly + Secure + SameSite=lax + Path=/` ; le challenge MFA volatile (TTL 5min) est stocke en `sessionStorage` (volatile, isole par tab, jamais persiste cross-session) ; les schemas Zod cote client repliquent les schemas backend Sprint 5 (defense en profondeur si quelqu'un bypass UI via curl) ; les boutons submit sont desactives pendant les requetes in-flight pour eviter les double-submissions accidentelles ; les erreurs ne leak jamais d'information sensible (toujours generic "Identifiants incorrects" jamais "Cet email n'existe pas").

- **UX** : les feedbacks utilisateur sont immediats via `sonner` toasts (success vert / error rouge / info bleu) ; les inputs sont annotated avec ARIA labels et descriptions pour les lecteurs d'ecran ; le composant MFA 6-digits auto-advance + auto-submit a 6 caracteres entiers ; le composant password strength affiche un score 0-4 colore (vert/orange/rouge) avec recommendations actionables ("Ajoutez un caractere special", "Evitez les mots du dictionnaire") ; les boutons "Mot de passe oublie" et "Creer un compte" sont visibles sans scroll ; les formulaires sont fully keyboard-navigable (Tab + Enter).

- **i18n** : tous les textes sont traduits en `fr`, `ar-MA` (Darija), `ar` (arabe classique) via `next-intl` getTranslations() server-side et useTranslations() client-side ; les messages d'erreur Zod sont localizes ; les locales arabes sont rendues en `dir="rtl"` automatiquement par le layout Sprint 4.

### Alternatives considerees

#### Server Actions vs Route Handlers `/api/auth/*` pour proxy backend

| Critere | Route Handlers (CHOIX) | Server Actions (rejete) |
|---------|------------------------|--------------------------|
| Set-Cookie httpOnly | Natif via `cookies().set(name, value, { httpOnly, secure, sameSite })` | Possible mais via `cookies()` import RSC, plus implicit |
| Endpoint REST testable | Oui via curl / Playwright network mocks | Non, fonction interne |
| Reuse cross-app | Oui (l'endpoint `/api/auth/signin` peut etre call depuis web-customer-portal) | Non, fonction tied au composant |
| Cache invalidation explicite | Manual via `revalidateTag` | Auto via `revalidatePath` |
| Sentry instrumentation | Native middleware Sentry | Necessite wrapping manuel |
| Streaming response | Oui (ReadableStream) | Non (return value seulement) |
| Body size limit | Configurable via Next config | Configurable mais via `experimental.serverActions.bodySizeLimit` |

**Decision** : Route Handlers `/api/auth/*`. Pourquoi : (1) les flows auth sont **inherent REST** (POST signin, GET verify-email, POST refresh) et beneficient de l'abstraction endpoint ; (2) les cookies `Set-Cookie` posees coexister avec un body JSON de reponse necessite l'objet `NextResponse` explicite, plus lisible que le pattern Server Action ; (3) la reutilisation cross-app (Sprint 17/18/22/27 partagent les memes endpoints) est natural avec un endpoint stable ; (4) les tests Playwright peuvent mock les routes via `page.route('**/api/auth/**', ...)` plus facilement.

#### Cookies httpOnly vs localStorage pour access_token

| Critere | Cookies httpOnly (CHOIX) | localStorage (rejete) |
|---------|---------------------------|-------------------------|
| Immunite XSS | Oui (inaccessibles `document.cookie`) | Non (lisible n'importe quel script) |
| Auto-envoye sur requetes same-origin | Oui (browser injecte automatiquement) | Non (must manually attach `Authorization: Bearer`) |
| CSRF protection | SameSite=lax (suffisant pour POST non-GET-trigger) | Pas de risque CSRF mais XSS pire |
| Cross-domain | `Domain=.skalean-insurtech.ma` permet share entre broker/customer/assure | Per-origin (broker !== customer) |
| Tamper-resistant | Browser-managed | JS-writable (un script malicieux peut overwrite) |
| Refresh rotation transparent | Set-Cookie repose le nouveau token | Doit re-stocker manuellement |
| Inspectable DevTools | Application > Cookies (visible mais readonly) | Application > Local Storage (visible + writable) |
| Cleanup logout | Server `Set-Cookie` avec `Max-Age=0` | `localStorage.removeItem()` (revertible via XSS) |

**Decision** : Cookies httpOnly. OWASP 2021 A07 recommande explicitement de stocker les session tokens en cookies httpOnly+Secure+SameSite=lax pour les applications web. Le pattern industriel (Google, GitHub, Stripe Dashboard) suit cette regle.

#### sessionStorage vs cookie pour mfa_challenge_token

| Critere | sessionStorage (CHOIX) | Cookie (rejete) |
|---------|------------------------|------------------|
| Lifetime | Tab session (auto-cleanup close tab) | Configurable via Max-Age |
| Isolation cross-tab | Oui (chaque tab a son storage) | Non (cookies shared cross-tab same-origin) |
| Server-side accessible | Non (purement client) | Oui (auto-envoye sur chaque request) |
| Risque XSS | Lisible (mais TTL 5min minimise expo) | Pas si httpOnly |
| Volatility intentionnelle | Cleanup automatique securise | Necessite cleanup explicit |
| Use case | Token volatile only pour flow MFA 5min | Token persistant pour session |

**Decision** : sessionStorage. Pourquoi : (1) le challenge MFA est by-design **volatile single-tab** -- si l'utilisateur ferme le tab, il doit recommencer signin ; (2) l'isolation tab evite qu'un utilisateur multi-tab autre cabinet recoive le challenge d'une autre session ; (3) le TTL 5min cote serveur (Sprint 5 MfaService) limite l'exposure XSS theorique a 5min ; (4) le challenge n'est pas un session token complet, juste un "ticket" pour finaliser le 2nd factor.

#### zxcvbn-ts vs regex simple pour password strength

| Critere | @zxcvbn-ts/core (CHOIX) | Regex simple (rejete) |
|---------|--------------------------|-------------------------|
| Detection patterns communs | Oui ("Password1!", "Qwerty123", dictionnaire 30k mots) | Non (juste compte chars) |
| Score 0-4 actionable | Oui (warnings + suggestions) | Non (boolean strong/weak) |
| Locale aware | Oui (dictionnaires fr, ar, etc.) | Non |
| Bundle size | ~70 ko gzipped (lourd) | <1 ko |
| Maintenu | Oui (zxcvbn-ts fork actif depuis 2022) | N/A |
| Faux positifs | Rares | Frequents ("MyP@ss!12345" rejete) |

**Decision** : @zxcvbn-ts/core. Le bundle 70 ko n'est charge que sur la page `/signup` et `/reset-password` (dynamic import), donc impact perf negligeable sur les autres pages. Le benefice UX (eviter les mots de passe communs detectes) prevaut.

#### react-hook-form vs Formik vs uncontrolled

| Critere | react-hook-form (CHOIX) | Formik (rejete) | Uncontrolled (rejete) |
|---------|--------------------------|-----------------|------------------------|
| Re-renders | Minimal (uncontrolled by default + subscribe) | Tout le tree | Aucun |
| Bundle size | ~9 ko gzipped | ~13 ko gzipped | 0 |
| Zod integration | Native via `@hookform/resolvers/zod` | Plugin community | Manuel |
| TypeScript | Excellent | Acceptable | Manuel |
| Validation timing | onBlur / onChange / onSubmit configurable | Same | Manuel |
| Field arrays | Natif `useFieldArray` | Natif | Manuel |
| Adoption (2026) | Standard de fait | Maintenance only | Cas simples |

**Decision** : react-hook-form 7.54.x. Le standard frontend forms 2026, integration Zod via `zodResolver` parfaite.

### Trade-offs explicites

1. **Cookies httpOnly => pas de "Remember me" cote client pur** : la checkbox "Se souvenir de moi" passe par le backend qui ajuste le `Max-Age` du refresh_token (30j si checked, 1j sinon). Le cookie reste httpOnly, jamais readable JS.

2. **sessionStorage mfa_challenge_token => perte si refresh** : si l'utilisateur refresh `/verify-mfa` apres signin, sessionStorage est preserve (refresh = pas un close tab). Si il close le tab, perte. Acceptable -- doit recommencer signin (UX standard industrie).

3. **Schemas Zod synchronises backend/frontend => maintenance** : tout changement schema Sprint 5 backend doit etre repercute ici. Mitigation : package partage `@insurtech/auth/schemas` Sprint 5 exporte les schemas qui sont importes a la fois par api et par web-broker. Voir section 6 patterns.

4. **CIN MA regex strict `[A-Z]{1,2}\d{1,7}` => peut rejeter formats nouveaux** : la regle CNIE actuelle est 1-2 lettres + 1-7 chiffres. Si CNDP publie nouveau format (rare), il faut mettre a jour package partage.

5. **Phone E.164 MA `+212[5-7]\d{8}` => mobile only (5/6/7)** : les fixes (+2125...) sont aussi acceptes par le regex (commence 5). Les numeros etrangers ne sont PAS valides pour le signup broker MA (decision metier : courtiers ne sont pas international).

6. **Toasts sonner over modals** : pour les feedbacks ephemeres (success login, error MFA), `toast.success/error/info` (sonner) est preferable a un `<Dialog>` qui interrompt le flow. Modals sont reserves aux actions destructives (confirmation logout-all).

7. **6 digits MFA auto-submit => peut surprendre si typo rapide** : on auto-submit a 6 chars, mais le user a 200ms de delay si il tape un 7eme char (impossible avec maxLength=1 par input). Le backend valide une seule fois, donc pas de race.

8. **Pas de captcha sur signup/login** : Sprint 5 LockoutService gere rate limiting + lockout apres N tentatives. Si abus persistant, Sprint 14 ajoutera Cloudflare Turnstile. Pas dans Sprint 16.

9. **Email verification consomme token GET (idempotent en V1)** : un user qui click 2x le lien verify-email recoit success les 2 fois (token replay-safe par design Sprint 5 -- `verified_at` set la 1ere fois, 2eme fois idempotent). Test V18 verifie.

10. **No "Resend verification email" UI dans cette tache** : Tache 4.3.11 (profile page) ajoutera "Resend" button. Ici, la page `/email-sent` est purely informative.

### Decisions strategiques referenced

- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans code, JSON messages, toasts, README. Linter custom verifie en CI.
- **decision-007 (Zod runtime validation)** : tous les formulaires utilisent Zod via `zodResolver`. Les schemas sont importes de `@insurtech/auth/schemas` (package Sprint 5).
- **decision-008 (cloud souverain MA Atlas Cloud)** : aucune dependance AWS dans les pages. Si CDN (avatar par exemple), `cdn.skalean-insurtech.ma` (CloudFront equivalent Atlas).
- **decision-009 (multilinguisme MA)** : trois locales obligatoires fr / ar-MA / ar. Tous les textes auth sont localizes.
- **decision-013 (Argon2id)** : indirecte ; backend Sprint 5 hash les passwords, frontend ne touche jamais le hash.
- **decision-014 (JWT theft detection rotation)** : implementation cote Route Handler `/api/auth/refresh` qui consume le refresh_token Sprint 5 service et repose le nouveau.

### Pieges techniques connus (15 minimum)

1. **Hydration mismatch sur le formulaire avec `defaultValues`** : si `defaultValues={{ email: searchParams.get('email') }}` cote RSC et client diverge, hydration warning. Solution : forcer 'use client' sur les pages auth + lire searchParams via `useSearchParams()` post-mount.

2. **Cookies `Set-Cookie` ignores en dev sur localhost sans Secure** : Chrome bloque `Secure` cookies sur HTTP localhost en strict mode. Solution : conditional `secure: isProd` dans Route Handler, donc dev HTTP marche.

3. **`SameSite=strict` casse les redirects cross-tab depuis email** : si user clique link `/verify-email?token=...` depuis un email externe (Gmail), `strict` empeche le cookie d'etre envoye sur la 1ere navigation. Solution : `SameSite=lax` (compatible avec cross-site GET navigation safe).

4. **`HttpOnly` + EventSource server-sent events** : si Sprint 5 ajoute realtime notifications via SSE/WebSocket, le navigateur n'envoie pas les cookies httpOnly. Solution : pour WS, utiliser sub-protocol token ou query param signed (Sprint 14). Pas un piege ici mais a documenter.

5. **mfa_challenge_token leak via console.log** : si dev log `data.mfa_challenge_token` accidentellement, expose dans browser console. Solution : NEVER log auth tokens, lint rule `no-console` strict + grep CI.

6. **6 digits MFA input paste 6 chars en 1 fois** : si user paste "123456" dans input #1, doit dispatcher dans 6 inputs. Solution : `onPaste` handler split + distribute. Voir section 6 component MfaCodeInput.

7. **Auto-submit MFA double-trigger** : si onChange (6e char) trigger submit ET user appuie Enter, 2 submissions. Solution : ref `submittingRef.current` flag + early return.

8. **Backspace MFA navigation** : user veut effacer char 6 et revenir a 5, doit auto-focus input 5. Solution : `onKeyDown` Backspace + `prev.focus()`.

9. **`zxcvbn-ts` synchronous heavy** : score calculation peut bloquer main thread 50-100ms. Solution : `useDeferredValue` (React 19) + debounce 200ms.

10. **`@hookform/resolvers/zod` Zod v3 vs v4** : `zodResolver` n'est compatible que `zod@3.24+`. Solution : version pin `zod@3.24.1` + dependency `@hookform/resolvers@3.9.x`.

11. **Reset-password token expire pendant le formulaire** : user ouvre `/reset-password?token=X` mais attend 30min avant submit. Token expire (TTL 15min Sprint 5). Solution : decode token client-side via `jose` decode (pas verify), afficher countdown "Token expire dans Xmin" + bouton "Demander nouveau lien".

12. **Refresh token rotation race** : 2 tabs ouverts, tab1 refresh token A, tab2 essaie aussi refresh token A. Sprint 5 backend retourne 409 TOKEN_REUSE_DETECTED + family revoke = logout les 2 tabs. UX terrible. Solution : `BroadcastChannel('auth')` coordonne refresh single-tab (un leader elected via Web Lock API).

13. **Logout server-side n'invalide pas tab2** : tab1 logout, tab2 toujours authentifie cote UI (cookies poses Max-Age=0 mais tab2 n'a pas reload). Solution : `BroadcastChannel('auth').postMessage({ type: 'logout' })` + listener qui force `router.push('/login')`.

14. **`Set-Cookie` multiple dans 1 response** : Next.js 15 `NextResponse.cookies.set()` multiple OK (3 cookies poses dans 1 response). Mais Edge runtime middleware NE PEUT PAS set multi-cookies fiablement avant Next 15.1. Solution : valider en CI smoke test.

15. **`select-tenant` page accessible authenticated only mais sans tenant** : middleware Sprint 4 redirige si `access_token` absent. Mais si user authentifie + no `current_tenant_id`, middleware redirige `/select-tenant`. Cette page doit avoir `current_tenant_id=null` valide (pas une infinite loop). Solution : whitelist `/select-tenant` dans middleware route public-quand-token-present.

16. **Email verification deep-link locale-aware** : email envoye en `fr` linke vers `/fr/verify-email?token=...` ; si user click depuis un browser en `ar`, doit-il etre redirige `/ar/verify-email` ? Decision : pas de re-detection locale, le user reste sur la locale du lien (correspondant a sa preference au moment de l'envoi email).

17. **Reset password mot de passe identique au current** : Sprint 5 backend ne verifie PAS l'unicite (decision metier : user peut "reset" vers meme password si il l'a oublie). Frontend ne demande pas current password sur reset (cas oublie). Ne pas confondre avec "change password" Tache 4.3.11 qui demande current.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16

`task-4.3.2` est la **deuxieme des 14 taches** du Sprint 16 et bloque toutes les suivantes (qui supposent user authentifie + tenant selectionne) :

```
Sprint 16 -- Web Broker App (14 taches)

[4.3.1 App skeleton + middleware + i18n] <-- prerequis
   |
   v
[4.3.2 Pages auth login + MFA + signup + recovery]  <-- CETTE TACHE
   |
   v
[4.3.3 Layout principal sidebar + topbar + tenant switcher]
   |
   +--> [4.3.4 Dashboard 6 widgets]
   +--> [4.3.5 Contacts CRUD]
   +--> [4.3.6 Companies CRUD]
   +--> [4.3.7 Deals Kanban + table]
   +--> [4.3.8 Polices list + detail]
   +--> [4.3.9 Broker Queue validation]
   +--> [4.3.10 Sinistres read-only]
   +--> [4.3.11 Parametres + profile + MFA setup]
   +--> [4.3.12 RBAC UI]
   +--> [4.3.13 I18n complete]
   +--> [4.3.14 Tests E2E + a11y]
```

### Position dans le programme

Cette tache impacte directement les sprints 17 (web-customer-portal SEO + souscription en ligne) et 18 (web-assure-portal self-service) qui partageront le meme proxy `/api/auth/*` et les memes composants `<AuthLayout>` + `<MfaCodeInput>` + `<PasswordStrengthIndicator>`. Le pattern Route Handler + cookies httpOnly + Zod schemas est donc validate ici, puis reapplique tel quel.

### Diagramme ASCII de l'app `web-broker` apres Tache 4.3.2

```
repo/apps/web-broker/
|
|-- app/
|   |-- [locale]/
|   |   |-- (auth)/
|   |   |   |-- layout.tsx                      # Sprint 4 layout shell + brand
|   |   |   |-- login/
|   |   |   |   |-- page.tsx                    # ~180 lignes signin form + MFA flow detection
|   |   |   |-- verify-mfa/
|   |   |   |   |-- page.tsx                    # ~150 lignes 6 digits TOTP + auto-submit
|   |   |   |-- signup/
|   |   |   |   |-- page.tsx                    # ~220 lignes full form + zxcvbn
|   |   |   |-- email-sent/
|   |   |   |   |-- page.tsx                    # ~50 lignes static info
|   |   |   |-- forgot-password/
|   |   |   |   |-- page.tsx                    # ~100 lignes email + submit
|   |   |   |-- reset-password/
|   |   |   |   |-- page.tsx                    # ~150 lignes new password + token validation
|   |   |   |-- verify-email/
|   |   |   |   |-- page.tsx                    # ~80 lignes auto-verify GET + redirect
|   |   |   |-- select-tenant/
|   |   |   |   |-- page.tsx                    # ~120 lignes multi-tenant cards
|   |   |   |-- logout/
|   |   |       |-- page.tsx                    # ~50 lignes auto-logout + redirect
|   |   |-- (protected)/                        # Sprint 4 protected layout (Tache 4.3.3 ajoute sidebar)
|   |       |-- dashboard/page.tsx              # placeholder Tache 4.3.4
|   |
|   |-- api/
|   |   |-- auth/
|   |   |   |-- signin/route.ts                 # POST proxy backend + set cookies
|   |   |   |-- verify-mfa/route.ts             # POST proxy backend + set cookies
|   |   |   |-- signup/route.ts                 # POST proxy backend (no cookies, email-sent step)
|   |   |   |-- forgot-password/route.ts        # POST proxy backend
|   |   |   |-- reset-password/route.ts         # POST proxy backend
|   |   |   |-- verify-email/route.ts           # GET proxy backend
|   |   |   |-- refresh/route.ts                # POST proxy + rotate cookies
|   |   |   |-- logout/route.ts                 # POST proxy + clear cookies
|   |   |   |-- select-tenant/route.ts          # POST set cookie current_tenant_id
|   |   |   |-- me/route.ts                     # GET proxy backend (for hydration)
|
|-- components/
|   |-- auth/
|       |-- auth-layout.tsx                     # ~80 lignes shell brand + card centered
|       |-- password-strength-indicator.tsx     # ~150 lignes zxcvbn + bar + suggestions
|       |-- mfa-code-input.tsx                  # ~180 lignes 6 inputs refs + auto-advance + paste
|       |-- tenant-selector-card.tsx            # ~100 lignes card per tenant
|       |-- submit-button.tsx                   # ~40 lignes loading state + disabled
|
|-- lib/
|   |-- auth/
|       |-- schemas.ts                          # ~200 lignes all Zod schemas
|       |-- cookies.ts                          # ~80 lignes helpers set/clear cookies httpOnly
|       |-- api-proxy.ts                        # ~100 lignes fetch wrapper backend with retries
|       |-- broadcast.ts                        # ~60 lignes BroadcastChannel('auth') multi-tab sync
|
|-- messages/
|   |-- fr.json                                 # +50 cles auth.*
|   |-- ar-MA.json                              # +50 cles
|   |-- ar.json                                 # +50 cles
|
|-- e2e/
|   |-- auth/
|       |-- login.spec.ts                       # 4 scenarios
|       |-- mfa.spec.ts                         # 3 scenarios
|       |-- signup.spec.ts                      # 3 scenarios
|       |-- recovery.spec.ts                    # 3 scenarios
|       |-- multi-tenant.spec.ts                # 2 scenarios
|
|-- test/
|   |-- auth/
|       |-- schemas.spec.ts                     # 8 tests Zod
|       |-- mfa-code-input.spec.tsx             # 5 tests component
|       |-- password-strength.spec.tsx          # 4 tests component
|       |-- cookies.spec.ts                     # 3 tests helpers
```

### Provider chain rendue (auth pages)

```
<html lang="fr" dir="ltr">
  <body>
    <ThemeProvider>
      <NextIntlClientProvider>
        <Providers>                              <-- Sprint 4 client wrapper
          <QueryClientProvider>
            <AuthLayout>                         <-- NOUVEAU Tache 4.3.2
              <Card>                             <-- shadcn/ui (Sprint 4)
                {children}                       <-- page.tsx form
              </Card>
            </AuthLayout>
          </QueryClientProvider>
        </Providers>
      </NextIntlClientProvider>
      <Toaster />                                <-- sonner
    </ThemeProvider>
  </body>
</html>
```

---

## 4. Livrables checkables (25+ deliverables)

- [ ] **L1** : `repo/apps/web-broker/app/[locale]/(auth)/login/page.tsx` (~180 lignes) : Client Component avec `react-hook-form` + `zodResolver(SignInSchema)`, fields email + password + remember_me, submit POST `/api/auth/signin`, detection `data.needs_mfa` -> `sessionStorage.setItem('mfa_challenge_token', ...)` + `router.push('/verify-mfa')`, redirect `/select-tenant` si `data.tenants.length > 1`, sinon `/dashboard`. Bouton submit disabled pendant in-flight. Links `/forgot-password` + `/signup` visibles.

- [ ] **L2** : `repo/apps/web-broker/app/[locale]/(auth)/verify-mfa/page.tsx` (~150 lignes) : Client Component avec `<MfaCodeInput>` 6 digits, lecture `mfa_challenge_token` depuis `sessionStorage`, redirect `/login` si absent ; auto-submit a 6 caracteres POST `/api/auth/verify-mfa`. Affichage timer countdown 5min (decode JWT challenge `exp` via `jose`). Bouton "Renvoyer code" desactive si trust_device pas active. Lien "Utiliser code de recovery".

- [ ] **L3** : `repo/apps/web-broker/app/[locale]/(auth)/signup/page.tsx` (~220 lignes) : Client Component avec `react-hook-form` + `zodResolver(SignUpSchema)`, fields email + password + display_name + locale (select fr/ar-MA/ar) + accept_terms + consent_cndp (loi 09-08), `<PasswordStrengthIndicator>` reactif sur password input, submit POST `/api/auth/signup`, redirect `/email-sent?email=...`.

- [ ] **L4** : `repo/apps/web-broker/app/[locale]/(auth)/email-sent/page.tsx` (~50 lignes) : Server Component lecture searchParam `email`, message "Email de verification envoye a {email}", bouton "Renvoyer" (Tache 4.3.11), lien "Retour login".

- [ ] **L5** : `repo/apps/web-broker/app/[locale]/(auth)/forgot-password/page.tsx` (~100 lignes) : Client Component avec `zodResolver(ForgotPasswordSchema)`, field email, submit POST `/api/auth/forgot-password`, toast success + redirect `/email-sent?email=...&type=reset`.

- [ ] **L6** : `repo/apps/web-broker/app/[locale]/(auth)/reset-password/page.tsx` (~150 lignes) : Client Component lecture `token` depuis searchParams, decode `token` via `jose` (sans verify) pour afficher countdown TTL, `react-hook-form` + `zodResolver(ResetPasswordSchema)`, field new_password + confirm_password, `<PasswordStrengthIndicator>`, submit POST `/api/auth/reset-password` avec body `{ token, new_password }`, redirect `/login` + toast success.

- [ ] **L7** : `repo/apps/web-broker/app/[locale]/(auth)/verify-email/page.tsx` (~80 lignes) : Client Component lecture `token`, auto-GET `/api/auth/verify-email?token=...` au mount, affichage spinner pendant verif, toast success + redirect `/login`, ou toast error si token expired.

- [ ] **L8** : `repo/apps/web-broker/app/[locale]/(auth)/select-tenant/page.tsx` (~120 lignes) : Server Component fetch GET `/api/auth/me` pour lister `tenants[]`, affichage cards `<TenantSelectorCard>` per tenant (logo, name, role), click POST `/api/auth/select-tenant` body `{ tenant_id }`, redirect `/dashboard`.

- [ ] **L9** : `repo/apps/web-broker/app/[locale]/(auth)/logout/page.tsx` (~50 lignes) : Client Component auto-POST `/api/auth/logout` au mount, `BroadcastChannel('auth').postMessage({ type: 'logout' })`, redirect `/login?message=logged_out`.

- [ ] **L10** : `repo/apps/web-broker/app/[locale]/(auth)/layout.tsx` (~80 lignes) : Server Component shell avec logo Skalean + card centered (max-w-md) + lang switcher footer.

- [ ] **L11** : `repo/apps/web-broker/app/api/auth/signin/route.ts` (~110 lignes) : POST Route Handler, parse body Zod, fetch backend `POST {API}/auth/signin`, si `mfa_required` retour `{ needs_mfa: true, mfa_challenge_token }`, sinon set cookies httpOnly `access_token` (Max-Age 900s) + `refresh_token` (Max-Age 2592000s if remember_me sinon 86400s) + `current_tenant_id` si single-tenant, retour JSON `{ ok: true, tenants, needs_tenant_selection }`.

- [ ] **L12** : `repo/apps/web-broker/app/api/auth/verify-mfa/route.ts` (~90 lignes) : POST Route Handler, parse body `{ mfa_challenge_token, mfa_code }` Zod, fetch backend `POST {API}/auth/verify-mfa`, set cookies + retour JSON `{ ok: true, tenants }`.

- [ ] **L13** : `repo/apps/web-broker/app/api/auth/signup/route.ts` (~80 lignes) : POST Route Handler, parse body Zod SignUpSchema (incl. consent_cndp + accept_terms), fetch backend `POST {API}/auth/signup`, retour JSON `{ ok: true, user_id }` (PAS de cookies -- email verification required).

- [ ] **L14** : `repo/apps/web-broker/app/api/auth/refresh/route.ts` (~100 lignes) : POST Route Handler, lecture cookie `refresh_token`, fetch backend `POST {API}/auth/refresh`, rotation : repose access_token + refresh_token (nouveaux JWTs). Si backend retourne 401 TOKEN_REUSE_DETECTED, clear cookies + retour 401.

- [ ] **L15** : `repo/apps/web-broker/app/api/auth/forgot-password/route.ts` (~50 lignes) : POST Route Handler, parse body `{ email }`, fetch backend, retour always `{ ok: true }` (defense user enumeration -- meme reponse si email existe ou non).

- [ ] **L16** : `repo/apps/web-broker/app/api/auth/reset-password/route.ts` (~60 lignes) : POST Route Handler, parse body `{ token, new_password }`, fetch backend, retour `{ ok: true }`.

- [ ] **L17** : `repo/apps/web-broker/app/api/auth/verify-email/route.ts` (~50 lignes) : GET Route Handler, query `token`, fetch backend, retour `{ ok: true }` ou erreur.

- [ ] **L18** : `repo/apps/web-broker/app/api/auth/logout/route.ts` (~70 lignes) : POST Route Handler, fetch backend `POST {API}/auth/logout` avec access_token courant pour invalider session backend, clear cookies `access_token` + `refresh_token` + `current_tenant_id` (Max-Age 0), retour `{ ok: true }`.

- [ ] **L19** : `repo/apps/web-broker/app/api/auth/select-tenant/route.ts` (~60 lignes) : POST Route Handler, parse body `{ tenant_id }`, verifier que `tenant_id` est dans la liste autorisee user (re-fetch `/auth/me` ou decode JWT), set cookie `current_tenant_id`, retour `{ ok: true }`.

- [ ] **L20** : `repo/apps/web-broker/app/api/auth/me/route.ts` (~50 lignes) : GET Route Handler, fetch backend `GET {API}/auth/me` avec access_token cookie, retour profile + tenants.

- [ ] **L21** : `repo/apps/web-broker/components/auth/auth-layout.tsx` (~80 lignes) : shell brand + card center + footer locale switcher.

- [ ] **L22** : `repo/apps/web-broker/components/auth/password-strength-indicator.tsx` (~150 lignes) : `'use client'` ; dynamic import `@zxcvbn-ts/core` + dictionnaire fr ; `useDeferredValue(password)` ; score 0-4 mapped vers `<Progress>` shadcn/ui ; couleur red/orange/yellow/green/emerald ; suggestions list ; warning highlight.

- [ ] **L23** : `repo/apps/web-broker/components/auth/mfa-code-input.tsx` (~180 lignes) : 6 inputs `maxLength=1` + refs array ; `onChange` auto-advance focus ; `onKeyDown` Backspace navigation reverse ; `onPaste` distribute 6 chars ; auto-submit callback at 6 chars ; disable apres submit (ref flag).

- [ ] **L24** : `repo/apps/web-broker/components/auth/tenant-selector-card.tsx` (~100 lignes) : card avec logo + name + role + click handler POST `/api/auth/select-tenant`.

- [ ] **L25** : `repo/apps/web-broker/components/auth/submit-button.tsx` (~40 lignes) : wrapper `<Button>` shadcn/ui avec `loading` prop -> spinner + disabled.

- [ ] **L26** : `repo/apps/web-broker/lib/auth/schemas.ts` (~200 lignes) : tous les schemas Zod : `SignInSchema`, `SignUpSchema`, `ForgotPasswordSchema`, `ResetPasswordSchema`, `VerifyMfaSchema`, `SelectTenantSchema`, `EmailSchema`, `PasswordSchema`, `CinMaSchema`, `PhoneMaSchema`.

- [ ] **L27** : `repo/apps/web-broker/lib/auth/cookies.ts` (~80 lignes) : helpers `setAuthCookies(response, { accessToken, refreshToken, currentTenantId?, rememberMe })` + `clearAuthCookies(response)` + `getRefreshToken(request)`.

- [ ] **L28** : `repo/apps/web-broker/lib/auth/api-proxy.ts` (~100 lignes) : `proxyToBackend({ method, path, body?, accessToken? })` wrapper `fetch` avec timeout + retry x1 sur 5xx + injection `x-trace-id` + log Sentry.

- [ ] **L29** : `repo/apps/web-broker/lib/auth/broadcast.ts` (~60 lignes) : `getAuthBroadcastChannel()` singleton ; events `{ type: 'logout' | 'login' | 'tenant-switch' }` ; hook `useAuthBroadcast(handler)`.

- [ ] **L30** : `repo/apps/web-broker/messages/fr.json` enrichi avec ~50 cles `auth.*` (toutes les labels + erreurs + helpers).

- [ ] **L31** : `repo/apps/web-broker/messages/ar-MA.json` enrichi avec ~50 cles auth Darija.

- [ ] **L32** : `repo/apps/web-broker/messages/ar.json` enrichi avec ~50 cles auth arabe classique.

- [ ] **L33** : Tests unitaires Vitest : `lib/auth/schemas.spec.ts` (8 tests), `components/auth/mfa-code-input.spec.tsx` (5 tests), `components/auth/password-strength-indicator.spec.tsx` (4 tests), `lib/auth/cookies.spec.ts` (3 tests).

- [ ] **L34** : Tests E2E Playwright : `e2e/auth/login.spec.ts` (4 scenarios), `e2e/auth/mfa.spec.ts` (3 scenarios), `e2e/auth/signup.spec.ts` (3 scenarios), `e2e/auth/recovery.spec.ts` (3 scenarios), `e2e/auth/multi-tenant.spec.ts` (2 scenarios).

- [ ] **L35** : Validation `pnpm --filter @insurtech/web-broker test` 100% green, `pnpm --filter @insurtech/web-broker test:e2e -g auth` 15+ tests green, `pnpm --filter @insurtech/web-broker lint` 0 warnings, `pnpm --filter @insurtech/web-broker typecheck` 0 errors.

- [ ] **L36** : `grep -rn "console.log" repo/apps/web-broker/app/api/auth/` retourne 0 ligne (production code zero log).

- [ ] **L37** : `grep -rn "localStorage.setItem.*token" repo/apps/web-broker/` retourne 0 ligne (tokens en cookies httpOnly seulement).

- [ ] **L38** : Audit cookies Chrome DevTools : `access_token` + `refresh_token` + `current_tenant_id` flags `HttpOnly + Secure(prod) + SameSite=Lax + Path=/`.

- [ ] **L39** : `grep -rn "emoji-regex\|[\u{1F300}-\u{1F9FF}]" repo/apps/web-broker/app/\[locale\]/\(auth\)/` retourne 0 ligne (decision-006 stricte).

- [ ] **L40** : Lighthouse Accessibility >= 95 sur `/fr/login`.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-broker/
  app/
    [locale]/
      (auth)/
        layout.tsx                                       # ~80 lignes  -- L10
        login/page.tsx                                   # ~180 lignes -- L1
        verify-mfa/page.tsx                              # ~150 lignes -- L2
        signup/page.tsx                                  # ~220 lignes -- L3
        email-sent/page.tsx                              # ~50 lignes  -- L4
        forgot-password/page.tsx                         # ~100 lignes -- L5
        reset-password/page.tsx                          # ~150 lignes -- L6
        verify-email/page.tsx                            # ~80 lignes  -- L7
        select-tenant/page.tsx                           # ~120 lignes -- L8
        logout/page.tsx                                  # ~50 lignes  -- L9
    api/
      auth/
        signin/route.ts                                  # ~110 lignes -- L11
        verify-mfa/route.ts                              # ~90 lignes  -- L12
        signup/route.ts                                  # ~80 lignes  -- L13
        refresh/route.ts                                 # ~100 lignes -- L14
        forgot-password/route.ts                         # ~50 lignes  -- L15
        reset-password/route.ts                          # ~60 lignes  -- L16
        verify-email/route.ts                            # ~50 lignes  -- L17
        logout/route.ts                                  # ~70 lignes  -- L18
        select-tenant/route.ts                           # ~60 lignes  -- L19
        me/route.ts                                      # ~50 lignes  -- L20
  components/
    auth/
      auth-layout.tsx                                    # ~80 lignes  -- L21
      password-strength-indicator.tsx                    # ~150 lignes -- L22
      mfa-code-input.tsx                                 # ~180 lignes -- L23
      tenant-selector-card.tsx                           # ~100 lignes -- L24
      submit-button.tsx                                  # ~40 lignes  -- L25
  lib/
    auth/
      schemas.ts                                         # ~200 lignes -- L26
      cookies.ts                                         # ~80 lignes  -- L27
      api-proxy.ts                                       # ~100 lignes -- L28
      broadcast.ts                                       # ~60 lignes  -- L29
  messages/
    fr.json                                              # +50 cles    -- L30
    ar-MA.json                                           # +50 cles    -- L31
    ar.json                                              # +50 cles    -- L32
  e2e/auth/
    login.spec.ts                                        # ~200 lignes -- L34a
    mfa.spec.ts                                          # ~180 lignes -- L34b
    signup.spec.ts                                       # ~170 lignes -- L34c
    recovery.spec.ts                                     # ~180 lignes -- L34d
    multi-tenant.spec.ts                                 # ~120 lignes -- L34e
  test/auth/
    schemas.spec.ts                                      # ~150 lignes -- L33a
    mfa-code-input.spec.tsx                              # ~120 lignes -- L33b
    password-strength-indicator.spec.tsx                 # ~100 lignes -- L33c
    cookies.spec.ts                                      # ~80 lignes  -- L33d
```

Total : ~30 fichiers crees, ~3500 lignes nettes hors tests, ~1200 lignes tests.

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `repo/apps/web-broker/lib/auth/schemas.ts` (~200 lignes)

```typescript
/**
 * Auth Zod schemas -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Ces schemas sont la copie cote frontend des schemas backend Sprint 5
 * (`@insurtech/auth/schemas`). En cas de modification, mettre a jour les deux.
 *
 * Decisions :
 *   - decision-007 (Zod runtime) : tous formulaires + routes proxy valident via ces schemas
 *   - decision-006 (no-emoji) : messages d'erreur en francais standard sans emoji
 *
 * Patterns MA :
 *   - CIN MA : 1-2 lettres majuscules + 1-7 chiffres (e.g. "BE123456")
 *   - Phone MA : +212[5-7]NNNNNNNN (mobile 6/7, fixe 5) format E.164
 *   - Locale : 'fr' | 'ar-MA' | 'ar' (decision-009)
 */
import { z } from 'zod';

// ===== PRIMITIVES =====

export const EmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, { message: 'auth.errors.email.required' })
  .max(255, { message: 'auth.errors.email.tooLong' })
  .email({ message: 'auth.errors.email.invalid' });

/**
 * Password complexity rules (sync avec Sprint 5 backend AuthService) :
 *   - min 12 chars (NIST SP 800-63B section 5.1.1.2)
 *   - max 128 chars (limite Argon2 + DoS prevention)
 *   - au moins 1 lowercase, 1 uppercase, 1 digit, 1 special
 *   - pas de validation dictionnaire ici (zxcvbn cote UI seulement)
 */
export const PasswordSchema = z
  .string()
  .min(12, { message: 'auth.errors.password.tooShort' })
  .max(128, { message: 'auth.errors.password.tooLong' })
  .regex(/[a-z]/, { message: 'auth.errors.password.missingLowercase' })
  .regex(/[A-Z]/, { message: 'auth.errors.password.missingUppercase' })
  .regex(/\d/, { message: 'auth.errors.password.missingDigit' })
  .regex(/[@$!%*?&#^()\-_=+\[\]{};:'",.<>/?\\|`~]/, {
    message: 'auth.errors.password.missingSpecial',
  });

/**
 * CIN MA Carte Identite Nationale Marocaine.
 * Format officiel CNIE : 1 ou 2 lettres majuscules suivies de 1 a 7 chiffres.
 * Examples : "AB123456", "BE12", "K9876543"
 */
export const CinMaSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{1,2}\d{1,7}$/, { message: 'auth.errors.cin.invalid' });

/**
 * Phone E.164 MA. Indicatif +212 puis chiffre national 5 / 6 / 7.
 * Mobile : +2126XXXXXXXX ou +2127XXXXXXXX (9 chiffres apres +212).
 * Fixe : +2125XXXXXXXX (region Casablanca/Rabat/etc.).
 */
export const PhoneMaSchema = z
  .string()
  .trim()
  .regex(/^\+212[5-7]\d{8}$/, { message: 'auth.errors.phone.invalid' });

export const DisplayNameSchema = z
  .string()
  .trim()
  .min(2, { message: 'auth.errors.displayName.tooShort' })
  .max(80, { message: 'auth.errors.displayName.tooLong' });

export const LocaleSchema = z.enum(['fr', 'ar-MA', 'ar'], {
  errorMap: () => ({ message: 'auth.errors.locale.invalid' }),
});

export const MfaCodeSchema = z
  .string()
  .trim()
  .length(6, { message: 'auth.errors.mfa.invalidLength' })
  .regex(/^\d{6}$/, { message: 'auth.errors.mfa.invalidFormat' });

export const TenantIdSchema = z.string().uuid({ message: 'auth.errors.tenant.invalidId' });

// ===== COMPOSITES =====

export const SignInSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, { message: 'auth.errors.password.required' }),
  remember_me: z.boolean().default(false),
});
export type SignInInput = z.infer<typeof SignInSchema>;

export const SignUpSchema = z
  .object({
    email: EmailSchema,
    password: PasswordSchema,
    password_confirm: z.string().min(1, { message: 'auth.errors.passwordConfirm.required' }),
    display_name: DisplayNameSchema,
    locale: LocaleSchema.default('fr'),
    phone: PhoneMaSchema.optional(),
    accept_terms: z.literal(true, {
      errorMap: () => ({ message: 'auth.errors.terms.required' }),
    }),
    consent_cndp: z.literal(true, {
      errorMap: () => ({ message: 'auth.errors.consentCndp.required' }),
    }),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'auth.errors.passwordConfirm.mismatch',
    path: ['password_confirm'],
  });
export type SignUpInput = z.infer<typeof SignUpSchema>;

export const VerifyMfaSchema = z.object({
  mfa_challenge_token: z.string().min(20, {
    message: 'auth.errors.mfaChallenge.invalid',
  }),
  mfa_code: MfaCodeSchema,
  trust_device: z.boolean().default(false),
});
export type VerifyMfaInput = z.infer<typeof VerifyMfaSchema>;

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(20, { message: 'auth.errors.token.invalid' }),
    new_password: PasswordSchema,
    new_password_confirm: z.string().min(1),
  })
  .refine((data) => data.new_password === data.new_password_confirm, {
    message: 'auth.errors.passwordConfirm.mismatch',
    path: ['new_password_confirm'],
  });
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const VerifyEmailSchema = z.object({
  token: z.string().min(20, { message: 'auth.errors.token.invalid' }),
});

export const SelectTenantSchema = z.object({
  tenant_id: TenantIdSchema,
});
export type SelectTenantInput = z.infer<typeof SelectTenantSchema>;

// ===== BACKEND RESPONSE TYPES (inferred from Sprint 5 contracts) =====

export const SignInResponseSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('authenticated'),
    access_token: z.string(),
    refresh_token: z.string(),
    user: z.object({
      id: z.string().uuid(),
      email: z.string().email(),
      display_name: z.string(),
      locale: LocaleSchema,
      mfa_enabled: z.boolean(),
    }),
    tenants: z.array(
      z.object({
        id: TenantIdSchema,
        name: z.string(),
        role: z.string(),
        logo_url: z.string().url().nullable(),
      }),
    ),
  }),
  z.object({
    outcome: z.literal('mfa_required'),
    mfa_challenge_token: z.string(),
    mfa_challenge_expires_at: z.string().datetime(),
  }),
]);
export type SignInResponse = z.infer<typeof SignInResponseSchema>;

export const TenantSummarySchema = z.object({
  id: TenantIdSchema,
  name: z.string(),
  role: z.string(),
  logo_url: z.string().url().nullable(),
});
export type TenantSummary = z.infer<typeof TenantSummarySchema>;
```

### 6.2 `repo/apps/web-broker/lib/auth/cookies.ts` (~80 lignes)

```typescript
/**
 * Cookies helpers httpOnly + Secure + SameSite=lax -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Defense XSS : tokens jamais accessibles document.cookie cote JS client.
 * CSRF mitigation : SameSite=lax bloque les requetes cross-site non-GET-safe.
 *
 * Conformite : decret CNDP cookies 2024 (consent + securisation).
 */
import type { NextRequest, NextResponse } from 'next/server';

const isProd = process.env.NODE_ENV === 'production';

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 min
const REFRESH_TOKEN_MAX_AGE_SHORT = 24 * 60 * 60; // 1 jour si !remember_me
const REFRESH_TOKEN_MAX_AGE_LONG = 30 * 24 * 60 * 60; // 30 jours si remember_me
const TENANT_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 jours

export const COOKIE_ACCESS_TOKEN = 'access_token';
export const COOKIE_REFRESH_TOKEN = 'refresh_token';
export const COOKIE_CURRENT_TENANT = 'current_tenant_id';

interface SetAuthCookiesParams {
  response: NextResponse;
  accessToken: string;
  refreshToken: string;
  currentTenantId?: string | null;
  rememberMe?: boolean;
}

export function setAuthCookies(params: SetAuthCookiesParams): void {
  const { response, accessToken, refreshToken, currentTenantId, rememberMe = false } = params;

  const baseOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
  };

  response.cookies.set(COOKIE_ACCESS_TOKEN, accessToken, {
    ...baseOpts,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  response.cookies.set(COOKIE_REFRESH_TOKEN, refreshToken, {
    ...baseOpts,
    maxAge: rememberMe ? REFRESH_TOKEN_MAX_AGE_LONG : REFRESH_TOKEN_MAX_AGE_SHORT,
  });

  if (currentTenantId) {
    response.cookies.set(COOKIE_CURRENT_TENANT, currentTenantId, {
      ...baseOpts,
      maxAge: TENANT_COOKIE_MAX_AGE,
    });
  }
}

export function clearAuthCookies(response: NextResponse): void {
  const baseOpts = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
  response.cookies.set(COOKIE_ACCESS_TOKEN, '', baseOpts);
  response.cookies.set(COOKIE_REFRESH_TOKEN, '', baseOpts);
  response.cookies.set(COOKIE_CURRENT_TENANT, '', baseOpts);
}

export function getAccessToken(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_ACCESS_TOKEN)?.value ?? null;
}

export function getRefreshToken(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_REFRESH_TOKEN)?.value ?? null;
}

export function getCurrentTenantId(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_CURRENT_TENANT)?.value ?? null;
}
```

### 6.3 `repo/apps/web-broker/lib/auth/api-proxy.ts` (~100 lignes)

```typescript
/**
 * Backend API proxy wrapper -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Toutes les routes /api/auth/* utilisent ce wrapper pour appeler le backend NestJS.
 * Centralise :
 *   - injection x-trace-id UUID
 *   - timeout 10s par defaut
 *   - retry 1x sur 502/503/504 (transients)
 *   - normalisation erreurs structure { error: { code, message } }
 *   - Sentry capture sur 5xx
 */
import * as Sentry from '@sentry/nextjs';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const DEFAULT_TIMEOUT_MS = 10_000;

export interface ProxyOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  accessToken?: string | null;
  refreshToken?: string | null;
  acceptLanguage?: string;
  timeoutMs?: number;
}

export interface ProxyResult<T = unknown> {
  status: number;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
}

function generateTraceId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

export async function proxyToBackend<T = unknown>(opts: ProxyOptions): Promise<ProxyResult<T>> {
  const {
    method,
    path,
    body,
    accessToken,
    refreshToken,
    acceptLanguage = 'fr',
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  const traceId = generateTraceId();
  const url = `${API_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-trace-id': traceId,
    'Accept-Language': acceptLanguage,
  };

  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (refreshToken) headers['x-refresh-token'] = refreshToken;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timeoutHandle);

      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (response.ok) {
        return { status: response.status, data: payload as T, error: null };
      }

      // Retry sur 502/503/504 si attempt 1
      if ([502, 503, 504].includes(response.status) && attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 250));
        continue;
      }

      if (response.status >= 500) {
        Sentry.captureMessage(`Backend ${response.status} on ${method} ${path}`, {
          level: 'error',
          tags: { traceId, path, method },
          extra: { payload },
        });
      }

      const errorBody = (payload as { error?: { code?: string; message?: string } })?.error;
      return {
        status: response.status,
        data: null,
        error: {
          code: errorBody?.code ?? 'UNKNOWN_ERROR',
          message: errorBody?.message ?? 'auth.errors.network',
        },
      };
    } catch (err) {
      clearTimeout(timeoutHandle);
      if ((err as Error).name === 'AbortError') {
        return { status: 408, data: null, error: { code: 'TIMEOUT', message: 'auth.errors.timeout' } };
      }
      Sentry.captureException(err, { tags: { traceId, path, method } });
      return {
        status: 500,
        data: null,
        error: { code: 'NETWORK_ERROR', message: 'auth.errors.network' },
      };
    }
  }

  return { status: 500, data: null, error: { code: 'UNKNOWN', message: 'auth.errors.unknown' } };
}
```

### 6.4 `repo/apps/web-broker/lib/auth/broadcast.ts` (~60 lignes)

```typescript
/**
 * BroadcastChannel multi-tab auth sync -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Coordonne les evenements auth entre tabs same-origin :
 *   - logout sur tab1 -> tab2 force redirect /login
 *   - login sur tab1 -> tab2 force reload (acquire access_token)
 *   - tenant-switch -> reload sur autres tabs
 *
 * Piege #12 -- evite refresh-token race entre tabs.
 */
'use client';

import { useEffect } from 'react';

export type AuthBroadcastEvent =
  | { type: 'logout' }
  | { type: 'login'; userId: string }
  | { type: 'tenant-switch'; tenantId: string };

const CHANNEL_NAME = 'skalean.auth';

let channelInstance: BroadcastChannel | null = null;

export function getAuthBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null;
  if (!('BroadcastChannel' in window)) return null;
  if (!channelInstance) {
    channelInstance = new BroadcastChannel(CHANNEL_NAME);
  }
  return channelInstance;
}

export function postAuthEvent(event: AuthBroadcastEvent): void {
  const ch = getAuthBroadcastChannel();
  ch?.postMessage(event);
}

export function useAuthBroadcast(handler: (event: AuthBroadcastEvent) => void): void {
  useEffect(() => {
    const ch = getAuthBroadcastChannel();
    if (!ch) return;
    const listener = (msg: MessageEvent<AuthBroadcastEvent>) => handler(msg.data);
    ch.addEventListener('message', listener);
    return () => ch.removeEventListener('message', listener);
  }, [handler]);
}
```

### 6.5 `repo/apps/web-broker/app/api/auth/signin/route.ts` (~110 lignes)

```typescript
/**
 * POST /api/auth/signin -- web-broker proxy backend
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Flow :
 *   1. Parse body Zod SignInSchema
 *   2. Forward POST /auth/signin backend
 *   3. Si mfa_required -> retour { needs_mfa, mfa_challenge_token } (PAS de cookies)
 *   4. Sinon -> set cookies httpOnly + retour { ok: true, tenants, needs_tenant_selection }
 */
import { NextRequest, NextResponse } from 'next/server';
import { SignInSchema, SignInResponseSchema } from '@/lib/auth/schemas';
import { proxyToBackend } from '@/lib/auth/api-proxy';
import { setAuthCookies } from '@/lib/auth/cookies';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'auth.errors.invalidJson' } },
      { status: 400 },
    );
  }

  const parsed = SignInSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'auth.errors.validation',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const acceptLanguage = request.headers.get('accept-language') ?? 'fr';
  const result = await proxyToBackend({
    method: 'POST',
    path: '/api/v1/auth/signin',
    body: {
      email: parsed.data.email,
      password: parsed.data.password,
    },
    acceptLanguage,
  });

  if (result.error || !result.data) {
    return NextResponse.json(
      { error: result.error ?? { code: 'UNKNOWN', message: 'auth.errors.unknown' } },
      { status: result.status },
    );
  }

  const responseParsed = SignInResponseSchema.safeParse(result.data);
  if (!responseParsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_BACKEND_RESPONSE', message: 'auth.errors.unknown' } },
      { status: 502 },
    );
  }

  const data = responseParsed.data;

  if (data.outcome === 'mfa_required') {
    return NextResponse.json({
      needs_mfa: true,
      mfa_challenge_token: data.mfa_challenge_token,
      mfa_challenge_expires_at: data.mfa_challenge_expires_at,
    });
  }

  // outcome === 'authenticated'
  const needsTenantSelection = data.tenants.length > 1;
  const singleTenantId = data.tenants.length === 1 ? data.tenants[0].id : null;

  const response = NextResponse.json({
    ok: true,
    user: data.user,
    tenants: data.tenants,
    needs_tenant_selection: needsTenantSelection,
  });

  setAuthCookies({
    response,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    currentTenantId: singleTenantId,
    rememberMe: parsed.data.remember_me,
  });

  return response;
}
```

### 6.6 `repo/apps/web-broker/app/api/auth/verify-mfa/route.ts` (~90 lignes)

```typescript
/**
 * POST /api/auth/verify-mfa -- web-broker proxy backend
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { VerifyMfaSchema } from '@/lib/auth/schemas';
import { proxyToBackend } from '@/lib/auth/api-proxy';
import { setAuthCookies } from '@/lib/auth/cookies';

const BackendVerifyMfaResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    display_name: z.string(),
    locale: z.enum(['fr', 'ar-MA', 'ar']),
    mfa_enabled: z.boolean(),
  }),
  tenants: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      role: z.string(),
      logo_url: z.string().url().nullable(),
    }),
  ),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'auth.errors.invalidJson' } },
      { status: 400 },
    );
  }

  const parsed = VerifyMfaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'auth.errors.validation',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const acceptLanguage = request.headers.get('accept-language') ?? 'fr';
  const result = await proxyToBackend({
    method: 'POST',
    path: '/api/v1/auth/verify-mfa',
    body: parsed.data,
    acceptLanguage,
  });

  if (result.error || !result.data) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const responseParsed = BackendVerifyMfaResponseSchema.safeParse(result.data);
  if (!responseParsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_BACKEND_RESPONSE', message: 'auth.errors.unknown' } },
      { status: 502 },
    );
  }

  const data = responseParsed.data;
  const needsTenantSelection = data.tenants.length > 1;
  const singleTenantId = data.tenants.length === 1 ? data.tenants[0].id : null;

  const response = NextResponse.json({
    ok: true,
    user: data.user,
    tenants: data.tenants,
    needs_tenant_selection: needsTenantSelection,
  });

  setAuthCookies({
    response,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    currentTenantId: singleTenantId,
    rememberMe: parsed.data.trust_device,
  });

  return response;
}
```

### 6.7 `repo/apps/web-broker/app/api/auth/signup/route.ts` (~80 lignes)

```typescript
/**
 * POST /api/auth/signup -- web-broker proxy backend
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Pas de cookies poses : email verification required (Sprint 5).
 */
import { NextRequest, NextResponse } from 'next/server';
import { SignUpSchema } from '@/lib/auth/schemas';
import { proxyToBackend } from '@/lib/auth/api-proxy';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'auth.errors.invalidJson' } },
      { status: 400 },
    );
  }

  const parsed = SignUpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'auth.errors.validation',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  // Strip password_confirm avant d'envoyer au backend (Sprint 5 ne l'attend pas)
  const { password_confirm, ...payload } = parsed.data;

  const acceptLanguage = request.headers.get('accept-language') ?? 'fr';
  const result = await proxyToBackend({
    method: 'POST',
    path: '/api/v1/auth/signup',
    body: payload,
    acceptLanguage,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, ...(result.data as object) });
}
```

### 6.8 `repo/apps/web-broker/app/api/auth/refresh/route.ts` (~100 lignes)

```typescript
/**
 * POST /api/auth/refresh -- web-broker rotation tokens
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Lecture refresh_token cookie, exchange via backend Sprint 5,
 * pose les nouveaux tokens en cookies (rotation).
 * Si backend retourne 401 TOKEN_REUSE_DETECTED -> clear cookies (logout force).
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { proxyToBackend } from '@/lib/auth/api-proxy';
import {
  clearAuthCookies,
  getCurrentTenantId,
  getRefreshToken,
  setAuthCookies,
} from '@/lib/auth/cookies';

const BackendRefreshResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const refreshToken = getRefreshToken(request);
  if (!refreshToken) {
    const response = NextResponse.json(
      { error: { code: 'NO_REFRESH_TOKEN', message: 'auth.errors.refresh.missing' } },
      { status: 401 },
    );
    clearAuthCookies(response);
    return response;
  }

  const result = await proxyToBackend({
    method: 'POST',
    path: '/api/v1/auth/refresh',
    body: { refresh_token: refreshToken },
  });

  if (result.error) {
    // 401 TOKEN_REUSE_DETECTED ou 401 TOKEN_EXPIRED -> clear cookies
    if (result.status === 401) {
      const response = NextResponse.json({ error: result.error }, { status: 401 });
      clearAuthCookies(response);
      return response;
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const parsed = BackendRefreshResponseSchema.safeParse(result.data);
  if (!parsed.success) {
    const response = NextResponse.json(
      { error: { code: 'INVALID_BACKEND_RESPONSE', message: 'auth.errors.unknown' } },
      { status: 502 },
    );
    clearAuthCookies(response);
    return response;
  }

  const currentTenantId = getCurrentTenantId(request);

  const response = NextResponse.json({ ok: true });
  setAuthCookies({
    response,
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token,
    currentTenantId,
    // On preserve la duree refresh courante (re-use existing remember_me decision)
    rememberMe: true,
  });
  return response;
}
```

### 6.9 `repo/apps/web-broker/app/api/auth/logout/route.ts` (~70 lignes)

```typescript
/**
 * POST /api/auth/logout -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Invalide la session backend Sprint 5 + clear tous les cookies auth.
 * Best-effort backend call : meme si backend timeout, clear cookies cote browser.
 */
import { NextRequest, NextResponse } from 'next/server';
import { proxyToBackend } from '@/lib/auth/api-proxy';
import { clearAuthCookies, getAccessToken, getRefreshToken } from '@/lib/auth/cookies';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const accessToken = getAccessToken(request);
  const refreshToken = getRefreshToken(request);

  // Best-effort : invalider session backend
  if (accessToken || refreshToken) {
    try {
      await proxyToBackend({
        method: 'POST',
        path: '/api/v1/auth/logout',
        body: refreshToken ? { refresh_token: refreshToken } : undefined,
        accessToken,
        timeoutMs: 3000,
      });
    } catch {
      // Ignore : cleanup cookies dans tous les cas
    }
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
```

### 6.10 `repo/apps/web-broker/app/api/auth/forgot-password/route.ts` (~50 lignes)

```typescript
/**
 * POST /api/auth/forgot-password -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * IMPORTANT : retour toujours { ok: true } meme si email inconnu,
 * defense contre user enumeration (Sprint 5 backend respecte cette regle).
 */
import { NextRequest, NextResponse } from 'next/server';
import { ForgotPasswordSchema } from '@/lib/auth/schemas';
import { proxyToBackend } from '@/lib/auth/api-proxy';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const parsed = ForgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'auth.errors.validation',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  await proxyToBackend({
    method: 'POST',
    path: '/api/v1/auth/forgot-password',
    body: parsed.data,
    acceptLanguage: request.headers.get('accept-language') ?? 'fr',
  });

  return NextResponse.json({ ok: true });
}
```

### 6.11 `repo/apps/web-broker/app/api/auth/reset-password/route.ts` (~60 lignes)

```typescript
/**
 * POST /api/auth/reset-password -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { NextRequest, NextResponse } from 'next/server';
import { ResetPasswordSchema } from '@/lib/auth/schemas';
import { proxyToBackend } from '@/lib/auth/api-proxy';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'auth.errors.invalidJson' } },
      { status: 400 },
    );
  }

  const parsed = ResetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'auth.errors.validation',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const { new_password_confirm, ...payload } = parsed.data;

  const result = await proxyToBackend({
    method: 'POST',
    path: '/api/v1/auth/reset-password',
    body: payload,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
```

### 6.12 `repo/apps/web-broker/app/api/auth/verify-email/route.ts` (~50 lignes)

```typescript
/**
 * GET /api/auth/verify-email -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { NextRequest, NextResponse } from 'next/server';
import { VerifyEmailSchema } from '@/lib/auth/schemas';
import { proxyToBackend } from '@/lib/auth/api-proxy';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token');
  const parsed = VerifyEmailSchema.safeParse({ token });
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'INVALID_TOKEN', message: 'auth.errors.token.invalid' } },
      { status: 400 },
    );
  }

  const result = await proxyToBackend({
    method: 'POST',
    path: '/api/v1/auth/verify-email',
    body: { token: parsed.data.token },
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
```

### 6.13 `repo/apps/web-broker/app/api/auth/select-tenant/route.ts` (~60 lignes)

```typescript
/**
 * POST /api/auth/select-tenant -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { NextRequest, NextResponse } from 'next/server';
import { SelectTenantSchema } from '@/lib/auth/schemas';
import { proxyToBackend } from '@/lib/auth/api-proxy';
import { COOKIE_CURRENT_TENANT, getAccessToken } from '@/lib/auth/cookies';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'auth.errors.invalidJson' } },
      { status: 400 },
    );
  }

  const parsed = SelectTenantSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'auth.errors.validation' } },
      { status: 400 },
    );
  }

  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'auth.errors.unauthenticated' } },
      { status: 401 },
    );
  }

  // Verifier backend que le user a bien acces a ce tenant
  const result = await proxyToBackend({
    method: 'POST',
    path: '/api/v1/auth/select-tenant',
    body: parsed.data,
    accessToken,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const response = NextResponse.json({ ok: true });
  const isProd = process.env.NODE_ENV === 'production';
  response.cookies.set(COOKIE_CURRENT_TENANT, parsed.data.tenant_id, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
```

### 6.14 `repo/apps/web-broker/app/api/auth/me/route.ts` (~50 lignes)

```typescript
/**
 * GET /api/auth/me -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { NextRequest, NextResponse } from 'next/server';
import { proxyToBackend } from '@/lib/auth/api-proxy';
import { getAccessToken } from '@/lib/auth/cookies';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const accessToken = getAccessToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: { code: 'UNAUTHENTICATED', message: 'auth.errors.unauthenticated' } },
      { status: 401 },
    );
  }

  const result = await proxyToBackend({
    method: 'GET',
    path: '/api/v1/auth/me',
    accessToken,
    acceptLanguage: request.headers.get('accept-language') ?? 'fr',
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
```

### 6.15 `repo/apps/web-broker/app/[locale]/(auth)/layout.tsx` (~80 lignes)

```typescript
/**
 * Auth layout shell -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LocaleSwitcher } from '@insurtech/shared-ui/components/locale-switcher';

interface AuthLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({ children, params }: AuthLayoutProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.layout' });

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-background to-muted/30">
      <header className="flex items-center justify-between px-6 py-4 sm:px-12">
        <Link
          href={`/${locale}`}
          className="flex items-center gap-3 text-lg font-extrabold tracking-tight text-primary"
          aria-label={t('home')}
        >
          <Image
            src="/icons/logo-skalean-orange.svg"
            alt="Skalean InsurTech"
            width={36}
            height={36}
            priority
          />
          <span className="hidden sm:inline">Skalean Broker</span>
        </Link>
        <LocaleSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-8 sm:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-muted-foreground">
        <p>
          {t('footer.legal')} ACAPS -- Skalean InsurTech {new Date().getFullYear()}
        </p>
        <p className="mt-1">
          <Link
            href={`/${locale}/legal/privacy`}
            className="underline-offset-2 hover:underline"
          >
            {t('footer.privacy')}
          </Link>
          {' / '}
          <Link
            href={`/${locale}/legal/terms`}
            className="underline-offset-2 hover:underline"
          >
            {t('footer.terms')}
          </Link>
        </p>
      </footer>
    </div>
  );
}
```

### 6.16 `repo/apps/web-broker/app/[locale]/(auth)/login/page.tsx` (~180 lignes)

```typescript
'use client';

/**
 * Login page -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Flow :
 *   - submit POST /api/auth/signin
 *   - si needs_mfa -> sessionStorage.setItem + redirect /verify-mfa
 *   - si needs_tenant_selection -> redirect /select-tenant
 *   - sinon -> redirect /dashboard
 */
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import { SignInSchema, type SignInInput } from '@/lib/auth/schemas';
import { SubmitButton } from '@/components/auth/submit-button';
import { postAuthEvent } from '@/lib/auth/broadcast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Input } from '@insurtech/shared-ui/components/input';
import { Label } from '@insurtech/shared-ui/components/label';
import { Checkbox } from '@insurtech/shared-ui/components/checkbox';

const MFA_CHALLENGE_KEY = 'skalean.mfa_challenge';

export default function LoginPage() {
  const t = useTranslations('auth.login');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  const redirectTo = searchParams.get('redirect') ?? `/${locale}/dashboard`;

  const form = useForm<SignInInput>({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: '', password: '', remember_me: false },
    mode: 'onBlur',
  });

  async function onSubmit(values: SignInInput) {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();

      if (!response.ok) {
        const code = data?.error?.code as string | undefined;
        if (code === 'INVALID_CREDENTIALS') {
          toast.error(tErrors('invalidCredentials'));
        } else if (code === 'ACCOUNT_LOCKED') {
          toast.error(tErrors('accountLocked'));
        } else if (code === 'EMAIL_NOT_VERIFIED') {
          toast.error(tErrors('emailNotVerified'));
        } else if (code === 'ACCOUNT_DELETED') {
          toast.error(tErrors('accountDeleted'));
        } else {
          toast.error(tErrors('generic'));
        }
        return;
      }

      if (data.needs_mfa) {
        sessionStorage.setItem(
          MFA_CHALLENGE_KEY,
          JSON.stringify({
            token: data.mfa_challenge_token,
            expiresAt: data.mfa_challenge_expires_at,
          }),
        );
        startTransition(() => router.push(`/${locale}/verify-mfa`));
        return;
      }

      toast.success(t('success'));
      postAuthEvent({ type: 'login', userId: data.user?.id ?? '' });

      if (data.needs_tenant_selection) {
        startTransition(() => router.push(`/${locale}/select-tenant`));
      } else {
        startTransition(() => router.push(redirectTo));
      }
    } catch (err) {
      toast.error(tErrors('network'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              {...form.register('email')}
              aria-invalid={!!form.formState.errors.email}
              aria-describedby={form.formState.errors.email ? 'email-error' : undefined}
            />
            {form.formState.errors.email && (
              <p id="email-error" className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.email.message ?? 'generic')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('fields.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              {...form.register('password')}
              aria-invalid={!!form.formState.errors.password}
            />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.password.message ?? 'generic')}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox {...form.register('remember_me')} />
              {t('fields.rememberMe')}
            </label>
            <Link
              href={`/${locale}/forgot-password`}
              className="text-sm text-primary hover:underline"
            >
              {t('links.forgotPassword')}
            </Link>
          </div>

          <SubmitButton loading={loading || isPending} className="w-full">
            {t('submit')}
          </SubmitButton>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">{t('noAccount')}</span>{' '}
            <Link href={`/${locale}/signup`} className="text-primary hover:underline">
              {t('links.signup')}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

### 6.17 `repo/apps/web-broker/components/auth/mfa-code-input.tsx` (~180 lignes)

```typescript
'use client';

/**
 * MFA 6-digit code input with auto-advance + paste + backspace navigation
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Inspire pattern Google / Microsoft / Stripe.
 *   - 6 inputs maxLength=1
 *   - auto-focus next sur input
 *   - backspace : delete + focus previous
 *   - paste 6 chars : distribute
 *   - auto-submit callback a 6 chars
 *   - disable apres submit pending (ref flag, evite double-submit)
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';
import { cn } from '@insurtech/shared-ui/lib/cn';

const CODE_LENGTH = 6;

export interface MfaCodeInputHandle {
  focus: () => void;
  clear: () => void;
}

interface MfaCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete: (code: string) => void | Promise<void>;
  disabled?: boolean;
  ariaLabel?: string;
}

export const MfaCodeInput = forwardRef<MfaCodeInputHandle, MfaCodeInputProps>(
  function MfaCodeInput({ value, onChange, onComplete, disabled, ariaLabel }, ref) {
    const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const submittingRef = useRef(false);
    const [digits, setDigits] = useState<string[]>(() => {
      const padded = (value ?? '').slice(0, CODE_LENGTH).padEnd(CODE_LENGTH, '');
      return padded.split('');
    });

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRefs.current[0]?.focus(),
        clear: () => {
          setDigits(new Array(CODE_LENGTH).fill(''));
          onChange('');
          submittingRef.current = false;
          inputRefs.current[0]?.focus();
        },
      }),
      [onChange],
    );

    const tryComplete = useCallback(
      async (next: string[]) => {
        const combined = next.join('');
        if (combined.length === CODE_LENGTH && combined.match(/^\d{6}$/) && !submittingRef.current) {
          submittingRef.current = true;
          try {
            await onComplete(combined);
          } finally {
            // ref reset par parent via clear() en cas d'erreur
          }
        }
      },
      [onComplete],
    );

    const handleChange = (index: number) => (e: ChangeEvent<HTMLInputElement>) => {
      const char = e.target.value.replace(/\D/g, '').slice(-1);
      const next = [...digits];
      next[index] = char;
      setDigits(next);
      onChange(next.join(''));

      if (char && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
      void tryComplete(next);
    };

    const handleKeyDown = (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (!digits[index] && index > 0) {
          inputRefs.current[index - 1]?.focus();
          e.preventDefault();
        }
      } else if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
        e.preventDefault();
      } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
        e.preventDefault();
      }
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
      if (!pasted) return;
      const next = pasted.padEnd(CODE_LENGTH, '').split('');
      setDigits(next);
      onChange(next.join(''));
      const lastIndex = Math.min(pasted.length, CODE_LENGTH) - 1;
      inputRefs.current[lastIndex]?.focus();
      void tryComplete(next);
    };

    useEffect(() => {
      inputRefs.current[0]?.focus();
    }, []);

    return (
      <div
        className="flex justify-center gap-2"
        role="group"
        aria-label={ariaLabel ?? 'Code MFA 6 chiffres'}
      >
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(el) => {
              inputRefs.current[idx] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={digit}
            onChange={handleChange(idx)}
            onKeyDown={handleKeyDown(idx)}
            onPaste={handlePaste}
            disabled={disabled}
            aria-label={`Chiffre ${idx + 1}`}
            className={cn(
              'h-14 w-12 rounded-lg border border-input bg-background text-center text-2xl font-semibold tabular-nums shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        ))}
      </div>
    );
  },
);
```

### 6.18 `repo/apps/web-broker/app/[locale]/(auth)/verify-mfa/page.tsx` (~150 lignes)

```typescript
'use client';

/**
 * Verify MFA page -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { decodeJwt } from 'jose';
import { MfaCodeInput, type MfaCodeInputHandle } from '@/components/auth/mfa-code-input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Checkbox } from '@insurtech/shared-ui/components/checkbox';
import { postAuthEvent } from '@/lib/auth/broadcast';

const MFA_CHALLENGE_KEY = 'skalean.mfa_challenge';

interface ChallengeMeta {
  token: string;
  expiresAt: string;
}

export default function VerifyMfaPage() {
  const t = useTranslations('auth.verifyMfa');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const locale = useLocale();
  const mfaInputRef = useRef<MfaCodeInputHandle>(null);
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(false);
  const [challenge, setChallenge] = useState<ChallengeMeta | null>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(MFA_CHALLENGE_KEY);
    if (!raw) {
      router.replace(`/${locale}/login`);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as ChallengeMeta;
      setChallenge(parsed);
      const exp = new Date(parsed.expiresAt).getTime();
      const update = () => {
        const left = Math.max(0, Math.floor((exp - Date.now()) / 1000));
        setRemaining(left);
        if (left === 0) {
          sessionStorage.removeItem(MFA_CHALLENGE_KEY);
          toast.error(tErrors('mfaChallenge.expired'));
          router.replace(`/${locale}/login`);
        }
      };
      update();
      const interval = setInterval(update, 1000);
      return () => clearInterval(interval);
    } catch {
      sessionStorage.removeItem(MFA_CHALLENGE_KEY);
      router.replace(`/${locale}/login`);
    }
  }, [router, locale, tErrors]);

  async function handleSubmit(codeValue: string) {
    if (!challenge) return;
    setLoading(true);
    try {
      const response = await fetch('/api/auth/verify-mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mfa_challenge_token: challenge.token,
          mfa_code: codeValue,
          trust_device: trustDevice,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        const code = data?.error?.code as string | undefined;
        if (code === 'MFA_INVALID_CODE') {
          toast.error(tErrors('mfa.invalidCode'));
        } else if (code === 'MFA_CHALLENGE_EXPIRED') {
          toast.error(tErrors('mfaChallenge.expired'));
          sessionStorage.removeItem(MFA_CHALLENGE_KEY);
          router.replace(`/${locale}/login`);
          return;
        } else {
          toast.error(tErrors('generic'));
        }
        mfaInputRef.current?.clear();
        return;
      }

      sessionStorage.removeItem(MFA_CHALLENGE_KEY);
      toast.success(t('success'));
      postAuthEvent({ type: 'login', userId: data.user?.id ?? '' });

      if (data.needs_tenant_selection) {
        router.push(`/${locale}/select-tenant`);
      } else {
        router.push(`/${locale}/dashboard`);
      }
    } catch (err) {
      toast.error(tErrors('network'));
      mfaInputRef.current?.clear();
    } finally {
      setLoading(false);
    }
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <MfaCodeInput
          ref={mfaInputRef}
          value={code}
          onChange={setCode}
          onComplete={handleSubmit}
          disabled={loading || remaining === 0}
          ariaLabel={t('codeLabel')}
        />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t('expiresIn', { time: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` })}
        </p>
        <label className="mt-6 flex cursor-pointer items-center justify-center gap-2 text-sm">
          <Checkbox
            checked={trustDevice}
            onCheckedChange={(v) => setTrustDevice(v === true)}
          />
          {t('trustDevice')}
        </label>
        <div className="mt-6 text-center text-sm">
          <Link href={`/${locale}/recovery-code`} className="text-primary hover:underline">
            {t('links.recoveryCode')}
          </Link>
          {' / '}
          <Link href={`/${locale}/login`} className="text-muted-foreground hover:underline">
            {t('links.backToLogin')}
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.19 `repo/apps/web-broker/components/auth/password-strength-indicator.tsx` (~150 lignes)

```typescript
'use client';

/**
 * Password strength indicator using @zxcvbn-ts/core
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * - Dynamic import @zxcvbn-ts/core + dictionnaire fr (lazy load 70 ko)
 * - useDeferredValue (React 19) pour debounce calculation
 * - Score 0-4 visualise via progress bar coloree
 * - Suggestions affichees sous forme de liste
 */
import { useDeferredValue, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@insurtech/shared-ui/lib/cn';

type ZxcvbnFn = (password: string) => {
  score: 0 | 1 | 2 | 3 | 4;
  feedback: { warning: string | null; suggestions: string[] };
};

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
}

const SCORE_COLORS: Record<number, string> = {
  0: 'bg-destructive',
  1: 'bg-orange-500',
  2: 'bg-yellow-500',
  3: 'bg-green-500',
  4: 'bg-emerald-500',
};

const SCORE_WIDTHS: Record<number, string> = {
  0: 'w-1/5',
  1: 'w-2/5',
  2: 'w-3/5',
  3: 'w-4/5',
  4: 'w-full',
};

export function PasswordStrengthIndicator({ password, className }: PasswordStrengthIndicatorProps) {
  const t = useTranslations('auth.password.strength');
  const deferredPassword = useDeferredValue(password);
  const [zxcvbn, setZxcvbn] = useState<ZxcvbnFn | null>(null);
  const [result, setResult] = useState<ReturnType<ZxcvbnFn> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ zxcvbn: zxcvbnFn, zxcvbnOptions }, common, frPack] = await Promise.all([
        import('@zxcvbn-ts/core'),
        import('@zxcvbn-ts/language-common'),
        import('@zxcvbn-ts/language-fr'),
      ]);
      if (cancelled) return;
      zxcvbnOptions.setOptions({
        translations: frPack.translations,
        dictionary: { ...common.dictionary, ...frPack.dictionary },
        graphs: common.adjacencyGraphs,
      });
      setZxcvbn(() => zxcvbnFn);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!zxcvbn || !deferredPassword) {
      setResult(null);
      return;
    }
    const computed = zxcvbn(deferredPassword);
    setResult(computed);
  }, [zxcvbn, deferredPassword]);

  if (!password) return null;

  const score = result?.score ?? 0;

  return (
    <div className={cn('space-y-2', className)} aria-live="polite">
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full transition-all duration-300', SCORE_COLORS[score], SCORE_WIDTHS[score])}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={4}
          aria-valuenow={score}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {t('label')}: <span className="font-medium">{t(`scores.${score}`)}</span>
      </p>
      {result?.feedback.warning && (
        <p className="text-xs text-destructive">{result.feedback.warning}</p>
      )}
      {result?.feedback.suggestions && result.feedback.suggestions.length > 0 && (
        <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
          {result.feedback.suggestions.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 6.20 `repo/apps/web-broker/app/[locale]/(auth)/signup/page.tsx` (~220 lignes)

```typescript
'use client';

/**
 * Signup page -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useTranslations, useLocale } from 'next-intl';
import { SignUpSchema, type SignUpInput } from '@/lib/auth/schemas';
import { SubmitButton } from '@/components/auth/submit-button';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Input } from '@insurtech/shared-ui/components/input';
import { Label } from '@insurtech/shared-ui/components/label';
import { Checkbox } from '@insurtech/shared-ui/components/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@insurtech/shared-ui/components/select';

export default function SignupPage() {
  const t = useTranslations('auth.signup');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  const form = useForm<SignUpInput>({
    resolver: zodResolver(SignUpSchema),
    defaultValues: {
      email: '',
      password: '',
      password_confirm: '',
      display_name: '',
      locale: (locale as 'fr' | 'ar-MA' | 'ar') ?? 'fr',
      phone: undefined,
      accept_terms: false as unknown as true,
      consent_cndp: false as unknown as true,
    },
    mode: 'onBlur',
  });

  const passwordValue = form.watch('password');

  async function onSubmit(values: SignUpInput) {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();

      if (!response.ok) {
        const code = data?.error?.code as string | undefined;
        if (code === 'EMAIL_ALREADY_EXISTS') {
          toast.error(tErrors('emailAlreadyExists'));
        } else if (code === 'WEAK_PASSWORD') {
          toast.error(tErrors('password.weak'));
        } else if (code === 'VALIDATION_ERROR') {
          toast.error(tErrors('validation'));
        } else {
          toast.error(tErrors('generic'));
        }
        return;
      }

      toast.success(t('success'));
      router.push(`/${locale}/email-sent?email=${encodeURIComponent(values.email)}`);
    } catch (err) {
      toast.error(tErrors('network'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="display_name">{t('fields.displayName')}</Label>
            <Input
              id="display_name"
              autoComplete="name"
              required
              {...form.register('display_name')}
            />
            {form.formState.errors.display_name && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.display_name.message ?? 'generic')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.email.message ?? 'generic')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">{t('fields.phone')}</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder="+212600000000"
              {...form.register('phone')}
            />
            {form.formState.errors.phone && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.phone.message ?? 'generic')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('fields.password')}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              {...form.register('password')}
            />
            <PasswordStrengthIndicator password={passwordValue} />
            {form.formState.errors.password && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.password.message ?? 'generic')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password_confirm">{t('fields.passwordConfirm')}</Label>
            <Input
              id="password_confirm"
              type="password"
              autoComplete="new-password"
              required
              {...form.register('password_confirm')}
            />
            {form.formState.errors.password_confirm && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.password_confirm.message ?? 'generic')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="locale">{t('fields.locale')}</Label>
            <Select
              defaultValue={locale}
              onValueChange={(v) => form.setValue('locale', v as 'fr' | 'ar-MA' | 'ar')}
            >
              <SelectTrigger id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">Francais</SelectItem>
                <SelectItem value="ar-MA">العربية (Darija)</SelectItem>
                <SelectItem value="ar">العربية الفصحى</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 rounded-md border border-input bg-muted/30 p-3">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox {...form.register('accept_terms')} />
              <span>{t('fields.acceptTerms')}</span>
            </label>
            {form.formState.errors.accept_terms && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.accept_terms.message ?? 'generic')}
              </p>
            )}
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox {...form.register('consent_cndp')} />
              <span>{t('fields.consentCndp')}</span>
            </label>
            {form.formState.errors.consent_cndp && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.consent_cndp.message ?? 'generic')}
              </p>
            )}
          </div>

          <SubmitButton loading={loading} className="w-full">
            {t('submit')}
          </SubmitButton>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">{t('haveAccount')}</span>{' '}
            <Link href={`/${locale}/login`} className="text-primary hover:underline">
              {t('links.signin')}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

### 6.21 `repo/apps/web-broker/app/[locale]/(auth)/forgot-password/page.tsx` (~100 lignes)

```typescript
'use client';

/**
 * Forgot password page -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ForgotPasswordSchema, type ForgotPasswordInput } from '@/lib/auth/schemas';
import { SubmitButton } from '@/components/auth/submit-button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Input } from '@insurtech/shared-ui/components/input';
import { Label } from '@insurtech/shared-ui/components/label';

export default function ForgotPasswordPage() {
  const t = useTranslations('auth.forgotPassword');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setLoading(true);
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      // Toujours success cote UI : pas de user enumeration
      toast.success(t('success'));
      router.push(`/${locale}/email-sent?email=${encodeURIComponent(values.email)}&type=reset`);
    } catch (err) {
      toast.error(tErrors('network'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">{t('fields.email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              {...form.register('email')}
            />
            {form.formState.errors.email && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.email.message ?? 'generic')}
              </p>
            )}
          </div>

          <SubmitButton loading={loading} className="w-full">
            {t('submit')}
          </SubmitButton>

          <div className="text-center text-sm">
            <Link href={`/${locale}/login`} className="text-primary hover:underline">
              {t('links.backToLogin')}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

### 6.22 `repo/apps/web-broker/app/[locale]/(auth)/reset-password/page.tsx` (~150 lignes)

```typescript
'use client';

/**
 * Reset password page -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Decode JWT token cote client (sans verify, juste lecture exp) pour afficher countdown.
 * Defense en profondeur : backend Sprint 5 valide token signature + revocation.
 */
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { decodeJwt } from 'jose';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { ResetPasswordSchema, type ResetPasswordInput } from '@/lib/auth/schemas';
import { SubmitButton } from '@/components/auth/submit-button';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Input } from '@insurtech/shared-ui/components/input';
import { Label } from '@insurtech/shared-ui/components/label';

export default function ResetPasswordPage() {
  const t = useTranslations('auth.resetPassword');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { token, new_password: '', new_password_confirm: '' },
    mode: 'onBlur',
  });

  const passwordValue = form.watch('new_password');

  useEffect(() => {
    if (!token) {
      toast.error(tErrors('token.missing'));
      router.replace(`/${locale}/forgot-password`);
      return;
    }
    try {
      const decoded = decodeJwt(token);
      if (decoded.exp) {
        setExpiresAt(decoded.exp * 1000);
      }
    } catch {
      toast.error(tErrors('token.invalid'));
      router.replace(`/${locale}/forgot-password`);
    }
  }, [token, router, locale, tErrors]);

  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const left = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        toast.error(tErrors('token.expired'));
        router.replace(`/${locale}/forgot-password`);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, router, locale, tErrors]);

  async function onSubmit(values: ResetPasswordInput) {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();
      if (!response.ok) {
        const code = data?.error?.code as string | undefined;
        if (code === 'TOKEN_EXPIRED') toast.error(tErrors('token.expired'));
        else if (code === 'TOKEN_INVALID') toast.error(tErrors('token.invalid'));
        else if (code === 'WEAK_PASSWORD') toast.error(tErrors('password.weak'));
        else toast.error(tErrors('generic'));
        return;
      }
      toast.success(t('success'));
      router.push(`/${locale}/login`);
    } catch {
      toast.error(tErrors('network'));
    } finally {
      setLoading(false);
    }
  }

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <p className="text-sm text-muted-foreground">
            {t('tokenExpiresIn', { time: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` })}
          </p>
          <div className="space-y-2">
            <Label htmlFor="new_password">{t('fields.newPassword')}</Label>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              required
              {...form.register('new_password')}
            />
            <PasswordStrengthIndicator password={passwordValue} />
            {form.formState.errors.new_password && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.new_password.message ?? 'generic')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="new_password_confirm">{t('fields.passwordConfirm')}</Label>
            <Input
              id="new_password_confirm"
              type="password"
              autoComplete="new-password"
              required
              {...form.register('new_password_confirm')}
            />
            {form.formState.errors.new_password_confirm && (
              <p className="text-sm text-destructive" role="alert">
                {tErrors(form.formState.errors.new_password_confirm.message ?? 'generic')}
              </p>
            )}
          </div>

          <SubmitButton loading={loading} className="w-full">
            {t('submit')}
          </SubmitButton>

          <div className="text-center text-sm">
            <Link href={`/${locale}/login`} className="text-muted-foreground hover:underline">
              {t('links.backToLogin')}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

### 6.23 `repo/apps/web-broker/app/[locale]/(auth)/verify-email/page.tsx` (~80 lignes)

```typescript
'use client';

/**
 * Verify email page -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Auto-GET /api/auth/verify-email?token=... au mount.
 * Redirect /login + toast success (ou error si token expire).
 */
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Loader2 } from 'lucide-react';

type State = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const t = useTranslations('auth.verifyEmail');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<State>('verifying');

  useEffect(() => {
    if (!token) {
      setState('error');
      return;
    }
    (async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        if (response.ok) {
          setState('success');
          toast.success(t('success'));
          setTimeout(() => router.push(`/${locale}/login?verified=1`), 1500);
        } else {
          setState('error');
          const code = data?.error?.code as string | undefined;
          if (code === 'TOKEN_EXPIRED') toast.error(tErrors('token.expired'));
          else if (code === 'TOKEN_ALREADY_USED') toast.info(t('alreadyVerified'));
          else toast.error(tErrors('generic'));
        }
      } catch {
        setState('error');
        toast.error(tErrors('network'));
      }
    })();
  }, [token, router, locale, t, tErrors]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="text-center">
        {state === 'verifying' && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label={t('verifying')} />
            <p>{t('verifying')}</p>
          </div>
        )}
        {state === 'success' && <p>{t('success')}</p>}
        {state === 'error' && (
          <div className="space-y-3">
            <p>{t('error')}</p>
            <Link href={`/${locale}/login`} className="text-primary hover:underline">
              {t('links.backToLogin')}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 6.24 `repo/apps/web-broker/app/[locale]/(auth)/select-tenant/page.tsx` (~120 lignes)

```typescript
/**
 * Select tenant page -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 *
 * Server Component fetch /api/auth/me pour lister tenants.
 * Client component pour click handler (TenantSelectorCard).
 */
import { redirect } from 'next/navigation';
import { cookies, headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { TenantSelectorCard } from '@/components/auth/tenant-selector-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { TenantSummarySchema } from '@/lib/auth/schemas';
import { z } from 'zod';

const MeResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    display_name: z.string(),
  }),
  tenants: z.array(TenantSummarySchema),
});

async function fetchMe(): Promise<z.infer<typeof MeResponseSchema> | null> {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const host = headerStore.get('host');
  const proto = headerStore.get('x-forwarded-proto') ?? 'http';
  const url = `${proto}://${host}/api/auth/me`;
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {
      Cookie: cookieStore.toString(),
    },
  });
  if (!response.ok) return null;
  const data = await response.json();
  const parsed = MeResponseSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

interface SelectTenantPageProps {
  params: Promise<{ locale: string }>;
}

export default async function SelectTenantPage({ params }: SelectTenantPageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.selectTenant' });

  const me = await fetchMe();
  if (!me) {
    redirect(`/${locale}/login`);
  }

  if (me.tenants.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('noTenant.title')}</CardTitle>
          <CardDescription>{t('noTenant.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('noTenant.contact')}</p>
        </CardContent>
      </Card>
    );
  }

  if (me.tenants.length === 1) {
    // Defense: middleware aurait du gerer, mais redirect au cas
    redirect(`/${locale}/dashboard`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('subtitle', { name: me.user.display_name })}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {me.tenants.map((tenant) => (
          <TenantSelectorCard key={tenant.id} tenant={tenant} locale={locale} />
        ))}
      </CardContent>
    </Card>
  );
}
```

### 6.25 `repo/apps/web-broker/components/auth/tenant-selector-card.tsx` (~100 lignes)

```typescript
'use client';

/**
 * Tenant selector card -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { TenantSummary } from '@/lib/auth/schemas';
import { postAuthEvent } from '@/lib/auth/broadcast';
import { cn } from '@insurtech/shared-ui/lib/cn';

interface TenantSelectorCardProps {
  tenant: TenantSummary;
  locale: string;
}

export function TenantSelectorCard({ tenant, locale }: TenantSelectorCardProps) {
  const t = useTranslations('auth.selectTenant');
  const tErrors = useTranslations('auth.errors');
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSelect() {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/select-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenant.id }),
      });
      if (!response.ok) {
        toast.error(tErrors('tenantSelectFailed'));
        return;
      }
      postAuthEvent({ type: 'tenant-switch', tenantId: tenant.id });
      toast.success(t('switched', { name: tenant.name }));
      router.push(`/${locale}/dashboard`);
    } catch {
      toast.error(tErrors('network'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSelect}
      disabled={loading}
      aria-label={t('selectTenant', { name: tenant.name })}
      className={cn(
        'flex w-full items-center gap-4 rounded-lg border border-input bg-card p-4 text-left shadow-sm transition-all hover:border-primary hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      {tenant.logo_url ? (
        <Image
          src={tenant.logo_url}
          alt={tenant.name}
          width={48}
          height={48}
          className="h-12 w-12 rounded-md object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-lg font-semibold text-primary">
          {tenant.name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1">
        <p className="font-medium">{tenant.name}</p>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{tenant.role}</p>
      </div>
      {loading && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
    </button>
  );
}
```

### 6.26 `repo/apps/web-broker/app/[locale]/(auth)/email-sent/page.tsx` (~50 lignes)

```typescript
/**
 * Email sent confirmation -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@insurtech/shared-ui/components/card';
import { Mail } from 'lucide-react';

interface EmailSentPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string; type?: string }>;
}

export default async function EmailSentPage({ params, searchParams }: EmailSentPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const email = sp.email ?? '';
  const type = sp.type === 'reset' ? 'reset' : 'verification';
  const t = await getTranslations({ locale, namespace: `auth.emailSent.${type}` });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-center pb-2">
          <Mail className="h-12 w-12 text-primary" aria-hidden="true" />
        </div>
        <CardTitle className="text-center text-2xl">{t('title')}</CardTitle>
        <CardDescription className="text-center">
          {t('description', { email: email || t('emailFallback') })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-center text-sm text-muted-foreground">
        <p>{t('checkSpam')}</p>
        <p>
          <Link href={`/${locale}/login`} className="text-primary hover:underline">
            {t('links.backToLogin')}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
```

### 6.27 `repo/apps/web-broker/app/[locale]/(auth)/logout/page.tsx` (~50 lignes)

```typescript
'use client';

/**
 * Logout page -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { postAuthEvent } from '@/lib/auth/broadcast';

export default function LogoutPage() {
  const t = useTranslations('auth.logout');
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    (async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // Ignore : cookies clear best-effort
      }
      postAuthEvent({ type: 'logout' });
      router.replace(`/${locale}/login?message=logged_out`);
    })();
  }, [router, locale]);

  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
      <p>{t('inProgress')}</p>
    </div>
  );
}
```

### 6.28 `repo/apps/web-broker/components/auth/submit-button.tsx` (~40 lignes)

```typescript
'use client';

/**
 * Submit button with loading state -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@insurtech/shared-ui/components/button';

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  children: ReactNode;
}

export function SubmitButton({ loading, children, disabled, ...rest }: SubmitButtonProps) {
  return (
    <Button type="submit" disabled={loading || disabled} {...rest}>
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span aria-live="polite">{children}</span>
        </span>
      ) : (
        children
      )}
    </Button>
  );
}
```

### 6.29 `repo/apps/web-broker/messages/fr.json` (extrait `auth.*` ~50 cles)

```json
{
  "auth": {
    "layout": {
      "home": "Retour accueil",
      "footer": {
        "legal": "Plateforme agreee",
        "privacy": "Confidentialite",
        "terms": "Conditions"
      }
    },
    "login": {
      "title": "Se connecter",
      "subtitle": "Accedez a votre espace courtier Skalean",
      "fields": {
        "email": "Adresse email",
        "password": "Mot de passe",
        "rememberMe": "Se souvenir de moi"
      },
      "submit": "Se connecter",
      "noAccount": "Pas encore de compte ?",
      "success": "Connexion reussie",
      "links": {
        "forgotPassword": "Mot de passe oublie ?",
        "signup": "Creer un compte"
      }
    },
    "verifyMfa": {
      "title": "Verification en deux etapes",
      "subtitle": "Entrez le code a 6 chiffres de votre application d'authentification.",
      "codeLabel": "Code MFA 6 chiffres",
      "expiresIn": "Expire dans {time}",
      "trustDevice": "Faire confiance a cet appareil pendant 30 jours",
      "success": "Verification reussie",
      "links": {
        "recoveryCode": "Utiliser un code de recuperation",
        "backToLogin": "Retour connexion"
      }
    },
    "signup": {
      "title": "Creer un compte courtier",
      "subtitle": "Inscrivez-vous sur la plateforme Skalean Broker",
      "fields": {
        "displayName": "Nom complet",
        "email": "Email professionnel",
        "phone": "Telephone (+212...)",
        "password": "Mot de passe",
        "passwordConfirm": "Confirmer mot de passe",
        "locale": "Langue preferee",
        "acceptTerms": "J'accepte les conditions generales d'utilisation",
        "consentCndp": "Je consens au traitement de mes donnees conformement a la loi 09-08 CNDP"
      },
      "submit": "Creer mon compte",
      "haveAccount": "Vous avez deja un compte ?",
      "success": "Compte cree. Verifiez votre email.",
      "links": {
        "signin": "Se connecter"
      }
    },
    "forgotPassword": {
      "title": "Mot de passe oublie",
      "subtitle": "Entrez votre email pour recevoir un lien de reinitialisation.",
      "fields": { "email": "Adresse email" },
      "submit": "Envoyer le lien",
      "success": "Email envoye si compte existant",
      "links": { "backToLogin": "Retour connexion" }
    },
    "resetPassword": {
      "title": "Reinitialiser mot de passe",
      "subtitle": "Choisissez un nouveau mot de passe.",
      "fields": {
        "newPassword": "Nouveau mot de passe",
        "passwordConfirm": "Confirmer mot de passe"
      },
      "tokenExpiresIn": "Le lien expire dans {time}",
      "submit": "Reinitialiser",
      "success": "Mot de passe reinitialise",
      "links": { "backToLogin": "Retour connexion" }
    },
    "verifyEmail": {
      "title": "Verification email",
      "verifying": "Verification en cours...",
      "success": "Email verifie",
      "alreadyVerified": "Email deja verifie",
      "error": "Lien invalide ou expire",
      "links": { "backToLogin": "Retour connexion" }
    },
    "emailSent": {
      "verification": {
        "title": "Email envoye",
        "description": "Un email de verification a ete envoye a {email}.",
        "emailFallback": "votre adresse",
        "checkSpam": "Pensez a verifier votre dossier spam.",
        "links": { "backToLogin": "Retour connexion" }
      },
      "reset": {
        "title": "Lien envoye",
        "description": "Si un compte existe pour {email}, vous recevrez un lien.",
        "emailFallback": "cette adresse",
        "checkSpam": "Verifiez aussi vos spams.",
        "links": { "backToLogin": "Retour connexion" }
      }
    },
    "selectTenant": {
      "title": "Selectionnez un cabinet",
      "subtitle": "Bonjour {name}, choisissez le cabinet a utiliser.",
      "selectTenant": "Selectionner {name}",
      "switched": "Cabinet {name} actif",
      "noTenant": {
        "title": "Aucun cabinet associe",
        "description": "Votre compte n'est associe a aucun cabinet.",
        "contact": "Contactez l'administrateur."
      }
    },
    "logout": {
      "inProgress": "Deconnexion en cours..."
    },
    "password": {
      "strength": {
        "label": "Force",
        "scores": {
          "0": "Tres faible",
          "1": "Faible",
          "2": "Acceptable",
          "3": "Fort",
          "4": "Tres fort"
        }
      }
    },
    "errors": {
      "generic": "Une erreur est survenue",
      "network": "Probleme de connexion reseau",
      "timeout": "Delai depasse",
      "validation": "Donnees invalides",
      "invalidJson": "Format de donnees invalide",
      "unauthenticated": "Authentification requise",
      "invalidCredentials": "Identifiants incorrects",
      "accountLocked": "Compte verrouille -- reessayez plus tard",
      "accountDeleted": "Compte supprime",
      "emailNotVerified": "Verifiez votre email avant connexion",
      "emailAlreadyExists": "Un compte existe deja pour cet email",
      "tenantSelectFailed": "Selection cabinet impossible",
      "unknown": "Erreur inconnue",
      "email": {
        "required": "Email obligatoire",
        "tooLong": "Email trop long",
        "invalid": "Format email invalide"
      },
      "password": {
        "required": "Mot de passe obligatoire",
        "tooShort": "Au moins 12 caracteres",
        "tooLong": "Au plus 128 caracteres",
        "missingLowercase": "Au moins 1 minuscule",
        "missingUppercase": "Au moins 1 majuscule",
        "missingDigit": "Au moins 1 chiffre",
        "missingSpecial": "Au moins 1 caractere special",
        "weak": "Mot de passe trop faible"
      },
      "passwordConfirm": {
        "required": "Confirmation obligatoire",
        "mismatch": "Les mots de passe ne correspondent pas"
      },
      "cin": { "invalid": "Format CIN MA invalide (ex: BE123456)" },
      "phone": { "invalid": "Format E.164 MA invalide (+212...)" },
      "displayName": {
        "tooShort": "Au moins 2 caracteres",
        "tooLong": "Au plus 80 caracteres"
      },
      "locale": { "invalid": "Langue non supportee" },
      "mfa": {
        "invalidLength": "Code 6 chiffres requis",
        "invalidFormat": "Chiffres uniquement",
        "invalidCode": "Code incorrect"
      },
      "mfaChallenge": {
        "invalid": "Session MFA invalide",
        "expired": "Session MFA expiree, reconnectez-vous"
      },
      "tenant": { "invalidId": "Identifiant cabinet invalide" },
      "token": {
        "missing": "Lien invalide",
        "invalid": "Lien invalide",
        "expired": "Lien expire"
      },
      "terms": { "required": "Vous devez accepter les conditions" },
      "consentCndp": { "required": "Consentement CNDP obligatoire" }
    }
  }
}
```

### 6.30 `repo/apps/web-broker/messages/ar-MA.json` (extrait `auth.*` Darija ~50 cles)

```json
{
  "auth": {
    "login": {
      "title": "تسجيل الدخول",
      "subtitle": "دخل لـ Skalean ديال السمسرة",
      "fields": {
        "email": "البريد الإلكتروني",
        "password": "كلمة السر",
        "rememberMe": "تفكرني"
      },
      "submit": "دخول",
      "noAccount": "ما عندكش حساب ؟",
      "success": "تم الدخول",
      "links": {
        "forgotPassword": "نسيتي كلمة السر ؟",
        "signup": "صاوب حساب جديد"
      }
    },
    "verifyMfa": {
      "title": "التحقق فـ خطوتين",
      "subtitle": "دخل الكود ديال 6 ارقام",
      "codeLabel": "كود MFA 6 ارقام",
      "expiresIn": "غادي يسالى فـ {time}",
      "trustDevice": "ثق فـ هاد الجهاز 30 يوم",
      "success": "تم التحقق",
      "links": {
        "recoveryCode": "استعمل كود الاسترداد",
        "backToLogin": "رجوع لـ تسجيل الدخول"
      }
    },
    "signup": {
      "title": "صاوب حساب ديال السمسار",
      "subtitle": "سجل فـ Skalean Broker",
      "submit": "صاوب حسابي",
      "haveAccount": "عندك حساب ديجا ؟"
    },
    "forgotPassword": {
      "title": "نسيتي كلمة السر",
      "subtitle": "كتب البريد باش نصيفطو ليك رابط",
      "submit": "صيفط الرابط",
      "success": "صيفطنا البريد إلا كاين حساب"
    },
    "resetPassword": {
      "title": "بدل كلمة السر",
      "subtitle": "اختار كلمة سر جديدة",
      "tokenExpiresIn": "الرابط غادي يسالى فـ {time}",
      "submit": "بدل",
      "success": "تم تبديل كلمة السر"
    },
    "verifyEmail": {
      "title": "تحقق البريد",
      "verifying": "جاري التحقق",
      "success": "البريد تم التحقق منو",
      "error": "الرابط غالط ولا سالى"
    },
    "selectTenant": {
      "title": "اختار المكتب",
      "subtitle": "مرحبا {name}، اختار المكتب اللي بغيتي تخدم بيه"
    },
    "logout": { "inProgress": "خارج..." },
    "errors": {
      "generic": "وقع شي مشكل",
      "network": "مشكل فـ الشبكة",
      "invalidCredentials": "البيانات غالطة",
      "accountLocked": "الحساب مقفول"
    }
  }
}
```

### 6.31 `repo/apps/web-broker/messages/ar.json` (extrait `auth.*` arabe classique ~50 cles)

```json
{
  "auth": {
    "login": {
      "title": "تسجيل الدخول",
      "subtitle": "الولوج إلى منصة سكاليان للوسطاء",
      "fields": {
        "email": "البريد الإلكتروني",
        "password": "كلمة المرور",
        "rememberMe": "تذكرني"
      },
      "submit": "تسجيل الدخول",
      "noAccount": "ليس لديك حساب ؟",
      "success": "تم تسجيل الدخول بنجاح",
      "links": {
        "forgotPassword": "هل نسيت كلمة المرور ؟",
        "signup": "إنشاء حساب جديد"
      }
    },
    "verifyMfa": {
      "title": "التحقق بخطوتين",
      "subtitle": "أدخل الرمز المكون من 6 أرقام",
      "codeLabel": "رمز MFA المكون من 6 أرقام",
      "expiresIn": "ينتهي خلال {time}",
      "trustDevice": "الوثوق بهذا الجهاز لمدة 30 يوماً",
      "success": "تم التحقق بنجاح",
      "links": {
        "recoveryCode": "استخدام رمز استرداد",
        "backToLogin": "العودة إلى تسجيل الدخول"
      }
    },
    "signup": {
      "title": "إنشاء حساب وسيط",
      "subtitle": "التسجيل في منصة سكاليان للوسطاء",
      "submit": "إنشاء حسابي",
      "haveAccount": "لديك حساب بالفعل ؟"
    },
    "forgotPassword": {
      "title": "نسيت كلمة المرور",
      "subtitle": "أدخل بريدك لاستلام رابط إعادة التعيين",
      "submit": "إرسال الرابط",
      "success": "تم الإرسال إن كان الحساب موجوداً"
    },
    "resetPassword": {
      "title": "إعادة تعيين كلمة المرور",
      "tokenExpiresIn": "ينتهي الرابط خلال {time}",
      "submit": "إعادة التعيين",
      "success": "تمت إعادة تعيين كلمة المرور"
    },
    "verifyEmail": {
      "title": "التحقق من البريد",
      "verifying": "جارٍ التحقق",
      "success": "تم التحقق من البريد",
      "error": "رابط غير صالح أو منتهي الصلاحية"
    },
    "selectTenant": {
      "title": "اختر المكتب",
      "subtitle": "مرحباً {name}، اختر المكتب المراد العمل فيه"
    },
    "logout": { "inProgress": "جارٍ الخروج..." },
    "errors": {
      "generic": "حدث خطأ",
      "network": "تعذّر الاتصال بالشبكة",
      "invalidCredentials": "البيانات غير صحيحة",
      "accountLocked": "الحساب مقفل مؤقتاً"
    }
  }
}
```

---

## 7. Tests requis (Vitest unit + Playwright E2E)

### 7.1 Tests unitaires Vitest (15+ tests)

#### 7.1.1 `repo/apps/web-broker/test/auth/schemas.spec.ts` (~150 lignes, 8 tests)

```typescript
/**
 * Auth Zod schemas tests -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { describe, expect, it } from 'vitest';
import {
  EmailSchema,
  PasswordSchema,
  CinMaSchema,
  PhoneMaSchema,
  MfaCodeSchema,
  SignInSchema,
  SignUpSchema,
  ResetPasswordSchema,
} from '@/lib/auth/schemas';

describe('EmailSchema', () => {
  it('accepts valid email and lowercases', () => {
    const result = EmailSchema.parse('Contact@Skalean.MA');
    expect(result).toBe('contact@skalean.ma');
  });

  it('rejects invalid format', () => {
    expect(() => EmailSchema.parse('not-an-email')).toThrow();
  });

  it('rejects email > 255 chars', () => {
    const huge = 'a'.repeat(250) + '@b.co';
    expect(() => EmailSchema.parse(huge)).toThrow();
  });
});

describe('PasswordSchema', () => {
  it('accepts compliant password 12+ chars complexity', () => {
    expect(PasswordSchema.parse('Skalean@2026Broker')).toBeTruthy();
  });

  it('rejects too short', () => {
    expect(() => PasswordSchema.parse('Aa1@bcd')).toThrow();
  });

  it('rejects missing uppercase', () => {
    expect(() => PasswordSchema.parse('skalean@2026broker')).toThrow();
  });

  it('rejects missing digit', () => {
    expect(() => PasswordSchema.parse('Skalean@Broker')).toThrow();
  });

  it('rejects missing special char', () => {
    expect(() => PasswordSchema.parse('Skalean2026Broker')).toThrow();
  });
});

describe('CinMaSchema', () => {
  it('accepts standard CIN format', () => {
    expect(CinMaSchema.parse('BE123456')).toBe('BE123456');
  });

  it('accepts single letter prefix', () => {
    expect(CinMaSchema.parse('K9876543')).toBe('K9876543');
  });

  it('rejects too many digits', () => {
    expect(() => CinMaSchema.parse('BE12345678')).toThrow();
  });

  it('rejects lowercase + auto-uppercases', () => {
    expect(CinMaSchema.parse('be123456')).toBe('BE123456');
  });
});

describe('PhoneMaSchema', () => {
  it('accepts mobile +212 6XXX', () => {
    expect(PhoneMaSchema.parse('+212612345678')).toBe('+212612345678');
  });

  it('accepts mobile +212 7XXX', () => {
    expect(PhoneMaSchema.parse('+212712345678')).toBe('+212712345678');
  });

  it('accepts fixe +212 5XXX', () => {
    expect(PhoneMaSchema.parse('+212522112233')).toBe('+212522112233');
  });

  it('rejects without country code', () => {
    expect(() => PhoneMaSchema.parse('0612345678')).toThrow();
  });

  it('rejects foreign country code', () => {
    expect(() => PhoneMaSchema.parse('+33612345678')).toThrow();
  });
});

describe('MfaCodeSchema', () => {
  it('accepts 6 digits', () => {
    expect(MfaCodeSchema.parse('123456')).toBe('123456');
  });

  it('rejects 5 digits', () => {
    expect(() => MfaCodeSchema.parse('12345')).toThrow();
  });

  it('rejects letters', () => {
    expect(() => MfaCodeSchema.parse('12345A')).toThrow();
  });
});

describe('SignInSchema', () => {
  it('accepts valid signin', () => {
    const result = SignInSchema.parse({
      email: 'broker@skalean.ma',
      password: 'anything',
      remember_me: true,
    });
    expect(result.remember_me).toBe(true);
  });

  it('defaults remember_me to false', () => {
    const result = SignInSchema.parse({
      email: 'broker@skalean.ma',
      password: 'anything',
    });
    expect(result.remember_me).toBe(false);
  });
});

describe('SignUpSchema', () => {
  const valid = {
    email: 'broker@skalean.ma',
    password: 'Skalean@2026Broker',
    password_confirm: 'Skalean@2026Broker',
    display_name: 'Mohamed Broker',
    locale: 'fr' as const,
    accept_terms: true as const,
    consent_cndp: true as const,
  };

  it('accepts valid signup', () => {
    expect(SignUpSchema.parse(valid)).toBeTruthy();
  });

  it('rejects password mismatch', () => {
    expect(() => SignUpSchema.parse({ ...valid, password_confirm: 'Other@2026Broker' })).toThrow();
  });

  it('rejects without accept_terms', () => {
    expect(() => SignUpSchema.parse({ ...valid, accept_terms: false })).toThrow();
  });

  it('rejects without consent_cndp', () => {
    expect(() => SignUpSchema.parse({ ...valid, consent_cndp: false })).toThrow();
  });
});

describe('ResetPasswordSchema', () => {
  it('accepts valid reset', () => {
    const result = ResetPasswordSchema.parse({
      token: 'a'.repeat(50),
      new_password: 'Skalean@2026Broker',
      new_password_confirm: 'Skalean@2026Broker',
    });
    expect(result.token).toHaveLength(50);
  });

  it('rejects mismatch confirm', () => {
    expect(() =>
      ResetPasswordSchema.parse({
        token: 'a'.repeat(50),
        new_password: 'Skalean@2026Broker',
        new_password_confirm: 'Different@2026Pass',
      }),
    ).toThrow();
  });
});
```

#### 7.1.2 `repo/apps/web-broker/test/auth/mfa-code-input.spec.tsx` (~120 lignes, 5 tests)

```typescript
/**
 * MfaCodeInput tests -- web-broker
 * Reference : 00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md (Tache 4.3.2)
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MfaCodeInput } from '@/components/auth/mfa-code-input';

describe('MfaCodeInput', () => {
  it('renders 6 inputs', () => {
    render(<MfaCodeInput value="" onChange={() => {}} onComplete={() => {}} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
  });

  it('auto-advances focus on typing digit', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MfaCodeInput value="" onChange={onChange} onComplete={() => {}} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    inputs[0].focus();
    await user.keyboard('1');
    expect(document.activeElement).toBe(inputs[1]);
    expect(onChange).toHaveBeenLastCalledWith('1');
  });

  it('navigates backward on Backspace empty', async () => {
    const user = userEvent.setup();
    render(<MfaCodeInput value="" onChange={() => {}} onComplete={() => {}} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    inputs[2].focus();
    await user.keyboard('{Backspace}');
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('distributes paste 6 chars across inputs', () => {
    const onChange = vi.fn();
    const onComplete = vi.fn();
    render(<MfaCodeInput value="" onChange={onChange} onComplete={onComplete} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '123456' },
    });
    expect(onChange).toHaveBeenCalledWith('123456');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('auto-submits via onComplete at 6 chars', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<MfaCodeInput value="" onChange={() => {}} onComplete={onComplete} />);
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    inputs[0].focus();
    await user.keyboard('123456');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });
});
```

#### 7.1.3 `repo/apps/web-broker/test/auth/password-strength-indicator.spec.tsx` (~100 lignes, 4 tests)

```typescript
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PasswordStrengthIndicator } from '@/components/auth/password-strength-indicator';

describe('PasswordStrengthIndicator', () => {
  it('renders nothing when password empty', () => {
    const { container } = render(<PasswordStrengthIndicator password="" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows weak score for "password"', async () => {
    render(<PasswordStrengthIndicator password="password" />);
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    });
  });

  it('shows strong score for long random password', async () => {
    render(<PasswordStrengthIndicator password="Tx9$kP2wQm!7zRa#nY4" />);
    await waitFor(
      () => {
        const bar = screen.getByRole('progressbar');
        expect(Number(bar.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(3);
      },
      { timeout: 2000 },
    );
  });

  it('shows suggestions list when zxcvbn provides any', async () => {
    render(<PasswordStrengthIndicator password="qwerty123" />);
    await waitFor(() => {
      expect(screen.queryByRole('list')).toBeInTheDocument();
    });
  });
});
```

#### 7.1.4 `repo/apps/web-broker/test/auth/cookies.spec.ts` (~80 lignes, 3 tests)

```typescript
import { describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';
import {
  COOKIE_ACCESS_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_CURRENT_TENANT,
  clearAuthCookies,
  setAuthCookies,
} from '@/lib/auth/cookies';

describe('cookies helpers', () => {
  it('sets 3 cookies with httpOnly + sameSite=lax', () => {
    const response = NextResponse.json({ ok: true });
    setAuthCookies({
      response,
      accessToken: 'access.jwt',
      refreshToken: 'refresh.jwt',
      currentTenantId: '550e8400-e29b-41d4-a716-446655440000',
      rememberMe: true,
    });
    const cookies = response.cookies.getAll();
    const access = cookies.find((c) => c.name === COOKIE_ACCESS_TOKEN);
    const refresh = cookies.find((c) => c.name === COOKIE_REFRESH_TOKEN);
    const tenant = cookies.find((c) => c.name === COOKIE_CURRENT_TENANT);
    expect(access?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe('lax');
    expect(refresh?.maxAge).toBe(30 * 24 * 60 * 60);
    expect(tenant?.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('uses short maxAge if remember_me false', () => {
    const response = NextResponse.json({ ok: true });
    setAuthCookies({
      response,
      accessToken: 'a',
      refreshToken: 'r',
      rememberMe: false,
    });
    const refresh = response.cookies.get(COOKIE_REFRESH_TOKEN);
    expect(refresh?.maxAge).toBe(24 * 60 * 60);
  });

  it('clears all 3 cookies with maxAge=0', () => {
    const response = NextResponse.json({ ok: true });
    clearAuthCookies(response);
    const cookies = response.cookies.getAll();
    expect(cookies.find((c) => c.name === COOKIE_ACCESS_TOKEN)?.maxAge).toBe(0);
    expect(cookies.find((c) => c.name === COOKIE_REFRESH_TOKEN)?.maxAge).toBe(0);
    expect(cookies.find((c) => c.name === COOKIE_CURRENT_TENANT)?.maxAge).toBe(0);
  });
});
```

### 7.2 Tests E2E Playwright (15+ scenarios)

#### 7.2.1 `repo/apps/web-broker/e2e/auth/login.spec.ts` (~200 lignes, 4 scenarios)

```typescript
import { expect, test } from '@playwright/test';

test.describe('Login flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fr/login');
  });

  test('signs in successfully with valid credentials (single-tenant)', async ({ page, context }) => {
    await page.route('**/api/auth/signin', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': [
            'access_token=fake.access; HttpOnly; SameSite=Lax; Path=/; Max-Age=900',
            'refresh_token=fake.refresh; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400',
            'current_tenant_id=tenant-1; HttpOnly; SameSite=Lax; Path=/',
          ].join(', '),
        },
        body: JSON.stringify({
          ok: true,
          user: { id: 'u1', email: 'broker@skalean.ma', display_name: 'Broker', locale: 'fr', mfa_enabled: false },
          tenants: [{ id: 'tenant-1', name: 'Cabinet Demo', role: 'broker_admin', logo_url: null }],
          needs_tenant_selection: false,
        }),
      });
    });

    await page.fill('input[id=email]', 'broker@skalean.ma');
    await page.fill('input[id=password]', 'Skalean@2026Broker');
    await page.click('button[type=submit]');

    await expect(page).toHaveURL(/\/fr\/dashboard/);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'access_token')).toBeDefined();
    expect(cookies.find((c) => c.name === 'access_token')?.httpOnly).toBe(true);
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.route('**/api/auth/signin', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'INVALID_CREDENTIALS', message: 'auth.errors.invalidCredentials' } }),
      }),
    );

    await page.fill('input[id=email]', 'wrong@skalean.ma');
    await page.fill('input[id=password]', 'WrongPassword@123');
    await page.click('button[type=submit]');

    await expect(page.getByText(/identifiants incorrects/i)).toBeVisible({ timeout: 3000 });
    await expect(page).toHaveURL(/\/fr\/login/);
  });

  test('redirects to verify-mfa if MFA enabled', async ({ page }) => {
    await page.route('**/api/auth/signin', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          needs_mfa: true,
          mfa_challenge_token: 'ch_token_abc123def456',
          mfa_challenge_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }),
      }),
    );

    await page.fill('input[id=email]', 'mfa@skalean.ma');
    await page.fill('input[id=password]', 'Skalean@2026Broker');
    await page.click('button[type=submit]');

    await expect(page).toHaveURL(/\/fr\/verify-mfa/);
    const challenge = await page.evaluate(() => sessionStorage.getItem('skalean.mfa_challenge'));
    expect(challenge).toContain('ch_token_abc123def456');
  });

  test('redirects to select-tenant when multi-tenant', async ({ page }) => {
    await page.route('**/api/auth/signin', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          user: { id: 'u1', email: 'admin@skalean.ma', display_name: 'Admin', locale: 'fr', mfa_enabled: false },
          tenants: [
            { id: 't1', name: 'Cabinet A', role: 'broker_admin', logo_url: null },
            { id: 't2', name: 'Cabinet B', role: 'broker_user', logo_url: null },
          ],
          needs_tenant_selection: true,
        }),
      }),
    );

    await page.fill('input[id=email]', 'multi@skalean.ma');
    await page.fill('input[id=password]', 'Skalean@2026Broker');
    await page.click('button[type=submit]');

    await expect(page).toHaveURL(/\/fr\/select-tenant/);
  });
});
```

#### 7.2.2 `repo/apps/web-broker/e2e/auth/mfa.spec.ts` (~180 lignes, 3 scenarios)

```typescript
import { expect, test } from '@playwright/test';

test.describe('MFA flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fr/login');
    await page.evaluate(() => {
      sessionStorage.setItem(
        'skalean.mfa_challenge',
        JSON.stringify({
          token: 'ch_token_abc',
          expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        }),
      );
    });
    await page.goto('/fr/verify-mfa');
  });

  test('verifies MFA with valid code and redirects dashboard', async ({ page }) => {
    await page.route('**/api/auth/verify-mfa', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          user: { id: 'u1', email: 'mfa@skalean.ma', display_name: 'MFA User', locale: 'fr', mfa_enabled: true },
          tenants: [{ id: 'tenant-1', name: 'Cabinet', role: 'broker_admin', logo_url: null }],
          needs_tenant_selection: false,
        }),
      }),
    );

    const inputs = await page.locator('input[inputmode=numeric]').all();
    for (let i = 0; i < 6; i++) {
      await inputs[i].fill(String(i + 1));
    }

    await expect(page).toHaveURL(/\/fr\/dashboard/, { timeout: 5000 });
    const remainingChallenge = await page.evaluate(() => sessionStorage.getItem('skalean.mfa_challenge'));
    expect(remainingChallenge).toBeNull();
  });

  test('shows error on wrong MFA code', async ({ page }) => {
    await page.route('**/api/auth/verify-mfa', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'MFA_INVALID_CODE', message: 'auth.errors.mfa.invalidCode' } }),
      }),
    );

    const inputs = await page.locator('input[inputmode=numeric]').all();
    for (let i = 0; i < 6; i++) {
      await inputs[i].fill('9');
    }

    await expect(page.getByText(/code incorrect/i)).toBeVisible({ timeout: 3000 });
    // Inputs reset
    await expect(inputs[0]).toHaveValue('');
  });

  test('redirects to login if MFA challenge expired', async ({ page }) => {
    await page.evaluate(() => {
      sessionStorage.setItem(
        'skalean.mfa_challenge',
        JSON.stringify({
          token: 'ch_token_expired',
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        }),
      );
    });
    await page.reload();
    await expect(page).toHaveURL(/\/fr\/login/, { timeout: 3000 });
  });
});
```

#### 7.2.3 `repo/apps/web-broker/e2e/auth/signup.spec.ts` (~170 lignes, 3 scenarios)

```typescript
import { expect, test } from '@playwright/test';

test.describe('Signup flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/fr/signup');
  });

  test('completes signup and redirects to email-sent', async ({ page }) => {
    await page.route('**/api/auth/signup', (route) =>
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, user_id: 'u_new_1' }),
      }),
    );

    await page.fill('#display_name', 'Mohamed Test');
    await page.fill('#email', 'newbroker@skalean.ma');
    await page.fill('#phone', '+212612345678');
    await page.fill('#password', 'Skalean@2026Broker');
    await page.fill('#password_confirm', 'Skalean@2026Broker');
    await page.check('input[name=accept_terms]');
    await page.check('input[name=consent_cndp]');

    await page.click('button[type=submit]');

    await expect(page).toHaveURL(/\/fr\/email-sent\?email=newbroker%40skalean\.ma/);
  });

  test('shows error if email already exists', async ({ page }) => {
    await page.route('**/api/auth/signup', (route) =>
      route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'EMAIL_ALREADY_EXISTS', message: 'auth.errors.emailAlreadyExists' } }),
      }),
    );

    await page.fill('#display_name', 'Doublon');
    await page.fill('#email', 'existing@skalean.ma');
    await page.fill('#password', 'Skalean@2026Broker');
    await page.fill('#password_confirm', 'Skalean@2026Broker');
    await page.check('input[name=accept_terms]');
    await page.check('input[name=consent_cndp]');
    await page.click('button[type=submit]');

    await expect(page.getByText(/existe deja/i)).toBeVisible({ timeout: 3000 });
  });

  test('validates password complexity client-side', async ({ page }) => {
    await page.fill('#email', 'test@skalean.ma');
    await page.fill('#password', 'weakpass');
    await page.fill('#password_confirm', 'weakpass');
    await page.fill('#display_name', 'Test');
    await page.check('input[name=accept_terms]');
    await page.check('input[name=consent_cndp]');
    await page.click('button[type=submit]');

    await expect(page.getByText(/12 caracteres|majuscule|chiffre|special/i).first()).toBeVisible({ timeout: 2000 });
  });
});
```

#### 7.2.4 `repo/apps/web-broker/e2e/auth/recovery.spec.ts` (~180 lignes, 3 scenarios)

```typescript
import { expect, test } from '@playwright/test';
import { SignJWT } from 'jose';

async function makeResetToken(ttlSec = 900): Promise<string> {
  const secret = new TextEncoder().encode('e2e-test-secret');
  return new SignJWT({ sub: 'u1', purpose: 'reset' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSec)
    .sign(secret);
}

test.describe('Recovery flow', () => {
  test('forgot password submits and redirects to email-sent', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
    );
    await page.goto('/fr/forgot-password');
    await page.fill('#email', 'broker@skalean.ma');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/fr\/email-sent.*type=reset/);
  });

  test('reset-password updates pw and redirects to login', async ({ page }) => {
    const token = await makeResetToken(900);
    await page.route('**/api/auth/reset-password', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
    );
    await page.goto(`/fr/reset-password?token=${token}`);
    await page.fill('#new_password', 'Skalean@2026Broker');
    await page.fill('#new_password_confirm', 'Skalean@2026Broker');
    await page.click('button[type=submit]');
    await expect(page).toHaveURL(/\/fr\/login/, { timeout: 5000 });
  });

  test('verify-email auto-redirects to login on success', async ({ page }) => {
    await page.route('**/api/auth/verify-email**', (route) =>
      route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) }),
    );
    await page.goto('/fr/verify-email?token=' + 'a'.repeat(50));
    await expect(page).toHaveURL(/\/fr\/login\?verified=1/, { timeout: 5000 });
  });
});
```

#### 7.2.5 `repo/apps/web-broker/e2e/auth/multi-tenant.spec.ts` (~120 lignes, 2 scenarios)

```typescript
import { expect, test } from '@playwright/test';

test.describe('Multi-tenant select', () => {
  test('renders tenant cards and switches on click', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'access_token',
        value: 'fake.access.jwt',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
      },
    ]);
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'u1', email: 'multi@skalean.ma', display_name: 'Multi User' },
          tenants: [
            { id: 't-aaa', name: 'Cabinet Alpha', role: 'broker_admin', logo_url: null },
            { id: 't-bbb', name: 'Cabinet Beta', role: 'broker_user', logo_url: null },
          ],
        }),
      }),
    );
    await page.route('**/api/auth/select-tenant', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': 'current_tenant_id=t-aaa; HttpOnly; SameSite=Lax; Path=/',
        },
        body: JSON.stringify({ ok: true }),
      }),
    );

    await page.goto('/fr/select-tenant');
    await expect(page.getByText('Cabinet Alpha')).toBeVisible();
    await expect(page.getByText('Cabinet Beta')).toBeVisible();
    await page.click('text=Cabinet Alpha');
    await expect(page).toHaveURL(/\/fr\/dashboard/);
  });

  test('redirects to login if no access_token cookie', async ({ page }) => {
    await page.goto('/fr/select-tenant');
    await expect(page).toHaveURL(/\/fr\/login/);
  });
});
```

---

## 8. Criteres validation (V1-V25 : 15 P0 + 6 P1 + 4 P2)

### P0 -- Critical (bloquant production)

#### V1 (P0) -- Login email + password OK -> set cookies + redirect /dashboard
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "signs in successfully"`
**Expected** : test passe, cookies `access_token` + `refresh_token` + `current_tenant_id` sets avec `HttpOnly`, redirect `/fr/dashboard`.
**Failure mode** : cookies non poses -> middleware `/protected` redirect `/login` infinite loop.

#### V2 (P0) -- Login mauvais creds -> toast error generic
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "invalid credentials"`
**Expected** : toast "Identifiants incorrects" visible, pas de mention "email n'existe pas" (defense user enumeration).
**Failure mode** : leak info via codes erreur differents.

#### V3 (P0) -- Login MFA enabled -> store challenge + redirect /verify-mfa
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "redirects to verify-mfa"`
**Expected** : sessionStorage `skalean.mfa_challenge` set, redirect `/fr/verify-mfa`.
**Failure mode** : challenge perdu -> verify-mfa redirect login.

#### V4 (P0) -- MFA wrong code -> error toast + clear inputs
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "wrong MFA code"`
**Expected** : toast erreur, 6 inputs reset, focus input 1.
**Failure mode** : code reste, double-submit possible.

#### V5 (P0) -- MFA challenge expired -> redirect login + clear sessionStorage
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "MFA challenge expired"`
**Expected** : redirect `/fr/login`, sessionStorage cleared.
**Failure mode** : user bloque sur verify-mfa.

#### V6 (P0) -- Signup full -> redirect /email-sent
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "completes signup"`
**Expected** : redirect `/fr/email-sent?email=...`, pas de cookies poses (email-verif required).
**Failure mode** : cookies poses prematurement.

#### V7 (P0) -- Signup email duplicate -> toast specific
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "email already exists"`
**Expected** : toast "Un compte existe deja".
**Failure mode** : autre erreur generique.

#### V8 (P0) -- Verify-email auto-redirect /login
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "verify-email auto-redirects"`
**Expected** : redirect `/fr/login?verified=1` apres ~1.5s.
**Failure mode** : page reste statique.

#### V9 (P0) -- Forgot+reset password complet
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "reset-password updates pw"`
**Expected** : redirect `/fr/login` apres reset success.
**Failure mode** : token expire ne previens pas user.

#### V10 (P0) -- Multi-tenant select set cookie + redirect dashboard
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e -g "renders tenant cards"`
**Expected** : cookie `current_tenant_id` set, redirect `/fr/dashboard`.
**Failure mode** : tenant non set -> middleware redirect `/select-tenant` infinite loop.

#### V11 (P0) -- Logout invalidates server + clears cookies + broadcasts other tabs
**Commande** : test E2E manuel ou Playwright avec 2 contexts
**Expected** : POST `/api/auth/logout` retourne 200, cookies cleared (Max-Age=0), BroadcastChannel event recu autres tabs.
**Failure mode** : tab2 reste authentifie.

#### V12 (P0) -- Refresh token rotation : old token rejected, new tokens posed
**Commande** : `pnpm --filter @insurtech/web-broker test -g "refresh"`
**Expected** : nouveau access_token + nouveau refresh_token cookies.
**Failure mode** : reuse detected token -> family revoke.

#### V13 (P0) -- Cookies flags HttpOnly + SameSite=Lax + Secure(prod) + Path=/
**Commande** : `pnpm --filter @insurtech/web-broker test -g "cookies helpers"`
**Expected** : 3 cookies tous flags corrects.
**Failure mode** : cookies accessibles `document.cookie` -> XSS exposure.

#### V14 (P0) -- Schemas Zod refusent CIN/phone/password invalides
**Commande** : `pnpm --filter @insurtech/web-broker test -g "PhoneMaSchema|PasswordSchema|CinMaSchema"`
**Expected** : 100% tests pass.
**Failure mode** : bypass validation client.

#### V15 (P0) -- Tests Playwright 15+ scenarios green
**Commande** : `pnpm --filter @insurtech/web-broker test:e2e --grep auth`
**Expected** : 15+ tests pass.
**Failure mode** : flake intermittent.

### P1 -- High (correction Sprint 16 recommandee)

#### V16 (P1) -- Password strength bar reactif au typing
**Commande** : `pnpm --filter @insurtech/web-broker test -g "PasswordStrengthIndicator"`
**Expected** : score 0-4 update apres typing.
**Failure mode** : UI ne reagit pas.

#### V17 (P1) -- 6 digits MFA accepte paste depuis clipboard
**Commande** : `pnpm --filter @insurtech/web-broker test -g "paste 6 chars"`
**Expected** : 6 inputs remplis instantanement.
**Failure mode** : seul 1er input rempli.

#### V18 (P1) -- Verify-email token consume 2x idempotent
**Commande** : test E2E manuel
**Expected** : 2eme click retourne success "deja verifie" pas error.
**Failure mode** : 2eme click erreur user-facing.

#### V19 (P1) -- I18n fr / ar-MA / ar tous textes auth couverts
**Commande** : `pnpm --filter @insurtech/web-broker test -g "i18n keys parity"`
**Expected** : 100% cles `auth.*` paritaires fr/ar-MA/ar.
**Failure mode** : cles manquantes => fallback fr render.

#### V20 (P1) -- BroadcastChannel logout sync autres tabs
**Commande** : test E2E Playwright multi-page
**Expected** : tab2 redirect `/login` apres tab1 logout.
**Failure mode** : tab2 reste UI authentifie.

#### V21 (P1) -- Lighthouse accessibility >= 95 sur /fr/login
**Commande** : `pnpm --filter @insurtech/web-broker lh -- --only-categories=accessibility`
**Expected** : score >= 95.
**Failure mode** : contrast ratio, ARIA manquant.

### P2 -- Medium (deferable Sprint 17)

#### V22 (P2) -- Trust device 30 jours sur MFA verify
**Commande** : test E2E avec `trust_device=true`
**Expected** : refresh_token Max-Age = 2592000.
**Failure mode** : TTL court.

#### V23 (P2) -- RTL layout correct sur /ar/login + /ar-MA/login
**Commande** : visual diff Playwright `@axe-core/playwright`
**Expected** : dir=rtl applique, padding-inline-start correct.
**Failure mode** : layout casse.

#### V24 (P2) -- Sentry capture erreurs 5xx backend
**Commande** : verifier via Sentry DSN dev
**Expected** : event captured tag `type=api-5xx`.
**Failure mode** : silencieux.

#### V25 (P2) -- Schema Zod backend / frontend sync via package partage
**Commande** : `pnpm test:integration -g "schemas parity"` (Sprint 33)
**Expected** : 100% schemas paritaires backend/frontend.
**Failure mode** : drift schema -> validation bypass.

---

## 9. Edge cases (10 EC)

### EC1 -- MFA challenge expire pendant que l'utilisateur tape

**Scenario** : user connecte signin, redirect /verify-mfa, ouvre cafe, revient 6 minutes plus tard (challenge expire TTL 5min Sprint 5), tape 6 digits.

**Resolution** :
- countdown affiche en UI passe a 00:00
- effet hook detecte `remaining === 0` -> `sessionStorage.removeItem` + toast "session expiree" + redirect `/login`
- meme si user soumet quand meme : POST `/api/auth/verify-mfa` retourne 401 MFA_CHALLENGE_EXPIRED -> meme cleanup
- defense en profondeur : backend valide TTL, frontend countdown UX-only

### EC2 -- Network error pendant signin (proxy 504)

**Scenario** : backend NestJS hiccup, Route Handler timeout 10s ou retourne 504.

**Resolution** :
- `proxyToBackend` retry 1x sur 502/503/504
- si 2eme echec -> retour `{ error: { code: 'NETWORK_ERROR', message: 'auth.errors.network' } }`
- UI toast "Probleme reseau"
- bouton submit re-enable, user peut retry
- Sentry capture event tag `type=backend-503`

### EC3 -- Refresh token rotation race (2 tabs concurrent)

**Scenario** : tab1 et tab2 ouverts authentifies, access_token expire simultanement, les deux trigger refresh meme moment.

**Resolution** :
- premier qui arrive : backend Sprint 5 rotation success -> nouveau pair tokens
- deuxieme : backend detecte refresh_token utilise (deja consumed) -> 401 TOKEN_REUSE_DETECTED + family revoke
- Route Handler `/api/auth/refresh` clear cookies + retourne 401
- tab2 BroadcastChannel notifie tab1 (anciennement valide) -> tab1 force re-login aussi
- mitigation future Sprint 18 : Web Locks API serialize refresh single-tab

### EC4 -- Multi-tenant cookie set sur signin single-tenant (preserve UX)

**Scenario** : user single-tenant signin, `current_tenant_id` doit etre set automatique (pas de page select-tenant).

**Resolution** :
- Route Handler `/api/auth/signin` detecte `tenants.length === 1`
- set cookie `current_tenant_id = tenants[0].id` direct
- frontend `data.needs_tenant_selection === false` -> redirect `/dashboard` direct

### EC5 -- Reset password token expire pendant le formulaire (>15min idle)

**Scenario** : user ouvre lien reset email a 14h00 (TTL 15min), part en pause, revient 14h30 essayer submit.

**Resolution** :
- frontend decode JWT client-side via `jose.decodeJwt` (sans verify) lit `exp`
- effect countdown affiche "Lien expire dans MM:SS"
- a 0 : toast erreur + redirect `/forgot-password`
- si user submit quand meme avant detection 0 : backend rejette 401 TOKEN_EXPIRED -> UI toast + redirect

### EC6 -- Signup email already exists (defense user enumeration delicate)

**Scenario** : attacker tente signup `existing@email.com`.

**Resolution** :
- backend Sprint 5 retourne 409 EMAIL_ALREADY_EXISTS (decision metier UX > security-paranoid : on prefere informer le user clairement plutot que silent fail)
- frontend toast "Un compte existe deja pour cet email -- avez-vous oublie votre mot de passe ?"
- pas de bruteforce car LockoutService Sprint 5 limite essais (5/h IP)
- log Sentry pour monitoring abuse pattern

### EC7 -- Verify-email token consomme 2 fois (replay-safe idempotent)

**Scenario** : user click email lien 2x (notification email + thumb mobile).

**Resolution** :
- backend Sprint 5 : `verified_at` set 1ere fois, 2eme fois idempotent (same value)
- backend retourne 200 OK avec body `{ already_verified: true }` ou meme 200 sans difference (preferred)
- frontend toast "Email deja verifie" (info pas error)
- pas de blocking, redirect login normal

### EC8 -- Logout sur tab1, tab2 doit etre force re-login

**Scenario** : user ouvre 2 tabs broker, signin sur 1, navigue dashboard, click "Se deconnecter" sur tab1.

**Resolution** :
- tab1 POST `/api/auth/logout` -> backend invalide session + cookies cleared
- tab1 `postAuthEvent({ type: 'logout' })` via BroadcastChannel
- tab2 listener `useAuthBroadcast` -> `router.push('/login?message=logged_out_other_tab')`
- toast tab2 "Deconnexion sur un autre onglet"

### EC9 -- Password reset vers meme mot de passe que l'ancien

**Scenario** : user oublie pw, request reset, choisit le meme pw que celui qu'il a oublie.

**Resolution** :
- backend Sprint 5 ne verifie PAS l'unicite (decision metier : si user a oublie, OK reset meme valeur)
- Sprint 14 ajoutera password history check (HIBP API + last 5 hashes Argon2) si requirement compliance
- frontend ne demande pas current pw sur reset (token-based, pas pw-change)

### EC10 -- User multi-tenant select-tenant puis change d'avis (back button)

**Scenario** : user authentifie multi-tenant, sur `/select-tenant`, click Cabinet A (cookie set, redirect /dashboard), press browser back.

**Resolution** :
- browser back retourne `/select-tenant`
- page re-render via Server Component, fetch `/api/auth/me` re-list tenants
- user peut cliquer Cabinet B -> POST `/api/auth/select-tenant` body `{ tenant_id: 'B' }` -> cookie overwrite
- redirect `/dashboard` nouveau contexte tenant
- aucun reload requis (cookie remplace)

---

## 10. Conformite Maroc (CNDP + ACAPS + 09-08 + 53-05)

### 10.1 Loi 09-08 -- Protection donnees personnelles (CNDP)

**Article 3** : tout traitement de donnees personnelles necessite consentement libre, specifique, eclaire.

**Implementation Tache 4.3.2** :
- Signup form **DOIT** inclure checkbox `consent_cndp` non pre-cochee : "Je consens au traitement de mes donnees conformement a la loi 09-08 CNDP"
- Zod `SignUpSchema` rejette si `consent_cndp !== true` (Zod literal true required)
- Lien vers `/legal/privacy` accessible visible sur tous les forms auth
- Cookies bannier (geree par Tache 4.3.13 i18n) pose cookie `cndp_consent` 12 mois max (decret CNDP 2024)

**Article 16** : Droit a l'information avant collecte.

**Implementation** :
- page `/signup` affiche en bas "Vos donnees sont stockees sur Atlas Cloud Services Benguerir (Maroc). Vous avez droit d'acces / rectification / opposition. Contact : dpo@skalean-insurtech.ma"

### 10.2 Loi 53-05 -- Echanges electroniques (authentification forte)

**Article 5** : authentification forte requise pour actes engageants (signature contrat).

**Implementation Tache 4.3.2** :
- MFA TOTP active pour roles broker_admin (config admin Tache 4.3.11 force MFA setup)
- Recovery codes generes au setup MFA Sprint 5 + Tache 4.3.11
- session timeout access_token 15min (sensible aux actes engageants)

### 10.3 Decret cookies CNDP 2024

**Regles applicables** :
- consentement explicite avant cookies non-essentiels
- cookies essentiels (auth) : pas de consentement requis mais info user
- TTL maximum 13 mois
- httpOnly + Secure obligatoires pour cookies session

**Implementation Tache 4.3.2** :
- cookies `access_token` (Max-Age 900s), `refresh_token` (Max-Age 86400s ou 2592000s), `current_tenant_id` (Max-Age 2592000s) tous httpOnly + Secure(prod) + SameSite=lax
- cookies essentiels : pas de consent banner (info uniquement)
- Tache 4.3.13 ajoutera consent banner pour cookies analytics + marketing

### 10.4 ACAPS (Autorite Controle Assurances Prevoyance Sociale)

**Pertinence Tache 4.3.2** : indirecte. ACAPS regule l'activite courtage assurance ; l'auth est prerequis a l'usage de la plateforme.

**Implementation** :
- log audit Sprint 5 (audit_logs table) capture chaque signin / signup / logout
- conservation 7 ans (decision-016 audit logs MA standard ACAPS)
- export pour controle ACAPS via Sprint 31

---

## 11. Conventions code (20+ rappels Skalean InsurTech)

1. **NO EMOJI ABSOLU** (decision-006) : zero emoji dans `app/**`, `components/**`, `lib/**`, `messages/*.json`, `e2e/**`. Linter custom `scripts/check-no-emoji.sh` verifie CI.

2. **No console.log production** : `app/api/**` et `lib/**` -> 0 `console.log` (utiliser logger Pino Sprint 4). Tests OK.

3. **TypeScript strict** : pas de `any`, `unknown` puis narrow. `noUncheckedIndexedAccess: true`.

4. **Imports absolus** via `@/` (paths configures tsconfig). Pas de `../../../`.

5. **Server Components defaut** : tous les fichiers SANS `'use client'`. Marquer explicitement client pages avec state/effects.

6. **Async params Next 15** : `params: Promise<{ locale: string }>` puis `await params`. Pas de `params: { locale: string }` direct.

7. **Cookies API Next 15** : `cookies()` async => `await cookies()`. Idem `headers()`.

8. **Zod schemas centralized** : `lib/auth/schemas.ts` uniquement. Pas de redefinition inline.

9. **react-hook-form + zodResolver** : pattern systematique, pas de `useState` manuel pour form fields.

10. **sonner toasts** : `toast.success / .error / .info`. Pas de native `alert()`.

11. **shadcn/ui components** : import depuis `@insurtech/shared-ui/components/*`. Pas de duplication composants.

12. **next-intl getTranslations server** + `useTranslations client` : pas de hardcoded strings.

13. **ARIA labels** : tous les inputs + buttons sans label visible doivent avoir `aria-label`.

14. **noValidate sur forms** : disable browser native validation (Zod gere).

15. **`required` sur input HTML** : pour browser autofill UX, mais Zod est l'autorite finale.

16. **role="alert" sur erreurs** : pour screen readers.

17. **autoComplete attributes** : `email`, `current-password`, `new-password`, `tel`, `name`, `one-time-code`.

18. **inputMode="numeric"** sur MFA inputs (numeric keyboard mobile).

19. **Loader2 spinner** : import depuis `lucide-react`, pas d'autres lib icons.

20. **Date Africa/Casablanca** : toujours via `date-fns-tz` + locale fr/ar (Sprint 4 setup).

21. **MAD currency** : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`.

22. **URLs absolues backend** : via `process.env.NEXT_PUBLIC_API_URL`. Jamais hardcoded localhost.

23. **Trace ID** : `crypto.randomUUID()` injecte chaque request backend (Sprint 4 api-client pattern).

24. **Sentry capture** : 5xx automatique via `proxyToBackend`. Erreurs UI non bloquantes via `Sentry.captureMessage`.

25. **BroadcastChannel name** : `'skalean.auth'` (namespace prefix obligatoire pour multi-app same-origin futur).

---

## 12. Risques & mitigations

| # | Risque | Probabilite | Impact | Mitigation |
|---|--------|-------------|--------|------------|
| R1 | XSS leak access_token | Faible | Critique | Cookies httpOnly + CSP strict (Sprint 4) + Sentry replay maskAllText |
| R2 | CSRF sur POST signin | Faible | Critique | SameSite=lax + origin check Route Handler (Sprint 14) |
| R3 | Refresh token race 2 tabs | Moyenne | Moyen | BroadcastChannel coordinate + Sprint 18 Web Locks API |
| R4 | zxcvbn bundle 70 ko bloque LCP | Moyenne | Faible | Dynamic import + lazy load sur /signup et /reset-password uniquement |
| R5 | i18n missing keys casse build | Moyenne | Moyen | CI `validate-i18n-keys.ts` parite fr/ar-MA/ar |
| R6 | Backend Sprint 5 endpoint change schema | Moyenne | Eleve | Schemas Zod paritaires + integration tests Sprint 33 |
| R7 | User multi-tab logout disparate | Moyenne | Moyen | BroadcastChannel auth event + listener tabs |
| R8 | Email verification spam fold (delivery) | Moyenne | Moyen | Sprint 9 Comm + SES sandbox + DKIM/SPF/DMARC Atlas |
| R9 | Token reset link forwarded a tier (phishing) | Faible | Eleve | TTL 15min + single-use Sprint 5 + log envoi Sentry |
| R10 | Cookie SameSite=lax permet POST cross-site via form GET-trigger | Faible | Moyen | Origin check Sprint 14 + audit pen-test Sprint 32 |
| R11 | MFA challenge token leak sessionStorage XSS | Faible | Eleve | TTL 5min + CSP strict + cleanup post-verify |
| R12 | Multi-tenant cookie set wrong tenant_id | Faible | Critique | Backend valide tenant_id appartient user (Route Handler check) |
| R13 | Form double-submit accidentel | Moyenne | Faible | Bouton disabled + submitting ref flag |
| R14 | Zod schema drift backend/frontend | Moyenne | Moyen | Package partage `@insurtech/auth/schemas` Sprint 5 |
| R15 | Lighthouse a11y < 90 | Faible | Faible | ARIA labels systematiques + axe-core CI Tache 4.3.14 |

---

## 13. Variables environnement (cles requises)

```bash
# .env.local pour dev web-broker
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar
NEXT_PUBLIC_TENANT_ID_HEADER=x-tenant-id
NEXT_PUBLIC_TRACE_ID_HEADER=x-trace-id
NEXT_PUBLIC_SENTRY_DSN= # empty en dev pour skip init
NEXT_PUBLIC_FEATURE_FLAGS_URL=
NEXT_PUBLIC_CDN_URL=
NODE_ENV=development
```

En production (Atlas Cloud Services Benguerir) :

```bash
NEXT_PUBLIC_API_URL=https://api.skalean-insurtech.ma
NEXT_PUBLIC_APP_URL=https://broker.skalean-insurtech.ma
NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar
NEXT_PUBLIC_SENTRY_DSN=https://xxx@o123456.ingest.sentry.io/789
NEXT_PUBLIC_CDN_URL=https://cdn.skalean-insurtech.ma
NODE_ENV=production
```

---

## 14. Glossaire (10 termes specifiques)

- **MFA Challenge Token** : JWT court (TTL 5min Sprint 5) emis par backend apres signin password OK pour user MFA-enabled. N'autorise pas l'API ; permet seulement POST `/verify-mfa` avec code TOTP.

- **TOTP** : Time-based One-Time Password (RFC 6238). Algorithme HMAC-SHA1 avec timestep 30s. Code 6 digits.

- **Recovery code** : code 10 chars one-time-use, alternative TOTP en cas perte device. Sprint 5 genere 10 codes au setup MFA.

- **Multi-tenant** : architecture Skalean ou un user peut appartenir a plusieurs tenants (cabinets courtage). Tres rare en pratique (assistante adminstrative pour 2 cabinets) mais supporte.

- **Trust device** : feature MFA permettant de skip TOTP 30j sur un device specifique. Cookie `trust_device_token` Sprint 5 stocke.

- **Access token** : JWT court TTL 15min, contient claims `sub` + `tenant_ids[]` + `role` + `permissions[]`. Signed HS256.

- **Refresh token** : token long TTL 24h (default) ou 30j (remember_me), one-time-use rotation. Family revoke sur theft detection.

- **CNDP** : Commission Nationale de Controle de Protection des Donnees a caractere Personnel (Maroc, equivalent CNIL).

- **ACAPS** : Autorite de Controle des Assurances et de la Prevoyance Sociale (Maroc).

- **Skalean Broker** : marque commerciale de l'app web-broker, portail courtier de la plateforme Skalean InsurTech.

---

## 15. Anti-patterns a eviter (10)

1. **Stocker tokens en localStorage** : XSS = vol total compte. Cookies httpOnly obligatoire.
2. **Hardcoder l'URL backend** : `fetch('http://localhost:4000/...')`. Toujours via env.
3. **Reuser challenge MFA token apres consume** : doit etre cleared sessionStorage des success.
4. **Faire fetch backend client-side direct** : doit passer Route Handler `/api/auth/*` proxy.
5. **Logger tokens dans console.log** : leak via DevTools + Sentry transport.
6. **Disabled button base sur state non synchrone** : utiliser ref + state combine pour eviter race.
7. **Schemas Zod copier-coller backend** : utiliser package partage `@insurtech/auth/schemas` Sprint 5.
8. **Catch error sans Sentry** : silent fail = bug invisible production.
9. **redirect avant set cookies** : NextResponse.json + cookies.set + redirect impossible. Utiliser `redirect()` apres response separee, ou client router.push apres `ok: true` retour.
10. **Form sans noValidate** : double validation HTML5 + Zod conflict, UX casse.

---

## 16. Commandes de validation (resume)

```bash
# Setup dev
cd repo
pnpm install
pnpm --filter @insurtech/web-broker dev

# Tests unitaires Vitest (15+ tests requis)
pnpm --filter @insurtech/web-broker test
pnpm --filter @insurtech/web-broker test:watch

# Tests E2E Playwright (15+ scenarios requis)
cd repo/apps/web-broker
pnpm exec playwright install --with-deps chromium
pnpm exec playwright test --grep auth

# Type check + lint
pnpm --filter @insurtech/web-broker typecheck
pnpm --filter @insurtech/web-broker lint

# Build production
pnpm --filter @insurtech/web-broker build

# Lighthouse audit accessibility
pnpm --filter @insurtech/web-broker lh

# Audits secu cookies
# Manuel : Chrome DevTools > Application > Cookies > verifier flags
# Automatique : `pnpm --filter @insurtech/web-broker test -g cookies`

# Grep no-emoji + no console.log
grep -rn "console.log" repo/apps/web-broker/app/api/auth/ # doit retourner 0
grep -rn "localStorage.*token" repo/apps/web-broker/ # doit retourner 0
bash repo/scripts/check-no-emoji.sh repo/apps/web-broker/
```

---

## 17. Notes finales et passage de relais

### Cette tache 4.3.2 produit

A la livraison de la PR :
- 9 pages auth `/login`, `/verify-mfa`, `/signup`, `/email-sent`, `/forgot-password`, `/reset-password`, `/verify-email`, `/select-tenant`, `/logout`
- 10 Route Handlers `/api/auth/*` (signin, verify-mfa, signup, refresh, forgot-password, reset-password, verify-email, logout, select-tenant, me)
- 5 composants `auth-layout`, `password-strength-indicator`, `mfa-code-input`, `tenant-selector-card`, `submit-button`
- 4 modules lib `auth/schemas`, `auth/cookies`, `auth/api-proxy`, `auth/broadcast`
- 15 tests Vitest unit (schemas + components + cookies)
- 15 tests Playwright E2E (login + MFA + signup + recovery + multi-tenant)
- 50+ cles i18n par locale (fr/ar-MA/ar)

### Limites assumees

- Pas de "Resend verification email" UI (sera Tache 4.3.11 profile page)
- Pas de social login (Google/Apple) -- decision Phase 7+
- Pas de WebAuthn / passkeys (decision Sprint 23 Phase 6)
- Pas de captcha (Sprint 14 ajoutera Cloudflare Turnstile si abuse detecte)
- Trust device feature minimaliste (just checkbox passed to backend, full management Sprint 23)

### Tache suivante 4.3.3 -- Layout principal sidebar + topbar + tenant switcher

Consomme :
- cookie `access_token` (lecture middleware Sprint 4)
- cookie `current_tenant_id` (lecture middleware + injection header `x-tenant-id`)
- Route Handler `/api/auth/me` (fetch user + tenants pour topbar)
- Route Handler `/api/auth/select-tenant` (utilise par `<TenantSwitcher>` topbar)
- composant `<AuthLayout>` PAS reutilise (protected layout different)

Bloque par 4.3.2 :
- topbar tenant switcher utilise meme pattern POST `/api/auth/select-tenant`
- user menu utilise meme pattern POST `/api/auth/logout` + BroadcastChannel
- session expire (access_token TTL 15min) declenche auto-refresh via `/api/auth/refresh`

### Validation finale apres merge

1. Smoke test manuel : `pnpm dev` -> `/fr/login` -> signin demo -> redirect dashboard placeholder Tache 4.3.4
2. Verifier cookies DevTools : 3 cookies httpOnly + SameSite=Lax + Secure(prod) + Path=/
3. Run Lighthouse `pnpm lh` -> accessibility >= 95
4. Run CI complet : typecheck + lint + test + test:e2e + build production

### Decisions ouvertes (a confirmer Sprint 17+)

- Captcha sur signup ? Decision attendue Sprint 14 selon abuse pattern.
- Mot de passe history check (5 derniers) ? Compliance ACAPS demande probablement -- Sprint 14.
- Password manager auto-fill optimisations : `autocomplete=new-password` deja set, verifier 1Password/Bitwarden Sprint 17 customer-portal.

---
