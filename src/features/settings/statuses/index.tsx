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
import { useStatuses, useDeleteStatus, type Status } from '../hooks/use-settings'
import { StatusDialog } from './status-dialog'

export function StatusesSettings() {
  const { data: bookingStatuses = [], isLoading: isLoadingBookings } = useStatuses('booking')
  const { mutate: deleteStatus } = useDeleteStatus()
  const [editingStatus, setEditingStatus] = useState<Status | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [statusType] = useState<'booking'>('booking')

  const isLoading = isLoadingBookings

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce statut ?')) {
      deleteStatus(id, {
        onSuccess: () => toast.success('Statut supprimé'),
        onError: () => toast.error('Erreur lors de la suppression'),
      })
    }
  }

  const handleEdit = (status: Status) => {
    setEditingStatus(status)
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingStatus(null)
    setIsDialogOpen(true)
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-10'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  const StatusTable = ({ statuses }: { statuses: Status[] }) => (
    <>
      <div className='flex justify-end mb-4'>
        <Button onClick={() => handleCreate()}>
          <Plus className='mr-2 h-4 w-4' />
          Ajouter un statut
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Couleur</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Position</TableHead>
              <TableHead className='w-[70px]'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {statuses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className='text-center text-muted-foreground py-8'>
                  Aucun statut configuré
                </TableCell>
              </TableRow>
            ) : (
              statuses.map((status) => (
                <TableRow key={status.id}>
                  <TableCell>
                    <div
                      className='w-6 h-6 rounded-full border'
                      style={{ backgroundColor: status.color || '#6b7280' }}
                    />
                  </TableCell>
                  <TableCell className='font-medium'>{status.name}</TableCell>
                  <TableCell>
                    <Badge variant='outline'>{status.slug}</Badge>
                  </TableCell>
                  <TableCell>{status.position}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant='ghost' size='icon' className='h-8 w-8'>
                          <MoreHorizontal className='h-4 w-4' />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align='end'>
                        <DropdownMenuItem onClick={() => handleEdit(status)}>
                          <Pencil className='mr-2 h-4 w-4' />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className='text-destructive'
                          onClick={() => handleDelete(status.id)}
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
    </>
  )

  return (
    <div className='flex flex-1 flex-col w-full'>
      <StatusTable statuses={bookingStatuses} />

      <StatusDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        status={editingStatus}
        type={statusType}
      />
    </div>
  )
}
