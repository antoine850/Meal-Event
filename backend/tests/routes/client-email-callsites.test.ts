import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Garde-fou du refactor phase 0bis (spec gmail du 26/06) : tous les emails
// CLIENT passent par sendClientEmail (envoi + journalisation email_logs).
// Un appel direct à sendEmail ou un insert email_logs dans une route recrée
// un envoi non tracé. Les emails internes (invitations members.ts,
// notifications commerciales) restent volontairement sur sendEmail.

const read = (p: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../src', p), 'utf-8')

const clientRoutes = [
  'routes/quotes.ts',
  'routes/webhooks.ts',
  'routes/payments.ts',
]

describe('client emails go through sendClientEmail', () => {
  clientRoutes.forEach((file) => {
    it(`${file} does not import sendEmail from resend directly`, () => {
      expect(read(file)).not.toContain("from '../lib/resend.js'")
    })

    it(`${file} does not write email_logs directly`, () => {
      expect(read(file)).not.toContain("from('email_logs').insert")
    })
  })

  it('client-email.ts is the only email_logs writer in src/lib', () => {
    const libDir = path.resolve(__dirname, '../../src/lib')
    const writers = fs
      .readdirSync(libDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) =>
        fs
          .readFileSync(path.join(libDir, f), 'utf-8')
          .includes("from('email_logs').insert")
      )
    expect(writers).toEqual(['client-email.ts'])
  })

  it('le transport Gmail vit uniquement dans client-email.ts', () => {
    const libDir = path.resolve(__dirname, '../../src/lib')
    const senders = fs
      .readdirSync(libDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => {
        const code = fs
          .readFileSync(path.join(libDir, f), 'utf-8')
          .split('\n')
          .filter((l) => !l.trim().startsWith('//'))
          .join('\n')
        return code.includes('users.messages.send')
      })
    expect(senders).toEqual(['client-email.ts'])
  })

  it("email_messages n'est ecrit que par email-threads.ts", () => {
    const libDir = path.resolve(__dirname, '../../src/lib')
    const writers = fs
      .readdirSync(libDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) => {
        const code = fs
          .readFileSync(path.join(libDir, f), 'utf-8')
          .split('\n')
          .filter((l) => !l.trim().startsWith('//'))
          .join('\n')
        return code.includes("from('email_messages').insert")
      })
    expect(writers).toEqual(['email-threads.ts'])
  })
})

// Decisions du 08/07 : sujet du fil booking = libelle evenement (les sujets
// sont figes par fil, un changement casserait les fils existants) ; compta en
// cc sur les emails compta cote Gmail (pas de Reply-To possible).
describe('fil : sujet evenement et cc compta', () => {
  const lib = read('lib/client-email.ts')

  it('le fil booking porte le sujet evenement, le sujet envoye suit le fil', () => {
    expect(lib).toContain('getBookingThreadSubject')
    expect(read('lib/email-templates.ts')).toContain(
      'export function buildThreadSubject'
    )
    // Resend envoie aussi le sujet du fil (coherence Re: entre transports).
    expect(lib).not.toContain('subject: params.subject')
  })

  it('le sujet du fil ne s applique aux envois que si le master gmail est ON', () => {
    // Master OFF = sujets historiques : le deploiement reste no-op cote client.
    expect(lib).toContain('isGmailIntegrationEnabled() && thread')
  })

  it('ccFacturation met la compta en cc sur le chemin gmail', () => {
    expect(lib).toContain('ccFacturation')
    expect(lib).toContain('params.facturationEmail]')
  })

  it('les 7 emails compta activent ccFacturation, pas le devis', () => {
    const all = [
      'routes/quotes.ts',
      'routes/payments.ts',
      'lib/deposit-flow.ts',
    ]
      .map(read)
      .join('')
    expect(all.split('ccFacturation: true').length - 1).toBe(7)
  })
})
