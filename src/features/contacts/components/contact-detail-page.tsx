import { useParams } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ContactDetail } from './contact-detail'
import { useContact } from '../hooks/use-contacts'

export function ContactDetailPage() {
  const { id } = useParams({ from: '/_authenticated/tasks/contact/$id' })
  const { data: contact, isLoading } = useContact(id)

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!contact) {
    return (
      <>
        <Header>
          <h1 className='text-2xl font-bold tracking-tight'>Contact non trouvé</h1>
        </Header>
        <Main className='flex flex-1 flex-col items-center justify-center'>
          <p className='text-muted-foreground'>Ce contact n'existe pas ou a été supprimé.</p>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header>
        <h1 className='hidden sm:block text-2xl font-bold tracking-tight'>
          {contact.first_name} {contact.last_name || ''}
        </h1>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col'>
        <ContactDetail contact={contact} />
      </Main>
    </>
  )
}
