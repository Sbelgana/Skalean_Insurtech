#!/usr/bin/env sh
# Skalean InsurTech v2.2 -- MinIO init buckets dev
# Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.7)
#            decision-008 (data residency Maroc) + decision-009 (3 buckets strategy)
# Aucune emoji autorisee (decision-006).
set -eu

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_USER="${MINIO_ROOT_USER}"
MINIO_PWD="${MINIO_ROOT_PASSWORD}"
ENV_TAG="${ENV_TAG:-dev}"

echo "[minio-init] Configuring mc alias..."
echo "[minio-init] endpoint=${MINIO_ENDPOINT} env=${ENV_TAG}"

echo "[minio-init] waiting for MinIO to be ready..."
ELAPSED=0
MAX_WAIT=60
until mc alias set local "${MINIO_ENDPOINT}" "${MINIO_USER}" "${MINIO_PWD}" >/dev/null 2>&1; do
  if [ "${ELAPSED}" -ge "${MAX_WAIT}" ]; then
    echo "[minio-init] FAIL: MinIO not ready after ${MAX_WAIT}s"
    exit 1
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
echo "[minio-init] MinIO ready (${ELAPSED}s)"

echo "[minio-init] Creating 3 dev buckets..."

for bucket in docs photos archive; do
  full_name="skalean-insurtech-${ENV_TAG}-${bucket}"
  if mc ls "local/${full_name}" >/dev/null 2>&1; then
    echo "[minio-init] skip ${full_name} (already exists)"
  else
    mc mb "local/${full_name}"
    echo "[minio-init] Created : ${full_name}"
  fi
done

# Anonymous download policy on photos bucket (presigned URLs for sinistres)
PHOTOS_BUCKET="skalean-insurtech-${ENV_TAG}-photos"
mc anonymous set download "local/${PHOTOS_BUCKET}" || true
echo "[minio-init] Anonymous download enabled : ${PHOTOS_BUCKET}"

# Enable versioning on archive bucket (preparation Object Lock prod -- loi 43-20)
ARCHIVE_BUCKET="skalean-insurtech-${ENV_TAG}-archive"
mc version enable "local/${ARCHIVE_BUCKET}" || true
echo "[minio-init] Versioning enabled : ${ARCHIVE_BUCKET}"

echo "[minio-init] Buckets created:"
mc ls local/

echo "[minio-init] DONE -- 3 buckets ready"
exit 0
