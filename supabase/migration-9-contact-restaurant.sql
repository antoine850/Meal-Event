-- Add restaurant_id to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES restaurants(id) ON DELETE SET NULL;
