import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getCurrentOrganizationId } from '@/lib/get-current-org'
import { supabase } from '@/lib/supabase'
import type { EmailTemplate } from '../lib/email-templates'

// La table email_templates n'est pas (encore) dans les types Supabase générés —
// on by-pass le typage le temps qu'on régénère via `supabase gen types`.
const db = supabase as unknown as {
  from: (table: string) => ReturnType<typeof supabase.from>
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ['email_templates'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) return [] as EmailTemplate[]

      const { data, error } = await db
        .from('email_templates')
        .select('*')
        .eq('organization_id', orgId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('label', { ascending: true })

      if (error) throw error
      return ((data as unknown) || []) as EmailTemplate[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export type EmailTemplateUpdate = {
  id: string
  label?: string
  subject?: string
  body?: string
  is_active?: boolean
}

export function useUpdateEmailTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EmailTemplateUpdate) => {
      const { id, ...patch } = input
      const { data, error } = await db
        .from('email_templates')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as EmailTemplate
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_templates'] })
    },
  })
}

export type CurrentUserProfile = {
  id: string
  email: string
  first_name: string | null
  last_name: string | null
  organization: {
    id: string
    name: string
    website: string | null
  } | null
}

export function useCurrentUserProfile() {
  return useQuery({
    queryKey: ['current_user_profile'],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return null

      const { data, error } = await supabase
        .from('users')
        .select(
          'id, email, first_name, last_name, organization:organizations(id, name, website)'
        )
        .eq('id', user.id)
        .single()

      if (error) throw error
      return data as unknown as CurrentUserProfile
    },
    staleTime: 10 * 60 * 1000,
  })
}
