import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.GMAIL_OAUTH_STATE_SECRET = 'test-secret'
})

describe('oauth state', () => {
  it('signs and verifies a user id', async () => {
    const { signState, verifyState } = await import('../../src/lib/oauth-state.js')
    const state = signState('user-123')
    expect(verifyState(state)).toBe('user-123')
  })

  it('rejects a tampered state', async () => {
    const { signState, verifyState } = await import('../../src/lib/oauth-state.js')
    const state = signState('user-123')
    const tampered = state.replace('user-123', 'user-999')
    expect(verifyState(tampered)).toBeNull()
  })

  it('rejects an expired state', async () => {
    const { signState, verifyState } = await import('../../src/lib/oauth-state.js')
    const state = signState('user-123', -1000) // deja expire
    expect(verifyState(state)).toBeNull()
  })
})
