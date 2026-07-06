import { describe, it, expect } from 'vitest'
import {
  round2,
  computeLineAmounts,
  computeQuoteAmounts,
  computeDepositAmounts,
  computeBalanceTtc,
  computeQuoteBreakdown,
  deriveUnitTtc,
  displayUnitTtc,
  resolveUnitPrices,
  sumStoredQuoteTotals,
  displayUnitHt,
  formatUnitPriceEuro,
} from '../src/lib/quote-rounding'

// Cas de reference de la note client (Foolish Studio, 29/06/2026).
const DEVIS = [
  {
    quantity: 3,
    unit_price_ttc: 35,
    price_entry_mode: 'ttc' as const,
    tva_rate: 20,
  },
  {
    quantity: 15,
    unit_price_ttc: 60,
    price_entry_mode: 'ttc' as const,
    tva_rate: 10,
  },
  {
    quantity: 1,
    unit_price_ttc: 600,
    price_entry_mode: 'ttc' as const,
    tva_rate: 20,
  },
  {
    quantity: 1,
    unit_price_ttc: 250,
    price_entry_mode: 'ttc' as const,
    tva_rate: 20,
  },
]

describe('round2 absorbe le bruit IEEE-754', () => {
  it('495.00000000000006 -> 495', () =>
    expect(round2(495.00000000000006)).toBe(495))
  it('30*15*1.1 -> 495 (pas 496)', () =>
    expect(round2(30 * 15 * 1.1)).toBe(495))
  it('29,166666*3 -> 87,50', () => expect(round2(29.166666 * 3)).toBe(87.5))
})

describe('cas Camille : 3 bouteilles a 35 TTC (TVA 20)', () => {
  const l = computeLineAmounts(DEVIS[0])
  it('TTC = 105,00 pile (plus jamais 106)', () => expect(l.totalTtc).toBe(105))
  it('HT = 87,50', () => expect(l.totalHt).toBe(87.5))
  it('TVA = 17,50', () => expect(l.totalTva).toBe(17.5))
})

describe('Test 1 : devis multi-lignes multi-TVA', () => {
  const t = computeQuoteAmounts(DEVIS)
  const sumLines = round2(
    DEVIS.reduce((s, it) => s + computeLineAmounts(it).totalTtc, 0)
  )
  it('Total TTC global = 1855,00', () => expect(t.totalTtc).toBe(1855))
  it('somme des lignes = total, pile', () => expect(sumLines).toBe(t.totalTtc))
  it('HT + TVA = TTC', () =>
    expect(round2(t.totalHt + t.totalTva)).toBe(t.totalTtc))
})

describe('Test 2 : coherence apres modif du HT', () => {
  it('PU HT 28,50 -> PU TTC 34,20 (TVA 20)', () =>
    expect(deriveUnitTtc(28.5, 20)).toBe(34.2))
  it('ligne 3x28,50 HT : HT 85,50 / TTC 102,60', () => {
    const l = computeLineAmounts({
      quantity: 3,
      unit_price: 28.5,
      price_entry_mode: 'ht',
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(85.5)
    expect(l.totalTtc).toBe(102.6)
  })
})

describe('Test 3 : facture acompte au TTC saisi', () => {
  const t = computeQuoteAmounts(DEVIS)
  const dep = computeDepositAmounts(t.totalTtc, t.totalHt, {
    overrideTtc: 1234.56,
  })
  it('acompte affiche = 1234,56 exact (jamais 0)', () =>
    expect(dep.ttc).toBe(1234.56))
  it('HT + TVA acompte = TTC acompte', () =>
    expect(round2(dep.ht + dep.tva)).toBe(1234.56))
})

describe('Test 4 : coherence du solde', () => {
  const t = computeQuoteAmounts(DEVIS)
  const solde = computeBalanceTtc(t.totalTtc, 1234.56)
  it('solde = 1855 - 1234,56 = 620,44 pile', () => expect(solde).toBe(620.44))
  it('acompte + solde = total devis exact', () =>
    expect(round2(1234.56 + solde)).toBe(t.totalTtc))
})

describe('Remise globale en pied (option A)', () => {
  const b = computeQuoteBreakdown(DEVIS, 10)
  it('sous-total = somme des lignes = 1855', () => expect(b.subTtc).toBe(1855))
  it('total apres remise 10% = 1669,50', () => expect(b.totalTtc).toBe(1669.5))
  it('remise = sous-total - total = 185,50', () => expect(b.remiseTtc).toBe(185.5))
  it('HT + TVA = TTC', () => expect(round2(b.totalHt + b.totalTva)).toBe(b.totalTtc))
})

describe('Test 5 : coherence comptable HT/TVA cumulee (tolerance 0,01)', () => {
  const t = computeQuoteAmounts(DEVIS)
  const dep = computeDepositAmounts(t.totalTtc, t.totalHt, {
    overrideTtc: 1234.56,
  })
  const soldeTtc = computeBalanceTtc(t.totalTtc, dep.ttc)
  const soldeHt = round2(soldeTtc * (t.totalHt / t.totalTtc))
  const soldeTva = round2(soldeTtc - soldeHt)
  it('somme HT (acompte + solde) = HT devis +/- 0,01', () =>
    expect(Math.abs(dep.ht + soldeHt - t.totalHt)).toBeLessThanOrEqual(0.01))
  it('somme TVA (acompte + solde) = TVA devis +/- 0,01', () =>
    expect(Math.abs(dep.tva + soldeTva - t.totalTva)).toBeLessThanOrEqual(0.01))
})

describe('Mono-ancre par defaut (ht) : unit_price_ttc ignore comme cache perime', () => {
  it('pas de price_entry_mode -> ancre HT, unit_price_ttc (cache) ignore', () => {
    const l = computeLineAmounts({
      quantity: 2,
      unit_price: 10,
      unit_price_ttc: 12.5, // cache perime, ne pilote pas le total
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(20) // 2*10
    expect(l.totalTtc).toBe(24) // 20*1.2, PAS 2*12.5=25
    expect(l.totalTva).toBe(4)
  })
  it('remise ancree HT : le TTC (cache) est ignore, remise cote HT', () => {
    const l = computeLineAmounts({
      quantity: 1,
      unit_price: 100,
      unit_price_ttc: 120, // cache perime, ne pilote pas le total
      discount_amount: 20,
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(80) // 100 - 20
    expect(l.totalTtc).toBe(96) // 80*1.2
    expect(l.totalTva).toBe(16)
  })
  it('legacy HT seul (unit_price_ttc absent) -> derive comme avant', () => {
    const l = computeLineAmounts({
      quantity: 3,
      unit_price: 28.5,
      price_entry_mode: 'ht',
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(85.5)
    expect(l.totalTtc).toBe(102.6)
  })
})

describe('displayUnitTtc : PU TTC affiche coherent avec le total de ligne', () => {
  it('PU TTC saisi -> verbatim', () =>
    expect(displayUnitTtc({ quantity: 40, unit_price: 45.45, unit_price_ttc: 50, tva_rate: 10, total_ttc: 2000 })).toBe(50))
  it('cas SAPRI : pas de PU TTC stocke, total bon -> total / qte (50, pas 49,995x40=1999,80)', () =>
    expect(displayUnitTtc({ quantity: 40, unit_price: 45.45, unit_price_ttc: null, tva_rate: 10, total_ttc: 2000 })).toBe(50))
  it('import BS a centimes : total / qte meme non divisible (545,45 / 40)', () =>
    expect(displayUnitTtc({ quantity: 40, unit_price: 13.64, unit_price_ttc: null, tva_rate: 10, total_ttc: 545.45 })).toBeCloseTo(13.636, 3))
  it('ligne remisee : prix avant remise, donc derivation HT (pas total / qte)', () =>
    expect(displayUnitTtc({ quantity: 2, unit_price: 100, unit_price_ttc: null, discount_amount: 20, tva_rate: 20, total_ttc: 216 })).toBe(120))
  it('sans total stocke -> derivation HT au centime', () =>
    expect(displayUnitTtc({ quantity: 40, unit_price: 45.45, unit_price_ttc: null, tva_rate: 10, total_ttc: null })).toBe(50))
  it('tva_rate null -> defaut 20 comme les autres helpers', () =>
    expect(displayUnitTtc({ quantity: 3, unit_price: 28.5, unit_price_ttc: null, tva_rate: null, total_ttc: null })).toBe(34.2))
})

describe('computeLineAmounts mono-ancre (price_entry_mode fait foi)', () => {
  it('mode ttc : ancre TTC, cas SPLASH 16 x 39.99 = 639.84', () => {
    const l = computeLineAmounts({
      quantity: 16,
      unit_price: 36.35,
      unit_price_ttc: 39.99,
      price_entry_mode: 'ttc',
      tva_rate: 10,
    })
    expect(l.totalTtc).toBe(639.84)
    expect(l.totalHt).toBe(581.67) // round2(639.84 / 1.1)
    expect(l.totalTva).toBe(58.17)
  })
  it('mode ht : ancre HT même si unit_price_ttc (cache) est présent', () => {
    const l = computeLineAmounts({
      quantity: 16,
      unit_price: 36.35,
      unit_price_ttc: 39.99, // cache périmé — ne doit PAS piloter le total
      price_entry_mode: 'ht',
      tva_rate: 10,
    })
    expect(l.totalHt).toBe(581.6)
    expect(l.totalTtc).toBe(639.76)
  })
  it('mode ttc : remise appliquée côté ancre (TTC)', () => {
    const l = computeLineAmounts({
      quantity: 10,
      unit_price_ttc: 15,
      price_entry_mode: 'ttc',
      discount_amount: 20,
      tva_rate: 10,
    })
    expect(l.totalTtc).toBe(130) // round2(150 - 20)
    expect(l.totalHt).toBe(118.18)
  })
  it('mode ttc sans unit_price_ttc : fallback unit_price x mult (legacy)', () => {
    const l = computeLineAmounts({
      quantity: 2,
      unit_price: 100,
      price_entry_mode: 'ttc',
      tva_rate: 20,
    })
    expect(l.totalTtc).toBe(240)
  })
})

describe('resolveUnitPrices : les deux PU persistés, ancre intacte', () => {
  it('mode ttc : ancre 39.99 gardée, HT dérivé', () => {
    const u = resolveUnitPrices({
      unit_price_ttc: 39.99,
      price_entry_mode: 'ttc',
      tva_rate: 10,
    })
    expect(u.unit_price_ttc).toBe(39.99)
    expect(u.unit_price).toBe(36.35) // deriveUnitHt(39.99, 10)
  })
  it('mode ht : ancre 36.35 gardée, TTC dérivé', () => {
    const u = resolveUnitPrices({
      unit_price: 36.35,
      price_entry_mode: 'ht',
      tva_rate: 10,
    })
    expect(u.unit_price).toBe(36.35)
    expect(u.unit_price_ttc).toBe(39.99) // deriveUnitTtc
  })
})

describe('sumStoredQuoteTotals : somme des totaux stockés, remise en pied', () => {
  const items = [
    { total_ht: 581.6, total_ttc: 639.76 },
    { total_ht: 100, total_ttc: 120 },
  ]
  it('sans remise', () => {
    const t = sumStoredQuoteTotals(items, 0)
    expect(t.totalHt).toBe(681.6)
    expect(t.totalTtc).toBe(759.76)
    expect(t.totalTva).toBe(78.16)
  })
  it('remise 10% appliquée une fois en pied', () => {
    const t = sumStoredQuoteTotals(items, 10)
    expect(t.totalTtc).toBe(683.78) // round2(759.76 * 0.9)
    expect(t.totalHt).toBe(613.44)
  })
  it('ligne à totaux NULL : recalcul de secours via computeLineAmounts', () => {
    const t = sumStoredQuoteTotals(
      [
        { total_ht: null, total_ttc: null, quantity: 2, unit_price: 50,
          price_entry_mode: 'ht', tva_rate: 20 },
      ],
      0
    )
    expect(t.totalHt).toBe(100)
    expect(t.totalTtc).toBe(120)
  })
})

describe('displayUnitHt + formatUnitPriceEuro (PU adaptatif)', () => {
  it('displayUnitHt : total stocké / qté quand pas de remise', () => {
    expect(displayUnitHt({ quantity: 3, unit_price: 29.17, total_ht: 87.5 }))
      .toBeCloseTo(29.166666, 4)
  })
  it('formatUnitPriceEuro : 2 décimales quand exact', () => {
    expect(formatUnitPriceEuro(39.99)).toBe('39,99 €')
  })
  it('formatUnitPriceEuro : étend à 3-4 décimales quand nécessaire', () => {
    expect(formatUnitPriceEuro(639.76 / 16)).toBe('39,985 €')
  })
})
