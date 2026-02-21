import { useState, useRef } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, User, Calendar, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ContactDetail } from './contact-detail'
import { useContact } from '../hooks/use-contacts'
import { useBookingsByContact } from '@/features/reservations/hooks/use-bookings'

export function ContactDetailPage() {
  const { id } = useParams({ from: '/_authenticated/contacts/contact/$id' })
  const { data: contact, isLoading } = useContact(id)
  const { data: bookings = [] } = useBookingsByContact(id)
  const [activeTab, setActiveTab] = useState('general')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const contactDetailRef = useRef<{ submitForm: () => void; deleteContact: () => void } | null>(null)

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!contact) {
    return (
      <>
        <Header fixed>
          <h1 className='text-lg font-semibold'>Contact non trouvé</h1>
        </Header>
        <Main className='flex flex-1 flex-col items-center justify-center'>
          <p className='text-muted-foreground'>Ce contact n'existe pas ou a été supprimé.</p>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header fixed>
        <div className='flex items-center gap-4 flex-1'>
          <Button variant='ghost' size='sm' asChild className='gap-2'>
            <Link to='/contacts'>
              <ArrowLeft className='h-4 w-4' />
              Contacts
            </Link>
          </Button>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className='grid w-fit grid-cols-2'>
              <TabsTrigger value='general' className='gap-1.5'>
                <User className='h-4 w-4' />
                Général
              </TabsTrigger>
              <TabsTrigger value='reservations' className='gap-1.5'>
                <Calendar className='h-4 w-4' />
                Réservations
                {bookings.length > 0 && <Badge variant='secondary' className='ml-1 h-5 px-1.5 text-[10px]'>{bookings.length}</Badge>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className='ms-auto flex items-center space-x-2'>
          <Button size='sm' onClick={() => contactDetailRef.current?.submitForm()} disabled={!isDirty} className='gap-2'>
            <Save className='h-4 w-4' />
            Enregistrer
          </Button>
          <Button size='icon' variant='ghost' onClick={() => setShowDeleteDialog(true)} className='h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10'>
            <Trash2 className='h-4 w-4' />
          </Button>
          <div className='ml-4 flex items-center space-x-4 border-l pl-4'>
            <ThemeSwitch />
            <ConfigDrawer />
            <ProfileDropdown />
          </div>
        </div>
      </Header>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce contact ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => contactDetailRef.current?.deleteContact()} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Main className='flex flex-1 flex-col'>
        <ContactDetail contact={contact} activeTab={activeTab} ref={contactDetailRef} onDirtyChange={setIsDirty} />
      </Main>
    </>
  )
}
