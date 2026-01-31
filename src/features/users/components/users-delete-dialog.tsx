'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type User } from '../data/schema'

type UserDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: User
}

export function UsersDeleteDialog({
  open,
  onOpenChange,
  currentRow,
}: UserDeleteDialogProps) {
  const [value, setValue] = useState('')

  const handleDelete = () => {
    if (value.trim() !== currentRow.username) return

    onOpenChange(false)
    showSubmittedData(currentRow, 'The following user has been deleted:')
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      disabled={value.trim() !== currentRow.username}
      title={
        <span className='text-destructive'>
          <AlertTriangle
            className='me-1 inline-block stroke-destructive'
            size={18}
          />{' '}
          Supprimer l'utilisateur
        </span>
      }
      desc={
        <div className='space-y-4'>
          <p className='mb-2'>
            Êtes-vous sûr de vouloir supprimer{' '}
            <span className='font-bold'>{currentRow.username}</span> ?
            <br />
            Cette action supprimera définitivement l'utilisateur avec le rôle{' '}
            <span className='font-bold'>
              {currentRow.role.toUpperCase()}
            </span>{' '}
            du système. Cette action est irréversible.
          </p>

          <Label className='my-2'>
            Nom d'utilisateur :
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Entrez le nom d'utilisateur pour confirmer."
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
