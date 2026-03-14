import { useState } from 'react'
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
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  useMembers,
  useOrgRoles,
  useInviteMember,
  useUpdateMemberRole,
  useRemoveMember,
  useRevokeInvitation,
  useResendInvitation,
  type Member,
  type MemberRole,
} from '../hooks/use-members'
import { useRestaurants, type Restaurant } from '../hooks/use-settings'

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

export function MembersSettings() {
  const { data, isLoading } = useMembers()
  const { data: roles = [] } = useOrgRoles()
  const { data: restaurants = [] } = useRestaurants()
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

  const handleDelete = (id: string, name: string) => {
    setDeleteConfirm({ id, name })
  }

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      removeMember(deleteConfirm.id, {
        onSuccess: () => {
          toast.success('Membre retiré')
          setDeleteConfirm(null)
        },
        onError: (err) => toast.error(err.message),
      })
    }
  }

  const handleRevokeConfirm = () => {
    if (revokeConfirm) {
      revokeInvitation(revokeConfirm, {
        onSuccess: () => {
          toast.success('Invitation révoquée')
          setRevokeConfirm(null)
        },
        onError: (err) => toast.error(err.message),
      })
    }
  }

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-10'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <div className='flex flex-1 flex-col w-full'>
      {/* Page header */}
      <div className='flex-none'>
        <h3 className='text-lg font-medium'>Membres</h3>
        <p className='text-sm text-muted-foreground'>Gérez les membres de votre organisation et leurs rôles.</p>
      </div>
      <Separator className='my-4 flex-none' />

      {/* Toolbar */}
      <div className='flex items-center justify-between mb-4'>
        <h3 className='text-base font-semibold'>Équipe ({members.length})</h3>
        <Button onClick={() => setInviteOpen(true)}>
          <MailPlus className='mr-2 h-4 w-4' />
          Inviter
        </Button>
      </div>

      {/* Members table — simple pattern like restaurants page */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead className='hidden md:table-cell'>Restaurants</TableHead>
              <TableHead className='w-[50px]' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className='text-center text-muted-foreground py-8'>
                  Aucun membre pour le moment
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => {
                const roleSlug = member.role?.slug || 'member'
                const RoleIcon = roleIcons[roleSlug] || UserCog
                const memberRestaurantIds = member.user_restaurants?.map(ur => ur.restaurant_id) || []
                return (
                  <TableRow key={member.id}>
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline' className={`text-xs ${roleColors[roleSlug] || ''}`}>
                        <RoleIcon className='mr-1 h-3 w-3' />
                        {member.role?.name || 'Membre'}
                      </Badge>
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
                      {memberRestaurantIds.length === 0 ? (
                        <span className='text-muted-foreground text-sm'>Tous</span>
                      ) : (
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
                      )}
                    </TableCell>
                    <TableCell>
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
                            onClick={() => handleDelete(member.id, `${member.first_name} ${member.last_name || ''}`.trim())}
                          >
                            <Trash2 className='mr-2 h-4 w-4' />
                            Retirer de l'organisation
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div className='mt-6'>
          <h3 className='text-base font-semibold mb-3 flex items-center gap-2'>
            <Clock className='h-4 w-4' />
            Invitations en attente ({invitations.length})
          </h3>
          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead className='hidden sm:table-cell'>Détails</TableHead>
                  <TableHead className='w-[50px]' />
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
                    <TableCell className='hidden sm:table-cell'>
                      <span className='text-xs text-muted-foreground'>
                        Invité par {inv.invited_by_user ? `${inv.invited_by_user.first_name} ${inv.invited_by_user.last_name || ''}`.trim() : '—'}
                        {' · '}Expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant='ghost' size='icon' className='h-8 w-8'>
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
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roles={roles}
        restaurants={restaurants}
      />

      {/* Edit role dialog */}
      {editMember && (
        <EditRoleDialog
          member={editMember}
          roles={roles}
          restaurants={restaurants}
          onClose={() => setEditMember(null)}
          onSave={handleUpdateRole}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer un membre</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment retirer {deleteConfirm?.name} de l'organisation ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
              Retirer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeConfirm} onOpenChange={() => setRevokeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Révoquer l'invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Voulez-vous vraiment révoquer cette invitation ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevokeConfirm} className='bg-destructive text-destructive-foreground hover:bg-destructive/90'>
              Révoquer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Invite Dialog
// ═══════════════════════════════════════════════════════════════
function InviteDialog({
  open,
  onOpenChange,
  roles,
  restaurants,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roles: MemberRole[]
  restaurants: Restaurant[]
}) {
  const { mutate: inviteMember, isPending: isInviting } = useInviteMember()

  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [restaurantIds, setRestaurantIds] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})

  const selectedRoleSlug = roles.find(r => r.id === roleId)?.slug

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setEmail('')
      setRoleId('')
      setRestaurantIds([])
      setErrors({})
    }
    onOpenChange(isOpen)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Email invalide'
    }
    if (!roleId) {
      newErrors.role_id = 'Le rôle est requis'
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})

    inviteMember(
      { email, role_id: roleId, restaurant_ids: restaurantIds },
      {
        onSuccess: () => {
          toast.success('Invitation envoyée')
          handleClose(false)
        },
        onError: (err: any) => {
          toast.error(err?.message || "Erreur lors de l'envoi de l'invitation")
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <MailPlus className='h-5 w-5' /> Inviter un membre
          </DialogTitle>
          <DialogDescription>
            Envoyez une invitation par email pour rejoindre votre organisation.
          </DialogDescription>
        </DialogHeader>
        <form id='invite-form' onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Email</label>
            <Input
              type='email'
              placeholder='nom@exemple.com'
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors(prev => ({ ...prev, email: '' })) }}
            />
            {errors.email && <p className='text-sm text-destructive'>{errors.email}</p>}
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>Rôle</label>
            <Select
              value={roleId || undefined}
              onValueChange={(v) => { setRoleId(v); setErrors(prev => ({ ...prev, role_id: '' })) }}
            >
              <SelectTrigger>
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
            <p className='text-sm text-muted-foreground'>
              {selectedRoleSlug === 'admin' && "Accès complet à toute l'organisation"}
              {selectedRoleSlug === 'commercial' && 'Contacts, réservations et devis de ses restaurants'}
              {selectedRoleSlug === 'gerant' && 'Événements de son/ses restaurant(s) uniquement'}
            </p>
            {errors.role_id && <p className='text-sm text-destructive'>{errors.role_id}</p>}
          </div>

          {(selectedRoleSlug === 'commercial' || selectedRoleSlug === 'gerant') && restaurants.length > 0 && (
            <div className='space-y-2'>
              <label className='text-sm font-medium'>Restaurants assignés</label>
              <div className='space-y-2'>
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
        </form>
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
  roles: MemberRole[]
  restaurants: Restaurant[]
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
