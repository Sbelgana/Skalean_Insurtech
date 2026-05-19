# syntax=docker/dockerfile:1.7-labs

# ============================================================================
# Skalean InsurTech v2.2 -- apps/api Dockerfile
# Multi-stage Node 22.11-alpine + non-root user + healthcheck.
# Reference : decision-008 (Atlas Cloud Maroc) + decision-006 (no-emoji).
# ============================================================================

# === Stage 1 : pnpm install + build ===
FROM node:22.11-alpine AS builder

# Active pnpm via corepack (preinstalle Node 22+).
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copie lockfile + workspace config FIRST pour cache Docker layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared-config/package.json packages/shared-config/
COPY packages/shared-utils/package.json packages/shared-utils/

# Install workspace deps (frozen-lockfile pour reproductibilite).
RUN pnpm install --frozen-lockfile --filter=@insurtech/api...

# Copie sources + build.
COPY apps/api apps/api/
COPY packages/shared-config packages/shared-config/
COPY packages/shared-utils packages/shared-utils/
COPY tsconfig.base.json ./
COPY turbo.json ./

RUN pnpm --filter @insurtech/shared-config build
RUN pnpm --filter @insurtech/shared-utils build
RUN pnpm --filter @insurtech/api build

# === Stage 2 : runtime minimal ===
FROM node:22.11-alpine AS runtime

# Active pnpm.
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Cree user non-root (UID 1001).
RUN addgroup -g 1001 -S insurtech && adduser -u 1001 -S insurtech -G insurtech

WORKDIR /app

# Copie node_modules + dist depuis builder.
COPY --from=builder --chown=insurtech:insurtech /app/node_modules ./node_modules
COPY --from=builder --chown=insurtech:insurtech /app/apps/api/dist apps/api/dist
COPY --from=builder --chown=insurtech:insurtech /app/apps/api/package.json apps/api/
COPY --from=builder --chown=insurtech:insurtech /app/packages/shared-config/dist packages/shared-config/dist
COPY --from=builder --chown=insurtech:insurtech /app/packages/shared-config/package.json packages/shared-config/
COPY --from=builder --chown=insurtech:insurtech /app/packages/shared-utils/dist packages/shared-utils/dist
COPY --from=builder --chown=insurtech:insurtech /app/packages/shared-utils/package.json packages/shared-utils/

USER insurtech

ENV NODE_ENV=production
ENV API_PORT=4000
ENV API_HOST=0.0.0.0
ENV TZ=Africa/Casablanca

EXPOSE 4000

# Healthcheck : Tache 1.3.10 ajoute /healthz endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/healthz || exit 1

CMD ["node", "apps/api/dist/main.js"]
