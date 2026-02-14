import { createFileRoute } from '@tanstack/react-router'
import { ContactDetailPage } from '@/features/contacts/components/contact-detail-page'

export const Route = createFileRoute('/_authenticated/contacts/contact/$id')({
  component: ContactDetailPage,
})
