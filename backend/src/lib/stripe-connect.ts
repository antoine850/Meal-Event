import Stripe from 'stripe'
import { supabase } from './supabase.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '')

export interface RestaurantStripeContext {
  restaurantId: string
  organizationId: string
  stripeEnabled: boolean
  stripeAccountId: string | null
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

export async function getRestaurantStripeContext(
  restaurantId: string
): Promise<RestaurantStripeContext | null> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id, organization_id, stripe_enabled, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled')
    .eq('id', restaurantId)
    .single()

  if (error || !data) return null

  return {
    restaurantId: data.id,
    organizationId: data.organization_id,
    stripeEnabled: data.stripe_enabled ?? false,
    stripeAccountId: data.stripe_account_id ?? null,
    chargesEnabled: data.stripe_charges_enabled ?? false,
    payoutsEnabled: data.stripe_payouts_enabled ?? false,
  }
}

// Connect-only architecture : on prend les paiements Stripe UNIQUEMENT sur les
// comptes Connect des restaurants. Si un restaurant n'a pas (encore) connecté
// Stripe, on bascule en virement bancaire — jamais sur le compte plateforme.
export type StripeMode =
  | { mode: 'connect'; acctId: string }
  | { mode: 'bank_transfer'; reason: 'disabled' | 'not_connected' | 'charges_disabled' }

export function resolveStripeMode(ctx: RestaurantStripeContext): StripeMode {
  if (!ctx.stripeEnabled) {
    return { mode: 'bank_transfer', reason: 'disabled' }
  }
  if (ctx.stripeAccountId && ctx.chargesEnabled) {
    return { mode: 'connect', acctId: ctx.stripeAccountId }
  }
  if (ctx.stripeAccountId && !ctx.chargesEnabled) {
    return { mode: 'bank_transfer', reason: 'charges_disabled' }
  }
  return { mode: 'bank_transfer', reason: 'not_connected' }
}

export function stripeRequestOptions(acctId: string | null): Stripe.RequestOptions | undefined {
  return acctId ? { stripeAccount: acctId } : undefined
}

export async function getOrCreateStripeCustomerOnAccount(
  email: string,
  name: string | null,
  acctId: string
): Promise<string> {
  const opts: Stripe.RequestOptions = { stripeAccount: acctId }
  const existing = await stripe.customers.list({ email, limit: 1 }, opts)
  if (existing.data.length > 0) return existing.data[0].id
  const customer = await stripe.customers.create(
    { email, ...(name ? { name } : {}) },
    opts
  )
  return customer.id
}

export { stripe }
