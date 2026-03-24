import { useState, useEffect } from 'react'
import { CalendarDays, ExternalLink, Loader2, Unplug, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import {
  useGoogleCalendarStatus,
  useGoogleCalendarAuthUrl,
  useGoogleCalendars,
  useSelectGoogleCalendar,
  useDisconnectGoogleCalendar,
} from '../../hooks/use-google-calendar'

type Props = {
  restaurantId: string
}

export function GoogleCalendarSettings({ restaurantId }: Props) {
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false)
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')

  const { data: status, isLoading: statusLoading } = useGoogleCalendarStatus(restaurantId)
  const { mutateAsync: getAuthUrl, isPending: authUrlPending } = useGoogleCalendarAuthUrl(restaurantId)
  const { data: calendarsData, isLoading: calendarsLoading } = useGoogleCalendars(
    restaurantId,
    !!status?.connected && !status?.calendar_id
  )
  const { mutateAsync: selectCalendar, isPending: selectPending } = useSelectGoogleCalendar()
  const { mutateAsync: disconnect, isPending: disconnectPending } = useDisconnectGoogleCalendar()

  // Handle OAuth callback query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gcal_connected') === 'true') {
      toast.success('Compte Google connecté avec succès !')
      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('gcal_connected')
      window.history.replaceState({}, '', url.toString())
    }
    if (params.get('gcal_error')) {
      toast.error(`Erreur de connexion Google Calendar: ${params.get('gcal_error')}`)
      const url = new URL(window.location.href)
      url.searchParams.delete('gcal_error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  const handleConnect = async () => {
    try {
      const { url } = await getAuthUrl()
      window.location.href = url
    } catch {
      toast.error('Erreur lors de la génération du lien de connexion.')
    }
  }

  const handleSelectCalendar = async () => {
    if (!selectedCalendarId) return
    try {
      await selectCalendar({ restaurant_id: restaurantId, calendar_id: selectedCalendarId })
      toast.success('Calendrier sélectionné ! La synchronisation est activée.')
    } catch {
      toast.error('Erreur lors de la sélection du calendrier.')
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect(restaurantId)
      setShowDisconnectDialog(false)
      toast.success('Google Calendar déconnecté.')
    } catch {
      toast.error('Erreur lors de la déconnexion.')
    }
  }

  if (statusLoading) {
    return (
      <Card>
        <CardContent className='flex items-center justify-center py-12'>
          <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-3'>
            <CalendarDays className='h-5 w-5 text-muted-foreground' />
            <div>
              <CardTitle>Google Calendar</CardTitle>
              <CardDescription>
                Synchronisez automatiquement vos événements avec Google Calendar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Not connected */}
          {!status?.connected && (
            <div className='flex flex-col items-center gap-4 py-6'>
              <div className='rounded-full bg-muted p-4'>
                <CalendarDays className='h-8 w-8 text-muted-foreground' />
              </div>
              <div className='text-center'>
                <p className='font-medium'>Aucun compte Google connecté</p>
                <p className='text-sm text-muted-foreground mt-1'>
                  Connectez votre compte Google pour synchroniser les événements automatiquement.
                </p>
              </div>
              <Button onClick={handleConnect} disabled={authUrlPending}>
                {authUrlPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                <ExternalLink className='mr-2 h-4 w-4' />
                Connecter Google Calendar
              </Button>
            </div>
          )}

          {/* Connected but no calendar selected */}
          {status?.connected && !status?.calendar_id && (
            <div className='space-y-4'>
              <div className='flex items-center gap-2'>
                <CheckCircle2 className='h-4 w-4 text-green-600' />
                <span className='text-sm'>
                  Connecté en tant que <strong>{status.email}</strong>
                </span>
              </div>

              <div className='rounded-lg border p-4 space-y-3'>
                <div className='flex items-center gap-2'>
                  <AlertCircle className='h-4 w-4 text-amber-500' />
                  <p className='text-sm font-medium'>Sélectionnez un calendrier</p>
                </div>
                {calendarsLoading ? (
                  <div className='flex items-center gap-2'>
                    <Loader2 className='h-4 w-4 animate-spin' />
                    <span className='text-sm text-muted-foreground'>Chargement des calendriers...</span>
                  </div>
                ) : (
                  <div className='flex gap-2'>
                    <Select value={selectedCalendarId} onValueChange={setSelectedCalendarId}>
                      <SelectTrigger className='flex-1'>
                        <SelectValue placeholder='Choisir un calendrier' />
                      </SelectTrigger>
                      <SelectContent>
                        {calendarsData?.calendars?.map((cal) => (
                          <SelectItem key={cal.id} value={cal.id}>
                            {cal.summary} {cal.primary && '(principal)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleSelectCalendar}
                      disabled={!selectedCalendarId || selectPending}
                    >
                      {selectPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                      Valider
                    </Button>
                  </div>
                )}
              </div>

              <Button
                variant='outline'
                size='sm'
                onClick={() => setShowDisconnectDialog(true)}
                className='text-destructive'
              >
                <Unplug className='mr-2 h-4 w-4' />
                Déconnecter
              </Button>
            </div>
          )}

          {/* Fully connected and syncing */}
          {status?.connected && status?.calendar_id && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <CheckCircle2 className='h-4 w-4 text-green-600' />
                  <span className='text-sm'>
                    Connecté en tant que <strong>{status.email}</strong>
                  </span>
                </div>
                <Badge variant='outline' className='text-green-700 border-green-300 bg-green-50'>
                  Synchronisation active
                </Badge>
              </div>

              <div className='rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground space-y-1'>
                <p>Les événements sont automatiquement synchronisés avec votre Google Calendar :</p>
                <ul className='list-disc list-inside ml-2 space-y-0.5'>
                  <li>Création d'un événement = ajout au calendrier</li>
                  <li>Modification = mise à jour du calendrier</li>
                  <li>Suppression = suppression du calendrier</li>
                </ul>
              </div>

              <Button
                variant='outline'
                size='sm'
                onClick={() => setShowDisconnectDialog(true)}
                className='text-destructive'
              >
                <Unplug className='mr-2 h-4 w-4' />
                Déconnecter Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déconnecter Google Calendar</AlertDialogTitle>
            <AlertDialogDescription>
              La synchronisation sera arrêtée. Les événements déjà créés dans Google Calendar ne seront pas supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              disabled={disconnectPending}
            >
              {disconnectPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Déconnecter
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
