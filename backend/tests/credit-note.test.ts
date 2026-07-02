import { describe, it, expect } from 'vitest'
import {
  computeEffectiveTotals,
  applyLineCredit,
  computeCreditNote,
  computeLineAmounts,
} from '../src/lib/quote-rounding'

// Produits + un extra. Les extras sont hors quotes.total_ttc mais dans le total effectif.
const ITEMS = [
  { id: 'p1', quantity: 1, unit_price_ttc: 1000, price_entry_mode: 'ttc' as const, tva_rate: 20, item_type: 'product' },
  { id: 'p2', quantity: 1, unit_price_ttc: 200, price_entry_mode: 'ttc' as const, tva_rate: 20, item_type: 'product' },
  { id: 'e1', quantity: 1, unit_price_ttc: 120, price_entry_mode: 'ttc' as const, tva_rate: 20, item_type: 'extra' },
]

describe('computeEffectiveTotals : produits + extras', () => {
  const t = computeEffectiveTotals(ITEMS)
  it('TTC effectif = produits (1200) + extra (120) = 1320', () => expect(t.totalTtc).toBe(1320))
  it('ligne produit 1000 TTC est bien 1000', () => expect(computeLineAmounts({ ...ITEMS[0] }).totalTtc).toBe(1000))
})

describe('applyLineCredit', () => {
  it('credit total (>= ligne) -> null (a supprimer)', () =>
    expect(applyLineCredit(ITEMS[1], 200)).toBeNull())
  it('credit partiel TTC -> ajoute une remise, total baisse du montant credite', () => {
    const modified = applyLineCredit(ITEMS[0], 300)!
    expect(computeLineAmounts(modified).totalTtc).toBe(700)
  })
})

describe('computeCreditNote : avoir = ancien effectif - nouveau effectif', () => {
  it('retrait total d un produit de 200', () => {
    const r = computeCreditNote(ITEMS, { p2: 200 }, 0, 960)
    expect(r.avoirTtc).toBe(200)
    expect(r.newEffectiveTtc).toBe(1120)
    expect(r.overpaidTtc).toBe(0)
    expect(r.creditedItems).toEqual([{ id: 'p2', creditedTtc: 200, remove: true, newDiscountAmount: null }])
  })
  it('credit d un extra de 120 baisse bien l effectif (pas 0)', () => {
    const r = computeCreditNote(ITEMS, { e1: 120 }, 0, 0)
    expect(r.avoirTtc).toBe(120)
    expect(r.newEffectiveTtc).toBe(1200)
  })
  it('trop-percu quand deja soldé', () => {
    const r = computeCreditNote(ITEMS, { p2: 200 }, 0, 1320)
    expect(r.overpaidTtc).toBe(200) // 1320 encaissé - 1120 nouveau
  })
  it('credit partiel : avoir = delta reel a la centime', () => {
    const r = computeCreditNote(ITEMS, { p1: 300 }, 0, 0)
    expect(r.avoirTtc).toBe(300)
    expect(r.newEffectiveTtc).toBe(1020)
  })
})

describe('avoir partiel sur ligne verbatim (les deux PU saisis)', () => {
  const VERBATIM = [
    {
      id: 'v1',
      quantity: 1,
      unit_price: 100,
      unit_price_ttc: 120,
      tva_rate: 20,
      item_type: 'product',
    },
  ]
  it('credit 12 TTC -> avoir 12 TTC / 10 HT / 2 TVA (pas de TVA a 0)', () => {
    const r = computeCreditNote(VERBATIM, { v1: 12 }, 0, 0)
    expect(r.avoirTtc).toBe(12)
    expect(r.avoirHt).toBe(10)
    expect(r.avoirTva).toBe(2)
    expect(r.newEffectiveTtc).toBe(108)
  })
})
