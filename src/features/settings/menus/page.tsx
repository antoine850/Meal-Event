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
import { MenuFormBuilder } from '@/features/reservations/components/menu-form-builder'

export function MenusPage() {
  const { data: menuForms = [], isLoading } = useAllMenuForms()
  const { data: restaurants = [] } = useRestaurants()
  const { mutate: createMenuForm, isPending: isCreating } = useCreateMenuForm()
  const { mutate: updateMenuForm, isPending: isUpdating } = useUpdateMenuForm()
  const { mutate: deleteMenuForm, isPending: isDeleting } = useDeleteMenuForm()

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedForm, setSelectedForm] = useState<MenuFormWithFields | null>(null)

  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formRestaurantId, setFormRestaurantId] = useState<string>('')

  // Filter
  const [restaurantFilter, setRestaurantFilter] = useState<string>('all')

  // Form builder state
  const [formBuilderOpen, setFormBuilderOpen] = useState(false)
  const [editingFormId, setEditingFormId] = useState<string | null>(null)

  const resetFormState = () => {
    setFormTitle('')
    setFormDescription('')
    setFormRestaurantId('__all__')
  }

  const openCreateDialog = () => {
    resetFormState()
    setCreateDialogOpen(true)
  }

  const openEditDialog = (form: MenuFormWithFields) => {
    setSelectedForm(form)
    setFormTitle(form.title)
    setFormDescription(form.description || '')
    setFormRestaurantId(form.restaurant_id || '__all__')
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (form: MenuFormWithFields) => {
    setSelectedForm(form)
    setDeleteDialogOpen(true)
  }

  const handleCreate = () => {
    if (!formTitle.trim()) {
      toast.error('Le titre est requis')
      return
    }
    createMenuForm({
      title: formTitle.trim(),
      description: formDescription.trim() || undefined,
      restaurantId: formRestaurantId === '__all__' ? null : (formRestaurantId || null),
    }, {
      onSuccess: () => {
        toast.success('Formulaire créé')
        setCreateDialogOpen(false)
        resetFormState()
      },
      onError: () => toast.error('Erreur lors de la création'),
    })
  }

  const handleUpdate = () => {
    if (!selectedForm || !formTitle.trim()) return
    updateMenuForm({
      id: selectedForm.id,
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      restaurant_id: formRestaurantId === '__all__' ? null : (formRestaurantId || null),
    }, {
      onSuccess: () => {
        toast.success('Formulaire mis à jour')
        setEditDialogOpen(false)
        setSelectedForm(null)
        resetFormState()
      },
      onError: () => toast.error('Erreur lors de la mise à jour'),
    })
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

  const filteredForms = restaurantFilter === 'all'
    ? menuForms
    : menuForms.filter(f => f.restaurant_id === restaurantFilter)

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
            Créez des formulaires réutilisables pour collecter les choix de menu de vos clients.
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
            <SelectTrigger className='w-[180px]'>
              <SelectValue placeholder='Filtrer par restaurant' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='all'>Tous les restaurants</SelectItem>
              {restaurants.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreateDialog}>
            <Plus className='h-4 w-4 mr-2' />
            Nouveau formulaire
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-muted rounded-lg'>
                <FileText className='h-5 w-5 text-muted-foreground' />
              </div>
              <div>
                <p className='text-2xl font-bold'>{menuForms.length}</p>
                <p className='text-xs text-muted-foreground'>Formulaires</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-3'>
              <div className='p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg'>
                <Building2 className='h-5 w-5 text-blue-600 dark:text-blue-400' />
              </div>
              <div>
                <p className='text-2xl font-bold'>
                  {new Set(menuForms.filter(f => f.restaurant_id).map(f => f.restaurant_id)).size}
                </p>
                <p className='text-xs text-muted-foreground'>Restaurants</p>
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
                <p className='text-2xl font-bold'>
                  {menuForms.reduce((acc, f) => acc + (f.menu_form_fields?.length || 0), 0)}
                </p>
                <p className='text-xs text-muted-foreground'>Champs total</p>
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
            <h3 className='mt-4 text-lg font-semibold'>Aucun formulaire de menu</h3>
            <p className='mt-2 text-sm text-muted-foreground'>
              Créez un formulaire pour commencer à collecter les choix de menu.
            </p>
            <Button className='mt-4' onClick={openCreateDialog}>
              <Plus className='h-4 w-4 mr-2' />
              Créer un formulaire
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Formulaire</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Champs</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className='text-right'>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredForms.map((form) => {
                const restaurant = form.restaurants

                return (
                  <TableRow key={form.id}>
                    <TableCell>
                      <div className='space-y-1'>
                        <div className='font-medium'>{form.title}</div>
                        {form.description && (
                          <div className='text-xs text-muted-foreground line-clamp-1'>
                            {form.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {restaurant ? (
                        <div className='flex items-center gap-1 text-sm'>
                          <Building2 className='h-3 w-3 text-muted-foreground' />
                          {restaurant.name}
                        </div>
                      ) : (
                        <span className='text-muted-foreground text-sm'>Tous</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className='text-sm'>
                        {form.menu_form_fields?.length || 0} champ{(form.menu_form_fields?.length || 0) > 1 ? 's' : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className='text-sm text-muted-foreground'>
                        {format(new Date(form.created_at), 'dd MMM yyyy', { locale: fr })}
                      </div>
                    </TableCell>
                    <TableCell className='text-right'>
                      <div className='flex items-center justify-end gap-1'>
                        <Button
                          variant='outline'
                          size='sm'
                          className='h-8 gap-1'
                          title='Éditer les champs'
                          onClick={() => {
                            setEditingFormId(form.id)
                            setFormBuilderOpen(true)
                          }}
                        >
                          <ChefHat className='h-3.5 w-3.5' />
                          Champs
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0'
                          title='Modifier infos'
                          onClick={() => openEditDialog(form)}
                        >
                          <Edit className='h-4 w-4' />
                        </Button>
                        <Button
                          variant='ghost'
                          size='sm'
                          className='h-8 w-8 p-0 text-destructive hover:text-destructive'
                          title='Supprimer'
                          onClick={() => openDeleteDialog(form)}
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

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau formulaire de menu</DialogTitle>
            <DialogDescription>
              Créez un formulaire réutilisable pour collecter les choix de menu.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='title'>Titre *</Label>
              <Input
                id='title'
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder='Ex: Menu mariage'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='description'>Description</Label>
              <Textarea
                id='description'
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder='Description optionnelle...'
                rows={3}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='restaurant'>Restaurant</Label>
              <Select value={formRestaurantId} onValueChange={setFormRestaurantId}>
                <SelectTrigger>
                  <SelectValue placeholder='Tous les restaurants' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>Tous les restaurants</SelectItem>
                  {restaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Limitez ce formulaire à un restaurant spécifique ou laissez vide pour tous.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={isCreating || !formTitle.trim()}>
              {isCreating && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le formulaire</DialogTitle>
            <DialogDescription>
              Modifiez les informations du formulaire.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            <div className='space-y-2'>
              <Label htmlFor='edit-title'>Titre *</Label>
              <Input
                id='edit-title'
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder='Ex: Menu mariage'
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-description'>Description</Label>
              <Textarea
                id='edit-description'
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder='Description optionnelle...'
                rows={3}
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='edit-restaurant'>Restaurant</Label>
              <Select value={formRestaurantId} onValueChange={setFormRestaurantId}>
                <SelectTrigger>
                  <SelectValue placeholder='Tous les restaurants' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='__all__'>Tous les restaurants</SelectItem>
                  {restaurants.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating || !formTitle.trim()}>
              {isUpdating && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce formulaire ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le formulaire "{selectedForm?.title}" sera supprimé. Les événements utilisant ce formulaire perdront leur lien.
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

      {/* Form Builder */}
      <MenuFormBuilder
        formId={editingFormId}
        open={formBuilderOpen}
        onOpenChange={(open) => {
          setFormBuilderOpen(open)
          if (!open) setEditingFormId(null)
        }}
      />
    </div>
  )
}
