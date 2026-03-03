-- Add bank_name field to restaurants table for payment details
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS bank_name TEXT;

COMMENT ON COLUMN restaurants.bank_name IS 'Name of the bank for payment details display on invoices';
