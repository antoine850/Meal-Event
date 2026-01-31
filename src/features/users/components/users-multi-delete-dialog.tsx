'use client'

import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'

type UserMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

const CONFIRM_WORD = 'SUPPRIMER'

export function UsersMultiDeleteDialog<TData>({
  open,
  onOpenChange,
  table,
}: UserMultiDeleteDialogProps<TData>) {
  const [value, setValue] = useState('')

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleDelete = () => {
    if (value.trim() !== CONFIRM_WORD) {
      toast.error(`Veuillez taper "${CONFIRM_WORD}" pour confirmer.`)
      return
    }

    onOpenChange(false)

    toast.promise(sleep(2000), {
      loading: 'Suppression des utilisateurs...',
      success: () => {
        setValue('')
        table.resetRowSelection()
        return `${selectedRows.length} utilisateur${selectedRows.length > 1 ? 's' : ''} supprimé${selectedRows.length > 1 ? 's' : ''}`
      },
      error: 'Erreur',
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      disabled={value.trim() !== CONFIRM_WORD}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Supprimer {selectedRows.length}{' '}
          utilisateur{selectedRows.length > 1 ? 's' : ''}
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            Êtes-vous sûr de vouloir supprimer les utilisateurs sélectionnés ? <br />
            Cette action est irréversible.
          </p>

          <Label className='my-4 flex flex-col items-start gap-1.5'>
            <span className=''>Confirmez en tapant "{CONFIRM_WORD}" :</span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Tapez "${CONFIRM_WORD}" pour confirmer.`}
            />
          </Label>

          <Alert variant='destructive'>
            <AlertTitle>Attention !</AlertTitle>
            <AlertDescription>
              Soyez prudent, cette opération ne peut pas être annulée.
            </AlertDescription>
          </Alert>
        </div>
      }
      confirmText='Supprimer'
      destructive
    />
  )
}
