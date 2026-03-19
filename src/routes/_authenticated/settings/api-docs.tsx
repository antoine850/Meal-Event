import { createFileRoute } from '@tanstack/react-router'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { ApiDocsSettings } from '@/features/settings/api-docs'

export const Route = createFileRoute('/_authenticated/settings/api-docs')({
  component: ApiDocsPage,
})

function ApiDocsPage() {
  return (
    <>
      <Header fixed>
        <h1 className='text-lg font-semibold'>Documentation API</h1>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col'>
        <ApiDocsSettings />
      </Main>
    </>
  )
}
