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
})
