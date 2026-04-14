import type { Quote, QuoteItem, Payment } from '@/lib/supabase/types'

export function formatBookingId(id: string): string {
  return id.replace(/-/g, '').slice(-10).toUpperCase()
}

export function getActiveQuote(quotes: Quote[]): Quote | null {
  if (!quotes.length) return null
  return (
    quotes.find((q) =>
      ['deposit_paid', 'balance_sent', 'balance_paid', 'completed'].includes(
        q.status || ''
      )
    ) ||
    quotes.find((q) => q.status === 'quote_signed') ||
    quotes.find((q) => q.status === 'deposit_sent') ||
    quotes.find((q) => q.primary_quote) ||
    quotes[0] ||
    null
  )
}

export function computeVatBreakdown(items: QuoteItem[]) {
  let totalHt = 0
  let totalTtc = 0
  let vat10 = 0
  let vat20 = 0
  for (const item of items) {
    const ht = item.total_ht || 0
    const ttc = item.total_ttc || 0
    totalHt += ht
    totalTtc += ttc
    const tva = ttc - ht
    if (item.tva_rate === 10) vat10 += tva
    else if (item.tva_rate === 20) vat20 += tva
  }
  return { totalHt, vat10, vat20, totalTtc }
}

export function getPaidDeposits(payments: Payment[]): Payment[] {
  return payments.filter(
    (p) =>
      (p.payment_modality === 'acompte' || p.payment_type === 'deposit') &&
      (p.status === 'paid' || p.status === 'completed')
  )
}

export function getRemainingBalance(
  totalTtc: number,
  payments: Payment[]
): number {
  const paid = payments
    .filter((p) => p.status === 'paid' || p.status === 'completed')
    .reduce((s, p) => s + (p.amount || 0), 0)
  return Math.max(0, totalTtc - paid)
}
