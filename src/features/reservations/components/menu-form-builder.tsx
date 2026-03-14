import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { X, Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
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

type MenuOption = {
  label: string
  description?: string
}

type Props = {
  formId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId?: string | null
}

export function MenuFormBuilder({ formId, open, onOpenChange }: Props) {
  const { data: formData } = useMenuFormFull(formId)
  const { mutate: updateForm } = useUpdateMenuForm()
  const { mutate: addField } = useAddMenuFormField()
  const { mutate: updateField } = useUpdateMenuFormField()
  const { mutate: deleteField } = useDeleteMenuFormField()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  // Initialize title/description from formData when it loads
  useEffect(() => {
    if (formData) {
      setTitle(formData.title || '')
      setDescription(formData.description || '')
    }
  }, [formData])

  if (!formId) return null

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
      onError: () => toast.error('Erreur lors de la sauvegarde'),
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
                Configurez les champs et les options du formulaire de menu
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
              <Label>Titre du formulaire</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSaveSettings}
                placeholder='Ex: Menu mariage, Brunch corporate...'
              />
            </div>
            <div className='space-y-2'>
              <Label>Description du formulaire</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleSaveSettings}
                placeholder='Ex: Veuillez sélectionner vos choix pour chaque convive...'
                rows={2}
              />
            </div>
          </div>

          <Separator />

          {/* Fields */}
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                <h3 className='text-sm font-semibold'>Champs du formulaire</h3>
                <p className='text-xs text-muted-foreground mt-0.5'>
                  Ajoutez des choix (liste déroulante) ou des champs texte libre
                </p>
              </div>
              <Button size='sm' onClick={handleAddField}>
                <Plus className='h-4 w-4 mr-2' />
                Ajouter un champ
              </Button>
            </div>

            {fields.length === 0 ? (
              <Card className='border-dashed'>
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

// Parse options from JSONB (handles both string[] and {label,description}[] formats)
function parseOptions(options: any): MenuOption[] {
  if (!options) return []
  try {
    const parsed = typeof options === 'string' ? JSON.parse(options) : options
    if (!Array.isArray(parsed)) return []
    return parsed.map((opt: any) => {
      if (typeof opt === 'string') return { label: opt }
      return { label: opt.label || '', description: opt.description || '' }
    })
  } catch {
    return []
  }
}

function FieldEditor({ field, onUpdate, onDelete }: {
  field: any
  onUpdate: (id: string, updates: any) => void
  onDelete: (id: string) => void
}) {
  const [label, setLabel] = useState(field.label)
  const [description, setDescription] = useState(field.description || '')
  const [fieldType, setFieldType] = useState(field.field_type)
  const [isPerPerson, setIsPerPerson] = useState(field.is_per_person)
  const [isRequired, setIsRequired] = useState(field.is_required)
  const [options, setOptions] = useState<MenuOption[]>(() => parseOptions(field.options))

  // Sync options from server
  useEffect(() => {
    setOptions(parseOptions(field.options))
  }, [field.options])

  const saveFieldMeta = useCallback(() => {
    onUpdate(field.id, {
      label,
      description: description || null,
      field_type: fieldType,
      is_per_person: isPerPerson,
      is_required: isRequired,
    })
  }, [field.id, label, description, fieldType, isPerPerson, isRequired, onUpdate])

  const saveOptions = useCallback((newOptions: MenuOption[]) => {
    setOptions(newOptions)
    onUpdate(field.id, {
      options: JSON.stringify(newOptions),
    })
  }, [field.id, onUpdate])

  const handleAddOption = () => {
    const newOptions = [...options, { label: '', description: '' }]
    saveOptions(newOptions)
  }

  const handleUpdateOption = (index: number, updates: Partial<MenuOption>) => {
    const newOptions = options.map((opt, i) =>
      i === index ? { ...opt, ...updates } : opt
    )
    setOptions(newOptions)
  }

  const handleSaveOption = (_index: number) => {
    // Save current options state to DB
    onUpdate(field.id, {
      options: JSON.stringify(options),
    })
  }

  const handleRemoveOption = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index)
    saveOptions(newOptions)
  }

  const handleFieldTypeChange = (newType: string) => {
    setFieldType(newType)
    onUpdate(field.id, {
      field_type: newType,
      is_per_person: newType === 'select' ? isPerPerson : false,
    })
  }

  return (
    <Card>
      <CardContent className='p-4 space-y-4'>
        {/* Field header */}
        <div className='flex items-start justify-between gap-2'>
          <div className='flex-1 grid grid-cols-[1fr_auto] gap-3'>
            <div className='space-y-1.5'>
              <Label className='text-xs text-muted-foreground'>Nom du champ</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={saveFieldMeta}
                className='h-9 font-medium'
                placeholder='Ex: Entrée, Plat principal, Dessert...'
              />
            </div>
            <div className='space-y-1.5'>
              <Label className='text-xs text-muted-foreground'>Type</Label>
              <Select value={fieldType} onValueChange={handleFieldTypeChange}>
                <SelectTrigger className='h-9 w-[160px]'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='select'>Liste de choix</SelectItem>
                  <SelectItem value='text'>Texte libre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Field description */}
        <div className='space-y-1.5'>
          <Label className='text-xs text-muted-foreground'>Description du champ (optionnelle)</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={saveFieldMeta}
            placeholder='Ex: Choisissez votre entrée parmi les options suivantes...'
            rows={2}
            className='text-sm'
          />
        </div>

        {/* Options editor (only for select fields) */}
        {fieldType === 'select' && (
          <div className='space-y-3'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Label className='text-xs text-muted-foreground'>Options</Label>
                <Badge variant='secondary' className='text-xs'>
                  {options.length} option{options.length > 1 ? 's' : ''}
                </Badge>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='h-7 text-xs gap-1'
                onClick={handleAddOption}
              >
                <Plus className='h-3 w-3' />
                Ajouter une option
              </Button>
            </div>

            {options.length === 0 ? (
              <div className='border border-dashed rounded-lg p-4 text-center text-sm text-muted-foreground'>
                Aucune option. Ajoutez des options pour que les clients puissent choisir.
              </div>
            ) : (
              <div className='space-y-2'>
                {options.map((option, index) => (
                  <div
                    key={index}
                    className='group flex items-start gap-2 bg-muted/50 rounded-lg p-2.5'
                  >
                    <div className='pt-2 text-muted-foreground/50'>
                      <GripVertical className='h-4 w-4' />
                    </div>
                    <div className='flex-1 space-y-1.5'>
                      <Input
                        value={option.label}
                        onChange={(e) => handleUpdateOption(index, { label: e.target.value })}
                        onBlur={() => handleSaveOption(index)}
                        className='h-8 text-sm bg-background'
                        placeholder={`Option ${index + 1} (ex: Salade César, Tartare de boeuf...)`}
                      />
                      <Input
                        value={option.description || ''}
                        onChange={(e) => handleUpdateOption(index, { description: e.target.value })}
                        onBlur={() => handleSaveOption(index)}
                        className='h-7 text-xs bg-background text-muted-foreground'
                        placeholder='Description (optionnelle) — ex: Avec copeaux de parmesan et croûtons'
                      />
                    </div>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-8 w-8 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity'
                      onClick={() => handleRemoveOption(index)}
                    >
                      <Trash2 className='h-3.5 w-3.5' />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <Separator />

        {/* Field settings */}
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <Switch
                checked={isPerPerson}
                onCheckedChange={(v) => {
                  setIsPerPerson(v)
                  onUpdate(field.id, { is_per_person: v })
                }}
              />
              <Label className='text-xs'>Par personne</Label>
            </div>
            <div className='flex items-center gap-2'>
              <Switch
                checked={isRequired}
                onCheckedChange={(v) => {
                  setIsRequired(v)
                  onUpdate(field.id, { is_required: v })
                }}
              />
              <Label className='text-xs'>Requis</Label>
            </div>
          </div>
          <Button
            variant='ghost'
            size='sm'
            className='text-destructive hover:text-destructive text-xs'
            onClick={() => onDelete(field.id)}
          >
            <Trash2 className='h-3.5 w-3.5 mr-1.5' />
            Supprimer le champ
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
