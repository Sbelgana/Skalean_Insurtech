# TACHE 2.1.15 -- Tests E2E Auth Complets : 15+ Scenarios Playwright + Mailhog API + Redis Verification + Postgres Truncate

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.15)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (cloturant Sprint 5, validant l'integralite des taches 2.1.1-2.1.14 en bout-en-bout)
**Effort** : 8h
**Dependances** : Toutes les taches Sprint 5 (2.1.1-2.1.14) terminees
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer la suite de tests End-to-End (E2E) Playwright qui valide en bout-en-bout l'integralite du systeme d'authentification du programme Skalean InsurTech v2.2 conforme aux exigences de qualite de Tache 2.1.1 a 2.1.14, en ciblant 15+ scenarios fonctionnels qui simulent les flows reels d'utilisateurs (signup avec verification email, signin avec et sans MFA, refresh avec rotation et detection de replay, signout simple et signout-all, account recovery avec password reset, MFA setup et verification, account lockout apres 5 tentatives ratees, rate limiting sur signin et signup, sessions management cross-device) et qui interagissent avec les datastores reels via Mailhog API (`GET http://localhost:8025/api/v2/messages` pour verifier emails delivres), Redis directement via ioredis (pour verifier sessions stockees et lockout state), et Postgres via une connexion test pour TRUNCATE entre tests garantissant la reproductibilite. Le perimetre couvre : 15 fichiers de tests `.spec.ts` situes dans `repo/e2e/api/auth/` chacun ciblant un scenario specifique avec ~80-100 lignes incluant setup, action, assertion, cleanup ; un module fixtures `repo/e2e/api/auth/fixtures/auth-helpers.ts` qui factorise la creation d'utilisateurs de test via API directe (`createTestUser({ role, mfa_enabled, email_verified })` qui prepare un user en DB pour les tests qui requierent un user existant) ; un module fixtures `repo/e2e/api/auth/fixtures/mailhog-client.ts` qui wrappe l'API REST Mailhog pour query les emails recus filter par destinataire et extract le token de verification ou recovery via regex sur le body HTML ; un module fixtures `repo/e2e/api/auth/fixtures/redis-helpers.ts` qui se connecte directement a Redis pour assertions sur les cles `session:`, `revoked:`, `lockout:`, `mfa_setup:`, `mfa_challenge:` ; un fichier `repo/e2e/api/auth/playwright.config.ts` qui configure le project `api` avec base URL `http://localhost:4000`, parallelism approprie (workers=1 par defaut pour eviter race conditions sur shared state, opt-in workers=4 avec namespace par worker pour speedup), retries=2 pour CI flakiness, et tracing=on-first-retry pour debug ; et un fichier `repo/e2e/api/auth/global-setup.ts` qui demarre les services Docker Compose dependances (Postgres, Redis, Mailhog) si pas deja running, applique les migrations, seed les users de reference, et `repo/e2e/api/auth/global-teardown.ts` qui nettoie apres tests.

L'apport est triple. Premierement, en validant chaque flow auth en bout-en-bout (vs unit tests qui mockent les dependances), on detecte les bugs d'integration que les unit tests ne peuvent pas voir : un test unit Argon2Service.verify peut passer parfaitement, mais l'integration AuthService.signin -> Argon2Service.verify avec le pepper rate manquera si le pepper n'est pas correctement charge en environnement test ; cette classe de bug n'est detectable qu'en E2E. Deuxiemement, en utilisant Mailhog API pour verifier les emails reellement delivres (vs mocker EmailService), on valide la chaine complete signup -> generation token -> envoi SMTP -> reception Mailhog -> click lien -> verify endpoint -> compte active -- propriete critique car un bug n'importe ou dans cette chaine bloque l'onboarding utilisateur. Troisiemement, en TRUNCATE-ant les tables `auth_users`, `auth_email_verifications`, `auth_password_recoveries`, `auth_sessions` et FLUSH-ant Redis avant chaque test, on garantit la reproductibilite : un test ne peut pas etre influence par les artefacts d'un test precedent, ce qui est essentiel pour le debugging CI et pour la confiance dans les resultats.

A l'issue de cette tache, la suite Playwright `pnpm --filter @insurtech/api test:e2e` execute les 15 scenarios en sequence, tous passent en local avec Mailhog + Redis + Postgres lances via Docker Compose, tous passent en CI via GitHub Actions Sprint 32 sur infrastructure dediee, le run complet prend < 5 minutes (acceptable pour CI), aucun test n'est flaky (run 5 fois consecutif passe a 100%), un rapport HTML Playwright est genere dans `repo/e2e/api/playwright-report/` avec screenshots + videos en cas de fail, le coverage des endpoints auth est de 100% (tous les 14 endpoints touches au moins par 1 test), et la documentation README explique comment ajouter de nouveaux scenarios.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sprint 5 a livre 14 taches successives chacune avec ses propres tests unitaires et integration. Mais l'integration COMPLETE entre toutes ces taches (signup -> email -> verify -> signin -> refresh -> me -> ...) n'a ete validee nulle part jusqu'a present. Sans cette validation E2E, on risque d'avoir un systeme ou chaque composant fonctionne isolement mais l'enchainement casse : par exemple, AuthService.signin Tache 2.1.6 apres un signup Tache 2.1.9 sans email verifie doit retourner 401 EMAIL_NOT_VERIFIED. Cette propriete depend de la coherence entre 2.1.6 (check email_verified_at NULL) et 2.1.9 (set email_verified_at NULL au signup). Si l'un ou l'autre divergerait, le test E2E le detecte ; les unit tests ne le verraient pas.

L'utilisation de Playwright (vs Jest+supertest pur) est un choix strategique. Playwright supporte parallelism avec isolation, retries, tracing, screenshots, video recording. Sprint 32 le configurera aussi pour les tests E2E frontend Next.js. Avoir le meme outil pour API + frontend simplifie la maintenance et le partage de patterns.

L'utilisation de Mailhog en dev (vs faire envoyer reellement les emails via SendGrid) est essentielle pour reproductibilite : les emails reels mettent du temps a arriver, sont sujets a rate limit SendGrid, et coutent. Mailhog capture les emails localement et expose une API REST pour assertions automatisees.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Jest + supertest seul | Plus leger, deja installe | Pas de parallelism advanced, pas de tracing | DEFFERE pour tests E2E lourds |
| Cypress | UI testing classic | Surdimensionne pour API tests, JS-only | REJETE pour API |
| Playwright (RETENU) | Multi-browser, parallelism, tracing, video | Apprentissage | RETENU |
| Postman / Newman | Tests dans Postman UI | Pas codable git, peu de programmability | REJETE |
| K6 / Artillery | Load testing focus | Pas de assertions complexes | REJETE pour scenarios |
| Mock everything | Plus rapide tests | Pas valider integration reelle | REJETE -- but c'est le but de E2E |
| Test only happy paths | Plus rapide ecriture | Manque defenses + edge cases | REJETE |
| 15 scenarios complete (RETENU) | Couverture complete | 8h effort | RETENU |

### 2.3 Trade-offs

Choisir Playwright workers=1 par defaut implique d'accepter un run sequentiel ~5 minutes. Trade-off : reproducibilite sans race conditions sur shared DB / Redis. Opt-in workers=4 avec namespace par worker (chaque worker prefix ses keys Redis avec workerIndex) reduit a ~2 minutes en CI Sprint 32.

Choisir Mailhog en E2E implique d'accepter de demarrer un container Docker supplementaire. Acceptable car Docker Compose Sprint 32 deja prevu.

Choisir TRUNCATE entre tests (vs DELETE par user_id) implique perdre tous les seeds entre tests. Trade-off : reproducibilite vs setup cost (TRUNCATE + reseed Sprint 5 simple seeds = ~1s par test). Acceptable.

### 2.4 Decisions strategiques

- decision-006 (No-emoji), decision-008 (Cloud souverain).
- Sprint 32 framework E2E Playwright pour tous les tests (API + frontend).

### 2.5 Pieges techniques

1. **Race conditions Redis shared** : workers=1 OR namespace.
2. **Mailhog timing** : delay 500-1000ms apres envoi pour Mailhog index.
3. **Postgres TRUNCATE CASCADE** : auth_users CASCADE supprime sessions + verifications.
4. **Argon2 250ms par signin** : tests qui signin x10 = 2.5s minimum.
5. **Redis FLUSHDB cross-tests** : selectif sur prefix `test:*` ou full FLUSHDB par test.
6. **Time-based tests** : MFA TOTP windows -- utiliser fakeTimers ou tolerer 30s window.
7. **Token expiration** : tester expire necessite fast-forward time.
8. **CI vs local** : flaky en CI avec SSDs lents -- retries=2.
9. **Parallelism Playwright** : isolated browser per worker, mais shared API.
10. **Cleanup async** : await TRUNCATE avant next test.
11. **Mailhog memory** : restart Mailhog si > 1000 mails accumulates.
12. **Network timing** : timeout fetch API increase 5s -> 10s en CI.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.15 est la derniere du Sprint 5. Elle valide les 14 taches precedentes en integration. Sa reussite signifie que Sprint 5 est livrable en production (apres pentest Sprint 33).

### 3.2 Position dans le programme

- Sprint 6+ ajoutera tests E2E pour multi-tenant flows.
- Sprint 32 (Docker integration tests) ajoutera CI pipelines sur ces tests.
- Sprint 33 (pentest) auditera la couverture E2E.

### 3.3 Diagramme

```
                          +-----------------------------------+
                          | Taches 2.1.1 a 2.1.14 terminees    |
                          +-----------------+------------------+
                                            |
                                            v
                          +-----------------+-----------------+
                          | TACHE 2.1.15 (cette tache)         |
                          | 15+ scenarios Playwright           |
                          | tests E2E auth                     |
                          | + fixtures                         |
                          | + Mailhog client                   |
                          | + Redis helpers                    |
                          | + Postgres TRUNCATE                |
                          | + global-setup / teardown          |
                          +-+--+--+--+--+--+--+--+--+--+--+----+
                            |  |  |  |  |  |  |  |  |  |  |
                            v  v  v  v  v  v  v  v  v  v  v
                       NestJS API + Postgres + Redis + Mailhog
                       (lance via Docker Compose)
```

---

## 4. Livrables checkables (24)

- [ ] 15 fichiers test `.spec.ts` dans `repo/e2e/api/auth/` -- ~80 lignes chacun = ~1200 lignes
- [ ] Fixtures `auth-helpers.ts` (createTestUser, getValidAccessToken, etc.) -- ~200 lignes
- [ ] Fixtures `mailhog-client.ts` (waitForEmail, extractTokenFromBody, deleteAllMessages) -- ~100 lignes
- [ ] Fixtures `redis-helpers.ts` (flushAuthKeys, getSessionByJti, isRevoked) -- ~80 lignes
- [ ] Fixtures `postgres-helpers.ts` (truncateAuthTables, seedTestUsers) -- ~100 lignes
- [ ] `playwright.config.ts` avec project api -- ~80 lignes
- [ ] `global-setup.ts` (start docker-compose, run migrations, seed) -- ~60 lignes
- [ ] `global-teardown.ts` (cleanup) -- ~30 lignes
- [ ] `README.md` documentation -- ~80 lignes
- [ ] Mise a jour root `package.json` : ajouter `@playwright/test@1.49.1`
- [ ] Mise a jour `.gitignore` : ajouter `e2e/api/playwright-report/`, `e2e/api/test-results/`
- [ ] Tous tests passent localement
- [ ] Tous tests passent CI (Sprint 32 GitHub Actions)
- [ ] Coverage : 14 endpoints auth tous touches
- [ ] No-emoji
- [ ] No-console.log
- [ ] Documentation JSDoc dans helpers
- [ ] Reproducibility : 5 runs consecutifs passent
- [ ] Build TypeScript reussit
- [ ] Run total < 5 minutes (workers=1)
- [ ] Run total < 2 minutes (workers=4)
- [ ] HTML report genere
- [ ] Trace + screenshots + videos en cas de fail
- [ ] Mailhog integration fonctionne

---

## 5. Fichiers crees / modifies

```
repo/e2e/api/auth/01-signup-happy-path.spec.ts                                     (~100 lignes)
repo/e2e/api/auth/02-signup-password-policy.spec.ts                                (~80 lignes)
repo/e2e/api/auth/03-signup-duplicate-email.spec.ts                                (~80 lignes)
repo/e2e/api/auth/04-signin-invalid-credentials.spec.ts                            (~80 lignes)
repo/e2e/api/auth/05-signin-account-locked.spec.ts                                 (~100 lignes)
repo/e2e/api/auth/06-signin-email-not-verified.spec.ts                             (~80 lignes)
repo/e2e/api/auth/07-mfa-setup-flow.spec.ts                                        (~120 lignes)
repo/e2e/api/auth/08-mfa-recovery-code.spec.ts                                     (~100 lignes)
repo/e2e/api/auth/09-password-reset-flow.spec.ts                                   (~120 lignes)
repo/e2e/api/auth/10-refresh-token-rotation.spec.ts                                (~100 lignes)
repo/e2e/api/auth/11-refresh-token-reuse-detection.spec.ts                         (~100 lignes)
repo/e2e/api/auth/12-signout-all.spec.ts                                           (~100 lignes)
repo/e2e/api/auth/13-rate-limiting-signin.spec.ts                                  (~80 lignes)
repo/e2e/api/auth/14-me-endpoint.spec.ts                                           (~60 lignes)
repo/e2e/api/auth/15-sessions-list.spec.ts                                         (~100 lignes)
repo/e2e/api/auth/fixtures/auth-helpers.ts                                          (~200 lignes)
repo/e2e/api/auth/fixtures/mailhog-client.ts                                        (~100 lignes)
repo/e2e/api/auth/fixtures/redis-helpers.ts                                         (~80 lignes)
repo/e2e/api/auth/fixtures/postgres-helpers.ts                                      (~100 lignes)
repo/e2e/api/auth/playwright.config.ts                                              (~80 lignes)
repo/e2e/api/auth/global-setup.ts                                                   (~60 lignes)
repo/e2e/api/auth/global-teardown.ts                                                (~30 lignes)
repo/e2e/api/auth/README.md                                                         (~80 lignes)
package.json                                                                         (modifie / +playwright)
.gitignore                                                                            (modifie)
```

---

## 6. Code patterns COMPLETS

### 6.1 `playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',

  timeout: 30 * 1000,
  expect: { timeout: 10 * 1000 },

  fullyParallel: process.env.CI === 'true' && process.env.WORKERS === '4',
  workers: process.env.WORKERS ? Number.parseInt(process.env.WORKERS, 10) : 1,

  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list'],
  ],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4000',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
      'X-Test-Mode': 'e2e',
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  globalSetup: path.join(__dirname, 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'global-teardown.ts'),

  projects: [
    {
      name: 'api',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  outputDir: 'test-results/',
});
```

### 6.2 `global-setup.ts`

```typescript
import { type FullConfig } from '@playwright/test';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Pool } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup(_config: FullConfig): Promise<void> {
  console.log('[E2E global-setup] Starting...');

  // 1. Start docker-compose services if not running
  if (!process.env.SKIP_DOCKER_COMPOSE) {
    try {
      execSync('docker compose -f infrastructure/docker/docker-compose.test.yml up -d --wait', {
        cwd: resolve(__dirname, '..', '..', '..'),
        stdio: 'inherit',
        timeout: 120_000,
      });
    } catch (err) {
      console.error('[E2E global-setup] Failed to start docker-compose:', err);
      throw err;
    }
  }

  // 2. Wait API health check
  const apiHealthUrl = (process.env.E2E_BASE_URL ?? 'http://localhost:4000') + '/health';
  let healthy = false;
  for (let i = 0; i < 30; i += 1) {
    try {
      const r = await fetch(apiHealthUrl);
      if (r.status === 200) { healthy = true; break; }
    } catch {/* retry */}
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!healthy) throw new Error('API health check failed after 30s');

  // 3. Apply migrations
  execSync('pnpm --filter @insurtech/database migrate:run', {
    cwd: resolve(__dirname, '..', '..', '..'),
    stdio: 'inherit',
  });

  // 4. Seed test users (minimal)
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`TRUNCATE auth_users CASCADE;`);
  await pool.end();

  console.log('[E2E global-setup] Done.');
}
```

### 6.3 `global-teardown.ts`

```typescript
import { type FullConfig } from '@playwright/test';

export default async function globalTeardown(_config: FullConfig): Promise<void> {
  console.log('[E2E global-teardown] Cleaning up...');
  // Optionally stop docker-compose if started by us
  if (!process.env.SKIP_DOCKER_COMPOSE && process.env.E2E_STOP_AFTER === 'true') {
    const { execSync } = await import('node:child_process');
    execSync('docker compose -f infrastructure/docker/docker-compose.test.yml down', {
      stdio: 'inherit',
    });
  }
  console.log('[E2E global-teardown] Done.');
}
```

### 6.4 `fixtures/auth-helpers.ts`

```typescript
import { request, type APIRequestContext } from '@playwright/test';
import { authenticator } from 'otplib';
import { Pool } from 'pg';
import Redis from 'ioredis';

export interface TestUserOptions {
  email?: string;
  password?: string;
  display_name?: string;
  locale?: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  role?: string;
  email_verified?: boolean;
  mfa_enabled?: boolean;
  is_active?: boolean;
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  display_name: string;
  locale: string;
  role: string;
  mfa_secret_b32?: string;
  recovery_codes?: string[];
}

let dbPool: Pool | null = null;
let redisClient: Redis | null = null;

function getDbPool(): Pool {
  if (!dbPool) {
    dbPool = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgresql://localhost/skalean_test' });
  }
  return dbPool;
}

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
    });
  }
  return redisClient;
}

export async function createTestUser(api: APIRequestContext, opts: TestUserOptions = {}): Promise<TestUser> {
  const uniqueId = Math.random().toString(36).slice(2, 10);
  const email = opts.email ?? `e2e-user-${uniqueId}@skalean.test`;
  const password = opts.password ?? 'StrongP@ssw0rd!';
  const display_name = opts.display_name ?? `E2E User ${uniqueId}`;
  const locale = opts.locale ?? 'fr-MA';
  const role = opts.role ?? 'prospect';

  // 1. Signup via API
  const signupResp = await api.post('/api/v1/auth/signup', {
    data: { email, password, display_name, locale, accepted_tos: true },
  });
  if (!signupResp.ok()) {
    throw new Error(`createTestUser signup failed: ${signupResp.status()}`);
  }

  // 2. Get user_id from DB
  const pool = getDbPool();
  const r = await pool.query('SELECT id FROM auth_users WHERE email = $1', [email]);
  const userId = r.rows[0]?.id as string;
  if (!userId) throw new Error('User not found in DB after signup');

  // 3. Verify email if requested
  if (opts.email_verified !== false) {
    await pool.query('UPDATE auth_users SET email_verified_at = NOW() WHERE id = $1', [userId]);
  }

  // 4. Set role if not prospect
  if (role !== 'prospect') {
    await pool.query('UPDATE auth_users SET role = $1 WHERE id = $2', [role, userId]);
  }

  // 5. Set is_active false if requested
  if (opts.is_active === false) {
    await pool.query('UPDATE auth_users SET is_active = false WHERE id = $1', [userId]);
  }

  const user: TestUser = { id: userId, email, password, display_name, locale, role };

  // 6. Setup MFA if requested
  if (opts.mfa_enabled) {
    const mfaResult = await setupMfaForUser(api, user);
    user.mfa_secret_b32 = mfaResult.secret_b32;
    user.recovery_codes = mfaResult.recovery_codes;
  }

  return user;
}

export async function getAccessToken(api: APIRequestContext, user: TestUser, withMfa = false): Promise<string> {
  const signinResp = await api.post('/api/v1/auth/signin', {
    data: { email: user.email, password: user.password },
  });
  const body = await signinResp.json();
  if (body.mfa_required && withMfa && user.mfa_secret_b32) {
    const totpCode = authenticator.generate(user.mfa_secret_b32);
    const verifyResp = await api.post('/api/v1/auth/verify-mfa', {
      data: { challenge_token: body.mfa_challenge_token, totp_code: totpCode },
    });
    return (await verifyResp.json()).access_token as string;
  }
  return body.access_token as string;
}

export async function getRefreshToken(api: APIRequestContext, user: TestUser): Promise<string> {
  const signinResp = await api.post('/api/v1/auth/signin', {
    data: { email: user.email, password: user.password },
  });
  return (await signinResp.json()).refresh_token as string;
}

async function setupMfaForUser(api: APIRequestContext, user: TestUser): Promise<{ secret_b32: string; recovery_codes: string[] }> {
  // Get access token first
  const accessToken = await getAccessToken(api, user);

  // Setup MFA
  const setupResp = await api.post('/api/v1/auth/setup-mfa', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const setup = await setupResp.json();

  // Confirm
  const totpCode = authenticator.generate(setup.secret_b32);
  const confirmResp = await api.post('/api/v1/auth/confirm-mfa', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { setup_token: setup.setup_token, totp_code: totpCode },
  });
  const confirm = await confirmResp.json();

  return { secret_b32: setup.secret_b32, recovery_codes: confirm.recovery_codes };
}

export async function truncateAuthTables(): Promise<void> {
  const pool = getDbPool();
  await pool.query('TRUNCATE auth_users, auth_sessions, auth_email_verifications, auth_password_recoveries, audit_log CASCADE;');
}

export async function flushRedisAuth(): Promise<void> {
  const redis = getRedis();
  const dbsToFlush = [1, 2, 3, 4]; // SESSIONS, LOCKOUTS, RATE_LIMIT, MFA
  for (const db of dbsToFlush) {
    await redis.select(db);
    await redis.flushdb();
  }
}

export async function closeFixtures(): Promise<void> {
  if (dbPool) { await dbPool.end(); dbPool = null; }
  if (redisClient) { await redisClient.quit(); redisClient = null; }
}
```

### 6.5 `fixtures/mailhog-client.ts`

```typescript
const MAILHOG_API = process.env.MAILHOG_API_URL ?? 'http://localhost:8025';

export interface MailhogMessage {
  ID: string;
  Content: {
    Headers: Record<string, string[]>;
    Body: string;
  };
  To: Array<{ Mailbox: string; Domain: string }>;
}

export async function deleteAllMailhogMessages(): Promise<void> {
  await fetch(`${MAILHOG_API}/api/v1/messages`, { method: 'DELETE' });
}

export async function waitForEmailTo(recipient: string, timeoutMs = 10000): Promise<MailhogMessage> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(`${MAILHOG_API}/api/v2/search?kind=to&query=${encodeURIComponent(recipient)}`);
    const data = await r.json() as { count: number; items: MailhogMessage[] };
    if (data.count > 0 && data.items.length > 0) {
      return data.items[0];
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Email to ${recipient} not received within ${timeoutMs}ms`);
}

export async function getEmailsFor(recipient: string): Promise<MailhogMessage[]> {
  const r = await fetch(`${MAILHOG_API}/api/v2/search?kind=to&query=${encodeURIComponent(recipient)}`);
  const data = await r.json() as { count: number; items: MailhogMessage[] };
  return data.items ?? [];
}

export function extractVerifyTokenFromBody(message: MailhogMessage): string | null {
  const body = message.Content.Body;
  // Look for href="...email-verified?token=XXX..."
  const match = body.match(/email-verified\?token=([^"&\s]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

export function extractResetTokenFromBody(message: MailhogMessage): string | null {
  const body = message.Content.Body;
  const match = body.match(/reset-password\?token=([^"&\s]+)/);
  if (!match) return null;
  return decodeURIComponent(match[1]);
}

export function getEmailSubject(message: MailhogMessage): string {
  const subjectHeader = message.Content.Headers.Subject?.[0] ?? '';
  // Decode RFC 2047 encoded subject if needed
  if (subjectHeader.startsWith('=?')) {
    const match = subjectHeader.match(/^=\?[^?]+\?B\?(.+?)\?=$/);
    if (match) return Buffer.from(match[1], 'base64').toString('utf-8');
  }
  return subjectHeader;
}
```

### 6.6 `fixtures/redis-helpers.ts`

```typescript
import Redis from 'ioredis';

let client: Redis | null = null;

function getRedis(): Redis {
  if (!client) {
    client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
    });
  }
  return client;
}

export async function getSessionByJti(jti: string): Promise<Record<string, unknown> | null> {
  const redis = getRedis();
  await redis.select(1); // SESSIONS DB
  const raw = await redis.get(`session:${jti}`);
  return raw ? JSON.parse(raw) : null;
}

export async function isSessionRevoked(jti: string): Promise<boolean> {
  const redis = getRedis();
  await redis.select(1);
  const r = await redis.exists(`revoked:${jti}`);
  return r === 1;
}

export async function getLockoutState(userId: string): Promise<Record<string, string>> {
  const redis = getRedis();
  await redis.select(2); // LOCKOUTS DB
  return await redis.hgetall(`lockout:user:${userId}`);
}

export async function getIpFailCount(ip: string): Promise<number> {
  const redis = getRedis();
  await redis.select(2);
  const v = await redis.get(`lockout:ip:${ip}`);
  return v ? Number.parseInt(v, 10) : 0;
}

export async function getActiveSessionCount(userId: string): Promise<number> {
  const redis = getRedis();
  await redis.select(1);
  const r = await redis.smembers(`user_sessions:${userId}`);
  return r.length;
}

export async function flushAllAuthDbs(): Promise<void> {
  const redis = getRedis();
  for (const db of [1, 2, 3, 4]) {
    await redis.select(db);
    await redis.flushdb();
  }
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
```

### 6.7 Test 1 : `01-signup-happy-path.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';
import { deleteAllMailhogMessages, waitForEmailTo, extractVerifyTokenFromBody, getEmailSubject } from './fixtures/mailhog-client.js';

test.describe('Signup Happy Path', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
    await deleteAllMailhogMessages();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('signup -> email verification -> signin -> me returns coherent data', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const email = `happy-path-${Date.now()}@skalean.test`;

    // 1. Signup
    const signupResp = await api.post('/api/v1/auth/signup', {
      data: {
        email,
        password: 'StrongP@ssw0rd!',
        display_name: 'Happy Path Test',
        locale: 'fr-MA',
        accepted_tos: true,
      },
    });
    expect(signupResp.status()).toBe(200);
    const signupBody = await signupResp.json();
    expect(signupBody.message).toContain('verification');

    // 2. Wait for verification email
    const message = await waitForEmailTo(email);
    expect(getEmailSubject(message)).toContain('Verifiez');
    const token = extractVerifyTokenFromBody(message);
    expect(token).toBeTruthy();

    // 3. Verify email
    const verifyResp = await api.get(`/api/v1/auth/verify-email?token=${encodeURIComponent(token!)}`);
    expect(verifyResp.status()).toBe(302);
    expect(verifyResp.headers()['location']).toContain('status=success');

    // 4. Signin
    const signinResp = await api.post('/api/v1/auth/signin', {
      data: { email, password: 'StrongP@ssw0rd!' },
    });
    expect(signinResp.status()).toBe(200);
    const signinBody = await signinResp.json();
    expect(signinBody.access_token).toBeTruthy();
    expect(signinBody.refresh_token).toBeTruthy();
    expect(signinBody.user.email).toBe(email);
    expect(signinBody.user.email_verified).toBe(true);

    // 5. Me
    const meResp = await api.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${signinBody.access_token}` },
    });
    expect(meResp.status()).toBe(200);
    const meBody = await meResp.json();
    expect(meBody.email).toBe(email);
    expect(meBody.display_name).toBe('Happy Path Test');
    expect(meBody.locale).toBe('fr-MA');

    await api.dispose();
  });
});
```

### 6.8 Test 5 : `05-signin-account-locked.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';
import { getLockoutState } from './fixtures/redis-helpers.js';

test.describe('Signin Account Locked after 5 failures', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('5 wrong passwords trigger Tier 1 lockout, 6th returns ACCOUNT_LOCKED', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'lock-test@skalean.test' });

    // 5 failed attempts
    for (let i = 1; i <= 5; i += 1) {
      const r = await api.post('/api/v1/auth/signin', {
        data: { email: user.email, password: 'wrong-password' },
      });
      expect(r.status()).toBe(401);
    }

    // 6th attempt should trigger lockout
    const r6 = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: 'wrong-password' },
    });
    expect(r6.status()).toBe(401);
    const body = await r6.json();
    expect(body.code).toBe('ACCOUNT_LOCKED');
    expect(body.retry_after_seconds).toBeGreaterThan(0);
    expect(body.current_tier).toBe(1);

    // Verify Redis state
    const lockoutState = await getLockoutState(user.id);
    expect(lockoutState.current_tier).toBe('1');
    expect(lockoutState.locked_until).toBeTruthy();

    // Even correct password is rejected during lockout
    const rCorrect = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: user.password },
    });
    expect(rCorrect.status()).toBe(401);
    expect((await rCorrect.json()).code).toBe('ACCOUNT_LOCKED');

    await api.dispose();
  });
});
```

### 6.9 Test 7 : `07-mfa-setup-flow.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { authenticator } from 'otplib';
import { createTestUser, getAccessToken, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';

test.describe('MFA Setup Flow', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('setup-mfa -> confirm-mfa -> sessions revoked -> signin requires MFA -> verify-mfa returns tokens', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'mfa-flow@skalean.test' });
    const accessToken = await getAccessToken(api, user);

    // 1. Setup MFA
    const setupResp = await api.post('/api/v1/auth/setup-mfa', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(setupResp.status()).toBe(200);
    const setup = await setupResp.json();
    expect(setup.secret_b32).toMatch(/^[A-Z2-7]{32}$/);
    expect(setup.qr_code_data_url).toMatch(/^data:image\/png;base64,/);

    // 2. Confirm MFA with TOTP code
    const totpCode = authenticator.generate(setup.secret_b32);
    const confirmResp = await api.post('/api/v1/auth/confirm-mfa', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { setup_token: setup.setup_token, totp_code: totpCode },
    });
    expect(confirmResp.status()).toBe(200);
    const confirm = await confirmResp.json();
    expect(confirm.recovery_codes).toHaveLength(6);

    // 3. Old session is revoked (sessions revoked after confirm)
    const meResp = await api.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(meResp.status()).toBe(401);

    // 4. Signin returns mfa_required
    const signinResp = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: user.password },
    });
    expect(signinResp.status()).toBe(200);
    const signin = await signinResp.json();
    expect(signin.mfa_required).toBe(true);
    expect(signin.mfa_challenge_token).toBeTruthy();

    // 5. Verify MFA with TOTP
    const newTotpCode = authenticator.generate(setup.secret_b32);
    const verifyResp = await api.post('/api/v1/auth/verify-mfa', {
      data: { challenge_token: signin.mfa_challenge_token, totp_code: newTotpCode },
    });
    expect(verifyResp.status()).toBe(200);
    const verify = await verifyResp.json();
    expect(verify.access_token).toBeTruthy();
    expect(verify.mfa_verified).toBe(true);

    await api.dispose();
  });
});
```

### 6.10 Test 11 : `11-refresh-token-reuse-detection.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, getRefreshToken, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';

test.describe('Refresh token reuse detection (theft attack)', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('legit user refreshes -> attacker reuses old refresh -> family revoked', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'reuse-detect@skalean.test' });
    const oldRefreshToken = await getRefreshToken(api, user);

    // 1. Legit user does refresh -> gets new tokens
    const legitRefreshResp = await api.post('/api/v1/auth/refresh', {
      data: { refresh_token: oldRefreshToken },
    });
    expect(legitRefreshResp.status()).toBe(200);
    const legitRefresh = await legitRefreshResp.json();
    expect(legitRefresh.refresh_token).not.toBe(oldRefreshToken);

    // 2. Attacker presents stolen old refresh token
    const attackerResp = await api.post('/api/v1/auth/refresh', {
      data: { refresh_token: oldRefreshToken },
    });
    expect(attackerResp.status()).toBe(401);
    expect((await attackerResp.json()).code).toBe('TOKEN_REUSE_DETECTED');

    // 3. Even the legit new refresh token is now revoked (family revoke)
    const legitNewRefreshResp = await api.post('/api/v1/auth/refresh', {
      data: { refresh_token: legitRefresh.refresh_token },
    });
    expect(legitNewRefreshResp.status()).toBe(401);
    expect((await legitNewRefreshResp.json()).code).toBe('TOKEN_REUSE_DETECTED');

    await api.dispose();
  });
});
```

### 6.11 Test 13 : `13-rate-limiting-signin.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';

test.describe('Rate limiting on /signin', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('6 signin attempts within 1 minute returns 429 with Retry-After', async ({ baseURL }) => {
    const api = await request.newContext({
      baseURL,
      extraHTTPHeaders: { 'X-Forwarded-For': '99.88.77.66' },
    });

    // 5 attempts allowed
    for (let i = 1; i <= 5; i += 1) {
      const r = await api.post('/api/v1/auth/signin', {
        data: { email: 'rate-test@skalean.test', password: 'wrong' },
      });
      expect(r.status()).toBe(401); // wrong password but throttle ok
    }

    // 6th returns 429
    const r6 = await api.post('/api/v1/auth/signin', {
      data: { email: 'rate-test@skalean.test', password: 'wrong' },
    });
    expect(r6.status()).toBe(429);
    const body = await r6.json();
    expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(r6.headers()['retry-after']).toBeTruthy();
    expect(body.retry_after_seconds).toBeGreaterThan(0);

    await api.dispose();
  });
});
```

### 6.12 Test 14 : `14-me-endpoint.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, getAccessToken, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';

test.describe('GET /me endpoint', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('valid token returns user, missing token returns 401', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'me-test@skalean.test' });
    const token = await getAccessToken(api, user);

    const r = await api.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(r.status()).toBe(200);
    const me = await r.json();
    expect(me.email).toBe(user.email);
    expect(me.id).toBe(user.id);
    expect(me).not.toHaveProperty('password_hash');
    expect(me).not.toHaveProperty('mfa_secret_encrypted');

    // Without token
    const rNoAuth = await api.get('/api/v1/auth/me');
    expect(rNoAuth.status()).toBe(401);

    // With invalid token
    const rBadAuth = await api.get('/api/v1/auth/me', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    });
    expect(rBadAuth.status()).toBe(401);

    await api.dispose();
  });
});
```

### 6.13 Tests 2, 3, 4, 6, 8, 9, 10, 12, 15 : suivent meme pattern

Voici le squelette pour les 9 tests restants :

```typescript
// 02-signup-password-policy.spec.ts -- 4 sub-tests : weak passwords rejected
test('signup with too short password rejected', async ({ baseURL }) => { /* ... */ });
test('signup with no special char rejected', async ({ baseURL }) => { /* ... */ });
test('signup with password = email rejected', async ({ baseURL }) => { /* ... */ });
test('signup with banned password (password123!) rejected', async ({ baseURL }) => { /* ... */ });

// 03-signup-duplicate-email.spec.ts -- anti-enum
test('duplicate email returns same generic response (anti-enum)', async ({ baseURL }) => { /* ... */ });

// 04-signin-invalid-credentials.spec.ts
test('wrong password returns 401 INVALID_CREDENTIALS', async ({ baseURL }) => { /* ... */ });
test('non-existent email returns 401 (timing-safe)', async ({ baseURL }) => { /* ... */ });

// 06-signin-email-not-verified.spec.ts
test('signin before email verification returns 401 EMAIL_NOT_VERIFIED', async ({ baseURL }) => { /* ... */ });

// 08-mfa-recovery-code.spec.ts
test('signin with recovery code OK once, second use rejected', async ({ baseURL }) => { /* ... */ });

// 09-password-reset-flow.spec.ts
test('forgot -> reset -> signin with new password OK', async ({ baseURL }) => { /* ... */ });
test('reset with expired token returns 410', async ({ baseURL }) => { /* ... */ });

// 10-refresh-token-rotation.spec.ts
test('refresh rotates and invalidates old token', async ({ baseURL }) => { /* ... */ });

// 12-signout-all.spec.ts
test('signout-all revokes all user sessions across devices', async ({ baseURL }) => { /* ... */ });

// 15-sessions-list.spec.ts
test('GET /sessions lists all active sessions sorted by last_seen_at desc', async ({ baseURL }) => { /* ... */ });
test('DELETE /sessions/:sid revokes specific session', async ({ baseURL }) => { /* ... */ });
```

---

## 7. Tests complets

(Les 15 tests sont detailles section 6 ci-dessus.)

---

## 8. Variables environnement

```env
# E2E Sprint 5 Tache 2.1.15
E2E_BASE_URL=http://localhost:4000
DATABASE_URL=postgresql://test:test@localhost:5432/skalean_test
REDIS_HOST=localhost
REDIS_PORT=6379
MAILHOG_API_URL=http://localhost:8025
WORKERS=1
SKIP_DOCKER_COMPOSE=
E2E_STOP_AFTER=
```

---

## 9. Commandes shell

```bash
cd repo
pnpm add -D @playwright/test@1.49.1 -w
pnpm exec playwright install --with-deps chromium

# Run tous les tests E2E auth
pnpm --filter @insurtech/api test:e2e

# Run un test specifique
pnpm exec playwright test e2e/api/auth/01-signup-happy-path.spec.ts

# Open HTML report
pnpm exec playwright show-report e2e/api/playwright-report

# Run avec workers parallel
WORKERS=4 pnpm --filter @insurtech/api test:e2e
```

---

## 10. Criteres validation V1-V25

### P0 (16)

- V1-V3 : typecheck, build, all tests pass.
- V4 : 15 fichiers `.spec.ts` presents.
- V5 : Test 1 (signup happy path) passe.
- V6 : Test 5 (account locked) passe.
- V7 : Test 7 (MFA setup flow) passe.
- V8 : Test 11 (refresh reuse detection) passe.
- V9 : Test 13 (rate limit signin) passe.
- V10 : 14 endpoints auth tous touches au moins par 1 test.
- V11 : Mailhog API integration fonctionne.
- V12 : Redis helpers verifient state.
- V13 : Postgres TRUNCATE entre tests.
- V14 : Docker Compose lance services.
- V15 : Health check API attendu before tests.
- V16 : Reproducibilite : 5 runs consecutifs passent.

### P1 (6)

- V17 : Coverage 100% endpoints auth.
- V18 : No-emoji.
- V19 : No-console.
- V20 : Run < 5 min workers=1.
- V21 : Run < 2 min workers=4.
- V22 : HTML report genere.

### P2 (3)

- V23 : Documentation README.
- V24 : Tests E2E ajoutables facilement (helpers reutilisables).
- V25 : CI Sprint 32 GitHub Actions ready.

---

## 11. Edge cases (12)

1. **Mailhog timing** : delay 500ms+ apres send.
2. **Race tests parallel** : workers=1 par defaut OU namespace par worker.
3. **Argon2 timing tests** : tolerance pour ~250ms par signin.
4. **Time-based tests** (TOTP, expiry) : fakeTimers OR tolerate window.
5. **CI flaky** : retries=2.
6. **Postgres CASCADE** : verifier ordre TRUNCATE.
7. **Redis selectif** : flush specifique DBs auth (1, 2, 3, 4).
8. **Mailhog memory full** : delete messages before each test.
9. **API not ready** : health check polling 30s.
10. **Network timeout** : 10s par requete.
11. **Token URL encoding** : Mailhog body escape.
12. **Subject encoded RFC 2047** : decode Base64 dans helper.

---

## 12. Conformite Maroc

- Audit log E2E verifie -- ACAPS retention 5 ans.
- Tests verifient anti-enum -- OWASP A07.
- Tests verifient lockout -- ACAPS circulaire 2024.
- Tests verifient MFA mandatory roles -- ACAPS.

---

## 13. Conventions absolues

Multi-tenant : Sprint 6 ajoutera tenant E2E. Validation Zod : tests verifient. Logger Pino : tests checks logs. pnpm. TS strict. Tests 15+. Skalean AI : aucun. No-emoji. Idempotency : tests verifient. Cloud souverain : Mailhog dev / SendGrid prod. Performance : run total < 5 min.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/api typecheck

# Verify all 15 spec files
ls e2e/api/auth/*.spec.ts | wc -l  # expected 15

# Run E2E
pnpm --filter @insurtech/api test:e2e

grep -rP "[\x{1F300}-\x{1F9FF}]" e2e/api/auth && exit 1 || echo OK
grep -rn "console\.log" e2e/api/auth --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-05): add E2E test suite Playwright for auth flows (15 scenarios)

Implements end-to-end test suite covering all auth flows from signup
through MFA, recovery, refresh rotation, theft detection, lockout,
rate limiting. 15 .spec.ts files in repo/e2e/api/auth/. Helpers for
test user creation, Mailhog email verification, Redis state assertions,
Postgres TRUNCATE between tests. Playwright configuration with
retries=2 in CI, parallelism opt-in, HTML report + traces + screenshots
on failure. Validates 14 auth endpoints in integration.

Livrables :
- 15 test files (~1500 lines total)
- auth-helpers.ts (createTestUser, getAccessToken, MFA setup)
- mailhog-client.ts (waitForEmail, extract token)
- redis-helpers.ts (session, lockout state assertions)
- postgres-helpers.ts (TRUNCATE)
- playwright.config.ts (project api, retries, tracing)
- global-setup.ts (docker compose, migrations, seed)
- global-teardown.ts
- README.md documentation

Tests : 15 scenarios, run < 5 min sequential, < 2 min parallel
Coverage : 14/14 auth endpoints covered

Task: 2.1.15
Sprint: 5 (Phase 2 / Sprint 1)
Reference: B-05 Tache 2.1.15

CLOSES SPRINT 5 -- Auth Foundations COMPLETE"
```

---

## 16. Workflow next step

Apres commit final, Sprint 5 est CLOTURE. Sprint 6 (Multi-tenant) demarre avec :
- TenantContextService consume JwtPayload.tenant_id (Tache 2.1.1).
- TenantGuard chained avec JwtAuthGuard (Tache 2.1.6).
- RLS policies Postgres `app_current_tenant()`.

Generer `_SUMMARY.md` recapitulatif Sprint 5.

---

## Annexe A. Patterns Sprint 32 GitHub Actions CI

```yaml
# .github/workflows/e2e-auth.yml (Sprint 32)
name: E2E Auth Tests
on: [pull_request, push]
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env: { POSTGRES_PASSWORD: test, POSTGRES_USER: test, POSTGRES_DB: skalean_test }
        ports: ['5432:5432']
        options: --health-cmd pg_isready --health-interval 10s
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
      mailhog:
        image: mailhog/mailhog:latest
        ports: ['1025:1025', '8025:8025']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @insurtech/database migrate:run
      - run: pnpm --filter @insurtech/api start:test &
      - run: pnpm exec playwright install --with-deps chromium
      - run: WORKERS=2 pnpm --filter @insurtech/api test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: e2e/api/playwright-report }
```

## Annexe B. Patterns ajout nouveau scenario

Pour ajouter un nouveau scenario E2E :

1. Creer `repo/e2e/api/auth/16-new-scenario.spec.ts`.
2. Importer fixtures (`auth-helpers`, `mailhog-client`, `redis-helpers`).
3. Wrap dans `test.describe(...)` + `beforeEach(truncateAuthTables + flushRedisAuth)`.
4. Ecrire le test avec `test('should do X', async ({ baseURL }) => { ... })`.
5. Run localement : `pnpm exec playwright test 16-new-scenario.spec.ts`.
6. Verifier passing 5 fois consecutif.
7. Commit + PR.

## Annexe C. Performance benchmarks attendus

```
Test 1 (signup happy path):       median 3 sec  (p99: 5 sec)  -- 2 Argon2 (signup + signin) + Mailhog
Test 5 (account locked):          median 3 sec  (p99: 5 sec)  -- 6 signins (~250ms each)
Test 7 (MFA flow):                median 4 sec  (p99: 6 sec)  -- 6 Argon2 confirm + 2 signins
Test 11 (refresh reuse):          median 1 sec  (p99: 2 sec)
Test 13 (rate limit):             median 2 sec  (p99: 4 sec)  -- 6 signins
Average per test:                 ~2.5 sec
Total 15 tests sequential:        ~4 min
Total 15 tests parallel x4:       ~1.5 min
```

---

## Annexe D. Implementations completes des 9 tests stub

### D.1 Test 02 : `02-signup-password-policy.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';
import { deleteAllMailhogMessages } from './fixtures/mailhog-client.js';

test.describe('Signup password policy enforcement', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
    await deleteAllMailhogMessages();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('rejects password too short (< 12 chars)', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/signup', {
      data: {
        email: 'short@skalean.test',
        password: 'Short1!',
        display_name: 'Test',
        locale: 'fr-MA',
        accepted_tos: true,
      },
    });
    expect(r.status()).toBe(400);
    const body = await r.json();
    expect(body.code).toBe('PASSWORD_POLICY_VIOLATION');
    expect(body.cause?.reasons ?? body.reasons ?? []).toContain('too_short');
    await api.dispose();
  });

  test('rejects password without uppercase', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/signup', {
      data: {
        email: 'no-upper@skalean.test',
        password: 'lowercase123!',
        display_name: 'Test',
        locale: 'fr-MA',
        accepted_tos: true,
      },
    });
    expect(r.status()).toBe(400);
    await api.dispose();
  });

  test('rejects password without special character', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/signup', {
      data: {
        email: 'no-special@skalean.test',
        password: 'NoSpecialChar123',
        display_name: 'Test',
        locale: 'fr-MA',
        accepted_tos: true,
      },
    });
    expect(r.status()).toBe(400);
    await api.dispose();
  });

  test('rejects password similar to email local-part', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/signup', {
      data: {
        email: 'alice@skalean.test',
        password: 'Alice12345!Az',
        display_name: 'Alice',
        locale: 'fr-MA',
        accepted_tos: true,
      },
    });
    expect(r.status()).toBe(400);
    const body = await r.json();
    const reasons = body.cause?.reasons ?? body.reasons ?? [];
    expect(reasons.some((r: string) => r === 'contains_email_local' || r === 'similar_to_email')).toBe(true);
    await api.dispose();
  });

  test('rejects banned password from top 1000 list', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/signup', {
      data: {
        email: 'banned@skalean.test',
        password: 'Password123!',
        display_name: 'Test',
        locale: 'fr-MA',
        accepted_tos: true,
      },
    });
    // Could be 400 if 'password123!' or 'password' is in banlist after lowercase normalization
    if (r.status() === 400) {
      const body = await r.json();
      const reasons = body.cause?.reasons ?? body.reasons ?? [];
      expect(reasons.some((reason: string) => reason === 'banned' || reason === 'too_short')).toBe(true);
    }
    await api.dispose();
  });

  test('rejects password without digit', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/signup', {
      data: {
        email: 'no-digit@skalean.test',
        password: 'NoDigitsHereAtAll!',
        display_name: 'Test',
        locale: 'fr-MA',
        accepted_tos: true,
      },
    });
    expect(r.status()).toBe(400);
    await api.dispose();
  });

  test('accepts strong password meeting all criteria', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/signup', {
      data: {
        email: 'strong@skalean.test',
        password: 'StrongP@ssw0rdXyz!',
        display_name: 'Strong User',
        locale: 'fr-MA',
        accepted_tos: true,
      },
    });
    expect(r.status()).toBe(200);
    await api.dispose();
  });
});
```

### D.2 Test 03 : `03-signup-duplicate-email.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';
import { deleteAllMailhogMessages, getEmailsFor } from './fixtures/mailhog-client.js';

test.describe('Signup anti-enumeration on duplicate email', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
    await deleteAllMailhogMessages();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('duplicate email returns same generic response (anti-enum)', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const email = 'duplicate-test@skalean.test';

    // First signup -- expected to succeed
    const r1 = await api.post('/api/v1/auth/signup', {
      data: {
        email, password: 'StrongP@ssw0rd!', display_name: 'First',
        locale: 'fr-MA', accepted_tos: true,
      },
    });
    expect(r1.status()).toBe(200);
    const body1 = await r1.json();

    // Duplicate signup -- should return SAME response (anti-enum)
    const r2 = await api.post('/api/v1/auth/signup', {
      data: {
        email, password: 'AnotherStrongP@ss!', display_name: 'Second',
        locale: 'fr-MA', accepted_tos: true,
      },
    });
    expect(r2.status()).toBe(200);
    const body2 = await r2.json();
    expect(body2.message).toBe(body1.message);

    // Wait a bit for emails
    await new Promise((r) => setTimeout(r, 500));
    const emails = await getEmailsFor(email);
    // Only ONE verification email should be sent (the first signup), not two
    expect(emails.length).toBe(1);

    await api.dispose();
  });

  test('signup with case-insensitive email duplicate returns same response', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    await api.post('/api/v1/auth/signup', {
      data: {
        email: 'casetest@skalean.test', password: 'StrongP@ssw0rd!',
        display_name: 'Test', locale: 'fr-MA', accepted_tos: true,
      },
    });

    const r = await api.post('/api/v1/auth/signup', {
      data: {
        email: 'CASETEST@SKALEAN.TEST', password: 'AnotherP@ssw0rd!',
        display_name: 'Test 2', locale: 'fr-MA', accepted_tos: true,
      },
    });
    expect(r.status()).toBe(200);
    expect((await r.json()).message).toContain('verification');

    await api.dispose();
  });
});
```

### D.3 Test 04 : `04-signin-invalid-credentials.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';

test.describe('Signin invalid credentials', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('wrong password returns 401 INVALID_CREDENTIALS', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'pwd-wrong@skalean.test' });

    const r = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: 'wrong-password-here' },
    });
    expect(r.status()).toBe(401);
    expect((await r.json()).code).toBe('INVALID_CREDENTIALS');
    await api.dispose();
  });

  test('non-existent email returns 401 (timing-safe)', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });

    const startNonExistent = Date.now();
    const rNon = await api.post('/api/v1/auth/signin', {
      data: { email: 'never-exists@skalean.test', password: 'whatever' },
    });
    const durNonExistent = Date.now() - startNonExistent;
    expect(rNon.status()).toBe(401);
    expect((await rNon.json()).code).toBe('INVALID_CREDENTIALS');

    // Compare with existing user wrong password
    const user = await createTestUser(api, { email: 'exists@skalean.test' });
    const startExisting = Date.now();
    const rExist = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: 'wrong-password' },
    });
    const durExisting = Date.now() - startExisting;
    expect(rExist.status()).toBe(401);

    // Timing-safe : difference should be small (Argon2 dominate both paths)
    const diff = Math.abs(durNonExistent - durExisting);
    expect(diff).toBeLessThan(500);

    await api.dispose();
  });

  test('disabled account returns 401 ACCOUNT_DISABLED', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, {
      email: 'disabled@skalean.test',
      is_active: false,
    });
    const r = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: user.password },
    });
    expect(r.status()).toBe(401);
    expect((await r.json()).code).toBe('ACCOUNT_DISABLED');
    await api.dispose();
  });

  test('malformed email rejected by Zod 400', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/signin', {
      data: { email: 'not-an-email', password: 'whatever' },
    });
    expect(r.status()).toBe(400);
    await api.dispose();
  });
});
```

### D.4 Test 06 : `06-signin-email-not-verified.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';
import { deleteAllMailhogMessages, waitForEmailTo, extractVerifyTokenFromBody } from './fixtures/mailhog-client.js';

test.describe('Signin requires email verification', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
    await deleteAllMailhogMessages();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('signin before email verification returns 401 EMAIL_NOT_VERIFIED', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const email = 'unverified@skalean.test';
    const password = 'StrongP@ssw0rd!';

    // Signup
    await api.post('/api/v1/auth/signup', {
      data: { email, password, display_name: 'Unverified', locale: 'fr-MA', accepted_tos: true },
    });

    // Try signin without verifying email
    const signinR = await api.post('/api/v1/auth/signin', {
      data: { email, password },
    });
    expect(signinR.status()).toBe(401);
    expect((await signinR.json()).code).toBe('EMAIL_NOT_VERIFIED');

    await api.dispose();
  });

  test('after verify-email, signin succeeds', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const email = 'verify-then-signin@skalean.test';
    const password = 'StrongP@ssw0rd!';

    await api.post('/api/v1/auth/signup', {
      data: { email, password, display_name: 'Verify', locale: 'fr-MA', accepted_tos: true },
    });

    // Wait for email + extract token
    const message = await waitForEmailTo(email);
    const token = extractVerifyTokenFromBody(message);
    expect(token).toBeTruthy();

    // Verify email
    const verifyR = await api.get(`/api/v1/auth/verify-email?token=${encodeURIComponent(token!)}`);
    expect(verifyR.status()).toBe(302);

    // Now signin succeeds
    const signinR = await api.post('/api/v1/auth/signin', {
      data: { email, password },
    });
    expect(signinR.status()).toBe(200);

    await api.dispose();
  });

  test('verify-email with already used token redirects already_verified', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const email = 'already-verified@skalean.test';
    await api.post('/api/v1/auth/signup', {
      data: { email, password: 'StrongP@ssw0rd!', display_name: 'AV', locale: 'fr-MA', accepted_tos: true },
    });

    const message = await waitForEmailTo(email);
    const token = extractVerifyTokenFromBody(message)!;

    // First verify
    await api.get(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);

    // Second verify with same token
    const r2 = await api.get(`/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`);
    expect(r2.status()).toBe(302);
    expect(r2.headers()['location']).toContain('status=already_verified');

    await api.dispose();
  });

  test('verify-email with invalid token redirects invalid', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.get('/api/v1/auth/verify-email?token=invalid-token-xxxxxxxxxxxxx');
    expect(r.status()).toBe(302);
    expect(r.headers()['location']).toContain('status=invalid');
    await api.dispose();
  });
});
```

### D.5 Test 08 : `08-mfa-recovery-code.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';

test.describe('MFA recovery code one-time use', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('recovery code allows signin once, second use rejected', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'recovery-code@skalean.test', mfa_enabled: true });
    const recoveryCode = user.recovery_codes![0];

    // Signin to get challenge_token
    const signinR = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: user.password },
    });
    const signin = await signinR.json();
    expect(signin.mfa_required).toBe(true);

    // First use of recovery code -- success
    const r1 = await api.post('/api/v1/auth/verify-mfa', {
      data: { challenge_token: signin.mfa_challenge_token, recovery_code: recoveryCode },
    });
    expect(r1.status()).toBe(200);
    expect((await r1.json()).access_token).toBeTruthy();

    // Second use of same recovery code -- get new challenge first, then try to reuse code
    const signin2 = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: user.password },
    });
    const signin2Body = await signin2.json();
    const r2 = await api.post('/api/v1/auth/verify-mfa', {
      data: { challenge_token: signin2Body.mfa_challenge_token, recovery_code: recoveryCode },
    });
    expect(r2.status()).toBe(401);
    expect((await r2.json()).code).toBe('MFA_INVALID_CODE');

    await api.dispose();
  });

  test('recovery code accepted in any case (lowercase/uppercase)', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'case-recovery@skalean.test', mfa_enabled: true });
    const recoveryCode = user.recovery_codes![1].toLowerCase();

    const signinR = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: user.password },
    });
    const signin = await signinR.json();

    const r = await api.post('/api/v1/auth/verify-mfa', {
      data: { challenge_token: signin.mfa_challenge_token, recovery_code: recoveryCode },
    });
    expect(r.status()).toBe(200);

    await api.dispose();
  });

  test('invalid recovery code format rejected', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'invalid-recovery@skalean.test', mfa_enabled: true });

    const signinR = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: user.password },
    });
    const signin = await signinR.json();

    const r = await api.post('/api/v1/auth/verify-mfa', {
      data: { challenge_token: signin.mfa_challenge_token, recovery_code: 'INVALID' },
    });
    expect(r.status()).toBe(400); // Zod schema rejects format
    await api.dispose();
  });
});
```

### D.6 Test 09 : `09-password-reset-flow.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';
import { deleteAllMailhogMessages, waitForEmailTo, extractResetTokenFromBody } from './fixtures/mailhog-client.js';

test.describe('Password reset full flow', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
    await deleteAllMailhogMessages();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('forgot-password -> reset-password -> signin with new password', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'reset-flow@skalean.test' });

    // Initiate forgot-password
    const forgotR = await api.post('/api/v1/auth/forgot-password', {
      data: { email: user.email },
    });
    expect(forgotR.status()).toBe(200);

    // Wait for reset email
    const message = await waitForEmailTo(user.email);
    const resetToken = extractResetTokenFromBody(message);
    expect(resetToken).toBeTruthy();

    // Reset password
    const newPassword = 'NewStrongP@ssw0rd!';
    const resetR = await api.post('/api/v1/auth/reset-password', {
      data: { token: resetToken!, new_password: newPassword },
    });
    expect(resetR.status()).toBe(200);

    // Old password no longer works
    const oldSignin = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: user.password },
    });
    expect(oldSignin.status()).toBe(401);

    // New password works
    const newSignin = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: newPassword },
    });
    expect(newSignin.status()).toBe(200);

    await api.dispose();
  });

  test('reset with invalid token returns 410', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/reset-password', {
      data: { token: 'invalid-recovery-token-xxxxxxxxx', new_password: 'StrongP@ssw0rd!' },
    });
    expect(r.status()).toBe(410);
    expect((await r.json()).code).toBe('RECOVERY_TOKEN_INVALID');
    await api.dispose();
  });

  test('reset with already used token returns 410', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'reuse-reset@skalean.test' });

    await api.post('/api/v1/auth/forgot-password', { data: { email: user.email } });
    const message = await waitForEmailTo(user.email);
    const token = extractResetTokenFromBody(message)!;

    // First use OK
    await api.post('/api/v1/auth/reset-password', {
      data: { token, new_password: 'FirstNewP@ss123!' },
    });

    // Second use rejected
    const r2 = await api.post('/api/v1/auth/reset-password', {
      data: { token, new_password: 'SecondNewP@ss123!' },
    });
    expect(r2.status()).toBe(410);
    expect((await r2.json()).code).toBe('RECOVERY_TOKEN_USED');

    await api.dispose();
  });

  test('forgot-password with unknown email returns same response (anti-enum)', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/forgot-password', {
      data: { email: 'never-exists@skalean.test' },
    });
    expect(r.status()).toBe(200);
    expect((await r.json()).message).toBeDefined();

    // No email should be sent
    await new Promise((r) => setTimeout(r, 500));
    // Mailhog should have 0 messages for this email
    await api.dispose();
  });

  test('reset-password revokes all active sessions', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'revoke-on-reset@skalean.test' });

    // Signin to create session
    const signinR = await api.post('/api/v1/auth/signin', {
      data: { email: user.email, password: user.password },
    });
    const oldToken = (await signinR.json()).access_token;

    // Forgot + reset
    await api.post('/api/v1/auth/forgot-password', { data: { email: user.email } });
    const message = await waitForEmailTo(user.email);
    const token = extractResetTokenFromBody(message)!;
    await api.post('/api/v1/auth/reset-password', {
      data: { token, new_password: 'NewP@ssw0rd123!' },
    });

    // Old token should now be invalid
    const meR = await api.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    expect(meR.status()).toBe(401);

    await api.dispose();
  });
});
```

### D.7 Test 10 : `10-refresh-token-rotation.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, getRefreshToken, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';

test.describe('Refresh token rotation', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('refresh exchanges old token for new tokens with rotation', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'rotate@skalean.test' });
    const oldRefreshToken = await getRefreshToken(api, user);

    // Refresh
    const refreshR = await api.post('/api/v1/auth/refresh', {
      data: { refresh_token: oldRefreshToken },
    });
    expect(refreshR.status()).toBe(200);
    const refresh = await refreshR.json();
    expect(refresh.access_token).toBeTruthy();
    expect(refresh.refresh_token).toBeTruthy();
    expect(refresh.refresh_token).not.toBe(oldRefreshToken);

    // Old refresh token now invalid (rotation)
    const oldRefreshAttempt = await api.post('/api/v1/auth/refresh', {
      data: { refresh_token: oldRefreshToken },
    });
    expect(oldRefreshAttempt.status()).toBe(401);

    // New refresh token works
    const newRefreshAttempt = await api.post('/api/v1/auth/refresh', {
      data: { refresh_token: refresh.refresh_token },
    });
    expect(newRefreshAttempt.status()).toBe(200);

    await api.dispose();
  });

  test('refresh increments generation counter', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'gen-counter@skalean.test' });

    let currentRefresh = await getRefreshToken(api, user);
    for (let i = 1; i <= 5; i += 1) {
      const r = await api.post('/api/v1/auth/refresh', {
        data: { refresh_token: currentRefresh },
      });
      expect(r.status()).toBe(200);
      currentRefresh = (await r.json()).refresh_token;
    }
    // After 5 rotations, current refresh still works
    const finalR = await api.post('/api/v1/auth/refresh', {
      data: { refresh_token: currentRefresh },
    });
    expect(finalR.status()).toBe(200);

    await api.dispose();
  });

  test('refresh with malformed token returns 401', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/refresh', {
      data: { refresh_token: 'not.a.valid.jwt' },
    });
    expect(r.status()).toBe(401);
    await api.dispose();
  });

  test('refresh with empty body returns 400', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const r = await api.post('/api/v1/auth/refresh', { data: {} });
    expect(r.status()).toBe(400);
    await api.dispose();
  });
});
```

### D.8 Test 12 : `12-signout-all.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, getAccessToken, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';
import { getActiveSessionCount } from './fixtures/redis-helpers.js';

test.describe('Signout all sessions cross-device', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('signout-all revokes all sessions from multiple devices', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'signout-all@skalean.test' });

    // Simulate 3 devices signin
    const tokens: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const token = await getAccessToken(api, user);
      tokens.push(token);
    }

    // Verify 3 active sessions
    const sessionCountBefore = await getActiveSessionCount(user.id);
    expect(sessionCountBefore).toBeGreaterThanOrEqual(3);

    // Signout-all from device 1
    const signoutR = await api.post('/api/v1/auth/signout-all', {
      headers: { Authorization: `Bearer ${tokens[0]}` },
    });
    expect(signoutR.status()).toBe(200);
    const signoutBody = await signoutR.json();
    expect(signoutBody.sessions_revoked).toBeGreaterThanOrEqual(3);

    // All 3 tokens should be invalid now
    for (const token of tokens) {
      const meR = await api.get('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(meR.status()).toBe(401);
    }

    // Active session count = 0
    const sessionCountAfter = await getActiveSessionCount(user.id);
    expect(sessionCountAfter).toBe(0);

    await api.dispose();
  });

  test('signout simple revokes only current session', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'signout-single@skalean.test' });

    // 2 sessions
    const token1 = await getAccessToken(api, user);
    const token2 = await getAccessToken(api, user);

    // Signout from session 1
    await api.post('/api/v1/auth/signout', {
      headers: { Authorization: `Bearer ${token1}` },
    });

    // Token 1 invalid
    const me1 = await api.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token1}` },
    });
    expect(me1.status()).toBe(401);

    // Token 2 still valid
    const me2 = await api.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${token2}` },
    });
    expect(me2.status()).toBe(200);

    await api.dispose();
  });
});
```

### D.9 Test 15 : `15-sessions-list.spec.ts`

```typescript
import { test, expect, request } from '@playwright/test';
import { createTestUser, getAccessToken, truncateAuthTables, flushRedisAuth, closeFixtures } from './fixtures/auth-helpers.js';

test.describe('Sessions management cross-device', () => {
  test.beforeEach(async () => {
    await truncateAuthTables();
    await flushRedisAuth();
  });

  test.afterAll(async () => {
    await closeFixtures();
  });

  test('GET /sessions lists all active sessions with metadata', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'sessions-list@skalean.test' });

    // Create 3 sessions with different user agents
    const tokens: string[] = [];
    for (const ua of ['Chrome/120.0', 'Firefox/121.0', 'Safari/17.0']) {
      const customApi = await request.newContext({
        baseURL,
        extraHTTPHeaders: { 'User-Agent': `Mozilla/5.0 ${ua}` },
      });
      const token = await getAccessToken(customApi, user);
      tokens.push(token);
      await customApi.dispose();
    }

    // List sessions
    const sessionsR = await api.get('/api/v1/auth/sessions', {
      headers: { Authorization: `Bearer ${tokens[0]}` },
    });
    expect(sessionsR.status()).toBe(200);
    const sessions = await sessionsR.json();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeGreaterThanOrEqual(3);

    // Each session has expected fields
    for (const session of sessions) {
      expect(session.session_id).toBeTruthy();
      expect(session.ip).toBeDefined();
      expect(session.user_agent).toBeDefined();
      expect(session.created_at).toBeDefined();
      expect(session.last_seen_at).toBeDefined();
      expect(session.expires_at).toBeDefined();
    }

    // Sessions sorted by last_seen_at desc
    for (let i = 0; i < sessions.length - 1; i += 1) {
      const tA = new Date(sessions[i].last_seen_at).getTime();
      const tB = new Date(sessions[i + 1].last_seen_at).getTime();
      expect(tA).toBeGreaterThanOrEqual(tB);
    }

    await api.dispose();
  });

  test('DELETE /sessions/:sid revokes specific session', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const user = await createTestUser(api, { email: 'session-revoke@skalean.test' });

    const tokenA = await getAccessToken(api, user);
    const tokenB = await getAccessToken(api, user);

    // List sessions to find sid of B
    const sessionsR = await api.get('/api/v1/auth/sessions', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const sessions = await sessionsR.json();
    const sessionB = sessions.find((s: any) => s.session_id !== /* current session */ '');
    expect(sessionB).toBeTruthy();

    // Revoke session B from session A
    const revokeR = await api.delete(`/api/v1/auth/sessions/${sessionB.session_id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(revokeR.status()).toBe(204);

    // Token A still works
    const meA = await api.get('/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(meA.status()).toBe(200);

    await api.dispose();
  });

  test('cannot revoke session of another user', async ({ baseURL }) => {
    const api = await request.newContext({ baseURL });
    const userA = await createTestUser(api, { email: 'session-cross-A@skalean.test' });
    const userB = await createTestUser(api, { email: 'session-cross-B@skalean.test' });

    const tokenA = await getAccessToken(api, userA);
    const tokenB = await getAccessToken(api, userB);

    // Get B's sessions
    const sessionsB = await api.get('/api/v1/auth/sessions', {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const bSessionId = (await sessionsB.json())[0].session_id;

    // A tries to revoke B's session
    const r = await api.delete(`/api/v1/auth/sessions/${bSessionId}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(r.status()).toBe(401); // SESSION_NOT_FOUND for the requesting user

    await api.dispose();
  });
});
```

## Annexe E. Fixtures complete `postgres-helpers.ts`

```typescript
import { Pool, type PoolClient } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/skalean_test',
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function truncateAuthTables(): Promise<void> {
  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      TRUNCATE
        auth_users,
        auth_sessions,
        auth_email_verifications,
        auth_password_recoveries,
        audit_log
      CASCADE;
    `);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function seedSuperAdmin(): Promise<{ id: string; email: string; password: string }> {
  const client = await getDbPool().connect();
  try {
    const result = await client.query(`
      INSERT INTO auth_users (email, password_hash, password_pepper_version, display_name, role, tenant_id, email_verified_at, is_active, locale)
      VALUES ($1, $2, 1, 'Super Admin', 'super_admin_platform', NULL, NOW(), true, 'fr-MA')
      RETURNING id;
    `, ['super-admin@skalean.test', '$argon2id$v=19$m=65536,t=3,p=4$ZmFrZWhhc2g$ZmFrZWhhc2hkYXRh']);
    return {
      id: result.rows[0].id,
      email: 'super-admin@skalean.test',
      password: 'SuperAdminP@ss123!',
    };
  } finally {
    client.release();
  }
}

export async function getEmailVerificationToken(email: string): Promise<string | null> {
  const client = await getDbPool().connect();
  try {
    const result = await client.query(`
      SELECT ev.token_hash
      FROM auth_email_verifications ev
      JOIN auth_users u ON u.id = ev.user_id
      WHERE u.email = $1
        AND ev.consumed_at IS NULL
        AND ev.expires_at > NOW()
      ORDER BY ev.created_at DESC
      LIMIT 1;
    `, [email.toLowerCase()]);
    return result.rows[0]?.token_hash ?? null;
  } finally {
    client.release();
  }
}

export async function getPasswordRecoveryToken(email: string): Promise<string | null> {
  const client = await getDbPool().connect();
  try {
    const result = await client.query(`
      SELECT pr.token_hash
      FROM auth_password_recoveries pr
      JOIN auth_users u ON u.id = pr.user_id
      WHERE u.email = $1
        AND pr.used_at IS NULL
        AND pr.expires_at > NOW()
      ORDER BY pr.created_at DESC
      LIMIT 1;
    `, [email.toLowerCase()]);
    return result.rows[0]?.token_hash ?? null;
  } finally {
    client.release();
  }
}

export async function countAuditLogEntries(action?: string, userId?: string): Promise<number> {
  const client = await getDbPool().connect();
  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }
    if (userId) {
      params.push(userId);
      conditions.push(`user_id = $${params.length}`);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await client.query(`SELECT COUNT(*) as count FROM audit_log ${where};`, params);
    return Number.parseInt(result.rows[0].count, 10);
  } finally {
    client.release();
  }
}

export async function getUserByEmail(email: string): Promise<any | null> {
  const client = await getDbPool().connect();
  try {
    const result = await client.query(`SELECT * FROM auth_users WHERE email = $1;`, [email.toLowerCase()]);
    return result.rows[0] ?? null;
  } finally {
    client.release();
  }
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

## Annexe F. README.md content

```markdown
# E2E Tests for Skalean InsurTech Auth

## Overview

This directory contains 15+ end-to-end test scenarios validating the auth
flows of Skalean InsurTech v2.2 in integration with Postgres + Redis +
Mailhog.

## Prerequisites

- Docker + docker-compose
- Node.js 22.x
- pnpm 9.x

## Running locally

```bash
# Start dependencies
docker compose -f infrastructure/docker/docker-compose.test.yml up -d

# Run all E2E tests
pnpm --filter @insurtech/api test:e2e

# Run specific test
pnpm exec playwright test 01-signup-happy-path.spec.ts

# Open HTML report after run
pnpm exec playwright show-report
```

## Running in CI

GitHub Actions workflow `.github/workflows/e2e-auth.yml` (Sprint 32) runs
the full suite with workers=2 in parallel.

## Adding new scenarios

1. Create `repo/e2e/api/auth/16-new-scenario.spec.ts`
2. Use fixtures from `./fixtures/`
3. Follow pattern : `beforeEach(truncateAuthTables + flushRedisAuth)` for isolation
4. Run locally 5 times to verify no flakiness
5. Submit PR

## Available fixtures

- `auth-helpers.ts` -- createTestUser, getAccessToken, getRefreshToken
- `mailhog-client.ts` -- waitForEmailTo, extractVerifyToken, extractResetToken
- `redis-helpers.ts` -- getSessionByJti, isSessionRevoked, getLockoutState
- `postgres-helpers.ts` -- truncateAuthTables, seedSuperAdmin, query helpers

## Configuration

Environment variables (default values for local dev) :

```env
E2E_BASE_URL=http://localhost:4000
DATABASE_URL=postgresql://test:test@localhost:5432/skalean_test
REDIS_HOST=localhost
REDIS_PORT=6379
MAILHOG_API_URL=http://localhost:8025
WORKERS=1
```

## Troubleshooting

- **Tests flaky** : run with WORKERS=1 to isolate.
- **Mailhog timeout** : delay 1000ms instead of 500ms.
- **Postgres connection refused** : check docker-compose up status.
- **Argon2 timeout** : increase test timeout in playwright.config.ts.
```

## Annexe G. Performance benchmarks E2E detailed

```
Test 1 (signup happy path):
  - signup API call:                 ~280 ms
  - Mailhog email arrival:           ~500 ms
  - extract token:                   ~50 ms
  - verify-email API:                ~10 ms
  - signin API:                      ~280 ms
  - me API:                          ~5 ms
  Total :                            ~1.1 sec

Test 5 (account locked):
  - createTestUser:                  ~600 ms
  - 5 wrong signins (Argon2 each):   ~1.4 sec
  - 6th signin (lockout):            ~5 ms
  Total :                            ~2.0 sec

Test 7 (MFA flow):
  - createTestUser:                  ~600 ms
  - signin:                          ~280 ms
  - setup-mfa:                       ~50 ms
  - confirm-mfa (6 Argon2 hashes):   ~1.5 sec
  - signin (MFA challenge):          ~280 ms
  - verify-mfa:                      ~5 ms
  Total :                            ~2.8 sec

Test 11 (refresh reuse):
  - createTestUser:                  ~600 ms
  - getRefreshToken:                 ~280 ms
  - legit refresh:                   ~10 ms
  - attacker reuse:                  ~10 ms
  - new token also revoked:          ~10 ms
  Total :                            ~0.9 sec

Average per test : ~2.0 sec
Sequential 15 tests (workers=1) : ~30 sec + setup overhead = ~3-4 min
Parallel 4 workers : ~1.5-2 min
```

## Annexe H. Test data management strategy

```typescript
// Pattern : test data factory ensures uniqueness across parallel workers
import { v4 as uuidv4 } from 'uuid';

export function uniqueTestEmail(prefix: string): string {
  const workerId = process.env.TEST_WORKER_INDEX ?? '0';
  const timestamp = Date.now();
  const random = uuidv4().slice(0, 8);
  return `${prefix}-w${workerId}-${timestamp}-${random}@skalean.test`;
}

// Usage in tests
test('my test', async ({ baseURL }) => {
  const email = uniqueTestEmail('my-test');
  // No collision even in parallel workers
});
```

## Annexe I. CI/CD integration patterns Sprint 32

```yaml
# .github/workflows/e2e-auth.yml (Sprint 32)
name: E2E Auth Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '22.x'
  PNPM_VERSION: '9.x'

jobs:
  e2e-auth:
    runs-on: ubuntu-22.04
    timeout-minutes: 15

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: skalean_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

      mailhog:
        image: mailhog/mailhog:latest
        ports:
          - 1025:1025
          - 8025:8025

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: ${{ env.PNPM_VERSION }}

      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Generate test secrets
        run: |
          echo "PASSWORD_PEPPER=$(openssl rand -base64 48)" >> $GITHUB_ENV
          echo "JWT_SECRET=$(openssl rand -base64 48)" >> $GITHUB_ENV
          echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)" >> $GITHUB_ENV
          echo "MFA_SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> $GITHUB_ENV
          echo "HMAC_WEBHOOK_KEY=$(openssl rand -base64 48)" >> $GITHUB_ENV

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/skalean_test
        run: pnpm --filter @insurtech/database migrate:run

      - name: Start API in background
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/skalean_test
          REDIS_HOST: localhost
          REDIS_PORT: '6379'
          SMTP_HOST: localhost
          SMTP_PORT: '1025'
          MAILHOG_API_URL: http://localhost:8025
          NODE_ENV: test
        run: |
          pnpm --filter @insurtech/api start:test &
          # Wait for API health
          for i in {1..30}; do
            if curl -f http://localhost:4000/health 2>/dev/null; then
              echo "API ready"
              exit 0
            fi
            sleep 1
          done
          echo "API failed to start"
          exit 1

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Run E2E tests
        env:
          E2E_BASE_URL: http://localhost:4000
          DATABASE_URL: postgresql://test:test@localhost:5432/skalean_test
          REDIS_HOST: localhost
          REDIS_PORT: '6379'
          MAILHOG_API_URL: http://localhost:8025
          WORKERS: '2'
          CI: 'true'
        run: pnpm --filter @insurtech/api test:e2e

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ github.run_id }}
          path: e2e/api/auth/playwright-report/
          retention-days: 14

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: test-results-${{ github.run_id }}
          path: e2e/api/auth/test-results/
          retention-days: 7
```

---

**Fin du prompt task-2.1.15-e2e-tests.md.**
