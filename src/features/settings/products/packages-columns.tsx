import { type ColumnDef } from '@tanstack/react-table'
import { Edit, Trash2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import type { PackageWithRelations } from '../hooks/use-products'

type PackageColumnsOptions = {
  onEdit: (pkg: PackageWithRelations) => void
  onDelete: (pkg: PackageWithRelations) => void
}

export function getPackagesColumns({
  onEdit,
  onDelete,
}: PackageColumnsOptions): ColumnDef<PackageWithRelations>[] {
  return [
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
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Nom' />
      ),
      cell: ({ row }) => (
        <div className='flex flex-col'>
          <div className='flex items-center gap-2'>
            <span className='font-medium text-sm'>{row.original.name}</span>
            {!row.original.is_active && (
              <Badge variant='secondary' className='text-[10px]'>Inactif</Badge>
            )}
            {row.original.price_per_person && (
              <Badge variant='outline' className='text-[10px] gap-0.5'>
                <Users className='h-2.5 w-2.5' />
                Par pers.
              </Badge>
            )}
          </div>
          {row.original.description && (
            <span className='text-xs text-muted-foreground truncate max-w-[300px]'>
              {row.original.description}
            </span>
          )}
        </div>
      ),
      meta: { className: 'min-w-[220px]' },
    },
    {
      accessorKey: 'unit_price_ht',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Prix HT' />
      ),
      cell: ({ row }) => (
        <span className='text-sm font-medium tabular-nums'>
          {row.original.unit_price_ht.toFixed(2)} €
        </span>
      ),
    },
    {
      accessorKey: 'tva_rate',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='TVA' />
      ),
      cell: ({ row }) => (
        <span className='text-sm text-muted-foreground tabular-nums'>
          {row.original.tva_rate}%
        </span>
      ),
    },
    {
      id: 'products_total',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Total produits' />
      ),
      cell: ({ row }) => {
        const totalHt = row.original.package_products?.reduce((sum, pp) => {
          return sum + ((pp.product as any)?.unit_price_ht || 0) * pp.quantity
        }, 0) || 0
        return (
          <span className='text-sm text-muted-foreground tabular-nums'>
            {totalHt.toFixed(2)} €
          </span>
        )
      },
    },
    {
      id: 'products_count',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Produits' />
      ),
      cell: ({ row }) => {
        const count = row.original.package_products?.length || 0
        return (
          <Badge variant='outline' className='text-xs'>
            {count} produit{count > 1 ? 's' : ''}
          </Badge>
        )
      },
    },
    {
      id: 'restaurants',
      accessorFn: (row) => row.package_restaurants?.map(pr => pr.restaurant_id) || [],
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Restaurants' />
      ),
      cell: ({ row }) => {
        const prs = row.original.package_restaurants
        if (!prs || prs.length === 0) return <span className='text-muted-foreground'>—</span>
        return (
          <div className='flex items-center gap-1.5'>
            {prs.map(pr => (
              <div
                key={pr.restaurant_id}
                className='h-2.5 w-2.5 rounded-full'
                style={{ backgroundColor: pr.restaurant?.color || '#ccc' }}
                title={pr.restaurant?.name}
              />
            ))}
          </div>
        )
      },
      filterFn: (row, _id, value) => {
        const restaurantIds = row.original.package_restaurants?.map(pr => pr.restaurant_id) || []
        return value.some((v: string) => restaurantIds.includes(v))
      },
      meta: { className: 'min-w-[100px]' },
    },
    {
      accessorKey: 'is_active',
      header: () => null,
      cell: () => null,
      enableHiding: true,
      filterFn: (row, _id, value) => {
        return value.includes(String(row.original.is_active))
      },
      meta: { className: 'hidden' },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className='flex items-center gap-0.5'>
          <Button
            size='icon'
            variant='ghost'
            className='h-7 w-7'
            onClick={(e) => { e.stopPropagation(); onEdit(row.original) }}
            title='Modifier'
          >
            <Edit className='h-3.5 w-3.5' />
          </Button>
          <Button
            size='icon'
            variant='ghost'
            className='h-7 w-7 text-destructive hover:text-destructive'
            onClick={(e) => { e.stopPropagation(); onDelete(row.original) }}
            title='Supprimer'
          >
            <Trash2 className='h-3.5 w-3.5' />
          </Button>
        </div>
      ),
      meta: { className: 'w-[80px]' },
    },
  ]
}
