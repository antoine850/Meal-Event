import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  Loader2,
  Send,
  CheckCircle2,
  Lock,
  MessageSquare,
  Users,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useMenuFormByToken,
  useSubmitMenuForm,
} from '../hooks/use-menu-forms'

type Props = {
  token: string
}

export function MenuFormPublic({ token }: Props) {
  const { data: formData, isLoading, error } = useMenuFormByToken(token)
  const { mutate: submitForm, isPending: isSubmitting } = useSubmitMenuForm()

  // Local state: responses[fieldId][guestIndex] = value
  const [responses, setResponses] = useState<Record<string, Record<number, string>>>({})
  const [clientComment, setClientComment] = useState('')

  // Initialize responses from existing data
  useEffect(() => {
    if (formData?.menu_form_responses?.length) {
      const map: Record<string, Record<number, string>> = {}
      for (const r of formData.menu_form_responses) {
        if (!map[r.field_id]) map[r.field_id] = {}
        map[r.field_id][r.guest_index] = r.value || ''
      }
      setResponses(map)
    }
    if (formData?.client_comment) {
      setClientComment(formData.client_comment)
    }
  }, [formData])

  const setResponse = useCallback((fieldId: string, guestIndex: number, value: string) => {
    setResponses(prev => ({
      ...prev,
      [fieldId]: {
        ...(prev[fieldId] || {}),
        [guestIndex]: value,
      },
    }))
  }, [])

  if (isLoading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (error || !formData) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50'>
        <Card className='max-w-md w-full mx-4'>
          <CardContent className='pt-6 text-center space-y-2'>
            <p className='text-lg font-semibold'>Formulaire introuvable</p>
            <p className='text-sm text-muted-foreground'>Ce lien est invalide ou le formulaire n'est plus disponible.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isSubmitted = formData.status === 'submitted' || formData.status === 'locked'
  const fields = (formData.menu_form_fields || []).sort((a, b) => a.sort_order - b.sort_order)
  const guestsCount = formData.guests_count || 1

  const handleSubmit = () => {
    // Validate required fields
    for (const field of fields) {
      if (field.is_required) {
        const count = field.is_per_person ? guestsCount : 1
        for (let i = 0; i < count; i++) {
          const val = responses[field.id]?.[i]
          if (!val || !val.trim()) {
            toast.error(`Le champ "${field.label}" est requis${field.is_per_person ? ` (convive ${i + 1})` : ''}`)
            return
          }
        }
      }
    }

    // Build flat responses array
    const flatResponses: { field_id: string; guest_index: number; value: string | null }[] = []
    for (const field of fields) {
      const count = field.is_per_person ? guestsCount : 1
      for (let i = 0; i < count; i++) {
        flatResponses.push({
          field_id: field.id,
          guest_index: i,
          value: responses[field.id]?.[i] || null,
        })
      }
    }

    submitForm({
      formId: formData.id,
      clientComment: clientComment || undefined,
      responses: flatResponses,
    }, {
      onSuccess: () => {
        toast.success('Formulaire soumis avec succès !')
      },
      onError: () => toast.error('Erreur lors de la soumission'),
    })
  }

  const restaurant = (formData as any)?.restaurant
  const primaryColor = restaurant?.color || '#3b82f6'

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Restaurant Branding Banner */}
      {restaurant && (
        <div 
          className='w-full py-8 px-4 text-white shadow-lg'
          style={{ backgroundColor: primaryColor }}
        >
          <div className='max-w-2xl mx-auto'>
            <div className='flex items-start gap-4'>
              {restaurant.logo_url && (
                <img 
                  src={restaurant.logo_url} 
                  alt={restaurant.name}
                  className='h-16 w-16 rounded-lg bg-white/10 object-contain p-2'
                />
              )}
              <div className='flex-1'>
                <h1 className='text-2xl font-bold mb-2'>{restaurant.name}</h1>
                <div className='space-y-1 text-sm text-white/90'>
                  {restaurant.address && (
                    <div className='flex items-center gap-2'>
                      <MapPin className='h-3.5 w-3.5' />
                      <span>{restaurant.address}, {restaurant.postal_code} {restaurant.city}</span>
                    </div>
                  )}
                  {restaurant.phone && (
                    <div className='flex items-center gap-2'>
                      <Phone className='h-3.5 w-3.5' />
                      <span>{restaurant.phone}</span>
                    </div>
                  )}
                  {restaurant.email && (
                    <div className='flex items-center gap-2'>
                      <Mail className='h-3.5 w-3.5' />
                      <span>{restaurant.email}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className='py-8 px-4'>
        <div className='max-w-2xl mx-auto space-y-6'>
          {/* Header */}
          <Card>
            <CardHeader>
              <div className='space-y-2'>
                <CardTitle className='text-xl'>{formData.title}</CardTitle>
                {formData.description && (
                  <p className='text-sm text-muted-foreground'>{formData.description}</p>
                )}
                <div className='flex items-center gap-2'>
                  <Badge variant='outline' className='gap-1'>
                    <Users className='h-3 w-3' />
                    {guestsCount} convive{guestsCount > 1 ? 's' : ''}
                  </Badge>
                  {isSubmitted && (
                    <Badge className='bg-green-500 text-white gap-1'>
                      <CheckCircle2 className='h-3 w-3' /> Soumis
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

        {/* Submitted message */}
        {isSubmitted && (
          <Card className='border-green-200 bg-green-50'>
            <CardContent className='pt-4'>
              <div className='flex items-center gap-2'>
                <Lock className='h-5 w-5 text-green-600' />
                <div>
                  <p className='text-sm font-semibold text-green-800'>Formulaire soumis et verrouillé</p>
                  <p className='text-xs text-green-600'>Vos choix ont été enregistrés. Contactez l'organisateur si vous souhaitez les modifier.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fields */}
        {fields.map(field => {
          const options = parseOptions(field.options)
          const count = field.is_per_person ? guestsCount : 1

          return (
            <Card key={field.id}>
              <CardHeader className='pb-2'>
                <div className='flex items-center gap-2'>
                  <CardTitle className='text-sm'>{field.label}</CardTitle>
                  {field.is_required && <Badge variant='outline' className='text-[9px] text-red-500 border-red-200'>Requis</Badge>}
                  {field.is_per_person && (
                    <Badge variant='outline' className='text-[9px] gap-0.5'>
                      <Users className='h-2.5 w-2.5' /> Par personne
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className='space-y-2'>
                {Array.from({ length: count }).map((_, gIdx) => (
                  <div key={gIdx} className='flex items-center gap-3'>
                    {field.is_per_person && (
                      <span className='text-xs text-muted-foreground w-20 flex-shrink-0'>
                        Convive {gIdx + 1}
                      </span>
                    )}
                    {field.field_type === 'select' ? (
                      <Select
                        value={responses[field.id]?.[gIdx] || ''}
                        onValueChange={v => setResponse(field.id, gIdx, v)}
                        disabled={isSubmitted}
                      >
                        <SelectTrigger className='h-8 text-sm flex-1'>
                          <SelectValue placeholder='Choisir...' />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value='__empty__'>
                            <span className='text-muted-foreground italic'>— Pas de choix —</span>
                          </SelectItem>
                          {options.map((opt, optIdx) => (
                            <SelectItem key={optIdx} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        className='h-8 text-sm flex-1'
                        placeholder='Votre réponse...'
                        value={responses[field.id]?.[gIdx] || ''}
                        onChange={e => setResponse(field.id, gIdx, e.target.value)}
                        disabled={isSubmitted}
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}

        {/* Client Comment */}
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm flex items-center gap-2'>
              <MessageSquare className='h-4 w-4' />
              Commentaire (optionnel)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={clientComment}
              onChange={e => setClientComment(e.target.value)}
              disabled={isSubmitted}
              placeholder='Allergies, préférences, informations complémentaires...'
              className='text-sm min-h-[80px]'
            />
          </CardContent>
        </Card>

        {/* Submit Button */}
        {!isSubmitted && (
          <Button
            className='w-full gap-2'
            size='lg'
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className='h-4 w-4 animate-spin' /> : <Send className='h-4 w-4' />}
            Soumettre mes choix
          </Button>
        )}
        </div>
      </div>
    </div>
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
