import { describe, it, expect } from 'vitest'
import { classifyGmailError } from '../../src/lib/gmail-mime'

describe('classifyGmailError', () => {
  it('401 / invalid_grant -> revoked', () => {
    expect(classifyGmailError({ response: { status: 401 } })).toBe('revoked')
    expect(classifyGmailError({ message: 'invalid_grant' })).toBe('revoked')
  })
  it('429 -> rate_limited', () => {
    expect(classifyGmailError({ response: { status: 429 } })).toBe('rate_limited')
  })
  it('400 / 403 -> hard', () => {
    expect(classifyGmailError({ response: { status: 400 } })).toBe('hard')
    expect(classifyGmailError({ code: 403 })).toBe('hard')
  })
  it('timeout / 5xx / inconnu -> ambiguous', () => {
    expect(classifyGmailError({ code: 'ETIMEDOUT' })).toBe('ambiguous')
    expect(classifyGmailError({ response: { status: 503 } })).toBe('ambiguous')
    expect(classifyGmailError({})).toBe('ambiguous')
  })
})
