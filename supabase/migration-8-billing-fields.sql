-- Migration: Add billing fields to restaurants table
-- Run this in Supabase SQL Editor

-- Company information
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS company_name VARCHAR(255); -- Raison sociale
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS legal_form VARCHAR(50); -- Forme juridique (SAS, SARL, etc.)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS siren VARCHAR(20); -- SIREN
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS rcs VARCHAR(100); -- RCS
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS share_capital VARCHAR(50); -- Capital social

-- Billing contact
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_email VARCHAR(255); -- Email facturation
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_phone VARCHAR(50); -- Téléphone facturation
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS billing_additional_text TEXT; -- Texte complémentaire

-- Bank details
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS iban VARCHAR(50); -- IBAN
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS bic VARCHAR(20); -- BIC

-- Invoice settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS invoice_prefix VARCHAR(20); -- Prefix (ex: LAHAUT)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS invoice_chrono_format VARCHAR(20) DEFAULT 'YEAR-MONTH'; -- Format du chrono
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS quote_validity_days INTEGER DEFAULT 7; -- Échéance devis (jours)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS invoice_due_days INTEGER; -- Échéance facture (jours)
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS payment_balance_days INTEGER; -- Paiement du solde (jours)

-- Default deposits (stored as JSON array)
-- Format: [{"label": "Acompte à signature", "percentage": 80}]
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS default_deposits JSONB DEFAULT '[]'::jsonb;

-- Display options
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS show_event_id BOOLEAN DEFAULT FALSE; -- Afficher l'identifiant de l'événement
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS hide_establishment_header BOOLEAN DEFAULT FALSE; -- Masquer le nom d'établissement dans l'entête
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS chronological_products BOOLEAN DEFAULT FALSE; -- Classement chronologique des produits
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS hide_package_products BOOLEAN DEFAULT FALSE; -- Masquer les produits du package
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS accommodation_period BOOLEAN DEFAULT FALSE; -- Hébergement en période

-- Quote/Invoice columns visibility (stored as JSON)
-- Format: {"quantity": true, "price_ttc": true, "total_ht": true, "total_ttc": true, "vat": true, "discount": true}
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS quote_columns JSONB DEFAULT '{"quantity": true, "price_ttc": true, "total_ht": true, "total_ttc": true, "vat": true, "discount": true}'::jsonb;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS deposit_invoice_columns JSONB DEFAULT '{"total_ht": true, "total_ttc": true}'::jsonb;

-- Comments
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS quote_comments_fr TEXT; -- Commentaires offre FR
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS quote_comments_en TEXT; -- Commentaires offre EN

-- VAT rates (stored as JSON array)
-- Format: [{"rate": 20, "label": "TVA 20%"}, {"rate": 10, "label": "TVA 10%"}]
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS vat_rates JSONB DEFAULT '[]'::jsonb;

-- Accounting categories (stored as JSON array)
-- Format: [{"code": "706", "label": "Prestations de services"}]
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS accounting_categories JSONB DEFAULT '[]'::jsonb;
