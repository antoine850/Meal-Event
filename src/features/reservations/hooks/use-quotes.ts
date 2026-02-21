import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Quote, QuoteItem } from '@/lib/supabase/types'
import type { ProductWithRestaurants } from '@/features/settings/hooks/use-products'

async function getCurrentOrganizationId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  return (data as { organization_id: string } | null)?.organization_id || null
}

// ============================================
// Types
// ============================================

export type QuoteWithItems = Quote & {
  quote_items: QuoteItem[]
}

// ============================================
// Default conditions templates
// ============================================

export const DEFAULT_CONDITIONS_DEVIS = `CONDITIONS GÉNÉRALES DE VENTE – DEVIS

1. Objet
Les présentes conditions générales de vente (CGV) régissent les relations contractuelles entre l'établissement et le client dans le cadre de la prestation événementielle décrite dans le devis.

2. Devis et acceptation
Le devis est valable pendant la durée indiquée sur celui-ci. L'acceptation du devis par le client vaut engagement ferme. Toute modification ultérieure devra faire l'objet d'un avenant écrit.

3. Prix
Les prix indiqués sont en euros. Ils sont soumis à la TVA au taux en vigueur. Tout supplément ou modification de prestation fera l'objet d'une facturation complémentaire.

4. Acompte et paiement
Un acompte est exigé à la signature du devis. Le solde est payable selon les conditions indiquées sur le devis. En cas de retard de paiement, des pénalités de retard seront appliquées conformément à la législation en vigueur.

5. Annulation
Toute annulation doit être notifiée par écrit. En cas d'annulation :
- Plus de 30 jours avant l'événement : l'acompte est conservé
- Moins de 30 jours avant l'événement : 50% du montant total est dû
- Moins de 15 jours avant l'événement : 100% du montant total est dû

6. Responsabilité
L'établissement s'engage à mettre en œuvre tous les moyens nécessaires à la bonne exécution de la prestation. Sa responsabilité ne saurait être engagée en cas de force majeure.

7. Données personnelles
Les données personnelles collectées sont traitées conformément au RGPD. Le client dispose d'un droit d'accès, de rectification et de suppression de ses données.

8. Litiges
En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut, le tribunal compétent sera celui du siège de l'établissement.`

export const DEFAULT_CONDITIONS_FACTURE = `CONDITIONS GÉNÉRALES – FACTURE

1. Paiement
La facture est payable à réception, sauf mention contraire. Tout retard de paiement entraînera l'application de pénalités de retard au taux légal en vigueur, ainsi qu'une indemnité forfaitaire de 40€ pour frais de recouvrement.

2. Escompte
Aucun escompte n'est accordé pour paiement anticipé.

3. Clause de réserve de propriété
Les prestations restent la propriété de l'établissement jusqu'au paiement intégral du prix.

4. Réclamations
Toute réclamation doit être formulée par écrit dans un délai de 7 jours suivant la réception de la facture.`

export const DEFAULT_CONDITIONS_ACOMPTE = `CONDITIONS – ACOMPTE

Le versement de l'acompte vaut acceptation ferme et définitive du devis et des conditions générales de vente associées.

L'acompte versé est acquis à l'établissement et ne sera pas remboursé en cas d'annulation par le client, sauf dispositions contraires prévues dans les conditions d'annulation du devis.

Le solde restant dû sera facturé selon les modalités prévues au devis.`

export const DEFAULT_CONDITIONS_SOLDE = `CONDITIONS – SOLDE / BALANCE

Payment of the balance is due according to the terms specified in the quote.

The balance must be paid in full before the event date unless otherwise agreed in writing.

Late payments will incur interest charges at the legal rate in force, plus a fixed recovery fee of €40 as provided by law.

Any dispute regarding the balance must be raised in writing within 7 days of receiving the invoice.`

// ============================================
// Hooks
// ============================================

export function useRestaurantById(restaurantId: string | null) {
  return useQuery({
    queryKey: ['restaurant-detail', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null

      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single()

      if (error) throw error
      return data as any
    },
    enabled: !!restaurantId,
  })
}

export function useContactWithCompany(contactId: string | null) {
  return useQuery({
    queryKey: ['contact-for-quote', contactId],
    queryFn: async () => {
      if (!contactId) return null

      const { data, error } = await supabase
        .from('contacts')
        .select(`
          id, first_name, last_name, email, phone,
          company:companies(name, billing_address, billing_city, billing_postal_code)
        `)
        .eq('id', contactId)
        .single()

      if (error) throw error
      return data as any
    },
    enabled: !!contactId,
  })
}

export function useQuoteWithItems(quoteId: string | null) {
  return useQuery<QuoteWithItems | null>({
    queryKey: ['quote', quoteId],
    queryFn: async () => {
      if (!quoteId) return null

      const { data, error } = await supabase
        .from('quotes')
        .select(`
          *,
          quote_items(*)
        `)
        .eq('id', quoteId)
        .single()

      if (error) throw error
      return data as unknown as QuoteWithItems
    },
    enabled: !!quoteId,
  })
}

export function useCreateQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      bookingId,
      restaurantId,
      contactId,
      title,
      dateStart,
      dateEnd,
      conditionsDevis,
      conditionsFacture,
      conditionsAcompte,
      conditionsSolde,
      commentsFr,
      commentsEn,
      depositPercentage,
      depositLabel,
      depositDays,
      balanceLabel,
      balanceDays,
      quoteDueDays,
      invoiceDueDays,
    }: {
      bookingId: string
      restaurantId: string
      contactId?: string
      title?: string
      dateStart?: string
      dateEnd?: string
      conditionsDevis?: string
      conditionsFacture?: string
      conditionsAcompte?: string
      conditionsSolde?: string
      commentsFr?: string
      commentsEn?: string
      depositPercentage?: number
      depositLabel?: string
      depositDays?: number
      balanceLabel?: string
      balanceDays?: number
      quoteDueDays?: number
      invoiceDueDays?: number
    }) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      // Get restaurant for prefix
      const { data: restaurant } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', restaurantId)
        .single()

      const prefix = (restaurant as any)?.invoice_prefix || 'DEV'
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const shortId = Math.random().toString(36).substring(2, 6)
      const quoteNumber = `${prefix}-${year}-${month}-${shortId}-v1`

      const { data, error } = await supabase
        .from('quotes')
        .insert({
          organization_id: orgId,
          booking_id: bookingId,
          contact_id: contactId || null,
          quote_number: quoteNumber,
          status: 'draft',
          title: title || null,
          date_start: dateStart || null,
          date_end: dateEnd || null,
          quote_date: now.toISOString().split('T')[0],
          deposit_percentage: depositPercentage ?? 80,
          deposit_label: depositLabel ?? 'Acompte à signature',
          deposit_days: depositDays ?? 7,
          balance_label: balanceLabel ?? 'Solde',
          balance_days: balanceDays ?? 0,
          quote_due_days: quoteDueDays ?? (restaurant as any)?.quote_validity_days ?? 7,
          invoice_due_days: invoiceDueDays ?? (restaurant as any)?.invoice_due_days ?? 0,
          comments_fr: commentsFr ?? (restaurant as any)?.quote_comments_fr ?? null,
          comments_en: commentsEn ?? (restaurant as any)?.quote_comments_en ?? null,
          conditions_devis: conditionsDevis ?? DEFAULT_CONDITIONS_DEVIS,
          conditions_facture: conditionsFacture ?? DEFAULT_CONDITIONS_FACTURE,
          conditions_acompte: conditionsAcompte ?? DEFAULT_CONDITIONS_ACOMPTE,
          conditions_solde: conditionsSolde ?? DEFAULT_CONDITIONS_SOLDE,
          language: 'fr',
          version: 1,
        } as never)
        .select()
        .single()

      if (error) throw error
      return data as Quote
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.bookingId] })
    },
  })
}

export function useUpdateQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, bookingId, ...updates }: Partial<Quote> & { id: string; bookingId?: string }) => {
      const { data, error } = await supabase
        .from('quotes')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data as Quote
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', (data as any).booking_id] })
      queryClient.invalidateQueries({ queryKey: ['quote', (data as any).id] })
    },
  })
}

export function useDeleteQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, bookingId }: { id: string; bookingId: string }) => {
      const { error } = await supabase.from('quotes').delete().eq('id', id)
      if (error) throw error
      return { bookingId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', data.bookingId] })
    },
  })
}

// ============================================
// Quote Items
// ============================================

export function useAddQuoteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      quoteId,
      name,
      description,
      quantity,
      unitPrice,
      tvaRate,
      discountAmount,
      position,
    }: {
      quoteId: string
      name: string
      description?: string
      quantity: number
      unitPrice: number
      tvaRate: number
      discountAmount?: number
      position?: number
    }) => {
      const totalHt = quantity * unitPrice - (discountAmount || 0)
      const totalTtc = totalHt * (1 + tvaRate / 100)

      const { data, error } = await supabase
        .from('quote_items')
        .insert({
          quote_id: quoteId,
          name,
          description: description || null,
          quantity,
          unit_price: unitPrice,
          tva_rate: tvaRate,
          discount_amount: discountAmount || 0,
          total_ht: totalHt,
          total_ttc: totalTtc,
          position: position || 0,
        } as never)
        .select()
        .single()

      if (error) throw error

      // Recalculate quote totals
      await recalculateQuoteTotals(quoteId)

      return data as QuoteItem
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quote', (data as any).quote_id] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useUpdateQuoteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, quoteId, ...updates }: Partial<QuoteItem> & { id: string; quoteId: string }) => {
      // Recalculate totals if quantity/price changed
      const quantity = updates.quantity as number | undefined
      const unitPrice = updates.unit_price as number | undefined
      const tvaRate = updates.tva_rate as number | undefined
      const discountAmount = updates.discount_amount as number | undefined

      if (quantity !== undefined || unitPrice !== undefined) {
        // Fetch current item to get missing values
        const { data: current } = await supabase
          .from('quote_items')
          .select('*')
          .eq('id', id)
          .single()

        const q = quantity ?? (current as any)?.quantity ?? 1
        const p = unitPrice ?? (current as any)?.unit_price ?? 0
        const t = tvaRate ?? (current as any)?.tva_rate ?? 20
        const d = discountAmount ?? (current as any)?.discount_amount ?? 0

        const totalHt = q * p - d
        const totalTtc = totalHt * (1 + t / 100)

        updates = { ...updates, total_ht: totalHt, total_ttc: totalTtc } as any
      }

      const { data, error } = await supabase
        .from('quote_items')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      await recalculateQuoteTotals(quoteId)

      return data as QuoteItem
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quote', variables.quoteId] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

export function useDeleteQuoteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, quoteId }: { id: string; quoteId: string }) => {
      const { error } = await supabase.from('quote_items').delete().eq('id', id)
      if (error) throw error

      await recalculateQuoteTotals(quoteId)

      return { quoteId }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quote', data.quoteId] })
      queryClient.invalidateQueries({ queryKey: ['quotes'] })
    },
  })
}

async function recalculateQuoteTotals(quoteId: string) {
  const { data: items } = await supabase
    .from('quote_items')
    .select('*')
    .eq('quote_id', quoteId)

  if (!items) return

  let totalHt = 0
  let totalTva = 0

  for (const item of items as any[]) {
    const itemHt = (item.quantity || 0) * (item.unit_price || 0) - (item.discount_amount || 0)
    const itemTva = itemHt * ((item.tva_rate || 0) / 100)
    totalHt += itemHt
    totalTva += itemTva
  }

  const totalTtc = totalHt + totalTva

  await supabase
    .from('quotes')
    .update({
      total_ht: Math.round(totalHt * 100) / 100,
      total_tva: Math.round(totalTva * 100) / 100,
      total_ttc: Math.round(totalTtc * 100) / 100,
    } as never)
    .eq('id', quoteId)
}

// ============================================
// Products by Restaurant
// ============================================

export function useProductsByRestaurant(restaurantId: string | null) {
  return useQuery<ProductWithRestaurants[]>({
    queryKey: ['products-by-restaurant', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_restaurants(
            restaurant_id,
            restaurant:restaurants(id, name, color)
          )
        `)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      // Filter to only products linked to this restaurant
      const filtered = (data as unknown as ProductWithRestaurants[]).filter(p =>
        p.product_restaurants?.some(pr => pr.restaurant_id === restaurantId)
      )

      return filtered
    },
    enabled: !!restaurantId,
  })
}
