import { describe, it, expect } from 'vitest'
import { buildReminderEmailHtml } from '../../src/lib/email-templates.js'
import { applySignature } from '../../src/lib/email-signature.js'

// Verifie le mecanisme de bout en bout sur un vrai gabarit (pas un HTML de
// synthese) : une signature vide doit laisser l'email d'aujourd'hui intact.
describe('rendu reel d un gabarit avec et sans signature', () => {
  const commercialName = 'Victor Lionnet'
  const html = buildReminderEmailHtml({
    restaurant: { name: 'Le Central' },
    contact: { first_name: 'Julie', last_name: 'Martin' },
    message: 'Un petit rappel concernant votre reglement.',
    commercialName,
  })

  it('signature vide : marqueurs retires, nom de repli et formule conserves', () => {
    const out = applySignature(html, null)
    expect(out).not.toContain('mev:sig')
    expect(out).toContain(commercialName)
    expect(out).toContain('Cordialement,')
  })

  it('signature renseignee sur plusieurs lignes : nom de repli remplace, telephone en lien tel', () => {
    const signature = 'Camille Michoud\nResponsable evenementiel\n06 12 34 56 78'
    const out = applySignature(html, signature)
    expect(out).not.toContain(commercialName)
    expect(out).toContain('Camille Michoud')
    expect(out).toContain('<a href="tel:0612345678"')
    expect(out).toContain('Cordialement,')
    expect(out).not.toContain('mev:sig')
  })
})
