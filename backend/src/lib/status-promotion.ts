import { supabase } from './supabase.js'

export interface PromotionRule {
  sources: string[]
  target: string
  // Posé en cancellation_reason avec le statut cible ; libellé recopié du
  // front (cancellation-reasons.ts) pour la timeline.
  reason?: { slug: string; label: string }
}

export const PROMOTION_RULES: PromotionRule[] = [
  {
    sources: ['confirme_fonctionnaire', 'fonction_envoyee'],
    target: 'a_facturer',
  },
  // Jamais confirmé et date passée : le client n'a pas donné suite.
  {
    sources: ['nouveau', 'qualification', 'proposition', 'negociation'],
    target: 'cancelled',
    reason: { slug: 'sans_reponse', label: 'Sans réponse du client' },
  },
]

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
  reason?: { slug: string; label: string }
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

// Regroupe les statuts par org. Org sans cible ou sans source : ignoree.
export function groupPromotions(
  rows: StatusRow[],
  rule: PromotionRule
): OrgPromotion[] {
  const byOrg = new Map<string, StatusRow[]>()
  for (const r of rows) {
    const list = byOrg.get(r.organization_id) ?? []
    list.push(r)
    byOrg.set(r.organization_id, list)
  }
  const promotions: OrgPromotion[] = []
  for (const [orgId, list] of byOrg) {
    const target = list.find((r) => r.slug === rule.target)
    const sources = list
      .filter((r) => rule.sources.includes(r.slug))
      .map((r) => ({ id: r.id, name: r.name }))
    if (!target || sources.length === 0) continue
    promotions.push({
      orgId,
      target: { id: target.id, name: target.name },
      sources,
      reason: rule.reason,
    })
  }
  return promotions
}

// Bascule les bookings des statuts sources vers la cible de leur regle quand la
// date est passee. Update filtre atomique par (org, statut source) : les ids
// retournes alimentent les activity_logs avec l'ancien statut connu.
export async function runStatusPromotion(): Promise<number> {
  const today = parisToday(new Date())
  const { data: rows, error } = await supabase
    .from('statuses')
    .select('id, organization_id, slug, name')
    .eq('type', 'booking')
    .in(
      'slug',
      PROMOTION_RULES.flatMap((r) => [...r.sources, r.target])
    )
  if (error) throw new Error(`statuses: ${error.message}`)

  let promoted = 0
  const promos = PROMOTION_RULES.flatMap((rule) =>
    groupPromotions((rows ?? []) as StatusRow[], rule)
  )
  for (const promo of promos) {
    try {
      for (const source of promo.sources) {
        const { data: moved, error: updErr } = await supabase
          .from('bookings')
          .update({
            status_id: promo.target.id,
            ...(promo.reason ? { cancellation_reason: promo.reason.slug } : {}),
          })
          .eq('organization_id', promo.orgId)
          .eq('status_id', source.id)
          .lt('event_date', today)
          .select('id')
        if (updErr) throw new Error(`bookings: ${updErr.message}`)
        if (!moved || moved.length === 0) continue
        promoted += moved.length

        // Meme forme qu'une annulation manuelle (use-activity-logs.ts).
        const transition = `Statut: "${source.name}" → "${promo.target.name}"`
        console.log(
          `[status-promotion] ${moved.length} booking(s) ${transition}`
        )
        const { error: logErr } = await supabase.from('activity_logs').insert(
          moved.map((b) => ({
            organization_id: promo.orgId,
            booking_id: b.id,
            action_type: 'booking.status_changed',
            action_label: promo.reason
              ? `${transition} (${promo.reason.label})`
              : transition,
            actor_type: 'system',
            actor_name: 'Automatique',
            entity_type: 'booking',
            entity_id: b.id,
            metadata: {
              old_status: source.name,
              new_status: promo.target.name,
              ...(promo.reason
                ? { cancellation_reason: promo.reason.slug }
                : {}),
            },
          }))
        )
        if (logErr) {
          console.error(
            `[status-promotion] logs org ${promo.orgId}:`,
            logErr.message
          )
        }
      }
    } catch (err) {
      console.error(
        `[status-promotion] org ${promo.orgId}:`,
        err instanceof Error ? err.message : err
      )
    }
  }
  return promoted
}

let promotionInFlight = false

// Run au boot (rattrapage du stock) puis tick horaire. Idempotent : un tick
// double ou rate est sans effet, garde in-flight comme gmail-poll.
export function startStatusPromotion(): void {
  const tick = async () => {
    if (promotionInFlight) return
    promotionInFlight = true
    try {
      await runStatusPromotion()
    } catch (err) {
      console.error(
        '[status-promotion] tick en echec:',
        err instanceof Error ? err.message : err
      )
    } finally {
      promotionInFlight = false
    }
  }
  void tick()
  setInterval(tick, 3_600_000)
}
