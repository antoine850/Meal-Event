import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { MenusPage } from './page'

export function SettingsMenus() {
  return (
    <>
      <Header fixed>
        <h1 className='text-lg font-semibold'>Menus</h1>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col'>
        <MenusPage />
      </Main>
    </>
  )
}
