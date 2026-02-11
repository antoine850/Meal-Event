-- ============================================
-- CRM SaaS MealEvent - Supabase Schema
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE / MULTI-TENANT
-- ============================================

-- Organizations (Tenant principal)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  siret VARCHAR(50),
  tva_number VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- Permissions
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  module VARCHAR(50) NOT NULL, -- dashboard, contacts, bookings, quotes, settings, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role Permissions (N:N)
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(50),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, email)
);

-- ============================================
-- RESTAURANTS
-- ============================================

-- Restaurants
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(50),
  email VARCHAR(255),
  description TEXT,
  logo_url TEXT,
  cover_url TEXT,
  color VARCHAR(7), -- Hex color for UI
  capacity INTEGER,
  -- Billing info
  siret VARCHAR(50),
  tva_number VARCHAR(50),
  iban VARCHAR(50),
  bic VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

-- User Restaurants (Liaison users ↔ restaurants pour gérants/responsables)
CREATE TABLE user_restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, restaurant_id)
);

-- Time Slots (Créneaux horaires)
CREATE TABLE time_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL, -- "Déjeuner", "Dîner", etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Restaurant Time Slots (N:N)
CREATE TABLE restaurant_time_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  time_slot_id UUID REFERENCES time_slots(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, time_slot_id)
);

-- Spaces (Espaces/salles par restaurant)
CREATE TABLE spaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  capacity INTEGER,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTACTS & SOCIÉTÉS
-- ============================================

-- Statuses (Pour contacts ET réservations)
CREATE TABLE statuses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  color VARCHAR(7), -- Hex color
  type VARCHAR(50) NOT NULL, -- 'contact', 'booking', 'both'
  position INTEGER DEFAULT 0, -- Pour l'ordre dans le pipeline
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug, type)
);

-- Companies (Sociétés)
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  siret VARCHAR(50),
  tva_number VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100) DEFAULT 'France',
  phone VARCHAR(50),
  email VARCHAR(255),
  website VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  status_id UUID REFERENCES statuses(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Commercial assigné
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(50),
  mobile VARCHAR(50),
  job_title VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  postal_code VARCHAR(20),
  notes TEXT,
  source VARCHAR(100), -- "Google Ads", "Facebook", "Parrainage", etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RÉSERVATIONS
-- ============================================

-- Bookings (Réservations)
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  status_id UUID REFERENCES statuses(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL, -- Commercial
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  time_slot_id UUID REFERENCES time_slots(id) ON DELETE SET NULL,
  -- Booking details
  event_type VARCHAR(100), -- "Anniversaire", "Mariage", "Séminaire", etc.
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  guests_count INTEGER,
  -- Pricing
  total_amount DECIMAL(10, 2) DEFAULT 0,
  deposit_amount DECIMAL(10, 2) DEFAULT 0,
  deposit_percentage DECIMAL(5, 2) DEFAULT 50,
  -- Status flags
  is_table_blocked BOOLEAN DEFAULT FALSE,
  has_extra_provider BOOLEAN DEFAULT FALSE, -- Badge "Presta supplémentaire"
  -- Notes
  internal_notes TEXT,
  client_notes TEXT,
  special_requests TEXT,
  -- Notion link
  notion_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking Events (Multi-events liés à une réservation)
-- Par défaut, chaque réservation a au moins un événement avec tous les détails
CREATE TABLE booking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  -- Infos de base
  name VARCHAR(255) NOT NULL,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  guests_count INTEGER,
  -- Occasion / Type
  occasion VARCHAR(255), -- "Diner d'équipe - Société ORANGE"
  -- Flexibilité
  is_date_flexible BOOLEAN DEFAULT FALSE,
  is_restaurant_flexible BOOLEAN DEFAULT FALSE,
  client_preferred_time VARCHAR(100), -- "20H"
  -- Menu
  menu_aperitif TEXT, -- "3 AB + 1 coupe de champagne"
  menu_entree TEXT, -- "25 La Tartelette"
  menu_plat TEXT, -- "25 L'Orzo"
  menu_dessert TEXT, -- "25 Le Flan"
  menu_boissons TEXT, -- "1/2 bouteille eau + café, 25 formules vin"
  menu_details JSONB, -- Détails structurés du menu si besoin
  -- Mise en place
  mise_en_place TEXT, -- "choix de la direction"
  -- Déroulé
  deroulement TEXT,
  -- Privatif
  is_privatif BOOLEAN DEFAULT FALSE,
  -- Allergies et régimes
  allergies_regimes TEXT, -- "MERCI DE VOIR LE GROUPE EN AMONT..."
  -- Prestations souhaitées
  prestations_souhaitees TEXT,
  -- Budget
  budget_client DECIMAL(10, 2),
  -- Format souhaité
  format_souhaite VARCHAR(255),
  -- Contact sur place
  contact_sur_place_nom VARCHAR(255),
  contact_sur_place_tel VARCHAR(50),
  contact_sur_place_societe VARCHAR(255),
  -- Instructions spéciales
  instructions_speciales TEXT, -- "Sur place faire valider par Caroline..."
  -- Commentaires
  commentaires TEXT,
  -- Dates signature
  date_signature_devis DATE,
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Booking Products & Services
CREATE TABLE booking_products_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  tva_rate DECIMAL(5, 2) DEFAULT 20,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  total_ht DECIMAL(10, 2),
  total_ttc DECIMAL(10, 2),
  is_provider BOOLEAN DEFAULT FALSE, -- Prestataire externe
  provider_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEVIS & PAIEMENTS
-- ============================================

-- Quotes (Devis)
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  quote_number VARCHAR(50) NOT NULL,
  -- Amounts
  total_ht DECIMAL(10, 2) DEFAULT 0,
  total_tva DECIMAL(10, 2) DEFAULT 0,
  total_ttc DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  -- Status
  status VARCHAR(50) DEFAULT 'draft', -- draft, sent, signed, expired, cancelled
  -- Signature
  signature_requested_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signature_url TEXT,
  signer_name VARCHAR(255),
  signer_email VARCHAR(255),
  -- Validity
  valid_until DATE,
  notes TEXT,
  terms TEXT,
  -- PDF
  pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, quote_number)
);

-- Quote Items (Lignes de devis)
CREATE TABLE quote_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  booking_product_service_id UUID REFERENCES booking_products_services(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  tva_rate DECIMAL(5, 2) DEFAULT 20,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_ht DECIMAL(10, 2),
  total_ttc DECIMAL(10, 2),
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  -- Payment details
  amount DECIMAL(10, 2) NOT NULL,
  payment_type VARCHAR(50) NOT NULL, -- 'deposit', 'full', 'remaining', 'extra'
  payment_method VARCHAR(50), -- 'stripe', 'manual', 'cash', 'card', 'transfer'
  -- Stripe
  stripe_payment_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, refunded
  paid_at TIMESTAMPTZ,
  -- Notes
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Links
CREATE TABLE payment_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  -- Link details
  link_type VARCHAR(50) NOT NULL, -- 'deposit', 'full', 'custom'
  amount DECIMAL(10, 2) NOT NULL,
  percentage DECIMAL(5, 2), -- Pour les acomptes personnalisés
  url TEXT NOT NULL,
  -- Stripe
  stripe_link_id VARCHAR(255),
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment Reminders (Relances)
CREATE TABLE payment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  -- Reminder details
  reminder_type VARCHAR(50) NOT NULL, -- 'payment', 'signature', 'deposit', 'review'
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  -- Content
  subject VARCHAR(255),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipts (Tickets de caisse jour J)
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
  -- Receipt details
  amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50), -- 'cash', 'card', 'transfer'
  -- Photo
  photo_url TEXT,
  -- Details
  description TEXT,
  items JSONB, -- Détails des items ajoutés
  -- Submitted by
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  -- Validation
  validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PARAMÈTRES
-- ============================================

-- Settings (Paramètres par organization)
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  -- General
  default_currency VARCHAR(3) DEFAULT 'EUR',
  default_tva_rate DECIMAL(5, 2) DEFAULT 20,
  default_deposit_percentage DECIMAL(5, 2) DEFAULT 50,
  -- Quote settings
  quote_validity_days INTEGER DEFAULT 30,
  quote_prefix VARCHAR(20) DEFAULT 'DEV',
  quote_terms TEXT,
  -- Email settings
  email_sender_name VARCHAR(255),
  email_signature TEXT,
  -- Stripe
  stripe_account_id VARCHAR(255),
  stripe_public_key VARCHAR(255),
  stripe_secret_key VARCHAR(255),
  -- Notifications
  notify_new_booking BOOLEAN DEFAULT TRUE,
  notify_payment_received BOOLEAN DEFAULT TRUE,
  notify_quote_signed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- Users
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role_id);

-- Restaurants
CREATE INDEX idx_restaurants_organization ON restaurants(organization_id);
CREATE INDEX idx_restaurants_slug ON restaurants(slug);

-- Contacts
CREATE INDEX idx_contacts_organization ON contacts(organization_id);
CREATE INDEX idx_contacts_status ON contacts(status_id);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to);
CREATE INDEX idx_contacts_company ON contacts(company_id);

-- Bookings
CREATE INDEX idx_bookings_organization ON bookings(organization_id);
CREATE INDEX idx_bookings_restaurant ON bookings(restaurant_id);
CREATE INDEX idx_bookings_contact ON bookings(contact_id);
CREATE INDEX idx_bookings_status ON bookings(status_id);
CREATE INDEX idx_bookings_date ON bookings(event_date);
CREATE INDEX idx_bookings_assigned ON bookings(assigned_to);

-- Quotes
CREATE INDEX idx_quotes_organization ON quotes(organization_id);
CREATE INDEX idx_quotes_booking ON quotes(booking_id);
CREATE INDEX idx_quotes_status ON quotes(status);

-- Payments
CREATE INDEX idx_payments_organization ON payments(organization_id);
CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_products_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default permissions
INSERT INTO permissions (name, slug, module) VALUES
  -- Dashboard
  ('Voir dashboard général', 'dashboard.view', 'dashboard'),
  ('Voir dashboard commercial', 'dashboard.commercial.view', 'dashboard'),
  ('Voir dashboard restaurant', 'dashboard.restaurant.view', 'dashboard'),
  -- Contacts
  ('Voir contacts', 'contacts.view', 'contacts'),
  ('Créer contacts', 'contacts.create', 'contacts'),
  ('Modifier contacts', 'contacts.update', 'contacts'),
  ('Supprimer contacts', 'contacts.delete', 'contacts'),
  -- Bookings
  ('Voir réservations', 'bookings.view', 'bookings'),
  ('Créer réservations', 'bookings.create', 'bookings'),
  ('Modifier réservations', 'bookings.update', 'bookings'),
  ('Supprimer réservations', 'bookings.delete', 'bookings'),
  -- Quotes
  ('Voir devis', 'quotes.view', 'quotes'),
  ('Créer devis', 'quotes.create', 'quotes'),
  ('Modifier devis', 'quotes.update', 'quotes'),
  ('Supprimer devis', 'quotes.delete', 'quotes'),
  ('Envoyer devis', 'quotes.send', 'quotes'),
  -- Payments
  ('Voir paiements', 'payments.view', 'payments'),
  ('Créer paiements', 'payments.create', 'payments'),
  ('Modifier paiements', 'payments.update', 'payments'),
  ('Relancer paiements', 'payments.remind', 'payments'),
  -- Restaurants
  ('Voir restaurants', 'restaurants.view', 'restaurants'),
  ('Créer restaurants', 'restaurants.create', 'restaurants'),
  ('Modifier restaurants', 'restaurants.update', 'restaurants'),
  ('Supprimer restaurants', 'restaurants.delete', 'restaurants'),
  -- Users
  ('Voir utilisateurs', 'users.view', 'users'),
  ('Créer utilisateurs', 'users.create', 'users'),
  ('Modifier utilisateurs', 'users.update', 'users'),
  ('Supprimer utilisateurs', 'users.delete', 'users'),
  -- Settings
  ('Voir paramètres', 'settings.view', 'settings'),
  ('Modifier paramètres', 'settings.update', 'settings');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
