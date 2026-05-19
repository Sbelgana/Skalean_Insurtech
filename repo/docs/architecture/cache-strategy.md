# Cache Strategy -- Skalean InsurTech v2.2

**Reference** : `00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md` (Tache 1.1.5)
**Sprint d'implementation** : Sprint 1
**Statut** : Implemented

---

## Overview

Skalean InsurTech utilise **Redis 7.4.1** comme cache et coordonne 6 usages distincts via **6 DBs Redis separes** (DB 0 a DB 5). Cette separation permet :

- Flush selectif par usage (`FLUSHDB` sur DB 0 cache sans impacter DB 1 sessions).
- Monitoring memoire per-usage (`INFO memory db0`).
- Eviction policies differenciees (LRU agressive cache vs immutable sessions).
- Scaling separable future (Sprint 35 prod : Redis Cluster avec slots dedies).

---

## 6 DBs Strategy

| DB | Constant | Usage | TTL typique | Sprint impl |
|----|----------|-------|-------------|-------------|
| 0  | `REDIS_DB.CACHE`      | Cache JSON (police, contact, devis, facture) | 5-60 min | Sprint 8 |
| 1  | `REDIS_DB.SESSIONS`   | Sessions utilisateurs (refresh, MFA, OTP)    | 7-30 jours | Sprint 5 |
| 2  | `REDIS_DB.QUEUES`     | Backend BullMQ (WhatsApp, PDF, ETL, MCP)     | persistent | Sprint 9 |
| 3  | `REDIS_DB.LOCKS`      | Redlock distributed locks                    | 30s-5min | Sprint 11 |
| 4  | `REDIS_DB.AI_CACHE`   | Cache reponses Skalean AI                    | 1h-24h | Sprint 29 |
| 5  | `REDIS_DB.RATE_LIMIT` | Rate limit sliding window                    | 1min-1h | Sprint 33 |

---

## Naming convention

**Pattern** : `{module}:{entity}:{tenant_id}:{entity_id}[:{sub}]`

Le `tenant_id` est obligatoire pour tous les usages tenant-scoped (cache, locks, AI, rate limit tenant). L'isolation est ainsi imposee au niveau cle Redis (impossible de leak cross-tenant via collision de cle).

### Exemples

```
cache:police:abc-tenant-id:def-police-id                # JSON police data
cache:contact:abc-tenant-id:def-contact-id              # JSON contact
cache:devis:abc-tenant-id:def-devis-id                  # JSON devis
cache:facture:abc-tenant-id:def-facture-id              # JSON facture

session:user:abc-tenant-id:def-user-id                  # session metadata
session:mfa:abc-tenant-id:def-user-id                   # MFA TOTP secret
session:otp:abc-tenant-id:def-user-id:phone             # OTP SMS code

queue:wa-send:waiting                                   # BullMQ internal
queue:wa-send:active
queue:pdf-gen:waiting
queue:etl-postgres-clickhouse:waiting

lock:police-validation:abc-tenant-id:def-police-id      # Redlock token
lock:payment:abc-tenant-id:def-transaction-id

ai:estimation-photo:abc-tenant-id:hash-photo-xyz        # AI Vision cache
ai:cgv-summary:abc-tenant-id:hash-cgv                   # AI text summary

ratelimit:login:ip:192.168.1.1                          # IP-based
ratelimit:login:user:abc-tenant-id:def-user-id          # User-based
ratelimit:api:abc-tenant-id:endpoint:/users
```

---

## Helpers TypeScript

```typescript
import {
  getRedisClient,
  REDIS_DB,
  getTenantCacheKey,
  getGlobalKey,
} from '@insurtech/shared-utils';

const cacheClient = getRedisClient(REDIS_DB.CACHE);
const sessionsClient = getRedisClient(REDIS_DB.SESSIONS);

const policeKey = getTenantCacheKey('cache', 'police', tenantId, policeId);
await cacheClient.set(policeKey, JSON.stringify(police), 'EX', 600);

const queueKey = getGlobalKey('queue', 'wa-send', 'waiting');
```

---

## Eviction policies

Configure dans `infrastructure/docker/redis/redis.conf` (Tache 1.1.3) :

- `maxmemory 512mb` : limite RAM Redis dev
- `maxmemory-policy allkeys-lru` : evict any key LRU when memory full
- `notify-keyspace-events Ex` : pub/sub sur eviction (debug + monitoring)

En prod (Sprint 35), policy par DB potentiellement differente :

- DB 0 cache : `allkeys-lru` (evict cache colder first)
- DB 1 sessions : `volatile-ttl` (evict sessions proches de expiration first)
- DB 2 queues : `noeviction` (never evict, but reject writes when full)
- DB 3 locks : `volatile-ttl`
- DB 4 AI cache : `allkeys-lru`
- DB 5 rate limit : `volatile-ttl`

---

## Migration vers Redis Cluster (Sprint 35)

L'architecture 6 DBs separes facilite la migration future :

- 1 instance dev = 1 instance prod managed Atlas Cloud Services Benguerir Redis
- Si scaling necessaire : Redis Cluster avec slots dedies par DB (decoupage horizontal preserve isolation)

Pour Sprint 1-34, 1 instance Redis suffit.

---

## References

- decision-001 (monorepo)
- decision-006 (no-emoji)
- decision-002 (multi-tenant strict via tenant_id dans key)
- decision-008 (data residency Maroc -- Atlas Cloud Services prod)
- ioredis 5.4.2 documentation
