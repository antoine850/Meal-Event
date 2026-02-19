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
