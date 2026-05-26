import { format } from 'date-fns'
import { enUS } from 'date-fns/locale'

export type EmailTemplate = {
  id: string
  organization_id: string
  slug: string
  lang: 'fr' | 'en'
  label: string
  subject: string
  body: string
  sort_order: number
  is_active: boolean
}

export type TemplateVars = {
  prenom_client: string
  nom_client: string
  email_client: string
  restaurant: string
  date_evenement: string
  nb_invites: string
  min_ca: string
  groupe: string
  site_groupe: string
  signature: string
}

export type TemplateInput = {
  contact: {
    first_name: string | null
    last_name: string | null
    email: string | null
  } | null
  restaurant: {
    name: string
    min_revenue_privatization_eur?: number | null
  } | null
  organization: {
    name: string
    website: string | null
  } | null
  event_date: string
  guests_count: number | null
  user: {
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

const monthsFr = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

function formatDateFr(date: Date): string {
  const day = date.getDate()
  return `${day} ${monthsFr[date.getMonth()]} ${date.getFullYear()}`
}

function formatDateEn(date: Date): string {
  return format(date, 'MMMM do, yyyy', { locale: enUS })
}

export function buildTemplateVars(
  input: TemplateInput,
  lang: 'fr' | 'en'
): TemplateVars {
  const date = new Date(input.event_date)
  const dateStr = lang === 'fr' ? formatDateFr(date) : formatDateEn(date)

  const signature = input.user
    ? `${input.user.first_name || ''} ${input.user.last_name || ''}`.trim() ||
      input.user.email
    : ''

  const minCa = input.restaurant?.min_revenue_privatization_eur
    ? input.restaurant.min_revenue_privatization_eur.toLocaleString(
        lang === 'fr' ? 'fr-FR' : 'en-US'
      )
    : lang === 'fr'
      ? '—'
      : '—'

  return {
    prenom_client: input.contact?.first_name || '',
    nom_client: input.contact?.last_name || '',
    email_client: input.contact?.email || '',
    restaurant: input.restaurant?.name || '',
    date_evenement: dateStr,
    nb_invites: input.guests_count?.toString() || '',
    min_ca: minCa,
    groupe: input.organization?.name || '',
    site_groupe: input.organization?.website || '',
    signature,
  }
}

export function renderTemplate(
  template: { subject: string; body: string },
  vars: TemplateVars
): { subject: string; body: string } {
  const replace = (str: string) =>
    str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      return (vars as Record<string, string>)[key] ?? ''
    })

  return {
    subject: replace(template.subject),
    body: replace(template.body),
  }
}

export function buildMailtoUrl(
  email: string,
  subject: string,
  body: string
): string {
  const params = new URLSearchParams()
  params.set('subject', subject)
  params.set('body', body)
  // URLSearchParams encodes spaces as '+' but mailto: expects '%20'
  const qs = params.toString().replace(/\+/g, '%20')
  return `mailto:${encodeURIComponent(email)}?${qs}`
}
