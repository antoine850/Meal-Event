import { describe, it, expect } from 'vitest'
import {
  applySignature,
  esc,
  renderSignature,
  signatureBlock,
} from '../../src/lib/email-signature.js'

describe('signatureBlock (bloc de repli balise)', () => {
  it('reprend le markup du nom actuel, encadre des marqueurs', () => {
    expect(signatureBlock('Victor Lionnet')).toBe(
      '<!--mev:sig--><p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">Victor Lionnet</p><!--/mev:sig-->'
    )
  })

  it('echappe le nom de repli', () => {
    expect(signatureBlock('Bistrot & Co')).toContain('Bistrot &amp; Co')
  })
})

describe('applySignature (substitution a l envoi)', () => {
  const html = `<div>Bonjour</div>${signatureBlock('Victor Lionnet')}`

  it('signature absente ou vide : HTML inchange', () => {
    expect(applySignature(html, null)).toBe(html)
    expect(applySignature(html, '   ')).toBe(html)
  })

  it('pas de marqueurs : HTML inchange', () => {
    expect(applySignature('<div>Bonjour</div>', 'Camille')).toBe(
      '<div>Bonjour</div>'
    )
  })

  it('remplace le bloc entier, marqueurs compris', () => {
    const out = applySignature(html, 'Camille Michoudet')
    expect(out).toContain('Camille Michoudet')
    expect(out).not.toContain('Victor Lionnet')
    expect(out).not.toContain('mev:sig')
    expect(out.startsWith('<div>Bonjour</div>')).toBe(true)
  })

  it('une signature contenant $& n est pas interpretee', () => {
    expect(applySignature(html, 'Promo $& co')).toContain('Promo $&amp; co')
  })
})

describe('renderSignature (texte utilisateur -> HTML)', () => {
  it('echappe le HTML utilisateur', () => {
    expect(renderSignature('<script>alert(1)</script>')).toContain(
      '&lt;script&gt;'
    )
    expect(renderSignature('<script>alert(1)</script>')).not.toContain(
      '<script>'
    )
  })

  it('un retour a la ligne devient un <br/>', () => {
    expect(renderSignature('Victor Lionnet\nChef de projet')).toContain(
      'Victor Lionnet<br/>Chef de projet'
    )
  })

  it('rend le site cliquable', () => {
    expect(renderSignature('https://pasparisiens.com')).toContain(
      '<a href="https://pasparisiens.com"'
    )
    expect(renderSignature('www.pasparisiens.com')).toContain(
      '<a href="https://www.pasparisiens.com"'
    )
  })

  it('rend l email cliquable', () => {
    expect(renderSignature('victor.l@pasparisiens.com')).toContain(
      '<a href="mailto:victor.l@pasparisiens.com"'
    )
  })

  it('rend le telephone cliquable, sans separateurs dans le lien', () => {
    expect(renderSignature('06 12 34 56 78')).toContain(
      '<a href="tel:0612345678"'
    )
    expect(renderSignature('+33 6 12 34 56 78')).toContain(
      '<a href="tel:+33612345678"'
    )
  })

  it('pas de lien dans un lien', () => {
    const out = renderSignature('Ecrivez a victor.l@pasparisiens.com')
    expect(out.match(/<a /g)?.length).toBe(1)
  })

  it('un numero ne traverse pas deux lignes', () => {
    const out = renderSignature('06 12 34 56 78\n01 02 03 04 05')
    expect(out.match(/<a /g)?.length).toBe(2)
  })
})

describe('esc', () => {
  it('echappe &, < et >', () => {
    expect(esc('a & <b>')).toBe('a &amp; &lt;b&gt;')
  })
})
