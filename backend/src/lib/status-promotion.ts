const SOURCE_SLUGS = ['confirme_fonctionnaire', 'fonction_envoyee']
const TARGET_SLUG = 'a_facturer'

export interface StatusRow {
  id: string
  organization_id: string
  slug: string
  name: string
}

export interface OrgPromotion {
  orgId: string
  target: { id: string; name: string }
  sources: { id: string; name: string }[]
}

// Date du jour a Paris (serveur en UTC) : un evenement bascule le lendemain de
// sa date, event_date < aujourd'hui.
export function parisToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

// Regroupe les statuts par org. Org sans cible a_facturer ou sans source : ignoree.
export function groupPromotions(rows: StatusRow[]): OrgPromotion[] {
  const byOrg = new Map<string, StatusRow[]>()
  for (const r of rows) {
    const list = byOrg.get(r.organization_id) ?? []
    list.push(r)
    byOrg.set(r.organization_id, list)
  }
  const promotions: OrgPromotion[] = []
  for (const [orgId, list] of byOrg) {
    const target = list.find((r) => r.slug === TARGET_SLUG)
    const sources = list
      .filter((r) => SOURCE_SLUGS.includes(r.slug))
      .map((r) => ({ id: r.id, name: r.name }))
    if (!target || sources.length === 0) continue
    promotions.push({
      orgId,
      target: { id: target.id, name: target.name },
      sources,
    })
  }
  return promotions
}
