import { useEffect, useState } from 'react'
import { Mail, Loader2, Unplug, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  useGmailStatus,
  useGmailAuthUrl,
  useDisconnectGmail,
} from '../../hooks/use-gmail-account'

export function GmailSettings() {
  const [showDisconnect, setShowDisconnect] = useState(false)
  const { data: status, isLoading } = useGmailStatus()
  const { mutateAsync: getAuthUrl, isPending: authPending } = useGmailAuthUrl()
  const { mutateAsync: disconnect, isPending: disconnectPending } =
    useDisconnectGmail()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmail_connected') === 'true') {
      toast.success('Compte Gmail connecté.')
      const url = new URL(window.location.href)
      url.searchParams.delete('gmail_connected')
      window.history.replaceState({}, '', url.toString())
    }
    if (params.get('gmail_error')) {
      toast.error(`Erreur de connexion Gmail : ${params.get('gmail_error')}`)
      const url = new URL(window.location.href)
      url.searchParams.delete('gmail_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleConnect = async () => {
    try {
      const { url } = await getAuthUrl()
      window.location.href = url
    } catch {
      toast.error('Impossible de générer le lien de connexion.')
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      toast.success('Compte Gmail déconnecté.')
    } catch {
      toast.error('Erreur lors de la déconnexion.')
    } finally {
      setShowDisconnect(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <Mail className='h-5 w-5' />
          <CardTitle>Gmail</CardTitle>
        </div>
        <CardDescription>
          Connectez votre boîte Gmail pour envoyer devis et factures depuis
          votre adresse et suivre les réponses des clients.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className='flex items-center justify-center py-6'>
            <Loader2 className='h-5 w-5 animate-spin text-muted-foreground' />
          </div>
        ) : status?.connected ? (
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <CheckCircle2 className='h-5 w-5 text-green-600' />
              <div>
                <p className='text-sm font-medium'>{status.email}</p>
                <Badge variant='secondary' className='mt-1'>
                  Connecté
                </Badge>
              </div>
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowDisconnect(true)}
              disabled={disconnectPending}
              className='gap-2'
            >
              <Unplug className='h-4 w-4' />
              Déconnecter
            </Button>
          </div>
        ) : status?.status === 'revoked' ? (
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <AlertCircle className='h-5 w-5 text-amber-600' />
              <p className='text-sm'>
                Connexion expirée. Reconnectez votre compte Gmail.
              </p>
            </div>
            <Button size='sm' onClick={handleConnect} disabled={authPending}>
              Reconnecter
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={authPending}
            className='gap-2'
          >
            {authPending ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Mail className='h-4 w-4' />
            )}
            Connecter mon Gmail
          </Button>
        )}
      </CardContent>

      <AlertDialog open={showDisconnect} onOpenChange={setShowDisconnect}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déconnecter Gmail ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les nouveaux envois repartiront via le système par défaut. Les
              fils déjà envoyés restent visibles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDisconnect}>
              Déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
