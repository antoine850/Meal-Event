import { format, parseISO } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Calendar as CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  formatStr?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Sélectionner une date',
  className,
  disabled,
  formatStr = 'PPP',
}: DatePickerProps) {
  const date = value ? parseISO(value) : undefined
  const label = date ? format(date, formatStr, { locale: fr }) : null

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          disabled={disabled}
          className={cn(
            'h-8 w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className='mr-2 h-4 w-4' />
          {label ? label.charAt(0).toUpperCase() + label.slice(1) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='single'
          selected={date}
          onSelect={(newDate) => {
            if (newDate) {
              onChange(format(newDate, 'yyyy-MM-dd'))
            }
          }}
          disabled={(date) => date > new Date('2100-01-01')}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
