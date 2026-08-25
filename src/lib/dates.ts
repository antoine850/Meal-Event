import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// "Mar. 23/06/2026" -- colonnes de liste, cartes kanban, dashboard.
// parseISO : un new Date('2026-06-23') parse en UTC et peut decaler d'un jour.
export function formatEventDateShort(d: string): string {
  return cap(format(parseISO(d), 'EEE dd/MM/yyyy', { locale: fr }))
}

// Borne de filtre sur une colonne date (event_date), et parametres date des
// RPC dashboard. toISOString() ramene en UTC : minuit a Paris devient 22h la
// veille en heure d'ete, donc "Aujourd'hui" remontait aussi la veille.
// Pour une colonne timestamptz, envoyer l'instant complet, pas cette date.
// Exception assumee : la borne de signature, alignee sur la signature date du
// RPC dashboard, au prix d'un biais de 2h.
export function toIsoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}
