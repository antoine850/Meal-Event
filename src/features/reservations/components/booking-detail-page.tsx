import { useState, useRef, useEffect } from 'react'
import { useParams, Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  CalendarIcon,
  Receipt,
  FileText,
  History,
  Save,
  Trash2,
  UtensilsCrossed,
  ClipboardList,
  Mail,
} from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { useEmailLogsByBooking } from '@/features/emails/hooks/use-email-logs'
import { useThreadMeta } from '@/features/emails/hooks/use-thread-unread'
import {
  useBooking,
  useQuotesByBooking,
  usePaymentsByBooking,
  useMarkBookingAsRead,
} from '../hooks/use-bookings'
import { useDocumentsByBooking } from '../hooks/use-documents'
import { useBookingMenuForms } from '../hooks/use-menu-forms'
import { BookingDetail } from './booking-detail'

export function BookingDetailPage() {
  const { id } = useParams({ strict: false }) as { id: string }
  const initialTab = (() => {
    if (typeof window === 'undefined') return 'evenementiel'
    const p = new URLSearchParams(window.location.search)
    return p.get('tab') || 'evenementiel'
  })()
  const { data: booking, isLoading } = useBooking(id)
  const { data: quotes = [] } = useQuotesByBooking(id)
  const { data: payments = [] } = usePaymentsByBooking(id)
  const { data: documents = [] } = useDocumentsByBooking(id)
  const { data: menuForms = [] } = useBookingMenuForms(id)
  const { data: emailLogs = [] } = useEmailLogsByBooking(id)
  const { data: threadMeta } = useThreadMeta(id)
  const markAsRead = useMarkBookingAsRead()
  const [activeTab, setActiveTab] = useState(initialTab)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const bookingDetailRef = useRef<{
    submitForm: () => void
    deleteBooking: () => void
    getIsDirty: () => boolean
  } | null>(null)

  const changeTab = (tab: string) => {
    setActiveTab(tab)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('tab', tab)
      window.history.replaceState(null, '', url.toString())
    }
  }

  // Mark booking as read when opened
  useEffect(() => {
    if (booking && !booking.read_at) {
      markAsRead.mutate(id)
    }
  }, [booking?.id])

  if (isLoading) {
    return (
      <div className='flex h-full flex-col'>
        <Header fixed>
          <div className='flex flex-1 items-center gap-4'>
            <Skeleton className='h-9 w-28' />
            <Skeleton className='h-9 w-[320px]' />
          </div>
          <div className='ms-auto flex items-center space-x-2'>
            <Skeleton className='h-9 w-24' />
            <Skeleton className='h-9 w-9' />
            <div className='ml-4 flex items-center space-x-4 border-l pl-4'>
              <Skeleton className='h-8 w-8 rounded-full' />
              <Skeleton className='h-8 w-8 rounded-full' />
            </div>
          </div>
        </Header>
        <Main className='flex flex-1 flex-col gap-4 p-6'>
          <div className='grid gap-4 md:grid-cols-3'>
            <Skeleton className='col-span-1 h-36 rounded-lg' />
            <Skeleton className='col-span-2 h-36 rounded-lg' />
          </div>
          <div className='grid gap-4 md:grid-cols-2'>
            <Skeleton className='h-64 rounded-lg' />
            <Skeleton className='h-64 rounded-lg' />
          </div>
          <Skeleton className='h-72 rounded-lg' />
        </Main>
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

  return (
    <>
      <Header fixed>
        <div className='flex flex-1 items-center gap-4'>
          <Button
            variant='ghost'
            size='sm'
            className='gap-2'
            onClick={() => window.history.back()}
          >
            <ArrowLeft className='h-4 w-4' />
            Événements
          </Button>
          <Tabs value={activeTab} onValueChange={changeTab}>
            <TabsList className='grid w-fit grid-cols-7'>
              <TabsTrigger value='evenementiel' className='gap-1.5'>
                <CalendarIcon className='h-4 w-4' />
                Événementiel
              </TabsTrigger>
              <TabsTrigger value='facturation' className='gap-1.5'>
                <Receipt className='h-4 w-4' />
                Facturation
                {quotes.length + payments.length > 0 && (
                  <Badge
                    variant='secondary'
                    className='ml-1 h-5 px-1.5 text-[10px]'
                  >
                    {quotes.length + payments.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value='fichiers' className='gap-1.5'>
                <FileText className='h-4 w-4' />
                Fichiers
                {documents.length > 0 && (
                  <Badge
                    variant='secondary'
                    className='ml-1 h-5 px-1.5 text-[10px]'
                  >
                    {documents.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value='menu' className='gap-1.5'>
                <UtensilsCrossed className='h-4 w-4' />
                Menu
                {menuForms.length > 0 && (
                  <Badge
                    variant='secondary'
                    className='ml-1 h-5 px-1.5 text-[10px]'
                  >
                    {menuForms.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value='fiche-fonction' className='gap-1.5'>
                <ClipboardList className='h-4 w-4' />
                Fiche
              </TabsTrigger>
              <TabsTrigger value='emails' className='gap-1.5'>
                <Mail className='h-4 w-4' />
                Emails
                {emailLogs.length > 0 && (
                  <Badge
                    variant='secondary'
                    className='ml-1 h-5 px-1.5 text-[10px]'
                  >
                    {emailLogs.length}
                  </Badge>
                )}
                {threadMeta?.unread && (
                  <span
                    className='h-1.5 w-1.5 rounded-full bg-red-500'
                    aria-label='Non lu'
                  />
                )}
              </TabsTrigger>
              <TabsTrigger value='historique' className='gap-1.5'>
                <History className='h-4 w-4' />
                Historique
                <Badge
                  variant='secondary'
                  className='ml-1 h-5 px-1.5 text-[10px]'
                >
                  0
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className='ms-auto flex items-center space-x-2'>
          <Button
            size='sm'
            onClick={() => bookingDetailRef.current?.submitForm()}
            disabled={!isDirty}
            className='gap-2'
          >
            <Save className='h-4 w-4' />
            Enregistrer
          </Button>
          <Button
            size='icon'
            variant='ghost'
            onClick={() => setShowDeleteDialog(true)}
            className='h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive'
          >
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
            <AlertDialogAction
              onClick={() => bookingDetailRef.current?.deleteBooking()}
              className='text-destructive-foreground bg-destructive hover:bg-destructive/90'
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Main className='flex flex-1 flex-col'>
        <BookingDetail
          booking={booking}
          activeTab={activeTab}
          onTabChange={changeTab}
          ref={bookingDetailRef}
          onDirtyChange={setIsDirty}
        />
      </Main>
    </>
  )
}
