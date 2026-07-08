import { useUnreadBookingThreads } from '../hooks/use-thread-unread'

// Pastille "reponse non lue" pour une ligne de la liste des reservations.
// S'appuie sur la requete partagee (un seul fetch pour toute la table).
export function UnreadDot({ bookingId }: { bookingId: string }) {
  const { data: unread } = useUnreadBookingThreads()
  if (!unread?.has(bookingId)) return null
  return (
    <span
      className='inline-block h-2 w-2 shrink-0 rounded-full bg-red-500'
      title='Réponse client non lue'
      aria-label='Réponse non lue'
    />
  )
}
