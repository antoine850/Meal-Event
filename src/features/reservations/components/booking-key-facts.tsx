import { formatEventDateShort } from '@/lib/dates'

type Props = {
  eventDate: string | null
  guests: number | null
  budget: number | null
  format: string | null
  isB2B: boolean
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg border bg-muted/50 px-3 py-2'>
      <p className='text-xs text-muted-foreground'>{label}</p>
      <p className='truncate text-sm font-medium'>{value}</p>
    </div>
  )
}

// Lecture seule : les champs restent modifiables la ou ils sont deja, on ne
// cree pas un second chemin d'ecriture vers le meme formulaire.
export function BookingKeyFacts({
  eventDate,
  guests,
  budget,
  format,
  isB2B,
}: Props) {
  return (
    <div
      className='mb-4 grid gap-2'
      // Meme patron que pipeline-view.tsx : les tuiles se replient toutes
      // seules sur deux lignes, sans media query.
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}
    >
      <Fact
        label='Date'
        value={eventDate ? formatEventDateShort(eventDate) : '—'}
      />
      <Fact label='Personnes' value={guests ? String(guests) : '—'} />
      <Fact
        label='Budget'
        value={budget ? `${budget.toLocaleString('fr-FR')} €` : '—'}
      />
      <Fact label='Format' value={format || '—'} />
      <Fact label='Client' value={isB2B ? 'B2B' : 'B2C'} />
    </div>
  )
}
