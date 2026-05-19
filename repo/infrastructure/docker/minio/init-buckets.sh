#!/usr/bin/env sh
# MinIO init buckets -- Skalean InsurTech v2.2
# Reference: task-1.1.7 (S3 client + buckets)
# Ce script sera complete par Tache 1.1.7
set -eu

MINIO_ENDPOINT="http://minio:9000"
MINIO_USER="${MINIO_ROOT_USER:-skalean}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-skalean_minio_dev_only}"

echo "[minio-init] Configuring mc alias..."
mc alias set local "$MINIO_ENDPOINT" "$MINIO_USER" "$MINIO_PASS"

echo "[minio-init] Waiting for MinIO to be ready..."
mc ready local

echo "[minio-init] Creating dev buckets..."
mc mb --ignore-existing local/skalean-insurtech-dev-docs
mc mb --ignore-existing local/skalean-insurtech-dev-photos
mc mb --ignore-existing local/skalean-insurtech-dev-archive

echo "[minio-init] Buckets created:"
mc ls local/

echo "[minio-init] Done"
