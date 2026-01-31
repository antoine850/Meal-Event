import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar, Mail, MapPin, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { type Contact, contactStatuses } from '../data/contacts'

type ContactsKanbanProps = {
  data: Contact[]
}

function KanbanCard({ contact }: { contact: Contact }) {
  return (
    <Card className='mb-3 cursor-pointer hover:shadow-md transition-shadow'>
      <CardHeader className='p-3 pb-2'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex-1 min-w-0'>
            <h4 className='font-medium text-sm truncate'>{contact.companyName}</h4>
            <p className='text-xs text-muted-foreground truncate'>{contact.contactName}</p>
          </div>
          {contact.devisHT && (
            <Badge variant='outline' className='bg-yellow-50 text-yellow-700 border-yellow-200 text-xs shrink-0'>
              {contact.devisHT.toLocaleString('fr-FR')} €
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className='p-3 pt-0 space-y-2'>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <Calendar className='h-3 w-3' />
          <span>{format(contact.date, 'dd MMM yyyy', { locale: fr })} à {contact.time}</span>
        </div>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <MapPin className='h-3 w-3' />
          <span className='truncate'>{contact.espace}</span>
        </div>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <Users className='h-3 w-3' />
          <span>{contact.guests} personnes - {contact.occasion}</span>
        </div>
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <Mail className='h-3 w-3' />
          <span className='truncate'>{contact.email}</span>
        </div>
        <div className='pt-2 border-t'>
          <span className='text-xs text-muted-foreground'>Assigné: {contact.assignee}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function KanbanColumn({ status, contacts }: { status: typeof contactStatuses[number], contacts: Contact[] }) {
  const columnContacts = contacts.filter(c => c.status === status.value)
  
  return (
    <div className='flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg'>
      <div className='p-3 border-b'>
        <div className={cn('h-1 w-full rounded-full mb-2', status.color)} />
        <div className='flex items-center justify-between'>
          <h3 className='font-medium text-sm'>{status.label}</h3>
          <Badge variant='secondary' className='text-xs'>{columnContacts.length}</Badge>
        </div>
      </div>
      <ScrollArea className='flex-1 p-2'>
        <div className='space-y-0'>
          {columnContacts.map((contact) => (
            <KanbanCard key={contact.id} contact={contact} />
          ))}
          {columnContacts.length === 0 && (
            <p className='text-xs text-muted-foreground text-center py-4'>
              Aucun contact
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function ContactsKanban({ data }: ContactsKanbanProps) {
  return (
    <ScrollArea className='w-full'>
      <div className='flex gap-4 pb-4 min-h-[500px]'>
        {contactStatuses.map((status) => (
          <KanbanColumn key={status.value} status={status} contacts={data} />
        ))}
      </div>
      <ScrollBar orientation='horizontal' />
    </ScrollArea>
  )
}
