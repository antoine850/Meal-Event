import crypto from 'node:crypto'

// State OAuth signe : "<userId>.<expiryMs>.<hmac>", base64url du payload signe.
// Empeche de lier une boite Gmail au user d'autrui (le state brut du flux
// Calendar est vulnerable). Duree de vie par defaut : 10 minutes.
function secret(): string {
  const s = process.env.GMAIL_OAUTH_STATE_SECRET
  if (!s) throw new Error('GMAIL_OAUTH_STATE_SECRET manquante')
  return s
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function signState(userId: string, ttlMs = 10 * 60 * 1000): string {
  const expiry = Date.now() + ttlMs
  const payload = `${userId}.${expiry}`
  return `${payload}.${sign(payload)}`
}

export function verifyState(state: string): string | null {
  const parts = state.split('.')
  if (parts.length !== 3) return null
  const [userId, expiry, sig] = parts
  const payload = `${userId}.${expiry}`
  const expected = sign(payload)
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null
  }
  if (Number(expiry) < Date.now()) return null
  return userId
}
