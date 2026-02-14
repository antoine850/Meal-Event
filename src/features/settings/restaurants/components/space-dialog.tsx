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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateSpace, useUpdateSpace, useRestaurants, type Space } from '../../hooks/use-settings'

const spaceSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  restaurant_id: z.string().optional(),
  capacity: z.number().optional(),
  description: z.string().optional(),
  is_active: z.boolean(),
})

type SpaceFormData = z.infer<typeof spaceSchema>

interface SpaceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  space: (Space & { restaurant: { id: string; name: string } | null }) | null
  defaultRestaurantId?: string
}

export function SpaceDialog({ open, onOpenChange, space, defaultRestaurantId }: SpaceDialogProps) {
  const { mutate: createSpace, isPending: isCreating } = useCreateSpace()
  const { mutate: updateSpace, isPending: isUpdating } = useUpdateSpace()
  const { data: restaurants = [] as any[] } = useRestaurants()
  const isPending = isCreating || isUpdating

  const form = useForm<SpaceFormData>({
    resolver: zodResolver(spaceSchema),
    defaultValues: {
      name: '',
      restaurant_id: '',
      capacity: undefined,
      description: '',
      is_active: true,
    },
  })

  useEffect(() => {
    if (space) {
      form.reset({
        name: space.name,
        restaurant_id: space.restaurant_id || defaultRestaurantId || '',
        capacity: space.capacity || undefined,
        description: space.description || '',
        is_active: space.is_active,
      })
    } else {
      form.reset({
        name: '',
        restaurant_id: defaultRestaurantId || '',
        capacity: undefined,
        description: '',
        is_active: true,
      })
    }
  }, [space, form, defaultRestaurantId])

  const onSubmit = (data: SpaceFormData) => {
    const payload = {
      ...data,
      restaurant_id: data.restaurant_id || null,
    }

    if (space) {
      updateSpace(
        { id: space.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Espace mis à jour')
            onOpenChange(false)
          },
          onError: () => toast.error('Erreur lors de la mise à jour'),
        }
      )
    } else {
      createSpace(payload, {
        onSuccess: () => {
          toast.success('Espace créé')
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
            {space ? "Modifier l'espace" : 'Nouvel espace'}
          </DialogTitle>
          <DialogDescription>
            {space
              ? "Modifiez les informations de l'espace."
              : 'Ajoutez un nouvel espace à votre restaurant.'}
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
                    <Input placeholder='Salle principale' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!defaultRestaurantId && (
              <FormField
                control={form.control}
                name='restaurant_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restaurant</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Sélectionner un restaurant...' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {restaurants.map((restaurant: any) => (
                          <SelectItem key={restaurant.id} value={restaurant.id}>
                            {restaurant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name='capacity'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacité (personnes)</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='description'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
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

            <DialogFooter>
              <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type='submit' disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {space ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
