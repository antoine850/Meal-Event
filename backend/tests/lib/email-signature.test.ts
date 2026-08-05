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

  it('signature absente ou vide : marqueurs retires, nom de repli conserve', () => {
    const expected =
      '<div>Bonjour</div><p style="margin:0;font-size:14px;font-weight:600;color:#1a1a1a;">Victor Lionnet</p>'
    expect(applySignature(html, null)).toBe(expected)
    expect(applySignature(html, '   ')).toBe(expected)
    expect(applySignature(html, null)).not.toContain('mev:sig')
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

  it('un guillemet dans l url ne casse pas hors de l attribut href', () => {
    const out = renderSignature('https://a.fr"onmouseover="alert(1)')
    expect(out).not.toContain('"onmouseover="')
    expect(out).toContain('&quot;onmouseover=&quot;')
  })

  it('un guillemet dans une query string reste un seul lien', () => {
    const out = renderSignature('https://example.com/search?q="test"&ref=sig')
    expect(out.match(/<a /g)?.length).toBe(1)
  })

  it('la ponctuation finale n est pas avalee par le lien', () => {
    expect(renderSignature('Visitez https://pasparisiens.com.')).toContain(
      '<a href="https://pasparisiens.com" style="color:#0d7377;">https://pasparisiens.com</a>.'
    )
    expect(renderSignature('Site (www.pasparisiens.com)')).toContain(
      '<a href="https://www.pasparisiens.com" style="color:#0d7377;">www.pasparisiens.com</a>)'
    )
    expect(renderSignature('Ecrire a victor.l@pasparisiens.com.')).toContain(
      '<a href="mailto:victor.l@pasparisiens.com" style="color:#0d7377;">victor.l@pasparisiens.com</a>.'
    )
  })

  it('un SIRET n est pas pris pour un telephone', () => {
    expect(renderSignature('SIRET 012 345 678 90123')).not.toContain('<a')
  })

  it('deux telephones separes par un tiret restent deux liens', () => {
    const out = renderSignature('Tel 01 23 45 67 89 - Fax 01 98 76 54 32')
    expect(out.match(/<a /g)?.length).toBe(2)
  })
})

describe('esc', () => {
  it('echappe &, < et >', () => {
    expect(esc('a & <b>')).toBe('a &amp; &lt;b&gt;')
  })

  it('echappe aussi les guillemets doubles', () => {
    expect(esc('a "b"')).toBe('a &quot;b&quot;')
  })
})
