import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
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
import type { ContactWithRelations } from '../types'
import { ContactsBulkActions } from './contacts-bulk-actions'
import { contactsColumns as columns } from './contacts-columns'

type ContactsTableProps = {
  data: ContactWithRelations[]
  sorting?: SortingState
  total: number
  pageIndex: number
  onPageChange: (page: number) => void
  pageSize: number
  isLoading?: boolean
}

export function ContactsTable({
  data,
  sorting: externalSorting,
  total,
  pageIndex,
  onPageChange,
  pageSize,
  isLoading,
}: ContactsTableProps) {
  const [rowSelection, setRowSelection] = useState({})
  const [sorting, setSorting] = useState<SortingState>(
    externalSorting || [{ id: 'created_at', desc: true }]
  )

  useEffect(() => {
    if (externalSorting) setSorting(externalSorting)
  }, [externalSorting])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const navigate = useNavigate()

  const table = useReactTable({
    data,
    columns,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination: { pageIndex, pageSize },
    },
    enableRowSelection: true,
    enableSorting: false,
    manualPagination: true,
    manualSorting: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize })
          : updater
      onPageChange(next.pageIndex)
    },
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className='flex flex-1 flex-col gap-4'>
      <div className='overflow-hidden rounded-md border'>
        <Table className='min-w-[1200px]'>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
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
                  )
                })}
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
                  onClick={(e) => {
                    // Don't navigate if clicking on checkbox or action button
                    const target = e.target as HTMLElement
                    if (
                      target.closest('[role="checkbox"]') ||
                      target.closest('button') ||
                      target.closest('a')
                    ) {
                      return
                    }
                    navigate({
                      to: '/contacts/contact/$id',
                      params: { id: row.original.id },
                    })
                  }}
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
                  {isLoading ? 'Chargement...' : 'Aucun résultat.'}
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
      <ContactsBulkActions table={table} />
    </div>
  )
}
