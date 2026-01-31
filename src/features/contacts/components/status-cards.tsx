import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type StatusCardProps = {
  label: string
  count: number
  color: string
  isActive?: boolean
  onClick?: () => void
}

function StatusCard({ label, count, color, isActive, onClick }: StatusCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start rounded-lg border bg-card p-3 text-left transition-all hover:shadow-md flex-1',
        isActive && 'ring-2 ring-primary'
      )}
    >
      <div className={cn('h-1 w-full rounded-full mb-2', color)} />
      <span className='text-2xl font-bold'>{count}</span>
      <span className='text-xs text-muted-foreground truncate w-full'>{label}</span>
    </button>
  )
}

type StatusCardsProps = {
  statuses: Array<{
    value: string
    label: string
    color: string
    count: number
  }>
  activeStatus?: string | null
  onStatusClick?: (status: string | null) => void
}

export function StatusCards({ statuses, activeStatus, onStatusClick }: StatusCardsProps) {
  const totalCount = statuses.reduce((acc, s) => acc + s.count, 0)
  const activeStatusData = statuses.find(s => s.value === activeStatus)

  return (
    <>
      {/* Mobile: Dropdown */}
      <div className='sm:hidden'>
        <Select 
          value={activeStatus || 'all'} 
          onValueChange={(value) => onStatusClick?.(value === 'all' ? null : value)}
        >
          <SelectTrigger className='w-full'>
            <SelectValue>
              {activeStatus ? (
                <div className='flex items-center gap-2'>
                  <div className={cn('w-3 h-3 rounded-full', activeStatusData?.color)} />
                  <span>{activeStatusData?.label} ({activeStatusData?.count})</span>
                </div>
              ) : (
                <span>Tous les statuts ({totalCount})</span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>
              <span>Tous les statuts ({totalCount})</span>
            </SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                <div className='flex items-center gap-2'>
                  <div className={cn('w-3 h-3 rounded-full', status.color)} />
                  <span>{status.label} ({status.count})</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: Cards Grid */}
      <div className='hidden sm:grid sm:grid-cols-5 lg:grid-cols-9 gap-2 w-full'>
        {statuses.map((status) => (
          <StatusCard
            key={status.value}
            label={status.label}
            count={status.count}
            color={status.color}
            isActive={activeStatus === status.value}
            onClick={() => onStatusClick?.(activeStatus === status.value ? null : status.value)}
          />
        ))}
      </div>
    </>
  )
}
