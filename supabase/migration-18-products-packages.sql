-- ============================================
-- CATALOGUE PRODUITS & SERVICES
-- ============================================

-- Table principale des produits/services du catalogue
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'boissons_alcoolisees',
    'boissons_sans_alcool',
    'food',
    'frais_personnel',
    'frais_privatisation',
    'prestataires'
  )),
  price_per_person BOOLEAN DEFAULT FALSE,
  unit_price_ht DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tva_rate DECIMAL(5, 2) NOT NULL DEFAULT 20,
  unit_price_ttc DECIMAL(10, 2) GENERATED ALWAYS AS (unit_price_ht * (1 + tva_rate / 100)) STORED,
  margin DECIMAL(5, 2) DEFAULT 0, -- marge manuelle en %
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Liaison produits <-> restaurants (many-to-many)
CREATE TABLE IF NOT EXISTS product_restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE(product_id, restaurant_id)
);

-- Packages (regroupement de produits)
CREATE TABLE IF NOT EXISTS packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Liaison packages <-> produits (many-to-many avec quantité)
CREATE TABLE IF NOT EXISTS package_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  UNIQUE(package_id, product_id)
);

-- Liaison packages <-> restaurants (many-to-many)
CREATE TABLE IF NOT EXISTS package_restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  UNIQUE(package_id, restaurant_id)
);

-- RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "products_org" ON products FOR ALL USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "product_restaurants_org" ON product_restaurants FOR ALL USING (
  product_id IN (SELECT id FROM products WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
);

CREATE POLICY "packages_org" ON packages FOR ALL USING (
  organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid())
);

CREATE POLICY "package_products_org" ON package_products FOR ALL USING (
  package_id IN (SELECT id FROM packages WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
);

CREATE POLICY "package_restaurants_org" ON package_restaurants FOR ALL USING (
  package_id IN (SELECT id FROM packages WHERE organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()))
);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
