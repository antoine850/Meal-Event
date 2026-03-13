import { useState } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  ChefHat,
  Building2,
  MoreHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  useMenuDimensions,
  useCreateMenuDimension,
  useDeleteMenuDimension,
  type MenuDimensionWithOptions,
} from '@/features/reservations/hooks/use-menu-forms'
import { useRestaurants } from '@/features/settings/hooks/use-settings'

type MenuOption = { label: string; description?: string }

export function MenusPage() {
  const { data: dimensions = [], isLoading } = useMenuDimensions()
  const { data: restaurants = [] } = useRestaurants()
  const { mutate: createDimension, isPending: isCreating } = useCreateMenuDimension()
  const { mutate: deleteDimension, isPending: isDeleting } = useDeleteMenuDimension()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedDimension, setSelectedDimension] = useState<MenuDimensionWithOptions | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([])
  const [options, setOptions] = useState<MenuOption[]>([])
  const [newOptionLabel, setNewOptionLabel] = useState('')
  const [newOptionDesc, setNewOptionDesc] = useState('')

  const resetForm = () => {
    setName('')
    setDescription('')
    setSelectedRestaurants([])
    setOptions([])
    setNewOptionLabel('')
    setNewOptionDesc('')
    setSelectedDimension(null)
  }

  const openCreateDialog = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEditDialog = (dim: MenuDimensionWithOptions) => {
    setSelectedDimension(dim)
    setName(dim.name)
    setDescription(dim.description || '')
    setSelectedRestaurants(dim.menu_dimension_restaurants?.map(r => r.restaurant_id) || [])
    setOptions(dim.menu_dimension_options?.map(o => ({ label: o.label, description: o.description || '' })) || [])
    setDialogOpen(true)
  }

  const openDeleteDialog = (dim: MenuDimensionWithOptions) => {
    setSelectedDimension(dim)
    setDeleteDialogOpen(true)
  }

  const addOption = () => {
    const text = newOptionLabel.trim()
    if (!text) return
    setOptions(prev => [...prev, { label: text, description: newOptionDesc.trim() || undefined }])
    setNewOptionLabel('')
    setNewOptionDesc('')
  }

  const removeOption = (idx: number) => {
    setOptions(prev => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (options.length === 0) {
      toast.error('Ajoutez au moins une option')
      return
    }
    if (selectedRestaurants.length === 0) {
      toast.error('Sélectionnez au moins un restaurant')
      return
    }

    createDimension({
      name: name.trim(),
      description: description.trim() || undefined,
      restaurantIds: selectedRestaurants,
      options,
    }, {
      onSuccess: () => {
        toast.success('Dimension de menu créée')
        setDialogOpen(false)
        resetForm()
      },
      onError: () => toast.error('Erreur lors de la création'),
    })
  }

  const handleDelete = () => {
    if (!selectedDimension) return
    deleteDimension(selectedDimension.id, {
      onSuccess: () => {
        toast.success('Dimension supprimée')
        setDeleteDialogOpen(false)
        setSelectedDimension(null)
      },
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }

  const toggleRestaurant = (id: string) => {
    setSelectedRestaurants(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    )
  }

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
            Créez des formulaires de menu réutilisables pour vos événements.
          </p>
        </div>
        <Button onClick={openCreateDialog} className='gap-2'>
          <Plus className='h-4 w-4' />
          Nouveau formulaire
        </Button>
      </div>

      {/* List */}
      {dimensions.length === 0 ? (
        <Card className='border-dashed'>
          <CardContent className='py-12 text-center'>
            <ChefHat className='mx-auto h-12 w-12 text-muted-foreground/40' />
            <h3 className='mt-4 text-lg font-semibold'>Aucun formulaire de menu</h3>
            <p className='mt-2 text-sm text-muted-foreground'>
              Les formulaires de menu sont des choix prédéfinis (entrées, plats, desserts...) que vous pouvez réutiliser dans vos événements.
            </p>
            <Button onClick={openCreateDialog} className='mt-4 gap-2'>
              <Plus className='h-4 w-4' />
              Créer un formulaire
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
          {dimensions.map(dim => {
            const optionCount = dim.menu_dimension_options?.length || 0
            const restaurantCount = dim.menu_dimension_restaurants?.length || 0
            const restaurantNames = dim.menu_dimension_restaurants
              ?.map(r => restaurants.find(rest => rest.id === r.restaurant_id)?.name)
              .filter(Boolean)
              .slice(0, 2)

            return (
              <Card key={dim.id} className='hover:shadow-md transition-shadow'>
                <CardHeader className='pb-3'>
                  <div className='flex items-start justify-between'>
                    <div className='space-y-1'>
                      <CardTitle className='text-base flex items-center gap-2'>
                        <ChefHat className='h-4 w-4 text-muted-foreground' />
                        {dim.name}
                      </CardTitle>
                      {dim.description && (
                        <CardDescription className='text-xs line-clamp-2'>
                          {dim.description}
                        </CardDescription>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => openEditDialog(dim)}>
                          <Pencil className='h-3.5 w-3.5 mr-2' />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className='text-destructive focus:text-destructive'
                          onClick={() => openDeleteDialog(dim)}
                        >
                          <Trash2 className='h-3.5 w-3.5 mr-2' />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className='space-y-3'>
                  {/* Options preview */}
                  <div className='flex flex-wrap gap-1'>
                    {dim.menu_dimension_options?.slice(0, 4).map((opt, i) => (
                      <Badge key={i} variant='secondary' className='text-xs'>
                        {opt.label}
                      </Badge>
                    ))}
                    {optionCount > 4 && (
                      <Badge variant='outline' className='text-xs'>
                        +{optionCount - 4}
                      </Badge>
                    )}
                  </div>

                  {/* Restaurants */}
                  <div className='flex items-center gap-1 text-xs text-muted-foreground'>
                    <Building2 className='h-3 w-3' />
                    {restaurantNames?.join(', ')}
                    {restaurantCount > 2 && ` +${restaurantCount - 2}`}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
          <DialogHeader>
            <DialogTitle>
              {selectedDimension ? 'Modifier le formulaire' : 'Nouveau formulaire de menu'}
            </DialogTitle>
            <DialogDescription>
              Un formulaire de menu regroupe des options de choix (ex: "Entrées" avec plusieurs plats) réutilisables dans vos événements.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-6 py-4'>
            {/* Name & Description */}
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-2'>
                <Label>Nom *</Label>
                <Input
                  placeholder='Ex: Entrées, Plats, Desserts...'
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className='space-y-2'>
                <Label>Description</Label>
                <Input
                  placeholder='Description optionnelle...'
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Restaurants */}
            <div className='space-y-2'>
              <Label>Restaurants *</Label>
              <p className='text-xs text-muted-foreground'>
                Sélectionnez les restaurants où ce formulaire sera disponible.
              </p>
              <div className='grid gap-2 sm:grid-cols-2 mt-2'>
                {restaurants.map(rest => (
                  <div
                    key={rest.id}
                    className='flex items-center space-x-2 p-2 rounded-md border hover:bg-muted/50 cursor-pointer'
                    onClick={() => toggleRestaurant(rest.id)}
                  >
                    <Checkbox
                      checked={selectedRestaurants.includes(rest.id)}
                      onCheckedChange={() => toggleRestaurant(rest.id)}
                    />
                    <span className='text-sm'>{rest.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className='space-y-3'>
              <Label>Options de choix *</Label>
              <p className='text-xs text-muted-foreground'>
                Ajoutez les différentes options que le client pourra choisir.
              </p>

              {/* Existing options */}
              {options.length > 0 && (
                <div className='space-y-2'>
                  {options.map((opt, idx) => (
                    <div key={idx} className='flex items-start gap-2 p-2 bg-muted/30 rounded-md'>
                      <div className='flex-1'>
                        <div className='font-medium text-sm'>{opt.label}</div>
                        {opt.description && (
                          <div className='text-xs text-muted-foreground'>{opt.description}</div>
                        )}
                      </div>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-7 w-7 p-0 text-destructive hover:text-destructive'
                        onClick={() => removeOption(idx)}
                      >
                        <Trash2 className='h-3.5 w-3.5' />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new option */}
              <div className='space-y-2 p-3 border rounded-md'>
                <Input
                  placeholder="Nom de l'option..."
                  value={newOptionLabel}
                  onChange={e => setNewOptionLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                />
                <Textarea
                  placeholder='Description (optionnelle)...'
                  value={newOptionDesc}
                  onChange={e => setNewOptionDesc(e.target.value)}
                  className='min-h-[60px]'
                />
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  className='gap-1'
                  onClick={addOption}
                  disabled={!newOptionLabel.trim()}
                >
                  <Plus className='h-3 w-3' />
                  Ajouter l'option
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant='outline' onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSubmit} disabled={isCreating}>
              {isCreating && <Loader2 className='h-4 w-4 mr-2 animate-spin' />}
              {selectedDimension ? 'Enregistrer' : 'Créer'}
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
              Le formulaire "{selectedDimension?.name}" et toutes ses options seront supprimés.
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
