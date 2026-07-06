import { describe, it, expect, afterEach } from 'vitest'
import { isGmailIntegrationEnabled } from '../../src/lib/gmail.js'

const KEY = 'GMAIL_INTEGRATION_ENABLED'
const original = process.env[KEY]

afterEach(() => {
  if (original === undefined) delete process.env[KEY]
  else process.env[KEY] = original
})

describe('isGmailIntegrationEnabled (master switch, defaut OFF)', () => {
  it('OFF quand la variable est absente', () => {
    delete process.env[KEY]
    expect(isGmailIntegrationEnabled()).toBe(false)
  })

  it('OFF pour toute valeur autre que "true" exactement', () => {
    for (const v of ['', 'false', 'False', 'TRUE', '1', 'yes', 'on']) {
      process.env[KEY] = v
      expect(isGmailIntegrationEnabled()).toBe(false)
    }
  })

  it('ON uniquement pour "true"', () => {
    process.env[KEY] = 'true'
    expect(isGmailIntegrationEnabled()).toBe(true)
  })
})
