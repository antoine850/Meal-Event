import { useState } from 'react'
import {
  type SortingState,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Loader2, Plus, Trash2, Building } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search as SearchIcon } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { DataTableBulkActions as BulkActionsToolbar, DataTablePagination } from '@/components/data-table'
import { useCompanies, type Company } from './hooks/use-companies'
import { CompanyDialog } from './company-dialog'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

const companiesColumns: ColumnDef<Company>[] = [
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
        onClick={(e) => e.stopPropagation()}
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
    header: 'Nom',
    cell: ({ row }) => <span className='font-medium'>{row.original.name}</span>,
  },
  {
    accessorKey: 'phone',
    header: 'Téléphone',
    cell: ({ row }) => row.original.phone || '-',
  },
  {
    accessorKey: 'billing_email',
    header: 'Email Facturation',
    cell: ({ row }) => row.original.billing_email || '-',
  },
  {
    accessorKey: 'billing_city',
    header: 'Ville',
    cell: ({ row }) => row.original.billing_city || '-',
    meta: { className: 'hidden md:table-cell' },
  },
  {
    accessorKey: 'created_at',
    header: 'Créé le',
    cell: ({ row }) => {
      if (!row.original.created_at) return '-'
      return new Date(row.original.created_at).toLocaleDateString('fr-FR')
    },
  },
]

function CompaniesBulkActions({ table }: { table: ReturnType<typeof useReactTable<Company>> }) {
  const queryClient = useQueryClient()
  const selectedRows = table.getFilteredSelectedRowModel().rows
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const handleBulkDelete = async () => {
    const ids = selectedRows.map((row) => row.original.id)
    const count = ids.length

    try {
      const { error } = await (supabase as any)
        .from('companies')
        .delete()
        .in('id', ids)

      if (error) throw error

      table.resetRowSelection()
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success(`${count} société${count > 1 ? 's' : ''} supprimée${count > 1 ? 's' : ''}.`)
    } catch {
      toast.error('Erreur lors de la suppression.')
    }
  }

  const count = selectedRows.length

  return (
    <>
      <BulkActionsToolbar table={table} entityName='société'>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant='destructive'
              size='icon'
              onClick={() => setDeleteDialogOpen(true)}
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer {count} société{count > 1 ? 's' : ''} ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
              onClick={handleBulkDelete}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function CompaniesPage() {
  const { data: companies = [], isLoading } = useCompanies()
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [rowSelection, setRowSelection] = useState({})
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: companies,
    columns: companiesColumns,
    state: {
      sorting,
      rowSelection,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const handleRowClick = (company: Company) => {
    setEditingCompany(company)
    setIsDialogOpen(true)
  }

  const handleCreate = () => {
    setEditingCompany(null)
    setIsDialogOpen(true)
  }

  return (
    <>
      <Header>
        <div className='flex items-center gap-4'>
          <Building className='h-6 w-6 text-muted-foreground' />
          <h1 className='text-xl font-bold tracking-tight'>Sociétés</h1>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <SearchIcon />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col space-y-4'>
        <div className='flex justify-end'>
          <Button onClick={handleCreate}>
            <Plus className='mr-2 h-4 w-4' />
            Ajouter une société
          </Button>
        </div>

        {isLoading ? (
          <div className='flex items-center justify-center py-10'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <div className='flex flex-1 flex-col gap-4'>
            <div className='rounded-md border bg-card'>
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          className={header.column.columnDef.meta?.className}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
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
                        onClick={(e) => {
                          const target = e.target as HTMLElement
                          if (
                            target.closest('[role="checkbox"]') ||
                            target.closest('button')
                          ) {
                            return
                          }
                          handleRowClick(row.original)
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell
                            key={cell.id}
                            className={cell.column.columnDef.meta?.className}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={companiesColumns.length} className='text-center text-muted-foreground py-8'>
                        Aucune société trouvée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <DataTablePagination table={table} className='mt-auto' />
            <CompaniesBulkActions table={table} />
          </div>
        )}
      </Main>

      <CompanyDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        company={editingCompany}
      />
    </>
  )
}
