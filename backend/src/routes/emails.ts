import { Router, type Request, type Response } from 'express'
import { sendClientEmail } from '../lib/client-email.js'
import { supabase } from '../lib/supabase.js'

export const emailsRouter = Router()

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Email personnel brut (decision 08/07) : texte echappe (nl2br) + signature.
function buildPlainHtml(message: string, signature: string): string {
  const body = esc(message.trim()).replace(/\n/g, '<br/>')
  const sig = signature ? `<br/><br/>${esc(signature)}` : ''
  return `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">${body}${sig}</div>`
}

interface Actor {
  first_name: string
  last_name: string
  email: string | null
  organization_id: string
}

async function loadActor(actorUserId: string): Promise<Actor | null> {
  const { data } = await supabase
    .from('users')
    .select('first_name, last_name, email, organization_id')
    .eq('id', actorUserId)
    .single()
  return (data as Actor) ?? null
}

const signatureOf = (a: Actor) => `${a.first_name} ${a.last_name}`

// POST /api/emails/reply — reponse libre dans le fil d'un booking.
emailsRouter.post('/reply', async (req: Request, res: Response) => {
  try {
    const { bookingId, message } = req.body as {
      bookingId?: string
      message?: string
    }
    const actorUserId = (req as any).user?.id as string | undefined
    if (!bookingId || !message?.trim()) {
      return res.status(400).json({ error: 'bookingId et message requis' })
    }
    if (!actorUserId) return res.status(401).json({ error: 'Unauthenticated' })

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, organization_id, contact:contacts(email)')
      .eq('id', bookingId)
      .single()
    const actor = await loadActor(actorUserId)
    if (
      !booking ||
      !actor ||
      actor.organization_id !== (booking as any).organization_id
    ) {
      return res.status(404).json({ error: 'Booking introuvable' })
    }
    const contactEmail = (booking as any)?.contact?.email as string | undefined
    if (!contactEmail) {
      return res.status(400).json({ error: 'Contact sans adresse email' })
    }

    // Destinataire : le From du dernier message entrant du fil, sinon le contact.
    let to = contactEmail
    const { data: thread } = await supabase
      .from('email_threads')
      .select('id')
      .eq('booking_id', bookingId)
      .eq('kind', 'booking')
      .maybeSingle()
    if (thread) {
      const { data: lastIn } = await supabase
        .from('email_messages')
        .select('from_email')
        .eq('thread_id', (thread as any).id)
        .eq('direction', 'inbound')
        .not('from_email', 'is', null)
        .order('sent_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if ((lastIn as any)?.from_email) to = (lastIn as any).from_email
    }

    const result = await sendClientEmail({
      organizationId: actor.organization_id,
      bookingId,
      emailType: 'manual_reply',
      actorUserId,
      to,
      subject: 'Votre événement',
      html: buildPlainHtml(message, signatureOf(actor)),
      // Chemin Resend (fallback ou boite non pilote) : From = noreply@, la
      // reponse du client doit revenir a l'auteur. Ignore sur le chemin Gmail.
      replyTo: actor.email || undefined,
    })
    return res.json({ success: true, provider: result.provider })
  } catch (error) {
    console.error('[emails] reply error:', error)
    return res.status(500).json({ error: "Échec de l'envoi" })
  }
})

// POST /api/emails/send — email sortant libre depuis un booking OU un contact
// (menu templates integre + composer fiche contact). Sujet libre : sur un fil
// booking existant + integration ON, sendClientEmail fait suivre le fil.
emailsRouter.post('/send', async (req: Request, res: Response) => {
  try {
    const { bookingId, contactId, subject, message } = req.body as {
      bookingId?: string
      contactId?: string
      subject?: string
      message?: string
    }
    const actorUserId = (req as any).user?.id as string | undefined
    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ error: 'subject et message requis' })
    }
    if (!bookingId === !contactId) {
      return res
        .status(400)
        .json({ error: 'bookingId OU contactId (exactement un)' })
    }
    if (!actorUserId) return res.status(401).json({ error: 'Unauthenticated' })
    const actor = await loadActor(actorUserId)
    if (!actor) return res.status(401).json({ error: 'Unauthenticated' })

    let orgId: string
    let to: string
    let sendArgs: {
      bookingId?: string
      contactId?: string
      threadKind: 'booking' | 'contact'
    }

    if (bookingId) {
      const { data: booking } = await supabase
        .from('bookings')
        .select('id, organization_id, contact:contacts(email)')
        .eq('id', bookingId)
        .single()
      const email = (booking as any)?.contact?.email as string | undefined
      if (
        !booking ||
        actor.organization_id !== (booking as any).organization_id
      ) {
        return res.status(404).json({ error: 'Booking introuvable' })
      }
      if (!email) {
        return res.status(400).json({ error: 'Contact sans adresse email' })
      }
      orgId = (booking as any).organization_id
      to = email
      sendArgs = { bookingId, threadKind: 'booking' }
    } else {
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, organization_id, email')
        .eq('id', contactId!)
        .single()
      if (
        !contact ||
        actor.organization_id !== (contact as any).organization_id
      ) {
        return res.status(404).json({ error: 'Contact introuvable' })
      }
      if (!(contact as any).email) {
        return res.status(400).json({ error: 'Contact sans adresse email' })
      }
      orgId = (contact as any).organization_id
      to = (contact as any).email
      sendArgs = { contactId: contactId!, threadKind: 'contact' }
    }

    const result = await sendClientEmail({
      organizationId: orgId,
      ...sendArgs,
      emailType: 'manual_email',
      actorUserId,
      to,
      subject: subject.trim(),
      html: buildPlainHtml(message, signatureOf(actor)),
      replyTo: actor.email || undefined,
    })
    return res.json({ success: true, provider: result.provider })
  } catch (error) {
    console.error('[emails] send error:', error)
    return res.status(500).json({ error: "Échec de l'envoi" })
  }
})

// POST /api/emails/threads/:id/read — marque le fil lu (partage equipe).
emailsRouter.post('/threads/:id/read', async (req: Request, res: Response) => {
  try {
    const actorUserId = (req as any).user?.id as string | undefined
    if (!actorUserId) return res.status(401).json({ error: 'Unauthenticated' })
    const { data: thread } = await supabase
      .from('email_threads')
      .select('id, organization_id')
      .eq('id', req.params.id)
      .single()
    const actor = await loadActor(actorUserId)
    if (
      !thread ||
      !actor ||
      actor.organization_id !== (thread as any).organization_id
    ) {
      return res.status(404).json({ error: 'Fil introuvable' })
    }
    await supabase
      .from('email_threads')
      .update({ last_read_at: new Date().toISOString() } as never)
      .eq('id', req.params.id)
    return res.json({ success: true })
  } catch (error) {
    console.error('[emails] read error:', error)
    return res.status(500).json({ error: 'Échec' })
  }
})
