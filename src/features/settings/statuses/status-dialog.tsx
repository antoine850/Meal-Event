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
import { useCreateStatus, useUpdateStatus, type Status } from '../hooks/use-settings'

const statusSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  slug: z.string().min(1, 'Le slug est requis').regex(/^[a-z0-9_]+$/, 'Uniquement lettres minuscules, chiffres et underscores'),
  color: z.string().min(1, 'La couleur est requise'),
  position: z.number().min(1, 'La position est requise'),
})

type StatusFormData = z.infer<typeof statusSchema>

interface StatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  status: Status | null
  type: 'contact' | 'booking'
}

export function StatusDialog({ open, onOpenChange, status, type }: StatusDialogProps) {
  const { mutate: createStatus, isPending: isCreating } = useCreateStatus()
  const { mutate: updateStatus, isPending: isUpdating } = useUpdateStatus()
  const isPending = isCreating || isUpdating

  const form = useForm<StatusFormData>({
    resolver: zodResolver(statusSchema),
    defaultValues: {
      name: '',
      slug: '',
      color: '#3b82f6',
      position: 1,
    },
  })

  useEffect(() => {
    if (status) {
      form.reset({
        name: status.name,
        slug: status.slug,
        color: status.color || '#3b82f6',
        position: status.position,
      })
    } else {
      form.reset({
        name: '',
        slug: '',
        color: '#3b82f6',
        position: 1,
      })
    }
  }, [status, form])

  const onSubmit = (data: StatusFormData) => {
    if (status) {
      updateStatus(
        { id: status.id, ...data },
        {
          onSuccess: () => {
            toast.success('Statut mis à jour')
            onOpenChange(false)
          },
          onError: () => toast.error('Erreur lors de la mise à jour'),
        }
      )
    } else {
      createStatus(
        { ...data, type },
        {
          onSuccess: () => {
            toast.success('Statut créé')
            onOpenChange(false)
          },
          onError: () => toast.error('Erreur lors de la création'),
        }
      )
    }
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[425px]'>
        <DialogHeader>
          <DialogTitle>
            {status ? 'Modifier le statut' : 'Nouveau statut'}
          </DialogTitle>
          <DialogDescription>
            {status
              ? 'Modifiez les informations du statut.'
              : `Ajoutez un nouveau statut pour les ${type === 'contact' ? 'contacts' : 'réservations'}.`}
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
                    <Input
                      placeholder='Nouveau'
                      {...field}
                      onChange={(e) => {
                        field.onChange(e)
                        if (!status) {
                          form.setValue('slug', generateSlug(e.target.value))
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='slug'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug *</FormLabel>
                  <FormControl>
                    <Input placeholder='nouveau' {...field} />
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
                    <FormLabel>Couleur *</FormLabel>
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
                name='position'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position *</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
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
                {status ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
