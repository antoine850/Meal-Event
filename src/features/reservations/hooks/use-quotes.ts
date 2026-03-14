import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { apiClient } from '@/lib/api-client'
import { getCurrentOrganizationId } from '@/lib/get-current-org'
import type { Quote, QuoteItem } from '@/lib/supabase/types'
import type { ProductWithRestaurants } from '@/features/settings/hooks/use-products'

// Set one quote as primary for a booking (single active quote)
export function useSetPrimaryQuote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ quoteId, bookingId }: { quoteId: string; bookingId: string }) => {
      // Clear existing primary on booking
      const { error: clearError } = await supabase
        .from('quotes')
        .update({ primary_quote: false } as never)
        .eq('booking_id', bookingId)
      if (clearError) throw clearError

      // Set selected quote as primary
      const { data, error } = await supabase
        .from('quotes')
        .update({ primary_quote: true } as never)
        .eq('id', quoteId)
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

// ============================================
// Integration Hooks: Email, Signature, Payments
// ============================================

export function useSendQuoteEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ quoteId, bookingId: _bookingId }: { quoteId: string; bookingId: string }) => {
      return apiClient<{ success: boolean; emailId: string }>(`/api/quotes/${quoteId}/send-email`, {
        method: 'POST',
      })
    },
    onSuccess: (_, { bookingId, quoteId }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
    },
  })
}

export function useSendSignature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ quoteId, bookingId: _bookingId }: { quoteId: string; bookingId: string }) => {
      return apiClient<{ success: boolean; documentId: string; inviteId: string }>(`/api/quotes/${quoteId}/send-signature`, {
        method: 'POST',
      })
    },
    onSuccess: (_, { bookingId, quoteId }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
    },
  })
}

export function useSendDeposit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ quoteId, bookingId: _bookingId }: { quoteId: string; bookingId: string }) => {
      return apiClient<{ success: boolean; sessionId: string; paymentUrl: string }>(`/api/quotes/${quoteId}/send-deposit`, {
        method: 'POST',
      })
    },
    onSuccess: (_, { bookingId, quoteId }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
      queryClient.invalidateQueries({ queryKey: ['payments', bookingId] })
    },
  })
}

export function useSendBalance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ quoteId, bookingId: _bookingId }: { quoteId: string; bookingId: string }) => {
      return apiClient<{ success: boolean; sessionId: string; paymentUrl: string }>(`/api/quotes/${quoteId}/send-balance`, {
        method: 'POST',
      })
    },
    onSuccess: (_, { bookingId, quoteId }) => {
      queryClient.invalidateQueries({ queryKey: ['quotes', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['quote', quoteId] })
      queryClient.invalidateQueries({ queryKey: ['payments', bookingId] })
    },
  })
}

// ============================================
// Types
// ============================================

export type QuoteWithItems = Quote & {
  quote_items: QuoteItem[]
}

// ============================================
// Default conditions templates with placeholders
// Placeholders: {{company_name}}, {{legal_form}}, {{billing_address}}, {{billing_postal_code}}, {{billing_city}}, {{rcs}}, {{siren}}, {{siret}}, {{share_capital}}, {{billing_email}}
// ============================================

export type RestaurantBillingInfo = {
  company_name?: string | null
  legal_form?: string | null
  billing_address?: string | null
  billing_postal_code?: string | null
  billing_city?: string | null
  rcs?: string | null
  siren?: string | null
  siret?: string | null
  share_capital?: string | null
  billing_email?: string | null
  name?: string | null
}

// CGV Templates - French
const CGV_DEVIS_FR = `CONDITIONS GÉNÉRALES DE VENTE

1. Objet

Les présentes conditions générales de vente et son annexe "Respect des règles sanitaires" régissent les relations entre le client et la société {{company_name}}, {{legal_form}} dont le siège social est {{billing_address}} {{billing_postal_code}} {{billing_city}} immatriculée au Registre du commerce et des sociétés sous le numéro {{rcs}} (le « Prestataire »). Les conditions générales de vente sont applicables aux réservations de groupes effectuées par le client au sein de l'établissement détenu par le Prestataire sont considérées comme telles, toutes les réservations supérieures à onze (11) personnes passées auprès du Prestataire.

2. Acceptation des Conditions Générales de Vente

Les présentes conditions générales de vente sont adressées au client avec l'envoi d'un devis pour lui permettre d'effectuer sa réservation. En signant le devis, le client reconnaît avoir pris connaissance et accepté les termes des présentes conditions générales de vente.

3. Réservation

3.1 - La réservation du client est considérée comme définitive dès paiement par lui du montant total du prix de la commande tel qu'indiqué au terme du devis, en réponse à l'envoi de son devis et de ses conditions générales de vente signés.

3.2 - Un dépôt de garanties peut être exigé pour que la réservation soit complètement validée, destiné à couvrir les dommages et/ou dégradations des espaces ainsi que des mobiliers et équipements les garnissant, causés par le client et/ou ses invités.

Le dépôt de garantie sera restitué au client dans un délai maximum de 15 jours, après l'exécution de la réservation, déduction faite des sommes couvrant les dommages et/ou dégradations des espaces ainsi que des mobiliers et équipements les garnissant, causé par le client et/ou ses invités.

4. Conditions de modification et d'annulation de la réservation

4.1 - Il est rappelé au Client, conformément à l'article L. 221-28-12° du Code de la consommation, qu'il ne dispose pas du droit de rétractation prévu à l'article L. 221-18 du Code de la consommation.

4.2 - Le client a la possibilité de modifier le nombre de participants en respectant les limites qui vont suivre, en informant le Prestataire et ce jusqu'à 7 jours ouvrables avant la réalisation de la prestation. Cette modification entraînera une variation du montant de la facturation de la prestation au prorata du nombre de participants.

4.3 - Passé ce délai, en cas de baisse du nombre de participants, le montant de la facturation restera toutefois celle fixée au devis.

4.4 - En cas d'annulation par le client de sa réservation après confirmation 7 jours ouvrables avant la date de réalisation de la prestation, le prestataire conservera le prix de la réservation commandée tel que prévue aux termes du devis.

5. Facturation

5.1 – Sauf modification intervenue conformément à l'article 4.2 ci-dessus, la facturation correspondra au minimum, au montant du devis accepté par le biais de la confirmation du client.

5.2 - Si au jour de la prestation, le nombre de participants est inférieur à celui prévu initialement, la facturation ne pourra pas être minorée au prorata du nombre de participants absents.

5.3 - Si au jour de la prestation, le nombre de participants est supérieur à celui prévu initialement, la facturation sera majorée au prorata du nombre de participants présents.

5.4 - Aucun escompte ne sera accordé en cas de règlement anticipé.

6. Inexécution - Défaut de paiement

6.1 - Le règlement intégral de la prestation est exigible au jour de l'exécution de l'envoi du devis signé par le client.

Le défaut de paiement à l'échéance fixée entraîne automatiquement l'application d'une pénalité de retard. Cette pénalité représente 3 fois le taux d'intérêt légal en vigueur à compter de la date d'exigibilité et sur la totalité des sommes restant dues.

6.2 - En cas de retard de paiement, l'indemnité forfaitaire pour frais de recouvrement est de 40 euros.

7. Engagement et obligations du client

7.1 - Un état des lieux des espaces ainsi que des mobiliers et équipements garnissant lesdits espaces pourra être réalisé avant et après l'exécution de la réservation sur demande de l'autre partie.

7.2 - À défaut d'état des lieux/inventaires avant l'exécution de la réservation, l'ensemble des espaces ainsi que les mobiliers et équipements garnissant lesdits espaces sont réputés être en parfait état d'usage et/ou de fonctionnement.

7.3 - Le client est responsable de tous dégâts causés par lui-même, ses préposés, ses invités dans les établissements et locaux du Prestataire.

8. Responsabilité du Prestataire

8.1 - Le Prestataire n'est pas responsable du matériel et des objets entreposés dans ses établissements par le client, ses préposés ou invités.

8.2 - Le Prestataire n'est pas responsable du comportement de ses clients et des préjudices qui en découleraient pour autrui.

9. Protection des données à caractère personnel

9.1 - Le Prestataire collecte et traite des données personnelles du client, en qualité de responsable du traitement, pour exécuter la prestation. La base légale est l'exécution d'un contrat. Les destinataires de ces données sont le service commercial, le service comptabilité et la direction du Prestataire.

9.2 - Le Client dispose d'un droit d'accès, de rectification, d'effacement et à la portabilité de ses données. Pour exercer ses droits, le client peut formuler sa demande par e-mail à {{billing_email}} ou par courrier postal à {{company_name}} {{billing_address}} {{billing_postal_code}} {{billing_city}}.

10. Force majeure

En cas de force majeure, chaque partie est libérée de toute obligation à l'égard de l'autre partie. De façon expresse, sont considérés comme cas de force majeure : les grèves, intempéries, épidémies, blocage des moyens de transport, incendie, tempête, inondation, restrictions gouvernementales et tous autres cas indépendants de la volonté expresse des Parties.

11. Tribunal compétent

11.1 - Les présentes conditions générales de vente sont régies exclusivement par le droit français.

11.2 - En cas de litige, le client peut recourir gratuitement à un médiateur de la consommation en vue de la résolution amiable du litige. En l'absence d'accord amiable entre les parties, le litige pourra être porté devant le tribunal compétent.`

// CGV Templates - English
const CGV_DEVIS_EN = `GENERAL TERMS AND CONDITIONS OF SALE

1. Purpose

These general terms and conditions of sale govern the relationship between the client and {{company_name}}, a {{legal_form}} with registered office at {{billing_address}} {{billing_postal_code}} {{billing_city}}, registered under number {{rcs}} (the "Provider"). These general terms and conditions apply to group reservations made by the client at the establishment owned by the Provider, defined as any reservation for more than eleven (11) persons.

2. Acceptance of General Terms and Conditions

These general terms and conditions are sent to the client with the quote to enable them to make their reservation. By signing the quote, the client acknowledges having read and accepted the terms of these general conditions.

3. Reservation

3.1 - The client's reservation is considered final upon payment of the total amount as indicated in the quote, in response to sending the signed quote and general terms and conditions.

3.2 - A security deposit may be required for the reservation to be fully validated, intended to cover any damage to the spaces, furniture, and equipment caused by the client and/or their guests.

The security deposit will be returned to the client within a maximum of 15 days after the execution of the reservation, less any amounts covering damages.

4. Modification and Cancellation Conditions

4.1 - The client is reminded that, in accordance with Article L. 221-28-12° of the Consumer Code, they do not have the right of withdrawal provided for in Article L. 221-18 of the Consumer Code.

4.2 - The client may modify the number of participants by informing the Provider up to 7 working days before the service. This modification will result in a variation of the invoice amount in proportion to the number of participants.

4.3 - After this deadline, in case of a decrease in the number of participants, the invoice amount will remain as set in the quote.

4.4 - In case of cancellation by the client after confirmation 7 working days before the service date, the Provider will retain the reservation price as provided in the quote.

5. Invoicing

5.1 - Unless modified in accordance with Article 4.2 above, the invoice will correspond at minimum to the amount of the quote accepted by the client.

5.2 - If on the day of the service, the number of participants is lower than initially planned, the invoice cannot be reduced in proportion to absent participants.

5.3 - If on the day of the service, the number of participants is higher than initially planned, the invoice will be increased in proportion to the participants present.

5.4 - No discount will be granted for early payment.

6. Non-performance - Default of Payment

6.1 - Full payment is due on the day the signed quote is sent by the client.

Late payment automatically triggers the application of a late payment penalty. This penalty represents 3 times the legal interest rate in force from the due date on all outstanding amounts.

6.2 - In case of late payment, the fixed compensation for recovery costs is 40 euros.

7. Client Commitments and Obligations

7.1 - An inventory of the spaces, furniture, and equipment may be carried out before and after the reservation at the request of either party.

7.2 - In the absence of an inventory before the reservation, all spaces, furniture, and equipment are deemed to be in perfect working condition.

7.3 - The client is responsible for all damage caused by themselves, their employees, or their guests on the Provider's premises.

8. Provider's Liability

8.1 - The Provider is not responsible for materials and objects stored on its premises by the client, their employees, or guests.

8.2 - The Provider is not responsible for the behavior of its clients and any resulting harm to others.

9. Personal Data Protection

9.1 - The Provider collects and processes the client's personal data as data controller to perform the service. The legal basis is the performance of a contract. The recipients of this data are the commercial service, accounting department, and management of the Provider.

9.2 - The Client has the right to access, rectify, erase, and port their data. To exercise these rights, the client may submit a request by email to {{billing_email}} or by post to {{company_name}} {{billing_address}} {{billing_postal_code}} {{billing_city}}.

10. Force Majeure

In case of force majeure, each party is released from all obligations to the other party. Force majeure events expressly include: strikes, severe weather, epidemics, transport blockages, fire, storm, flood, government restrictions, and all other events beyond the express will of the Parties.

11. Competent Court

11.1 - These general terms and conditions are governed exclusively by French law.

11.2 - In case of dispute, the client may use a consumer mediator free of charge for amicable resolution. Failing amicable agreement, the dispute may be brought before the competent court.`

const CGV_FACTURE_FR = `CONDITIONS GÉNÉRALES – FACTURE

1. Paiement
La facture est payable à réception, sauf mention contraire. Tout retard de paiement entraînera l'application de pénalités de retard au taux légal en vigueur, ainsi qu'une indemnité forfaitaire de 40€ pour frais de recouvrement.

2. Escompte
Aucun escompte n'est accordé pour paiement anticipé.

3. Clause de réserve de propriété
Les prestations restent la propriété de l'établissement jusqu'au paiement intégral du prix.

4. Réclamations
Toute réclamation doit être formulée par écrit dans un délai de 7 jours suivant la réception de la facture.

Société : {{company_name}}, {{legal_form}}
Siège social : {{billing_address}} {{billing_postal_code}} {{billing_city}}
RCS : {{rcs}} | SIRET : {{siret}}
Contact : {{billing_email}}`

const CGV_FACTURE_EN = `GENERAL CONDITIONS – INVOICE

1. Payment
The invoice is payable upon receipt, unless otherwise stated. Any late payment will result in the application of late payment penalties at the legal rate in force, plus a fixed compensation of €40 for recovery costs.

2. Discount
No discount is granted for early payment.

3. Retention of Title Clause
Services remain the property of the establishment until full payment of the price.

4. Claims
Any claim must be made in writing within 7 days of receiving the invoice.

Company: {{company_name}}, {{legal_form}}
Registered office: {{billing_address}} {{billing_postal_code}} {{billing_city}}
RCS: {{rcs}} | SIRET: {{siret}}
Contact: {{billing_email}}`

const CGV_ACOMPTE_FR = `CONDITIONS – ACOMPTE

Le versement de l'acompte vaut acceptation ferme et définitive du devis et des conditions générales de vente associées.

L'acompte versé est acquis à l'établissement et ne sera pas remboursé en cas d'annulation par le client, sauf dispositions contraires prévues dans les conditions d'annulation du devis.

Le solde restant dû sera facturé selon les modalités prévues au devis.

Société : {{company_name}}, {{legal_form}}
RCS : {{rcs}} | SIRET : {{siret}}`

const CGV_ACOMPTE_EN = `CONDITIONS – DEPOSIT

Payment of the deposit constitutes firm and final acceptance of the quote and associated general terms and conditions of sale.

The deposit paid is acquired by the establishment and will not be refunded in case of cancellation by the client, unless otherwise provided in the cancellation conditions of the quote.

The remaining balance will be invoiced according to the terms set out in the quote.

Company: {{company_name}}, {{legal_form}}
RCS: {{rcs}} | SIRET: {{siret}}`

const CGV_SOLDE_FR = `CONDITIONS – SOLDE

Le paiement du solde est dû selon les modalités prévues au devis.

Le solde doit être réglé intégralement avant la date de l'événement, sauf accord écrit contraire.

Tout retard de paiement entraînera l'application de pénalités de retard au taux légal en vigueur, ainsi qu'une indemnité forfaitaire de 40€ pour frais de recouvrement.

Toute contestation relative au solde doit être formulée par écrit dans un délai de 7 jours suivant la réception de la facture.

Société : {{company_name}}, {{legal_form}}
RCS : {{rcs}} | SIRET : {{siret}}`

const CGV_SOLDE_EN = `CONDITIONS – BALANCE

Payment of the balance is due according to the terms specified in the quote.

The balance must be paid in full before the event date unless otherwise agreed in writing.

Late payments will incur interest charges at the legal rate in force, plus a fixed recovery fee of €40 as provided by law.

Any dispute regarding the balance must be raised in writing within 7 days of receiving the invoice.

Company: {{company_name}}, {{legal_form}}
RCS: {{rcs}} | SIRET: {{siret}}`

// Function to replace placeholders with actual restaurant billing info
export function generateCGV(template: string, billingInfo: RestaurantBillingInfo): string {
  return template
    .replace(/\{\{company_name\}\}/g, billingInfo.company_name || billingInfo.name || '[Nom de la société]')
    .replace(/\{\{legal_form\}\}/g, billingInfo.legal_form || '[Forme juridique]')
    .replace(/\{\{billing_address\}\}/g, billingInfo.billing_address || '[Adresse]')
    .replace(/\{\{billing_postal_code\}\}/g, billingInfo.billing_postal_code || '[Code postal]')
    .replace(/\{\{billing_city\}\}/g, billingInfo.billing_city || '[Ville]')
    .replace(/\{\{rcs\}\}/g, billingInfo.rcs || '[RCS]')
    .replace(/\{\{siren\}\}/g, billingInfo.siren || '[SIREN]')
    .replace(/\{\{siret\}\}/g, billingInfo.siret || '[SIRET]')
    .replace(/\{\{share_capital\}\}/g, billingInfo.share_capital || '[Capital social]')
    .replace(/\{\{billing_email\}\}/g, billingInfo.billing_email || '[Email]')
}

// Get CGV templates by language
export function getCGVTemplates(language: 'fr' | 'en') {
  if (language === 'en') {
    return {
      devis: CGV_DEVIS_EN,
      facture: CGV_FACTURE_EN,
      acompte: CGV_ACOMPTE_EN,
      solde: CGV_SOLDE_EN,
    }
  }
  return {
    devis: CGV_DEVIS_FR,
    facture: CGV_FACTURE_FR,
    acompte: CGV_ACOMPTE_FR,
    solde: CGV_SOLDE_FR,
  }
}

// Generate all CGV conditions for a restaurant
export function generateAllCGV(language: 'fr' | 'en', billingInfo: RestaurantBillingInfo) {
  const templates = getCGVTemplates(language)
  return {
    conditionsDevis: generateCGV(templates.devis, billingInfo),
    conditionsFacture: generateCGV(templates.facture, billingInfo),
    conditionsAcompte: generateCGV(templates.acompte, billingInfo),
    conditionsSolde: generateCGV(templates.solde, billingInfo),
  }
}

// Legacy exports for backward compatibility
export const DEFAULT_CONDITIONS_DEVIS = CGV_DEVIS_FR
export const DEFAULT_CONDITIONS_FACTURE = CGV_FACTURE_FR
export const DEFAULT_CONDITIONS_ACOMPTE = CGV_ACOMPTE_FR
export const DEFAULT_CONDITIONS_SOLDE = CGV_SOLDE_FR

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
          company:companies(name, billing_address, billing_city, billing_postal_code, siret, tva_number)
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
      additionalConditions,
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
      additionalConditions?: string
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

      // Build restaurant billing info for CGV placeholder replacement
      const billingInfo: RestaurantBillingInfo = {
        company_name: (restaurant as any)?.company_name || null,
        legal_form: (restaurant as any)?.legal_form || null,
        billing_address: (restaurant as any)?.billing_address || null,
        billing_postal_code: (restaurant as any)?.billing_postal_code || null,
        billing_city: (restaurant as any)?.billing_city || null,
        rcs: (restaurant as any)?.rcs || null,
        siren: (restaurant as any)?.siren || null,
        siret: (restaurant as any)?.siret || null,
        share_capital: (restaurant as any)?.share_capital || null,
        billing_email: (restaurant as any)?.billing_email || (restaurant as any)?.email || null,
        name: (restaurant as any)?.name || null,
      }

      // Generate CGV with restaurant data (replaces {{placeholders}})
      const defaultCGV = generateAllCGV('fr', billingInfo)

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
          conditions_devis: conditionsDevis ?? defaultCGV.conditionsDevis,
          conditions_facture: conditionsFacture ?? defaultCGV.conditionsFacture,
          conditions_acompte: conditionsAcompte ?? defaultCGV.conditionsAcompte,
          conditions_solde: conditionsSolde ?? defaultCGV.conditionsSolde,
          additional_conditions: additionalConditions ?? null,
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
      itemType,
    }: {
      quoteId: string
      name: string
      description?: string
      quantity: number
      unitPrice: number
      tvaRate: number
      discountAmount?: number
      position?: number
      itemType?: string
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
          item_type: itemType || 'product',
        } as never)
        .select()
        .single()

      if (error) throw error

      // Recalculate quote totals (only for products, not extras)
      if (itemType !== 'extra') {
        await recalculateQuoteTotals(quoteId)
      }

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

  // Only include product items — extras are added separately in balance calculations
  const productItems = (items as any[]).filter((item: any) => item.item_type !== 'extra')

  let totalHt = 0
  let totalTva = 0

  for (const item of productItems) {
    const itemHt = (item.quantity || 0) * (item.unit_price || 0) - (item.discount_amount || 0)
    const itemTva = itemHt * ((item.tva_rate || 0) / 100)
    totalHt += itemHt
    totalTva += itemTva
  }

  // Apply discount_percentage
  const { data: quote } = await supabase
    .from('quotes')
    .select('discount_percentage')
    .eq('id', quoteId)
    .single()

  const discountPct = (quote as any)?.discount_percentage || 0
  const discountMultiplier = discountPct > 0 ? (1 - discountPct / 100) : 1

  const finalHt = Math.round(totalHt * discountMultiplier * 100) / 100
  const finalTva = Math.round(totalTva * discountMultiplier * 100) / 100
  const finalTtc = Math.round((finalHt + finalTva) * 100) / 100

  await supabase
    .from('quotes')
    .update({
      total_ht: finalHt,
      total_tva: finalTva,
      total_ttc: finalTtc,
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

// ============================================
// Packages by Restaurant
// ============================================

export type PackageWithRelations = {
  id: string
  organization_id: string
  name: string
  description: string | null
  unit_price_ht: number
  price_per_person: boolean
  tva_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
  package_products: { product_id: string; quantity: number; product: any }[]
  package_restaurants: { restaurant_id: string; restaurant: { id: string; name: string; color: string | null } }[]
}

export function usePackagesByRestaurant(restaurantId: string | null) {
  return useQuery<PackageWithRelations[]>({
    queryKey: ['packages-by-restaurant', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return []

      const { data, error } = await supabase
        .from('packages')
        .select(`
          *,
          package_products(
            product_id,
            quantity,
            product:products(*)
          ),
          package_restaurants(
            restaurant_id,
            restaurant:restaurants(id, name, color)
          )
        `)
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error

      // Filter to only packages linked to this restaurant
      const filtered = (data as unknown as PackageWithRelations[]).filter(p =>
        p.package_restaurants?.some(pr => pr.restaurant_id === restaurantId)
      )

      return filtered
    },
    enabled: !!restaurantId,
  })
}

