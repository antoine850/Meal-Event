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
  renderTemplate,
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
    name: string
    min_revenue_privatization_eur?: number | null
  } | null
}

type Props = {
  booking: SendEmailBooking
}

const langLabel = (lang: 'fr' | 'en') =>
  lang === 'fr' ? 'Français' : 'English'

export function SendEmailMenuItems({ booking }: Props) {
  const { data: templates = [], isLoading } = useEmailTemplates()
  const { data: profile } = useCurrentUserProfile()
  const { data: statuses = [] } = useBookingStatuses()
  const { mutate: updateBooking } = useUpdateBooking()
  const { data: gmailStatus } = useGmailStatus()
  const [composer, setComposer] = useState<{
    subject: string
    body: string
  } | null>(null)

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

  const groupedBySlug = templates.reduce<Record<string, EmailTemplate[]>>(
    (acc, t) => {
      acc[t.slug] = acc[t.slug] || []
      acc[t.slug].push(t)
      return acc
    },
    {}
  )

  const slugOrder = Object.entries(groupedBySlug)
    .map(([slug, list]) => ({
      slug,
      sort_order: Math.min(...list.map((t) => t.sort_order)),
      label: (list.find((t) => t.lang === 'fr') || list[0])?.label || slug,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  const handlePick = (tpl: EmailTemplate) => {
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
    const vars = buildTemplateVars(input, tpl.lang)
    const { subject, body } = renderTemplate(tpl, vars)

    if (gmailStatus?.integration_enabled) {
      setComposer({ subject, body })
      return
    }
    // Comportement historique (avant pilote) : Gmail compose dans un onglet.
    const url = buildGmailComposeUrl(booking.contact.email, subject, body)
    window.open(url, '_blank', 'noopener,noreferrer')
    promoteIfNew()
  }

  return (
    <>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={!hasEmail}>
          <Mail className='mr-2 h-4 w-4' />
          Envoyer un email
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className='w-56'>
          {isLoading && (
            <DropdownMenuItem disabled>Chargement…</DropdownMenuItem>
          )}
          {!isLoading && slugOrder.length === 0 && (
            <DropdownMenuItem disabled>Aucun modèle</DropdownMenuItem>
          )}
          {slugOrder.map(({ slug, label }, idx) => {
            const list = groupedBySlug[slug]
            return (
              <div key={slug}>
                {idx > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className='text-xs text-muted-foreground'>
                  {label}
                </DropdownMenuLabel>
                {(['fr', 'en'] as const).map((lang) => {
                  const tpl = list.find((t) => t.lang === lang)
                  if (!tpl) return null
                  return (
                    <DropdownMenuItem
                      key={tpl.id}
                      onClick={() => handlePick(tpl)}
                    >
                      {langLabel(lang)}
                    </DropdownMenuItem>
                  )
                })}
              </div>
            )
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      {composer && (
        <SendEmailDialog
          open={!!composer}
          onOpenChange={(v) => !v && setComposer(null)}
          bookingId={booking.id}
          defaultSubject={composer.subject}
          defaultMessage={composer.body}
          onSent={promoteIfNew}
        />
      )}
    </>
  )
}
