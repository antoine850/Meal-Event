-- ============================================
-- CRM SaaS MealEvent - Seed Data
-- ============================================

-- ============================================
-- CREATE DEFAULT ORGANIZATION (Demo)
-- ============================================

INSERT INTO organizations (id, name, slug, email, phone) VALUES
  ('00000000-0000-0000-0000-000000000001', 'MealEvent Demo', 'mealevent-demo', 'contact@mealevent.com', '+33 1 23 45 67 89');

-- ============================================
-- CREATE DEFAULT ROLES
-- ============================================

INSERT INTO roles (id, organization_id, name, slug, description, is_default) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Administrateur', 'admin', 'Accès complet à toutes les fonctionnalités', TRUE),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Commercial', 'commercial', 'Gestion des contacts, réservations et devis', TRUE),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Comptable', 'comptable', 'Accès aux finances, pas aux paramètres admin', TRUE),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Gérant Restaurant', 'gerant', 'Accès complet pour son/ses restaurant(s)', TRUE),
  ('00000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Responsable', 'responsable', 'Lecture seule des réservations et clients', TRUE);

-- ============================================
-- ASSIGN PERMISSIONS TO ROLES
-- ============================================

-- Admin: All permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000010', id FROM permissions;

-- Commercial: Contacts, Bookings, Quotes, Payments (view), Dashboard
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000011', id FROM permissions 
WHERE slug IN (
  'dashboard.view',
  'contacts.view', 'contacts.create', 'contacts.update',
  'bookings.view', 'bookings.create', 'bookings.update',
  'quotes.view', 'quotes.create', 'quotes.update', 'quotes.send',
  'payments.view', 'payments.remind',
  'restaurants.view'
);

-- Comptable: All except settings
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000012', id FROM permissions 
WHERE module NOT IN ('settings', 'users');

-- Gérant: All for their restaurants (handled by RLS)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000013', id FROM permissions 
WHERE module NOT IN ('settings', 'users');

-- Responsable: View only
INSERT INTO role_permissions (role_id, permission_id)
SELECT '00000000-0000-0000-0000-000000000014', id FROM permissions 
WHERE slug LIKE '%.view' AND module NOT IN ('settings', 'users');

-- ============================================
-- CREATE DEFAULT STATUSES
-- ============================================

INSERT INTO statuses (organization_id, name, slug, color, type, position, is_default) VALUES
  -- Contact statuses (Pipeline commercial)
  ('00000000-0000-0000-0000-000000000001', 'Nouveau', 'nouveau', '#3B82F6', 'contact', 1, TRUE),
  ('00000000-0000-0000-0000-000000000001', 'Contacté', 'contacte', '#8B5CF6', 'contact', 2, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Qualifié', 'qualifie', '#F59E0B', 'contact', 3, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Proposition', 'proposition', '#EC4899', 'contact', 4, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Négociation', 'negociation', '#EF4444', 'contact', 5, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Closing', 'closing', '#22C55E', 'contact', 6, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Client', 'client', '#10B981', 'contact', 7, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Perdu', 'perdu', '#6B7280', 'contact', 8, FALSE),
  
  -- Booking statuses
  ('00000000-0000-0000-0000-000000000001', 'En attente', 'en-attente', '#F59E0B', 'booking', 1, TRUE),
  ('00000000-0000-0000-0000-000000000001', 'Devis envoyé', 'devis-envoye', '#8B5CF6', 'booking', 2, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Devis signé', 'devis-signe', '#3B82F6', 'booking', 3, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Acompte payé', 'acompte-paye', '#22C55E', 'booking', 4, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Confirmé', 'confirme', '#10B981', 'booking', 5, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Terminé', 'termine', '#6B7280', 'booking', 6, FALSE),
  ('00000000-0000-0000-0000-000000000001', 'Annulé', 'annule', '#EF4444', 'booking', 7, FALSE);

-- ============================================
-- CREATE DEFAULT TIME SLOTS
-- ============================================

INSERT INTO time_slots (id, organization_id, name, start_time, end_time) VALUES
  ('00000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Déjeuner', '12:00', '14:30'),
  ('00000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000001', 'Dîner', '19:00', '23:00'),
  ('00000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000001', 'Journée complète', '10:00', '23:00'),
  ('00000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000001', 'Brunch', '10:00', '14:00');

-- ============================================
-- CREATE DEMO RESTAURANTS
-- ============================================

INSERT INTO restaurants (id, organization_id, name, slug, address, city, postal_code, phone, email, color, capacity) VALUES
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000001', 'Le Petit Bistro', 'le-petit-bistro', '12 Rue de la Paix', 'Paris', '75002', '+33 1 42 00 00 01', 'contact@lepetitbistro.fr', '#3B82F6', 80),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000001', 'La Grande Table', 'la-grande-table', '45 Avenue des Champs-Élysées', 'Paris', '75008', '+33 1 42 00 00 02', 'contact@lagrandetable.fr', '#10B981', 120),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000001', 'Chez Marcel', 'chez-marcel', '8 Place du Marché', 'Lyon', '69002', '+33 4 72 00 00 01', 'contact@chezmarcel.fr', '#F59E0B', 60),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000001', 'L''Atelier Gourmand', 'latelier-gourmand', '23 Rue Sainte-Catherine', 'Bordeaux', '33000', '+33 5 56 00 00 01', 'contact@ateliergourmand.fr', '#8B5CF6', 50);

-- Link restaurants to time slots
INSERT INTO restaurant_time_slots (restaurant_id, time_slot_id) VALUES
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000020'),
  ('00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000020'),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000022'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000020'),
  ('00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000020'),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000021'),
  ('00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000023');

-- Create spaces for restaurants
INSERT INTO spaces (restaurant_id, name, capacity) VALUES
  ('00000000-0000-0000-0000-000000000030', 'Salle principale', 50),
  ('00000000-0000-0000-0000-000000000030', 'Terrasse', 30),
  ('00000000-0000-0000-0000-000000000031', 'Salle VIP', 20),
  ('00000000-0000-0000-0000-000000000031', 'Grande salle', 80),
  ('00000000-0000-0000-0000-000000000031', 'Salon privé', 20),
  ('00000000-0000-0000-0000-000000000032', 'Salle unique', 60),
  ('00000000-0000-0000-0000-000000000033', 'Atelier', 30),
  ('00000000-0000-0000-0000-000000000033', 'Cave', 20);

-- ============================================
-- CREATE DEMO USERS
-- ============================================

INSERT INTO users (id, organization_id, role_id, email, first_name, last_name, phone) VALUES
  ('00000000-0000-0000-0000-000000000040', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'antoine@mealevent.com', 'Antoine', 'Dupont', '+33 6 12 34 56 78'),
  ('00000000-0000-0000-0000-000000000041', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'sophie@mealevent.com', 'Sophie', 'Martin', '+33 6 23 45 67 89'),
  ('00000000-0000-0000-0000-000000000042', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'lucas@mealevent.com', 'Lucas', 'Dubois', '+33 6 34 56 78 90'),
  ('00000000-0000-0000-0000-000000000043', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'marie@mealevent.com', 'Marie', 'Bernard', '+33 6 45 67 89 01'),
  ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000013', 'pierre@mealevent.com', 'Pierre', 'Leroy', '+33 6 56 78 90 12'),
  ('00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000014', 'julie@mealevent.com', 'Julie', 'Moreau', '+33 6 67 89 01 23');

-- Link gérant to restaurants
INSERT INTO user_restaurants (user_id, restaurant_id) VALUES
  ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000030'),
  ('00000000-0000-0000-0000-000000000044', '00000000-0000-0000-0000-000000000031');

-- Link responsable to restaurants
INSERT INTO user_restaurants (user_id, restaurant_id) VALUES
  ('00000000-0000-0000-0000-000000000045', '00000000-0000-0000-0000-000000000032');

-- ============================================
-- CREATE DEMO COMPANIES
-- ============================================

INSERT INTO companies (id, organization_id, name, siret, address, city, postal_code, phone, email) VALUES
  ('00000000-0000-0000-0000-000000000050', '00000000-0000-0000-0000-000000000001', 'TechCorp SAS', '12345678901234', '100 Avenue de la Tech', 'Paris', '75001', '+33 1 40 00 00 01', 'contact@techcorp.fr'),
  ('00000000-0000-0000-0000-000000000051', '00000000-0000-0000-0000-000000000001', 'EventPro SARL', '23456789012345', '50 Rue des Événements', 'Lyon', '69001', '+33 4 72 00 00 02', 'contact@eventpro.fr'),
  ('00000000-0000-0000-0000-000000000052', '00000000-0000-0000-0000-000000000001', 'Famille Durand', NULL, '15 Rue des Lilas', 'Bordeaux', '33000', '+33 5 56 00 00 03', NULL);

-- ============================================
-- CREATE DEMO CONTACTS
-- ============================================

INSERT INTO contacts (id, organization_id, company_id, status_id, assigned_to, first_name, last_name, email, phone, job_title, source) VALUES
  ('00000000-0000-0000-0000-000000000060', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000050', (SELECT id FROM statuses WHERE slug = 'closing' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1), '00000000-0000-0000-0000-000000000041', 'Jean', 'Martin', 'jean.martin@techcorp.fr', '+33 6 11 22 33 44', 'Directeur RH', 'Google Ads'),
  ('00000000-0000-0000-0000-000000000061', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000051', (SELECT id FROM statuses WHERE slug = 'proposition' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1), '00000000-0000-0000-0000-000000000042', 'Claire', 'Petit', 'claire.petit@eventpro.fr', '+33 6 22 33 44 55', 'Event Manager', 'Facebook'),
  ('00000000-0000-0000-0000-000000000062', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000052', (SELECT id FROM statuses WHERE slug = 'client' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1), '00000000-0000-0000-0000-000000000041', 'Michel', 'Durand', 'michel.durand@gmail.com', '+33 6 33 44 55 66', NULL, 'Parrainage'),
  ('00000000-0000-0000-0000-000000000063', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM statuses WHERE slug = 'nouveau' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1), '00000000-0000-0000-0000-000000000042', 'Emma', 'Lefevre', 'emma.lefevre@outlook.com', '+33 6 44 55 66 77', NULL, 'Organique'),
  ('00000000-0000-0000-0000-000000000064', '00000000-0000-0000-0000-000000000001', NULL, (SELECT id FROM statuses WHERE slug = 'qualifie' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1), '00000000-0000-0000-0000-000000000041', 'Thomas', 'Girard', 'thomas.girard@gmail.com', '+33 6 55 66 77 88', NULL, 'WhatsApp');

-- ============================================
-- CREATE DEMO BOOKINGS
-- ============================================

INSERT INTO bookings (id, organization_id, restaurant_id, contact_id, status_id, assigned_to, space_id, time_slot_id, event_type, event_date, start_time, end_time, guests_count, total_amount, deposit_amount) VALUES
  ('00000000-0000-0000-0000-000000000070', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000030', '00000000-0000-0000-0000-000000000060', (SELECT id FROM statuses WHERE slug = 'acompte-paye' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1), '00000000-0000-0000-0000-000000000041', (SELECT id FROM spaces WHERE restaurant_id = '00000000-0000-0000-0000-000000000030' LIMIT 1), '00000000-0000-0000-0000-000000000021', 'Séminaire entreprise', '2026-02-20', '19:00', '23:00', 45, 4500.00, 2250.00),
  ('00000000-0000-0000-0000-000000000071', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000031', '00000000-0000-0000-0000-000000000061', (SELECT id FROM statuses WHERE slug = 'devis-envoye' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1), '00000000-0000-0000-0000-000000000042', (SELECT id FROM spaces WHERE restaurant_id = '00000000-0000-0000-0000-000000000031' AND name = 'Grande salle' LIMIT 1), '00000000-0000-0000-0000-000000000022', 'Mariage', '2026-06-15', '10:00', '23:00', 100, 15000.00, 7500.00),
  ('00000000-0000-0000-0000-000000000072', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000032', '00000000-0000-0000-0000-000000000062', (SELECT id FROM statuses WHERE slug = 'confirme' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1), '00000000-0000-0000-0000-000000000041', (SELECT id FROM spaces WHERE restaurant_id = '00000000-0000-0000-0000-000000000032' LIMIT 1), '00000000-0000-0000-0000-000000000020', 'Anniversaire', '2026-02-14', '12:00', '15:00', 25, 1500.00, 750.00),
  ('00000000-0000-0000-0000-000000000073', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000033', '00000000-0000-0000-0000-000000000064', (SELECT id FROM statuses WHERE slug = 'en-attente' AND organization_id = '00000000-0000-0000-0000-000000000001' LIMIT 1), '00000000-0000-0000-0000-000000000042', (SELECT id FROM spaces WHERE restaurant_id = '00000000-0000-0000-0000-000000000033' LIMIT 1), '00000000-0000-0000-0000-000000000021', 'Dîner privé', '2026-03-01', '19:30', '22:30', 12, 800.00, 400.00);

-- ============================================
-- CREATE DEMO SETTINGS
-- ============================================

INSERT INTO settings (organization_id, default_currency, default_tva_rate, default_deposit_percentage, quote_validity_days, quote_prefix, email_sender_name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'EUR', 20.00, 50.00, 30, 'DEV', 'MealEvent');
