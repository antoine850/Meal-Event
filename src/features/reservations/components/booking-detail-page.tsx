import { useState, useRef } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, CalendarIcon, Receipt, FileText, History, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
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
import { useBooking } from '../hooks/use-bookings'
import { BookingDetail } from './booking-detail'

export function BookingDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const { data: booking, isLoading } = useBooking(id)
  const [activeTab, setActiveTab] = useState('evenementiel')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const bookingDetailRef = useRef<{ submitForm: () => void; deleteBooking: () => void; getIsDirty: () => boolean } | null>(null)

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!booking) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-4'>
        <p className='text-muted-foreground'>Événement introuvable</p>
        <Button asChild variant='outline'>
          <Link to='/evenements'>Retour aux événements</Link>
        </Button>
      </div>
    )
  }

  const bookingEvents = booking?.booking_events || []

  return (
    <>
      <Header fixed>
        <div className='flex items-center gap-4 flex-1'>
          <Button variant='ghost' size='sm' asChild className='gap-2'>
            <Link to='/evenements'>
              <ArrowLeft className='h-4 w-4' />
              Événements
            </Link>
          </Button>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className='grid w-fit grid-cols-4'>
              <TabsTrigger value='evenementiel' className='gap-1.5'>
                <CalendarIcon className='h-4 w-4' />
                Événementiel
                <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-[10px]'>{bookingEvents.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value='facturation' className='gap-1.5'>
                <Receipt className='h-4 w-4' />
                Facturation
                <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-[10px]'>0</Badge>
              </TabsTrigger>
              <TabsTrigger value='fichiers' className='gap-1.5'>
                <FileText className='h-4 w-4' />
                Fichiers
                <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-[10px]'>0</Badge>
              </TabsTrigger>
              <TabsTrigger value='historique' className='gap-1.5'>
                <History className='h-4 w-4' />
                Historique
                <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-[10px]'>0</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className='ms-auto flex items-center space-x-2'>
          {isDirty && (
            <Button size='sm' onClick={() => bookingDetailRef.current?.submitForm()} className='gap-2'>
              <Save className='h-4 w-4' />
              Enregistrer
            </Button>
          )}
          <Button size='icon' variant='ghost' onClick={() => setShowDeleteDialog(true)} className='h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10'>
            <Trash2 className='h-4 w-4' />
          </Button>
          <div className='ml-4 flex items-center space-x-4 border-l pl-4'>
            <ThemeSwitch />
            <ProfileDropdown />
          </div>
        </div>
      </Header>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'événement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => bookingDetailRef.current?.deleteBooking()} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Main className='flex flex-1 flex-col'>
        <BookingDetail booking={booking} activeTab={activeTab} ref={bookingDetailRef} onDirtyChange={setIsDirty} />
      </Main>
    </>
  )
}
