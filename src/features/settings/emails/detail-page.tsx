import { useState } from 'react'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ConfigDrawer } from '@/components/config-drawer'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import {
  useCreateEmailTemplate,
  useDeleteEmailTemplate,
  useEmailTemplates,
  useUpdateEmailTemplate,
} from '@/features/reservations/hooks/use-email-templates'
import {
  AVAILABLE_VARS,
  hasEnVersion,
} from '@/features/reservations/lib/email-templates'
import { useRestaurants } from '../hooks/use-settings'

// Sujet + corps + palette de variables, réutilisé par les onglets FR et EN
function LangFields({
  lang,
  subject,
  body,
  onSubjectChange,
  onBodyChange,
}: {
  lang: 'fr' | 'en'
  subject: string
  body: string
  onSubjectChange: (v: string) => void
  onBodyChange: (v: string) => void
}) {
  return (
    <div className='space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor={`subject-${lang}`}>Sujet</Label>
        <Input
          id={`subject-${lang}`}
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder='{{restaurant}} — votre événement du {{date_evenement}}'
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor={`body-${lang}`}>Corps</Label>
        <Textarea
          id={`body-${lang}`}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
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
    </div>
  )
}

export function EmailTemplateDetailPage() {
  const { id } = useParams({ from: '/_authenticated/settings/email/$id' })
  const isNew = id === 'new'
  const navigate = useNavigate()
  const { data: templates = [], isLoading } = useEmailTemplates()
  const { data: restaurants = [] } = useRestaurants()
  const { mutate: createTemplate, isPending: isCreating } =
    useCreateEmailTemplate()
  const { mutate: updateTemplate, isPending: isUpdating } =
    useUpdateEmailTemplate()
  const { mutate: deleteTemplate, isPending: isDeleting } =
    useDeleteEmailTemplate()

  const template = templates.find((t) => t.id === id)

  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [restaurantIds, setRestaurantIds] = useState<string[]>([])
  const [subjectFr, setSubjectFr] = useState('')
  const [bodyFr, setBodyFr] = useState('')
  const [hasEn, setHasEn] = useState(false)
  const [subjectEn, setSubjectEn] = useState('')
  const [bodyEn, setBodyEn] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Sync une seule fois par id : un refetch (refocus, réordonnancement par un
  // collègue) ne doit pas écraser une saisie en cours. Ajustement pendant le
  // render (pas d'effect) pour suivre le pattern React recommandé.
  const [loadedId, setLoadedId] = useState<string | null>(null)
  if (template && loadedId !== template.id) {
    setLoadedId(template.id)
    setName(template.name)
    setIsActive(template.is_active)
    setRestaurantIds(template.restaurant_ids)
    setSubjectFr(template.subject_fr)
    setBodyFr(template.body_fr)
    setHasEn(hasEnVersion(template))
    setSubjectEn(template.subject_en || '')
    setBodyEn(template.body_en || '')
  }

  const toggleRestaurant = (rid: string) =>
    setRestaurantIds((prev) =>
      prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]
    )

  const isPending = isCreating || isUpdating

  const handleSave = () => {
    if (!name.trim() || !subjectFr.trim() || !bodyFr.trim()) {
      toast.error('Nom, sujet et corps français sont requis')
      return
    }
    if (hasEn && (!subjectEn.trim() || !bodyEn.trim())) {
      toast.error(
        'Version anglaise incomplète : sujet et corps requis, ou supprime-la'
      )
      return
    }
    const payload = {
      name: name.trim(),
      is_active: isActive,
      subject_fr: subjectFr.trim(),
      body_fr: bodyFr,
      subject_en: hasEn ? subjectEn.trim() : null,
      body_en: hasEn ? bodyEn : null,
      restaurant_ids: restaurantIds,
    }
    const opts = {
      onSuccess: () => {
        toast.success(isNew ? 'Modèle créé' : 'Modèle mis à jour')
        navigate({ to: '/settings/emails' })
      },
      onError: (e: Error) => toast.error(`Erreur : ${e.message}`),
    }
    if (isNew) createTemplate(payload, opts)
    else updateTemplate({ id, ...payload }, opts)
  }

  const handleDelete = () => {
    deleteTemplate(id, {
      onSuccess: () => {
        toast.success('Modèle supprimé')
        navigate({ to: '/settings/emails' })
      },
      onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
    })
  }

  if (!isNew && isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  if (!isNew && !template) {
    return (
      <>
        <Header>
          <h1 className='text-2xl font-bold tracking-tight'>
            Modèle non trouvé
          </h1>
        </Header>
        <Main className='flex flex-1 flex-col items-center justify-center'>
          <p className='text-muted-foreground'>
            Ce modèle n'existe pas ou a été supprimé.
          </p>
        </Main>
      </>
    )
  }

  return (
    <>
      <Header fixed>
        <div className='flex items-center gap-4'>
          <Button variant='ghost' size='icon' asChild className='-ml-2'>
            <Link to='/settings/emails'>
              <ArrowLeft className='h-4 w-4' />
            </Link>
          </Button>
          <h1 className='text-lg font-semibold'>
            {isNew ? 'Nouveau modèle' : template?.name}
          </h1>
        </div>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>

      <Main className='flex flex-1 flex-col'>
        <div className='mx-auto w-full max-w-3xl space-y-6'>
          <div className='space-y-2'>
            <Label htmlFor='tpl-name'>
              Nom du modèle (visible dans le menu)
            </Label>
            <Input
              id='tpl-name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='Envoi plaquette'
            />
          </div>

          <div>
            <Label className='mb-2 block'>Restaurants</Label>
            <p className='mb-2 text-xs text-muted-foreground'>
              {restaurantIds.length === 0
                ? 'Aucune sélection : le modèle est visible pour tous les restaurants.'
                : 'Le modèle ne sera proposé que pour les restaurants sélectionnés.'}
            </p>
            <div className='flex flex-wrap gap-2'>
              {restaurants.map((r) => (
                <button
                  key={r.id}
                  type='button'
                  onClick={() => toggleRestaurant(r.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    restaurantIds.includes(r.id)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-input bg-background hover:bg-muted'
                  }`}
                >
                  {r.color && (
                    <div
                      className='h-2 w-2 rounded-full'
                      style={{ backgroundColor: r.color }}
                    />
                  )}
                  {r.name}
                </button>
              ))}
              {restaurants.length === 0 && (
                <p className='text-xs text-muted-foreground'>
                  Aucun restaurant
                </p>
              )}
            </div>
          </div>

          <Tabs defaultValue='fr'>
            <TabsList>
              <TabsTrigger value='fr'>Français</TabsTrigger>
              <TabsTrigger value='en'>
                English
                {!hasEn && (
                  <Badge variant='outline' className='ml-2 text-xs'>
                    vide
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value='fr' className='pt-4'>
              <LangFields
                lang='fr'
                subject={subjectFr}
                body={bodyFr}
                onSubjectChange={setSubjectFr}
                onBodyChange={setBodyFr}
              />
            </TabsContent>
            <TabsContent value='en' className='pt-4'>
              {hasEn ? (
                <div className='space-y-4'>
                  <LangFields
                    lang='en'
                    subject={subjectEn}
                    body={bodyEn}
                    onSubjectChange={setSubjectEn}
                    onBodyChange={setBodyEn}
                  />
                  <Button
                    variant='ghost'
                    size='sm'
                    className='text-destructive'
                    onClick={() => {
                      setHasEn(false)
                      setSubjectEn('')
                      setBodyEn('')
                    }}
                  >
                    <Trash2 className='mr-2 h-4 w-4' />
                    Supprimer la version anglaise
                  </Button>
                </div>
              ) : (
                <div className='flex flex-col items-center gap-3 rounded-lg border border-dashed py-10'>
                  <p className='text-sm text-muted-foreground'>
                    Pas de version anglaise : la langue n'apparaît pas dans le
                    menu d'envoi.
                  </p>
                  <Button variant='outline' onClick={() => setHasEn(true)}>
                    <Plus className='mr-2 h-4 w-4' />
                    Créer la version anglaise
                  </Button>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div>
              <Label htmlFor='tpl-active' className='cursor-pointer'>
                Modèle actif
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

          <div className='flex items-center justify-between border-t pt-4'>
            {!isNew ? (
              <Button
                variant='ghost'
                className='text-destructive'
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Supprimer
              </Button>
            ) : (
              <span />
            )}
            <div className='flex gap-2'>
              <Button variant='outline' asChild>
                <Link to='/settings/emails'>Annuler</Link>
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      </Main>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title='Supprimer ce modèle ?'
        desc={`Le modèle "${template?.name}" sera définitivement supprimé.`}
        cancelBtnText='Annuler'
        confirmText='Supprimer'
        destructive
        isLoading={isDeleting}
        handleConfirm={handleDelete}
      />
    </>
  )
}
