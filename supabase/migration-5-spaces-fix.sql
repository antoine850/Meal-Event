-- Migration: Add organization_id to spaces and time_slots tables
-- Run this in Supabase SQL Editor

-- Add organization_id to spaces table
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Update existing spaces to get organization_id from their restaurant
UPDATE spaces s
SET organization_id = r.organization_id
FROM restaurants r
WHERE s.restaurant_id = r.id AND s.organization_id IS NULL;

-- Add organization_id to time_slots table if not exists
ALTER TABLE time_slots ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Make restaurant_id optional in spaces (spaces can belong to org without specific restaurant)
ALTER TABLE spaces ALTER COLUMN restaurant_id DROP NOT NULL;
