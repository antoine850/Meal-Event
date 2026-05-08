// Source de vérité de l'arrondi des montants de devis.
// Règle : chaque ligne TTC est arrondie au supérieur à l'euro entier (Math.ceil).
// Le HT par ligne est dérivé du TTC arrondi (HT = TTC / (1 + tva_rate/100)).
// Le total TTC du devis = ceil(somme(line_ttc) × (1 - remise%/100)).
// HT/TVA totaux sont décimaux (dérivés), TTC est toujours entier.

type LineInput = {
  quantity?: number | null
  unit_price?: number | null
  discount_amount?: number | null
  tva_rate?: number | null
}

export function roundLineTtc(input: LineInput): number {
  const qty = input.quantity ?? 0
  const price = input.unit_price ?? 0
  const discount = input.discount_amount ?? 0
  const tvaRate = input.tva_rate ?? 0
  const rawTtc = (qty * price - discount) * (1 + tvaRate / 100)
  return Math.ceil(rawTtc)
}

export function deriveLineHt(
  lineTtc: number,
  tvaRate: number | null | undefined
): number {
  const rate = tvaRate ?? 0
  if (rate <= -100) return 0
  return lineTtc / (1 + rate / 100)
}

export type QuoteTotals = {
  totalHt: number
  totalTva: number
  totalTtc: number
}

export function computeQuoteTotals(
  items: LineInput[],
  discountPercentage: number | null | undefined = 0
): QuoteTotals {
  const discountPct = discountPercentage ?? 0
  const discountMult = discountPct > 0 ? 1 - discountPct / 100 : 1

  let rawTotalTtc = 0
  let rawTotalHt = 0
  for (const item of items) {
    const lineTtc = roundLineTtc(item)
    rawTotalTtc += lineTtc
    rawTotalHt += deriveLineHt(lineTtc, item.tva_rate ?? 0)
  }

  const totalTtc = Math.ceil(rawTotalTtc * discountMult)
  const totalHt = rawTotalHt * discountMult
  const totalTva = totalTtc - totalHt
  return { totalHt, totalTva, totalTtc }
}

// Normalise les séparateurs de l'Intl.NumberFormat fr-FR pour le rendu PDF.
// Intl produit U+202F (NARROW NO-BREAK SPACE) comme séparateur de milliers ; ce
// caractère est mal supporté par html2canvas/jsPDF et apparaît comme "/" dans
// les PDF téléchargés. On le remplace par U+00A0 (NO-BREAK SPACE) qui est rendu
// correctement par toutes les polices.
export function normalizeFrenchSpaces(s: string): string {
  return s.replace(/ /g, ' ')
}

// Format "1 234 €" — pour TTC entiers.
export function formatEuroWhole(amount: number): string {
  const rounded = Math.round(amount)
  return normalizeFrenchSpaces(
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(rounded)
  )
}

// Format "1 234,56 €" — pour HT/TVA décimaux dérivés.
export function formatEuroDecimal(amount: number): string {
  return normalizeFrenchSpaces(
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount)
  )
}

// Entier si rond (à 0,5 cent près), décimal sinon. Pour montants pouvant
// venir de Stripe (entiers) OU saisis manuellement (décimaux possibles).
export function formatEuroAdaptive(amount: number): string {
  const isWhole = Math.abs(amount - Math.round(amount)) < 0.005
  return isWhole ? formatEuroWhole(amount) : formatEuroDecimal(amount)
}
