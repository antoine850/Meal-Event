import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  useDeleteEmailTemplate,
  useEmailTemplates,
  useReorderEmailTemplate,
  useUpdateEmailTemplate,
} from '@/features/reservations/hooks/use-email-templates'
import {
  hasEnVersion,
  type EmailTemplate,
} from '@/features/reservations/lib/email-templates'
import { useRestaurants } from '../hooks/use-settings'

export function EmailTemplatesSettings() {
  const { data: templates = [], isLoading } = useEmailTemplates()
  const { data: restaurants = [] } = useRestaurants()
  const { mutate: updateTemplate } = useUpdateEmailTemplate()
  // isReordering désactive les flèches : deux swaps calculés sur un cache périmé
  // peuvent créer des sort_order égaux (paire coincée). Le hook reste pending
  // jusqu'à l'invalidation (onSuccess retourne la promesse).
  const { mutate: reorder, isPending: isReordering } = useReorderEmailTemplate()
  const { mutate: deleteTemplate, isPending: isDeleting } =
    useDeleteEmailTemplate()
  const navigate = useNavigate()
  const [toDelete, setToDelete] = useState<EmailTemplate | null>(null)

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-10'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  const restaurantName = (id: string) =>
    restaurants.find((r) => r.id === id)?.name || '?'

  const handleToggleActive = (tpl: EmailTemplate, next: boolean) => {
    updateTemplate(
      { id: tpl.id, is_active: next },
      {
        onSuccess: () => {
          toast.success(next ? 'Modèle activé' : 'Modèle désactivé')
        },
        onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
      }
    )
  }

  const handleDelete = () => {
    if (!toDelete) return
    deleteTemplate(toDelete.id, {
      onSuccess: () => {
        toast.success('Modèle supprimé')
        setToDelete(null)
      },
      onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
    })
  }

  return (
    <div className='flex w-full flex-1 flex-col'>
      <div className='mb-6 flex items-start justify-between gap-4'>
        <p className='text-sm text-muted-foreground'>
          Personnalise les modèles d'emails utilisés depuis l'écran des
          événements. Les variables{' '}
          <code className='rounded bg-muted px-1 text-xs'>{'{{var}}'}</code>{' '}
          sont remplacées automatiquement par les infos de la réservation.
        </p>
        <Button asChild>
          <Link to='/settings/email/$id' params={{ id: 'new' }}>
            <Plus className='mr-2 h-4 w-4' />
            Nouveau modèle
          </Link>
        </Button>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modèle</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead>Restaurants</TableHead>
              <TableHead className='w-[80px] text-center'>Actif</TableHead>
              <TableHead className='w-[130px]'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className='py-8 text-center text-muted-foreground'
                >
                  Aucun modèle. Crée le premier avec "Nouveau modèle".
                </TableCell>
              </TableRow>
            ) : (
              templates.map((tpl, idx) => (
                <TableRow
                  key={tpl.id}
                  className={`cursor-pointer ${tpl.is_active ? '' : 'opacity-60'}`}
                  onClick={() =>
                    navigate({
                      to: '/settings/email/$id',
                      params: { id: tpl.id },
                    })
                  }
                >
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      <Link
                        to='/settings/email/$id'
                        params={{ id: tpl.id }}
                        className='font-medium hover:underline'
                        onClick={(e) => e.stopPropagation()}
                      >
                        {tpl.name}
                      </Link>
                      <Badge variant='outline' className='text-xs'>
                        FR
                      </Badge>
                      {hasEnVersion(tpl) && (
                        <Badge variant='outline' className='text-xs'>
                          EN
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='max-w-md truncate text-sm text-muted-foreground'>
                    {tpl.subject_fr}
                  </TableCell>
                  <TableCell>
                    {tpl.restaurant_ids.length === 0 ? (
                      <span className='text-sm text-muted-foreground'>
                        Tous
                      </span>
                    ) : (
                      <div className='flex flex-wrap gap-1'>
                        {tpl.restaurant_ids.map((rid) => (
                          <Badge
                            key={rid}
                            variant='secondary'
                            className='text-xs'
                          >
                            {restaurantName(rid)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell
                    className='text-center'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={tpl.is_active}
                      onCheckedChange={(v) => handleToggleActive(tpl, v)}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className='flex items-center justify-end gap-1'>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8'
                        disabled={idx === 0 || isReordering}
                        onClick={() =>
                          reorder(
                            { a: tpl, b: templates[idx - 1] },
                            {
                              onError: (e) =>
                                toast.error(`Erreur : ${(e as Error).message}`),
                            }
                          )
                        }
                        aria-label='Monter'
                      >
                        <ArrowUp className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8'
                        disabled={idx === templates.length - 1 || isReordering}
                        onClick={() =>
                          reorder(
                            { a: tpl, b: templates[idx + 1] },
                            {
                              onError: (e) =>
                                toast.error(`Erreur : ${(e as Error).message}`),
                            }
                          )
                        }
                        aria-label='Descendre'
                      >
                        <ArrowDown className='h-4 w-4' />
                      </Button>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8 text-destructive'
                        onClick={() => setToDelete(tpl)}
                        aria-label='Supprimer'
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title='Supprimer ce modèle ?'
        desc={`Le modèle "${toDelete?.name}" sera définitivement supprimé.`}
        cancelBtnText='Annuler'
        confirmText='Supprimer'
        destructive
        isLoading={isDeleting}
        handleConfirm={handleDelete}
      />
    </div>
  )
}
