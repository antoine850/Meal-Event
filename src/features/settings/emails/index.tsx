import { useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
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
import {
  useEmailTemplates,
  useUpdateEmailTemplate,
} from '@/features/reservations/hooks/use-email-templates'
import type { EmailTemplate } from '@/features/reservations/lib/email-templates'
import { EmailTemplateDialog } from './email-template-dialog'

export function EmailTemplatesSettings() {
  const { data: templates = [], isLoading } = useEmailTemplates()
  const { mutate: updateTemplate } = useUpdateEmailTemplate()
  const [editing, setEditing] = useState<EmailTemplate | null>(null)
  const [open, setOpen] = useState(false)

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-10'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  const handleEdit = (tpl: EmailTemplate) => {
    setEditing(tpl)
    setOpen(true)
  }

  const handleToggleActive = (tpl: EmailTemplate, next: boolean) => {
    updateTemplate(
      { id: tpl.id, is_active: next },
      {
        onSuccess: () => {
          toast.success(next ? 'Template activé' : 'Template désactivé')
        },
        onError: (e) => toast.error(`Erreur : ${(e as Error).message}`),
      }
    )
  }

  // Regrouper par slug pour afficher FR/EN côte à côte
  const grouped = templates.reduce<Record<string, EmailTemplate[]>>(
    (acc, t) => {
      acc[t.slug] = acc[t.slug] || []
      acc[t.slug].push(t)
      return acc
    },
    {}
  )

  const sortedSlugs = Object.entries(grouped)
    .map(([slug, list]) => ({
      slug,
      sort_order: Math.min(...list.map((t) => t.sort_order)),
      list: list.sort((a, b) => a.lang.localeCompare(b.lang)),
    }))
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className='flex w-full flex-1 flex-col'>
      <div className='mb-6'>
        <p className='text-sm text-muted-foreground'>
          Personnalise les modèles d'emails utilisés depuis l'écran des
          événements. Les variables{' '}
          <code className='rounded bg-muted px-1 text-xs'>{'{{var}}'}</code>{' '}
          sont remplacées automatiquement par les infos de la réservation.
        </p>
      </div>

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Sujet</TableHead>
              <TableHead className='w-[100px] text-center'>Actif</TableHead>
              <TableHead className='w-[80px]'></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedSlugs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className='py-8 text-center text-muted-foreground'
                >
                  Aucun template. La migration n'a peut-être pas été appliquée.
                </TableCell>
              </TableRow>
            ) : (
              sortedSlugs.flatMap(({ slug, list }) =>
                list.map((tpl, idx) => (
                  <TableRow key={tpl.id}>
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        {idx === 0 ? (
                          <span className='font-medium'>{tpl.label}</span>
                        ) : (
                          <span className='text-muted-foreground'>
                            {tpl.label}
                          </span>
                        )}
                        <Badge variant='outline' className='text-xs'>
                          {tpl.lang.toUpperCase()}
                        </Badge>
                        {idx === 0 && (
                          <Badge variant='secondary' className='font-mono text-xs'>
                            {slug}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className='max-w-md truncate text-sm text-muted-foreground'>
                      {tpl.subject}
                    </TableCell>
                    <TableCell className='text-center'>
                      <Switch
                        checked={tpl.is_active}
                        onCheckedChange={(v) => handleToggleActive(tpl, v)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='h-8 w-8'
                        onClick={() => handleEdit(tpl)}
                        aria-label='Modifier'
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )
            )}
          </TableBody>
        </Table>
      </div>

      <EmailTemplateDialog
        open={open}
        onOpenChange={setOpen}
        template={editing}
      />
    </div>
  )
}
