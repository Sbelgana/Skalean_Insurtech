# META-PROMPT B-16 -- SPRINT 16 WEB BROKER APP

**Version** : v2.2 (Option B -- post decision-010)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 16 / 35 (cumul) -- Phase 4 Sprint 3
**Position** : Apres Insure Lifecycle, avant Web Customer Portal
**Numerotation taches** : 4.3.1 a 4.3.14
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (premier UI metier production -- demonstration valeur Skalean Broker)

---

## Objectif Global du Sprint

Construire l'application **web-broker** (port 3001) Next.js 15 App Router : interface metier complete pour brokers (3 roles : broker_admin / broker_user / broker_assistant) avec pages dashboards, CRM, deals, polices, broker validation queue, sinistres (read-only courtier), parametres. App reutilise design system Sprint 4, integre auth Sprint 5, RBAC Sprint 7, et consume tous endpoints Phases 3-4.

A la sortie de ce sprint :
- App web-broker Next.js 15 App Router operationnelle (port 3001 dev / `app.skalean-insurtech.ma` prod)
- 12 pages applicatives : login + MFA + signup + dashboard + contacts + companies + deals + polices + broker-queue + sinistres (read-only) + parametres + profile
- Components shadcn/ui + design tokens Sofidemy (Sprint 4)
- Server Actions + Server Components Next.js 15 pour data fetching
- TanStack Query pour mutations client-side avec optimistic updates
- Auth flow integration : login + MFA + recovery + signup
- Multi-tenant header `x-tenant-id` injecte automatique (Sprint 6 backend deja gere)
- RBAC UI : 3 roles broker voient features differentes (broker_admin full, user limited, assistant read+create only)
- I18n : fr / ar-MA / ar avec RTL
- Tests Playwright E2E couvrant 20+ scenarios

---

## Frontiere du Sprint

**INCLUS** :
- App Next.js 15 production-ready
- 12 pages applicatives core
- Components shadcn/ui + Recharts dashboards
- Server Actions + Server Components
- Auth + MFA + signup flows
- RBAC UI conditionnel par role
- I18n 3 locales + RTL
- Tests Playwright E2E

**EXCLU** (sera ajoute aux sprints suivants) :
- web-customer-portal (vente en ligne) -- Sprint 17
- web-assure-portal (assure self-service) -- Sprint 18
- web-garage-app -- Sprint 22
- web-insurtech-admin (super admin Skalean) -- Sprint 27
- IA-powered features (suggestions deals, etc.) -- Phase 7+

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 4 : design tokens Sofidemy + shadcn/ui setup
2. Sortie Sprint 5 : auth flows operational + JWT
3. Sortie Sprint 6 : tenant context header
4. Sortie Sprint 7 : RBAC + 12 roles + permissions
5. Sortie Sprints 8-13 : endpoints CRM + Comm + Docs + Pay + Books + Analytics + HR
6. Sortie Sprints 14-15 : endpoints Insure + lifecycle avance

---

## Stack Imposee (Sprint 16)

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.0.4 | App Router + Server Actions + use("cache") |
| react | 19.0.0 | with React Compiler |
| @tanstack/react-query | 5.62.0 | client mutations + cache sync |
| zod | 3.24.1 | validation schemas frontend |
| @hookform/resolvers + react-hook-form | 3.9.x + 7.54.x | form management |
| recharts | 2.13.x | dashboards charts |
| date-fns + date-fns-tz | 4.1.0 | dates Africa/Casablanca |
| sonner | 1.7.x | toasts notifications |
| nuqs | 2.0.x | URL state for filters |

Variables env : `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_NAME=skalean-broker`, `NEXT_PUBLIC_DEFAULT_LOCALE=fr`.

---

## Vue d'Ensemble des 14 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 4.3.1 | App skeleton + layouts + middleware auth + i18n setup | 6h | P0 | Sprint 7 |
| 4.3.2 | Pages auth : login + MFA verify + signup + recovery | 6h | P0 | 4.3.1 |
| 4.3.3 | Layout principal + sidebar + topbar + tenant switcher | 5h | P0 | 4.3.2 |
| 4.3.4 | Dashboard page : 6 widgets (revenue, conversion, polices, sinistres, deals open, activity) | 6h | P0 | 4.3.3 |
| 4.3.5 | Contacts page : list + filters + create/edit + detail timeline | 7h | P0 | 4.3.4 |
| 4.3.6 | Companies page : list + filters + create/edit + detail | 5h | P0 | 4.3.5 |
| 4.3.7 | Deals page : kanban view + table view + create + move stage | 6h | P0 | 4.3.6 |
| 4.3.8 | Polices page : list + filters + detail (timeline + premiums + avenants) | 7h | P0 | 4.3.7 |
| 4.3.9 | Broker Queue page : pending dossiers + actions validate/reject + SLA timer | 6h | P0 | 4.3.8 |
| 4.3.10 | Sinistres page : read-only list + detail (M9 courtier sans intervention) | 4h | P0 | 4.3.9 |
| 4.3.11 | Parametres + Profile pages : tenant settings + user profile + MFA setup | 5h | P0 | 4.3.10 |
| 4.3.12 | RBAC UI : conditional rendering features per role + permission helpers | 4h | P0 | 4.3.11 |
| 4.3.13 | I18n complete : fr / ar-MA / ar avec RTL + locale switcher | 4h | P0 | 4.3.12 |
| 4.3.14 | Tests E2E Playwright (20+) + accessibility checks | 6h | P0 | 4.3.13 |

**Total** : 77 heures.

---

# DETAIL DES 14 TACHES

---

## Tache 4.3.1 -- App Skeleton + Layouts + Middleware Auth

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 6h / Depend de Sprint 7

**But** : Initialiser app `web-broker` Next.js 15 App Router avec structure complete : layouts (root + protected + auth), middleware auth + tenant context, i18n setup, providers (TanStack Query + theme + toasts).

**Livrables checkables** :
- [ ] Folder `repo/apps/web-broker/` setup (extends Sprint 4 skeleton si deja init)
- [ ] Files : `app/layout.tsx` (root), `app/(auth)/layout.tsx`, `app/(protected)/layout.tsx`
- [ ] Middleware `middleware.ts` :
  - Verifier presence cookie `accessToken` sinon redirect /login (sauf routes publiques)
  - Refresh token automatique si access expire (use refresh token)
  - Inject `x-tenant-id` header dans requests vers API
  - Locale detection + redirect path locale (e.g. `/contacts` -> `/fr/contacts` si default fr)
- [ ] Providers `app/providers.tsx` :
  - QueryClientProvider TanStack Query (default staleTime 5min)
  - ThemeProvider (Sprint 4 design tokens)
  - SonnerProvider (toasts)
- [ ] I18n setup : `next-intl` ou Next.js native -- 3 locales fr / ar-MA / ar
- [ ] Folder structure `app/[locale]/(auth)/...` et `app/[locale]/(protected)/...`
- [ ] Configuration TypeScript strict + path aliases `@/*`
- [ ] ESLint + Prettier config Sprint 1 reutilise
- [ ] Tests : app demarre OK, middleware redirect non-auth, locale detection

**Pattern critique : middleware auth + tenant**

```typescript
// repo/apps/web-broker/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED_ROUTES = ['/dashboard', '/contacts', '/companies', '/deals', '/polices', '/broker-queue', '/sinistres', '/parametres'];
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const accessToken = request.cookies.get('access_token')?.value;
  const tenantId = request.cookies.get('current_tenant_id')?.value;

  // Locale detection
  const locale = detectLocale(request);
  if (!pathname.startsWith(`/${locale}/`)) {
    return NextResponse.redirect(new URL(`/${locale}${pathname}`, request.url));
  }

  // Public routes
  const cleanPath = pathname.replace(`/${locale}`, '');
  if (cleanPath === '/' || AUTH_ROUTES.some(r => cleanPath.startsWith(r))) {
    return NextResponse.next();
  }

  // Protected routes
  if (PROTECTED_ROUTES.some(r => cleanPath.startsWith(r))) {
    if (!accessToken) {
      return NextResponse.redirect(new URL(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`, request.url));
    }
    if (!tenantId) {
      // Need tenant selection
      return NextResponse.redirect(new URL(`/${locale}/select-tenant`, request.url));
    }
  }

  // Inject tenant header for API proxy routes
  const response = NextResponse.next();
  if (tenantId) {
    response.headers.set('x-tenant-id', tenantId);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/layout.tsx                                       # ~80 lignes
repo/apps/web-broker/app/[locale]/(auth)/layout.tsx                       # ~60 lignes
repo/apps/web-broker/app/[locale]/(protected)/layout.tsx                   # ~120 lignes
repo/apps/web-broker/middleware.ts                                        # ~150 lignes
repo/apps/web-broker/app/providers.tsx                                    # ~80 lignes
repo/apps/web-broker/lib/api-client.ts                                    # ~100 lignes (fetch wrapper avec auto-refresh)
repo/apps/web-broker/lib/i18n/config.ts                                   # i18n config
repo/apps/web-broker/messages/{fr,ar-MA,ar}.json                          # 3 locales translations
repo/apps/web-broker/next.config.mjs                                      # Next.js config
repo/apps/web-broker/tsconfig.json                                         # strict + paths
```

**Notes implementation** :
- Cookies httpOnly + Secure + SameSite=lax (auth tokens)
- access_token TTL 15min : refresh auto via cookie refresh_token (Sprint 5 livre auth flow)
- tenant_id stored cookie : permet user multi-tenant switcher
- I18n : separer locale URL (`/fr/`) eviter SSR issues
- Middleware Edge Runtime : pas de Node APIs (limited)

**Criteres validation** :
- V1 (P0) : App demarre sur port 3001
- V2 (P0) : Middleware redirect non-auth -> /login
- V3 (P0) : Middleware locale detection + redirect URL
- V4 (P0) : Cookies tokens + tenant set after login
- V5 (P0) : x-tenant-id injecte requests API
- V6 (P0) : Providers wrappers fonctionnent (QueryClient + theme + toasts)
- V7 (P1) : Tests setup 6+ scenarios

---

## Tache 4.3.2 -- Pages Auth : Login + MFA + Signup + Recovery

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 6h / Depend de 4.3.1

**But** : Pages authentication consumant endpoints Sprint 5 : login + MFA verify + signup + email-verification + forgot-password + reset-password.

**Livrables checkables** :
- [ ] Page `/login` : email + password form (react-hook-form + Zod) + submit -> POST /auth/signin
- [ ] Si response `needs_mfa: true` -> redirect `/verify-mfa?challenge=...`
- [ ] Page `/verify-mfa` : 6 digits TOTP input + submit -> POST /auth/verify-mfa + redirect /dashboard
- [ ] Page `/signup` : email + password + display_name + locale + submit -> POST /auth/signup
- [ ] Page `/email-sent` : message verification email envoye
- [ ] Page `/forgot-password` : email + submit -> POST /auth/forgot-password
- [ ] Page `/reset-password?token=...` : new password + submit -> POST /auth/reset-password
- [ ] Page `/verify-email?token=...` : auto-verify -> GET /auth/verify-email + redirect /login + toast success
- [ ] Page `/select-tenant` : list tenants user a acces (multi-tenant) + click set cookie + redirect /dashboard
- [ ] Components : `<AuthLayout>` + `<PasswordStrengthIndicator>` + `<MfaCodeInput>`
- [ ] Validation client : Zod schemas reuse Sprint 5 backend
- [ ] Toasts feedback : success / error
- [ ] Loading states + disabled buttons during submit
- [ ] Tests Playwright : login flow + MFA + signup + recovery

**Pattern critique : login form avec MFA flow**

```typescript
// repo/apps/web-broker/app/[locale]/(auth)/login/page.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  remember_me: z.boolean().default(false),
});

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(SignInSchema),
    defaultValues: { email: '', password: '', remember_me: false },
  });

  async function onSubmit(values: z.infer<typeof SignInSchema>) {
    setLoading(true);
    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error?.message ?? 'Login failed');
        return;
      }

      if (data.needs_mfa) {
        sessionStorage.setItem('mfa_challenge_token', data.mfa_challenge_token);
        router.push('/verify-mfa');
        return;
      }

      // Set cookies (handled by API route server-side actually)
      toast.success('Connexion reussie');

      // Multi-tenant : redirect to tenant selector if multiple
      if (data.tenants && data.tenants.length > 1) {
        router.push('/select-tenant');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      toast.error('Erreur reseau');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Connexion Skalean Broker</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Input {...form.register('email')} type="email" placeholder="email@exemple.com" />
          <Input {...form.register('password')} type="password" placeholder="Mot de passe" />
          <Checkbox {...form.register('remember_me')} label="Se souvenir de moi" />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Connexion...' : 'Se connecter'}
          </Button>
          <div className="flex justify-between text-sm">
            <Link href="/forgot-password">Mot de passe oublie ?</Link>
            <Link href="/signup">Creer compte</Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(auth)/login/page.tsx                       # ~120 lignes
repo/apps/web-broker/app/[locale]/(auth)/verify-mfa/page.tsx                  # ~100 lignes
repo/apps/web-broker/app/[locale]/(auth)/signup/page.tsx                      # ~150 lignes
repo/apps/web-broker/app/[locale]/(auth)/forgot-password/page.tsx              # ~80 lignes
repo/apps/web-broker/app/[locale]/(auth)/reset-password/page.tsx                # ~100 lignes
repo/apps/web-broker/app/[locale]/(auth)/verify-email/page.tsx                  # ~60 lignes
repo/apps/web-broker/app/[locale]/(auth)/select-tenant/page.tsx                  # ~80 lignes
repo/apps/web-broker/components/auth/{several components}.tsx                    # ~300 lignes
repo/apps/web-broker/app/api/auth/[...nextauth]/route.ts                          # ~150 lignes (proxy API)
```

**Notes implementation** :
- API routes Next.js `/api/auth/*` proxy vers backend (gestion cookies httpOnly server-side)
- mfa_challenge_token stored sessionStorage : volatile, cleanup auto a fermeture browser
- Password strength indicator : lib `zxcvbn` ou simple regex check
- 6 digits MFA input : auto-focus next + submit auto a 6 chars
- Tests Playwright : flows complets reproductibles

**Criteres validation** :
- V1 (P0) : Login email + password OK -> redirect /dashboard
- V2 (P0) : Login mauvais creds -> toast error
- V3 (P0) : Login MFA enabled -> redirect /verify-mfa
- V4 (P0) : MFA wrong code -> error
- V5 (P0) : Signup -> /email-sent
- V6 (P0) : Verify-email link -> /login + toast success
- V7 (P0) : Forgot + reset password complet
- V8 (P0) : Multi-tenant select-tenant page
- V9 (P0) : Tests Playwright 8+ scenarios

---

## Tache 4.3.3 -- Layout Principal + Sidebar + Topbar + Tenant Switcher

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 5h / Depend de 4.3.2

**But** : Layout protected app : sidebar navigation gauche + topbar (search + notifications + user menu + tenant switcher).

**Livrables checkables** :
- [ ] Component `<Sidebar>` :
  - Logo Skalean (Sprint 4 brand assets)
  - Navigation items : Dashboard / Contacts / Companies / Deals / Polices / Broker Queue / Sinistres / Parametres
  - Items conditionnels par role (Tache 4.3.12)
  - Active state visual
  - Collapse mobile (responsive)
- [ ] Component `<Topbar>` :
  - Global search bar (debounce + autocomplete contacts/companies/polices)
  - Notifications bell : badge count unread + dropdown notifications
  - Tenant switcher : si user multi-tenant, dropdown
  - Locale switcher : fr / ar-MA / ar
  - User menu : avatar + dropdown (Profile / Logout / MFA setup)
- [ ] Component `<Breadcrumbs>` : auto-genere depuis pathname
- [ ] Responsive : sidebar collapse < 768px (sheet mobile)
- [ ] Sticky header
- [ ] Tests : navigation + tenant switch + locale switch + logout

**Fichiers crees / modifies** :
```
repo/apps/web-broker/components/layout/sidebar.tsx                          # ~150 lignes
repo/apps/web-broker/components/layout/topbar.tsx                            # ~180 lignes
repo/apps/web-broker/components/layout/tenant-switcher.tsx                    # ~80 lignes
repo/apps/web-broker/components/layout/locale-switcher.tsx                    # ~50 lignes
repo/apps/web-broker/components/layout/user-menu.tsx                          # ~80 lignes
repo/apps/web-broker/components/layout/global-search.tsx                       # ~120 lignes (debounce + dropdown)
repo/apps/web-broker/components/layout/notifications-bell.tsx                  # ~100 lignes
repo/apps/web-broker/components/layout/breadcrumbs.tsx                         # ~50 lignes
```

**Notes implementation** :
- shadcn/ui components : Sidebar, Sheet, Command, DropdownMenu, Avatar
- Notifications : poll API every 30s (Phase 7+ : WebSocket realtime)
- Global search : debounce 300ms + Sprint 8 endpoint /crm/search
- Tenant switcher : POST /api/auth/switch-tenant -> set cookie + reload

**Criteres validation** :
- V1 (P0) : Sidebar visible + navigation works
- V2 (P0) : Topbar all features
- V3 (P0) : Tenant switcher swap context
- V4 (P0) : Locale switcher swap fr/ar-MA/ar
- V5 (P0) : User menu logout works
- V6 (P0) : Responsive mobile
- V7 (P0) : Tests 8+ scenarios

---

## Tache 4.3.4 -- Dashboard Page : 6 Widgets

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 6h / Depend de 4.3.3

**But** : Page dashboard accueil consume endpoints Analytics Sprint 13 + Insure dashboards Sprint 14 -- 6 widgets clefs.

**Livrables checkables** :
- [ ] Widgets :
  1. **Revenue YTD** : graphe revenue (recharts) per month + total
  2. **Conversion deals** : funnel chart (lead -> qualified -> won)
  3. **Polices actives** : count + breakdown per branche (pie chart)
  4. **Sinistres en cours** : count + status breakdown
  5. **Deals open** : count + total value + top 5 prochains close dates
  6. **Activity feed** : 10 dernieres interactions (CRM Sprint 8)
- [ ] Filters : date_range + group_by (day/week/month) shared par widgets
- [ ] Loading states : skeleton placeholders
- [ ] Empty states : si pas data, message + suggested actions
- [ ] URL state : filtres synced via nuqs
- [ ] Refresh button manuel
- [ ] Tests : widgets render + data + filters

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(protected)/dashboard/page.tsx              # ~100 lignes (Server Component)
repo/apps/web-broker/components/dashboard/{6 widgets}.tsx                      # ~600 lignes total
repo/apps/web-broker/components/dashboard/dashboard-filters.tsx               # ~80 lignes
repo/apps/web-broker/lib/queries/dashboard.queries.ts                           # TanStack Query hooks
```

**Notes implementation** :
- Server Component pour initial fetch + Client Component pour widgets interactifs
- Recharts : LineChart, PieChart, FunnelChart, AreaChart
- nuqs : `?date_start=2026-01-01&group_by=month` URL state
- Skeletons shadcn/ui

**Criteres validation** :
- V1 (P0) : 6 widgets render avec data
- V2 (P0) : Filters apply across widgets
- V3 (P0) : Loading + empty states
- V4 (P0) : URL state synced
- V5 (P0) : Tests 6+ scenarios

---

## Tache 4.3.5 -- Contacts Page : List + Filters + Detail Timeline

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 7h / Depend de 4.3.4

**But** : Page contacts complete : list avec filtres + pagination + create/edit form + detail page avec timeline interactions.

**Livrables checkables** :
- [ ] Page `/contacts` (list) :
  - DataTable shadcn/ui : columns (name, email, phone, company, segment, last_interaction, owner)
  - Filters : segment + tags + assigned_to + search (debounce)
  - Pagination + sort
  - Bulk actions : tag, assign, export CSV
  - "Add Contact" button
- [ ] Modal `<ContactFormDialog>` create/edit :
  - Fields : first_name + last_name + email + phone + cin + segment + tags + custom_fields + preferred_language + preferred_channel
  - Validation Zod (CIN MA format, phone E.164)
  - Submit : POST/PATCH /api/v1/crm/contacts
- [ ] Page `/contacts/:id` (detail) :
  - Header : photo + name + segment + tags
  - Tabs : Info / Interactions Timeline / Deals / Polices / Documents
  - Timeline : interactions chronological (call/email/whatsapp/meeting/note) avec icones
  - Action buttons : Send Message / Schedule Appointment / Create Deal
- [ ] Optimistic UI : create -> immediate display avec etat 'pending', success replace, fail revert
- [ ] Tests : CRUD + search + filters + bulk + detail

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(protected)/contacts/page.tsx                 # ~150 lignes
repo/apps/web-broker/app/[locale]/(protected)/contacts/[id]/page.tsx            # ~200 lignes
repo/apps/web-broker/components/contacts/contacts-table.tsx                     # ~250 lignes
repo/apps/web-broker/components/contacts/contact-form-dialog.tsx                 # ~200 lignes
repo/apps/web-broker/components/contacts/contact-timeline.tsx                    # ~150 lignes
repo/apps/web-broker/components/contacts/contact-bulk-actions.tsx                # ~80 lignes
repo/apps/web-broker/lib/queries/contacts.queries.ts                              # TanStack Query
```

**Criteres validation** :
- V1 (P0) : List + pagination + sort
- V2 (P0) : Filters apply
- V3 (P0) : Search debounced
- V4 (P0) : Create modal validation Zod
- V5 (P0) : Edit modal pre-fills data
- V6 (P0) : Detail timeline render
- V7 (P0) : Optimistic UI
- V8 (P0) : Tests 10+ scenarios

---

## Tache 4.3.6 -- Companies Page

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 5h / Depend de 4.3.5

**But** : Page companies similaire contacts (CRUD + list + detail).

**Livrables checkables** :
- [ ] Page list + filters (industry, city, search) + create/edit (ICE + checksum validation MA) + detail (avec contacts associes)
- [ ] Reutilise pattern Tache 4.3.5
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(protected)/companies/{several}.tsx            # ~400 lignes total
repo/apps/web-broker/components/companies/{components}.tsx                       # ~300 lignes total
```

**Criteres validation** :
- V1 (P0) : CRUD complet
- V2 (P0) : ICE validation MA
- V3 (P0) : Detail avec contacts lies
- V4 (P0) : Tests 6+ scenarios

---

## Tache 4.3.7 -- Deals Page : Kanban + Table

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 6h / Depend de 4.3.6

**But** : Page deals avec 2 vues : Kanban (drag-drop stages) + Table.

**Livrables checkables** :
- [ ] View toggle : Kanban / Table
- [ ] Vue Kanban : 5+ colonnes (stages pipeline) + drag-drop deals entre stages
- [ ] On drop : POST /api/v1/crm/deals/:id/move-stage avec reason prompt
- [ ] Optimistic UI : deal moved immediately, revert si echec
- [ ] Vue Table : DataTable + filters (stage, owner, date_range, amount_range)
- [ ] Modal create/edit : title + amount + currency MAD + stage + contact + expected_close_date
- [ ] Detail page : full info + timeline transitions stages + interactions liees
- [ ] Won/Lost shortcuts buttons (avec reason)
- [ ] Tests : drag-drop + create + transitions

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(protected)/deals/page.tsx                    # ~120 lignes
repo/apps/web-broker/app/[locale]/(protected)/deals/[id]/page.tsx               # ~180 lignes
repo/apps/web-broker/components/deals/deals-kanban.tsx                          # ~250 lignes (drag-drop)
repo/apps/web-broker/components/deals/deals-table.tsx                            # ~200 lignes
repo/apps/web-broker/components/deals/deal-form-dialog.tsx                       # ~200 lignes
repo/apps/web-broker/components/deals/won-lost-dialog.tsx                        # ~80 lignes
repo/apps/web-broker/lib/queries/deals.queries.ts                                  # hooks
```

**Notes implementation** :
- Drag-drop : `@dnd-kit/core` library
- Animations : framer-motion (smooth transitions)
- Optimistic update : update local state immediately + sync API in background

**Criteres validation** :
- V1 (P0) : Kanban view drag-drop
- V2 (P0) : Stage move POST API + audit
- V3 (P0) : Table view filters
- V4 (P0) : Create/edit modal
- V5 (P0) : Won/Lost shortcuts
- V6 (P0) : Tests 8+ scenarios

---

## Tache 4.3.8 -- Polices Page : List + Detail Avec Premiums

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 7h / Depend de 4.3.7

**But** : Page polices avec list + detail riche (timeline + premiums echeancier + avenants + renouvellements).

**Livrables checkables** :
- [ ] Page list :
  - DataTable : policy_number / souscripteur / branche / start_date / end_date / status / prime_annuelle
  - Filters : status + branche + souscripteur + expiring_soon (60j) + expired
  - "Generate Quote" button -> redirect vers form quote
- [ ] Page detail :
  - Header : policy_number + status badge + souscripteur + branche
  - Tabs :
    - **Info** : details police + garanties souscrites
    - **Premiums** : echeancier + status paiements + bouton "Initier paiement"
    - **Avenants** : history + bouton "Nouvel avenant"
    - **Renouvellements** : current renewal status + bouton "Proposer renouvellement"
    - **Documents** : police PDF + audit trail (link Sprint 10)
    - **Operations** : transferts + suspensions + cancellation
  - Action buttons : Cancel / Suspend / Transfer / New avenant
- [ ] Forms modaux : create avenant / cancel / suspend / transfer (consume Sprint 15 services)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(protected)/polices/page.tsx                    # ~150 lignes
repo/apps/web-broker/app/[locale]/(protected)/polices/[id]/page.tsx               # ~250 lignes
repo/apps/web-broker/components/polices/polices-table.tsx                         # ~200 lignes
repo/apps/web-broker/components/polices/policy-detail-tabs.tsx                     # ~300 lignes
repo/apps/web-broker/components/polices/{several action dialogs}.tsx              # ~600 lignes total
```

**Criteres validation** :
- V1 (P0) : List + filters
- V2 (P0) : Detail tabs all functional
- V3 (P0) : Cancel modal pro-rata preview
- V4 (P0) : Suspend modal date range
- V5 (P0) : Transfer modal contact selector
- V6 (P0) : Avenants + renouvellements
- V7 (P0) : Tests 12+ scenarios

---

## Tache 4.3.9 -- Broker Queue Page : Pending Dossiers + Validate/Reject

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 6h / Depend de 4.3.8

**But** : Page list broker queue (Sprint 15 BrokerValidationQueueService) : dossiers a valider + actions + SLA timer.

**Livrables checkables** :
- [ ] Page list :
  - DataTable filtree par status (pending / in_review / validated / rejected / escalated)
  - Columns : customer + branche + amount + source (web_portal/manual/partner) + sla_due_at + priority
  - Visual : SLA timer countdown + badge couleur (green > 12h, yellow 6-12h, red < 6h, dark red overdue)
  - Tabs : Mes dossiers / Tous (admin) / En retard
- [ ] Detail dossier :
  - Customer data complete
  - Garanties demandees + prime estimee
  - Documents fournis (CIN, justificatifs)
  - Provisional policy lien (Sprint 15 si genere)
- [ ] Actions :
  - **Validate** -> POST /api/v1/insure/broker/queue/:id/validate -> trigger souscription + Provisional replace par police definitive
  - **Reject** -> reason modal -> POST reject + notify customer
  - **Assign to me** -> claim dossier
  - **Escalate** -> super admin tenant
- [ ] Notifications real-time : new dossier assigne -> toast + bell counter
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(protected)/broker-queue/page.tsx              # ~150 lignes
repo/apps/web-broker/app/[locale]/(protected)/broker-queue/[id]/page.tsx         # ~200 lignes
repo/apps/web-broker/components/broker-queue/queue-table.tsx                       # ~200 lignes
repo/apps/web-broker/components/broker-queue/sla-timer.tsx                          # ~80 lignes
repo/apps/web-broker/components/broker-queue/validate-reject-dialogs.tsx           # ~150 lignes
```

**Notes implementation** :
- SLA timer : update every minute via React state + interval
- Badge couleur dynamic basee sur remaining_minutes
- Real-time notifications : poll /notifications endpoint every 30s

**Criteres validation** :
- V1 (P0) : List + filtres + SLA timer visible
- V2 (P0) : Validate trigger souscription + replace provisional
- V3 (P0) : Reject + reason + notify customer
- V4 (P0) : Assign self
- V5 (P0) : Escalate super admin
- V6 (P0) : Tests 10+ scenarios

---

## Tache 4.3.10 -- Sinistres Page Read-Only (M9 Courtier Sans Intervention)

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 4h / Depend de 4.3.9

**But** : Page sinistres lecture seule pour broker (M9 : courtier ne traite PAS sinistres -- Skalean fait via flux client M8 garage). Broker peut SUIVRE sinistres lies a ses polices mais pas intervenir.

**Contexte** : **Decision metier critique** : sinistres traites par garage (Sprint 22 garage app) directement avec assure (flux M8 client choisit garage). Broker n'intervient PAS dans workflow sinistre. Mais broker doit SUIVRE pour conseil client + reporting ACAPS.

**Livrables checkables** :
- [ ] Page list read-only :
  - DataTable : sinistre_number / police / customer / declaration_date / status / amount_estimated
  - Filters : status + branche + date_range
  - Pas de bouton "Create" (sinistre cree par flux client Sprint 24)
- [ ] Page detail read-only :
  - Status workflow visible (declared -> acknowledged -> expert_assigned -> ... -> closed)
  - Garage assigne (si applicable)
  - Documents lies (devis, photos)
  - Timeline events
  - Pas d'actions write (info only)
- [ ] Permission : `repair.sinistres.read` (Sprint 21 permissions)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(protected)/sinistres/page.tsx                  # ~120 lignes
repo/apps/web-broker/app/[locale]/(protected)/sinistres/[id]/page.tsx              # ~180 lignes
repo/apps/web-broker/components/sinistres/sinistre-status-flow.tsx                  # ~100 lignes (visual workflow)
```

**Criteres validation** :
- V1 (P0) : List read-only fonctionne
- V2 (P0) : Detail read-only complet
- V3 (P0) : Pas de boutons Create/Edit/Delete
- V4 (P0) : Tests 6+ scenarios

---

## Tache 4.3.11 -- Parametres + Profile Pages

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 5h / Depend de 4.3.10

**But** : Pages parametres tenant (admin only) + profile user + MFA setup.

**Livrables checkables** :
- [ ] Page `/parametres` (broker_admin only) :
  - Tabs : General / Branding / Users / Custom Fields / Pipelines / Quotas / API Keys
  - General : tenant name, contact info, locale defaut, currency, timezone
  - Branding : logo upload, primary color, custom email signature
  - Users : list users tenant + invite + roles
  - Custom Fields : Sprint 8 custom fields management
  - Pipelines : Sprint 8 deals pipelines management
  - Quotas : Sprint 6 quotas (read-only display)
- [ ] Page `/profile` (all users) :
  - Tabs : Info / Security / Notifications
  - Info : display_name + email + phone + photo upload + locale + preferred_channel
  - Security : change password + MFA setup/disable + recovery codes view + active sessions list
  - Notifications : preferences canaux (email/in-app)
- [ ] MFA setup workflow : QR code display + verify TOTP + recovery codes download
- [ ] Active sessions : list + revoke individual + revoke all
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-broker/app/[locale]/(protected)/parametres/page.tsx                # ~80 lignes (tabs)
repo/apps/web-broker/app/[locale]/(protected)/parametres/{several tabs}.tsx       # ~600 lignes total
repo/apps/web-broker/app/[locale]/(protected)/profile/page.tsx                    # ~80 lignes
repo/apps/web-broker/app/[locale]/(protected)/profile/{several tabs}.tsx           # ~500 lignes total
repo/apps/web-broker/components/profile/mfa-setup-flow.tsx                         # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Parametres tabs accessibles broker_admin
- V2 (P0) : Profile tabs accessibles tous users
- V3 (P0) : MFA setup flow QR -> verify -> codes
- V4 (P0) : Active sessions + revoke
- V5 (P0) : Branding upload logo
- V6 (P0) : Tests 8+ scenarios

---

## Tache 4.3.12 -- RBAC UI : Conditional Rendering Per Role

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 4h / Depend de 4.3.11

**But** : RBAC UI : afficher/masquer features selon role utilisateur (3 roles broker : admin / user / assistant).

**Livrables checkables** :
- [ ] Hook `useUserPermissions()` -- retourne user.role + permissions effectives (depuis JWT decoded)
- [ ] Hook `usePermission(permission: string): boolean` -- check si user a une permission specifique
- [ ] Component `<HasPermission permission="...">{children}</HasPermission>` -- conditional render
- [ ] Component `<HasRole role={['broker_admin', 'broker_user']}>{children}</HasRole>`
- [ ] Application :
  - Sidebar items : Parametres visible only `broker_admin`
  - Action buttons : "Delete deal" only si `crm.deals.delete`
  - Forms fields : custom fields admin only
- [ ] Server-side double-check : meme si UI cache, backend rejette (Sprint 7 PermissionGuard)
- [ ] Tests : visibility per role + 3 scenarios par role

**Fichiers crees / modifies** :
```
repo/apps/web-broker/lib/auth/use-permissions.tsx                                # ~80 lignes (hooks)
repo/apps/web-broker/components/auth/has-permission.tsx                          # ~30 lignes
repo/apps/web-broker/components/auth/has-role.tsx                                 # ~30 lignes
repo/apps/web-broker/test/rbac-ui.spec.ts                                          # tests
```

**Notes implementation** :
- JWT decode client-side : extract role + permissions (lib `jose`)
- Defense en profondeur : backend toujours valide (UI security never trusted)
- Pattern facile a appliquer : wrap features avec HasPermission

**Criteres validation** :
- V1 (P0) : `useUserPermissions` retourne data correcte
- V2 (P0) : `<HasPermission>` cache si manque
- V3 (P0) : Sidebar items conditionnels
- V4 (P0) : Tests per role 6+ scenarios

---

## Tache 4.3.13 -- I18n Complete : fr / ar-MA / ar + RTL

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 4h / Depend de 4.3.12

**But** : Internationalisation complete app web-broker : 3 locales + RTL pour ar/ar-MA + locale switcher.

**Livrables checkables** :
- [ ] Fichiers translations : `messages/{fr,ar-MA,ar}.json` -- toutes UI strings
- [ ] Lib `next-intl` ou pattern Next.js native i18n
- [ ] CSS RTL : `[dir="rtl"]` selectors + flip flexbox + icons mirroring
- [ ] Component `<LocaleSwitcher>` : dropdown locale selection
- [ ] Date format locale-aware : `date-fns` avec locale fr / ar
- [ ] Currency format : `Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' })`
- [ ] Tests : switch locale apply CSS RTL + texts
- [ ] Coverage 100% UI strings traduites (lint check)

**Fichiers crees / modifies** :
```
repo/apps/web-broker/messages/fr.json                                           # ~500 keys
repo/apps/web-broker/messages/ar-MA.json                                         # darija
repo/apps/web-broker/messages/ar.json                                            # arabe classique
repo/apps/web-broker/lib/i18n/use-translations.tsx                                # hooks
repo/apps/web-broker/components/layout/locale-switcher.tsx                        # update
repo/apps/web-broker/app/globals.css                                              # RTL CSS
```

**Notes implementation** :
- ar-MA : darija ecrit en lettres arabes (familier MA)
- ar : arabe classique formel
- RTL support critical : direction flip, padding/margin start/end (vs left/right)
- Date locale : `format(date, 'PPP', { locale: ar })` -> "1 janvier 2026" / "1 يناير 2026"

**Criteres validation** :
- V1 (P0) : 3 locales fichiers complets
- V2 (P0) : Switch locale change UI texts
- V3 (P0) : RTL CSS applique ar/ar-MA
- V4 (P0) : Date + currency locale-aware
- V5 (P0) : Tests 6+ scenarios

---

## Tache 4.3.14 -- Tests E2E Playwright (20+) + Accessibility

**Metadonnees** : Phase 4 / Sprint 16 / P0 / 6h / Depend de 4.3.13

**But** : Suite tests Playwright complete + accessibility checks (a11y).

**Livrables checkables** :

**Tests E2E (20+)** :
- [ ] Auth : login + signup + MFA + recovery (5)
- [ ] Dashboard : widgets render + filters (2)
- [ ] Contacts : CRUD + search + bulk (3)
- [ ] Companies : CRUD (2)
- [ ] Deals : Kanban drag + table + create (3)
- [ ] Polices : list + detail + cancel + suspend (4)
- [ ] Broker Queue : validate + reject + assign (3)
- [ ] Profile : MFA setup + change password (2)
- [ ] RBAC : 3 roles voir features differentes (3)

**Accessibility (a11y)** :
- [ ] axe-core integrated tests : verifier WCAG 2.1 AA compliance
- [ ] Keyboard navigation : tab order coherent + escape close modals
- [ ] Screen reader : ARIA labels + landmarks
- [ ] Color contrast : Sprint 4 design tokens deja conforme

**Fichiers crees / modifies** :
```
repo/apps/web-broker/e2e/{20+ specs}.spec.ts
repo/apps/web-broker/e2e/fixtures/auth-helpers.ts
repo/apps/web-broker/e2e/fixtures/test-tenant-setup.ts
repo/apps/web-broker/playwright.config.ts                                          # config
```

**Criteres validation** :
- V1 (P0) : 20+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Accessibility WCAG 2.1 AA
- V4 (P0) : Reproducibility 5x runs
- V5 (P0) : Coverage critical paths

---

## Sortie du Sprint 16

A la fin de l'execution des 14 taches :

```
Web Broker App operational :
  - Next.js 15 App Router production-ready
  - 12 pages : login + MFA + signup + recovery + dashboard + contacts + companies + deals + polices + broker-queue + sinistres (read-only) + parametres + profile
  - 6 widgets dashboard
  - Kanban + Table views deals
  - Optimistic UI updates
  - I18n fr / ar-MA / ar + RTL
  - RBAC UI : 3 roles broker (admin/user/assistant)
  - 20+ tests Playwright E2E
  - WCAG 2.1 AA accessible

Pattern Next.js 15 valide :
  - Server Components + Server Actions
  - Middleware auth + tenant
  - TanStack Query mutations + optimistic
  - Pattern reutilise pour Sprint 17 (web-customer-portal) + Sprint 22 (web-garage)
```

**Sprint 17 (Web Customer Portal -- vente en ligne SEO) demarre avec** :
- Pattern Next.js 15 stable
- Auth flows ready
- BrokerValidationQueue + ProvisionalPolicy services Sprint 15 ready a etre consume

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-4.3.X-*.md` dans `00-pilotage/prompts-taches/sprint-16-web-broker-app/`.

**Patterns code inline conserves** : middleware auth + tenant Next.js 15, login form react-hook-form + Zod + MFA flow.

**Reference** : Sprint 4 design tokens Sofidemy + shadcn/ui setup deja livre.

---

**Fin du meta-prompt B-16 v2.2 format Option B.**
