import { type ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import type { BookingWithRelations } from '../hooks/use-bookings'

export const bookingsColumns: ColumnDef<BookingWithRelations>[] = [
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
    meta: { className: 'w-12' },
  },
  {
    accessorKey: 'event_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Date' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>
          {format(new Date(row.original.event_date), 'dd/MM/yyyy', { locale: fr })}
        </span>
        <span className='text-xs text-muted-foreground'>
          {row.original.start_time || ''}{row.original.end_time ? ` - ${row.original.end_time}` : ''}
        </span>
      </div>
    ),
  },
  {
    accessorKey: 'contact',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Contact' />
    ),
    cell: ({ row }) => {
      const contact = row.original.contact
      if (!contact) return <span className='text-muted-foreground'>-</span>
      return (
        <div className='flex flex-col'>
          <span className='font-medium'>
            {contact.first_name} {contact.last_name || ''}
          </span>
          {contact.email && (
            <span className='text-xs text-muted-foreground'>{contact.email}</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: 'event_type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Type' />
    ),
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.event_type || '-'}</span>
    ),
  },
  {
    accessorKey: 'guests_count',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Couverts' />
    ),
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.guests_count || '-'}</span>
    ),
  },
  {
    accessorKey: 'restaurant_id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Restaurant' />
    ),
    cell: ({ row }) => {
      const restaurant = row.original.restaurant
      if (!restaurant) return <span className='text-muted-foreground'>-</span>
      return (
        <div className='flex items-center gap-2'>
          {restaurant.color && (
            <div
              className='h-2 w-2 rounded-full'
              style={{ backgroundColor: restaurant.color }}
            />
          )}
          <span className='text-sm'>{restaurant.name}</span>
        </div>
      )
    },
    filterFn: (row, _id, value) => {
      return value.includes(row.original.restaurant_id)
    },
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
    accessorKey: 'total_amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Montant' />
    ),
    cell: ({ row }) => (
      <span className='text-sm font-medium'>
        {row.original.total_amount ? `${row.original.total_amount.toLocaleString('fr-FR')} €` : '-'}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Statut' />
    ),
    cell: ({ row }) => {
      const status = row.original.status
      if (!status) return <span className='text-muted-foreground'>-</span>
      return (
        <Badge
          variant='outline'
          className={cn('text-xs', status.color)}
        >
          {status.name}
        </Badge>
      )
    },
    filterFn: (row, _id, value) => {
      return value.includes(row.original.status?.slug)
    },
  },
  {
    id: 'actions',
    cell: () => (
      <Button variant='ghost' size='icon' className='h-8 w-8'>
        <ExternalLink className='h-4 w-4' />
      </Button>
    ),
    meta: { className: 'w-12' },
  },
]
