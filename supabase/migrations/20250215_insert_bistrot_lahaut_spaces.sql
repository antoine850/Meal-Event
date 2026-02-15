-- Insertion des espaces pour le restaurant "Bistrot la haut"
-- D'abord, trouvons l'ID du restaurant (à adapter selon le nom exact dans la base)
DO $$
DECLARE
    bistrot_restaurant_id UUID;
BEGIN
    -- Récupérer l'ID du restaurant "Bistrot la haut"
    SELECT id INTO bistrot_restaurant_id 
    FROM restaurants 
    WHERE name ILIKE '%bistrot%' AND name ILIKE '%haut%'
    LIMIT 1;
    
    IF bistrot_restaurant_id IS NULL THEN
        RAISE EXCEPTION 'Restaurant "Bistrot la haut" non trouvé. Vérifiez le nom exact dans la base.';
    END IF;
    
    -- Insérer les espaces
    INSERT INTO spaces (restaurant_id, name, nom_public, ordre, description, capacity, is_active, is_default) VALUES
    (bistrot_restaurant_id, 'Espace à définir', 'Pas de privatisation (réservation simple)', 0, 'Réservation simple sans privatisation spécifique', NULL, true, false),
    (bistrot_restaurant_id, 'Espace hôte (privatif)', NULL, 1, 'Espace hôte en mode privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Espace hôte (non-privatif)', NULL, 1, 'Espace hôte en mode non-privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Carré central (privatif)', NULL, 2, 'Carré central en mode privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Carré central (non-privatif)', NULL, 2, 'Carré central en mode non-privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Verrière (privatif)', NULL, 3, 'Verrière en mode privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Verrière (non-privatif)', NULL, 3, 'Verrière en mode non-privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Petit salon (privatif)', NULL, 4, 'Petit salon en mode privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Petit salon (non-privatif)', NULL, 4, 'Petit salon en mode non-privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Cave (privatif)', NULL, 5, 'Cave en mode privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Cave (non-privatif)', 'Demande pour un midi ou un soir dans la Cave', 5, 'Cave en mode non-privatif', NULL, true, false),
    (bistrot_restaurant_id, 'Choix de la direction', NULL, 6, 'Espace laissé au choix de la direction', NULL, true, false),
    (bistrot_restaurant_id, 'Privatisation espace', 'Privatisation d''un espace', 7, 'Privatisation complète d''un espace spécifique', NULL, true, false),
    (bistrot_restaurant_id, 'Privatisation totale', 'Privatisation totale', 8, 'Privatisation totale du restaurant', NULL, true, false),
    (bistrot_restaurant_id, 'Demande Midi ou Soir', 'Demande pour un midi ou un soir', 9, 'Demande spécifique pour midi ou soir', NULL, true, false),
    (bistrot_restaurant_id, 'Terrasse', NULL, 10, 'Espace terrasse', NULL, true, false);
    
    RAISE NOTICE 'Espaces du Bistrot la haut insérés avec succès pour le restaurant ID: %', bistrot_restaurant_id;
END $$;
