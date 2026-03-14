import { useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Trash2,
  Loader2,
  ChefHat,
  Plus,
  Building2,
  FileText,
  Edit,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useAllMenuForms,
  useCreateMenuForm,
  useUpdateMenuForm,
  useDeleteMenuForm,
  type MenuFormWithFields,
} from '@/features/reservations/hooks/use-menu-forms'
import { useRestaurants } from '@/features/settings/hooks/use-settings'

export function MenusPage() {
  const navigate = useNavigate()
  const { data: menuForms = [], isLoading } = useAllMenuForms()
  const { mutate: deleteMenuForm, isPending: isDeleting } = useDeleteMenuForm()

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState<MenuFormWithBooking | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const openDeleteDialog = (form: MenuFormWithBooking) => {
    setSelectedForm(form)
    setDeleteDialogOpen(true)
  }

  const handleDelete = () => {
    if (!selectedForm) return
    deleteMenuForm(selectedForm.id, {
      onSuccess: () => {
        toast.success('Formulaire supprimé')
        setDeleteDialogOpen(false)
        setSelectedForm(null)
      },
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }

  const copyShareLink = (token: string) => {
    const url = `${window.location.origin}/menu-form/${token}`
    navigator.clipboard.writeText(url)
    toast.success('Lien copié !')
  }

  const goToBooking = (bookingId: string, openMenuTab = false) => {
    navigate({ 
      to: '/evenements/booking/$id', 
      params: { id: bookingId },
      search: openMenuTab ? { tab: 'menu' } : undefined
    })
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    draft: { label: 'Brouillon', color: 'bg-gray-500' },
    shared: { label: 'Partagé', color: 'bg-blue-500' },
    submitted: { label: 'Soumis', color: 'bg-green-500' },
    locked: { label: 'Verrouillé', color: 'bg-gray-700' },
  }

  const filteredForms = statusFilter === 'all' 
    ? menuForms 
    : menuForms.filter(f => f.status === statusFilter)

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <div className='space-y-6 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>Formulaires de menu</h2>
          <p className='text-muted-foreground'>
            Tous les formulaires de menu créés pour vos événements.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='w-[150px]'>
              <SelectValue placeholder='Filtrer par statut' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Tous</SelectItem>
              <SelectItem value='draft'>Brouillon</SelectItem>
              <SelectItem value='shared'>Partagé</SelectItem>
              <SelectItem value='submitted'>Soumis</SelectItem>
              <SelectItem value='locked'>Verrouillé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className='grid gap-4 md:grid-cols-4'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-muted rounded-lg'>
                <FileText className='h-5 w-5 text-muted-foreground' />
              </div>
              <div>
                <p className='text-2xl font-bold'>{menuForms.length}</p>
                <p className='text-xs text-muted-foreground'>Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg'>
                <LinkIcon className='h-5 w-5 text-blue-600 dark:text-blue-400' />
              </div>
              <div>
                <p className='text-2xl font-bold'>{menuForms.filter(f => f.status === 'shared').length}</p>
                <p className='text-xs text-muted-foreground'>Partagés</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-green-100 dark:bg-green-900/30 rounded-lg'>
                <ChefHat className='h-5 w-5 text-green-600 dark:text-green-400' />
              </div>
              <div>
                <p className='text-2xl font-bold'>{menuForms.filter(f => f.status === 'submitted').length}</p>
                <p className='text-xs text-muted-foreground'>Soumis</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg'>
                <Users className='h-5 w-5 text-amber-600 dark:text-amber-400' />
              </div>
              <div>
                <p className='text-2xl font-bold'>{menuForms.reduce((acc, f) => acc + f.guests_count, 0)}</p>
                <p className='text-xs text-muted-foreground'>Convives total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* List */}
      {filteredForms.length === 0 ? (
        <Card className='border-dashed'>
          <CardContent className='py-12 text-center'>
            <ChefHat className='mx-auto h-12 w-12 text-muted-foreground/40' />
            <h3 className='mt-4 text-lg font-semibold'>
              {statusFilter === 'all' ? 'Aucun formulaire de menu' : `Aucun formulaire "${statusMap[statusFilter]?.label}"`}
            </h3>
            <p className='mt-2 text-sm text-muted-foreground'>
              Les formulaires de menu sont créés depuis la page d'un événement, dans l'onglet "Menu".
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Formulaire</TableHead>
                <TableHead>Événement</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Convives</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredForms.map((form) => {
                const st = statusMap[form.status] || statusMap.draft
                const booking = form.bookings
                const contact = booking?.contacts
                const restaurant = form.restaurants

                return (
                  <TableRow key={form.id}>
                    <TableCell>
                      <div className='space-y-1'>
                        <div className='font-medium'>{form.title}</div>
                        <div className='text-xs text-muted-foreground'>
                          {form.menu_form_fields?.length || 0} champ{(form.menu_form_fields?.length || 0) > 1 ? 's' : ''}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {booking && contact ? (
                        <button
                          onClick={() => goToBooking(booking.id)}
                          className='text-left hover:underline'
                        >
                          <div className='font-medium text-sm'>
                            {contact.first_name} {contact.last_name}
                          </div>
                          {booking.occasion && (
                            <div className='text-xs text-muted-foreground'>{booking.occasion}</div>
                          )}
                        </button>
                      ) : (
                        <span className='text-muted-foreground text-sm'>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {restaurant ? (
                        <div className='flex items-center gap-1 text-sm'>
                          <Building2 className='h-3 w-3 text-muted-foreground' />
                          {restaurant.name}
                        </div>
                      ) : (
                        <span className='text-muted-foreground text-sm'>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {booking?.event_date ? (
                        <div className='flex items-center gap-1 text-sm'>
                          <Calendar className='h-3 w-3 text-muted-foreground' />
                          {format(new Date(booking.event_date), 'dd MMM yyyy', { locale: fr })}
                        </div>
                      ) : (
                        <span className='text-muted-foreground text-sm'>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className='flex items-center gap-1 text-sm'>
                        <Users className='h-3 w-3 text-muted-foreground' />
                        {form.guests_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${st.color} text-white text-[10px]`}>{st.label}</Badge>
                      {form.submitted_at && (
                        <div className='text-[10px] text-muted-foreground mt-1'>
                          {format(new Date(form.submitted_at), 'dd/MM/yyyy', { locale: fr })}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-1'>
                        {booking && (
                          <>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-8 w-8 p-0'
                              title='Éditer le formulaire'
                              onClick={() => goToBooking(booking.id, true)}
                            >
                              <Edit className='h-4 w-4' />
                            </Button>
                            <Button
                              variant='ghost'
                              size='sm'
                              className='h-8 w-8 p-0'
                              title="Voir l'événement"
                              onClick={() => goToBooking(booking.id)}
                            >
                              <Eye className='h-4 w-4' />
                            </Button>
                          </>
                        )}
                        {form.share_token && (form.status === 'shared' || form.status === 'submitted') && (
                          <Button
                            variant='ghost'
                            size='sm'
                            className='h-8 w-8 p-0'
                            title='Copier le lien'
                            onClick={() => copyShareLink(form.share_token!)}
                          >
                            <ExternalLink className='h-4 w-4' />
                          </Button>
                        )}
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0 text-destructive hover:text-destructive'
                          title='Supprimer'
                          onClick={() => openDeleteDialog(form as MenuFormWithBooking)}
                        >
                          <Trash2 className='h-4 w-4' />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce formulaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le formulaire "{selectedForm?.title}" et toutes ses réponses seront supprimés.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
