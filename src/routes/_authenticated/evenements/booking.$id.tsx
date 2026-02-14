import { createFileRoute } from '@tanstack/react-router'
import { BookingDetailPage } from '@/features/reservations/components/booking-detail-page'

export const Route = createFileRoute('/_authenticated/evenements/booking/$id')({
  component: BookingDetailPage,
})
