import { ExternalLink, Mail, Phone, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import type { ContactWithRelations } from '../types'

type ContactsCardsProps = {
  data: ContactWithRelations[]
}

function ContactCard({ contact }: { contact: ContactWithRelations }) {
  const initials = `${contact.first_name?.[0] || ''}${contact.last_name?.[0] || ''}`.toUpperCase() || '?'

  return (
    <Card className='hover:shadow-md transition-shadow'>
      <CardHeader className='pb-3'>
        <div className='flex items-start gap-3'>
          <Avatar className='h-10 w-10'>
            <AvatarFallback className='bg-primary/10 text-primary text-sm'>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className='flex-1 min-w-0'>
            <h3 className='font-semibold text-sm truncate'>
              {contact.first_name} {contact.last_name || ''}
            </h3>
            <p className='text-xs text-muted-foreground truncate'>
              {contact.company?.name || '-'}
            </p>
          </div>
          {contact.status && (
            <Badge 
              variant='outline' 
              className={cn('text-xs shrink-0', contact.status.color)}
            >
              {contact.status.name}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className='pb-3 space-y-3'>
        {contact.job_title && (
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Building2 className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>{contact.job_title}</span>
          </div>
        )}
        
        <div className='space-y-1.5 pt-2 border-t'>
          {contact.email && (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <Mail className='h-3.5 w-3.5 shrink-0' />
              <span className='truncate'>{contact.email}</span>
            </div>
          )}
          {(contact.phone || contact.mobile) && (
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
              <Phone className='h-3.5 w-3.5 shrink-0' />
              <span>{contact.phone || contact.mobile}</span>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className='pt-0 flex items-center justify-between'>
        {contact.assigned_user ? (
          <span className='text-xs text-muted-foreground'>
            Assigné: <span className='font-medium'>
              {contact.assigned_user.first_name} {contact.assigned_user.last_name}
            </span>
          </span>
        ) : (
          <span className='text-xs text-muted-foreground'>Non assigné</span>
        )}
        <Button variant='ghost' size='sm' className='h-7 px-2'>
          <ExternalLink className='h-3.5 w-3.5' />
        </Button>
      </CardFooter>
    </Card>
  )
}

export function ContactsCards({ data }: ContactsCardsProps) {
  return (
    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
      {data.map((contact) => (
        <ContactCard key={contact.id} contact={contact} />
      ))}
      {data.length === 0 && (
        <div className='col-span-full text-center py-8 text-muted-foreground'>
          Aucun contact trouvé
        </div>
      )}
    </div>
  )
}
