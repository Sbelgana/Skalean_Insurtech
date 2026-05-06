# META-PROMPT B-34 -- SPRINT 34 PERFORMANCE SCALING

**Version** : v2.2 (Option B)
**Phase** : 7 -- Hardening + Integrations + Pilote
**Sprint** : 34 / 35 (cumul) -- Phase 7 Sprint 6
**Position** : Apres Pentest Securite, avant Pilote Marrakech Go-Live
**Numerotation taches** : 7.6.1 a 7.6.12
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (performance scaling validee critique avant pilote production)

---

## Objectif Global du Sprint

Validation **performance + scaling** plateforme : load testing realistic + benchmarks + bottlenecks identification + horizontal scaling + cost optimization. Sprint 34 = filtre apres securite : verifier infrastructure peut supporter pilote Marrakech (50-200 users initial) + projections croissance (Phase 8+ : 5k+ users, 50k+ polices/mois, 5k+ sinistres/mois).

A la sortie de ce sprint :
- Load testing K6 + Artillery scenarios realistic per app
- Benchmarks performance : SLOs definis (p95 latency, throughput, error rate)
- Bottlenecks identifies + optimises : DB queries + Kafka throughput + Redis + N+1 patterns
- Horizontal scaling validated : autoscaling rules + load balancing
- Cost optimization : right-sizing instances + reserved capacity strategy
- Database optimization : indexes + read replicas + connection pooling
- CDN strategy : Cloudflare static assets
- Cache strategy review : Redis TTLs + hit ratios
- Monitoring enrichi : APM (Application Performance Monitoring) + dashboards SLI/SLO
- Documentation runbook ops + capacity planning

---

## Frontiere du Sprint

**INCLUS** :
- Load testing scenarios realistic
- Benchmarks SLOs defines
- Bottlenecks optimization
- Horizontal scaling rules
- Cost optimization
- DB optimization (indexes + read replicas)
- CDN + cache strategy
- APM + SLI/SLO dashboards
- Documentation runbook ops

**EXCLU** (sera ajoute aux sprints suivants) :
- Pilote Marrakech go-live -- Sprint 35
- Multi-region deployment -- Phase 8+ (Tunisie/Algerie expansion)
- ML-powered auto-scaling -- Phase 8+
- Edge computing CDN avance -- Phase 8+

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 33 : securite green
2. Phase 1-6 deliverables (capacite testing)
3. AWS / Azure / GCP / Atlas Cloud Services best practices scaling (production hosting Atlas Cloud Services Benguerir -- decision-008)
4. PostgreSQL performance tuning guide

---

## Stack Imposee (Sprint 34)

| Composant | Version | Notes |
|-----------|---------|-------|
| K6 | 0.55.x | load testing primary |
| Artillery | 2.x | spikes + chaos testing |
| pgbench | inclu Postgres | benchmark DB |
| Datadog APM ou Grafana Cloud | latest | APM monitoring |
| AWS Auto Scaling Groups | latest | horizontal scaling |
| Cloudflare | latest | CDN + WAF |

Variables env : `DATABASE_REPLICA_URL`, `REDIS_CLUSTER_NODES`, `CDN_URL`.

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 7.6.1 | SLOs definition + APM monitoring setup (Datadog/Grafana Cloud) | 5h | P0 | Sprint 33 |
| 7.6.2 | Load testing K6 scenarios realistic per app (8 apps + api + mcp) | 8h | P0 | 7.6.1 |
| 7.6.3 | Database optimization : indexes review + slow queries + N+1 patterns | 7h | P0 | 7.6.2 |
| 7.6.4 | Read replicas Postgres + connection pooling tuning | 6h | P0 | 7.6.3 |
| 7.6.5 | Cache strategy review : Redis TTLs + hit ratios + cluster setup | 5h | P0 | 7.6.4 |
| 7.6.6 | CDN Cloudflare : static assets + edge caching + smart routing | 5h | P0 | 7.6.5 |
| 7.6.7 | Horizontal scaling : autoscaling rules + load balancers + health checks | 7h | P0 | 7.6.6 |
| 7.6.8 | Kafka throughput optimization + consumer lag monitoring | 5h | P0 | 7.6.7 |
| 7.6.9 | Cost optimization : right-sizing + reserved instances + storage tiers | 5h | P0 | 7.6.8 |
| 7.6.10 | Stress testing : breaking points + spike patterns + chaos engineering | 6h | P0 | 7.6.9 |
| 7.6.11 | SLI/SLO dashboards + alerts + runbook ops capacity planning | 5h | P0 | 7.6.10 |
| 7.6.12 | Documentation performance + acceptance criteria Sprint 35 ready | 6h | P0 | 7.6.11 |

**Total** : 70 heures.

---

# DETAIL DES 12 TACHES

**Note infrastructure production v2.2** : Le hosting production est **Atlas Cloud Services Benguerir** (cloud souverain MA -- decision-008). Les patterns AWS/Azure/GCP cites dans les taches sont **patterns generiques industry-standard** ; les equivalents Atlas Cloud Services natifs sont :
- **Auto Scaling** : Atlas Cloud Services Auto Scaling (catalog Compute) -- equivalent AWS ASG
- **Read replicas RDBMS** : Atlas Cloud Services Database RDBMS managed -- read replicas natifs
- **Load Balancer** : Atlas Cloud Services Network Load Balancer + Web Load Balancer
- **Object Storage** : Atlas Cloud Services Object Storage Benguerir -- compatibility S3 API
- **Key Management** : Atlas Cloud Services Key Management (KMS natif) -- equivalent AWS KMS
- **CDN + WAF** : Cloudflare en front Atlas Cloud Services origin (Sprint 34 Tache CDN)
- **DDoS Protection** : Atlas Cloud Services DDoS + Cloudflare WAF (defense en profondeur)
- **Monitoring** : Atlas Cloud Services Monitoring + Datadog/Grafana Cloud APM (multi-tier observability)

**Avantage Tier IV DC2** : SLO 99.99% disponibilite garanti pour critical workloads (vs 99.9% Tier III seul).

---

## Tache 7.6.1 -- SLOs Definition + APM Setup

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 5h / Depend de Sprint 33

**But** : Definir SLIs (Service Level Indicators) + SLOs (Objectives) + setup APM monitoring (Datadog OU Grafana Cloud).

**Livrables checkables** :
- [ ] Document `repo/docs/performance/slos-defined.md`
- [ ] SLIs critiques :
  - **Availability** : uptime % per app
  - **Latency** : p50 / p95 / p99 response times
  - **Error rate** : 5xx errors per total requests
  - **Throughput** : requests/sec (rps)
  - **Saturation** : DB connections / Kafka lag / Redis memory
- [ ] SLOs cibles per app :
  - **api (4000)** : 99.9% uptime + p95 < 500ms + < 0.1% errors
  - **web-broker / web-garage / web-customer** : 99.9% + p95 first contentful paint < 1.5s
  - **PWA mobile** : same + offline-tolerant
  - **mcp-server (4001)** : 99.5% + p95 < 1s (acceptable AI tools)
- [ ] APM integration :
  - Datadog APM ou Grafana Cloud : auto-instrumentation
  - Distributed tracing (request -> microservices)
  - OpenTelemetry standard
  - Alerts thresholds per SLO
- [ ] Test : APM operationnel + traces visible

**Fichiers crees / modifies** :
```
repo/docs/performance/slos-defined.md                                                                              # ~250 lignes
repo/infrastructure/observability/datadog-config.yaml                                                                # APM config
repo/packages/common/src/observability/{tracing,metrics}.ts                                                            # OTEL integration
```

**Notes implementation** :
- SLOs = engagement contractuel envers tenants
- Datadog vs Grafana Cloud : Grafana plus customizable, Datadog plus turn-key
- OpenTelemetry standard : portable entre fournisseurs
- Alerts : Slack channel #ops-alerts + email super_admin

**Criteres validation** :
- V1 (P0) : SLOs documente
- V2 (P0) : APM operationnel
- V3 (P0) : Distributed traces visible
- V4 (P0) : Alerts configures
- V5 (P0) : Tests 5+ scenarios

---

## Tache 7.6.2 -- Load Testing K6 Scenarios

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 8h / Depend de 7.6.1

**But** : Suite K6 load testing avec scenarios realistic per app.

**Livrables checkables** :
- [ ] Scenarios K6 :
  - **api smoke** : 10 RPS sustained 5 min (baseline)
  - **api load** : 100 RPS ramp-up 10 min + sustained 30 min
  - **api stress** : 500 RPS pour identify breaking point
  - **api soak** : 50 RPS pour 4 hours (memory leaks detection)
  - **api spike** : 0 -> 1000 RPS en 30s puis 0 (recovery test)
- [ ] Scenarios per workflow critique :
  - Login + JWT issuance flow (Sprint 5)
  - Quote computation rapid (Sprint 14)
  - Sinistre creation + dispatch (Sprint 24 cross-tenant)
  - Sky chat conversation + tool calls (Sprint 31)
- [ ] Distributed K6 : multi-runners pour 1000+ RPS
- [ ] Output : pass/fail per SLO threshold + reports HTML
- [ ] CI/CD integration : run K6 nightly + alerts si regression

**Pattern critique : K6 scenario realistic**

```javascript
// repo/load-tests/scenarios/api-load-realistic.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const customLatency = new Trend('latency_custom');
const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    api_load_realistic: {
      executor: 'ramping-arrival-rate',
      startRate: 10,
      timeUnit: '1s',
      preAllocatedVUs: 100,
      maxVUs: 500,
      stages: [
        { duration: '5m', target: 50 },     // ramp-up
        { duration: '10m', target: 100 },    // sustain
        { duration: '5m', target: 200 },      // peak
        { duration: '5m', target: 100 },      // cool-down
      ],
    },
  },
  thresholds: {
    'http_req_duration{status:200}': ['p(95)<500', 'p(99)<1500'],  // p95 < 500ms, p99 < 1500ms
    'http_req_failed': ['rate<0.001'],                              // < 0.1% errors
    'errors': ['rate<0.01'],
  },
};

export default function () {
  // Realistic user flow : login + several operations
  const loginRes = http.post('https://api-staging.skalean-insurtech.ma/api/v1/auth/login', JSON.stringify({
    email: `loadtest-${__VU}@skalean.ma`,
    password: 'LoadTest123!',
  }), { headers: { 'Content-Type': 'application/json' } });

  check(loginRes, { 'login 200': (r) => r.status === 200 });
  errorRate.add(loginRes.status !== 200);

  if (loginRes.status === 200) {
    const token = loginRes.json('access_token');
    const headers = { 'Authorization': `Bearer ${token}`, 'x-tenant-id': 'tenant-loadtest' };

    // Multiple operations realistic broker workflow
    const policiesRes = http.get('https://api-staging.skalean-insurtech.ma/api/v1/insure/policies?page=1', { headers });
    check(policiesRes, { 'policies 200': (r) => r.status === 200 });

    const customersRes = http.get('https://api-staging.skalean-insurtech.ma/api/v1/crm/contacts', { headers });
    check(customersRes, { 'customers 200': (r) => r.status === 200 });

    customLatency.add(policiesRes.timings.duration);
  }

  sleep(Math.random() * 3 + 1);  // realistic user think time 1-4s
}
```

**Fichiers crees / modifies** :
```
repo/load-tests/                                                                                                   # nouveau dossier
repo/load-tests/scenarios/{api-load,api-stress,api-soak,api-spike}.js                                                 # 4 scenarios api
repo/load-tests/scenarios/workflows/{login,quote,sinistre-dispatch,sky-chat}.js                                       # 4 workflows
repo/load-tests/lib/setup.js                                                                                          # users seeding
repo/.github/workflows/load-tests.yml                                                                                  # CI nightly
```

**Criteres validation** :
- V1 (P0) : 4 scenarios api
- V2 (P0) : 4 workflows critiques
- V3 (P0) : SLO thresholds enforced
- V4 (P0) : CI nightly
- V5 (P0) : Reports HTML

---

## Tache 7.6.3 -- Database Optimization

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 7h / Depend de 7.6.2

**But** : Optimization Postgres : indexes review + slow queries + N+1 patterns.

**Livrables checkables** :
- [ ] Slow queries identification :
  - Activate `pg_stat_statements` extension
  - Identify queries > 100ms p95
  - Run `EXPLAIN ANALYZE` chacun
- [ ] Indexes review :
  - Audit indexes existing : identifier non-utilises (drop)
  - Add indexes missing pour foreign keys + filters frequents
  - Composite indexes pour queries multi-columns
  - Partial indexes pour conditions specifiques (e.g. `WHERE status = 'active'`)
- [ ] N+1 patterns elimination :
  - TypeORM eager loading + `select` strategiques
  - Repository methods : `findManyWith({ relations: [...] })`
- [ ] Database statistics : `ANALYZE` regular
- [ ] Vacuum strategy : autovacuum tuning
- [ ] Tests : queries critiques < 100ms apres optimization

**Fichiers crees / modifies** :
```
repo/docs/performance/database-optimization-report.md                                                                   # ~300 lignes
repo/packages/database/src/migrations/{date}-AddPerformanceIndexes.ts                                                     # ~150 lignes (indexes)
repo/packages/database/src/migrations/{date}-DropUnusedIndexes.ts                                                          # ~50 lignes
repo/infrastructure/scripts/db-performance-audit.sql                                                                       # audit queries
```

**Criteres validation** :
- V1 (P0) : Slow queries identifies + fixed
- V2 (P0) : Indexes optimises
- V3 (P0) : N+1 patterns elimines
- V4 (P0) : Queries critiques < 100ms p95
- V5 (P0) : Tests 8+ scenarios

---

## Tache 7.6.4 -- Read Replicas Postgres + Connection Pooling

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 6h / Depend de 7.6.3

**But** : Setup read replicas Postgres + tuning connection pooling pour scaling reads.

**Livrables checkables** :
- [ ] Read replicas setup AWS RDS / Azure / GCP :
  - 1 master (writes)
  - 2 read replicas (reads)
  - Replication lag monitoring
- [ ] TypeORM data sources :
  - `MASTER` : writes + transactions
  - `REPLICA` : reads (analytics, dashboards, reports)
- [ ] Service `read-replica-router.ts` :
  - Detect query type (read vs write)
  - Route to master OR replica
  - Fallback master si replica lag > threshold (5s)
- [ ] Connection pooling pgBouncer :
  - Pool mode : transaction (vs session ; better for scaling)
  - Max client connections : 1000
  - Pool size : 20 per service instance
- [ ] Tests : reads/writes routing + replica lag handling

**Fichiers crees / modifies** :
```
repo/packages/database/src/data-sources/master-data-source.ts                                                              # ~80 lignes
repo/packages/database/src/data-sources/replica-data-source.ts                                                              # ~80 lignes
repo/packages/database/src/services/read-replica-router.service.ts                                                            # ~200 lignes
repo/infrastructure/pgbouncer/pgbouncer.ini                                                                                  # config
repo/docs/performance/read-replicas-architecture.md                                                                            # ~250 lignes
```

**Criteres validation** :
- V1 (P0) : Read replicas operationnels
- V2 (P0) : Routing queries correct
- V3 (P0) : Replica lag monitored
- V4 (P0) : pgBouncer pooling
- V5 (P0) : Tests 6+ scenarios

---

## Tache 7.6.5 -- Cache Strategy Redis Cluster

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 5h / Depend de 7.6.4

**But** : Review cache strategy Redis : TTLs + hit ratios + cluster setup pour HA.

**Livrables checkables** :
- [ ] Redis Cluster setup : 3 nodes (HA + sharding)
- [ ] Audit TTLs current Redis usage :
  - JWT blacklist : 24h
  - Capabilities cache (Sprint 25) : 5min
  - IA estimations cache (Sprint 20+29) : 24h
  - Quote computations (Sprint 14) : 30min
  - Sky conversations active : 1h
- [ ] Hit ratios target : > 70% per cache type
- [ ] Eviction policy : `allkeys-lru` (vs noeviction default)
- [ ] Persistence : AOF every second + RDB hourly
- [ ] Monitoring : Redis INFO + alerts memory > 80%
- [ ] Tests : cluster failover + cache hit improvement

**Fichiers crees / modifies** :
```
repo/infrastructure/redis/cluster-config.yaml                                                                                # cluster setup
repo/docs/performance/cache-strategy-review.md                                                                                # ~200 lignes
repo/packages/cache/src/services/cache-monitoring.service.ts                                                                    # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Redis cluster 3 nodes
- V2 (P0) : Hit ratios > 70%
- V3 (P0) : Failover tested
- V4 (P0) : Tests 6+ scenarios

---

## Tache 7.6.6 -- CDN Cloudflare

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 5h / Depend de 7.6.5

**But** : CDN Cloudflare pour static assets (8 apps) + edge caching + smart routing geographique.

**Livrables checkables** :
- [ ] Cloudflare setup :
  - 8 domains apps + api + mcp-server
  - SSL/TLS : full strict
  - HTTP/3 enabled
  - Brotli compression
- [ ] Static assets routing : `/static/*`, `/_next/static/*` -> CDN cache 1 year
- [ ] HTML pages : SSR cache 5 min (selon app)
- [ ] API endpoints : NO cache (dynamic)
- [ ] Smart routing : Cloudflare Argo Smart Routing (latence reduit Maroc <-> Europe origins)
- [ ] WAF rules : OWASP Core Rule Set + custom rules abuse patterns
- [ ] DDoS protection : Cloudflare default
- [ ] Origin health checks : multi-origin failover
- [ ] Tests : cache hit ratio + latency reduction (mesure avant/apres)

**Fichiers crees / modifies** :
```
repo/infrastructure/cloudflare/{8 zones}.yaml                                                                                # 8 apps zones
repo/infrastructure/cloudflare/waf-rules.yaml                                                                                  # WAF rules
repo/docs/performance/cdn-strategy.md                                                                                            # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : 8 domains CDN configures
- V2 (P0) : Static cache 1 year
- V3 (P0) : WAF rules active
- V4 (P0) : Latency reduction mesurable
- V5 (P0) : Tests 5+ scenarios

---

## Tache 7.6.7 -- Horizontal Scaling

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 7h / Depend de 7.6.6

**But** : Horizontal scaling : autoscaling rules + load balancers + health checks per service.

**Livrables checkables** :
- [ ] AWS Auto Scaling Groups (or equivalent) per service :
  - **api** : min 3, max 20, target CPU 60%
  - **web-broker / web-garage / web-customer / etc.** : min 2, max 10, target CPU 70%
  - **mcp-server** : min 2, max 8, target CPU 60%
- [ ] Load balancer (ALB / equivalent) :
  - Health checks `/health` endpoint
  - Sticky sessions : NO (stateless)
  - Drain time : 30s (graceful shutdown)
- [ ] Kubernetes alternative : HPA (Horizontal Pod Autoscaler) sur CPU + custom metrics
- [ ] Scale-up triggers : CPU > 70% sustained 3min OR latency p95 > 500ms
- [ ] Scale-down triggers : CPU < 30% sustained 10min (avoid flapping)
- [ ] Tests scaling : load test triggers scale-up + verify
- [ ] Cost monitoring : alerts si scale-up unusual (anomaly)

**Fichiers crees / modifies** :
```
repo/infrastructure/aws/autoscaling-groups.yaml                                                                                  # 10+ ASGs
repo/infrastructure/k8s/hpa-{service}.yaml                                                                                          # HPA configs (alternative)
repo/docs/performance/horizontal-scaling-strategy.md                                                                                  # ~250 lignes
```

**Criteres validation** :
- V1 (P0) : Autoscaling rules configures
- V2 (P0) : Load balancers + health checks
- V3 (P0) : Scale-up tested
- V4 (P0) : Scale-down tested
- V5 (P0) : Tests 6+ scenarios

---

## Tache 7.6.8 -- Kafka Throughput Optimization

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 5h / Depend de 7.6.7

**But** : Optimization Kafka throughput + consumer lag monitoring.

**Livrables checkables** :
- [ ] Topics partitioning review :
  - Augmenter partitions topics high-throughput (e.g. `audit_events` 12 partitions)
  - Reduce partitions topics low-throughput
- [ ] Producers config :
  - `acks=1` (vs `all`) pour topics non-critiques (gain throughput)
  - Compression : LZ4 (faster) ou ZSTD (better ratio)
  - Batch size : 64KB
  - Linger time : 5ms
- [ ] Consumers config :
  - Parallelism : multiple consumer instances per group
  - Manual commits batch (improve throughput)
  - Max poll records : 500
- [ ] Consumer lag monitoring : alerts si lag > 10000 messages
- [ ] Dead Letter Queues : every consumer + replay capability
- [ ] Tests : throughput benchmarks before/after

**Fichiers crees / modifies** :
```
repo/infrastructure/kafka/topics-partitioning.yaml                                                                                    # partitions configuration
repo/packages/kafka/src/config/{producer,consumer}-config.ts                                                                            # tuning
repo/docs/performance/kafka-optimization.md                                                                                              # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Partitions optimises
- V2 (P0) : Throughput +50% mesure
- V3 (P0) : Consumer lag monitored
- V4 (P0) : DLQ + replay
- V5 (P0) : Tests 5+ scenarios

---

## Tache 7.6.9 -- Cost Optimization

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 5h / Depend de 7.6.8

**But** : Right-sizing instances + reserved capacity + storage tiers + cost monitoring.

**Livrables checkables** :
- [ ] Right-sizing :
  - Audit instances usage : CPU + memory utilization 30 jours
  - Downsize over-provisioned (CPU < 30% sustained)
  - Upsize bottlenecked (CPU > 80% sustained)
- [ ] Reserved instances strategy :
  - 1-year reserved capacity baseline (3 api + 2 each apps + 2 mcp + 2 db) -- savings ~30%
  - Spot instances : workers offload (Sky AI calls bg, ETL jobs) -- savings ~70%
- [ ] Storage tiers :
  - S3 buckets : Intelligent Tiering automatic
  - Backups : Glacier Deep Archive apres 90 jours
  - Logs archive : S3 Glacier apres 30 jours
- [ ] Cost monitoring :
  - AWS Cost Explorer + tags per service
  - Alerts threshold : monthly spend > expected +20%
  - Per-tenant cost attribution (Sprint 27 billing tenants)
- [ ] FinOps culture : monthly review costs + optimization opportunities
- [ ] Documentation cost playbook

**Fichiers crees / modifies** :
```
repo/docs/performance/cost-optimization-strategy.md                                                                                      # ~300 lignes
repo/infrastructure/aws/reserved-instances-plan.yaml                                                                                       # plan
repo/infrastructure/scripts/cost-anomaly-detector.ts                                                                                         # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Right-sizing complete
- V2 (P0) : Reserved instances plan
- V3 (P0) : Cost monitoring + alerts
- V4 (P0) : Per-tenant attribution
- V5 (P0) : Documentation playbook

---

## Tache 7.6.10 -- Stress Testing + Chaos Engineering

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 6h / Depend de 7.6.9

**But** : Stress testing breaking points + chaos engineering tests resilience.

**Livrables checkables** :
- [ ] Stress tests :
  - Push api to 1000+ RPS pour identifier breaking point
  - Spike patterns : 0 -> 1000 RPS en 30s, observe recovery
  - Soak test : 100 RPS pour 24h (memory leaks)
- [ ] Chaos engineering :
  - Kill random pods (Chaos Mesh / Gremlin)
  - Network partition simulations (split-brain)
  - Database failover : trigger replica promotion + verify recovery
  - Redis failover : node down + cluster recovery
  - Kafka broker down + consumers lag recovery
  - Skalean AI Sky API timeout simulation -> circuit breaker fallback
- [ ] Recovery times mesures (RTO actual vs target)
- [ ] Documentation findings + improvements

**Fichiers crees / modifies** :
```
repo/load-tests/stress/{stress,spike,soak}.js                                                                                              # 3 stress scenarios
repo/load-tests/chaos/{several scenarios}.yaml                                                                                              # Chaos Mesh experiments
repo/docs/performance/chaos-engineering-results.md                                                                                            # ~300 lignes
```

**Criteres validation** :
- V1 (P0) : Breaking point identifie
- V2 (P0) : Spike recovery
- V3 (P0) : Chaos experiments executes
- V4 (P0) : Failover validated
- V5 (P0) : RTO < 60s

---

## Tache 7.6.11 -- SLI/SLO Dashboards + Alerts + Runbook

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 5h / Depend de 7.6.10

**But** : Dashboards SLI/SLO + alerts proactives + runbook ops capacity planning.

**Livrables checkables** :
- [ ] Dashboards Datadog/Grafana :
  - Per-app : availability + latency p50/p95/p99 + error rate + throughput
  - Per-service : DB queries + cache hit ratio + Kafka lag
  - Cost dashboard : per-tenant + per-service
  - SLOs progress : % budget consumed (error budget)
- [ ] Alerts :
  - Critical : SLO breach > 1h -> wake on-call
  - Warning : SLO degradation -> Slack
  - Info : capacity > 70% -> planning
- [ ] Runbook ops capacity planning :
  - Forecast capacity : 6 mois ahead based on growth
  - Add capacity triggers : at 80% usage automatically
  - Disaster recovery procedures
  - On-call rotation (Phase 8 : etablir)
- [ ] Tests dashboards + alerts

**Fichiers crees / modifies** :
```
repo/infrastructure/observability/dashboards/{several}.json                                                                                  # 5+ dashboards
repo/infrastructure/observability/alerts/{several}.yaml                                                                                       # alerts rules
repo/docs/performance/runbook-ops-capacity-planning.md                                                                                          # ~300 lignes
```

**Criteres validation** :
- V1 (P0) : 5+ dashboards
- V2 (P0) : Alerts critical/warning
- V3 (P0) : Runbook ops
- V4 (P0) : Tests 5+ scenarios

---

## Tache 7.6.12 -- Documentation + Acceptance Criteria Sprint 35

**Metadonnees** : Phase 7 / Sprint 34 / P0 / 6h / Depend de 7.6.11

**But** : Documentation performance + acceptance criteria pour Sprint 35 pilote ready.

**Livrables checkables** :
- [ ] Documents :
  - `repo/docs/performance/performance-guide.md` (best practices)
  - `repo/docs/performance/scaling-architecture.md` (architecture finale)
  - `repo/docs/performance/sprint-35-pilot-acceptance-criteria.md`
- [ ] Acceptance criteria Sprint 35 (must-have avant pilote) :
  - SLOs Sprint 34 met sustained 7 days staging
  - Load testing 200 concurrent users (pilot scale) green
  - Chaos experiments recovery RTO < 60s
  - Cost projection pilote < budget
  - On-call rotation etablie (au moins 2 personnes)
  - DR plan tested
  - Backups verifies daily

**Fichiers crees / modifies** :
```
repo/docs/performance/performance-guide.md                                                                                                       # ~400 lignes
repo/docs/performance/scaling-architecture.md                                                                                                       # ~300 lignes
repo/docs/performance/sprint-35-pilot-acceptance-criteria.md                                                                                          # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : 3 documents complets
- V2 (P0) : Acceptance criteria Sprint 35

---

## Sortie du Sprint 34

A la fin de l'execution des 12 taches :

```
Performance Scaling validated :
  - SLOs definis + APM monitoring (Datadog/Grafana)
  - Load testing K6 : 4 scenarios api + 4 workflows critiques + CI nightly
  - Database optimization : indexes + slow queries + N+1 elimines
  - Read replicas Postgres + pgBouncer connection pooling
  - Redis Cluster 3 nodes + hit ratios > 70%
  - CDN Cloudflare 8 domains + WAF + smart routing
  - Horizontal scaling : autoscaling rules + load balancers + health checks
  - Kafka throughput +50% optimisation
  - Cost optimization : right-sizing + reserved instances + S3 tiers
  - Stress testing + chaos engineering : breaking points + RTO < 60s
  - Dashboards SLI/SLO + alerts critical/warning
  - Runbook ops capacity planning
  - Documentation performance complete

Sprint 35 pilote prerequisites met
```

**Sprint 35 (Pilote Marrakech Go-Live) demarre avec** :
- Securite green Sprint 33
- Performance validated Sprint 34
- Sprint 35 : pilote production Marrakech 50-200 users + Wafa connecteur + Skalean Atlas + 2-3 brokers/garages partenaires

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-7.6.X-*.md` dans `00-pilotage/prompts-taches/sprint-34-performance-scaling/`.

**Patterns code inline conserves** : K6 scenario realistic avec ramping-arrival-rate + thresholds SLO + workflow user complete.

**Reference** : Sprint 33 securite + Phases 1-7 deliverables.

---

**Fin du meta-prompt B-34 v2.2 format Option B.**
