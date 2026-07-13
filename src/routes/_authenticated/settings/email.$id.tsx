import { createFileRoute } from '@tanstack/react-router'
import { EmailTemplateDetailPage } from '@/features/settings/emails/detail-page'

export const Route = createFileRoute('/_authenticated/settings/email/$id')({
  component: EmailTemplateDetailPage,
})
