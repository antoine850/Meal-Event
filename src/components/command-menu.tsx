import React, { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowRight, ChevronRight, Laptop, Moon, Sun, User, Calendar } from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { sidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'
import { useContacts } from '@/features/contacts/hooks/use-contacts'
import { useCompanies } from '@/features/companies/hooks/use-companies'
import { useBookings } from '@/features/reservations/hooks/use-bookings'

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const [searchQuery, setSearchQuery] = useState('')
  
  const { data: contacts = [] } = useContacts()
  const { data: companies = [] } = useCompanies()
  const { data: bookings = [] } = useBookings()

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return { contacts: [], companies: [], bookings: [] }
    
    const query = searchQuery.toLowerCase()
    
    return {
      contacts: contacts.filter(c => 
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query)
      ).slice(0, 5),
      companies: companies.filter(c => 
        c.name?.toLowerCase().includes(query)
      ).slice(0, 5),
      bookings: bookings.filter(b => 
        b.occasion?.toLowerCase().includes(query) ||
        b.restaurant?.name?.toLowerCase().includes(query)
      ).slice(0, 5),
    }
  }, [searchQuery, contacts, companies, bookings])

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
              {filteredResults.contacts.length > 0 && (
                <CommandGroup heading='Contacts'>
                  {filteredResults.contacts.map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={`${contact.first_name} ${contact.last_name}`}
                      onSelect={() => {
                        runCommand(() => navigate({ to: '/contacts/contact/$id', params: { id: contact.id } }))
                      }}
                    >
                      <User className='mr-2 h-4 w-4' />
                      <span>{contact.first_name} {contact.last_name}</span>
                      {contact.email && <span className='ml-2 text-xs text-muted-foreground'>{contact.email}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {filteredResults.bookings.length > 0 && (
                <CommandGroup heading='Bookings'>
                  {filteredResults.bookings.map((booking) => (
                    <CommandItem
                      key={booking.id}
                      value={booking.occasion || booking.id}
                      onSelect={() => {
                        runCommand(() => navigate({ to: '/evenements/booking/$id', params: { id: booking.id } }))
                      }}
                    >
                      <Calendar className='mr-2 h-4 w-4' />
                      <span>{booking.occasion || 'Event'}</span>
                      {booking.restaurant && <span className='ml-2 text-xs text-muted-foreground'>{booking.restaurant.name}</span>}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {filteredResults.contacts.length === 0 && filteredResults.companies.length === 0 && filteredResults.bookings.length === 0 && (
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
