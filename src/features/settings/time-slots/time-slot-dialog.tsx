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
import { useCreateTimeSlot, useUpdateTimeSlot, type TimeSlot } from '../hooks/use-settings'

const timeSlotSchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  start_time: z.string().min(1, "L'heure de début est requise"),
  end_time: z.string().min(1, "L'heure de fin est requise"),
  is_active: z.boolean(),
})

type TimeSlotFormData = z.infer<typeof timeSlotSchema>

interface TimeSlotDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  timeSlot: TimeSlot | null
}

export function TimeSlotDialog({ open, onOpenChange, timeSlot }: TimeSlotDialogProps) {
  const { mutate: createTimeSlot, isPending: isCreating } = useCreateTimeSlot()
  const { mutate: updateTimeSlot, isPending: isUpdating } = useUpdateTimeSlot()
  const isPending = isCreating || isUpdating

  const form = useForm<TimeSlotFormData>({
    resolver: zodResolver(timeSlotSchema),
    defaultValues: {
      name: '',
      start_time: '12:00',
      end_time: '14:00',
      is_active: true,
    },
  })

  useEffect(() => {
    if (timeSlot) {
      form.reset({
        name: timeSlot.name,
        start_time: timeSlot.start_time,
        end_time: timeSlot.end_time,
        is_active: timeSlot.is_active,
      })
    } else {
      form.reset({
        name: '',
        start_time: '12:00',
        end_time: '14:00',
        is_active: true,
      })
    }
  }, [timeSlot, form])

  const onSubmit = (data: TimeSlotFormData) => {
    if (timeSlot) {
      updateTimeSlot(
        { id: timeSlot.id, ...data },
        {
          onSuccess: () => {
            toast.success('Créneau mis à jour')
            onOpenChange(false)
          },
          onError: () => toast.error('Erreur lors de la mise à jour'),
        }
      )
    } else {
      createTimeSlot(data, {
        onSuccess: () => {
          toast.success('Créneau créé')
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
            {timeSlot ? 'Modifier le créneau' : 'Nouveau créneau'}
          </DialogTitle>
          <DialogDescription>
            {timeSlot
              ? 'Modifiez les informations du créneau horaire.'
              : 'Ajoutez un nouveau créneau horaire.'}
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
                    <Input placeholder='Déjeuner' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='start_time'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure de début *</FormLabel>
                    <FormControl>
                      <Input type='time' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='end_time'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Heure de fin *</FormLabel>
                    <FormControl>
                      <Input type='time' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {timeSlot ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
