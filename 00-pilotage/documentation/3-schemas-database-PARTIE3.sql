-- ==========================================================================
-- SCHEMA POSTGRESQL skalean-insurtech -- DEFINITION COMPLETE PARTIE 3/3 (v2.0)
-- Version : 1.0.0
-- Date : 2026-05-04
-- Description : Schema des nouvelles tables flux clients (prospects, assures,
--               documents uploadees, garages agrees par assureur, declarations
--               sinistres clients, sessions customer portal)
-- AUCUNE EMOJI AUTORISEE
--
-- Prerequis :
--   - 3-schemas-database-PARTIE1.sql doit etre execute en premier
--   - 3-schemas-database-PARTIE2.sql doit etre execute en deuxieme
--
-- Apport v2.0 :
--   - 7 nouvelles tables pour les flux web-customer-portal et web-assure-portal
--   - Mise a jour cross_tenant_authorizations pour supporter assure -> garage
--   - Vues materialisees pour visibilite read-only courtier sur sinistres clients
-- ==========================================================================

-- ==========================================================================
-- TYPES ENUM ADDITIONNELS V2.0
-- ==========================================================================

CREATE TYPE prospect_quote_status AS ENUM (
  'started',           -- prospect a commence la cotation
  'criteria_filled',   -- criteres saisis
  'compared',          -- resultats compares affiches
  'selected',          -- produit selectionne
  'account_created',   -- compte cree
  'expired',           -- session expiree
  'abandoned'          -- abandon explicit
);

CREATE TYPE kyc_status AS ENUM (
  'pending',           -- documents uploades, en attente
  'auto_approved',     -- KYC auto approuve par Skalean AI
  'manual_review',     -- escalade manuelle requise
  'approved',          -- approuve par humain
  'rejected',          -- rejete (raison stockee)
  'expired'            -- documents expires
);

CREATE TYPE provisional_policy_status AS ENUM (
  'draft',             -- preparation
  'signed',            -- signe par prospect
  'paid',              -- paiement initial recu
  'pending_broker_validation',  -- en file courtier
  'broker_validated',  -- courtier a valide
  'broker_rejected',   -- courtier a rejete
  'submitted_to_insurer',  -- envoye a l'assureur
  'finalized',         -- police definitive emise
  'expired',           -- 7 jours sans validation -> expire
  'cancelled'          -- annule
);

CREATE TYPE assure_sinistre_declaration_status AS ENUM (
  'draft',             -- en cours de saisie
  'submitted',         -- envoyee
  'sent_to_insurer',   -- envoyee a l'assureur
  'insurer_acknowledged',  -- recu cote assureur
  'garage_selection_pending',  -- en attente de choix garage
  'garage_selected',   -- garage choisi
  'in_repair_workflow',  -- pris en charge par garage (workflow normal)
  'closed',            -- cloture
  'rejected_by_insurer'  -- rejete par assureur (apres analyse)
);

-- ==========================================================================
-- PROSPECTS ET COTATION (web-customer-portal sans auth)
-- ==========================================================================

-- Sessions intermediaires des prospects -- TTL 30 minutes en Redis,
-- DB pour audit et conversion analytics
CREATE TABLE customer_session_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token VARCHAR(64) NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  preferred_locale locale_code NOT NULL DEFAULT 'fr',
  current_step VARCHAR(50) NOT NULL DEFAULT 'landing',
  state_data JSONB NOT NULL DEFAULT '{}',
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  referrer_url TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 minutes',
  converted_to_user_id UUID REFERENCES auth_users(id),
  converted_at TIMESTAMPTZ
);

CREATE INDEX idx_customer_session_token ON customer_session_states(session_token);
CREATE INDEX idx_customer_session_expires ON customer_session_states(expires_at);
CREATE INDEX idx_customer_session_converted ON customer_session_states(converted_to_user_id) WHERE converted_to_user_id IS NOT NULL;


-- Demandes de cotation des prospects
CREATE TABLE prospect_quote_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_state_id UUID REFERENCES customer_session_states(id) ON DELETE CASCADE,
  insurance_type VARCHAR(50) NOT NULL,
  criteria JSONB NOT NULL,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(30),
  contact_name VARCHAR(255),
  status prospect_quote_status NOT NULL DEFAULT 'started',
  ip_address INET,
  user_agent TEXT,
  preferred_locale locale_code NOT NULL DEFAULT 'fr',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  converted_to_user_id UUID REFERENCES auth_users(id),
  converted_at TIMESTAMPTZ,
  CONSTRAINT chk_quote_insurance_type CHECK (insurance_type IN ('auto', 'habitation', 'sante', 'vie', 'pro'))
);

CREATE INDEX idx_prospect_quote_session ON prospect_quote_requests(session_state_id);
CREATE INDEX idx_prospect_quote_status ON prospect_quote_requests(status);
CREATE INDEX idx_prospect_quote_email ON prospect_quote_requests(contact_email) WHERE contact_email IS NOT NULL;
CREATE INDEX idx_prospect_quote_expires ON prospect_quote_requests(expires_at);
CREATE INDEX idx_prospect_quote_converted ON prospect_quote_requests(converted_to_user_id) WHERE converted_to_user_id IS NOT NULL;


-- Resultats cotation IA -- 1 ligne par produit assureur match
CREATE TABLE prospect_quotes_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_request_id UUID NOT NULL REFERENCES prospect_quote_requests(id) ON DELETE CASCADE,
  assureur_id UUID NOT NULL REFERENCES insure_assureurs(id),
  produit_id UUID NOT NULL REFERENCES insure_produits(id),
  amount_annual NUMERIC(15, 2) NOT NULL,
  amount_monthly NUMERIC(15, 2),
  garanties_included JSONB NOT NULL DEFAULT '[]',
  garanties_optional JSONB NOT NULL DEFAULT '[]',
  ai_match_score NUMERIC(5, 2),
  ai_recommendations JSONB,
  rank INTEGER NOT NULL,
  raw_response_assureur JSONB,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  selected_at TIMESTAMPTZ,
  selected_garanties_optional JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prospect_quotes_results_request ON prospect_quotes_results(quote_request_id);
CREATE INDEX idx_prospect_quotes_results_selected ON prospect_quotes_results(is_selected) WHERE is_selected = TRUE;

-- ==========================================================================
-- DOCUMENTS UPLOADES PAR ASSURE (KYC)
-- ==========================================================================

CREATE TABLE assure_documents_uploaded (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  related_quote_request_id UUID REFERENCES prospect_quote_requests(id),
  related_provisional_policy_id UUID,
  document_type VARCHAR(50) NOT NULL,
  document_id UUID NOT NULL REFERENCES docs_documents(id),
  status kyc_status NOT NULL DEFAULT 'pending',
  ai_analysis JSONB,
  ai_confidence_score NUMERIC(5, 2),
  validation_errors JSONB,
  rejected_reason TEXT,
  reviewed_by_user_id UUID REFERENCES auth_users(id),
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_document_type CHECK (document_type IN ('cin_recto', 'cin_verso', 'carte_grise', 'permis_conduire', 'releve_bancaire', 'attestation_employeur', 'rapport_inspection', 'autre'))
);

CREATE INDEX idx_assure_docs_tenant ON assure_documents_uploaded(tenant_id);
CREATE INDEX idx_assure_docs_user ON assure_documents_uploaded(user_id);
CREATE INDEX idx_assure_docs_quote ON assure_documents_uploaded(related_quote_request_id) WHERE related_quote_request_id IS NOT NULL;
CREATE INDEX idx_assure_docs_status ON assure_documents_uploaded(status);

-- ==========================================================================
-- DOCUMENTS PROVISOIRES (Pre-approbation)
-- ==========================================================================

CREATE TABLE assure_provisional_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  quote_request_id UUID NOT NULL REFERENCES prospect_quote_requests(id),
  selected_quote_result_id UUID NOT NULL REFERENCES prospect_quotes_results(id),
  reference VARCHAR(50) NOT NULL,
  status provisional_policy_status NOT NULL DEFAULT 'draft',
  amount_annual NUMERIC(15, 2) NOT NULL,
  amount_paid_initial NUMERIC(15, 2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  garanties_active JSONB NOT NULL,
  generated_pdf_document_id UUID REFERENCES docs_documents(id),
  signature_id UUID REFERENCES docs_signatures(id),
  signed_at TIMESTAMPTZ,
  paid_transaction_id UUID REFERENCES pay_transactions(id),
  paid_at TIMESTAMPTZ,
  broker_assigned_user_id UUID REFERENCES auth_users(id),
  broker_validation_due_at TIMESTAMPTZ,
  broker_validated_at TIMESTAMPTZ,
  broker_validated_by_user_id UUID REFERENCES auth_users(id),
  broker_rejection_reason TEXT,
  finalized_police_id UUID REFERENCES insure_polices(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference)
);

CREATE INDEX idx_provisional_tenant ON assure_provisional_policies(tenant_id);
CREATE INDEX idx_provisional_user ON assure_provisional_policies(user_id);
CREATE INDEX idx_provisional_status ON assure_provisional_policies(status);
CREATE INDEX idx_provisional_broker_queue ON assure_provisional_policies(status, broker_validation_due_at) WHERE status = 'pending_broker_validation';
CREATE INDEX idx_provisional_expires ON assure_provisional_policies(expires_at);

-- Lien circulaire : maintenant que provisional existe, on ajoute la FK manquante
ALTER TABLE assure_documents_uploaded
ADD CONSTRAINT fk_assure_docs_provisional
  FOREIGN KEY (related_provisional_policy_id)
  REFERENCES assure_provisional_policies(id);

-- ==========================================================================
-- GARAGES AGREES PAR ASSUREUR (synchronise depuis API assureur)
-- ==========================================================================

CREATE TABLE assureur_garages_agrees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assureur_id UUID NOT NULL REFERENCES insure_assureurs(id) ON DELETE CASCADE,
  garage_tenant_id UUID REFERENCES auth_tenants(id),
  external_garage_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255),
  address_line VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  postal_code VARCHAR(20),
  region VARCHAR(100),
  country_code CHAR(2) NOT NULL DEFAULT 'MA',
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  phone_number VARCHAR(30),
  email VARCHAR(255),
  specialites JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  agree_since DATE,
  agree_until DATE,
  capacity_slots_per_day INTEGER NOT NULL DEFAULT 5,
  rating NUMERIC(3, 2),
  rating_count INTEGER NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assureur_id, external_garage_id)
);

CREATE INDEX idx_garages_agrees_assureur ON assureur_garages_agrees(assureur_id);
CREATE INDEX idx_garages_agrees_city ON assureur_garages_agrees(city);
CREATE INDEX idx_garages_agrees_active ON assureur_garages_agrees(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_garages_agrees_geo ON assureur_garages_agrees(latitude, longitude);
CREATE INDEX idx_garages_agrees_tenant_link ON assureur_garages_agrees(garage_tenant_id) WHERE garage_tenant_id IS NOT NULL;

-- ==========================================================================
-- DECLARATIONS SINISTRE COTE CLIENT (web-assure-mobile)
-- ==========================================================================

CREATE TABLE assure_sinistre_declarations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  policy_id UUID NOT NULL REFERENCES insure_polices(id),
  reference VARCHAR(50) NOT NULL,
  sinistre_type VARCHAR(50) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  occurred_location_lat NUMERIC(10, 7),
  occurred_location_lng NUMERIC(10, 7),
  occurred_location_address TEXT,
  description TEXT,
  description_locale locale_code NOT NULL DEFAULT 'fr',
  voice_transcript_audio_id UUID REFERENCES docs_documents(id),
  constat_amiable_document_id UUID REFERENCES docs_documents(id),
  initial_photos_count INTEGER NOT NULL DEFAULT 0,
  status assure_sinistre_declaration_status NOT NULL DEFAULT 'draft',
  insurer_reference VARCHAR(100),
  insurer_acknowledged_at TIMESTAMPTZ,
  insurer_response_data JSONB,
  selected_garage_agree_id UUID REFERENCES assureur_garages_agrees(id),
  selected_garage_tenant_id UUID REFERENCES auth_tenants(id),
  garage_selected_at TIMESTAMPTZ,
  cross_tenant_authorization_id UUID,
  related_repair_sinistre_id UUID,
  declared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, reference),
  CONSTRAINT chk_sinistre_type CHECK (sinistre_type IN ('accident', 'vol', 'bris_glace', 'incendie', 'degat_eaux', 'tempete', 'autre'))
);

CREATE INDEX idx_assure_sin_decl_tenant ON assure_sinistre_declarations(tenant_id);
CREATE INDEX idx_assure_sin_decl_user ON assure_sinistre_declarations(user_id);
CREATE INDEX idx_assure_sin_decl_policy ON assure_sinistre_declarations(policy_id);
CREATE INDEX idx_assure_sin_decl_status ON assure_sinistre_declarations(status);
CREATE INDEX idx_assure_sin_decl_garage ON assure_sinistre_declarations(selected_garage_tenant_id) WHERE selected_garage_tenant_id IS NOT NULL;

-- Lien circulaire avec repair_sinistres une fois pris en charge garage
ALTER TABLE assure_sinistre_declarations
ADD CONSTRAINT fk_assure_sin_decl_repair
  FOREIGN KEY (related_repair_sinistre_id)
  REFERENCES repair_sinistres(id);

-- ==========================================================================
-- MISE A JOUR cross_tenant_authorizations pour client -> garage (v2.0)
-- ==========================================================================

-- La table existait deja en Sprint 6 (Phase 7 -- Sprint 26 ancien numero).
-- Nous l'enrichissons avec un type explicite distinguant les autorisations.

-- Ajouter colonne authorization_type pour distinguer broker/garage,
-- client/garage, internal_admin
ALTER TABLE cross_tenant_authorizations
ADD COLUMN authorization_type VARCHAR(50) NOT NULL DEFAULT 'client_to_garage';

ALTER TABLE cross_tenant_authorizations
ADD CONSTRAINT chk_cross_tenant_auth_type
  CHECK (authorization_type IN ('client_to_garage', 'broker_readonly_garage', 'admin_temporary_access'));

-- Index pour requete frequente "autorisations actives pour un sinistre"
CREATE INDEX idx_cross_tenant_auth_type_entity ON cross_tenant_authorizations(authorization_type, related_entity_type, related_entity_id);

-- ==========================================================================
-- VUES MATERIALISEES POUR VISIBILITE READ-ONLY COURTIER
-- ==========================================================================

-- Vue materialiseee : sinistres des clients d'un courtier (read-only)
-- Le courtier consulte ses clients sinistres sans toucher au tenant garage
CREATE MATERIALIZED VIEW mv_broker_sinistres_clients AS
SELECT
  p.tenant_id AS broker_tenant_id,
  p.id AS policy_id,
  p.policy_number,
  p.contact_id,
  c.first_name || ' ' || c.last_name AS contact_name,
  c.phone_number AS contact_phone,
  c.email AS contact_email,
  asd.id AS assure_declaration_id,
  asd.reference AS assure_sinistre_reference,
  asd.sinistre_type,
  asd.occurred_at,
  asd.declared_at,
  asd.status AS declaration_status,
  rs.id AS repair_sinistre_id,
  rs.reference AS repair_sinistre_reference,
  rs.status AS repair_status,
  rs.tenant_id AS garage_tenant_id,
  ag.name AS garage_name,
  ag.city AS garage_city,
  rs.received_at,
  rs.closed_at
FROM insure_polices p
JOIN crm_contacts c ON c.id = p.contact_id AND c.tenant_id = p.tenant_id
LEFT JOIN assure_sinistre_declarations asd ON asd.policy_id = p.id
LEFT JOIN repair_sinistres rs ON rs.id = asd.related_repair_sinistre_id
LEFT JOIN assureur_garages_agrees ag ON ag.id = asd.selected_garage_agree_id
WHERE p.deleted_at IS NULL;

CREATE UNIQUE INDEX idx_mv_broker_sin_unique ON mv_broker_sinistres_clients(policy_id, COALESCE(assure_declaration_id, '00000000-0000-0000-0000-000000000000'::UUID));
CREATE INDEX idx_mv_broker_sin_tenant ON mv_broker_sinistres_clients(broker_tenant_id);
CREATE INDEX idx_mv_broker_sin_status ON mv_broker_sinistres_clients(repair_status);

-- Refresh job (a executer toutes les 5 minutes via cron NestJS)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY mv_broker_sinistres_clients;


-- Vue : file d'attente courtier (provisional policies en attente validation)
CREATE VIEW v_broker_validation_queue AS
SELECT
  pp.id,
  pp.tenant_id AS broker_tenant_id,
  pp.user_id AS assure_user_id,
  u.first_name || ' ' || u.last_name AS assure_name,
  u.email AS assure_email,
  u.phone_number AS assure_phone,
  pp.reference,
  pp.amount_annual,
  pp.start_date,
  pp.end_date,
  qr.insurance_type,
  qr.criteria,
  pqr.assureur_id,
  a.name AS assureur_name,
  pp.signed_at,
  pp.paid_at,
  pp.broker_validation_due_at,
  EXTRACT(EPOCH FROM (pp.broker_validation_due_at - NOW())) / 3600 AS hours_remaining,
  pp.broker_assigned_user_id,
  pp.created_at
FROM assure_provisional_policies pp
JOIN auth_users u ON u.id = pp.user_id
LEFT JOIN prospect_quote_requests qr ON qr.id = pp.quote_request_id
LEFT JOIN prospect_quotes_results pqr ON pqr.id = pp.selected_quote_result_id
LEFT JOIN insure_assureurs a ON a.id = pqr.assureur_id
WHERE pp.status = 'pending_broker_validation';

-- ==========================================================================
-- TRIGGERS UPDATED_AT POUR NOUVELLES TABLES V2.0
-- ==========================================================================

CREATE TRIGGER set_updated_at BEFORE UPDATE ON prospect_quote_requests FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assure_documents_uploaded FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assure_provisional_policies FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assureur_garages_agrees FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assure_sinistre_declarations FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ==========================================================================
-- COMMENTAIRES SUR LES NOUVELLES TABLES (documentation inline)
-- ==========================================================================

COMMENT ON TABLE customer_session_states IS 'Sessions intermediaires des prospects sur web-customer-portal -- TTL 30 min Redis primaire';
COMMENT ON TABLE prospect_quote_requests IS 'Demandes de cotation prospects publics -- TTL 30 jours, anonymise apres si non converti';
COMMENT ON TABLE prospect_quotes_results IS 'Resultats cotation IA matches par produit assureur';
COMMENT ON TABLE assure_documents_uploaded IS 'Documents pieces uploades par assures (CIN, carte grise) avec status KYC';
COMMENT ON TABLE assure_provisional_policies IS 'Documents provisoires generes apres pre-approbation, TTL 7 jours pour validation courtier';
COMMENT ON TABLE assureur_garages_agrees IS 'Referentiel garages agrees par assureur, sync quotidien depuis API assureur';
COMMENT ON TABLE assure_sinistre_declarations IS 'Declarations sinistre cote client (web-assure-mobile) -- avant routage assureur et choix garage';

-- ==========================================================================
-- FIN DU SCHEMA -- PARTIE 3/3 (v2.0)
-- ==========================================================================
--
-- Bilan tables creees v2.0 (7 nouvelles) :
--
-- 1. customer_session_states
-- 2. prospect_quote_requests
-- 3. prospect_quotes_results
-- 4. assure_documents_uploaded
-- 5. assure_provisional_policies
-- 6. assureur_garages_agrees
-- 7. assure_sinistre_declarations
--
-- Plus :
-- - 4 nouveaux types ENUM
-- - 1 vue materialisee (mv_broker_sinistres_clients)
-- - 1 vue (v_broker_validation_queue)
-- - 5 triggers updated_at
-- - 1 modification de cross_tenant_authorizations (authorization_type)
--
-- Total tables projet skalean-insurtech : 62 + 7 = 69 tables
-- ==========================================================================
