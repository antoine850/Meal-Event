import { useState, useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Crown,
  Briefcase,
  UtensilsCrossed,
  Loader2,
  MailPlus,
  MoreHorizontal,
  RefreshCw,
  Send,
  Trash2,
  UserCog,
  Clock,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DataTablePagination } from '@/components/data-table'
import { ContentSection } from '../components/content-section'
import {
  useMembers,
  useOrgRoles,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
  useRevokeInvitation,
  useResendInvitation,
  type Member,
} from '../hooks/use-members'
import { useRestaurants } from '../hooks/use-settings'

const roleIcons: Record<string, typeof Crown> = {
  admin: Crown,
  commercial: Briefcase,
  gerant: UtensilsCrossed,
}

const roleColors: Record<string, string> = {
  admin: 'bg-amber-100 text-amber-800 border-amber-200',
  commercial: 'bg-blue-100 text-blue-800 border-blue-200',
  gerant: 'bg-green-100 text-green-800 border-green-200',
}

const inviteSchema = z.object({
  email: z.string().email('Email invalide'),
  role_id: z.string().min(1, 'Le rôle est requis'),
  restaurant_ids: z.array(z.string()),
})
type InviteFormData = z.infer<typeof inviteSchema>

export function MembersSettings() {
  const { data, isLoading } = useMembers()
  const { data: roles } = useOrgRoles()
  const { data: restaurants } = useRestaurants()
  const { mutate: inviteMember, isPending: isInviting } = useInviteMember()
  const { mutate: updateRole } = useUpdateMemberRole()
  const { mutate: removeMember } = useRemoveMember()
  const { mutate: revokeInvitation } = useRevokeInvitation()
  const { mutate: resendInvitation } = useResendInvitation()

  const [sorting, setSorting] = useState<SortingState>([])
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null)

  const members = data?.members?.filter(m => m.is_active) || []
  const invitations = data?.invitations || []

  const inviteForm = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role_id: '', restaurant_ids: [] },
  })

  const selectedInviteRoleSlug = roles?.find(r => r.id === inviteForm.watch('role_id'))?.slug

  const handleInvite = (values: InviteFormData) => {
    try {
      inviteMember(values, {
        onSuccess: () => {
          toast.success('Invitation envoyée')
          setInviteOpen(false)
          inviteForm.reset()
        },
        onError: (err: any) => {
          toast.error(err?.message || 'Erreur lors de l\'envoi de l\'invitation')
        },
      })
    } catch (err: any) {
      toast.error(err?.message || 'Erreur inattendue')
    }
  }

  const handleUpdateRole = (memberId: string, roleId: string, restaurantIds?: string[]) => {
    updateRole(
      { id: memberId, role_id: roleId, restaurant_ids: restaurantIds },
      {
        onSuccess: () => {
          toast.success('Rôle mis à jour')
          setEditMember(null)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const membersColumns = useMemo<ColumnDef<Member>[]>(() => [
    {
      id: 'member',
      header: 'Membre',
      cell: ({ row }) => {
        const member = row.original
        return (
          <div className='flex items-center gap-3'>
            <Avatar className='h-9 w-9'>
              <AvatarFallback className='text-xs'>
                {member.first_name?.[0]}{member.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className='font-medium text-sm'>
                {member.first_name} {member.last_name}
              </span>
              <p className='text-xs text-muted-foreground'>{member.email}</p>
            </div>
          </div>
        )
      },
    },
    {
      id: 'role',
      header: 'Rôle',
      cell: ({ row }) => {
        const roleSlug = row.original.role?.slug || 'member'
        const RoleIcon = roleIcons[roleSlug] || UserCog
        return (
          <Badge variant='outline' className={`text-xs ${roleColors[roleSlug] || ''}`}>
            <RoleIcon className='mr-1 h-3 w-3' />
            {row.original.role?.name || 'Membre'}
          </Badge>
        )
      },
    },
    {
      id: 'restaurants',
      header: 'Restaurants',
      cell: ({ row }) => {
        const memberRestaurantIds = row.original.user_restaurants?.map(ur => ur.restaurant_id) || []
        if (memberRestaurantIds.length === 0 || !restaurants) return <span className='text-muted-foreground text-sm'>Tous</span>
        return (
          <div className='flex flex-wrap gap-1'>
            {memberRestaurantIds.map(rid => {
              const rest = restaurants.find(r => r.id === rid)
              return rest ? (
                <Badge key={rid} variant='secondary' className='text-[10px] px-1.5 py-0'>
                  {rest.name}
                </Badge>
              ) : null
            })}
          </div>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const member = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => setEditMember(member)}>
                <UserCog className='mr-2 h-4 w-4' />
                Modifier le rôle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive'
                onClick={() => setDeleteConfirm({
                  id: member.id,
                  name: `${member.first_name} ${member.last_name || ''}`.trim(),
                })}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Retirer de l'organisation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
      meta: { className: 'w-[50px]' },
    },
  ], [restaurants])

  const membersTable = useReactTable({
    data: members,
    columns: membersColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-10'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <ContentSection
      title='Membres'
      desc='Gérez les membres de votre organisation et leurs rôles.'
    >
      {/* Header */}
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-base font-semibold'>Équipe ({members.length})</h3>
        <Button onClick={() => setInviteOpen(true)}>
          <MailPlus className='mr-2 h-4 w-4' />
          Inviter
        </Button>
      </div>

      {/* Members table */}
      <div className='flex flex-col gap-4'>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              {membersTable.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className={header.column.columnDef.meta?.className as string}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {membersTable.getRowModel().rows?.length ? (
                membersTable.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className={cell.column.columnDef.meta?.className as string}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={membersColumns.length} className='h-24 text-center text-muted-foreground'>
                    Aucun membre pour le moment
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={membersTable} />
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className='mt-6'>
          <h3 className='text-base font-semibold mb-3 flex items-center gap-2'>
            <Clock className='h-4 w-4' />
            Invitations en attente ({invitations.length})
          </h3>
          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Détails</TableHead>
                  <TableHead className='w-[80px]' />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className='font-medium text-sm'>{inv.email}</TableCell>
                    <TableCell>
                      <Badge variant='outline' className='text-xs'>
                        {inv.role?.name || 'Membre'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className='text-xs text-muted-foreground'>
                        Invité par {inv.invited_by_user ? `${inv.invited_by_user.first_name} ${inv.invited_by_user.last_name || ''}`.trim() : '—'}
                        {' · '}Expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='sm' className='h-8 w-8 p-0'>
                            <MoreHorizontal className='h-4 w-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() => resendInvitation(inv.id, {
                              onSuccess: () => toast.success('Invitation renvoyée'),
                              onError: (err: any) => toast.error(err.message),
                            })}
                          >
                            <RefreshCw className='mr-2 h-4 w-4' />
                            Renvoyer
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className='text-destructive'
                            onClick={() => setRevokeConfirm(inv.id)}
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Révoquer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { setInviteOpen(open); if (!open) inviteForm.reset() }}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle className='flex items-center gap-2'>
              <MailPlus className='h-5 w-5' /> Inviter un membre
            </DialogTitle>
            <DialogDescription>
              Envoyez une invitation par email pour rejoindre votre organisation.
            </DialogDescription>
          </DialogHeader>
          <Form {...inviteForm}>
            <form id='invite-form' onSubmit={inviteForm.handleSubmit(handleInvite)} className='space-y-4'>
              <FormField
                control={inviteForm.control}
                name='email'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type='email' placeholder='nom@exemple.com' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={inviteForm.control}
                name='role_id'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Sélectionner un rôle' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(roles || []).map(role => {
                          const Icon = roleIcons[role.slug] || UserCog
                          return (
                            <SelectItem key={role.id} value={role.id}>
                              <span className='flex items-center gap-2'>
                                <Icon className='h-4 w-4' />
                                {role.name}
                              </span>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {selectedInviteRoleSlug === 'admin' && "Accès complet à toute l'organisation"}
                      {selectedInviteRoleSlug === 'commercial' && 'Contacts, réservations et devis de ses restaurants'}
                      {selectedInviteRoleSlug === 'gerant' && 'Événements de son/ses restaurant(s) uniquement'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {(selectedInviteRoleSlug === 'commercial' || selectedInviteRoleSlug === 'gerant') && restaurants && restaurants.length > 0 && (
                <FormField
                  control={inviteForm.control}
                  name='restaurant_ids'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurants assignés</FormLabel>
                      <div className='space-y-2'>
                        {restaurants.map(rest => (
                          <label key={rest.id} className='flex items-center gap-2 cursor-pointer'>
                            <input
                              type='checkbox'
                              checked={field.value.includes(rest.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, rest.id])
                                } else {
                                  field.onChange(field.value.filter((id: string) => id !== rest.id))
                                }
                              }}
                              className='rounded border-gray-300'
                            />
                            <span className='text-sm'>{rest.name}</span>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </form>
          </Form>
          <DialogFooter className='gap-y-2'>
            <DialogClose asChild>
              <Button variant='outline'>Annuler</Button>
            </DialogClose>
            <Button type='submit' form='invite-form' disabled={isInviting}>
              {isInviting ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : <Send className='mr-2 h-4 w-4' />}
              Inviter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit role dialog */}
      {editMember && (
        <EditRoleDialog
          member={editMember}
          roles={roles || []}
          restaurants={restaurants || []}
          onClose={() => setEditMember(null)}
          onSave={handleUpdateRole}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
        title='Retirer un membre'
        desc={`Voulez-vous vraiment retirer ${deleteConfirm?.name} de l'organisation ? Cette action est irréversible.`}
        confirmText='Retirer'
        handleConfirm={() => {
          if (deleteConfirm) {
            removeMember(deleteConfirm.id, {
              onSuccess: () => {
                toast.success('Membre retiré')
                setDeleteConfirm(null)
              },
              onError: (err) => toast.error(err.message),
            })
          }
        }}
      />

      {/* Revoke invitation confirmation */}
      <ConfirmDialog
        open={!!revokeConfirm}
        onOpenChange={() => setRevokeConfirm(null)}
        title="Révoquer l'invitation"
        desc='Voulez-vous vraiment révoquer cette invitation ?'
        confirmText='Révoquer'
        handleConfirm={() => {
          if (revokeConfirm) {
            revokeInvitation(revokeConfirm, {
              onSuccess: () => {
                toast.success('Invitation révoquée')
                setRevokeConfirm(null)
              },
              onError: (err) => toast.error(err.message),
            })
          }
        }}
      />
    </ContentSection>
  )
}

// ═══════════════════════════════════════════════════════════════
// Edit Role Dialog
// ═══════════════════════════════════════════════════════════════
function EditRoleDialog({
  member,
  roles,
  restaurants,
  onClose,
  onSave,
}: {
  member: Member
  roles: { id: string; name: string; slug: string }[]
  restaurants: { id: string; name: string }[]
  onClose: () => void
  onSave: (memberId: string, roleId: string, restaurantIds?: string[]) => void
}) {
  const [roleId, setRoleId] = useState(member.role?.id || '')
  const [restaurantIds, setRestaurantIds] = useState<string[]>(
    member.user_restaurants?.map(ur => ur.restaurant_id) || []
  )

  const selectedRoleSlug = roles.find(r => r.id === roleId)?.slug

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Modifier le rôle</DialogTitle>
          <DialogDescription>
            {member.first_name} {member.last_name} — {member.email}
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4'>
          <div>
            <label className='text-sm font-medium'>Rôle</label>
            <Select value={roleId || undefined} onValueChange={setRoleId}>
              <SelectTrigger className='mt-1'>
                <SelectValue placeholder='Sélectionner un rôle' />
              </SelectTrigger>
              <SelectContent>
                {(roles || []).map(role => {
                  const Icon = roleIcons[role.slug] || UserCog
                  return (
                    <SelectItem key={role.id} value={role.id}>
                      <span className='flex items-center gap-2'>
                        <Icon className='h-4 w-4' />
                        {role.name}
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {(selectedRoleSlug === 'commercial' || selectedRoleSlug === 'gerant') && restaurants?.length > 0 && (
            <div>
              <label className='text-sm font-medium'>Restaurants assignés</label>
              <div className='space-y-2 mt-1'>
                {restaurants.map(rest => (
                  <label key={rest.id} className='flex items-center gap-2 cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={restaurantIds.includes(rest.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setRestaurantIds(prev => [...prev, rest.id])
                        } else {
                          setRestaurantIds(prev => prev.filter(id => id !== rest.id))
                        }
                      }}
                      className='rounded border-gray-300'
                    />
                    <span className='text-sm'>{rest.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' onClick={onClose}>Annuler</Button>
          <Button onClick={() => onSave(member.id, roleId, restaurantIds)}>
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
