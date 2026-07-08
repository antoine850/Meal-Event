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
})
