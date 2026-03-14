import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Trash2,
  Loader2,
  ChefHat,
  Plus,
  Building2,
  Edit,
  MoreHorizontal,
  Copy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTablePagination, DataTableColumnHeader } from '@/components/data-table'
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
  const [search, setSearch] = useState('')

  // Table state
  const [sorting, setSorting] = useState<SortingState>([])

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

  const handleDuplicate = (form: MenuFormWithFields) => {
    createMenuForm({
      title: `${form.title} (copie)`,
      description: form.description || undefined,
      restaurantId: form.restaurant_id || null,
    }, {
      onSuccess: () => toast.success('Formulaire dupliqué'),
      onError: () => toast.error('Erreur lors de la duplication'),
    })
  }

  const filteredForms = useMemo(() => {
    let result = menuForms
    if (restaurantFilter !== 'all') {
      result = result.filter(f => f.restaurant_id === restaurantFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(f =>
        f.title.toLowerCase().includes(q) ||
        (f.description || '').toLowerCase().includes(q)
      )
    }
    return result
  }, [menuForms, restaurantFilter, search])

  const columns = useMemo<ColumnDef<MenuFormWithFields>[]>(() => [
    {
      accessorKey: 'title',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Formulaire' />,
      cell: ({ row }) => (
        <div className='space-y-0.5'>
          <div className='font-medium'>{row.original.title}</div>
          {row.original.description && (
            <div className='text-xs text-muted-foreground line-clamp-1'>
              {row.original.description}
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'restaurant',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Restaurant' />,
      accessorFn: (row) => (row as any).restaurants?.name || '',
      cell: ({ row }) => {
        const restaurant = (row.original as any).restaurants
        return restaurant ? (
          <Badge variant='outline' className='gap-1 font-normal'>
            <Building2 className='h-3 w-3' />
            {restaurant.name}
          </Badge>
        ) : (
          <span className='text-muted-foreground text-sm'>Tous</span>
        )
      },
    },
    {
      id: 'fields_count',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Champs' />,
      accessorFn: (row) => row.menu_form_fields?.length || 0,
      cell: ({ row }) => {
        const count = row.original.menu_form_fields?.length || 0
        return (
          <Badge variant='secondary'>
            {count} champ{count > 1 ? 's' : ''}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Créé le' />,
      cell: ({ row }) => (
        <div className='text-sm text-muted-foreground'>
          {format(new Date(row.original.created_at), 'dd MMM yyyy', { locale: fr })}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const form = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
                <MoreHorizontal className='h-4 w-4' />
                <span className='sr-only'>Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem
                onClick={() => {
                  setEditingFormId(form.id)
                  setFormBuilderOpen(true)
                }}
              >
                <ChefHat className='h-4 w-4 mr-2' />
                Éditer les champs
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openEditDialog(form)}>
                <Edit className='h-4 w-4 mr-2' />
                Modifier les infos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDuplicate(form)}>
                <Copy className='h-4 w-4 mr-2' />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive focus:text-destructive'
                onClick={() => openDeleteDialog(form)}
              >
                <Trash2 className='h-4 w-4 mr-2' />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      meta: { className: 'w-[50px]' },
    },
  ], [])

  const table = useReactTable({
    data: filteredForms,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <div className='space-y-4 p-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-2xl font-bold tracking-tight'>Formulaires de menu</h2>
          <p className='text-muted-foreground'>
            Créez des formulaires réutilisables pour collecter les choix de menu de vos clients.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className='h-4 w-4 mr-2' />
          Nouveau formulaire
        </Button>
      </div>

      {/* Filters */}
      <div className='flex flex-wrap items-center gap-2'>
        <Input
          placeholder='Rechercher un formulaire...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='h-8 w-full sm:w-[200px] lg:w-[250px]'
        />
        <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
          <SelectTrigger className='h-8 w-[180px]'>
            <SelectValue placeholder='Filtrer par restaurant' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Tous les restaurants</SelectItem>
            {restaurants.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className='flex flex-1 flex-col gap-4'>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} colSpan={header.colSpan} className={header.column.columnDef.meta?.className as string}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cell.column.columnDef.meta?.className as string}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className='h-24 text-center'>
                    <div className='flex flex-col items-center gap-2'>
                      <ChefHat className='h-8 w-8 text-muted-foreground/40' />
                      <span className='text-muted-foreground'>Aucun formulaire trouvé</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} />
      </div>

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
