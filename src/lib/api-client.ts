const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function apiClient<T = any>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    body?: any
  } = {}
): Promise<T> {
  const { method = 'GET', body } = options

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API error: ${response.status}`)
  }

  return response.json()
}
