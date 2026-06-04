import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
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
import { DataTablePagination } from '@/components/data-table'
import type { BookingWithRelations } from '../hooks/use-bookings'
import { BookingsBulkActions } from './bookings-bulk-actions'
import { buildBookingsColumns } from './bookings-columns'

type OrgUser = { id: string; first_name: string; last_name: string }

type BookingsTableProps = {
  data: BookingWithRelations[]
  users: OrgUser[]
  sorting?: SortingState
  pageCount?: number
  pageIndex?: number
  pageSize?: number
  onPageChange?: (pageIndex: number) => void
}

export function BookingsTable({
  data,
  users,
  sorting: externalSorting,
  pageCount,
  pageIndex,
  pageSize = 50,
  onPageChange,
}: BookingsTableProps) {
  const columns = useMemo(() => buildBookingsColumns(users), [users])
  const navigate = useNavigate()
  const [rowSelection, setRowSelection] = useState({})
  const [sorting, setSorting] = useState<SortingState>(
    externalSorting || [{ id: 'event_date', desc: false }]
  )

  useEffect(() => {
    if (externalSorting) setSorting(externalSorting)
  }, [externalSorting])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const manualPagination = onPageChange !== undefined

  const table = useReactTable({
    data,
    columns,
    // 50 lignes par défaut (au lieu des 10 par défaut de TanStack Table).
    // L'utilisateur peut toujours changer via le sélecteur de pagination.
    initialState: manualPagination
      ? undefined
      : { pagination: { pageSize: 50, pageIndex: 0 } },
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      ...(manualPagination
        ? { pagination: { pageIndex: pageIndex ?? 0, pageSize } }
        : {}),
    },
    enableRowSelection: true,
    manualPagination,
    ...(manualPagination ? { pageCount } : {}),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: manualPagination
      ? (updater) => {
          const next =
            typeof updater === 'function'
              ? updater({ pageIndex: pageIndex ?? 0, pageSize })
              : updater
          onPageChange(next.pageIndex)
        }
      : undefined,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination
      ? undefined
      : getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='overflow-hidden rounded-md border'>
        <Table className='min-w-[1200px]'>
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
                  onClick={() =>
                    navigate({
                      to: '/evenements/booking/$id',
                      params: { id: row.original.id },
                    })
                  }
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
                  Aucun événement.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} className='mt-auto' />
      <BookingsBulkActions table={table} />
    </div>
  )
}
