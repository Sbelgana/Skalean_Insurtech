# META-PROMPT B-26 -- SPRINT 26 ADMIN FOUNDATION (Skalean InsurTech Admin)

**Version** : v2.2 (Option B -- PREMIER sprint Phase 6)
**Phase** : 6 -- Admin Platform
**Sprint** : 26 / 35 (cumul) -- Phase 6 Sprint 1
**Position** : Apres Phase 5 complete, debut Phase 6 admin platform global
**Numerotation taches** : 6.1.1 a 6.1.12
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (admin platform critique pour gestion tous tenants en production)

---

## Objectif Global du Sprint

Construire **web-insurtech-admin** (port 3000) Next.js 15 App Router : interface super admin Skalean pour gestion plateforme global. Permet equipe Skalean (super_admin role) de monitorer tous tenants (brokers + garages) + onboarder nouveaux + configurer capabilities + voir KPIs platform-wide + audit logs + sante system.

Different web-broker / web-garage : ces apps gerent un tenant (data isolated). web-insurtech-admin **transcende** isolation : super-admin Skalean voit tout dans toutes les tables (avec audit complet chaque acces).

A la sortie de ce sprint :
- web-insurtech-admin Next.js 15 desktop (port 3000 dev / `admin.skalean-insurtech.ma` prod)
- 10 pages applicatives core : login + MFA + dashboard global + tenants list + tenant detail + onboarding wizard + users + capabilities + health monitoring + audit logs + parametres platform
- Pattern Next.js 15 reutilise Sprint 16
- Auth : super_admin role uniquement (Sprint 7) + 2FA mandatory + session courte 4h
- Privilege escalation visible : indicateur visuel quand admin agit cross-tenant
- Audit logs viewer + search avance
- KPIs platform : revenue tous tenants + sinistres + polices + alerts
- I18n fr/ar (EN aussi pour international team Skalean)
- Tests E2E + WCAG

---

## Frontiere du Sprint

**INCLUS** :
- App Next.js 15 production-ready
- 10 pages applicatives core
- Auth super_admin + 2FA mandatory + session 4h
- Tenants list + detail + onboarding wizard UI (consume Sprint 25 backend)
- Users management cross-tenant
- Capabilities matrix UI
- Health monitoring dashboards
- Audit logs viewer + search
- KPIs platform-wide
- Tests E2E

**EXCLU** (sera ajoute aux sprints suivants) :
- Tenants Management UI advance (impersonation, billing, reporting) -- Sprint 27
- Admin Reports + Compliance reporting ACAPS -- Sprint 28
- IA-powered platform monitoring -- Sprint 30+ defere

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 16 : pattern Next.js 15 stable
2. Sortie Sprint 7 : super_admin role + permissions Sprint 25 cross-tenant
3. Sortie Sprint 25 : Cross-Tenant Framework + onboarding wizard backend
4. Sortie Sprint 13 : Analytics dashboards
5. Sortie Sprint 12 : Books + Compliance ACAPS

---

## Stack Imposee (Sprint 26)

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.0.4 | App Router (reuse pattern Sprint 16) |
| @tanstack/react-query | 5.62.0 | mutations |
| recharts | 2.13.x | dashboards |
| zod | 3.24.1 | validation |
| react-json-view-lite | 1.x | audit logs JSON viewer |

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 6.1.1 | App skeleton + middleware super_admin guard + 2FA mandatory + session 4h | 6h | P0 | Phase 5 |
| 6.1.2 | Pages auth super_admin : login + MFA + recovery (TOTP + recovery codes) | 5h | P0 | 6.1.1 |
| 6.1.3 | Layout admin + sidebar + topbar + privilege escalation indicator | 5h | P0 | 6.1.2 |
| 6.1.4 | Dashboard platform-wide : 6 widgets KPIs global (revenue/sinistres/polices/tenants/alerts) | 7h | P0 | 6.1.3 |
| 6.1.5 | Tenants list page : DataTable tous tenants + filters (type, status, region) | 6h | P0 | 6.1.4 |
| 6.1.6 | Tenant detail page : info + capabilities + users + activity + KPIs per tenant | 7h | P0 | 6.1.5 |
| 6.1.7 | Onboarding wizard UI : 7 steps (consume Sprint 25 backend) | 7h | P0 | 6.1.6 |
| 6.1.8 | Users management cross-tenant : list + invite + suspend + impersonate (audit) | 6h | P0 | 6.1.7 |
| 6.1.9 | Capabilities matrix UI : configure per tenant + history changes | 5h | P0 | 6.1.8 |
| 6.1.10 | Health monitoring : services status + metrics (DB + Kafka + Redis + S3 + IA) | 5h | P0 | 6.1.9 |
| 6.1.11 | Audit logs viewer + search avance (filters: user, tenant, action, date, IP) | 5h | P0 | 6.1.10 |
| 6.1.12 | Tests E2E (15+) + WCAG 2.1 AA + Lighthouse | 6h | P0 | 6.1.11 |

**Total** : 70 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 6.1.1 -- App Skeleton + Middleware Super Admin

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 6h / Depend de Phase 5

**But** : Initialiser app `web-insurtech-admin` Next.js 15 avec middleware enforce super_admin role + 2FA mandatory + session 4h.

**Livrables checkables** :
- [ ] Folder `repo/apps/web-insurtech-admin/`
- [ ] App skeleton Next.js 15 reuse pattern Sprint 16
- [ ] Middleware enrichi :
  - Verify cookie access_token + role='super_admin' (sinon 403 redirect /access-denied)
  - Force 2FA verification : si user pas 2FA -> redirect /setup-2fa
  - Session validity : access token 4h (vs 15min standard) -- security balance
  - Inject `x-tenant-id` cookie si admin agit cross-tenant (privileged context)
  - Audit log : log chaque request super-admin avec resource access
- [ ] Variables env : `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_APP_NAME=skalean-admin`
- [ ] Layout protected : redirect tous routes vers /login si non auth
- [ ] Tests : middleware blocks non-super_admin

**Pattern critique : middleware super_admin enforce**

```typescript
// repo/apps/web-insurtech-admin/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtDecode } from 'jose';

const PUBLIC_ROUTES = ['/login', '/verify-mfa', '/access-denied', '/forgot-password'];

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const accessToken = request.cookies.get('access_token')?.value;

  const cleanPath = pathname.replace(/^\/[a-z]{2}(-[A-Z]{2})?/, '');
  if (PUBLIC_ROUTES.some(r => cleanPath.startsWith(r))) {
    return NextResponse.next();
  }

  if (!accessToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verify super_admin role
  try {
    const decoded = jwtDecode(accessToken) as JwtPayload;

    if (decoded.role !== 'super_admin') {
      return NextResponse.redirect(new URL('/access-denied', request.url));
    }

    // Verify 2FA enabled (super_admin REQUIRES 2FA)
    if (!decoded.mfa_enabled) {
      return NextResponse.redirect(new URL('/setup-2fa', request.url));
    }

    // Verify session not expired (access token 4h validity already enforced backend)
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      return NextResponse.redirect(new URL('/login?session_expired=1', request.url));
    }

    // Audit log via header (backend will log)
    const response = NextResponse.next();
    response.headers.set('x-admin-action-log', 'true');
    return response;
  } catch {
    return NextResponse.redirect(new URL('/login?invalid_token=1', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/                                                            # full Next.js 15 app
repo/apps/web-insurtech-admin/middleware.ts                                                # ~120 lignes
repo/apps/web-insurtech-admin/app/layout.tsx                                                # ~80 lignes
repo/apps/web-insurtech-admin/app/[locale]/(auth)/layout.tsx                                # ~60 lignes
repo/apps/web-insurtech-admin/app/[locale]/(protected)/layout.tsx                            # ~100 lignes
repo/apps/web-insurtech-admin/app/providers.tsx                                              # ~80 lignes
repo/apps/web-insurtech-admin/messages/{fr,ar,en}.json                                        # 3 locales (en pour international team)
```

**Notes implementation** :
- Session 4h : balance UX vs security (re-auth jour ouvrable typique)
- 2FA mandatory : non-negotiable super_admin role
- Privilege escalation : visual indicator quand admin agit cross-tenant
- EN locale : team Skalean potentiellement international

**Criteres validation** :
- V1 (P0) : App demarre port 3000
- V2 (P0) : Non super_admin redirect /access-denied
- V3 (P0) : 2FA mandatory enforce
- V4 (P0) : Session 4h
- V5 (P0) : Audit log header
- V6 (P0) : Tests 6+ scenarios

---

## Tache 6.1.2 -- Pages Auth Super Admin

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 5h / Depend de 6.1.1

**But** : Pages auth super_admin : login + MFA verify + setup-2FA + recovery codes (TOTP + recovery 12 codes).

**Livrables checkables** :
- [ ] Pages :
  - `/login` : email + password
  - `/verify-mfa` : 6 digits TOTP OR recovery code dropdown
  - `/setup-2fa` : QR code TOTP + recovery codes (download required avant continue)
  - `/forgot-password` + `/reset-password`
  - `/access-denied` : message clair pour user non super_admin
- [ ] Workflow setup-2FA : QR code Google Authenticator + verify TOTP + generate 12 recovery codes + force download avant continue
- [ ] Recovery codes : 12 codes 8 chars alphanumeric, single-use, stored hashed bcrypt
- [ ] Pattern reutilise Sprint 16
- [ ] Tests Playwright

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(auth)/{6 pages}.tsx                              # ~600 lignes total
repo/apps/web-insurtech-admin/components/auth/{several}.tsx                                    # ~300 lignes
```

**Criteres validation** :
- V1 (P0) : Login + MFA
- V2 (P0) : Setup 2FA QR + recovery codes mandatory
- V3 (P0) : Recovery code accepted
- V4 (P0) : Tests 6+ scenarios

---

## Tache 6.1.3 -- Layout Admin + Privilege Escalation Indicator

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 5h / Depend de 6.1.2

**But** : Layout admin avec sidebar + topbar + indicator visuel privilege escalation.

**Livrables checkables** :
- [ ] Sidebar :
  - Dashboard global
  - Tenants (admin / managed_partner / api_partner separes)
  - Users
  - Capabilities
  - Health Monitoring
  - Audit Logs
  - Compliance Reports (Sprint 28)
  - Parametres Platform
- [ ] Topbar :
  - Logo Skalean Admin (variant rouge subtle indique mode admin)
  - Search global (tous tenants + users + sinistres + polices)
  - Notifications bell (alerts platform-wide)
  - User menu : avatar + role badge "super_admin" + logout
- [ ] **Privilege escalation indicator** : banner top quand admin agit cross-tenant ("Vous agissez sur tenant X" + Stop button)
- [ ] Audit footer : "Toutes vos actions sont enregistrees" + ID session visible
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/components/layout/admin-sidebar.tsx                              # ~150 lignes
repo/apps/web-insurtech-admin/components/layout/admin-topbar.tsx                                # ~150 lignes
repo/apps/web-insurtech-admin/components/layout/privilege-escalation-banner.tsx                  # ~100 lignes
repo/apps/web-insurtech-admin/components/layout/audit-footer.tsx                                  # ~50 lignes
```

**Criteres validation** :
- V1 (P0) : Sidebar complete
- V2 (P0) : Topbar + search global
- V3 (P0) : Privilege escalation banner
- V4 (P0) : Audit footer
- V5 (P0) : Tests 5+ scenarios

---

## Tache 6.1.4 -- Dashboard Platform-Wide

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 7h / Depend de 6.1.3

**But** : Dashboard accueil avec 6 widgets KPIs platform-wide (cross-tenant aggregations).

**Livrables checkables** :
- [ ] Widgets :
  1. **Revenue total YTD** : graphe per month + breakdown per tenant type (broker/garage)
  2. **Tenants distribution** : pie chart par type + status (active/onboarding/suspended)
  3. **Polices actives** : count total + breakdown per branche + per tenant top 10
  4. **Sinistres en cours** : count total + status workflow + alerts SLA depassed
  5. **Alerts platform** : list real-time : low stock alerts / API partner downtime / fraud flags / etc.
  6. **System health** : services status (DB / Kafka / Redis / S3 / IA mock) + uptime
- [ ] Filters : date_range + tenant_type + region
- [ ] Real-time refresh : poll 30s
- [ ] Click drill-down : tap widget -> detail page
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/dashboard/page.tsx                      # ~150 lignes
repo/apps/web-insurtech-admin/components/dashboard/{6 widgets}.tsx                              # ~600 lignes total
repo/apps/web-insurtech-admin/lib/queries/admin-dashboard.queries.ts                              # hooks
```

**Notes implementation** :
- Cross-tenant queries : super-admin context, Sprint 13 ETL ClickHouse aggregations
- Real-time alerts : WebSocket Phase 7+ ; Sprint 26 poll 30s acceptable
- Drill-down : navigation contextual

**Criteres validation** :
- V1 (P0) : 6 widgets cross-tenant
- V2 (P0) : Filters apply
- V3 (P0) : Click drill-down
- V4 (P0) : Real-time refresh
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.1.5 -- Tenants List Page

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 6h / Depend de 6.1.4

**But** : Page list tous tenants : DataTable + filters + bulk actions.

**Livrables checkables** :
- [ ] DataTable columns : name + type (broker/garage) + subtype (atlas/managed/api) + status + city + users_count + active_polices/sinistres + revenue_30d + onboarded_at
- [ ] Filters : type + subtype + status + region + onboarding_status
- [ ] Search : nom + ICE
- [ ] Bulk actions : suspend + reactivate + send notification + export CSV
- [ ] "Onboard new tenant" button -> wizard Tache 6.1.7
- [ ] Click tenant -> detail Tache 6.1.6
- [ ] Permissions : `admin.tenants.read/manage`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/page.tsx                        # ~150 lignes
repo/apps/web-insurtech-admin/components/tenants/tenants-table.tsx                              # ~200 lignes
repo/apps/web-insurtech-admin/components/tenants/tenants-bulk-actions.tsx                        # ~100 lignes
```

**Criteres validation** :
- V1 (P0) : List + filters + search
- V2 (P0) : Bulk actions
- V3 (P0) : Tests 6+ scenarios

---

## Tache 6.1.6 -- Tenant Detail Page

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 7h / Depend de 6.1.5

**But** : Page detail tenant : info + capabilities + users + activity + KPIs per tenant.

**Livrables checkables** :
- [ ] Header : nom + ICE + type + subtype + status badge
- [ ] Tabs :
  - **Info** : details legaux + adresse + contacts + onboarding history
  - **Users** : list users + invite + suspend + impersonate (avec audit Tache 6.1.8)
  - **Capabilities** : current matrix + edit (Tache 6.1.9)
  - **Polices** (si broker) ou **Sinistres** (si garage) : list read-only avec deep links
  - **Books** : KPIs revenue + invoices + payments status
  - **Activity** : audit log filtre tenant + last 30j
  - **Health** : connection status (si Type 3 API Partner)
- [ ] Actions :
  - "Impersonate user" : super-admin demarre session as user du tenant (avec audit + session limited 1h)
  - "Suspend tenant" : pause activity + notify users
  - "Edit settings" : tenant settings update
- [ ] Privilege escalation banner active quand Impersonate started
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/[id]/page.tsx                   # ~250 lignes
repo/apps/web-insurtech-admin/components/tenants/tenant-detail-tabs.tsx                          # ~300 lignes
repo/apps/web-insurtech-admin/components/tenants/impersonate-button.tsx                            # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : 8 tabs functional
- V2 (P0) : Impersonate workflow
- V3 (P0) : Suspend tenant
- V4 (P0) : Privilege banner active
- V5 (P0) : Tests 8+ scenarios

---

## Tache 6.1.7 -- Onboarding Wizard UI

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 7h / Depend de 6.1.6

**But** : UI onboarding wizard 7 steps consumant Sprint 25 backend.

**Livrables checkables** :
- [ ] Wizard 7 steps (Sprint 25 Tache 5.7.7) :
  1. Type selection (managed_partner OR api_partner)
  2. Partner data (nom + ICE + RC + adresse + contact)
  3. Capabilities review (defaults selon type + customize)
  4. Admin user setup (email + role)
  5. Garage entity (Type 2 only) OR API config (Type 3 only)
  6. Welcome pack preview
  7. Confirmation + launch
- [ ] Stepper progress visible
- [ ] Save draft : permits exit + resume later
- [ ] Validation per step : Zod schemas + display errors
- [ ] Final step : trigger backend launch + display success + tenant ID created
- [ ] Tests : flow complete + draft + resume

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/onboarding/page.tsx                       # ~200 lignes
repo/apps/web-insurtech-admin/components/onboarding/{7 steps components}.tsx                       # ~700 lignes total
repo/apps/web-insurtech-admin/components/onboarding/wizard-progress.tsx                            # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : 7 steps complete
- V2 (P0) : Draft save + resume
- V3 (P0) : Validation per step
- V4 (P0) : Backend launch trigger
- V5 (P0) : Tests 8+ scenarios

---

## Tache 6.1.8 -- Users Management Cross-Tenant + Impersonate

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 6h / Depend de 6.1.7

**But** : Page users management cross-tenant : list + invite + suspend + reset MFA + impersonate avec audit complet.

**Livrables checkables** :
- [ ] Page `/users` :
  - DataTable : email + name + tenant + role + status + last_login + MFA enabled
  - Filters : tenant + role + status + MFA status
  - Search : email + name
- [ ] Actions :
  - Invite user (existing tenant) -- email invitation Sprint 5
  - Suspend user (block login)
  - Reset MFA (force re-setup)
  - Reset password (send email link)
  - **Impersonate** : demarre session as user (audit complete)
- [ ] **Impersonate workflow** :
  - Confirmation modal : "Vous allez agir comme {user}. Toutes les actions seront enregistrees."
  - Backend endpoint `POST /api/v1/admin/impersonate` : retourne JWT temporary (1h validity) avec claim `impersonating_admin_id`
  - Cookie temporary set + redirect to web-broker/web-garage according user role
  - Banner persistent dans target app : "Mode Impersonation : {admin} agit comme {user}"
  - Bouton "Stop Impersonation" : returns to admin
- [ ] Audit log : chaque impersonation start/stop + actions during
- [ ] Permissions : `admin.users.impersonate`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/users/page.tsx                            # ~150 lignes
repo/apps/web-insurtech-admin/components/users/users-table.tsx                                    # ~200 lignes
repo/apps/web-insurtech-admin/components/users/impersonate-modal.tsx                              # ~150 lignes
repo/packages/auth/src/services/impersonation.service.ts                                           # ~250 lignes (backend)
repo/apps/api/src/modules/admin/controllers/impersonation.controller.ts                            # ~120 lignes
```

**Notes implementation** :
- Impersonation : critical security feature, audit obligatoire
- Token temporary : 1h max + claim impersonating_admin_id (revealable dans audit)
- Banner banner persistent : eviter admin oublie qu'il agit pour autrui
- Backend logs impersonation start/stop comme separate events

**Criteres validation** :
- V1 (P0) : Users list + filters
- V2 (P0) : Invite + suspend + reset MFA
- V3 (P0) : Impersonate workflow complete
- V4 (P0) : Audit complete
- V5 (P0) : Tests 10+ scenarios

---

## Tache 6.1.9 -- Capabilities Matrix UI

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 5h / Depend de 6.1.8

**But** : UI configurer capabilities per tenant + history changes.

**Livrables checkables** :
- [ ] Page `/tenants/:id/capabilities` :
  - Matrix display : capabilities groupees par module (Repair / Insure / Books / etc.)
  - Toggle on/off per capability
  - Display config per capability (jsonb editor advanced)
  - Save changes -> backend Sprint 25 update_capabilities + audit
- [ ] History changes : table audit per capability (who + when + before/after)
- [ ] Bulk actions : enable/disable batch capabilities
- [ ] Validation : certaines capabilities requirent autres (e.g. `insure.connectors.api_access` requirent `repair.sinistres.send_status_updates`)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/tenants/[id]/capabilities/page.tsx          # ~200 lignes
repo/apps/web-insurtech-admin/components/capabilities/capabilities-matrix-ui.tsx                     # ~250 lignes
repo/apps/web-insurtech-admin/components/capabilities/changes-history.tsx                              # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Matrix display
- V2 (P0) : Toggle + save
- V3 (P0) : History changes
- V4 (P0) : Validation dependencies
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.1.10 -- Health Monitoring

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 5h / Depend de 6.1.9

**But** : Page health monitoring : status services + metrics OTEL + alerts proactives.

**Livrables checkables** :
- [ ] Page `/health` :
  - Services status :
    - **Database Postgres** : up/down + connections + slow queries (last 5min)
    - **Kafka KRaft** : up/down + topics health + consumer lags
    - **Redis** : up/down + memory + cache hit ratio
    - **S3 (multi-tenant buckets)** : reachable + storage usage
    - **IA Mock (Sprint 20)** : provider current + latency p95 + error rate
    - **API Partners (Sprint 25)** : per partner connection status + circuit breaker state
    - **Mock Insurer (Sprint 21)** : status + delays
  - Metrics OTEL : CPU + memory + request rate + error rate (last 24h)
  - Alerts active : list (DB connection pool exhausted / Kafka lag > threshold / etc.)
- [ ] Auto-refresh 30s
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/health/page.tsx                            # ~200 lignes
repo/apps/web-insurtech-admin/components/health/{several monitors}.tsx                              # ~400 lignes
repo/apps/api/src/modules/admin/controllers/health-monitoring.controller.ts                          # ~150 lignes
```

**Notes implementation** :
- Endpoints health backend deja Sprint 1+2 (basique) + Sprint 25 connecteurs
- Metrics OTEL agreges : Sprint 13 prepare ; Phase 7+ enrichi monitoring complet

**Criteres validation** :
- V1 (P0) : Services status
- V2 (P0) : Metrics OTEL
- V3 (P0) : Alerts active
- V4 (P0) : Auto-refresh
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.1.11 -- Audit Logs Viewer + Search Avance

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 5h / Depend de 6.1.10

**But** : Viewer audit logs avec search avance : filters per user, tenant, action, date, IP, action type.

**Livrables checkables** :
- [ ] Page `/audit-logs` :
  - DataTable : timestamp + user + tenant + action + resource + IP + result + before/after diff
  - Filters : user_id + tenant_id + action_type + resource_type + date_range + IP + result
  - Search free text dans diff jsonb
  - Export CSV : filtered results
  - Click row -> detail modal avec full diff JSON viewer
- [ ] Endpoint backend optimized : pagination + indexes audit_log
- [ ] Performance : > 10M rows audit -> queries optimisees + ClickHouse archive
- [ ] Permissions : `admin.audit_logs.read`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/audit-logs/page.tsx                         # ~200 lignes
repo/apps/web-insurtech-admin/components/audit/audit-logs-table.tsx                                 # ~200 lignes
repo/apps/web-insurtech-admin/components/audit/audit-detail-modal.tsx                                # ~150 lignes (JSON viewer)
```

**Criteres validation** :
- V1 (P0) : Filters complete
- V2 (P0) : Search free text
- V3 (P0) : Export CSV
- V4 (P0) : Detail modal JSON
- V5 (P0) : Performance > 10M rows
- V6 (P0) : Tests 6+ scenarios

---

## Tache 6.1.12 -- Tests E2E + WCAG + Lighthouse

**Metadonnees** : Phase 6 / Sprint 26 / P0 / 6h / Depend de 6.1.11

**But** : Suite tests Playwright E2E + WCAG 2.1 AA + Lighthouse audits.

**Livrables checkables** :

**Tests E2E (15+)** :
- [ ] Auth super_admin + 2FA + recovery codes (4)
- [ ] Dashboard platform-wide (1)
- [ ] Tenants list + detail + actions (3)
- [ ] Onboarding wizard 7 steps (2)
- [ ] Users impersonate workflow + audit (2)
- [ ] Capabilities edit + validation (1)
- [ ] Health monitoring (1)
- [ ] Audit logs filters + search (2)

**WCAG 2.1 AA + Lighthouse** :
- [ ] axe-core integrated
- [ ] Performance > 90
- [ ] Accessibility > 90
- [ ] Best Practices > 95

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/e2e/{15+ specs}.spec.ts
repo/apps/web-insurtech-admin/playwright.config.ts
```

**Criteres validation** :
- V1 (P0) : 15+ tests passent
- V2 (P0) : Lighthouse perf 90+
- V3 (P0) : Accessibility WCAG 2.1 AA
- V4 (P0) : CI green
- V5 (P0) : Reproducibility 5x

---

## Sortie du Sprint 26

A la fin de l'execution des 12 taches :

```
Web Insurtech Admin operational :
  - Next.js 15 admin app (port 3000)
  - Auth super_admin + 2FA mandatory + session 4h + recovery codes
  - 10 pages : dashboard / tenants / detail / onboarding / users / capabilities / health / audit-logs / parametres
  - Onboarding wizard 7 steps consume Sprint 25 backend
  - Impersonate workflow avec audit complet
  - Health monitoring services + metrics OTEL
  - Audit logs viewer + search avance + export CSV
  - Privilege escalation banner indicator
  - I18n fr/ar/en
  - 15+ tests Playwright E2E + WCAG 2.1 AA + Lighthouse 90+
```

**Sprint 27 (Tenants Management UI advance) demarre avec** :
- Foundation admin operationnelle
- Sprint 27 : impersonation enrichie + billing + reporting avance
- Pattern reutilise pour Sprint 28 Compliance Reports ACAPS

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-6.1.X-*.md` dans `00-pilotage/prompts-taches/sprint-26-admin-foundation/`.

**Patterns code inline conserves** : middleware super_admin enforce + 2FA mandatory + JWT decode + session 4h.

**Reference** : Sprint 16 pattern Next.js 15 + Sprint 25 cross-tenant backend.

---

**Fin du meta-prompt B-26 v2.2 format Option B.**
