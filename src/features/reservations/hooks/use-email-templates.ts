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
        .select(
          'id, organization_id, name, sort_order, is_active, subject_fr, body_fr, subject_en, body_en, email_template_restaurants(restaurant_id)'
        )
        .eq('organization_id', orgId)
        .not('subject_fr', 'is', null)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      return (
        ((data as unknown) || []) as Array<
          Omit<EmailTemplate, 'restaurant_ids'> & {
            email_template_restaurants?: { restaurant_id: string }[]
          }
        >
      ).map(({ email_template_restaurants, ...t }) => ({
        ...t,
        restaurant_ids: (email_template_restaurants || []).map(
          (r) => r.restaurant_id
        ),
      }))
    },
    staleTime: 5 * 60 * 1000,
  })
}

export type EmailTemplateInput = {
  name: string
  subject_fr: string
  body_fr: string
  subject_en: string | null
  body_en: string | null
  is_active: boolean
  restaurant_ids: string[]
}

export function useCreateEmailTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ restaurant_ids, ...fields }: EmailTemplateInput) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      // Nouveau modèle en fin de liste
      const { data: maxRow, error: maxError } = await db
        .from('email_templates')
        .select('sort_order')
        .eq('organization_id', orgId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (maxError) throw maxError

      const { data, error } = await db
        .from('email_templates')
        .insert({
          ...fields,
          organization_id: orgId,
          sort_order:
            ((maxRow as unknown as { sort_order: number } | null)?.sort_order ??
              0) + 10,
        })
        .select()
        .single()
      if (error) throw error

      const created = {
        ...(data as unknown as Omit<EmailTemplate, 'restaurant_ids'>),
        restaurant_ids,
      }
      if (restaurant_ids.length > 0) {
        const { error: linkError } = await db
          .from('email_template_restaurants')
          .insert(
            restaurant_ids.map((rid) => ({
              template_id: created.id,
              restaurant_id: rid,
            }))
          )
        if (linkError) throw linkError
      }
      return created
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['email_templates'] })
    },
  })
}

export type EmailTemplateUpdate = Partial<EmailTemplateInput> & { id: string }

export function useUpdateEmailTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      restaurant_ids,
      ...patch
    }: EmailTemplateUpdate) => {
      const { error } = await db
        .from('email_templates')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error

      if (restaurant_ids !== undefined) {
        const { error: delError } = await db
          .from('email_template_restaurants')
          .delete()
          .eq('template_id', id)
        if (delError) throw delError
        if (restaurant_ids.length > 0) {
          const { error: linkError } = await db
            .from('email_template_restaurants')
            .insert(
              restaurant_ids.map((rid) => ({
                template_id: id,
                restaurant_id: rid,
              }))
            )
          if (linkError) throw linkError
        }
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['email_templates'] })
    },
  })
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('email_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_templates'] })
    },
  })
}

// Échange les sort_order de deux modèles voisins (flèches monter/descendre)
export function useReorderEmailTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ a, b }: { a: EmailTemplate; b: EmailTemplate }) => {
      const { error: e1 } = await db
        .from('email_templates')
        .update({ sort_order: b.sort_order })
        .eq('id', a.id)
      if (e1) throw e1
      const { error: e2 } = await db
        .from('email_templates')
        .update({ sort_order: a.sort_order })
        .eq('id', b.id)
      if (e2) throw e2
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email_templates'] }),
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
