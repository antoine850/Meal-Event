-- Database changes for Companies and removal of Time Slots

-- 1. Remove Time Slots table
DROP TABLE IF EXISTS time_slots CASCADE;

-- 2. Create Companies table
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    billing_address TEXT,
    billing_postal_code TEXT,
    billing_city TEXT,
    billing_country TEXT DEFAULT 'France',
    billing_email TEXT,
    siret TEXT,
    tva_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Add company_id to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

-- 4. Enable RLS on companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for companies
CREATE POLICY "Users can view companies in their organization" ON companies
    FOR SELECT USING (auth.uid() IN (
        SELECT user_id FROM organization_users WHERE organization_id = companies.organization_id
    ));

CREATE POLICY "Users can create companies in their organization" ON companies
    FOR INSERT WITH CHECK (auth.uid() IN (
        SELECT user_id FROM organization_users WHERE organization_id = companies.organization_id
    ));

CREATE POLICY "Users can update companies in their organization" ON companies
    FOR UPDATE USING (auth.uid() IN (
        SELECT user_id FROM organization_users WHERE organization_id = companies.organization_id
    ));

CREATE POLICY "Users can delete companies in their organization" ON companies
    FOR DELETE USING (auth.uid() IN (
        SELECT user_id FROM organization_users WHERE organization_id = companies.organization_id
    ));

-- 6. Add indexes
CREATE INDEX IF NOT EXISTS idx_companies_organization_id ON companies(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company_id ON contacts(company_id);
