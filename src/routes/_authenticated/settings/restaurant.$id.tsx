import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { RestaurantDetailPage } from '@/features/settings/restaurants/detail-page'

const searchSchema = z.object({
  stripe_success: z.coerce.number().optional(),
  stripe_error: z.string().optional(),
})

export const Route = createFileRoute('/_authenticated/settings/restaurant/$id')({
  validateSearch: searchSchema,
  component: RestaurantDetailPage,
})
