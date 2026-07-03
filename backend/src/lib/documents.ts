import { supabase } from './supabase.js'

// Upload d'un PDF vers le bucket Storage 'documents' + insertion d'une ligne
// dans la table documents. Lève en cas d'échec — à utiliser quand la ligne
// documents est le livrable (ex: fiche de fonction).
export async function uploadPdfDocument(
  pdfBuffer: Buffer,
  storagePath: string,
  docName: string,
  organizationId: string | null,
  bookingId: string | null,
  opts?: { doc_kind?: string; credit_note_id?: string }
): Promise<{ storagePath: string; fileUrl: string }> {
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Storage upload failed for ${docName}: ${uploadError.message}`)
  }

  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(uploadData?.path || storagePath)

  const fileUrl = urlData?.publicUrl || ''

  const { error: docError } = await supabase.from('documents').insert({
    organization_id: organizationId,
    booking_id: bookingId,
    name: docName,
    file_type: 'pdf',
    file_size: pdfBuffer.length,
    file_path: storagePath,
    file_url: fileUrl,
    ...(opts?.doc_kind ? { doc_kind: opts.doc_kind } : {}),
    ...(opts?.credit_note_id ? { credit_note_id: opts.credit_note_id } : {}),
  } as any)

  if (docError) {
    throw new Error(`Document record insert failed for ${docName}: ${docError.message}`)
  }

  return { storagePath, fileUrl }
}

// Variante best-effort pour les flux email/webhook : le PDF est régénérable,
// un échec de sauvegarde ne doit pas faire échouer l'envoi.
export async function savePdfAsDocument(
  pdfBuffer: Buffer,
  fileName: string,
  storagePath: string,
  docName: string,
  organizationId: string | null,
  bookingId: string | null,
  opts?: { doc_kind?: string; credit_note_id?: string }
) {
  try {
    await uploadPdfDocument(
      pdfBuffer,
      storagePath,
      docName,
      organizationId,
      bookingId,
      opts
    )
    console.log(`[PDF Save] ✅ Saved ${docName} for booking ${bookingId}`)
  } catch (err) {
    console.error(`[PDF Save] Error saving ${fileName}:`, err)
  }
}
