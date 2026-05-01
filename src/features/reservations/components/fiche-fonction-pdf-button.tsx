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

      // 2. Canvas helper: converts any CSS color (incl. oklch/oklab) → rgb().
      //    html2canvas bundles an old CSS parser that rejects CSS Color Level 4.
      const convCanvas = document.createElement('canvas')
      convCanvas.width = convCanvas.height = 1
      const convCtx = convCanvas.getContext('2d', { willReadFrequently: true })
      const colorToRgb = (color: string): string => {
        if (!color || !convCtx) return color
        try {
          convCtx.clearRect(0, 0, 1, 1)
          convCtx.fillStyle = color
          convCtx.fillRect(0, 0, 1, 1)
          const d = convCtx.getImageData(0, 0, 1, 1).data
          if (d[3] === 0) return 'transparent'
          return d[3] < 255
            ? `rgba(${d[0]},${d[1]},${d[2]},${(d[3] / 255).toFixed(3)})`
            : `rgb(${d[0]},${d[1]},${d[2]})`
        } catch {
          return color
        }
      }

      // Replace all oklch()/oklab() occurrences in a CSS string with rgb().
      const processCSS = (css: string): string =>
        css.replace(/ok(?:lch|lab)\([^)]*\)/gi, (m) => colorToRgb(m))

      // 3. Collect CSS via document.styleSheets — captures <style> elements AND
      //    adopted stylesheets (Tailwind v4 + Vite injects via the latter in dev mode).
      const cssParts: string[] = []
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          const rules = Array.from(sheet.cssRules || [])
            .map((r) => r.cssText)
            .join('\n')
          if (rules) cssParts.push(processCSS(rules))
        } catch {
          // SecurityError for cross-origin sheets — skip
        }
      })
      const processedCss = cssParts.join('\n')

      // 4. Generate PDF blob
      const html2pdf = (await import('html2pdf.js')).default

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
              // Remove all original stylesheets (style elements + link + adopted)
              clonedDoc
                .querySelectorAll('style, link[rel="stylesheet"]')
                .forEach((el) => el.remove())
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(clonedDoc as any).adoptedStyleSheets = []
              // Re-inject the processed (oklch-free) CSS so layout is preserved
              const styleEl = clonedDoc.createElement('style')
              styleEl.textContent = processedCss
              clonedDoc.head.appendChild(styleEl)
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

      // 5. Upload to Supabase Storage
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

      // 6. Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath)

      const fileUrl = publicUrlData.publicUrl

      // 7. Insert documents row
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

      // 8. Trigger direct download in the browser
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)

      // 9. Invalidate documents query
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
