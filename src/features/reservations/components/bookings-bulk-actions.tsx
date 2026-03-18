import { type Table } from '@tanstack/react-table'
import { CircleArrowUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { useBookingStatuses } from '../hooks/use-bookings'
import type { BookingWithRelations } from '../hooks/use-bookings'

type BookingsBulkActionsProps = {
  table: Table<BookingWithRelations>
}

export function BookingsBulkActions({ table }: BookingsBulkActionsProps) {
  const queryClient = useQueryClient()
  const { data: statuses = [] } = useBookingStatuses()
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkStatusChange = async (statusId: string, statusName: string) => {
    const ids = selectedRows.map((row) => row.original.id)
    const count = ids.length

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status_id: statusId } as never)
        .in('id', ids)

      if (error) throw error

      table.resetRowSelection()
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success(`Statut mis à jour en "${statusName}" pour ${count} événement${count > 1 ? 's' : ''}.`)
    } catch {
      toast.error('Erreur lors de la mise à jour des statuts.')
    }
  }

  const handleBulkDelete = async () => {
    const ids = selectedRows.map((row) => row.original.id)
    const count = ids.length

    if (!window.confirm(`Supprimer ${count} événement${count > 1 ? 's' : ''} ? Cette action est irréversible.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .in('id', ids)

      if (error) throw error

      table.resetRowSelection()
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success(`${count} événement${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''}.`)
    } catch {
      toast.error('Erreur lors de la suppression.')
    }
  }

  return (
    <BulkActionsToolbar table={table} entityName='événement'>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                aria-label='Changer le statut'
              >
                <CircleArrowUp />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Changer le statut</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent sideOffset={14}>
          {statuses.map((status) => (
            <DropdownMenuItem
              key={status.id}
              onClick={() => handleBulkStatusChange(status.id, status.name)}
            >
              <div
                className='h-2 w-2 rounded-full shrink-0'
                style={{ backgroundColor: status.color }}
              />
              {status.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant='destructive'
            size='icon'
            onClick={handleBulkDelete}
            className='size-8'
            aria-label='Supprimer'
          >
            <Trash2 />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Supprimer</p>
        </TooltipContent>
      </Tooltip>
    </BulkActionsToolbar>
  )
}
