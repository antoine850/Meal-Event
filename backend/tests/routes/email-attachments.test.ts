import { describe, it, expect } from 'vitest'
import { parseAttachments } from '../../src/routes/emails.js'

const b64 = (s: string) => Buffer.from(s).toString('base64')

describe('parseAttachments (PJ du composer)', () => {
  it('absent ou null -> aucune PJ', () => {
    expect(parseAttachments(undefined)).toEqual({ ok: true, attachments: [] })
    expect(parseAttachments(null)).toEqual({ ok: true, attachments: [] })
  })

  it('decode le contenu et garde le contentType', () => {
    const r = parseAttachments([
      { filename: 'menu.pdf', contentBase64: b64('pdf-bytes'), contentType: 'application/pdf' },
    ])
    if (!r.ok) throw new Error(r.error)
    expect(r.attachments).toHaveLength(1)
    expect(r.attachments[0].filename).toBe('menu.pdf')
    expect(r.attachments[0].content.toString()).toBe('pdf-bytes')
    expect(r.attachments[0].contentType).toBe('application/pdf')
  })

  it('neutralise un chemin dans le nom de fichier', () => {
    const r = parseAttachments([
      { filename: '../../etc/passwd', contentBase64: b64('x') },
    ])
    if (!r.ok) throw new Error(r.error)
    expect(r.attachments[0].filename).toBe('passwd')
  })

  it('rejette: pas un tableau, sans nom, sans contenu', () => {
    expect(parseAttachments('nope').ok).toBe(false)
    expect(parseAttachments([{ contentBase64: b64('x') }]).ok).toBe(false)
    expect(parseAttachments([{ filename: 'a.pdf' }]).ok).toBe(false)
    expect(parseAttachments([{ filename: 'a.pdf', contentBase64: '' }]).ok).toBe(false)
  })

  it('rejette au-dela de 5 fichiers', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      filename: `f${i}.pdf`,
      contentBase64: b64('x'),
    }))
    expect(parseAttachments(many).ok).toBe(false)
  })

  it('rejette un fichier > 10 Mo et un total > 15 Mo', () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64')
    expect(parseAttachments([{ filename: 'big.pdf', contentBase64: big }]).ok).toBe(false)

    const eight = Buffer.alloc(8 * 1024 * 1024).toString('base64')
    const r = parseAttachments([
      { filename: 'a.pdf', contentBase64: eight },
      { filename: 'b.pdf', contentBase64: eight },
    ])
    expect(r.ok).toBe(false)
  })
})
