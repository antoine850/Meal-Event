import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

type Props = {
  quoteNumber: string
}

export function QuotePdfExportButton({ quoteNumber }: Props) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async () => {
    const element = document.getElementById('quote-preview-content')
    if (!element) {
      toast.error('Aperçu non disponible')
      return
    }

    setIsExporting(true)
    try {
      const html2pdf = (await import('html2pdf.js')).default

      // Pre-compute all RGB colors from the original DOM.
      // Chrome 111+ returns oklch()/oklab() from getComputedStyle for Tailwind v4
      // colors, but html2canvas can't parse them — convert via canvas first.
      const colorProps = [
        'color', 'background-color', 'border-color',
        'border-left-color', 'border-right-color',
        'border-top-color', 'border-bottom-color',
      ]

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

      // Tag every element with a unique index so we can map original→clone
      const origAll = [element, ...Array.from(element.querySelectorAll('*'))]
      const computedMap: Map<number, Record<string, string>> = new Map()

      origAll.forEach((el, idx) => {
        (el as HTMLElement).setAttribute('data-pdf-idx', String(idx))
        const computed = window.getComputedStyle(el)
        const styles: Record<string, string> = {}
        colorProps.forEach(prop => {
          styles[prop] = colorToRgb(computed.getPropertyValue(prop))
        })
        computedMap.set(idx, styles)
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (html2pdf() as any)
        .set({
          margin: [5, 5, 10, 5],
          filename: `${quoteNumber || 'devis'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            letterRendering: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc: Document) => {
              // Remove all stylesheets from clone so html2canvas won't parse oklch
              clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove())

              // Apply pre-computed RGB styles to cloned elements
              const clonedAll = clonedDoc.querySelectorAll('[data-pdf-idx]')
              clonedAll.forEach(el => {
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
        .save()

      // Clean up data attributes
      origAll.forEach(el => (el as HTMLElement).removeAttribute('data-pdf-idx'))

      toast.success('PDF téléchargé')
    } catch (err) {
      console.error('PDF export error:', err)
      toast.error('Erreur lors de l\'export PDF')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant='outline'
      size='sm'
      className='gap-1.5 text-xs h-7'
      onClick={handleExport}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className='h-3 w-3 animate-spin' />
      ) : (
        <Download className='h-3 w-3' />
      )}
      Télécharger PDF
    </Button>
  )
}
