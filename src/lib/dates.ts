import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// "Mar. 23/06/2026" -- colonnes de liste, cartes kanban, dashboard.
// parseISO : un new Date('2026-06-23') parse en UTC et peut decaler d'un jour.
export function formatEventDateShort(d: string): string {
  return cap(format(parseISO(d), 'EEE dd/MM/yyyy', { locale: fr }))
}
