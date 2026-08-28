import { AuthSplash } from './auth-splash'

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
        <div className='mx-auto flex w-full max-w-sm flex-col justify-center space-y-4'>
          {(title || subtitle) && (
            <div className='flex flex-col space-y-2 text-start'>
              {title && (
                <h2 className='text-lg font-semibold tracking-tight'>
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className='text-sm text-muted-foreground'>{subtitle}</p>
              )}
            </div>
          )}
          {children}
        </div>
      </div>

      {/* Right side - Brand animation */}
      <div className='relative h-full overflow-hidden bg-muted max-lg:hidden'>
        <AuthSplash />
      </div>
    </div>
  )
}
