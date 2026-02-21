import { useMemo, useState } from 'react'
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import type { ProductWithRestaurants } from '../hooks/use-products'
import { PRODUCT_TYPES } from '../hooks/use-products'
import { getProductsColumns } from './products-columns'

type Restaurant = {
  id: string
  name: string
  color: string | null
}

type ProductsTableProps = {
  data: ProductWithRestaurants[]
  restaurants: Restaurant[]
  onEdit: (product: ProductWithRestaurants) => void
  onDuplicate: (product: ProductWithRestaurants) => void
  onDelete: (product: ProductWithRestaurants) => void
  actionButton?: React.ReactNode
}

export function ProductsTable({
  data,
  restaurants,
  onEdit,
  onDuplicate,
  onDelete,
  actionButton,
}: ProductsTableProps) {
  const [rowSelection, setRowSelection] = useState({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    is_active: false,
  })

  const columns = useMemo(
    () => getProductsColumns({ onEdit, onDuplicate, onDelete }),
    [onEdit, onDuplicate, onDelete]
  )

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = (filterValue as string).toLowerCase()
      const product = row.original
      return (
        product.name.toLowerCase().includes(search) ||
        (product.description || '').toLowerCase().includes(search) ||
        (product.tag || '').toLowerCase().includes(search)
      )
    },
  })

  const typeFilterOptions = PRODUCT_TYPES.map(t => ({
    label: t.label,
    value: t.value,
  }))

  const restaurantFilterOptions = restaurants.map(r => ({
    label: r.name,
    value: r.id,
  }))

  const activeFilterOptions = [
    { label: 'Actif', value: 'true' },
    { label: 'Inactif', value: 'false' },
  ]

  const filters = [
    { columnId: 'type', title: 'Type', options: typeFilterOptions },
    ...(restaurantFilterOptions.length > 0
      ? [{ columnId: 'restaurants', title: 'Restaurant', options: restaurantFilterOptions }]
      : []),
    { columnId: 'is_active', title: 'Statut', options: activeFilterOptions },
  ]

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Rechercher un produit...'
        filters={filters}
        actionButton={actionButton}
      />
      <div className='overflow-hidden rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      header.column.columnDef.meta?.className,
                      header.column.columnDef.meta?.thClassName
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className='cursor-pointer'
                  onClick={() => onEdit(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className='h-24 text-center'
                >
                  Aucun produit trouvé.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
    </div>
  )
}
