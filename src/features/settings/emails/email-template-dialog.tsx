import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useUpdateEmailTemplate } from '@/features/reservations/hooks/use-email-templates'
import type { EmailTemplate } from '@/features/reservations/lib/email-templates'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: EmailTemplate | null
}

const AVAILABLE_VARS = [
  'prenom_client',
  'nom_client',
  'email_client',
  'restaurant',
  'date_evenement',
  'nb_invites',
  'min_ca',
  'groupe',
  'site_groupe',
  'signature',
]

export function EmailTemplateDialog({ open, onOpenChange, template }: Props) {
  const [label, setLabel] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [isActive, setIsActive] = useState(true)
  const { mutate, isPending } = useUpdateEmailTemplate()

  useEffect(() => {
    if (template) {
      setLabel(template.label)
      setSubject(template.subject)
      setBody(template.body)
      setIsActive(template.is_active)
    }
  }, [template])

  const handleSave = () => {
    if (!template) return
    mutate(
      {
        id: template.id,
        label: label.trim(),
        subject: subject.trim(),
        body,
        is_active: isActive,
      },
      {
        onSuccess: () => {
          toast.success('Template mis à jour')
          onOpenChange(false)
        },
        onError: (e) => {
          toast.error(`Erreur : ${(e as Error).message}`)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-3xl'>
        <DialogHeader>
          <DialogTitle>
            Modifier le template
            {template && (
              <Badge variant='outline' className='ml-2'>
                {template.lang.toUpperCase()}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Les variables entre <code>{'{{ }}'}</code> seront remplacées par les
            informations de la réservation et du restaurant.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='tpl-label'>Nom du template (visible dans le menu)</Label>
            <Input
              id='tpl-label'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='Envoi plaquette'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='tpl-subject'>Sujet</Label>
            <Input
              id='tpl-subject'
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder='{{restaurant}} — votre événement du {{date_evenement}}'
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='tpl-body'>Corps</Label>
            <Textarea
              id='tpl-body'
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={14}
              className='font-mono text-sm'
            />
          </div>

          <div className='space-y-2'>
            <Label className='text-xs text-muted-foreground'>
              Variables disponibles (clique pour copier)
            </Label>
            <div className='flex flex-wrap gap-1.5'>
              {AVAILABLE_VARS.map((v) => (
                <Badge
                  key={v}
                  variant='secondary'
                  className='cursor-pointer font-mono text-xs hover:bg-secondary/80'
                  onClick={() => {
                    navigator.clipboard.writeText(`{{${v}}}`)
                    toast.success(`{{${v}}} copié`)
                  }}
                >
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          </div>

          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div>
              <Label htmlFor='tpl-active' className='cursor-pointer'>
                Template actif
              </Label>
              <p className='text-xs text-muted-foreground'>
                Désactivé, il n'apparaîtra plus dans le menu d'envoi.
              </p>
            </div>
            <Switch
              id='tpl-active'
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
