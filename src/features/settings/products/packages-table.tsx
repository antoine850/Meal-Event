import { useEffect, useMemo, useState } from 'react'
import {
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination, DataTableToolbar } from '@/components/data-table'
import {
  type PackageWithRelations,
  usePackagesPaged,
} from '../hooks/use-products'
import { getPackagesColumns } from './packages-columns'

type Restaurant = {
  id: string
  name: string
  color: string | null
}

type PackagesTableProps = {
  restaurants: Restaurant[]
  onEdit: (pkg: PackageWithRelations) => void
  onDelete: (pkg: PackageWithRelations) => void
  onTotalChange?: (total: number) => void
  actionButton?: React.ReactNode
}

const PAGE_SIZE = 50

export function PackagesTable({
  restaurants,
  onEdit,
  onDelete,
  onTotalChange,
  actionButton,
}: PackagesTableProps) {
  const [rowSelection, setRowSelection] = useState({})
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    is_active: false,
  })
  const [globalFilter, setGlobalFilter] = useState('')
  const [pageIndex, setPageIndex] = useState(0)

  const debouncedSearch = useDebouncedValue(globalFilter, 300)

  const restoFilter = columnFilters.find((f) => f.id === 'restaurants')
    ?.value as string[] | undefined
  const activeFilter = columnFilters.find((f) => f.id === 'is_active')
    ?.value as string[] | undefined
  const active =
    activeFilter?.length === 1 ? activeFilter[0] === 'true' : undefined

  const query = usePackagesPaged({
    page: pageIndex,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    restaurantIds: restoFilter?.length ? restoFilter : undefined,
    active,
  })

  const data = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  useEffect(() => {
    onTotalChange?.(total)
  }, [total, onTotalChange])

  const filterKey = JSON.stringify(columnFilters)
  useEffect(() => {
    setPageIndex(0)
  }, [debouncedSearch, filterKey])

  const columns = useMemo(
    () => getPackagesColumns({ onEdit, onDelete }),
    [onEdit, onDelete]
  )

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      globalFilter,
      pagination: { pageIndex, pageSize: PAGE_SIZE },
    },
    enableRowSelection: true,
    manualPagination: true,
    manualFiltering: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize: PAGE_SIZE })
          : updater
      setPageIndex(next.pageIndex)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const restaurantFilterOptions = restaurants.map((r) => ({
    label: r.name,
    value: r.id,
  }))

  const activeFilterOptions = [
    { label: 'Actif', value: 'true' },
    { label: 'Inactif', value: 'false' },
  ]

  const filters = [
    ...(restaurantFilterOptions.length > 0
      ? [
          {
            columnId: 'restaurants',
            title: 'Restaurant',
            options: restaurantFilterOptions,
          },
        ]
      : []),
    { columnId: 'is_active', title: 'Statut', options: activeFilterOptions },
  ]

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <DataTableToolbar
        table={table}
        searchPlaceholder='Rechercher un package...'
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
                  {query.isLoading ? 'Chargement...' : 'Aucun package trouvé.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        table={table}
        className='mt-auto'
        totalCount={total}
      />
    </div>
  )
}
