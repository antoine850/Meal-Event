import { useState } from 'react'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
  buildGmailComposeUrl,
  buildMailtoUrl,
  buildOutlookComposeUrl,
  buildTemplateVars,
  renderTemplate,
  type EmailTemplate,
  type TemplateInput,
} from '../lib/email-templates'
import {
  useCurrentUserProfile,
  useEmailTemplates,
} from '../hooks/use-email-templates'
import {
  useBookingStatuses,
  useUpdateBooking,
} from '../hooks/use-bookings'

type Props = {
  booking: {
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
}

const langLabel = (lang: 'fr' | 'en') =>
  lang === 'fr' ? 'Français' : 'English'

type Provider = 'gmail' | 'outlook' | 'mailto'

// Logos SVG inline (couleurs officielles)
const GmailIcon = () => (
  <svg viewBox='0 0 24 24' className='h-6 w-6' xmlns='http://www.w3.org/2000/svg'>
    <path d='M22 6.5l-10 6.25L2 6.5V18a2 2 0 002 2h16a2 2 0 002-2V6.5z' fill='#EA4335' />
    <path d='M22 6.5V6a2 2 0 00-2-2H4a2 2 0 00-2 2v.5l10 6.25 10-6.25z' fill='#FBBC04' />
    <path d='M22 6.5l-10 6.25v7.25h8a2 2 0 002-2V6.5z' fill='#34A853' />
    <path d='M2 6.5v11.25c0 1.1.9 2 2 2h8V12.75L2 6.5z' fill='#4285F4' />
  </svg>
)

const OutlookIcon = () => (
  <svg viewBox='0 0 24 24' className='h-6 w-6' xmlns='http://www.w3.org/2000/svg'>
    <rect x='2' y='5' width='20' height='14' rx='2' fill='#0078D4' />
    <text
      x='12'
      y='16'
      fontFamily='Arial, sans-serif'
      fontWeight='700'
      fontSize='12'
      fill='white'
      textAnchor='middle'
    >
      O
    </text>
  </svg>
)

export function SendEmailMenuItems({ booking }: Props) {
  const { data: templates = [], isLoading } = useEmailTemplates()
  const { data: profile } = useCurrentUserProfile()
  const { data: statuses = [] } = useBookingStatuses()
  const { mutate: updateBooking } = useUpdateBooking()

  const [picked, setPicked] = useState<EmailTemplate | null>(null)

  const hasEmail = !!booking.contact?.email

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

  const promoteIfNew = () => {
    if (booking.status_slug !== 'nouveau') return
    const qualification = statuses.find((s) => s.slug === 'qualification')
    if (!qualification) return
    updateBooking(
      { id: booking.id, status_id: qualification.id },
      {
        onSuccess: () => toast.success('Statut passé en Qualification'),
        onError: (e) =>
          toast.error(`Email envoyé mais maj statut KO : ${(e as Error).message}`),
      }
    )
  }

  const sendVia = (provider: Provider) => {
    if (!picked || !booking.contact?.email) return
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
    const vars = buildTemplateVars(input, picked.lang)
    const { subject, body } = renderTemplate(picked, vars)
    const email = booking.contact.email

    let url: string
    if (provider === 'gmail') {
      url = buildGmailComposeUrl(email, subject, body)
    } else if (provider === 'outlook') {
      url = buildOutlookComposeUrl(email, subject, body)
    } else {
      url = buildMailtoUrl(email, subject, body)
    }

    if (provider === 'mailto') {
      // protocol handler : trigger en synchrone dans le handler de clic
      window.location.href = url
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }

    setPicked(null)
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
                      onClick={() => setPicked(tpl)}
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

      <Dialog open={!!picked} onOpenChange={(open) => !open && setPicked(null)}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Avec quel service mail ?</DialogTitle>
            <DialogDescription>
              {picked?.label} • destinataire :{' '}
              <span className='font-mono'>{booking.contact?.email}</span>
            </DialogDescription>
          </DialogHeader>

          <div className='grid grid-cols-3 gap-3 pt-2'>
            <Button
              variant='outline'
              className='flex h-24 flex-col gap-2'
              onClick={() => sendVia('gmail')}
            >
              <GmailIcon />
              <span className='text-xs'>Gmail</span>
            </Button>
            <Button
              variant='outline'
              className='flex h-24 flex-col gap-2'
              onClick={() => sendVia('outlook')}
            >
              <OutlookIcon />
              <span className='text-xs'>Outlook</span>
            </Button>
            <Button
              variant='outline'
              className='flex h-24 flex-col gap-2'
              onClick={() => sendVia('mailto')}
            >
              <Mail className='h-6 w-6' />
              <span className='text-xs'>Mail par défaut</span>
            </Button>
          </div>

          <p className='pt-2 text-xs text-muted-foreground'>
            Gmail et Outlook s'ouvrent dans un nouvel onglet. « Mail par
            défaut » utilise l'application configurée sur ton système
            (Mail.app, Thunderbird…).
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}
