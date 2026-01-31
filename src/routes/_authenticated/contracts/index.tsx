import { createFileRoute } from '@tanstack/react-router'
import { Contracts } from '@/features/contracts'

export const Route = createFileRoute('/_authenticated/contracts/')({
  component: Contracts,
})
