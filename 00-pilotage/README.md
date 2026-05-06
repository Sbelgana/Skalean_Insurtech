# Skalean InsurTech

> Plateforme InsurTech marocaine -- 2 SaaS B2B + 1 admin + 3 apps clientes + 1 MCP server expose tools metier a Skalean AI

**Version** : 2.2.0
**Date** : Mai 2026
**Statut** : 35/35 sprints meta-prompts livres -- documentation v2.2 alignee
**AUCUNE EMOJI AUTORISEE**

---

## VISION

Skalean InsurTech = **premiere plateforme InsurTech complete au Maroc** combinant :

1. **Skalean Broker** -- ERP courtage assurance (web-broker)
2. **Skalean Garage** -- ERP gestion sinistres + reparations auto (web-garage + web-garage-mobile PWA)
3. **Skalean InsurTech Admin** -- Application admin Skalean (web-insurtech-admin)
4. **Customer Portal** -- Vente assurance en ligne SEO (web-customer-portal)
5. **Mon Espace Assure** -- Self-service assure (web-assure-portal desktop + web-assure-mobile PWA)
6. **API NestJS** -- Backend unifiant tout (port 4000)
7. **MCP Server** -- Expose tools metier a Skalean AI agents (port 4001 -- v2.2)

Le projet est **entierement autonome** (depot Git separe, monorepo, DB, auth) et consomme **Skalean AI uniquement comme service externe** via REST + MCP (Model Context Protocol).

---

## LES 3 FLUX UTILISATEUR PRINCIPAUX

### Flux 1 -- Vente en ligne (web-customer-portal)

Le prospect visite le site public optimise SEO. Il decouvre les produits, simule un tarif instantanement, compare 3-5 options, choisit, fournit ses informations + KYC, paie, signe electroniquement, recoit un **document provisoire (TTL 7 jours)**. Le courtier valide ensuite le dossier dans sa file (SLA 24h) et la police devient definitive.

Conversion cible : 15%+ prospect -> assure.

### Flux 2 -- Vente en agence (web-broker)

Le souscripteur ou courtier saisit un devis dans le SaaS Broker, fait une cotation instantanee (tarif lookup Sprint 14, real-time API assureur Sprint 32), genere un devis PDF, l'envoie au client. Si accord :
souscription, signature electronique Barid eSign, paiement comptoir CMI/cash, creation compte client, generation police signed PDF, **tout en moins de 30 minutes**.

### Flux 3 -- Sinistre client M8 (web-assure-mobile)

L'assure declare son sinistre depuis son **telephone via la PWA installee**. Photos, geolocalisation, voix darija transcrite. La declaration est routee directement vers le garage choisi (parmi le reseau Skalean Atlas + partenaires Sprint 25). **Le garage prend en charge de A a Z**. Le courtier voit en lecture seule, sans intervention. **Premier flux marche MA sans courtier actif dans la chaine**.

Cible delai : sinistre traite end-to-end < 24h (vs 5 jours initial).

---

## ARCHITECTURE -- 9 APPS v2.2

### Vue technique

| App | Port | Domaine | Public | Auth |
|-----|------|---------|--------|------|
| api | 4000 | api.skalean-insurtech.ma | Backend toutes apps | varies |
| web-insurtech-admin | 3000 | admin.skalean-insurtech.ma | Equipe Skalean | obligatoire + MFA |
| web-broker | 3001 | broker.skalean-insurtech.ma | Courtiers, Souscripteurs | obligatoire |
| web-garage | 3002 | garage.skalean-insurtech.ma | ChefAtelier, Receptionniste | obligatoire |
| web-garage-mobile | 3003 | garage-app.skalean-insurtech.ma | Techniciens (PWA + WebAuthn) | obligatoire |
| web-customer-portal | 3004 | assurance.skalean-insurtech.ma | Prospects publics | facultative |
| web-assure-portal | 3005 | mon-espace.skalean-insurtech.ma | Assures connectes desktop | obligatoire |
| web-assure-mobile | 3006 | mon-espace.skalean-insurtech.ma | Assures mobile (PWA) | obligatoire |
| **mcp-server** | **4001** | **mcp.skalean-insurtech.ma** | **Skalean AI agents** | **MCP tokens** |

### Stack technique principale

- **Monorepo** : pnpm 9.15 + Turborepo 2.4
- **Runtime** : Node.js 22.20 LTS, TypeScript 5.7 strict
- **Backend** : NestJS 10.4 + Fastify
- **Frontend** : Next.js 15 + React 19 + Tailwind 4 + shadcn/ui
- **DB** : PostgreSQL 16 + TypeORM 0.3 + PgBouncer + RLS multi-tenant 3 niveaux
- **Cache** : Redis 7.4 (cluster en prod)
- **Events** : Apache Kafka 3.7 KRaft (sans ZooKeeper)
- **PWA** : Serwist (modern Workbox alternative pour Next.js 15)
- **Maps** : Mapbox GL JS 3.x
- **AI** : `@modelcontextprotocol/sdk` + Vercel AI SDK (`@ai-sdk/react`)
- **Document** : `react-pdf` + `pdfkit` + Barid eSign + ANRT TSA RFC 3161
- **Tests** : Vitest 2.1 + Playwright 1.49 + axe-core
- **Observability** : Pino + OpenTelemetry + Datadog/Grafana Cloud APM
- **CI/CD** : GitHub Actions + Husky + Biome 1.9

Pour la liste exhaustive : voir `documentation/1-stack-technique.yaml`.

---

## LES 12 ROLES UTILISATEURS

| Role | Type | Niveau acces |
|------|------|--------------|
| super_admin_platform | Skalean staff | Bypass RLS + admin/* (avec MFA + impersonation Sprint 26) |
| analyst_support | Skalean staff | admin/* read-only |
| broker_admin | Tenant cabinet | Tenant CRUD complete |
| broker_user | Tenant cabinet | Polices CRUD limit |
| broker_assistant | Tenant cabinet | Read + create limited |
| garage_admin | Tenant garage | Garage CRUD complete |
| garage_chef | Tenant garage | Sinistres assign + close |
| garage_technicien | Tenant garage | Reparations execute (PWA mobile) |
| garage_comptable | Tenant garage | Books + Pay |
| garage_commercial | Tenant garage | Devis + clients |
| assure | L3 user | Read own polices/sinistres |
| prospect | Public | Browse public products + simulator |

Voir `documentation/5-roles-permissions.md` pour matrice 12 roles x 85+ permissions.

---

## LES 3 TYPES TENANTS REPAIR (Sprint 25)

| Type | Nom | Description |
|------|-----|-------------|
| **Type 1 Atlas** | Skalean Atlas | Garage interne Skalean (premier seed Sprint 19, full ERP) |
| **Type 2 Managed Partner** | Garages partenaires geres | Utilisent Skalean Garage ERP avec data isolation stricte |
| **Type 3 API Partner** | Garages externes | Passerelle API integration leur ERP existant (limited capabilities) |

---

## CONFORMITE LEGALE MA

### Loi 09-08 (Protection des donnees personnelles -- CNDP)

Data residency Maroc (decision-008). Encryption-at-rest AES-256-GCM. Notification breach sous 72h CNDP. Droit a l'oubli + portabilite + rectification implementes Sprint 6.

### Loi 43-20 (Signature electronique)

Tiers de confiance certifie marocain (Barid eSign Poste Maroc). Hash SHA-512. Horodatage qualifie ANRT TSA RFC 3161. Archivage legal 10 ans.

### Loi 17-99 (Assurance MA)

Droit retractation 30 jours pour assure post-souscription (Sprint 15). Resiliation anticipee avec remboursement pro-rata (Sprint 15).

### CGNC Plan Comptable Marocain (loi 9-88)

Plan comptable classes 1-9 charge en DB Sprint 12. Generation auto ecritures depuis events Pay. Export SAFT-MA pour controles DGI.

### ACAPS (Programme Emergence)

Cas d'usage 02 (comparaison), 03 (souscription), 04 (CRM), 07 (sinistres). Audit trail systematique sur ecritures critiques. Reports trimestriel + annuel solvabilite (Sprint 12 + 28). Decision-010 : ACAPS Programme Emergence ne demande pas integration assureurs reels (defere a Sprint 32).

### Loi 43-05 (Anti-blanchiment AMC)

AML monitoring + SAR generation Sprint 12. Detection patterns suspects + declaration soupcon Autorite Marocaine du Capital.

---

## ROADMAP v2.2 -- 7 PHASES / 35 SPRINTS / 12 MOIS

| Phase | Sprints | Theme principal | Mois |
|-------|---------|----------------|------|
| **Phase 1 Bootstrap** | 1-4 | Infrastructure + 9 apps + DB + Kafka | 1-2 |
| **Phase 2 Securite** | 5-7 | Auth + Multi-tenant 3 niveaux + RBAC | 2-3 |
| **Phase 3 Modules Horizontaux** | 8-13 | CRM + Booking + Comm + Docs + Pay + Books + Stock + HR + Analytics | 3-6 |
| **Phase 4 Vertical Insure** | 14-18 | Skalean Broker ERP + 3 web apps clientes | 6-8 |
| **Phase 5 Vertical Repair** | 19-25 | Skalean Garage ERP + Atlas + IA + Flux M8 + Cross-Tenant | 8-10 |
| **Phase 6 Admin Platform** | 26-28 | Skalean Admin + Tenants Management + Compliance reports | 10-11 |
| **Phase 7 Hardening + Pilote** | 29-35 | AI defere (REST/MCP/Sky) + Connecteurs assureurs + Pentest + Perf + Pilote Marrakech | 11-12 |

**Apport business par jalon** :
- **J1 (mois 2)** : Infrastructure operationnelle (9 apps demarrent)
- **J2 (mois 6)** : Modules horizontaux complets
- **J3 (mois 8)** : Skalean Broker ERP production-ready
- **J4 (mois 8)** : Vente en ligne possible (web-customer-portal)
- **J5 (mois 10)** : Skalean Garage ERP + Flux M8 sinistre client
- **J6 (mois 11)** : Admin Platform complete
- **J7 (mois 12)** : Pilote Marrakech success + Go-Live commercial

---

## DEMARRAGE LOCAL (Sprint 1)

### Prerequis

- Node.js 22.11.0 LTS (use `nvm` ou `volta`)
- pnpm 9.15.0
- Docker 24+ + Docker Compose
- Git 2.40+

### Setup initial

```bash
git clone https://github.com/skalean/insurtech.git
cd insurtech
nvm use                       # Node 22.11.0
pnpm install                  # Install deps monorepo
cp .env.example .env          # Configurer variables
pnpm docker:up                # Lancer Postgres + Redis + Kafka + MinIO
pnpm bootstrap                # Migrations DB + seeds dev
pnpm dev                      # Lance toutes les 9 apps en parallel
```

### Apps accessibles

- API : http://localhost:4000 (Swagger : http://localhost:4000/docs)
- Admin : http://localhost:3000
- Broker : http://localhost:3001
- Garage : http://localhost:3002
- Garage Mobile (PWA) : http://localhost:3003
- Customer Portal : http://localhost:3004
- Assure Portal : http://localhost:3005
- Assure Mobile (PWA) : http://localhost:3006
- MCP Server : http://localhost:4001 (discovery: GET /mcp/v1/discover)

---

## STRUCTURE DEPOT

```
skalean-insurtech/
├── apps/                          # 9 applications
│   ├── api/                       # NestJS backend (port 4000)
│   ├── web-insurtech-admin/       # Admin Skalean (port 3000)
│   ├── web-broker/                # Skalean Broker SaaS (port 3001)
│   ├── web-garage/                # Skalean Garage SaaS (port 3002)
│   ├── web-garage-mobile/         # PWA Technicien (port 3003)
│   ├── web-customer-portal/       # Vente en ligne SEO (port 3004)
│   ├── web-assure-portal/         # Espace assure desktop (port 3005)
│   ├── web-assure-mobile/         # PWA assure mobile (port 3006)
│   └── mcp-server/                # MCP Server pour Skalean AI (port 4001)
├── packages/                      # ~21 packages partages
│   ├── auth/                      # JWT + RBAC + MFA + WebAuthn
│   ├── database/                  # TypeORM + migrations + RLS
│   ├── crm/                       # Contacts + Companies + Deals + Pipelines
│   ├── booking/                   # Rooms + Appointments + Calendar sync
│   ├── comm/                      # WhatsApp + Email + multilingue 4 langues
│   ├── docs/                      # PDF + S3 + Barid eSign + ANRT TSA
│   ├── pay/                       # 6 passerelles MA (CMI / YouCan / PayZone / Mobile)
│   ├── books/                     # Plan CGNC + factures DGI + SAFT-MA
│   ├── compliance/                # ACAPS + AMC + CNDP
│   ├── analytics/                 # ClickHouse OLAP + dashboards
│   ├── insure/                    # Vertical Broker (lifecycle police)
│   ├── repair/                    # Vertical Garage (sinistres + reparations)
│   ├── stock/                     # Stock pieces + FIFO + alertes
│   ├── hr/                        # Employees + paie CNSS/AMO/IR
│   ├── sky/                       # Agent Sky multilingue (Sprint 31)
│   ├── sky-ui/                    # Chat widget shared 3 apps (Sprint 31)
│   ├── assure-shared/             # Components shared assure portal/mobile (Sprint 18)
│   ├── shared-types/
│   ├── shared-config/
│   ├── shared-utils/
│   ├── shared-ui/                 # shadcn/ui + theme Sofidemy
│   ├── shared-pwa/                # Service worker + offline strategy
│   └── shared-maps/               # Mapbox GL JS wrapper
├── infrastructure/
│   ├── docker/                    # docker-compose dev/test
│   ├── scripts/                   # bootstrap, seeds, etc.
│   └── terraform/                 # Sprint 35 deployment
├── docs/
│   ├── architecture/              # ADR-001 a ADR-010
│   ├── api/                       # Swagger generated
│   └── runbooks/                  # Sprint 33+ ops runbooks
└── package.json                   # Root workspace
```

---

## DECISIONS STRATEGIQUES

10 decisions formalisees dans `decisions/` :

| # | Titre | Sprint impact |
|---|-------|---------------|
| 001 | Monorepo pnpm + Turborepo | Sprint 1 |
| 002 | Multi-tenant 3 niveaux + RLS | Sprint 1, 6, 25 |
| 003 | TypeORM 0.3 vs Prisma | Sprint 1, 2 |
| 004 | Kafka KRaft vs RabbitMQ | Sprint 1, 2 |
| 005 | Skalean AI Frontier model | Sprint 29-31 |
| 006 | No-emoji policy absolute | Tous sprints |
| 007 | AI defere (Mock Sprint 20 -> Real Sprint 29) | Sprint 20, 29 |
| 008 | Data residency Maroc strict | Sprint 6, 10, 12 |
| 009 | Signature Barid eSign + ANRT | Sprint 10 |
| **010** | **Insure Connecteurs defere Phase 7** | **Sprint 32 (B-15 origine)** |

---

## SUPPORT

- Issues GitHub : https://github.com/skalean/insurtech/issues
- Wiki interne : https://wiki.skalean.com/insurtech
- Slack : #insurtech-dev
- Email tech : tech@skalean.com

---

## EQUIPE

- **Saad** (CTO, co-fondateur Skalean) -- ETS Montreal
- **Abla** (CEO, co-fondatrice Skalean)

---

## LICENCE

Proprietaire -- Skalean SARL, 2026

---

**Pour la documentation complete, voir `INDEX.md` (navigation v2.2) puis `documentation/8-skalean-insurtech-prompt-master.md` (document maitre v2.2).**
