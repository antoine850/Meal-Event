import { supabase } from '@/lib/supabase'

// In development, use Vite proxy (same-origin, no CORS issues)
// In production, use the configured API URL
const API_BASE_URL = import.meta.env.DEV
  ? '' // Empty = same origin, goes through Vite proxy
  : import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function apiClient<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: any
  } = {}
): Promise<T> {
  const { method = 'GET', body } = options

  // Get the current session token for authenticated API calls
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  // 90s : au-dela du pire envoi Gmail legitime, mais fini ; sans ca un backend
  // muet laisse l'UI en "envoi..." pour toujours.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(
        'Le serveur ne répond pas. Si vous envoyiez un email, vérifiez le fil de conversation avant de réessayer.'
      )
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API error: ${response.status}`)
  }

  return response.json()
}
