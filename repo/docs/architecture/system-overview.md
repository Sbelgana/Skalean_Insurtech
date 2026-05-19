# System Overview -- Skalean InsurTech v2.2

## Diagramme architecture haut niveau

```
                      Internet (Cloudflare CDN + WAF)
                                   |
              +--------------------+--------------------+
              |                                          |
              v                                          v
      mon-espace.skalean-insurtech.ma         api.skalean-insurtech.ma
      (apps/web-assure-portal + mobile)       (apps/api NestJS port 4000)
              |                                          |
              +-> broker.skalean-insurtech.ma            |
              |   (apps/web-broker port 3001)            |
              |                                          |
              +-> garage.skalean-insurtech.ma            |
              |   (apps/web-garage port 3002)            |
              |   (apps/web-garage-mobile port 3003)     |
              |                                          |
              +-> assurance.skalean-insurtech.ma         |
              |   (apps/web-customer-portal port 3004)   |
              |                                          |
              +-> admin.skalean-insurtech.ma             |
                  (apps/web-insurtech-admin port 3000)   |
                                                          |
                                                          v
                          +---------------------------+
                          | Kubernetes Atlas Cloud    |
                          | Services Benguerir        |
                          | DC1 Tier III + DC2 IV     |
                          +---------------------------+
                                   |
        +--------------------------+--------------------------+
        |                          |                           |
        v                          v                           v
Postgres 16.6 managed     Redis 7.4 managed        Kafka 3.7 managed
(1 primary + 2 replicas)  (HA 2 nodes)             (3 brokers KRaft)
Extensions :              6 DBs :                  30+ topics :
- pgcrypto                - DB 0 cache             - insurtech.events.auth.*
- pg_trgm                 - DB 1 sessions          - insurtech.events.crm.*
- btree_gist              - DB 2 BullMQ queues     - insurtech.events.repair.*
- unaccent                - DB 3 Redlock           - insurtech.events.pay.*
- citext                  - DB 4 AI cache          - DLQ comm + pay
RLS multi-tenant 3 niveaux - DB 5 rate limit

        Object Storage Atlas (S3-compatible, region ma-bgr-1)
        - skalean-insurtech-prod-docs (10 ans ACAPS)
        - skalean-insurtech-prod-photos (6 ans anonyme)
        - skalean-insurtech-prod-archive (IMMUTABLE 10 ans loi 43-20)

        +---- mcp.skalean-insurtech.ma
        |     (apps/mcp-server port 4001)
        |     15+ tools metier exposes Skalean AI

        +---- Services externes :
              - Skalean AI (REST + MCP) -- chatbot Sky + Vision
              - Barid eSign + ANRT TSA -- signature loi 43-20
              - 6 passerelles paiement MA (CMI, YouCan, PayZone, Inwi, Orange, M-Wallet)
              - WhatsApp Cloud API (Meta) -- comm
              - Mapbox -- cartes garages agrees
              - Datadog -- APM + logs + metrics
              - Sentry -- error tracking
```

## Composants

### 9 apps deployables

- apps/api (NestJS 10.4 + Fastify, port 4000)
- apps/web-insurtech-admin (Next.js 15, port 3000)
- apps/web-broker (Next.js 15, port 3001)
- apps/web-garage (Next.js 15, port 3002)
- apps/web-garage-mobile (Next.js 15 PWA, port 3003)
- apps/web-customer-portal (Next.js 15 SEO/ISR, port 3004)
- apps/web-assure-portal (Next.js 15, port 3005)
- apps/web-assure-mobile (Next.js 15 PWA, port 3006)
- apps/mcp-server (standalone Node.js, port 4001)

### 23 packages

- Foundation : shared-types, shared-config, shared-utils, shared-events
- Data : database
- Cross-cutting : auth, comm, docs, signature, pay, books, compliance
- Business : crm, booking, analytics, stock, hr
- Verticals : insure, repair
- AI : sky, sky-ui
- UI : shared-ui, shared-pwa, shared-maps, assure-shared

## Compliance

- Loi 09-08 CNDP : data residency MA strict (Atlas Benguerir)
- Loi 17-99 ACAPS : conservation polices 10 ans + 1 jour
- Loi 43-20 : signature electronique Barid eSign + ANRT TSA
- DGI fiscal : factures 10 ans
- Loi 43-05 anti-blanchiment : KYC obligatoire 5 ans

## Reference

- Sprint 1 (B-01) : Bootstrap Infrastructure (cette documentation)
- Sprint 35 (B-35) : Production launch Marrakech pilote
- Decisions : `00-pilotage/decisions/`
- ADRs : `docs/architecture/ADR-*.md`
