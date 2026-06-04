import { useMemo, useState } from 'react'
import {
  format,
  startOfDay,
  endOfDay,
  subDays,
  startOfWeek,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  endOfWeek,
  endOfMonth,
  endOfQuarter,
  endOfYear,
} from 'date-fns'
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

function buildPresets(futureAware: boolean) {
  const today = new Date()
  // En mode futureAware, les présets de période (semaine/mois/trimestre/année)
  // couvrent la période complète (utile pour filtrer des événements futurs).
  // Sinon, ils s'arrêtent à aujourd'hui (utile pour signature, création, etc.).
  const periodEnd = (endOfPeriod: Date) =>
    futureAware ? endOfPeriod : endOfDay(today)

  return [
    {
      label: "Aujourd'hui",
      range: () => ({ from: startOfDay(today), to: endOfDay(today) }),
    },
    {
      label: '7 derniers jours',
      range: () => ({
        from: startOfDay(subDays(today, 6)),
        to: endOfDay(today),
      }),
    },
    {
      label: '30 derniers jours',
      range: () => ({
        from: startOfDay(subDays(today, 29)),
        to: endOfDay(today),
      }),
    },
    {
      label: 'Cette semaine',
      range: () => ({
        from: startOfWeek(today, { locale: fr }),
        to: periodEnd(endOfWeek(today, { locale: fr })),
      }),
    },
    {
      label: 'Ce mois',
      range: () => ({
        from: startOfMonth(today),
        to: periodEnd(endOfMonth(today)),
      }),
    },
    {
      label: 'Ce trimestre',
      range: () => ({
        from: startOfQuarter(today),
        to: periodEnd(endOfQuarter(today)),
      }),
    },
    {
      label: 'Cette année',
      range: () => ({
        from: startOfYear(today),
        to: periodEnd(endOfYear(today)),
      }),
    },
  ]
}

type DateFilterProps = {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  placeholder?: string
  /**
   * Si true, les présets "Cette semaine/mois/trimestre/année" couvrent toute
   * la période (jusqu'à la fin), pas seulement jusqu'à aujourd'hui.
   * À utiliser pour les filtres sur des dates qui peuvent être futures (ex: date d'événement).
   */
  futureAware?: boolean
  /** Ajoute un preset "Tout" qui efface le filtre (toutes les dates). */
  allowAll?: boolean
}

export function DateFilter({
  value,
  onChange,
  placeholder = 'Filtrer par date',
  futureAware = false,
  allowAll = false,
}: DateFilterProps) {
  const [open, setOpen] = useState(false)
  const presets = useMemo(() => buildPresets(futureAware), [futureAware])

  const selectedLabel = value?.from
    ? value.to
      ? `Du ${format(value.from, 'dd/MM/yyyy', { locale: fr })} au ${format(value.to, 'dd/MM/yyyy', { locale: fr })}`
      : `À partir du ${format(value.from, 'dd/MM/yyyy', { locale: fr })}`
    : 'Toutes les dates'

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
        <div className='border-b px-3 py-2'>
          <p className='text-sm font-medium'>{placeholder}</p>
          <p className='text-xs text-muted-foreground'>{selectedLabel}</p>
        </div>
        <div className='flex'>
          <div className='flex flex-col gap-1 border-r p-2'>
            {allowAll && (
              <Button
                variant='ghost'
                size='sm'
                className='h-7 justify-start px-2 text-xs'
                onClick={() => {
                  onChange?.(undefined)
                  setOpen(false)
                }}
              >
                Tout
              </Button>
            )}
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant='ghost'
                size='sm'
                className='h-7 justify-start px-2 text-xs'
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
                className='h-7 justify-start px-2 text-xs text-muted-foreground'
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
            }}
            numberOfMonths={2}
            locale={fr}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
