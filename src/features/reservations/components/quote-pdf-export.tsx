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

      // Canvas helper: converts any CSS color (incl. oklch/oklab) → rgb().
      // html2canvas bundles an old CSS parser that rejects CSS Color Level 4.
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

      // Pre-fetch & process all page stylesheets BEFORE html2pdf runs.
      // We keep the full CSS (so layout is preserved) but replace the color
      // functions that html2canvas can't parse.
      const cssParts: string[] = []

      document.querySelectorAll('style').forEach((s) => {
        cssParts.push(processCSS(s.textContent || ''))
      })

      const linkUrls = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
      )
        .map((l) => l.href)
        .filter(Boolean)

      for (const url of linkUrls) {
        try {
          const res = await fetch(url)
          const css = await res.text()
          cssParts.push(processCSS(css))
        } catch {
          // skip if unreachable
        }
      }

      const processedCss = cssParts.join('\n')

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
              // Swap out all original stylesheets for the processed (oklch-free) version
              clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => el.remove())
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
        .save()

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
