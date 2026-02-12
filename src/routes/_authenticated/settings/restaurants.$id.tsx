import { createFileRoute } from '@tanstack/react-router'
import { RestaurantDetailPage } from '@/features/settings/restaurants/detail-page'

export const Route = createFileRoute('/_authenticated/settings/restaurants/$id')({
  component: RestaurantDetailPage,
})
