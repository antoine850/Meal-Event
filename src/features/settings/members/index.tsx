import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/confirm-dialog'
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
  restaurant_ids: z.array(z.string()).default([]),
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
    inviteMember(values, {
      onSuccess: () => {
        toast.success('Invitation envoyée')
        setInviteOpen(false)
        inviteForm.reset()
      },
      onError: (err) => {
        toast.error(err.message)
      },
    })
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
      {/* Members list */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <div>
            <CardTitle>Équipe ({members.length})</CardTitle>
            <CardDescription>
              Membres actifs de votre organisation
            </CardDescription>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <MailPlus className='mr-2 h-4 w-4' />
            Inviter
          </Button>
        </CardHeader>
        <CardContent className='space-y-2'>
          {members.map((member) => {
            const roleSlug = member.role?.slug || 'member'
            const RoleIcon = roleIcons[roleSlug] || UserCog
            const memberRestaurantIds = member.user_restaurants?.map(ur => ur.restaurant_id) || []

            return (
              <div
                key={member.id}
                className='flex items-center justify-between rounded-lg border p-3'
              >
                <div className='flex items-center gap-3'>
                  <Avatar className='h-9 w-9'>
                    <AvatarFallback className='text-xs'>
                      {member.first_name?.[0]}{member.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium text-sm'>
                        {member.first_name} {member.last_name}
                      </span>
                      <Badge
                        variant='outline'
                        className={`text-xs ${roleColors[roleSlug] || ''}`}
                      >
                        <RoleIcon className='mr-1 h-3 w-3' />
                        {member.role?.name || 'Membre'}
                      </Badge>
                    </div>
                    <p className='text-xs text-muted-foreground'>{member.email}</p>
                    {memberRestaurantIds.length > 0 && restaurants && (
                      <div className='flex gap-1 mt-1'>
                        {memberRestaurantIds.map(rid => {
                          const rest = restaurants.find(r => r.id === rid)
                          return rest ? (
                            <Badge key={rid} variant='secondary' className='text-[10px] px-1.5 py-0'>
                              {rest.name}
                            </Badge>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant='ghost' size='icon' className='h-8 w-8'>
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
              </div>
            )
          })}

          {members.length === 0 && (
            <p className='text-center text-sm text-muted-foreground py-6'>
              Aucun membre pour le moment
            </p>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <Card className='mt-4'>
          <CardHeader>
            <CardTitle className='text-base'>
              <Clock className='inline mr-2 h-4 w-4' />
              Invitations en attente ({invitations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-2'>
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className='flex items-center justify-between rounded-lg border border-dashed p-3'
              >
                <div>
                  <div className='flex items-center gap-2'>
                    <span className='text-sm font-medium'>{inv.email}</span>
                    <Badge variant='outline' className='text-xs'>
                      {inv.role?.name || 'Membre'}
                    </Badge>
                  </div>
                  <p className='text-xs text-muted-foreground'>
                    Invité par {inv.invited_by_user ? `${inv.invited_by_user.first_name} ${inv.invited_by_user.last_name || ''}`.trim() : '—'}
                    {' · '}Expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className='flex gap-1'>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8'
                    title='Renvoyer'
                    onClick={() => resendInvitation(inv.id, {
                      onSuccess: () => toast.success('Invitation renvoyée'),
                      onError: (err) => toast.error(err.message),
                    })}
                  >
                    <RefreshCw className='h-4 w-4' />
                  </Button>
                  <Button
                    variant='ghost'
                    size='icon'
                    className='h-8 w-8 text-destructive'
                    title='Révoquer'
                    onClick={() => setRevokeConfirm(inv.id)}
                  >
                    <Trash2 className='h-4 w-4' />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Sélectionner un rôle' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map(role => {
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
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger className='mt-1'>
                <SelectValue placeholder='Sélectionner un rôle' />
              </SelectTrigger>
              <SelectContent>
                {roles.map(role => {
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

          {(selectedRoleSlug === 'commercial' || selectedRoleSlug === 'gerant') && restaurants.length > 0 && (
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
