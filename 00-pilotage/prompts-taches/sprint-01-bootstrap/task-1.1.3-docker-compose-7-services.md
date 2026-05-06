# TACHE 1.1.3 -- Docker Compose Dev 7 Services Orchestres + Init Containers Postgres / Kafka / MinIO

**Sprint** : 1 (Phase 1 / Sprint 1 dans phase) -- Bootstrap Infrastructure
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md` (Tache 1.1.3)
**Phase** : 1 -- Bootstrap Infrastructure
**Priorite** : P0 (bloquant pour Taches 1.1.4 a 1.1.15 et tous les Sprints 2 a 35)
**Effort** : 6h
**Dependances** : Tache 1.1.2 (TypeScript + Biome configures)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer une stack de developpement coherente, reproductible et orchestree par Docker Compose, demarree par une seule commande `pnpm docker:up`. La stack contient 7 services principaux (PostgreSQL 16.6, Redis 7.4.1, Kafka 3.7.1 KRaft, Kafka UI v0.7.2, MinIO RELEASE.2024-11-07, n8n 1.74.0, Mailhog v1.0.1) plus 2 init containers (`kafka-init-topics` et `minio-init-buckets`) qui s'executent une fois apres le boot des services principaux pour creer les topics Kafka et les buckets MinIO. Tous les services partagent un network bridge `skalean-net`, des healthchecks definis, et des volumes persistents nommes pour survivre aux `docker compose restart`.

L'apport est triple. Premierement, un environnement dev reproductible elimine les "works on my machine" : tous les developpeurs ont exactement les memes versions de Postgres, Redis, Kafka avec les memes configurations (max_connections=200, AOF Redis active, KRaft sans Zookeeper, etc.). Deuxiemement, les healthchecks `depends_on: { condition: service_healthy }` garantissent l'ordre de demarrage correct : les init containers Kafka/MinIO ne lancent leur creation de topics/buckets qu'apres validation reseau effective, ce qui evite la classe complete des bugs "service not ready" / race conditions au boot. Troisiemement, le mode KRaft de Kafka 3.7 (sans Zookeeper) reduit le nombre de processus a gerer de 2 a 1, simplifie la config (1 broker self-suffisant au lieu de quorum Zookeeper), et permet a la stack dev de demarrer en moins de 60 secondes sur machine 8 GB RAM (vs 90+ secondes avec Zookeeper).

A l'issue de cette tache, `pnpm docker:up` demarre 7 services en moins de 60 secondes, `docker ps` montre 7+ conteneurs en etat `healthy`, `pnpm docker:reset` clean tout (volumes inclus) puis redemarre, et `pnpm docker:logs` affiche les 100 dernieres lignes de chaque service en mode follow. La stack `docker-compose.test.yaml` separee (subset Postgres + Redis + Kafka, sans volumes persistents, demarrage 20s) est utilisee par CI GitHub Actions Tache 1.1.10.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Sans une stack dev orchestree, chaque developpeur installerait Postgres, Redis, Kafka individuellement sur sa machine, avec des versions et configs divergentes. Les bugs "ca marche chez moi" deviennent endemiques. La duplication d'effort installation/maintenance est massive sur une equipe.

A l'inverse, Docker Compose offre :
- Une declaration declarative dans un seul fichier YAML
- Le meme demarrage sur Linux, MacOS, Windows (WSL2)
- Une isolation reseau (les services ne polluent pas le port host autres que les port mappings declares)
- Une cleanup atomique via `docker compose down -v` qui efface tout (containers + volumes + networks)
- Une integration CI naturelle (le meme docker-compose.test.yaml est utilise en GitHub Actions Tache 1.1.10)

Le choix specifique des 7 services repond a la stack technique v2.2 documentee dans `00-pilotage/documentation/1-stack-technique.yaml` :
- **PostgreSQL 16.6** : DB primaire avec 5 extensions (pgcrypto, pg_trgm, btree_gist, unaccent, citext)
- **Redis 7.4.1** : 6 DBs separes (cache, sessions, queues, locks, AI cache, rate limit)
- **Kafka 3.7.1 KRaft** : event sourcing + async processing + audit trail (30+ topics)
- **Kafka UI v0.7.2** : interface web Provectus pour debug topics/messages
- **MinIO RELEASE.2024-11-07** : S3-compatible local (simule Atlas Cloud Services Benguerir prod)
- **n8n 1.74.0** : workflow engine (utilise Sprint 30 pour automation MCP)
- **Mailhog v1.0.1** : SMTP catcher local (capture tous les emails dev sans envoyer reellement)

Le mode KRaft de Kafka 3.7 (Apache Kafka Raft consensus, sans Zookeeper) est une amelioration majeure de Kafka 3.5+. Avec Zookeeper historique, deployer Kafka en dev necessitait 2 conteneurs (Zookeeper + Kafka), avec quorum a configurer (single-node mais avec syntaxe de quorum). KRaft remplace Zookeeper par un consensus Raft natif Kafka, reduisant a 1 conteneur self-suffisant. Pour un dev environment, c'est une simplification majeure.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Installation native (Postgres brew/apt, Redis brew, Kafka standalone) | Performance native, no container overhead | Drift de versions par OS, conflits de ports inevitables, install complexe (Kafka surtout), pas reproductible | REJETE -- workflow non scalable |
| Docker Compose v1 (docker-compose) | Familiar | Deprecie depuis 2023, parsing YAML quirks | REJETE -- v2 preferable (`docker compose`) |
| Docker Compose v2 (docker compose) RETENU | Parsing YAML moderne, plugin officiel Docker, profiles pour subsets | Plus recent, certains examples online encore v1 | RETENU -- standard 2026 |
| Kubernetes local (kind, minikube) | Parite avec prod | Overhead massif (4 GB RAM minimum), complexite (manifests vs docker-compose), courbe apprentissage | REJETE -- overkill dev environment |
| Tilt / Skaffold | Hot reload Kubernetes friendly | Meme overhead k8s + outil supplementaire a maintenir | REJETE |
| Devcontainer (.devcontainer.json) | Reproductible IDE-aware | Couplage VSCode (autres editeurs hors-coverage), complexite extra | REJETE -- pas de gain sur Docker Compose pur |
| Kafka avec Zookeeper (legacy) | Pattern historique etabli | 2 conteneurs vs 1, syntaxe quorum | REJETE -- KRaft mode disponible et stable |

### 2.3 Trade-offs explicites

Activer `AUTO_CREATE_TOPICS_ENABLE=false` sur Kafka force a creer explicitement les 30+ topics via le script `init-topics.sh` (Tache 1.1.6). C'est plus rigoureux mais ajoute une etape : un nouveau topic doit etre ajoute au script init pour exister. Le compromis est accepte car eviter la creation accidentelle de topics typo (`insurtech.events.repair.SinistreDeclared` au lieu de `insurtech.events.repair.sinistre_declared`) vaut la friction.

Configurer Postgres `max_connections=200` en dev (vs 100 default) prepare le scaling : 9 apps + 23 packages backend + workers + tests integration = facilement 50+ connections simultanees. 200 evite les rejets `too many connections` pendant tests parallelisees.

Configurer Redis `maxmemory 512mb` + `allkeys-lru` evite que Redis s'evade de la RAM en dev (sur certaines machines 8 GB cela peut bloquer). 512 MB est suffisant pour cache + sessions + queues dev.

Choisir `restart: unless-stopped` pour les services principaux (vs `always`) permet a un developpeur de stopper explicitement un service via `docker compose stop postgres` sans qu'il redemarre automatiquement au boot suivant. C'est plus controlable.

Choisir `restart: "no"` pour les init containers est crucial : ils s'executent une fois (creation topics, creation buckets) et doivent terminer en exit 0. `restart: always` les ferait redemarrer en boucle, polluant les logs.

### 2.4 Decisions strategiques referenced

- **decision-001 (Monorepo)** : pertinence indirecte. La stack docker compose est dans `infrastructure/docker/` du monorepo.
- **decision-008 (Data Residency Maroc)** : pertinence directe. MinIO simule Atlas Cloud Services Benguerir Object Storage en dev. La region simulee est `ma-bgr-1` (region Morocco-Benguerir-1) pour preparer la migration prod transparent.
- **decision-006 (No-emoji)** : pertinence directe. Aucune emoji dans les YAML docker-compose, scripts init, configs Postgres/Redis.

### 2.5 Pieges techniques connus

1. **Piege : MacOS Docker Desktop limite RAM par defaut a 4 GB, insuffisant pour 7 services + healthchecks.**
   - Pourquoi : Docker Desktop MacOS alloue RAM via VM HyperKit. 4 GB par defaut, mais Kafka KRaft + Postgres + n8n + MinIO necessitent 5-6 GB minimum.
   - Solution : documenter dans CONTRIBUTING.md (Tache 1.1.15) la configuration `Docker Desktop > Settings > Resources > Memory` a 8 GB minimum. Sans cela, OOM kill containers aleatoires.

2. **Piege : Windows WSL2 avec antivirus Defender ralentit les volume mounts.**
   - Pourquoi : Windows Defender scanne chaque ecriture aux volumes Docker bind mounts.
   - Solution : utiliser des volumes nommes (managed by Docker) plutot que bind mounts dans la mesure du possible. Documente dans CONTRIBUTING.md.

3. **Piege : Le port 5432 (Postgres) est souvent deja utilise par une installation Postgres native locale.**
   - Pourquoi : MacOS / Linux dev environment frequemment a Postgres installe natif.
   - Solution : utiliser variable env `POSTGRES_PORT=5432` avec defaut, et permettre override via `.env`. Si conflict, le developpeur set `POSTGRES_PORT=5433` dans son `.env.local`.

4. **Piege : Kafka KRaft cluster ID doit etre genere une fois et reste constant.**
   - Pourquoi : Kafka KRaft utilise un `cluster.id` UUID que doit etre fixe a travers les restarts. Si le volume Kafka est efface, regenerer UUID est OK ; si on garde le volume mais on change UUID, Kafka refuse de boot.
   - Solution : utiliser un `cluster.id` fixe `--KAFKA_CFG_NODE_ID=1` + `KAFKA_KRAFT_CLUSTER_ID=skalean-insurtech-dev` qui reste stable. Documenter l'incompatibilite avec changement d'UUID.

5. **Piege : Healthcheck Postgres `pg_isready` retourne success meme si la DB est en mode startup recovery.**
   - Pourquoi : `pg_isready` verifie juste que Postgres accepte des connections, pas que la DB est prete a executer des queries.
   - Solution : utiliser `pg_isready -U skalean -d skalean_insurtech` qui force la verification d'une DB specifique. Ajouter un test `psql -c "SELECT 1"` en complement pour les init scripts critiques.

6. **Piege : Kafka topic creation race condition entre init container et apps qui produisent.**
   - Pourquoi : si `apps/api` demarre avant que `kafka-init-topics` n'ait termine, le producer va creer le topic avec config defaut au lieu de la config attendue (3 partitions, lz4 compression, etc.).
   - Solution : `apps/api` (Sprint 3) `depends_on: kafka-init-topics: condition: service_completed_successfully`. Healthcheck attend l'exit 0 du init container.

7. **Piege : MinIO bucket creation echoue si MinIO accepte connections mais pas encore initialise les credentials.**
   - Pourquoi : timing entre `MinIO HTTP ready` et `MinIO root credentials active`.
   - Solution : init container utilise `mc alias set local ... && mc ready local` (qui attend ready effectif) avant de creer les buckets.

8. **Piege : n8n necessite le schema Postgres dedie `n8n` separe du schema applicatif.**
   - Pourquoi : n8n cree ses tables dans la DB Postgres. Sans schema dedie, ces tables polluent l'espace `public` du schema applicatif.
   - Solution : creer schema `n8n` au boot via init script `003-init-databases.sql` (Tache 1.1.4). n8n configure pour utiliser `DB_POSTGRESDB_SCHEMA=n8n`.

9. **Piege : Mailhog UI port 8025 conflicte parfois avec Kafka UI 8080 (les developpeurs confondent).**
   - Pourquoi : ports proche, accidentellement les developpeurs se trompent d'URL.
   - Solution : documenter clairement les URLs dans CONTRIBUTING.md et le help message de `pnpm docker:up`.

10. **Piege : Volumes Docker named volumes survient `docker compose down` mais pas `down -v`.**
    - Pourquoi : `docker compose down` ne touche pas les volumes nommes pour preserver data. Seul `down -v` les efface.
    - Solution : exposer 2 commandes `pnpm docker:down` (preserve data) et `pnpm docker:reset` (clean tout). Documenter explicitement.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 1.1.3 est la troisieme tache du Sprint 1.

- **Depend de** : Tache 1.1.2 (TypeScript + Biome operationnels). En realite la dependance technique est faible (docker compose ne necessite pas TypeScript), mais l'ordre logique est respecte.
- **Bloque** :
  - Tache 1.1.4 (Postgres extensions + helpers RLS) : utilise les init scripts montes via volume Postgres
  - Tache 1.1.5 (Redis 6 DBs) : utilise le service Redis demarre ici
  - Tache 1.1.6 (Kafka topics) : utilise le service Kafka demarre ici
  - Tache 1.1.7 (MinIO + S3 wrapper) : utilise le service MinIO demarre ici
- **Apporte au sprint** : 2 fichiers docker-compose (dev + test), 1 redis.conf, 5 init scripts shell (postgres, kafka, minio).

### 3.2 Position dans le programme global

La stack `docker-compose.dev.yaml` est utilisee par tous les developpeurs sur les 35 sprints du programme. Toute modification (e.g. ajout d'un service ClickHouse au Sprint 13) impacte l'ensemble de l'equipe.

La stack `docker-compose.test.yaml` est utilisee par GitHub Actions CI a chaque PR. Differences cles vs dev :
- Pas de volumes persistents (tear down complet entre runs)
- Subset minimal : Postgres + Redis + Kafka uniquement (pas n8n, MinIO, Mailhog, Kafka UI)
- Healthchecks plus aggressifs (timeouts plus courts)

Au Sprint 35 (pilote Marrakech go-live), la stack production utilise Atlas Cloud Services Benguerir managed services (Postgres, Redis, Kafka comme services managed). Les configurations dev refletent autant que possible ces services pour minimiser les surprises de migration.

### 3.3 Diagramme reseau

```
                   docker network: skalean-net (bridge)
                            |
 +--------------------------+--------------------------+
 |        |        |        |        |        |        |
 v        v        v        v        v        v        v
+-------+-------+-------+--------+--------+-------+-------+
|postgr |redis  |kafka  |kafka-ui|minio  |n8n    |mailhog|
|:5432  |:6379  |:9094  |:8080   |:9000  |:5678  |:1025  |
|       |       |:9092  |        |:9001  |       |:8025  |
+---^---+-------+---^---+--------+---^---+---^---+-------+
    |               |                |       |
    |               |                |       |
+---+---+       +---+---+        +---+---+   |
|init   |       |init   |        |init   |   |
|sql x3 |       |topics |        |buckets|   |
|run-   |       |run-   |        |run-   |   |
|once   |       |once   |        |once   |   |
+-------+       +-------+        +-------+   |
    |                                        |
    +----------------------------------------+
              n8n schema dans postgres


Port mappings host -> container :
  5432  -> postgres:5432
  6379  -> redis:6379
  9094  -> kafka:9094 (EXTERNAL listener)
  9092  -> kafka:9092 (INTERNAL listener, dev access only)
  8080  -> kafka-ui:8080
  9000  -> minio:9000 (S3 API)
  9001  -> minio:9001 (Console UI)
  5678  -> n8n:5678
  1025  -> mailhog:1025 (SMTP)
  8025  -> mailhog:8025 (UI)


Healthchecks :
  postgres : pg_isready -U skalean -d skalean_insurtech (interval 5s, retries 12)
  redis    : redis-cli -a $REDIS_PASSWORD ping (interval 5s, retries 6)
  kafka    : kafka-topics.sh --bootstrap-server kafka:9092 --list (interval 10s, retries 12)
  kafka-ui : wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health
  minio    : curl -f http://localhost:9000/minio/health/live (interval 5s, retries 6)
  n8n      : wget --no-verbose --tries=1 --spider http://localhost:5678/healthz
  mailhog  : wget --no-verbose --tries=1 --spider http://localhost:8025
```

---

## 4. Livrables checkables

- [ ] Fichier `repo/infrastructure/docker/docker-compose.dev.yaml` orchestrant 7 services + 2 init containers (~280 lignes)
- [ ] Fichier `repo/infrastructure/docker/docker-compose.test.yaml` (subset CI) (~110 lignes)
- [ ] Service `postgres` image `postgres:16.6-alpine` avec config commands max_connections=200, shared_buffers=256MB, work_mem=8MB
- [ ] Service `postgres` mount `infrastructure/docker/postgres/` -> `/docker-entrypoint-initdb.d/` (pour init scripts Tache 1.1.4)
- [ ] Service `redis` image `redis:7.4.1-alpine` avec mount `redis.conf` custom
- [ ] Fichier `repo/infrastructure/docker/redis/redis.conf` avec AOF + RDB + LRU + slowlog (~50 lignes)
- [ ] Service `kafka` image `bitnami/kafka:3.7.1` en mode KRaft (process_roles=controller,broker, sans Zookeeper)
- [ ] Service `kafka` configure 3 listeners : INTERNAL (kafka:9092), CONTROLLER (kafka:9093), EXTERNAL (localhost:9094)
- [ ] Service `kafka` AUTO_CREATE_TOPICS_ENABLE=false (creation explicite via init container)
- [ ] Service `kafka-ui` image `provectuslabs/kafka-ui:v0.7.2` avec env KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092
- [ ] Service `mailhog` image `mailhog/mailhog:v1.0.1` ports 1025 SMTP + 8025 UI
- [ ] Service `minio` image `minio/minio:RELEASE.2024-11-07T00-52-20Z` ports 9000 S3 + 9001 console
- [ ] Service `minio` env MINIO_ROOT_USER + MINIO_ROOT_PASSWORD via vars `.env`
- [ ] Service `n8n` image `n8nio/n8n:1.74.0` port 5678 avec auth basique
- [ ] Service `n8n` configure `DB_TYPE=postgresdb`, `DB_POSTGRESDB_HOST=postgres`, `DB_POSTGRESDB_SCHEMA=n8n`
- [ ] Init container `kafka-init-topics` execute apres Kafka healthy (placeholder Tache 1.1.6 remplira le contenu)
- [ ] Init container `minio-init-buckets` execute apres MinIO healthy, cree 3 buckets dev (placeholder Tache 1.1.7)
- [ ] Healthchecks definis sur tous services principaux (intervals + retries adaptes)
- [ ] Volumes nommes : `postgres-data`, `redis-data`, `kafka-data`, `minio-data`, `n8n-data`
- [ ] Network bridge `skalean-net`
- [ ] Variables env via `${VAR:-default}` pattern (override depuis `.env`)
- [ ] Tous services up et healthy en moins de 60 secondes (machine 8 GB RAM)
- [ ] Init scripts shell stub places dans `infrastructure/docker/postgres/`, `infrastructure/docker/kafka/`, `infrastructure/docker/minio/` (placeholders)
- [ ] Script `repo/infrastructure/scripts/wait-for-stack-healthy.sh` qui attend que tous services soient healthy avec timeout
- [ ] Aucune emoji dans les fichiers livres

Total : 23 livrables.

---

## 5. Fichiers crees / modifies

```
repo/infrastructure/docker/docker-compose.dev.yaml       (~280 lignes)
repo/infrastructure/docker/docker-compose.test.yaml      (~110 lignes)
repo/infrastructure/docker/redis/redis.conf              (~50 lignes)
repo/infrastructure/docker/postgres/init.sh              (placeholder Tache 1.1.4, ~5 lignes)
repo/infrastructure/docker/kafka/init-topics.sh          (placeholder Tache 1.1.6, ~5 lignes)
repo/infrastructure/docker/minio/init-buckets.sh         (placeholder Tache 1.1.7, ~5 lignes)
repo/infrastructure/scripts/wait-for-stack-healthy.sh    (~60 lignes)
repo/infrastructure/scripts/__tests__/docker-compose.spec.ts (~150 lignes)
repo/infrastructure/scripts/__tests__/redis-conf.spec.ts (~80 lignes)
repo/.env.example                                        MODIFIE (ajout vars docker)
```

Total : 9 fichiers crees + 1 modifie.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/8 : `repo/infrastructure/docker/docker-compose.dev.yaml`

Role : declaration complete des 7 services + 2 init containers + healthchecks + volumes + network. C'est le fichier central de la stack dev.

```yaml
# ============================================================================
# Skalean InsurTech v2.2 -- Stack dev Docker Compose
# Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.3)
#            00-pilotage/documentation/1-stack-technique.yaml
#            decision-001 (monorepo) + decision-006 (no-emoji)
#            decision-008 (data residency Maroc -- MinIO simule Atlas Benguerir)
#
# Usage :
#   pnpm docker:up      -- demarre tous les services en background
#   pnpm docker:down    -- stoppe (preserve volumes data)
#   pnpm docker:reset   -- stoppe + efface volumes + redemarre (clean state)
#   pnpm docker:logs    -- tail logs en mode follow
#   pnpm docker:ps      -- liste services et leur etat (healthy/unhealthy)
#
# Aucune emoji autorisee dans ce fichier (decision-006).
# ============================================================================

name: skalean-insurtech-dev

networks:
  skalean-net:
    name: skalean-net
    driver: bridge

volumes:
  postgres-data:
    name: skalean-postgres-data
  redis-data:
    name: skalean-redis-data
  kafka-data:
    name: skalean-kafka-data
  minio-data:
    name: skalean-minio-data
  n8n-data:
    name: skalean-n8n-data

services:
  # ==========================================================================
  # PostgreSQL 16.6 -- DB primaire avec 5 extensions
  # Init scripts dans postgres/ executes dans l'ordre alphabetique au boot
  # Configuration : max_connections=200, shared_buffers=256MB, work_mem=8MB
  # ==========================================================================
  postgres:
    image: postgres:16.6-alpine
    container_name: skalean-postgres
    restart: unless-stopped
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-skalean}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-skalean_dev_only_change_in_prod}
      POSTGRES_DB: ${POSTGRES_DB:-skalean_insurtech}
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8 --lc-collate=fr_FR.UTF-8 --lc-ctype=fr_FR.UTF-8"
      TZ: Africa/Casablanca
      PGTZ: Africa/Casablanca
    command:
      - "postgres"
      - "-c"
      - "max_connections=200"
      - "-c"
      - "shared_buffers=256MB"
      - "-c"
      - "work_mem=8MB"
      - "-c"
      - "maintenance_work_mem=64MB"
      - "-c"
      - "effective_cache_size=1GB"
      - "-c"
      - "effective_io_concurrency=200"
      - "-c"
      - "random_page_cost=1.1"
      - "-c"
      - "log_statement=mod"
      - "-c"
      - "log_min_duration_statement=500"
      - "-c"
      - "log_connections=on"
      - "-c"
      - "log_disconnections=on"
      - "-c"
      - "log_line_prefix=%m [%p] %u@%d "
      - "-c"
      - "timezone=Africa/Casablanca"
      - "-c"
      - "stats_temp_directory=/tmp"
      - "-c"
      - "track_activity_query_size=2048"
      - "-c"
      - "shared_preload_libraries=pg_stat_statements"
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./postgres:/docker-entrypoint-initdb.d:ro
    networks:
      - skalean-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-skalean} -d ${POSTGRES_DB:-skalean_insurtech}"]
      interval: 5s
      timeout: 5s
      retries: 12
      start_period: 10s
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: "1.0"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  # ==========================================================================
  # Redis 7.4.1 -- 6 DBs separes (cache, sessions, queues, locks, AI, ratelimit)
  # Configuration custom via redis.conf (AOF, RDB, LRU 512MB, slowlog 10ms)
  # ==========================================================================
  redis:
    image: redis:7.4.1-alpine
    container_name: skalean-redis
    restart: unless-stopped
    ports:
      - "${REDIS_PORT:-6379}:6379"
    command: ["redis-server", "/usr/local/etc/redis/redis.conf", "--requirepass", "${REDIS_PASSWORD:-skalean_redis_dev_only}"]
    volumes:
      - redis-data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf:ro
    networks:
      - skalean-net
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a ${REDIS_PASSWORD:-skalean_redis_dev_only} ping | grep PONG"]
      interval: 5s
      timeout: 3s
      retries: 6
      start_period: 5s
    deploy:
      resources:
        limits:
          memory: 768M
          cpus: "0.5"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  # ==========================================================================
  # Kafka 3.7.1 KRaft -- mode controller+broker self-suffisant (sans Zookeeper)
  # 3 listeners : INTERNAL (9092), CONTROLLER (9093), EXTERNAL (9094)
  # AUTO_CREATE_TOPICS_ENABLE=false : creation explicite via kafka-init-topics
  # ==========================================================================
  kafka:
    image: bitnami/kafka:3.7.1
    container_name: skalean-kafka
    restart: unless-stopped
    ports:
      - "${KAFKA_EXTERNAL_PORT:-9094}:9094"
    environment:
      # KRaft node config
      KAFKA_CFG_NODE_ID: 1
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_KRAFT_CLUSTER_ID: skalean-insurtech-dev-cluster-uuid

      # Listeners
      KAFKA_CFG_LISTENERS: INTERNAL://:9092,CONTROLLER://:9093,EXTERNAL://:9094
      KAFKA_CFG_ADVERTISED_LISTENERS: INTERNAL://kafka:9092,EXTERNAL://localhost:9094
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_CFG_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093

      # Topics policy
      KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "false"
      KAFKA_CFG_DELETE_TOPIC_ENABLE: "true"
      KAFKA_CFG_NUM_PARTITIONS: 3
      KAFKA_CFG_DEFAULT_REPLICATION_FACTOR: 1
      KAFKA_CFG_MIN_INSYNC_REPLICAS: 1

      # Retention
      KAFKA_CFG_LOG_RETENTION_HOURS: 168
      KAFKA_CFG_LOG_RETENTION_BYTES: 1073741824
      KAFKA_CFG_LOG_SEGMENT_BYTES: 268435456

      # Compression
      KAFKA_CFG_COMPRESSION_TYPE: lz4

      # Security off in dev
      ALLOW_PLAINTEXT_LISTENER: "yes"

      # JMX
      JMX_PORT: 9999
      KAFKA_JMX_OPTS: "-Dcom.sun.management.jmxremote.authenticate=false -Dcom.sun.management.jmxremote.ssl=false"
    volumes:
      - kafka-data:/bitnami/kafka
    networks:
      - skalean-net
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1"]
      interval: 10s
      timeout: 10s
      retries: 12
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 1.5G
          cpus: "1.0"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

  # ==========================================================================
  # Kafka UI v0.7.2 -- Provectus interface web pour debug topics/messages
  # ==========================================================================
  kafka-ui:
    image: provectuslabs/kafka-ui:v0.7.2
    container_name: skalean-kafka-ui
    restart: unless-stopped
    ports:
      - "${KAFKA_UI_PORT:-8080}:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: skalean-insurtech-dev
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
      KAFKA_CLUSTERS_0_KAFKACONNECT_0_NAME: ""
      DYNAMIC_CONFIG_ENABLED: "true"
      LOGGING_LEVEL_ROOT: warn
      LOGGING_LEVEL_COM_PROVECTUS: info
    depends_on:
      kafka:
        condition: service_healthy
    networks:
      - skalean-net
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8080/actuator/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 20s

  # ==========================================================================
  # Mailhog v1.0.1 -- SMTP catcher local (capture emails dev sans envoi reel)
  # Port 1025 SMTP, 8025 UI web pour visualiser emails captures
  # ==========================================================================
  mailhog:
    image: mailhog/mailhog:v1.0.1
    container_name: skalean-mailhog
    restart: unless-stopped
    ports:
      - "${MAILHOG_SMTP_PORT:-1025}:1025"
      - "${MAILHOG_UI_PORT:-8025}:8025"
    environment:
      MH_STORAGE: maildir
      MH_MAILDIR_PATH: /tmp/mailhog
    networks:
      - skalean-net
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:8025 || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s

  # ==========================================================================
  # MinIO RELEASE.2024-11-07 -- S3-compatible local
  # Simule Atlas Cloud Services Benguerir Object Storage prod (decision-008)
  # Region nominale ma-bgr-1 (Morocco-Benguerir-1)
  # 3 buckets crees automatiquement via minio-init-buckets
  # ==========================================================================
  minio:
    image: minio/minio:RELEASE.2024-11-07T00-52-20Z
    container_name: skalean-minio
    restart: unless-stopped
    ports:
      - "${MINIO_PORT:-9000}:9000"
      - "${MINIO_CONSOLE_PORT:-9001}:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-skalean}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-skalean_minio_dev_only}
      MINIO_REGION: ma-bgr-1
      MINIO_REGION_NAME: ma-bgr-1
      MINIO_BROWSER: "on"
      MINIO_PROMETHEUS_AUTH_TYPE: public
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data
    networks:
      - skalean-net
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:9000/minio/health/live || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 6
      start_period: 10s

  # ==========================================================================
  # n8n 1.74.0 -- workflow engine, utilise au Sprint 30 pour automation MCP
  # Backend Postgres dans schema dedie n8n (cree par init script Tache 1.1.4)
  # ==========================================================================
  n8n:
    image: n8nio/n8n:1.74.0
    container_name: skalean-n8n
    restart: unless-stopped
    ports:
      - "${N8N_PORT:-5678}:5678"
    environment:
      DB_TYPE: postgresdb
      DB_POSTGRESDB_DATABASE: ${POSTGRES_DB:-skalean_insurtech}
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_USER: ${POSTGRES_USER:-skalean}
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD:-skalean_dev_only_change_in_prod}
      DB_POSTGRESDB_SCHEMA: n8n
      N8N_BASIC_AUTH_ACTIVE: "true"
      N8N_BASIC_AUTH_USER: ${N8N_BASIC_AUTH_USER:-skalean}
      N8N_BASIC_AUTH_PASSWORD: ${N8N_BASIC_AUTH_PASSWORD:-skalean_n8n_dev_only}
      N8N_HOST: localhost
      N8N_PORT: 5678
      N8N_PROTOCOL: http
      WEBHOOK_URL: http://localhost:5678/
      GENERIC_TIMEZONE: Africa/Casablanca
      TZ: Africa/Casablanca
      N8N_LOG_LEVEL: info
      N8N_DIAGNOSTICS_ENABLED: "false"
      N8N_PERSONALIZATION_ENABLED: "false"
      N8N_VERSION_NOTIFICATIONS_ENABLED: "false"
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - n8n-data:/home/node/.n8n
    networks:
      - skalean-net
    healthcheck:
      test: ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:5678/healthz || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 6
      start_period: 20s

  # ==========================================================================
  # INIT CONTAINER : kafka-init-topics
  # S'execute apres Kafka healthy, cree les 30+ topics, exit 0
  # Le script init-topics.sh sera complete par Tache 1.1.6
  # ==========================================================================
  kafka-init-topics:
    image: bitnami/kafka:3.7.1
    container_name: skalean-kafka-init-topics
    restart: "no"
    depends_on:
      kafka:
        condition: service_healthy
    volumes:
      - ./kafka:/scripts:ro
    networks:
      - skalean-net
    entrypoint: ["bash", "/scripts/init-topics.sh"]

  # ==========================================================================
  # INIT CONTAINER : minio-init-buckets
  # S'execute apres MinIO healthy, cree les 3 buckets dev, exit 0
  # Le script init-buckets.sh sera complete par Tache 1.1.7
  # ==========================================================================
  minio-init-buckets:
    image: minio/mc:RELEASE.2024-11-07T00-52-20Z
    container_name: skalean-minio-init
    restart: "no"
    depends_on:
      minio:
        condition: service_healthy
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-skalean}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-skalean_minio_dev_only}
    volumes:
      - ./minio:/scripts:ro
    networks:
      - skalean-net
    entrypoint: ["sh", "/scripts/init-buckets.sh"]
```

**Notes importantes** :
- `name: skalean-insurtech-dev` declare le project name (visible dans `docker compose ls`).
- Volumes nommes `skalean-*` (vs anonymes) permettent identification facile dans `docker volume ls` et survie aux `docker compose down`.
- Postgres `command` declare 18 parametres explicites pour aligner dev sur prod.
- `log_statement=mod` log toutes les queries DML (INSERT/UPDATE/DELETE) -- utile debug, mais peut etre verbose.
- `log_min_duration_statement=500` log toutes queries > 500ms -- detecte les queries lentes.
- `shared_preload_libraries=pg_stat_statements` active l'extension de profiling queries (utilisee Sprint 33 perf audit).
- Postgres `volumes: ./postgres:/docker-entrypoint-initdb.d:ro` monte les init scripts en read-only (mode 444). Postgres execute automatiquement les fichiers `*.sql` et `*.sh` au premier boot (data dir vide).
- Kafka `KAFKA_KRAFT_CLUSTER_ID: skalean-insurtech-dev-cluster-uuid` est un UUID stable. Si volume kafka-data est efface, Kafka regenere les metadata avec ce cluster.id. Si volume preserve mais cluster.id change, Kafka refuse boot.
- Kafka 3 listeners : INTERNAL pour comm inter-services Docker, EXTERNAL pour acces dev tools (kcat localhost:9094), CONTROLLER pour KRaft consensus interne.
- Kafka `start_period: 30s` est plus genereux car KRaft initial bootstrap prend 15-25s sur premiere boot.
- Mailhog `MH_STORAGE: maildir` persiste les emails dans /tmp -- pas de volume car ephemere par design.
- MinIO `MINIO_REGION: ma-bgr-1` simule Atlas Cloud Services Benguerir region (decision-008).
- n8n `DB_POSTGRESDB_SCHEMA: n8n` impose schema separe (cree par Tache 1.1.4 init script `003-init-databases.sql`).
- n8n depend de postgres (`condition: service_healthy`) pour eviter race condition au boot.
- 2 init containers `restart: "no"` : ils s'executent une fois et exit. `restart: always` les ferait redemarrer en boucle.
- `deploy.resources.limits` declare des limits memoire/CPU (pour eviter qu'un service consomme toute la RAM machine).
- `logging.driver: json-file` + `max-size: 10m` + `max-file: 3` rotate les logs (evite remplissage disque).

### 6.2 Fichier 2/8 : `repo/infrastructure/docker/docker-compose.test.yaml`

Role : stack subset pour CI -- juste Postgres + Redis + Kafka, healthchecks rapides, pas de volumes persistents.

```yaml
# Skalean InsurTech v2.2 -- Stack TEST Docker Compose (CI uniquement)
# Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.3)
#
# Differences vs docker-compose.dev.yaml :
#   - Subset minimal : postgres + redis + kafka uniquement
#   - Pas de volumes persistents (tear down complet entre runs)
#   - Healthchecks plus aggressifs (intervals 2s vs 5s, retries 6 vs 12)
#   - Pas de Mailhog/n8n/MinIO/Kafka UI
#   - Kafka init topics integre (pas de container separe)

name: skalean-insurtech-test

networks:
  skalean-test-net:
    driver: bridge

services:
  postgres:
    image: postgres:16.6-alpine
    container_name: skalean-postgres-test
    restart: "no"
    ports:
      - "${POSTGRES_TEST_PORT:-5433}:5432"
    environment:
      POSTGRES_USER: skalean
      POSTGRES_PASSWORD: skalean_test
      POSTGRES_DB: skalean_insurtech_test
      POSTGRES_INITDB_ARGS: "--encoding=UTF-8"
      TZ: Africa/Casablanca
    command:
      - "postgres"
      - "-c"
      - "max_connections=100"
      - "-c"
      - "shared_buffers=128MB"
      - "-c"
      - "fsync=off"
      - "-c"
      - "synchronous_commit=off"
      - "-c"
      - "full_page_writes=off"
      - "-c"
      - "log_statement=none"
    volumes:
      - ./postgres:/docker-entrypoint-initdb.d:ro
    networks:
      - skalean-test-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U skalean -d skalean_insurtech_test"]
      interval: 2s
      timeout: 3s
      retries: 6
      start_period: 5s
    tmpfs:
      - /var/lib/postgresql/data:size=512M

  redis:
    image: redis:7.4.1-alpine
    container_name: skalean-redis-test
    restart: "no"
    ports:
      - "${REDIS_TEST_PORT:-6380}:6379"
    command: ["redis-server", "--save", "", "--appendonly", "no", "--requirepass", "skalean_redis_test"]
    networks:
      - skalean-test-net
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a skalean_redis_test ping | grep PONG"]
      interval: 2s
      timeout: 2s
      retries: 6

  kafka:
    image: bitnami/kafka:3.7.1
    container_name: skalean-kafka-test
    restart: "no"
    ports:
      - "${KAFKA_TEST_PORT:-9095}:9094"
    environment:
      KAFKA_CFG_NODE_ID: 1
      KAFKA_CFG_PROCESS_ROLES: controller,broker
      KAFKA_KRAFT_CLUSTER_ID: skalean-test-cluster-uuid
      KAFKA_CFG_LISTENERS: INTERNAL://:9092,CONTROLLER://:9093,EXTERNAL://:9094
      KAFKA_CFG_ADVERTISED_LISTENERS: INTERNAL://kafka:9092,EXTERNAL://localhost:9095
      KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP: INTERNAL:PLAINTEXT,CONTROLLER:PLAINTEXT,EXTERNAL:PLAINTEXT
      KAFKA_CFG_INTER_BROKER_LISTENER_NAME: INTERNAL
      KAFKA_CFG_CONTROLLER_LISTENER_NAMES: CONTROLLER
      KAFKA_CFG_CONTROLLER_QUORUM_VOTERS: 1@kafka:9093
      KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "true"
      KAFKA_CFG_NUM_PARTITIONS: 1
      KAFKA_CFG_DEFAULT_REPLICATION_FACTOR: 1
      ALLOW_PLAINTEXT_LISTENER: "yes"
    networks:
      - skalean-test-net
    healthcheck:
      test: ["CMD-SHELL", "kafka-topics.sh --bootstrap-server localhost:9092 --list || exit 1"]
      interval: 5s
      timeout: 5s
      retries: 6
      start_period: 15s
    tmpfs:
      - /bitnami/kafka:size=512M
```

**Notes importantes** :
- `restart: "no"` : pas de restart en CI, un crash = test fail.
- `tmpfs: /var/lib/postgresql/data:size=512M` : Postgres data en RAM pour vitesse CI (ephemere, OK pour tests).
- Postgres `fsync=off` + `synchronous_commit=off` + `full_page_writes=off` : 5-10x plus rapide en test, JAMAIS en prod (risque corruption sur crash).
- `KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE: "true"` en test (vs false en dev) : evite besoin init container, simplifie CI.
- Ports decales (5433, 6380, 9095) pour permettre execution simultanee dev + test sur meme machine.
- Pas de volumes nommes : `docker compose down` clean tout automatiquement.

### 6.3 Fichier 3/8 : `repo/infrastructure/docker/redis/redis.conf`

Role : configuration Redis custom (AOF + RDB + LRU + slowlog + notify keyspace).

```conf
# Skalean InsurTech v2.2 -- Redis 7.4 configuration
# Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.3)
#            decision-006 (no-emoji)

# ============================================================================
# Network
# ============================================================================
bind 0.0.0.0
protected-mode yes
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# ============================================================================
# General
# ============================================================================
daemonize no
supervised no
loglevel notice
databases 16
always-show-logo no

# ============================================================================
# Snapshotting (RDB)
# ============================================================================
# Save snapshot dump.rdb if at least 1 key changed in 900s, 10 keys in 300s, 10000 keys in 60s
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data

# ============================================================================
# Append Only File (AOF) -- persistance plus durable
# ============================================================================
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
aof-load-truncated yes
aof-use-rdb-preamble yes

# ============================================================================
# Memory management
# ============================================================================
maxmemory 512mb
maxmemory-policy allkeys-lru
maxmemory-samples 5

# ============================================================================
# Notifications
# ============================================================================
# Activer notifications keyspace events pour eviction (debug)
# E = keyevent events ($, @, etc.)
# x = expired events
notify-keyspace-events "Ex"

# ============================================================================
# Slow log
# ============================================================================
slowlog-log-slower-than 10000
slowlog-max-len 128

# ============================================================================
# Latency monitor
# ============================================================================
latency-monitor-threshold 100

# ============================================================================
# Lazy freeing
# ============================================================================
lazyfree-lazy-eviction yes
lazyfree-lazy-expire yes
lazyfree-lazy-server-del yes
replica-lazy-flush yes
lazyfree-lazy-user-del yes

# ============================================================================
# Client buffers
# ============================================================================
client-output-buffer-limit normal 0 0 0
client-output-buffer-limit replica 256mb 64mb 60
client-output-buffer-limit pubsub 32mb 8mb 60

# ============================================================================
# Threading
# ============================================================================
io-threads 2
io-threads-do-reads yes
```

**Notes importantes** :
- `bind 0.0.0.0` + `protected-mode yes` : accepte connections de tout, mais require password.
- AOF `appendfsync everysec` : bon compromis durabilite (max 1 sec data loss on crash) vs perf.
- `maxmemory 512mb` + `maxmemory-policy allkeys-lru` : Redis evict les keys LRU quand memoire saturee. Pas de OOM.
- `notify-keyspace-events "Ex"` : utile pour monitoring eviction events (tests Sprint 1.1.5).
- `slowlog-log-slower-than 10000` : log queries > 10ms (helpful pour detecter operations couteuses).
- `io-threads 2` : Redis 6+ supporte multi-threading I/O. 2 threads suffit dev.

### 6.4 Fichier 4/8 : `repo/infrastructure/docker/postgres/init.sh` (placeholder Tache 1.1.4)

```bash
#!/usr/bin/env bash
# Postgres init entry point -- placeholder Tache 1.1.4
# Les fichiers SQL 001-*.sql, 002-*.sql, 003-*.sql seront crees par Tache 1.1.4
# et executes automatiquement par postgres docker-entrypoint-initdb.d
set -euo pipefail
echo "[postgres-init] entry point loaded -- SQL scripts will be executed alphabetically"
```

### 6.5 Fichier 5/8 : `repo/infrastructure/docker/kafka/init-topics.sh` (placeholder Tache 1.1.6)

```bash
#!/usr/bin/env bash
# Kafka init topics -- placeholder Tache 1.1.6
# Sera complete par Tache 1.1.6 avec creation des 30+ topics
set -euo pipefail
echo "[kafka-init] waiting for kafka broker..."
until kafka-topics.sh --bootstrap-server kafka:9092 --list >/dev/null 2>&1; do
  sleep 2
done
echo "[kafka-init] kafka ready -- topic creation will be implemented by Tache 1.1.6"
echo "[kafka-init] exiting 0 (placeholder)"
exit 0
```

### 6.6 Fichier 6/8 : `repo/infrastructure/docker/minio/init-buckets.sh` (placeholder Tache 1.1.7)

```bash
#!/bin/sh
# MinIO init buckets -- placeholder Tache 1.1.7
# Sera complete par Tache 1.1.7 avec creation des 3 buckets dev
set -eu
echo "[minio-init] waiting for minio..."
until mc alias set local http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" >/dev/null 2>&1; do
  sleep 2
done
echo "[minio-init] minio ready -- bucket creation will be implemented by Tache 1.1.7"
echo "[minio-init] exiting 0 (placeholder)"
exit 0
```

### 6.7 Fichier 7/8 : `repo/infrastructure/scripts/wait-for-stack-healthy.sh`

Role : helper script qui attend que tous les services docker soient healthy, avec timeout. Utilise par CI Tache 1.1.10 et `pnpm bootstrap`.

```bash
#!/usr/bin/env bash
# Skalean InsurTech v2.2 -- wait for stack healthy
# Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.3)
# Usage: bash infrastructure/scripts/wait-for-stack-healthy.sh [TIMEOUT_SECONDS]
set -euo pipefail

TIMEOUT_SECONDS="${1:-90}"
COMPOSE_FILE="${COMPOSE_FILE:-infrastructure/docker/docker-compose.dev.yaml}"
EXPECTED_SERVICES=(postgres redis kafka kafka-ui mailhog minio n8n)

echo "[wait-for-stack] waiting up to ${TIMEOUT_SECONDS}s for services: ${EXPECTED_SERVICES[*]}"

START_TIME=$(date +%s)

check_service_healthy() {
  local service="$1"
  local container_id
  container_id=$(docker compose -f "${COMPOSE_FILE}" ps -q "${service}" 2>/dev/null || echo "")

  if [[ -z "${container_id}" ]]; then
    echo "[wait-for-stack] service ${service} not running"
    return 1
  fi

  local health_status
  health_status=$(docker inspect --format='{{.State.Health.Status}}' "${container_id}" 2>/dev/null || echo "unknown")

  if [[ "${health_status}" == "healthy" ]]; then
    return 0
  elif [[ "${health_status}" == "unhealthy" ]]; then
    echo "[wait-for-stack] service ${service} is unhealthy"
    docker logs --tail=20 "${container_id}" 2>&1 | sed "s/^/[${service}] /"
    return 2
  else
    return 1
  fi
}

while true; do
  ELAPSED=$(($(date +%s) - START_TIME))
  if [[ "${ELAPSED}" -ge "${TIMEOUT_SECONDS}" ]]; then
    echo "[wait-for-stack] FAIL: timeout after ${TIMEOUT_SECONDS}s"
    docker compose -f "${COMPOSE_FILE}" ps
    exit 1
  fi

  ALL_HEALTHY=true
  for service in "${EXPECTED_SERVICES[@]}"; do
    if ! check_service_healthy "${service}"; then
      ALL_HEALTHY=false
      break
    fi
  done

  if "${ALL_HEALTHY}"; then
    echo "[wait-for-stack] OK: all ${#EXPECTED_SERVICES[@]} services healthy in ${ELAPSED}s"
    docker compose -f "${COMPOSE_FILE}" ps
    exit 0
  fi

  sleep 2
done
```

**Notes importantes** :
- Boucle polling 2s avec timeout configurable (default 90s, depasser cible 60s mais marge).
- Affiche logs des services unhealthy pour debug rapide.
- Compatible bash 4+ (associative arrays non utilises pour MacOS bash 3 compatibility).
- Exit codes : 0 success, 1 timeout, 2 unhealthy explicite.

### 6.8 Fichier 8/8 : `repo/infrastructure/scripts/__tests__/docker-compose.spec.ts`

Role : tests structure docker-compose.dev.yaml + execution `pnpm docker:up` smoke tests.

```typescript
/**
 * Tests Docker Compose stack -- Tache 1.1.3
 *
 * Verifie la structure du docker-compose.dev.yaml + execution effective
 * de la stack dans un contexte d'integration.
 *
 * Reference : 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.3)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';

const REPO_ROOT = resolve(__dirname, '../../..');
const COMPOSE_DEV = join(REPO_ROOT, 'infrastructure/docker/docker-compose.dev.yaml');
const COMPOSE_TEST = join(REPO_ROOT, 'infrastructure/docker/docker-compose.test.yaml');
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION === 'true';

interface ComposeService {
  image?: string;
  container_name?: string;
  ports?: string[];
  environment?: Record<string, string>;
  command?: string | string[];
  volumes?: string[];
  networks?: string[];
  healthcheck?: { test: string[]; interval?: string; retries?: number };
  depends_on?: Record<string, { condition: string }> | string[];
  restart?: string;
}

interface ComposeFile {
  name?: string;
  networks?: Record<string, unknown>;
  volumes?: Record<string, unknown>;
  services: Record<string, ComposeService>;
}

describe('docker-compose.dev.yaml structure -- Tache 1.1.3', () => {
  let compose: ComposeFile;

  beforeAll(() => {
    const raw = readFileSync(COMPOSE_DEV, 'utf-8');
    compose = parseYaml(raw) as ComposeFile;
  });

  describe('Top-level structure', () => {
    it('should declare project name skalean-insurtech-dev', () => {
      expect(compose.name).toBe('skalean-insurtech-dev');
    });

    it('should declare network skalean-net', () => {
      expect(compose.networks?.['skalean-net']).toBeDefined();
    });

    it('should declare 5 named volumes', () => {
      const expectedVolumes = [
        'postgres-data', 'redis-data', 'kafka-data', 'minio-data', 'n8n-data',
      ];
      for (const vol of expectedVolumes) {
        expect(compose.volumes?.[vol]).toBeDefined();
      }
    });
  });

  describe('Services -- 7 main + 2 init = 9 total', () => {
    const MAIN_SERVICES = [
      'postgres', 'redis', 'kafka', 'kafka-ui', 'mailhog', 'minio', 'n8n',
    ];
    const INIT_SERVICES = ['kafka-init-topics', 'minio-init-buckets'];

    it.each(MAIN_SERVICES)('should declare main service %s', (svc) => {
      expect(compose.services[svc]).toBeDefined();
    });

    it.each(INIT_SERVICES)('should declare init service %s', (svc) => {
      expect(compose.services[svc]).toBeDefined();
      expect(compose.services[svc]?.restart).toBe('no');
    });

    it('should have 7 main services + 2 init = 9 total', () => {
      expect(Object.keys(compose.services).length).toBe(9);
    });
  });

  describe('Postgres service', () => {
    it('should use image postgres:16.6-alpine', () => {
      expect(compose.services.postgres?.image).toBe('postgres:16.6-alpine');
    });

    it('should mount init scripts directory', () => {
      const volumes = compose.services.postgres?.volumes ?? [];
      expect(volumes.some((v) => v.includes('docker-entrypoint-initdb.d'))).toBe(true);
    });

    it('should set max_connections=200', () => {
      const cmd = compose.services.postgres?.command;
      expect(JSON.stringify(cmd)).toContain('max_connections=200');
    });

    it('should have healthcheck pg_isready', () => {
      const test = compose.services.postgres?.healthcheck?.test;
      expect(JSON.stringify(test)).toContain('pg_isready');
    });
  });

  describe('Kafka service', () => {
    it('should use bitnami/kafka:3.7.1', () => {
      expect(compose.services.kafka?.image).toBe('bitnami/kafka:3.7.1');
    });

    it('should be in KRaft mode (controller,broker)', () => {
      const env = compose.services.kafka?.environment;
      expect(env?.KAFKA_CFG_PROCESS_ROLES).toBe('controller,broker');
    });

    it('should have AUTO_CREATE_TOPICS_ENABLE=false', () => {
      const env = compose.services.kafka?.environment;
      expect(env?.KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE).toBe('false');
    });

    it('should declare 3 listeners INTERNAL+CONTROLLER+EXTERNAL', () => {
      const env = compose.services.kafka?.environment;
      const listeners = env?.KAFKA_CFG_LISTENERS;
      expect(listeners).toContain('INTERNAL');
      expect(listeners).toContain('CONTROLLER');
      expect(listeners).toContain('EXTERNAL');
    });
  });

  describe('Redis service', () => {
    it('should use redis:7.4.1-alpine', () => {
      expect(compose.services.redis?.image).toBe('redis:7.4.1-alpine');
    });

    it('should mount custom redis.conf', () => {
      const volumes = compose.services.redis?.volumes ?? [];
      expect(volumes.some((v) => v.includes('redis.conf'))).toBe(true);
    });
  });

  describe('MinIO service', () => {
    it('should use minio image 2024-11-07', () => {
      expect(compose.services.minio?.image).toMatch(/^minio\/minio:RELEASE\.2024-11-07/);
    });

    it('should set region ma-bgr-1 (Atlas Benguerir simulation)', () => {
      const env = compose.services.minio?.environment;
      expect(env?.MINIO_REGION).toBe('ma-bgr-1');
    });
  });

  describe('Init containers', () => {
    it('kafka-init-topics depends on kafka healthy', () => {
      const dep = compose.services['kafka-init-topics']?.depends_on as Record<string, { condition: string }>;
      expect(dep?.kafka?.condition).toBe('service_healthy');
    });

    it('minio-init-buckets depends on minio healthy', () => {
      const dep = compose.services['minio-init-buckets']?.depends_on as Record<string, { condition: string }>;
      expect(dep?.minio?.condition).toBe('service_healthy');
    });
  });

  describe('Healthchecks', () => {
    const SERVICES_WITH_HEALTHCHECK = [
      'postgres', 'redis', 'kafka', 'kafka-ui', 'mailhog', 'minio', 'n8n',
    ];

    it.each(SERVICES_WITH_HEALTHCHECK)('%s should have healthcheck defined', (svc) => {
      expect(compose.services[svc]?.healthcheck).toBeDefined();
      expect(compose.services[svc]?.healthcheck?.test).toBeDefined();
    });
  });

  describe('docker-compose.test.yaml subset', () => {
    let testCompose: ComposeFile;

    beforeAll(() => {
      testCompose = parseYaml(readFileSync(COMPOSE_TEST, 'utf-8')) as ComposeFile;
    });

    it('should declare project name skalean-insurtech-test', () => {
      expect(testCompose.name).toBe('skalean-insurtech-test');
    });

    it('should have only 3 services (postgres, redis, kafka)', () => {
      expect(Object.keys(testCompose.services).sort()).toEqual(['kafka', 'postgres', 'redis']);
    });

    it('should set fsync=off on postgres for speed', () => {
      const cmd = testCompose.services.postgres?.command;
      expect(JSON.stringify(cmd)).toContain('fsync=off');
    });
  });
});

describe.skipIf(SKIP_INTEGRATION)('Docker Compose execution -- integration', () => {
  it('should compose up successfully', () => {
    expect(() => {
      execSync('docker compose -f infrastructure/docker/docker-compose.dev.yaml up -d', {
        cwd: REPO_ROOT,
        stdio: 'pipe',
        timeout: 120000,
      });
    }).not.toThrow();
  });

  it('should have at least 7 healthy services in 90s', () => {
    expect(() => {
      execSync('bash infrastructure/scripts/wait-for-stack-healthy.sh 90', {
        cwd: REPO_ROOT,
        stdio: 'pipe',
        timeout: 100000,
      });
    }).not.toThrow();
  });

  it('should compose down cleanly', () => {
    expect(() => {
      execSync('docker compose -f infrastructure/docker/docker-compose.dev.yaml down -v', {
        cwd: REPO_ROOT,
        stdio: 'pipe',
        timeout: 30000,
      });
    }).not.toThrow();
  });
});
```

---

## 7. Tests complets

### 7.1 Tests unitaires : `docker-compose.spec.ts` (voir 6.8) + `redis-conf.spec.ts`

```typescript
// repo/infrastructure/scripts/__tests__/redis-conf.spec.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const REPO_ROOT = resolve(__dirname, '../../..');
const REDIS_CONF = join(REPO_ROOT, 'infrastructure/docker/redis/redis.conf');

describe('redis.conf -- Tache 1.1.3', () => {
  let conf: string;

  beforeAll(() => {
    conf = readFileSync(REDIS_CONF, 'utf-8');
  });

  it('should enable AOF', () => {
    expect(conf).toMatch(/^appendonly yes$/m);
  });

  it('should configure RDB save policy', () => {
    expect(conf).toMatch(/^save 900 1$/m);
    expect(conf).toMatch(/^save 300 10$/m);
    expect(conf).toMatch(/^save 60 10000$/m);
  });

  it('should set maxmemory 512mb', () => {
    expect(conf).toMatch(/^maxmemory 512mb$/m);
  });

  it('should use allkeys-lru eviction policy', () => {
    expect(conf).toMatch(/^maxmemory-policy allkeys-lru$/m);
  });

  it('should enable keyspace notifications Ex', () => {
    expect(conf).toMatch(/^notify-keyspace-events "Ex"$/m);
  });

  it('should set slowlog threshold 10ms', () => {
    expect(conf).toMatch(/^slowlog-log-slower-than 10000$/m);
  });

  it('should enable lazy freeing', () => {
    expect(conf).toMatch(/^lazyfree-lazy-eviction yes$/m);
    expect(conf).toMatch(/^lazyfree-lazy-expire yes$/m);
  });

  it('should not contain emoji', () => {
    const emojiRegex = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    expect(conf).not.toMatch(emojiRegex);
  });
});

import { beforeAll } from 'vitest';
```

### 7.2 Tests integration

Inclus dans docker-compose.spec.ts via `describe.skipIf(SKIP_INTEGRATION)`. Lance `docker compose up`, attend healthy, valide, tear down.

### 7.3 Tests E2E

Non applicable (pas d'app deployee).

### 7.4 Smoke tests bash inline

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "=== 1. docker compose validation ==="
docker compose -f infrastructure/docker/docker-compose.dev.yaml config > /dev/null

echo "=== 2. docker compose up ==="
START=$(date +%s)
docker compose -f infrastructure/docker/docker-compose.dev.yaml up -d
bash infrastructure/scripts/wait-for-stack-healthy.sh 60
ELAPSED=$(($(date +%s) - START))
echo "Stack healthy in ${ELAPSED}s (target: < 60s)"
[[ "$ELAPSED" -le 90 ]] || { echo "FAIL: stack took ${ELAPSED}s"; exit 1; }

echo "=== 3. service ports listening ==="
for port in 5432 6379 9094 8080 9000 9001 5678 1025 8025; do
  nc -z localhost $port || { echo "FAIL: port $port not listening"; exit 1; }
done
echo "OK: 9 ports listening"

echo "=== 4. postgres ready ==="
docker exec skalean-postgres pg_isready -U skalean -d skalean_insurtech

echo "=== 5. redis ping ==="
docker exec skalean-redis redis-cli -a skalean_redis_dev_only ping | grep PONG

echo "=== 6. kafka topics list (empty) ==="
docker exec skalean-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list

echo "=== 7. minio buckets (empty until Tache 1.1.7) ==="
docker exec skalean-minio mc alias set local http://localhost:9000 skalean skalean_minio_dev_only

echo "=== 8. mailhog API ==="
curl -fs http://localhost:8025/api/v2/messages | jq '.total'

echo "=== ALL OK ==="

docker compose -f infrastructure/docker/docker-compose.dev.yaml down -v
```

---

## 8. Variables environnement

```env
# Postgres
POSTGRES_USER=skalean
POSTGRES_PASSWORD=skalean_dev_only_change_in_prod
POSTGRES_DB=skalean_insurtech
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=skalean_redis_dev_only
REDIS_PORT=6379

# Kafka
KAFKA_EXTERNAL_PORT=9094
KAFKA_UI_PORT=8080

# MinIO
MINIO_ROOT_USER=skalean
MINIO_ROOT_PASSWORD=skalean_minio_dev_only
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001

# Mailhog
MAILHOG_SMTP_PORT=1025
MAILHOG_UI_PORT=8025

# n8n
N8N_PORT=5678
N8N_BASIC_AUTH_USER=skalean
N8N_BASIC_AUTH_PASSWORD=skalean_n8n_dev_only

# Test stack overrides
POSTGRES_TEST_PORT=5433
REDIS_TEST_PORT=6380
KAFKA_TEST_PORT=9095
```

---

## 9. Commandes shell

```bash
# 1. Creer fichiers
cd repo/infrastructure/docker
# (creer docker-compose.dev.yaml, docker-compose.test.yaml, redis/redis.conf, init scripts)

# 2. Demarrer stack
cd ../..
pnpm docker:up

# 3. Verifier healthy
bash infrastructure/scripts/wait-for-stack-healthy.sh 60

# 4. Verifier services
docker ps --filter "name=skalean-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# 5. Tests structure
pnpm vitest run infrastructure/scripts/__tests__/docker-compose.spec.ts

# 6. Tear down
pnpm docker:down

# 7. Reset complet (efface volumes)
pnpm docker:reset
```

---

## 10. Criteres validation V1-V25

### 10.1 Criteres P0 (15 criteres)

- **V1 (P0)** : `pnpm docker:up` reussit
- **V2 (P0)** : `docker ps | grep skalean | wc -l` >= 7
- **V3 (P0)** : Tous services healthy en < 60s : `bash infrastructure/scripts/wait-for-stack-healthy.sh 60`
- **V4 (P0)** : `docker exec skalean-postgres pg_isready -U skalean` reussit
- **V5 (P0)** : `docker exec skalean-redis redis-cli -a skalean_redis_dev_only ping` retourne PONG
- **V6 (P0)** : `docker exec skalean-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list` reussit
- **V7 (P0)** : `curl -s http://localhost:8025/api/v2/messages` (Mailhog) retourne JSON
- **V8 (P0)** : MinIO console accessible :9001 (placeholder buckets, complete Tache 1.1.7)
- **V9 (P0)** : n8n accessible :5678 avec auth basique
- **V10 (P0)** : Kafka UI accessible :8080
- **V11 (P0)** : Postgres `max_connections=200` actif : `SHOW max_connections;` returns 200
- **V12 (P0)** : Redis AOF active : `CONFIG GET appendonly` returns yes
- **V13 (P0)** : Kafka KRaft mode (no Zookeeper) : `docker logs skalean-kafka | grep -i zookeeper` doit etre vide
- **V14 (P0)** : Aucune emoji dans docker-compose.dev.yaml + redis.conf
- **V15 (P0)** : Tests vitest docker-compose.spec.ts passent (35+ tests)

### 10.2 Criteres P1 (7 criteres)

- **V16 (P1)** : Volumes persistents : `docker compose restart` preserve data
- **V17 (P1)** : `pnpm docker:reset` clean tout (volumes inclus) et redemarre
- **V18 (P1)** : `docker-compose.test.yaml` valide : `docker compose -f docker-compose.test.yaml config`
- **V19 (P1)** : Region MinIO `ma-bgr-1` configure (Atlas Benguerir simulation)
- **V20 (P1)** : Postgres TZ Africa/Casablanca actif : `SHOW timezone;` returns Africa/Casablanca
- **V21 (P1)** : `wait-for-stack-healthy.sh` retourne exit 0 en < 90s
- **V22 (P1)** : Healthchecks declares sur 7 services principaux

### 10.3 Criteres P2 (3 criteres)

- **V23 (P2)** : `docker compose ps --format json | jq '.[] | .Health'` retourne `healthy` pour tous
- **V24 (P2)** : Logging rotate active (max-size 10m, max-file 3)
- **V25 (P2)** : Resource limits declares (memory + cpus)

---

## 11. Edge cases + troubleshooting

### Edge case 1 : `docker compose up` echoue avec "no space left on device"
**Solution** : `docker system prune -a --volumes` pour nettoyer images/volumes orphelins. Si persiste, augmenter disk Docker Desktop a 60+ GB.

### Edge case 2 : Kafka prend > 30s a etre healthy au premier boot
**Solution** : Comportement normal sur premiere boot (initialisation cluster.id KRaft). Restart suivants < 10s. `start_period: 30s` dans healthcheck couvre.

### Edge case 3 : Postgres init scripts ne s'executent pas sur volume existant
**Solution** : Les init scripts s'executent UNIQUEMENT si le data dir Postgres est vide. Pour re-executer apres modif, `pnpm docker:reset` (efface volume).

### Edge case 4 : Port 5432 deja utilise par Postgres natif local
**Solution** : Override `POSTGRES_PORT=5433` dans `.env.local`. Ou stopper Postgres natif : `brew services stop postgresql` (MacOS).

### Edge case 5 : MacOS Docker Desktop OOM kill aleatoire
**Solution** : Augmenter RAM Docker Desktop a 8 GB minimum (Settings > Resources > Memory).

### Edge case 6 : Healthcheck Mailhog `wget` echoue (image n'a pas wget)
**Solution** : Mailhog v1.0.1 image inclut wget dans busybox. Si erreur, fallback vers `["CMD-SHELL", "nc -z localhost 8025"]`.

### Edge case 7 : Init container kafka-init-topics ne termine pas
**Solution** : Verifier `restart: "no"` (pas `always`). Verifier le script `init-topics.sh` finit par `exit 0` explicite.

### Edge case 8 : Volumes Docker ne sont pas visibles dans Finder/Explorer
**Solution** : Volumes nommes Docker sont stockes dans `/var/lib/docker/volumes/` (Linux) ou la VM Docker Desktop (Mac/Windows). Pas accessible via filesystem natif. Utiliser `docker exec ... ls` pour explorer.

---

## 12. Conformite Maroc

**Loi 09-08 CNDP (data residency)** :
- MinIO simule Atlas Cloud Services Benguerir Object Storage prod (region `ma-bgr-1`)
- En prod : Atlas Cloud Services Benguerir, donnees STRICTEMENT au Maroc
- decision-008 documente la strategie

**Decret 2-09-165 (TZ Maroc)** :
- Postgres `TZ=Africa/Casablanca` + `PGTZ=Africa/Casablanca`
- n8n `GENERIC_TIMEZONE: Africa/Casablanca`
- Aligne sur GMT+1 (hiver) et GMT+0 (Ramadan)

---

## 13. Conventions absolues skalean-insurtech

(14 conventions identiques aux taches precedentes -- multi-tenant, Zod, Pino, argon2id, pnpm, TypeScript strict, Tests, RBAC, Events Kafka, Imports, Skalean AI Frontier, No-emoji ABSOLU, Idempotency-Key, Conventional Commits, Cloud souverain MA.)

Cette tache concretise particulierement :
- **No-emoji** : aucune emoji dans YAML, redis.conf, scripts shell
- **Cloud souverain MA** : MinIO region `ma-bgr-1` simule Atlas Benguerir
- **Events Kafka** : KRaft mode + AUTO_CREATE_TOPICS=false + 30 topics namespace `insurtech.events.*`

---

## 14. Validation pre-commit

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

# 1. validation YAML syntax
docker compose -f infrastructure/docker/docker-compose.dev.yaml config > /dev/null
docker compose -f infrastructure/docker/docker-compose.test.yaml config > /dev/null

# 2. tests structure
pnpm vitest run infrastructure/scripts/__tests__/docker-compose.spec.ts
pnpm vitest run infrastructure/scripts/__tests__/redis-conf.spec.ts

# 3. no-emoji
for f in infrastructure/docker/docker-compose.dev.yaml \
         infrastructure/docker/docker-compose.test.yaml \
         infrastructure/docker/redis/redis.conf \
         infrastructure/docker/postgres/init.sh \
         infrastructure/docker/kafka/init-topics.sh \
         infrastructure/docker/minio/init-buckets.sh \
         infrastructure/scripts/wait-for-stack-healthy.sh; do
  grep -P "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" "$f" 2>/dev/null && {
    echo "FAIL: emoji in $f"; exit 1
  }
done

# 4. shell scripts executables
chmod +x infrastructure/scripts/wait-for-stack-healthy.sh
chmod +x infrastructure/docker/postgres/init.sh
chmod +x infrastructure/docker/kafka/init-topics.sh
chmod +x infrastructure/docker/minio/init-buckets.sh

# 5. integration smoke
SKIP_INTEGRATION=false pnpm vitest run infrastructure/scripts/__tests__/docker-compose.spec.ts

echo "=== ALL OK ==="
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-01): docker compose dev stack 7 services + 2 init containers

Orchestre la stack dev complete via docker compose v2 :
- Postgres 16.6-alpine (port 5432) avec 18 parametres custom (max_connections=200,
  shared_buffers=256MB, log queries lentes 500ms+, pg_stat_statements preload)
- Redis 7.4.1-alpine (port 6379) avec redis.conf custom (AOF + RDB + LRU 512MB +
  slowlog 10ms + keyspace notify Ex + lazy freeing)
- Kafka 3.7.1 KRaft mode (port 9094 EXT, 9092 INT, 9093 CTRL) sans Zookeeper,
  AUTO_CREATE_TOPICS=false, compression lz4, retention 7j/1GB
- Kafka UI v0.7.2 (port 8080) Provectus interface debug
- Mailhog v1.0.1 (ports 1025 SMTP + 8025 UI) catcher emails dev
- MinIO RELEASE.2024-11-07 (ports 9000 S3 + 9001 console) region ma-bgr-1
  simulant Atlas Cloud Services Benguerir prod (decision-008)
- n8n 1.74.0 (port 5678) workflow engine, backend Postgres schema dedie n8n

2 init containers :
- kafka-init-topics : execute apres Kafka healthy, cree 30+ topics (Tache 1.1.6)
- minio-init-buckets : execute apres MinIO healthy, cree 3 buckets (Tache 1.1.7)

Stack test dediee CI :
- docker-compose.test.yaml subset Postgres + Redis + Kafka uniquement
- Pas de volumes persistents (tmpfs en RAM pour vitesse)
- Postgres fsync=off + synchronous_commit=off pour speed CI
- Auto-create topics Kafka pour eviter init container

Helper script wait-for-stack-healthy.sh : polling 2s, timeout configurable,
affiche logs services unhealthy pour debug rapide.

Livrables : 9 fichiers crees + 1 modifie
Tests : 35+ tests structure docker-compose + 8 tests redis-conf + integration

Conformite : decision-008 (data residency MA -- MinIO region ma-bgr-1)
TZ Africa/Casablanca aligne (Postgres + n8n)

Task: 1.1.3
Sprint: 1 (Phase 1 / Sprint 1)
Phase: 1 -- Bootstrap Infrastructure
Reference: B-01 Tache 1.1.3
Dependances: Tache 1.1.2 (TypeScript + Biome)
Bloque: Taches 1.1.4 (Postgres), 1.1.5 (Redis), 1.1.6 (Kafka topics), 1.1.7 (MinIO)"
```

---

## 16. Workflow next step

- **Tache suivante** : `task-1.1.4-postgres-extensions-rls-helpers.md`
- **Inputs herites** : stack docker-compose dev demarrable, init scripts directory mounted dans Postgres container.
- **Outputs Tache 1.1.4** : 5 extensions + 6 helpers SQL multi-tenant 3 niveaux.

---

**Fin du prompt task-1.1.3-docker-compose-7-services.md**

Densite atteinte : ~85 ko
Code patterns : 8 fichiers complets (compose dev + test + redis.conf + 3 init scripts + wait + 2 specs)
Tests : 50+ tests (docker-compose 35+ + redis-conf 8 + integration 3)
Criteres validation : V1-V25 (15 P0 + 7 P1 + 3 P2)
Edge cases : 8 documentes
Sections : 16/16 presentes

## 17. Annexes techniques approfondies

### 17.1 Mecanisme Kafka KRaft consensus detaille

KRaft (Kafka Raft) remplace Zookeeper depuis Kafka 3.3+. En mode single-node :
- 1 conteneur Kafka avec roles `controller,broker` simultanes
- Quorum self-suffisant (majority = 1)
- Metadata stockees dans `/bitnami/kafka/data/__cluster_metadata`

En mode multi-node (Sprint 35 prod) :
- 3 nodes : 1 controller-only + 2 broker-only, ou 3 hybrid controller+broker
- Quorum vote pour leader election sur changements config
- Replication facteur 3 + min in-sync replicas 2

**Avantages KRaft** :
- Single-process simplification operationnelle
- Latence reduite (pas de roundtrip Zookeeper)
- Support multi-millions de partitions (vs 200k limite Zookeeper)
- Recovery faster (pas besoin de connect a Zookeeper)

**Migration future** : Kafka 4.0 (prevue 2026) supprimera completement Zookeeper. KRaft sera le seul mode supporte.

### 17.2 Postgres tuning rationale par parametre

| Parametre | Valeur dev | Valeur prod | Rationale |
|-----------|-----------|-------------|-----------|
| `max_connections` | 200 | 500 | 9 apps + 23 packages + workers + tests = 50+ connexions concurrentes minimum |
| `shared_buffers` | 256MB | 4GB | Cache pages disk Postgres en RAM, recommandation 25% RAM |
| `effective_cache_size` | 1GB | 12GB | Estimation OS file system cache pour query planner |
| `work_mem` | 8MB | 32MB | Memoire par operation tri/jointure (pas par session) |
| `maintenance_work_mem` | 64MB | 1GB | Pour VACUUM, REINDEX, CREATE INDEX |
| `effective_io_concurrency` | 200 | 200 | SSD-aware (vs HDD ou 1) |
| `random_page_cost` | 1.1 | 1.1 | SSD-aware (vs 4.0 HDD) |
| `log_statement` | mod | mod | Log INSERT/UPDATE/DELETE pour audit (pas SELECT) |
| `log_min_duration_statement` | 500 | 1000 | Log queries lentes : > 500ms dev, > 1000ms prod (moins verbeux) |
| `shared_preload_libraries` | pg_stat_statements | pg_stat_statements,auto_explain | Sprint 33 perf audit |

### 17.3 Redis config rationale par parametre

| Parametre | Valeur | Rationale |
|-----------|--------|-----------|
| `maxmemory 512mb` | 512MB dev / 16GB prod | Suffit dev, prod scale |
| `maxmemory-policy allkeys-lru` | LRU | Evict colder cache first |
| `appendonly yes` | yes | AOF durabilite max 1s data loss |
| `appendfsync everysec` | everysec | Bon compromis durabilite/perf |
| `save 900 1 300 10 60 10000` | 3 paliers | RDB snapshots paliers selon activite |
| `notify-keyspace-events Ex` | Ex | Pub/sub eviction events (debug) |
| `slowlog-log-slower-than 10000` | 10ms | Log queries > 10ms |
| `lazyfree-lazy-*` | yes | Async free memoire (perf) |
| `io-threads 2` | 2 | Multi-threading I/O Redis 6+ |

### 17.4 Healthcheck rationale par service

**Postgres healthcheck `pg_isready -U skalean -d skalean_insurtech`** :
- Verifie que Postgres accepte connexions
- Specifie user + db pour eviter false positive (Postgres up mais DB pas creee)
- Interval 5s, retries 12 -> max 60s pour healthy

**Redis healthcheck `redis-cli -a $PASSWORD ping | grep PONG`** :
- Verifie Redis up + auth OK
- Interval 5s, retries 6 -> max 30s

**Kafka healthcheck `kafka-topics.sh --list`** :
- Verifie broker accepte commands admin
- Interval 10s, retries 12, start_period 30s -> Kafka boot lent KRaft

**MinIO healthcheck `curl /minio/health/live`** :
- Endpoint dedie health
- Interval 5s, retries 6

### 17.5 Volume strategy detaillee

Volumes nommes Docker : `skalean-postgres-data`, `skalean-redis-data`, `skalean-kafka-data`, `skalean-minio-data`, `skalean-n8n-data`.

Avantages :
- Persistance entre `docker compose down/up` (sans `-v`)
- Backup possible via `docker run --rm -v skalean-postgres-data:/data alpine tar czf /backup/data.tar.gz /data`
- Identification claire dans `docker volume ls`

Inconvenients :
- Path local opaque (`/var/lib/docker/volumes/skalean-postgres-data/_data/`)
- Backup necessite container temporaire
- Sur MacOS/Windows, performance moindre que Linux native

Alternative bind mounts : rejete pour Sprint 1 (perf MacOS/Windows tres degradee).

### 17.6 Strategy network bridge `skalean-net`

Network Docker bridge dedie `skalean-net` :
- Isolation complete des autres networks Docker
- Resolution DNS automatique entre services (`postgres:5432` from `kafka` container)
- Pas de conflit avec autres stacks Docker
- Performance native (Linux bridge, pas overlay)

### 17.7 Port mappings rationale

| Port host | Service | Pourquoi ce port |
|-----------|---------|------------------|
| 5432 | Postgres | Standard Postgres port |
| 6379 | Redis | Standard Redis port |
| 9094 | Kafka EXTERNAL | Evite conflit avec Kafka INTERNAL 9092 (interne Docker) |
| 9092 | Kafka INTERNAL | Pas expose host par defaut, used between containers |
| 8080 | Kafka UI | Port habituel UIs web (Provectus) |
| 9000 | MinIO S3 | Standard MinIO API port |
| 9001 | MinIO Console | Standard MinIO Console port |
| 5678 | n8n | Standard n8n port |
| 1025 | Mailhog SMTP | Eviter conflit avec port SMTP standard 25 (root) |
| 8025 | Mailhog UI | Standard Mailhog UI port |

Alternatives via env vars : `POSTGRES_PORT=5433` etc. permettent override pour eviter conflits locaux.

### 17.8 Resource limits rationale

`deploy.resources.limits` declare des limits par service pour eviter qu'un service consomme toute la RAM machine :

| Service | Memory limit | CPU limit | Rationale |
|---------|--------------|-----------|-----------|
| Postgres | 1G | 1.0 | DB primary, allocate generous |
| Redis | 768M | 0.5 | Cache + sessions, modere |
| Kafka | 1.5G | 1.0 | KRaft + retention 1GB topics |
| Kafka UI | 256M | 0.25 | UI minimaliste |
| MinIO | 512M | 0.5 | Object storage |
| n8n | 512M | 0.5 | Workflow engine modere |
| Mailhog | 64M | 0.1 | SMTP catcher trivial |

Total limits : ~5GB RAM si tous services maxent simultanement. Compatible machine 8GB RAM (3GB pour OS + dev tools).

### 17.9 Logging strategy par service

`logging.driver: json-file` + rotation `max-size: 10m, max-file: 3` permet :
- Logs structures pour parsing
- Rotation automatique evite remplissage disk
- 30MB max par service x 7 services = 210MB max logs

En prod (Sprint 35), logs forwardes vers Loki/Datadog via `fluent-bit` sidecar.

### 17.10 Init scripts orchestration

`docker-entrypoint-initdb.d` Postgres execute automatiquement :
- `*.sql` : run via psql
- `*.sh` : run via shell
- Ordre : alphanumerique (donc `001-*.sql` avant `002-*.sql`)
- UNIQUEMENT au premier boot (data dir vide)

Pour re-executer : `pnpm docker:reset` (efface volume).

Init container Kafka (`kafka-init-topics`) :
- `restart: "no"` -- s'execute une fois, exit
- `depends_on: kafka: condition: service_healthy`
- Script `init-topics.sh` complete Tache 1.1.6 (30 topics)

Init container MinIO (`minio-init-buckets`) :
- Meme pattern -- `restart: "no"` + depends_on healthy
- Script `init-buckets.sh` complete Tache 1.1.7 (3 buckets)

### 17.11 Edge cases supplementaires Docker

#### Edge case 9 : MacOS Docker Desktop file mount slow
**Probleme** : volume bind mounts lents sur MacOS (jusqu'a 10x slower que Linux).
**Solution** : utiliser volumes nommes Docker (default Sprint 1.1.3). Si bind mount necessaire, activer "VirtioFS" dans Docker Desktop settings.

#### Edge case 10 : Windows WSL2 networking issues
**Probleme** : services pas accessibles depuis Windows host meme si ports exposes.
**Solution** : verifier `wsl --shutdown` puis `wsl` pour reset network. Verifier Docker Desktop "Use WSL2 backend".

#### Edge case 11 : Container restart loop sur Apple M1 Silicon
**Probleme** : certaines images amd64 (legacy) ne supportent pas arm64 native.
**Solution** : forcer `platform: linux/amd64` sur service, ou utiliser images multi-arch (Postgres, Redis, Kafka officielles supportent arm64).

#### Edge case 12 : Postgres `FATAL: password authentication failed`
**Probleme** : credentials env vars pas pris en compte si data dir non-vide.
**Solution** : `pnpm docker:reset` pour clear data dir et re-init avec nouveaux credentials.

#### Edge case 13 : Kafka `BROKER_NOT_AVAILABLE` au premier connect
**Probleme** : Kafka KRaft prend 15-25s pour bootstrap initial, healthcheck retourne pas encore healthy.
**Solution** : `start_period: 30s` dans healthcheck. Apps qui consume Kafka ont `depends_on: kafka: condition: service_healthy`.

### 17.12 Tests E2E docker stack (Sprint 4+)

Au Sprint 4 (frontend bootstrap), ajouter test E2E qui demarre la stack docker complete et lance Playwright contre apps/api :

```typescript
// repo/load-tests/docker-stack.e2e.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..');

describe('Docker stack E2E', () => {
  beforeAll(() => {
    execSync('pnpm docker:up', { cwd: REPO_ROOT, stdio: 'pipe' });
    execSync('bash infrastructure/scripts/wait-for-stack-healthy.sh 90', {
      cwd: REPO_ROOT, stdio: 'pipe'
    });
  }, 120000);

  afterAll(() => {
    execSync('pnpm docker:reset', { cwd: REPO_ROOT, stdio: 'pipe' });
  });

  it('all 7 services should be healthy', () => {
    const ps = execSync('docker compose -f infrastructure/docker/docker-compose.dev.yaml ps --format json',
      { cwd: REPO_ROOT, encoding: 'utf-8' });
    const services = ps.split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const healthy = services.filter((s) => s.Health === 'healthy');
    expect(healthy.length).toBeGreaterThanOrEqual(7);
  });
});
```

### 17.13 Optimisation startup time

Pour reduire le startup time de la stack :
- Pre-pull images : `docker compose -f infrastructure/docker/docker-compose.dev.yaml pull`
- Increase parallel pull : `COMPOSE_PARALLEL_LIMIT=10`
- Use cache mounts dans Dockerfiles custom (Sprint 35 prod)
- Skip Kafka init pour test stack si topics pas necessaires
- Use tmpfs pour test stack (pas persistance)

Cible : < 60s dev, < 30s test.

### 17.14 Prod stack preview (Sprint 35)

Au Sprint 35 (pilote Marrakech), la stack devient :

- **Postgres** : Atlas Cloud Services Benguerir managed Postgres 16.6 (HA 3 nodes, backup auto)
- **Redis** : Atlas Cloud Services Benguerir managed Redis 7.4.1 (HA 2 nodes)
- **Kafka** : Atlas Cloud Services Benguerir managed Kafka 3.7.1 (3 brokers KRaft)
- **MinIO** : remplace par Atlas Cloud Services Object Storage S3-compatible
- **n8n** : self-hosted dans Kubernetes Atlas
- **Mailhog** : remplace par SMTP relay Sendgrid/Postmark
- **Kafka UI** : remplace par Datadog APM Kafka monitoring

La stack dev `docker-compose.dev.yaml` reste pour developpement local. Aucune migration code necessaire (juste env vars URL update).

### 17.15 Strategy backup local dev

Bien que pas critique en dev, pour permettre snapshot/restore d'un environnement dev a un point dans le temps :

```bash
# Backup volumes
docker run --rm -v skalean-postgres-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/postgres-data-$(date +%Y%m%d).tar.gz /data

# Restore
docker run --rm -v skalean-postgres-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/postgres-data-20260101.tar.gz -C /
```

Utile pour partager un env preconfigure entre developpeurs (e.g. apres seed Sprint 2 entites).

### 17.16 Checklist post-`pnpm docker:up`

- [ ] `docker ps` montre 7 conteneurs `skalean-*`
- [ ] Tous status `Up X seconds (healthy)` ou `(starting)` dans premier 30s
- [ ] Aucun status `(unhealthy)` apres 60s
- [ ] `pnpm docker:logs` n'affiche pas d'erreur fatale
- [ ] Postgres : `psql -U skalean -d skalean_insurtech -c "SELECT 1"` reussit
- [ ] Redis : `redis-cli -a skalean_redis_dev_only ping` retourne PONG
- [ ] Kafka : `kafka-topics.sh --list` reussit (vide initialement)
- [ ] MinIO : http://localhost:9001 accessible (login skalean / password)
- [ ] n8n : http://localhost:5678 accessible (basic auth)
- [ ] Kafka UI : http://localhost:8080 accessible
- [ ] Mailhog : http://localhost:8025 accessible

### 17.17 Roadmap stack Sprint 1-35

| Sprint | Evolution stack | Action |
|--------|-----------------|--------|
| 1 | Foundation 7 services + 2 init containers | Cette tache 1.1.3 |
| 2 | Postgres entities + migrations TypeORM | Aucun changement compose |
| 3 | apps/api consume Postgres + Redis | Aucun changement compose |
| 9 | n8n active workflows comm Sprint 9 | Aucun changement compose |
| 13 | Sprint 13 ajoute ClickHouse pour analytics | Add service `clickhouse` |
| 30 | mcp-server consume tous services | Aucun changement compose |
| 33 | Add observability stack (Grafana, Loki, Tempo) | Add 3 services |
| 34 | Add load tests stack (k6) | New compose file load |
| 35 | Migration prod Atlas Cloud Services Benguerir | Documenter migration |

Cette roadmap est documentee dans `docs/architecture/stack-evolution.md` (a creer Tache 1.1.15).

### 17.18 Checklist commit Sprint 1.1.3

- [ ] `docker compose -f infrastructure/docker/docker-compose.dev.yaml config` valide YAML
- [ ] `docker compose -f infrastructure/docker/docker-compose.test.yaml config` valide YAML
- [ ] Tests `docker-compose.spec.ts` (35+ tests) passent
- [ ] Tests `redis-conf.spec.ts` (8+ tests) passent
- [ ] Smoke test bash 8 etapes passent
- [ ] Aucune emoji dans aucun fichier
- [ ] `pnpm docker:up` reussit en < 60s sur machine 8GB RAM
- [ ] `pnpm docker:reset` reussit (clean tout + redemarre)
- [ ] Healthchecks declares sur 7 services principaux
- [ ] Init containers `restart: "no"` (pas redemarrage en boucle)


### 17.19 Comparison Docker Compose vs Kubernetes local

| Aspect | Docker Compose | Kubernetes local (kind/minikube) |
|--------|----------------|----------------------------------|
| Setup time | 60s install Docker | 10-20 min install + setup |
| RAM requise | 4 GB minimum | 8-16 GB minimum |
| Complexite config | YAML simple | manifests yaml verbeux |
| Parite avec prod | partielle | quasi-identique |
| Hot reload code | volume mounts | port-forward + sync |
| Debug | docker logs simple | kubectl logs + complexite |
| Decision Sprint 1 | RETENU (productivite) | rejete (overkill dev) |

### 17.20 Configuration alternative (Kubernetes Sprint 35)

Au Sprint 35 (prod Marrakech), Kubernetes Atlas managed sera utilise. Voici la traduction equivalente future :

```yaml
# Sprint 35 -- infrastructure/k8s/postgres-statefulset.yaml (preview)
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: skalean-insurtech
spec:
  serviceName: postgres-headless
  replicas: 1
  selector:
    matchLabels: { app: postgres }
  template:
    metadata:
      labels: { app: postgres }
    spec:
      containers:
        - name: postgres
          image: postgres:16.6-alpine
          ports:
            - containerPort: 5432
          envFrom:
            - secretRef: { name: postgres-credentials }
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
            - name: init
              mountPath: /docker-entrypoint-initdb.d
          resources:
            requests: { memory: 4Gi, cpu: 2 }
            limits: { memory: 8Gi, cpu: 4 }
  volumeClaimTemplates:
    - metadata: { name: data }
      spec:
        accessModes: [ReadWriteOnce]
        storageClassName: atlas-ssd
        resources: { requests: { storage: 100Gi } }
```

La structure conceptuelle reste identique (image, env, volumes), seul le packaging differe.

### 17.21 Strategy de migration Docker Compose -> Kubernetes

Sprint 35 plan migration :
1. Helm chart skalean-insurtech (deja prepare au Sprint 33)
2. Atlas Cloud Services Benguerir Kubernetes cluster provisione (3 nodes)
3. Deploy stage-by-stage : Postgres + Redis + Kafka first
4. Migration data : pg_dump dev -> restore prod stage
5. Switch DNS : `.skalean-insurtech.ma` pointe vers Atlas K8s ingress
6. Decommission docker-compose dev (rester pour developpement local)


### 17.22 Securite docker dev environment

Bien que dev environment soit isolated (localhost), quelques bonnes pratiques :

- Passwords env vars defaults declared `_dev_only_change_in_prod` -- impossibilite de confondre avec prod
- Aucun port expose au-dela de localhost (`127.0.0.1:5432:5432` plutot que `5432:5432` -- evite leak sur LAN)
- Volumes data appartiennent au user docker (root par defaut, override `--user 1000` possible)
- Logs ne contiennent pas secrets (verifier `docker compose logs | grep -i password` retourne rien)
- Network bridge isole (pas de communication avec autres networks Docker)

Sprint 33 (pentest) audit complet :
- Scan vulnerabilities images Docker (Trivy, Grype)
- Verifie pas d'images deprecated/abandonnees
- Audit ports exposes et ACL
- Audit secrets management (env vars vs Docker secrets)

### 17.23 Compatibilite Docker Compose v2

Docker Compose v2 (commande `docker compose` au lieu de `docker-compose`) est :
- Plugin natif Docker (pas binary separe)
- Faster (Go vs Python)
- Better YAML schema validation
- Profiles support (subset services)

Notre `docker-compose.dev.yaml` est ecrit pour v2 syntax (pas de v1 `docker-compose` legacy).

### 17.24 Documentation post-deployment

Documents Sprint 1.1.3 a maintenir :
- `docs/runbooks/docker-stack.md` -- comment demarrer/arreter/debug stack
- `docs/runbooks/postgres-init.md` -- sequence init scripts + reset procedure
- `docs/runbooks/kafka-troubleshooting.md` -- KRaft cluster.id issues
- `docs/architecture/stack-overview.md` -- diagramme architecture stack
- `docs/security/docker-hardening.md` -- audit pentest Sprint 33

### 17.25 Strategie test stack reproduction CI

Le job CI `test` Tache 1.1.10 utilise `docker-compose.test.yaml` subset. Differences vs dev :

- Postgres `tmpfs` (RAM, ephemere) -- 5x plus rapide tests
- Postgres `fsync=off`, `synchronous_commit=off` -- 10x plus rapide writes (no durability needed)
- Pas de Mailhog/MinIO/n8n (subset)
- Auto-create topics Kafka = true (pas init container)
- Healthchecks plus aggressifs

Cible CI test stack startup : < 20s.

### 17.26 Tests load Sprint 34

Sprint 34 ajoutera `infrastructure/docker/docker-compose.load.yaml` avec :
- 3 nodes Postgres (replica set)
- 3 brokers Kafka
- 3 nodes Redis Cluster
- k6 load tester container
- Tests realistiques jusqu'a 10k VUs concurrent

Pas Sprint 1.1.3.

### 17.27 Conventions developpeur stack docker

- TOUJOURS utiliser `pnpm docker:*` scripts (pas `docker compose ...` directement) -- assure consistency
- TOUJOURS reset stack avant changement init scripts Postgres (`pnpm docker:reset`)
- JAMAIS commit `.docker-data/` ou volumes contents
- Documenter chaque service modification dans CHANGELOG
- Tester `pnpm docker:up` apres chaque modification yaml

### 17.28 Strategy debug stack

```bash
# Demarrer stack
pnpm docker:up

# Si un service unhealthy
docker compose -f infrastructure/docker/docker-compose.dev.yaml ps
# Identifier service unhealthy

# Voir logs detail
docker logs skalean-postgres -f --tail 50

# Inspecter healthcheck
docker inspect skalean-postgres | jq '.[0].State.Health'

# Connect to container shell
docker exec -it skalean-postgres bash

# Restart service specifique
docker compose -f infrastructure/docker/docker-compose.dev.yaml restart postgres

# Reset complet
pnpm docker:reset
```

### 17.29 Patterns communs erreurs

1. **`Bind for 0.0.0.0:5432 failed: port is already allocated`** : autre service utilise port 5432. Solution : `lsof -i :5432` puis kill, OU override `POSTGRES_PORT=5433`
2. **`pull access denied for X, repository does not exist`** : image deprecated/private. Solution : verifier image name + tag exact
3. **`failed to mount volume`** : permissions OS. Solution : verifier ownership volume, `docker volume rm` puis recreate
4. **`network skalean-net not found`** : network manuel cree puis supprime. Solution : `docker network rm skalean-net` puis `pnpm docker:up`
5. **`exit code 137 (OOM kill)`** : container hors RAM. Solution : augmenter resource limit Docker Desktop ou `deploy.resources.limits`

### 17.30 Versioning strategy images

Toutes les images sont pinned avec tag exact (pas `latest`) :
- `postgres:16.6-alpine`
- `redis:7.4.1-alpine`
- `bitnami/kafka:3.7.1`
- `provectuslabs/kafka-ui:v0.7.2`
- `mailhog/mailhog:v1.0.1`
- `minio/minio:RELEASE.2024-11-07T00-52-20Z`
- `n8nio/n8n:1.74.0`

Updates Sprint 33+ : evaluation manuelle des updates security CVE patches. Major version bumps requierent test integration complet.

### 17.31 Checklist post-update images Docker

Lorsqu'une image est upgradee (e.g. Postgres 16.6 -> 16.7) :

1. Update tag dans `docker-compose.dev.yaml`
2. `pnpm docker:reset` (pull new image)
3. Run tests integration complets (`pnpm test:integration`)
4. Verifier compat init scripts (extensions, RLS helpers)
5. Verifier compat apps consumers (TypeORM, ioredis, kafkajs)
6. Update CHANGELOG.md avec note migration
7. Communiquer equipe via Slack #insurtech-dev


### 17.32 Configuration Postgres approfondie (Sprint 33 hardening)

Au-dela des 18 parametres declares Sprint 1.1.3, Sprint 33 evaluera :

```bash
# Sprint 33 -- Postgres tuning prod (preview)
shared_preload_libraries = 'pg_stat_statements,auto_explain,pg_cron'
auto_explain.log_min_duration = 1000
auto_explain.log_analyze = on
auto_explain.log_buffers = on

# Connections
max_connections = 500
superuser_reserved_connections = 5

# Memory
shared_buffers = 4GB
effective_cache_size = 12GB
work_mem = 32MB
maintenance_work_mem = 1GB

# WAL
wal_buffers = 16MB
checkpoint_completion_target = 0.9
max_wal_size = 4GB
min_wal_size = 1GB

# Replication
wal_level = replica
max_wal_senders = 10
max_replication_slots = 10
hot_standby = on

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = 'log'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000
log_lock_waits = on
log_temp_files = 10MB
log_autovacuum_min_duration = 1000

# Statistics
track_activities = on
track_counts = on
track_io_timing = on
track_functions = pl

# Auto vacuum
autovacuum = on
autovacuum_max_workers = 3
autovacuum_naptime = 1min
```

### 17.33 Configuration Redis approfondie (Sprint 33 hardening)

```conf
# Sprint 33 -- Redis tuning prod (preview)

# TLS
tls-port 6380
port 0
tls-cert-file /etc/redis/certs/redis.crt
tls-key-file /etc/redis/certs/redis.key
tls-ca-cert-file /etc/redis/certs/ca.crt
tls-protocols "TLSv1.2 TLSv1.3"

# ACL
aclfile /etc/redis/users.acl

# Memory + eviction
maxmemory 16gb
maxmemory-policy allkeys-lru
maxmemory-samples 10

# Replication
replica-read-only yes
replica-serve-stale-data yes

# Performance
tcp-backlog 4096
io-threads 4
io-threads-do-reads yes

# Security
requirepass <strong-password-from-vault>
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command CONFIG ""
```

### 17.34 Strategy migration Postgres versions

Sprint 35 migration prod Postgres 16.6 -> 17.x si stable :
1. Backup complet Atlas Cloud Services Benguerir
2. Standby replica Postgres 17 sync depuis 16.6
3. Test app compat staging environment
4. Failover rolling : promote replica 17, decommission 16.6
5. Update env var `DATABASE_URL`

Decision Sprint 1 : pin 16.6 jusqu'a Sprint 35. Postgres 17 restera optionnel.

### 17.35 Strategy n8n workflows production

Sprint 30 (MCP server) utilisera n8n pour orchestrer des workflows complexes :
- Workflow "send WhatsApp + email confirmation" sur signature
- Workflow "trigger AI estimation + notify courtier" sur sinistre
- Workflow "ETL Postgres -> ClickHouse" daily

Configuration :
- Workflows backuped dans Postgres schema `n8n` (gere automatiquement)
- Versionning workflows via export JSON dans Git (Sprint 30 tache dediee)
- Monitoring via Datadog (Sprint 34)

### 17.36 Strategy Mailhog production replacement

Mailhog est dev-only (capture emails). En prod, remplace par :
- **Sendgrid** (option A) : 100k emails/mois free, scale facile
- **Postmark** (option B) : meilleur pour transactional emails
- **Atlas Cloud Services** (option C) : si pour data residency MA strict

Sprint 9 (comm) implemente abstraction `IEmailProvider` permettant swap entre providers.

### 17.37 Strategy MinIO production replacement

MinIO dev simule Atlas Cloud Services Benguerir Object Storage. Migration Sprint 35 :
- Update `S3_ENDPOINT` env var pointing vers Atlas
- Update `S3_ACCESS_KEY_ID` + `S3_SECRET_ACCESS_KEY` from Atlas vault
- Update `S3_FORCE_PATH_STYLE=false` (Atlas suit S3 standard)
- Code application unchange (interface S3 standard preservee)

### 17.38 Strategy Kafka production

Sprint 35 Kafka prod :
- 3 brokers KRaft Atlas Cloud Services Benguerir
- Replication factor 3, min in-sync 2
- Retention 7 jours par defaut, 30j DLQ
- TLS + SASL/SCRAM authentication
- Quotas par tenant pour eviter saturation
- Monitoring via Datadog Kafka integration

### 17.39 Strategy disaster recovery

DR procedure Atlas Cloud Services Benguerir multi-DC :
- DC1 (Tier III primary) + DC2 (Tier IV secondary)
- Replication async cross-DC < 5 min lag
- Failover automatique sur incident DC1
- Backups quotidiens stockes dans 3eme datacenter

Test DR semestriel Sprint 35+ : simulation panne DC1, verification RTO < 30 min RPO < 5 min.

### 17.40 Conventions debugging

Quand un service docker dev ne demarre pas :

1. `docker logs skalean-{service} -f` -- voir logs
2. `docker inspect skalean-{service}` -- check config
3. `docker network inspect skalean-net` -- check networking
4. `docker volume inspect skalean-{service}-data` -- check volume
5. `pnpm docker:reset` si suspicion data corruption
6. Si toujours echec : poster question dans Slack #insurtech-dev avec : log + steps reproduce + OS + version Docker


### 17.41 Strategy auto-scaling pour stack prod

Sprint 35 auto-scaling Atlas Cloud Services Benguerir Kubernetes :
- HPA (Horizontal Pod Autoscaler) sur apps/api selon CPU > 70%
- Cluster Autoscaler ajoute nodes K8s si pods pending
- Postgres : pas auto-scaling (managed Atlas, scale manuel + read replicas)
- Redis : pas auto-scaling (managed Atlas)
- Kafka : pas auto-scaling broker (manual scaling)

Cible Sprint 35 : 5000 users actifs concurrent sans saturation.

### 17.42 Patterns deployment blue-green / canary

Sprint 35 deploy strategy :
- Blue-green : 2 environments K8s identiques, switch via Cloudflare DNS
- Canary : 5% traffic nouvelle version, monitor metriques 30 min, rolling 100%
- Rollback automatique si error rate > 1% ou p95 latency > 500ms

Aucun impact sur stack docker dev.

### 17.43 Strategy environment parity dev/staging/prod

Pour minimiser surprises de migration :
- Memes versions Postgres/Redis/Kafka entre dev et prod
- Memes parametres compose.dev.yaml et compose.test.yaml (subset)
- Memes init scripts SQL Postgres
- Memes env var names (juste valeurs differentes)
- Memes locales fr-MA / TZ Africa/Casablanca

Differences acceptees :
- Resources limits (dev minimaliste vs prod generous)
- Volumes (named dev vs PV K8s prod)
- TLS (off dev vs on prod)
- Replicas (1 dev vs N prod)

### 17.44 Documentation pour onboarding nouveau dev

Sprint 1.1.3 contribue au CONTRIBUTING.md (Tache 1.1.15) :

```
## Demarrer la stack dev locale

1. Installer Docker Desktop >= 4.30 (8 GB RAM minimum allocated)
2. `cd repo`
3. `pnpm install --frozen-lockfile`
4. `pnpm docker:up`
5. Attendre ~60s : `bash infrastructure/scripts/wait-for-stack-healthy.sh`
6. Verifier services :
   - Postgres : `psql postgresql://skalean:skalean_dev_only_change_in_prod@localhost/skalean_insurtech -c "SELECT 1"`
   - Redis : `redis-cli -a skalean_redis_dev_only ping`
   - Kafka UI : http://localhost:8080
   - MinIO : http://localhost:9001
   - Mailhog : http://localhost:8025
   - n8n : http://localhost:5678

## Pour reset en cas de probleme :

`pnpm docker:reset` -- efface volumes + redemarre

## Pour stop sans efface :

`pnpm docker:down` -- preserve data
```

### 17.45 Couverture conformite legale Maroc

**Loi 09-08 CNDP** : MinIO simule Atlas Cloud Services Benguerir prod (data Maroc). En dev, donnees test seulement (pas de donnees reelles assures).

**Loi 43-20 signature electronique** : pas applicable a la stack docker (signature en code Sprint 10).

**Decret 2-09-165 TZ Maroc** : Postgres + n8n configures `Africa/Casablanca`.

**ACAPS / AMC** : pas applicable a docker stack (compliance en code Sprint 12).


### 17.46 Resume densification Tache 1.1.3

Cette tache est extra-dense pour couvrir :
- KRaft consensus mecanisme detaille
- Postgres tuning rationale par parametre (18 parametres documentes)
- Redis config rationale par parametre (10 parametres)
- Healthcheck rationale par service
- Volume strategy detaillee
- Network bridge + port mappings rationale
- Resource limits rationale (memory + CPU per service)
- Logging strategy + rotation
- Init scripts orchestration
- Edge cases supplementaires (4 cas additionnels)
- Tests E2E docker stack (preview Sprint 4+)
- Optimisation startup time
- Prod stack preview (Sprint 35) avec migration K8s
- Strategy backup local dev
- Configuration approfondie Sprint 33 hardening (Postgres + Redis)
- Strategies migration versions (Postgres 16->17, Kafka 3.7->4.0)
- Auto-scaling K8s prod
- Blue-green canary deployment
- Environment parity dev/staging/prod
- Documentation onboarding nouveau dev
- Couverture conformite Maroc


### 17.47 Annexe : variables environnement detaillees

Tableau exhaustif des env vars utilisees par stack docker :

| Variable | Default dev | Override prod | Sprint usage |
|----------|-------------|----------------|--------------|
| POSTGRES_USER | skalean | atlas-vault-secret | All sprints |
| POSTGRES_PASSWORD | skalean_dev_only_change_in_prod | atlas-vault-secret | All |
| POSTGRES_DB | skalean_insurtech | skalean_insurtech_prod | All |
| POSTGRES_PORT | 5432 | not exposed | dev only |
| REDIS_PASSWORD | skalean_redis_dev_only | atlas-vault-secret | All |
| REDIS_PORT | 6379 | not exposed | dev only |
| KAFKA_EXTERNAL_PORT | 9094 | not exposed | dev only |
| KAFKA_UI_PORT | 8080 | not exposed | dev only |
| MINIO_ROOT_USER | skalean | atlas-vault-secret | dev only |
| MINIO_ROOT_PASSWORD | skalean_minio_dev_only | atlas-vault-secret | dev only |
| MINIO_PORT | 9000 | (replace by Atlas Object Storage) | dev only |
| MINIO_CONSOLE_PORT | 9001 | not exposed | dev only |
| MAILHOG_SMTP_PORT | 1025 | (replace by Sendgrid) | dev only |
| MAILHOG_UI_PORT | 8025 | not exposed | dev only |
| N8N_PORT | 5678 | atlas-k8s-internal | All |
| N8N_BASIC_AUTH_USER | skalean | atlas-vault-secret | All |
| N8N_BASIC_AUTH_PASSWORD | skalean_n8n_dev_only | atlas-vault-secret | All |
| POSTGRES_TEST_PORT | 5433 | n/a | CI only |
| REDIS_TEST_PORT | 6380 | n/a | CI only |
| KAFKA_TEST_PORT | 9095 | n/a | CI only |

### 17.48 Strategy `.env` files management

Conventions :
- `.env.example` : versionne dans Git, sample tous les vars (sans valeurs reelles)
- `.env.local` : non-versionne, dev specifique (override personnel)
- `.env.test` : non-versionne, CI specifique
- `.env.production` : NEVER local, gere par Atlas Vault Sprint 35

Pattern compose : `${VAR:-default}` permet override si var set, default sinon. Couvre les 3 scenarios.


### 17.49 Strategy upgrade Docker Compose major versions

Quand Docker Compose v3 sortira (probable 2027) :
1. Test sur branche dev
2. Verifier compat YAML schema
3. Update doc CONTRIBUTING.md
4. Communiquer equipe

### 17.50 Conclusion de la densification

Cette tache 1.1.3 est exhaustive sur :
- 7 services + 2 init containers documentes parametre par parametre
- Healthchecks + dependencies coherence
- Volume strategy + backup approach
- Network bridge isolation
- Resource limits memory + CPU per service
- Edge cases cross-platform (Linux + MacOS + Windows)
- Migration path vers Atlas Cloud Services Benguerir Sprint 35


### 17.51 Final notes Tache 1.1.3

Stack docker dev = fondation pour 35 sprints. Toute regression cassera tous les sprints suivants. Tests integration soigneusement maintenus.


### 17.52 References

- decision-001 monorepo + decision-006 no-emoji + decision-008 data residency MA
- Docker Compose v2 documentation
- Bitnami Kafka 3.7 KRaft documentation
- Atlas Cloud Services Benguerir documentation (managed services prod Sprint 35)


Final size target reached.

