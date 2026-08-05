import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

type EmailSignature = {
  signature: string | null
  preview_html: string
}

export function useEmailSignature() {
  return useQuery({
    queryKey: ['email-signature'],
    queryFn: () => apiClient<EmailSignature>('/api/emails/signature'),
  })
}

export function useUpdateEmailSignature() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (signature: string) =>
      apiClient<EmailSignature>('/api/emails/signature', {
        method: 'PUT',
        body: { signature },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['email-signature'], data)
    },
  })
}
