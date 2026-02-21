#!/usr/bin/env node
/**
 * Split the products SQL into smaller batches for execute_sql
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const SCRIPTS_DIR = '/Users/thomas/Desktop/WINDSURF/restaurant-crm/scripts'
const data = JSON.parse(readFileSync(join(SCRIPTS_DIR, 'import-data.json'), 'utf-8'))

function esc(str) {
  if (str === null || str === undefined || str === '') return 'NULL'
  return "'" + String(str).replace(/'/g, "''") + "'"
}

const ORG_ID = '425be1b8-f059-4a4f-8e94-d8b8fe69ab27'
const BATCH = 100

// Products in batches
const numBatches = Math.ceil(data.products.length / BATCH)
for (let b = 0; b < numBatches; b++) {
  const slice = data.products.slice(b * BATCH, (b + 1) * BATCH)
  const values = slice.map(p =>
    `(${esc(ORG_ID)}, ${esc(p.name)}, ${esc(p.description)}, ${esc(p.type)}, ${esc(p.tag)}, ${p.price_per_person}, ${p.unit_price_ht}, ${p.tva_rate}, ${p.old_id ? esc(p.old_id) : 'NULL'}, true)`
  ).join(',\n')

  const sql = `INSERT INTO products (organization_id, name, description, type, tag, price_per_person, unit_price_ht, tva_rate, old_id, is_active) VALUES\n${values};`
  writeFileSync(join(SCRIPTS_DIR, `batch-prod-${b}.sql`), sql, 'utf-8')
}

// Associations in batches
const allAssocs = []
for (const p of data.products) {
  for (const restId of p.restaurants) {
    allAssocs.push({ name: p.name, unit_price_ht: p.unit_price_ht, tva_rate: p.tva_rate, restId })
  }
}

const assocBatches = Math.ceil(allAssocs.length / 200)
for (let b = 0; b < assocBatches; b++) {
  const slice = allAssocs.slice(b * 200, (b + 1) * 200)
  const values = slice.map(a =>
    `(${esc(a.name)}, ${a.unit_price_ht}, ${a.tva_rate}, ${esc(a.restId)})`
  ).join(',\n')

  const sql = `INSERT INTO product_restaurants (product_id, restaurant_id)
SELECT p.id, assoc.restaurant_id::uuid
FROM (VALUES
${values}
) AS assoc(name, unit_price_ht, tva_rate, restaurant_id)
JOIN products p ON p.name = assoc.name
  AND p.unit_price_ht = assoc.unit_price_ht::numeric
  AND p.tva_rate = assoc.tva_rate::numeric
  AND p.organization_id = '${ORG_ID}'
ON CONFLICT (product_id, restaurant_id) DO NOTHING;`
  writeFileSync(join(SCRIPTS_DIR, `batch-assoc-${b}.sql`), sql, 'utf-8')
}

console.log(`Product batches: ${numBatches}`)
console.log(`Association batches: ${assocBatches}`)
console.log(`Total associations: ${allAssocs.length}`)
