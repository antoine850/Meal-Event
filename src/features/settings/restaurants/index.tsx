import { useState } from 'react'
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from '@tanstack/react-router'
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
import { useRestaurants, useDeleteRestaurant, type Restaurant } from '../hooks/use-settings'
import { RestaurantDialog } from './restaurant-dialog'

export function RestaurantsSettings() {
  const navigate = useNavigate()
  const { data: restaurants = [], isLoading } = useRestaurants()
  const { mutate: deleteRestaurant } = useDeleteRestaurant()
  const [editingRestaurant, setEditingRestaurant] = useState<Restaurant | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce restaurant ?')) {
      deleteRestaurant(id, {
        onSuccess: () => toast.success('Restaurant supprimé'),
        onError: () => toast.error('Erreur lors de la suppression'),
      })
    }
  }

  const handleEdit = (restaurant: Restaurant) => {
    setEditingRestaurant(restaurant)
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingRestaurant(null)
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
          Ajouter un restaurant
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Couleur</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead className='hidden md:table-cell'>Email</TableHead>
              <TableHead className='hidden sm:table-cell'>Téléphone</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className='w-[70px]'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {restaurants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className='text-center text-muted-foreground py-8'>
                  Aucun restaurant configuré
                </TableCell>
              </TableRow>
            ) : (
              restaurants.map((restaurant) => (
                <TableRow 
                  key={restaurant.id} 
                  className='cursor-pointer hover:bg-muted/50'
                  onClick={() => navigate({ to: '/settings/restaurant/$id', params: { id: restaurant.id } })}
                >
                  <TableCell>
                    <div
                      className='w-6 h-6 rounded-full border'
                      style={{ backgroundColor: restaurant.color || '#3b82f6' }}
                    />
                  </TableCell>
                  <TableCell className='font-medium'>{restaurant.name}</TableCell>
                  <TableCell className='hidden md:table-cell'>{restaurant.email || '-'}</TableCell>
                  <TableCell className='hidden sm:table-cell'>{restaurant.phone || '-'}</TableCell>
                  <TableCell>
                    <Badge variant={restaurant.is_active ? 'default' : 'secondary'}>
                      {restaurant.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='h-8 w-8'>
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => navigate({ to: '/settings/restaurant/$id', params: { id: restaurant.id } })}>
                          <Eye className='mr-2 h-4 w-4' />
                          Voir les détails
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(restaurant)}>
                          <Pencil className='mr-2 h-4 w-4' />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className='text-destructive'
                          onClick={() => handleDelete(restaurant.id)}
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

      <RestaurantDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        restaurant={editingRestaurant}
      />
    </div>
  )
}
