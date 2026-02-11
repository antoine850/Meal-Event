import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { SpacesSettings } from './index'

export function SpacesPage() {
  return (
    <>
      <Header>
        <h1 className='text-2xl font-bold tracking-tight'>Espaces</h1>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col'>
        <SpacesSettings />
      </Main>
    </>
  )
}
