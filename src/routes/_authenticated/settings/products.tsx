import { createFileRoute } from '@tanstack/react-router'
import { SettingsProducts } from '@/features/settings/products'

export const Route = createFileRoute('/_authenticated/settings/products')({
  component: SettingsProducts,
})
