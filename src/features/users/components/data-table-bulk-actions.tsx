import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2, UserX, UserCheck, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type User } from '../data/schema'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
  table,
}: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkStatusChange = (status: 'active' | 'inactive') => {
    const selectedUsers = selectedRows.map((row) => row.original as User)
    toast.promise(sleep(2000), {
      loading: `${status === 'active' ? 'Activation' : 'Désactivation'} des utilisateurs...`,
      success: () => {
        table.resetRowSelection()
        return `${selectedUsers.length} utilisateur${selectedUsers.length > 1 ? 's' : ''} ${status === 'active' ? 'activé' : 'désactivé'}${selectedUsers.length > 1 ? 's' : ''}`
      },
      error: `Erreur lors de ${status === 'active' ? "l'activation" : 'la désactivation'} des utilisateurs`,
    })
    table.resetRowSelection()
  }

  const handleBulkInvite = () => {
    const selectedUsers = selectedRows.map((row) => row.original as User)
    toast.promise(sleep(2000), {
      loading: 'Envoi des invitations...',
      success: () => {
        table.resetRowSelection()
        return `${selectedUsers.length} utilisateur${selectedUsers.length > 1 ? 's' : ''} invité${selectedUsers.length > 1 ? 's' : ''}`
      },
      error: "Erreur lors de l'envoi des invitations",
    })
    table.resetRowSelection()
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName='utilisateur'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={handleBulkInvite}
              className='size-8'
              aria-label='Inviter les utilisateurs sélectionnés'
              title='Inviter les utilisateurs sélectionnés'
            >
              <Mail />
              <span className='sr-only'>Inviter les utilisateurs sélectionnés</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Inviter les utilisateurs sélectionnés</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleBulkStatusChange('active')}
              className='size-8'
              aria-label='Activer les utilisateurs sélectionnés'
              title='Activer les utilisateurs sélectionnés'
            >
              <UserCheck />
              <span className='sr-only'>Activer les utilisateurs sélectionnés</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Activer les utilisateurs sélectionnés</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='outline'
              size='icon'
              onClick={() => handleBulkStatusChange('inactive')}
              className='size-8'
              aria-label='Désactiver les utilisateurs sélectionnés'
              title='Désactiver les utilisateurs sélectionnés'
            >
              <UserX />
              <span className='sr-only'>Désactiver les utilisateurs sélectionnés</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Désactiver les utilisateurs sélectionnés</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setShowDeleteConfirm(true)}
              className='size-8'
              aria-label='Supprimer les utilisateurs sélectionnés'
              title='Supprimer les utilisateurs sélectionnés'
            >
              <Trash2 />
              <span className='sr-only'>Supprimer les utilisateurs sélectionnés</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Supprimer les utilisateurs sélectionnés</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <UsersMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />
    </>
  )
}
