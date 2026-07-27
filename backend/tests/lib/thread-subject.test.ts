import { describe, it, expect } from 'vitest'
import { buildThreadSubject } from '../../src/lib/email-templates.js'

describe('buildThreadSubject (sujet du fil booking)', () => {
  it('nom simple -> "au"', () => {
    expect(buildThreadSubject('Pasparisien')).toBe(
      'Votre événement au Pasparisien'
    )
  })

  it('contraction francaise Le/La/Les/L\'', () => {
    expect(buildThreadSubject('Le Procope')).toBe('Votre événement au Procope')
    expect(buildThreadSubject('La Coupole')).toBe(
      'Votre événement à la Coupole'
    )
    expect(buildThreadSubject('Les Halles')).toBe('Votre événement aux Halles')
    expect(buildThreadSubject("L'Atelier")).toBe("Votre événement à l'Atelier")
  })

  it('espaces parasites toleres', () => {
    expect(buildThreadSubject('  Le Bistrot  ')).toBe(
      'Votre événement au Bistrot'
    )
  })

  it('date de l\'evenement ajoutee au sujet', () => {
    expect(buildThreadSubject('Sapristi', '2026-09-12')).toBe(
      'Votre événement au Sapristi le 12 septembre 2026'
    )
    expect(buildThreadSubject('La Coupole', '2027-01-05')).toBe(
      'Votre événement à la Coupole le 05 janvier 2027'
    )
  })

  it('date absente ou invalide -> sujet sans date', () => {
    expect(buildThreadSubject('Sapristi', null)).toBe(
      'Votre événement au Sapristi'
    )
    expect(buildThreadSubject('Sapristi', undefined)).toBe(
      'Votre événement au Sapristi'
    )
  })
})
