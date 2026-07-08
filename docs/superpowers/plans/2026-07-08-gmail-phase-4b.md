# Gmail Phase 4b (badges non-lu, composer contact, menu intégré) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pastilles « réponse non lue » sur la liste des réservations et l'onglet Emails, composer d'email depuis la fiche contact, et menu templates « Envoyer un email » qui passe par le CRM (fil suivi) au lieu d'ouvrir Gmail.

**Architecture:** Une migration `email_threads` (2 colonnes lecture) + bump dans `recordInbound`. Backend : 2 routes ajoutées à `routes/emails.ts` (`/send` générique, `/threads/:id/read`) avec helpers factorisés et garde org. Frontend `src/features/emails/` : hooks non-lu (React Query, requête partagée), pastille colonne, badge onglet, dialog composer générique réutilisé par le menu et la fiche contact. Tout gaté sur `integration_enabled` sauf les pastilles (inertes tant que rien n'arrive).

**Tech Stack:** React 19 + TS strict, TanStack Query/Table, shadcn/ui, Express 4, vitest.

**Référence design :** `docs/superpowers/specs/2026-07-08-gmail-phase-4b-badges-composer-design.md`

**Contexte exécutant :**
- Worktree `/Users/thomas/Desktop/WINDSURF/restaurant-crm/.worktrees/feat-gmail-phase-2`, branche `feat/gmail-phase-4b` (basée sur le merge 7c3a158). Ne PAS toucher au working dir principal.
- Frontend : commandes à la RACINE (`pnpm build`, `pnpm exec tsc -b --force`). Backend : dans `backend/`.
- Commits : sujet unique en français sans accents, pas de body, pas de Co-Authored-By.
- Hook Prettier reformate après édition — normal.
- Vitest imprime `PASS (n) FAIL (n)`.

---

### Task 0: Committer les docs

- [ ] **Step 1: Commit**

```bash
git add docs/superpowers/specs/2026-07-08-gmail-phase-4b-badges-composer-design.md docs/superpowers/plans/2026-07-08-gmail-phase-4b.md
git commit -m "docs(gmail): spec et plan phase 4b (badges, composer, menu integre)"
```

---

### Task 1: Migration lecture + bump `recordInbound`

**Files:**
- Create: `supabase/migrations/20260708_email_threads_read.sql`
- Modify: `backend/src/lib/email-threads.ts` (recordInbound)
- Modify: `src/lib/supabase/types.ts` (2 colonnes sur email_threads Row/Insert/Update)

- [ ] **Step 1: Écrire la migration**

`supabase/migrations/20260708_email_threads_read.sql` :

```sql
-- Gmail phase 4b : etat de lecture partage equipe des fils.
-- last_inbound_at : bumpe par recordInbound (inbound seulement). last_message_at
-- ne peut pas servir de signal "non lu" car il bouge aussi sur nos envois.
-- last_read_at : mis a now quand un membre ouvre l'onglet Emails du fil.
-- Non lu = last_inbound_at > coalesce(last_read_at, -infini).
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;
ALTER TABLE email_threads ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ;

-- Backfill : dernier message entrant par fil.
UPDATE email_threads t
SET last_inbound_at = sub.max_in
FROM (
  SELECT thread_id, MAX(sent_at) AS max_in
  FROM email_messages
  WHERE direction = 'inbound'
  GROUP BY thread_id
) sub
WHERE sub.thread_id = t.id AND t.last_inbound_at IS NULL;
```

- [ ] **Step 2: Bump dans recordInbound**

Dans `backend/src/lib/email-threads.ts`, `recordInbound` fait aujourd'hui, en cas de succès :

```typescript
  await supabase
    .from('email_threads')
    .update({
      last_message_at: msg.sentAt ?? new Date().toISOString(),
    } as never)
    .eq('id', msg.threadId)
  return true
```

Remplacer par (bump `last_inbound_at` aussi quand le message est entrant) :

```typescript
  const now = msg.sentAt ?? new Date().toISOString()
  await supabase
    .from('email_threads')
    .update(
      (msg.direction === 'inbound'
        ? { last_message_at: now, last_inbound_at: now }
        : { last_message_at: now }) as never
    )
    .eq('id', msg.threadId)
  return true
```

- [ ] **Step 3: Types Supabase**

Dans `src/lib/supabase/types.ts`, bloc `email_threads`, ajouter `last_inbound_at: string | null` et `last_read_at: string | null` dans `Row`, et `last_inbound_at?: string | null` / `last_read_at?: string | null` dans `Insert` et `Update` (ordre alphabétique dans chaque sous-bloc — `last_inbound_at` et `last_read_at` viennent juste après `last_message_at`... vérifier l'ordre exact du fichier et s'y conformer).

- [ ] **Step 4: Vérifier**

Run: `cd backend && pnpm exec tsc --noEmit 2>&1 | tail -1` puis à la racine `pnpm exec tsc -b --force 2>&1 | tail -3`
Attendu : clean des deux côtés.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260708_email_threads_read.sql backend/src/lib/email-threads.ts src/lib/supabase/types.ts
git commit -m "feat(emails): etat de lecture des fils (last_inbound_at/last_read_at) + bump recordInbound"
```

> PRÉREQUIS PROD : appliquer `20260708_email_threads_read.sql` en SQL AVANT de déployer ce code avec le polling actif — sinon le bump `last_inbound_at` de recordInbound échoue. Sans polling (flags OFF) le risque est nul.

---

### Task 2: Routes backend `/send` et `/threads/:id/read`

**Files:**
- Modify: `backend/src/routes/emails.ts`
- Test: `backend/tests/routes/client-email-callsites.test.ts` (compléter)

- [ ] **Step 1: Test de câblage (échec attendu)**

Dans `client-email-callsites.test.ts`, ajouter à la fin du 1er describe :

```typescript
  it('la route send passe par sendClientEmail avec garde org (booking XOR contact)', () => {
    const emails = read('routes/emails.ts')
    expect(emails).toContain("emailType: 'manual_email'")
    expect(emails).toContain('/send')
    expect(emails).toContain("threadKind: 'contact'")
    expect(emails).toContain('organization_id !==')
  })

  it('la route read marque le fil lu avec garde org', () => {
    const emails = read('routes/emails.ts')
    expect(emails).toContain("'/threads/:id/read'")
    expect(emails).toContain('last_read_at')
  })
```

Run: `cd backend && pnpm exec vitest run tests/routes/client-email-callsites.test.ts`
Attendu : FAIL sur les 2 nouveaux.

- [ ] **Step 2: Refactor + nouvelles routes**

Réécrire `backend/src/routes/emails.ts`. Factoriser `esc`/le html/le chargement acteur, garder `/reply` à l'identique fonctionnellement, ajouter `/send` et `/threads/:id/read` :

```typescript
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
  organization_id: string
}

async function loadActor(actorUserId: string): Promise<Actor | null> {
  const { data } = await supabase
    .from('users')
    .select('first_name, last_name, organization_id')
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
```

- [ ] **Step 3: Vérifier**

Run: `cd backend && pnpm exec vitest run tests/routes/client-email-callsites.test.ts && pnpm exec tsc --noEmit`
Attendu : PASS (tous) + `TypeScript: No errors found`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/emails.ts backend/tests/routes/client-email-callsites.test.ts
git commit -m "feat(emails): routes send (booking/contact) et threads read, helpers factorises"
```

---

### Task 3: Hooks non-lu

**Files:**
- Create: `src/features/emails/hooks/use-thread-unread.ts`

- [ ] **Step 1: Créer les hooks**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'

function isUnread(
  lastInbound: string | null,
  lastRead: string | null
): boolean {
  if (!lastInbound) return false
  return !lastRead || new Date(lastInbound) > new Date(lastRead)
}

// Set des booking_id ayant une reponse non lue. Une requete partagee (React
// Query dedupe entre les lignes de la liste). Ne porte que sur les fils avec
// un entrant : volume faible.
export function useUnreadBookingThreads() {
  return useQuery({
    queryKey: ['email_threads_unread'],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_threads')
        .select('booking_id, last_inbound_at, last_read_at')
        .eq('kind', 'booking')
        .not('booking_id', 'is', null)
        .not('last_inbound_at', 'is', null)
      if (error) throw error
      const unread = new Set<string>()
      for (const t of data ?? []) {
        if (t.booking_id && isUnread(t.last_inbound_at, t.last_read_at)) {
          unread.add(t.booking_id)
        }
      }
      return unread
    },
  })
}

// Meta du fil booking pour le badge de l'onglet + la decision de marquer lu.
export function useThreadMeta(bookingId: string | null) {
  return useQuery({
    queryKey: ['email_thread_meta', bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data } = await supabase
        .from('email_threads')
        .select('id, last_inbound_at, last_read_at')
        .eq('booking_id', bookingId!)
        .eq('kind', 'booking')
        .maybeSingle()
      if (!data) return null
      return { ...data, unread: isUnread(data.last_inbound_at, data.last_read_at) }
    },
  })
}

export function useMarkThreadRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (threadId: string) =>
      apiClient(`/api/emails/threads/${threadId}/read`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email_threads_unread'] })
      qc.invalidateQueries({ queryKey: ['email_thread_meta'] })
    },
  })
}
```

- [ ] **Step 2: Vérifier**

Run: `pnpm exec tsc -b --force 2>&1 | tail -3`
Attendu : clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/emails/hooks/use-thread-unread.ts
git commit -m "feat(emails): hooks non-lu (unread par booking, meta fil, mark read)"
```

---

### Task 4: Pastille liste + badge onglet + marquage lu

**Files:**
- Create: `src/features/emails/components/unread-dot.tsx`
- Modify: `src/features/reservations/components/bookings-columns.tsx`
- Modify: `src/features/reservations/components/booking-detail-page.tsx` (TabsTrigger emails ~l.185)
- Modify: `src/features/emails/components/booking-emails-tab.tsx` (marquage lu à l'ouverture)

- [ ] **Step 1: Composant pastille**

`src/features/emails/components/unread-dot.tsx` :

```tsx
import { useUnreadBookingThreads } from '../hooks/use-thread-unread'

// Pastille "reponse non lue" pour une ligne de la liste des reservations.
// S'appuie sur la requete partagee (un seul fetch pour toute la table).
export function UnreadDot({ bookingId }: { bookingId: string }) {
  const { data: unread } = useUnreadBookingThreads()
  if (!unread?.has(bookingId)) return null
  return (
    <span
      className='inline-block h-2 w-2 shrink-0 rounded-full bg-red-500'
      title='Réponse client non lue'
      aria-label='Réponse non lue'
    />
  )
}
```

- [ ] **Step 2: Pastille dans la colonne**

Dans `bookings-columns.tsx` : importer `UnreadDot` et l'afficher dans la cellule de la PREMIÈRE colonne de données (celle du contact/événement — grep la première `cell:` du tableau pour trouver où ; placer la pastille à côté du libellé principal, ex. `<div className='flex items-center gap-1.5'><UnreadDot bookingId={booking.id} /> ...existant...</div>`). Ne pas modifier la logique existante, juste envelopper.

- [ ] **Step 3: Badge onglet**

Dans `booking-detail-page.tsx`, le `TabsTrigger value='emails'` (~l.185) affiche aujourd'hui `emailLogs.length`. Ajouter l'indicateur non-lu : importer `useThreadMeta`, appeler `const { data: threadMeta } = useThreadMeta(booking.id)` près des autres hooks du composant (grep `useEmailLogs`/`emailLogs` pour trouver où `booking` est dispo), et rendre une pastille rouge à côté du badge quand `threadMeta?.unread` :

```tsx
{threadMeta?.unread && (
  <span className='h-1.5 w-1.5 rounded-full bg-red-500' aria-label='Non lu' />
)}
```

Garder le badge `emailLogs.length` existant tel quel. (Vérifier le nom de la variable booking dans ce composant — adapter `booking.id`.)

- [ ] **Step 4: Marquage lu à l'ouverture de l'onglet**

Dans `booking-emails-tab.tsx`, ajouter le marquage lu : `useThreadMeta(bookingId)` + `useMarkThreadRead()`, et un effet qui marque lu quand le fil est non lu :

```tsx
import { useEffect } from 'react'
import { useThreadMeta, useMarkThreadRead } from '../hooks/use-thread-unread'
// ... dans le composant :
const { data: threadMeta } = useThreadMeta(bookingId)
const markRead = useMarkThreadRead()
useEffect(() => {
  if (threadMeta?.id && threadMeta.unread) {
    markRead.mutate(threadMeta.id)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [threadMeta?.id, threadMeta?.unread])
```

(Placer les hooks avec les autres en tête du composant ; ne pas dupliquer `bookingId`.)

- [ ] **Step 5: Vérifier**

Run: `pnpm exec tsc -b --force 2>&1 | tail -3` puis `pnpm build 2>&1 | tail -3`
Attendu : build OK.

- [ ] **Step 6: Commit**

```bash
git add src/features/emails/components/unread-dot.tsx src/features/reservations/components/bookings-columns.tsx src/features/reservations/components/booking-detail-page.tsx src/features/emails/components/booking-emails-tab.tsx
git commit -m "feat(emails): pastille non-lu (liste + onglet) et marquage lu a l'ouverture"
```

---

### Task 5: Dialog composer + menu intégré + bouton fiche contact

**Files:**
- Create: `src/features/emails/components/send-email-dialog.tsx`
- Modify: `src/features/reservations/components/send-email-menu.tsx`
- Modify: `src/features/contacts/components/contact-detail-page.tsx`

- [ ] **Step 1: Dialog générique**

Vérifier d'abord les composants dispo : `src/components/ui/dialog.tsx`, `input.tsx`, `textarea.tsx` (grep leurs exports). Créer `src/features/emails/components/send-email-dialog.tsx` :

```tsx
import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// Composer generique gate par l'appelant (integration_enabled). Cible un
// booking OU un contact ; pre-remplissable (menu templates).
export function SendEmailDialog({
  open,
  onOpenChange,
  bookingId,
  contactId,
  defaultSubject = '',
  defaultMessage = '',
  onSent,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  bookingId?: string
  contactId?: string
  defaultSubject?: string
  defaultMessage?: string
  onSent?: () => void
}) {
  const [subject, setSubject] = useState(defaultSubject)
  const [message, setMessage] = useState(defaultMessage)
  const qc = useQueryClient()

  useEffect(() => {
    if (open) {
      setSubject(defaultSubject)
      setMessage(defaultMessage)
    }
  }, [open, defaultSubject, defaultMessage])

  const send = useMutation({
    mutationFn: () =>
      apiClient('/api/emails/send', {
        method: 'POST',
        body: { bookingId, contactId, subject, message },
      }),
    onSuccess: () => {
      toast.success('Email envoyé')
      if (bookingId) {
        qc.invalidateQueries({ queryKey: ['email_thread', bookingId] })
        qc.invalidateQueries({ queryKey: ['email_logs', bookingId] })
      }
      onOpenChange(false)
      onSent?.()
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi"),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Envoyer un email</DialogTitle>
        </DialogHeader>
        <div className='space-y-3'>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder='Objet'
          />
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder='Message...'
            rows={8}
          />
        </div>
        <DialogFooter>
          <Button
            disabled={!subject.trim() || !message.trim() || send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? (
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            ) : (
              <Send className='mr-2 h-4 w-4' />
            )}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Menu templates intégré**

Dans `send-email-menu.tsx` : importer `useGmailStatus` (`@/features/settings/hooks/use-gmail-account`), `SendEmailDialog`, `useState`. Quand `integration_enabled` est vrai, `handlePick` ne fait plus `window.open` : il stocke `{subject, body}` rendus dans un state et ouvre le dialog (`bookingId={booking.id}`), et l'auto-promotion « Nouveau » → « Qualification » passe dans `onSent`. Quand faux, garder le comportement `window.open` ACTUEL inchangé.

Structure : ajouter en haut du composant

```tsx
const { data: gmailStatus } = useGmailStatus()
const [composer, setComposer] = useState<{ subject: string; body: string } | null>(null)
```

Remplacer la fin de `handlePick` (après avoir calculé `subject`/`body`) par :

```tsx
    if (gmailStatus?.integration_enabled) {
      setComposer({ subject, body })
      return
    }
    // Comportement historique (avant pilote) : Gmail compose dans un onglet.
    const url = buildGmailComposeUrl(booking.contact.email, subject, body)
    window.open(url, '_blank', 'noopener,noreferrer')
    promoteIfNew()
```

Extraire l'auto-promotion dans un helper local `promoteIfNew()` (le bloc `if (booking.status_slug === 'nouveau') {...}` actuel) pour le réutiliser dans `onSent`. Rendre le dialog à la fin du composant (à côté du `DropdownMenuSub`, dans un fragment) :

```tsx
{composer && (
  <SendEmailDialog
    open={!!composer}
    onOpenChange={(v) => !v && setComposer(null)}
    bookingId={booking.id}
    defaultSubject={composer.subject}
    defaultMessage={composer.body}
    onSent={promoteIfNew}
  />
)}
```

Note (vérifié) : `renderTemplate` renvoie `body` en **texte simple** (remplacement de `{{var}}` dans un texte, alimente déjà `buildGmailComposeUrl`). Donc `defaultMessage={composer.body}` passe du texte lisible tel quel, le backend l'échappe. Rien à stripper.

- [ ] **Step 3: Bouton fiche contact**

Dans `contact-detail-page.tsx` : importer `useGmailStatus`, `SendEmailDialog`, `Mail` (lucide), `useState`. Ajouter un état `const [emailOpen, setEmailOpen] = useState(false)`. Dans le header (à côté des boutons existants — grep `Button` dans le fichier pour le pattern), afficher, seulement si `gmailStatus?.integration_enabled && contact?.email` :

```tsx
<Button variant='outline' size='sm' onClick={() => setEmailOpen(true)}>
  <Mail className='mr-2 h-4 w-4' />
  Envoyer un email
</Button>
```

et le dialog :

```tsx
<SendEmailDialog
  open={emailOpen}
  onOpenChange={setEmailOpen}
  contactId={contact.id}
/>
```

(Adapter les noms `contact`/`gmailStatus` au composant.)

- [ ] **Step 4: Vérifier**

Run: `pnpm exec tsc -b --force 2>&1 | tail -3` puis `pnpm build 2>&1 | tail -3`
Attendu : build OK.

- [ ] **Step 5: Commit**

```bash
git add src/features/emails/components/send-email-dialog.tsx src/features/reservations/components/send-email-menu.tsx src/features/contacts/components/contact-detail-page.tsx
git commit -m "feat(emails): dialog composer, menu templates integre et bouton fiche contact"
```

---

### Task 6: Labels + vérification finale

**Files:**
- Modify: `src/features/emails/components/booking-emails-tab.tsx` (label manual_email)

- [ ] **Step 1: Label manuel**

Dans `EMAIL_TYPE_LABELS` de `booking-emails-tab.tsx`, ajouter `manual_email: 'Email'` (à côté de `manual_reply: 'Réponse'`).

- [ ] **Step 2: Backend complet**

Run: `cd backend && pnpm exec vitest run 2>&1 | tail -2 && pnpm exec tsc --noEmit 2>&1 | tail -1`
Attendu : 0 FAIL, tsc clean.

- [ ] **Step 3: Frontend build**

Run: `pnpm build 2>&1 | tail -3` (racine)
Attendu : exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/features/emails/components/booking-emails-tab.tsx
git commit -m "feat(emails): label email manuel dans le journal"
```

---

## Hors périmètre

Cloche globale/inbox, realtime, lu par utilisateur, pièces jointes (phase 5),
capture des réponses aux fils contact partis en Resend (limitation Resend
générale, phase 5).
