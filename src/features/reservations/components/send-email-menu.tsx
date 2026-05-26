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

const langLabel = (lang: 'fr' | 'en') =>
  lang === 'fr' ? 'Français' : 'English'

type Provider = 'gmail' | 'outlook' | 'mailto'

// === Logos officiels ===
const GmailIcon = () => (
  <svg
    viewBox='0 0 256 193'
    className='h-7 w-7'
    xmlns='http://www.w3.org/2000/svg'
    preserveAspectRatio='xMidYMid'
  >
    <path
      d='M58.182 192.05V93.14L27.507 65.077 0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455h40.727Z'
      fill='#4285F4'
    />
    <path
      d='M197.818 192.05h40.727c9.659 0 17.455-7.826 17.455-17.455V49.505l-31.166 17.837-27.016 25.798v98.91Z'
      fill='#34A853'
    />
    <path
      d='m58.182 93.14-4.174-38.647 4.174-36.989L128 69.868l69.818-52.364 4.67 33.61-4.67 41.025-69.818 52.364z'
      fill='#EA4335'
    />
    <path
      d='M197.818 17.504V93.14L256 49.504V26.231c0-21.585-24.64-33.89-41.89-20.945l-16.292 12.218Z'
      fill='#FBBC04'
    />
    <path
      d='m0 49.504 26.759 20.07L58.182 93.14V17.504L41.89 5.286C24.61-7.66 0 4.646 0 26.23v23.273Z'
      fill='#C5221F'
    />
  </svg>
)

const OutlookIcon = () => (
  <svg
    viewBox='0 0 32 32'
    className='h-7 w-7'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      d='M19.484 7.937v5.477L21.4 14.619a.489.489 0 00.518 0L30.378 8.6a1.7 1.7 0 00-1.638-1.541H19.484zm0 7.741l1.749 1.2a.756.756 0 00.713 0c-.246.157 8.443-5.61 8.443-5.61V19.18a1.792 1.792 0 01-1.973 1.846H19.483v-5.348zm-9.722-3.939a2.969 2.969 0 00-2.265.987 4.066 4.066 0 00-.97 2.823 4.144 4.144 0 00.949 2.83 3.077 3.077 0 002.405.978 2.971 2.971 0 002.394-1.022 4.236 4.236 0 00.913-2.866 4.444 4.444 0 00-.879-2.927 2.971 2.971 0 00-2.547-.987zm-.111 5.694a1.265 1.265 0 01-1.063-.531 2.359 2.359 0 01-.391-1.444 2.464 2.464 0 01.4-1.503 1.319 1.319 0 011.116-.535 1.241 1.241 0 011.06.514 2.546 2.546 0 01.379 1.502 2.633 2.633 0 01-.365 1.516 1.182 1.182 0 01-1.142.481zM0 4.969v22.064l18.453 3.892V.971zm9.6 13.5a4.07 4.07 0 01-2.939-1.107 4.05 4.05 0 01-1.157-3 4.452 4.452 0 011.219-3.247 4.288 4.288 0 013.193-1.21 3.953 3.953 0 012.879 1.115 4.07 4.07 0 011.115 3.022 4.434 4.434 0 01-1.205 3.221 4.226 4.226 0 01-3.105 1.221z'
      fill='#0072C6'
    />
  </svg>
)

const MailIcon = () => (
  <svg
    viewBox='0 0 24 24'
    className='h-7 w-7'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    strokeLinejoin='round'
    xmlns='http://www.w3.org/2000/svg'
  >
    <rect x='2' y='4' width='20' height='16' rx='2' />
    <path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' />
  </svg>
)

// === Hook pour gérer le picker template+service ===
// La Dialog DOIT être rendue en dehors du DropdownMenu sinon elle unmount
// avec lui quand on clique un item.
export function useSendEmail() {
  const [picked, setPicked] = useState<EmailTemplate | null>(null)

  return {
    pick: (tpl: EmailTemplate) => setPicked(tpl),
    picked,
    close: () => setPicked(null),
  }
}

// === Items de menu (à rendre dans un DropdownMenuContent) ===
type MenuItemsProps = {
  booking: Pick<SendEmailBooking, 'contact'>
  onPick: (tpl: EmailTemplate) => void
}

export function SendEmailMenuItems({ booking, onPick }: MenuItemsProps) {
  const { data: templates = [], isLoading } = useEmailTemplates()
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

  return (
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
                    onSelect={() => onPick(tpl)}
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
  )
}

// === Dialog du choix de service (à rendre en dehors de tout DropdownMenu) ===
type DialogProps = {
  picked: EmailTemplate | null
  onClose: () => void
  booking: SendEmailBooking
}

export function SendEmailDialog({ picked, onClose, booking }: DialogProps) {
  const { data: profile } = useCurrentUserProfile()
  const { data: statuses = [] } = useBookingStatuses()
  const { mutate: updateBooking } = useUpdateBooking()

  const promoteIfNew = () => {
    if (booking.status_slug !== 'nouveau') return
    const qualification = statuses.find((s) => s.slug === 'qualification')
    if (!qualification) return
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

    if (provider === 'gmail') {
      window.open(
        buildGmailComposeUrl(email, subject, body),
        '_blank',
        'noopener,noreferrer'
      )
    } else if (provider === 'outlook') {
      window.open(
        buildOutlookComposeUrl(email, subject, body),
        '_blank',
        'noopener,noreferrer'
      )
    } else {
      window.location.href = buildMailtoUrl(email, subject, body)
    }

    onClose()
    promoteIfNew()
  }

  return (
    <Dialog
      open={!!picked}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
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
            <MailIcon />
            <span className='text-xs'>Mail par défaut</span>
          </Button>
        </div>

        <p className='pt-2 text-xs text-muted-foreground'>
          Gmail et Outlook s'ouvrent dans un nouvel onglet. « Mail par défaut »
          utilise l'application configurée sur ton système (Mail.app,
          Thunderbird…).
        </p>
      </DialogContent>
    </Dialog>
  )
}
