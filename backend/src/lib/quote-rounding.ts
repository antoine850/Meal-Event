// Copie isomorphe de src/features/reservations/lib/quote-rounding.ts
// Le backend ne peut pas importer le frontend ; toute évolution de la règle
// d'arrondi doit être répercutée dans les deux fichiers.

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

export function deriveLineHt(lineTtc: number, tvaRate: number | null | undefined): number {
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
  discountPercentage: number | null | undefined = 0,
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

// Format "1 234 €" — pour TTC entiers.
export function formatEuroWhole(amount: number): string {
  const rounded = Math.round(amount)
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rounded)
}

// Format "1 234,56 €" — pour HT/TVA décimaux dérivés.
export function formatEuroDecimal(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount)
}
