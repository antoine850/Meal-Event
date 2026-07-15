import { toast } from 'sonner'
import { useBookingStatuses, useUpdateBooking } from './use-bookings'

export type PromotableBooking = {
  id: string
  status?: { slug: string } | null
}

// Toast de succès avec promotion de statut en un clic (post-téléchargement
// devis / fiche de fonction). Pas d'action si le booking est déjà au statut
// cible ou plus loin dans le pipeline.
export function usePromoteToast() {
  const { data: statuses = [] } = useBookingStatuses()
  const { mutate: updateBooking } = useUpdateBooking()

  return (message: string, booking: PromotableBooking, targetSlug: string) => {
    const target = statuses.find((s) => s.slug === targetSlug)
    const current = statuses.find((s) => s.slug === booking.status?.slug)
    if (!target || (current && current.position >= target.position)) {
      toast.success(message)
      return
    }
    toast.success(message, {
      // Durée rallongée pour laisser le temps de cliquer l'action
      duration: 8000,
      action: {
        label: `Passer en ${target.name}`,
        onClick: () =>
          updateBooking(
            { id: booking.id, status_id: target.id },
            {
              onSuccess: () => toast.success(`Statut passé en ${target.name}`),
              onError: (e) =>
                toast.error(`Maj statut KO : ${(e as Error).message}`),
            }
          ),
      },
    })
  }
}
