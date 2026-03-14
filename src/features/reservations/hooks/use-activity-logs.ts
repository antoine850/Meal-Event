import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ActivityLog } from '@/lib/supabase/types'

// ── Types ──

export type ActivityActionType =
  // Booking actions
  | 'booking.created'
  | 'booking.updated'
  | 'booking.deleted'
  | 'booking.duplicated'
  | 'booking.status_changed'
  | 'booking.assigned'
  // Quote actions
  | 'quote.created'
  | 'quote.updated'
  | 'quote.deleted'
  | 'quote.set_primary'
  | 'quote.email_sent'
  | 'quote.signature_sent'
  | 'quote.signed'
  // Payment actions
  | 'payment.created'
  | 'payment.updated'
  | 'payment.deleted'
  | 'payment.deposit_sent'
  | 'payment.balance_sent'
  | 'payment.received'
  // Document actions
  | 'document.uploaded'
  | 'document.deleted'
  // Menu form actions
  | 'menu_form.created'
  | 'menu_form.shared'
  | 'menu_form.submitted'
  | 'menu_form.locked'
  | 'menu_form.deleted'

export type ActorType = 'user' | 'system' | 'client' | 'webhook'

export type EntityType = 'booking' | 'quote' | 'payment' | 'document' | 'menu_form'

export interface LogActivityParams {
  bookingId: string
  actionType: ActivityActionType
  actionLabel: string
  actorType?: ActorType
  actorId?: string | null
  actorName?: string | null
  entityType?: EntityType | null
  entityId?: string | null
  metadata?: Record<string, unknown>
}

// Action labels in French
export const ACTION_LABELS: Record<ActivityActionType, string> = {
  // Booking
  'booking.created': 'Événement créé',
  'booking.updated': 'Événement modifié',
  'booking.deleted': 'Événement supprimé',
  'booking.duplicated': 'Événement dupliqué',
  'booking.status_changed': 'Statut modifié',
  'booking.assigned': 'Assignation modifiée',
  // Quote
  'quote.created': 'Devis créé',
  'quote.updated': 'Devis modifié',
  'quote.deleted': 'Devis supprimé',
  'quote.set_primary': 'Devis défini comme principal',
  'quote.email_sent': 'Devis envoyé par email',
  'quote.signature_sent': 'Lien de signature envoyé',
  'quote.signed': 'Devis signé',
  // Payment
  'payment.created': 'Paiement ajouté',
  'payment.updated': 'Paiement modifié',
  'payment.deleted': 'Paiement supprimé',
  'payment.deposit_sent': 'Lien acompte envoyé',
  'payment.balance_sent': 'Lien solde envoyé',
  'payment.received': 'Paiement reçu',
  // Document
  'document.uploaded': 'Document ajouté',
  'document.deleted': 'Document supprimé',
  // Menu form
  'menu_form.created': 'Formulaire de menu créé',
  'menu_form.shared': 'Formulaire partagé au client',
  'menu_form.submitted': 'Formulaire soumis par le client',
  'menu_form.locked': 'Formulaire verrouillé',
  'menu_form.deleted': 'Formulaire supprimé',
}

// Icons for each action type (Lucide icon names)
export const ACTION_ICONS: Record<ActivityActionType, string> = {
  'booking.created': 'Plus',
  'booking.updated': 'Edit',
  'booking.deleted': 'Trash2',
  'booking.duplicated': 'Copy',
  'booking.status_changed': 'RefreshCw',
  'booking.assigned': 'UserPlus',
  'quote.created': 'FileText',
  'quote.updated': 'FileEdit',
  'quote.deleted': 'FileX',
  'quote.set_primary': 'Star',
  'quote.email_sent': 'Mail',
  'quote.signature_sent': 'FileSignature',
  'quote.signed': 'CheckCircle',
  'payment.created': 'CreditCard',
  'payment.updated': 'CreditCard',
  'payment.deleted': 'CreditCard',
  'payment.deposit_sent': 'Send',
  'payment.balance_sent': 'Send',
  'payment.received': 'CircleDollarSign',
  'document.uploaded': 'Upload',
  'document.deleted': 'FileX',
  'menu_form.created': 'ClipboardList',
  'menu_form.shared': 'Share2',
  'menu_form.submitted': 'ClipboardCheck',
  'menu_form.locked': 'Lock',
  'menu_form.deleted': 'ClipboardX',
}

// ── Helpers ──

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('id, first_name, last_name, organization_id')
    .eq('id', user.id)
    .single()

  return data as { id: string; first_name: string; last_name: string; organization_id: string } | null
}

// ── Queries ──

export function useActivityLogs(bookingId: string | null) {
  return useQuery({
    queryKey: ['activity_logs', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('activity_logs') as any)
        .select('*')
        .eq('booking_id', bookingId!)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as ActivityLog[]
    },
  })
}

// ── Mutations ──

export function useLogActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: LogActivityParams) => {
      const user = await getCurrentUser()
      if (!user) throw new Error('User not authenticated')

      const { data, error } = await (supabase
        .from('activity_logs') as any)
        .insert({
          organization_id: user.organization_id,
          booking_id: params.bookingId,
          action_type: params.actionType,
          action_label: params.actionLabel,
          actor_type: params.actorType || 'user',
          actor_id: params.actorId ?? user.id,
          actor_name: params.actorName ?? `${user.first_name} ${user.last_name}`.trim(),
          entity_type: params.entityType || null,
          entity_id: params.entityId || null,
          metadata: params.metadata || {},
        })
        .select()
        .single()

      if (error) throw error
      return data as ActivityLog
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['activity_logs', params.bookingId] })
    },
  })
}

// ── Utility function for easy logging ──

export function createActivityLogger(logActivity: ReturnType<typeof useLogActivity>['mutate']) {
  return {
    // Booking actions
    bookingCreated: (bookingId: string, metadata?: Record<string, unknown>) => {
      logActivity({
        bookingId,
        actionType: 'booking.created',
        actionLabel: ACTION_LABELS['booking.created'],
        entityType: 'booking',
        entityId: bookingId,
        metadata,
      })
    },

    bookingUpdated: (bookingId: string, changes: Record<string, { old: unknown; new: unknown }>) => {
      const changedFields = Object.keys(changes)
      logActivity({
        bookingId,
        actionType: 'booking.updated',
        actionLabel: `${ACTION_LABELS['booking.updated']} (${changedFields.length} champ${changedFields.length > 1 ? 's' : ''})`,
        entityType: 'booking',
        entityId: bookingId,
        metadata: { changes },
      })
    },

    bookingStatusChanged: (bookingId: string, oldStatus: string, newStatus: string) => {
      logActivity({
        bookingId,
        actionType: 'booking.status_changed',
        actionLabel: `Statut: "${oldStatus}" → "${newStatus}"`,
        entityType: 'booking',
        entityId: bookingId,
        metadata: { old_status: oldStatus, new_status: newStatus },
      })
    },

    bookingAssigned: (bookingId: string, userName: string | null) => {
      logActivity({
        bookingId,
        actionType: 'booking.assigned',
        actionLabel: userName ? `Assigné à ${userName}` : 'Assignation retirée',
        entityType: 'booking',
        entityId: bookingId,
        metadata: { assigned_to: userName },
      })
    },

    bookingDuplicated: (bookingId: string, sourceBookingId: string) => {
      logActivity({
        bookingId,
        actionType: 'booking.duplicated',
        actionLabel: ACTION_LABELS['booking.duplicated'],
        entityType: 'booking',
        entityId: bookingId,
        metadata: { source_booking_id: sourceBookingId },
      })
    },

    // Quote actions
    quoteCreated: (bookingId: string, quoteId: string, quoteTitle?: string) => {
      logActivity({
        bookingId,
        actionType: 'quote.created',
        actionLabel: quoteTitle ? `Devis "${quoteTitle}" créé` : ACTION_LABELS['quote.created'],
        entityType: 'quote',
        entityId: quoteId,
        metadata: { quote_title: quoteTitle },
      })
    },

    quoteDeleted: (bookingId: string, quoteId: string, quoteTitle?: string) => {
      logActivity({
        bookingId,
        actionType: 'quote.deleted',
        actionLabel: quoteTitle ? `Devis "${quoteTitle}" supprimé` : ACTION_LABELS['quote.deleted'],
        entityType: 'quote',
        entityId: quoteId,
        metadata: { quote_title: quoteTitle },
      })
    },

    quoteSetPrimary: (bookingId: string, quoteId: string, quoteTitle?: string) => {
      logActivity({
        bookingId,
        actionType: 'quote.set_primary',
        actionLabel: quoteTitle ? `Devis "${quoteTitle}" défini comme principal` : ACTION_LABELS['quote.set_primary'],
        entityType: 'quote',
        entityId: quoteId,
        metadata: { quote_title: quoteTitle },
      })
    },

    quoteEmailSent: (bookingId: string, quoteId: string, recipientEmail?: string) => {
      logActivity({
        bookingId,
        actionType: 'quote.email_sent',
        actionLabel: recipientEmail ? `Devis envoyé à ${recipientEmail}` : ACTION_LABELS['quote.email_sent'],
        entityType: 'quote',
        entityId: quoteId,
        metadata: { recipient_email: recipientEmail },
      })
    },

    quoteSignatureSent: (bookingId: string, quoteId: string) => {
      logActivity({
        bookingId,
        actionType: 'quote.signature_sent',
        actionLabel: ACTION_LABELS['quote.signature_sent'],
        entityType: 'quote',
        entityId: quoteId,
      })
    },

    quoteSigned: (bookingId: string, quoteId: string, actorType: ActorType = 'webhook') => {
      logActivity({
        bookingId,
        actionType: 'quote.signed',
        actionLabel: ACTION_LABELS['quote.signed'],
        actorType,
        actorName: actorType === 'client' ? 'Client' : 'SignNow',
        entityType: 'quote',
        entityId: quoteId,
      })
    },

    // Payment actions
    paymentCreated: (bookingId: string, paymentId: string, amount: number, type?: string) => {
      logActivity({
        bookingId,
        actionType: 'payment.created',
        actionLabel: `Paiement de ${amount.toLocaleString('fr-FR')} € ajouté${type ? ` (${type})` : ''}`,
        entityType: 'payment',
        entityId: paymentId,
        metadata: { amount, payment_type: type },
      })
    },

    paymentUpdated: (bookingId: string, paymentId: string, changes: Record<string, unknown>) => {
      logActivity({
        bookingId,
        actionType: 'payment.updated',
        actionLabel: ACTION_LABELS['payment.updated'],
        entityType: 'payment',
        entityId: paymentId,
        metadata: { changes },
      })
    },

    paymentDeleted: (bookingId: string, paymentId: string, amount?: number) => {
      logActivity({
        bookingId,
        actionType: 'payment.deleted',
        actionLabel: amount ? `Paiement de ${amount.toLocaleString('fr-FR')} € supprimé` : ACTION_LABELS['payment.deleted'],
        entityType: 'payment',
        entityId: paymentId,
        metadata: { amount },
      })
    },

    paymentDepositSent: (bookingId: string, quoteId: string, amount: number) => {
      logActivity({
        bookingId,
        actionType: 'payment.deposit_sent',
        actionLabel: `Lien acompte de ${amount.toLocaleString('fr-FR')} € envoyé`,
        entityType: 'quote',
        entityId: quoteId,
        metadata: { amount },
      })
    },

    paymentBalanceSent: (bookingId: string, quoteId: string, amount: number) => {
      logActivity({
        bookingId,
        actionType: 'payment.balance_sent',
        actionLabel: `Lien solde de ${amount.toLocaleString('fr-FR')} € envoyé`,
        entityType: 'quote',
        entityId: quoteId,
        metadata: { amount },
      })
    },

    paymentReceived: (bookingId: string, paymentId: string, amount: number, method: string, actorType: ActorType = 'webhook') => {
      logActivity({
        bookingId,
        actionType: 'payment.received',
        actionLabel: `Paiement de ${amount.toLocaleString('fr-FR')} € reçu via ${method}`,
        actorType,
        actorName: actorType === 'webhook' ? 'Stripe' : undefined,
        entityType: 'payment',
        entityId: paymentId,
        metadata: { amount, method },
      })
    },

    // Document actions
    documentUploaded: (bookingId: string, documentId: string, documentName: string) => {
      logActivity({
        bookingId,
        actionType: 'document.uploaded',
        actionLabel: `Document "${documentName}" ajouté`,
        entityType: 'document',
        entityId: documentId,
        metadata: { document_name: documentName },
      })
    },

    documentDeleted: (bookingId: string, documentId: string, documentName?: string) => {
      logActivity({
        bookingId,
        actionType: 'document.deleted',
        actionLabel: documentName ? `Document "${documentName}" supprimé` : ACTION_LABELS['document.deleted'],
        entityType: 'document',
        entityId: documentId,
        metadata: { document_name: documentName },
      })
    },

    // Menu form actions
    menuFormCreated: (bookingId: string, formId: string, formTitle?: string) => {
      logActivity({
        bookingId,
        actionType: 'menu_form.created',
        actionLabel: formTitle ? `Formulaire "${formTitle}" créé` : ACTION_LABELS['menu_form.created'],
        entityType: 'menu_form',
        entityId: formId,
        metadata: { form_title: formTitle },
      })
    },

    menuFormShared: (bookingId: string, formId: string) => {
      logActivity({
        bookingId,
        actionType: 'menu_form.shared',
        actionLabel: ACTION_LABELS['menu_form.shared'],
        entityType: 'menu_form',
        entityId: formId,
      })
    },

    menuFormSubmitted: (bookingId: string, formId: string, actorType: ActorType = 'client') => {
      logActivity({
        bookingId,
        actionType: 'menu_form.submitted',
        actionLabel: ACTION_LABELS['menu_form.submitted'],
        actorType,
        actorName: 'Client',
        entityType: 'menu_form',
        entityId: formId,
      })
    },

    menuFormLocked: (bookingId: string, formId: string) => {
      logActivity({
        bookingId,
        actionType: 'menu_form.locked',
        actionLabel: ACTION_LABELS['menu_form.locked'],
        entityType: 'menu_form',
        entityId: formId,
      })
    },

    menuFormDeleted: (bookingId: string, formId: string, formTitle?: string) => {
      logActivity({
        bookingId,
        actionType: 'menu_form.deleted',
        actionLabel: formTitle ? `Formulaire "${formTitle}" supprimé` : ACTION_LABELS['menu_form.deleted'],
        entityType: 'menu_form',
        entityId: formId,
        metadata: { form_title: formTitle },
      })
    },
  }
}
