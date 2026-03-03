import { createFileRoute } from '@tanstack/react-router'
import { MenuFormPublic } from '@/features/reservations/components/menu-form-public'

export const Route = createFileRoute('/menu-form/$token')({
  component: MenuFormPublicPage,
})

function MenuFormPublicPage() {
  const { token } = Route.useParams()
  return <MenuFormPublic token={token} />
}
