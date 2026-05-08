import { useState, type RefObject } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { getCurrentOrganizationId } from '@/lib/get-current-org'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

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
          // Ne pas retourner 'transparent' si le canvas n'a pas pu parser la couleur
          // (ex: oklch non supporté dans fillStyle sur certains Safari) — le texte
          // deviendrait invisible. On retourne la valeur originale : html2canvas
          // utilisera son propre parser ou tombera sur black, qui est mieux que transparent.
          if (d[3] === 0) return color
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
        // overflow + height/max-height intentionally NOT captured: shadcn Card
        // has overflow:hidden and on-screen heights are fixed pixel values that
        // would clip table rows / textarea content when the PDF re-flows.
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
          // grid-template-columns/rows from getComputedStyle are resolved to
          // absolute pixel widths captured at the on-screen container size
          // (e.g. "750px 750px" for grid-cols-2 in a 1500px viewport). When
          // the PDF root is constrained to 794px, these pixel tracks overflow.
          // Convert uniform pixel tracks to "1fr 1fr…" so they adapt.
          if (
            prop === 'grid-template-columns' ||
            prop === 'grid-template-rows'
          ) {
            const tracks = raw.trim().split(/\s+/).filter(Boolean)
            if (tracks.length > 0 && tracks.every((t) => t.endsWith('px'))) {
              styles[prop] = tracks.map(() => '1fr').join(' ')
              return
            }
          }
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
                // Force every element to grow naturally — kills the on-screen
                // height/overflow that was clipping table rows and comments.
                htmlEl.style.overflow = 'visible'
                htmlEl.style.height = 'auto'
                htmlEl.style.maxHeight = 'none'
                htmlEl.style.minHeight = '0'

                // Constrain the root and tables to the printable width so
                // columns don't overflow. A4 (210mm) minus 5mm L/R margins
                // = 200mm ≈ 755px @ 96 DPI.
                if (idx === 0) {
                  htmlEl.style.width = '755px'
                  htmlEl.style.maxWidth = '755px'
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
                // Allow cards to break across pages if their content doesn't
                // fit on one page — but keep table rows + grid pairs together.
                if (htmlEl.tagName === 'TR') {
                  htmlEl.style.pageBreakInside = 'avoid'
                  htmlEl.style.breakInside = 'avoid'
                }
              })
            },
          },
          jsPDF: {
            unit: 'mm',
            format: 'a4',
            orientation: 'portrait',
          },
          // 'css' + 'legacy' only: 'avoid-all' was forcing every card to stay
          // intact, which caused content to be silently truncated when a card
          // (Reste, Commentaires) didn't fit on the remaining page.
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(element)

      const blob: Blob = await worker.output('blob')

      // Clean up temp attributes
      origAll.forEach((el) =>
        (el as HTMLElement).removeAttribute('data-pdf-idx')
      )

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
      // iOS Safari ne supporte pas les blob URL downloads (le fichier s'ouvre dans
      // l'onglet courant plutôt que de se télécharger). On utilise directement l'URL
      // publique Supabase déjà uploadée, qui s'ouvre dans l'aperçu PDF natif iOS.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS) {
        window.open(fileUrl, '_blank')
      } else {
        const downloadUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // Safari macOS initie les téléchargements de façon asynchrone : révoquer
        // l'URL immédiatement annule le téléchargement avant qu'il démarre.
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 300)
      }

      // 7. Invalidate documents query
      queryClient.invalidateQueries({ queryKey: ['documents', bookingId] })

      toast.success(`Fiche v${nextVersion} enregistrée`)
    } catch (err) {
      console.error('Fiche de fonction PDF export error:', err)
      toast.error("Erreur lors de l'export PDF")
    } finally {
      // Nettoyage de sécurité : supprime les attributs data-pdf-idx même si une
      // erreur a interrompu le flux avant le nettoyage normal (après worker.output).
      element.removeAttribute('data-pdf-idx')
      element.querySelectorAll('[data-pdf-idx]').forEach((el) =>
        el.removeAttribute('data-pdf-idx')
      )
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
