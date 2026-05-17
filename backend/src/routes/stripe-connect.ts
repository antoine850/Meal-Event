import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { supabase } from '../lib/supabase.js'
import { stripe } from '../lib/stripe-connect.js'
import { requireAuth, requireOrgAdmin } from '../lib/auth.js'

export const stripeConnectPublicRouter = Router()
export const stripeConnectRouter = Router()

const STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID!
const STRIPE_CONNECT_REDIRECT_URI = process.env.STRIPE_CONNECT_REDIRECT_URI!
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// ============================================
// Helper : vérifier que le restaurant appartient à l'organisation
// ============================================
async function verifyRestaurantOwnership(
  restaurantId: string,
  organizationId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('organization_id', organizationId)
    .single()

  return !error && !!data
}

// ============================================
// GET /oauth/authorize
// ============================================
async function handleAuthorize(req: Request, res: Response) {
  const restaurantId = req.query.restaurant_id as string | undefined

  if (!restaurantId) {
    return res.status(400).json({ error: 'restaurant_id requis' })
  }

  const organizationId = (req as any).organizationId as string
  const userId = (req as any).user?.id as string

  const owned = await verifyRestaurantOwnership(restaurantId, organizationId)
  if (!owned) {
    return res.status(403).json({ error: 'Accès interdit à ce restaurant' })
  }

  const stateToken = crypto.randomBytes(32).toString('hex')

  const { error: insertError } = await supabase
    .from('stripe_oauth_states')
    .insert({
      state_token: stateToken,
      organization_id: organizationId,
      restaurant_id: restaurantId,
      user_id: userId,
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })

  if (insertError) {
    console.error('[stripe-connect] Erreur insertion state:', insertError)
    return res.status(500).json({ error: 'Impossible de générer le state OAuth' })
  }

  const url =
    `https://connect.stripe.com/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(STRIPE_CLIENT_ID)}` +
    `&scope=read_write` +
    `&state=${stateToken}` +
    `&redirect_uri=${encodeURIComponent(STRIPE_CONNECT_REDIRECT_URI)}`

  return res.json({ url })
}

// ============================================
// GET /oauth/callback  (public — Stripe redirige sans cookies)
// ============================================
async function handleCallback(req: Request, res: Response) {
  const { code, state, error: oauthError } = req.query as Record<string, string>

  if (oauthError) {
    return res.redirect(`${FRONTEND_URL}/settings/restaurants?stripe_error=${encodeURIComponent(oauthError)}`)
  }

  // Lookup + consommation atomique du state (anti-replay)
  const { data: stateRow, error: stateError } = await supabase
    .from('stripe_oauth_states')
    .update({ consumed_at: new Date().toISOString() })
    .eq('state_token', state)
    .is('consumed_at', null)
    .gt('expires_at', new Date().toISOString())
    .select()
    .single()

  if (stateError || !stateRow) {
    return res.redirect(`${FRONTEND_URL}/settings/restaurants?stripe_error=invalid_state`)
  }

  // Échanger code contre acct_id
  let acctId: string
  try {
    const tokenResponse = await (stripe as any).oauth.token({
      grant_type: 'authorization_code',
      code,
    })
    acctId = tokenResponse.stripe_user_id as string
  } catch (err) {
    console.error('[stripe-connect] Erreur échange code OAuth:', err)
    return res.redirect(`${FRONTEND_URL}/settings/restaurants?stripe_error=token_exchange_failed`)
  }

  // Vérifier unicité : ce compte ne doit pas déjà être lié à un autre restaurant
  const { data: existingLink } = await supabase
    .from('restaurants')
    .select('id')
    .eq('stripe_account_id', acctId)
    .neq('id', stateRow.restaurant_id)
    .single()

  if (existingLink) {
    return res.redirect(`${FRONTEND_URL}/settings/restaurants?stripe_error=already_linked`)
  }

  // Lire les détails du compte Stripe
  let account: Awaited<ReturnType<typeof stripe.accounts.retrieve>>
  try {
    account = await stripe.accounts.retrieve(acctId)
  } catch (err) {
    console.error('[stripe-connect] Erreur retrieve account:', err)
    return res.redirect(`${FRONTEND_URL}/settings/restaurants?stripe_error=account_retrieve_failed`)
  }

  // Mettre à jour le restaurant
  const { error: updateError } = await supabase
    .from('restaurants')
    .update({
      stripe_account_id: acctId,
      stripe_account_name:
        account.business_profile?.name || account.email || acctId,
      stripe_account_email: account.email ?? null,
      stripe_connected_at: new Date().toISOString(),
      stripe_connected_by: stateRow.user_id,
      stripe_charges_enabled: account.charges_enabled ?? false,
      stripe_payouts_enabled: account.payouts_enabled ?? false,
      stripe_disabled_reason: account.requirements?.disabled_reason ?? null,
      stripe_enabled: true,
    })
    .eq('id', stateRow.restaurant_id)

  if (updateError) {
    console.error('[stripe-connect] Erreur update restaurant:', updateError)
    return res.redirect(`${FRONTEND_URL}/settings/restaurants?stripe_error=db_update_failed`)
  }

  console.log(
    '[stripe-connect.metric]',
    JSON.stringify({
      event: 'oauth_connected',
      restaurant_id: stateRow.restaurant_id,
      organization_id: stateRow.organization_id,
      acct_id: acctId,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
    })
  )

  return res.redirect(
    `${FRONTEND_URL}/settings/restaurant/${stateRow.restaurant_id}?stripe_success=1`
  )
}

// ============================================
// POST /disconnect
// ============================================
async function handleDisconnect(req: Request, res: Response) {
  const { restaurant_id: restaurantId } = req.body as { restaurant_id?: string }

  if (!restaurantId) {
    return res.status(400).json({ error: 'restaurant_id requis' })
  }

  const organizationId = (req as any).organizationId as string

  const owned = await verifyRestaurantOwnership(restaurantId, organizationId)
  if (!owned) {
    return res.status(403).json({ error: 'Accès interdit à ce restaurant' })
  }

  const { data: restaurant, error: fetchError } = await supabase
    .from('restaurants')
    .select('stripe_account_id')
    .eq('id', restaurantId)
    .single()

  if (fetchError || !restaurant) {
    return res.status(404).json({ error: 'Restaurant introuvable' })
  }

  if (!restaurant.stripe_account_id) {
    return res.status(400).json({ error: 'Aucun compte connecté' })
  }

  const acctId = restaurant.stripe_account_id

  // Déautoriser sur Stripe (best-effort)
  try {
    await (stripe as any).oauth.deauthorize({
      client_id: STRIPE_CLIENT_ID,
      stripe_user_id: acctId,
    })
  } catch (err) {
    console.warn('[stripe-connect] Erreur deauthorize (ignorée):', err)
  }

  await supabase
    .from('restaurants')
    .update({
      stripe_account_id: null,
      stripe_account_name: null,
      stripe_account_email: null,
      stripe_connected_at: null,
      stripe_connected_by: null,
      stripe_disabled_reason: null,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    })
    .eq('id', restaurantId)

  console.log(
    '[stripe-connect.metric]',
    JSON.stringify({
      event: 'disconnected',
      restaurant_id: restaurantId,
      organization_id: organizationId,
      acct_id: acctId,
    })
  )

  return res.json({ success: true })
}

// ============================================
// GET /restaurants/:id/status
// ============================================
async function handleStatus(req: Request, res: Response) {
  const restaurantId = req.params.id
  const organizationId = (req as any).organizationId as string

  const owned = await verifyRestaurantOwnership(restaurantId, organizationId)
  if (!owned) {
    return res.status(403).json({ error: 'Accès interdit à ce restaurant' })
  }

  const { data: restaurant, error: fetchError } = await supabase
    .from('restaurants')
    .select('stripe_account_id')
    .eq('id', restaurantId)
    .single()

  if (fetchError || !restaurant) {
    return res.status(404).json({ error: 'Restaurant introuvable' })
  }

  if (!restaurant.stripe_account_id) {
    return res.status(400).json({ error: 'Aucun compte Stripe connecté' })
  }

  const acctId = restaurant.stripe_account_id

  let account: Awaited<ReturnType<typeof stripe.accounts.retrieve>>
  try {
    account = await stripe.accounts.retrieve(acctId)
  } catch (err) {
    console.error('[stripe-connect] Erreur retrieve account (status):', err)
    return res.status(502).json({ error: 'Impossible de joindre Stripe' })
  }

  const chargesEnabled = account.charges_enabled ?? false
  const payoutsEnabled = account.payouts_enabled ?? false
  const disabledReason = account.requirements?.disabled_reason ?? null

  await supabase
    .from('restaurants')
    .update({
      stripe_charges_enabled: chargesEnabled,
      stripe_payouts_enabled: payoutsEnabled,
      stripe_disabled_reason: disabledReason,
    })
    .eq('id', restaurantId)

  return res.json({
    charges_enabled: chargesEnabled,
    payouts_enabled: payoutsEnabled,
    disabled_reason: disabledReason,
  })
}

// ============================================
// Montage des routes
// ============================================

// Public : callback OAuth Stripe (sans auth)
stripeConnectPublicRouter.get('/oauth/callback', handleCallback)

// Routes authentifiées (middleware par route)
stripeConnectRouter.get('/oauth/authorize', requireAuth, requireOrgAdmin, handleAuthorize)
stripeConnectRouter.post('/disconnect', requireAuth, requireOrgAdmin, handleDisconnect)
stripeConnectRouter.get('/restaurants/:id/status', requireAuth, requireOrgAdmin, handleStatus)
