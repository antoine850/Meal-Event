import { describe, it, expect } from 'vitest'
import {
  round2,
  computeLineAmounts,
  computeQuoteAmounts,
  computeDepositAmounts,
  computeBalanceTtc,
  computeQuoteBreakdown,
  deriveUnitTtc,
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

describe('Verbatim : les deux PU saisis, aucune derivation', () => {
  it('HT et TTC pris tels quels (TTC != HT*(1+tva))', () => {
    const l = computeLineAmounts({
      quantity: 2,
      unit_price: 10,
      unit_price_ttc: 12.5,
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(20)
    expect(l.totalTtc).toBe(25) // 2*12.5, PAS 2*10*1.2=24
    expect(l.totalTva).toBe(5)
  })
  it('remise soustraite des deux cotes', () => {
    const l = computeLineAmounts({
      quantity: 1,
      unit_price: 100,
      unit_price_ttc: 120,
      discount_amount: 20,
      tva_rate: 20,
    })
    expect(l.totalHt).toBe(80)
    expect(l.totalTtc).toBe(100)
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
