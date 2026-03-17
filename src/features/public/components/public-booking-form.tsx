import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  CalendarDays,
  Users,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  Loader2,
  UtensilsCrossed,
  PartyPopper,
  User,
  Building2,
  Mail,
  AlertTriangle,
  Minus,
  Plus,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// ============================================
// Types & Constants
// ============================================
type RestaurantInfo = {
  id: string
  name: string
  slug: string
  color: string | null
  logo_url: string | null
}

type FormData = {
  event_type: string
  occasion: string
  event_date: Date | undefined
  guests_count: number | ''
  allergies: string
  client_type: 'particulier' | 'professionnel'
  company_name: string
  last_name: string
  first_name: string
  phone_country: string
  phone: string
  email: string
}

type Country = { code: string; name: string; dial: string; flag: string }

const API_BASE_URL = import.meta.env.DEV
  ? ''
  : (import.meta.env.VITE_API_URL || 'http://localhost:3001')

const OCCASION_OPTIONS = [
  'Anniversaire',
  'Soirée entreprise',
  "Dîner d'entreprise",
  "Déjeuner d'équipe",
  "Dîner d'équipe",
  'Séminaire',
  'Cocktail',
  'Pot de départ',
  'Mariage',
  'Baptême / Communion',
  'Soirée privée',
  'Autre',
]

const COUNTRIES: Country[] = [
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', dial: '+32', flag: '🇧🇪' },
  { code: 'CH', name: 'Suisse', dial: '+41', flag: '🇨🇭' },
  { code: 'LU', name: 'Luxembourg', dial: '+352', flag: '🇱🇺' },
  { code: 'MC', name: 'Monaco', dial: '+377', flag: '🇲🇨' },
  { code: 'DE', name: 'Allemagne', dial: '+49', flag: '🇩🇪' },
  { code: 'GB', name: 'Royaume-Uni', dial: '+44', flag: '🇬🇧' },
  { code: 'ES', name: 'Espagne', dial: '+34', flag: '🇪🇸' },
  { code: 'IT', name: 'Italie', dial: '+39', flag: '🇮🇹' },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹' },
  { code: 'NL', name: 'Pays-Bas', dial: '+31', flag: '🇳🇱' },
  { code: 'US', name: 'États-Unis', dial: '+1', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'MA', name: 'Maroc', dial: '+212', flag: '🇲🇦' },
  { code: 'TN', name: 'Tunisie', dial: '+216', flag: '🇹🇳' },
  { code: 'DZ', name: 'Algérie', dial: '+213', flag: '🇩🇿' },
]

// ============================================
// Number Stepper
// ============================================
function NumberStepper({
  value,
  onChange,
  min = 1,
  placeholder,
  hasError,
  accentColor,
}: {
  value: number | ''
  onChange: (v: number | '') => void
  min?: number
  placeholder: string
  hasError?: boolean
  accentColor: string
}) {
  const numVal = typeof value === 'number' ? value : 0
  return (
    <div className={cn(
      'flex items-center gap-3 rounded-md border bg-white p-1.5 transition-colors',
      hasError ? 'border-destructive' : 'border-input'
    )}>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(Math.max(min, numVal - 1))}>
        <Minus className="h-4 w-4" />
      </Button>
      <div className="flex-1 flex items-center justify-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          type="number"
          inputMode="numeric"
          min={min}
          value={value === '' ? '' : value}
          onChange={e => {
            const raw = e.target.value
            if (raw === '') { onChange(''); return }
            const n = parseInt(raw, 10)
            if (!isNaN(n)) onChange(Math.max(min, n))
          }}
          placeholder={placeholder}
          className="w-16 text-center text-sm font-semibold bg-transparent focus:outline-none placeholder:text-muted-foreground placeholder:font-normal [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        {value !== '' && <span className="text-xs text-muted-foreground shrink-0">invités</span>}
      </div>
      <Button type="button" size="icon" className="h-8 w-8 shrink-0 text-white" style={{ backgroundColor: accentColor }} onClick={() => onChange(Math.max(min, numVal + 1))}>
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}

// ============================================
// Phone Input with country code
// ============================================
function PhoneInput({
  countryCode,
  phone,
  onCountryChange,
  onPhoneChange,
  hasError,
}: {
  countryCode: string
  phone: string
  onCountryChange: (code: string) => void
  onPhoneChange: (phone: string) => void
  hasError?: boolean
}) {
  const country = COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0]

  return (
    <div className={cn(
      'flex items-center rounded-md border bg-white overflow-hidden transition-colors',
      hasError ? 'border-destructive' : 'border-input'
    )}>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" className="h-auto rounded-none border-r px-2.5 py-2.5 hover:bg-muted/50 shrink-0 gap-1.5">
            <span className="text-base leading-none">{country.flag}</span>
            <span className="text-xs text-muted-foreground font-medium">{country.dial}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1" align="start">
          <div className="max-h-[200px] overflow-y-auto">
            {COUNTRIES.map(c => (
              <button
                key={c.code}
                type="button"
                onClick={() => onCountryChange(c.code)}
                className={cn(
                  'w-full text-left px-2.5 py-1.5 text-sm rounded-sm transition-colors flex items-center gap-2',
                  countryCode === c.code ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
                )}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span className="flex-1 truncate">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.dial}</span>
                {countryCode === c.code && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <input
        type="tel"
        value={phone}
        onChange={e => onPhoneChange(e.target.value.replace(/[^\d\s.\-]/g, ''))}
        placeholder="6 12 34 56 78"
        autoComplete="tel-national"
        className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

// ============================================
// Main Component
// ============================================
export function PublicBookingForm({ slug }: { slug: string }) {
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Capture UTM params & Facebook click ID from URL on mount
  const [utmParams] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    // Build fbc (Facebook click ID cookie format) from fbclid
    const fbclid = params.get('fbclid') || undefined
    const fbc = fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined
    return {
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      utm_content: params.get('utm_content') || undefined,
      utm_term: params.get('utm_term') || undefined,
      fbclid,
      fbc,
      event_source_url: window.location.href,
    }
  })

  const [form, setForm] = useState<FormData>({
    event_type: '',
    occasion: '',
    event_date: undefined,
    guests_count: 16,
    allergies: '',
    client_type: 'particulier',
    company_name: '',
    last_name: '',
    first_name: '',
    phone_country: 'FR',
    phone: '',
    email: '',
  })

  const [honeypot, setHoneypot] = useState('')
  const accentColor = restaurant?.color || '#c2956b'

  // Force light theme on public pages
  useEffect(() => {
    const root = document.documentElement
    const prev = root.classList.contains('dark') ? 'dark' : 'light'
    root.classList.remove('dark')
    root.classList.add('light')
    return () => {
      root.classList.remove('light')
      root.classList.add(prev)
    }
  }, [])

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/public/restaurants/${slug}`)
      .then(res => { if (!res.ok) throw new Error('Not found'); return res.json() })
      .then(data => { setRestaurant(data); setLoading(false) })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [slug])

  const updateForm = (field: keyof FormData, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const validateStep1 = () => {
    const e: Record<string, string> = {}
    if (!form.event_type) e.event_type = 'Requis'
    if (!form.occasion) e.occasion = 'Requis'
    setErrors(e); return Object.keys(e).length === 0
  }

  const validateStep2 = () => {
    const e: Record<string, string> = {}
    if (!form.event_date) e.event_date = 'Requis'
    if (!form.guests_count || Number(form.guests_count) < 16) e.guests_count = 'Min. 16 invités'
    setErrors(e); return Object.keys(e).length === 0
  }

  const validateStep3 = () => {
    const e: Record<string, string> = {}
    if (!form.last_name.trim()) e.last_name = 'Requis'
    if (!form.first_name.trim()) e.first_name = 'Requis'
    if (!form.phone.trim()) e.phone = 'Requis'
    if (!form.email.trim()) e.email = 'Requis'
    else if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(form.email.trim())) e.email = 'Email invalide'
    else if (/\.\.|\.@|@\./.test(form.email.trim())) e.email = 'Email invalide'
    setErrors(e); return Object.keys(e).length === 0
  }

  const goNext = () => {
    if (step === 1 && validateStep1()) setStep(2)
    else if (step === 2 && validateStep2()) setStep(3)
    else if (step === 3 && validateStep3()) handleSubmit()
  }

  const goBack = () => { if (step > 1) setStep(step - 1) }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE_URL}/api/public/booking-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_slug: slug,
          event_type: form.event_type,
          occasion: form.occasion,
          event_date: form.event_date ? format(form.event_date, 'yyyy-MM-dd') : null,
          guests_count: Number(form.guests_count),
          allergies: form.allergies,
          client_type: form.client_type,
          company_name: form.company_name,
          last_name: form.last_name,
          first_name: form.first_name,
          phone: `${COUNTRIES.find(c => c.code === form.phone_country)?.dial || '+33'} ${form.phone}`,
          email: form.email,
          website_url: honeypot,
          // UTM tracking & Facebook metadata
          ...utmParams,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erreur')
      }
      setStep(4)
    } catch (err: any) {
      setErrors({ submit: err.message || 'Une erreur est survenue' })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (notFound || !restaurant) {
    return (
      <div className="h-dvh flex items-center justify-center bg-white">
        <div className="text-center space-y-3 px-6">
          <AlertTriangle className="h-12 w-12 text-muted-foreground/40 mx-auto" />
          <h1 className="text-xl font-semibold">Page introuvable</h1>
          <p className="text-muted-foreground">Ce restaurant n'existe pas ou n'est plus actif.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 bg-white/80 backdrop-blur-md border-b z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} className="h-9 w-9 rounded-full object-cover ring-2 ring-muted" />
          ) : (
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: accentColor }}>
              {restaurant.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold truncate text-sm">{restaurant.name}</h1>
            <p className="text-xs text-muted-foreground">Demande de réservation</p>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="h-1.5 rounded-full transition-all duration-500" style={{ width: step >= s ? 20 : 6, backgroundColor: step >= s ? accentColor : '#d6d3d1' }} />
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-lg w-full mx-auto px-4 py-4 flex flex-col min-h-full">
          {step === 1 && <Step1 form={form} errors={errors} accentColor={accentColor} updateForm={updateForm} />}
          {step === 2 && <Step2Date form={form} errors={errors} accentColor={accentColor} updateForm={updateForm} />}
          {step === 3 && <Step3Contact form={form} errors={errors} accentColor={accentColor} updateForm={updateForm} honeypot={honeypot} setHoneypot={setHoneypot} />}
          {step === 4 && <Step4Success restaurant={restaurant} accentColor={accentColor} />}
        </div>
      </main>

      {/* Footer */}
      {step < 4 && (
        <footer className="shrink-0 bg-white/80 backdrop-blur-md border-t">
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between gap-3">
            {step > 1 ? (
              <Button type="button" variant="ghost" onClick={goBack} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Retour
              </Button>
            ) : <div />}
            {errors.submit && <p className="text-xs text-destructive flex-1 text-center">{errors.submit}</p>}
            <Button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className="rounded-full px-6 gap-2 text-white shadow-lg"
              style={{ backgroundColor: accentColor }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 3 ? (<>Envoyer <Check className="h-4 w-4" /></>) : (<>Continuer <ChevronRight className="h-4 w-4" /></>)}
            </Button>
          </div>
        </footer>
      )}
    </div>
  )
}

// ============================================
// Step 1 — Event type + occasion
// ============================================
function Step1({
  form, errors, accentColor, updateForm,
}: {
  form: FormData; errors: Record<string, string>; accentColor: string; updateForm: (field: keyof FormData, value: any) => void
}) {
  const eventTypes = [
    { value: 'repas-assis', label: 'Repas Assis', icon: UtensilsCrossed },
    { value: 'cocktail', label: 'Cocktail debout', icon: PartyPopper },
    { value: 'autre', label: 'Autre', icon: CalendarDays },
  ]

  return (
    <div className="flex-1 flex flex-col justify-center gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-2xl font-bold">Votre événement</h2>
        <p className="text-muted-foreground mt-1 text-sm">Dites-nous en plus sur votre projet.</p>
      </div>

      <fieldset className="space-y-2">
        <Label>Quelle est votre demande ? <span className="text-destructive">*</span></Label>
        <div className="grid grid-cols-3 gap-2">
          {eventTypes.map(t => {
            const selected = form.event_type === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => updateForm('event_type', t.value)}
                className={cn(
                  'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
                  selected ? 'bg-accent/30 shadow-sm' : 'border-input hover:border-ring bg-white'
                )}
                style={selected ? { borderColor: accentColor } : undefined}
              >
                <t.icon className={cn('h-5 w-5', selected ? '' : 'text-muted-foreground')} style={selected ? { color: accentColor } : undefined} />
                <span className={cn('text-xs font-medium text-center leading-tight', selected ? '' : 'text-muted-foreground')}>{t.label}</span>
                {selected && (
                  <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: accentColor }}>
                    <Check className="h-2 w-2" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {errors.event_type && <p className="text-xs text-destructive">{errors.event_type}</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <Label>À quelle occasion ? <span className="text-destructive">*</span></Label>
        <Select value={form.occasion} onValueChange={v => updateForm('occasion', v)}>
          <SelectTrigger className={cn('w-full h-10', errors.occasion && 'border-destructive')}>
            <SelectValue placeholder="Sélectionner une occasion..." />
          </SelectTrigger>
          <SelectContent>
            {OCCASION_OPTIONS.map(o => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.occasion && <p className="text-xs text-destructive">{errors.occasion}</p>}
      </fieldset>
    </div>
  )
}

// ============================================
// Step 2 — Date + guests + allergies
// ============================================
function Step2Date({
  form, errors, accentColor, updateForm,
}: {
  form: FormData; errors: Record<string, string>; accentColor: string; updateForm: (field: keyof FormData, value: any) => void
}) {
  const [calOpen, setCalOpen] = useState(false)

  return (
    <div className="flex-1 flex flex-col justify-center gap-5 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-2xl font-bold">Les détails</h2>
        <p className="text-muted-foreground mt-1 text-sm">Date, nombre d'invités et restrictions.</p>
      </div>

      <fieldset className="space-y-2">
        <Label>Date souhaitée <span className="text-destructive">*</span></Label>
        <Popover open={calOpen} onOpenChange={setCalOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className={cn(
                'w-full justify-start text-left font-normal h-10',
                !form.event_date && 'text-muted-foreground',
                errors.event_date && 'border-destructive'
              )}
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              {form.event_date ? format(form.event_date, 'EEEE d MMMM yyyy', { locale: fr }) : 'Sélectionner une date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={form.event_date}
              onSelect={date => { updateForm('event_date', date); setCalOpen(false) }}
              disabled={{ before: new Date() }}
              locale={fr}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.event_date && <p className="text-xs text-destructive">{errors.event_date}</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <Label>Combien d'invités ? <span className="text-destructive">*</span></Label>
        <NumberStepper
          value={form.guests_count}
          onChange={v => updateForm('guests_count', v)}
          min={16}
          placeholder="Nombre d'invités"
          hasError={!!errors.guests_count}
          accentColor={accentColor}
        />
        {errors.guests_count && <p className="text-xs text-destructive">{errors.guests_count}</p>}
      </fieldset>

      <fieldset className="space-y-2">
        <Label>Allergies ou régimes spécifiques ?</Label>
        <Input
          value={form.allergies}
          onChange={e => updateForm('allergies', e.target.value)}
          placeholder="Allergies, intolérances, végétarien, halal..."
        />
      </fieldset>
    </div>
  )
}

// ============================================
// Step 3 — Contact details
// ============================================
function Step3Contact({
  form, errors, accentColor, updateForm, honeypot, setHoneypot,
}: {
  form: FormData; errors: Record<string, string>; accentColor: string; updateForm: (field: keyof FormData, value: any) => void; honeypot: string; setHoneypot: (v: string) => void
}) {
  const clientTypes = [
    { value: 'particulier' as const, label: 'Particulier', icon: User },
    { value: 'professionnel' as const, label: 'Professionnel', icon: Building2 },
  ]

  return (
    <div className="flex-1 flex flex-col justify-center gap-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div>
        <h2 className="text-2xl font-bold">Vos coordonnées</h2>
        <p className="text-muted-foreground mt-1 text-sm">Pour que nous puissions vous recontacter.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {clientTypes.map(t => {
          const selected = form.client_type === t.value
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => updateForm('client_type', t.value)}
              className={cn(
                'flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all text-sm',
                selected ? 'bg-accent/30 shadow-sm' : 'border-input hover:border-ring bg-white'
              )}
              style={selected ? { borderColor: accentColor } : undefined}
            >
              <t.icon className={cn('h-4 w-4', selected ? '' : 'text-muted-foreground')} style={selected ? { color: accentColor } : undefined} />
              <span className={cn('font-medium', selected ? '' : 'text-muted-foreground')}>{t.label}</span>
            </button>
          )
        })}
      </div>

      {form.client_type === 'professionnel' && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <Input value={form.company_name} onChange={e => updateForm('company_name', e.target.value)} placeholder="Nom de l'entreprise" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Input autoComplete="given-name" value={form.first_name} onChange={e => updateForm('first_name', e.target.value)} placeholder="Prénom *" className={cn(errors.first_name && 'border-destructive')} />
          {errors.first_name && <p className="text-xs text-destructive">{errors.first_name}</p>}
        </div>
        <div className="space-y-1">
          <Input autoComplete="family-name" value={form.last_name} onChange={e => updateForm('last_name', e.target.value)} placeholder="Nom *" className={cn(errors.last_name && 'border-destructive')} />
          {errors.last_name && <p className="text-xs text-destructive">{errors.last_name}</p>}
        </div>
      </div>

      <fieldset className="space-y-1">
        <Label>Téléphone <span className="text-destructive">*</span></Label>
        <PhoneInput
          countryCode={form.phone_country}
          phone={form.phone}
          onCountryChange={v => updateForm('phone_country', v)}
          onPhoneChange={v => updateForm('phone', v)}
          hasError={!!errors.phone}
        />
        {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
      </fieldset>

      <fieldset className="space-y-1">
        <Label>Email <span className="text-destructive">*</span></Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="email" autoComplete="email" value={form.email} onChange={e => updateForm('email', e.target.value)} placeholder="vous@email.com" className={cn('pl-9', errors.email && 'border-destructive')} />
        </div>
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </fieldset>

      {/* Guests recap — editable */}
      <div className="flex items-center justify-between rounded-lg border border-input bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-3.5 w-3.5" />
          <span>Invités</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateForm('guests_count', Math.max(16, (typeof form.guests_count === 'number' ? form.guests_count : 16) - 1))}>
            <Minus className="h-3 w-3" />
          </Button>
          <input
            type="number"
            inputMode="numeric"
            min={16}
            value={form.guests_count === '' ? '' : form.guests_count}
            onChange={e => {
              const raw = e.target.value
              if (raw === '') { updateForm('guests_count', ''); return }
              const n = parseInt(raw, 10)
              if (!isNaN(n)) updateForm('guests_count', Math.max(16, n))
            }}
            className="w-8 text-center text-sm font-semibold bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => updateForm('guests_count', (typeof form.guests_count === 'number' ? form.guests_count : 0) + 1)}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <input type="text" name="website_url" value={honeypot} onChange={e => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: '-9999px', opacity: 0, height: 0, width: 0 }} />
    </div>
  )
}

// ============================================
// Step 4 — Success
// ============================================
function Step4Success({ restaurant, accentColor }: { restaurant: RestaurantInfo; accentColor: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="h-16 w-16 rounded-full flex items-center justify-center mb-5 shadow-lg" style={{ backgroundColor: accentColor }}>
        <Check className="h-8 w-8 text-white" />
      </div>
      <h2 className="text-2xl font-bold mb-2">Merci pour votre demande !</h2>
      <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed text-sm">
        Votre demande a bien été prise en compte. L'équipe de <strong className="text-foreground">{restaurant.name}</strong> vous recontactera très prochainement pour finaliser votre événement.
      </p>
      {restaurant.logo_url && (
        <img src={restaurant.logo_url} alt={restaurant.name} className="h-14 w-14 rounded-full object-cover ring-4 ring-muted mb-4" />
      )}
      <p className="text-xs text-muted-foreground">En attendant, projetez-vous au coeur de votre événement.</p>
    </div>
  )
}
