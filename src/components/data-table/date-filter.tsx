import { useState } from 'react'
import { format, startOfDay, endOfDay, subDays, startOfWeek, startOfMonth, startOfQuarter, startOfYear } from 'date-fns'
import { fr } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import { type DateRange } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

const DATE_PRESETS = [
  {
    label: "Aujourd'hui",
    range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }),
  },
  {
    label: '7 derniers jours',
    range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }),
  },
  {
    label: '30 derniers jours',
    range: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }),
  },
  {
    label: 'Cette semaine',
    range: () => ({ from: startOfWeek(new Date(), { locale: fr }), to: endOfDay(new Date()) }),
  },
  {
    label: 'Ce mois',
    range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }),
  },
  {
    label: 'Ce trimestre',
    range: () => ({ from: startOfQuarter(new Date()), to: endOfDay(new Date()) }),
  },
  {
    label: 'Cette année',
    range: () => ({ from: startOfYear(new Date()), to: endOfDay(new Date()) }),
  },
]

type DateFilterProps = {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
}

export function DateFilter({ 
  value, 
  onChange, 
  placeholder = 'Filtrer par date' 
}: DateFilterProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className={cn(
            'h-8 justify-start text-left font-normal',
            !value && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className='mr-2 h-4 w-4' />
          {value?.from ? (
            value.to ? (
              <>
                {format(value.from, 'dd/MM/yy', { locale: fr })} -{' '}
                {format(value.to, 'dd/MM/yy', { locale: fr })}
              </>
            ) : (
              format(value.from, 'dd/MM/yyyy', { locale: fr })
            )
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <div className='flex'>
          <div className='flex flex-col border-r p-2 gap-1'>
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                variant='ghost'
                size='sm'
                className='justify-start text-xs h-7 px-2'
                onClick={() => {
                  onChange?.(preset.range())
                  setOpen(false)
                }}
              >
                {preset.label}
              </Button>
            ))}
            {value && (
              <Button
                variant='ghost'
                size='sm'
                className='justify-start text-xs h-7 px-2 text-muted-foreground'
                onClick={() => {
                  onChange?.(undefined)
                  setOpen(false)
                }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
          <Calendar
            initialFocus
            mode='range'
            defaultMonth={value?.from}
            selected={value}
            onSelect={(range) => {
              onChange?.(range)
              if (range?.from && range?.to) {
                setOpen(false)
              }
            }}
            numberOfMonths={2}
            locale={fr}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
