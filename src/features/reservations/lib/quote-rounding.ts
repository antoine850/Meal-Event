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

// --- Regle d'arrondi au centime (ancree sur la valeur saisie) ---
// Copie isomorphe de backend/src/lib/quote-rounding.ts. Cf. note client Foolish Studio (29/06/2026) :
// arrondi 2 decimales, totaux = somme des lignes, acompte au TTC saisi, solde par soustraction.

export type PriceEntryMode = 'ht' | 'ttc'

// Arrondi mathematique au centime (0,5 au superieur), en absorbant le bruit IEEE-754
// (ex: 30*15*1,1 = 495.00000000000006 -> 495 ; 29,166666*3 = 87,499998 -> 87,50).
export function round2(n: number): number {
  const sign = n < 0 ? -1 : 1
  return (sign * Math.round((Math.abs(n) + 1e-9) * 100)) / 100
}

export type LineAmountsInput = {
  quantity?: number | null
  unit_price?: number | null // HT
  unit_price_ttc?: number | null // TTC (saisie TTC)
  price_entry_mode?: string | null // 'ht' (defaut) | 'ttc'
  discount_amount?: number | null
  tva_rate?: number | null
}

export function deriveUnitTtc(
  unitHt: number,
  tvaRate: number | null | undefined
): number {
  return round2(unitHt * (1 + (tvaRate ?? 0) / 100))
}

export function deriveUnitHt(
  unitTtc: number,
  tvaRate: number | null | undefined
): number {
  const rate = tvaRate ?? 0
  if (rate <= -100) return 0
  return round2(unitTtc / (1 + rate / 100))
}

// Totaux d'une ligne, ancres sur la valeur saisie (HT ou TTC). Aucun ceil.
export function computeLineAmounts(input: LineAmountsInput): QuoteTotals {
  const qty = input.quantity ?? 0
  const rate = input.tva_rate ?? 0
  const discount = input.discount_amount ?? 0
  const mult = 1 + rate / 100

  if (input.price_entry_mode === 'ttc') {
    const unitTtc = input.unit_price_ttc ?? (input.unit_price ?? 0) * mult
    const totalTtc = round2(qty * unitTtc - discount)
    const totalHt = rate <= -100 ? 0 : round2(totalTtc / mult)
    return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
  }
  const unitHt = input.unit_price ?? 0
  const totalHt = round2(qty * unitHt - discount)
  const totalTtc = round2(totalHt * mult)
  return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
}

// Totaux du devis (remise en pied) : sous-total = somme des lignes, puis remise globale une fois.
export function computeQuoteAmounts(
  items: LineAmountsInput[],
  discountPercentage: number | null | undefined = 0
): QuoteTotals {
  let subHt = 0
  let subTtc = 0
  for (const item of items) {
    const line = computeLineAmounts(item)
    subHt += line.totalHt
    subTtc += line.totalTtc
  }
  subHt = round2(subHt)
  subTtc = round2(subTtc)
  const pct = discountPercentage ?? 0
  const mult = pct > 0 ? 1 - pct / 100 : 1
  const totalHt = round2(subHt * mult)
  const totalTtc = round2(subTtc * mult)
  return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
}

export type QuoteBreakdown = QuoteTotals & {
  subHt: number
  subTtc: number
  remiseTtc: number
}

// Detail pour l'affichage : sous-total (somme lignes), remise en euros, total. Somme lignes = subTtc.
export function computeQuoteBreakdown(
  items: LineAmountsInput[],
  discountPercentage: number | null | undefined = 0
): QuoteBreakdown {
  let subHt = 0
  let subTtc = 0
  for (const item of items) {
    const line = computeLineAmounts(item)
    subHt += line.totalHt
    subTtc += line.totalTtc
  }
  subHt = round2(subHt)
  subTtc = round2(subTtc)
  const t = computeQuoteAmounts(items, discountPercentage)
  return { ...t, subHt, subTtc, remiseTtc: round2(subTtc - t.totalTtc) }
}

export type DepositAmounts = { ttc: number; ht: number; tva: number }

// Acompte : montant fixe saisi (override) sinon pourcentage. HT ventile au prorata du HT global.
export function computeDepositAmounts(
  totalTtc: number,
  totalHt: number,
  opts: { overrideTtc?: number | null; percentage?: number | null }
): DepositAmounts {
  const ttc =
    opts.overrideTtc != null
      ? round2(opts.overrideTtc)
      : round2((totalTtc * (opts.percentage ?? 0)) / 100)
  const ht = totalTtc > 0 ? round2(ttc * (totalHt / totalTtc)) : 0
  return { ttc, ht, tva: round2(ttc - ht) }
}

// Solde = total du devis moins ce qui a deja ete encaisse. Soustraction stricte.
export function computeBalanceTtc(
  totalTtc: number,
  collectedTtc: number
): number {
  return round2(totalTtc - collectedTtc)
}

// --- Facture d'avoir ---

export type EffectiveLineInput = LineAmountsInput & {
  item_type?: string | null
}

// Total effectif = produits (avec remise en pied) + extras (hors remise).
// Reproduit exactement la base de la facture de solde : quote.total_ttc + Σ extras.total_ttc.
export function computeEffectiveTotals(
  items: EffectiveLineInput[],
  discountPercentage: number | null | undefined = 0
): QuoteTotals {
  const products = items.filter((i) => i.item_type !== 'extra')
  const extras = items.filter((i) => i.item_type === 'extra')
  const prod = computeQuoteAmounts(products, discountPercentage)
  let extraHt = 0
  let extraTtc = 0
  for (const e of extras) {
    const l = computeLineAmounts(e)
    extraHt += l.totalHt
    extraTtc += l.totalTtc
  }
  const totalHt = round2(prod.totalHt + extraHt)
  const totalTtc = round2(prod.totalTtc + extraTtc)
  return { totalHt, totalTva: round2(totalTtc - totalHt), totalTtc }
}

// Applique un credit TTC sur une ligne. Retourne la ligne modifiee (remise augmentee,
// cote ancre selon price_entry_mode) ou null si la ligne est entierement creditee.
export function applyLineCredit(
  line: LineAmountsInput,
  creditedTtc: number
): LineAmountsInput | null {
  const current = computeLineAmounts(line).totalTtc
  if (creditedTtc >= current - 1e-9) return null
  const rate = line.tva_rate ?? 0
  const mult = 1 + rate / 100
  const discount = line.discount_amount ?? 0
  const addDiscount =
    line.price_entry_mode === 'ttc'
      ? creditedTtc
      : rate <= -100
        ? 0
        : creditedTtc / mult
  return { ...line, discount_amount: round2(discount + addDiscount) }
}

export type CreditItemInput = EffectiveLineInput & { id: string }
export type CreditedItem = {
  id: string
  creditedTtc: number
  remove: boolean
  newDiscountAmount: number | null
}
export type CreditNoteResult = {
  avoirHt: number
  avoirTva: number
  avoirTtc: number
  oldEffectiveHt: number
  oldEffectiveTtc: number
  newEffectiveHt: number
  newEffectiveTtc: number
  overpaidTtc: number
  creditedItems: CreditedItem[]
}

// Coeur du calcul d'avoir. avoir = ancien total effectif - nouveau, mesure apres application.
export function computeCreditNote(
  items: CreditItemInput[],
  creditsByItemId: Record<string, number>,
  discountPercentage: number | null | undefined,
  collectedTtc: number
): CreditNoteResult {
  const old = computeEffectiveTotals(items, discountPercentage)
  const creditedItems: CreditedItem[] = []
  const newItems: CreditItemInput[] = []
  for (const it of items) {
    const credit = creditsByItemId[it.id]
    if (!credit || credit <= 0) {
      newItems.push(it)
      continue
    }
    const modified = applyLineCredit(it, credit)
    if (modified === null) {
      creditedItems.push({
        id: it.id,
        creditedTtc: round2(computeLineAmounts(it).totalTtc),
        remove: true,
        newDiscountAmount: null,
      })
    } else {
      const actual = round2(
        computeLineAmounts(it).totalTtc - computeLineAmounts(modified).totalTtc
      )
      creditedItems.push({
        id: it.id,
        creditedTtc: actual,
        remove: false,
        newDiscountAmount: modified.discount_amount ?? null,
      })
      newItems.push({ ...it, discount_amount: modified.discount_amount })
    }
  }
  const neu = computeEffectiveTotals(newItems, discountPercentage)
  const avoirTtc = round2(old.totalTtc - neu.totalTtc)
  const avoirHt = round2(old.totalHt - neu.totalHt)
  return {
    avoirHt,
    avoirTva: round2(avoirTtc - avoirHt),
    avoirTtc,
    oldEffectiveHt: old.totalHt,
    oldEffectiveTtc: old.totalTtc,
    newEffectiveHt: neu.totalHt,
    newEffectiveTtc: neu.totalTtc,
    overpaidTtc: Math.max(0, round2(collectedTtc - neu.totalTtc)),
    creditedItems,
  }
}
