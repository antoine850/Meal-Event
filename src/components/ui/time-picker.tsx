import * as React from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TimePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
const MINUTES = ['00', '15', '30', '45']

export function TimePicker({
  value,
  onChange,
  placeholder = 'HH:MM',
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selectedHour = value ? value.split(':')[0] : ''
  const selectedMinute = value ? value.split(':')[1] : ''

  // Snap minute to nearest quarter
  const snappedMinute = selectedMinute
    ? MINUTES.reduce((prev, curr) =>
        Math.abs(parseInt(curr) - parseInt(selectedMinute)) < Math.abs(parseInt(prev) - parseInt(selectedMinute))
          ? curr
          : prev
      )
    : ''

  const handleSelect = (hour: string, minute: string) => {
    onChange(`${hour}:${minute}`)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          className={cn(
            'w-full justify-start text-left font-normal h-8',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <Clock className='mr-2 h-4 w-4' />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-3' align='start'>
        <div className='flex gap-3'>
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium text-muted-foreground'>Heures</label>
            <ScrollArea className='h-48'>
              <div className='flex flex-col gap-0.5 pr-2'>
                {HOURS.map((h) => (
                  <Button
                    key={h}
                    variant={selectedHour === h ? 'default' : 'ghost'}
                    size='sm'
                    className='w-12 h-7 text-sm'
                    onClick={() => handleSelect(h, snappedMinute || '00')}
                  >
                    {h}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium text-muted-foreground'>Minutes</label>
            <div className='flex flex-col gap-0.5'>
              {MINUTES.map((m) => (
                <Button
                  key={m}
                  variant={snappedMinute === m ? 'default' : 'ghost'}
                  size='sm'
                  className='w-12 h-7 text-sm'
                  onClick={() => handleSelect(selectedHour || '12', m)}
                >
                  {m}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
