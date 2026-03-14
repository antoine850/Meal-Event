import { Router, type Request, type Response } from 'express'
import { supabase } from '../lib/supabase.js'
import { sendEmail } from '../lib/resend.js'

export const membersRouter = Router()

// Helper: get org_id from authenticated user
async function getOrgId(req: Request): Promise<string | null> {
  const userId = (req as any).user?.id
  if (!userId) return null
  const { data } = await supabase
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single()
  return (data as any)?.organization_id || null
}

// Helper: check if requester is admin
async function isAdmin(req: Request): Promise<boolean> {
  const userId = (req as any).user?.id
  if (!userId) return false
  const { data } = await supabase
    .from('users')
    .select('role:roles(slug)')
    .eq('id', userId)
    .single()
  return (data as any)?.role?.slug === 'admin'
}

// ═══════════════════════════════════════════════════════════════
// GET /api/members — List all members + pending invitations
// ═══════════════════════════════════════════════════════════════
membersRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return res.status(401).json({ error: 'No organization' })

    // Fetch members with role and restaurants
    const { data: members, error: membersError } = await supabase
      .from('users')
      .select(`
        id, email, first_name, last_name, phone, avatar_url, is_active, created_at,
        role:roles(id, name, slug),
        user_restaurants(restaurant_id)
      `)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true })

    if (membersError) throw membersError

    // Fetch pending invitations
    const { data: invitations, error: invError } = await supabase
      .from('invitations')
      .select(`
        id, email, status, restaurant_ids, created_at, expires_at,
        role:roles(id, name, slug),
        invited_by_user:users!invitations_invited_by_fkey(first_name, last_name)
      `)
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (invError) throw invError

    res.json({ members: members || [], invitations: invitations || [] })
  } catch (error) {
    console.error('Error fetching members:', error)
    res.status(500).json({ error: 'Failed to fetch members' })
  }
})

// ═══════════════════════════════════════════════════════════════
// GET /api/members/roles — List available roles for this org
// ═══════════════════════════════════════════════════════════════
membersRouter.get('/roles', async (req: Request, res: Response) => {
  try {
    const orgId = await getOrgId(req)
    if (!orgId) return res.status(401).json({ error: 'No organization' })

    const { data, error } = await supabase
      .from('roles')
      .select('id, name, slug, description')
      .eq('organization_id', orgId)
      .order('slug')

    if (error) throw error
    res.json(data || [])
  } catch (error) {
    console.error('Error fetching roles:', error)
    res.status(500).json({ error: 'Failed to fetch roles' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/members/invite — Invite a new member
// ═══════════════════════════════════════════════════════════════
membersRouter.post('/invite', async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const orgId = await getOrgId(req)
    if (!orgId) return res.status(401).json({ error: 'No organization' })

    const userId = (req as any).user?.id
    const { email, role_id, restaurant_ids } = req.body

    if (!email || !role_id) {
      return res.status(400).json({ error: 'Email and role_id are required' })
    }

    // Check if user already exists in org
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', email)
      .single()

    if (existingUser) {
      return res.status(409).json({ error: 'Cet utilisateur fait déjà partie de l\'organisation' })
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email', email)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return res.status(409).json({ error: 'Une invitation est déjà en attente pour cet email' })
    }

    // Get org name for email
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()

    // Get inviter name
    const { data: inviter } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', userId)
      .single()

    // Get role info
    const { data: roleData } = await supabase
      .from('roles')
      .select('name, slug')
      .eq('id', role_id)
      .single()

    // Create invitation record
    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .insert({
        organization_id: orgId,
        email,
        role_id,
        invited_by: userId,
        restaurant_ids: restaurant_ids || [],
      } as never)
      .select('*, role:roles(id, name, slug)')
      .single()

    if (invError) throw invError

    // Use Supabase Admin to invite user via email (creates auth user + sends magic link)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const inviteRedirectUrl = `${frontendUrl}/accept-invite?token=${(invitation as any).token}`

    const { error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteRedirectUrl,
      data: {
        invitation_token: (invitation as any).token,
        organization_id: orgId,
        role_id,
      },
    })

    if (authError) {
      console.error('Supabase auth invite error:', authError)
      // Still keep the invitation record — send manual email as fallback
    }

    // Send invitation email via Resend
    const orgName = (org as any)?.name || 'MealEvent'
    const inviterName = inviter ? `${(inviter as any).first_name} ${(inviter as any).last_name || ''}`.trim() : 'Un administrateur'
    const roleName = (roleData as any)?.name || 'Membre'

    try {
      await sendEmail({
        to: email,
        subject: `Invitation à rejoindre ${orgName} sur MealEvent`,
        html: buildInvitationEmailHtml({
          orgName,
          inviterName,
          roleName,
          acceptUrl: inviteRedirectUrl,
        }),
      })
    } catch (emailErr) {
      console.error('Failed to send invitation email:', emailErr)
    }

    res.status(201).json(invitation)
  } catch (error) {
    console.error('Error inviting member:', error)
    res.status(500).json({ error: 'Failed to send invitation' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/members/accept-invite — Accept an invitation (called by invited user)
// ═══════════════════════════════════════════════════════════════
membersRouter.post('/accept-invite', async (req: Request, res: Response) => {
  try {
    const authUserId = (req as any).user?.id
    const authEmail = (req as any).user?.email
    const { token, first_name, last_name, phone } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' })
    }

    // Find the invitation
    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', token)
      .eq('status', 'pending')
      .single()

    if (invError || !invitation) {
      return res.status(404).json({ error: 'Invitation invalide ou expirée' })
    }

    const inv = invitation as any

    // Check expiration
    if (new Date(inv.expires_at) < new Date()) {
      await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', inv.id)
      return res.status(410).json({ error: 'Cette invitation a expiré' })
    }

    // Check email matches
    if (inv.email.toLowerCase() !== authEmail?.toLowerCase()) {
      return res.status(403).json({ error: 'Cette invitation n\'est pas destinée à votre compte' })
    }

    // Create user profile in the organization
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        organization_id: inv.organization_id,
        role_id: inv.role_id,
        email: authEmail,
        first_name: first_name || authEmail?.split('@')[0] || '',
        last_name: last_name || null,
        phone: phone || null,
      } as never)

    if (userError) {
      // Could be duplicate — user already exists
      if (userError.code === '23505') {
        return res.status(409).json({ error: 'Vous faites déjà partie de cette organisation' })
      }
      throw userError
    }

    // Link user to restaurants if specified
    if (inv.restaurant_ids && inv.restaurant_ids.length > 0) {
      const userRestaurants = inv.restaurant_ids.map((rid: string) => ({
        user_id: authUserId,
        restaurant_id: rid,
      }))
      await supabase.from('user_restaurants').insert(userRestaurants as never)
    }

    // Mark invitation as accepted
    await supabase
      .from('invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', inv.id)

    res.json({ success: true, organization_id: inv.organization_id })
  } catch (error) {
    console.error('Error accepting invitation:', error)
    res.status(500).json({ error: 'Failed to accept invitation' })
  }
})

// ═══════════════════════════════════════════════════════════════
// PATCH /api/members/:id/role — Update member role + restaurants
// ═══════════════════════════════════════════════════════════════
membersRouter.patch('/:id/role', async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const orgId = await getOrgId(req)
    if (!orgId) return res.status(401).json({ error: 'No organization' })

    const memberId = req.params.id
    const { role_id, restaurant_ids } = req.body

    // Don't allow changing own role
    const currentUserId = (req as any).user?.id
    if (memberId === currentUserId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas modifier votre propre rôle' })
    }

    // Update role
    if (role_id) {
      const { error } = await supabase
        .from('users')
        .update({ role_id } as never)
        .eq('id', memberId)
        .eq('organization_id', orgId)

      if (error) throw error
    }

    // Update restaurant assignments
    if (restaurant_ids !== undefined) {
      // Remove existing assignments
      await supabase
        .from('user_restaurants')
        .delete()
        .eq('user_id', memberId)

      // Add new assignments
      if (restaurant_ids.length > 0) {
        const userRestaurants = restaurant_ids.map((rid: string) => ({
          user_id: memberId,
          restaurant_id: rid,
        }))
        await supabase.from('user_restaurants').insert(userRestaurants as never)
      }
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating member role:', error)
    res.status(500).json({ error: 'Failed to update member role' })
  }
})

// ═══════════════════════════════════════════════════════════════
// DELETE /api/members/:id — Remove member from organization
// ═══════════════════════════════════════════════════════════════
membersRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const orgId = await getOrgId(req)
    if (!orgId) return res.status(401).json({ error: 'No organization' })

    const memberId = req.params.id

    // Don't allow removing self
    const currentUserId = (req as any).user?.id
    if (memberId === currentUserId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous supprimer vous-même' })
    }

    // Remove user_restaurants first
    await supabase
      .from('user_restaurants')
      .delete()
      .eq('user_id', memberId)

    // Deactivate user (soft delete — keep record for audit)
    const { error } = await supabase
      .from('users')
      .update({ is_active: false, role_id: null } as never)
      .eq('id', memberId)
      .eq('organization_id', orgId)

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    console.error('Error removing member:', error)
    res.status(500).json({ error: 'Failed to remove member' })
  }
})

// ═══════════════════════════════════════════════════════════════
// DELETE /api/members/invitations/:id — Revoke invitation
// ═══════════════════════════════════════════════════════════════
membersRouter.delete('/invitations/:id', async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const orgId = await getOrgId(req)
    if (!orgId) return res.status(401).json({ error: 'No organization' })

    const { error } = await supabase
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', req.params.id)
      .eq('organization_id', orgId)
      .eq('status', 'pending')

    if (error) throw error

    res.json({ success: true })
  } catch (error) {
    console.error('Error revoking invitation:', error)
    res.status(500).json({ error: 'Failed to revoke invitation' })
  }
})

// ═══════════════════════════════════════════════════════════════
// POST /api/members/invitations/:id/resend — Resend invitation email
// ═══════════════════════════════════════════════════════════════
membersRouter.post('/invitations/:id/resend', async (req: Request, res: Response) => {
  try {
    if (!(await isAdmin(req))) {
      return res.status(403).json({ error: 'Admin access required' })
    }

    const orgId = await getOrgId(req)
    if (!orgId) return res.status(401).json({ error: 'No organization' })

    const { data: invitation } = await supabase
      .from('invitations')
      .select('*, role:roles(name)')
      .eq('id', req.params.id)
      .eq('organization_id', orgId)
      .eq('status', 'pending')
      .single()

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' })
    }

    const inv = invitation as any

    // Refresh expiration
    await supabase
      .from('invitations')
      .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('id', inv.id)

    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single()

    const { data: inviter } = await supabase
      .from('users')
      .select('first_name, last_name')
      .eq('id', (req as any).user?.id)
      .single()

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const acceptUrl = `${frontendUrl}/accept-invite?token=${inv.token}`

    await sendEmail({
      to: inv.email,
      subject: `Rappel: Invitation à rejoindre ${(org as any)?.name || 'MealEvent'} sur MealEvent`,
      html: buildInvitationEmailHtml({
        orgName: (org as any)?.name || 'MealEvent',
        inviterName: inviter ? `${(inviter as any).first_name} ${(inviter as any).last_name || ''}`.trim() : 'Un administrateur',
        roleName: inv.role?.name || 'Membre',
        acceptUrl,
      }),
    })

    res.json({ success: true })
  } catch (error) {
    console.error('Error resending invitation:', error)
    res.status(500).json({ error: 'Failed to resend invitation' })
  }
})

// ═══════════════════════════════════════════════════════════════
// Email template
// ═══════════════════════════════════════════════════════════════
function buildInvitationEmailHtml(params: {
  orgName: string
  inviterName: string
  roleName: string
  acceptUrl: string
}): string {
  const { orgName, inviterName, roleName, acceptUrl } = params
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <tr><td>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;border:1px solid #e4e4e7;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#0d7377 0%,#14b8a6 100%);padding:32px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Vous êtes invité(e) !</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#333;">
              <strong>${inviterName}</strong> vous invite à rejoindre <strong>${orgName}</strong> sur MealEvent en tant que <strong>${roleName}</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr><td align="center">
                <a href="${acceptUrl}" style="display:inline-block;padding:14px 32px;background:#0d7377;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                  Accepter l'invitation
                </a>
              </td></tr>
            </table>
            <p style="margin:0;font-size:13px;color:#666;line-height:1.5;">
              Cette invitation expire dans 7 jours. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
