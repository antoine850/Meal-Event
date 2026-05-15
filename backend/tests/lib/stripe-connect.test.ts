import { describe, it, expect } from 'vitest'
import { stripeRequestOptions, resolveStripeMode } from '../../src/lib/stripe-connect.js'

describe('stripeRequestOptions', () => {
  it('returns undefined when no account id', () => {
    expect(stripeRequestOptions(null)).toBeUndefined()
  })

  it('returns undefined when empty string', () => {
    expect(stripeRequestOptions('')).toBeUndefined()
  })

  it('returns options with stripeAccount when account id provided', () => {
    expect(stripeRequestOptions('acct_123')).toEqual({ stripeAccount: 'acct_123' })
  })

  // Régression du bug "Stripe: Unknown arguments ([object Object])".
  // Le SDK v14 refuse un options hash vide {}, donc on ne doit JAMAIS
  // retourner {} depuis cette fonction. Passer le résultat directement
  // au SDK (avec undefined) est la seule façon correcte.
  it('never returns an empty object (would crash Stripe SDK)', () => {
    expect(stripeRequestOptions(null)).not.toEqual({})
    expect(stripeRequestOptions('')).not.toEqual({})
  })
})

describe('resolveStripeMode', () => {
  it('returns bank_transfer when stripe disabled', () => {
    const result = resolveStripeMode({
      restaurantId: 'r1',
      organizationId: 'o1',
      stripeEnabled: false,
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
    })
    expect(result.mode).toBe('bank_transfer')
  })

  it('returns connect when account connected and charges enabled', () => {
    const result = resolveStripeMode({
      restaurantId: 'r1',
      organizationId: 'o1',
      stripeEnabled: true,
      stripeAccountId: 'acct_123',
      chargesEnabled: true,
      payoutsEnabled: true,
    })
    expect(result).toEqual({ mode: 'connect', acctId: 'acct_123' })
  })

  it('returns error CHARGES_DISABLED when connected but charges not enabled (no legacy mode)', () => {
    const result = resolveStripeMode({
      restaurantId: 'r1',
      organizationId: 'o1',
      stripeEnabled: true,
      stripeAccountId: 'acct_123',
      chargesEnabled: false,
      payoutsEnabled: false,
    })
    expect(result).toEqual({ mode: 'error', code: 'CHARGES_DISABLED' })
  })

  it('returns error NOT_CONNECTED when enabled but no account (no legacy mode)', () => {
    const result = resolveStripeMode({
      restaurantId: 'r1',
      organizationId: 'o1',
      stripeEnabled: true,
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
    })
    expect(result).toEqual({ mode: 'error', code: 'NOT_CONNECTED' })
  })
})
