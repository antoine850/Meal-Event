import { createFileRoute } from '@tanstack/react-router'
import { PublicBookingForm } from '@/features/public/components/public-booking-form'

export const Route = createFileRoute('/r/$slug')({
  component: PublicBookingPage,
})

function PublicBookingPage() {
  const { slug } = Route.useParams()
  return <PublicBookingForm slug={slug} />
}
