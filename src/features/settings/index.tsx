import { Construction, Settings as SettingsIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

export function Settings() {
  return (
    <>
      <Header>
        <h1 className='text-2xl font-bold tracking-tight'>Paramètres</h1>
        <div className='ms-auto flex items-center space-x-4'>
          <Search />
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 items-center justify-center'>
        <Card className='max-w-md w-full'>
          <CardContent className='pt-6 text-center'>
            <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted'>
              <Construction className='h-8 w-8 text-muted-foreground' />
            </div>
            <div className='flex items-center justify-center gap-2 mb-2'>
              <SettingsIcon className='h-5 w-5' />
              <h2 className='text-xl font-semibold'>Paramètres</h2>
            </div>
            <p className='text-muted-foreground mb-4'>
              Cette section est en cours de développement et sera disponible prochainement.
            </p>
            <div className='inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary'>
              🚧 Coming Soon
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
