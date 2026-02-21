INSERT INTO products (organization_id, name, description, type, tag, price_per_person, unit_price_ht, tva_rate, old_id, is_active)
VALUES
('425be1b8-f059-4a4f-8e94-d8b8fe69ab27', 'AOP Pinot Noir, Domaine Méjane, 2023', NULL, 'boissons_alcoolisees', 'Boissons Alcoolisées', false, 40, 20, 'ynSnYU0WWTvkT4O2GlNX', true),
('425be1b8-f059-4a4f-8e94-d8b8fe69ab27', 'Armagnac clé des ducs', NULL, 'boissons_alcoolisees', 'Boissons Alcoolisées', false, 7.5, 20, 'yshAuxyVcAyZCq0bkeyc', true),
('425be1b8-f059-4a4f-8e94-d8b8fe69ab27', 'Makers Mark', NULL, 'boissons_alcoolisees', 'Boissons Alcoolisées', false, 10, 20, 'z2IlfnF5GYPJ3WRO6jWw', true),
('425be1b8-f059-4a4f-8e94-d8b8fe69ab27', 'Demory Paris ( IPA) 50cl', NULL, 'boissons_alcoolisees', 'Boissons Alcoolisées', false, 10, 20, 'z5IjMwYyF3Up0UxbpMnN', true)
RETURNING id, name, unit_price_ht, tva_rate;