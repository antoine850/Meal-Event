import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'

type Props = {
  bookingId: string
  // Sauvegarde la note de facturation en cours d'édition avant génération
  flushNotes: () => Promise<void>
}

export function FicheFonctionPdfButton({ bookingId, flushNotes }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const queryClient = useQueryClient()

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await flushNotes()

      const { fileUrl, fileName, version } = await apiClient<{
        fileUrl: string
        fileName: string
        version: number
      }>(`/api/bookings/${bookingId}/fiche-fonction-pdf`, { method: 'POST' })

      // Le document est déjà créé côté backend : la liste doit le refléter
      // même si le téléchargement échoue ensuite.
      queryClient.invalidateQueries({ queryKey: ['documents', bookingId] })

      // iOS Safari ne supporte pas les blob URL downloads (le fichier s'ouvre dans
      // l'onglet courant plutôt que de se télécharger). On ouvre directement l'URL
      // publique Supabase, qui s'affiche dans l'aperçu PDF natif iOS.
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      if (isIOS) {
        const win = window.open(fileUrl, '_blank')
        // Popup bloquée après les awaits : on navigue dans l'onglet courant.
        if (!win) window.location.assign(fileUrl)
      } else {
        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error('Erreur serveur')
        const blob = await response.blob()
        const downloadUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        // Safari macOS initie les téléchargements de façon asynchrone : révoquer
        // l'URL immédiatement annule le téléchargement avant qu'il démarre.
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 300)
      }

      toast.success(`Fiche v${version} enregistrée`)
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
