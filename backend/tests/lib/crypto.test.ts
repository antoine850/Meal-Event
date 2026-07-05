import { describe, it, expect, beforeAll } from 'vitest'

// Clé de test : 32 octets en hex (64 caractères).
const TEST_KEY = '0'.repeat(64)

beforeAll(() => {
  process.env.GMAIL_TOKEN_ENC_KEY = TEST_KEY
})

describe('crypto token', () => {
  it('round-trips a value', async () => {
    const { encryptToken, decryptToken } = await import('../../src/lib/crypto.js')
    const secret = '1//refresh-token-abc.def_ghi'
    const enc = encryptToken(secret)
    expect(enc).not.toContain(secret)
    expect(decryptToken(enc)).toBe(secret)
  })

  it('produces a different ciphertext each time (random iv)', async () => {
    const { encryptToken } = await import('../../src/lib/crypto.js')
    expect(encryptToken('same')).not.toBe(encryptToken('same'))
  })

  it('rejects a tampered ciphertext', async () => {
    const { encryptToken, decryptToken } = await import('../../src/lib/crypto.js')
    const enc = encryptToken('value')
    const tampered = enc.slice(0, -2) + (enc.endsWith('AA') ? 'BB' : 'AA')
    expect(() => decryptToken(tampered)).toThrow()
  })
})
