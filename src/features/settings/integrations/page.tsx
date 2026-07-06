import { Main } from '@/components/layout/main'
import { GmailSettings } from './components/gmail-settings'

export function IntegrationsPage() {
  return (
    <Main>
      <div className='space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>Intégrations</h1>
        <p className='text-muted-foreground'>
          Connectez vos outils personnels au CRM.
        </p>
      </div>
      <div className='mt-6 max-w-2xl'>
        <GmailSettings />
      </div>
    </Main>
  )
}
