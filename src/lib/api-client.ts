import { supabase } from '@/lib/supabase'

// In development, use Vite proxy (same-origin, no CORS issues)
// In production, use the configured API URL
const API_BASE_URL = import.meta.env.DEV
  ? ''  // Empty = same origin, goes through Vite proxy
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001')

export async function apiClient<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: any
  } = {}
): Promise<T> {
  const { method = 'GET', body } = options

  // Get the current session token for authenticated API calls
  const { data: { session } } = await supabase.auth.getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API error: ${response.status}`)
  }

  return response.json()
}
