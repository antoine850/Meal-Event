import React, { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowRight,
  ChevronRight,
  Laptop,
  Moon,
  Sun,
  User,
  Calendar,
  Building,
} from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useCompanySearch } from '@/features/companies/hooks/use-companies'
import { useContactSearch } from '@/features/contacts/hooks/use-contacts'
import { useBookingSearch } from '@/features/reservations/hooks/use-bookings'
import { sidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const [searchQuery, setSearchQuery] = useState('')

  const debouncedQuery = useDebouncedValue(searchQuery, 250)
  const { data: companyResults = [] } = useCompanySearch(
    debouncedQuery,
    !!debouncedQuery.trim()
  )
  // Recherche serveur : contacts et bookings au-dela du cap PostgREST de
  // 1000 lignes, insensible aux accents via les RPC search_contacts /
  // search_booking_ids.
  const { data: contactResults = [] } = useContactSearch(
    debouncedQuery,
    !!debouncedQuery.trim()
  )
  const { data: bookingResults = [] } = useBookingSearch(
    debouncedQuery,
    !!debouncedQuery.trim()
  )

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder='Type a command or search...'
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          {searchQuery.trim() ? (
            <>
              {contactResults.length > 0 && (
                <CommandGroup heading='Contacts'>
                  {contactResults.slice(0, 5).map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={`${contact.first_name} ${contact.last_name} ${searchQuery}`}
                      onSelect={() => {
                        runCommand(() =>
                          navigate({
                            to: '/contacts/contact/$id',
                            params: { id: contact.id },
                          })
                        )
                      }}
                    >
                      <User className='mr-2 h-4 w-4' />
                      <span>
                        {contact.first_name} {contact.last_name}
                      </span>
                      {contact.email && (
                        <span className='ml-2 text-xs text-muted-foreground'>
                          {contact.email}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {bookingResults.length > 0 && (
                <CommandGroup heading='Bookings'>
                  {bookingResults.slice(0, 5).map((booking) => (
                    <CommandItem
                      key={booking.id}
                      value={`${booking.occasion || booking.id} ${searchQuery}`}
                      onSelect={() => {
                        runCommand(() =>
                          navigate({
                            to: '/evenements/booking/$id',
                            params: { id: booking.id },
                          })
                        )
                      }}
                    >
                      <Calendar className='mr-2 h-4 w-4' />
                      <span>{booking.occasion || 'Event'}</span>
                      {booking.restaurant && (
                        <span className='ml-2 text-xs text-muted-foreground'>
                          {booking.restaurant.name}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {companyResults.length > 0 && (
                <CommandGroup heading='Sociétés'>
                  {companyResults.slice(0, 5).map((company) => (
                    <CommandItem
                      key={company.id}
                      value={`${company.name} ${searchQuery}`}
                      onSelect={() => {
                        runCommand(() => navigate({ to: '/companies' }))
                      }}
                    >
                      <Building className='mr-2 h-4 w-4' />
                      <span>{company.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {contactResults.length === 0 &&
                companyResults.length === 0 &&
                bookingResults.length === 0 && (
                  <CommandEmpty>No results found.</CommandEmpty>
                )}
              <CommandSeparator />
            </>
          ) : (
            <CommandEmpty>No results found.</CommandEmpty>
          )}
          {sidebarData.navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem, i) => {
                if (navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={navItem.title}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                    >
                      <div className='flex size-4 items-center justify-center'>
                        <ArrowRight className='size-2 text-muted-foreground/80' />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  )

                return navItem.items?.map((subItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${i}`}
                    value={`${navItem.title}-${subItem.url}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }))
                    }}
                  >
                    <div className='flex size-4 items-center justify-center'>
                      <ArrowRight className='size-2 text-muted-foreground/80' />
                    </div>
                    {navItem.title} <ChevronRight /> {subItem.title}
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading='Theme'>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>Light</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>Dark</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
