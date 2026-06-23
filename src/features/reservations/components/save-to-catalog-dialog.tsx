import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  PRODUCT_TYPES,
  useCreateProduct,
  useCreatePackage,
  type Product,
} from '@/features/settings/hooks/use-products'

type CatalogLine = {
  name: string
  unit_price: number | null
  tva_rate: number | null
  description: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  line: CatalogLine | null
  restaurantId: string | null
  restaurantName?: string | null
}

export function SaveToCatalogDialog({
  open,
  onOpenChange,
  line,
  restaurantId,
  restaurantName,
}: Props) {
  const queryClient = useQueryClient()
  const { mutateAsync: createProduct, isPending: creatingProduct } =
    useCreateProduct()
  const { mutateAsync: createPackage, isPending: creatingPackage } =
    useCreatePackage()
  const isPending = creatingProduct || creatingPackage

  const [kind, setKind] = useState<'product' | 'package'>('product')
  const [name, setName] = useState('')
  const [priceHt, setPriceHt] = useState('')
  const [tvaRate, setTvaRate] = useState('20')
  const [type, setType] = useState<Product['type']>('food')
  const [pricePerPerson, setPricePerPerson] = useState(false)

  useEffect(() => {
    if (open && line) {
      setKind('product')
      setName(line.name)
      setPriceHt(String(line.unit_price ?? 0))
      setTvaRate(String(line.tva_rate ?? 20))
      setType('food')
      setPricePerPerson(false)
    }
  }, [open, line])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Le nom est obligatoire')
      return
    }
    if (!restaurantId) {
      toast.error('Aucun restaurant associé au booking')
      return
    }
    const payload = {
      name: trimmed,
      description: line?.description?.trim() || null,
      unit_price_ht: parseFloat(priceHt) || 0,
      tva_rate: parseFloat(tvaRate) || 20,
      price_per_person: pricePerPerson,
      restaurant_ids: [restaurantId],
    }
    try {
      if (kind === 'product') {
        await createProduct({ ...payload, type })
      } else {
        await createPackage(payload)
      }
      queryClient.invalidateQueries({ queryKey: ['products-by-restaurant'] })
      queryClient.invalidateQueries({ queryKey: ['packages-by-restaurant'] })
      toast.success(
        kind === 'product'
          ? 'Produit ajouté au catalogue'
          : 'Package ajouté au catalogue'
      )
      onOpenChange(false)
    } catch {
      toast.error("Échec de l'enregistrement")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Enregistrer au catalogue</DialogTitle>
        </DialogHeader>
        <div className='space-y-4'>
          <div className='flex overflow-hidden rounded-md border'>
            {(['product', 'package'] as const).map((k) => (
              <button
                key={k}
                type='button'
                onClick={() => setKind(k)}
                className={cn(
                  'flex-1 py-1.5 text-sm transition-colors',
                  kind === k
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-accent'
                )}
              >
                {k === 'product' ? 'Produit' : 'Package'}
              </button>
            ))}
          </div>

          <div className='space-y-2'>
            <Label>Nom</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {kind === 'product' && (
            <div className='space-y-2'>
              <Label>Catégorie</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as Product['type'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-2'>
              <Label>Prix HT</Label>
              <Input
                type='number'
                step='0.01'
                value={priceHt}
                onChange={(e) => setPriceHt(e.target.value)}
              />
            </div>
            <div className='space-y-2'>
              <Label>TVA (%)</Label>
              <Input
                type='number'
                step='0.01'
                value={tvaRate}
                onChange={(e) => setTvaRate(e.target.value)}
              />
            </div>
          </div>

          <div className='flex items-center justify-between'>
            <Label htmlFor='ppp'>Prix par personne</Label>
            <Switch
              id='ppp'
              checked={pricePerPerson}
              onCheckedChange={setPricePerPerson}
            />
          </div>

          {restaurantName && (
            <p className='text-xs text-muted-foreground'>
              Ajouté au catalogue de{' '}
              <span className='font-medium'>{restaurantName}</span>.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
