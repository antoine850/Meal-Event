import { Logo } from '@/assets/logo'
import { cn } from '@/lib/utils'
import dashboardDark from './sign-in/assets/dashboard-dark.png'
import dashboardLight from './sign-in/assets/dashboard-light.png'

type AuthLayoutProps = {
  children: React.ReactNode
  title?: string
  subtitle?: string
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className='relative container grid h-svh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0'>
      {/* Left side - Form */}
      <div className='lg:p-8'>
        <div className='mx-auto flex w-full flex-col justify-center space-y-2 py-8 sm:w-[480px] sm:p-8'>
          <div className='mb-4 flex items-center justify-center'>
            <Logo className='me-2' />
            <h1 className='text-xl font-medium'>MealEvent</h1>
          </div>
        </div>
        <div className='mx-auto flex w-full max-w-sm flex-col justify-center space-y-4'>
          {(title || subtitle) && (
            <div className='flex flex-col space-y-2 text-start'>
              {title && <h2 className='text-lg font-semibold tracking-tight'>{title}</h2>}
              {subtitle && <p className='text-sm text-muted-foreground'>{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </div>

      {/* Right side - Dashboard Image */}
      <div
        className={cn(
          'relative h-full overflow-hidden bg-muted max-lg:hidden',
          '[&>img]:absolute [&>img]:top-[15%] [&>img]:left-20 [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>img]:object-top-left [&>img]:select-none'
        )}
      >
        <img
          src={dashboardLight}
          className='dark:hidden'
          width={1024}
          height={1151}
          alt='MealEvent Dashboard'
        />
        <img
          src={dashboardDark}
          className='hidden dark:block'
          width={1024}
          height={1138}
          alt='MealEvent Dashboard'
        />
      </div>
    </div>
  )
}
