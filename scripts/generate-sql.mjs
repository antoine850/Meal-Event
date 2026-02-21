#!/usr/bin/env node
/**
 * Generate SQL INSERT statements from import-data.json
 * Outputs batched SQL files for execution via Supabase execute_sql
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

// ── Generate Products INSERT (batches of 50) ──
const BATCH_SIZE = 50
const productBatches = []

for (let i = 0; i < data.products.length; i += BATCH_SIZE) {
  const batch = data.products.slice(i, i + BATCH_SIZE)
  const values = batch.map(p => {
    return `(${esc(ORG_ID)}, ${esc(p.name)}, ${esc(p.description)}, ${esc(p.type)}, ${esc(p.tag)}, ${p.price_per_person}, ${p.unit_price_ht}, ${p.tva_rate}, ${p.old_id ? esc(p.old_id) : 'NULL'}, true)`
  }).join(',\n')

  const sql = `INSERT INTO products (organization_id, name, description, type, tag, price_per_person, unit_price_ht, tva_rate, old_id, is_active)
VALUES
${values}
RETURNING id, name, unit_price_ht, tva_rate;`

  productBatches.push({ sql, startIdx: i, endIdx: i + batch.length - 1 })
}

console.log(`Generated ${productBatches.length} product batches (${data.products.length} products)`)

// Write batches
for (let i = 0; i < productBatches.length; i++) {
  writeFileSync(
    join(SCRIPTS_DIR, `sql-products-batch-${i}.sql`),
    productBatches[i].sql,
    'utf-8'
  )
}

// ── Generate Packages INSERT ──
if (data.packages.length > 0) {
  const pkgValues = data.packages.map(p => {
    return `(${esc(ORG_ID)}, ${esc(p.name)}, ${esc(p.description)}, true)`
  }).join(',\n')

  const pkgSql = `INSERT INTO packages (organization_id, name, description, is_active)
VALUES
${pkgValues}
RETURNING id, name;`

  writeFileSync(join(SCRIPTS_DIR, 'sql-packages.sql'), pkgSql, 'utf-8')
  console.log(`Generated packages SQL (${data.packages.length} packages)`)
}

// ── Write metadata for association step ──
// After products are inserted, we need to match them back to create product_restaurants
// We'll generate a mapping script that uses name+price to match
const assocData = data.products.map(p => ({
  name: p.name,
  unit_price_ht: p.unit_price_ht,
  tva_rate: p.tva_rate,
  restaurants: p.restaurants,
}))

writeFileSync(
  join(SCRIPTS_DIR, 'import-associations.json'),
  JSON.stringify(assocData, null, 2),
  'utf-8'
)

const pkgAssocData = data.packages.map(p => ({
  name: p.name,
  restaurants: p.restaurants,
}))

writeFileSync(
  join(SCRIPTS_DIR, 'import-pkg-associations.json'),
  JSON.stringify(pkgAssocData, null, 2),
  'utf-8'
)

console.log('Association metadata written.')
console.log('\nNext steps:')
console.log('1. Execute product batches via Supabase execute_sql')
console.log('2. Then run association INSERT using product IDs from returned data')
