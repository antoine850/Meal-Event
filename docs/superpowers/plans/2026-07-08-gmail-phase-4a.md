# Gmail Phase 4a (fil email sur la page événement) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'onglet Emails de la page événement affiche le fil de conversation (envoyés + reçus) et permet de répondre quand l'intégration Gmail est active.

**Architecture:** Frontend feature-folder `src/features/emails/` : nouveau hook `useBookingEmailThread` (Supabase + RLS), vue fil sanitisée DOMPurify, composer gaté sur `integration_enabled` ; le composant actuel devient un journal repliable. Backend : une route `POST /api/emails/reply` qui délègue tout à `sendClientEmail`. Types Supabase des 2 tables ajoutés à la main (MCP non autorisé), format généré exact.

**Tech Stack:** React 19 + TS strict, TanStack Query, shadcn/ui, DOMPurify (nouvelle dep), Express 4, vitest (backend).

**Référence design :** `docs/superpowers/specs/2026-07-08-gmail-phase-4a-fil-evenement-design.md`

**Contexte exécutant :**
- Worktree `/Users/thomas/Desktop/WINDSURF/restaurant-crm/.worktrees/feat-gmail-phase-2`, branche `feat/gmail-phase-4` (basée sur le merge 161db20). Ne PAS toucher au working dir principal.
- Frontend : commandes à la RACINE du worktree (`pnpm build`, `pnpm exec tsc -b`). Backend : dans `backend/`.
- Style commits : sujet unique en français sans accents, pas de body, pas de Co-Authored-By.
- Un hook Prettier reformate après édition — normal.
- Le reporter vitest imprime `PASS (n) FAIL (n)`.
- Règle sécurité : tout HTML entrant (emails clients) passe par `DOMPurify.sanitize` AVANT le rendu HTML brut React — jamais de rendu HTML non sanitisé.

---

### Task 0: Committer les docs

- [ ] **Step 1: Commit**

```bash
git add docs/superpowers/specs/2026-07-08-gmail-phase-4a-fil-evenement-design.md docs/superpowers/plans/2026-07-08-gmail-phase-4a.md
git commit -m "docs(gmail): spec et plan phase 4a (fil evenement)"
```

---

### Task 1: Types Supabase `email_threads` / `email_messages`

**Files:**
- Modify: `src/lib/supabase/types.ts`

Les tables existent en prod (migrations 20260706/20260707/20260708) mais pas
dans les types générés. On les ajoute à la main au format généré exact
(le MCP Supabase est non autorisé) — la prochaine régénération officielle
écrasera avec un résultat identique.

- [ ] **Step 1: Repérer le format**

Lire le bloc `email_logs` dans `src/lib/supabase/types.ts` (grep `email_logs:`) pour calquer indentation et forme des `Relationships`.

- [ ] **Step 2: Insérer les deux tables**

Dans `Database.public.Tables`, juste APRÈS le bloc `email_logs` (ordre alphabétique), insérer :

```typescript
      email_messages: {
        Row: {
          body_html: string | null
          body_text: string | null
          cc: string[] | null
          created_at: string
          direction: string
          from_email: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          in_reply_to: string | null
          provider: string
          references_header: string | null
          rfc_message_id: string | null
          sender_user_id: string | null
          sent_at: string | null
          snippet: string | null
          subject: string | null
          thread_id: string
          to_emails: string[] | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          cc?: string[] | null
          created_at?: string
          direction: string
          from_email?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          in_reply_to?: string | null
          provider?: string
          references_header?: string | null
          rfc_message_id?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id: string
          to_emails?: string[] | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          cc?: string[] | null
          created_at?: string
          direction?: string
          from_email?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          in_reply_to?: string | null
          provider?: string
          references_header?: string | null
          rfc_message_id?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          snippet?: string | null
          subject?: string | null
          thread_id?: string
          to_emails?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "email_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_threads: {
        Row: {
          booking_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          kind: string
          last_message_at: string | null
          organization_id: string
          status: string
          subject: string | null
        }
        Insert: {
          booking_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          organization_id: string
          status?: string
          subject?: string | null
        }
        Update: {
          booking_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          organization_id?: string
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_threads_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
```

Si le style du bloc `email_logs` diffère (guillemets, virgule finale des
Relationships), s'aligner sur le fichier, pas sur ce bloc.

- [ ] **Step 3: Ajouter les alias**

Après `export type EmailLog = Tables<'email_logs'>` :

```typescript
export type EmailThread = Tables<'email_threads'>
export type EmailMessage = Tables<'email_messages'>
```

- [ ] **Step 4: Vérifier**

Run: `pnpm exec tsc -b --force 2>&1 | tail -3` (racine)
Attendu : aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/types.ts
git commit -m "feat(emails): types supabase email_threads et email_messages (a la main, mcp indisponible)"
```

---

### Task 2: Dépendance DOMPurify + hook `useBookingEmailThread`

**Files:**
- Modify: `package.json` (racine, via pnpm)
- Create: `src/features/emails/hooks/use-email-thread.ts`

- [ ] **Step 1: Installer DOMPurify**

Run: `pnpm add dompurify` (racine du worktree)
Attendu : ajouté à dependencies (dompurify ≥3 embarque ses types).

- [ ] **Step 2: Créer le hook**

`src/features/emails/hooks/use-email-thread.ts` :

```typescript
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { EmailMessage, EmailThread } from '@/lib/supabase/types'

export interface BookingEmailThread {
  thread: Pick<EmailThread, 'id' | 'subject' | 'last_message_at'> | null
  messages: EmailMessage[]
}

// Fil du booking (kind='booking', unique par booking) + messages ordonnes.
// RLS select_org fait l'isolation. Refetch periodique : les reponses arrivent
// par polling backend (~3 min), pas besoin de realtime.
export function useBookingEmailThread(bookingId: string | null) {
  return useQuery<BookingEmailThread>({
    queryKey: ['email_thread', bookingId],
    enabled: !!bookingId,
    refetchInterval: 45_000,
    queryFn: async () => {
      const { data: thread, error } = await supabase
        .from('email_threads')
        .select('id, subject, last_message_at')
        .eq('booking_id', bookingId!)
        .eq('kind', 'booking')
        .maybeSingle()
      if (error) throw error
      if (!thread) return { thread: null, messages: [] }

      const { data: messages, error: msgError } = await supabase
        .from('email_messages')
        .select('*')
        .eq('thread_id', thread.id)
        .order('sent_at', { ascending: true, nullsFirst: true })
      if (msgError) throw msgError
      return { thread, messages: (messages ?? []) as EmailMessage[] }
    },
  })
}
```

- [ ] **Step 3: Vérifier**

Run: `pnpm exec tsc -b --force 2>&1 | tail -3`
Attendu : aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/features/emails/hooks/use-email-thread.ts
git commit -m "feat(emails): hook useBookingEmailThread + dependance dompurify"
```

---

### Task 3: Vue fil `EmailThreadView`

**Files:**
- Create: `src/features/emails/components/email-thread-view.tsx`

- [ ] **Step 1: Créer le composant**

Le corps HTML d'un email client est un vecteur XSS : il passe
OBLIGATOIREMENT par `DOMPurify.sanitize` avant le rendu HTML React.

```tsx
import DOMPurify from 'dompurify'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { EmailMessage } from '@/lib/supabase/types'

// Gmail renvoie snippet (et parfois body_text) avec entites HTML echappees
// (&#39; garanti en francais) : on decode au rendu, pas en base.
function decodeEntities(s: string): string {
  const doc = new DOMParser().parseFromString(s, 'text/html')
  return doc.documentElement.textContent ?? s
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function MessageBody({ message }: { message: EmailMessage }) {
  if (message.body_html) {
    const safeHtml = DOMPurify.sanitize(message.body_html, {
      USE_PROFILES: { html: true },
    })
    return (
      <div
        className='max-h-96 overflow-auto text-sm [&_a]:text-primary [&_a]:underline'
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    )
  }
  const text =
    message.body_text ??
    (message.snippet ? decodeEntities(message.snippet) : '')
  return <p className='text-sm whitespace-pre-wrap'>{text}</p>
}

function MessageCard({
  message,
  contactEmail,
}: {
  message: EmailMessage
  contactEmail?: string | null
}) {
  const inbound = message.direction === 'inbound'
  const otherAddress =
    inbound &&
    !!contactEmail &&
    !!message.from_email &&
    message.from_email.toLowerCase() !== contactEmail.toLowerCase()

  return (
    <div
      className={
        inbound
          ? 'rounded-lg border bg-muted/40 p-3'
          : 'rounded-lg border bg-background p-3'
      }
    >
      <div className='mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
        {inbound ? (
          <ArrowDownLeft className='h-3.5 w-3.5 text-emerald-600' />
        ) : (
          <ArrowUpRight className='h-3.5 w-3.5' />
        )}
        <span className='font-medium text-foreground'>
          {inbound ? (message.from_email ?? 'Client') : 'Vous'}
        </span>
        {otherAddress && (
          <Badge variant='outline' className='h-5 px-1.5 text-[10px]'>
            Autre adresse
          </Badge>
        )}
        <span>{formatDate(message.sent_at)}</span>
      </div>
      <MessageBody message={message} />
    </div>
  )
}

export function EmailThreadView({
  subject,
  messages,
  contactEmail,
}: {
  subject: string | null
  messages: EmailMessage[]
  contactEmail?: string | null
}) {
  return (
    <Card>
      <CardContent className='space-y-3 py-4'>
        {subject && <p className='text-sm font-semibold'>{subject}</p>}
        {messages.map((m) => (
          <MessageCard key={m.id} message={m} contactEmail={contactEmail} />
        ))}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Vérifier**

Run: `pnpm exec tsc -b --force 2>&1 | tail -3`
Attendu : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/features/emails/components/email-thread-view.tsx
git commit -m "feat(emails): vue du fil de conversation (sanitisee dompurify)"
```

---

### Task 4: Composer `EmailReplyComposer`

**Files:**
- Create: `src/features/emails/components/email-reply-composer.tsx`

- [ ] **Step 1: Créer le composant**

Vérifier d'abord que `src/components/ui/textarea.tsx` existe (sinon utiliser
un `<textarea>` stylé sur le modèle d'un usage existant du repo — grep
`Textarea` dans src/features pour le pattern). Vérifier aussi le pattern
toast : grep `from 'sonner'` dans src/features pour l'import exact.

```tsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

// Rendu uniquement quand integration_enabled (gate dans booking-emails-tab).
export function EmailReplyComposer({ bookingId }: { bookingId: string }) {
  const [message, setMessage] = useState('')
  const queryClient = useQueryClient()

  const reply = useMutation({
    mutationFn: () =>
      apiClient('/api/emails/reply', {
        method: 'POST',
        body: { bookingId, message },
      }),
    onSuccess: () => {
      setMessage('')
      toast.success('Réponse envoyée')
      queryClient.invalidateQueries({ queryKey: ['email_thread', bookingId] })
      queryClient.invalidateQueries({ queryKey: ['email_logs', bookingId] })
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Échec de l'envoi"),
  })

  return (
    <div className='space-y-2'>
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder='Répondre au client...'
        rows={4}
      />
      <div className='flex justify-end'>
        <Button
          size='sm'
          disabled={!message.trim() || reply.isPending}
          onClick={() => reply.mutate()}
        >
          {reply.isPending ? (
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          ) : (
            <Send className='mr-2 h-4 w-4' />
          )}
          Envoyer
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier**

Run: `pnpm exec tsc -b --force 2>&1 | tail -3`
Attendu : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/features/emails/components/email-reply-composer.tsx
git commit -m "feat(emails): composer de reponse dans le fil"
```

---

### Task 5: Onglet remanié + call site

**Files:**
- Modify: `src/features/emails/components/booking-emails-tab.tsx`
- Modify: `src/features/reservations/components/booking-detail.tsx` (ligne ~3163)

- [ ] **Step 1: Remanier l'onglet**

Réécrire `booking-emails-tab.tsx` : fil en haut (si messages), composer gaté,
journal actuel dans un bloc repliable. Garder la liste `email_logs` existante
telle quelle (la déplacer, pas la réécrire). Structure cible :

```tsx
import { Loader2, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { useGmailStatus } from '@/features/settings/hooks/use-gmail-account'
import { useEmailLogsByBooking } from '../hooks/use-email-logs'
import { useBookingEmailThread } from '../hooks/use-email-thread'
import { EmailReplyComposer } from './email-reply-composer'
import { EmailThreadView } from './email-thread-view'

const EMAIL_TYPE_LABELS: Record<string, string> = {
  quote_sent: 'Devis',
  deposit_invoice: "Facture d'acompte",
  deposit_invoice_resend: "Facture d'acompte (renvoi)",
  balance_invoice: 'Facture de solde',
  balance_invoice_resend: 'Facture de solde (renvoi)',
  payment_link: 'Lien de paiement',
  payment_reminder: 'Relance de paiement',
  credit_note: 'Avoir',
  manual_reply: 'Réponse',
}
```

(Si `collapsible.tsx` n'existe pas dans `src/components/ui/`, utiliser un
`<details>`/`<summary>` natif stylé — ne PAS installer via shadcn add sans
vérifier, composants customisés RTL.)

Corps du composant :

```tsx
export function BookingEmailsTab({
  bookingId,
  contactEmail,
}: {
  bookingId: string
  contactEmail?: string | null
}) {
  const { data: logs = [], isLoading: logsLoading } =
    useEmailLogsByBooking(bookingId)
  const { data: threadData, isLoading: threadLoading } =
    useBookingEmailThread(bookingId)
  const { data: gmailStatus } = useGmailStatus()

  const messages = threadData?.messages ?? []
  const isLoading = logsLoading || threadLoading

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>Emails</h3>
        <Badge variant='secondary'>
          {messages.length || logs.length} email
          {(messages.length || logs.length) > 1 ? 's' : ''}
        </Badge>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className='flex items-center justify-center py-8'>
            <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
          </CardContent>
        </Card>
      ) : (
        <>
          {messages.length > 0 ? (
            <EmailThreadView
              subject={threadData?.thread?.subject ?? null}
              messages={messages}
              contactEmail={contactEmail}
            />
          ) : (
            <Card>
              <CardContent className='py-8 text-center text-muted-foreground'>
                <Mail className='mx-auto mb-2 h-8 w-8 opacity-50' />
                <p className='text-sm'>Aucune conversation.</p>
                <p className='mt-1 text-xs'>
                  Les échanges avec le client apparaîtront ici.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Zone de reponse : uniquement quand l'integration Gmail est active
              (les reponses clients ne remontent pas sans polling). */}
          {gmailStatus?.integration_enabled && (
            <EmailReplyComposer bookingId={bookingId} />
          )}

          {logs.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger className='text-sm text-muted-foreground underline-offset-4 hover:underline'>
                Journal des envois ({logs.length})
              </CollapsibleTrigger>
              <CollapsibleContent className='mt-2'>
                {/* ... la Card + liste logs EXISTANTE deplacee ici, inchangee ... */}
              </CollapsibleContent>
            </Collapsible>
          )}
        </>
      )}
    </div>
  )
}
```

Le bloc « liste logs existante » = la `Card`/`CardContent className='divide-y py-2'`
actuelle avec son `.map((log) => ...)`, copiée sans modification (labels mis à jour).

- [ ] **Step 2: Mettre à jour le call site**

Dans `src/features/reservations/components/booking-detail.tsx` (~l.3163),
remplacer :

```tsx
<BookingEmailsTab bookingId={booking.id} />
```

par :

```tsx
<BookingEmailsTab
  bookingId={booking.id}
  contactEmail={booking.contact?.email ?? null}
/>
```

(Vérifier le nom exact de la relation contact sur l'objet `booking` de cette
page — grep `booking.contact` dans le fichier ; adapter si besoin.)

- [ ] **Step 3: Vérifier**

Run: `pnpm exec tsc -b --force 2>&1 | tail -3` puis `pnpm build 2>&1 | tail -5`
Attendu : build OK.

- [ ] **Step 4: Commit**

```bash
git add src/features/emails/components/booking-emails-tab.tsx src/features/reservations/components/booking-detail.tsx
git commit -m "feat(emails): onglet emails = fil + composer gate + journal repliable"
```

---

### Task 6: Route backend `POST /api/emails/reply`

**Files:**
- Create: `backend/src/routes/emails.ts`
- Modify: `backend/src/index.ts` (import + mount)
- Test: `backend/tests/routes/client-email-callsites.test.ts` (compléter)

- [ ] **Step 1: Test de câblage (échec attendu)**

Dans `client-email-callsites.test.ts` : ajouter `'routes/emails.ts'` au tableau
`clientRoutes` (verrou sendEmail/email_logs), et ce bloc à la fin du describe
principal :

```typescript
  it('la route reply passe par sendClientEmail et est montee requireAuth', () => {
    const emails = read('routes/emails.ts')
    expect(emails).toContain('sendClientEmail')
    expect(emails).toContain("emailType: 'manual_reply'")
    const index = read('index.ts')
    expect(index).toContain("app.use('/api/emails', requireAuth, emailsRouter)")
  })
```

Run: `cd backend && pnpm exec vitest run tests/routes/client-email-callsites.test.ts`
Attendu : FAIL (routes/emails.ts n'existe pas).

- [ ] **Step 2: Créer la route**

`backend/src/routes/emails.ts` :

```typescript
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

    const { data: booking } = await supabase
      .from('bookings')
      .select('id, organization_id, contact:contacts(email)')
      .eq('id', bookingId)
      .single()
    const contactEmail = (booking as any)?.contact?.email as string | undefined
    if (!booking || !contactEmail) {
      return res
        .status(400)
        .json({ error: 'Booking introuvable ou contact sans email' })
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

    let signature = ''
    if (actorUserId) {
      const { data: user } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', actorUserId)
        .single()
      if (user)
        signature = `${(user as any).first_name} ${(user as any).last_name}`
    }
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
```

- [ ] **Step 3: Monter la route**

Dans `backend/src/index.ts` : ajouter l'import à côté des autres routes :

```typescript
import { emailsRouter } from './routes/emails.js'
```

et le mount à côté de `app.use('/api/payments', requireAuth, paymentsRouter)` :

```typescript
app.use('/api/emails', requireAuth, emailsRouter)
```

- [ ] **Step 4: Vérifier**

Run: `cd backend && pnpm exec vitest run tests/routes/client-email-callsites.test.ts && pnpm exec tsc --noEmit`
Attendu : PASS (tous) + `TypeScript: No errors found`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/emails.ts backend/src/index.ts backend/tests/routes/client-email-callsites.test.ts
git commit -m "feat(emails): route reply dans le fil via sendClientEmail"
```

---

### Task 7: Vérification finale

- [ ] **Step 1: Backend complet**

Run: `cd backend && pnpm exec vitest run 2>&1 | tail -2 && pnpm exec tsc --noEmit 2>&1 | tail -1`
Attendu : 0 FAIL, tsc clean.

- [ ] **Step 2: Frontend build**

Run: `pnpm build 2>&1 | tail -5` (racine)
Attendu : exit 0.

- [ ] **Step 3: Preview (si possible)**

`pnpm dev` + backend local : ouvrir un booking → onglet Emails : fil affiché
(ou vide), composer absent (flags OFF en local), journal repliable présent.

---

## Hors périmètre (itération 4b)

Badge compteur, lu/non-lu, composer fiche contact, remplacement du menu
« envoyer un email », realtime.
