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

      // 2. Generate PDF blob.
      // Same oklch workaround as quote-pdf-export.tsx, BUT we also capture
      // layout properties (padding, border, font, etc.) because the fiche
      // uses pure Tailwind classes (cards, grids) that vanish when we strip
      // the stylesheets in the clone — unlike the devis which has inline styles.
      const html2pdf = (await import('html2pdf.js')).default

      // Canvas-based color converter — Chrome 111+ returns oklch() from
      // getComputedStyle for Tailwind v4 colors; html2canvas can't parse them.
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

      const colorProps = new Set([
        'color',
        'background-color',
        'border-top-color',
        'border-right-color',
        'border-bottom-color',
        'border-left-color',
        'outline-color',
        'text-decoration-color',
      ])

      const layoutProps = [
        // Display & flow
        'display',
        'box-sizing',
        'position',
        'top',
        'right',
        'bottom',
        'left',
        'z-index',
        'float',
        'clear',
        'visibility',
        'overflow',
        'overflow-x',
        'overflow-y',
        // Sizing — width/min-width intentionally NOT captured so the cloned
        // content fits the page rather than its on-screen pixel width.
        'height',
        'max-height',
        // Spacing
        'margin-top',
        'margin-right',
        'margin-bottom',
        'margin-left',
        'padding-top',
        'padding-right',
        'padding-bottom',
        'padding-left',
        // Flex / grid
        'flex-direction',
        'flex-wrap',
        'flex-grow',
        'flex-shrink',
        'flex-basis',
        'align-items',
        'align-self',
        'justify-content',
        'justify-self',
        'gap',
        'column-gap',
        'row-gap',
        'grid-template-columns',
        'grid-template-rows',
        'grid-column',
        'grid-row',
        // Borders
        'border-top-width',
        'border-right-width',
        'border-bottom-width',
        'border-left-width',
        'border-top-style',
        'border-right-style',
        'border-bottom-style',
        'border-left-style',
        'border-top-left-radius',
        'border-top-right-radius',
        'border-bottom-left-radius',
        'border-bottom-right-radius',
        // Background
        'background-image',
        'background-repeat',
        'background-position',
        'background-size',
        // Typography
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'line-height',
        'letter-spacing',
        'text-align',
        'text-decoration-line',
        'text-transform',
        'white-space',
        'word-break',
        'overflow-wrap',
        'vertical-align',
        // Tables
        'table-layout',
        'border-collapse',
        'border-spacing',
        // Misc
        'opacity',
        'box-shadow',
      ]

      const allProps = [...colorProps, ...layoutProps]

      const origAll = [element, ...Array.from(element.querySelectorAll('*'))]
      const computedMap: Map<number, Record<string, string>> = new Map()

      origAll.forEach((el, idx) => {
        ;(el as HTMLElement).setAttribute('data-pdf-idx', String(idx))
        const computed = window.getComputedStyle(el)
        const styles: Record<string, string> = {}
        allProps.forEach((prop) => {
          const raw = computed.getPropertyValue(prop)
          if (!raw) return
          // Force a safe font stack — captured Tailwind fonts (Inter, ui-sans-serif…)
          // render with collapsed spaces in html2canvas.
          if (prop === 'font-family') {
            styles[prop] = 'Helvetica, Arial, sans-serif'
            return
          }
          // Drop letter/word spacing — html2canvas can compound them to negative.
          if (prop === 'letter-spacing' || prop === 'word-spacing') return
          styles[prop] = colorProps.has(prop) ? colorToRgb(raw) : raw
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
                // Constrain the root and tables to the page width so columns
                // don't overflow (the on-screen table has horizontal scroll).
                if (idx === 0) {
                  htmlEl.style.width = '794px'
                  htmlEl.style.maxWidth = '794px'
                }
                if (htmlEl.tagName === 'TABLE') {
                  htmlEl.style.minWidth = '0'
                  htmlEl.style.width = '100%'
                  htmlEl.style.tableLayout = 'fixed'
                }
                // Allow long words inside cells to wrap.
                if (htmlEl.tagName === 'TD' || htmlEl.tagName === 'TH') {
                  htmlEl.style.wordBreak = 'break-word'
                  htmlEl.style.overflowWrap = 'break-word'
                  htmlEl.style.whiteSpace = 'normal'
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
