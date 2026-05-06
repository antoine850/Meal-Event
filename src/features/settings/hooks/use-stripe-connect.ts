import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export function useStartStripeConnect() {
  return useMutation({
    mutationFn: async (restaurantId: string) => {
      const { url } = await apiClient<{ url: string }>(
        `/api/stripe-connect/oauth/authorize?restaurant_id=${restaurantId}`
      )
      window.location.href = url
    },
  })
}

export function useDisconnectStripe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (restaurantId: string) =>
      apiClient('/api/stripe-connect/disconnect', {
        method: 'POST',
        body: { restaurant_id: restaurantId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-restaurants'] })
    },
  })
}

export function useRefreshStripeStatus(restaurantId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiClient(`/api/stripe-connect/restaurants/${restaurantId}/status`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-restaurants'] })
    },
  })
}
