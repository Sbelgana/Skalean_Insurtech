# iCal Feed Export -- Sprint 8 Task 8.13

Read-only RFC 5545 publication of booking appointments via URL token.
Independent of the OAuth-based bi-directional sync (Task 8.10b / 8.12) --
no Google / Microsoft credentials required. Works with Apple Calendar,
Outlook desktop, Google Calendar subscribe-by-URL.

## How it works

1. Authenticated user creates an iCal token :
   `POST /api/v1/booking/calendar/ical-tokens` body
   `{ "name": "iPhone Calendar", "scope": "own" }`.

2. The response includes a `feedUrl` containing the plain token. **This is
   the only time the plain token is visible.** The server stores ONLY a
   SHA-256 hash ; the plain token cannot be recovered. The UI must display
   it once and prompt the user to subscribe immediately.

3. The user copies `feedUrl` into their calendar client's "subscribe to
   calendar" feature.

4. The client periodically fetches the URL (Apple ~15min, Outlook ~3h,
   Google ~24h). Each fetch returns the user's appointments serialized
   in RFC 5545 text/calendar format.

5. The user can revoke the token at any time :
   `DELETE /api/v1/booking/calendar/ical-tokens/:id` -> active=false +
   revoked_at set. Subsequent feed fetches return 404.

## Scope semantics

| scope        | content                                       | typical user      |
|--------------|-----------------------------------------------|-------------------|
| `own`        | appointments where `assigned_user_id` = self  | broker_user       |
| `team`       | every appointment in the tenant               | broker_admin (per |
|              |                                               | team calendar)    |
| `all_tenant` | identical to team + INFO audit log per access | broker_admin only |

Non-admin users requesting `all_tenant` get a 400 with code
`BOOKING_ICAL_SCOPE_FORBIDDEN`. The check is performed in the controller
based on `BOOKING_ICAL_ADMIN` permission resolution via HierarchyResolver.

## Permissions (Sprint 8.13 additions, catalog 139 -> 141)

| permission              | grants                                           |
|-------------------------|--------------------------------------------------|
| `BOOKING_ICAL_MANAGE`   | Create / list / revoke own tokens                |
| `BOOKING_ICAL_ADMIN`    | List every token in tenant + use all_tenant scope|

Defaults : broker_user / broker_assistant / broker_admin all get MANAGE.
Only broker_admin (and super_admin_platform via hierarchy) get ADMIN.

## Security

- **Plain token = `ical_<base64url(32 bytes)>`** -- 256-bit entropy, URL-safe.
- **DB stores ONLY SHA-256 hex.** A DB leak does not compromise active
  tokens (hash is one-way).
- **Production MUST use HTTPS** -- the token sits in the URL path and
  would leak via HTTP access logs / proxies. The server enforces nothing
  here ; ops must terminate TLS in front.
- **Invalid token returns 404 (not 401)** -- keeps token existence opaque
  to scanners.
- **Per-token rate limiting deferred to Sprint 33 hardening.** Adopt
  defensive caching client-side (`Cache-Control: private, max-age=900`)
  to absorb abusive refresh loops.

## Time window

The feed contains appointments in `[now - 30d, now + 365d]`. Past events
are kept so calendar clients can update their local copy with cancellations.
Future cap prevents unbounded payloads. Sprint 13 may tune based on real
usage.

## Cancelled appointments

Cancelled / no_show events are still included with `STATUS:CANCELLED`.
This is how RFC 5545 instructs clients to remove an event from the local
calendar.

## Time zone

All `DTSTART` / `DTEND` are serialized as UTC (`YYYYMMDDTHHMMSSZ`). The
calendar header includes `X-WR-TIMEZONE:Africa/Casablanca` so clients
display the local time correctly.

## Optional env override

If your API runs behind a reverse proxy or CDN where the request host
differs from the public origin, set `CALENDAR_PUBLIC_BASE_URL` to the
absolute public base (e.g. `https://app.assurflow.ma`). The server uses it
to build absolute `feedUrl` values. When unset (or set to a placeholder),
the server derives the URL from `x-forwarded-proto` + `x-forwarded-host`
or the `host` header.

## Testing strategy

| layer            | test file                                       | count |
|------------------|-------------------------------------------------|-------|
| RFC 5545 render  | `ical-renderer.service.spec.ts`                 |   13  |
| Token lifecycle  | `ical-token.service.spec.ts`                    |   15  |
| Feed orchestrator| `ical-feed.service.spec.ts`                     |    9  |
| Controller       | `ical-feed.controller.spec.ts`                  |   13  |
| **Total**        |                                                 | **50**|

E2E (real Apple Calendar / Outlook desktop subscribe) is deferred to
Sprint 8.14 pilot prep with a smoke script.

## Out of scope (deferred)

- **Line folding > 75 octets** : not enforced. Modern clients accept long
  lines ; revisit in Sprint 33 if a concrete client rejection surfaces.
- **ETag** : `Last-Modified` is sufficient for HTTP caching. Add ETag if
  request volume justifies the precision.
- **Per-token rate limiting** : Sprint 33 hardening.
- **Audit DB logging for `all_tenant` access** : currently Pino info log
  only. Forward to RbacAuditService in a follow-up.

## References

- RFC 5545 (Internet Calendaring) : https://datatracker.ietf.org/doc/html/rfc5545
- Apple Calendar subscription : https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac
- Microsoft Outlook subscribe : https://support.microsoft.com/en-us/office/import-or-subscribe-to-a-calendar-in-outlook-com-cff1429c-5af6-41ec-a5b4-74f2c278e98c
