import { createFileRoute } from '@tanstack/react-router'
import { RestaurantsPage } from '@/features/settings/restaurants/page'

export const Route = createFileRoute('/_authenticated/settings/restaurants')({
  component: RestaurantsPage,
})
