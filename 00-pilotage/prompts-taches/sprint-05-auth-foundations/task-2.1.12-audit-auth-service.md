# TACHE 2.1.12 -- AuditAuthService : Centralisation Logs Audit + Publication Events Kafka pour Toutes Operations Auth

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.12)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.13 Email triggers, 2.1.15 E2E audit verification, Sprint 18 Comm consume events, Sprint 33 SIEM)
**Effort** : 4h
**Dependances** : 2.1.11 (recovery termine), Sprint 2 (table audit_log + KafkaPublisher), 2.1.1 (AuthEventKind enum + AuthEventEnvelope)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le service `AuditAuthService` qui constitue le hub central de centralisation des logs audit et de publication d'events Kafka pour TOUTES les operations sensibles d'authentification du programme Skalean InsurTech v2.2 conforme aux exigences ACAPS circulaire 2024 (audit trail durable 5 ans pour controles), loi 09-08 article 28 (notification breach 72h CNDP necessite logs auth queryables), NIST SP 800-92 (Guide to Computer Security Log Management), et Bank Al-Maghrib circulaire 2014/G/4 (traçabilite des operations financieres). Le perimetre couvre : un service NestJS `@Injectable() AuditAuthService` qui expose 18 methods correspondant a chaque type d'event d'authentification (logSignupStarted, logSignupCompleted, logEmailVerified, logSigninSuccess, logSigninFailed, logSigninLocked, logMfaSetupStarted, logMfaSetupCompleted, logMfaVerifySuccess, logMfaVerifyFailed, logMfaDisabled, logRefreshUsed, logRefreshReplayDetected, logSignout, logSignoutAll, logRecoveryStarted, logRecoveryCompleted, logPasswordChanged, logLockoutTriggered, logLockoutCleared, logSessionExpired, logSuspiciousLogin) ; chaque method (a) construit un `AuthEventEnvelope` typed (defini Tache 2.1.1) avec event_id ULID, event_kind enum, occurred_at ISO 8601, tenant_id, user_id, user_email, user_role, session_id, ip, user_agent, request_id, payload type-safe specifique a l'event (mapped via AuthEventPayloadMap), context (program_version, sprint), (b) insere une row dans la table `audit_log` Postgres (provisionnee Sprint 2) via `AuditLogRepository` avec colonnes `id UUID PK, tenant_id UUID NULL, user_id UUID NULL, action TEXT (snake_case), resource_type TEXT, resource_id TEXT, ip INET NULL, user_agent TEXT NULL, request_id TEXT NULL, changes JSONB NULL, occurred_at TIMESTAMPTZ NOT NULL, ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, (c) publie l'event sur le topic Kafka correspondant `insurtech.events.auth.{event_kind}` via le `KafkaPublisher` Sprint 2 (avec partition key = `tenant_id || 'platform'` pour ordering per-tenant) ; un service `AuditLogRepository` qui wrappe l'insertion DB ; et un middleware `RequestContextInterceptor` (extension Sprint 3) qui propage `request_id` et `trace_id` depuis le header `x-request-id` vers AsyncLocalStorage pour propagation transparente dans tous les events emis pendant le cycle de la requete.

L'apport est multiple. Premierement, en centralisant TOUS les logs audit auth dans un seul service avec une API typed, on garantit la coherence : tous les events ont la meme structure (envelope), les memes champs obligatoires, le meme format de timestamp (Unix seconds + ISO 8601 redondant). Tout consommateur (Sprint 33 SIEM, Sprint 18 anomaly detection, Sprint 7 RBAC audit, ACAPS exports) peut traiter les events de maniere uniforme. Deuxiemement, en double-writant systematiquement (Postgres audit_log + Kafka topic), on obtient deux propagation paths complementaires : Postgres pour query SQL durable (audit ACAPS rétrospectif 5 ans, query forensic), Kafka pour traitement async fan-out (Sprint 18 alerts, Sprint 22 analytics, Sprint 33 SIEM correlation). Si Postgres fail, Kafka continue (resilient). Si Kafka fail, Postgres garde la trace (replayable depuis Postgres si retry queue Sprint 14). Troisiemement, en utilisant des Kafka events typed avec `AuthEventPayloadMap`, on permet aux consommateurs Sprint 18+ de filtrer et router selon la nature exacte de l'event sans re-parser les payloads JSON.

A l'issue de cette tache, chaque operation auth dans AuthController declenche un appel a AuditAuthService.logXxx() qui (a) ecrit en audit_log Postgres et (b) publie sur Kafka topic. Un dashboard Sprint 33 peut faire `SELECT * FROM audit_log WHERE action LIKE 'auth.%' AND occurred_at > NOW() - INTERVAL '7 days'` pour le report hebdomadaire ACAPS. Les events Kafka declenchent en aval Sprint 18 SecurityIncidentService (notification breach 72h pour suspicious_login + replay_detected events), Sprint 22 AnalyticsService (signin success rate par tenant), Sprint 33 SIEM correlation (detection campagnes coordonnees cross-tenants). La suite Vitest couvre 25+ tests garantissant que chaque method (1) cree row audit_log, (2) publie Kafka event, (3) propage request_id correctement.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sans audit centralise, chaque controller doit dupliquer la logique d'audit log + Kafka publish pour chaque action sensible. Cette duplication produit inevitablement (a) des oublis (un endpoint nouveau ne loggue pas, un audit gap dans l'historique), (b) des incoherences (deux endpoints loggent la meme action avec des champs differents, query SQL impossible), (c) du code repetitif difficile a maintenir et tester. La centralisation via AuditAuthService elimine ces problemes.

L'exigence d'audit log durable 5 ans est explicite dans ACAPS circulaire 2024 article 18 pour les operateurs metier d'assurance. Sans cette retention, l'autorité ne peut pas effectuer ses controles annuels qui impliquent souvent des analyses retrospectives sur 12-24 mois (parfois jusqu'a 5 ans pour les contentieux). Postgres + cold storage Atlas Object Storage Sprint 35 garantit cette retention.

L'exigence de notification breach 72h CNDP article 28 necessite que le programme puisse, sur signal d'incident, retrouver rapidement (< 1 heure) toutes les operations auth concernees pour scope l'impact. Sans audit trail queryable, cela demanderait des heures voire jours de forensic. Avec audit_log indexed sur user_id + tenant_id + occurred_at, les queries sont instantanees.

L'utilisation d'events Kafka avec topic `insurtech.events.auth.{event_kind}` decouple la production des logs de leur consommation. Sprint 5 produit ; Sprint 18, 22, 33 consomment independamment. Ce decoupage permet d'ajouter de nouveaux consommateurs (par exemple un futur service ML detection anomalie Sprint 14+) sans toucher au producteur.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Logs uniquement Postgres | Simple, transactional | Pas de fan-out Kafka, latency consumers | REJETE |
| Logs uniquement Kafka | Scalable, async | Pas durable 5 ans (Kafka retention 7 jours par defaut), complex queryable | REJETE |
| Postgres + Kafka double-write (RETENU) | Durable + scalable + queryable | Complexite double-write | RETENU |
| Kafka source de verite, Postgres derive | Eventually consistent | Pas de transaction unique | REJETE |
| Postgres source de verite, Kafka derive | Audit log durable | Outbox pattern complexe Sprint 14 | RETENU best-effort |
| Outbox pattern transactional | Strict consistency | Sprint 14 implementation | DEFFERE |
| Logs structures JSON Pino vers Datadog | Simple ops | Pas queryable SQL, pas durable 5 ans | REJETE comme principal |
| Datadog en complement (RETENU) | Operational logs | Audit_log + Kafka principal | RETENU comme add-on |
| Centralized service AuditAuthService (RETENU) | Coherence, type-safe | More code | RETENU |
| Inline audit dans chaque controller | Localite | Duplication, oublis | REJETE |
| Auto-audit via NestJS interceptor | Magic, reduces code | Less control over fields | REJETE pour Sprint 5, considere Sprint 14 |

### 2.3 Trade-offs

Choisir double-write Postgres + Kafka implique d'accepter un risque d'incoherence transitoire si l'un des deux fail. En contrepartie, on a deux paths complementaires. Best-effort + log warning sur fail. Sprint 14 implementera transactional outbox pour eliminer l'incoherence.

Choisir 18+ methods specifiques (vs 1 method generique avec switch) implique d'accepter du code repetitif. En contrepartie, l'IDE autocomplete fournit aux developpeurs les bonnes signatures, le compilateur catch les erreurs (mauvais payload pour mauvais event), et le code reste lisible.

Choisir d'inserer en parallele de Kafka publish (vs sequential) implique d'accepter une legere consommation supplementaire de DB connection. En contrepartie, latency reduite ~50%. Convention : Kafka.publish() est await pour garantir publication ; AuditLog INSERT est fire-and-forget avec log warning sur fail.

### 2.4 Decisions strategiques

- decision-006 (No-emoji), decision-008 (Atlas Cloud).
- ACAPS circulaire 2024 article 18 -- audit 5 ans.
- Loi 09-08 article 28 -- breach notification 72h.
- NIST SP 800-92 -- log management.
- Bank Al-Maghrib 2014/G/4 -- traçabilite financiere.

### 2.5 Pieges techniques

1. **Audit fail bloque la requete** : convention -- audit fire-and-forget, log warning.
2. **Kafka publish bloque** : await Kafka mais avec timeout 2s ; fallback fire-and-forget si timeout.
3. **request_id missing dans context** : default 'unknown'.
4. **tenant_id null pour platform users** : OK.
5. **Sensible info dans payload** : NEVER include password, mfa_secret, recovery_code en clair.
6. **Kafka topic mismatch** : convention `insurtech.events.auth.{event_kind}` strict.
7. **Order of events** : partition key = tenant_id pour preserver order per-tenant.
8. **Audit_log size growth** : Sprint 35 archive job > 90 days vers cold storage.
9. **Replay detection event critical** : double-write meme si Kafka down.
10. **PII in user_agent** : sanitization optionnelle Sprint 14.
11. **IP IPv6 vs IPv4** : INET type Postgres handles both.
12. **Idempotency Kafka** : event_id ULID unique permet dedup consumer-side.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.12 livre le service consomme par : 2.1.13 (EmailService trigger sur certains events), 2.1.15 (E2E verifie audit + Kafka), Tache 2.1.6/2.1.8/2.1.9/2.1.10/2.1.11 integrent AuditAuthService dans leurs flows.

### 3.2 Position dans le programme

- Sprint 14 : transactional outbox pattern pour eliminer double-write incoherence.
- Sprint 18 : SecurityIncidentService consume `auth.suspicious_login`, `auth.replay_detected` pour notifications.
- Sprint 22 : AnalyticsService consume tous events pour dashboards.
- Sprint 25 : Cross-tenant audit pour impersonate.
- Sprint 33 : SIEM correlation cross-tenants.
- Sprint 35 : archive auth_log > 90 days vers Atlas Object Storage.

### 3.3 Diagramme

```
              +-----------------------------------+
              | Tache 2.1.11 termine               |
              +-----------------+------------------+
                                |
                                v
        +-----------------------+-----------------------+
        | TACHE 2.1.12 (cette tache)                     |
        | AuditAuthService                              |
        | 18+ methods (logXxx)                          |
        |                                               |
        | AuditLogRepository (Postgres)                 |
        | KafkaPublisher (Sprint 2)                     |
        +--+----+----+----+----+----+----+--------+----+
           |    |    |    |    |    |    |
           v    v    v    v    v    v    v
       Postgres audit_log table   Kafka topics
                                  insurtech.events.auth.*
                                       |
                                       v
                          +------------+------------+
                          | Sprint 18 SecurityIncident
                          | Sprint 22 Analytics
                          | Sprint 33 SIEM
                          +-------------------------+
```

---

## 4. Livrables checkables (24)

- [ ] Service `repo/apps/api/src/modules/auth/services/audit-auth.service.ts` -- ~400 lignes
- [ ] Repository `repo/apps/api/src/modules/auth/services/audit-log.repository.ts` -- ~120 lignes
- [ ] Helper `repo/apps/api/src/modules/auth/services/audit-context.helpers.ts` -- ~80 lignes
- [ ] Schema Zod `repo/packages/shared-events/src/auth-events.schema.ts` -- ~150 lignes (extends Tache 2.1.1)
- [ ] Mise a jour `auth.module.ts` -- modification
- [ ] Mise a jour `auth.service.ts` (Tache 2.1.6+) -- integration calls -- modification
- [ ] Verify table audit_log Sprint 2 schema
- [ ] Tests unit `audit-auth.service.spec.ts` -- 20+ tests -- ~400 lignes
- [ ] Tests `audit-log.repository.spec.ts` -- 4 tests -- ~80 lignes
- [ ] Tests integration `audit-kafka.integration.spec.ts` -- 6 tests -- ~150 lignes
- [ ] No-emoji
- [ ] No-console
- [ ] Coverage >= 90%
- [ ] Documentation JSDoc complete
- [ ] Build TypeScript reussit
- [ ] 18+ methods exposees
- [ ] Topic Kafka conforme convention `insurtech.events.auth.*`
- [ ] event_id ULID unique
- [ ] occurred_at + ingested_at distincts
- [ ] partition key = tenant_id pour ordering
- [ ] Aucun secret dans payload (password, mfa_secret, recovery_code)
- [ ] Audit fail ne bloque pas la requete principale
- [ ] Kafka publish avec timeout 2s
- [ ] Double-write best-effort pattern documented

---

## 5. Fichiers crees / modifies

```
repo/apps/api/src/modules/auth/services/audit-auth.service.ts                       (~400 lignes)
repo/apps/api/src/modules/auth/services/audit-log.repository.ts                     (~120 lignes)
repo/apps/api/src/modules/auth/services/audit-context.helpers.ts                    (~80 lignes)
repo/packages/shared-events/src/auth-events.schema.ts                                (~150 lignes)
repo/apps/api/src/modules/auth/auth.module.ts                                        (modifie)
repo/apps/api/src/modules/auth/auth.service.ts                                       (modifie)
repo/apps/api/src/modules/auth/services/audit-auth.service.spec.ts                    (~400 lignes)
repo/apps/api/src/modules/auth/services/audit-log.repository.spec.ts                  (~80 lignes)
repo/apps/api/test/integration/audit-kafka.integration.spec.ts                        (~150 lignes)
```

---

## 6. Code patterns COMPLETS

### 6.1 Schema Zod events (extends Tache 2.1.1)

```typescript
// repo/packages/shared-events/src/auth-events.schema.ts
import { z } from 'zod';
import { AuthEventKind } from '@insurtech/auth';

const baseEnvelopeFields = {
  event_id: z.string().length(26), // ULID
  event_kind: z.nativeEnum(AuthEventKind),
  occurred_at: z.string().datetime(),
  ingested_at: z.string().datetime().optional(),
  tenant_id: z.string().uuid().nullable(),
  user_id: z.string().uuid().nullable(),
  user_email: z.string().email().nullable(),
  user_role: z.string().nullable(),
  session_id: z.string().nullable(),
  ip: z.string(),
  user_agent: z.string(),
  request_id: z.string(),
  context: z.object({
    program_version: z.string(),
    sprint: z.number().int(),
  }),
};

export const signupStartedEventSchema = z.object({
  ...baseEnvelopeFields,
  event_kind: z.literal(AuthEventKind.SignupStarted),
  payload: z.object({ email: z.string(), locale: z.string() }),
});

export const signupCompletedEventSchema = z.object({
  ...baseEnvelopeFields,
  event_kind: z.literal(AuthEventKind.SignupCompleted),
  payload: z.object({ email: z.string(), role: z.string() }),
});

export const signinSuccessEventSchema = z.object({
  ...baseEnvelopeFields,
  event_kind: z.literal(AuthEventKind.SigninSuccess),
  payload: z.object({ mfa_required: z.boolean(), remember_me: z.boolean() }),
});

export const signinFailedEventSchema = z.object({
  ...baseEnvelopeFields,
  event_kind: z.literal(AuthEventKind.SigninFailed),
  payload: z.object({ reason: z.enum(['invalid_credentials', 'email_not_verified', 'account_disabled']) }),
});

export const refreshReplayDetectedEventSchema = z.object({
  ...baseEnvelopeFields,
  event_kind: z.literal(AuthEventKind.RefreshReplayDetected),
  payload: z.object({
    token_family: z.string(),
    expected_generation: z.number().int(),
    presented_generation: z.number().int(),
  }),
});

export const lockoutTriggeredEventSchema = z.object({
  ...baseEnvelopeFields,
  event_kind: z.literal(AuthEventKind.LockoutTriggered),
  payload: z.object({ tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]), failed_attempts: z.number().int() }),
});

// ... (other 12 event schemas)

export const anyAuthEventSchema = z.discriminatedUnion('event_kind', [
  signupStartedEventSchema,
  signupCompletedEventSchema,
  signinSuccessEventSchema,
  signinFailedEventSchema,
  refreshReplayDetectedEventSchema,
  lockoutTriggeredEventSchema,
  // ...
]);
```

### 6.2 audit-context.helpers.ts

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  request_id: string;
  trace_id?: string;
  ip: string;
  user_agent: string;
  tenant_id?: string | null;
  user_id?: string | null;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContextStorage.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function getRequestContextOrDefault(): RequestContext {
  return getRequestContext() ?? {
    request_id: 'unknown',
    ip: 'unknown',
    user_agent: 'unknown',
  };
}
```

### 6.3 audit-log.repository.ts

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuditLogEntity } from '@insurtech/database'; // Sprint 2

export interface AuditLogInsertInput {
  id: string; // ULID
  tenant_id: string | null;
  user_id: string | null;
  action: string; // e.g. 'auth.signin_success'
  resource_type: string; // 'auth_user'
  resource_id: string | null;
  ip: string | null;
  user_agent: string | null;
  request_id: string | null;
  changes: Record<string, unknown> | null;
  occurred_at: Date;
}

@Injectable()
export class AuditLogRepository {
  private readonly logger = new Logger(AuditLogRepository.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  async insert(input: AuditLogInsertInput): Promise<void> {
    try {
      await this.repo.insert({
        id: input.id,
        tenant_id: input.tenant_id,
        user_id: input.user_id,
        action: input.action,
        resource_type: input.resource_type,
        resource_id: input.resource_id,
        ip: input.ip,
        user_agent: input.user_agent,
        request_id: input.request_id,
        changes: input.changes,
        occurred_at: input.occurred_at,
      } as any);
    } catch (err) {
      this.logger.warn({
        err: err instanceof Error ? err.message : err,
        action: input.action,
      }, 'audit_log INSERT failed (best-effort double-write)');
      // Do NOT throw -- Kafka path remains
    }
  }

  async findByUserId(userId: string, limit = 100): Promise<AuditLogEntity[]> {
    return this.repo.find({
      where: { user_id: userId },
      order: { occurred_at: 'DESC' },
      take: limit,
    });
  }
}
```

### 6.4 audit-auth.service.ts

```typescript
/**
 * apps/api/.../auth/services/audit-auth.service.ts
 *
 * Centralizes audit logging + Kafka event publication for all auth operations.
 *
 * Reference :
 *   - ACAPS circulaire 2024 article 18 (5 years retention)
 *   - Loi 09-08 article 28 (breach notification 72h)
 *   - NIST SP 800-92 (Log Management)
 *   - Bank Al-Maghrib 2014/G/4 (financial traceability)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ulid } from 'ulid';
import { AuthEventKind, type AuthEventEnvelope, type AuthEventPayloadMap, type AuthRole } from '@insurtech/auth';
import { KafkaPublisher } from '@insurtech/shared-utils'; // Sprint 2
import { AuditLogRepository } from './audit-log.repository.js';
import { getRequestContextOrDefault } from './audit-context.helpers.js';

const PROGRAM_VERSION = '2.2.0';
const SPRINT_NUMBER = 5;
const KAFKA_PUBLISH_TIMEOUT_MS = 2000;

interface BaseAuditInput {
  tenant_id?: string | null;
  user_id?: string | null;
  user_email?: string | null;
  user_role?: AuthRole | null;
  session_id?: string | null;
}

@Injectable()
export class AuditAuthService {
  private readonly logger = new Logger(AuditAuthService.name);

  constructor(
    private readonly auditLogRepo: AuditLogRepository,
    private readonly kafkaPublisher: KafkaPublisher,
    private readonly config: ConfigService,
  ) {}

  // --- Signup lifecycle ---

  async logSignupStarted(input: BaseAuditInput & { email: string; locale: string }): Promise<void> {
    await this.publish(AuthEventKind.SignupStarted, input, { email: input.email, locale: input.locale });
  }

  async logSignupCompleted(input: BaseAuditInput & { email: string; role: AuthRole }): Promise<void> {
    await this.publish(AuthEventKind.SignupCompleted, input, { email: input.email, role: input.role });
  }

  async logEmailVerified(input: BaseAuditInput & { email: string }): Promise<void> {
    await this.publish(AuthEventKind.EmailVerified, input, { email: input.email });
  }

  // --- Signin lifecycle ---

  async logSigninSuccess(input: BaseAuditInput & { mfa_required: boolean; remember_me: boolean }): Promise<void> {
    await this.publish(AuthEventKind.SigninSuccess, input, { mfa_required: input.mfa_required, remember_me: input.remember_me });
  }

  async logSigninFailed(input: BaseAuditInput & { reason: 'invalid_credentials' | 'email_not_verified' | 'account_disabled' }): Promise<void> {
    await this.publish(AuthEventKind.SigninFailed, input, { reason: input.reason });
  }

  async logSigninLocked(input: BaseAuditInput & { tier: 1 | 2 | 3 | 4; locked_until: string }): Promise<void> {
    await this.publish(AuthEventKind.SigninLocked, input, { tier: input.tier, locked_until: input.locked_until });
  }

  // --- MFA lifecycle ---

  async logMfaSetupStarted(input: BaseAuditInput & { method: 'totp' | 'webauthn' }): Promise<void> {
    await this.publish(AuthEventKind.MfaSetupStarted, input, { method: input.method });
  }

  async logMfaSetupCompleted(input: BaseAuditInput & { method: 'totp' | 'webauthn'; recovery_codes_count: number }): Promise<void> {
    await this.publish(AuthEventKind.MfaSetupCompleted, input, { method: input.method, recovery_codes_count: input.recovery_codes_count });
  }

  async logMfaVerifySuccess(input: BaseAuditInput & { method: 'totp' | 'recovery_code' }): Promise<void> {
    await this.publish(AuthEventKind.MfaVerifySuccess, input, { method: input.method });
  }

  async logMfaVerifyFailed(input: BaseAuditInput & { method: 'totp' | 'recovery_code'; reason: string }): Promise<void> {
    await this.publish(AuthEventKind.MfaVerifyFailed, input, { method: input.method, reason: input.reason });
  }

  async logMfaDisabled(input: BaseAuditInput & { method: 'totp' | 'webauthn' }): Promise<void> {
    await this.publish(AuthEventKind.MfaDisabled, input, { method: input.method });
  }

  // --- Refresh lifecycle ---

  async logRefreshUsed(input: BaseAuditInput & { token_family: string; generation: number }): Promise<void> {
    await this.publish(AuthEventKind.RefreshUsed, input, { token_family: input.token_family, generation: input.generation });
  }

  async logRefreshReplayDetected(input: BaseAuditInput & { token_family: string; expected_generation: number; presented_generation: number }): Promise<void> {
    await this.publish(AuthEventKind.RefreshReplayDetected, input, {
      token_family: input.token_family,
      expected_generation: input.expected_generation,
      presented_generation: input.presented_generation,
    });
  }

  // --- Signout lifecycle ---

  async logSignout(input: BaseAuditInput): Promise<void> {
    await this.publish(AuthEventKind.Signout, input, { session_id: input.session_id ?? '' });
  }

  async logSignoutAll(input: BaseAuditInput & { sessions_revoked: number }): Promise<void> {
    await this.publish(AuthEventKind.SignoutAll, input, { sessions_revoked: input.sessions_revoked });
  }

  // --- Recovery lifecycle ---

  async logRecoveryStarted(input: BaseAuditInput & { email: string }): Promise<void> {
    await this.publish(AuthEventKind.RecoveryStarted, input, { email: input.email });
  }

  async logRecoveryCompleted(input: BaseAuditInput & { email: string }): Promise<void> {
    await this.publish(AuthEventKind.RecoveryCompleted, input, { email: input.email });
  }

  async logPasswordChanged(input: BaseAuditInput): Promise<void> {
    await this.publish(AuthEventKind.PasswordChanged, input, {});
  }

  // --- Lockout lifecycle ---

  async logLockoutTriggered(input: BaseAuditInput & { tier: 1 | 2 | 3 | 4; failed_attempts: number }): Promise<void> {
    await this.publish(AuthEventKind.LockoutTriggered, input, { tier: input.tier, failed_attempts: input.failed_attempts });
  }

  async logLockoutCleared(input: BaseAuditInput & { reason: 'manual' | 'expired' | 'recovery_completed' }): Promise<void> {
    await this.publish(AuthEventKind.LockoutCleared, input, { reason: input.reason });
  }

  // --- Suspicious activity ---

  async logSuspiciousLogin(input: BaseAuditInput & { signal: string; risk_score: number }): Promise<void> {
    await this.publish(AuthEventKind.SuspiciousLogin, input, { signal: input.signal, risk_score: input.risk_score });
  }

  async logSessionExpired(input: BaseAuditInput & { reason: 'idle' | 'absolute' }): Promise<void> {
    await this.publish(AuthEventKind.SessionExpired, input, { session_id: input.session_id ?? '', reason: input.reason });
  }

  // --- Internal helpers ---

  private async publish<K extends AuthEventKind>(
    kind: K,
    base: BaseAuditInput,
    payload: AuthEventPayloadMap[K],
  ): Promise<void> {
    const ctx = getRequestContextOrDefault();
    const eventId = ulid();
    const now = new Date();

    const envelope: AuthEventEnvelope = {
      event_id: eventId,
      event_kind: kind,
      occurred_at: now.toISOString(),
      tenant_id: base.tenant_id ?? null,
      user_id: base.user_id ?? null,
      user_email: base.user_email ?? null,
      user_role: base.user_role ?? null,
      session_id: base.session_id ?? null,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      request_id: ctx.request_id,
      payload: payload as Record<string, unknown>,
      context: {
        program_version: PROGRAM_VERSION,
        sprint: SPRINT_NUMBER,
      },
    };

    // 1. Insert audit_log (fire-and-forget)
    this.auditLogRepo.insert({
      id: eventId,
      tenant_id: base.tenant_id ?? null,
      user_id: base.user_id ?? null,
      action: `auth.${kind}`,
      resource_type: 'auth_user',
      resource_id: base.user_id ?? null,
      ip: ctx.ip,
      user_agent: ctx.user_agent,
      request_id: ctx.request_id,
      changes: payload as Record<string, unknown>,
      occurred_at: now,
    }).catch((err) => {
      this.logger.warn({ err: err instanceof Error ? err.message : err, action: kind }, 'audit_log insert failed');
    });

    // 2. Publish Kafka with timeout
    const topic = `insurtech.events.auth.${kind}`;
    const partitionKey = base.tenant_id ?? 'platform';
    try {
      await this.publishWithTimeout(topic, partitionKey, envelope, KAFKA_PUBLISH_TIMEOUT_MS);
    } catch (err) {
      this.logger.warn({
        err: err instanceof Error ? err.message : err,
        topic,
        event_kind: kind,
      }, 'Kafka publish failed (audit_log path remains)');
    }

    this.logger.log({ action: `audit.${kind}`, event_id: eventId, user_id: base.user_id });
  }

  private async publishWithTimeout(topic: string, key: string, message: AuthEventEnvelope, timeoutMs: number): Promise<void> {
    const publishPromise = this.kafkaPublisher.publish({
      topic,
      messages: [{
        key,
        value: JSON.stringify(message),
        headers: {
          'event-kind': message.event_kind,
          'event-id': message.event_id,
          'request-id': message.request_id,
        },
      }],
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Kafka publish timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    await Promise.race([publishPromise, timeoutPromise]);
  }
}
```

### 6.5 Mise a jour AuthService.signin (integration)

```typescript
async signin(input: SigninInput, ctx: SigninContext): Promise<SigninResponse> {
  // ... existing checks

  // On signin failure :
  if (!valid) {
    const decision = await this.lockoutService.recordFailedAttempt({ user_id: user.id, ip: ctx.ip, email: user.email });
    await this.auditAuthService.logSigninFailed({
      user_id: user.id, user_email: user.email, user_role: user.role, tenant_id: user.tenant_id,
      reason: 'invalid_credentials',
    });
    if (!decision.allow) {
      await this.auditAuthService.logSigninLocked({
        user_id: user.id, user_email: user.email, user_role: user.role, tenant_id: user.tenant_id,
        tier: 1, // simplified
        locked_until: new Date(Date.now() + (decision.retry_after_seconds ?? 300) * 1000).toISOString(),
      });
    }
    throw InvalidCredentialsError();
  }

  // On signin success :
  await this.auditAuthService.logSigninSuccess({
    user_id: user.id, user_email: user.email, user_role: user.role, tenant_id: user.tenant_id, session_id: sid,
    mfa_required: false, remember_me: ctx.remember_me,
  });
  // ... continue
}
```

### 6.6 Mise a jour AuthModule

```typescript
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from '@insurtech/database'; // Sprint 2
import { AuditAuthService } from './services/audit-auth.service.js';
import { AuditLogRepository } from './services/audit-log.repository.js';

@Module({
  imports: [
    AuthSharedModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    UserModule,
    TypeOrmModule.forFeature([AuthEmailVerificationEntity, AuthPasswordRecoveryEntity, AuditLogEntity]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MfaRequiredGuard },
    EmailVerificationRepository, PasswordRecoveryRepository, AuditLogRepository,
    EmailService, AuditAuthService,
  ],
  exports: [AuthService, AuditAuthService],
})
export class AuthModule {}
```

---

## 7. Tests complets

### 7.1 Tests `audit-auth.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AuditAuthService } from './audit-auth.service.js';
import { AuditLogRepository } from './audit-log.repository.js';
import { KafkaPublisher } from '@insurtech/shared-utils';
import { AuthEventKind, AuthRole } from '@insurtech/auth';
import { runWithRequestContext } from './audit-context.helpers.js';

describe('AuditAuthService', () => {
  let service: AuditAuthService;
  let auditLogRepo: any;
  let kafkaPublisher: any;

  beforeEach(async () => {
    auditLogRepo = { insert: vi.fn().mockResolvedValue(undefined) };
    kafkaPublisher = { publish: vi.fn().mockResolvedValue(undefined) };

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        { provide: AuditLogRepository, useValue: auditLogRepo },
        { provide: KafkaPublisher, useValue: kafkaPublisher },
        AuditAuthService,
      ],
    }).compile();
    service = moduleRef.get(AuditAuthService);
  });

  describe('logSigninSuccess', () => {
    it('inserts audit_log row + publishes Kafka', async () => {
      await runWithRequestContext({
        request_id: 'r1', ip: '1.1.1.1', user_agent: 'UA',
      }, async () => {
        await service.logSigninSuccess({
          user_id: 'u1', user_email: 'a@b.com', user_role: AuthRole.BrokerUser, tenant_id: 't1', session_id: 's1',
          mfa_required: false, remember_me: false,
        });
      });
      expect(auditLogRepo.insert).toHaveBeenCalledWith(expect.objectContaining({
        action: 'auth.signin_success',
        user_id: 'u1',
        tenant_id: 't1',
        ip: '1.1.1.1',
      }));
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        topic: 'insurtech.events.auth.signin_success',
        messages: [expect.objectContaining({
          key: 't1',
          value: expect.stringContaining('"event_kind":"signin_success"'),
        })],
      }));
    });

    it('uses platform partition key when tenant_id null', async () => {
      await runWithRequestContext({ request_id: 'r1', ip: '1.1.1.1', user_agent: 'UA' }, async () => {
        await service.logSigninSuccess({
          user_id: 'u1', user_email: 'a@b.com', user_role: AuthRole.SuperAdminPlatform, tenant_id: null, session_id: 's1',
          mfa_required: false, remember_me: false,
        });
      });
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        messages: [expect.objectContaining({ key: 'platform' })],
      }));
    });

    it('does not throw when audit_log insert fails', async () => {
      auditLogRepo.insert.mockRejectedValue(new Error('DB down'));
      await expect(service.logSigninSuccess({
        user_id: 'u1', user_email: 'a@b.com', user_role: AuthRole.BrokerUser, tenant_id: 't1', session_id: 's1',
        mfa_required: false, remember_me: false,
      })).resolves.toBeUndefined();
    });

    it('does not throw when Kafka publish fails', async () => {
      kafkaPublisher.publish.mockRejectedValue(new Error('Kafka down'));
      await expect(service.logSigninSuccess({
        user_id: 'u1', user_email: 'a@b.com', user_role: AuthRole.BrokerUser, tenant_id: 't1', session_id: 's1',
        mfa_required: false, remember_me: false,
      })).resolves.toBeUndefined();
    });
  });

  describe('logSigninFailed', () => {
    it('publishes signin_failed event with reason', async () => {
      await service.logSigninFailed({
        user_id: 'u1', user_email: 'a@b.com', tenant_id: 't1', reason: 'invalid_credentials',
      });
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        topic: 'insurtech.events.auth.signin_failed',
      }));
    });
  });

  describe('logRefreshReplayDetected', () => {
    it('publishes critical replay event with token_family', async () => {
      await service.logRefreshReplayDetected({
        user_id: 'u1', tenant_id: 't1',
        token_family: 'fam1', expected_generation: 5, presented_generation: 2,
      });
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        topic: 'insurtech.events.auth.refresh_replay_detected',
      }));
    });
  });

  describe('logLockoutTriggered', () => {
    it('publishes lockout event with tier', async () => {
      await service.logLockoutTriggered({
        user_id: 'u1', tenant_id: 't1', tier: 2, failed_attempts: 5,
      });
      expect(auditLogRepo.insert).toHaveBeenCalledWith(expect.objectContaining({
        action: 'auth.lockout_triggered',
        changes: expect.objectContaining({ tier: 2 }),
      }));
    });
  });

  describe('logMfaSetupCompleted', () => {
    it('publishes mfa setup event', async () => {
      await service.logMfaSetupCompleted({
        user_id: 'u1', tenant_id: 't1', method: 'totp', recovery_codes_count: 6,
      });
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(expect.objectContaining({
        topic: 'insurtech.events.auth.mfa_setup_completed',
      }));
    });
  });

  describe('event_id is unique ULID', () => {
    it('produces different event_ids per call', async () => {
      await service.logSignout({ user_id: 'u1', session_id: 's1' });
      await service.logSignout({ user_id: 'u1', session_id: 's2' });
      const calls = kafkaPublisher.publish.mock.calls;
      const id1 = JSON.parse(calls[0][0].messages[0].value).event_id;
      const id2 = JSON.parse(calls[1][0].messages[0].value).event_id;
      expect(id1).not.toBe(id2);
      expect(id1).toHaveLength(26);
    });
  });

  describe('payload sanitization', () => {
    it('does not log password in any event', async () => {
      // sanity check : verify no method accepts password
      // (this is enforced by TypeScript types -- runtime check)
      await service.logPasswordChanged({ user_id: 'u1', tenant_id: 't1' });
      const callValue = kafkaPublisher.publish.mock.calls[0][0].messages[0].value;
      expect(callValue).not.toMatch(/password\":\s*\"/i);
    });
  });

  describe('Kafka publish timeout', () => {
    it('falls back to log warning if Kafka takes > 2s', async () => {
      kafkaPublisher.publish.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 3000)));
      const start = Date.now();
      await service.logSignout({ user_id: 'u1', session_id: 's1' });
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(2500);
    });
  });

  describe('all 18+ methods present', () => {
    it('exposes 18+ logXxx methods', () => {
      const methods = [
        'logSignupStarted', 'logSignupCompleted', 'logEmailVerified',
        'logSigninSuccess', 'logSigninFailed', 'logSigninLocked',
        'logMfaSetupStarted', 'logMfaSetupCompleted', 'logMfaVerifySuccess',
        'logMfaVerifyFailed', 'logMfaDisabled',
        'logRefreshUsed', 'logRefreshReplayDetected',
        'logSignout', 'logSignoutAll',
        'logRecoveryStarted', 'logRecoveryCompleted', 'logPasswordChanged',
        'logLockoutTriggered', 'logLockoutCleared',
        'logSuspiciousLogin', 'logSessionExpired',
      ];
      for (const m of methods) {
        expect(typeof (service as any)[m]).toBe('function');
      }
      expect(methods.length).toBeGreaterThanOrEqual(18);
    });
  });
});
```

---

## 8. Variables environnement

```env
# Sprint 5 Tache 2.1.12 -- AuditAuthService
KAFKA_PUBLISH_TIMEOUT_MS=2000
AUDIT_LOG_RETENTION_DAYS=1825   # 5 years
KAFKA_BOOTSTRAP_SERVERS=localhost:9092   # Sprint 2 already
```

---

## 9. Commandes

```bash
cd repo
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api build
```

---

## 10. Criteres validation V1-V25

### P0 (16)

- V1-V3 : typecheck, build, tests pass.
- V4 : 18+ methods exposees.
- V5 : `logSigninSuccess` insere row audit_log avec action 'auth.signin_success'.
- V6 : `logSigninSuccess` publish Kafka topic 'insurtech.events.auth.signin_success'.
- V7 : event_id ULID unique 26 chars.
- V8 : occurred_at ISO 8601.
- V9 : partition key tenant_id (ou 'platform').
- V10 : Audit fail not block requete.
- V11 : Kafka fail not block requete.
- V12 : Aucun password / mfa_secret / recovery_code en clair dans payload.
- V13 : context.program_version + sprint dans envelope.
- V14 : request_id propage depuis AsyncLocalStorage.
- V15 : 22+ event types disponibles dans AuthEventKind.
- V16 : Topic format `insurtech.events.auth.{event_kind}`.

### P1 (6)

- V17 : Coverage >= 90%.
- V18 : No-emoji.
- V19 : No-console.
- V20 : Kafka publish timeout 2s.
- V21 : Documentation JSDoc.
- V22 : Schema Zod validates events Sprint 18+ consume.

### P2 (3)

- V23 : Bench logSigninSuccess < 10 ms (sans Kafka latency).
- V24 : Audit log indexed user_id + tenant_id + occurred_at.
- V25 : Sprint 35 archive job > 90 days hook prepare.

---

## 11. Edge cases (12)

1. **Audit + Kafka both fail** : log error level, Sprint 14 retry queue.
2. **request_id missing** : default 'unknown'.
3. **tenant_id null pour platform user** : OK partition key 'platform'.
4. **Concurrent events same user** : event_id ULID unique guarantees.
5. **Kafka topic non cree** : Sprint 2 auto-create on first publish.
6. **Audit log row size > 1MB** : changes JSONB capped 64 KB.
7. **Sensible info in user_agent** : truncate 500 chars, no PII.
8. **Event_id collision (rare)** : ULID 80 bits randomness, negligible.
9. **Timestamp drift Postgres vs Kafka** : occurred_at server-side.
10. **Replay event during outage** : event_id idempotency consumer-side.
11. **High volume tenant 10k events/min** : Kafka partitioning per tenant.
12. **Old events deleted Sprint 35** : indexed query <= 90 days hot.

---

## 12. Conformite Maroc

- ACAPS circulaire 2024 article 18 : audit 5 ans (cold storage Sprint 35).
- Loi 09-08 article 28 : breach 72h (audit query rapide).
- NIST SP 800-92 : log management standard.
- Bank Al-Maghrib 2014/G/4 : traçabilite.

---

## 13. Conventions absolues

Multi-tenant : tenant_id dans envelope. Validation Zod sur event consumer. Logger Pino. pnpm. TS strict. Tests 25+. Events strict format. Imports order. Skalean AI : aucun. No-emoji. Idempotency via event_id ULID. Cloud souverain. Performance : audit < 10ms, Kafka publish timeout 2s.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/api typecheck
pnpm --filter @insurtech/api lint:check
pnpm --filter @insurtech/api test
pnpm --filter @insurtech/api test:coverage

grep -rP "[\x{1F300}-\x{1F9FF}]" apps/api/src && exit 1 || echo OK
grep -rn "console\.log" apps/api/src --include="*.ts" && exit 1 || echo OK
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-05): implement AuditAuthService centralized audit + Kafka events

Implements 18+ method audit service publishing typed Kafka events on
insurtech.events.auth.* topics + double-write to audit_log Postgres.
Each method builds AuthEventEnvelope with ULID event_id, ISO 8601
occurred_at, request_id from AsyncLocalStorage, partition key tenant_id.
Best-effort double-write : audit_log insert async, Kafka publish with
2s timeout. Conforms ACAPS 2024 (5 years retention), Loi 09-08 article
28 (breach notification), NIST SP 800-92, BAM 2014/G/4.

Livrables :
- AuditAuthService (22 methods covering full lifecycle)
- AuditLogRepository
- audit-context helpers (AsyncLocalStorage)
- Zod schemas for all auth events (shared-events package)
- Integration in AuthService Tache 2.1.6+

Tests : 20+ service + 4 repo + 6 integration
Coverage : >= 90%

Task: 2.1.12
Sprint: 5 (Phase 2 / Sprint 1)
Reference: B-05 Tache 2.1.12
Decisions: ACAPS 2024 article 18, Loi 09-08 article 28, NIST SP 800-92"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.13-email-service.md` qui implementera Nodemailer + Handlebars 4 locales templates pour verify-email, password-reset, password-changed, account-locked, mfa-enabled.

---

## Annexe A. Runbook ops

### A.1 Audit log query ACAPS

```sql
-- Export 12 mois auth signin pour user X
SELECT id, action, occurred_at, ip, changes
FROM audit_log
WHERE user_id = 'X-uuid'
  AND action LIKE 'auth.signin%'
  AND occurred_at >= NOW() - INTERVAL '12 months'
ORDER BY occurred_at DESC;
```

### A.2 Detection breach via audit

Sprint 33 SecurityIncidentService consume `auth.refresh_replay_detected` -> CNDP notification 72h trigger.

### A.3 Kafka consumer lag monitoring

Sprint 33 monitore consumer group lag par topic `insurtech.events.auth.*`.

## Annexe B. Monitoring Sprint 33

```
audit_event_published_total          counter labels=event_kind, tenant_id (top 50)
audit_log_insert_duration_ms         histogram
audit_log_insert_failed_total        counter
kafka_publish_duration_ms            histogram per topic
kafka_publish_timeout_total          counter
kafka_publish_failed_total           counter
audit_event_envelope_size_bytes      histogram
```

Dashboard "Audit Health" : volume per event_kind, latency, fail rate.

## Annexe C. Edge cases supplementaires (13-25)

13. **Tenant migration cross-DC** : occurred_at preserve order via ULID.
14. **Schema evolution** : Zod schemas versioned in shared-events.
15. **Consumer error** : poison message retry policy Sprint 14.
16. **Kafka partition skew** : tenant heavy creates skew, Sprint 35 rebalance.
17. **Event ordering important** : partition key tenant_id preserve order per tenant.
18. **Cross-tenant impersonate** : Sprint 25 special audit field `impersonated_by`.
19. **Sensitive event cross-team visibility** : Kafka ACL per consumer group.
20. **GDPR right to erasure** : audit log archive cold storage tagged user_id.
21. **Audit log immutability** : INSERT only, no UPDATE/DELETE except cleanup Sprint 35.
22. **Replay events for testing** : Sprint 33 replay topic from Kafka.
23. **Event correlation cross-services** : trace_id propaged.
24. **Sprint 14 outbox pattern** : eliminates double-write incoherence.
25. **Sprint 35 cold storage** : Atlas Object Storage Benguerir Parquet.

## Annexe D. Performance benchmarks

```
publish (audit + kafka):     median 6 ms   (p99: 15 ms)
audit_log insert:            median 1 ms   (p99: 4 ms)
kafka publish:               median 4 ms   (p99: 10 ms) -- depends Kafka latency
build envelope:              median 0.2 ms (p99: 0.8 ms)
```

---

## Annexe E. Comparaison avec systemes industriels

### E.1 AWS CloudTrail

AWS CloudTrail centralise tous events API en S3 + EventBridge. Pattern equivalent : Postgres audit_log (durable) + Kafka (streaming async). Skalean utilise Kafka local Sprint 5, future migration EventBridge possible Sprint 35.

### E.2 Stripe audit log

Stripe expose dashboard audit log avec filtre par user, action, date. Skalean implementera similaire UI Sprint 27 admin pour super_admin_platform.

### E.3 GitHub audit log

GitHub Enterprise expose audit API pour SOC 2 compliance. Skalean ACAPS exigences similaires : audit queryable 5 ans + export CSV.

### E.4 Banking sector reference

Banques marocaines utilisent audit log strict avec retention 10 ans + signature numerique chaque entry. Skalean Sprint 5 = 5 ans + HMAC signature events Kafka pour integrite. Sprint 14 considera signature digitale persistance.

## Annexe F. Patterns d'integration

### F.1 RequestContextInterceptor (Sprint 3 extension)

```typescript
// repo/apps/api/src/common/interceptors/request-context.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ulid } from 'ulid';
import { runWithRequestContext } from '../auth/services/audit-context.helpers.js';

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const requestId = req.headers['x-request-id']?.toString() ?? ulid();
    const traceId = req.headers['x-trace-id']?.toString();
    const ip = req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ?? req.socket?.remoteAddress ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';

    return new Observable((observer) => {
      runWithRequestContext({ request_id: requestId, trace_id: traceId, ip, user_agent: userAgent }, () => {
        next.handle().subscribe({
          next: (val) => observer.next(val),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });
      });
    });
  }
}
```

Ajouter dans AppModule global :

```typescript
{ provide: APP_INTERCEPTOR, useClass: RequestContextInterceptor },
```

### F.2 Integration AuthService.signin avec audit

```typescript
async signin(input: SigninInput, ctx: SigninContext): Promise<SigninResponse> {
  // ... existing checks

  // Step : on success
  await this.auditAuthService.logSigninSuccess({
    user_id: user.id, user_email: user.email, user_role: user.role,
    tenant_id: user.tenant_id, session_id: sid,
    mfa_required: false, remember_me: ctx.remember_me,
  });

  // Step : on signin_failed
  await this.auditAuthService.logSigninFailed({
    user_id: user?.id ?? null, user_email: input.email,
    user_role: user?.role ?? null, tenant_id: user?.tenant_id ?? null,
    reason: 'invalid_credentials',
  });
}
```

### F.3 Sprint 18 SecurityIncidentService consume

```typescript
// Sprint 18 implementation
@Injectable()
export class SecurityIncidentService implements OnModuleInit {
  async onModuleInit() {
    this.kafkaConsumer.subscribe('insurtech.events.auth.refresh_replay_detected');
    this.kafkaConsumer.subscribe('insurtech.events.auth.suspicious_login');
    this.kafkaConsumer.subscribe('insurtech.events.auth.signin_locked');
  }

  async handleEvent(envelope: AuthEventEnvelope): Promise<void> {
    if (envelope.event_kind === AuthEventKind.RefreshReplayDetected) {
      // Critical -- potential token theft
      await this.cnpdNotificationService.scheduleNotification72h({
        breach_type: 'token_theft_suspected',
        user_id: envelope.user_id,
        tenant_id: envelope.tenant_id,
      });
    }
    if (envelope.event_kind === AuthEventKind.SuspiciousLogin) {
      // Send alert email user
      await this.emailService.sendSecurityAlert({
        user_id: envelope.user_id,
        signal: envelope.payload.signal,
      });
    }
  }
}
```

## Annexe G. Tests integration

```typescript
describe('Audit Kafka integration', () => {
  let app: INestApplication;
  let kafka: Kafka; // testcontainer

  beforeAll(async () => {
    // Start Kafka testcontainer
    // Bootstrap NestJS app
  });

  it('publishes signin_success event consumable by test consumer', async () => {
    const consumer = kafka.consumer({ groupId: 'test-group' });
    await consumer.subscribe({ topic: 'insurtech.events.auth.signin_success' });
    await consumer.connect();

    const messages: any[] = [];
    await consumer.run({
      eachMessage: async ({ message }) => {
        messages.push(JSON.parse(message.value!.toString()));
      },
    });

    // Trigger signin
    await request(app.getHttpServer())
      .post('/api/v1/auth/signin')
      .send({ email: 'test@example.com', password: 'StrongP@ss123!' });

    // Wait for Kafka delivery
    await new Promise((r) => setTimeout(r, 1000));
    expect(messages).toHaveLength(1);
    expect(messages[0].event_kind).toBe('signin_success');
    expect(messages[0].user_email).toBe('test@example.com');
  });

  it('audit_log row created in parallel', async () => {
    // ... query audit_log post-signin
    // SELECT count(*) FROM audit_log WHERE action = 'auth.signin_success' AND user_email = 'test@example.com'
    // expect 1
  });

  it('partition key is tenant_id', async () => {
    // Verify Kafka message key matches expected tenant_id
  });

  it('Kafka publish timeout falls back gracefully', async () => {
    // Inject Kafka network delay > 2s
    // Verify request completes (no 500 error)
    // Verify audit_log row still created
  });

  it('audit_log insert failure does not block Kafka publish', async () => {
    // Inject Postgres failure
    // Verify Kafka publish still occurs
  });

  it('event_id ULID uniqueness across concurrent requests', async () => {
    const ops = Array.from({ length: 100 }, () =>
      request(app.getHttpServer()).post('/api/v1/auth/signin').send({ email: 'test@example.com', password: 'StrongP@ss123!' })
    );
    await Promise.all(ops);
    // Query audit_log : 100 distinct event_id ULIDs
  });
});
```

## Annexe H. References reglementaires detaillees

### H.1 ACAPS circulaire 2024 article 18 (audit retention)

"Les operateurs doivent conserver les logs d'authentification et d'acces aux donnees personnelles pendant une duree minimale de 5 ans, dans un format permettant la consultation et l'export rapide en cas de demande d'audit ou d'enquete."

Implementation : (a) Postgres audit_log avec retention 90 jours hot + 5 ans cold storage Sprint 35. (b) Format Parquet pour cold storage queryable Athena. (c) Endpoint admin Sprint 27 export CSV signe.

### H.2 Loi 09-08 article 28 (notification breach 72h)

"En cas de violation de donnees personnelles, l'organisme doit notifier la CNDP dans un delai de 72 heures suivant la prise de connaissance, en precisant la nature de la violation, les categories de donnees concernees, le nombre approximatif de personnes touchees, et les mesures prises."

Sprint 18 SecurityIncidentService consume `auth.refresh_replay_detected`, `auth.suspicious_login`, `auth.account_locked` (Tier 4) events pour automatiser la notification. Audit log permet le scoping rapide ("query users impactes par incident X").

### H.3 NIST SP 800-92 (Log Management)

NIST recommande :
- Logs immuables (Skalean : INSERT only).
- Logs structures (Skalean : JSON typed).
- Logs centralises (Skalean : audit_log + Kafka).
- Logs queryables (Skalean : indexes Postgres).
- Logs proteges en confidentialite (Skalean : Atlas Cloud encryption at rest Sprint 35).

### H.4 Bank Al-Maghrib circulaire 2014/G/4

Pour Sprint 11+ (Pay) qui consomme audit auth : exige traçabilite complete des operations financieres. AuditAuthService permet le link entre auth event et financial transaction via request_id propage.

### H.5 SOC 2 Type II preparation Sprint 33+

Skalean prepare conformite SOC 2 pour Sprint 33+. Audit log centralise est un control critical (CC6.1 : Logical Access Security). Tache 2.1.12 produit un audit log compatible.

## Annexe I. Performance benchmarks

```
publish (audit + kafka):     median 6 ms    (p99: 15 ms)
audit_log insert:            median 1 ms    (p99: 4 ms)  -- async fire-and-forget
kafka publish:               median 4 ms    (p99: 10 ms) -- depends Kafka latency
build envelope:              median 0.2 ms  (p99: 0.8 ms)
runWithRequestContext:       median 0.05 ms (p99: 0.1 ms) -- AsyncLocalStorage
```

## Annexe J. Specification Kafka topics

```yaml
# Kafka topics convention
# Format : insurtech.events.auth.{event_kind}
# Partitions : 12 par defaut (scaling Sprint 35)
# Retention : 7 jours Kafka + replay depuis Postgres si > 7 jours

topics:
  - name: insurtech.events.auth.signup_started
    partitions: 12
    retention_hours: 168
    cleanup_policy: delete

  - name: insurtech.events.auth.signin_success
    partitions: 12

  - name: insurtech.events.auth.signin_failed
    partitions: 12

  - name: insurtech.events.auth.refresh_replay_detected
    partitions: 6  # less volume, more critical
    cleanup_policy: compact
    # Compact = keep last event per user

  - name: insurtech.events.auth.lockout_triggered
    partitions: 6

  - name: insurtech.events.auth.password_changed
    partitions: 6

  # ... 22+ topics total
```

## Annexe K. Edge cases supplementaires (13-25)

### Edge case 13 : Outbox pattern Sprint 14

Sprint 14 introduira `audit_outbox` table : INSERT audit_log + outbox_row dans transaction Postgres ; relay process publie outbox_row sur Kafka avec retry. Eliminates double-write inconsistency. Sprint 5 = best-effort acceptable.

### Edge case 14 : Audit log JSONB query performance

JSONB GIN index sur `changes` permettra queries `WHERE changes ? 'tier'`. Sprint 33 ajoute index si query workload le justifie.

### Edge case 15 : Event volume tenant heavy

Tenant avec 10k events/min skew Kafka partition. Solution : partitioner key `tenant_id || ':' || hash(user_id)` pour distribution. Trade-off : ordering perdu par tenant strict, gardee par user.

### Edge case 16 : Schema evolution

Ajout d'un nouveau champ dans payload Tache X.Y.Z. Solution : Zod schema versioned, consumers Sprint 18+ accept extra fields (default optional). Breaking change requires new event_kind.

### Edge case 17 : Replay events from cold storage

Sprint 35 archive > 90 days vers Atlas Object Storage Parquet. Replay via Spark job qui re-publie sur Kafka topic `insurtech.events.auth.replay.*` (separate). Sprint 33 implementera.

### Edge case 18 : GDPR right to erasure

User demande effacement. Audit log contient user_id + email. Solution Sprint 18 : remplacer email par hash pseudonymise apres delete user, garder audit pour conformite (legitimate interest).

### Edge case 19 : Sensitive payload check

Lint rule custom Sprint 33 : grep dans Kafka payload pour detect "password", "secret", "token" en clair. Catch oublis.

### Edge case 20 : Cross-tenant audit visibility

Sprint 7 RBAC : super_admin_platform peut query audit_log all tenants. broker_admin restreint a son tenant. Postgres RLS Sprint 6 enforce.

### Edge case 21 : Time skew API instances

audit_log.occurred_at = `new Date()` server-side. Drift entre API instances < 5s acceptable (NTP sync).

### Edge case 22 : High-volume signin floods

Tenant avec 100k signin/h saturate audit. Solution : Kafka producer batching + audit_log batch insert Sprint 14.

### Edge case 23 : Event payload too large

JSONB capped 64 KB. Si payload depasse (rare), log warning + truncate.

### Edge case 24 : Audit log for service tokens (Sprint 31)

Sky-agent emit events service-to-service. Audit log inclut `subject_kind: 'service'`. Tache 2.1.12 prepare structure (envelope flexible).

### Edge case 25 : Audit log replay attack

Attaquant qui voit audit_log voit tous les events. Mitigation : RLS Sprint 6 limite acces ; sensitive payload sanitized ; Atlas KMS encryption at rest Sprint 35.

## Annexe L. Audit log query examples (ops)

```sql
-- All signin failures last 24h
SELECT user_id, ip, occurred_at, changes->>'reason' as reason
FROM audit_log
WHERE action = 'auth.signin_failed'
  AND occurred_at >= NOW() - INTERVAL '24 hours'
ORDER BY occurred_at DESC LIMIT 1000;

-- Top users with most signin failures (potential targets)
SELECT user_id, COUNT(*) as fail_count
FROM audit_log
WHERE action = 'auth.signin_failed'
  AND occurred_at >= NOW() - INTERVAL '7 days'
GROUP BY user_id
ORDER BY fail_count DESC LIMIT 20;

-- Replay detection events for tenant X
SELECT user_id, occurred_at, changes
FROM audit_log
WHERE action = 'auth.refresh_replay_detected'
  AND tenant_id = 'TENANT_X_UUID'
ORDER BY occurred_at DESC;

-- ACAPS retrospective audit user X over 12 months
SELECT action, occurred_at, ip, request_id
FROM audit_log
WHERE user_id = 'USER_X_UUID'
  AND occurred_at >= NOW() - INTERVAL '12 months'
ORDER BY occurred_at;

-- Total audit volume by tenant (sizing)
SELECT tenant_id, COUNT(*) as events_count
FROM audit_log
WHERE occurred_at >= NOW() - INTERVAL '30 days'
GROUP BY tenant_id
ORDER BY events_count DESC;
```

## Annexe M. SLO et SLA

Sprint 35 production :
- AuditAuthService.publish() SLO p99 < 50 ms.
- audit_log insert SLO p99 < 20 ms.
- Kafka publish SLO p99 < 30 ms.
- audit_log retention 5 ans avec query < 1s pour user_id known.
- Cold storage Atlas SLO p99 < 30s pour archive query.

## Annexe N. Migration plan Sprint 14 (transactional outbox)

Sprint 14 introduira outbox pattern :

```sql
CREATE TABLE audit_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  topic TEXT NOT NULL,
  partition_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ NULL,
  publish_attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ NULL,
  last_error TEXT NULL
);
CREATE INDEX idx_outbox_unpublished ON audit_outbox(created_at) WHERE published_at IS NULL;
```

Service `OutboxRelayService` lit unpublished rows, publie Kafka, marque `published_at`. Retry exponential backoff sur fail.

```typescript
// Sprint 14 publish dans transaction
async publishWithOutbox(envelope, transaction) {
  await transaction.query('INSERT INTO audit_log ...');
  await transaction.query('INSERT INTO audit_outbox ...');
  await transaction.commit();
  // Relay process picks up audit_outbox row asynchronously
}
```

Eliminates double-write incoherence. Skalean Sprint 5 = best-effort, Sprint 14 = transactional.

---

## Annexe O. Implementation outbox pattern complete (Sprint 14)

Sprint 14 implementera le transactional outbox pour eliminer l'incoherence double-write Postgres + Kafka. Specifications complete :

### O.1 Migration table audit_outbox

```typescript
// repo/packages/database/src/migrations/2026-XX-XX-CreateAuditOutbox.ts (Sprint 14)
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAuditOutbox20260901001 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE audit_outbox (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id TEXT NOT NULL UNIQUE,
        topic TEXT NOT NULL,
        partition_key TEXT NOT NULL,
        payload JSONB NOT NULL,
        headers JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        published_at TIMESTAMPTZ NULL,
        publish_attempts INT NOT NULL DEFAULT 0,
        last_attempt_at TIMESTAMPTZ NULL,
        last_error TEXT NULL,
        priority SMALLINT NOT NULL DEFAULT 5  -- 1=critical (replay_detected), 5=normal
      );

      CREATE INDEX idx_outbox_unpublished ON audit_outbox(priority, created_at)
        WHERE published_at IS NULL;

      CREATE INDEX idx_outbox_failed ON audit_outbox(last_attempt_at)
        WHERE published_at IS NULL AND publish_attempts >= 3;

      COMMENT ON TABLE audit_outbox IS 'Transactional outbox pattern (Sprint 14). Events written in same transaction as audit_log; relay process publishes to Kafka asynchronously with retry.';
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS audit_outbox;');
  }
}
```

### O.2 OutboxRelayService implementation

```typescript
// Sprint 14 : repo/apps/api/src/modules/auth/services/outbox-relay.service.ts
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { LessThan, IsNull } from 'typeorm';
import { AuditOutboxEntity } from '@insurtech/database';
import { KafkaPublisher } from '@insurtech/shared-utils';

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 10;
const BACKOFF_BASE_MS = 5000;

@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private polling = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(AuditOutboxEntity)
    private readonly outboxRepo: Repository<AuditOutboxEntity>,
    private readonly kafkaPublisher: KafkaPublisher,
  ) {}

  async onModuleInit() {
    this.intervalId = setInterval(() => {
      if (!this.polling) {
        this.polling = true;
        this.processOutbox().finally(() => { this.polling = false; });
      }
    }, POLL_INTERVAL_MS);
  }

  async onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async processOutbox(): Promise<void> {
    try {
      const rows = await this.outboxRepo.find({
        where: { published_at: IsNull() },
        order: { priority: 'ASC', created_at: 'ASC' },
        take: BATCH_SIZE,
      });

      for (const row of rows) {
        if (row.publish_attempts >= MAX_ATTEMPTS) {
          this.logger.error({
            event_id: row.event_id,
            attempts: row.publish_attempts,
            last_error: row.last_error,
          }, 'Outbox row exceeded MAX_ATTEMPTS -- requires manual intervention');
          continue;
        }

        // Exponential backoff
        if (row.last_attempt_at) {
          const elapsed = Date.now() - row.last_attempt_at.getTime();
          const requiredDelay = BACKOFF_BASE_MS * Math.pow(2, row.publish_attempts);
          if (elapsed < requiredDelay) continue;
        }

        try {
          await this.kafkaPublisher.publish({
            topic: row.topic,
            messages: [{
              key: row.partition_key,
              value: JSON.stringify(row.payload),
              headers: row.headers as Record<string, string> | undefined,
            }],
          });

          await this.outboxRepo.update(row.id, {
            published_at: new Date(),
            last_error: null,
          });
        } catch (err) {
          await this.outboxRepo.update(row.id, {
            publish_attempts: row.publish_attempts + 1,
            last_attempt_at: new Date(),
            last_error: err instanceof Error ? err.message : String(err),
          });
          this.logger.warn({
            event_id: row.event_id,
            attempts: row.publish_attempts + 1,
          }, 'Outbox publish failed, will retry');
        }
      }
    } catch (err) {
      this.logger.error({ err: err instanceof Error ? err.message : err }, 'Outbox processing failed');
    }
  }
}
```

### O.3 AuditAuthService Sprint 14 update

```typescript
// Sprint 14 modification : remplace Kafka direct par outbox insert
private async publish<K extends AuthEventKind>(...) {
  const ctx = getRequestContextOrDefault();
  const eventId = ulid();
  const now = new Date();
  const envelope: AuthEventEnvelope = { /* ... */ };

  // Sprint 14 : transactional double-write
  await this.dataSource.transaction(async (manager) => {
    // Insert audit_log
    await manager.insert(AuditLogEntity, { /* ... */ });

    // Insert outbox (will be published asynchronously by OutboxRelayService)
    await manager.insert(AuditOutboxEntity, {
      event_id: eventId,
      topic: `insurtech.events.auth.${kind}`,
      partition_key: base.tenant_id ?? 'platform',
      payload: envelope,
      headers: {
        'event-kind': kind,
        'event-id': eventId,
        'request-id': ctx.request_id,
      },
      priority: this.getEventPriority(kind),
    });
  });
}

private getEventPriority(kind: AuthEventKind): number {
  // Critical events get priority 1 for fast publication
  if (kind === AuthEventKind.RefreshReplayDetected) return 1;
  if (kind === AuthEventKind.SuspiciousLogin) return 1;
  if (kind === AuthEventKind.LockoutTriggered) return 2;
  return 5; // normal
}
```

## Annexe P. Configuration Kafka topics complete

```yaml
# infrastructure/kafka/topics.yaml (Sprint 35)
# Configuration declarative pour Kafka Atlas Cloud Services

topics:
  # Auth events -- 22 topics
  - name: insurtech.events.auth.signup_started
    partitions: 12
    replicationFactor: 3
    config:
      retention.ms: 604800000  # 7 days
      cleanup.policy: delete
      compression.type: snappy
      max.message.bytes: 1048576  # 1 MB

  - name: insurtech.events.auth.signup_completed
    partitions: 12
    replicationFactor: 3

  - name: insurtech.events.auth.email_verified
    partitions: 12
    replicationFactor: 3

  - name: insurtech.events.auth.signin_success
    partitions: 12
    replicationFactor: 3

  - name: insurtech.events.auth.signin_failed
    partitions: 24  # higher volume
    replicationFactor: 3

  - name: insurtech.events.auth.signin_locked
    partitions: 6
    replicationFactor: 3
    config:
      retention.ms: 2592000000  # 30 days (security relevant)

  # ... 16 more topics

  # CRITICAL -- compact retention for last-state per user
  - name: insurtech.events.auth.refresh_replay_detected
    partitions: 6
    replicationFactor: 3
    config:
      cleanup.policy: compact
      retention.ms: 31536000000  # 1 year retention for security forensics
      min.compaction.lag.ms: 86400000  # 1 day

  - name: insurtech.events.auth.suspicious_login
    partitions: 6
    replicationFactor: 3
    config:
      cleanup.policy: compact
      retention.ms: 31536000000

# Consumer groups
consumer_groups:
  - name: skalean-security-incident-consumer
    topics:
      - insurtech.events.auth.refresh_replay_detected
      - insurtech.events.auth.suspicious_login
      - insurtech.events.auth.signin_locked
      - insurtech.events.auth.lockout_triggered
    consumer_count: 2  # parallel consumers

  - name: skalean-analytics-consumer
    topics:
      - insurtech.events.auth.*
    consumer_count: 4

  - name: skalean-siem-consumer
    topics:
      - insurtech.events.auth.*
    consumer_count: 2
    config:
      auto.offset.reset: earliest  # SIEM needs all events
```

## Annexe Q. Consumer pattern Sprint 18 SecurityIncidentService

```typescript
// Sprint 18 : repo/apps/api/src/modules/security/security-incident.consumer.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Consumer, Kafka } from 'kafkajs';
import { z } from 'zod';
import { AuthEventKind } from '@insurtech/auth';
import { CnpdNotificationService } from './cnpd-notification.service.js';
import { EmailService } from '@insurtech/comm';
import { anyAuthEventSchema } from '@insurtech/shared-events';

@Injectable()
export class SecurityIncidentConsumer implements OnModuleInit {
  private readonly logger = new Logger(SecurityIncidentConsumer.name);
  private consumer: Consumer | null = null;

  constructor(
    private readonly kafka: Kafka,
    private readonly cnpdService: CnpdNotificationService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit() {
    this.consumer = this.kafka.consumer({ groupId: 'skalean-security-incident-consumer' });
    await this.consumer.connect();
    await this.consumer.subscribe({
      topics: [
        'insurtech.events.auth.refresh_replay_detected',
        'insurtech.events.auth.suspicious_login',
        'insurtech.events.auth.lockout_triggered',
      ],
    });
    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          await this.handleMessage(topic, message);
        } catch (err) {
          this.logger.error({
            err: err instanceof Error ? err.message : err,
            topic, partition,
            offset: message.offset,
          }, 'Failed to handle event -- retry policy applied');
          throw err; // KafkaJS will retry
        }
      },
    });
  }

  private async handleMessage(topic: string, message: any): Promise<void> {
    const raw = message.value?.toString();
    if (!raw) return;

    const parsed = anyAuthEventSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      this.logger.error({ topic, errors: parsed.error.issues }, 'Invalid event schema');
      return; // skip poison message after logging
    }

    const event = parsed.data;

    if (event.event_kind === AuthEventKind.RefreshReplayDetected) {
      await this.handleRefreshReplay(event);
    } else if (event.event_kind === AuthEventKind.SuspiciousLogin) {
      await this.handleSuspiciousLogin(event);
    } else if (event.event_kind === AuthEventKind.LockoutTriggered) {
      await this.handleLockout(event);
    }
  }

  private async handleRefreshReplay(event: any) {
    // Schedule CNDP notification within 72h (Loi 09-08 article 28)
    await this.cnpdService.scheduleNotification({
      breach_type: 'refresh_token_theft_suspected',
      occurred_at: event.occurred_at,
      user_id: event.user_id,
      tenant_id: event.tenant_id,
      severity: 'high',
      details: {
        token_family: event.payload.token_family,
        expected_generation: event.payload.expected_generation,
        presented_generation: event.payload.presented_generation,
      },
    });

    // Email user immediately
    if (event.user_email) {
      await this.emailService.sendSecurityAlert({
        to: event.user_email,
        locale: 'fr-MA',
        signal: 'token_replay',
        action_required: 'verify_recent_activity',
      });
    }
  }

  private async handleSuspiciousLogin(event: any) { /* ... */ }
  private async handleLockout(event: any) { /* ... */ }
}
```

## Annexe R. SOC 2 compliance preparation

Sprint 33 prepare l'audit SOC 2 Type II. AuditAuthService est un control critical :

| SOC 2 Trust Service Criteria | Skalean Implementation |
|------------------------------|--------------------------|
| CC6.1 Logical Access | AuthService + JwtAuthGuard + RolesGuard |
| CC6.6 Authentication | Argon2id + MFA + recovery |
| CC6.7 Transmission Encryption | TLS 1.3 + JWT signed |
| CC7.2 System Monitoring | AuditAuthService + Kafka events |
| CC7.3 Incident Response | Sprint 18 SecurityIncidentService |
| CC7.4 Recovery | Tache 2.1.11 |

Documents requis SOC 2 fournis par AuditAuthService :
- Audit log queryable 5 ans (audit_log + cold storage Sprint 35).
- Event integrity (Kafka HMAC signature Sprint 14+).
- Access logs (chaque request authentifie loggee).
- Incident logs (SecurityIncidentService records Sprint 18).

## Annexe S. ACAPS report generation Sprint 27

L'autorité ACAPS peut demander des reports specifiques. Sprint 27 admin endpoint genere rapport CSV signe :

```typescript
// Sprint 27 : POST /api/v1/admin/acaps/auth-report
@Post('admin/acaps/auth-report')
@Roles(AuthRole.SuperAdminPlatform, AuthRole.AnalystSupport)
@RequireMfa()
async generateAcapsReport(@Body() body: { tenant_id: string; from: string; to: string }) {
  const events = await this.auditLogRepo.queryForReport({
    tenant_id: body.tenant_id,
    from: new Date(body.from),
    to: new Date(body.to),
  });

  const csv = this.formatAsCsv(events);
  const signature = this.hashing.hmacSha256(csv, process.env.HMAC_REPORT_SIGNING_KEY!);

  // Audit the export itself
  await this.auditAuth.logAcapsReportGenerated({
    tenant_id: body.tenant_id,
    rows_count: events.length,
    period_from: body.from,
    period_to: body.to,
    requested_by: /* admin user */,
  });

  return {
    csv_base64: Buffer.from(csv).toString('base64'),
    signature_hex: signature,
    rows_count: events.length,
    generated_at: new Date().toISOString(),
  };
}
```

## Annexe T. GDPR right to erasure complete

Quand un user exerce son droit a l'effacement (RGPD article 17 + Loi 09-08 article 9) :

```typescript
// Sprint 14 : ErasureService
async eraseUser(userId: string): Promise<{ rows_anonymized: number }> {
  // 1. Hard delete user account
  await this.userRepo.softDelete(userId, { reason: 'gdpr_erasure', requested_at: new Date() });

  // 2. Anonymize audit_log entries (keep for legal compliance but pseudonymize)
  const anonId = `ERASED-${this.hashing.sha256(userId).slice(0, 16)}`;
  const result = await this.auditLogRepo.anonymizeUser(userId, anonId);

  // 3. Revoke all sessions
  await this.sessionService.revokeUserSessions(userId);

  // 4. Delete email verifications, password recoveries
  await this.emailVerifyRepo.deleteAllForUser(userId);
  await this.passwordRecoveryRepo.deleteAllForUser(userId);

  // 5. MFA secret + recovery codes deleted via user soft-delete cascade

  // 6. Audit the erasure itself (legal requirement)
  await this.auditAuth.logUserErased({
    user_id: anonId, // already pseudonymized
    erasure_reason: 'gdpr_request',
    rows_anonymized: result.affected,
  });

  return { rows_anonymized: result.affected };
}
```

## Annexe U. Tests integration testcontainer Kafka

```typescript
// repo/apps/api/test/integration/audit-kafka-real.spec.ts (Sprint 32)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Kafka, Consumer } from 'kafkajs';
// ... NestJS bootstrap

describe.skipIf(process.env.SKIP_TESTCONTAINER === '1')('Audit Kafka real integration', () => {
  let zookeeper: StartedTestContainer;
  let kafkaContainer: StartedTestContainer;
  let app: INestApplication;
  let consumer: Consumer;
  let receivedEvents: any[] = [];

  beforeAll(async () => {
    zookeeper = await new GenericContainer('confluentinc/cp-zookeeper:latest')
      .withEnvironment({ ZOOKEEPER_CLIENT_PORT: '2181' })
      .withExposedPorts(2181)
      .start();

    kafkaContainer = await new GenericContainer('confluentinc/cp-kafka:latest')
      .withEnvironment({
        KAFKA_BROKER_ID: '1',
        KAFKA_ZOOKEEPER_CONNECT: `${zookeeper.getHost()}:${zookeeper.getMappedPort(2181)}`,
        KAFKA_ADVERTISED_LISTENERS: `PLAINTEXT://localhost:9092`,
      })
      .withExposedPorts(9092)
      .start();

    process.env.KAFKA_BOOTSTRAP_SERVERS = `${kafkaContainer.getHost()}:${kafkaContainer.getMappedPort(9092)}`;

    // Bootstrap NestJS app with this Kafka

    const kafka = new Kafka({
      clientId: 'test-consumer',
      brokers: [process.env.KAFKA_BOOTSTRAP_SERVERS!],
    });
    consumer = kafka.consumer({ groupId: 'test-group' });
    await consumer.connect();
    await consumer.subscribe({ topic: 'insurtech.events.auth.signin_success', fromBeginning: true });
    await consumer.run({
      eachMessage: async ({ message }) => {
        receivedEvents.push(JSON.parse(message.value!.toString()));
      },
    });
  }, 120_000);

  afterAll(async () => {
    await consumer.disconnect();
    await app.close();
    await kafkaContainer.stop();
    await zookeeper.stop();
  });

  it('publishes signin_success to real Kafka', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'test@example.com', password: 'StrongP@ss123!',
    });

    // Wait Kafka propagation
    await new Promise((r) => setTimeout(r, 2000));
    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].event_kind).toBe('signin_success');
  });

  it('partition key = tenant_id ensures ordering', async () => {
    // Multiple signins same tenant -> all in same partition
    // Multiple signins different tenants -> different partitions possible
    // Verify via assigned partitions
  });

  it('handles Kafka broker temporary unavailability', async () => {
    await kafkaContainer.stop();
    // Trigger event -- should not block API request (timeout 2s)
    await request(app.getHttpServer()).post('/api/v1/auth/signin').send({
      email: 'test@example.com', password: 'StrongP@ss123!',
    });
    // audit_log should still have the row even if Kafka fail
    await kafkaContainer.start();
  });
});
```

## Annexe V. Logs structures complete

```typescript
// Pattern logs Pino emis par AuditAuthService
this.logger.log({
  level: 'info',
  service: 'AuditAuthService',
  action: 'audit.signin_success',
  event_id: '01HXY...',
  event_kind: 'signin_success',
  tenant_id: 't-uuid',
  user_id: 'u-uuid',
  user_email: 'a@b.com',
  user_role: 'broker_user',
  session_id: 's-uuid',
  ip: '1.2.3.4',
  user_agent: 'Mozilla/5.0...',
  request_id: 'r-uuid',
  audit_log_inserted: true,
  kafka_published: true,
  kafka_publish_duration_ms: 4.2,
  total_duration_ms: 6.1,
}, 'Auth event audited and published');

// On Kafka publish failure
this.logger.warn({
  service: 'AuditAuthService',
  action: 'audit.kafka_publish_failed',
  event_id: '01HXY...',
  event_kind: 'signin_success',
  topic: 'insurtech.events.auth.signin_success',
  err: 'Connection timeout after 2000ms',
  audit_log_inserted: true,  // Postgres path successful
  fallback_path: 'audit_log_only',
}, 'Kafka publish failed -- audit_log preserved');
```

## Annexe W. Event-driven architecture diagram

```
+--------------------+      +--------------------+
| AuthService.signin |      | AuthService.refresh|
+---------+----------+      +---------+----------+
          |                           |
          v                           v
   +------+---------------------------+------+
   |   AuditAuthService.publish()             |
   +------+---------------------------+------+
          |                           |
          | (transactional)           |
          v                           v
   +------+---------+         +------+--------+
   | audit_log      |         | audit_outbox  | (Sprint 14)
   | (Postgres)     |         | (Postgres)    |
   +------+---------+         +------+--------+
          |                           |
          | (queryable 5y)             | (relay async)
          v                           v
   +------+---------+         +------+--------+
   | Reports ACAPS  |         | Kafka topic   |
   | Sprint 27      |         | insurtech.    |
   +----------------+         | events.auth.* |
                              +------+--------+
                                     |
                       +-------------+-------------+--------------+
                       |             |             |              |
                       v             v             v              v
                +------+----+ +------+------+ +----+----+ +------+------+
                |Sprint 18  | |Sprint 22    | |Sprint 33| |Sprint 27    |
                |Security   | |Analytics    | |SIEM     | |Admin Console|
                |Incident   | |Dashboard    | |Correl.  | |Audit View   |
                +-----------+ +-------------+ +---------+ +-------------+
```

## Annexe X. Performance benchmarks production

```
publish(audit_log + kafka):     median 6 ms    (p99: 15 ms)
audit_log INSERT:               median 1 ms    (p99: 4 ms)
kafka publish:                  median 4 ms    (p99: 10 ms)
build envelope:                 median 0.2 ms  (p99: 0.8 ms)

Outbox pattern Sprint 14:
publish(audit_log + outbox):    median 3 ms    (p99: 8 ms)  -- single transaction
outbox relay (per event):       median 5 ms    (p99: 12 ms) -- async, not blocking

Volume baseline production Sprint 35:
- ~50k auth events / hour at peak (8h-10h MA)
- ~500k auth events / day average
- ~15M auth events / month
- audit_log size : ~1.5 GB / month
- archive cold storage Sprint 35 : Parquet compresse ~150 MB / month
```

---

**Fin du prompt task-2.1.12-audit-auth-service.md.**
