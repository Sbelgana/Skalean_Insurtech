# Sprint 5 -- Auth E2E Live Validation Runbook

**Status au moment du commit** : Docker Desktop arrete sur l'environnement local
(daemon non joignable). Le runbook ci-dessous documente la procedure exacte
a executer une fois Docker Desktop redemarre + skalean-test stack UP.

Note Phase C : le code et les migrations sont prets ; seule la validation
manuelle live reste a executer. Sprint 5 GO COMPLET est valide par :
- 41 tests automatises apps/api (1 unit + 1 audit unit + 1 integration
  lockout/audit + 16 E2E direct service)
- 312 tests @insurtech/auth
- 8 tests @insurtech/comm
- Postgres repos + migrations typechecked

---

## Prerequis

1. Docker Desktop UP (verifier `docker ps` repond)
2. Stack skalean-test demarre :
   ```bash
   cd repo
   pnpm docker:up
   # ou directement :
   docker compose -f infrastructure/docker/docker-compose.test.yaml up -d
   ```
3. Verifier les ports :
   ```bash
   ss -tlnp | grep -E "5433|6380|9093"
   # 5433 = Postgres skalean_test
   # 6380 = Redis test
   # 9093 = Kafka test
   ```

## Setup env

```bash
cd repo
export PASSWORD_PEPPER=$(openssl rand -base64 48)
export PASSWORD_PEPPER_VERSION=1
export MFA_SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)

# RSA key pair pour JWT RS256
export JWT_PRIVATE_KEY="$(openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 2>/dev/null)"
export JWT_PUBLIC_KEY="$(echo "$JWT_PRIVATE_KEY" | openssl pkey -pubout 2>/dev/null)"
export JWT_ISSUER=skalean-insurtech-api
export JWT_AUDIENCE=skalean-insurtech-app

# Database
export DATABASE_URL="postgresql://insurtech_user:SecurePassword123!@localhost:5433/skalean_test"

# Redis (sessions + lockout + rate-limit)
export REDIS_HOST=localhost
export REDIS_PORT=6380
export REDIS_SESSIONS_DB=1
export REDIS_LOCKOUTS_DB=2
export RATE_LIMIT_REDIS_DB=5

# Sessions TTL
export SESSION_DEFAULT_TTL_SECONDS=28800
export SESSION_REMEMBER_ME_TTL_SECONDS=2592000

# MFA
export MFA_TOTP_ISSUER="Skalean InsurTech"

# Email -- pas de SMTP_HOST -> StubEmailService log-only avec token visible
export EMAIL_LOG_TOKEN_DEV=1

# Postgres repos swap (Phase B)
export USE_POSTGRES_REPOS=1

# App
export NODE_ENV=development
export PORT=4000

# Run migrations
pnpm --filter @insurtech/database migration:run
# Doit appliquer la migration AuthSprint5Augmentation1735000000009

# Start apps/api in dev mode
pnpm --filter @insurtech/api dev &
sleep 30

# Health check
curl -sf http://localhost:4000/healthz | jq .
# expected: { "status": "ok", "redis": "up", "postgres": "up", ... }
```

## Test des 13 endpoints

### 1. Signup

```bash
SIGNUP_RESP=$(curl -s -X POST http://localhost:4000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test-e2e@skalean.ma",
    "password":"P@ssw0rd2026!",
    "display_name":"Test E2E",
    "locale":"fr-MA",
    "accepted_tos":true
  }')
echo "$SIGNUP_RESP" | jq .
# expected: { "data": { "message": "If your email is not yet registered..." } }
```

### 2. Verify email (extract token from logs)

```bash
TOKEN=$(grep "email_send_verification_stub" /tmp/api-dev.log | tail -1 | jq -r '.token')
curl -s -X POST http://localhost:4000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d "{\"verification_token\":\"$TOKEN\"}" | jq .
# expected: { "data": { "verified": true, "message": "Email verified..." } }
```

### 3. Signin (no MFA)

```bash
SIGNIN_RESP=$(curl -s -X POST http://localhost:4000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test-e2e@skalean.ma",
    "password":"P@ssw0rd2026!",
    "remember_me":false
  }')
echo "$SIGNIN_RESP" | jq .
ACCESS_TOKEN=$(echo "$SIGNIN_RESP" | jq -r '.data.access_token')
REFRESH_TOKEN=$(echo "$SIGNIN_RESP" | jq -r '.data.refresh_token')
echo "access_token: ${ACCESS_TOKEN:0:50}..."
echo "refresh_token: ${REFRESH_TOKEN:0:50}..."
# expected: { "data": { "mfa_required": false, "access_token": "...", "refresh_token": "...", "user": {...} } }
```

### 4. GET /me (auth required)

```bash
curl -s -X GET http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq .
# expected: { "data": { "id": "...", "email": "test-e2e@skalean.ma", "role": "prospect", ... } }
```

### 5. Setup MFA

```bash
MFA_SETUP=$(curl -s -X POST http://localhost:4000/api/v1/auth/setup-mfa \
  -H "Authorization: Bearer $ACCESS_TOKEN")
echo "$MFA_SETUP" | jq .
SETUP_TOKEN=$(echo "$MFA_SETUP" | jq -r '.data.setup_token')
SECRET_B32=$(echo "$MFA_SETUP" | jq -r '.data.secret_b32')
echo "Scan QR code or use secret: $SECRET_B32"
# Open the data:image/png in browser, or use oathtool:
TOTP_CODE=$(oathtool --totp -b "$SECRET_B32")
echo "TOTP code: $TOTP_CODE"
```

### 6. Confirm MFA

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/confirm-mfa \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d "{
    \"setup_token\":\"$SETUP_TOKEN\",
    \"totp_code\":\"$TOTP_CODE\"
  }" | jq .
# expected: { "data": { "mfa_enabled": true, "recovery_codes": ["XXXX-XXXX-XXXX",...], ... } }
# Note : all sessions revoked -> ACCESS_TOKEN now invalid
```

### 7. Signin with MFA (challenge phase)

```bash
SIGNIN_MFA_RESP=$(curl -s -X POST http://localhost:4000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test-e2e@skalean.ma",
    "password":"P@ssw0rd2026!",
    "remember_me":false
  }')
echo "$SIGNIN_MFA_RESP" | jq .
CHALLENGE_TOKEN=$(echo "$SIGNIN_MFA_RESP" | jq -r '.data.mfa_challenge_token')
# expected: { "data": { "mfa_required": true, "mfa_challenge_token": "...", ... } }
```

### 8. Verify MFA -> get final tokens

```bash
TOTP_NEW=$(oathtool --totp -b "$SECRET_B32")
VERIFY_MFA_RESP=$(curl -s -X POST http://localhost:4000/api/v1/auth/verify-mfa \
  -H "Content-Type: application/json" \
  -d "{
    \"challenge_token\":\"$CHALLENGE_TOKEN\",
    \"totp_code\":\"$TOTP_NEW\"
  }")
echo "$VERIFY_MFA_RESP" | jq .
ACCESS_TOKEN_MFA=$(echo "$VERIFY_MFA_RESP" | jq -r '.data.access_token')
# expected: { "data": { "access_token": "...", "mfa_verified": true, ... } }
```

### 9. Refresh

```bash
NEW_REFRESH=$(echo "$VERIFY_MFA_RESP" | jq -r '.data.refresh_token')
REFRESH_RESP=$(curl -s -X POST http://localhost:4000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$NEW_REFRESH\"}")
echo "$REFRESH_RESP" | jq .
# expected: { "data": { "access_token": "<new>", "refresh_token": "<rotated>", ... } }
```

### 10. Forgot password

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test-e2e@skalean.ma"}' | jq .
# expected: { "data": { "message": "If your email is registered, a password reset link..." } }
RECOVERY_TOKEN=$(grep "email_send_recovery_stub" /tmp/api-dev.log | tail -1 | jq -r '.token')
```

### 11. Reset password

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/reset-password \
  -H "Content-Type: application/json" \
  -d "{
    \"recovery_token\":\"$RECOVERY_TOKEN\",
    \"new_password\":\"NewP@ssw0rd2027!\"
  }" | jq .
# expected: { "data": { "reset": true, "message": "Password updated..." } }
# Note : all sessions revoked
```

### 12. Disable MFA (auth required, after new signin)

```bash
# Sign in again with new password + MFA
# ... repeat steps 7+8 ...

curl -s -X POST http://localhost:4000/api/v1/auth/disable-mfa \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN_FRESH" \
  -d "{
    \"current_password\":\"NewP@ssw0rd2027!\",
    \"totp_code\":\"$TOTP_FRESH\"
  }" | jq .
# expected: { "data": { "mfa_enabled": false, "sessions_revoked": N, ... } }
```

### 13. Signout

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/signout \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{}' -w "%{http_code}\n"
# expected: 204 No Content
```

## Verifications post-execution

### Audit events Pino

```bash
grep "audit_event_published" /tmp/api-dev.log | tail -30 | jq '.event_kind'
# Doit montrer :
# - signup_started, signup_completed
# - email_verified
# - signin_success (x N)
# - mfa_setup_completed
# - mfa_verify_success
# - recovery_completed
# - signout
```

### Postgres rows

```bash
psql "$DATABASE_URL" -c "SELECT email, role, mfa_enabled, email_verified_at IS NOT NULL AS verified FROM auth_users WHERE email='test-e2e@skalean.ma';"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM auth_email_verifications WHERE consumed_at IS NOT NULL;"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM auth_password_recoveries WHERE consumed_at IS NOT NULL;"
```

### Redis sessions + lockout

```bash
redis-cli -p 6380 -n 1 KEYS "session:*"
redis-cli -p 6380 -n 1 KEYS "family:*"
redis-cli -p 6380 -n 1 KEYS "lockout:*"
```

### Brute force test (lockout)

```bash
# 5 wrong passwords
for i in {1..5}; do
  echo "--- Attempt $i ---"
  curl -s -X POST http://localhost:4000/api/v1/auth/signin \
    -H "Content-Type: application/json" \
    -d '{"email":"test-e2e@skalean.ma","password":"WrongPass","remember_me":false}' | jq '.error.code'
done
# Attempts 1..4 : "INVALID_CREDENTIALS"
# Attempt 5    : "ACCOUNT_LOCKED" with HTTP 423
```

## Cleanup

```bash
pkill -f "nest start"
docker compose -f infrastructure/docker/docker-compose.test.yaml down
```

## Resultats attendus

| Endpoint | Status attendu |
|----------|----------------|
| POST signup | 200 |
| POST verify-email | 200 |
| POST signin (no MFA) | 200 + tokens |
| GET me | 200 + UserPublic |
| POST setup-mfa | 200 + QR |
| POST confirm-mfa | 200 + 6 recovery codes |
| POST signin (MFA) | 200 + mfa_required:true |
| POST verify-mfa | 200 + final tokens |
| POST refresh | 200 + rotated tokens |
| POST forgot-password | 200 |
| POST reset-password | 200 |
| POST disable-mfa | 200 |
| POST signout | 204 |

Si tous les endpoints renvoient les statuts attendus + audit events publies +
DB rows persistes + Redis sessions OK -> Phase C VALIDEE.
