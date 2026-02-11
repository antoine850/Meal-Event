import { createFileRoute } from '@tanstack/react-router'
import { SpacesPage } from '@/features/settings/spaces/page'

export const Route = createFileRoute('/_authenticated/settings/spaces')({
  component: SpacesPage,
})
