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
import { ContentSection } from '../components/content-section'
import { useTimeSlots, useDeleteTimeSlot, type TimeSlot } from '../hooks/use-settings'
import { TimeSlotDialog } from './time-slot-dialog'

export function TimeSlotsSettings() {
  const { data: timeSlots = [], isLoading } = useTimeSlots()
  const { mutate: deleteTimeSlot } = useDeleteTimeSlot()
  const [editingTimeSlot, setEditingTimeSlot] = useState<TimeSlot | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce créneau ?')) {
      deleteTimeSlot(id, {
        onSuccess: () => toast.success('Créneau supprimé'),
        onError: () => toast.error('Erreur lors de la suppression'),
      })
    }
  }

  const handleEdit = (timeSlot: TimeSlot) => {
    setEditingTimeSlot(timeSlot)
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingTimeSlot(null)
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
    <ContentSection
      title='Créneaux horaires'
      desc='Gérez les créneaux horaires disponibles pour les réservations.'
    >
      <div className='flex justify-end mb-4'>
        <Button onClick={handleCreate}>
          <Plus className='mr-2 h-4 w-4' />
          Ajouter un créneau
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Début</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className='w-[70px]'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {timeSlots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-center text-muted-foreground py-8'>
                  Aucun créneau configuré
                </TableCell>
              </TableRow>
            ) : (
              timeSlots.map((timeSlot) => (
                <TableRow key={timeSlot.id}>
                  <TableCell className='font-medium'>{timeSlot.name}</TableCell>
                  <TableCell>{timeSlot.start_time}</TableCell>
                  <TableCell>{timeSlot.end_time}</TableCell>
                  <TableCell>
                    <Badge variant={timeSlot.is_active ? 'default' : 'secondary'}>
                      {timeSlot.is_active ? 'Actif' : 'Inactif'}
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
                        <DropdownMenuItem onClick={() => handleEdit(timeSlot)}>
                          <Pencil className='mr-2 h-4 w-4' />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className='text-destructive'
                          onClick={() => handleDelete(timeSlot.id)}
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

      <TimeSlotDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        timeSlot={editingTimeSlot}
      />
    </ContentSection>
  )
}
