import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

async function getCurrentOrganizationId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  return (data as { organization_id: string } | null)?.organization_id || null
}

// ============================================
// Types
// ============================================

export type Product = {
  id: string
  organization_id: string
  name: string
  description: string | null
  type: 'boissons_alcoolisees' | 'boissons_sans_alcool' | 'food' | 'frais_personnel' | 'frais_privatisation' | 'prestataires'
  tag: string | null
  price_per_person: boolean
  unit_price_ht: number
  tva_rate: number
  unit_price_ttc: number
  margin: number
  is_active: boolean
  old_id: string | null
  created_at: string
  updated_at: string
}

export type ProductWithRestaurants = Product & {
  product_restaurants: { restaurant_id: string; restaurant: { id: string; name: string; color: string | null } }[]
}

export type Package = {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type PackageWithRelations = Package & {
  package_products: { product_id: string; quantity: number; product: Product }[]
  package_restaurants: { restaurant_id: string; restaurant: { id: string; name: string; color: string | null } }[]
}

export const PRODUCT_TYPES = [
  { value: 'boissons_alcoolisees', label: 'Boissons alcoolisées' },
  { value: 'boissons_sans_alcool', label: 'Boissons sans alcool' },
  { value: 'food', label: 'Food' },
  { value: 'frais_personnel', label: 'Frais de personnel' },
  { value: 'frais_privatisation', label: 'Frais de privatisation' },
  { value: 'prestataires', label: 'Prestataires' },
] as const

// ============================================
// Products
// ============================================

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_restaurants(
            restaurant_id,
            restaurant:restaurants(id, name, color)
          )
        `)
        .eq('organization_id', orgId)
        .order('name', { ascending: true })

      if (error) throw error
      return data as ProductWithRestaurants[]
    },
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ restaurant_ids, ...product }: Partial<Product> & { restaurant_ids?: string[] }) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('products')
        .insert({ ...product, organization_id: orgId } as never)
        .select()
        .single()

      if (error) throw error

      if (restaurant_ids && restaurant_ids.length > 0) {
        const { error: linkError } = await supabase
          .from('product_restaurants')
          .insert(restaurant_ids.map(rid => ({ product_id: (data as any).id, restaurant_id: rid })) as never)

        if (linkError) throw linkError
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, restaurant_ids, ...updates }: Partial<Product> & { id: string; restaurant_ids?: string[] }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      if (restaurant_ids !== undefined) {
        await supabase.from('product_restaurants').delete().eq('product_id', id)
        if (restaurant_ids.length > 0) {
          const { error: linkError } = await supabase
            .from('product_restaurants')
            .insert(restaurant_ids.map(rid => ({ product_id: id, restaurant_id: rid })) as never)
          if (linkError) throw linkError
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
    },
  })
}

// ============================================
// Packages
// ============================================

export function usePackages() {
  return useQuery({
    queryKey: ['packages'],
    queryFn: async () => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('packages')
        .select(`
          *,
          package_products(
            product_id,
            quantity,
            product:products(*)
          ),
          package_restaurants(
            restaurant_id,
            restaurant:restaurants(id, name, color)
          )
        `)
        .eq('organization_id', orgId)
        .order('name', { ascending: true })

      if (error) throw error
      return data as PackageWithRelations[]
    },
  })
}

export function useCreatePackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ restaurant_ids, product_items, ...pkg }: Partial<Package> & { restaurant_ids?: string[]; product_items?: { product_id: string; quantity: number }[] }) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const { data, error } = await supabase
        .from('packages')
        .insert({ ...pkg, organization_id: orgId } as never)
        .select()
        .single()

      if (error) throw error

      if (product_items && product_items.length > 0) {
        const { error: prodError } = await supabase
          .from('package_products')
          .insert(product_items.map(pi => ({ package_id: (data as any).id, product_id: pi.product_id, quantity: pi.quantity })) as never)
        if (prodError) throw prodError
      }

      if (restaurant_ids && restaurant_ids.length > 0) {
        const { error: linkError } = await supabase
          .from('package_restaurants')
          .insert(restaurant_ids.map(rid => ({ package_id: (data as any).id, restaurant_id: rid })) as never)
        if (linkError) throw linkError
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
    },
  })
}

export function useUpdatePackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, restaurant_ids, product_items, ...updates }: Partial<Package> & { id: string; restaurant_ids?: string[]; product_items?: { product_id: string; quantity: number }[] }) => {
      const { data, error } = await supabase
        .from('packages')
        .update(updates as never)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      if (product_items !== undefined) {
        await supabase.from('package_products').delete().eq('package_id', id)
        if (product_items.length > 0) {
          const { error: prodError } = await supabase
            .from('package_products')
            .insert(product_items.map(pi => ({ package_id: id, product_id: pi.product_id, quantity: pi.quantity })) as never)
          if (prodError) throw prodError
        }
      }

      if (restaurant_ids !== undefined) {
        await supabase.from('package_restaurants').delete().eq('package_id', id)
        if (restaurant_ids.length > 0) {
          const { error: linkError } = await supabase
            .from('package_restaurants')
            .insert(restaurant_ids.map(rid => ({ package_id: id, restaurant_id: rid })) as never)
          if (linkError) throw linkError
        }
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
    },
  })
}

export function useDeletePackage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('packages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['packages'] })
    },
  })
}
