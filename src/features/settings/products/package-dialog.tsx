import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { normalizeTvaRate } from '@/lib/price'
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
import { deriveUnitHt } from '@/features/reservations/lib/quote-rounding'
import {
  type ProductWithRestaurants,
  type PackageWithRelations,
  useCreatePackage,
  useUpdatePackage,
} from '../hooks/use-products'
import { useRestaurants } from '../hooks/use-settings'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pkg?: PackageWithRelations | null
  products: ProductWithRestaurants[]
}

type ProductItem = { product_id: string; quantity: number }

export function PackageDialog({ open, onOpenChange, pkg, products }: Props) {
  const { data: restaurants = [] } = useRestaurants()
  const { mutate: createPackage, isPending: isCreating } = useCreatePackage()
  const { mutate: updatePackage, isPending: isUpdating } = useUpdatePackage()
  const isPending = isCreating || isUpdating
  const isEdit = !!pkg

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [unitPriceTtc, setUnitPriceTtc] = useState<number>(0)
  const [pricePerPerson, setPricePerPerson] = useState(false)
  const [tvaRate, setTvaRate] = useState<number>(20)
  const [isActive, setIsActive] = useState(true)
  const [productItems, setProductItems] = useState<ProductItem[]>([])
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      if (pkg) {
        setName(pkg.name)
        setDescription(pkg.description || '')
        setUnitPriceTtc(
          Math.round(
            (pkg.unit_price_ht || 0) * (1 + (pkg.tva_rate || 20) / 100) * 100
          ) / 100
        )
        setPricePerPerson(pkg.price_per_person || false)
        setTvaRate(pkg.tva_rate || 20)
        setIsActive(pkg.is_active)
        setProductItems(
          pkg.package_products?.map((pp) => ({
            product_id: pp.product_id,
            quantity: pp.quantity,
          })) || []
        )
        setSelectedRestaurants(
          pkg.package_restaurants?.map((pr) => pr.restaurant_id) || []
        )
      } else {
        setName('')
        setDescription('')
        setUnitPriceTtc(0)
        setPricePerPerson(false)
        setTvaRate(20)
        setIsActive(true)
        setProductItems([])
        setSelectedRestaurants([])
      }
    }
  }, [open, pkg])

  const rate = normalizeTvaRate(tvaRate)
  const derivedHt = deriveUnitHt(unitPriceTtc, rate)

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Le nom est requis')
      return
    }
    if (unitPriceTtc <= 0) {
      toast.error('Le prix du package est requis')
      return
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      unit_price_ht: derivedHt,
      price_per_person: pricePerPerson,
      tva_rate: rate,
      is_active: isActive,
      product_items: productItems.filter((pi) => pi.product_id),
      restaurant_ids: selectedRestaurants,
    }

    if (isEdit) {
      updatePackage(
        { id: pkg.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Package mis à jour')
            onOpenChange(false)
          },
          onError: () => toast.error('Erreur lors de la mise à jour'),
        }
      )
    } else {
      createPackage(payload, {
        onSuccess: () => {
          toast.success('Package créé')
          onOpenChange(false)
        },
        onError: () => toast.error('Erreur lors de la création'),
      })
    }
  }

  const addProductItem = () => {
    setProductItems((prev) => [...prev, { product_id: '', quantity: 1 }])
  }

  const removeProductItem = (index: number) => {
    setProductItems((prev) => prev.filter((_, i) => i !== index))
  }

  const updateProductItem = (
    index: number,
    field: keyof ProductItem,
    value: string | number
  ) => {
    setProductItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    )
  }

  const toggleRestaurant = (id: string) => {
    setSelectedRestaurants((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }

  const totalHt = productItems.reduce((sum, pi) => {
    const product = products.find((p) => p.id === pi.product_id)
    return sum + (product ? product.unit_price_ht * pi.quantity : 0)
  }, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto'>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Modifier le package' : 'Nouveau package'}
          </DialogTitle>
        </DialogHeader>

        <div className='space-y-4'>
          <div>
            <Label>Nom *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Nom du package'
            />
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

          {/* Pricing */}
          <div className='grid grid-cols-3 gap-3'>
            <div>
              <Label>Prix du package TTC *</Label>
              <Input
                type='number'
                step='0.01'
                min={0}
                value={unitPriceTtc}
                onChange={(e) =>
                  setUnitPriceTtc(parseFloat(e.target.value) || 0)
                }
                placeholder='0.00'
              />
            </div>
            <div>
              <Label>TVA (%)</Label>
              <Input
                type='number'
                step='0.01'
                min={0}
                max={100}
                value={tvaRate}
                onChange={(e) => setTvaRate(parseFloat(e.target.value) || 20)}
                onBlur={() => setTvaRate(normalizeTvaRate(tvaRate))}
              />
            </div>
            <div>
              <Label>Prix HT (€)</Label>
              <Input
                value={derivedHt.toFixed(2)}
                disabled
                className='bg-muted'
              />
            </div>
          </div>

          <div className='flex items-center justify-between'>
            <div>
              <Label>Prix par personne</Label>
              <p className='text-xs text-muted-foreground'>
                Le prix sera multiplié par le nombre de convives
              </p>
            </div>
            <Switch
              checked={pricePerPerson}
              onCheckedChange={setPricePerPerson}
            />
          </div>

          <div className='flex items-center justify-between'>
            <Label>Actif</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Products in package */}
          <div>
            <div className='mb-2 flex items-center justify-between'>
              <Label>Produits du package</Label>
              <Button
                type='button'
                size='sm'
                variant='outline'
                onClick={addProductItem}
                className='gap-1'
              >
                <Plus className='h-3 w-3' /> Ajouter
              </Button>
            </div>
            <div className='space-y-2'>
              {productItems.map((item, index) => (
                <div key={index} className='flex items-center gap-2'>
                  <Select
                    value={item.product_id}
                    onValueChange={(v) =>
                      updateProductItem(index, 'product_id', v)
                    }
                  >
                    <SelectTrigger className='min-w-0 flex-1'>
                      <SelectValue
                        placeholder='Sélectionner un produit'
                        className='truncate'
                      />
                    </SelectTrigger>
                    <SelectContent className='max-w-[calc(100vw-4rem)] sm:max-w-[400px]'>
                      {products.map((p) => (
                        <SelectItem
                          key={p.id}
                          value={p.id}
                          className='max-w-full'
                        >
                          <span className='block max-w-[280px] truncate'>
                            {p.name} ({p.unit_price_ht}€ HT)
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type='number'
                    min={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateProductItem(
                        index,
                        'quantity',
                        parseInt(e.target.value) || 1
                      )
                    }
                    className='w-16 shrink-0'
                    placeholder='Qté'
                  />
                  <Button
                    type='button'
                    size='icon'
                    variant='ghost'
                    onClick={() => removeProductItem(index)}
                    className='h-8 w-8 shrink-0 text-destructive hover:text-destructive'
                  >
                    <Trash2 className='h-3 w-3' />
                  </Button>
                </div>
              ))}
              {productItems.length === 0 && (
                <p className='py-2 text-center text-xs text-muted-foreground'>
                  Aucun produit ajouté
                </p>
              )}
              {productItems.length > 0 && (
                <div className='space-y-0.5 border-t pt-1 text-right text-sm'>
                  <div className='text-muted-foreground'>
                    Somme des produits: {totalHt.toFixed(2)} €
                  </div>
                  <div className='font-medium'>
                    Prix du package: {derivedHt.toFixed(2)} € HT
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Restaurants */}
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
