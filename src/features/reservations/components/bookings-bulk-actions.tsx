import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type Table } from '@tanstack/react-table'
import { CircleArrowUp, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
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
import { CANCELLED_SLUG } from '../data/cancellation-reasons'
import { useBookingStatuses } from '../hooks/use-bookings'
import type { BookingWithRelations } from '../hooks/use-bookings'
import { CancelBookingDialog } from './cancel-booking-dialog'

type BookingsBulkActionsProps = {
  table: Table<BookingWithRelations>
}

export function BookingsBulkActions({ table }: BookingsBulkActionsProps) {
  const queryClient = useQueryClient()
  const { data: statuses = [] } = useBookingStatuses()
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<{
    statusId: string
    statusName: string
    ids: string[]
  } | null>(null)

  const handleBulkStatusChange = async (
    statusId: string,
    statusName: string,
    cancellation?: { reason: string | null; comment: string | null },
    ids?: string[]
  ) => {
    const targetIds = ids ?? selectedRows.map((row) => row.original.id)
    const count = targetIds.length

    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          status_id: statusId,
          ...(cancellation
            ? {
                cancellation_reason: cancellation.reason,
                cancellation_comment: cancellation.comment,
              }
            : {}),
        } as never)
        .in('id', targetIds)

      if (error) throw error

      table.resetRowSelection()
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success(
        `Statut mis à jour en "${statusName}" pour ${count} événement${count > 1 ? 's' : ''}.`
      )
    } catch {
      toast.error('Erreur lors de la mise à jour des statuts.')
    }
  }

  const handleBulkDelete = async () => {
    const ids = selectedRows.map((row) => row.original.id)
    const count = ids.length

    try {
      // Delete related records first (FK without CASCADE)
      await supabase.from('email_logs').delete().in('booking_id', ids)
      await supabase.from('activity_logs').delete().in('booking_id', ids)

      const { error } = await supabase.from('bookings').delete().in('id', ids)

      if (error) throw error

      table.resetRowSelection()
      queryClient.invalidateQueries({ queryKey: ['bookings'] })
      toast.success(
        `${count} événement${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''}.`
      )
    } catch {
      toast.error('Erreur lors de la suppression.')
    }
  }

  const count = selectedRows.length

  return (
    <>
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
                onClick={() => {
                  if (status.slug === CANCELLED_SLUG) {
                    setCancelTarget({
                      statusId: status.id,
                      statusName: status.name,
                      ids: selectedRows.map((row) => row.original.id),
                    })
                    return
                  }
                  // Tout statut non annule efface le motif : idempotent, et
                  // un motif sur un dossier vivant ressortirait dans les exports.
                  handleBulkStatusChange(status.id, status.name, {
                    reason: null,
                    comment: null,
                  })
                }}
              >
                <div
                  className='h-2 w-2 shrink-0 rounded-full'
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
              onClick={() => setDeleteDialogOpen(true)}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer {count} événement{count > 1 ? 's' : ''} ? Cette action
              est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className='text-destructive-foreground bg-destructive hover:bg-destructive/90'
              onClick={handleBulkDelete}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CancelBookingDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null)
        }}
        count={cancelTarget?.ids.length ?? 0}
        onConfirm={(reason, comment) => {
          if (cancelTarget) {
            handleBulkStatusChange(
              cancelTarget.statusId,
              cancelTarget.statusName,
              { reason, comment },
              cancelTarget.ids
            )
          }
          setCancelTarget(null)
        }}
      />
    </>
  )
}
