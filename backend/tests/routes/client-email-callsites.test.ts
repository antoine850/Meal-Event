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
