import { useState } from 'react'
import { toast } from 'sonner'
import { X, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useMenuFormFull,
  useUpdateMenuForm,
  useAddMenuFormField,
  useUpdateMenuFormField,
  useDeleteMenuFormField,
} from '../hooks/use-menu-forms'

type Props = {
  formId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId?: string | null
}

export function MenuFormBuilder({ formId, open, onOpenChange }: Props) {
  if (!formId) return null

  const { data: formData } = useMenuFormFull(formId)
  const { mutate: updateForm } = useUpdateMenuForm()
  const { mutate: addField } = useAddMenuFormField()
  const { mutate: updateField } = useUpdateMenuFormField()
  const { mutate: deleteField } = useDeleteMenuFormField()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const fields = (formData?.menu_form_fields || []).sort((a: any, b: any) => a.sort_order - b.sort_order)

  const handleAddField = () => {
    if (!formId) return
    addField({
      menuFormId: formId,
      label: 'Nouveau champ',
      fieldType: 'select',
      options: [],
      isPerPerson: true,
      isRequired: false,
      sortOrder: fields.length,
    }, {
      onSuccess: () => toast.success('Champ ajouté'),
      onError: () => toast.error('Erreur'),
    })
  }

  const handleUpdateField = (fieldId: string, updates: any) => {
    updateField({ id: fieldId, ...updates }, {
      onSuccess: () => toast.success('Champ mis à jour'),
      onError: () => toast.error('Erreur'),
    })
  }

  const handleDeleteField = (fieldId: string) => {
    deleteField(fieldId, {
      onSuccess: () => toast.success('Champ supprimé'),
      onError: () => toast.error('Erreur'),
    })
  }

  const handleSaveSettings = () => {
    if (!formId) return
    updateForm({ id: formId, title, description } as any, {
      onSuccess: () => toast.success('Formulaire sauvegardé'),
      onError: () => toast.error('Erreur'),
    })
  }

  if (!open || !formData) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-4xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader>
          <div className='flex items-center justify-between'>
            <div>
              <DialogTitle>Éditeur de formulaire</DialogTitle>
              <DialogDescription>
                Configurez les champs du formulaire de menu
              </DialogDescription>
            </div>
            <Button variant='ghost' size='sm' onClick={() => onOpenChange(false)}>
              <X className='h-4 w-4' />
            </Button>
          </div>
        </DialogHeader>

        <div className='space-y-6 py-4'>
          {/* Settings */}
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label>Titre</Label>
              <Input
                value={title || formData.title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveSettings}
              />
            </div>
            <div className='space-y-2'>
              <Label>Description</Label>
              <Input
                value={description || formData.description || ''}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleSaveSettings}
              />
            </div>
          </div>

          {/* Fields */}
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <h3 className='text-sm font-semibold'>Champs</h3>
              <Button size='sm' onClick={handleAddField}>
                <Plus className='h-4 w-4 mr-2' />
                Ajouter un champ
              </Button>
            </div>

            {fields.length === 0 ? (
              <Card>
                <CardContent className='py-8 text-center text-muted-foreground'>
                  Aucun champ. Ajoutez-en un pour commencer.
                </CardContent>
              </Card>
            ) : (
              <div className='space-y-3'>
                {fields.map((field: any) => (
                  <FieldEditor
                    key={field.id}
                    field={field}
                    onUpdate={handleUpdateField}
                    onDelete={handleDeleteField}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function FieldEditor({ field, onUpdate, onDelete }: any) {
  const [label, setLabel] = useState(field.label)
  const [description, setDescription] = useState(field.description || '')
  const [fieldType, setFieldType] = useState(field.field_type)
  const [isPerPerson, setIsPerPerson] = useState(field.is_per_person)
  const [isRequired, setIsRequired] = useState(field.is_required)

  const handleSave = () => {
    onUpdate(field.id, {
      label,
      description: description || null,
      field_type: fieldType,
      is_per_person: isPerPerson,
      is_required: isRequired,
    })
  }

  return (
    <Card>
      <CardContent className='p-4 space-y-3'>
        <div className='grid grid-cols-2 gap-3'>
          <div className='space-y-2'>
            <Label className='text-xs'>Nom du champ</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onBlur={handleSave}
              className='h-9'
            />
          </div>
          <div className='space-y-2'>
            <Label className='text-xs'>Type</Label>
            <Select value={fieldType} onValueChange={(v) => { setFieldType(v); handleSave() }}>
              <SelectTrigger className='h-9'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='select'>Liste de choix</SelectItem>
                <SelectItem value='text'>Texte libre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className='space-y-2'>
          <Label className='text-xs'>Description (optionnelle)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleSave}
            placeholder="Ex: Choisissez votre entrée parmi les options suivantes..."
            rows={2}
            className='text-sm'
          />
        </div>

        <div className='flex items-center gap-4'>
          <div className='flex items-center gap-2'>
            <Switch
              checked={isPerPerson}
              onCheckedChange={(v) => { setIsPerPerson(v); handleSave() }}
            />
            <Label className='text-xs'>Par personne</Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              checked={isRequired}
              onCheckedChange={(v) => { setIsRequired(v); handleSave() }}
            />
            <Label className='text-xs'>Requis</Label>
          </div>
        </div>

        <div className='flex justify-end'>
          <Button
            variant='ghost'
            size='sm'
            className='text-destructive hover:text-destructive'
            onClick={() => onDelete(field.id)}
          >
            <Trash2 className='h-4 w-4 mr-2' />
            Supprimer
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
