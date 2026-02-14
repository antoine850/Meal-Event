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
import { useCompanies, useCreateCompany } from '../hooks/use-contacts'

type CompanyComboboxProps = {
  value?: string | null
  onChange: (companyId: string | null) => void
}

export function CompanyCombobox({ value, onChange }: CompanyComboboxProps) {
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [searchValue, setSearchValue] = useState('')

  const { data: companies = [] } = useCompanies()
  const { mutate: createCompany, isPending } = useCreateCompany()

  const selectedCompany = companies.find(c => c.id === value)

  const handleCreate = () => {
    if (!newCompanyName.trim()) return

    createCompany(
      { name: newCompanyName.trim() },
      {
        onSuccess: (data) => {
          onChange(data.id)
          setCreateOpen(false)
          setNewCompanyName('')
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
                    setNewCompanyName(searchValue)
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
        <DialogContent className='sm:max-w-[400px]'>
          <DialogHeader>
            <DialogTitle>Nouvelle société</DialogTitle>
          </DialogHeader>
          <div className='space-y-4 py-2'>
            <div className='space-y-2'>
              <Label htmlFor='company-name'>Nom de la société *</Label>
              <Input
                id='company-name'
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                placeholder='Nom de la société'
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleCreate()
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreate} disabled={isPending || !newCompanyName.trim()}>
              {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
