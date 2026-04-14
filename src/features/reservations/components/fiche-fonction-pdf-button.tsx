import { useState, type RefObject } from 'react'
import { Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { getCurrentOrganizationId } from '@/lib/get-current-org'

type Props = {
  bookingId: string
  printRef: RefObject<HTMLDivElement | null>
}

export function FicheFonctionPdfButton({ bookingId, printRef }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const queryClient = useQueryClient()

  const handleExport = async () => {
    const element = printRef.current
    if (!element) {
      toast.error('Contenu non disponible')
      return
    }

    setIsExporting(true)
    try {
      // 1. Figure out the next version number from existing documents
      const { data: existing, error: listError } = await supabase
        .from('documents')
        .select('name')
        .eq('booking_id', bookingId)
        .like('name', 'Fiche de fonction v%')

      if (listError) throw listError

      const maxVersion = (existing || []).reduce<number>((max, d) => {
        const name = (d as { name: string | null }).name || ''
        const m = name.match(/^Fiche de fonction v(\d+)$/)
        return m ? Math.max(max, parseInt(m[1], 10)) : max
      }, 0)
      const nextVersion = maxVersion + 1

      // 2. Generate PDF blob (same oklch workaround as quote-pdf-export.tsx)
      const html2pdf = (await import('html2pdf.js')).default

      const colorProps = [
        'color',
        'background-color',
        'border-color',
        'border-left-color',
        'border-right-color',
        'border-top-color',
        'border-bottom-color',
      ]

      const origAll = [element, ...Array.from(element.querySelectorAll('*'))]
      const computedMap: Map<number, Record<string, string>> = new Map()

      origAll.forEach((el, idx) => {
        ;(el as HTMLElement).setAttribute('data-pdf-idx', String(idx))
        const computed = window.getComputedStyle(el)
        const styles: Record<string, string> = {}
        colorProps.forEach((prop) => {
          styles[prop] = computed.getPropertyValue(prop)
        })
        computedMap.set(idx, styles)
      })

      const filename = `Fiche-de-fonction-v${nextVersion}.pdf`

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const worker = (html2pdf() as any)
        .set({
          margin: [5, 5, 10, 5],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc: Document) => {
              clonedDoc
                .querySelectorAll('style, link[rel="stylesheet"]')
                .forEach((el) => el.remove())

              const clonedAll = clonedDoc.querySelectorAll('[data-pdf-idx]')
              clonedAll.forEach((el) => {
                const htmlEl = el as HTMLElement
                const idx = Number(htmlEl.getAttribute('data-pdf-idx'))
                const styles = computedMap.get(idx)
                if (styles) {
                  Object.entries(styles).forEach(([prop, val]) => {
                    if (val) htmlEl.style.setProperty(prop, val)
                  })
                }
              })
            },
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
          },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(element)

      const blob: Blob = await worker.output('blob')

      // Clean up temp attributes
      origAll.forEach((el) => (el as HTMLElement).removeAttribute('data-pdf-idx'))

      // 3. Upload to Supabase Storage
      const orgId = await getCurrentOrganizationId()
      if (!orgId) throw new Error('No organization found')

      const filePath = `${orgId}/bookings/${bookingId}/fiche-fonction-v${nextVersion}.pdf`

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, blob, {
          contentType: 'application/pdf',
          upsert: false,
        })

      if (uploadError) throw uploadError

      // 4. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      const fileUrl = publicUrlData.publicUrl

      // 5. Insert documents row
      const { error: insertError } = await supabase.from('documents').insert({
        organization_id: orgId,
        booking_id: bookingId,
        name: `Fiche de fonction v${nextVersion}`,
        file_type: 'application/pdf',
        file_size: blob.size,
        file_path: filePath,
        file_url: fileUrl,
      } as never)

      if (insertError) throw insertError

      // 6. Trigger direct download in the browser
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)

      // 7. Invalidate documents query
      queryClient.invalidateQueries({ queryKey: ['documents', bookingId] })

      toast.success(`Fiche v${nextVersion} enregistrée`)
    } catch (err) {
      console.error('Fiche de fonction PDF export error:', err)
      toast.error("Erreur lors de l'export PDF")
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant='default'
      size='sm'
      className='gap-1.5'
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className='h-4 w-4 animate-spin' />
      ) : (
        <Printer className='h-4 w-4' />
      )}
      Imprimer / Enregistrer en PDF
    </Button>
  )
}
