#!/usr/bin/env bash
# ============================================================================
# Skalean InsurTech v2.2 -- Kafka topics initialization
# Reference: 00-pilotage/meta-prompts/B-01-sprint-01-bootstrap.md (Tache 1.1.6)
#            decision-004 (Kafka vs RabbitMQ)
#            decision-006 (no-emoji)
# ============================================================================
# Cree 32 topics Kafka avec convention naming :
#   insurtech.events.{vertical}.{entity}.{action}
#
# Topics par usage :
#   - 7 Auth   (user signup, login, logout, password, MFA, lock, role)
#   - 5 CRM    (contact CRUD, deal, interaction)
#   - 3 Booking (appointment scheduled, cancelled, completed)
#   - 3 Comm   (message sent, delivered, failed)
#   - 4 Pay    (transaction lifecycle, refund)
#   - 4 Insure (quote, police, signed, avenant)
#   - 3 Repair (sinistre, devis, reparation)
#   - 1 Audit  (access denied)
#   - 2 DLQ    (comm, pay)
#
# Configuration :
#   - 3 partitions defaut, 6 pour high-throughput
#   - retention.ms = 7 jours (604800000), 30 jours pour DLQ
#   - compression.type = lz4
#   - replication factor = 1 dev (override 3 via env REPLICATION_FACTOR)
#
# Aucune emoji autorisee (decision-006).
# ============================================================================

set -euo pipefail

KAFKA_BROKER="${KAFKA_BROKER:-kafka:9092}"
REPLICATION_FACTOR="${REPLICATION_FACTOR:-1}"
RETENTION_STANDARD_MS="${RETENTION_STANDARD_MS:-604800000}"   # 7 days
RETENTION_DLQ_MS="${RETENTION_DLQ_MS:-2592000000}"            # 30 days
COMPRESSION_TYPE="${COMPRESSION_TYPE:-lz4}"

echo "[kafka-init-topics] starting -- broker=${KAFKA_BROKER}"
echo "[kafka-init-topics] replication=${REPLICATION_FACTOR} retention_std=${RETENTION_STANDARD_MS} retention_dlq=${RETENTION_DLQ_MS} compression=${COMPRESSION_TYPE}"

# ============================================================================
# Wait for Kafka to be ready
# ============================================================================
echo "[kafka-init-topics] waiting for kafka broker..."
MAX_WAIT=60
ELAPSED=0
until kafka-topics.sh --bootstrap-server "${KAFKA_BROKER}" --list >/dev/null 2>&1; do
  if [[ "${ELAPSED}" -ge "${MAX_WAIT}" ]]; then
    echo "[kafka-init-topics] FAIL: kafka broker not ready after ${MAX_WAIT}s"
    exit 1
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
echo "[kafka-init-topics] kafka broker ready (${ELAPSED}s)"

# ============================================================================
# Helper : create_topic <name> <partitions> [retention_ms]
# ============================================================================
create_topic() {
  local name="$1"
  local partitions="${2:-3}"
  local retention_ms="${3:-${RETENTION_STANDARD_MS}}"

  if kafka-topics.sh --bootstrap-server "${KAFKA_BROKER}" --list 2>/dev/null | grep -qFx "${name}"; then
    echo "[kafka-init-topics] skip ${name} (already exists)"
    return 0
  fi

  kafka-topics.sh \
    --bootstrap-server "${KAFKA_BROKER}" \
    --create \
    --if-not-exists \
    --topic "${name}" \
    --partitions "${partitions}" \
    --replication-factor "${REPLICATION_FACTOR}" \
    --config "compression.type=${COMPRESSION_TYPE}" \
    --config "retention.ms=${retention_ms}" \
    --config "retention.bytes=1073741824" \
    --config "cleanup.policy=delete" \
    --config "min.insync.replicas=1" \
    >/dev/null

  echo "[kafka-init-topics] Created : ${name} (partitions=${partitions} retention=${retention_ms}ms)"
}

# ============================================================================
# Topics Auth (7)
# ============================================================================
echo "[kafka-init-topics] --- Auth topics ---"
create_topic "insurtech.events.auth.user_signed_up"     3
create_topic "insurtech.events.auth.user_signed_in"     6   # high throughput
create_topic "insurtech.events.auth.user_signed_out"    3
create_topic "insurtech.events.auth.password_changed"   3
create_topic "insurtech.events.auth.mfa_setup"          3
create_topic "insurtech.events.auth.account_locked"     3
create_topic "insurtech.events.auth.role_changed"       3

# ============================================================================
# Topics CRM (5)
# ============================================================================
echo "[kafka-init-topics] --- CRM topics ---"
create_topic "insurtech.events.crm.contact_created"     3
create_topic "insurtech.events.crm.contact_updated"     3
create_topic "insurtech.events.crm.contact_deleted"     3
create_topic "insurtech.events.crm.deal_stage_changed"  3
create_topic "insurtech.events.crm.interaction_logged"  6   # high throughput

# ============================================================================
# Topics Booking (3)
# ============================================================================
echo "[kafka-init-topics] --- Booking topics ---"
create_topic "insurtech.events.booking.appointment_scheduled" 3
create_topic "insurtech.events.booking.appointment_cancelled" 3
create_topic "insurtech.events.booking.appointment_completed" 3

# ============================================================================
# Topics Comm (3)
# ============================================================================
echo "[kafka-init-topics] --- Comm topics ---"
create_topic "insurtech.events.comm.message_sent"      6    # high throughput
create_topic "insurtech.events.comm.message_delivered" 6    # high throughput
create_topic "insurtech.events.comm.message_failed"    3

# ============================================================================
# Topics Pay (4)
# ============================================================================
echo "[kafka-init-topics] --- Pay topics ---"
create_topic "insurtech.events.pay.transaction_initiated" 3
create_topic "insurtech.events.pay.transaction_completed" 3
create_topic "insurtech.events.pay.transaction_failed"    3
create_topic "insurtech.events.pay.refund_processed"      3

# ============================================================================
# Topics Insure (4)
# ============================================================================
echo "[kafka-init-topics] --- Insure topics ---"
create_topic "insurtech.events.insure.quote_generated" 3
create_topic "insurtech.events.insure.police_created"  3
create_topic "insurtech.events.insure.police_signed"   3
create_topic "insurtech.events.insure.avenant_created" 3

# ============================================================================
# Topics Repair (3)
# ============================================================================
echo "[kafka-init-topics] --- Repair topics ---"
create_topic "insurtech.events.repair.sinistre_declared"   6  # high throughput
create_topic "insurtech.events.repair.devis_approved"      3
create_topic "insurtech.events.repair.reparation_completed" 3

# ============================================================================
# Topics Audit (1)
# ============================================================================
echo "[kafka-init-topics] --- Audit topics ---"
create_topic "insurtech.events.audit.access_denied" 3

# ============================================================================
# Topics DLQ (2) -- 1 partition (preserve order), 30 days retention
# ============================================================================
echo "[kafka-init-topics] --- DLQ topics ---"
create_topic "insurtech.events.dlq.comm" 1 "${RETENTION_DLQ_MS}"
create_topic "insurtech.events.dlq.pay"  1 "${RETENTION_DLQ_MS}"

# ============================================================================
# Verification
# ============================================================================
TOPIC_COUNT=$(kafka-topics.sh --bootstrap-server "${KAFKA_BROKER}" --list 2>/dev/null | grep -cE "^insurtech\.events\." || true)
echo "[kafka-init-topics] Total topics insurtech.events.*: ${TOPIC_COUNT}"

if [[ "${TOPIC_COUNT}" -lt 30 ]]; then
  echo "[kafka-init-topics] FAIL: expected at least 30 topics, got ${TOPIC_COUNT}"
  exit 1
fi

echo "[kafka-init-topics] DONE -- ${TOPIC_COUNT} topics created."
exit 0
