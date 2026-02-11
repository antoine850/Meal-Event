import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useCreateRestaurant, useUpdateRestaurant, type Restaurant } from '../hooks/use-settings'

const restaurantSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  color: z.string().optional(),
  is_active: z.boolean(),
})

type RestaurantFormData = z.infer<typeof restaurantSchema>

interface RestaurantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurant: Restaurant | null
}

export function RestaurantDialog({ open, onOpenChange, restaurant }: RestaurantDialogProps) {
  const { mutate: createRestaurant, isPending: isCreating } = useCreateRestaurant()
  const { mutate: updateRestaurant, isPending: isUpdating } = useUpdateRestaurant()
  const isPending = isCreating || isUpdating

  const form = useForm<RestaurantFormData>({
    resolver: zodResolver(restaurantSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      color: '#3b82f6',
      is_active: true,
    },
  })

  useEffect(() => {
    if (restaurant) {
      form.reset({
        name: restaurant.name,
        email: restaurant.email || '',
        phone: restaurant.phone || '',
        address: restaurant.address || '',
        color: restaurant.color || '#3b82f6',
        is_active: restaurant.is_active,
      })
    } else {
      form.reset({
        name: '',
        email: '',
        phone: '',
        address: '',
        color: '#3b82f6',
        is_active: true,
      })
    }
  }, [restaurant, form])

  const onSubmit = (data: RestaurantFormData) => {
    if (restaurant) {
      updateRestaurant(
        { id: restaurant.id, ...data },
        {
          onSuccess: () => {
            toast.success('Restaurant mis à jour')
            onOpenChange(false)
          },
          onError: () => toast.error('Erreur lors de la mise à jour'),
        }
      )
    } else {
      createRestaurant(data, {
        onSuccess: () => {
          toast.success('Restaurant créé')
          onOpenChange(false)
        },
        onError: () => toast.error('Erreur lors de la création'),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>
            {restaurant ? 'Modifier le restaurant' : 'Nouveau restaurant'}
          </DialogTitle>
          <DialogDescription>
            {restaurant
              ? 'Modifiez les informations du restaurant.'
              : 'Ajoutez un nouveau restaurant à votre organisation.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom *</FormLabel>
                  <FormControl>
                    <Input placeholder='Le Petit Bistro' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type='email' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='phone'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='address'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='color'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Couleur</FormLabel>
                    <FormControl>
                      <div className='flex gap-2'>
                        <Input type='color' className='w-12 h-10 p-1' {...field} />
                        <Input {...field} className='flex-1' />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='is_active'
                render={({ field }) => (
                  <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                    <FormLabel className='text-sm'>Actif</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {restaurant ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
