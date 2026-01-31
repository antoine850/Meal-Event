import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar, ExternalLink, Mail, MapPin, Phone, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { type Contact, contactStatuses } from '../data/contacts'

type ContactsCardsProps = {
  data: Contact[]
}

function ContactCard({ contact }: { contact: Contact }) {
  const status = contactStatuses.find(s => s.value === contact.status)
  const initials = contact.contactName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

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
            <h3 className='font-semibold text-sm truncate'>{contact.companyName}</h3>
            <p className='text-xs text-muted-foreground truncate'>{contact.contactName}</p>
          </div>
          <Badge 
            variant='outline' 
            className={cn('text-xs shrink-0', status?.color.replace('bg-', 'border-'))}
          >
            {status?.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className='pb-3 space-y-3'>
        <div className='grid grid-cols-2 gap-2 text-xs'>
          <div className='flex items-center gap-2 text-muted-foreground'>
            <Calendar className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>{format(contact.date, 'dd MMM yyyy', { locale: fr })}</span>
          </div>
          <div className='flex items-center gap-2 text-muted-foreground'>
            <Users className='h-3.5 w-3.5 shrink-0' />
            <span>{contact.guests} pers.</span>
          </div>
          <div className='flex items-center gap-2 text-muted-foreground'>
            <MapPin className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>{contact.espace}</span>
          </div>
          <div className='flex items-center gap-2 text-muted-foreground'>
            <span className='truncate'>{contact.occasion}</span>
          </div>
        </div>
        
        <div className='space-y-1.5 pt-2 border-t'>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Mail className='h-3.5 w-3.5 shrink-0' />
            <span className='truncate'>{contact.email}</span>
          </div>
          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Phone className='h-3.5 w-3.5 shrink-0' />
            <span>{contact.phone}</span>
          </div>
        </div>

        <div className='flex items-center justify-between pt-2 border-t'>
          <div className='flex gap-2'>
            {contact.devisHT && (
              <Badge variant='outline' className='bg-yellow-50 text-yellow-700 border-yellow-200 text-xs'>
                Devis: {contact.devisHT.toLocaleString('fr-FR')} €
              </Badge>
            )}
            {contact.facturesHT && (
              <Badge variant='outline' className='bg-green-50 text-green-700 border-green-200 text-xs'>
                Facture: {contact.facturesHT.toLocaleString('fr-FR')} €
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className='pt-0 flex items-center justify-between'>
        <span className='text-xs text-muted-foreground'>
          Assigné: <span className='font-medium'>{contact.assignee}</span>
        </span>
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
