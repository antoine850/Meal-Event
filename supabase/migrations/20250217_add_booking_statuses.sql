-- Ajouter les statuts de réservation pour l'organisation existante
DO $$
DECLARE
    org_id UUID := '425be1b8-f059-4a4f-8e94-d8b8fe69ab27'::UUID;
BEGIN
    
    -- Insérer les statuts de réservation
    INSERT INTO statuses (organization_id, name, slug, color, type, position) VALUES
    (org_id, 'Nouveau', 'nouveau', '#FFEB3B', 'booking', 1),
    (org_id, 'Qualification', 'qualification', '#FF9800', 'booking', 2),
    (org_id, 'Proposition', 'proposition', '#FF5722', 'booking', 3),
    (org_id, 'Négociation', 'negociation', '#E91E63', 'booking', 4),
    (org_id, 'Confirmé / Fonctionnaire', 'confirme_fonctionnaire', '#4CAF50', 'booking', 5),
    (org_id, 'Fonction envoyée', 'fonction_envoyee', '#2196F3', 'booking', 6),
    (org_id, 'À facturer', 'a_facturer', '#9C27B0', 'booking', 7),
    (org_id, 'Attente paiement', 'attente_paiement', '#E91E63', 'booking', 8),
    (org_id, 'Relance paiement', 'relance_paiement', '#FF69B4', 'booking', 9)
    ON CONFLICT DO NOTHING;
    
    RAISE NOTICE 'Statuts de réservation ajoutés avec succès pour l''organisation ID: %', org_id;
END $$;
