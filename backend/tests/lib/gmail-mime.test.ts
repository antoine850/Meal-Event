import { describe, it, expect } from 'vitest'
import {
  buildRawMessage,
  toReplySubject,
  generateRfcMessageId,
} from '../../src/lib/gmail-mime'

const decode = (raw: string) => Buffer.from(raw, 'base64url').toString('utf8')

describe('buildRawMessage', () => {
  it('encode un MIME base64url avec les en-tetes de threading', async () => {
    const raw = await buildRawMessage({
      from: 'commercial@pasparisien.fr',
      to: 'client@example.com',
      subject: 'Re: Votre devis DEV-1',
      html: '<p>Bonjour</p>',
      messageId: '<abc@pasparisien.fr>',
      inReplyTo: '<prev@pasparisien.fr>',
      references: '<prev@pasparisien.fr>',
    })
    const mime = decode(raw)
    expect(mime).toContain('From: commercial@pasparisien.fr')
    expect(mime).toContain('To: client@example.com')
    expect(mime).toContain('Subject: Re: Votre devis DEV-1')
    expect(mime).toContain('Message-ID: <abc@pasparisien.fr>')
    expect(mime).toContain('In-Reply-To: <prev@pasparisien.fr>')
    expect(mime).toContain('References: <prev@pasparisien.fr>')
    expect(mime).toContain('<p>Bonjour</p>')
  })

  it('joint un PDF en multipart', async () => {
    const raw = await buildRawMessage({
      from: 'c@pasparisien.fr',
      to: 'client@example.com',
      subject: 'Devis',
      html: '<p>x</p>',
      messageId: '<m@pasparisien.fr>',
      attachments: [{ filename: 'devis.pdf', content: Buffer.from('%PDF-1.4 fake') }],
    })
    const mime = decode(raw)
    expect(mime).toContain('multipart/mixed')
    // MailComposer n'entoure pas le filename de guillemets dans Content-Disposition.
    expect(mime).toContain('filename=devis.pdf')
    expect(mime).toContain('Content-Type: application/pdf')
  })
})

describe('toReplySubject', () => {
  it('prefixe Re: une seule fois', () => {
    expect(toReplySubject('Votre devis')).toBe('Re: Votre devis')
    expect(toReplySubject('Re: Votre devis')).toBe('Re: Votre devis')
    expect(toReplySubject('RE: x')).toBe('RE: x')
  })
})

describe('generateRfcMessageId', () => {
  it('produit un id RFC entre chevrons sur le domaine donne', () => {
    const id = generateRfcMessageId('pasparisien.fr')
    expect(id).toMatch(/^<[^@>]+@pasparisien\.fr>$/)
    expect(generateRfcMessageId('pasparisien.fr')).not.toBe(id)
  })
})
