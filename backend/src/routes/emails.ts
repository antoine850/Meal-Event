import { Router, type Request, type Response } from 'express'
import { sendClientEmail } from '../lib/client-email.js'
import { supabase } from '../lib/supabase.js'

export const emailsRouter = Router()

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// POST /api/emails/reply — reponse libre dans le fil d'un booking.
// Email personnel brut (decision 08/07) : texte echappe + signature, pas de
// template brande. Non gate : master OFF => part en Resend (l'UI masque le
// composer de toute facon).
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
    if (!actorUserId) {
      return res.status(401).json({ error: 'Unauthenticated' })
    }

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, organization_id, contact:contacts(email)')
      .eq('id', bookingId)
      .single()

    // Garde multi-tenant : la route tourne en service-role et le corps du
    // message est libre, un acteur d'une autre org ne doit ni ecrire dans ce
    // fil ni apprendre que le booking existe (meme 404 dans les deux cas).
    const { data: actor } = await supabase
      .from('users')
      .select('first_name, last_name, organization_id')
      .eq('id', actorUserId)
      .single()
    if (
      !booking ||
      !actor ||
      (actor as any).organization_id !== (booking as any).organization_id
    ) {
      return res.status(404).json({ error: 'Booking introuvable' })
    }
    const contactEmail = (booking as any)?.contact?.email as string | undefined
    if (!contactEmail) {
      return res.status(400).json({ error: 'Contact sans adresse email' })
    }

    // Destinataire : le From du dernier message entrant du fil, sinon le
    // contact (comportement "repondre" quand le client ecrit d'une autre
    // adresse).
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

    const signature = `${(actor as any).first_name} ${(actor as any).last_name}`
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#222;">${esc(
      message.trim()
    ).replace(/\n/g, '<br/>')}${signature ? `<br/><br/>${esc(signature)}` : ''}</div>`

    const result = await sendClientEmail({
      organizationId: (booking as any).organization_id,
      bookingId,
      emailType: 'manual_reply',
      actorUserId: actorUserId ?? null,
      to,
      // Fallback si le fil n'existe pas encore : le sujet evenement du fil
      // prend le dessus des que l'integration est active.
      subject: 'Votre événement',
      html,
    })
    return res.json({ success: true, provider: result.provider })
  } catch (error) {
    console.error('[emails] reply error:', error)
    return res.status(500).json({ error: "Échec de l'envoi" })
  }
})
