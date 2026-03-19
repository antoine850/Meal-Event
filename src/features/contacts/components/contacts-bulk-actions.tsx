import { type Table } from '@tanstack/react-table'
import { Trash2, UserRound, Globe } from 'lucide-react'
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
import { useOrganizationUsers } from '../hooks/use-contacts'
import type { ContactWithRelations } from '../types'

const SOURCES = [
  'website',
  'facebook',
  'instagram',
  'google',
  'bouche-a-oreille',
  'api',
  'import',
  'autre',
]

type ContactsBulkActionsProps = {
  table: Table<ContactWithRelations>
}

export function ContactsBulkActions({ table }: ContactsBulkActionsProps) {
  const queryClient = useQueryClient()
  const { data: users = [] } = useOrganizationUsers()
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkAssign = async (userId: string | null, userName: string) => {
    const ids = selectedRows.map((row) => row.original.id)
    const count = ids.length

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ assigned_to: userId } as never)
        .in('id', ids)

      if (error) throw error

      table.resetRowSelection()
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success(
        userId
          ? `${count} contact${count > 1 ? 's' : ''} assigné${count > 1 ? 's' : ''} à ${userName}.`
          : `Assignation retirée pour ${count} contact${count > 1 ? 's' : ''}.`
      )
    } catch {
      toast.error("Erreur lors de l'assignation.")
    }
  }

  const handleBulkSource = async (source: string) => {
    const ids = selectedRows.map((row) => row.original.id)
    const count = ids.length

    try {
      const { error } = await supabase
        .from('contacts')
        .update({ source } as never)
        .in('id', ids)

      if (error) throw error

      table.resetRowSelection()
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success(`Source mise à jour en "${source}" pour ${count} contact${count > 1 ? 's' : ''}.`)
    } catch {
      toast.error('Erreur lors de la mise à jour de la source.')
    }
  }

  const handleBulkDelete = async () => {
    const ids = selectedRows.map((row) => row.original.id)
    const count = ids.length

    if (!window.confirm(`Supprimer ${count} contact${count > 1 ? 's' : ''} ? Cette action est irréversible.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', ids)

      if (error) throw error

      table.resetRowSelection()
      queryClient.invalidateQueries({ queryKey: ['contacts'] })
      toast.success(`${count} contact${count > 1 ? 's' : ''} supprimé${count > 1 ? 's' : ''}.`)
    } catch {
      toast.error('Erreur lors de la suppression.')
    }
  }

  return (
    <BulkActionsToolbar table={table} entityName='contact'>
      {/* Assign commercial */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                aria-label='Affecter un commercial'
              >
                <UserRound />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Affecter un commercial</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent sideOffset={14}>
          <DropdownMenuItem onClick={() => handleBulkAssign(null, '')}>
            <span className='text-muted-foreground'>Aucun (retirer)</span>
          </DropdownMenuItem>
          {users.map((user) => (
            <DropdownMenuItem
              key={user.id}
              onClick={() => handleBulkAssign(user.id, `${user.first_name} ${user.last_name}`)}
            >
              {user.first_name} {user.last_name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Change source */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant='outline'
                size='icon'
                className='size-8'
                aria-label='Changer la source'
              >
                <Globe />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Changer la source</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent sideOffset={14}>
          {SOURCES.map((source) => (
            <DropdownMenuItem
              key={source}
              onClick={() => handleBulkSource(source)}
            >
              {source}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete */}
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
