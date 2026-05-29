import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Textarea } from '@/components/ui/textarea'
import {
  type Product,
  type ProductWithRestaurants,
  PRODUCT_TYPES,
  deriveHtFromTtc,
  useCreateProduct,
  useUpdateProduct,
} from '../hooks/use-products'
import { useRestaurants } from '../hooks/use-settings'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductWithRestaurants | null
  duplicateFrom?: ProductWithRestaurants | null
}

export function ProductDialog({
  open,
  onOpenChange,
  product,
  duplicateFrom,
}: Props) {
  const { data: restaurants = [] } = useRestaurants()
  const { mutate: createProduct, isPending: isCreating } = useCreateProduct()
  const { mutate: updateProduct, isPending: isUpdating } = useUpdateProduct()
  const isPending = isCreating || isUpdating
  const isEdit = !!product && !duplicateFrom

  const source = product || duplicateFrom

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<Product['type']>('food')
  const [pricePerPerson, setPricePerPerson] = useState(false)
  const [unitPriceTtc, setUnitPriceTtc] = useState('')
  const [tvaRate, setTvaRate] = useState('20')
  const [margin, setMargin] = useState('0')
  const [isActive, setIsActive] = useState(true)
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      if (source) {
        setName(duplicateFrom ? `${source.name} (copie)` : source.name)
        setDescription(source.description || '')
        setType(source.type)
        setPricePerPerson(source.price_per_person)
        setUnitPriceTtc(String(source.unit_price_ttc))
        setTvaRate(String(source.tva_rate))
        setMargin(String(source.margin))
        setIsActive(source.is_active)
        setSelectedRestaurants(
          source.product_restaurants?.map((pr) => pr.restaurant_id) || []
        )
      } else {
        setName('')
        setDescription('')
        setType('food')
        setPricePerPerson(false)
        setUnitPriceTtc('')
        setTvaRate('20')
        setMargin('0')
        setIsActive(true)
        setSelectedRestaurants([])
      }
    }
  }, [open, source, duplicateFrom])

  const priceHt = useMemo(
    () =>
      deriveHtFromTtc(
        parseFloat(unitPriceTtc) || 0,
        parseFloat(tvaRate) || 0
      ).toFixed(2),
    [unitPriceTtc, tvaRate]
  )

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Le nom est requis')
      return
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      type,
      price_per_person: pricePerPerson,
      unit_price_ht: deriveHtFromTtc(
        parseFloat(unitPriceTtc) || 0,
        parseFloat(tvaRate) || 0
      ),
      tva_rate: parseFloat(tvaRate) || 20,
      margin: parseFloat(margin) || 0,
      is_active: isActive,
      restaurant_ids: selectedRestaurants,
    }

    if (isEdit) {
      updateProduct(
        { id: product.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Produit mis à jour')
            onOpenChange(false)
          },
          onError: () => toast.error('Erreur lors de la mise à jour'),
        }
      )
    } else {
      createProduct(payload, {
        onSuccess: () => {
          toast.success('Produit créé')
          onOpenChange(false)
        },
        onError: () => toast.error('Erreur lors de la création'),
      })
    }
  }

  const toggleRestaurant = (id: string) => {
    setSelectedRestaurants((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] max-w-lg overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier le produit' : 'Nouveau produit'}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div>
            <Label>Nom *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Nom du produit'
            />
          </div>

          <div>
            <Label>Type *</Label>
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

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Description...'
              className='min-h-[60px] resize-none'
            />
          </div>

          <div className='flex items-center justify-between'>
            <Label>Prix par personne</Label>
            <Switch
              checked={pricePerPerson}
              onCheckedChange={setPricePerPerson}
            />
          </div>

          <div className='grid grid-cols-3 gap-3'>
            <div>
              <Label>Prix TTC (€)</Label>
              <Input
                type='number'
                step='0.01'
                value={unitPriceTtc}
                onChange={(e) => setUnitPriceTtc(e.target.value)}
                placeholder='0.00'
              />
            </div>
            <div>
              <Label>TVA (%)</Label>
              <Input
                type='number'
                step='0.01'
                value={tvaRate}
                onChange={(e) => setTvaRate(e.target.value)}
                placeholder='20'
              />
            </div>
            <div>
              <Label>Prix HT (€)</Label>
              <Input value={priceHt} disabled className='bg-muted' />
            </div>
          </div>

          <div>
            <Label>Marge (%)</Label>
            <Input
              type='number'
              step='0.01'
              value={margin}
              onChange={(e) => setMargin(e.target.value)}
              placeholder='0'
            />
          </div>

          <div className='flex items-center justify-between'>
            <Label>Actif</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <div>
            <Label className='mb-2 block'>Restaurants</Label>
            <div className='flex flex-wrap gap-2'>
              {restaurants.map((r) => (
                <button
                  key={r.id}
                  type='button'
                  onClick={() => toggleRestaurant(r.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    selectedRestaurants.includes(r.id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-muted'
                  }`}
                >
                  {r.color && (
                    <div
                      className='h-2 w-2 rounded-full'
                      style={{ backgroundColor: r.color }}
                    />
                  )}
                  {r.name}
                </button>
              ))}
              {restaurants.length === 0 && (
                <p className='text-xs text-muted-foreground'>
                  Aucun restaurant
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
