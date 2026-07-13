import { useState } from 'react'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { SendEmailDialog } from '@/features/emails/components/send-email-dialog'
import { useGmailStatus } from '@/features/settings/hooks/use-gmail-account'
import { useBookingStatuses, useUpdateBooking } from '../hooks/use-bookings'
import {
  useCurrentUserProfile,
  useEmailTemplates,
} from '../hooks/use-email-templates'
import {
  buildGmailComposeUrl,
  buildTemplateVars,
  hasEnVersion,
  renderTemplate,
  templateContent,
  type EmailTemplate,
  type TemplateInput,
} from '../lib/email-templates'

export type SendEmailBooking = {
  id: string
  event_date: string
  guests_count: number | null
  status_slug: string | null
  contact: {
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
  restaurant: {
    id: string
    name: string
    min_revenue_privatization_eur?: number | null
  } | null
}

export type ComposePayload = {
  subject: string
  body: string
  onSent: () => void
}

type Props = {
  booking: SendEmailBooking
  // Ouvre le composer integre (fourni par useEmailComposer). Le dialog doit
  // vivre HORS du dropdown, sinon sa fermeture le demonte avant affichage.
  onCompose?: (payload: ComposePayload) => void
}

const langLabel = (lang: 'fr' | 'en') =>
  lang === 'fr' ? 'Français' : 'English'

// Etat + dialog du composer, a monter au niveau de l'appelant (hors dropdown).
export function useEmailComposer(bookingId: string) {
  const [composer, setComposer] = useState<ComposePayload | null>(null)
  return {
    onCompose: setComposer,
    dialog: composer ? (
      <SendEmailDialog
        open
        onOpenChange={(v) => !v && setComposer(null)}
        bookingId={bookingId}
        defaultSubject={composer.subject}
        defaultMessage={composer.body}
        onSent={composer.onSent}
      />
    ) : null,
  }
}

export function SendEmailMenuItems({ booking, onCompose }: Props) {
  const { data: templates = [], isLoading } = useEmailTemplates()
  const { data: profile } = useCurrentUserProfile()
  const { data: statuses = [] } = useBookingStatuses()
  const { mutate: updateBooking } = useUpdateBooking()
  const { data: gmailStatus } = useGmailStatus()

  const hasEmail = !!booking.contact?.email

  const promoteIfNew = () => {
    // Auto-promotion : si le lead est en "Nouveau", on le passe en "Qualification"
    if (booking.status_slug === 'nouveau') {
      const qualification = statuses.find((s) => s.slug === 'qualification')
      if (qualification) {
        updateBooking(
          { id: booking.id, status_id: qualification.id },
          {
            onSuccess: () => toast.success('Statut passé en Qualification'),
            onError: (e) =>
              toast.error(
                `Email envoyé mais maj statut KO : ${(e as Error).message}`
              ),
          }
        )
      }
    }
  }

  const visibleTemplates = templates.filter(
    (t) =>
      t.is_active &&
      (t.restaurant_ids.length === 0 ||
        (booking.restaurant !== null &&
          t.restaurant_ids.includes(booking.restaurant.id)))
  )

  const handlePick = (tpl: EmailTemplate, lang: 'fr' | 'en') => {
    if (!booking.contact?.email) {
      toast.error("Le contact n'a pas d'adresse email")
      return
    }
    const input: TemplateInput = {
      contact: booking.contact,
      restaurant: booking.restaurant,
      organization: profile?.organization || null,
      event_date: booking.event_date,
      guests_count: booking.guests_count,
      user: profile
        ? {
            first_name: profile.first_name,
            last_name: profile.last_name,
            email: profile.email,
          }
        : null,
    }
    const vars = buildTemplateVars(input, lang)
    const { subject, body } = renderTemplate(templateContent(tpl, lang), vars)

    if (gmailStatus?.integration_enabled && onCompose) {
      onCompose({ subject, body, onSent: promoteIfNew })
      return
    }
    // Comportement historique (avant pilote, ou composer non cable) : Gmail
    // compose dans un onglet.
    const url = buildGmailComposeUrl(booking.contact.email, subject, body)
    window.open(url, '_blank', 'noopener,noreferrer')
    promoteIfNew()
  }

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger disabled={!hasEmail}>
        <Mail className='mr-2 h-4 w-4' />
        Envoyer un email
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className='w-56'>
        {isLoading && <DropdownMenuItem disabled>Chargement…</DropdownMenuItem>}
        {!isLoading && visibleTemplates.length === 0 && (
          <DropdownMenuItem disabled>Aucun modèle</DropdownMenuItem>
        )}
        {visibleTemplates.map((tpl, idx) => (
          <div key={tpl.id}>
            {idx > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              {tpl.name}
            </DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handlePick(tpl, 'fr')}>
              {langLabel('fr')}
            </DropdownMenuItem>
            {hasEnVersion(tpl) && (
              <DropdownMenuItem onClick={() => handlePick(tpl, 'en')}>
                {langLabel('en')}
              </DropdownMenuItem>
            )}
          </div>
        ))}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
