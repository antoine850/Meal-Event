/**
 * Helpers pour construire les liens de drill-down depuis les cartes du
 * dashboard vers la page Événements (vue Liste pré-filtrée).
 *
 * Les filtres du dashboard (date d'événement, restaurants, commerciaux,
 * etc.) sont automatiquement propagés à la page Événements pour garder
 * les compteurs cohérents.
 */
import { SIGNED_SLUGS, CONFIRMED_SLUGS } from '../hooks/use-dashboard-data'

/** Statuts "en attente" = avant signature, hors annulés. */
export const PENDING_SLUGS = [
  'nouveau',
  'qualification',
  'proposition',
  'negociation',
]

/** Filtres bruts du dashboard (tirés de useSearch). */
export type DashboardSearch = {
  fromEvent?: string
  toEvent?: string
  fromSign?: string
  toSign?: string
  fromImport?: string
  toImport?: string
  restaurants?: string // CSV d'IDs
  commercials?: string // CSV d'IDs
}

/** Surcharge spécifique à la carte cliquée. */
export type DrillDownFilters = {
  /** Force les statuts à afficher (CSV de slugs). */
  status?: string
  /** N'afficher que les événements signés (statut post-signature). */
  signed?: '1'
  /** N'afficher que les propositions sans réponse depuis > 3 jours. */
  stale?: '1'
  /** Filtre sur un commercial unique (override le filtre dashboard). */
  commercial?: string
  /** Filtre sur un restaurant unique (override le filtre dashboard). */
  restaurant?: string
  /** Source de contact (Instagram, Site web, etc.). */
  source?: string
}

/**
 * Construit l'objet `search` à passer à `<Link to='/evenements' search={...}>`.
 * On force toujours `view=list` (la vue par défaut pour drill-down).
 * Les filtres du dashboard sont propagés sauf si la carte les override.
 */
export function buildEventsSearch(
  dash: DashboardSearch,
  drill: DrillDownFilters = {}
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const search: any = {
    view: 'list',
    from: dash.fromEvent || undefined,
    to: dash.toEvent || undefined,
    fromSign: dash.fromSign || undefined,
    toSign: dash.toSign || undefined,
    fromImport: dash.fromImport || undefined,
    toImport: dash.toImport || undefined,
  }

  // Restaurant : override par la carte sinon prend celui du dashboard
  if (drill.restaurant) search.restaurant = drill.restaurant
  else if (dash.restaurants) search.restaurant = dash.restaurants

  // Commercial : override par la carte sinon prend celui du dashboard
  if (drill.commercial) search.commercial = drill.commercial
  else if (dash.commercials) search.commercial = dash.commercials

  if (drill.status) search.status = drill.status
  if (drill.signed) search.signed = drill.signed
  if (drill.stale) search.stale = drill.stale
  if (drill.source) search.source = drill.source

  // Retire les undefined pour ne pas polluer l'URL
  Object.keys(search).forEach((k) => {
    if (search[k] === undefined) delete search[k]
  })

  return search
}

/** Helper raccourci : drill-down sur les statuts signés. */
export function signedSearch(dash: DashboardSearch) {
  return buildEventsSearch(dash, { status: SIGNED_SLUGS.join(',') })
}

/** Helper raccourci : drill-down sur les statuts confirmés. */
export function confirmedSearch(dash: DashboardSearch) {
  return buildEventsSearch(dash, { status: CONFIRMED_SLUGS.join(',') })
}

/** Helper raccourci : drill-down sur les statuts en attente. */
export function pendingSearch(dash: DashboardSearch) {
  return buildEventsSearch(dash, { status: PENDING_SLUGS.join(',') })
}
