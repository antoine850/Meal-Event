import { Mail, Phone, Building2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import type { ContactWithRelations, StatusCount } from '../types'

type ContactsKanbanProps = {
  data: ContactWithRelations[]
  statuses?: StatusCount[]
}

function KanbanCard({ contact }: { contact: ContactWithRelations }) {
  return (
    <Card className='mb-3 cursor-pointer hover:shadow-md transition-shadow'>
      <CardHeader className='p-3 pb-2'>
        <div className='flex items-start justify-between gap-2'>
          <div className='flex-1 min-w-0'>
            <h4 className='font-medium text-sm truncate'>
              {contact.first_name} {contact.last_name || ''}
            </h4>
            <p className='text-xs text-muted-foreground truncate'>
              {contact.company?.name || '-'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className='p-3 pt-0 space-y-2'>
        {contact.job_title && (
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Building2 className='h-3 w-3' />
            <span className='truncate'>{contact.job_title}</span>
          </div>
        )}
        {contact.email && (
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Mail className='h-3 w-3' />
            <span className='truncate'>{contact.email}</span>
          </div>
        )}
        {(contact.phone || contact.mobile) && (
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Phone className='h-3 w-3' />
            <span>{contact.phone || contact.mobile}</span>
          </div>
        )}
        {contact.assigned_user && (
          <div className='pt-2 border-t'>
            <span className='text-xs text-muted-foreground'>
              Assigné: {contact.assigned_user.first_name} {contact.assigned_user.last_name}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function KanbanColumn({ status, contacts }: { status: StatusCount, contacts: ContactWithRelations[] }) {
  const columnContacts = contacts.filter(c => c.status?.slug === status.value)
  
  return (
    <div className='flex flex-col min-w-[280px] max-w-[280px] bg-muted/30 rounded-lg'>
      <div className='p-3 border-b'>
        <div 
          className='h-1 w-full rounded-full mb-2' 
          style={{ backgroundColor: status.color || '#6b7280' }}
        />
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

export function ContactsKanban({ data, statuses = [] }: ContactsKanbanProps) {
  return (
    <ScrollArea className='w-full'>
      <div className='flex gap-4 pb-4 min-h-[500px]'>
        {statuses.map((status) => (
          <KanbanColumn key={status.value} status={status} contacts={data} />
        ))}
      </div>
      <ScrollBar orientation='horizontal' />
    </ScrollArea>
  )
}
