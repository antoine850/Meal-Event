import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import {
  Plus,
  Trash2,
  Copy,
  Lock,
  Send,
  Loader2,
  X,
  MessageSquare,
  Users,
  CheckCircle2,
  Clock,
  FileEdit,
  Save,
  Settings2,
  ListChecks,
  ClipboardList,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useMenuFormFull,
  useUpdateMenuForm,
  useAddMenuFormField,
  useUpdateMenuFormField,
  useDeleteMenuFormField,
} from '../hooks/use-menu-forms'
import type { MenuFormField } from '@/lib/supabase/types'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

type Props = {
  formId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Isolated Field Editor (prevents parent re-render on keystroke) ──
function FieldEditor({ field, onSave, onDelete, isLocked }: {
  field: MenuFormField
  onSave: (id: string, updates: Partial<MenuFormField>) => void
  onDelete: (id: string) => void
  isLocked: boolean
}) {
  const [label, setLabel] = useState(field.label)
  const [fieldType, setFieldType] = useState(field.field_type)
  const [isPerPerson, setIsPerPerson] = useState(field.is_per_person)
  const [isRequired, setIsRequired] = useState(field.is_required)
  const [options, setOptions] = useState<string[]>(parseOptions(field.options))
  const [newOption, setNewOption] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  // Sync from server data only when field id changes (new field loaded)
  const prevFieldIdRef = useRef(field.id)
  useEffect(() => {
    if (prevFieldIdRef.current !== field.id) {
      prevFieldIdRef.current = field.id
      setLabel(field.label)
      setFieldType(field.field_type)
      setIsPerPerson(field.is_per_person)
      setIsRequired(field.is_required)
      setOptions(parseOptions(field.options))
      setIsDirty(false)
    }
  }, [field.id, field.label, field.field_type, field.is_per_person, field.is_required, field.options])

  const saveAll = useCallback(() => {
    if (!isDirty) return
    onSave(field.id, {
      label,
      field_type: fieldType,
      is_per_person: isPerPerson,
      is_required: isRequired,
      options: JSON.stringify(options),
    })
    setIsDirty(false)
  }, [field.id, label, fieldType, isPerPerson, isRequired, options, isDirty, onSave])

  const addOption = () => {
    const text = newOption.trim()
    if (!text) return
    setOptions(prev => [...prev, text])
    setNewOption('')
    setIsDirty(true)
  }

  const removeOption = (idx: number) => {
    setOptions(prev => prev.filter((_, i) => i !== idx))
    setIsDirty(true)
  }

  if (isLocked) {
    return (
      <Card>
        <CardContent className='p-4'>
          <div className='flex items-center gap-3'>
            <div className='flex-1 space-y-1'>
              <div className='flex items-center gap-2'>
                <span className='text-sm font-medium'>{field.label}</span>
                <Badge variant='outline' className='text-[9px]'>{field.field_type === 'select' ? 'Choix' : 'Texte'}</Badge>
                {field.is_per_person && <Badge variant='outline' className='text-[9px] gap-0.5'><Users className='h-2.5 w-2.5' /> Par personne</Badge>}
                {field.is_required && <Badge variant='outline' className='text-[9px] text-red-500 border-red-200'>Requis</Badge>}
              </div>
              {field.field_type === 'select' && (
                <div className='flex gap-1.5 flex-wrap mt-1'>
                  {parseOptions(field.options).map((opt, i) => (
                    <Badge key={i} variant='secondary' className='text-xs'>{opt}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={isDirty ? 'ring-1 ring-amber-300' : ''}>
      <CardContent className='p-4 space-y-4'>
        {/* Row 1: Label + Type */}
        <div className='grid grid-cols-[1fr_160px] gap-3'>
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>Nom du champ</Label>
            <Input
              value={label}
              onChange={e => { setLabel(e.target.value); setIsDirty(true) }}
              onBlur={saveAll}
              className='h-9'
              placeholder='Ex: Entrée, Plat principal...'
            />
          </div>
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium'>Type</Label>
            <Select value={fieldType} onValueChange={v => { setFieldType(v); setIsDirty(true) }}>
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

        {/* Row 2: Toggles */}
        <div className='flex items-center gap-6'>
          <div className='flex items-center gap-2'>
            <Switch
              checked={isPerPerson}
              onCheckedChange={v => { setIsPerPerson(v); setIsDirty(true) }}
            />
            <Label className='text-xs cursor-pointer'>Par personne</Label>
          </div>
          <div className='flex items-center gap-2'>
            <Switch
              checked={isRequired}
              onCheckedChange={v => { setIsRequired(v); setIsDirty(true) }}
            />
            <Label className='text-xs cursor-pointer'>Requis</Label>
          </div>
        </div>

        {/* Row 3: Options (select only) */}
        {fieldType === 'select' && (
          <div className='space-y-2'>
            <Label className='text-xs font-medium'>Options de choix</Label>
            <div className='space-y-1.5'>
              {options.map((opt, idx) => (
                <div key={idx} className='flex items-center gap-2 group'>
                  <div className='flex-1 flex items-center bg-muted/50 rounded-md px-3 py-1.5 text-sm'>
                    {opt}
                  </div>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive'
                    onClick={() => removeOption(idx)}
                  >
                    <X className='h-3.5 w-3.5' />
                  </Button>
                </div>
              ))}
              <div className='flex items-center gap-2'>
                <Input
                  className='h-8 text-sm flex-1'
                  placeholder='Ajouter une option...'
                  value={newOption}
                  onChange={e => setNewOption(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
                />
                <Button size='sm' variant='outline' className='h-8 px-3 text-xs gap-1' onClick={addOption} disabled={!newOption.trim()}>
                  <Plus className='h-3 w-3' />
                  Ajouter
                </Button>
              </div>
            </div>
            {options.length === 0 && (
              <p className='text-xs text-amber-600 flex items-center gap-1'>
                <AlertCircle className='h-3 w-3' /> Ajoutez au moins une option
              </p>
            )}
          </div>
        )}

        {/* Row 4: Actions */}
        <div className='flex items-center justify-between pt-1'>
          <Button
            variant='ghost'
            size='sm'
            className='h-7 text-xs text-destructive hover:text-destructive gap-1'
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className='h-3 w-3' />
            Supprimer
          </Button>
          {isDirty && (
            <Button size='sm' className='h-7 text-xs gap-1' onClick={saveAll}>
              <Save className='h-3 w-3' />
              Sauvegarder
            </Button>
          )}
        </div>
      </CardContent>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce champ ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le champ "{label}" et toutes ses options seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className='bg-destructive text-destructive-foreground hover:bg-destructive/90' onClick={() => onDelete(field.id)}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// ── Main Builder ──
export function MenuFormBuilder({ formId, open, onOpenChange }: Props) {
  // Early return MUST be before any hooks
  if (!formId) return null

  const { data: formData, isLoading } = useMenuFormFull(formId)
  const { mutate: updateForm, isPending: isSaving } = useUpdateMenuForm()
  const { mutate: addField, isPending: isAddingField } = useAddMenuFormField()
  const { mutate: updateField } = useUpdateMenuFormField()
  const { mutate: deleteField } = useDeleteMenuFormField()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [guestsCount, setGuestsCount] = useState(1)
  const [formDirty, setFormDirty] = useState(false)

  useEffect(() => {
    if (formData) {
      setTitle(formData.title || '')
      setDescription(formData.description || '')
      setGuestsCount(formData.guests_count || 1)
      setFormDirty(false)
    }
  }, [formData])

  const isLocked = formData?.status === 'submitted' || formData?.status === 'locked'
  const fields = (formData?.menu_form_fields || []).sort((a, b) => a.sort_order - b.sort_order)
  const responses = formData?.menu_form_responses || []

  const saveFormSettings = () => {
    if (!formId || !formDirty) return
    updateForm({ id: formId, title, description, guests_count: guestsCount } as any, {
      onSuccess: () => { toast.success('Formulaire sauvegardé'); setFormDirty(false) },
      onError: () => toast.error('Erreur lors de la sauvegarde'),
    })
  }

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
      onError: () => toast.error('Erreur lors de l\'ajout'),
    })
  }

  const handleSaveField = useCallback((fieldId: string, updates: Partial<MenuFormField>) => {
    updateField({ id: fieldId, ...updates } as any, {
      onSuccess: () => toast.success('Champ sauvegardé'),
      onError: () => toast.error('Erreur lors de la mise à jour'),
    })
  }, [updateField])

  const handleDeleteField = useCallback((fieldId: string) => {
    deleteField(fieldId, {
      onSuccess: () => toast.success('Champ supprimé'),
      onError: () => toast.error('Erreur lors de la suppression'),
    })
  }, [deleteField])

  const handleShareForm = () => {
    if (!formId) return
    // Save settings first if dirty
    const doShare = () => {
      updateForm({ id: formId, status: 'shared' } as any, {
        onSuccess: () => toast.success('Formulaire partagé ! Le lien est maintenant actif.'),
        onError: () => toast.error('Erreur lors du partage'),
      })
    }
    if (formDirty) {
      updateForm({ id: formId, title, description, guests_count: guestsCount } as any, {
        onSuccess: () => { setFormDirty(false); doShare() },
        onError: () => toast.error('Erreur lors de la sauvegarde'),
      })
    } else {
      doShare()
    }
  }

  const handleLockForm = () => {
    if (!formId) return
    updateForm({ id: formId, status: 'locked' } as any, {
      onSuccess: () => toast.success('Formulaire verrouillé'),
      onError: () => toast.error('Erreur'),
    })
  }

  const copyShareLink = () => {
    if (!formData?.share_token) return
    const url = `${window.location.origin}/menu-form/${formData.share_token}`
    navigator.clipboard.writeText(url)
    toast.success('Lien copié dans le presse-papiers')
  }

  const getResponseValue = (fieldId: string, guestIndex: number) => {
    return responses.find(r => r.field_id === fieldId && r.guest_index === guestIndex)?.value || ''
  }

  const statusConfig: Record<string, { label: string; icon: React.ReactNode; variant: 'secondary' | 'default' | 'destructive' | 'outline'; className: string }> = {
    draft: { label: 'Brouillon', icon: <FileEdit className='h-3 w-3' />, variant: 'secondary', className: '' },
    shared: { label: 'Partagé', icon: <Send className='h-3 w-3' />, variant: 'default', className: 'bg-blue-500 hover:bg-blue-600 text-white' },
    submitted: { label: 'Soumis', icon: <CheckCircle2 className='h-3 w-3' />, variant: 'default', className: 'bg-green-500 hover:bg-green-600 text-white' },
    locked: { label: 'Verrouillé', icon: <Lock className='h-3 w-3' />, variant: 'default', className: 'bg-gray-600 hover:bg-gray-700 text-white' },
  }
  const status = statusConfig[formData?.status || 'draft'] || statusConfig.draft

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0'>
        {/* Header */}
        <DialogHeader className='px-6 py-4 border-b shrink-0'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <div className='flex items-center gap-3'>
                <DialogTitle className='text-lg'>{title || 'Formulaire de menu'}</DialogTitle>
                <Badge className={`gap-1 ${status.className}`} variant={status.variant}>
                  {status.icon} {status.label}
                </Badge>
              </div>
              <DialogDescription className='text-xs'>
                {formData?.updated_at && (
                  <span className='flex items-center gap-1'>
                    <Clock className='h-3 w-3' />
                    Dernière modification le {format(new Date(formData.updated_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                  </span>
                )}
              </DialogDescription>
            </div>
            <div className='flex items-center gap-2'>
              {(formData?.status === 'shared' || formData?.status === 'submitted') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size='sm' variant='outline' className='gap-1.5' onClick={copyShareLink}>
                      <Copy className='h-3.5 w-3.5' />
                      Copier le lien
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Copier le lien public du formulaire</TooltipContent>
                </Tooltip>
              )}
              {formData?.status === 'draft' && fields.length > 0 && (
                <Button size='sm' className='gap-1.5' onClick={handleShareForm}>
                  <Send className='h-3.5 w-3.5' />
                  Partager au client
                </Button>
              )}
              {formData?.status === 'submitted' && (
                <Button size='sm' variant='outline' className='gap-1.5' onClick={handleLockForm}>
                  <Lock className='h-3.5 w-3.5' />
                  Verrouiller
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        {isLoading ? (
          <div className='flex-1 flex items-center justify-center'>
            <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
          </div>
        ) : (
          <ScrollArea className='flex-1'>
            <div className='p-6 max-w-3xl mx-auto space-y-8'>
              {/* ── Section: Informations générales ── */}
              <div className='space-y-4'>
                <div className='flex items-center gap-2'>
                  <Settings2 className='h-5 w-5 text-muted-foreground' />
                  <h2 className='text-lg font-semibold'>Informations générales</h2>
                </div>
                <Card>
                  <CardContent className='pt-6 space-y-4'>
                    <div className='space-y-2'>
                      <Label>Titre du formulaire</Label>
                      <Input
                        value={title}
                        onChange={e => { setTitle(e.target.value); setFormDirty(true) }}
                        disabled={isLocked}
                        placeholder='Ex: Choix de menu - Mariage Dupont'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label>Description</Label>
                      <Textarea
                        value={description}
                        onChange={e => { setDescription(e.target.value); setFormDirty(true) }}
                        disabled={isLocked}
                        className='min-h-[80px]'
                        placeholder='Instructions pour le client : allergies à signaler, date limite de réponse...'
                      />
                    </div>
                    <div className='space-y-2'>
                      <Label>Nombre de convives</Label>
                      <p className='text-xs text-muted-foreground'>Pour les champs "par personne", le client devra faire un choix pour chaque convive.</p>
                      <Input
                        type='number'
                        min={1}
                        max={500}
                        value={guestsCount}
                        onChange={e => { setGuestsCount(Math.max(1, Number(e.target.value))); setFormDirty(true) }}
                        disabled={isLocked}
                        className='w-28'
                      />
                    </div>
                  </CardContent>
                </Card>
                {!isLocked && formDirty && (
                  <div className='flex justify-end'>
                    <Button className='gap-1.5' onClick={saveFormSettings} disabled={isSaving}>
                      {isSaving ? <Loader2 className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
                      Sauvegarder
                    </Button>
                  </div>
                )}
              </div>

              {/* ── Section: Champs du formulaire ── */}
              <div className='space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <ListChecks className='h-5 w-5 text-muted-foreground' />
                    <h2 className='text-lg font-semibold'>Champs du formulaire</h2>
                    {fields.length > 0 && <Badge variant='secondary' className='ml-2'>{fields.length}</Badge>}
                  </div>
                  {!isLocked && (
                    <Button size='sm' className='gap-1.5' onClick={handleAddField} disabled={isAddingField}>
                      {isAddingField ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : <Plus className='h-3.5 w-3.5' />}
                      Ajouter un champ
                    </Button>
                  )}
                </div>

                {fields.length === 0 ? (
                  <Card className='border-dashed'>
                    <CardContent className='py-12 text-center space-y-3'>
                      <ListChecks className='mx-auto h-10 w-10 text-muted-foreground/40' />
                      <div>
                        <p className='text-sm font-medium text-muted-foreground'>Aucun champ</p>
                        <p className='text-xs text-muted-foreground mt-1'>Ajoutez des champs pour que le client puisse faire ses choix de menu.</p>
                      </div>
                      {!isLocked && (
                        <Button variant='outline' size='sm' className='gap-1.5 mt-2' onClick={handleAddField} disabled={isAddingField}>
                          <Plus className='h-3.5 w-3.5' />
                          Ajouter un premier champ
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <div className='space-y-3'>
                    {fields.map((field) => (
                      <FieldEditor
                        key={field.id}
                        field={field}
                        onSave={handleSaveField}
                        onDelete={handleDeleteField}
                        isLocked={isLocked}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ── Section: Réponses du client ── */}
              {(formData?.status === 'submitted' || formData?.status === 'locked') && (
                <div className='space-y-4'>
                  <div className='flex items-center gap-2'>
                    <ClipboardList className='h-5 w-5 text-muted-foreground' />
                    <h2 className='text-lg font-semibold'>Réponses du client</h2>
                    {responses.length > 0 && <Badge variant='secondary' className='ml-2 bg-green-100 text-green-700'>{responses.length}</Badge>}
                  </div>

                  {/* Status banner */}
                  <Card className={formData?.status === 'submitted' ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'}>
                    <CardContent className='p-4'>
                      <div className='flex items-center gap-3'>
                        {formData?.status === 'submitted' ? (
                          <CheckCircle2 className='h-5 w-5 text-green-600 shrink-0' />
                        ) : (
                          <Lock className='h-5 w-5 text-gray-600 shrink-0' />
                        )}
                        <div className='flex-1'>
                          <p className='text-sm font-semibold'>
                            {formData?.status === 'submitted' ? 'Le client a soumis ses choix' : 'Formulaire verrouillé'}
                          </p>
                          {formData?.submitted_at && (
                            <p className='text-xs text-muted-foreground'>
                              Soumis le {format(new Date(formData.submitted_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Client comment */}
                  {formData?.client_comment && (
                    <Card>
                      <CardHeader className='pb-2'>
                        <CardTitle className='text-sm flex items-center gap-2'>
                          <MessageSquare className='h-4 w-4' />
                          Commentaire du client
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className='text-sm bg-muted/50 rounded-md p-3 italic'>"{formData.client_comment}"</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Responses table per field */}
                  {fields.map(field => {
                    const count = field.is_per_person ? guestsCount : 1

                    return (
                      <Card key={field.id}>
                        <CardHeader className='pb-2'>
                          <div className='flex items-center gap-2'>
                            <CardTitle className='text-sm'>{field.label}</CardTitle>
                            <Badge variant='outline' className='text-[9px]'>{field.field_type === 'select' ? 'Choix' : 'Texte'}</Badge>
                            {field.is_per_person && <Badge variant='outline' className='text-[9px] gap-0.5'><Users className='h-2.5 w-2.5' /> Par personne</Badge>}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                {field.is_per_person && <TableHead className='w-28'>Convive</TableHead>}
                                <TableHead>Réponse</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Array.from({ length: count }).map((_, gIdx) => {
                                const val = getResponseValue(field.id, gIdx)
                                return (
                                  <TableRow key={gIdx}>
                                    {field.is_per_person && (
                                      <TableCell className='font-medium text-xs'>Convive {gIdx + 1}</TableCell>
                                    )}
                                    <TableCell className='text-sm'>
                                      {val ? (
                                        <span>{val}</span>
                                      ) : (
                                        <span className='text-muted-foreground italic'>— Pas de choix —</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </CardContent>
                      </Card>
                    )
                  })}

                  {responses.length === 0 && (
                    <Card className='border-dashed'>
                      <CardContent className='py-12 text-center space-y-2'>
                        <ClipboardList className='mx-auto h-10 w-10 text-muted-foreground/40' />
                        <p className='text-sm text-muted-foreground'>Aucune réponse reçue</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ── Helpers ──

function parseOptions(options: any): string[] {
  if (!options) return []
  if (typeof options === 'string') {
    try { return JSON.parse(options) } catch { return [] }
  }
  if (Array.isArray(options)) return options as string[]
  return []
}
