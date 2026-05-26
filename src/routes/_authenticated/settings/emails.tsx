import { createFileRoute } from '@tanstack/react-router'
import { EmailTemplatesPage } from '@/features/settings/emails/page'

export const Route = createFileRoute('/_authenticated/settings/emails')({
  component: EmailTemplatesPage,
})
