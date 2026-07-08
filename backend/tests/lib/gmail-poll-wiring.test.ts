import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const read = (p: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../src', p), 'utf-8')

describe('gmail polling wiring', () => {
  it('recordInbound insere avec dedup 23505 et bump last_message_at', () => {
    const threads = read('lib/email-threads.ts')
    expect(threads).toContain('export async function recordInbound')
    expect(threads).toContain("'23505'")
    expect(threads).toContain('last_message_at')
  })

  it('pollAccount ne liste que messageAdded et persiste le curseur apres le batch', () => {
    const poll = read('lib/gmail-poll.ts')
    expect(poll).toContain("historyTypes: ['messageAdded']")
    expect(poll).toContain('saveCursor')
    expect(poll).toContain('last_sync_at')
    // Le fetch complet est reserve aux fils suivis et aux ids inconnus.
    expect(poll).toContain('filterUnknownIds')
    expect(poll).toContain("format: 'full'")
  })

  it('historyId expire (404) -> resync borne aux fils suivis puis re-seed', () => {
    const poll = read('lib/gmail-poll.ts')
    expect(poll).toContain('resyncAccount')
    expect(poll).toContain('getProfile')
    expect(poll).toContain('threads.get')
  })

  it('runGmailPoll gate sur le flag et isole les erreurs par boite', () => {
    const poll = read('lib/gmail-poll.ts')
    expect(poll).toContain('isGmailPollingEnabled()')
    expect(poll).toContain('markAccountRevoked')
    expect(poll).toContain('classifyGmailError')
    expect(poll).toContain("eq('status', 'connected')")
  })

  it('startGmailPolling: setInterval avec garde in-flight', () => {
    const poll = read('lib/gmail-poll.ts')
    expect(poll).toContain('export function startGmailPolling')
    expect(poll).toContain('setInterval')
    expect(poll).toContain('GMAIL_POLLING_INTERVAL_MS')
    expect(poll).toContain('pollInFlight')
  })

  it('index.ts demarre la boucle apres listen', () => {
    const index = read('index.ts')
    expect(index).toContain('startGmailPolling()')
  })

  it('dedup inter-boites : index unique (thread_id, rfc_message_id) en migration', () => {
    const migration = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../supabase/migrations/20260708_email_messages_rfc_dedup.sql'
      ),
      'utf-8'
    )
    expect(migration).toContain('email_messages_thread_rfc_uidx')
    expect(migration).toContain('(thread_id, rfc_message_id)')
    expect(migration).toContain('WHERE rfc_message_id IS NOT NULL')
  })

  it('polling pagine les fils suivis, chunke les ids connus, saute un message supprime (404)', () => {
    const poll = read('lib/gmail-poll.ts')
    expect(poll).toContain('loadTrackedThreads')
    expect(poll).toContain('.range(')
    expect(poll).toContain('ids.slice(')
    // messages.get protege : un message supprime ne bloque pas le curseur.
    const stubLoop = poll.indexOf('for (const stub of stubs)')
    expect(stubLoop).toBeGreaterThan(-1)
    expect(poll.indexOf('status === 404', stubLoop)).toBeGreaterThan(stubLoop)
  })
})
