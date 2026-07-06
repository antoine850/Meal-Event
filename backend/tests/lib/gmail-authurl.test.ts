import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = 'test-client-id'
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret'
  process.env.GMAIL_REDIRECT_URI = 'https://api.example.com/api/gmail/callback'
  process.env.GMAIL_OAUTH_STATE_SECRET = 'test-state-secret'
})

describe('gmail auth url', () => {
  it('embeds gmail scopes, offline access and a signed state', async () => {
    const { getGmailAuthUrl, GMAIL_SCOPES } = await import('../../src/lib/gmail.js')
    const url = getGmailAuthUrl('user-abc')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('access_type')).toBe('offline')
    expect(parsed.searchParams.get('prompt')).toBe('consent')
    const scope = parsed.searchParams.get('scope') || ''
    expect(scope).toContain('gmail.send')
    expect(scope).toContain('gmail.readonly')
    // Le state commence par le userId puis un point (format signe).
    expect(parsed.searchParams.get('state')).toMatch(/^user-abc\./)
    expect(GMAIL_SCOPES.length).toBeGreaterThanOrEqual(3)
  })
})
