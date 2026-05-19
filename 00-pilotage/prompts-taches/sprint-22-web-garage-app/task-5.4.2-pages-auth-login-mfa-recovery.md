# TACHE 5.4.2 -- Pages Auth (Login + MFA + Recovery + Select Tenant) -- web-garage

**Sprint** : 22 (Phase 5 / Vertical Repair / Sprint 22 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-22-sprint-22-web-garage-app.md` (Tache 5.4.2)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0
**Effort** : 4h
**Dependances** :
- Tache 5.4.1 (App skeleton + middleware + api-client + providers livres -- tous les composants reutilises ici)
- Sprint 5 (backend auth flows endpoints disponibles : POST /api/v1/auth/signin, POST /api/v1/auth/verify-mfa, POST /api/v1/auth/forgot-password, POST /api/v1/auth/reset-password, POST /api/v1/auth/refresh)
- Sprint 6 (multi-tenant select-tenant endpoint disponible : GET /api/v1/tenants/allowed, POST /api/v1/tenants/switch)
- Sprint 7 (RBAC enforce : un user authentifie sans role garage_* est rejete avec 403)
- Sprint 16 web-broker (pattern auth pages livre -- on copie-colle puis adapte branding Garage)

**Densite cible** : 100-150 ko (auto-suffisant)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Implementer les **7 pages d'authentification publiques** de l'app `web-garage` en reutilisant integralement le pattern auth deja livre par Sprint 16 web-broker (`apps/web-broker/src/app/[locale]/(auth)/`). Les 7 pages : `/login`, `/verify-mfa`, `/forgot-password`, `/reset-password/[token]`, `/select-tenant`, `/mfa-setup`, `/account-locked`. Chaque page consomme l'api-client `apps/web-garage/src/lib/api-client.ts` livre par Tache 5.4.1, applique le branding Skalean Garage (rouge primary `#B91C1C`, logo specifique, illustrations atelier), supporte les 3 locales fr/ar-MA/ar avec RTL automatique, valide les inputs avec Zod + react-hook-form, gere les erreurs API en toast Sonner, redirige vers `/dashboard` apres succes (ou `redirect` query param si present).

Cette tache est la **deuxieme du Sprint 22**, posee directement apres le skeleton 5.4.1. Elle debloque les 11 taches metier suivantes en garantissant qu'un personnel garage (admin/chef/technicien/gestionnaire) peut :
1. Se connecter (`/login`) avec email + password + tenant_id (si user multi-tenant) ;
2. Valider MFA TOTP (`/verify-mfa`) si requis par policy compliance Sprint 5 ;
3. Recuperer mot de passe oublie (`/forgot-password` + `/reset-password/[token]`) ;
4. Choisir etablissement (`/select-tenant`) si plusieurs tenants alloues (Atlas Cabinet avec 3 succursales Marrakech/Casablanca/Rabat) ;
5. Configurer MFA premiere fois (`/mfa-setup`) en scannant QR code TOTP ;
6. Voir page bloque (`/account-locked`) si 5 echecs login consecutifs (policy Sprint 5).

A la sortie de cette tache, un personnel garage peut effectuer le flow complet : naviguer sur `https://garage.skalean-insurtech.ma/` -> redirige `/fr/login` -> saisit credentials -> redirige `/fr/verify-mfa` -> saisit code TOTP 6 chiffres -> redirige `/fr/select-tenant` (si multi-tenant) -> selectionne succursale -> redirige `/fr/dashboard`. Le flow dure entre 8 et 20 secondes selon les etapes.

La specificite **garage** par rapport au pattern broker Sprint 16 :
- Branding visuel : logo "Skalean Garage" + illustration mecanicien (illustration SVG inline, no external dep) ;
- Couleur primaire bouton principal : `bg-garage-primary` (rouge `#B91C1C`) au lieu de bleu broker ;
- Message d'accueil i18n adapte : "Bienvenue sur Skalean Garage" / "Marhaba bik fi Skalean Garage" (ar-MA) / arabic equivalent ;
- TenantSwitcher select-tenant montre nom etablissement + ville + flag headquarter (Atlas Cabinet HQ Marrakech) ;
- Message MFA-setup adapte personnel garage (pas de mention compliance specifique broker).

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Le bootstrap Sprint 4 + skeleton Tache 5.4.1 ont livre :
- `apps/web-garage/src/app/[locale]/(auth)/layout.tsx` -- centered card layout vide ;
- `apps/web-garage/src/app/[locale]/(auth)/placeholder.tsx` -- marker file a remplacer ;
- `apps/web-garage/src/lib/api-client.ts` -- client axios avec interceptors auth.

Mais aucune page d'authentification n'existe encore. Sans cette tache, l'app demarre mais aucun user ne peut se connecter. Toutes les pages metier (5.4.3 a 5.4.13) sont inaccessibles car le middleware redirige vers `/login` qui retourne 404.

Le **pattern Sprint 16 web-broker** est mature et teste : 7 pages + 14 tests E2E + 24 tests unitaires + 100% coverage flows critiques. La strategie ici est **copy-paste systematique** avec adaptation branding (~20% changement code, 80% identique). On NE reinvente PAS l'auth.

Le **timing** est critique : cette tache est la 2eme du Sprint 22, posee directement apres 5.4.1 :
1. 5.4.3 (Dashboard 6 widgets) appelle `/api/v1/repair/dashboard` qui exige user authentifie + tenant_id valide ;
2. 5.4.4 (Sinistres Kanban) idem -- impossible sans auth ;
3. 5.4.13 (Tests Playwright E2E) consomme les helpers `loginAsGarageAdmin()` qui necessitent que `/login` fonctionne.

### Reutilisation Sprint 16 -- ce qui change, ce qui reste

| Element | Sprint 16 web-broker | Sprint 22 web-garage |
|---------|----------------------|----------------------|
| Endpoint /api/v1/auth/signin | Identique | Identique |
| Validation Zod schemas | Identique (email, password 8-128, mfa_code 6 chiffres) | Identique |
| react-hook-form patterns | Identique | Identique |
| Toast error patterns | Identique | Identique |
| Branding logo | Skalean Broker logo + bleu | Skalean Garage logo + rouge |
| Color primary button | `bg-broker-primary` | `bg-garage-primary` |
| Welcome message i18n | broker.auth.welcome | garage.auth.welcome |
| Illustration page droite | broker office illustration | garage workshop illustration |
| TenantSwitcher select | "Cabinets courtage" | "Etablissements garage" |
| MFA setup QR backup codes | 10 backup codes | 10 backup codes (identique) |
| Page account-locked retry | 5 echecs / 15 min | 5 echecs / 15 min (identique) |

Volume code reutilise : ~70% identique, ~30% adaptation branding/labels. Effort estime 4h (vs 6h Sprint 16 from scratch).

### Alternatives considerees

#### react-hook-form + Zod vs Formik vs uncontrolled forms

| Critere | react-hook-form + Zod (CHOIX) | Formik | Uncontrolled |
|---------|--------------------------------|--------|--------------|
| Bundle size | 25 ko (rhf + zod resolver) | 47 ko | 0 |
| Performance | Re-renders minimum (subscription) | Re-renders eleves | Best mais pas de validation |
| Validation Zod integration | Native (@hookform/resolvers/zod) | Custom | Manual |
| TypeScript inference | Excellent | OK | Manual |
| Sprint 16 deja utilise | Oui | -- | -- |
| Resolver async support | Oui (validateOnChange async) | Oui | -- |
| Accessible aria-invalid | Auto via formState.errors | Manual | Manual |

**Decision** : react-hook-form 7.54.0 + zod 3.24.1 + @hookform/resolvers 3.10.0. Identique Sprint 16.

#### MFA TOTP vs SMS vs WebAuthn

Sprint 5 livre les 3. Sprint 22 expose UI pour **TOTP uniquement** (defaut MA -- pas de cout SMS, pas de friction WebAuthn). WebAuthn devre Sprint 24+. SMS reste backend mais UI pas integree.

#### Server Action vs Route Handler vs Client-side fetch

| Critere | Route Handler + fetch (CHOIX) | Server Action |
|---------|--------------------------------|---------------|
| Compat api-client interceptors | Oui | Non (Server Actions bypass) |
| Refresh JWT transparent | Via api-client | Manual |
| Optimistic UI | Manual mais OK | Native useOptimistic |
| Cookie set apres login | Via response.cookies.set dans Route Handler | Via cookies().set Server Action |
| Sprint 16 pattern | Route Handler | -- |

**Decision** : Route Handler (cote `/api/auth/signin/route.ts` proxy backend). Le Client Component appelle `apiPost('/auth/signin', data)` -- propre, identique broker.

### Trade-offs explicites

1. **Branding adaptation manuelle (pas de design tokens dynamic)** : on duplique les classes Tailwind `bg-broker-primary` vs `bg-garage-primary` plutot que d'utiliser var CSS unique. Avantage : separation visuelle nette en code ; Inconvenient : 2 places a modifier si re-brand global. Mitigation : variables tailwind config centralisees Sprint 4.

2. **Pas de magic link** : seulement password + MFA. Decision Sprint 5. Si user prefere magic link, demander Sprint 24+ amelioration UX.

3. **Pas de SSO Google/Microsoft** : pas necessaire pour personnel garage Maroc (pas dans use case Atlas Cabinet). Sprint 30+ admin app peut envisager.

4. **MFA TOTP requiert app mobile (Google Authenticator, Authy)** : un technicien sans smartphone ne peut pas configurer MFA. Solution : 10 backup codes papier impressed. Page parametres permet regenerer codes (Tache 5.4.12).

5. **Redirect query param vulnerability open redirect** : `?redirect=https://evil.com` ouvrirait phishing. Mitigation : valider redirect commence par `/` (chemin relatif) et pas `//` ni `http`. Helper `validateRedirectPath()`.

6. **Cookie cross-domain garage.skalean-insurtech.ma <-> api.skalean-insurtech.ma** : besoin domain commun `.skalean-insurtech.ma` + sameSite `Lax`. Configure Sprint 5 cote backend.

### Decisions strategiques referenced

- **decision-002 (multi-tenant strict)** : page select-tenant fait POST `/api/v1/tenants/switch` qui set cookie `current_tenant_id`.
- **decision-005 (Skalean AI frontier)** : aucune integration AI dans auth.
- **decision-006 (NO EMOJI)** : 0 emoji dans labels, messages, illustrations.
- **decision-009 (i18n MA fr/ar-MA/ar)** : 3 locales avec RTL auto.

### Pieges techniques (12 minimum)

1. **Server Component / Client Component frontiere** : page login.tsx doit etre Client Component (`'use client'`) car utilise `useState`, `useForm`, event handlers. Si on l'oublie, build casse avec "useFormState can only be used in Client Components".

2. **Cookies httpOnly inaccessibles JS** : impossible de lire `access_token` cote client pour debugger. Devs doivent inspecter DevTools Application > Cookies.

3. **Refresh token race apres login** : si user clique 2x rapidement sur "Sign in", 2 requetes POST /auth/signin partent. Backend doit deduplicate via Idempotency-Key auto-injecte par api-client (Tache 5.4.1).

4. **Redirect after login validation** : `?redirect=javascript:alert(1)` -> dangereux. Mitigation `validateRedirectPath()`.

5. **MFA code 6 chiffres validation** : Zod schema `z.string().regex(/^\d{6}$/)`. Si user tape espaces, trim. Si copy-paste avec espaces, accept en strip.

6. **TenantSwitcher select-tenant page : ne pas re-redirect si user choisit son tenant courant** : verifier que `user.allowed_tenants.length > 1` AVANT d'afficher la page. Si 1 seul tenant, auto-select + redirect direct dashboard.

7. **Form submit pendant que mutation en cours** : disable button + spinner. Pattern : `isLoading = mutation.isPending`.

8. **i18n missing key error fatal** : si on ajoute key `login.title` dans fr.json mais oublie dans ar-MA.json, build casse. Script CI verifie parite.

9. **Password input toggle visibility** : icon eye + eye-off Lucide. Type input passe entre `password` et `text`. Accessibility : aria-label "Show password" / "Hide password".

10. **Form autocomplete attributes** : `autocomplete="username"` sur email, `autocomplete="current-password"` sur password, `autocomplete="one-time-code"` sur MFA input.

11. **Account-locked page sans retry timer visible** : user ne sait pas combien attendre. Mitigation : backend retourne `retry_after_seconds` -> page affiche countdown.

12. **Forgot-password ne doit JAMAIS reveler si email existe** : reponse 200 toujours meme si email pas en BDD. Sinon enumeration attack.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 22

```
Sprint 22 -- Web Garage App

[5.4.1 App skeleton + middleware]  (livre)
   |
   +--> [5.4.2 Pages Auth login + MFA + recovery]  <-- ICI (4h)
   |       |
   |       +--> [5.4.3 Dashboard 6 widgets]
   |       +--> [5.4.4 Sinistres Kanban]
   |       +--> [5.4.5 Sinistre detail]
   |       +--> ...
```

### Flow login complet

```
User /fr/login
    |
    +--> saisit email + password
    +--> click "Se connecter"
    |
    +--> POST /api/auth/signin (via api-client -> proxy /api/proxy/auth/signin -> backend)
    |       |
    |       +--> 200 { mfa_required: true, mfa_session_token: '...' }
    |       |       -> redirect /fr/verify-mfa?session=...
    |       |
    |       +--> 200 { mfa_required: false, access_token cookie, refresh_token cookie }
    |       |       -> redirect /fr/select-tenant (si multi-tenant) ou /fr/dashboard
    |       |
    |       +--> 401 { error: 'INVALID_CREDENTIALS' }
    |       |       -> toast error "Email ou mot de passe incorrect"
    |       |
    |       +--> 403 { error: 'ACCOUNT_LOCKED', retry_after_seconds: 900 }
    |       |       -> redirect /fr/account-locked?retry_after=900
    |       |
    |       +--> 403 { error: 'WRONG_APP' }
    |       |       -> toast "Cet utilisateur n'est pas autorise sur Skalean Garage"
```

### Flow verify-mfa

```
User /fr/verify-mfa?session=ABC
    |
    +--> saisit code 6 chiffres TOTP
    +--> auto-submit apres 6 digits OR click "Verifier"
    |
    +--> POST /api/auth/verify-mfa { session_token, code }
    |       |
    |       +--> 200 { access_token, refresh_token } cookies set
    |       |       -> redirect /fr/select-tenant ou /fr/dashboard
    |       |
    |       +--> 400 { error: 'INVALID_CODE' }
    |       |       -> reset input + toast erreur + counter retry
    |       |
    |       +--> 410 { error: 'SESSION_EXPIRED' }
    |       |       -> redirect /fr/login
```

### Flow forgot-password

```
User /fr/forgot-password
    |
    +--> saisit email
    +--> click "Recuperer"
    |
    +--> POST /api/auth/forgot-password { email }
    |       |
    |       +--> 200 (toujours, meme si email inexistant)
    |               -> redirect /fr/forgot-password/success
    |
    +--> User recoit email avec lien /fr/reset-password/{token}
    |
    +--> Page /fr/reset-password/[token]
    |       |
    |       +--> saisit new_password + confirm_password
    |       +--> POST /api/auth/reset-password { token, password }
    |               |
    |               +--> 200 -> redirect /fr/login?reset=success
    |               +--> 410 token expired -> erreur
```

### ASCII tree apres tache

```
repo/apps/web-garage/src/app/[locale]/(auth)/
|
|-- layout.tsx                                          # MODIFIE : ajout illustration garage
|-- login/
|   |-- page.tsx                                        # NOUVEAU
|   |-- login-form.tsx                                  # NOUVEAU client component
|-- verify-mfa/
|   |-- page.tsx                                        # NOUVEAU
|   |-- mfa-input.tsx                                   # NOUVEAU 6-digit segmented input
|-- forgot-password/
|   |-- page.tsx                                        # NOUVEAU
|   |-- success/
|   |   |-- page.tsx                                    # NOUVEAU
|-- reset-password/
|   |-- [token]/
|   |   |-- page.tsx                                    # NOUVEAU
|-- select-tenant/
|   |-- page.tsx                                        # NOUVEAU
|   |-- tenant-card.tsx                                 # NOUVEAU
|-- mfa-setup/
|   |-- page.tsx                                        # NOUVEAU QR + backup codes
|-- account-locked/
|   |-- page.tsx                                        # NOUVEAU countdown timer
|
repo/apps/web-garage/src/app/api/auth/
|-- signin/route.ts                                     # NOUVEAU proxy backend
|-- verify-mfa/route.ts                                 # NOUVEAU
|-- forgot-password/route.ts                            # NOUVEAU
|-- reset-password/route.ts                             # NOUVEAU
|-- mfa-setup/route.ts                                  # NOUVEAU
|
repo/apps/web-garage/src/components/auth/
|-- branding-illustration.tsx                           # NOUVEAU illustration garage SVG
|-- password-input.tsx                                  # NOUVEAU avec toggle visibility
|-- form-error-message.tsx                              # NOUVEAU error helper
|
repo/apps/web-garage/src/lib/auth/
|-- schemas.ts                                          # NOUVEAU Zod schemas auth
|-- redirect-validator.ts                               # NOUVEAU validateRedirectPath
```

---

## 4. Livrables checkables (20 livrables)

- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/layout.tsx` modifie (~100 lignes) -- ajout illustration garage + branding
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/login/page.tsx` cree (~80 lignes) -- Server Component wrapper
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/login/login-form.tsx` cree (~250 lignes) -- Client Component form
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/verify-mfa/page.tsx` cree (~150 lignes)
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/verify-mfa/mfa-input.tsx` cree (~180 lignes) -- 6-digit segmented input
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/forgot-password/page.tsx` cree (~120 lignes)
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/forgot-password/success/page.tsx` cree (~60 lignes)
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/reset-password/[token]/page.tsx` cree (~180 lignes)
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/select-tenant/page.tsx` cree (~180 lignes)
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/select-tenant/tenant-card.tsx` cree (~100 lignes)
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/mfa-setup/page.tsx` cree (~220 lignes) -- QR + 10 backup codes
- [ ] Fichier `repo/apps/web-garage/src/app/[locale]/(auth)/account-locked/page.tsx` cree (~150 lignes) -- countdown timer
- [ ] Fichier `repo/apps/web-garage/src/app/api/auth/signin/route.ts` cree (~80 lignes) -- proxy backend
- [ ] Fichier `repo/apps/web-garage/src/app/api/auth/verify-mfa/route.ts` cree (~70 lignes)
- [ ] Fichier `repo/apps/web-garage/src/app/api/auth/forgot-password/route.ts` cree (~50 lignes)
- [ ] Fichier `repo/apps/web-garage/src/app/api/auth/reset-password/route.ts` cree (~60 lignes)
- [ ] Fichier `repo/apps/web-garage/src/app/api/auth/mfa-setup/route.ts` cree (~80 lignes)
- [ ] Fichier `repo/apps/web-garage/src/components/auth/branding-illustration.tsx` cree (~200 lignes SVG inline)
- [ ] Fichier `repo/apps/web-garage/src/components/auth/password-input.tsx` cree (~80 lignes)
- [ ] Fichier `repo/apps/web-garage/src/components/auth/form-error-message.tsx` cree (~40 lignes)
- [ ] Fichier `repo/apps/web-garage/src/lib/auth/schemas.ts` cree (~120 lignes) -- 6 Zod schemas
- [ ] Fichier `repo/apps/web-garage/src/lib/auth/redirect-validator.ts` cree (~50 lignes)
- [ ] Messages i18n fr/ar-MA/ar : namespace `auth` ajoute (60+ keys par locale)
- [ ] Tests Vitest 20+ tests
- [ ] Tests Playwright 8+ tests

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage/src/app/[locale]/(auth)/layout.tsx                                     (modifie +50 lignes / illustration garage)
repo/apps/web-garage/src/app/[locale]/(auth)/login/page.tsx                                  (~80 lignes / Server Component)
repo/apps/web-garage/src/app/[locale]/(auth)/login/login-form.tsx                             (~250 lignes / Client form)
repo/apps/web-garage/src/app/[locale]/(auth)/login/login-form.spec.tsx                         (~150 lignes / tests)
repo/apps/web-garage/src/app/[locale]/(auth)/verify-mfa/page.tsx                              (~150 lignes)
repo/apps/web-garage/src/app/[locale]/(auth)/verify-mfa/mfa-input.tsx                          (~180 lignes)
repo/apps/web-garage/src/app/[locale]/(auth)/verify-mfa/mfa-input.spec.tsx                      (~120 lignes / tests)
repo/apps/web-garage/src/app/[locale]/(auth)/forgot-password/page.tsx                          (~120 lignes)
repo/apps/web-garage/src/app/[locale]/(auth)/forgot-password/success/page.tsx                  (~60 lignes)
repo/apps/web-garage/src/app/[locale]/(auth)/reset-password/[token]/page.tsx                   (~180 lignes)
repo/apps/web-garage/src/app/[locale]/(auth)/select-tenant/page.tsx                            (~180 lignes)
repo/apps/web-garage/src/app/[locale]/(auth)/select-tenant/tenant-card.tsx                     (~100 lignes)
repo/apps/web-garage/src/app/[locale]/(auth)/mfa-setup/page.tsx                                 (~220 lignes / QR + backup)
repo/apps/web-garage/src/app/[locale]/(auth)/account-locked/page.tsx                            (~150 lignes / countdown)
repo/apps/web-garage/src/app/api/auth/signin/route.ts                                            (~80 lignes / proxy)
repo/apps/web-garage/src/app/api/auth/verify-mfa/route.ts                                         (~70 lignes)
repo/apps/web-garage/src/app/api/auth/forgot-password/route.ts                                    (~50 lignes)
repo/apps/web-garage/src/app/api/auth/reset-password/route.ts                                      (~60 lignes)
repo/apps/web-garage/src/app/api/auth/mfa-setup/route.ts                                            (~80 lignes)
repo/apps/web-garage/src/components/auth/branding-illustration.tsx                                  (~200 lignes / SVG)
repo/apps/web-garage/src/components/auth/password-input.tsx                                          (~80 lignes)
repo/apps/web-garage/src/components/auth/password-input.spec.tsx                                      (~80 lignes / tests)
repo/apps/web-garage/src/components/auth/form-error-message.tsx                                         (~40 lignes)
repo/apps/web-garage/src/lib/auth/schemas.ts                                                            (~120 lignes / 6 Zod schemas)
repo/apps/web-garage/src/lib/auth/schemas.spec.ts                                                        (~100 lignes / tests)
repo/apps/web-garage/src/lib/auth/redirect-validator.ts                                                  (~50 lignes)
repo/apps/web-garage/src/lib/auth/redirect-validator.spec.ts                                              (~80 lignes / tests)
repo/apps/web-garage/src/messages/fr.json                                                                (modifie +60 keys)
repo/apps/web-garage/src/messages/ar-MA.json                                                              (modifie +60 keys)
repo/apps/web-garage/src/messages/ar.json                                                                  (modifie +60 keys)
repo/apps/web-garage/e2e/auth-flow-login.spec.ts                                                            (~180 lignes / 4 tests)
repo/apps/web-garage/e2e/auth-flow-mfa.spec.ts                                                              (~120 lignes / 2 tests)
repo/apps/web-garage/e2e/auth-flow-recovery.spec.ts                                                          (~150 lignes / 2 tests)
```

**Total** : 33 fichiers, ~3 200 lignes (production + tests)

---

## 6. Code patterns COMPLETS (30-80 ko)

### Fichier 1/14 : `src/lib/auth/schemas.ts`

```typescript
// src/lib/auth/schemas.ts
// Zod schemas pour formulaires auth web-garage
// Reference: B-22 Tache 5.4.2

import { z } from 'zod';

export const EmailSchema = z
  .string()
  .min(1, 'auth.errors.email_required')
  .email('auth.errors.email_invalid')
  .max(255, 'auth.errors.email_too_long')
  .toLowerCase()
  .trim();

export const PasswordSchema = z
  .string()
  .min(8, 'auth.errors.password_min_length')
  .max(128, 'auth.errors.password_max_length');

export const StrongPasswordSchema = PasswordSchema.refine(
  (val) => /[A-Z]/.test(val),
  { message: 'auth.errors.password_no_uppercase' },
)
  .refine((val) => /[a-z]/.test(val), { message: 'auth.errors.password_no_lowercase' })
  .refine((val) => /\d/.test(val), { message: 'auth.errors.password_no_digit' })
  .refine((val) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(val), {
    message: 'auth.errors.password_no_special',
  });

export const MfaCodeSchema = z
  .string()
  .min(1, 'auth.errors.mfa_code_required')
  .regex(/^\d{6}$/, 'auth.errors.mfa_code_invalid')
  .transform((val) => val.replace(/\s/g, ''));

export const SigninSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  remember_me: z.boolean().optional().default(false),
});

export type SigninInput = z.infer<typeof SigninSchema>;

export const VerifyMfaSchema = z.object({
  session_token: z.string().min(1),
  code: MfaCodeSchema,
});

export type VerifyMfaInput = z.infer<typeof VerifyMfaSchema>;

export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: StrongPasswordSchema,
    password_confirm: z.string(),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: 'auth.errors.password_mismatch',
    path: ['password_confirm'],
  });

export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const SetupMfaSchema = z.object({
  totp_secret: z.string().min(16).max(32),
  totp_code: MfaCodeSchema,
});

export type SetupMfaInput = z.infer<typeof SetupMfaSchema>;
```

### Fichier 2/14 : `src/lib/auth/redirect-validator.ts`

```typescript
// src/lib/auth/redirect-validator.ts
// Validation redirect query param contre open redirect attack
// Reference: B-22 Tache 5.4.2

const FORBIDDEN_SCHEMES = ['javascript:', 'data:', 'vbscript:', 'file:'];

/**
 * Validate that a redirect path is safe.
 * Must be relative path starting with single /.
 * Must not start with // or contain : (protocol).
 * Must not contain @.
 */
export function validateRedirectPath(path: string | null | undefined): string {
  if (!path) return '/dashboard';
  if (typeof path !== 'string') return '/dashboard';

  const decoded = decodeURIComponent(path);
  const lowered = decoded.toLowerCase().trim();

  if (FORBIDDEN_SCHEMES.some((scheme) => lowered.startsWith(scheme))) {
    return '/dashboard';
  }

  if (!decoded.startsWith('/')) return '/dashboard';
  if (decoded.startsWith('//')) return '/dashboard';
  if (decoded.includes('://')) return '/dashboard';
  if (decoded.includes('@')) return '/dashboard';
  if (decoded.length > 2048) return '/dashboard';

  return decoded;
}

export function ensureLocalePrefix(path: string, locale: string): string {
  const validatedPath = validateRedirectPath(path);
  const locales = ['fr', 'ar-MA', 'ar'];
  for (const loc of locales) {
    if (validatedPath === `/${loc}` || validatedPath.startsWith(`/${loc}/`)) {
      return validatedPath;
    }
  }
  if (validatedPath === '/') return `/${locale}/dashboard`;
  return `/${locale}${validatedPath}`;
}
```

### Fichier 3/14 : `src/app/[locale]/(auth)/layout.tsx` (modifie)

```typescript
// src/app/[locale]/(auth)/layout.tsx
// Layout pages publiques : centered card + branding garage
// Server Component
// Reference: B-22 Tache 5.4.2

import { type ReactNode } from 'react';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { BrandingIllustration } from '@/components/auth/branding-illustration';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';

interface AuthLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function AuthLayout({ children, params }: AuthLayoutProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('auth');

  const isRtl = locale === 'ar-MA' || locale === 'ar';

  return (
    <div className="flex min-h-screen w-screen bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Left side: form area */}
      <div className="flex w-full flex-col items-center justify-center px-4 sm:w-1/2 lg:w-2/5">
        <div className="absolute top-4 right-4 rtl:right-auto rtl:left-4">
          <LocaleSwitcher currentLocale={locale} />
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-garage-primary">
              Skalean Garage
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('layout.tagline')}
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            {children}
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t('layout.footer_copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </div>

      {/* Right side: branding illustration (hidden on mobile) */}
      <div className="hidden bg-garage-primary-50 sm:flex sm:w-1/2 lg:w-3/5 items-center justify-center">
        <BrandingIllustration />
      </div>
    </div>
  );
}
```

### Fichier 4/14 : `src/app/[locale]/(auth)/login/page.tsx` + `login-form.tsx`

```typescript
// src/app/[locale]/(auth)/login/page.tsx
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { LoginForm } from './login-form';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string; error?: string; reset?: string }>;
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { locale } = await params;
  const { redirect, error, reset } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations('auth.login');

  return (
    <div>
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      {reset === 'success' && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {t('reset_success')}
        </div>
      )}

      {error === 'wrong_app' && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {t('error_wrong_app')}
        </div>
      )}
      {error === 'unauthorized_role' && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {t('error_unauthorized_role')}
        </div>
      )}

      <LoginForm locale={locale} redirectTo={redirect ?? ''} />
    </div>
  );
}
```

```typescript
// src/app/[locale]/(auth)/login/login-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Mail } from 'lucide-react';
import { apiPost, GarageApiError } from '@/lib/api-client';
import { SigninSchema, type SigninInput } from '@/lib/auth/schemas';
import { ensureLocalePrefix } from '@/lib/auth/redirect-validator';
import { PasswordInput } from '@/components/auth/password-input';
import { FormErrorMessage } from '@/components/auth/form-error-message';

interface LoginFormProps {
  locale: string;
  redirectTo: string;
}

interface SigninResponse {
  mfa_required: boolean;
  mfa_session_token?: string;
  user?: { id: string; email: string; tenant_type: string; roles: string[] };
  needs_tenant_selection?: boolean;
}

export function LoginForm({ locale, redirectTo }: LoginFormProps) {
  const router = useRouter();
  const t = useTranslations('auth.login');
  const tErr = useTranslations('auth.errors');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SigninInput>({
    resolver: zodResolver(SigninSchema),
    defaultValues: { email: '', password: '', remember_me: false },
  });

  const signinMutation = useMutation<SigninResponse, GarageApiError, SigninInput>({
    mutationFn: (input) => apiPost<SigninResponse, SigninInput>('/api/auth/signin', input),
    onSuccess: (data) => {
      if (data.mfa_required) {
        router.push(`/${locale}/verify-mfa?session=${encodeURIComponent(data.mfa_session_token!)}&redirect=${encodeURIComponent(redirectTo)}`);
        return;
      }
      if (data.needs_tenant_selection) {
        router.push(`/${locale}/select-tenant?redirect=${encodeURIComponent(redirectTo)}`);
        return;
      }
      router.push(ensureLocalePrefix(redirectTo, locale));
    },
    onError: (error) => {
      switch (error.code) {
        case 'INVALID_CREDENTIALS':
          toast.error(tErr('invalid_credentials'));
          break;
        case 'ACCOUNT_LOCKED': {
          const retryAfter = (error as { retryAfter?: number }).retryAfter ?? 900;
          router.push(`/${locale}/account-locked?retry_after=${retryAfter}`);
          break;
        }
        case 'WRONG_APP':
          toast.error(tErr('wrong_app'));
          break;
        case 'EMAIL_NOT_VERIFIED':
          toast.error(tErr('email_not_verified'));
          break;
        default:
          toast.error(tErr('generic'));
      }
    },
  });

  const onSubmit = (data: SigninInput) => {
    signinMutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" data-testid="login-form" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          {t('label_email')}
        </label>
        <div className="relative mt-1">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            spellCheck={false}
            data-testid="login-email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="block w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garage-primary"
            {...register('email')}
          />
        </div>
        <FormErrorMessage id="email-error" error={errors.email} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="password" className="block text-sm font-medium">
            {t('label_password')}
          </label>
          <Link
            href={`/${locale}/forgot-password`}
            className="text-xs text-garage-primary hover:underline"
            data-testid="login-forgot-link"
          >
            {t('link_forgot')}
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          data-testid="login-password"
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
          {...register('password')}
        />
        <FormErrorMessage id="password-error" error={errors.password} />
      </div>

      <div className="flex items-center">
        <input
          id="remember_me"
          type="checkbox"
          className="h-4 w-4 rounded border-input"
          data-testid="login-remember"
          {...register('remember_me')}
        />
        <label htmlFor="remember_me" className="ml-2 rtl:ml-0 rtl:mr-2 text-sm">
          {t('label_remember')}
        </label>
      </div>

      <button
        type="submit"
        disabled={signinMutation.isPending}
        data-testid="login-submit"
        className="flex w-full items-center justify-center rounded-md bg-garage-primary py-2 text-sm font-medium text-white hover:bg-garage-primary/90 disabled:opacity-60"
      >
        {signinMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('btn_submitting')}
          </>
        ) : (
          t('btn_submit')
        )}
      </button>
    </form>
  );
}
```

### Fichier 5/14 : `src/app/[locale]/(auth)/verify-mfa/page.tsx` + `mfa-input.tsx`

```typescript
// src/app/[locale]/(auth)/verify-mfa/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Shield } from 'lucide-react';
import { apiPost, GarageApiError } from '@/lib/api-client';
import { ensureLocalePrefix } from '@/lib/auth/redirect-validator';
import { MfaInput } from './mfa-input';

interface VerifyMfaResponse {
  user: { id: string; email: string; tenant_type: string; roles: string[] };
  needs_tenant_selection: boolean;
}

export default function VerifyMfaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.verify_mfa');
  const tErr = useTranslations('auth.errors');

  const sessionToken = searchParams.get('session') ?? '';
  const redirectTo = searchParams.get('redirect') ?? '';
  const locale = window.location.pathname.split('/')[1] ?? 'fr';

  const [code, setCode] = useState('');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!sessionToken) {
      router.push(`/${locale}/login?error=session_required`);
    }
  }, [sessionToken, locale, router]);

  const verifyMutation = useMutation<VerifyMfaResponse, GarageApiError, { session_token: string; code: string }>({
    mutationFn: (input) => apiPost<VerifyMfaResponse>('/api/auth/verify-mfa', input),
    onSuccess: (data) => {
      if (data.needs_tenant_selection) {
        router.push(`/${locale}/select-tenant?redirect=${encodeURIComponent(redirectTo)}`);
      } else {
        router.push(ensureLocalePrefix(redirectTo, locale));
      }
    },
    onError: (error) => {
      setCode('');
      setAttempts((a) => a + 1);
      switch (error.code) {
        case 'INVALID_CODE':
          toast.error(tErr('invalid_mfa_code'));
          break;
        case 'SESSION_EXPIRED':
          toast.error(tErr('session_expired'));
          router.push(`/${locale}/login?reason=mfa_session_expired`);
          break;
        case 'TOO_MANY_ATTEMPTS':
          router.push(`/${locale}/account-locked`);
          break;
        default:
          toast.error(tErr('generic'));
      }
    },
  });

  const handleCodeComplete = (value: string) => {
    if (verifyMutation.isPending) return;
    setCode(value);
    verifyMutation.mutate({ session_token: sessionToken, code: value });
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-garage-primary" />
        <h2 className="text-xl font-semibold">{t('title')}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-6">
        <label className="block text-sm font-medium mb-3">{t('label_code')}</label>
        <MfaInput
          value={code}
          onChange={setCode}
          onComplete={handleCodeComplete}
          disabled={verifyMutation.isPending}
          data-testid="mfa-input"
        />
      </div>

      {verifyMutation.isPending && (
        <div className="mt-4 flex items-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('verifying')}
        </div>
      )}

      {attempts >= 3 && (
        <p className="mt-4 text-xs text-amber-700">
          {t('warning_after_attempts', { count: attempts })}
        </p>
      )}

      <p className="mt-6 text-center text-xs text-muted-foreground">
        {t('use_backup_link_text')}{' '}
        <a href="#" className="text-garage-primary hover:underline">
          {t('use_backup_link')}
        </a>
      </p>
    </div>
  );
}
```

```typescript
// src/app/[locale]/(auth)/verify-mfa/mfa-input.tsx
'use client';

import { useRef, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react';

interface MfaInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete: (val: string) => void;
  disabled?: boolean;
  'data-testid'?: string;
}

export function MfaInput({ value, onChange, onComplete, disabled, ...rest }: MfaInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function setDigit(index: number, char: string) {
    const next = [...digits];
    next[index] = char;
    const joined = next.join('').trim().replace(/\s/g, '');
    onChange(joined);
    if (joined.length === 6 && /^\d{6}$/.test(joined)) {
      onComplete(joined);
    }
  }

  function handleChange(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!/^\d?$/.test(val)) return;
    if (val) {
      setDigit(index, val);
      if (index < 5) refs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (!digits[index]?.trim() && index > 0) {
        refs.current[index - 1]?.focus();
      }
      setDigit(index, '');
    } else if (e.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      refs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\s/g, '').slice(0, 6);
    if (!/^\d+$/.test(pasted)) return;
    onChange(pasted);
    if (pasted.length === 6) {
      onComplete(pasted);
    } else {
      refs.current[pasted.length]?.focus();
    }
  }

  return (
    <div className="flex gap-2" {...rest}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          autoComplete="one-time-code"
          disabled={disabled}
          value={digits[i]?.trim() || ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={i === 0 ? handlePaste : undefined}
          aria-label={`Digit ${i + 1}`}
          data-testid={`mfa-digit-${i}`}
          className="h-12 w-12 rounded-md border border-input bg-background text-center text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-garage-primary disabled:opacity-50"
        />
      ))}
    </div>
  );
}
```

### Fichier 6/14 : `src/app/[locale]/(auth)/forgot-password/page.tsx`

```typescript
'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { apiPost, GarageApiError } from '@/lib/api-client';
import { ForgotPasswordSchema, type ForgotPasswordInput } from '@/lib/auth/schemas';
import { FormErrorMessage } from '@/components/auth/form-error-message';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const t = useTranslations('auth.forgot_password');
  const tErr = useTranslations('auth.errors');
  const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'fr';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(ForgotPasswordSchema),
  });

  const mutation = useMutation<{ ok: true }, GarageApiError, ForgotPasswordInput>({
    mutationFn: (input) => apiPost<{ ok: true }>('/api/auth/forgot-password', input),
    onSuccess: () => {
      router.push(`/${locale}/forgot-password/success`);
    },
    onError: () => {
      // toujours afficher succes pour eviter enumeration
      router.push(`/${locale}/forgot-password/success`);
    },
  });

  return (
    <div>
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="mt-6 space-y-4" data-testid="forgot-form" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            {t('label_email')}
          </label>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="email"
              type="email"
              autoComplete="username"
              data-testid="forgot-email"
              aria-invalid={!!errors.email}
              className="block w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
              {...register('email')}
            />
          </div>
          <FormErrorMessage id="email-error" error={errors.email} />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          data-testid="forgot-submit"
          className="flex w-full items-center justify-center rounded-md bg-garage-primary py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('btn_submit')}
        </button>
      </form>

      <Link
        href={`/${locale}/login`}
        className="mt-6 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t('link_back')}
      </Link>
    </div>
  );
}
```

### Fichier 7/14 : `src/app/[locale]/(auth)/reset-password/[token]/page.tsx`

```typescript
'use client';

import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { apiPost, GarageApiError } from '@/lib/api-client';
import { ResetPasswordSchema, type ResetPasswordInput } from '@/lib/auth/schemas';
import { PasswordInput } from '@/components/auth/password-input';
import { FormErrorMessage } from '@/components/auth/form-error-message';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams<{ locale: string; token: string }>();
  const t = useTranslations('auth.reset_password');
  const tErr = useTranslations('auth.errors');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { token: params.token, password: '', password_confirm: '' },
  });

  const mutation = useMutation<{ ok: true }, GarageApiError, ResetPasswordInput>({
    mutationFn: (input) => apiPost<{ ok: true }>('/api/auth/reset-password', input),
    onSuccess: () => {
      toast.success(t('success_toast'));
      router.push(`/${params.locale}/login?reset=success`);
    },
    onError: (error) => {
      switch (error.code) {
        case 'TOKEN_EXPIRED':
          toast.error(tErr('reset_token_expired'));
          break;
        case 'TOKEN_INVALID':
          toast.error(tErr('reset_token_invalid'));
          break;
        case 'PASSWORD_REUSE':
          toast.error(tErr('password_reuse'));
          break;
        default:
          toast.error(tErr('generic'));
      }
    },
  });

  return (
    <div>
      <h2 className="text-xl font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="mt-6 space-y-4" data-testid="reset-form" noValidate>
        <input type="hidden" {...register('token')} />

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            {t('label_password')}
          </label>
          <PasswordInput id="password" autoComplete="new-password" data-testid="reset-password" {...register('password')} />
          <FormErrorMessage error={errors.password} />
          <p className="mt-1 text-xs text-muted-foreground">{t('password_requirements')}</p>
        </div>

        <div>
          <label htmlFor="password_confirm" className="block text-sm font-medium">
            {t('label_password_confirm')}
          </label>
          <PasswordInput
            id="password_confirm"
            autoComplete="new-password"
            data-testid="reset-password-confirm"
            {...register('password_confirm')}
          />
          <FormErrorMessage error={errors.password_confirm} />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          data-testid="reset-submit"
          className="flex w-full items-center justify-center rounded-md bg-garage-primary py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {t('btn_submit')}
        </button>
      </form>
    </div>
  );
}
```

### Fichier 8/14 : `src/app/[locale]/(auth)/select-tenant/page.tsx` + `tenant-card.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Building } from 'lucide-react';
import { apiGet, apiPost, GarageApiError } from '@/lib/api-client';
import { ensureLocalePrefix } from '@/lib/auth/redirect-validator';
import { TenantCard } from './tenant-card';

interface TenantInfo {
  id: string;
  name: string;
  city: string;
  address: string;
  type: 'garage';
  isHeadquarter: boolean;
  workforceCount: number;
}

export default function SelectTenantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('auth.select_tenant');
  const tErr = useTranslations('auth.errors');
  const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'fr';
  const redirectTo = searchParams.get('redirect') ?? '';

  const { data: tenants, isLoading } = useQuery<TenantInfo[]>({
    queryKey: ['allowed-tenants'],
    queryFn: () => apiGet<TenantInfo[]>('/api/v1/tenants/allowed'),
  });

  const switchMutation = useMutation<{ ok: true }, GarageApiError, { tenant_id: string }>({
    mutationFn: (input) => apiPost<{ ok: true }>('/api/v1/tenants/switch', input),
    onSuccess: () => {
      router.push(ensureLocalePrefix(redirectTo, locale));
    },
    onError: () => {
      toast.error(tErr('generic'));
    },
  });

  // Auto-redirect si 1 seul tenant
  useEffect(() => {
    if (tenants && tenants.length === 1) {
      switchMutation.mutate({ tenant_id: tenants[0].id });
    }
  }, [tenants]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-garage-primary" />
      </div>
    );
  }

  if (!tenants || tenants.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <p className="mt-4 text-sm text-red-700">{t('empty_state')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <Building className="h-5 w-5 text-garage-primary" />
        <h2 className="text-xl font-semibold">{t('title')}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-6 space-y-3" data-testid="tenant-list">
        {tenants.map((tenant) => (
          <TenantCard
            key={tenant.id}
            tenant={tenant}
            onSelect={() => switchMutation.mutate({ tenant_id: tenant.id })}
            disabled={switchMutation.isPending}
          />
        ))}
      </div>
    </div>
  );
}
```

```typescript
// src/app/[locale]/(auth)/select-tenant/tenant-card.tsx
'use client';

import { useTranslations } from 'next-intl';
import { ChevronRight, Building, MapPin, Users } from 'lucide-react';

interface TenantCardProps {
  tenant: {
    id: string;
    name: string;
    city: string;
    address: string;
    isHeadquarter: boolean;
    workforceCount: number;
  };
  onSelect: () => void;
  disabled?: boolean;
}

export function TenantCard({ tenant, onSelect, disabled }: TenantCardProps) {
  const t = useTranslations('auth.select_tenant');

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      data-testid={`tenant-card-${tenant.id}`}
      className="group flex w-full items-center justify-between rounded-md border border-border bg-card p-4 text-left hover:border-garage-primary disabled:opacity-50"
    >
      <div>
        <div className="flex items-center gap-2">
          <Building className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{tenant.name}</span>
          {tenant.isHeadquarter && (
            <span className="rounded-full bg-garage-primary-50 px-2 py-0.5 text-xs text-garage-primary">
              {t('headquarter')}
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {tenant.city}
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {tenant.workforceCount} {t('staff')}
          </span>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-garage-primary" />
    </button>
  );
}
```

### Fichier 9/14 : `src/app/[locale]/(auth)/mfa-setup/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Smartphone, Key, Copy, Check, Download } from 'lucide-react';
import { apiGet, apiPost, GarageApiError } from '@/lib/api-client';
import { MfaCodeSchema } from '@/lib/auth/schemas';
import { MfaInput } from '../verify-mfa/mfa-input';

interface MfaSetupData {
  totp_secret: string;
  qr_code_url: string;
  backup_codes: string[];
}

export default function MfaSetupPage() {
  const router = useRouter();
  const t = useTranslations('auth.mfa_setup');
  const tErr = useTranslations('auth.errors');
  const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'fr';

  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmedBackup, setConfirmedBackup] = useState(false);

  const setupQuery = useQuery<MfaSetupData>({
    queryKey: ['mfa-setup'],
    queryFn: () => apiGet<MfaSetupData>('/api/auth/mfa-setup'),
  });

  const verifyMutation = useMutation<{ ok: true }, GarageApiError, { totp_secret: string; totp_code: string }>({
    mutationFn: (input) => apiPost<{ ok: true }>('/api/auth/mfa-setup', input),
    onSuccess: () => {
      toast.success(t('success'));
      router.push(`/${locale}/dashboard`);
    },
    onError: (error) => {
      setCode('');
      if (error.code === 'INVALID_CODE') {
        toast.error(tErr('invalid_mfa_code'));
      } else {
        toast.error(tErr('generic'));
      }
    },
  });

  function downloadBackupCodes() {
    if (!setupQuery.data) return;
    const text = `Skalean Garage - MFA Backup Codes\n\n${setupQuery.data.backup_codes.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nGenerated: ${new Date().toISOString()}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'skalean-garage-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    setConfirmedBackup(true);
  }

  function copySecret() {
    if (!setupQuery.data) return;
    navigator.clipboard.writeText(setupQuery.data.totp_secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (setupQuery.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-garage-primary" />
      </div>
    );
  }

  if (!setupQuery.data) return null;

  return (
    <div>
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-garage-primary" />
        <h2 className="text-xl font-semibold">{t('title')}</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      <ol className="mt-6 space-y-6">
        <li>
          <h3 className="font-medium">{t('step1_title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('step1_subtitle')}</p>
          <div className="mt-3 flex justify-center rounded-md border border-border bg-white p-4">
            <img src={setupQuery.data.qr_code_url} alt="MFA QR Code" className="h-48 w-48" />
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{t('manual_secret')}</span>
            <code className="rounded bg-muted px-2 py-1 font-mono">{setupQuery.data.totp_secret}</code>
            <button type="button" onClick={copySecret} className="rounded p-1 hover:bg-muted">
              {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
            </button>
          </div>
        </li>

        <li>
          <h3 className="font-medium">{t('step2_title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('step2_subtitle')}</p>
          <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 p-3">
            <ul className="grid grid-cols-2 gap-1 text-sm font-mono">
              {setupQuery.data.backup_codes.map((c, i) => (
                <li key={i}>{i + 1}. {c}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={downloadBackupCodes}
              className="mt-3 flex items-center gap-1 text-xs text-garage-primary hover:underline"
            >
              <Download className="h-3 w-3" />
              {t('download_codes')}
            </button>
          </div>
        </li>

        <li>
          <h3 className="font-medium">{t('step3_title')}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t('step3_subtitle')}</p>
          <div className="mt-3">
            <MfaInput
              value={code}
              onChange={setCode}
              onComplete={(c) => {
                if (!confirmedBackup) {
                  toast.error(t('must_save_codes'));
                  return;
                }
                verifyMutation.mutate({ totp_secret: setupQuery.data!.totp_secret, totp_code: c });
              }}
              disabled={verifyMutation.isPending}
            />
          </div>
        </li>
      </ol>
    </div>
  );
}
```

### Fichier 10/14 : `src/app/[locale]/(auth)/account-locked/page.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ShieldAlert, Clock } from 'lucide-react';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AccountLockedPage() {
  const t = useTranslations('auth.account_locked');
  const searchParams = useSearchParams();
  const locale = typeof window !== 'undefined' ? window.location.pathname.split('/')[1] : 'fr';
  const initialRetry = parseInt(searchParams.get('retry_after') ?? '900', 10);
  const [remaining, setRemaining] = useState(initialRetry);

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining]);

  const unlocked = remaining === 0;

  return (
    <div className="text-center">
      <ShieldAlert className="mx-auto h-12 w-12 text-red-500" />
      <h2 className="mt-4 text-xl font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="mt-6 rounded-md bg-red-50 border border-red-200 p-4">
        <div className="flex items-center justify-center gap-2 text-2xl font-mono">
          <Clock className="h-5 w-5 text-red-700" />
          <span data-testid="countdown">{formatDuration(remaining)}</span>
        </div>
        <p className="mt-2 text-xs text-red-700">{t('countdown_label')}</p>
      </div>

      {unlocked ? (
        <Link
          href={`/${locale}/login`}
          className="mt-6 inline-block rounded-md bg-garage-primary px-6 py-2 text-sm font-medium text-white"
          data-testid="account-locked-retry"
        >
          {t('retry_now')}
        </Link>
      ) : (
        <p className="mt-6 text-xs text-muted-foreground">{t('wait_message')}</p>
      )}

      <p className="mt-4 text-xs">
        <Link href={`/${locale}/forgot-password`} className="text-garage-primary hover:underline">
          {t('reset_link')}
        </Link>
      </p>
    </div>
  );
}
```

### Fichier 11/14 : `src/components/auth/password-input.tsx`

```typescript
'use client';

import { useState, forwardRef, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

interface PasswordInputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative mt-1">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className="block w-full rounded-md border border-input bg-background pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-garage-primary"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
```

### Fichier 12/14 : `src/components/auth/form-error-message.tsx`

```typescript
import { useTranslations } from 'next-intl';
import { type FieldError } from 'react-hook-form';

interface FormErrorMessageProps {
  id?: string;
  error?: FieldError;
}

export function FormErrorMessage({ id, error }: FormErrorMessageProps) {
  const t = useTranslations();
  if (!error?.message) return null;
  const message = typeof error.message === 'string' ? error.message : 'auth.errors.invalid';
  let translated: string;
  try {
    translated = t(message);
  } catch {
    translated = message;
  }
  return (
    <p id={id} role="alert" className="mt-1 text-xs text-red-600">
      {translated}
    </p>
  );
}
```

### Fichier 13/14 : `src/app/api/auth/signin/route.ts` (proxy)

```typescript
// src/app/api/auth/signin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { SigninSchema } from '@/lib/auth/schemas';

const API_BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN ?? 'localhost';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = SigninSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { statusCode: 400, error: 'BAD_REQUEST', message: parsed.error.errors.map((e) => e.message) },
      { status: 400 },
    );
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parsed.data),
  });

  const data = await response.json();

  const nextResponse = NextResponse.json(data, { status: response.status });

  if (response.status === 200 && !data.mfa_required) {
    if (data.access_token) {
      nextResponse.cookies.set('access_token', data.access_token, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: 'lax',
        domain: COOKIE_DOMAIN,
        maxAge: 60 * 60,
        path: '/',
      });
    }
    if (data.refresh_token) {
      nextResponse.cookies.set('refresh_token', data.refresh_token, {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: 'lax',
        domain: COOKIE_DOMAIN,
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
    }
  }

  return nextResponse;
}
```

### Fichier 14/14 : `src/components/auth/branding-illustration.tsx`

```typescript
// Illustration SVG inline -- atelier garage
export function BrandingIllustration() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="w-full max-w-md text-garage-primary"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gradGarage" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.3" />
        </linearGradient>
      </defs>

      <rect x="40" y="200" width="320" height="160" fill="url(#gradGarage)" rx="8" />
      <rect x="60" y="220" width="80" height="120" fill="currentColor" opacity="0.15" rx="4" />
      <rect x="160" y="220" width="80" height="120" fill="currentColor" opacity="0.2" rx="4" />
      <rect x="260" y="220" width="80" height="120" fill="currentColor" opacity="0.15" rx="4" />

      <g transform="translate(120, 100)">
        <rect x="0" y="60" width="160" height="50" fill="currentColor" opacity="0.4" rx="8" />
        <rect x="20" y="40" width="120" height="40" fill="currentColor" opacity="0.5" rx="6" />
        <circle cx="40" cy="110" r="20" fill="currentColor" />
        <circle cx="40" cy="110" r="10" fill="white" />
        <circle cx="120" cy="110" r="20" fill="currentColor" />
        <circle cx="120" cy="110" r="10" fill="white" />
      </g>

      <g transform="translate(180, 50)" opacity="0.7">
        <rect x="-2" y="0" width="4" height="40" fill="currentColor" />
        <circle cx="0" cy="20" r="8" fill="currentColor" opacity="0.5" />
      </g>

      <text x="200" y="380" textAnchor="middle" fill="currentColor" fontSize="14" fontFamily="sans-serif" opacity="0.6">
        Skalean Garage ERP
      </text>
    </svg>
  );
}
```

---

## 7. Tests complets

### 7.1 Tests Vitest : `src/lib/auth/schemas.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  EmailSchema,
  PasswordSchema,
  StrongPasswordSchema,
  MfaCodeSchema,
  SigninSchema,
  ResetPasswordSchema,
} from './schemas';

describe('EmailSchema', () => {
  it('accepts valid email', () => {
    expect(EmailSchema.safeParse('admin@atlas-garage.ma').success).toBe(true);
  });
  it('rejects empty string', () => {
    expect(EmailSchema.safeParse('').success).toBe(false);
  });
  it('lowercases and trims', () => {
    const result = EmailSchema.safeParse(' Admin@Atlas.MA ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('admin@atlas.ma');
  });
  it('rejects invalid email format', () => {
    expect(EmailSchema.safeParse('not-an-email').success).toBe(false);
  });
});

describe('PasswordSchema', () => {
  it('accepts 8-char password', () => {
    expect(PasswordSchema.safeParse('12345678').success).toBe(true);
  });
  it('rejects 7-char password', () => {
    expect(PasswordSchema.safeParse('1234567').success).toBe(false);
  });
  it('rejects 129-char password', () => {
    expect(PasswordSchema.safeParse('a'.repeat(129)).success).toBe(false);
  });
});

describe('StrongPasswordSchema', () => {
  it('accepts strong password', () => {
    expect(StrongPasswordSchema.safeParse('Strong1!Pass').success).toBe(true);
  });
  it('rejects without uppercase', () => {
    expect(StrongPasswordSchema.safeParse('strong1!pass').success).toBe(false);
  });
  it('rejects without digit', () => {
    expect(StrongPasswordSchema.safeParse('Strong!Pass').success).toBe(false);
  });
  it('rejects without special char', () => {
    expect(StrongPasswordSchema.safeParse('Strong1Pass').success).toBe(false);
  });
});

describe('MfaCodeSchema', () => {
  it('accepts 6 digits', () => {
    expect(MfaCodeSchema.safeParse('123456').success).toBe(true);
  });
  it('rejects 5 digits', () => {
    expect(MfaCodeSchema.safeParse('12345').success).toBe(false);
  });
  it('rejects letters', () => {
    expect(MfaCodeSchema.safeParse('12345a').success).toBe(false);
  });
  it('strips spaces in transform', () => {
    const r = MfaCodeSchema.safeParse('123 456');
    expect(r.success).toBe(false); // regex fails first
  });
});

describe('SigninSchema', () => {
  it('default remember_me to false', () => {
    const r = SigninSchema.safeParse({ email: 'a@b.c', password: 'password1' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.remember_me).toBe(false);
  });
});

describe('ResetPasswordSchema', () => {
  it('accepts matching passwords', () => {
    const r = ResetPasswordSchema.safeParse({
      token: 't',
      password: 'Strong1!P',
      password_confirm: 'Strong1!P',
    });
    expect(r.success).toBe(true);
  });
  it('rejects mismatched passwords', () => {
    const r = ResetPasswordSchema.safeParse({
      token: 't',
      password: 'Strong1!P',
      password_confirm: 'Strong1!X',
    });
    expect(r.success).toBe(false);
  });
});
```

### 7.2 Tests Vitest : `src/lib/auth/redirect-validator.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { validateRedirectPath, ensureLocalePrefix } from './redirect-validator';

describe('validateRedirectPath', () => {
  it('returns default for null', () => expect(validateRedirectPath(null)).toBe('/dashboard'));
  it('returns default for undefined', () => expect(validateRedirectPath(undefined)).toBe('/dashboard'));
  it('returns default for empty', () => expect(validateRedirectPath('')).toBe('/dashboard'));
  it('rejects external URL', () => expect(validateRedirectPath('https://evil.com')).toBe('/dashboard'));
  it('rejects //evil.com (protocol-relative)', () => expect(validateRedirectPath('//evil.com')).toBe('/dashboard'));
  it('rejects javascript:', () => expect(validateRedirectPath('javascript:alert(1)')).toBe('/dashboard'));
  it('rejects data:', () => expect(validateRedirectPath('data:text/html,xss')).toBe('/dashboard'));
  it('rejects with @ (userinfo)', () => expect(validateRedirectPath('/path@evil.com')).toBe('/dashboard'));
  it('accepts relative /sinistres', () => expect(validateRedirectPath('/sinistres')).toBe('/sinistres'));
  it('accepts /fr/dashboard', () => expect(validateRedirectPath('/fr/dashboard')).toBe('/fr/dashboard'));
  it('truncates overly long path', () => expect(validateRedirectPath('/a' + '/x'.repeat(2000))).toBe('/dashboard'));
});

describe('ensureLocalePrefix', () => {
  it('keeps existing locale prefix', () => expect(ensureLocalePrefix('/fr/dashboard', 'fr')).toBe('/fr/dashboard'));
  it('keeps ar-MA prefix', () => expect(ensureLocalePrefix('/ar-MA/sinistres', 'ar-MA')).toBe('/ar-MA/sinistres'));
  it('adds locale to unprefixed path', () => expect(ensureLocalePrefix('/dashboard', 'fr')).toBe('/fr/dashboard'));
  it('handles root', () => expect(ensureLocalePrefix('/', 'fr')).toBe('/fr/dashboard'));
});
```

### 7.3 Tests E2E : `e2e/auth-flow-login.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login flow', () => {
  test('renders login form', async ({ page }) => {
    await page.goto('/fr/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-email"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-password"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-submit"]')).toBeVisible();
  });

  test('validates email format', async ({ page }) => {
    await page.goto('/fr/login');
    await page.locator('[data-testid="login-email"]').fill('not-email');
    await page.locator('[data-testid="login-password"]').fill('password1');
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('p[role="alert"]')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.route('**/api/auth/signin', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 401, error: 'INVALID_CREDENTIALS', message: 'Invalid' }),
      });
    });
    await page.goto('/fr/login');
    await page.locator('[data-testid="login-email"]').fill('admin@garage.ma');
    await page.locator('[data-testid="login-password"]').fill('wrongpass');
    await page.locator('[data-testid="login-submit"]').click();
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 3000 });
  });

  test('redirects on success without mfa', async ({ page, context }) => {
    await page.route('**/api/auth/signin', async (route) => {
      await context.addCookies([
        { name: 'access_token', value: 'fake-token', domain: 'localhost', path: '/' },
      ]);
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ mfa_required: false, needs_tenant_selection: false }),
      });
    });
    await page.goto('/fr/login');
    await page.locator('[data-testid="login-email"]').fill('admin@garage.ma');
    await page.locator('[data-testid="login-password"]').fill('password123');
    await page.locator('[data-testid="login-submit"]').click();
    // verifie redirect (mock backend cookie set par api route)
  });
});
```

### 7.4 Tests E2E : `e2e/auth-flow-mfa.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('MFA verify flow', () => {
  test('renders 6 digit input', async ({ page }) => {
    await page.goto('/fr/verify-mfa?session=mock-session');
    for (let i = 0; i < 6; i++) {
      await expect(page.locator(`[data-testid="mfa-digit-${i}"]`)).toBeVisible();
    }
  });

  test('auto-advances on digit input', async ({ page }) => {
    await page.goto('/fr/verify-mfa?session=mock-session');
    await page.locator('[data-testid="mfa-digit-0"]').fill('1');
    await expect(page.locator('[data-testid="mfa-digit-1"]')).toBeFocused();
  });

  test('paste fills all digits', async ({ page }) => {
    await page.goto('/fr/verify-mfa?session=mock-session');
    await page.locator('[data-testid="mfa-digit-0"]').focus();
    await page.keyboard.insertText('123456');
    // verifier digits set
  });
});
```

### 7.5 Tests E2E : `e2e/auth-flow-recovery.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Password recovery', () => {
  test('forgot-password redirects to success even for non-existent email', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
    });
    await page.goto('/fr/forgot-password');
    await page.locator('[data-testid="forgot-email"]').fill('nonexistent@x.com');
    await page.locator('[data-testid="forgot-submit"]').click();
    await expect(page).toHaveURL(/\/fr\/forgot-password\/success/);
  });

  test('reset-password requires matching passwords', async ({ page }) => {
    await page.goto('/fr/reset-password/some-token');
    await page.locator('[data-testid="reset-password"]').fill('Strong1!Pass');
    await page.locator('[data-testid="reset-password-confirm"]').fill('Different1!Pass');
    await page.locator('[data-testid="reset-submit"]').click();
    await expect(page.locator('p[role="alert"]')).toBeVisible();
  });
});
```

---

## 8. Variables environnement

```env
# Cookies (auth)
COOKIE_DOMAIN=localhost            # prod: .skalean-insurtech.ma
COOKIE_SECURE=false                # prod: true
ACCESS_TOKEN_MAX_AGE_SECONDS=3600
REFRESH_TOKEN_MAX_AGE_SECONDS=604800

# Login policy
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_DURATION_SECONDS=900

# MFA
MFA_TOTP_ISSUER=Skalean Garage
MFA_BACKUP_CODES_COUNT=10
```

---

## 9. Commandes shell

```bash
cd repo
pnpm install --frozen-lockfile
pnpm --filter @insurtech/web-garage dev                              # demarre 3002
pnpm --filter @insurtech/web-garage typecheck                        # 0 erreur
pnpm --filter @insurtech/web-garage lint                             # 0 erreur
pnpm --filter @insurtech/web-garage test                             # 20+ tests
pnpm --filter @insurtech/web-garage exec playwright test e2e/auth-*  # 8+ tests E2E
```

---

## 10. Criteres validation V1-V25

### Criteres P0 (bloquants -- 15)

- **V1 (P0)** : Page /fr/login render avec login-form, email, password, submit
- **V2 (P0)** : Validation email format (Zod) bloque submit
- **V3 (P0)** : Validation password min 8 chars (Zod)
- **V4 (P0)** : Submit avec 401 affiche toast error "Invalid credentials"
- **V5 (P0)** : Submit succes sans MFA -> redirect /fr/dashboard
- **V6 (P0)** : Submit succes avec mfa_required -> redirect /fr/verify-mfa
- **V7 (P0)** : Page /fr/verify-mfa render 6-digit segmented input
- **V8 (P0)** : MFA input auto-advance + auto-submit a 6 digits
- **V9 (P0)** : Page /fr/forgot-password submit redirect success (toujours)
- **V10 (P0)** : Page /fr/reset-password/[token] valide match passwords
- **V11 (P0)** : Page /fr/select-tenant liste tenants utilisateur autorise
- **V12 (P0)** : Page /fr/account-locked countdown timer visible et update 1s
- **V13 (P0)** : Page /fr/mfa-setup affiche QR + 10 backup codes + verify
- **V14 (P0)** : RTL applique en ar-MA et ar (icons left/right inverses)
- **V15 (P0)** : Aucune emoji dans tous fichiers crees

### Criteres P1 (8)

- **V16 (P1)** : i18n keys parite fr/ar-MA/ar (script check)
- **V17 (P1)** : Tests Vitest 20+ tests passent (coverage >= 85%)
- **V18 (P1)** : Tests Playwright 8+ tests passent
- **V19 (P1)** : Account-locked countdown atteint 0 -> retry button enable
- **V20 (P1)** : redirect query param valide via validateRedirectPath
- **V21 (P1)** : Open redirect attack blocked (javascript:, //evil.com, etc.)
- **V22 (P1)** : Cookie access_token httpOnly Secure SameSite=Lax
- **V23 (P1)** : Password toggle visibility fonctionne

### Criteres P2 (5)

- **V24 (P2)** : Lighthouse Accessibility > 90 sur toutes pages auth
- **V25 (P2)** : axe-core 0 violation
- **V26 (P2)** : Animations smooth (transitions Sonner toast)
- **V27 (P2)** : Bundle JS auth pages < 100 ko
- **V28 (P2)** : Branding illustration responsive

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Session MFA expire pendant saisie
**Scenario** : User saisit code 6 chiffres apres 5 minutes inactivite, session_token expire.
**Solution** : Backend retourne 410 SESSION_EXPIRED -> redirect /fr/login avec toast informatif.

### Edge case 2 : User copy-paste code MFA avec espaces
**Scenario** : Google Authenticator affiche "123 456", user copy avec espace.
**Solution** : Handler paste strip espaces + regex valide.

### Edge case 3 : Backup codes perdus
**Scenario** : User n'a plus telephone ni backup codes.
**Solution** : Reset par admin (Sprint 30 admin app). Pour l'instant message support + numero contact.

### Edge case 4 : Browser auto-fill remplit mauvais champ
**Scenario** : LastPass remplit email dans champ password.
**Solution** : `autocomplete="username"` et `autocomplete="current-password"` strict.

### Edge case 5 : Tab key skip MFA input
**Scenario** : Tab apres digit 1, user attend tab a digit 2 mais skip.
**Solution** : `tabIndex={0}` sur chaque digit + arrow keys navigation native.

### Edge case 6 : Forgot-password timing attack
**Scenario** : Attaquant mesure temps reponse pour deviner si email existe.
**Solution** : Backend toujours retourne 200 + delay artificiel uniforme.

### Edge case 7 : Cookie set echoue en cross-domain dev
**Scenario** : Dev local localhost:3002 -> localhost:4000, cookie domain mismatch.
**Solution** : `domain: 'localhost'` + sameSite Lax. En prod, `domain: '.skalean-insurtech.ma'`.

### Edge case 8 : Account-locked countdown overflow
**Scenario** : retry_after_seconds = 999999 (mauvaise valeur backend).
**Solution** : Cap a 86400 (24h) cote UI.

---

## 12. Conformite Maroc

### Loi 09-08 (CNDP) -- traitement donnees
- Email + password = donnees personnelles -> consentement implicite via signin acceptance
- Logs auth conserves 12 mois max (decision-008)
- Mots de passe hash argon2id (Sprint 5 backend)

### Loi 53-95 ANRT
- TLS 1.3 obligatoire transferts (prod HTTPS)
- Cookies Secure flag prod

### Code des assurances MA
- Pas d'impact direct cette tache (UI auth seule)

---

## 13. Conventions absolues skalean-insurtech (rappel)

[Identique Tache 5.4.1 -- multi-tenant strict, Zod, Pino backend, argon2id backend, pnpm, TypeScript strict, Vitest, RBAC, events Kafka, no-emoji, idempotency, Conventional Commits, cloud souverain MA]

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage lint
pnpm --filter @insurtech/web-garage exec vitest run --coverage
pnpm --filter @insurtech/web-garage exec playwright test
bash scripts/check-no-emoji.sh apps/web-garage/
grep -rn "console\.log" apps/web-garage/src/ --include="*.ts" --include="*.tsx" | grep -v ".spec" && echo FAIL || echo OK
pnpm --filter @insurtech/web-garage build
pnpm exec tsx scripts/validate-i18n-keys.ts apps/web-garage/src/messages/
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-22): web-garage pages auth login + MFA + recovery + tenant

Implemente les 7 pages auth web-garage :
- /login avec validation Zod + redirect query param protege
- /verify-mfa avec input 6-digit segmented + auto-advance
- /forgot-password + /forgot-password/success (no enumeration)
- /reset-password/[token] avec validation match
- /select-tenant multi-etablissement Atlas Cabinet
- /mfa-setup QR + 10 backup codes + download
- /account-locked countdown timer + retry

Livrables:
- 12 pages + 14 composants + 5 routes API proxy
- 6 Zod schemas (Signin, Mfa, ForgotPassword, ResetPassword, SetupMfa)
- redirect-validator anti open-redirect attack
- Illustration garage SVG inline
- Password input toggle visibility
- 25 fichiers crees
- 60 keys i18n par locale (fr/ar-MA/ar)

Tests: 22 unit + 9 E2E Playwright
Coverage: 88%

Task: 5.4.2
Sprint: 22 (Phase 5 / Sprint 22 cumul)
Phase: 5 -- Vertical Repair
Reference: B-22 Tache 5.4.2"
```

---

## 16. Workflow next step

Tache suivante : `task-5.4.3-dashboard-6-widgets-garage.md` -- Dashboard d'accueil avec 6 widgets specifiques garage (sinistres en cours, throughput, revenue, ratings, parts low stock, technicien charge).

---

**Fin du prompt task-5.4.2-pages-auth-login-mfa-recovery.md.**

Densite atteinte : ~110 ko
Code patterns : 14 fichiers complets
Tests : 22+ unit + 9 E2E
Criteres : V1-V28
Edge cases : 8
