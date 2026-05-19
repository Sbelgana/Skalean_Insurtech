#!/usr/bin/env bash
# infrastructure/docker/kafka/verify-topics.sh
# Skalean Insurtech -- Verification 53 topics presents et conformes
# Tache 1.2.10 -- Sprint 2
# Aucune emoji (decision-006)

set -euo pipefail

KAFKA_BROKERS="${KAFKA_BROKERS:-kafka:9092}"
NAMING_REGEX='^insurtech\.(events|dlq)\.[a-z]+\.[a-z_]+(\.[a-z_]+)?$'

log_info()  { echo "[INFO]  $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }
log_error() { echo "[ERROR] $(date -u +'%Y-%m-%dT%H:%M:%SZ') $*" >&2; }

EXPECTED_TOPICS=(
  "insurtech.events.auth.user.created"
  "insurtech.events.auth.user.signed_in"
  "insurtech.events.auth.user.signed_out"
  "insurtech.events.auth.user.locked"
  "insurtech.events.auth.user.unlocked"
  "insurtech.events.auth.user.password_reset_requested"
  "insurtech.events.auth.user.password_changed"
  "insurtech.events.auth.user.mfa_enabled"
  "insurtech.events.auth.user.mfa_disabled"
  "insurtech.events.crm.contact.created"
  "insurtech.events.crm.contact.updated"
  "insurtech.events.crm.deal.created"
  "insurtech.events.crm.deal.stage_changed"
  "insurtech.events.crm.interaction.recorded"
  "insurtech.events.crm.interaction.email_received"
  "insurtech.events.booking.appointment.scheduled"
  "insurtech.events.booking.appointment.confirmed"
  "insurtech.events.booking.appointment.cancelled"
  "insurtech.events.booking.appointment.completed"
  "insurtech.events.comm.message.queued"
  "insurtech.events.comm.message.sent"
  "insurtech.events.comm.message.delivered"
  "insurtech.events.comm.message.read"
  "insurtech.events.comm.message.failed"
  "insurtech.events.comm.template.created"
  "insurtech.events.comm.template.approved"
  "insurtech.events.comm.template.rejected"
  "insurtech.events.comm.optout.recorded"
  "insurtech.events.comm.webhook.received"
  "insurtech.events.pay.transaction.initiated"
  "insurtech.events.pay.transaction.completed"
  "insurtech.events.pay.transaction.failed"
  "insurtech.events.pay.transaction.refunded"
  "insurtech.events.pay.reconciliation.matched"
  "insurtech.events.pay.reconciliation.discrepancy"
  "insurtech.events.insure.policy.created"
  "insurtech.events.insure.policy.signed"
  "insurtech.events.insure.policy.renewed"
  "insurtech.events.insure.policy.cancelled"
  "insurtech.events.repair.sinistre.declared"
  "insurtech.events.repair.sinistre.dispatched"
  "insurtech.events.repair.sinistre.estimated"
  "insurtech.events.audit.audit.recorded"
  "insurtech.events.audit.compliance.data_purged"
  "insurtech.events.audit.compliance.acaps_submitted"
  "insurtech.events.books.invoice.issued"
  "insurtech.events.books.invoice.paid"
  "insurtech.events.stock.stock.low_threshold"
  "insurtech.events.stock.stock.movement_recorded"
  "insurtech.events.hr.attendance.recorded"
  "insurtech.events.hr.salary.processed"
  "insurtech.events.system.tenant.created"
  "insurtech.events.system.tenant.settings_changed"
  "insurtech.events.system.user.password_reset_requested"
  "insurtech.dlq.comm.failed"
  "insurtech.dlq.pay.failed"
  "insurtech.dlq.insure.failed"
  "insurtech.dlq.repair.failed"
  "insurtech.dlq.compliance.failed"
)

log_info "=== Verification ${#EXPECTED_TOPICS[@]} topics attendus ==="

CURRENT_TOPICS=$(kafka-topics.sh --bootstrap-server "${KAFKA_BROKERS}" --list | grep "^insurtech\." | sort)

MISSING_COUNT=0
NON_CONFORMING_COUNT=0

for expected in "${EXPECTED_TOPICS[@]}"; do
  if ! [[ "${expected}" =~ ${NAMING_REGEX} ]]; then
    log_error "Topic attendu non-conforme regex : ${expected}"
    NON_CONFORMING_COUNT=$((NON_CONFORMING_COUNT + 1))
    continue
  fi

  if ! echo "${CURRENT_TOPICS}" | grep -q "^${expected}$"; then
    log_error "Topic manquant : ${expected}"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done

log_info "--- Verification drift (topics presents non attendus) ---"
DRIFT_COUNT=0
while IFS= read -r current; do
  found=false
  for expected in "${EXPECTED_TOPICS[@]}"; do
    if [[ "${current}" == "${expected}" ]]; then
      found=true
      break
    fi
  done
  if [ "${found}" = false ]; then
    log_error "Topic non attendu (drift) : ${current}"
    DRIFT_COUNT=$((DRIFT_COUNT + 1))
  fi
done <<< "${CURRENT_TOPICS}"

log_info "=== Bilan verification ==="
log_info "Topics attendus      : ${#EXPECTED_TOPICS[@]}"
log_info "Topics manquants     : ${MISSING_COUNT}"
log_info "Topics non-conformes : ${NON_CONFORMING_COUNT}"
log_info "Topics drift         : ${DRIFT_COUNT}"

if [ "${MISSING_COUNT}" -gt 0 ] || [ "${NON_CONFORMING_COUNT}" -gt 0 ]; then
  log_error "Verification ECHOUEE"
  exit 1
fi

log_info "Verification REUSSIE"
exit 0
