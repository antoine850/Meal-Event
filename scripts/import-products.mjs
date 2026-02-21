#!/usr/bin/env node
/**
 * Script one-shot pour parser les 14 CSV de produits
 * et générer les INSERT SQL dédupliqués.
 *
 * Usage: node scripts/import-products.mjs
 * Output: scripts/import-output.sql
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

// ── Mapping restaurant CSV → BDD ──
const RESTAURANT_MAP = {
  'Bistrot Là-Haut': 'd7bd3aab-9989-46f9-985e-e596ef126e83',
  'Bistrot Micheline': '9dba1694-4355-4372-89e4-03783cba3b64',
  'Chez Mimi': '53926e78-3886-4b31-a3d4-4da04a86644a',
  'Chou de Chanorier': 'e1b8cdeb-b3ee-4644-8bd2-0c9c81bca80c',
  'Coco Rocco': '4f251aa4-36e2-44fe-97f8-e1721e37802d',
  'Le Bistrot des Chefs': 'e5024c05-9db3-4a29-b943-de66609f6427',
  'Madame Soleil': '44eac888-c0fa-4375-8d35-91c97e98b2a3',
  'Monsieur Claude': '1ca8d32c-6b34-44cb-8d24-1c94f9e40543',
  'Papa Pool': 'c9c9525d-52c2-4afe-a3fe-592e7e6c4d16',
  'Podium': '645bc1f1-514e-4129-b695-044baa02caa5',
  'Saperlipopette': '273d4b2d-487b-4f88-a141-fc8a9b12887e',
  'Sapristi': '24e37737-b5fd-4abb-ae90-b8acde51186f',
  'Splash': '0c315e35-9267-442e-a3a4-0d25aa8966d7',
  'Tata Yoyo': '23f49e05-f0dd-48ae-9feb-6f1ffb700528',
}

const ORG_ID = (() => {
  // We'll get this from SQL, for now use placeholder
  return 'ORG_ID_PLACEHOLDER'
})()

// ── Tag → Type mapping ──
const TAG_TO_TYPE = {
  'boissons alcoolisées': 'boissons_alcoolisees',
  'boissons alcoolisees': 'boissons_alcoolisees',
  'boissons sans alcool': 'boissons_sans_alcool',
  'food': 'food',
  'frais de personnel': 'frais_personnel',
  'frais de privatisation': 'frais_privatisation',
  'prestataires': 'prestataires',
}

// ── CSV files ──
const CSV_DIR = '/Users/thomas/Downloads'
const CSV_FILES = [
  { file: 'products_Bistrot Là-Haut.csv', restaurant: 'Bistrot Là-Haut' },
  { file: 'products_Bistrot Micheline.csv', restaurant: 'Bistrot Micheline' },
  { file: 'products_Chez Mimi.csv', restaurant: 'Chez Mimi' },
  { file: 'products_Chou de Chanorier.csv', restaurant: 'Chou de Chanorier' },
  { file: 'products_Coco Rocco.csv', restaurant: 'Coco Rocco' },
  { file: 'products_Le Bistrot des Chefs.csv', restaurant: 'Le Bistrot des Chefs' },
  { file: 'products_Madame Soleil.csv', restaurant: 'Madame Soleil' },
  { file: 'products_Monsieur Claude.csv', restaurant: 'Monsieur Claude' },
  { file: 'products_Papa Pool.csv', restaurant: 'Papa Pool' },
  { file: 'products_Podium.csv', restaurant: 'Podium' },
  { file: 'products_Saperlipopette.csv', restaurant: 'Saperlipopette' },
  { file: 'products_Sapristi.csv', restaurant: 'Sapristi' },
  { file: 'products_Splash.csv', restaurant: 'Splash' },
  { file: 'products_Tata Yoyo.csv', restaurant: 'Tata Yoyo' },
]

// ── Normalize title for dedup ──
function normalizeTitle(title) {
  return title
    .replace(/"/g, '')        // remove quotes
    .replace(/\s+/g, ' ')     // collapse whitespace
    .replace(/\s+([,;:.])/g, '$1') // remove space before punctuation
    .trim()
}

// ── Escape SQL string ──
function esc(str) {
  if (str === null || str === undefined || str === '') return 'NULL'
  return "'" + String(str).replace(/'/g, "''") + "'"
}

// ── Parse CSV with semicolon delimiter and quoted multiline fields ──
function parseCSV(content) {
  const rows = []
  const lines = content.split('\n')
  let currentRow = null
  let inQuotedField = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!inQuotedField) {
      // Start new row
      currentRow = line
      // Count unescaped quotes
      const quoteCount = (currentRow.match(/"/g) || []).length
      if (quoteCount % 2 !== 0) {
        inQuotedField = true
        continue
      }
      rows.push(currentRow)
      currentRow = null
    } else {
      // Continue quoted field
      currentRow += '\n' + line
      const quoteCount = (currentRow.match(/"/g) || []).length
      if (quoteCount % 2 === 0) {
        inQuotedField = false
        rows.push(currentRow)
        currentRow = null
      }
    }
  }

  // Parse each row into fields
  const header = parseRow(rows[0])
  const result = []

  for (let i = 1; i < rows.length; i++) {
    if (!rows[i].trim()) continue
    const fields = parseRow(rows[i])
    if (fields.length < header.length) continue

    const obj = {}
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = fields[j]
    }
    result.push(obj)
  }

  return result
}

function parseRow(row) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]

    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ';' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// ── MAIN ──
console.log('Parsing CSV files...')

// Deduplicated products: key = normalizedTitle|price|vat
const productMap = new Map() // key → { data, restaurants: Set<restaurantId>, oldIds: [] }
const packageMap = new Map() // key → { data, restaurants: Set<restaurantId> }

let totalCSVRows = 0
let productRows = 0
let packageRows = 0
let skippedRows = 0

for (const { file, restaurant } of CSV_FILES) {
  const restaurantId = RESTAURANT_MAP[restaurant]
  if (!restaurantId) {
    console.error(`No restaurant ID for: ${restaurant}`)
    continue
  }

  const filePath = join(CSV_DIR, file)
  let content
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch (e) {
    console.error(`Cannot read: ${filePath}`)
    continue
  }

  const rows = parseCSV(content)
  console.log(`  ${restaurant}: ${rows.length} rows`)
  totalCSVRows += rows.length

  for (const row of rows) {
    const isGroup = row.is_group === 'true'
    const isPackage = row.is_package === 'true'
    const title = normalizeTitle(row.title || '')

    if (!title) {
      skippedRows++
      continue
    }

    const price = parseFloat(row.price) || 0
    const vat = parseFloat(row.vat) || 20
    const tag = (row.tag || '').trim()
    const description = (row.description || '').replace(/"/g, '').trim()
    const pricePerPerson = row.is_price_per_person === 'true'
    const oldId = (row.id || '').trim()

    if (isGroup || isPackage) {
      // → Package
      const key = title.toLowerCase()
      if (!packageMap.has(key)) {
        packageMap.set(key, {
          name: title,
          description: description || null,
          restaurants: new Set(),
        })
      }
      packageMap.get(key).restaurants.add(restaurantId)
      packageRows++
    } else {
      // → Product
      // Convert TTC → HT
      const unitPriceHt = price > 0 ? Math.round((price / (1 + vat / 100)) * 100) / 100 : 0

      const type = TAG_TO_TYPE[(tag || '').toLowerCase()] || 'food'

      const key = `${title.toLowerCase()}|${price}|${vat}`

      if (!productMap.has(key)) {
        productMap.set(key, {
          name: title,
          description: description || null,
          type,
          tag: tag || null,
          pricePerPerson,
          unitPriceHt,
          tvaRate: vat,
          priceTtc: price,
          oldIds: [],
          restaurants: new Set(),
        })
      }

      const entry = productMap.get(key)
      entry.restaurants.add(restaurantId)
      if (oldId) entry.oldIds.push(oldId)

      // If this entry had pricePerPerson=false but this row says true, prefer true
      if (pricePerPerson) entry.pricePerPerson = true

      productRows++
    }
  }
}

console.log(`\n── Summary ──`)
console.log(`Total CSV rows: ${totalCSVRows}`)
console.log(`Product rows: ${productRows}`)
console.log(`Package rows: ${packageRows}`)
console.log(`Skipped (empty title): ${skippedRows}`)
console.log(`Unique products (deduplicated): ${productMap.size}`)
console.log(`Unique packages (deduplicated): ${packageMap.size}`)

// Count total restaurant associations
let totalAssociations = 0
for (const [, p] of productMap) totalAssociations += p.restaurants.size
console.log(`Total product-restaurant associations: ${totalAssociations}`)

// Show top shared products
console.log(`\n── Top shared products (5+ restaurants) ──`)
const sorted = [...productMap.values()].sort((a, b) => b.restaurants.size - a.restaurants.size)
for (const p of sorted.slice(0, 30)) {
  if (p.restaurants.size < 5) break
  console.log(`  [${p.restaurants.size} restos] ${p.name} - ${p.priceTtc}€ TTC (${p.unitPriceHt}€ HT) - ${p.type}`)
}

// ── Generate SQL output as JSON for Supabase execute_sql ──
// We'll output products and associations as JSON arrays
const productsArray = []
const associationsArray = []
const packagesArray = []
const packageAssociationsArray = []

let prodIdx = 0
for (const [, p] of productMap) {
  productsArray.push({
    idx: prodIdx,
    name: p.name,
    description: p.description,
    type: p.type,
    tag: p.tag,
    price_per_person: p.pricePerPerson,
    unit_price_ht: p.unitPriceHt,
    tva_rate: p.tvaRate,
    old_id: p.oldIds[0] || null,
    restaurants: [...p.restaurants],
  })
  prodIdx++
}

for (const [, pkg] of packageMap) {
  packagesArray.push({
    name: pkg.name,
    description: pkg.description,
    restaurants: [...pkg.restaurants],
  })
}

// Write JSON output for processing
const output = {
  products: productsArray,
  packages: packagesArray,
  stats: {
    totalCSVRows,
    productRows,
    packageRows,
    uniqueProducts: productMap.size,
    uniquePackages: packageMap.size,
    totalAssociations,
  }
}

writeFileSync(
  join('/Users/thomas/Desktop/WINDSURF/restaurant-crm/scripts', 'import-data.json'),
  JSON.stringify(output, null, 2),
  'utf-8'
)

console.log(`\nOutput written to scripts/import-data.json`)
console.log('Ready for SQL import.')
