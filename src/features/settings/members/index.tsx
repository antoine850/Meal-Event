import { useState, useMemo } from 'react'
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
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
} from 'lucide-react'
import { Cross2Icon as RadixCross2Icon } from '@radix-ui/react-icons'
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
import { DataTablePagination, FacetedFilter } from '@/components/data-table'
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

// Unified row type for members + invitations
type MemberRow = {
  id: string
  email: string
  name: string
  firstName: string
  lastName: string | null
  roleId: string | null
  roleName: string | null
  roleSlug: string | null
  restaurantIds: string[]
  status: 'active' | 'pending'
  createdAt: string
  expiresAt?: string
  invitedByName?: string
  raw: Member | null
  rawInvitationId?: string
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
  const [searchValue, setSearchValue] = useState('')
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set())
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set())
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(new Set())
  const [sorting, setSorting] = useState<SortingState>([])

  // Combine members + invitations into unified rows
  const allRows = useMemo<MemberRow[]>(() => {
    const memberRows: MemberRow[] = (data?.members?.filter(m => m.is_active) || []).map(m => ({
      id: m.id,
      email: m.email,
      name: `${m.first_name} ${m.last_name || ''}`.trim(),
      firstName: m.first_name,
      lastName: m.last_name,
      roleId: m.role?.id || null,
      roleName: m.role?.name || null,
      roleSlug: m.role?.slug || null,
      restaurantIds: m.user_restaurants?.map(ur => ur.restaurant_id) || [],
      status: 'active' as const,
      createdAt: m.created_at,
      raw: m,
    }))

    const invitationRows: MemberRow[] = (data?.invitations || []).map(inv => ({
      id: `inv-${inv.id}`,
      email: inv.email,
      name: inv.email,
      firstName: inv.email,
      lastName: null,
      roleId: inv.role?.id || null,
      roleName: inv.role?.name || null,
      roleSlug: inv.role?.slug || null,
      restaurantIds: inv.restaurant_ids || [],
      status: 'pending' as const,
      createdAt: inv.created_at,
      expiresAt: inv.expires_at,
      invitedByName: inv.invited_by_user
        ? `${inv.invited_by_user.first_name} ${inv.invited_by_user.last_name || ''}`.trim()
        : undefined,
      raw: null,
      rawInvitationId: inv.id,
    }))

    return [...memberRows, ...invitationRows]
  }, [data])

  // Filter rows
  const filteredRows = useMemo(() => {
    let result = allRows

    if (searchValue) {
      const q = searchValue.toLowerCase()
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q)
      )
    }

    if (selectedRoles.size > 0) {
      result = result.filter(r => r.roleSlug && selectedRoles.has(r.roleSlug))
    }

    if (selectedRestaurants.size > 0) {
      result = result.filter(r => r.restaurantIds.some(id => selectedRestaurants.has(id)))
    }

    if (selectedStatuses.size > 0) {
      result = result.filter(r => selectedStatuses.has(r.status))
    }

    return result
  }, [allRows, searchValue, selectedRoles, selectedRestaurants, selectedStatuses])

  const hasActiveFilters = !!(searchValue || selectedRoles.size || selectedRestaurants.size || selectedStatuses.size)

  const handleResetFilters = () => {
    setSearchValue('')
    setSelectedRoles(new Set())
    setSelectedRestaurants(new Set())
    setSelectedStatuses(new Set())
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

  const columns: ColumnDef<MemberRow>[] = [
    {
      accessorKey: 'name',
      header: 'Membre',
      cell: ({ row }) => {
        const r = row.original
        if (r.status === 'pending') {
          return (
            <div className='flex items-center gap-3'>
              <Avatar className='h-9 w-9'>
                <AvatarFallback className='text-xs bg-muted'>
                  <MailPlus className='h-4 w-4 text-muted-foreground' />
                </AvatarFallback>
              </Avatar>
              <div>
                <span className='font-medium text-sm'>{r.email}</span>
                {r.invitedByName && (
                  <p className='text-xs text-muted-foreground'>Invité par {r.invitedByName}</p>
                )}
              </div>
            </div>
          )
        }
        return (
          <div className='flex items-center gap-3'>
            <Avatar className='h-9 w-9'>
              <AvatarFallback className='text-xs'>
                {r.firstName?.[0]}{r.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <span className='font-medium text-sm'>{r.name}</span>
              <p className='text-xs text-muted-foreground'>{r.email}</p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'roleSlug',
      header: 'Rôle',
      cell: ({ row }) => {
        const r = row.original
        if (!r.roleName) return <span className='text-muted-foreground text-sm'>—</span>
        const slug = r.roleSlug || ''
        const RoleIcon = roleIcons[slug] || UserCog
        return (
          <Badge variant='outline' className={`text-xs ${roleColors[slug] || ''}`}>
            <RoleIcon className='mr-1 h-3 w-3' />
            {r.roleName}
          </Badge>
        )
      },
    },
    {
      id: 'restaurants',
      header: 'Restaurants',
      cell: ({ row }) => {
        const r = row.original
        if (r.restaurantIds.length === 0) {
          return <span className='text-muted-foreground text-sm'>Tous</span>
        }
        return (
          <div className='flex flex-wrap gap-1'>
            {r.restaurantIds.map(rid => {
              const rest = restaurants.find(rt => rt.id === rid)
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
      accessorKey: 'status',
      header: 'Statut',
      cell: ({ row }) => {
        const r = row.original
        if (r.status === 'pending') {
          return (
            <Badge variant='outline' className='text-xs bg-orange-50 text-orange-700 border-orange-200'>
              En attente
            </Badge>
          )
        }
        return (
          <Badge variant='outline' className='text-xs bg-emerald-50 text-emerald-700 border-emerald-200'>
            Actif
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const r = row.original
        if (r.status === 'pending') {
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='h-8 w-8'>
                  <MoreHorizontal className='h-4 w-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem
                  onClick={() => resendInvitation(r.rawInvitationId!, {
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
                  onClick={() => setRevokeConfirm(r.rawInvitationId!)}
                >
                  <Trash2 className='mr-2 h-4 w-4' />
                  Révoquer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant='ghost' size='icon' className='h-8 w-8'>
                <MoreHorizontal className='h-4 w-4' />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end'>
              <DropdownMenuItem onClick={() => setEditMember(r.raw!)}>
                <UserCog className='mr-2 h-4 w-4' />
                Modifier le rôle
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className='text-destructive'
                onClick={() => setDeleteConfirm({ id: r.id, name: r.name })}
              >
                <Trash2 className='mr-2 h-4 w-4' />
                Retirer de l'organisation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  const roleOptions = useMemo(() =>
    roles.map(r => ({ label: r.name, value: r.slug })),
    [roles]
  )

  const restaurantOptions = useMemo(() =>
    restaurants.map(r => ({ label: r.name, value: r.id })),
    [restaurants]
  )

  const statusOptions = [
    { label: 'Actif', value: 'active' },
    { label: 'En attente', value: 'pending' },
  ]

  if (isLoading) {
    return (
      <div className='flex items-center justify-center py-10'>
        <Loader2 className='h-8 w-8 animate-spin text-muted-foreground' />
      </div>
    )
  }

  return (
    <div className='flex flex-1 flex-col w-full'>
      <div className='flex-none'>
        <h3 className='text-lg font-medium'>Membres</h3>
        <p className='text-sm text-muted-foreground'>Gérez les membres de votre organisation et leurs rôles.</p>
      </div>
      <Separator className='my-4 flex-none' />

      {/* Toolbar */}
      <div className='flex flex-wrap items-center gap-2 mb-4'>
        <Input
          placeholder='Rechercher par nom ou email...'
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className='h-8 w-full sm:w-[200px] lg:w-[250px]'
        />
        <div className='flex flex-wrap gap-2'>
          <FacetedFilter
            title='Rôle'
            options={roleOptions}
            selected={selectedRoles}
            onSelectionChange={setSelectedRoles}
          />
          <FacetedFilter
            title='Restaurant'
            options={restaurantOptions}
            selected={selectedRestaurants}
            onSelectionChange={setSelectedRestaurants}
          />
          <FacetedFilter
            title='Statut'
            options={statusOptions}
            selected={selectedStatuses}
            onSelectionChange={setSelectedStatuses}
          />
        </div>
        {hasActiveFilters && (
          <Button variant='ghost' onClick={handleResetFilters} className='h-8 px-2 lg:px-3'>
            Reset
            <RadixCross2Icon className='ms-2 h-4 w-4' />
          </Button>
        )}
        <div className='ml-auto'>
          <Button size='sm' onClick={() => setInviteOpen(true)}>
            <MailPlus className='mr-2 h-4 w-4' />
            Inviter
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className='flex flex-1 flex-col gap-4'>
        <div className='overflow-hidden rounded-md border'>
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map(cell => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className='h-24 text-center text-muted-foreground'>
                    Aucun résultat.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} className='mt-auto' />
      </div>

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
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  removeMember(deleteConfirm.id, {
                    onSuccess: () => { toast.success('Membre retiré'); setDeleteConfirm(null) },
                    onError: (err) => toast.error(err.message),
                  })
                }
              }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
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
            <AlertDialogAction
              onClick={() => {
                if (revokeConfirm) {
                  revokeInvitation(revokeConfirm, {
                    onSuccess: () => { toast.success('Invitation révoquée'); setRevokeConfirm(null) },
                    onError: (err) => toast.error(err.message),
                  })
                }
              }}
              className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            >
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
