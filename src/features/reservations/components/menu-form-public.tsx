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
  Plus,
  Minus,
  AlertCircle,
  Calendar,
  Clock,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useBookingMenuFormByToken,
  useSubmitBookingMenuForm,
} from '../hooks/use-menu-forms'

type Props = {
  token: string
}

export function MenuFormPublic({ token }: Props) {
  const { data: formData, isLoading, error } = useBookingMenuFormByToken(token)
  const { mutate: submitForm, isPending: isSubmitting } = useSubmitBookingMenuForm()

  // Local state: quantities[fieldId][optionValue] = count
  const [quantities, setQuantities] = useState<Record<string, Record<string, number>>>({})
  const [clientComment, setClientComment] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Initialize quantities from existing data
  useEffect(() => {
    if (formData?.menu_form_responses?.length) {
      const qtyMap: Record<string, Record<string, number>> = {}
      for (const r of formData.menu_form_responses) {
        if (!qtyMap[r.field_id]) qtyMap[r.field_id] = {}
        const val = r.value || '__empty__'
        qtyMap[r.field_id][val] = (qtyMap[r.field_id][val] || 0) + 1
      }
      setQuantities(qtyMap)
    }
    if (formData?.client_comment) {
      setClientComment(formData.client_comment)
    }
  }, [formData])

  const updateQuantity = useCallback((fieldId: string, option: string, delta: number, maxTotal?: number) => {
    setQuantities(prev => {
      const fieldQty = prev[fieldId] || {}
      const current = fieldQty[option] || 0
      const newValue = Math.max(0, current + delta)
      
      // Check if we would exceed the max total
      if (maxTotal !== undefined && delta > 0) {
        const currentTotal = Object.values(fieldQty).reduce((sum, qty) => sum + qty, 0)
        if (currentTotal >= maxTotal) {
          return prev // Don't allow increment
        }
      }
      
      return {
        ...prev,
        [fieldId]: {
          ...fieldQty,
          [option]: newValue,
        },
      }
    })
    // Clear validation error when user makes changes
    setValidationErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[fieldId]
      return newErrors
    })
  }, [])

  const setQuantityDirect = useCallback((fieldId: string, option: string, value: string, maxTotal?: number) => {
    const numValue = parseInt(value) || 0
    const clampedValue = Math.max(0, numValue)
    
    setQuantities(prev => {
      const fieldQty = prev[fieldId] || {}
      
      // Calculate what the new total would be
      const otherOptionsTotal = Object.entries(fieldQty)
        .filter(([opt]) => opt !== option)
        .reduce((sum, [, qty]) => sum + qty, 0)
      
      // Limit to max if specified
      let finalValue = clampedValue
      if (maxTotal !== undefined) {
        finalValue = Math.min(clampedValue, maxTotal - otherOptionsTotal)
      }
      
      return {
        ...prev,
        [fieldId]: {
          ...fieldQty,
          [option]: finalValue,
        },
      }
    })
    // Clear validation error when user makes changes
    setValidationErrors(prev => {
      const newErrors = { ...prev }
      delete newErrors[fieldId]
      return newErrors
    })
  }, [])

  const getFieldTotal = useCallback((fieldId: string) => {
    const fieldQty = quantities[fieldId] || {}
    return Object.values(fieldQty).reduce((sum, qty) => sum + qty, 0)
  }, [quantities])

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
  const menuForm = formData.menu_forms
  const fields = (menuForm?.menu_form_fields || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
  const guestsCount = formData.guests_count || 1

  const handleSubmit = () => {
    const errors: Record<string, string> = {}

    // Validate each field
    for (const field of fields) {
      if (field.field_type === 'select') {
        const expectedCount = field.is_per_person ? guestsCount : 1
        const actualTotal = getFieldTotal(field.id)
        
        if (field.is_required && actualTotal === 0) {
          errors[field.id] = `Ce champ est requis. Veuillez sélectionner au moins une option.`
        } else if (field.is_per_person && actualTotal !== expectedCount) {
          errors[field.id] = `Le total doit être exactement ${expectedCount} (actuellement ${actualTotal})`
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      toast.error('Veuillez corriger les erreurs avant de soumettre')
      return
    }

    // Build flat responses array from quantities
    const flatResponses: { field_id: string; guest_index: number; value: string | null }[] = []
    
    for (const field of fields) {
      if (field.field_type === 'select') {
        const fieldQty = quantities[field.id] || {}
        let guestIndex = 0
        
        // Convert quantities to individual responses
        for (const [option, qty] of Object.entries(fieldQty)) {
          for (let i = 0; i < qty; i++) {
            flatResponses.push({
              field_id: field.id,
              guest_index: guestIndex++,
              value: option === '__empty__' ? null : option,
            })
          }
        }
        
        // Fill remaining with null if needed
        const expectedCount = field.is_per_person ? guestsCount : 1
        while (guestIndex < expectedCount) {
          flatResponses.push({
            field_id: field.id,
            guest_index: guestIndex++,
            value: null,
          })
        }
      } else {
        // Text fields remain unchanged for now
        const count = field.is_per_person ? guestsCount : 1
        for (let i = 0; i < count; i++) {
          flatResponses.push({
            field_id: field.id,
            guest_index: i,
            value: null, // TODO: handle text fields if needed
          })
        }
      }
    }

    submitForm({
      bookingMenuFormId: formData.id,
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
  const booking = (formData as any)?.booking
  const contact = booking?.contacts
  const primaryColor = restaurant?.color || '#3b82f6'

  return (
    <div className='min-h-screen bg-gray-50'>
      {/* Restaurant Branding Banner */}
      {restaurant && (
        <div 
          className='w-full py-8 px-4 text-white shadow-lg'
          style={{ backgroundColor: primaryColor }}
        >
          <div className='max-w-4xl mx-auto'>
            <div className='flex items-start justify-between gap-6'>
              {/* Left: Restaurant Info */}
              <div className='flex items-start gap-4 flex-1'>
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

              {/* Right: Booking Info */}
              {booking && (
                <div className='bg-white/10 rounded-lg p-4 min-w-[280px]'>
                  <h2 className='text-sm font-semibold mb-3 text-white/90'>Informations de réservation</h2>
                  <div className='space-y-2 text-sm'>
                    {contact && (
                      <div className='flex items-center gap-2'>
                        <User className='h-3.5 w-3.5 text-white/70' />
                        <span className='font-medium'>{contact.first_name} {contact.last_name}</span>
                      </div>
                    )}
                    {booking.event_date && (
                      <div className='flex items-center gap-2'>
                        <Calendar className='h-3.5 w-3.5 text-white/70' />
                        <span>{new Date(booking.event_date).toLocaleDateString('fr-FR', { 
                          weekday: 'long', 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}</span>
                      </div>
                    )}
                    {booking.start_time && (
                      <div className='flex items-center gap-2'>
                        <Clock className='h-3.5 w-3.5 text-white/70' />
                        <span>{booking.start_time}</span>
                      </div>
                    )}
                    {booking.guests_count && (
                      <div className='flex items-center gap-2'>
                        <Users className='h-3.5 w-3.5 text-white/70' />
                        <span>{booking.guests_count} convive{booking.guests_count > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {booking.occasion && (
                      <div className='text-xs text-white/70 mt-2 pt-2 border-t border-white/20'>
                        {booking.occasion}
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                <CardTitle className='text-xl'>{menuForm?.title || 'Formulaire de menu'}</CardTitle>
                {menuForm?.description && (
                  <p className='text-sm text-muted-foreground'>{menuForm.description}</p>
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
          const expectedCount = field.is_per_person ? guestsCount : 1
          const currentTotal = getFieldTotal(field.id)
          const fieldQty = quantities[field.id] || {}
          const hasError = !!validationErrors[field.id]

          return (
            <Card key={field.id} className={hasError ? 'border-red-300' : ''}>
              <CardHeader className='pb-3'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <CardTitle className='text-sm'>{field.label}</CardTitle>
                    {field.is_required && <Badge variant='outline' className='text-[9px] text-red-500 border-red-200'>Requis</Badge>}
                    {field.is_per_person && (
                      <Badge variant='outline' className='text-[9px] gap-0.5'>
                        <Users className='h-2.5 w-2.5' /> {expectedCount} convive{expectedCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  {field.field_type === 'select' && field.is_per_person && (
                    <div className='text-xs'>
                      <span className={currentTotal === expectedCount ? 'text-green-600 font-medium' : currentTotal > expectedCount ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {currentTotal} / {expectedCount}
                      </span>
                    </div>
                  )}
                </div>
                {hasError && (
                  <div className='flex items-center gap-1.5 text-xs text-red-600 mt-1'>
                    <AlertCircle className='h-3 w-3' />
                    <span>{validationErrors[field.id]}</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className='space-y-3'>
                {field.field_type === 'select' ? (
                  <>
                    {/* Regular options */}
                    {options.map((opt, optIdx) => (
                      <div key={optIdx} className='flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors'>
                        <div className='flex-1'>
                          <span className='text-sm font-medium'>{opt.label}</span>
                          {opt.description && (
                            <p className='text-xs text-muted-foreground mt-0.5'>{opt.description}</p>
                          )}
                        </div>
                        <div className='flex items-center gap-2'>
                          <Button
                            size='sm'
                            variant='outline'
                            className='h-8 w-8 p-0'
                            onClick={() => updateQuantity(field.id, opt.label, -1, expectedCount)}
                            disabled={isSubmitted || (fieldQty[opt.label] || 0) === 0}
                          >
                            <Minus className='h-3 w-3' />
                          </Button>
                          <Input
                            type='number'
                            min='0'
                            max={expectedCount}
                            value={fieldQty[opt.label] || 0}
                            onChange={(e) => setQuantityDirect(field.id, opt.label, e.target.value, expectedCount)}
                            disabled={isSubmitted}
                            className='h-8 w-14 text-center text-sm p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                          />
                          <Button
                            size='sm'
                            variant='outline'
                            className='h-8 w-8 p-0'
                            onClick={() => updateQuantity(field.id, opt.label, 1, expectedCount)}
                            disabled={isSubmitted || currentTotal >= expectedCount}
                          >
                            <Plus className='h-3 w-3' />
                          </Button>
                        </div>
                      </div>
                    ))}
                    
                    {/* None/Vide option - moved to bottom */}
                    <div className='flex items-center justify-between p-3 rounded-lg border bg-muted/30'>
                      <span className='text-sm text-muted-foreground italic'>Aucun choix</span>
                      <div className='flex items-center gap-2'>
                        <Button
                          size='sm'
                          variant='outline'
                          className='h-8 w-8 p-0'
                          onClick={() => updateQuantity(field.id, '__empty__', -1, expectedCount)}
                          disabled={isSubmitted || (fieldQty['__empty__'] || 0) === 0}
                        >
                          <Minus className='h-3 w-3' />
                        </Button>
                        <Input
                          type='number'
                          min='0'
                          max={expectedCount}
                          value={fieldQty['__empty__'] || 0}
                          onChange={(e) => setQuantityDirect(field.id, '__empty__', e.target.value, expectedCount)}
                          disabled={isSubmitted}
                          className='h-8 w-14 text-center text-sm p-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                        />
                        <Button
                          size='sm'
                          variant='outline'
                          className='h-8 w-8 p-0'
                          onClick={() => updateQuantity(field.id, '__empty__', 1, expectedCount)}
                          disabled={isSubmitted || currentTotal >= expectedCount}
                        >
                          <Plus className='h-3 w-3' />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <Input
                    className='text-sm'
                    placeholder='Votre réponse...'
                    disabled={isSubmitted}
                  />
                )}
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

type MenuOption = { label: string; description?: string }

function parseOptions(options: any): MenuOption[] {
  if (!options) return []
  let parsed: any[] = []
  if (typeof options === 'string') {
    try { parsed = JSON.parse(options) } catch { return [] }
  } else if (Array.isArray(options)) {
    parsed = options
  } else {
    return []
  }
  // Convert old format (string[]) to new format ({label, description}[])
  return parsed.map(opt => {
    if (typeof opt === 'string') return { label: opt, description: '' }
    if (typeof opt === 'object' && opt.label) return { label: opt.label, description: opt.description || '' }
    return { label: String(opt), description: '' }
  })
}
