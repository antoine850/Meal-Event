import type { Contact } from '@/lib/supabase/types'

export type ContactWithRelations = Contact & {
  company?: { id: string; name: string } | null
  status?: { id: string; name: string; color: string; slug: string } | null
  assigned_user?: { id: string; first_name: string; last_name: string } | null
  restaurant?: { id: string; name: string } | null
}

export type StatusCount = {
  value: string
  label: string
  color: string
  count: number
}
