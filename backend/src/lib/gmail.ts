import { google } from 'googleapis'
import { supabase } from './supabase.js'
import { encryptToken, decryptToken } from './crypto.js'
import { signState, verifyState } from './oauth-state.js'

// gmail.send -> envoi ; gmail.readonly -> polling des reponses + getProfile ;
// userinfo.email -> adresse du compte connecte pour l'affichage.
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

function getGmailOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GMAIL_REDIRECT_URI
  )
}

export function getGmailAuthUrl(userId: string): string {
  const client = getGmailOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state: signState(userId),
  })
}

// Callback : verifie le state signe, echange le code, chiffre le refresh token,
// seme history_id (getProfile) et l'email du compte, upsert user_gmail_accounts.
export async function handleGmailCallback(code: string, state: string) {
  const userId = verifyState(state)
  if (!userId) throw new Error('State OAuth invalide ou expire')

  const { data: userRow } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single()
  if (!userRow?.organization_id) throw new Error('Utilisateur sans organisation')

  const client = getGmailOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error('Pas de refresh token (l\'utilisateur doit revoquer puis reconnecter)')
  }
  client.setCredentials(tokens)

  let googleEmail: string | null = null
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const { data } = await oauth2.userinfo.get()
    googleEmail = data.email || null
  } catch (err) {
    console.warn('[Gmail] userinfo.get a echoue:', err instanceof Error ? err.message : err)
  }

  let historyId: string | null = null
  try {
    const gmail = google.gmail({ version: 'v1', auth: client })
    const { data } = await gmail.users.getProfile({ userId: 'me' })
    historyId = data.historyId ? String(data.historyId) : null
  } catch (err) {
    console.warn('[Gmail] getProfile a echoue:', err instanceof Error ? err.message : err)
  }

  await supabase
    .from('user_gmail_accounts')
    .upsert(
      {
        user_id: userId,
        organization_id: userRow.organization_id,
        google_email: googleEmail,
        refresh_token: encryptToken(tokens.refresh_token),
        scopes: GMAIL_SCOPES.join(' '),
        history_id: historyId,
        status: 'connected',
        last_error: null,
        connected_at: new Date().toISOString(),
      } as never,
      { onConflict: 'user_id' }
    )

  return { userId, googleEmail }
}

// Client Gmail authentifie pour un utilisateur, ou null s'il n'a pas de compte
// connecte. Utilise en phases 2-3 (envoi/polling).
export async function gmailClient(userId: string) {
  const { data: account } = await supabase
    .from('user_gmail_accounts')
    .select('refresh_token, status')
    .eq('user_id', userId)
    .single()

  if (!account?.refresh_token || account.status !== 'connected') return null

  const client = getGmailOAuthClient()
  client.setCredentials({ refresh_token: decryptToken(account.refresh_token) })
  return google.gmail({ version: 'v1', auth: client })
}

export async function getGmailAccountStatus(userId: string) {
  const { data: account } = await supabase
    .from('user_gmail_accounts')
    .select('google_email, status, sending_enabled')
    .eq('user_id', userId)
    .single()

  if (!account) {
    return { connected: false, email: null, status: null, sending_enabled: false }
  }
  return {
    connected: account.status === 'connected',
    email: account.google_email,
    status: account.status,
    sending_enabled: account.sending_enabled,
  }
}

export async function disconnectGmail(userId: string) {
  const { data: account } = await supabase
    .from('user_gmail_accounts')
    .select('refresh_token')
    .eq('user_id', userId)
    .single()

  if (account?.refresh_token) {
    try {
      const client = getGmailOAuthClient()
      await client.revokeToken(decryptToken(account.refresh_token))
    } catch {
      // Token peut-etre deja revoque, on continue le cleanup.
    }
  }

  await supabase.from('user_gmail_accounts').delete().eq('user_id', userId)
}
