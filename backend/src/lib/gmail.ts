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

// Master switch de l'integration Gmail. Defaut OFF : seule la valeur exacte
// 'true' active (variable absente/vide/autre => OFF). Gate le flux de connexion,
// et gmailClient() renvoie null quand OFF (donc envoi/polling des phases 2-3
// retombent sur Resend meme si leurs propres flags sont ON).
export function isGmailIntegrationEnabled(): boolean {
  return process.env.GMAIL_INTEGRATION_ENABLED === 'true'
}

// Sous-switch d'envoi. Effectif seulement si le master est ON.
export function isGmailSendingEnabled(): boolean {
  return isGmailIntegrationEnabled() && process.env.GMAIL_SENDING_ENABLED === 'true'
}

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

  const { error } = await supabase
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

  // Frontiere externe : sans persistance du token, la connexion est un echec
  // meme si l'echange OAuth a reussi (sinon on afficherait "connecte" a tort).
  if (error) throw new Error(`Echec d'enregistrement du compte Gmail: ${error.message}`)

  return { userId, googleEmail }
}

// Client Gmail authentifie pour un utilisateur, ou null s'il n'a pas de compte
// connecte. Utilise en phases 2-3 (envoi/polling).
export async function gmailClient(userId: string) {
  if (!isGmailIntegrationEnabled()) return null

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

// Verifie qu'un message qu'on croit avoir envoye existe bien (apres timeout ambigu).
// Renvoie le gmail_message_id trouve, sinon null.
export async function findByRfcMessageId(
  client: NonNullable<Awaited<ReturnType<typeof gmailClient>>>,
  rfcMessageId: string
): Promise<string | null> {
  try {
    const bare = rfcMessageId.replace(/^<|>$/g, '')
    const { data } = await client.users.messages.list({
      userId: 'me',
      q: `rfc822msgid:${bare}`,
      maxResults: 1,
    })
    return data.messages?.[0]?.id ?? null
  } catch {
    return null
  }
}

// Marque un compte comme revoque (401/invalid_grant) : coupe les futurs envois
// Gmail de cette boite et alimente le bandeau reglages. Best-effort.
export async function markAccountRevoked(userId: string, err: unknown): Promise<void> {
  const message = err instanceof Error ? err.message : String(err)
  await supabase
    .from('user_gmail_accounts')
    .update({ status: 'revoked', last_error: message } as never)
    .eq('user_id', userId)
}
