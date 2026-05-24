# Calendar Sync OAuth Setup -- Sprint 8.10

## Status

**Sprint 8.10 = foundation only**. DB persistence, AES-256-GCM token encryption,
and webhook subscription tracking are implemented. Real OAuth provider
integration (Google Calendar API, Microsoft Graph) and webhook receivers are
**deferred to Task 8.10b / Sprint 8.14** when:

1. Developer credentials are provisioned (Google Cloud Console + Azure App Reg)
2. A public callback / webhook URL is available (ngrok for dev, real domain prod)

This document captures the setup steps required to activate Task 8.10b.

---

## Token encryption

AES-256-GCM via `createEncryptedColumnTransformer` (Sprint 2 -- see
`packages/database/src/entities/booking/transformers/encrypted-column.transformer.ts`).

The transformer is wired transparently on `BookingCalendarSyncEntity.accessToken`
and `BookingCalendarSyncEntity.refreshToken` fields -- the service layer
manipulates plaintext, the DB stores `iv_b64:tag_b64:ciphertext_b64`.

### Master key

- Env var : `CALENDAR_TOKEN_ENCRYPTION_KEY`
- Format : 32 bytes hex (64 hex chars)
- Generation : `openssl rand -hex 32`
- **Production** : rotate periodically. Consider HSM (Sprint 33 pentest review).
- **Never** log decrypted tokens. Pino redact paths should include any field
  derived from token decryption.

---

## Google Calendar OAuth setup

1. **Google Cloud Console** : https://console.cloud.google.com/
2. Create project (or reuse existing).
3. **Enable APIs** : Calendar API + Google Identity (OAuth2).
4. **OAuth consent screen** :
   - User type : Internal (workspace) or External (Gmail users).
   - Scopes minimal : `https://www.googleapis.com/auth/calendar` +
     `https://www.googleapis.com/auth/userinfo.email`.
5. **Credentials -> OAuth 2.0 Client ID** :
   - Type : Web application.
   - Authorized JavaScript origins : your frontend origins.
   - Authorized redirect URIs : `${CALENDAR_WEBHOOK_BASE_URL}/api/v1/booking/calendar/callback/google`.
6. Set env vars :
   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI`

### Webhook (push notifications) -- Task 8.10b

- Google Calendar API `events.watch` creates a channel that expires after 7 days.
- Cron job renews channels every 6 days (1-day buffer).
- Channel ID stored in `webhook_subscription_id` column.
- Channel resource ID stored in `webhook_resource_id`.
- Webhook receiver validates `X-Goog-Channel-ID` + `X-Goog-Channel-Token` headers.

---

## Microsoft Outlook OAuth setup

1. **Azure Portal** : https://portal.azure.com/ -> Azure AD -> App registrations.
2. **New registration** :
   - Name : "Assurflow Calendar Sync"
   - Supported account types : Accounts in any organizational directory + personal
     Microsoft accounts (multi-tenant).
   - Redirect URI : `${CALENDAR_WEBHOOK_BASE_URL}/api/v1/booking/calendar/callback/outlook`.
3. **API permissions** : Microsoft Graph delegated --
   - `Calendars.ReadWrite`
   - `User.Read`
   - `offline_access` (for refresh tokens).
4. **Certificates & secrets** -> New client secret. Copy value (visible only once).
5. Set env vars :
   - `MICROSOFT_OAUTH_CLIENT_ID`
   - `MICROSOFT_OAUTH_CLIENT_SECRET`
   - `MICROSOFT_OAUTH_TENANT=common` (multi-tenant default)
   - `MICROSOFT_OAUTH_REDIRECT_URI`

### Webhook (subscriptions) -- Task 8.10b

- Microsoft Graph subscriptions max 4230 minutes (~70 hours).
- Cron renews every 60 hours (10-hour buffer).
- Subscription ID stored in `webhook_subscription_id` column.
- Webhook receiver validates `clientState` header against stored value +
  echoes `validationToken` query param on initial subscription handshake
  (plain text response, no JSON).
- `lifecycleEvent` (subscription removed / reauthorization required) handled
  by sync worker to update `sync_enabled` and `consecutive_failures`.

---

## Auto-disable threshold

- Env var : `CALENDAR_SYNC_AUTO_DISABLE_THRESHOLD` (default 5).
- After N consecutive failed syncs, `sync_enabled` is set to `false`.
- Tokens are **preserved** -- user re-auth flow (Task 8.10b) can re-enable.
- User notification mechanism (email / in-app) deferred to Sprint 9 (Comm).

---

## Testing strategy

### Sprint 8.10 (current)

- Unit tests : `CalendarSyncTokenService` + `EncryptedColumnTransformer` --
  round-trip encryption, save/lookup/disable/recordSync flows, multi-tenant
  isolation. No HTTP / OAuth provider calls.

### Sprint 8.10b / 8.14 (deferred)

- Mocked HTTP tests for `GoogleCalendarProvider` + `OutlookCalendarProvider`
  using `nock` or `msw`.
- E2E manual flow with real credentials in staging environment.
- Webhook receiver tests with fixture payloads from Google / MS Graph docs.

---

## References

- Google Calendar API : https://developers.google.com/calendar/api
- Google Push Notifications : https://developers.google.com/calendar/api/guides/push
- Microsoft Graph : https://learn.microsoft.com/en-us/graph/api/resources/calendar
- Microsoft Graph subscriptions : https://learn.microsoft.com/en-us/graph/webhooks
- AES-256-GCM RFC : https://datatracker.ietf.org/doc/html/rfc5288
