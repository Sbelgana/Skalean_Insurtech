-- ==========================================================================
-- SCHEMA POSTGRESQL skalean-insurtech -- DEFINITION COMPLETE PARTIE 2/2
-- Version : 1.0.0
-- Date : 2026-05-04
-- Description : Schema des tables verticales (Insure, Repair) + Stock + HR
--               + Analytics + Cross-tenant + Admin + Billing
-- AUCUNE EMOJI AUTORISEE
--
-- Prerequis : 3-schemas-database-PARTIE1.sql doit etre execute en premier
--             (extensions, types enum, tables auth_*, crm_*, booking_*,
--             comm_*, docs_*, pay_*, books_*, compliance_*)
-- ==========================================================================

-- ==========================================================================
-- VERTICAL INSURE (Skalean Broker)
-- ==========================================================================

CREATE TABLE insure_assureurs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  acaps_authorization VARCHAR(50),
  api_partner_id VARCHAR(100),
  api_status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  contact_info JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE insure_produits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assureur_id UUID NOT NULL REFERENCES insure_assureurs(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assureur_id, code)
);

CREATE INDEX idx_insure_produits_category ON insure_produits(category);


CREATE TABLE insure_garanties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produit_id UUID NOT NULL REFERENCES insure_produits(id),
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  default_amount NUMERIC(15, 2),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insure_garanties_produit ON insure_garanties(produit_id);


CREATE TABLE insure_devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES crm_contacts(id),
  reference VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  produits_compares JSONB NOT NULL,
  selected_produit_id UUID REFERENCES insure_produits(id),
  amount_annual NUMERIC(15, 2),
  amount_split JSONB,
  garanties_selected JSONB NOT NULL DEFAULT '[]',
  valid_until DATE,
  generated_by UUID REFERENCES auth_users(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insure_devis_tenant ON insure_devis(tenant_id);
CREATE INDEX idx_insure_devis_contact ON insure_devis(contact_id);
CREATE INDEX idx_insure_devis_status ON insure_devis(tenant_id, status);


CREATE TABLE insure_polices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  policy_number VARCHAR(50) NOT NULL,
  assureur_policy_number VARCHAR(50),
  contact_id UUID NOT NULL REFERENCES crm_contacts(id),
  produit_id UUID NOT NULL REFERENCES insure_produits(id),
  devis_id UUID REFERENCES insure_devis(id),
  status policy_status NOT NULL DEFAULT 'draft',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  amount_annual NUMERIC(15, 2) NOT NULL,
  payment_frequency VARCHAR(20) NOT NULL DEFAULT 'annual',
  garanties_active JSONB NOT NULL,
  signed_document_id UUID REFERENCES docs_documents(id),
  signature_id UUID REFERENCES docs_signatures(id),
  signed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  renewed_from_policy_id UUID REFERENCES insure_polices(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, policy_number)
);

CREATE INDEX idx_insure_polices_tenant ON insure_polices(tenant_id);
CREATE INDEX idx_insure_polices_contact ON insure_polices(contact_id);
CREATE INDEX idx_insure_polices_status ON insure_polices(tenant_id, status);
CREATE INDEX idx_insure_polices_end_date ON insure_polices(end_date) WHERE status = 'active';


CREATE TABLE insure_avenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES insure_polices(id),
  type VARCHAR(50) NOT NULL,
  effective_date DATE NOT NULL,
  changes JSONB NOT NULL,
  amount_change NUMERIC(15, 2),
  signed_document_id UUID REFERENCES docs_documents(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insure_avenants_policy ON insure_avenants(policy_id);


CREATE TABLE insure_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES insure_polices(id),
  assureur_id UUID NOT NULL REFERENCES insure_assureurs(id),
  courtier_user_id UUID REFERENCES auth_users(id),
  amount NUMERIC(15, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'MAD',
  rate NUMERIC(5, 2),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'expected',
  paid_at TIMESTAMPTZ,
  reconciled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insure_comm_tenant ON insure_commissions(tenant_id);
CREATE INDEX idx_insure_comm_policy ON insure_commissions(policy_id);
CREATE INDEX idx_insure_comm_period ON insure_commissions(tenant_id, period_start, period_end);


CREATE TABLE insure_renouvellements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES insure_polices(id),
  scheduled_date DATE NOT NULL,
  reminder_sent_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  new_policy_id UUID REFERENCES insure_polices(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insure_renouv_scheduled ON insure_renouvellements(tenant_id, scheduled_date);


CREATE TABLE insure_sinistres_lite (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES insure_polices(id),
  reference VARCHAR(50) NOT NULL,
  declared_at TIMESTAMPTZ NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'declared',
  garage_tenant_id UUID REFERENCES auth_tenants(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insure_sin_tenant ON insure_sinistres_lite(tenant_id);
CREATE INDEX idx_insure_sin_policy ON insure_sinistres_lite(policy_id);


CREATE TABLE insure_sky_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id),
  channel VARCHAR(20) NOT NULL,
  locale locale_code NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  escalated_to_user_id UUID REFERENCES auth_users(id),
  escalated_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insure_sky_tenant ON insure_sky_conversations(tenant_id);

-- ==========================================================================
-- VERTICAL REPAIR (Skalean Garage)
-- ==========================================================================

CREATE TABLE repair_baremes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  assureur_id UUID NOT NULL REFERENCES insure_assureurs(id),
  category VARCHAR(50) NOT NULL,
  hourly_rate_cents BIGINT NOT NULL,
  paint_rate_cents BIGINT,
  effective_from DATE NOT NULL,
  effective_until DATE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repair_baremes_tenant_assureur ON repair_baremes(tenant_id, assureur_id);


CREATE TABLE repair_sinistres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  reference VARCHAR(50) NOT NULL,
  external_reference VARCHAR(100),
  contact_id UUID REFERENCES crm_contacts(id),
  vehicle_vin VARCHAR(20),
  vehicle_plate VARCHAR(20),
  vehicle_make VARCHAR(50),
  vehicle_model VARCHAR(100),
  vehicle_year INTEGER,
  assureur_id UUID REFERENCES insure_assureurs(id),
  policy_reference VARCHAR(50),
  related_insure_sinistre_id UUID REFERENCES insure_sinistres_lite(id),
  status sinistre_status NOT NULL DEFAULT 'received',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  diagnosed_at TIMESTAMPTZ,
  quoted_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  repair_started_at TIMESTAMPTZ,
  repair_completed_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  returned_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  chef_atelier_user_id UUID REFERENCES auth_users(id),
  fraud_score NUMERIC(5, 2),
  fraud_indicators JSONB,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX idx_repair_sin_tenant ON repair_sinistres(tenant_id);
CREATE INDEX idx_repair_sin_status ON repair_sinistres(tenant_id, status);
CREATE INDEX idx_repair_sin_vin ON repair_sinistres(vehicle_vin) WHERE vehicle_vin IS NOT NULL;
CREATE INDEX idx_repair_sin_assureur ON repair_sinistres(assureur_id);


CREATE TABLE repair_devis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  reference VARCHAR(50) NOT NULL,
  amount_pieces_cents BIGINT NOT NULL DEFAULT 0,
  amount_main_oeuvre_cents BIGINT NOT NULL DEFAULT 0,
  amount_paint_cents BIGINT NOT NULL DEFAULT 0,
  amount_total_ht_cents BIGINT NOT NULL,
  amount_tva_cents BIGINT NOT NULL,
  amount_total_ttc_cents BIGINT NOT NULL,
  generated_by VARCHAR(20) NOT NULL DEFAULT 'manual',
  ai_confidence_score NUMERIC(5, 2),
  ai_zones_detected JSONB,
  validated_by_user_id UUID REFERENCES auth_users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repair_devis_sinistre ON repair_devis(sinistre_id);
CREATE INDEX idx_repair_devis_status ON repair_devis(tenant_id, status);


CREATE TABLE repair_factures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  invoice_id UUID REFERENCES books_invoices(id),
  reference VARCHAR(50) NOT NULL,
  certified_hash VARCHAR(128) NOT NULL,
  amount_total_ttc_cents BIGINT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX idx_repair_factures_sinistre ON repair_factures(sinistre_id);


CREATE TABLE repair_pieces_remplacees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  part_reference VARCHAR(100) NOT NULL,
  part_name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents BIGINT NOT NULL,
  total_cents BIGINT NOT NULL,
  supplier_id UUID,
  installed_at TIMESTAMPTZ,
  installed_by_user_id UUID REFERENCES auth_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repair_pieces_sinistre ON repair_pieces_remplacees(sinistre_id);


CREATE TABLE repair_main_oeuvre (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  technician_user_id UUID NOT NULL REFERENCES auth_users(id),
  task_description TEXT NOT NULL,
  hours_worked NUMERIC(5, 2) NOT NULL,
  hourly_rate_cents BIGINT NOT NULL,
  total_cents BIGINT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repair_mo_sinistre ON repair_main_oeuvre(sinistre_id);
CREATE INDEX idx_repair_mo_tech ON repair_main_oeuvre(technician_user_id);


CREATE TABLE repair_photos_dossier (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  document_id UUID NOT NULL REFERENCES docs_documents(id),
  phase VARCHAR(50) NOT NULL,
  zone VARCHAR(50),
  uploaded_by_user_id UUID REFERENCES auth_users(id),
  ai_analyzed BOOLEAN NOT NULL DEFAULT FALSE,
  ai_analysis JSONB,
  exif_anonymized BOOLEAN NOT NULL DEFAULT FALSE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_repair_photos_sinistre ON repair_photos_dossier(sinistre_id);
CREATE INDEX idx_repair_photos_phase ON repair_photos_dossier(sinistre_id, phase);


CREATE TABLE repair_vin_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vin VARCHAR(20) NOT NULL,
  tenant_id UUID REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID REFERENCES repair_sinistres(id),
  decoded_make VARCHAR(50),
  decoded_model VARCHAR(100),
  decoded_year INTEGER,
  events JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repair_vin_history_vin ON repair_vin_history(vin);


CREATE TABLE repair_audits_qualite (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  audited_by_user_id UUID NOT NULL REFERENCES auth_users(id),
  checklist_passed JSONB NOT NULL,
  defects_found JSONB,
  status VARCHAR(20) NOT NULL,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_repair_audits_sinistre ON repair_audits_qualite(sinistre_id);

-- ==========================================================================
-- STOCK PIECES DETACHEES
-- ==========================================================================

CREATE TABLE stock_suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  contact_info JSONB NOT NULL DEFAULT '{}',
  rating NUMERIC(3, 2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_suppliers_tenant ON stock_suppliers(tenant_id);


CREATE TABLE stock_parts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  reference VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  vehicle_compatibility JSONB,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  reorder_point INTEGER NOT NULL DEFAULT 5,
  unit_cost_cents BIGINT,
  unit_price_cents BIGINT,
  primary_supplier_id UUID REFERENCES stock_suppliers(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX idx_stock_parts_tenant ON stock_parts(tenant_id);
CREATE INDEX idx_stock_parts_reorder ON stock_parts(tenant_id) WHERE quantity_on_hand <= reorder_point;


CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES stock_parts(id),
  type VARCHAR(20) NOT NULL,
  quantity_delta INTEGER NOT NULL,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  user_id UUID REFERENCES auth_users(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_part ON stock_movements(part_id, occurred_at DESC);


CREATE TABLE stock_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES stock_suppliers(id),
  reference VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  total_cents BIGINT NOT NULL DEFAULT 0,
  ordered_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX idx_stock_orders_tenant ON stock_orders(tenant_id);

-- ==========================================================================
-- HR TECHNICIENS
-- ==========================================================================

CREATE TABLE hr_employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  user_id UUID UNIQUE REFERENCES auth_users(id),
  matricule VARCHAR(50) NOT NULL,
  hire_date DATE NOT NULL,
  termination_date DATE,
  position VARCHAR(100),
  hourly_rate_cents BIGINT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, matricule)
);

CREATE INDEX idx_hr_employees_tenant ON hr_employees(tenant_id);


CREATE TABLE hr_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  skill_code VARCHAR(50) NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  certified_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hr_skills_employee ON hr_skills(employee_id);


CREATE TABLE hr_punches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES hr_employees(id),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_hr_punches_employee ON hr_punches(employee_id, start_at DESC);
CREATE INDEX idx_hr_punches_related ON hr_punches(related_entity_type, related_entity_id);

-- ==========================================================================
-- ANALYTICS
-- ==========================================================================

CREATE TABLE analytics_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES auth_tenants(id) ON DELETE CASCADE,
  metric_code VARCHAR(100) NOT NULL,
  metric_value NUMERIC(20, 4) NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_metrics_tenant_code ON analytics_metrics(tenant_id, metric_code, recorded_at DESC);


CREATE TABLE analytics_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES auth_tenants(id) ON DELETE CASCADE,
  metric_code VARCHAR(100) NOT NULL,
  threshold_type VARCHAR(20) NOT NULL,
  threshold_value NUMERIC(20, 4) NOT NULL,
  triggered_value NUMERIC(20, 4),
  triggered_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notification_channels JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_analytics_alerts_active ON analytics_alerts(tenant_id) WHERE resolved_at IS NULL;

-- ==========================================================================
-- CROSS-TENANT (Phase 7)
-- ==========================================================================

CREATE TABLE cross_tenant_authorizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  granting_tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  receiving_tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  scope JSONB NOT NULL,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  granted_by_user_id UUID NOT NULL REFERENCES auth_users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by_user_id UUID REFERENCES auth_users(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  CHECK (granting_tenant_id != receiving_tenant_id)
);

CREATE INDEX idx_cross_tenant_granting ON cross_tenant_authorizations(granting_tenant_id);
CREATE INDEX idx_cross_tenant_receiving ON cross_tenant_authorizations(receiving_tenant_id);
CREATE INDEX idx_cross_tenant_active ON cross_tenant_authorizations(granting_tenant_id, receiving_tenant_id) WHERE revoked_at IS NULL;


CREATE TABLE cross_tenant_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  authorization_id UUID NOT NULL REFERENCES cross_tenant_authorizations(id),
  accessing_tenant_id UUID NOT NULL REFERENCES auth_tenants(id),
  accessing_user_id UUID NOT NULL REFERENCES auth_users(id),
  accessed_entity_type VARCHAR(50) NOT NULL,
  accessed_entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_cross_tenant_audit_auth ON cross_tenant_audit(authorization_id);
CREATE INDEX idx_cross_tenant_audit_user ON cross_tenant_audit(accessing_user_id);

-- ==========================================================================
-- ADMIN SKALEAN INSURTECH (Phase 8)
-- ==========================================================================

CREATE TABLE admin_support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  reporter_user_id UUID REFERENCES auth_users(id),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  priority VARCHAR(20) NOT NULL DEFAULT 'normal',
  assigned_to_user_id UUID REFERENCES auth_users(id),
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_tickets_tenant ON admin_support_tickets(tenant_id);
CREATE INDEX idx_admin_tickets_status ON admin_support_tickets(status);


CREATE TABLE admin_audit_queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES auth_users(id),
  query_type VARCHAR(50) NOT NULL,
  target_tenant_id UUID REFERENCES auth_tenants(id),
  query_details JSONB NOT NULL,
  reason TEXT NOT NULL,
  approved_by_user_id UUID REFERENCES auth_users(id),
  executed_at TIMESTAMPTZ,
  result_rows_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_queries_user ON admin_audit_queries(admin_user_id);
CREATE INDEX idx_admin_audit_queries_target ON admin_audit_queries(target_tenant_id);


CREATE TABLE admin_kpis_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date DATE NOT NULL UNIQUE,
  total_tenants_active INTEGER NOT NULL,
  total_users_active INTEGER NOT NULL,
  total_revenue_mrr_cents BIGINT NOT NULL,
  total_revenue_arr_cents BIGINT NOT NULL,
  churn_rate_30d NUMERIC(5, 2),
  nps_score NUMERIC(5, 2),
  raw_metrics JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_kpis_date ON admin_kpis_snapshots(snapshot_date DESC);


CREATE TABLE admin_reports_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type VARCHAR(50) NOT NULL,
  scope JSONB NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  requested_by_user_id UUID NOT NULL REFERENCES auth_users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  output_document_id UUID REFERENCES docs_documents(id),
  generated_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_reports_status ON admin_reports_jobs(status);
CREATE INDEX idx_admin_reports_user ON admin_reports_jobs(requested_by_user_id);

-- ==========================================================================
-- BILLING B2B SKALEAN (abonnements courtiers et garages)
-- ==========================================================================

CREATE TABLE billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES auth_tenants(id) ON DELETE CASCADE,
  plan_code VARCHAR(50) NOT NULL,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'MAD',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_billing_sub_status ON billing_subscriptions(status);
CREATE INDEX idx_billing_sub_period_end ON billing_subscriptions(current_period_end);


CREATE TABLE billing_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id),
  invoice_number VARCHAR(50) NOT NULL,
  stripe_invoice_id VARCHAR(255),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_ht_cents BIGINT NOT NULL,
  amount_tva_cents BIGINT NOT NULL,
  amount_ttc_cents BIGINT NOT NULL,
  status invoice_status NOT NULL DEFAULT 'draft',
  paid_at TIMESTAMPTZ,
  pdf_document_id UUID REFERENCES docs_documents(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX idx_billing_inv_tenant ON billing_invoices(tenant_id);
CREATE INDEX idx_billing_inv_status ON billing_invoices(status);


CREATE TABLE billing_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES billing_subscriptions(id),
  metric_code VARCHAR(50) NOT NULL,
  quantity NUMERIC(20, 4) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_billing_usage_tenant_metric ON billing_usage(tenant_id, metric_code, recorded_at DESC);

-- ==========================================================================
-- TRIGGERS UTILITAIRES
-- ==========================================================================

-- Trigger generique pour mettre a jour updated_at
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Application du trigger sur les tables principales
CREATE TRIGGER set_updated_at BEFORE UPDATE ON auth_tenants FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON auth_users FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON auth_consents FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_contacts FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_companies FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON crm_deals FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON booking_appointments FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pay_transactions FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON pay_gateways_config FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON books_invoices FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON insure_polices FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON insure_devis FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON insure_renouvellements FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON repair_sinistres FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON repair_devis FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON stock_parts FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON billing_subscriptions FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON billing_invoices FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ==========================================================================
-- VUES UTILITAIRES
-- ==========================================================================

-- Vue : polices actives expirant dans les 30 prochains jours
CREATE VIEW v_polices_a_renouveler AS
SELECT
  p.id,
  p.tenant_id,
  p.policy_number,
  p.contact_id,
  c.first_name || ' ' || c.last_name AS contact_name,
  c.email AS contact_email,
  c.phone_number AS contact_phone,
  p.end_date,
  (p.end_date - CURRENT_DATE) AS days_until_expiry,
  p.amount_annual
FROM insure_polices p
JOIN crm_contacts c ON c.id = p.contact_id
WHERE p.status = 'active'
  AND p.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
  AND p.deleted_at IS NULL;

-- Vue : sinistres en cours par garage
CREATE VIEW v_sinistres_en_cours AS
SELECT
  s.id,
  s.tenant_id,
  t.name AS garage_name,
  s.reference,
  s.vehicle_plate,
  s.vehicle_make || ' ' || s.vehicle_model AS vehicle,
  a.name AS assureur_name,
  s.status,
  s.received_at,
  EXTRACT(EPOCH FROM (NOW() - s.received_at)) / 3600 AS hours_since_received
FROM repair_sinistres s
JOIN auth_tenants t ON t.id = s.tenant_id
LEFT JOIN insure_assureurs a ON a.id = s.assureur_id
WHERE s.status NOT IN ('closed', 'rejected');

-- Vue : KPIs par tenant pour admin
CREATE VIEW v_tenant_kpis AS
SELECT
  t.id AS tenant_id,
  t.name AS tenant_name,
  t.type AS tenant_type,
  t.status,
  bs.plan_code,
  bs.amount_cents AS subscription_amount_cents,
  bs.status AS subscription_status,
  COUNT(DISTINCT u.id) FILTER (WHERE u.status = 'active') AS active_users_count,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active') AS active_policies_count,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status NOT IN ('closed', 'rejected')) AS open_sinistres_count
FROM auth_tenants t
LEFT JOIN billing_subscriptions bs ON bs.tenant_id = t.id
LEFT JOIN auth_users u ON u.tenant_id = t.id
LEFT JOIN insure_polices p ON p.tenant_id = t.id
LEFT JOIN repair_sinistres s ON s.tenant_id = t.id
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name, t.type, t.status, bs.plan_code, bs.amount_cents, bs.status;

-- ==========================================================================
-- COMMENTAIRES SUR LES TABLES PRINCIPALES (documentation inline)
-- ==========================================================================

COMMENT ON TABLE auth_tenants IS 'Multi-tenant racine -- platform, broker tenants, garage tenants';
COMMENT ON TABLE auth_consents IS 'Consentements RGPD-CNDP loi 09-08 obligatoires';
COMMENT ON TABLE compliance_acaps_audits IS 'Audit trail systematique pour conformite ACAPS -- retention 7 ans';
COMMENT ON TABLE compliance_data_residency IS 'Validation residence des donnees au Maroc obligatoire';
COMMENT ON TABLE pay_transactions IS 'Transactions multi-passerelles MA (CMI, YouCan Pay, PayZone, mobile money)';
COMMENT ON TABLE docs_signatures IS 'Signatures electroniques conformes loi 43-20 marocaine';
COMMENT ON TABLE insure_polices IS 'Polices d''assurance avec cycle de vie complet et signature electronique';
COMMENT ON TABLE repair_sinistres IS 'Sinistres auto avec workflow atelier de reception a cloture';
COMMENT ON TABLE cross_tenant_authorizations IS 'Autorisations cross-tenant courtier-garage avec audit complet';
COMMENT ON TABLE billing_subscriptions IS 'Abonnements B2B Skalean (courtiers et garages clients)';

-- ==========================================================================
-- FIN DU SCHEMA -- PARTIE 2/2
-- ==========================================================================
--
-- Bilan des tables creees (~62 tables) :
--
-- AUTH (8) : auth_tenants, auth_users, auth_roles, auth_permissions,
--            auth_role_permissions, auth_user_roles, auth_sessions, auth_consents
--
-- CRM (5) : crm_contacts, crm_companies, crm_pipelines, crm_deals, crm_activities
--
-- BOOKING (2) : booking_resources, booking_appointments
--
-- COMM (4) : comm_wa_templates, comm_wa_conversations, comm_wa_messages, comm_email_messages
--
-- DOCS (2) : docs_documents, docs_signatures
--
-- PAY (4) : pay_gateways_config, pay_transactions, pay_webhooks_log, pay_refunds
--
-- BOOKS (5) : books_accounts, books_journal_entries, books_journal_lines,
--             books_invoices, books_tax_declarations
--
-- COMPLIANCE (3) : compliance_acaps_audits, compliance_acaps_reports,
--                  compliance_data_residency
--
-- INSURE (10) : insure_assureurs, insure_produits, insure_garanties, insure_devis,
--               insure_polices, insure_avenants, insure_commissions,
--               insure_renouvellements, insure_sinistres_lite, insure_sky_conversations
--
-- REPAIR (10) : repair_baremes, repair_sinistres, repair_devis, repair_factures,
--               repair_pieces_remplacees, repair_main_oeuvre, repair_photos_dossier,
--               repair_vin_history, repair_audits_qualite (9 + structures pour audits)
--
-- STOCK (4) : stock_suppliers, stock_parts, stock_movements, stock_orders
--
-- HR (3) : hr_employees, hr_skills, hr_punches
--
-- ANALYTICS (2) : analytics_metrics, analytics_alerts
--
-- CROSS-TENANT (2) : cross_tenant_authorizations, cross_tenant_audit
--
-- ADMIN (4) : admin_support_tickets, admin_audit_queries, admin_kpis_snapshots,
--             admin_reports_jobs
--
-- BILLING (3) : billing_subscriptions, billing_invoices, billing_usage
--
-- VUES (3) : v_polices_a_renouveler, v_sinistres_en_cours, v_tenant_kpis
--
-- TRIGGERS (1) : trg_set_updated_at applique sur 18 tables
-- ==========================================================================
