import { useState, useMemo } from 'react'
import { Kanban, LayoutGrid, Table2 } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { StatusCards } from './components/status-cards'
import { ContactsTable } from './components/contacts-table'
import { ContactsKanban } from './components/contacts-kanban'
import { ContactsCards } from './components/contacts-cards'
import { contacts, getStatusCounts } from './data/contacts'

type ViewMode = 'table' | 'kanban' | 'cards'

export function Contacts() {
  const [activeStatus, setActiveStatus] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('table')
  const statusCounts = getStatusCounts()

  const filteredContacts = useMemo(() => {
    if (!activeStatus) return contacts
    return contacts.filter(c => c.status === activeStatus)
  }, [activeStatus])

  return (
    <>
      <Header fixed>
        <h1 className='text-lg font-semibold'>Contacts</h1>
        <div className='ms-auto flex items-center space-x-4'>
          <ToggleGroup 
            type='single' 
            value={viewMode} 
            onValueChange={(value) => value && setViewMode(value as ViewMode)}
            className='hidden sm:flex'
          >
            <ToggleGroupItem value='table' aria-label='Vue tableau' className='px-3'>
              <Table2 className='h-4 w-4' />
            </ToggleGroupItem>
            <ToggleGroupItem value='kanban' aria-label='Vue kanban' className='px-3'>
              <Kanban className='h-4 w-4' />
            </ToggleGroupItem>
            <ToggleGroupItem value='cards' aria-label='Vue cartes' className='px-3'>
              <LayoutGrid className='h-4 w-4' />
            </ToggleGroupItem>
          </ToggleGroup>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <StatusCards 
          statuses={statusCounts} 
          activeStatus={activeStatus}
          onStatusClick={setActiveStatus}
        />
        
        {viewMode === 'table' && (
          <ContactsTable data={filteredContacts} statusFilter={activeStatus} />
        )}
        {viewMode === 'kanban' && (
          <ContactsKanban data={filteredContacts} />
        )}
        {viewMode === 'cards' && (
          <ContactsCards data={filteredContacts} />
        )}
      </Main>
    </>
  )
}
