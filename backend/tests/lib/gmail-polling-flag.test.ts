import { describe, it, expect, afterEach } from 'vitest'
import { isGmailPollingEnabled } from '../../src/lib/gmail.js'

const MASTER = 'GMAIL_INTEGRATION_ENABLED'
const POLL = 'GMAIL_POLLING_ENABLED'
const saved = { master: process.env[MASTER], poll: process.env[POLL] }

afterEach(() => {
  if (saved.master === undefined) delete process.env[MASTER]
  else process.env[MASTER] = saved.master
  if (saved.poll === undefined) delete process.env[POLL]
  else process.env[POLL] = saved.poll
})

describe('isGmailPollingEnabled (sous-switch, defaut OFF)', () => {
  it('OFF si le master est OFF, meme si le polling est true', () => {
    delete process.env[MASTER]
    process.env[POLL] = 'true'
    expect(isGmailPollingEnabled()).toBe(false)
  })

  it('OFF si master ON mais polling absent ou different de "true"', () => {
    process.env[MASTER] = 'true'
    for (const v of [undefined, '', 'false', 'TRUE', '1']) {
      if (v === undefined) delete process.env[POLL]
      else process.env[POLL] = v
      expect(isGmailPollingEnabled()).toBe(false)
    }
  })

  it('ON uniquement si master et polling valent "true"', () => {
    process.env[MASTER] = 'true'
    process.env[POLL] = 'true'
    expect(isGmailPollingEnabled()).toBe(true)
  })
})
