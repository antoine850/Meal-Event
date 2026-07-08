import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

type GmailStatus = {
  connected: boolean
  email: string | null
  status: string | null
  sending_enabled: boolean
  integration_enabled: boolean
}

export function useGmailStatus() {
  return useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => apiClient<GmailStatus>('/api/gmail/status'),
  })
}

export function useGmailAuthUrl() {
  return useMutation({
    mutationFn: () => apiClient<{ url: string }>('/api/gmail/auth-url'),
  })
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiClient('/api/gmail/disconnect', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] })
    },
  })
}
