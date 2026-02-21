import { type ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ExternalLink } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import type { ContactWithRelations } from '../types'

export const contactsColumns: ColumnDef<ContactWithRelations>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-[2px]'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-[2px]'
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: {
      className: 'w-12',
    },
  },
  {
    accessorKey: 'first_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Contact' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <div className='flex items-center gap-2'>
          <span className='font-medium'>
            {row.original.first_name} {row.original.last_name || ''}
          </span>
          {row.original.company && (
            <Badge className='bg-blue-500 text-white text-[10px] px-1.5 py-0 h-5'>Pro</Badge>
          )}
        </div>
        <span className='text-xs text-muted-foreground'>
          {row.original.company?.name || '-'}
        </span>
      </div>
    ),
    meta: {
      className: 'min-w-[180px]',
    },
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Email' />
    ),
    cell: ({ row }) => (
      <span className='text-sm truncate max-w-[200px]'>
        {row.original.email || '-'}
      </span>
    ),
    meta: {
      className: 'min-w-[180px]',
    },
  },
  {
    accessorKey: 'phone',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Téléphone' />
    ),
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.phone || row.original.mobile || '-'}</span>
    ),
  },
  {
    accessorKey: 'job_title',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Fonction' />
    ),
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.job_title || '-'}</span>
    ),
  },
  {
    accessorKey: 'assigned_to',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Commercial' />
    ),
    cell: ({ row }) => {
      const user = row.original.assigned_user
      if (!user) return <span className='text-muted-foreground'>-</span>
      return (
        <span className='text-sm'>
          {user.first_name} {user.last_name}
        </span>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'restaurant_id',
    header: () => null,
    cell: () => null,
    enableHiding: true,
    filterFn: (row, _id, value) => {
      return value.includes(row.original.restaurant_id)
    },
    meta: {
      className: 'hidden',
    },
  },
  {
    accessorKey: 'source',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Source' />
    ),
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.source || '-'}</span>
    ),
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Créé le' />
    ),
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>
        {format(new Date(row.original.created_at), 'dd/MM/yyyy', { locale: fr })}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <Button variant='ghost' size='icon' className='h-8 w-8' asChild>
        <Link to='/contacts/contact/$id' params={{ id: row.original.id }}>
          <ExternalLink className='h-4 w-4' />
        </Link>
      </Button>
    ),
    meta: {
      className: 'w-12',
    },
  },
]
