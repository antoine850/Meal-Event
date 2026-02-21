#!/usr/bin/env node
/**
 * Generate a single large SQL that:
 * 1. Inserts all products
 * 2. Inserts all product_restaurants associations using a CTE to match by name+price
 * 3. Inserts all packages
 * 4. Inserts all package_restaurants associations
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const ORG_ID = '425be1b8-f059-4a4f-8e94-d8b8fe69ab27'
const SCRIPTS_DIR = '/Users/thomas/Desktop/WINDSURF/restaurant-crm/scripts'

const data = JSON.parse(readFileSync(join(SCRIPTS_DIR, 'import-data.json'), 'utf-8'))

function esc(str) {
  if (str === null || str === undefined || str === '') return 'NULL'
  return "'" + String(str).replace(/'/g, "''") + "'"
}

// ── PRODUCTS: Generate VALUES for all products ──
const productValues = data.products.map(p => {
  return `(${esc(ORG_ID)}, ${esc(p.name)}, ${esc(p.description)}, ${esc(p.type)}, ${esc(p.tag)}, ${p.price_per_person}, ${p.unit_price_ht}, ${p.tva_rate}, ${p.old_id ? esc(p.old_id) : 'NULL'}, true)`
}).join(',\n')

// ── PRODUCT ASSOCIATIONS: Generate VALUES for all associations ──
// We use (product_name, unit_price_ht, tva_rate, restaurant_id) tuples
// Then JOIN with products to get the product_id
const assocValues = []
for (const p of data.products) {
  for (const restId of p.restaurants) {
    assocValues.push(`(${esc(p.name)}, ${p.unit_price_ht}, ${p.tva_rate}, ${esc(restId)})`)
  }
}

// ── PACKAGES ──
const pkgValues = data.packages.map(p => {
  return `(${esc(ORG_ID)}, ${esc(p.name)}, ${esc(p.description)}, true)`
}).join(',\n')

const pkgAssocValues = []
for (const p of data.packages) {
  for (const restId of p.restaurants) {
    pkgAssocValues.push(`(${esc(p.name)}, ${esc(restId)})`)
  }
}

// ── Output: Split into 4 separate SQL files for sequential execution ──

// File 1: Insert products
writeFileSync(join(SCRIPTS_DIR, 'exec-1-products.sql'),
  `INSERT INTO products (organization_id, name, description, type, tag, price_per_person, unit_price_ht, tva_rate, old_id, is_active)
VALUES
${productValues};`, 'utf-8')

// File 2: Insert product_restaurants using matching
writeFileSync(join(SCRIPTS_DIR, 'exec-2-product-assoc.sql'),
  `INSERT INTO product_restaurants (product_id, restaurant_id)
SELECT p.id, assoc.restaurant_id::uuid
FROM (VALUES
${assocValues.join(',\n')}
) AS assoc(name, unit_price_ht, tva_rate, restaurant_id)
JOIN products p ON p.name = assoc.name
  AND p.unit_price_ht = assoc.unit_price_ht::numeric
  AND p.tva_rate = assoc.tva_rate::numeric
  AND p.organization_id = '${ORG_ID}'
ON CONFLICT (product_id, restaurant_id) DO NOTHING;`, 'utf-8')

// File 3: Insert packages
writeFileSync(join(SCRIPTS_DIR, 'exec-3-packages.sql'),
  `INSERT INTO packages (organization_id, name, description, is_active)
VALUES
${pkgValues};`, 'utf-8')

// File 4: Insert package_restaurants
writeFileSync(join(SCRIPTS_DIR, 'exec-4-pkg-assoc.sql'),
  `INSERT INTO package_restaurants (package_id, restaurant_id)
SELECT pk.id, assoc.restaurant_id::uuid
FROM (VALUES
${pkgAssocValues.join(',\n')}
) AS assoc(name, restaurant_id)
JOIN packages pk ON pk.name = assoc.name
  AND pk.organization_id = '${ORG_ID}'
ON CONFLICT (package_id, restaurant_id) DO NOTHING;`, 'utf-8')

console.log('Generated 4 SQL files:')
console.log(`  exec-1-products.sql (${data.products.length} products)`)
console.log(`  exec-2-product-assoc.sql (${assocValues.length} associations)`)
console.log(`  exec-3-packages.sql (${data.packages.length} packages)`)
console.log(`  exec-4-pkg-assoc.sql (${pkgAssocValues.length} package associations)`)
