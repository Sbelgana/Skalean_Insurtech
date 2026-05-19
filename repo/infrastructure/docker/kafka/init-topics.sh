#!/usr/bin/env bash
# infrastructure/docker/kafka/init-topics.sh
# Skalean Insurtech -- Initialisation 53 topics Kafka KRaft 3.7
# Tache 1.2.10 -- Sprint 2
# Idempotent : --if-not-exists permet re-execution sans effet de bord
# Naming convention : insurtech.events.{vertical}.{entity}.{action}
# Retention differenciee : 7 jours standard / 30 jours audit + DLQ
# Aucune emoji (decision-006)

set -euo pipefail

KAFKA_BROKERS="${KAFKA_BROKERS:-kafka:9092}"
KAFKA_PARTITIONS_DEFAULT="${KAFKA_PARTITIONS_DEFAULT:-6}"
KAFKA_PARTITIONS_DLQ="${KAFKA_PARTITIONS_DLQ:-1}"
KAFKA_RETENTION_STANDARD_MS="${KAFKA_RETENTION_STANDARD_MS:-604800000}"     # 7 jours
KAFKA_RETENTION_AUDIT_MS="${KAFKA_RETENTION_AUDIT_MS:-2592000000}"           # 30 jours
KAFKA_RETENTION_DLQ_MS="${KAFKA_RETENTION_DLQ_MS:-2592000000}"               # 30 jours
KAFKA_REPLICATION_FACTOR="${KAFKA_REPLICATION_FACTOR:-1}"
KAFKA_MIN_INSYNC_REPLICAS="${KAFKA_MIN_INSYNC_REPLICAS:-1}"
KAFKA_COMPRESSION="${KAFKA_COMPRESSION:-snappy}"
KAFKA_SEGMENT_MS="${KAFKA_SEGMENT_MS:-86400000}"                             # 1 jour
KAFKA_CLEANUP_POLICY="${KAFKA_CLEANUP_POLICY:-delete}"

log_info()  { echo "[INFO]  $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }
log_warn()  { echo "[WARN]  $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }
log_error() { echo "[ERROR] $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }

NAMING_REGEX='^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$'

validate_topic_name() {
  local topic_name="$1"
  if ! [[ "${topic_name}" =~ ${NAMING_REGEX} ]]; then
    log_error "Topic name non-conforme : ${topic_name}"
    log_error "Regex attendue : ${NAMING_REGEX}"
    exit 1
  fi
}

# Helper : creation idempotente d'un topic
# Args : $1=topic_name, $2=partitions, $3=retention_ms
create_topic() {
  local topic_name="$1"
  local partitions="${2:-${KAFKA_PARTITIONS_DEFAULT}}"
  local retention_ms="${3:-${KAFKA_RETENTION_STANDARD_MS}}"

  validate_topic_name "${topic_name}"

  log_info "Creation topic : ${topic_name} (partitions=${partitions}, retention_ms=${retention_ms})"

  kafka-topics.sh \
    --bootstrap-server "${KAFKA_BROKERS}" \
    --create \
    --if-not-exists \
    --topic "${topic_name}" \
    --partitions "${partitions}" \
    --replication-factor "${KAFKA_REPLICATION_FACTOR}" \
    --config "retention.ms=${retention_ms}" \
    --config "min.insync.replicas=${KAFKA_MIN_INSYNC_REPLICAS}" \
    --config "compression.type=${KAFKA_COMPRESSION}" \
    --config "segment.ms=${KAFKA_SEGMENT_MS}" \
    --config "cleanup.policy=${KAFKA_CLEANUP_POLICY}" \
    || log_warn "Creation topic ${topic_name} echouee ou existante"
}

log_info "=== Initialisation 59 topics Kafka Skalean Insurtech ==="
log_info "Brokers            : ${KAFKA_BROKERS}"
log_info "Partitions default : ${KAFKA_PARTITIONS_DEFAULT}"
log_info "Partitions DLQ     : ${KAFKA_PARTITIONS_DLQ}"
log_info "Replication factor : ${KAFKA_REPLICATION_FACTOR}"
log_info "Compression        : ${KAFKA_COMPRESSION}"

# Attente readiness Kafka
log_info "Attente broker Kafka..."
MAX_WAIT=60
ELAPSED=0
until kafka-topics.sh --bootstrap-server "${KAFKA_BROKERS}" --list >/dev/null 2>&1; do
  if [[ "${ELAPSED}" -ge "${MAX_WAIT}" ]]; then
    log_error "Kafka broker non disponible apres ${MAX_WAIT}s"
    exit 1
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
log_info "Kafka broker pret (${ELAPSED}s)"

# === Module Auth (9 topics) ===
log_info "--- Module Auth ---"
create_topic "insurtech.events.auth.user.created"
create_topic "insurtech.events.auth.user.signed_in"
create_topic "insurtech.events.auth.user.signed_out"
create_topic "insurtech.events.auth.user.locked"
create_topic "insurtech.events.auth.user.unlocked"
create_topic "insurtech.events.auth.user.password_reset_requested"
create_topic "insurtech.events.auth.user.password_changed"
create_topic "insurtech.events.auth.user.mfa_enabled"
create_topic "insurtech.events.auth.user.mfa_disabled"

# === Module CRM (6 topics) ===
log_info "--- Module CRM ---"
create_topic "insurtech.events.crm.contact.created"
create_topic "insurtech.events.crm.contact.updated"
create_topic "insurtech.events.crm.deal.created"
create_topic "insurtech.events.crm.deal.stage_changed"
create_topic "insurtech.events.crm.interaction.recorded"
create_topic "insurtech.events.crm.interaction.email_received"

# === Module Booking (4 topics) ===
log_info "--- Module Booking ---"
create_topic "insurtech.events.booking.appointment.scheduled"
create_topic "insurtech.events.booking.appointment.confirmed"
create_topic "insurtech.events.booking.appointment.cancelled"
create_topic "insurtech.events.booking.appointment.completed"

# === Module Communication (10 topics) ===
log_info "--- Module Communication ---"
create_topic "insurtech.events.comm.message.queued"
create_topic "insurtech.events.comm.message.sent"
create_topic "insurtech.events.comm.message.delivered"
create_topic "insurtech.events.comm.message.read"
create_topic "insurtech.events.comm.message.failed"
create_topic "insurtech.events.comm.template.created"
create_topic "insurtech.events.comm.template.approved"
create_topic "insurtech.events.comm.template.rejected"
create_topic "insurtech.events.comm.optout.recorded"
create_topic "insurtech.events.comm.webhook.received"

# === Module Pay (6 topics) ===
log_info "--- Module Pay ---"
create_topic "insurtech.events.pay.transaction.initiated"
create_topic "insurtech.events.pay.transaction.completed"
create_topic "insurtech.events.pay.transaction.failed"
create_topic "insurtech.events.pay.transaction.refunded"
create_topic "insurtech.events.pay.reconciliation.matched"
create_topic "insurtech.events.pay.reconciliation.discrepancy"

# === Module Insurance (anticipation Sprint 14-16) (4 topics) ===
log_info "--- Module Insurance (anticipation Sprint 14-16) ---"
create_topic "insurtech.events.insure.policy.created"
create_topic "insurtech.events.insure.policy.signed"
create_topic "insurtech.events.insure.policy.renewed"
create_topic "insurtech.events.insure.policy.cancelled"

# === Module Repair (anticipation Sprint 20-22) (3 topics) ===
log_info "--- Module Repair (anticipation Sprint 20-22) ---"
create_topic "insurtech.events.repair.sinistre.declared"
create_topic "insurtech.events.repair.sinistre.dispatched"
create_topic "insurtech.events.repair.sinistre.estimated"

# === Module Audit (3 topics, retention 30 jours) ===
log_info "--- Module Audit (retention 30 jours) ---"
create_topic "insurtech.events.audit.audit.recorded"          "${KAFKA_PARTITIONS_DEFAULT}" "${KAFKA_RETENTION_AUDIT_MS}"
create_topic "insurtech.events.audit.compliance.data_purged"  "${KAFKA_PARTITIONS_DEFAULT}" "${KAFKA_RETENTION_AUDIT_MS}"
create_topic "insurtech.events.audit.compliance.acaps_submitted" "${KAFKA_PARTITIONS_DEFAULT}" "${KAFKA_RETENTION_AUDIT_MS}"

# === Module Books (2 topics) ===
log_info "--- Module Books ---"
create_topic "insurtech.events.books.invoice.issued"
create_topic "insurtech.events.books.invoice.paid"

# === Module Stock (2 topics) ===
log_info "--- Module Stock ---"
create_topic "insurtech.events.stock.stock.low_threshold"
create_topic "insurtech.events.stock.stock.movement_recorded"

# === Module HR (2 topics) ===
log_info "--- Module HR ---"
create_topic "insurtech.events.hr.attendance.recorded"
create_topic "insurtech.events.hr.salary.processed"

# === Module System (3 topics) ===
log_info "--- Module System ---"
create_topic "insurtech.events.system.tenant.created"
create_topic "insurtech.events.system.tenant.settings_changed"
create_topic "insurtech.events.system.user.password_reset_requested"

# === DLQ topics (5 topics, 1 partition, retention 30 jours) ===
log_info "--- DLQ topics (1 partition, retention 30 jours) ---"
create_topic "insurtech.dlq.comm.failed"       "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"
create_topic "insurtech.dlq.pay.failed"        "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"
create_topic "insurtech.dlq.insure.failed"     "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"
create_topic "insurtech.dlq.repair.failed"     "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"
create_topic "insurtech.dlq.compliance.failed" "${KAFKA_PARTITIONS_DLQ}" "${KAFKA_RETENTION_DLQ_MS}"

log_info "=== Initialisation 59 topics terminee ==="

TOPIC_COUNT=$(kafka-topics.sh --bootstrap-server "${KAFKA_BROKERS}" --list | grep -c "^insurtech\." || true)
log_info "Total topics insurtech.* presents : ${TOPIC_COUNT}"

if [ "${TOPIC_COUNT}" -lt 59 ]; then
  log_error "Total topics ${TOPIC_COUNT} < 59 attendu, init incomplete"
  exit 1
fi

log_info "=== Verification : ${TOPIC_COUNT} topics insurtech.* OK ==="
exit 0
