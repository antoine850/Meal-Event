import crypto from 'node:crypto'

// AES-256-GCM. La cle vient de GMAIL_TOKEN_ENC_KEY (64 hex = 32 octets).
// Format de sortie : base64(iv).base64(tag).base64(ciphertext).
function getKey(): Buffer {
  const hex = process.env.GMAIL_TOKEN_ENC_KEY
  // Valider le format hex : Buffer.from(hex, 'hex') tronque sur un caractere
  // non-hex et donnerait une cle de mauvaise taille (erreur cryptique au chiffrement).
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error('GMAIL_TOKEN_ENC_KEY manquante ou invalide (64 hex attendus)')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`
}

export function decryptToken(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Token chiffre malforme')
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getKey(),
    Buffer.from(ivB64, 'base64')
  )
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
