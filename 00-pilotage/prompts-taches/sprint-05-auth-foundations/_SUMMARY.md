# Sprint 5 -- Auth Foundations -- Recapitulatif des 15 Taches

**Sprint** : 5 / 35 (cumul) -- Premier de la Phase 2 Securite & Multi-tenant
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md`
**Effort total** : ~78 heures developpement / 2 semaines
**Priorite** : P0 (bloquant pour tous les sprints metier 6 a 35)
**Date generation** : 2026-05-06
**Densite cible par task** : 80-150 KB
**AUCUNE EMOJI AUTORISEE**

---

## Vue d'Ensemble

Sprint 5 livre le systeme d'authentification complet du programme Skalean InsurTech v2.2 : argon2id durci OWASP 2024, JWT HS256 + rotation refresh + theft detection, MFA TOTP RFC 6238 + recovery codes, sessions Redis avec revocation, signup avec verification email double-opt-in, lockout progressif anti brute force, account recovery, audit trail Kafka + Postgres, email service multi-locale, rate limiting auth-specifique, tests E2E exhaustifs.

A la sortie de ce sprint, l'API expose 14 endpoints REST `/api/v1/auth/*` operationnels :
- POST `/signup` (avec verification email obligatoire)
- GET `/verify-email` (redirect 302)
- POST `/resend-verification`
- POST `/signin` (avec MFA challenge si enabled)
- POST `/signout` (revoke session courante)
- POST `/signout-all` (revoke toutes sessions)
- POST `/refresh` (rotation + theft detection)
- GET `/me` (profile authentifie)
- GET `/sessions` (liste sessions actives)
- DELETE `/sessions/:sid` (revoke session specifique)
- POST `/setup-mfa` (init MFA TOTP)
- POST `/confirm-mfa` (active MFA + retourne 6 recovery codes)
- POST `/verify-mfa` (challenge apres signin)
- POST `/disable-mfa` (avec password + TOTP)
- POST `/forgot-password` (recovery flow)
- POST `/reset-password` (reset avec token)

---

## Tableau Recapitulatif des 15 Taches

| # | Tache | Effort | Priorite | Description courte | Densite | Fichier |
|---|-------|--------|----------|---------------------|---------|---------|
| 2.1.1 | Init `@insurtech/auth` Package | 4h | P0 | Types + Schemas Zod + Constants + AuthModule skeleton | ~110 KB | task-2.1.1-init-auth-package.md |
| 2.1.2 | Argon2Service | 5h | P0 | Hash + Verify + Password Policies + Banlist 1000 | ~85 KB | task-2.1.2-argon2id-service.md |
| 2.1.3 | Crypto Services | 5h | P0 | EncryptionService AES-256-GCM + HashingService SHA-256 + HMAC | ~84 KB | task-2.1.3-crypto-services.md |
| 2.1.4 | JwtService | 6h | P0 | Sign + Verify Access/Refresh + token_family rotation | ~82 KB | task-2.1.4-jwt-service.md |
| 2.1.5 | SessionService | 5h | P0 | Redis storage + Lua atomic rotation + theft detection | ~80 KB | task-2.1.5-session-service.md |
| 2.1.6 | AuthModule + Controller + Service + JwtStrategy + Guard | 7h | P0 | Couche integration NestJS avec 6 endpoints initiaux | ~92 KB | task-2.1.6-auth-module-controller.md |
| 2.1.7 | MfaService | 6h | P0 | TOTP RFC 6238 + QR + 6 recovery codes Argon2id + challenge tokens | ~85 KB | task-2.1.7-mfa-service.md |
| 2.1.8 | MfaRequiredGuard + Endpoints | 5h | P0 | 4 endpoints MFA + @RequireMfa decorator | ~85 KB | task-2.1.8-mfa-required-guard.md |
| 2.1.9 | Signup + Email Verification | 5h | P0 | 3 endpoints signup avec migration auth_email_verifications | ~85 KB | task-2.1.9-signup-email-verification.md |
| 2.1.10 | LockoutService | 4h | P0 | Anti brute force progressif (5 -> 15 -> 60 min -> permanent) + IP tracking | ~85 KB | task-2.1.10-lockout-service.md |
| 2.1.11 | Account Recovery | 5h | P0 | forgot-password + reset-password + email confirmation | ~85 KB | task-2.1.11-account-recovery.md |
| 2.1.12 | AuditAuthService | 4h | P0 | 22 events Kafka + audit_log Postgres + AsyncLocalStorage | ~85 KB | task-2.1.12-audit-auth-service.md |
| 2.1.13 | EmailService | 6h | P0 | Nodemailer + Handlebars + 10 templates x 4 locales (40 templates) | ~95 KB | task-2.1.13-email-service.md |
| 2.1.14 | RateLimit Auth-Specifique | 3h | P0 | @Throttle decorators sur 9 endpoints + custom IP+email tracker | ~85 KB | task-2.1.14-rate-limiting-auth.md |
| 2.1.15 | Tests E2E Auth Complets | 8h | P0 | 15 scenarios Playwright + Mailhog + Redis + Postgres | ~95 KB | task-2.1.15-e2e-tests.md |

**Total effort** : 78 heures (correspond a ~2 semaines developpement avec 1 ingenieur senior 4h/jour productive).

**Densite totale** : ~1.3 MB de markdown dense auto-suffisant pour Claude Code.

---

## Architecture livree

### Packages crees

- `@insurtech/auth` (package partage) -- types, schemas Zod, constants, services fondationnels (Argon2Service, JwtService, SessionService, MfaService, LockoutService, EncryptionService, HashingService).
- `@insurtech/comm` (package partage) -- EmailService + 40 templates Handlebars.

### Modules NestJS apps/api

- `apps/api/.../auth/` -- AuthModule + AuthController + AuthService + JwtStrategy + JwtAuthGuard + MfaRequiredGuard + AuditAuthService + 6 DTOs.

### Datastores

- **Postgres** : tables `auth_users` (extended), `auth_sessions` (Sprint 2 utilise), `auth_email_verifications` (Sprint 5 cree), `auth_password_recoveries` (Sprint 5 cree), `audit_log` (Sprint 2 utilise).
- **Redis DB 1** : SESSIONS (sessions actives + blacklist + indexes user_sessions / family).
- **Redis DB 2** : LOCKOUTS (lockout state user + IP).
- **Redis DB 3** : RATE_LIMIT (throttler counters).
- **Redis DB 4** : MFA (challenge tokens + setup pending tokens).

### Kafka topics

- `insurtech.events.auth.{event_kind}` -- 22 topics auth events publies par AuditAuthService.
- Consumers anticipates : Sprint 18 SecurityIncidentService, Sprint 22 Analytics, Sprint 33 SIEM.

### Conformite reglementaire

- **Loi 09-08 CNDP** : password hash robuste (Argon2id), notification breach 72h hooks (Sprint 18), audit log 5 ans, anti-enumeration sur signup et forgot-password.
- **ACAPS circulaire 2024** : MFA mandatory pour broker_admin / garage_admin via `isMfaMandatory()` helper, audit complet operations, defense brute force.
- **NIST SP 800-63B** : AAL2 conforme via TOTP MFA, IAL2 via email verification, recovery process verifiable et OOB channel.
- **Bank Al-Maghrib 2014/G/4** : encryption at rest preparee (Sprint 35 Atlas KMS).
- **OWASP** : ASVS section 11 (rate limit), Authentication Cheat Sheet 2024, A07:2021 (anti-enum), A02:2021 (crypto failures).
- **RFC 7519** (JWT), **RFC 6238** (TOTP), **RFC 9106** (Argon2), **RFC 4226** (HOTP), **RFC 4648** (base32), **RFC 9700** (OAuth 2.0 BCP).

---

## Dependencies cross-task

```
2.1.1 (contracts)
   |
   v
2.1.2 (Argon2) <-- 2.1.3 (Crypto) <-- 2.1.4 (JWT) <-- 2.1.5 (Session)
   |                                                       |
   v                                                       v
   +------------------> 2.1.6 (AuthController/Service) <---+
                              |
                              v
                        2.1.7 (MFA Service)
                              |
                              v
                        2.1.8 (MFA endpoints + Guard)
                              |
                              v
                        2.1.9 (Signup + Email Verification)
                              |
                              v
                        2.1.10 (Lockout)
                              |
                              v
                        2.1.11 (Account Recovery)
                              |
                              v
                        2.1.12 (Audit Service)
                              |
                              v
                        2.1.13 (EmailService - consume by 2.1.9 / 2.1.11)
                              |
                              v
                        2.1.14 (Rate Limit)
                              |
                              v
                        2.1.15 (E2E Tests - validate all)
```

---

## Decisions strategiques referencees

| Decision | Pertinence Sprint 5 | Tasks impactees |
|----------|---------------------|------------------|
| decision-001 (Monorepo pnpm + Turborepo) | Totale | 2.1.1 |
| decision-002 (TypeScript Strict) | Totale | Toutes |
| decision-005 (Skalean AI Frontier) | Indirecte (Sprint 31 ServiceJwtPayload prepare) | 2.1.1 |
| decision-006 (No-emoji ABSOLU) | Totale | Toutes |
| decision-007 (Zod runtime) | Totale | 2.1.1, 2.1.6, 2.1.9, 2.1.11 |
| decision-008 (Cloud souverain MA) | Indirecte (Sprint 35 Atlas) | Toutes |
| decision-013 (Argon2id over bcrypt) | Totale | 2.1.2, 2.1.7, 2.1.11 |
| decision-014 (JWT HS256 Sprint 5, RS256 Sprint 14) | Totale | 2.1.4, 2.1.5 |
| decision-015 (AES-256-GCM standard) | Totale | 2.1.3, 2.1.7 |
| decision-016 (TOTP RFC 6238) | Totale | 2.1.7, 2.1.8 |
| decision-018 (Templates Handlebars) | Totale | 2.1.13 |
| decision-009 (Multi-locale) | Totale | 2.1.13 |

---

## Tests Coverage Sprint 5

| Type | Nombre | Couverture |
|------|--------|------------|
| Unit tests | 350+ | >= 90% lines |
| Integration tests | 50+ | Cross-services flows |
| E2E tests | 15+ | 14/14 endpoints auth |
| Load tests | 5+ | 100-1000 concurrent users |
| Chaos tests | 4+ (Sprint 33) | Redis failover, Lua script reload |
| Security tests | 30+ | Anti-enum, timing-safe, replay, CSRF, XSS |

---

## Variables environnement Sprint 5 (recapitulatif)

```env
# Argon2 + Pepper (Tache 2.1.2)
PASSWORD_PEPPER=<openssl rand -base64 48>
PASSWORD_PEPPER_VERSION=1

# Crypto AES-GCM (Tache 2.1.3)
MFA_SECRET_ENCRYPTION_KEY=<openssl rand -hex 32>
HMAC_WEBHOOK_KEY=<openssl rand -base64 48>

# JWT (Tache 2.1.4)
JWT_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48 different from JWT_SECRET>
JWT_ISSUER=skalean-insurtech-api
JWT_AUDIENCE=skalean-insurtech-app
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
JWT_LEEWAY_SECONDS=5

# Sessions (Tache 2.1.5)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_SESSIONS_DB=1
SESSION_DEFAULT_TTL_SECONDS=28800
SESSION_REMEMBER_ME_TTL_SECONDS=2592000

# MFA (Tache 2.1.7)
MFA_TOTP_ISSUER=Skalean InsurTech
MFA_SETUP_PENDING_TTL_SECONDS=1800
MFA_CHALLENGE_TTL_SECONDS=300

# Lockout (Tache 2.1.10)
LOCKOUT_FAILED_ATTEMPTS_PER_TIER=5
LOCKOUT_IP_MAX_FAILS=50
LOCKOUT_IP_WINDOW_SECONDS=900
LOCKOUT_IP_LOCK_DURATION_SECONDS=3600

# Email (Tache 2.1.13)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_ADDRESS=noreply@skalean.ma
SMTP_FROM_NAME=Skalean InsurTech
SMTP_REPLY_TO=support@skalean.ma
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
MAILHOG_API_URL=http://localhost:8025
FRONTEND_BASE_URL=https://app.skalean.ma

# Rate Limit (Tache 2.1.14)
REDIS_RATE_LIMIT_DB=3
RATE_LIMIT_GLOBAL_TTL_MS=60000
RATE_LIMIT_GLOBAL_LIMIT=100
```

Total : ~30 variables d'environnement Sprint 5.

---

## Workflow d'execution recommande

L'ordre d'execution suit le graphe de dependances. Pour Claude Code :

```bash
# Lot 1 : Fondations cryptographiques
1. Implement task-2.1.1-init-auth-package.md
2. Implement task-2.1.2-argon2id-service.md
3. Implement task-2.1.3-crypto-services.md

# Lot 2 : Infrastructure JWT + Session
4. Implement task-2.1.4-jwt-service.md
5. Implement task-2.1.5-session-service.md
6. Implement task-2.1.6-auth-module-controller.md

# Lot 3 : MFA + Signup
7. Implement task-2.1.7-mfa-service.md
8. Implement task-2.1.8-mfa-required-guard.md
9. Implement task-2.1.9-signup-email-verification.md

# Lot 4 : Defenses + Audit
10. Implement task-2.1.10-lockout-service.md
11. Implement task-2.1.11-account-recovery.md
12. Implement task-2.1.12-audit-auth-service.md

# Lot 5 : Email + Rate Limit + Tests E2E
13. Implement task-2.1.13-email-service.md
14. Implement task-2.1.14-rate-limiting-auth.md
15. Implement task-2.1.15-e2e-tests.md
```

Apres chaque tache : commit conventionnel + PR + merge avant de passer a la suivante.

---

## Sortie Sprint 5 (criteres acceptance Sprint complete)

A la fin Sprint 5, les criteres suivants doivent tous etre satisfaits pour considerer le Sprint clos :

### Tests
- [ ] 350+ unit tests passent localement (`pnpm -r test`)
- [ ] 50+ integration tests passent
- [ ] 15+ E2E tests Playwright passent localement (`pnpm --filter @insurtech/api test:e2e`)
- [ ] CI GitHub Actions Sprint 32 passe (workers=4)
- [ ] Coverage global Sprint 5 >= 88% lines
- [ ] Aucun test flaky (5 runs consecutifs passent)

### Endpoints
- [ ] 14 endpoints REST `/api/v1/auth/*` exposes et fonctionnels
- [ ] OpenAPI 3.1 specification generee Sprint 33 mais ebauchee Sprint 5
- [ ] Swagger UI accessible `/api/v1/docs` localement

### Securite
- [ ] Argon2id durci OWASP 2024 (memoryCost 65536, timeCost 3, parallelism 4)
- [ ] JWT HS256 + token_family rotation + theft detection operationnel
- [ ] MFA TOTP RFC 6238 + 6 recovery codes Argon2id-hashed + AAD encryption
- [ ] Lockout progressif 5/15/60 min + permanent + IP tracking 50/15min
- [ ] Rate limiting 9 endpoints differencie
- [ ] Anti-enumeration sur signup et forgot-password
- [ ] Audit log + Kafka events sur 22 event types

### Conformite
- [ ] Loi 09-08 CNDP : password hash + notification breach 72h hooks
- [ ] ACAPS 2024 : MFA mandatory roles + audit 5 ans
- [ ] NIST SP 800-63B AAL2 conforme
- [ ] Aucune emoji dans aucun fichier (decision-006)
- [ ] No-console.log dans le code source

### Operations
- [ ] Variables environnement documentees `.env.example`
- [ ] Migrations Postgres reverse + replay sans erreur
- [ ] Scripts Helm Sprint 35 anticipes
- [ ] Runbooks operationnels documentes (incidents, recovery, monitoring)
- [ ] Metriques Prometheus exposees (Sprint 33 dashboard ready)

---

## Sprint 6 demarre avec

Sprint 6 (Multi-tenant) construit sur Sprint 5 :

- **AuthContext disponible** : chaque requete authentifiee a `request.auth.subject.user.tenant_id` typed.
- **TenantContextService** lit `tenant_id` du JwtPayload et seede AsyncLocalStorage.
- **TenantGuard** chained avec JwtAuthGuard force header `x-tenant-id` consistent.
- **RLS policies Postgres** `app_current_tenant()` consume tenant_id de la session.
- **invitation_token** dans signup permet pre-assigner tenant_id (Sprint 6 Tache 6.1.X).
- **Cross-tenant isolation strict** verifie par tests E2E Sprint 6.

Sprint 7 (RBAC) consume :
- 12 roles enum Tache 2.1.1 (`AuthRole`).
- `request.auth.subject.user.role` typed.
- `@Roles()` decorator + `RolesGuard` Sprint 7.

Sprint 11 (Pay) decore POST /payments avec `@RequireMfa()` Tache 2.1.8.

Sprint 14 (Security hardening) :
- Rotation JWT_SECRET vers RS256.
- Captcha Sprint 14.
- Outbox pattern pour AuditAuthService.

Sprint 18 (Notifications) consume Kafka events `auth.suspicious_login`, `auth.refresh_replay_detected` via SecurityIncidentService.

Sprint 23 (WebAuthn) etend MfaService avec WebAuthn pour garage_technicien PWA.

Sprint 25 (Cross-tenant impersonate) ajoute endpoint `/admin/impersonate/:tenantId` consume LockoutService.clearLockout.

Sprint 27 (Admin Console) implemente endpoints admin `/admin/users/:id/unlock`, `/admin/users/lockout-history`, `/admin/users/ip/:ip/unblock`.

Sprint 33 (Pentest) audit complet Sprint 5 + correlation SIEM cross-tenants.

Sprint 35 (Production) :
- Atlas Cloud Services Benguerir (DC1 + DR DC2).
- Atlas KMS pour secrets (JWT, MFA, pepper).
- SendGrid Transactional pour email production.
- DKIM/SPF/DMARC DNS configuration.
- Cluster Redis multi-AZ.

---

## Statistiques Sprint 5 (estimees)

- **Lignes de code TypeScript** : ~12,000 (services + controllers + tests + helpers + types).
- **Templates Handlebars** : 40 fichiers (10 templates x 4 locales) + 1 layout.
- **Migrations SQL** : 2 nouvelles (auth_email_verifications, auth_password_recoveries) + extensions auth_users.
- **Tests** : 350+ unit, 50+ integration, 15+ E2E = ~415+ tests total.
- **Coverage cible** : >= 88% global, >= 92% modules critiques crypto.
- **Effort dev estime** : 78h (1 ingenieur senior, 2 semaines a 4h/jour productive).
- **Documentation generee** : 15 prompts taches denses (~1.3 MB markdown).

---

## Generation Date

Genere le **2026-05-06** par Cowork Generation Agent v2 sur la base du meta-prompt B-05 v2.2.

---

## Contact et Validation

Apres execution complete des 15 taches par Claude Code, valider via :
1. `pnpm typecheck` -- 0 erreur sur tout le monorepo.
2. `pnpm test` -- tous tests passent.
3. `pnpm test:e2e` -- 15 scenarios E2E passent.
4. `pnpm build` -- 0 erreur build.
5. Lint Biome `pnpm lint:check` -- 0 erreur.
6. Pre-commit hooks Husky -- pass.

Si tous criteres OK, Sprint 5 est livrable. Demarrer Sprint 6 (Multi-tenant).

---

**Sprint 5 -- Auth Foundations -- COMPLETE.**
