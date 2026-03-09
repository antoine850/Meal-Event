-- Add additional_conditions field to quotes table
ALTER TABLE quotes
ADD COLUMN additional_conditions TEXT;

-- Set default to empty string for existing rows
UPDATE quotes
SET additional_conditions = ''
WHERE additional_conditions IS NULL;
