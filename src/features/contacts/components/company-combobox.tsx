import { useState } from 'react'
import { Check, ChevronsUpDown, Plus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCompanies, useCreateCompany } from '../../companies/hooks/use-companies'

type CompanyComboboxProps = {
  value?: string | null
  onChange: (companyId: string | null) => void
}

export function CompanyCombobox({ value, onChange }: CompanyComboboxProps) {
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newCompany, setNewCompany] = useState({
    name: '',
    phone: '',
    billing_email: '',
    siret: '',
    tva_number: '',
    billing_address: '',
    billing_postal_code: '',
    billing_city: '',
    billing_country: 'France',
  })
  const [searchValue, setSearchValue] = useState('')

  const { data: companies = [] } = useCompanies()
  const { mutate: createCompany, isPending } = useCreateCompany()

  const selectedCompany = companies.find(c => c.id === value)

  const handleCreate = () => {
    if (!newCompany.name.trim()) return

    createCompany(
      { 
        name: newCompany.name.trim(),
        phone: newCompany.phone || null,
        billing_email: newCompany.billing_email || null,
        siret: newCompany.siret || null,
        tva_number: newCompany.tva_number || null,
        billing_address: newCompany.billing_address || null,
        billing_postal_code: newCompany.billing_postal_code || null,
        billing_city: newCompany.billing_city || null,
        billing_country: newCompany.billing_country || 'France',
      },
      {
        onSuccess: (data) => {
          onChange(data.id)
          setCreateOpen(false)
          setNewCompany({
            name: '',
            phone: '',
            billing_email: '',
            siret: '',
            tva_number: '',
            billing_address: '',
            billing_postal_code: '',
            billing_city: '',
            billing_country: 'France',
          })
          setOpen(false)
          toast.success('Société créée')
        },
        onError: () => {
          toast.error('Erreur lors de la création')
        },
      }
    )
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className='w-full justify-between font-normal'
          >
            {selectedCompany ? selectedCompany.name : 'Sélectionner une société...'}
            <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-[350px] p-0' align='start'>
          <Command>
            <CommandInput 
              placeholder='Rechercher une société...' 
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>Aucune société trouvée.</CommandEmpty>
              <CommandGroup>
                {value && (
                  <CommandItem
                    onSelect={() => {
                      onChange(null)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn('mr-2 h-4 w-4', 'invisible')} />
                    <span className='text-muted-foreground'>Aucune société</span>
                  </CommandItem>
                )}
                {companies.map((company) => (
                  <CommandItem
                    key={company.id}
                    value={company.name}
                    onSelect={() => {
                      onChange(company.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === company.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {company.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setNewCompany(prev => ({ ...prev, name: searchValue }))
                    setCreateOpen(true)
                    setOpen(false)
                  }}
                >
                  <Plus className='mr-2 h-4 w-4' />
                  Créer une nouvelle société
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className='sm:max-w-[500px]'>
          <DialogHeader>
            <DialogTitle>Nouvelle société</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='name'>Nom de la société *</Label>
                <Input
                  id='name'
                  value={newCompany.name}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, name: e.target.value }))}
                  placeholder='Nom de la société'
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='phone'>Téléphone</Label>
                <Input
                  id='phone'
                  value={newCompany.phone}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder='Téléphone'
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='billing_email'>Email de facturation</Label>
                <Input
                  id='billing_email'
                  type='email'
                  value={newCompany.billing_email}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, billing_email: e.target.value }))}
                  placeholder='Email'
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='tva_number'>Numéro de TVA</Label>
                <Input
                  id='tva_number'
                  value={newCompany.tva_number}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, tva_number: e.target.value }))}
                  placeholder='Numéro de TVA'
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
            </div>

            <div className='grid grid-cols-2 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='siret'>SIRET</Label>
                <Input
                  id='siret'
                  value={newCompany.siret}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, siret: e.target.value }))}
                  placeholder='SIRET'
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='billing_address'>Adresse de facturation</Label>
              <Input
                id='billing_address'
                value={newCompany.billing_address}
                onChange={(e) => setNewCompany(prev => ({ ...prev, billing_address: e.target.value }))}
                placeholder='Adresse'
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div className='grid grid-cols-3 gap-4'>
              <div className='space-y-2'>
                <Label htmlFor='postal_code'>Code postal</Label>
                <Input
                  id='postal_code'
                  value={newCompany.billing_postal_code}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, billing_postal_code: e.target.value }))}
                  placeholder='CP'
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='city'>Ville</Label>
                <Input
                  id='city'
                  value={newCompany.billing_city}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, billing_city: e.target.value }))}
                  placeholder='Ville'
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className='space-y-2'>
                <Label htmlFor='country'>Pays</Label>
                <Input
                  id='country'
                  value={newCompany.billing_country}
                  onChange={(e) => setNewCompany(prev => ({ ...prev, billing_country: e.target.value }))}
                  placeholder='Pays'
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !newCompany.name.trim()}>
              {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
