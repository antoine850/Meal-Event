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
})
