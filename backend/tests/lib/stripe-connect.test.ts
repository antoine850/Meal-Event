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
  it('returns bank_transfer with disabled reason when stripe_enabled=false', () => {
    const result = resolveStripeMode({
      restaurantId: 'r1',
      organizationId: 'o1',
      stripeEnabled: false,
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
    })
    expect(result).toEqual({ mode: 'bank_transfer', reason: 'disabled' })
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

  // Connect-only architecture : si charges désactivées, on fallback en virement
  // (plus de mode 'error' ni 'legacy_platform').
  it('returns bank_transfer with charges_disabled reason when connected but charges off', () => {
    const result = resolveStripeMode({
      restaurantId: 'r1',
      organizationId: 'o1',
      stripeEnabled: true,
      stripeAccountId: 'acct_123',
      chargesEnabled: false,
      payoutsEnabled: false,
    })
    expect(result).toEqual({ mode: 'bank_transfer', reason: 'charges_disabled' })
  })

  it('returns bank_transfer with not_connected reason when enabled but no account', () => {
    const result = resolveStripeMode({
      restaurantId: 'r1',
      organizationId: 'o1',
      stripeEnabled: true,
      stripeAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
    })
    expect(result).toEqual({ mode: 'bank_transfer', reason: 'not_connected' })
  })
})
