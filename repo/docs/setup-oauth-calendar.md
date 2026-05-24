# Calendar Sync OAuth Setup -- Sprint 8.10 + 8.10b

## Status

**Sprint 8.10b = Phase 1 delivered** : OAuth providers (`googleapis` +
`@azure/msal-node` / `@microsoft/microsoft-graph-client`), webhook subscriptions
+ validation, cron renewal, controller endpoints, all wired into the booking
module. The code ships with **PLACEHOLDER credentials** in env files -- boot
detects them and disables endpoints (`HTTP 503 Service Unavailable`) until real
values are swapped in. Zero code change required to activate.

Phase 2 (Task 8.12 -- bi-directional sync worker, `AppointmentsService` hooks,
conflict resolution) is **deferred to a follow-up session**.

This document captures :
1. One-time setup procedure (Google Cloud Console + Azure App Registration).
2. Activation procedure (swap placeholders -> real values + restart).
3. Smoke tests verifying provider availability.

---

## Activation procedure (post-credentials)

Once steps below produce real client IDs + secrets :

1. Copy `.env.example` -> `.env.development` (gitignored).
2. Replace the **6 placeholder values** :
   ```
   GOOGLE_OAUTH_CLIENT_ID=<real-google-client-id>
   GOOGLE_OAUTH_CLIENT_SECRET=<real-google-secret>
   GOOGLE_OAUTH_REDIRECT_URI=https://<ngrok-or-domain>/api/v1/booking/calendar/callback/google
   MICROSOFT_OAUTH_CLIENT_ID=<real-azure-app-id>
   MICROSOFT_OAUTH_CLIENT_SECRET=<real-azure-client-secret>
   MICROSOFT_OAUTH_REDIRECT_URI=https://<ngrok-or-domain>/api/v1/booking/calendar/callback/outlook
   CALENDAR_WEBHOOK_BASE_URL=https://<ngrok-or-domain>/api/v1/booking/calendar/webhook
   ```
3. Generate + set `CALENDAR_TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`).
4. Restart API (`pnpm --filter @insurtech/api dev`).
5. Smoke test :
   ```bash
   # Webhook health probe (public) -- should report google + outlook enabled
   curl https://localhost:4000/api/v1/booking/calendar/webhook/health

   # Authenticated initiate (requires JWT + BOOKING_CALENDAR_SYNC permission)
   curl -H "Authorization: Bearer $TOKEN" \
     https://localhost:4000/api/v1/booking/calendar/connect/google
   # -> { "authUrl": "https://accounts.google.com/o/oauth2/..." }
   ```
6. If provider returns 503 with code `CALENDAR_PROVIDER_DISABLED`, the value
   still starts with `PLACEHOLDER_` -- recheck env loading.

---

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

### Sprint 8.10 (foundation)

- Unit tests : `CalendarSyncTokenService` + `EncryptedColumnTransformer` --
  round-trip encryption, save/lookup/disable/recordSync flows, multi-tenant
  isolation. No HTTP / OAuth provider calls.

### Sprint 8.10b Phase 1 (delivered)

- `OAuthCalendarConfig` placeholder detection (12 tests).
- `OAuthStateService` CSRF state generation + redis storage (8 tests, ioredis-mock).
- `GoogleCalendarProvider` authorization URL + webhook validation (8 tests, nock).
- `OutlookCalendarProvider` authorization URL + webhook handshake (10 tests).
- `CalendarOAuth2Service` orchestrator (14 tests, mocked providers).
- `CalendarWebhookManagerService` cron renewal (10 tests).
- `CalendarSyncController` 503 fallback + webhook receivers (20 tests).
- Cumulative Phase 1 : **82 tests passing**.

### Sprint 8.12 / 8.14 (deferred)

- Bi-directional sync worker (Kafka consumer + `AppointmentsService` hooks).
- Conflict resolution (last-write-wins with provider etag).
- E2E manual flow with real credentials in staging.
- Webhook receiver Kafka publication on validated notifications.

---

## References

- Google Calendar API : https://developers.google.com/calendar/api
- Google Push Notifications : https://developers.google.com/calendar/api/guides/push
- Microsoft Graph : https://learn.microsoft.com/en-us/graph/api/resources/calendar
- Microsoft Graph subscriptions : https://learn.microsoft.com/en-us/graph/webhooks
- AES-256-GCM RFC : https://datatracker.ietf.org/doc/html/rfc5288
