import { useState } from 'react'
import { Loader2, MoreHorizontal, Pencil, Plus, Trash2, Building } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search as SearchIcon } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { useCompanies, useDeleteCompany, type Company } from './hooks/use-companies'
import { CompanyDialog } from './company-dialog'

export function CompaniesPage() {
  const { data: companies = [], isLoading } = useCompanies()
  const { mutate: deleteCompany } = useDeleteCompany()
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette société ?')) {
      deleteCompany(id, {
        onSuccess: () => toast.success('Société supprimée'),
        onError: () => toast.error('Erreur lors de la suppression'),
      })
    }
  }

  const handleEdit = (company: Company) => {
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
          <div className='rounded-md border bg-card'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Email Facturation</TableHead>
                  <TableHead className='hidden md:table-cell'>Ville</TableHead>
                  <TableHead className='w-[70px]'></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className='text-center text-muted-foreground py-8'>
                      Aucune société trouvée
                    </TableCell>
                  </TableRow>
                ) : (
                  companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className='font-medium'>{company.name}</TableCell>
                      <TableCell>{company.phone || '-'}</TableCell>
                      <TableCell>{company.billing_email || '-'}</TableCell>
                      <TableCell className='hidden md:table-cell'>{company.billing_city || '-'}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant='ghost' size='icon' className='h-8 w-8'>
                              <MoreHorizontal className='h-4 w-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem onClick={() => handleEdit(company)}>
                              <Pencil className='mr-2 h-4 w-4' />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className='text-destructive'
                              onClick={() => handleDelete(company.id)}
                            >
                              <Trash2 className='mr-2 h-4 w-4' />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
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
