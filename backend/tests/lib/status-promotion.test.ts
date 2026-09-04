import { describe, it, expect } from 'vitest'
import {
  parisToday,
  groupPromotions,
  PROMOTION_RULES,
  type StatusRow,
} from '../../src/lib/status-promotion.js'

const [A_FACTURER, SANS_REPONSE] = PROMOTION_RULES

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
    expect(groupPromotions(rows, A_FACTURER)).toEqual([
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
    expect(groupPromotions(rows, A_FACTURER)).toEqual([])
  })

  it('ignore une org sans statut source', () => {
    expect(
      groupPromotions([row('org1', 'a_facturer', 'À facturer')], A_FACTURER)
    ).toEqual([])
  })

  it('traite chaque org independamment', () => {
    const rows = [
      row('org1', 'fonction_envoyee', 'Fonction envoyée'),
      row('org1', 'a_facturer', 'À facturer'),
      row('org2', 'a_facturer', 'À facturer'),
    ]
    const result = groupPromotions(rows, A_FACTURER)
    expect(result).toHaveLength(1)
    expect(result[0].orgId).toBe('org1')
  })

  it('sans reponse : du pipeline commercial vers annulee, avec le motif', () => {
    const rows = [
      row('org1', 'nouveau', 'Nouveau'),
      row('org1', 'qualification', 'Qualification'),
      row('org1', 'proposition', 'Proposition'),
      row('org1', 'negociation', 'Négociation'),
      row('org1', 'cancelled', 'Annulée'),
      row('org1', 'a_facturer', 'À facturer'),
    ]
    expect(groupPromotions(rows, SANS_REPONSE)).toEqual([
      {
        orgId: 'org1',
        target: { id: 'org1-cancelled', name: 'Annulée' },
        sources: [
          { id: 'org1-nouveau', name: 'Nouveau' },
          { id: 'org1-qualification', name: 'Qualification' },
          { id: 'org1-proposition', name: 'Proposition' },
          { id: 'org1-negociation', name: 'Négociation' },
        ],
        reason: { slug: 'sans_reponse', label: 'Sans réponse du client' },
      },
    ])
  })

  it('les regles ne partagent aucune source : un booking ne peut suivre qu un chemin', () => {
    const all = PROMOTION_RULES.flatMap((r) => r.sources)
    expect(new Set(all).size).toBe(all.length)
  })
})
