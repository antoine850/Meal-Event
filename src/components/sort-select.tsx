import { ArrowDownUp } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type SortOption = {
  label: string
  value: string // format: "field:asc" or "field:desc"
}

type SortSelectProps = {
  options: SortOption[]
  value: string
  onChange: (value: string) => void
}

export function SortSelect({ options, value, onChange }: SortSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className='h-8 w-auto min-w-[160px] gap-2 text-xs'>
        <ArrowDownUp className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
        <SelectValue placeholder='Trier par...' />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value} className='text-xs'>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function parseSortValue(value: string): { id: string; desc: boolean } {
  const [id, dir] = value.split(':')
  return { id, desc: dir === 'desc' }
}
