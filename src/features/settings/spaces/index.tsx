import { useState } from 'react'
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSpaces, useDeleteSpace, type Space } from '../hooks/use-settings'
import { SpaceDialog } from './space-dialog'

export function SpacesSettings() {
  const { data: spaces = [], isLoading } = useSpaces()
  const { mutate: deleteSpace } = useDeleteSpace()
  const [editingSpace, setEditingSpace] = useState<(Space & { restaurant: { id: string; name: string } | null }) | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cet espace ?')) {
      deleteSpace(id, {
        onSuccess: () => toast.success('Espace supprimé'),
        onError: () => toast.error('Erreur lors de la suppression'),
      })
    }
  }

  const handleEdit = (space: Space & { restaurant: { id: string; name: string } | null }) => {
    setEditingSpace(space)
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingSpace(null)
    setIsDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-10'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <div className='flex flex-1 flex-col w-full'>
      <div className='flex justify-end mb-4'>
        <Button onClick={handleCreate}>
          <Plus className='mr-2 h-4 w-4' />
          Ajouter un espace
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead className='hidden sm:table-cell'>Restaurant</TableHead>
              <TableHead className='hidden md:table-cell'>Capacité</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className='w-[70px]'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {spaces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-center text-muted-foreground py-8'>
                  Aucun espace configuré
                </TableCell>
              </TableRow>
            ) : (
              spaces.map((space) => (
                <TableRow key={space.id}>
                  <TableCell className='font-medium'>{space.name}</TableCell>
                  <TableCell className='hidden sm:table-cell'>{space.restaurant?.name || '-'}</TableCell>
                  <TableCell className='hidden md:table-cell'>{space.capacity ? `${space.capacity} pers.` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={space.is_active ? 'default' : 'secondary'}>
                      {space.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='h-8 w-8'>
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => handleEdit(space)}>
                          <Pencil className='mr-2 h-4 w-4' />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className='text-destructive'
                          onClick={() => handleDelete(space.id)}
                        >
                          <Trash2 className='mr-2 h-4 w-4' />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <SpaceDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        space={editingSpace}
      />
    </div>
  )
}
