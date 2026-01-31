import { type ColumnDef } from '@tanstack/react-table'
import { format, formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { type Contact, contactStatuses } from '../data/contacts'

export const contactsColumns: ColumnDef<Contact>[] = [
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
    accessorKey: 'companyName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Contact' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span className='font-medium'>{row.original.companyName}</span>
        <span className='text-xs text-muted-foreground'>{row.original.contactName}</span>
      </div>
    ),
    meta: {
      className: 'min-w-[180px]',
    },
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Date' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col'>
        <span>{format(row.original.date, 'EEE d MMM yy', { locale: fr })}</span>
        <span className='text-xs text-muted-foreground'>{row.original.time}</span>
      </div>
    ),
    meta: {
      className: 'min-w-[120px]',
    },
  },
  {
    accessorKey: 'espace',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Espace' />
    ),
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.espace}</span>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'occasion',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Occasion' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center gap-1'>
        <span className='text-xs text-muted-foreground'>{row.original.guests}p</span>
        <span className='text-sm'>{row.original.occasion}</span>
      </div>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'devisHT',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Devis HT' />
    ),
    cell: ({ row }) => {
      const value = row.original.devisHT
      if (!value) return <span className='text-muted-foreground'>-</span>
      return (
        <Badge variant='outline' className='bg-yellow-50 text-yellow-700 border-yellow-200'>
          {value.toLocaleString('fr-FR')} €
        </Badge>
      )
    },
  },
  {
    accessorKey: 'facturesHT',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Factures HT' />
    ),
    cell: ({ row }) => {
      const value = row.original.facturesHT
      if (!value) return <span className='text-muted-foreground'>-</span>
      return (
        <Badge variant='outline' className='bg-green-50 text-green-700 border-green-200'>
          {value.toLocaleString('fr-FR')} €
        </Badge>
      )
    },
  },
  {
    accessorKey: 'assignee',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Assigné' />
    ),
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.assignee}</span>
    ),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'email',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Email' />
    ),
    cell: ({ row }) => (
      <div className='flex flex-col text-xs'>
        <span className='truncate max-w-[150px]'>{row.original.restaurant}</span>
        <span className='text-muted-foreground'>▶ {format(row.original.createdAt, 'dd/MM/yyyy HH:mm')}</span>
      </div>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Statut' />
    ),
    cell: ({ row }) => {
      const status = contactStatuses.find(s => s.value === row.original.status)
      return (
        <Badge 
          variant='outline' 
          className={cn('text-xs', status?.color.replace('bg-', 'border-'))}
        >
          {status?.label}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'relanceDate',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Relance à faire' />
    ),
    cell: ({ row }) => {
      const relanceDate = row.original.relanceDate
      if (!relanceDate) return <span className='text-muted-foreground'>-</span>
      return (
        <span className='text-sm text-orange-600'>
          il y a {formatDistanceToNow(relanceDate, { locale: fr })}
        </span>
      )
    },
  },
  {
    id: 'actions',
    cell: () => (
      <Button variant='ghost' size='icon' className='h-8 w-8'>
        <ExternalLink className='h-4 w-4' />
      </Button>
    ),
    meta: {
      className: 'w-12',
    },
  },
]
