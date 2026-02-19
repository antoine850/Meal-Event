import * as React from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface TimePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function TimePicker({
  value,
  onChange,
  placeholder = 'HH:MM',
  className,
}: TimePickerProps) {
  const [hours, setHours] = React.useState(value ? value.split(':')[0] : '')
  const [minutes, setMinutes] = React.useState(value ? value.split(':')[1] : '')

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 23)) {
      setHours(val.padStart(2, '0'))
      if (val && minutes) {
        onChange(`${val.padStart(2, '0')}:${minutes}`)
      }
    }
  }

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (val === '' || (parseInt(val) >= 0 && parseInt(val) <= 59)) {
      setMinutes(val.padStart(2, '0'))
      if (hours && val) {
        onChange(`${hours}:${val.padStart(2, '0')}`)
      }
    }
  }

  return (
    <Popover>
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
      <PopoverContent className='w-auto p-4' align='start'>
        <div className='flex gap-2 items-center'>
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium'>Heures</label>
            <Input
              type='number'
              min='0'
              max='23'
              value={hours}
              onChange={handleHoursChange}
              placeholder='00'
              className='w-16 h-8 text-center'
            />
          </div>
          <div className='text-lg font-semibold mt-6'>:</div>
          <div className='flex flex-col gap-1'>
            <label className='text-xs font-medium'>Minutes</label>
            <Input
              type='number'
              min='0'
              max='59'
              value={minutes}
              onChange={handleMinutesChange}
              placeholder='00'
              className='w-16 h-8 text-center'
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
