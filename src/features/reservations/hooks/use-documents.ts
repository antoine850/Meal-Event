import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Document } from '@/lib/supabase/types'

async function getCurrentOrganizationId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  return (data as any)?.organization_id || null
}

export function useDocumentsByBooking(bookingId: string) {
  return useQuery<Document[]>({
    queryKey: ['documents', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return (data as Document[]) || []
    },
    enabled: !!bookingId,
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      bookingId,
      description,
      tags,
    }: {
      file: File
      bookingId: string
      description?: string
      tags?: string[]
    }) => {
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      // 1. Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${orgId}/bookings/${bookingId}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // 2. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      const fileUrl = publicUrlData.publicUrl

      // 3. Create document record in database
      const { data, error: dbError } = await supabase
        .from('documents')
        .insert({
          organization_id: orgId,
          booking_id: bookingId,
          name: file.name,
          file_type: file.type || fileExt,
          file_size: file.size,
          file_path: filePath,
          file_url: fileUrl,
          description: description || null,
          tags: tags || null,
        } as never)
        .select()
        .single()

      if (dbError) throw dbError
      return data
    },
    onSuccess: (data) => {
      if ((data as any)?.booking_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', (data as any).booking_id] })
      }
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (documentId: string) => {
      // 1. Get document to get file path
      const { data: document, error: fetchError } = await supabase
        .from('documents')
        .select('file_path, booking_id')
        .eq('id', documentId)
        .single()

      if (fetchError) throw fetchError
      if (!document) throw new Error('Document not found')

      const doc = document as any

      // 2. Delete file from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([doc.file_path])

      if (storageError) throw storageError

      // 3. Delete document record
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (dbError) throw dbError
      return document
    },
    onSuccess: (data) => {
      if ((data as any)?.booking_id) {
        queryClient.invalidateQueries({ queryKey: ['documents', (data as any).booking_id] })
      }
    },
  })
}
