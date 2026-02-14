import { useState } from 'react'
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
import { useCreateCompany, useUpdateCompany, type Company } from './hooks/use-companies'

const companySchema = z.object({
  name: z.string().min(1, 'Le nom est requis'),
  phone: z.string().optional().or(z.literal('')),
  billing_address: z.string().optional().or(z.literal('')),
  billing_postal_code: z.string().optional().or(z.literal('')),
  billing_city: z.string().optional().or(z.literal('')),
  billing_country: z.string().optional().or(z.literal('')),
  billing_email: z.string().email('Email invalide').optional().or(z.literal('')),
  siret: z.string().optional().or(z.literal('')),
  tva_number: z.string().optional().or(z.literal('')),
})

type CompanyFormData = z.infer<typeof companySchema>

interface CompanyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company: Company | null
}

export function CompanyDialog({ open, onOpenChange, company }: CompanyDialogProps) {
  const { mutate: createCompany, isPending: isCreating } = useCreateCompany()
  const { mutate: updateCompany, isPending: isUpdating } = useUpdateCompany()
  const isPending = isCreating || isUpdating

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: {
      name: '',
      phone: '',
      billing_address: '',
      billing_postal_code: '',
      billing_city: '',
      billing_country: 'France',
      billing_email: '',
      siret: '',
      tva_number: '',
    },
  })

  useState(() => {
    if (company) {
      form.reset({
        name: company.name,
        phone: company.phone || '',
        billing_address: company.billing_address || '',
        billing_postal_code: company.billing_postal_code || '',
        billing_city: company.billing_city || '',
        billing_country: company.billing_country || 'France',
        billing_email: company.billing_email || '',
        siret: company.siret || '',
        tva_number: company.tva_number || '',
      })
    }
  })

  const onSubmit = (data: CompanyFormData) => {
    const payload = {
      ...data,
      phone: data.phone || null,
      billing_address: data.billing_address || null,
      billing_postal_code: data.billing_postal_code || null,
      billing_city: data.billing_city || null,
      billing_country: data.billing_country || null,
      billing_email: data.billing_email || null,
      siret: data.siret || null,
      tva_number: data.tva_number || null,
    }

    if (company) {
      updateCompany(
        { id: company.id, ...payload },
        {
          onSuccess: () => {
            toast.success('Société mise à jour')
            onOpenChange(false)
          },
          onError: () => toast.error('Erreur lors de la mise à jour'),
        }
      )
    } else {
      createCompany(payload, {
        onSuccess: () => {
          toast.success('Société créée')
          onOpenChange(false)
          form.reset()
        },
        onError: () => toast.error('Erreur lors de la création'),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-[600px]'>
        <DialogHeader>
          <DialogTitle>
            {company ? "Modifier la société" : 'Nouvelle société'}
          </DialogTitle>
          <DialogDescription>
            {company
              ? "Modifiez les informations de la société."
              : 'Ajoutez une nouvelle société à votre base de données.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom de la société *</FormLabel>
                    <FormControl>
                      <Input placeholder='Ex: MealEvent SAS' {...field} />
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
                      <Input placeholder='+33 1 23 45 67 89' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='billing_email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email de facturation</FormLabel>
                    <FormControl>
                      <Input type='email' placeholder='compta@societe.com' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='tva_number'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Numéro de TVA</FormLabel>
                    <FormControl>
                      <Input placeholder='FR 12 345678901' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <FormField
                control={form.control}
                name='siret'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SIRET</FormLabel>
                    <FormControl>
                      <Input placeholder='123 456 789 00012' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name='billing_address'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Adresse de facturation</FormLabel>
                  <FormControl>
                    <Input placeholder='123 Rue des Affaires' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <FormField
                control={form.control}
                name='billing_postal_code'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code postal</FormLabel>
                    <FormControl>
                      <Input placeholder='75001' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='billing_city'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville</FormLabel>
                    <FormControl>
                      <Input placeholder='Paris' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='billing_country'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pays</FormLabel>
                    <FormControl>
                      <Input placeholder='France' {...field} />
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
                {company ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
