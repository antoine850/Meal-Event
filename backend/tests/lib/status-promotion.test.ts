import { describe, it, expect } from 'vitest'
import {
  parisToday,
  groupPromotions,
  type StatusRow,
} from '../../src/lib/status-promotion.js'

describe('parisToday', () => {
  it('bascule au lendemain a minuit Paris, pas minuit UTC (ete, UTC+2)', () => {
    expect(parisToday(new Date('2026-07-15T21:30:00Z'))).toBe('2026-07-15')
    expect(parisToday(new Date('2026-07-15T22:30:00Z'))).toBe('2026-07-16')
  })

  it('gere l heure d hiver (UTC+1)', () => {
    expect(parisToday(new Date('2026-01-15T22:30:00Z'))).toBe('2026-01-15')
    expect(parisToday(new Date('2026-01-15T23:30:00Z'))).toBe('2026-01-16')
  })
})

const row = (
  org: string,
  slug: string,
  name: string,
  id?: string
): StatusRow => ({
  id: id ?? `${org}-${slug}`,
  organization_id: org,
  slug,
  name,
})

describe('groupPromotions', () => {
  it('groupe cible + sources par org', () => {
    const rows = [
      row('org1', 'confirme_fonctionnaire', 'Confirmé / Fonction a faire'),
      row('org1', 'fonction_envoyee', 'Fonction envoyée'),
      row('org1', 'a_facturer', 'À facturer'),
    ]
    expect(groupPromotions(rows)).toEqual([
      {
        orgId: 'org1',
        target: { id: 'org1-a_facturer', name: 'À facturer' },
        sources: [
          {
            id: 'org1-confirme_fonctionnaire',
            name: 'Confirmé / Fonction a faire',
          },
          { id: 'org1-fonction_envoyee', name: 'Fonction envoyée' },
        ],
      },
    ])
  })

  it('ignore une org sans statut cible a_facturer', () => {
    const rows = [
      row('org1', 'confirme_fonctionnaire', 'Confirmé'),
      row('org1', 'fonction_envoyee', 'Fonction envoyée'),
    ]
    expect(groupPromotions(rows)).toEqual([])
  })

  it('ignore une org sans statut source', () => {
    expect(groupPromotions([row('org1', 'a_facturer', 'À facturer')])).toEqual(
      []
    )
  })

  it('traite chaque org independamment', () => {
    const rows = [
      row('org1', 'fonction_envoyee', 'Fonction envoyée'),
      row('org1', 'a_facturer', 'À facturer'),
      row('org2', 'a_facturer', 'À facturer'),
    ]
    const result = groupPromotions(rows)
    expect(result).toHaveLength(1)
    expect(result[0].orgId).toBe('org1')
  })
})
