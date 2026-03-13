import axios, { type AxiosInstance } from 'axios'

// SignNow API URLs:
// - Production: https://api.signnow.com
// - Sandbox/Eval: https://api-eval.signnow.com (NOT eval.signnow.com!)
//
// SignNow uses OAuth 2.0 with grant_type=password (Resource Owner Password Credentials)
// Required env vars:
// - SIGNNOW_API_BASE: API URL (sandbox or production)
// - SIGNNOW_CLIENT_ID: Your application's client ID
// - SIGNNOW_CLIENT_SECRET: Your application's client secret
// - SIGNNOW_USERNAME: Your SignNow account email
// - SIGNNOW_PASSWORD: Your SignNow account password
const SIGNNOW_API_BASE = process.env.SIGNNOW_API_BASE || 'https://api.signnow.com'
const SIGNNOW_CLIENT_ID = process.env.SIGNNOW_CLIENT_ID || ''
const SIGNNOW_CLIENT_SECRET = process.env.SIGNNOW_CLIENT_SECRET || ''
const SIGNNOW_USERNAME = process.env.SIGNNOW_USERNAME || ''
const SIGNNOW_PASSWORD = process.env.SIGNNOW_PASSWORD || ''

let cachedToken: { token: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token
  }

  console.log(`[SignNow] Getting access token from: ${SIGNNOW_API_BASE}/oauth2/token`)
  console.log(`[SignNow] Client ID: ${SIGNNOW_CLIENT_ID ? SIGNNOW_CLIENT_ID.substring(0, 8) + '...' : 'NOT SET'}`)
  console.log(`[SignNow] Username: ${SIGNNOW_USERNAME ? SIGNNOW_USERNAME.substring(0, 5) + '...' : 'NOT SET'}`)

  const basicAuth = Buffer.from(`${SIGNNOW_CLIENT_ID}:${SIGNNOW_CLIENT_SECRET}`).toString('base64')

  // SignNow requires grant_type=password with username and password
  const params = new URLSearchParams()
  params.append('grant_type', 'password')
  params.append('username', SIGNNOW_USERNAME)
  params.append('password', SIGNNOW_PASSWORD)

  try {
    const response = await axios.post(
      `${SIGNNOW_API_BASE}/oauth2/token`,
      params.toString(),
      {
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    console.log(`[SignNow] Token obtained successfully`)

    cachedToken = {
      token: response.data.access_token,
      expiresAt: Date.now() + (response.data.expires_in * 1000),
    }

    return cachedToken.token
  } catch (error: any) {
    console.error(`[SignNow] OAuth error:`, error.response?.status, error.response?.data || error.message)
    throw error
  }
}

function getClient(): Promise<AxiosInstance> {
  return getAccessToken().then(token => {
    return axios.create({
      baseURL: SIGNNOW_API_BASE,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  })
}

export async function uploadDocument(pdfBuffer: Buffer, fileName: string): Promise<string> {
  const token = await getAccessToken()

  const FormData = (await import('form-data')).default
  const formData = new FormData()
  formData.append('file', pdfBuffer, {
    filename: fileName,
    contentType: 'application/pdf',
  })

  const response = await axios.post(
    `${SIGNNOW_API_BASE}/document`,
    formData,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...formData.getHeaders(),
      },
    }
  )

  return response.data.id
}

export async function addSignatureField(documentId: string, params: {
  pageNumber?: number
  x?: number
  y?: number
  width?: number
  height?: number
  role?: string
  required?: boolean
}): Promise<void> {
  const client = await getClient()

  const {
    pageNumber = 0,
    x = 30,
    y = 700,
    width = 200,
    height = 50,
    role = 'Signer 1',
    required = true,
  } = params

  await client.put(`/document/${documentId}`, {
    fields: [
      {
        type: 'signature',
        page_number: pageNumber,
        x,
        y,
        width,
        height,
        role,
        required,
        label: 'Signature du client',
      },
    ],
  })
}

export async function createSigningInvite(
  documentId: string,
  signerEmail: string,
  signerName: string,
  subject?: string,
  message?: string
): Promise<{ inviteId: string }> {
  const client = await getClient()

  const response = await client.post(`/document/${documentId}/invite`, {
    to: [
      {
        email: signerEmail,
        role: 'Signer 1',
        role_id: '',
        order: 1,
        reassign: '0',
        decline_by_signature: '0',
        reminder: 4,
        expiration_days: 30,
        subject: subject || 'Devis à signer',
        message: message || `Bonjour ${signerName},\n\nVeuillez signer le devis ci-joint.\n\nCordialement.`,
      },
    ],
    from: signerEmail,
  })

  return { inviteId: response.data.id || response.data.result || documentId }
}

export async function getDocumentStatus(documentId: string): Promise<{
  status: string
  isSigned: boolean
}> {
  const client = await getClient()
  const response = await client.get(`/document/${documentId}`)

  const doc = response.data
  const isSigned = doc.signatures && doc.signatures.length > 0

  return {
    status: isSigned ? 'signed' : 'pending',
    isSigned,
  }
}

export async function downloadSignedDocument(documentId: string): Promise<Buffer> {
  const token = await getAccessToken()

  const response = await axios.get(
    `${SIGNNOW_API_BASE}/document/${documentId}/download?type=collapsed`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      responseType: 'arraybuffer',
    }
  )

  return Buffer.from(response.data)
}

export function verifyWebhookSignature(payload: string | Buffer, signature: string): boolean {
  const crypto = require('crypto')
  const secret = process.env.SIGNNOW_WEBHOOK_SECRET || ''

  if (!secret) {
    console.warn('SIGNNOW_WEBHOOK_SECRET not set, skipping verification')
    return true
  }

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(typeof payload === 'string' ? payload : payload.toString('utf8'))
  const expectedSignature = hmac.digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
