-- ==========================================================================
-- SCHEMA POSTGRESQL skalean-insurtech -- DEFINITION COMPLETE PARTIE 1/2
-- Version : 1.0.0
-- Date : 2026-05-04
-- Description : Schema des tables systeme + horizontaux (tables auth, CRM,
--               Booking, Comm, Docs, Pay, Books, Compliance)
-- AUCUNE EMOJI AUTORISEE
-- ==========================================================================
--
-- Conventions :
-- - Toutes les tables ont une colonne tenant_id pour multi-tenant
-- - Sauf tables auth_tenants (root) et compliance_data_residency (systeme)
-- - Toutes les tables ont id UUID, created_at, updated_at, deleted_at (soft delete)
-- - Tous les noms de tables suivent le pattern <module>_<entite>
-- - Tous les indexes sont prefixes idx_<table>_<colonnes>
-- - Tous les noms snake_case, aucun emoji
-- ==========================================================================

-- ==========================================================================
-- EXTENSIONS POSTGRESQL
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ==========================================================================
-- TYPES ENUM PARTAGES
-- ==========================================================================

CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'pending', 'deleted');
CREATE TYPE tenant_type AS ENUM ('platform', 'broker', 'garage', 'system');
CREATE TYPE plan_type AS ENUM ('starter', 'pro', 'enterprise', 'pilot', 'custom');

CREATE TYPE user_status AS ENUM ('active', 'inactive', 'pending_verification', 'locked', 'deleted');
CREATE TYPE user_role AS ENUM (
  'super_admin_platform',
  'analyst_support',
  'admin_tenant',
  'courtier',
  'gestionnaire',
  'souscripteur',
  'chef_atelier',
  'technicien',
  'receptionniste',
  'comptable',
  'assure'
);

CREATE TYPE locale_code AS ENUM ('fr', 'ar-MA', 'ar', 'en');

CREATE TYPE policy_status AS ENUM ('draft', 'quoted', 'signed', 'active', 'renewed', 'cancelled', 'expired');
CREATE TYPE sinistre_status AS ENUM ('received', 'diagnosis', 'quoted', 'validated', 'in_repair', 'quality_check', 'invoiced', 'returned', 'closed', 'rejected');
CREATE TYPE payment_status AS ENUM ('pending', 'processing', 'captured', 'failed', 'refunded', 'partially_refunded', 'expired');
CREATE TYPE payment_gateway AS ENUM ('cmi', 'youcan_pay', 'payzone', 'inwi_money', 'orange_money', 'mwallet_bam', 'stripe');

CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid', 'overdue', 'cancelled');
CREATE TYPE acaps_audit_action AS ENUM ('create', 'update', 'delete', 'read_sensitive', 'export', 'consent_given', 'consent_revoked', 'purge');

CREATE TYPE consent_purpose AS ENUM ('marketing', 'transactional', 'data_processing', 'data_sharing_insurer', 'data_sharing_garage', 'photo_sinistre', 'whatsapp_communication');
CREATE TYPE consent_status AS ENUM ('granted', 'revoked', 'expired');

-- ==========================================================================
-- AUTH ET MULTI-TENANT
-- ==========================================================================

CREATE TABLE auth_tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_tenant_id UUID REFERENCES auth_tenants(id),
  slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  type tenant_type NOT NULL,
  status tenant_status NOT NULL DEFAULT 'pending',
  plan_type plan_type NOT NULL DEFAULT 'starter',
  country_code CHAR(2) NOT NULL DEFAULT 'MA',
  city VARCHAR(100),
  rib VARCHAR(50),
  ice VARCHAR(50),
  if_number VARCHAR(50),
  rc_number VARCHAR(50),
  patente_number VARCHAR(50),
  acaps_authorization_number VARCHAR(50),
  primary_locale locale_code NOT NULL DEFAULT 'fr',
  data_residency_country CHAR(2) NOT NULL DEFAULT 'MA',
  metadata JSONB NOT NULL DEFAULT '{}',
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_acaps_data_residency CHECK (data_residency_country = 'MA')
);

CREATE INDEX idx_auth_tenants_slug ON auth_tenants(slug);
CREATE INDEX idx_auth_tenants_status ON auth_tenants(status);
CREATE INDEX idx_auth_tenants_type ON auth_tenants(type);
CREATE INDEX idx_auth_tenants_parent ON auth_tenants(parent_tenant_id);
CREATE INDEX idx_auth_tenants_acaps ON auth_tenants(acaps_authorization_number) WHERE acaps_authorization_number IS NOT NULL;
CREATE INDEX idx_auth_tenants_deleted ON auth_tenants(deleted_at) WHERE deleted_at IS NOT NULL;


CREATE TABLE auth_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  phone_number VARCHAR(30),
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  preferred_locale locale_code NOT NULL DEFAULT 'fr',
  status user_status NOT NULL DEFAULT 'pending_verification',
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_encrypted TEXT,
  mfa_backup_codes_encrypted TEXT,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  last_login_ip INET,
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(tenant_id, email)
);

CREATE INDEX idx_auth_users_tenant ON auth_users(tenant_id);
CREATE INDEX idx_auth_users_email ON auth_users(email);
CREATE INDEX idx_auth_users_status ON auth_users(status);
CREATE INDEX idx_auth_users_last_login ON auth_users(last_login_at DESC) WHERE last_login_at IS NOT NULL;
CREATE INDEX idx_auth_users_deleted ON auth_users(deleted_at) WHERE deleted_at IS NOT NULL;


CREATE TABLE auth_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  level INTEGER NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE auth_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(100) NOT NULL UNIQUE,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_permissions_resource ON auth_permissions(resource);


CREATE TABLE auth_role_permissions (
  role_id UUID NOT NULL REFERENCES auth_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES auth_permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(role_id, permission_id)
);


CREATE TABLE auth_user_roles (
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES auth_roles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth_users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(user_id, role_id)
);


CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  user_agent TEXT,
  ip_address INET,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_sessions_tenant ON auth_sessions(tenant_id);
CREATE INDEX idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires ON auth_sessions(expires_at);


CREATE TABLE auth_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  purpose consent_purpose NOT NULL,
  status consent_status NOT NULL,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  evidence JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_consents_tenant_user ON auth_consents(tenant_id, user_id);
CREATE INDEX idx_auth_consents_purpose ON auth_consents(purpose);
CREATE INDEX idx_auth_consents_status ON auth_consents(status);

-- ==========================================================================
-- CRM
-- ==========================================================================

CREATE TABLE crm_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  external_id VARCHAR(100),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  phone_number VARCHAR(30),
  preferred_locale locale_code NOT NULL DEFAULT 'fr',
  cin VARCHAR(20),
  date_of_birth DATE,
  address_line VARCHAR(255),
  city VARCHAR(100),
  postal_code VARCHAR(20),
  country_code CHAR(2) NOT NULL DEFAULT 'MA',
  tags TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_crm_contacts_tenant ON crm_contacts(tenant_id);
CREATE INDEX idx_crm_contacts_email ON crm_contacts(tenant_id, email);
CREATE INDEX idx_crm_contacts_phone ON crm_contacts(tenant_id, phone_number);
CREATE INDEX idx_crm_contacts_cin ON crm_contacts(tenant_id, cin) WHERE cin IS NOT NULL;
CREATE INDEX idx_crm_contacts_search ON crm_contacts USING gin((first_name || ' ' || last_name) gin_trgm_ops);


CREATE TABLE crm_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  ice VARCHAR(50),
  rc_number VARCHAR(50),
  industry VARCHAR(100),
  size VARCHAR(20),
  primary_contact_id UUID REFERENCES crm_contacts(id),
  city VARCHAR(100),
  country_code CHAR(2) NOT NULL DEFAULT 'MA',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_crm_companies_tenant ON crm_companies(tenant_id);
CREATE INDEX idx_crm_companies_ice ON crm_companies(tenant_id, ice) WHERE ice IS NOT NULL;


CREATE TABLE crm_pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  stages JSONB NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crm_pipelines_tenant ON crm_pipelines(tenant_id);


CREATE TABLE crm_deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id),
  contact_id UUID REFERENCES crm_contacts(id),
  company_id UUID REFERENCES crm_companies(id),
  owner_user_id UUID REFERENCES auth_users(id),
  title VARCHAR(255) NOT NULL,
  amount NUMERIC(15, 2),
  currency CHAR(3) NOT NULL DEFAULT 'MAD',
  stage VARCHAR(50) NOT NULL,
  probability INTEGER NOT NULL DEFAULT 50,
  expected_close_date DATE,
  closed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_crm_deals_tenant ON crm_deals(tenant_id);
CREATE INDEX idx_crm_deals_pipeline_stage ON crm_deals(pipeline_id, stage);
CREATE INDEX idx_crm_deals_owner ON crm_deals(owner_user_id);


CREATE TABLE crm_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  contact_id UUID REFERENCES crm_contacts(id),
  deal_id UUID REFERENCES crm_deals(id),
  user_id UUID REFERENCES auth_users(id),
  subject VARCHAR(255),
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_crm_activities_tenant_contact ON crm_activities(tenant_id, contact_id);
CREATE INDEX idx_crm_activities_deal ON crm_activities(deal_id);
CREATE INDEX idx_crm_activities_occurred ON crm_activities(tenant_id, occurred_at DESC);

-- ==========================================================================
-- BOOKING
-- ==========================================================================

CREATE TABLE booking_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES auth_users(id),
  capacity INTEGER NOT NULL DEFAULT 1,
  external_calendar_id VARCHAR(255),
  external_calendar_provider VARCHAR(50),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_booking_resources_tenant ON booking_resources(tenant_id);


CREATE TABLE booking_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES booking_resources(id),
  contact_id UUID REFERENCES crm_contacts(id),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed',
  external_event_id VARCHAR(255),
  reminder_sent_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_booking_appts_tenant ON booking_appointments(tenant_id);
CREATE INDEX idx_booking_appts_resource_time ON booking_appointments(resource_id, start_at);
CREATE INDEX idx_booking_appts_contact ON booking_appointments(contact_id);

-- ==========================================================================
-- COMMUNICATION (WhatsApp + Email)
-- ==========================================================================

CREATE TABLE comm_wa_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  meta_template_name VARCHAR(100) NOT NULL,
  meta_template_id VARCHAR(255),
  category VARCHAR(50) NOT NULL,
  locale locale_code NOT NULL,
  body_template TEXT NOT NULL,
  variables_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_comm_wa_tpl_unique ON comm_wa_templates(tenant_id, meta_template_name, locale);


CREATE TABLE comm_wa_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES crm_contacts(id),
  phone_number VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  last_message_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comm_wa_conv_tenant_phone ON comm_wa_conversations(tenant_id, phone_number);


CREATE TABLE comm_wa_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES comm_wa_conversations(id) ON DELETE CASCADE,
  meta_message_id VARCHAR(255),
  direction VARCHAR(10) NOT NULL,
  content_type VARCHAR(20) NOT NULL DEFAULT 'text',
  body TEXT,
  template_id UUID REFERENCES comm_wa_templates(id),
  template_variables JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comm_wa_msg_tenant_conv ON comm_wa_messages(tenant_id, conversation_id);
CREATE INDEX idx_comm_wa_msg_meta_id ON comm_wa_messages(meta_message_id) WHERE meta_message_id IS NOT NULL;
CREATE INDEX idx_comm_wa_msg_created ON comm_wa_messages(tenant_id, created_at DESC);


CREATE TABLE comm_email_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  to_email VARCHAR(255) NOT NULL,
  to_name VARCHAR(255),
  cc_emails TEXT[],
  template_code VARCHAR(100),
  locale locale_code NOT NULL DEFAULT 'fr',
  subject VARCHAR(500) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  postmark_message_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  bounce_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comm_email_tenant ON comm_email_messages(tenant_id);
CREATE INDEX idx_comm_email_to ON comm_email_messages(tenant_id, to_email);
CREATE INDEX idx_comm_email_postmark ON comm_email_messages(postmark_message_id) WHERE postmark_message_id IS NOT NULL;

-- ==========================================================================
-- DOCUMENTS ET SIGNATURE LOI 43-20
-- ==========================================================================

CREATE TABLE docs_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  storage_bucket VARCHAR(100) NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  hash_sha512 VARCHAR(128) NOT NULL,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_docs_tenant_type ON docs_documents(tenant_id, type);
CREATE INDEX idx_docs_related ON docs_documents(related_entity_type, related_entity_id);
CREATE INDEX idx_docs_hash ON docs_documents(hash_sha512);


CREATE TABLE docs_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES docs_documents(id),
  provider_name VARCHAR(100) NOT NULL,
  provider_signature_id VARCHAR(255) NOT NULL,
  signer_name VARCHAR(255) NOT NULL,
  signer_email VARCHAR(255),
  signer_phone VARCHAR(30),
  signer_cin VARCHAR(20),
  signature_certificate TEXT,
  signature_value TEXT NOT NULL,
  hash_algorithm VARCHAR(20) NOT NULL DEFAULT 'SHA-512',
  document_hash VARCHAR(128) NOT NULL,
  timestamp_authority_value TEXT,
  signed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  evidence JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_docs_sig_tenant ON docs_signatures(tenant_id);
CREATE INDEX idx_docs_sig_document ON docs_signatures(document_id);
CREATE INDEX idx_docs_sig_provider ON docs_signatures(provider_signature_id);

-- ==========================================================================
-- PAIEMENTS MULTI-PASSERELLES
-- ==========================================================================

CREATE TABLE pay_gateways_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  gateway payment_gateway NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  priority INTEGER NOT NULL DEFAULT 100,
  config_encrypted TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, gateway)
);

CREATE INDEX idx_pay_gateways_tenant ON pay_gateways_config(tenant_id);
CREATE INDEX idx_pay_gateways_enabled ON pay_gateways_config(tenant_id, is_enabled, priority);


CREATE TABLE pay_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  order_id VARCHAR(100) NOT NULL,
  gateway payment_gateway NOT NULL,
  gateway_transaction_id VARCHAR(255),
  amount_cents BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'MAD',
  status payment_status NOT NULL DEFAULT 'pending',
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  payer_contact_id UUID REFERENCES crm_contacts(id),
  payer_email VARCHAR(255),
  payer_phone VARCHAR(30),
  fraud_score NUMERIC(5, 2),
  fraud_indicators JSONB,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  refunded_at TIMESTAMPTZ,
  webhook_received_at TIMESTAMPTZ,
  idempotency_key VARCHAR(255) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, idempotency_key),
  UNIQUE(gateway, gateway_transaction_id) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_pay_tx_tenant ON pay_transactions(tenant_id);
CREATE INDEX idx_pay_tx_status ON pay_transactions(tenant_id, status);
CREATE INDEX idx_pay_tx_gateway ON pay_transactions(gateway);
CREATE INDEX idx_pay_tx_related ON pay_transactions(related_entity_type, related_entity_id);
CREATE INDEX idx_pay_tx_initiated ON pay_transactions(tenant_id, initiated_at DESC);


CREATE TABLE pay_webhooks_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES auth_tenants(id) ON DELETE CASCADE,
  gateway payment_gateway NOT NULL,
  gateway_event_id VARCHAR(255) NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  signature_provided TEXT,
  signature_computed TEXT,
  payload JSONB NOT NULL,
  related_transaction_id UUID REFERENCES pay_transactions(id),
  processed_at TIMESTAMPTZ,
  processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pay_wh_gateway_event ON pay_webhooks_log(gateway, gateway_event_id);
CREATE INDEX idx_pay_wh_status ON pay_webhooks_log(processing_status);
CREATE INDEX idx_pay_wh_tenant ON pay_webhooks_log(tenant_id) WHERE tenant_id IS NOT NULL;


CREATE TABLE pay_refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES pay_transactions(id),
  gateway_refund_id VARCHAR(255),
  amount_cents BIGINT NOT NULL,
  reason TEXT,
  status payment_status NOT NULL DEFAULT 'pending',
  refunded_at TIMESTAMPTZ,
  initiated_by UUID REFERENCES auth_users(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pay_refunds_tenant ON pay_refunds(tenant_id);
CREATE INDEX idx_pay_refunds_tx ON pay_refunds(transaction_id);

-- ==========================================================================
-- COMPTABILITE LEGERE MAROC
-- ==========================================================================

CREATE TABLE books_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL,
  parent_account_id UUID REFERENCES books_accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_books_accounts_tenant ON books_accounts(tenant_id);
CREATE INDEX idx_books_accounts_type ON books_accounts(tenant_id, type);


CREATE TABLE books_journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  entry_number VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  total_debit NUMERIC(15, 2) NOT NULL,
  total_credit NUMERIC(15, 2) NOT NULL,
  is_balanced BOOLEAN NOT NULL,
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  posted_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_balanced CHECK (total_debit = total_credit)
);

CREATE INDEX idx_books_je_tenant ON books_journal_entries(tenant_id);
CREATE INDEX idx_books_je_date ON books_journal_entries(tenant_id, entry_date DESC);


CREATE TABLE books_journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES books_journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES books_accounts(id),
  debit NUMERIC(15, 2) NOT NULL DEFAULT 0,
  credit NUMERIC(15, 2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_books_jl_entry ON books_journal_lines(journal_entry_id);
CREATE INDEX idx_books_jl_account ON books_journal_lines(tenant_id, account_id);


CREATE TABLE books_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL,
  customer_contact_id UUID REFERENCES crm_contacts(id),
  customer_company_id UUID REFERENCES crm_companies(id),
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  amount_ht NUMERIC(15, 2) NOT NULL,
  amount_tva NUMERIC(15, 2) NOT NULL,
  tva_rate NUMERIC(5, 2) NOT NULL,
  amount_ttc NUMERIC(15, 2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'MAD',
  status invoice_status NOT NULL DEFAULT 'draft',
  paid_at TIMESTAMPTZ,
  pdf_document_id UUID REFERENCES docs_documents(id),
  related_entity_type VARCHAR(50),
  related_entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX idx_books_invoices_tenant ON books_invoices(tenant_id);
CREATE INDEX idx_books_invoices_status ON books_invoices(tenant_id, status);
CREATE INDEX idx_books_invoices_customer ON books_invoices(customer_contact_id, customer_company_id);


CREATE TABLE books_tax_declarations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL,
  total_ht NUMERIC(15, 2) NOT NULL,
  total_tva_collected NUMERIC(15, 2) NOT NULL,
  total_tva_paid NUMERIC(15, 2) NOT NULL,
  net_tva NUMERIC(15, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  declared_at TIMESTAMPTZ,
  declaration_reference VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, period_year, period_month)
);

CREATE INDEX idx_books_tax_tenant_period ON books_tax_declarations(tenant_id, period_year, period_month);

-- ==========================================================================
-- COMPLIANCE ACAPS
-- ==========================================================================

CREATE TABLE compliance_acaps_audits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth_users(id),
  action acaps_audit_action NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  field_changes JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acaps_audit_tenant ON compliance_acaps_audits(tenant_id, occurred_at DESC);
CREATE INDEX idx_acaps_audit_entity ON compliance_acaps_audits(entity_type, entity_id);
CREATE INDEX idx_acaps_audit_user ON compliance_acaps_audits(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_acaps_audit_action ON compliance_acaps_audits(action);


CREATE TABLE compliance_acaps_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  generated_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  acaps_reference VARCHAR(100),
  document_id UUID REFERENCES docs_documents(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_acaps_reports_tenant ON compliance_acaps_reports(tenant_id, period_start);


CREATE TABLE compliance_data_residency (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_name VARCHAR(100) NOT NULL,
  datacenter_country CHAR(2) NOT NULL,
  datacenter_provider VARCHAR(100),
  datacenter_city VARCHAR(100),
  ip_range CIDR,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_validation_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'validated',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_residency_morocco CHECK (datacenter_country = 'MA')
);

-- ==========================================================================
-- FIN PARTIE 1/2 -- voir 3-schemas-database-PARTIE2.sql pour Insure, Repair,
-- Stock, HR, Analytics, Cross-tenant, Admin, Billing
-- ==========================================================================
