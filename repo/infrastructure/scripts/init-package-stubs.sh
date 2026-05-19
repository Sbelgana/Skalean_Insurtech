#!/usr/bin/env bash
# Skalean InsurTech v2.2 -- Init packages + apps stubs
# Reference: B-01 Tache 1.1.13
# Idempotent: skips files that already exist
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PACKAGES=(
  auth database crm booking comm docs signature pay books compliance
  analytics insure repair stock hr sky sky-ui assure-shared
  shared-types shared-config shared-utils shared-events shared-ui shared-pwa shared-maps
)

APPS=(
  api web-broker web-garage web-garage-mobile web-insurtech-admin
  web-customer-portal web-assure-portal web-assure-mobile mcp-server
)

create_package_stub() {
  local name=$1
  local dir="${REPO_ROOT}/packages/${name}"

  mkdir -p "${dir}/src"

  if [[ ! -f "${dir}/package.json" ]]; then
    cat > "${dir}/package.json" <<JSON
{
  "name": "@insurtech/${name}",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest watch",
    "lint": "biome check src",
    "clean": "rm -rf dist .turbo"
  },
  "devDependencies": {
    "@types/node": "22.10.5",
    "typescript": "5.7.3",
    "vitest": "2.1.8"
  }
}
JSON
    echo "[init-stubs] Created ${name}/package.json"
  else
    echo "[init-stubs] Skipped ${name}/package.json (exists)"
  fi

  if [[ ! -f "${dir}/tsconfig.json" ]]; then
    cat > "${dir}/tsconfig.json" <<JSON
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": true,
    "declaration": true,
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
JSON
    echo "[init-stubs] Created ${name}/tsconfig.json"
  else
    echo "[init-stubs] Skipped ${name}/tsconfig.json (exists)"
  fi

  if [[ ! -f "${dir}/src/index.ts" ]]; then
    cat > "${dir}/src/index.ts" <<TS
/**
 * @insurtech/${name} -- Skalean InsurTech v2.2
 */
export const VERSION = '0.1.0';
TS
    echo "[init-stubs] Created ${name}/src/index.ts"
  else
    echo "[init-stubs] Skipped ${name}/src/index.ts (exists)"
  fi
}

create_app_stub() {
  local name=$1
  local dir="${REPO_ROOT}/apps/${name}"
  local port

  case "${name}" in
    api)                  port=4000 ;;
    web-insurtech-admin)  port=3000 ;;
    web-broker)           port=3001 ;;
    web-garage)           port=3002 ;;
    web-garage-mobile)    port=3003 ;;
    web-customer-portal)  port=3004 ;;
    web-assure-portal)    port=3005 ;;
    web-assure-mobile)    port=3006 ;;
    mcp-server)           port=4001 ;;
    *)                    port=3000 ;;
  esac

  mkdir -p "${dir}/src"

  if [[ ! -f "${dir}/package.json" ]]; then
    cat > "${dir}/package.json" <<JSON
{
  "name": "@insurtech/${name}",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsx watch src/main.ts",
    "start": "node dist/main.js",
    "test": "vitest run",
    "lint": "biome check src",
    "clean": "rm -rf dist .next .turbo"
  },
  "devDependencies": {
    "@types/node": "22.10.5",
    "tsx": "4.19.2",
    "typescript": "5.7.3",
    "vitest": "2.1.8"
  }
}
JSON
    echo "[init-stubs] Created app ${name}/package.json (port ${port})"
  else
    echo "[init-stubs] Skipped app ${name}/package.json (exists)"
  fi

  if [[ ! -f "${dir}/tsconfig.json" ]]; then
    cat > "${dir}/tsconfig.json" <<JSON
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
JSON
    echo "[init-stubs] Created app ${name}/tsconfig.json"
  else
    echo "[init-stubs] Skipped app ${name}/tsconfig.json (exists)"
  fi

  if [[ ! -f "${dir}/src/main.ts" ]]; then
    cat > "${dir}/src/main.ts" <<TS
/**
 * Skalean InsurTech v2.2 -- @insurtech/${name}
 * Port ${port}
 */
console.log('Skalean InsurTech ${name} placeholder, port ${port}');
TS
    echo "[init-stubs] Created app ${name}/src/main.ts"
  else
    echo "[init-stubs] Skipped app ${name}/src/main.ts (exists)"
  fi
}

echo "[init-stubs] Creating packages stubs..."
for pkg in "${PACKAGES[@]}"; do
  create_package_stub "${pkg}"
done

echo "[init-stubs] Creating apps stubs..."
for app in "${APPS[@]}"; do
  create_app_stub "${app}"
done

echo "[init-stubs] DONE -- $(ls "${REPO_ROOT}/packages/" | wc -l) packages, $(ls "${REPO_ROOT}/apps/" | wc -l) apps"
