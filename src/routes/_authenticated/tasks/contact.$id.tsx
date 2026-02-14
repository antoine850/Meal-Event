import { createFileRoute } from '@tanstack/react-router'
import { ContactDetailPage } from '@/features/contacts/components/contact-detail-page'

export const Route = createFileRoute('/_authenticated/tasks/contact/$id')({
  component: ContactDetailPage,
})
