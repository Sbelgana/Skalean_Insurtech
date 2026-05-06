-- ==========================================================================
-- SCHEMA POSTGRESQL skalean-insurtech v2.2 ADDITIONS
-- Version : 2.2.0
-- Date : 2026-05-05
-- Description : Tables additionnelles + alignement naming v2.2
-- AUCUNE EMOJI AUTORISEE
--
-- Prerequis :
--   - 3-schemas-database-PARTIE1.sql doit etre execute en premier
--   - 3-schemas-database-PARTIE2.sql doit etre execute en deuxieme
--   - 3-schemas-database-PARTIE3.sql doit etre execute en troisieme
--
-- Apport v2.2 :
--   - Tables repair_* alignees naming sprints v2.2 (anglais)
--   - Tables sky_* (Sprint 31)
--   - Tables mcp_* (Sprint 30)
--   - Table auth_webauthn_credentials (Sprint 23)
--   - Drop insure_sky_conversations (legacy v2.0 -- replaced by sky_conversations generic)
--
-- Decision design v2.2 : naming entities english (industrie standard ORM TypeORM)
-- ==========================================================================

-- ==========================================================================
-- ENUM TYPES v2.2
-- ==========================================================================

CREATE TYPE repair_sinistre_status AS ENUM (
  'declared',
  'acknowledged',
  'appointment_scheduled',
  'received',
  'under_diagnostic',
  'awaiting_estimate',
  'awaiting_approval',
  'under_repair',
  'completed',
  'closed'
);

CREATE TYPE repair_devis_status AS ENUM (
  'draft',
  'submitted',
  'approved',
  'rejected',
  'expired'
);

CREATE TYPE repair_order_status AS ENUM (
  'pending',
  'in_progress',
  'paused',
  'completed',
  'cancelled'
);

CREATE TYPE repair_invoice_status AS ENUM (
  'draft',
  'issued',
  'partial_paid',
  'paid',
  'cancelled',
  'overdue'
);

CREATE TYPE warranty_status AS ENUM (
  'active',
  'claimed',
  'resolved',
  'expired'
);

CREATE TYPE sky_conversation_app_context AS ENUM (
  'web-broker',
  'web-garage',
  'web-customer-portal',
  'web-assure-portal',
  'web-insurtech-admin'
);

CREATE TYPE mcp_token_status AS ENUM (
  'active',
  'revoked',
  'expired'
);

-- ==========================================================================
-- VERTICAL REPAIR v2.2 (5 tables nouvelles -- aligne sprints B-19)
-- ==========================================================================

-- repair_garages : entity garages avec capacities + specialties
-- Skalean Atlas premier seed Sprint 19
CREATE TABLE repair_garages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  ice VARCHAR(20),
  rc VARCHAR(50),
  patente VARCHAR(50),
  address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL,
  region VARCHAR(100),
  postal_code VARCHAR(20),
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  phone VARCHAR(20),
  email CITEXT,
  capacities JSONB NOT NULL DEFAULT '{}',
  specialties JSONB NOT NULL DEFAULT '[]',
  services_offered JSONB NOT NULL DEFAULT '[]',
  opening_hours JSONB NOT NULL DEFAULT '{}',
  is_skalean_atlas BOOLEAN NOT NULL DEFAULT false,
  certifications JSONB NOT NULL DEFAULT '[]',
  active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)  -- 1 garage par tenant (pour Skalean Atlas + partenaires Sprint 25)
);

CREATE INDEX idx_repair_garages_city ON repair_garages(city);
CREATE INDEX idx_repair_garages_geo ON repair_garages(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_repair_garages_atlas ON repair_garages(is_skalean_atlas) WHERE is_skalean_atlas = true;

COMMENT ON TABLE repair_garages IS 'Entites garages tenants Repair -- Skalean Atlas + partenaires Sprint 25';

-- repair_diagnostics : diagnostic engine (basique Sprint 19, IA-augmented Sprint 20+29)
CREATE TABLE repair_diagnostics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  technician_user_id UUID REFERENCES auth_users(id),
  problems_identified JSONB NOT NULL DEFAULT '[]',
  parts_required JSONB NOT NULL DEFAULT '[]',
  estimated_hours NUMERIC(5, 2),
  estimated_cost_cents BIGINT,
  ai_estimation_id UUID,  -- FK to repair_ia_estimations Sprint 20
  ai_confidence_score NUMERIC(5, 2),
  technician_notes TEXT,
  photos_count INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repair_diag_sinistre ON repair_diagnostics(sinistre_id);
CREATE INDEX idx_repair_diag_tech ON repair_diagnostics(technician_user_id);

COMMENT ON TABLE repair_diagnostics IS 'Diagnostic technique vehicule sinistre (Sprint 19 + IA Sprint 20)';

-- repair_ia_estimations : storage IA results (Sprint 20)
CREATE TABLE repair_ia_estimations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  diagnostic_id UUID REFERENCES repair_diagnostics(id),
  provider VARCHAR(20) NOT NULL DEFAULT 'mock',  -- 'mock' Sprint 20, 'skalean_ai' Sprint 29
  damages_detected JSONB NOT NULL DEFAULT '[]',
  parts_suggested JSONB NOT NULL DEFAULT '[]',
  cost_estimate_cents BIGINT,
  confidence_score NUMERIC(5, 2),
  zones_detected JSONB,
  raw_response JSONB,
  cost_per_call_mad NUMERIC(10, 4),  -- Cost tracking (Sprint 29)
  cached BOOLEAN NOT NULL DEFAULT false,
  technician_validated BOOLEAN NOT NULL DEFAULT false,
  technician_edited_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_repair_ia_sinistre ON repair_ia_estimations(sinistre_id);
CREATE INDEX idx_repair_ia_provider ON repair_ia_estimations(provider);

COMMENT ON TABLE repair_ia_estimations IS 'Estimations IA photos sinistre (Sprint 20 mock + Sprint 29 real)';

-- repair_orders : ordres reparation post-approbation devis (renommage repair_factures coming + new structure)
CREATE TABLE repair_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  devis_id UUID REFERENCES repair_devis(id),
  reference VARCHAR(50) NOT NULL,
  technician_user_id UUID REFERENCES auth_users(id),
  status repair_order_status NOT NULL DEFAULT 'pending',
  hours_logged NUMERIC(5, 2) NOT NULL DEFAULT 0,
  parts_consumed JSONB NOT NULL DEFAULT '[]',  -- references stock_movements
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  resumed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  qc_passed BOOLEAN,
  qc_notes TEXT,
  qc_user_id UUID REFERENCES auth_users(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX idx_repair_orders_sinistre ON repair_orders(sinistre_id);
CREATE INDEX idx_repair_orders_status ON repair_orders(status);
CREATE INDEX idx_repair_orders_tech ON repair_orders(technician_user_id);

COMMENT ON TABLE repair_orders IS 'Ordres reparation post-approbation devis (Sprint 19) -- tracking heures + parts + QC';

-- repair_invoices : factures finales (alias generalise de repair_factures avec naming v2.2)
-- Note : table repair_factures existe deja PARTIE2 ; repair_invoices peut etre VIEW alias OR nouvelle table
-- Decision : nouvelle table repair_invoices (cleaner separation Sprint 19 vs legacy)
CREATE TABLE repair_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  order_id UUID REFERENCES repair_orders(id),
  reference VARCHAR(50) NOT NULL,
  invoice_type VARCHAR(20) NOT NULL,  -- 'insurer' | 'customer' | 'split'
  recipient_party VARCHAR(20) NOT NULL,  -- 'insurer' | 'customer'
  recipient_id UUID,  -- contact_id OR assureur_id
  amount_pieces_cents BIGINT NOT NULL DEFAULT 0,
  amount_main_oeuvre_cents BIGINT NOT NULL DEFAULT 0,
  amount_paint_cents BIGINT NOT NULL DEFAULT 0,
  amount_total_ht_cents BIGINT NOT NULL,
  amount_tva_cents BIGINT NOT NULL,
  amount_tva_rate NUMERIC(5, 2) NOT NULL DEFAULT 20,
  amount_total_ttc_cents BIGINT NOT NULL,
  status repair_invoice_status NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_transaction_id UUID,
  pdf_document_id UUID REFERENCES docs_documents(id),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX idx_repair_invoices_sinistre ON repair_invoices(sinistre_id);
CREATE INDEX idx_repair_invoices_status ON repair_invoices(status);
CREATE INDEX idx_repair_invoices_recipient ON repair_invoices(recipient_party, recipient_id);

COMMENT ON TABLE repair_invoices IS 'Factures finales sinistre (Sprint 19) -- split insurer/customer';

-- repair_warranties : garanties post-reparation
CREATE TABLE repair_warranties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  sinistre_id UUID NOT NULL REFERENCES repair_sinistres(id),
  order_id UUID REFERENCES repair_orders(id),
  reference VARCHAR(50) NOT NULL,
  warranty_type VARCHAR(50) NOT NULL,  -- 'parts' | 'labor' | 'paint' | 'all'
  duration_months INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status warranty_status NOT NULL DEFAULT 'active',
  claimed_at TIMESTAMPTZ,
  claim_reason TEXT,
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX idx_repair_warranties_sinistre ON repair_warranties(sinistre_id);
CREATE INDEX idx_repair_warranties_status ON repair_warranties(status);

COMMENT ON TABLE repair_warranties IS 'Garanties post-reparation (Sprint 19) -- parts + labor + paint';

-- ==========================================================================
-- AGENT SKY v2.2 (Sprint 31)
-- ==========================================================================

-- sky_conversations : remplace insure_sky_conversations (legacy v2.0)
CREATE TABLE sky_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id),
  app_context sky_conversation_app_context NOT NULL,
  locale locale_code NOT NULL DEFAULT 'fr',
  title VARCHAR(255),
  total_messages INTEGER NOT NULL DEFAULT 0,
  total_tools_called INTEGER NOT NULL DEFAULT 0,
  user_satisfaction NUMERIC(3, 2),  -- 1-5 rating
  resolved BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sky_conv_user ON sky_conversations(user_id);
CREATE INDEX idx_sky_conv_app ON sky_conversations(app_context);
CREATE INDEX idx_sky_conv_started ON sky_conversations(started_at DESC);

COMMENT ON TABLE sky_conversations IS 'Conversations Sky agent multilingue (Sprint 31) -- replace insure_sky_conversations legacy';

-- sky_messages : messages individuels par conversation
CREATE TABLE sky_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES sky_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- 'user' | 'assistant' | 'tool' | 'system'
  content TEXT NOT NULL,
  tool_calls JSONB,  -- if assistant invoked tools
  tool_name VARCHAR(100),  -- if role='tool'
  tool_result JSONB,  -- if role='tool'
  tokens_used INTEGER,
  cost_mad NUMERIC(10, 6),
  latency_ms INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sky_msg_conversation ON sky_messages(conversation_id);
CREATE INDEX idx_sky_msg_role ON sky_messages(role);
CREATE INDEX idx_sky_msg_created ON sky_messages(created_at DESC);

COMMENT ON TABLE sky_messages IS 'Messages individuels conversations Sky (Sprint 31) -- streaming + tool calls';

-- ==========================================================================
-- MCP SERVER v2.2 (Sprint 30)
-- ==========================================================================

-- mcp_client_credentials : auth strategy MCP server
CREATE TABLE mcp_client_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id VARCHAR(100) NOT NULL UNIQUE,
  client_name VARCHAR(255) NOT NULL,
  client_type VARCHAR(50) NOT NULL,  -- 'sky_agent' | 'admin_tool' | 'partner_integration'
  client_secret_hash TEXT NOT NULL,
  scopes JSONB NOT NULL DEFAULT '[]',  -- ['tools:read:policies', 'tools:write:appointments', etc.]
  status mcp_token_status NOT NULL DEFAULT 'active',
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_rotation_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_creds_status ON mcp_client_credentials(status);
CREATE INDEX idx_mcp_creds_type ON mcp_client_credentials(client_type);

-- mcp_audit_log : audit complet calls MCP
CREATE TABLE mcp_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id VARCHAR(100) NOT NULL,
  tenant_id UUID,  -- impersonation context
  user_id UUID,  -- impersonated user if applicable
  tool_name VARCHAR(100) NOT NULL,
  tool_input JSONB,
  tool_output_summary TEXT,
  status VARCHAR(20) NOT NULL,  -- 'success' | 'error' | 'unauthorized'
  error_message TEXT,
  latency_ms INTEGER,
  trace_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcp_audit_client ON mcp_audit_log(client_id, created_at DESC);
CREATE INDEX idx_mcp_audit_tool ON mcp_audit_log(tool_name);
CREATE INDEX idx_mcp_audit_status ON mcp_audit_log(status);

COMMENT ON TABLE mcp_client_credentials IS 'MCP server auth tokens (Sprint 30) -- separate JWT lifecycle';
COMMENT ON TABLE mcp_audit_log IS 'Audit complet appels MCP tools (Sprint 30) -- compliance + monitoring';

-- ==========================================================================
-- WEBAUTHN BIOMETRIC v2.2 (Sprint 23 -- web-garage-mobile)
-- ==========================================================================

-- auth_webauthn_credentials : biometric login technicien (PWA mobile)
CREATE TABLE auth_webauthn_credentials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  credential_id BYTEA NOT NULL UNIQUE,
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_name VARCHAR(255),
  device_type VARCHAR(50),  -- 'platform' (Touch ID, Face ID) | 'cross-platform' (USB key)
  transports JSONB NOT NULL DEFAULT '[]',
  aaguid BYTEA,  -- authenticator id
  attestation_format VARCHAR(50),
  user_verified BOOLEAN NOT NULL DEFAULT false,
  last_used_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webauthn_user ON auth_webauthn_credentials(user_id);
CREATE INDEX idx_webauthn_active ON auth_webauthn_credentials(user_id, active) WHERE active = true;

COMMENT ON TABLE auth_webauthn_credentials IS 'Credentials WebAuthn biometric login (Sprint 23) -- web-garage-mobile technicien';

-- ==========================================================================
-- ALIGNEMENT INSURE NAMING v2.2 (alias views pour compatibilite)
-- ==========================================================================

-- Sprints v2.2 utilisent naming english (insure_policies, insure_quotes, etc.) mais schema PARTIE2 utilise francais (insure_polices, insure_devis, etc.)
-- Solution : creer VIEWS alias pour compatibilite ORM TypeORM
-- Equipe peut decider Sprint 14 d'aligner schema PARTIE2 OR utiliser views

CREATE OR REPLACE VIEW insure_policies AS SELECT * FROM insure_polices;
CREATE OR REPLACE VIEW insure_quotes AS SELECT * FROM insure_devis;
CREATE OR REPLACE VIEW insure_renewals AS SELECT * FROM insure_renouvellements;
CREATE OR REPLACE VIEW insure_products AS SELECT * FROM insure_produits;

COMMENT ON VIEW insure_policies IS 'Alias english naming v2.2 -- read-only (write via insure_polices)';
COMMENT ON VIEW insure_quotes IS 'Alias english naming v2.2 -- read-only (write via insure_devis)';
COMMENT ON VIEW insure_renewals IS 'Alias english naming v2.2 -- read-only (write via insure_renouvellements)';
COMMENT ON VIEW insure_products IS 'Alias english naming v2.2 -- read-only (write via insure_produits)';

-- Note : Sprint 14 implementation peut decider :
-- Option A : Continuer utiliser insure_polices (francais legacy) avec entities TypeORM @Entity({ name: 'insure_polices' })
-- Option B : Renommer schema PARTIE2 vers anglais (migration ALTER TABLE RENAME) + supprimer views

-- ==========================================================================
-- TABLE insure_premiums (NOUVELLE v2.2 -- pas dans PARTIE2)
-- ==========================================================================

-- Sprint 14 mentionne 'premiums' entity. Schema PARTIE2 ne l'a pas.
-- Decision v2.2 : creer table dediee insure_premiums (vs JSONB column dans insure_polices)
CREATE TABLE insure_premiums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES insure_polices(id) ON DELETE CASCADE,
  reference VARCHAR(50) NOT NULL,
  amount_ht_cents BIGINT NOT NULL,
  amount_taxes_cents BIGINT NOT NULL,
  amount_ttc_cents BIGINT NOT NULL,
  payment_frequency VARCHAR(20) NOT NULL,  -- 'annual' | 'biannual' | 'quarterly' | 'monthly'
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending' | 'paid' | 'partial' | 'overdue' | 'refunded'
  paid_at TIMESTAMPTZ,
  payment_transaction_id UUID,
  reminder_sent_at JSONB,  -- timestamps des reminders 15j/7j/3j (Sprint 14)
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX idx_insure_premiums_policy ON insure_premiums(policy_id);
CREATE INDEX idx_insure_premiums_status ON insure_premiums(status);
CREATE INDEX idx_insure_premiums_due ON insure_premiums(due_date) WHERE status IN ('pending', 'overdue');

COMMENT ON TABLE insure_premiums IS 'Echeancier primes police (Sprint 14) -- tracking paiements + reminders';

-- ==========================================================================
-- DROP insure_sky_conversations (legacy v2.0 -- replaced by sky_conversations)
-- ==========================================================================

-- IMPORTANT : Si insure_sky_conversations existe deja avec data, faire migration
-- Decision v2.2 : insure_sky_conversations etait pre-vu mais non utilise (sky deplace Sprint 31 v2.2)
-- Drop safely (table vide en pratique)

-- DROP TABLE IF EXISTS insure_sky_conversations CASCADE;
-- Commenter par defaut -- equipe decide manuellement Sprint 31

-- ==========================================================================
-- TRIGGERS updated_at sur nouvelles tables v2.2
-- ==========================================================================

CREATE TRIGGER trg_set_updated_at_repair_garages
BEFORE UPDATE ON repair_garages
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_repair_diagnostics
BEFORE UPDATE ON repair_diagnostics
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_repair_orders
BEFORE UPDATE ON repair_orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_repair_invoices
BEFORE UPDATE ON repair_invoices
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_repair_warranties
BEFORE UPDATE ON repair_warranties
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_sky_conversations
BEFORE UPDATE ON sky_conversations
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_mcp_credentials
BEFORE UPDATE ON mcp_client_credentials
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_set_updated_at_insure_premiums
BEFORE UPDATE ON insure_premiums
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ==========================================================================
-- RLS POLICIES (multi-tenant) sur nouvelles tables v2.2
-- ==========================================================================

ALTER TABLE repair_garages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_garages
  USING (app_can_access_tenant(tenant_id));

ALTER TABLE repair_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_diagnostics
  USING (app_can_access_tenant(tenant_id));

ALTER TABLE repair_ia_estimations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_ia_estimations
  USING (app_can_access_tenant(tenant_id));

ALTER TABLE repair_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_orders
  USING (app_can_access_tenant(tenant_id));

ALTER TABLE repair_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_invoices
  USING (app_can_access_tenant(tenant_id));

ALTER TABLE repair_warranties ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON repair_warranties
  USING (app_can_access_tenant(tenant_id));

ALTER TABLE sky_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON sky_conversations
  USING (app_can_access_tenant(tenant_id));

ALTER TABLE insure_premiums ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON insure_premiums
  USING (app_can_access_tenant(tenant_id));

-- mcp_client_credentials et mcp_audit_log = pas RLS (table cross-tenant centralisee)
-- auth_webauthn_credentials = RLS basee sur user_id (filtre via TenantContext.userId)

-- ==========================================================================
-- BILAN v2.2 ADDITIONS
-- ==========================================================================
--
-- 12 nouvelles tables :
--
-- REPAIR v2.2 (6) :
--   - repair_garages
--   - repair_diagnostics
--   - repair_ia_estimations
--   - repair_orders
--   - repair_invoices (vs legacy repair_factures)
--   - repair_warranties
--
-- SKY (Sprint 31) (2) :
--   - sky_conversations
--   - sky_messages
--
-- MCP (Sprint 30) (2) :
--   - mcp_client_credentials
--   - mcp_audit_log
--
-- AUTH (Sprint 23) (1) :
--   - auth_webauthn_credentials
--
-- INSURE (Sprint 14) (1) :
--   - insure_premiums
--
-- 4 VIEWS alias english naming :
--   - insure_policies, insure_quotes, insure_renewals, insure_products
--
-- 7 ENUM types nouveaux :
--   - repair_sinistre_status, repair_devis_status, repair_order_status, repair_invoice_status, warranty_status
--   - sky_conversation_app_context
--   - mcp_token_status
--
-- 8 triggers updated_at
-- 8 RLS policies tenant_isolation
--
-- Total tables projet skalean-insurtech v2.2 : 69 + 12 = 81 tables
-- ==========================================================================

-- Fin du fichier 3-schemas-database-v2.2-additions.sql
